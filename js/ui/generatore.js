// Schermata della prima famiglia: chi sei, dove nasci, con chi. Bottoni Rigenera e Inizia.

import { avatar, chips, esc, soldi } from "./componenti.js";

export function disegna(v) {
  return `
    <header class="titolo-gioco">
      <img class="stemma" src="icons/icon.svg" alt="">
      <h1>Dinastia</h1>
      <p>Una famiglia italiana, una generazione dopo l'altra.</p>
    </header>

    <section class="scheda">
      <div class="etichetta">${esc(v.luogo)}</div>
      <div class="famiglia-nome">Famiglia ${esc(v.cognome)}</div>
      <p class="tenue">${esc(v.classe)}</p>
      <p style="margin-top:12px">${esc(v.protagonista.infanzia)}</p>
      ${chips(v.protagonista.tratti, "accento")}
    </section>

    <section class="scheda">
      <h2>La famiglia</h2>
      <div class="persone">
        ${v.membri
          .map(
            (m) => `<div class="persona">
              ${avatar(m.nome, m.sesso)}
              <div class="info">
                <div class="ruolo">${esc(m.ruolo)} · ${m.eta} anni</div>
                <div class="titolo">${esc(m.nome)}</div>
                <div class="riga">${esc(m.occupazione)}</div>
                ${m.storia ? `<div class="riga">${esc(m.storia)}</div>` : ""}
                ${m.ruolo !== "Tu" ? chips(m.tratti) : ""}
              </div>
            </div>`,
          )
          .join("")}
      </div>
    </section>

    <section class="scheda">
      <h2>La situazione</h2>
      <div class="voci">
        ${v.note.map((n) => `<div class="voce"><span>${esc(n)}</span></div>`).join("")}
        <div class="voce"><span>Risparmi dei genitori</span>${soldi(v.risparmi)}</div>
        ${v.debiti ? `<div class="voce"><span>Debiti</span>${soldi(-v.debiti, { segno: true })}</div>` : ""}
      </div>
    </section>

    <div class="bottoni">
      <button class="bottone secondario" data-azione="rigenera">Rigenera</button>
      <button class="bottone" data-azione="inizia">Inizia</button>
    </div>
    <div class="campo">
      <input id="seed" inputmode="numeric" aria-label="Seed della partita" value="${esc(v.seed)}">
      <button class="bottone secondario" style="width:auto;min-height:44px" data-azione="usa-seed">Usa seed</button>
    </div>
    <p class="nota">Lo stesso seed genera sempre la stessa famiglia.</p>`;
}
