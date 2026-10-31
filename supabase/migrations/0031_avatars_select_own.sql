-- Review fix M1 (DESIGN-3 7.1): 0027's avatars_select let any signed-in user list every avatar path (user ids).
-- The bucket is public, so image URLs need no select policy; the owner still lists and removes their own objects.
drop policy avatars_select on storage.objects;
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
