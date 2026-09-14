-- One-way sync: every new auth.users row gets a matching public.profiles
-- row, defaulted to the single hardcoded org. Same pattern used on the 3PL
-- project. Without this, a user created directly in the Supabase dashboard
-- (this app's invite-only signup path — see SECURITY.md / BUILD_BRIEF.md §2)
-- has no profiles row, so every RLS policy that checks org_id via
-- public.current_org_id() (which reads from profiles) rejects them — not
-- because the policy is wrong, but because there's nothing to look up.
--
-- security definer + set search_path: this runs as a trigger on auth.users,
-- a schema the invoking role doesn't have insert rights into public.profiles
-- from; security definer lets it write as the function's owner regardless
-- of who/what triggered it, and pinning search_path avoids the same
-- search-path-hijacking risk called out on current_org_id() in the initial
-- schema migration.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, org_id)
  values (new.id, '00000000-0000-0000-0000-000000000001')
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
