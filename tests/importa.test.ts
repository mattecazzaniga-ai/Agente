import { describe, expect, it } from "vitest";
import { costruisciPrimoTurno, leggiEntryList, leggiGiocatore } from "@/lib/importa";
import { leggiPunteggio } from "@/lib/punteggio";
import { bandiera, meseIso, punteggio, ultimiMesi } from "@/lib/formato";

describe("leggiGiocatore", () => {
  it("capisce i formati più comuni", () => {
    expect(leggiGiocatore("Andrea Ricci (ITA)")).toEqual({ nome: "Andrea", cognome: "Ricci", paese: "IT" });
    expect(leggiGiocatore("RICCI Andrea ITA")).toEqual({ nome: "Andrea", cognome: "Ricci", paese: "IT" });
    expect(leggiGiocatore("Ricci, Andrea (BR)")).toEqual({ nome: "Andrea", cognome: "Ricci", paese: "BR" });
    expect(leggiGiocatore("DE LA FUENTE Maria José ESP")).toEqual({ nome: "Maria José", cognome: "De La Fuente", paese: "ES" });
    expect(leggiGiocatore("João Silva")).toEqual({ nome: "João", cognome: "Silva", paese: null });
    expect(leggiGiocatore("Solo")).toBeNull();
  });
});

describe("leggiEntryList", () => {
  it("legge coppie, teste di serie, BYE e CSV; segnala le righe sbagliate", () => {
    const l = leggiEntryList(`# tabellone maschile
1. Andrea Ricci (ITA) / Paolo Neri (ITA)
BYE
SILVA João BRA / COSTA Pedro BRA
João;Souza;BRA;Rafa;Lima;BRA;2
riga senza senso`);
    expect(l.posti).toHaveLength(4);
    expect(l.posti[0]).toMatchObject({ testa_di_serie: 1, g1: { cognome: "Ricci" }, g2: { cognome: "Neri", paese: "IT" } });
    expect(l.posti[1]).toBeNull();
    expect(l.posti[2]).toMatchObject({ g1: { nome: "João", cognome: "Silva", paese: "BR" } });
    expect(l.posti[3]).toMatchObject({ testa_di_serie: 2, g2: { nome: "Rafa", cognome: "Lima" } });
    expect(l.errori).toEqual([{ riga: 6, testo: "riga senza senso" }]);
  });
});

describe("costruisciPrimoTurno", () => {
  const c = (n: number) => ({ testa_di_serie: null, g1: { nome: "A", cognome: `A${n}`, paese: null }, g2: { nome: "B", cognome: `B${n}`, paese: null } });
  it("8 coppie: quarti di finale 1-2, 3-4…", () => {
    const t = costruisciPrimoTurno([1, 2, 3, 4, 5, 6, 7, 8].map(c));
    expect(t).toMatchObject({ turno: "QF", dimensione: 8 });
    if ("errore" in t) throw new Error();
    expect(t.partite).toEqual([
      { ordine: 1, a: 0, b: 1 },
      { ordine: 2, a: 2, b: 3 },
      { ordine: 3, a: 4, b: 5 },
      { ordine: 4, a: 6, b: 7 },
    ]);
    expect(t.avanzati).toEqual([]);
  });
  it("6 coppie con BYE: chi ha il BYE va direttamente in semifinale", () => {
    const t = costruisciPrimoTurno([c(1), null, c(2), c(3), c(4), c(5), c(6), null]);
    if ("errore" in t) throw new Error();
    expect(t.turno).toBe("QF");
    expect(t.partite.map((p) => p.ordine)).toEqual([2, 3]);
    expect(t.avanzati).toEqual([
      { turno: "SF", ordine: 1, lato: "a", posto: 0 },
      { turno: "SF", ordine: 2, lato: "b", posto: 6 },
    ]);
  });
  it("le righe mancanti diventano BYE fino alla potenza di 2", () => {
    const t = costruisciPrimoTurno([c(1), c(2), c(3)]);
    if ("errore" in t) throw new Error();
    expect(t).toMatchObject({ turno: "SF", partite: [{ ordine: 1 }], avanzati: [{ turno: "F", ordine: 1, lato: "b", posto: 2 }] });
  });
  it("rifiuta tabelloni impossibili", () => {
    expect(costruisciPrimoTurno([c(1)])).toEqual({ errore: "servono almeno 2 coppie" });
    expect(costruisciPrimoTurno(Array.from({ length: 65 }, (_, i) => c(i)))).toEqual({ errore: "massimo 64 posti" });
  });
});

describe("leggiPunteggio", () => {
  it("al meglio dei 3 con super tie-break", () => {
    expect(leggiPunteggio("6-4 3-6 10-7", 2)).toEqual({ a: [6, 3, 10], b: [4, 6, 7], setA: 2, setB: 1 });
  });
  it("set unico e separatori diversi", () => {
    expect(leggiPunteggio("9–7", 1)).toMatchObject({ setA: 1, setB: 0 });
    expect(leggiPunteggio("6/4, 6:2", 2)).toMatchObject({ a: [6, 6], b: [4, 2] });
  });
  it("errori", () => {
    expect(leggiPunteggio("6-4", 2)).toEqual({ errore: "il punteggio non chiude la partita" });
    expect(leggiPunteggio("6-6", 1)).toMatchObject({ errore: expect.stringContaining("parità") });
    expect(leggiPunteggio("6-4 6-4", 1)).toEqual({ errore: "troppi set" });
    expect(leggiPunteggio("abc", 1)).toMatchObject({ errore: expect.stringContaining("non valido") });
  });
});

describe("formato", () => {
  it("bandiere, punteggi, mesi", () => {
    expect(bandiera("IT")).toBe("🇮🇹");
    expect(bandiera(null)).toBe("🏳️");
    expect(punteggio({ game_a: [6, 3], game_b: [4, 6], ritiro: false })).toBe("6-4 3-6");
    expect(meseIso(new Date(Date.UTC(2026, 10, 15)))).toBe("2026-11-01");
    expect(ultimiMesi(3, new Date(Date.UTC(2026, 0, 10)))).toEqual(["2026-01-01", "2025-12-01", "2025-11-01"]);
  });
});
