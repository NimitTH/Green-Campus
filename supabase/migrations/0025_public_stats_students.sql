-- Phase-3 fix wave (R143, M3): public_stats() counts the same population for all three totals.
-- 0017 limited carbon_kg to students (role = 'student') but waste_grams and trees counted every approved
-- submission, so a student later promoted to teacher/admin (or a staff test row) moved the waste and tree
-- totals but not the carbon total. All three now join profiles on the student and require role = 'student'.
-- Same signature, grants and security model as 0017 (security definer, empty search_path, anon + authenticated).

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
      join public.profiles p on p.id = s.student_id and p.role = 'student'
      join public.activities a on a.id = s.activity_id and a.type = 'waste'
    ),
    'trees', (
      select coalesce(sum(i.quantity), 0)::bigint
      from public.submission_items i
      join public.submissions s on s.id = i.submission_id and s.status = 'approved'
      join public.profiles p on p.id = s.student_id and p.role = 'student'
      join public.activities a on a.id = s.activity_id and a.type = 'trees'
    )
  )
$$;

revoke execute on function public.public_stats() from public;
grant execute on function public.public_stats() to anon, authenticated;
