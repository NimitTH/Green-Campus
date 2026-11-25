-- Round 6 (old-site features 2): staff_waste_by_category(p_since). ids: student ...5d11, teacher ...5d21
begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000005d11', 'ws-s@example.test', '{"full_name":"WS นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-000000005d21', 'ws-t@example.test', '{"full_name":"WS ครู"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000005d21';

-- Baselines first (the DB may already hold approvals); the assertions below are deltas.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005d21","role":"authenticated"}', true);
select set_config('t.all', (select grams::text from public.staff_waste_by_category() where code = 'plastic'), true);
select set_config('t.since', (select grams::text from public.staff_waste_by_category(now() - interval '1 day') where code = 'plastic'), true);
reset role;

insert into public.activities (id, title, starts_at, ends_at, status, type) values
  ('00000000-0000-0000-0000-000000005d01', 'WS waste', now() - interval '3 days', now() + interval '1 day', 'open', 'waste');
insert into public.submissions (id, activity_id, student_id, status, reviewed_at) values
  ('00000000-0000-0000-0000-000000005d61', '00000000-0000-0000-0000-000000005d01', '00000000-0000-0000-0000-000000005d11', 'approved', now()),
  ('00000000-0000-0000-0000-000000005d62', '00000000-0000-0000-0000-000000005d01', '00000000-0000-0000-0000-000000005d11', 'approved', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000005d63', '00000000-0000-0000-0000-000000005d01', '00000000-0000-0000-0000-000000005d11', 'pending', null);
insert into public.submission_items (submission_id, waste_category_id, quantity) values
  ('00000000-0000-0000-0000-000000005d61', (select id from public.waste_categories where code = 'plastic'), 500),
  ('00000000-0000-0000-0000-000000005d62', (select id from public.waste_categories where code = 'plastic'), 700),
  ('00000000-0000-0000-0000-000000005d63', (select id from public.waste_categories where code = 'plastic'), 300);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005d21","role":"authenticated"}', true);
select is((select grams from public.staff_waste_by_category() where code = 'plastic'),
  current_setting('t.all')::bigint + 1200, 'no p_since counts every approval (pending ignored)');
select is((select grams from public.staff_waste_by_category(null) where code = 'plastic'),
  current_setting('t.all')::bigint + 1200, 'p_since null is the same as no argument');
select is((select grams from public.staff_waste_by_category(now() - interval '1 day') where code = 'plastic'),
  current_setting('t.since')::bigint + 500, 'p_since counts only approvals reviewed at or after it');
select is((select array_agg(code) from public.staff_waste_by_category(now() - interval '1 day')),
  array['plastic', 'paper', 'metal_glass', 'other'], 'p_since keeps all four categories in the fixed order');
reset role;

set local role anon;
select throws_ok($$select * from public.staff_waste_by_category(now())$$, '42501', null, 'anon is refused');
reset role;

select * from finish();
rollback;
