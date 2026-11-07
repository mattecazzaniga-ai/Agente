import { describe, expect, it } from "vitest";
import { REGOLE_PREDEFINITE, recapPronostico } from "@/lib/punti";

const nome = (id: string | null) => (id === "A" ? "Rossi/Bianchi" : id === "B" ? "Verdi/Neri" : null);
const partita = { stato: "conclusa", vincitore_id: "A", game_a: [6, 6], game_b: [4, 2], ritiro: false, set_per_vincere: 2 };

describe("recapPronostico", () => {
  it("l'esempio delle regole: 6-4 6-3 contro 6-4 6-2 fa 13", () => {
    const mio = { vincitore_id: "A", set_vincitore: 2, set_perdente: 0, game_a: [6, 6], game_b: [4, 3], punti_vincitore: 3, punti_set: 5, punti_long: 0 };
    const righe = recapPronostico(REGOLE_PREDEFINITE, mio, partita, nome);
    expect(righe.map((r) => [r.voce, r.tuo, r.reale, r.punti, r.esito])).toEqual([
      ["chiVince", "Rossi/Bianchi", "Rossi/Bianchi", 3, "giusto"],
      ["comeFinisce", "2-0", "2-0", 5, "giusto"],
      ["set", "6-4", "6-4", 3, "esatto"],
      ["set", "6-3", "6-2", 2, "differenza"],
    ]);
    expect(righe.reduce((t, r) => t + (r.punti ?? 0), 0)).toBe(13);
  });

  it("vincitore sbagliato: i set contano lo stesso, i set vinti no", () => {
    const mio = { vincitore_id: "B", set_vincitore: 2, set_perdente: 1, game_a: [6, 3, 8], game_b: [4, 6, 10], punti_vincitore: 0, punti_set: 0, punti_long: 0 };
    const righe = recapPronostico(REGOLE_PREDEFINITE, mio, partita, nome);
    expect(righe[1].esito).toBe("soloSeVince");
    expect(righe[2].punti).toBe(3);
    expect(righe[3]).toMatchObject({ punti: 0, esito: "troppo" });
    expect(righe[4]).toMatchObject({ voce: "long", tuo: "8-10", reale: null, esito: "noLong" });
  });

  it("prima della fine mostra solo il pronostico", () => {
    const mio = { vincitore_id: "A", set_vincitore: 2, set_perdente: 0, game_a: [6, 6], game_b: [4, 3] };
    const righe = recapPronostico(REGOLE_PREDEFINITE, mio, { ...partita, stato: "in_corso", vincitore_id: null }, nome);
    expect(righe.every((r) => r.punti === null && r.reale === null)).toBe(true);
  });
});
