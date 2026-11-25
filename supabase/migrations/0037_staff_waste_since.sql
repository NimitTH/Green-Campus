-- Round 6 (old-site features 2): the staff dashboard's waste-by-group chart can be limited to a period.
-- staff_waste_by_category gains p_since: when set, only approvals reviewed at or after it count; null (the default)
-- keeps the 0035 behaviour (every approval). Same checks, order and zero-fill as 0035.

drop function public.staff_waste_by_category();

create function public.staff_waste_by_category(p_since timestamptz default null)
returns table (code text, name text, grams bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = 'P0001';
  end if;

  return query
  select wc.code, wc.name, coalesce(g.grams, 0)::bigint
  from public.waste_categories wc
  left join (
    select i.waste_category_id, sum(i.quantity) as grams
    from public.submission_items i
    join public.submissions s on s.id = i.submission_id and s.status = 'approved'
      and (p_since is null or s.reviewed_at >= p_since)
    join public.activities a on a.id = s.activity_id and a.type = 'waste'
    group by i.waste_category_id
  ) g on g.waste_category_id = wc.id
  order by array_position(array['plastic', 'paper', 'metal_glass', 'other'], wc.code);
end
$$;

revoke execute on function public.staff_waste_by_category(timestamptz) from public, anon;
grant execute on function public.staff_waste_by_category(timestamptz) to authenticated;
