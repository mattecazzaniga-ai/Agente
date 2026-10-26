// Motore degli eventi: condizioni, scelta pesata degli eventi dell'anno, effetti delle scelte,
// risoluzione automatica in base ai tratti, conseguenze a distanza. Il formato è nel README.

import { casuale, pesato, probabile } from "./rng.js";
import { eta, euro, limita, riempi, titoloAlmeno } from "./util.js";
import { madre, padre, fratelli, genitoreVicino, modificaRelazione, relazione, segnaposto, partnerDi, figliVivi, figlioPiuGiovane, figlioMaggiore, nipoti } from "./family.js";
import { membriNucleo, vaInPensione } from "./economy.js";
import { aggiungiRicordo, aggiungiTratto, assumi, compraCasa, costoCasa, iscriviSuperiori, iscriviUniversita, lasciaStudi, licenzia, trasferisci, trasloca } from "./azioni.js";
import { aziendaDi, aziendaDiFamiglia, cediAzienda, entraInAzienda, fondaAzienda, modificaAzienda, rilevaAzienda, vendiAzienda } from "./azioni.js";
import { accogliGenitore, convivenza, coppiaFertile, matrimonio, nasceFiglio, nuovoPartner, separazione } from "./dinastia.js";

const STAT = ["salute", "morale", "felicita", "stanchezza", "reputazione"];

/** Un evento della libreria (data/events) o uno inventato dall'AI e già convertito dal motore (FASE 5). */
export function eventoDi(state, data, id) {
  return data.evento[id] ?? state.world.eventi_ai?.[id];
}

// ---------------------------------------------------------------------------
// Soldi della famiglia d'origine (genitori vivi), usati da condizioni ed effetti
// ---------------------------------------------------------------------------

export function famigliaOrigine(state, p) {
  return [madre(state, p), padre(state, p)].filter((g) => g && g.anno_morte == null);
}

export function soldiFamiglia(state, p) {
  return famigliaOrigine(state, p).reduce((s, g) => s + g.economia.risparmi - g.economia.debiti, 0);
}

/** Toglie (o aggiunge) soldi ai genitori, in proporzione ai loro risparmi. */
function muoviSoldiFamiglia(state, p, importo) {
  const g = famigliaOrigine(state, p);
  if (!g.length) return;
  const totale = g.reduce((s, x) => s + Math.max(0, x.economia.risparmi), 0);
  for (const x of g) {
    const quota = totale > 0 ? Math.max(0, x.economia.risparmi) / totale : 1 / g.length;
    x.economia.risparmi = euro(x.economia.risparmi + importo * quota);
    if (x.economia.risparmi < 0) {
      x.economia.debiti = euro(x.economia.debiti - x.economia.risparmi);
      x.economia.risparmi = 0;
    }
  }
}

/** Quanto i genitori possono dare per una casa: metà dei loro risparmi liquidi. */
export function aiutoPossibile(state, p) {
  return Math.max(0, famigliaOrigine(state, p).reduce((s, g) => s + g.economia.risparmi, 0) * 0.5);
}

const viveConGenitori = (state, p) => famigliaOrigine(state, p).some((g) => g.nucleo === p.nucleo);

// ---------------------------------------------------------------------------
// Condizioni
// ---------------------------------------------------------------------------

const comeLista = (x) => (Array.isArray(x) ? x : [x]);

function personaRelazione(state, p, chi) {
  if (chi === "madre") return madre(state, p);
  if (chi === "padre") return padre(state, p);
  if (chi === "genitore") return genitoreVicino(state, p);
  if (chi === "fratello") return fratelli(state, p).find((f) => f.anno_morte == null);
  if (chi === "partner") return partnerDi(state, p);
  if (chi === "figlio") return figlioPiuGiovane(state, p);
  if (chi === "figlio_maggiore") return figlioMaggiore(state, p);
  return null;
}

/** true se tutte le condizioni sono rispettate. `opzioni.ignoraEta` per le conseguenze a distanza. */
export function condizioniOk(state, data, p, c = {}, opzioni = {}) {
  const anni = eta(p, state.world.anno);
  const i = p.istruzione;
  if (c.eta && !opzioni.ignoraEta && (anni < c.eta[0] || anni > c.eta[1])) return false;
  if (c.sesso && p.sesso !== c.sesso) return false;
  if (c.titolo && !comeLista(c.titolo).includes(i.titolo)) return false;
  if (c.titolo_min && !titoloAlmeno(i.titolo, c.titolo_min)) return false;
  if (c.livello && !(i.iscritto && comeLista(c.livello).includes(i.livello))) return false;
  if (c.iscritto !== undefined && i.iscritto !== c.iscritto) return false;
  if (c.indirizzo && !comeLista(c.indirizzo).includes(i.indirizzo)) return false;
  if (c.voti_min !== undefined && i.voti < c.voti_min) return false;
  if (c.voti_max !== undefined && i.voti > c.voti_max) return false;
  if (c.genitori_insieme !== undefined) {
    const [m, pa] = [madre(state, p), padre(state, p)];
    const insieme = Boolean(m && pa && m.anno_morte == null && pa.anno_morte == null && m.partner === pa.id);
    if (insieme !== c.genitori_insieme) return false;
  }
  if (c.facolta && !comeLista(c.facolta).includes(i.facolta)) return false;
  if (c.lavoro === true && !p.carriera.lavoro) return false;
  if (c.lavoro === false && p.carriera.lavoro) return false;
  if (Array.isArray(c.lavoro) && !c.lavoro.includes(p.carriera.lavoro)) return false;
  if (c.settore && !comeLista(c.settore).includes(data.mestiere[p.carriera.lavoro]?.settore)) return false;
  if (c.settore_escluso && comeLista(c.settore_escluso).includes(data.mestiere[p.carriera.lavoro]?.settore)) return false;
  if (c.pensionato !== undefined && Boolean(p.carriera.pensionato) !== c.pensionato) return false;
  if (c.soldi_famiglia_min !== undefined && soldiFamiglia(state, p) < c.soldi_famiglia_min * state.world.indice_prezzi) return false;
  if (c.risparmi_min !== undefined && p.economia.risparmi < c.risparmi_min * state.world.indice_prezzi) return false;
  if (c.risparmi_max !== undefined && p.economia.risparmi > c.risparmi_max * state.world.indice_prezzi) return false;
  if (c.debiti_min !== undefined && p.economia.debiti < c.debiti_min * state.world.indice_prezzi) return false;
  if (c.tratti_richiesti && !c.tratti_richiesti.some((t) => p.tratti.includes(t))) return false;
  if (c.tratti_esclusi && c.tratti_esclusi.some((t) => p.tratti.includes(t))) return false;
  if (c.ricordi_richiesti && !c.ricordi_richiesti.some((r) => p.ricordi.some((x) => x.id === r))) return false;
  if (c.ricordi_esclusi && c.ricordi_esclusi.some((r) => p.ricordi.some((x) => x.id === r))) return false;
  if (c.flag && !comeLista(c.flag).every((f) => p.flags[f])) return false;
  if (c.flag_esclusi && comeLista(c.flag_esclusi).some((f) => p.flags[f])) return false;
  if (c.vive_con_genitori !== undefined && viveConGenitori(state, p) !== c.vive_con_genitori) return false;
  if (c.agiatezza && !comeLista(c.agiatezza).includes(state.famiglia.agiatezza)) return false;
  if (c.congiuntura && !comeLista(c.congiuntura).includes(state.world.mondo?.congiuntura ?? "normale")) return false;
  if (c.anno_min !== undefined && state.world.anno < c.anno_min) return false;
  if (c.area && !comeLista(c.area).includes(data.regione[p.regione]?.area)) return false;
  if (c.azienda_famiglia !== undefined && Boolean(aziendaDiFamiglia(state, p)) !== c.azienda_famiglia) return false;
  if (c.fratelli !== undefined && (fratelli(state, p).some((f) => f.anno_morte == null)) !== c.fratelli) return false;
  if (c.genitori_vivi !== undefined && famigliaOrigine(state, p).length < c.genitori_vivi) return false;
  if (c.casa_raggiungibile && p.economia.risparmi + aiutoPossibile(state, p) < costoCasa(state, data, p).anticipo) return false;
  // vita di coppia e figli (FASE 2)
  if (c.stato_civile && !comeLista(c.stato_civile).includes(p.stato_civile)) return false;
  if (c.coppia !== undefined && Boolean(partnerDi(state, p)) !== c.coppia) return false;
  if (c.anni_coppia_min !== undefined && (!partnerDi(state, p) || state.world.anno - (p.coppia_dal ?? state.world.anno) < c.anni_coppia_min)) return false;
  if (c.fertile !== undefined && coppiaFertile(state, p) !== c.fertile) return false;
  const figli = figliVivi(state, p);
  if (c.figli_min !== undefined && figli.length < c.figli_min) return false;
  if (c.figli_max !== undefined && figli.length > c.figli_max) return false;
  if (c.figlio_eta) {
    const f = figli.at(-1);
    if (!f || eta(f, state.world.anno) < c.figlio_eta[0] || eta(f, state.world.anno) > c.figlio_eta[1]) return false;
  }
  if (c.figli_adulti !== undefined && figli.some((f) => eta(f, state.world.anno) >= 20) !== c.figli_adulti) return false;
  if (c.nipoti !== undefined && nipoti(state, p).length > 0 !== c.nipoti) return false;
  if (c.genitore_eta_min !== undefined && !famigliaOrigine(state, p).some((g) => eta(g, state.world.anno) >= c.genitore_eta_min)) return false;
  // azienda di famiglia
  if (c.titolare !== undefined && Boolean(aziendaDi(state, p)) !== c.titolare) return false;
  if (c.in_azienda !== undefined && (p.carriera.lavoro === "azienda_famiglia") !== c.in_azienda) return false;
  if (c.genitore_titolare !== undefined) {
    const a = aziendaDiFamiglia(state, p);
    if (Boolean(a && (a.proprietario === p.madre || a.proprietario === p.padre)) !== c.genitore_titolare) return false;
  }
  if (c.azienda_salute_min !== undefined && !((aziendaDi(state, p)?.salute ?? -1) >= c.azienda_salute_min)) return false;
  if (c.azienda_salute_max !== undefined && !(aziendaDi(state, p) && aziendaDi(state, p).salute <= c.azienda_salute_max)) return false;
  if (c.stat_min) for (const [k, v] of Object.entries(c.stat_min)) if (p.stat[k] < v) return false;
  if (c.stat_max) for (const [k, v] of Object.entries(c.stat_max)) if (p.stat[k] > v) return false;
  if (c.relazione_min || c.relazione_max) {
    const r = c.relazione_min ?? c.relazione_max;
    const altro = personaRelazione(state, p, r.con);
    if (!altro) return false;
    const intensita = relazione(state, p.id, altro.id)?.intensita ?? 0;
    if (c.relazione_min && intensita < c.relazione_min.valore) return false;
    if (c.relazione_max && intensita > c.relazione_max.valore) return false;
  }
  return true;
}

/** Un evento non ripetibile non torna; uno ripetibile aspetta il suo intervallo (default 5 anni). */
function disponibile(state, p, ev) {
  const usato = state.world.eventi_usati[p.id]?.[ev.id];
  if (usato === undefined) return true;
  if (!ev.ripetibile) return false;
  return state.world.anno - usato >= (ev.intervallo ?? 5);
}

/** Rilevanza di un evento per la persona: il peso cresce con i tratti affini e i ricordi collegati; un evento già vissuto pesa meno. */
function rilevanza(state, p, ev) {
  let peso = ev.peso ?? 1;
  if (state.world.eventi_usati[p.id]?.[ev.id] !== undefined) peso *= 0.4;
  if (ev.tratti_affini?.some((t) => p.tratti.includes(t))) peso *= 2;
  if (ev.condizioni?.ricordi_richiesti) peso *= 1.5;
  return peso;
}

/**
 * Sceglie gli eventi dell'anno per una persona: prima le conseguenze arrivate a scadenza,
 * poi 1-3 eventi pesati tra quelli validi. Restituisce [{ evento, variante }].
 */
export function scegliEventiAnno(state, data, p, massimo = 3) {
  const scelti = [];
  const dovuti = state.world.memoria.filter((m) => m.persona === p.id && m.anno <= state.world.anno);
  state.world.memoria = state.world.memoria.filter((m) => !dovuti.includes(m));
  for (const m of dovuti) {
    const ev = eventoDi(state, data, m.evento);
    if (ev && condizioniOk(state, data, p, ev.condizioni, { ignoraEta: true }) && !scelti.some((s) => s.evento === ev.id)) scelti.push({ evento: ev.id });
  }
  const r = casuale(state);
  const quanti = Math.max(scelti.length, Math.min(massimo, r < 0.35 ? 1 : r < 0.85 ? 2 : 3));
  const validi = data.eventi.filter((ev) => !ev.condizioni?.solo_conseguenza && disponibile(state, p, ev) && condizioniOk(state, data, p, ev.condizioni));
  while (scelti.length < quanti) {
    const liberi = validi.filter((ev) => !scelti.some((s) => s.evento === ev.id));
    const ev = pesato(state, liberi, (x) => rilevanza(state, p, x));
    if (!ev) break;
    scelti.push({ evento: ev.id });
  }
  for (const s of scelti) {
    const ev = eventoDi(state, data, s.evento);
    s.variante = Math.floor(casuale(state) * ev.testi.length);
    (state.world.eventi_usati[p.id] ??= {})[ev.id] = state.world.anno;
  }
  return scelti;
}

/** Testo dell'evento con i segnaposto riempiti. */
export function testoEvento(state, data, p, ev, variante = 0) {
  return riempi(ev.testi[variante % ev.testi.length], segnaposto(state, data, p));
}

export function titoloEvento(state, data, p, ev) {
  return riempi(ev.titolo ?? "Un anno", segnaposto(state, data, p));
}

export function testoScelta(state, data, p, scelta) {
  return riempi(scelta.testo, segnaposto(state, data, p));
}

/** Una scelta è disponibile? Restituisce { ok, motivo }. */
export function requisitiScelta(state, data, p, scelta) {
  const r = scelta.requisiti;
  if (!r) return { ok: true };
  if (r.risparmi_min !== undefined && p.economia.risparmi < r.risparmi_min * state.world.indice_prezzi)
    return { ok: false, motivo: `Servono almeno ${euro(r.risparmi_min * state.world.indice_prezzi).toLocaleString("it-IT")} € di risparmi` };
  if (r.soldi_famiglia_min !== undefined && soldiFamiglia(state, p) < r.soldi_famiglia_min * state.world.indice_prezzi)
    return { ok: false, motivo: "La famiglia non può permetterselo" };
  if (r.titolo_min && !titoloAlmeno(p.istruzione.titolo, r.titolo_min)) return { ok: false, motivo: "Serve un titolo di studio più alto" };
  if (r.casa) {
    const { anticipo } = costoCasa(state, data, p);
    const disponibili = p.economia.risparmi + (r.casa === "con_famiglia" ? aiutoPossibile(state, p) : 0);
    if (r.casa === "con_famiglia" && aiutoPossibile(state, p) <= 0) return { ok: false, motivo: "La famiglia non può aiutarti" };
    if (disponibili < anticipo) return { ok: false, motivo: `Servono ${anticipo.toLocaleString("it-IT")} € di anticipo` };
  }
  if (r.voti_min !== undefined && p.istruzione.voti < r.voti_min) return { ok: false, motivo: "I voti non bastano" };
  if (r.stat_min) for (const [k, v] of Object.entries(r.stat_min)) if (p.stat[k] < v) return { ok: false, motivo: `${k[0].toUpperCase() + k.slice(1)} troppo bassa` };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Effetti
// ---------------------------------------------------------------------------

/** Applica gli effetti di una scelta. Restituisce le frasi per il diario. */
export function applicaEffetti(state, data, p, effetti = {}) {
  const righe = [];
  const indice = state.world.indice_prezzi;
  for (const k of STAT) if (typeof effetti[k] === "number") p.stat[k] = limita(Math.round(p.stat[k] + effetti[k]), 0, 100);
  if (typeof effetti.risparmi === "number") {
    p.economia.risparmi = euro(p.economia.risparmi + effetti.risparmi * indice);
    if (p.economia.risparmi < 0) {
      // un minorenne non fa debiti: quello che manca lo mettono i genitori
      if (eta(p, state.world.anno) < 18 && famigliaOrigine(state, p).length) muoviSoldiFamiglia(state, p, p.economia.risparmi);
      else p.economia.debiti = euro(p.economia.debiti - p.economia.risparmi);
      p.economia.risparmi = 0;
    }
  }
  if (typeof effetti.debiti === "number") p.economia.debiti = Math.max(0, euro(p.economia.debiti + effetti.debiti * indice));
  if (typeof effetti.risparmi_famiglia === "number") muoviSoldiFamiglia(state, p, effetti.risparmi_famiglia * indice);
  if (typeof effetti.voti === "number") {
    const universita = p.istruzione.livello === "universita";
    p.istruzione.voti = universita ? limita(p.istruzione.voti + effetti.voti * 2, 18, 30) : limita(p.istruzione.voti + effetti.voti, 3, 10);
  }
  if (typeof effetti.reputazione_famiglia === "number") state.famiglia.reputazione = limita(Math.round(state.famiglia.reputazione + effetti.reputazione_famiglia), 0, 100);
  if (effetti.indirizzo && data.superiore[effetti.indirizzo]) p.istruzione.indirizzo = effetti.indirizzo;
  if (effetti.superiori) righe.push(iscriviSuperiori(state, data, p, effetti.superiori));
  if (effetti.universita) righe.push(iscriviUniversita(state, data, p, effetti.universita, { fuoriSede: Boolean(effetti.fuori_sede) }));
  if (effetti.fuori_sede !== undefined && !effetti.universita && p.istruzione.livello === "universita") p.istruzione.fuori_sede = Boolean(effetti.fuori_sede);
  if (effetti.lascia_studi) righe.push(lasciaStudi(state, data, p));
  if (effetti.licenziato) righe.push(licenzia(state, data, p, "Lascia il lavoro"));
  if (effetti.lavoro) righe.push(assumi(state, data, p, effetti.lavoro, { partTime: Boolean(effetti.part_time) }));
  if (typeof effetti.bonus === "number" && p.carriera.lavoro) p.carriera.bonus = limita(p.carriera.bonus + effetti.bonus, 0.7, 1.6);
  if (effetti.trasloco && !p.flags.vive_da_solo) righe.push(trasloca(state, data, p));
  if (effetti.trasferimento) righe.push(trasferisci(state, data, p, effetti.trasferimento));
  if (effetti.compra_casa) {
    const aiuto = effetti.compra_casa === "con_famiglia" ? aiutoPossibile(state, p) : 0;
    const prima = p.economia.risparmi;
    const riga = compraCasa(state, data, p, { aiutoFamiglia: aiuto });
    // l'aiuto ricevuto esce dai risparmi dei genitori
    const ricevuto = riga ? Math.max(0, costoCasa(state, data, p).anticipo - prima) : 0;
    if (ricevuto > 0) muoviSoldiFamiglia(state, p, -ricevuto);
    righe.push(riga);
  }
  if (effetti.tratto) righe.push(aggiungiTratto(state, data, p, effetti.tratto));
  if (effetti.tratto_rimuovi) p.tratti = p.tratti.filter((t) => t !== effetti.tratto_rimuovi);
  if (effetti.ricordo) aggiungiRicordo(state, data, p, effetti.ricordo);
  // vita di coppia e figli
  if (effetti.partner === "nuovo") righe.push(nuovoPartner(state, data, p));
  if (effetti.convivenza) righe.push(convivenza(state, data, p));
  if (effetti.matrimonio) righe.push(matrimonio(state, data, p));
  if (effetti.separazione) righe.push(separazione(state, data, p));
  if (effetti.figlio) righe.push(nasceFiglio(state, data, p));
  if (effetti.accogli_genitore) righe.push(accogliGenitore(state, data, p));
  if (effetti.al_figlio) {
    const f = figlioPiuGiovane(state, p);
    if (f) {
      for (const k of STAT) if (typeof effetti.al_figlio[k] === "number") f.stat[k] = limita(Math.round(f.stat[k] + effetti.al_figlio[k]), 0, 100);
      if (typeof effetti.al_figlio.voti === "number") f.istruzione.voti = f.istruzione.livello === "universita" ? limita(f.istruzione.voti + effetti.al_figlio.voti * 2, 18, 30) : limita(f.istruzione.voti + effetti.al_figlio.voti, 3, 10);
      if (typeof effetti.al_figlio.risparmi === "number") f.economia.risparmi = euro(f.economia.risparmi + effetti.al_figlio.risparmi * indice);
      if (effetti.al_figlio.tratto) righe.push(aggiungiTratto(state, data, f, effetti.al_figlio.tratto)?.replace("Diventa", `${f.nome} diventa`));
    }
  }
  if (effetti.riduci_lavoro && p.carriera.lavoro) p.carriera.part_time = true;
  if (effetti.pensione_anticipata && vaInPensione(state, data, p, { anticipata: true })) righe.push(`Va in pensione in anticipo: ${euro(p.carriera.pensione).toLocaleString("it-IT")} € lordi l'anno.`);
  if (effetti.torna_tempo_pieno && p.carriera.lavoro) p.carriera.part_time = false;
  // azienda di famiglia
  if (effetti.entra_azienda) righe.push(entraInAzienda(state, data, p));
  if (effetti.rileva_azienda) righe.push(rilevaAzienda(state, data, p));
  if (effetti.cedi_azienda) righe.push(cediAzienda(state, data, p));
  if (effetti.vendi_azienda) righe.push(vendiAzienda(state, data, p));
  if (typeof effetti.fonda_azienda === "number") righe.push(fondaAzienda(state, data, p, effetti.fonda_azienda));
  if (effetti.azienda) modificaAzienda(state, p, effetti.azienda);
  if (typeof effetti.casa_valore === "number") {
    const casa = state.case[state.nuclei[p.nucleo]?.casa];
    if (casa?.proprietari.includes(p.id)) casa.valore = euro(casa.valore + effetti.casa_valore * indice);
  }
  for (const f of comeLista(effetti.flag ?? [])) p.flags[f] = state.world.anno;
  for (const f of comeLista(effetti.flag_rimuovi ?? [])) delete p.flags[f];
  for (const r of comeLista(effetti.relazione ?? [])) {
    const altro = personaRelazione(state, p, r.con);
    if (altro) modificaRelazione(state, p.id, altro.id, r.delta);
  }
  return righe.filter(Boolean);
}

/** Programma le conseguenze a distanza di una scelta. */
export function programmaConseguenze(state, p, conseguenze = []) {
  for (const c of conseguenze) {
    if (probabile(state, c.probabilita ?? 1)) state.world.memoria.push({ evento: c.evento, persona: p.id, anno: state.world.anno + (c.dopo_anni ?? 1) });
  }
}

/** Risolve una scelta: effetti, conseguenze, frase di esito. */
export function risolviScelta(state, data, p, idEvento, idScelta) {
  const ev = eventoDi(state, data, idEvento);
  const scelta = ev?.scelte.find((s) => s.id === idScelta);
  if (!scelta) throw new Error(`Scelta ${idScelta} inesistente nell'evento ${idEvento}`);
  const req = requisitiScelta(state, data, p, scelta);
  if (!req.ok) throw new Error(req.motivo);
  const righe = applicaEffetti(state, data, p, scelta.effetti);
  programmaConseguenze(state, p, scelta.conseguenze);
  let esito = scelta.esito ? riempi(scelta.esito, segnaposto(state, data, p)) : null;
  // esito incerto (es. una scommessa): il motore tira il dado, con il seed della partita
  if (scelta.esito_casuale) {
    const fortuna = probabile(state, scelta.esito_casuale.probabilita);
    if (fortuna) righe.push(...applicaEffetti(state, data, p, scelta.esito_casuale.effetti));
    esito = `${esito ? `${esito} ` : ""}${fortuna ? "Ti va bene." : "Non va come speravi."}`;
  }
  return { esito, righe };
}

/**
 * Scelta automatica in base ai tratti: ogni scelta pesa 1, +2 per ogni tratto favorito,
 * ×0,25 per ogni tratto sfavorito. Le scelte non disponibili sono escluse.
 */
export function sceltaAutomatica(state, data, p, idEvento) {
  const ev = eventoDi(state, data, idEvento);
  const possibili = ev.scelte.filter((s) => requisitiScelta(state, data, p, s).ok);
  const scelta = pesato(state, possibili.length ? possibili : ev.scelte.slice(0, 1), (s) => {
    let peso = 1 + 2 * (s.tratti_favoriti ?? []).filter((t) => p.tratti.includes(t)).length;
    for (const t of s.tratti_sfavoriti ?? []) if (p.tratti.includes(t)) peso *= 0.25;
    return peso;
  });
  return scelta.id;
}

/** Membri del nucleo della persona, esposto per l'interfaccia. */
export const conviventi = (state, p) => membriNucleo(state, p.nucleo).filter((x) => x.id !== p.id);
