-- report_activities / report_students and waste_categories.code (Task 16, R102-R107, migration 0018).
-- The local DB may hold e2e leftovers, so every range below is a far-future window (May/July 2033)
-- or the year 2001 where only this test's rows exist.
-- ids: students ...e101 (A), ...e102 (B), ...e103 (C), teacher ...e201;
--   activities ...e501 waste, ...e502 trees, ...e503 fixed, ...e504 draft, ...e505 boundary, ...e506 empty,
--   ...e507 open (not ended), ...e508 ended by time (2001)
begin;
select plan(41);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000e101', 'rp-a@example.test', '{"full_name":"RP A นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-00000000e102', 'rp-b@example.test', '{"full_name":"RP B นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-00000000e103', 'rp-c@example.test', '{"full_name":"RP C นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-00000000e201', 'rp-t@example.test', '{"full_name":"RP ครู"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000e201';

insert into public.activities (id, title, starts_at, ends_at, status, type, unit_points, unit_carbon_kg) values
  ('00000000-0000-0000-0000-00000000e501', 'R waste', '2033-05-01 00:00+00', '2033-05-10 05:00+00', 'closed', 'waste', 0, null),
  ('00000000-0000-0000-0000-00000000e502', 'R trees', '2033-05-01 00:00+00', '2033-05-11 05:00+00', 'closed', 'trees', 5, 2.5),
  ('00000000-0000-0000-0000-00000000e503', 'R fixed', '2033-05-01 00:00+00', '2033-05-12 05:00+00', 'closed', 'fixed', 10, null),
  ('00000000-0000-0000-0000-00000000e504', 'R draft', '2033-05-01 00:00+00', '2033-05-13 05:00+00', 'draft', 'fixed', 10, null),
  ('00000000-0000-0000-0000-00000000e505', 'R boundary', '2033-06-01 00:00+00', '2033-06-30 17:30+00', 'closed', 'fixed', 10, null),
  ('00000000-0000-0000-0000-00000000e506', 'R empty', '2033-05-01 00:00+00', '2033-05-15 05:00+00', 'closed', 'fixed', 10, null),
  ('00000000-0000-0000-0000-00000000e507', 'R open', '2033-05-01 00:00+00', '2033-05-14 05:00+00', 'open', 'fixed', 10, null),
  ('00000000-0000-0000-0000-00000000e508', 'R past', '2001-02-01 00:00+00', '2001-03-04 05:00+00', 'open', 'fixed', 10, null);

insert into public.participations (activity_id, student_id) values
  ('00000000-0000-0000-0000-00000000e501', '00000000-0000-0000-0000-00000000e101'),
  ('00000000-0000-0000-0000-00000000e501', '00000000-0000-0000-0000-00000000e102'),
  ('00000000-0000-0000-0000-00000000e506', '00000000-0000-0000-0000-00000000e103');

insert into public.submissions (id, activity_id, student_id, status, reviewed_at) values
  ('00000000-0000-0000-0000-00000000e601', '00000000-0000-0000-0000-00000000e501', '00000000-0000-0000-0000-00000000e101', 'approved', '2033-06-20 05:00+00'),
  ('00000000-0000-0000-0000-00000000e602', '00000000-0000-0000-0000-00000000e501', '00000000-0000-0000-0000-00000000e102', 'approved', '2033-05-09 05:00+00'),
  ('00000000-0000-0000-0000-00000000e603', '00000000-0000-0000-0000-00000000e501', '00000000-0000-0000-0000-00000000e101', 'pending', null),
  ('00000000-0000-0000-0000-00000000e604', '00000000-0000-0000-0000-00000000e501', '00000000-0000-0000-0000-00000000e102', 'rejected', null),
  ('00000000-0000-0000-0000-00000000e605', '00000000-0000-0000-0000-00000000e502', '00000000-0000-0000-0000-00000000e101', 'approved', '2033-05-10 05:00+00'),
  ('00000000-0000-0000-0000-00000000e606', '00000000-0000-0000-0000-00000000e502', '00000000-0000-0000-0000-00000000e102', 'approved', '2033-05-10 05:00+00'),
  ('00000000-0000-0000-0000-00000000e607', '00000000-0000-0000-0000-00000000e503', '00000000-0000-0000-0000-00000000e101', 'approved', '2033-05-10 05:00+00'),
  ('00000000-0000-0000-0000-00000000e608', '00000000-0000-0000-0000-00000000e504', '00000000-0000-0000-0000-00000000e103', 'approved', '2033-05-10 05:00+00'),
  ('00000000-0000-0000-0000-00000000e609', '00000000-0000-0000-0000-00000000e507', '00000000-0000-0000-0000-00000000e103', 'approved', '2033-05-10 05:00+00'),
  ('00000000-0000-0000-0000-00000000e610', '00000000-0000-0000-0000-00000000e505', '00000000-0000-0000-0000-00000000e102', 'approved', '2033-06-10 05:00+00'),
  ('00000000-0000-0000-0000-00000000e611', '00000000-0000-0000-0000-00000000e508', '00000000-0000-0000-0000-00000000e102', 'approved', '2001-03-01 05:00+00');

insert into public.submission_items (submission_id, waste_category_id, quantity) values
  ('00000000-0000-0000-0000-00000000e601', (select id from public.waste_categories where code = 'plastic'), 1500),
  ('00000000-0000-0000-0000-00000000e601', (select id from public.waste_categories where code = 'paper'), 500),
  ('00000000-0000-0000-0000-00000000e602', (select id from public.waste_categories where code = 'metal_glass'), 250),
  ('00000000-0000-0000-0000-00000000e602', (select id from public.waste_categories where code = 'other'), 100),
  ('00000000-0000-0000-0000-00000000e603', (select id from public.waste_categories where code = 'plastic'), 999),
  ('00000000-0000-0000-0000-00000000e604', (select id from public.waste_categories where code = 'paper'), 999),
  ('00000000-0000-0000-0000-00000000e605', null, 3),
  ('00000000-0000-0000-0000-00000000e606', null, 4);

-- earn rows are the source of points/carbon; adjust and redeem rows that point at a submission never count
insert into public.ledger_entries (student_id, kind, points, carbon_kg, ref_submission_id) values
  ('00000000-0000-0000-0000-00000000e101', 'earn', 20, 2.5, '00000000-0000-0000-0000-00000000e601'),
  ('00000000-0000-0000-0000-00000000e102', 'earn', 5, 0.3, '00000000-0000-0000-0000-00000000e602'),
  ('00000000-0000-0000-0000-00000000e101', 'earn', 15, 7.5, '00000000-0000-0000-0000-00000000e605'),
  ('00000000-0000-0000-0000-00000000e102', 'earn', 20, 10, '00000000-0000-0000-0000-00000000e606'),
  ('00000000-0000-0000-0000-00000000e101', 'earn', 10, 0, '00000000-0000-0000-0000-00000000e607'),
  ('00000000-0000-0000-0000-00000000e103', 'earn', 99, 99, '00000000-0000-0000-0000-00000000e608'),
  ('00000000-0000-0000-0000-00000000e103', 'earn', 98, 98, '00000000-0000-0000-0000-00000000e609'),
  ('00000000-0000-0000-0000-00000000e102', 'earn', 10, 0, '00000000-0000-0000-0000-00000000e610'),
  ('00000000-0000-0000-0000-00000000e102', 'earn', 10, 0, '00000000-0000-0000-0000-00000000e611'),
  ('00000000-0000-0000-0000-00000000e101', 'adjust', 100, 9, '00000000-0000-0000-0000-00000000e601'),
  ('00000000-0000-0000-0000-00000000e101', 'redeem', -50, 0, '00000000-0000-0000-0000-00000000e601');

-- 1-8: signatures and grants ----------------------------------------------------------------------------
select has_column('public', 'waste_categories', 'code', 'waste_categories.code exists');
select col_not_null('public', 'waste_categories', 'code', 'code is not null');
select is((select array_agg(code order by code) from public.waste_categories where code in ('plastic', 'paper', 'metal_glass', 'other')),
  array['metal_glass', 'other', 'paper', 'plastic'], 'the four seed rows have their codes');
select has_function('public', 'report_activities', array['date', 'date'], 'report_activities(date, date) exists');
select has_function('public', 'report_students', array['date', 'date'], 'report_students(date, date) exists');
select ok(not has_function_privilege('anon', 'public.report_activities(date, date)', 'execute'), 'anon cannot execute report_activities');
select ok(not has_function_privilege('anon', 'public.report_students(date, date)', 'execute'), 'anon cannot execute report_students');
select ok(has_function_privilege('authenticated', 'public.report_students(date, date)', 'execute'), 'authenticated can execute report_students (staff check inside)');

-- 9-12: denied --------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.report_activities('2033-05-01', '2033-05-31')$$, '42501', null, 'anon is denied report_activities');
select throws_ok($$select * from public.report_students('2033-05-01', '2033-05-31')$$, '42501', null, 'anon is denied report_students');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select * from public.report_activities('2033-05-01', '2033-05-31')$$, '42501', 'not_staff', 'a student gets not_staff from report_activities');
select throws_ok($$select * from public.report_students('2033-05-01', '2033-05-31')$$, '42501', 'not_staff', 'a student gets not_staff from report_students');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e201","role":"authenticated"}', true);

-- 13-14: invalid range --------------------------------------------------------------------------------------
select throws_ok($$select * from public.report_activities('2033-05-31', '2033-05-01')$$, '22023', 'invalid_range', 'from > to raises invalid_range (activities)');
select throws_ok($$select * from public.report_students('2033-05-31', '2033-05-01')$$, '22023', 'invalid_range', 'from > to raises invalid_range (students)');

-- 15-25: report_activities, May 2033 --------------------------------------------------------------------------
select is((select array_agg(title order by ends_on, title) from public.report_activities('2033-05-01', '2033-05-31')),
  array['R waste', 'R trees', 'R fixed', 'R empty'],
  'closed activities in range only (draft and not-yet-ended open excluded), ordered by ends_on then title');
select is((select row(participants, approved_submissions, grams_plastic, grams_paper, grams_metal_glass, grams_other, trees, points, carbon_kg)::text
           from public.report_activities('2033-05-01', '2033-05-31') where title = 'R waste'),
  '(2,2,1500,500,250,100,0,25,2.800)', 'waste activity: pending/rejected not counted, adjust/redeem rows excluded, grams by category');
select is((select row(participants, approved_submissions, trees, points, carbon_kg)::text
           from public.report_activities('2033-05-01', '2033-05-31') where title = 'R trees'),
  '(0,2,7,35,17.500)', 'trees activity: trees summed from approved items');
select is((select row(approved_submissions, trees, points, carbon_kg)::text
           from public.report_activities('2033-05-01', '2033-05-31') where title = 'R fixed'),
  '(1,0,10,0.000)', 'fixed activity: points from the earn row');
select is((select row(participants, approved_submissions, grams_plastic, trees, points, carbon_kg)::text
           from public.report_activities('2033-05-01', '2033-05-31') where title = 'R empty'),
  '(1,0,0,0,0,0.000)', 'an ended activity without approved results is listed with zeros, participants shown');
select is((select ends_on from public.report_activities('2033-05-01', '2033-05-31') where title = 'R waste'), date '2033-05-10', 'ends_on is the Bangkok date');
select is((select count(*) from public.report_activities('2033-05-01', '2033-05-31') where title = 'R waste'), 1::bigint,
  'a result approved after the activity ended (reviewed 2033-06-20) still counts toward the May range');
select is((select count(*) from public.report_activities('2033-06-01', '2033-06-30') where title = 'R waste'), 0::bigint, 'and not toward the month it was approved');
select is((select array_agg(title) from public.report_activities('2033-07-01', '2033-07-01')), array['R boundary'],
  'Bangkok date: 2033-06-30 17:30Z is 2033-07-01 local; range is inclusive');
select is((select array_agg(title) from public.report_activities('2033-06-30', '2033-06-30')), null,
  'and it is not in 2033-06-30');
select is((select array_agg(title) from public.report_activities('2001-03-01', '2001-03-31')), array['R past'], 'an open activity past ends_at counts as ended');

-- 26-31: report_students ---------------------------------------------------------------------------------------
select is((select array_agg(full_name order by carbon_kg desc, full_name) from public.report_students('2033-05-01', '2033-05-31')),
  array['RP B นักเรียน', 'RP A นักเรียน'], 'students with approved results in ended activities only (C only has draft/open ones)');
select is((select row(points, carbon_kg, grams_total, trees)::text from public.report_students('2033-05-01', '2033-05-31') where full_name = 'RP A นักเรียน'),
  '(45,10.000,2000,3)', 'student A totals (earn rows only, waste grams only)');
select is((select row(points, carbon_kg, grams_total, trees)::text from public.report_students('2033-05-01', '2033-05-31') where full_name = 'RP B นักเรียน'),
  '(25,10.300,350,4)', 'student B totals');
select is((select full_name from public.report_students('2033-05-01', '2033-05-31') limit 1), 'RP B นักเรียน', 'returned ordered by carbon descending');
select is((select array_agg(full_name) from public.report_students('2033-07-01', '2033-07-01')), array['RP B นักเรียน'], 'boundary activity feeds the student report by Bangkok date');
select is((select pg_typeof(points)::text || pg_typeof(grams_total)::text || pg_typeof(trees)::text from public.report_students('2033-05-01', '2033-05-31') limit 1),
  'bigintbigintbigint', 'student sums are bigint');

-- 32-35: empty range (Review Focus 4) ----------------------------------------------------------------------------
select is((select count(*) from public.report_activities('2034-01-01', '2034-01-31')), 0::bigint, 'an empty range returns 0 activity rows');
select is((select count(*) from public.report_students('2034-01-01', '2034-01-31')), 0::bigint, 'an empty range returns 0 student rows');
select is((select count(*) from public.report_activities('2034-01-01', '2034-01-01')), 0::bigint, 'a one-day empty range returns 0 rows');
select is((select count(*) from public.report_students('2033-05-16', '2033-05-31')), 0::bigint, 'a range after the last result returns 0 student rows');

-- 36-38: renaming a category keeps its column ----------------------------------------------------------------------
reset role;
update public.waste_categories set name = 'กระดาษและกล่อง (เปลี่ยนชื่อ)' where code = 'paper';
update public.waste_categories set name = 'พลาสติกใหม่' where code = 'plastic';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e201","role":"authenticated"}', true);
select is((select row(grams_plastic, grams_paper, grams_metal_glass, grams_other)::text
           from public.report_activities('2033-05-01', '2033-05-31') where title = 'R waste'),
  '(1500,500,250,100)', 'renaming categories does not move grams between columns');
reset role;
select throws_ok($$update public.waste_categories set code = 'glass' where code = 'other'$$, '23514', null, 'code must be one of the four');
select throws_ok($$update public.waste_categories set code = 'plastic' where code = 'other'$$, '23505', null, 'code is unique');

-- 39-41: admin may call; null bound; activities row typing ----------------------------------------------------------
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000e201';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000e201","role":"authenticated"}', true);
select is((select count(*) from public.report_activities('2033-05-01', '2033-05-31')), 4::bigint, 'an admin may call it too');
select throws_ok($$select * from public.report_students(null, '2033-05-31')$$, '22023', 'invalid_range', 'a null bound raises invalid_range');
select is((select pg_typeof(grams_plastic)::text || pg_typeof(points)::text || pg_typeof(trees)::text from public.report_activities('2033-05-01', '2033-05-31') limit 1),
  'bigintbigintbigint', 'activity sums are bigint');
reset role;

select * from finish();
rollback;
