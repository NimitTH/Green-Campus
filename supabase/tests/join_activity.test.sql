-- Activities RLS and join_activity (Task 6, spec 5, 6.3, 7, 8.1).
-- Actors are impersonated with `set local role <role>` plus request.jwt.claims;
-- `reset role` returns to the superuser test session between actors.
-- Business errors are raised with the bare code as the message (SQLSTATE P0001);
-- auth errors (not_authenticated, not_student) use SQLSTATE 42501.
begin;
select plan(38);

-- ids
--   s1 student ...1101   s2 student ...1102   t1 teacher ...1201   ad admin ...1301
--   activities: open ...1501, draft ...1502, closed ...1503, ended (open, past ends_at) ...1504,
--               with submission ...1505, joined but no submission ...1506

-- fixtures (superuser; RLS does not apply) ------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000001101', 'ja-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000001102', 'ja-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000001201', 'ja-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000001301', 'ja-ad@example.test', '{"full_name":"แอดมิน หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000001201';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000001301';

insert into public.activities (id, title, starts_at, ends_at, status, type) values
  ('00000000-0000-0000-0000-000000001501', 'Open act', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed'),
  ('00000000-0000-0000-0000-000000001502', 'Draft act', now() - interval '1 hour', now() + interval '1 day', 'draft', 'fixed'),
  ('00000000-0000-0000-0000-000000001503', 'Closed act', now() - interval '1 hour', now() + interval '1 day', 'closed', 'fixed'),
  ('00000000-0000-0000-0000-000000001504', 'Ended act', now() - interval '2 days', now() - interval '1 hour', 'open', 'fixed'),
  ('00000000-0000-0000-0000-000000001505', 'Act with result', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed'),
  ('00000000-0000-0000-0000-000000001506', 'Act joined only', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed');
insert into public.participations (activity_id, student_id) values
  ('00000000-0000-0000-0000-000000001505', '00000000-0000-0000-0000-000000001102'),
  ('00000000-0000-0000-0000-000000001506', '00000000-0000-0000-0000-000000001102');
insert into public.submissions (activity_id, student_id) values
  ('00000000-0000-0000-0000-000000001505', '00000000-0000-0000-0000-000000001102');

-- 1-4: function shape and privileges --------------------------------------
select has_function('public', 'join_activity', array['uuid'], 'join_activity(uuid) exists');
select is_definer('public', 'join_activity', array['uuid'], 'join_activity is security definer');
select ok(not has_function_privilege('anon', 'public.join_activity(uuid)', 'execute'),
  'anon cannot execute join_activity');
select ok(has_function_privilege('authenticated', 'public.join_activity(uuid)', 'execute'),
  'authenticated can execute join_activity');

-- 5: anon ----------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.join_activity('00000000-0000-0000-0000-000000001501')$$,
  '42501', null, 'anon cannot join (no execute privilege)');
reset role;

-- 6: authenticated role but no user in the JWT ----------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.join_activity('00000000-0000-0000-0000-000000001501')$$,
  '42501', 'not_authenticated', 'join without a signed-in user fails');
reset role;

-- 7-22: student s1 ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated"}', true);

select lives_ok($$select public.join_activity('00000000-0000-0000-0000-000000001501')$$,
  'student joins an open activity');
select is((select count(*) from public.participations
            where activity_id = '00000000-0000-0000-0000-000000001501'
              and student_id = '00000000-0000-0000-0000-000000001101'),
  1::bigint, 'participation row created for the caller');
select throws_ok($$select public.join_activity('00000000-0000-0000-0000-000000001501')$$,
  'P0001', 'already_joined', 'second join throws already_joined');
select throws_ok($$select public.join_activity('00000000-0000-0000-0000-000000001502')$$,
  'P0001', 'activity_not_open', 'draft activity throws activity_not_open');
select throws_ok($$select public.join_activity('00000000-0000-0000-0000-000000001503')$$,
  'P0001', 'activity_not_open', 'closed activity throws activity_not_open');
select throws_ok($$select public.join_activity('00000000-0000-0000-0000-000000001504')$$,
  'P0001', 'activity_ended', 'open activity past ends_at throws activity_ended');
select throws_ok($$select public.join_activity('00000000-0000-0000-0000-0000000019ff')$$,
  'P0001', 'activity_not_open', 'unknown activity throws activity_not_open');

select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000001502'),
  0::bigint, 'student cannot see draft activities');
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000001503'),
  0::bigint, 'student cannot see closed activities they did not join');
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000001504'),
  1::bigint, 'student sees open activities');
select is((select count(*) from public.participations), 1::bigint,
  'student sees only own participations');

select throws_ok($$insert into public.participations (activity_id, student_id)
  values ('00000000-0000-0000-0000-000000001504', '00000000-0000-0000-0000-000000001101')$$,
  '42501', null, 'student cannot insert participations directly');
select throws_ok($$delete from public.participations
  where student_id = '00000000-0000-0000-0000-000000001101'$$,
  '42501', null, 'student cannot delete participations directly');
select throws_ok($$insert into public.activities (title, starts_at, ends_at, type)
  values ('X', now(), now() + interval '1 day', 'fixed')$$,
  '42501', null, 'student cannot create activities');
update public.activities set title = 'hacked' where id = '00000000-0000-0000-0000-000000001501';
select is((select title from public.activities where id = '00000000-0000-0000-0000-000000001501'),
  'Open act', 'student cannot update activities (0 rows updated)');
delete from public.activities where id = '00000000-0000-0000-0000-000000001504';
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000001504'),
  1::bigint, 'student cannot delete activities (0 rows deleted)');

reset role;

-- 23-25: closed / back-to-draft visibility of a joined activity -----------
update public.activities set status = 'closed' where id = '00000000-0000-0000-0000-000000001501';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated"}', true);
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000001501'),
  1::bigint, 'student still sees a joined activity after it is closed');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001102","role":"authenticated"}', true);
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000001501'),
  0::bigint, 'student who never joined cannot see the closed activity');
reset role;
update public.activities set status = 'draft' where id = '00000000-0000-0000-0000-000000001501';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated"}', true);
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000001501'),
  0::bigint, 'joined student cannot see the activity after staff move it back to draft');
reset role;

-- 26-35: teacher t1 --------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001201","role":"authenticated"}', true);

select throws_ok($$select public.join_activity('00000000-0000-0000-0000-000000001506')$$,
  '42501', 'not_student', 'teacher cannot join (join_activity is for students, spec 7)');
select lives_ok($$insert into public.activities (id, title, starts_at, ends_at, type, requires_code)
  values ('00000000-0000-0000-0000-000000001507', 'Teacher act', now(), now() + interval '1 day', 'waste', true)$$,
  'teacher can create an activity');
select lives_ok($$update public.activities set status = 'open', title = 'Teacher act 2'
  where id = '00000000-0000-0000-0000-000000001507'$$,
  'teacher can update an activity');
select is((select status from public.activities where id = '00000000-0000-0000-0000-000000001507'),
  'open', 'teacher update stored');
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000001502'),
  1::bigint, 'teacher sees draft activities');
select is((select count(*) from public.participations where activity_id in
  ('00000000-0000-0000-0000-000000001501', '00000000-0000-0000-0000-000000001505',
   '00000000-0000-0000-0000-000000001506')),
  3::bigint, 'teacher sees all participations');
-- R17: teachers may delete activities, except ones with submissions.
select throws_ok($$delete from public.activities where id = '00000000-0000-0000-0000-000000001505'$$,
  '23503', 'activity_has_submissions', 'teacher cannot delete an activity with submissions');
select lives_ok($$delete from public.activities where id = '00000000-0000-0000-0000-000000001506'$$,
  'teacher deletes an activity that has participants but no submissions');
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000001506'),
  0::bigint, 'activity deleted by teacher');
select is((select count(*) from public.participations
            where activity_id = '00000000-0000-0000-0000-000000001506'),
  0::bigint, 'participations of a deleted activity are removed with it');

reset role;

-- 36-38: admin ad ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001301","role":"authenticated"}', true);

select throws_ok($$delete from public.activities where id = '00000000-0000-0000-0000-000000001505'$$,
  '23503', 'activity_has_submissions', 'admin cannot delete an activity with submissions');
select lives_ok($$delete from public.activities where id = '00000000-0000-0000-0000-000000001507'$$,
  'admin deletes an activity without submissions');
select is((select count(*) from public.activities where id = '00000000-0000-0000-0000-000000001507'),
  0::bigint, 'activity deleted by admin');

reset role;

select * from finish();
rollback;
