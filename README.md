# Dinastia

Simulatore di vita multi-generazionale ambientato nell'Italia di oggi. Gioco personale, gratuito, giocabile dal telefono e offline.
Solo HTML, CSS e JavaScript (moduli ES): niente framework, niente backend, niente account.

**Stato: FASE 1 completata.** Una vita intera: dalla prima elementare alla morte, con scuola, università, lavoro, casa e soldi.

## Avviare il gioco

I moduli ES non funzionano aprendo `index.html` con doppio clic (`file://`): serve un piccolo server locale.

```bash
npm run avvia          # oppure: python3 -m http.server 8080
# poi apri http://localhost:8080
```

### Sul telefono, con GitHub Pages (consigliato)
1. Su GitHub: *Settings → Pages → Build and deployment → Deploy from a branch*, scegli il ramo e la cartella `/ (root)`.
2. Dopo un minuto il gioco è su `https://<utente>.github.io/<repo>/`.
3. Aprilo dal telefono e installalo: su **Android/Chrome** menu ⋮ → *Installa app*; su **iPhone/Safari** Condividi → *Aggiungi alla schermata Home*.
4. Dopo la prima apertura funziona anche senza rete.

### Sul telefono, in rete locale
Avvia `npm run avvia` sul computer e apri `http://<IP-del-computer>:8080` dal telefono (stessa Wi-Fi). Il service worker e l'installazione richiedono HTTPS, quindi in questo modo il gioco va ma non si installa: per l'installazione usa GitHub Pages.

## Test e simulazioni

```bash
npm test               # test del motore in Node (node:test, nessuna dipendenza)
npm run simula         # 100 vite automatiche: età di morte, patrimonio, mestieri, studi
node tools/simula.mjs 500 7   # 500 vite partendo dal seed 7
node tools/make-icons.mjs     # rigenera le icone PNG
```

## Struttura

```
index.html, css/style.css, manifest.webmanifest, sw.js (offline), icons/
js/
  main.js        avvio, navigazione, salvataggio automatico (unico punto che tocca il DOM e il motore insieme)
  state.js       stato unico, versione dello schema, migrazioni, salva/carica/esporta/importa
  rng.js         numeri casuali deterministici (seed nello stato)
  data.js        caricamento dei JSON
  generator.js   prima famiglia (tabelle pesate per regione)
  engine.js      turno annuale: eventi → scuola/lavoro/salute → economia → morti ed eredità
  events.js      condizioni, scelta degli eventi, effetti, conseguenze a distanza
  economy.js     stipendi, tasse, spese del nucleo, mutui, inflazione, eredità
  family.js      persone e relazioni
  azioni.js      azioni di vita (iscriversi, essere assunti, comprare casa…)
  vista.js       dati pronti per le schermate (funzioni pure, testate)
  ai.js          narratore AI (FASE 5, oggi spento)
  ui/            una schermata per file: solo HTML, nessuna regola
data/            tutti i numeri e i testi: regioni, nomi, mestieri, scuole, tratti, generatore, eventi
tests/           test Node
tools/           simulazione di massa, icone
```

Regola d'oro: **i numeri e la logica li decide il codice**, in modo deterministico (stesso seed + stesse scelte = stessa partita). L'AI, quando arriverà, potrà solo raccontare.

## Aggiungere eventi

Gli eventi stanno in `data/events/<tema>.json` (elencati in `data/events/index.json`). Basta aggiungere un oggetto nell'array `eventi`:

```json
{
  "id": "lavoro_trasferta",
  "tema": "lavoro",
  "titolo": "Una trasferta a Milano",
  "condizioni": { "eta": [25, 50], "lavoro": true },
  "peso": 3,
  "ripetibile": false,
  "tratti_affini": ["ambizioso"],
  "testi": ["Il capo ti propone sei mesi nella sede di Milano.", "Variante: un altro testo per lo stesso evento."],
  "scelte": [
    {
      "id": "a",
      "testo": "Accetti",
      "tratti_favoriti": ["ambizioso", "indipendente"],
      "tratti_sfavoriti": ["solitario"],
      "requisiti": { "stat_min": { "salute": 40 } },
      "effetti": { "stanchezza": 10, "bonus": 0.05, "risparmi": 1500 },
      "esito": "Sei mesi intensi. Il capo se lo ricorderà.",
      "conseguenze": [{ "evento": "lavoro_promozione_dopo_trasferta", "dopo_anni": 2, "probabilita": 0.5 }]
    },
    { "id": "b", "testo": "Rifiuti", "effetti": { "morale": 3 } }
  ]
}
```

- **Testi**: segnaposto `{nome} {citta} {regione} {madre} {padre} {fratello} {genitore} {lavoro} {scuola} {facolta} {eta}` e di genere `{o}` (o/a), `{lui}`, ecc. (vedi `genere()` in `js/family.js`).
- **Condizioni** (tutte facoltative): `eta [min,max]`, `sesso`, `livello`, `iscritto`, `indirizzo`, `facolta`, `titolo`, `titolo_min`, `voti_min/max`, `lavoro` (true/false/lista di id), `settore`, `pensionato`, `risparmi_min/max`, `debiti_min`, `soldi_famiglia_min`, `tratti_richiesti/esclusi`, `ricordi_richiesti/esclusi`, `flag`, `flag_esclusi`, `vive_con_genitori`, `genitori_insieme`, `genitori_vivi`, `fratelli`, `agiatezza`, `area`, `azienda_famiglia`, `casa_raggiungibile`, `stat_min/max`, `relazione_min/max` (`{ "con": "madre", "valore": 30 }`).
- **Effetti**: statistiche (`salute morale felicita stanchezza reputazione`), `risparmi`, `debiti`, `risparmi_famiglia`, `voti`, `reputazione_famiglia`, `superiori`, `indirizzo`, `universita`, `fuori_sede`, `lascia_studi`, `lavoro` (id o `"casuale"`), `part_time`, `licenziato`, `bonus`, `trasloco`, `trasferimento` (id regione), `compra_casa` (`true` o `"con_famiglia"`), `tratto`, `tratto_rimuovi`, `ricordo`, `flag`, `flag_rimuovi`, `relazione`.
- Gli importi sono in **euro del 2026**: il motore li adegua all'inflazione.
- `obbligatorio: true` = evento di passaggio che arriva sempre quando le condizioni sono vere (es. scelta delle superiori). Un evento senza `peso` e richiamato solo da `conseguenze` è una conseguenza a distanza.
- Le persone non giocate scelgono da sole in base a `tratti_favoriti`/`tratti_sfavoriti`.
- `npm test` controlla che ogni evento sia valido (id unici, testi e scelte presenti, riferimenti validi, conseguenze raggiungibili). Dopo aver aggiunto file, aggiungili anche a `sw.js` (il test lo verifica) e aumenta `VERSIONE` in `sw.js`.

## Salvataggi

- Salvataggio automatico in `localStorage` a ogni scelta (chiave `dinastia.salvataggio`).
- *Impostazioni → Esporta* scarica un file JSON; *Importa* lo ricarica (anche su un altro dispositivo).
- Ogni salvataggio ha il numero di `schema`. Se lo schema cambia: aumenta `VERSIONE_SCHEMA` in `js/state.js` e aggiungi una funzione in `MIGRAZIONI` che trasforma la versione N nella N+1. I file vecchi vengono aggiornati all'apertura.

## Semplificazioni economiche (volute)

Valori di partenza realistici per il 2026, ma il modello è semplice di proposito:

- **Stipendi**: RAL per mestiere tra un minimo d'ingresso e un massimo a 25 anni di anzianità, moltiplicata per un coefficiente regionale. Niente contratti nazionali, tredicesime, straordinari.
- **Tasse**: IRPEF a tre scaglioni (23% fino a 28.000 €, 35% fino a 50.000 €, 43% oltre) con una detrazione da lavoro semplificata; contributi INPS 9,19% per i dipendenti e 24% per gli autonomi; addizionali regionali e comunali forfettarie al 2%. Niente ISEE, bonus, 730, cuneo fiscale, regimi forfettari.
- **Spese**: costo della vita base per una persona × coefficiente regionale × scala di equivalenza OCSE del nucleo. I consumi si adattano al reddito (chi ha poco taglia fino al 40%). Affitto annuo per regione e grandezza della città.
- **Casa**: prezzo al m² per regione (appartamento di 80 m²; più caro nelle grandi città). Anticipo del 24% (20% + spese notarili e d'agenzia), mutuo a tasso fisso del 3,5% in 25 anni. Manutenzione e condominio 0,6% del valore all'anno. Rivalutazione con l'inflazione più un piccolo rumore.
- **Inflazione** intorno al 2% l'anno; gli stipendi seguono i prezzi. Le statistiche mostrano anche il valore "in euro del 2026".
- **Debiti**: interesse unico all'8% per i debiti al consumo; ogni anno il nucleo ne rimborsa una parte.
- **Disoccupazione**: NASpI semplificata (60% del lordo per due anni). Chi resta senza soldi può tornare dai genitori.
- **Pensione** a 67 anni, 65% dell'ultimo stipendio con almeno 20 anni di lavoro, altrimenti assegno sociale; rivalutata con l'inflazione.
- **Eredità**: successione legittima semplificata (coniuge e figli secondo il codice civile); se i debiti superano i beni gli eredi rinunciano. Niente tasse di successione (in Italia sono basse sotto 1 milione per figlio).
- **Aziende di famiglia**: fatturato e margine per settore, utile al titolare come reddito autonomo; anni cattivi consecutivi possono portare al fallimento.
- **Salute e mortalità**: curva di Gompertz calibrata sull'Italia (età media alla morte circa 81-83 anni nelle simulazioni), corretta da salute, sesso e malattie croniche.

## Fasi

1. ✅ **Una vita**: generatore, stato, schermate Vita/Soldi/Famiglia/Impostazioni, 51 eventi, salvataggi, test.
2. Partner, figli, età adulta piena, azienda di famiglia giocabile, eredità e continuazione con un erede.
3. Albero genealogico in SVG e cambio del personaggio controllato.
4. Più personaggi controllati insieme, con coda di eventi.
5. Narratore AI (Gemini, piano gratuito): chiave inserita in Impostazioni e salvata solo nel browser, coda di richieste, limite giornaliero, ritorno ai testi della libreria se qualcosa va storto.
