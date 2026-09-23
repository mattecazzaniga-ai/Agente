// Small shared helpers: deterministic RNG, rounding, dates.

/** mulberry32: tiny deterministic PRNG so simulations are reproducible from a seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string (FNV-1a). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Round money to cents. */
export function money(x: number): number {
  return Math.round(x * 100) / 100;
}

export function day(iso: string): string {
  return iso.slice(0, 10);
}

/** Draw from Binomial(n, p) — exact for small n, normal approximation for large n. */
export function binomial(n: number, p: number, rand: () => number): number {
  if (n <= 0 || p <= 0) return 0;
  if (n < 200) {
    let k = 0;
    for (let i = 0; i < n; i++) if (rand() < p) k++;
    return k;
  }
  const mean = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  const u = 1 - rand();
  const v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return clamp(Math.round(mean + z * sd), 0, n);
}

export function pad(n: number, width = 3): string {
  return String(n).padStart(width, "0");
}
