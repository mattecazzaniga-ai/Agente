// Regolamento dei pronostici: le stesse regole del database (calcola_punti_partita, game_possibili),
// qui per la scheda del pronostico e per spiegare i punti. I valori veri stanno nella tabella regole_punti:
// REGOLE_PREDEFINITE serve solo se non si riescono a leggere.

export type Regole = Record<string, number>;

export const REGOLE_PREDEFINITE: Regole = {
  vincitore: 3,
  set_esatti: 4, // risultato in set giusto quando finisce 2-1 (o set unico)
  set_esatti_2_0: 5, // quando finisce 2-0: un punto in più
  set_errore_0: 3,
  set_errore_1: 2,
  set_errore_2: 1,
  long_errore_0: 3,
  long_errore_1: 2,
  long_errore_2: 1,
  torneo_vincitore: 10,
  torneo_finalista: 5,
};

/** Punti massimi: con un 2-0 (vincitore + risultato 2-0 + due set esatti) e con un 2-1 (+ il long esatto). */
export const massimo20 = (r: Regole) => (r.vincitore ?? 0) + (r.set_esatti_2_0 ?? 0) + 2 * (r.set_errore_0 ?? 0);
export const massimo21 = (r: Regole) => (r.vincitore ?? 0) + (r.set_esatti ?? 0) + 2 * (r.set_errore_0 ?? 0) + (r.long_errore_0 ?? 0);
export const massimoPartita = (r: Regole) => Math.max(massimo20(r), massimo21(r));

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
  return lo >= 0 && hi <= 50 && hi >= 10 && hi - lo >= 2 && (hi === 10 || hi - lo === 2);
}

/** Un set finito: 6-0…6-4, 7-5, 7-6 (come set_valido nel database). */
export function setValido(a: number, b: number): boolean {
  const [hi, lo] = [Math.max(a, b), Math.min(a, b)];
  return lo >= 0 && ((hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6)));
}

/** Una riga del riepilogo "il tuo pronostico / com'è finita": cosa avevi messo, cos'è successo, quanti punti. */
export interface RigaRecap {
  voce: "chiVince" | "comeFinisce" | "set" | "long";
  numero?: number; // per i set: 1 o 2
  tuo: string | null;
  reale: string | null;
  punti: number | null; // null finché la partita non è conclusa
  esito: "giusto" | "sbagliato" | "esatto" | "differenza" | "troppo" | "soloSeVince" | "noLong" | null;
  differenza?: number;
}

const coppiaPunteggio = (a?: number | null, b?: number | null) => (a == null || b == null ? null : `${a}-${b}`);

/**
 * Riepilogo voce per voce, con le stesse regole del database (calcola_punti_partita).
 * I game dei set sono sempre nell'ordine coppia A - coppia B, come nella scheda.
 */
export function recapPronostico(
  r: Regole,
  mio: { vincitore_id: string; set_vincitore: number | null; set_perdente: number | null; game_a: number[] | null; game_b: number[] | null; punti_vincitore?: number | null; punti_set?: number | null; punti_long?: number | null },
  p: { stato: string; vincitore_id: string | null; game_a: number[] | null; game_b: number[] | null; ritiro: boolean; set_per_vincere: number },
  nome: (id: string | null) => string | null,
): RigaRecap[] {
  const conclusa = p.stato === "conclusa";
  const ga = p.game_a ?? [];
  const gb = p.game_b ?? [];
  const righe: RigaRecap[] = [];
  const vinceGiusto = conclusa && mio.vincitore_id === p.vincitore_id;

  righe.push({
    voce: "chiVince",
    tuo: nome(mio.vincitore_id),
    reale: conclusa ? nome(p.vincitore_id) : null,
    punti: conclusa ? (mio.punti_vincitore ?? (vinceGiusto ? r.vincitore ?? 0 : 0)) : null,
    esito: conclusa ? (vinceGiusto ? "giusto" : "sbagliato") : null,
  });

  if (p.set_per_vincere === 2 || (mio.punti_set ?? 0) > 0) {
    let vintiA = 0;
    let vintiB = 0;
    ga.forEach((x, i) => (x > (gb[i] ?? 0) ? vintiA++ : vintiB++));
    const realeSet = conclusa && !p.ritiro && ga.length ? `${Math.max(vintiA, vintiB)}-${Math.min(vintiA, vintiB)}` : null;
    const tuoSet = coppiaPunteggio(mio.set_vincitore, mio.set_perdente);
    righe.push({
      voce: "comeFinisce",
      tuo: tuoSet,
      reale: realeSet,
      punti: conclusa ? (mio.punti_set ?? 0) : null,
      esito: !conclusa || p.ritiro ? null : !vinceGiusto ? "soloSeVince" : tuoSet === realeSet ? "giusto" : "sbagliato",
    });
  }

  for (let i = 0; i < p.set_per_vincere; i++) {
    const tuo = coppiaPunteggio(mio.game_a?.[i], mio.game_b?.[i]);
    const reale = conclusa ? coppiaPunteggio(ga[i], gb[i]) : null;
    let punti: number | null = null;
    let esito: RigaRecap["esito"] = null;
    let differenza: number | undefined;
    if (conclusa) {
      if (p.ritiro || tuo == null || reale == null) punti = 0;
      else {
        differenza = Math.abs(mio.game_a![i] - ga[i]) + Math.abs(mio.game_b![i] - gb[i]);
        punti = r[`set_errore_${differenza}`] ?? 0;
        esito = differenza === 0 ? "esatto" : punti > 0 ? "differenza" : "troppo";
      }
    }
    righe.push({ voce: "set", numero: i + 1, tuo, reale, punti, esito, differenza });
  }

  if (p.set_per_vincere === 2) {
    const tuo = coppiaPunteggio(mio.game_a?.[2], mio.game_b?.[2]);
    const giocato = ga.length >= 3;
    const reale = conclusa && giocato ? coppiaPunteggio(ga[2], gb[2]) : null;
    if (tuo || giocato) {
      let esito: RigaRecap["esito"] = null;
      let differenza: number | undefined;
      if (conclusa && !p.ritiro) {
        if (!giocato) esito = "noLong";
        else if (tuo) {
          differenza = Math.abs(mio.game_a![2] - ga[2]) + Math.abs(mio.game_b![2] - gb[2]);
          esito = differenza === 0 ? "esatto" : (r[`long_errore_${differenza}`] ?? 0) > 0 ? "differenza" : "troppo";
        }
      }
      righe.push({ voce: "long", tuo, reale, punti: conclusa ? (mio.punti_long ?? 0) : null, esito, differenza });
    }
  }
  return righe;
}
