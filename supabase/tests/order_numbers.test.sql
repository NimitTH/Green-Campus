-- Round 6 (old-site features 3): ORD-YYYYMMDD-NNNN order numbers (Bangkok day, per-day counter).
-- Far-future days (2031) for next_order_no so counters from real orders never interfere.
-- ids: student ...6011, teacher ...6021; reward ...6051
begin;
select plan(16);

-- the numbering function ---------------------------------------------------------------------------------------
select is(public.next_order_no('2031-03-14 10:00+07'), 'ORD-20310314-0001', 'the first number of a day is 0001');
select is(public.next_order_no('2031-03-14 23:59+07'), 'ORD-20310314-0002', 'the next one on the same day is 0002');
select is(public.next_order_no('2031-03-14 16:59:59+00'), 'ORD-20310314-0003', '16:59:59 UTC is still the 14th in Bangkok');
select is(public.next_order_no('2031-03-14 17:00:00+00'), 'ORD-20310315-0001', '17:00 UTC is the 15th in Bangkok: a new day, a new counter');
update public.order_day_counters set last_no = 9999 where day = '2031-03-15';
select is(public.next_order_no('2031-03-15 12:00+07'), 'ORD-20310315-10000', 'past 9999 the number grows longer');

-- schema ------------------------------------------------------------------------------------------------------------
select col_not_null('public', 'orders', 'order_no', 'orders.order_no is not null');
select col_is_unique('public', 'orders', 'order_no', 'orders.order_no is unique');
select is((select count(*) from public.orders where order_no !~ '^ORD-[0-9]{8}-[0-9]{4,}$'), 0::bigint,
  'every existing order (backfilled) has the format');
select has_column('public', 'my_order_list', 'order_no', 'my_order_list exposes order_no');
select has_column('public', 'staff_order_list', 'order_no', 'staff_order_list exposes order_no');

-- privileges ---------------------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000006011', 'on-s@example.test', '{"full_name":"ON นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-000000006021', 'on-t@example.test', '{"full_name":"ON ครู"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000006021';
insert into public.rewards (id, name, points_cost, stock, active) values
  ('00000000-0000-0000-0000-000000006051', 'ON r1', 10, 5, true);
insert into public.ledger_entries (student_id, kind, points, note) values
  ('00000000-0000-0000-0000-000000006011', 'adjust', 100, 'test');
insert into public.cart_items (student_id, reward_id, qty) values
  ('00000000-0000-0000-0000-000000006011', '00000000-0000-0000-0000-000000006051', 2);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006011","role":"authenticated"}', true);
select throws_ok($$select public.next_order_no(now())$$, '42501', null, 'authenticated cannot call next_order_no');
select throws_ok($$select * from public.order_day_counters$$, '42501', null, 'authenticated cannot read the counters');

-- checkout ---------------------------------------------------------------------------------------------------------
select set_config('t.order', (public.checkout() ->> 'order_id'), true);
select set_config('t.no', (select order_no from public.my_order_list where id = current_setting('t.order')::uuid), true);
reset role;

select ok(current_setting('t.no') ~ ('^ORD-' || to_char((now() at time zone 'Asia/Bangkok')::date, 'YYYYMMDD') || '-[0-9]{4,}$'),
  'checkout sets an order number of today (Bangkok)');
select is((select body from public.notifications
           where user_id = '00000000-0000-0000-0000-000000006011' and type = 'order_created'),
  'ออเดอร์ ' || current_setting('t.no') || ' 2 ชิ้น รวม 20 แต้ม รับของได้ที่แผนกภายใน 7 วัน', 'order_created names the new number');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006021","role":"authenticated"}', true);
select public.complete_order(current_setting('t.order')::uuid);
select is((select order_no from public.staff_order_list where id = current_setting('t.order')::uuid), current_setting('t.no'),
  'staff see the same number');
reset role;
select is((select body from public.notifications
           where user_id = '00000000-0000-0000-0000-000000006011' and type = 'order_completed'),
  'ออเดอร์ ' || current_setting('t.no') || ' รับของเรียบร้อยแล้ว', 'order_completed names the new number');

select * from finish();
rollback;
