-- Green Campus: activities visibility, join_activity and delete rules (Task 6).
-- Spec 5 (activities, participations), 6.3 (join window), 7 (join_activity), 8.1 (RLS).
--
-- * Students read activities that are 'open' plus the ones they joined (a joined
--   activity stays visible after it is closed). Staff read all. Staff insert/update;
--   admin deletes (policies from 0002, unchanged except SELECT).
-- * An activity that has submissions can never be deleted (close it instead): a BEFORE
--   DELETE trigger raises SQLSTATE 23503 'activity_has_submissions'. Participations and
--   weigh codes of an activity without submissions are deleted with it (FK CASCADE).
-- * participations stay function-only (no INSERT/UPDATE/DELETE privilege, 0002);
--   rows are created by join_activity.

-- activities: SELECT ------------------------------------------------------
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
  for select to authenticated
  using (
    status = 'open'
    or (select public.is_staff())
    or exists (
      select 1
      from public.participations p
      where p.activity_id = activities.id
        and p.student_id = (select auth.uid())
    )
  );

-- delete rules --------------------------------------------------------------
alter table public.participations
  drop constraint participations_activity_id_fkey,
  add constraint participations_activity_id_fkey
    foreign key (activity_id) references public.activities (id) on delete cascade;
alter table public.weigh_codes
  drop constraint weigh_codes_activity_id_fkey,
  add constraint weigh_codes_activity_id_fkey
    foreign key (activity_id) references public.activities (id) on delete cascade;

create or replace function public.prevent_activity_delete_with_submissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.submissions s where s.activity_id = old.id) then
    raise exception 'activity_has_submissions'
      using errcode = '23503',
            hint = 'ปิดกิจกรรม (status = closed) แทนการลบ';
  end if;
  return old;
end;
$$;

revoke execute on function public.prevent_activity_delete_with_submissions()
  from public, anon, authenticated;

create trigger activities_prevent_delete_with_submissions
  before delete on public.activities
  for each row execute function public.prevent_activity_delete_with_submissions();

-- join_activity ---------------------------------------------------------------
-- Errors (message is exactly the code; the app maps codes to Thai, src/lib/errors.ts):
--   not_authenticated (42501)  no signed-in user
--   not_student       (42501)  caller is not a student (spec 7: caller = student)
--   activity_not_open (P0001)  unknown activity or status <> 'open'
--   activity_ended    (P0001)  now() >= ends_at
--   already_joined    (P0001)  the caller already joined
create or replace function public.join_activity(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
  v_ends_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'student' then
    raise exception 'not_student' using errcode = '42501';
  end if;

  -- FOR SHARE: a concurrent status change waits until this join commits.
  select a.status, a.ends_at into v_status, v_ends_at
  from public.activities a
  where a.id = p_activity_id
  for share;

  if not found or v_status <> 'open' then
    raise exception 'activity_not_open';
  end if;
  if now() >= v_ends_at then
    raise exception 'activity_ended';
  end if;

  insert into public.participations (activity_id, student_id)
  values (p_activity_id, v_uid)
  on conflict (activity_id, student_id) do nothing;
  if not found then
    raise exception 'already_joined';
  end if;
end;
$$;

revoke execute on function public.join_activity(uuid) from public, anon;
grant execute on function public.join_activity(uuid) to authenticated, service_role;
