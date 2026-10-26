// Caricamento dei dati di gioco (JSON) e indici per accesso rapido.
// In browser i file arrivano con fetch, nei test Node con fs: il motore riceve sempre lo stesso oggetto.

export const FILE_DATI = ["regions", "names", "jobs", "schools", "traits", "generator"];

/** Costruisce l'oggetto dati a partire dai JSON grezzi. */
export function preparaDati(grezzi) {
  const { regions, names, jobs, schools, traits, generator, eventi } = grezzi;
  const perId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]));
  return {
    regioni: regions.regioni,
    regione: perId(regions.regioni),
    nomi: names,
    mestieri: jobs.mestieri,
    mestiere: perId(jobs.mestieri),
    superiori: schools.superiori,
    superiore: perId(schools.superiori),
    facolta_lista: schools.facolta,
    facolta: perId(schools.facolta),
    tratti: traits.tratti,
    tratto: perId(traits.tratti),
    ricordi: traits.ricordi,
    ricordo: perId(traits.ricordi),
    generatore: generator,
    eventi,
    evento: perId(eventi),
  };
}

/**
 * Carica tutti i dati usando una funzione leggiJson(percorsoRelativo) → oggetto.
 * Gli eventi sono elencati in data/events/index.json, un file per tema.
 */
export async function caricaDati(leggiJson) {
  const grezzi = {};
  for (const nome of FILE_DATI) grezzi[nome] = await leggiJson(`data/${nome}.json`);
  const indice = await leggiJson("data/events/index.json");
  grezzi.eventi = [];
  for (const file of indice.file) {
    const contenuto = await leggiJson(`data/events/${file}`);
    grezzi.eventi.push(...contenuto.eventi);
  }
  return preparaDati(grezzi);
}
