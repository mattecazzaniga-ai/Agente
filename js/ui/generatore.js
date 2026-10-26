// Schermata della prima famiglia: chi sei, dove nasci, con chi. Bottoni Rigenera e Inizia,
// oppure "Racconta tu la tua famiglia" (FASE 9). Si sceglie anche chi controllare insieme al protagonista.

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
      <p class="tenue">${esc(v.classe)}${v.raccontata ? " · raccontata da te" : ""}</p>
      <p style="margin-top:12px">${esc(v.raccontata ? v.storia.slice(0, 400) + (v.storia.length > 400 ? "…" : "") : v.protagonista.infanzia)}</p>
      ${chips(v.protagonista.tratti, "accento")}
    </section>

    <section class="scheda">
      <h2>La famiglia</h2>
      <p class="nota" style="margin-bottom:10px">Giochi con ${esc(v.protagonista.nome)}. Puoi controllare insieme fino a ${v.controllati.massimo} persone (${v.controllati.quanti}/${v.controllati.massimo}).</p>
      <div class="persone">
        ${v.membri
          .map(
            (m) => `<div class="persona ${m.vivo ? "" : "morta"}">
              ${avatar(m.nome, m.sesso)}
              <div class="info">
                <div class="ruolo">${esc(m.ruolo)} · ${m.eta} anni</div>
                <div class="titolo">${esc(m.nome)}</div>
                <div class="riga">${esc(m.occupazione)}</div>
                ${m.storia ? `<div class="riga">${esc(m.storia)}</div>` : ""}
                ${m.ruolo !== "Tu" ? chips(m.tratti) : ""}
                ${m.controllabile ? `<button class="mini ${m.controllato ? "attivo" : ""}" data-azione="controlla-iniziale" data-id="${esc(m.id)}">${m.controllato ? "✓ Controllato" : "Controlla anche"}</button>` : ""}
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
        <div class="voce"><span>Risparmi di chi vive con te</span>${soldi(v.risparmi)}</div>
        ${v.debiti ? `<div class="voce"><span>Debiti</span>${soldi(-v.debiti, { segno: true })}</div>` : ""}
      </div>
    </section>

    <div class="bottoni">
      <button class="bottone secondario" data-azione="rigenera">${v.raccontata ? "Rigenera i dettagli" : "Rigenera"}</button>
      <button class="bottone" data-azione="inizia">Inizia</button>
    </div>
    <button class="bottone secondario" data-azione="racconto">${v.raccontata ? "Modifica il racconto" : "Racconta tu la tua famiglia"}</button>
    <div class="campo">
      <input id="seed" inputmode="numeric" aria-label="Seed della partita" value="${esc(v.seed)}">
      <button class="bottone secondario" style="width:auto;min-height:44px" data-azione="usa-seed">Usa seed</button>
    </div>
    <p class="nota">Lo stesso seed genera sempre la stessa famiglia.</p>`;
}
