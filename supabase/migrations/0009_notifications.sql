-- Green Campus: notifications, Realtime and the "new activity open" event (Task 10).
-- Spec 5 (notifications), 8.1 (read/mark own), 9.5 (events + Realtime by RLS). Rulings R43, R44, R47.
--
-- * Mark-as-read needs no SQL function: 0002 grants UPDATE (read_at) only, with an own-row RLS policy.
-- * Realtime: postgres_changes honours RLS, so a client only receives its own notifications.
-- * activities -> status 'open' notifies every student (one set-based insert).

-- Realtime publication (idempotent) ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- activity opened ---------------------------------------------------------------------------------
create or replace function public.notify_activity_opened()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- AFTER INSERT OR UPDATE OF status: becoming 'open' (insert with open, or any non-open -> open).
  if new.status = 'open' and (tg_op = 'INSERT' or old.status is distinct from 'open') then
    insert into public.notifications (user_id, type, title, body, link)
    select p.id, 'activity_opened', 'กิจกรรมใหม่เปิดรับแล้ว', new.title, '/activities/' || new.id::text
    from public.profiles p
    where p.role = 'student';
  end if;
  return null;
end;
$$;

revoke execute on function public.notify_activity_opened() from public, anon, authenticated;

create trigger activities_notify_opened
  after insert or update of status on public.activities
  for each row execute function public.notify_activity_opened();
