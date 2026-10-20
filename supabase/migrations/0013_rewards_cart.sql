-- Green Campus: rewards images and cart tightening (Task 12, R64, R66; spec 8.1).
--
-- * Cart writes: only students write their own rows, and (insert/update) only for an active
--   reward. Staff keep SELECT on every cart but cannot write one. Deleting a line stays allowed
--   for an inactive reward so a student can clear it.
-- * Bucket 'reward-images': public read (public bucket), 2 MB, jpeg/png/webp. Staff manage objects.

drop policy cart_items_insert_own on public.cart_items;
drop policy cart_items_update_own on public.cart_items;
drop policy cart_items_delete_own on public.cart_items;

create policy cart_items_insert_own on public.cart_items
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and not (select public.is_staff())
    and exists (select 1 from public.rewards r where r.id = reward_id and r.active)
  );
create policy cart_items_update_own on public.cart_items
  for update to authenticated
  using (student_id = (select auth.uid()) and not (select public.is_staff()))
  with check (
    student_id = (select auth.uid())
    and not (select public.is_staff())
    and exists (select 1 from public.rewards r where r.id = reward_id and r.active)
  );
create policy cart_items_delete_own on public.cart_items
  for delete to authenticated
  using (student_id = (select auth.uid()) and not (select public.is_staff()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reward-images', 'reward-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public read comes from the public bucket. Authenticated clients also get a SELECT policy so
-- staff upload(upsert)/list calls and the update/delete policies below can see the rows.
create policy reward_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'reward-images');
create policy reward_images_insert_staff on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reward-images' and (select public.is_staff()));
create policy reward_images_update_staff on storage.objects
  for update to authenticated
  using (bucket_id = 'reward-images' and (select public.is_staff()))
  with check (bucket_id = 'reward-images' and (select public.is_staff()));
create policy reward_images_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'reward-images' and (select public.is_staff()));
