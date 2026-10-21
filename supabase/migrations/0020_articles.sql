-- Green Campus: articles (Task 18 Part B, R122; spec 8.1, 9.1, 9.3). Builds on 0001 (table) and 0002
-- (RLS: anon/authenticated read published, staff read all and create/edit, admin deletes).
--
-- * Body is plain text (rendered as text with paragraphs split on blank lines; no HTML/markdown).
-- * Checks: slug ^[a-z0-9]+(-[a-z0-9]+)*$ and <= 80 (the app generates 'a-' + 8 base36 when left
--   blank); title 1-200 characters after trimming all whitespace; body <= 20000; cover_path is null or
--   {article id}/{uuid}.jpg (what the staff form uploads). Existing rows are repaired first.
-- * anon gets no write privilege on articles (RLS already denies it; defence in depth).
-- * Bucket 'article-images': public read (public bucket), 2 MB, jpeg/png/webp; staff manage objects
--   (mirrors reward-images, 0013). Orphaned objects (a replaced cover whose delete failed, an upload
--   whose save never happened) are left for the Task 19 cleanup, like reward-images.

-- existing rows ------------------------------------------------------------------------------------
update public.articles
set slug = 'a-' || substr(md5(id::text), 1, 8)
where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(slug) > 80;
update public.articles set title = 'ไม่มีชื่อ' where regexp_replace(title, '^\s+|\s+$', '', 'g') = '';
update public.articles set title = left(title, 200) where char_length(title) > 200;
update public.articles set body = left(body, 20000) where char_length(body) > 20000;
update public.articles
set cover_path = null
where cover_path is not null
  and cover_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$';

alter table public.articles
  add constraint articles_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  add constraint articles_title_length
    check (char_length(regexp_replace(title, '^\s+|\s+$', '', 'g')) between 1 and 200),
  add constraint articles_body_length
    check (char_length(body) <= 20000),
  add constraint articles_cover_path_format
    check (cover_path is null or cover_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$');

revoke insert, update, delete on public.articles from anon;

-- article-images bucket -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-images', 'article-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public read comes from the public bucket. Authenticated clients also get a SELECT policy so staff
-- upload / remove calls and the update/delete policies below can see the rows.
create policy article_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'article-images');
create policy article_images_insert_staff on storage.objects
  for insert to authenticated
  with check (bucket_id = 'article-images' and (select public.is_staff()));
create policy article_images_update_staff on storage.objects
  for update to authenticated
  using (bucket_id = 'article-images' and (select public.is_staff()))
  with check (bucket_id = 'article-images' and (select public.is_staff()));
create policy article_images_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'article-images' and (select public.is_staff()));
