-- Redesign 3 (DESIGN-3 7.1): profile avatars. Column + format check, per-column grant, public bucket, storage policies,
-- and leaderboard() returning avatar_path as its last column (logic and grants unchanged from 0017).

alter table public.profiles add column avatar_path text;
alter table public.profiles
  add constraint profiles_avatar_path_format
  check (avatar_path is null or (
    avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
    and split_part(avatar_path, '/', 1) = id::text));

grant update (avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg'])
on conflict (id) do nothing;

create policy avatars_select on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop function public.leaderboard(text, timestamptz);
create function public.leaderboard(p_period text, p_now timestamptz default now())
returns table (rank int, display_name text, carbon_kg numeric, is_me boolean, avatar_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_from timestamptz;
  v_to timestamptz;
  v_is_student boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_period is null or p_period not in ('month', 'all') then
    raise exception 'invalid_period' using errcode = '22023';
  end if;

  if p_period = 'month' then
    v_from := date_trunc('month', p_now at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
    v_to := (date_trunc('month', p_now at time zone 'Asia/Bangkok') + interval '1 month') at time zone 'Asia/Bangkok';
  end if;

  select exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'student') into v_is_student;

  return query
  with scored as (
    select p.id as sid,
           public.profile_display_name(p.id) as nm,
           p.avatar_path as av,
           coalesce(sum(l.carbon_kg), 0)::numeric as cb
    from public.profiles p
    left join public.ledger_entries l
      on l.student_id = p.id
     and l.kind in ('earn', 'adjust')
     and (p_period = 'all' or (l.created_at >= v_from and l.created_at < v_to))
    where p.role = 'student'
    group by p.id
  ),
  ranked as (
    select s.sid, s.nm, s.av, s.cb,
           rank() over (order by s.cb desc) as rk,
           row_number() over (order by s.cb desc, s.nm, s.sid) as rn
    from scored s
    where s.cb > 0
  ),
  top as (
    select r.sid, r.nm, r.av, r.cb, r.rk, r.rn from ranked r where r.rk <= 10
  ),
  me as (
    select r.sid, r.nm, r.av, r.cb, r.rk, r.rn from ranked r where r.sid = v_uid and r.rk > 10
    union all
    -- a student caller without a positive total (0 or negative): unranked, shown as 0
    select s.sid, s.nm, s.av, 0::numeric, null::bigint, 0::bigint
    from scored s
    where s.sid = v_uid and v_is_student and not exists (select 1 from ranked r where r.sid = v_uid)
  )
  select u.rk::int, u.nm, u.cb, (u.sid = v_uid and v_is_student), u.av
  from (
    select t.sid, t.nm, t.av, t.cb, t.rk, t.rn, 0 as part from top t
    union all
    select m.sid, m.nm, m.av, m.cb, m.rk, m.rn, 1 as part from me m
  ) u
  order by u.part, u.rn;
end;
$$;

revoke execute on function public.leaderboard(text, timestamptz) from public, anon;
grant execute on function public.leaderboard(text, timestamptz) to authenticated;
