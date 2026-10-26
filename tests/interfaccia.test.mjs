// Test delle viste (dati pronti per le schermate) e della lista dei file offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dati } from "./aiuto.mjs";
import { generaFamiglia } from "../js/generator.js";
import { iniziaAnno, fineAnno, risolviEvento } from "../js/engine.js";
import { giocatore } from "../js/state.js";
import { alGenere, vistaFamiglia, vistaGeneratore, vistaImpostazioni, vistaSoldi, vistaVita } from "../js/vista.js";

const D = await dati();

test("le viste si costruiscono per tutta una vita giocata scegliendo sempre la prima opzione possibile", () => {
  for (const seed of [3, 17, 99]) {
    const s = generaFamiglia(D, seed);
    assert.ok(vistaGeneratore(s, D).membri.length >= 3);
    iniziaAnno(s, D);
    for (let anni = 0; anni < 120 && s.world.fase !== "fine"; anni++) {
      let v = vistaVita(s, D);
      for (let giri = 0; v.eventi.length && giri < 10; giri++) {
        const ev = v.eventi[0];
        const scelta = ev.scelte.find((x) => x.ok);
        assert.ok(scelta, `nessuna scelta disponibile in ${ev.id}`);
        assert.ok(!/\{\w+\}/.test(ev.testo + ev.titolo), `segnaposto non riempito in ${ev.id}: ${ev.testo}`);
        risolviEvento(s, D, ev.indice, scelta.id);
        v = vistaVita(s, D);
      }
      vistaSoldi(s, D);
      vistaFamiglia(s, D);
      fineAnno(s, D);
    }
    const fine = vistaVita(s, D);
    assert.ok(fine.fine && fine.epilogo.eta > 0);
    assert.equal(vistaImpostazioni(s).nome, `${giocatore(s).nome} ${giocatore(s).cognome}`);
  }
});

test("gli aggettivi si volgono al femminile", () => {
  assert.equal(alGenere("Ambizioso", "F"), "Ambiziosa");
  assert.equal(alGenere("Sicuro di sé", "F"), "Sicura di sé");
  assert.equal(alGenere("Socievole", "F"), "Socievole");
  assert.equal(alGenere("Ambizioso", "M"), "Ambizioso");
});

test("il service worker mette in cache tutti i file del gioco", () => {
  const sw = readFileSync("sw.js", "utf8");
  const elenco = [...sw.matchAll(/"([^"]+\.(?:js|json|css|html|svg|png|webmanifest))"/g)].map((m) => m[1]);
  for (const f of elenco) assert.ok(existsSync(f), `sw.js elenca un file che non esiste: ${f}`);
  const necessari = [
    ...readdirSync("js").filter((f) => f.endsWith(".js")).map((f) => `js/${f}`),
    ...readdirSync("js/ui").map((f) => `js/ui/${f}`),
    ...readdirSync("data").filter((f) => f.endsWith(".json")).map((f) => `data/${f}`),
    ...readdirSync("data/events").map((f) => `data/events/${f}`),
  ];
  for (const f of necessari) assert.ok(elenco.includes(f), `manca in sw.js: ${f}`);
});
