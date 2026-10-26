// Azioni concrete sulla vita di una persona, usate sia dagli eventi sia dalle regole automatiche.
// Ogni funzione restituisce una frase per il diario (o null se non è successo nulla).

import { nuovoId } from "./state.js";
import { pesato, scegli } from "./rng.js";
import { eta, euro, nomeMestiere, titoloAlmeno } from "./util.js";
import { prezzoCasa, rataMutuo } from "./economy.js";

/** Iscrizione a un indirizzo delle superiori. */
export function iscriviSuperiori(state, data, p, indirizzo) {
  const s = data.superiore[indirizzo];
  if (!s) return null;
  p.istruzione = { ...p.istruzione, livello: "superiori", indirizzo, anno_corso: 1, iscritto: true };
  return `Inizia il ${s.nome}.`;
}

/** Iscrizione all'università (prima laurea o magistrale). */
export function iscriviUniversita(state, data, p, facolta, { fuoriSede = false } = {}) {
  const f = data.facolta[facolta];
  if (!f || !titoloAlmeno(p.istruzione.titolo, "diploma")) return null;
  p.istruzione = { ...p.istruzione, livello: "universita", facolta, crediti: 0, anno_corso: 1, iscritto: true, fuori_sede: fuoriSede, voti: Math.min(30, 18 + (p.istruzione.voti - 5) * 2.2) };
  return `Si iscrive a ${f.nome}${fuoriSede ? " come fuori sede" : ""}.`;
}

/** Lascia gli studi in corso. */
export function lasciaStudi(state, data, p) {
  if (!p.istruzione.iscritto) return null;
  const prima = p.istruzione.livello;
  p.istruzione = { ...p.istruzione, iscritto: false, livello: "nessuno", fuori_sede: false };
  return prima === "universita" ? "Lascia l'università." : "Lascia la scuola.";
}

/** Mestieri accessibili a una persona (titolo, età). */
export function mestieriAccessibili(state, data, p) {
  const anni = eta(p, state.world.anno);
  return data.mestieri.filter((m) => !m.solo_famiglia && titoloAlmeno(p.istruzione.titolo, m.titolo_min) && anni >= m.eta_min);
}

/** Peso di un mestiere per una persona: affinità con studi e tratti, preferenza per i mestieri qualificati. */
export function pesoMestiere(data, p, m) {
  let peso = 1;
  if (m.affinita.includes(p.istruzione.indirizzo)) peso += 2;
  if (m.affinita.includes(p.istruzione.facolta)) peso += 6;
  peso += m.tratti_affini.filter((t) => p.tratti.includes(t)).length;
  // chi ha studiato di più punta ai lavori che richiedono il suo titolo
  if (m.titolo_min === p.istruzione.titolo) peso += 2;
  return peso;
}

/** Assume la persona in un mestiere (id preciso o "casuale" tra quelli accessibili). */
export function assumi(state, data, p, idLavoro, { partTime = false } = {}) {
  let m = idLavoro === "casuale" ? pesato(state, mestieriAccessibili(state, data, p), (x) => pesoMestiere(data, p, x)) : data.mestiere[idLavoro];
  if (!m) return null;
  const c = p.carriera;
  if (c.lavoro) c.storico.push({ lavoro: c.lavoro, dal: c.dal ?? state.world.anno, al: state.world.anno });
  c.lavoro = m.id;
  c.dal = state.world.anno;
  c.anzianita = 0;
  c.bonus = 1;
  c.part_time = partTime;
  c.pensionato = false;
  return `Trova lavoro come ${nomeMestiere(m, p.sesso).toLowerCase()}${partTime ? " (part-time)" : ""}.`;
}

/** Perde o lascia il lavoro. */
export function licenzia(state, data, p, motivo = "Perde il lavoro") {
  const c = p.carriera;
  if (!c.lavoro) return null;
  const nome = nomeMestiere(data.mestiere[c.lavoro], p.sesso).toLowerCase();
  c.storico.push({ lavoro: c.lavoro, dal: c.dal ?? state.world.anno, al: state.world.anno });
  c.lavoro = null;
  c.anzianita = 0;
  c.part_time = false;
  return `${motivo} (${nome}).`;
}

/** Va a vivere da sola/o in affitto nella stessa città. */
export function trasloca(state, data, p) {
  const vecchio = state.nuclei[p.nucleo];
  const id = nuovoId(state, "n");
  state.nuclei[id] = { id, regione: p.regione, citta: p.citta, casa: null };
  p.nucleo = id;
  p.flags.vive_da_solo = true;
  return vecchio ? `Va a vivere da sol${p.sesso === "F" ? "a" : "o"} in affitto a ${p.citta}.` : null;
}

/** Si trasferisce in un'altra regione (nella città più grande), in affitto. */
export function trasferisci(state, data, p, idRegione) {
  const r = data.regione[idRegione];
  if (!r || r.id === p.regione) return null;
  const citta = (r.citta.find((c) => c.grande) ?? r.citta[0]).nome;
  const nucleo = state.nuclei[p.nucleo];
  const membri = Object.values(state.persone).filter((x) => x.anno_morte == null && x.nucleo === p.nucleo);
  const conGenitori = membri.some((x) => x.id === p.madre || x.id === p.padre);
  if (nucleo && !conGenitori && membri.length > 1) {
    // si sposta tutta la famiglia; la casa di proprietà resta e viene affittata
    Object.assign(nucleo, { regione: r.id, citta, casa: null });
    for (const x of membri) Object.assign(x, { regione: r.id, citta });
    return `Si trasferisce con la famiglia a ${citta} (${r.nome}).`;
  }
  p.regione = r.id;
  p.citta = citta;
  p.flags.vive_da_solo = false; // forza un nuovo nucleo nella nuova città
  trasloca(state, data, p);
  return `Si trasferisce a ${citta} (${r.nome}).`;
}

/** Prezzo e anticipo necessario (20% + 4% di notaio, imposte e agenzia) per una casa nella città della persona. */
export function costoCasa(state, data, p) {
  const r = data.regione[p.regione];
  const grande = r.citta.find((c) => c.nome === p.citta)?.grande ?? false;
  const prezzo = prezzoCasa(state, data, p.regione, grande);
  return { prezzo, anticipo: euro(prezzo * 0.24), grande };
}

/**
 * Compra casa con il 20% di anticipo e un mutuo a 25 anni.
 * aiutoFamiglia: i genitori coprono la parte di anticipo che manca (fino a metà dei loro risparmi).
 */
export function compraCasa(state, data, p, { aiutoFamiglia = 0 } = {}) {
  const { prezzo, anticipo, grande } = costoCasa(state, data, p);
  const mancante = Math.max(0, anticipo - p.economia.risparmi);
  if (mancante > aiutoFamiglia) return null;
  p.economia.risparmi = euro(p.economia.risparmi + mancante);
  if (!p.flags.vive_da_solo) trasloca(state, data, p);
  p.economia.risparmi = euro(p.economia.risparmi - anticipo);
  const capitale = euro(prezzo * 0.8);
  const tasso = 0.035;
  const id = nuovoId(state, "c");
  state.case[id] = { id, nome: grande ? `Appartamento a ${p.citta}` : `Casa a ${p.citta}`, regione: p.regione, citta: p.citta, valore: prezzo, mutuo_residuo: capitale, tasso, anni_residui: 25, rata: euro(rataMutuo(capitale, tasso, 25)), proprietari: [p.id] };
  state.nuclei[p.nucleo].casa = id;
  return `Compra casa a ${p.citta} per ${prezzo.toLocaleString("it-IT")} € con un mutuo di 25 anni${mancante > 0 ? `, con ${euro(mancante).toLocaleString("it-IT")} € di aiuto dalla famiglia` : ""}.`;
}

/** Aggiunge un tratto, togliendo l'eventuale opposto. */
export function aggiungiTratto(state, data, p, id) {
  const t = data.tratto[id];
  if (!t || p.tratti.includes(id)) return null;
  p.tratti = p.tratti.filter((x) => !t.opposti.includes(x) && !data.tratto[x]?.opposti.includes(id));
  p.tratti.push(id);
  return `Diventa più ${t.nome.toLowerCase()}.`;
}

/** Aggiunge un ricordo (cicatrice o traguardo) se non c'è già. */
export function aggiungiRicordo(state, data, p, id) {
  if (!data.ricordo[id] || p.ricordi.some((r) => r.id === id)) return null;
  p.ricordi.push({ id, anno: state.world.anno });
  return null;
}


// ---------------------------------------------------------------------------
// Azienda di famiglia (FASE 2)
// ---------------------------------------------------------------------------

/** Un'azienda è attiva se non è fallita né venduta e il titolare è vivo. */
export const aziendaAttiva = (state, a) => Boolean(a && !a.fallita && !a.venduta && state.persone[a.proprietario]?.anno_morte == null);

/** Azienda di cui la persona è titolare. */
export function aziendaDi(state, p) {
  return Object.values(state.aziende).find((a) => a.proprietario === p.id && aziendaAttiva(state, a));
}

/** Azienda della famiglia stretta (propria, dei genitori, del partner) in cui si può lavorare. */
export function aziendaDiFamiglia(state, p) {
  const vicini = [p.id, p.madre, p.padre, p.partner].filter(Boolean);
  return Object.values(state.aziende).find((a) => aziendaAttiva(state, a) && vicini.includes(a.proprietario));
}

/** Entra a lavorare nell'azienda di famiglia come socio dipendente. */
export function entraInAzienda(state, data, p) {
  const a = aziendaDiFamiglia(state, p);
  if (!a || a.proprietario === p.id) return null;
  const c = p.carriera;
  if (c.lavoro) c.storico.push({ lavoro: c.lavoro, dal: c.dal ?? state.world.anno, al: state.world.anno });
  Object.assign(c, { lavoro: "azienda_famiglia", dal: state.world.anno, anzianita: 0, bonus: 1, part_time: false, azienda: a.id });
  if (!a.dipendenti_famiglia.includes(p.id)) a.dipendenti_famiglia.push(p.id);
  return `Entra a lavorare in ${a.nome}.`;
}

/** Diventa titolare: prende in mano l'azienda (dal genitore che la cede o la lascia). */
export function diventaTitolare(state, data, p, a) {
  if (!a) return null;
  const prima = state.persone[a.proprietario];
  if (prima && prima.id !== p.id) {
    prima.carriera.imprenditore = false;
    if (eta(prima, state.world.anno) >= 60 && !prima.carriera.pensionato) {
      prima.carriera.pensionato = true;
      prima.carriera.pensione = euro(Math.max(6900 * state.world.indice_prezzi, a.fatturato * a.margine * 0.4));
    }
  }
  a.proprietario = p.id;
  const c = p.carriera;
  if (c.lavoro) c.storico.push({ lavoro: c.lavoro, dal: c.dal ?? state.world.anno, al: state.world.anno });
  Object.assign(c, { lavoro: null, imprenditore: true, azienda: a.id });
  return `Diventa titolare di ${a.nome}.`;
}

/** Rileva l'azienda dei genitori. */
export function rilevaAzienda(state, data, p) {
  const a = aziendaDiFamiglia(state, p);
  if (!a || a.proprietario === p.id) return null;
  return diventaTitolare(state, data, p, a);
}

/** Il titolare passa l'azienda a un figlio (prima chi ci lavora già, poi il maggiore adulto). */
export function cediAzienda(state, data, p) {
  const a = aziendaDi(state, p);
  if (!a) return null;
  const figli = (p.figli ?? []).map((id) => state.persone[id]).filter((f) => f && f.anno_morte == null && eta(f, state.world.anno) >= 20);
  const erede = figli.find((f) => f.carriera.azienda === a.id) ?? figli.sort((x, y) => x.anno_nascita - y.anno_nascita)[0];
  if (!erede) return null;
  diventaTitolare(state, data, erede, a);
  return `Passa ${a.nome} a ${erede.nome}.`;
}

/** Vende l'azienda al suo valore: i soldi vanno al titolare. */
export function vendiAzienda(state, data, p) {
  const a = aziendaDi(state, p);
  if (!a) return null;
  p.economia.risparmi = euro(p.economia.risparmi + a.valore);
  a.venduta = true;
  p.carriera.imprenditore = false;
  p.carriera.azienda = null;
  for (const id of a.dipendenti_famiglia) {
    const x = state.persone[id];
    if (x?.carriera.lavoro === "azienda_famiglia") x.carriera.lavoro = null;
  }
  return `Vende ${a.nome} per ${a.valore.toLocaleString("it-IT")} €.`;
}

/** Apre una nuova attività investendo `investimento` euro (del 2026) dei propri risparmi. */
export function fondaAzienda(state, data, p, investimento, tipo = null) {
  const soldi = euro(investimento * state.world.indice_prezzi);
  if (p.economia.risparmi < soldi || aziendaDi(state, p)) return null;
  const modello = tipo ?? scegli(state, data.generatore.aziende);
  const id = nuovoId(state, "a");
  state.aziende[id] = {
    id,
    nome: modello.nome.replace("{cognome}", p.cognome).replace("{nome}", p.nome),
    settore: modello.settore,
    valore: euro(soldi * 1.1),
    fatturato: euro(soldi * 2.2),
    margine: modello.margine,
    salute: 50,
    proprietario: p.id,
    dipendenti_famiglia: [p.id],
    fondata: state.world.anno,
    fallita: false,
  };
  p.economia.risparmi = euro(p.economia.risparmi - soldi);
  const c = p.carriera;
  if (c.lavoro) c.storico.push({ lavoro: c.lavoro, dal: c.dal ?? state.world.anno, al: state.world.anno });
  Object.assign(c, { lavoro: null, imprenditore: true, azienda: id });
  return `Apre ${state.aziende[id].nome}.`;
}

/** Effetto di una scelta sull'azienda: { salute, crescita (quota di fatturato), valore (euro 2026) }. */
export function modificaAzienda(state, p, effetto) {
  const a = aziendaDi(state, p) ?? aziendaDiFamiglia(state, p);
  if (!a) return null;
  if (effetto.salute) a.salute = Math.min(100, Math.max(0, Math.round(a.salute + effetto.salute)));
  if (effetto.crescita) a.fatturato = euro(a.fatturato * (1 + effetto.crescita));
  if (effetto.valore) a.valore = euro(Math.max(0, a.valore + effetto.valore * state.world.indice_prezzi));
  return null;
}
