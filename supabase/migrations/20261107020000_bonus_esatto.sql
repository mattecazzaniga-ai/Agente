-- Bonus semplice e uguale per tutti al posto del "long vicino":
-- risultato esatto +2, sbagliato di uno solo (un game di un set o un punto del long) +1.
-- Conta tutto il punteggio pronosticato (set e, se c'è, long) e vale solo se il risultato in set è giusto
-- (stesso numero di set e stesso vincitore). Valori in regole_punti: esatto, quasi_esatto.

insert into public.regole_punti (chiave, punti, descrizione) values
  ('esatto', 2, 'Punteggio esatto (tutti i set e il long)'),
  ('quasi_esatto', 1, 'Punteggio sbagliato di uno solo (un game o un punto del long)')
on conflict (chiave) do update set punti = excluded.punti, descrizione = excluded.descrizione;
-- il vecchio bonus del long non si usa più: resta a 0 per non far comparire punti fantasma
update public.regole_punti set punti = 0, descrizione = 'Non più usata (sostituita da esatto / quasi_esatto)' where chiave in ('long_vicino', 'long_errore_max');

create or replace function public.calcola_punti_partita(p_partita uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p partite;
  set_perdente_reali int;
  reali_a int;
  reali_b int;
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

  update pronostici_partita pr set
    mese = date_trunc('month', p.inizio_at at time zone 'UTC')::date,
    punti_vincitore = case when pr.vincitore_id = p.vincitore_id then regola('vincitore') else 0 end,
    punti_set = case when not p.ritiro and pr.vincitore_id = p.vincitore_id and pr.set_perdente = set_perdente_reali then regola('set_esatti') else 0 end,
    errore_game = case when not p.ritiro and pr.game_previsti_a is not null
                       then abs(pr.game_previsti_a - reali_a) + abs(pr.game_previsti_b - reali_b) end,
    -- bonus punteggio: errore complessivo su tutti i numeri (set e long), solo con lo stesso numero di set
    punti_long = case
      when p.ritiro or pr.vincitore_id <> p.vincitore_id or pr.game_a is null
           or cardinality(pr.game_a) <> cardinality(p.game_a) then 0
      else case (select sum(abs(pr.game_a[i] - p.game_a[i]) + abs(pr.game_b[i] - p.game_b[i])) from generate_subscripts(pr.game_a, 1) as i)
             when 0 then regola('esatto') when 1 then regola('quasi_esatto') else 0 end
    end
  where pr.partita_id = p_partita;

  update pronostici_partita pr set
    punti_game = case when pr.errore_game is null then 0 else regola('game_errore_' || pr.errore_game) end
  where pr.partita_id = p_partita;
  update pronostici_partita pr set punti = pr.punti_vincitore + pr.punti_set + pr.punti_game + pr.punti_long
  where pr.partita_id = p_partita;
end $$;
revoke execute on function public.calcola_punti_partita(uuid) from public, anon, authenticated;

do $$ begin
  perform calcola_punti_partita(id) from partite where stato = 'conclusa';
end $$;
