-- Fixed activities: one pending/approved submission per student (owner decision 2026-10-20, spec 6.5).
-- A rejected submission does not count. waste and trees are unchanged.
begin;
select plan(14);

-- ids: student s1 ...8101, teacher ...8201
--   fixed ...8501 (no code)  fixed ...8502 (no code, approved case)  waste ...8503
--   fixed ...8504 (requires_code)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000008101', 'fo-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000008201', 'fo-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000008201';

insert into public.activities (id, title, starts_at, ends_at, status, type, requires_code, max_per_submission, unit_points) values
  ('00000000-0000-0000-0000-000000008501', 'FO fixed', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', false, null, 10),
  ('00000000-0000-0000-0000-000000008502', 'FO fixed approved', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', false, null, 10),
  ('00000000-0000-0000-0000-000000008503', 'FO waste', now() - interval '1 hour', now() + interval '1 day', 'open', 'waste', false, null, 0),
  ('00000000-0000-0000-0000-000000008504', 'FO code', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', true, null, 10);
insert into public.participations (activity_id, student_id)
select a.id, '00000000-0000-0000-0000-000000008101' from public.activities a where a.title like 'FO %';

insert into storage.objects (bucket_id, name, owner)
select 'evidence', '00000000-0000-0000-0000-000000008101/p' || g || '/a.jpg', '00000000-0000-0000-0000-000000008101'
from generate_series(1, 10) g;

insert into public.weigh_codes (activity_id, student_id, code, issued_by) values
  ('00000000-0000-0000-0000-000000008504', '00000000-0000-0000-0000-000000008101', '555555', '00000000-0000-0000-0000-000000008201');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000008101","role":"authenticated"}', true);

-- 1-3: fixed, first succeeds, second is already_submitted --------------------------------
select is(public.submit_result('00000000-0000-0000-0000-000000008501', null, null, '00000000-0000-0000-0000-000000008101/p1/a.jpg') ->> 'ok',
  'true', 'first fixed submit succeeds');
select is(public.submit_result('00000000-0000-0000-0000-000000008501', null, null, '00000000-0000-0000-0000-000000008101/p2/a.jpg'),
  '{"ok": false, "error_code": "already_submitted", "submission_id": null}'::jsonb, 'second fixed submit returns already_submitted (pending)');
select is((select count(*)::int from public.submissions where activity_id = '00000000-0000-0000-0000-000000008501'), 1,
  'still one submission');

-- 4-5: after rejection a new submit succeeds ------------------------------------------------
reset role;
update public.submissions set status = 'rejected', reject_reason = 'x' where activity_id = '00000000-0000-0000-0000-000000008501';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000008101","role":"authenticated"}', true);
select is(public.submit_result('00000000-0000-0000-0000-000000008501', null, null, '00000000-0000-0000-0000-000000008101/p2/a.jpg') ->> 'ok',
  'true', 'a new fixed submit succeeds after rejection');
select is(public.submit_result('00000000-0000-0000-0000-000000008501', null, null, '00000000-0000-0000-0000-000000008101/p3/a.jpg') ->> 'error_code',
  'already_submitted', 'and the new pending one blocks again');

-- 6-8: approved blocks ----------------------------------------------------------------------
select is(public.submit_result('00000000-0000-0000-0000-000000008502', null, null, '00000000-0000-0000-0000-000000008101/p4/a.jpg') ->> 'ok',
  'true', 'fixed submit (approved case) succeeds');
reset role;
update public.submissions set status = 'approved' where activity_id = '00000000-0000-0000-0000-000000008502';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000008101","role":"authenticated"}', true);
select is(public.submit_result('00000000-0000-0000-0000-000000008502', null, null, '00000000-0000-0000-0000-000000008101/p5/a.jpg') ->> 'error_code',
  'already_submitted', 'approved submission returns already_submitted');
select is((select count(*)::int from public.submissions where activity_id = '00000000-0000-0000-0000-000000008502'), 1,
  'approved case still one submission');

-- 9-10: waste still allows two ------------------------------------------------------------------
select is(public.submit_result('00000000-0000-0000-0000-000000008503', null,
  jsonb_build_array(jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 100)),
  '00000000-0000-0000-0000-000000008101/p6/a.jpg') ->> 'ok', 'true', 'first waste submit succeeds');
select is(public.submit_result('00000000-0000-0000-0000-000000008503', null,
  jsonb_build_array(jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 100)),
  '00000000-0000-0000-0000-000000008101/p7/a.jpg') ->> 'ok', 'true', 'second waste submit succeeds');

-- 11-14: requires_code fixed: already_submitted does not touch the code ---------------------------
select is(public.submit_result('00000000-0000-0000-0000-000000008504', '555555', null, '00000000-0000-0000-0000-000000008101/p8/a.jpg') ->> 'ok',
  'true', 'code fixed: first submit succeeds with the code');
reset role;
-- a fresh active code for the pair (the first was used); then a pending submission already exists
insert into public.weigh_codes (activity_id, student_id, code, issued_by) values
  ('00000000-0000-0000-0000-000000008504', '00000000-0000-0000-0000-000000008101', '666666', '00000000-0000-0000-0000-000000008201');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000008101","role":"authenticated"}', true);
select is(public.submit_result('00000000-0000-0000-0000-000000008504', '000000', null, '00000000-0000-0000-0000-000000008101/p9/a.jpg') ->> 'error_code',
  'already_submitted', 'code fixed: already_submitted even with a wrong code');
select is((select attempts from public.weigh_codes where code = '666666'), 0, 'code attempts unchanged');
select is((select used_at from public.weigh_codes where code = '666666'), null, 'code used_at unchanged');

select * from finish();
rollback;
