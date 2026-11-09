-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create extension if not exists pgcrypto;

create table if not exists parties (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  host_pass_hash text not null,
  max_shots int not null default 10,
  released boolean not null default false,
  released_at timestamptz,
  ends_at timestamptz,          -- host-chosen time the camera closes (null = no end time)
  film_look text not null default 'classic',
  created_at timestamptz not null default now()
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references parties(id) on delete cascade,
  name text not null,
  email text not null,
  email_norm text not null,
  token text,                 -- session token, rotated on each successful verification
  gallery_key text not null,  -- stable secret that goes in the emailed gallery link
  verify_code text,
  verify_expires timestamptz,
  verify_attempts int not null default 0,
  verified boolean not null default false,
  shots_used int not null default 0,
  created_at timestamptz not null default now(),
  unique (party_id, email_norm)
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references parties(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  path text not null,
  taken_at timestamptz not null default now()
);

create index if not exists photos_party_idx on photos(party_id, taken_at);
create index if not exists guests_party_idx on guests(party_id);

-- Already created the tables from an earlier version? Run these two lines instead of re-creating:
--   alter table parties add column if not exists ends_at timestamptz;
--   alter table parties add column if not exists film_look text not null default 'classic';

-- Lock the tables down. Only the server (service role key) touches them.
alter table parties enable row level security;
alter table guests  enable row level security;
alter table photos  enable row level security;

-- Atomically use up one shot. Returns the new shots_used, or -1 if the roll is full.
-- Doing this in the database means refreshing or double-tapping cannot get extra photos.
create or replace function take_shot(p_guest uuid, p_max int)
returns int
language plpgsql
as $$
declare v int;
begin
  update guests set shots_used = shots_used + 1
   where id = p_guest and shots_used < p_max
   returning shots_used into v;
  return coalesce(v, -1);
end;
$$;

create or replace function give_back_shot(p_guest uuid)
returns void
language sql
as $$
  update guests set shots_used = greatest(shots_used - 1, 0) where id = p_guest;
$$;

-- Private storage bucket for the photos (never public).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Rate limiting for wrong sign-in guesses (gallery and host login).
-- Already set up the rest? Run just this block in the SQL Editor.
create table if not exists rate_limits (
  key text primary key,
  hits int not null default 0,
  window_start timestamptz not null default now()
);
alter table rate_limits enable row level security;

create or replace function rate_hit(p_key text, p_window int)
returns int
language plpgsql
as $$
declare v int;
begin
  insert into rate_limits (key, hits, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    hits = case when rate_limits.window_start < now() - make_interval(secs => p_window) then 1 else rate_limits.hits + 1 end,
    window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window) then now() else rate_limits.window_start end
  returning hits into v;
  return v;
end;
$$;
