-- Redesign 4 (DESIGN-4 6.3, 7.5): account_status, account_events and the student account functions.
-- Robust on a seeded DB: every assertion is about this file's own fixture rows, a delta, or a value recomputed
-- independently as the table owner. ids (...5aXX): students s1 5a01, s2 5a02, s3 5a04, s4 5a05 (escape
-- fixtures), demo student ds 5a03; teacher t 5a11, admin a 5a12, demo teacher dt 5a13, demo admin da 5a14,
-- teacher target t2 5a15.
begin;
select plan(116);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000005a01', 'sa-s1@example.test', '{"full_name":"SA นักเรียนหนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a02', 'sa-s2@example.test', '{"full_name":"SA นักเรียนสอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a03', 'sa-ds@example.test', '{"full_name":"SA นักเรียนสาธิต"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a04', 'sa-findme-q7x@example.test', '{"full_name":"SAX%Z"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a05', 'sa-s4@example.test', '{"full_name":"SAXabcZ"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a11', 'sa-t@example.test', '{"full_name":"SA ครู"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a12', 'sa-a@example.test', '{"full_name":"SA แอดมิน"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a13', 'sa-dt@example.test', '{"full_name":"SA ครูสาธิต"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a14', 'sa-da@example.test', '{"full_name":"SA แอดมินสาธิต"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a15', 'sa-t2@example.test', '{"full_name":"SA ครูสอง"}'::jsonb);
-- auth.uid() is null here, so the 0002 trigger lets role / is_demo through
update public.profiles set role = 'teacher' where id in ('00000000-0000-0000-0000-000000005a11', '00000000-0000-0000-0000-000000005a13', '00000000-0000-0000-0000-000000005a15');
update public.profiles set role = 'admin' where id in ('00000000-0000-0000-0000-000000005a12', '00000000-0000-0000-0000-000000005a14');
update public.profiles set is_demo = true where id in ('00000000-0000-0000-0000-000000005a03', '00000000-0000-0000-0000-000000005a13', '00000000-0000-0000-0000-000000005a14');
update public.profiles set display_name = 'SA-LB-ดาวเด่น' where id = '00000000-0000-0000-0000-000000005a02';

-- Runs p_sql as `authenticated` with p_uid in the JWT; returns 'ok' or the raised message (the error code).
create function pg_temp.try_as(p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare
  v_out text := 'ok';
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  begin
    execute p_sql;
  exception when others then
    v_out := sqlerrm;
  end;
  execute 'reset role';
  return v_out;
end
$$;

-- Setup step: like try_as, but a refusal aborts the test run instead of passing silently.
create function pg_temp.run_as(p_uid uuid, p_sql text) returns void
language plpgsql as $$
declare
  v_out text := pg_temp.try_as(p_uid, p_sql);
begin
  if v_out <> 'ok' then
    raise exception 'setup step failed (%): %', v_out, p_sql;
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------------------
-- 1. Structure: definer + empty search_path, no anon/public execute, RLS on, security of the tables
-- ---------------------------------------------------------------------------------------------------------
create temp table t_fns (sig text);
insert into t_fns values
  ('public.staff_list_students(text,text,text,text,integer,integer)'),
  ('public.staff_get_student(uuid)'),
  ('public.staff_list_account_events(uuid,integer)'),
  ('public.staff_begin_password_reset(uuid)'),
  ('public.staff_suspend_student(uuid,integer,text)'),
  ('public.staff_unsuspend_student(uuid)'),
  ('public.admin_set_student_name(uuid,text,text)'),
  ('public.admin_check_student_delete(uuid)'),
  ('public.admin_record_student_deleted(uuid,text)'),
  ('public.clear_must_change_password()'),
  ('public.leaderboard(text,timestamp with time zone)');

select is_empty($$
  select f.sig from t_fns f join pg_proc p on p.oid = f.sig::regprocedure
  where not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false)
$$, 'every function is security definer with search_path = ''''');
select is_empty($$
  select f.sig from t_fns f
  where has_function_privilege('anon', f.sig, 'execute') or not has_function_privilege('authenticated', f.sig, 'execute')
$$, 'anon cannot execute any function; authenticated can');
select is((select array_agg(c.relrowsecurity order by c.relname) from pg_class c
           where c.oid in ('public.account_status'::regclass, 'public.account_events'::regclass)),
  array[true, true], 'RLS is on for account_status and account_events');
select is_empty($$
  select t, p from unnest(array['public.account_status', 'public.account_events']) t,
                   unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
  where has_table_privilege('authenticated', t, p) or has_table_privilege('anon', t, p)
$$, 'clients have no insert/update/delete/truncate on the new tables');
select ok(not has_function_privilege('authenticated', 'public.account_caller(boolean)', 'execute')
          and not has_function_privilege('authenticated', 'public.account_target(public.profiles,uuid)', 'execute'),
  'the internal rule helpers are not callable by clients');
select ok(not has_function_privilege('authenticated', 'public.account_end_sessions(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.account_end_sessions(uuid)', 'execute')
          and (select prosecdef and coalesce(proconfig @> array['search_path=""'], false) from pg_proc
               where oid = 'public.account_end_sessions(uuid)'::regprocedure),
  'account_end_sessions is an internal definer helper no client can call');
select ok(not has_function_privilege('anon', 'public.account_staff_can_read(uuid)', 'execute')
          and (select prosecdef and coalesce(proconfig @> array['search_path=""'], false) from pg_proc
               where oid = 'public.account_staff_can_read(uuid)'::regprocedure),
  'account_staff_can_read (the RLS read rule) is a definer helper with an empty search_path, not callable by anon');
select ok(has_table_privilege('service_role', 'public.account_status', 'select,insert,update'),
  'service_role (admin client) can maintain account_status');
select ok(not has_table_privilege('anon', 'public.account_status', 'select')
          and not has_table_privilege('anon', 'public.account_events', 'select'), 'anon cannot select the new tables');

-- ---------------------------------------------------------------------------------------------------------
-- 2. Permission matrix (spec 6.3): every function x caller x target
-- ---------------------------------------------------------------------------------------------------------
create temp table t_callers (who text, id uuid);
insert into t_callers values
  ('student', '00000000-0000-0000-0000-000000005a01'), ('teacher', '00000000-0000-0000-0000-000000005a11'),
  ('admin', '00000000-0000-0000-0000-000000005a12'), ('demo_teacher', '00000000-0000-0000-0000-000000005a13'),
  ('demo_admin', '00000000-0000-0000-0000-000000005a14');
create temp table t_targets (tgt text, id uuid); -- 'self' resolves to the caller
insert into t_targets values
  ('student', '00000000-0000-0000-0000-000000005a02'), ('demo_student', '00000000-0000-0000-0000-000000005a03'),
  ('teacher', '00000000-0000-0000-0000-000000005a15'), ('self', null);
create temp table t_fn_sql (fn text, sql text);
insert into t_fn_sql values
  ('reset', 'select public.staff_begin_password_reset(%L)'),
  ('suspend', 'select public.staff_suspend_student(%L, 3, ''ทดสอบสิทธิ์'')'),
  ('unsuspend', 'select public.staff_unsuspend_student(%L)'),
  ('rename', 'select public.admin_set_student_name(%L, ''SA ชื่อใหม่'', ''SA ใหม่'')'),
  ('check_delete', 'select public.admin_check_student_delete(%L)'),
  ('get', 'select * from public.staff_get_student(%L)'),
  ('events', 'select * from public.staff_list_account_events(%L)');

create temp table t_actual as
select c.who, t.tgt, f.fn, pg_temp.try_as(c.id, format(f.sql, coalesce(t.id, c.id))) as result
from t_callers c cross join t_targets t cross join t_fn_sql f;

-- Command rule for staff commands; admin_* commands use it too for admins and are not_admin for the rest.
create temp table t_cmd_rule (who text, tgt text, result text);
insert into t_cmd_rule values
  ('student', 'student', 'not_staff'), ('student', 'demo_student', 'not_staff'), ('student', 'teacher', 'not_staff'), ('student', 'self', 'not_staff'),
  ('teacher', 'student', 'ok'), ('teacher', 'demo_student', 'ok'), ('teacher', 'teacher', 'not_student'), ('teacher', 'self', 'self_target'),
  ('admin', 'student', 'ok'), ('admin', 'demo_student', 'ok'), ('admin', 'teacher', 'not_student'), ('admin', 'self', 'self_target'),
  ('demo_teacher', 'student', 'demo_scope'), ('demo_teacher', 'demo_student', 'ok'), ('demo_teacher', 'teacher', 'not_student'), ('demo_teacher', 'self', 'self_target'),
  ('demo_admin', 'student', 'demo_scope'), ('demo_admin', 'demo_student', 'ok'), ('demo_admin', 'teacher', 'not_student'), ('demo_admin', 'self', 'self_target');

create temp table t_expected as
select r.who, r.tgt, f.fn, r.result from t_cmd_rule r cross join (values ('reset'), ('suspend'), ('unsuspend')) f(fn)
union all
select r.who, r.tgt, f.fn,
       case when r.who in ('admin', 'demo_admin') then r.result else 'not_admin' end
from t_cmd_rule r cross join (values ('rename'), ('check_delete')) f(fn)
union all
-- reads: staff only; any student target (demo staff may look at real students); non-students are not_student
select r.who, r.tgt, 'get',
       case when r.who = 'student' then 'not_staff' when r.tgt in ('student', 'demo_student') then 'ok' else 'not_student' end
from t_cmd_rule r
union all
select r.who, r.tgt, 'events', case when r.who = 'student' then 'not_staff' else 'ok' end
from t_cmd_rule r;

select is((select count(*) from t_actual), 140::bigint, 'the matrix ran 5 callers x 4 targets x 7 functions');
select is_empty($$ select a.fn, a.who, a.tgt, a.result, e.result as expected
  from t_actual a join t_expected e using (who, tgt, fn) where a.fn = 'reset' and a.result is distinct from e.result $$,
  'staff_begin_password_reset follows the 6.3 matrix');
select is_empty($$ select a.fn, a.who, a.tgt, a.result, e.result as expected
  from t_actual a join t_expected e using (who, tgt, fn) where a.fn = 'suspend' and a.result is distinct from e.result $$,
  'staff_suspend_student follows the 6.3 matrix');
select is_empty($$ select a.fn, a.who, a.tgt, a.result, e.result as expected
  from t_actual a join t_expected e using (who, tgt, fn) where a.fn = 'unsuspend' and a.result is distinct from e.result $$,
  'staff_unsuspend_student follows the 6.3 matrix');
select is_empty($$ select a.fn, a.who, a.tgt, a.result, e.result as expected
  from t_actual a join t_expected e using (who, tgt, fn) where a.fn = 'rename' and a.result is distinct from e.result $$,
  'admin_set_student_name: admins only (teacher -> not_admin), demo admin -> demo_scope on a real student');
select is_empty($$ select a.fn, a.who, a.tgt, a.result, e.result as expected
  from t_actual a join t_expected e using (who, tgt, fn) where a.fn = 'check_delete' and a.result is distinct from e.result $$,
  'admin_check_student_delete follows the admin matrix');
select is_empty($$ select a.fn, a.who, a.tgt, a.result, e.result as expected
  from t_actual a join t_expected e using (who, tgt, fn) where a.fn = 'get' and a.result is distinct from e.result $$,
  'staff_get_student: staff only, students only');
select is_empty($$ select a.fn, a.who, a.tgt, a.result, e.result as expected
  from t_actual a join t_expected e using (who, tgt, fn) where a.fn = 'events' and a.result is distinct from e.result $$,
  'staff_list_account_events: staff only');

-- named spot checks from the brief (the matrix above covers them too; these read better on failure)
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  $$select public.admin_set_student_name('00000000-0000-0000-0000-000000005a01', 'x', null)$$), 'not_admin', 'teacher -> admin_set_student_name = not_admin');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a14',
  $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a01', 1, 'r')$$), 'demo_scope', 'demo admin -> real student = demo_scope');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a12',
  $$select public.staff_begin_password_reset('00000000-0000-0000-0000-000000005a11')$$), 'not_student', 'admin -> teacher = not_student');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a12',
  $$select public.staff_begin_password_reset('00000000-0000-0000-0000-0000000fffff')$$), 'not_student', 'unknown target = not_student');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a01',
  $$select * from public.staff_list_students(null, 'date', 'desc', 'all', 12, 0)$$), 'not_staff', 'student -> staff_list_students = not_staff');

select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a01',
  $$select public.admin_record_student_deleted('00000000-0000-0000-0000-000000005a99', 'x')$$), 'not_admin', 'student -> admin_record_student_deleted = not_admin');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a13',
  $$select * from public.staff_list_students(null, 'date', 'desc', 'all', 12, 0)$$), 'ok', 'demo teacher -> staff_list_students = ok');

set local role anon;
select throws_ok($$select public.staff_begin_password_reset('00000000-0000-0000-0000-000000005a01')$$, '42501', null, 'anon cannot call the commands');
select throws_ok($$select public.clear_must_change_password()$$, '42501', null, 'anon cannot clear the flag');
reset role;

-- Refused commands write nothing (review M8): no account_status row and no account_events row for any target the
-- matrix and the spot checks only ever refused (the teacher target, every self target, the student caller who was
-- refused as demo_scope above, an unknown id), and no row written by a refused actor (student, demo staff) for a
-- real student.
select is_empty($$
  select 'status', s.student_id from public.account_status s
  where s.student_id in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a11',
                         '00000000-0000-0000-0000-000000005a12', '00000000-0000-0000-0000-000000005a13',
                         '00000000-0000-0000-0000-000000005a14', '00000000-0000-0000-0000-000000005a15',
                         '00000000-0000-0000-0000-0000000fffff')
  union all
  select 'event', e.student_id from public.account_events e
  where e.student_id in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a11',
                         '00000000-0000-0000-0000-000000005a12', '00000000-0000-0000-0000-000000005a13',
                         '00000000-0000-0000-0000-000000005a14', '00000000-0000-0000-0000-000000005a15',
                         '00000000-0000-0000-0000-0000000fffff')
$$, 'refused commands (not_staff, not_student, self_target, demo_scope) wrote no account_status and no account_events row');
select is_empty($$
  select e.id from public.account_events e
  where e.actor_id in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a13', '00000000-0000-0000-0000-000000005a14')
    and e.student_id <> '00000000-0000-0000-0000-000000005a03'
$$, 'a refused actor (student, demo staff on a real student) wrote no event');
select is_empty($$
  select s.student_id from public.account_status s
  where s.suspended_by in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a13', '00000000-0000-0000-0000-000000005a14')
    and s.student_id <> '00000000-0000-0000-0000-000000005a03'
$$, 'a refused actor suspended no real student');

-- ---------------------------------------------------------------------------------------------------------
-- 3. Input rules
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a01', 3, '')$$), 'invalid_input', 'empty reason = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a01', 3, E' \t\n ')$$), 'invalid_input', 'whitespace-only reason = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a01', 3, null)$$), 'invalid_input', 'null reason = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  format('select public.staff_suspend_student(%L, 3, %L)', '00000000-0000-0000-0000-000000005a01', repeat('ก', 501))),
  'invalid_input', '501-character reason = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  format('select public.staff_suspend_student(%L, 3, %L)', '00000000-0000-0000-0000-000000005a01', repeat('ก', 500))),
  'ok', '500-character reason is accepted');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a01', 0, 'r')$$), 'invalid_input', 'p_days 0 = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a01', 366, 'r')$$), 'invalid_input', 'p_days 366 = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a01', -1, 'r')$$), 'invalid_input', 'negative p_days = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a01', 365, 'r')$$), 'ok', 'p_days 365 is accepted');
select ok((select suspended_until between now() + interval '365 days' - interval '1 minute' and now() + interval '365 days' + interval '1 minute'
           from public.account_status where student_id = '00000000-0000-0000-0000-000000005a01'), 'p_days 365 suspends for 365 days');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a01', null, 'จนกว่าจะปลด')$$), 'ok', 'p_days null is accepted');
select is((select suspended_until from public.account_status where student_id = '00000000-0000-0000-0000-000000005a01'),
  'infinity'::timestamptz, 'p_days null -> suspended_until = infinity');
select is((select suspend_reason || '|' || suspended_by from public.account_status where student_id = '00000000-0000-0000-0000-000000005a01'),
  'จนกว่าจะปลด|00000000-0000-0000-0000-000000005a11', 're-suspending replaces the reason and records who suspended');

select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a12',
  $$select public.admin_set_student_name('00000000-0000-0000-0000-000000005a01', E'  \t ', null)$$), 'invalid_input', 'blank full name = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a12',
  format('select public.admin_set_student_name(%L, %L, null)', '00000000-0000-0000-0000-000000005a01', repeat('ก', 101))),
  'invalid_input', '101-character full name = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a12',
  format('select public.admin_set_student_name(%L, %L, %L)', '00000000-0000-0000-0000-000000005a01', 'SA ชื่อ', repeat('ก', 51))),
  'invalid_input', '51-character display name = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a12',
  $$select public.admin_set_student_name('00000000-0000-0000-0000-000000005a01', E'  SA \t ชื่อ   จริง ', '   ')$$), 'ok', 'a valid rename is accepted');
select is((select full_name || '|' || coalesce(display_name, '<null>') from public.profiles where id = '00000000-0000-0000-0000-000000005a01'),
  'SA ชื่อ จริง|<null>', 'names are normalised like /profile (collapsed whitespace, blank display name -> null)');

-- ---------------------------------------------------------------------------------------------------------
-- 4. Events: one row per command, with actor and student names; append-only for clients
-- ---------------------------------------------------------------------------------------------------------
-- New rows are told apart by id (now() is the same for the whole test transaction).
create temp table t_seen as select id from public.account_events where student_id = '00000000-0000-0000-0000-000000005a02';
create temp table t_new (step text, n bigint, action text, actor_name text, student_name text, detail text);
create function pg_temp.collect(p_step text) returns void language plpgsql as $$
begin
  insert into t_new
  select p_step, count(*) over (), e.action, e.actor_name, e.student_name, e.detail
  from public.account_events e
  where e.student_id = '00000000-0000-0000-0000-000000005a02' and e.id not in (select id from t_seen);
  if not found then
    insert into t_new values (p_step, 0, null, null, null, null);
  end if;
  insert into t_seen
  select id from public.account_events where student_id = '00000000-0000-0000-0000-000000005a02' and id not in (select id from t_seen);
end
$$;

select pg_temp.run_as('00000000-0000-0000-0000-000000005a12', $$select public.staff_begin_password_reset('00000000-0000-0000-0000-000000005a02')$$);
select pg_temp.collect('1 reset');
select pg_temp.run_as('00000000-0000-0000-0000-000000005a12', $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a02', 7, 'มาสาย')$$);
select pg_temp.collect('2 suspend');
select pg_temp.run_as('00000000-0000-0000-0000-000000005a12', $$select public.staff_unsuspend_student('00000000-0000-0000-0000-000000005a02')$$);
select pg_temp.collect('3 unsuspend');
select pg_temp.run_as('00000000-0000-0000-0000-000000005a12', $$select public.admin_set_student_name('00000000-0000-0000-0000-000000005a02', 'SA นักเรียนที่สอง', 'SA-LB-ดาวเด่น')$$);
select pg_temp.collect('4 rename');
select pg_temp.run_as('00000000-0000-0000-0000-000000005a12', $$select public.admin_check_student_delete('00000000-0000-0000-0000-000000005a02')$$);
select pg_temp.collect('5 check_delete');

select is((select string_agg(concat_ws('|', step, n, action, actor_name, student_name), E'\n' order by step) from t_new),
  E'1 reset|1|password_reset|SA แอดมิน|SA ชื่อใหม่\n' ||
  E'2 suspend|1|suspend|SA แอดมิน|SA ชื่อใหม่\n' ||
  E'3 unsuspend|1|unsuspend|SA แอดมิน|SA ชื่อใหม่\n' ||
  E'4 rename|1|rename|SA แอดมิน|SA นักเรียนที่สอง\n' ||
  '5 check_delete|0',
  'each command writes exactly one event with actor_name and student_name; the delete check writes none');
select ok((select detail like '%มาสาย%' and detail like '%7%' from t_new where step = '2 suspend'), 'the suspend event keeps the duration and the reason');
select ok((select detail like '%SA ชื่อใหม่%' and detail like '%SA นักเรียนที่สอง%' from t_new where step = '4 rename'), 'the rename event keeps the old and new names');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a12","role":"authenticated"}', true);
set local role authenticated;
select is(public.admin_check_student_delete('00000000-0000-0000-0000-000000005a02'), 'SA นักเรียนที่สอง', 'admin_check_student_delete returns the full name');
reset role;

-- admin_record_student_deleted: only for a profile that no longer exists
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a12',
  $$select public.admin_record_student_deleted('00000000-0000-0000-0000-000000005a02', 'SA นักเรียนที่สอง')$$), 'invalid_input', 'recording a delete of an existing profile = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a11',
  $$select public.admin_record_student_deleted('00000000-0000-0000-0000-000000005a99', 'SA ลบแล้ว')$$), 'not_admin', 'teacher -> admin_record_student_deleted = not_admin');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a12',
  $$select public.admin_record_student_deleted('00000000-0000-0000-0000-000000005a99', '  ')$$), 'invalid_input', 'blank name = invalid_input');
select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a12',
  $$select public.admin_record_student_deleted('00000000-0000-0000-0000-000000005a99', 'SA ลบแล้ว')$$), 'ok', 'recording a real delete is accepted');
select is((select string_agg(action || '|' || actor_name || '|' || student_name, ',') from public.account_events
           where student_id = '00000000-0000-0000-0000-000000005a99'),
  'delete|SA แอดมิน|SA ลบแล้ว', 'the delete event is recorded with the given name');

-- clients cannot change history or status rows (no privilege, so nothing changes)
create temp table t_hist as select id, detail from public.account_events where student_id = '00000000-0000-0000-0000-000000005a02';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a12","role":"authenticated"}', true);
select throws_ok($$update public.account_events set detail = 'แก้' where student_id = '00000000-0000-0000-0000-000000005a02'$$,
  '42501', null, 'staff cannot update account_events');
select throws_ok($$delete from public.account_events where student_id = '00000000-0000-0000-0000-000000005a02'$$,
  '42501', null, 'staff cannot delete account_events');
select throws_ok($$insert into public.account_events (student_id, student_name, actor_name, action) values ('00000000-0000-0000-0000-000000005a02', 'x', 'x', 'rename')$$,
  '42501', null, 'staff cannot insert account_events directly');
select throws_ok($$update public.account_status set suspended_until = null where student_id = '00000000-0000-0000-0000-000000005a01'$$,
  '42501', null, 'staff cannot update account_status directly');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a01","role":"authenticated"}', true);
select throws_ok($$update public.account_status set suspended_until = null where student_id = '00000000-0000-0000-0000-000000005a01'$$,
  '42501', null, 'a student cannot lift their own suspension');
select throws_ok($$delete from public.account_status where student_id = '00000000-0000-0000-0000-000000005a01'$$,
  '42501', null, 'a student cannot delete their own status row');
reset role;
select is_empty($$
  (select id, detail from t_hist except select id, detail from public.account_events where student_id = '00000000-0000-0000-0000-000000005a02')
  union all
  (select id, detail from public.account_events where student_id = '00000000-0000-0000-0000-000000005a02' except select id, detail from t_hist)
$$, 'the attempts above affected 0 event rows');
select is((select suspended_until from public.account_status where student_id = '00000000-0000-0000-0000-000000005a01'),
  'infinity'::timestamptz, 'the attempts above left the suspension in place');

-- ---------------------------------------------------------------------------------------------------------
-- 5. Who can read what
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.run_as('00000000-0000-0000-0000-000000005a12', $$select public.staff_begin_password_reset('00000000-0000-0000-0000-000000005a01')$$);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a01","role":"authenticated"}', true);
select is((select array_agg(student_id) from public.account_status), array['00000000-0000-0000-0000-000000005a01'::uuid],
  'a student selects only their own account_status');
select is((select count(*) from public.account_events), 0::bigint, 'a student sees no account_events');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a11","role":"authenticated"}', true);
select is((select count(*) from public.account_status where student_id in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a02')),
  2::bigint, 'staff read every account_status row');
select ok((select count(*) from public.account_events where student_id = '00000000-0000-0000-0000-000000005a02') >= 4, 'staff read account_events');

-- clear_must_change_password: only the caller's row
select is((select array_agg(must_change_password order by student_id) from public.account_status
           where student_id in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a02')),
  array[true, true], 'both students must change their password');
select lives_ok($$select public.clear_must_change_password()$$, 'a teacher (no status row) may call clear_must_change_password');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a01","role":"authenticated"}', true);
select lives_ok($$select public.clear_must_change_password()$$, 'a student clears their own flag');
reset role;
select is((select array_agg(must_change_password order by student_id) from public.account_status
           where student_id in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a02')),
  array[false, true], 'clear_must_change_password cleared only the caller''s row');

-- staff_get_student / staff_list_account_events
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a11","role":"authenticated"}', true);
select is((select concat_ws('|', full_name, email, suspended_until::text, suspend_reason, suspended_by_name, must_change_password, is_demo)
           from public.staff_get_student('00000000-0000-0000-0000-000000005a01')),
  'SA ชื่อ จริง|sa-s1@example.test|infinity|จนกว่าจะปลด|SA ครู|f|f', 'staff_get_student returns status, reason and who suspended');
select is((select is_demo from public.staff_get_student('00000000-0000-0000-0000-000000005a03')), true, 'staff_get_student reports demo students');
select is((select count(*) from public.staff_list_account_events('00000000-0000-0000-0000-000000005a02', 2)), 2::bigint, 'p_limit limits the history');
select ok((select bool_and(ok) from (
  select coalesce(e.created_at <= lag(e.created_at) over (order by e.ord), true) as ok
  from public.staff_list_account_events('00000000-0000-0000-0000-000000005a02') with ordinality e(id, student_id, student_name, actor_id, actor_name, action, detail, created_at, ord)) x),
  'history is newest first');

-- Demo staff and real students (review I1, ruling R16): no email, reason, suspender or history
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a13","role":"authenticated"}', true);
select is((select concat_ws('|', full_name, coalesce(email, '<null>'), suspended_until::text, coalesce(suspend_reason, '<null>'),
                            coalesce(suspended_by_name, '<null>'), is_demo)
           from public.staff_get_student('00000000-0000-0000-0000-000000005a01')),
  'SA ชื่อ จริง|<null>|infinity|<null>|<null>|f', 'demo staff get no email, reason or suspender for a real student');
select is((select email || '|' || is_demo from public.staff_get_student('00000000-0000-0000-0000-000000005a03')),
  'sa-ds@example.test|true', 'demo staff still get a demo student''s email');
select is((select count(*) from public.staff_list_account_events('00000000-0000-0000-0000-000000005a02')), 0::bigint,
  'demo staff see no history of a real student');
select is((select count(*) from public.staff_list_account_events('00000000-0000-0000-0000-000000005a99')), 0::bigint,
  'demo staff see no history of a deleted student');
select ok((select count(*) from public.staff_list_account_events('00000000-0000-0000-0000-000000005a03')) > 0,
  'demo staff see the history of a demo student');
reset role;

-- Direct table reads (ruling R16a): the RLS select policies apply the same rule as the functions
insert into public.account_status (student_id, must_change_password)
  values ('00000000-0000-0000-0000-000000005a13', false); -- a status row of the demo teacher itself
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a13","role":"authenticated"}', true);
select is((select count(*) from public.account_status
           where student_id in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a02')),
  0::bigint, 'demo staff select no account_status row of a real student');
select is((select count(*) from public.account_events
           where student_id in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a02', '00000000-0000-0000-0000-000000005a99')),
  0::bigint, 'demo staff select no account_events row of a real or deleted student');
select is((select count(*) from public.account_status where student_id = '00000000-0000-0000-0000-000000005a03'), 1::bigint,
  'demo staff select a demo student''s account_status row');
select ok((select count(*) from public.account_events where student_id = '00000000-0000-0000-0000-000000005a03') > 0,
  'demo staff select a demo student''s account_events rows');
select is((select array_agg(student_id) from public.account_status where student_id = '00000000-0000-0000-0000-000000005a13'),
  array['00000000-0000-0000-0000-000000005a13'::uuid], 'demo staff still select their own account_status row');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a14","role":"authenticated"}', true);
select is((select count(*) from public.account_status where student_id in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a02'))
          + (select count(*) from public.account_events where student_id = '00000000-0000-0000-0000-000000005a02'),
  0::bigint, 'a demo admin selects no real student''s rows either');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a12","role":"authenticated"}', true);
select is((select count(*) from public.account_status
           where student_id in ('00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-000000005a02', '00000000-0000-0000-0000-000000005a03', '00000000-0000-0000-0000-000000005a13')),
  4::bigint, 'real staff still select every account_status row (real, demo and staff targets)');
select ok((select count(*) from public.account_events where student_id = '00000000-0000-0000-0000-000000005a99') = 1,
  'real staff still select the history of a deleted student');
reset role;
delete from public.account_status where student_id = '00000000-0000-0000-0000-000000005a13';

-- ---------------------------------------------------------------------------------------------------------
-- 6. leaderboard skips students who are suspended at p_now
-- ---------------------------------------------------------------------------------------------------------
insert into public.ledger_entries (student_id, kind, points, carbon_kg) values
  ('00000000-0000-0000-0000-000000005a02', 'earn', 10, 1000000);
select pg_temp.run_as('00000000-0000-0000-0000-000000005a11', $$select public.staff_unsuspend_student('00000000-0000-0000-0000-000000005a02')$$);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a11","role":"authenticated"}', true);
select ok(exists (select 1 from public.leaderboard('all') where display_name = 'SA-LB-ดาวเด่น'), 'an active student with a large total is on the board');
reset role;
select pg_temp.run_as('00000000-0000-0000-0000-000000005a11', $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a02', 1, 'พัก')$$);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a11","role":"authenticated"}', true);
select ok(not exists (select 1 from public.leaderboard('all') where display_name = 'SA-LB-ดาวเด่น'), 'leaderboard(all) skips a student suspended until tomorrow');
select ok(exists (select 1 from public.leaderboard('all', now() + interval '2 days') where display_name = 'SA-LB-ดาวเด่น'), 'and includes them again two days later');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 7. staff_list_students: search, sort, filter, total
-- ---------------------------------------------------------------------------------------------------------
insert into public.ledger_entries (student_id, kind, points, carbon_kg) values
  ('00000000-0000-0000-0000-000000005a05', 'earn', 2000000000, 0);
-- independent recomputes, as the table owner
select set_config('t.all', (select count(*)::text from public.profiles where role = 'student'), true);
select set_config('t.demo', (select count(*)::text from public.profiles where role = 'student' and is_demo), true);
select set_config('t.susp', (select count(*)::text from public.profiles p join public.account_status s on s.student_id = p.id
                             where p.role = 'student' and s.suspended_until > now()), true);
select set_config('t.must', (select count(*)::text from public.profiles p join public.account_status s on s.student_id = p.id
                             where p.role = 'student' and s.must_change_password), true);
select set_config('t.active', (select count(*)::text from public.profiles p left join public.account_status s on s.student_id = p.id
                               where p.role = 'student' and not coalesce(s.suspended_until > now(), false)
                                 and not coalesce(s.must_change_password, false)), true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a11","role":"authenticated"}', true);
select is((select array_agg(id::text || '|' || total) from public.staff_list_students('FINDME-q7x', 'date', 'desc', 'all', 12, 0)),
  array['00000000-0000-0000-0000-000000005a04|1'], 'search matches the email (case-insensitive) and total counts the matches');
select is((select array_agg(id) from public.staff_list_students('SAX%Z', 'name', 'asc', 'all', 12, 0)),
  array['00000000-0000-0000-0000-000000005a04'::uuid], 'search treats % literally');
select is((select array_agg(id) from public.staff_list_students(' SA ครูสอง ', 'name', 'asc', 'all', 12, 0)),
  null::uuid[], 'search returns students only');
select is((select id from public.staff_list_students(null, 'points', 'desc', 'all', 12, 0) limit 1),
  '00000000-0000-0000-0000-000000005a05'::uuid, 'sort points desc puts the highest balance first');
select ok((select bool_and(ok) from (
  select coalesce(l.points <= lag(l.points) over (order by l.ord), true) as ok
  from public.staff_list_students(null, 'points', 'desc', 'all', 100, 0)
       with ordinality l(id, full_name, display_name, email, avatar_path, created_at, points, carbon_kg, suspended_until, must_change_password, is_demo, total, ord)) x),
  'points desc is non-increasing');
select ok((select bool_and(ok) from (
  select coalesce(l.created_at >= lag(l.created_at) over (order by l.ord), true) as ok
  from public.staff_list_students(null, 'date', 'asc', 'all', 100, 0)
       with ordinality l(id, full_name, display_name, email, avatar_path, created_at, points, carbon_kg, suspended_until, must_change_password, is_demo, total, ord)) x),
  'date asc is non-decreasing');
select is((select max(total) from public.staff_list_students(null, 'date', 'desc', 'all', 2, 0)), current_setting('t.all')::bigint,
  'total counts every student');
select ok((select count(*) <= 2 from public.staff_list_students(null, 'date', 'desc', 'all', 2, 0)), 'p_limit limits the page');
select is((select array[bool_and(suspended_until > now()), bool_or(id = '00000000-0000-0000-0000-000000005a02'), bool_or(id = '00000000-0000-0000-0000-000000005a01')]
           from public.staff_list_students(null, 'date', 'desc', 'suspended', 100, 0)),
  array[true, true, true], 'status suspended returns only suspended students (fixtures included)');
select is((select max(total) from public.staff_list_students(null, 'date', 'desc', 'suspended', 1, 0)), current_setting('t.susp')::bigint,
  'suspended total matches an independent count');
select is((select max(total) from public.staff_list_students(null, 'date', 'desc', 'must_change', 1, 0)), current_setting('t.must')::bigint,
  'must_change total matches an independent count');
select is((select max(total) from public.staff_list_students(null, 'date', 'desc', 'active', 1, 0)), current_setting('t.active')::bigint,
  'active total matches an independent count');
select throws_ok($$select * from public.staff_list_students(null, 'price', 'desc', 'all', 12, 0)$$, 'P0001', 'invalid_input', 'unknown sort = invalid_input');
select throws_ok($$select * from public.staff_list_students(null, 'date', 'desc', 'banned', 12, 0)$$, 'P0001', 'invalid_input', 'unknown status = invalid_input');

-- a demo caller lists demo students only, and total counts only those (ruling R16)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a14","role":"authenticated"}', true);
select is((select array[bool_and(is_demo), bool_or(id = '00000000-0000-0000-0000-000000005a03')]
           from public.staff_list_students(null, 'date', 'desc', 'all', 100, 0)),
  array[true, true], 'demo staff list only demo students (the demo fixture included)');
select is((select max(total) from public.staff_list_students(null, 'date', 'desc', 'all', 1, 0)), current_setting('t.demo')::bigint,
  'demo staff total counts only demo students');
select is((select array_agg(id) from public.staff_list_students('FINDME-q7x', 'date', 'desc', 'all', 12, 0)),
  null::uuid[], 'demo staff cannot find a real student by email');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- 8. Session revocation (review I2, ruling R15): reset and suspend end the target's Auth sessions (refresh tokens
--    cascade); other users' sessions and refused commands are untouched.
-- ---------------------------------------------------------------------------------------------------------
insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-00000005e501', '00000000-0000-0000-0000-000000005a04'),
  ('00000000-0000-0000-0000-00000005e502', '00000000-0000-0000-0000-000000005a04'),
  ('00000000-0000-0000-0000-00000005e503', '00000000-0000-0000-0000-000000005a05'),
  ('00000000-0000-0000-0000-00000005e504', '00000000-0000-0000-0000-000000005a01'),
  ('00000000-0000-0000-0000-00000005e505', '00000000-0000-0000-0000-000000005a01'),
  ('00000000-0000-0000-0000-00000005e506', '00000000-0000-0000-0000-000000005a11');
insert into auth.refresh_tokens (token, user_id, session_id, revoked) values
  ('sa-rt-5a04', '00000000-0000-0000-0000-000000005a04', '00000000-0000-0000-0000-00000005e501', false),
  ('sa-rt-5a01', '00000000-0000-0000-0000-000000005a01', '00000000-0000-0000-0000-00000005e504', false);

select pg_temp.run_as('00000000-0000-0000-0000-000000005a11', $$select public.staff_begin_password_reset('00000000-0000-0000-0000-000000005a04')$$);
select is((select count(*) from auth.sessions where user_id = '00000000-0000-0000-0000-000000005a04'), 0::bigint,
  'a password reset ends every session of the student');
select is((select count(*) from auth.refresh_tokens where token = 'sa-rt-5a04'), 0::bigint,
  'the refresh tokens of those sessions go with them');

select pg_temp.run_as('00000000-0000-0000-0000-000000005a11', $$select public.staff_suspend_student('00000000-0000-0000-0000-000000005a05', 1, 'ทดสอบเซสชัน')$$);
select is((select count(*) from auth.sessions where user_id = '00000000-0000-0000-0000-000000005a05'), 0::bigint,
  'a suspension ends every session of the student');

select is((select count(*) from auth.sessions where user_id = '00000000-0000-0000-0000-000000005a01'), 2::bigint,
  'another student''s sessions are untouched');
select is((select count(*) from auth.sessions where user_id = '00000000-0000-0000-0000-000000005a11'), 1::bigint,
  'the acting teacher''s own session is untouched');

select is(pg_temp.try_as('00000000-0000-0000-0000-000000005a14',
  $$select public.staff_begin_password_reset('00000000-0000-0000-0000-000000005a01')$$), 'demo_scope', 'a refused reset (demo_scope) ...');
select is((select count(*) from auth.refresh_tokens where token = 'sa-rt-5a01') + (select count(*) from auth.sessions where user_id = '00000000-0000-0000-0000-000000005a01'),
  3::bigint, '... ends no session');

select * from finish();
rollback;
