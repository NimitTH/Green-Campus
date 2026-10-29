-- Redesign 3 (DESIGN-3 7.3): public lookup of teacher/admin names by id (article bylines). Students are never returned.
-- At most the first 100 ids are evaluated.
create function public.staff_names(p_ids uuid[])
returns table (id uuid, name text)
language sql stable security definer set search_path = ''
as $$
  select p.id, coalesce(nullif(trim(p.display_name), ''), p.full_name)
  from public.profiles p
  where p.role in ('teacher', 'admin')
    and p.id = any((coalesce(p_ids, '{}'::uuid[]))[1:100]);
$$;

revoke execute on function public.staff_names(uuid[]) from public;
grant execute on function public.staff_names(uuid[]) to anon, authenticated;
