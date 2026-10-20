-- Notifications (Task 10, spec 5, 8.1, 9.5; rulings R43, R44, R47).
-- RLS/column grants for read_at, the realtime publication, and the 'activity_opened' trigger.
begin;
select plan(23);

-- ids: students ...5101 ...5102, teacher ...5201; notifications ...5601 (s1) ...5602 (s2) ...5603 (t1)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000005101', 'nt-s1@example.test', '{"full_name":"นักเรียน หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-000000005102', 'nt-s2@example.test', '{"full_name":"นักเรียน สอง"}'::jsonb),
  ('00000000-0000-0000-0000-000000005201', 'nt-t1@example.test', '{"full_name":"ครู หนึ่ง"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000005201';

insert into public.notifications (id, user_id, type, title) values
  ('00000000-0000-0000-0000-000000005601', '00000000-0000-0000-0000-000000005101', 't', 'a'),
  ('00000000-0000-0000-0000-000000005602', '00000000-0000-0000-0000-000000005102', 't', 'b'),
  ('00000000-0000-0000-0000-000000005603', '00000000-0000-0000-0000-000000005201', 't', 'c');

-- realtime publication
select is((select count(*)::int from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'),
          1, 'notifications is in the supabase_realtime publication');

-- RLS as student 1
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005101","role":"authenticated"}', true);
select is((select count(*)::int from public.notifications), 1, 's1 reads only own notifications');

select lives_ok($$update public.notifications set read_at = now() where id = '00000000-0000-0000-0000-000000005601'$$,
  's1 can set read_at on own row');
select isnt((select read_at from public.notifications where id = '00000000-0000-0000-0000-000000005601'), null,
  'read_at is set');

with u as (update public.notifications set read_at = now()
           where id = '00000000-0000-0000-0000-000000005602' returning 1)
select is((select count(*)::int from u), 0, 's1 updating another user''s row affects 0 rows');

select throws_ok($$update public.notifications set title = 'x' where id = '00000000-0000-0000-0000-000000005601'$$,
  '42501', null, 's1 cannot update title');
select throws_ok($$update public.notifications set user_id = '00000000-0000-0000-0000-000000005102' where id = '00000000-0000-0000-0000-000000005601'$$,
  '42501', null, 's1 cannot update user_id');
select throws_ok($$insert into public.notifications (user_id, type, title) values ('00000000-0000-0000-0000-000000005101', 't', 'x')$$,
  '42501', null, 's1 cannot insert');
select throws_ok($$delete from public.notifications where id = '00000000-0000-0000-0000-000000005601'$$,
  '42501', null, 's1 cannot delete');
select throws_ok($$select public.notify('00000000-0000-0000-0000-000000005101', 't', 'x')$$,
  '42501', null, 's1 cannot call notify');
reset role;

-- anon sees nothing
set local role anon;
select is((select count(*)::int from public.notifications), 0, 'anon sees no notifications');
reset role;

-- activity_opened trigger ---------------------------------------------------------------------
create temp table nt_students as select count(*)::int as n from public.profiles where role = 'student';

insert into public.activities (id, title, starts_at, ends_at, status, type, unit_points) values
  ('00000000-0000-0000-0000-000000005501', 'NT draft', now(), now() + interval '1 day', 'draft', 'fixed', 1);
select is((select count(*)::int from public.notifications where type = 'activity_opened'), 0,
  'insert as draft creates no notification');

update public.activities set status = 'open' where id = '00000000-0000-0000-0000-000000005501';
select is((select count(*)::int from public.notifications where type = 'activity_opened'),
          (select n from nt_students), 'draft -> open notifies every student');
select is((select count(*)::int from public.notifications
           where type = 'activity_opened' and user_id = '00000000-0000-0000-0000-000000005201'), 0,
  'staff get no activity_opened');
select is((select count(*)::int from public.notifications
           where type = 'activity_opened' and user_id = '00000000-0000-0000-0000-000000005101'
             and title = 'กิจกรรมใหม่เปิดรับแล้ว' and body = 'NT draft'
             and link = '/activities/00000000-0000-0000-0000-000000005501'), 1,
  'notification has the Thai title, activity title and link');

update public.activities set status = 'open', title = 'NT draft 2' where id = '00000000-0000-0000-0000-000000005501';
select is((select count(*)::int from public.notifications where type = 'activity_opened'),
          (select n from nt_students), 'open -> open creates none');

update public.activities set status = 'closed' where id = '00000000-0000-0000-0000-000000005501';
select is((select count(*)::int from public.notifications where type = 'activity_opened'),
          (select n from nt_students), 'open -> closed creates none');

update public.activities set status = 'open' where id = '00000000-0000-0000-0000-000000005501';
select is((select count(*)::int from public.notifications where type = 'activity_opened'),
          (select n from nt_students) * 2, 're-opening a closed activity notifies again');

insert into public.activities (id, title, starts_at, ends_at, status, type, unit_points) values
  ('00000000-0000-0000-0000-000000005502', 'NT open', now(), now() + interval '1 day', 'open', 'fixed', 1);
select is((select count(*)::int from public.notifications
           where type = 'activity_opened' and link = '/activities/00000000-0000-0000-0000-000000005502'),
          (select n from nt_students), 'insert with status open notifies every student');

-- trigger function is not callable by API roles
select is((select has_function_privilege('authenticated', p.oid, 'execute')
           from pg_proc p where p.proname = 'notify_activity_opened'), false,
  'authenticated cannot execute the trigger function');
select is((select has_function_privilege('anon', p.oid, 'execute')
           from pg_proc p where p.proname = 'notify_activity_opened'), false,
  'anon cannot execute the trigger function');
select is((select prosecdef from pg_proc where proname = 'notify_activity_opened'), true,
  'trigger function is security definer');
select is((select count(*)::int from pg_trigger where tgname = 'activities_notify_opened' and not tgisinternal), 1,
  'trigger exists');

select * from finish();
rollback;
