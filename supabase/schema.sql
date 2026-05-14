create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.saved_charts (
  saved_chart_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  city text not null default '',
  birth_date date not null,
  birth_time text not null default '',
  timezone_offset_minutes integer not null default 0,
  country text not null default '',
  state text not null default '',
  town text not null default '',
  latitude double precision not null default 0,
  longitude double precision not null default 0,
  time_zone_id text not null default '',
  ascendant_sign text not null,
  query_string text not null,
  notes text not null default '',
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists saved_charts_user_profile_unique
  on public.saved_charts (user_id, name, birth_date, birth_time);

drop trigger if exists saved_charts_set_updated_at on public.saved_charts;
create trigger saved_charts_set_updated_at
before update on public.saved_charts
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.saved_comparisons (
  saved_comparison_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_name text not null,
  partner_name text not null,
  compatibility_score double precision not null,
  summary text not null,
  query_string text not null,
  notes text not null default '',
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

drop trigger if exists saved_comparisons_set_updated_at on public.saved_comparisons;
create trigger saved_comparisons_set_updated_at
before update on public.saved_comparisons
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.saved_charts enable row level security;
alter table public.saved_comparisons enable row level security;

drop policy if exists "saved charts select own" on public.saved_charts;
create policy "saved charts select own"
on public.saved_charts
for select
using (auth.uid() = user_id);

drop policy if exists "saved charts insert own" on public.saved_charts;
create policy "saved charts insert own"
on public.saved_charts
for insert
with check (auth.uid() = user_id);

drop policy if exists "saved charts update own" on public.saved_charts;
create policy "saved charts update own"
on public.saved_charts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "saved charts delete own" on public.saved_charts;
create policy "saved charts delete own"
on public.saved_charts
for delete
using (auth.uid() = user_id);

drop policy if exists "saved comparisons select own" on public.saved_comparisons;
create policy "saved comparisons select own"
on public.saved_comparisons
for select
using (auth.uid() = user_id);

drop policy if exists "saved comparisons insert own" on public.saved_comparisons;
create policy "saved comparisons insert own"
on public.saved_comparisons
for insert
with check (auth.uid() = user_id);

drop policy if exists "saved comparisons update own" on public.saved_comparisons;
create policy "saved comparisons update own"
on public.saved_comparisons
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "saved comparisons delete own" on public.saved_comparisons;
create policy "saved comparisons delete own"
on public.saved_comparisons
for delete
using (auth.uid() = user_id);

-- =========================================================================
-- CLIENT READINGS (authenticated users — full birth data + domain briefs)
-- =========================================================================

create table if not exists public.client_readings (
  reading_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  birth_date date not null,
  birth_time text not null default '',
  city text not null default '',
  country text not null default '',
  state text not null default '',
  town text not null default '',
  latitude double precision not null default 0,
  longitude double precision not null default 0,
  timezone_offset integer not null default 0,
  time_zone_id text not null default '',
  engine_id text not null default 'lahiri_classic',
  ascendant_sign text not null default '',
  brief_career text not null default '',
  brief_love text not null default '',
  brief_family text not null default '',
  brief_travel text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_readings_user_profile_unique
  on public.client_readings (user_id, name, birth_date, birth_time);

drop trigger if exists client_readings_set_updated_at on public.client_readings;
create trigger client_readings_set_updated_at
before update on public.client_readings
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.client_readings enable row level security;

drop policy if exists "client readings select own" on public.client_readings;
create policy "client readings select own"
on public.client_readings
for select
using (auth.uid() = user_id);

drop policy if exists "client readings insert own" on public.client_readings;
create policy "client readings insert own"
on public.client_readings
for insert
with check (auth.uid() = user_id);

drop policy if exists "client readings update own" on public.client_readings;
create policy "client readings update own"
on public.client_readings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "client readings delete own" on public.client_readings;
create policy "client readings delete own"
on public.client_readings
for delete
using (auth.uid() = user_id);

-- =========================================================================
-- GUEST READINGS (anonymous — birth data + short general prediction only)
-- =========================================================================

create table if not exists public.guest_readings (
  reading_id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_date date not null,
  birth_time text not null default '',
  city text not null default '',
  country text not null default '',
  state text not null default '',
  latitude double precision not null default 0,
  longitude double precision not null default 0,
  timezone_offset integer not null default 0,
  time_zone_id text not null default '',
  engine_id text not null default 'lahiri_classic',
  brief_general text not null default '',
  created_at timestamptz not null default now()
);

alter table public.guest_readings enable row level security;

-- Guests can only insert (via anon key), never read back or modify
drop policy if exists "guest readings insert anon" on public.guest_readings;
create policy "guest readings insert anon"
on public.guest_readings
for insert
with check (true);

-- Authenticated users (e.g. admins) can read guest readings
drop policy if exists "guest readings select auth" on public.guest_readings;
create policy "guest readings select auth"
on public.guest_readings
for select
using (auth.uid() is not null);

-- =========================================================================
-- CHART FOLLOW-UP QUESTION USAGE (server-only cooldown enforcement)
-- =========================================================================

create table if not exists public.chart_follow_up_question_usage (
  usage_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  client_ip text not null default 'unknown',
  ip_hash text not null,
  chart_hash text not null,
  question_hash text not null,
  asked_at timestamptz not null default now()
);

create index if not exists chart_follow_up_question_usage_user_asked_idx
  on public.chart_follow_up_question_usage (user_id, asked_at desc);

create index if not exists chart_follow_up_question_usage_ip_asked_idx
  on public.chart_follow_up_question_usage (ip_hash, asked_at desc);

create index if not exists chart_follow_up_question_usage_chart_asked_idx
  on public.chart_follow_up_question_usage (chart_hash, asked_at desc);

alter table public.chart_follow_up_question_usage enable row level security;
