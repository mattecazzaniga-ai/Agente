// Avvio dell'app nel browser: carica i dati, riprende la partita salvata, gestisce navigazione e azioni.
// Qui si collegano i bottoni alle funzioni del motore; le regole stanno tutte in engine/economy/events.

import { caricaDati } from "./data.js";
import { generaFamiglia } from "./generator.js";
import { iniziaAnno, fineAnno, risolviEvento } from "./engine.js";
import { carica, cancella, esporta, importa, salva } from "./state.js";
import { seedDa } from "./rng.js";
import { vistaFamiglia, vistaGeneratore, vistaImpostazioni, vistaSoldi, vistaVita } from "./vista.js";
import { animaBarre, avviso } from "./ui/componenti.js";
import * as Generatore from "./ui/generatore.js";
import * as Vita from "./ui/vita.js";
import * as Soldi from "./ui/soldi.js";
import * as Famiglia from "./ui/famiglia.js";
import * as Impostazioni from "./ui/impostazioni.js";

const schermo = document.getElementById("schermo");
const nav = document.getElementById("nav");

const app = {
  dati: null,
  partita: null, // la partita in corso (stato unico)
  bozza: null, // famiglia proposta dal generatore, non ancora iniziata
  schermata: "generatore",
  barre: {}, // ultimi valori disegnati delle statistiche, per animarle
};

const nuovoSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000_000;

// ---------------------------------------------------------------------------
// Disegno
// ---------------------------------------------------------------------------

function disegna({ inCima = false } = {}) {
  const { dati, partita } = app;
  const s = app.schermata;
  document.body.classList.toggle("senza-nav", s === "generatore");
  nav.hidden = s === "generatore";
  for (const b of nav.querySelectorAll("button")) {
    if (b.dataset.vai === s) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }

  if (s === "generatore") schermo.innerHTML = Generatore.disegna(vistaGeneratore(app.bozza, dati));
  else if (s === "vita") {
    const v = vistaVita(partita, dati);
    schermo.innerHTML = Vita.disegna(v, app.barre);
    animaBarre(schermo);
    app.barre = Object.fromEntries(v.stat.map((x) => [x.id, x.valore]));
  } else if (s === "soldi") schermo.innerHTML = Soldi.disegna(vistaSoldi(partita, dati));
  else if (s === "famiglia") schermo.innerHTML = Famiglia.disegna(vistaFamiglia(partita, dati));
  else if (s === "impostazioni") schermo.innerHTML = Impostazioni.disegna(vistaImpostazioni(partita));
  if (inCima) window.scrollTo({ top: 0, behavior: "instant" });
}

function vai(schermata) {
  app.schermata = schermata;
  disegna({ inCima: true });
}

function salvaOra() {
  if (!salva(app.partita)) avviso("Salvataggio non riuscito: esporta la partita su file.");
}

// ---------------------------------------------------------------------------
// Azioni
// ---------------------------------------------------------------------------

function nuovaBozza(seed = nuovoSeed()) {
  app.bozza = generaFamiglia(app.dati, seed);
  vai("generatore");
}

const azioni = {
  rigenera: () => nuovaBozza(),
  "usa-seed": () => {
    const testo = document.getElementById("seed").value.trim();
    if (!testo) return;
    nuovaBozza(/^\d+$/.test(testo) ? Number(testo) : seedDa(testo));
  },
  inizia: () => {
    app.partita = app.bozza;
    app.bozza = null;
    app.barre = {};
    iniziaAnno(app.partita, app.dati);
    salvaOra();
    vai("vita");
  },
  scegli: (el) => {
    risolviEvento(app.partita, app.dati, Number(el.dataset.indice), el.dataset.scelta);
    salvaOra();
    disegna();
  },
  avanza: () => {
    fineAnno(app.partita, app.dati);
    salvaOra();
    disegna({ inCima: true });
  },
  nuova: () => {
    if (app.partita && app.partita.world.fase !== "fine" && !confirm("Iniziare una nuova partita? Quella attuale verrà cancellata (esportala prima se vuoi tenerla).")) return;
    cancella();
    app.partita = null;
    nuovaBozza();
  },
  esporta: () => {
    const p = app.partita;
    const blob = new Blob([esporta(p)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dinastia-${p.famiglia.cognome.toLowerCase()}-${p.world.anno}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  importa: () => document.getElementById("file-import").click(),
};

schermo.addEventListener("click", (e) => {
  const el = e.target.closest("[data-azione]");
  if (!el || el.disabled) return;
  try {
    azioni[el.dataset.azione]?.(el);
  } catch (errore) {
    console.error(errore);
    avviso(`Errore: ${errore.message}`);
  }
});

schermo.addEventListener("change", async (e) => {
  if (e.target.id !== "file-import" || !e.target.files[0]) return;
  try {
    app.partita = importa(await e.target.files[0].text());
    app.barre = {};
    if (app.partita.world.fase !== "fine" && !app.partita.world.eventi_anno.length) iniziaAnno(app.partita, app.dati);
    salvaOra();
    avviso("Partita importata.");
    vai("vita");
  } catch (errore) {
    avviso(errore.message);
  }
});

nav.addEventListener("click", (e) => {
  const b = e.target.closest("[data-vai]");
  if (b && app.partita) vai(b.dataset.vai);
});

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------

async function avvia() {
  try {
    app.dati = await caricaDati(async (percorso) => {
      const r = await fetch(percorso);
      if (!r.ok) throw new Error(`Impossibile caricare ${percorso}`);
      return r.json();
    });
  } catch (errore) {
    schermo.innerHTML = `<div class="scheda"><h2>Non riesco a caricare i dati</h2><p class="nota">${errore.message}. Se hai aperto il file direttamente, avvia un server locale (vedi README) o usa la versione su GitHub Pages.</p></div>`;
    return;
  }
  app.partita = carica();
  if (app.partita) vai("vita");
  else nuovaBozza();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

avvia();
