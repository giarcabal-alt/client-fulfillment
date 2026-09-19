# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are UpScaleSupport's own internal recruiters/ops staff — currently a single operator, growing to a small in-house team (`profiles.role`: `admin`/`member`). They use the app daily to source, track, and move candidates through a pipeline toward becoming embedded, AI-fluent operators placed with clients.

A second, not-yet-built audience is plausible but not committed: a future client-facing view (e.g. a client seeing their own pipeline/placements). Nothing in the current app is built for that audience yet — do not assume client-facing polish or copy on existing internal surfaces without a separate decision to build that module.

## Product Purpose

Client Fulfillment App is the internal tool UpScaleSupport uses to run its own delivery pipeline end-to-end. The first (and so far only) module, Talent Acquisition Desk, replaces ad hoc spreadsheets/notes with a real candidate pipeline: sourcing, cadence-based follow-up reminders, a talent pool for candidates not tied to an active role, and role/requisition tracking. Success is recruiters actually working out of this tool instead of falling back to spreadsheets, and candidates not going stale between touches.

Future modules (Onboarding, Kickoff) are planned to hang off the same shell once an operator is placed, but are explicitly not built yet — shown only as disabled "Coming soon" sidebar placeholders.

## Positioning

UpScaleSupport's differentiator, which this app's tone and workflows should reflect rather than undercut: it doesn't just match resumes to job posts. It curates and trains AI-fluent operators, then embeds them into client teams backed by an engineering bench — closer to staffing a capability than filling a req. The app's cadence/reminder system and talent-pool concept exist because that curation-and-readiness process, not a one-shot placement, is the actual product. A generic ATS could copy the pipeline UI; it could not copy the bench behind it.

Brand line: **"AI becomes someone's job."**

## Operating Context

- Recruiters work primarily from the board (`/talent-acquisition/board`) — a 7-column kanban (Talent Pool + six active pipeline stages) — and the per-candidate detail page for anything beyond a stage move.
- Candidates move through cadence-based reminders (touch index, next-action due dates) rather than a rigid SLA; the Talent Pool stage is a deliberate no-pressure resting state, not a missed one.
- Roles (open requisitions) are tracked separately from candidates, each with a job description, status (open/filled/closed), required timezone overlap, and a classification (`embedded_operator` vs `project_based`) — reflecting that UpScaleSupport staffs both ongoing embedded roles and discrete project engagements.
- Admins can invite teammates, assign roles (admin/member), and assign candidates to a specific recruiter; regular members work within their org but can't manage other users.
- Single hardcoded org today; the schema is already org-scoped (`org_id` on every table, RLS-enforced) so a second org is a data change later, not a security rewrite.
- Settings (`/settings`) are app-level, not nested under a module, since they're meant to apply across future modules too.

## Capabilities and Constraints

- Next.js (App Router) + TypeScript, Tailwind CSS v4 (CSS-first `@theme`, no `tailwind.config.js`) + shadcn/ui, Supabase (Postgres/Auth/RLS), hosted on Vercel.
- Invite-only auth — no public signup; accounts are created via the admin invite flow or directly in the Supabase dashboard.
- AI-drafted outreach messages are planned (single-shot, server-side only, per-org daily rate cap) but **not yet built** — deliberately deferred until `ANTHROPIC_API_KEY` is confirmed available; do not assume this feature exists yet.
- No dark mode, ever — `warm-paper` background is fixed regardless of OS/browser theme preference. This is a deliberate brand constraint, not an oversight to "fix."
- No mobile app / native platform — mobile web (responsive down to ~375px) is the only mobile support, and is already built across the shell and every existing page.
- Every Server Action re-derives the caller via `getUser()` (never `getSession()`) and checks org/role authorization explicitly in application code — RLS is not treated as the sole authorization boundary for actions with side effects or role requirements.

## Brand Commitments

- Name: **UpScaleSupport**; this internal tool is the **Client Fulfillment App**, with **Talent Acquisition Desk** as its first module.
- Wordmark: digital lowercase "us." monogram + "upscalesupport" lockup (currently a text-based stand-in in `src/components/shell/wordmark.tsx` — no real logo asset in the repo yet; swap when one is provided).
- Source of visual truth: `DESIGN_SYSTEM.md` (translated from the UpScaleSupport Brand Guide v2, locked 2026-07-23) — colors (`ink-navy`, `work-blue`, `sun-gold` used sparingly, `warm-paper`, `stone`, `slate-text`, `growth-green`), Bricolage Grotesque display / Inter body type, 12px card radius, `stone` borders.
- Tone: accountable, warm, working — never "AI product" flashy. The brand guide's own gut-check: **if a UI choice would fit on a crypto site, it's wrong** — no gradients, no neon, no glassmorphism.

## Evidence on Hand

None. This is an internal operations tool with no public-facing marketing surface — no testimonials, case studies, press, or customer-facing copy exist or are needed for the pages built so far. Do not fabricate any.

## Product Principles

1. **The pipeline is the product** — cadence/reminders and the talent pool exist to keep candidates from going stale between touches, not to gamify recruiting busywork. Any new feature should serve that, not compete with it for attention.
2. **Internal tool, not a showcase** — built for the person using it daily to work fast, not to impress an external visitor. Favor clarity and speed over persuasive/marketing polish anywhere in this app.
3. **Authorization is explicit, never assumed from RLS alone** — every Server Action with a side effect or role requirement checks it in code. This is a standing security posture, not a per-feature decision.
4. **Single org today, multi-org-shaped schema always** — don't build features that would need a schema rewrite to support a second org later, even though only one exists now.
5. **No visual flash for its own sake** — the brand's "never AI product flashy" rule applies to every surface in this app, including future ones, not just the ones built so far.

## Accessibility & Inclusion

No formal accessibility standard is required at this time — small, known internal user base, no compliance target set.
