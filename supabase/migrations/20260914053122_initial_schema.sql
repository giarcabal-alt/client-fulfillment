-- Initial schema for the Talent Acquisition Desk module.
-- Schema per BUILD_BRIEF.md §4. Single hardcoded org for now (org_id
-- defaults to '00000000-0000-0000-0000-000000000001' everywhere) — RLS is
-- still org-scoped from day one so a second org later is a data change,
-- not a security rewrite (SECURITY.md, PROJECT_STATE.md §10).

-- profiles: one row per recruiter, linked to auth.users
create table profiles (
  id uuid primary key references auth.users(id),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  display_name text,
  created_at timestamptz default now()
);

-- roles: one row per open requisition; many candidates point to one role
create table roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  title text not null,
  job_description text,
  status text not null default 'open' check (status in ('open','filled','closed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- candidates: the core pipeline record
create table candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null,
  role_id uuid references roles(id), -- nullable: null means "in the talent pool, no active role"
  stage text not null default 'sourced', -- includes 'talent_pool' as a valid value
  stage_entered_at timestamptz not null default now(),
  last_action_at timestamptz not null default now(),
  touch_index int not null default 0,
  notes text,
  tags text, -- comma-separated for now; consider a proper tags table if search needs grow
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table candidate_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  label text not null,
  occurred_at timestamptz default now(),
  created_by uuid references profiles(id)
);

-- candidate_drafts: generated message drafts, one row per generation (audit trail, not a live thread)
create table candidate_drafts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id) on delete cascade,
  stage text not null,
  content text not null,
  generated_at timestamptz default now(),
  generated_by uuid references profiles(id)
);

-- org_settings: company name, shared across recruiters in the org
create table org_settings (
  org_id uuid primary key default '00000000-0000-0000-0000-000000000001',
  company_name text
);

-- Indexes on foreign keys / org_id — every RLS policy below and most app
-- queries filter on these.
create index candidates_org_id_idx on candidates (org_id);
create index candidates_role_id_idx on candidates (role_id);
create index roles_org_id_idx on roles (org_id);
create index candidate_history_candidate_id_idx on candidate_history (candidate_id);
create index candidate_drafts_candidate_id_idx on candidate_drafts (candidate_id);

-- Seed the single hardcoded org so org_settings has a row to read/update
-- from day one (BUILD_BRIEF.md §7 settings page).
insert into org_settings (org_id, company_name)
values ('00000000-0000-0000-0000-000000000001', 'UpScaleSupport')
on conflict (org_id) do nothing;

-- Returns the calling user's org_id. SECURITY DEFINER so policies (including
-- the one on `profiles` itself) can call this without recursively
-- re-evaluating RLS on `profiles` — the standard Supabase pattern for
-- avoiding infinite recursion when a table's own policy needs to read it.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

alter table profiles enable row level security;
alter table roles enable row level security;
alter table candidates enable row level security;
alter table candidate_history enable row level security;
alter table candidate_drafts enable row level security;
alter table org_settings enable row level security;

-- profiles: recruiters can see teammates in their own org, but only ever
-- create/edit their own row.
create policy "profiles: select own org" on profiles
  for select
  using (org_id = public.current_org_id());

create policy "profiles: insert own row" on profiles
  for insert
  with check (id = auth.uid());

create policy "profiles: update own row" on profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- roles: org-scoped select/insert/update (BUILD_BRIEF.md §4 policy shape).
create policy "roles: select within org" on roles
  for select
  using (org_id = public.current_org_id());

create policy "roles: insert within org" on roles
  for insert
  with check (org_id = public.current_org_id());

create policy "roles: update within org" on roles
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- candidates: org-scoped select/insert/update.
create policy "candidates: select within org" on candidates
  for select
  using (org_id = public.current_org_id());

create policy "candidates: insert within org" on candidates
  for insert
  with check (org_id = public.current_org_id());

create policy "candidates: update within org" on candidates
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- candidate_history has no org_id column of its own — org membership is
-- derived through the parent candidate.
create policy "candidate_history: select within org" on candidate_history
  for select
  using (
    exists (
      select 1 from candidates c
      where c.id = candidate_history.candidate_id
        and c.org_id = public.current_org_id()
    )
  );

create policy "candidate_history: insert within org" on candidate_history
  for insert
  with check (
    exists (
      select 1 from candidates c
      where c.id = candidate_history.candidate_id
        and c.org_id = public.current_org_id()
    )
  );

create policy "candidate_history: update within org" on candidate_history
  for update
  using (
    exists (
      select 1 from candidates c
      where c.id = candidate_history.candidate_id
        and c.org_id = public.current_org_id()
    )
  )
  with check (
    exists (
      select 1 from candidates c
      where c.id = candidate_history.candidate_id
        and c.org_id = public.current_org_id()
    )
  );

-- candidate_drafts: same derived-org-membership shape as candidate_history.
create policy "candidate_drafts: select within org" on candidate_drafts
  for select
  using (
    exists (
      select 1 from candidates c
      where c.id = candidate_drafts.candidate_id
        and c.org_id = public.current_org_id()
    )
  );

create policy "candidate_drafts: insert within org" on candidate_drafts
  for insert
  with check (
    exists (
      select 1 from candidates c
      where c.id = candidate_drafts.candidate_id
        and c.org_id = public.current_org_id()
    )
  );

create policy "candidate_drafts: update within org" on candidate_drafts
  for update
  using (
    exists (
      select 1 from candidates c
      where c.id = candidate_drafts.candidate_id
        and c.org_id = public.current_org_id()
    )
  )
  with check (
    exists (
      select 1 from candidates c
      where c.id = candidate_drafts.candidate_id
        and c.org_id = public.current_org_id()
    )
  );

-- org_settings: org-scoped select/insert/update.
create policy "org_settings: select within org" on org_settings
  for select
  using (org_id = public.current_org_id());

create policy "org_settings: insert within org" on org_settings
  for insert
  with check (org_id = public.current_org_id());

create policy "org_settings: update within org" on org_settings
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
