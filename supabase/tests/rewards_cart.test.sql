-- Rewards bucket and cart RLS (Task 12, R64 and R66; spec 8.1).
-- ids: students s1 ...9101, s2 ...9102   teacher ...9201   admin ...9301
--   rewards: active ...9501, inactive ...9502
begin;
select plan(36);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000009101', 'rc-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000009102', 'rc-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000009201', 'rc-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000009301', 'rc-ad@example.test', '{"full_name":"แอดมิน หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000009201';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000009301';

insert into public.rewards (id, name, points_cost, stock, active) values
  ('00000000-0000-0000-0000-000000009501', 'RC active', 50, 5, true),
  ('00000000-0000-0000-0000-000000009502', 'RC inactive', 70, 5, false);
insert into public.cart_items (student_id, reward_id, qty)
values ('00000000-0000-0000-0000-000000009102', '00000000-0000-0000-0000-000000009501', 1);

-- 1-5: bucket and policies ------------------------------------------------------------------
select is((select public from storage.buckets where id = 'reward-images'), true, 'reward-images bucket is public');
select is((select file_size_limit from storage.buckets where id = 'reward-images'), 2097152::bigint, 'bucket limit is 2 MB');
select is((select allowed_mime_types from storage.buckets where id = 'reward-images'),
  array['image/jpeg', 'image/png', 'image/webp'], 'bucket allows jpeg/png/webp only');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
            and policyname in ('reward_images_insert_staff', 'reward_images_update_staff', 'reward_images_delete_staff')), 3::bigint,
  'staff insert/update/delete policies exist on the bucket');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'cart_items'), 4::bigint,
  'cart_items has select/insert/update/delete policies');

-- 6-12: student s1 cart ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009101","role":"authenticated"}', true);
select lives_ok($$insert into public.cart_items (student_id, reward_id, qty)
  values ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000009501', 2)$$, 'student adds an active reward to own cart');
select throws_ok($$insert into public.cart_items (student_id, reward_id, qty)
  values ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000009502', 1)$$,
  '42501', null, 'student cannot add an inactive reward');
select throws_ok($$insert into public.cart_items (student_id, reward_id, qty)
  values ('00000000-0000-0000-0000-000000009102', '00000000-0000-0000-0000-000000009501', 1)$$,
  '42501', null, 'student cannot insert into another cart');
update public.cart_items set qty = 4 where student_id = '00000000-0000-0000-0000-000000009101';
select is((select qty from public.cart_items where student_id = '00000000-0000-0000-0000-000000009101'), 4, 'student updates own qty');
update public.cart_items set qty = 9 where student_id = '00000000-0000-0000-0000-000000009102';
delete from public.cart_items where student_id = '00000000-0000-0000-0000-000000009102';
select is((select count(*) from public.cart_items), 1::bigint, 'student sees only own cart');
select throws_ok($$update public.cart_items set student_id = '00000000-0000-0000-0000-000000009102'
  where student_id = '00000000-0000-0000-0000-000000009101'$$, '42501', null, 'student cannot hand a row to another student');
reset role;
select is((select qty from public.cart_items where student_id = '00000000-0000-0000-0000-000000009102'), 1,
  'another student cart row is untouched by update and delete');

-- 13-17: inactive reward blocks raising qty but not removal ---------------------------------
update public.rewards set active = false where id = '00000000-0000-0000-0000-000000009501';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009101","role":"authenticated"}', true);
select throws_ok($$update public.cart_items set qty = 7 where student_id = '00000000-0000-0000-0000-000000009101'$$, '42501', null, 'student cannot raise qty of an inactive reward');
select lives_ok($$delete from public.cart_items where student_id = '00000000-0000-0000-0000-000000009101'$$, 'student removes an inactive line');
reset role;
select is((select count(*) from public.cart_items where student_id = '00000000-0000-0000-0000-000000009101'), 0::bigint,
  'own line is gone after delete');
update public.rewards set active = true where id = '00000000-0000-0000-0000-000000009501';
insert into public.cart_items (student_id, reward_id, qty)
values ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000009501', 4);
update public.rewards set active = false where id = '00000000-0000-0000-0000-000000009501';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009101","role":"authenticated"}', true);
select throws_ok($$update public.cart_items set qty = 7 where student_id = '00000000-0000-0000-0000-000000009101'$$, '42501', null, 'student cannot raise qty of an inactive reward');
reset role;
select is((select qty from public.cart_items where student_id = '00000000-0000-0000-0000-000000009101'), 4,
  'qty of an inactive reward cannot be raised');
update public.rewards set active = true where id = '00000000-0000-0000-0000-000000009501';

-- 18-24: teacher and admin: read only. Each owns a cart row (seeded as superuser) so the update
-- and delete below match a row and only the missing write policy stops them -------------------
insert into public.cart_items (student_id, reward_id, qty) values
  ('00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000009501', 3),
  ('00000000-0000-0000-0000-000000009301', '00000000-0000-0000-0000-000000009501', 3);
-- M8: the local DB may hold other carts (seed, e2e leftovers): count the fixture students' rows, and compare
-- the teacher's total with the superuser total instead of a fixed number.
select set_config('t.cart_total', (select count(*)::text from public.cart_items), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009201","role":"authenticated"}', true);
select is((select count(*) from public.cart_items where student_id in ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000009102', '00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000009301')), 4::bigint, 'teacher reads the fixture students'' carts');
select is((select count(*) from public.cart_items), current_setting('t.cart_total')::bigint, 'teacher reads all carts (same total as superuser)');
select throws_ok($$insert into public.cart_items (student_id, reward_id, qty)
  values ('00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000009502', 1)$$,
  '42501', null, 'teacher cannot insert a cart row');
update public.cart_items set qty = 9;
delete from public.cart_items;
reset role;
select is((select count(*) from public.cart_items where student_id in ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000009102', '00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000009301')), 4::bigint, 'teacher delete removes nothing');
select is((select qty from public.cart_items where student_id = '00000000-0000-0000-0000-000000009201'), 3,
  'teacher update and delete leave their own row untouched');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009301","role":"authenticated"}', true);
select throws_ok($$insert into public.cart_items (student_id, reward_id, qty)
  values ('00000000-0000-0000-0000-000000009301', '00000000-0000-0000-0000-000000009502', 1)$$,
  '42501', null, 'admin cannot insert a cart row');
update public.cart_items set qty = 9;
delete from public.cart_items;
reset role;
select is((select count(*) from public.cart_items where student_id in ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000009102', '00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000009301')), 4::bigint, 'admin delete removes nothing');
select is((select qty from public.cart_items where student_id = '00000000-0000-0000-0000-000000009301'), 3,
  'admin update and delete leave their own row untouched');

-- 25-29: reward images ------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009201","role":"authenticated"}', true);
select lives_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('reward-images', '00000000-0000-0000-0000-000000009501/a.jpg', '00000000-0000-0000-0000-000000009201')$$,
  'teacher uploads a reward image');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009101","role":"authenticated"}', true);
select throws_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('reward-images', '00000000-0000-0000-0000-000000009501/b.jpg', '00000000-0000-0000-0000-000000009101')$$,
  '42501', null, 'student cannot upload a reward image');
update storage.objects set name = '00000000-0000-0000-0000-000000009501/hacked.jpg' where bucket_id = 'reward-images';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'reward-images' and name like '%hacked%'), 0::bigint,
  'student cannot update reward images');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009301","role":"authenticated"}', true);
update storage.objects set name = '00000000-0000-0000-0000-000000009501/c.jpg' where bucket_id = 'reward-images';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'reward-images' and name like '%/c.jpg'), 1::bigint,
  'admin updates a reward image');
set local role anon;
select throws_ok($$insert into storage.objects (bucket_id, name) values ('reward-images', 'x/anon.jpg')$$,
  '42501', null, 'anon cannot upload a reward image');
reset role;

-- 30-33: reward image deletes: staff only ------------------------------------------------------
insert into storage.objects (bucket_id, name) values
  ('reward-images', '00000000-0000-0000-0000-000000009501/d1.jpg'),
  ('reward-images', '00000000-0000-0000-0000-000000009501/d2.jpg');
-- storage.protect_delete blocks raw DELETEs unless this is set (RLS still applies)
select set_config('storage.allow_delete_query', 'true', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009101","role":"authenticated"}', true);
delete from storage.objects where bucket_id = 'reward-images' and name like '%/d_.jpg';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'reward-images' and name like '%/d_.jpg'), 2::bigint,
  'student cannot delete reward images');
set local role anon;
delete from storage.objects where bucket_id = 'reward-images' and name like '%/d_.jpg';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'reward-images' and name like '%/d_.jpg'), 2::bigint,
  'anon cannot delete reward images');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009201","role":"authenticated"}', true);
delete from storage.objects where bucket_id = 'reward-images' and name like '%/d1.jpg';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'reward-images' and name like '%/d1.jpg'), 0::bigint,
  'teacher deletes a reward image');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000009301","role":"authenticated"}', true);
delete from storage.objects where bucket_id = 'reward-images' and name like '%/d2.jpg';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'reward-images' and name like '%/d2.jpg'), 0::bigint,
  'admin deletes a reward image');

-- 34-35: anon cart ----------------------------------------------------------------------------
set local role anon;
select is((select count(*) from public.cart_items), 0::bigint, 'anon reads no carts');
select throws_ok($$insert into public.cart_items (student_id, reward_id, qty)
  values ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000009501', 1)$$,
  '42501', null, 'anon cannot insert carts');
reset role;

select * from finish();
rollback;
