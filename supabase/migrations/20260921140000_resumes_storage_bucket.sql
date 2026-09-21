-- ATS_FEATURES.md Step 2: a private "resumes" Storage bucket with
-- org-scoped RLS on storage.objects. Upload/storage/retrieval only — no
-- parsing (Step 3).
--
-- Path convention every policy below assumes: <org_id>/<candidate_id>/
-- <random-uuid><ext>, written by the app's own upload action
-- (src/lib/talent-acquisition/resume-actions.ts). The org_id leading
-- segment is what scopes access; the random filename (not the original,
-- possibly PII-bearing, user-supplied filename) avoids collisions and
-- keeps the object name itself free of anything worth protecting on its
-- own.
--
-- storage.objects already has RLS enabled by Supabase's own bootstrap —
-- deliberately NOT re-stated here with `alter table storage.objects
-- enable row level security`. That table is owned by
-- `supabase_storage_admin`, not the role migrations run as; attempting to
-- alter it here would either no-op or error depending on the exact
-- privilege grant on this project, and it's unnecessary regardless since
-- Supabase always ships it pre-enabled. Only policies are added below.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760, -- 10MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- The UUID-cast guard: a prior project's fragile-areas notes flag this
-- exact bug class. `(storage.foldername(name))[1]::uuid = ...` looks
-- correct, but if ANY object in the bucket ever has a first path segment
-- that isn't valid UUID text — a stray upload from a bug elsewhere, a
-- manually-created test object, anything — evaluating that cast throws a
-- hard Postgres error (`invalid input syntax for type uuid`), not just
-- "false." Because RLS policies for the same command are OR'd together
-- and Postgres must evaluate all of them to build the combined
-- USING/WITH CHECK expression, one throwing policy can abort the entire
-- query — silently blocking access this and every *other* policy on this
-- table would otherwise have correctly granted, not just to the
-- offending row. The fix: match the segment against a UUID-shaped regex
-- with `~` (a safe boolean comparison, never throws) *before* ever
-- casting it, and short-circuit to false via `and` if it doesn't match —
-- so a malformed path segment fails the policy cleanly instead of
-- erroring the whole statement.
create policy "resumes: select within org" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(name))[1]::uuid = public.current_org_id()
  );

create policy "resumes: insert within org" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (storage.foldername(name))[1]::uuid = public.current_org_id()
  );

-- No update/delete policy yet — this step is upload/storage/retrieval
-- only (ATS_FEATURES.md Step 2's own scope). A "replace" in the app is
-- implemented as a fresh insert under a new random path plus updating
-- candidates.resume_path to point at it, not an in-place object update,
-- so no update policy is needed for that flow; the old object is simply
-- left orphaned in storage for now (no cleanup step exists yet — a real,
-- known gap, not an oversight, flagged in docs/PROJECT_STATE.md).

-- Grants: storage policies are the actual access boundary here, not
-- table-level GRANTs — `storage.objects`/`storage.buckets` are owned and
-- pre-granted by Supabase's own storage bootstrap (the `storage` schema
-- isn't `public`, so the existing `ALTER DEFAULT PRIVILEGES IN SCHEMA
-- public` migration was never going to reach it regardless of table vs.
-- new-table nuance). Confirmed by checking what that migration actually
-- says (`IN SCHEMA public`, explicitly) rather than assuming Storage
-- works the same way Postgres table grants do. No grants migration
-- needed for this feature.
