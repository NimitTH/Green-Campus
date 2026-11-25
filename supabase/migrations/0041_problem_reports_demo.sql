-- Round 6 final review (I2): the shared demo admin login (profiles.is_demo) follows the 0036 demo_scope rule for
-- problem reports too: it is not notified of real reports, cannot read them, and cannot close one (which would also
-- notify a real student). submit / resolve are the 0039 bodies with those two changes.

drop policy problem_reports_select on public.problem_reports;
create policy problem_reports_select on public.problem_reports
  for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or ((select public.is_admin())
        and not coalesce((select p.is_demo from public.profiles p where p.id = (select auth.uid())), false))
  );

create or replace function public.submit_problem_report(p_message text, p_page_url text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles;
  v_message text := btrim(coalesce(p_message, ''), E' \t\r\n');
  v_url text := nullif(btrim(coalesce(p_page_url, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_me from public.profiles where id = v_uid;
  if not found then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_me.is_demo then
    raise exception 'demo_scope';
  end if;
  if char_length(v_message) not between 1 and 1000
     or (v_url is not null and (char_length(v_url) > 300 or v_url !~ '^/([^/\\]|$)' or v_url ~ '[[:cntrl:][:space:]\\]')) then
    raise exception 'invalid_input';
  end if;
  -- one report at a time per user, so two parallel submits cannot both pass the limit
  perform pg_advisory_xact_lock(hashtextextended('problem_reports:' || v_uid::text, 0));
  if (select count(*) from public.problem_reports
      where reporter_id = v_uid and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'too_many_reports';
  end if;

  insert into public.problem_reports (reporter_id, reporter_name, message, page_url)
  values (v_uid, v_me.full_name, v_message, v_url)
  returning id into v_id;

  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'problem_report', 'มีการแจ้งปัญหาการใช้งาน', left(v_message, 120), '/staff/problem-reports'
  from public.profiles p
  where p.role = 'admin' and not p.is_demo;

  return v_id;
end
$$;


create or replace function public.resolve_problem_report(p_id uuid, p_note text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, ''), E' \t\r\n'), '');
  v_report public.problem_reports;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'invalid_input';
  end if;
  select * into v_report from public.problem_reports where id = p_id for update;
  if not found then
    raise exception 'report_not_found';
  end if;
  -- a demo admin acts on demo users only (0036): no real report is closed and no real user notified from it
  if (select p.is_demo from public.profiles p where p.id = v_uid)
     and not coalesce((select p.is_demo from public.profiles p where p.id = v_report.reporter_id), false) then
    raise exception 'demo_scope';
  end if;
  if v_report.status = 'done' then
    return false;
  end if;

  update public.problem_reports
  set status = 'done', admin_note = v_note, resolved_by = v_uid, resolved_at = now()
  where id = p_id;

  if v_report.reporter_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (v_report.reporter_id, 'problem_resolved', 'ปัญหาที่แจ้งได้รับการแก้ไขแล้ว', v_note, null);
  end if;
  return true;
end
$$;

