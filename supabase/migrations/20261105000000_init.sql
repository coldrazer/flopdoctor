-- Flop Doctor schema (Lovable Cloud / Supabase Postgres)

create table if not exists creators (
  id            text primary key,          -- Oriane prf_… id
  platform      text not null check (platform in ('tiktok','instagram')),
  handle        text not null,
  display_name  text,
  followers     bigint,
  posts_count   int,
  profile_url   text,
  raw           jsonb,
  fetched_at    timestamptz default now(),
  unique (platform, handle)
);

create table if not exists posts (
  id            text primary key,          -- Oriane cnt_… id
  creator_id    text references creators(id) on delete cascade,
  platform      text not null,
  handle        text not null,
  published_at  timestamptz,
  views         bigint,
  likes         bigint,
  comments      bigint,
  shares        bigint,
  interactions  bigint,
  er_views      double precision,
  duration_s    double precision,
  caption       text,
  hashtags      text[],
  transcript    text,
  thumbnail_url text,
  post_url      text,
  is_niche      boolean default false,     -- trending niche post, not the creator's own
  raw           jsonb,
  fetched_at    timestamptz default now()
);
create index if not exists posts_creator_published on posts (creator_id, published_at desc);

-- One row per diagnosis. jsonb columns hold exactly what the app renders (see _shared/view.ts),
-- filled in step by step so the wheel can show progress.
create table if not exists scans (
  id               uuid primary key default gen_random_uuid(),
  platform         text not null,
  handle           text not null,
  status           text not null default 'running' check (status in ('running','done','error')),
  step             text default 'profile',
  source           text default 'live',
  error            text,
  creator          jsonb,
  baseline         jsonb,
  posts            jsonb,
  niche            jsonb,
  trending         jsonb,
  diagnosis        jsonb,
  roast_diagnosis  jsonb,
  prescriptions    jsonb,
  created_at       timestamptz default now(),
  finished_at      timestamptz
);
create index if not exists scans_handle on scans (platform, handle, created_at desc);

-- Every Oriane response, keyed by capability + options. Never pay for the same call twice.
create table if not exists api_cache (
  key        text primary key,
  response   jsonb not null,
  fetched_at timestamptz default now()
);

-- Hackathon RLS: anyone can read; only the service role (Edge Functions) writes.
alter table creators  enable row level security;
alter table posts     enable row level security;
alter table scans     enable row level security;
alter table api_cache enable row level security;
create policy "read creators" on creators for select using (true);
create policy "read posts"    on posts    for select using (true);
create policy "read scans"    on scans    for select using (true);

-- Realtime updates for the wheel's progress bar.
alter publication supabase_realtime add table scans;
