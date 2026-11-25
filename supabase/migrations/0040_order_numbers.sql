-- Round 6 (old-site features 3): readable order numbers ORD-YYYYMMDD-NNNN.
-- * order_day_counters: one row per Asia/Bangkok day; next_order_no() takes the next number with an upsert, whose row
--   lock serialises concurrent checkouts on the same day (no duplicates, no gaps from failed unique checks).
-- * orders.order_no: defaults to next_order_no(now()) (checkout sets it explicitly); existing orders are numbered per Bangkok day by (created_at, id).
-- * checkout / complete_order / release_orders: the 0016 / 0014 bodies, with the order number in the notification
--   texts instead of the first 8 hex characters. The order_new link keeps ?q=<8 hex> (0016): the old hex search
--   still finds the order, and order_ready / phase2_hardening tests pin that link.
-- * my_order_list / staff_order_list gain order_no (appended, so create or replace keeps their grants).

create table public.order_day_counters (
  day date primary key,
  last_no integer not null check (last_no >= 0)
);
alter table public.order_day_counters enable row level security;
revoke all on public.order_day_counters from public, anon, authenticated;

create function public.next_order_no(p_at timestamptz)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_day date := (p_at at time zone 'Asia/Bangkok')::date;
  v_n integer;
begin
  insert into public.order_day_counters as c (day, last_no) values (v_day, 1)
  on conflict (day) do update set last_no = c.last_no + 1
  returning c.last_no into v_n;
  -- lpad truncates longer text, so only pad below 10000 (past 9999 the number just grows)
  return 'ORD-' || to_char(v_day, 'YYYYMMDD') || '-' || case when v_n < 10000 then lpad(v_n::text, 4, '0') else v_n::text end;
end
$$;

revoke execute on function public.next_order_no(timestamptz) from public, anon, authenticated;

alter table public.orders add column order_no text;

with numbered as (
  select o.id,
         (o.created_at at time zone 'Asia/Bangkok')::date as day,
         row_number() over (partition by (o.created_at at time zone 'Asia/Bangkok')::date order by o.created_at, o.id) as n
  from public.orders o
)
update public.orders o
set order_no = 'ORD-' || to_char(numbered.day, 'YYYYMMDD') || '-'
  || case when numbered.n < 10000 then lpad(numbered.n::text, 4, '0') else numbered.n::text end
from numbered
where numbered.id = o.id;

insert into public.order_day_counters (day, last_no)
select (o.created_at at time zone 'Asia/Bangkok')::date, count(*)
from public.orders o
group by 1;

-- every later insert (checkout, and direct inserts by tests or tools) gets the next number of its Bangkok day
alter table public.orders alter column order_no set default public.next_order_no(now());
alter table public.orders alter column order_no set not null;
alter table public.orders add constraint orders_order_no_key unique (order_no);

create or replace function public.checkout()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_balance bigint;
  v_total bigint := 0;
  v_pieces bigint := 0;
  v_cart_ids uuid[] := '{}';
  v_blocked jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_order_no text;
  r record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- 1. the caller's profile: serialises checkouts of one student. NO KEY UPDATE, not UPDATE: the
  --    FK checks of cancel/expire inserts take KEY SHARE on this row (see the header).
  select p.role into v_role from public.profiles p where p.id = v_uid for no key update;
  if not found or v_role <> 'student' then
    raise exception 'not_student' using errcode = '42501';
  end if;

  -- 2. the balance, after the lock
  select coalesce(sum(l.points), 0) into v_balance from public.ledger_entries l where l.student_id = v_uid;

  -- 3. the cart lines and their rewards, locked in reward id order (cart lines are unique per
  --    reward, so this is one order for both tables). FOR UPDATE returns the latest stock.
  for r in
    select c.id as cart_id, c.reward_id, c.qty, rw.points_cost, rw.stock, rw.active
    from public.cart_items c
    join public.rewards rw on rw.id = c.reward_id
    where c.student_id = v_uid
    order by rw.id
    for update
  loop
    v_cart_ids := v_cart_ids || r.cart_id;
    if not r.active then
      v_blocked := v_blocked || jsonb_build_object('reward_id', r.reward_id, 'reason', 'inactive');
      continue;
    end if;
    if r.qty > r.stock then
      v_blocked := v_blocked || jsonb_build_object('reward_id', r.reward_id, 'reason', 'stock', 'available', r.stock);
    end if;
    v_total := v_total + r.qty::bigint * r.points_cost;
    v_pieces := v_pieces + r.qty;
  end loop;

  if cardinality(v_cart_ids) = 0 then
    return jsonb_build_object('ok', false, 'error_code', 'cart_empty', 'order_id', null, 'blocked', '[]'::jsonb);
  end if;
  if v_total > v_balance then
    v_blocked := v_blocked || jsonb_build_object('reward_id', null, 'reason', 'points', 'shortfall', v_total - v_balance);
  end if;
  if jsonb_array_length(v_blocked) > 0 then
    return jsonb_build_object('ok', false, 'error_code', 'blocked', 'order_id', null, 'blocked', v_blocked);
  end if;

  -- 4. success: everything below works on the locked rows only
  v_order_no := public.next_order_no(now());
  insert into public.orders (student_id, total_points, expires_at, order_no)
  values (v_uid, v_total::integer, now() + interval '7 days', v_order_no)
  returning id into v_order_id;

  insert into public.order_items (order_id, reward_id, qty, unit_cost, reward_name)
  select v_order_id, c.reward_id, c.qty, rw.points_cost, rw.name
  from public.cart_items c
  join public.rewards rw on rw.id = c.reward_id
  where c.id = any (v_cart_ids);

  update public.rewards rw
  set stock = rw.stock - c.qty
  from public.cart_items c
  where c.id = any (v_cart_ids) and rw.id = c.reward_id;

  insert into public.ledger_entries (student_id, kind, points, carbon_kg, ref_order_id, created_by)
  values (v_uid, 'redeem', -v_total::integer, 0, v_order_id, v_uid);

  delete from public.cart_items c where c.id = any (v_cart_ids);

  perform public.notify(
    v_uid,
    'order_created',
    'แลกของรางวัลสำเร็จ',
    'ออเดอร์ ' || v_order_no || ' ' || v_pieces::text || ' ชิ้น รวม ' || v_total::text
      || ' แต้ม รับของได้ที่แผนกภายใน 7 วัน',
    '/orders/' || v_order_id::text
  );

  perform public.notify_staff(
    'order_new',
    'มีออเดอร์ใหม่',
    (select coalesce(nullif(btrim(p.display_name), ''), p.full_name) from public.profiles p where p.id = v_uid)
      || ' ' || v_pieces::text || ' ชิ้น รวม ' || v_total::text || ' แต้ม',
    '/staff/orders?q=' || upper(left(v_order_id::text, 8))
  );

  return jsonb_build_object('ok', true, 'error_code', null, 'order_id', v_order_id, 'blocked', '[]'::jsonb);
end;
$$;


create or replace function public.complete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  select o.* into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status <> 'pending_pickup' then
    raise exception 'order_not_pending';
  end if;
  if now() > v_order.expires_at then
    raise exception 'order_expired';
  end if;

  update public.orders
  set status = 'completed', completed_by = v_uid, completed_at = now(), updated_at = now()
  where id = v_order.id;

  perform public.notify(
    v_order.student_id,
    'order_completed',
    'รับของรางวัลแล้ว',
    'ออเดอร์ ' || v_order.order_no || ' รับของเรียบร้อยแล้ว',
    '/orders/' || v_order.id::text
  );
end;
$$;


create or replace function public.release_orders(p_order_ids uuid[], p_status text, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count integer;
begin
  if p_status not in ('cancelled', 'expired') then
    raise exception 'invalid release status %', p_status;
  end if;

  -- defence in depth: only orders still pending are released (the callers checked already)
  select coalesce(array_agg(o.id), '{}') into v_ids
  from public.orders o
  where o.id = any (p_order_ids) and o.status = 'pending_pickup';
  if cardinality(v_ids) = 0 then
    return 0;
  end if;

  perform 1
  from public.rewards rw
  where rw.id in (select oi.reward_id from public.order_items oi where oi.order_id = any (v_ids))
  order by rw.id
  for update;

  update public.rewards rw
  set stock = rw.stock + t.qty
  from (
    select oi.reward_id, sum(oi.qty)::integer as qty
    from public.order_items oi
    where oi.order_id = any (v_ids)
    group by oi.reward_id
  ) t
  where rw.id = t.reward_id;

  insert into public.ledger_entries (student_id, kind, points, carbon_kg, ref_order_id, created_by)
  select o.student_id, 'refund', o.total_points, 0, o.id, p_actor
  from public.orders o
  where o.id = any (v_ids) and o.status = 'pending_pickup' and o.total_points > 0;

  update public.orders o
  set status = p_status, updated_at = now()
  where o.id = any (v_ids) and o.status = 'pending_pickup';
  get diagnostics v_count = row_count;

  perform public.notify(
    o.student_id,
    'order_' || p_status,
    case p_status when 'cancelled' then 'ออเดอร์ถูกยกเลิก' else 'ออเดอร์หมดอายุ' end,
    'ออเดอร์ ' || o.order_no
      || case p_status when 'cancelled' then ' ถูกยกเลิกโดยครูหรือผู้ดูแล' else ' ไม่ได้รับของภายใน 7 วัน' end
      || ' คืน ' || o.total_points::text || ' แต้มแล้ว',
    '/orders/' || o.id::text
  )
  from public.orders o
  where o.id = any (v_ids);

  return v_count;
end;
$$;


revoke execute on function public.release_orders(uuid[], text, uuid) from public, anon, authenticated;

create or replace view public.my_order_list with (security_invoker = true) as
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
            where oi.order_id = o.id), '') as item_names,
  o.order_no
from public.orders o
where o.student_id = (select auth.uid());

create or replace view public.staff_order_list with (security_invoker = true) as
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
  pr.display_name as buyer_display_name,
  o.order_no
from public.orders o
left join public.profiles pr on pr.id = o.student_id
where (select public.is_staff());
