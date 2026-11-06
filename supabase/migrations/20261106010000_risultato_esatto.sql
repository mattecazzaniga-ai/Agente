-- Pronostico con risultato esatto e punti "a vicinanza".
--
-- Il pronostico su una partita è: chi vince + il punteggio di ogni set (game), dal lato delle coppie A e B.
-- Al meglio dei 3 si indicano i primi due set: se ne vince uno per parte, il terzo (super tie-break) va a
-- chi si è scelto come vincitore. Punti:
--   vincitore giusto        10 × rarità (da 5 a 25)
--   set giusti (2-0 / 2-1)  +5
--   per ogni set, se ne hai indovinato il vincitore: esatto +5, a 1 game +3, a 2 game +1
--   risultato esatto        +10
--   vincitore sbagliato 0; con il ritiro contano solo i punti del vincitore.
-- Il vincitore del torneo passa a 30 punti, il finalista a 15 (sempre pesati sulla rarità).

alter table public.pronostici_partita
  add column if not exists game_a smallint[],
  add column if not exists game_b smallint[];
grant insert (game_a, game_b) on public.pronostici_partita to authenticated;
grant update (game_a, game_b) on public.pronostici_partita to authenticated;

/** Un set "normale" finito: 6-0…6-4, 7-5, 7-6. */
create or replace function public.set_valido(a int, b int) returns boolean
language sql immutable as $$
  select a between 0 and 7 and b between 0 and 7
     and ((greatest(a, b) = 6 and least(a, b) <= 4) or (greatest(a, b) = 7 and least(a, b) in (5, 6)))
$$;

/** Punti di un set pronosticato: solo se è giusto chi lo vince; esatto 5, a 1 game 3, a 2 game 1. */
create or replace function public.punti_set(pa int, pb int, ra int, rb int) returns int
language sql immutable as $$
  select case
    when pa is null or pb is null or ra is null or rb is null or sign(pa - pb) <> sign(ra - rb) then 0
    else case abs(pa - ra) + abs(pb - rb) when 0 then 5 when 1 then 3 when 2 then 1 else 0 end
  end
$$;

create or replace function public.valida_pronostico_partita() returns trigger
language plpgsql set search_path = public as $$
declare
  p partite;
  vince_a boolean;
  vinti_scelta int := 0;
  vinti_altra int := 0;
begin
  if tg_op = 'UPDATE' and new.vincitore_id is not distinct from old.vincitore_id and new.set_vincitore is not distinct from old.set_vincitore
     and new.set_perdente is not distinct from old.set_perdente and new.totale_game is not distinct from old.totale_game
     and new.game_a is not distinct from old.game_a and new.game_b is not distinct from old.game_b and new.partita_id = old.partita_id then
    return new;
  end if;
  if not partita_aperta(new.partita_id) then
    raise exception 'Pronostici chiusi: la partita è già iniziata';
  end if;
  select * into p from partite where id = new.partita_id;
  if new.vincitore_id not in (p.coppia_a_id, p.coppia_b_id) then
    raise exception 'Scegli una delle due coppie della partita';
  end if;
  if new.set_vincitore is not null and new.set_vincitore <> p.set_per_vincere then
    raise exception 'Il punteggio in set non è compatibile con il formato della partita';
  end if;
  if new.game_a is not null or new.game_b is not null then
    if new.game_a is null or new.game_b is null or cardinality(new.game_a) <> p.set_per_vincere or cardinality(new.game_b) <> p.set_per_vincere then
      raise exception 'Indica il punteggio di ogni set';
    end if;
    vince_a := new.vincitore_id = p.coppia_a_id;
    for i in 1 .. cardinality(new.game_a) loop
      if not set_valido(new.game_a[i], new.game_b[i]) then
        raise exception 'Punteggio del set % non valido', i;
      end if;
      if (new.game_a[i] > new.game_b[i]) = vince_a then vinti_scelta := vinti_scelta + 1; else vinti_altra := vinti_altra + 1; end if;
    end loop;
    if vinti_scelta = 0 then
      raise exception 'La coppia scelta deve vincere almeno un set';
    end if;
    -- 2 set vinti = 2-0; uno per parte = 2-1 (il super tie-break va alla coppia scelta); set unico = 1-0
    new.set_vincitore := p.set_per_vincere;
    new.set_perdente := vinti_altra;
    new.totale_game := null;
  end if;
  new.aggiornato_at := now();
  return new;
end $$;

create or replace function public.calcola_punti_partita(p_partita uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p partite;
  set_perdente_reali int; -- set vinti da chi perde (null con il ritiro)
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
    select least(v.vinti_a, v.vinti_b) into set_perdente_reali from set_vinti(p.game_a, p.game_b) v;
  end if;
  select count(*), count(*) filter (where vincitore_id = p.vincitore_id) into voti_totali, voti_giusti
  from pronostici_partita where partita_id = p_partita;
  base := punti_rarita(10, voti_giusti, voti_totali, 2);
  update pronostici_partita pr set
    mese = date_trunc('month', p.inizio_at at time zone 'UTC')::date,
    punti = case
      when pr.vincitore_id <> p.vincitore_id then 0
      when p.ritiro then base
      else base
        + case when p.set_per_vincere = 2 and pr.set_perdente = set_perdente_reali then 5 else 0 end
        + coalesce((select sum(punti_set(pr.game_a[i], pr.game_b[i], p.game_a[i], p.game_b[i]))
                    from generate_subscripts(pr.game_a, 1) as i), 0)
        + case when pr.game_a is not null and pr.set_perdente = set_perdente_reali
                    and pr.game_a = p.game_a[1:cardinality(pr.game_a)] and pr.game_b = p.game_b[1:cardinality(pr.game_b)]
               then 10 else 0 end
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
  punti_vincitore := punti_rarita(30, voti_vincitore, voti_totali, n_coppie);
  punti_finalista := punti_rarita(15, voti_finalista_giusto, voti_finalisti, n_coppie);
  update pronostici_torneo pr set
    mese = date_trunc('month', t.data_fine)::date,
    punti = (case when pr.vincitore_id = f.vincitore_id then punti_vincitore else 0 end)
          + (case when pr.finalista_id = perdente then punti_finalista else 0 end)
  where pr.tabellone_id = p_tabellone;
end $$;

-- Ricalcolo dei punti già assegnati con la nuova scala
do $$ begin
  perform calcola_punti_partita(id) from partite where stato = 'conclusa';
  perform calcola_punti_tabellone(tb.id) from tabelloni tb join tornei t on t.id = tb.torneo_id where t.stato = 'concluso';
end $$;
