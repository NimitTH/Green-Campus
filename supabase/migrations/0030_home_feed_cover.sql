-- Redesign 3 (DESIGN-3 7.4): home_open_activities(p_limit) = public_open_activities (0026) plus cover_path as the last
-- column. Conditions, clamp and grants are identical to 0026. public_open_activities is left untouched because the
-- existing public_home_feed.test.sql (which may not be edited) pins its exact column list.
create function public.home_open_activities(p_limit int default 3)
returns table (id uuid, title text, type text, starts_at timestamptz, ends_at timestamptz, cover_path text)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.title, a.type, a.starts_at, a.ends_at, a.cover_path
  from public.activities a
  where a.status = 'open' and a.ends_at >= now()
  order by a.ends_at asc, a.id
  limit least(greatest(coalesce(p_limit, 3), 1), 12);
$$;

revoke execute on function public.home_open_activities(int) from public;
grant execute on function public.home_open_activities(int) to anon, authenticated;
