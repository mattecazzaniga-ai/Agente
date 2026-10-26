// Schermata Impostazioni: salvataggi su file, nuova partita, informazioni.

import { esc } from "./componenti.js";

export function disegna(v) {
  return `
    <section class="scheda impostazioni">
      <h2>Salvataggio</h2>
      <p class="nota" style="margin-bottom:12px">La partita si salva da sola in questo browser a ogni scelta. Esporta un file per tenerne una copia o spostarla su un altro dispositivo.</p>
      <button class="bottone secondario" data-azione="esporta">Esporta partita (JSON)</button>
      <button class="bottone secondario" data-azione="importa">Importa partita</button>
      <input type="file" id="file-import" accept="application/json,.json" hidden>
    </section>

    <section class="scheda impostazioni">
      <h2>Partita</h2>
      ${v.nome ? `<p class="piccolo">${esc(v.nome)} · anno ${v.anno}</p>` : ""}
      <p class="nota" style="margin:4px 0 12px">Seed ${esc(v.seed)} · schema ${esc(v.schema)}</p>
      <button class="bottone pericolo" data-azione="nuova">Nuova partita</button>
    </section>

    <section class="scheda">
      <h2>Racconto con l'AI</h2>
      <p class="nota">In arrivo nella FASE 5: potrai inserire qui la tua chiave Gemini, che resterà solo in questo browser. Il gioco funziona benissimo anche senza.</p>
    </section>

    <p class="nota" style="text-align:center">Dinastia · gioco personale, funziona offline</p>`;
}
