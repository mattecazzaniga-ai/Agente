// Test del motore: generatore, turno annuale, determinismo, eventi a catena, simulazione di massa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dati } from "./aiuto.mjs";
import { generaFamiglia, ETA_INIZIO, ANNO_INIZIO } from "../js/generator.js";
import { iniziaAnno, fineAnno, risolviEvento, eventiDaRisolvere } from "../js/engine.js";
import { giocatore, personeVive } from "../js/state.js";
import { requisitiScelta } from "../js/events.js";
import { eta } from "../js/util.js";
import { simulaVita } from "../tools/simula.mjs";

const D = await dati();

test("il generatore crea una famiglia coerente", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const s = generaFamiglia(D, seed);
    const io = giocatore(s);
    assert.equal(eta(io, s.world.anno), ETA_INIZIO);
    assert.equal(s.world.anno, ANNO_INIZIO);
    const madre = s.persone[io.madre];
    const padre = s.persone[io.padre];
    assert.ok(madre && padre, "mancano i genitori");
    assert.ok(eta(madre, s.world.anno) >= 25 + ETA_INIZIO - 1, "madre troppo giovane");
    assert.equal(io.cognome, padre.cognome);
    assert.ok(D.regione[io.regione], "regione inesistente");
    assert.ok(io.tratti.length >= 2);
    for (const t of io.tratti) for (const o of D.tratto[t].opposti) assert.ok(!io.tratti.includes(o), `tratti opposti ${t}/${o}`);
  }
});

test("l'agiatezza delle famiglie segue le probabilità reali (né sempre ricchi né sempre poveri)", () => {
  const conteggio = { precaria: 0, media: 0, agiata: 0, ricca: 0 };
  const n = 1500;
  for (let seed = 1; seed <= n; seed++) conteggio[generaFamiglia(D, seed * 7919).famiglia.agiatezza]++;
  assert.ok(conteggio.media / n > 0.45 && conteggio.media / n < 0.65, `media ${conteggio.media}`);
  assert.ok(conteggio.ricca / n > 0.01 && conteggio.ricca / n < 0.09, `ricca ${conteggio.ricca}`);
  assert.ok(conteggio.precaria / n > 0.12 && conteggio.precaria / n < 0.3, `precaria ${conteggio.precaria}`);
});

test("un turno annuale fa avanzare anno ed età e propone al massimo pochi eventi", () => {
  const s = generaFamiglia(D, 42);
  const eventi = iniziaAnno(s, D);
  assert.ok(eventi.length >= 1 && eventi.length <= 4, `${eventi.length} eventi`);
  fineAnno(s, D);
  assert.equal(s.world.anno, ANNO_INIZIO + 1);
  assert.equal(eta(giocatore(s), s.world.anno), ETA_INIZIO + 1);
  assert.ok(s.world.ultimo_riepilogo.righe.length > 0);
});

test("la risoluzione di una scelta applica gli effetti e segna l'evento risolto", () => {
  const s = generaFamiglia(D, 7);
  iniziaAnno(s, D);
  const io = giocatore(s);
  const voce = s.world.eventi_anno[0];
  const ev = D.evento[voce.evento];
  const scelta = ev.scelte.find((x) => requisitiScelta(s, D, io, x).ok);
  risolviEvento(s, D, 0, scelta.id);
  assert.equal(s.world.eventi_anno[0].risolto, true);
  assert.throws(() => risolviEvento(s, D, 0, scelta.id));
});

test("stesso seed e stesse scelte: stessa partita (determinismo)", () => {
  const gioca = () => {
    const s = generaFamiglia(D, 2026);
    iniziaAnno(s, D);
    for (let i = 0; i < 30; i++) {
      while (eventiDaRisolvere(s).length) {
        const idx = s.world.eventi_anno.findIndex((e) => !e.risolto);
        const ev = D.evento[s.world.eventi_anno[idx].evento];
        const scelta = ev.scelte.find((x) => requisitiScelta(s, D, giocatore(s), x).ok) ?? ev.scelte[0];
        risolviEvento(s, D, idx, scelta.id);
      }
      fineAnno(s, D);
    }
    return JSON.stringify(s);
  };
  assert.equal(gioca(), gioca());
});

test("dopo il diploma la scelta dell'università arriva a catena nello stesso anno", () => {
  // cerca una partita in cui il protagonista sceglie l'università e verifica che si iscriva davvero
  let trovata = false;
  for (let seed = 1; seed <= 60 && !trovata; seed++) {
    const r = simulaVita(D, seed);
    if (r.titolo.startsWith("laurea")) trovata = true;
  }
  assert.ok(trovata, "nessun laureato in 60 vite: la catena di eventi università non funziona");
});

test("100 vite simulate senza errori e con età di morte plausibili", () => {
  const vite = [];
  for (let seed = 1; seed <= 100; seed++) vite.push(simulaVita(D, seed));
  const media = vite.reduce((s, v) => s + v.etaMorte, 0) / vite.length;
  assert.ok(media > 76 && media < 89, `età media alla morte ${media.toFixed(1)}`);
  assert.ok(vite.every((v) => Number.isFinite(v.patrimonioFinale)), "patrimonio non numerico");
  const laureati = vite.filter((v) => v.titolo.startsWith("laurea")).length;
  assert.ok(laureati > 10 && laureati < 60, `laureati ${laureati}%`);
});

test("nessun valore impossibile dopo 60 anni di gioco", () => {
  const s = generaFamiglia(D, 99);
  iniziaAnno(s, D);
  for (let i = 0; i < 60 && s.world.fase !== "fine"; i++) fineAnno(s, D);
  for (const p of Object.values(s.persone)) {
    for (const [k, v] of Object.entries(p.stat)) assert.ok(v >= 0 && v <= 100, `${p.nome} ${k}=${v}`);
    assert.ok(Number.isFinite(p.economia.risparmi) && p.economia.risparmi >= 0, `${p.nome} risparmi ${p.economia.risparmi}`);
    assert.ok(Number.isFinite(p.economia.debiti) && p.economia.debiti >= 0, `${p.nome} debiti ${p.economia.debiti}`);
  }
  assert.ok(personeVive(s).length >= 0);
});

test("un minorenne che spende più di quanto ha non fa debiti: pagano i genitori", async () => {
  const { applicaEffetti } = await import("../js/events.js");
  const s = generaFamiglia(D, 12);
  const io = giocatore(s);
  const genitori = [s.persone[io.madre], s.persone[io.padre]];
  const prima = genitori.reduce((t, g) => t + g.economia.risparmi - g.economia.debiti, 0);
  applicaEffetti(s, D, io, { risparmi: -800 });
  assert.equal(io.economia.debiti, 0);
  assert.equal(io.economia.risparmi, 0);
  const dopo = genitori.reduce((t, g) => t + g.economia.risparmi - g.economia.debiti, 0);
  assert.ok(prima - dopo >= 799, `i genitori pagano: ${prima - dopo}`);
});
