import { describe, expect, it } from "vitest";
import { puntiVincitoreLong, setValido, tiebreakValido, combinazioniGame, gamePossibili, gameTotali, limitiGame, massimo20, massimo21, massimoPartita, REGOLE_PREDEFINITE } from "@/lib/punti";

describe("regolamento", () => {
  it("long tie-break", () => {
    expect(puntiVincitoreLong(8)).toBe(10);
    expect(puntiVincitoreLong(11)).toBe(13);
    expect(tiebreakValido(10, 8)).toBe(true);
    expect(tiebreakValido(12, 10)).toBe(true);
    expect(tiebreakValido(10, 9)).toBe(false);
    expect(tiebreakValido(13, 9)).toBe(false);
    expect(tiebreakValido(50, 48)).toBe(true);
    expect(tiebreakValido(51, 49)).toBe(false);
  });
  it("set validi", () => {
    expect(setValido(6, 4)).toBe(true);
    expect(setValido(7, 6)).toBe(true);
    expect(setValido(6, 5)).toBe(false);
    expect(setValido(7, 3)).toBe(false);
    expect(setValido(0, 0)).toBe(false);
  });
  it("massimo 14 punti con un 2-0 e 16 con un 2-1", () => {
    expect(massimo20(REGOLE_PREDEFINITE)).toBe(14);
    expect(massimo21(REGOLE_PREDEFINITE)).toBe(16);
    expect(massimoPartita(REGOLE_PREDEFINITE)).toBe(16);
  });
  it("super tie-break = 1 game a chi lo vince", () => {
    expect(gameTotali([6, 3, 10], [4, 6, 7], 2)).toEqual([10, 10]);
    expect(gameTotali([6, 3, 10], [4, 6, 7], 2)).toEqual([10, 10]);
    expect(gameTotali([4, 6, 10], [6, 3, 7], 2)).toEqual([11, 9]);
    expect(gameTotali([6, 6], [4, 3], 2)).toEqual([12, 7]);
  });
  it("game possibili (come game_possibili nel database)", () => {
    expect(gamePossibili(2, 0, 12, 8)).toBe(true);
    expect(gamePossibili(2, 1, 10, 10)).toBe(true);
    expect(gamePossibili(2, 0, 7, 10)).toBe(false);
    expect(gamePossibili(2, 1, 15, 3)).toBe(false);
    expect(gamePossibili(1, 0, 6, 4)).toBe(true);
    expect(gamePossibili(1, 0, 6, 5)).toBe(false);
  });
  it("limiti dei contatori", () => {
    expect(limitiGame(2, 0)).toEqual({ vincitore: [12, 14], perdente: [0, 12] });
    expect(combinazioniGame(2, 1).has("11-10")).toBe(true);
  });
});
