# ATS Features Build Plan — Resume Parsing, Scorecards, Metrics

Addendum to BUILD_BRIEF.md. Read alongside CODING_STANDARDS.md, SECURITY.md, DESIGN_SYSTEM.md, and PROJECT_STATE.md — same conventions apply throughout: one prompt per session, git-committed and Playwright-verified between each, grants checked on every schema change.

**Monthly cost added: effectively $0.** One tiny Anthropic API call per uploaded resume (fractions of a cent at this volume); everything else — normalization, fuzzy matching, skill overlap, metrics — runs inside Postgres, already covered by your existing Supabase plan.

---

## Prerequisites (approve before Step 1)

- **New dependencies:** `pdf-parse` (PDF text extraction) and `mammoth` (DOCX text extraction) — same pair used successfully on the 3PL project. No paid tier, both widely used, no better plain-code alternative for binary file parsing.
- **New Postgres extension:** `pg_trgm` — ships with Postgres, no install needed, just `CREATE EXTENSION`. Powers fuzzy string matching for skill/location normalization, entirely in-database, no external service.
- **New Supabase Storage bucket:** `resumes` — private, not public. Same category of sensitive-but-necessary infrastructure as `admin-client.ts`; needs its own RLS policy on `storage.objects`, org-scoped like everything else.

---

## Architecture decision: candidate status vs. stage

`candidates.stage` stays exactly as-is (the pipeline funnel). A new `candidates.status` column (`active` / `rejected`) is added, orthogonal to stage. Rejecting a candidate doesn't move them through a stage — it sets `status = 'rejected'` and requires a `decline_reason`. The board filters to `status = 'active'` by default; rejected candidates keep their full history but stop cluttering the active pipeline. This mirrors how real ATS tools separate "where in the process" from "still in the process at all."

---

## Schema (Step 1)

```sql
create extension if not exists pg_trgm;

-- Canonical skills, org-scoped like everything else
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

-- Join tables — this is what makes skill matching a free SQL query later
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

-- Candidate additions
alter table candidates add column resume_path text; -- Supabase Storage object path
alter table candidates add column location_id uuid references locations(id);
alter table candidates add column status text not null default 'active' check (status in ('active','rejected'));
alter table candidates add column decline_reason text;

-- Interview scorecards — append-only, one row per interview conducted
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

-- RLS enabled on every new table, org-scoped policies matching the existing
-- pattern (candidates/roles/etc.) — Claude Code should mirror this exactly,
-- not invent a new policy shape.
```

Seed data (real starter aliases, not placeholders — extendable anytime by adding rows):

**Skill aliases:** ts/typescript/type script → TypeScript; js/javascript → JavaScript; node/nodejs/node.js → Node.js; py/python → Python; pm/project management → Project Management; cs/customer support/customer service → Customer Support; va/virtual assistant → Virtual Assistant

**Location aliases:** qc → Quezon City, Metro Manila; bgc/taguig → Taguig, Metro Manila; manila → Manila, Metro Manila; cebu → Cebu City, Cebu; davao → Davao City, Davao del Sur

**Starting fuzzy-match threshold:** ≥0.6 similarity auto-accepts; 0.35–0.6 goes to the review queue as a suggestion; <0.35 is treated as a genuinely new skill needing an explicit "map this or create it" decision. Adjustable once real resumes show how it behaves in practice.

---

## Build sequence

### Step 1 — Schema + seed data
Everything in the SQL above, as a migration, plus the seed rows. No UI yet.

### Step 2 — Resume storage + upload
`resumes` Storage bucket with org-scoped RLS on `storage.objects` (mirror the pattern SECURITY.md and the 3PL project use — including the UUID-path regex guard that prevents a real bug where a non-UUID path segment throws instead of just failing the policy check). Upload control on the candidate detail page; `resume_path` saved on the candidate record. No parsing yet — just confirm a file can be uploaded, stored, and downloaded back.

### Step 3 — Extraction, parsing, and fuzzy matching
Server-side only: `pdf-parse`/`mammoth` to get raw text, one Anthropic API call to extract structured fields (name, skills list, location, summary) as JSON, then run each extracted skill/location string through the alias tables first, `pg_trgm` similarity second, landing confident matches in `candidate_skills`/`location_id` directly and everything else in `candidate_skill_reviews`. Same server-side-only, auth-then-org-check, generic-error-to-client, rate-limit-flagged pattern as the existing draft-generation feature.

### Step 4 — Review queue UI + skill match display
A small "Needs Review" panel on the candidate detail page (confirm / reject / map-to-different-skill for each pending item). A simple overlap indicator between a candidate's confirmed skills and their assigned role's required skills (`role_skills`).

### Step 5 — Interview scorecard
Add-a-scorecard control on the candidate detail page (rating 1-5 + notes, snapshotting current stage), and a visible history of past scorecards for that candidate.

### Step 6 — Decline/reject flow
A "Reject" action on the candidate detail page, requiring a `decline_reason` before it's allowed to save. Board and default queries filter to `status = 'active'`; add a way to view rejected candidates separately (a toggle or a small archive view) rather than deleting the record.

### Step 7 — Time-in-stage metrics
A small metrics view (new route or a section on an existing page — your call at that point) computing average days-in-stage from the existing `candidate_history` timestamps (no new schema needed here — this data already exists), plus a simple decline-reason breakdown once Step 6 exists to feed it.

---

## Claude Code prompts, in order

### Prompt 1 — Schema
```
Using the schema in ATS_FEATURES.md's "Schema (Step 1)" section
(attached/pasted), write this as a Supabase migration: pg_trgm extension,
skills/skill_aliases/locations/location_aliases tables, candidate_skills/
role_skills join tables, candidate_skill_reviews, the four new columns on
candidates (resume_path, location_id, status, decline_reason), and
interview_scorecards. Enable RLS on every new table with org-scoped
policies matching the existing pattern used by candidates/roles. Insert
the seed alias data listed in the same doc. Check whether the existing
ALTER DEFAULT PRIVILEGES grants migration covers these new tables
automatically, and add an explicit grants migration if not. Update
docs/CHANGELOG.md and docs/PROJECT_STATE.md yourself.
```

### Prompt 2 — Resume storage
```
Add a private "resumes" Supabase Storage bucket with org-scoped RLS on
storage.objects, following SECURITY.md's storage policy pattern —
including a guard against casting a non-UUID path segment to uuid
(a real bug class flagged in a prior project's fragile-areas notes: this
throws a runtime error and can silently block unrelated policies if not
guarded). Add an upload control to the candidate detail page (PDF/DOCX
only) that saves the returned storage path to candidates.resume_path, and
a way to download/view the currently-attached resume. No parsing yet —
this step is upload/storage/retrieval only.

Use Playwright MCP to verify visually (manual login pause as
established). Update docs/CHANGELOG.md and docs/PROJECT_STATE.md.
```

### Prompt 3 — Extraction, parsing, fuzzy matching
```
I approve pdf-parse and mammoth as new dependencies for PDF/DOCX text
extraction (per our standing rule requiring approval before any new
dependency).

Add server-side resume parsing, triggered after a resume upload (or via
an explicit "Parse Resume" action, your call on the better UX): extract
raw text via pdf-parse/mammoth based on file type, then a single
server-side Anthropic API call (never client-side, per this app's
established rule) to extract structured fields as JSON — name, a list of
skill strings, a location string, and a brief summary.

For each extracted skill string: check skill_aliases first (exact match),
then fall back to pg_trgm similarity against the skills table. ≥0.6
similarity auto-links via candidate_skills; 0.35–0.6 creates a pending
row in candidate_skill_reviews with the suggested match and similarity
score; below 0.35, still create a pending review row but with no
suggested_skill_id, flagging it as a possibly-new skill. Same normalization
approach for the extracted location string against locations/location_aliases.

Auth + org check before any DB write, per SECURITY.md. Flag this action
for rate-limiting review, same as the existing draft-generation feature.
Check whether any new grants are needed.

Use Playwright MCP to verify visually (manual login pause as
established) — trigger a real parse on a test resume and confirm results
land correctly in candidate_skills and/or candidate_skill_reviews.

Update docs/CHANGELOG.md and docs/PROJECT_STATE.md yourself.
```

### Prompt 4 — Review queue UI + skill match display
```
Add a "Needs Review" panel to the candidate detail page showing pending
candidate_skill_reviews rows for that candidate: the raw extracted text,
the suggested skill (if any) with its similarity score, and three actions
— confirm the suggestion (inserts into candidate_skills, marks reviewed),
reject it, or map it to a different existing skill via a searchable
select. Also add a simple visual indicator comparing a candidate's
confirmed skills against their assigned role's role_skills — e.g. "4 of 6
required skills matched."

Style entirely from DESIGN_SYSTEM.md. Use Playwright MCP to verify
visually (manual login pause as established), confirming all three
review actions actually update the database correctly, not just the UI.

Update docs/CHANGELOG.md and docs/PROJECT_STATE.md yourself.
```

### Prompt 5 — Interview scorecard
```
Add an interview scorecard feature to the candidate detail page: a form
to add a new scorecard (1-5 rating, notes, auto-snapshotting the
candidate's current stage) as a Server Action with the standard auth/org
checks, and a visible list of past scorecards for that candidate (rating,
notes, stage at the time, interviewer name, date), newest first.

Use Playwright MCP to verify visually (manual login pause as
established). Update docs/CHANGELOG.md and docs/PROJECT_STATE.md.
```

### Prompt 6 — Decline/reject flow
```
Add a "Reject" action to the candidate detail page: sets candidates.status
to 'rejected', requires a non-empty decline_reason before it's allowed to
save (validate server-side, not just client-side per SECURITY.md's
boundary-validation rule). Update the board and any other default
candidate queries to filter to status = 'active' — rejected candidates
should no longer appear on the main board. Add a way to view rejected
candidates separately (a toggle, filter, or small archive view — your
call on the cleanest approach given existing patterns), showing their
decline reason and last stage before rejection. Don't delete the record.

Use Playwright MCP to verify visually (manual login pause as
established). Update docs/CHANGELOG.md and docs/PROJECT_STATE.md.
```

### Prompt 7 — Time-in-stage metrics
```
Add a metrics view computing average time-in-stage from the existing
candidate_history timestamps (no new schema needed — this data already
exists from every stage-change log entry). Show average days spent in
each stage across all candidates, and once decline_reason data exists
from Prompt 6, a simple breakdown of rejection reasons by frequency.
Place this wherever makes sense given the current page structure — your
call, but keep it simple: a handful of numbers/a small table, not a full
charting library, per this project's "don't over-engineer" standard.

Use Playwright MCP to verify visually (manual login pause as
established). Update docs/CHANGELOG.md and docs/PROJECT_STATE.md.
```
