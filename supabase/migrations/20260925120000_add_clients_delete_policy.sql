-- clients never got a delete policy (20260923100000 deliberately deferred
-- it, same reasoning as roles originally), but deleteClientRecord()
-- (clients-actions.ts) has shipped since and the Clients page has a working
-- Delete button. Without this, `.delete()` isn't rejected — RLS with no
-- matching policy just deletes 0 rows and returns no error — so the app
-- reports success and closes the confirm dialog while the row silently
-- stays. Regression testing caught this: deleting a client with no linked
-- roles appeared to succeed but the record was still there after reload.
create policy "clients: delete within org" on clients
  for delete
  using (org_id = public.current_org_id());
