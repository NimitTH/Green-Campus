-- Student dashboard (Task 11, R52): approved waste grams per student and category.
-- security_invoker: RLS on submissions / submission_items / waste_categories applies, so a
-- student sees only their own rows and staff see every student's.
create view public.student_waste_totals
with (security_invoker = true)
as
select
  s.student_id,
  i.waste_category_id,
  c.name as category_name,
  sum(i.quantity)::bigint as grams
from public.submissions s
join public.activities a on a.id = s.activity_id and a.type = 'waste'
join public.submission_items i on i.submission_id = s.id
join public.waste_categories c on c.id = i.waste_category_id
where s.status = 'approved'
group by s.student_id, i.waste_category_id, c.name;

revoke all on public.student_waste_totals from public, anon, authenticated;
grant select on public.student_waste_totals to authenticated, service_role;
