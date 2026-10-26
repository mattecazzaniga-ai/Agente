// Pezzi di interfaccia riusati da tutte le schermate. Solo HTML: nessuna regola di gioco.

import { formatoEuro } from "../util.js";

/** Protegge il testo prima di inserirlo nell'HTML. */
export function esc(x) {
  return String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Importo in euro con classe colore opzionale per il segno. */
export function soldi(x, { segno = false } = {}) {
  const classe = segno ? (x > 0 ? "positivo" : x < 0 ? "negativo" : "") : "";
  const testo = segno && x > 0 ? `+${formatoEuro(x)}` : formatoEuro(x);
  return `<span class="${classe}">${esc(testo)}</span>`;
}

/** Iniziali per l'avatar. */
export function avatar(nome, sesso) {
  const iniziali = nome.split(" ").slice(0, 2).map((p) => p[0]).join("");
  return `<div class="avatar ${sesso === "F" ? "f" : ""}" aria-hidden="true">${esc(iniziali)}</div>`;
}

/**
 * Barra sottile di una statistica. Parte dal valore precedente e si anima fino al nuovo
 * (vedi animaBarre). Le statistiche "inverse" (stanchezza) sono buone quando sono basse.
 */
export function barra(stat, precedente) {
  const buono = stat.inversa ? 100 - stat.valore : stat.valore;
  const classe = buono < 30 ? "basso" : buono >= 75 ? "alto" : "";
  const da = precedente ?? stat.valore;
  return `<div class="barra ${classe}">
    <div class="riga"><span>${esc(stat.nome)}</span><b>${stat.valore}</b></div>
    <div class="traccia"><div class="pieno" style="width:${da}%" data-valore="${stat.valore}"></div></div>
  </div>`;
}

/** Dopo il disegno porta le barre al valore nuovo, così la transizione CSS si vede. */
export function animaBarre(radice) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      for (const el of radice.querySelectorAll(".pieno[data-valore]")) el.style.width = `${el.dataset.valore}%`;
    }),
  );
}

export function chips(lista, classe = "") {
  if (!lista.length) return "";
  return `<div class="chips">${lista.map((t) => `<span class="chip ${classe}" title="${esc(t.descrizione ?? "")}">${esc(t.nome ?? t)}</span>`).join("")}</div>`;
}

/** Grafico a linea in SVG (patrimonio negli anni). */
export function grafico(punti) {
  if (punti.length < 2) return `<p class="tenue piccolo">Il grafico compare dopo qualche anno di gioco.</p>`;
  const L = 320;
  const A = 120;
  const m = 14;
  const valori = punti.map((p) => p.valore);
  const min = Math.min(0, ...valori);
  const max = Math.max(1, ...valori);
  const x = (i) => m + (i * (L - 2 * m)) / (punti.length - 1);
  const y = (v) => A - m - ((v - min) * (A - 2 * m)) / (max - min || 1);
  const linea = punti.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valore).toFixed(1)}`).join(" ");
  const area = `${linea} L${x(punti.length - 1).toFixed(1)},${y(min).toFixed(1)} L${x(0).toFixed(1)},${y(min).toFixed(1)} Z`;
  const breve = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)} mln` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`);
  return `<svg class="grafico" viewBox="0 0 ${L} ${A}" preserveAspectRatio="none" role="img" aria-label="Andamento del patrimonio">
    <path class="area" d="${area}"/>
    ${min < 0 ? `<line class="zero" x1="${m}" x2="${L - m}" y1="${y(0)}" y2="${y(0)}"/>` : ""}
    <path class="linea" d="${linea}" vector-effect="non-scaling-stroke"/>
    <text x="${m}" y="${A - 2}">${punti[0].anno}</text>
    <text x="${L - m}" y="${A - 2}" text-anchor="end">${punti.at(-1).anno}</text>
    <text x="${L - m}" y="10" text-anchor="end">${breve(max)} €</text>
  </svg>`;
}

/** Messaggio breve in basso che sparisce da solo. */
export function avviso(testo) {
  document.querySelector(".avviso")?.remove();
  const el = document.createElement("div");
  el.className = "avviso";
  el.setAttribute("role", "status");
  el.textContent = testo;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}
