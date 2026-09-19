# Changelog

## [Unreleased]
### Changed
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
