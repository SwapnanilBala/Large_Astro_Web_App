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
