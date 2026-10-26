// Schermata Famiglia. FASE 1: elenco dei parenti con la riga dell'anno; l'albero in SVG arriva nella FASE 3.

import { avatar, chips, esc } from "./componenti.js";

function legame(x) {
  if (x == null) return "";
  const parola = x >= 70 ? "molto legati" : x >= 35 ? "buon rapporto" : x >= 0 ? "rapporto tiepido" : "rapporto difficile";
  return `<span class="legame">· ${parola}</span>`;
}

export function disegna(v) {
  return `
    <section class="scheda">
      <div class="etichetta">${esc(v.classe)}</div>
      <div class="famiglia-nome">Famiglia ${esc(v.cognome)}</div>
      <p class="tenue piccolo">Reputazione del cognome: <b>${v.reputazione}</b>/100</p>
    </section>

    <section class="scheda">
      <h2>Parenti</h2>
      <div class="persone">
        ${v.membri
          .map(
            (m) => `<div class="persona ${m.vivo ? "" : "morta"}">
              ${avatar(m.nome, m.sesso)}
              <div class="info">
                <div class="ruolo">${esc(m.ruolo)} · ${m.eta} anni ${legame(m.legame)}</div>
                <div class="titolo">${esc(m.nome)}</div>
                <div class="riga">${esc(m.occupazione)}${m.stesso_tetto && m.ruolo !== "Tu" ? " · vive con te" : ""}</div>
                ${m.riga && m.ruolo !== "Tu" ? `<div class="riga">${esc(m.riga)}</div>` : ""}
                ${chips(m.tratti)}
              </div>
            </div>`,
          )
          .join("")}
      </div>
    </section>

    <section class="scheda">
      <h2>Diario</h2>
      <div class="diario">
        ${v.diario.map((d) => `<div><div class="anno">${d.anno}</div><ul>${d.righe.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`).join("")}
      </div>
    </section>`;
}
