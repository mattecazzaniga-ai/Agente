// Economia semplificata ma plausibile: stipendi, tasse, spese della famiglia, case, debiti, eredità.
// Tutti gli importi dei dati sono in euro del 2026 e vengono rivalutati con gli indici del mondo.
// Le semplificazioni sono elencate nel README.

import { normale } from "./rng.js";
import { euro, eta, limita } from "./util.js";
import { personeVive, vive } from "./state.js";
import { etaPensione } from "./mondo.js";

const COSTO_VITA_BASE = 11000; // euro/anno per un adulto, casa esclusa (cibo, bollette, trasporti, svago)
const SPESA_SCUOLA = 400; // libri e materiale per uno studente delle scuole dell'obbligo
const INTERESSE_RISPARMI = 0.005;
const INTERESSE_DEBITI = 0.08;
const ASSEGNO_SOCIALE = 6900;
const SPESA_NIDO = 2500; // 0-2 anni: nido (in parte coperto dal bonus nido) o baby-sitter
const SPESA_INFANZIA = 700; // 3-5 anni: scuola dell'infanzia (mensa, materiale)
const ASSEGNO_UNICO = 1800; // assegno unico per figlio minorenne, media annua semplificata (senza ISEE)
const RENDITA_AFFITTO = 0.035; // affitto lordo annuo di una casa data in locazione, sul valore
const CEDOLARE_SECCA = 0.21;
const SOGLIA_INCLUSIONE = 9360; // assegno di inclusione: reddito minimo annuo per un adulto (scala di equivalenza)
const MASSIMO_INCLUSIONE = 6500; // integrazione massima annua per un adulto

// ---------------------------------------------------------------------------
// Tasse
// ---------------------------------------------------------------------------

/** IRPEF a scaglioni 2025 (23% / 35% / 43%) con detrazione da lavoro semplificata. */
export function irpef(imponibile, lavoroDipendente) {
  const scaglioni = [
    [28000, 0.23],
    [50000, 0.35],
    [Infinity, 0.43],
  ];
  let lorda = 0;
  let precedente = 0;
  for (const [soglia, aliquota] of scaglioni) {
    if (imponibile <= precedente) break;
    lorda += (Math.min(imponibile, soglia) - precedente) * aliquota;
    precedente = soglia;
  }
  let detrazione = 0;
  if (lavoroDipendente) {
    if (imponibile <= 15000) detrazione = 1955;
    else if (imponibile <= 28000) detrazione = 1910 + (1190 * (28000 - imponibile)) / 13000;
    else if (imponibile <= 50000) detrazione = (1910 * (50000 - imponibile)) / 22000;
  } else if (imponibile <= 8500) {
    detrazione = lorda; // area di esenzione per pensioni e redditi minimi
  }
  return Math.max(0, lorda - detrazione);
}

/**
 * Dal lordo al netto. tipo: "dipendente" (contributi 9,19%), "autonomo" (24%), "pensione" (nessun contributo).
 * Le addizionali regionali e comunali sono un 2% forfettario.
 */
export function calcolaNetto(lordo, tipo = "dipendente") {
  if (lordo <= 0) return { lordo: 0, contributi: 0, irpef: 0, addizionali: 0, netto: 0 };
  const quotaContributi = tipo === "dipendente" ? 0.0919 : tipo === "autonomo" ? 0.24 : 0;
  const contributi = lordo * quotaContributi;
  const imponibile = lordo - contributi;
  const imposta = irpef(imponibile, tipo !== "pensione" && tipo !== "autonomo" ? true : false);
  const addizionali = imponibile > 8500 ? imponibile * 0.02 : 0;
  return { lordo: euro(lordo), contributi: euro(contributi), irpef: euro(imposta), addizionali: euro(addizionali), netto: euro(imponibile - imposta - addizionali) };
}

// ---------------------------------------------------------------------------
// Redditi
// ---------------------------------------------------------------------------

/** Stipendio lordo annuo di un lavoro, dato anzianità, regione e indice dei salari. */
export function stipendioLordo(state, data, persona) {
  const c = persona.carriera;
  const m = c?.lavoro ? data.mestiere[c.lavoro] : null;
  if (!m) return 0;
  const progressione = Math.pow(Math.min(1, (c.anzianita ?? 0) / 25), 0.8);
  const base = m.stipendio_iniziale + (m.stipendio_massimo - m.stipendio_iniziale) * progressione;
  const regione = data.regione[persona.regione];
  const partTime = c.part_time ? 0.5 : 1;
  return base * (regione?.stipendi ?? 1) * state.world.indice_salari * (c.bonus ?? 1) * partTime;
}

/** Utile annuo che un'azienda di famiglia versa al suo proprietario. */
export function utileAzienda(azienda) {
  if (!azienda || azienda.fallita || azienda.venduta) return 0;
  return Math.max(0, azienda.fatturato * azienda.margine);
}

/** Tutte le entrate lorde di una persona nell'anno, separate per tipo fiscale. */
export function redditiPersona(state, data, persona) {
  const redditi = [];
  if (persona.carriera?.naspi?.anni > 0) redditi.push({ tipo: "pensione", lordo: persona.carriera.naspi.importo });
  if (persona.carriera?.pensionato) {
    redditi.push({ tipo: "pensione", lordo: persona.carriera.pensione ?? 0 });
  } else if (persona.carriera?.lavoro) {
    redditi.push({ tipo: "dipendente", lordo: stipendioLordo(state, data, persona) });
  }
  for (const a of Object.values(state.aziende)) {
    if (a.proprietario === persona.id) redditi.push({ tipo: "autonomo", lordo: utileAzienda(a) });
  }
  return redditi;
}

// ---------------------------------------------------------------------------
// Spese del nucleo familiare
// ---------------------------------------------------------------------------

/** Membri vivi di un nucleo. */
export function membriNucleo(state, idNucleo) {
  return personeVive(state).filter((p) => p.nucleo === idNucleo);
}

/** Rata annua costante di un mutuo (ammortamento alla francese). */
export function rataMutuo(capitale, tasso, anni) {
  if (capitale <= 0 || anni <= 0) return 0;
  const r = tasso;
  return (capitale * r) / (1 - Math.pow(1 + r, -anni));
}

/** Valore di mercato di una casa di 75 m² nella città del nucleo, a prezzi correnti. */
export function prezzoCasa(state, data, idRegione, grandeCitta) {
  const r = data.regione[idRegione];
  return euro(r.prezzo_mq * 75 * (grandeCitta ? 1.35 : 1) * state.world.indice_prezzi);
}

/** Affitto annuo per il nucleo (si allarga un po' con il numero dei membri). */
export function affittoAnnuo(state, data, nucleo, membri) {
  const r = data.regione[nucleo.regione];
  const citta = r.citta.find((c) => c.nome === nucleo.citta);
  const dimensione = 1 + 0.15 * Math.max(0, membri - 1);
  return r.affitto * 12 * (citta?.grande ? 1.25 : 1) * dimensione * state.world.indice_prezzi;
}

/** Scala di equivalenza OCSE modificata: il primo adulto pesa 1, gli altri 0,5, i minori 0,3. */
function scalaEquivalenza(state, membri) {
  let peso = 0;
  let primoAdulto = true;
  for (const p of membri) {
    if (eta(p, state.world.anno) >= 14) {
      peso += primoAdulto ? 1 : 0.5;
      primoAdulto = false;
    } else peso += 0.3;
  }
  return Math.max(1, peso);
}

/** Spesa annua per lo studio di una persona (scuola, tasse universitarie, fuori sede). */
function spesaStudio(state, data, p) {
  const i = p.istruzione;
  if (!i?.iscritto) {
    const anni = eta(p, state.world.anno);
    return (anni < 3 ? SPESA_NIDO : anni < 6 ? SPESA_INFANZIA : 0) * state.world.indice_prezzi;
  }
  if (i.livello === "universita") {
    const f = data.facolta[i.facolta];
    let spesa = (f?.tasse ?? 1600) * state.world.indice_prezzi;
    if (i.fuori_sede) spesa += data.regione[p.regione].affitto * 0.55 * 12 * state.world.indice_prezzi;
    return spesa;
  }
  return SPESA_SCUOLA * state.world.indice_prezzi;
}

/** Quota di spese evitata grazie ai tratti (prudente risparmia, impulsivo spreca). */
function fattoreRisparmio(data, membri) {
  const adulti = membri.filter((p) => p.tratti?.length);
  if (!adulti.length) return 1;
  const media = adulti.reduce((s, p) => s + p.tratti.reduce((t, id) => t + (data.tratto[id]?.modificatori?.risparmio ?? 0), 0), 0) / adulti.length;
  return limita(1 - media, 0.8, 1.2);
}

/**
 * Bilancio annuo di un nucleo: entrate nette di tutti, spese comuni, saldo ripartito.
 * I risparmi in eccesso vanno a chi guadagna, in proporzione; le perdite si coprono con i risparmi
 * e, se non bastano, diventano debito del capofamiglia. Registra il bilancio di ogni membro.
 */
export function bilancioNucleo(state, data, idNucleo, trasferimenti = {}) {
  const nucleo = state.nuclei[idNucleo];
  const membri = membriNucleo(state, idNucleo);
  if (!nucleo || !membri.length) return null;

  // Entrate
  const voci = new Map();
  let nettoTotale = 0;
  for (const p of membri) {
    const r = { lordo: 0, contributi: 0, tasse: 0, netto: 0 };
    for (const reddito of redditiPersona(state, data, p)) {
      const n = calcolaNetto(reddito.lordo, reddito.tipo);
      r.lordo += n.lordo;
      r.contributi += n.contributi;
      r.tasse += n.irpef + n.addizionali;
      r.netto += n.netto;
    }
    voci.set(p.id, r);
    nettoTotale += r.netto;
  }

  // Assegni di mantenimento ricevuti (+) o versati (−) verso altri nuclei
  const mantenimento = trasferimenti[idNucleo] ?? 0;
  nettoTotale += mantenimento;
  // Assegno unico per i figli minorenni
  const assegno = membri.filter((p) => eta(p, state.world.anno) < 18).length * ASSEGNO_UNICO * state.world.indice_prezzi;
  nettoTotale += assegno;
  // Assegno di inclusione: chi resta sotto la soglia di povertà riceve un'integrazione (semplificata, senza ISEE)
  const scala = scalaEquivalenza(state, membri);
  const soglia = SOGLIA_INCLUSIONE * scala * state.world.indice_prezzi;
  const inclusione = nettoTotale < soglia ? Math.min(soglia - nettoTotale, MASSIMO_INCLUSIONE * scala * state.world.indice_prezzi) : 0;
  nettoTotale += inclusione;

  // Spese
  let casa = 0;
  const abitazione = nucleo.casa ? state.case[nucleo.casa] : null;
  if (abitazione) {
    casa = abitazione.valore * 0.006; // manutenzione e spese condominiali
    if (abitazione.mutuo_residuo > 0) {
      const rata = Math.min(abitazione.rata, abitazione.mutuo_residuo * (1 + abitazione.tasso));
      const interessi = abitazione.mutuo_residuo * abitazione.tasso;
      abitazione.mutuo_residuo = Math.max(0, euro(abitazione.mutuo_residuo + interessi - rata));
      casa += rata;
    }
  } else {
    casa = affittoAnnuo(state, data, nucleo, membri.length);
  }
  const studio = membri.reduce((s, p) => s + spesaStudio(state, data, p), 0);
  // I consumi si adattano al reddito: chi ha poco taglia fino al 40%, chi ha di più spende un po' di più.
  const vitaBase = COSTO_VITA_BASE * data.regione[nucleo.regione].costo_vita * state.world.indice_prezzi * scalaEquivalenza(state, membri) * fattoreRisparmio(data, membri);
  // Con debiti aperti il nucleo mette da parte una rata (10% del debito, almeno gli interessi) e taglia i consumi.
  const debitiNucleo = membri.reduce((s, p) => s + p.economia.debiti, 0);
  const rataDebiti = debitiNucleo > 0 ? Math.min(debitiNucleo, Math.max(debitiNucleo * 0.1, debitiNucleo * INTERESSE_DEBITI * 1.2)) : 0;
  const fabbisogno = vitaBase + casa + studio + rataDebiti;
  const vita =
    nettoTotale < fabbisogno
      ? Math.max(vitaBase * 0.6, vitaBase - (fabbisogno - nettoTotale) * 0.7)
      : debitiNucleo > 0
        ? vitaBase
        : vitaBase * (1 + Math.min(0.6, ((nettoTotale - fabbisogno) / fabbisogno) * 0.35));
  const speseTotali = vita + casa + studio;
  const saldo = nettoTotale - speseTotali;

  // Ripartizione del saldo
  const guadagnano = membri.filter((p) => voci.get(p.id).netto > 0);
  if (saldo >= 0) {
    // l'avanzo ripaga prima i debiti dei membri, poi diventa risparmio
    let avanzo = saldo;
    for (const p of membri.filter((x) => x.economia.debiti > 0)) {
      const quota = Math.min(p.economia.debiti, avanzo);
      p.economia.debiti = euro(p.economia.debiti - quota);
      avanzo -= quota;
    }
    const base = guadagnano.length ? guadagnano : membri;
    const totale = base.reduce((s, p) => s + Math.max(1, voci.get(p.id).netto), 0);
    for (const p of base) p.economia.risparmi += euro((avanzo * Math.max(1, voci.get(p.id).netto)) / totale);
  } else {
    let daCoprire = -saldo;
    const conRisparmi = membri.filter((p) => p.economia.risparmi > 0 && eta(p, state.world.anno) >= 18);
    const disponibili = conRisparmi.reduce((s, p) => s + p.economia.risparmi, 0);
    for (const p of conRisparmi) {
      const quota = Math.min(p.economia.risparmi, (daCoprire * p.economia.risparmi) / disponibili);
      p.economia.risparmi = euro(p.economia.risparmi - quota);
    }
    daCoprire = Math.max(0, daCoprire - disponibili);
    if (daCoprire > 0) capofamiglia(state, membri).economia.debiti += euro(daCoprire);
  }

  // Quota delle spese attribuita a ciascuno (per la schermata Soldi)
  const totaleNetto = Math.max(1, nettoTotale);
  for (const p of membri) {
    const v = voci.get(p.id);
    const quota = nettoTotale > 0 ? v.netto / totaleNetto : p === capofamiglia(state, membri) ? 1 : 0;
    p.economia.bilancio = {
      anno: state.world.anno,
      lordo: euro(v.lordo),
      contributi: euro(v.contributi),
      tasse: euro(v.tasse),
      netto: euro(v.netto),
      spese_casa: euro(casa * quota),
      spese_vita: euro(vita * quota),
      spese_studio: euro(studio * quota),
      saldo: euro(v.netto - speseTotali * quota),
      nucleo: { membri: membri.length, entrate: euro(nettoTotale), spese: euro(speseTotali), affitto: !abitazione, mantenimento: euro(mantenimento), assegno: euro(assegno), inclusione: euro(inclusione) },
    };
  }
  return { nettoTotale, speseTotali, saldo };
}

/** Reddito netto annuo di una persona (tutte le fonti). */
export function nettoPersona(state, data, persona) {
  return redditiPersona(state, data, persona).reduce((s, r) => s + calcolaNetto(r.lordo, r.tipo).netto, 0);
}

/**
 * Assegni di mantenimento: il genitore che non vive con i figli minorenni versa il 12% del suo
 * netto per ciascun figlio (massimo 30%) al nucleo dove vivono. Restituisce { idNucleo: delta }.
 */
export function mantenimenti(state, data) {
  const delta = {};
  for (const g of personeVive(state)) {
    const figli = (g.figli ?? []).map((id) => state.persone[id]).filter((f) => vive(f) && eta(f, state.world.anno) < 18 && f.nucleo !== g.nucleo);
    if (!figli.length) continue;
    const netto = nettoPersona(state, data, g);
    if (netto <= 0) continue;
    const importo = netto * Math.min(0.3, 0.12 * figli.length);
    delta[g.nucleo] = (delta[g.nucleo] ?? 0) - importo;
    delta[figli[0].nucleo] = (delta[figli[0].nucleo] ?? 0) + importo;
  }
  return delta;
}

/** NASpI: dopo un licenziamento, 2 anni al 60% dell'ultimo stipendio (semplificata). */
export function avviaNaspi(state, data, persona) {
  const lordo = stipendioLordo(state, data, persona);
  if (lordo > 0) persona.carriera.naspi = { importo: euro(lordo * 0.6), anni: 2 };
}

/** Chi risponde dei debiti del nucleo: l'adulto con più reddito, altrimenti il più anziano. */
export function capofamiglia(state, membri) {
  const adulti = membri.filter((p) => eta(p, state.world.anno) >= 18);
  const lista = adulti.length ? adulti : membri;
  return [...lista].sort((a, b) => (b.economia.bilancio?.netto ?? 0) - (a.economia.bilancio?.netto ?? 0) || a.anno_nascita - b.anno_nascita)[0];
}

// ---------------------------------------------------------------------------
// Fine anno: interessi, debiti, inflazione, case, aziende, pensioni
// ---------------------------------------------------------------------------

/** Interessi sui risparmi e sui debiti; se ci sono risparmi, una parte ripaga i debiti. */
export function interessi(persona) {
  const e = persona.economia;
  if (e.risparmi > 0) e.risparmi = euro(e.risparmi * (1 + INTERESSE_RISPARMI));
  if (e.debiti > 0) {
    e.debiti = euro(e.debiti * (1 + INTERESSE_DEBITI));
    if (e.risparmi > 0) {
      const rimborso = Math.min(e.debiti, e.risparmi * 0.5);
      e.debiti = euro(e.debiti - rimborso);
      e.risparmi = euro(e.risparmi - rimborso);
    }
  }
}

/**
 * Inflazione dell'anno (circa 2%) e crescita dei salari (in media come i prezzi).
 * `mondo` sono i modificatori della congiuntura (FASE 6): caro vita, crisi, ripresa.
 */
export function aggiornaIndici(state, mondo = {}) {
  const w = state.world;
  w.inflazione = limita(normale(state, 0.02, 0.008) + (mondo.inflazione ?? 0), -0.005, 0.12);
  w.indice_prezzi *= 1 + w.inflazione;
  // salari reali in media stabili, come in Italia; nelle crisi e col caro vita restano indietro
  w.indice_salari *= 1 + w.inflazione + (mondo.salari ?? 0) + normale(state, 0, 0.003);
}

/** Le case si rivalutano con l'inflazione più una componente casuale del mercato. */
export function rivalutaCase(state, mondo = {}) {
  for (const c of Object.values(state.case)) {
    c.valore = euro(c.valore * (1 + state.world.inflazione + (mondo.case ?? 0) + normale(state, 0.002, 0.025)));
  }
}

/** Le aziende di famiglia crescono o soffrono; sotto una soglia di salute falliscono. */
export function aggiornaAziende(state, mondo = {}) {
  const esiti = [];
  for (const a of Object.values(state.aziende)) {
    if (a.fallita || a.venduta) continue;
    const andamento = normale(state, 0.01, 0.07) + (mondo.aziende ?? 0);
    a.fatturato = euro(a.fatturato * (1 + state.world.inflazione + andamento));
    a.valore = euro(a.valore * (1 + state.world.inflazione + andamento * 0.6));
    a.salute = limita(Math.round(a.salute + andamento * 120 + normale(state, 0, 4)), 0, 100);
    if (a.salute <= 5) {
      a.fallita = true;
      a.valore = 0;
      a.fatturato = 0;
      esiti.push({ azienda: a, esito: "fallita" });
    }
  }
  return esiti;
}

/** Elimina i nuclei rimasti senza nessuno in vita (la loro casa, se c'è, resta ai proprietari). */
export function pulisciNuclei(state) {
  const abitati = new Set(personeVive(state).map((p) => p.nucleo));
  for (const id of Object.keys(state.nuclei)) if (!abitati.has(id)) delete state.nuclei[id];
}

/**
 * Case di proprietà dove non vive nessuno: vengono affittate (cedolare secca 21%) e l'affitto
 * paga mutuo e manutenzione; il resto va ai proprietari. Le case senza proprietari vivi spariscono.
 */
export function caseVuote(state) {
  const occupate = new Set(Object.values(state.nuclei).map((n) => n.casa).filter(Boolean));
  for (const c of Object.values(state.case)) {
    if (occupate.has(c.id)) continue;
    const vivi = c.proprietari.map((id) => state.persone[id]).filter(vive);
    if (!vivi.length) {
      delete state.case[c.id];
      continue;
    }
    let netto = c.valore * (RENDITA_AFFITTO * (1 - CEDOLARE_SECCA) - 0.006);
    if (c.mutuo_residuo > 0) {
      const rata = Math.min(c.rata, c.mutuo_residuo * (1 + c.tasso));
      c.mutuo_residuo = Math.max(0, euro(c.mutuo_residuo * (1 + c.tasso) - rata));
      netto -= rata;
    }
    for (const p of vivi) {
      p.economia.risparmi = euro(p.economia.risparmi + netto / vivi.length);
      if (p.economia.risparmi < 0) {
        p.economia.debiti = euro(p.economia.debiti - p.economia.risparmi);
        p.economia.risparmi = 0;
      }
    }
  }
}

/**
 * Esdebitazione (procedura di sovraindebitamento, Codice della crisi d'impresa): quando i debiti superano
 * 40.000 euro del 2026 e due anni di reddito netto, il giudice li riduce a metà di un anno di reddito.
 * Si può fare al massimo una volta ogni 8 anni; costa reputazione e morale. Restituisce le persone coinvolte.
 */
export function esdebitazione(state, data) {
  const coinvolti = [];
  for (const p of personeVive(state)) {
    const e = p.economia;
    const netto = nettoPersona(state, data, p);
    if (e.debiti < 40000 * state.world.indice_prezzi || e.debiti < 2 * netto) continue;
    if (p.flags.esdebitato && state.world.anno - p.flags.esdebitato < 8) continue;
    e.debiti = euro(Math.max(0, netto * 0.5 - e.risparmi));
    e.risparmi = 0;
    p.flags.esdebitato = state.world.anno;
    p.stat.reputazione = limita(p.stat.reputazione - 10, 0, 100);
    p.stat.morale = limita(p.stat.morale - 8, 0, 100);
    coinvolti.push(p);
  }
  return coinvolti;
}

/**
 * Chi ha debiti pesanti (oltre 20.000 euro del 2026) vende una casa dove non vive:
 * il ricavato netto, diviso tra i proprietari, ripaga prima i debiti. Restituisce le frasi per il diario.
 */
export function vendiCasePerDebiti(state) {
  const righe = [];
  const occupate = new Set(Object.values(state.nuclei).map((n) => n.casa).filter(Boolean));
  for (const p of personeVive(state)) {
    if (p.economia.debiti < 20000 * state.world.indice_prezzi) continue;
    const casa = Object.values(state.case).find((c) => c.proprietari.includes(p.id) && !occupate.has(c.id));
    if (!casa) continue;
    const ricavo = Math.max(0, casa.valore - casa.mutuo_residuo) / casa.proprietari.length;
    for (const id of casa.proprietari) {
      const x = state.persone[id];
      if (!vive(x)) continue;
      const rimborso = Math.min(x.economia.debiti, ricavo);
      x.economia.debiti = euro(x.economia.debiti - rimborso);
      x.economia.risparmi = euro(x.economia.risparmi + ricavo - rimborso);
    }
    delete state.case[casa.id];
    righe.push({ persona: p, testo: `Vende ${casa.nome.toLowerCase()} per ripagare i debiti.` });
  }
  return righe;
}

/** Pensione: a 67 anni, il 65% dell'ultimo stipendio se ha lavorato almeno 20 anni, altrimenti l'assegno sociale. */
export function vaInPensione(state, data, persona, { anticipata = false } = {}) {
  const c = persona.carriera;
  if (c.pensionato || (!anticipata && eta(persona, state.world.anno) < etaPensione(state))) return false;
  const ultimo = c.lavoro ? stipendioLordo(state, data, persona) : 0;
  // chi esce prima prende il 12% in meno (semplificazione delle uscite anticipate)
  const quota = anticipata ? 0.65 * 0.88 : 0.65;
  c.pensione = euro((c.anni_lavorati ?? 0) >= 20 && ultimo > 0 ? ultimo * quota : ASSEGNO_SOCIALE * state.world.indice_prezzi);
  c.pensionato = true;
  c.lavoro = null;
  c.anzianita = 0;
  return true;
}

/** Rivaluta le pensioni in corso con l'inflazione. */
export function rivalutaPensione(state, persona) {
  if (persona.carriera?.pensionato) persona.carriera.pensione = euro(persona.carriera.pensione * (1 + state.world.inflazione));
}

// ---------------------------------------------------------------------------
// Patrimonio ed eredità
// ---------------------------------------------------------------------------

/** Quota di una casa posseduta da una persona (valore meno mutuo, diviso tra i proprietari). */
export function quotaCase(state, persona) {
  let totale = 0;
  for (const c of Object.values(state.case)) {
    if (c.proprietari.includes(persona.id)) totale += (c.valore - c.mutuo_residuo) / c.proprietari.length;
  }
  return euro(totale);
}

export function valoreAziende(state, persona) {
  return euro(Object.values(state.aziende).reduce((s, a) => s + (a.proprietario === persona.id ? a.valore : 0), 0));
}

/** Patrimonio netto: risparmi + case + aziende − debiti. */
export function patrimonio(state, persona) {
  return euro(persona.economia.risparmi + quotaCase(state, persona) + valoreAziende(state, persona) - persona.economia.debiti);
}

/**
 * Successione semplificata (art. 581-583 c.c.): coniuge e figli. Con un figlio metà ciascuno,
 * con più figli un terzo al coniuge e il resto diviso tra i figli; senza coniuge tutto ai figli.
 * Se il patrimonio è negativo gli eredi rinunciano e i debiti si estinguono (beneficio d'inventario).
 * Le case passano agli eredi in comproprietà; l'azienda al figlio maggiore vivo, altrimenti al coniuge.
 */
export function eredita(state, defunto) {
  const coniuge = defunto.partner && vive(state.persone[defunto.partner]) ? state.persone[defunto.partner] : null;
  const figli = (defunto.figli ?? []).map((id) => state.persone[id]).filter(vive);
  const eredi = [];
  if (coniuge && figli.length === 0) eredi.push([coniuge, 1]);
  else if (coniuge && figli.length === 1) eredi.push([coniuge, 0.5], [figli[0], 0.5]);
  else if (coniuge) eredi.push([coniuge, 1 / 3], ...figli.map((f) => [f, 2 / 3 / figli.length]));
  else eredi.push(...figli.map((f) => [f, 1 / figli.length]));
  // senza coniuge né figli: genitori, poi fratelli (semplificazione degli art. 568-571 c.c.)
  if (!eredi.length) {
    const genitori = [state.persone[defunto.madre], state.persone[defunto.padre]].filter(vive);
    const fratelli = personeVive(state).filter((x) => x.id !== defunto.id && ((defunto.madre && x.madre === defunto.madre) || (defunto.padre && x.padre === defunto.padre)));
    const lista = genitori.length ? genitori : fratelli;
    eredi.push(...lista.map((x) => [x, 1 / lista.length]));
  }

  const netto = patrimonio(state, defunto);
  const righe = [];
  if (!eredi.length) {
    righe.push(`Nessun erede: il patrimonio di ${defunto.nome} va allo Stato.`);
  } else if (netto < 0) {
    righe.push(`Gli eredi di ${defunto.nome} rinunciano all'eredità: i debiti (${euro(-netto)} €) non passano a nessuno.`);
  } else {
    // contanti meno debiti: se il saldo è negativo i debiti passano agli eredi insieme alle case
    const liquidi = defunto.economia.risparmi - defunto.economia.debiti;
    for (const [erede, quota] of eredi) {
      if (liquidi >= 0) erede.economia.risparmi = euro(erede.economia.risparmi + liquidi * quota);
      else erede.economia.debiti = euro(erede.economia.debiti - liquidi * quota);
    }
    for (const c of Object.values(state.case)) {
      if (!c.proprietari.includes(defunto.id)) continue;
      c.proprietari = [...c.proprietari.filter((id) => id !== defunto.id), ...eredi.map(([e]) => e.id).filter((id) => !c.proprietari.includes(id))];
    }
    const azienda = Object.values(state.aziende).find((a) => a.proprietario === defunto.id && !a.fallita && !a.venduta);
    if (azienda) {
      // prima chi ci lavora già, poi il figlio maggiore, poi il coniuge, poi gli altri eredi
      const ordinati = [...figli].sort((a, b) => a.anno_nascita - b.anno_nascita);
      const successore = ordinati.find((f) => f.carriera.azienda === azienda.id) ?? ordinati[0] ?? coniuge ?? eredi[0]?.[0];
      if (successore) {
        azienda.proprietario = successore.id;
        if (successore.carriera.azienda === azienda.id) {
          successore.carriera.lavoro = null;
          successore.carriera.imprenditore = true;
        }
        righe.push(`${azienda.nome} passa a ${successore.nome}.`);
      }
    }
    righe.unshift(`L'eredità di ${defunto.nome} (${euro(netto).toLocaleString("it-IT")} €) va a ${eredi.map(([e]) => e.nome).join(", ")}.`);
  }
  defunto.economia.risparmi = 0;
  defunto.economia.debiti = 0;
  return righe;
}
