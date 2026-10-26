// FASE 9: la famiglia raccontata dal giocatore e i salti di più anni.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dati } from "./aiuto.mjs";
import { alternaControlloIniziale, descrizioneDaModulo, generaDaDescrizione, leggiElenco, normalizzaDescrizione } from "../js/racconto.js";
import { iniziaAnno, fineAnno, avanzaAnni, continuaCon } from "../js/engine.js";
import { giocatore, personeVive } from "../js/state.js";
import { candidatiErede } from "../js/dinastia.js";
import { vistaGeneratore, vistaVita, vistaFamiglia } from "../js/vista.js";
import { eta } from "../js/util.js";

const D = await dati();

const famigliaNapoli = {
  cognome: "esposito",
  regione: "campania",
  citta: "napoli",
  agiatezza: "media",
  storia: "Sono Marco, faccio l'elettricista a Napoli con mia moglie Anna e i nostri figli.",
  persone: [
    { ruolo: "protagonista", nome: "marco", eta: 38, lavoro: "elettricista", tratti: ["generoso", "impulsivo"] },
    { ruolo: "partner", nome: "Anna", eta: 36, lavoro: "infermiere" },
    { ruolo: "figlio", nome: "Luca", eta: 10, controlla: true },
    { ruolo: "figlio", nome: "Sofia", eta: 6 },
    { ruolo: "madre", nome: "Rosa", eta: 70 },
    { ruolo: "padre", nome: "Gennaro", eta: 74, vivo: false },
    { ruolo: "fratello", nome: "Ciro", eta: 41 },
  ],
};

test("leggiElenco capisce i modi più comuni di scrivere nomi ed età", () => {
  assert.deepEqual(leggiElenco("Luca 12, Sara 8 anni; Giulia (3)"), [
    { nome: "Luca", eta: 12 },
    { nome: "Sara", eta: 8 },
    { nome: "Giulia", eta: 3 },
  ]);
  assert.deepEqual(leggiElenco("Marco"), [{ nome: "Marco", eta: null }]);
  assert.deepEqual(leggiElenco(""), []);
});

test("la descrizione viene ripulita: niente regioni, mestieri o tratti inventati", () => {
  const d = normalizzaDescrizione(D, {
    regione: "Atlantide",
    persone: [{ ruolo: "protagonista", nome: "giulia", eta: 3, lavoro: "astronauta", tratti: ["coraggioso", "prudente"] }, { ruolo: "zio", nome: "X" }, { ruolo: "madre", nome: "Ada", sesso: "M" }],
  });
  assert.equal(d.regione, null);
  const io = d.persone.find((p) => p.ruolo === "protagonista");
  assert.equal(io.nome, "Giulia");
  assert.equal(io.sesso, "F");
  assert.equal(io.eta, 6, "il protagonista ha almeno 6 anni");
  assert.equal(io.lavoro, null);
  assert.deepEqual(io.tratti, ["prudente"]);
  assert.ok(!d.persone.some((p) => p.ruolo === "zio"));
  assert.equal(d.persone.find((p) => p.ruolo === "madre").sesso, "F");
  assert.equal(normalizzaDescrizione(D, { regione: "Campania" }).regione, "campania");
});

test("una famiglia raccontata con protagonista adulto: casa propria, moglie, figli, nonna, nonno morto", () => {
  const s = generaDaDescrizione(D, 99, famigliaNapoli);
  const io = giocatore(s);
  assert.equal(io.nome, "Marco");
  assert.equal(io.cognome, "Esposito");
  assert.equal(io.citta, "Napoli");
  assert.equal(eta(io, s.world.anno), 38);
  assert.equal(io.carriera.lavoro, "elettricista");
  assert.ok(io.tratti.includes("generoso") && io.tratti.includes("impulsivo"));
  const moglie = s.persone[io.partner];
  assert.equal(moglie.nome, "Anna");
  assert.equal(io.stato_civile, "sposato");
  assert.equal(moglie.nucleo, io.nucleo);
  const figli = io.figli.map((id) => s.persone[id]);
  assert.deepEqual(figli.map((f) => f.nome).sort(), ["Luca", "Sofia"]);
  for (const f of figli) {
    assert.equal(f.nucleo, io.nucleo);
    assert.equal(f.padre, io.id);
    assert.equal(f.madre, moglie.id);
    assert.equal(f.cognome, "Esposito");
    assert.ok(f.sangue && f.generazione === 2);
    assert.ok(f.istruzione.iscritto && f.istruzione.livello === "elementari");
  }
  assert.equal(s.persone[io.madre].nome, "Rosa");
  assert.notEqual(s.persone[io.madre].nucleo, io.nucleo);
  assert.ok(s.persone[io.padre].anno_morte != null, "il padre non c'è più");
  assert.equal(s.persone[io.madre].stato_civile, "vedovo");
  assert.ok(Object.values(s.persone).some((p) => p.nome === "Ciro" && p.madre === io.madre));
  // Luca è controllato insieme al protagonista
  assert.equal(s.controllati.length, 2);
  assert.equal(s.persone[s.controllati[1]].nome, "Luca");
  assert.equal(s.famiglia.storia, famigliaNapoli.storia);
  const v = vistaGeneratore(s, D);
  assert.ok(v.raccontata && v.membri.some((m) => m.ruolo === "Moglie") && v.membri.some((m) => m.ruolo === "Figlia"));
});

test("un bambino raccontato vive con i genitori, che vengono generati se mancano", () => {
  const s = generaDaDescrizione(D, 5, { persone: [{ ruolo: "protagonista", nome: "Chiara", eta: 9 }] });
  const io = giocatore(s);
  assert.equal(io.sesso, "F");
  const m = s.persone[io.madre];
  const p = s.persone[io.padre];
  assert.ok(m && p);
  assert.equal(io.nucleo, m.nucleo);
  assert.ok(eta(m, s.world.anno) >= 9 + 25);
  assert.equal(io.istruzione.livello, "elementari");
});

test("la famiglia raccontata è deterministica e si gioca per generazioni", () => {
  const a = generaDaDescrizione(D, 7, famigliaNapoli);
  const b = generaDaDescrizione(D, 7, famigliaNapoli);
  assert.deepEqual(a, b);
  a.world.automatico = true;
  iniziaAnno(a, D);
  for (let i = 0; i < 90; i++) {
    if (a.world.fase === "erede") continuaCon(a, D, candidatiErede(a, giocatore(a))[0].persona.id);
    if (a.world.fase !== "gioco") break;
    fineAnno(a, D);
  }
  assert.ok(a.dinastia.giocati.length >= 2, "dopo 90 anni la storia continua con un erede");
  assert.ok(vistaFamiglia(a, D).albero.nodi.length > 8);
});

test("scegliere chi controllare prima di iniziare: massimo 4, niente bambini piccoli né morti", () => {
  const s = generaDaDescrizione(D, 3, { ...famigliaNapoli, persone: [...famigliaNapoli.persone.map((p) => ({ ...p, controlla: false })), { ruolo: "figlio", nome: "Neonato", eta: 1 }] });
  const io = giocatore(s);
  const id = (nome) => Object.values(s.persone).find((p) => p.nome === nome).id;
  assert.equal(alternaControlloIniziale(s, id("Neonato")), false);
  assert.equal(alternaControlloIniziale(s, id("Gennaro")), false);
  for (const n of ["Anna", "Luca", "Sofia"]) assert.ok(alternaControlloIniziale(s, id(n)));
  assert.equal(s.controllati.length, 4);
  assert.equal(alternaControlloIniziale(s, id("Rosa")), false, "già 4");
  assert.ok(alternaControlloIniziale(s, id("Sofia")), "si può togliere");
  assert.equal(s.controllati[0], io.id);
  iniziaAnno(s, D);
  assert.ok(s.world.eventi_anno.some((e) => e.persona === id("Anna")));
});

test("il modulo diventa una descrizione completa", () => {
  const d = descrizioneDaModulo({
    "r-cognome": "Bianchi",
    "r-regione": "lombardia",
    "r-nome": "Paolo",
    "r-eta": "45",
    "r-lavoro": "ingegnere",
    "r-tratti": ["ambizioso"],
    "r-padre-morto": true,
    "r-partner": "Elena",
    "r-figli": "Giulia 12, Matteo 9",
    "r-fratelli": "",
    "r-casa": "proprieta",
    "r-storia": "Una famiglia di Bergamo.",
  });
  assert.equal(d.persone.filter((p) => p.ruolo === "figlio").length, 2);
  assert.equal(d.persone.find((p) => p.ruolo === "padre").vivo, false);
  assert.ok(!d.persone.some((p) => p.ruolo === "madre"));
  const s = generaDaDescrizione(D, 1, d);
  assert.equal(giocatore(s).regione, "lombardia");
  assert.ok(Object.values(s.case).some((c) => c.proprietari.includes(s.giocatore)));
});

test("saltare avanti di 10 anni: tutto in automatico, con il riassunto degli anni", () => {
  const s = generaDaDescrizione(D, 4, famigliaNapoli);
  iniziaAnno(s, D);
  const r = avanzaAnni(s, D, 10);
  assert.equal(r.da, 2026);
  assert.equal(r.a, 2036);
  assert.equal(r.anni.length, 10);
  assert.ok(r.anni.some((a) => a.righe.length));
  assert.equal(s.world.anno, 2036);
  assert.ok(vistaVita(s, D).eventi.length >= 1, "dopo il salto c'è un anno nuovo da giocare");
  // si ferma se muore il principale
  const io = giocatore(s);
  io.anno_nascita = 1930;
  io.stat.salute = 1;
  const r2 = avanzaAnni(s, D, 50);
  assert.ok(r2.anni.length < 50 && r2.fase !== "gioco");
  assert.ok(personeVive(s).length > 0);
});

test("se si racconta un solo genitore, l'altro vive altrove (separati)", () => {
  const s = generaDaDescrizione(D, 8, { persone: [{ ruolo: "protagonista", nome: "Salvatore", eta: 16 }, { ruolo: "madre", nome: "Concetta", eta: 44 }, { ruolo: "fratello", nome: "Rosaria", eta: 12 }] });
  const io = giocatore(s);
  const m = s.persone[io.madre];
  const p = s.persone[io.padre];
  assert.equal(io.nucleo, m.nucleo);
  assert.notEqual(p.nucleo, io.nucleo);
  assert.equal(m.stato_civile, "separato");
  assert.equal(Object.values(s.persone).find((x) => x.nome === "Rosaria").nucleo, io.nucleo);
});

test("il lavoro scelto dal giocatore non viene sostituito da un'azienda casuale; i traguardi iniziali non si annunciano", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = generaDaDescrizione(D, seed, { agiatezza: "ricca", persone: [{ ruolo: "protagonista", nome: "Giulia", eta: 34, lavoro: "programmatore" }, { ruolo: "partner", nome: "Davide", eta: 36 }, { ruolo: "figlio", nome: "Emma", eta: 7 }, { ruolo: "madre", nome: "Paola", eta: 68 }] });
    const io = giocatore(s);
    assert.equal(io.carriera.lavoro, "programmatore", `seed ${seed}`);
    assert.ok(!io.carriera.imprenditore);
    assert.ok(s.dinastia.traguardi.every((t) => t.iniziale));
    assert.ok(!io.diario.flatMap((d) => d.righe).some((r) => r.startsWith("Traguardo")));
  }
});
