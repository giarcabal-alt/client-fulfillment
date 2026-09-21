-- ATS_FEATURES.md Step 3: pg_trgm-backed fuzzy-match lookups used by the
-- resume parsing Server Action's normalization pipeline (alias exact
-- match first, this second — see skill-location-normalize.ts). Table-only
-- grants (ALTER DEFAULT PRIVILEGES, 20260914060451) don't cover
-- functions: Postgres grants EXECUTE on a new function to PUBLIC by
-- default, so `authenticated` would technically already be able to call
-- these without any grant here — but relying on that implicit PUBLIC
-- grant is fragile (it silently also covers `anon`, which this app never
-- grants anything to per SECURITY.md) and undocumented if it ever
-- changes. Both functions explicitly revoke from PUBLIC and grant only to
-- authenticated/service_role below, so this is a real, checked answer to
-- "does Step 3 need new grants" — not an assumption.
--
-- `security invoker` (the default, stated explicitly for clarity) means
-- these run with the calling user's own privileges, so the `skills`/
-- `locations` RLS org-scoping still applies underneath — the org filter
-- passed in as `p_org_id` is a query-shaping convenience, not the only
-- thing standing between orgs.

create or replace function public.match_skill(p_org_id uuid, p_text text)
returns table(skill_id uuid, similarity real)
language sql
stable
security invoker
as $$
  select id, similarity(name, p_text) as similarity
  from public.skills
  where org_id = p_org_id
  order by similarity(name, p_text) desc
  limit 1
$$;

create or replace function public.match_location(p_org_id uuid, p_text text)
returns table(location_id uuid, similarity real)
language sql
stable
security invoker
as $$
  select id, similarity(city, p_text) as similarity
  from public.locations
  where org_id = p_org_id
  order by similarity(city, p_text) desc
  limit 1
$$;

revoke execute on function public.match_skill(uuid, text) from public;
revoke execute on function public.match_location(uuid, text) from public;

grant execute on function public.match_skill(uuid, text) to authenticated, service_role;
grant execute on function public.match_location(uuid, text) to authenticated, service_role;
