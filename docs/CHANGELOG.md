# Changelog

## [Unreleased]
### Added
- **Discovered, via a direct REST check before writing any code, that the two previously-unapplied ATS schema/seed migrations (`20260921120000`, `20260921130000`) have since been applied to the live project** — `candidates.resume_path`/`status`/`decline_reason`/`location_id` all queried successfully, and `skills`/`skill_aliases`/`locations`/`location_aliases` returned the exact expected row counts (31/80/5/6). Not something this session did — the user must have applied them independently since the last one. Updates the still-open items in `docs/PROJECT_STATE.md` §6 accordingly; this is exactly the kind of ground-truth check that file's own "verified, not assumed" convention calls for before building on top of a migration whose live status wasn't already confirmed in this conversation.
- **ATS_FEATURES.md Prompt 2: resume upload/storage/retrieval on the candidate detail page — no parsing yet, that's Prompt 3.** New private `resumes` Supabase Storage bucket (migration `20260921140000_resumes_storage_bucket.sql`), org-scoped RLS on `storage.objects`, a new "Resume" card between "Candidate" and "Next action" on `/talent-acquisition/candidates/[id]`.
  - **Path convention**: `<org_id>/<candidate_id>/<random-uuid><ext>`, written by the new `uploadResume` Server Action (`src/lib/talent-acquisition/resume-actions.ts`). The random filename — not the original, possibly PII-bearing, user-supplied one — avoids collisions and keeps the object name itself free of anything worth protecting on its own; the leading `org_id` segment is what every RLS policy keys off.
  - **The UUID-cast-guard bug, guarded against for real, not just in a comment**: a naive `(storage.foldername(name))[1]::uuid = current_org_id()` policy throws a hard Postgres error — `invalid input syntax for type uuid` — the moment any object in the bucket has a non-UUID-looking first path segment (a stray upload from an unrelated bug, a manually-created test object, anything), and because RLS policies for one command are combined into a single expression, that one throw can abort the *entire* query, silently blocking every other policy on the table too, not just access to the offending row. Fixed with a `~` regex match against a UUID shape *before* ever attempting the cast, short-circuited with `and` so a malformed segment fails the policy cleanly (returns false) instead of erroring the statement.
  - **Proved this both ways, not just written it**: built a from-scratch storage-schema stub (`storage.buckets`/`storage.objects`/`storage.foldername()`, session-scoped role-switching to simulate `authenticated`) in a disposable local Postgres container — applied the real migration on top, inserted a row with a deliberately malformed first path segment alongside valid same-org and different-org rows, and confirmed: (a) a `SELECT` as the correctly-scoped org returns only the valid same-org row, no error, the malformed row silently excluded; (b) an `INSERT` with the correct org prefix succeeds; (c) an `INSERT` with a different org's prefix cleanly fails with a normal RLS policy violation, not a crash. Then, for direct proof the guard is load-bearing and not redundant caution: swapped in the exact same policy *without* the regex guard against the same data and reproduced the real bug — `ERROR: invalid input syntax for type uuid: "not-a-uuid"` on a plain `SELECT`. Container removed after.
  - **`uploadResume` Server Action**: validates the file (present, non-empty, PDF or DOCX by MIME type — never trusting the client's `accept` attribute alone, per SECURITY.md's boundary-validation rule — 10MB max, matching the bucket's own `file_size_limit`), then the same authorization-beyond-RLS pattern `generateSuggestedMessage` established: `getUser()` first, then an explicit compare of the candidate's `org_id` against the caller's own `profiles.org_id` before ever writing to Storage — SECURITY.md calls out "writing to external storage" by name as a non-DB side effect needing this. Uploads via the normal RLS-scoped client (not `admin-client.ts` — no service-role privileges needed, the new storage policies are the actual boundary), then updates `candidates.resume_path`. Fails securely throughout — no raw Supabase Storage error ever reaches the client. **Flagged for rate-limiting review** per SECURITY.md, matching the existing convention.
  - **"Replace" is a fresh upload under a new random path, not an in-place object overwrite** — the previous object (if any) is simply left orphaned in Storage. No cleanup step exists yet; a known, explicitly-flagged gap for a later step, not an oversight.
  - **New "Resume" card** (`resume-upload.tsx`, client) — a file `Input` (already carrying this app's established `focus-visible:ring-3 focus-visible:ring-ring/50` styling and file-picker-button variant classes) with an `aria-label` matching its visible state ("Resume file" when empty, "Replace resume" once one exists), a `role="alert"` error region, and — once a resume exists — a "View resume →" link matching the page's existing link style (`text-work-blue underline`, same as "Edit on the roles page"). Deliberately has **no local copy of the signed URL in component state** — it's read straight from a prop computed fresh in `page.tsx` on every server render; `revalidatePath()` inside `uploadResume` re-renders the page with the new `resume_path` and its own fresh signed URL, which flips the component from "upload" to "view" automatically. That transition is the upload's own success confirmation (no separate toast needed), the same reasoning already used for `deleteUser`'s row disappearing from the admin list.
  - **Signed URLs generated server-side, fresh, on every page load** (`createSignedUrl`, 1-hour expiry) — the bucket is private, so there's no public URL to just build a string for; using the same RLS-scoped client that every other read on this page already uses means the signed-URL request itself goes through the "resumes: select within org" policy, not a separate trust boundary.
  - **Checked whether Storage needs any new grants — confirmed it works differently from table grants, not assumed to be already covered**: the existing `ALTER DEFAULT PRIVILEGES` migration is explicitly scoped `IN SCHEMA public`; `storage.objects`/`storage.buckets` live in the `storage` schema, which that statement was never going to reach regardless of the new-vs-existing-table nuance from the last migration. Storage's actual access boundary is RLS policies on `storage.objects`, which Supabase's own bootstrap already grants the underlying table privileges for — no grants migration needed, and no `alter table storage.objects enable row level security` added either (that table is owned by `supabase_storage_admin`, already RLS-enabled by Supabase itself; only policies were added).
  - **Verified live via Playwright MCP** (session already authenticated, no login prompt needed): the new Resume card renders correctly at both 1280px and 375px, positioned between "Candidate" and "Next action," matching every other card's style. Uploaded a real test PDF through the actual file input — since the bucket doesn't exist on the live project yet (see below), this correctly reached the real Server Action, hit the real (failing) Supabase Storage call, and surfaced the expected generic `"Couldn't upload the resume. Please try again."` with no raw storage error — the same "prove the failure path is wired correctly and fails securely" verification already used for the Anthropic-credential blocker in the previous session. Confirmed via `getComputedStyle` on the focused file input that its focus-visible styling resolves to the same `ring-ring/50` token/width as every other control on this page (`outline: oklab(... Work Blue .../0.5) none 3px`) — it renders as a thin outline around the native file-picker button rather than a full box-shadow, a browser rendering quirk specific to `type="file"` inputs, not a missing or broken style.
  - **Could not verify the full upload → reload → still-shown round trip live** — the `resumes` bucket doesn't exist on the live project yet (confirmed via a direct Storage REST check: `404 Bucket not found`), and this migration hasn't been applied (same standing limitation as the three other unapplied migrations — no direct Postgres connection available to Claude Code in this environment). The RLS-policy correctness itself, including the specific UUID-guard bug this task called out, was proven exhaustively against a disposable container instead (see above); what's left is purely "does this work against the real project," which needs the migration applied first.
- **Seeded 24 additional skills (and their 63 aliases) into `skills`/
  `skill_aliases`, covering the AI-stack/backend side of the talent pool**
  that Step 1's general-purpose starter list (TypeScript, Python, PM,
  Customer Support, etc.) didn't include — API integration, RAG/agentic
  tooling, MLOps/LLMOps, and general backend skills. New migration
  `supabase/migrations/20260921130000_seed_ai_stack_skills.sql`, same
  `ON CONFLICT DO NOTHING` idempotent pattern as Step 1's seed
  (`20260921120000`), and applies independently of it — it only inserts
  into the two tables that migration already created, no schema change.
  - Deliberately did **not** alias `aws`/`gcp`/`azure` under "Cloud
    Infrastructure" — per the task's own explicit note, those are
    distinct skills, not synonyms, and collapsing them would create
    false matches once Step 3's fuzzy-matching exists. Left as a comment
    directly next to the Cloud Infrastructure aliases in the migration,
    not just here, so a future session touching this seed data sees the
    reasoning in place.
  - **Verified against a disposable local Postgres container**, applied
    on top of a fresh copy of Step 1's schema + seed (not the project's
    real database, and not the unrelated `3pl-sourcing` local Supabase
    container already running on this machine) — confirmed 24 skills +
    63 aliases inserted (bringing the running totals to 31 skills / 80
    aliases with Step 1's 7/17), queried every new skill's alias list
    back and confirmed it matches the spec exactly name-by-name, and
    re-ran the migration a second time to confirm it inserts 0 rows the
    second time (true idempotency, not just "the syntax has ON CONFLICT
    in it"). Container removed after.
  - **Not yet applied to the live project database** — no direct
    Postgres connection available to Claude Code in this environment,
    same standing limitation as the two other unapplied migrations
    already flagged in `docs/PROJECT_STATE.md` §6.
- **ATS_FEATURES.md Prompt 1: schema for resume parsing, skill/location
  normalization, interview scorecards, and the active/rejected status
  axis — schema and seed data only, per the plan's own step sequence
  (no Storage bucket, parsing, or UI yet; those are Prompts 2-7).** New
  migration `supabase/migrations/20260921120000_ats_features_step1_schema.sql`.
  - `pg_trgm` extension enabled (ships with Postgres, no install) — powers
    fuzzy skill/location matching starting in Prompt 3; no GIN trigram
    indexes added yet, deliberately, since no query needs them until that
    step exists.
  - New tables: `skills`, `skill_aliases`, `locations`, `location_aliases`,
    `candidate_skills`/`role_skills` (join tables, composite PK, no
    `org_id` of their own), `candidate_skill_reviews` (the pending
    fuzzy-match queue), `interview_scorecards`.
  - Four new columns on `candidates`: `resume_path`, `location_id`,
    `status` (`active`/`rejected`, defaults `active`), `decline_reason` —
    `status` is intentionally orthogonal to the existing `stage` column,
    per ATS_FEATURES.md's "candidate status vs. stage" architecture
    decision (rejecting a candidate doesn't move them through the
    pipeline; it sets `status` and requires a reason, separately).
  - **RLS enabled on all eight new tables, mirroring the existing pattern
    exactly rather than inventing a new shape**: `skills`/`skill_aliases`/
    `locations`/`location_aliases`/`candidate_skill_reviews` all carry
    their own `org_id`, so they get the same direct
    `org_id = current_org_id()` select/insert/update policies
    `roles`/`candidates` use. `candidate_skills`/`role_skills` have no
    `org_id` column, so they get the derived-org-membership shape
    `candidate_history`/`candidate_drafts` already use (an `exists`
    subquery through the parent `candidates`/`roles` row) — select/
    insert/delete only, since these are pure membership rows with no
    non-key column an update would ever touch. `interview_scorecards`
    deliberately gets **select + insert only, no update, no delete** —
    ATS_FEATURES.md's own schema comment calls this table "append-only,"
    enforced here at the RLS layer itself, not left as a comment alone,
    so a future accidental edit/delete action fails closed instead of
    silently rewriting interview history.
  - Deliberately did **not** cross-check a row's other foreign keys
    (e.g. `skill_aliases.skill_id`, `candidate_skill_reviews.suggested_skill_id`)
    against their own org inside RLS — consistent with this codebase's
    existing architecture decision (`docs/PROJECT_STATE.md` §8,
    2026-09-14) that this kind of cross-table authorization belongs in
    the Server Action that writes the row (the same `assertRoleIsVisible`
    shape already used for `candidates.role_id`), not duplicated into
    RLS. That verification is a future prompt's job (Prompts 3-4), once
    the actions that write these tables actually exist.
  - **Seed data inserted** exactly as listed in ATS_FEATURES.md: 7 skills
    (TypeScript, JavaScript, Node.js, Python, Project Management,
    Customer Support, Virtual Assistant) with all 17 listed aliases, and
    5 locations (Quezon City/Taguig/Manila, all Metro Manila; Cebu City,
    Cebu; Davao City, Davao del Sur) with all 6 listed aliases — inserted
    via `ON CONFLICT DO NOTHING`, same idempotent pattern as the initial
    schema migration's `org_settings` seed row, so re-running this
    migration is harmless.
  - **Checked whether the existing `ALTER DEFAULT PRIVILEGES` grants
    migration covers these new tables automatically — concluded yes, no
    new grants migration needed**, based on Postgres's documented
    semantics: that migration's `ALTER DEFAULT PRIVILEGES IN SCHEMA
    public ... GRANT ...` was run without `FOR ROLE`, so it applies
    forward to any table later created *by the same executing role* —
    and every migration in this repo, including this one, runs through
    the same `supabase db push` mechanism as that grants migration. This
    is the **first** migration since the grants fix that creates
    brand-new tables (every migration between the two only added columns
    to existing tables), so unlike those, this specific claim hasn't
    actually been exercised yet — flagged in `docs/PROJECT_STATE.md` §6
    as needing a real REST-level confirmation once applied, matching this
    project's established "verified, not assumed" discipline for
    migrations, rather than treating the Postgres-semantics reasoning
    alone as sufficient proof.
  - **Verified the migration itself against a disposable local Postgres
    container** (a plain `postgres:16` Docker image with a minimal stub
    of `profiles`/`roles`/`candidates`/`current_org_id()`, not the
    project's real Supabase database, and not the unrelated `3pl-sourcing`
    local Supabase container already running on this machine — left
    completely untouched) — the full migration applied cleanly end to
    end (extension, 8 tables, 4 new columns, 15 indexes, 23 RLS policies,
    all 4 seed inserts), the seed data was queried back and confirmed to
    match ATS_FEATURES.md's alias lists exactly (skill-by-skill,
    location-by-location), the RLS policy list was queried back and
    confirmed to match the intended per-table shape exactly (including
    `interview_scorecards` correctly having no UPDATE/DELETE policy), and
    the four new `candidates` columns were confirmed present with the
    right types/defaults/constraints. The disposable container was
    removed afterward. **This migration has not been applied to the
    live project database** — no direct Postgres connection available to
    Claude Code in this environment, same standing limitation as the
    unapplied FK-behavior migration from the previous session (see
    `docs/PROJECT_STATE.md` §6).
- **Prompt 8: the "generate suggested message" feature, per BUILD_BRIEF.md
  §5 exactly** — single-shot generation on `/talent-acquisition/candidates/[id]`,
  not a chat thread. New `generateSuggestedMessage(candidateId, extraContext?)`
  Server Action in `src/lib/talent-acquisition/draft-actions.ts`, and a new
  "Suggested message" card on the candidate detail page rendered by a new
  client component, `draft-generator.tsx`.
  - **Auth + authorization, in that order, before any Anthropic call**:
    `getUser()` first (rejects if unauthenticated), then an explicit
    compare of the candidate's `org_id` against the caller's own
    `profiles.org_id` — this is a third-party API call, a real side
    effect, so per SECURITY.md's authorization-beyond-RLS rule it needs
    its own check, not just an implicit reliance on the scoped `SELECT`
    already returning nothing for a candidate RLS would hide. Both reads
    happen, then the two org_ids are compared directly.
  - **Prompt built server-side** from the candidate's name/stage/notes,
    the assigned role's title + `job_description` (via the existing
    `role_id` join), `org_settings.company_name`, the caller's own
    `profiles.display_name`, the cadence-computed next action
    (`nextActionFor`), and its reference script (`scriptFor`) as a
    style guide — `buildSystemPrompt()` in `draft-actions.ts`, ported
    from the prototype's `buildSystemPrompt()` in `recruiting-desk.html`
    almost verbatim, fed from real DB data instead of local-storage
    state, per BUILD_BRIEF.md §8.
  - **Confirmed the Anthropic call happens only in this Server Action —
    never in a client component.** `draft-generator.tsx` (the "use
    client" piece) only ever calls `generateSuggestedMessage()`, a
    `"use server"` export; it never imports `config.anthropic` or issues
    a `fetch` to `api.anthropic.com` itself. This is exactly the mistake
    an earlier prototype iteration made (a direct browser-side call,
    exposing the API key) — see the fragile-area note in
    `docs/PROJECT_STATE.md` §10, re-confirmed here by inspection, not
    just carried forward as an assumption.
  - **Persisted to `candidate_drafts`** — one row per generation
    (`candidate_id`, `stage`, `content`, `generated_by`), after a
    successful API response, before the content is ever returned to the
    client. Treated as load-bearing: if the insert itself fails, the
    action returns the same generic failure rather than handing back a
    draft with no audit-trail row for it.
  - **Draft goes stale on stage change** (BUILD_BRIEF.md §5): the
    candidate detail page fetches the single most recent draft row for
    the candidate and only shows it if its stored `stage` still matches
    the candidate's *current* stage; a stage change since the last
    generation makes the card fall back to "Generate suggested message"
    instead of showing a leftover draft that no longer applies.
  - **Fail securely**: any Anthropic API error, a missing
    `ANTHROPIC_API_KEY`, or an insert failure all collapse to the same
    generic `"Couldn't generate a draft, try again."` — never the raw
    Anthropic error text. Verified live (see below) against a real API
    failure, not just by reading the code.
  - **Basic per-org daily cap** (200/day, `DAILY_GENERATION_CAP` in
    `draft-actions.ts`) — a backstop against a runaway loop per
    BUILD_BRIEF.md §5, checked before the API call is made. `candidate_drafts`
    has no `org_id` column of its own, so the count goes through an
    `candidate_drafts?select=id,candidates!inner(org_id)` inner join to
    `candidates`, the same org-scoping shape the RLS policies on this
    table already use. Sanity-checked the exact query shape directly
    against the live REST API (service-role key) — 200 OK, valid filter
    syntax, confirmed separately from the blocked live-generation test
    below.
  - **Flagged for rate-limiting review**, per SECURITY.md — a top-of-file
    comment in `draft-actions.ts`, matching the convention already used
    for `inviteUser`/`resetUserPassword` in `admin-actions.ts`.
  - **Checked grants**: none needed. `candidate_drafts` and `org_settings`
    are both existing tables already covered by the blanket
    `ALTER DEFAULT PRIVILEGES` grant in
    `20260914060451_fix_grants_and_roles_delete_policy.sql` — confirmed
    by reading that migration directly, not assumed. No new migration.
  - **Real blocker hit while live-testing, not a code bug**: the
    `ANTHROPIC_API_KEY` currently in `.env.local` is an *unscoped*
    (org-level) key. Anthropic's API now rejects unscoped keys with a 400
    unless every request also carries an `anthropic-workspace-id` header
    — confirmed by a direct `curl` against the real API, independent of
    this app's code, not inferred from the client's generic error alone.
    Added optional support for this: `ANTHROPIC_WORKSPACE_ID` in
    `config.ts`/`.env.example`, sent as that header only when set. **Left
    unresolved on purpose** — the user chose to leave it blocked for now
    rather than have Claude Code guess a workspace ID, and will fix the
    credential (either add the workspace ID or swap in a workspace-scoped
    key) via the Anthropic Console on their own.
  - **Verified live via Playwright MCP** (session was already
    authenticated — no login prompt needed, per that convention's own
    carve-out) on a real candidate (Gil Demiar, `test role 2`, stage
    Interviewing) at desktop width: the new "Suggested message" card
    renders correctly, matching every other card's `Card`/typography
    convention on this page; clicking "Generate suggested message"
    correctly triggers the real Server Action, hits the real (failing,
    per the blocker above) Anthropic API, and surfaces the generic
    fail-securely error (`role="alert"`, no raw error text) — confirming
    the whole pipeline up to and past the API call is wired correctly,
    even though the call itself can't succeed yet. Confirmed via keyboard
    Tab that both the extra-context `Textarea` and the "Generate
    suggested message" `Button` (a real accessible name, matching the
    visible label) show the established Work Blue focus ring. **Could
    not screenshot a successful generation or confirm the generated
    message renders readably** — blocked entirely by the credential issue
    above, not by anything in this feature's own code. Needs a real
    successful generation, screenshotted, once the credential is fixed.
- **Root cause found and fixed for the invite-email gap logged in the
  previous entry: Supabase's default confirmation link puts the session
  in a URL hash fragment (`#access_token=...`), which a server-side route
  handler never sees — the fragment never leaves the browser, so it can't
  reach `/auth/confirm` no matter how that route is written.** The user
  fixed this from their side by updating the **Invite user** and **Reset
  Password** email templates in the Supabase dashboard (Authentication →
  Email Templates) to use the `token_hash`/`type`/`redirect_to`
  query-param format instead, pointing at `/auth/confirm`. **This is a
  manual dashboard step with no code equivalent — nothing in this repo
  can set or verify it, and it's worth checking for on any future project
  that uses Supabase email-based auth links** (invite, magic link,
  recovery) — the symptom (a link that "does nothing" / silently lands
  back at a login-like page with no session) looks like a bug in the
  receiving route when it's actually the sending template. Logged as a
  fragile-area note in `docs/PROJECT_STATE.md` §10, not just here, so
  it's visible without having to find this changelog entry first.
  - Verified `/auth/confirm/route.ts` already matched the exact pattern
    this fix requires: reads `token_hash`/`type` from `searchParams`,
    calls `supabase.auth.verifyOtp({ type, token_hash })` via the server
    client, redirects to `next` on success. The one real gap: on failure
    it redirected silently to `/login`, indistinguishable from "nothing
    happened" — a genuinely expired/already-used/tampered link gave no
    signal anything went wrong. Added a real `/auth/error` page (styled
    to match `/login`/`/set-password`) and pointed the failure path there
    instead. Verified live via cookie-less `curl`: a bogus `token_hash`
    and a request with no params at all both now 307 to `/auth/error`
    (previously both went to `/login`); the no-session guard on
    `/set-password` itself is unchanged and still correctly goes to
    `/login` — a different concern (missing session vs. a bad token).
  - **Added password reset**: a "Reset password" button per user row on
    `/admin`, admin-only (`requireAdminUser()`), behind a confirmation
    dialog. Calls the new `resetUserPassword` Server Action
    (`admin-actions.ts`), which uses `supabase.auth.resetPasswordForEmail()`
    — a regular (non-admin) auth method, so it runs on the normal
    cookie-scoped client, not `admin-client.ts` (no service-role
    privileges needed for it). `redirectTo` points at the same
    `/auth/confirm?next=/set-password` as `inviteUser` — one route
    handler now serves both an invite token and a recovery token, since
    both are just different `EmailOtpType` values through the same
    `verifyOtp()` call. On success, shows a "Reset email sent"
    confirmation using the same `growth-green` + `sr-only` live-region
    pattern as the settings-page save-confirmation fix.
  - **Added delete user**: a "Delete" button per user row, admin-only,
    behind a destructive-styled confirmation dialog, same guard shape as
    role changes — blocks self-delete and blocks deleting the last
    remaining admin (the last-admin check is now a shared
    `isLastRemainingAdmin()` helper, used by both `updateUserRole` and
    the new `deleteUser`, rather than duplicated). **Per the explicit
    instruction not to silently touch other data**: before deleting,
    checks whether the user has any `candidates.assigned_to` pointing at
    them and, if so, blocks with a clear count and a "reassign them
    first" message — that's a live, current responsibility, not
    something to silently clear as a side effect of removing an account.
  - **Schema gap found while building this, not assumed away**: every FK
    from `public` tables to `profiles(id)` (and `profiles.id` itself, to
    `auth.users(id)`) had no `ON DELETE` behavior specified, defaulting to
    `NO ACTION` (blocking). This meant `admin.auth.admin.deleteUser()`
    would fail outright with a foreign-key violation the moment a
    matching `profiles` row still existed — true for *any* caller,
    including Supabase's own dashboard "Delete user" button, not just
    this app's code. New migration
    `20260921090000_fix_fk_behavior_for_user_deletion.sql` makes
    `profiles.id → auth.users(id)` cascade (required for deletion to work
    at all) and makes `roles.created_by` / `candidates.created_by` /
    `candidate_history.created_by` / `candidate_drafts.generated_by` →
    `profiles(id)` set null instead (historical attribution — safe to
    lose the specific "who made this," the record itself must survive).
    Deliberately left `candidates.assigned_to` alone — that's the one
    reference that should keep blocking, backed up by `deleteUser`'s own
    explicit application-level check above, not by a silent database-level
    null-out. **`deleteUser` doesn't assume this migration has been
    applied**: it explicitly deletes the `profiles` row itself before
    calling `deleteUser()` (defense in depth, redundant but harmless once
    the migration lands), and if a `23503` foreign-key-violation still
    surfaces (someone who created roles/candidates before the migration
    ran), it's caught and reported as a specific, honest message rather
    than the generic catch-all. **This migration has not been applied to
    the live database by me — I have no direct Postgres connection to
    this project, only the anon/service-role REST keys, which can't run
    DDL.** It needs to be run the same way prior migrations in this repo
    were (Supabase SQL Editor, or `supabase db push` once linked) before
    deleting a user who has ever created any roles/candidates will fully
    succeed without hitting that `23503` path.
  - No new grants needed for any of this: `profiles` DELETE is already
    covered by the blanket `grant ... on all tables in schema public` from
    `20260914060451_fix_grants_and_roles_delete_policy.sql`, and
    `admin-client.ts`'s service-role key bypasses RLS entirely regardless
    of policy — confirmed by reading that migration rather than assuming.
  - Verified live via Playwright MCP at 1280px and 375px: both buttons'
    appearance and both confirmation dialogs (Reset password's blue
    "Send email" / outline "Cancel", Delete's destructive-red "Delete" /
    outline "Cancel") render correctly and match `DESIGN_SYSTEM.md`,
    including the dialog's `flex-col-reverse` footer stacking correctly
    at mobile width. Opened the delete-confirmation dialog for my own
    admin account to test the self-delete guard live — the harness's own
    auto-mode safety classifier blocked clicking the actual "Delete"
    confirm button as an irreversible-deletion action, so that specific
    click wasn't performed; the guard was instead verified by code (an
    identical `userId === actingUser.id` check to `updateUserRole`'s
    self-demotion guard, which *was* live-clicked and confirmed working
    in the previous `/admin` audit session) plus `tsc`. Did not click
    "Send email" on the reset-password dialog or "Delete" against any of
    the real accounts in this environment (`Main`, `dani@...`,
    `giar.cabal@...`) — sending a real reset email or deleting a real
    account are exactly the kind of side effects this task asked to leave
    for manual testing, not simulate through the UI myself.
  - **The actual invite/reset email round trip (a real email arriving,
    its link landing on `/set-password` already authenticated, setting a
    password, signing in afterward) still needs real manual end-to-end
    testing — this was not and could not be verified by me.** What *was*
    verified: the route/page code matches the required pattern, the
    error path now visibly fails instead of silently doing nothing, and
    both new admin buttons/dialogs render and behave correctly in
    isolation.
- **Closed a real gap in the invite flow: the invite email had nowhere to
  land.** `inviteUser` (`admin-actions.ts`) has called Supabase's
  `inviteUserByEmail()` since the admin/invite feature was first built,
  which sends a real email with an auth link — but no route existed to
  receive that link, and no page existed to let the invited user actually
  set their initial password. An invited teammate clicking the email link
  would have hit a dead end (Supabase's own default confirmation flow,
  never wired to anything in this app) with no way to ever sign in, since
  `inviteUserByEmail` never sets a password itself by design (the whole
  point of using it over a plain signup was that the admin never sets or
  sees another user's password).
  - **New route handler** `src/app/auth/confirm/route.ts` — receives the
    invite (and, incidentally, any future recovery/magic-link) email
    link, reads `token_hash`/`type`/`next` from the query string, and
    calls `supabase.auth.verifyOtp({ type, token_hash })`. This both
    validates the token and establishes a real session via the existing
    cookie-writing `createClient()` (`src/lib/supabase/server.ts`) — no
    new Supabase client pattern introduced. On success, redirects to
    `next` (`/set-password`); on failure or missing params, redirects to
    `/login`. This is Supabase's documented server-side-verification
    pattern for Next.js App Router, not a custom invention.
  - **New page** `src/app/set-password/` (`page.tsx` + client
    `set-password-form.tsx` + `actions.ts`) — styled directly from
    `DESIGN_SYSTEM.md`, matching `/login`'s existing centered-Card layout
    exactly (same `Card`/`CardHeader`/`CardTitle`/`CardDescription`
    structure, same form field spacing). The page itself calls
    `getUser()` server-side and redirects to `/login` if there's no
    session — reachable only after `/auth/confirm` has already verified a
    real token, never by navigating there directly. Confirmed this live
    with a cookie-less request (`curl`, no browser session): both
    `/auth/confirm` (no token) and `/set-password` (no session) correctly
    307-redirect to `/login`. The form (new password + confirm, both
    `type="password"`, `minLength={8}`) posts to a Server Action that
    re-derives the user via `getUser()` (SECURITY.md — never trusts the
    page having already checked), validates the two fields match and meet
    the length minimum, calls `supabase.auth.updateUser({ password })`,
    and redirects to `/talent-acquisition/board` on success. Error text
    uses `role="alert"` and `aria-describedby`, consistent with the
    accessibility fixes made across this whole audit series.
  - **`inviteUser` now passes `redirectTo`** pointing at
    `/auth/confirm?next=/set-password` instead of leaving Supabase to use
    its own default. Building an absolute URL required a new env var —
    Server Actions have no request URL to derive an origin from — so
    added `NEXT_PUBLIC_SITE_URL` (documented in `.env.example`, set
    locally in `.env.local` to `http://localhost:3000`; **must be set to
    the real deployed origin in production**, e.g. in Vercel's project
    env vars, or the invite link will point at localhost).
  - **Known prerequisite this build cannot satisfy itself**: for the
    email link to actually land on `/auth/confirm` with `token_hash`/
    `type` query params (rather than Supabase's own default verify
    endpoint), the **Invite user** email template in the Supabase
    dashboard (Authentication → Email Templates) must link to
    `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password`
    — this is a dashboard configuration step, not code, and nothing in
    this repo can verify or set it. **Flagging clearly: this whole flow
    needs a real end-to-end manual test** — send a real invite from
    `/admin`, click the actual emailed link, confirm it lands on
    `/set-password` already signed in, set a password, confirm it lands
    on the board, and confirm the new account can then sign in normally
    from `/login`. I verified the page/route code in isolation (the
    unauthenticated-redirect guards via `curl`, the authenticated layout
    and keyboard focus visually via Playwright at both widths) but did
    **not** submit the form through a real invite token — no way to
    generate one without sending a real email, and I was not going to
    guess around that boundary.
### Fixed
- **Impeccable `audit` + `polish` pass on `/admin` — visual/accessibility only, no Server Action or guard logic touched.**
  `audit` scored 18/20 (Excellent, borderline — Accessibility was the
  drag). Findings shown to the user before any change, per convention:
  **[P1, accessibility]** the two guard-rail/failure error messages
  (`user-row.tsx`'s role-change error — the same path the self-demotion
  and last-admin guards return through — and `invite-user-form.tsx`'s
  invite error) rendered as plain `<p>`s with no `role`/`aria-live`, so a
  screen-reader user attempting a blocked action got no signal anything
  happened at all. Verified this by actually triggering the self-demotion
  guard live, not just reading the code: signed in as the sole admin,
  changed my own Role dropdown to "Member", confirmed the guard correctly
  blocked it server-side ("You can't demote yourself.", role reverted, no
  data changed) and checked the DOM — `role: null, aria-live: null`.
  **[P2, accessibility]** neither error was linked via `aria-describedby`
  to the control it related to. Per the task's explicit scope, this pass
  touched only markup/ARIA on `user-row.tsx` and `invite-user-form.tsx`;
  `src/lib/admin-actions.ts` and `src/lib/supabase/admin-client.ts` were
  read for context but have a zero-line diff (confirmed via `git diff
  --stat`) — the self-demotion guard, last-admin guard, and invite
  validation are unchanged. Fix: added `role="alert"` to both error
  `<p>`s so they're announced immediately without requiring focus to
  move; wired each to its Role `Select`/Email `Input` via
  `aria-describedby` with a stable id. Verified live at 1280px and 375px:
  confirmed the role dropdown, display-name input, and invite email input
  already had clear accessible names before any change (`combobox
  "Role"`, `textbox "Display name"`, `textbox "Email"` — a positive
  finding, not a gap); re-triggered the self-demotion guard post-fix and
  confirmed `role="alert"` and the correct `aria-describedby` link both
  fire, with the role still correctly reverting to Admin (guard behavior
  unchanged). Full keyboard Tab-through of the invite form and every user
  row's display-name/role controls at both widths shows the established
  Work Blue ring throughout.
- **Impeccable `audit` + `polish` pass on `/settings`.** `audit` scored
  18/20 (Excellent, borderline — Accessibility was the drag). Findings
  shown to the user before any change, per convention: **[P1,
  accessibility/UX]** the two save-on-blur fields (`CompanyNameField`,
  `DisplayNameField` in `settings-form.tsx`) gave zero feedback on a
  successful save — no visual confirmation, no `aria-live` announcement,
  nothing — while only the error path rendered anything. Actually
  triggered this live: typed a new company name, blurred, and confirmed
  via reload that the save genuinely persisted server-side, but the UI
  showed no change at all at the moment it happened, making success and
  "still in flight" indistinguishable. **[P2, accessibility]** the helper
  text under each field ("Shown to teammates across the org...", "Signed
  as the recruiter...") and the error message were both only visually
  adjacent to their `Input`, not programmatically associated — confirmed
  live via `aria-describedby` being `null` on both inputs. Fix: added a
  transient "Saved" confirmation in `growth-green` (DESIGN.md's
  success-only color) after a successful save, backed by an always-mounted
  `sr-only` `role="status"`/`aria-live="polite"` region (mounted once,
  not created fresh on each save, since a screen reader can miss a live
  region that doesn't exist yet at the moment content changes); wired each
  input's `aria-describedby` to its helper text (and error text when
  present) with stable ids, and marked the error `<p>` `role="alert"` so
  it's announced without requiring focus to move. Verified live at 1280px
  and 375px by actually triggering real saves (not just checking static
  appearance) on both fields at both widths — screenshotted the visible
  "Saved" text appearing in Growth Green after a real blur-triggered save
  round-trip, and confirmed via the DOM that the `sr-only` status region's
  text updates on the same event. Confirmed `aria-describedby` now
  resolves to the helper text's `id` on both inputs. Full keyboard
  Tab-through of both fields at both widths shows the same established
  Work Blue ring. Any test values typed during verification (temporarily
  extended the "Saved" message's 2s auto-dismiss to 15s to capture a real
  screenshot of it, then reverted) were reverted back to their original
  values afterward, confirmed via reload.
- **Impeccable `audit` + `polish` pass on the sidebar — desktop `layout.tsx`/`sidebar-nav.tsx`/`wordmark.tsx` and the mobile slide-out nav (`mobile-nav.tsx`).**
  `audit` scored 19/20 (Excellent). Findings shown to the user before any
  change, per convention: **[P2, accessibility/consistency]** every nav
  link (module links, Settings, Admin), the logo/wordmark link (both the
  shared `Wordmark` component and the mobile top bar's own inline copy),
  and both `Sign out` buttons (desktop sidebar + mobile Sheet) relied on
  the browser's thin default focus outline rather than the app's
  deliberate `focus-visible:ring-3 focus-visible:ring-ring/50` box-shadow
  ring every other interactive element uses — the same class of gap
  already found and fixed once on the board's drawer "View full profile
  →" link, and noticeably fainter here against the dark Ink Navy sidebar
  background specifically. Explicitly checked three things the user
  flagged as easy to get wrong, and found all three already correct: the
  disabled "Coming soon" items (Onboarding, Kickoff) are plain `<div>`s
  with no `tabindex`, confirmed live that Tab skips them entirely rather
  than landing on a dead control; the module/Settings divider is a real
  `<hr>`, confirmed live in the accessibility tree as a `separator` node,
  not just a styled line; the logo (`link "us. upscalesupport"`) and
  Sign out (`button "Sign out"`) both already had clear accessible names.
  Fix: added `outline-none focus-visible:ring-3 focus-visible:ring-ring/50`
  to `sidebar-nav.tsx`'s shared `navLink()`, `wordmark.tsx`, the mobile
  top bar's inline logo link, and both `Sign out` buttons — no new
  tokens, reusing the exact ring treatment already established elsewhere.
  Verified live at 1280px and 375px: re-ran the full keyboard Tab-through
  on both the desktop sidebar and the mobile Sheet (logo, active/inactive
  nav items — confirming disabled items are still correctly skipped —
  Settings, Admin, Sign out), screenshotting the moment focus landed on
  each — all now show the same clearly visible Work Blue ring used
  throughout the rest of the app. Also re-confirmed, per the task's
  explicit ask, that the mobile Sheet's auto-close-on-navigation (a real
  bug fixed during the original responsiveness pass) has not regressed:
  navigated via keyboard (Tab to a nav link, Enter) and confirmed the
  `dialog` node is gone from the accessibility tree afterward, with focus
  correctly returned to the "Open menu" trigger.
- **Impeccable `audit` + `polish` pass on `/talent-acquisition/candidates/[id]`.**
  `audit` scored the page 19/20 (Excellent). Findings shown to the user
  before any change, per convention: **[P2, accessibility]** all 5 `Select`
  triggers on the page (Stage, Role, Source, Communication in
  `candidate-detail-form.tsx`; Assigned to in `assignment-field.tsx`) had no
  accessible name — confirmed live via the accessibility tree as unnamed
  `combobox [ref=...]:` nodes, same class of gap just fixed on the roles
  page. Checked whether the board's shared `StatusBadge` could stand in for
  anything here per the task's ask — it already is reused, correctly, for
  the header status pill (`page.tsx:153`); no duplicated status/cadence
  logic was found to extract. Implementation Integrity verdict: pass —
  detector (`impeccable detect --json`) returned zero findings both before
  and after. Fix: added `aria-label` to each of the 5 `SelectTrigger`s,
  matching their visible labels. Verified live at 1280px and 375px,
  including a full keyboard Tab-through of every interactive element on the
  page — Back to board link, all 5 selects, Notes textarea, Tags input,
  Edit on the roles page link — screenshotting the moment focus landed on
  each: all show a clear Work Blue ring at both widths. No horizontal
  overflow at 375px (`scrollWidth === clientWidth`, both 360px).
- **Impeccable `audit` + `polish` pass on `/talent-acquisition/roles`.**
  `audit` scored the page 16/20 (Good). Findings shown to the user before
  any change, per convention: **[P2, theming]** the "Project-Based"
  classification badge filled its background with Sun Gold — the same
  Five Percent Rule violation just fixed on the board, introduced in the
  earlier "four new fields" task before `DESIGN.md` existed to catch it.
  **[P2, accessibility]** the Job description textarea and the
  Status/Classification `Select` triggers in `role-row.tsx` had no
  accessible name — confirmed live via the accessibility tree.
  **[P3, implementation integrity]** `CLASSIFICATION_LABELS` and a `"none"`
  sentinel were copy-pasted verbatim across `role-row.tsx` and
  `new-role-form.tsx`. Checked whether the board's shared `StatusBadge`
  could be reused here per the task's ask — it can't: it's typed to
  candidate-specific cadence/due-date concepts (`CandidateStatus`/
  `NextAction`), and role status/classification is a different domain
  entirely; forcing it in would mean faking a `NextAction`. Treated the
  `CLASSIFICATION_LABELS` duplication as the honest equivalent finding
  instead. Fixes: Sun Gold moved to a small accent dot (new
  `CLASSIFICATION_DOT` map, same pattern as the board's fix); added
  `aria-label`s to the three unnamed controls; extracted the duplicated
  label map into a new shared `src/lib/talent-acquisition/
  role-classifications.ts` (mirroring `source-platforms.ts`). Verified
  live at 1280px and 375px, including — given the board's focus-ring
  regression found last session — a full keyboard Tab-through of every
  interactive element on the page (Back button, all New Role form fields,
  all five controls on an existing role row), screenshotting the moment
  focus landed on each: all show a clear Work Blue ring. None of this
  page's `Card` usages wrap a flush-fit nested button the way the board's
  did, so that clipping bug's precondition doesn't exist here.
- **Candidate cards were keyboard-focusable but showed no visible focus
  ring — a regression from the previous keyboard-accessibility fix.**
  Root cause: `Card` (`src/components/ui/card.tsx`) applies `overflow-hidden`
  as a fixed base class, and the nested `<button>` fix from the prior entry
  sat flush with the card's own edges — a box-shadow (what a Tailwind
  `ring` is) gets clipped by an *ancestor's* `overflow-hidden` once it
  extends past that ancestor's box, so the button's `focus-visible:ring-3`
  class was computing correctly and rendering nothing. Not a global
  `outline-none` reset, as first suspected — every other interactive
  element on the page (`Input`, `Select`) already showed its ring
  correctly, since none of them sit inside an `overflow-hidden` ancestor
  sized flush to their own edges. Fixed by moving the ring to the outer
  `Card` via Tailwind's `has-[:focus-visible]` variant instead of the
  nested button — an element's own shadow is never clipped by its own
  `overflow`, only by an ancestor's — plus `overflow-visible` on the `Card`
  instance as a second layer of insurance. While in there, per the task's
  explicit ask, also checked the drawer's Stage `Select` (already correct)
  and the search `Input` (already correct), and found the drawer's "View
  full profile →" link had no explicit focus style at all, relying on the
  browser's thin default outline — brought it in line with the same
  `focus-visible:ring-3 focus-visible:ring-ring/50` treatment used
  everywhere else for consistency. Verified live via Playwright MCP:
  screenshotted the moment right after Tab landed on each of five elements
  (search input, both board cards, drawer Select, drawer link) — all five
  now show a clearly visible Work Blue ring, not just "Tab reaches them."
  New fragile-area note added to `PROJECT_STATE.md` §10.
- **Impeccable `audit` + `polish` pass on `/talent-acquisition/board`.**
  `audit` scored the page 15/20 (Good): a mechanical detector found nothing,
  but manual review plus live verification (contrast math, an
  accessibility-tree check, both viewport widths) surfaced real issues.
  Findings shown to the user before any change, per the audit's own
  "show findings first" convention; user chose to fold the one P1 in with
  the requested polish pass rather than defer it.
  - **[P1, accessibility] Candidate cards were unreachable by keyboard or
    screen reader.** They were plain `onClick` `<div>`s wrapped in `Card` —
    confirmed via Playwright's accessibility tree as `role="generic"` with
    no accessible name. Fixed by nesting a real `<button type="button">`
    inside `Card` (which has no polymorphic `render` prop, unlike
    `Button`/`Sheet`/`Select` — see the fragile-area note added to
    `PROJECT_STATE.md` §10) with a descriptive `aria-label` built from the
    same status string already shown on the card. Verified live: Tab
    reaches the card, Enter opens the drawer.
  - **[P2, theming] The "soon" status badge filled its whole background
    with Sun Gold — a direct violation of `DESIGN.md`'s Five Percent Rule**
    ("never a background, never a large fill"), a locked brand-guide
    decision, not a default. Fixed by moving Sun Gold to a small accent dot
    before the label instead, on the same neutral chip `done`/`parked`
    already use. Considered a colored left-border accent first; rejected it
    since Impeccable's own craft-floor guidance bans colored side-borders on
    cards/chips, and Sun Gold as text color fails contrast outright
    (1.48:1–1.70:1, checked). The badge-render logic (`Badge` + optional dot
    + label) had already been hand-copied across three files — pulled into
    one new shared `src/lib/talent-acquisition/status-badge.tsx`
    (`StatusBadge`) instead of duplicating a fourth time, so the board card,
    board drawer, and candidate detail page all render it identically now.
  - **[P2, theming] Column container radius (8px) didn't match `DESIGN.md`'s
    own container-radius rule (12px)** — the nested candidate `Card`s
    already used 12px. `rounded-t-lg`/`rounded-b-lg` → `rounded-t-xl`/
    `rounded-b-xl` in `board-client.tsx`.
  - **[P2, accessibility] Search input had no real accessible label** beyond
    its placeholder — added `aria-label="Search candidates"`.
  - Verified live via Playwright MCP before and after, at 1440px and 375px:
    confirmed both theming fixes render correctly (temporarily backdated a
    real candidate's `last_action_at` via direct REST to force a live
    "soon" status, reverted afterward), zero console errors, and explicitly
    re-confirmed the board's custom scroll-position indicator from the
    earlier scrollbar-visibility fix still renders correctly at 375px — no
    regression. Re-ran the deterministic `impeccable detect` scanner on
    every touched file before and after: zero findings both times.
### Added
- **Back-to-board button on `/talent-acquisition/roles`.** A styled
  `Button` (`variant="outline"`, `size="sm"`), rendered as a `Link` to
  `/talent-acquisition/board`, placed directly above the "Roles"
  heading — matching the `outline`-styled `Delete` button already used
  elsewhere on this page, not a default unstyled link. Hit and fixed a
  real Base UI runtime error: `Button`'s underlying primitive defaults
  `nativeButton` to `true` and throws a console error if `render` swaps
  in something other than an actual `<button>` (here, a `Link`, which
  renders an `<a>`) without also passing `nativeButton={false}` — it
  type-checks and builds cleanly, only surfacing as a console error the
  first time the page actually renders. Verified live at desktop and
  375px mobile widths: renders correctly positioned, and clicking it
  navigates to the board.
- **Four new fields: `roles.timezone_overlap`/`classification`, `candidates.source_platform`/`communication_rating`.**
  New migration `20260919110000_add_role_and_candidate_fields.sql` —
  `roles.timezone_overlap` (text, nullable, free text e.g. "4hrs
  PHT/EST"), `roles.classification` (text, nullable, `check` constrained
  to `'embedded_operator'`/`'project_based'`), `candidates.source_platform`
  (text, nullable — JobStreet/Kalibrr/OnlineJobs.ph/LinkedIn/Bossjob/
  Referral/Other), `candidates.communication_rating` (int, nullable,
  `check (between 1 and 5)`). Applied by the user via the established
  `supabase db push --db-url` workaround (this session has no DB
  password, only the API keys), confirmed live afterward via a REST
  check on both tables, and confirmed the check constraint actually
  rejects an invalid `classification` value. No RLS/grant changes needed
  — both tables' existing "update within org" policies and the blanket
  `ALTER DEFAULT PRIVILEGES` grant already cover any column added to
  them. `timezone_overlap`/`classification` are on the roles create/edit
  form and row (`new-role-form.tsx`/`role-row.tsx`), the latter shown as
  a small colored `Badge`. `source_platform` is a dropdown on the New
  Candidate dialog and the candidate detail page; `communication_rating`
  is a 1–5 dropdown on the detail page only (not required at creation —
  it's normally set after a phone screen) — both render as plain text
  inside their `Select` trigger ("Source: Kalibrr", "Communication:
  4/5"), not a colored badge, per the task's explicit ask. Hit and fixed
  a real bug: `SOURCE_PLATFORMS` was originally exported as a plain
  `const` from `candidates-actions.ts` (a `"use server"` file) — that
  file's transform only preserves async-function exports for the client
  reference and silently drops everything else, so it type-checked and
  built cleanly but threw `SOURCE_PLATFORMS.map is not a function` the
  first time a client component actually rendered with it. Fixed by
  moving it to its own plain module, `src/lib/talent-acquisition/
  source-platforms.ts`. Verified live end-to-end: created and edited
  roles with both new fields (persisted after reload); created a
  candidate with a source platform via the dialog and confirmed it
  carried through to the detail page; set a communication rating on the
  detail page and confirmed it persisted after reload. Test data cleaned
  up afterward.
### Changed
- **Sidebar layout follow-up (cosmetic, no schema/Server Action changes).**
  Two changes to the sidebar built in the previous entry. (1) The
  greeting + display name moved from the top (below the logo) to the
  bottom, directly above "Sign out" — same `Greeting` component, just
  relocated in `layout.tsx` and `mobile-nav.tsx`'s JSX (grouped into the
  bottom `<div>` with the sign-out `<form>` instead of the top one with
  `Wordmark`/`SidebarNav`). (2) `SidebarNav` now renders two visually
  distinct groups instead of one flat list: the modules (Talent
  Acquisition Desk, plus the disabled Onboarding/Kickoff placeholders)
  stay together at the top; Settings and Admin (when `isAdmin`) moved to
  a second group below a `stone`-toned `<hr>` divider
  (`border-stone/20`, per DESIGN_SYSTEM.md's border-color token — the
  same color card borders/dividers already use elsewhere). Verified live
  at both desktop and 375px mobile widths — the mobile slide-out `Sheet`
  is a separate component (`mobile-nav.tsx`) from the desktop `<aside>`
  and needed its own check, not just an assumption that fixing
  `SidebarNav` (shared by both) was sufficient: confirmed the divider
  and bottom-greeting placement both render correctly inside the Sheet
  too, not just the always-visible desktop sidebar.
### Security
- **Sidebar polish — step 4 of 4 on the admin/assignment feature (closes it out).**
  UI-only, no schema or Server Action changes. Three parts: (1) the
  sidebar and mobile nav now show the signed-in user's own
  `profiles.display_name` — previously the only identity shown anywhere
  in the shell was the org wordmark ("upscalesupport") and a static
  "Client Fulfillment App" label, with no per-user information at all.
  `layout.tsx` fetches it via a plain own-row `SELECT` (already covered
  by the existing "profiles: select own row" RLS policy — no new grant)
  and passes it to both `layout.tsx`'s desktop sidebar and
  `mobile-nav.tsx`'s slide-out `Sheet`. (2) A new `Greeting` component
  (`src/components/shell/greeting.tsx`) shows one of eight greetings —
  "What's up", "Aloha", "Hola", "Mabuhay", "Kumusta", "Good night",
  "Magandang gabi", "Buon giorno" — picked at random next to the display
  name, small and plain per DESIGN_SYSTEM.md's tone. Hit a real
  hydration mismatch building this (picking randomly in `useState`'s
  lazy initializer runs once during SSR and again on the client with a
  different `Math.random()` result); fixed with `suppressHydrationWarning`
  on just the greeting text node, the correct tool for intentional
  client-only randomness, rather than restructuring into an
  effect-based two-render pattern (which would have tripped this repo's
  `react-hooks/set-state-in-effect` ESLint error, the same rule
  `mobile-nav.tsx` already works around for its Sheet-close logic). (3)
  `Wordmark` (`src/components/shell/wordmark.tsx`) is now a real
  `<Link href="/talent-acquisition/board">` with a hover state, in both
  the desktop sidebar and the mobile top bar/Sheet, instead of static
  markup — the board is the closest thing this app has to a home route
  (there's no `src/app/page.tsx` at `/`), matching `SidebarNav`'s own
  default destination. Verified live with two accounts: non-admin and
  admin each see their own distinct display name and a randomly-differing
  greeting (confirming genuinely per-user, per-load values, not a shared
  or cached one); the admin additionally sees the "Admin" nav link;
  clicking the logo navigates correctly from `/settings` and from the
  board itself, at both desktop and 390px mobile width, including from
  inside the mobile Sheet. Checked grants: none needed. This closes out
  all 4 steps of the admin/assignment feature.
- **Candidate assignment — step 3 of 4 on the admin/assignment feature.**
  Surfaces `candidates.assigned_to` (added in step 1) on
  `/talent-acquisition/candidates/[id]`: everyone sees who a candidate is
  currently assigned to (display name, or "Unassigned"); only admins get
  a control to change it. New `assignment-field.tsx` renders read-only
  text or an admin-only `Select` based on `isAdmin`, decided server-side
  via `getUserRole()` in `page.tsx` — the same "convenience UI, not the
  boundary" pattern as the admin nav link (step 2). The actual boundary
  is the new `updateCandidateAssignment` (in
  `talent-acquisition/candidates-actions.ts`), which requires two checks
  per the task's explicit ask: `requireAdminUser()`, and that the target
  profile is visible to the caller — mirroring `assertRoleIsVisible`'s
  exact mechanism for `role_id` (a plain scoped `SELECT`, "not found"
  treated as "not visible," not a bare trust of the foreign key).
  Notably, this action uses the **normal RLS-scoped client, not
  `admin-client.ts`** — RLS's "candidates: update within org" policy
  already lets any org member write `assigned_to`, so nothing in the
  database stops a non-admin from calling this; `requireAdminUser()` is
  the *only* thing that does, a clean illustration of SECURITY.md's
  authorization-beyond-RLS rule with zero help from the database. Same
  reasoning for the assignable-profiles dropdown list (`id`,
  `display_name` via the normal client) — RLS's "profiles: select own
  org" already permits this read for any signed-in user, admin or not,
  so there's no wall to bypass; reserving `admin-client.ts` for cases
  that actually need it (per the architecture decision from step 2).
  The current assignee's name is fetched via a
  `profiles!assigned_to(id, display_name)` embed — `candidates` now has
  *two* FKs to `profiles` (`created_by`, `assigned_to`), so the
  column-name disambiguation hint is required; verified this exact
  syntax directly against the live REST API (both null and populated
  cases) before wiring it into the page. Verified live end-to-end with
  two accounts: the member sees plain read-only "Unassigned" text with
  no control; the admin sees the `Select`, correctly lists both org
  profiles (with an "Unnamed teammate" fallback for a null
  `display_name`), and both assigning and clearing an assignment persist
  across a full page reload. Checked grants: none needed, no new
  migration — both queries go through already-granted tables via
  RLS-respecting clients.
- **Admin page (`/admin`) — step 2 of 4 on the admin/assignment feature.**
  Explicit page-level authorization, not just a hidden nav link:
  `getUserRole()` is checked in `page.tsx` before any data fetch, and a
  non-admin navigating there directly gets a real `notFound()` (404), not
  a redirect that would confirm the route exists. Verified live with two
  separate accounts, not just "as me": the admin sees the full page; the
  member gets the 404 and sees no "Admin" link in either the desktop
  sidebar or the mobile menu. New `src/lib/supabase/admin-client.ts`
  (renamed from a previously-scaffolded, never-used `service.ts` —
  same service-role implementation, reused rather than duplicated) is
  now **the one place in this codebase that intentionally bypasses
  RLS**; see the fragile-area note added to `PROJECT_STATE.md` §10.
  Lists every user (email via `supabase.auth.admin.listUsers()` — the
  only way to get email, since `profiles` doesn't store it — joined with
  `profiles` for role/display_name). An "Invite a teammate" form
  (`inviteUser` in new `src/lib/admin-actions.ts`) uses
  `supabase.auth.admin.inviteUserByEmail()`, not a signup + admin-set
  password, so the admin never sets or sees another user's password —
  verified live that both a Supabase-rejected bad-domain address and a
  real-looking one hitting Supabase's own project email rate limit both
  correctly surface as this app's generic "Couldn't send the invite"
  message (SECURITY.md's fail-securely rule), never the raw Supabase
  error. Per-row role `Select` (`updateUserRole`) and inline display-name
  edit (`updateUserDisplayName`) both write through the admin client, not
  the normal RLS-scoped one — RLS's "profiles: update own row" policy
  only ever lets a caller touch their *own* row, so there's no policy an
  admin editing someone *else's* row could go through otherwise.
  `updateUserRole` guards two failure modes, per the task's explicit
  ask, both verified live: an admin can't demote themselves
  (unconditional, not dependent on admin count — tried it, got "You
  can't demote yourself.", role reverted in the UI); demoting the last
  remaining admin is blocked by counting current admins before allowing
  the change (code-reviewed rather than independently live-reproduced —
  with two test accounts, reaching "the target is the sole admin" always
  also means the target is the acting user, which the self-demotion
  guard already catches first). All three actions call
  `requireAdminUser()` (new addition to `src/lib/auth/get-user-role.ts`,
  alongside the existing `getUserRole()`/`requireAdmin()` — returns the
  acting user too, needed for the self-demotion comparison) independently
  of the page's own check, since Server Actions are reachable as their
  own endpoints regardless of what page links to them (SECURITY.md).
  **Flagged for rate-limiting review**: `inviteUser` sends an external
  email with no app-level rate limit implemented yet — noted in the
  action's own code comment; Supabase's project-level email rate limit is
  the only backstop today (confirmed it's live, see above). Checked
  grants: none needed — `auth.admin.*` runs off the service-role key
  directly (not a PostgREST/RLS table read), and the `profiles` writes go
  through the already-granted service-role Postgres role. Also confirms
  the step-1 migrations below are now live in the database (verified
  directly against `profiles`/`candidates`, not just assumed).
- **Role-based authorization foundation — step 1 of 4 toward an admin
  page + candidate-assignment feature. Schema and a helper only. This is
  a genuine security-model shift, not just a feature add**: every
  authorization check in this app before this had been org-membership-only
  (RLS's `org_id = current_org_id()`); this added the app's first
  role-based (admin vs. member) concept. Two migrations — **now confirmed
  applied** (were written but not yet applied when first added; see the
  step-2 entry above): `profiles.role` (`text`, `check (role in
  ('admin','member'))`, default `'member'`), and `candidates.assigned_to`
  (`uuid references profiles(id)`, nullable, indexed — unused until the
  reassignment feature itself is built). The `profiles.role` migration
  also adds a `before update` trigger, `prevent_self_role_escalation`:
  the existing "profiles: update own row" RLS policy has no column-level
  restriction, so without this trigger any authenticated user could
  `PATCH` their own `role` to `'admin'` via a direct Supabase REST call,
  entirely bypassing this app's own Server Actions (which never expose a
  raw arbitrary-column update). The trigger blocks that specific attack
  vector while still allowing a service-role/SQL-Editor session through
  (`auth.uid()` is null there) — which is what made the first admin's
  manual SQL bootstrap possible, and is also why `/admin`'s own
  service-role writes (step 2, above) aren't blocked by this same
  trigger. New `src/lib/auth/get-user-role.ts` (`getUserRole()`,
  `requireAdmin()`) — every admin-only Server Action must call this (or
  `requireAdminUser()`, step 2) and check the result explicitly inside
  the action itself, not just hide the UI that links to it, per
  SECURITY.md's authorization-beyond-RLS rule. Checked grants: none
  needed, both tables are already covered by the existing blanket
  table-level grant (new columns on an existing granted table don't need
  a fresh grant).

### Changed
- Mobile responsiveness pass across the whole shell and every existing
  page. The sidebar (`src/app/(shell)/layout.tsx`) was a fixed `w-64`
  always-visible `<aside>` with no responsive behavior at all; below `md`
  it's now hidden in favor of a new `src/components/shell/mobile-nav.tsx`
  — a compact top bar (monogram + app name + hamburger) that opens the same
  `SidebarNav` content in a slide-out `Sheet`. Root padding on the board,
  roles, candidate detail, and settings pages changed from a flat `p-8` to
  `p-4 sm:p-8` so phone-width viewports get a sane gutter instead of 64px
  of desktop padding. The board's and candidate detail page's title-row
  layouts (name/title next to a badge or link) got `flex-wrap` + `min-w-0`
  on the growable side so long content wraps instead of overflowing at
  narrow widths — this turned out to be the same flex-shrink bug category
  as the board's `min-w-0` scrolling fix, just showing up on ordinary
  content rows instead of a scroll container (see `PROJECT_STATE.md` §3).
  Verified live via Playwright MCP at 1440px and 375px for all four pages
  (shell/board/roles/candidate-detail), plus the "+ New Candidate" dialog
  and the board's candidate drawer, which were already responsive with no
  changes needed.
- Fixed a real bug surfaced while building the above: Base UI's `Sheet`
  (the mobile nav menu) didn't close itself after tapping a nav link
  inside it — there's no implicit auto-close on navigation the way some
  UI kits provide. Made it a controlled component that closes on route
  change via `usePathname`, with the state reset done **during render**
  (comparing against a tracked last-seen pathname) rather than in a
  `useEffect`, since the effect version trips this repo's
  `react-hooks/set-state-in-effect` ESLint error. See the Base-UI-Sheet
  gotcha added to `PROJECT_STATE.md` §3.
- Board columns are narrower so all seven fit on a typical desktop viewport
  without horizontal scrolling: column width `w-64 shrink-0` (256px, fixed)
  → `min-w-[140px] flex-1`, the row's `gap-4` → `gap-3`. Sizing only — no
  DESIGN_SYSTEM.md colors, radius, borders, or fonts changed. Narrow windows
  still scroll horizontally, which is expected kanban behavior.
- Fixed the board's column row clipping instead of scrolling at narrower
  widths: `src/app/(shell)/layout.tsx`'s `<main>` was missing `min-w-0`, so
  as a `flex-1` item it grew to fit the columns' full intrinsic width
  instead of respecting the available viewport width, preventing the
  board's own `overflow-x-auto` row from ever needing to scroll. Added
  `min-w-0` to `main`. Verified live via Playwright MCP at 1440px (no
  scroll needed), 1100px and 800px (scrollbar present, scrolling to the end
  reveals every column, nothing clipped).
- The board's horizontal scroll worked but had no visible affordance — the
  native scrollbar only appears on hover/active-scroll (or not at all,
  depending on OS "show scrollbars" settings; confirmed unreliable even
  with `::-webkit-scrollbar`/`scrollbar-color`/`scrollbar-width` CSS during
  testing). Replaced it with a custom always-visible scroll-position
  indicator: `useHorizontalScrollThumb` in `board-client.tsx` tracks scroll
  extent and renders a thin on-brand (`stone` track, `ink-navy`-tinted
  thumb) bar below the column row, shown only when the row actually
  overflows; the native scrollbar is hidden via the `.board-scrollbar`
  utility in `globals.css`. Verified live via Playwright MCP: indicator
  absent at 1440px, present immediately on fresh page load (no scroll/hover
  needed) at 1100px/800px, and its thumb position/width tracks real scroll
  state correctly.

### Added
- `/settings` (app-level, outside `talent-acquisition/`): company name
  (`org_settings.company_name`, org-scoped — any signed-in user can edit
  it) and the signed-in user's own display name (`profiles.display_name`,
  restricted by RLS to the caller's own row), both save-on-blur following
  the same pattern as `role-row.tsx`/`candidate-detail-form.tsx`. New
  `src/lib/settings-actions.ts` (`updateCompanyName`, `updateDisplayName`).
  Checked grants: no new migration needed, both tables already covered by
  the existing `ALTER DEFAULT PRIVILEGES` migration. Added a real
  "Settings" nav link to `SidebarNav` (previously only the one Talent
  Acquisition Desk item plus the disabled Onboarding/Kickoff placeholders).
- `loading.tsx` for the board, roles, candidate detail, and settings
  routes — plain centered muted text, matching this app's no-spinner
  tone. None of the four routes had one before, so a slow fetch during
  navigation showed a blank page instead of any feedback. The existing
  empty states from earlier prompts (roles: "No roles yet…", board:
  "No one here yet" per column, candidate detail's job-description/
  next-action/history empty text) were checked and are still correct —
  no changes needed there.
- `/talent-acquisition/candidates/[id]`: the full candidate detail page —
  stage dropdown (`updateCandidateStage`), role reassignment dropdown
  including "No role — Talent Pool" (`reassignCandidateRole`), notes and
  tags fields (save-on-blur, `updateCandidateNotes`/`updateCandidateTags`),
  a read-only job-description panel sourced from the assigned role with a
  link to `/talent-acquisition/roles` to edit it, the next-action label with
  its rendered script, and the full `candidate_history` log (newest first).
  The board's drawer stays intentionally minimal (stage + next-action only)
  — its "coming soon" note is now a "View full profile →" link to this page.
  Added `src/lib/talent-acquisition/scripts.ts`, porting the prototype's
  `scriptText()` templates verbatim as a pure function taking
  `companyName`/`recruiterName` as explicit params (sourced from
  `org_settings` and the caller's own `profiles` row) instead of the
  prototype's local-storage settings object. Pulled the status-badge
  style/label maps — previously duplicated in `candidate-card.tsx` and
  `candidate-drawer.tsx` — into a shared
  `src/lib/talent-acquisition/status-styles.ts` now that a third place
  needed them. Checked whether this page's reads/writes
  (`candidates`, `roles`, `org_settings`, `profiles`, `candidate_history`)
  need any grants beyond the existing `ALTER DEFAULT PRIVILEGES` migration:
  no, all five are already covered — no new migration needed.
- Fixed the new-candidate form's role `Select` showing each option's raw
  UUID as the trigger's visible value instead of its title — Base UI's
  `Select.Value` renders the underlying value literally unless given a
  `children` render-prop mapping value → label. Added a `roleLabelFor()`
  helper and passed it to `SelectValue` as that render prop; the submitted
  `role_id` (the UUID) was unaffected.
- Follow-up to the candidate detail page: re-checked grants (still none
  needed — `profiles`/`org_settings`/`candidate_history` are all covered by
  the existing `ALTER DEFAULT PRIVILEGES` migration, confirmed by reading
  the migration directly, not just re-asserting the earlier note) and
  ported-script fidelity (`scripts.ts` diffed line-by-line against the
  prototype's `scriptText()` in `recruiting-desk.html` — verbatim match).
  Added `revalidatePath` for the candidate's own detail path
  (`/talent-acquisition/candidates/[id]`) to `updateCandidateStage`,
  `updateCandidateNotes`, `updateCandidateTags`, and
  `reassignCandidateRole` in `candidates-actions.ts` — these only
  revalidated the board path before, so the page's own History log and
  next-action display wouldn't reflect an edit made from this page without
  a hard refresh. Fixed the History list's date column getting clipped by
  the card's `overflow-hidden` at narrow widths (missing `min-w-0 flex-1`
  on the label span let it push the date past the card edge instead of
  wrapping — same category of flex-shrink bug as the board's `min-w-0`
  gotcha, see `PROJECT_STATE.md` §3). Verified live via Playwright MCP
  (manual-login-pause convention): screenshotted a real candidate
  (Gil Demiar) at 1440px — clean, no cramping/misalignment — and confirmed
  the page has no internal scrollable region (the only `overflow-y: auto`
  element is the empty notes `<textarea>`, not actually overflowing), so
  the board's custom-scroll-indicator pattern doesn't apply here; normal
  full-page scroll is correct as-is.
- A "+ New Candidate" button on the board opens a `Dialog` form
  (`new-candidate-form.tsx`) calling `createCandidate` — name, an optional
  notes field and a comma-separated tags field (matching the prototype's
  add-candidate modal plus the tags field it didn't have), and a role picker
  offering an existing role, "+ Create new role" (shows an inline title
  field, creates the role alongside the candidate), or "No role — Talent
  Pool" (defaults the candidate to the `talent_pool` stage). The board page
  now also fetches the roles list to populate the picker. Closing the dialog
  on success relies on the same `revalidatePath` the action already calls,
  so the new card just appears in its column.
- `/talent-acquisition/board`: seven columns (Talent Pool, then the six
  pipeline stages), reading live from `candidates` joined to `roles` for the
  title shown on each card, sorted by next-action due date ascending within
  each column. A search box filters visible cards by name, role title, and
  tags (client-side for v1, per the brief). Clicking a card opens a
  drawer (shadcn `Sheet`) with a stage selector wired to
  `updateCandidateStage`; deeper editing (notes, tags, role reassignment)
  is intentionally left for the candidate detail page next, not duplicated
  here. Layout/interaction (columns, drawer, status badges) is ported from
  the prototype; all visual styling is `DESIGN_SYSTEM.md`'s tokens instead
  of the prototype's own look — Warm Paper background, Stone-bordered cards,
  Work Blue accents, Bricolage Grotesque headers, tabular numerals on the
  per-column counts.
- `src/lib/talent-acquisition/cadence.ts`: `STAGE_CONFIG`, `nextActionFor`,
  and `statusFor` ported from the prototype's cadence math as pure functions,
  plus a `talent_pool` stage config (no touches, no recurring reminder — a
  deliberate no-pressure resting state, not an oversight) and its own status
  outcome (`'parked'`, always shown instead of overdue/soon/ok regardless of
  the underlying action). 13 unit tests in `cadence.test.ts` cover touch-index
  progression, the exhausted→terminal and exhausted→recurring transitions,
  the recurring-reminder date math (from `last_action_at` when present,
  `stage_entered_at` otherwise), and the overdue/soon/ok status boundaries.
  Added `vitest` as a dev dependency to run them (`npm test`) — the first
  automated tests in this repo.
- Checked whether the board's queries need any grants beyond the existing
  `ALTER DEFAULT PRIVILEGES` migration: no new tables were added and the
  board only reads `candidates`/`roles`, both already covered — no new
  migration needed.
- Server-side CRUD for candidates:
  `src/lib/talent-acquisition/candidates-actions.ts` (`createCandidate`,
  `updateCandidateStage`, `updateCandidateNotes`, `updateCandidateTags`,
  `reassignCandidateRole`) — same auth pattern as the roles actions
  (`getUser()`-derived user, fail-securely on errors). Candidate creation
  matches the prototype's add-candidate flow (name, notes, tags) plus a role
  choice the prototype didn't have to make (its "role" was free text; ours is
  a real FK): pick an existing role, create one inline, or leave it unset —
  unset defaults the candidate to `talent_pool` instead of `sourced`.
  `updateCandidateStage` mirrors the prototype's `moveStage()` exactly
  (resets `stage_entered_at`/`last_action_at`/`touch_index` and logs a
  `candidate_history` row). Added an explicit authorization check beyond RLS
  for any action that accepts a `role_id`: a role's RLS `select` policy
  governs direct reads of that table, but doesn't stop an arbitrary UUID from
  another org being accepted as a foreign key elsewhere, so `role_id`s are
  re-verified visible to the caller before use. No UI for this yet — the
  add-candidate form and board live in the next prompt.
- Server-side CRUD for roles: `src/lib/talent-acquisition/roles-actions.ts`
  (`createRole`, `updateRoleTitle`, `updateRoleJobDescription`,
  `updateRoleStatus`, `deleteRole`) — every action derives the user via
  `getUser()` server-side (never a client-passed id), relies on RLS org
  scoping for authorization (no external side effect to separately check),
  and fails securely with generic messages while logging real errors
  server-side. `/talent-acquisition/roles` lists roles with an inline-editable
  title, job description, and status (save-on-blur / save-on-select, each
  field its own Server Action call), a status badge, a live candidate count
  per role, delete (blocked with a friendly message if candidates still
  reference the role), and a form to add a new role.
- Found and fixed a real bug while building this: the tables from the Prompt 3
  migration had RLS but no table-level Postgres `GRANT`s, so every request —
  even with the service-role key — failed with "permission denied", before
  RLS was ever evaluated. Added
  `supabase/migrations/20260914060451_fix_grants_and_roles_delete_policy.sql`
  (grants + default privileges for `authenticated`/`service_role`, deliberately
  none for `anon`) alongside the roles `delete` RLS policy this task needed.
  Neither this nor the Prompt 3 migration has been applied yet — see
  `docs/PROJECT_STATE.md`.
- Database schema as a Supabase migration
  (`supabase/migrations/20260914053122_initial_schema.sql`), not applied —
  `profiles`, `roles`, `candidates`, `candidate_history`, `candidate_drafts`,
  and `org_settings` per `BUILD_BRIEF.md` §4, with RLS enabled on every table
  and org-scoped select/insert/update policies (derived through the parent
  `candidates` row for the two tables without their own `org_id` column). Adds
  a `security definer` `current_org_id()` helper so the `profiles` table's own
  policy can check org membership without recursive RLS. Seeds the single
  hardcoded org's `org_settings` row.
- Invite-only Supabase email/password auth: a `/login` page (outside the shell)
  backed by a `login` Server Action, and a `(shell)` route group whose layout
  checks `supabase.auth.getUser()` server-side and redirects unauthenticated
  requests to `/login` — no public sign-up route. The shell sidebar shows a
  text-based stand-in for the UpScaleSupport wordmark alongside "Client
  Fulfillment App", with "Talent Acquisition Desk" active and "Onboarding" /
  "Kickoff" as disabled "Coming soon" items. Added a sign-out Server Action.
  Root `/` now lives inside the shell and redirects to
  `/talent-acquisition/board` (placeholder page for now), replacing the
  Prompt 1 demo page. Verified locally against a real Supabase project and
  redeployed to Vercel with the real project's env vars.
- Scaffolded the Next.js (App Router, TypeScript) project, Tailwind CSS v4 with a
  CSS-first `@theme` config carrying the UpScaleSupport brand tokens (colors,
  Bricolage Grotesque + Inter, no dark mode), and shadcn/ui. Wired up
  `@supabase/ssr` (cookie-based client/server/proxy helpers, `getUser()` only —
  never `getSession()`) plus a server-only service-role client. Added
  `.env.example` and deployed a minimal build to Vercel to confirm the pipeline
  works end to end.
