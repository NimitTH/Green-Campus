-- Green Campus: leaderboard and public stats (Task 15, R95-R99). Builds on 0001-0016 (not edited).
--
-- Lock order: both functions below are read-only (no row locks), so the canonical lock order in
-- the 0016 header is unchanged.
--
-- * leaderboard(p_period, p_now): top 10 students by carbon (earn + adjust) for the Asia/Bangkok
--   calendar month containing p_now, or all time; plus the caller's own row. Signed-in only.
-- * public_stats(): anonymous totals {carbon_kg, waste_grams, trees}; no individual data.
-- * R99: profile_display_name(uuid) is no longer executable by signed-in users (it resolved any
--   profile's name by id); names are built only inside leaderboard(). service_role keeps it.

revoke execute on function public.profile_display_name(uuid) from public, anon, authenticated;
grant execute on function public.profile_display_name(uuid) to service_role;

-- leaderboard (R95) ------------------------------------------------------------------------------
create or replace function public.leaderboard(p_period text, p_now timestamptz default now())
returns table (rank int, display_name text, carbon_kg numeric, is_me boolean)
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
    select s.sid, s.nm, s.cb,
           rank() over (order by s.cb desc) as rk,
           row_number() over (order by s.cb desc, s.nm, s.sid) as rn
    from scored s
    where s.cb > 0
  ),
  top as (
    select r.sid, r.nm, r.cb, r.rk, r.rn from ranked r where r.rn <= 10
  ),
  me as (
    select r.sid, r.nm, r.cb, r.rk, r.rn from ranked r where r.sid = v_uid and r.rn > 10
    union all
    select s.sid, s.nm, s.cb, (select count(*) from ranked) + 1, (select count(*) from ranked) + 1
    from scored s
    where s.sid = v_uid and v_is_student and not exists (select 1 from ranked r where r.sid = v_uid)
  )
  select u.rk::int, u.nm, u.cb, (u.sid = v_uid and v_is_student)
  from (
    select t.sid, t.nm, t.cb, t.rk, t.rn, 0 as part from top t
    union all
    select m.sid, m.nm, m.cb, m.rk, m.rn, 1 as part from me m
  ) u
  order by u.part, u.rn;
end;
$$;

revoke execute on function public.leaderboard(text, timestamptz) from public, anon;
grant execute on function public.leaderboard(text, timestamptz) to authenticated;

-- public_stats (R96) -------------------------------------------------------------------------------
create or replace function public.public_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'carbon_kg', (
      select round(coalesce(sum(l.carbon_kg), 0), 3)
      from public.ledger_entries l
      join public.profiles p on p.id = l.student_id and p.role = 'student'
      where l.kind in ('earn', 'adjust')
    ),
    'waste_grams', (
      select coalesce(sum(i.quantity), 0)::bigint
      from public.submission_items i
      join public.submissions s on s.id = i.submission_id and s.status = 'approved'
      join public.activities a on a.id = s.activity_id and a.type = 'waste'
    ),
    'trees', (
      select coalesce(sum(i.quantity), 0)::bigint
      from public.submission_items i
      join public.submissions s on s.id = i.submission_id and s.status = 'approved'
      join public.activities a on a.id = s.activity_id and a.type = 'trees'
    )
  )
$$;

revoke execute on function public.public_stats() from public;
grant execute on function public.public_stats() to anon, authenticated;
