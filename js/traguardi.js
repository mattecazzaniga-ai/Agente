// Traguardi e storia della dinastia (FASE 7). I traguardi sono in data/traguardi.json;
// qui ci sono le regole che li verificano e la registrazione annuale del patrimonio di famiglia.

import { eta, titoloAlmeno } from "./util.js";
import { personeVive, vive } from "./state.js";
import { patrimonio } from "./economy.js";
import { figliVivi, nipoti, partnerDi } from "./family.js";

const sangue = (state) => Object.values(state.persone).filter((p) => p.sangue);
// i traguardi "personali" contano dalla prima generazione giocata in poi (non i genitori di partenza)
const discendenti = (state) => sangue(state).filter((p) => (p.generazione ?? 1) >= 1);
const sangueVivi = (state) => personeVive(state).filter((p) => p.sangue);

/** Patrimonio netto di tutte le persone di sangue vive, in euro del 2026. */
export function patrimonioFamiglia(state) {
  return Math.round(sangueVivi(state).reduce((s, p) => s + patrimonio(state, p), 0) / state.world.indice_prezzi);
}

/**
 * Regole: ognuna restituisce la persona che ha raggiunto il traguardo (o true se riguarda tutta
 * la famiglia), altrimenti null.
 */
const REGOLE = {
  titolo: (state, _d, { titolo }) => discendenti(state).find((p) => titoloAlmeno(p.istruzione.titolo, titolo)),
  ricordo: (state, _d, { ricordo }) => discendenti(state).find((p) => p.ricordi.some((r) => r.id === ricordo)),
  casa_propria: (state) => sangueVivi(state).find((p) => (p.generazione ?? 0) >= 1 && Object.values(state.case).some((c) => c.proprietari.includes(p.id) && !c.proprietari.includes(p.madre) && !c.proprietari.includes(p.padre))),
  eta: (state, _d, { eta: anni }) => sangueVivi(state).find((p) => eta(p, state.world.anno) >= anni),
  generazione: (state, _d, { n }) => sangue(state).find((p) => (p.generazione ?? 0) + 1 >= n),
  figli: (state, _d, { n }) => discendenti(state).find((p) => (p.figli ?? []).length >= n),
  nipoti: (state) => sangueVivi(state).find((p) => nipoti(state, p).length > 0),
  matrimonio: (state, _d, { anni }) => sangueVivi(state).find((p) => p.stato_civile === "sposato" && partnerDi(state, p) && state.world.anno - (p.coppia_dal ?? state.world.anno) >= anni),
  patrimonio: (state, _d, { euro }) => (patrimonioFamiglia(state) >= euro ? true : null),
  impresa_fondata: (state) => {
    const a = Object.values(state.aziende).find((x) => x.fondata >= (state.dinastia?.giocati?.[0]?.dal ?? 2026) && state.persone[x.proprietario]?.sangue);
    return a ? state.persone[a.proprietario] : null;
  },
  azienda_anni: (state, _d, { anni }) => {
    const a = Object.values(state.aziende).find((x) => !x.fallita && !x.venduta && state.world.anno - x.fondata >= anni && state.persone[x.proprietario]?.sangue && vive(state.persone[x.proprietario]));
    return a ? state.persone[a.proprietario] : null;
  },
  reputazione: (state, _d, { min }) => (state.famiglia.reputazione >= min ? true : null),
  persona_stimata: (state, _d, { min }) => sangueVivi(state).find((p) => p.stat.reputazione >= min),
  anni_dinastia: (state, _d, { anni }) => (state.world.anno - (state.dinastia?.giocati?.[0]?.dal ?? state.world.anno) >= anni ? true : null),
  vivi: (state, _d, { n }) => (sangueVivi(state).length >= n ? true : null),
};

/**
 * Controlla i traguardi non ancora ottenuti. Quelli nuovi finiscono in state.dinastia.traguardi.
 * Restituisce le frasi da mettere nel diario del personaggio principale.
 */
export function verificaTraguardi(state, data) {
  const d = state.dinastia;
  d.traguardi ??= [];
  const ottenuti = new Set(d.traguardi.map((t) => t.id));
  const righe = [];
  for (const t of data.traguardi ?? []) {
    if (ottenuti.has(t.id)) continue;
    const chi = REGOLE[t.regola]?.(state, data, t.parametri ?? {});
    if (!chi) continue;
    const persona = chi === true ? null : chi.id;
    d.traguardi.push({ id: t.id, anno: state.world.anno, persona });
    righe.push(`Traguardo di famiglia: ${t.nome}${persona ? ` (${chi.nome})` : ""}.`);
  }
  return righe;
}

/** Una riga all'anno con il patrimonio di famiglia e quante persone di sangue sono vive. */
export function registraStoria(state) {
  const d = state.dinastia;
  d.storico ??= [];
  d.storico.push({ anno: state.world.anno, patrimonio: patrimonioFamiglia(state), vivi: sangueVivi(state).length, reputazione: state.famiglia.reputazione });
  if (d.storico.length > 400) d.storico.shift();
}

export const REGOLE_TRAGUARDI = Object.keys(REGOLE);

/** Numeri della dinastia per la schermata Famiglia. */
export function statisticheDinastia(state, data) {
  const tutti = sangue(state);
  const vivi = tutti.filter(vive);
  const morti = tutti.filter((p) => !vive(p));
  const longevo = [...tutti].sort((a, b) => eta(b, state.world.anno) - eta(a, state.world.anno))[0];
  const laureati = tutti.filter((p) => titoloAlmeno(p.istruzione.titolo, "laurea_triennale")).length;
  const adulti = tutti.filter((p) => eta(p, state.world.anno) >= 25);
  const eta_media_morte = morti.length ? Math.round(morti.reduce((s, p) => s + eta(p, state.world.anno), 0) / morti.length) : null;
  const ottenuti = new Map((state.dinastia?.traguardi ?? []).map((t) => [t.id, t]));
  return {
    nati: tutti.length,
    vivi: vivi.length,
    generazioni: Math.max(0, ...tutti.map((p) => p.generazione ?? 0)) + 1,
    laureati,
    quota_laureati: adulti.length ? Math.round((100 * laureati) / adulti.length) : 0,
    eta_media_morte,
    longevo: longevo ? { nome: `${longevo.nome} ${longevo.cognome}`, eta: eta(longevo, state.world.anno), vivo: vive(longevo) } : null,
    figli_medi: adulti.length ? Math.round((10 * adulti.reduce((s, p) => s + figliVivi(state, p).length + (p.figli ?? []).filter((id) => !vive(state.persone[id])).length, 0)) / adulti.length) / 10 : 0,
    patrimonio: patrimonioFamiglia(state),
    storico: (state.dinastia?.storico ?? []).map((x) => ({ anno: x.anno, valore: x.patrimonio })),
    traguardi: (data.traguardi ?? []).map((t) => {
      const o = ottenuti.get(t.id);
      return { id: t.id, nome: t.nome, descrizione: t.descrizione, ottenuto: Boolean(o), anno: o?.iniziale ? "già all'inizio" : o?.anno ?? null, persona: o?.persona ? state.persone[o.persona]?.nome : null };
    }),
  };
}
