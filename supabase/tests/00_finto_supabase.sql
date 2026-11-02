-- Imitazione minima di Supabase per provare lo schema su un Postgres qualunque:
-- schema auth con utenti e auth.uid(), ruoli anon/authenticated/service_role, permessi predefiniti.
-- Su Supabase vero tutto questo esiste già: questo file NON va eseguito lì.

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- come fa Supabase: tabelle e funzioni del public sono concesse a tutti, la sicurezza la fa la RLS
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
