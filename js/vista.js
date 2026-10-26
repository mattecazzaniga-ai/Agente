// Modelli di vista: trasformano lo stato in dati pronti da mostrare.
// Qui si decide COSA mostrare (testi, numeri, scelte disponibili); le schermate in js/ui/ decidono solo COME.
// Nessuna modifica allo stato: sono funzioni pure, testabili in Node.

import { eta, formatoEuro, nomeMestiere, NOMI_TITOLI } from "./util.js";
import { giocatore, vive } from "./state.js";
import { genere, madre, padre, fratelli, relazione } from "./family.js";
import { patrimonio, quotaCase, valoreAziende, membriNucleo, nettoPersona, rataMutuo } from "./economy.js";
import { costoCasa } from "./azioni.js";
import { requisitiScelta, testoEvento, testoScelta, titoloEvento } from "./events.js";
import { rigaAnno } from "./engine.js";

/** Volge al femminile un aggettivo del maschile singolare ("Ambizioso" → "Ambiziosa"). */
export function alGenere(parola, sesso) {
  if (sesso !== "F") return parola;
  return parola.replace(/^(\p{L}+)o\b/u, "$1a");
}

/** Valori in euro di oggi (l'indice dei prezzi riporta i valori nominali al 2026). */
const reale = (state, x) => Math.round(x / state.world.indice_prezzi);

const NOMI_CLASSE = { precaria: "Famiglia in difficoltà", media: "Famiglia nella media", agiata: "Famiglia agiata", ricca: "Famiglia ricca" };

const STAT = [
  { id: "salute", nome: "Salute" },
  { id: "morale", nome: "Morale" },
  { id: "felicita", nome: "Felicità" },
  { id: "stanchezza", nome: "Stanchezza", inversa: true },
  { id: "reputazione", nome: "Reputazione" },
];

/** Descrizione di una riga per l'occupazione di una persona. */
export function occupazione(state, data, p) {
  const anni = eta(p, state.world.anno);
  const f = p.sesso === "F";
  if (!vive(p)) return `Mort${f ? "a" : "o"} nel ${p.anno_morte} a ${anni} anni`;
  if (p.carriera.pensionato) return "In pensione";
  if (p.carriera.imprenditore) {
    const a = Object.values(state.aziende).find((x) => x.proprietario === p.id && !x.fallita);
    return a ? `Titolare di ${a.nome}` : f ? "Imprenditrice" : "Imprenditore";
  }
  if (p.carriera.lavoro) return `${nomeMestiere(data.mestiere[p.carriera.lavoro], p.sesso) ?? "Lavoro"}${p.carriera.part_time ? " (part-time)" : ""}`;
  const i = p.istruzione;
  if (i.iscritto) {
    if (i.livello === "universita") return `${data.facolta[i.facolta]?.nome ?? "Università"} · ${i.crediti} CFU${i.fuori_sede ? " · fuori sede" : ""}`;
    if (i.livello === "superiori") return `${data.superiore[i.indirizzo]?.nome ?? "Superiori"} · ${i.anno_corso}° anno`;
    if (i.livello === "medie") return `Scuola media · ${i.anno_corso}ª`;
    if (i.livello === "elementari") return `Scuola elementare · ${i.anno_corso}ª`;
  }
  if (anni < 6) return "Ancora piccol" + (f ? "a" : "o");
  if (p.carriera.naspi?.anni > 0) return "Disoccupat" + (f ? "a" : "o") + " (NASpI)";
  return anni < 25 ? "Cerca la sua strada" : "Senza lavoro";
}

/** Nome leggibile della relazione di q rispetto a p. */
export function ruolo(state, p, q) {
  const f = q.sesso === "F";
  if (q.id === p.id) return "Tu";
  if (q.id === p.madre) return "Madre";
  if (q.id === p.padre) return "Padre";
  if (q.id === p.partner) return f ? "Moglie" : "Marito";
  if (p.figli.includes(q.id)) return f ? "Figlia" : "Figlio";
  if (q.madre && (q.madre === p.madre || q.padre === p.padre)) return f ? "Sorella" : "Fratello";
  return "Parente";
}

/** Tratti e ricordi leggibili. */
function tratti(data, p) {
  return p.tratti.map((t) => ({ nome: alGenere(data.tratto[t]?.nome ?? t, p.sesso), descrizione: data.tratto[t]?.descrizione ?? "" }));
}
function ricordi(data, p) {
  return p.ricordi.map((r) => ({ nome: data.ricordo[r.id]?.nome ?? r.id, anno: r.anno, descrizione: data.ricordo[r.id]?.descrizione ?? "" }));
}

// ---------------------------------------------------------------------------
// Schermata di generazione della prima famiglia
// ---------------------------------------------------------------------------

export function vistaGeneratore(state, data) {
  const io = giocatore(state);
  const nucleo = state.nuclei[io.nucleo];
  const casa = nucleo.casa ? state.case[nucleo.casa] : null;
  const membri = [io, madre(state, io), padre(state, io), ...fratelli(state, io)].filter(Boolean);
  const azienda = Object.values(state.aziende)[0] ?? null;
  const risparmi = membri.reduce((s, p) => s + p.economia.risparmi, 0);
  const debiti = membri.reduce((s, p) => s + p.economia.debiti, 0);
  const separati = madre(state, io)?.stato_civile === "separato";
  return {
    cognome: state.famiglia.cognome,
    luogo: `${io.citta}, ${data.regione[io.regione].nome}`,
    classe: NOMI_CLASSE[state.famiglia.agiatezza],
    seed: state.world.seed,
    protagonista: { nome: io.nome, eta: eta(io, state.world.anno), sesso: io.sesso, tratti: tratti(data, io), infanzia: io.diario[0]?.righe[0] ?? "" },
    membri: membri.map((p) => ({ id: p.id, sesso: p.sesso, nome: `${p.nome} ${p.cognome}`, ruolo: ruolo(state, io, p), eta: eta(p, state.world.anno), occupazione: occupazione(state, data, p), storia: p.storia ?? null, tratti: tratti(data, p).map((t) => t.nome) })),
    note: [
      separati ? "I genitori sono separati: vivi con tua madre." : null,
      casa ? `${casa.nome} di proprietà${casa.mutuo_residuo > 0 ? `, mutuo residuo ${formatoEuro(casa.mutuo_residuo)}` : ""}` : "Casa in affitto",
      azienda ? `Azienda di famiglia: ${azienda.nome}` : null,
    ].filter(Boolean),
    casa: casa ? { nome: casa.nome, valore: casa.valore, mutuo: casa.mutuo_residuo } : null,
    risparmi,
    debiti,
  };
}

// ---------------------------------------------------------------------------
// Schermata Vita
// ---------------------------------------------------------------------------

export function vistaVita(state, data) {
  const io = giocatore(state);
  const anni = eta(io, state.world.anno);
  const b = io.economia.bilancio;
  const eventi = state.world.eventi_anno
    .map((e, indice) => ({ e, indice }))
    .filter(({ e }) => !e.risolto && e.persona === io.id)
    .map(({ e, indice }) => {
      const ev = data.evento[e.evento];
      return {
        indice,
        id: ev.id,
        tema: ev.tema,
        titolo: titoloEvento(state, data, io, ev),
        testo: testoEvento(state, data, io, ev, e.variante),
        scelte: ev.scelte.map((s) => {
          const r = requisitiScelta(state, data, io, s);
          return { id: s.id, testo: testoScelta(state, data, io, s), ok: r.ok, motivo: r.motivo ?? null };
        }),
      };
    });
  const risolti = state.world.eventi_anno.filter((e) => e.risolto && e.persona === io.id).map((e) => {
    const ev = data.evento[e.evento];
    const s = ev.scelte.find((x) => x.id === e.scelta);
    return { titolo: titoloEvento(state, data, io, ev), scelta: s ? testoScelta(state, data, io, s) : "", esito: e.esito };
  });
  return {
    fine: state.world.fase === "fine",
    anno: state.world.anno,
    nome: `${io.nome} ${io.cognome}`,
    sesso: io.sesso,
    eta: anni,
    luogo: `${io.citta}, ${data.regione[io.regione].nome}`,
    occupazione: occupazione(state, data, io),
    titolo: NOMI_TITOLI[io.istruzione.titolo],
    stat: STAT.map((s) => ({ ...s, valore: Math.round(io.stat[s.id]) })),
    tratti: tratti(data, io),
    ricordi: ricordi(data, io),
    soldi: {
      patrimonio: patrimonio(state, io),
      risparmi: io.economia.risparmi,
      debiti: io.economia.debiti,
      netto_anno: b?.netto ?? 0,
      saldo_anno: b?.saldo ?? 0,
      dipendente: anni < 18 && !io.carriera.lavoro,
    },
    eventi,
    risolti,
    riepilogo: state.world.ultimo_riepilogo && state.world.ultimo_riepilogo.anno === state.world.anno - 1 ? state.world.ultimo_riepilogo : null,
    famiglia: righeFamiglia(state, data, state.world.anno - 1).filter((r) => r.id !== io.id && r.vivo).slice(0, 4),
    epilogo: state.world.fase === "fine" ? epilogo(state, data, io) : null,
  };
}

/** Riassunto della vita a fine partita. */
function epilogo(state, data, p) {
  const lavori = [...new Set(p.carriera.storico.map((s) => nomeMestiere(data.mestiere[s.lavoro], p.sesso)).filter(Boolean))];
  const massimo = p.storico_patrimonio.reduce((m, x) => (x.valore > m.valore ? x : m), { valore: 0, anno: null });
  return {
    eta: eta(p, state.world.anno),
    anno_morte: p.anno_morte,
    causa: p.causa_morte,
    titolo: NOMI_TITOLI[p.istruzione.titolo],
    lavori,
    patrimonio_finale: p.storico_patrimonio.at(-1)?.valore ?? 0,
    patrimonio_massimo: massimo,
    ricordi: ricordi(data, p),
    diario: p.diario.slice(-6).reverse(),
  };
}

// ---------------------------------------------------------------------------
// Schermata Soldi
// ---------------------------------------------------------------------------

export function vistaSoldi(state, data) {
  const io = giocatore(state);
  const b = io.economia.bilancio;
  const nucleo = state.nuclei[io.nucleo];
  const casa = nucleo?.casa ? state.case[nucleo.casa] : null;
  const mia = Object.values(state.case).filter((c) => c.proprietari.includes(io.id));
  const membri = nucleo ? membriNucleo(state, io.nucleo) : [];
  const conGenitori = membri.some((m) => m.id === io.madre || m.id === io.padre);
  const prezzo = costoCasa(state, data, io);
  const storico = io.storico_patrimonio.map((x) => ({ anno: x.anno, valore: x.valore }));
  return {
    anno: state.world.anno,
    patrimonio: patrimonio(state, io),
    patrimonio_reale: reale(state, patrimonio(state, io)),
    risparmi: io.economia.risparmi,
    debiti: io.economia.debiti,
    case: quotaCase(state, io),
    aziende: valoreAziende(state, io),
    indice_prezzi: Math.round(state.world.indice_prezzi * 100) / 100,
    inflazione: Math.round(state.world.inflazione * 1000) / 10,
    reddito_previsto: Math.round(nettoPersona(state, data, io)),
    bilancio: b
      ? {
          anno: b.anno,
          righe: [
            { nome: "Reddito lordo", valore: b.lordo },
            { nome: "Contributi INPS", valore: -b.contributi },
            { nome: "IRPEF e addizionali", valore: -b.tasse },
            { nome: "Netto", valore: b.netto, forte: true },
            { nome: casa ? "Casa (rata, spese)" : "Affitto", valore: -b.spese_casa },
            { nome: "Vita quotidiana", valore: -b.spese_vita },
            ...(b.spese_studio ? [{ nome: "Studio", valore: -b.spese_studio }] : []),
            { nome: "Saldo dell'anno", valore: b.saldo, forte: true },
          ],
          nucleo: b.nucleo,
        }
      : null,
    abitazione: {
      descrizione: casa ? `${casa.nome}${mia.length ? "" : conGenitori ? " (dei tuoi genitori)" : ""}` : conGenitori ? "In affitto con la famiglia" : "In affitto",
      con_genitori: conGenitori,
      membri: membri.length,
      valore: casa?.valore ?? null,
      mutuo: casa?.mutuo_residuo ?? 0,
      rata: casa?.mutuo_residuo > 0 ? casa.rata : 0,
      mia: mia.length > 0,
    },
    casa_ideale: { prezzo: prezzo.prezzo, anticipo: prezzo.anticipo, rata: Math.round(rataMutuo(prezzo.prezzo - prezzo.anticipo, 0.035, 25)), citta: io.citta },
    storico,
  };
}

// ---------------------------------------------------------------------------
// Schermata Famiglia (FASE 1: elenco; l'albero SVG arriva nella FASE 3)
// ---------------------------------------------------------------------------

/** Una riga per ogni parente noto, con il riassunto del suo anno. */
export function righeFamiglia(state, data, anno = state.world.anno - 1) {
  const io = giocatore(state);
  const vicini = [io, madre(state, io), padre(state, io), ...fratelli(state, io), state.persone[io.partner], ...io.figli.map((id) => state.persone[id])].filter(Boolean);
  const unici = [...new Map(vicini.map((p) => [p.id, p])).values()];
  return unici.map((p) => ({
    id: p.id,
    nome: `${p.nome} ${p.cognome}`,
    ruolo: ruolo(state, io, p),
    eta: eta(p, state.world.anno),
    vivo: vive(p),
    sesso: p.sesso,
    occupazione: occupazione(state, data, p),
    legame: p.id === io.id ? null : relazione(state, io.id, p.id)?.intensita ?? null,
    tratti: tratti(data, p).map((t) => t.nome),
    riga: vive(p) || p.anno_morte >= anno ? rigaAnno(state, data, p, anno) : null,
    stesso_tetto: p.nucleo === io.nucleo && vive(p),
  }));
}

export function vistaFamiglia(state, data) {
  const io = giocatore(state);
  return {
    cognome: state.famiglia.cognome,
    reputazione: state.famiglia.reputazione,
    classe: NOMI_CLASSE[state.famiglia.agiatezza],
    pronome: genere(io),
    membri: righeFamiglia(state, data),
    diario: io.diario.slice().reverse(),
  };
}

// ---------------------------------------------------------------------------
// Impostazioni
// ---------------------------------------------------------------------------

export function vistaImpostazioni(state) {
  return {
    seed: state?.world.seed ?? null,
    anno: state?.world.anno ?? null,
    schema: state?.schema ?? null,
    nome: state ? `${giocatore(state).nome} ${giocatore(state).cognome}` : null,
  };
}
