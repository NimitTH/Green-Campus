-- Redesign 3: profiles.avatar_path, the avatars bucket and its storage policies, leaderboard() avatar_path.
-- ids: students ...ab01 (owner, has carbon), ...ab02 (other)
begin;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000ab01', 'av-s1@example.test', '{"full_name":"AV หนึ่ง"}'::jsonb),
  ('00000000-0000-0000-0000-00000000ab02', 'av-s2@example.test', '{"full_name":"AV สอง"}'::jsonb);
insert into public.ledger_entries (student_id, kind, points, carbon_kg, created_at)
  values ('00000000-0000-0000-0000-00000000ab01', 'earn', 10, 1000000, now());

select has_column('public', 'profiles', 'avatar_path', 'profiles.avatar_path exists');

-- leaderboard before the avatar is set (control row, captured as the owner)
create temp table t_lb_before (rank int, is_me boolean, avatar_path text) on commit drop;
grant all on t_lb_before to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ab01","role":"authenticated"}', true);
insert into t_lb_before select l.rank, l.is_me, l.avatar_path from public.leaderboard('all') l where l.is_me;
select is((select count(*) from t_lb_before), 1::bigint, 'the seeded student appears on the leaderboard');
select is((select avatar_path from t_lb_before), null, 'no avatar yet: avatar_path is null');

select lives_ok($$update public.profiles set avatar_path = '00000000-0000-0000-0000-00000000ab01/00000000-0000-0000-0000-0000000000a1.jpg'
  where id = '00000000-0000-0000-0000-00000000ab01'$$, 'a user sets an avatar_path in their own folder');
select throws_ok($$update public.profiles set avatar_path = '00000000-0000-0000-0000-00000000ab02/00000000-0000-0000-0000-0000000000a2.jpg'
  where id = '00000000-0000-0000-0000-00000000ab01'$$, '23514', null, 'avatar_path in another user''s folder is rejected');
select throws_ok($$update public.profiles set avatar_path = '00000000-0000-0000-0000-00000000ab01/00000000-0000-0000-0000-0000000000a3.png'
  where id = '00000000-0000-0000-0000-00000000ab01'$$, '23514', null, 'a non-.jpg avatar_path is rejected');

-- leaderboard after: same rank and is_me, avatar_path now returned
select is((select l.rank from public.leaderboard('all') l where l.is_me), (select rank from t_lb_before), 'rank is unchanged by the avatar');
select is((select l.is_me from public.leaderboard('all') l where l.is_me), (select is_me from t_lb_before), 'is_me is unchanged by the avatar');
select is((select l.avatar_path from public.leaderboard('all') l where l.is_me),
  '00000000-0000-0000-0000-00000000ab01/00000000-0000-0000-0000-0000000000a1.jpg', 'leaderboard returns the avatar_path');

-- storage policies
select lives_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '00000000-0000-0000-0000-00000000ab01/x.jpg', '00000000-0000-0000-0000-00000000ab01')$$,
  'a user uploads into their own avatars folder');
select throws_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '00000000-0000-0000-0000-00000000ab02/x.jpg', '00000000-0000-0000-0000-00000000ab01')$$,
  '42501', null, 'a user cannot upload into another user''s avatars folder');
reset role;

-- anon cannot update profiles
set local role anon;
select throws_ok($$update public.profiles set avatar_path = null where id = '00000000-0000-0000-0000-00000000ab01'$$,
  '42501', null, 'anon cannot update avatar_path');
reset role;

-- bucket config
select is((select (public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'avatars'),
  '(t,524288,{image/jpeg})', 'avatars bucket: public, 512 KiB, jpeg only');
select is((select array_agg(n order by o) from pg_proc p,
             unnest(p.proargnames, p.proargmodes) with ordinality as x(n, m, o)
           where p.oid = 'public.leaderboard(text, timestamp with time zone)'::regprocedure and m = 't'),
  array['rank', 'display_name', 'carbon_kg', 'is_me', 'avatar_path']::text[], 'leaderboard ends with avatar_path');

select * from finish();
rollback;
