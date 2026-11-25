-- Round 6 final review (I2, 0041): the demo admin never sees, gets or closes real problem reports (0036 demo_scope).
-- ids: student ...6111, admin ...6131, demo admin ...6151
begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000006111', 'prd-s@example.test', '{"full_name":"PRD นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-000000006131', 'prd-a@example.test', '{"full_name":"PRD แอดมิน"}'::jsonb),
  ('00000000-0000-0000-0000-000000006151', 'prd-da@example.test', '{"full_name":"PRD แอดมินสาธิต"}'::jsonb);
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000006131';
update public.profiles set role = 'admin', is_demo = true where id = '00000000-0000-0000-0000-000000006151';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006111","role":"authenticated"}', true);
select set_config('t.r', public.submit_problem_report('ปุ่มไม่ทำงาน', null)::text, true);
reset role;

select is((select count(*) from public.notifications where type = 'problem_report' and user_id = '00000000-0000-0000-0000-000000006131'), 1::bigint,
  'a real admin is notified');
select is((select count(*) from public.notifications where type = 'problem_report' and user_id = '00000000-0000-0000-0000-000000006151'), 0::bigint,
  'the demo admin is not notified');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006151","role":"authenticated"}', true);
select is((select count(*) from public.problem_reports where id = current_setting('t.r')::uuid), 0::bigint, 'the demo admin cannot read a real report');
select throws_ok($$select public.resolve_problem_report(current_setting('t.r')::uuid, 'เดโม')$$, 'P0001', 'demo_scope', 'the demo admin cannot resolve a real report');
reset role;

select is((select status from public.problem_reports where id = current_setting('t.r')::uuid), 'open', 'the report is still open');
select is((select count(*) from public.notifications where type = 'problem_resolved' and user_id = '00000000-0000-0000-0000-000000006111'), 0::bigint,
  'the student got no resolved notification from the demo admin');

select * from finish();
rollback;
