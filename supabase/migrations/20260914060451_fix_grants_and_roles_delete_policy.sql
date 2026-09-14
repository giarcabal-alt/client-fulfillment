-- Fix: the tables created in 20260914053122_initial_schema.sql have RLS
-- policies but no table-level GRANTs to the `anon`/`authenticated`/
-- `service_role` Postgres roles PostgREST uses. Without a GRANT, every
-- request fails with "permission denied for table X" (Postgres error
-- 42501) before RLS is even evaluated — confirmed against the real project
-- via direct REST calls with both the anon and service-role keys. Supabase
-- normally sets this up automatically for objects created as the `postgres`
-- role; this restates it explicitly so it doesn't depend on how a given
-- migration gets run.
--
-- `anon` is deliberately not granted anything — this app has no
-- unauthenticated data access; every real query runs as `authenticated`
-- once a user is signed in (SECURITY.md).
grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

-- Roles now need a delete policy too (this task adds role deletion as a
-- Server Action) — the original migration only covered select/insert/update
-- per BUILD_BRIEF.md §4's policy shape, which didn't call for delete on any
-- table yet.
create policy "roles: delete within org" on roles
  for delete
  using (org_id = public.current_org_id());
