import { describe, expect, it } from "vitest";
import { cammino, statistichePersonali, statisticheTorneo } from "@/lib/statistiche";
import type { Coppia, Partita, PronosticoPartita } from "@/lib/tipi";

const g = (id: string) => ({ id, nome: id, cognome: id, paese: "BR" });
const c = (id: string, seme: number | null = null): Coppia => ({ id, tabellone_id: "t", testa_di_serie: seme, g1: g(id + "1"), g2: g(id + "2") });
const coppie = [c("A", 1), c("B"), c("C", 4), c("D")];
const P = (o: Partial<Partita>): Partita => ({ id: Math.random().toString(), tabellone_id: "t", turno: "QF", ordine: 1, coppia_a_id: null, coppia_b_id: null, inizio_at: "2026-11-05T12:00:00Z", set_per_vincere: 2, stato: "conclusa", game_a: null, game_b: null, ritiro: false, vincitore_id: null, ...o });
const partite = [
  P({ turno: "QF", ordine: 1, coppia_a_id: "A", coppia_b_id: "B", game_a: [6, 6], game_b: [2, 1], vincitore_id: "A" }),
  P({ turno: "QF", ordine: 2, coppia_a_id: "C", coppia_b_id: "D", game_a: [6, 3, 9], game_b: [4, 6, 11], vincitore_id: "D" }),
  P({ turno: "SF", ordine: 1, coppia_a_id: "A", coppia_b_id: "D", stato: "in_programma" }),
];

describe("statistiche", () => {
  it("cammino dal lato della coppia", () => {
    const d = cammino(partite, coppie, "D", "SF");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ turno: "QF", punteggio: "4-6 6-3 11-9", vinta: true });
    expect(d[0].avversario?.id).toBe("C");
  });

  it("torneo: 2-0, 2-1, long più lungo e sorprese", () => {
    const s = statisticheTorneo(partite, coppie);
    expect(s).toMatchObject({ giocate: 2, dueZero: 1, dueUno: 1, gameMedi: 17 });
    expect(s.longPiuLungo?.punteggio).toBe("11-9");
    expect(s.sorprese.map((x) => x.perdente.id)).toEqual(["C"]);
  });

  it("personali: serie, set esatti, miglior partita", () => {
    const mio = (o: Partial<PronosticoPartita>): PronosticoPartita => ({ id: "x", partita_id: "x", vincitore_id: "A", set_vincitore: 2, set_perdente: 0, totale_game: null, game_a: null, game_b: null, game_previsti_a: null, game_previsti_b: null, punti_vincitore: 3, punti_set: 0, punti_game: 0, punti_long: 0, errore_game: null, punti: 3, ...o });
    const s = statistichePersonali([
      { partita: { ...partite[0], inizio_at: "2026-11-05T10:00:00Z" }, mio: mio({ game_a: [6, 6], game_b: [2, 3], punti: 14 }) },
      { partita: { ...partite[1], inizio_at: "2026-11-05T11:00:00Z" }, mio: mio({ punti_vincitore: 0, punti: 0 }) },
      { partita: { ...partite[0], id: "z", inizio_at: "2026-11-06T10:00:00Z" }, mio: mio({ punti: 3 }) },
    ]);
    expect(s).toMatchObject({ valutati: 3, vincitori: 2, setEsatti: 1, serieAttuale: 1, serieMigliore: 1, media: 5.7 });
    expect(s.migliore?.punti).toBe(14);
  });
});
