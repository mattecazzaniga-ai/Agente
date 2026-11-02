-- Pagina d'invito: chi ha il codice vede nome e numero di membri della lega prima di entrare.
create or replace function public.lega_da_codice(p_codice text)
returns table (id uuid, nome text, membri bigint)
language sql stable security definer set search_path = public as $$
  select l.id, l.nome, (select count(*) from leghe_membri m where m.lega_id = l.id)
  from leghe l where l.codice = upper(trim(p_codice))
$$;

-- Tutte le percentuali di voto di un torneo in una sola chiamata (solo per pronostici già chiusi).
create or replace function public.voti_del_torneo(p_torneo uuid)
returns table (tipo text, rif uuid, coppia_id uuid, voti bigint, percentuale int, punti_in_palio int)
language sql stable security definer set search_path = public as $$
  select 'partita', p.id, v.coppia_id, v.voti, v.percentuale, v.punti_in_palio
  from partite p join tabelloni tb on tb.id = p.tabellone_id
  cross join lateral public.voti_partita(p.id) v
  where tb.torneo_id = p_torneo
  union all
  select 'tabellone', tb.id, v.coppia_id, v.voti, v.percentuale, v.punti_in_palio
  from tabelloni tb cross join lateral public.voti_tabellone(tb.id) v
  where tb.torneo_id = p_torneo
$$;
