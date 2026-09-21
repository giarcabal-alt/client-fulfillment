-- ATS_FEATURES.md Step 1: schema for resume parsing, skill/location
-- normalization, interview scorecards, and the active/rejected status
-- axis on candidates. Schema only — no Storage bucket (Step 2), no
-- parsing (Step 3), no UI (Steps 4-6). Same single-hardcoded-org,
-- RLS-from-day-one convention as the initial schema migration
-- (PROJECT_STATE.md §10).

create extension if not exists pg_trgm;

-- Canonical skills, org-scoped like everything else. GIN trigram indexes
-- for pg_trgm similarity matching are deliberately NOT added yet — no
-- query needs them until Step 3's fuzzy-matching action exists; adding
-- them now would be speculative infrastructure ahead of need.
create table skills (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null,
  unique(org_id, name)
);

create table skill_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  skill_id uuid references skills(id) on delete cascade,
  alias text not null, -- stored lowercase/trimmed
  unique(org_id, alias)
);

-- Canonical locations: PH city/province granularity, not flattened to one string
create table locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  city text not null,
  province text not null,
  unique(org_id, city, province)
);

create table location_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  location_id uuid references locations(id) on delete cascade,
  alias text not null,
  unique(org_id, alias)
);

-- Join tables — this is what makes skill matching a free SQL query later.
-- No org_id column of their own, same shape as candidate_history/
-- candidate_drafts in the initial schema migration — org membership is
-- derived through the parent row (candidates/roles), not stored again here.
create table candidate_skills (
  candidate_id uuid references candidates(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade,
  primary key (candidate_id, skill_id)
);

create table role_skills (
  role_id uuid references roles(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade,
  primary key (role_id, skill_id)
);

-- Pending fuzzy-match review queue — nothing auto-tags silently
create table candidate_skill_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  candidate_id uuid references candidates(id) on delete cascade,
  raw_text text not null, -- exactly what the resume extraction produced
  suggested_skill_id uuid references skills(id), -- null if no fuzzy match at all
  similarity numeric, -- the pg_trgm score, shown for transparency
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  created_at timestamptz default now()
);

-- Candidate additions (ATS_FEATURES.md "Architecture decision: candidate
-- status vs. stage" — status is orthogonal to the existing pipeline
-- stage, not a replacement for it).
alter table candidates add column resume_path text; -- Supabase Storage object path
alter table candidates add column location_id uuid references locations(id);
alter table candidates add column status text not null default 'active' check (status in ('active','rejected'));
alter table candidates add column decline_reason text;

-- Interview scorecards — append-only, one row per interview conducted.
-- "Append-only" is enforced below at the RLS layer too (no update policy),
-- not just left as a comment — see the policy section.
create table interview_scorecards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  candidate_id uuid references candidates(id) on delete cascade,
  stage_at_review text not null, -- snapshot of stage when this interview happened
  rating int not null check (rating between 1 and 5),
  notes text,
  interviewer_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- Indexes on foreign keys / org_id — same convention as the initial
-- schema migration: every RLS policy below and most future app queries
-- filter on these.
create index skills_org_id_idx on skills (org_id);
create index skill_aliases_org_id_idx on skill_aliases (org_id);
create index skill_aliases_skill_id_idx on skill_aliases (skill_id);
create index locations_org_id_idx on locations (org_id);
create index location_aliases_org_id_idx on location_aliases (org_id);
create index location_aliases_location_id_idx on location_aliases (location_id);
-- candidate_skills'/role_skills' primary keys already index (candidate_id,
-- skill_id) / (role_id, skill_id) with the first column leading — that
-- covers "skills for this candidate/role" lookups. A reverse lookup
-- ("which candidates/roles have skill X") needs skill_id indexed on its
-- own instead.
create index candidate_skills_skill_id_idx on candidate_skills (skill_id);
create index role_skills_skill_id_idx on role_skills (skill_id);
create index candidate_skill_reviews_org_id_idx on candidate_skill_reviews (org_id);
create index candidate_skill_reviews_candidate_id_idx on candidate_skill_reviews (candidate_id);
-- Step 4's "Needs Review" panel filters to status = 'pending' by default.
create index candidate_skill_reviews_status_idx on candidate_skill_reviews (status);
create index interview_scorecards_org_id_idx on interview_scorecards (org_id);
create index interview_scorecards_candidate_id_idx on interview_scorecards (candidate_id);
create index candidates_location_id_idx on candidates (location_id);
-- Step 6's board/default queries filter to status = 'active' by default.
create index candidates_status_idx on candidates (status);

alter table skills enable row level security;
alter table skill_aliases enable row level security;
alter table locations enable row level security;
alter table location_aliases enable row level security;
alter table candidate_skills enable row level security;
alter table role_skills enable row level security;
alter table candidate_skill_reviews enable row level security;
alter table interview_scorecards enable row level security;

-- skills / skill_aliases / locations / location_aliases / candidate_skill_reviews
-- all carry their own org_id column, so they follow the exact
-- select/insert/update-on-org_id shape the initial schema migration used
-- for roles/candidates — mirrored here, not reinvented. None of these
-- five need a delete policy yet (same as roles/candidates originally —
-- roles only got one later, once a Server Action actually needed it); add
-- one when a future step's delete action actually requires it.
--
-- Deliberately NOT cross-checking a row's other foreign keys (skill_id on
-- skill_aliases, suggested_skill_id on candidate_skill_reviews, etc.)
-- against their own org — consistent with this codebase's established
-- architecture decision (PROJECT_STATE.md §8, 2026-09-14: "any Server
-- Action accepting a foreign-key ID into another org-scoped table
-- re-verifies visibility via the caller's own scoped SELECT, rather than
-- trusting the FK constraint alone"). That verification belongs in the
-- Server Action that writes these rows (a future step), the same way
-- candidates.role_id is handled today via assertRoleIsVisible — not
-- duplicated into RLS here.
create policy "skills: select within org" on skills
  for select
  using (org_id = public.current_org_id());

create policy "skills: insert within org" on skills
  for insert
  with check (org_id = public.current_org_id());

create policy "skills: update within org" on skills
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "skill_aliases: select within org" on skill_aliases
  for select
  using (org_id = public.current_org_id());

create policy "skill_aliases: insert within org" on skill_aliases
  for insert
  with check (org_id = public.current_org_id());

create policy "skill_aliases: update within org" on skill_aliases
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "locations: select within org" on locations
  for select
  using (org_id = public.current_org_id());

create policy "locations: insert within org" on locations
  for insert
  with check (org_id = public.current_org_id());

create policy "locations: update within org" on locations
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "location_aliases: select within org" on location_aliases
  for select
  using (org_id = public.current_org_id());

create policy "location_aliases: insert within org" on location_aliases
  for insert
  with check (org_id = public.current_org_id());

create policy "location_aliases: update within org" on location_aliases
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- candidate_skill_reviews needs update (Step 4's confirm/reject actions
-- write `status`), unlike interview_scorecards below.
create policy "candidate_skill_reviews: select within org" on candidate_skill_reviews
  for select
  using (org_id = public.current_org_id());

create policy "candidate_skill_reviews: insert within org" on candidate_skill_reviews
  for insert
  with check (org_id = public.current_org_id());

create policy "candidate_skill_reviews: update within org" on candidate_skill_reviews
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- candidate_skills / role_skills have no org_id of their own — same
-- derived-org-membership shape as candidate_history/candidate_drafts in
-- the initial schema migration, scoped through the parent
-- candidate/role. Select/insert/delete only: these are pure membership
-- rows (a candidate either has a skill mapped or doesn't), so there's no
-- non-key column an update would ever touch — unlike candidate_history,
-- which got an update policy for shape-consistency despite no current
-- caller, these tables would have nothing for such a policy to protect.
create policy "candidate_skills: select within org" on candidate_skills
  for select
  using (
    exists (
      select 1 from candidates c
      where c.id = candidate_skills.candidate_id
        and c.org_id = public.current_org_id()
    )
  );

create policy "candidate_skills: insert within org" on candidate_skills
  for insert
  with check (
    exists (
      select 1 from candidates c
      where c.id = candidate_skills.candidate_id
        and c.org_id = public.current_org_id()
    )
  );

create policy "candidate_skills: delete within org" on candidate_skills
  for delete
  using (
    exists (
      select 1 from candidates c
      where c.id = candidate_skills.candidate_id
        and c.org_id = public.current_org_id()
    )
  );

create policy "role_skills: select within org" on role_skills
  for select
  using (
    exists (
      select 1 from roles r
      where r.id = role_skills.role_id
        and r.org_id = public.current_org_id()
    )
  );

create policy "role_skills: insert within org" on role_skills
  for insert
  with check (
    exists (
      select 1 from roles r
      where r.id = role_skills.role_id
        and r.org_id = public.current_org_id()
    )
  );

create policy "role_skills: delete within org" on role_skills
  for delete
  using (
    exists (
      select 1 from roles r
      where r.id = role_skills.role_id
        and r.org_id = public.current_org_id()
    )
  );

-- interview_scorecards: select + insert only, no update, no delete.
-- ATS_FEATURES.md's own schema comment calls this table "append-only" —
-- enforced here at the RLS layer, not left as a comment alone, so a
-- future bug (an accidental "edit" action on a scorecard) fails closed
-- instead of silently rewriting interview history.
create policy "interview_scorecards: select within org" on interview_scorecards
  for select
  using (org_id = public.current_org_id());

create policy "interview_scorecards: insert within org" on interview_scorecards
  for insert
  with check (org_id = public.current_org_id());

-- Seed data (ATS_FEATURES.md "Seed data" — real starter aliases, not
-- placeholders, extendable anytime by adding rows). Idempotent via ON
-- CONFLICT DO NOTHING, same pattern as the initial schema migration's
-- org_settings seed row, so re-running this migration is harmless.

insert into skills (org_id, name) values
  ('00000000-0000-0000-0000-000000000001', 'TypeScript'),
  ('00000000-0000-0000-0000-000000000001', 'JavaScript'),
  ('00000000-0000-0000-0000-000000000001', 'Node.js'),
  ('00000000-0000-0000-0000-000000000001', 'Python'),
  ('00000000-0000-0000-0000-000000000001', 'Project Management'),
  ('00000000-0000-0000-0000-000000000001', 'Customer Support'),
  ('00000000-0000-0000-0000-000000000001', 'Virtual Assistant')
on conflict (org_id, name) do nothing;

insert into skill_aliases (org_id, skill_id, alias)
select '00000000-0000-0000-0000-000000000001', s.id, a.alias
from skills s
join (values
  ('TypeScript', 'ts'),
  ('TypeScript', 'typescript'),
  ('TypeScript', 'type script'),
  ('JavaScript', 'js'),
  ('JavaScript', 'javascript'),
  ('Node.js', 'node'),
  ('Node.js', 'nodejs'),
  ('Node.js', 'node.js'),
  ('Python', 'py'),
  ('Python', 'python'),
  ('Project Management', 'pm'),
  ('Project Management', 'project management'),
  ('Customer Support', 'cs'),
  ('Customer Support', 'customer support'),
  ('Customer Support', 'customer service'),
  ('Virtual Assistant', 'va'),
  ('Virtual Assistant', 'virtual assistant')
) as a(skill_name, alias) on a.skill_name = s.name
where s.org_id = '00000000-0000-0000-0000-000000000001'
on conflict (org_id, alias) do nothing;

insert into locations (org_id, city, province) values
  ('00000000-0000-0000-0000-000000000001', 'Quezon City', 'Metro Manila'),
  ('00000000-0000-0000-0000-000000000001', 'Taguig', 'Metro Manila'),
  ('00000000-0000-0000-0000-000000000001', 'Manila', 'Metro Manila'),
  ('00000000-0000-0000-0000-000000000001', 'Cebu City', 'Cebu'),
  ('00000000-0000-0000-0000-000000000001', 'Davao City', 'Davao del Sur')
on conflict (org_id, city, province) do nothing;

insert into location_aliases (org_id, location_id, alias)
select '00000000-0000-0000-0000-000000000001', l.id, a.alias
from locations l
join (values
  ('Quezon City', 'Metro Manila', 'qc'),
  ('Taguig', 'Metro Manila', 'bgc'),
  ('Taguig', 'Metro Manila', 'taguig'),
  ('Manila', 'Metro Manila', 'manila'),
  ('Cebu City', 'Cebu', 'cebu'),
  ('Davao City', 'Davao del Sur', 'davao')
) as a(city, province, alias) on a.city = l.city and a.province = l.province
where l.org_id = '00000000-0000-0000-0000-000000000001'
on conflict (org_id, alias) do nothing;

-- Grants: NOT re-stated here, deliberately, after checking rather than
-- assuming. `alter default privileges in schema public grant ... on
-- tables to authenticated, service_role` (20260914060451) was run
-- without `FOR ROLE`, so it applies to whichever Postgres role executes
-- it — by Postgres's documented semantics, it then automatically applies
-- to every table created *by that same role* afterward, forever, with no
-- re-statement needed per migration. Every migration in this repo
-- (including this one) is applied via the same `supabase db push`
-- mechanism as that grants migration, i.e. the same executing role, so
-- all eight new tables above should already be covered without an
-- explicit grant here. This is the first migration since the grants fix
-- that creates brand-new tables rather than only adding columns to
-- existing ones, so unlike the assigned_to/role/timezone_overlap columns
-- before it, this specific claim has not actually been exercised yet —
-- confirm it directly (e.g. a service-role REST SELECT against `skills`)
-- once this migration is applied, the same verify-don't-assume discipline
-- as every other "confirmed applied" note in PROJECT_STATE.md §4. If that
-- check ever comes back `permission denied for table X` (Postgres 42501),
-- add a follow-up migration with an explicit
-- `grant select, insert, update, delete on skills, skill_aliases,
-- locations, location_aliases, candidate_skills, role_skills,
-- candidate_skill_reviews, interview_scorecards to authenticated,
-- service_role;` rather than re-running `alter default privileges`
-- (which only affects tables created after it runs, not retroactively).
