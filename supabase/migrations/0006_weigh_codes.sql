-- Green Campus: weigh station codes (Task 7).
-- Spec 6.3 (submit window), 6.4 (weigh codes), 7 (issue_weigh_code), 8.1 (RLS).
--
-- issue_weigh_code(activity, student) is the only way a code is created: weigh_codes has no
-- client write privileges (0002). Staff (teacher/admin) issue a one-time 6-digit code at the
-- weighing point; submit_result (Task 8) consumes it.
--
-- Errors (message is exactly the code; the app maps codes to Thai, src/lib/errors.ts):
--   not_authenticated  (42501)  no signed-in user
--   not_staff          (42501)  caller is not a teacher/admin
--   activity_not_found (P0001)  unknown activity
--   code_not_required  (P0001)  activity.requires_code is false
--   not_participant    (P0001)  the student has not joined the activity
--   out_of_window      (P0001)  draft, before starts_at, or after ends_at + 3 days (R18:
--                               'open' and 'closed' are both fine inside the window;
--                               submit_result must use the same rule)
create or replace function public.issue_weigh_code(p_activity_id uuid, p_student_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_requires_code boolean;
  v_participation uuid;
  v_bytes bigint;
  v_code text;
  v_expires_at timestamptz := now() + interval '30 minutes';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  select a.status, a.starts_at, a.ends_at, a.requires_code
    into v_status, v_starts_at, v_ends_at, v_requires_code
  from public.activities a
  where a.id = p_activity_id;
  if not found then
    raise exception 'activity_not_found';
  end if;
  if not v_requires_code then
    raise exception 'code_not_required';
  end if;

  -- FOR UPDATE on the participation row serialises concurrent issues for the same pair, so
  -- the revoke + insert below cannot interleave and trip weigh_codes_one_active_per_pair.
  select p.id into v_participation
  from public.participations p
  where p.activity_id = p_activity_id and p.student_id = p_student_id
  for update;
  if not found then
    raise exception 'not_participant';
  end if;

  if v_status = 'draft' or now() < v_starts_at or now() > v_ends_at + interval '3 days' then
    raise exception 'out_of_window';
  end if;

  update public.weigh_codes wc
  set revoked_at = now(), updated_at = now()
  where wc.activity_id = p_activity_id
    and wc.student_id = p_student_id
    and wc.used_at is null
    and wc.revoked_at is null;

  -- Uniform 6 digits by rejection sampling: draw 32 bits, keep values below the largest
  -- multiple of 10^6 that fits (4294000000), then take them mod 10^6 and zero-pad.
  loop
    v_bytes := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint;
    exit when v_bytes < 4294000000;
  end loop;
  v_code := lpad((v_bytes % 1000000)::text, 6, '0');

  insert into public.weigh_codes (activity_id, student_id, code, issued_by, expires_at)
  values (p_activity_id, p_student_id, v_code, v_uid, v_expires_at);

  return query select v_code, v_expires_at;
end;
$$;

revoke execute on function public.issue_weigh_code(uuid, uuid) from public, anon;
grant execute on function public.issue_weigh_code(uuid, uuid) to authenticated, service_role;
