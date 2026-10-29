-- Redesign 3: staff_names(uuid[]) public lookup. ids: student ...5a11, teacher ...5a21, admin ...5a31
begin;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000005a11', 'sn-s@example.test', '{"full_name":"SN นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a21', 'sn-t@example.test', '{"full_name":"SN ครู"}'::jsonb),
  ('00000000-0000-0000-0000-000000005a31', 'sn-a@example.test', '{"full_name":"SN แอดมิน"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000005a21';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000005a31';

select has_function('public', 'staff_names', array['uuid[]'], 'staff_names(uuid[]) exists');

set local role anon;
select is((select count(*) from public.staff_names(array['00000000-0000-0000-0000-000000005a21', '00000000-0000-0000-0000-000000005a31',
  '00000000-0000-0000-0000-000000005a11', gen_random_uuid()]::uuid[])), 2::bigint,
  'anon gets only the teacher and admin (no student, no unknown id)');
select is((select name from public.staff_names(array['00000000-0000-0000-0000-000000005a21']::uuid[])), 'SN ครู',
  'a teacher without display_name is returned by full_name');
reset role;

update public.profiles set display_name = '  ' where id = '00000000-0000-0000-0000-000000005a21';
set local role anon;
select is((select name from public.staff_names(array['00000000-0000-0000-0000-000000005a21']::uuid[])), 'SN ครู',
  'a blank display_name falls back to full_name');
reset role;

update public.profiles set display_name = 'ครูเอ' where id = '00000000-0000-0000-0000-000000005a21';
set local role anon;
select is((select name from public.staff_names(array['00000000-0000-0000-0000-000000005a21']::uuid[])), 'ครูเอ',
  'display_name wins when set');
select lives_ok($$select * from public.staff_names((select array_agg(gen_random_uuid()) from generate_series(1, 150)))$$,
  '150 ids do not error');
reset role;

-- only the first 100 ids are evaluated: the teacher placed at position 101 is not returned
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005a11","role":"authenticated"}', true);
select is((select count(*) from public.staff_names(
  (select array_agg(gen_random_uuid()) from generate_series(1, 100)) || array['00000000-0000-0000-0000-000000005a21']::uuid[])),
  0::bigint, 'ids past position 100 are ignored (authenticated can call it too)');
select is((select count(*) from public.staff_names(null)), 0::bigint, 'null array returns no rows');
reset role;

select * from finish();
rollback;
