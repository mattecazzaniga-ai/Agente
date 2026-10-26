// FASE 7: traguardi e storia della dinastia.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dati } from "./aiuto.mjs";
import { generaFamiglia } from "../js/generator.js";
import { iniziaAnno, fineAnno, continuaCon } from "../js/engine.js";
import { giocatore } from "../js/state.js";
import { candidatiErede } from "../js/dinastia.js";
import { REGOLE_TRAGUARDI, statisticheDinastia, verificaTraguardi } from "../js/traguardi.js";
import { vistaFamiglia } from "../js/vista.js";

const D = await dati();

function dinastia(seed, anni) {
  const s = generaFamiglia(D, seed);
  s.world.automatico = true;
  iniziaAnno(s, D);
  for (let i = 0; i < anni; i++) {
    if (s.world.fase === "erede") continuaCon(s, D, candidatiErede(s, giocatore(s))[0].persona.id);
    if (s.world.fase !== "gioco") break;
    fineAnno(s, D);
  }
  return s;
}

test("ogni traguardo usa una regola esistente e ha un id unico", () => {
  assert.ok(D.traguardi.length >= 15);
  assert.equal(new Set(D.traguardi.map((t) => t.id)).size, D.traguardi.length);
  for (const t of D.traguardi) assert.ok(REGOLE_TRAGUARDI.includes(t.regola), `${t.id}: regola ${t.regola}`);
});

test("nel primo anno non si ottengono traguardi regalati dai genitori di partenza", () => {
  const s = generaFamiglia(D, 5);
  iniziaAnno(s, D);
  fineAnno(s, D);
  const ids = s.dinastia.traguardi.map((t) => t.id);
  assert.ok(!ids.includes("prima_laurea") && !ids.includes("magistrale"), ids.join(","));
});

test("in un secolo di dinastia si ottengono traguardi, una volta sola ciascuno, e la storia è registrata", () => {
  let s = null;
  for (let seed = 11; seed < 40 && !s; seed++) {
    const t = dinastia(seed, 110);
    if (t.world.fase === "gioco") s = t; // una dinastia che non si è estinta
  }
  const ids = s.dinastia.traguardi.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "un traguardo ripetuto");
  assert.ok(ids.includes("mezzo_secolo") && ids.includes("secolo"), ids.join(","));
  assert.ok(ids.length >= 5, ids.join(","));
  assert.ok(s.dinastia.storico.length >= 100);
  assert.deepEqual(verificaTraguardi(s, D), [], "rifare il controllo non aggiunge niente");
  const st = statisticheDinastia(s, D);
  assert.ok(st.nati > 5 && st.generazioni >= 3);
  assert.equal(st.traguardi.filter((t) => t.ottenuto).length, ids.length);
  assert.ok(vistaFamiglia(s, D).statistiche.storico.length > 0);
  // i traguardi appaiono nel diario del personaggio principale
  assert.ok(Object.values(s.persone).some((p) => p.diario.some((d) => d.righe.some((r) => r.startsWith("Traguardo di famiglia")))));
});
