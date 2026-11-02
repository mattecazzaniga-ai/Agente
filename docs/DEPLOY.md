# Mettere BeachPick online (costo zero)

Gli account sono tuoi: io non posso crearli. Servono circa 30 minuti.

## 1. Supabase (database e login)
1. Crea un progetto gratuito su [supabase.com](https://supabase.com). Scegli la regione più vicina agli utenti, per esempio Europa.
2. Applica le migrazioni, in uno di questi due modi:
   - con la CLI: `supabase link --project-ref <ref>` e poi `supabase db push`;
   - dal *SQL Editor*: esegui in ordine i file di `supabase/migrations/`.
   **Non** caricare `seed.sql`: contiene dati inventati.
3. *Authentication → URL Configuration*:
   - *Site URL* = l'indirizzo Vercel (es. `https://beachpick.vercel.app`);
   - tra i *Redirect URLs* aggiungi `https://beachpick.vercel.app/**`.
4. *Authentication → Email Templates*: in "Magic Link" e "Confirm signup" incolla il contenuto di `supabase/templates/codice.html`. Il modello mostra il codice `{{ .Token }}` nelle 4 lingue.
5. *Authentication → SMTP*: l'email inclusa in Supabase manda pochissime email l'ora, quindi collega un SMTP gratuito.
   - Con Resend (3.000 email al mese) l'host è `smtp.resend.com`, porta 465, utente `resend`, password = la tua API key. Il mittente deve essere su un dominio verificato.
   - Dopo, alza il limite in *Rate Limits → emails*.
6. Google (facoltativo):
   - In Google Cloud Console crea un *OAuth client* di tipo "Web" con redirect `https://<ref>.supabase.co/auth/v1/callback`.
   - In Supabase vai su *Providers → Google* e incolla client id e client secret.
   - Su Vercel imposta `NEXT_PUBLIC_GOOGLE_ABILITATO=1`.

## 2. Vercel (hosting)
1. Importa il repository su [vercel.com](https://vercel.com) (piano Hobby).
2. Variabili d'ambiente (i valori sono in Supabase → *Project Settings → API*):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chiave anon/publishable)
   - `NEXT_PUBLIC_SITE_URL` = l'indirizzo pubblico, che serve per i link d'invito
   - `NEXT_PUBLIC_GOOGLE_ABILITATO` = `1` oppure `0`
3. Fai il deploy.

## 3. Primo admin
Registrati dall'app, poi esegui nel *SQL Editor* di Supabase:
```sql
update profili set is_admin = true where id = (select id from auth.users where email = 'tua@email.it');
```
Il link *Admin* compare nell'intestazione. Il pannello è in italiano; chi non è admin vede "pagina non trovata".

## Uso quotidiano dell'admin
1. *Tornei → + Nuovo torneo*: inserisci nome, luogo, circuito, date e l'ora del primo incontro (che chiude i pronostici sul vincitore).
2. *+ Aggiungi tabellone* (maschile, femminile o misto).
3. Copia la entry list o il tabellone dalla fonte ufficiale e incollala in *Importa*, insieme all'orario del primo turno e al formato.
4. A fine partita scrivi il punteggio dal lato della coppia A (`6-4` oppure `6-4 3-6 10-7`). I punti si calcolano subito e il vincitore passa al turno dopo; correggi l'orario della partita successiva se serve.
5. A fine torneo imposta lo stato *Concluso*: si calcolano i punti del vincitore e del finalista.
6. *Notizie*: fonte, link e, per ogni lingua che vuoi, un titolo e un riassunto **scritti da te** (al massimo 320 caratteri).
