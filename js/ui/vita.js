// Schermata Vita: testata, coda dei personaggi, carta dell'evento con le scelte, barre, soldi in breve,
// riepilogo dell'anno. Alla morte del principale: scelta dell'erede; a dinastia estinta: epilogo.

import { avatar, barra, chips, esc, soldi } from "./componenti.js";

const TEMI = { ai: "Imprevisto ✦", scuola: "Scuola", universita: "Università", studio: "Studio", lavoro: "Lavoro", soldi: "Soldi", amicizie: "Amicizie", salute: "Salute", famiglia: "Famiglia", amore: "Amore", figli: "Figli", azienda: "Azienda", adulti: "Vita adulta" };

/** Etichetta della congiuntura quando non sono anni normali (FASE 6). */
function momento(v) {
  if (!v.mondo || v.mondo.congiuntura === "normale") return "";
  return `<div class="momento ${esc(v.mondo.congiuntura)}">${esc(v.mondo.nome)} in Italia</div>`;
}

function testata(v) {
  return `${momento(v)}<header class="testata">
    ${avatar(v.nome, v.sesso)}
    <div>
      <div class="nome">${esc(v.nome)}</div>
      <div class="sotto">${v.fase === "gioco" ? `${v.eta} anni · ${esc(v.occupazione)}` : `${v.nascita}–${v.epilogo?.anno_morte ?? ""}`}</div>
    </div>
    <div class="anno-chip">${v.anno}</div>
  </header>`;
}

/** Con più personaggi controllati: chi ha ancora eventi da decidere quest'anno. */
function coda(v) {
  if (v.coda.length < 2) return "";
  return `<div class="coda" aria-label="Personaggi controllati">${v.coda
    .map((c) => `<span class="coda-voce ${c.da_fare ? "attiva" : ""}">${avatar(c.nome, c.sesso)}<span>${esc(c.primo)}${c.da_fare ? ` · ${c.da_fare}` : " ✓"}</span></span>`)
    .join("")}</div>`;
}

/** Testo raccontato dall'AI se c'è già, altrimenti quello del gioco (main.js lo sostituisce quando arriva). */
function testoRaccontato(chiave, base, racconti, classe, tag = "p") {
  const ai = racconti(chiave);
  return `<${tag} class="${classe} ${ai ? "ai" : ""}" data-racconto="${esc(chiave)}">${esc(ai ?? base)}</${tag}>`;
}

function cartaEvento(ev, n, totale, racconti) {
  const chi = ev.persona.principale
    ? ""
    : `<div class="per-chi">${avatar(ev.persona.nome, ev.persona.sesso)}<div><b>${esc(ev.persona.nome)}</b><span>${esc(ev.persona.ruolo)} · ${ev.persona.eta} anni</span></div></div>`;
  return `<section class="scheda evento ${ev.persona.principale ? "" : "altro"}" aria-live="polite">
    ${totale > 1 ? `<span class="contatore">${n} di ${totale}</span>` : ""}
    ${chi}
    <div class="etichetta tema">${esc(TEMI[ev.tema] ?? ev.tema)}</div>
    <h2>${esc(ev.titolo)}</h2>
    ${ev.racconto ? testoRaccontato(ev.racconto.chiave, ev.testo, racconti, "testo") : `<p class="testo">${esc(ev.testo)}</p>`}
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
    .map((r) => `<div class="esito"><strong>${r.persona ? `${esc(r.persona)} · ` : ""}${esc(r.titolo)}</strong>${esc(r.scelta)}${r.esito ? ` — ${esc(r.esito)}` : ""}</div>`)
    .join("")}</div>`;
}

function riepilogo(v, racconti) {
  const r = v.riepilogo;
  if (!r?.righe.length && !r?.altri?.length && !r?.notizie?.length && !v.famiglia.length) return "";
  return `<section class="scheda riepilogo">
    <h2>Il ${r?.anno ?? v.anno - 1} in breve</h2>
    ${r?.racconto ? testoRaccontato(r.racconto.chiave, "", racconti, "racconto-anno") : ""}
    ${r?.notizie?.length ? `<div class="notizie"><span class="etichetta">Dall'Italia</span>${r.notizie.map((n) => `<p>${esc(n)}</p>`).join("")}</div>` : ""}
    ${r?.righe.length ? `<ul>${r.righe.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="tenue">Un anno tranquillo.</p>`}
    ${(r?.altri ?? []).map((a) => `<div class="altro-anno"><b>${esc(a.nome)}</b> <span class="tenue">(${esc(a.ruolo)})</span><ul>${a.righe.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}
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

function cartaMorte(v, racconti) {
  const e = v.epilogo;
  return `<section class="scheda evento">
      <div class="etichetta tema">Fine di una vita</div>
      <h2>${esc(v.nome)} (${e.anno_morte - e.eta}–${e.anno_morte})</h2>
      <p class="testo">È mort${v.sesso === "F" ? "a" : "o"} a ${e.eta} anni${e.causa ? ` (${esc(e.causa)})` : ""}.</p>
      ${testoRaccontato(e.racconto.chiave, "", racconti, "epitaffio")}
      <div class="voci">
        <div class="voce"><span>Studi</span><span>${esc(e.titolo)}</span></div>
        <div class="voce"><span>Lavori</span><span>${esc(e.lavori.join(", ") || "—")}</span></div>
        <div class="voce"><span>Figli</span><span>${esc(e.figli.join(", ") || "—")}</span></div>
        <div class="voce"><span>Patrimonio lasciato</span>${soldi(e.patrimonio_finale)}</div>
        ${e.patrimonio_massimo.anno ? `<div class="voce"><span>Massimo raggiunto (${e.patrimonio_massimo.anno})</span>${soldi(e.patrimonio_massimo.valore)}</div>` : ""}
      </div>
      ${chips(e.ricordi, "accento")}
    </section>`;
}

function dinastia(d) {
  return `<section class="scheda">
    <h2>Dinastia ${esc(d.cognome)}</h2>
    <p class="tenue piccolo">${d.anni} anni di storia · generazione ${d.generazione} · reputazione del cognome ${d.reputazione}/100</p>
    <div class="voci" style="margin-top:8px">${d.giocati
      .map((g) => `<div class="voce"><span>${esc(g.nome)}</span><span class="tenue">${g.dal}–${g.al ?? "oggi"}</span></div>`)
      .join("")}</div>
  </section>`;
}

function erede(v, racconti) {
  return `${testata(v)}
    ${cartaMorte(v, racconti)}
    <section class="scheda">
      <h2>Chi continua la storia?</h2>
      <p class="nota" style="margin-bottom:12px">Scegli la persona della famiglia da giocare adesso. Gli altri continueranno a vivere da soli.</p>
      <div class="persone">
        ${v.candidati
          .map(
            (c) => `<button class="candidato" data-azione="continua" data-id="${esc(c.id)}">
              ${avatar(c.nome, c.sesso)}
              <div class="info">
                <div class="ruolo">${esc(c.motivo)} · ${c.eta} anni</div>
                <div class="titolo">${esc(c.nome)}</div>
                <div class="riga">${esc(c.occupazione)}</div>
                ${chips(c.tratti)}
              </div>
            </button>`,
          )
          .join("")}
      </div>
    </section>
    ${dinastia(v.dinastia)}`;
}

function fine(v, racconti) {
  return `${testata(v)}
    ${cartaMorte(v, racconti)}
    <section class="scheda">
      <h2>La dinastia si è estinta</h2>
      <p class="nota">Non resta nessuno della famiglia che possa continuare la storia.</p>
    </section>
    ${dinastia(v.dinastia)}
    <section class="scheda riepilogo">
      <h2>Gli ultimi anni</h2>
      <div class="diario">${v.epilogo.diario.map((d) => `<div><div class="anno">${d.anno}</div><ul>${d.righe.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`).join("")}</div>
    </section>
    <button class="bottone" data-azione="nuova">Nuova partita</button>`;
}

/** Riassunto degli anni saltati (FASE 9). */
function anniSaltati(s) {
  if (!s) return "";
  const pieni = s.anni.filter((a) => a.righe.length);
  return `<section class="scheda riepilogo salto">
    <h2>Dal ${s.da} al ${s.a - 1}</h2>
    ${pieni.length ? `<div class="diario">${pieni.map((a) => `<div><div class="anno">${a.anno}</div><ul>${a.righe.map((r) => `<li><b>${esc(r.chi)}:</b> ${esc(r.testo)}</li>`).join("")}</ul></div>`).join("")}</div>` : `<p class="tenue">Anni tranquilli.</p>`}
    <button class="bottone secondario" style="margin-top:12px" data-azione="chiudi-salto">Ok</button>
  </section>`;
}

/** Pulsanti per andare avanti di più anni lasciando decidere al carattere. */
function salta() {
  return `<div class="salta"><span class="etichetta">Salta avanti</span>${[5, 10, 20].map((n) => `<button class="mini" data-azione="salta" data-anni="${n}">${n} anni</button>`).join("")}</div>`;
}

/** `precedenti`: valori delle barre all'ultimo disegno, per animarle dal vecchio al nuovo. */
export function disegna(v, precedenti = {}, racconti = () => null, salto = null) {
  if (v.fase === "erede") return `${anniSaltati(salto)}${erede(v, racconti)}`;
  if (v.fase === "fine") return `${anniSaltati(salto)}${fine(v, racconti)}`;
  const prossimo = v.eventi[0];
  const totale = v.eventi.length + v.risolti.length;
  return `${testata(v)}
    ${coda(v)}
    ${anniSaltati(salto)}
    ${prossimo || salto ? "" : riepilogo(v, racconti)}
    ${esitiAnno(v)}
    ${
      prossimo
        ? `${cartaEvento(prossimo, v.risolti.length + 1, totale, racconti)}${v.eventi.length > 1 ? `<button class="bottone secondario" data-azione="automatico">Lascia decidere gli altri ${v.eventi.length - 1} al carattere</button>` : ""}`
        : `<button class="bottone" data-azione="avanza">Vivi il ${v.anno} →</button>`
    }
    ${salta()}
    <section class="scheda">
      <div class="barre">${v.stat.map((s) => barra(s, precedenti[s.id])).join("")}</div>
      <p class="tenue piccolo" style="margin-top:10px">${esc(v.stato_civile)} · ${esc(v.titolo)}</p>
      ${chips(v.tratti)}
    </section>
    ${soldiInBreve(v.soldi)}
    ${prossimo ? riepilogo(v, racconti) : ""}`;
}
