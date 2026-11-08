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

import { istanteRoma, stagioneAttuale } from "@/lib/formato";
describe("stagioni", () => {
  it("fine giornata in ora italiana, inverno ed estate", () => {
    expect(istanteRoma("2026-12-31", true)).toBe("2026-12-31T22:59:59.000Z");
    expect(istanteRoma("2026-07-31", true)).toBe("2026-07-31T21:59:59.000Z");
  });
  it("stagione in corso o prossima", () => {
    const el = [{ inizio: "2027-01-01", fine: "2027-03-31" }, { inizio: "2026-11-01", fine: "2026-12-31" }];
    expect(stagioneAttuale(el, "2026-11-08")).toMatchObject({ stato: "in_corso", stagione: el[1] });
    expect(stagioneAttuale(el, "2026-12-31")?.stato).toBe("in_corso");
    expect(stagioneAttuale(el, "2027-01-01")?.stagione).toBe(el[0]);
    expect(stagioneAttuale([el[0]], "2026-11-08")?.stato).toBe("prossima");
    expect(stagioneAttuale([el[1]], "2027-05-01")).toBeNull();
  });
});
