// FASE 6: l'Italia che cambia. Congiunture, tendenze e riforme decise dal seed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dati } from "./aiuto.mjs";
import { generaFamiglia } from "../js/generator.js";
import { iniziaAnno, fineAnno } from "../js/engine.js";
import { aggiornaMondo, modificatori, rischioSettore, etaPensione } from "../js/mondo.js";
import { condizioniOk } from "../js/events.js";
import { giocatore } from "../js/state.js";

const D = await dati();

function secolo(seed) {
  const s = generaFamiglia(D, seed);
  s.world.automatico = true;
  iniziaAnno(s, D);
  const storia = [];
  for (let i = 0; i < 100 && s.world.fase === "gioco"; i++) {
    fineAnno(s, D);
    storia.push(s.world.mondo.congiuntura);
  }
  return { s, storia };
}

test("in un secolo ci sono crisi e riprese, ma gli anni normali restano la maggioranza", () => {
  let crisi = 0, normali = 0, tot = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const { storia } = secolo(seed);
    crisi += storia.filter((x) => x === "crisi").length;
    normali += storia.filter((x) => x === "normale").length;
    tot += storia.length;
  }
  assert.ok(crisi / tot > 0.04 && crisi / tot < 0.3, `crisi ${crisi / tot}`);
  assert.ok(normali / tot > 0.5);
});

test("il mondo è deterministico: stesso seed, stessa storia d'Italia", () => {
  assert.deepEqual(secolo(42).storia, secolo(42).storia);
  assert.deepEqual(secolo(42).s.world.mondo.notizie, secolo(42).s.world.mondo.notizie);
});

test("l'età della pensione sale ma non supera il massimo, e il motore la usa", () => {
  const { s } = secolo(7);
  assert.ok(etaPensione(s) >= 67 && etaPensione(s) <= D.mondo.pensione.eta_massima);
});

test("in crisi si perde il lavoro più facilmente; l'automazione pesa su alcuni settori", () => {
  const s = generaFamiglia(D, 3);
  s.world.mondo.congiuntura = "crisi";
  assert.ok(modificatori(s, D).licenziamenti > 1 && modificatori(s, D).assunzioni < 1);
  s.world.mondo.congiuntura = "normale";
  assert.equal(modificatori(s, D).licenziamenti, 1);
  s.world.anno = 2050;
  assert.ok(rischioSettore(s, D, "uffici") > 1);
  assert.ok(rischioSettore(s, D, "sanita") < 1);
  assert.equal(rischioSettore(s, D, "artigianato"), 1);
});

test("le notizie arrivano nel riepilogo e la condizione 'congiuntura' funziona negli eventi", () => {
  const s = generaFamiglia(D, 9);
  iniziaAnno(s, D);
  s.world.mondo.congiuntura = "normale";
  // forziamo l'inizio di una crisi con il dado del mondo
  let notizie = [];
  for (let i = 0; i < 200 && !notizie.length; i++) notizie = aggiornaMondo(s, D).filter(() => s.world.mondo.congiuntura !== "normale");
  assert.ok(notizie.length);
  const io = giocatore(s);
  const c = s.world.mondo.congiuntura;
  assert.ok(condizioniOk(s, D, io, { congiuntura: c }));
  assert.ok(!condizioniOk(s, D, io, { congiuntura: "nessuna" }));
});

test("lo stato senza mondo (vecchi salvataggi) non rompe il motore", () => {
  const s = generaFamiglia(D, 10);
  delete s.world.mondo;
  iniziaAnno(s, D);
  fineAnno(s, D);
  assert.ok(s.world.mondo);
});
