-- LUCENT database schema
-- Source of truth for the Supabase project referenced by NEXT_PUBLIC_SUPABASE_URL.
-- Apply by pasting this whole file into the Supabase Dashboard SQL Editor and running it once.
-- Schema changes after this point are ALTER statements run the same way; keep this file in sync.

create extension if not exists pgcrypto;

-- =========================================================================
-- sources
-- =========================================================================

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  listing_url text not null unique,
  parser_strategy text,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- articles
-- =========================================================================

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id),
  original_url text not null unique,
  canonical_url text,
  title text not null,
  image_url text not null,
  published_at timestamptz not null,
  raw_text text not null,
  scraped_at timestamptz not null default now(),
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists articles_source_id_idx on public.articles (source_id);
create index if not exists articles_published_at_idx on public.articles (published_at desc);

-- =========================================================================
-- article_analyses
-- =========================================================================

create table if not exists public.article_analyses (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references public.articles (id),
  summary text not null,
  sentiment_score double precision not null check (sentiment_score between -1 and 1),
  sentiment_label text not null check (sentiment_label in ('positive', 'neutral', 'negative')),
  bias_score double precision not null check (bias_score between -1 and 1),
  bias_label text not null check (bias_label in ('left', 'center', 'right', 'mixed', 'unclear')),
  left_percentage integer not null check (left_percentage between 0 and 100),
  center_percentage integer not null check (center_percentage between 0 and 100),
  right_percentage integer not null check (right_percentage between 0 and 100),
  confidence double precision not null check (confidence between 0 and 1),
  framing_notes text,
  loaded_terms text[] not null default '{}',
  disclaimer text not null,
  model text not null,
  created_at timestamptz not null default now(),
  constraint article_analyses_percentages_sum_100
    check (left_percentage + center_percentage + right_percentage = 100)
);

create index if not exists article_analyses_article_id_idx on public.article_analyses (article_id);

-- =========================================================================
-- pgvector + related articles (section 20)
-- =========================================================================
-- Idempotent: safe to re-run this whole block in the Supabase Dashboard SQL
-- Editor as the "ALTER SQL" for an already-existing database.

create extension if not exists vector;

alter table public.article_analyses
  add column if not exists embedding vector(1536);

create index if not exists article_analyses_embedding_idx
  on public.article_analyses
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- security invoker (not definer): runs with the caller's own privileges, so
-- it never bypasses RLS. Called through the service-role client, which
-- already has unrestricted read access for the pipeline layer.
create or replace function public.match_related_articles (
  query_embedding vector(1536),
  exclude_article_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  image_url text,
  published_at timestamptz,
  source_name text,
  sentiment_label text,
  bias_label text,
  left_percentage integer,
  center_percentage integer,
  right_percentage integer,
  confidence double precision
)
language sql
stable
security invoker
as $$
  select
    a.id,
    a.title,
    a.image_url,
    a.published_at,
    s.name as source_name,
    aa.sentiment_label,
    aa.bias_label,
    aa.left_percentage,
    aa.center_percentage,
    aa.right_percentage,
    aa.confidence
  from public.articles a
  join public.article_analyses aa on aa.article_id = a.id
  join public.sources s on s.id = a.source_id
  where aa.embedding is not null
    and a.analyzed_at is not null
    and a.id <> exclude_article_id
  order by aa.embedding <=> query_embedding
  limit match_count;
$$;

-- =========================================================================
-- logs
-- =========================================================================

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  source text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists logs_created_at_idx on public.logs (created_at desc);

-- =========================================================================
-- oxylabs_schedules
-- =========================================================================

create table if not exists public.oxylabs_schedules (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id),
  -- text, not bigint: Oxylabs schedule ids are 64-bit integers that exceed
  -- Number.MAX_SAFE_INTEGER. Postgres can store them exactly as bigint, but
  -- PostgREST serializes bigint columns as bare JSON numbers, and any JS
  -- client (including supabase-js) silently rounds them on JSON.parse. text
  -- round-trips through the JSON API losslessly since these ids are only
  -- ever used as opaque identifiers, never for arithmetic.
  oxylabs_schedule_id text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oxylabs_schedules_source_id_idx on public.oxylabs_schedules (source_id);

-- Idempotent: fixes an existing database created before this column was
-- switched from bigint to text.
alter table public.oxylabs_schedules
  alter column oxylabs_schedule_id type text using oxylabs_schedule_id::text;

-- =========================================================================
-- oxylabs_schedule_runs
-- =========================================================================

create table if not exists public.oxylabs_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.oxylabs_schedules (id),
  -- text for the same large-integer precision reason as oxylabs_schedule_id
  -- above; this stores a completed job's id (see AGENTS.md section 18).
  oxylabs_run_id text not null,
  result_status text,
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oxylabs_schedule_runs_schedule_id_idx on public.oxylabs_schedule_runs (schedule_id);

-- Idempotent: fixes an existing database created before this column was
-- switched from bigint to text.
alter table public.oxylabs_schedule_runs
  alter column oxylabs_run_id type text using oxylabs_run_id::text;

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.article_analyses enable row level security;
alter table public.logs enable row level security;
alter table public.oxylabs_schedules enable row level security;
alter table public.oxylabs_schedule_runs enable row level security;

-- Public read access: only active sources, only analyzed articles, and any
-- saved analysis (a row only exists once analysis is complete). No
-- insert/update/delete policies anywhere -- only the service-role key
-- (which bypasses RLS) can write to any table.

drop policy if exists "public read active sources" on public.sources;
create policy "public read active sources" on public.sources
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists "public read analyzed articles" on public.articles;
create policy "public read analyzed articles" on public.articles
  for select
  to anon, authenticated
  using (analyzed_at is not null);

drop policy if exists "public read article analyses" on public.article_analyses;
create policy "public read article analyses" on public.article_analyses
  for select
  to anon, authenticated
  using (true);

-- logs, oxylabs_schedules, oxylabs_schedule_runs: no policies (default-deny).
-- Only the service-role key reads or writes these tables.

-- =========================================================================
-- Grants
-- =========================================================================

grant usage on schema public to anon, authenticated;

grant select on public.sources to anon, authenticated;
grant select on public.articles to anon, authenticated;
grant select on public.article_analyses to anon, authenticated;

revoke all on public.logs from anon, authenticated;
revoke all on public.oxylabs_schedules from anon, authenticated;
revoke all on public.oxylabs_schedule_runs from anon, authenticated;
