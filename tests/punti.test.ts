import { describe, expect, it } from "vitest";
import { dettaglioPunti, puntiSet, setValido } from "@/lib/punti";

describe("punti", () => {
  it("set validi", () => {
    expect(setValido(6, 4)).toBe(true);
    expect(setValido(7, 6)).toBe(true);
    expect(setValido(6, 5)).toBe(false);
    expect(setValido(7, 3)).toBe(false);
  });
  it("vicinanza di un set (come nel database)", () => {
    expect(puntiSet(6, 3, 6, 4)).toBe(3);
    expect(puntiSet(6, 2, 6, 4)).toBe(1);
    expect(puntiSet(6, 4, 4, 6)).toBe(0);
    expect(puntiSet(7, 6, 7, 6)).toBe(5);
  });
  const finale = { vincitore_id: "A", coppia_a_id: "A", game_a: [6, 3, 10], game_b: [4, 6, 7], ritiro: false, set_per_vincere: 2 };
  it("dettaglio 2-1 vicino (19 punti come nel test del database)", () => {
    expect(dettaglioPunti({ vincitore_id: "A", game_a: [6, 4], game_b: [3, 6], set_perdente: 1, punti: 19 }, finale)).toEqual({ vincitore: 8, set: 5, perSet: [3, 3], esatto: 0 });
  });
  it("risultato esatto", () => {
    expect(dettaglioPunti({ vincitore_id: "A", game_a: [6, 3], game_b: [4, 6], set_perdente: 1, punti: 33 }, finale)).toEqual({ vincitore: 8, set: 5, perSet: [5, 5], esatto: 10 });
  });
  it("vincitore sbagliato", () => {
    expect(dettaglioPunti({ vincitore_id: "B", game_a: [4, 6], game_b: [6, 3], set_perdente: 1, punti: 0 }, finale)?.vincitore).toBe(0);
  });
});
