-- Part A polish (Task 18 Part B, R126; spec 8.1-8.3).
-- Whitespace-aware name rules (profiles check, handle_new_user, profile_display_name), the
-- set_user_role pre-check, and anon UPDATE on waste_categories. Per-id predicates only; rolls back.
-- ids: admin A ...f301, teacher T ...f302, students S1 ...f303, S2 ...f304; sign-ups ...f305, ...f306, ...f307
begin;
select plan(24);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000f301', 'pol-a1@example.test', '{"full_name":"แอดมิน ขัดเกลา"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f302', 'pol-t1@example.test', '{"full_name":"ครู ขัดเกลา"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f303', 'pol-s1@example.test', '{"full_name":"นักเรียน ขัดเกลา"}'::jsonb),
  ('00000000-0000-0000-0000-00000000f304', 'pol-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb);
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000f301';
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-00000000f302';

-- 1-6: full_name check trims every kind of whitespace ----------------------------------------------
select throws_ok($$update public.profiles set full_name = E'\t' where id = '00000000-0000-0000-0000-00000000f303'$$,
  '23514', null, 'a tab-only full_name is rejected');
select throws_ok($$update public.profiles set full_name = E'\n' where id = '00000000-0000-0000-0000-00000000f303'$$,
  '23514', null, 'a newline-only full_name is rejected');
select throws_ok($$update public.profiles set full_name = E' \r\n\t ' where id = '00000000-0000-0000-0000-00000000f303'$$,
  '23514', null, 'a mixed-whitespace full_name is rejected');
select throws_ok($$update public.profiles set full_name = E'\n' || repeat('ก', 101) where id = '00000000-0000-0000-0000-00000000f303'$$,
  '23514', null, 'a 101-character name is still rejected after trimming');
select lives_ok($$update public.profiles set full_name = E'\n' || repeat('ก', 100) || E'\t' where id = '00000000-0000-0000-0000-00000000f303'$$,
  'a 100-character name padded with whitespace is accepted');
select is((select count(*) from public.profiles
           where char_length(regexp_replace(full_name, '^\s+|\s+$', '', 'g')) not between 1 and 100), 0::bigint,
  'no profile has a blank or over-long full_name (existing rows repaired)');

-- 7-9: handle_new_user trims every kind of whitespace -----------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000f305', 'pol-signup-blank@example.test', jsonb_build_object('full_name', E'\t\n ')),
  ('00000000-0000-0000-0000-00000000f306', 'pol-signup-pad@example.test', jsonb_build_object('full_name', E'\n สมหญิง ใจงาม\t'));
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000f305'), 'pol-signup-blank',
  'a whitespace-only signup name falls back to the e-mail name');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000f306'), 'สมหญิง ใจงาม',
  'a signup name is trimmed of newlines and tabs');
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000f306'), 'สมหญิง ใจงาม',
  'the signup display_name is the trimmed name');
-- 0022: clipping display_name to 50 must not leave trailing whitespace (49 letters, a space, more)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000f307', 'pol-signup-clip@example.test',
   jsonb_build_object('full_name', repeat('ก', 49) || ' ' || repeat('ข', 10)));
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000f307'), repeat('ก', 49),
  'a display_name clipped to 50 is trimmed again');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000f307'),
  repeat('ก', 49) || ' ' || repeat('ข', 10), 'the full_name of that signup is kept whole');

-- 10-15: profile_display_name fallbacks ---------------------------------------------------------------
update public.profiles set display_name = E'\n' where id = '00000000-0000-0000-0000-00000000f303';
update public.profiles set full_name = 'นักเรียน ขัดเกลา' where id = '00000000-0000-0000-0000-00000000f303';
select is(public.profile_display_name('00000000-0000-0000-0000-00000000f303'), 'นักเรียน ขัดเกลา',
  'a newline-only display_name falls back to full_name');
update public.profiles set display_name = E'\t \t' where id = '00000000-0000-0000-0000-00000000f303';
select is(public.profile_display_name('00000000-0000-0000-0000-00000000f303'), 'นักเรียน ขัดเกลา',
  'a tab-only display_name falls back to full_name');
update public.profiles set display_name = E'\n ฮีโร่รักษ์โลก \t' where id = '00000000-0000-0000-0000-00000000f303';
select is(public.profile_display_name('00000000-0000-0000-0000-00000000f303'), 'ฮีโร่รักษ์โลก',
  'a display_name is shown trimmed');
-- rows from before the check (simulated by dropping it inside this transaction)
alter table public.profiles drop constraint profiles_full_name_length;
update public.profiles set full_name = E'\n\t', display_name = E'\n' where id = '00000000-0000-0000-0000-00000000f304';
select is(public.profile_display_name('00000000-0000-0000-0000-00000000f304'), 'ไม่ระบุชื่อ',
  'whitespace-only display_name and full_name fall back to ไม่ระบุชื่อ');
select is(has_function_privilege('authenticated', 'public.profile_display_name(uuid)', 'EXECUTE'), false,
  'profile_display_name stays closed to signed-in users');
select is(has_function_privilege('service_role', 'public.profile_display_name(uuid)', 'EXECUTE'), true,
  'profile_display_name stays open to service_role');

-- 16-20: set_user_role pre-check before the lock, re-check after it ------------------------------------
select ok((select position('is_admin()' in prosrc) > 0
                  and position('is_admin()' in prosrc) < position('pg_advisory_xact_lock' in prosrc)
           from pg_proc where oid = 'public.set_user_role(uuid, text)'::regprocedure),
  'set_user_role checks is_admin() before taking the advisory lock');
select ok((select position('not_admin' in substr(prosrc, position('pg_advisory_xact_lock' in prosrc))) > 0
           from pg_proc where oid = 'public.set_user_role(uuid, text)'::regprocedure),
  'set_user_role re-checks the caller after the lock');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f302","role":"authenticated"}', true);
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f303', 'teacher')$$,
  '42501', 'not_admin', 'a teacher is refused by the pre-check');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f303","role":"authenticated"}', true);
select throws_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f303', 'admin')$$,
  '42501', 'not_admin', 'a student cannot promote themself');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f301","role":"authenticated"}', true);
select lives_ok($$select public.set_user_role('00000000-0000-0000-0000-00000000f303', 'teacher')$$,
  'an admin still changes a role');
reset role;

-- 21-22: anon has no UPDATE on waste_categories ----------------------------------------------------
select is(has_table_privilege('anon', 'public.waste_categories', 'UPDATE'), false, 'anon has no table UPDATE on waste_categories');
select is(has_any_column_privilege('anon', 'public.waste_categories', 'UPDATE'), false,
  'anon has no column UPDATE on waste_categories');

select * from finish();
rollback;
