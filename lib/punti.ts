// Regole dei punti delle partite: le stesse del database (calcola_punti_partita), qui per mostrare
// all'utente il dettaglio di come ha fatto i punti e per costruire la scheda del pronostico.

/** Punteggi possibili di un set vinto, dal lato di chi lo vince. */
export const SET_VINTI: [number, number][] = [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]];

export const PUNTI = { vincitore: 10, set: 5, setEsatto: 5, setUnGame: 3, setDueGame: 1, esatto: 10 } as const;

/** Un set "normale" finito: 6-0…6-4, 7-5, 7-6. */
export function setValido(a: number, b: number): boolean {
  const [hi, lo] = [Math.max(a, b), Math.min(a, b)];
  return a >= 0 && b >= 0 && ((hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6)));
}

/** Punti di un set: solo se è giusto chi lo vince; esatto 5, a 1 game 3, a 2 game 1. */
export function puntiSet(pa: number, pb: number, ra: number | undefined, rb: number | undefined): number {
  if (ra === undefined || rb === undefined || Math.sign(pa - pb) !== Math.sign(ra - rb)) return 0;
  const d = Math.abs(pa - ra) + Math.abs(pb - rb);
  return d === 0 ? PUNTI.setEsatto : d === 1 ? PUNTI.setUnGame : d === 2 ? PUNTI.setDueGame : 0;
}

const setVinti = (a: number[], b: number[]) => a.reduce((n, x, i) => n + (x < b[i] ? 1 : 0), 0);

export interface Dettaglio {
  vincitore: number; // comprende la rarità
  set: number;
  perSet: number[];
  esatto: number;
}

/** Scompone i punti già assegnati in: vincitore (con rarità), set giusti, ogni set, risultato esatto. */
export function dettaglioPunti(
  pronostico: { vincitore_id: string; game_a: number[] | null; game_b: number[] | null; set_perdente: number | null; punti: number | null },
  partita: { vincitore_id: string | null; coppia_a_id: string | null; game_a: number[] | null; game_b: number[] | null; ritiro: boolean; set_per_vincere: number },
): Dettaglio | null {
  if (pronostico.punti == null) return null;
  if (pronostico.vincitore_id !== partita.vincitore_id) return { vincitore: 0, set: 0, perSet: [], esatto: 0 };
  if (partita.ritiro || !partita.game_a || !partita.game_b) return { vincitore: pronostico.punti, set: 0, perSet: [], esatto: 0 };
  const ra = partita.game_a;
  const rb = partita.game_b;
  const perdenteReali = Math.min(setVinti(ra, rb), setVinti(rb, ra));
  const setGiusti = partita.set_per_vincere === 2 && pronostico.set_perdente === perdenteReali;
  const pa = pronostico.game_a ?? [];
  const pb = pronostico.game_b ?? [];
  const perSet = pa.map((x, i) => puntiSet(x, pb[i], ra[i], rb[i]));
  const esatto = pa.length > 0 && pronostico.set_perdente === perdenteReali && pa.every((x, i) => x === ra[i] && pb[i] === rb[i]);
  const set = setGiusti ? PUNTI.set : 0;
  const bonus = esatto ? PUNTI.esatto : 0;
  return { vincitore: pronostico.punti - set - bonus - perSet.reduce((s, x) => s + x, 0), set, perSet, esatto: bonus };
}
