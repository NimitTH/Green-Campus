-- Redesign 3: activities.cover_path / details and the activity-images bucket.
-- ids: activity ...ac01, student ...ac11, teacher ...ac21
begin;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000ac11', 'ac-s@example.test', '{"full_name":"AC นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-00000000ac21', 'ac-t@example.test', '{"full_name":"AC ครู"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000ac21';
insert into public.activities (id, title, starts_at, ends_at, status, type) values
  ('00000000-0000-0000-0000-00000000ac01', 'AC activity', now(), now() + interval '1 day', 'open', 'fixed');

select has_column('public', 'activities', 'cover_path', 'activities.cover_path exists');
select has_column('public', 'activities', 'details', 'activities.details exists');
select throws_ok($$update public.activities set details = repeat('ก', 20001) where id = '00000000-0000-0000-0000-00000000ac01'$$,
  '23514', null, 'details over 20000 characters is rejected');
select lives_ok($$update public.activities set details = repeat('ก', 20000) where id = '00000000-0000-0000-0000-00000000ac01'$$,
  'details of exactly 20000 characters is accepted');
select throws_ok($$update public.activities set cover_path = '00000000-0000-0000-0000-00000000ac99/00000000-0000-0000-0000-0000000000c1.jpg'
  where id = '00000000-0000-0000-0000-00000000ac01'$$, '23514', null, 'cover_path under another id is rejected');
select lives_ok($$update public.activities set cover_path = '00000000-0000-0000-0000-00000000ac01/00000000-0000-0000-0000-0000000000c1.jpg'
  where id = '00000000-0000-0000-0000-00000000ac01'$$, 'cover_path under the activity id is accepted');

select is((select public from storage.buckets where id = 'activity-images'), true, 'activity-images bucket is public');
select is((select file_size_limit from storage.buckets where id = 'activity-images'), 2097152::bigint, 'activity-images limit is 2 MiB');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ac11","role":"authenticated"}', true);
select throws_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('activity-images', '00000000-0000-0000-0000-00000000ac01/s.jpg', '00000000-0000-0000-0000-00000000ac11')$$,
  '42501', null, 'a student cannot upload an activity image');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ac21","role":"authenticated"}', true);
select lives_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('activity-images', '00000000-0000-0000-0000-00000000ac01/t.jpg', '00000000-0000-0000-0000-00000000ac21')$$,
  'a teacher uploads an activity image');
reset role;
select is((select allowed_mime_types from storage.buckets where id = 'activity-images'),
  array['image/jpeg', 'image/png', 'image/webp']::text[], 'activity-images allows jpeg, png, webp');

select * from finish();
rollback;
