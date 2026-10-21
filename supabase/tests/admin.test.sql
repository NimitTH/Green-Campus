-- Admin tools (Task 18 Part A, R113-R117; spec 5.1, 7, 8.1-8.3).
-- set_user_role / adjust_ledger, waste_categories hardening, profile name checks.
-- Per-user predicates only (the local DB holds e2e leftovers). For the last-admin cases every other
-- non-demo admin is turned into a teacher first (as postgres); everything rolls back at the end.
-- ids: real admins A1 ...f101, A2 ...f102; demo admin D ...f103; teacher T ...f104;
--   students S1 ...f105 (10 points, 2.5 kg carbon), S2 ...f106, S3 ...f107; unknown ...f1ff
begin;
select plan(110);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000f101', 'adm-a1@example.test', '{"full_name":"แอดมิน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f102', 'adm-a2@example.test', '{"full_name":"แอดมิน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f103', 'adm-demo@example.test', '{"full_name":"แอดมิน สาธิต"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f104', 'adm-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f105', 'adm-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f106', 'adm-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f107', 'adm-s3@example.test', '{"full_name":"นักเรียน สาม"}'::jsonb);
update public.profiles set role = 'admin'
where id in ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f102', '00000000-0000-0000-0000-00000000f103');
update public.profiles set is_demo = true where id = '00000000-0000-0000-0000-00000000f103';
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000f104';
-- deterministic last-admin scenario: A1 and A2 are the only non-demo admins
update public.profiles set role = 'teacher'
where role = 'admin' and not is_demo and id::text not like '00000000-0000-0000-0000-00000000f1%';
insert into public.ledger_entries (student_id, kind, points, carbon_kg, note) values
  ('00000000-0000-0000-0000-00000000f105', 'earn', 10, 2.5, 'test');

-- shape and privileges ------------------------------------------------------------------
select has_function('public', 'set_user_role', array['uuid', 'text'], 'set_user_role(uuid, text) exists');
select has_function('public', 'adjust_ledger', array['uuid', 'integer', 'numeric', 'text'],
  'adjust_ledger(uuid, int, numeric, text) exists');
select is_definer('public', 'set_user_role', array['uuid', 'text'], 'set_user_role is security definer');
select is_definer('public', 'adjust_ledger', array['uuid', 'integer', 'numeric', 'text'], 'adjust_ledger is security definer');
select function_returns('public', 'set_user_role', array['uuid', 'text'], 'void', 'set_user_role returns void');
select function_returns('public', 'adjust_ledger', array['uuid', 'integer', 'numeric', 'text'], 'void', 'adjust_ledger returns void');
select is((select p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'set_user_role'), array['search_path=""'],
  'set_user_role has an empty search_path');
select is((select p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'adjust_ledger'), array['search_path=""'],
  'adjust_ledger has an empty search_path');
select ok(not has_function_privilege('anon', 'public.set_user_role(uuid, text)', 'execute'), 'anon cannot execute set_user_role');
select ok(not has_function_privilege('anon', 'public.adjust_ledger(uuid, integer, numeric, text)', 'execute'),
  'anon cannot execute adjust_ledger');
select ok(has_function_privilege('authenticated', 'public.set_user_role(uuid, text)', 'execute'),
  'authenticated can execute set_user_role');
select ok(has_function_privilege('authenticated', 'public.adjust_ledger(uuid, integer, numeric, text)', 'execute'),
  'authenticated can execute adjust_ledger');
select ok(pg_get_functiondef('public.set_user_role(uuid, text)'::regprocedure)
            like '%pg_advisory_xact_lock(hashtext(''public.set_user_role''))%',
  'set_user_role serializes on an advisory lock');
select ok(pg_get_functiondef('public.set_user_role(uuid, text)'::regprocedure) !~* 'for\s+(no\s+key\s+)?update',
  'set_user_role takes no profile row lock');
select ok(pg_get_functiondef('public.adjust_ledger(uuid, integer, numeric, text)'::regprocedure) ~* 'for\s+no\s+key\s+update',
  'adjust_ledger locks the student FOR NO KEY UPDATE');
select ok(pg_get_functiondef('public.adjust_ledger(uuid, integer, numeric, text)'::regprocedure) !~* '[^y]\s+for\s+update',
  'adjust_ledger never takes FOR UPDATE');

-- who may call -------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f106', 'teacher')$$,
  '42501', 'not_authenticated', 'set_user_role without a user raises not_authenticated');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 1, 0, 'x')$$,
  '42501', 'not_authenticated', 'adjust_ledger without a user raises not_authenticated');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f104","role":"authenticated"}', true);
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f106', 'teacher')$$,
  '42501', 'not_admin', 'a teacher calling set_user_role raises not_admin');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 1, 0, 'x')$$,
  '42501', 'not_admin', 'a teacher calling adjust_ledger raises not_admin');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f105","role":"authenticated"}', true);
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f105', 'admin')$$,
  '42501', 'not_admin', 'a student cannot promote themselves');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 100, 0, 'x')$$,
  '42501', 'not_admin', 'a student cannot adjust their own points');
reset role;

-- set_user_role input errors -------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}', true);
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f106', 'superuser')$$,
  'P0001', 'invalid_role', 'an unknown role raises invalid_role');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f106', null)$$,
  'P0001', 'invalid_role', 'a null role raises invalid_role');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f1ff', 'teacher')$$,
  'P0001', 'user_not_found', 'an unknown user raises user_not_found');
select throws_ok($$select public.set_user_role(null, 'teacher')$$,
  'P0001', 'user_not_found', 'a null user raises user_not_found');

-- a real admin changes a student to teacher and back; same-role is a no-op ----------------
select lives_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f106', 'teacher')$$,
  'A1 makes S2 a teacher');
reset role;
select is((select role from public.profiles where id = '00000000-0000-0000-0000-00000000f106'), 'teacher', 'S2 is now a teacher');
select is((select count(*) from public.notifications
           where user_id = '00000000-0000-0000-0000-00000000f106' and type = 'role_changed'), 1::bigint,
  'S2 got one role_changed notification');
select ok(exists (select 1 from public.notifications
                  where user_id = '00000000-0000-0000-0000-00000000f106' and type = 'role_changed'
                    and title = 'บทบาทของคุณถูกเปลี่ยน' and body like '%ครู%'),
  'the notification has the Thai title and names the new role (ครู)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}', true);
select lives_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f106', 'teacher')$$,
  'the same role again is accepted');
reset role;
select is((select count(*) from public.notifications
           where user_id = '00000000-0000-0000-0000-00000000f106' and type = 'role_changed'), 1::bigint,
  'a same-role call is a no-op (no second notification)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}', true);
select lives_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f106', 'student')$$,
  'A1 makes S2 a student again');
reset role;
select is((select role from public.profiles where id = '00000000-0000-0000-0000-00000000f106'), 'student', 'S2 is a student again');
select ok(exists (select 1 from public.notifications
                  where user_id = '00000000-0000-0000-0000-00000000f106' and type = 'role_changed' and body like '%นักเรียน%'),
  'the second notification names นักเรียน');

-- demo admin rules (spec 8.3) -------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}', true);
select lives_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f107', 'teacher')$$,
  'a demo admin may make a student a teacher');
select lives_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f107', 'student')$$,
  'a demo admin may make a teacher a student');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f107', 'admin')$$,
  'P0001', 'demo_forbidden', 'a demo admin cannot grant admin');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f102', 'teacher')$$,
  'P0001', 'demo_forbidden', 'a demo admin cannot change a real admin''s role');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f101', 'student')$$,
  'P0001', 'demo_forbidden', 'a demo admin cannot demote a real admin to student');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f102', 'admin')$$,
  'P0001', 'demo_forbidden', 'a demo admin cannot even re-grant admin to a real admin');
reset role;
select is((select role from public.profiles where id = '00000000-0000-0000-0000-00000000f107'), 'student', 'S3 ends as a student');
select is((select count(*) from public.notifications
           where user_id = '00000000-0000-0000-0000-00000000f107' and type = 'role_changed'), 2::bigint,
  'S3 got two role_changed notifications');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-00000000f102'), 'admin', 'A2 is still an admin');
select is((select count(*) from public.notifications
           where user_id = '00000000-0000-0000-0000-00000000f102' and type = 'role_changed'), 0::bigint,
  'A2 got no notification from the refused calls');

-- last non-demo admin -----------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}', true);
select lives_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f102', 'teacher')$$,
  'A1 demotes A2 (A1 remains)');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f101', 'teacher')$$,
  'P0001', 'last_admin', 'the last non-demo admin cannot demote themselves (a demo admin still exists)');
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f101', 'student')$$,
  'P0001', 'last_admin', 'nor to student');
reset role;
select is((select role from public.profiles where id = '00000000-0000-0000-0000-00000000f101'), 'admin', 'A1 is still an admin');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-00000000f103'), 'admin', 'the demo admin exists meanwhile');
select ok(exists (select 1 from public.notifications
                  where user_id = '00000000-0000-0000-0000-00000000f102' and type = 'role_changed' and body like '%ครู%'),
  'A2 was told they are now ครู');
-- A2 promoted again names ผู้ดูแลระบบ; then A1 may step down because A2 remains
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}', true);
select lives_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f102', 'admin')$$, 'A1 makes A2 an admin again');
select lives_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f101', 'teacher')$$,
  'A1 may demote themselves while A2 remains');
reset role;
select ok(exists (select 1 from public.notifications
                  where user_id = '00000000-0000-0000-0000-00000000f102' and type = 'role_changed' and body like '%ผู้ดูแลระบบ%'),
  'the promotion notification names ผู้ดูแลระบบ');

-- is_demo never changes; A1 is restored for the rest ------------------------------------
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000f101';
select is((select is_demo from public.profiles where id = '00000000-0000-0000-0000-00000000f103'), true, 'D is still a demo account');
select is((select count(*) from public.profiles
           where id in ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f102',
                        '00000000-0000-0000-0000-00000000f106', '00000000-0000-0000-0000-00000000f107') and is_demo),
  0::bigint, 'set_user_role never sets is_demo');
select ok(pg_get_functiondef('public.set_user_role(uuid, text)'::regprocedure) !~* 'is_demo\s*=\s*(true|false)',
  'set_user_role never writes is_demo');

-- adjust_ledger input errors -------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}', true);
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 5, 0, null)$$,
  'P0001', 'note_required', 'adjust without a note raises note_required');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 5, 0, '   ')$$,
  'P0001', 'note_required', 'a whitespace note raises note_required');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 5, 0, E'\n\t \r\n')$$,
  'P0001', 'note_required', 'a newline/tab-only note raises note_required');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 5, 0, repeat('ก', 501))$$,
  'P0001', 'note_too_long', 'a 501-character note raises note_too_long');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 0, 0, 'x')$$,
  'P0001', 'empty_adjust', 'zero points and zero carbon raise empty_adjust');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 0, 0.0004, 'x')$$,
  'P0001', 'empty_adjust', 'carbon that rounds to 0.000 counts as empty');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f104', 5, 0, 'x')$$,
  'P0001', 'not_student_target', 'a teacher target raises not_student_target');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f1ff', 5, 0, 'x')$$,
  'P0001', 'not_student_target', 'an unknown target raises not_student_target');
select throws_ok($$select public.adjust_ledger(null, 5, 0, 'x')$$,
  'P0001', 'not_student_target', 'a null target raises not_student_target');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', null, 0, 'x')$$,
  'P0001', 'invalid_adjust', 'null points raise invalid_adjust');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 5, null, 'x')$$,
  'P0001', 'invalid_adjust', 'null carbon raises invalid_adjust');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 0, 1000000000, 'x')$$,
  'P0001', 'invalid_adjust', 'carbon beyond numeric(12,3) raises invalid_adjust');

-- never below zero (R100) ----------------------------------------------------------------
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', -11, 0, 'หักเกิน')$$,
  'P0001', 'insufficient_balance', 'balance 10, adjust -11 raises insufficient_balance');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 0, -2.501, 'หักเกิน')$$,
  'P0001', 'insufficient_carbon', 'carbon 2.5, adjust -2.501 raises insufficient_carbon');
select lives_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', -10, -2.5, 'หักทั้งหมด')$$,
  'balance 10, adjust -10 (and carbon -2.5) passes');
reset role;
select is((select points from public.student_balance where student_id = '00000000-0000-0000-0000-00000000f105'), 0::bigint,
  'the balance is now exactly 0');
select is((select carbon_kg from public.student_balance where student_id = '00000000-0000-0000-0000-00000000f105'), 0::numeric,
  'the accumulated carbon is now exactly 0');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}', true);
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', -1, 0, 'x')$$,
  'P0001', 'insufficient_balance', 'balance 0, adjust -1 raises insufficient_balance');
select throws_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 5, -0.001, 'x')$$,
  'P0001', 'insufficient_carbon', 'carbon 0, adjust -0.001 raises insufficient_carbon even with points added');
reset role;

-- a successful adjust ---------------------------------------------------------------------
delete from public.notifications where user_id = '00000000-0000-0000-0000-00000000f105';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}', true);
select lives_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 5, 0.1234, '  โบนัสงานวันสิ่งแวดล้อม  ')$$,
  'A1 adds 5 points and 0.1234 kg');
reset role;
select is((select count(*) from public.ledger_entries
           where student_id = '00000000-0000-0000-0000-00000000f105' and kind = 'adjust' and points = 5), 1::bigint,
  'one adjust row with +5 points');
select is((select row(carbon_kg, note, created_by)::text from public.ledger_entries
           where student_id = '00000000-0000-0000-0000-00000000f105' and kind = 'adjust' and points = 5),
  row(0.123::numeric(12, 3), 'โบนัสงานวันสิ่งแวดล้อม'::text, '00000000-0000-0000-0000-00000000f101'::uuid)::text,
  'carbon rounded to 3 dp, note trimmed, created_by is the admin');
select is((select points from public.student_balance where student_id = '00000000-0000-0000-0000-00000000f105'), 5::bigint,
  'the balance rose to 5');
select is((select count(*) from public.notifications
           where user_id = '00000000-0000-0000-0000-00000000f105' and type = 'ledger_adjusted'), 1::bigint,
  'S1 got one ledger_adjusted notification');
select ok(exists (select 1 from public.notifications
                  where user_id = '00000000-0000-0000-0000-00000000f105' and type = 'ledger_adjusted'
                    and title = 'มีการปรับแต้ม' and link = '/dashboard'
                    and body like '%+5%' and body like '%+0.123%' and body like '%โบนัสงานวันสิ่งแวดล้อม%'),
  'the notification has the Thai title, signed amounts, the note and links to /dashboard');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}', true);
select lives_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', -2, 0, 'แก้ไขยอด')$$, 'A1 deducts 2 points');
reset role;
select ok(exists (select 1 from public.notifications
                  where user_id = '00000000-0000-0000-0000-00000000f105' and type = 'ledger_adjusted' and body like '%-2 แต้ม%'),
  'a deduction shows a minus sign');
-- demo admins may adjust (accepted risk, spec 8.3: demo data is resettable)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f103","role":"authenticated"}', true);
select lives_ok($$select public.adjust_ledger('00000000-0000-0000-0000-00000000f105', 1, 0, 'สาธิต')$$, 'a demo admin may adjust');
reset role;
select is((select points from public.student_balance where student_id = '00000000-0000-0000-0000-00000000f105'), 4::bigint,
  'balance 5 - 2 + 1 = 4');

-- waste_categories hardening (R115) ---------------------------------------------------------
select ok(not has_table_privilege('authenticated', 'public.waste_categories', 'insert'), 'authenticated has no INSERT on waste_categories');
select ok(not has_table_privilege('authenticated', 'public.waste_categories', 'delete'), 'authenticated has no DELETE on waste_categories');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f104","role":"authenticated"}', true);
with u as (update public.waste_categories set points_per_kg = 999 where code = 'plastic' returning 1)
select is((select count(*)::int from u), 0, 'a teacher UPDATE of waste_categories affects 0 rows (RLS)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f105","role":"authenticated"}', true);
with u as (update public.waste_categories set points_per_kg = 999 where code = 'plastic' returning 1)
select is((select count(*)::int from u), 0, 'a student UPDATE of waste_categories affects 0 rows');
reset role;
select isnt((select points_per_kg from public.waste_categories where code = 'plastic'), 999, 'plastic rate unchanged');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f101","role":"authenticated"}', true);
with u as (update public.waste_categories
           set name = 'พลาสติกทุกชนิด', points_per_kg = 12, carbon_kg_per_kg = 1.25, source_note = 'ค่าประมาณ: ทดสอบ'
           where code = 'plastic' returning 1)
select is((select count(*)::int from u), 1, 'an admin updates name, rates and source note');
select throws_ok($$update public.waste_categories set code = 'paper' where code = 'plastic'$$,
  'P0001', 'category_code_immutable', 'an admin cannot change code');
select throws_ok($$insert into public.waste_categories (name, points_per_kg, carbon_kg_per_kg, code) values ('ใหม่', 1, 0, 'other')$$,
  '42501', null, 'an admin cannot INSERT a category');
select throws_ok($$delete from public.waste_categories where code = 'other'$$,
  '42501', null, 'an admin cannot DELETE a category');
reset role;
select is((select row(name, points_per_kg, carbon_kg_per_kg)::text from public.waste_categories where code = 'plastic'),
  row('พลาสติกทุกชนิด'::text, 12, 1.25::numeric)::text, 'the admin edit persisted');
select throws_ok($$update public.waste_categories set code = 'other' where code = 'plastic'$$,
  'P0001', 'category_code_immutable', 'code is immutable even for postgres');
select lives_ok($$update public.waste_categories set code = code, name = name where code = 'paper'$$,
  'an UPDATE that keeps code is fine');
select throws_ok($$update public.waste_categories set name = '   ' where code = 'paper'$$,
  '23514', null, 'a blank category name is rejected');
select throws_ok($$update public.waste_categories set points_per_kg = -1 where code = 'paper'$$,
  '23514', null, 'negative points_per_kg is rejected');

-- profile name checks (R116) ------------------------------------------------------------
select throws_ok($$update public.profiles set full_name = '   ' where id = '00000000-0000-0000-0000-00000000f106'$$,
  '23514', null, 'a blank full_name is rejected');
select throws_ok($$update public.profiles set full_name = repeat('ก', 101) where id = '00000000-0000-0000-0000-00000000f106'$$,
  '23514', null, 'a 101-character full_name is rejected');
select lives_ok($$update public.profiles set full_name = repeat('ก', 100) where id = '00000000-0000-0000-0000-00000000f106'$$,
  'a 100-character full_name is accepted');
select throws_ok($$update public.profiles set display_name = repeat('ข', 51) where id = '00000000-0000-0000-0000-00000000f106'$$,
  '23514', null, 'a 51-character display_name is rejected');
select lives_ok($$update public.profiles set display_name = repeat('ข', 50) where id = '00000000-0000-0000-0000-00000000f106'$$,
  'a 50-character display_name is accepted');
select lives_ok($$update public.profiles set display_name = null where id = '00000000-0000-0000-0000-00000000f106'$$,
  'display_name may be null');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f106","role":"authenticated"}', true);
select throws_ok($$update public.profiles set display_name = repeat('ข', 51) where id = '00000000-0000-0000-0000-00000000f106'$$,
  '23514', null, 'a student cannot save a 51-character display_name either');
reset role;
-- sign-ups with long names still get a profile (handle_new_user clips to the limits)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000f108', repeat('a', 60) || '@example.test', '{}'::jsonb),
  ('00000000-0000-0000-0000-00000000f109', 'adm-long@example.test', jsonb_build_object('full_name', repeat('ค', 150)));
select is((select row(char_length(full_name), char_length(display_name))::text from public.profiles
           where id = '00000000-0000-0000-0000-00000000f108'), '(60,50)',
  'a 60-character email name: full_name kept, display_name clipped to 50');
select is((select row(char_length(full_name), char_length(display_name))::text from public.profiles
           where id = '00000000-0000-0000-0000-00000000f109'), '(100,50)',
  'a 150-character signup name: full_name clipped to 100, display_name to 50');
select is((select count(*) from public.profiles where char_length(btrim(full_name)) not between 1 and 100
           or char_length(display_name) > 50), 0::bigint, 'no profile breaks the name checks');

select * from finish();
rollback;
