-- Building admin-triggered user deletion surfaced a real schema gap: every
-- FK from public tables to profiles(id) (and profiles.id itself, to
-- auth.users(id)) was declared with no ON DELETE behavior, which defaults
-- to NO ACTION (RESTRICT) — Postgres blocks the delete outright rather
-- than cascading or nulling. Two different columns need two different
-- fixes, not the same one everywhere:
--
-- 1. profiles.id -> auth.users(id): must cascade. admin.auth.admin.
--    deleteUser() deletes the auth.users row; if a matching profiles row
--    still exists, Postgres rejects it with a foreign-key violation
--    regardless of which API issued the delete (GoTrue's admin API, the
--    Supabase dashboard's own "Delete user" button, anything) — the
--    constraint is enforced at the database level, not per-caller. This
--    also makes deleteUser() in admin-actions.ts's own explicit
--    "delete profiles row, then delete the auth user" step redundant
--    once applied, but that app-level step stays as defense in depth
--    (see the comment in admin-actions.ts) rather than being removed,
--    since this migration cannot be guaranteed applied before that code
--    ships.
--
-- 2. roles.created_by / candidates.created_by / candidate_history.created_by
--    / candidate_drafts.generated_by -> profiles(id): set null, not
--    cascade or restrict. These are historical attribution columns ("who
--    made this"), not live state — losing the specific attribution when
--    the creator's account is later deleted is an acceptable, honest
--    outcome (the record itself must survive; deleting a user should
--    never delete other people's roles/candidates/history as a side
--    effect). Explicitly NOT touching candidates.assigned_to here — that
--    column represents a *live* responsibility assignment, not a
--    historical record, and deleteUser()'s own application-level check
--    blocks deletion outright while a user still has candidates assigned
--    to them (see admin-actions.ts) rather than silently clearing the
--    assignment. Leaving assigned_to's FK as the default NO ACTION is
--    intentional, not an oversight — it's a second, database-level
--    backstop behind that application check, not a gap to close.
alter table profiles
  drop constraint profiles_id_fkey,
  add constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;

alter table roles
  drop constraint roles_created_by_fkey,
  add constraint roles_created_by_fkey
    foreign key (created_by) references profiles(id) on delete set null;

alter table candidates
  drop constraint candidates_created_by_fkey,
  add constraint candidates_created_by_fkey
    foreign key (created_by) references profiles(id) on delete set null;

alter table candidate_history
  drop constraint candidate_history_created_by_fkey,
  add constraint candidate_history_created_by_fkey
    foreign key (created_by) references profiles(id) on delete set null;

alter table candidate_drafts
  drop constraint candidate_drafts_generated_by_fkey,
  add constraint candidate_drafts_generated_by_fkey
    foreign key (generated_by) references profiles(id) on delete set null;

-- No new grant needed: same reasoning as every prior additive migration —
-- profiles/roles/candidates/candidate_history/candidate_drafts are all
-- already covered by the blanket `grant ... on all tables in schema
-- public` in 20260914060451_fix_grants_and_roles_delete_policy.sql, and
-- service_role (the only role deleteUser()'s admin-client.ts uses)
-- bypasses RLS entirely regardless of policy — no new RLS policy needed
-- for the profiles delete either.
