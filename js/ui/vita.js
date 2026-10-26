// Schermata Vita: testata, carta dell'evento con le scelte, barre, soldi in breve, riepilogo dell'anno.

import { avatar, barra, chips, esc, soldi } from "./componenti.js";

const TEMI = { scuola: "Scuola", universita: "Università", studio: "Studio", lavoro: "Lavoro", soldi: "Soldi", amicizie: "Amicizie", salute: "Salute", famiglia: "Famiglia" };

function testata(v) {
  return `<header class="testata">
    ${avatar(v.nome, v.sesso)}
    <div>
      <div class="nome">${esc(v.nome)}</div>
      <div class="sotto">${v.eta} anni · ${esc(v.occupazione)}</div>
    </div>
    <div class="anno-chip">${v.anno}</div>
  </header>`;
}

function cartaEvento(ev, n, totale) {
  return `<section class="scheda evento" aria-live="polite">
    ${totale > 1 ? `<span class="contatore">${n} di ${totale}</span>` : ""}
    <div class="etichetta tema">${esc(TEMI[ev.tema] ?? ev.tema)}</div>
    <h2>${esc(ev.titolo)}</h2>
    <p class="testo">${esc(ev.testo)}</p>
    <div class="scelte">
      ${ev.scelte
        .map(
          (s) => `<button class="scelta" data-azione="scegli" data-indice="${ev.indice}" data-scelta="${esc(s.id)}" ${s.ok ? "" : "disabled"}>
            ${esc(s.testo)}${s.motivo ? `<span class="motivo">${esc(s.motivo)}</span>` : ""}
          </button>`,
        )
        .join("")}
    </div>
  </section>`;
}

function esitiAnno(v) {
  if (!v.risolti.length) return "";
  return `<div class="esiti">${v.risolti
    .map((r) => `<div class="esito"><strong>${esc(r.titolo)}</strong>${esc(r.scelta)}${r.esito ? ` — ${esc(r.esito)}` : ""}</div>`)
    .join("")}</div>`;
}

function riepilogo(v) {
  if (!v.riepilogo?.righe.length && !v.famiglia.length) return "";
  return `<section class="scheda riepilogo">
    <h2>Il ${v.riepilogo?.anno ?? v.anno - 1} in breve</h2>
    ${v.riepilogo?.righe.length ? `<ul>${v.riepilogo.righe.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : `<p class="tenue">Un anno tranquillo.</p>`}
    ${v.famiglia.length ? `<div class="famiglia">${v.famiglia.map((f) => `<p><b>${esc(f.ruolo)}:</b> ${esc(f.riga)}</p>`).join("")}</div>` : ""}
  </section>`;
}

function soldiInBreve(s) {
  if (s.dipendente) return `<div class="soldi-mini"><div><span class="etichetta">Paghetta e risparmi</span><b>${soldi(s.risparmi)}</b></div><div><span class="etichetta">Patrimonio</span><b>${soldi(s.patrimonio)}</b></div></div>`;
  return `<div class="soldi-mini">
    <div><span class="etichetta">Patrimonio</span><b>${soldi(s.patrimonio)}</b></div>
    <div><span class="etichetta">Netto anno</span><b>${soldi(s.netto_anno)}</b></div>
    <div><span class="etichetta">Saldo</span><b>${soldi(s.saldo_anno, { segno: true })}</b></div>
  </div>`;
}

function fine(v) {
  const e = v.epilogo;
  return `${testata(v)}
    <section class="scheda evento">
      <div class="etichetta tema">Fine</div>
      <h2>${esc(v.nome)} (${e.anno_morte - v.eta}–${e.anno_morte})</h2>
      <p class="testo">È mort${v.sesso === "F" ? "a" : "o"} a ${e.eta} anni${e.causa ? ` (${esc(e.causa)})` : ""}.</p>
      <div class="voci">
        <div class="voce"><span>Studi</span><span>${esc(e.titolo)}</span></div>
        <div class="voce"><span>Lavori</span><span>${esc(e.lavori.join(", ") || "—")}</span></div>
        <div class="voce"><span>Patrimonio lasciato</span>${soldi(e.patrimonio_finale)}</div>
        ${e.patrimonio_massimo.anno ? `<div class="voce"><span>Massimo raggiunto (${e.patrimonio_massimo.anno})</span>${soldi(e.patrimonio_massimo.valore)}</div>` : ""}
      </div>
      ${chips(e.ricordi, "accento")}
    </section>
    <section class="scheda riepilogo">
      <h2>Gli ultimi anni</h2>
      <div class="diario">${e.diario.map((d) => `<div><div class="anno">${d.anno}</div><ul>${d.righe.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`).join("")}</div>
    </section>
    <p class="nota">Nella FASE 2 la storia continuerà con un erede. Per ora puoi ricominciare con una nuova famiglia.</p>
    <button class="bottone" data-azione="nuova">Nuova partita</button>`;
}

/** `precedenti`: valori delle barre all'ultimo disegno, per animarle dal vecchio al nuovo. */
export function disegna(v, precedenti = {}) {
  if (v.fine) return fine(v);
  const prossimo = v.eventi[0];
  const totale = v.eventi.length + v.risolti.length;
  return `${testata(v)}
    ${prossimo ? "" : riepilogo(v)}
    ${esitiAnno(v)}
    ${prossimo ? cartaEvento(prossimo, v.risolti.length + 1, totale) : `<button class="bottone" data-azione="avanza">Vivi il ${v.anno} →</button>`}
    <section class="scheda">
      <div class="barre">${v.stat.map((s) => barra(s, precedenti[s.id])).join("")}</div>
      ${chips(v.tratti)}
    </section>
    ${soldiInBreve(v.soldi)}
    ${prossimo ? riepilogo(v) : ""}`;
}
