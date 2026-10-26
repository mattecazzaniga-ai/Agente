// Generatore della prima famiglia: protagonista di 6 anni, genitori, fratelli, casa, risparmi,
// eventuale azienda di famiglia. Tutto da tabelle pesate in data/generator.json e data/regions.json.

import { statoVuoto, nuovoId } from "./state.js";
import { creaPersona, collega, annota, genere } from "./family.js";
import { intero, pesato, pesatoChiavi, probabile, scegli, tra } from "./rng.js";
import { euro, riempi } from "./util.js";
import { prezzoCasa, rataMutuo } from "./economy.js";

export const ANNO_INIZIO = 2026;
export const ETA_INIZIO = 6;

/** Sceglie 2-3 tratti compatibili; `preferiti` sono tratti con probabilità maggiore (ereditati). */
export function scegliTratti(state, data, preferiti = [], quanti = null) {
  const n = quanti ?? (probabile(state, 0.6) ? 2 : 3);
  const scelti = [];
  const candidati = data.tratti.map((t) => ({ ...t, peso: preferiti.includes(t.id) ? 4 : 1 }));
  while (scelti.length < n) {
    const liberi = candidati.filter((t) => !scelti.includes(t.id) && !scelti.some((s) => data.tratto[s].opposti.includes(t.id) || t.opposti.includes(s)));
    if (!liberi.length) break;
    scelti.push(pesato(state, liberi).id);
  }
  return scelti;
}

function scegliNome(state, data, sesso) {
  return scegli(state, sesso === "F" ? data.nomi.femminili : data.nomi.maschili);
}

/** Lavoro e anzianità di un genitore in base alla classe sociale. */
function lavoroGenitore(state, data, classe, eta) {
  if (probabile(state, classe.disoccupato)) return { lavoro: null, anzianita: 0, anni_lavorati: Math.max(0, eta - 22 - intero(state, 2, 8)) };
  const possibili = classe.mestieri.map((id) => data.mestiere[id]).filter((m) => m && m.eta_min <= eta);
  const m = scegli(state, possibili);
  const anni = Math.max(0, eta - Math.max(m.eta_min, 20) - intero(state, 0, 4));
  return { lavoro: m.id, anzianita: Math.min(anni, intero(state, 2, Math.max(2, anni))), anni_lavorati: anni };
}

function titoloPerLavoro(data, idLavoro, state) {
  if (!idLavoro) return scegli(state, ["licenza_media", "diploma"]);
  const min = data.mestiere[idLavoro].titolo_min;
  return min === "nessuno" ? scegli(state, ["licenza_media", "licenza_media", "diploma"]) : min;
}

/** Crea un genitore completo (lavoro, tratti, storia, risparmi). */
function creaGenitore(state, data, { sesso, cognome, annoNascita, regione, citta, nucleo, classe, idClasse }) {
  const eta = ANNO_INIZIO - annoNascita;
  const lavoro = lavoroGenitore(state, data, classe, eta);
  const g = creaPersona(state, {
    nome: scegliNome(state, data, sesso),
    cognome,
    sesso,
    anno_nascita: annoNascita,
    regione,
    citta,
    nucleo,
    tratti: scegliTratti(state, data),
  });
  g.istruzione = { ...g.istruzione, livello: "nessuno", titolo: titoloPerLavoro(data, lavoro.lavoro, state), iscritto: false };
  g.carriera = { ...g.carriera, ...lavoro, storico: lavoro.lavoro ? [{ lavoro: lavoro.lavoro, dal: ANNO_INIZIO - lavoro.anzianita }] : [] };
  g.stat = { salute: intero(state, 65, 90), morale: intero(state, 45, 75), felicita: intero(state, 45, 75), stanchezza: intero(state, 25, 55), reputazione: intero(state, 40, 60) };
  g.storia = riempi(scegli(state, data.generatore.storie[idClasse]), { nome: g.nome, ...genere(g) });
  return g;
}

/** Genera una nuova partita a partire da un seed (numero intero). */
export function generaFamiglia(data, seed) {
  const state = statoVuoto(seed >>> 0, ANNO_INIZIO);
  const G = data.generatore;

  // Luogo
  const regione = pesato(state, data.regioni);
  const citta = pesato(state, regione.citta, (c) => (c.grande ? 2.5 : 1)).nome;
  const idClasse = pesatoChiavi(state, G.agiatezza[regione.area]);
  const classe = G.classi[idClasse];
  const cognome = scegli(state, data.nomi.cognomi[regione.area]);
  state.famiglia = { cognome, reputazione: { precaria: 40, media: 50, agiata: 60, ricca: 70 }[idClasse], agiatezza: idClasse };

  // Nucleo familiare e date di nascita
  const nucleo = nuovoId(state, "n");
  state.nuclei[nucleo] = { id: nucleo, regione: regione.id, citta, casa: null };
  const annoProtagonista = ANNO_INIZIO - ETA_INIZIO;
  const etaMadre = intero(state, ...G.eta_madre_al_parto);
  const annoMadre = annoProtagonista - etaMadre;
  const annoPadre = annoMadre - intero(state, ...G.differenza_eta_padre);
  const separati = probabile(state, G.genitori_separati);

  const base = { cognome, regione: regione.id, citta, classe, idClasse };
  const madre = creaGenitore(state, data, { ...base, sesso: "F", annoNascita: annoMadre, nucleo, cognome: scegli(state, data.nomi.cognomi[regione.area]) });
  let nucleoPadre = nucleo;
  if (separati) {
    nucleoPadre = nuovoId(state, "n");
    state.nuclei[nucleoPadre] = { id: nucleoPadre, regione: regione.id, citta, casa: null };
  }
  const padre = creaGenitore(state, data, { ...base, sesso: "M", annoNascita: annoPadre, nucleo: nucleoPadre });
  madre.stato_civile = padre.stato_civile = separati ? "separato" : "sposato";
  if (!separati) {
    madre.partner = padre.id;
    padre.partner = madre.id;
  }
  collega(state, madre.id, padre.id, "partner", "partner", separati ? -20 : intero(state, 30, 80));

  // Protagonista
  const sesso = probabile(state, 0.5) ? "F" : "M";
  const ereditabili = [...madre.tratti, ...padre.tratti].filter(() => probabile(state, 0.35));
  const io = creaPersona(state, {
    nome: scegliNome(state, data, sesso),
    cognome,
    sesso,
    anno_nascita: annoProtagonista,
    regione: regione.id,
    citta,
    nucleo,
    madre: madre.id,
    padre: padre.id,
    controllo: "giocatore",
    tratti: scegliTratti(state, data, ereditabili),
  });
  io.istruzione = { ...io.istruzione, livello: "elementari", anno_corso: 1, iscritto: true, voti: 7 };
  io.stat = { salute: intero(state, 80, 95), morale: intero(state, 60, 80), felicita: intero(state, 60, 80), stanchezza: 15, reputazione: 50 };
  state.giocatore = io.id;

  // Fratelli e sorelle (solo già nati all'inizio della partita)
  const numero = pesato(state, G.fratelli).n;
  const figli = [io];
  for (let i = 0; i < numero; i++) {
    const anno = annoProtagonista + scegli(state, [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
    if (anno - annoMadre < 19 || anno - annoMadre > 45 || anno > ANNO_INIZIO) continue;
    const s = probabile(state, 0.5) ? "F" : "M";
    const f = creaPersona(state, {
      nome: scegliNome(state, data, s),
      cognome,
      sesso: s,
      anno_nascita: anno,
      regione: regione.id,
      citta,
      nucleo,
      madre: madre.id,
      padre: padre.id,
      tratti: scegliTratti(state, data, [...madre.tratti, ...padre.tratti].filter(() => probabile(state, 0.35))),
    });
    const etaF = ANNO_INIZIO - anno;
    if (etaF >= 6) {
      const livello = etaF >= 19 ? "nessuno" : etaF >= 14 ? "superiori" : etaF >= 11 ? "medie" : "elementari";
      const inizio = { elementari: 6, medie: 11, superiori: 14 }[livello];
      f.istruzione = {
        ...f.istruzione,
        livello,
        iscritto: livello !== "nessuno",
        anno_corso: livello === "nessuno" ? 0 : etaF - inizio + 1,
        titolo: etaF >= 19 ? "diploma" : etaF >= 14 ? "licenza_media" : etaF >= 11 ? "licenza_elementare" : "nessuno",
        indirizzo: etaF >= 14 ? scegli(state, data.superiori).id : null,
      };
    }
    figli.push(f);
  }
  for (const f of figli) {
    madre.figli.push(f.id);
    padre.figli.push(f.id);
    collega(state, f.id, madre.id, "genitore", "figlio", intero(state, 45, 85));
    collega(state, f.id, padre.id, "genitore", "figlio", separati ? intero(state, -10, 45) : intero(state, 35, 80));
  }
  for (const a of figli) for (const b of figli) if (a.id < b.id) collega(state, a.id, b.id, "fratello", "fratello", intero(state, 15, 75));
  if (separati && probabile(state, 0.45)) io.ricordi.push({ id: "genitore_assente", anno: ANNO_INIZIO });

  // Casa, risparmi, debiti
  const grande = regione.citta.find((c) => c.nome === citta)?.grande ?? false;
  if (probabile(state, classe.casa_proprieta)) {
    const moltiplicatore = { precaria: 0.75, media: 1, agiata: 1.45, ricca: 2.4 }[idClasse];
    const valore = euro(prezzoCasa(state, data, regione.id, grande) * moltiplicatore * tra(state, 0.85, 1.15));
    const conMutuo = idClasse !== "ricca" && probabile(state, idClasse === "agiata" ? 0.3 : 0.6);
    const residuo = conMutuo ? euro(valore * tra(state, 0.2, 0.6)) : 0;
    const anni = conMutuo ? intero(state, 8, 22) : 0;
    const idCasa = nuovoId(state, "c");
    state.case[idCasa] = {
      id: idCasa,
      nome: grande ? `Appartamento a ${citta}` : `Casa a ${citta}`,
      regione: regione.id,
      citta,
      valore,
      mutuo_residuo: residuo,
      tasso: 0.035,
      anni_residui: anni,
      rata: euro(rataMutuo(residuo, 0.035, anni)),
      proprietari: separati ? [madre.id] : [madre.id, padre.id],
    };
    state.nuclei[nucleo].casa = idCasa;
  }
  const risparmi = euro(tra(state, ...classe.risparmi));
  const debiti = euro(tra(state, ...classe.debiti));
  madre.economia.risparmi = euro(risparmi * 0.5);
  padre.economia.risparmi = euro(risparmi * 0.5);
  padre.economia.debiti = euro(debiti * 0.5);
  madre.economia.debiti = euro(debiti * 0.5);

  // Azienda di famiglia
  if (probabile(state, classe.azienda)) {
    const tipo = scegli(state, G.aziende);
    const proprietario = probabile(state, 0.35) ? madre : padre;
    const valore = euro(tra(state, ...tipo.valore) * { precaria: 0.5, media: 0.8, agiata: 1.2, ricca: 2 }[idClasse]);
    const id = nuovoId(state, "a");
    state.aziende[id] = {
      id,
      nome: riempi(tipo.nome, { cognome, nome: proprietario.nome }),
      settore: tipo.settore,
      valore,
      fatturato: euro(valore * tra(state, 0.7, 1.1)),
      margine: tipo.margine,
      salute: intero(state, 45, 85),
      proprietario: proprietario.id,
      dipendenti_famiglia: [proprietario.id],
      fondata: ANNO_INIZIO - intero(state, 5, 40),
      fallita: false,
    };
    proprietario.carriera.lavoro = null; // lavora nella propria azienda: il reddito è l'utile
    proprietario.carriera.imprenditore = true;
  }

  annota(state, io, riempi(scegli(state, G.infanzia), { nome: io.nome, citta, ...genere(io) }));
  annota(state, io, `Primo giorno di scuola alle elementari di ${citta}.`);
  return state;
}
