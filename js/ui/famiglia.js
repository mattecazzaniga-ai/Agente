// Schermata Famiglia: albero genealogico in SVG (FASE 3), scheda della persona toccata,
// pulsanti per giocare come lei (FASE 3) o controllarla insieme al principale (FASE 4).

import { LARGHEZZA } from "../albero.js";
import { avatar, chips, esc, soldi } from "./componenti.js";

function legame(x) {
  if (x == null) return "";
  return x >= 70 ? "molto legati" : x >= 35 ? "buon rapporto" : x >= 0 ? "rapporto tiepido" : "rapporto difficile";
}

/** Albero in SVG: linee di coppia e di discendenza, un cerchio per persona. */
function albero(a) {
  const r = 21;
  const linee = a.linee
    .map((l) =>
      l.tipo === "coppia"
        ? `<line class="l-coppia ${l.ex ? "ex" : ""}" x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"/>`
        : `<path class="l-figlio" d="M${l.x1},${l.y1 + r + 36} V${(l.y1 + l.y2) / 2 + 8} H${l.x2} V${l.y2 - r - 5}"/>`,
    )
    .join("");
  const nodi = a.nodi
    .map(
      (n) => `<g class="nodo ${n.vivo ? "" : "morto"} ${n.sangue ? "" : "acquisito"} ${n.principale ? "principale" : ""} ${n.controllato ? "controllato" : ""} ${n.selezionato ? "selezionato" : ""} ${n.sesso === "F" ? "f" : ""}"
          data-azione="seleziona" data-id="${esc(n.id)}" transform="translate(${n.x},${n.y})" role="button" tabindex="0" aria-label="${esc(n.primo)} ${esc(n.anni)}">
        <circle r="${r + 5}" class="anello"/>
        <circle r="${r}" class="fondo"/>
        <circle r="${r}" class="disco"/>
        <text class="iniziali" dy="5">${esc(n.iniziali)}</text>
        <text class="nome-nodo" dy="${r + 18}">${esc(n.primo)}</text>
        <text class="anni-nodo" dy="${r + 31}">${esc(n.anni)}</text>
      </g>`,
    )
    .join("");
  return `<div class="albero" id="albero">
    <svg width="${Math.max(a.larghezza, LARGHEZZA * 3)}" height="${a.altezza}" viewBox="0 0 ${Math.max(a.larghezza, LARGHEZZA * 3)} ${a.altezza}" role="img" aria-label="Albero genealogico">
      <g>${linee}</g><g>${nodi}</g>
    </svg>
  </div>`;
}

function schedaPersona(s, controllati) {
  const azioni = [];
  if (s.puo_giocare) azioni.push(`<button class="bottone" data-azione="gioca-come" data-id="${esc(s.id)}">Gioca come ${esc(s.primo)}</button>`);
  if (s.puo_controllare) azioni.push(`<button class="bottone secondario" data-azione="controlla" data-id="${esc(s.id)}">Controlla anche ${esc(s.primo)} (${controllati.quanti}/${controllati.massimo})</button>`);
  if (s.puo_rilasciare) azioni.push(`<button class="bottone secondario" data-azione="rilascia" data-id="${esc(s.id)}">Smetti di controllare ${esc(s.primo)}</button>`);
  return `<section class="scheda" id="scheda-persona">
    <div class="persona">
      ${avatar(s.nome, s.sesso)}
      <div class="info">
        <div class="ruolo">${esc(s.ruolo)} · ${s.vivo ? `${s.eta} anni` : esc(s.anni)}${s.principale ? " · stai giocando" : s.controllata ? " · controllat" + (s.sesso === "F" ? "a" : "o") : ""}</div>
        <div class="titolo">${esc(s.nome)}</div>
        <div class="riga">${esc(s.occupazione)}${s.vivo ? ` · ${esc(s.stato_civile)}` : s.causa_morte ? ` (${esc(s.causa_morte)})` : ""}</div>
        ${s.legame != null && s.vivo ? `<div class="riga">Con te: ${legame(s.legame)}</div>` : ""}
        ${s.figli.length ? `<div class="riga">Figli: ${esc(s.figli.join(", "))}</div>` : ""}
        ${s.vivo ? `<div class="riga">Patrimonio: ${soldi(s.patrimonio)}</div>` : ""}
        ${s.riga && !s.principale ? `<div class="riga">${esc(s.riga)}</div>` : ""}
        ${chips(s.tratti)}
        ${chips(s.ricordi, "accento")}
      </div>
    </div>
    ${azioni.length ? `<div class="azioni-persona">${azioni.join("")}</div>` : ""}
    ${s.pieni ? `<p class="nota" style="margin-top:10px">Controlli già ${controllati.massimo} persone: togline una per aggiungerne un'altra.</p>` : ""}
    ${s.motivo && !s.principale ? `<p class="nota" style="margin-top:10px">${esc(s.motivo)}</p>` : ""}
  </section>`;
}

export function disegna(v) {
  return `
    <section class="scheda">
      <div class="etichetta">${esc(v.classe)} · generazione ${v.dinastia.generazione}</div>
      <div class="famiglia-nome">Famiglia ${esc(v.cognome)}</div>
      <p class="tenue piccolo">Reputazione del cognome: <b>${v.reputazione}</b>/100 · ${v.dinastia.anni} anni di storia</p>
    </section>

    <section class="scheda albero-scheda">
      <h2>Albero genealogico</h2>
      <p class="nota">Tocca una persona per vederla. Anello arancione: chi stai giocando; blu: chi controlli.</p>
      ${albero(v.albero)}
    </section>

    ${schedaPersona(v.scheda, v.controllati)}

    <section class="scheda">
      <h2>Diario degli ultimi anni</h2>
      <div class="diario">
        ${v.diario.map((d) => `<div><div class="anno">${d.anno}</div><ul>${d.righe.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`).join("")}
      </div>
    </section>`;
}
