// Generatore di numeri casuali deterministico (mulberry32).
// Lo stato vive dentro la partita (state.world.rng), così ogni partita è riproducibile
// dal suo seed e un salvataggio ripreso continua esattamente da dove era.

/** Avanza lo stato e restituisce un numero in [0, 1). */
export function casuale(state) {
  let a = (state.world.rng = (state.world.rng + 0x6d2b79f5) >>> 0);
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Converte un testo o un numero qualsiasi in un seed a 32 bit (FNV-1a). */
export function seedDa(valore) {
  const s = String(valore);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Intero in [min, max] inclusi. */
export function intero(state, min, max) {
  return min + Math.floor(casuale(state) * (max - min + 1));
}

/** Numero reale in [min, max). */
export function tra(state, min, max) {
  return min + casuale(state) * (max - min);
}

/** true con probabilità p. */
export function probabile(state, p) {
  return casuale(state) < p;
}

/** Un elemento a caso di un array. */
export function scegli(state, lista) {
  return lista[Math.floor(casuale(state) * lista.length)];
}

/** Scelta pesata: lista di elementi e funzione (o chiave) che dà il peso. */
export function pesato(state, lista, peso = (x) => x.peso) {
  const pesi = lista.map((x) => Math.max(0, typeof peso === "function" ? peso(x) : x[peso]));
  const totale = pesi.reduce((a, b) => a + b, 0);
  if (totale <= 0) return undefined;
  let r = casuale(state) * totale;
  for (let i = 0; i < lista.length; i++) {
    r -= pesi[i];
    if (r < 0) return lista[i];
  }
  return lista[lista.length - 1];
}

/** Scelta pesata da un oggetto { chiave: peso }. */
export function pesatoChiavi(state, mappa) {
  const voci = Object.entries(mappa).map(([k, p]) => ({ k, peso: p }));
  return pesato(state, voci)?.k;
}

/** Approssimazione di una normale (somma di 3 uniformi), media m e deviazione d. */
export function normale(state, m, d) {
  const u = (casuale(state) + casuale(state) + casuale(state) - 1.5) / 0.5;
  return m + u * d;
}

/** Mescola una copia dell'array. */
export function mescola(state, lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(casuale(state) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
