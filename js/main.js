// Avvio dell'app nel browser: carica i dati, riprende la partita salvata, gestisce navigazione e azioni.
// Qui si collegano i bottoni alle funzioni del motore; le regole stanno tutte in engine/economy/events.

import { caricaDati } from "./data.js";
import { generaFamiglia } from "./generator.js";
import { iniziaAnno, fineAnno, risolviEvento, continuaCon, cambiaPrincipale, impostaControllo, risolviTuttoInAutomatico } from "./engine.js";
import { carica, cancella, esporta, importa, salva } from "./state.js";
import { seedDa } from "./rng.js";
import { vistaFamiglia, vistaGeneratore, vistaImpostazioni, vistaSoldi, vistaVita } from "./vista.js";
import { animaBarre, avviso } from "./ui/componenti.js";
import * as Generatore from "./ui/generatore.js";
import * as Vita from "./ui/vita.js";
import * as Soldi from "./ui/soldi.js";
import * as Famiglia from "./ui/famiglia.js";
import * as Impostazioni from "./ui/impostazioni.js";
import { creaNarratore } from "./ai.js";

const schermo = document.getElementById("schermo");
const nav = document.getElementById("nav");

const app = {
  dati: null,
  partita: null, // la partita in corso (stato unico)
  bozza: null, // famiglia proposta dal generatore, non ancora iniziata
  schermata: "generatore",
  barre: {}, // ultimi valori disegnati delle statistiche, per animarle
  selezionato: null, // persona toccata nell'albero
};

// Narratore AI (FASE 5): facoltativo, la chiave resta in questo browser. Senza, si usano i testi del gioco.
const narratore = creaNarratore();

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
    schermo.innerHTML = Vita.disegna(v, app.barre, narratore.giaRaccontato);
    raccontaVita(v);
    animaBarre(schermo);
    app.barre = Object.fromEntries(v.stat.map((x) => [x.id, x.valore]));
  } else if (s === "soldi") schermo.innerHTML = Soldi.disegna(vistaSoldi(partita, dati));
  else if (s === "famiglia") {
    schermo.innerHTML = Famiglia.disegna(vistaFamiglia(partita, dati, app.selezionato));
    centraAlbero();
  }
  else if (s === "impostazioni") schermo.innerHTML = Impostazioni.disegna(vistaImpostazioni(partita, narratore.stato()));
  if (inCima) window.scrollTo({ top: 0, behavior: "instant" });
}

/** Quando un testo dell'AI arriva, sostituisce quello del gioco (se è ancora sullo schermo). */
function sostituisci(chiave, testo) {
  if (!testo) return;
  const el = schermo.querySelector(`[data-racconto="${CSS.escape(chiave)}"]`);
  if (!el || el.classList.contains("ai")) return;
  el.textContent = testo;
  el.classList.add("ai");
}

/** Chiede al narratore i testi della schermata Vita: evento attuale per primo, poi gli altri, il riassunto, l'epitaffio. */
function raccontaVita(v) {
  if (!narratore.disponibile()) return;
  for (const ev of v.eventi) narratore.evento(ev.racconto.chiave, ev.racconto.contesto, ev.racconto.evento).then((t) => sostituisci(ev.racconto.chiave, t));
  const r = v.riepilogo?.racconto;
  if (r) narratore.anno(r.chiave, r.contesto, r.righe).then((t) => sostituisci(r.chiave, t));
  const e = v.epilogo?.racconto;
  if (e) narratore.epitaffio(e.chiave, e.contesto, e.vita).then((t) => sostituisci(e.chiave, t));
}

/** Porta in vista, nell'albero, la persona selezionata (o quella giocata). */
function centraAlbero() {
  const contenitore = document.getElementById("albero");
  const nodo = contenitore?.querySelector(".nodo.selezionato") ?? contenitore?.querySelector(".nodo.principale");
  if (!nodo) return;
  const box = nodo.getBoundingClientRect();
  const c = contenitore.getBoundingClientRect();
  contenitore.scrollLeft += box.left + box.width / 2 - (c.left + c.width / 2);
  contenitore.scrollTop += box.top + box.height / 2 - (c.top + c.height / 2);
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
  automatico: () => {
    risolviTuttoInAutomatico(app.partita, app.dati);
    salvaOra();
    disegna();
  },
  continua: (el) => {
    continuaCon(app.partita, app.dati, el.dataset.id);
    app.barre = {};
    app.selezionato = null;
    salvaOra();
    disegna({ inCima: true });
  },
  seleziona: (el) => {
    app.selezionato = el.dataset.id;
    disegna();
    document.getElementById("scheda-persona")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
  "gioca-come": (el) => {
    cambiaPrincipale(app.partita, app.dati, el.dataset.id);
    app.barre = {};
    app.selezionato = null;
    salvaOra();
    avviso("Adesso giochi con questa persona.");
    vai("vita");
  },
  controlla: (el) => {
    impostaControllo(app.partita, app.dati, el.dataset.id, true);
    salvaOra();
    avviso("Da ora controlli anche questa persona: i suoi eventi arrivano in Vita.");
    disegna();
  },
  rilascia: (el) => {
    impostaControllo(app.partita, app.dati, el.dataset.id, false);
    salvaOra();
    disegna();
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
  "ai-salva": () => {
    const campo = (id) => document.getElementById(id);
    narratore.salvaImpostazioni({
      attivo: campo("ai-attivo").checked,
      chiave: campo("ai-chiave").value,
      modello: campo("ai-modello").value.trim(),
      limite_minuto: campo("ai-minuto").value,
      limite_giorno: campo("ai-giorno").value,
    });
    avviso("Impostazioni del narratore salvate.");
    disegna();
  },
  "ai-prova": async () => {
    avviso("Provo a contattare Gemini…");
    const esito = await narratore.prova();
    avviso(esito.ok ? `Funziona: «${esito.messaggio}»` : esito.messaggio);
    disegna();
  },
  "ai-cancella": () => {
    if (!confirm("Cancellare la chiave Gemini da questo browser?")) return;
    narratore.cancellaChiave();
    disegna();
  },
};

schermo.addEventListener("click", (e) => {
  const el = e.target.closest("[data-azione]");
  if (!el || el.disabled) return;
  try {
    const r = azioni[el.dataset.azione]?.(el);
    if (r instanceof Promise) r.catch((errore) => avviso(`Errore: ${errore.message}`));
  } catch (errore) {
    console.error(errore);
    avviso(`Errore: ${errore.message}`);
  }
});

// i nodi dell'albero si attivano anche da tastiera
schermo.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".nodo[data-azione]")) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});

schermo.addEventListener("change", async (e) => {
  if (e.target.id !== "file-import" || !e.target.files[0]) return;
  try {
    app.partita = importa(await e.target.files[0].text());
    app.barre = {};
    if (app.partita.world.fase === "gioco" && !app.partita.world.eventi_anno.length) iniziaAnno(app.partita, app.dati);
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
