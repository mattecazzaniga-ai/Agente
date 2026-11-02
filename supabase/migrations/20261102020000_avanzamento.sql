-- Avanzamento automatico nel tabellone: quando una partita si conclude, la coppia vincitrice entra
-- nella partita del turno successivo (che si crea se non c'è). Così l'admin inserisce solo i punteggi.
-- Posizioni: la partita n (ordine 1, 2, 3…) di un turno manda il vincitore nella partita ceil(n/2)
-- del turno dopo, come coppia A se n è dispari, come coppia B se n è pari.

create or replace function public.turno_successivo(t public.turno) returns public.turno
language sql immutable as $$
  select case t when 'R64' then 'R32' when 'R32' then 'R16' when 'R16' then 'QF' when 'QF' then 'SF' when 'SF' then 'F' end::public.turno
$$;

create or replace function public.avanza_vincitore() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  prossimo public.turno := turno_successivo(new.turno);
  posizione smallint := ((new.ordine + 1) / 2)::smallint;
  in_a boolean := new.ordine % 2 = 1;
  id_prossima uuid;
begin
  if prossimo is null or new.ordine < 1 then return null; end if;
  -- solo quando cambia il vincitore di una partita conclusa
  if new.stato <> 'conclusa' or (tg_op = 'UPDATE' and old.stato = 'conclusa' and old.vincitore_id is not distinct from new.vincitore_id) then
    return null;
  end if;
  select id into id_prossima from partite where tabellone_id = new.tabellone_id and turno = prossimo and ordine = posizione;
  if id_prossima is null then
    insert into partite (tabellone_id, turno, ordine, inizio_at, set_per_vincere)
    values (new.tabellone_id, prossimo, posizione, new.inizio_at + interval '1 day', new.set_per_vincere)
    returning id into id_prossima;
  end if;
  -- la partita successiva si aggiorna solo se non è ancora cominciata
  if in_a then
    update partite set coppia_a_id = new.vincitore_id where id = id_prossima and stato = 'in_programma';
  else
    update partite set coppia_b_id = new.vincitore_id where id = id_prossima and stato = 'in_programma';
  end if;
  return null;
end $$;

create trigger partite_avanza after insert or update on public.partite
for each row execute function public.avanza_vincitore();

-- Le partite dello stesso turno hanno posizioni diverse
create unique index partite_posizione on public.partite (tabellone_id, turno, ordine) where ordine > 0;

revoke execute on function public.avanza_vincitore() from public, anon, authenticated;
