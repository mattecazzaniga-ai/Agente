// Modelli di vista: trasformano lo stato in dati pronti da mostrare.
// Qui si decide COSA mostrare (testi, numeri, scelte disponibili); le schermate in js/ui/ decidono solo COME.
// Nessuna modifica allo stato: sono funzioni pure, testabili in Node.

import { eta, formatoEuro, nomeMestiere, NOMI_TITOLI } from "./util.js";
import { controllate, giocatore, vive } from "./state.js";
import { madre, padre, fratelli, relazione, figliVivi } from "./family.js";
import { patrimonio, quotaCase, valoreAziende, membriNucleo, nettoPersona, rataMutuo, utileAzienda } from "./economy.js";
import { aziendaDi, costoCasa } from "./azioni.js";
import { eventoDi, requisitiScelta, testoEvento, testoScelta, titoloEvento } from "./events.js";
import { rigaAnno } from "./engine.js";
import { candidatiErede, controllabile, MAX_CONTROLLATI } from "./dinastia.js";
import { layoutAlbero } from "./albero.js";
import { haEventiAI, profiliDisponibili } from "./eventi_ai.js";

/** Volge al femminile un aggettivo del maschile singolare ("Ambizioso" → "Ambiziosa"). */
export function alGenere(parola, sesso) {
  if (sesso !== "F") return parola;
  return parola.replace(/^(\p{L}+)o\b/u, "$1a");
}

/** Valori in euro di oggi (l'indice dei prezzi riporta i valori nominali al 2026). */
const reale = (state, x) => Math.round(x / state.world.indice_prezzi);

const NOMI_CLASSE = { precaria: "Famiglia in difficoltà", media: "Famiglia nella media", agiata: "Famiglia agiata", ricca: "Famiglia ricca" };

const STAT = [
  { id: "salute", nome: "Salute" },
  { id: "morale", nome: "Morale" },
  { id: "felicita", nome: "Felicità" },
  { id: "stanchezza", nome: "Stanchezza", inversa: true },
  { id: "reputazione", nome: "Reputazione" },
];

/** Descrizione di una riga per l'occupazione di una persona. */
export function occupazione(state, data, p) {
  const anni = eta(p, state.world.anno);
  const f = p.sesso === "F";
  if (!vive(p)) return `Mort${f ? "a" : "o"} nel ${p.anno_morte} a ${anni} anni`;
  if (p.carriera.pensionato) return "In pensione";
  if (p.carriera.imprenditore) {
    const a = aziendaDi(state, p);
    return a ? `Titolare di ${a.nome}` : f ? "Imprenditrice" : "Imprenditore";
  }
  if (p.carriera.lavoro) return `${nomeMestiere(data.mestiere[p.carriera.lavoro], p.sesso) ?? "Lavoro"}${p.carriera.part_time ? " (part-time)" : ""}`;
  const i = p.istruzione;
  if (i.iscritto) {
    if (i.livello === "universita") return `${data.facolta[i.facolta]?.nome ?? "Università"} · ${i.crediti} CFU${i.fuori_sede ? " · fuori sede" : ""}`;
    if (i.livello === "superiori") return `${data.superiore[i.indirizzo]?.nome ?? "Superiori"} · ${i.anno_corso}° anno`;
    if (i.livello === "medie") return `Scuola media · ${i.anno_corso}ª`;
    if (i.livello === "elementari") return `Scuola elementare · ${i.anno_corso}ª`;
  }
  if (anni < 3) return "Neonat" + (f ? "a" : "o");
  if (anni < 6) return "Scuola dell'infanzia";
  if (p.carriera.naspi?.anni > 0) return "Disoccupat" + (f ? "a" : "o") + " (NASpI)";
  return anni < 25 ? "Cerca la sua strada" : "Senza lavoro";
}

const genitoriDi = (x) => [x?.madre, x?.padre].filter(Boolean);
const condividonoGenitore = (a, b) => a.id !== b.id && genitoriDi(a).some((g) => genitoriDi(b).includes(g));

/** Nome leggibile della parentela di q vista da p (Madre, Cognato, Nipote…). */
export function ruolo(state, p, q) {
  const f = q.sesso === "F";
  const g = (m, fem) => (f ? fem : m);
  const P = (id) => state.persone[id];
  if (q.id === p.id) return "Tu";
  if (q.id === p.madre) return "Madre";
  if (q.id === p.padre) return "Padre";
  if (q.id === p.partner) {
    if (p.stato_civile === "sposato" || p.stato_civile === "vedovo") return g("Marito", "Moglie");
    if (p.stato_civile === "convivente") return g("Compagno", "Compagna");
    return g("Fidanzato", "Fidanzata");
  }
  if (p.ex?.includes(q.id)) return g("Ex compagno", "Ex compagna");
  if (p.figli.includes(q.id)) return g("Figlio", "Figlia");
  if (genitoriDi(q).some((id) => p.figli.includes(id))) return "Nipote";
  if (genitoriDi(p).some((id) => genitoriDi(P(id)).includes(q.id))) return g("Nonno", "Nonna");
  if (condividonoGenitore(p, q)) return g("Fratello", "Sorella");
  if (genitoriDi(p).some((id) => P(id) && condividonoGenitore(P(id), q))) return g("Zio", "Zia");
  if (genitoriDi(q).some((id) => P(id) && condividonoGenitore(P(id), p))) return "Nipote";
  if (genitoriDi(q).some((id) => genitoriDi(p).some((gp) => P(gp) && P(id) && condividonoGenitore(P(gp), P(id))))) return g("Cugino", "Cugina");
  if (p.figli.some((id) => P(id)?.partner === q.id || P(id)?.ex?.includes(q.id))) return g("Genero", "Nuora");
  if (Object.values(state.persone).some((x) => condividonoGenitore(p, x) && x.partner === q.id)) return g("Cognato", "Cognata");
  if (genitoriDi(p).some((id) => P(id)?.partner === q.id)) return g("Patrigno", "Matrigna");
  if (genitoriDi(p).some((id) => genitoriDi(P(id)).some((n) => genitoriDi(P(n)).includes(q.id)))) return g("Bisnonno", "Bisnonna");
  return q.sangue ? "Parente" : g("Parente acquisito", "Parente acquisita");
}

/** "Sposata con Marco", "Single", "Vedovo"… */
function statoCivile(state, p) {
  const f = p.sesso === "F";
  const q = state.persone[p.partner];
  const o = f ? "a" : "o";
  switch (p.stato_civile) {
    case "sposato":
      return `Sposat${o} con ${q?.nome}`;
    case "convivente":
      return `Convive con ${q?.nome}`;
    case "fidanzato":
      return `Fidanzat${o} con ${q?.nome}`;
    case "separato":
      return `Separat${o}`;
    case "vedovo":
      return f ? "Vedova" : "Vedovo";
    default:
      return "Single";
  }
}

/** Tratti e ricordi leggibili. */
function tratti(data, p) {
  return p.tratti.map((t) => ({ nome: alGenere(data.tratto[t]?.nome ?? t, p.sesso), descrizione: data.tratto[t]?.descrizione ?? "" }));
}
function ricordi(data, p) {
  return p.ricordi.map((r) => ({ nome: data.ricordo[r.id]?.nome ?? r.id, anno: r.anno, descrizione: data.ricordo[r.id]?.descrizione ?? "" }));
}

/** Persona in forma breve, per avatar ed elenchi. */
function breve(state, data, io, p) {
  return { id: p.id, nome: `${p.nome} ${p.cognome}`, primo: p.nome, sesso: p.sesso, eta: eta(p, state.world.anno), vivo: vive(p), ruolo: ruolo(state, io, p), occupazione: occupazione(state, data, p) };
}

/**
 * Contesto per il narratore AI (FASE 5): chi è la persona, dove vive, che carattere ha,
 * cosa le è successo di recente. Solo testo da raccontare: l'AI non decide nulla.
 */
export function contestoNarrativo(state, data, p) {
  return {
    nome: p.nome,
    cognome: p.cognome,
    eta: eta(p, state.world.anno),
    sesso: p.sesso === "F" ? "donna" : "uomo",
    anno: state.world.anno,
    citta: p.citta,
    regione: data.regione[p.regione]?.nome ?? p.regione,
    occupazione: occupazione(state, data, p),
    stato_civile: statoCivile(state, p),
    carattere: tratti(data, p).map((t) => t.nome),
    famiglia: `${NOMI_CLASSE[state.famiglia.agiatezza]} ${state.famiglia.cognome}`,
    momento_in_italia: data.mondo?.congiuntura?.[state.world.mondo?.congiuntura]?.nome ?? "Anni normali",
    fatti_recenti: p.diario.slice(-2).flatMap((d) => d.righe).slice(-6),
  };
}

/**
 * Cosa chiedere all'AI che inventa gli eventi (FASE 5): per il personaggio principale, l'anno in corso
 * (se non ha ancora eventi inventati) e il prossimo, preparato in anticipo mentre si gioca.
 */
export function richiesteEventiAI(state, data) {
  const io = giocatore(state);
  if (state.world.fase !== "gioco" || !vive(io) || eta(io, state.world.anno) < 6) return [];
  const recenti = io.diario.slice(-4).flatMap((d) => d.righe).slice(-8);
  const out = [];
  for (const anno of [state.world.anno, state.world.anno + 1]) {
    if (haEventiAI(state, io.id, anno)) continue;
    const avanti = anno - state.world.anno;
    out.push({
      persona: io.id,
      anno,
      chiave: `${state.world.seed}:inventa:${anno}:${io.id}`,
      contesto: { ...contestoNarrativo(state, data, io), eta: eta(io, state.world.anno) + avanti, anno, fatti_recenti: recenti },
      profili: profiliDisponibili(state, data, io).map((p) => ({ id: p.id, descrizione: p.descrizione })),
    });
  }
  return out;
}

/** Informazioni sulla dinastia: generazioni e personaggi giocati. */
function vistaDinastia(state) {
  const d = state.dinastia ?? { generazione: 1, giocati: [] };
  return {
    cognome: state.famiglia.cognome,
    reputazione: state.famiglia.reputazione,
    generazione: d.generazione,
    anni: state.world.anno - (d.giocati[0]?.dal ?? state.world.anno),
    giocati: d.giocati.map((g) => {
      const p = state.persone[g.id];
      return { id: g.id, nome: p ? `${p.nome} ${p.cognome}` : "?", sesso: p?.sesso, dal: g.dal, al: g.al, nascita: p?.anno_nascita, morte: p?.anno_morte };
    }),
  };
}

// ---------------------------------------------------------------------------
// Schermata di generazione della prima famiglia
// ---------------------------------------------------------------------------

export function vistaGeneratore(state, data) {
  const io = giocatore(state);
  const nucleo = state.nuclei[io.nucleo];
  const casa = nucleo.casa ? state.case[nucleo.casa] : null;
  const membri = [io, madre(state, io), padre(state, io), ...fratelli(state, io)].filter(Boolean);
  const azienda = Object.values(state.aziende)[0] ?? null;
  const risparmi = membri.reduce((s, p) => s + p.economia.risparmi, 0);
  const debiti = membri.reduce((s, p) => s + p.economia.debiti, 0);
  const separati = madre(state, io)?.stato_civile === "separato";
  return {
    cognome: state.famiglia.cognome,
    luogo: `${io.citta}, ${data.regione[io.regione].nome}`,
    classe: NOMI_CLASSE[state.famiglia.agiatezza],
    seed: state.world.seed,
    protagonista: { nome: io.nome, eta: eta(io, state.world.anno), sesso: io.sesso, tratti: tratti(data, io), infanzia: io.diario[0]?.righe[0] ?? "" },
    membri: membri.map((p) => ({ id: p.id, sesso: p.sesso, nome: `${p.nome} ${p.cognome}`, ruolo: ruolo(state, io, p), eta: eta(p, state.world.anno), occupazione: occupazione(state, data, p), storia: p.storia ?? null, tratti: tratti(data, p).map((t) => t.nome) })),
    note: [
      separati ? "I genitori sono separati: vivi con tua madre." : null,
      casa ? `${casa.nome} di proprietà${casa.mutuo_residuo > 0 ? `, mutuo residuo ${formatoEuro(casa.mutuo_residuo)}` : ""}` : "Casa in affitto",
      azienda ? `Azienda di famiglia: ${azienda.nome}` : null,
    ].filter(Boolean),
    casa: casa ? { nome: casa.nome, valore: casa.valore, mutuo: casa.mutuo_residuo } : null,
    risparmi,
    debiti,
  };
}

// ---------------------------------------------------------------------------
// Schermata Vita
// ---------------------------------------------------------------------------

export function vistaVita(state, data) {
  const io = giocatore(state);
  const anni = eta(io, state.world.anno);
  const b = io.economia.bilancio;
  const fase = state.world.fase;
  const aperti = state.world.eventi_anno.map((e, indice) => ({ e, indice })).filter(({ e }) => !e.risolto && state.persone[e.persona]);
  const eventi = aperti.map(({ e, indice }) => {
    const p = state.persone[e.persona];
    const ev = eventoDi(state, data, e.evento);
    return {
      indice,
      id: ev.id,
      tema: ev.tema,
      persona: { ...breve(state, data, io, p), principale: p.id === io.id },
      titolo: titoloEvento(state, data, p, ev),
      testo: testoEvento(state, data, p, ev, e.variante),
      scelte: ev.scelte.map((s) => {
        const r = requisitiScelta(state, data, p, s);
        return { id: s.id, testo: testoScelta(state, data, p, s), ok: r.ok, motivo: r.motivo ?? null };
      }),
    };
  });
  // materiale per il narratore AI: stesso evento, stessa variante → stessa chiave in archivio
  for (const ev of eventi) {
    const p = state.persone[ev.persona.id];
    const voce = state.world.eventi_anno[ev.indice];
    if (eventoDi(state, data, ev.id)?.ai) {
      ev.racconto = null; // l'ha già scritto l'AI
      continue;
    }
    ev.racconto = { chiave: `${state.world.seed}:${state.world.anno}:${p.id}:${ev.id}:${voce.variante}`, contesto: contestoNarrativo(state, data, p), evento: { titolo: ev.titolo, testo: ev.testo, scelte: ev.scelte.map((s) => s.testo) } };
  }
  const risolti = state.world.eventi_anno
    .filter((e) => e.risolto && state.persone[e.persona])
    .map((e) => {
      const p = state.persone[e.persona];
      const ev = eventoDi(state, data, e.evento);
      const s = ev.scelte.find((x) => x.id === e.scelta);
      return { titolo: titoloEvento(state, data, p, ev), scelta: s ? testoScelta(state, data, p, s) : "", esito: e.esito, persona: p.id === io.id ? null : p.nome };
    });
  const r = state.world.ultimo_riepilogo;
  const riepilogo =
    r && r.anno === state.world.anno - 1
      ? { anno: r.anno, righe: r.righe, notizie: r.notizie ?? [], altri: (r.altri ?? []).filter((x) => x.righe.length && state.persone[x.id]).map((x) => ({ nome: x.nome, ruolo: ruolo(state, io, state.persone[x.id]), righe: x.righe })) }
      : null;
  if (riepilogo?.righe.length) riepilogo.racconto = { chiave: `${state.world.seed}:anno:${riepilogo.anno}:${io.id}`, contesto: { ...contestoNarrativo(state, data, io), anno: riepilogo.anno, eta: anni - 1 }, righe: riepilogo.righe };
  const controllatiIds = new Set(state.controllati ?? []);
  return {
    fase,
    fine: fase === "fine",
    anno: state.world.anno,
    nome: `${io.nome} ${io.cognome}`,
    sesso: io.sesso,
    nascita: io.anno_nascita,
    eta: anni,
    luogo: `${io.citta}, ${data.regione[io.regione].nome}`,
    occupazione: occupazione(state, data, io),
    stato_civile: statoCivile(state, io),
    titolo: NOMI_TITOLI[io.istruzione.titolo],
    stat: STAT.map((s) => ({ ...s, valore: Math.round(io.stat[s.id]) })),
    tratti: tratti(data, io),
    ricordi: ricordi(data, io),
    soldi: {
      patrimonio: patrimonio(state, io),
      risparmi: io.economia.risparmi,
      debiti: io.economia.debiti,
      netto_anno: b?.netto ?? 0,
      saldo_anno: b?.saldo ?? 0,
      dipendente: anni < 18 && !io.carriera.lavoro,
    },
    eventi,
    risolti,
    coda: controllate(state).map((p) => ({ ...breve(state, data, io, p), da_fare: eventi.filter((e) => e.persona.id === p.id).length, principale: p.id === io.id })),
    riepilogo,
    famiglia: righeFamiglia(state, data, state.world.anno - 1).filter((x) => x.id !== io.id && x.vivo && !controllatiIds.has(x.id) && x.riga).slice(0, 5),
    epilogo: fase !== "gioco" ? epilogo(state, data, io) : null,
    candidati: fase === "erede" ? candidatiErede(state, io).map(({ persona, motivo }) => ({ ...breve(state, data, io, persona), motivo, tratti: tratti(data, persona).map((t) => t.nome), patrimonio: patrimonio(state, persona) })) : [],
    dinastia: vistaDinastia(state),
    mondo: vistaMondo(state, data),
  };
}

/** L'Italia in questo momento (FASE 6): congiuntura, età della pensione, ultime notizie. */
export function vistaMondo(state, data) {
  const m = state.world.mondo ?? { congiuntura: "normale", eta_pensione: 67, notizie: [] };
  const c = data.mondo?.congiuntura?.[m.congiuntura];
  return {
    congiuntura: m.congiuntura,
    nome: c?.nome ?? "Anni normali",
    anni_restanti: m.anni_restanti ?? 0,
    eta_pensione: m.eta_pensione ?? 67,
    notizie: (m.notizie ?? []).slice(-8).reverse(),
  };
}

/** Riassunto della vita a fine partita. */
function epilogo(state, data, p) {
  const lavori = [...new Set(p.carriera.storico.map((s) => nomeMestiere(data.mestiere[s.lavoro], p.sesso)).filter(Boolean))];
  const massimo = p.storico_patrimonio.reduce((m, x) => (x.valore > m.valore ? x : m), { valore: 0, anno: null });
  return {
    eta: eta(p, state.world.anno),
    anno_morte: p.anno_morte,
    causa: p.causa_morte,
    titolo: NOMI_TITOLI[p.istruzione.titolo],
    lavori,
    figli: (p.figli ?? []).map((id) => state.persone[id]?.nome).filter(Boolean),
    patrimonio_finale: p.storico_patrimonio.at(-1)?.valore ?? 0,
    patrimonio_massimo: massimo,
    ricordi: ricordi(data, p),
    diario: p.diario.slice(-6).reverse(),
    racconto: {
      chiave: `${state.world.seed}:vita:${p.id}`,
      contesto: { nome: `${p.nome} ${p.cognome}` },
      vita: {
        nome: `${p.nome} ${p.cognome}`,
        anni: `${p.anno_nascita}-${p.anno_morte}`,
        citta: p.citta,
        studi: NOMI_TITOLI[p.istruzione.titolo],
        lavori,
        figli: (p.figli ?? []).map((id) => state.persone[id]?.nome).filter(Boolean),
        stato_civile: statoCivile(state, p),
        carattere: tratti(data, p).map((t) => t.nome),
        ricordi: ricordi(data, p).map((r) => r.nome),
        ultimi_fatti: p.diario.slice(-3).flatMap((d) => d.righe).slice(-6),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Schermata Soldi
// ---------------------------------------------------------------------------

export function vistaSoldi(state, data) {
  const io = giocatore(state);
  const b = io.economia.bilancio;
  const nucleo = state.nuclei[io.nucleo];
  const casa = nucleo?.casa ? state.case[nucleo.casa] : null;
  const mia = Object.values(state.case).filter((c) => c.proprietari.includes(io.id));
  const membri = nucleo ? membriNucleo(state, io.nucleo) : [];
  const conGenitori = membri.some((m) => m.id === io.madre || m.id === io.padre);
  const prezzo = costoCasa(state, data, io);
  const storico = io.storico_patrimonio.map((x) => ({ anno: x.anno, valore: x.valore }));
  const azienda = aziendaDi(state, io) ?? (io.carriera.lavoro === "azienda_famiglia" ? state.aziende[io.carriera.azienda] : null);
  const altreCase = mia.filter((c) => c.id !== casa?.id);
  return {
    anno: state.world.anno,
    patrimonio: patrimonio(state, io),
    patrimonio_reale: reale(state, patrimonio(state, io)),
    risparmi: io.economia.risparmi,
    debiti: io.economia.debiti,
    case: quotaCase(state, io),
    aziende: valoreAziende(state, io),
    indice_prezzi: Math.round(state.world.indice_prezzi * 100) / 100,
    inflazione: Math.round(state.world.inflazione * 1000) / 10,
    reddito_previsto: Math.round(nettoPersona(state, data, io)),
    mondo: vistaMondo(state, data),
    bilancio: b
      ? {
          anno: b.anno,
          righe: [
            { nome: "Reddito lordo", valore: b.lordo },
            { nome: "Contributi INPS", valore: -b.contributi },
            { nome: "IRPEF e addizionali", valore: -b.tasse },
            { nome: "Netto", valore: b.netto, forte: true },
            { nome: casa ? "Casa (rata, spese)" : "Affitto", valore: -b.spese_casa },
            { nome: "Vita quotidiana", valore: -b.spese_vita },
            ...(b.spese_studio ? [{ nome: "Studio e figli piccoli", valore: -b.spese_studio }] : []),
            { nome: "Saldo dell'anno", valore: b.saldo, forte: true },
          ],
          nucleo: b.nucleo,
        }
      : null,
    nucleo: membri.filter((m) => m.id !== io.id).map((m) => ({ nome: m.nome, ruolo: ruolo(state, io, m), netto: m.economia.bilancio?.netto ?? 0 })),
    abitazione: {
      descrizione: casa ? `${casa.nome}${mia.some((c) => c.id === casa.id) ? "" : conGenitori ? " (dei tuoi genitori)" : ""}` : conGenitori ? "In affitto con la famiglia" : "In affitto",
      con_genitori: conGenitori,
      membri: membri.length,
      valore: casa?.valore ?? null,
      mutuo: casa?.mutuo_residuo ?? 0,
      rata: casa?.mutuo_residuo > 0 ? casa.rata : 0,
      mia: mia.length > 0,
    },
    altre_case: altreCase.map((c) => ({ nome: c.nome, valore: c.valore, quota: c.proprietari.length > 1 ? `1/${c.proprietari.length}` : null, mutuo: c.mutuo_residuo })),
    azienda: azienda
      ? { nome: azienda.nome, ruolo: azienda.proprietario === io.id ? "Titolare" : "Lavori qui", valore: azienda.valore, fatturato: azienda.fatturato, utile: Math.round(utileAzienda(azienda)), salute: azienda.salute, fondata: azienda.fondata }
      : null,
    casa_ideale: { prezzo: prezzo.prezzo, anticipo: prezzo.anticipo, rata: Math.round(rataMutuo(prezzo.prezzo - prezzo.anticipo, 0.035, 25)), citta: io.citta },
    storico,
  };
}

// ---------------------------------------------------------------------------
// Schermata Famiglia: albero (FASE 3), scheda della persona scelta, controllo (FASE 4)
// ---------------------------------------------------------------------------

/** Una riga per ogni parente stretto, con il riassunto del suo anno. */
export function righeFamiglia(state, data, anno = state.world.anno - 1) {
  const io = giocatore(state);
  const vicini = [io, madre(state, io), padre(state, io), ...fratelli(state, io), state.persone[io.partner], ...io.figli.map((id) => state.persone[id])].filter(Boolean);
  const unici = [...new Map(vicini.map((p) => [p.id, p])).values()];
  return unici.map((p) => ({
    id: p.id,
    nome: `${p.nome} ${p.cognome}`,
    ruolo: ruolo(state, io, p),
    eta: eta(p, state.world.anno),
    vivo: vive(p),
    sesso: p.sesso,
    occupazione: occupazione(state, data, p),
    legame: p.id === io.id ? null : relazione(state, io.id, p.id)?.intensita ?? null,
    tratti: tratti(data, p).map((t) => t.nome),
    riga: vive(p) || p.anno_morte >= anno ? rigaAnno(state, data, p, anno) : null,
    stesso_tetto: p.nucleo === io.nucleo && vive(p),
  }));
}

/** Scheda di una persona dell'albero, con le azioni possibili. */
function scheda(state, data, p) {
  const io = giocatore(state);
  const inGioco = state.world.fase === "gioco";
  const controllata = (state.controllati ?? []).includes(p.id);
  const possibile = inGioco && controllabile(state, p);
  const pieni = (state.controllati ?? []).length >= MAX_CONTROLLATI;
  let motivo = null;
  if (!vive(p)) motivo = null;
  else if (!inGioco) motivo = "Prima scegli chi continua la storia.";
  else if (eta(p, state.world.anno) < 6) motivo = "Si può controllare dai 6 anni.";
  else if (!possibile) motivo = "Si possono controllare solo le persone della famiglia e i loro partner.";
  return {
    ...breve(state, data, io, p),
    anni: `${p.anno_nascita}–${p.anno_morte ?? ""}`,
    stato_civile: statoCivile(state, p),
    tratti: tratti(data, p),
    ricordi: ricordi(data, p),
    figli: figliVivi(state, p).map((f) => f.nome),
    patrimonio: patrimonio(state, p),
    legame: p.id === io.id ? null : relazione(state, io.id, p.id)?.intensita ?? null,
    riga: vive(p) ? rigaAnno(state, data, p, state.world.anno - 1) : null,
    causa_morte: p.causa_morte,
    principale: p.id === io.id,
    controllata,
    puo_giocare: possibile && p.id !== io.id,
    puo_controllare: possibile && !controllata && !pieni,
    puo_rilasciare: inGioco && controllata && p.id !== io.id,
    pieni: possibile && !controllata && pieni,
    motivo,
  };
}

export function vistaFamiglia(state, data, selezionato = null) {
  const io = giocatore(state);
  const albero = layoutAlbero(state);
  const controllati = new Set(state.controllati ?? []);
  const scelto = state.persone[selezionato] ?? io;
  return {
    cognome: state.famiglia.cognome,
    reputazione: state.famiglia.reputazione,
    classe: NOMI_CLASSE[state.famiglia.agiatezza],
    dinastia: vistaDinastia(state),
    controllati: { quanti: controllati.size, massimo: MAX_CONTROLLATI },
    albero: {
      larghezza: albero.larghezza,
      altezza: albero.altezza,
      linee: albero.linee,
      nodi: albero.nodi.map(({ persona: p, x, y }) => ({
        id: p.id,
        x,
        y,
        primo: p.nome,
        iniziali: `${p.nome[0]}${p.cognome[0]}`,
        sesso: p.sesso,
        anni: `${p.anno_nascita}${p.anno_morte ? `–${p.anno_morte}` : ""}`,
        vivo: vive(p),
        sangue: p.sangue,
        principale: p.id === io.id,
        controllato: controllati.has(p.id),
        selezionato: p.id === scelto.id,
      })),
    },
    scheda: scheda(state, data, scelto),
    diario: io.diario.slice(-12).reverse(), // gli ultimi 12 anni
  };
}

// ---------------------------------------------------------------------------
// Impostazioni
// ---------------------------------------------------------------------------

export function vistaImpostazioni(state, ai = null) {
  return {
    ai,
    seed: state?.world.seed ?? null,
    anno: state?.world.anno ?? null,
    schema: state?.schema ?? null,
    nome: state ? `${giocatore(state).nome} ${giocatore(state).cognome}` : null,
    dinastia: state ? vistaDinastia(state) : null,
    controllati: state ? (state.controllati ?? []).length : 0,
    massimo: MAX_CONTROLLATI,
  };
}

