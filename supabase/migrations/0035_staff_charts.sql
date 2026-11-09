-- Redesign 4 (DESIGN-4 7.4): chart data for the staff home. Staff only (teacher/admin), security definer.

-- Carbon saved per Bangkok calendar month, oldest first, the current month last; months without entries are 0.
-- Sums earn entries only. p_months is clamped to 1..24.
create function public.staff_carbon_by_month(p_months int default 6)
returns table (month date, carbon_kg numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_n int := least(greatest(coalesce(p_months, 6), 1), 24);
  v_cur date := date_trunc('month', now() at time zone 'Asia/Bangkok')::date;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = 'P0001';
  end if;

  return query
  select m.month::date,
         round(coalesce(sum(l.carbon_kg), 0), 3)
  from generate_series(v_cur - make_interval(months => v_n - 1), v_cur, interval '1 month') as m(month)
  left join (
    select date_trunc('month', le.created_at at time zone 'Asia/Bangkok')::date as month, le.carbon_kg
    from public.ledger_entries le
    where le.kind = 'earn'
  ) l on l.month = m.month::date
  group by m.month
  order by m.month;
end
$$;

-- Approved waste grams per category (all four categories, zeros included), ordered by code's fixed order.
create function public.staff_waste_by_category()
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
    join public.activities a on a.id = s.activity_id and a.type = 'waste'
    group by i.waste_category_id
  ) g on g.waste_category_id = wc.id
  order by array_position(array['plastic', 'paper', 'metal_glass', 'other'], wc.code);
end
$$;

revoke execute on function public.staff_carbon_by_month(int) from public, anon;
grant execute on function public.staff_carbon_by_month(int) to authenticated;
revoke execute on function public.staff_waste_by_category() from public, anon;
grant execute on function public.staff_waste_by_category() to authenticated;
