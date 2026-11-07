-- Punti set per set (sostituisce i game totali e il bonus esatto/quasi esatto).
--
--   vincitore giusto                         3
--   risultato in set giusto: 2-0 → 5, 2-1 → 4   (chi indovina un 2-0 prende un punto in più)
--   ogni set (1° e 2°): differenza di game |a-a'| + |b-b'|      0 → 3, 1 → 2, 2 → 1, oltre 0
--   long tie-break: differenza di punti |a-a'| + |b-b'|         0 → 3, 1 → 2, 2 → 1, oltre 0
-- Con il ritiro contano solo i punti del vincitore. Valori in regole_punti.
-- Colonne del dettaglio: punti_set = risultato in set, punti_game = 1° + 2° set, punti_long = long,
-- errore_game = somma delle differenze sui set (0 = set indovinati esatti, per la classifica).

insert into public.regole_punti (chiave, punti, descrizione) values
  ('set_esatti_2_0', 5, 'Risultato in set giusto quando finisce 2-0'),
  ('set_errore_0', 3, 'Game di un set esatti'),
  ('set_errore_1', 2, 'Game di un set sbagliati di 1'),
  ('set_errore_2', 1, 'Game di un set sbagliati di 2'),
  ('long_errore_0', 3, 'Long tie-break esatto'),
  ('long_errore_1', 2, 'Long tie-break sbagliato di 1 punto'),
  ('long_errore_2', 1, 'Long tie-break sbagliato di 2 punti')
on conflict (chiave) do update set punti = excluded.punti, descrizione = excluded.descrizione;
update public.regole_punti set descrizione = 'Risultato in set giusto quando finisce 2-1 (o set unico)' where chiave = 'set_esatti';
-- regole non più usate: restano a 0
update public.regole_punti set punti = 0, descrizione = 'Non più usata (sostituita dai punti set per set)'
where chiave in ('game_errore_0', 'game_errore_1', 'game_errore_2', 'game_errore_3', 'game_errore_4', 'esatto', 'quasi_esatto', 'long_vicino', 'long_errore_max');

/** Punti di un set o del long secondo la differenza: regola '<prefisso>_errore_<n>', 0 se manca. */
create or replace function public.punti_differenza(prefisso text, pa int, pb int, ra int, rb int) returns int
language sql stable set search_path = public as $$
  select case when pa is null or pb is null or ra is null or rb is null then 0
              else regola(prefisso || '_errore_' || (abs(pa - ra) + abs(pb - rb))) end
$$;

create or replace function public.calcola_punti_partita(p_partita uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p partite;
  set_perdente_reali int;
  n_set int;
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
  end if;
  n_set := p.set_per_vincere; -- set "normali": 1° e 2° (il 3° al meglio dei 3 è il long)

  update pronostici_partita pr set
    mese = date_trunc('month', p.inizio_at at time zone 'UTC')::date,
    punti_vincitore = case when pr.vincitore_id = p.vincitore_id then regola('vincitore') else 0 end,
    punti_set = case
      when p.ritiro or pr.vincitore_id <> p.vincitore_id or pr.set_perdente is distinct from set_perdente_reali then 0
      when p.set_per_vincere = 2 and set_perdente_reali = 0 then regola('set_esatti_2_0')
      else regola('set_esatti') end,
    punti_game = case when p.ritiro or pr.game_a is null then 0 else
      coalesce((select sum(punti_differenza('set', pr.game_a[i], pr.game_b[i], p.game_a[i], p.game_b[i]))
                from generate_series(1, n_set) as i), 0) end,
    errore_game = case when p.ritiro or pr.game_a is null then null else
      (select sum(abs(pr.game_a[i] - p.game_a[i]) + abs(pr.game_b[i] - p.game_b[i])) from generate_series(1, n_set) as i) end,
    punti_long = case when p.ritiro or p.set_per_vincere <> 2 or cardinality(p.game_a) < 3 or coalesce(cardinality(pr.game_a), 0) < 3 then 0
      else punti_differenza('long', pr.game_a[3], pr.game_b[3], p.game_a[3], p.game_b[3]) end
  where pr.partita_id = p_partita;

  update pronostici_partita pr set punti = pr.punti_vincitore + pr.punti_set + pr.punti_game + pr.punti_long
  where pr.partita_id = p_partita;
end $$;
revoke execute on function public.calcola_punti_partita(uuid) from public, anon, authenticated;

do $$ begin
  perform calcola_punti_partita(id) from partite where stato = 'conclusa';
end $$;
