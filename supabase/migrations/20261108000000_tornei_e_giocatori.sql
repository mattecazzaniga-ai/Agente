-- Classifica dei pronosticatori per ogni torneo, podi dei tornei conclusi e scheda pubblica di un giocatore.
-- Funzioni di sola lettura: espongono solo numeri e pronostici di partite già chiuse (mai quelli ancora aperti).

create or replace function public.classifica_torneo(p_torneo uuid, p_limite int default 100)
returns table (
  posizione bigint, utente_id uuid, nickname text, paese char(2), punti bigint,
  pronostici bigint, vincitori bigint, set_esatti bigint, game_esatti bigint
)
language sql stable security definer set search_path = public as $$
  with righe as (
    select pp.utente_id, pp.punti, 1 as pronostico, (pp.punti_vincitore > 0)::int as vincitore,
           (pp.punti_set > 0)::int as set_esatto, (pp.errore_game = 0)::int as game_esatto
    from pronostici_partita pp
    join partite p on p.id = pp.partita_id
    join tabelloni tb on tb.id = p.tabellone_id
    where tb.torneo_id = p_torneo and pp.punti is not null
    union all
    select pt.utente_id, pt.punti, 0, 0, 0, 0
    from pronostici_torneo pt join tabelloni tb on tb.id = pt.tabellone_id
    where tb.torneo_id = p_torneo and pt.punti is not null
  ),
  totali as (
    select r.utente_id, sum(r.punti)::bigint as punti, sum(r.pronostico)::bigint as pronostici, sum(r.vincitore)::bigint as vincitori,
           sum(r.set_esatto)::bigint as set_esatti, sum(coalesce(r.game_esatto, 0))::bigint as game_esatti
    from righe r group by r.utente_id
  )
  select rank() over (order by t.punti desc, t.set_esatti desc, t.vincitori desc, t.game_esatti desc),
         t.utente_id, pr.nickname, pr.paese, t.punti, t.pronostici, t.vincitori, t.set_esatti, t.game_esatti
  from totali t join profili pr on pr.id = t.utente_id
  order by t.punti desc, t.set_esatti desc, t.vincitori desc, t.game_esatti desc, pr.nickname
  limit p_limite
$$;

-- I primi tre pronosticatori di ogni torneo concluso (con almeno un punto)
create or replace function public.podi_tornei()
returns table (torneo_id uuid, torneo_nome text, data_fine date, utente_id uuid, posizione bigint, punti bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.nome, t.data_fine, c.utente_id, c.posizione, c.punti
  from tornei t cross join lateral public.classifica_torneo(t.id, 10) c
  where t.stato = 'concluso' and c.posizione <= 3 and c.punti > 0
  order by t.data_fine desc, c.posizione
$$;

-- Mese per mese: punti, posizione nella classifica mondiale e quanti giocatori c'erano
create or replace function public.storico_mensile(p_utente uuid)
returns table (mese date, posizione bigint, punti bigint, partecipanti bigint)
language sql stable security definer set search_path = public as $$
  with mesi as (
    select distinct pp.mese from pronostici_partita pp where pp.utente_id = p_utente and pp.mese is not null
    union
    select distinct pt.mese from pronostici_torneo pt where pt.utente_id = p_utente and pt.mese is not null
  )
  select m.mese, c.posizione, c.punti, (select count(*) from public.classifica(m.mese, 'globale', null, null, 100000))
  from mesi m cross join lateral public.classifica(m.mese, 'globale', null, null, 100000) c
  where c.utente_id = p_utente
  order by m.mese desc
$$;

-- I pronostici di un giocatore sulle partite già chiuse (iniziate o concluse): quelli aperti restano segreti
create or replace function public.pronostici_giocatore(p_utente uuid, p_limite int default 200)
returns table (
  id uuid, partita_id uuid, vincitore_id uuid, set_vincitore smallint, set_perdente smallint,
  game_a smallint[], game_b smallint[], punti_vincitore smallint, punti_set smallint, punti_game smallint, punti_long smallint, errore_game smallint, punti smallint
)
language sql stable security definer set search_path = public as $$
  select pp.id, pp.partita_id, pp.vincitore_id, pp.set_vincitore, pp.set_perdente, pp.game_a, pp.game_b,
         pp.punti_vincitore, pp.punti_set, pp.punti_game, pp.punti_long, pp.errore_game, pp.punti
  from pronostici_partita pp join partite p on p.id = pp.partita_id
  where pp.utente_id = p_utente and (p.inizio_at <= now() or p.stato <> 'in_programma')
  order by p.inizio_at desc
  limit least(p_limite, 500)
$$;

grant execute on function public.classifica_torneo(uuid, int) to anon, authenticated;
grant execute on function public.podi_tornei() to anon, authenticated;
grant execute on function public.storico_mensile(uuid) to anon, authenticated;
grant execute on function public.pronostici_giocatore(uuid, int) to anon, authenticated;
