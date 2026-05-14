-- =========================================================================
-- PALM READINGS — saved palm-reading sessions for the "Save & compare" flow
-- =========================================================================

create extension if not exists pgcrypto;

create table if not exists public.palm_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text,                                -- user-chosen, optional
  image_data_url text not null,              -- base64 data URL of the palm image (≤ ~5MB cap upstream)
  reading jsonb not null,                    -- the full PalmReading JSON returned by /api/palm-reading
  jyotish_context jsonb,                     -- optional snapshot of natal context used at reading time
  classical_mode boolean not null default false,
  notes text,                                -- optional user notes
  deleted_at timestamptz                     -- soft-delete
);

create index if not exists idx_palm_readings_user_created
  on public.palm_readings (user_id, created_at desc)
  where deleted_at is null;

-- Row-level security: users can only see their own readings.
alter table public.palm_readings enable row level security;

drop policy if exists "Users can read own palm readings" on public.palm_readings;
create policy "Users can read own palm readings" on public.palm_readings
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own palm readings" on public.palm_readings;
create policy "Users can insert own palm readings" on public.palm_readings
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own palm readings" on public.palm_readings;
create policy "Users can update own palm readings" on public.palm_readings
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own palm readings" on public.palm_readings;
create policy "Users can delete own palm readings" on public.palm_readings
  for delete using (auth.uid() = user_id);
