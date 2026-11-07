import { describe, expect, it } from "vitest";
import { calcolaTrofei, eSorpresa, medagliePerUtente } from "@/lib/trofei";
import type { PronosticoPartita } from "@/lib/tipi";

const partita = (o: Record<string, unknown> = {}) => ({
  id: "p", inizio_at: "2026-11-05T10:00:00Z", game_a: [6, 6], game_b: [3, 4], set_per_vincere: 2, ritiro: false, vincitore_id: "A", coppia_a_id: "A", coppia_b_id: "B",
  coppia_a: { testa_di_serie: null }, coppia_b: { testa_di_serie: 2 }, tabellone: { torneo: { id: "t1" } }, ...o,
}) as never;
const mio = (o: Partial<PronosticoPartita> = {}): PronosticoPartita => ({ id: "m", partita_id: "p", vincitore_id: "A", set_vincitore: 2, set_perdente: 0, totale_game: null, game_a: [6, 6], game_b: [3, 4], game_previsti_a: null, game_previsti_b: null, punti_vincitore: 3, punti_set: 5, punti_game: 6, punti_long: 0, errore_game: 0, punti: 14, ...o });

describe("trofei", () => {
  it("partita perfetta, sorpresa e occhio di falco", () => {
    const t = Object.fromEntries(calcolaTrofei([{ partita: partita(), mio: mio() }], { oro: 0, argento: 0, bronzo: 0 }).map((x) => [x.id, x]));
    expect(eSorpresa(partita())).toBe(true);
    expect(t.esordio.livello).toBe(3);
    expect(t.perfetta).toMatchObject({ valore: 1, livello: 1, prossima: 3 });
    expect(t.fiuto.valore).toBe(1);
    expect(t.occhio.valore).toBe(2);
    expect(t.fedelissimo).toMatchObject({ livello: 0, prossima: 10 });
  });

  it("serie di vincitori e medaglie dei mesi", () => {
    const voci = [1, 2, 3, 4].map((i) => ({ partita: partita({ id: `p${i}`, inizio_at: `2026-11-0${i}T10:00:00Z` }), mio: mio({ punti_vincitore: i === 1 ? 0 : 3 }) }));
    const t = Object.fromEntries(calcolaTrofei(voci, { oro: 1, argento: 1, bronzo: 0 }).map((x) => [x.id, x]));
    expect(t.serie).toMatchObject({ valore: 3, livello: 1 });
    expect(t.campione.livello).toBe(1);
    expect(t.podio.valore).toBe(2);
    const m = medagliePerUtente([[{ utente_id: "u", posizione: 1 }, { utente_id: "v", posizione: 2 }], [{ utente_id: "u", posizione: 3 }]]);
    expect(m.get("u")).toEqual({ oro: 1, argento: 0, bronzo: 1 });
  });
});
