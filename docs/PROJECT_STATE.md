# Client Fulfillment App — Project State & Handover

_Last updated: 2026-09-11 by Claude Code (Prompt 1 — scaffold)_

---

## 1. One-line project summary
Internal tool for UpScaleSupport to run talent acquisition end-to-end: candidate sourcing, pipeline tracking with cadence-based reminders, AI-drafted outreach messages, and a searchable talent pool — for sourcing the AI-fluent operators UpScaleSupport embeds with clients. First module of a larger Client Fulfillment App (Onboarding and Kickoff modules planned later, not yet built).

## 2. Tech stack
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS v4 (CSS-first `@theme` config, no `tailwind.config.js`) + shadcn/ui
- Design: UpScaleSupport Brand Guide v2 (locked 2026-07-23), documented in `docs/DESIGN_SYSTEM.md`
- Backend/API: Next.js Server Actions (no separate API layer)
- DB: Supabase Postgres — project not yet created
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

Project-specific watch-item (not yet encountered here, but worth checking every session given the design history — see §10):
- Confirm the AI draft-generation call still only happens from a server action, never a client-side fetch. This app's design went through a version that called the Anthropic API directly from the browser before it was corrected — if any regression reintroduces that pattern, the API key would be exposed to anyone who opens dev tools.

---

## 4. CURRENT STATE — what's done

Prompt 1 (scaffold) from `BUILD_BRIEF.md` §9 is complete:
- Next.js (App Router, TypeScript) scaffolded at the repo root, npm as the package manager, `.nvmrc` pinned to 20 (matches the installed local toolchain).
- Tailwind CSS v4 set up CSS-first — brand tokens, fonts, and shadcn's semantic tokens all live in `src/app/globals.css`'s `@theme` blocks, no `tailwind.config.js`. No dark mode (design system is light-only by design).
- shadcn/ui initialized (`components.json`, `new-york`-equivalent `base-nova` style, Base UI primitives) with `button`, `card`, `badge`, `separator`, `input`, `label` installed so far. `Card` was edited to use a real `border-border` (stone) instead of the default ring, per `DESIGN_SYSTEM.md` §4.
- `@supabase/ssr` wired up: `src/lib/supabase/client.ts` (browser), `server.ts` (Server Components/Actions, cookie-based), `middleware.ts` (session-refresh helper used by `src/proxy.ts` — Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`), and `service.ts` (service-role client, server-only by convention). Every auth check must use `getUser()`, never `getSession()`, per `SECURITY.md` — none of the scaffolded code calls `getSession()`.
- `src/lib/config.ts` centralizes all env var reads (`CODING_STANDARDS.md` §3).
- `.env.example` documents `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.
- Deployed to Vercel (project `client-fulfillment`, already linked via `.vercel/`) and confirmed the build and the live page both work — see §8 for the framework-preset gotcha this surfaced. Placeholder Supabase env vars are set on Vercel (all environments) and in `.env.local` so the proxy's session-refresh call doesn't throw before a real Supabase project exists.
- A working prototype exists (`recruiting-desk.html`) — a single-file HTML/JS mockup of the board, roles, talent pool, and AI-draft-generation UX. It's a design and logic reference only; **no data in it migrates anywhere**.
- Local dev environment (VS Code, Claude Code extension, Node, git, Supabase CLI, Vercel CLI) is set up.

## 5. IN PROGRESS

Nothing in progress.

## 6. NEXT TASK

Run Prompt 2 (`BUILD_BRIEF.md` §9): invite-only Supabase email/password auth, `/login` page, and the shell layout with sidebar nav.

## 7. OPEN DECISIONS / QUESTIONS

- A real Supabase project still needs to be created — `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are placeholder values everywhere (local `.env.local` and all three Vercel environments) until then.
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

## 9. FILE MAP

Built so far (Prompt 1); rows still marked "not yet built" are the planned layout from `BUILD_BRIEF.md`.

| Area | Path |
|---|---|
| Brand tokens, fonts, shadcn theme | `src/app/globals.css` |
| Fonts loaded (next/font) | `src/app/layout.tsx` |
| shadcn config | `components.json` |
| shadcn primitives | `src/components/ui/` (button, card, badge, separator, input, label) |
| Supabase browser client | `src/lib/supabase/client.ts` |
| Supabase server client (cookie-based, `getUser()`) | `src/lib/supabase/server.ts` |
| Supabase session-refresh helper | `src/lib/supabase/middleware.ts` (used by `src/proxy.ts`) |
| Supabase service-role client | `src/lib/supabase/service.ts` |
| Centralized env var access | `src/lib/config.ts` |
| Env var placeholders | `.env.example` |
| DB schema / migrations | `supabase/migrations/` — not yet built |
| Shell layout (sidebar) | `src/app/(shell)/layout.tsx` — not yet built |
| App-level settings | `src/app/(shell)/settings/` — not yet built |
| Talent Acquisition routes | `src/app/(shell)/talent-acquisition/board/`, `roles/`, `candidates/[id]/` — not yet built |
| Talent Acquisition domain logic | `src/lib/talent-acquisition/cadence.ts`, `scripts.ts` — not yet built |
| AI draft-generation server action | wherever `generateSuggestedMessage()` lands per `BUILD_BRIEF.md` §5 — not yet built |
| Design/logic reference (not shipped code) | `recruiting-desk.html` (prototype — logic reference only, not visual) |
| Design system | `DESIGN_SYSTEM.md` (UpScaleSupport Brand Guide v2, translated to dev tokens) |
| Tests | None planned yet beyond the cadence-logic unit tests called for in `BUILD_BRIEF.md` §6 |

## 10. DO NOT TOUCH / FRAGILE AREAS

- **The Anthropic API call must stay server-side.** An earlier prototype iteration called the API directly from the browser; this was corrected specifically because it would expose `ANTHROPIC_API_KEY` to anyone who opened dev tools. Any future change here needs the same auth + org check described in `BUILD_BRIEF.md` §5 before it touches the API.
- **`getUser()`, never `getSession()`**, anywhere auth state is checked server-side, per `SECURITY.md` — `getSession()` trusts a locally-stored JWT without revalidating it.
- **Every table gets `org_id` and RLS enabled on creation**, even though there's only one org today — this is what makes a future second org (or the eventual client/lead-gen app) a data change instead of a security rewrite. Don't add a table that skips this.
- **The Talent Pool stage (`talent_pool`) must not get a cadence config with `touches` or `recurDays`.** No reminder pressure on parked candidates is a deliberate design choice, not an oversight — adding one back would undo the reason the pool exists.
- **`roles.job_description` is the single source of truth for a requisition's JD**, not a per-candidate field — don't reintroduce a candidate-level job description column; it was deliberately removed to avoid duplicating the same text across every candidate on one role.
- **Any Server Action with a side effect (the AI draft generator, any future third-party API call) needs its own authorization check beyond RLS** — RLS protects direct DB reads/writes, but an action calling an external API needs an explicit org/ownership check per `SECURITY.md`.
