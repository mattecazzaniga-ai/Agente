-- Beach Peck 2.0: articoli completi nelle notizie, gestione delle leghe, classifica di stagione.

-- ---------------------------------------------------------------------------
-- Notizie: da semplice link a articolo completo (la fonte esterna diventa facoltativa)
-- ---------------------------------------------------------------------------
alter table public.notizie alter column fonte_nome drop not null;
alter table public.notizie alter column url_originale drop not null;
alter table public.notizie
  add column if not exists categoria text not null default 'itf'
    check (categoria in ('itf', 'risultati', 'giocatori', 'ranking', 'curiosita', 'beachpeck')),
  add column if not exists immagine_url text check (immagine_url ~ '^https?://'),
  add column if not exists credito_immagine text check (char_length(credito_immagine) <= 120),
  add column if not exists torneo_id uuid references public.tornei (id) on delete set null,
  add column if not exists autore text check (char_length(autore) <= 80),
  add column if not exists in_evidenza boolean not null default false;
alter table public.notizie_traduzioni add column if not exists corpo text check (char_length(corpo) <= 20000);
create index if not exists notizie_torneo on public.notizie (torneo_id) where torneo_id is not null;

-- Pubblicazione programmata: una notizia "pubblicata" con data futura si vede solo da quel momento
drop policy if exists "notizie pubblicate" on public.notizie;
create policy "notizie pubblicate" on public.notizie for select
  using ((stato = 'pubblicata' and pubblicata_at <= now()) or public.is_admin());
drop policy if exists "traduzioni pubblicate" on public.notizie_traduzioni;
create policy "traduzioni pubblicate" on public.notizie_traduzioni for select
  using (exists (select 1 from public.notizie n where n.id = notizia_id and ((n.stato = 'pubblicata' and n.pubblicata_at <= now()) or public.is_admin())));

-- Foto degli articoli (lettura pubblica, scrittura solo admin). Il database di test non ha lo schema storage.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('notizie', 'notizie', true) on conflict (id) do update set public = true;
    execute 'drop policy if exists "notizie lettura" on storage.objects';
    execute 'create policy "notizie lettura" on storage.objects for select using (bucket_id = ''notizie'')';
    execute 'drop policy if exists "notizie admin" on storage.objects';
    execute 'create policy "notizie admin" on storage.objects for all to authenticated using (bucket_id = ''notizie'' and public.is_admin()) with check (bucket_id = ''notizie'' and public.is_admin())';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Leghe: chi l'ha creata la gestisce (nome, membri, eliminazione)
-- ---------------------------------------------------------------------------
create or replace function public.rinomina_lega(p_lega uuid, p_nome text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from leghe where id = p_lega and creata_da = auth.uid()) then raise exception 'Solo chi ha creato la lega può cambiarla'; end if;
  update leghe set nome = trim(p_nome) where id = p_lega;
end $$;

create or replace function public.rimuovi_membro(p_lega uuid, p_utente uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from leghe where id = p_lega and creata_da = auth.uid()) then raise exception 'Solo chi ha creato la lega può togliere membri'; end if;
  if p_utente = auth.uid() then raise exception 'Non puoi toglierti: elimina la lega'; end if;
  delete from leghe_membri where lega_id = p_lega and utente_id = p_utente;
end $$;

create or replace function public.elimina_lega(p_lega uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from leghe where id = p_lega and creata_da = auth.uid()) then raise exception 'Solo chi ha creato la lega può eliminarla'; end if;
  delete from leghe where id = p_lega;
end $$;

-- Chi crea la lega non può uscirne lasciandola senza proprietario: la elimina
create or replace function public.esci_lega(p_lega uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from leghe where id = p_lega and creata_da = auth.uid()) then raise exception 'Hai creato tu la lega: puoi eliminarla dalla sua pagina'; end if;
  delete from leghe_membri where lega_id = p_lega and utente_id = auth.uid();
end $$;

revoke execute on function public.rinomina_lega(uuid, text), public.rimuovi_membro(uuid, uuid), public.elimina_lega(uuid) from public, anon;
grant execute on function public.rinomina_lega(uuid, text), public.rimuovi_membro(uuid, uuid), public.elimina_lega(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Classifica su un periodo (stagione): stessi conti e spareggi della mensile
-- ---------------------------------------------------------------------------
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
    from pronostici_partita pp where pp.mese between p_dal and p_al and pp.punti is not null
    union all
    select pt.utente_id, pt.punti, 0, 0, 0, 0 from pronostici_torneo pt where pt.mese between p_dal and p_al and pt.punti is not null
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
grant execute on function public.classifica_periodo(date, date, text, char, uuid, int) to anon, authenticated;
