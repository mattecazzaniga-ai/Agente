-- Pronostico set per set con il long tie-break.
--
-- Il pronostico ora contiene il punteggio del 1° e del 2° set e, se finisce 2-1, il long tie-break a 10
-- (game_a / game_b dal lato delle coppie A e B, come il risultato reale, es. {6,4,10} e {4,6,8}).
-- Da questi il database ricava il risultato dei set e i game totali (super tie-break = 1 game a chi lo vince),
-- quindi le regole già in vigore restano uguali: vincitore 3, set esatti 4, game 5/4/3/2/1.
-- Nuovo: long tie-break "vicino" +2 se la partita va al long, l'avevi previsto e sbagli di 2 punti o meno
-- in totale (|a - a'| + |b - b'| <= 2). Valori in regole_punti: long_vicino (punti) e long_errore_max (soglia).

insert into public.regole_punti (chiave, punti, descrizione) values
  ('long_vicino', 2, 'Long tie-break previsto con errore complessivo entro la soglia'),
  ('long_errore_max', 2, 'Soglia di errore (punti) per il bonus del long tie-break')
on conflict (chiave) do update set punti = excluded.punti, descrizione = excluded.descrizione;

alter table public.pronostici_partita add column if not exists punti_long smallint;

/** Long tie-break finito: chi vince ha almeno 10 punti e 2 di scarto; oltre il 10 lo scarto è esattamente 2. */
create or replace function public.tiebreak_valido(a int, b int) returns boolean
language sql immutable as $$
  select a between 0 and 40 and b between 0 and 40
     and greatest(a, b) >= 10 and abs(a - b) >= 2
     and (greatest(a, b) = 10 or abs(a - b) = 2)
$$;

create or replace function public.valida_pronostico_partita() returns trigger
language plpgsql set search_path = public as $$
declare
  p partite;
  gv int;
  gp int;
  vince_a boolean;
  vinti int := 0;
  persi int := 0;
  n int;
begin
  if tg_op = 'UPDATE' and new.vincitore_id is not distinct from old.vincitore_id and new.set_vincitore is not distinct from old.set_vincitore
     and new.set_perdente is not distinct from old.set_perdente and new.totale_game is not distinct from old.totale_game
     and new.game_a is not distinct from old.game_a and new.game_b is not distinct from old.game_b
     and new.game_previsti_a is not distinct from old.game_previsti_a and new.game_previsti_b is not distinct from old.game_previsti_b
     and new.partita_id = old.partita_id then
    return new;
  end if;
  if not partita_aperta(new.partita_id) then
    raise exception 'Pronostici chiusi: la partita è già iniziata';
  end if;
  select * into p from partite where id = new.partita_id;
  if new.vincitore_id not in (p.coppia_a_id, p.coppia_b_id) then
    raise exception 'Scegli una delle due coppie della partita';
  end if;
  vince_a := new.vincitore_id = p.coppia_a_id;

  if new.game_a is not null or new.game_b is not null then
    -- Pronostico set per set (con eventuale long tie-break come terzo "set")
    n := coalesce(cardinality(new.game_a), 0);
    if new.game_a is null or new.game_b is null or n <> coalesce(cardinality(new.game_b), 0) or n < p.set_per_vincere or n > 2 * p.set_per_vincere - 1 then
      raise exception 'Indica il punteggio di ogni set';
    end if;
    for i in 1 .. n loop
      if p.set_per_vincere = 2 and i = 3 then
        if not tiebreak_valido(new.game_a[i], new.game_b[i]) then raise exception 'Punteggio del long tie-break non valido'; end if;
      elsif not set_valido(new.game_a[i], new.game_b[i]) then
        raise exception 'Punteggio del set % non valido', i;
      end if;
      if (new.game_a[i] > new.game_b[i]) = vince_a then vinti := vinti + 1; else persi := persi + 1; end if;
    end loop;
    if vinti <> p.set_per_vincere or (n = 3 and (new.game_a[3] > new.game_b[3]) <> vince_a) then
      raise exception 'Il risultato dei set non corrisponde al vincitore scelto';
    end if;
    new.set_vincitore := vinti;
    new.set_perdente := persi;
    select t.game_a, t.game_b into new.game_previsti_a, new.game_previsti_b from game_totali(new.game_a, new.game_b, p.set_per_vincere) t;
    new.totale_game := null;
  else
    -- Pronostico con i soli game totali (versione precedente, ancora valida per i pronostici già salvati)
    if new.set_vincitore is not null and new.set_vincitore <> p.set_per_vincere then
      raise exception 'Il punteggio in set non è compatibile con il formato della partita';
    end if;
    if new.game_previsti_a is not null or new.game_previsti_b is not null then
      if new.game_previsti_a is null or new.game_previsti_b is null or new.set_vincitore is null or new.set_perdente is null then
        raise exception 'Indica il risultato dei set e i game di entrambe le coppie';
      end if;
      if vince_a then gv := new.game_previsti_a; gp := new.game_previsti_b;
      else gv := new.game_previsti_b; gp := new.game_previsti_a; end if;
      if not game_possibili(new.set_vincitore, new.set_perdente, gv, gp) then
        raise exception 'Game non possibili con questo risultato dei set';
      end if;
    end if;
  end if;
  new.aggiornato_at := now();
  return new;
end $$;

create or replace function public.calcola_punti_partita(p_partita uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p partite;
  set_perdente_reali int;
  reali_a int;
  reali_b int;
  long_reale boolean;
begin
  select * into p from partite where id = p_partita;
  if p is null then return; end if;
  if p.stato <> 'conclusa' then
    update pronostici_partita set punti = null, mese = null, punti_vincitore = null, punti_set = null, punti_game = null, punti_long = null, errore_game = null
    where partita_id = p_partita and punti is not null;
    return;
  end if;
  if not p.ritiro then
    select least(v.vinti_a, v.vinti_b) into set_perdente_reali from set_vinti(p.game_a, p.game_b) v;
    select t.game_a, t.game_b into reali_a, reali_b from game_totali(p.game_a, p.game_b, p.set_per_vincere) t;
  end if;
  long_reale := not p.ritiro and p.set_per_vincere = 2 and cardinality(p.game_a) = 3;

  update pronostici_partita pr set
    mese = date_trunc('month', p.inizio_at at time zone 'UTC')::date,
    punti_vincitore = case when pr.vincitore_id = p.vincitore_id then regola('vincitore') else 0 end,
    punti_set = case when not p.ritiro and pr.vincitore_id = p.vincitore_id and pr.set_perdente = set_perdente_reali then regola('set_esatti') else 0 end,
    errore_game = case when not p.ritiro and pr.game_previsti_a is not null
                       then abs(pr.game_previsti_a - reali_a) + abs(pr.game_previsti_b - reali_b) end,
    punti_long = case when long_reale and cardinality(pr.game_a) = 3
                           and abs(pr.game_a[3] - p.game_a[3]) + abs(pr.game_b[3] - p.game_b[3]) <= regola('long_errore_max')
                      then regola('long_vicino') else 0 end
  where pr.partita_id = p_partita;

  update pronostici_partita pr set
    punti_game = case when pr.errore_game is null then 0 else regola('game_errore_' || pr.errore_game) end
  where pr.partita_id = p_partita;
  update pronostici_partita pr set punti = pr.punti_vincitore + pr.punti_set + pr.punti_game + pr.punti_long
  where pr.partita_id = p_partita;
end $$;
revoke execute on function public.calcola_punti_partita(uuid) from public, anon, authenticated;

-- Ricalcolo dei punti già assegnati
do $$ begin
  perform calcola_punti_partita(id) from partite where stato = 'conclusa';
end $$;
