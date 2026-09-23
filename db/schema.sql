-- Target relational schema (Postgres, e.g. Neon/Supabase free tier) for Phase 2+.
-- Phase 1 stores the same entities in state.json on the `agent-state` branch; a PgStore
-- implementing src/store/store.ts will map 1:1 onto these tables.

create type agent_status as enum ('ACTIVE', 'PAUSED', 'DEAD');
create type experiment_status as enum ('PENDING_APPROVAL', 'RUNNING', 'COMPLETED', 'CANCELLED', 'REJECTED');
create type approval_status as enum ('PENDING', 'APPROVED', 'DENIED');

create table agents (
  id               text primary key,               -- agent-001
  name             text not null,
  parent_id        text references agents(id),
  generation       int  not null default 0,
  capital          numeric(12,2) not null,
  initial_capital  numeric(12,2) not null,
  revenue          numeric(12,2) not null default 0,
  expenses         numeric(12,2) not null default 0,
  profit           numeric(12,2) generated always as (revenue - expenses) stored,
  llm_cost_usd     numeric(12,6) not null default 0,
  strategy         jsonb not null,                 -- Strategy
  status           agent_status not null default 'ACTIVE',
  status_reason    text,
  created_at       timestamptz not null default now(),
  last_tick_at     timestamptz,
  last_think_at    timestamptz,
  tick_count       int not null default 0,
  last_action      text,
  next_action      text,
  success_count    int not null default 0,
  failure_count    int not null default 0
);

create table experiments (
  id                text primary key,              -- exp-0001
  agent_id          text not null references agents(id),
  business_model    text not null,
  niche             text not null,
  offer             text not null,
  channel           text not null,
  price             numeric(10,2) not null,
  budget            numeric(10,2) not null,
  duration_ticks    int not null,
  hypothesis        text not null,
  estimates         jsonb not null,                -- p_success, expected_revenue, risk
  decision          jsonb not null,                -- DecisionReport
  status            experiment_status not null,
  created_at        timestamptz not null,
  started_at        timestamptz,
  ended_at          timestamptz,
  ticks_elapsed     int not null default 0,
  spent             numeric(10,2) not null default 0,
  revenue           numeric(10,2) not null default 0,
  fulfillment_costs numeric(10,2) not null default 0,
  visitors          int not null default 0,
  conversions       int not null default 0,
  outcome_note      text
);
create index on experiments (agent_id, status);

-- Double-entry-ish money ledger: every euro movement is a row (Phase 4: links to Stripe ids).
create table ledger (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  agent_id      text not null references agents(id),
  experiment_id text references experiments(id),
  kind          text not null,                     -- revenue | ad_spend | op_cost | fulfillment | research | llm | transfer_to_child
  amount        numeric(12,2) not null,            -- + in, - out
  real_money    boolean not null default false,
  external_ref  text
);
create index on ledger (agent_id, at);

create table lessons (
  id            bigserial primary key,
  agent_id      text not null references agents(id),
  experiment_id text references experiments(id),
  at            timestamptz not null default now(),
  text          text not null,
  tags          text[] not null default '{}'
);

create table strategy_stats (
  agent_id    text not null references agents(id),
  key         text not null,                      -- "model", "model|niche", "channel:x"
  experiments int not null default 0,
  successes   int not null default 0,
  invested    numeric(12,2) not null default 0,
  revenue     numeric(12,2) not null default 0,
  costs       numeric(12,2) not null default 0,
  profit      numeric(12,2) not null default 0,
  ticks       int not null default 0,
  visitors    int not null default 0,
  conversions int not null default 0,
  primary key (agent_id, key)
);

create table market_observations (
  agent_id          text not null references agents(id),
  key               text not null,
  business_model    text not null,
  niche             text not null,
  observed_at       timestamptz not null,
  demand_index      real not null,
  competition_index real not null,
  typical_price     numeric(10,2),
  notes             text,
  source            text not null,                -- simulated | web
  sources           jsonb,                        -- Phase 2: cited URLs
  primary key (agent_id, key)
);

create table approvals (
  id          text primary key,
  agent_id    text not null references agents(id),
  kind        text not null,                      -- experiment | tool
  ref_id      text not null,
  summary     text not null,
  payload     jsonb,
  status      approval_status not null default 'PENDING',
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  text
);

create table events (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  agent_id  text,
  type      text not null,
  message   text not null,
  data      jsonb
);
create index on events (agent_id, at);

create table global_state (
  id              int primary key default 1 check (id = 1),
  kill_switch     boolean not null default false,
  kill_reason     text,
  world_seed      bigint not null
);

create table daily_counters (
  day          date primary key,
  llm_usd      numeric(12,6) not null default 0,
  launches     int not null default 0,
  real_spend   numeric(12,2) not null default 0
);
