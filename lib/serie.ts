// La serie (il "fuoco"): giornate di gara consecutive in cui hai pronosticato almeno una partita.
// Contano solo i giorni in cui c'erano partite: tra un torneo e l'altro la serie non si spezza.

/** Data del calendario italiano (YYYY-MM-DD) di un istante. */
export const giorno = (iso: string | Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export interface Serie {
  attuale: number;
  migliore: number;
  /** oggi ci sono partite ancora da pronosticare e non hai ancora giocato: la serie è a rischio */
  inPericolo: boolean;
  /** hai già pronosticato una partita di oggi */
  fattaOggi: boolean;
}

/**
 * @param giorniGara giorni (YYYY-MM-DD) con almeno una partita, fino a oggi compreso
 * @param giorniMiei giorni delle partite che hai pronosticato
 * @param oggi il giorno di oggi
 * @param apertaOggi oggi c'è ancora almeno una partita aperta ai pronostici
 */
export function calcolaSerie(giorniGara: Iterable<string>, giorniMiei: Iterable<string>, oggi: string, apertaOggi: boolean): Serie {
  const gara = [...new Set(giorniGara)].filter((g) => g <= oggi).sort();
  const miei = new Set(giorniMiei);
  // migliore: la corsa più lunga di giornate consecutive (tra le giornate di gara) con un pronostico
  let migliore = 0;
  let corsa = 0;
  for (const g of gara) {
    corsa = miei.has(g) ? corsa + 1 : 0;
    migliore = Math.max(migliore, corsa);
  }
  // attuale: all'indietro dall'ultima giornata; oggi non spezza la serie finché si può ancora pronosticare
  const fattaOggi = miei.has(oggi);
  let attuale = 0;
  for (let i = gara.length - 1; i >= 0; i--) {
    const g = gara[i];
    if (miei.has(g)) attuale++;
    else if (g === oggi && apertaOggi) continue;
    else break;
  }
  return { attuale, migliore, inPericolo: attuale > 0 && !fattaOggi && gara.at(-1) === oggi && apertaOggi, fattaOggi };
}
