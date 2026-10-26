// Piccole funzioni di supporto condivise da motore e interfaccia.

export const limita = (x, min, max) => Math.min(max, Math.max(min, x));

/** Arrotonda agli euro interi. */
export const euro = (x) => Math.round(x);

/** Età di una persona nell'anno corrente. */
export function eta(persona, anno) {
  const fine = persona.anno_morte ?? anno;
  return fine - persona.anno_nascita;
}

/** Ordine dei titoli di studio, dal più basso al più alto. */
export const TITOLI = ["nessuno", "licenza_elementare", "licenza_media", "diploma", "laurea_triennale", "laurea_magistrale"];

export const NOMI_TITOLI = {
  nessuno: "Nessun titolo",
  licenza_elementare: "Licenza elementare",
  licenza_media: "Licenza media",
  diploma: "Diploma",
  laurea_triennale: "Laurea triennale",
  laurea_magistrale: "Laurea magistrale",
};

export function titoloAlmeno(titolo, minimo) {
  return TITOLI.indexOf(titolo) >= TITOLI.indexOf(minimo);
}

/** Sostituisce i segnaposto {chiave} con i valori dati; quelli sconosciuti restano visibili. */
export function riempi(testo, valori) {
  return testo.replace(/\{(\w+)\}/g, (tutto, k) => (valori[k] !== undefined && valori[k] !== null ? String(valori[k]) : tutto));
}

/** Nome del mestiere al genere della persona (nome_f nei dati, se c'è). */
export function nomeMestiere(mestiere, sesso) {
  if (!mestiere) return null;
  return sesso === "F" && mestiere.nome_f ? mestiere.nome_f : mestiere.nome;
}

/** Formato euro all'italiana: 12.345 €. */
export function formatoEuro(x) {
  const n = Math.round(x);
  return `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("it-IT")} €`;
}
