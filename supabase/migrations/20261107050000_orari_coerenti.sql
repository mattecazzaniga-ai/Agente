-- Orari coerenti con il torneo.
-- 1) Una partita conclusa non può avere l'orario nel futuro: se il risultato arriva prima, l'orario diventa "adesso".
-- 2) Il turno successivo creato dall'avanzamento va al giorno dopo, ma mai oltre l'ultimo giorno del torneo.

create or replace function public.conclusa_non_futura() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.stato = 'conclusa' and new.inizio_at > now() then
    new.inizio_at := now();
  end if;
  return new;
end $$;

drop trigger if exists conclusa_non_futura on public.partite;
create trigger conclusa_non_futura before insert or update of stato, inizio_at on public.partite
for each row execute function public.conclusa_non_futura();

create or replace function public.avanza_vincitore() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  prossimo public.turno := turno_successivo(new.turno);
  posizione smallint := ((new.ordine + 1) / 2)::smallint;
  in_a boolean := new.ordine % 2 = 1;
  id_prossima uuid;
  ultimo_giorno date;
  quando timestamptz;
begin
  if prossimo is null or new.ordine < 1 then return null; end if;
  -- solo quando cambia il vincitore di una partita conclusa
  if new.stato <> 'conclusa' or (tg_op = 'UPDATE' and old.stato = 'conclusa' and old.vincitore_id is not distinct from new.vincitore_id) then
    return null;
  end if;
  select id into id_prossima from partite where tabellone_id = new.tabellone_id and turno = prossimo and ordine = posizione;
  if id_prossima is null then
    select t.data_fine into ultimo_giorno from tabelloni tb join tornei t on t.id = tb.torneo_id where tb.id = new.tabellone_id;
    quando := new.inizio_at + interval '1 day';
    -- mai dopo l'ultimo giorno del torneo (stessa ora del giorno)
    if ultimo_giorno is not null and (quando at time zone 'UTC')::date > ultimo_giorno then
      quando := (ultimo_giorno + (new.inizio_at at time zone 'UTC')::time) at time zone 'UTC';
    end if;
    insert into partite (tabellone_id, turno, ordine, inizio_at, set_per_vincere)
    values (new.tabellone_id, prossimo, posizione, quando, new.set_per_vincere)
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
revoke execute on function public.avanza_vincitore() from public, anon, authenticated;
revoke execute on function public.conclusa_non_futura() from public, anon, authenticated;

-- Sistemazione dei dati già presenti
update public.partite set inizio_at = now() where stato = 'conclusa' and inizio_at > now();
update public.partite p
set inizio_at = (t.data_fine + (p.inizio_at at time zone 'UTC')::time) at time zone 'UTC'
from public.tabelloni tb join public.tornei t on t.id = tb.torneo_id
where tb.id = p.tabellone_id and p.stato = 'in_programma' and t.data_fine is not null
  and (p.inizio_at at time zone 'UTC')::date > t.data_fine;
