// Simula N vite complete in automatico e stampa statistiche di bilanciamento.
//   node tools/simula.mjs [vite=100] [seedIniziale=1]
import { dati } from "../tests/aiuto.mjs";
import { generaFamiglia } from "../js/generator.js";
import { iniziaAnno, fineAnno, continuaCon } from "../js/engine.js";
import { candidatiErede } from "../js/dinastia.js";
import { giocatore } from "../js/state.js";
import { patrimonio, quotaCase } from "../js/economy.js";
import { eta, NOMI_TITOLI } from "../js/util.js";

/** Simula una vita intera; restituisce i dati per le statistiche. */
export function simulaVita(D, seed) {
  const s = generaFamiglia(D, seed);
  const io = giocatore(s);
  s.world.automatico = true; // il protagonista sceglie da solo, come tutti gli altri
  const area = D.regione[io.regione].area;
  iniziaAnno(s, D);
  const istantanee = {};
  for (let anni = 0; anni < 130 && s.world.fase === "gioco"; anni++) {
    fineAnno(s, D);
    const e = eta(io, s.world.anno);
    if ([25, 40, 65].includes(e) && io.anno_morte == null) {
      const k = s.world.indice_prezzi; // valori in euro di oggi (2026)
      istantanee[e] = { patrimonio: patrimonio(s, io) / k, debiti: io.economia.debiti / k, casa: quotaCase(s, io) > 0, lavoro: io.carriera.lavoro || io.carriera.imprenditore, reddito: (io.economia.bilancio?.netto ?? 0) / k };
    }
  }
  // mestiere principale = quello tenuto più a lungo
  const durate = {};
  for (const t of [...io.carriera.storico, ...(io.carriera.lavoro ? [{ lavoro: io.carriera.lavoro, dal: io.carriera.dal, al: io.anno_morte }] : [])]) durate[t.lavoro] = (durate[t.lavoro] ?? 0) + ((t.al ?? io.anno_morte) - (t.dal ?? io.anno_morte));
  const principale = Object.entries(durate).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "nessuno";
  return {
    etaMorte: io.anno_morte - io.anno_nascita,
    causa: io.causa_morte,
    patrimonioFinale: (io.storico_patrimonio.at(-1)?.valore ?? 0) / s.world.indice_prezzi,
    titolo: io.istruzione.titolo,
    mestiere: principale,
    agiatezza: s.famiglia.agiatezza,
    area,
    istantanee,
    eventi: Object.keys(s.world.eventi_usati[io.id] ?? {}).length,
    figli: io.figli.length,
    sposato: io.stato_civile !== "single" || io.ex.length > 0 ? (["sposato", "vedovo", "separato"].includes(io.stato_civile) ? "sposato" : "coppia") : "single",
    separato: io.flags.separato_nel != null,
  };
}

/** Simula una dinastia per `anni` anni: alla morte del principale continua sempre il primo candidato. */
export function simulaDinastia(D, seed, anni = 200) {
  const s = generaFamiglia(D, seed);
  s.world.automatico = true;
  iniziaAnno(s, D);
  for (let i = 0; i < anni; i++) {
    if (s.world.fase === "erede") continuaCon(s, D, candidatiErede(s, giocatore(s))[0].persona.id);
    if (s.world.fase !== "gioco") break;
    fineAnno(s, D);
  }
  const persone = Object.values(s.persone);
  const donne = persone.filter((p) => p.sesso === "F" && p.sangue && p.anno_morte != null && p.anno_morte - p.anno_nascita >= 50);
  return {
    anni: s.world.anno - 2026,
    estinta: s.world.fase === "fine",
    generazione: s.dinastia.generazione,
    principali: s.dinastia.giocati.length,
    persone: persone.length,
    vivi: persone.filter((p) => p.anno_morte == null).length,
    figliPerDonna: donne.length ? media(donne.map((d) => d.figli.length)) : null,
    reputazione: s.famiglia.reputazione,
  };
}

const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const mediana = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
};
const percento = (n, tot) => `${Math.round((100 * n) / tot)}%`;
const eur = (x) => `${Math.round(x).toLocaleString("it-IT")} €`;

function conta(lista) {
  const c = {};
  for (const x of lista) c[x] = (c[x] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] ?? 100);
  const da = Number(process.argv[3] ?? 1);
  const D = await dati();
  const vite = [];
  const t0 = Date.now();
  for (let i = 0; i < n; i++) vite.push(simulaVita(D, da + i));
  const a = (k) => vite.map((v) => v.istantanee[k]).filter(Boolean);

  console.log(`\n${n} vite simulate in ${((Date.now() - t0) / 1000).toFixed(1)} s · importi in euro di oggi (2026)\n`);
  console.log(`Età media alla morte: ${media(vite.map((v) => v.etaMorte)).toFixed(1)} anni (mediana ${mediana(vite.map((v) => v.etaMorte))})`);
  console.log(`Morti prima dei 50: ${percento(vite.filter((v) => v.etaMorte < 50).length, n)} · cause: ${conta(vite.map((v) => v.causa)).map(([k, c]) => `${k} ${c}`).join(", ")}`);
  console.log(`Eventi vissuti per vita: ${media(vite.map((v) => v.eventi)).toFixed(0)}`);
  for (const e of [25, 40, 65]) {
    const x = a(e);
    if (!x.length) continue;
    console.log(
      `A ${e} anni: patrimonio medio ${eur(media(x.map((y) => y.patrimonio)))}, mediano ${eur(mediana(x.map((y) => y.patrimonio)))} · reddito netto medio ${eur(media(x.map((y) => y.reddito)))} · ` +
        `con casa ${percento(x.filter((y) => y.casa).length, x.length)} · occupati ${percento(x.filter((y) => y.lavoro).length, x.length)} · debiti >10k ${percento(x.filter((y) => y.debiti > 10000).length, x.length)}`,
    );
  }
  console.log(`Patrimonio alla morte: medio ${eur(media(vite.map((v) => v.patrimonioFinale)))}, mediano ${eur(mediana(vite.map((v) => v.patrimonioFinale)))}`);
  console.log(`\nFamiglia d'origine: ${conta(vite.map((v) => v.agiatezza)).map(([k, c]) => `${k} ${percento(c, n)}`).join(" · ")}`);
  console.log(`Area: ${conta(vite.map((v) => v.area)).map(([k, c]) => `${k} ${percento(c, n)}`).join(" · ")}`);
  console.log(`Titolo di studio: ${conta(vite.map((v) => NOMI_TITOLI[v.titolo])).map(([k, c]) => `${k} ${percento(c, n)}`).join(" · ")}`);
  console.log(`Figli per persona: ${media(vite.map((v) => v.figli)).toFixed(2)} · senza figli ${percento(vite.filter((v) => !v.figli).length, n)} · sposati almeno una volta ${percento(vite.filter((v) => v.sposato === "sposato").length, n)} · mai in coppia ${percento(vite.filter((v) => v.sposato === "single").length, n)} · sposati poi separati ${percento(vite.filter((v) => v.separato).length, Math.max(1, vite.filter((v) => v.sposato === "sposato" || v.separato).length))}`);

  const nd = Math.max(5, Math.round(n / 5));
  const t1 = Date.now();
  const dinastie = [];
  for (let i = 0; i < nd; i++) dinastie.push(simulaDinastia(D, da + 1000 + i, 200));
  const durate = dinastie.map((d) => d.anni);
  console.log(`\n${nd} dinastie per 200 anni in ${((Date.now() - t1) / 1000).toFixed(1)} s`);
  console.log(`Estinte: ${percento(dinastie.filter((d) => d.estinta).length, nd)} · durata media ${media(durate).toFixed(0)} anni · generazione raggiunta media ${media(dinastie.map((d) => d.generazione)).toFixed(1)} · personaggi giocati ${media(dinastie.map((d) => d.principali)).toFixed(1)}`);
  console.log(`Persone create: media ${media(dinastie.map((d) => d.persone)).toFixed(0)}, massimo ${Math.max(...dinastie.map((d) => d.persone))} · vive alla fine ${media(dinastie.map((d) => d.vivi)).toFixed(0)}`);
  console.log(`Figli per donna di sangue (morte dopo i 50): ${media(dinastie.map((d) => d.figliPerDonna).filter((x) => x != null)).toFixed(2)} · reputazione finale media del cognome ${media(dinastie.map((d) => d.reputazione)).toFixed(0)}`);

  console.log(`\nMestieri principali:`);
  for (const [k, c] of conta(vite.map((v) => (v.mestiere === "nessuno" ? "nessuno" : D.mestiere[v.mestiere].nome)))) console.log(`  ${k.padEnd(28)} ${"█".repeat(c)} ${c}`);
}
