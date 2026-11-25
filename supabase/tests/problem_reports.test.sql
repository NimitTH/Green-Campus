-- Round 6 (old-site features 5): website problem reports.
-- ids: student ...5f11, student2 ...5f12, teacher ...5f21, admin ...5f31, admin2 ...5f32, demo student ...5f41
begin;
select plan(22);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000005f11', 'pr-s@example.test', '{"full_name":"PR นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-000000005f12', 'pr-s2@example.test', '{"full_name":"PR นักเรียนสอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000005f21', 'pr-t@example.test', '{"full_name":"PR ครู"}'::jsonb),
  ('00000000-0000-0000-0000-000000005f31', 'pr-a@example.test', '{"full_name":"PR แอดมิน"}'::jsonb),
  ('00000000-0000-0000-0000-000000005f32', 'pr-a2@example.test', '{"full_name":"PR แอดมินสอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000005f41', 'pr-d@example.test', '{"full_name":"PR เดโม"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000005f21';
update public.profiles set role = 'admin' where id in ('00000000-0000-0000-0000-000000005f31', '00000000-0000-0000-0000-000000005f32');
update public.profiles set is_demo = true where id = '00000000-0000-0000-0000-000000005f41';

-- a student reports ------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005f11","role":"authenticated"}', true);
select set_config('t.r1', public.submit_problem_report('  กดส่งผลแล้วไม่ได้แต้ม  ', '/rewards?q=1')::text, true);
reset role;

select is((select array[message, page_url, status, reporter_name] from public.problem_reports where id = current_setting('t.r1')::uuid),
  array['กดส่งผลแล้วไม่ได้แต้ม', '/rewards?q=1', 'open', 'PR นักเรียน'], 'the report is stored trimmed, open, with the reporter name');
select is((select count(*) from public.notifications where type = 'problem_report'
            and user_id in ('00000000-0000-0000-0000-000000005f31', '00000000-0000-0000-0000-000000005f32')), 2::bigint,
  'every admin gets one problem_report notification');
select is((select array[title, link] from public.notifications where type = 'problem_report' and user_id = '00000000-0000-0000-0000-000000005f31'),
  array['มีการแจ้งปัญหาการใช้งาน', '/staff/problem-reports'], 'the admin notification title and link');
select is((select count(*) from public.notifications where type = 'problem_report'
            and user_id in ('00000000-0000-0000-0000-000000005f11', '00000000-0000-0000-0000-000000005f21')), 0::bigint,
  'non-admins get no problem_report notification');

-- input checks -------------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005f12","role":"authenticated"}', true);
select throws_ok($$select public.submit_problem_report(E' \n\t ', null)$$, 'P0001', 'invalid_input', 'a blank message is refused');
select lives_ok($$select public.submit_problem_report(repeat('ก', 1000), null)$$, '1000 Thai characters are accepted');
select throws_ok($$select public.submit_problem_report(repeat('ก', 1001), null)$$, 'P0001', 'invalid_input', '1001 characters are refused');
select throws_ok($$select public.submit_problem_report('ปัญหา', '//evil.example')$$, 'P0001', 'invalid_input', 'a protocol-relative page url is refused');
select throws_ok($$select public.submit_problem_report('ปัญหา', 'https://evil.example/x')$$, 'P0001', 'invalid_input', 'an absolute page url is refused');
select throws_ok($$insert into public.problem_reports (message) values ('ตรง')$$, '42501', null, 'no direct insert');
select is((select count(*) from public.problem_reports where id = current_setting('t.r1')::uuid), 0::bigint,
  'a student cannot read another student''s report');
reset role;

-- rate limit: 5 per 24 hours ------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005f21","role":"authenticated"}', true);
select lives_ok($$select public.submit_problem_report('ครูแจ้ง 1', null)$$, 'a teacher can report');
select count(public.submit_problem_report('ครูแจ้ง ' || n, null)) from generate_series(2, 5) n;
select throws_ok($$select public.submit_problem_report('ครูแจ้ง 6', null)$$, 'P0001', 'too_many_reports', 'the 6th report in 24 hours is refused');
select throws_ok($$select public.resolve_problem_report(current_setting('t.r1')::uuid, null)$$, 'P0001', 'not_admin', 'a teacher cannot resolve');
select is((select count(*) from public.problem_reports), 5::bigint, 'a teacher sees only their own reports');
reset role;

-- demo accounts --------------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005f41","role":"authenticated"}', true);
select throws_ok($$select public.submit_problem_report('เดโม', null)$$, 'P0001', 'demo_scope', 'a demo account cannot notify real admins');
reset role;

set local role anon;
select throws_ok($$select public.submit_problem_report('anon', null)$$, '42501', null, 'anon is refused');
reset role;

-- an admin resolves ------------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005f31","role":"authenticated"}', true);
select is(public.resolve_problem_report(current_setting('t.r1')::uuid, '  แก้แล้ว ลองใหม่ได้  '), true, 'the first resolve returns true');
select is(public.resolve_problem_report(current_setting('t.r1')::uuid, 'ซ้ำ'), false, 'a second resolve returns false');
select throws_ok($$select public.resolve_problem_report('00000000-0000-0000-0000-00000000ffff', null)$$, 'P0001', 'report_not_found', 'an unknown id');
reset role;

select is((select array[status, admin_note, resolved_by::text] from public.problem_reports where id = current_setting('t.r1')::uuid),
  array['done', 'แก้แล้ว ลองใหม่ได้', '00000000-0000-0000-0000-000000005f31'], 'the report is done with the trimmed note and the resolver');
select is((select array_agg(array[title, coalesce(body, '')]) from public.notifications
            where type = 'problem_resolved' and user_id = '00000000-0000-0000-0000-000000005f11'),
  array[array['ปัญหาที่แจ้งได้รับการแก้ไขแล้ว', 'แก้แล้ว ลองใหม่ได้']], 'the reporter is notified once, with the note');

select * from finish();
rollback;
