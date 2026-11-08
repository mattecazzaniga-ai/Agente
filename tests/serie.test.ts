import { describe, expect, it } from "vitest";
import { calcolaSerie, giorno } from "@/lib/serie";

const gara = ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-20", "2026-11-21"];

describe("serie di giornate", () => {
  it("conta le giornate di gara consecutive; i giorni senza partite non spezzano", () => {
    const s = calcolaSerie(gara, ["2026-11-07", "2026-11-08", "2026-11-20", "2026-11-21"], "2026-11-21", false);
    expect(s).toMatchObject({ attuale: 4, migliore: 4, fattaOggi: true, inPericolo: false });
  });

  it("una giornata saltata la azzera", () => {
    const s = calcolaSerie(gara, ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-21"], "2026-11-21", false);
    expect(s).toMatchObject({ attuale: 1, migliore: 3 });
  });

  it("oggi non hai ancora giocato ma puoi: serie in pericolo, non persa", () => {
    const s = calcolaSerie(gara, ["2026-11-08", "2026-11-20"], "2026-11-21", true);
    expect(s).toMatchObject({ attuale: 2, inPericolo: true, fattaOggi: false });
    expect(calcolaSerie(gara, ["2026-11-08", "2026-11-20"], "2026-11-21", false).attuale).toBe(0);
  });

  it("giorno in ora italiana", () => {
    expect(giorno("2026-11-07T23:30:00Z")).toBe("2026-11-08");
  });
});
