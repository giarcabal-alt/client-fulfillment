-- Talent Bench view: six new optional candidate fields, surfaced on both
-- the candidate detail page (editable) and the new /talent-acquisition/
-- talent-bench card grid (read-only, for filtering/scanning). All nullable
-- — none of this is required to create or manage a candidate today, this
-- is enrichment data captured as it becomes available.

alter table candidates add column years_experience numeric;
alter table candidates add column last_role text;
alter table candidates add column last_company text;
alter table candidates add column employment_status text
  check (employment_status in ('employed', 'open_to_opportunities', 'immediately_available', 'freelance_contract'));
alter table candidates add column notice_period text
  check (notice_period in ('immediate', '2_weeks', '1_month', '2_plus_months'));
-- expected_compensation is deliberately free text, not a structured
-- number — compensation discussed here spans PHP/USD and monthly/annual
-- framing, and forcing a single numeric column would either lose that
-- framing or require a much larger structured-money schema this feature
-- doesn't need yet.
alter table candidates add column expected_compensation text;

-- Grants: none needed. This adds columns to the existing `candidates`
-- table, not a new table — RLS policies and `ALTER DEFAULT PRIVILEGES`
-- grants apply at the table level, not per-column, and `candidates`
-- already has full select/insert/update coverage for `authenticated`/
-- `service_role` from the initial schema + grants-fix migrations. No new
-- policy is needed either: the existing "candidates: update within org"
-- policy (`org_id = current_org_id()`) already covers writes to any
-- column on the row, these six included.
