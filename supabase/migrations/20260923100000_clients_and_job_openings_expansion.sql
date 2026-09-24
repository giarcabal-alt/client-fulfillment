-- Job Openings expansion: a real `clients` table (the seed for the future
-- client/lead-gen app — `roles.client_id` is the join point that future
-- cross-app work will depend on), seven new fields on `roles` for the
-- client-facing detail a requisition actually needs, an append-only
-- `role_history` status log (same shape as `candidate_history`), and
-- `role_skill_reviews` (same shape as `candidate_skill_reviews`) for the
-- new JD-parse-to-skills feature's fuzzy-match review queue. Same
-- single-hardcoded-org, RLS-from-day-one convention as every migration
-- before this one (PROJECT_STATE.md §10).

create table clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  company_name text not null,
  industry text,
  website text,
  location text, -- city/country, free text — no canonical locations table for clients (that table is PH-city-granularity for candidates specifically, not a fit here)
  timezone text, -- IANA timezone string, e.g. "America/New_York" — computed against Asia/Manila client-side for the live PH<->client clock, not stored as an offset (offsets drift with DST, the zone name doesn't)
  point_of_contact_name text,
  point_of_contact_email text,
  point_of_contact_phone text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- roles: client_id is the actual join point future cross-app work depends
-- on — `on delete set null` deliberately, matching candidates.role_id's
-- own "nullable, set null" shape (initial_schema.sql) rather than
-- cascading: a deleted client shouldn't take its roles' history down with
-- it, it should just leave them client-less, the same "orphan, don't
-- destroy" choice already made for role_id on candidates.
--
-- timezone_overlap and classification are NOT added here — both already
-- exist on `roles` from 20260919110000_add_role_and_candidate_fields.sql;
-- adding them again would either error (duplicate column) or silently
-- shadow the existing ones depending on how it's written, so this
-- migration only adds the five genuinely new fields.
alter table roles
  add column client_id uuid references clients(id) on delete set null,
  add column compensation text,
  add column payment_terms text
    check (payment_terms in ('full_time_salary', 'hourly', 'project_based', 'monthly_retainer')),
  add column seniority_level text
    check (seniority_level in ('entry', 'mid', 'senior', 'lead')),
  add column work_arrangement text
    check (work_arrangement in ('fully_remote', 'hybrid', 'onsite')),
  add column priority text
    check (priority in ('standard', 'urgent', 'on_hold')),
  add column target_fill_date date;

-- role_history: append-only status log, same shape/purpose as
-- candidate_history — org_id is stored directly here (unlike
-- candidate_history, which derives org membership through candidate_id)
-- because the task's own schema for this table specifies an org_id
-- column; either shape would work correctly under RLS, this one matches
-- what was asked.
create table role_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  role_id uuid references roles(id) on delete cascade,
  label text not null,
  occurred_at timestamptz default now(),
  created_by uuid references profiles(id)
);

-- role_skill_reviews: same shape as candidate_skill_reviews
-- (ats_features_step1_schema.sql) — the JD-parse feature's fuzzy-match
-- review queue, one row per skill that didn't confidently auto-match.
create table role_skill_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  role_id uuid references roles(id) on delete cascade,
  raw_text text not null,
  suggested_skill_id uuid references skills(id),
  similarity numeric,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  created_at timestamptz default now()
);

-- Indexes on foreign keys / org_id — same convention as every prior
-- migration: every RLS policy below and most app queries filter on these.
create index clients_org_id_idx on clients (org_id);
create index roles_client_id_idx on roles (client_id);
create index role_history_role_id_idx on role_history (role_id);
create index role_history_org_id_idx on role_history (org_id);
create index role_skill_reviews_role_id_idx on role_skill_reviews (role_id);
create index role_skill_reviews_org_id_idx on role_skill_reviews (org_id);
create index role_skill_reviews_status_idx on role_skill_reviews (status);

alter table clients enable row level security;
alter table role_history enable row level security;
alter table role_skill_reviews enable row level security;

-- clients: same org-scoped select/insert/update shape as roles/candidates
-- in the initial schema migration. No delete policy yet — same reasoning
-- as roles/candidates originally: add one only once a Server Action
-- actually needs it (roles itself didn't get a delete policy until a
-- later migration specifically added deleteRole).
create policy "clients: select within org" on clients
  for select
  using (org_id = public.current_org_id());

create policy "clients: insert within org" on clients
  for insert
  with check (org_id = public.current_org_id());

create policy "clients: update within org" on clients
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- role_history: select/insert only, matching candidate_history's own
-- shape exactly (that table also only has select/insert/update policies
-- with no actual update caller yet — this one skips even the unused
-- update policy since nothing here calls for shape-parity with a
-- different table, just with its own real usage: append rows, read them
-- back, never edit or delete a past status-change entry).
create policy "role_history: select within org" on role_history
  for select
  using (org_id = public.current_org_id());

create policy "role_history: insert within org" on role_history
  for insert
  with check (org_id = public.current_org_id());

-- role_skill_reviews: select/insert/update, same as candidate_skill_reviews
-- (a future "confirm"/"reject"/"map to different skill" review action —
-- mirroring skill-review-actions.ts — will need to write `status`).
create policy "role_skill_reviews: select within org" on role_skill_reviews
  for select
  using (org_id = public.current_org_id());

create policy "role_skill_reviews: insert within org" on role_skill_reviews
  for insert
  with check (org_id = public.current_org_id());

create policy "role_skill_reviews: update within org" on role_skill_reviews
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- Grants: NOT stated here, deliberately, after checking rather than
-- assuming — same reasoning as ats_features_step1_schema.sql, and this
-- time it's not just reasoned from Postgres semantics: that migration's
-- own claim ("ALTER DEFAULT PRIVILEGES covers new tables created by the
-- same role automatically") was later confirmed working against the real
-- project (PROJECT_STATE.md §6/§4 — `skills` etc. came back readable via
-- REST with no grants migration needed). `clients`/`role_history`/
-- `role_skill_reviews` are created by the same `supabase db push`
-- mechanism as every migration before them, so the same grant should
-- cover these three new tables too. Still worth a real REST check once
-- this migration is applied, the same verify-don't-assume discipline as
-- every other "confirmed applied" note in PROJECT_STATE.md §4 — if it
-- ever comes back `permission denied for table X` (Postgres 42501), the
-- fix is a follow-up migration with an explicit `GRANT ... TO
-- authenticated, service_role` on just that table, not re-running
-- `ALTER DEFAULT PRIVILEGES` (which only affects tables created after it
-- runs, never retroactively).
