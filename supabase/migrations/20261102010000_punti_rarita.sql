-- Punti in base alla rarità della scelta giusta (equi): chi indovina un risultato scelto da pochi
-- prende più punti, chi indovina il favorito ne prende meno. Tutti quelli che indovinano lo stesso
-- risultato prendono gli stessi punti.
--
--   quota della scelta  p = (voti per quel risultato + 1) / (voti totali + numero di opzioni)
--   riferimento         q = 1 / numero di opzioni            (tutte le opzioni ugualmente votate)
--   moltiplicatore      m = radice(q / p), limitato tra 0,5 e 2,5
--   punti               = base × m, arrotondati, almeno 1
--
-- Il "+1" e il "+ numero di opzioni" (lisciatura di Laplace) evitano premi enormi quando hanno votato
-- in pochi: con un solo votante il moltiplicatore resta vicino a 1. La radice smorza gli estremi.
-- I voti si contano sui pronostici bloccati, quindi il conto è definitivo e uguale per tutti.

create or replace function public.punti_rarita(base int, voti_scelta bigint, voti_totali bigint, opzioni int)
returns int language sql immutable as $$
  select greatest(1, round(base * least(2.5, greatest(0.5,
    sqrt((1.0 / greatest(opzioni, 2)) / ((voti_scelta + 1.0) / (voti_totali + greatest(opzioni, 2))))
  ))))::int
$$;

create or replace function public.calcola_punti_partita(p_partita uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p partite;
  s record;
  tot int;
  voti_totali bigint;
  voti_giusti bigint;
  base int;
begin
  select * into p from partite where id = p_partita;
  if p is null then return; end if;
  if p.stato <> 'conclusa' then
    update pronostici_partita set punti = null, mese = null where partita_id = p_partita and punti is not null;
    return;
  end if;
  if not p.ritiro then
    select * into s from set_vinti(p.game_a, p.game_b);
    tot := totale_game(p.game_a, p.game_b, p.set_per_vincere);
  end if;
  select count(*), count(*) filter (where vincitore_id = p.vincitore_id) into voti_totali, voti_giusti
  from pronostici_partita where partita_id = p_partita;
  base := punti_rarita(3, voti_giusti, voti_totali, 2);
  update pronostici_partita pr set
    mese = date_trunc('month', p.inizio_at at time zone 'UTC')::date,
    punti = case when pr.vincitore_id <> p.vincitore_id then 0 else
      base
      + case when not p.ritiro and p.set_per_vincere = 2 and pr.set_vincitore is not null
                  and pr.set_perdente = least(s.vinti_a, s.vinti_b) then 2 else 0 end
      + case when p.ritiro or pr.totale_game is null then 0
             when pr.totale_game = tot then 3
             when abs(pr.totale_game - tot) <= 2 then 1
             else 0 end
    end
  where pr.partita_id = p_partita;
end $$;

create or replace function public.calcola_punti_tabellone(p_tabellone uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t tornei;
  f partite;
  perdente uuid;
  n_coppie int;
  voti_totali bigint;
  voti_vincitore bigint;
  voti_finalisti bigint;
  voti_finalista_giusto bigint;
  punti_vincitore int;
  punti_finalista int;
begin
  select t2.* into t from tornei t2 join tabelloni tb on tb.torneo_id = t2.id where tb.id = p_tabellone;
  select * into f from partite where tabellone_id = p_tabellone and turno = 'F' and stato = 'conclusa' order by ordine limit 1;
  if t.stato <> 'concluso' or f is null then
    update pronostici_torneo set punti = null, mese = null where tabellone_id = p_tabellone and punti is not null;
    return;
  end if;
  perdente := case when f.vincitore_id = f.coppia_a_id then f.coppia_b_id else f.coppia_a_id end;
  select count(*) into n_coppie from coppie where tabellone_id = p_tabellone;
  select count(*), count(*) filter (where vincitore_id = f.vincitore_id),
         count(finalista_id), count(*) filter (where finalista_id = perdente)
    into voti_totali, voti_vincitore, voti_finalisti, voti_finalista_giusto
  from pronostici_torneo where tabellone_id = p_tabellone;
  punti_vincitore := punti_rarita(10, voti_vincitore, voti_totali, n_coppie);
  punti_finalista := punti_rarita(5, voti_finalista_giusto, voti_finalisti, n_coppie);
  update pronostici_torneo pr set
    mese = date_trunc('month', t.data_fine)::date,
    punti = (case when pr.vincitore_id = f.vincitore_id then punti_vincitore else 0 end)
          + (case when pr.finalista_id = perdente then punti_finalista else 0 end)
  where pr.tabellone_id = p_tabellone;
end $$;

-- ---------------------------------------------------------------------------
-- Percentuali di voto e punti in palio: visibili solo dopo la chiusura dei pronostici,
-- così nessuno sceglie guardando cosa hanno votato gli altri.
-- ---------------------------------------------------------------------------

create or replace function public.voti_partita(p_partita uuid)
returns table (coppia_id uuid, voti bigint, percentuale int, punti_in_palio int)
language sql stable security definer set search_path = public as $$
  with p as (select * from partite where id = p_partita and not public.partita_aperta(p_partita)),
  c as (select coppia_a_id as id from p union all select coppia_b_id from p),
  v as (select vincitore_id, count(*) as n from pronostici_partita where partita_id = p_partita group by vincitore_id),
  t as (select coalesce(sum(n), 0)::bigint as tot from v)
  select c.id, coalesce(v.n, 0), case when t.tot = 0 then 0 else round(100.0 * coalesce(v.n, 0) / t.tot)::int end,
         public.punti_rarita(3, coalesce(v.n, 0), t.tot, 2)
  from c cross join t left join v on v.vincitore_id = c.id
  where c.id is not null
$$;

create or replace function public.voti_tabellone(p_tabellone uuid)
returns table (coppia_id uuid, voti bigint, percentuale int, punti_in_palio int)
language sql stable security definer set search_path = public as $$
  with aperto as (select public.tabellone_aperto(p_tabellone) as si),
  c as (select id from coppie where tabellone_id = p_tabellone),
  v as (select vincitore_id, count(*) as n from pronostici_torneo where tabellone_id = p_tabellone group by vincitore_id),
  t as (select coalesce(sum(n), 0)::bigint as tot, (select count(*) from c) as opzioni from v)
  select c.id, coalesce(v.n, 0), case when t.tot = 0 then 0 else round(100.0 * coalesce(v.n, 0) / t.tot)::int end,
         public.punti_rarita(10, coalesce(v.n, 0), t.tot, t.opzioni::int)
  from c cross join t cross join aperto left join v on v.vincitore_id = c.id
  where not aperto.si
$$;
