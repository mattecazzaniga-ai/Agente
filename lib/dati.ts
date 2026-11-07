import "server-only";
// Letture dal database per le pagine (Server Components). Le scritture sono nelle Server Actions.
// La sicurezza la fa la RLS: qui si chiede quello che serve, il database restituisce solo il permesso.

import { cache } from "react";
import { supabaseServer } from "./supabase/server";
import { REGOLE_PREDEFINITE, type Regole } from "./punti";
import { ultimiMesi } from "./formato";
import type { Coppia, Notizia, Partita, Profilo, PronosticoPartita, PronosticoTorneo, StatoTorneo, Tabellone, Torneo } from "./tipi";

export const SELECT_COPPIA =
  "id, tabellone_id, testa_di_serie, g1:giocatori!coppie_giocatore1_id_fkey(id, nome, cognome, paese), g2:giocatori!coppie_giocatore2_id_fkey(id, nome, cognome, paese)";

/** Utente collegato e suo profilo (null se anonimo). */
export async function sessione() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profilo: null as Profilo | null };
  const { data: profilo } = await supabase.from("profili").select("id, nickname, paese, lingua, profilo_completo, is_admin").eq("id", user.id).single();
  return { supabase, user, profilo: (profilo as Profilo | null) ?? null };
}

export async function caricaTornei(stato?: StatoTorneo, limite = 100): Promise<Torneo[]> {
  const supabase = await supabaseServer();
  let q = supabase.from("tornei").select("*").order("data_inizio", { ascending: stato !== "concluso" }).limit(limite);
  if (stato) q = q.eq("stato", stato);
  const { data } = await q;
  return (data as Torneo[]) ?? [];
}

/** Torneo con tabelloni, coppie (e giocatori) e partite. */
export async function caricaTorneo(id: string): Promise<{ torneo: Torneo; tabelloni: Tabellone[] } | null> {
  const supabase = await supabaseServer();
  const { data: torneo } = await supabase.from("tornei").select("*").eq("id", id).maybeSingle();
  if (!torneo) return null;
  const { data: tabelloni } = await supabase
    .from("tabelloni")
    .select(`id, torneo_id, genere, coppie(${SELECT_COPPIA}), partite(*)`)
    .eq("torneo_id", id);
  const ordineGenere = { maschile: 0, femminile: 1, misto: 2 };
  const lista = ((tabelloni as unknown as Tabellone[]) ?? []).sort((a, b) => ordineGenere[a.genere] - ordineGenere[b.genere]);
  for (const t of lista) {
    t.coppie.sort((a, b) => (a.testa_di_serie ?? 99) - (b.testa_di_serie ?? 99) || a.g1.cognome.localeCompare(b.g1.cognome));
    t.partite.sort((a, b) => ordineTurno(a.turno) - ordineTurno(b.turno) || a.ordine - b.ordine);
  }
  return { torneo: torneo as Torneo, tabelloni: lista };
}

const TURNI_ORDINE = ["R64", "R32", "R16", "QF", "SF", "F"];
export const ordineTurno = (t: string) => TURNI_ORDINE.indexOf(t);

/** I pronostici dell'utente collegato su questi tabelloni e partite. */
const CAMPI_PRONOSTICO = "id, partita_id, vincitore_id, set_vincitore, set_perdente, totale_game, game_a, game_b, game_previsti_a, game_previsti_b, punti_vincitore, punti_set, punti_game, punti_long, errore_game, punti";

export async function mieiPronostici(tabelloni: string[], partite: string[]) {
  const supabase = await supabaseServer();
  // sempre filtrati per utente: gli admin, per le regole del database, potrebbero leggere anche quelli degli altri
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const io = user?.id ?? "00000000-0000-0000-0000-000000000000";
  const [{ data: pt }, { data: pp }] = await Promise.all([
    tabelloni.length ? supabase.from("pronostici_torneo").select("id, tabellone_id, vincitore_id, finalista_id, punti").eq("utente_id", io).in("tabellone_id", tabelloni) : Promise.resolve({ data: [] }),
    partite.length ? supabase.from("pronostici_partita").select(CAMPI_PRONOSTICO).eq("utente_id", io).in("partita_id", partite) : Promise.resolve({ data: [] }),
  ]);
  return {
    torneo: new Map(((pt as PronosticoTorneo[]) ?? []).map((p) => [p.tabellone_id, p])),
    partita: new Map(((pp as PronosticoPartita[]) ?? []).map((p) => [p.partita_id, p])),
  };
}

export interface PartitaConCoppie extends Partita {
  coppia_a: Coppia | null;
  coppia_b: Coppia | null;
  tabellone: { genere: string; torneo: { id: string; nome: string } };
}

/** Partite aperte ai pronostici nei prossimi giorni (per la home). */
const SELECT_PARTITA = `*, coppia_a:coppie!partite_coppia_a_id_fkey(${SELECT_COPPIA}), coppia_b:coppie!partite_coppia_b_id_fkey(${SELECT_COPPIA}), tabellone:tabelloni(genere, torneo:tornei(id, nome))`;

/** Gli ultimi pronostici dell'utente, con la partita: per lo storico nel profilo. */
export async function storicoPronostici(utenteId: string, limite = 40): Promise<{ partita: PartitaConCoppie; mio: PronosticoPartita }[]> {
  const supabase = await supabaseServer();
  const { data: pp } = await supabase.from("pronostici_partita").select(CAMPI_PRONOSTICO).eq("utente_id", utenteId).order("creato_at", { ascending: false }).limit(limite);
  const miei = (pp as PronosticoPartita[]) ?? [];
  if (!miei.length) return [];
  const { data: pa } = await supabase.from("partite").select(SELECT_PARTITA).in("id", miei.map((m) => m.partita_id));
  const partite = new Map(((pa as unknown as PartitaConCoppie[]) ?? []).map((p) => [p.id, p]));
  return miei
    .filter((m) => partite.has(m.partita_id))
    .map((m) => ({ partita: partite.get(m.partita_id)!, mio: m }))
    .sort((x, y) => y.partita.inizio_at.localeCompare(x.partita.inizio_at));
}

/** Partite su cui si può ancora pronosticare, dalla più vicina. */
export async function partiteAperte(limite = 6): Promise<PartitaConCoppie[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("partite")
    .select(SELECT_PARTITA)
    .eq("stato", "in_programma")
    .gt("inizio_at", new Date().toISOString())
    .not("coppia_a_id", "is", null)
    .not("coppia_b_id", "is", null)
    .order("inizio_at")
    .limit(limite);
  return (data as unknown as PartitaConCoppie[]) ?? [];
}

/** Per ogni torneo: quante partite si possono ancora pronosticare, quando chiude la prossima e quali tabelloni ha. */
export interface SituazioneTorneo {
  aperte: number;
  chiude: string | null;
  generi: string[];
}
export async function situazioneTornei(ids: string[]): Promise<Record<string, SituazioneTorneo>> {
  const esito: Record<string, SituazioneTorneo> = Object.fromEntries(ids.map((id) => [id, { aperte: 0, chiude: null, generi: [] }]));
  if (!ids.length) return esito;
  const supabase = await supabaseServer();
  const [{ data: tabelloni }, { data: aperte }] = await Promise.all([
    supabase.from("tabelloni").select("torneo_id, genere").in("torneo_id", ids),
    supabase
      .from("partite")
      .select("inizio_at, tabellone:tabelloni!inner(torneo_id)")
      .in("tabellone.torneo_id", ids)
      .eq("stato", "in_programma")
      .gt("inizio_at", new Date().toISOString())
      .not("coppia_a_id", "is", null)
      .not("coppia_b_id", "is", null)
      .order("inizio_at"),
  ]);
  for (const tb of (tabelloni as { torneo_id: string; genere: string }[]) ?? []) esito[tb.torneo_id]?.generi.push(tb.genere);
  for (const p of (aperte as unknown as { inizio_at: string; tabellone: { torneo_id: string } }[]) ?? []) {
    const s = esito[p.tabellone.torneo_id];
    if (!s) continue;
    s.aperte++;
    s.chiude ??= p.inizio_at;
  }
  return esito;
}

/** Partite in corso: segnate "in corso" oppure già iniziate e non ancora concluse. */
export async function partiteInCorso(limite = 6): Promise<PartitaConCoppie[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("partite")
    .select(SELECT_PARTITA)
    .in("stato", ["in_corso", "in_programma"])
    .lte("inizio_at", new Date().toISOString())
    .gte("inizio_at", new Date(Date.now() - 6 * 3600_000).toISOString())
    .not("coppia_a_id", "is", null)
    .not("coppia_b_id", "is", null)
    .order("inizio_at", { ascending: false })
    .limit(limite);
  return (data as unknown as PartitaConCoppie[]) ?? [];
}

/** Ultimi risultati. */
export async function ultimiRisultati(limite = 6): Promise<PartitaConCoppie[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("partite").select(SELECT_PARTITA).eq("stato", "conclusa").order("inizio_at", { ascending: false }).order("turno", { ascending: false }).order("ordine").limit(limite);
  return (data as unknown as PartitaConCoppie[]) ?? [];
}

export interface NotiziaMostrata {
  id: string;
  titolo: string;
  riassunto: string;
  lingua: string;
  altraLingua: boolean;
  fonte_nome: string;
  url_originale: string;
  pubblicata_at: string | null;
}

/** Sceglie la traduzione nella lingua dell'utente; se manca, un'altra (prima it, poi en, poi la prima). */
export function traduzione(n: Notizia, lingua: string): NotiziaMostrata | null {
  const t = n.notizie_traduzioni;
  const scelta = t.find((x) => x.lingua === lingua) ?? t.find((x) => x.lingua === "it") ?? t.find((x) => x.lingua === "en") ?? t[0];
  if (!scelta) return null;
  return { id: n.id, titolo: scelta.titolo, riassunto: scelta.riassunto, lingua: scelta.lingua, altraLingua: scelta.lingua !== lingua, fonte_nome: n.fonte_nome, url_originale: n.url_originale, pubblicata_at: n.pubblicata_at };
}

export async function notiziePubblicate(lingua: string, limite = 30): Promise<NotiziaMostrata[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("notizie")
    .select("id, fonte_nome, url_originale, pubblicata_at, stato, notizie_traduzioni(lingua, titolo, riassunto)")
    .eq("stato", "pubblicata")
    .order("pubblicata_at", { ascending: false })
    .limit(limite);
  return ((data as Notizia[]) ?? []).map((n) => traduzione(n, lingua)).filter((x): x is NotiziaMostrata => Boolean(x));
}

export interface LegaMia {
  id: string;
  nome: string;
  codice: string;
  creata_da: string;
  membri: number;
}

export async function mieLeghe(): Promise<LegaMia[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("leghe").select("id, nome, codice, creata_da, leghe_membri(count)").order("creato_at");
  return ((data as unknown as (Omit<LegaMia, "membri"> & { leghe_membri: { count: number }[] })[]) ?? []).map((l) => ({
    id: l.id,
    nome: l.nome,
    codice: l.codice,
    creata_da: l.creata_da,
    membri: l.leghe_membri?.[0]?.count ?? 0,
  }));
}

/** Valori dei punti dalla tabella regole_punti (una lettura per richiesta). */
export const regolePunti = cache(async (): Promise<Regole> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("regole_punti").select("chiave, punti");
  return { ...REGOLE_PREDEFINITE, ...Object.fromEntries((data ?? []).map((r) => [r.chiave as string, r.punti as number])) };
});

/** Premi della classifica del mese: posizione → descrizione. */
export async function premi(): Promise<Record<number, string>> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("premi").select("posizione, descrizione");
  return Object.fromEntries((data ?? []).map((p) => [p.posizione as number, p.descrizione as string]));
}

export interface Sponsor {
  id: string;
  nome: string;
  link: string | null;
  logo_url: string;
}

/** Sponsor visibili, nell'ordine scelto dall'admin. */
export async function sponsorAttivi(): Promise<Sponsor[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("sponsor").select("id, nome, link, logo_url").eq("attivo", true).order("ordine").order("creato_at");
  return (data as Sponsor[]) ?? [];
}

/** I primi tre di ogni mese già chiuso (classifica mondiale): da qui nascono le medaglie. */
export async function podiMesiChiusi(quanti = 12): Promise<{ utente_id: string; posizione: number }[][]> {
  const supabase = await supabaseServer();
  const mesi = ultimiMesi(quanti + 1).slice(1);
  const risposte = await Promise.all(mesi.map((m) => supabase.rpc("classifica", { p_mese: m, p_limite: 3 })));
  return risposte.map((r) => ((r.data as { utente_id: string; posizione: number }[] | null) ?? []).filter((x) => x.posizione <= 3));
}
