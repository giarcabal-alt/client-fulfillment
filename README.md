# Client Fulfillment App

Internal tool for **UpScaleSupport** to run talent acquisition end-to-end — sourcing, pipeline tracking, AI-assisted outreach, and a searchable talent bench — for the AI-fluent operators UpScaleSupport embeds with clients.

**Talent Acquisition Desk** is the first module of a broader Client Fulfillment App. Onboarding and Kickoff modules are planned as future additions on the same sidebar shell.

Once logged in, see the in-app **How to Use** page for a full feature walkthrough — this README covers setup and architecture, not day-to-day usage.

---

## Tech stack

- **Next.js** (App Router) + TypeScript, hosted on **Vercel**
- **Tailwind CSS v4** (CSS-first `@theme` config) + **shadcn/ui**
- **Supabase** — Postgres, Auth, Row Level Security, Storage
- **Anthropic API** — server-side only, for AI-drafted outreach messages and resume/job description parsing

## Features

- **Board** — seven-stage candidate pipeline (including a no-pressure Talent Pool stage) with cadence-based reminders
- **Job Openings** — client-linked requisitions with compensation, seniority, work arrangement, timezone overlap, and AI-assisted skill extraction from the job description
- **Candidates** — manual entry or resume upload (PDF/DOCX) with AI autofill, skill matching against role requirements, interview scorecards, and AI-generated outreach drafts
- **Talent Bench** — every candidate regardless of stage or status, filterable
- **Clients** — client records with point-of-contact info and a live PH ↔ client timezone display
- **Metrics** — time-in-stage and decline-reason reporting
- **Admin** — invite-only user management (roles, password reset, deactivation), gated to admin accounts

## Getting started

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in real values:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page (anon/publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (service_role/secret key — server-only, never expose) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `ANTHROPIC_WORKSPACE_ID` | console.anthropic.com → Settings → Workspaces (only needed if your key isn't already scoped to one workspace) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; your Vercel URL in production |

```bash
npm run dev
```

## Database

All schema changes are Supabase migrations in `supabase/migrations/` — never applied by hand or via the dashboard SQL editor directly.

```bash
supabase db push --db-url 'your-connection-string'
```

> **Known issue on some machines:** `supabase link` can fail with a platform-side auth error unrelated to your actual permissions. The `--db-url` flag above (using the pooler connection string from the dashboard's Connect button, not the direct `db.xxxx.supabase.co` one) works around it reliably. See `docs/PROJECT_STATE.md` for the full gotcha list.

## Testing

```bash
npx vitest run
```

## Project documentation

Read these before making changes, in this order:

- **`CODING_STANDARDS.md`** — structure, naming, dependency approval process
- **`SECURITY.md`** — auth patterns, RLS rules, non-negotiables
- **`DESIGN_SYSTEM.md`** — UpScaleSupport brand tokens and UI conventions
- **`BUILD_BRIEF.md`** / **`ATS_FEATURES.md`** — the original build plans (historical reference — both are fully implemented)
- **`docs/PROJECT_STATE.md`** — current state, known gotchas, fragile areas, and architecture decisions with reasoning. Read this first in any new session.
- **`docs/CHANGELOG.md`** — dated log of what shipped

## Deployment

Auto-deploys to Vercel on push to `main`. Environment variables must be set separately in the Vercel dashboard (Settings → Environment Variables) for Production and Preview — `.env.local` only affects local development.
