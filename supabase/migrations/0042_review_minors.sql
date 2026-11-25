-- Round 6 final review minors.
-- M3: a stored page link has no "." or ".." path segment ("/.//host" normalises to "//host"); the table check and
--     submit_problem_report (the 0041 body plus that test) both refuse one.
-- M6: orders.order_no is set by a security-definer BEFORE INSERT trigger instead of a column default, so a role
--     that may insert orders never needs EXECUTE on next_order_no.

alter table public.problem_reports drop constraint problem_reports_page_url_check;
alter table public.problem_reports add constraint problem_reports_page_url_check check (
  page_url is null
  or (char_length(page_url) <= 300 and page_url ~ '^/([^/\\]|$)' and page_url !~ '[[:cntrl:][:space:]\\]'
      and split_part(split_part(page_url, '?', 1), '#', 1) !~ '/\.\.?(/|$)')
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
     or (v_url is not null and (char_length(v_url) > 300 or v_url !~ '^/([^/\\]|$)' or v_url ~ '[[:cntrl:][:space:]\\]'
                                or split_part(split_part(v_url, '?', 1), '#', 1) ~ '/\.\.?(/|$)')) then
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


alter table public.orders alter column order_no drop default;

create function public.set_order_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_no is null then
    new.order_no := public.next_order_no(now());
  end if;
  return new;
end
$$;

revoke execute on function public.set_order_no() from public, anon, authenticated;

create trigger orders_set_order_no
  before insert on public.orders
  for each row execute function public.set_order_no();
