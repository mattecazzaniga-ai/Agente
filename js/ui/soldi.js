// Schermata Soldi: patrimonio, bilancio dell'ultimo anno, casa e mutuo, andamento negli anni.

import { esc, grafico, soldi } from "./componenti.js";

export function disegna(v) {
  const a = v.abitazione;
  return `
    <section class="scheda">
      <div class="etichetta">Patrimonio netto · ${v.anno}</div>
      <div class="cifra ${v.patrimonio < 0 ? "negativo" : ""}">${soldi(v.patrimonio)}</div>
      <p class="tenue piccolo">Pari a ${soldi(v.patrimonio_reale)} in euro del 2026 · prezzi ×${v.indice_prezzi}, inflazione ${v.inflazione}%</p>
      <div class="griglia-2" style="margin-top:12px">
        <div class="box"><span class="etichetta">Risparmi</span><b>${soldi(v.risparmi)}</b></div>
        <div class="box"><span class="etichetta">Debiti</span><b>${v.debiti ? soldi(-v.debiti, { segno: true }) : soldi(0)}</b></div>
        <div class="box"><span class="etichetta">Case (quota)</span><b>${soldi(v.case)}</b></div>
        <div class="box"><span class="etichetta">Aziende</span><b>${soldi(v.aziende)}</b></div>
      </div>
    </section>

    <section class="scheda">
      <h2>${v.bilancio ? `Bilancio ${v.bilancio.anno}` : "Bilancio"}</h2>
      ${
        v.bilancio
          ? `<div class="voci">${v.bilancio.righe.map((r) => `<div class="voce ${r.forte ? "forte" : ""}"><span>${esc(r.nome)}</span>${soldi(r.valore, { segno: r.nome === "Saldo dell'anno" })}</div>`).join("")}</div>
             <p class="nota" style="margin-top:8px">${v.bilancio.nucleo.membri > 1 ? `Le spese sono condivise da ${v.bilancio.nucleo.membri} persone: qui c'è la tua parte, in proporzione a quanto porti a casa.` : "Nel tuo nucleo ci sei solo tu: tutte le spese sono tue."}${v.bilancio.nucleo.mantenimento ? ` Assegno di mantenimento: ${soldi(v.bilancio.nucleo.mantenimento, { segno: true })}.` : ""}${v.bilancio.nucleo.assegno ? ` Assegno unico per i figli: ${soldi(v.bilancio.nucleo.assegno, { segno: true })}.` : ""}${v.bilancio.nucleo.inclusione ? ` Assegno di inclusione: ${soldi(v.bilancio.nucleo.inclusione, { segno: true })}.` : ""}</p>
             ${v.bilancio.nucleo.membri > 1 ? `<div class="voci" style="margin-top:6px"><div class="voce"><span>Entrate del nucleo</span>${soldi(v.bilancio.nucleo.entrate)}</div><div class="voce"><span>Spese del nucleo</span>${soldi(-v.bilancio.nucleo.spese, { segno: true })}</div>${v.nucleo.filter((m) => m.netto > 0).map((m) => `<div class="voce"><span>${esc(m.ruolo)} (${esc(m.nome)}) porta a casa</span>${soldi(m.netto)}</div>`).join("")}</div>` : ""}`
          : `<p class="tenue">Il primo bilancio arriva alla fine dell'anno.</p>`
      }
      ${v.reddito_previsto ? `<p class="piccolo" style="margin-top:8px">Reddito netto previsto quest'anno: <b>${soldi(v.reddito_previsto)}</b></p>` : ""}
    </section>

    <section class="scheda">
      <h2>Casa</h2>
      <div class="voci">
        <div class="voce"><span>Dove vivi</span><span>${esc(a.descrizione)}</span></div>
        ${a.valore ? `<div class="voce"><span>Valore</span>${soldi(a.valore)}</div>` : ""}
        ${a.mutuo ? `<div class="voce"><span>Mutuo residuo</span>${soldi(-a.mutuo, { segno: true })}</div><div class="voce"><span>Rata annua</span>${soldi(a.rata)}</div>` : ""}
        ${a.mia ? "" : `<div class="voce"><span>Una casa a ${esc(v.casa_ideale.citta)} costa</span>${soldi(v.casa_ideale.prezzo)}</div>
        <div class="voce"><span>Anticipo necessario</span>${soldi(v.casa_ideale.anticipo)}</div>
        <div class="voce"><span>Rata mutuo (25 anni, 3,5%)</span><span>${soldi(v.casa_ideale.rata)}/anno</span></div>`}
      </div>
    </section>

    ${
      v.altre_case.length
        ? `<section class="scheda"><h2>Altre case</h2><div class="voci">${v.altre_case
            .map((c) => `<div class="voce"><span>${esc(c.nome)}${c.quota ? ` (quota ${c.quota})` : ""} · affittata</span>${soldi(c.valore)}</div>`)
            .join("")}</div><p class="nota" style="margin-top:6px">Le case dove non vive nessuno sono affittate: l'affitto (con cedolare secca al 21%) paga mutuo e spese, il resto va ai proprietari.</p></section>`
        : ""
    }

    ${
      v.azienda
        ? `<section class="scheda"><h2>${esc(v.azienda.nome)}</h2><div class="voci">
            <div class="voce"><span>Ruolo</span><span>${esc(v.azienda.ruolo)}</span></div>
            <div class="voce"><span>Valore</span>${soldi(v.azienda.valore)}</div>
            <div class="voce"><span>Fatturato</span>${soldi(v.azienda.fatturato)}</div>
            <div class="voce"><span>Utile per il titolare</span>${soldi(v.azienda.utile)}</div>
            <div class="voce"><span>Fondata nel</span><span>${v.azienda.fondata}</span></div>
          </div>
          <div class="barra ${v.azienda.salute < 30 ? "basso" : v.azienda.salute >= 75 ? "alto" : ""}" style="margin-top:10px"><div class="riga"><span>Salute dell'azienda</span><b>${v.azienda.salute}</b></div><div class="traccia"><div class="pieno" style="width:${v.azienda.salute}%"></div></div></div>
        </section>`
        : ""
    }

    <section class="scheda">
      <h2>Andamento del patrimonio</h2>
      ${grafico(v.storico)}
    </section>`;
}
