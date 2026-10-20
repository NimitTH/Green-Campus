-- Checkout, orders and expiry (Task 13, spec 5.1, 6.6, 7, 8.1, 9.5; rulings R71-R77).
-- Sequential cases only (plan steps ก ข ค ฉ ช): pgTAP runs in one transaction, so the two
-- concurrency cases (ง จ) are in tests/e2e/checkout.spec.ts (R77).
-- Notification checks use per-user predicates, never global counts.
-- ids: students s1 ...a101 (100 points), s2 ...a102 (10 points), s3 ...a103 (0 points, empty cart)
--   teacher ...a201   admin ...a301
--   rewards: r1 ...a501 (30, stock 5), r2 ...a502 (20, stock 1), r3 ...a503 (10, stock 5, inactive)
begin;
select plan(127);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a101', 'od-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000a102', 'od-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000a103', 'od-s3@example.test', '{"full_name":"นักเรียน สาม"}'::jsonb),
  ('00000000-0000-0000-0000-00000000a201', 'od-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000a301', 'od-ad@example.test', '{"full_name":"แอดมิน หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000a201';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000a301';

insert into public.rewards (id, name, points_cost, stock, active) values
  ('00000000-0000-0000-0000-00000000a501', 'OD r1', 30, 5, true),
  ('00000000-0000-0000-0000-00000000a502', 'OD r2', 20, 1, true),
  ('00000000-0000-0000-0000-00000000a503', 'OD r3', 10, 5, false);
insert into public.ledger_entries (student_id, kind, points, note) values
  ('00000000-0000-0000-0000-00000000a101', 'adjust', 100, 'test'),
  ('00000000-0000-0000-0000-00000000a102', 'adjust', 10, 'test');

-- Orders left by other runs must not be picked up by expire_orders below (rolled back at the end).
update public.orders set expires_at = now() + interval '1 day'
where status = 'pending_pickup' and expires_at <= now();

create temp table t_ids (name text primary key, id uuid);
grant all on t_ids to authenticated;

-- shape, privileges, indexes, cron ------------------------------------------------------
select has_function('public', 'checkout', array[]::text[], 'checkout() exists');
select has_function('public', 'complete_order', array['uuid'], 'complete_order(uuid) exists');
select has_function('public', 'cancel_order', array['uuid'], 'cancel_order(uuid) exists');
select has_function('public', 'expire_orders', array[]::text[], 'expire_orders() exists');
select is_definer('public', 'checkout', array[]::text[], 'checkout is security definer');
select is_definer('public', 'complete_order', array['uuid'], 'complete_order is security definer');
select is_definer('public', 'cancel_order', array['uuid'], 'cancel_order is security definer');
select is_definer('public', 'expire_orders', array[]::text[], 'expire_orders is security definer');
select function_returns('public', 'checkout', array[]::text[], 'jsonb', 'checkout returns jsonb');
select function_returns('public', 'complete_order', array['uuid'], 'void', 'complete_order returns void');
select function_returns('public', 'cancel_order', array['uuid'], 'void', 'cancel_order returns void');
select function_returns('public', 'expire_orders', array[]::text[], 'integer', 'expire_orders returns integer');
select ok(not has_function_privilege('anon', 'public.checkout()', 'execute'), 'anon cannot execute checkout');
select ok(not has_function_privilege('anon', 'public.complete_order(uuid)', 'execute'), 'anon cannot execute complete_order');
select ok(not has_function_privilege('anon', 'public.cancel_order(uuid)', 'execute'), 'anon cannot execute cancel_order');
select ok(not has_function_privilege('anon', 'public.expire_orders()', 'execute'), 'anon cannot execute expire_orders');
select ok(has_function_privilege('authenticated', 'public.checkout()', 'execute'), 'authenticated can execute checkout');
select ok(has_function_privilege('authenticated', 'public.complete_order(uuid)', 'execute'), 'authenticated can execute complete_order');
select ok(has_function_privilege('authenticated', 'public.cancel_order(uuid)', 'execute'), 'authenticated can execute cancel_order');
select ok(has_function_privilege('authenticated', 'public.expire_orders()', 'execute'), 'authenticated can execute expire_orders (admin button)');
select ok(not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'release_orders'
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  ) and exists (select 1 from pg_proc p where p.proname = 'release_orders'),
  'internal release_orders exists and API roles cannot execute it');
select ok(not has_table_privilege('authenticated', 'public.orders', 'insert')
      and not has_table_privilege('authenticated', 'public.orders', 'update')
      and not has_table_privilege('authenticated', 'public.orders', 'delete'),
  'authenticated cannot write orders');
select ok(not has_table_privilege('authenticated', 'public.order_items', 'insert')
      and not has_table_privilege('authenticated', 'public.order_items', 'update')
      and not has_table_privilege('authenticated', 'public.order_items', 'delete'),
  'authenticated cannot write order_items');
select ok(not has_table_privilege('authenticated', 'public.ledger_entries', 'insert')
      and not has_table_privilege('authenticated', 'public.ledger_entries', 'update')
      and not has_table_privilege('authenticated', 'public.ledger_entries', 'delete'),
  'authenticated cannot write ledger_entries');
select is((select indexdef like '%UNIQUE%(ref_order_id)%WHERE (kind = ''redeem''::text)%'
           from pg_indexes where schemaname = 'public' and tablename = 'ledger_entries'
             and indexname = 'ledger_entries_one_redeem_per_order'), true,
  'partial unique index: one redeem per order');
select is((select indexdef like '%UNIQUE%(ref_order_id)%WHERE (kind = ''refund''::text)%'
           from pg_indexes where schemaname = 'public' and tablename = 'ledger_entries'
             and indexname = 'ledger_entries_one_refund_per_order'), true,
  'partial unique index: one refund per order');
select is((select schedule from cron.job where jobname = 'expire-orders'), '0 * * * *',
  'pg_cron job expire-orders runs every hour');
select is((select command from cron.job where jobname = 'expire-orders'), 'select public.expire_orders()',
  'pg_cron job calls expire_orders()');
select col_not_null('public', 'order_items', 'reward_name', 'order_items.reward_name is required (name snapshot)');

-- auth errors --------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.checkout()$$, '42501', 'not_authenticated', 'checkout without a user raises not_authenticated');
select throws_ok($$select public.complete_order('00000000-0000-0000-0000-00000000a9ff')$$, '42501', 'not_authenticated',
  'complete_order without a user raises not_authenticated');
select throws_ok($$select public.expire_orders()$$, '42501', 'not_admin',
  'an authenticated JWT without a sub cannot take the pg_cron (no-user) branch');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a201","role":"authenticated"}', true);
select throws_ok($$select public.checkout()$$, '42501', 'not_student', 'teacher checkout raises not_student');
select throws_ok($$select public.expire_orders()$$, '42501', 'not_admin', 'teacher expire_orders raises not_admin');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a301","role":"authenticated"}', true);
select throws_ok($$select public.checkout()$$, '42501', 'not_student', 'admin checkout raises not_student');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","role":"authenticated"}', true);
select throws_ok($$select public.complete_order('00000000-0000-0000-0000-00000000a9ff')$$, '42501', 'not_staff',
  'student complete_order raises not_staff');
select throws_ok($$select public.cancel_order('00000000-0000-0000-0000-00000000a9ff')$$, '42501', 'not_staff',
  'student cancel_order raises not_staff');
select throws_ok($$select public.expire_orders()$$, '42501', 'not_admin', 'student expire_orders raises not_admin');
reset role;

-- empty cart ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a103","role":"authenticated"}', true);
select is(public.checkout(), '{"ok":false,"error_code":"cart_empty","order_id":null,"blocked":[]}'::jsonb,
  'empty cart -> cart_empty');
reset role;
select is((select count(*) from public.orders where student_id = '00000000-0000-0000-0000-00000000a103'), 0::bigint,
  'empty cart creates no order');

-- (ก) not enough points: ok=false, the blocking line is named, nothing changes -------------
insert into public.cart_items (student_id, reward_id, qty)
values ('00000000-0000-0000-0000-00000000a102', '00000000-0000-0000-0000-00000000a501', 1);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a102","role":"authenticated"}', true);
select is(public.checkout(),
  '{"ok":false,"error_code":"blocked","order_id":null,"blocked":[{"reward_id":null,"reason":"points","shortfall":20}]}'::jsonb,
  'not enough points -> blocked points with the shortfall (30 - 10)');
reset role;
select is((select count(*) from public.orders where student_id = '00000000-0000-0000-0000-00000000a102'), 0::bigint,
  'points block: no order');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a501'), 5, 'points block: stock unchanged');
select is((select qty from public.cart_items where student_id = '00000000-0000-0000-0000-00000000a102'), 1,
  'points block: cart unchanged');
select is((select count(*) from public.ledger_entries where student_id = '00000000-0000-0000-0000-00000000a102'), 1::bigint,
  'points block: no ledger row');
select is((select coalesce(sum(points), 0) from public.ledger_entries where student_id = '00000000-0000-0000-0000-00000000a102'),
  10::bigint, 'points block: balance unchanged');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000a102'), 0::bigint,
  'points block: no notification');

-- (ข) stock short (and an inactive line): the whole order fails ------------------------------
insert into public.cart_items (student_id, reward_id, qty) values
  ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a501', 1),
  ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a502', 2),
  ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a503', 1);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","role":"authenticated"}', true);
select is(public.checkout(),
  '{"ok":false,"error_code":"blocked","order_id":null,"blocked":[
     {"reward_id":"00000000-0000-0000-0000-00000000a502","reason":"stock","available":1},
     {"reward_id":"00000000-0000-0000-0000-00000000a503","reason":"inactive"}]}'::jsonb,
  'stock short and inactive lines are both named, in reward id order');
reset role;
select is((select count(*) from public.orders where student_id = '00000000-0000-0000-0000-00000000a101'), 0::bigint,
  'stock block: no order');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a501'), 5,
  'stock block: the line that fits keeps its stock');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a502'), 1, 'stock block: short stock unchanged');
select is((select count(*) from public.cart_items where student_id = '00000000-0000-0000-0000-00000000a101'), 3::bigint,
  'stock block: cart unchanged');
select is((select count(*) from public.ledger_entries where student_id = '00000000-0000-0000-0000-00000000a101'), 1::bigint,
  'stock block: no ledger row');

-- stock short and not enough points together
update public.cart_items set qty = 4 where student_id = '00000000-0000-0000-0000-00000000a101'
  and reward_id = '00000000-0000-0000-0000-00000000a501';
delete from public.cart_items where student_id = '00000000-0000-0000-0000-00000000a101'
  and reward_id = '00000000-0000-0000-0000-00000000a503';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","role":"authenticated"}', true);
select is(public.checkout(),
  '{"ok":false,"error_code":"blocked","order_id":null,"blocked":[
     {"reward_id":"00000000-0000-0000-0000-00000000a502","reason":"stock","available":1},
     {"reward_id":null,"reason":"points","shortfall":60}]}'::jsonb,
  'stock and points blocks are reported together (4 x 30 + 2 x 20 = 160, balance 100)');
reset role;

-- (ค) success ------------------------------------------------------------------------------
update public.cart_items set qty = 2 where student_id = '00000000-0000-0000-0000-00000000a101'
  and reward_id = '00000000-0000-0000-0000-00000000a501';
update public.cart_items set qty = 1 where student_id = '00000000-0000-0000-0000-00000000a101'
  and reward_id = '00000000-0000-0000-0000-00000000a502';
-- a cart line of another student is not touched
insert into public.cart_items (student_id, reward_id, qty)
values ('00000000-0000-0000-0000-00000000a103', '00000000-0000-0000-0000-00000000a501', 1);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","role":"authenticated"}', true);
insert into t_ids select 'o1', (r ->> 'order_id')::uuid from (select public.checkout() as r) s
where (r ->> 'ok')::boolean and jsonb_array_length(r -> 'blocked') = 0 and r ->> 'error_code' is null;
reset role;
select isnt((select id from t_ids where name = 'o1'), null, 'checkout returns ok with an order_id and no error');
select is((select status from public.orders where id = (select id from t_ids where name = 'o1')), 'pending_pickup',
  'order is pending_pickup');
select is((select student_id from public.orders where id = (select id from t_ids where name = 'o1')),
  '00000000-0000-0000-0000-00000000a101'::uuid, 'order belongs to the student');
select is((select total_points from public.orders where id = (select id from t_ids where name = 'o1')), 80,
  'total_points = 2 x 30 + 1 x 20');
select is((select expires_at - created_at from public.orders where id = (select id from t_ids where name = 'o1')),
  interval '7 days', 'expires_at = created_at + 7 days');
select is((select expires_at from public.orders where id = (select id from t_ids where name = 'o1')),
  now() + interval '7 days', 'expires_at = now() + 7 days');
select is((select unit_cost from public.order_items where order_id = (select id from t_ids where name = 'o1')
            and reward_id = '00000000-0000-0000-0000-00000000a501'), 30, 'unit_cost of r1 = its points_cost at checkout');
select is((select qty from public.order_items where order_id = (select id from t_ids where name = 'o1')
            and reward_id = '00000000-0000-0000-0000-00000000a501'), 2, 'qty of r1 copied from the cart');
select is((select unit_cost from public.order_items where order_id = (select id from t_ids where name = 'o1')
            and reward_id = '00000000-0000-0000-0000-00000000a502'), 20, 'unit_cost of r2 = its points_cost at checkout');
select is((select reward_name from public.order_items where order_id = (select id from t_ids where name = 'o1')
            and reward_id = '00000000-0000-0000-0000-00000000a501'), 'OD r1', 'reward_name of r1 = its name at checkout');
select is((select reward_name from public.order_items where order_id = (select id from t_ids where name = 'o1')
            and reward_id = '00000000-0000-0000-0000-00000000a502'), 'OD r2', 'reward_name of r2 = its name at checkout');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a501'), 3, 'r1 stock 5 - 2');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a502'), 0, 'r2 stock 1 - 1');
select is((select points from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o1') and kind = 'redeem'),
  -80, 'one redeem row of -total');
select is((select carbon_kg from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o1') and kind = 'redeem'),
  0::numeric, 'redeem carbon is 0');
select is((select created_by from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o1') and kind = 'redeem'),
  '00000000-0000-0000-0000-00000000a101'::uuid, 'redeem created_by is the student');
select is((select coalesce(sum(points), 0) from public.ledger_entries where student_id = '00000000-0000-0000-0000-00000000a101'),
  20::bigint, 'balance 100 - 80');
select is((select count(*) from public.cart_items where student_id = '00000000-0000-0000-0000-00000000a101'), 0::bigint,
  'the cart is empty');
select is((select count(*) from public.cart_items where student_id = '00000000-0000-0000-0000-00000000a103'), 1::bigint,
  'another student cart is untouched');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000a101'
            and type = 'order_created' and title = 'แลกของรางวัลสำเร็จ'
            and body like '%รับของได้ที่แผนกภายใน 7 วัน%'
            and link = '/orders/' || (select id from t_ids where name = 'o1')::text), 1::bigint,
  'student notified order_created with a link to the order');
select throws_ok($$insert into public.ledger_entries (student_id, kind, points, ref_order_id)
  select '00000000-0000-0000-0000-00000000a101', 'redeem', -1, id from t_ids where name = 'o1'$$,
  '23505', null, 'a second redeem row for the same order is refused');

-- RLS: owner and staff read the order, others do not; clients cannot write ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","role":"authenticated"}', true);
select is((select count(*) from public.order_items where order_id = (select id from t_ids where name = 'o1')), 2::bigint,
  'owner reads the order items');
select throws_ok($$insert into public.orders (student_id, total_points) values ('00000000-0000-0000-0000-00000000a101', 0)$$,
  '42501', null, 'student cannot insert an order');
select throws_ok($$insert into public.ledger_entries (student_id, kind, points) values ('00000000-0000-0000-0000-00000000a101', 'refund', 80)$$,
  '42501', null, 'student cannot insert a ledger row');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a102","role":"authenticated"}', true);
select is((select count(*) from public.orders where id = (select id from t_ids where name = 'o1')), 0::bigint,
  'another student cannot read the order');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a201","role":"authenticated"}', true);
select is((select count(*) from public.orders where id = (select id from t_ids where name = 'o1')), 1::bigint,
  'teacher reads the order');
reset role;

-- (ฉ) cancel_order restores stock and refunds once ----------------------------------------
-- rename, reprice and deactivate r1 after ordering: the order keeps what was ordered
update public.rewards set points_cost = 99, name = 'OD r1 renamed', active = false
where id = '00000000-0000-0000-0000-00000000a501';
select is((select reward_name from public.order_items where order_id = (select id from t_ids where name = 'o1')
            and reward_id = '00000000-0000-0000-0000-00000000a501'), 'OD r1', 'stored reward_name survives a rename');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","role":"authenticated"}', true);
select is((select reward_name from public.order_items where order_id = (select id from t_ids where name = 'o1')
            and reward_id = '00000000-0000-0000-0000-00000000a501'), 'OD r1',
  'the student still reads the ordered name of a now inactive reward');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a201","role":"authenticated"}', true);
select throws_ok($$select public.cancel_order('00000000-0000-0000-0000-00000000a9ff')$$, 'P0001', 'order_not_found',
  'cancel of an unknown order raises order_not_found');
select lives_ok($$select public.cancel_order((select id from t_ids where name = 'o1'))$$, 'teacher cancels the order');
select throws_ok($$select public.cancel_order((select id from t_ids where name = 'o1'))$$, 'P0001', 'order_not_pending',
  'a second cancel raises order_not_pending');
select throws_ok($$select public.complete_order((select id from t_ids where name = 'o1'))$$, 'P0001', 'order_not_pending',
  'complete of a cancelled order raises order_not_pending');
reset role;
select is((select status from public.orders where id = (select id from t_ids where name = 'o1')), 'cancelled', 'order is cancelled');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a501'), 5, 'cancel restores r1 stock');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a502'), 1, 'cancel restores r2 stock');
select is((select count(*) from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o1') and kind = 'refund'),
  1::bigint, 'exactly one refund row after two cancels');
select is((select points from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o1') and kind = 'refund'),
  80, 'refund = +total_points (not the new price)');
select is((select carbon_kg from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o1') and kind = 'refund'),
  0::numeric, 'refund carbon is 0');
select is((select created_by from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o1') and kind = 'refund'),
  '00000000-0000-0000-0000-00000000a201'::uuid, 'refund created_by is the teacher');
select is((select coalesce(sum(points), 0) from public.ledger_entries where student_id = '00000000-0000-0000-0000-00000000a101'),
  100::bigint, 'balance back to 100');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000a101'
            and type = 'order_cancelled' and link = '/orders/' || (select id from t_ids where name = 'o1')::text), 1::bigint,
  'student notified order_cancelled once');
select throws_ok($$insert into public.ledger_entries (student_id, kind, points, ref_order_id)
  select '00000000-0000-0000-0000-00000000a101', 'refund', 1, id from t_ids where name = 'o1'$$,
  '23505', null, 'a second refund row for the same order is refused');
update public.rewards set points_cost = 30, name = 'OD r1', active = true where id = '00000000-0000-0000-0000-00000000a501';

-- (ช) complete_order ------------------------------------------------------------------------
insert into public.cart_items (student_id, reward_id, qty)
values ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a501', 1);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","role":"authenticated"}', true);
insert into t_ids select 'o2', (r ->> 'order_id')::uuid from (select public.checkout() as r) s where (r ->> 'ok')::boolean;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a201","role":"authenticated"}', true);
select throws_ok($$select public.complete_order('00000000-0000-0000-0000-00000000a9ff')$$, 'P0001', 'order_not_found',
  'complete of an unknown order raises order_not_found');
select lives_ok($$select public.complete_order((select id from t_ids where name = 'o2'))$$, 'teacher completes the order');
select throws_ok($$select public.complete_order((select id from t_ids where name = 'o2'))$$, 'P0001', 'order_not_pending',
  'a second complete raises order_not_pending');
select throws_ok($$select public.cancel_order((select id from t_ids where name = 'o2'))$$, 'P0001', 'order_not_pending',
  'cancel of a completed order raises order_not_pending');
reset role;
select is((select status from public.orders where id = (select id from t_ids where name = 'o2')), 'completed', 'order is completed');
select is((select completed_by from public.orders where id = (select id from t_ids where name = 'o2')),
  '00000000-0000-0000-0000-00000000a201'::uuid, 'completed_by is the teacher');
select isnt((select completed_at from public.orders where id = (select id from t_ids where name = 'o2')), null, 'completed_at is set');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a501'), 4, 'complete keeps the stock taken');
select is((select count(*) from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o2') and kind = 'refund'),
  0::bigint, 'complete writes no refund');
-- defence in depth: the internal helper releases nothing that is not pending
select is(public.release_orders(array[(select id from t_ids where name = 'o2')], 'cancelled', null), 0,
  'release_orders on a completed order releases nothing');
select is((select status from public.orders where id = (select id from t_ids where name = 'o2')), 'completed',
  'release_orders leaves a completed order completed');
select is((select count(*) from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o2') and kind = 'refund')
          + (select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000a101'
              and type = 'order_cancelled' and link = '/orders/' || (select id from t_ids where name = 'o2')::text),
  0::bigint, 'release_orders on a completed order writes no refund and no notification');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000a101'
            and type = 'order_completed' and link = '/orders/' || (select id from t_ids where name = 'o2')::text), 1::bigint,
  'student notified order_completed');

-- (ฉ) expire_orders: past expires_at -> expired, refund once ----------------------------
insert into public.cart_items (student_id, reward_id, qty)
values ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a501', 2);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","role":"authenticated"}', true);
insert into t_ids select 'o3', (r ->> 'order_id')::uuid from (select public.checkout() as r) s where (r ->> 'ok')::boolean;
reset role;
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a501'), 2, 'o3 took 2 of r1');
-- not yet due: expire_orders leaves it alone
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a301","role":"authenticated"}', true);
select is(public.expire_orders(), 0, 'expire_orders skips an order that is not due');
reset role;
update public.orders set expires_at = now() - interval '1 minute' where id = (select id from t_ids where name = 'o3');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a201","role":"authenticated"}', true);
select throws_ok($$select public.complete_order((select id from t_ids where name = 'o3'))$$, 'P0001', 'order_expired',
  'complete after expires_at raises order_expired');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a301","role":"authenticated"}', true);
select is(public.expire_orders(), 1, 'admin expire_orders expires one order');
select is(public.expire_orders(), 0, 'a second run expires nothing');
reset role;
select is((select status from public.orders where id = (select id from t_ids where name = 'o3')), 'expired', 'order is expired');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a501'), 4, 'expire restores the stock');
select is((select count(*) from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o3') and kind = 'refund'),
  1::bigint, 'exactly one refund row after two runs');
select is((select points from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o3') and kind = 'refund'),
  60, 'expire refund = +total_points');
select is((select created_by from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o3') and kind = 'refund'),
  '00000000-0000-0000-0000-00000000a301'::uuid, 'refund created_by is the admin who pressed the button');
select is((select coalesce(sum(points), 0) from public.ledger_entries where student_id = '00000000-0000-0000-0000-00000000a101'),
  70::bigint, 'balance = 100 - 30 (completed o2)');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000a101'
            and type = 'order_expired' and link = '/orders/' || (select id from t_ids where name = 'o3')::text), 1::bigint,
  'student notified order_expired once');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a201","role":"authenticated"}', true);
select throws_ok($$select public.cancel_order((select id from t_ids where name = 'o3'))$$, 'P0001', 'order_not_pending',
  'cancel of an expired order raises order_not_pending');
reset role;

-- expire_orders with no user (pg_cron / internal) ------------------------------------------
insert into public.cart_items (student_id, reward_id, qty)
values ('00000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a502', 1);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","role":"authenticated"}', true);
insert into t_ids select 'o4', (r ->> 'order_id')::uuid from (select public.checkout() as r) s where (r ->> 'ok')::boolean;
reset role;
update public.orders set expires_at = now() - interval '1 minute' where id = (select id from t_ids where name = 'o4');
select set_config('request.jwt.claims', '', true);
select is(public.expire_orders(), 1, 'expire_orders with no user (pg_cron) expires the due order');
select is((select status from public.orders where id = (select id from t_ids where name = 'o4')), 'expired', 'o4 is expired');
select is((select stock from public.rewards where id = '00000000-0000-0000-0000-00000000a502'), 1, 'o4 stock restored');
select is((select created_by from public.ledger_entries where ref_order_id = (select id from t_ids where name = 'o4') and kind = 'refund'),
  null::uuid, 'refund by pg_cron has no created_by');
select is(public.expire_orders(), 0, 'pg_cron second run expires nothing');

select * from finish();
rollback;
