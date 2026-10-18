-- Weigh station codes: issue_weigh_code (Task 7, spec 6.3, 6.4, 7, 8.1).
-- Same actor impersonation style as join_activity.test.sql. Business errors are raised with
-- the bare code as the message (P0001); auth errors (not_authenticated, not_staff) use 42501.
begin;
select plan(37);

-- ids
--   s1 student ...2101 (participant)   s2 student ...2102 (not a participant)
--   t1 teacher ...2201   ad admin ...2301
--   activities (all requires_code unless noted):
--     ok ...2501 (open, in window)   nocode ...2502 (requires_code = false)   draft ...2503
--     future ...2504 (starts in 1 h)   late ...2505 (ended 2 days ago, inside the 3-day grace)
--     over ...2506 (ended 4 days ago)   closed ...2507 (closed, in window)

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000002101', 'wc-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000002102', 'wc-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000002201', 'wc-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000002301', 'wc-ad@example.test', '{"full_name":"แอดมิน หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000002201';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000002301';

insert into public.activities (id, title, starts_at, ends_at, status, type, requires_code) values
  ('00000000-0000-0000-0000-000000002501', 'WC ok', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', true),
  ('00000000-0000-0000-0000-000000002502', 'WC no code', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', false),
  ('00000000-0000-0000-0000-000000002503', 'WC draft', now() - interval '1 hour', now() + interval '1 day', 'draft', 'fixed', true),
  ('00000000-0000-0000-0000-000000002504', 'WC future', now() + interval '1 hour', now() + interval '2 days', 'open', 'fixed', true),
  ('00000000-0000-0000-0000-000000002505', 'WC late', now() - interval '5 days', now() - interval '2 days', 'open', 'fixed', true),
  ('00000000-0000-0000-0000-000000002506', 'WC over', now() - interval '8 days', now() - interval '4 days', 'open', 'fixed', true),
  ('00000000-0000-0000-0000-000000002507', 'WC closed', now() - interval '1 hour', now() + interval '1 day', 'closed', 'fixed', true);
insert into public.participations (activity_id, student_id)
select a.id, '00000000-0000-0000-0000-000000002101'
from public.activities a where a.title like 'WC %';

-- 1-4: shape and privileges --------------------------------------------------
select has_function('public', 'issue_weigh_code', array['uuid', 'uuid'], 'issue_weigh_code(uuid, uuid) exists');
select is_definer('public', 'issue_weigh_code', array['uuid', 'uuid'], 'issue_weigh_code is security definer');
select ok(not has_function_privilege('anon', 'public.issue_weigh_code(uuid, uuid)', 'execute'),
  'anon cannot execute issue_weigh_code');
select ok(has_function_privilege('authenticated', 'public.issue_weigh_code(uuid, uuid)', 'execute'),
  'authenticated can execute issue_weigh_code');

-- 5: anon ---------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101')$$,
  '42501', null, 'anon cannot issue (no execute privilege)');
reset role;

-- 6: authenticated role without a user in the JWT ----------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101')$$,
  '42501', 'not_authenticated', 'issue without a signed-in user fails');
reset role;

-- 7-8: students cannot issue ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000002101","role":"authenticated"}', true);
select throws_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101')$$,
  '42501', 'not_staff', 'student cannot issue a code (even for themselves)');
select is((select count(*) from public.weigh_codes), 0::bigint, 'student sees no weigh codes');
reset role;

-- 9-: teacher t1 ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000002201","role":"authenticated"}', true);

select throws_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-0000000029ff', '00000000-0000-0000-0000-000000002101')$$,
  'P0001', 'activity_not_found', 'unknown activity throws activity_not_found');
select throws_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002502', '00000000-0000-0000-0000-000000002101')$$,
  'P0001', 'code_not_required', 'activity without requires_code throws code_not_required');
select throws_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002102')$$,
  'P0001', 'not_participant', 'student who did not join throws not_participant');
select throws_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-0000000029ee')$$,
  'P0001', 'not_participant', 'unknown student throws not_participant');
select throws_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002503', '00000000-0000-0000-0000-000000002101')$$,
  'P0001', 'out_of_window', 'draft activity throws out_of_window');
select throws_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002504', '00000000-0000-0000-0000-000000002101')$$,
  'P0001', 'out_of_window', 'before starts_at throws out_of_window');
select throws_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002506', '00000000-0000-0000-0000-000000002101')$$,
  'P0001', 'out_of_window', 'after ends_at + 3 days throws out_of_window');
select is((select count(*) from public.weigh_codes), 0::bigint, 'failed attempts create no rows');

select lives_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002505', '00000000-0000-0000-0000-000000002101')$$,
  'inside ends_at .. ends_at + 3 days succeeds');
select lives_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002507', '00000000-0000-0000-0000-000000002101')$$,
  'closed activity inside the window succeeds (R18)');

select lives_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101')$$,
  'teacher issues a code for a participant');
select is((select count(*) from public.weigh_codes
            where activity_id = '00000000-0000-0000-0000-000000002501'
              and student_id = '00000000-0000-0000-0000-000000002101'
              and used_at is null and revoked_at is null),
  1::bigint, 'one active code for the pair');
select ok((select code ~ '^[0-9]{6}$' from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101')),
  'returned code is 6 digits');
select is((select count(*) from public.weigh_codes
            where activity_id = '00000000-0000-0000-0000-000000002501'
              and student_id = '00000000-0000-0000-0000-000000002101'),
  2::bigint, 'second issue added a row');
select is((select count(*) from public.weigh_codes
            where activity_id = '00000000-0000-0000-0000-000000002501'
              and student_id = '00000000-0000-0000-0000-000000002101'
              and used_at is null and revoked_at is null),
  1::bigint, 'second issue leaves exactly one active code');
select is((select count(*) from public.weigh_codes
            where activity_id = '00000000-0000-0000-0000-000000002501'
              and student_id = '00000000-0000-0000-0000-000000002101'
              and revoked_at is not null),
  1::bigint, 'the old code has revoked_at set');
select is((select issued_by from public.weigh_codes
            where activity_id = '00000000-0000-0000-0000-000000002501'
              and student_id = '00000000-0000-0000-0000-000000002101'
              and revoked_at is null),
  '00000000-0000-0000-0000-000000002201'::uuid, 'issued_by is the teacher');
select cmp_ok(
  (select abs(extract(epoch from (wc.expires_at - now())) - 1800)
     from public.weigh_codes wc
    where wc.activity_id = '00000000-0000-0000-0000-000000002501' and wc.revoked_at is null),
  '<=', 5::numeric, 'expires_at is 30 minutes from now (+-5 s)');

select is((select r.expires_at from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101') r),
  (select wc.expires_at from public.weigh_codes wc
    where wc.activity_id = '00000000-0000-0000-0000-000000002501' and wc.revoked_at is null
      and wc.used_at is null),
  'returned expires_at equals the stored expires_at');

-- the format always holds, including codes that start with 0 (200 issues)
select is(
  (select count(*) from generate_series(1, 200) g,
     lateral public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101') r
    where r.code ~ '^[0-9]{6}$'),
  200::bigint, '200 issued codes are all exactly 6 digits');
select is((select count(*) from public.weigh_codes
            where activity_id = '00000000-0000-0000-0000-000000002501'
              and student_id = '00000000-0000-0000-0000-000000002101'
              and used_at is null and revoked_at is null),
  1::bigint, 'still exactly one active code after 200 more issues');
reset role;

-- a used code is not revoked on reissue
update public.weigh_codes set used_at = now()
 where activity_id = '00000000-0000-0000-0000-000000002501' and used_at is null and revoked_at is null;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000002201","role":"authenticated"}', true);
select lives_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101')$$,
  'issuing after a used code succeeds');
select is((select count(*) from public.weigh_codes
            where activity_id = '00000000-0000-0000-0000-000000002501' and used_at is not null and revoked_at is null),
  1::bigint, 'the used code stays used and unrevoked');
reset role;

-- an expired active code is revoked on reissue
update public.weigh_codes set expires_at = now() - interval '1 minute'
 where activity_id = '00000000-0000-0000-0000-000000002501' and used_at is null and revoked_at is null;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000002201","role":"authenticated"}', true);
select lives_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101')$$,
  'reissue over an expired active code succeeds');
select is((select count(*) from public.weigh_codes
            where activity_id = '00000000-0000-0000-0000-000000002501' and used_at is null and revoked_at is null),
  1::bigint, 'the expired code was revoked, one active code remains');
reset role;

-- admin ----------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000002301","role":"authenticated"}', true);
select lives_ok($$select * from public.issue_weigh_code('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101')$$,
  'admin issues a code');
select is((select issued_by from public.weigh_codes
            where activity_id = '00000000-0000-0000-0000-000000002501' and revoked_at is null and used_at is null),
  '00000000-0000-0000-0000-000000002301'::uuid, 'issued_by is the admin');

-- no client writes ---------------------------------------------------------------------------
select throws_ok($$insert into public.weigh_codes (activity_id, student_id, code)
  values ('00000000-0000-0000-0000-000000002501', '00000000-0000-0000-0000-000000002101', '123456')$$,
  '42501', null, 'staff cannot insert weigh_codes directly');
select throws_ok($$update public.weigh_codes set revoked_at = now()$$,
  '42501', null, 'staff cannot update weigh_codes directly');
reset role;

select * from finish();
rollback;
