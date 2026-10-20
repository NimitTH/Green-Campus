-- leaderboard(p_period, p_now) and public_stats() (Task 15, R95-R97, migration 0017).
-- The local DB may hold leftovers from e2e runs, so: 'month' tests use p_now in a far-future month
-- (2031-10 / 2031-11 / 2031-12) where only the rows below exist; 'all' and public_stats tests
-- compare deltas or this test's own row, never absolute globals.
-- ids: ranked students ...d111 .. ...d122 (12; Oct 2031 carbon 12 .. 1), s101 ...d101 (boundary,
--   redeem/refund, negative adjust), s102 ...d102 (no carbon), s103 ...d103 (blank names, carbon 0.5),
--   teacher ...d201; activities ...d501 waste, ...d502 trees, ...d503 fixed
begin;
select plan(45);

-- baseline for the delta tests (before anything below is inserted)
create temp table t_base as select public.public_stats() as s;

insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-00000000d' || lpad(i::text, 3, '0'))::uuid, 'lb-r' || i || '@example.test',
       jsonb_build_object('full_name', 'LB นักเรียน ' || lpad(i::text, 3, '0'))
from generate_series(111, 122) i;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000d101', 'lb-s1@example.test', '{"full_name":"LB Boundary"}'::jsonb),
  ('00000000-0000-0000-0000-00000000d102', 'lb-s2@example.test', '{"full_name":"LB NoCarbon"}'::jsonb),
  ('00000000-0000-0000-0000-00000000d103', 'lb-s3@example.test', '{"full_name":"LB Blank"}'::jsonb),
  ('00000000-0000-0000-0000-00000000d201', 'lb-t1@example.test', '{"full_name":"LB ครู"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000d201';
update public.profiles set display_name = '  ', full_name = ' ' where id = '00000000-0000-0000-0000-00000000d103';
update public.profiles set display_name = 'เพื่อนสิบ' where id = '00000000-0000-0000-0000-00000000d111';

-- ranked students: carbon 12 (d111) .. 1 (d122) in October 2031
insert into public.ledger_entries (student_id, kind, points, carbon_kg, created_at)
select ('00000000-0000-0000-0000-00000000d' || lpad(i::text, 3, '0'))::uuid, 'earn', 10, 122 - i + 1, '2031-10-15 05:00+00'
from generate_series(111, 122) i;

-- s101: Oct earn at the Bangkok month end (16:30Z = 23:30 local, October) and a -0.25 adjust;
-- Nov earn 17:30Z = 00:30 local on 1 Nov; redeem/refund never count
insert into public.ledger_entries (student_id, kind, points, carbon_kg, created_at) values
  ('00000000-0000-0000-0000-00000000d101', 'earn', 10, 5.5, '2031-10-31 16:30+00'),
  ('00000000-0000-0000-0000-00000000d101', 'adjust', -1, -0.25, '2031-10-20 05:00+00'),
  ('00000000-0000-0000-0000-00000000d101', 'earn', 10, 7, '2031-10-31 17:30+00'),
  ('00000000-0000-0000-0000-00000000d101', 'redeem', -50, 0, '2031-10-16 05:00+00'),
  ('00000000-0000-0000-0000-00000000d101', 'refund', 50, 0, '2031-10-17 05:00+00'),
  ('00000000-0000-0000-0000-00000000d103', 'earn', 1, 0.5, '2031-10-12 05:00+00'),
  ('00000000-0000-0000-0000-00000000d201', 'adjust', 9, 9.75, '2031-10-12 05:00+00'),
  ('00000000-0000-0000-0000-00000000d102', 'adjust', -3, -3, '2031-10-14 05:00+00');

-- March 2032: ties at rank 10 (d111 50; d112..d119 40..33; d120, d121, d122 all 5)
insert into public.ledger_entries (student_id, kind, points, carbon_kg, created_at)
select ('00000000-0000-0000-0000-00000000d' || lpad(i::text, 3, '0'))::uuid, 'earn', 1,
       case when i = 111 then 50 when i <= 119 then 40 - (i - 112) else 5 end, '2032-03-15 05:00+00'
from generate_series(111, 122) i;

-- activities and approved/pending/rejected submissions for public_stats
insert into public.activities (id, title, starts_at, ends_at, status, type, unit_points, unit_carbon_kg) values
  ('00000000-0000-0000-0000-00000000d501', 'LB waste', now() - interval '1 hour', now() + interval '1 day', 'open', 'waste', 0, null),
  ('00000000-0000-0000-0000-00000000d502', 'LB trees', now() - interval '1 hour', now() + interval '1 day', 'open', 'trees', 5, 2.5),
  ('00000000-0000-0000-0000-00000000d503', 'LB fixed', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed', 10, null);
insert into public.submissions (id, activity_id, student_id, status) values
  ('00000000-0000-0000-0000-00000000d601', '00000000-0000-0000-0000-00000000d501', '00000000-0000-0000-0000-00000000d102', 'approved'),
  ('00000000-0000-0000-0000-00000000d602', '00000000-0000-0000-0000-00000000d501', '00000000-0000-0000-0000-00000000d102', 'pending'),
  ('00000000-0000-0000-0000-00000000d603', '00000000-0000-0000-0000-00000000d502', '00000000-0000-0000-0000-00000000d102', 'approved'),
  ('00000000-0000-0000-0000-00000000d604', '00000000-0000-0000-0000-00000000d502', '00000000-0000-0000-0000-00000000d102', 'rejected'),
  ('00000000-0000-0000-0000-00000000d605', '00000000-0000-0000-0000-00000000d503', '00000000-0000-0000-0000-00000000d102', 'approved');
insert into public.submission_items (submission_id, waste_category_id, quantity) values
  ('00000000-0000-0000-0000-00000000d601', (select id from public.waste_categories where name = 'พลาสติก'), 1500),
  ('00000000-0000-0000-0000-00000000d601', (select id from public.waste_categories where name = 'กระดาษ'), 500),
  ('00000000-0000-0000-0000-00000000d602', (select id from public.waste_categories where name = 'กระดาษ'), 999),
  ('00000000-0000-0000-0000-00000000d603', null, 3),
  ('00000000-0000-0000-0000-00000000d604', null, 4),
  ('00000000-0000-0000-0000-00000000d605', null, 1);

-- 1-6: grants -----------------------------------------------------------------------------------------
select has_function('public', 'leaderboard', array['text', 'timestamptz'], 'leaderboard(text, timestamptz) exists');
select ok(not has_function_privilege('anon', 'public.leaderboard(text, timestamptz)', 'execute'), 'anon cannot execute leaderboard');
select ok(has_function_privilege('authenticated', 'public.leaderboard(text, timestamptz)', 'execute'), 'authenticated can execute leaderboard');
select ok(has_function_privilege('anon', 'public.public_stats()', 'execute'), 'anon can execute public_stats');
select ok(not has_function_privilege('authenticated', 'public.profile_display_name(uuid)', 'execute'), 'authenticated cannot execute profile_display_name (R99)');
select ok(has_function_privilege('service_role', 'public.profile_display_name(uuid)', 'execute'), 'service_role keeps profile_display_name');

-- 7-18: the October 2031 board, seen by s101 (rank 8, inside the top 10) -------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d101","role":"authenticated"}', true);
select is((select count(*) from public.leaderboard('month', '2031-10-15 05:00+00')), 10::bigint, 'top 10 only (caller is inside it)');
select is((select array_agg(l.rank order by l.rank) from public.leaderboard('month', '2031-10-15 05:00+00') l),
  array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'ranks 1..10');
select is((select l.carbon_kg from public.leaderboard('month', '2031-10-15 05:00+00') l where l.is_me), 5.25::numeric,
  'October: the 16:30Z earn counts, the negative adjust lowers it, redeem/refund and the 17:30Z earn do not');
select is((select l.rank from public.leaderboard('month', '2031-10-15 05:00+00') l where l.is_me), 8, 'caller rank 8 in October');
select is((select count(*) from public.leaderboard('month', '2031-10-15 05:00+00') l where l.is_me), 1::bigint, 'exactly one is_me row');
select is((select l.display_name from public.leaderboard('month', '2031-10-15 05:00+00') l where l.rank = 1), 'เพื่อนสิบ',
  'display_name wins over full_name');
select is((select l.display_name from public.leaderboard('month', '2031-10-15 05:00+00') l where l.rank = 2), 'LB นักเรียน 112',
  'full_name is the fallback');
select is((select l.carbon_kg from public.leaderboard('month', '2031-10-15 05:00+00') l where l.rank = 1), 12::numeric, 'rank 1 carbon is 12');

-- November 2031 (the 17:30Z earn, 00:30 local on 1 Nov)
select is((select count(*) from public.leaderboard('month', '2031-11-15 05:00+00')), 1::bigint, 'November has one student with carbon');
select is((select l.carbon_kg from public.leaderboard('month', '2031-11-15 05:00+00') l where l.is_me), 7::numeric, 'November carbon is 7');
select is((select l.rank from public.leaderboard('month', '2031-11-15 05:00+00') l where l.is_me), 1, 'rank 1 in November');
-- the boundary instants themselves select the right month
select is((select l.carbon_kg from public.leaderboard('month', '2031-10-31 16:59:59+00') l where l.is_me), 5.25::numeric,
  'p_now 16:59:59Z on 31 Oct is still October');
select is((select l.carbon_kg from public.leaderboard('month', '2031-10-31 17:00:00+00') l where l.is_me), 7::numeric,
  'p_now 17:00Z on 31 Oct is already November (Asia/Bangkok)');

-- all time (own row only: other totals may include e2e leftovers)
select is((select l.carbon_kg from public.leaderboard('all') l where l.is_me), 12.25::numeric, 'all time: 5.5 - 0.25 + 7');
select is((select count(*) from public.leaderboard('month', '2031-12-15 05:00+00')), 1::bigint, 'an empty month still returns the caller row');
select is((select l.rank is null and l.carbon_kg = 0 from public.leaderboard('month', '2031-12-15 05:00+00') l where l.is_me), true,
  'an empty month: caller unranked (null rank) with 0 carbon');

-- errors
select throws_ok($$select * from public.leaderboard('week')$$, '22023', 'invalid_period', 'unknown period raises invalid_period');
select throws_ok($$select * from public.leaderboard(null)$$, '22023', 'invalid_period', 'null period raises invalid_period');
reset role;

-- a caller outside the top 10 (s103, blank names, rank 14) -----------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d103","role":"authenticated"}', true);
select is((select count(*) from public.leaderboard('month', '2031-10-15 05:00+00')), 11::bigint, 'top 10 plus the caller row');
select is((select l.rank || ':' || l.display_name || ':' || l.carbon_kg from public.leaderboard('month', '2031-10-15 05:00+00') l where l.is_me),
  '14:ไม่ระบุชื่อ:0.500', 'outside the top 10: own row, rank 14, blank names show ไม่ระบุชื่อ');
select is((select l.is_me from (select * from public.leaderboard('month', '2031-10-15 05:00+00') offset 10) l), true, 'the extra row comes last');
reset role;

-- a caller without carbon in the period (s102) -------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d102","role":"authenticated"}', true);
select is((select l.rank is null and l.carbon_kg = 0 from public.leaderboard('month', '2031-10-15 05:00+00') l where l.is_me), true,
  'negative October total (-3): unranked, shown as 0, not a negative number');
select is((select l.carbon_kg from public.leaderboard('all') l where l.is_me), 0::numeric, 'all time: the same -3 is clamped to 0 in the row');
select is((select count(*) from public.leaderboard('month', '2031-10-15 05:00+00')), 11::bigint, 'top 10 plus the caller row (0 carbon)');
reset role;

-- staff get the top 10 only, never is_me -------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d201","role":"authenticated"}', true);
select is((select count(*) from public.leaderboard('month', '2031-10-15 05:00+00')), 10::bigint, 'teacher: top 10 only');
select is((select count(*) from public.leaderboard('month', '2031-10-15 05:00+00') l where l.is_me), 0::bigint, 'teacher: no is_me row');
select is((select count(*) from public.leaderboard('month', '2031-10-15 05:00+00') l where l.carbon_kg = 9.75), 0::bigint, 'the teacher ledger row (9.75) never ranks anyone');
reset role;

-- ties at rank 10 (March 2032) ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d111","role":"authenticated"}', true);
select is((select count(*) from public.leaderboard('month', '2032-03-15 05:00+00')), 12::bigint, 'ties at rank 10: all three tied students are shown (12 rows)');
select is((select count(*) from public.leaderboard('month', '2032-03-15 05:00+00') l where l.rank = 10), 3::bigint, 'equal carbon gives equal rank 10 for all three');
select is((select array_agg(l.rank order by l.rank) from public.leaderboard('month', '2032-03-15 05:00+00') l), array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10], 'ranks skip like rank(): 1..9, 10, 10, 10');
reset role;
-- the caller (s103, no March carbon) is unranked and comes after the board
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000d103","role":"authenticated"}', true);
select is((select count(*) from public.leaderboard('month', '2032-03-15 05:00+00')), 13::bigint, 'the board plus the unranked caller row');
reset role;

-- anon cannot call leaderboard ---------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.leaderboard('month')$$, '42501', null, 'anon cannot call leaderboard');
reset role;

-- public_stats ----------------------------------------------------------------------------------------------------------
set local role anon;
create temp table t_after as select public.public_stats() as s;
reset role;
select is((select array_agg(k order by k) from jsonb_object_keys((select s from t_after)) k), array['carbon_kg', 'trees', 'waste_grams'],
  'anon public_stats has exactly the three keys');
-- carbon delta = every student earn+adjust above (teacher 9 and redeem/refund excluded)
select is(((select s from t_after) ->> 'carbon_kg')::numeric - ((select s from t_base) ->> 'carbon_kg')::numeric,
  78::numeric + 12.25 + 0.5 - 3 + 357, 'carbon delta = ranked 78 + s101 12.25 + s103 0.5 + s102 -3 + March 357');
select is(((select s from t_after) ->> 'waste_grams')::bigint - ((select s from t_base) ->> 'waste_grams')::bigint, 2000::bigint,
  'waste delta counts approved waste items only');
select is(((select s from t_after) ->> 'trees')::bigint - ((select s from t_base) ->> 'trees')::bigint, 3::bigint,
  'trees delta counts approved trees items only');
select is(jsonb_typeof((select s from t_after) -> 'carbon_kg'), 'number', 'carbon_kg is a number');
select is(((select s from t_after) ->> 'carbon_kg')::numeric, round(((select s from t_after) ->> 'carbon_kg')::numeric, 3), 'carbon_kg has at most 3 decimals');
select ok((select s::text from t_after) !~ '[0-9a-f]{8}-[0-9a-f]{4}-' and (select s::text from t_after) !~ 'LB', 'no ids or names in the result');

select * from finish();
rollback;
