// Test dell'economia: tasse, mutuo, eredità.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dati } from "./aiuto.mjs";
import { calcolaNetto, irpef, rataMutuo, eredita, patrimonio } from "../js/economy.js";
import { statoVuoto } from "../js/state.js";
import { creaPersona } from "../js/family.js";

const D = await dati();

test("IRPEF a scaglioni", () => {
  assert.equal(irpef(0, false), 0);
  assert.ok(Math.abs(irpef(28000, false) - 6440) < 1); // 23% su 28.000
  assert.ok(Math.abs(irpef(50000, false) - (6440 + 7700)) < 1); // + 35% su 22.000
  assert.equal(irpef(8000, true), 0); // no tax area per i dipendenti
});

test("dal lordo al netto: valori plausibili", () => {
  const n = calcolaNetto(28000, "dipendente");
  assert.ok(n.netto > 20000 && n.netto < 22500, `netto ${n.netto}`);
  assert.ok(calcolaNetto(100000, "dipendente").netto < 60000);
  assert.ok(calcolaNetto(6900, "pensione").netto === 6900);
});

test("rata del mutuo", () => {
  const rata = rataMutuo(150000, 0.035, 25);
  assert.ok(rata > 9000 && rata < 9300, `rata ${rata}`);
  assert.equal(rataMutuo(0, 0.035, 25), 0);
});

function famigliaDiProva() {
  const s = statoVuoto(1);
  const papa = creaPersona(s, { nome: "Mario", anno_nascita: 1950 });
  const mamma = creaPersona(s, { nome: "Anna", anno_nascita: 1952, partner: papa.id });
  papa.partner = mamma.id;
  const figli = [creaPersona(s, { nome: "Luca", anno_nascita: 1980 }), creaPersona(s, { nome: "Sara", anno_nascita: 1983 })];
  papa.figli = figli.map((f) => f.id);
  papa.economia.risparmi = 90000;
  return { s, papa, mamma, figli };
}

test("eredità: un terzo al coniuge e il resto diviso tra i figli", () => {
  const { s, papa, mamma, figli } = famigliaDiProva();
  s.case.c1 = { id: "c1", valore: 200000, mutuo_residuo: 0, proprietari: [papa.id] };
  papa.anno_morte = 2026;
  eredita(s, papa);
  assert.equal(mamma.economia.risparmi, 30000);
  assert.equal(figli[0].economia.risparmi, 30000);
  assert.equal(figli[1].economia.risparmi, 30000);
  assert.deepEqual(new Set(s.case.c1.proprietari), new Set([mamma.id, ...figli.map((f) => f.id)]));
  assert.equal(papa.economia.risparmi, 0);
});

test("eredità negativa: gli eredi rinunciano e i debiti non passano", () => {
  const { s, papa, figli } = famigliaDiProva();
  papa.economia.risparmi = 0;
  papa.economia.debiti = 50000;
  papa.anno_morte = 2026;
  const righe = eredita(s, papa);
  assert.ok(righe.some((r) => r.includes("rinunciano")));
  assert.equal(figli[0].economia.debiti, 0);
  assert.equal(patrimonio(s, papa), 0);
});
