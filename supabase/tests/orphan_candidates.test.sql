-- storage_orphan_candidates (Task 19 fix round 1, R133): read-only keyset query behind the cleanup cron.
begin;
select plan(14);

insert into public.rewards (id, name, points_cost, stock, image_path) values
  ('00000000-0000-0000-0000-0000000fa001', 'orph reward', 10, 1, 'orph-ref/kept.jpg');
insert into public.articles (id, title, slug, body, cover_path) values
  ('00000000-0000-0000-0000-0000000fa002', 'orph article', 'orph-article-fa', 'x', '00000000-0000-0000-0000-0000000fa002/00000000-0000-0000-0000-0000000fa003.jpg');

insert into storage.objects (bucket_id, name, created_at) values
  ('reward-images', 'orph-ref/kept.jpg', now() - interval '3 days'),
  ('reward-images', 'orph-ref/old1.jpg', now() - interval '3 days'),
  ('reward-images', 'orph-ref/old2.jpg', now() - interval '3 days'),
  ('reward-images', 'orph-ref/old3.jpg', now() - interval '3 days'),
  ('reward-images', 'orph-ref/young.jpg', now() - interval '1 hour'),
  ('reward-images', 'orph-ref/.emptyFolderPlaceholder', now() - interval '3 days'),
  ('article-images', '00000000-0000-0000-0000-0000000fa002/00000000-0000-0000-0000-0000000fa003.jpg', now() - interval '3 days'),
  ('article-images', 'orph-art/stray.jpg', now() - interval '3 days'),
  ('evidence', 'orph-s/orph-sub/e.jpg', now() - interval '3 days'),
  ('reward-images', 'orph-other/same.jpg', now() - interval '3 days'),
  ('evidence', 'orph-other/same.jpg', now() - interval '3 days');

select ok(has_function_privilege('service_role', 'public.storage_orphan_candidates(text,timestamptz,text,int)', 'execute'), 'service_role can execute');
select ok(not has_function_privilege('anon', 'public.storage_orphan_candidates(text,timestamptz,text,int)', 'execute'), 'anon cannot execute');
select ok(not has_function_privilege('authenticated', 'public.storage_orphan_candidates(text,timestamptz,text,int)', 'execute'), 'authenticated cannot execute');
select ok(not has_function_privilege('public', 'public.storage_orphan_candidates(text,timestamptz,text,int)', 'execute'), 'public cannot execute');

select throws_ok($$select * from public.storage_orphan_candidates('avatars', now(), '', 10)$$, '22023', 'unknown bucket', 'unknown bucket raises');

select results_eq(
  $$select name from public.storage_orphan_candidates('reward-images', now() - interval '24 hours', 'orph-', 100) where name like 'orph-ref/%'$$,
  $$values ('orph-ref/old1.jpg'), ('orph-ref/old2.jpg'), ('orph-ref/old3.jpg')$$,
  'reward-images: referenced, young and placeholder excluded; ordered by name');

select results_eq(
  $$select name from public.storage_orphan_candidates('article-images', now() - interval '24 hours', 'orph-', 100)$$,
  $$values ('orph-art/stray.jpg')$$,
  'article-images: referenced cover excluded (after-filter keeps orph- names only)');

select is((select count(*) from public.storage_orphan_candidates('article-images', now() - interval '24 hours', '', 1000)
           where name = '00000000-0000-0000-0000-0000000fa002/00000000-0000-0000-0000-0000000fa003.jpg'), 0::bigint, 'referenced article cover excluded');

select results_eq(
  $$select name from public.storage_orphan_candidates('reward-images', now() - interval '24 hours', 'orph-ref/old1.jpg', 2)$$,
  $$values ('orph-ref/old2.jpg'), ('orph-ref/old3.jpg')$$,
  'keyset paging: p_after is exclusive and p_limit applies');

select is((select count(*) from public.storage_orphan_candidates('reward-images', now() - interval '24 hours', 'orph-ref/old3.jpg', 1)
           where name like 'orph-ref/%'), 0::bigint, 'keyset paging: nothing after the last orph-ref name');

select is((select count(*) from public.storage_orphan_candidates('reward-images', now() - interval '24 hours', 'orph-ref/old1.jpg', 0)), 1::bigint,
  'p_limit 0 is clamped to 1');

select is((select name from public.storage_orphan_candidates('evidence', now() - interval '24 hours', 'orph-s/', 1)), 'orph-s/orph-sub/e.jpg',
  'evidence: nested path listed');

select is((select count(*) from public.storage_orphan_candidates('evidence', now() - interval '24 hours', 'orph-other/', 5)
           where name = 'orph-other/same.jpg'), 1::bigint, 'buckets are isolated: the same name in another bucket is its own row');

select is((select count(*) from public.storage_orphan_candidates('reward-images', now() - interval '24 hours', 'orph-ref/', 5)
           where name = 'orph-ref/kept.jpg'), 0::bigint, 'referenced reward image excluded');

select * from finish();
rollback;
