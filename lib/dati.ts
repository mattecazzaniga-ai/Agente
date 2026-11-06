import "server-only";
// Letture dal database per le pagine (Server Components). Le scritture sono nelle Server Actions.
// La sicurezza la fa la RLS: qui si chiede quello che serve, il database restituisce solo il permesso.

import { cache } from "react";
import { supabaseServer } from "./supabase/server";
import { REGOLE_PREDEFINITE, type Regole } from "./punti";
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
export async function mieiPronostici(tabelloni: string[], partite: string[]) {
  const supabase = await supabaseServer();
  const [{ data: pt }, { data: pp }] = await Promise.all([
    tabelloni.length ? supabase.from("pronostici_torneo").select("id, tabellone_id, vincitore_id, finalista_id, punti").in("tabellone_id", tabelloni) : Promise.resolve({ data: [] }),
    partite.length ? supabase.from("pronostici_partita").select("id, partita_id, vincitore_id, set_vincitore, set_perdente, totale_game, game_a, game_b, game_previsti_a, game_previsti_b, punti_vincitore, punti_set, punti_game, errore_game, punti").in("partita_id", partite) : Promise.resolve({ data: [] }),
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
export async function partiteAperte(limite = 6): Promise<PartitaConCoppie[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("partite")
    .select(`*, coppia_a:coppie!partite_coppia_a_id_fkey(${SELECT_COPPIA}), coppia_b:coppie!partite_coppia_b_id_fkey(${SELECT_COPPIA}), tabellone:tabelloni(genere, torneo:tornei(id, nome))`)
    .eq("stato", "in_programma")
    .gt("inizio_at", new Date().toISOString())
    .not("coppia_a_id", "is", null)
    .not("coppia_b_id", "is", null)
    .order("inizio_at")
    .limit(limite);
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
