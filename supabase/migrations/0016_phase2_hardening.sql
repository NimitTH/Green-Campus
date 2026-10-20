-- Green Campus: phase 2 review hardening (R91-R93 and minors). Builds on 0001-0015 (not edited).
--
-- Canonical lock order of every SECURITY DEFINER function, 0006-0016 --------------------------------
-- Each function takes its row locks in the order below and never goes back up the list, so two
-- of them can wait on each other only in the documented, detected cases (no silent deadlocks).
--   issue_weigh_code (0006):        participations (student, activity) FOR NO KEY UPDATE -> weigh_codes
--   submit_result (0007/0012):      fixed: participations FOR NO KEY UPDATE; code: weigh_codes
--                                   FOR UPDATE (participations -> weigh_codes, never the reverse)
--   approve/reject_submission (0008): the submission FOR UPDATE only
--   checkout (0014/0015/0016):      the caller's profile FOR NO KEY UPDATE -> rewards (+ cart lines)
--                                   by reward id FOR UPDATE
--   complete_order (0014):          the order FOR UPDATE only
--   cancel_order (0014):            the order FOR UPDATE -> its rewards by id (release_orders)
--   expire_orders (0014):           due orders FOR UPDATE SKIP LOCKED (never waits) -> their rewards
--                                   by id (release_orders)
--   mark_order_ready (0015):        the order FOR UPDATE only
--   restore_pending_stock_on_profile_delete (0016, BEFORE DELETE on profiles): the profile row
--                                   (locked by the DELETE itself) -> its pending orders by id
--                                   FOR UPDATE -> their rewards by id FOR UPDATE
-- Foreign keys: inserting a ledger_entries / notifications row takes FOR KEY SHARE on the
-- referenced profile. cancel/expire do this while holding rewards, so any function that locks a
-- profile and then rewards must use FOR NO KEY UPDATE (compatible with KEY SHARE), never FOR UPDATE.
-- RULE: any future function that touches a student's balance (e.g. adjust_ledger) must lock the
-- student's profile FOR NO KEY UPDATE first, never FOR UPDATE, and only then any reward/order.
-- The only exception is a profile DELETE (admin removing an account): it holds the strongest row
-- lock, so a cancel/expire of that student's order running at the same instant can deadlock with
-- it; Postgres detects that (40P01) and rolls one back, and nothing is restored or refunded twice.
--
-- Contents
-- * R93: deleting a profile (usually via auth.users cascade) puts the stock of the student's
--   pending_pickup orders back. No refund: the ledger rows cascade away with the profile.
-- * cart_items.qty <= 99 in the database too (the app already limits it, MAX_CART_QTY).
-- * profile_display_name(uuid): display_name, else full_name, else 'ไม่ระบุชื่อ' (blank and
--   whitespace-only names count as missing). For leaderboards (phase 3).
-- * checkout: the 0015 body, with the order_new link /staff/orders?q=<order number> and btrim in
--   the display-name fallback (as 0007/0012). Nothing else changes.

-- R93: restore stock of pending orders when a profile is deleted --------------------------------
create or replace function public.restore_pending_stock_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  -- the student's pending orders, locked in id order (a concurrent cancel/expire either finished
  -- before, so the order is no longer pending, or waits / is skipped)
  select coalesce(array_agg(d.id), '{}') into v_ids
  from (
    select o.id
    from public.orders o
    where o.student_id = old.id and o.status = 'pending_pickup'
    order by o.id
    for update
  ) d;

  if cardinality(v_ids) > 0 then
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
  end if;

  return old;
end;
$$;

revoke execute on function public.restore_pending_stock_on_profile_delete() from public, anon, authenticated, service_role;

create trigger profiles_restore_pending_stock
  before delete on public.profiles
  for each row execute function public.restore_pending_stock_on_profile_delete();

-- cart quantity limit ------------------------------------------------------------------------------
alter table public.cart_items add constraint cart_items_qty_max check (qty <= 99);

-- profile_display_name ---------------------------------------------------------------------------
-- null for an unknown id. Exposes only the name (granted to authenticated for leaderboards).
create or replace function public.profile_display_name(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.full_name), ''), 'ไม่ระบุชื่อ')
  from public.profiles p
  where p.id = p_id
$$;

revoke execute on function public.profile_display_name(uuid) from public, anon;
grant execute on function public.profile_display_name(uuid) to authenticated, service_role;

-- checkout (R71, R83): 0015 body; order_new links to the order on /staff/orders ---------------------
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
    (select coalesce(nullif(btrim(p.display_name), ''), p.full_name) from public.profiles p where p.id = v_uid)
      || ' ' || v_pieces::text || ' ชิ้น รวม ' || v_total::text || ' แต้ม',
    '/staff/orders?q=' || upper(left(v_order_id::text, 8))
  );

  return jsonb_build_object('ok', true, 'error_code', null, 'order_id', v_order_id, 'blocked', '[]'::jsonb);
end;
$$;

revoke execute on function public.checkout() from public, anon;
grant execute on function public.checkout() to authenticated, service_role;
