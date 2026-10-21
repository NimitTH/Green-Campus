-- 0024 (Task 19 fix round 2, R134): storage_referenced_names, and storage_orphan_candidates collation,
-- versioning, evidence references, strict boundary and a real call as service_role.
begin;
select plan(18);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000fb001', 'orph-fb@example.test');
insert into public.activities (id, title, starts_at, ends_at, status, type) values
  ('00000000-0000-0000-0000-0000000fb002', 'orph act', now(), now() + interval '1 day', 'open', 'fixed');
insert into public.submissions (activity_id, student_id, evidence_path) values
  ('00000000-0000-0000-0000-0000000fb002', '00000000-0000-0000-0000-0000000fb001',
   '00000000-0000-0000-0000-0000000fb001/00000000-0000-0000-0000-0000000fb003/evidence.jpg');
-- a row with a NULL evidence_path must be harmless
insert into public.submissions (activity_id, student_id, evidence_path) values
  ('00000000-0000-0000-0000-0000000fb002', '00000000-0000-0000-0000-0000000fb001', null)
  on conflict do nothing;

select ok(has_function_privilege('service_role', 'public.storage_referenced_names(text,text[])', 'execute'), 'service_role can execute referenced_names');
select ok(not has_function_privilege('anon', 'public.storage_referenced_names(text,text[])', 'execute'), 'anon cannot');
select ok(not has_function_privilege('authenticated', 'public.storage_referenced_names(text,text[])', 'execute'), 'authenticated cannot');
select ok(not has_function_privilege('public', 'public.storage_referenced_names(text,text[])', 'execute'), 'public cannot');
select throws_ok($$select * from public.storage_referenced_names('avatars', array['x'])$$, '22023', 'unknown bucket', 'unknown bucket raises');

select results_eq(
  $$select * from public.storage_referenced_names('evidence', array[
     '00000000-0000-0000-0000-0000000fb001/00000000-0000-0000-0000-0000000fb003/evidence.jpg', 'nope/x.jpg', null])$$,
  $$values ('00000000-0000-0000-0000-0000000fb001/00000000-0000-0000-0000-0000000fb003/evidence.jpg')$$,
  'only the referenced evidence name is returned (unreferenced and NULL names are not)');
select is((select count(*) from public.storage_referenced_names('evidence', array[]::text[])), 0::bigint, 'empty list returns nothing');

-- candidates ---------------------------------------------------------------------------------------------------
insert into storage.objects (bucket_id, name, created_at) values
  ('evidence', '00000000-0000-0000-0000-0000000fb001/00000000-0000-0000-0000-0000000fb003/evidence.jpg', now() - interval '3 days'),
  ('evidence', 'orphfb/Zebra.jpg', now() - interval '3 days'),
  ('evidence', 'orphfb/apple.jpg', now() - interval '3 days'),
  ('evidence', 'orphfb/Banana.jpg', now() - interval '3 days'),
  ('evidence', 'orphfb/กล้วย.jpg', now() - interval '3 days'),
  ('evidence', 'orphfb/_under.jpg', now() - interval '3 days'),
  ('evidence', 'orphfb/boundary.jpg', timestamptz '2026-01-01 00:00:00+00'),
  ('evidence', 'orphfb/archived.jpg', now() - interval '3 days');
update storage.objects set archived_at = now() where bucket_id = 'evidence' and name = 'orphfb/archived.jpg';

select is((select count(*) from public.storage_orphan_candidates('evidence', now() - interval '24 hours', '', 1000)
           where name like '0000%'), 0::bigint, 'referenced evidence object is excluded');
select is((select count(*) from public.storage_orphan_candidates('evidence', timestamptz '2026-01-01 00:00:00+00', 'orphfb/', 1000)
           where name = 'orphfb/boundary.jpg'), 0::bigint, 'created_at = p_older_than is excluded (strict)');
select is((select count(*) from public.storage_orphan_candidates('evidence', now(), 'orphfb/', 1000)
           where name = 'orphfb/boundary.jpg'), 1::bigint, 'older than the cutoff is included');
select is((select count(*) from public.storage_orphan_candidates('evidence', now(), 'orphfb/', 1000)
           where name = 'orphfb/archived.jpg'), 0::bigint, 'archived (non-current) object is excluded');

-- byte order: uppercase < underscore < lowercase < Thai; pages of 2 across the boundary
select results_eq(
  $$select name from public.storage_orphan_candidates('evidence', now() - interval '24 hours', 'orphfb/', 2)$$,
  $$values ('orphfb/Banana.jpg'), ('orphfb/Zebra.jpg')$$, 'page 1 in byte order (C collation)');
select results_eq(
  $$select name from public.storage_orphan_candidates('evidence', now() - interval '24 hours', 'orphfb/Zebra.jpg', 2)$$,
  $$values ('orphfb/_under.jpg'), ('orphfb/apple.jpg')$$, 'page 2 continues after the last name of page 1');
select results_eq(
  $$select name from public.storage_orphan_candidates('evidence', now() - interval '24 hours', 'orphfb/apple.jpg', 2)
    where name like 'orphfb/%'$$,
  $$values ('orphfb/boundary.jpg'), ('orphfb/กล้วย.jpg')$$, 'page 3 ends with the Thai name (bytes after ASCII)');

-- a real call as service_role
set local role service_role;
select is((select count(*) from public.storage_orphan_candidates('evidence', now() - interval '24 hours', 'orphfb/', 100)),
  6::bigint, 'service_role can call storage_orphan_candidates');
select is((select count(*) from public.storage_referenced_names('evidence', array['x'])), 0::bigint, 'service_role can call storage_referenced_names');
reset role;

set local role authenticated;
select throws_ok($$select * from public.storage_referenced_names('evidence', array['x'])$$, '42501', null, 'authenticated call is denied');
reset role;
select ok(true, 'done');

select * from finish();
rollback;
