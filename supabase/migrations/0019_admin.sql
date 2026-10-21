-- Green Campus: admin tools (Task 18 Part A, R113-R116). Builds on 0001-0018 (only the 0016 lock-order
-- header comment is extended with the two functions below).
--
-- Lock order (canonical list: 0016 header)
--   set_user_role (0019): pg_advisory_xact_lock(hashtext('public.set_user_role')) -> the target profile
--                         (the role UPDATE's own row lock, NO KEY UPDATE) -> notifications insert.
--                         It never locks profiles FOR UPDATE.
--   adjust_ledger (0019): the student's profile FOR NO KEY UPDATE (the 0016 RULE) -> ledger_entries /
--                         notifications inserts. No reward or order is touched.
--
-- * R113 set_user_role(p_user, p_role): admin only. Every call is serialised on one advisory lock so two
--   admins demoting each other cannot both pass the last-admin check. Rules: never leave zero non-demo
--   admins (self-demotion included); a demo caller (is_demo, spec 8.3) may not change a non-demo admin
--   and may not grant 'admin'; a same-role call is a no-op. is_demo is seed-only: no function writes it.
--   Definer functions owned by postgres pass protect_profile_columns (0002), so the rules live here.
-- * R114 adjust_ledger(p_student, p_points, p_carbon_kg, p_note): admin only (demo admins too: accepted
--   risk of spec 8.3, demo data is resettable). Points and accumulated carbon never go below zero (R100).
-- * R115 waste_categories: code is immutable (trigger, every caller); INSERT/DELETE revoked from the API
--   roles, so admins only edit name / rates / source_note through the 0002 UPDATE policy. The 0002
--   insert/delete policies stay but are harmless without the table privilege.
-- * R116 profiles: full_name 1-100 characters (trimmed), display_name null or <= 50. handle_new_user
--   clips sign-up names to these limits so a long name or e-mail never blocks a sign-up.

-- R116: profile name limits ------------------------------------------------------------------------
-- Existing rows first (rows from before these limits), then the checks.
update public.profiles set full_name = 'ไม่ระบุชื่อ' where btrim(full_name) = '';
update public.profiles set full_name = left(full_name, 100) where char_length(full_name) > 100;
update public.profiles set display_name = left(display_name, 50) where char_length(display_name) > 50;

alter table public.profiles
  add constraint profiles_full_name_length check (char_length(btrim(full_name)) between 1 and 100),
  add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 50);

-- 0002 body with the names clipped to the limits above.
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
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    nullif(new.email, ''),
    'ผู้ใช้ใหม่'
  ), 100);

  insert into public.profiles (id, role, full_name, display_name)
  values (new.id, 'student', v_full_name, left(v_full_name, 50));

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- R115: waste_categories hardening -------------------------------------------------------------------
alter table public.waste_categories
  add constraint waste_categories_name_not_blank check (btrim(name) <> '');
-- points_per_kg >= 0 and carbon_kg_per_kg >= 0 already exist (0001).

revoke insert, delete on public.waste_categories from anon, authenticated;

create or replace function public.prevent_category_code_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'category_code_immutable';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_category_code_change() from public, anon, authenticated;

create trigger waste_categories_code_immutable
  before update on public.waste_categories
  for each row execute function public.prevent_category_code_change();

-- R113: set_user_role ----------------------------------------------------------------------------------
-- Errors:
--   not_authenticated (42501)  no signed-in user
--   not_admin         (42501)  caller is not an admin
--   invalid_role               p_role is not student / teacher / admin
--   user_not_found             no profile with this id
--   demo_forbidden             a demo admin targeting a non-demo admin, or granting 'admin'
--   last_admin                 the change would leave zero non-demo admins
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

  -- One role change at a time (both last-admin checks see each other's result). The caller's own role
  -- is read after the lock, so an admin demoted a moment ago cannot act on a stale role.
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

-- R114: adjust_ledger ----------------------------------------------------------------------------------
-- Errors:
--   not_authenticated (42501)  no signed-in user
--   not_admin         (42501)  caller is not an admin
--   invalid_adjust             null points / carbon, or carbon outside numeric(12,3)
--   note_required              blank note;  note_too_long  more than 500 characters (trimmed)
--   empty_adjust               0 points and 0.000 kg
--   not_student_target         no profile with this id, or it is not a student
--   insufficient_balance       the points balance would go below 0 (R100)
--   insufficient_carbon        the accumulated carbon (earn + adjust, spec 5.1) would go below 0
create or replace function public.adjust_ledger(p_student uuid, p_points int, p_carbon_kg numeric, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  -- all whitespace, like the app's String.trim (btrim alone keeps newlines/tabs; 0008 precedent)
  v_note text := regexp_replace(p_note, '^\s+|\s+$', '', 'g');
  v_carbon numeric(12, 3);
  v_role text;
  v_balance bigint;
  v_total_carbon numeric;
  v_parts text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'admin') then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  if p_points is null or p_carbon_kg is null or abs(round(p_carbon_kg, 3)) >= 1000000000 then
    raise exception 'invalid_adjust';
  end if;
  v_carbon := round(p_carbon_kg, 3);
  if v_note is null or v_note = '' then
    raise exception 'note_required';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'note_too_long';
  end if;
  if p_points = 0 and v_carbon = 0 then
    raise exception 'empty_adjust';
  end if;

  -- 0016 RULE: the student's profile FOR NO KEY UPDATE first (serialises with checkout of the same
  -- student, compatible with the KEY SHARE that ledger / notification inserts take).
  select p.role into v_role from public.profiles p where p.id = p_student for no key update;
  if v_role is distinct from 'student' then
    raise exception 'not_student_target';
  end if;

  select coalesce(sum(l.points), 0),
         coalesce(sum(l.carbon_kg) filter (where l.kind in ('earn', 'adjust')), 0)
    into v_balance, v_total_carbon
  from public.ledger_entries l
  where l.student_id = p_student;

  if v_balance + p_points < 0 then
    raise exception 'insufficient_balance';
  end if;
  if v_total_carbon + v_carbon < 0 then
    raise exception 'insufficient_carbon';
  end if;

  insert into public.ledger_entries (student_id, kind, points, carbon_kg, note, created_by)
  values (p_student, 'adjust', p_points, v_carbon, v_note, v_uid);

  if p_points <> 0 then
    v_parts := v_parts || (case when p_points > 0 then '+' else '' end || p_points::text || ' แต้ม');
  end if;
  if v_carbon <> 0 then
    v_parts := v_parts || ('carbon ' || case when v_carbon > 0 then '+' else '' end
                           || trim_scale(v_carbon)::text || ' กก. CO2e');
  end if;
  perform public.notify(
    p_student,
    'ledger_adjusted',
    'มีการปรับแต้ม',
    array_to_string(v_parts, ', ') || ' เหตุผล: ' || v_note,
    '/dashboard'
  );
end;
$$;

revoke execute on function public.adjust_ledger(uuid, int, numeric, text) from public, anon;
grant execute on function public.adjust_ledger(uuid, int, numeric, text) to authenticated;
