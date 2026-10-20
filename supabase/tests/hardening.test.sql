-- Phase 1 hardening (0011): activity_status_locked trigger, one earn row per submission.
-- ids: student ...7101, teacher ...7201; activities ...7501 (no participant), ...7502 (participant),
--      ...7503 (earn index); submission ...7601
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000007101', 'hd-s1@example.test', '{"full_name":"นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-000000007201', 'hd-t1@example.test', '{"full_name":"ครู"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000007201';

insert into public.activities (id, title, starts_at, ends_at, status, type, unit_points) values
  ('00000000-0000-0000-0000-000000007501', 'HD empty', now(), now() + interval '1 day', 'draft', 'fixed', 5),
  ('00000000-0000-0000-0000-000000007502', 'HD joined', now(), now() + interval '1 day', 'open', 'fixed', 5),
  ('00000000-0000-0000-0000-000000007503', 'HD earn', now(), now() + interval '1 day', 'open', 'fixed', 5);
insert into public.participations (activity_id, student_id) values
  ('00000000-0000-0000-0000-000000007502', '00000000-0000-0000-0000-000000007101');

-- no participants: draft -> open -> draft is allowed
select lives_ok($$update public.activities set status = 'open' where id = '00000000-0000-0000-0000-000000007501'$$,
  'draft -> open without participants');
select lives_ok($$update public.activities set status = 'draft' where id = '00000000-0000-0000-0000-000000007501'$$,
  'open -> draft without participants is allowed');

-- with a participant: back to draft raises
select throws_ok($$update public.activities set status = 'draft' where id = '00000000-0000-0000-0000-000000007502'$$,
  'P0001', 'activity_status_locked', 'open -> draft with a participant raises');
select is((select status from public.activities where id = '00000000-0000-0000-0000-000000007502'),
  'open', 'status unchanged after the refused update');
select lives_ok($$update public.activities set status = 'closed' where id = '00000000-0000-0000-0000-000000007502'$$,
  'open -> closed with a participant is allowed');
select throws_ok($$update public.activities set status = 'draft' where id = '00000000-0000-0000-0000-000000007502'$$,
  'P0001', 'activity_status_locked', 'closed -> draft with a participant raises');
select lives_ok($$update public.activities set status = 'open' where id = '00000000-0000-0000-0000-000000007502'$$,
  'closed -> open with a participant is still allowed');

-- one earn row per submission
insert into public.submissions (id, activity_id, student_id, status) values
  ('00000000-0000-0000-0000-000000007601', '00000000-0000-0000-0000-000000007503', '00000000-0000-0000-0000-000000007101', 'approved');
insert into public.ledger_entries (student_id, kind, points, carbon_kg, ref_submission_id) values
  ('00000000-0000-0000-0000-000000007101', 'earn', 5, 0, '00000000-0000-0000-0000-000000007601');
select throws_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg, ref_submission_id)
  values ('00000000-0000-0000-0000-000000007101', 'earn', 5, 0, '00000000-0000-0000-0000-000000007601')$$,
  '23505', null, 'a second earn row for the same submission violates the unique index');
select lives_ok($$insert into public.ledger_entries (student_id, kind, points, carbon_kg, ref_submission_id)
  values ('00000000-0000-0000-0000-000000007101', 'adjust', -1, 0, '00000000-0000-0000-0000-000000007601')$$,
  'a non-earn row may still reference the submission');

select * from finish();
rollback;
