// Simula N vite complete in automatico e stampa statistiche di bilanciamento.
//   node tools/simula.mjs [vite=100] [seedIniziale=1]
import { dati } from "../tests/aiuto.mjs";
import { generaFamiglia } from "../js/generator.js";
import { iniziaAnno, fineAnno } from "../js/engine.js";
import { giocatore } from "../js/state.js";
import { patrimonio, quotaCase } from "../js/economy.js";
import { eta, NOMI_TITOLI } from "../js/util.js";

/** Simula una vita intera; restituisce i dati per le statistiche. */
export function simulaVita(D, seed) {
  const s = generaFamiglia(D, seed);
  const io = giocatore(s);
  io.controllo = "automatico";
  iniziaAnno(s, D);
  const istantanee = {};
  for (let anni = 0; anni < 130 && s.world.fase !== "fine"; anni++) {
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
    area: D.regione[s.nuclei[Object.keys(s.nuclei)[0]].regione].area,
    istantanee,
    eventi: Object.keys(s.world.eventi_usati[io.id] ?? {}).length,
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
  console.log(`\nMestieri principali:`);
  for (const [k, c] of conta(vite.map((v) => (v.mestiere === "nessuno" ? "nessuno" : D.mestiere[v.mestiere].nome)))) console.log(`  ${k.padEnd(28)} ${"█".repeat(c)} ${c}`);
}
