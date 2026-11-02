// Importazione veloce di un tabellone: l'admin incolla la entry list (una coppia per riga, nell'ordine
// del tabellone) oppure un CSV, e qui si ricavano giocatori, coppie e partite del primo turno.
// Nessun dato viene preso da siti esterni: è il testo che l'admin incolla.
//
// Formati accettati per riga:
//   1. Andrea Ricci (ITA) / Paolo Neri (ITA)       ← testa di serie facoltativa: "1." o "[1]"
//   RICCI Andrea ITA / NERI Paolo ITA               ← cognome in maiuscolo, come nelle entry list ITF
//   Ricci, Andrea (ITA) – Neri, Paolo (ITA)
//   Andrea;Ricci;ITA;Paolo;Neri;ITA;1                ← CSV: nome;cognome;paese ×2; testa di serie
//   BYE                                              ← posto vuoto nel tabellone

import { DA_ISO3 } from "./paesi";
import type { Turno } from "./tipi";

export interface GiocatoreLetto {
  nome: string;
  cognome: string;
  paese: string | null;
}
export interface CoppiaLetta {
  testa_di_serie: number | null;
  g1: GiocatoreLetto;
  g2: GiocatoreLetto;
}
export interface Lettura {
  posti: (CoppiaLetta | null)[]; // null = BYE
  errori: { riga: number; testo: string }[];
}

const maiuscola = (s: string) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase());

function paeseDa(codice: string | undefined): string | null {
  if (!codice) return null;
  const c = codice.toUpperCase();
  if (c.length === 2 && /^[A-Z]{2}$/.test(c)) return c;
  return DA_ISO3[c] ?? null;
}

/** "Andrea Ricci (ITA)", "RICCI Andrea ITA", "Ricci, Andrea" → nome, cognome, paese. */
export function leggiGiocatore(testo: string): GiocatoreLetto | null {
  let t = testo.trim().replace(/\s+/g, " ");
  let paese: string | null = null;
  const tra = t.match(/\(([A-Za-z]{2,3})\)\s*$/);
  const fine = t.match(/\s([A-Z]{3})$/);
  if (tra) {
    paese = paeseDa(tra[1]);
    t = t.slice(0, tra.index).trim();
  } else if (fine && Object.prototype.hasOwnProperty.call(DA_ISO3, fine[1])) {
    paese = paeseDa(fine[1]);
    t = t.slice(0, fine.index).trim();
  }
  if (!t) return null;
  if (t.includes(",")) {
    const [cognome, nome] = t.split(",").map((x) => x.trim());
    if (!cognome || !nome) return null;
    return { nome: maiuscola(nome), cognome: maiuscola(cognome), paese };
  }
  const parole = t.split(" ");
  if (parole.length < 2) return null;
  const tutteMaiuscole = (p: string) => p.length > 1 && p === p.toUpperCase() && /\p{L}/u.test(p);
  const maiusc = parole.filter(tutteMaiuscole);
  if (maiusc.length && maiusc.length < parole.length) {
    return { nome: parole.filter((p) => !tutteMaiuscole(p)).join(" "), cognome: maiuscola(maiusc.join(" ")), paese };
  }
  return { nome: maiuscola(parole[0]), cognome: maiuscola(parole.slice(1).join(" ")), paese };
}

/** Legge l'elenco incollato. Le righe vuote e quelle che iniziano con # si ignorano. */
export function leggiEntryList(testo: string): Lettura {
  const posti: (CoppiaLetta | null)[] = [];
  const errori: { riga: number; testo: string }[] = [];
  testo.split(/\r?\n/).forEach((grezza, i) => {
    const riga = grezza.trim();
    if (!riga || riga.startsWith("#")) return;
    if (/^(bye|—|-)$/i.test(riga.replace(/^\[?\d+[.)\]]\s*/, ""))) {
      posti.push(null);
      return;
    }
    // CSV
    const csv = riga.split(/[;\t]/).map((x) => x.trim());
    if (csv.length >= 6) {
      const [n1, c1, p1, n2, c2, p2, tds] = csv;
      if (!n1 || !c1 || !n2 || !c2) return errori.push({ riga: i + 1, testo: riga });
      posti.push({
        testa_di_serie: tds && /^\d+$/.test(tds) ? Number(tds) : null,
        g1: { nome: maiuscola(n1), cognome: maiuscola(c1), paese: paeseDa(p1) },
        g2: { nome: maiuscola(n2), cognome: maiuscola(c2), paese: paeseDa(p2) },
      });
      return;
    }
    let resto = riga;
    let testa: number | null = null;
    const tds = resto.match(/^\[?(\d{1,2})[.)\]]\s*/);
    if (tds) {
      testa = Number(tds[1]);
      resto = resto.slice(tds[0].length);
    }
    const parti = resto.split(/\s+[/–&]\s+|\s+-\s+|\s*\/\s*/);
    if (parti.length !== 2) return errori.push({ riga: i + 1, testo: riga });
    const g1 = leggiGiocatore(parti[0]);
    const g2 = leggiGiocatore(parti[1]);
    if (!g1 || !g2) return errori.push({ riga: i + 1, testo: riga });
    posti.push({ testa_di_serie: testa, g1, g2 });
  });
  return { posti, errori };
}

const TURNO_PER_DIMENSIONE: Record<number, Turno> = { 2: "F", 4: "SF", 8: "QF", 16: "R16", 32: "R32", 64: "R64" };
const SUCCESSIVO: Partial<Record<Turno, Turno>> = { R64: "R32", R32: "R16", R16: "QF", QF: "SF", SF: "F" };

export interface PrimoTurno {
  turno: Turno;
  dimensione: number;
  /** partite del primo turno: indici dei posti */
  partite: { ordine: number; a: number; b: number }[];
  /** coppie che passano direttamente al turno dopo grazie a un BYE */
  avanzati: { turno: Turno; ordine: number; lato: "a" | "b"; posto: number }[];
}

/** Costruisce il primo turno: il posto 2n-1 contro il 2n; chi ha il BYE passa direttamente. */
export function costruisciPrimoTurno(posti: (CoppiaLetta | null)[]): PrimoTurno | { errore: string } {
  const reali = posti.filter(Boolean).length;
  if (reali < 2) return { errore: "servono almeno 2 coppie" };
  let dimensione = 2;
  while (dimensione < posti.length) dimensione *= 2;
  if (dimensione > 64) return { errore: "massimo 64 posti" };
  const turno = TURNO_PER_DIMENSIONE[dimensione];
  const partite: PrimoTurno["partite"] = [];
  const avanzati: PrimoTurno["avanzati"] = [];
  for (let i = 1; i <= dimensione / 2; i++) {
    const a = 2 * i - 2;
    const b = 2 * i - 1;
    const ca = a < posti.length ? posti[a] : null;
    const cb = b < posti.length ? posti[b] : null;
    if (ca && cb) partite.push({ ordine: i, a, b });
    else if ((ca || cb) && SUCCESSIVO[turno]) {
      avanzati.push({ turno: SUCCESSIVO[turno]!, ordine: Math.ceil(i / 2), lato: i % 2 === 1 ? "a" : "b", posto: ca ? a : b });
    }
  }
  return { turno, dimensione, partite, avanzati };
}
