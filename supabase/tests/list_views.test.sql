-- Redesign 4 (DESIGN-4 7.3): my_submission_list, my_order_list, staff_activity_list, staff_order_list.
-- ids: students ...5d11 (A) ...5d12 (B), teacher ...5d21
begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000005d11', 'lv-a@example.test', '{"full_name":"LV เอ"}'::jsonb),
  ('00000000-0000-0000-0000-000000005d12', 'lv-b@example.test', '{"full_name":"LV บี"}'::jsonb),
  ('00000000-0000-0000-0000-000000005d21', 'lv-t@example.test', '{"full_name":"LV ครู"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000005d21';
update public.profiles set display_name = '   ' where id = '00000000-0000-0000-0000-000000005d12';

insert into public.activities (id, title, starts_at, ends_at, status, type, unit_points) values
  ('00000000-0000-0000-0000-000000005e01', 'LV waste', now() - interval '1 hour', now() + interval '1 day', 'open', 'waste', 0),
  ('00000000-0000-0000-0000-000000005e02', 'LV trees', now() - interval '1 hour', now() + interval '1 day', 'open', 'trees', 5);
insert into public.participations (activity_id, student_id) values
  ('00000000-0000-0000-0000-000000005e01', '00000000-0000-0000-0000-000000005d11'),
  ('00000000-0000-0000-0000-000000005e01', '00000000-0000-0000-0000-000000005d12');

insert into public.submissions (id, activity_id, student_id, status, created_at) values
  ('00000000-0000-0000-0000-000000005f01', '00000000-0000-0000-0000-000000005e01', '00000000-0000-0000-0000-000000005d11', 'approved', now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-000000005f02', '00000000-0000-0000-0000-000000005e01', '00000000-0000-0000-0000-000000005d11', 'pending', now() - interval '2 minutes'),
  ('00000000-0000-0000-0000-000000005f03', '00000000-0000-0000-0000-000000005e02', '00000000-0000-0000-0000-000000005d11', 'rejected', now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000005f04', '00000000-0000-0000-0000-000000005e01', '00000000-0000-0000-0000-000000005d12', 'approved', now());
insert into public.submission_items (submission_id, waste_category_id, quantity) values
  ('00000000-0000-0000-0000-000000005f01', (select id from public.waste_categories order by name, id limit 1), 1000),
  ('00000000-0000-0000-0000-000000005f01', (select id from public.waste_categories order by name, id limit 1 offset 1), 500),
  ('00000000-0000-0000-0000-000000005f02', (select id from public.waste_categories order by name, id limit 1), 100),
  ('00000000-0000-0000-0000-000000005f03', null, 4),
  ('00000000-0000-0000-0000-000000005f04', (select id from public.waste_categories order by name, id limit 1), 700);
insert into public.ledger_entries (student_id, kind, points, carbon_kg, ref_submission_id) values
  ('00000000-0000-0000-0000-000000005d11', 'earn', 20, 1, '00000000-0000-0000-0000-000000005f01'),
  ('00000000-0000-0000-0000-000000005d12', 'earn', 7, 1, '00000000-0000-0000-0000-000000005f04');

insert into public.rewards (id, name, points_cost, stock, active) values
  ('00000000-0000-0000-0000-000000005a01', 'LV Alpha', 5, 10, true),
  ('00000000-0000-0000-0000-000000005a02', 'LV Beta', 5, 10, true);
insert into public.orders (id, student_id, status, total_points, ready_at, created_at) values
  ('00000000-0000-0000-0000-000000005a11', '00000000-0000-0000-0000-000000005d11', 'pending_pickup', 10, null, now() - interval '4 minutes'),
  ('00000000-0000-0000-0000-000000005a12', '00000000-0000-0000-0000-000000005d11', 'pending_pickup', 5, now(), now() - interval '3 minutes'),
  ('00000000-0000-0000-0000-000000005a13', '00000000-0000-0000-0000-000000005d11', 'completed', 5, null, now() - interval '2 minutes'),
  ('00000000-0000-0000-0000-000000005a14', '00000000-0000-0000-0000-000000005d11', 'cancelled', 5, null, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000005a15', '00000000-0000-0000-0000-000000005d12', 'pending_pickup', 5, null, now());
insert into public.order_items (order_id, reward_id, reward_name, qty, unit_cost) values
  ('00000000-0000-0000-0000-000000005a11', '00000000-0000-0000-0000-000000005a01', 'LV Alpha', 1, 5),
  ('00000000-0000-0000-0000-000000005a11', '00000000-0000-0000-0000-000000005a02', 'LV Beta', 1, 5),
  ('00000000-0000-0000-0000-000000005a12', '00000000-0000-0000-0000-000000005a01', 'LV Alpha', 1, 5);

select is((select count(*)::int from pg_class
           where relnamespace = 'public'::regnamespace
             and relname in ('my_submission_list', 'my_order_list', 'staff_activity_list', 'staff_order_list')
             and reloptions @> array['security_invoker=true']), 4, 'all four views have security_invoker on');

-- student A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005d11","role":"authenticated"}', true);
select is((select count(*)::int from public.my_submission_list where student_id <> '00000000-0000-0000-0000-000000005d11')
          || '/' || (select count(*)::int from public.my_submission_list), '0/3', 'A sees only own rows in my_submission_list');
select is((select count(*)::int from public.my_order_list where student_id <> '00000000-0000-0000-0000-000000005d11')
          || '/' || (select count(*)::int from public.my_order_list), '0/4', 'A sees only own rows in my_order_list');
select is((select points from public.my_submission_list where id = '00000000-0000-0000-0000-000000005f01')::text
          || '/' || coalesce((select points from public.my_submission_list where id = '00000000-0000-0000-0000-000000005f02')::text, 'null'),
  '20/null', 'points is the earn sum for approved and null for pending');
select is((select grams from public.my_submission_list where id = '00000000-0000-0000-0000-000000005f01'), 1500::bigint,
  'grams = 1000 + 500 for a waste submission');
select is((select grams from public.my_submission_list where id = '00000000-0000-0000-0000-000000005f03') is null
          and (select trees from public.my_submission_list where id = '00000000-0000-0000-0000-000000005f03') = 4
          and (select trees from public.my_submission_list where id = '00000000-0000-0000-0000-000000005f01') is null, true,
  'trees submission has grams null and trees = 4');
select is((select string_agg(status_rank::text, '' order by status_rank) from public.my_submission_list
           where id in ('00000000-0000-0000-0000-000000005f01', '00000000-0000-0000-0000-000000005f02', '00000000-0000-0000-0000-000000005f03')),
  '123', 'status_rank is 1 pending, 2 approved, 3 rejected');
select is((select item_names like '%LV Alpha%' and item_names like '%LV Beta%' from public.my_order_list
           where id = '00000000-0000-0000-0000-000000005a11'), true, 'item_names contains both reward names');
select is((select count(*)::int from public.staff_order_list where student_id <> '00000000-0000-0000-0000-000000005d11')
          || '/' || (select count(*)::int from public.staff_order_list), '0/4', 'a student gets only own rows from staff_order_list');
reset role;

-- teacher
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005d21","role":"authenticated"}', true);
select is((select participant_count from public.staff_activity_list where id = '00000000-0000-0000-0000-000000005e01'), 2::bigint,
  'participant_count is 2 after two joins');
select is((select string_agg(status_group, ',' order by created_at) from public.staff_order_list
           where student_id = '00000000-0000-0000-0000-000000005d11'),
  'preparing,ready,completed,closed', 'status_group across the four states');
select is((select buyer_name from public.staff_order_list where id = '00000000-0000-0000-0000-000000005a15'), 'LV บี',
  'blank display_name falls back to full_name');
reset role;

select * from finish();
rollback;
