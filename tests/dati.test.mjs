// Convalida dei file JSON: ogni evento deve essere coerente con mestieri, scuole, tratti e ricordi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dati } from "./aiuto.mjs";

const D = await dati();
const SEGNAPOSTO = new Set(["nome", "cognome", "citta", "regione", "eta", "anno", "madre", "padre", "fratello", "fratello_o_sorella", "genitore", "lavoro", "scuola", "facolta", "titolo", "o", "lui", "figlio", "un", "ragazzo", "fratello_g", "nonno_g", "genitore_g", "sposo_g", "partner", "figlio_nome", "figlio_maggiore", "ultimo_figlio", "o_figlio", "o_partner"]);
const EFFETTI = new Set(["salute", "morale", "felicita", "stanchezza", "reputazione", "risparmi", "debiti", "risparmi_famiglia", "voti", "reputazione_famiglia", "indirizzo", "superiori", "universita", "fuori_sede", "lascia_studi", "licenziato", "lavoro", "part_time", "bonus", "trasloco", "trasferimento", "compra_casa", "tratto", "tratto_rimuovi", "ricordo", "flag", "flag_rimuovi", "relazione",
  "partner", "convivenza", "matrimonio", "separazione", "figlio", "accogli_genitore", "al_figlio", "riduci_lavoro", "torna_tempo_pieno",
  "entra_azienda", "rileva_azienda", "cedi_azienda", "vendi_azienda", "fonda_azienda", "azienda", "casa_valore"]);
const CONDIZIONI = new Set(["eta", "sesso", "titolo", "titolo_min", "livello", "iscritto", "indirizzo", "voti_min", "voti_max", "genitori_insieme", "facolta", "lavoro", "settore", "pensionato",
  "soldi_famiglia_min", "risparmi_min", "risparmi_max", "debiti_min", "tratti_richiesti", "tratti_esclusi", "ricordi_richiesti", "ricordi_esclusi", "flag", "flag_esclusi", "vive_con_genitori",
  "agiatezza", "area", "azienda_famiglia", "fratelli", "genitori_vivi", "casa_raggiungibile", "stat_min", "stat_max", "relazione_min", "relazione_max", "solo_conseguenza",
  "stato_civile", "coppia", "anni_coppia_min", "fertile", "figli_min", "figli_max", "figlio_eta", "figli_adulti", "nipoti", "genitore_eta_min",
  "titolare", "in_azienda", "genitore_titolare", "azienda_salute_min", "azienda_salute_max"]);
const RELAZIONI = new Set(["madre", "padre", "genitore", "fratello", "partner", "figlio", "figlio_maggiore"]);

test("almeno 80 eventi con id unici", () => {
  assert.ok(D.eventi.length >= 80, `solo ${D.eventi.length} eventi`);
  assert.equal(new Set(D.eventi.map((e) => e.id)).size, D.eventi.length);
});

test("ogni evento ha testi, scelte e riferimenti validi", () => {
  for (const ev of D.eventi) {
    const dove = `evento ${ev.id}`;
    assert.ok(ev.testi?.length >= 2, `${dove}: servono almeno 2 varianti di testo`);
    assert.ok(ev.scelte?.length >= 1, `${dove}: nessuna scelta`);
    assert.equal(new Set(ev.scelte.map((s) => s.id)).size, ev.scelte.length, `${dove}: id di scelta duplicati`);
    const testi = [ev.titolo ?? "", ...ev.testi, ...ev.scelte.flatMap((s) => [s.testo, s.esito ?? ""])];
    for (const t of testi) for (const [, k] of t.matchAll(/\{(\w+)\}/g)) assert.ok(SEGNAPOSTO.has(k), `${dove}: segnaposto sconosciuto {${k}}`);
    for (const k of Object.keys(ev.condizioni ?? {})) assert.ok(CONDIZIONI.has(k), `${dove}: condizione sconosciuta ${k}`);
    for (const s of ev.scelte) {
      for (const r of [s.effetti?.relazione ?? []].flat()) assert.ok(RELAZIONI.has(r.con), `${dove}/${s.id}: relazione con ${r.con}`);
      for (const k of Object.keys(s.effetti ?? {})) assert.ok(EFFETTI.has(k), `${dove}/${s.id}: effetto sconosciuto ${k}`);
      const e = s.effetti ?? {};
      if (e.indirizzo) assert.ok(D.superiore[e.indirizzo], `${dove}: indirizzo ${e.indirizzo}`);
      if (e.superiori) assert.ok(D.superiore[e.superiori], `${dove}: superiori ${e.superiori}`);
      if (e.universita) assert.ok(D.facolta[e.universita], `${dove}: facoltà ${e.universita}`);
      if (e.lavoro && e.lavoro !== "casuale") assert.ok(D.mestiere[e.lavoro], `${dove}: mestiere ${e.lavoro}`);
      if (e.tratto) assert.ok(D.tratto[e.tratto], `${dove}: tratto ${e.tratto}`);
      if (e.ricordo) assert.ok(D.ricordo[e.ricordo], `${dove}: ricordo ${e.ricordo}`);
      if (e.trasferimento) assert.ok(D.regione[e.trasferimento], `${dove}: regione ${e.trasferimento}`);
      for (const t of [...(s.tratti_favoriti ?? []), ...(s.tratti_sfavoriti ?? [])]) assert.ok(D.tratto[t], `${dove}: tratto ${t}`);
      for (const c of s.conseguenze ?? []) assert.ok(D.evento[c.evento], `${dove}: conseguenza verso evento inesistente ${c.evento}`);
    }
  }
});

test("gli eventi solo_conseguenza sono raggiungibili", () => {
  const raggiunti = new Set(D.eventi.flatMap((e) => e.scelte.flatMap((s) => (s.conseguenze ?? []).map((c) => c.evento))));
  for (const ev of D.eventi.filter((e) => e.condizioni?.solo_conseguenza)) assert.ok(raggiunti.has(ev.id), `${ev.id} non è mai programmato`);
});

test("mestieri, scuole e regioni sono coerenti", () => {
  const titoli = ["nessuno", "licenza_media", "diploma", "laurea_triennale", "laurea_magistrale"];
  for (const m of D.mestieri) {
    assert.ok(titoli.includes(m.titolo_min), `${m.id}: titolo_min ${m.titolo_min}`);
    assert.ok(m.stipendio_massimo >= m.stipendio_iniziale, `${m.id}: stipendi invertiti`);
    for (const t of m.tratti_affini) assert.ok(D.tratto[t], `${m.id}: tratto ${t}`);
    for (const a of m.affinita) assert.ok(D.superiore[a] || D.facolta[a], `${m.id}: affinità ${a}`);
  }
  assert.equal(D.regioni.length, 20);
  for (const r of D.regioni) assert.ok(r.citta.length >= 2 && r.affitto > 0 && r.prezzo_mq > 0, r.id);
  for (const classe of Object.values(D.generatore.classi)) for (const id of classe.mestieri) assert.ok(D.mestiere[id], id);
});

test("i tipi di scelta per l'AI hanno effetti, condizioni e tratti validi", () => {
  assert.ok(D.profili.length >= 20);
  assert.equal(new Set(D.profili.map((p) => p.id)).size, D.profili.length);
  for (const p of D.profili) {
    assert.ok(p.descrizione?.length > 5, p.id);
    for (const k of Object.keys(p.effetti)) assert.ok(EFFETTI.has(k), `${p.id}: effetto ${k}`);
    for (const k of Object.keys(p.esito_casuale?.effetti ?? {})) assert.ok(EFFETTI.has(k), `${p.id}: effetto casuale ${k}`);
    for (const k of Object.keys(p.condizioni ?? {})) assert.ok(CONDIZIONI.has(k), `${p.id}: condizione ${k}`);
    for (const r of [p.effetti.relazione ?? []].flat()) assert.ok(RELAZIONI.has(r.con), `${p.id}: relazione ${r.con}`);
    for (const t of [...(p.tratti_favoriti ?? []), ...(p.tratti_sfavoriti ?? []), ...(p.condizioni?.tratti_esclusi ?? [])]) assert.ok(D.tratto[t], `${p.id}: tratto ${t}`);
    if (p.effetti.tratto) assert.ok(D.tratto[p.effetti.tratto]);
  }
});
