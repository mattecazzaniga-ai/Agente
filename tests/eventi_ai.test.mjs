// Eventi inventati dall'AI: la proposta viene controllata e gli effetti arrivano solo dai profili del gioco.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dati } from "./aiuto.mjs";
import { generaFamiglia } from "../js/generator.js";
import { iniziaAnno, fineAnno, risolviEvento } from "../js/engine.js";
import { giocatore } from "../js/state.js";
import { convertiProposta, preparaEventiAI, profiliDisponibili, haEventiAI } from "../js/eventi_ai.js";
import { convalidaEventi } from "../js/ai.js";
import { richiesteEventiAI, vistaVita } from "../js/vista.js";
import { eta } from "../js/util.js";

const D = await dati();

function partita(seed = 21, anni = 16) {
  const s = generaFamiglia(D, seed);
  iniziaAnno(s, D);
  while (eta(giocatore(s), s.world.anno) < anni) fineAnno(s, D);
  return s;
}

const proposta = (profili) => ({
  titolo: "Il concerto",
  testo: "Il tuo gruppo preferito suona in città proprio la sera prima della verifica di matematica. I tuoi amici hanno già i biglietti.",
  scelte: profili.map((p, i) => ({ testo: `Scelta ${i}`, profilo: p, esito: "Succede qualcosa." })),
});

test("gli effetti arrivano dal profilo, non dalla proposta dell'AI", () => {
  const s = partita();
  const io = giocatore(s);
  const p = { ...proposta(["divertimento", "prudente"]) };
  p.scelte[0].effetti = { risparmi: 1000000 }; // tentativo dell'AI di decidere i soldi: ignorato
  const ev = convertiProposta(s, D, io, p, "ai_x");
  assert.deepEqual(ev.scelte[0].effetti, D.profilo.divertimento.effetti);
  assert.equal(ev.scelte.length, 2);
});

test("tipi inventati o non disponibili vengono scartati; servono almeno due scelte valide", () => {
  const s = partita(22, 10); // un bambino: niente lavoro, niente coppia
  const io = giocatore(s);
  const ammessi = new Set(profiliDisponibili(s, D, io).map((p) => p.id));
  assert.ok(!ammessi.has("cambia_lavoro") && !ammessi.has("nuova_relazione") && !ammessi.has("spesa_grande"));
  assert.equal(convertiProposta(s, D, io, proposta(["prudente", "volare_via"]), "x"), null);
  assert.equal(convertiProposta(s, D, io, proposta(["prudente", "cambia_lavoro"]), "x"), null);
  assert.equal(convertiProposta(s, D, io, proposta(["prudente", "prudente"]), "x"), null, "due scelte dello stesso tipo contano una volta");
  assert.ok(convertiProposta(s, D, io, proposta(["prudente", "coraggiosa", "studio"]), "x"));
});

test("eventi per l'anno in corso entrano subito in coda, quelli per l'anno dopo arrivano con iniziaAnno", () => {
  const s = partita();
  const io = giocatore(s);
  const anno = s.world.anno;
  const subito = preparaEventiAI(s, D, io.id, anno, [proposta(["coraggiosa", "prudente"])]);
  assert.equal(subito.length, 1);
  assert.ok(s.world.eventi_anno.some((e) => e.evento === subito[0] && !e.risolto));
  assert.deepEqual(preparaEventiAI(s, D, io.id, anno, [proposta(["coraggiosa", "prudente"])]), [], "una volta sola per anno");
  const dopo = preparaEventiAI(s, D, io.id, anno + 1, [proposta(["amicizia", "riposo"]), proposta(["divertimento", "solitudine"])]);
  assert.equal(dopo.length, 2);
  assert.deepEqual(preparaEventiAI(s, D, io.id, anno + 5, [proposta(["amicizia", "riposo"])]), [], "anni lontani rifiutati");
  // la vista mostra l'evento dell'AI senza chiederne il racconto
  const v = vistaVita(s, D);
  const evAi = v.eventi.find((e) => e.id === subito[0]);
  assert.equal(evAi.tema, "ai");
  assert.equal(evAi.racconto, null);
  // si risolve come un evento normale
  const prima = io.stat.felicita;
  risolviEvento(s, D, evAi.indice, "a");
  assert.ok(io.stat.felicita >= prima);
  fineAnno(s, D);
  const ids = s.world.eventi_anno.map((e) => e.evento);
  for (const id of dopo) assert.ok(ids.includes(id), "gli eventi preparati arrivano l'anno dopo");
  assert.ok(s.world.eventi_anno.filter((e) => e.persona === io.id).length <= 4);
  assert.ok(haEventiAI(s, io.id, s.world.anno));
});

test("richieste per l'AI: anno in corso e prossimo, poi niente se già pronti", () => {
  const s = partita();
  const r = richiesteEventiAI(s, D);
  assert.deepEqual(r.map((x) => x.anno), [s.world.anno, s.world.anno + 1]);
  assert.equal(r[1].contesto.eta, eta(giocatore(s), s.world.anno) + 1);
  assert.ok(r[0].profili.length > 5);
  preparaEventiAI(s, D, r[0].persona, r[0].anno, [proposta(["coraggiosa", "prudente"])]);
  preparaEventiAI(s, D, r[1].persona, r[1].anno, [proposta(["coraggiosa", "prudente"])]);
  assert.deepEqual(richiesteEventiAI(s, D), []);
});

test("la scommessa la decide il dado del motore, in modo riproducibile", () => {
  const esiti = [];
  for (const seed of [1, 2]) {
    const s = partita(30, 30);
    const io = giocatore(s);
    io.economia.risparmi = 5000;
    const [id] = preparaEventiAI(s, D, io.id, s.world.anno, [proposta(["scommessa", "prudente"])]);
    const i = s.world.eventi_anno.findIndex((e) => e.evento === id);
    const voce = risolviEvento(s, D, i, "a");
    esiti.push([voce.esito, io.economia.risparmi]);
    assert.match(voce.esito, /Ti va bene|Non va come speravi/);
  }
  assert.deepEqual(esiti[0], esiti[1], "stessa partita, stesso esito");
});

test("convalidaEventi scarta numeri inventati e tipi fuori elenco", () => {
  const buono = { titolo: "Il concerto", testo: "Il tuo gruppo preferito suona a Bari e i biglietti stanno per finire.", scelte: [{ testo: "Vai", profilo: "divertimento", esito: "Bella serata." }, { testo: "Resti a casa", profilo: "riposo", esito: "Dormi bene." }] };
  assert.ok(convalidaEventi(JSON.stringify({ eventi: [buono] }), "", ["divertimento", "riposo"]).ok);
  const numeri = { ...buono, testo: "Vinci 5000 euro alla lotteria e non sai cosa fare con tutti quei soldi." };
  assert.equal(convalidaEventi(JSON.stringify({ eventi: [numeri] }), "", ["divertimento", "riposo"]).ok, false);
  const fuori = { ...buono, scelte: [buono.scelte[0], { testo: "Voli", profilo: "volare", esito: "x" }] };
  assert.equal(convalidaEventi(JSON.stringify({ eventi: [fuori] }), "", ["divertimento", "riposo"]).ok, false);
  assert.equal(convalidaEventi("non json", "", []).ok, false);
});
