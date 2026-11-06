-- Regolamento dei pronostici (versione definitiva, sostituisce il "risultato esatto per set").
--
-- Pronostico su una partita: coppia vincente + risultato dei set (2-0 / 2-1 dal lato del vincitore)
-- + game totali previsti per la coppia A e per la coppia B. Il super tie-break vale 1 game per chi lo vince.
--
-- Punti (massimo 12, cumulabili), letti dalla tabella regole_punti così si possono cambiare senza toccare il codice:
--   vincitore corretto          3
--   risultato dei set esatto    4
--   game: errore complessivo |A - a| + |B - b|  →  0: 5, 1: 4, 2: 3, 3: 2, 4: 1, oltre: 0
-- Con il ritiro contano solo i punti del vincitore.
-- Classifica: punti, poi set esatti, vincitori indovinati, game esatti.

-- ---------------------------------------------------------------------------
-- Regole modificabili
-- ---------------------------------------------------------------------------
create table if not exists public.regole_punti (
  chiave text primary key,
  punti smallint not null check (punti between 0 and 100),
  descrizione text not null
);
insert into public.regole_punti (chiave, punti, descrizione) values
  ('vincitore', 3, 'Vincitore corretto'),
  ('set_esatti', 4, 'Risultato dei set esatto (2-0 / 2-1)'),
  ('game_errore_0', 5, 'Game esatti'),
  ('game_errore_1', 4, 'Game con errore complessivo di 1'),
  ('game_errore_2', 3, 'Game con errore complessivo di 2'),
  ('game_errore_3', 2, 'Game con errore complessivo di 3'),
  ('game_errore_4', 1, 'Game con errore complessivo di 4'),
  ('torneo_vincitore', 10, 'Vincitore del torneo (pesato sulla rarità)'),
  ('torneo_finalista', 5, 'Finalista del torneo (pesato sulla rarità)')
on conflict (chiave) do update set punti = excluded.punti, descrizione = excluded.descrizione;

alter table public.regole_punti enable row level security;
drop policy if exists "lettura pubblica" on public.regole_punti;
create policy "lettura pubblica" on public.regole_punti for select using (true);
drop policy if exists "admin modifica" on public.regole_punti;
create policy "admin modifica" on public.regole_punti for update using (public.is_admin());
grant select on public.regole_punti to anon, authenticated;
grant update (punti) on public.regole_punti to authenticated;

create or replace function public.regola(p_chiave text) returns int
language sql stable set search_path = public as $$
  select coalesce((select punti from regole_punti where chiave = p_chiave), 0)
$$;

-- ---------------------------------------------------------------------------
-- Pronostico: game totali previsti e dettaglio dei punti
-- ---------------------------------------------------------------------------
alter table public.pronostici_partita
  add column if not exists game_previsti_a smallint check (game_previsti_a between 0 and 30),
  add column if not exists game_previsti_b smallint check (game_previsti_b between 0 and 30),
  add column if not exists punti_vincitore smallint,
  add column if not exists punti_set smallint,
  add column if not exists punti_game smallint,
  add column if not exists errore_game smallint;
grant insert (game_previsti_a, game_previsti_b) on public.pronostici_partita to authenticated;
grant update (game_previsti_a, game_previsti_b) on public.pronostici_partita to authenticated;

/** Game totali di una partita: i set normali più 1 game a chi vince il super tie-break (terzo set al meglio dei 3). */
create or replace function public.game_totali(a smallint[], b smallint[], set_per_vincere smallint, out game_a int, out game_b int)
language sql immutable as $$
  select
    coalesce(sum(case when set_per_vincere = 2 and i = 3 then (a[i] > b[i])::int else a[i] end), 0)::int,
    coalesce(sum(case when set_per_vincere = 2 and i = 3 then (b[i] > a[i])::int else b[i] end), 0)::int
  from generate_subscripts(a, 1) as i
$$;

/** Coppie di totali (vincitore, perdente) possibili per un risultato in set: 2-0, 2-1 o set unico (1-0). */
create or replace function public.game_possibili(set_vinti int, set_persi int, game_vincitore int, game_perdente int) returns boolean
language sql immutable as $$
  with s(v, p) as (values (6, 0), (6, 1), (6, 2), (6, 3), (6, 4), (7, 5), (7, 6))
  select case
    when set_vinti = 1 and set_persi = 0 then exists (select 1 from s where s.v = game_vincitore and s.p = game_perdente)
    when set_vinti = 2 and set_persi = 0 then exists (select 1 from s s1, s s2 where s1.v + s2.v = game_vincitore and s1.p + s2.p = game_perdente)
    -- 2-1: un set vinto (v1-p1), uno perso (p2-v2 dal lato del vincitore), super tie-break = 1 game
    when set_vinti = 2 and set_persi = 1 then exists (select 1 from s s1, s s2 where s1.v + s2.p + 1 = game_vincitore and s1.p + s2.v = game_perdente)
    else false
  end
$$;

create or replace function public.valida_pronostico_partita() returns trigger
language plpgsql set search_path = public as $$
declare
  p partite;
  gv int;
  gp int;
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
  if new.set_vincitore is not null and new.set_vincitore <> p.set_per_vincere then
    raise exception 'Il punteggio in set non è compatibile con il formato della partita';
  end if;
  if new.game_previsti_a is not null or new.game_previsti_b is not null then
    if new.game_previsti_a is null or new.game_previsti_b is null or new.set_vincitore is null or new.set_perdente is null then
      raise exception 'Indica il risultato dei set e i game di entrambe le coppie';
    end if;
    if new.vincitore_id = p.coppia_a_id then gv := new.game_previsti_a; gp := new.game_previsti_b;
    else gv := new.game_previsti_b; gp := new.game_previsti_a; end if;
    if not game_possibili(new.set_vincitore, new.set_perdente, gv, gp) then
      raise exception 'Game non possibili con questo risultato dei set';
    end if;
  end if;
  new.aggiornato_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Calcolo dei punti
-- ---------------------------------------------------------------------------
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
    update pronostici_partita set punti = null, mese = null, punti_vincitore = null, punti_set = null, punti_game = null, errore_game = null
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
                       then abs(pr.game_previsti_a - reali_a) + abs(pr.game_previsti_b - reali_b) end
  where pr.partita_id = p_partita;

  update pronostici_partita pr set
    punti_game = case when pr.errore_game is null then 0 else regola('game_errore_' || pr.errore_game) end
  where pr.partita_id = p_partita;
  update pronostici_partita pr set punti = pr.punti_vincitore + pr.punti_set + pr.punti_game
  where pr.partita_id = p_partita;
end $$;
revoke execute on function public.calcola_punti_partita(uuid) from public, anon, authenticated;

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
  punti_vincitore := punti_rarita(regola('torneo_vincitore'), voti_vincitore, voti_totali, n_coppie);
  punti_finalista := punti_rarita(regola('torneo_finalista'), voti_finalista_giusto, voti_finalisti, n_coppie);
  update pronostici_torneo pr set
    mese = date_trunc('month', t.data_fine)::date,
    punti = (case when pr.vincitore_id = f.vincitore_id then punti_vincitore else 0 end)
          + (case when pr.finalista_id = perdente then punti_finalista else 0 end)
  where pr.tabellone_id = p_tabellone;
end $$;
revoke execute on function public.calcola_punti_tabellone(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Classifica con statistiche e spareggi
-- ---------------------------------------------------------------------------
drop function if exists public.mia_posizione(date, text, char, uuid);
drop function if exists public.classifica(date, text, char, uuid, int);

create function public.classifica(
  p_mese date,
  p_ambito text default 'globale', -- 'globale' | 'paese' | 'lega'
  p_paese char(2) default null,
  p_lega uuid default null,
  p_limite int default 100
) returns table (
  posizione bigint, utente_id uuid, nickname text, paese char(2), punti bigint,
  pronostici bigint, vincitori bigint, set_esatti bigint, game_esatti bigint
)
language sql stable security definer set search_path = public as $$
  with mese as (select date_trunc('month', p_mese)::date as m),
  righe as (
    select pp.utente_id, pp.punti, 1 as pronostico, (pp.punti_vincitore > 0)::int as vincitore,
           (pp.punti_set > 0)::int as set_esatto, (pp.errore_game = 0)::int as game_esatto
    from pronostici_partita pp, mese where pp.mese = mese.m and pp.punti is not null
    union all
    select pt.utente_id, pt.punti, 0, 0, 0, 0 from pronostici_torneo pt, mese where pt.mese = mese.m and pt.punti is not null
  ),
  totali as (
    select r.utente_id, sum(r.punti)::bigint as punti, sum(r.pronostico)::bigint as pronostici, sum(r.vincitore)::bigint as vincitori,
           sum(r.set_esatto)::bigint as set_esatti, sum(coalesce(r.game_esatto, 0))::bigint as game_esatti
    from righe r group by r.utente_id
  ),
  filtrati as (
    select t.*, pr.nickname, pr.paese from totali t join profili pr on pr.id = t.utente_id
    where p_ambito = 'globale'
       or (p_ambito = 'paese' and pr.paese = p_paese)
       or (p_ambito = 'lega' and public.sono_membro(p_lega)
           and exists (select 1 from leghe_membri lm where lm.lega_id = p_lega and lm.utente_id = t.utente_id))
  )
  select rank() over (order by f.punti desc, f.set_esatti desc, f.vincitori desc, f.game_esatti desc),
         f.utente_id, f.nickname, f.paese, f.punti, f.pronostici, f.vincitori, f.set_esatti, f.game_esatti
  from filtrati f
  order by f.punti desc, f.set_esatti desc, f.vincitori desc, f.game_esatti desc, f.nickname
  limit p_limite
$$;

create function public.mia_posizione(p_mese date, p_ambito text default 'globale', p_paese char(2) default null, p_lega uuid default null)
returns table (posizione bigint, punti bigint, partecipanti bigint)
language sql stable security definer set search_path = public as $$
  with c as (select * from public.classifica(p_mese, p_ambito, p_paese, p_lega, null))
  select c.posizione, c.punti, (select count(*) from c) from c where c.utente_id = auth.uid()
$$;

-- Ricalcolo con le nuove regole
do $$ begin
  perform calcola_punti_partita(id) from partite where stato = 'conclusa';
  perform calcola_punti_tabellone(tb.id) from tabelloni tb join tornei t on t.id = tb.torneo_id where t.stato = 'concluso';
end $$;
