"use server";
// Azioni del pannello admin. La RLS permette di scrivere solo agli admin: qui si controlla comunque
// per dare un messaggio chiaro, e si trasformano i moduli in righe del database.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { costruisciPrimoTurno, leggiEntryList, type CoppiaLetta, type GiocatoreLetto } from "@/lib/importa";
import { leggiPunteggio } from "@/lib/punteggio";
import { leggiTabelloneItf, pianoAggiornamento, sembraTabelloneItf, type PartitaEsistente } from "@/lib/importaItf";
import { CIRCUITI, GENERI, TURNI, type Turno } from "@/lib/tipi";

export type EsitoAdmin = { ok: boolean; messaggio: string } | null;

const testo = (x: FormDataEntryValue | null) => (typeof x === "string" ? x.trim() : "");
const uuid = (x: FormDataEntryValue | null) => (/^[0-9a-f-]{36}$/i.test(testo(x)) ? testo(x) : null);
const iso = (x: FormDataEntryValue | null) => {
  const v = testo(x);
  return v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;
};
const paese = (x: FormDataEntryValue | null) => (/^[A-Z]{2}$/.test(testo(x).toUpperCase()) ? testo(x).toUpperCase() : null);
const ok = (messaggio: string): EsitoAdmin => ({ ok: true, messaggio });
const ko = (messaggio: string): EsitoAdmin => ({ ok: false, messaggio });

async function admin() {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) throw new Error("Solo per amministratori");
  return supabase;
}

function aggiorna() {
  revalidatePath("/[locale]", "layout");
}

// ---------------------------------------------------------------------------
// Tornei
// ---------------------------------------------------------------------------

export async function salvaTorneo(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  const circuito = testo(form.get("circuito"));
  const stato = testo(form.get("stato")) || "in_programma";
  const riga = {
    nome: testo(form.get("nome")),
    luogo: testo(form.get("luogo")),
    paese: paese(form.get("paese")),
    circuito,
    categoria: testo(form.get("categoria")) || null,
    data_inizio: testo(form.get("data_inizio")),
    data_fine: testo(form.get("data_fine")) || testo(form.get("data_inizio")),
    inizio_at: iso(form.get("inizio_at")),
    stato,
  };
  if (!CIRCUITI.includes(circuito as never)) return ko("Scegli il circuito.");
  if (!riga.data_inizio || !riga.inizio_at) return ko("Date mancanti.");
  if (!["in_programma", "in_corso", "concluso"].includes(stato)) return ko("Stato non valido.");
  const { data, error } = id
    ? await supabase.from("tornei").update(riga).eq("id", id).select("id").single()
    : await supabase.from("tornei").insert(riga).select("id").single();
  if (error) return ko(`Errore: ${error.message}`);
  aggiorna();
  if (!id) redirect(`/it/admin/tornei/${data.id}`);
  return ok(stato === "concluso" ? "Salvato: torneo concluso, punti di vincitore e finalista calcolati." : "Salvato.");
}

export async function eliminaTorneo(form: FormData) {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("tornei").delete().eq("id", id);
  aggiorna();
  redirect("/it/admin/tornei");
}

export async function creaTabellone(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  const torneo_id = uuid(form.get("torneo_id"));
  const genere = testo(form.get("genere"));
  if (!torneo_id || !GENERI.includes(genere as never)) return ko("Dati non validi.");
  const { error } = await supabase.from("tabelloni").insert({ torneo_id, genere });
  if (error) return ko(error.message.includes("duplicate") ? "Questo tabellone esiste già." : `Errore: ${error.message}`);
  aggiorna();
  return ok("Tabellone creato.");
}

export async function eliminaTabellone(form: FormData) {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("tabelloni").delete().eq("id", id);
  aggiorna();
}

// ---------------------------------------------------------------------------
// Giocatori e coppie
// ---------------------------------------------------------------------------

const chiave = (g: GiocatoreLetto) => `${g.nome.toLowerCase()}|${g.cognome.toLowerCase()}|${g.paese ?? ""}`;

/** Trova i giocatori già presenti (stesso nome, cognome e Paese) e crea gli altri. */
async function idGiocatori(supabase: Awaited<ReturnType<typeof admin>>, giocatori: GiocatoreLetto[]) {
  const mappa = new Map<string, string>();
  const cognomi = [...new Set(giocatori.map((g) => g.cognome))];
  for (let i = 0; i < cognomi.length; i += 100) {
    const { data } = await supabase.from("giocatori").select("id, nome, cognome, paese").in("cognome", cognomi.slice(i, i + 100));
    for (const g of data ?? []) mappa.set(chiave(g as GiocatoreLetto), g.id);
  }
  const nuovi = [...new Map(giocatori.filter((g) => !mappa.has(chiave(g))).map((g) => [chiave(g), g])).values()];
  if (nuovi.length) {
    const { data, error } = await supabase.from("giocatori").insert(nuovi).select("id, nome, cognome, paese");
    if (error) throw new Error(`Giocatori: ${error.message}`);
    for (const g of data ?? []) mappa.set(chiave(g as GiocatoreLetto), g.id);
  }
  return (g: GiocatoreLetto) => mappa.get(chiave(g))!;
}

/** Crea le coppie (o riusa quelle già iscritte) e restituisce i loro id nello stesso ordine. */
async function idCoppie(supabase: Awaited<ReturnType<typeof admin>>, tabellone_id: string, coppie: CoppiaLetta[]) {
  const idDi = await idGiocatori(supabase, coppie.flatMap((c) => [c.g1, c.g2]));
  const { data: esistenti } = await supabase.from("coppie").select("id, giocatore1_id, giocatore2_id").eq("tabellone_id", tabellone_id);
  const chiaveCoppia = (a: string, b: string) => [a, b].sort().join("|");
  const giaIscritte = new Map((esistenti ?? []).map((c) => [chiaveCoppia(c.giocatore1_id, c.giocatore2_id), c.id as string]));
  const risultato: string[] = [];
  for (const c of coppie) {
    const g1 = idDi(c.g1);
    const g2 = idDi(c.g2);
    if (g1 === g2) throw new Error(`Stesso giocatore due volte: ${c.g1.nome} ${c.g1.cognome}`);
    const k = chiaveCoppia(g1, g2);
    let id = giaIscritte.get(k);
    if (!id) {
      const { data, error } = await supabase.from("coppie").insert({ tabellone_id, giocatore1_id: g1, giocatore2_id: g2, testa_di_serie: c.testa_di_serie }).select("id").single();
      if (error) throw new Error(`Coppia ${c.g1.cognome}/${c.g2.cognome}: ${error.message}`);
      id = data.id as string;
      giaIscritte.set(k, id);
    }
    risultato.push(id);
  }
  return risultato;
}

/**
 * Importazione del tabellone dalla entry list incollata: giocatori, coppie e partite del primo turno
 * (le coppie con BYE passano direttamente al turno dopo). Nessun dato preso da siti esterni.
 */
export async function importaTabellone(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  const tabellone_id = uuid(form.get("tabellone_id"));
  const inizio = iso(form.get("inizio_at"));
  const setPerVincere = testo(form.get("set_per_vincere")) === "2" ? 2 : 1;
  const soloCoppie = form.get("solo_coppie") === "1";
  if (!tabellone_id) return ko("Tabellone non trovato.");
  // Tabellone ITF incollato: se le partite ci sono già aggiorna i risultati, altrimenti crea tutto
  if (!soloCoppie && sembraTabelloneItf(testo(form.get("testo")))) {
    const { count } = await supabase.from("partite").select("id", { count: "exact", head: true }).eq("tabellone_id", tabellone_id);
    if ((count ?? 0) > 0) return aggiornaTabelloneItf(_, form);
    if (!inizio) return ko("È la prima volta che carichi questo tabellone: indica a che ora si giocano le prossime partite.");
    return importaTabelloneItf(supabase, tabellone_id, testo(form.get("testo")), inizio);
  }
  if (!soloCoppie && !inizio) return ko("Indica l'orario del primo turno.");
  const lettura = leggiEntryList(testo(form.get("testo")));
  if (lettura.errori.length) return ko(`Righe non riconosciute:\n${lettura.errori.map((e) => `riga ${e.riga}: ${e.testo}`).join("\n")}`);
  const reali = lettura.posti.filter((p): p is CoppiaLetta => Boolean(p));
  if (!reali.length) return ko("Nessuna coppia trovata.");

  const { data: tabellone } = await supabase.from("tabelloni").select("id, torneo_id, partite(count)").eq("id", tabellone_id).single();
  if (!tabellone) return ko("Tabellone non trovato.");
  const giaPartite = (tabellone.partite as unknown as { count: number }[])?.[0]?.count ?? 0;

  if (soloCoppie) {
    try {
      await idCoppie(supabase, tabellone_id, reali);
    } catch (e) {
      return ko((e as Error).message);
    }
    aggiorna();
    return ok(`${reali.length} coppie iscritte.`);
  }

  if (giaPartite > 0) return ko("Il tabellone ha già delle partite: eliminale prima di importare di nuovo, oppure usa \"solo coppie\".");
  const primo = costruisciPrimoTurno(lettura.posti);
  if ("errore" in primo) return ko(`Tabellone: ${primo.errore}.`);

  let idPosti: (string | null)[];
  try {
    const ids = await idCoppie(supabase, tabellone_id, reali);
    let k = 0;
    idPosti = lettura.posti.map((p) => (p ? ids[k++] : null));
  } catch (e) {
    return ko((e as Error).message);
  }

  const partite = primo.partite.map((p) => ({
    tabellone_id,
    turno: primo.turno,
    ordine: p.ordine,
    coppia_a_id: idPosti[p.a],
    coppia_b_id: idPosti[p.b],
    inizio_at: inizio!,
    set_per_vincere: setPerVincere,
  }));
  if (partite.length) {
    const { error } = await supabase.from("partite").insert(partite);
    if (error) return ko(`Partite: ${error.message}`);
  }
  // BYE: la coppia entra direttamente nella partita del turno dopo
  const dopo = new Map<string, { turno: Turno; ordine: number; coppia_a_id: string | null; coppia_b_id: string | null }>();
  for (const av of primo.avanzati) {
    const k = `${av.turno}|${av.ordine}`;
    const riga = dopo.get(k) ?? { turno: av.turno, ordine: av.ordine, coppia_a_id: null, coppia_b_id: null };
    if (av.lato === "a") riga.coppia_a_id = idPosti[av.posto];
    else riga.coppia_b_id = idPosti[av.posto];
    dopo.set(k, riga);
  }
  if (dopo.size) {
    const giorno = new Date(new Date(inizio!).getTime() + 86_400_000).toISOString();
    const { error } = await supabase.from("partite").insert([...dopo.values()].map((r) => ({ ...r, tabellone_id, inizio_at: giorno, set_per_vincere: setPerVincere })));
    if (error) return ko(`Partite dopo i BYE: ${error.message}`);
  }
  // i pronostici su vincitore e finalista si chiudono al primo incontro del torneo
  const { data: torneo } = await supabase.from("tornei").select("inizio_at").eq("id", tabellone.torneo_id).single();
  if (torneo && new Date(inizio!) < new Date(torneo.inizio_at)) await supabase.from("tornei").update({ inizio_at: inizio }).eq("id", tabellone.torneo_id);

  aggiorna();
  return ok(`Importate ${reali.length} coppie e ${partite.length} partite (${primo.turno}, tabellone da ${primo.dimensione})${dopo.size ? `, ${primo.avanzati.length} BYE` : ""}.`);
}

const TURNI_ORDINE: Turno[] = ["R64", "R32", "R16", "QF", "SF", "F"];

/**
 * Tabellone ITF incollato da "Draws & Results": coppie, tutte le partite del primo turno e i risultati
 * già giocati di ogni turno. I vincitori avanzano da soli (trigger del database). Le partite ancora da
 * giocare prendono l'orario indicato (un giorno in più per ogni turno successivo).
 */
async function importaTabelloneItf(supabase: Awaited<ReturnType<typeof admin>>, tabellone_id: string, testoItf: string, inizio: string): Promise<EsitoAdmin> {
  const letto = leggiTabelloneItf(testoItf, 2);
  if ("errore" in letto) return ko(`Tabellone ITF: ${letto.errore}.`);
  const { data: tabellone } = await supabase.from("tabelloni").select("id, torneo_id, partite(count)").eq("id", tabellone_id).single();
  if (!tabellone) return ko("Tabellone non trovato.");
  if (((tabellone.partite as unknown as { count: number }[])?.[0]?.count ?? 0) > 0) return ko("Questo tabellone ha già le partite: incolla di nuovo il tabellone ITF per aggiornare i risultati.");
  const primo = costruisciPrimoTurno(letto.posti);
  if ("errore" in primo) return ko(`Tabellone: ${primo.errore}.`);

  let idPosti: (string | null)[];
  try {
    const reali = letto.posti.filter((p): p is CoppiaLetta => Boolean(p));
    const ids = await idCoppie(supabase, tabellone_id, reali);
    let k = 0;
    idPosti = letto.posti.map((p) => (p ? ids[k++] : null));
  } catch (e) {
    return ko((e as Error).message);
  }

  const giocata = (turno: Turno, ordine: number) => letto.giocate.find((g) => g.turno === turno && g.ordine === ordine);
  const passato = new Date(Date.now() - 86_400_000).toISOString();
  const risultatoDi = (g: NonNullable<ReturnType<typeof giocata>>) => ({
    stato: "conclusa",
    game_a: g.game_a.length ? g.game_a : null,
    game_b: g.game_b.length ? g.game_b : null,
    ritiro: g.ritiro,
    vincitore_id: g.ritiro ? idPosti[g.vince === "a" ? g.a : g.b] : null,
    inizio_at: passato,
  });

  // 1. Primo turno (i risultati già giocati fanno avanzare i vincitori al turno dopo)
  const righe = primo.partite.map((p) => {
    const g = giocata(primo.turno, p.ordine);
    const base = { tabellone_id, turno: primo.turno, ordine: p.ordine, coppia_a_id: idPosti[p.a], coppia_b_id: idPosti[p.b], inizio_at: inizio, set_per_vincere: 2 };
    return g ? { ...base, ...risultatoDi(g) } : base;
  });
  for (const r of righe) {
    const { error } = await supabase.from("partite").insert(r);
    if (error) return ko(`Partita ${r.turno} n.${r.ordine}: ${error.message}`);
  }
  // BYE: la coppia entra direttamente nella partita del turno dopo
  for (const av of primo.avanzati) {
    const campo = av.lato === "a" ? "coppia_a_id" : "coppia_b_id";
    const { data: esiste } = await supabase.from("partite").select("id").eq("tabellone_id", tabellone_id).eq("turno", av.turno).eq("ordine", av.ordine).maybeSingle();
    const { error } = esiste
      ? await supabase.from("partite").update({ [campo]: idPosti[av.posto] }).eq("id", esiste.id)
      : await supabase.from("partite").insert({ tabellone_id, turno: av.turno, ordine: av.ordine, [campo]: idPosti[av.posto], inizio_at: inizio, set_per_vincere: 2 });
    if (error) return ko(`BYE: ${error.message}`);
  }

  // 2. Risultati dei turni successivi, in ordine
  let giocateDopo = 0;
  for (const g of letto.giocate.filter((x) => x.turno !== primo.turno).sort((x, y) => TURNI_ORDINE.indexOf(x.turno) - TURNI_ORDINE.indexOf(y.turno))) {
    const { data: p } = await supabase.from("partite").select("id, coppia_a_id, coppia_b_id").eq("tabellone_id", tabellone_id).eq("turno", g.turno).eq("ordine", g.ordine).maybeSingle();
    if (!p || p.coppia_a_id !== idPosti[g.a] || p.coppia_b_id !== idPosti[g.b]) {
      letto.avvisi.push(`${g.turno} n.${g.ordine}: le coppie non corrispondono al tabellone, risultato non inserito.`);
      continue;
    }
    const { error } = await supabase.from("partite").update(risultatoDi(g)).eq("id", p.id);
    if (error) letto.avvisi.push(`${g.turno} n.${g.ordine}: ${error.message}`);
    else giocateDopo++;
  }

  // 3. Orari delle partite da giocare: il primo turno ancora aperto all'orario indicato, poi +1 giorno per turno
  const { data: aperte } = await supabase.from("partite").select("id, turno").eq("tabellone_id", tabellone_id).eq("stato", "in_programma");
  const primoAperto = Math.min(...(aperte ?? []).map((a) => TURNI_ORDINE.indexOf(a.turno as Turno)));
  for (const a of aperte ?? []) {
    const giorni = TURNI_ORDINE.indexOf(a.turno as Turno) - primoAperto;
    await supabase.from("partite").update({ inizio_at: new Date(new Date(inizio).getTime() + giorni * 86_400_000).toISOString() }).eq("id", a.id);
  }

  aggiorna();
  const giocatePrimo = righe.filter((r) => "stato" in r).length;
  return ok(
    `Tabellone ITF da ${letto.dimensione}: ${idPosti.filter(Boolean).length} coppie, ${righe.length} partite del primo turno (${giocatePrimo} già giocate), ${giocateDopo} risultati dei turni successivi. ` +
      `Partite ancora da giocare: ${aperte?.length ?? 0}, dalle ${new Date(inizio).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}.` +
      (letto.avvisi.length ? `\n\nDa controllare:\n${letto.avvisi.join("\n")}` : ""),
  );
}

export async function eliminaCoppia(form: FormData) {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("coppie").delete().eq("id", id);
  aggiorna();
}

export async function salvaGiocatore(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  const sesso = testo(form.get("sesso"));
  const riga = { nome: testo(form.get("nome")), cognome: testo(form.get("cognome")), paese: paese(form.get("paese")), sesso: sesso === "M" || sesso === "F" ? sesso : null };
  if (!riga.nome || !riga.cognome) return ko("Nome e cognome obbligatori.");
  const { error } = id ? await supabase.from("giocatori").update(riga).eq("id", id) : await supabase.from("giocatori").insert(riga);
  if (error) return ko(`Errore: ${error.message}`);
  aggiorna();
  return ok("Salvato.");
}

export async function eliminaGiocatore(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  if (!id) return ko("Id mancante.");
  const { error } = await supabase.from("giocatori").delete().eq("id", id);
  if (error) return ko("Non si può eliminare: il giocatore è iscritto a qualche tabellone.");
  aggiorna();
  return ok("Eliminato.");
}

// ---------------------------------------------------------------------------
// Partite e risultati
// ---------------------------------------------------------------------------

export async function salvaPartita(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  const turno = testo(form.get("turno"));
  if (!TURNI.includes(turno as Turno)) return ko("Turno non valido.");
  const riga = {
    tabellone_id: uuid(form.get("tabellone_id")),
    turno,
    ordine: Number(testo(form.get("ordine"))) || 0,
    coppia_a_id: uuid(form.get("coppia_a_id")),
    coppia_b_id: uuid(form.get("coppia_b_id")),
    inizio_at: iso(form.get("inizio_at")),
    set_per_vincere: testo(form.get("set_per_vincere")) === "2" ? 2 : 1,
  };
  if (!riga.tabellone_id || !riga.inizio_at) return ko("Tabellone e orario obbligatori.");
  const { error } = id ? await supabase.from("partite").update(riga).eq("id", id) : await supabase.from("partite").insert(riga);
  if (error) return ko(error.message.includes("partite_posizione") ? "C'è già una partita in quella posizione del turno." : `Errore: ${error.message}`);
  aggiorna();
  return ok("Salvata.");
}

/** Risultato: "6-4 3-6 10-7" dal punto di vista della coppia A. Il vincitore lo ricava il database. */
export async function salvaRisultato(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  const stato = testo(form.get("stato"));
  if (!id || !["in_programma", "in_corso", "conclusa", "annullata"].includes(stato)) return ko("Dati non validi.");
  const { data: partita } = await supabase.from("partite").select("set_per_vincere").eq("id", id).single();
  if (!partita) return ko("Partita non trovata.");
  const ritiro = form.get("ritiro") === "1";
  let campi: Record<string, unknown> = { stato, ritiro: false, game_a: null, game_b: null, vincitore_id: null };
  if (stato === "conclusa") {
    if (ritiro) {
      const vincitore_id = uuid(form.get("vincitore_id"));
      if (!vincitore_id) return ko("Con il ritiro scegli chi passa il turno.");
      const p = testo(form.get("punteggio")) ? leggiPunteggioParziale(testo(form.get("punteggio"))) : null;
      campi = { stato, ritiro: true, vincitore_id, game_a: p?.a ?? null, game_b: p?.b ?? null };
    } else {
      const p = leggiPunteggio(testo(form.get("punteggio")), partita.set_per_vincere as 1 | 2);
      if ("errore" in p) return ko(`Punteggio: ${p.errore}.`);
      campi = { stato, game_a: p.a, game_b: p.b };
    }
  }
  const { error } = await supabase.from("partite").update(campi).eq("id", id);
  if (error) return ko(`Errore: ${error.message}`);
  aggiorna();
  return ok(stato === "conclusa" ? "Risultato salvato: punti calcolati e vincitore avanzato nel tabellone." : "Salvato.");
}

function leggiPunteggioParziale(t: string) {
  const a: number[] = [];
  const b: number[] = [];
  for (const s of t.split(/[\s,;]+/).filter(Boolean)) {
    const m = s.match(/^(\d{1,2})[-–:/](\d{1,2})$/);
    if (!m) return null;
    a.push(Number(m[1]));
    b.push(Number(m[2]));
  }
  return a.length ? { a, b } : null;
}

export async function eliminaPartita(form: FormData) {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("partite").delete().eq("id", id);
  aggiorna();
}

// ---------------------------------------------------------------------------
// Notizie: riassunti originali (max 320 caratteri, circa 3 righe) con fonte e link
// ---------------------------------------------------------------------------

const LINGUE = ["it", "pt-BR", "es", "en"] as const;

export async function salvaNotizia(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  const url = testo(form.get("url_originale"));
  const fonte = testo(form.get("fonte_nome"));
  const stato = testo(form.get("stato")) === "pubblicata" ? "pubblicata" : "bozza";
  if (!/^https?:\/\/\S+\.\S+/.test(url)) return ko("Link all'articolo originale non valido.");
  if (fonte.length < 2) return ko("Indica la fonte.");
  const traduzioni = LINGUE.map((lingua) => ({ lingua, titolo: testo(form.get(`titolo_${lingua}`)), riassunto: testo(form.get(`riassunto_${lingua}`)) })).filter((t) => t.titolo || t.riassunto);
  if (!traduzioni.length) return ko("Scrivi titolo e riassunto in almeno una lingua.");
  for (const t of traduzioni) {
    if (t.titolo.length < 5 || t.titolo.length > 120) return ko(`Titolo (${t.lingua}): da 5 a 120 caratteri.`);
    if (t.riassunto.length < 20 || t.riassunto.length > 320) return ko(`Riassunto (${t.lingua}): da 20 a 320 caratteri (circa 3 righe).`);
  }
  const { data, error } = id
    ? await supabase.from("notizie").update({ fonte_nome: fonte, url_originale: url, stato }).eq("id", id).select("id").single()
    : await supabase.from("notizie").insert({ fonte_nome: fonte, url_originale: url, stato }).select("id").single();
  if (error) return ko(`Errore: ${error.message}`);
  await supabase.from("notizie_traduzioni").delete().eq("notizia_id", data.id).not("lingua", "in", `(${traduzioni.map((t) => `"${t.lingua}"`).join(",")})`);
  const { error: e2 } = await supabase.from("notizie_traduzioni").upsert(traduzioni.map((t) => ({ ...t, notizia_id: data.id })));
  if (e2) return ko(`Traduzioni: ${e2.message}`);
  aggiorna();
  if (!id) redirect(`/it/admin/notizie?modifica=${data.id}&salvata=1`);
  return ok(stato === "pubblicata" ? "Salvata e pubblicata." : "Bozza salvata.");
}

export async function eliminaNotizia(form: FormData) {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("notizie").delete().eq("id", id);
  aggiorna();
  redirect("/it/admin/notizie");
}

// ---------------------------------------------------------------------------
// Premi della classifica e sponsor
// ---------------------------------------------------------------------------

/** Premi 1°, 2° e 3°: un campo vuoto toglie il premio. */
export async function salvaPremi(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  for (const posizione of [1, 2, 3]) {
    const descrizione = testo(form.get(`premio_${posizione}`)).slice(0, 120);
    const { error } = descrizione
      ? await supabase.from("premi").upsert({ posizione, descrizione, aggiornato_at: new Date().toISOString() })
      : await supabase.from("premi").delete().eq("posizione", posizione);
    if (error) return ko(`Premio ${posizione}: ${error.message}`);
  }
  aggiorna();
  return ok("Premi salvati.");
}

const TIPI_LOGO: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

/** Nuovo sponsor: nome, link facoltativo e logo (file caricato oppure indirizzo di un'immagine). */
export async function salvaSponsor(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  const nome = testo(form.get("nome"));
  const link = testo(form.get("link"));
  const ordine = Number(testo(form.get("ordine"))) || 0;
  if (!nome) return ko("Scrivi il nome dello sponsor.");
  if (link && !/^https?:\/\//.test(link)) return ko("Il link deve iniziare con https://");
  let logo_url = testo(form.get("logo_url"));
  const file = form.get("logo");
  if (file instanceof File && file.size > 0) {
    const ext = TIPI_LOGO[file.type];
    if (!ext) return ko("Il logo deve essere PNG, JPG, WebP o SVG.");
    if (file.size > 2 * 1024 * 1024) return ko("Il logo è troppo grande (massimo 2 MB).");
    const percorso = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("sponsor").upload(percorso, file, { contentType: file.type, upsert: false });
    if (error) return ko(`Caricamento del logo: ${error.message}`);
    logo_url = supabase.storage.from("sponsor").getPublicUrl(percorso).data.publicUrl;
  }
  if (!/^https?:\/\//.test(logo_url)) return ko("Carica il logo o incolla l'indirizzo dell'immagine.");
  const { error } = await supabase.from("sponsor").insert({ nome, link: link || null, logo_url, ordine });
  if (error) return ko(`Errore: ${error.message}`);
  aggiorna();
  return ok(`Sponsor "${nome}" aggiunto.`);
}

export async function attivaSponsor(form: FormData) {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  if (id) await supabase.from("sponsor").update({ attivo: form.get("attivo") === "1" }).eq("id", id);
  aggiorna();
}

export async function eliminaSponsor(form: FormData) {
  const supabase = await admin();
  const id = uuid(form.get("id"));
  if (!id) return;
  const { data } = await supabase.from("sponsor").select("logo_url").eq("id", id).single();
  await supabase.from("sponsor").delete().eq("id", id);
  // se il logo era nella cartella degli sponsor, si cancella anche il file
  const percorso = data?.logo_url?.split("/storage/v1/object/public/sponsor/")[1];
  if (percorso) await supabase.storage.from("sponsor").remove([percorso]);
  aggiorna();
}

/**
 * Aggiorna un tabellone già importato incollando di nuovo la pagina ITF "Draws & Results": scrive i
 * risultati nuovi, corregge quelli cambiati, fa avanzare i vincitori (trigger) e ripete finché i turni
 * successivi, creati dall'avanzamento, non hanno anche loro i risultati presenti nel testo.
 */
export async function aggiornaTabelloneItf(_: EsitoAdmin, form: FormData): Promise<EsitoAdmin> {
  const supabase = await admin();
  const tabellone_id = uuid(form.get("tabellone_id"));
  const testoItf = testo(form.get("testo"));
  const orario = iso(form.get("inizio_at"));
  if (!tabellone_id) return ko("Tabellone non trovato.");
  if (!sembraTabelloneItf(testoItf)) return ko("Non sembra il tabellone ITF: sul sito apri «Draws & Results», Seleziona tutto → Copia e incolla qui.");
  const letto = leggiTabelloneItf(testoItf, 2);
  if ("errore" in letto) return ko(`Tabellone ITF: ${letto.errore}.`);

  let idPosti: (string | null)[];
  try {
    const reali = letto.posti.filter((p): p is CoppiaLetta => Boolean(p));
    const ids = await idCoppie(supabase, tabellone_id, reali);
    let k = 0;
    idPosti = letto.posti.map((p) => (p ? ids[k++] : null));
  } catch (e) {
    return ko((e as Error).message);
  }

  let nuovi = 0;
  let corretti = 0;
  let uguali = 0;
  const avvisi = [...letto.avvisi];
  for (let giro = 0; giro < 7; giro++) {
    const { data: esistenti } = await supabase
      .from("partite")
      .select("id, turno, ordine, stato, coppia_a_id, coppia_b_id, game_a, game_b, ritiro, vincitore_id")
      .eq("tabellone_id", tabellone_id);
    const piano = pianoAggiornamento(letto, idPosti, (esistenti as PartitaEsistente[]) ?? []);
    if (giro === 0) {
      uguali = piano.uguali;
      avvisi.push(...piano.avvisi);
    }
    if (piano.aggiornamenti.length === 0) break;
    for (const u of piano.aggiornamenti) {
      const { error } = await supabase.from("partite").update(u.campi).eq("id", u.id);
      if (error) avvisi.push(`${u.turno} n.${u.ordine}: ${error.message}`);
      else if (u.tipo === "nuovo") nuovi++;
      else corretti++;
    }
  }

  // Partite pronte da giocare con un orario già passato (create dall'avanzamento): nuovo orario se indicato
  const { data: aperte } = await supabase
    .from("partite")
    .select("id, inizio_at")
    .eq("tabellone_id", tabellone_id)
    .eq("stato", "in_programma")
    .not("coppia_a_id", "is", null)
    .not("coppia_b_id", "is", null);
  const scadute = (aperte ?? []).filter((p) => new Date(p.inizio_at).getTime() <= Date.now());
  let nota = "";
  if (scadute.length && orario) {
    await supabase.from("partite").update({ inizio_at: orario }).in("id", scadute.map((p) => p.id));
    nota = `\n${scadute.length} partite da giocare ora si chiudono alle ${new Date(orario).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`;
  } else if (scadute.length) {
    nota = `\nAttenzione: ${scadute.length} partite da giocare hanno un orario già passato, quindi i pronostici sono chiusi. Indica l'orario delle prossime partite e incolla di nuovo (oppure correggilo nella partita).`;
  }

  aggiorna();
  return ok(
    `Fatto: ${nuovi} risultati nuovi, ${corretti} corretti, ${uguali} già presenti. Punti e avanzamenti aggiornati.` +
      nota +
      (avvisi.length ? `\n\nDa controllare:\n${avvisi.join("\n")}` : ""),
  );
}
