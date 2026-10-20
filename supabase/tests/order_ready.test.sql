-- Order "ready for pickup" step and the staff notification on checkout (owner decision 2026-10-21;
-- rulings R82, R83). orders.ready_at, mark_order_ready(uuid), checkout -> notify_staff('order_new').
-- Notification checks use per-user predicates, never global counts.
-- ids: students s1 ...b101 (100 points), s2 ...b102   teacher ...b201   admin ...b301
--   reward r1 ...b501 (10 points, stock 20)
begin;
select plan(50);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000b101', 'or-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000b102', 'or-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000b201', 'or-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000b301', 'or-ad@example.test', '{"full_name":"แอดมิน หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000b201';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000b301';
update public.profiles set display_name = 'ดิสเพลย์ หนึ่ง' where id = '00000000-0000-0000-0000-00000000b102';

insert into public.rewards (id, name, points_cost, stock, active)
values ('00000000-0000-0000-0000-00000000b501', 'OR r1', 10, 20, true);
insert into public.ledger_entries (student_id, kind, points, note) values
  ('00000000-0000-0000-0000-00000000b101', 'adjust', 100, 'test'),
  ('00000000-0000-0000-0000-00000000b102', 'adjust', 100, 'test');

-- Orders left by other runs must not be picked up by expire_orders below (rolled back at the end).
update public.orders set expires_at = now() + interval '1 day'
where status = 'pending_pickup' and expires_at <= now();

create temp table t_ids (name text primary key, id uuid);
grant all on t_ids to authenticated;

-- shape and privileges ----------------------------------------------------------------------
select has_column('public', 'orders', 'ready_at', 'orders.ready_at exists');
select col_is_null('public', 'orders', 'ready_at', 'orders.ready_at is nullable');
select col_type_is('public', 'orders', 'ready_at', 'timestamp with time zone', 'orders.ready_at is timestamptz');
select has_function('public', 'mark_order_ready', array['uuid'], 'mark_order_ready(uuid) exists');
select is_definer('public', 'mark_order_ready', array['uuid'], 'mark_order_ready is security definer');
select function_returns('public', 'mark_order_ready', array['uuid'], 'void', 'mark_order_ready returns void');
select ok(not has_function_privilege('anon', 'public.mark_order_ready(uuid)', 'execute'), 'anon cannot execute mark_order_ready');
select ok(has_function_privilege('authenticated', 'public.mark_order_ready(uuid)', 'execute'), 'authenticated can execute mark_order_ready');
select ok(has_function_privilege('service_role', 'public.mark_order_ready(uuid)', 'execute'), 'service_role can execute mark_order_ready');
select is((select p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'mark_order_ready'), array['search_path=""'],
  'mark_order_ready has an empty search_path');
select ok(not exists (select 1 from pg_constraint where conrelid = 'public.orders'::regclass and contype = 'c'
                        and pg_get_constraintdef(oid) like '%ready%'),
  'no new status value: the status check does not mention ready');

-- checkout notifies the staff (R83) ---------------------------------------------------------
insert into public.cart_items (student_id, reward_id, qty) values
  ('00000000-0000-0000-0000-00000000b101', '00000000-0000-0000-0000-00000000b501', 3);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b101","role":"authenticated"}', true);
insert into t_ids select 'o1', (r ->> 'order_id')::uuid from (select public.checkout() as r) s where (r ->> 'ok')::boolean;
reset role;
select isnt((select id from t_ids where name = 'o1'), null, 'checkout of s1 succeeds');
select is((select ready_at from public.orders where id = (select id from t_ids where name = 'o1')), null, 'a new order is not ready');
select is((select status from public.orders where id = (select id from t_ids where name = 'o1')), 'pending_pickup', 'a new order is pending_pickup');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000b201'
            and type = 'order_new' and title = 'มีออเดอร์ใหม่' and link = '/staff/orders?q=' || upper(left((select id from t_ids where name = 'o1')::text, 8))
            and body = 'นักเรียน หนึ่ง 3 ชิ้น รวม 30 แต้ม'), 1::bigint,
  'the teacher gets one order_new (full_name, 3 pieces, 30 points, link /staff/orders?q=<order number>, 0016)');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000b301'
            and type = 'order_new' and body = 'นักเรียน หนึ่ง 3 ชิ้น รวม 30 แต้ม' and link = '/staff/orders?q=' || upper(left((select id from t_ids where name = 'o1')::text, 8))), 1::bigint,
  'the admin gets one order_new');
select is((select count(*) from public.profiles p where p.role in ('teacher', 'admin')
            and (select count(*) from public.notifications n where n.user_id = p.id and n.type = 'order_new'
                   and n.body = 'นักเรียน หนึ่ง 3 ชิ้น รวม 30 แต้ม') <> 1), 0::bigint,
  'every staff profile got exactly one order_new for this order');
select is((select count(*) from public.notifications where user_id in
            ('00000000-0000-0000-0000-00000000b101', '00000000-0000-0000-0000-00000000b102') and type = 'order_new'), 0::bigint,
  'students get no order_new');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000b101'
            and type = 'order_created'), 1::bigint, 'the student still gets order_created');

-- a student with a display_name is named by it
insert into public.cart_items (student_id, reward_id, qty) values
  ('00000000-0000-0000-0000-00000000b102', '00000000-0000-0000-0000-00000000b501', 1);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b102","role":"authenticated"}', true);
insert into t_ids select 'o2', (r ->> 'order_id')::uuid from (select public.checkout() as r) s where (r ->> 'ok')::boolean;
reset role;
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000b201'
            and type = 'order_new' and body = 'ดิสเพลย์ หนึ่ง 1 ชิ้น รวม 10 แต้ม'), 1::bigint,
  'the staff body uses display_name when set');

-- a blocked checkout notifies nobody
insert into public.cart_items (student_id, reward_id, qty) values
  ('00000000-0000-0000-0000-00000000b102', '00000000-0000-0000-0000-00000000b501', 50);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b102","role":"authenticated"}', true);
select is((public.checkout() ->> 'ok')::boolean, false, 'an over-stock checkout is blocked');
reset role;
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000b201'
            and type = 'order_new' and body like 'ดิสเพลย์ หนึ่ง%'), 1::bigint, 'a blocked checkout sends no order_new');
delete from public.cart_items where student_id = '00000000-0000-0000-0000-00000000b102';

-- mark_order_ready: who may call ------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
select throws_ok($$select public.mark_order_ready((select id from t_ids where name = 'o1'))$$, '42501', 'not_authenticated',
  'no user: not_authenticated');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.mark_order_ready((select id from t_ids where name = 'o1'))$$, '42501', 'not_authenticated',
  'authenticated without sub: not_authenticated');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b101","role":"authenticated"}', true);
select throws_ok($$select public.mark_order_ready((select id from t_ids where name = 'o1'))$$, '42501', 'not_staff',
  'student (even the owner): not_staff');
reset role;
set local role anon;
select throws_ok($$select public.mark_order_ready('00000000-0000-0000-0000-00000000b9ff')$$, '42501', null, 'anon: 42501');
reset role;
select is((select ready_at from public.orders where id = (select id from t_ids where name = 'o1')), null,
  'refused calls leave ready_at null');

-- mark_order_ready: success -----------------------------------------------------------------
update public.orders set updated_at = now() - interval '1 hour' where id = (select id from t_ids where name = 'o1');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b201","role":"authenticated"}', true);
select lives_ok($$select public.mark_order_ready((select id from t_ids where name = 'o1'))$$, 'teacher marks the order ready');
reset role;
select is((select ready_at from public.orders where id = (select id from t_ids where name = 'o1')), now(), 'ready_at = now()');
select ok((select updated_at from public.orders where id = (select id from t_ids where name = 'o1')) > now() - interval '5 minutes', 'updated_at moved to now (was an hour old)');
select is((select status from public.orders where id = (select id from t_ids where name = 'o1')), 'pending_pickup',
  'status stays pending_pickup');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000b101'
            and type = 'order_ready' and title = 'ของรางวัลพร้อมรับแล้ว'
            and link = '/orders/' || (select id from t_ids where name = 'o1')::text
            and body ~ '^รับได้ที่แผนกก่อน \d{2}/\d{2}/25\d{2} \d{2}:\d{2}'), 1::bigint,
  'the student gets one order_ready with a Thai deadline and a link to the order');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000b102'
            and type = 'order_ready'), 0::bigint, 'another student gets no order_ready');
select is((select count(*) from public.notifications where user_id in
            ('00000000-0000-0000-0000-00000000b201', '00000000-0000-0000-0000-00000000b301') and type = 'order_ready'), 0::bigint,
  'staff get no order_ready');

-- second call -------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b301","role":"authenticated"}', true);
select throws_ok($$select public.mark_order_ready((select id from t_ids where name = 'o1'))$$, 'P0001', 'order_already_ready',
  'second call (admin): order_already_ready');
select throws_ok($$select public.mark_order_ready('00000000-0000-0000-0000-00000000b9ff')$$, 'P0001', 'order_not_found',
  'unknown order: order_not_found');
reset role;
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000b101'
            and type = 'order_ready'), 1::bigint, 'the failed second call sent nothing');

-- completed / cancelled / expired ------------------------------------------------------------
insert into public.orders (id, student_id, status, total_points, completed_by, completed_at) values
  ('00000000-0000-0000-0000-00000000b701', '00000000-0000-0000-0000-00000000b101', 'completed', 0, '00000000-0000-0000-0000-00000000b201', now());
insert into public.orders (id, student_id, status, total_points) values
  ('00000000-0000-0000-0000-00000000b702', '00000000-0000-0000-0000-00000000b101', 'cancelled', 0);
insert into public.orders (id, student_id, status, total_points, expires_at) values
  ('00000000-0000-0000-0000-00000000b703', '00000000-0000-0000-0000-00000000b101', 'pending_pickup', 0, now() - interval '1 minute');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b201","role":"authenticated"}', true);
select throws_ok($$select public.mark_order_ready('00000000-0000-0000-0000-00000000b701')$$, 'P0001', 'order_not_pending', 'completed: order_not_pending');
select throws_ok($$select public.mark_order_ready('00000000-0000-0000-0000-00000000b702')$$, 'P0001', 'order_not_pending', 'cancelled: order_not_pending');
select throws_ok($$select public.mark_order_ready('00000000-0000-0000-0000-00000000b703')$$, 'P0001', 'order_expired', 'past expires_at: order_expired');
reset role;
select is((select count(*) from public.orders where id in ('00000000-0000-0000-0000-00000000b701',
            '00000000-0000-0000-0000-00000000b702', '00000000-0000-0000-0000-00000000b703') and ready_at is not null), 0::bigint,
  'refused calls set no ready_at');

-- complete / cancel / expire keep working ------------------------------------------------------
insert into public.orders (id, student_id, status, total_points) values
  ('00000000-0000-0000-0000-00000000b704', '00000000-0000-0000-0000-00000000b101', 'pending_pickup', 0),
  ('00000000-0000-0000-0000-00000000b705', '00000000-0000-0000-0000-00000000b101', 'pending_pickup', 0),
  ('00000000-0000-0000-0000-00000000b706', '00000000-0000-0000-0000-00000000b101', 'pending_pickup', 0);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b201","role":"authenticated"}', true);
select lives_ok($$select public.complete_order((select id from t_ids where name = 'o1'))$$, 'complete_order works after ready');
select lives_ok($$select public.complete_order('00000000-0000-0000-0000-00000000b704')$$, 'complete_order works without ready');
select public.mark_order_ready('00000000-0000-0000-0000-00000000b705');
select lives_ok($$select public.cancel_order('00000000-0000-0000-0000-00000000b705')$$, 'cancel_order works after ready');
select public.mark_order_ready('00000000-0000-0000-0000-00000000b706');
reset role;
select is((select status from public.orders where id = (select id from t_ids where name = 'o1')), 'completed', 'o1 completed');
select isnt((select ready_at from public.orders where id = (select id from t_ids where name = 'o1')), null, 'o1 keeps its ready_at');
select is((select status from public.orders where id = '00000000-0000-0000-0000-00000000b704'), 'completed', 'unready order completed');
update public.orders set expires_at = now() - interval '1 minute' where id = '00000000-0000-0000-0000-00000000b706';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b301","role":"authenticated"}', true);
select lives_ok($$select public.expire_orders()$$, 'expire_orders runs with ready orders around');
reset role;
select is((select status from public.orders where id = '00000000-0000-0000-0000-00000000b706'), 'expired', 'a ready order expires');
select is((select status from public.orders where id = '00000000-0000-0000-0000-00000000b703'), 'expired', 'an unready order expires');

select * from finish();
rollback;
