// Trofei e medaglie: si calcolano dai pronostici e dalle classifiche vere, niente da salvare a parte.
// Ogni trofeo ha tre livelli (bronzo, argento, oro): si vede quanto manca al prossimo.
import type { Coppia, Partita, PronosticoPartita } from "./tipi";

export type Livello = 0 | 1 | 2 | 3; // 0 = non ancora, 1 bronzo, 2 argento, 3 oro
export type IdTrofeo = "esordio" | "fedelissimo" | "serie" | "occhio" | "long" | "perfetta" | "fiuto" | "giramondo" | "campione" | "podio";

export interface Trofeo {
  id: IdTrofeo;
  valore: number;
  soglie: [number, number, number];
  livello: Livello;
  prossima: number | null; // soglia del prossimo livello, null se è già oro
}

const SOGLIE: Record<IdTrofeo, [number, number, number]> = {
  esordio: [1, 1, 1],
  fedelissimo: [10, 50, 100],
  serie: [3, 5, 10],
  occhio: [1, 5, 20],
  long: [1, 3, 10],
  perfetta: [1, 3, 10],
  fiuto: [1, 3, 10],
  giramondo: [3, 10, 25],
  campione: [1, 3, 6],
  podio: [1, 3, 6],
};

type Voce = {
  partita: Pick<Partita, "id" | "inizio_at" | "game_a" | "game_b" | "set_per_vincere" | "ritiro" | "vincitore_id" | "coppia_a_id" | "coppia_b_id"> & {
    coppia_a: Pick<Coppia, "testa_di_serie"> | null;
    coppia_b: Pick<Coppia, "testa_di_serie"> | null;
    tabellone: { torneo: { id: string } };
  };
  mio: PronosticoPartita;
};

export interface Medaglie {
  oro: number;
  argento: number;
  bronzo: number;
}

/** Vincitore che batte una testa di serie migliore (o senza essere testa di serie). */
export function eSorpresa(p: Voce["partita"]): boolean {
  if (!p.vincitore_id) return false;
  const vinceA = p.vincitore_id === p.coppia_a_id;
  const v = vinceA ? p.coppia_a : p.coppia_b;
  const per = vinceA ? p.coppia_b : p.coppia_a;
  if (!per?.testa_di_serie) return false;
  return !v?.testa_di_serie || v.testa_di_serie > per.testa_di_serie;
}

/** Tutto giusto: vincitore, set vinti, game di ogni set e, se c'è stato, il long. */
export function ePerfetta(p: Voce["partita"], mio: PronosticoPartita): boolean {
  if (p.ritiro || !p.game_a || !p.game_b || !mio.game_a || !mio.game_b) return false;
  if ((mio.punti_vincitore ?? 0) <= 0 || (mio.punti_set ?? 0) <= 0) return false;
  if (p.game_a.length !== mio.game_a.length) return false;
  return p.game_a.every((x, i) => x === mio.game_a![i] && p.game_b![i] === mio.game_b![i]);
}

export function calcolaTrofei(voci: Voce[], medaglie: Medaglie): Trofeo[] {
  const valutate = voci.filter((x) => x.mio.punti != null).sort((x, y) => x.partita.inizio_at.localeCompare(y.partita.inizio_at));
  let serie = 0;
  let serieMax = 0;
  let occhio = 0;
  let long = 0;
  for (const { partita: p, mio } of valutate) {
    serie = (mio.punti_vincitore ?? 0) > 0 ? serie + 1 : 0;
    serieMax = Math.max(serieMax, serie);
    if (p.ritiro || !p.game_a || !p.game_b || !mio.game_a || !mio.game_b) continue;
    for (let i = 0; i < Math.min(2, p.set_per_vincere); i++) if (mio.game_a[i] === p.game_a[i] && mio.game_b[i] === p.game_b[i]) occhio++;
    if (p.game_a.length >= 3 && mio.game_a[2] === p.game_a[2] && mio.game_b[2] === p.game_b[2]) long++;
  }
  const valori: Record<IdTrofeo, number> = {
    esordio: voci.length,
    fedelissimo: voci.length,
    serie: serieMax,
    occhio,
    long,
    perfetta: valutate.filter((x) => ePerfetta(x.partita, x.mio)).length,
    fiuto: valutate.filter((x) => (x.mio.punti_vincitore ?? 0) > 0 && eSorpresa(x.partita)).length,
    giramondo: new Set(voci.map((x) => x.partita.tabellone.torneo.id)).size,
    campione: medaglie.oro,
    podio: medaglie.oro + medaglie.argento + medaglie.bronzo,
  };
  return (Object.keys(SOGLIE) as IdTrofeo[]).map((id) => {
    const soglie = SOGLIE[id];
    const valore = valori[id];
    const livello = (id === "esordio" ? (valore >= 1 ? 3 : 0) : soglie.filter((s) => valore >= s).length) as Livello;
    return { id, valore, soglie, livello, prossima: livello >= 3 ? null : (soglie[livello as 0 | 1 | 2] ?? null) };
  });
}

/** Medaglie dei mesi chiusi a partire dalle classifiche (primi tre) di ogni mese. */
export function medagliePerUtente(podi: { utente_id: string; posizione: number }[][]): Map<string, Medaglie> {
  const m = new Map<string, Medaglie>();
  for (const podio of podi)
    for (const r of podio) {
      const x = m.get(r.utente_id) ?? { oro: 0, argento: 0, bronzo: 0 };
      if (r.posizione === 1) x.oro++;
      else if (r.posizione === 2) x.argento++;
      else if (r.posizione === 3) x.bronzo++;
      m.set(r.utente_id, x);
    }
  return m;
}
