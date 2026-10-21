-- Articles (Task 18 Part B, R122/R124; spec 8.1, 9.1, 9.3).
-- RLS on public.articles (0002), the slug / title / cover checks and the article-images bucket (0020).
-- Per-id predicates only (the local DB holds e2e leftovers); everything rolls back.
-- ids: student S ...f201, teacher T ...f202, admin A ...f203
--   articles: published P ...f251, draft D ...f252, teacher-made N ...f253
begin;
select plan(50);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000f201', 'art-s1@example.test', '{"full_name":"นักเรียน บทความ"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f202', 'art-t1@example.test', '{"full_name":"ครู บทความ"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f203', 'art-a1@example.test', '{"full_name":"แอดมิน บทความ"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000f202';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000f203';

insert into public.articles (id, title, slug, body, published) values
  ('00000000-0000-0000-0000-00000000f251', 'ART เผยแพร่', 'art-test-published-f251', 'เนื้อหา', true),
  ('00000000-0000-0000-0000-00000000f252', 'ART ร่าง', 'art-test-draft-f252', 'ร่าง', false);

-- 1-9: shape, privileges, bucket ---------------------------------------------------------------
select is((select count(*) from pg_constraint where conrelid = 'public.articles'::regclass
           and conname in ('articles_slug_format', 'articles_title_length', 'articles_body_length', 'articles_cover_path_format')),
  4::bigint, 'articles has the slug / title / body / cover checks');
select is(has_table_privilege('anon', 'public.articles', 'INSERT'), false, 'anon has no INSERT on articles');
select is(has_table_privilege('anon', 'public.articles', 'UPDATE'), false, 'anon has no UPDATE on articles');
select is(has_table_privilege('anon', 'public.articles', 'DELETE'), false, 'anon has no DELETE on articles');
select is((select public from storage.buckets where id = 'article-images'), true, 'article-images bucket is public');
select is((select file_size_limit from storage.buckets where id = 'article-images'), 2097152::bigint, 'article-images limit is 2 MB');
select is((select allowed_mime_types from storage.buckets where id = 'article-images'),
  array['image/jpeg', 'image/png', 'image/webp'], 'article-images allows jpeg/png/webp only');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
           and policyname in ('article_images_select', 'article_images_insert_staff', 'article_images_update_staff',
                              'article_images_delete_staff')), 4::bigint,
  'article-images has select and staff insert/update/delete policies');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'articles'), 5::bigint,
  'articles keeps the five 0002 policies');

-- 10-12: anon reads only published -------------------------------------------------------------
set local role anon;
select is((select count(*) from public.articles where id = '00000000-0000-0000-0000-00000000f251'), 1::bigint,
  'anon sees a published article');
select is((select count(*) from public.articles where id = '00000000-0000-0000-0000-00000000f252'), 0::bigint,
  'anon does not see a draft');
select throws_ok($$insert into public.articles (title, slug, body) values ('x', 'art-anon-f2', 'x')$$,
  '42501', null, 'anon cannot insert an article');
reset role;

-- 13-17: student: reads published only, cannot write -------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f201","role":"authenticated"}', true);
select is((select count(*) from public.articles where id = '00000000-0000-0000-0000-00000000f251'), 1::bigint,
  'student sees a published article');
select is((select count(*) from public.articles where id = '00000000-0000-0000-0000-00000000f252'), 0::bigint,
  'student does not see a draft');
select throws_ok($$insert into public.articles (title, slug, body) values ('x', 'art-student-f2', 'x')$$,
  '42501', null, 'student cannot insert an article');
update public.articles set title = 'hacked' where id = '00000000-0000-0000-0000-00000000f251';
delete from public.articles where id = '00000000-0000-0000-0000-00000000f251';
reset role;
select is((select title from public.articles where id = '00000000-0000-0000-0000-00000000f251'), 'ART เผยแพร่',
  'student update changes nothing');
select is((select count(*) from public.articles where id = '00000000-0000-0000-0000-00000000f251'), 1::bigint,
  'student delete removes nothing');

-- 18-24: teacher: sees drafts, inserts and updates, cannot delete --------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f202","role":"authenticated"}', true);
select is((select count(*) from public.articles where id = '00000000-0000-0000-0000-00000000f252'), 1::bigint,
  'teacher sees a draft');
select lives_ok($$insert into public.articles (id, title, slug, body, author_id)
  values ('00000000-0000-0000-0000-00000000f253', 'ART ครู', 'art-test-teacher-f253', 'ย่อหน้า 1

ย่อหน้า 2', '00000000-0000-0000-0000-00000000f202')$$, 'teacher inserts an article');
select lives_ok($$update public.articles set published = true, title = 'ART ครู แก้แล้ว'
  where id = '00000000-0000-0000-0000-00000000f253'$$, 'teacher updates and publishes');
delete from public.articles where id = '00000000-0000-0000-0000-00000000f253';
reset role;
select is((select title from public.articles where id = '00000000-0000-0000-0000-00000000f253'), 'ART ครู แก้แล้ว',
  'teacher update is saved');
select is((select published from public.articles where id = '00000000-0000-0000-0000-00000000f253'), true,
  'teacher publish is saved');
select is((select count(*) from public.articles where id = '00000000-0000-0000-0000-00000000f253'), 1::bigint,
  'teacher delete removes nothing (admin only)');
set local role anon;
select is((select count(*) from public.articles where id = '00000000-0000-0000-0000-00000000f253'), 1::bigint,
  'anon sees the article once published');
reset role;

-- 25-26: unpublish hides it again; admin deletes -------------------------------------------------
update public.articles set published = false where id = '00000000-0000-0000-0000-00000000f253';
set local role anon;
select is((select count(*) from public.articles where id = '00000000-0000-0000-0000-00000000f253'), 0::bigint,
  'anon no longer sees an unpublished article');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f203","role":"authenticated"}', true);
delete from public.articles where id = '00000000-0000-0000-0000-00000000f253';
reset role;
select is((select count(*) from public.articles where id = '00000000-0000-0000-0000-00000000f253'), 0::bigint,
  'admin deletes an article');

-- 27-37: slug, title, body and cover checks (as postgres: constraints apply to every caller) -------
select throws_ok($$insert into public.articles (title, slug) values ('x', 'Bad-Slug')$$, '23514', null, 'uppercase slug is rejected');
select throws_ok($$insert into public.articles (title, slug) values ('x', 'has space')$$, '23514', null, 'slug with a space is rejected');
select throws_ok($$insert into public.articles (title, slug) values ('x', 'a--b')$$, '23514', null, 'slug with a double hyphen is rejected');
select throws_ok($$insert into public.articles (title, slug) values ('x', '-ab')$$, '23514', null, 'slug with a leading hyphen is rejected');
select throws_ok($$insert into public.articles (title, slug) values ('x', 'ab-')$$, '23514', null, 'slug with a trailing hyphen is rejected');
select throws_ok($$insert into public.articles (title, slug) values ('x', 'ภาษาไทย')$$, '23514', null, 'non-ascii slug is rejected');
select throws_ok($$insert into public.articles (title, slug) values ('x', repeat('a', 81))$$, '23514', null, 'an 81-character slug is rejected');
select lives_ok($$insert into public.articles (title, slug) values ('x', repeat('f', 78) || '-2')$$, 'an 80-character slug is accepted');
select lives_ok($$insert into public.articles (title, slug) values ('x', 'a-0f2z9k1q')$$, 'a generated-style slug is accepted');
select throws_ok($$insert into public.articles (title, slug) values ('x', 'art-test-published-f251')$$,
  '23505', null, 'a duplicate slug is rejected');
select throws_ok($$insert into public.articles (title, slug) values (E'\t\n ', 'art-blank-title-f2')$$,
  '23514', null, 'a whitespace-only title is rejected');
select throws_ok($$insert into public.articles (title, slug) values (repeat('ก', 201), 'art-long-title-f2')$$,
  '23514', null, 'a 201-character title is rejected');
select throws_ok($$insert into public.articles (title, slug, body) values ('x', 'art-long-body-f2', repeat('ข', 20001))$$,
  '23514', null, 'a body over 20000 characters is rejected');
select throws_ok($$insert into public.articles (title, slug, cover_path) values ('x', 'art-bad-cover-f2', '../evil.jpg')$$,
  '23514', null, 'a cover_path outside {id}/{uuid}.jpg is rejected');
select lives_ok($$insert into public.articles (id, title, slug, cover_path) values ('00000000-0000-0000-0000-00000000f254', 'x',
  'art-good-cover-f2', '00000000-0000-0000-0000-00000000f254/00000000-0000-0000-0000-00000000f2aa.jpg')$$,
  'a cover_path under the article''s own id is accepted');
-- 0022: the cover folder must be the article's own id
select throws_ok($$insert into public.articles (id, title, slug, cover_path) values ('00000000-0000-0000-0000-00000000f255', 'x',
  'art-foreign-cover-f2', '00000000-0000-0000-0000-00000000f251/00000000-0000-0000-0000-00000000f2ab.jpg')$$,
  '23514', null, 'a cover_path under another article''s id is rejected');
select throws_ok($$update public.articles set cover_path = '00000000-0000-0000-0000-00000000f254/00000000-0000-0000-0000-00000000f2ac.jpg'
  where id = '00000000-0000-0000-0000-00000000f251'$$,
  '23514', null, 'an update cannot point a cover at another article''s folder');

-- 42-48: article-images objects: staff write, others cannot --------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f202","role":"authenticated"}', true);
select lives_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('article-images', '00000000-0000-0000-0000-00000000f251/t.jpg', '00000000-0000-0000-0000-00000000f202')$$,
  'teacher uploads an article image');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f201","role":"authenticated"}', true);
select throws_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('article-images', '00000000-0000-0000-0000-00000000f251/s.jpg', '00000000-0000-0000-0000-00000000f201')$$,
  '42501', null, 'student cannot upload an article image');
reset role;
set local role anon;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('article-images', 'x/anon.jpg')$$,
  '42501', null, 'anon cannot upload an article image');
reset role;

insert into storage.objects (bucket_id, name) values
  ('article-images', '00000000-0000-0000-0000-00000000f251/d1.jpg'),
  ('article-images', '00000000-0000-0000-0000-00000000f251/d2.jpg');
-- storage.protect_delete blocks raw DELETEs unless this is set (RLS still applies)
select set_config('storage.allow_delete_query', 'true', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f201","role":"authenticated"}', true);
delete from storage.objects where bucket_id = 'article-images' and name like '00000000-0000-0000-0000-00000000f251/d_.jpg';
update storage.objects set name = '00000000-0000-0000-0000-00000000f251/hacked.jpg'
  where bucket_id = 'article-images' and name = '00000000-0000-0000-0000-00000000f251/d1.jpg';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'article-images'
           and name like '00000000-0000-0000-0000-00000000f251/d_.jpg'), 2::bigint,
  'student cannot delete or rename article images');
set local role anon;
delete from storage.objects where bucket_id = 'article-images' and name like '00000000-0000-0000-0000-00000000f251/d_.jpg';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'article-images'
           and name like '00000000-0000-0000-0000-00000000f251/d_.jpg'), 2::bigint,
  'anon cannot delete article images');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f202","role":"authenticated"}', true);
delete from storage.objects where bucket_id = 'article-images' and name = '00000000-0000-0000-0000-00000000f251/d1.jpg';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f203","role":"authenticated"}', true);
delete from storage.objects where bucket_id = 'article-images' and name = '00000000-0000-0000-0000-00000000f251/d2.jpg';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'article-images'
           and name = '00000000-0000-0000-0000-00000000f251/d1.jpg'), 0::bigint,
  'teacher deletes an article image');
select is((select count(*) from storage.objects where bucket_id = 'article-images'
           and name = '00000000-0000-0000-0000-00000000f251/d2.jpg'), 0::bigint,
  'admin deletes an article image');

select * from finish();
rollback;
