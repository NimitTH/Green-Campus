-- Redesign 4 (DESIGN-4 7.1): students/staff may delete their own notifications; students keep the newest 100.
-- notifications stays in the supabase_realtime publication (unchanged).

grant delete on public.notifications to authenticated;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

create index notifications_user_created_idx on public.notifications (user_id, created_at desc, id desc);

create or replace function public.notifications_cap_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'student') then
    delete from public.notifications n
    where n.id in (
      select x.id from public.notifications x
      where x.user_id = new.user_id
      order by x.created_at desc, x.id desc
      offset 100
    );
  end if;
  return null;
end;
$$;
revoke execute on function public.notifications_cap_fn() from public, anon, authenticated;

create trigger notifications_cap
  after insert on public.notifications
  for each row execute function public.notifications_cap_fn();

-- Lock order (0016): this function only READS the recipient's profile (no FOR UPDATE / NO KEY UPDATE), so it takes
-- no profile lock; it deletes only notifications rows of that recipient. It cannot join the 0016 lock cycle.

-- One-time trim of existing students' notifications beyond the newest 100.
delete from public.notifications n
using (
  select x.id, row_number() over (partition by x.user_id order by x.created_at desc, x.id desc) as rn
  from public.notifications x
  join public.profiles p on p.id = x.user_id and p.role = 'student'
) r
where n.id = r.id and r.rn > 100;
