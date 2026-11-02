-- BeachPick (nome provvisorio) — schema del database, FASE 1.
-- Notizie e pronostici di beach tennis. Solo punti virtuali: nessun denaro, nessun premio, nessuna scommessa.
-- Tutti i dati (tornei, giocatori, risultati, notizie) li inserisce a mano un amministratore.
--
-- Sicurezza: Row Level Security su ogni tabella. Le regole importanti (blocco dei pronostici,
-- calcolo dei punti, leghe) stanno nel database, così valgono qualunque cosa faccia il client.

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------

create type public.circuito as enum ('ITF', 'FIP', 'BR');
create type public.stato_torneo as enum ('in_programma', 'in_corso', 'concluso');
create type public.genere_tabellone as enum ('maschile', 'femminile', 'misto');
create type public.turno as enum ('R64', 'R32', 'R16', 'QF', 'SF', 'F');
create type public.stato_partita as enum ('in_programma', 'in_corso', 'conclusa', 'annullata');
create type public.stato_notizia as enum ('bozza', 'pubblicata');

-- ---------------------------------------------------------------------------
-- Profili e amministratori
-- ---------------------------------------------------------------------------

create table public.profili (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 3 and 24 and nickname ~ '^[A-Za-z0-9_.-]+$'),
  paese char(2) check (paese ~ '^[A-Z]{2}$'),
  lingua text not null default 'it' check (lingua in ('it', 'pt-BR', 'es', 'en')),
  profilo_completo boolean not null default false, -- diventa true dopo aver scelto nickname e Paese
  is_admin boolean not null default false,
  creato_at timestamptz not null default now()
);
create unique index profili_nickname_unico on public.profili (lower(nickname));
create index profili_paese on public.profili (paese);

/** L'utente collegato è amministratore? */
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profili where id = auth.uid()), false)
$$;

/** Alla registrazione nasce il profilo, con nickname provvisorio e lingua scelta prima del login. */
create function public.nuovo_utente() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  lingua text := coalesce(meta ->> 'lingua', 'it');
begin
  if lingua not in ('it', 'pt-BR', 'es', 'en') then lingua := 'it'; end if;
  -- nickname provvisorio unico: si cambia nell'onboarding; in caso di conflitto se ne genera un altro
  for tentativo in 0..20 loop
    begin
      insert into public.profili (id, nickname, lingua)
      values (new.id, 'giocatore_' || substr(md5(new.id::text || tentativo::text), 1, 10), lingua);
      return new;
    exception when unique_violation then
      if exists (select 1 from public.profili where id = new.id) then raise; end if;
    end;
  end loop;
  raise exception 'Impossibile creare il profilo';
end $$;

create trigger su_nuovo_utente after insert on auth.users
for each row execute function public.nuovo_utente();

/** Solo un amministratore (o il pannello SQL di Supabase) può dare o togliere il ruolo di admin. */
create function public.proteggi_admin() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.uid() is not null and not public.is_admin() then
    raise exception 'Solo un amministratore può cambiare i ruoli';
  end if;
  return new;
end $$;

create trigger profili_proteggi_admin before update on public.profili
for each row execute function public.proteggi_admin();

-- ---------------------------------------------------------------------------
-- Giocatori, tornei, tabelloni, coppie, partite (inseriti a mano dall'admin)
-- ---------------------------------------------------------------------------

create table public.giocatori (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 60),
  cognome text not null check (char_length(cognome) between 1 and 60),
  paese char(2) check (paese ~ '^[A-Z]{2}$'),
  sesso char(1) check (sesso in ('M', 'F')),
  creato_at timestamptz not null default now()
);

create table public.tornei (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 3 and 120),
  luogo text not null check (char_length(luogo) between 2 and 120),
  paese char(2) check (paese ~ '^[A-Z]{2}$'),
  circuito public.circuito not null,
  categoria text check (char_length(categoria) <= 40), -- es. "BT400", facoltativa
  data_inizio date not null,
  data_fine date not null,
  inizio_at timestamptz not null, -- primo incontro: da qui si bloccano i pronostici su vincitore e finalista
  stato public.stato_torneo not null default 'in_programma',
  creato_at timestamptz not null default now(),
  check (data_fine >= data_inizio)
);
create index tornei_data on public.tornei (data_inizio);

create table public.tabelloni (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references public.tornei (id) on delete cascade,
  genere public.genere_tabellone not null,
  unique (torneo_id, genere)
);

create table public.coppie (
  id uuid primary key default gen_random_uuid(),
  tabellone_id uuid not null references public.tabelloni (id) on delete cascade,
  giocatore1_id uuid not null references public.giocatori (id),
  giocatore2_id uuid not null references public.giocatori (id),
  testa_di_serie smallint check (testa_di_serie between 1 and 64),
  check (giocatore1_id <> giocatore2_id)
);
create unique index coppie_unica on public.coppie (tabellone_id, least(giocatore1_id, giocatore2_id), greatest(giocatore1_id, giocatore2_id));

create table public.partite (
  id uuid primary key default gen_random_uuid(),
  tabellone_id uuid not null references public.tabelloni (id) on delete cascade,
  turno public.turno not null,
  ordine smallint not null default 0, -- posizione nel tabellone, per mostrarle in ordine
  coppia_a_id uuid references public.coppie (id) on delete set null,
  coppia_b_id uuid references public.coppie (id) on delete set null,
  inizio_at timestamptz not null, -- da qui si blocca il pronostico sulla partita
  set_per_vincere smallint not null default 1 check (set_per_vincere in (1, 2)), -- 1 = set unico, 2 = al meglio dei 3
  stato public.stato_partita not null default 'in_programma',
  game_a smallint[], -- game per set della coppia A, es. {6,4,10}
  game_b smallint[], -- game per set della coppia B, es. {3,6,8}
  ritiro boolean not null default false, -- vittoria per ritiro: conta solo il vincitore
  vincitore_id uuid references public.coppie (id),
  check (coppia_a_id is null or coppia_b_id is null or coppia_a_id <> coppia_b_id)
);
create index partite_tabellone on public.partite (tabellone_id, turno);
create index partite_inizio on public.partite (inizio_at);

/** Set vinti da ciascuna coppia, dai game per set. */
create function public.set_vinti(a smallint[], b smallint[], out vinti_a int, out vinti_b int)
language sql immutable as $$
  select coalesce(sum((a[i] > b[i])::int), 0)::int, coalesce(sum((b[i] > a[i])::int), 0)::int
  from generate_subscripts(a, 1) as i
$$;

/**
 * Game totali di una partita. Il super tie-break del set decisivo (a 10 punti) conta come un game,
 * come nei siti di risultati.
 */
create function public.totale_game(a smallint[], b smallint[], set_per_vincere smallint)
returns int language sql immutable as $$
  select coalesce(sum(
    case
      when set_per_vincere = 2 and i = 3 and greatest(a[i], b[i]) >= 10 then 1
      else a[i] + b[i]
    end
  ), 0)::int
  from generate_subscripts(a, 1) as i
$$;

/** Controlla una partita: coppie del suo tabellone, punteggio coerente, vincitore ricavato dal punteggio. */
create function public.valida_partita() returns trigger
language plpgsql set search_path = public as $$
declare
  s record;
begin
  if (new.coppia_a_id is not null and not exists (select 1 from coppie where id = new.coppia_a_id and tabellone_id = new.tabellone_id))
     or (new.coppia_b_id is not null and not exists (select 1 from coppie where id = new.coppia_b_id and tabellone_id = new.tabellone_id)) then
    raise exception 'Le coppie devono essere iscritte allo stesso tabellone della partita';
  end if;

  if new.stato <> 'conclusa' then
    new.vincitore_id := null;
    new.ritiro := false;
    return new;
  end if;

  if new.coppia_a_id is null or new.coppia_b_id is null then
    raise exception 'Una partita conclusa deve avere entrambe le coppie';
  end if;

  if new.ritiro then
    if new.vincitore_id is null or new.vincitore_id not in (new.coppia_a_id, new.coppia_b_id) then
      raise exception 'Con il ritiro indica quale coppia passa il turno';
    end if;
    return new;
  end if;

  if new.game_a is null or new.game_b is null or cardinality(new.game_a) <> cardinality(new.game_b) or cardinality(new.game_a) = 0 then
    raise exception 'Inserisci i game di ogni set per entrambe le coppie';
  end if;
  if cardinality(new.game_a) > 2 * new.set_per_vincere - 1 then
    raise exception 'Troppi set per questo formato';
  end if;
  select * into s from set_vinti(new.game_a, new.game_b);
  if greatest(s.vinti_a, s.vinti_b) <> new.set_per_vincere or s.vinti_a = s.vinti_b then
    raise exception 'Il punteggio non chiude la partita (set vinti % - %)', s.vinti_a, s.vinti_b;
  end if;
  new.vincitore_id := case when s.vinti_a > s.vinti_b then new.coppia_a_id else new.coppia_b_id end;
  return new;
end $$;

create trigger partite_valida before insert or update on public.partite
for each row execute function public.valida_partita();

-- ---------------------------------------------------------------------------
-- Pronostici
-- ---------------------------------------------------------------------------

-- Su un tabellone: coppia vincitrice e, facoltativa, coppia finalista (quella che perde la finale).
create table public.pronostici_torneo (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null default auth.uid() references public.profili (id) on delete cascade,
  tabellone_id uuid not null references public.tabelloni (id) on delete cascade,
  vincitore_id uuid not null references public.coppie (id) on delete cascade,
  finalista_id uuid references public.coppie (id) on delete set null,
  punti smallint, -- null finché il torneo non è concluso
  mese date, -- mese in cui i punti entrano in classifica
  creato_at timestamptz not null default now(),
  aggiornato_at timestamptz not null default now(),
  unique (utente_id, tabellone_id),
  check (finalista_id is null or finalista_id <> vincitore_id)
);

-- Su una partita: coppia vincitrice, facoltativi il punteggio in set e i game totali.
create table public.pronostici_partita (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null default auth.uid() references public.profili (id) on delete cascade,
  partita_id uuid not null references public.partite (id) on delete cascade,
  vincitore_id uuid not null references public.coppie (id) on delete cascade,
  set_vincitore smallint, -- es. 2 in un 2-1
  set_perdente smallint, -- es. 1 in un 2-1
  totale_game smallint check (totale_game between 1 and 60),
  punti smallint,
  mese date,
  creato_at timestamptz not null default now(),
  aggiornato_at timestamptz not null default now(),
  unique (utente_id, partita_id),
  check ((set_vincitore is null) = (set_perdente is null)),
  check (set_perdente is null or set_perdente < set_vincitore)
);
create index pronostici_partita_mese on public.pronostici_partita (mese) where punti is not null;
create index pronostici_torneo_mese on public.pronostici_torneo (mese) where punti is not null;

/** I pronostici su un tabellone sono aperti fino all'inizio del torneo. */
create function public.tabellone_aperto(p_tabellone uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select t.stato = 'in_programma' and now() < t.inizio_at
    from tabelloni tb join tornei t on t.id = tb.torneo_id
    where tb.id = p_tabellone), false)
$$;

/** I pronostici su una partita sono aperti fino al suo inizio, se le due coppie sono note. */
create function public.partita_aperta(p_partita uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select stato = 'in_programma' and now() < inizio_at and coppia_a_id is not null and coppia_b_id is not null
    from partite where id = p_partita), false)
$$;

create function public.valida_pronostico_torneo() returns trigger
language plpgsql set search_path = public as $$
begin
  -- solo quando cambia la scelta (il calcolo dei punti aggiorna altre colonne)
  if tg_op = 'UPDATE' and new.vincitore_id is not distinct from old.vincitore_id
     and new.finalista_id is not distinct from old.finalista_id and new.tabellone_id = old.tabellone_id then
    return new;
  end if;
  if not tabellone_aperto(new.tabellone_id) then
    raise exception 'Pronostici chiusi: il torneo è già iniziato';
  end if;
  if not exists (select 1 from coppie where id = new.vincitore_id and tabellone_id = new.tabellone_id)
     or (new.finalista_id is not null and not exists (select 1 from coppie where id = new.finalista_id and tabellone_id = new.tabellone_id)) then
    raise exception 'Scegli coppie iscritte a questo tabellone';
  end if;
  new.aggiornato_at := now();
  return new;
end $$;

create trigger pronostici_torneo_valida before insert or update on public.pronostici_torneo
for each row execute function public.valida_pronostico_torneo();

create function public.valida_pronostico_partita() returns trigger
language plpgsql set search_path = public as $$
declare
  p partite;
begin
  if tg_op = 'UPDATE' and new.vincitore_id is not distinct from old.vincitore_id and new.set_vincitore is not distinct from old.set_vincitore
     and new.set_perdente is not distinct from old.set_perdente and new.totale_game is not distinct from old.totale_game and new.partita_id = old.partita_id then
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
  new.aggiornato_at := now();
  return new;
end $$;

create trigger pronostici_partita_valida before insert or update on public.pronostici_partita
for each row execute function public.valida_pronostico_partita();

/** Cancellare un pronostico è possibile solo finché è aperto. */
create function public.blocca_cancellazione_pronostico() returns trigger
language plpgsql set search_path = public as $$
begin
  -- le cancellazioni a cascata (account eliminato, torneo eliminato dall'admin) passano sempre
  if auth.uid() is null or is_admin() or pg_trigger_depth() > 1 then return old; end if;
  if tg_table_name = 'pronostici_torneo' then
    if not tabellone_aperto(old.tabellone_id) then raise exception 'Pronostici chiusi: non si può più cancellare'; end if;
  elsif not partita_aperta(old.partita_id) then
    raise exception 'Pronostici chiusi: non si può più cancellare';
  end if;
  return old;
end $$;

create trigger pronostici_torneo_no_cancella before delete on public.pronostici_torneo
for each row execute function public.blocca_cancellazione_pronostico();
create trigger pronostici_partita_no_cancella before delete on public.pronostici_partita
for each row execute function public.blocca_cancellazione_pronostico();

-- ---------------------------------------------------------------------------
-- Punti (calcolati dal database, mai dal client)
--   Torneo:  vincitore esatto 10, finalista esatto 5
--   Partita: vincitore 3; se il vincitore è giusto anche +2 per i set esatti (solo al meglio dei 3)
--            e +3 per i game totali esatti oppure +1 se si sbaglia di 2 game al massimo
-- ---------------------------------------------------------------------------

create function public.calcola_punti_partita(p_partita uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p partite;
  s record;
  tot int;
begin
  select * into p from partite where id = p_partita;
  if p is null then return; end if;
  if p.stato <> 'conclusa' then
    update pronostici_partita set punti = null, mese = null where partita_id = p_partita and punti is not null;
    return;
  end if;
  if not p.ritiro then
    select * into s from set_vinti(p.game_a, p.game_b);
    tot := totale_game(p.game_a, p.game_b, p.set_per_vincere);
  end if;
  update pronostici_partita pr set
    mese = date_trunc('month', p.inizio_at at time zone 'UTC')::date,
    punti = case when pr.vincitore_id <> p.vincitore_id then 0 else
      3
      + case when not p.ritiro and p.set_per_vincere = 2 and pr.set_vincitore is not null
                  and pr.set_perdente = least(s.vinti_a, s.vinti_b) then 2 else 0 end
      + case when p.ritiro or pr.totale_game is null then 0
             when pr.totale_game = tot then 3
             when abs(pr.totale_game - tot) <= 2 then 1
             else 0 end
    end
  where pr.partita_id = p_partita;
end $$;

create function public.calcola_punti_tabellone(p_tabellone uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t tornei;
  f partite;
  perdente uuid;
begin
  select t2.* into t from tornei t2 join tabelloni tb on tb.torneo_id = t2.id where tb.id = p_tabellone;
  select * into f from partite where tabellone_id = p_tabellone and turno = 'F' and stato = 'conclusa' order by ordine limit 1;
  if t.stato <> 'concluso' or f is null then
    update pronostici_torneo set punti = null, mese = null where tabellone_id = p_tabellone and punti is not null;
    return;
  end if;
  perdente := case when f.vincitore_id = f.coppia_a_id then f.coppia_b_id else f.coppia_a_id end;
  update pronostici_torneo pr set
    mese = date_trunc('month', t.data_fine)::date,
    punti = (case when pr.vincitore_id = f.vincitore_id then 10 else 0 end)
          + (case when pr.finalista_id = perdente then 5 else 0 end)
  where pr.tabellone_id = p_tabellone;
end $$;

-- quando cambia una partita si ricalcolano i suoi pronostici (e quelli del torneo se è la finale)
create function public.dopo_partita() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform calcola_punti_partita(new.id);
  if new.turno = 'F' or (tg_op = 'UPDATE' and old.turno = 'F') then
    perform calcola_punti_tabellone(new.tabellone_id);
  end if;
  return null;
end $$;

create trigger partite_dopo after insert or update on public.partite
for each row execute function public.dopo_partita();

-- alla chiusura di un torneo (o se l'admin lo riapre) si ricalcolano i pronostici di tutti i suoi tabelloni
create function public.dopo_torneo() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tb record;
begin
  if new.stato is distinct from old.stato or new.data_fine is distinct from old.data_fine then
    for tb in select id from tabelloni where torneo_id = new.id loop
      perform calcola_punti_tabellone(tb.id);
    end loop;
  end if;
  return null;
end $$;

create trigger tornei_dopo after update on public.tornei
for each row execute function public.dopo_torneo();

-- ---------------------------------------------------------------------------
-- Leghe private (classifica tra amici con codice invito)
-- ---------------------------------------------------------------------------

create table public.leghe (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 3 and 40),
  codice text not null unique check (codice ~ '^[A-Z2-9]{6}$'),
  creata_da uuid not null references public.profili (id) on delete cascade,
  creato_at timestamptz not null default now()
);

create table public.leghe_membri (
  lega_id uuid not null references public.leghe (id) on delete cascade,
  utente_id uuid not null references public.profili (id) on delete cascade,
  entrato_at timestamptz not null default now(),
  primary key (lega_id, utente_id)
);
create index leghe_membri_utente on public.leghe_membri (utente_id);

create function public.sono_membro(p_lega uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from leghe_membri where lega_id = p_lega and utente_id = auth.uid())
$$;

/** Crea una lega con un codice di 6 caratteri facili da dettare (niente 0/O, 1/I). */
create function public.crea_lega(p_nome text) returns public.leghe
language plpgsql security definer set search_path = public as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
  l leghe;
begin
  if auth.uid() is null then raise exception 'Accedi per creare una lega'; end if;
  if (select count(*) from leghe where creata_da = auth.uid()) >= 10 then
    raise exception 'Hai già creato 10 leghe';
  end if;
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from leghe where codice = c);
  end loop;
  insert into leghe (nome, codice, creata_da) values (trim(p_nome), c, auth.uid()) returning * into l;
  insert into leghe_membri (lega_id, utente_id) values (l.id, auth.uid());
  return l;
end $$;

/** Entra in una lega con il codice invito. Restituisce l'id della lega. */
create function public.unisciti_lega(p_codice text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l uuid;
begin
  if auth.uid() is null then raise exception 'Accedi per entrare in una lega'; end if;
  select id into l from leghe where codice = upper(trim(p_codice));
  if l is null then raise exception 'Codice lega non valido'; end if;
  if (select count(*) from leghe_membri where lega_id = l) >= 200 then
    raise exception 'La lega è piena';
  end if;
  insert into leghe_membri (lega_id, utente_id) values (l, auth.uid()) on conflict do nothing;
  return l;
end $$;

create function public.esci_lega(p_lega uuid) returns void
language sql security definer set search_path = public as $$
  delete from leghe_membri where lega_id = p_lega and utente_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Classifica mensile: globale, per Paese, per lega
-- Restituisce solo totali (i pronostici dei singoli restano privati).
-- ---------------------------------------------------------------------------

create function public.classifica(
  p_mese date,
  p_ambito text default 'globale', -- 'globale' | 'paese' | 'lega'
  p_paese char(2) default null,
  p_lega uuid default null,
  p_limite int default 100
) returns table (posizione bigint, utente_id uuid, nickname text, paese char(2), punti bigint, pronostici bigint)
language sql stable security definer set search_path = public as $$
  with mese as (select date_trunc('month', p_mese)::date as m),
  righe as (
    select pp.utente_id, pp.punti from pronostici_partita pp, mese where pp.mese = mese.m and pp.punti is not null
    union all
    select pt.utente_id, pt.punti from pronostici_torneo pt, mese where pt.mese = mese.m and pt.punti is not null
  ),
  totali as (select r.utente_id, sum(r.punti)::bigint as punti, count(*)::bigint as pronostici from righe r group by r.utente_id),
  filtrati as (
    select t.*, pr.nickname, pr.paese from totali t join profili pr on pr.id = t.utente_id
    where p_ambito = 'globale'
       or (p_ambito = 'paese' and pr.paese = p_paese)
       or (p_ambito = 'lega' and public.sono_membro(p_lega)
           and exists (select 1 from leghe_membri lm where lm.lega_id = p_lega and lm.utente_id = t.utente_id))
  )
  select rank() over (order by f.punti desc), f.utente_id, f.nickname, f.paese, f.punti, f.pronostici
  from filtrati f
  order by f.punti desc, f.pronostici desc, f.nickname
  limit p_limite
$$;

/** Posizione dell'utente collegato nella stessa classifica (null se non ha punti nel mese). */
create function public.mia_posizione(p_mese date, p_ambito text default 'globale', p_paese char(2) default null, p_lega uuid default null)
returns table (posizione bigint, punti bigint, partecipanti bigint)
language sql stable security definer set search_path = public as $$
  with c as (select * from public.classifica(p_mese, p_ambito, p_paese, p_lega, null))
  select c.posizione, c.punti, (select count(*) from c) from c where c.utente_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Notizie: titolo e riassunto originale per lingua, sempre con fonte e link all'articolo
-- ---------------------------------------------------------------------------

create table public.notizie (
  id uuid primary key default gen_random_uuid(),
  fonte_nome text not null check (char_length(fonte_nome) between 2 and 80),
  url_originale text not null check (url_originale ~ '^https?://'),
  stato public.stato_notizia not null default 'bozza',
  pubblicata_at timestamptz,
  creata_da uuid references public.profili (id) on delete set null default auth.uid(),
  creato_at timestamptz not null default now()
);
create index notizie_pubblicate on public.notizie (pubblicata_at desc) where stato = 'pubblicata';

create table public.notizie_traduzioni (
  notizia_id uuid not null references public.notizie (id) on delete cascade,
  lingua text not null check (lingua in ('it', 'pt-BR', 'es', 'en')),
  titolo text not null check (char_length(titolo) between 5 and 120),
  riassunto text not null check (char_length(riassunto) between 20 and 320), -- circa 3 righe su telefono
  primary key (notizia_id, lingua)
);

create function public.pubblica_notizia() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.stato = 'pubblicata' and new.pubblicata_at is null then new.pubblicata_at := now(); end if;
  return new;
end $$;

create trigger notizie_pubblica before insert or update on public.notizie
for each row execute function public.pubblica_notizia();

-- ---------------------------------------------------------------------------
-- Attività: per misurare gli utenti attivi a settimana (obiettivo: 500)
-- ---------------------------------------------------------------------------

create table public.attivita (
  utente_id uuid not null references public.profili (id) on delete cascade,
  giorno date not null default (now() at time zone 'UTC')::date,
  primary key (utente_id, giorno)
);

/** Il client la chiama a ogni visita: segna l'utente come attivo oggi (una riga al giorno). */
create function public.segna_attivita() returns void
language sql security definer set search_path = public as $$
  insert into attivita (utente_id) select auth.uid() where auth.uid() is not null on conflict do nothing
$$;

/** Per l'admin: utenti attivi per settimana, nuovi utenti e quanti sono tornati dalla settimana prima. */
create function public.metriche_settimanali(p_settimane int default 12)
returns table (settimana date, attivi bigint, nuovi bigint, tornati bigint, pronostici bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo per amministratori'; end if;
  return query
  with s as (
    select generate_series(date_trunc('week', now())::date - 7 * (p_settimane - 1), date_trunc('week', now())::date, interval '7 days')::date as inizio
  )
  select s.inizio,
    (select count(distinct a.utente_id) from attivita a where a.giorno >= s.inizio and a.giorno < s.inizio + 7),
    (select count(*) from profili p where p.creato_at >= s.inizio and p.creato_at < s.inizio + 7),
    (select count(distinct a.utente_id) from attivita a
      where a.giorno >= s.inizio and a.giorno < s.inizio + 7
        and exists (select 1 from attivita b where b.utente_id = a.utente_id and b.giorno >= s.inizio - 7 and b.giorno < s.inizio)),
    (select count(*) from pronostici_partita pp where pp.creato_at >= s.inizio and pp.creato_at < s.inizio + 7)
      + (select count(*) from pronostici_torneo pt where pt.creato_at >= s.inizio and pt.creato_at < s.inizio + 7)
  from s order by s.inizio;
end $$;

-- ---------------------------------------------------------------------------
-- Cancellazione dell'account (GDPR / LGPD)
-- ---------------------------------------------------------------------------

create function public.elimina_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profili enable row level security;
alter table public.giocatori enable row level security;
alter table public.tornei enable row level security;
alter table public.tabelloni enable row level security;
alter table public.coppie enable row level security;
alter table public.partite enable row level security;
alter table public.pronostici_torneo enable row level security;
alter table public.pronostici_partita enable row level security;
alter table public.leghe enable row level security;
alter table public.leghe_membri enable row level security;
alter table public.notizie enable row level security;
alter table public.notizie_traduzioni enable row level security;
alter table public.attivita enable row level security;

-- profili: nickname e Paese sono pubblici (servono alle classifiche); ognuno modifica il proprio
create policy "profili leggibili" on public.profili for select using (true);
create policy "modifico il mio profilo" on public.profili for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin modifica profili" on public.profili for update using (public.is_admin());

-- dati sportivi: tutti leggono, solo l'admin scrive
create policy "lettura pubblica" on public.giocatori for select using (true);
create policy "lettura pubblica" on public.tornei for select using (true);
create policy "lettura pubblica" on public.tabelloni for select using (true);
create policy "lettura pubblica" on public.coppie for select using (true);
create policy "lettura pubblica" on public.partite for select using (true);
create policy "admin scrive" on public.giocatori for all using (public.is_admin()) with check (public.is_admin());
create policy "admin scrive" on public.tornei for all using (public.is_admin()) with check (public.is_admin());
create policy "admin scrive" on public.tabelloni for all using (public.is_admin()) with check (public.is_admin());
create policy "admin scrive" on public.coppie for all using (public.is_admin()) with check (public.is_admin());
create policy "admin scrive" on public.partite for all using (public.is_admin()) with check (public.is_admin());

-- pronostici: ognuno vede e gestisce i propri; l'admin vede tutto
create policy "i miei pronostici" on public.pronostici_torneo for select using (utente_id = auth.uid() or public.is_admin());
create policy "creo i miei" on public.pronostici_torneo for insert with check (utente_id = auth.uid());
create policy "modifico i miei" on public.pronostici_torneo for update using (utente_id = auth.uid()) with check (utente_id = auth.uid());
create policy "cancello i miei" on public.pronostici_torneo for delete using (utente_id = auth.uid());
create policy "i miei pronostici" on public.pronostici_partita for select using (utente_id = auth.uid() or public.is_admin());
create policy "creo i miei" on public.pronostici_partita for insert with check (utente_id = auth.uid());
create policy "modifico i miei" on public.pronostici_partita for update using (utente_id = auth.uid()) with check (utente_id = auth.uid());
create policy "cancello i miei" on public.pronostici_partita for delete using (utente_id = auth.uid());

-- leghe: le vedono solo i membri; si creano e si entra solo con le funzioni
create policy "leghe dei membri" on public.leghe for select using (public.sono_membro(id) or public.is_admin());
create policy "membri delle mie leghe" on public.leghe_membri for select using (public.sono_membro(lega_id) or public.is_admin());

-- notizie: pubbliche quelle pubblicate, il resto solo all'admin
create policy "notizie pubblicate" on public.notizie for select using (stato = 'pubblicata' or public.is_admin());
create policy "admin scrive" on public.notizie for all using (public.is_admin()) with check (public.is_admin());
create policy "traduzioni pubblicate" on public.notizie_traduzioni for select
  using (exists (select 1 from public.notizie n where n.id = notizia_id and (n.stato = 'pubblicata' or public.is_admin())));
create policy "admin scrive" on public.notizie_traduzioni for all using (public.is_admin()) with check (public.is_admin());

-- attività: solo tramite segna_attivita(); nessuna lettura diretta
create policy "admin legge" on public.attivita for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Permessi sulle colonne: l'utente non può scrivere punti, mese o ruoli
-- ---------------------------------------------------------------------------

revoke insert, update on public.pronostici_torneo from anon, authenticated;
grant insert (tabellone_id, vincitore_id, finalista_id) on public.pronostici_torneo to authenticated;
grant update (vincitore_id, finalista_id) on public.pronostici_torneo to authenticated;

revoke insert, update on public.pronostici_partita from anon, authenticated;
grant insert (partita_id, vincitore_id, set_vincitore, set_perdente, totale_game) on public.pronostici_partita to authenticated;
grant update (vincitore_id, set_vincitore, set_perdente, totale_game) on public.pronostici_partita to authenticated;

revoke insert, update on public.profili from anon, authenticated;
grant update (nickname, paese, lingua, profilo_completo) on public.profili to authenticated;

revoke all on public.leghe, public.leghe_membri, public.attivita from anon;
revoke insert, update, delete on public.leghe, public.leghe_membri, public.attivita from authenticated;

revoke execute on function public.calcola_punti_partita(uuid), public.calcola_punti_tabellone(uuid) from public, anon, authenticated;
revoke execute on function public.elimina_account(), public.crea_lega(text), public.unisciti_lega(text), public.esci_lega(uuid), public.segna_attivita() from public, anon;
