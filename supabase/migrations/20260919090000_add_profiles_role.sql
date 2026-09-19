-- Step 1 of 4 toward an admin page + candidate-assignment feature
-- (PROJECT_STATE.md §6): schema and helpers only, no admin UI yet. This is
-- a genuine security-model shift, not just a feature add — until now,
-- every authorization check in this app has been org-membership-only
-- (RLS's `org_id = current_org_id()`). This introduces the app's first
-- role-based (admin vs. member) authorization concept.
alter table profiles
  add column role text not null default 'member'
    check (role in ('admin', 'member'));

-- No new grant is needed for this: `profiles` is an existing table already
-- covered by the blanket `grant ... on all tables in schema public` in
-- 20260914060451_fix_grants_and_roles_delete_policy.sql. Postgres
-- table-level grants apply to all of a table's columns, including ones
-- added after the grant — only genuinely new tables need
-- `alter default privileges` to pick up a grant automatically.

-- Close a privilege-escalation gap the new column opens up: the existing
-- "profiles: update own row" RLS policy (`using (id = auth.uid())`) has no
-- column-level restriction, so as written, any authenticated user could
-- call the Supabase REST API directly (bypassing this app's own Server
-- Actions entirely, which never expose a raw arbitrary-column update) and
-- PATCH their own `role` to 'admin'. RLS policies can't express
-- column-level checks, so this is enforced with a BEFORE UPDATE trigger
-- instead: changing `role` is blocked unless the acting user is already an
-- admin.
--
-- `auth.uid()` is NULL outside a PostgREST-authenticated request (e.g. a
-- direct SQL Editor session, or a service-role script) — the trigger
-- deliberately allows the change through in that case. This is what makes
-- the manual first-admin bootstrap possible (there is no admin UI yet to
-- do this any other way): run, as the project owner in the Supabase SQL
-- Editor,
--   update profiles set role = 'admin' where id = '<your user id>';
-- A request going through the app as a real signed-in user always has
-- auth.uid() populated, so this carve-out doesn't weaken the check against
-- the actual attack vector (an authenticated non-admin hitting the REST
-- API directly).
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    ) then
      raise exception 'Only admins can change a profile''s role';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_role_escalation
  before update on profiles
  for each row
  execute function public.prevent_self_role_escalation();
