-- Green Campus: order "ready for pickup" step and staff notification on new orders.
-- Owner decision 2026-10-21; spec 5, 7, 9.3, 9.5; rulings R82, R83. Builds on 0014 (not edited).
--
-- * orders.ready_at (nullable timestamptz): staff set it once the reward has been prepared. The
--   status stays 'pending_pickup' (no new status value), so complete_order, cancel_order and
--   expire_orders (0014) work the same whether or not ready_at is set. Expiry stays 7 days from
--   creation; marking ready does not extend it.
-- * mark_order_ready(order_id) (staff only): locks the order FOR UPDATE, then order_not_found /
--   order_not_pending / order_expired / order_already_ready (raised, message = bare code), sets
--   ready_at and updated_at, and notifies the student ('order_ready', link /orders/<id>).
-- * checkout is redefined below with `create or replace`. It is the 0014 body, unchanged (lock
--   order: caller's profile FOR NO KEY UPDATE -> rewards/cart lines by reward id; reward_name
--   snapshot), plus one notify_staff('order_new', ...) call on success, in the same transaction.

alter table public.orders add column ready_at timestamptz;

-- checkout (R71, R83) -------------------------------------------------------------------------
-- Same errors and results as in 0014. On success every teacher/admin profile also gets one
-- 'order_new' notification (student display_name or full_name, pieces, total points) -> /staff/orders.
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
  insert into public.orders (student_id, total_points, expires_at)
  values (v_uid, v_total::integer, now() + interval '7 days')
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
    'ออเดอร์ ' || upper(left(v_order_id::text, 8)) || ' ' || v_pieces::text || ' ชิ้น รวม ' || v_total::text
      || ' แต้ม รับของได้ที่แผนกภายใน 7 วัน',
    '/orders/' || v_order_id::text
  );

  perform public.notify_staff(
    'order_new',
    'มีออเดอร์ใหม่',
    (select coalesce(nullif(p.display_name, ''), p.full_name) from public.profiles p where p.id = v_uid)
      || ' ' || v_pieces::text || ' ชิ้น รวม ' || v_total::text || ' แต้ม',
    '/staff/orders'
  );

  return jsonb_build_object('ok', true, 'error_code', null, 'order_id', v_order_id, 'blocked', '[]'::jsonb);
end;
$$;

revoke execute on function public.checkout() from public, anon;
grant execute on function public.checkout() to authenticated, service_role;

-- mark_order_ready (R82) ----------------------------------------------------------------------
-- Errors: not_authenticated / not_staff (42501), order_not_found, order_not_pending, order_expired,
-- order_already_ready. The deadline in the notification is the order's expires_at in Asia/Bangkok
-- (Buddhist year, like the app's Thai dates).
create or replace function public.mark_order_ready(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_local timestamp;
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
  if v_order.ready_at is not null then
    raise exception 'order_already_ready';
  end if;

  update public.orders
  set ready_at = now(), updated_at = now()
  where id = v_order.id;

  v_local := v_order.expires_at at time zone 'Asia/Bangkok';
  perform public.notify(
    v_order.student_id,
    'order_ready',
    'ของรางวัลพร้อมรับแล้ว',
    'รับได้ที่แผนกก่อน ' || to_char(v_local, 'DD/MM/') || (extract(year from v_local)::integer + 543)::text
      || to_char(v_local, ' HH24:MI') || ' น.',
    '/orders/' || v_order.id::text
  );
end;
$$;

revoke execute on function public.mark_order_ready(uuid) from public, anon;
grant execute on function public.mark_order_ready(uuid) to authenticated, service_role;
