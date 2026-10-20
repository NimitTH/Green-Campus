-- Green Campus: phase 1 review hardening.
--
-- * pgcrypto: issue_weigh_code (0006) calls extensions.gen_random_bytes. PL/pgSQL resolves that
--   call at runtime, so creating the extension here (after 0006) is early enough; this makes it
--   certain on a fresh Supabase Cloud project where it may not be enabled yet.
-- * activity_status_locked: an activity cannot go back to 'draft' once a student has joined
--   (draft hides it from students, who would lose sight of work they already joined).
-- * One earn ledger row per submission, enforced by the database.
create extension if not exists pgcrypto with schema extensions;

-- activity status lock -----------------------------------------------------------------------
create or replace function public.prevent_activity_draft_with_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'draft'
     and old.status is distinct from 'draft'
     and exists (select 1 from public.participations p where p.activity_id = old.id) then
    raise exception 'activity_status_locked'
      using hint = 'ให้ปิดกิจกรรมแทนการเปลี่ยนกลับเป็นฉบับร่าง';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_activity_draft_with_participants()
  from public, anon, authenticated;

create trigger activities_prevent_draft_with_participants
  before update of status on public.activities
  for each row execute function public.prevent_activity_draft_with_participants();

-- one earn row per submission ------------------------------------------------------------------
create unique index ledger_entries_one_earn_per_submission
  on public.ledger_entries (ref_submission_id)
  where kind = 'earn';
