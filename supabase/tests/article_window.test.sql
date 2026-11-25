-- Round 6 (old-site features 4): the article display window (show_from / show_until).
-- ids: student ...5e11, teacher ...5e21; articles ...5e01 (no window), ...5e02 (starts tomorrow), ...5e03 (ended),
-- ...5e04 (inside its window), ...5e05 (draft inside a window).
begin;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000005e11', 'aw-s@example.test', '{"full_name":"AW นักเรียน"}'::jsonb),
  ('00000000-0000-0000-0000-000000005e21', 'aw-t@example.test', '{"full_name":"AW ครู"}'::jsonb);
update public.profiles set role = 'teacher' where id = '00000000-0000-0000-0000-000000005e21';

insert into public.articles (id, title, slug, body, published, show_from, show_until) values
  ('00000000-0000-0000-0000-000000005e01', 'AW none', 'aw-none', 'x', true, null, null),
  ('00000000-0000-0000-0000-000000005e02', 'AW later', 'aw-later', 'x', true, now() + interval '1 day', null),
  ('00000000-0000-0000-0000-000000005e03', 'AW ended', 'aw-ended', 'x', true, null, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-000000005e04', 'AW inside', 'aw-inside', 'x', true, now() - interval '1 hour', now() + interval '1 hour'),
  ('00000000-0000-0000-0000-000000005e05', 'AW draft', 'aw-draft', 'x', false, now() - interval '1 hour', now() + interval '1 hour');

set local role anon;
select is((select array_agg(slug order by slug) from public.articles where slug like 'aw-%'), array['aw-inside', 'aw-none'],
  'anon sees only published articles inside their window');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005e11","role":"authenticated"}', true);
select is((select array_agg(slug order by slug) from public.articles where slug like 'aw-%'), array['aw-inside', 'aw-none'],
  'a student sees only published articles inside their window');
select is((select count(*) from public.articles where slug = 'aw-later'), 0::bigint, 'a student cannot read a scheduled article by slug');
select is((select count(*) from public.articles where slug = 'aw-ended'), 0::bigint, 'a student cannot read an ended article by slug');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000005e21","role":"authenticated"}', true);
select is((select count(*) from public.articles where slug like 'aw-%'), 5::bigint, 'staff see every article, in or out of its window');
reset role;

select is(public.article_is_visible((select a from public.articles a where a.slug = 'aw-none')), true, 'no window: visible');
select is(public.article_is_visible((select a from public.articles a where a.slug = 'aw-later')), false, 'before show_from: hidden');
select is(public.article_is_visible((select a from public.articles a where a.slug = 'aw-ended')), false, 'at or after show_until: hidden');
select is(public.article_is_visible((select a from public.articles a where a.slug = 'aw-draft')), false, 'a draft is hidden inside its window');

select throws_ok(
  $$insert into public.articles (title, slug, body, show_from, show_until) values ('AW bad', 'aw-bad', 'x', now(), now())$$,
  '23514', null, 'show_until must be after show_from');
select lives_ok(
  $$insert into public.articles (title, slug, body, show_from, show_until) values ('AW open end', 'aw-open-end', 'x', now(), null)$$,
  'a start without an end is allowed');

select * from finish();
rollback;
