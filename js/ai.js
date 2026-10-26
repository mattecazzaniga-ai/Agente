// Narratore AI (FASE 5, non ancora attivo).
// Regola: l'AI non decide mai soldi, salute o morale. Riceve un evento già risolto dal motore
// e può solo riscriverne il testo. Se manca la chiave, se finisce la quota o se la risposta non è
// valida, il gioco usa i testi della libreria. La chiave Gemini resterà solo nel browser (localStorage).

/** FASE 1: nessun narratore. Restituisce sempre il testo della libreria. */
export async function racconta(testoLibreria) {
  return testoLibreria;
}

export const disponibile = () => false;
