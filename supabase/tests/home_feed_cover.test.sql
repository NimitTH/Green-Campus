-- Redesign 3: home_open_activities(int) returns cover_path (public_open_activities itself is unchanged).
begin;
select plan(5);

update public.activities set status = 'closed';
insert into public.activities (id, title, starts_at, ends_at, status, type, cover_path) values
  ('00000000-0000-0000-0000-00000000c001', 'HC with cover', now() - interval '1 hour', now() + interval '1 day', 'open', 'fixed',
   '00000000-0000-0000-0000-00000000c001/00000000-0000-0000-0000-0000000000d1.jpg'),
  ('00000000-0000-0000-0000-00000000c002', 'HC no cover', now() - interval '1 hour', now() + interval '2 days', 'open', 'waste', null),
  ('00000000-0000-0000-0000-00000000c003', 'HC draft', now() - interval '1 hour', now() + interval '2 days', 'draft', 'trees', null);

set local role anon;
select is((select array_agg(n order by o) from pg_proc p,
             unnest(p.proargnames, p.proargmodes) with ordinality as x(n, m, o)
           where p.oid = 'public.home_open_activities(integer)'::regprocedure and m = 't'),
  array['id', 'title', 'type', 'starts_at', 'ends_at', 'cover_path']::text[], 'home_open_activities ends with cover_path');
select is((select cover_path from public.home_open_activities(3) where id = '00000000-0000-0000-0000-00000000c001'),
  '00000000-0000-0000-0000-00000000c001/00000000-0000-0000-0000-0000000000d1.jpg', 'the seeded cover is returned');
select is((select array_agg(id) from public.home_open_activities(3)),
  array['00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c002']::uuid[], 'open activities, soonest end first, no draft');
select is((select count(*) from public.home_open_activities(0)), 1::bigint, 'p_limit 0 clamps to 1');
select lives_ok($$select * from public.home_open_activities()$$, 'anon can call it with the default');
reset role;

select * from finish();
rollback;
