// Azioni concrete sulla vita di una persona, usate sia dagli eventi sia dalle regole automatiche.
// Ogni funzione restituisce una frase per il diario (o null se non è successo nulla).

import { nuovoId } from "./state.js";
import { pesato } from "./rng.js";
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
  return data.mestieri.filter((m) => titoloAlmeno(p.istruzione.titolo, m.titolo_min) && anni >= m.eta_min);
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

