import "server-only";
import { supabaseServer } from "./supabase/server";

// Avvisi calcolati dai dati (niente tabella in più): cosa è successo di nuovo per chi gioca.
export type TipoAvviso = "scadenza" | "punti" | "notizia" | "lega";
export interface Avviso {
  tipo: TipoAvviso;
  quando: string; // ISO: per ordinare e per capire se è nuovo
  titolo: string; // dati grezzi: il testo lo compone la pagina con le traduzioni
  dettaglio?: string;
  punti?: number;
  link: string;
}

const coppia = (c: { g1: { cognome: string }; g2: { cognome: string } } | null) => (c ? `${c.g1.cognome}/${c.g2.cognome}` : "—");
const COPPIA = "id, g1:giocatori!coppie_giocatore1_id_fkey(cognome), g2:giocatori!coppie_giocatore2_id_fkey(cognome)";

export async function avvisiUtente(utenteId: string): Promise<Avviso[]> {
  const supabase = await supabaseServer();
  const ora = Date.now();
  const tra24 = new Date(ora + 24 * 3600_000).toISOString();
  const tre = new Date(ora - 3 * 86400_000).toISOString();
  const [aperte, miei, notizie, leghe] = await Promise.all([
    // partite che chiudono entro 24 ore
    supabase
      .from("partite")
      .select(`id, turno, inizio_at, coppia_a:coppie!partite_coppia_a_id_fkey(${COPPIA}), coppia_b:coppie!partite_coppia_b_id_fkey(${COPPIA}), tabellone:tabelloni(genere, torneo:tornei(id, nome))`)
      .eq("stato", "in_programma")
      .gt("inizio_at", new Date(ora).toISOString())
      .lte("inizio_at", tra24)
      .not("coppia_a_id", "is", null)
      .not("coppia_b_id", "is", null)
      .limit(20),
    // i miei pronostici con punti assegnati di recente (partite iniziate negli ultimi 3 giorni)
    supabase
      .from("pronostici_partita")
      .select(`partita_id, punti, partita:partite!inner(id, turno, inizio_at, stato, coppia_a:coppie!partite_coppia_a_id_fkey(${COPPIA}), coppia_b:coppie!partite_coppia_b_id_fkey(${COPPIA}), tabellone:tabelloni(genere, torneo:tornei(id, nome)))`)
      .eq("utente_id", utenteId)
      .not("punti", "is", null)
      .gte("partita.inizio_at", tre)
      .limit(20),
    supabase.from("notizie").select("id, pubblicata_at, notizie_traduzioni(lingua, titolo)").eq("stato", "pubblicata").gte("pubblicata_at", tre).lte("pubblicata_at", new Date(ora).toISOString()).limit(5),
    // nuovi membri nelle mie leghe
    supabase.from("leghe_membri").select("lega_id, utente_id, entrato_at, lega:leghe!inner(nome, codice, io:leghe_membri!inner(utente_id)), profilo:profili(nickname)").eq("lega.io.utente_id", utenteId).neq("utente_id", utenteId).gte("entrato_at", tre).limit(10),
  ]);

  type P = { id: string; turno: string; inizio_at: string; coppia_a: never; coppia_b: never; tabellone: { genere: string; torneo: { id: string; nome: string } } };
  const linkPartita = (p: P) => `/tornei/${p.tabellone.torneo.id}?tab=${p.tabellone.genere}&turno=${p.turno}#p-${p.id}`;
  const avvisi: Avviso[] = [];

  const apertePartite = (aperte.data as unknown as P[]) ?? [];
  if (apertePartite.length) {
    const { data: fatti } = await supabase.from("pronostici_partita").select("partita_id").eq("utente_id", utenteId).in("partita_id", apertePartite.map((p) => p.id));
    const giaFatti = new Set(((fatti as { partita_id: string }[]) ?? []).map((x) => x.partita_id));
    for (const p of apertePartite.filter((x) => !giaFatti.has(x.id)))
      avvisi.push({ tipo: "scadenza", quando: p.inizio_at, titolo: `${coppia(p.coppia_a)} vs ${coppia(p.coppia_b)}`, dettaglio: p.tabellone.torneo.nome, link: linkPartita(p) });
  }
  for (const r of (miei.data as unknown as { punti: number; partita: P }[]) ?? [])
    avvisi.push({ tipo: "punti", quando: r.partita.inizio_at, titolo: `${coppia(r.partita.coppia_a)} vs ${coppia(r.partita.coppia_b)}`, dettaglio: r.partita.tabellone.torneo.nome, punti: r.punti, link: linkPartita(r.partita) });
  for (const n of (notizie.data as { id: string; pubblicata_at: string; notizie_traduzioni: { lingua: string; titolo: string }[] }[]) ?? []) {
    const tr = n.notizie_traduzioni.find((x) => x.lingua === "it") ?? n.notizie_traduzioni[0];
    if (tr) avvisi.push({ tipo: "notizia", quando: n.pubblicata_at, titolo: tr.titolo, link: `/notizie/${n.id}` });
  }
  for (const m of (leghe.data as unknown as { entrato_at: string; lega: { nome: string; codice: string }; profilo: { nickname: string } | null }[]) ?? [])
    avvisi.push({ tipo: "lega", quando: m.entrato_at, titolo: m.profilo?.nickname ?? "—", dettaglio: m.lega.nome, link: `/leghe/${m.lega.codice}` });

  return avvisi.sort((a, b) => (a.tipo === "scadenza" ? -1 : 0) - (b.tipo === "scadenza" ? -1 : 0) || b.quando.localeCompare(a.quando));
}
