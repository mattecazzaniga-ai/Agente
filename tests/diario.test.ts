import { describe, expect, it } from "vitest";
import { diarioTorneo } from "@/lib/diario";
import type { Coppia, Partita, Tabellone, Torneo } from "@/lib/tipi";

const g = (id: string) => ({ id, nome: id, cognome: id, paese: "BR" });
const c = (id: string, seme: number | null = null): Coppia => ({ id, tabellone_id: "t", testa_di_serie: seme, g1: g(id + "1"), g2: g(id + "2") });
const coppie = [c("A", 1), c("B"), c("C", 2), c("D"), c("E"), c("F"), c("G"), c("H")];
const P = (o: Partial<Partita>): Partita => ({ id: Math.random().toString(), tabellone_id: "t", turno: "QF", ordine: 1, coppia_a_id: null, coppia_b_id: null, inizio_at: "2026-11-06T12:00:00Z", set_per_vincere: 2, stato: "conclusa", game_a: null, game_b: null, ritiro: false, vincitore_id: null, ...o });
const torneo = { id: "x", nome: "BT200 Prova" } as Torneo;

describe("diario dei tornei", () => {
  it("semifinali definite, imbattuti, sorprese e long tirati", () => {
    const partite = [
      P({ turno: "R16", ordine: 1, coppia_a_id: "A", coppia_b_id: "E", game_a: [6, 6], game_b: [1, 2], vincitore_id: "A", inizio_at: "2026-11-05T12:00:00Z" }),
      P({ turno: "QF", ordine: 1, coppia_a_id: "A", coppia_b_id: "B", game_a: [6, 6], game_b: [2, 3], vincitore_id: "A" }),
      P({ turno: "QF", ordine: 2, coppia_a_id: "C", coppia_b_id: "D", game_a: [6, 3, 9], game_b: [4, 6, 11], vincitore_id: "D" }),
      P({ turno: "SF", ordine: 1, coppia_a_id: "A", coppia_b_id: "D", stato: "in_programma", inizio_at: "2026-11-08T12:00:00Z" }),
    ];
    const tb = { id: "t", torneo_id: "x", genere: "maschile", coppie, partite } as unknown as Tabellone;
    const voci = diarioTorneo(torneo, [tb]);
    const tipi = voci.map((v) => v.tipo);
    expect(tipi).toContain("turno");
    expect(voci.find((v) => v.tipo === "turno")?.sfide?.[0].map((x) => x?.id)).toEqual(["A", "D"]);
    expect(voci.find((v) => v.tipo === "imbattuti")?.coppie[0]?.id).toBe("A");
    expect(voci.find((v) => v.tipo === "sorpresa")).toMatchObject({ testa: 2, punteggio: "4-6 6-3 11-9" });
    expect(voci.find((v) => v.tipo === "long")?.punteggio).toBe("4-6 6-3 11-9");
    expect(tipi).not.toContain("campioni");
  });

  it("finale giocata: i campioni", () => {
    const partite = [P({ turno: "F", ordine: 1, coppia_a_id: "A", coppia_b_id: "D", game_a: [3, 4], game_b: [6, 6], vincitore_id: "D" })];
    const tb = { id: "t", torneo_id: "x", genere: "femminile", coppie, partite } as unknown as Tabellone;
    expect(diarioTorneo(torneo, [tb])[0]).toMatchObject({ tipo: "campioni", punteggio: "6-3 6-4" });
  });
});
