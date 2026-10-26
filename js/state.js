// Stato globale della partita: un unico oggetto serializzabile in JSON.
// Qui vivono anche salvataggio, caricamento, esportazione e migrazioni dello schema.

import { mondoIniziale } from "./mondo.js";

export const VERSIONE_SCHEMA = 3;
export const CHIAVE_SALVATAGGIO = "dinastia.salvataggio";

/** Stato vuoto: il generatore lo riempie con la prima famiglia. */
export function statoVuoto(seed, anno = 2026) {
  return {
    schema: VERSIONE_SCHEMA,
    world: {
      anno,
      seed,
      rng: seed >>> 0,
      inflazione: 0.02,
      indice_prezzi: 1, // moltiplicatore dei prezzi rispetto all'anno di inizio
      indice_salari: 1, // moltiplicatore degli stipendi rispetto all'anno di inizio
      memoria: [], // conseguenze a distanza: { evento, persona, anno }
      eventi_ai: {}, // eventi inventati dall'AI, già convertiti in eventi normali (FASE 5)
      ai_pronti: [], // eventi inventati in anticipo per l'anno dopo: { persona, anno, evento }
      eventi_usati: {}, // { idPersona: { idEvento: anno } }
      eventi_anno: [], // eventi da risolvere nell'anno corrente
      fase: "gioco", // "gioco" | "erede" (scegliere chi continua) | "fine"
      mondo: mondoIniziale(), // congiuntura, età della pensione, notizie (FASE 6)
    },
    dinastia: { generazione: 1, giocati: [] }, // giocati: [{ id, dal, al }] chi è stato il personaggio principale
    persone: {},
    relazioni: [],
    nuclei: {}, // famiglie che vivono sotto lo stesso tetto: { id, regione, citta, casa }
    case: {},
    aziende: {},
    famiglia: { cognome: "", reputazione: 50, agiatezza: "media" },
    giocatore: null, // personaggio principale
    controllati: [], // tutte le persone guidate dal giocatore (FASE 4), principale compreso
    prossimo_id: 1,
  };
}

/** Nuovo id univoco con prefisso ("p" persona, "c" casa, "a" azienda, "n" nucleo). */
export function nuovoId(state, prefisso) {
  return `${prefisso}${state.prossimo_id++}`;
}

export const persona = (state, id) => (id ? state.persone[id] : undefined);
export const vive = (p) => p && p.anno_morte == null;
export const personeVive = (state) => Object.values(state.persone).filter(vive);
export const giocatore = (state) => state.persone[state.giocatore];
/** Persone guidate dal giocatore ancora in vita, principale per primo. */
export const controllate = (state) => [state.giocatore, ...(state.controllati ?? []).filter((id) => id !== state.giocatore)].map((id) => state.persone[id]).filter(vive);

// ---------------------------------------------------------------------------
// Migrazioni: ogni voce trasforma un salvataggio dalla versione N alla N+1.
// Per cambiare lo schema: aumenta VERSIONE_SCHEMA e aggiungi qui la funzione.
// ---------------------------------------------------------------------------
const MIGRAZIONI = {
  // 0 → 1: i salvataggi di prova senza numero di versione non avevano relazioni né memoria.
  0: (s) => {
    s.relazioni ??= [];
    s.world ??= {};
    s.world.memoria ??= [];
    s.world.eventi_usati ??= {};
    s.world.eventi_anno ??= [];
    s.nuclei ??= {};
    s.schema = 1;
    return s;
  },
  // 1 → 2 (FASE 2-4): dinastia, più personaggi controllati, persone "di sangue".
  1: (s) => {
    s.controllati ??= s.giocatore ? [s.giocatore] : [];
    s.dinastia ??= { generazione: 1, giocati: s.persone?.[s.giocatore] ? [{ id: s.giocatore, dal: s.persone[s.giocatore].anno_nascita + 6, al: null }] : [] };
    // nei salvataggi della FASE 1 esiste solo la famiglia di partenza: sono tutti di sangue
    for (const p of Object.values(s.persone ?? {})) {
      p.sangue ??= true;
      p.ex ??= [];
      p.coppia_dal ??= null;
    }
    s.schema = 2;
    return s;
  },
  // 2 → 3 (FASE 6): il mondo che cambia.
  2: (s) => {
    s.world ??= {};
    s.world.mondo ??= mondoIniziale();
    s.schema = 3;
    return s;
  },
};

/** Porta un salvataggio di qualsiasi versione precedente a quella attuale. */
export function migra(salvataggio) {
  let s = salvataggio;
  let versione = typeof s.schema === "number" ? s.schema : 0;
  if (versione > VERSIONE_SCHEMA) throw new Error(`Salvataggio creato da una versione più recente del gioco (schema ${versione}).`);
  while (versione < VERSIONE_SCHEMA) {
    const passo = MIGRAZIONI[versione];
    if (!passo) throw new Error(`Manca la migrazione dallo schema ${versione}.`);
    s = passo(s);
    versione = s.schema;
  }
  return s;
}

/** Controllo minimo che un oggetto sia davvero una partita di Dinastia. */
export function convalida(s) {
  if (!s || typeof s !== "object") throw new Error("File non valido.");
  if (!s.persone || typeof s.persone !== "object" || !s.world) throw new Error("Il file non contiene una partita di Dinastia.");
  if (!s.persone[s.giocatore]) throw new Error("Nella partita manca il personaggio giocato.");
  return s;
}

// ---------------------------------------------------------------------------
// Salvataggio su localStorage (il parametro storage permette i test in Node).
// ---------------------------------------------------------------------------
export function salva(state, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(CHIAVE_SALVATAGGIO, JSON.stringify(state));
    return true;
  } catch {
    return false; // spazio pieno o storage bloccato: la partita continua comunque
  }
}

export function carica(storage = globalThis.localStorage) {
  if (!storage) return null;
  try {
    const testo = storage.getItem(CHIAVE_SALVATAGGIO);
    if (!testo) return null;
    return convalida(migra(JSON.parse(testo)));
  } catch {
    return null;
  }
}

export function cancella(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(CHIAVE_SALVATAGGIO);
  } catch {
    /* niente da fare */
  }
}

/** Testo JSON per l'esportazione su file. */
export function esporta(state) {
  return JSON.stringify(state, null, 2);
}

/** Legge un file esportato (testo JSON), lo migra e lo convalida. */
export function importa(testo) {
  let dati;
  try {
    dati = JSON.parse(testo);
  } catch {
    throw new Error("Il file non è un JSON valido.");
  }
  return convalida(migra(dati));
}
