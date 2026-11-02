// Lettura del punteggio scritto dall'admin: "6-4 3-6 10-7" → game per set di A e di B.
// Gli stessi controlli li fa il database; qui servono a dare un messaggio chiaro subito.

export interface Punteggio {
  a: number[];
  b: number[];
  setA: number;
  setB: number;
}

export function leggiPunteggio(testo: string, setPerVincere: 1 | 2): Punteggio | { errore: string } {
  const set = testo
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (!set.length) return { errore: "vuoto" };
  const a: number[] = [];
  const b: number[] = [];
  for (const s of set) {
    const m = s.match(/^(\d{1,2})[-–:/](\d{1,2})$/);
    if (!m) return { errore: `set non valido: ${s}` };
    a.push(Number(m[1]));
    b.push(Number(m[2]));
  }
  let setA = 0;
  let setB = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) return { errore: `set in parità: ${a[i]}-${b[i]}` };
    if (a[i] > b[i]) setA++;
    else setB++;
  }
  if (a.length > setPerVincere * 2 - 1) return { errore: "troppi set" };
  if (Math.max(setA, setB) !== setPerVincere) return { errore: "il punteggio non chiude la partita" };
  return { a, b, setA, setB };
}
