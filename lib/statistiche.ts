// Statistiche calcolate solo dai dati veri (partite concluse e pronostici valutati). Niente stime.
import type { Coppia, Partita, PronosticoPartita, Turno } from "./tipi";
import { TURNI } from "./tipi";

const ordineTurno = (t: Turno) => TURNI.indexOf(t);
const giocataDavvero = (p: Partita) => p.stato === "conclusa" && Boolean(p.game_a?.length && p.game_b?.length);

/** Una partita già giocata da una coppia nel torneo, vista dal suo lato. */
export interface Tappa {
  turno: Turno;
  avversario: Coppia | null;
  punteggio: string; // "6-2 6-1" dal lato della coppia
  vinta: boolean;
  ritiro: boolean;
}

/** Il cammino di una coppia nel tabellone prima di un certo turno: chi ha battuto e come. */
export function cammino(partite: Partita[], coppie: Coppia[], coppiaId: string | null, primaDi: Turno): Tappa[] {
  if (!coppiaId) return [];
  return partite
    .filter((p) => p.stato === "conclusa" && ordineTurno(p.turno) < ordineTurno(primaDi) && (p.coppia_a_id === coppiaId || p.coppia_b_id === coppiaId))
    .sort((x, y) => ordineTurno(x.turno) - ordineTurno(y.turno))
    .map((p) => {
      const sonoA = p.coppia_a_id === coppiaId;
      const miei = (sonoA ? p.game_a : p.game_b) ?? [];
      const loro = (sonoA ? p.game_b : p.game_a) ?? [];
      return {
        turno: p.turno,
        avversario: coppie.find((c) => c.id === (sonoA ? p.coppia_b_id : p.coppia_a_id)) ?? null,
        punteggio: miei.map((g, i) => `${g}-${loro[i] ?? 0}`).join(" "),
        vinta: p.vincitore_id === coppiaId,
        ritiro: p.ritiro,
      };
    });
}

export interface StatisticheTorneo {
  giocate: number;
  dueZero: number;
  dueUno: number;
  ritiri: number;
  gameMedi: number | null; // game per partita nei primi due set
  longPiuLungo: { punteggio: string; partita: Partita } | null;
  sorprese: { vincitore: Coppia | null; perdente: Coppia; turno: Turno }[]; // teste di serie battute da chi era dietro o senza testa
}

export function statisticheTorneo(partite: Partita[], coppie: Coppia[]): StatisticheTorneo {
  const coppia = (id: string | null) => coppie.find((c) => c.id === id) ?? null;
  const vere = partite.filter(giocataDavvero).filter((p) => !p.ritiro && p.set_per_vincere === 2);
  const dueUno = vere.filter((p) => p.game_a!.length >= 3);
  const game = vere.map((p) => p.game_a!.slice(0, 2).reduce((s, x) => s + x, 0) + p.game_b!.slice(0, 2).reduce((s, x) => s + x, 0));
  let longPiuLungo: StatisticheTorneo["longPiuLungo"] = null;
  for (const p of dueUno) {
    const a = p.game_a![2];
    const b = p.game_b![2];
    if (!longPiuLungo || a + b > longPiuLungo.punteggio.split("-").reduce((s, x) => s + Number(x), 0)) longPiuLungo = { punteggio: `${Math.max(a, b)}-${Math.min(a, b)}`, partita: p };
  }
  const sorprese: StatisticheTorneo["sorprese"] = [];
  for (const p of partite.filter((x) => x.stato === "conclusa" && x.vincitore_id).sort((x, y) => ordineTurno(x.turno) - ordineTurno(y.turno))) {
    const perdente = coppia(p.vincitore_id === p.coppia_a_id ? p.coppia_b_id : p.coppia_a_id);
    const vincitore = coppia(p.vincitore_id);
    if (!perdente?.testa_di_serie) continue;
    if (!vincitore?.testa_di_serie || vincitore.testa_di_serie > perdente.testa_di_serie) sorprese.push({ vincitore, perdente, turno: p.turno });
  }
  return {
    giocate: partite.filter((p) => p.stato === "conclusa").length,
    dueZero: vere.length - dueUno.length,
    dueUno: dueUno.length,
    ritiri: partite.filter((p) => p.stato === "conclusa" && p.ritiro).length,
    gameMedi: game.length ? Math.round((game.reduce((s, x) => s + x, 0) / game.length) * 10) / 10 : null,
    longPiuLungo,
    sorprese,
  };
}

/** Statistiche personali sui pronostici già valutati (partite concluse), in ordine di data. */
export interface StatistichePersonali {
  valutati: number;
  media: number | null;
  vincitori: number;
  setVinti: number; // 2-0/2-1 indovinati
  setEsatti: number; // singoli set con i game esatti
  longEsatti: number;
  serieAttuale: number; // vincitori indovinati di fila, dall'ultima partita
  serieMigliore: number;
  migliore: { partitaId: string; punti: number } | null;
}

export function statistichePersonali(voci: { partita: Pick<Partita, "id" | "inizio_at" | "game_a" | "game_b" | "set_per_vincere" | "ritiro">; mio: PronosticoPartita }[]): StatistichePersonali {
  const v = voci.filter((x) => x.mio.punti != null).sort((x, y) => x.partita.inizio_at.localeCompare(y.partita.inizio_at));
  let serie = 0;
  let serieMigliore = 0;
  let setEsatti = 0;
  let longEsatti = 0;
  let migliore: StatistichePersonali["migliore"] = null;
  for (const { partita: p, mio } of v) {
    serie = (mio.punti_vincitore ?? 0) > 0 ? serie + 1 : 0;
    serieMigliore = Math.max(serieMigliore, serie);
    if (!migliore || (mio.punti ?? 0) > migliore.punti) migliore = { partitaId: p.id, punti: mio.punti ?? 0 };
    if (p.ritiro || !p.game_a || !p.game_b || !mio.game_a || !mio.game_b) continue;
    for (let i = 0; i < p.set_per_vincere; i++) if (mio.game_a[i] === p.game_a[i] && mio.game_b[i] === p.game_b[i]) setEsatti++;
    if (p.game_a.length >= 3 && mio.game_a[2] === p.game_a[2] && mio.game_b[2] === p.game_b[2]) longEsatti++;
  }
  const totale = v.reduce((s, x) => s + (x.mio.punti ?? 0), 0);
  return {
    valutati: v.length,
    media: v.length ? Math.round((totale / v.length) * 10) / 10 : null,
    vincitori: v.filter((x) => (x.mio.punti_vincitore ?? 0) > 0).length,
    setVinti: v.filter((x) => (x.mio.punti_set ?? 0) > 0).length,
    setEsatti,
    longEsatti,
    serieAttuale: serie,
    serieMigliore,
    migliore: migliore && migliore.punti > 0 ? migliore : null,
  };
}
