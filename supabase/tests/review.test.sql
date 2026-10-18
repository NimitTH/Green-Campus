-- Review and ledger: approve_submission, reject_submission, student_balance, activity type lock
-- (Task 9, spec 5.1, 6.1, 6.5, 7, 8.1, 9.5; rulings R34-R38).
-- Same actor impersonation style as submit_result.test.sql. Submissions are seeded directly as
-- superuser (submit_result itself is covered by submit_result.test.sql).
-- Business errors are raised with the bare code as the message (P0001); auth errors use 42501.
-- Two concurrent approvals (FOR UPDATE) need two sessions; here a second approve in the same
-- session must raise not_pending and leave one ledger row.
begin;
select plan(93);

-- ids
--   s1 student ...4101   s2 student ...4102
--   t1 teacher ...4201   t2 teacher ...4202 (owns submission ...4606)   ad admin ...4301
--   activities:
--     waste ...4501 (waste)   trees ...4502 (unit_points 5, unit_carbon_kg 2.5)
--     fixed ...4503 (unit_points 10, unit_carbon_kg null)   fixed2 ...4504 (10, 1.25)
--     free ...4505 (fixed, no submissions: its type may change)
--   submissions (all pending):
--     4601 s1 waste plastic 1500 g        4602 s1 waste plastic 150 g + paper 100 g
--     4603 s1 trees 3                     4604 s1 fixed (null carbon)
--     4605 s1 fixed2                      4606 t2 fixed (reviewer = owner case)
--     4607 s1 fixed (rejected below)      4608 s2 fixed (reason validation, stays pending)
--     4609 s1 waste plastic 1500 g (approved after the rates change)

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000004101', 'rv-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000004102', 'rv-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000004201', 'rv-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000004202', 'rv-t2@example.test', '{"full_name":"ครู สอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000004301', 'rv-ad@example.test', '{"full_name":"แอดมิน หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher'
where id in ('00000000-0000-0000-0000-000000004201', '00000000-0000-0000-0000-000000004202');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000004301';

insert into public.activities (id, title, starts_at, ends_at, status, type, unit_points, unit_carbon_kg) values
  ('00000000-0000-0000-0000-000000004501', 'RV waste', now() - interval '1 hour', now() + interval '1 day', 'open', 'waste', 0, null),
  ('00000000-0000-0000-0000-000000004502', 'RV trees', now() - interval '1 hour', now() + interval '1 day', 'open', 'trees', 5, 2.5),
  ('00000000-0000-0000-0000-000000004503', 'RV fixed', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', 10, null),
  ('00000000-0000-0000-0000-000000004504', 'RV fixed2', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', 10, 1.25),
  ('00000000-0000-0000-0000-000000004505', 'RV free', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', 10, null);

insert into public.submissions (id, activity_id, student_id, status) values
  ('00000000-0000-0000-0000-000000004601', '00000000-0000-0000-0000-000000004501', '00000000-0000-0000-0000-000000004101', 'pending'),
  ('00000000-0000-0000-0000-000000004602', '00000000-0000-0000-0000-000000004501', '00000000-0000-0000-0000-000000004101', 'pending'),
  ('00000000-0000-0000-0000-000000004603', '00000000-0000-0000-0000-000000004502', '00000000-0000-0000-0000-000000004101', 'pending'),
  ('00000000-0000-0000-0000-000000004604', '00000000-0000-0000-0000-000000004503', '00000000-0000-0000-0000-000000004101', 'pending'),
  ('00000000-0000-0000-0000-000000004605', '00000000-0000-0000-0000-000000004504', '00000000-0000-0000-0000-000000004101', 'pending'),
  ('00000000-0000-0000-0000-000000004606', '00000000-0000-0000-0000-000000004503', '00000000-0000-0000-0000-000000004202', 'pending'),
  ('00000000-0000-0000-0000-000000004607', '00000000-0000-0000-0000-000000004503', '00000000-0000-0000-0000-000000004101', 'pending'),
  ('00000000-0000-0000-0000-000000004608', '00000000-0000-0000-0000-000000004503', '00000000-0000-0000-0000-000000004102', 'pending'),
  ('00000000-0000-0000-0000-000000004609', '00000000-0000-0000-0000-000000004501', '00000000-0000-0000-0000-000000004101', 'pending');
insert into public.submission_items (submission_id, waste_category_id, quantity) values
  ('00000000-0000-0000-0000-000000004601', (select id from public.waste_categories where name = 'พลาสติก'), 1500),
  ('00000000-0000-0000-0000-000000004602', (select id from public.waste_categories where name = 'พลาสติก'), 150),
  ('00000000-0000-0000-0000-000000004602', (select id from public.waste_categories where name = 'กระดาษ'), 100),
  ('00000000-0000-0000-0000-000000004603', null, 3),
  ('00000000-0000-0000-0000-000000004604', null, 1),
  ('00000000-0000-0000-0000-000000004605', null, 1),
  ('00000000-0000-0000-0000-000000004606', null, 1),
  ('00000000-0000-0000-0000-000000004607', null, 1),
  ('00000000-0000-0000-0000-000000004608', null, 1),
  ('00000000-0000-0000-0000-000000004609', (select id from public.waste_categories where name = 'พลาสติก'), 1500);

-- 1-18: shape and privileges --------------------------------------------------------------
select has_function('public', 'approve_submission', array['uuid'], 'approve_submission(uuid) exists');
select has_function('public', 'reject_submission', array['uuid', 'text'], 'reject_submission(uuid, text) exists');
select is_definer('public', 'approve_submission', array['uuid'], 'approve_submission is security definer');
select is_definer('public', 'reject_submission', array['uuid', 'text'], 'reject_submission is security definer');
select function_returns('public', 'approve_submission', array['uuid'], 'void', 'approve_submission returns void');
select function_returns('public', 'reject_submission', array['uuid', 'text'], 'void', 'reject_submission returns void');
select ok(not has_function_privilege('anon', 'public.approve_submission(uuid)', 'execute'), 'anon cannot execute approve_submission');
select ok(not has_function_privilege('anon', 'public.reject_submission(uuid, text)', 'execute'), 'anon cannot execute reject_submission');
select ok(has_function_privilege('authenticated', 'public.approve_submission(uuid)', 'execute'), 'authenticated can execute approve_submission');
select ok(has_function_privilege('authenticated', 'public.reject_submission(uuid, text)', 'execute'), 'authenticated can execute reject_submission');
select has_view('public', 'student_balance', 'view student_balance exists');
select col_type_is('public', 'student_balance', 'student_id', 'uuid', 'student_balance.student_id is uuid');
select col_type_is('public', 'student_balance', 'points', 'bigint', 'student_balance.points is bigint');
select col_type_is('public', 'student_balance', 'carbon_kg', 'numeric', 'student_balance.carbon_kg is numeric');
select ok((select 'security_invoker=true' = any (c.reloptions) from pg_class c where c.oid = 'public.student_balance'::regclass),
  'student_balance is security_invoker');
select ok(not has_table_privilege('anon', 'public.student_balance', 'select'), 'anon cannot select student_balance');
select ok(has_table_privilege('authenticated', 'public.student_balance', 'select'), 'authenticated can select student_balance');
select ok(not has_table_privilege('authenticated', 'public.student_balance', 'insert')
      and not has_table_privilege('authenticated', 'public.student_balance', 'update')
      and not has_table_privilege('authenticated', 'public.student_balance', 'delete'),
  'authenticated cannot write student_balance');

-- 19-22: auth errors ----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004601')$$,
  '42501', 'not_authenticated', 'approve without a user raises not_authenticated');
select throws_ok($$select public.reject_submission('00000000-0000-0000-0000-000000004601', 'x')$$,
  '42501', 'not_authenticated', 'reject without a user raises not_authenticated');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004101","role":"authenticated"}', true);
select throws_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004601')$$,
  '42501', 'not_staff', 'student approve raises not_staff');
select throws_ok($$select public.reject_submission('00000000-0000-0000-0000-000000004601', 'x')$$,
  '42501', 'not_staff', 'student reject raises not_staff');
reset role;

-- 23-: teacher t1 -------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004201","role":"authenticated"}', true);

select throws_ok($$select public.approve_submission('00000000-0000-0000-0000-0000000049ff')$$,
  'P0001', 'submission_not_found', 'approve of an unknown submission raises submission_not_found');
select throws_ok($$select public.reject_submission('00000000-0000-0000-0000-0000000049ff', 'รูปไม่ชัด')$$,
  'P0001', 'submission_not_found', 'reject of an unknown submission raises submission_not_found');

-- waste 1500 g plastic at the 0003 rate (10 points/kg, 1.0310 kgCO2e/kg): 15 points, 1.547 kg
select lives_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004601')$$, 'teacher approves waste 1500 g');
select is((select count(*) from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004601'),
  1::bigint, 'approve writes one ledger row');
select is((select kind from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004601'),
  'earn', 'ledger row is earn');
select is((select points from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004601'),
  15, 'waste points = floor(1500 x 10 / 1000)');
select is((select carbon_kg from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004601'),
  1.547::numeric, 'waste carbon = round(1500 x 1.0310 / 1000, 3)');
select is((select student_id from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004601'),
  '00000000-0000-0000-0000-000000004101'::uuid, 'ledger row belongs to the student');
select is((select created_by from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004601'),
  '00000000-0000-0000-0000-000000004201'::uuid, 'ledger row created_by is the reviewer');
select is((select status from public.submissions where id = '00000000-0000-0000-0000-000000004601'), 'approved',
  'submission is approved');
select is((select reviewed_by from public.submissions where id = '00000000-0000-0000-0000-000000004601'),
  '00000000-0000-0000-0000-000000004201'::uuid, 'reviewed_by is the reviewer');
select isnt((select reviewed_at from public.submissions where id = '00000000-0000-0000-0000-000000004601'), null,
  'reviewed_at is set');
select is((select reject_reason from public.submissions where id = '00000000-0000-0000-0000-000000004601'), null,
  'approved submission has no reject_reason');

-- approve twice / reject after approve
select throws_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004601')$$,
  'P0001', 'not_pending', 'second approve raises not_pending');
select throws_ok($$select public.reject_submission('00000000-0000-0000-0000-000000004601', 'รูปไม่ชัด')$$,
  'P0001', 'not_pending', 'reject of an approved submission raises not_pending');
select is((select count(*) from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004601'),
  1::bigint, 'still one ledger row after the second approve');

-- mixed categories: rounding once over the sum (per item would give 1 point and 0.510 kg)
select lives_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004602')$$, 'teacher approves mixed waste');
select is((select points from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004602'),
  2, 'mixed points = floor((150 x 10 + 100 x 5) / 1000), floored once');
select is((select carbon_kg from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004602'),
  0.509::numeric, 'mixed carbon = round((150 x 1.0310 + 100 x 3.5460) / 1000, 3), rounded once');

-- trees / fixed
select lives_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004603')$$, 'teacher approves 3 trees');
select is((select points from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004603'),
  15, 'trees points = 3 x 5');
select is((select carbon_kg from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004603'),
  7.5::numeric, 'trees carbon = 3 x 2.5');
select lives_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004604')$$, 'teacher approves fixed (null carbon)');
select is((select points from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004604'),
  10, 'fixed points = unit_points');
select is((select carbon_kg from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004604'),
  0::numeric, 'fixed with null unit_carbon_kg gives carbon 0');
select lives_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004605')$$, 'teacher approves fixed2');
select is((select carbon_kg from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004605'),
  1.25::numeric, 'fixed carbon = unit_carbon_kg');

-- reject: reason validation
select throws_ok($$select public.reject_submission('00000000-0000-0000-0000-000000004608', null)$$,
  'P0001', 'reason_required', 'reject with a null reason raises reason_required');
select throws_ok($$select public.reject_submission('00000000-0000-0000-0000-000000004608', '   ')$$,
  'P0001', 'reason_required', 'reject with a blank reason raises reason_required');
select throws_ok($$select public.reject_submission('00000000-0000-0000-0000-000000004608', E'\n\t \r\n')$$,
  'P0001', 'reason_required', 'reject with only newlines/tabs raises reason_required');
select throws_ok($$select public.reject_submission('00000000-0000-0000-0000-000000004608', repeat('ก', 501))$$,
  'P0001', 'reason_too_long', 'reject with a 501-character reason raises reason_too_long');
select is((select status from public.submissions where id = '00000000-0000-0000-0000-000000004608'), 'pending',
  'failed rejects leave the submission pending');

-- reject
select lives_ok($$select public.reject_submission('00000000-0000-0000-0000-000000004607', '  รูปไม่ชัด  ')$$,
  'teacher rejects with a reason');
select is((select status from public.submissions where id = '00000000-0000-0000-0000-000000004607'), 'rejected',
  'submission is rejected');
select is((select reject_reason from public.submissions where id = '00000000-0000-0000-0000-000000004607'), 'รูปไม่ชัด',
  'reject_reason is the trimmed reason');
select is((select reviewed_by from public.submissions where id = '00000000-0000-0000-0000-000000004607'),
  '00000000-0000-0000-0000-000000004201'::uuid, 'rejected reviewed_by is the reviewer');
select isnt((select reviewed_at from public.submissions where id = '00000000-0000-0000-0000-000000004607'), null,
  'rejected reviewed_at is set');
select is((select count(*) from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004607'),
  0::bigint, 'reject writes no ledger row');
select throws_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004607')$$,
  'P0001', 'not_pending', 'approve of a rejected submission raises not_pending');
select throws_ok($$select public.reject_submission('00000000-0000-0000-0000-000000004607', 'อีกครั้ง')$$,
  'P0001', 'not_pending', 'second reject raises not_pending');

-- no client writes to the ledger / submissions, even for staff
select throws_ok($$insert into public.ledger_entries (student_id, kind, points)
  values ('00000000-0000-0000-0000-000000004101', 'earn', 100)$$,
  '42501', null, 'staff cannot insert ledger_entries directly');
select throws_ok($$update public.submissions set status = 'approved' where id = '00000000-0000-0000-0000-000000004608'$$,
  '42501', null, 'staff cannot update submissions directly');

-- type lock (R38)
select throws_ok($$update public.activities set type = 'trees' where id = '00000000-0000-0000-0000-000000004501'$$,
  'P0001', 'activity_type_locked', 'changing the type of an activity with submissions raises activity_type_locked');
select lives_ok($$update public.activities set title = 'RV waste (แก้ชื่อ)' where id = '00000000-0000-0000-0000-000000004501'$$,
  'other columns of an activity with submissions can still change');
select lives_ok($$update public.activities set type = 'trees' where id = '00000000-0000-0000-0000-000000004505'$$,
  'the type of an activity without submissions can change');
reset role;

-- own submission (t2 owns 4606) ----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004202","role":"authenticated"}', true);
select throws_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004606')$$,
  'P0001', 'own_submission', 'approving your own submission raises own_submission');
select throws_ok($$select public.reject_submission('00000000-0000-0000-0000-000000004606', 'x')$$,
  'P0001', 'own_submission', 'rejecting your own submission raises own_submission');
reset role;
-- admin may review it
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004301","role":"authenticated"}', true);
select lives_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004606')$$, 'admin approves another staff member''s submission');
reset role;

-- notifications to the student (R36) -----------------------------------------------------
select is((select count(*) from public.notifications
            where user_id = '00000000-0000-0000-0000-000000004101' and type = 'submission_approved'),
  5::bigint, 'one submission_approved notification per approval of s1');
select is((select link from public.notifications
            where user_id = '00000000-0000-0000-0000-000000004101' and type = 'submission_approved' limit 1),
  '/my-submissions', 'approved notification links to /my-submissions');
select ok(exists (select 1 from public.notifications
            where user_id = '00000000-0000-0000-0000-000000004101' and type = 'submission_approved'
              and body like '%RV waste%' and body like '%15 แต้ม%' and body like '%1.547%'),
  'approved notification body has the activity title, points and carbon');
select is((select count(*) from public.notifications
            where user_id = '00000000-0000-0000-0000-000000004101' and type = 'submission_rejected'),
  1::bigint, 'one submission_rejected notification');
select ok((select body like '%RV fixed%' and body like '%รูปไม่ชัด%' and link = '/my-submissions' and title <> ''
            from public.notifications
            where user_id = '00000000-0000-0000-0000-000000004101' and type = 'submission_rejected'),
  'rejected notification has the activity title, the reason and the /my-submissions link');
select is((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-000000004102'),
  0::bigint, 'failed rejects notified nobody');
select is((select count(*) from public.notifications
            where user_id = '00000000-0000-0000-0000-000000004202' and type = 'submission_approved'),
  1::bigint, 'the owner of 4606 was notified of its approval');

-- rates at approve time (R35) ------------------------------------------------------------
update public.waste_categories set points_per_kg = 20, carbon_kg_per_kg = 2 where name = 'พลาสติก';
select is((select points from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004601'),
  15, 'changing the rate after approval leaves the old points');
select is((select carbon_kg from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004601'),
  1.547::numeric, 'changing the rate after approval leaves the old carbon');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004201","role":"authenticated"}', true);
select lives_ok($$select public.approve_submission('00000000-0000-0000-0000-000000004609')$$, 'teacher approves waste after the rate change');
reset role;
select is((select points from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004609'),
  30, 'a later approval uses the new points rate');
select is((select carbon_kg from public.ledger_entries where ref_submission_id = '00000000-0000-0000-0000-000000004609'),
  3.000::numeric, 'a later approval uses the new carbon rate');

-- student_balance (R37) ------------------------------------------------------------------
-- s1 earned 15 + 2 + 15 + 10 + 10 + 30 = 82 points, 1.547 + 0.509 + 7.5 + 0 + 1.25 + 3 = 13.806 kg
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004101","role":"authenticated"}', true);
select is((select count(*) from public.student_balance), 1::bigint, 'a student sees only one balance row');
select is((select student_id from public.student_balance), '00000000-0000-0000-0000-000000004101'::uuid,
  'the row is the student''s own');
select is((select points from public.student_balance), 82::bigint, 'balance points = sum of earned points');
select is((select carbon_kg from public.student_balance), 13.806::numeric, 'balance carbon = sum of earned carbon');
reset role;

-- a redeem lowers points but not carbon; an adjust changes both
insert into public.ledger_entries (student_id, kind, points, carbon_kg, note) values
  ('00000000-0000-0000-0000-000000004101', 'redeem', -20, 0, null),
  ('00000000-0000-0000-0000-000000004101', 'adjust', -3, -0.306, 'แก้ผลอนุมัติผิด');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004101","role":"authenticated"}', true);
select is((select points from public.student_balance), 59::bigint, 'redeem and adjust lower the points (all kinds)');
select is((select carbon_kg from public.student_balance), 13.5::numeric, 'carbon counts earn and adjust only');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000004201","role":"authenticated"}', true);
select is((select count(*) from public.student_balance
            where student_id in ('00000000-0000-0000-0000-000000004101', '00000000-0000-0000-0000-000000004102')),
  2::bigint, 'staff see every student''s balance');
select is((select points from public.student_balance where student_id = '00000000-0000-0000-0000-000000004102'),
  0::bigint, 'a student without entries has 0 points');
select is((select carbon_kg from public.student_balance where student_id = '00000000-0000-0000-0000-000000004102'),
  0::numeric, 'a student without entries has 0 carbon');
select is((select count(*) from public.student_balance
            where student_id in ('00000000-0000-0000-0000-000000004201', '00000000-0000-0000-0000-000000004301')),
  0::bigint, 'staff profiles have no balance row');
reset role;

set local role anon;
select throws_ok($$select * from public.student_balance$$, '42501', null, 'anon cannot read student_balance');
reset role;

select * from finish();
rollback;
