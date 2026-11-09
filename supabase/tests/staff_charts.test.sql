-- Redesign 4: staff_carbon_by_month / staff_waste_by_category. ids: student ...5c11, teacher ...5c21
begin;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000005c11', 'sc-s@example.test', '{"full_name":"SC นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-000000005c21', 'sc-t@example.test', '{"full_name":"SC ครู"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000005c21';

-- Baselines first (the DB may already hold earn rows: seed data, e2e leftovers); assertions below are deltas.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005c21","role":"authenticated"}', true);
select set_config('t.cur', (select carbon_kg::text from public.staff_carbon_by_month() order by month desc limit 1), true);
select set_config('t.prev', (select carbon_kg::text from public.staff_carbon_by_month() order by month desc offset 1 limit 1), true);
select set_config('t.old', (select carbon_kg::text from public.staff_carbon_by_month() order by month limit 1), true);
reset role;

-- Clock-relative fixtures: +30 min after the start of the current Bangkok month (counts in it, even when that
-- is the previous UTC day) and -30 min before it (counts in the previous Bangkok month).
insert into public.ledger_entries (student_id, kind, points, carbon_kg, created_at) values
  ('00000000-0000-0000-0000-000000005c11', 'earn', 10, 1.5,
    (date_trunc('month', now() at time zone 'Asia/Bangkok') + interval '30 minutes') at time zone 'Asia/Bangkok'),
  ('00000000-0000-0000-0000-000000005c11', 'earn', 10, 2.25,
    (date_trunc('month', now() at time zone 'Asia/Bangkok') - interval '30 minutes') at time zone 'Asia/Bangkok'),
  ('00000000-0000-0000-0000-000000005c11', 'redeem', -5, 0,
    (date_trunc('month', now() at time zone 'Asia/Bangkok') + interval '30 minutes') at time zone 'Asia/Bangkok');

-- Expected series recomputed straight from ledger_entries (as the table owner, so RLS cannot hide rows): the
-- same 6 Bangkok months, earn only, coalesce(sum, 0). Months with no rows prove zero-fill on any data.
select set_config('t.exp', (
  select string_agg(m.d::date || ':' || round(coalesce((
    select sum(le.carbon_kg) from public.ledger_entries le
    where le.kind = 'earn' and date_trunc('month', le.created_at at time zone 'Asia/Bangkok') = m.d), 0), 3), ',' order by m.d)
  from generate_series(date_trunc('month', now() at time zone 'Asia/Bangkok') - interval '5 months',
                       date_trunc('month', now() at time zone 'Asia/Bangkok'), interval '1 month') m(d)), true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005c11","role":"authenticated"}', true);
select throws_ok($$select * from public.staff_carbon_by_month()$$, 'P0001', 'not_staff', 'a student is refused');
reset role;

set local role anon;
select throws_ok($$select * from public.staff_carbon_by_month()$$, '42501', null, 'anon is refused');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005c21","role":"authenticated"}', true);

select is((select array_agg(month order by month) from public.staff_carbon_by_month()),
  (select array_agg(d::date order by d) from generate_series(
     date_trunc('month', now() at time zone 'Asia/Bangkok') - interval '5 months',
     date_trunc('month', now() at time zone 'Asia/Bangkok'), interval '1 month') d),
  '6 months, oldest first, the current Bangkok month last');
select is((select carbon_kg from public.staff_carbon_by_month() order by month limit 1), current_setting('t.old')::numeric,
  'the oldest month is unchanged by the fixtures (nothing earned there)');
select is((select string_agg(month || ':' || carbon_kg, ',' order by month) from public.staff_carbon_by_month()),
  current_setting('t.exp'), 'every month equals the sum recomputed from ledger_entries (zero-fill included)');
select is((select carbon_kg from public.staff_carbon_by_month() order by month desc limit 1), current_setting('t.cur')::numeric + 1.5,
  'an entry 30 min into the Bangkok month counts in it (redeem ignored)');
select is((select carbon_kg from public.staff_carbon_by_month() order by month desc offset 1 limit 1), current_setting('t.prev')::numeric + 2.25,
  'an entry 30 min before the Bangkok month starts counts in the previous month');
select is(array[(select count(*) from public.staff_carbon_by_month(0)), (select count(*) from public.staff_carbon_by_month(99))],
  array[1, 24]::bigint[], 'p_months is clamped to 1..24');

select is((select array_agg(code) from public.staff_waste_by_category()), array['plastic', 'paper', 'metal_glass', 'other'],
  'four categories in the fixed order');
select set_config('t.before', (select grams::text from public.staff_waste_by_category() where code = 'plastic'), true);
reset role;

insert into public.activities (id, title, starts_at, ends_at, status, type) values
  ('00000000-0000-0000-0000-000000005c01', 'SC waste', now(), now() + interval '1 day', 'open', 'waste'),
  ('00000000-0000-0000-0000-000000005c02', 'SC trees', now(), now() + interval '1 day', 'open', 'trees');
insert into public.submissions (id, activity_id, student_id, status) values
  ('00000000-0000-0000-0000-000000005c61', '00000000-0000-0000-0000-000000005c01', '00000000-0000-0000-0000-000000005c11', 'approved'),
  ('00000000-0000-0000-0000-000000005c62', '00000000-0000-0000-0000-000000005c01', '00000000-0000-0000-0000-000000005c11', 'pending');
insert into public.submission_items (submission_id, waste_category_id, quantity) values
  ('00000000-0000-0000-0000-000000005c61', (select id from public.waste_categories where code = 'plastic'), 500),
  ('00000000-0000-0000-0000-000000005c62', (select id from public.waste_categories where code = 'plastic'), 300);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005c21","role":"authenticated"}', true);
select is((select grams from public.staff_waste_by_category() where code = 'plastic'),
  current_setting('t.before')::bigint + 500, 'only approved waste counts (pending ignored)');
reset role;

select * from finish();
rollback;
