-- Redesign 3 (DESIGN-3 7.2): activity cover image and long-form details, plus the activity-images bucket.
-- activities has no column-level grants (writes are governed by RLS), so no extra grants are needed.

alter table public.activities
  add column cover_path text,
  add column details text;
alter table public.activities
  add constraint activities_details_length
    check (details is null or char_length(details) <= 20000),
  add constraint activities_cover_path_format
    check (cover_path is null or (
      cover_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
      and split_part(cover_path, '/', 1) = id::text));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-images', 'activity-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy activity_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'activity-images');
create policy activity_images_insert_staff on storage.objects
  for insert to authenticated
  with check (bucket_id = 'activity-images' and (select public.is_staff()));
create policy activity_images_update_staff on storage.objects
  for update to authenticated
  using (bucket_id = 'activity-images' and (select public.is_staff()))
  with check (bucket_id = 'activity-images' and (select public.is_staff()));
create policy activity_images_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'activity-images' and (select public.is_staff()));
