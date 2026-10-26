// Schermata "Racconta la tua famiglia" (FASE 9): testo libero (che l'AI può trasformare in famiglia)
// oppure un modulo semplice. Solo HTML: la famiglia la costruisce js/racconto.js.

import { esc } from "./componenti.js";

const opzioni = (lista, valore, vuota = "Non lo so") => `<option value="">${esc(vuota)}</option>${lista.map((x) => `<option value="${esc(x.id)}" ${x.id === valore ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}`;
const campo = (id, etichetta, v, attr = "") => `<label class="campo-ai"><span>${etichetta}</span><input id="${id}" value="${esc(v[id] ?? "")}" autocomplete="off" ${attr}></label>`;

export function disegna(r) {
  const v = r.valori;
  const tutteCitta = [...new Set(r.regioni.flatMap((x) => x.citta))].sort((a, b) => a.localeCompare(b, "it"));
  return `
    <header class="titolo-gioco">
      <h1>La tua famiglia</h1>
      <p>Racconta chi sono, dove vivono, cosa fanno. Il gioco parte da lì e continua per generazioni.</p>
    </header>

    <section class="scheda">
      <h2>Il racconto</h2>
      <p class="nota" style="margin-bottom:8px">Scrivi liberamente: chi sei, quanti anni hai, la tua famiglia, il lavoro, la città, com'è il carattere di ognuno.${r.ai ? " Con il narratore AI attivo, il gioco legge il racconto e compila la famiglia da solo." : " Il racconto resta nella storia della famiglia; i dettagli compilali qui sotto (o attiva il narratore AI in Impostazioni per farli leggere dal racconto)."}</p>
      <textarea id="r-storia" rows="7" placeholder="Mi chiamo Marco, ho 38 anni e faccio l'elettricista a Napoli. Sono sposato con Anna, infermiera, e abbiamo due figli, Luca di 10 anni e Sofia di 6. Mia madre Rosa vive vicino a noi; papà Gennaro non c'è più…">${esc(v.storia ?? "")}</textarea>
      ${r.ai ? `<button class="bottone" style="margin-top:12px" data-azione="racconto-ai">Crea la famiglia dal racconto ✦</button>` : ""}
    </section>

    <section class="scheda racconto">
      <h2>${r.ai ? "Oppure compila tu" : "I dettagli"}</h2>
      <p class="nota" style="margin-bottom:12px">Quello che lasci vuoto lo decide il gioco.</p>
      <div class="griglia-2">
        ${campo("r-cognome", "Cognome", v)}
        <label class="campo-ai"><span>Regione</span><select id="r-regione">${opzioni(r.regioni, v["r-regione"], "A caso")}</select></label>
        ${campo("r-citta", "Città", v, 'list="r-citta-lista"')}
        <label class="campo-ai"><span>Situazione economica</span><select id="r-agiatezza">${opzioni(
          [
            { id: "precaria", nome: "In difficoltà" },
            { id: "media", nome: "Nella media" },
            { id: "agiata", nome: "Agiata" },
            { id: "ricca", nome: "Ricca" },
          ],
          v["r-agiatezza"],
          "A caso",
        )}</select></label>
      </div>
      <datalist id="r-citta-lista">${tutteCitta.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>

      <h3 style="margin-top:14px">Tu</h3>
      <div class="griglia-2">
        ${campo("r-nome", "Nome", v)}
        ${campo("r-eta", "Età (dai 6 anni)", v, 'type="number" min="6" max="90" inputmode="numeric"')}
        <label class="campo-ai"><span>Sesso</span><select id="r-sesso">${opzioni(
          [
            { id: "F", nome: "Donna" },
            { id: "M", nome: "Uomo" },
          ],
          v["r-sesso"],
          "Dal nome",
        )}</select></label>
        <label class="campo-ai"><span>Lavoro</span><select id="r-lavoro">${opzioni(r.mestieri, v["r-lavoro"], "Lo decide il gioco")}</select></label>
      </div>
      <label class="campo-ai"><span>Carattere (fino a 3)</span>
        <div class="chips scegli-tratti">${r.tratti.map((t) => `<label class="chip"><input type="checkbox" name="r-tratti" value="${esc(t.id)}" ${(v["r-tratti"] ?? []).includes(t.id) ? "checked" : ""}> ${esc(t.nome)}</label>`).join("")}</div>
      </label>

      <h3 style="margin-top:14px">I genitori</h3>
      <div class="griglia-2">
        ${campo("r-madre", "Madre", v)}
        ${campo("r-madre-eta", "Età", v, 'type="number" min="20" max="110" inputmode="numeric"')}
        ${campo("r-padre", "Padre", v)}
        ${campo("r-padre-eta", "Età", v, 'type="number" min="20" max="110" inputmode="numeric"')}
      </div>
      <label class="interruttore"><span>La madre non c'è più</span><input type="checkbox" id="r-madre-morta" ${v["r-madre-morta"] ? "checked" : ""}></label>
      <label class="interruttore"><span>Il padre non c'è più</span><input type="checkbox" id="r-padre-morto" ${v["r-padre-morto"] ? "checked" : ""}></label>
      <label class="interruttore"><span>Sono separati</span><input type="checkbox" id="r-separati" ${v["r-separati"] ? "checked" : ""}></label>

      <h3 style="margin-top:14px">Il resto della famiglia</h3>
      <div class="griglia-2">
        ${campo("r-partner", "Moglie, marito o partner", v)}
        ${campo("r-partner-eta", "Età", v, 'type="number" min="16" max="110" inputmode="numeric"')}
      </div>
      ${campo("r-figli", "Figli (es. «Giulia 5, Marco 2»)", v)}
      ${campo("r-fratelli", "Fratelli e sorelle (es. «Luca 12, Sara 8»)", v)}
      <div class="griglia-2">
        <label class="campo-ai"><span>Casa</span><select id="r-casa">${opzioni(
          [
            { id: "proprieta", nome: "Di proprietà" },
            { id: "affitto", nome: "In affitto" },
          ],
          v["r-casa"],
          "A caso",
        )}</select></label>
        ${campo("r-azienda", "Azienda di famiglia (nome)", v)}
      </div>
      <button class="bottone" style="margin-top:6px" data-azione="racconto-crea">Crea la famiglia</button>
    </section>

    <button class="bottone secondario" data-azione="racconto-annulla">Torna alla famiglia a caso</button>`;
}
