-- Redesign 2 (DESIGN-2 1.3 / 7.1): anonymous home-page feed. Two read-only security definer functions expose only
-- safe columns of open activities and active rewards. Same security model as 0025 (empty search_path, anon + authenticated).

-- public_open_activities: open activities that have not ended, soonest end first. Safe columns only.
create function public.public_open_activities(p_limit int default 3)
returns table (id uuid, title text, type text, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.title, a.type, a.starts_at, a.ends_at
  from public.activities a
  where a.status = 'open' and a.ends_at >= now()
  order by a.ends_at asc, a.id
  limit least(greatest(coalesce(p_limit, 3), 1), 12);
$$;

-- public_active_rewards: active rewards in stock, newest first. Safe columns only.
create function public.public_active_rewards(p_limit int default 4)
returns table (id uuid, name text, points_cost int, stock int, image_path text)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.name, r.points_cost, r.stock, r.image_path
  from public.rewards r
  where r.active and r.stock > 0
  order by r.created_at desc, r.id
  limit least(greatest(coalesce(p_limit, 4), 1), 12);
$$;

revoke execute on function public.public_open_activities(int) from public;
revoke execute on function public.public_active_rewards(int) from public;
grant execute on function public.public_open_activities(int) to anon, authenticated;
grant execute on function public.public_active_rewards(int) to anon, authenticated;
