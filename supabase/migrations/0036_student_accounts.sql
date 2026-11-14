-- Redesign 4 (DESIGN-4 6.3, 6.4, 7.5): student account status (suspension, forced password change), an
-- append-only history of staff account commands, the staff/admin command functions, and leaderboard() skipping
-- suspended students.
--
-- Rules (enforced here, the app checks again only for messages):
-- * the target must be a student and never the caller (self_target); teachers may reset a password, suspend
--   and unsuspend; renaming and deleting are admin-only (not_admin);
-- * a demo caller (profiles.is_demo) may act on demo students only (demo_scope);
-- * account_status and account_events have no client insert/update/delete privilege at all: rows change only
--   through these security definer functions. account_events.student_id is not a foreign key, so the history
--   survives a deleted account.
-- * The writers never touch balances and take no profile lock (DESIGN-4 7); they cannot join the 0016 lock cycle.
--
-- Errors are raised with the code as the message (errcode P0001): not_staff, not_admin, not_student,
-- demo_scope, self_target, invalid_input.

-- Tables ---------------------------------------------------------------------------------------------------

create table public.account_status (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  -- 'infinity' = until a staff member lifts it
  suspended_until timestamptz,
  suspend_reason text check (suspend_reason is null or char_length(suspend_reason) <= 500),
  suspended_by uuid,
  must_change_password boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.account_status enable row level security;
revoke all on public.account_status from public, anon, authenticated;
grant select on public.account_status to authenticated;
create policy account_status_select on public.account_status
  for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));

create table public.account_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  student_name text not null,
  actor_id uuid,
  actor_name text not null,
  action text not null check (action in ('password_reset', 'suspend', 'unsuspend', 'rename', 'delete')),
  detail text,
  created_at timestamptz not null default now()
);

create index account_events_student_created_idx on public.account_events (student_id, created_at desc);

alter table public.account_events enable row level security;
revoke all on public.account_events from public, anon, authenticated;
grant select on public.account_events to authenticated;
create policy account_events_select_staff on public.account_events
  for select to authenticated
  using ((select public.is_staff()));

-- Internal helpers (not callable by clients) ---------------------------------------------------------------

-- The caller's profile, after the staff (or admin) check. Raises not_staff / not_admin.
create function public.account_caller(p_admin_only boolean)
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller public.profiles;
begin
  select * into v_caller from public.profiles p where p.id = auth.uid();
  if p_admin_only then
    if not found or v_caller.role <> 'admin' then
      raise exception 'not_admin';
    end if;
  elsif not found or v_caller.role not in ('teacher', 'admin') then
    raise exception 'not_staff';
  end if;
  return v_caller;
end
$$;

-- The target student a command may act on (spec 6.3). Raises self_target / not_student / demo_scope.
create function public.account_target(p_caller public.profiles, p_student uuid)
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
begin
  if p_student is not null and p_student = p_caller.id then
    raise exception 'self_target';
  end if;
  select * into v_target from public.profiles p where p.id = p_student;
  if not found or v_target.role <> 'student' then
    raise exception 'not_student';
  end if;
  if p_caller.is_demo and not v_target.is_demo then
    raise exception 'demo_scope';
  end if;
  return v_target;
end
$$;

revoke execute on function public.account_caller(boolean) from public, anon, authenticated;
revoke execute on function public.account_target(public.profiles, uuid) from public, anon, authenticated;

-- Reads ----------------------------------------------------------------------------------------------------

-- Demo staff and real students' data (Task 18 review I1, ruling R16; owner decision 14 Nov 2026): demo accounts
-- are handed out at demos, so a demo caller (teacher or admin) sees demo students only in the list (total counts
-- only those), gets email / suspend_reason / suspended_by_name as null for a real student's detail, and no history
-- rows for a real (or deleted) student. Non-demo staff are unaffected.

-- /staff/students: search (full name, display name, email; % and _ are literal), sort date|name|points,
-- dir asc|desc, status all|active|suspended|must_change; id breaks ties in the same direction.
create function public.staff_list_students(
  p_q text, p_sort text, p_dir text, p_status text, p_limit int, p_offset int
)
returns table (
  id uuid, full_name text, display_name text, email text, avatar_path text, created_at timestamptz,
  points bigint, carbon_kg numeric, suspended_until timestamptz, must_change_password boolean, is_demo boolean,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_sort text := coalesce(p_sort, 'date');
  v_dir text := coalesce(p_dir, 'desc');
  v_status text := coalesce(p_status, 'all');
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_pattern text;
  v_limit int := least(greatest(coalesce(p_limit, 12), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_demo boolean;
begin
  v_demo := (public.account_caller(false)).is_demo;
  if v_sort not in ('date', 'name', 'points') or v_dir not in ('asc', 'desc')
     or v_status not in ('all', 'active', 'suspended', 'must_change') then
    raise exception 'invalid_input';
  end if;
  if v_q is not null then
    v_pattern := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with base as (
    select p.id, p.full_name, p.display_name, u.email::text as email, p.avatar_path, u.created_at,
           coalesce(b.points, 0)::bigint as points, coalesce(b.carbon_kg, 0)::numeric as carbon_kg,
           s.suspended_until, coalesce(s.must_change_password, false) as must_change_password, p.is_demo
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.student_balance b on b.student_id = p.id
    left join public.account_status s on s.student_id = p.id
    where p.role = 'student'
      and (not v_demo or p.is_demo)
      and (v_pattern is null
           or p.full_name ilike v_pattern
           or p.display_name ilike v_pattern
           or u.email ilike v_pattern)
  ),
  filtered as (
    select r.* from base r
    where case v_status
            when 'all' then true
            when 'suspended' then coalesce(r.suspended_until > now(), false)
            when 'must_change' then r.must_change_password
            else not coalesce(r.suspended_until > now(), false) and not r.must_change_password
          end
  )
  select f.id, f.full_name, f.display_name, f.email, f.avatar_path, f.created_at, f.points, f.carbon_kg,
         f.suspended_until, f.must_change_password, f.is_demo, count(*) over ()
  from filtered f
  order by
    case when v_sort = 'date' and v_dir = 'asc' then f.created_at end asc nulls last,
    case when v_sort = 'date' and v_dir = 'desc' then f.created_at end desc nulls last,
    case when v_sort = 'name' and v_dir = 'asc' then f.full_name end asc nulls last,
    case when v_sort = 'name' and v_dir = 'desc' then f.full_name end desc nulls last,
    case when v_sort = 'points' and v_dir = 'asc' then f.points end asc nulls last,
    case when v_sort = 'points' and v_dir = 'desc' then f.points end desc nulls last,
    case when v_dir = 'asc' then f.id end asc,
    case when v_dir = 'desc' then f.id end desc
  limit v_limit offset v_offset;
end
$$;

-- /staff/students/[id]. Any staff member may look at any student (demo staff included: the page shows the
-- demo notice instead of the command panel, and a demo caller gets no email, reason or suspender for a real
-- student, ruling R16); a non-student id is not_student (the page answers 404).
create function public.staff_get_student(p_student uuid)
returns table (
  id uuid, full_name text, display_name text, email text, avatar_path text, created_at timestamptz,
  points bigint, carbon_kg numeric, suspended_until timestamptz, must_change_password boolean, is_demo boolean,
  suspend_reason text, suspended_by_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_demo boolean;
begin
  v_demo := (public.account_caller(false)).is_demo;
  if not exists (select 1 from public.profiles p where p.id = p_student and p.role = 'student') then
    raise exception 'not_student';
  end if;

  return query
  select p.id, p.full_name, p.display_name,
         case when v_demo and not p.is_demo then null else u.email::text end,
         p.avatar_path, u.created_at,
         coalesce(b.points, 0)::bigint, coalesce(b.carbon_kg, 0)::numeric,
         s.suspended_until, coalesce(s.must_change_password, false), p.is_demo,
         case when v_demo and not p.is_demo then null else s.suspend_reason end,
         case when v_demo and not p.is_demo then null else sb.full_name end
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.student_balance b on b.student_id = p.id
  left join public.account_status s on s.student_id = p.id
  left join public.profiles sb on sb.id = s.suspended_by
  where p.id = p_student;
end
$$;

-- Newest first; p_limit clamped to 1..100. Works for deleted students too (no profile needed). A demo caller
-- sees the history of a demo student only (ruling R16): nothing for a real or deleted student.
create function public.staff_list_account_events(p_student uuid, p_limit int default 20)
returns setof public.account_events
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_demo boolean;
begin
  v_demo := (public.account_caller(false)).is_demo;
  return query
  select e.* from public.account_events e
  where e.student_id = p_student
    and (not v_demo or exists (select 1 from public.profiles p where p.id = p_student and p.is_demo))
  order by e.created_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end
$$;

-- Commands -------------------------------------------------------------------------------------------------

-- Ends every Auth session of a student (refresh tokens cascade from auth.sessions), in the command's transaction
-- (Task 17 review I2, ruling R15): after a reset nobody can keep using an old session to set a password of their
-- own, and after a suspension an old refresh token does not come back to life when the suspension is lifted.
-- Where the function owner lacks the privilege on auth.sessions (a hosted project could differ), the command still
-- succeeds with a warning; DESIGN-4 11 has the owner check this on Supabase Cloud.
create function public.account_end_sessions(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    delete from auth.sessions where user_id = p_user;
  exception when insufficient_privilege then
    raise warning 'account_end_sessions: no privilege on auth.sessions, sessions of % kept', p_user;
  end;
end
$$;

revoke execute on function public.account_end_sessions(uuid) from public, anon, authenticated;

-- Sets the forced-change flag and ends the student's sessions; the app then sets a temporary password through the
-- Auth admin API.
create function public.staff_begin_password_reset(p_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.profiles := public.account_caller(false);
  v_target public.profiles := public.account_target(v_caller, p_student);
begin
  insert into public.account_status (student_id, must_change_password, updated_at)
  values (v_target.id, true, now())
  on conflict (student_id) do update set must_change_password = true, updated_at = now();

  insert into public.account_events (student_id, student_name, actor_id, actor_name, action)
  values (v_target.id, v_target.full_name, v_caller.id, v_caller.full_name, 'password_reset');

  perform public.account_end_sessions(v_target.id);
end
$$;

-- p_days null = until lifted ('infinity'), else 1..365; reason 1..500 characters after trimming.
-- Suspending again replaces the period and the reason. Returns the new suspended_until.
create function public.staff_suspend_student(p_student uuid, p_days int, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.profiles := public.account_caller(false);
  v_target public.profiles := public.account_target(v_caller, p_student);
  v_reason text := regexp_replace(coalesce(p_reason, ''), '^\s+|\s+$', '', 'g');
  v_until timestamptz;
begin
  if v_reason = '' or char_length(v_reason) > 500 then
    raise exception 'invalid_input';
  end if;
  if p_days is not null and (p_days < 1 or p_days > 365) then
    raise exception 'invalid_input';
  end if;
  v_until := case when p_days is null then 'infinity'::timestamptz else now() + make_interval(days => p_days) end;

  insert into public.account_status (student_id, suspended_until, suspend_reason, suspended_by, updated_at)
  values (v_target.id, v_until, v_reason, v_caller.id, now())
  on conflict (student_id) do update
    set suspended_until = excluded.suspended_until, suspend_reason = excluded.suspend_reason,
        suspended_by = excluded.suspended_by, updated_at = now();

  insert into public.account_events (student_id, student_name, actor_id, actor_name, action, detail)
  values (v_target.id, v_target.full_name, v_caller.id, v_caller.full_name, 'suspend',
          case when p_days is null then 'จนกว่าจะปลด' else p_days || ' วัน' end || ' · ' || v_reason);

  perform public.account_end_sessions(v_target.id);
  return v_until;
end
$$;

-- Lifting is idempotent (a student who is not suspended stays so); every call is recorded.
create function public.staff_unsuspend_student(p_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.profiles := public.account_caller(false);
  v_target public.profiles := public.account_target(v_caller, p_student);
begin
  update public.account_status
  set suspended_until = null, suspend_reason = null, suspended_by = null, updated_at = now()
  where student_id = v_target.id;

  insert into public.account_events (student_id, student_name, actor_id, actor_name, action)
  values (v_target.id, v_target.full_name, v_caller.id, v_caller.full_name, 'unsuspend');
end
$$;

-- Same rules as /profile (src/lib/profile/validation.ts): whitespace runs collapse to one space and are
-- trimmed; full name 1..100, display name blank -> null, else <= 50.
create function public.admin_set_student_name(p_student uuid, p_full_name text, p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.profiles := public.account_caller(true);
  v_target public.profiles := public.account_target(v_caller, p_student);
  v_full text := regexp_replace(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'), '^ | $', '', 'g');
  v_display text := nullif(regexp_replace(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'), '^ | $', '', 'g'), '');
begin
  if v_full = '' or char_length(v_full) > 100 or char_length(coalesce(v_display, '')) > 50 then
    raise exception 'invalid_input';
  end if;

  update public.profiles set full_name = v_full, display_name = v_display where id = v_target.id;

  insert into public.account_events (student_id, student_name, actor_id, actor_name, action, detail)
  values (v_target.id, v_full, v_caller.id, v_caller.full_name, 'rename',
          v_target.full_name || coalesce(' (' || nullif(btrim(v_target.display_name), '') || ')', '')
          || ' → ' || v_full || coalesce(' (' || v_display || ')', ''));
end
$$;

-- Step 1 of a delete: checks the rules and returns the full name the admin must type. Writes nothing.
create function public.admin_check_student_delete(p_student uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller public.profiles := public.account_caller(true);
  v_target public.profiles := public.account_target(v_caller, p_student);
begin
  return v_target.full_name;
end
$$;

-- Step 3 of a delete, after auth.admin.deleteUser: records the event. The account must be gone already
-- (no profile and no auth user with this id); otherwise invalid_input.
create function public.admin_record_student_deleted(p_student uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller public.profiles := public.account_caller(true);
  v_name text := regexp_replace(coalesce(p_name, ''), '^\s+|\s+$', '', 'g');
begin
  if p_student is null or p_student = v_caller.id then
    raise exception 'self_target';
  end if;
  if v_name = '' or char_length(v_name) > 100
     or exists (select 1 from public.profiles p where p.id = p_student)
     or exists (select 1 from auth.users u where u.id = p_student) then
    raise exception 'invalid_input';
  end if;

  insert into public.account_events (student_id, student_name, actor_id, actor_name, action)
  values (p_student, v_name, v_caller.id, v_caller.full_name, 'delete');
end
$$;

-- /change-password: the caller's own flag only.
create function public.clear_must_change_password()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.account_status
  set must_change_password = false, updated_at = now()
  where student_id = auth.uid() and must_change_password;
end
$$;

revoke execute on function public.staff_list_students(text, text, text, text, int, int) from public, anon;
grant execute on function public.staff_list_students(text, text, text, text, int, int) to authenticated;
revoke execute on function public.staff_get_student(uuid) from public, anon;
grant execute on function public.staff_get_student(uuid) to authenticated;
revoke execute on function public.staff_list_account_events(uuid, int) from public, anon;
grant execute on function public.staff_list_account_events(uuid, int) to authenticated;
revoke execute on function public.staff_begin_password_reset(uuid) from public, anon;
grant execute on function public.staff_begin_password_reset(uuid) to authenticated;
revoke execute on function public.staff_suspend_student(uuid, int, text) from public, anon;
grant execute on function public.staff_suspend_student(uuid, int, text) to authenticated;
revoke execute on function public.staff_unsuspend_student(uuid) from public, anon;
grant execute on function public.staff_unsuspend_student(uuid) to authenticated;
revoke execute on function public.admin_set_student_name(uuid, text, text) from public, anon;
grant execute on function public.admin_set_student_name(uuid, text, text) to authenticated;
revoke execute on function public.admin_check_student_delete(uuid) from public, anon;
grant execute on function public.admin_check_student_delete(uuid) to authenticated;
revoke execute on function public.admin_record_student_deleted(uuid, text) from public, anon;
grant execute on function public.admin_record_student_deleted(uuid, text) to authenticated;
revoke execute on function public.clear_must_change_password() from public, anon;
grant execute on function public.clear_must_change_password() to authenticated;

-- leaderboard: the 0027 definition, skipping students suspended at p_now (public_stats is unchanged: the
-- school total still counts them). Same result columns and grants.
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
      and not exists (
        select 1 from public.account_status st
        where st.student_id = p.id and st.suspended_until > p_now
      )
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
