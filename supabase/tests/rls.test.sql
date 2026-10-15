-- Auth, roles and RLS (Task 3, spec 8.1-8.2).
-- Actors are impersonated with `set local role <role>` plus request.jwt.claims;
-- `reset role` returns to the superuser test session between actors.
begin;
select plan(76);

-- ids
--   s1 student with full_name metadata      ...0101
--   s2 student without metadata             ...0102
--   t1 teacher                              ...0201
--   ad admin                                ...0301

-- fixtures (superuser; RLS does not apply) ------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000101', 'student1@example.test',
    '{"full_name":"สมชาย ใจดี","role":"admin"}'::jsonb),
  ('00000000-0000-0000-0000-000000000102', 'student2@example.test', null),
  ('00000000-0000-0000-0000-000000000201', 'teacher1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000000301', 'admin1@example.test', '{"full_name":"แอดมิน หนึ่ง"}'::jsonb);

insert into public.waste_categories (id, name, points_per_kg, carbon_kg_per_kg, source_note) values
  ('00000000-0000-0000-0000-000000000401', 'rls-test-plastic', 10, 1.5, 'test');
insert into public.activities (id, title, starts_at, ends_at, status, type) values
  ('00000000-0000-0000-0000-000000000501', 'Open act', now(), now() + interval '1 day', 'open', 'waste'),
  ('00000000-0000-0000-0000-000000000502', 'Draft act', now(), now() + interval '1 day', 'draft', 'fixed');
insert into public.participations (activity_id, student_id) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000102');
insert into public.submissions (id, activity_id, student_id) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000102');
insert into public.submission_items (submission_id, waste_category_id, quantity) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000401', 500),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000401', 300);
insert into public.ledger_entries (student_id, kind, points, carbon_kg) values
  ('00000000-0000-0000-0000-000000000101', 'earn', 5, 0.5),
  ('00000000-0000-0000-0000-000000000102', 'earn', 3, 0.3);
insert into public.rewards (id, name, points_cost, stock, active) values
  ('00000000-0000-0000-0000-000000000701', 'Active reward', 100, 5, true),
  ('00000000-0000-0000-0000-000000000702', 'Hidden reward', 100, 5, false);
insert into public.orders (id, student_id, total_points) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000101', 100),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000102', 100);
insert into public.order_items (order_id, reward_id, qty, unit_cost) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000701', 1, 100),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000701', 1, 100);
insert into public.cart_items (student_id, reward_id, qty) values
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000701', 1);
insert into public.articles (id, title, slug, body, published) values
  ('00000000-0000-0000-0000-000000000801', 'Published', 'rls-test-published', 'x', true),
  ('00000000-0000-0000-0000-000000000802', 'Draft', 'rls-test-draft', 'y', false);
insert into public.notifications (id, user_id, type, title) values
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000101', 'test', 'n1'),
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000102', 'test', 'n2');

-- 1-6: helper functions ---------------------------------------------------
select has_function('public', 'is_staff', array[]::name[], 'is_staff() exists');
select has_function('public', 'is_admin', array[]::name[], 'is_admin() exists');
select is_definer('public', 'is_staff', array[]::name[], 'is_staff() is security definer');
select is_definer('public', 'is_admin', array[]::name[], 'is_admin() is security definer');
select ok(not has_function_privilege('anon', 'public.is_staff()', 'execute'), 'anon cannot execute is_staff()');
select ok(has_function_privilege('authenticated', 'public.is_staff()', 'execute'), 'authenticated can execute is_staff()');

-- 7-11: handle_new_user ---------------------------------------------------
select is((select role from public.profiles where id = '00000000-0000-0000-0000-000000000101'),
  'student', 'new user gets role student even if metadata says admin');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000101'),
  'สมชาย ใจดี', 'full_name comes from signup metadata');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000101'),
  'สมชาย ใจดี', 'display_name defaults to full_name');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000102'),
  'student2', 'full_name falls back to email local part');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000102'),
  'student2', 'display_name falls back with full_name');

-- 12-13: role change allowed with no auth.uid() (service / migration context)
select lives_ok($$update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000000201'$$,
  'role change allowed when auth.uid() is null');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000301';
select is((select role from public.profiles where id = '00000000-0000-0000-0000-000000000201'),
  'teacher', 'teacher role stored');

-- 14-45: student s1 -------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);

select ok(not public.is_staff(), 'student: is_staff() false');
select ok(not public.is_admin(), 'student: is_admin() false');
select is((select count(*) from public.profiles), 1::bigint, 'student sees only own profile');
select throws_ok($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000101'$$,
  '42501', null, 'student cannot update own role');
select throws_ok($$update public.profiles set is_demo = true where id = '00000000-0000-0000-0000-000000000101'$$,
  '42501', null, 'student cannot update own is_demo');
select lives_ok($$update public.profiles set full_name = 'สมชาย ใหม่', display_name = 'ชาย'
  where id = '00000000-0000-0000-0000-000000000101'$$, 'student can update own names');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000101'),
  'ชาย', 'own display_name updated');
update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-000000000102';

select throws_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg)
  values ('00000000-0000-0000-0000-000000000101', 'earn', 100, 0)$$,
  '42501', null, 'student cannot insert ledger_entries');
select throws_ok($$insert into public.submissions (activity_id, student_id)
  values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101')$$,
  '42501', null, 'student cannot insert submissions directly');
select throws_ok($$insert into public.participations (activity_id, student_id)
  values ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000101')$$,
  '42501', null, 'student cannot insert participations directly');
select throws_ok($$insert into public.weigh_codes (activity_id, student_id, code)
  values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', '123456')$$,
  '42501', null, 'student cannot insert weigh_codes');
select throws_ok($$insert into public.orders (student_id, total_points)
  values ('00000000-0000-0000-0000-000000000101', 1)$$,
  '42501', null, 'student cannot insert orders directly');

select is((select count(*) from public.submissions), 1::bigint, 'student sees only own submissions');
select is((select count(*) from public.submissions where student_id = '00000000-0000-0000-0000-000000000102'),
  0::bigint, 'student reads 0 rows of another student''s submissions');
select is((select count(*) from public.submission_items), 1::bigint, 'student sees only own submission_items');
select is((select count(*) from public.ledger_entries), 1::bigint, 'student sees only own ledger');
select is((select count(*) from public.participations), 1::bigint, 'student sees only own participations');
select is((select count(*) from public.orders), 1::bigint, 'student sees only own orders');
select is((select count(*) from public.order_items), 1::bigint, 'student sees only own order_items');
select is((select count(*) from public.activities where id in
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000502')),
  1::bigint, 'student sees open activity, not draft');
select is((select count(*) from public.rewards where id in
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000702')),
  1::bigint, 'student sees active reward only');
select is((select count(*) from public.articles where id in
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000802')),
  1::bigint, 'student sees published article only');
select is((select count(*) from public.waste_categories where id = '00000000-0000-0000-0000-000000000401'),
  1::bigint, 'student can read waste_categories');
select throws_ok($$insert into public.activities (title, starts_at, ends_at, type)
  values ('X', now(), now() + interval '1 day', 'fixed')$$,
  '42501', null, 'student cannot create activities');
select throws_ok($$insert into public.waste_categories (name, points_per_kg, carbon_kg_per_kg)
  values ('rls-test-x', 1, 1)$$,
  '42501', null, 'student cannot create waste_categories');
select lives_ok($$insert into public.cart_items (student_id, reward_id, qty)
  values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000701', 1)$$,
  'student can add to own cart');
select throws_ok($$insert into public.cart_items (student_id, reward_id, qty)
  values ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000702', 1)$$,
  '42501', null, 'student cannot add to another student''s cart');
select is((select count(*) from public.cart_items), 1::bigint, 'student sees only own cart');
select is((select count(*) from public.notifications), 1::bigint, 'student sees only own notifications');
select lives_ok($$update public.notifications set read_at = now() where id = '00000000-0000-0000-0000-000000000901'$$,
  'student can mark own notification read');
select throws_ok($$update public.notifications set title = 'x' where id = '00000000-0000-0000-0000-000000000901'$$,
  '42501', null, 'student cannot edit notification title');
select throws_ok($$delete from public.ledger_entries$$,
  '42501', null, 'student cannot delete ledger_entries');

reset role;

-- 46-47: effects checked as superuser
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000102'),
  'student2', 'student cannot rename another student (0 rows updated)');
select ok((select read_at is not null from public.notifications where id = '00000000-0000-0000-0000-000000000901'),
  'notification marked read');

-- 48-49: protect_profile_columns trigger on its own (column privilege lifted
-- inside this rolled-back transaction so the trigger is what rejects)
grant update (role, is_demo) on public.profiles to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
select throws_ok($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000101'$$,
  '42501', 'role and is_demo can only be changed by an admin function',
  'trigger rejects role change by a signed-in user');
select throws_ok($$update public.profiles set is_demo = true where id = '00000000-0000-0000-0000-000000000101'$$,
  '42501', 'role and is_demo can only be changed by an admin function',
  'trigger rejects is_demo change by a signed-in user');
reset role;
revoke update (role, is_demo) on public.profiles from authenticated;

-- 50-63: teacher t1 -------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000201","role":"authenticated"}', true);

select ok(public.is_staff(), 'teacher: is_staff() true');
select ok(not public.is_admin(), 'teacher: is_admin() false');
select is((select count(*) from public.profiles where id in
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102',
   '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301')),
  4::bigint, 'teacher reads all profiles');
select is((select count(*) from public.submissions where id in
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000602')),
  2::bigint, 'teacher reads all submissions');
select is((select count(*) from public.ledger_entries where student_id in
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102')),
  2::bigint, 'teacher reads all ledger entries');
select is((select count(*) from public.activities where id in
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000502')),
  2::bigint, 'teacher reads draft activities too');
select is((select count(*) from public.cart_items where student_id in
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102')),
  2::bigint, 'teacher reads all cart items');
select lives_ok($$insert into public.activities (id, title, starts_at, ends_at, type)
  values ('00000000-0000-0000-0000-000000000503', 'Teacher act', now(), now() + interval '1 day', 'fixed')$$,
  'teacher can create activity');
select lives_ok($$update public.activities set title = 'แก้แล้ว' where id = '00000000-0000-0000-0000-000000000502'$$,
  'teacher can edit activity');
delete from public.activities where id = '00000000-0000-0000-0000-000000000502';
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000000502'),
  1::bigint, 'teacher cannot delete activity (0 rows deleted)');
update public.waste_categories set points_per_kg = 999 where id = '00000000-0000-0000-0000-000000000401';
select is((select points_per_kg from public.waste_categories where id = '00000000-0000-0000-0000-000000000401'),
  10, 'teacher cannot edit waste_categories (0 rows updated)');
select throws_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg)
  values ('00000000-0000-0000-0000-000000000101', 'adjust', 100, 0)$$,
  '42501', null, 'teacher cannot insert ledger_entries directly');
select throws_ok($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000101'$$,
  '42501', null, 'teacher cannot change roles');
select is((select count(*) from public.notifications), 0::bigint, 'teacher does not read students'' notifications');

reset role;

-- 64-72: admin ad ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}', true);

select ok(public.is_admin(), 'admin: is_admin() true');
select ok(public.is_staff(), 'admin: is_staff() true');
select lives_ok($$update public.waste_categories set points_per_kg = 12 where id = '00000000-0000-0000-0000-000000000401'$$,
  'admin can edit waste_categories');
select is((select points_per_kg from public.waste_categories where id = '00000000-0000-0000-0000-000000000401'),
  12, 'waste category rate updated by admin');
select lives_ok($$delete from public.activities where id = '00000000-0000-0000-0000-000000000502'$$,
  'admin can delete activity without results');
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000000502'),
  0::bigint, 'activity deleted by admin');
select throws_ok($$delete from public.activities where id = '00000000-0000-0000-0000-000000000501'$$,
  '23503', null, 'admin cannot delete activity that has results');
select throws_ok($$update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000000101'$$,
  '42501', null, 'admin cannot change role by direct update');
select throws_ok($$insert into public.submissions (activity_id, student_id)
  values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000102')$$,
  '42501', null, 'admin cannot insert submissions directly');

reset role;

-- 73-76: anon -------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*) from public.articles where id in
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000802')),
  1::bigint, 'anon reads published articles only');
select is((select count(*) from public.profiles), 0::bigint, 'anon reads no profiles');
select is((select count(*) from public.activities), 0::bigint, 'anon reads no activities');
select throws_ok($$select public.is_staff()$$, '42501', null, 'anon cannot call is_staff()');

reset role;

select * from finish();
rollback;
