import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leggiTabelloneItf, pianoAggiornamento, sembraTabelloneItf, separaNome, type PartitaEsistente } from "@/lib/importaItf";

const testo = readFileSync(new URL("./dati/itf-franca-bt200-m.txt", import.meta.url), "utf8");

describe("separaNome", () => {
  it("separa nome e cognome attaccati", () => {
    expect(separaNome("RenzoTesta Lutzenberger Amancio")).toEqual({ nome: "Renzo", cognome: "Testa Lutzenberger Amancio" });
    expect(separaNome("Joao PedroLinhares da Fonseca")).toEqual({ nome: "Joao Pedro", cognome: "Linhares da Fonseca" });
    expect(separaNome("Ricardo GarciaDos Santos")).toEqual({ nome: "Ricardo Garcia", cognome: "Dos Santos" });
    expect(separaNome("giovanecury bueres")).toEqual({ nome: "Giovanecury", cognome: "Bueres" });
    expect(separaNome("Luiz Villar")).toEqual({ nome: "Luiz", cognome: "Villar" });
  });
});

describe("tabellone ITF BT200 Franca (maschile)", () => {
  const r = leggiTabelloneItf(testo, 2);
  if ("errore" in r) throw new Error(r.errore);

  it("riconosce il formato", () => expect(sembraTabelloneItf(testo)).toBe(true));

  it("32 posti con nazioni e teste di serie", () => {
    expect(r.dimensione).toBe(32);
    expect(r.posti.every(Boolean)).toBe(true);
    expect(r.posti[0]).toMatchObject({ testa_di_serie: 1, g1: { nome: "Renzo", paese: null }, g2: { cognome: "Branco", paese: "BR" } });
    expect(r.posti[31]).toMatchObject({ testa_di_serie: 2, g1: { nome: "Nikita", cognome: "Burmakin", paese: null }, g2: { paese: "BR" } });
    expect(r.posti[24]?.g1.paese).toBe("VE");
    expect(r.posti.filter((p) => p?.testa_di_serie).length).toBe(8);
  });

  it("primo turno: 16 partite giocate, con super tie-break, tie-break e ritiro", () => {
    const r32 = r.giocate.filter((g) => g.turno === "R32");
    expect(r32).toHaveLength(16);
    expect(r32[0]).toMatchObject({ ordine: 1, game_a: [6, 6], game_b: [4, 3], vince: "a" });
    expect(r32[2]).toMatchObject({ game_a: [6, 1, 10], game_b: [3, 6, 6], vince: "a" });
    expect(r32[9]).toMatchObject({ ritiro: true, vince: "b" });
    expect(r32[10]).toMatchObject({ game_a: [7, 5, 9], game_b: [6, 7, 11], vince: "b" });
    expect(r32[15]).toMatchObject({ game_a: [6, 0], game_b: [7, 6], vince: "b" }); // "65" = 6 (tie-break perso a 5)
  });

  it("ottavi: giocati i 4 della metà bassa", () => {
    const r16 = r.giocate.filter((g) => g.turno === "R16");
    expect(r16.map((g) => g.ordine)).toEqual([5, 6, 7, 8]);
    expect(r16[0]).toMatchObject({ a: 16, b: 19, game_a: [6, 6], game_b: [0, 2], vince: "a" });
    expect(r16[2]).toMatchObject({ a: 24, b: 26, game_a: [4, 7, 10], game_b: [6, 5, 3], vince: "a" });
    expect(r16[3]).toMatchObject({ a: 29, b: 31, vince: "a" });
    expect(r.avvisi.some((a) => a.includes("incompleto"))).toBe(true);
  });
});

describe("aggiornamento dei risultati incollando di nuovo il tabellone", () => {
  const r = leggiTabelloneItf(testo, 2);
  if ("errore" in r) throw new Error(r.errore);
  const ids = r.posti.map((_, k) => `c${k}`);
  // situazione nel database: primo turno tutto concluso, ottavi creati ma senza risultato
  const esistenti: PartitaEsistente[] = [
    ...r.giocate.filter((g) => g.turno === "R32").map((g) => ({ id: `r32-${g.ordine}`, turno: g.turno, ordine: g.ordine, stato: "conclusa", coppia_a_id: ids[g.a], coppia_b_id: ids[g.b], game_a: g.game_a, game_b: g.game_b, ritiro: g.ritiro, vincitore_id: null })),
    ...r.giocate.filter((g) => g.turno === "R16").map((g) => ({ id: `r16-${g.ordine}`, turno: g.turno, ordine: g.ordine, stato: "in_programma", coppia_a_id: ids[g.a], coppia_b_id: ids[g.b], game_a: null, game_b: null, ritiro: false, vincitore_id: null })),
  ];

  it("scrive solo i risultati nuovi e salta quelli già presenti", () => {
    const piano = pianoAggiornamento(r, ids, esistenti);
    expect(piano.uguali).toBe(16);
    expect(piano.aggiornamenti.map((x) => `${x.turno}-${x.ordine}-${x.tipo}`)).toEqual(["R16-5-nuovo", "R16-6-nuovo", "R16-7-nuovo", "R16-8-nuovo"]);
    expect(piano.aggiornamenti[0].campi).toMatchObject({ stato: "conclusa", game_a: [6, 6], game_b: [0, 2] });
  });

  it("corregge un risultato sbagliato già salvato", () => {
    const sbagliato = esistenti.map((e) => (e.id === "r32-1" ? { ...e, game_b: [4, 4] } : e));
    const piano = pianoAggiornamento(r, ids, sbagliato);
    expect(piano.aggiornamenti.find((x) => x.id === "r32-1")).toMatchObject({ tipo: "corretto", campi: { game_b: [4, 3] } });
  });

  it("i turni non ancora creati restano da scrivere dopo l'avanzamento", () => {
    const soloPrimo = esistenti.filter((e) => e.turno === "R32");
    expect(pianoAggiornamento(r, ids, soloPrimo).mancanti.map((g) => g.turno)).toEqual(["R16", "R16", "R16", "R16"]);
  });
});
