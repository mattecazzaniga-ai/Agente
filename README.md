# Dinastia

Simulatore di vita multi-generazionale ambientato nell'Italia di oggi. Gioco personale, gratuito, giocabile dal telefono e offline.
Solo HTML, CSS e JavaScript (moduli ES): niente framework, niente backend, niente account.

**Stato: FASI 1-8 completate.** Una dinastia intera: si parte da un bambino di 6 anni, si studia, si lavora, ci si innamora, si fanno figli, si manda avanti (o si fonda) l'azienda di famiglia; alla morte si sceglie un erede e la storia continua, generazione dopo generazione. L'albero genealogico è in SVG e si possono guidare fino a 4 persone della famiglia insieme.

## Come si gioca

- **Vita**: ogni anno arrivano 1-3 eventi per il personaggio principale (e fino a 2 per ogni altro personaggio controllato). Si sceglie, oppure si lascia decidere al carattere. Poi *Vivi l'anno*.
- **Soldi**: patrimonio, bilancio dell'anno (tasse, casa, figli, assegni), case, azienda, grafico negli anni.
- **Famiglia**: albero genealogico. Tocca una persona per vederla; da lì puoi **giocare come lei** (FASE 3) o **controllarla insieme** al principale (FASE 4, massimo 4 persone dai 6 anni in su).
- **L'Italia cambia**: crisi, riprese, caro vita, pandemie, automazione di alcuni mestieri e riforme delle pensioni arrivano nel corso dei decenni. Si leggono in *Dall'Italia* nel riassunto dell'anno e pesano su lavoro, prezzi, case e aziende.
- **Traguardi**: in *Famiglia → Traguardi* (prima laurea, centenario, quinta generazione, nozze d'oro, primo milione, azienda storica…) e *La dinastia in numeri*, con il patrimonio di famiglia negli anni.
- **Morte**: quando muore il personaggio principale scegli chi continua: figli, nipoti, fratelli, chi già controllavi. Se non resta nessuno della famiglia, la dinastia si estingue.

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

## Narratore AI (facoltativo, FASE 5)

Il gioco funziona benissimo senza AI. Con una chiave Gemini (piano gratuito) l'AI:
- **inventa nuovi eventi**, con situazione, domanda e 2-3 scelte, adatti all'età e alla vita del personaggio (opzione *L'AI inventa anche gli eventi*, attiva di base). Compaiono come *Imprevisto ✦*;
- **riscrive** i testi degli eventi della libreria, scrive il riassunto dell'anno e l'epitaffio.

Per attivarla:

1. Vai su [Google AI Studio](https://aistudio.google.com) → *Get API key* e crea una chiave (gratis).
2. Nel gioco: *Impostazioni → Narratore AI*, spunta *Usa il narratore AI*, incolla la chiave, *Salva*, poi *Prova*.
3. I testi riscritti hanno un piccolo ✦ alla fine.

Regole del narratore (`js/ai.js`):
- **L'AI scrive, il gioco decide i numeri**. Per ogni scelta di un evento inventato l'AI indica soltanto un *tipo* preso da `data/profili_ai.json` (prudente, coraggiosa, spesa grande, cura della salute, nuova relazione, cambia lavoro…). Gli effetti di ogni tipo (soldi, salute, morale, relazioni) sono scritti in quel file e li applica il motore. Le scommesse le decide il dado del motore, con il seed della partita. I tipi vengono offerti solo quando hanno senso: niente *cambia lavoro* a chi non lavora, niente *nuova relazione* a chi è in coppia. Tipi inventati, testi senza scelte valide o con numeri che non c'erano vengono scartati.
- **Quando arrivano gli eventi inventati**: l'AI prepara gli eventi dell'anno dopo mentre giochi quello in corso. A inizio anno prendono il posto di quasi tutti gli eventi casuali della libreria, mentre quelli di passaggio (scuola, università…) restano. Se non sono pronti, l'anno usa la libreria e l'evento dell'AI si aggiunge appena arriva. Per risparmiare richieste valgono solo per il personaggio principale.
- **Per aggiungere un tipo di scelta** basta una voce in `data/profili_ai.json` (stesse chiavi di effetti e condizioni degli eventi); `npm test` la controlla.
- **La chiave resta nel tuo browser**: è salvata in `localStorage` sotto `dinastia.ai`, separata dalla partita. Non è nel codice, non entra nel salvataggio né nel file esportato, e viaggia solo verso Google nell'intestazione `x-goog-api-key`. *Cancella la chiave* la rimuove.
- **Una richiesta alla volta**: coda unica, pausa minima tra le richieste (limite al minuto) e contatore giornaliero, entrambi modificabili (predefiniti: 6 al minuto, 100 al giorno). Dopo un errore 429 aspetta un minuto.
- **Ripiego sui testi del gioco**: se manca la chiave, se si superano i limiti, se Gemini non risponde entro 20 secondi o se la risposta non è un JSON valido, si usa il testo della libreria.
- I testi già raccontati restano in archivio (`dinastia.racconti`, ultimi 300): riaprendo lo stesso evento non si spende un'altra richiesta.
- Modello predefinito: `gemini-2.5-flash`, modificabile.
- Attenzione: su GitHub Pages tutti i tuoi siti `https://<utente>.github.io/...` condividono lo stesso `localStorage`, quindi uno script di un altro tuo sito potrebbe leggere la chiave. Usa una chiave dedicata al gioco e, se vuoi, limitala in Google Cloud Console (*Credenziali → Restrizioni per siti web*) all'indirizzo del gioco.
- A Gemini arrivano solo il testo dell'evento e qualche dato del personaggio: nome, età, città, carattere, ultimi fatti.

## Test e simulazioni

```bash
npm test               # test del motore in Node (node:test, nessuna dipendenza)
npm run simula         # 100 vite automatiche + 20 dinastie di 200 anni: età di morte, patrimonio, figli, separazioni, mestieri
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
  economy.js     stipendi, tasse, spese del nucleo, assegni, mutui, case affittate, inflazione, eredità
  dinastia.js    coppie, figli ed ereditarietà dei tratti, vita privata automatica, candidati erede
  albero.js      disposizione dell'albero genealogico (funzione pura)
  mondo.js       l'Italia che cambia: congiunture, tendenze dei settori, età della pensione (FASE 6)
  traguardi.js   traguardi e storia della dinastia (FASE 7)
  family.js      persone, relazioni, parentele
  azioni.js      azioni di vita (iscriversi, essere assunti, comprare casa, azienda di famiglia…)
  vista.js       dati pronti per le schermate (funzioni pure, testate)
  ai.js          narratore AI Gemini (FASE 5): coda, limiti, convalida, archivio dei testi
  eventi_ai.js   trasforma le proposte dell'AI in eventi veri, con gli effetti dei profili (funzione pura)
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

- **Testi**: segnaposto `{nome} {citta} {regione} {madre} {padre} {fratello} {genitore} {lavoro} {scuola} {facolta} {eta} {partner} {figlio_nome}` (il figlio più piccolo) `{figlio_maggiore} {ultimo_figlio}` e di genere `{o}` (o/a), `{o_figlio}`, `{o_partner}`, `{lui}`, `{nonno_g}`, `{genitore_g}` (vedi `genere()` e `segnaposto()` in `js/family.js`).
- **Condizioni** (tutte facoltative): `eta [min,max]`, `sesso`, `livello`, `iscritto`, `indirizzo`, `facolta`, `titolo`, `titolo_min`, `voti_min/max`, `lavoro` (true/false/lista di id), `settore`, `pensionato`, `risparmi_min/max`, `debiti_min`, `soldi_famiglia_min`, `tratti_richiesti/esclusi`, `ricordi_richiesti/esclusi`, `flag`, `flag_esclusi`, `vive_con_genitori`, `genitori_insieme`, `genitori_vivi`, `fratelli`, `agiatezza`, `area`, `azienda_famiglia`, `casa_raggiungibile`, `stat_min/max`, `relazione_min/max` (`{ "con": "madre", "valore": 30 }`; `con` può essere `madre padre genitore fratello partner figlio figlio_maggiore`). Vita di coppia e figli: `stato_civile` (single, fidanzato, convivente, sposato, separato, vedovo), `coppia`, `anni_coppia_min`, `fertile`, `figli_min/max`, `figlio_eta` (età del più piccolo), `figli_adulti`, `nipoti`, `genitore_eta_min`. Azienda: `titolare`, `in_azienda`, `genitore_titolare`, `azienda_salute_min/max`.
- **Effetti**: statistiche (`salute morale felicita stanchezza reputazione`), `risparmi`, `debiti`, `risparmi_famiglia`, `voti`, `reputazione_famiglia`, `superiori`, `indirizzo`, `universita`, `fuori_sede`, `lascia_studi`, `lavoro` (id o `"casuale"`), `part_time`, `licenziato`, `bonus`, `trasloco`, `trasferimento` (id regione), `compra_casa` (`true` o `"con_famiglia"`), `tratto`, `tratto_rimuovi`, `ricordo`, `flag`, `flag_rimuovi`, `relazione`. Coppia e figli: `partner: "nuovo"`, `convivenza`, `matrimonio`, `separazione`, `figlio` (nasce un bambino), `al_figlio` (`{ "voti": 0.5, "morale": 3, "risparmi": 2000, "tratto": "sicuro" }` sul figlio più piccolo), `riduci_lavoro`, `torna_tempo_pieno`, `accogli_genitore`. Azienda: `entra_azienda`, `rileva_azienda`, `cedi_azienda`, `vendi_azienda`, `fonda_azienda` (euro investiti), `azienda` (`{ "salute": 10, "crescita": 0.1, "valore": 5000 }`). Casa: `casa_valore`.
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
- **Eredità**: successione legittima semplificata (coniuge e figli secondo il codice civile; senza di loro genitori, poi fratelli); se i debiti superano i beni gli eredi rinunciano. L'azienda va al figlio che ci lavora, altrimenti al maggiore. Niente tasse di successione (in Italia sono basse sotto 1 milione per figlio).
- **Aziende di famiglia**: fatturato e margine per settore, utile al titolare come reddito autonomo; anni cattivi consecutivi possono portare al fallimento.
- **Figli**: spese per nido (0-2 anni) e scuola dell'infanzia (3-5), assegno unico di 1.800 € l'anno per figlio minorenne (senza ISEE). Cognome paterno.
- **Welfare**: assegno di inclusione per i nuclei sotto la soglia di povertà (9.360 € l'anno per adulto, scala di equivalenza), integrazione massima 6.500 € l'anno per adulto.
- **Sovraindebitamento**: chi ha più di 40.000 € di debiti e oltre due anni di reddito ottiene l'esdebitazione (debito ridotto a metà di un anno di reddito, perde reputazione), al massimo una volta ogni 8 anni. Prima vende le case dove non vive.
- **Case vuote**: una casa di proprietà dove non vive nessuno viene affittata (3,5% del valore all'anno, cedolare secca 21%); l'affitto paga mutuo e spese.
- **Separazione**: se ne va chi non è proprietario della casa, altrimenti l'uomo; i figli minorenni restano con la madre; l'altro genitore versa il mantenimento (12% del netto per figlio, massimo 30%).
- **Congiunture**: modificatori semplici e uguali per tutta Italia (niente differenze regionali nelle crisi); l'età della pensione sale a caso dopo il 2030, fino a 71.
- **Minorenni**: non fanno debiti; se spendono più di quanto hanno, pagano i genitori.
- **Pensione anticipata**: dai 61 anni, con il 12% in meno sull'assegno.
- **Salute e mortalità**: curva di Gompertz calibrata sull'Italia (età media alla morte circa 81-83 anni nelle simulazioni), corretta da salute, sesso e malattie croniche.

## Fasi

1. ✅ **Una vita**: generatore, stato, schermate Vita/Soldi/Famiglia/Impostazioni, 51 eventi, salvataggi, test.
2. ✅ **Dinastia**: partner, convivenza, matrimonio, separazione, figli (tratti e cicatrici ereditati, a volte sorprendono), azienda di famiglia giocabile (entrare, rilevare, investire, cedere, vendere, fondarne una), eredità ed erede, reputazione del cognome. 91 eventi in totale.
3. ✅ **Albero e cambio personaggio**: albero genealogico in SVG, scheda di ogni parente, *Gioca come…*.
4. ✅ **Più personaggi**: fino a 4 persone controllate, coda di eventi per persona, *Lascia decidere al carattere*.
5. ✅ **AI**: Gemini inventa eventi (domande e scelte) e riscrive testi, riassunti ed epitaffi; i numeri restano del gioco tramite i tipi di scelta; chiave solo nel browser, coda, limiti, convalida, ripiego sui testi del gioco.
6. ✅ **L'Italia che cambia** (`data/mondo.json`): congiunture decise dal seed (recessione ~13% degli anni, ripresa, caro vita, pandemia) con effetti su licenziamenti, assunzioni, salari, inflazione, case, aziende e mortalità degli anziani; tendenze di lungo periodo (automazione di logistica, uffici e trasporti, carenza di personale sanitario); età della pensione che sale fino a 71 anni; notizie anno per anno; condizioni `congiuntura`, `anno_min` e `settore_escluso` per gli eventi.
7. ✅ **Traguardi e statistiche** (`data/traguardi.json`): 20 traguardi verificati ogni anno, la dinastia in numeri e il grafico del patrimonio di famiglia.
8. ✅ **Più eventi**: 26 nuovi (cassa integrazione, caro bollette, lockdown, concorso pubblico, partita IVA, lavoro all'estero, bonus casa, alluvione, terremoto, elezioni, patente, primo telefono, liste d'attesa, servizio civile, pensione anticipata…). In totale 117 eventi in libreria, più quelli inventati dall'AI.

### Comportamento della dinastia nelle simulazioni (`npm run simula`)
Vite: età media alla morte ~82 anni, circa 1,2 figli a testa, 29% senza figli, 23% dei matrimoni finisce in separazione, debiti oltre 10.000 € a 40 anni per l'8%. Dinastie (200 anni, si continua sempre col primo candidato): circa 1 su 4 si estingue, in media si arriva alla 4ª-5ª generazione. Il salvataggio resta sotto 1 MB anche dopo 200 anni (i morti vengono archiviati).
