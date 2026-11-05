-- Redesign 4 (DESIGN-4 7.1): notifications delete grant/policy, cap of 100 for students.
-- ids: students ...5b11 ...5b12 ...5b13 ...5b14, teacher ...5b21
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000005b11', 'nm-s1@example.test', '{"full_name":"NM หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000005b12', 'nm-s2@example.test', '{"full_name":"NM สอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000005b13', 'nm-s3@example.test', '{"full_name":"NM สาม"}'::jsonb),
  ('00000000-0000-0000-0000-000000005b14', 'nm-s4@example.test', '{"full_name":"NM สี่"}'::jsonb),
  ('00000000-0000-0000-0000-000000005b21', 'nm-t1@example.test', '{"full_name":"NM ครู"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000005b21';

insert into public.notifications (id, user_id, type, title, read_at) values
  ('00000000-0000-0000-0000-000000005c01', '00000000-0000-0000-0000-000000005b11', 't', 'own unread', null),
  ('00000000-0000-0000-0000-000000005c02', '00000000-0000-0000-0000-000000005b11', 't', 'own read', now()),
  ('00000000-0000-0000-0000-000000005c03', '00000000-0000-0000-0000-000000005b12', 't', 'other', null);

-- s1 as owner
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005b11","role":"authenticated"}', true);
with d as (delete from public.notifications where id = '00000000-0000-0000-0000-000000005c01' returning 1)
select is((select count(*)::int from d), 1, 'a student deletes their own notification');
with d as (delete from public.notifications where id = '00000000-0000-0000-0000-000000005c03' returning 1)
select is((select count(*)::int from d), 0, 'deleting another user''s row affects 0 rows');
with d as (delete from public.notifications where id = '00000000-0000-0000-0000-000000005c02' and read_at is not null returning 1)
select is((select count(*)::int from d), 1, 'deleting a read row by id as owner works with RLS on');
reset role;

set local role anon;
select throws_ok($$delete from public.notifications where id = '00000000-0000-0000-0000-000000005c03'$$,
  '42501', null, 'anon cannot delete');
reset role;

-- cap: student with 101 rows (oldest created_at = now() - 101 days)
insert into public.notifications (user_id, type, title, created_at)
  select '00000000-0000-0000-0000-000000005b12', 't', 'n' || i, now() - make_interval(days => 102 - i)
  from generate_series(1, 101) i;
select ok((select count(*) = 100 and bool_and(title <> 'n1') from public.notifications where user_id = '00000000-0000-0000-0000-000000005b12'),
  'a student keeps the newest 100 after the 101st insert; the oldest row is dropped');

-- teacher is not capped
insert into public.notifications (user_id, type, title, created_at)
  select '00000000-0000-0000-0000-000000005b21', 't', 'n' || i, now() - make_interval(days => 102 - i)
  from generate_series(1, 101) i;
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-000000005b21'), 101,
  'a teacher keeps all 101');

select has_trigger('public', 'notifications', 'notifications_cap', 'cap trigger exists');
select has_index('public', 'notifications', 'notifications_user_created_idx', 'user/created index exists');

-- the real path: public.notify (security definer) also caps
insert into public.notifications (user_id, type, title, created_at)
  select '00000000-0000-0000-0000-000000005b13', 't', 'm' || i, now() - make_interval(days => 101 - i)
  from generate_series(1, 100) i;
select public.notify('00000000-0000-0000-0000-000000005b13', 't', 'newest');
select ok((select count(*) = 100 and bool_and(title <> 'm1') and bool_or(title = 'newest')
           from public.notifications where user_id = '00000000-0000-0000-0000-000000005b13'),
  'notify() as the 101st row caps to 100 and drops the oldest');

select * from finish();
rollback;
