# Changelog

## [Unreleased]
### Added
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
