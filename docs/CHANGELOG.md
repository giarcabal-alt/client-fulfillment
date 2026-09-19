# Changelog

## [Unreleased]
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
