-- submit_result, notify helpers and the evidence bucket (Task 8, spec 6.1, 6.3, 6.4, 7.1, 8.1, 8.4, 9.5).
-- Same actor impersonation style as join_activity.test.sql / weigh_codes.test.sql.
-- submit_result RETURNS {ok, error_code, submission_id} for every business error (so weigh code
-- attempts are committed, spec 7.1 item 4); only not_authenticated / not_student raise (42501).
-- Two concurrent calls with one code (Review Focus 1) need two sessions: tests/e2e/submit.spec.ts.
begin;
select plan(108);

-- ids
--   s1 student ...3101 (participant everywhere)   s2 student ...3102 (participant of nothing)
--   t1 teacher ...3201   ad admin ...3301
--   activities:
--     waste ...3501 (waste, no code, max 5000 g)    trees ...3502 (trees, no code, max 10)
--     fixed ...3503 (fixed, no code)                code ...3504 (fixed, requires_code)
--     draft ...3505 (draft)   future ...3506 (starts in 1 h)   late ...3507 (ended 2 days ago)
--     over ...3508 (ended 4 days ago)   closed ...3509 (closed, in window)
--     wcode ...3510 (waste, requires_code, no max)
--   evidence objects: s1 '...3101/u1/a.jpg' (error cases, never submitted) and '...3101/p1..p9/a.jpg'
--   (one per successful submission: a photo backs one submission only); s2 '...3102/u1/c.jpg'

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000003101', 'sr-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000003102', 'sr-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000003201', 'sr-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000003301', 'sr-ad@example.test', '{"full_name":"แอดมิน หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000003201';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000003301';
update public.profiles set display_name = 'น้องหนึ่ง' where id = '00000000-0000-0000-0000-000000003101';

insert into public.activities (id, title, starts_at, ends_at, status, type, requires_code, max_per_submission, unit_points) values
  ('00000000-0000-0000-0000-000000003501', 'SR waste', now() - interval '1 hour', now() + interval '1 day', 'open', 'waste', false, 5000, 0),
  ('00000000-0000-0000-0000-000000003502', 'SR trees', now() - interval '1 hour', now() + interval '1 day', 'open', 'trees', false, 10, 5),
  ('00000000-0000-0000-0000-000000003503', 'SR fixed', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', false, null, 10),
  ('00000000-0000-0000-0000-000000003504', 'SR code', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', true, null, 10),
  ('00000000-0000-0000-0000-000000003505', 'SR draft', now() - interval '1 hour', now() + interval '1 day', 'draft', 'fixed', false, null, 10),
  ('00000000-0000-0000-0000-000000003506', 'SR future', now() + interval '1 hour', now() + interval '2 days', 'open', 'fixed', false, null, 10),
  ('00000000-0000-0000-0000-000000003507', 'SR late', now() - interval '5 days', now() - interval '2 days', 'open', 'fixed', false, null, 10),
  ('00000000-0000-0000-0000-000000003508', 'SR over', now() - interval '8 days', now() - interval '4 days', 'open', 'fixed', false, null, 10),
  ('00000000-0000-0000-0000-000000003509', 'SR closed', now() - interval '1 hour', now() + interval '1 day', 'closed', 'fixed', false, null, 10),
  ('00000000-0000-0000-0000-000000003510', 'SR wcode', now() - interval '1 hour', now() + interval '1 day', 'open', 'waste', true, null, 0);
insert into public.participations (activity_id, student_id)
select a.id, '00000000-0000-0000-0000-000000003101'
from public.activities a where a.title like 'SR %';

insert into storage.objects (bucket_id, name, owner) values
  ('evidence', '00000000-0000-0000-0000-000000003101/u1/a.jpg', '00000000-0000-0000-0000-000000003101'),
  ('evidence', '00000000-0000-0000-0000-000000003102/u1/c.jpg', '00000000-0000-0000-0000-000000003102');
insert into storage.objects (bucket_id, name, owner)
select 'evidence', '00000000-0000-0000-0000-000000003101/p' || g || '/a.jpg', '00000000-0000-0000-0000-000000003101'
from generate_series(1, 9) g;

-- one active code for (s1, code) and (s1, wcode)
insert into public.weigh_codes (activity_id, student_id, code, issued_by) values
  ('00000000-0000-0000-0000-000000003504', '00000000-0000-0000-0000-000000003101', '111111', '00000000-0000-0000-0000-000000003201'),
  ('00000000-0000-0000-0000-000000003510', '00000000-0000-0000-0000-000000003101', '333333', '00000000-0000-0000-0000-000000003201');

-- 1-12: shape, privileges, bucket --------------------------------------------------------
select has_function('public', 'submit_result', array['uuid', 'text', 'jsonb', 'text'], 'submit_result(uuid, text, jsonb, text) exists');
select is_definer('public', 'submit_result', array['uuid', 'text', 'jsonb', 'text'], 'submit_result is security definer');
select function_returns('public', 'submit_result', array['uuid', 'text', 'jsonb', 'text'], 'jsonb', 'submit_result returns jsonb');
select ok(not has_function_privilege('anon', 'public.submit_result(uuid, text, jsonb, text)', 'execute'),
  'anon cannot execute submit_result');
select ok(has_function_privilege('authenticated', 'public.submit_result(uuid, text, jsonb, text)', 'execute'),
  'authenticated can execute submit_result');
select is_definer('public', 'notify', array['uuid', 'text', 'text', 'text', 'text'], 'notify is security definer');
select is_definer('public', 'notify_staff', array['text', 'text', 'text', 'text'], 'notify_staff is security definer');
select ok(not has_function_privilege('authenticated', 'public.notify(uuid, text, text, text, text)', 'execute')
      and not has_function_privilege('anon', 'public.notify(uuid, text, text, text, text)', 'execute'),
  'API roles cannot execute notify');
select ok(not has_function_privilege('authenticated', 'public.notify_staff(text, text, text, text)', 'execute')
      and not has_function_privilege('anon', 'public.notify_staff(text, text, text, text)', 'execute'),
  'API roles cannot execute notify_staff');
select is((select public from storage.buckets where id = 'evidence'), false, 'evidence bucket is private');
select is((select file_size_limit from storage.buckets where id = 'evidence'), 2097152::bigint, 'evidence bucket limit is 2 MB');
select is((select allowed_mime_types from storage.buckets where id = 'evidence'),
  array['image/jpeg', 'image/png', 'image/webp'], 'evidence bucket allows jpeg/png/webp only');

-- 13-14: auth errors raise -----------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.submit_result('00000000-0000-0000-0000-000000003503', null, null, '00000000-0000-0000-0000-000000003101/u1/a.jpg')$$,
  '42501', 'not_authenticated', 'no signed-in user raises not_authenticated');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003201","role":"authenticated"}', true);
select throws_ok($$select public.submit_result('00000000-0000-0000-0000-000000003503', null, null, '00000000-0000-0000-0000-000000003201/u1/a.jpg')$$,
  '42501', 'not_student', 'teacher raises not_student');
reset role;

-- 15-: student s1 ------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003101","role":"authenticated"}', true);

-- participant / window
select is(public.submit_result('00000000-0000-0000-0000-0000000039ff', null, null, '00000000-0000-0000-0000-000000003101/u1/a.jpg'),
  '{"ok": false, "error_code": "not_participant", "submission_id": null}'::jsonb, 'unknown activity returns not_participant (full shape)');
select is(public.submit_result('00000000-0000-0000-0000-000000003505', null, null, '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code',
  'out_of_window', 'draft returns out_of_window');
select is(public.submit_result('00000000-0000-0000-0000-000000003506', null, null, '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code',
  'out_of_window', 'before starts_at returns out_of_window');
select is(public.submit_result('00000000-0000-0000-0000-000000003508', null, null, '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code',
  'out_of_window', 'after ends_at + 3 days returns out_of_window');

-- (จ) waste items
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null,
  jsonb_build_array(jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 0)),
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'quantity 0 returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null,
  jsonb_build_array(jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', -100)),
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'negative quantity returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null,
  jsonb_build_array(jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 1.5)),
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'fractional quantity returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null,
  jsonb_build_array(jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', '500')),
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'string quantity returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null,
  jsonb_build_array(jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 99999999999)),
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'quantity beyond int returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null,
  jsonb_build_array(jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'))),
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'missing quantity returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null, '[]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'empty waste items return invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null, null,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'null waste items return invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null, '{"quantity": 100}'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'non-array items return invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null, '[100]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'non-object element returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null, '[{"quantity": 100}]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'waste item without category returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null, '[{"waste_category_id": "not-a-uuid", "quantity": 100}]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'bad uuid returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null, '[{"waste_category_id": "00000000-0000-0000-0000-0000000039aa", "quantity": 100}]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'unknown category returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null,
  jsonb_build_array(
    jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 100),
    jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 200)),
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'duplicate category returns invalid_items');
-- (ฉ) over max_per_submission (sum of grams)
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null,
  jsonb_build_array(
    jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 3000),
    jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'กระดาษ'), 'quantity', 2001)),
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'over_limit', 'waste sum over max_per_submission returns over_limit');

-- trees / fixed items
select is(public.submit_result('00000000-0000-0000-0000-000000003502', null, '[{"quantity": 11}]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'over_limit', 'trees over max_per_submission returns over_limit');
select is(public.submit_result('00000000-0000-0000-0000-000000003502', null, '[{"quantity": 2}, {"quantity": 3}]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'two tree items return invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003502', null,
  jsonb_build_array(jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 2)),
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'tree item with a category returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003502', null, '[{"quantity": 0}]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'zero trees return invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003502', null, '[]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'no tree item returns invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003503', null, '[{"quantity": 1}]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'fixed with items returns invalid_items');

-- (ช) evidence path
select is(public.submit_result('00000000-0000-0000-0000-000000003503', null, null, null) ->> 'error_code',
  'bad_evidence_path', 'null evidence path returns bad_evidence_path');
select is(public.submit_result('00000000-0000-0000-0000-000000003503', null, null, '00000000-0000-0000-0000-000000003102/u1/c.jpg') ->> 'error_code',
  'bad_evidence_path', 'another student''s folder returns bad_evidence_path');
select is(public.submit_result('00000000-0000-0000-0000-000000003503', null, null, 'u1/a.jpg') ->> 'error_code',
  'bad_evidence_path', 'path outside the caller folder returns bad_evidence_path');
select is(public.submit_result('00000000-0000-0000-0000-000000003503', null, null, '00000000-0000-0000-0000-000000003101/../00000000-0000-0000-0000-000000003102/u1/c.jpg') ->> 'error_code',
  'bad_evidence_path', 'path with .. returns bad_evidence_path');
select is(public.submit_result('00000000-0000-0000-0000-000000003503', null, null, '00000000-0000-0000-0000-000000003101/u9/missing.jpg') ->> 'error_code',
  'bad_evidence_path', 'path with no uploaded object returns bad_evidence_path');

-- code activity: validation runs before the code (R24), so nothing burns an attempt
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '000000', '[{"quantity": 1}]'::jsonb,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'invalid_items', 'bad items on a code activity return invalid_items');
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '000000', null,
  '00000000-0000-0000-0000-000000003101/u9/missing.jpg') ->> 'error_code', 'bad_evidence_path', 'bad path on a code activity returns bad_evidence_path');
select is((select attempts from public.weigh_codes where code = '111111'), 0,
  'invalid items / bad path did not count as code attempts');
select is(public.submit_result('00000000-0000-0000-0000-000000003504', null, null,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'code_required', 'null code returns code_required');
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '  ', null,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'code_required', 'blank code returns code_required');

-- (ก) wrong code: returned (not raised), attempts incremented
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '000000', null,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg'),
  '{"ok": false, "error_code": "code_invalid", "submission_id": null}'::jsonb, 'wrong code returns code_invalid');
select is((select attempts from public.weigh_codes where code = '111111'), 1, 'wrong code increments attempts (not rolled back)');
-- (ข) five wrong attempts lock the code, then even the right code is code_locked
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '000000', null, '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code',
  'code_invalid', 'wrong attempt 2 returns code_invalid');
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '000000', null, '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code',
  'code_invalid', 'wrong attempt 3 returns code_invalid');
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '000000', null, '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code',
  'code_invalid', 'wrong attempt 4 returns code_invalid');
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '000000', null, '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code',
  'code_locked', 'wrong attempt 5 returns code_locked');
select is((select attempts from public.weigh_codes where code = '111111'), 5, 'attempts reached 5');
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '111111', null, '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code',
  'code_locked', 'right code on a locked code returns code_locked');
select is((select attempts from public.weigh_codes where code = '111111'), 5, 'a locked code does not count further attempts');
select is((select used_at from public.weigh_codes where code = '111111'), null, 'a locked code is not used');
select is((select count(*) from public.submissions where student_id = '00000000-0000-0000-0000-000000003101'), 0::bigint,
  'no submission so far');
reset role;

-- reissue (superuser): revoke the locked code, add a fresh one and an expired one elsewhere
update public.weigh_codes set revoked_at = now() where code = '111111';
insert into public.weigh_codes (activity_id, student_id, code, issued_by) values
  ('00000000-0000-0000-0000-000000003504', '00000000-0000-0000-0000-000000003101', '222222', '00000000-0000-0000-0000-000000003201');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003101","role":"authenticated"}', true);
-- (ค) right code works once
select is(public.submit_result('00000000-0000-0000-0000-000000003504', ' 222222 ', '[]'::jsonb,
  '00000000-0000-0000-0000-000000003101/p1/a.jpg') ->> 'ok', 'true', 'right code succeeds');
select is((select count(*) from public.submissions where activity_id = '00000000-0000-0000-0000-000000003504'), 1::bigint,
  'one submission created');
select is((select status from public.submissions where activity_id = '00000000-0000-0000-0000-000000003504'), 'pending',
  'submission is pending');
select is((select code_id from public.submissions where activity_id = '00000000-0000-0000-0000-000000003504'),
  (select id from public.weigh_codes where code = '222222'), 'submission.code_id is the used code');
select is((select evidence_path from public.submissions where activity_id = '00000000-0000-0000-0000-000000003504'),
  '00000000-0000-0000-0000-000000003101/p1/a.jpg', 'submission.evidence_path is stored');
select is((select student_id from public.submissions where activity_id = '00000000-0000-0000-0000-000000003504'),
  '00000000-0000-0000-0000-000000003101'::uuid, 'submission.student_id is the caller');
select is((select count(*) from public.submission_items si join public.submissions s on s.id = si.submission_id
            where s.activity_id = '00000000-0000-0000-0000-000000003504'), 1::bigint, 'fixed submission stores one item (spec 5.1)');
select is((select si.quantity from public.submission_items si join public.submissions s on s.id = si.submission_id
            where s.activity_id = '00000000-0000-0000-0000-000000003504'), 1, 'fixed item quantity is 1');
select is((select si.waste_category_id from public.submission_items si join public.submissions s on s.id = si.submission_id
            where s.activity_id = '00000000-0000-0000-0000-000000003504'), null, 'fixed item has no category');
select isnt((select used_at from public.weigh_codes where code = '222222'), null, 'used code has used_at');
select is((select attempts from public.weigh_codes where code = '222222'), 0, 'right code adds no attempt');
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '222222', null,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'code_invalid', 'reusing the used code returns code_invalid');
select is((select count(*) from public.submissions where activity_id = '00000000-0000-0000-0000-000000003504'), 1::bigint,
  'still one submission after reuse');
-- staff notifications are not visible to the student
select is((select count(*) from public.notifications), 0::bigint, 'student sees no staff notifications');
reset role;

-- notify_staff: one row per teacher/admin, none for the student
select is((select count(*) from public.notifications n
            where n.user_id in ('00000000-0000-0000-0000-000000003201', '00000000-0000-0000-0000-000000003301')
              and n.type = 'submission_new'
              and n.link = '/staff/reviews/' || (select id from public.submissions where activity_id = '00000000-0000-0000-0000-000000003504')),
  2::bigint, 'teacher and admin each got a submission_new notification with the review link');
select is((select count(*) from public.notifications where user_id in ('00000000-0000-0000-0000-000000003101', '00000000-0000-0000-0000-000000003102')),
  0::bigint, 'students get no submission_new notification');
select ok((select bool_and(n.title = 'มีผลส่งใหม่รอตรวจ' and n.body like '%น้องหนึ่ง%' and n.body like '%SR code%')
            from public.notifications n where n.user_id = '00000000-0000-0000-0000-000000003201'),
  'notification has the Thai title, the display name and the activity title');
select is((select count(*) from public.notifications where type = 'submission_new'),
  (select count(*) from public.profiles where role in ('teacher', 'admin')),
  'exactly one notification per staff profile');

-- (ง) expired code
insert into public.weigh_codes (activity_id, student_id, code, issued_by, expires_at) values
  ('00000000-0000-0000-0000-000000003504', '00000000-0000-0000-0000-000000003101', '444444', '00000000-0000-0000-0000-000000003201', now() - interval '1 minute');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003101","role":"authenticated"}', true);
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '444444', null,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'code_expired', 'expired code returns code_expired');
select is(public.submit_result('00000000-0000-0000-0000-000000003504', '000000', null,
  '00000000-0000-0000-0000-000000003101/u1/a.jpg') ->> 'error_code', 'code_expired', 'wrong code on an expired code returns code_expired');
select is((select attempts from public.weigh_codes where code = '444444'), 0, 'expired code counts no attempts');

-- waste with a code: items are stored as grams with categories
select is(public.submit_result('00000000-0000-0000-0000-000000003510', '333333',
  jsonb_build_array(
    jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 1200),
    jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'กระดาษ'), 'quantity', 300)),
  '00000000-0000-0000-0000-000000003101/p2/a.jpg') ->> 'ok', 'true', 'waste submission with code succeeds');
select is((select sum(si.quantity) from public.submission_items si join public.submissions s on s.id = si.submission_id
            where s.activity_id = '00000000-0000-0000-0000-000000003510'), 1500::bigint, 'waste items store the grams');
select is((select count(distinct si.waste_category_id) from public.submission_items si join public.submissions s on s.id = si.submission_id
            where s.activity_id = '00000000-0000-0000-0000-000000003510'), 2::bigint, 'waste items store both categories');

-- (ซ) activities without a code: no code needed, a given code is ignored
select is(public.submit_result('00000000-0000-0000-0000-000000003503', null, null,
  '00000000-0000-0000-0000-000000003101/p3/a.jpg') ->> 'ok', 'true', 'fixed without code succeeds with no code');
select is(public.submit_result('00000000-0000-0000-0000-000000003503', '999999', '[]'::jsonb,
  '00000000-0000-0000-0000-000000003101/p4/a.jpg') ->> 'ok', 'true', 'a code is ignored when not required (multiple submissions allowed)');
select is(public.submit_result('00000000-0000-0000-0000-000000003503', null, null,
  '00000000-0000-0000-0000-000000003101/p3/a.jpg') ->> 'error_code', 'evidence_already_used', 'a photo that backs another submission returns evidence_already_used');
select is((select count(*) from public.submission_items si join public.submissions s on s.id = si.submission_id
            where s.activity_id = '00000000-0000-0000-0000-000000003503'), 2::bigint, 'fixed with [] or null both store one item each');
select is((select count(*) from public.submissions where activity_id = '00000000-0000-0000-0000-000000003503' and code_id is null), 2::bigint,
  'no-code submissions have code_id null');
select is(public.submit_result('00000000-0000-0000-0000-000000003502', null, '[{"quantity": 10}]'::jsonb,
  '00000000-0000-0000-0000-000000003101/p5/a.jpg') ->> 'ok', 'true', 'trees at max_per_submission succeeds');
select is((select si.quantity from public.submission_items si join public.submissions s on s.id = si.submission_id
            where s.activity_id = '00000000-0000-0000-0000-000000003502'), 10, 'tree count is stored');
select is((select si.waste_category_id from public.submission_items si join public.submissions s on s.id = si.submission_id
            where s.activity_id = '00000000-0000-0000-0000-000000003502'), null, 'tree item has no category');
select is(public.submit_result('00000000-0000-0000-0000-000000003501', null,
  jsonb_build_array(
    jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'พลาสติก'), 'quantity', 3000),
    jsonb_build_object('waste_category_id', (select id from public.waste_categories where name = 'กระดาษ'), 'quantity', 2000)),
  '00000000-0000-0000-0000-000000003101/p6/a.jpg') ->> 'ok', 'true', 'waste exactly at max_per_submission succeeds');
select is(public.submit_result('00000000-0000-0000-0000-000000003507', null, null,
  '00000000-0000-0000-0000-000000003101/p7/a.jpg') ->> 'ok', 'true', 'inside ends_at .. ends_at + 3 days succeeds');
select is(public.submit_result('00000000-0000-0000-0000-000000003509', null, null,
  '00000000-0000-0000-0000-000000003101/p8/a.jpg') ->> 'ok', 'true', 'closed activity inside the window succeeds (R18)');
select ok(set_config('sr.sid', public.submit_result('00000000-0000-0000-0000-000000003509', null, null,
  '00000000-0000-0000-0000-000000003101/p9/a.jpg') ->> 'submission_id', true) is not null, 'a submission_id is returned');
select is((select activity_id from public.submissions where id = current_setting('sr.sid')::uuid),
  '00000000-0000-0000-0000-000000003509'::uuid, 'the returned submission_id is the new submission');
select is((select count(*) from public.submissions where student_id = '00000000-0000-0000-0000-000000003101'), 9::bigint,
  'the student sees their own submissions');

-- no client writes
select throws_ok($$insert into public.submissions (activity_id, student_id, evidence_path)
  values ('00000000-0000-0000-0000-000000003503', '00000000-0000-0000-0000-000000003101', 'x')$$,
  '42501', null, 'student cannot insert submissions directly');
select throws_ok($$insert into public.submission_items (submission_id, quantity)
  values ((select id from public.submissions limit 1), 1)$$,
  '42501', null, 'student cannot insert submission_items directly');
reset role;

-- non-participant s2
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003102","role":"authenticated"}', true);
select is(public.submit_result('00000000-0000-0000-0000-000000003503', null, null,
  '00000000-0000-0000-0000-000000003102/u1/c.jpg') ->> 'error_code', 'not_participant', 'non-participant returns not_participant');
select is((select count(*) from public.submissions), 0::bigint, 'student sees no other student''s submissions');

-- storage policies (R26)
select lives_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('evidence', '00000000-0000-0000-0000-000000003102/u2/d.jpg', '00000000-0000-0000-0000-000000003102')$$,
  'student uploads into their own evidence folder');
select throws_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('evidence', '00000000-0000-0000-0000-000000003101/u3/e.jpg', '00000000-0000-0000-0000-000000003102')$$,
  '42501', null, 'student cannot upload into another student''s folder');
select is((select count(*) from storage.objects where bucket_id = 'evidence'), 2::bigint,
  'student reads only their own evidence objects');
update storage.objects set name = '00000000-0000-0000-0000-000000003102/u2/renamed.jpg' where bucket_id = 'evidence';
select throws_ok($$delete from storage.objects where bucket_id = 'evidence'$$, null, null, 'direct SQL delete of storage objects is refused (storage.protect_delete trigger)');
reset role;
select is((select count(*) from storage.objects where bucket_id = 'evidence' and name like '00000000-0000-0000-0000-000000003102/%'
            and name not like '%renamed%'), 2::bigint, 'students cannot update or delete evidence objects');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000003201","role":"authenticated"}', true);
select is((select count(*) from storage.objects where bucket_id = 'evidence'), 12::bigint, 'staff read all evidence objects');
reset role;

select * from finish();
rollback;
