-- Round 6 (old-site features 5): website problem reports. Any signed-in user reports a problem with the website;
-- every admin is notified; an admin marks it done and the reporter is notified back.
-- * no direct writes: submit_problem_report / resolve_problem_report (security definer) are the only writers;
-- * admins read every report, a reporter reads their own;
-- * at most 5 reports per user per 24 hours (too_many_reports); demo accounts are refused (demo_scope) so a demo
--   session never notifies the real admins; suspended students may still report (it may be their only channel).
-- Errors: not_authenticated (42501), invalid_input, too_many_reports, demo_scope, not_admin, report_not_found (P0001).

create table public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reporter_name text not null,
  message text not null check (char_length(btrim(message, E' \t\r\n')) between 1 and 1000),
  page_url text check (
    page_url is null
    or (char_length(page_url) <= 300 and page_url ~ '^/([^/\\]|$)' and page_url !~ '[[:cntrl:][:space:]\\]')
  ),
  status text not null default 'open' check (status in ('open', 'done')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index problem_reports_reporter_created_idx on public.problem_reports (reporter_id, created_at);
create index problem_reports_status_created_idx on public.problem_reports (status, created_at desc);

alter table public.problem_reports enable row level security;
revoke all on public.problem_reports from public, anon, authenticated;
grant select on public.problem_reports to authenticated;

create policy problem_reports_select on public.problem_reports
  for select to authenticated
  using ((select public.is_admin()) or reporter_id = (select auth.uid()));

create function public.submit_problem_report(p_message text, p_page_url text)
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
  where p.role = 'admin';

  return v_id;
end
$$;

-- Returns true when this call marked the report done, false when it already was (no second notification).
create function public.resolve_problem_report(p_id uuid, p_note text)
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

revoke execute on function public.submit_problem_report(text, text) from public, anon;
grant execute on function public.submit_problem_report(text, text) to authenticated;
revoke execute on function public.resolve_problem_report(uuid, text) from public, anon;
grant execute on function public.resolve_problem_report(uuid, text) to authenticated;
