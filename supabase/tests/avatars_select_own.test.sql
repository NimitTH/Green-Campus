-- Review fix M1 (0031): a user selects only their own avatars/<uid>/ rows. ids: students ...ac01 (A), ...ac02 (B)
begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000ac01', 'avs-a@example.test', '{"full_name":"AVS เอ"}'::jsonb),
  ('00000000-0000-0000-0000-00000000ac02', 'avs-b@example.test', '{"full_name":"AVS บี"}'::jsonb);
insert into storage.objects (bucket_id, name, owner) values
  ('avatars', '00000000-0000-0000-0000-00000000ac01/a.jpg', '00000000-0000-0000-0000-00000000ac01'),
  ('avatars', '00000000-0000-0000-0000-00000000ac02/b.jpg', '00000000-0000-0000-0000-00000000ac02');

select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars_select'),
  0::bigint, 'the open avatars_select policy is gone');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ac01","role":"authenticated"}', true);
select is((select count(*) from storage.objects where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-00000000ac01/a.jpg'),
  1::bigint, 'user A sees their own avatar row');
select is((select count(*) from storage.objects where bucket_id = 'avatars' and name = '00000000-0000-0000-0000-00000000ac02/b.jpg'),
  0::bigint, 'user A cannot see user B''s avatar row');
select is((select count(*) from storage.objects where bucket_id = 'avatars' and name like '00000000-0000-0000-0000-00000000ac0%'),
  1::bigint, 'listing the bucket returns only A''s row');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ac02","role":"authenticated"}', true);
select is((select count(*) from storage.objects where bucket_id = 'avatars' and name like '00000000-0000-0000-0000-00000000ac0%'),
  1::bigint, 'user B likewise sees only their own row');
reset role;

select * from finish();
rollback;
