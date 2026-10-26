// Schermata Impostazioni: salvataggi su file, nuova partita, informazioni.

import { esc } from "./componenti.js";

/** Sezione del narratore AI (Gemini). La chiave non viene mai mostrata per intero. */
function narratore(ai) {
  if (!ai) return "";
  return `<section class="scheda">
      <h2>Narratore AI (Gemini)</h2>
      <p class="nota" style="margin-bottom:12px">Facoltativo. L'AI riscrive soltanto i testi degli eventi, il riassunto dell'anno e l'epitaffio: scelte, soldi e salute restano decisi dal gioco. Se non risponde o sbaglia, si usano i testi del gioco.</p>
      <label class="interruttore"><span>Usa il narratore AI</span><input type="checkbox" id="ai-attivo" ${ai.attivo ? "checked" : ""}></label>
      <label class="campo-ai"><span>Chiave API Gemini ${ai.ha_chiave ? `<span class="tenue">(salvata: ${esc(ai.chiave_mascherata)})</span>` : ""}</span>
        <input type="password" id="ai-chiave" autocomplete="off" spellcheck="false" placeholder="${ai.ha_chiave ? "Lascia vuoto per tenere quella salvata" : "Incolla qui la chiave"}">
      </label>
      <label class="campo-ai"><span>Modello</span><input type="text" id="ai-modello" value="${esc(ai.modello)}" autocomplete="off" spellcheck="false"></label>
      <div class="griglia-2" style="margin-bottom:12px">
        <label class="campo-ai"><span>Richieste al minuto</span><input type="number" id="ai-minuto" min="1" max="30" value="${ai.limite_minuto}"></label>
        <label class="campo-ai"><span>Richieste al giorno</span><input type="number" id="ai-giorno" min="1" max="1500" value="${ai.limite_giorno}"></label>
      </div>
      <p class="nota" style="margin-bottom:12px">Oggi: <b>${ai.usate_oggi}</b>/${ai.limite_giorno} richieste · ${ai.racconti} testi già raccontati${ai.ultimo_errore ? `<br><span class="negativo">${esc(ai.ultimo_errore)}</span>` : ""}</p>
      <div class="bottoni">
        <button class="bottone" data-azione="ai-salva">Salva</button>
        <button class="bottone secondario" data-azione="ai-prova">Prova</button>
      </div>
      ${ai.ha_chiave ? `<button class="bottone pericolo" style="margin-top:10px" data-azione="ai-cancella">Cancella la chiave da questo browser</button>` : ""}
      <p class="nota" style="margin-top:12px">La chiave resta solo in questo browser: non è nel codice, non entra nel salvataggio e non finisce nei file esportati. La crei gratis su Google AI Studio (aistudio.google.com → Get API key). I testi inviati a Gemini sono quelli dell'evento e qualche dato del personaggio (nome, età, città, carattere).</p>
    </section>`;
}

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
      ${v.dinastia ? `<p class="nota">Dinastia ${esc(v.dinastia.cognome)} · generazione ${v.dinastia.generazione} · ${v.dinastia.giocati.length === 1 ? "1 personaggio giocato" : `${v.dinastia.giocati.length} personaggi giocati`} · ${v.controllati}/${v.massimo} controllati</p>` : ""}
      <p class="nota" style="margin:4px 0 12px">Seed ${esc(v.seed)} · schema ${esc(v.schema)}</p>
      <button class="bottone pericolo" data-azione="nuova">Nuova partita</button>
    </section>

    ${narratore(v.ai)}

    <p class="nota" style="text-align:center">Dinastia · gioco personale, funziona offline</p>`;
}
