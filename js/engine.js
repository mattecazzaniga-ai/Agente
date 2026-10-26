// Motore del turno annuale. Un turno = un anno per tutta la famiglia:
//   iniziaAnno → (il giocatore risolve gli eventi) → fineAnno
// fineAnno applica scuola, lavoro, salute, economia, morti ed eredità, poi passa all'anno dopo.
// Tutta la casualità passa da rng.js (stato nel salvataggio): stesso seed, stessa partita.

import { casuale, normale, probabile, scegli } from "./rng.js";
import { eta, euro, limita, titoloAlmeno } from "./util.js";
import { giocatore, personeVive, vive } from "./state.js";
import { annota, segnaposto } from "./family.js";
import { aggiornaAziende, aggiornaIndici, avviaNaspi, bilancioNucleo, eredita, interessi, mantenimenti, patrimonio, rivalutaCase, rivalutaPensione, vaInPensione } from "./economy.js";
import { assumi, iscriviSuperiori, licenzia, lasciaStudi, aggiungiRicordo } from "./azioni.js";
import { condizioniOk, risolviScelta, sceltaAutomatica, scegliEventiAnno, testoEvento, testoScelta, titoloEvento } from "./events.js";

// ---------------------------------------------------------------------------
// Inizio anno: eventi per le persone controllate dal giocatore
// ---------------------------------------------------------------------------

/** Prepara gli eventi dell'anno per il personaggio giocato (FASE 1: una persona alla volta). */
export function iniziaAnno(state, data) {
  const p = giocatore(state);
  state.world.eventi_anno = [];
  if (!vive(p)) return state.world.eventi_anno;
  const scelti = [...obbligatori(state, data, p), ...scegliEventiAnno(state, data, p)];
  const visti = new Set();
  for (const s of scelti) {
    if (visti.has(s.evento)) continue;
    visti.add(s.evento);
    state.world.eventi_anno.push({ persona: p.id, evento: s.evento, variante: s.variante ?? 0, risolto: false, scelta: null, esito: null });
  }
  return state.world.eventi_anno;
}

/** Eventi di passaggio (scelta delle superiori, dopo il diploma…) che non possono mancare. */
function obbligatori(state, data, p) {
  const out = [];
  for (const ev of data.eventi) {
    if (!ev.obbligatorio) continue;
    if (state.world.eventi_usati[p.id]?.[ev.id] !== undefined) continue;
    if (!condizioniOk(state, data, p, ev.condizioni)) continue;
    (state.world.eventi_usati[p.id] ??= {})[ev.id] = state.world.anno;
    out.push({ evento: ev.id, variante: Math.floor(casuale(state) * ev.testi.length) });
  }
  return out;
}

/** Il giocatore risolve l'evento n° `indice` dell'anno con la scelta `idScelta`. */
export function risolviEvento(state, data, indice, idScelta) {
  const voce = state.world.eventi_anno[indice];
  if (!voce || voce.risolto) throw new Error("Evento già risolto o inesistente");
  const p = state.persone[voce.persona];
  const ev = data.evento[voce.evento];
  const { esito, righe } = risolviScelta(state, data, p, voce.evento, idScelta);
  voce.risolto = true;
  voce.scelta = idScelta;
  voce.esito = esito;
  const scelta = ev.scelte.find((s) => s.id === idScelta);
  annota(state, p, `${conDuePunti(titoloEvento(state, data, p, ev))} ${testoScelta(state, data, p, scelta)}${esito ? ` — ${esito}` : ""}`);
  for (const r of righe) annota(state, p, r);
  // eventi a catena: una scelta può rendere valido subito un evento obbligatorio (es. scelta della facoltà)
  for (const s of obbligatori(state, data, p)) state.world.eventi_anno.push({ persona: p.id, evento: s.evento, variante: s.variante, risolto: false, scelta: null, esito: null });
  return voce;
}

/** "Titolo:" oppure "Titolo?" se il titolo finisce già con una punteggiatura. */
const conDuePunti = (titolo) => (/[?!.]$/.test(titolo) ? titolo : `${titolo}:`);

export const eventiDaRisolvere = (state) => state.world.eventi_anno.filter((e) => !e.risolto);

// ---------------------------------------------------------------------------
// Fine anno
// ---------------------------------------------------------------------------

/**
 * Chiude l'anno corrente e apre il successivo. Gli eventi non ancora risolti dal giocatore
 * si risolvono in automatico. Restituisce il riepilogo dell'anno del personaggio giocato.
 */
export function fineAnno(state, data) {
  const anno = state.world.anno;
  const io = giocatore(state);

  // 1. eventi rimasti aperti (es. simulazione automatica); la lista può allungarsi con gli eventi a catena
  for (let i = 0; i < state.world.eventi_anno.length && i < 12; i++) {
    const e = state.world.eventi_anno[i];
    if (!e.risolto) risolviEvento(state, data, i, sceltaAutomatica(state, data, state.persone[e.persona], e.evento));
  }

  // 2. le altre persone vivono il loro anno da sole
  for (const p of personeVive(state)) if (p.controllo !== "giocatore") eventiAutomatici(state, data, p);

  // 3. regole di vita: scuola, lavoro, benessere
  aggiornaIndici(state);
  for (const p of personeVive(state)) {
    scuola(state, data, p);
    lavoro(state, data, p);
    benessere(state, data, p);
  }

  // 4. economia
  const trasferimenti = mantenimenti(state, data);
  for (const id of Object.keys(state.nuclei)) bilancioNucleo(state, data, id, trasferimenti);
  for (const p of personeVive(state)) if (p.carriera.naspi?.anni > 0) p.carriera.naspi.anni -= 1;
  for (const p of personeVive(state)) {
    interessi(p);
    rivalutaPensione(state, p);
  }
  rivalutaCase(state);
  for (const { azienda } of aggiornaAziende(state)) {
    for (const p of personeVive(state)) {
      if (p.cognome === state.famiglia.cognome || p.id === azienda.proprietario) {
        aggiungiRicordo(state, data, p, "fallimento_azienda");
        annota(state, p, `${azienda.nome} chiude: troppi anni in perdita.`);
      }
    }
    state.famiglia.reputazione = limita(state.famiglia.reputazione - 6, 0, 100);
  }

  // 5. morti ed eredità
  for (const p of personeVive(state)) {
    if (probabile(state, probabilitaMorte(state, p))) muori(state, data, p);
  }

  // 6. storico e reputazione del cognome
  for (const p of personeVive(state)) {
    p.storico_patrimonio.push({ anno, valore: patrimonio(state, p) });
    if (p.storico_patrimonio.length > 130) p.storico_patrimonio.shift();
  }
  const adulti = personeVive(state).filter((p) => eta(p, anno) >= 18 && p.cognome === state.famiglia.cognome);
  if (adulti.length) {
    const media = adulti.reduce((s, p) => s + p.stat.reputazione, 0) / adulti.length;
    state.famiglia.reputazione = limita(Math.round(state.famiglia.reputazione + (media - state.famiglia.reputazione) * 0.05), 0, 100);
  }

  const riepilogo = io.diario.find((d) => d.anno === anno)?.righe ?? [];
  state.world.ultimo_riepilogo = { anno, righe: [...riepilogo] };

  // 7. anno nuovo
  state.world.anno = anno + 1;
  if (!vive(io)) {
    state.world.fase = "fine";
    state.world.eventi_anno = [];
  } else iniziaAnno(state, data);
  return state.world.ultimo_riepilogo;
}

/** Le persone non controllate vivono gli eventi obbligatori e, a volte, un evento in più. */
function eventiAutomatici(state, data, p) {
  const scelti = obbligatori(state, data, p);
  if (probabile(state, 0.35)) scelti.push(...scegliEventiAnno(state, data, p).slice(0, 1));
  for (let i = 0; i < scelti.length && i < 8; i++) {
    const s = scelti[i];
    const ev = data.evento[s.evento];
    const idScelta = sceltaAutomatica(state, data, p, s.evento);
    const { righe } = risolviScelta(state, data, p, s.evento, idScelta);
    // per chi non è giocato basta il titolo: le scelte sono scritte in seconda persona
    annota(state, p, `${titoloEvento(state, data, p, ev).replace(/[.?!]$/, "")}.`);
    for (const r of righe) annota(state, p, r);
    scelti.push(...obbligatori(state, data, p));
  }
}

// ---------------------------------------------------------------------------
// Scuola e università
// ---------------------------------------------------------------------------

const DURATA = { elementari: 5, medie: 3, superiori: 5 };

function modificatore(data, p, chiave) {
  return p.tratti.reduce((s, t) => s + (data.tratto[t]?.modificatori?.[chiave] ?? 0), 0);
}

function scuola(state, data, p) {
  const i = p.istruzione;
  const anni = eta(p, state.world.anno);
  // l'ingresso alle elementari avviene a 6 anni
  if (!i.iscritto && i.titolo === "nessuno" && anni >= 6 && anni < 11 && i.livello === "nessuno") {
    i.livello = "elementari";
    i.anno_corso = 0;
    i.iscritto = true;
  }
  if (!i.iscritto) return;
  if (i.livello === "universita") return universita(state, data, p);

  const difficolta = i.livello === "superiori" ? (data.superiore[i.indirizzo]?.difficolta ?? 2) : 1;
  const obiettivo =
    6.4 + modificatore(data, p, "studio") + (p.stat.morale - 55) / 40 + (45 - p.stat.stanchezza) / 60 - (p.stat.salute < 40 ? 0.6 : 0) - (difficolta - 2) * 0.35 + normale(state, 0, 0.45);
  i.voti = limita(Math.round((i.voti + (obiettivo - i.voti) * 0.45) * 10) / 10, 3, 10);

  const soglia = i.livello === "elementari" ? 4.2 : i.livello === "medie" ? 5.2 : 5.5;
  if (i.voti < soglia && probabile(state, i.livello === "elementari" ? 0.2 : 0.55)) {
    i.bocciature += 1;
    aggiungiRicordo(state, data, p, "bocciatura");
    annota(state, p, `Bocciat${p.sesso === "F" ? "a" : "o"}: ripete il ${i.anno_corso}° anno.`);
    p.stat.morale = limita(p.stat.morale - 8, 0, 100);
    // dopo due bocciature alle superiori, a 16 anni si può lasciare
    if (i.livello === "superiori" && i.bocciature >= 2 && anni >= 16 && probabile(state, 0.5)) annota(state, p, lasciaStudi(state, data, p));
    return;
  }
  i.anno_corso += 1;
  if (i.anno_corso <= DURATA[i.livello]) return;

  if (i.livello === "elementari") {
    Object.assign(i, { titolo: "licenza_elementare", livello: "medie", anno_corso: 1 });
    annota(state, p, "Finisce le elementari e inizia le medie.");
  } else if (i.livello === "medie") {
    i.titolo = "licenza_media";
    annota(state, p, `Licenza media con ${giudizio(i.voti)}.`);
    if (!i.indirizzo) i.indirizzo = indirizzoAutomatico(state, data, p);
    annota(state, p, iscriviSuperiori(state, data, p, i.indirizzo));
  } else if (i.livello === "superiori") {
    i.titolo = "diploma";
    i.voto_diploma = limita(Math.round(60 + (i.voti - 6) * 12 + normale(state, 0, 4)), 60, 100);
    Object.assign(i, { iscritto: false, livello: "nessuno" });
    annota(state, p, `Diploma di maturità con ${i.voto_diploma}/100.`);
  }
}

function giudizio(voto) {
  return voto >= 9 ? "ottimo" : voto >= 8 ? "distinto" : voto >= 7 ? "buono" : voto >= 6 ? "sufficiente" : "fatica";
}

/** Indirizzo delle superiori scelto in automatico (se nessun evento l'ha deciso). */
export function indirizzoAutomatico(state, data, p) {
  const v = p.istruzione.voti;
  const pesi = data.superiori.map((s) => {
    let peso = 1 + s.tratti_affini.filter((t) => p.tratti.includes(t)).length;
    if (s.tipo === "liceo") peso *= v >= 7.5 ? 2.2 : v >= 6.5 ? 1 : 0.4;
    if (s.tipo === "professionale") peso *= v < 6.5 ? 2 : 0.5;
    if (["agiata", "ricca"].includes(state.famiglia.agiatezza) && s.tipo === "liceo") peso *= 1.6;
    return { id: s.id, peso };
  });
  let r = casuale(state) * pesi.reduce((s, x) => s + x.peso, 0);
  for (const x of pesi) if ((r -= x.peso) < 0) return x.id;
  return pesi[0].id;
}

function universita(state, data, p) {
  const i = p.istruzione;
  const f = data.facolta[i.facolta];
  const obiettivo = 24.5 + modificatore(data, p, "studio") * 2 + (p.stat.morale - 50) / 20 - (f.difficolta - 2) * 0.8 + normale(state, 0, 1.2);
  i.voti = limita(Math.round((i.voti + (obiettivo - i.voti) * 0.4) * 10) / 10, 18, 30);
  const successo = limita(
    0.62 + (i.voti - 24) / 14 + modificatore(data, p, "studio") * 0.12 + (p.stat.morale - 50) / 220 - (p.stat.stanchezza - 50) / 220 - (p.carriera.lavoro ? (p.carriera.part_time ? 0.12 : 0.3) : 0) - (f.difficolta - 2) * 0.08 + normale(state, 0, 0.12),
    0.1,
    1.05,
  );
  i.crediti = Math.round(i.crediti + 60 * successo);
  i.anno_corso += 1;
  const totale = f.solo_triennale ? 180 : f.crediti;
  const triennale = !f.ciclo_unico && !f.solo_triennale && i.titolo === "diploma" && i.crediti >= 180;
  if (triennale) {
    i.titolo = "laurea_triennale";
    i.voto_laurea = votoLaurea(state, i);
    annota(state, p, `Laurea triennale in ${f.nome} con ${i.voto_laurea}/110.`);
    // la scelta di proseguire con la magistrale è un evento obbligatorio: fino ad allora resta iscritto
    p.flags.decide_magistrale = state.world.anno;
    return;
  }
  if (i.crediti >= totale) {
    i.titolo = f.solo_triennale ? "laurea_triennale" : "laurea_magistrale";
    i.voto_laurea = votoLaurea(state, i);
    const lode = i.voto_laurea === 110 && i.voti >= 28.8;
    if (lode) aggiungiRicordo(state, data, p, "laurea_con_lode");
    annota(state, p, `Laurea in ${f.nome} con ${i.voto_laurea}/110${lode ? " e lode" : ""}.`);
    Object.assign(i, { iscritto: false, livello: "nessuno", fuori_sede: false });
    delete p.flags.decide_magistrale;
    return;
  }
  // tanti anni fuori corso e morale basso: a volte si molla
  const durata = Math.ceil(totale / 60);
  if (i.anno_corso > durata + 3 && p.stat.morale < 45 && probabile(state, 0.2)) annota(state, p, lasciaStudi(state, data, p));
}

function votoLaurea(state, i) {
  return limita(Math.round(66 + ((i.voti - 18) / 12) * 44 + normale(state, 0, 3)), 66, 110);
}

// ---------------------------------------------------------------------------
// Lavoro
// ---------------------------------------------------------------------------

function lavoro(state, data, p) {
  const anni = eta(p, state.world.anno);
  const c = p.carriera;
  if (vaInPensione(state, data, p)) return annota(state, p, `Va in pensione: ${euro(c.pensione).toLocaleString("it-IT")} € lordi l'anno.`);
  if (c.pensionato || anni < 16 || c.imprenditore) return;
  const regione = data.regione[p.regione];

  if (c.lavoro) {
    const m = data.mestiere[c.lavoro];
    c.anzianita += 1;
    c.anni_lavorati += 1;
    if (probabile(state, 0.08 + Math.max(0, modificatore(data, p, "carriera")) * 0.3)) c.bonus = limita(c.bonus + 0.04, 0.7, 1.6);
    const rischio = m.precarieta * (1 + regione.disoccupazione / 25) * (p.stat.reputazione < 30 ? 1.4 : 1);
    if (probabile(state, rischio)) {
      avviaNaspi(state, data, p);
      annota(state, p, licenzia(state, data, p));
    }
    return;
  }
  tornaDaiGenitori(state, data, p);
  // senza lavoro: lo cerca se non studia
  if (p.istruzione.iscritto) return;
  const bonusTitolo = { nessuno: -0.08, licenza_elementare: -0.08, licenza_media: 0, diploma: 0.06, laurea_triennale: 0.12, laurea_magistrale: 0.15 }[p.istruzione.titolo];
  const probabilita = limita(0.6 - (regione.disoccupazione / 100) * 1.8 + bonusTitolo + modificatore(data, p, "carriera") * 0.5 + (p.stat.reputazione - 50) / 250, 0.12, 0.9);
  if (probabile(state, probabilita)) annota(state, p, assumi(state, data, p, "casuale"));
}

/** Chi vive da solo senza reddito e con debiti torna dai genitori, se ci sono. */
function tornaDaiGenitori(state, data, p) {
  if (!p.flags.vive_da_solo || p.carriera.naspi?.anni > 0) return;
  if (p.economia.debiti < 3000 * state.world.indice_prezzi && p.economia.risparmi > 0) return;
  const casa = state.nuclei[p.nucleo]?.casa;
  if (casa && state.case[casa]?.proprietari.includes(p.id)) return; // casa propria: resta
  const genitore = [state.persone[p.madre], state.persone[p.padre]].find((g) => vive(g));
  if (!genitore) return;
  p.nucleo = genitore.nucleo;
  p.regione = genitore.regione;
  p.citta = genitore.citta;
  delete p.flags.vive_da_solo;
  annota(state, p, `Torna a vivere da ${genitore.nome} per rimettersi in piedi.`);
}

// ---------------------------------------------------------------------------
// Benessere: tempo libero, stanchezza, morale, felicità, salute, reputazione
// ---------------------------------------------------------------------------

function oreSettimanali(data, p) {
  const c = p.carriera;
  const lavoro = c.lavoro ? (data.mestiere[c.lavoro]?.ore ?? 40) * (c.part_time ? 0.5 : 1) : c.imprenditore ? 50 : 0;
  const i = p.istruzione;
  const studio = !i.iscritto ? 0 : { elementari: 28, medie: 30, superiori: 32, universita: 26 }[i.livello] ?? 0;
  return { lavoro, studio, spostamenti: lavoro || studio ? 5 : 0 };
}

function benessere(state, data, p) {
  const anni = eta(p, state.world.anno);
  const s = p.stat;
  const ore = oreSettimanali(data, p);
  p.tempo_libero = limita(Math.round(168 - 56 - 30 - ore.lavoro - ore.studio - ore.spostamenti), 5, 82);

  const muovi = (k, obiettivo, velocita, rumore = 0) => {
    s[k] = limita(Math.round(s[k] + (obiettivo - s[k]) * velocita + (rumore ? normale(state, 0, rumore) : 0)), 0, 100);
  };

  muovi("stanchezza", limita(10 + (ore.lavoro + ore.studio) * 0.9 + modificatore(data, p, "stanchezza") - (p.tempo_libero - 30) * 0.3, 5, 95), 0.5, 3);

  const ricordi = p.ricordi.reduce((t, r) => t + (data.ricordo[r.id]?.effetti_annui?.morale ?? 0), 0);
  const disoccupato = anni >= 20 && !p.carriera.lavoro && !p.carriera.pensionato && !p.carriera.imprenditore && !p.istruzione.iscritto;
  const debiti = p.economia.debiti > 3000 * state.world.indice_prezzi;
  muovi("morale", 60 + modificatore(data, p, "morale") + ricordi * 3 - (disoccupato ? 10 : 0) - (debiti ? 8 : 0) - (s.salute < 40 ? 8 : 0), 0.3, 4);

  muovi("felicita", 0.4 * s.morale + 0.25 * s.salute + 0.2 * (100 - s.stanchezza) + 0.15 * Math.min(100, p.tempo_libero * 2), 0.35, 3);

  let deltaSalute = modificatore(data, p, "salute") + normale(state, 0, 1.4);
  if (anni > 45) deltaSalute -= Math.min(2.2, (anni - 45) * 0.045);
  if (anni < 35 && s.salute < 88) deltaSalute += 1.2;
  if (s.stanchezza > 70) deltaSalute -= 1.5;
  if (s.felicita < 30) deltaSalute -= 0.8;
  if (p.flags.malattia_cronica) deltaSalute -= 0.8;
  s.salute = limita(Math.round(s.salute + deltaSalute), 0, 100);

  const prestigio = p.carriera.lavoro ? data.mestiere[p.carriera.lavoro].prestigio : p.carriera.imprenditore ? 60 : 40;
  const titolo = titoloAlmeno(p.istruzione.titolo, "laurea_triennale") ? 5 : 0;
  if (anni >= 16) muovi("reputazione", 50 + (prestigio - 50) * 0.3 + modificatore(data, p, "reputazione") * 10 + titolo, 0.15, 1.5);
}

// ---------------------------------------------------------------------------
// Morte ed eredità
// ---------------------------------------------------------------------------

/** Probabilità annua di morte: curva di Gompertz calibrata sull'Italia, corretta dalla salute. */
export function probabilitaMorte(state, p) {
  const anni = eta(p, state.world.anno);
  let q = 0.000022 * Math.exp(0.093 * anni) + 0.00015;
  q *= 1 + Math.max(0, 50 - p.stat.salute) / 30;
  if (p.stat.salute > 85) q *= 0.8;
  if (p.flags.malattia_cronica) q *= 1.6;
  if (p.sesso === "F") q *= 0.85; // le donne in Italia vivono circa 4 anni in più
  return Math.min(0.9, q);
}

export function muori(state, data, p, causa = null) {
  const anni = eta(p, state.world.anno);
  p.anno_morte = state.world.anno;
  // sotto i 75 anni: due morti su tre sono per malattia, una per incidente
  p.causa_morte = causa ?? (anni >= 75 ? "vecchiaia" : p.stat.salute < 40 || probabile(state, 0.67) ? "malattia" : "incidente");
  annota(state, p, `Muore a ${anni} anni (${p.causa_morte}).`);
  for (const riga of eredita(state, p)) {
    for (const f of [...(p.figli ?? []), p.partner].map((id) => state.persone[id]).filter(vive)) annota(state, f, riga);
  }
  // i figli giovani portano il segno del lutto
  for (const f of (p.figli ?? []).map((id) => state.persone[id]).filter(vive)) {
    annota(state, f, `${p.sesso === "F" ? "Muore la madre" : "Muore il padre"}, ${p.nome}, a ${anni} anni.`);
    f.stat.morale = limita(f.stat.morale - 15, 0, 100);
    if (eta(f, state.world.anno) < 25) aggiungiRicordo(state, data, f, "lutto_giovane");
  }
  if (p.partner && vive(state.persone[p.partner])) {
    const c = state.persone[p.partner];
    c.stato_civile = "vedovo";
    c.stat.morale = limita(c.stat.morale - 20, 0, 100);
    annota(state, c, `Muore ${p.nome}: ${c.nome} resta ${c.sesso === "F" ? "vedova" : "vedovo"}.`);
  }
}

/** Riassunto di una riga per l'anno di una persona non giocata. */
export function rigaAnno(state, data, p, anno) {
  const voce = p.diario.find((d) => d.anno === anno);
  if (voce?.righe.length) return voce.righe.slice(0, 2).join(" ");
  const s = segnaposto(state, data, p);
  if (p.carriera.pensionato) return `${s.nome} si gode la pensione.`;
  if (p.carriera.imprenditore) return `${s.nome} manda avanti l'azienda di famiglia.`;
  if (p.carriera.lavoro) return `${s.nome} lavora come ${s.lavoro}.`;
  if (p.istruzione.iscritto) return `${s.nome} va a scuola.`;
  return `Un anno tranquillo per ${s.nome}.`;
}

export { testoEvento };
