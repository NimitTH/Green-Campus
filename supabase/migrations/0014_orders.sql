-- Green Campus: checkout, orders and expiry (Task 13).
-- Spec 5.1 (ledger signs), 6.6 (all-or-nothing checkout, 7-day expiry), 7 (function table),
-- 8.1 (no client writes on orders/order_items/ledger_entries, 0002), 8.7, 9.5. Rulings R71-R76.
--
-- * checkout / complete_order / cancel_order / expire_orders are the only writers of orders,
--   order_items and the redeem/refund ledger rows. Business errors of complete/cancel RAISE with
--   the bare code as the message (the app maps it to Thai, src/lib/errors.ts); checkout returns
--   {ok, error_code, order_id, blocked} so the cart can show every blocked line at once.
-- * Lock order, the same in every function (no deadlocks):
--     checkout:          profiles row of the caller -> rewards (+ cart lines) by reward id
--     cancel_order:      the order -> its rewards by id
--     expire_orders:     every due order (SKIP LOCKED, never waits) -> all their rewards by id
--   No function locks a profile after a reward, or an order after a reward.
--   cancel/expire never lock a profile, but their ledger_entries / notifications inserts check
--   the FK to profiles, which takes FOR KEY SHARE on the student's row. checkout therefore locks
--   the profile FOR NO KEY UPDATE: it still serialises two checkouts of one student, but does not
--   conflict with KEY SHARE. (FOR UPDATE would: a cancel holding reward R and waiting on the
--   profile, against a checkout holding the profile and waiting on R, is a 40P01 deadlock.)
-- * The balance is summed from ledger_entries after the profile lock (not student_balance: that
--   view filters role = 'student' and runs as the invoker). Two checkouts of one student queue on
--   the profile lock, so the second sees the first's redeem row and its emptied cart.
-- * One redeem and at most one refund per order, enforced by partial unique indexes.
-- * order_items.reward_name: the reward name at order time (like unit_cost), so order history and
--   receipts stay right after a reward is renamed or deactivated (students cannot read inactive
--   rewards through RLS).
-- * pg_cron runs expire_orders() every hour (stops while a free project is paused, spec 8.7).

create extension if not exists pg_cron;

alter table public.order_items add column reward_name text not null;

create unique index ledger_entries_one_redeem_per_order
  on public.ledger_entries (ref_order_id)
  where kind = 'redeem';
create unique index ledger_entries_one_refund_per_order
  on public.ledger_entries (ref_order_id)
  where kind = 'refund';

-- checkout (R71) ------------------------------------------------------------------------------
-- Errors (raised): not_authenticated / not_student (42501).
-- Results:
--   {ok:false, error_code:'cart_empty', order_id:null, blocked:[]}
--   {ok:false, error_code:'blocked', order_id:null, blocked:[...]}: nothing changes. Items, in
--     reward id order: {reward_id, reason:'inactive'} | {reward_id, reason:'stock', available};
--     then {reward_id:null, reason:'points', shortfall} when the cost of the redeemable (active)
--     lines is above the balance.
--   {ok:true, error_code:null, order_id, blocked:[]}
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

  return jsonb_build_object('ok', true, 'error_code', null, 'order_id', v_order_id, 'blocked', '[]'::jsonb);
end;
$$;

revoke execute on function public.checkout() from public, anon;
grant execute on function public.checkout() to authenticated, service_role;

-- complete_order (R73) ------------------------------------------------------------------------
-- Errors: not_authenticated / not_staff (42501), order_not_found, order_not_pending, order_expired.
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
    'ออเดอร์ ' || upper(left(v_order.id::text, 8)) || ' รับของเรียบร้อยแล้ว',
    '/orders/' || v_order.id::text
  );
end;
$$;

revoke execute on function public.complete_order(uuid) from public, anon;
grant execute on function public.complete_order(uuid) to authenticated, service_role;

-- release_orders (internal, R75) -----------------------------------------------------------------
-- The shared restore + refund of cancel_order and expire_orders. The caller has already locked the
-- orders FOR UPDATE and checked they are pending_pickup. Locks their rewards in id order, puts the
-- stock back, writes one refund row per order (+total_points, carbon 0; the unique index refuses a
-- second one), sets the status and notifies each student. Returns the number of orders.
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
    'ออเดอร์ ' || upper(left(o.id::text, 8))
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

-- cancel_order (R74) --------------------------------------------------------------------------
-- Errors: not_authenticated / not_staff (42501), order_not_found, order_not_pending (also a
-- second cancel, which adds nothing).
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'not_staff' using errcode = '42501';
  end if;

  select o.status into v_status from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_status <> 'pending_pickup' then
    raise exception 'order_not_pending';
  end if;

  perform public.release_orders(array[p_order_id], 'cancelled', v_uid);
end;
$$;

revoke execute on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated, service_role;

-- expire_orders (R75) -------------------------------------------------------------------------
-- pg_cron / internal / service_role calls run without a user (auth.uid() null and a JWT role that
-- is not 'authenticated'); every other caller must be an admin (the staff button), including an
-- 'authenticated' JWT without a sub. anon has no EXECUTE, so it never reaches the no-user branch.
-- Due orders a concurrent cancel/complete holds are skipped (the next run sees their new state).
-- Idempotent: a second run finds nothing pending and due, returns 0 and refunds nothing.
create or replace function public.expire_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
begin
  if (v_uid is not null or coalesce(auth.role(), '') = 'authenticated') and not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select coalesce(array_agg(d.id), '{}') into v_ids
  from (
    select o.id
    from public.orders o
    where o.status = 'pending_pickup' and o.expires_at <= now()
    order by o.id
    for update skip locked
  ) d;

  if cardinality(v_ids) = 0 then
    return 0;
  end if;
  return public.release_orders(v_ids, 'expired', v_uid);
end;
$$;

revoke execute on function public.expire_orders() from public, anon;
grant execute on function public.expire_orders() to authenticated, service_role;

-- pg_cron (R76): every hour on the hour; re-running the migration keeps a single job.
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'expire-orders';
select cron.schedule('expire-orders', '0 * * * *', 'select public.expire_orders()');
