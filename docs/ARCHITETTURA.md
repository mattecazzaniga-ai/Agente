# Beach Peck (nome provvisorio) — Architettura e schema

Web app mobile-first (PWA) di notizie e pronostici sul beach tennis, in italiano, portoghese brasiliano, spagnolo e inglese.
Obiettivo dell'MVP: capire se gli appassionati tornano ogni settimana. **Soglia di successo: 500 utenti attivi a settimana.**

> Gioco di pronostici gratuito, nessuna scommessa o vincita in denaro. Solo punti virtuali: niente denaro, premi o conversioni.

## 1. Stack (costo zero)

| Parte | Scelta | Perché |
|---|---|---|
| Frontend + server | **Next.js (App Router) + TypeScript + Tailwind** | pagine server-side veloci su telefono, Server Actions per le scritture, generazione immagini (`next/og`) inclusa |
| Database, login | **Supabase** (Postgres, Auth, RLS) | login email e Google, sicurezza nel database con Row Level Security |
| Lingue | **next-intl**, rotte `/it`, `/pt-BR`, `/es`, `/en` | rilevamento da `Accept-Language` + cookie con la scelta; testi in `messages/*.json` |
| Hosting | **Vercel** (piano Hobby) | deploy da GitHub, HTTPS, dominio `*.vercel.app` gratuito |
| PWA | `manifest.webmanifest` + service worker minimo | installabile sul telefono, guscio offline; niente notifiche push (fuori MVP) |

Limiti dei piani gratuiti da sapere:
- **Supabase Free**: 500 MB di database, 50.000 utenti attivi al mese per l'autenticazione. Il progetto **va in pausa dopo 7 giorni senza traffico**, cosa che con utenti settimanali non dovrebbe succedere.
- **Email di Supabase**: il servizio email incluso è pensato solo per le prove e manda pochissime email l'ora. Per i codici di login serve un SMTP gratuito (per esempio Resend, 3.000 email al mese, oppure Brevo, 300 al giorno): vedi [DEPLOY.md](DEPLOY.md).
- **Vercel Hobby**: è per uso personale e non commerciale. Va bene per un MVP senza ricavi; se arrivano ricavi si passa al piano Pro.

## 2. Pagine (rotte)

```
/[lingua]                    Home: prossimi tornei, partite su cui pronosticare, ultime notizie
/[lingua]/accedi             Login: Google oppure email con codice a 6 cifre (niente password)
/[lingua]/benvenuto          Onboarding (1 schermata): nickname + Paese
/[lingua]/tornei             Calendario: in programma / in corso / conclusi, filtro per circuito ITF/FIP/BR
/[lingua]/tornei/[id]        Torneo: tabelloni, pronostico vincitore + finalista, partite con pronostico
/[lingua]/classifica         Mensile: globale · mio Paese · le mie leghe (selettore del mese)
/[lingua]/leghe              Crea lega / entra con codice / le mie leghe
/[lingua]/leghe/[codice]     Invito diretto (link da condividere): entra con un tocco
/[lingua]/notizie            Elenco notizie (titolo, 3 righe, fonte, link all'originale)
/[lingua]/profilo            Nickname, Paese, lingua, esci, elimina account
/[lingua]/admin/...          Pannello admin: tornei, tabelloni, coppie, partite e risultati, giocatori, notizie, metriche
/api/immagine/pronostico     PNG 1080×1080 del proprio pronostico (la RLS lo mostra solo al proprietario)
/api/immagine/classifica     PNG della propria posizione (mese, globale/Paese/lega)
```

Ogni pagina mostra l'avviso legale nel piè di pagina, e la pagina dei pronostici lo mostra anche sopra.

**Flusso dei criteri di accettazione (meno di 2 minuti da telefono):**
1. Apri il link e la lingua è già quella giusta (si cambia con un tocco).
2. Tocca *Accedi con Google* oppure scrivi l'email e il codice.
3. Scegli nickname e Paese.
4. Si apre il torneo con un pulsante grande *Pronostica*: tocchi la coppia vincitrice e salvi.
5. Apri il link d'invito della lega, oppure scrivi il codice: sei dentro.
6. Vedi la classifica della lega.

## 3. Schema del database

File in `supabase/migrations/` (testati con `scripts/test-db.sh`):
- `20261102000000_schema.sql`: tabelle, regole, RLS, classifiche, leghe, notizie, metriche.
- `20261102010000_punti_rarita.sql`: punti pesati secondo la rarità, più `voti_partita` e `voti_tabellone`.
- `20261102020000_avanzamento.sql`: il vincitore passa da solo al turno successivo.
- `20261102030000_inviti.sql`: `lega_da_codice` (pagina d'invito) e `voti_del_torneo`.

```
auth.users ─1:1─ profili (nickname unico, paese ISO, lingua, is_admin)
                    │
tornei ─1:N─ tabelloni (maschile/femminile/misto) ─1:N─ coppie (2 giocatori) ── giocatori
                    │                                  │
                    └─1:N─ partite (turno R64…F, coppia A/B, inizio, set unico o al meglio dei 3,
                                    game per set, ritiro, vincitore)
profili ─1:N─ pronostici_torneo  (per tabellone: vincitore + finalista facoltativo)
profili ─1:N─ pronostici_partita (per partita: vincitore + set facoltativi + game totali facoltativi)
leghe (codice 6 caratteri) ─N:M─ profili  (leghe_membri)
notizie (fonte, link, stato) ─1:N─ notizie_traduzioni (it / pt-BR / es / en: titolo + riassunto ≤ 320 caratteri)
attivita (utente, giorno)  → utenti attivi a settimana
```

### Regole nel database (non aggirabili dal client)
- **Blocco dei pronostici.** Sul vincitore del torneo ci si chiude all'inizio del torneo (`tornei.inizio_at`, il primo incontro). Su una partita ci si chiude al suo inizio, ed è aperta solo quando entrambe le coppie sono note. Dopo il blocco non si può né modificare né cancellare.
- **Pronostici coerenti.** Le coppie scelte devono essere iscritte a quel tabellone o giocare quella partita, e il punteggio in set deve essere compatibile con il formato.
- **Risultati coerenti.** L'admin inserisce solo i game di ogni set (es. 6-4 3-6 10-7) e il database ricava il vincitore. In caso di ritiro basta indicare chi passa.
- **Punti calcolati dal database, pesati secondo la rarità** e ricalcolati da soli se l'admin corregge un risultato.
  - Il calcolo è `punti_rarita(base, voti_scelta, voti_totali, opzioni)`:
    - p = (voti per quell'esito + 1) / (voti totali + opzioni). Il +1 su ogni opzione evita gli estremi quando i voti sono pochi.
    - q = 1 / opzioni, cioè la quota "neutra".
    - moltiplicatore = √(q / p), limitato tra **0,5 e 2,5**.
    - punti = arrotondamento di base × moltiplicatore, con un minimo di 1.
  - Esempio: se il 90% sceglie i favoriti e vincono, chi li ha scelti prende circa la metà dei punti. Chi ha indovinato la sorpresa scelta dal 10% ne prende più del doppio. Indovinare resta sempre conveniente, e le percentuali da sole non regalano punti a chi sbaglia.
  - **Partita** (2 opzioni): vincitore giusto base **3**. Se il vincitore è giusto si aggiungono bonus fissi:
    - **+2** per i set esatti (solo al meglio dei 3);
    - **+3** per i game totali esatti, oppure **+1** se l'errore è di 2 game al massimo. Il super tie-break conta 1 game.
  - **Torneo** (opzioni = coppie del tabellone): vincitore base **10**, finalista base **5**. "Finalista" vuol dire la coppia che perde la finale.
  - Le percentuali di voto (`voti_partita`, `voti_tabellone`) si vedono solo dopo la chiusura, così nessuno copia la massa.
  - I punti entrano nella classifica del mese della partita, oppure del mese in cui finisce il torneo (mese UTC).
- **Avanzamento automatico.** Quando una partita si conclude, il vincitore della partita n entra nella partita ⌈n/2⌉ del turno successivo: coppia A se n è dispari, B se è pari. Se quella partita non c'è ancora, si crea, il giorno dopo alla stessa ora; l'admin poi corregge l'orario.
- **Classifica mensile.** C'è la funzione `classifica(mese, ambito, paese, lega)` (globale, per Paese, per lega) e la funzione `mia_posizione(...)`. Espongono solo i totali, così i pronostici dei singoli restano privati e nessuno li copia.
- **Leghe.** `crea_lega(nome)` genera un codice di 6 caratteri senza simboli ambigui (niente 0/O o 1/I); `unisciti_lega(codice)` ed `esci_lega`. La lega e la sua classifica le vede solo chi ne fa parte. Limiti: 10 leghe create per utente, 200 membri per lega.
- **Sicurezza.** Row Level Security su tutte le tabelle:
  - il calendario e le notizie pubblicate sono leggibili da tutti;
  - scrivono solo gli admin;
  - ogni utente vede e modifica solo i propri pronostici;
  - le colonne `punti`, `mese` e `is_admin` non sono scrivibili dagli utenti;
  - il primo admin si nomina dal pannello SQL di Supabase.
- **Misura dell'obiettivo.** A ogni visita il client chiama `segna_attivita()`, che scrive una riga per utente al giorno. `metriche_settimanali()`, solo per admin, restituisce per ogni settimana gli utenti attivi, i nuovi, quelli tornati dalla settimana prima e i pronostici fatti.
- **Privacy (GDPR/LGPD).** `elimina_account()` cancella l'utente e tutti i suoi dati. Si usano solo cookie tecnici (sessione e lingua), quindi niente banner per i cookie.

## 4. Lingue
- Interfaccia in 4 lingue (`it`, `pt-BR`, `es`, `en`). Alla prima visita la lingua si sceglie da `Accept-Language`, poi da un cookie. Il profilo ricorda la lingua scelta.
- Notizie: un titolo e un riassunto per lingua, scritti dall'admin. Se manca la lingua dell'utente si mostra un'altra lingua disponibile, con un'etichetta.
- Nomi di tornei e giocatori uguali in tutte le lingue. Date e ore nel fuso orario e nel formato del telefono (`Intl`).

## 5. Importazione dei tabelloni (senza scraping)
Chiedere al codice di "prendere da solo" tabelloni e partite ITF vorrebbe dire fare scraping del sito ITF. Il sito non ha un'API pubblica per questi dati e i suoi termini d'uso lo vietano, oltre al vincolo del progetto "dati inseriti a mano". Quindi l'admin copia la entry list o il tabellone dalla fonte ufficiale e li **incolla** nel pannello: il resto lo fa l'app.
- Righe accettate (una coppia per riga, nell'ordine del tabellone):
  - `1. Andrea Ricci (ITA) / Paolo Neri (ITA)`
  - `RICCI Andrea ITA / NERI Paolo ITA`
  - `Ricci, Andrea – Neri, Paolo`
  - CSV `nome;cognome;paese;nome;cognome;paese;tds`
  - `BYE`
- Codici Paese ITF a 3 lettere convertiti in ISO (`lib/paesi.ts`). I giocatori già presenti (stesso nome, cognome e Paese) si riusano.
- Dimensione del tabellone: la potenza di 2 successiva, fino a 64. Si crea il primo turno; chi ha il BYE passa al turno dopo.
- Se il primo turno comincia prima di `tornei.inizio_at`, la chiusura dei pronostici sul torneo si anticipa.
- Codice: `lib/importa.ts` (testato in `tests/importa.test.ts`) e `importaTabellone` in `app/[locale]/admin/azioni.ts`.

## 6. Struttura del codice
```
app/[locale]/                pagine (Server Components): home, tornei, torneo, classifica, leghe, invito, notizie, profilo, privacy
app/[locale]/azioni.ts       Server Actions degli utenti (accesso, profilo, pronostici, leghe)
app/[locale]/admin/          pannello admin (solo italiano) + admin/azioni.ts
app/api/immagine/            immagini di condivisione (next/og, senza font o emoji esterni)
app/auth/callback/           ritorno dal login Google
components/                  UI: SchedaPartita, PronosticoPartita, PronosticoTorneo, Condividi, Invita, ...
lib/dati.ts                  letture dal database per le pagine
lib/importa.ts, punteggio.ts lettura di entry list e punteggi scritti dall'admin
messages/{it,pt-BR,es,en}.json   testi dell'interfaccia
public/                      manifest, service worker, pagina offline, icone (scripts/icone.mjs)
supabase/migrations/         schema SQL versionato; supabase/seed.sql = dati inventati per lo sviluppo
supabase/tests/              test dello schema (Postgres locale)
tests/                       unit (vitest) ed e2e (Playwright)
```

## 7. Fuori dall'MVP (non si fa)
Pagamenti, abbonamenti, chat, notifiche push native, app iOS/Android, live score, API o scraping di dati esterni.
