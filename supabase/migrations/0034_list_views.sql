-- Redesign 4 (DESIGN-4 7.3): list views for server-side search/sort/paging. All security_invoker: the RLS of the
-- source tables (submissions, orders, activities, ...) applies to the caller.

create view public.my_submission_list with (security_invoker = true) as
select
  s.id,
  s.student_id,
  s.activity_id,
  a.title as activity_title,
  a.type as activity_type,
  a.cover_path as activity_cover_path,
  s.status,
  case s.status when 'pending' then 1 when 'approved' then 2 else 3 end as status_rank,
  (select sum(l.points)::int from public.ledger_entries l
    where l.ref_submission_id = s.id and l.kind = 'earn') as points,
  case when a.type = 'waste' then
    (select sum(i.quantity)::bigint from public.submission_items i where i.submission_id = s.id) end as grams,
  case when a.type = 'trees' then
    (select sum(i.quantity)::bigint from public.submission_items i where i.submission_id = s.id) end as trees,
  s.reject_reason,
  s.created_at
from public.submissions s
join public.activities a on a.id = s.activity_id
where s.student_id = (select auth.uid());

create view public.my_order_list with (security_invoker = true) as
select
  o.id,
  o.student_id,
  o.status,
  o.total_points,
  o.created_at,
  o.expires_at,
  o.ready_at,
  coalesce((select string_agg(oi.reward_name, ' ' order by oi.reward_name)
            from public.order_items oi
            where oi.order_id = o.id), '') as item_names
from public.orders o
where o.student_id = (select auth.uid());

-- The staff_* views are empty for a non-staff caller (DESIGN-4 7.3), on top of the RLS of the source tables.
create view public.staff_activity_list with (security_invoker = true) as
select
  a.id,
  a.title,
  a.description,
  a.location,
  a.is_offsite,
  a.starts_at,
  a.ends_at,
  a.status,
  a.type,
  a.requires_code,
  a.unit_points,
  a.unit_carbon_kg,
  a.max_per_submission,
  a.created_by,
  a.created_at,
  a.updated_at,
  a.cover_path,
  a.details,
  (select count(*) from public.participations p where p.activity_id = a.id) as participant_count
from public.activities a
where (select public.is_staff());

create view public.staff_order_list with (security_invoker = true) as
select
  o.id,
  o.student_id,
  o.status,
  case
    when o.status = 'pending_pickup' and o.ready_at is null then 'preparing'
    when o.status = 'pending_pickup' then 'ready'
    when o.status = 'completed' then 'completed'
    else 'closed'
  end as status_group,
  o.total_points,
  o.created_at,
  o.expires_at,
  o.ready_at,
  coalesce(nullif(trim(pr.display_name), ''), pr.full_name) as buyer_name,
  pr.full_name as buyer_full_name,
  pr.display_name as buyer_display_name
from public.orders o
left join public.profiles pr on pr.id = o.student_id
where (select public.is_staff());

revoke all on public.my_submission_list, public.my_order_list, public.staff_activity_list, public.staff_order_list
  from public, anon, authenticated;
grant select on public.my_submission_list, public.my_order_list, public.staff_activity_list, public.staff_order_list
  to authenticated, service_role;
