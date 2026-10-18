-- Green Campus: submit results with photo evidence (Task 8).
-- Spec 6.1 (max_per_submission), 6.3 (submit window), 6.4 (weigh codes), 7.1 (submit_result),
-- 8.1 (RLS), 8.4 (evidence images), 9.5 (notifications).
--
-- * notify / notify_staff: internal helpers (no EXECUTE for API roles) that other SECURITY
--   DEFINER functions call to write notifications (Tasks 9/10/13 reuse them).
-- * Bucket 'evidence' (private, 2 MB, jpeg/png/webp). Object path {auth.uid()}/{uploadId}/{file}:
--   the client uploads first (spec 7.1 item 1), so uploadId is a client-generated uuid.
-- * submit_result is the only way to create submissions / submission_items (no client writes, 0002).

-- notifications helpers ---------------------------------------------------------------------
create or replace function public.notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
$$;

-- One notification per teacher/admin profile.
create or replace function public.notify_staff(
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, p_title, p_body, p_link
  from public.profiles p
  where p.role in ('teacher', 'admin');
$$;

revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_staff(text, text, text, text) from public, anon, authenticated;

-- evidence bucket and storage policies (R26) ------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Students upload only into their own folder. No UPDATE/DELETE for clients (cleanup of
-- orphaned files uses the service role through the Storage API, Task 19).
create policy evidence_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy evidence_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_staff())
    )
  );

-- One photo backs at most one submission (also closes the race between two concurrent submits).
create unique index submissions_evidence_path_key
  on public.submissions (evidence_path)
  where evidence_path is not null;

-- submit_result -----------------------------------------------------------------------------
-- Returns {ok, error_code, submission_id}. Every business error is RETURNED, not raised, so a
-- wrong-code attempt is committed (spec 7.1 item 4):
--   not_participant    unknown activity, or the caller has not joined it
--   out_of_window      draft, before starts_at, or after ends_at + 3 days (R18, same as issue_weigh_code)
--   invalid_items      p_items does not fit the activity type (R25), including malformed input
--   over_limit         waste: sum of grams > max_per_submission; trees: count > max_per_submission
--   bad_evidence_path  null, outside {auth.uid()}/, contains '..', no uploaded object, or the photo
--                      already backs another submission (one photo, one submission)
--   code_required      requires_code and no code given
--   code_invalid       no active code for the pair (none issued, revoked, already used) or a mismatch
--   code_expired       the active code has expired
--   code_locked        5 wrong attempts (even if this code is right)
-- Raised (42501): not_authenticated (no user), not_student (caller is not a student).
-- Order (R24): auth, participant, window, items, evidence, then the code LAST so bad input
-- never burns an attempt.
create or replace function public.submit_result(
  p_activity_id uuid,
  p_code text,
  p_items jsonb,
  p_evidence_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_name text;
  v_activity public.activities%rowtype;
  v_item jsonb;
  v_qty_text text;
  v_cat_text text;
  v_cat uuid;
  v_cats uuid[] := '{}';
  v_qtys integer[] := '{}';
  v_total bigint := 0;
  v_code text := btrim(coalesce(p_code, ''));
  v_code_row public.weigh_codes%rowtype;
  v_code_id uuid;
  v_submission_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select p.role, coalesce(nullif(btrim(p.display_name), ''), p.full_name)
    into v_role, v_name
  from public.profiles p
  where p.id = v_uid;
  if v_role is distinct from 'student' then
    raise exception 'not_student' using errcode = '42501';
  end if;

  select a.* into v_activity from public.activities a where a.id = p_activity_id;
  if not found or not exists (
    select 1 from public.participations p
    where p.activity_id = p_activity_id and p.student_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'error_code', 'not_participant', 'submission_id', null);
  end if;

  if v_activity.status = 'draft'
     or now() < v_activity.starts_at
     or now() > v_activity.ends_at + interval '3 days' then
    return jsonb_build_object('ok', false, 'error_code', 'out_of_window', 'submission_id', null);
  end if;

  -- items (R25) ------------------------------------------------------------------------------
  if v_activity.type = 'fixed' then
    if p_items is not null and p_items <> '[]'::jsonb then
      return jsonb_build_object('ok', false, 'error_code', 'invalid_items', 'submission_id', null);
    end if;
    -- spec 5.1: a fixed submission has one row, quantity = 1, no category
    v_cats := array[null::uuid];
    v_qtys := array[1];
  else
    -- separate IFs: the checks must not be evaluated out of order (jsonb_array_length on a non-array raises)
    if p_items is null or jsonb_typeof(p_items) <> 'array' then
      return jsonb_build_object('ok', false, 'error_code', 'invalid_items', 'submission_id', null);
    end if;
    if jsonb_array_length(p_items) = 0 or (v_activity.type = 'trees' and jsonb_array_length(p_items) <> 1) then
      return jsonb_build_object('ok', false, 'error_code', 'invalid_items', 'submission_id', null);
    end if;

    for v_item in select e from jsonb_array_elements(p_items) e loop
      if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'quantity') is distinct from 'number' then
        return jsonb_build_object('ok', false, 'error_code', 'invalid_items', 'submission_id', null);
      end if;
      -- a positive integer that fits an int column: digits only (no sign, fraction or exponent)
      v_qty_text := v_item ->> 'quantity';
      if v_qty_text !~ '^[1-9][0-9]{0,9}\Z' then
        return jsonb_build_object('ok', false, 'error_code', 'invalid_items', 'submission_id', null);
      end if;
      if v_qty_text::bigint > 2147483647 then
        return jsonb_build_object('ok', false, 'error_code', 'invalid_items', 'submission_id', null);
      end if;

      if v_activity.type = 'waste' then
        v_cat_text := case when jsonb_typeof(v_item -> 'waste_category_id') = 'string'
                           then v_item ->> 'waste_category_id' end;
        if coalesce(v_cat_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\Z', true) then
          return jsonb_build_object('ok', false, 'error_code', 'invalid_items', 'submission_id', null);
        end if;
        v_cat := v_cat_text::uuid;
        if v_cat = any (v_cats)
           or not exists (select 1 from public.waste_categories wc where wc.id = v_cat) then
          return jsonb_build_object('ok', false, 'error_code', 'invalid_items', 'submission_id', null);
        end if;
      else
        if v_item ? 'waste_category_id' and jsonb_typeof(v_item -> 'waste_category_id') <> 'null' then
          return jsonb_build_object('ok', false, 'error_code', 'invalid_items', 'submission_id', null);
        end if;
        v_cat := null;
      end if;

      v_cats := v_cats || v_cat;
      v_qtys := v_qtys || v_qty_text::integer;
      v_total := v_total + v_qty_text::bigint;
    end loop;

    if v_activity.max_per_submission is not null and v_total > v_activity.max_per_submission then
      return jsonb_build_object('ok', false, 'error_code', 'over_limit', 'submission_id', null);
    end if;
  end if;

  -- evidence (R26) ---------------------------------------------------------------------------
  if p_evidence_path is null
     or left(p_evidence_path, length(v_uid::text) + 1) <> v_uid::text || '/'
     or position('..' in p_evidence_path) > 0
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'evidence' and o.name = p_evidence_path
     )
     or exists (select 1 from public.submissions s where s.evidence_path = p_evidence_path) then
    return jsonb_build_object('ok', false, 'error_code', 'bad_evidence_path', 'submission_id', null);
  end if;

  -- weigh code (R27), last -------------------------------------------------------------------
  if v_activity.requires_code then
    if v_code = '' then
      return jsonb_build_object('ok', false, 'error_code', 'code_required', 'submission_id', null);
    end if;

    -- FOR UPDATE: a concurrent submit with the same code waits here, then re-reads the row,
    -- sees used_at set, finds no active row and returns code_invalid (one submission only).
    select wc.* into v_code_row
    from public.weigh_codes wc
    where wc.activity_id = p_activity_id
      and wc.student_id = v_uid
      and wc.used_at is null
      and wc.revoked_at is null
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'error_code', 'code_invalid', 'submission_id', null);
    end if;
    if v_code_row.attempts >= 5 then
      return jsonb_build_object('ok', false, 'error_code', 'code_locked', 'submission_id', null);
    end if;
    if v_code_row.expires_at <= now() then
      return jsonb_build_object('ok', false, 'error_code', 'code_expired', 'submission_id', null);
    end if;
    if v_code_row.code <> v_code then
      update public.weigh_codes
      set attempts = attempts + 1, updated_at = now()
      where id = v_code_row.id;
      return jsonb_build_object(
        'ok', false,
        'error_code', case when v_code_row.attempts + 1 >= 5 then 'code_locked' else 'code_invalid' end,
        'submission_id', null);
    end if;

    v_code_id := v_code_row.id;
  end if;

  -- success ----------------------------------------------------------------------------------
  -- Two concurrent submits with the same photo both pass the exists() check above; the unique
  -- index then rejects the second. The block's rollback also undoes its used_at update.
  begin
    if v_code_id is not null then
      update public.weigh_codes
      set used_at = now(), updated_at = now()
      where id = v_code_id;
    end if;

    insert into public.submissions (activity_id, student_id, code_id, evidence_path, status)
    values (p_activity_id, v_uid, v_code_id, p_evidence_path, 'pending')
    returning id into v_submission_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error_code', 'bad_evidence_path', 'submission_id', null);
  end;

  insert into public.submission_items (submission_id, waste_category_id, quantity)
  select v_submission_id, c.cat, c.qty
  from unnest(v_cats, v_qtys) as c (cat, qty);

  perform public.notify_staff(
    'submission_new',
    'มีผลส่งใหม่รอตรวจ',
    v_name || ' ส่งผลกิจกรรม "' || v_activity.title || '"',
    '/staff/reviews/' || v_submission_id::text
  );

  return jsonb_build_object('ok', true, 'error_code', null, 'submission_id', v_submission_id);
end;
$$;

revoke execute on function public.submit_result(uuid, text, jsonb, text) from public, anon;
grant execute on function public.submit_result(uuid, text, jsonb, text) to authenticated, service_role;
