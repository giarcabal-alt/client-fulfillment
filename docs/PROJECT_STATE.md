# Client Fulfillment App — Project State & Handover

_Last updated: 2026-09-11 by [you]_

---

## 1. One-line project summary
Internal tool for UpScaleSupport to run talent acquisition end-to-end: candidate sourcing, pipeline tracking with cadence-based reminders, AI-drafted outreach messages, and a searchable talent pool — for sourcing the AI-fluent operators UpScaleSupport embeds with clients. First module of a larger Client Fulfillment App (Onboarding and Kickoff modules planned later, not yet built).

## 2. Tech stack
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS v4 (CSS-first `@theme` config, no `tailwind.config.js`) + shadcn/ui
- Design: UpScaleSupport Brand Guide v2 (locked 2026-07-23), documented in `docs/DESIGN_SYSTEM.md`
- Backend/API: Next.js Server Actions (no separate API layer)
- DB: Supabase Postgres — project not yet created. Deliberately on a **separate Supabase account** from the 3PL project, not just a separate project on the same account. Project ref: _fill in once created._
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
- **General pattern to watch for:** this app deliberately uses separate accounts from the 3PL project (Supabase confirmed, GitHub turned out to be separate too). Any CLI tool that caches a single global login (Supabase CLI, git/GitHub credentials, potentially others later) can silently apply the wrong account's credentials to this project instead of prompting for the right one. When something fails with a permissions/403 error that doesn't make sense, check *which account* the tool thinks it's using before assuming the problem is something else.
- This app's Supabase project is on a **different account** than the 3PL project. Don't run global `supabase login`/`logout` to switch between them — instead `export SUPABASE_ACCESS_TOKEN=<token>` (from this account's Access Tokens page) in this project's terminal session only. Forgetting this and running `supabase login` globally will silently point this folder's CLI commands at the wrong account until you switch back.
- This app's GitHub repo is under a **different GitHub account** (`giarcabal-alt`) than the 3PL project (`dani-mgs`). A cached git credential (Keychain or `gh` CLI) for the old account can cause pushes to fail with a 403 "Permission denied" even though the repo URL itself is correct. Fix: `git remote set-url origin https://<correct-username>@github.com/...` to force a fresh credential prompt, or clear the cached entry in Keychain Access / `gh auth login` as the correct account.
- `supabase link` fails on this machine with "does not have the necessary privileges to access this endpoint" — a known, currently-unresolved Supabase platform/CLI bug unrelated to actual account permissions. Workaround in use: `supabase db push --db-url '<pooler-connection-string>'` (Docker Desktop must be running; use the **pooler** connection string, not the direct `db.xxxxx.supabase.co` one — the direct one resolves to IPv6 and fails with `ECONNREFUSED` on networks without proper IPv6 routing).
- **Writing an RLS policy is not enough — Postgres checks table-level `GRANT`s before RLS is ever evaluated.** The initial schema migration created policies but never granted `authenticated` basic SELECT/INSERT/UPDATE/DELETE on the tables, so every write failed with `permission denied for table X` until a follow-up grants migration fixed it. Any new table needs both: RLS policies AND an explicit grant (or rely on the `ALTER DEFAULT PRIVILEGES` clause already in place, which should auto-cover genuinely new tables going forward).
- Supabase's dashboard **Triggers page filters by schema and can hide triggers on `auth.users`** under the wrong tab — a trigger existing and working correctly can look "missing" in the UI. Don't trust that page alone; confirm directly with `select * from pg_trigger where tgname = '...'` in the SQL Editor if a trigger's existence is ever in doubt.
- **Claude Code sessions don't have visibility into `supabase db push` commands you run manually outside its own tool calls.** A fresh session may flag caution about migrations "needing to be applied" even when they're already confirmed live — check this file's §4 (Current State) for what's actually confirmed before re-verifying from scratch, and keep §4 updated after every manual push so this doesn't compound.
- `supabase db reset` fails with a socket error if Docker Desktop isn't fully started yet — wait for the whale icon to settle.
- Migration files sometimes get created and applied but NOT committed to git — run `git status` after any Supabase CLI work and confirm the new `.sql` file is committed before moving on.
- `supabase login` sessions can expire/loop on a Keychain prompt — if a CLI command throws an auth error, just re-run `supabase login`.

Project-specific watch-item (not yet encountered here, but worth checking every session given the design history — see §10):
- Confirm the AI draft-generation call still only happens from a server action, never a client-side fetch. This app's design went through a version that called the Anthropic API directly from the browser before it was corrected — if any regression reintroduces that pattern, the API key would be exposed to anyone who opens dev tools.

---

## 4. CURRENT STATE — what's done

- Prompt 1: Next.js + TypeScript scaffold, Tailwind v4 + shadcn/ui with UpScaleSupport brand tokens, Supabase client integration, Vercel deploy linked and building.
- Prompt 2: invite-only Supabase auth, `/login`, shell layout with sidebar (Talent Acquisition Desk active, Onboarding/Kickoff disabled placeholders), route protection confirmed via `getUser()`.
- Prompt 3: initial schema migration (`roles`, `candidates`, `candidate_history`, `candidate_drafts`, `org_settings`), RLS enabled on all five, confirmed applied via `supabase db push --db-url` (the `--db-url` workaround, not `supabase link`, which is still broken on this machine — see Known Gotchas).
- Follow-up migration: consolidated table grants to `authenticated` (`GRANT ... ON ALL TABLES IN SCHEMA public` + `ALTER DEFAULT PRIVILEGES` for future tables) — the initial schema migration created RLS policies but never granted table-level privileges, which blocked all writes until this was added.
- Follow-up migration: `handle_new_auth_user()` trigger on `auth.users` that auto-inserts a matching `profiles` row (defaulted to the single org) for every new user — confirmed live via direct SQL query (`pg_trigger`/`pg_proc`), not just CLI "up to date" output, since the dashboard's Triggers page was filtering it out of view under the wrong schema tab. **All three migrations (schema, grants, trigger) are confirmed applied as of 2026-09-14 — do not re-doubt this based on a fresh Claude Code session's caution alone; check `pg_trigger`/`pg_proc` directly if ever in doubt again.**
- Prompt 4: roles CRUD (create/update/delete, status field) + `/talent-acquisition/roles` page, full manual test pass confirmed working.
- Prompt 5: candidates CRUD as Server Actions only (create with optional `role_id` → defaults to `talent_pool` stage when unset, update stage/notes/tags, reassign role) — no page yet, that's Prompt 6. Includes an explicit re-check (`assertRoleIsVisible`) on any action accepting a `role_id`, since RLS on `roles` doesn't stop an out-of-org role UUID from being accepted as a foreign key — see fragile-area note in §10.
- `recruiting-desk.html` (the prototype) copied into the repo root — previously only existed on disk outside the project, which Prompt 5's session had to track down manually. Fixed so future sessions don't hit the same gap.
- One manual one-time step still needed for any pre-trigger user: the original test user was created before the profiles trigger existed, so it needed a manual `profiles` row insert. The trigger only covers users created from this point forward.

## 5. IN PROGRESS

Nothing in progress. About to run Prompt 6 (board UI) from `BUILD_BRIEF.md` §9 — this is what will make Prompt 5's candidate actions testable for the first time, since Prompt 5 was actions-only with no page.

## 6. NEXT TASK

Run Prompt 6: board UI at `/talent-acquisition/board`, built from `DESIGN_SYSTEM.md` tokens (not the prototype's manila-folder visual styling — see §8 of that doc). This is the first point where candidates CRUD from Prompt 5 becomes testable end-to-end.

## 7. OPEN DECISIONS / QUESTIONS

- Whether/when to actually deploy to Vercel — no timeline set yet.
- **RLS policy verification is incomplete.** SECURITY.md calls for testing each policy as a non-owner authenticated user before merging — not yet done, since only one test user exists so far. Do this properly once a second test user is created (Prompt 4+ territory): confirm one user genuinely cannot read/write another org's data, not just that policies exist.
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
- 2026-09-14 — Any Server Action accepting a foreign-key ID into another org-scoped table (first case: `role_id` on candidates) re-verifies visibility via the caller's own scoped `SELECT`, rather than trusting the FK constraint alone. RLS on the referenced table (`roles`) only governs direct reads/writes of that table — it doesn't stop an out-of-org UUID from being accepted as a foreign key elsewhere, since FK constraints only check existence, not policy visibility. This pattern needs to be replicated for any future action taking an org-scoped foreign key. See fragile-area note in §10.

## 9. FILE MAP

| Area | Path |
|---|---|
| DB schema / migrations | `supabase/migrations/` (schema, grants, profiles-trigger — all three confirmed applied) |
| Shell layout (sidebar) | `src/app/(shell)/layout.tsx` |
| App-level settings | `src/app/(shell)/settings/` (not yet built — Prompt 9) |
| Talent Acquisition routes | `src/app/(shell)/talent-acquisition/roles/` (built), `board/`, `candidates/[id]/` (not yet built) |
| Talent Acquisition domain logic | `src/lib/talent-acquisition/candidates-actions.ts`, `roles-actions.ts` (built); `cadence.ts`, `scripts.ts` (not yet built — Prompt 6/7) |
| AI draft-generation server action | not yet built — Prompt 8 |
| Design/logic reference (not shipped code) | `recruiting-desk.html` (prototype, now in repo root — logic reference only, not visual) |
| Design system | `docs/DESIGN_SYSTEM.md` (UpScaleSupport Brand Guide v2, translated to dev tokens) |
| Tests | None yet beyond the cadence-logic unit tests called for in `BUILD_BRIEF.md` §6 (not yet built) |

## 10. DO NOT TOUCH / FRAGILE AREAS

- **The Anthropic API call must stay server-side.** An earlier prototype iteration called the API directly from the browser; this was corrected specifically because it would expose `ANTHROPIC_API_KEY` to anyone who opened dev tools. Any future change here needs the same auth + org check described in `BUILD_BRIEF.md` §5 before it touches the API.
- **`getUser()`, never `getSession()`**, anywhere auth state is checked server-side, per `SECURITY.md` — `getSession()` trusts a locally-stored JWT without revalidating it.
- **Every table gets `org_id` and RLS enabled on creation**, even though there's only one org today — this is what makes a future second org (or the eventual client/lead-gen app) a data change instead of a security rewrite. Don't add a table that skips this.
- **The Talent Pool stage (`talent_pool`) must not get a cadence config with `touches` or `recurDays`.** No reminder pressure on parked candidates is a deliberate design choice, not an oversight — adding one back would undo the reason the pool exists.
- **`roles.job_description` is the single source of truth for a requisition's JD**, not a per-candidate field — don't reintroduce a candidate-level job description column; it was deliberately removed to avoid duplicating the same text across every candidate on one role.
- **Any Server Action with a side effect (the AI draft generator, any future third-party API call) needs its own authorization check beyond RLS** — RLS protects direct DB reads/writes, but an action calling an external API needs an explicit org/ownership check per `SECURITY.md`.
- **Any Server Action accepting a foreign-key ID into another org-scoped table must re-verify visibility itself, not trust the FK constraint.** RLS on the referenced table only governs direct access to that table — a FK constraint just checks the row exists, not whether the caller is allowed to see it. `candidates-actions.ts`'s `assertRoleIsVisible` pattern (re-running the caller's own scoped SELECT on `role_id` before accepting it) is the template to copy for any future action taking an org-scoped foreign key.
