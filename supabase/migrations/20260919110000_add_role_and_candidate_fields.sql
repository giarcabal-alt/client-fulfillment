-- Four new fields, unrelated to the admin/assignment feature: two on
-- roles (client-facing requisition detail), two on candidates (sourcing
-- + screening detail). No RLS/grant changes needed — see note at bottom.

alter table roles
  add column timezone_overlap text,
  add column classification text
    check (classification in ('embedded_operator', 'project_based'));

alter table candidates
  add column source_platform text,
  add column communication_rating int
    check (communication_rating between 1 and 5);

-- No new grant needed: `roles` and `candidates` are existing tables
-- already covered by the blanket grant in
-- 20260914060451_fix_grants_and_roles_delete_policy.sql
-- (`GRANT ... ON ALL TABLES IN SCHEMA public`), and a table-level grant
-- covers columns added to that table later automatically — same
-- reasoning as the assigned_to/role migrations before this one.

-- No RLS change needed either: all four columns are read/written through
-- the same existing "roles: update within org" / "candidates: update
-- within org" policies every other column on these tables already goes
-- through — nothing about these columns needs a different visibility or
-- write rule than the rest of the row.
