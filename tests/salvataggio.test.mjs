// Test di salvataggio, caricamento, migrazioni, esportazione e importazione.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dati } from "./aiuto.mjs";
import { generaFamiglia } from "../js/generator.js";
import { iniziaAnno, fineAnno } from "../js/engine.js";
import { carica, salva, esporta, importa, migra, VERSIONE_SCHEMA } from "../js/state.js";

const D = await dati();

/** Un finto localStorage in memoria. */
function memoria() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test("salva e ricarica la stessa partita", () => {
  const s = generaFamiglia(D, 5);
  iniziaAnno(s, D);
  fineAnno(s, D);
  const storage = memoria();
  assert.ok(salva(s, storage));
  assert.deepEqual(carica(storage), JSON.parse(JSON.stringify(s)));
});

test("esporta e importa un file JSON", () => {
  const s = generaFamiglia(D, 6);
  const copia = importa(esporta(s));
  assert.deepEqual(copia, JSON.parse(JSON.stringify(s)));
  assert.throws(() => importa("non è json"), /JSON/);
  assert.throws(() => importa(JSON.stringify({ ciao: 1 })), /partita/);
});

test("un salvataggio senza versione viene migrato allo schema attuale", () => {
  const s = JSON.parse(esporta(generaFamiglia(D, 8)));
  delete s.schema;
  delete s.relazioni;
  delete s.nuclei;
  const m = migra(s);
  assert.equal(m.schema, VERSIONE_SCHEMA);
  assert.ok(Array.isArray(m.relazioni));
  assert.ok(m.nuclei && typeof m.nuclei === "object");
});

test("un salvataggio di una versione futura viene rifiutato", () => {
  assert.throws(() => migra({ schema: VERSIONE_SCHEMA + 1 }), /più recente/);
});
