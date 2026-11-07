// Regolamento dei pronostici: le stesse regole del database (calcola_punti_partita, game_possibili),
// qui per la scheda del pronostico e per spiegare i punti. I valori veri stanno nella tabella regole_punti:
// REGOLE_PREDEFINITE serve solo se non si riescono a leggere.

export type Regole = Record<string, number>;

export const REGOLE_PREDEFINITE: Regole = {
  vincitore: 3,
  set_esatti: 4,
  game_errore_0: 5,
  game_errore_1: 4,
  game_errore_2: 3,
  game_errore_3: 2,
  game_errore_4: 1,
  long_vicino: 2,
  long_errore_max: 2,
  torneo_vincitore: 10,
  torneo_finalista: 5,
};

/** Punti massimi di una partita: vincitore + set + game esatti + long tie-break. */
export const massimoPartita = (r: Regole) => (r.vincitore ?? 0) + (r.set_esatti ?? 0) + (r.game_errore_0 ?? 0) + (r.long_vicino ?? 0);

/** Punti dei game per errore complessivo (0, 1, 2…), fino al primo errore che non dà più punti. */
export function scalaGame(r: Regole): number[] {
  const scala: number[] = [];
  for (let e = 0; r[`game_errore_${e}`] !== undefined; e++) scala.push(r[`game_errore_${e}`]);
  return scala;
}

/** Punteggi possibili di un set vinto, dal lato di chi lo vince. */
export const SET_VINTI: [number, number][] = [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]];
const SET: [number, number][] = [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]];

/** Game totali possibili (vincitore, perdente) per un risultato in set: 2-0, 2-1 o set unico 1-0. */
export function combinazioniGame(setVinti: number, setPersi: number): Set<string> {
  const c = new Set<string>();
  for (const [v1, p1] of SET) {
    if (setVinti === 1) c.add(`${v1}-${p1}`);
    else
      for (const [v2, p2] of SET) {
        if (setPersi === 0) c.add(`${v1 + v2}-${p1 + p2}`);
        // 2-1: un set vinto (v1-p1), uno perso (p2-v2), super tie-break = 1 game al vincitore
        else c.add(`${v1 + p2 + 1}-${p1 + v2}`);
      }
  }
  return c;
}

export const gamePossibili = (setVinti: number, setPersi: number, vincitore: number, perdente: number) =>
  combinazioniGame(setVinti, setPersi).has(`${vincitore}-${perdente}`);

/** Valori minimi e massimi per i contatori dei game. */
export function limitiGame(setVinti: number, setPersi: number) {
  const coppie = [...combinazioniGame(setVinti, setPersi)].map((x) => x.split("-").map(Number));
  return {
    vincitore: [Math.min(...coppie.map((c) => c[0])), Math.max(...coppie.map((c) => c[0]))] as const,
    perdente: [Math.min(...coppie.map((c) => c[1])), Math.max(...coppie.map((c) => c[1]))] as const,
  };
}

/** Un punteggio tipico da cui partire: 2-0 → 12-6, 2-1 → 11-10, set unico → 6-3. */
export const gameIniziali = (setVinti: number, setPersi: number): [number, number] => (setVinti === 1 ? [6, 3] : setPersi === 0 ? [12, 6] : [11, 10]);

/** Game totali di una partita: set normali + 1 game a chi vince il super tie-break (terzo set al meglio dei 3). */
export function gameTotali(a: number[], b: number[], setPerVincere: number): [number, number] {
  let ga = 0;
  let gb = 0;
  a.forEach((x, i) => {
    if (setPerVincere === 2 && i === 2) {
      ga += x > b[i] ? 1 : 0;
      gb += b[i] > x ? 1 : 0;
    } else {
      ga += x;
      gb += b[i];
    }
  });
  return [ga, gb];
}

/** Long tie-break: chi vince arriva a 10 con 2 di scarto; oltre il 10 vince con esattamente 2 punti di scarto. */
export const puntiVincitoreLong = (perdente: number) => Math.max(10, perdente + 2);

export function tiebreakValido(a: number, b: number): boolean {
  const [hi, lo] = [Math.max(a, b), Math.min(a, b)];
  return hi >= 10 && hi - lo >= 2 && (hi === 10 || hi - lo === 2);
}
