-- Premi della classifica mensile (1°, 2°, 3°) e sponsor, gestiti dall'admin e visibili a tutti.

create table if not exists public.premi (
  posizione smallint primary key check (posizione between 1 and 3),
  descrizione text not null check (char_length(descrizione) between 1 and 120),
  aggiornato_at timestamptz not null default now()
);

create table if not exists public.sponsor (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 80),
  link text check (link is null or link ~ '^https?://'),
  logo_url text not null check (logo_url ~ '^https?://'),
  ordine smallint not null default 0,
  attivo boolean not null default true,
  creato_at timestamptz not null default now()
);

alter table public.premi enable row level security;
alter table public.sponsor enable row level security;
drop policy if exists "lettura pubblica" on public.premi;
create policy "lettura pubblica" on public.premi for select using (true);
drop policy if exists "admin scrive" on public.premi;
create policy "admin scrive" on public.premi for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "lettura pubblica" on public.sponsor;
create policy "lettura pubblica" on public.sponsor for select using (attivo or public.is_admin());
drop policy if exists "admin scrive" on public.sponsor;
create policy "admin scrive" on public.sponsor for all using (public.is_admin()) with check (public.is_admin());
grant select on public.premi, public.sponsor to anon, authenticated;
grant insert, update, delete on public.premi, public.sponsor to authenticated;

-- Loghi degli sponsor: cartella pubblica in Supabase Storage, scrittura solo per l'admin.
-- (Il database di test non ha lo schema storage: la parte si salta.)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('sponsor', 'sponsor', true) on conflict (id) do update set public = true;
    execute 'drop policy if exists "sponsor lettura" on storage.objects';
    execute 'create policy "sponsor lettura" on storage.objects for select using (bucket_id = ''sponsor'')';
    execute 'drop policy if exists "sponsor admin" on storage.objects';
    execute 'create policy "sponsor admin" on storage.objects for all to authenticated using (bucket_id = ''sponsor'' and public.is_admin()) with check (bucket_id = ''sponsor'' and public.is_admin())';
  end if;
end $$;
