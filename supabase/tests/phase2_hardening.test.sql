-- Phase 2 review hardening (0016): restore stock when a profile with pending orders is deleted
-- (R93), cart qty <= 99 in the database, profile_display_name(uuid), and the order_new link
-- /staff/orders?q=<order number>. Per-user / per-reward predicates only, never global counts.
-- ids: students s1 ...c101 (deleted), s2 ...c102 (untouched), s3 ...c103 (checkout), s4 ...c104 (names)
--   teacher ...c201
--   rewards r1 ...c501 (stock 10), r2 ...c502 (stock 5), r3 ...c503 (stock 20, 10 points)
--   orders of s1: pending ...c601 (r1 x3, r2 x1), completed ...c602 (r1 x2), cancelled ...c603 (r1 x4),
--     expired ...c604 (r2 x2); of s2: pending ...c605 (r1 x1)
begin;
select plan(36);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c101', 'p2-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000c102', 'p2-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000c103', 'p2-s3@example.test', '{"full_name":"นักเรียน สาม"}'::jsonb),
  ('00000000-0000-0000-0000-00000000c104', 'p2-s4@example.test', '{"full_name":"นักเรียน สี่"}'::jsonb),
  ('00000000-0000-0000-0000-00000000c201', 'p2-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000c201';

insert into public.rewards (id, name, points_cost, stock, active) values
  ('00000000-0000-0000-0000-00000000c501', 'P2 r1', 10, 10, true),
  ('00000000-0000-0000-0000-00000000c502', 'P2 r2', 10, 5, true),
  ('00000000-0000-0000-0000-00000000c503', 'P2 r3', 10, 20, true);

-- Orders written directly (service context); stock is set by hand above and not decremented, so
-- the delete below must add back exactly the pending lines of s1.
insert into public.orders (id, student_id, status, total_points) values
  ('00000000-0000-0000-0000-00000000c601', '00000000-0000-0000-0000-00000000c101', 'pending_pickup', 40),
  ('00000000-0000-0000-0000-00000000c602', '00000000-0000-0000-0000-00000000c101', 'completed', 20),
  ('00000000-0000-0000-0000-00000000c603', '00000000-0000-0000-0000-00000000c101', 'cancelled', 40),
  ('00000000-0000-0000-0000-00000000c604', '00000000-0000-0000-0000-00000000c101', 'expired', 20),
  ('00000000-0000-0000-0000-00000000c605', '00000000-0000-0000-0000-00000000c102', 'pending_pickup', 10);
insert into public.order_items (order_id, reward_id, qty, unit_cost, reward_name) values
  ('00000000-0000-0000-0000-00000000c601', '00000000-0000-0000-0000-00000000c501', 3, 10, 'P2 r1'),
  ('00000000-0000-0000-0000-00000000c601', '00000000-0000-0000-0000-00000000c502', 1, 10, 'P2 r2'),
  ('00000000-0000-0000-0000-00000000c602', '00000000-0000-0000-0000-00000000c501', 2, 10, 'P2 r1'),
  ('00000000-0000-0000-0000-00000000c603', '00000000-0000-0000-0000-00000000c501', 4, 10, 'P2 r1'),
  ('00000000-0000-0000-0000-00000000c604', '00000000-0000-0000-0000-00000000c502', 2, 10, 'P2 r2'),
  ('00000000-0000-0000-0000-00000000c605', '00000000-0000-0000-0000-00000000c501', 1, 10, 'P2 r1');
insert into public.ledger_entries (student_id, kind, points, ref_order_id, note) values
  ('00000000-0000-0000-0000-00000000c101', 'adjust', 200, null, 'test'),
  ('00000000-0000-0000-0000-00000000c101', 'redeem', -40, '00000000-0000-0000-0000-00000000c601', 'test'),
  ('00000000-0000-0000-0000-00000000c103', 'adjust', 100, null, 'test');

-- 1-7: R93 trigger shape and privileges ---------------------------------------------------------
select has_trigger('public', 'profiles', 'profiles_restore_pending_stock', 'profiles has the restore-stock trigger');
select has_function('public', 'restore_pending_stock_on_profile_delete', 'the trigger function exists');
select is_definer('public', 'restore_pending_stock_on_profile_delete', 'the trigger function is security definer');
select is((select p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'restore_pending_stock_on_profile_delete'), array['search_path=""'],
  'the trigger function has an empty search_path');
select ok(not has_function_privilege('anon', 'public.restore_pending_stock_on_profile_delete()', 'execute'), 'anon cannot execute it');
select ok(not has_function_privilege('authenticated', 'public.restore_pending_stock_on_profile_delete()', 'execute'), 'authenticated cannot execute it');
select is((select t.tgtype & 2 = 2 and t.tgtype & 8 = 8 from pg_trigger t
           where t.tgrelid = 'public.profiles'::regclass and t.tgname = 'profiles_restore_pending_stock'), true,
  'the trigger is BEFORE DELETE');

-- 8-15: deleting the auth user restores only the pending lines ----------------------------------
delete from auth.users where id = '00000000-0000-0000-0000-00000000c101';
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000c101'), 0::bigint, 'the profile cascaded away');
select is((select count(*) from public.orders where student_id = '00000000-0000-0000-0000-00000000c101'), 0::bigint, 'the orders cascaded away');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000c501'), 13,
  'r1: the pending x3 is restored; completed x2 and cancelled x4 are not');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000c502'), 6,
  'r2: the pending x1 is restored; the expired x2 is not');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000c503'), 20, 'r3 is untouched');
select is((select count(*) from public.ledger_entries where student_id = '00000000-0000-0000-0000-00000000c101'), 0::bigint,
  'no ledger rows remain for the deleted student (no refund written)');
select is((select status from public.orders where id = '00000000-0000-0000-0000-00000000c605'), 'pending_pickup',
  'another student''s pending order is untouched');
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-00000000c104' and false$$,
  'a delete that matches nothing is fine');

-- 16-17: a profile with no orders deletes cleanly ------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c105', 'p2-s5@example.test', '{"full_name":"นักเรียน ห้า"}'::jsonb);
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-00000000c105'$$, 'a student without orders can be deleted');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000c501'), 13, 'and no stock changes');

-- 18-20: cart qty <= 99 in the database ------------------------------------------------------------
insert into public.cart_items (student_id, reward_id, qty) values
  ('00000000-0000-0000-0000-00000000c102', '00000000-0000-0000-0000-00000000c503', 99);
select ok(exists (select 1 from pg_constraint where conrelid = 'public.cart_items'::regclass and conname = 'cart_items_qty_max'),
  'cart_items_qty_max exists');
select throws_ok($$update public.cart_items set qty = 100
  where student_id = '00000000-0000-0000-0000-00000000c102' and reward_id = '00000000-0000-0000-0000-00000000c503'$$,
  '23514', null, 'a direct update of a cart line to 100 fails');
select is((select qty from public.cart_items where student_id = '00000000-0000-0000-0000-00000000c102'
            and reward_id = '00000000-0000-0000-0000-00000000c503'), 99, 'the line keeps 99');

-- 21-30: profile_display_name(uuid) ----------------------------------------------------------------
select has_function('public', 'profile_display_name', array['uuid'], 'profile_display_name(uuid) exists');
select is_definer('public', 'profile_display_name', array['uuid'], 'profile_display_name is security definer');
select volatility_is('public', 'profile_display_name', array['uuid'], 'stable', 'profile_display_name is stable');
select is((select p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'profile_display_name'), array['search_path=""'],
  'profile_display_name has an empty search_path');
select ok(not has_function_privilege('anon', 'public.profile_display_name(uuid)', 'execute'), 'anon cannot execute profile_display_name');
select ok(not has_function_privilege('authenticated', 'public.profile_display_name(uuid)', 'execute'), 'authenticated cannot execute profile_display_name (R99, 0017)');

update public.profiles set display_name = '  น้องสี่  ' where id = '00000000-0000-0000-0000-00000000c104';
select is(public.profile_display_name('00000000-0000-0000-0000-00000000c104'), 'น้องสี่', 'display_name wins, trimmed');
update public.profiles set display_name = '   ' where id = '00000000-0000-0000-0000-00000000c104';
select is(public.profile_display_name('00000000-0000-0000-0000-00000000c104'), 'นักเรียน สี่', 'a whitespace display_name falls back to full_name');
-- 0019 forbids a blank full_name; drop that check inside this (rolled back) test to keep the fallback covered
alter table public.profiles drop constraint profiles_full_name_length;
update public.profiles set display_name = '', full_name = ' ' where id = '00000000-0000-0000-0000-00000000c104';
select is(public.profile_display_name('00000000-0000-0000-0000-00000000c104'), 'ไม่ระบุชื่อ', 'blank display and full names give ไม่ระบุชื่อ');
select is(public.profile_display_name('00000000-0000-0000-0000-00000000c999'), null, 'an unknown id gives null');

-- 31-36: checkout's order_new notification links to the order on /staff/orders ---------------------
update public.profiles set display_name = '   ' where id = '00000000-0000-0000-0000-00000000c103';
insert into public.cart_items (student_id, reward_id, qty) values
  ('00000000-0000-0000-0000-00000000c103', '00000000-0000-0000-0000-00000000c503', 2);
create temp table t_ids (name text primary key, id uuid);
grant all on t_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000c103","role":"authenticated"}', true);
insert into t_ids select 'o', (r ->> 'order_id')::uuid from (select public.checkout() as r) s where (r ->> 'ok')::boolean;
select is((select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000c103'), 1::bigint,
  'checkout ran as s3');
reset role;
select isnt((select id from t_ids where name = 'o'), null, 'checkout of s3 succeeds');
select is((select link from public.notifications where user_id = '00000000-0000-0000-0000-00000000c201' and type = 'order_new'
            and body like 'นักเรียน สาม %'),
  '/staff/orders?q=' || upper(left((select id from t_ids where name = 'o')::text, 8)),
  'order_new links to /staff/orders?q=<order number>');
select is((select body from public.notifications where user_id = '00000000-0000-0000-0000-00000000c201' and type = 'order_new'
            and link = '/staff/orders?q=' || upper(left((select id from t_ids where name = 'o')::text, 8))),
  'นักเรียน สาม 2 ชิ้น รวม 20 แต้ม', 'a whitespace display_name falls back to full_name (btrim)');
select is((select link from public.notifications where user_id = '00000000-0000-0000-0000-00000000c103' and type = 'order_created'),
  '/orders/' || (select id from t_ids where name = 'o')::text, 'the student notification link is unchanged');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000c503'), 18, 'checkout still takes the stock');

select * from finish();
rollback;
