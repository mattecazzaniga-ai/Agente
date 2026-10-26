// Narratore AI (FASE 5) con Gemini, piano gratuito.
//
// Regole:
// - L'AI non decide mai niente: riceve testi già decisi dal motore e li riscrive. Scelte, soldi,
//   salute e morale restano quelli del codice. Le risposte con numeri inventati vengono scartate.
// - La chiave API la inserisce il giocatore in Impostazioni e resta solo in questo browser
//   (localStorage, chiave separata dalla partita: non finisce mai nel salvataggio né nei file esportati).
// - Una richiesta alla volta (coda), pausa minima tra le richieste, contatore giornaliero,
//   limiti configurabili. Senza chiave, oltre i limiti o in caso di errore si usano i testi della libreria.

export const CHIAVE_IMPOSTAZIONI = "dinastia.ai";
export const CHIAVE_RACCONTI = "dinastia.racconti";
const MASSIMO_RACCONTI = 300;
const TIMEOUT = 20000;
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const IMPOSTAZIONI_PREDEFINITE = {
  attivo: false,
  chiave: "",
  modello: "gemini-2.5-flash",
  limite_minuto: 6, // il piano gratuito ne concede circa 10 al minuto: restiamo sotto
  limite_giorno: 100,
  temperatura: 0.9,
};

const ISTRUZIONI = `Sei il narratore di "Dinastia", un gioco italiano che simula la vita di una famiglia nell'Italia di oggi.
Scrivi sempre in italiano corrente, caldo e concreto, con dettagli quotidiani italiani credibili. Niente retorica, niente elenchi.
Regole ferree:
- Riscrivi soltanto: non aggiungere fatti importanti, persone nuove, malattie, soldi, cifre, date o esiti che non ci sono.
- Non scrivere numeri, a parte quelli già presenti nel materiale che ricevi.
- Non anticipare cosa sceglierà il personaggio e non suggerire una scelta.
- Rispondi solo con un oggetto JSON valido, senza testo prima o dopo.`;

/** Numeri presenti in un testo (per verificare che l'AI non inventi cifre). */
function numeri(testo) {
  return (String(testo).match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, ""));
}

/**
 * Controlla la risposta: deve avere il campo atteso, lunghezza sensata, nessun segnaposto
 * e nessun numero che non compaia già nel materiale di partenza.
 */
export function convalidaRisposta(testoRisposta, campo, fonte, { min = 30, max = 900 } = {}) {
  let oggetto;
  try {
    oggetto = JSON.parse(String(testoRisposta).trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return { ok: false, motivo: "risposta non in JSON" };
  }
  const t = typeof oggetto?.[campo] === "string" ? oggetto[campo].trim() : "";
  if (t.length < min || t.length > max) return { ok: false, motivo: "lunghezza non valida" };
  if (/[{}<>]/.test(t)) return { ok: false, motivo: "caratteri non ammessi" };
  const ammessi = new Set(numeri(fonte));
  if (numeri(t).some((n) => !ammessi.has(n))) return { ok: false, motivo: "numeri inventati" };
  return { ok: true, testo: t };
}

/** Data locale AAAA-MM-GG, per il contatore giornaliero. */
const giorno = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Crea il narratore. `fetch`, `storage` e `ora` si possono sostituire (test in Node).
 * Ogni metodo pubblico restituisce una Promise con il testo dell'AI, oppure null (si usa la libreria).
 */
export function creaNarratore({ fetch = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, ora = () => new Date(), attendi = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let coda = Promise.resolve();
  let ultimaRichiesta = 0;
  let pausaFinoA = 0; // dopo un errore 429 (troppe richieste) si aspetta
  let ultimoErrore = null;
  const inAttesa = new Map(); // chiave → Promise, per non chiedere due volte lo stesso testo

  // --- impostazioni e contatore (solo in questo browser) ---
  function leggi(chiave, predefinito) {
    try {
      return JSON.parse(storage?.getItem(chiave) ?? "null") ?? predefinito;
    } catch {
      return predefinito;
    }
  }
  function scrivi(chiave, valore) {
    try {
      storage?.setItem(chiave, JSON.stringify(valore));
    } catch {
      /* storage pieno o bloccato: il gioco continua */
    }
  }
  const impostazioni = () => ({ ...IMPOSTAZIONI_PREDEFINITE, ...leggi(CHIAVE_IMPOSTAZIONI, {}) });

  function contatore() {
    const c = leggi(`${CHIAVE_IMPOSTAZIONI}.contatore`, null);
    const oggi = giorno(ora());
    return c && c.giorno === oggi ? c : { giorno: oggi, richieste: 0 };
  }
  function conta() {
    const c = contatore();
    c.richieste += 1;
    scrivi(`${CHIAVE_IMPOSTAZIONI}.contatore`, c);
  }

  // --- archivio dei testi già raccontati ---
  function archivio() {
    return leggi(CHIAVE_RACCONTI, { ordine: [], testi: {} });
  }
  function memorizza(chiave, testo) {
    const a = archivio();
    if (!a.testi[chiave]) a.ordine.push(chiave);
    a.testi[chiave] = testo;
    while (a.ordine.length > MASSIMO_RACCONTI) delete a.testi[a.ordine.shift()];
    scrivi(CHIAVE_RACCONTI, a);
  }
  const giaRaccontato = (chiave) => archivio().testi[chiave] ?? null;

  const disponibile = () => {
    const i = impostazioni();
    return Boolean(i.attivo && i.chiave && fetch);
  };

  // --- una chiamata a Gemini ---
  async function chiama(prompt, campo, i) {
    const controllo = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controllo ? setTimeout(() => controllo.abort(), TIMEOUT) : null;
    const config = {
      temperature: i.temperatura,
      maxOutputTokens: 600,
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties: { [campo]: { type: "STRING" } }, required: [campo] },
    };
    if (/2\.5/.test(i.modello)) config.thinkingConfig = { thinkingBudget: 0 }; // risposte rapide, senza ragionamento
    try {
      const r = await fetch(`${ENDPOINT}/${encodeURIComponent(i.modello)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": i.chiave },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: ISTRUZIONI }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: config }),
        signal: controllo?.signal,
      });
      if (r.status === 429) {
        pausaFinoA = ora().getTime() + 60000;
        throw new Error("Troppe richieste: pausa di un minuto");
      }
      if (r.status === 400 || r.status === 403) throw new Error("Chiave o modello non validi");
      if (!r.ok) throw new Error(`Errore del servizio (${r.status})`);
      const json = await r.json();
      return json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Mette in coda una richiesta; una sola alla volta, con la pausa minima tra l'una e l'altra. */
  function richiedi(chiave, prompt, campo, fonte, limiti) {
    const pronto = giaRaccontato(chiave);
    if (pronto) return Promise.resolve(pronto);
    if (!disponibile()) return Promise.resolve(null);
    if (inAttesa.has(chiave)) return inAttesa.get(chiave);
    const lavoro = async () => {
      const i = impostazioni();
      if (!i.attivo || !i.chiave) return null;
      if (contatore().richieste >= i.limite_giorno) {
        ultimoErrore = "Limite giornaliero raggiunto: per oggi si usano i testi del gioco.";
        return null;
      }
      const intervallo = 60000 / Math.max(1, i.limite_minuto);
      const adesso = ora().getTime();
      const attesa = Math.max(ultimaRichiesta + intervallo, pausaFinoA) - adesso;
      if (attesa > 0) await attendi(attesa);
      ultimaRichiesta = ora().getTime();
      conta();
      try {
        const risposta = await chiama(prompt, campo, i);
        const v = convalidaRisposta(risposta, campo, fonte, limiti);
        if (!v.ok) {
          ultimoErrore = `Risposta scartata (${v.motivo}): uso il testo del gioco.`;
          return null;
        }
        ultimoErrore = null;
        if (!chiave.startsWith("prova:")) memorizza(chiave, v.testo);
        return v.testo;
      } catch (e) {
        ultimoErrore = e.name === "AbortError" ? "Il servizio non risponde: uso il testo del gioco." : e.message;
        return null;
      }
    };
    const promessa = coda.then(lavoro, lavoro).finally(() => inAttesa.delete(chiave));
    coda = promessa.catch(() => null);
    inAttesa.set(chiave, promessa);
    return promessa;
  }

  return {
    disponibile,
    giaRaccontato,

    /** Riscrive il testo di un evento. `contesto` viene da contestoNarrativo() in vista.js. */
    evento(chiave, contesto, evento) {
      const prompt = `Riscrivi il testo di questo evento in 2-4 frasi, in seconda persona, rivolgendoti a ${contesto.nome}. Deve restare coerente con le scelte possibili (che non devi elencare né cambiare). Rispondi con {"testo": "..."}.
Personaggio: ${JSON.stringify(contesto)}
Evento: ${JSON.stringify({ titolo: evento.titolo, testo: evento.testo, scelte: evento.scelte })}`;
      const fonte = `${evento.titolo} ${evento.testo} ${evento.scelte.join(" ")} ${JSON.stringify(contesto)}`;
      return richiedi(chiave, prompt, "testo", fonte, { min: 40, max: 700 });
    },

    /** Breve racconto dell'anno appena passato, dalle righe del diario. */
    anno(chiave, contesto, righe) {
      const prompt = `Trasforma questi fatti dell'anno ${contesto.anno} in un breve racconto di 2-4 frasi, in seconda persona, rivolto a ${contesto.nome}. Usa solo questi fatti. Rispondi con {"racconto": "..."}.
Personaggio: ${JSON.stringify(contesto)}
Fatti: ${JSON.stringify(righe)}`;
      return richiedi(chiave, prompt, "racconto", `${righe.join(" ")} ${JSON.stringify(contesto)}`, { min: 40, max: 800 });
    },

    /** Epitaffio di fine vita, in terza persona. */
    epitaffio(chiave, contesto, vita) {
      const prompt = `Scrivi un epitaffio affettuoso di 2-3 frasi, in terza persona, per ${contesto.nome}, usando solo questi fatti. Rispondi con {"epitaffio": "..."}.
Vita: ${JSON.stringify(vita)}`;
      return richiedi(chiave, prompt, "epitaffio", JSON.stringify(vita), { min: 30, max: 600 });
    },

    /** Verifica chiave e modello con una richiesta minima (conta nel limite giornaliero). */
    async prova() {
      if (!disponibile()) return { ok: false, messaggio: "Attiva il narratore e inserisci la chiave." };
      const testo = await richiedi(`prova:${ora().getTime()}`, 'Scrivi una frase di benvenuto per un gioco sulla vita di una famiglia italiana. Rispondi con {"testo": "..."}.', "testo", "", { min: 10, max: 400 });
      return testo ? { ok: true, messaggio: testo } : { ok: false, messaggio: ultimoErrore ?? "Nessuna risposta." };
    },

    impostazioni,
    salvaImpostazioni(nuove) {
      const attuali = impostazioni();
      const pulite = {
        attivo: Boolean(nuove.attivo ?? attuali.attivo),
        chiave: typeof nuove.chiave === "string" && nuove.chiave.trim() ? nuove.chiave.trim() : attuali.chiave,
        modello: /^[\w.-]+$/.test(nuove.modello ?? "") ? nuove.modello : attuali.modello,
        limite_minuto: Math.min(30, Math.max(1, Math.round(Number(nuove.limite_minuto) || attuali.limite_minuto))),
        limite_giorno: Math.min(1500, Math.max(1, Math.round(Number(nuove.limite_giorno) || attuali.limite_giorno))),
        temperatura: attuali.temperatura,
      };
      scrivi(CHIAVE_IMPOSTAZIONI, pulite);
      return pulite;
    },
    cancellaChiave() {
      scrivi(CHIAVE_IMPOSTAZIONI, { ...impostazioni(), chiave: "", attivo: false });
    },
    cancellaRacconti() {
      scrivi(CHIAVE_RACCONTI, { ordine: [], testi: {} });
    },

    /** Stato per la schermata Impostazioni (la chiave non esce mai in chiaro). */
    stato() {
      const i = impostazioni();
      return {
        attivo: i.attivo,
        ha_chiave: Boolean(i.chiave),
        chiave_mascherata: i.chiave ? `••••${i.chiave.slice(-4)}` : "",
        modello: i.modello,
        limite_minuto: i.limite_minuto,
        limite_giorno: i.limite_giorno,
        usate_oggi: contatore().richieste,
        racconti: archivio().ordine.length,
        ultimo_errore: ultimoErrore,
      };
    },
  };
}
