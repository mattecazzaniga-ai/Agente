-- Dati di prova SOLO per lo sviluppo locale (supabase db reset). Giocatori, tornei e notizie sono
-- inventati: non sono dati reali e le date sono relative a "adesso", così ci sono sempre partite aperte.
-- In produzione non si carica: i dati veri li inserisce l'admin a mano.

do $$
declare
  t_corso uuid; t_prossimo uuid; t_concluso uuid;
  tb uuid;
  c uuid[];
  g uuid[];
  i int;
  v uuid;
  nomi text[][] := array[
    ['Luca','Ferrante','IT'], ['Marco','Benassi','IT'], ['Diego','Moraes','BR'], ['Rafael','Tavares','BR'],
    ['Pablo','Ortega','ES'], ['Javier','Molina','ES'], ['Tommaso','Galli','IT'], ['Nicola','Sartori','IT'],
    ['Thiago','Lacerda','BR'], ['Bruno','Pacheco','BR'], ['Hugo','Delmas','FR'], ['Julien','Marchal','FR'],
    ['Andrea','Volpi','IT'], ['Simone','Riva','IT'], ['Igor','Petrov','RU'], ['Anton','Volkov','RU']];
  nomi_f text[][] := array[
    ['Giulia','Martelli','IT'], ['Sara','Fontana','IT'], ['Camila','Rezende','BR'], ['Larissa','Prado','BR'],
    ['Lucia','Navarro','ES'], ['Marta','Iglesias','ES'], ['Chiara','Bellini','IT'], ['Elena','Corsi','IT']];
begin
  -- giocatori
  g := array[]::uuid[];
  for i in 1..array_length(nomi, 1) loop
    insert into giocatori (nome, cognome, paese, sesso) values (nomi[i][1], nomi[i][2], nomi[i][3], 'M') returning id into v; g := g || v;
  end loop;
  for i in 1..array_length(nomi_f, 1) loop
    insert into giocatori (nome, cognome, paese, sesso) values (nomi_f[i][1], nomi_f[i][2], nomi_f[i][3], 'F') returning id into v; g := g || v;
  end loop;

  -- 1) Torneo in corso: quarti già giocati in parte, altre partite aperte ai pronostici
  insert into tornei (nome, luogo, paese, circuito, categoria, data_inizio, data_fine, inizio_at, stato)
  values ('Demo Open Adriatico', 'Lido di Prova', 'IT', 'ITF', 'BT200', current_date - 1, current_date + 2, now() - interval '1 day', 'in_corso')
  returning id into t_corso;
  insert into tabelloni (torneo_id, genere) values (t_corso, 'maschile') returning id into tb;
  c := array[]::uuid[];
  for i in 0..7 loop
    insert into coppie (tabellone_id, giocatore1_id, giocatore2_id, testa_di_serie)
      values (tb, g[2 * i + 1], g[2 * i + 2], case when i in (0, 7) then (i / 7) + 1 end) returning id into v; c := c || v;
  end loop;
  insert into partite (tabellone_id, turno, ordine, coppia_a_id, coppia_b_id, inizio_at, set_per_vincere) values
    (tb, 'QF', 1, c[1], c[2], now() - interval '20 hours', 1),
    (tb, 'QF', 2, c[3], c[4], now() - interval '19 hours', 1),
    (tb, 'QF', 3, c[5], c[6], now() + interval '3 hours', 1),
    (tb, 'QF', 4, c[7], c[8], now() + interval '4 hours', 1);
  update partite set stato = 'conclusa', game_a = '{6}', game_b = '{4}' where tabellone_id = tb and turno = 'QF' and ordine = 1;
  update partite set stato = 'conclusa', game_a = '{5}', game_b = '{7}' where tabellone_id = tb and turno = 'QF' and ordine = 2;
  -- la semifinale 1 (creata dall'avanzamento automatico) si gioca domani
  update partite set inizio_at = now() + interval '1 day', set_per_vincere = 2 where tabellone_id = tb and turno = 'SF' and ordine = 1;

  -- 2) Torneo in programma: aperto il pronostico sul vincitore e sulle partite del primo turno
  insert into tornei (nome, luogo, paese, circuito, categoria, data_inizio, data_fine, inizio_at, stato)
  values ('Demo Copa Atlântica', 'Praia Exemplo', 'BR', 'BR', null, current_date + 4, current_date + 6, date_trunc('hour', now()) + interval '4 days', 'in_programma')
  returning id into t_prossimo;
  insert into tabelloni (torneo_id, genere) values (t_prossimo, 'misto') returning id into tb;
  c := array[]::uuid[];
  for i in 0..7 loop
    insert into coppie (tabellone_id, giocatore1_id, giocatore2_id, testa_di_serie)
      values (tb, g[i + 1], g[17 + i], case when i < 2 then i + 1 end) returning id into v; c := c || v;
  end loop;
  for i in 1..4 loop
    insert into partite (tabellone_id, turno, ordine, coppia_a_id, coppia_b_id, inizio_at, set_per_vincere)
    values (tb, 'QF', i, c[2 * i - 1], c[2 * i], date_trunc('hour', now()) + interval '4 days' + (i - 1) * interval '1 hour', 2);
  end loop;
  insert into tabelloni (torneo_id, genere) values (t_prossimo, 'femminile') returning id into tb;
  for i in 0..3 loop
    insert into coppie (tabellone_id, giocatore1_id, giocatore2_id) values (tb, g[17 + 2 * i], g[18 + 2 * i]);
  end loop;

  -- 3) Torneo concluso il mese scorso (solo risultati, per vedere l'archivio)
  insert into tornei (nome, luogo, paese, circuito, categoria, data_inizio, data_fine, inizio_at, stato)
  values ('Demo FIP Costa Brava', 'Playa Ejemplo', 'ES', 'FIP', 'Silver', current_date - 35, current_date - 33, now() - interval '35 days', 'in_corso')
  returning id into t_concluso;
  insert into tabelloni (torneo_id, genere) values (t_concluso, 'femminile') returning id into tb;
  c := array[]::uuid[];
  for i in 0..3 loop
    insert into coppie (tabellone_id, giocatore1_id, giocatore2_id) values (tb, g[17 + 2 * i], g[18 + 2 * i]) returning id into v; c := c || v;
  end loop;
  insert into partite (tabellone_id, turno, ordine, coppia_a_id, coppia_b_id, inizio_at, set_per_vincere) values
    (tb, 'SF', 1, c[1], c[2], now() - interval '34 days', 2),
    (tb, 'SF', 2, c[3], c[4], now() - interval '34 days' + interval '1 hour', 2);
  update partite set stato = 'conclusa', game_a = '{6,6}', game_b = '{3,4}' where tabellone_id = tb and turno = 'SF' and ordine = 1;
  update partite set stato = 'conclusa', game_a = '{4,6,10}', game_b = '{6,3,7}' where tabellone_id = tb and turno = 'SF' and ordine = 2;
  update partite set inizio_at = now() - interval '33 days', stato = 'conclusa', game_a = '{7,6}', game_b = '{5,4}' where tabellone_id = tb and turno = 'F';
  update tornei set stato = 'concluso' where id = t_concluso;

  -- notizie di esempio (testo originale; il link è un segnaposto)
  with n as (
    insert into notizie (fonte_nome, url_originale, stato) values ('Esempio', 'https://example.com/beach-tennis/demo-1', 'pubblicata') returning id
  )
  insert into notizie_traduzioni (notizia_id, lingua, titolo, riassunto)
  select n.id, x.lingua, x.titolo, x.riassunto from n, (values
    ('it', 'Calendario di prova pronto', 'Questa è una notizia dimostrativa: il calendario dei tornei di prova è caricato e puoi già fare i tuoi pronostici sulle partite aperte.'),
    ('pt-BR', 'Calendário de teste pronto', 'Esta é uma notícia de demonstração: o calendário de torneios de teste está carregado e você já pode dar seus palpites nos jogos abertos.'),
    ('es', 'Calendario de prueba listo', 'Esta es una noticia de demostración: el calendario de torneos de prueba está cargado y ya puedes hacer tus pronósticos en los partidos abiertos.'),
    ('en', 'Demo calendar ready', 'This is a demo news item: the demo tournament calendar is loaded and you can already make your predictions on the open matches.')
  ) as x(lingua, titolo, riassunto);

  with n as (
    insert into notizie (fonte_nome, url_originale, stato) values ('Esempio', 'https://example.com/beach-tennis/demo-2', 'pubblicata') returning id
  )
  insert into notizie_traduzioni (notizia_id, lingua, titolo, riassunto)
  select n.id, x.lingua, x.titolo, x.riassunto from n, (values
    ('it', 'Come funzionano i punti rari', 'Indovinare una coppia scelta da pochi vale di più: il moltiplicatore va da metà a due volte e mezzo i punti base, in base ai voti di tutti.'),
    ('en', 'How rare picks score', 'Guessing a team few people picked is worth more: the multiplier goes from half to two and a half times the base points, based on everyone''s votes.')
  ) as x(lingua, titolo, riassunto);
end $$;
