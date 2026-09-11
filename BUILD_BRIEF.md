# Client Fulfillment App — Build Brief for Claude Code (Talent Acquisition Desk)

Source of truth for turning the prototype into the real app. Feed the numbered prompts at the bottom to Claude Code one at a time, in order — each is scoped to be one working session/PR, per CODING_STANDARDS.md.

**Naming:** the app is **Client Fulfillment App** — a shell with a sidebar of modules. **Talent Acquisition Desk** (candidates, roles, talent pool — everything built so far) is the first module. Future modules (Onboarding, Kickoff) will hang off the same sidebar later; don't build them now, but the routing and folder structure below leaves room so adding one is a new route group, not a restructure.

---

## 1. Scope (v1 — don't build past this yet)

**In scope:** the app shell (sidebar + layout) with one working module — Talent Acquisition Desk — for you + one future hire. Candidate pipeline board (including a Talent Pool stage for candidates not tied to an active role), per-candidate detail with cadence-based reminders, server-side AI drafting assistant, basic auth.

**Explicitly out of scope for v1** (per "no premature abstraction"):
- Building out the Onboarding or Kickoff modules — the sidebar shows them as disabled/"coming soon" placeholders (cheap, just static nav items), but no pages, tables, or logic behind them yet.
- The client/lead-gen app or any cross-app matching — future project, separate decision.
- LinkedIn/X sourcing integrations — legal/cost reasons covered earlier; manual sourcing only for now.
- Email/Slack notifications for overdue reminders — v1 shows overdue status in-app only. Add later if the badge-based system proves insufficient.
- Multi-org / multi-tenant support — but the schema below adds an `org_id` column now so this isn't a rewrite later, without building any actual multi-org logic yet.

---

## 2. Stack

- **Next.js (App Router) + TypeScript** — hosted on Vercel
- **Tailwind CSS v4 (CSS-first `@theme` config, no `tailwind.config.js`) + shadcn/ui** — matches the pattern from the 3PL project. Design tokens and rules live in `DESIGN_SYSTEM.md` (UpScaleSupport Brand Guide v2) — read it before building any UI.
- **Supabase** — Postgres, Auth, Row Level Security
- **Anthropic API** — called only from a server-side route, never the client
- Invite-only auth (no public sign-up) — this is an internal tool

---

## 3. App shell & routing

```
src/app/
  login/                          -- outside the shell
  (shell)/                        -- layout.tsx renders the sidebar
    layout.tsx                    -- sidebar: "Talent Acquisition Desk" (active),
                                      "Onboarding" (disabled), "Kickoff" (disabled)
    settings/                     -- app-level, not module-specific
    talent-acquisition/
      board/
      roles/
      candidates/[id]/
```

Everything module-specific for Talent Acquisition lives under `talent-acquisition/` — both the routes and the domain logic (`src/lib/talent-acquisition/cadence.ts`, `src/lib/talent-acquisition/scripts.ts`). When Onboarding gets built later, it gets its own `talent-acquisition`-style folder and its own tables — it does not reuse the `candidates`/`roles` tables below, even though the two modules will eventually share a candidate/employee record conceptually. That link is a real design decision for later (see the original conversation about a shared candidate/employee database) — don't pre-build it now.

`/settings` (company name, display name) stays app-level rather than nested under the module, since it'll apply across modules once more exist.

---

## 4. Data model

All tables get `org_id uuid` (default a single hardcoded org for now) and RLS enabled on creation, per SECURITY.md.

```sql
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
```

**Talent Pool is a stage, not a separate table.** A candidate with `role_id = null` and `stage = 'talent_pool'` has no active pipeline and no cadence reminders attached (the cadence config for this stage has no touches and no recurring interval — it's a deliberate resting state, not a missed one). Candidates can:
- Be added directly to the pool at sourcing time (skip picking a role)
- Be moved to the pool from any active stage (role stays attached or gets cleared — recruiter's choice)
- Be pulled back out by assigning a role and moving the stage forward, whenever a matching opening appears

For search at this scale, `tags` as a plain text column with an `ILIKE` query is enough. If the pool grows into the thousands, revisit with Postgres full-text search (`tsvector`) rather than before — no need to build that now.

```sql
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

alter table profiles enable row level security;
alter table roles enable row level security;
alter table candidates enable row level security;
alter table candidate_history enable row level security;
alter table candidate_drafts enable row level security;
alter table org_settings enable row level security;
```

RLS policy shape (all org-scoped tables — `roles`, `candidates`, `candidate_history`, `candidate_drafts`, `org_settings`): authenticated users may `select`/`insert`/`update` rows where `org_id` matches their own profile's `org_id`. Single-org today, but the policy is already org-scoped so adding a second org later is a data change, not a security rewrite.

This must ship as a Supabase migration file in `supabase/migrations/`, per your standing instruction — never applied by hand.

---

## 5. The AI assistant — server-side design

Design changed from an earlier chat-thread prototype to **single-shot generation**: one field on the candidate's **role** (job description) plus the existing stage/cadence data is enough context to generate a tailored draft on demand — no ongoing conversation to store or re-send, which keeps each call cheap and stateless. This is the design to build:

- **Job description lives on `roles.job_description`**, not on the candidate — fetch it via the candidate's `role_id` join when building the prompt. Many candidates on the same requisition share one job description, edited in one place.
- **Route:** a Next.js Server Action — e.g. `generateSuggestedMessage(candidateId, extraContext?)`. `extraContext` is optional free text (something the candidate said, or a tweak like "make it shorter").
- **Auth check first:** call `await supabase.auth.getUser()` inside the action (never trust a user ID passed from the client). Reject if unauthenticated.
- **Authorization check:** confirm the candidate's `org_id` matches the caller's `org_id` before doing anything — this is a third-party API call (a side effect), so it needs its own check per SECURITY.md, RLS alone doesn't cover it.
- **Build the prompt server-side** from: candidate name, role title + job description (via the `role_id` join), current stage, the stage's next-action label, recruiter notes, the static reference script for that stage (as a style guide only), and `extraContext` if provided. Port `buildDraftPrompt()` from the prototype almost as-is.
- **Call Anthropic's API server-side only** (single message, no history array to maintain), using `ANTHROPIC_API_KEY` from env — never sent to the client.
- **Persist the generated draft** to a `candidate_drafts` table (candidate_id, content, generated_at, stage) — one row per generation, useful as an audit trail, not a growing conversation to re-send on every call.
- **A draft goes stale on stage change** — if the candidate moves stages, the last draft no longer applies to a fresh next-action; the UI should just show "generate" again rather than a leftover draft from a different stage.
- **Fail securely:** on API error, log internally, return a generic `{ success: false, error: "Couldn't generate a draft, try again." }` — never leak raw Anthropic error text to the client.
- **Cost control:** because this is single-shot (not an accumulating chat thread), cost per call stays flat regardless of how long a candidate's been in the pipeline. Still add a simple per-org daily counter as a backstop against a runaway loop — a basic cap (e.g. 200 generations/day/org) is enough for v1.
- **Flag for rate-limiting review** before shipping, per SECURITY.md — this is a mutating, external-API-calling action reachable as a POST endpoint.

`candidate_messages` table from an earlier draft of this plan is replaced by `candidate_drafts` — no chat UI, no multi-turn thread.

---

## 6. Cadence/reminder logic

Port the `STAGE_CONFIG` object and `nextActionFor()` / `statusFor()` functions from the prototype directly into `src/lib/talent-acquisition/cadence.ts` as pure functions (input: candidate row + now; output: next action + status). This is exactly the kind of logic CODING_STANDARDS.md flags for automated tests ("calculations, data transforms... easy to get subtly wrong") — write a small test file alongside it (touch index math, stage-exhausted edge cases, recurring-reminder math).

Script templates (`scriptText()` in the prototype) move to `src/lib/talent-acquisition/scripts.ts`, same shape, just add `companyName`/`recruiterName` from `org_settings`/`profiles` instead of local state.

---

## 7. Pages for v1

- `/login` — Supabase auth, invite-only
- `/talent-acquisition/roles` — list/create/edit roles (title, job description, status: open/filled/closed); candidates are assigned to a role from here or from candidate creation
- `/talent-acquisition/board` — kanban view, seven columns (Talent Pool + the six active pipeline stages), reading live from `candidates`, with a search box filtering by name/role/tags
- `/talent-acquisition/candidates/[id]` — detail panel: role assignment (or none, for pool candidates), stage control, notes, tags, next action + script, suggested-message generator, history log
- `/settings` — company name (org-level), display name (per-user); app-level, not nested under the module

---

## 8. What carries over from the prototype vs. what doesn't

**Carries over almost as-is (real, reusable logic):** `STAGE_CONFIG`, `nextActionFor`, `statusFor`, `scriptText` (role title now via a lookup/join instead of a candidate field), the prompt-building logic for the suggested-message generator, the roles list/edit UI pattern, and the overall layout/interaction structure (columns, drawer, badges).

**Does not carry over:** any data sitting in the prototype artifact's storage (different storage system entirely — treat the prototype as a design reference, not a data migration source). The direct client-side Anthropic fetch call — that pattern gets replaced by the server action in §5. **The prototype's entire visual styling** — it predates the UpScaleSupport brand guide and should be fully replaced by `DESIGN_SYSTEM.md`'s tokens (see §6 of that doc for specifics on what's kept vs. replaced).

---

## 9. Claude Code prompts — run these in order

Paste each one as its own session. Each should end with a CHANGELOG.md entry and a PROJECT_STATE.md update per your standing instructions. Every prompt that builds UI assumes Claude Code has read `DESIGN_SYSTEM.md` (per Prompt 1) — it isn't repeated in each prompt below, but the tokens and rules there apply throughout, not just on the board.

### Prompt 1 — Scaffold
```
Scaffold a new Next.js (App Router, TypeScript) project called
"client-fulfillment-app". Set up Tailwind CSS v4 with a CSS-first @theme
config (no tailwind.config.js) using the tokens in DESIGN_SYSTEM.md
(attached/pasted) — colors, fonts (Bricolage Grotesque + Inter), and no
dark mode. Install shadcn/ui. Set up Supabase client integration using
@supabase/ssr per our SECURITY.md rules (cookie-based, getUser() not
getSession() anywhere we check auth). Set up .env.example with
placeholders for NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, and ANTHROPIC_API_KEY. Follow the folder
structure and naming conventions in CODING_STANDARDS.md. Do not add any
dependency beyond Next.js/Tailwind/shadcn/Supabase/TypeScript defaults
without asking me first. Set up a minimal deploy to Vercel and confirm it
builds. Update docs/CHANGELOG.md and docs/PROJECT_STATE.md when done.
```

### Prompt 2 — App shell + auth
```
Add invite-only Supabase email/password auth. No public sign-up route —
accounts are created by me directly in the Supabase dashboard for now.
Add a /login page (outside the shell) and, per BUILD_BRIEF.md section 3,
a shell layout with a left sidebar showing the UpScaleSupport digital
lowercase wordmark (per DESIGN_SYSTEM.md section 5 — app contexts use this
variant) alongside "Client Fulfillment App" and a
nav with one active item, "Talent Acquisition Desk", plus two disabled
placeholder items, "Onboarding" and "Kickoff", each labeled "Coming soon"
— no pages or logic behind those two yet. Route-protect everything inside
the shell so it requires a logged-in session. Follow SECURITY.md exactly
for how auth state is checked server-side. Update docs/CHANGELOG.md and
docs/PROJECT_STATE.md.
```

### Prompt 3 — Schema
```
Using the schema in section 4 of BUILD_BRIEF.md (attached/pasted), write this
as a Supabase migration file in supabase/migrations/ — do not apply it by
hand. Enable RLS on every table with org-scoped policies as described.
Update docs/CHANGELOG.md and docs/PROJECT_STATE.md.
```

### Prompt 4 — Roles CRUD + page
```
Build server-side CRUD for roles (create, update title/job_description/
status, delete) as Server Actions with the auth/authorization checks from
SECURITY.md. Build /talent-acquisition/roles: a list of existing roles
(title, status badge, candidate count) with inline edit for title, job
description, and status (open/filled/closed), and a form to add a new
role. Update docs/CHANGELOG.md and docs/PROJECT_STATE.md.
```

### Prompt 5 — Candidates CRUD
```
Build server-side CRUD for candidates (create with an optional role_id,
update stage, update notes, update tags, reassign role_id) as Server
Actions with the auth/authorization checks from SECURITY.md. Candidate
creation should let the user pick an existing role, create one inline, or
leave it unset — in which case the candidate defaults to stage
'talent_pool' rather than 'sourced'. Match the prototype's add-candidate
flow, including the tags field. Update docs/CHANGELOG.md and
docs/PROJECT_STATE.md.
```

### Prompt 6 — Board UI
```
Build /talent-acquisition/board: seven columns — Talent Pool, then
Sourced, Contacted, Phone Screen, Interviewing, Offer, Onboarding —
reading live from the candidates table (joined to roles for the title
shown on each card), sorted by next-action due date ascending within each
column. Add a search box that filters visible cards by name, role title,
and tags (client-side filter on the loaded page is fine for v1; move to a
server-side ILIKE query if the pool grows large). Take the *layout and
interaction logic* from the attached prototype (recruiting-desk.html) —
column structure, the drawer/detail-panel pattern, status badges
(overdue/soon/on-track, with the Talent Pool column always showing a
neutral "parked" badge rather than overdue) — but build the *visual
styling* entirely from DESIGN_SYSTEM.md instead of the prototype's
manila-folder look, which predates the real brand and should not carry
over: Warm Paper background, Stone-bordered 12px-radius cards, Work Blue
for primary actions, Bricolage Grotesque headers, Inter body text and
tabular numerals on any counts. Implement the cadence logic from
BUILD_BRIEF.md section 6 as src/lib/talent-acquisition/cadence.ts with
tests. Update docs/CHANGELOG.md
and docs/PROJECT_STATE.md.
```

### Prompt 7 — Candidate detail page
```
Build /talent-acquisition/candidates/[id]: role reassignment dropdown
(including "no role — talent pool"), stage dropdown (moves candidate,
resets cadence timer), notes field, tags field, a read-only job
description panel sourced from the assigned role with a link to
/talent-acquisition/roles to edit it, next-action display with the
relevant script from src/lib/talent-acquisition/scripts.ts, and the
history log. Port src/lib/talent-acquisition/scripts.ts from the
prototype's scriptText() function. Update docs/CHANGELOG.md and
docs/PROJECT_STATE.md.
```

### Prompt 8 — AI-generated draft messages
```
Add the "generate suggested message" feature to the candidate detail page,
implemented exactly per BUILD_BRIEF.md section 5: single-shot server action
(no chat thread), auth + org check before any Anthropic call, prompt built
server-side from the candidate's data + the assigned role's job description,
each generation persisted to candidate_drafts, generic error messages to the
client, and a basic per-org daily usage cap. Flag this action for
rate-limiting review per SECURITY.md. Update docs/CHANGELOG.md and
docs/PROJECT_STATE.md.
```

### Prompt 9 — Settings + polish
```
Add /settings (app-level, outside the talent-acquisition folder) for
company name (org-level) and display name (per-user). Do a pass for empty
states, loading states, and mobile responsiveness on the sidebar shell,
/talent-acquisition/roles, /talent-acquisition/board, and
/talent-acquisition/candidates/[id]. Update docs/CHANGELOG.md and
docs/PROJECT_STATE.md with current state and what's left for v1.1.
```

---

## 10. PROJECT_STATE.md and DESIGN_SYSTEM.md

A full `PROJECT_STATE.md` now exists as its own file, following the same convention used on your 3PL project (one-line summary, tech stack, session restart checklist with known gotchas, current state, in progress, next task, open decisions, dated architecture decisions, file map, and do-not-touch/fragile areas). `DESIGN_SYSTEM.md` also exists as its own file, translating the UpScaleSupport Brand Guide v2 into dev-usable tokens and app-specific rules. Drop both into `docs/` before running Prompt 1 — Claude Code should read all of `BUILD_BRIEF.md`, `CODING_STANDARDS.md`, `SECURITY.md`, `DESIGN_SYSTEM.md`, and `PROJECT_STATE.md` at the start of every session, and update `PROJECT_STATE.md` (and `CHANGELOG.md`) at the end of every one.
