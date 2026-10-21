-- Green Campus: reports data (Task 16, R102-R107). Builds on 0001-0017 (not edited).
--
-- Lock order: both report functions are read-only (no row locks), so the canonical lock order in
-- the 0016 header is unchanged.
--
-- * R102: waste_categories.code is a stable key for the four report columns, so admins may rename
--   categories (Task 18) without moving grams between columns.
-- * R103: report_activities / report_students (staff only, definer). Spec 10: only approved results of
--   ended activities (status 'closed' or ends_at <= now(); drafts never) count, and the range filters
--   activities.ends_at in Asia/Bangkok, so a result approved after the end still belongs to that range.
--   Points and carbon are the 'earn' ledger rows of those submissions, never recomputed.

-- R102: category codes -------------------------------------------------------------------------------------
alter table public.waste_categories add column code text unique;

update public.waste_categories set code = 'plastic' where name = 'พลาสติก' and code is null;
update public.waste_categories set code = 'paper' where name = 'กระดาษ' and code is null;
update public.waste_categories set code = 'metal_glass' where name = 'โลหะ/แก้ว' and code is null;
update public.waste_categories set code = 'other' where name = 'ขยะทั่วไป/อื่นๆ' and code is null;

alter table public.waste_categories alter column code set not null;
alter table public.waste_categories
  add constraint waste_categories_code_check check (code in ('plastic', 'paper', 'metal_glass', 'other'));

-- report_activities (R103) ----------------------------------------------------------------------------------
create or replace function public.report_activities(p_from date, p_to date)
returns table (
  title text,
  ends_on date,
  participants int,
  approved_submissions int,
  grams_plastic bigint,
  grams_paper bigint,
  grams_metal_glass bigint,
  grams_other bigint,
  trees bigint,
  points bigint,
  carbon_kg numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role in ('teacher', 'admin')) then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  return query
  with act as (
    select a.id, a.title, a.type, (a.ends_at at time zone 'Asia/Bangkok')::date as ends_on
    from public.activities a
    where a.status <> 'draft'
      and (a.status = 'closed' or a.ends_at <= now())
      and (a.ends_at at time zone 'Asia/Bangkok')::date between p_from and p_to
  ),
  sub as (
    select s.id, s.activity_id
    from public.submissions s
    join act on act.id = s.activity_id
    where s.status = 'approved'
  ),
  item as (
    select i.submission_id,
           coalesce(sum(i.quantity) filter (where wc.code = 'plastic'), 0)::bigint as g_plastic,
           coalesce(sum(i.quantity) filter (where wc.code = 'paper'), 0)::bigint as g_paper,
           coalesce(sum(i.quantity) filter (where wc.code = 'metal_glass'), 0)::bigint as g_metal,
           coalesce(sum(i.quantity) filter (where wc.code = 'other'), 0)::bigint as g_other,
           coalesce(sum(i.quantity) filter (where i.waste_category_id is null), 0)::bigint as n_trees
    from public.submission_items i
    join sub on sub.id = i.submission_id
    join act on act.id = sub.activity_id
    left join public.waste_categories wc on wc.id = i.waste_category_id
    where act.type in ('waste', 'trees')
    group by i.submission_id
  ),
  earn as (
    select l.ref_submission_id as submission_id,
           sum(l.points)::bigint as pts,
           sum(l.carbon_kg) as cb
    from public.ledger_entries l
    join sub on sub.id = l.ref_submission_id
    where l.kind = 'earn'
    group by l.ref_submission_id
  ),
  per_act as (
    select sub.activity_id,
           count(*)::int as n_sub,
           coalesce(sum(item.g_plastic), 0)::bigint as g_plastic,
           coalesce(sum(item.g_paper), 0)::bigint as g_paper,
           coalesce(sum(item.g_metal), 0)::bigint as g_metal,
           coalesce(sum(item.g_other), 0)::bigint as g_other,
           coalesce(sum(item.n_trees), 0)::bigint as n_trees,
           coalesce(sum(earn.pts), 0)::bigint as pts,
           coalesce(sum(earn.cb), 0) as cb
    from sub
    left join item on item.submission_id = sub.id
    left join earn on earn.submission_id = sub.id
    group by sub.activity_id
  )
  select act.title,
         act.ends_on,
         (select count(*) from public.participations pa where pa.activity_id = act.id)::int,
         coalesce(pa2.n_sub, 0),
         coalesce(pa2.g_plastic, 0)::bigint,
         coalesce(pa2.g_paper, 0)::bigint,
         coalesce(pa2.g_metal, 0)::bigint,
         coalesce(pa2.g_other, 0)::bigint,
         coalesce(pa2.n_trees, 0)::bigint,
         coalesce(pa2.pts, 0)::bigint,
         round(coalesce(pa2.cb, 0), 3)
  from act
  left join per_act pa2 on pa2.activity_id = act.id
  order by act.ends_on, act.title;
end;
$$;

revoke execute on function public.report_activities(date, date) from public, anon;
grant execute on function public.report_activities(date, date) to authenticated, service_role;

-- report_students (R103) ------------------------------------------------------------------------------------
create or replace function public.report_students(p_from date, p_to date)
returns table (
  full_name text,
  points bigint,
  carbon_kg numeric,
  grams_total bigint,
  trees bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role in ('teacher', 'admin')) then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  return query
  with act as (
    select a.id, a.type
    from public.activities a
    where a.status <> 'draft'
      and (a.status = 'closed' or a.ends_at <= now())
      and (a.ends_at at time zone 'Asia/Bangkok')::date between p_from and p_to
  ),
  sub as (
    select s.id, s.student_id, act.type
    from public.submissions s
    join act on act.id = s.activity_id
    where s.status = 'approved'
  ),
  item as (
    select i.submission_id,
           coalesce(sum(i.quantity) filter (where sub.type = 'waste'), 0)::bigint as grams,
           coalesce(sum(i.quantity) filter (where sub.type = 'trees'), 0)::bigint as n_trees
    from public.submission_items i
    join sub on sub.id = i.submission_id
    group by i.submission_id
  ),
  earn as (
    select l.ref_submission_id as submission_id,
           sum(l.points)::bigint as pts,
           sum(l.carbon_kg) as cb
    from public.ledger_entries l
    join sub on sub.id = l.ref_submission_id
    where l.kind = 'earn'
    group by l.ref_submission_id
  )
  select p.full_name,
         coalesce(sum(earn.pts), 0)::bigint,
         round(coalesce(sum(earn.cb), 0), 3),
         coalesce(sum(item.grams), 0)::bigint,
         coalesce(sum(item.n_trees), 0)::bigint
  from sub
  join public.profiles p on p.id = sub.student_id
  left join item on item.submission_id = sub.id
  left join earn on earn.submission_id = sub.id
  group by p.id, p.full_name
  order by 3 desc, p.full_name;
end;
$$;

revoke execute on function public.report_students(date, date) from public, anon;
grant execute on function public.report_students(date, date) to authenticated, service_role;
