// L'Italia che cambia (FASE 6): crisi, riprese, caro vita, pandemie, riforme delle pensioni e
// automazione dei mestieri. Tutto deciso dal seed della partita; il resto del motore legge i
// modificatori con modificatori(state). I dati sono in data/mondo.json.

import { intero, probabile, scegli } from "./rng.js";
import { riempi } from "./util.js";

const NESSUNO = { licenziamenti: 1, assunzioni: 1, salari: 0, case: 0, aziende: 0, inflazione: 0, mortalita_anziani: 1, morale: 0 };

/** Stato iniziale del mondo (anche per i salvataggi che non lo avevano). */
export function mondoIniziale() {
  return { congiuntura: "normale", anni_restanti: 0, eta_pensione: 67, tendenze_attive: [], notizie: [] };
}

/** Modificatori dell'anno in corso: congiuntura attuale. Senza dati del mondo, nessun effetto. */
export function modificatori(state, data) {
  const m = state.world.mondo;
  const c = data?.mondo?.congiuntura?.[m?.congiuntura];
  return { ...NESSUNO, ...(c?.effetti ?? {}) };
}

/** Moltiplicatore della probabilità di perdere il lavoro per un settore (automazione, carenza di personale). */
export function rischioSettore(state, data, settore) {
  let x = 1;
  for (const t of data?.mondo?.tendenze ?? []) if (state.world.anno >= t.dal && t.settori[settore]) x *= t.settori[settore];
  return x;
}

export const etaPensione = (state) => state.world.mondo?.eta_pensione ?? 67;

function notizia(state, testo) {
  const m = state.world.mondo;
  m.notizie.push({ anno: state.world.anno, testo });
  if (m.notizie.length > 40) m.notizie.shift();
}

/**
 * Un anno di mondo: finisce o continua la congiuntura, a volte ne inizia una nuova, entrano in vigore
 * tendenze e riforme. Restituisce le notizie dell'anno.
 */
export function aggiornaMondo(state, data) {
  const w = state.world;
  w.mondo ??= mondoIniziale();
  const m = w.mondo;
  const D = data.mondo;
  if (!D) return [];
  const prima = m.notizie.length;

  // congiuntura
  if (m.congiuntura !== "normale") {
    m.anni_restanti -= 1;
    if (m.anni_restanti <= 0) {
      const finita = D.congiuntura[m.congiuntura];
      if (finita?.notizie_fine?.length) notizia(state, scegli(state, finita.notizie_fine));
      m.congiuntura = "normale";
    }
  } else {
    for (const c of D.congiunture) {
      if (!c.probabilita || !probabile(state, c.probabilita)) continue;
      m.congiuntura = c.id;
      m.anni_restanti = intero(state, ...c.durata);
      notizia(state, scegli(state, c.notizie_inizio));
      break;
    }
  }

  // tendenze di lungo periodo (una notizia quando iniziano)
  for (const t of D.tendenze) {
    if (w.anno >= t.dal && !m.tendenze_attive.includes(t.dal)) {
      m.tendenze_attive.push(t.dal);
      notizia(state, t.notizia);
    }
  }

  // riforma delle pensioni: l'età sale con la speranza di vita, fino a un massimo
  const P = D.pensione;
  if (w.anno >= P.dal && m.eta_pensione < P.eta_massima && probabile(state, P.probabilita_aumento)) {
    m.eta_pensione += 1;
    notizia(state, riempi(P.notizia, { eta: m.eta_pensione }));
  }
  return m.notizie.slice(prima).map((n) => n.testo);
}
