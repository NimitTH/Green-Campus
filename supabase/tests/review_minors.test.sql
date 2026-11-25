-- Round 6 final review minors (0042): M3 page links without dot segments, M6 order_no set by a definer trigger.
-- ids: student ...6211
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000006211', 'rm-s@example.test', '{"full_name":"RM นักเรียน"}'::jsonb);

-- M3: a stored page link never has "." or ".." segments (they can normalise to //host) ----------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000006211","role":"authenticated"}', true);
select throws_ok($$select public.submit_problem_report('ปัญหา', '/.//evil.example')$$, 'P0001', 'invalid_input', '/.//host is refused');
select throws_ok($$select public.submit_problem_report('ปัญหา', '/a/..//evil.example')$$, 'P0001', 'invalid_input', '/a/..//host is refused');
select throws_ok($$select public.submit_problem_report('ปัญหา', '/a/../b')$$, 'P0001', 'invalid_input', 'a .. segment is refused');
select lives_ok($$select public.submit_problem_report('ปัญหา', '/rewards?q=a.b')$$, 'dots inside a segment or the query are fine');
reset role;
select throws_ok($$insert into public.problem_reports (reporter_name, message, page_url) values ('x', 'y', '/./x')$$,
  '23514', null, 'the table check refuses a dot segment too');

-- M6: no column default that needs EXECUTE on next_order_no; a security-definer trigger numbers the order ----------
select col_hasnt_default('public', 'orders', 'order_no', 'orders.order_no has no default');
select has_trigger('public', 'orders', 'orders_set_order_no', 'a BEFORE INSERT trigger sets order_no');
select is_definer('public', 'set_order_no', array[]::text[], 'the trigger function is security definer');
insert into public.orders (student_id, total_points, expires_at) values ('00000000-0000-0000-0000-000000006211', 0, now() + interval '7 days');
select ok((select order_no from public.orders where student_id = '00000000-0000-0000-0000-000000006211') ~ '^ORD-[0-9]{8}-[0-9]{4,}$',
  'an insert without order_no still gets one');

select * from finish();
rollback;
