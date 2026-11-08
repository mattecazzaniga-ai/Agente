-- Stagioni decise dall'admin (nome, inizio, fine): classifica di stagione e conto alla rovescia.
create table if not exists public.stagioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 40),
  inizio date not null,
  fine date not null,
  creato_at timestamptz not null default now(),
  check (fine >= inizio)
);
alter table public.stagioni enable row level security;
drop policy if exists "stagioni leggibili" on public.stagioni;
create policy "stagioni leggibili" on public.stagioni for select using (true);
drop policy if exists "admin scrive stagioni" on public.stagioni;
create policy "admin scrive stagioni" on public.stagioni for all using (public.is_admin()) with check (public.is_admin());
grant select on public.stagioni to anon, authenticated;
grant insert, update, delete on public.stagioni to authenticated;

-- La prima stagione: da inizio novembre a fine anno (l'admin la può cambiare)
insert into public.stagioni (nome, inizio, fine)
select 'Stagione 2026', date '2026-11-01', date '2026-12-31'
where not exists (select 1 from public.stagioni);

-- Classifica su un periodo contando la data vera di ogni partita (e la fine del torneo per il vincitore del tabellone)
create or replace function public.classifica_periodo(
  p_dal date, p_al date,
  p_ambito text default 'globale', p_paese char(2) default null, p_lega uuid default null, p_limite int default 100
) returns table (
  posizione bigint, utente_id uuid, nickname text, paese char(2), punti bigint,
  pronostici bigint, vincitori bigint, set_esatti bigint, game_esatti bigint
)
language sql stable security definer set search_path = public as $$
  with righe as (
    select pp.utente_id, pp.punti, 1 as pronostico, (pp.punti_vincitore > 0)::int as vincitore,
           (pp.punti_set > 0)::int as set_esatto, (pp.errore_game = 0)::int as game_esatto
    from pronostici_partita pp join partite p on p.id = pp.partita_id
    where pp.punti is not null and (p.inizio_at at time zone 'Europe/Rome')::date between p_dal and p_al
    union all
    select pt.utente_id, pt.punti, 0, 0, 0, 0
    from pronostici_torneo pt join tabelloni tb on tb.id = pt.tabellone_id join tornei t on t.id = tb.torneo_id
    where pt.punti is not null and t.data_fine between p_dal and p_al
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
