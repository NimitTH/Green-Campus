-- Green Campus: teachers may delete activities (ruling R17, user decision 2026-10-18).
-- Replaces the admin-only DELETE policy from 0002 with staff (teacher or admin).
-- Activities that have submissions stay undeletable: the BEFORE DELETE trigger from 0004
-- (activities_prevent_delete_with_submissions) raises 23503 'activity_has_submissions'.
-- Participations and weigh codes of a deletable activity are removed with it (FK CASCADE, 0004).

drop policy if exists activities_delete on public.activities;
create policy activities_delete on public.activities
  for delete to authenticated
  using ((select public.is_staff()));
