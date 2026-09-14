# Client Fulfillment App — Project State & Handover

_Last updated: 2026-09-14 by Claude Code (Prompt 4 — roles CRUD + page)_

---

## 1. One-line project summary
Internal tool for UpScaleSupport to run talent acquisition end-to-end: candidate sourcing, pipeline tracking with cadence-based reminders, AI-drafted outreach messages, and a searchable talent pool — for sourcing the AI-fluent operators UpScaleSupport embeds with clients. First module of a larger Client Fulfillment App (Onboarding and Kickoff modules planned later, not yet built).

## 2. Tech stack
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS v4 (CSS-first `@theme` config, no `tailwind.config.js`) + shadcn/ui
- Design: UpScaleSupport Brand Guide v2 (locked 2026-07-23), documented in `docs/DESIGN_SYSTEM.md`
- Backend/API: Next.js Server Actions (no separate API layer)
- DB: Supabase Postgres — project created (`urfvgbdkxmvlnvwdkdaz`). Schema + grants fix written as two migrations, **neither applied yet** to the remote project — see §6.
- Auth: Supabase Auth (email/password, invite-only, no public signup)
- Infra/hosting: Vercel — not yet deployed, not yet linked
- Repo: not yet created
- Package manager/runtime: npm, Node version not yet pinned — recommend adding `.nvmrc` in Prompt 1
- AI: direct server-side fetch to the Anthropic API (`claude-sonnet-4-6`) for single-shot suggested-message generation — no SDK dependency required unless one gets added later for a specific reason
- Dev tooling: none decided yet. Worth considering Playwright MCP for Claude Code to self-verify UI changes via real browser screenshots, the way the 3PL project used it — not required, but flag it as an option before Prompt 1 if you want the same workflow here.

---

## 3. SESSION RESTART CHECKLIST

- cd into project root
- nvm use (once `.nvmrc` exists)
- Start Docker Desktop (required for `supabase db reset`'s local shadow DB) — must be fully started before any `supabase` CLI command, or it fails with a socket-connection error
- Terminal 1: `claude` (or open the VS Code extension panel)
- Tell Claude Code to read `BUILD_BRIEF.md`, `CODING_STANDARDS.md`, `SECURITY.md`, `docs/DESIGN_SYSTEM.md`, `docs/PROJECT_STATE.md`, and `docs/CHANGELOG.md` before doing anything
- Terminal 2: `npm run dev`, confirm `http://localhost:3000` loads and you can log in

Known gotchas (carried forward from the 3PL project — likely to recur here too, since it's the same Supabase/Vercel stack):
- `supabase db reset` fails with a socket error if Docker Desktop isn't fully started yet — wait for the whale icon to settle.
- Migration files sometimes get created and applied but NOT committed to git — run `git status` after any Supabase CLI work and confirm the new `.sql` file is committed before moving on.
- `supabase login` sessions can expire/loop on a Keychain prompt — if a CLI command throws an auth error, just re-run `supabase login`.
- The Vercel project (`client-fulfillment`) was originally linked with Framework Preset "Other" (from before the app existed), which made deploys silently serve 404s for every route even though `next build` succeeded — the Output Directory defaulted to `public`/`.` instead of the Next.js build output. Fixed via `vercel project update client-fulfillment --framework nextjs -y`. If a deploy ever 404s on `/` despite a clean build log, check `vercel project inspect client-fulfillment` for the Framework Preset first.
- Local dev and Vercel both need `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` set (even to placeholders) or the proxy's `getUser()` call throws on every request — see `.env.local` and `vercel env ls`.
- Adding `NEXT_PUBLIC_`-prefixed env vars via `vercel env add` prompts/errors unless you pass `--type config` explicitly — the CLI treats anything that "looks like a credential" under a public prefix as ambiguous and refuses to guess. This is expected for the Supabase anon key (it's meant to be public); use `--type secret` instead for anything that must stay hidden (e.g. `SUPABASE_SERVICE_ROLE_KEY`, which the CLI already defaults to Secret on its own since it has no `NEXT_PUBLIC_` prefix).
- Migrations in this repo are written and reviewed by hand, then applied deliberately (`supabase db push` / `db reset`) — never as a side effect of writing the file. If a migration file exists but its tables don't show up when querying the app, check whether it's actually been applied yet before assuming a bug.
- **All six tables from the Prompt 3 migration came back `permission denied for table X` (Postgres 42501) when tested directly against the real project's REST API — with both the anon key and the service-role key**, even though RLS policies exist. This is a missing table-level `GRANT`, not an RLS issue (RLS denial returns zero rows, not a 42501 error) — confirmed by testing with the service-role key, which bypasses RLS entirely and still got the same error. `supabase/migrations/20260914060451_fix_grants_and_roles_delete_policy.sql` fixes this, but **it hasn't been applied either**. If you apply the Prompt 3 migration alone and still get "permission denied," this is why — apply both migrations, in order, before testing anything against these tables.
- This CLI session's `supabase` login only has access to an unrelated project (`3pl-sourcing`) — `supabase link` to this app's actual project (`urfvgbdkxmvlnvwdkdaz`) hasn't been done from here, so migrations were validated by direct REST calls (curl with the anon/service-role keys) instead of `supabase db push`/`db diff`. Whoever applies these migrations will need to link the correct project first.

Project-specific watch-item (not yet encountered here, but worth checking every session given the design history — see §10):
- Confirm the AI draft-generation call still only happens from a server action, never a client-side fetch. This app's design went through a version that called the Anthropic API directly from the browser before it was corrected — if any regression reintroduces that pattern, the API key would be exposed to anyone who opens dev tools.

---

## 4. CURRENT STATE — what's done

Prompt 4 (roles CRUD + page) from `BUILD_BRIEF.md` §9 is written, on top of Prompts 1–3:
- `src/lib/talent-acquisition/roles-actions.ts`: `createRole`, `updateRoleTitle`, `updateRoleJobDescription`, `updateRoleStatus`, `deleteRole` — all Server Actions. Each calls `requireUser()` (a `getUser()` check, never `getSession()`) before touching the DB; none accept a user id or session state from the caller. These are plain DB reads/writes with no external side effect, so RLS's org scoping is the authorization boundary (per `SECURITY.md`, only actions with an external side effect need a check *beyond* RLS). Every action fails securely — generic client-facing error strings, real errors only ever hit `console.error` — including a specifically-worded one for `deleteRole` when a foreign-key violation (Postgres `23503`) means candidates still reference the role.
- `/talent-acquisition/roles` (`src/app/(shell)/talent-acquisition/roles/`): a Server Component page fetches roles with a live candidate count via PostgREST's embedded-resource aggregate (`candidates(count)`), an `add role` form (`new-role-form.tsx`, `useActionState` + `createRole`), and one `RoleRow` client component per role (`role-row.tsx`) with inline-editable title (save on blur), job description (textarea, save on blur), and status (`Select`, save on change, rendered as a colored `Badge` — work-blue/open, growth-green/filled, stone/closed) plus a delete button. Added a link to it from the board placeholder page since nothing else pointed here yet.
- Added `select` and `textarea` from shadcn/ui (no new npm dependencies — both used already-installed Base UI/cva plumbing).
- **Found a real bug while testing this against the actual Supabase project**: every table came back `permission denied for table X` via direct REST calls, with *both* the anon and service-role keys — a missing table-level `GRANT`, not an RLS policy gap (confirmed since RLS denial returns empty results, not a 42501 permission error, and the service-role key bypasses RLS entirely yet still failed). Wrote `supabase/migrations/20260914060451_fix_grants_and_roles_delete_policy.sql` to grant `select`/`insert`/`update`/`delete` (+ matching default privileges for future tables) to `authenticated` and `service_role` — deliberately not `anon`, since this app has no unauthenticated data access. The same migration adds the `roles` `delete` RLS policy this task needed (the Prompt 3 migration only covered select/insert/update, per the brief). **Neither this migration nor Prompt 3's has been applied** — see §6/§7.
- Not exercised end-to-end with real data: no migration is applied yet, and there's still no user account in the Supabase dashboard, so the roles page has only been verified by build/lint and by confirming the route still 307-redirects when unauthenticated.

Prompt 3 (database schema) from `BUILD_BRIEF.md` §9 is written, on top of Prompts 1–2:
- `supabase/migrations/20260914053122_initial_schema.sql` creates `profiles`, `roles`, `candidates`, `candidate_history`, `candidate_drafts`, and `org_settings` exactly per `BUILD_BRIEF.md` §4, in FK-safe order. Adds indexes on every `org_id`/foreign-key column used by the RLS policies. Seeds one `org_settings` row for the hardcoded org (`00000000-0000-0000-0000-000000000001`).
- RLS is enabled on all six tables. `roles`, `candidates`, and `org_settings` (which carry their own `org_id`) get straightforward org-scoped select/insert/update policies. `candidate_history` and `candidate_drafts` have no `org_id` column of their own (per the brief's schema) — their policies derive org membership through an `exists` subquery joining back to `candidates` on `candidate_id`.
- Added a `security definer` SQL function, `public.current_org_id()`, that every policy calls to look up the caller's `org_id` from `profiles`. This is the standard Supabase fix for the recursion you'd otherwise hit on `profiles`' own policy (a normal policy querying `profiles` from inside a policy *on* `profiles` re-triggers RLS on itself); `profiles` also gets its own select/insert/update policies (select: same org; insert/update: only your own row, `id = auth.uid()`).
- `supabase init` was run to create `supabase/config.toml` and `supabase/.gitignore` (first time this project has had a `supabase/` directory).
- **Not yet applied anywhere** — not to the remote project, not to a local Docker shadow DB — per this task's explicit "do not apply it by hand" instruction. Validated by manual review only (balanced parens/dollar-quotes, correct table creation order, policy command counts) since running `supabase db push` or `db reset` would apply it. Apply with `supabase db push` (or `supabase db reset` for local dev, once Docker Desktop is running) when ready — see §7.

Prompt 2 (app shell + auth) from `BUILD_BRIEF.md` §9 is complete, on top of Prompt 1:
- A real Supabase project now exists (`urfvgbdkxmvlnvwdkdaz.supabase.co`) — no tables in it yet, that's Prompt 3.
- Invite-only email/password auth: `src/app/login/page.tsx` (redirects to `/` if already signed in), `login-form.tsx` (Client Component using React 19's `useActionState`), and `actions.ts` (`login` Server Action — validates the two fields manually, calls `signInWithPassword` via the cookie-based server client, returns a generic "Invalid email or password" on failure per `SECURITY.md`'s fail-securely rule, never zod here since two required-string fields didn't justify adding the dependency — revisit when Prompt 3+'s CRUD actions need real schema validation). No public sign-up route exists anywhere.
- `src/app/(shell)/layout.tsx` is a Server Component that calls `supabase.auth.getUser()` (never `getSession()`) and redirects to `/login` if there's no user — this is what actually protects every route under the shell, not the proxy (the proxy only refreshes the session cookie). Renders the sidebar (`Wordmark` + "Client Fulfillment App" + `SidebarNav`) and a sign-out form wired to the `signOut` Server Action in `src/app/(shell)/actions.ts`.
- `src/components/shell/sidebar-nav.tsx`: "Talent Acquisition Desk" links to `/talent-acquisition/board` and highlights when the pathname matches; "Onboarding" and "Kickoff" render as non-interactive rows labeled "Coming soon" — no routes exist behind them.
- `src/components/shell/wordmark.tsx` is a **text-based stand-in** for the real UpScaleSupport wordmark (a "us." tile + lowercase "upscalesupport" text) — no logo SVG/PNG asset exists in the repo. See §7.
- Root `/` now resolves inside `(shell)` (`src/app/(shell)/page.tsx`) and redirects to `/talent-acquisition/board`, which is a placeholder page ("Board UI lands in a future prompt") — this replaced the Prompt 1 demo card at `src/app/page.tsx`, which was deleted.
- Verified end to end: unauthenticated requests to `/` and `/talent-acquisition/board` 307-redirect to `/login` both locally and on the redeployed Vercel production URL; `/login` renders correctly in both places. Not yet tested with an actual successful sign-in — no user account has been created in the Supabase dashboard yet (§7).

From Prompt 1 (scaffold), still current:
- Next.js (App Router, TypeScript) scaffolded at the repo root, npm as the package manager, `.nvmrc` pinned to 20 (matches the installed local toolchain).
- Tailwind CSS v4 set up CSS-first — brand tokens, fonts, and shadcn's semantic tokens all live in `src/app/globals.css`'s `@theme` blocks, no `tailwind.config.js`. No dark mode (design system is light-only by design).
- shadcn/ui initialized (`components.json`, `new-york`-equivalent `base-nova` style, Base UI primitives) with `button`, `card`, `badge`, `separator`, `input`, `label` installed so far. `Card` was edited to use a real `border-border` (stone) instead of the default ring, per `DESIGN_SYSTEM.md` §4.
- `@supabase/ssr` wired up: `src/lib/supabase/client.ts` (browser), `server.ts` (Server Components/Actions, cookie-based), `middleware.ts` (session-refresh helper used by `src/proxy.ts` — Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`), and `service.ts` (service-role client, server-only by convention). Every auth check must use `getUser()`, never `getSession()`, per `SECURITY.md`.
- `src/lib/config.ts` centralizes all env var reads (`CODING_STANDARDS.md` §3).
- `.env.example` documents `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.
- Deployed to Vercel (project `client-fulfillment`, already linked via `.vercel/`) — see §8 for the framework-preset gotcha this surfaced. Vercel env vars now hold the real Supabase project's keys (updated in Prompt 2, replacing the Prompt 1 placeholders).
- A working prototype exists (`recruiting-desk.html`) — a single-file HTML/JS mockup of the board, roles, talent pool, and AI-draft-generation UX. It's a design and logic reference only; **no data in it migrates anywhere**.
- Local dev environment (VS Code, Claude Code extension, Node, git, Supabase CLI, Vercel CLI) is set up.

## 5. IN PROGRESS

Nothing in progress.

## 6. NEXT TASK

Link this app's real Supabase project (`supabase link --project-ref urfvgbdkxmvlnvwdkdaz`, whichever account owns it — the CLI here is logged into an unrelated one) and apply both pending migrations in order (`supabase db push`, or `db reset` locally once Docker Desktop is running): `20260914053122_initial_schema.sql` then `20260914060451_fix_grants_and_roles_delete_policy.sql`. Create at least one Supabase Auth user and a matching `profiles` row, then verify RLS policies as a non-owner authenticated user per `SECURITY.md`'s policy-verification requirement (still not done — no policy has been tested against real data) and confirm the roles page actually works end to end. Then run Prompt 5 (`BUILD_BRIEF.md` §9): Candidates CRUD.

## 7. OPEN DECISIONS / QUESTIONS

- **Neither migration has been applied yet** (deliberately — see §4/§6). Until they are, the roles page and its Server Actions will fail against the real project — first with "relation does not exist" (Prompt 3 not applied), then with "permission denied" (Prompt 3 applied but not the grants-fix migration) if applied out of order or partially.
- **No rate limiting on the roles mutation actions.** `SECURITY.md` flags "any action that mutates state" for a rate-limiting review before shipping — `createRole`/`updateRole*`/`deleteRole` don't have any yet. Lower urgency than the AI drafting action (no per-call cost), but still an open item; revisit alongside the AI action's rate limiting (§7 below) rather than solving it twice.
- **RLS policies haven't been verified against real data yet.** `SECURITY.md` requires testing each policy as a non-owner authenticated user before merge (e.g. confirm a second profile in the same org can see the first's candidates, and that a policy doesn't unintentionally match on `NULL`). This can only happen after the migration is applied and at least two profiles/users exist — do this before Prompt 4 builds real CRUD against these tables.
- **Profile provisioning isn't decided.** `profiles` rows aren't created automatically today (no trigger on `auth.users` insert) — the brief doesn't specify one, and accounts are created manually in the Supabase dashboard per Prompt 2. Someone needs a `profiles` row before any RLS-protected query will return anything for them; decide whether that's a manual insert per new hire or a trigger, before onboarding a second recruiter.
- **No real logo asset exists yet.** The sidebar wordmark (`src/components/shell/wordmark.tsx`) is a plain-text stand-in ("us." tile + lowercase "upscalesupport"), not the actual brand asset described in `DESIGN_SYSTEM.md` §5 (specific blue/gold coloring, exact wordmark artwork). Swap in the real SVG/PNG when one is available — don't try to hand-guess the brand's exact colors/kerning for it.
- No user account exists in the Supabase dashboard yet, so the sign-in flow itself (as opposed to route protection) hasn't been exercised end-to-end. Create one via the Supabase dashboard (Authentication > Users) to test.
- Whether/when to promote future deploys beyond this minimal confirmation build — no timeline set yet.
- Shared candidate/employee record design across this module and the future Onboarding/Kickoff modules — deliberately deferred until Onboarding is actually being built (see `BUILD_BRIEF.md` §3).
- Tags on candidates are a plain comma-separated text column for now — fine at current scale, but if the talent pool grows into the hundreds, revisit with a proper tags table or Postgres full-text search rather than before.
- Cadence timers use literal calendar days, not business days — flagged as a possible refinement, not decided either way.
- Exact rate-limiting mechanism for the AI draft-generation action is specified only as "a basic per-org daily cap" in `BUILD_BRIEF.md` §5 — the concrete implementation (a counter table vs. a service like Upstash) isn't chosen yet.

## 8. KEY ARCHITECTURE DECISIONS

- 2026-09-11 — Chose Next.js + Supabase (DB/Auth) + Vercel to match the stack already used successfully on the 3PL project.
- 2026-09-11 — App is named Client Fulfillment App, a sidebar shell of modules. Talent Acquisition Desk is the first module; Onboarding and Kickoff are planned but explicitly not built yet (disabled sidebar placeholders only).
- 2026-09-11 — Talent Acquisition routes and domain logic live under a `talent-acquisition/` folder specifically, so future modules don't get tangled into this one's tables or routes. `/settings` stays app-level.
- 2026-09-11 — Roles are a separate table from candidates (`role_id` FK), not a field on each candidate — avoids duplicating the same job description across every candidate on one requisition.
- 2026-09-11 — Talent Pool is a stage (`stage = 'talent_pool'`, nullable `role_id`), not a separate table — a candidate can move in and out of it via the same stage/role mechanisms used everywhere else.
- 2026-09-11 — AI drafting is single-shot generation per next-action, not a persisted chat thread — cheaper (stateless, no growing context to re-send), and simpler for a non-technical eventual hire to use than a chat interface.
- 2026-09-11 — Rejected calling the Anthropic API from the client directly (an earlier prototype iteration did this) — moved to a server-side action after recognizing it would expose the API key. See fragile-area note in §10.
- 2026-09-11 — Rejected LinkedIn/X scraping-based sourcing — LinkedIn's Talent Solutions API requires an enterprise partnership and Recruiter seat licensing; scraping-based workarounds (e.g. Proxycurl) carry real legal risk after LinkedIn's 2025 lawsuit against that category of tool.
- 2026-09-11 — Rejected embedding a Claude.ai Pro-subscription login inside the app to avoid API costs — Anthropic's terms don't allow routing a Free/Pro/Max login through a third-party application.
- 2026-09-11 — Adopted the UpScaleSupport Brand Guide v2 (locked 2026-07-23) as the app's design system, resolving the open CSS-framework question in favor of Tailwind CSS v4 + shadcn/ui, matching the 3PL project's pattern. The prototype's manila-folder visual styling is fully superseded — only its layout/interaction logic (columns, drawer, badges) carries forward; see `DESIGN_SYSTEM.md` section 6.
- 2026-09-11 — Scaffolded in a scratch directory and merged into this repo rather than running `create-next-app` directly here, because the repo already had `BUILD_BRIEF.md`/`CODING_STANDARDS.md`/`DESIGN_SYSTEM.md`/`SECURITY.md`/`.vercel/` in place and `create-next-app` refuses to scaffold into a non-empty directory.
- 2026-09-11 — Renamed the Next.js `middleware.ts` convention file to `src/proxy.ts` (exporting `proxy` instead of `middleware`) — Next.js 16 deprecated the old convention name; the underlying session-refresh logic still lives in `src/lib/supabase/middleware.ts`.
- 2026-09-11 — Route protection lives in the `(shell)` layout's own `getUser()` check, not in the proxy. The proxy only refreshes the session cookie on every request (the standard `@supabase/ssr` pattern) — it does not redirect. Putting the actual auth gate in the layout keeps the "what requires login" decision colocated with the routes it protects, and matches SECURITY.md's expectation that authorization checks happen where the code that needs them runs, not implicitly in shared middleware.
- 2026-09-11 — Login form validates its two fields manually instead of adding Zod, even though `SECURITY.md` calls for "a strict schema library (e.g., Zod)" on Server Actions — two required strings didn't justify a new dependency under the standing "ask before adding a dependency" rule from Prompt 1. Revisit this when Prompt 3+'s candidate/role CRUD actions have real validation surface area (multiple fields, types, formats) where hand-rolled checks would actually be worse than a schema library.
- 2026-09-14 — `candidate_history` and `candidate_drafts` were left without their own `org_id` column, matching `BUILD_BRIEF.md` §4's schema exactly, even though the brief's policy-shape paragraph lists them alongside the org-scoped tables. Their RLS policies instead derive org membership through an `exists` subquery against the parent `candidates` row (via `candidate_id`) — this satisfies "org-scoped" without adding a column the brief didn't ask for, at the cost of a join on every policy check (acceptable at this scale; revisit only if it shows up in query performance later).
- 2026-09-14 — Added a `security definer` `current_org_id()` function rather than inlining `(select org_id from profiles where id = auth.uid())` in every policy. This isn't just DRY — it's required correctness: a normal (non-definer) subquery in `profiles`' own select policy would recursively re-trigger that same policy on every row, either erroring or returning nothing. `security definer` (with `set search_path = public`, per Postgres's own guidance to avoid search-path hijacking) is the standard Supabase pattern for this.
- 2026-09-14 — Seeded a single `org_settings` row for the hardcoded org directly in the migration, rather than leaving the table empty until Prompt 9's settings page inserts one. The org itself is already hardcoded everywhere else (every table's `org_id` default), so a settings page with nothing to read on first load seemed like an avoidable gap rather than a meaningful deferral.
- 2026-09-14 — Migration was generated via `supabase migration new` (after a first-time `supabase init` for this project) rather than hand-naming the file, so its timestamp prefix matches what the Supabase CLI itself would produce and applies cleanly with `supabase db push`. Written but deliberately **not applied** — this task's instruction was explicit that migrations ship as files only, never run by hand.
- 2026-09-14 — Roles CRUD Server Actions still validate manually rather than adding Zod, continuing the Prompt 2 decision — three fields (a required string, an optional string, a three-value enum) is still simple enough that hand-rolled checks aren't worse than a schema library. This is close to the line; candidates (Prompt 5) will have more fields and is the more likely place to actually cross it.
- 2026-09-14 — Split roles editing into four separate Server Actions (`updateRoleTitle`/`updateRoleJobDescription`/`updateRoleStatus`) rather than one `updateRole(id, patch)` action, matching "one responsibility per function" (`CODING_STANDARDS.md` §3) and letting each field save independently on its own blur/change event without the client needing to track which fields changed.
- 2026-09-14 — Table-level grants were fixed by adding an explicit migration (`grant ... to authenticated, service_role` + matching `alter default privileges`) rather than by re-running the Prompt 3 migration differently. This keeps every applied change in the migration history instead of silently fixing state by hand, and means it doesn't matter *how* the original migration got applied (dashboard, CLI, or otherwise) — this one is self-contained. Deliberately did not grant anything to `anon`, since the app has no unauthenticated data access; only `authenticated` and `service_role` need it.

## 9. FILE MAP

Built so far (Prompts 1–4); rows still marked "not yet built" are the planned layout from `BUILD_BRIEF.md`.

| Area | Path |
|---|---|
| DB schema / migrations | `supabase/migrations/20260914053122_initial_schema.sql`, `20260914060451_fix_grants_and_roles_delete_policy.sql` — written, **neither yet applied** (§4/§6) |
| Supabase CLI project config | `supabase/config.toml` |
| Brand tokens, fonts, shadcn theme | `src/app/globals.css` |
| Fonts loaded (next/font) | `src/app/layout.tsx` |
| shadcn config | `components.json` |
| shadcn primitives | `src/components/ui/` (button, card, badge, separator, input, label, select, textarea) |
| Supabase browser client | `src/lib/supabase/client.ts` |
| Supabase server client (cookie-based, `getUser()`) | `src/lib/supabase/server.ts` |
| Supabase session-refresh helper | `src/lib/supabase/middleware.ts` (used by `src/proxy.ts`) |
| Supabase service-role client | `src/lib/supabase/service.ts` |
| Centralized env var access | `src/lib/config.ts` |
| Env var placeholders | `.env.example` |
| Login page + form + Server Action | `src/app/login/page.tsx`, `login-form.tsx`, `actions.ts` |
| Shell layout (auth gate + sidebar) | `src/app/(shell)/layout.tsx` |
| Shell root redirect | `src/app/(shell)/page.tsx` → `/talent-acquisition/board` |
| Sign-out Server Action | `src/app/(shell)/actions.ts` |
| Sidebar nav + wordmark stand-in | `src/components/shell/sidebar-nav.tsx`, `wordmark.tsx` |
| Talent Acquisition board (placeholder, links to Roles) | `src/app/(shell)/talent-acquisition/board/page.tsx` |
| Roles page (list + inline edit + add form) | `src/app/(shell)/talent-acquisition/roles/page.tsx`, `role-row.tsx`, `new-role-form.tsx` |
| Roles Server Actions | `src/lib/talent-acquisition/roles-actions.ts` |
| App-level settings | `src/app/(shell)/settings/` — not yet built |
| Candidates routes | `src/app/(shell)/talent-acquisition/candidates/[id]/` — not yet built |
| Talent Acquisition domain logic | `src/lib/talent-acquisition/cadence.ts`, `scripts.ts` — not yet built |
| AI draft-generation server action | wherever `generateSuggestedMessage()` lands per `BUILD_BRIEF.md` §5 — not yet built |
| Design/logic reference (not shipped code) | `recruiting-desk.html` (prototype — logic reference only, not visual) |
| Design system | `DESIGN_SYSTEM.md` (UpScaleSupport Brand Guide v2, translated to dev tokens) |
| Tests | None planned yet beyond the cadence-logic unit tests called for in `BUILD_BRIEF.md` §6 |

## 10. DO NOT TOUCH / FRAGILE AREAS

- **The Anthropic API call must stay server-side.** An earlier prototype iteration called the API directly from the browser; this was corrected specifically because it would expose `ANTHROPIC_API_KEY` to anyone who opened dev tools. Any future change here needs the same auth + org check described in `BUILD_BRIEF.md` §5 before it touches the API.
- **`getUser()`, never `getSession()`**, anywhere auth state is checked server-side, per `SECURITY.md` — `getSession()` trusts a locally-stored JWT without revalidating it.
- **The `(shell)` layout's `getUser()` redirect is the actual route protection** — the proxy (`src/proxy.ts` / `src/lib/supabase/middleware.ts`) only refreshes the session cookie and does not gate access. Don't remove the layout's auth check on the assumption the proxy already handles it.
- **Every table gets `org_id` and RLS enabled on creation**, even though there's only one org today — this is what makes a future second org (or the eventual client/lead-gen app) a data change instead of a security rewrite. Don't add a table that skips this.
- **The Talent Pool stage (`talent_pool`) must not get a cadence config with `touches` or `recurDays`.** No reminder pressure on parked candidates is a deliberate design choice, not an oversight — adding one back would undo the reason the pool exists.
- **`roles.job_description` is the single source of truth for a requisition's JD**, not a per-candidate field — don't reintroduce a candidate-level job description column; it was deliberately removed to avoid duplicating the same text across every candidate on one role.
- **`candidate_history` and `candidate_drafts` intentionally have no `org_id` column** — their RLS policies derive org membership through `candidate_id` → `candidates.org_id` instead. Don't "fix" this by adding a column without updating the policies (or vice versa); it's a deliberate match to `BUILD_BRIEF.md` §4's schema, not an oversight.
- **`public.current_org_id()` must stay `security definer`.** Changing it to a normal function will break `profiles`' own select policy with RLS recursion (a policy on `profiles` querying `profiles` re-triggers itself). If it ever needs to change, keep `set search_path = public` too.
- **Any Server Action with a side effect (the AI draft generator, any future third-party API call) needs its own authorization check beyond RLS** — RLS protects direct DB reads/writes, but an action calling an external API needs an explicit org/ownership check per `SECURITY.md`.
