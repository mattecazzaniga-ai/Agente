// Vita di coppia, figli e regole automatiche della dinastia (FASE 2).
// Le stesse funzioni servono agli effetti degli eventi (scelte del giocatore) e alle regole
// con cui le persone non controllate formano coppie, fanno figli, si separano, escono di casa.

import { intero, normale, probabile, scegli, tra } from "./rng.js";
import { eta, euro, limita, TITOLI } from "./util.js";
import { nuovoId, vive } from "./state.js";
import { annota, collega, creaPersona, figliVivi, inCoppia, madre, modificaRelazione, padre, partnerDi } from "./family.js";
import { aggiungiRicordo, aggiungiTratto, assumi, mestieriAccessibili, trasloca } from "./azioni.js";
import { membriNucleo } from "./economy.js";
import { scegliNome, scegliTratti } from "./generator.js";

const ETA_FERTILE_MAX = 45;

/** Lascia il nucleo attuale e entra in un altro (eventuali figli minorenni che vivono con lei/lui la seguono). */
function spostaNelNucleo(state, p, idNucleo, { conFigliMinori = false } = {}) {
  const prima = p.nucleo;
  const n = state.nuclei[idNucleo];
  const chi = [p];
  if (conFigliMinori) chi.push(...figliVivi(state, p).filter((f) => f.nucleo === prima && eta(f, state.world.anno) < 18));
  for (const x of chi) {
    x.nucleo = idNucleo;
    x.regione = n.regione;
    x.citta = n.citta;
  }
}

/** Nuovo nucleo in affitto nella città della persona. */
function nuovoNucleo(state, p) {
  const id = nuovoId(state, "n");
  state.nuclei[id] = { id, regione: p.regione, citta: p.citta, casa: null };
  return id;
}

/** La persona possiede la casa in cui vive? */
const possiedeCasa = (state, p) => {
  const casa = state.case[state.nuclei[p.nucleo]?.casa];
  return Boolean(casa?.proprietari.includes(p.id));
};

// ---------------------------------------------------------------------------
// Partner
// ---------------------------------------------------------------------------

/** Titolo di studio del partner: in Italia ci si sposa soprattutto tra persone con studi simili. */
function titoloSimile(state, titolo) {
  const i = Math.max(2, TITOLI.indexOf(titolo));
  const delta = probabile(state, 0.55) ? 0 : scegli(state, [-1, 1]);
  return TITOLI[limita(i + delta, 2, TITOLI.length - 1)];
}

/**
 * Crea un partner credibile per p (stessa città, età e studi vicini, un lavoro, qualche risparmio)
 * e li mette insieme come fidanzati. Semplificazione: coppie di sesso diverso.
 */
export function nuovoPartner(state, data, p) {
  if (inCoppia(state, p) || eta(p, state.world.anno) < 16) return null;
  const anni = eta(p, state.world.anno);
  const differenza = Math.round(normale(state, 2.5, 3));
  const etaPartner = limita(p.sesso === "M" ? anni - differenza : anni + differenza, 18, anni + 12);
  const sesso = p.sesso === "M" ? "F" : "M";
  const area = data.regione[p.regione].area;
  const q = creaPersona(state, {
    nome: scegliNome(state, data, sesso),
    cognome: scegli(state, data.nomi.cognomi[area]),
    sesso,
    anno_nascita: state.world.anno - etaPartner,
    regione: p.regione,
    citta: p.citta,
    tratti: scegliTratti(state, data),
  });
  q.nucleo = nuovoNucleo(state, q);
  q.flags.vive_da_solo = true;
  q.istruzione = { ...q.istruzione, titolo: titoloSimile(state, p.istruzione.titolo) };
  if (q.istruzione.titolo.startsWith("laurea")) q.istruzione.facolta = scegli(state, data.facolta_lista).id;
  q.stat = { salute: intero(state, 70, 95), morale: intero(state, 50, 80), felicita: intero(state, 50, 80), stanchezza: intero(state, 25, 55), reputazione: intero(state, 40, 60) };
  const disoccupazione = data.regione[p.regione].disoccupazione / 100;
  if (etaPartner >= 19 && probabile(state, 0.88 - disoccupazione * 1.5)) {
    const accessibili = mestieriAccessibili(state, data, q);
    if (accessibili.length) {
      assumi(state, data, q, "casuale");
      q.carriera.anzianita = Math.max(0, etaPartner - 24 - intero(state, 0, 4));
      q.carriera.anni_lavorati = q.carriera.anzianita;
    }
  }
  q.economia.risparmi = euro(Math.max(0, etaPartner - 22) * tra(state, 600, 2200) * state.world.indice_prezzi);
  if (etaPartner >= 67) q.carriera.pensionato = true;

  if (p.partner && !p.ex.includes(p.partner)) p.ex.push(p.partner);
  p.partner = q.id;
  q.partner = p.id;
  p.stato_civile = q.stato_civile = "fidanzato";
  p.coppia_dal = q.coppia_dal = state.world.anno;
  collega(state, p.id, q.id, "partner", "partner", intero(state, 55, 80));
  annota(state, q, `Si mette insieme a ${p.nome}.`);
  return `Si mette insieme a ${q.nome}${etaPartner !== anni ? ` (${etaPartner} anni)` : ""}.`;
}

/** Vanno a vivere insieme: chi ha casa propria ospita, altrimenti chi vive già da solo, altrimenti un nuovo affitto. */
export function convivenza(state, data, p) {
  const q = partnerDi(state, p);
  if (!q) return null;
  if (p.nucleo !== q.nucleo) {
    const indipendente = (x) => x.flags.vive_da_solo && !membriNucleo(state, x.nucleo).some((m) => m.id === x.madre || m.id === x.padre);
    let ospite = possiedeCasa(state, p) ? p : possiedeCasa(state, q) ? q : indipendente(p) ? p : indipendente(q) ? q : null;
    if (!ospite) {
      const id = nuovoNucleo(state, p);
      spostaNelNucleo(state, p, id, { conFigliMinori: true });
      ospite = p;
    }
    const altro = ospite === p ? q : p;
    spostaNelNucleo(state, altro, ospite.nucleo, { conFigliMinori: true });
  }
  p.flags.vive_da_solo = q.flags.vive_da_solo = state.world.anno;
  if (p.stato_civile === "fidanzato") p.stato_civile = q.stato_civile = "convivente";
  return `Va a vivere con ${q.nome} a ${p.citta}.`;
}

export function matrimonio(state, data, p) {
  const q = partnerDi(state, p);
  if (!q) return null;
  const righe = [];
  if (p.nucleo !== q.nucleo) righe.push(convivenza(state, data, p));
  p.stato_civile = q.stato_civile = "sposato";
  modificaRelazione(state, p.id, q.id, 10);
  annota(state, q, `Sposa ${p.nome}.`);
  righe.push(`Sposa ${q.nome}.`);
  return righe.filter(Boolean).join(" ");
}

/**
 * Fine della coppia. Se vivevano insieme se ne va chi non è proprietario della casa; a parità,
 * se ne va l'uomo e i figli minorenni restano con la madre (semplificazione del caso più comune in Italia).
 */
export function separazione(state, data, p) {
  const q = partnerDi(state, p);
  if (!q) return null;
  const sposati = p.stato_civile === "sposato";
  if (p.nucleo === q.nucleo) {
    const uomo = p.sesso === "M" ? p : q;
    const donna = uomo === p ? q : p;
    let chiEsce = possiedeCasa(state, uomo) && !possiedeCasa(state, donna) ? donna : uomo;
    const id = nuovoNucleo(state, chiEsce);
    spostaNelNucleo(state, chiEsce, id, { conFigliMinori: chiEsce === donna });
    chiEsce.flags.vive_da_solo = state.world.anno;
    for (const f of figliVivi(state, p).filter((f) => eta(f, state.world.anno) < 18 && q.figli.includes(f.id))) {
      if (probabile(state, 0.3)) aggiungiRicordo(state, data, f, "genitore_assente");
      f.stat.morale = limita(f.stat.morale - 10, 0, 100);
    }
  }
  for (const [a, b] of [
    [p, q],
    [q, p],
  ]) {
    a.ex.push(b.id);
    a.partner = null;
    a.coppia_dal = null;
    a.stato_civile = sposati ? "separato" : "single";
    if (sposati) a.flags.separato_nel = state.world.anno;
  }
  modificaRelazione(state, p.id, q.id, -40);
  annota(state, q, `Si lascia con ${p.nome}.`);
  return sposati ? `Si separa da ${q.nome}.` : `Si lascia con ${q.nome}.`;
}

// ---------------------------------------------------------------------------
// Figli
// ---------------------------------------------------------------------------

/** La coppia può avere un figlio (la donna ha tra 18 e 45 anni)? */
export function coppiaFertile(state, p) {
  const q = partnerDi(state, p);
  if (!q) return false;
  const donna = p.sesso === "F" ? p : q;
  const anni = eta(donna, state.world.anno);
  return anni >= 18 && anni <= ETA_FERTILE_MAX && !p.flags.no_figli;
}

/** Nome del bambino: a volte quello di un nonno dello stesso sesso, come da tradizione. */
function nomeBambino(state, data, sesso, m, pa) {
  const nonni = [madre(state, m), padre(state, m), madre(state, pa), padre(state, pa)].filter((x) => x && x.sesso === sesso);
  const fratelli = new Set([...m.figli, ...pa.figli].map((id) => state.persone[id]?.nome));
  if (nonni.length && probabile(state, 0.25)) {
    const nome = scegli(state, nonni).nome;
    if (!fratelli.has(nome)) return nome;
  }
  for (let i = 0; i < 6; i++) {
    const nome = scegliNome(state, data, sesso);
    if (!fratelli.has(nome)) return nome;
  }
  return scegliNome(state, data, sesso);
}

/**
 * Nasce un figlio della coppia di p. Tratti: in parte dai genitori, in parte dalle loro cicatrici
 * (ricordi con eredita_tratto); a volte un figlio "sorprende" con un tratto che nessuno dei due ha.
 */
export function nasceFiglio(state, data, p) {
  const q = partnerDi(state, p);
  if (!q || !coppiaFertile(state, p)) return null;
  const m = p.sesso === "F" ? p : q;
  const pa = m === p ? q : p;
  const sesso = probabile(state, 0.513) ? "M" : "F";
  const nucleo = state.nuclei[m.nucleo];
  const ereditabili = [...m.tratti, ...pa.tratti].filter(() => probabile(state, 0.4));
  const f = creaPersona(state, {
    nome: nomeBambino(state, data, sesso, m, pa),
    cognome: pa.cognome, // in Italia di norma il cognome paterno (dal 2022 si può dare anche quello materno)
    sesso,
    anno_nascita: state.world.anno,
    regione: nucleo.regione,
    citta: nucleo.citta,
    nucleo: m.nucleo,
    madre: m.id,
    padre: pa.id,
    sangue: Boolean(m.sangue || pa.sangue),
    generazione: Math.max(m.generazione ?? 0, pa.generazione ?? 0) + 1,
    tratti: scegliTratti(state, data, ereditabili),
  });
  f.stat = { salute: intero(state, 78, 96), morale: intero(state, 60, 80), felicita: intero(state, 60, 80), stanchezza: 10, reputazione: f.sangue ? Math.round(40 + state.famiglia.reputazione * 0.2) : 50 };
  // cicatrici che diventano carattere
  for (const r of [...m.ricordi, ...pa.ricordi]) {
    const e = data.ricordo[r.id]?.eredita_tratto;
    if (e && probabile(state, e.probabilita)) aggiungiTratto(state, data, f, e.tratto);
  }
  // a volte i figli sorprendono
  const sorpresa = probabile(state, 0.12);
  if (sorpresa) {
    const nuovi = data.tratti.filter((t) => !m.tratti.includes(t.id) && !pa.tratti.includes(t.id) && !f.tratti.includes(t.id));
    if (nuovi.length) {
      aggiungiTratto(state, data, f, scegli(state, nuovi).id);
      f.flags.sorpresa = state.world.anno;
    }
  }
  if (probabile(state, 0.05)) f.flags.talento = state.world.anno;
  m.figli.push(f.id);
  pa.figli.push(f.id);
  collega(state, f.id, m.id, "genitore", "figlio", intero(state, 60, 90));
  collega(state, f.id, pa.id, "genitore", "figlio", intero(state, 50, 90));
  for (const s of new Set([...m.figli, ...pa.figli])) if (s !== f.id && vive(state.persone[s])) collega(state, f.id, s, "fratello", "fratello", intero(state, 30, 70));
  const riga = `Nasce ${f.nome}${f.flags.sorpresa ? ": fin dai primi mesi non somiglia a nessuno in famiglia" : ""}.`;
  annota(state, q, riga);
  annota(state, f, `Nasce a ${f.citta}, ${f.sesso === "F" ? "figlia" : "figlio"} di ${m.nome} e ${pa.nome}.`);
  return riga;
}

/** Il genitore anziano va a vivere con il figlio (che deve essere indipendente). */
export function accogliGenitore(state, data, p) {
  const g = [madre(state, p), padre(state, p)].filter(vive).sort((a, b) => a.anno_nascita - b.anno_nascita)[0];
  if (!g || !p.flags.vive_da_solo || g.nucleo === p.nucleo) return null;
  spostaNelNucleo(state, g, p.nucleo);
  return `${g.nome} viene a vivere con ${p.nome}.`;
}

// ---------------------------------------------------------------------------
// Regole automatiche per chi non è controllato dal giocatore
// ---------------------------------------------------------------------------

/** Probabilità annua di un figlio per una coppia, dato il numero di figli già avuti (Italia: ~1,2 figli per donna). */
const PROBABILITA_FIGLIO = [0.26, 0.17, 0.05, 0.015];

/**
 * Un anno di vita privata per una persona di sangue non controllata: coppie, convivenze,
 * matrimoni, figli, separazioni, uscita di casa. Restituisce le righe per il diario.
 */
export function vitaPrivata(state, data, p) {
  const anni = eta(p, state.world.anno);
  // in modalità automatica (simulazioni) anche il principale vive da solo
  const guidato = (x) => x?.controllo === "giocatore" && !state.world.automatico;
  if (!p.sangue || guidato(p) || anni < 18) return [];
  const q = partnerDi(state, p);
  if (guidato(q)) return [];
  const righe = [];
  const sociale = p.tratti.includes("socievole") ? 0.04 : p.tratti.includes("solitario") ? -0.04 : 0;
  const durata = q ? state.world.anno - (p.coppia_dal ?? state.world.anno) : 0;

  if (!q) {
    const mai = p.ex.length === 0 && p.stato_civile === "single";
    const base = mai ? (anni >= 20 && anni <= 45 ? 0.11 : anni <= 55 ? 0.03 : 0) : anni <= 60 ? 0.05 : 0;
    if (probabile(state, base + sociale)) righe.push(nuovoPartner(state, data, p));
    // giovani adulti che lavorano escono di casa (in Italia intorno ai 30 anni)
    else if (anni >= 24 && anni <= 40 && p.carriera.lavoro && !p.flags.vive_da_solo && probabile(state, 0.12)) righe.push(trasloca(state, data, p));
  } else if (p.stato_civile === "fidanzato") {
    if (probabile(state, 0.08)) righe.push(separazione(state, data, p));
    else if (durata >= 1 && anni >= 22 && probabile(state, 0.3)) righe.push(probabile(state, 0.35) ? matrimonio(state, data, p) : convivenza(state, data, p));
  } else {
    if (probabile(state, p.stato_civile === "sposato" ? 0.006 : 0.02)) righe.push(separazione(state, data, p));
    else {
      if (p.stato_civile === "convivente" && durata >= 2 && probabile(state, 0.12)) righe.push(matrimonio(state, data, p));
      if (coppiaFertile(state, p)) {
        const donna = p.sesso === "F" ? p : q;
        const giaNati = figliVivi(state, donna).filter((f) => f.anno_nascita >= donna.anno_nascita + 15).length;
        const ultimo = figliVivi(state, donna).at(-1);
        const pausa = ultimo && state.world.anno - ultimo.anno_nascita < 2;
        const eta_d = eta(donna, state.world.anno);
        const fattore = eta_d > 40 ? 0.3 : eta_d > 36 ? 0.65 : eta_d < 25 ? 0.6 : 1;
        if (!pausa && probabile(state, PROBABILITA_FIGLIO[Math.min(3, giaNati)] * fattore)) righe.push(nasceFiglio(state, data, p));
      }
    }
  }
  return righe.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Erede e controllo dei personaggi (FASE 2-4)
// ---------------------------------------------------------------------------

/** Chi può continuare la storia: figli, nipoti, fratelli, figli dei fratelli, poi gli altri vivi di sangue. */
export function candidatiErede(state, defunto) {
  const visti = new Set();
  const lista = [];
  const aggiungi = (x, motivo) => {
    if (!x || !vive(x) || visti.has(x.id)) return;
    visti.add(x.id);
    lista.push({ persona: x, motivo });
  };
  for (const f of figliVivi(state, defunto)) aggiungi(f, f.sesso === "F" ? "Figlia" : "Figlio");
  for (const f of (defunto.figli ?? []).map((id) => state.persone[id]).filter(Boolean)) for (const n of figliVivi(state, f)) aggiungi(n, n.sesso === "F" ? "Nipote (figlia di " + f.nome + ")" : "Nipote (figlio di " + f.nome + ")");
  for (const id of state.controllati ?? []) aggiungi(state.persone[id], "Già controllat" + (state.persone[id]?.sesso === "F" ? "a" : "o"));
  const fratelli = Object.values(state.persone).filter((x) => x.id !== defunto.id && ((defunto.madre && x.madre === defunto.madre) || (defunto.padre && x.padre === defunto.padre)));
  for (const s of fratelli) aggiungi(s, s.sesso === "F" ? "Sorella" : "Fratello");
  for (const s of fratelli) for (const n of figliVivi(state, s)) aggiungi(n, `${n.sesso === "F" ? "Nipote, figlia" : "Nipote, figlio"} di ${s.nome}`);
  for (const x of Object.values(state.persone).filter((x) => x.sangue).sort((a, b) => b.anno_nascita - a.anno_nascita)) aggiungi(x, "Parente");
  aggiungi(partnerDi(state, defunto) ?? state.persone[defunto.partner], defunto.sesso === "F" ? "Marito o compagno" : "Moglie o compagna");
  return lista.slice(0, 10);
}

/** Può essere scelto come personaggio da controllare? (vivo, almeno 6 anni, della famiglia) */
export function controllabile(state, p) {
  if (!vive(p) || eta(p, state.world.anno) < 6) return false;
  return p.sangue || Object.values(state.persone).some((x) => x.sangue && x.partner === p.id);
}

export const MAX_CONTROLLATI = 4;
