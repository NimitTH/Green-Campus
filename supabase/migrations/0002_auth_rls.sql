-- Green Campus: auth, roles and Row Level Security (spec 8.1-8.3).
--
-- Layers that stop privilege escalation on profiles (spec 8.2):
--   1. Column privileges: signed-in users may UPDATE only profiles.full_name and
--      profiles.display_name (table-level UPDATE is revoked, then granted per column).
--   2. RLS: a user may update only their own row.
--   3. Trigger protect_profile_columns: rejects any change to role/is_demo made by a
--      signed-in user through the API, even if someone later grants the columns.
--      See the function comment for how admin functions get through.
--
-- Tables written only through SECURITY DEFINER functions (spec 7, 8.1):
--   participations, weigh_codes, submissions, submission_items, orders, order_items,
--   ledger_entries. They get SELECT policies only, and INSERT/UPDATE/DELETE privileges
--   are revoked from anon and authenticated.

-- Role helpers -------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('teacher', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- New user -> profile ------------------------------------------------------
-- Every sign-up becomes a student; any "role" in the signup metadata is ignored.
-- full_name is NOT NULL: metadata full_name, else the email's local part, else the
-- email, else a fixed placeholder (phone-only sign-ups).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    nullif(new.email, ''),
    'ผู้ใช้ใหม่'
  );

  insert into public.profiles (id, role, full_name, display_name)
  values (new.id, 'student', v_full_name, v_full_name);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Protect role / is_demo ---------------------------------------------------
-- A change to role or is_demo is allowed only when:
--   * auth.uid() is null: no end-user JWT (migrations, seed, SQL editor, service
--     context), or
--   * current_user is not anon/authenticated: the UPDATE runs inside a SECURITY
--     DEFINER function owned by postgres (e.g. set_user_role, Task 18). Such a function
--     must check is_admin() itself and apply its own rules (last admin, is_demo).
-- A signed-in user updating profiles through the API runs as role "authenticated"
-- with a uid, so the change is rejected (42501).
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.is_demo is distinct from old.is_demo)
     and auth.uid() is not null
     and current_user in ('anon', 'authenticated') then
    raise exception 'role and is_demo can only be changed by an admin function'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_profile_columns() from public, anon, authenticated;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Privileges ---------------------------------------------------------------
-- TRUNCATE bypasses RLS: never allow it from the API roles.
revoke truncate on all tables in schema public from anon, authenticated;

-- profiles: only full_name / display_name are writable by users.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, display_name) on public.profiles to authenticated;

-- notifications: users may only set read_at.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- function-only tables.
revoke insert, update, delete on
  public.participations, public.weigh_codes, public.submissions, public.submission_items,
  public.orders, public.order_items, public.ledger_entries
  from anon, authenticated;

-- Policies -----------------------------------------------------------------
-- (select auth.uid()) / (select public.is_staff()) are evaluated once per statement.

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- waste_categories: everyone signed in reads; admin edits.
create policy waste_categories_select on public.waste_categories
  for select to authenticated
  using (true);
create policy waste_categories_insert on public.waste_categories
  for insert to authenticated
  with check ((select public.is_admin()));
create policy waste_categories_update on public.waste_categories
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy waste_categories_delete on public.waste_categories
  for delete to authenticated
  using ((select public.is_admin()));

-- activities: students read non-draft; staff create/edit; admin deletes
-- (activities with participations/submissions are protected by FK RESTRICT).
create policy activities_select on public.activities
  for select to authenticated
  using (status in ('open', 'closed') or (select public.is_staff()));
create policy activities_insert on public.activities
  for insert to authenticated
  with check ((select public.is_staff()));
create policy activities_update on public.activities
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
create policy activities_delete on public.activities
  for delete to authenticated
  using ((select public.is_admin()));

-- rewards: students read active; staff create/edit; admin deletes.
create policy rewards_select on public.rewards
  for select to authenticated
  using (active or (select public.is_staff()));
create policy rewards_insert on public.rewards
  for insert to authenticated
  with check ((select public.is_staff()));
create policy rewards_update on public.rewards
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
create policy rewards_delete on public.rewards
  for delete to authenticated
  using ((select public.is_admin()));

-- articles: published ones are public (/articles, spec 9.1); staff create/edit; admin deletes.
create policy articles_select_public on public.articles
  for select to anon
  using (published);
create policy articles_select on public.articles
  for select to authenticated
  using (published or (select public.is_staff()));
create policy articles_insert on public.articles
  for insert to authenticated
  with check ((select public.is_staff()));
create policy articles_update on public.articles
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
create policy articles_delete on public.articles
  for delete to authenticated
  using ((select public.is_admin()));

-- cart_items: owner manages own rows; staff read all.
create policy cart_items_select on public.cart_items
  for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));
create policy cart_items_insert_own on public.cart_items
  for insert to authenticated
  with check (student_id = (select auth.uid()));
create policy cart_items_update_own on public.cart_items
  for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));
create policy cart_items_delete_own on public.cart_items
  for delete to authenticated
  using (student_id = (select auth.uid()));

-- function-only tables: read own (students) or all (staff), no write policies.
create policy participations_select on public.participations
  for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));
create policy weigh_codes_select on public.weigh_codes
  for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));
create policy submissions_select on public.submissions
  for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));
create policy submission_items_select on public.submission_items
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.submissions s
      where s.id = submission_items.submission_id
        and s.student_id = (select auth.uid())
    )
  );
create policy orders_select on public.orders
  for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));
create policy order_items_select on public.order_items
  for select to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.student_id = (select auth.uid())
    )
  );
create policy ledger_entries_select on public.ledger_entries
  for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_staff()));

-- notifications: own rows only, for every role; update limited to read_at by grant.
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
