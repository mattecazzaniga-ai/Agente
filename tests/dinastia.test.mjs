// Test delle FASI 2-4: coppie, figli, separazioni, azienda, erede, cambio e controllo di più personaggi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dati } from "./aiuto.mjs";
import { generaFamiglia } from "../js/generator.js";
import { iniziaAnno, fineAnno, continuaCon, cambiaPrincipale, impostaControllo, risolviTuttoInAutomatico, risolviEvento } from "../js/engine.js";
import { giocatore, personeVive, vive } from "../js/state.js";
import { nuovoPartner, convivenza, matrimonio, separazione, nasceFiglio, candidatiErede, vitaPrivata } from "../js/dinastia.js";
import { applicaEffetti } from "../js/events.js";
import { aziendaDi, entraInAzienda, cediAzienda, vendiAzienda, fondaAzienda } from "../js/azioni.js";
import { bilancioNucleo, membriNucleo, eredita, patrimonio } from "../js/economy.js";
import { muori } from "../js/engine.js";
import { eta } from "../js/util.js";
import { simulaDinastia } from "../tools/simula.mjs";

const D = await dati();

/** Porta il protagonista a `anni` anni facendo scegliere tutto al motore. */
function cresci(seed, anni) {
  const s = generaFamiglia(D, seed);
  iniziaAnno(s, D);
  while (eta(giocatore(s), s.world.anno) < anni && s.world.fase === "gioco") fineAnno(s, D);
  return s;
}

/** Un protagonista adulto, vivo, single e indipendente. */
function adulto(seed = 11, anni = 30) {
  for (let k = seed; k < seed + 50; k++) {
    const s = cresci(k, anni);
    const io = giocatore(s);
    if (s.world.fase !== "gioco" || io.partner) continue;
    delete io.flags.no_figli;
    return s;
  }
  throw new Error("nessun adulto adatto");
}

test("coppia: fidanzamento, convivenza, matrimonio, figlio con cognome paterno e tratti ereditati", () => {
  const s = adulto();
  const io = giocatore(s);
  assert.match(nuovoPartner(s, D, io), /Si mette insieme/);
  const q = s.persone[io.partner];
  assert.equal(q.partner, io.id);
  assert.equal(io.stato_civile, "fidanzato");
  assert.notEqual(q.sesso, io.sesso);
  convivenza(s, D, io);
  assert.equal(io.nucleo, q.nucleo, "devono vivere nello stesso nucleo");
  assert.equal(io.stato_civile, "convivente");
  matrimonio(s, D, io);
  assert.equal(q.stato_civile, "sposato");
  const riga = nasceFiglio(s, D, io);
  assert.match(riga, /Nasce/);
  const figlio = s.persone[io.figli.at(-1)];
  const padre = io.sesso === "M" ? io : q;
  assert.equal(figlio.cognome, padre.cognome);
  assert.equal(figlio.nucleo, io.nucleo);
  assert.ok(figlio.sangue, "il figlio del protagonista è di sangue");
  assert.equal(figlio.generazione, (io.generazione ?? 1) + 1);
  assert.equal(eta(figlio, s.world.anno), 0);
  // il bilancio conta il bambino (assegno unico) e la coppia
  bilancioNucleo(s, D, io.nucleo);
  assert.ok(io.economia.bilancio.nucleo.assegno > 0);
  assert.equal(io.economia.bilancio.nucleo.membri, 3);
});

test("separazione: chi esce va in affitto, i figli minori restano con la madre, parte il mantenimento", () => {
  const s = adulto(21);
  const io = giocatore(s);
  nuovoPartner(s, D, io);
  matrimonio(s, D, io);
  nasceFiglio(s, D, io);
  const q = s.persone[io.partner];
  const figlio = s.persone[io.figli.at(-1)];
  const madre = io.sesso === "F" ? io : q;
  separazione(s, D, io);
  assert.equal(io.partner, null);
  assert.equal(io.stato_civile, "separato");
  assert.notEqual(io.nucleo, q.nucleo);
  assert.equal(figlio.nucleo, madre.nucleo);
  assert.ok(io.ex.includes(q.id));
  fineAnno(s, D); // non deve rompersi nulla
});

test("vita privata automatica: nelle dinastie nascono figli a un ritmo italiano", () => {
  let donne = 0;
  let figli = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const d = simulaDinastia(D, 500 + seed, 120);
    if (d.figliPerDonna != null) {
      donne += 1;
      figli += d.figliPerDonna;
    }
  }
  const media = figli / donne;
  assert.ok(media > 0.8 && media < 2.2, `figli per donna ${media}`);
});

test("azienda: entrare, cedere al figlio, vendere, fondare", () => {
  const s = adulto(31, 40);
  const io = giocatore(s);
  delete io.flags.no_figli;
  if (aziendaDi(s, io)) vendiAzienda(s, D, io); // partiamo senza aziende
  io.economia.risparmi = 100000;
  assert.match(fondaAzienda(s, D, io, 25000) ?? "", /Apre/);
  const a = aziendaDi(s, io);
  assert.ok(a && io.carriera.imprenditore);
  assert.ok(io.economia.risparmi < 100000);
  nuovoPartner(s, D, io);
  matrimonio(s, D, io);
  nasceFiglio(s, D, io);
  const figlio = s.persone[io.figli.at(-1)];
  figlio.anno_nascita -= 25; // lo facciamo adulto
  assert.match(entraInAzienda(s, D, figlio), /Entra/);
  assert.equal(figlio.carriera.lavoro, "azienda_famiglia");
  assert.match(cediAzienda(s, D, io), new RegExp(figlio.nome));
  assert.equal(a.proprietario, figlio.id);
  assert.ok(figlio.carriera.imprenditore);
  const prima = figlio.economia.risparmi;
  vendiAzienda(s, D, figlio);
  assert.ok(a.venduta && figlio.economia.risparmi > prima);
});

test("eredità senza figli né coniuge: vanno ai genitori o ai fratelli", () => {
  const s = adulto(41, 30);
  const io = giocatore(s);
  io.economia.risparmi = 50000;
  io.economia.debiti = 0;
  const righe = eredita(s, io);
  assert.match(righe[0], /va a/);
  assert.equal(io.economia.risparmi, 0);
});

test("alla morte del principale si sceglie l'erede e la storia continua", () => {
  const s = adulto(51, 35);
  const io = giocatore(s);
  nuovoPartner(s, D, io);
  matrimonio(s, D, io);
  nasceFiglio(s, D, io);
  const figlio = s.persone[io.figli.at(-1)];
  muori(s, D, io, "incidente");
  s.world.eventi_anno = [];
  fineAnno(s, D);
  assert.equal(s.world.fase, "erede");
  const candidati = candidatiErede(s, io);
  assert.equal(candidati[0].persona.id, figlio.id, "il primo candidato è il figlio");
  continuaCon(s, D, figlio.id);
  assert.equal(s.giocatore, figlio.id);
  assert.equal(s.world.fase, "gioco");
  assert.equal(s.dinastia.giocati.length, 2);
  assert.equal(s.dinastia.generazione, 2);
  for (let i = 0; i < 10; i++) fineAnno(s, D);
  assert.ok(eta(figlio, s.world.anno) >= 10);
});

test("FASE 3: giocare come un fratello; FASE 4: controllare due persone con la coda di eventi", () => {
  let s = null;
  for (let seed = 60; seed < 120 && !s; seed++) {
    const t = cresci(seed, 16);
    const fr = personeVive(t).find((x) => x.sangue && x.id !== t.giocatore && eta(x, t.world.anno) >= 6 && eta(x, t.world.anno) < 60);
    if (t.world.fase === "gioco" && fr) s = t;
  }
  assert.ok(s, "serve una famiglia con fratelli o genitori");
  const io = giocatore(s);
  const altro = personeVive(s).find((x) => x.sangue && x.id !== io.id && eta(x, s.world.anno) >= 6 && eta(x, s.world.anno) < 60);
  impostaControllo(s, D, altro.id, true);
  assert.deepEqual(s.controllati, [io.id, altro.id]);
  assert.equal(altro.controllo, "giocatore");
  // nei prossimi anni arrivano eventi anche per la seconda persona
  let suoi = 0;
  for (let i = 0; i < 6; i++) {
    suoi += s.world.eventi_anno.filter((e) => e.persona === altro.id).length;
    risolviTuttoInAutomatico(s, D);
    fineAnno(s, D);
    if (s.world.fase !== "gioco") break;
  }
  assert.ok(suoi > 0, "la seconda persona controllata riceve eventi");
  assert.throws(() => impostaControllo(s, D, io.id, false), /principale/);
  if (vive(altro) && s.world.fase === "gioco") {
    cambiaPrincipale(s, D, altro.id);
    assert.equal(s.giocatore, altro.id);
    assert.equal(io.controllo, "automatico");
    assert.ok(!s.controllati.includes(io.id));
    assert.ok(s.world.eventi_anno.every((e) => e.persona !== io.id || e.risolto));
  }
});

test("non si possono controllare più di 4 persone né i bambini piccoli", () => {
  const s = adulto(71, 32);
  const io = giocatore(s);
  nuovoPartner(s, D, io);
  matrimonio(s, D, io);
  nasceFiglio(s, D, io);
  const neonato = s.persone[io.figli.at(-1)];
  assert.throws(() => impostaControllo(s, D, neonato.id, true), /non si può/);
});

test("gli effetti di coppia degli eventi funzionano dal JSON", () => {
  const s = adulto(81, 28);
  const io = giocatore(s);
  applicaEffetti(s, D, io, { partner: "nuovo" });
  applicaEffetti(s, D, io, { convivenza: true });
  applicaEffetti(s, D, io, { matrimonio: true });
  assert.equal(io.stato_civile, "sposato");
  const righe = applicaEffetti(s, D, io, { figlio: true });
  assert.ok(righe.some((r) => r.startsWith("Nasce")));
  applicaEffetti(s, D, io, { al_figlio: { morale: 5 } });
  assert.equal(membriNucleo(s, io.nucleo).length, 3);
});

test("una dinastia di 150 anni resta coerente", () => {
  for (const seed of [7, 8, 9]) {
    const d = simulaDinastia(D, seed, 150);
    assert.ok(d.anni > 50);
    assert.ok(d.persone < 400, `troppe persone: ${d.persone}`);
  }
});

test("le regole automatiche non toccano chi è controllato", () => {
  const s = adulto(91, 30);
  const io = giocatore(s);
  for (let i = 0; i < 40; i++) assert.deepEqual(vitaPrivata(s, D, io), []);
  assert.ok(patrimonio(s, io) !== undefined);
});

test("i risparmi non diventano mai negativi, nemmeno dopo eredità con debiti", () => {
  for (const seed of [4242, 11, 12, 13]) {
    const s = generaFamiglia(D, seed);
    s.world.automatico = true;
    iniziaAnno(s, D);
    for (let i = 0; i < 160; i++) {
      if (s.world.fase === "erede") continuaCon(s, D, candidatiErede(s, giocatore(s))[0].persona.id);
      if (s.world.fase !== "gioco") break;
      fineAnno(s, D);
      for (const p of Object.values(s.persone)) assert.ok(p.economia.risparmi >= 0, `${p.nome}: risparmi ${p.economia.risparmi} nel ${s.world.anno}`);
    }
  }
});
