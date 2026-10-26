// Test del narratore AI (FASE 5) con un finto Gemini: niente rete, niente chiave vera.
import { test } from "node:test";
import assert from "node:assert/strict";
import { creaNarratore, convalidaRisposta, CHIAVE_IMPOSTAZIONI } from "../js/ai.js";
import { dati } from "./aiuto.mjs";
import { generaFamiglia } from "../js/generator.js";
import { iniziaAnno } from "../js/engine.js";
import { esporta } from "../js/state.js";
import { vistaVita } from "../js/vista.js";

const D = await dati();

function memoria() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

/** Finto Gemini: risponde con `testo` dopo un attimo e conta le richieste contemporanee. */
function fintoGemini(testo = "Una mattina di sole: tua madre ti chiama dalla cucina e qualcosa sta per cambiare.", { stato = 200 } = {}) {
  const f = async (url, opzioni) => {
    f.chiamate.push({ url, opzioni });
    f.attive += 1;
    f.massimo = Math.max(f.massimo, f.attive);
    await new Promise((r) => setTimeout(r, 5));
    f.attive -= 1;
    const campo = Object.keys(JSON.parse(opzioni.body).generationConfig.responseSchema.properties)[0];
    return { ok: stato === 200, status: stato, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ [campo]: typeof testo === "function" ? testo() : testo }) }] } }] }) };
  };
  f.chiamate = [];
  f.attive = 0;
  f.massimo = 0;
  return f;
}

function narratoreDiProva({ fetch = fintoGemini(), impostazioni = { attivo: true, chiave: "CHIAVE-SEGRETA-1234" }, ora = () => new Date("2026-10-26T10:00:00") } = {}) {
  const storage = memoria();
  storage.setItem(CHIAVE_IMPOSTAZIONI, JSON.stringify(impostazioni));
  const attese = [];
  const n = creaNarratore({ fetch, storage, ora, attendi: async (ms) => attese.push(ms) });
  return { n, fetch, storage, attese };
}

const contesto = { nome: "Giulia", eta: 16, anno: 2036, citta: "Bari" };
const evento = { titolo: "La prima cotta", testo: "C'è una persona della tua classe a cui pensi spesso.", scelte: ["Ti dichiari", "Aspetti"] };

test("senza chiave o con il narratore spento non parte nessuna richiesta", async () => {
  for (const imp of [{ attivo: true, chiave: "" }, { attivo: false, chiave: "abc" }]) {
    const { n, fetch } = narratoreDiProva({ impostazioni: imp });
    assert.equal(n.disponibile(), false);
    assert.equal(await n.evento("k1", contesto, evento), null);
    assert.equal(fetch.chiamate.length, 0);
  }
});

test("un testo valido viene usato e messo in archivio: la seconda volta non si chiede di nuovo", async () => {
  const { n, fetch } = narratoreDiProva();
  const t = await n.evento("k1", contesto, evento);
  assert.match(t, /tua madre/);
  assert.equal(n.giaRaccontato("k1"), t);
  assert.equal(await n.evento("k1", contesto, evento), t);
  assert.equal(fetch.chiamate.length, 1);
});

test("la chiave viaggia nell'intestazione, mai nell'indirizzo", async () => {
  const { n, fetch } = narratoreDiProva();
  await n.evento("k1", contesto, evento);
  const { url, opzioni } = fetch.chiamate[0];
  assert.ok(!url.includes("CHIAVE-SEGRETA"));
  assert.equal(opzioni.headers["x-goog-api-key"], "CHIAVE-SEGRETA-1234");
  assert.match(url, /gemini-2\.5-flash:generateContent$/);
});

test("le richieste passano in coda una alla volta, con la pausa minima tra l'una e l'altra", async () => {
  const { n, fetch, attese } = narratoreDiProva({ impostazioni: { attivo: true, chiave: "x", limite_minuto: 6 } });
  const tutte = await Promise.all([1, 2, 3, 4].map((i) => n.evento(`k${i}`, contesto, evento)));
  assert.ok(tutte.every(Boolean));
  assert.equal(fetch.massimo, 1, "mai due richieste insieme");
  assert.equal(fetch.chiamate.length, 4);
  assert.ok(attese.some((ms) => ms > 9000 && ms <= 10000), `attese ${attese}`); // 6 al minuto = una ogni 10 secondi
});

test("la stessa richiesta chiesta due volte parte una volta sola", async () => {
  const { n, fetch } = narratoreDiProva();
  await Promise.all([n.evento("doppia", contesto, evento), n.evento("doppia", contesto, evento)]);
  assert.equal(fetch.chiamate.length, 1);
});

test("il limite giornaliero si rispetta e il giorno dopo riparte", async () => {
  let oggi = new Date("2026-10-26T10:00:00");
  const { n, fetch } = narratoreDiProva({ impostazioni: { attivo: true, chiave: "x", limite_giorno: 2 }, ora: () => oggi });
  assert.ok(await n.evento("a", contesto, evento));
  assert.ok(await n.evento("b", contesto, evento));
  assert.equal(await n.evento("c", contesto, evento), null);
  assert.equal(fetch.chiamate.length, 2);
  assert.match(n.stato().ultimo_errore, /Limite giornaliero/);
  oggi = new Date("2026-10-27T08:00:00");
  assert.ok(await n.evento("c", contesto, evento));
  assert.equal(n.stato().usate_oggi, 1);
});

test("risposte con numeri inventati, troppo corte o non JSON vengono scartate", async () => {
  for (const cattiva of ["Hai vinto 50.000 euro alla lotteria e ora sei ricchissima, che giornata incredibile.", "Ciao", "{testo rotto"]) {
    const { n } = narratoreDiProva({ fetch: async (url, o) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: cattiva.startsWith("{") ? cattiva : JSON.stringify({ testo: cattiva }) }] } }] }) }) });
    assert.equal(await n.evento("k", contesto, evento), null, cattiva);
    assert.ok(n.stato().ultimo_errore);
  }
});

test("errori del servizio (429, chiave sbagliata, rete) non bloccano il gioco", async () => {
  for (const stato of [429, 403, 500]) {
    const { n } = narratoreDiProva({ fetch: fintoGemini("x", { stato }) });
    assert.equal(await n.evento("k", contesto, evento), null);
  }
  const { n } = narratoreDiProva({ fetch: async () => { throw new Error("offline"); } });
  assert.equal(await n.evento("k", contesto, evento), null);
  // dopo un errore la coda continua a funzionare
  assert.equal(await n.evento("k2", contesto, evento), null);
});

test("convalidaRisposta accetta i numeri già presenti nel materiale", () => {
  assert.ok(convalidaRisposta('{"testo":"A 16 anni, nel 2036, a Bari pensi solo a quella persona della tua classe."}', "testo", "16 2036").ok);
  assert.equal(convalidaRisposta('{"testo":"A 17 anni, nel 2036, a Bari pensi solo a quella persona."}', "testo", "16 2036").ok, false);
  assert.ok(convalidaRisposta('```json\n{"testo":"Una giornata qualunque a Bari, ma non per te: oggi qualcosa cambia."}\n```', "testo", "").ok);
});

test("impostazioni: la chiave si conserva se il campo resta vuoto, i limiti restano nei margini", () => {
  const { n } = narratoreDiProva();
  const s = n.salvaImpostazioni({ attivo: true, chiave: "", modello: "gemini-2.0-flash", limite_minuto: 999, limite_giorno: 0 });
  assert.equal(s.chiave, "CHIAVE-SEGRETA-1234");
  assert.equal(s.modello, "gemini-2.0-flash");
  assert.equal(s.limite_minuto, 30);
  assert.equal(s.limite_giorno, 100); // 0 non è valido: resta il precedente
  assert.equal(n.stato().chiave_mascherata, "••••1234");
  assert.ok(!JSON.stringify(n.stato()).includes("SEGRETA"));
  n.cancellaChiave();
  assert.equal(n.disponibile(), false);
});

test("la chiave non entra mai nella partita né nel file esportato", async () => {
  const { n, storage } = narratoreDiProva();
  const s = generaFamiglia(D, 3);
  iniziaAnno(s, D);
  const v = vistaVita(s, D);
  for (const ev of v.eventi) await n.evento(ev.racconto.chiave, ev.racconto.contesto, ev.racconto.evento);
  assert.ok(!esporta(s).includes("CHIAVE-SEGRETA"));
  assert.ok(!JSON.stringify(s).includes("CHIAVE-SEGRETA"));
  assert.ok(!storage.getItem("dinastia.salvataggio"));
});

test("il contesto per il narratore è completo (nome, chiave di archivio, scelte)", () => {
  const s = generaFamiglia(D, 4);
  iniziaAnno(s, D);
  const v = vistaVita(s, D);
  for (const ev of v.eventi) {
    assert.ok(ev.racconto.chiave.includes(String(s.world.seed)));
    assert.equal(ev.racconto.contesto.nome, v.nome.split(" ")[0]);
    assert.ok(Array.isArray(ev.racconto.evento.scelte));
    assert.ok(!JSON.stringify(ev.racconto.contesto).includes("€"));
  }
});
