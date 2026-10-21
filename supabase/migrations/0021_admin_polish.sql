-- Green Campus: Part A polish (Task 18 Part B, R126). 0019 is not edited; the functions below are
-- re-created with `create or replace` and keep their signatures and grants.
--
-- * Whitespace-aware names. btrim() only strips spaces, so a full_name of tabs or newlines passed the
--   0019 check and a newline-only display_name hid the full_name fallback. Every name rule now trims
--   all whitespace with regexp_replace(x, '^\s+|\s+$', '', 'g') (the 0019 adjust_ledger note rule):
--   the profiles full_name check (same constraint name), handle_new_user, profile_display_name.
--   Existing rows are repaired first.
-- * set_user_role: a cheap is_admin() pre-check before the advisory lock, so a non-admin never queues
--   on it; the role is still re-checked after the lock (a just-demoted admin cannot act on a stale role).
-- * anon loses UPDATE on waste_categories (RLS already denied it; defence in depth, like INSERT/DELETE
--   in 0019).

-- profiles: repair, then the whitespace-aware check -------------------------------------------------
update public.profiles
set full_name = 'ไม่ระบุชื่อ'
where regexp_replace(full_name, '^\s+|\s+$', '', 'g') = '';
update public.profiles
set full_name = left(regexp_replace(full_name, '^\s+|\s+$', '', 'g'), 100)
where char_length(regexp_replace(full_name, '^\s+|\s+$', '', 'g')) > 100;
update public.profiles
set display_name = null
where display_name is not null and regexp_replace(display_name, '^\s+|\s+$', '', 'g') = '';

alter table public.profiles drop constraint profiles_full_name_length;
alter table public.profiles
  add constraint profiles_full_name_length
    check (char_length(regexp_replace(full_name, '^\s+|\s+$', '', 'g')) between 1 and 100);

-- handle_new_user: the 0019 body, trimming all whitespace -------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
begin
  v_full_name := left(coalesce(
    nullif(regexp_replace(new.raw_user_meta_data ->> 'full_name', '^\s+|\s+$', '', 'g'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    nullif(new.email, ''),
    'ผู้ใช้ใหม่'
  ), 100);
  -- clipping can leave trailing whitespace (e.g. a space at position 100); trim again
  v_full_name := coalesce(nullif(regexp_replace(v_full_name, '^\s+|\s+$', '', 'g'), ''), 'ผู้ใช้ใหม่');

  insert into public.profiles (id, role, full_name, display_name)
  values (new.id, 'student', v_full_name, left(v_full_name, 50));

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- profile_display_name: display_name, else full_name, else 'ไม่ระบุชื่อ' (all whitespace trimmed) ----
create or replace function public.profile_display_name(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(regexp_replace(p.display_name, '^\s+|\s+$', '', 'g'), ''),
    nullif(regexp_replace(p.full_name, '^\s+|\s+$', '', 'g'), ''),
    'ไม่ระบุชื่อ'
  )
  from public.profiles p
  where p.id = p_id
$$;

-- grants as left by 0017 (R99): service_role only
revoke execute on function public.profile_display_name(uuid) from public, anon, authenticated;
grant execute on function public.profile_display_name(uuid) to service_role;

-- set_user_role: the 0019 body with a pre-check before the lock --------------------------------------
create or replace function public.set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_caller public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_role_th text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  -- cheap pre-check: a non-admin never waits on the lock below
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  -- One role change at a time (both last-admin checks see each other's result). The caller's own role
  -- is read again after the lock, so an admin demoted a moment ago cannot act on a stale role.
  perform pg_advisory_xact_lock(hashtext('public.set_user_role'));

  select * into v_caller from public.profiles p where p.id = v_uid;
  if not found or v_caller.role <> 'admin' then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('student', 'teacher', 'admin') then
    raise exception 'invalid_role';
  end if;

  select * into v_target from public.profiles p where p.id = p_user;
  if not found then
    raise exception 'user_not_found';
  end if;

  -- spec 8.3: a public demo login can neither touch real admins nor mint new admins
  if v_caller.is_demo and ((v_target.role = 'admin' and not v_target.is_demo) or p_role = 'admin') then
    raise exception 'demo_forbidden';
  end if;

  if v_target.role = p_role then
    return;
  end if;

  if v_target.role = 'admin' and not v_target.is_demo and not exists (
    select 1 from public.profiles p
    where p.role = 'admin' and not p.is_demo and p.id <> v_target.id
  ) then
    raise exception 'last_admin';
  end if;

  update public.profiles set role = p_role where id = v_target.id;

  v_role_th := case p_role when 'student' then 'นักเรียน' when 'teacher' then 'ครู' else 'ผู้ดูแลระบบ' end;
  perform public.notify(
    v_target.id,
    'role_changed',
    'บทบาทของคุณถูกเปลี่ยน',
    'บทบาทใหม่ของคุณคือ ' || v_role_th,
    case when p_role = 'student' then '/dashboard' else '/staff' end
  );
end;
$$;

revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- waste_categories: anon has no write privilege at all ------------------------------------------------
revoke update on public.waste_categories from anon;
