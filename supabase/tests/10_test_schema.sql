-- Test dello schema: permessi, blocco dei pronostici, calcolo dei punti, classifiche, leghe, notizie.
-- Si esegue con scripts/test-db.sh su un Postgres locale (dopo 00_finto_supabase.sql e le migrazioni).
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null

create schema prova;
grant usage on schema prova to anon, authenticated;

/** Imposta l'utente "collegato" (come fa Supabase con il token). */
create function prova.come(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false)
$$;

create function prova.ok(condizione boolean, messaggio text) returns void language plpgsql as $$
begin
  if condizione is not true then raise exception 'TEST FALLITO: %', messaggio; end if;
end $$;

/** La query deve fallire con un messaggio che contiene `frammento`. */
create function prova.errore(q text, frammento text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if position(lower(frammento) in lower(sqlerrm)) = 0 then
      raise exception 'TEST FALLITO: errore inatteso per [%]: %', q, sqlerrm;
    end if;
    return;
  end;
  raise exception 'TEST FALLITO: doveva dare errore: %', q;
end $$;

grant execute on all functions in schema prova to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Utenti: alla registrazione nasce il profilo
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.com', '{"lingua":"it"}'),
  ('00000000-0000-0000-0000-000000000001', 'u1@example.com', '{"lingua":"it"}'),
  ('00000000-0000-0000-0000-000000000002', 'u2@example.com', '{"lingua":"pt-BR"}'),
  ('00000000-0000-0000-0000-000000000003', 'u3@example.com', '{"lingua":"xx"}');
select prova.ok((select count(*) from profili) = 4, 'un profilo per ogni utente');
select prova.ok((select lingua from profili where id = '00000000-0000-0000-0000-000000000002') = 'pt-BR', 'lingua dalla registrazione');
select prova.ok((select lingua from profili where id = '00000000-0000-0000-0000-000000000003') = 'it', 'lingua sconosciuta → it');
-- il primo admin si nomina dal pannello SQL (nessun utente collegato)
update profili set is_admin = true where id = '00000000-0000-0000-0000-00000000000a';

-- ---------------------------------------------------------------------------
-- Profilo: ognuno cambia il proprio, nessuno si fa admin da solo
-- ---------------------------------------------------------------------------
select prova.come('00000000-0000-0000-0000-000000000001');
set role authenticated;
update profili set nickname = 'Marco_BT', paese = 'IT', profilo_completo = true where id = auth.uid();
select prova.ok((select nickname from profili where id = auth.uid()) = 'Marco_BT', 'nickname aggiornato');
select prova.errore($$update profili set is_admin = true where id = auth.uid()$$, 'permission denied');
update profili set nickname = 'Hacker' where id = '00000000-0000-0000-0000-000000000002'; -- RLS: nessuna riga
select prova.ok((select nickname from profili where id = '00000000-0000-0000-0000-000000000002') <> 'Hacker', 'non modifico il profilo di altri');
select prova.errore($$update profili set nickname = 'ab' where id = auth.uid()$$, 'check');
reset role;

select prova.come('00000000-0000-0000-0000-000000000002');
set role authenticated;
update profili set nickname = 'Joana', paese = 'BR' where id = auth.uid();
select prova.errore($$update profili set nickname = 'marco_bt' where id = auth.uid()$$, 'duplicate'); -- unico senza maiuscole/minuscole
reset role;
select prova.come('00000000-0000-0000-0000-000000000003');
set role authenticated;
update profili set nickname = 'Luca', paese = 'IT' where id = auth.uid();
reset role;

-- ---------------------------------------------------------------------------
-- Dati sportivi: solo l'admin scrive, tutti leggono
-- ---------------------------------------------------------------------------
select prova.come(null);
set role anon;
select prova.errore($$insert into tornei (nome, luogo, circuito, data_inizio, data_fine, inizio_at) values ('X torneo', 'Roma', 'ITF', now(), now(), now())$$, 'row-level security');
reset role;
select prova.come('00000000-0000-0000-0000-000000000001');
set role authenticated;
select prova.errore($$insert into giocatori (nome, cognome) values ('Pi', 'Rata')$$, 'row-level security');
reset role;

select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into giocatori (id, nome, cognome, paese, sesso) values
  ('10000000-0000-0000-0000-000000000001', 'Andrea', 'Ricci', 'IT', 'M'),
  ('10000000-0000-0000-0000-000000000002', 'Paolo', 'Neri', 'IT', 'M'),
  ('10000000-0000-0000-0000-000000000003', 'João', 'Silva', 'BR', 'M'),
  ('10000000-0000-0000-0000-000000000004', 'Pedro', 'Costa', 'BR', 'M'),
  ('10000000-0000-0000-0000-000000000005', 'Luis', 'García', 'ES', 'M'),
  ('10000000-0000-0000-0000-000000000006', 'Marc', 'Puig', 'ES', 'M'),
  ('10000000-0000-0000-0000-000000000007', 'Tom', 'Dupont', 'FR', 'M'),
  ('10000000-0000-0000-0000-000000000008', 'Hugo', 'Martin', 'FR', 'M');
insert into tornei (id, nome, luogo, paese, circuito, categoria, data_inizio, data_fine, inizio_at) values
  ('20000000-0000-0000-0000-000000000001', 'Torneo di prova', 'Ravenna', 'IT', 'ITF', 'BT200', current_date, (now() - interval '1 hour')::date + 1, now() + interval '2 days');
insert into tabelloni (id, torneo_id, genere) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'maschile'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'femminile');
insert into coppie (id, tabellone_id, giocatore1_id, giocatore2_id, testa_di_serie) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 1),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', 2),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006', null),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000008', null),
  -- una coppia di un altro tabellone, per i test
  ('40000000-0000-0000-0000-000000000099', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', null);
select prova.errore($$insert into coppie (tabellone_id, giocatore1_id, giocatore2_id) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001')$$, 'duplicate');
insert into partite (id, tabellone_id, turno, ordine, coppia_a_id, coppia_b_id, inizio_at, set_per_vincere) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'SF', 1, '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', now() + interval '2 days', 1),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'SF', 2, '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', now() + interval '2 days', 1),
  ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'F', 1, null, null, now() + interval '3 days', 2);
select prova.errore($$insert into partite (tabellone_id, turno, coppia_a_id, coppia_b_id, inizio_at) values ('30000000-0000-0000-0000-000000000001', 'QF', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000099', now())$$, 'stesso tabellone');
reset role;

select prova.come(null);
set role anon;
select prova.ok((select count(*) from tornei) = 1 and (select count(*) from partite) = 3, 'gli anonimi leggono il calendario');
reset role;

-- ---------------------------------------------------------------------------
-- Pronostici: aperti fino all'inizio, coppie valide, niente punti scritti dall'utente
-- ---------------------------------------------------------------------------
select prova.come('00000000-0000-0000-0000-000000000001');
set role authenticated;
insert into pronostici_torneo (tabellone_id, vincitore_id, finalista_id) values ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002');
select prova.errore($$insert into pronostici_torneo (tabellone_id, vincitore_id) values ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002')$$, 'duplicate');
select prova.errore($$update pronostici_torneo set punti = 100$$, 'permission denied');
select prova.errore($$insert into pronostici_torneo (tabellone_id, vincitore_id) values ('30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001')$$, 'iscritte');
-- regolamento: vincitore + risultato dei set + game previsti, coerenti tra loro
select prova.errore($$insert into pronostici_partita (partita_id, vincitore_id, set_vincitore, set_perdente, game_previsti_a, game_previsti_b) values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 1, 0, 6, 5)$$, 'non possibili');
select prova.errore($$insert into pronostici_partita (partita_id, vincitore_id, game_previsti_a, game_previsti_b) values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 6, 4)$$, 'risultato dei set');
select prova.ok(game_possibili(2, 0, 12, 8) and game_possibili(2, 1, 10, 10) and not game_possibili(2, 0, 7, 10) and not game_possibili(2, 1, 15, 3), 'game possibili per 2-0 e 2-1');
insert into pronostici_partita (partita_id, vincitore_id, set_vincitore, set_perdente, game_previsti_a, game_previsti_b) values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 1, 0, 6, 4);
select prova.errore($$insert into pronostici_partita (partita_id, vincitore_id, set_vincitore, set_perdente) values ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 2, 0)$$, 'formato');
select prova.errore($$insert into pronostici_partita (partita_id, vincitore_id) values ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001')$$, 'due coppie');
select prova.errore($$insert into pronostici_partita (partita_id, vincitore_id) values ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001')$$, 'chiusi'); -- finale senza coppie
select prova.ok((select count(*) from voti_partita('50000000-0000-0000-0000-000000000001')) = 0, 'percentuali nascoste finché si può votare');
select prova.ok((select count(*) from voti_tabellone('30000000-0000-0000-0000-000000000001')) = 0, 'percentuali del torneo nascoste');
-- cambiare idea prima dell'inizio si può
update pronostici_torneo set finalista_id = '40000000-0000-0000-0000-000000000002' where utente_id = auth.uid();
reset role;

select prova.come('00000000-0000-0000-0000-000000000002');
set role authenticated;
insert into pronostici_torneo (tabellone_id, vincitore_id, finalista_id) values ('30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001');
insert into pronostici_partita (partita_id, vincitore_id, totale_game) values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 11);
select prova.ok((select count(*) from pronostici_torneo) = 1, 'vedo solo i miei pronostici');
-- forzare l'utente di un altro: bloccato dalla RLS
select prova.errore($$insert into pronostici_partita (utente_id, partita_id, vincitore_id) values ('00000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002')$$, 'permission denied');
reset role;

-- ---------------------------------------------------------------------------
-- Inizio del torneo e delle semifinali: tutto si blocca
-- ---------------------------------------------------------------------------
select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update tornei set inizio_at = now() - interval '2 hours', stato = 'in_corso' where id = '20000000-0000-0000-0000-000000000001';
update partite set inizio_at = now() - interval '1 hour' where turno = 'SF';
reset role;

select prova.come('00000000-0000-0000-0000-000000000001');
set role authenticated;
select prova.errore($$update pronostici_torneo set vincitore_id = '40000000-0000-0000-0000-000000000003' where utente_id = auth.uid()$$, 'chiusi');
select prova.errore($$update pronostici_partita set totale_game = 12 where utente_id = auth.uid()$$, 'chiusi');
select prova.errore($$delete from pronostici_partita where utente_id = auth.uid()$$, 'chiusi');
select prova.errore($$insert into pronostici_partita (partita_id, vincitore_id) values ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002')$$, 'chiusi');
reset role;

-- ---------------------------------------------------------------------------
-- Risultati: punteggio coerente, punti calcolati da soli
-- ---------------------------------------------------------------------------
select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select prova.errore($$update partite set stato = 'conclusa', game_a = '{6}', game_b = '{6}' where id = '50000000-0000-0000-0000-000000000001'$$, 'non chiude');
select prova.errore($$update partite set stato = 'conclusa', game_a = '{6,6}', game_b = '{4,4}' where id = '50000000-0000-0000-0000-000000000001'$$, 'troppi set');
update partite set stato = 'conclusa', game_a = '{6}', game_b = '{4}' where id = '50000000-0000-0000-0000-000000000001';
select prova.ok((select vincitore_id from partite where id = '50000000-0000-0000-0000-000000000001') = '40000000-0000-0000-0000-000000000001', 'vincitore dal punteggio');
-- semifinale 2 vinta per ritiro dalla coppia 3
update partite set stato = 'conclusa', ritiro = true, vincitore_id = '40000000-0000-0000-0000-000000000003' where id = '50000000-0000-0000-0000-000000000002';
-- la finale si riempie da sola con i vincitori delle semifinali (avanzamento automatico)
reset role;
select prova.ok((select coppia_a_id from partite where id = '50000000-0000-0000-0000-000000000003') = '40000000-0000-0000-0000-000000000001', 'vincitore SF1 in finale come coppia A');
select prova.ok((select coppia_b_id from partite where id = '50000000-0000-0000-0000-000000000003') = '40000000-0000-0000-0000-000000000003', 'vincitore SF2 (ritiro) in finale come coppia B');

select prova.ok((select punti from pronostici_partita where utente_id = '00000000-0000-0000-0000-000000000001') = 7, 'set unico, pronostico senza set: vincitore 3 + risultato 4 = 7');
select prova.ok((select punti from pronostici_partita where utente_id = '00000000-0000-0000-0000-000000000002') = 0, 'vincitore sbagliato: 0 anche se i game sono vicini');
select prova.ok((select mese from pronostici_partita where utente_id = '00000000-0000-0000-0000-000000000001') = date_trunc('month', (now() - interval '1 hour') at time zone 'UTC')::date, 'mese della partita');

select prova.come('00000000-0000-0000-0000-000000000003');
set role authenticated;
-- pronostico set per set con il long tie-break: punteggi validi e coerenti con il vincitore
select prova.errore($$insert into pronostici_partita (partita_id, vincitore_id, game_a, game_b) values ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '{6,4,10}', '{4,6,9}')$$, 'long tie-break non valido');
select prova.errore($$insert into pronostici_partita (partita_id, vincitore_id, game_a, game_b) values ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '{6,4,8}', '{4,6,10}')$$, 'non corrisponde');
select prova.errore($$insert into pronostici_partita (partita_id, vincitore_id, game_a, game_b) values ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '{6,4}', '{4,6}')$$, 'non corrisponde');
select prova.ok(tiebreak_valido(10, 8) and tiebreak_valido(12, 10) and tiebreak_valido(50, 48) and not tiebreak_valido(51, 49) and not tiebreak_valido(12, 8) and not tiebreak_valido(10, 9), 'long tie-break valido, fino a 50');
insert into pronostici_partita (partita_id, vincitore_id, game_a, game_b) values ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '{6,3,10}', '{4,6,8}');
select prova.ok((select set_vincitore = 2 and set_perdente = 1 and game_previsti_a = 10 and game_previsti_b = 10 from pronostici_partita where partita_id = '50000000-0000-0000-0000-000000000003'), 'set e game ricavati dal pronostico set per set');
reset role;
select prova.come('00000000-0000-0000-0000-000000000001');
set role authenticated;
insert into pronostici_partita (partita_id, vincitore_id, set_vincitore, set_perdente, game_previsti_a, game_previsti_b) values ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 2, 0, 12, 8);
reset role;

select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update partite set inizio_at = now() - interval '30 minutes' where id = '50000000-0000-0000-0000-000000000003';
update partite set stato = 'conclusa', game_a = '{6,3,10}', game_b = '{4,6,7}' where id = '50000000-0000-0000-0000-000000000003';
reset role;
-- 6-4 3-6 10-7: totale 6+4+3+6+1 (il super tie-break conta 1) = 20
select prova.ok(totale_game('{6,3,10}', '{4,6,7}', 2::smallint) = 20, 'super tie-break = 1 game');
select prova.ok(punti_differenza('set', 6, 3, 6, 4) = 2 and punti_differenza('set', 6, 2, 6, 4) = 1 and punti_differenza('set', 6, 1, 6, 4) = 0 and punti_differenza('long', 10, 8, 10, 8) = 3, 'scala set e long');
-- 6-4 3-6 10-7: game 6+3+1 = 10 contro 4+6 = 10 (il super tie-break vale 1 game a chi lo vince)
select prova.ok((select game_a = 10 and game_b = 10 from game_totali('{6,3,10}', '{4,6,7}', 2::smallint)), 'game totali con super tie-break');
select prova.ok((select punti from pronostici_partita where utente_id = '00000000-0000-0000-0000-000000000003') = 15, 'finale 6-4 3-6 10-8 per A (reale 6-4 3-6 10-7): vincitore 3 + risultato 2-1 4 + set esatti 3+3 + long a 1 punto 2 = 15');
select prova.ok((select punti_long = 2 from pronostici_partita where utente_id = '00000000-0000-0000-0000-000000000003'), 'long sbagliato di 1 punto: 2');
select prova.ok((select punti_vincitore = 3 and punti_set = 4 and punti_game = 6 and errore_game = 0 from pronostici_partita where utente_id = '00000000-0000-0000-0000-000000000003'), 'dettaglio dei punti salvato');
select prova.ok((select punti from pronostici_partita where utente_id = '00000000-0000-0000-0000-000000000001' and partita_id = '50000000-0000-0000-0000-000000000003') = 3, 'finale con pronostico 2-0 senza set: solo vincitore 3');
-- regole modificabili: cambio il valore del vincitore e ricalcolo
update regole_punti set punti = 5 where chiave = 'vincitore';
select calcola_punti_partita('50000000-0000-0000-0000-000000000003');
select prova.ok((select punti from pronostici_partita where utente_id = '00000000-0000-0000-0000-000000000003') = 17, 'regola modificata: vincitore 5 → 17');
update regole_punti set punti = 3 where chiave = 'vincitore';
select calcola_punti_partita('50000000-0000-0000-0000-000000000003');
select prova.ok((select bool_and(punti is null) from pronostici_torneo), 'i punti del torneo arrivano solo alla chiusura');

select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update tornei set stato = 'concluso', data_fine = (now() - interval '1 hour')::date where id = '20000000-0000-0000-0000-000000000001';
reset role;
-- 1 voto su 2 per la coppia vincitrice, 4 coppie nel tabellone: 10 × radice(0,25 / (2/6)) ≈ 8,7 → 9
select prova.ok((select punti from pronostici_torneo where utente_id = '00000000-0000-0000-0000-000000000001') = 9, 'vincitore esatto (scelto da metà dei votanti) 9, finalista sbagliato 0');
select prova.ok((select punti from pronostici_torneo where utente_id = '00000000-0000-0000-0000-000000000002') = 0, 'chi ha scelto il vincitore come finalista non prende i punti del finalista');

-- ---------------------------------------------------------------------------
-- Punti in base alla rarità: equi, smorzati, nascosti finché i pronostici sono aperti
-- ---------------------------------------------------------------------------
select prova.ok(punti_rarita(3, 1, 2, 2) = 3, 'metà dei voti: punti base');
select prova.ok(punti_rarita(3, 10, 100, 2) > punti_rarita(3, 90, 100, 2), 'chi indovina la sorpresa prende più di chi indovina il favorito');
select prova.ok(punti_rarita(3, 1, 1, 2) between 2 and 4, 'con un solo votante il moltiplicatore resta vicino a 1');
select prova.ok(punti_rarita(10, 0, 1000, 16) <= 25 and punti_rarita(10, 1000, 1000, 16) >= 5, 'moltiplicatore tra 0,5 e 2,5');
select prova.ok((select sum(voti) from voti_partita('50000000-0000-0000-0000-000000000001')) = 2, 'percentuali visibili dopo la chiusura');
select prova.ok((select percentuale from voti_partita('50000000-0000-0000-0000-000000000001') where coppia_id = '40000000-0000-0000-0000-000000000001') = 50, '50% per la coppia 1');

-- ---------------------------------------------------------------------------
-- Classifiche mensili: globale, per Paese, per lega
-- ---------------------------------------------------------------------------
\set mese 'date_trunc(''month'', now() - interval ''1 hour'')::date'
select prova.ok((select punti from classifica(:mese) where nickname = 'Marco_BT') = 19, 'Marco: 7 + 3 + 9 = 19');
select prova.ok((select posizione from classifica(:mese) where nickname = 'Marco_BT') = 1, 'Marco primo');
select prova.ok((select pronostici = 2 and vincitori = 2 and set_esatti = 1 and game_esatti = 0 from classifica(:mese) where nickname = 'Marco_BT'), 'statistiche di Marco: 2 pronostici, 2 vincitori, 1 set esatto, 1 game esatti');
select prova.ok((select count(*) from classifica(:mese, 'paese', 'BR')) = 1, 'classifica Brasile: solo Joana');
select prova.ok((select count(*) from classifica(:mese - 31)) = 0, 'mese precedente vuoto');

select prova.come('00000000-0000-0000-0000-000000000001');
set role authenticated;
create temp table lega_prova as select * from crea_lega('Amici del lido');
select prova.ok((select codice ~ '^[A-Z2-9]{6}$' from lega_prova), 'codice invito di 6 caratteri');
select prova.errore($$insert into leghe (nome, codice, creata_da) values ('Furba', 'AAAAAA', auth.uid())$$, 'permission denied');
reset role;
grant select on lega_prova to authenticated;

select prova.come('00000000-0000-0000-0000-000000000002');
set role authenticated;
select prova.errore($$select unisciti_lega('XXXXXX')$$, 'non valido');
select prova.ok(unisciti_lega((select lower(codice) from lega_prova)) = (select id from lega_prova), 'entro con il codice, anche in minuscolo');
select prova.ok((select count(*) from classifica(:mese, 'lega', null, (select id from lega_prova))) = 2, 'classifica della lega: 2 membri');
select prova.ok((select posizione from mia_posizione(:mese, 'lega', null, (select id from lega_prova))) = 2, 'Joana seconda nella lega');
reset role;

select prova.come('00000000-0000-0000-0000-000000000003');
set role authenticated;
select prova.ok((select count(*) from leghe) = 0, 'chi non è membro non vede la lega');
select prova.ok((select count(*) from classifica(:mese, 'lega', null, (select id from lega_prova))) = 0, 'né la sua classifica');
select prova.ok((select punti from mia_posizione(:mese)) = 15, 'la mia posizione globale');
reset role;

-- ---------------------------------------------------------------------------
-- Notizie: visibili solo se pubblicate, riassunto breve
-- ---------------------------------------------------------------------------
select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into notizie (id, fonte_nome, url_originale) values ('60000000-0000-0000-0000-000000000001', 'Sito di prova', 'https://example.com/articolo');
insert into notizie_traduzioni values ('60000000-0000-0000-0000-000000000001', 'it', 'Una notizia di prova', 'Un riassunto scritto con parole nostre, breve e chiaro.');
select prova.errore($$insert into notizie_traduzioni values ('60000000-0000-0000-0000-000000000001', 'en', 'Too long', repeat('x', 400))$$, 'check');
select prova.errore($$insert into notizie (fonte_nome, url_originale) values ('Sito', 'javascript:alert(1)')$$, 'check');
reset role;
select prova.come(null);
set role anon;
select prova.ok((select count(*) from notizie) = 0 and (select count(*) from notizie_traduzioni) = 0, 'le bozze non si vedono');
reset role;
select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update notizie set stato = 'pubblicata';
reset role;
select prova.ok((select pubblicata_at is not null from notizie), 'data di pubblicazione automatica');
select prova.come(null);
set role anon;
select prova.ok((select count(*) from notizie_traduzioni) = 1, 'la notizia pubblicata si vede');
reset role;

-- ---------------------------------------------------------------------------
-- Attività settimanale (per misurare i 500 utenti attivi) ed eliminazione dell'account
-- ---------------------------------------------------------------------------
select prova.come('00000000-0000-0000-0000-000000000001');
set role authenticated;
select segna_attivita();
select segna_attivita();
select prova.errore($$select * from metriche_settimanali()$$, 'amministratori');
select prova.ok((select count(*) from attivita) = 0, 'le attività non si leggono');
reset role;
select prova.ok((select count(*) from attivita) = 1, 'una riga al giorno per utente');
select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select prova.ok((select attivi from metriche_settimanali(2) order by settimana desc limit 1) = 1, 'l''admin vede gli attivi della settimana');
reset role;

-- riaprire il torneo cancella i punti del vincitore (correzioni dell'admin)
select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
update tornei set stato = 'in_corso' where id = '20000000-0000-0000-0000-000000000001';
reset role;
select prova.ok((select bool_and(punti is null) from pronostici_torneo), 'torneo riaperto: punti del vincitore annullati');

select prova.come('00000000-0000-0000-0000-000000000003');
set role authenticated;
select elimina_account();
reset role;
select prova.ok(not exists (select 1 from profili where id = '00000000-0000-0000-0000-000000000003'), 'account eliminato con tutti i suoi dati');
select prova.ok(not exists (select 1 from pronostici_partita where utente_id = '00000000-0000-0000-0000-000000000003'), 'pronostici eliminati');


-- avanzamento: un quarto di finale crea da solo la semifinale che manca
select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into tabelloni (id, torneo_id, genere) values ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'misto');
insert into coppie (id, tabellone_id, giocatore1_id, giocatore2_id) values
  ('40000000-0000-0000-0000-000000000031', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005'),
  ('40000000-0000-0000-0000-000000000032', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006');
insert into partite (tabellone_id, turno, ordine, coppia_a_id, coppia_b_id, inizio_at, stato, game_a, game_b)
values ('30000000-0000-0000-0000-000000000003', 'QF', 4, '40000000-0000-0000-0000-000000000031', '40000000-0000-0000-0000-000000000032', now(), 'conclusa', '{4}', '{6}');
reset role;
select prova.ok((select coppia_b_id from partite where tabellone_id = '30000000-0000-0000-0000-000000000003' and turno = 'SF' and ordine = 2) = '40000000-0000-0000-0000-000000000032', 'QF 4 → SF 2 come coppia B');
-- premi e sponsor: li vede chiunque, li scrive solo l'admin
select prova.come('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into premi (posizione, descrizione) values (1, 'Racchetta da beach tennis');
insert into sponsor (nome, link, logo_url) values ('Lido Prova', 'https://lido.example', 'https://lido.example/logo.png');
reset role;
select prova.come('00000000-0000-0000-0000-000000000001');
set role authenticated;
select prova.errore($$insert into premi (posizione, descrizione) values (2, 'Furbata')$$, 'row-level security');
select prova.errore($$insert into sponsor (nome, logo_url) values ('Furbo', 'https://x.example/l.png')$$, 'row-level security');
select prova.ok((select count(*) from premi) = 1 and (select count(*) from sponsor) = 1, 'premi e sponsor visibili');
reset role;
set role anon;
select prova.ok((select descrizione from premi where posizione = 1) = 'Racchetta da beach tennis', 'premi visibili anche senza accesso');
reset role;
-- orari coerenti: una partita conclusa non resta nel futuro, il turno dopo non va oltre la fine del torneo
insert into tornei (id, nome, luogo, circuito, data_inizio, data_fine, inizio_at) values
  ('20000000-0000-0000-0000-000000000009', 'Corto', 'Roma', 'ITF', current_date, current_date + 1, now());
insert into tabelloni (id, torneo_id, genere) values ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'misto');
insert into coppie (id, tabellone_id, giocatore1_id, giocatore2_id) values
  ('40000000-0000-0000-0000-000000000091', '30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005'),
  ('40000000-0000-0000-0000-000000000092', '30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006');
insert into partite (tabellone_id, turno, ordine, coppia_a_id, coppia_b_id, inizio_at, stato, game_a, game_b)
values ('30000000-0000-0000-0000-000000000009', 'QF', 1, '40000000-0000-0000-0000-000000000091', '40000000-0000-0000-0000-000000000092', now() + interval '1 day', 'conclusa', '{6}', '{2}');
select prova.ok((select inizio_at from partite where tabellone_id = '30000000-0000-0000-0000-000000000009' and turno = 'QF') <= now(), 'conclusa non resta nel futuro');
select prova.ok((select (inizio_at at time zone 'UTC')::date from partite where tabellone_id = '30000000-0000-0000-0000-000000000009' and turno = 'SF') <= current_date + 1, 'semifinale entro la fine del torneo');
-- classifica del torneo, podi, scheda giocatore (solo pronostici di partite chiuse)
set role anon;
select prova.ok((select count(*) from classifica_torneo('20000000-0000-0000-0000-000000000001')) > 0, 'classifica del torneo leggibile da tutti');
select prova.ok(not exists (select 1 from pronostici_giocatore('00000000-0000-0000-0000-000000000001') g join partite p on p.id = g.partita_id where p.stato = 'in_programma' and p.inizio_at > now()), 'i pronostici aperti degli altri restano segreti');
select count(*) from podi_tornei();
reset role;
-- (come superuser: il confronto legge le tabelle protette)
select prova.ok((select count(*) from storico_mensile((select utente_id from pronostici_partita where mese is not null and punti is not null limit 1))) >= 1, 'storico mensile');
select prova.ok(not exists (
  select 1 from classifica_torneo('20000000-0000-0000-0000-000000000001') c
  where c.punti <> coalesce((select sum(pp.punti) from pronostici_partita pp join partite p on p.id = pp.partita_id join tabelloni tb on tb.id = p.tabellone_id
                             where tb.torneo_id = '20000000-0000-0000-0000-000000000001' and pp.utente_id = c.utente_id), 0)
                 + coalesce((select sum(pt.punti) from pronostici_torneo pt join tabelloni tb on tb.id = pt.tabellone_id
                             where tb.torneo_id = '20000000-0000-0000-0000-000000000001' and pt.utente_id = c.utente_id), 0)
), 'punti del torneo = somma dei suoi pronostici');
-- Beach Peck 2.0: notizie programmate, gestione leghe, classifica di stagione
insert into notizie (id, stato, pubblicata_at, categoria) values
  ('70000000-0000-0000-0000-000000000001', 'pubblicata', now() - interval '1 hour', 'risultati'),
  ('70000000-0000-0000-0000-000000000002', 'pubblicata', now() + interval '1 day', 'itf');
insert into notizie_traduzioni (notizia_id, lingua, titolo, riassunto, corpo) values
  ('70000000-0000-0000-0000-000000000001', 'it', 'Articolo uscito', 'Un riassunto abbastanza lungo per il controllo.', 'Primo paragrafo.'),
  ('70000000-0000-0000-0000-000000000002', 'it', 'Articolo futuro', 'Un riassunto abbastanza lungo per il controllo.', null);
set role anon;
select prova.ok((select count(*) from notizie where id::text like '70000000%') = 1, 'una notizia programmata non si vede prima della data');
select prova.ok((select count(*) from notizie_traduzioni where notizia_id::text like '70000000%') = 1, 'neanche la sua traduzione');
select prova.ok((select count(*) from classifica_periodo('2000-01-01', '2100-01-01')) >= 1, 'classifica di stagione');
reset role;
select prova.ok((select sum(punti) from classifica_periodo('2000-01-01', '2100-01-01')) =
  (select coalesce(sum(punti), 0) from pronostici_partita where punti is not null)
  + (select coalesce(sum(punti), 0) from pronostici_torneo where punti is not null), 'la stagione somma tutti i punti');
select prova.ok(coalesce((select sum(punti) from classifica_periodo('1990-01-01', '1990-12-31')), 0) = 0, 'fuori dalle date non conta nulla');
-- stagioni: le legge chiunque, le scrive solo l'admin
select prova.ok((select count(*) from stagioni) >= 1, 'c''è una stagione iniziale');
-- gestione della lega: solo chi la crea toglie membri, rinomina ed elimina
select prova.come('00000000-0000-0000-0000-000000000001');
set role authenticated;
select crea_lega('Lega da gestire');
reset role;
select codice as cod_gestire from leghe where nome = 'Lega da gestire' \gset
select prova.come('00000000-0000-0000-0000-000000000002');
set role authenticated;
select unisciti_lega(:'cod_gestire');
select prova.errore($$select rimuovi_membro((select id from leghe where nome = 'Lega da gestire'), '00000000-0000-0000-0000-000000000001')$$, 'Solo chi ha creato');
select prova.errore($$select elimina_lega((select id from leghe where nome = 'Lega da gestire'))$$, 'Solo chi ha creato');
reset role;
select prova.come('00000000-0000-0000-0000-000000000001');
set role authenticated;
select prova.errore($$select esci_lega((select id from leghe where nome = 'Lega da gestire'))$$, 'puoi eliminarla');
select rinomina_lega((select id from leghe where nome = 'Lega da gestire'), 'Lega rinominata');
select rimuovi_membro((select id from leghe where nome = 'Lega rinominata'), '00000000-0000-0000-0000-000000000002');
select prova.ok((select count(*) from leghe_membri lm join leghe l on l.id = lm.lega_id where l.nome = 'Lega rinominata') = 1, 'membro tolto');
select elimina_lega((select id from leghe where nome = 'Lega rinominata'));
reset role;
select prova.ok(not exists (select 1 from leghe where nome = 'Lega rinominata'), 'lega eliminata');
set role anon;
select prova.ok((select count(*) from stagioni) >= 1, 'stagioni leggibili da tutti');
reset role;
select prova.come('00000000-0000-0000-0000-000000000002');
set role authenticated;
select prova.errore($$insert into stagioni (nome, inizio, fine) values ('Furba', current_date, current_date)$$, 'row-level security');
reset role;
\o
\echo 'Tutti i test dello schema sono passati.'
