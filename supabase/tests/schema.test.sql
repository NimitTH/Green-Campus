begin;
select plan(30);

-- fixtures (plain inserts; run as superuser, RLS does not apply)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'student1@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'teacher1@example.test');
-- handle_new_user (0002) already created these profiles; set the fixture values.
insert into public.profiles (id, role, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'student', 'Student One'),
  ('00000000-0000-0000-0000-0000000000b1', 'teacher', 'Teacher One')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;
-- 0018: codes are unique and fixed, so replace the seed plastic row with the fixture
delete from public.waste_categories where code = 'plastic';
insert into public.waste_categories (id, name, code, points_per_kg, carbon_kg_per_kg, source_note) values
  ('00000000-0000-0000-0000-0000000000c1', 'plastic', 'plastic', 10, 1.5, 'test');
insert into public.activities (id, title, starts_at, ends_at, status, type, requires_code, unit_points, created_by) values
  ('00000000-0000-0000-0000-0000000000d1', 'Waste act', now(), now() + interval '1 day', 'open', 'waste', true, 0, '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d2', 'Trees act', now(), now() + interval '1 day', 'open', 'trees', false, 5, '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d3', 'Fixed act', now(), now() + interval '1 day', 'open', 'fixed', false, 20, '00000000-0000-0000-0000-0000000000b1');
insert into public.submissions (id, activity_id, student_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1');

-- 1-2: structure
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname = any(array[
      'profiles','waste_categories','activities','participations','weigh_codes','submissions',
      'submission_items','ledger_entries','rewards','cart_items','orders','order_items',
      'notifications','articles'])),
  14::bigint, 'all 14 tables exist');
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname = any(array[
      'profiles','waste_categories','activities','participations','weigh_codes','submissions',
      'submission_items','ledger_entries','rewards','cart_items','orders','order_items',
      'notifications','articles'])),
  14::bigint, 'RLS enabled on all 14 tables');

-- 3-6: weigh_codes partial unique
select lives_ok($$insert into public.weigh_codes (id, activity_id, student_id, code, issued_by)
  values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','123456','00000000-0000-0000-0000-0000000000b1')$$,
  'first active weigh code inserts');
select throws_ok($$insert into public.weigh_codes (activity_id, student_id, code, issued_by)
  values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','654321','00000000-0000-0000-0000-0000000000b1')$$,
  '23505', null, 'second active weigh code for same pair is rejected');
select lives_ok($$update public.weigh_codes set revoked_at = now() where id = '00000000-0000-0000-0000-0000000000f1'$$,
  'revoking the old code works');
select lives_ok($$insert into public.weigh_codes (activity_id, student_id, code, issued_by)
  values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','654321','00000000-0000-0000-0000-0000000000b1')$$,
  'new active code allowed after revocation');

-- 7-14: submission_items rules
select throws_ok($$insert into public.submission_items (submission_id, waste_category_id, quantity)
  values ('00000000-0000-0000-0000-0000000000e1', null, 500)$$,
  '23514', null, 'waste item without category rejected');
select throws_ok($$insert into public.submission_items (submission_id, waste_category_id, quantity)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 0)$$,
  '23514', null, 'quantity 0 rejected');
select throws_ok($$insert into public.submission_items (submission_id, waste_category_id, quantity)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', -5)$$,
  '23514', null, 'negative quantity rejected');
select lives_ok($$insert into public.submission_items (submission_id, waste_category_id, quantity)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 500)$$,
  'valid waste item inserts');
select throws_ok($$insert into public.submission_items (submission_id, waste_category_id, quantity)
  values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 10)$$,
  '23514', null, 'trees item with category rejected');
select lives_ok($$insert into public.submission_items (submission_id, waste_category_id, quantity)
  values ('00000000-0000-0000-0000-0000000000e2', null, 10)$$,
  'valid trees item inserts');
select throws_ok($$insert into public.submission_items (submission_id, waste_category_id, quantity)
  values ('00000000-0000-0000-0000-0000000000e3', null, 2)$$,
  '23514', null, 'fixed item with quantity 2 rejected');
select lives_ok($$insert into public.submission_items (submission_id, waste_category_id, quantity)
  values ('00000000-0000-0000-0000-0000000000e3', null, 1)$$,
  'valid fixed item inserts');

-- 15-20: ledger rules
select throws_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg)
  values ('00000000-0000-0000-0000-0000000000a1', 'bonus', 5, 0)$$,
  '23514', null, 'ledger kind outside the 4 values rejected');
select throws_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg)
  values ('00000000-0000-0000-0000-0000000000a1', 'earn', -1, 1)$$,
  '23514', null, 'earn with negative points rejected');
select lives_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg)
  values ('00000000-0000-0000-0000-0000000000a1', 'earn', 0, 0.5)$$,
  'earn with zero points accepted');
select throws_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg)
  values ('00000000-0000-0000-0000-0000000000a1', 'redeem', 5, 0)$$,
  '23514', null, 'redeem with positive points rejected');
select throws_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg)
  values ('00000000-0000-0000-0000-0000000000a1', 'refund', 5, 1)$$,
  '23514', null, 'refund with non-zero carbon rejected');
select lives_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg)
  values ('00000000-0000-0000-0000-0000000000a1', 'redeem', -50, 0)$$,
  'redeem with negative points and zero carbon inserts');
select lives_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg, note, created_by)
  values ('00000000-0000-0000-0000-0000000000a1', 'adjust', -3, -0.5, 'fix', '00000000-0000-0000-0000-0000000000b1')$$,
  'adjust with negative points inserts');

-- 21-22: uniques
insert into public.participations (activity_id, student_id)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1');
select throws_ok($$insert into public.participations (activity_id, student_id)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1')$$,
  '23505', null, 'duplicate participation rejected');
insert into public.rewards (id, name, points_cost, stock)
  values ('00000000-0000-0000-0000-000000000a01', 'Bottle', 100, 5);
insert into public.cart_items (student_id, reward_id, qty)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000a01', 1);
select throws_ok($$insert into public.cart_items (student_id, reward_id, qty)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000a01', 2)$$,
  '23505', null, 'duplicate cart item rejected');

-- 23: role check (insert for an id with no auth user: the CHECK fires before the FK)
select throws_ok($$insert into public.profiles (id, role, full_name)
  values ('00000000-0000-0000-0000-0000000000a9', 'superuser', 'Bad Role')$$,
  '23514', null, 'invalid role rejected');

-- 24: updated_at trigger
update public.profiles set display_name = 'S1' where id = '00000000-0000-0000-0000-0000000000a1';
select ok(
  (select updated_at > created_at from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'updated_at moves forward on update');

-- 25: slug unique
insert into public.articles (title, slug, body) values ('A', 'same-slug', 'x');
select throws_ok($$insert into public.articles (title, slug, body) values ('B', 'same-slug', 'y')$$,
  '23505', null, 'duplicate article slug rejected');

-- 26-29: other checks
select throws_ok($$insert into public.weigh_codes (activity_id, student_id, code)
  values ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000a1','abc')$$,
  '23514', null, 'non 6-digit code rejected');
select throws_ok($$insert into public.submissions (activity_id, student_id, status)
  values ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000a1','bogus')$$,
  '23514', null, 'invalid submission status rejected');
select throws_ok($$insert into public.orders (student_id, status, total_points)
  values ('00000000-0000-0000-0000-0000000000a1','bogus',10)$$,
  '23514', null, 'invalid order status rejected');
select throws_ok($$insert into public.activities (title, starts_at, ends_at, type)
  values ('X', now(), now() + interval '1 day', 'bogus')$$,
  '23514', null, 'invalid activity type rejected');

select * from finish();
rollback;
