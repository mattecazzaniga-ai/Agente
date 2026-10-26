// Test delle viste (dati pronti per le schermate) e della lista dei file offline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dati } from "./aiuto.mjs";
import { generaFamiglia } from "../js/generator.js";
import { iniziaAnno, fineAnno, risolviEvento, continuaCon } from "../js/engine.js";
import { layoutAlbero, LARGHEZZA } from "../js/albero.js";
import { giocatore } from "../js/state.js";
import { alGenere, vistaFamiglia, vistaGeneratore, vistaImpostazioni, vistaSoldi, vistaVita } from "../js/vista.js";

const D = await dati();

test("le viste si costruiscono per tre generazioni giocate scegliendo sempre la prima opzione possibile", () => {
  for (const seed of [3, 17, 99]) {
    const s = generaFamiglia(D, seed);
    assert.ok(vistaGeneratore(s, D).membri.length >= 3);
    iniziaAnno(s, D);
    let eredi = 0;
    for (let anni = 0; anni < 220 && s.world.fase !== "fine"; anni++) {
      if (s.world.fase === "erede") {
        const v = vistaVita(s, D);
        assert.ok(v.candidati.length > 0 && v.epilogo);
        if (++eredi > 2) break;
        continuaCon(s, D, v.candidati[0].id);
      }
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
      if (anni % 10 === 0) vistaFamiglia(s, D);
      fineAnno(s, D);
    }
    const fine = vistaVita(s, D);
    assert.ok(fine.fase !== "gioco" && fine.epilogo.eta > 0);
    assert.equal(vistaImpostazioni(s).nome, `${giocatore(s).nome} ${giocatore(s).cognome}`);
  }
});

test("l'albero genealogico contiene tutta la famiglia di sangue e i nodi non si sovrappongono", () => {
  for (const seed of [5, 6]) {
    const s = generaFamiglia(D, seed);
    iniziaAnno(s, D);
    for (let i = 0; i < 90 && s.world.fase === "gioco"; i++) fineAnno(s, D);
    const a = layoutAlbero(s);
    const ids = new Set(a.nodi.map((n) => n.persona.id));
    assert.equal(ids.size, a.nodi.length, "una persona compare due volte");
    for (const p of Object.values(s.persone).filter((x) => x.sangue)) assert.ok(ids.has(p.id), `manca ${p.nome}`);
    const occupati = new Set();
    for (const n of a.nodi) {
      const chiave = `${Math.round(n.x / LARGHEZZA * 2)}:${n.y}`;
      assert.ok(!occupati.has(chiave), "due nodi nello stesso punto");
      occupati.add(chiave);
    }
    // ogni figlio sta un livello sotto i suoi genitori
    const y = new Map(a.nodi.map((n) => [n.persona.id, n.y]));
    for (const n of a.nodi) for (const g of [n.persona.madre, n.persona.padre]) if (y.has(g) && n.persona.sangue) assert.ok(y.get(g) < n.y);
    assert.ok(vistaFamiglia(s, D).scheda.nome);
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
