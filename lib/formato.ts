// Formattazione per l'interfaccia: nomi delle coppie, bandiere, Paesi, date, punteggi.
import type { Coppia, Partita } from "./tipi";

/** "Ricci / Neri" */
export function nomeCoppia(c?: Coppia | null): string {
  if (!c) return "—";
  return `${c.g1.cognome} / ${c.g2.cognome}`;
}

/** "Andrea Ricci – Paolo Neri" */
export function nomeCoppiaLungo(c?: Coppia | null): string {
  if (!c) return "—";
  return `${c.g1.nome} ${c.g1.cognome} – ${c.g2.nome} ${c.g2.cognome}`;
}

/** Bandiera emoji dal codice ISO a 2 lettere. */
export function bandiera(paese?: string | null): string {
  if (!paese || !/^[A-Z]{2}$/.test(paese)) return "🏳️";
  return String.fromCodePoint(...[...paese].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** "🇧🇷 Ballerini / 🇧🇷 Yuji": ogni giocatore con la sua bandiera. */
export function coppiaConBandiere(c?: Coppia | null): string {
  if (!c) return "—";
  return `${bandiera(c.g1.paese)} ${c.g1.cognome} / ${bandiera(c.g2.paese)} ${c.g2.cognome}`;
}

/** "🇧🇷 Renzo Testa – 🇧🇷 Leonardo Branco" */
export function coppiaLungaConBandiere(c?: Coppia | null): string {
  if (!c) return "—";
  return `${bandiera(c.g1.paese)} ${c.g1.nome} ${c.g1.cognome} – ${bandiera(c.g2.paese)} ${c.g2.nome} ${c.g2.cognome}`;
}

export function nomePaese(paese: string | null | undefined, lingua: string): string {
  if (!paese) return "";
  try {
    return new Intl.DisplayNames([lingua], { type: "region" }).of(paese) ?? paese;
  } catch {
    return paese;
  }
}

export function data(iso: string, lingua: string, opzioni: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat(lingua, opzioni).format(new Date(iso));
}

export function dataOra(iso: string, lingua: string): string {
  return new Intl.DateTimeFormat(lingua, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** "6-4 3-6 10-7" dal punto di vista della coppia A. */
export function punteggio(p: Pick<Partita, "game_a" | "game_b" | "ritiro">): string {
  if (p.ritiro) return "rit.";
  if (!p.game_a || !p.game_b) return "";
  return p.game_a.map((g, i) => `${g}-${p.game_b![i]}`).join(" ");
}

/** Il mese come "2026-11-01" (per la classifica). */
export function meseIso(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function nomeMese(meseIsoStr: string, lingua: string): string {
  const [a, m] = meseIsoStr.split("-").map(Number);
  return new Intl.DateTimeFormat(lingua, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)));
}

/** Ultimi n mesi (per il selettore della classifica), dal più recente. */
export function ultimiMesi(n = 6, oggi = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(meseIso(new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() - i, 1))));
  return out;
}

/** Istante in cui finisce (23:59:59, ora italiana) o inizia (00:00) un giorno YYYY-MM-DD. */
export function istanteRoma(giorno: string, fine: boolean): string {
  const [a, m, d] = giorno.split("-").map(Number);
  const ore = fine ? [23, 59, 59] : [0, 0, 0];
  const utc = Date.UTC(a, m - 1, d, ore[0], ore[1], ore[2]);
  // differenza tra l'ora italiana e UTC in quel giorno (1 h d'inverno, 2 h d'estate)
  const parti = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(Date.UTC(a, m - 1, d, 12)));
  const scarto = Number(parti.find((p) => p.type === "hour")?.value ?? 13) - 12;
  return new Date(utc - scarto * 3600_000).toISOString();
}

/** La stagione in corso (oggi tra inizio e fine), oppure la prossima che deve iniziare. */
export function stagioneAttuale<T extends { inizio: string; fine: string }>(elenco: T[], oggi: string): { stagione: T; stato: "in_corso" | "prossima" } | null {
  const inCorso = elenco.find((s) => s.inizio <= oggi && oggi <= s.fine);
  if (inCorso) return { stagione: inCorso, stato: "in_corso" };
  const prossima = [...elenco].filter((s) => s.inizio > oggi).sort((x, y) => x.inizio.localeCompare(y.inizio))[0];
  return prossima ? { stagione: prossima, stato: "prossima" } : null;
}
