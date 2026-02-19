-- COI Grader tables — public-facing grading tool (no org_id)

-- ============================================================
-- 1. cw_grader_uploads — one row per file upload
-- ============================================================
create table if not exists cw_grader_uploads (
  id            uuid primary key default gen_random_uuid(),
  public_token  text unique not null,
  file_path     text not null,
  file_name     text not null,
  file_size     bigint not null,
  file_type     text not null,
  ip_hash       text not null,
  template_key  text not null default 'standard_commercial',
  status        text not null default 'processing'
                check (status in ('processing', 'completed', 'failed')),
  error_message text,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now()
);

create index idx_grader_uploads_token     on cw_grader_uploads (public_token);
create index idx_grader_uploads_rate      on cw_grader_uploads (ip_hash, created_at);
create index idx_grader_uploads_expires   on cw_grader_uploads (expires_at);

-- ============================================================
-- 2. cw_grader_results — 1:1 with upload
-- ============================================================
create table if not exists cw_grader_results (
  id                uuid primary key default gen_random_uuid(),
  upload_id         uuid not null unique references cw_grader_uploads (id) on delete cascade,
  extracted_json    jsonb not null default '{}'::jsonb,
  confidence        real,
  overall_grade     text not null
                    check (overall_grade in ('COMPLIANT', 'AT_RISK', 'NON_COMPLIANT')),
  checks_json       jsonb not null default '[]'::jsonb,
  pass_count        smallint not null default 0,
  fail_count        smallint not null default 0,
  unknown_count     smallint not null default 0,
  email_unlocked    boolean not null default false,
  unlocked_by_user_id uuid,
  unlocked_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index idx_grader_results_upload on cw_grader_results (upload_id);

-- ============================================================
-- 3. cw_lead_captures — email leads from grader
-- ============================================================
create table if not exists cw_lead_captures (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  upload_id   uuid references cw_grader_uploads (id) on delete set null,
  user_id     uuid,
  source      text not null default 'grader',
  created_at  timestamptz not null default now()
);

create index idx_lead_captures_email    on cw_lead_captures (email);
create index idx_lead_captures_upload   on cw_lead_captures (upload_id);

-- ============================================================
-- 4. cw_grader_events — analytics
-- ============================================================
create table if not exists cw_grader_events (
  id          uuid primary key default gen_random_uuid(),
  upload_id   uuid references cw_grader_uploads (id) on delete set null,
  event_type  text not null,
  metadata    jsonb not null default '{}'::jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index idx_grader_events_upload on cw_grader_events (upload_id);

-- ============================================================
-- RLS — enabled, no anon policies (all ops use service role)
-- ============================================================
alter table cw_grader_uploads  enable row level security;
alter table cw_grader_results  enable row level security;
alter table cw_lead_captures   enable row level security;
alter table cw_grader_events   enable row level security;
