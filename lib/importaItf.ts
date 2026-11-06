// Lettura del tabellone ITF copiato dalla pagina "Draws & Results" (Seleziona tutto → Copia).
// È il testo che l'admin incolla: nessun dato viene scaricato dal sito ITF.
//
// Forma del testo, una informazione per riga:
//   BRA                         ← nazione (facoltativa: a volte manca)
//   RenzoTesta Lutzenberger     ← nome e cognome attaccati ("Renzo" + "Testa Lutzenberger")
//   BRA
//   LeonardoBranco
//   [1]                         ← testa di serie (facoltativa)
//   6                           ← game per set; "69" = 6 con tie-break perso a 9; "RETIRED" = ritiro
//   6
// Le coppie sono nell'ordine del tabellone. Dopo il primo turno il testo ripete le coppie dei turni
// successivi (i vincitori), con i loro punteggi se la partita è stata giocata.

import { DA_ISO3 } from "./paesi";
import type { Turno } from "./tipi";
import type { CoppiaLetta, GiocatoreLetto } from "./importa";

const TURNI_DA: Record<number, Turno[]> = {
  64: ["R64", "R32", "R16", "QF", "SF", "F"],
  32: ["R32", "R16", "QF", "SF", "F"],
  16: ["R16", "QF", "SF", "F"],
  8: ["QF", "SF", "F"],
  4: ["SF", "F"],
  2: ["F"],
};

interface CoppiaGrezza {
  coppia: CoppiaLetta | null; // null = BYE
  punti: string[];
}

export interface PartitaItf {
  turno: Turno;
  ordine: number; // 1 = la più in alto nel tabellone
  a: number; // posto nel primo turno della coppia A
  b: number;
  game_a: number[];
  game_b: number[];
  ritiro: boolean;
  vince: "a" | "b";
}

export interface TabelloneItf {
  dimensione: number;
  posti: (CoppiaLetta | null)[];
  giocate: PartitaItf[]; // in ordine di turno
  avvisi: string[];
}

const NAZIONE = /^[A-Z]{3}$/;
const TESTA = /^\[(\d{1,2})\]$/;
const PUNTO = /^\d{1,3}$/;
const RITIRO = /^(RETIRED|RET\.?|W\/?O|WALKOVER|DEFAULT|DEF\.?)$/i;

/** Lascia i nomi come sono ("da Fonseca"); solo se tutto è minuscolo mette le iniziali maiuscole. */
const sistema = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ");
  return t === t.toLowerCase() ? t.replace(/(^|\s)(\p{L})/gu, (_, sp, l) => sp + l.toUpperCase()) : t;
};

/** "RenzoTesta Lutzenberger" → Renzo / Testa Lutzenberger; "Joao PedroLinhares" → Joao Pedro / Linhares. */
export function separaNome(testo: string): { nome: string; cognome: string } | null {
  const t = testo.trim().replace(/\s+/g, " ");
  if (!t) return null;
  const m = t.match(/^(.*?\p{Ll})(\p{Lu}.*)$/u);
  if (m && m[1].trim() && m[2].trim()) return { nome: sistema(m[1]), cognome: sistema(m[2]) };
  const spazio = t.indexOf(" ");
  if (spazio > 0) return { nome: sistema(t.slice(0, spazio)), cognome: sistema(t.slice(spazio + 1)) };
  return { nome: sistema(t), cognome: sistema(t) };
}

const chiave = (c: CoppiaLetta | null) => (c ? [c.g1, c.g2].map((g) => `${g.nome}|${g.cognome}`.toLowerCase()).join("/") : "bye");

/** Riconosce il testo come tabellone ITF? (righe con la sola nazione a tre lettere) */
export function sembraTabelloneItf(testo: string): boolean {
  const righe = testo.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  return righe.filter((r) => NAZIONE.test(r)).length >= 4 && righe.some((r) => PUNTO.test(r) || TESTA.test(r));
}

function leggiCoppie(testo: string): { coppie: CoppiaGrezza[]; avvisi: string[] } {
  const righe = testo.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const coppie: CoppiaGrezza[] = [];
  const avvisi: string[] = [];
  let i = 0;
  const giocatore = (): GiocatoreLetto | null => {
    let paese: string | null = null;
    if (NAZIONE.test(righe[i] ?? "")) {
      paese = DA_ISO3[righe[i]] ?? null;
      i++;
    }
    const riga = righe[i];
    if (!riga || PUNTO.test(riga) || TESTA.test(riga) || RITIRO.test(riga) || NAZIONE.test(riga)) return null;
    i++;
    const n = separaNome(riga);
    return n ? { ...n, paese } : null;
  };
  while (i < righe.length) {
    if (/^bye$/i.test(righe[i])) {
      i++;
      coppie.push({ coppia: null, punti: [] });
      continue;
    }
    const inizio = i;
    const g1 = giocatore();
    const g2 = g1 ? giocatore() : null;
    if (!g1 || !g2) {
      avvisi.push(`Riga non riconosciuta: "${righe[inizio]}"`);
      i = inizio + 1;
      continue;
    }
    let testa: number | null = null;
    const t = (righe[i] ?? "").match(TESTA);
    if (t) {
      testa = Number(t[1]);
      i++;
    }
    const punti: string[] = [];
    while (i < righe.length && (PUNTO.test(righe[i]) || RITIRO.test(righe[i]))) punti.push(righe[i++]);
    coppie.push({ coppia: { testa_di_serie: testa, g1, g2 }, punti });
  }
  return { coppie, avvisi };
}

/** "69" in un set normale = 6 (tie-break perso a 9). L'ultimo set al meglio dei 3 è il super tie-break. */
function game(valore: string, set: number, setPerVincere: 1 | 2): number {
  const n = Number(valore);
  const superTieBreak = setPerVincere === 2 && set === 2;
  if (!superTieBreak && valore.length >= 2 && n > 7) return Number(valore[0]);
  return n;
}

function risultato(pa: string[], pb: string[], setPerVincere: 1 | 2, descr: string, avvisi: string[]) {
  const ritA = pa.some((p) => RITIRO.test(p));
  const ritB = pb.some((p) => RITIRO.test(p));
  const a = pa.filter((p) => PUNTO.test(p)).map((p, s) => game(p, s, setPerVincere));
  const b = pb.filter((p) => PUNTO.test(p)).map((p, s) => game(p, s, setPerVincere));
  if (ritA || ritB) {
    const n = Math.min(a.length, b.length);
    return { game_a: a.slice(0, n), game_b: b.slice(0, n), ritiro: true, vince: (ritA ? "b" : "a") as "a" | "b" };
  }
  if (!a.length && !b.length) return null; // non ancora giocata
  // punteggio incompleto nel testo copiato (es. 10 contro niente nel super tie-break): si completa con 2 punti di scarto
  while (a.length < b.length) {
    a.push(Math.max(0, b[a.length] - 2));
    avvisi.push(`${descr}: punteggio incompleto, completato come ${a.at(-1)}-${b[a.length - 1]}. Controllalo.`);
  }
  while (b.length < a.length) {
    b.push(Math.max(0, a[b.length] - 2));
    avvisi.push(`${descr}: punteggio incompleto, completato come ${a[b.length - 1]}-${b.at(-1)}. Controllalo.`);
  }
  let setA = 0;
  let setB = 0;
  a.forEach((x, s) => (x > b[s] ? setA++ : x < b[s] ? setB++ : 0));
  if (setA === setB) return null;
  return { game_a: a, game_b: b, ritiro: false, vince: (setA > setB ? "a" : "b") as "a" | "b" };
}

/** Legge il tabellone ITF incollato: posti del primo turno e partite già giocate di tutti i turni. */
export function leggiTabelloneItf(testo: string, setPerVincere: 1 | 2 = 2): TabelloneItf | { errore: string } {
  const { coppie, avvisi } = leggiCoppie(testo);
  if (coppie.filter((c) => c.coppia).length < 2) return { errore: "nessuna coppia riconosciuta" };

  // Il primo turno finisce quando la prima coppia compare di nuovo (inizio del turno dopo).
  const primaChiave = chiave(coppie[0].coppia);
  let fine = coppie.findIndex((c, k) => k > 0 && c.coppia && chiave(c.coppia) === primaChiave);
  if (fine < 0) fine = coppie.length;
  let dimensione = 2;
  while (dimensione < fine) dimensione *= 2;
  if (dimensione > 64) return { errore: "massimo 64 posti" };
  if (fine !== dimensione) avvisi.push(`Il primo turno ha ${fine} posti: completato a ${dimensione} con dei BYE.`);

  const primo = coppie.slice(0, fine);
  const posti: (CoppiaLetta | null)[] = Array.from({ length: dimensione }, (_, k) => primo[k]?.coppia ?? null);
  const posto = new Map<string, number>();
  posti.forEach((c, k) => c && posto.set(chiave(c), k));
  const turni = TURNI_DA[dimensione];
  const giocate: PartitaItf[] = [];
  const nomi = (k: number) => `${posti[k]?.g1.cognome}/${posti[k]?.g2.cognome}`;

  // Primo turno: il posto 2n-1 contro il 2n
  for (let k = 0; k + 1 < dimensione; k += 2) {
    if (!posti[k] || !posti[k + 1]) continue;
    const r = risultato(primo[k]?.punti ?? [], primo[k + 1]?.punti ?? [], setPerVincere, `${turni[0]} ${nomi(k)} - ${nomi(k + 1)}`, avvisi);
    if (r) giocate.push({ turno: turni[0], ordine: k / 2 + 1, a: k, b: k + 1, ...r });
  }

  // Turni successivi. Ogni coppia si colloca dalla sua posizione nel primo turno: nel turno L occupa il
  // posto floor(k / 2^L). Dentro un turno i posti crescono; quando tornano indietro, inizia il turno dopo.
  const perTurno = new Map<number, { k: number; punti: string[] }[]>();
  let livello = 1;
  let ultimo = -1;
  for (const c of coppie.slice(fine)) {
    if (!c.coppia) continue;
    const k = posto.get(chiave(c.coppia));
    if (k === undefined) {
      avvisi.push(`Coppia non presente nel primo turno: ${c.coppia.g1.cognome}/${c.coppia.g2.cognome}`);
      continue;
    }
    if (Math.floor(k / 2 ** livello) <= ultimo) livello++;
    if (livello >= turni.length) break;
    ultimo = Math.floor(k / 2 ** livello);
    perTurno.set(livello, [...(perTurno.get(livello) ?? []), { k, punti: c.punti }]);
  }
  for (const [l, lista] of [...perTurno.entries()].sort((x, y) => x[0] - y[0])) {
    for (let j = 0; j + 1 < lista.length; j++) {
      const [x, y] = [lista[j], lista[j + 1]];
      if (Math.floor(x.k / 2 ** (l + 1)) !== Math.floor(y.k / 2 ** (l + 1))) continue;
      j++;
      const r = risultato(x.punti, y.punti, setPerVincere, `${turni[l]} ${nomi(x.k)} - ${nomi(y.k)}`, avvisi);
      if (r) giocate.push({ turno: turni[l], ordine: Math.floor(x.k / 2 ** (l + 1)) + 1, a: x.k, b: y.k, ...r });
    }
  }
  return { dimensione, posti, giocate, avvisi };
}
