-- Part of step 1 of 4 toward an admin page + candidate-assignment feature
-- (PROJECT_STATE.md §6, alongside 20260919090000_add_profiles_role.sql):
-- schema only, no reassignment UI/Server Action yet. Tracks which user a
-- candidate is currently owned by, nullable (unassigned is a valid,
-- expected state — nothing back-fills this).
alter table candidates
  add column assigned_to uuid references profiles(id);

create index candidates_assigned_to_idx on candidates (assigned_to);

-- No new grant needed — same reasoning as the profiles.role migration:
-- `candidates` is an existing table already covered by the blanket grant
-- in 20260914060451_fix_grants_and_roles_delete_policy.sql, and
-- table-level grants cover columns added later automatically.

-- No RLS change here: the existing "candidates: update within org" policy
-- already allows any org member to write this column, same as every other
-- candidates column — there is no future admin-only reassignment Server
-- Action yet to scope. When that action is built (a later step of this
-- 4-step feature), it must re-verify the target assignee is a real,
-- visible-to-the-caller profile before accepting an id for this column,
-- the same way `candidates-actions.ts`'s `assertRoleIsVisible` pattern
-- does for `role_id` — a FK constraint only checks the row exists, not
-- that RLS would let the caller see it (PROJECT_STATE.md §10).
