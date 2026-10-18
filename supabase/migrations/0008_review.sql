-- Green Campus: review results into the points/carbon ledger (Task 9).
-- Spec 5.1 (ledger sign rules, balances), 6.1 (formulas), 6.5 (review rules), 7 (function table),
-- 8.1 (RLS), 9.5 (notifications). Rulings R34-R38.
--
-- * approve_submission / reject_submission are the only way a submission leaves 'pending'
--   (no client writes on submissions or ledger_entries, 0002). Both RAISE (no attempt counter
--   to keep, R34); the message is exactly the code and the app maps it to Thai (src/lib/errors.ts).
-- * Points and carbon are computed at approve time from the rates of that moment and stored in
--   ledger_entries; later rate changes never touch rows already written (spec 5).
-- * student_balance: balance per student, security_invoker so the ledger/profiles RLS applies.
-- * Changing activities.type once a submission exists is refused (R38): approvals read the
--   current type, so a changed type would apply the wrong formula to old items.

-- approve_submission ---------------------------------------------------------------------
-- Errors:
--   not_authenticated (42501)  no signed-in user
--   not_staff         (42501)  caller is not a teacher/admin
--   submission_not_found       unknown submission
--   own_submission             the reviewer is the submission's student
--   not_pending                already approved or rejected (also the loser of a concurrent review)
-- Formulas (spec 6.1, R35):
--   waste  points = floor(sum(grams x points_per_kg) / 1000)   (integer arithmetic)
--          carbon = round(sum(grams x carbon_kg_per_kg) / 1000, 3)   (rounded once over the sum)
--   trees  points = count x unit_points, carbon = count x coalesce(unit_carbon_kg, 0)
--   fixed  points = unit_points,         carbon = coalesce(unit_carbon_kg, 0)
create or replace function public.approve_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.submissions%rowtype;
  v_activity public.activities%rowtype;
  v_count bigint;
  v_points bigint;
  v_carbon numeric(12, 3);
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  -- FOR UPDATE: a concurrent approve/reject waits here, then sees the new status (not_pending),
  -- so one submission gets at most one ledger row.
  select s.* into v_sub from public.submissions s where s.id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found';
  end if;
  if v_sub.student_id = v_uid then
    raise exception 'own_submission';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'not_pending';
  end if;

  select a.* into v_activity from public.activities a where a.id = v_sub.activity_id;

  if v_activity.type = 'waste' then
    select
      coalesce(sum(si.quantity::bigint * wc.points_per_kg), 0) / 1000,
      round(coalesce(sum(si.quantity * wc.carbon_kg_per_kg), 0) / 1000, 3)
      into v_points, v_carbon
    from public.submission_items si
    join public.waste_categories wc on wc.id = si.waste_category_id
    where si.submission_id = v_sub.id;
  elsif v_activity.type = 'trees' then
    select coalesce(sum(si.quantity), 0) into v_count
    from public.submission_items si
    where si.submission_id = v_sub.id;
    v_points := v_count * v_activity.unit_points;
    v_carbon := v_count * coalesce(v_activity.unit_carbon_kg, 0);
  else
    v_points := v_activity.unit_points;
    v_carbon := coalesce(v_activity.unit_carbon_kg, 0);
  end if;

  insert into public.ledger_entries (student_id, kind, points, carbon_kg, ref_submission_id, created_by)
  values (v_sub.student_id, 'earn', v_points, v_carbon, v_sub.id, v_uid);

  update public.submissions
  set status = 'approved', reviewed_by = v_uid, reviewed_at = now(), updated_at = now()
  where id = v_sub.id;

  perform public.notify(
    v_sub.student_id,
    'submission_approved',
    'ผลของคุณได้รับการอนุมัติ',
    'กิจกรรม "' || v_activity.title || '" ได้ ' || v_points::text || ' แต้ม และลด carbon '
      || v_carbon::text || ' กก. CO2e',
    '/my-submissions'
  );
end;
$$;

revoke execute on function public.approve_submission(uuid) from public, anon;
grant execute on function public.approve_submission(uuid) to authenticated, service_role;

-- reject_submission ----------------------------------------------------------------------
-- Errors: not_authenticated / not_staff (42501), reason_required (null or only whitespace),
-- reason_too_long (> 500 characters), submission_not_found, own_submission, not_pending.
create or replace function public.reject_submission(p_submission_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  -- trims every kind of whitespace (newlines, tabs), like String.prototype.trim in the app
  v_reason text := regexp_replace(coalesce(p_reason, ''), '^\s+|\s+$', '', 'g');
  v_sub public.submissions%rowtype;
  v_title text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  if v_reason = '' then
    raise exception 'reason_required';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'reason_too_long';
  end if;

  select s.* into v_sub from public.submissions s where s.id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found';
  end if;
  if v_sub.student_id = v_uid then
    raise exception 'own_submission';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'not_pending';
  end if;

  update public.submissions
  set status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), reject_reason = v_reason,
      updated_at = now()
  where id = v_sub.id;

  select a.title into v_title from public.activities a where a.id = v_sub.activity_id;
  perform public.notify(
    v_sub.student_id,
    'submission_rejected',
    'ผลของคุณไม่ผ่านการตรวจ',
    'กิจกรรม "' || v_title || '" เหตุผล: ' || v_reason,
    '/my-submissions'
  );
end;
$$;

revoke execute on function public.reject_submission(uuid, text) from public, anon;
grant execute on function public.reject_submission(uuid, text) to authenticated, service_role;

-- student_balance (R37) ------------------------------------------------------------------
-- One row per student profile. points = sum of every kind; carbon_kg = earn + adjust (spec 5.1).
-- security_invoker: a student sees only their own row, staff see every student (RLS 0002).
create view public.student_balance
with (security_invoker = true)
as
select
  p.id as student_id,
  coalesce(sum(l.points), 0)::bigint as points,
  coalesce(sum(l.carbon_kg) filter (where l.kind in ('earn', 'adjust')), 0)::numeric as carbon_kg
from public.profiles p
left join public.ledger_entries l on l.student_id = p.id
where p.role = 'student'
group by p.id;

revoke all on public.student_balance from public, anon, authenticated;
grant select on public.student_balance to authenticated, service_role;

-- activity type lock (R38) ---------------------------------------------------------------
create or replace function public.prevent_activity_type_change_with_submissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type is distinct from old.type
     and exists (select 1 from public.submissions s where s.activity_id = old.id) then
    raise exception 'activity_type_locked'
      using hint = 'สร้างกิจกรรมใหม่ถ้าต้องการชนิดอื่น';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_activity_type_change_with_submissions()
  from public, anon, authenticated;

create trigger activities_prevent_type_change_with_submissions
  before update of type on public.activities
  for each row execute function public.prevent_activity_type_change_with_submissions();
