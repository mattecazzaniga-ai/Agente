// Persone, relazioni e legami di parentela. Nessuna logica di gioco qui: solo struttura e ricerche.

import { nuovoId } from "./state.js";
import { eta, limita, nomeMestiere, NOMI_TITOLI } from "./util.js";

/** Crea una persona con tutti i campi del modello dati e la registra nello stato. */
export function creaPersona(state, campi) {
  const id = nuovoId(state, "p");
  const p = {
    id,
    nome: "",
    cognome: "",
    sesso: "M",
    anno_nascita: state.world.anno,
    anno_morte: null,
    causa_morte: null,
    regione: "",
    citta: "",
    nucleo: null,
    tratti: [],
    stat: { salute: 80, morale: 60, felicita: 60, stanchezza: 25, reputazione: 50 },
    tempo_libero: 40,
    istruzione: { livello: "nessuno", anno_corso: 0, indirizzo: null, facolta: null, crediti: 0, titolo: "nessuno", voti: 6.5, voto_diploma: null, voto_laurea: null, iscritto: false, fuori_sede: false, bocciature: 0 },
    carriera: { lavoro: null, anzianita: 0, bonus: 1, part_time: false, anni_lavorati: 0, pensionato: false, pensione: 0, storico: [] },
    economia: { risparmi: 0, debiti: 0, bilancio: null },
    stato_civile: "single", // single | fidanzato | convivente | sposato | separato | vedovo
    partner: null,
    coppia_dal: null, // anno in cui è iniziata la relazione attuale
    ex: [], // partner precedenti
    generazione: null, // 0 = genitori di partenza, 1 = protagonista e fratelli, 2 = i loro figli…
    sangue: false, // discendente della famiglia di partenza (le regole della dinastia valgono per loro)
    figli: [],
    madre: null,
    padre: null,
    ricordi: [],
    flags: {},
    controllo: "automatico",
    diario: [],
    storico_patrimonio: [],
    ...campi,
  };
  state.persone[id] = p;
  return p;
}

// ---------------------------------------------------------------------------
// Relazioni: archi orientati { da, a, tipo, intensita (-100..100) }
// ---------------------------------------------------------------------------

export function relazione(state, da, a) {
  return state.relazioni.find((r) => r.da === da && r.a === a);
}

/** Crea o aggiorna una relazione nei due sensi (stesso tipo inverso, stessa intensità). */
export function collega(state, da, a, tipo, tipoInverso, intensita) {
  for (const [x, y, t] of [
    [da, a, tipo],
    [a, da, tipoInverso],
  ]) {
    const r = relazione(state, x, y);
    if (r) {
      r.tipo = t;
      r.intensita = intensita;
    } else state.relazioni.push({ da: x, a: y, tipo: t, intensita });
  }
}

/** Cambia l'intensità di una relazione in entrambi i sensi. */
export function modificaRelazione(state, da, a, delta) {
  for (const r of state.relazioni) {
    if ((r.da === da && r.a === a) || (r.da === a && r.a === da)) r.intensita = limita(Math.round(r.intensita + delta), -100, 100);
  }
}

// ---------------------------------------------------------------------------
// Parentele
// ---------------------------------------------------------------------------

export const madre = (state, p) => state.persone[p.madre];
const STATI_COPPIA = ["fidanzato", "convivente", "sposato"];

/** Partner attuale vivo (fidanzato, convivente o coniuge), altrimenti undefined. */
export function partnerDi(state, p) {
  const q = state.persone[p.partner];
  return q && q.anno_morte == null && STATI_COPPIA.includes(p.stato_civile) ? q : undefined;
}
export const inCoppia = (state, p) => Boolean(partnerDi(state, p));

/** Figli vivi, dal più grande al più piccolo. */
export function figliVivi(state, p) {
  return (p.figli ?? []).map((id) => state.persone[id]).filter((f) => f && f.anno_morte == null).sort((a, b) => a.anno_nascita - b.anno_nascita);
}
export const figlioPiuGiovane = (state, p) => figliVivi(state, p).at(-1);
export const figlioMaggiore = (state, p) => figliVivi(state, p)[0];

/** Nipoti (figli dei figli) vivi. */
export function nipoti(state, p) {
  return (p.figli ?? []).flatMap((id) => figliVivi(state, state.persone[id] ?? { figli: [] }));
}
export const padre = (state, p) => state.persone[p.padre];

export function fratelli(state, p) {
  return Object.values(state.persone).filter((x) => x.id !== p.id && ((p.madre && x.madre === p.madre) || (p.padre && x.padre === p.padre)));
}

/** Familiari "di riferimento" per un evento: chi è il genitore con il rapporto migliore, ecc. */
export function genitoreVicino(state, p) {
  const g = [madre(state, p), padre(state, p)].filter((x) => x && x.anno_morte == null);
  return g.sort((a, b) => (relazione(state, p.id, b.id)?.intensita ?? 0) - (relazione(state, p.id, a.id)?.intensita ?? 0))[0];
}

/** Accordi di genere per i testi: {o} = o/a, {lui} = lui/lei, {figlio}, {un}. */
export function genere(p) {
  const f = p?.sesso === "F";
  return {
    o: f ? "a" : "o",
    lui: f ? "lei" : "lui",
    figlio: f ? "figlia" : "figlio",
    un: f ? "una" : "un",
    ragazzo: f ? "ragazza" : "ragazzo",
    fratello_g: f ? "sorella" : "fratello",
    nonno_g: f ? "nonna" : "nonno",
    genitore_g: f ? "mamma" : "papà",
    sposo_g: f ? "sposa" : "sposo",
  };
}

/** Valori per i segnaposto dei testi degli eventi, relativi a una persona. */
export function segnaposto(state, data, p) {
  const m = madre(state, p);
  const pa = padre(state, p);
  const fr = fratelli(state, p).find((x) => x.anno_morte == null);
  const lavoro = p.carriera.lavoro ? nomeMestiere(data.mestiere[p.carriera.lavoro], p.sesso)?.toLowerCase() : null;
  return {
    ...genere(p),
    nome: p.nome,
    cognome: p.cognome,
    citta: p.citta,
    regione: data.regione[p.regione]?.nome ?? p.regione,
    eta: eta(p, state.world.anno),
    anno: state.world.anno,
    madre: m?.nome ?? "tua madre",
    padre: pa?.nome ?? "tuo padre",
    fratello: fr?.nome ?? "tuo cugino",
    genitore: genitoreVicino(state, p)?.nome ?? "tua madre",
    fratello_o_sorella: fr ? genere(fr).fratello_g : "cugino",
    lavoro: lavoro ?? "il tuo lavoro",
    scuola: p.istruzione.indirizzo ? data.superiore[p.istruzione.indirizzo]?.nome : "la scuola",
    facolta: p.istruzione.facolta ? data.facolta[p.istruzione.facolta]?.nome : "l'università",
    titolo: NOMI_TITOLI[p.istruzione.titolo],
    partner: (state.persone[p.partner] ?? {}).nome ?? "la persona che ami",
    figlio_nome: figlioPiuGiovane(state, p)?.nome ?? "tuo figlio",
    figlio_maggiore: figlioMaggiore(state, p)?.nome ?? "tuo figlio",
    ultimo_figlio: figlioPiuGiovane(state, p)?.nome ?? "il bambino",
    o_figlio: genere(figlioPiuGiovane(state, p)).o,
    o_partner: genere(state.persone[p.partner]).o,
  };
}

/** Aggiunge una riga al diario della persona per l'anno corrente. */
export function annota(state, p, testo) {
  let voce = p.diario[p.diario.length - 1];
  if (!voce || voce.anno !== state.world.anno) {
    voce = { anno: state.world.anno, righe: [] };
    p.diario.push(voce);
    if (p.diario.length > 120) p.diario.shift();
  }
  voce.righe.push(testo);
}
