// "Racconta la tua famiglia" (FASE 9): il giocatore descrive la propria famiglia, con un modulo
// o con un testo libero che l'AI trasforma in una descrizione strutturata. Qui la descrizione viene
// ripulita (solo valori ammessi) e trasformata in una partita vera. Soldi, case e stipendi li decide
// il codice in base alle tabelle, come per la famiglia generata a caso.

import { statoVuoto, nuovoId } from "./state.js";
import { creaPersona, collega, annota, genere } from "./family.js";
import { intero, pesato, pesatoChiavi, probabile, scegli, tra } from "./rng.js";
import { euro, limita, riempi, TITOLI } from "./util.js";
import { prezzoCasa, rataMutuo } from "./economy.js";
import { ANNO_INIZIO, lavoroGenitore, scegliNome, scegliTratti, titoloPerLavoro } from "./generator.js";
import { aggiungiTratto } from "./azioni.js";
import { verificaTraguardi } from "./traguardi.js";

export const RUOLI = ["protagonista", "madre", "padre", "fratello", "partner", "figlio"];
const AGIATEZZE = ["precaria", "media", "agiata", "ricca"];
const ETA_MIN_PROTAGONISTA = 6;

const testo = (x, max = 40) => (typeof x === "string" ? x.replace(/[{}<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");
const numero = (x, min, max) => (Number.isFinite(Number(x)) && String(x).trim() !== "" ? limita(Math.round(Number(x)), min, max) : null);
const nomeProprio = (x) => {
  const t = testo(x, 30);
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};

/** "Luca 12, Sara 8 anni" → [{ nome: "Luca", eta: 12 }, { nome: "Sara", eta: 8 }] (anche "Luca (12)", "Luca, 12"). */
export function leggiElenco(riga) {
  if (typeof riga !== "string") return [];
  return riga
    .split(/[;\n]|,(?!\s*\d)/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const m = x.match(/^([\p{L}' -]+?)[\s,(]*(\d{1,3})?\s*(?:anni)?\)?$/u);
      return m ? { nome: nomeProprio(m[1]), eta: m[2] ? Number(m[2]) : null } : null;
    })
    .filter((x) => x && x.nome)
    .slice(0, 8);
}

/** Sesso da un nome italiano quando non è indicato (semplificazione: finale in -a = femminile, tranne pochi casi). */
function sessoDaNome(data, nome) {
  if (data.nomi.femminili.includes(nome)) return "F";
  if (data.nomi.maschili.includes(nome)) return "M";
  return /a$/i.test(nome) && !/^(Andrea|Luca|Mattia|Nicola|Elia|Enea|Tobia)$/i.test(nome) ? "F" : "M";
}

/**
 * Ripulisce una descrizione (dall'AI o dal modulo): tiene solo regioni, mestieri, tratti, titoli e ruoli
 * esistenti, limita età e quantità. Restituisce sempre una descrizione utilizzabile.
 */
export function normalizzaDescrizione(data, g = {}) {
  const regione = data.regione[g.regione] ? g.regione : data.regioni.find((r) => r.nome.toLowerCase() === String(g.regione ?? "").toLowerCase())?.id ?? null;
  const cittaValide = regione ? data.regione[regione].citta.map((c) => c.nome) : [];
  const citta = cittaValide.find((c) => c.toLowerCase() === String(g.citta ?? "").toLowerCase()) ?? null;
  const persone = [];
  for (const p of Array.isArray(g.persone) ? g.persone : []) {
    const ruolo = RUOLI.includes(p?.ruolo) ? p.ruolo : null;
    if (!ruolo) continue;
    if (["protagonista", "madre", "padre", "partner"].includes(ruolo) && persone.some((x) => x.ruolo === ruolo)) continue;
    const nome = nomeProprio(p.nome);
    persone.push({
      ruolo,
      nome,
      sesso: ruolo === "madre" ? "F" : ruolo === "padre" ? "M" : p.sesso === "F" || p.sesso === "M" ? p.sesso : nome ? sessoDaNome(data, nome) : null,
      eta: numero(p.eta, 0, 105),
      vivo: p.vivo !== false,
      lavoro: data.mestiere[p.lavoro] && !data.mestiere[p.lavoro].solo_famiglia ? p.lavoro : null,
      titolo: TITOLI.includes(p.titolo) ? p.titolo : null,
      tratti: (Array.isArray(p.tratti) ? p.tratti : []).filter((t) => data.tratto[t]).slice(0, 3),
      titolare: Boolean(p.titolare),
      controlla: Boolean(p.controlla),
    });
  }
  if (!persone.some((p) => p.ruolo === "protagonista")) persone.unshift({ ruolo: "protagonista", nome: "", sesso: null, eta: null, vivo: true, lavoro: null, titolo: null, tratti: [], titolare: false, controlla: false });
  const io = persone.find((p) => p.ruolo === "protagonista");
  io.vivo = true;
  io.eta = limita(io.eta ?? ETA_MIN_PROTAGONISTA, ETA_MIN_PROTAGONISTA, 90);
  return {
    cognome: nomeProprio(g.cognome),
    regione,
    citta,
    agiatezza: AGIATEZZE.includes(g.agiatezza) ? g.agiatezza : null,
    casa: g.casa === "proprieta" || g.casa === "affitto" ? g.casa : null,
    genitori_separati: Boolean(g.genitori_separati),
    azienda: testo(g.azienda, 50) || null,
    storia: typeof g.storia === "string" ? g.storia.replace(/[<>]/g, "").trim().slice(0, 3000) : "",
    persone: persone.filter((p) => p.ruolo !== "figlio" || persone.filter((x) => x.ruolo === "figlio").indexOf(p) < 6).slice(0, 16),
  };
}

/** Istruzione coerente con l'età: scuola in corso per i ragazzi, titolo finito per gli adulti. */
function istruzionePerEta(state, data, p, anni, titolo, lavoro) {
  const base = { ...p.istruzione, voti: 6.8 };
  if (anni < 6) return { ...base, livello: "nessuno", iscritto: false };
  if (anni <= 10) return { ...base, livello: "elementari", iscritto: true, anno_corso: anni - 5, titolo: "nessuno" };
  if (anni <= 13) return { ...base, livello: "medie", iscritto: true, anno_corso: anni - 10, titolo: "licenza_elementare" };
  if (anni <= 18) return { ...base, livello: "superiori", iscritto: true, anno_corso: Math.min(5, anni - 13), titolo: "licenza_media", indirizzo: scegli(state, data.superiori).id };
  const t = titolo ?? titoloPerLavoro(data, lavoro, state);
  return { ...base, livello: "nessuno", iscritto: false, titolo: t, facolta: t.startsWith("laurea") ? scegli(state, data.facolta_lista).id : null };
}

/** Crea una persona della descrizione con lavoro, studi, statistiche e risparmi plausibili. */
function creaDaDescrizione(state, data, d, { classe, cognome, regione, citta, nucleo, sangue, generazione }) {
  const anni = d.eta;
  const sesso = d.sesso ?? (probabile(state, 0.5) ? "F" : "M");
  const p = creaPersona(state, {
    nome: d.nome || scegliNome(state, data, sesso),
    cognome,
    sesso,
    anno_nascita: ANNO_INIZIO - anni,
    regione,
    citta,
    nucleo,
    sangue,
    generazione,
    tratti: d.tratti.length ? [...d.tratti] : scegliTratti(state, data),
  });
  // tratti indicati dall'utente: si tolgono eventuali opposti
  for (const t of d.tratti) aggiungiTratto(state, data, p, t);
  let lavoro = { lavoro: null, anzianita: 0, anni_lavorati: 0 };
  if (anni >= 19 && anni < 67) {
    if (d.lavoro) {
      const anz = Math.max(0, anni - Math.max(data.mestiere[d.lavoro].eta_min, 21) - intero(state, 0, 3));
      lavoro = { lavoro: d.lavoro, anzianita: anz, anni_lavorati: anz };
    } else if (!d.titolare) lavoro = lavoroGenitore(state, data, classe, anni);
  }
  p.istruzione = istruzionePerEta(state, data, p, anni, d.titolo, lavoro.lavoro ?? d.lavoro);
  p.carriera = { ...p.carriera, ...lavoro, dal: lavoro.lavoro ? ANNO_INIZIO - lavoro.anzianita : null, storico: [] };
  if (anni >= 67) {
    p.carriera.pensionato = true;
    p.carriera.anni_lavorati = Math.max(20, anni - 25);
    p.carriera.pensione = euro(tra(state, 14000, 26000) * ({ precaria: 0.7, media: 1, agiata: 1.4, ricca: 2 }[state.famiglia.agiatezza] ?? 1));
  }
  p.stat = { salute: limita(intero(state, 72, 95) - Math.max(0, anni - 50), 25, 100), morale: intero(state, 50, 78), felicita: intero(state, 50, 78), stanchezza: intero(state, 15, 50), reputazione: intero(state, 42, 60) };
  if (anni >= 20) p.economia.risparmi = euro(tra(state, ...classe.risparmi) * Math.min(1, (anni - 18) / 30) * 0.5);
  if (!d.vivo) {
    p.anno_morte = ANNO_INIZIO - 1;
    p.causa_morte = "malattia";
    p.archiviato = true;
  }
  if (anni >= 20) p.flags.vive_da_solo = ANNO_INIZIO;
  return p;
}

/**
 * Costruisce la partita da una descrizione già normalizzata. Ciò che manca si genera a caso, con le
 * stesse tabelle della famiglia casuale. Il protagonista può essere un bambino o un adulto con famiglia.
 */
export function generaDaDescrizione(data, seed, descrizione) {
  const d = normalizzaDescrizione(data, descrizione);
  const state = statoVuoto(seed >>> 0, ANNO_INIZIO);
  const G = data.generatore;
  const regione = d.regione ? data.regione[d.regione] : pesato(state, data.regioni);
  const citta = d.citta ?? pesato(state, regione.citta, (c) => (c.grande ? 2.5 : 1)).nome;
  const idClasse = d.agiatezza ?? pesatoChiavi(state, G.agiatezza[regione.area]);
  const classe = G.classi[idClasse];
  const cognome = d.cognome || scegli(state, data.nomi.cognomi[regione.area]);
  state.famiglia = { cognome, reputazione: { precaria: 40, media: 50, agiata: 60, ricca: 70 }[idClasse], agiatezza: idClasse, storia: d.storia };

  const di = (ruolo) => d.persone.filter((p) => p.ruolo === ruolo);
  const descIo = di("protagonista")[0];
  const nucleoDi = () => {
    const id = nuovoId(state, "n");
    state.nuclei[id] = { id, regione: regione.id, citta, casa: null };
    return id;
  };
  const comune = { classe, regione: regione.id, citta };

  // genitori: se il protagonista è giovane servono sempre; se è adulto solo quelli raccontati
  const etaIo = descIo.eta;
  const servonoGenitori = etaIo < 30 || di("madre").length || di("padre").length;
  const nucleoGenitori = nucleoDi();
  // un solo genitore raccontato (e vivo): l'altro c'è ma vive altrove
  const raccontati = [...di("madre"), ...di("padre")];
  const separati = d.genitori_separati || (raccontati.length === 1 && raccontati[0].vivo && etaIo < 30);
  let madre = null;
  let padre = null;
  if (servonoGenitori) {
    const dm = di("madre")[0] ?? { ruolo: "madre", nome: "", sesso: "F", eta: null, vivo: true, lavoro: null, titolo: null, tratti: [], titolare: false };
    const dp = di("padre")[0] ?? { ruolo: "padre", nome: "", sesso: "M", eta: null, vivo: true, lavoro: null, titolo: null, tratti: [], titolare: false };
    dm.eta ??= etaIo + intero(state, ...G.eta_madre_al_parto);
    dp.eta ??= dm.eta + intero(state, ...G.differenza_eta_padre);
    // genitori anziani mancanti si considerano morti prima dell'inizio
    if (!di("madre").length && dm.eta > 92) dm.vivo = false;
    if (!di("padre").length && dp.eta > 90) dp.vivo = false;
    madre = creaDaDescrizione(state, data, dm, { ...comune, cognome: scegli(state, data.nomi.cognomi[regione.area]), nucleo: nucleoGenitori, sangue: true, generazione: 0 });
    const nucleoPadre = separati ? nucleoDi() : nucleoGenitori;
    padre = creaDaDescrizione(state, data, dp, { ...comune, cognome, nucleo: nucleoPadre, sangue: true, generazione: 0 });
    for (const g of [madre, padre]) delete g.flags.vive_da_solo;
    const insieme = !separati && madre.anno_morte == null && padre.anno_morte == null;
    madre.stato_civile = padre.stato_civile = separati ? "separato" : insieme ? "sposato" : "vedovo";
    if (!separati) {
      madre.partner = padre.id;
      padre.partner = madre.id;
      madre.coppia_dal = padre.coppia_dal = madre.anno_nascita + 26; // semplificazione: insieme da quando lei aveva 26 anni
    }
    collega(state, madre.id, padre.id, "partner", "partner", separati ? -20 : intero(state, 30, 80));
  }

  // protagonista: con i genitori se è giovane e single, altrimenti in casa propria
  const partnerDesc = di("partner")[0];
  const conGenitori = servonoGenitori && (etaIo < 25 && !partnerDesc) && (madre?.anno_morte == null || padre?.anno_morte == null);
  // con i genitori separati si vive con quello raccontato (o con la madre)
  const preferito = separati && di("padre").length && !di("madre").length ? padre : madre;
  const altro = preferito === madre ? padre : madre;
  const nucleoIo = conGenitori ? (preferito?.anno_morte == null ? preferito.nucleo : altro.nucleo) : nucleoDi();
  const io = creaDaDescrizione(state, data, descIo, { ...comune, cognome: padre?.cognome ?? cognome, nucleo: nucleoIo, sangue: true, generazione: 1 });
  if (conGenitori) delete io.flags.vive_da_solo;
  io.controllo = "giocatore";
  state.giocatore = io.id;
  if (madre) io.madre = madre.id;
  if (padre) io.padre = padre.id;

  // fratelli e sorelle
  const fratelli = [];
  for (const df of di("fratello")) {
    df.eta ??= limita(etaIo + intero(state, -6, 6), 0, 100);
    const conLoro = df.eta < 25 && conGenitori;
    const nucleo = conLoro ? io.nucleo : df.eta < 25 && madre ? madre.nucleo : nucleoDi();
    const f = creaDaDescrizione(state, data, df, { ...comune, cognome: io.cognome, nucleo, sangue: true, generazione: 1 });
    if (conLoro) delete f.flags.vive_da_solo;
    if (madre) f.madre = madre.id;
    if (padre) f.padre = padre.id;
    fratelli.push(f);
  }
  const figliGenitori = [io, ...fratelli];
  for (const g of [madre, padre].filter(Boolean)) g.figli.push(...figliGenitori.map((f) => f.id));
  for (const f of figliGenitori) {
    if (madre) collega(state, f.id, madre.id, "genitore", "figlio", intero(state, 45, 85));
    if (padre) collega(state, f.id, padre.id, "genitore", "figlio", separati ? intero(state, -10, 45) : intero(state, 35, 80));
  }
  for (const a of figliGenitori) for (const b of figliGenitori) if (a.id < b.id) collega(state, a.id, b.id, "fratello", "fratello", intero(state, 15, 75));

  // partner e figli del protagonista
  let partner = null;
  if (partnerDesc) {
    partnerDesc.sesso ??= io.sesso === "M" ? "F" : "M";
    partnerDesc.eta ??= limita(etaIo + (io.sesso === "M" ? -2 : 2), 18, 100);
    partner = creaDaDescrizione(state, data, partnerDesc, { ...comune, cognome: scegli(state, data.nomi.cognomi[regione.area]), nucleo: io.nucleo, sangue: false, generazione: 1 });
    const vivo = partner.anno_morte == null;
    io.partner = partner.id;
    partner.partner = io.id;
    io.stato_civile = partner.stato_civile = vivo ? "sposato" : "vedovo";
    io.coppia_dal = partner.coppia_dal = ANNO_INIZIO - Math.max(1, Math.min(etaIo, partnerDesc.eta) - 26);
    collega(state, io.id, partner.id, "partner", "partner", intero(state, 50, 85));
  }
  const figli = [];
  for (const dfg of di("figlio")) {
    dfg.eta ??= limita(etaIo - intero(state, 26, 34), 0, 70);
    if (dfg.eta > etaIo - 16) dfg.eta = Math.max(0, etaIo - 16);
    const conLoro = dfg.eta < 26;
    const f = creaDaDescrizione(state, data, dfg, { ...comune, cognome: io.sesso === "M" ? io.cognome : partner?.cognome ?? io.cognome, nucleo: conLoro ? io.nucleo : nucleoDi(), sangue: true, generazione: 2 });
    if (conLoro) delete f.flags.vive_da_solo;
    if (io.sesso === "F") {
      f.madre = io.id;
      if (partner) f.padre = partner.id;
    } else {
      f.padre = io.id;
      if (partner) f.madre = partner.id;
    }
    io.figli.push(f.id);
    partner?.figli.push(f.id);
    collega(state, f.id, io.id, "genitore", "figlio", intero(state, 50, 90));
    if (partner) collega(state, f.id, partner.id, "genitore", "figlio", intero(state, 50, 90));
    figli.push(f);
  }
  for (const a of figli) for (const b of figli) if (a.id < b.id) collega(state, a.id, b.id, "fratello", "fratello", intero(state, 20, 80));

  // casa della famiglia in cui vive il protagonista
  const nucleoCasa = state.nuclei[io.nucleo];
  const proprietari = conGenitori ? [madre, padre].filter((g) => g && g.anno_morte == null && g.nucleo === io.nucleo) : [io, partner].filter((x) => x && x.anno_morte == null);
  const haCasa = d.casa ? d.casa === "proprieta" : probabile(state, conGenitori ? classe.casa_proprieta : Math.min(0.9, classe.casa_proprieta * Math.min(1, etaIo / 45)));
  if (haCasa && proprietari.length) {
    const grande = regione.citta.find((c) => c.nome === citta)?.grande ?? false;
    const valore = euro(prezzoCasa(state, data, regione.id, grande) * { precaria: 0.75, media: 1, agiata: 1.45, ricca: 2.4 }[idClasse] * tra(state, 0.85, 1.15));
    const anni = Math.max(0, 25 - Math.max(0, Math.min(...proprietari.map((x) => ANNO_INIZIO - x.anno_nascita)) - 32));
    const residuo = anni > 0 && idClasse !== "ricca" ? euro(valore * 0.8 * (anni / 25)) : 0;
    const id = nuovoId(state, "c");
    state.case[id] = { id, nome: grande ? `Appartamento a ${citta}` : `Casa a ${citta}`, regione: regione.id, citta, valore, mutuo_residuo: residuo, tasso: 0.035, anni_residui: anni, rata: euro(rataMutuo(residuo, 0.035, Math.max(1, anni))), proprietari: proprietari.map((x) => x.id) };
    nucleoCasa.casa = id;
    for (const x of proprietari) x.flags.proprietario = ANNO_INIZIO;
  }

  // azienda di famiglia: titolare chi è indicato, altrimenti il padre o il protagonista adulto
  const tutti = Object.values(state.persone).filter((x) => x.anno_morte == null);
  const desc = [...d.persone];
  const titolareDesc = desc.find((p) => p.titolare);
  let titolare = titolareDesc ? tutti.find((x) => x.nome === titolareDesc.nome && x.anno_nascita === ANNO_INIZIO - titolareDesc.eta) : null;
  // senza titolare indicato: chi non ha un lavoro scelto dal giocatore, prima il padre; con un nome d'azienda anche il protagonista
  const libero = (x) => x && x.anno_morte == null && ANNO_INIZIO - x.anno_nascita >= 25 && !d.persone.some((dp) => dp.lavoro && dp.nome === x.nome);
  const candidato = titolare ?? [padre, madre, io, partner].find(libero) ?? (d.azienda ? io : null);
  const vuoleAzienda = d.azienda || titolareDesc || probabile(state, classe.azienda * 0.5);
  if (vuoleAzienda && candidato) {
    titolare = candidato;
    const tipo = scegli(state, G.aziende);
    const valore = euro(tra(state, ...tipo.valore) * { precaria: 0.5, media: 0.8, agiata: 1.2, ricca: 2 }[idClasse]);
    const id = nuovoId(state, "a");
    state.aziende[id] = {
      id,
      nome: d.azienda || riempi(tipo.nome, { cognome: titolare.cognome, nome: titolare.nome }),
      settore: tipo.settore,
      valore,
      fatturato: euro(valore * tra(state, 0.7, 1.1)),
      margine: tipo.margine,
      salute: intero(state, 45, 85),
      proprietario: titolare.id,
      dipendenti_famiglia: [titolare.id],
      fondata: ANNO_INIZIO - intero(state, 3, 40),
      fallita: false,
    };
    titolare.carriera.lavoro = null;
    titolare.carriera.imprenditore = true;
    titolare.carriera.azienda = id;
  }

  // storia dei genitori e del protagonista
  for (const g of [madre, padre].filter((x) => x && x.anno_morte == null)) g.storia = riempi(scegli(state, G.storie[idClasse]), { nome: g.nome, ...genere(g) });

  // chi controllare insieme al protagonista (massimo 4, dai 6 anni)
  const extra = d.persone
    .filter((p) => p.controlla && p.ruolo !== "protagonista")
    .map((p) => tutti.find((x) => x.nome === (p.nome || "?") && x.id !== io.id))
    .filter((x) => x && ANNO_INIZIO - x.anno_nascita >= 6);
  state.controllati = [io.id, ...new Set(extra.map((x) => x.id))].slice(0, 4);
  state.dinastia = { generazione: 1, giocati: [{ id: io.id, dal: ANNO_INIZIO, al: null }], traguardi: [], storico: [] };
  // ciò che è già vero all'inizio (nonni, terza generazione…) è il punto di partenza, non un traguardo da annunciare
  for (const riga of verificaTraguardi(state, data)) void riga;
  for (const t of state.dinastia.traguardi) {
    t.anno = ANNO_INIZIO - 1;
    t.iniziale = true;
  }
  if (d.storia) annota(state, io, `La storia della famiglia ${cognome}: ${d.storia.slice(0, 280)}${d.storia.length > 280 ? "…" : ""}`);
  annota(state, io, `${io.nome} ha ${etaIo} anni e vive a ${citta}.`);
  return state;
}


/** Prima di iniziare: aggiunge o toglie una persona dai controllati (massimo 4, vive, dai 6 anni). */
export function alternaControlloIniziale(state, id) {
  const p = state.persone[id];
  if (!p || p.anno_morte != null || id === state.giocatore || ANNO_INIZIO - p.anno_nascita < 6) return false;
  if (state.controllati.includes(id)) state.controllati = state.controllati.filter((x) => x !== id);
  else if (state.controllati.length < 4) state.controllati.push(id);
  else return false;
  return true;
}

/** Dal modulo della schermata (valori dei campi) a una descrizione da passare a generaDaDescrizione. */
export function descrizioneDaModulo(v = {}) {
  const persone = [{ ruolo: "protagonista", nome: v["r-nome"], sesso: v["r-sesso"] || null, eta: v["r-eta"], lavoro: v["r-lavoro"] || null, tratti: v["r-tratti"] ?? [] }];
  const genitore = (ruolo, nome, eta, morto) => {
    if (nome || eta || morto) persone.push({ ruolo, nome, eta, vivo: !morto });
  };
  genitore("madre", v["r-madre"], v["r-madre-eta"], v["r-madre-morta"]);
  genitore("padre", v["r-padre"], v["r-padre-eta"], v["r-padre-morto"]);
  if (v["r-partner"] || v["r-partner-eta"]) persone.push({ ruolo: "partner", nome: v["r-partner"], eta: v["r-partner-eta"] });
  for (const f of leggiElenco(v["r-figli"])) persone.push({ ruolo: "figlio", ...f });
  for (const f of leggiElenco(v["r-fratelli"])) persone.push({ ruolo: "fratello", ...f });
  return {
    cognome: v["r-cognome"],
    regione: v["r-regione"] || null,
    citta: v["r-citta"] || null,
    agiatezza: v["r-agiatezza"] || null,
    casa: v["r-casa"] || null,
    genitori_separati: Boolean(v["r-separati"]),
    azienda: v["r-azienda"] || null,
    storia: v["r-storia"] ?? "",
    persone,
  };
}
