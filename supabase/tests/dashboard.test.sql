-- student_waste_totals (Task 11, R52): approved waste grams per student and category.
-- ids: students 6101, 6102; teacher 6201; activities waste 6501, trees 6502, fixed 6503
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000006101', 'dw-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000006102', 'dw-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000006201', 'dw-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000006201';

insert into public.activities (id, title, starts_at, ends_at, status, type, unit_points, unit_carbon_kg) values
  ('00000000-0000-0000-0000-000000006501', 'DW waste', now() - interval '1 hour', now() + interval '1 day', 'open', 'waste', 0, null),
  ('00000000-0000-0000-0000-000000006502', 'DW trees', now() - interval '1 hour', now() + interval '1 day', 'open', 'trees', 5, 2.5),
  ('00000000-0000-0000-0000-000000006503', 'DW fixed', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', 10, null);

insert into public.submissions (id, activity_id, student_id, status) values
  ('00000000-0000-0000-0000-000000006601', '00000000-0000-0000-0000-000000006501', '00000000-0000-0000-0000-000000006101', 'approved'),
  ('00000000-0000-0000-0000-000000006602', '00000000-0000-0000-0000-000000006501', '00000000-0000-0000-0000-000000006101', 'approved'),
  ('00000000-0000-0000-0000-000000006603', '00000000-0000-0000-0000-000000006501', '00000000-0000-0000-0000-000000006101', 'pending'),
  ('00000000-0000-0000-0000-000000006604', '00000000-0000-0000-0000-000000006501', '00000000-0000-0000-0000-000000006101', 'rejected'),
  ('00000000-0000-0000-0000-000000006605', '00000000-0000-0000-0000-000000006502', '00000000-0000-0000-0000-000000006101', 'approved'),
  ('00000000-0000-0000-0000-000000006606', '00000000-0000-0000-0000-000000006503', '00000000-0000-0000-0000-000000006101', 'approved'),
  ('00000000-0000-0000-0000-000000006607', '00000000-0000-0000-0000-000000006501', '00000000-0000-0000-0000-000000006102', 'approved');
insert into public.submission_items (submission_id, waste_category_id, quantity) values
  ('00000000-0000-0000-0000-000000006601', (select id from public.waste_categories where name = 'พลาสติก'), 1500),
  ('00000000-0000-0000-0000-000000006602', (select id from public.waste_categories where name = 'พลาสติก'), 50),
  ('00000000-0000-0000-0000-000000006602', (select id from public.waste_categories where name = 'กระดาษ'), 300),
  ('00000000-0000-0000-0000-000000006603', (select id from public.waste_categories where name = 'โลหะ/แก้ว'), 900),
  ('00000000-0000-0000-0000-000000006604', (select id from public.waste_categories where name = 'โลหะ/แก้ว'), 800),
  ('00000000-0000-0000-0000-000000006605', null, 4),
  ('00000000-0000-0000-0000-000000006606', null, 1),
  ('00000000-0000-0000-0000-000000006607', (select id from public.waste_categories where name = 'กระดาษ'), 700);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006101","role":"authenticated"}', true);
select is((select grams from public.student_waste_totals where category_name = 'พลาสติก'), 1550::bigint,
  'approved waste items of one category are summed');
select is((select grams from public.student_waste_totals where category_name = 'กระดาษ'), 300::bigint, 'second category');
select is((select count(*) from public.student_waste_totals), 2::bigint,
  'pending, rejected, trees and fixed rows are excluded');
select is((select count(*) from public.student_waste_totals where student_id <> '00000000-0000-0000-0000-000000006101'),
  0::bigint, 'a student sees only their own totals');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006102","role":"authenticated"}', true);
select is((select grams from public.student_waste_totals), 700::bigint, 'another student sees their own total');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006201","role":"authenticated"}', true);
select is((select count(*) from public.student_waste_totals
            where student_id in ('00000000-0000-0000-0000-000000006101', '00000000-0000-0000-0000-000000006102')),
  3::bigint, 'staff see every student''s totals');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006201","role":"authenticated"}', true);
select ok(has_table_privilege('authenticated', 'public.student_waste_totals', 'select'), 'authenticated may select');
reset role;

select ok(not has_table_privilege('anon', 'public.student_waste_totals', 'select'), 'anon has no select privilege');
set local role anon;
select throws_ok($$select * from public.student_waste_totals$$, '42501', null, 'anon cannot read the view');
reset role;

select * from finish();
rollback;
