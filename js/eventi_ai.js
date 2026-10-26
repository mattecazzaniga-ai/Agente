// Eventi inventati dall'AI (FASE 5). L'AI propone situazione, domanda e scelte; ogni scelta indica
// un "tipo" preso da data/profili_ai.json. Qui la proposta viene controllata e trasformata in un
// evento normale: gli effetti (soldi, salute, morale…) arrivano solo dal profilo, cioè dal codice.

import { condizioniOk } from "./events.js";
import { vive } from "./state.js";

const LETTERE = ["a", "b", "c", "d"];
const MASSIMO_EVENTI_AI = 60; // eventi inventati tenuti nello stato (gli altri restano solo nel diario)

/** Tipi di scelta che l'AI può usare per questa persona adesso. */
export function profiliDisponibili(state, data, p) {
  return data.profili.filter((pr) => condizioniOk(state, data, p, pr.condizioni ?? {}));
}

const testoPulito = (x, max) => (typeof x === "string" ? x.replace(/[{}<>]/g, "").replace(/\s+/g, " ").trim() : "").slice(0, max);

/**
 * Converte una proposta dell'AI in evento. Restituisce null se la proposta non è usabile
 * (testi mancanti, meno di due scelte valide, tipi di scelta non disponibili).
 */
export function convertiProposta(state, data, p, proposta, id) {
  const ammessi = new Map(profiliDisponibili(state, data, p).map((pr) => [pr.id, pr]));
  const titolo = testoPulito(proposta?.titolo, 80);
  const testo = testoPulito(proposta?.testo, 700);
  if (titolo.length < 3 || testo.length < 30 || !Array.isArray(proposta?.scelte)) return null;
  const usati = new Set();
  const scelte = [];
  for (const s of proposta.scelte) {
    const profilo = ammessi.get(s?.profilo);
    const t = testoPulito(s?.testo, 120);
    if (!profilo || usati.has(profilo.id) || t.length < 2 || scelte.length >= 4) continue;
    usati.add(profilo.id);
    scelte.push({
      id: LETTERE[scelte.length],
      testo: t,
      profilo: profilo.id,
      effetti: structuredClone(profilo.effetti),
      ...(profilo.requisiti ? { requisiti: structuredClone(profilo.requisiti) } : {}),
      ...(profilo.esito_casuale ? { esito_casuale: structuredClone(profilo.esito_casuale) } : {}),
      tratti_favoriti: profilo.tratti_favoriti ?? [],
      tratti_sfavoriti: profilo.tratti_sfavoriti ?? [],
      esito: testoPulito(s?.esito, 220) || null,
    });
  }
  if (scelte.length < 2) return null;
  return { id, tema: "ai", ai: true, titolo, testi: [testo], scelte };
}

/**
 * Registra gli eventi inventati per una persona e un anno. Se l'anno è quello in corso entrano subito
 * nella coda, se è il prossimo vengono tenuti pronti per iniziaAnno. Restituisce gli id aggiunti.
 */
export function preparaEventiAI(state, data, idPersona, anno, proposte) {
  const p = state.persone[idPersona];
  const w = state.world;
  if (!vive(p) || w.fase !== "gioco" || !Array.isArray(proposte) || (anno !== w.anno && anno !== w.anno + 1)) return [];
  w.eventi_ai ??= {};
  w.ai_pronti ??= [];
  const prefisso = `ai_${anno}_${p.id}_`;
  if (Object.keys(w.eventi_ai).some((k) => k.startsWith(prefisso))) return []; // già fatto per quest'anno
  const aggiunti = [];
  proposte.slice(0, 2).forEach((proposta, i) => {
    const ev = convertiProposta(state, data, p, proposta, `${prefisso}${i}`);
    if (!ev) return;
    w.eventi_ai[ev.id] = ev;
    aggiunti.push(ev.id);
    if (anno === w.anno) w.eventi_anno.push({ persona: p.id, evento: ev.id, variante: 0, risolto: false, scelta: null, esito: null });
    else w.ai_pronti.push({ persona: p.id, anno, evento: ev.id });
  });
  potaEventiAI(state);
  return aggiunti;
}

/** Tiene nello stato solo gli eventi inventati recenti (quelli vecchi sono già nel diario). */
export function potaEventiAI(state) {
  const w = state.world;
  if (!w.eventi_ai) return;
  const inUso = new Set([...w.eventi_anno.map((e) => e.evento), ...(w.ai_pronti ?? []).map((x) => x.evento)]);
  const ids = Object.keys(w.eventi_ai);
  for (const id of ids.slice(0, Math.max(0, ids.length - MASSIMO_EVENTI_AI))) if (!inUso.has(id)) delete w.eventi_ai[id];
}

/** L'AI ha già preparato (o messo in coda) eventi per questa persona e questo anno? */
export function haEventiAI(state, idPersona, anno) {
  return Object.keys(state.world.eventi_ai ?? {}).some((k) => k.startsWith(`ai_${anno}_${idPersona}_`));
}
