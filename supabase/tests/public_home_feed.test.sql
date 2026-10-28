-- Redesign 2: public_open_activities / public_active_rewards (anon home feed).
begin;
select plan(21);

select has_function('public', 'public_open_activities', array['integer'], 'public_open_activities(int) exists');
select has_function('public', 'public_active_rewards', array['integer'], 'public_active_rewards(int) exists');
select is((select prosecdef from pg_proc where oid = 'public.public_open_activities(integer)'::regprocedure), true,
  'public_open_activities is security definer');
select is((select prosecdef from pg_proc where oid = 'public.public_active_rewards(integer)'::regprocedure), true,
  'public_active_rewards is security definer');
select ok((select proconfig from pg_proc where oid = 'public.public_open_activities(integer)'::regprocedure) @> array['search_path=""'],
  'public_open_activities pins an empty search_path');
select ok((select proconfig from pg_proc where oid = 'public.public_active_rewards(integer)'::regprocedure) @> array['search_path=""'],
  'public_active_rewards pins an empty search_path');

-- Neutralise any pre-existing rows inside this rolled-back transaction.
update public.activities set status = 'closed';
update public.rewards set active = false;

insert into public.activities (id, title, starts_at, ends_at, status, type) values
  ('00000000-0000-0000-0000-00000000a401', 'PF B later', now() - interval '1 hour', now() + interval '5 days', 'open', 'fixed'),
  ('00000000-0000-0000-0000-00000000a402', 'PF A soon', now() - interval '1 hour', now() + interval '1 day', 'open', 'waste'),
  ('00000000-0000-0000-0000-00000000a403', 'PF ended', now() - interval '3 days', now() - interval '1 day', 'open', 'fixed'),
  ('00000000-0000-0000-0000-00000000a404', 'PF draft', now() - interval '1 hour', now() + interval '2 days', 'draft', 'trees'),
  ('00000000-0000-0000-0000-00000000a405', 'PF closed', now() - interval '1 hour', now() + interval '2 days', 'closed', 'trees');

insert into public.rewards (id, name, points_cost, stock, active, created_at) values
  ('00000000-0000-0000-0000-00000000b401', 'PF new', 10, 5, true, now() - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000b402', 'PF no stock', 10, 0, true, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000b403', 'PF inactive', 10, 5, false, now() - interval '3 hours'),
  ('00000000-0000-0000-0000-00000000b404', 'PF old', 10, 2, true, now() - interval '5 days');

set local role anon;

select is((select array_agg(id order by ends_at, id) from public.public_open_activities(3)),
  array['00000000-0000-0000-0000-00000000a402', '00000000-0000-0000-0000-00000000a401']::uuid[],
  'anon gets open, not-ended activities soonest end first (no draft/closed/ended)');
select is((select array_agg(id) from public.public_open_activities(3)),
  array['00000000-0000-0000-0000-00000000a402', '00000000-0000-0000-0000-00000000a401']::uuid[],
  'activities come back in order');
select is((select array_agg(id) from public.public_active_rewards(4)),
  array['00000000-0000-0000-0000-00000000b401', '00000000-0000-0000-0000-00000000b404']::uuid[],
  'anon gets active in-stock rewards newest first (no inactive / stock 0)');
select is((select count(*) from public.public_open_activities(1)), 1::bigint, 'limit 1 honoured');
select is((select count(*) from public.public_open_activities(0)), 1::bigint, 'activities p_limit 0 clamps to 1');
select is((select count(*) from public.public_active_rewards(0)), 1::bigint, 'rewards p_limit 0 clamps to 1');
select is((select count(*) from public.public_open_activities(null)), 2::bigint, 'activities p_limit null uses the default');
select is((select count(*) from public.public_active_rewards(null)), 2::bigint, 'rewards p_limit null uses the default');
select ok((select count(*) from public.public_open_activities(99)) <= 12, 'activities p_limit 99 is clamped to 12');
select ok((select count(*) from public.public_active_rewards(99)) <= 12, 'rewards p_limit 99 is clamped to 12');

-- Clamp upper bound with real rows (still as anon: seed as superuser first).
reset role;
insert into public.rewards (name, points_cost, stock, active)
  select 'PF bulk ' || g, 1, 1, true from generate_series(1, 20) g;
set local role anon;
select is((select count(*) from public.public_active_rewards(99)), 12::bigint, 'rewards p_limit 99 returns exactly 12');

select is((select array_agg(n order by o) from pg_proc p,
             unnest(p.proargnames, p.proargmodes) with ordinality as x(n, m, o)
           where p.oid = 'public.public_open_activities(integer)'::regprocedure and m = 't'),
  array['id', 'title', 'type', 'starts_at', 'ends_at']::text[], 'public_open_activities returns only the safe columns');
select is((select array_agg(n order by o) from pg_proc p,
             unnest(p.proargnames, p.proargmodes) with ordinality as x(n, m, o)
           where p.oid = 'public.public_active_rewards(integer)'::regprocedure and m = 't'),
  array['id', 'name', 'points_cost', 'stock', 'image_path']::text[], 'public_active_rewards returns only the safe columns');
select lives_ok($$select * from public.public_open_activities()$$, 'anon can call activities with default');
select lives_ok($$select * from public.public_active_rewards()$$, 'anon can call rewards with default');

select * from finish();
rollback;
