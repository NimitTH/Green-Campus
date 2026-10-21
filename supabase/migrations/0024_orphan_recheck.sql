-- Task 19 fix round 2 (R134).
-- 1. storage_referenced_names: the pre-delete re-check as a POST RPC (a GET .in() list of 100 long
--    evidence paths exceeds the URL limit).
-- 2. storage_orphan_candidates is replaced: byte-order (COLLATE "C") for both the keyset comparison and
--    ORDER BY (matches JS string order and the (bucket_id, name COLLATE "C") index), and only current,
--    non-delete-marker objects. ASSUMPTION: storage.objects has archived_at and is_delete_marker (present
--    in the local stack and current Supabase Storage); plpgsql binds them at call time, so a project whose
--    storage schema lacks them would fail loudly on the first call rather than delete anything.

create or replace function public.storage_orphan_candidates(
  p_bucket text,
  p_older_than timestamptz,
  p_after text default '',
  p_limit int default 500
)
returns table(name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 500), 1), 1000);
begin
  if p_bucket is null or p_bucket not in ('evidence', 'reward-images', 'article-images') then
    raise exception 'unknown bucket' using errcode = '22023';
  end if;
  if p_older_than is null then
    raise exception 'p_older_than is required' using errcode = '22023';
  end if;

  return query
  select o.name::text, o.created_at
  from storage.objects o
  where o.bucket_id = p_bucket
    and o.archived_at is null
    and not coalesce(o.is_delete_marker, false)
    and o.created_at < p_older_than
    and o.name collate "C" > coalesce(p_after, '') collate "C"
    and o.name not like '%.emptyFolderPlaceholder'
    and not case p_bucket
      when 'evidence' then exists (select 1 from public.submissions s where s.evidence_path = o.name)
      when 'reward-images' then exists (select 1 from public.rewards r where r.image_path = o.name)
      else exists (select 1 from public.articles a where a.cover_path = o.name)
    end
  order by o.name collate "C"
  limit v_limit;
end;
$$;

revoke all on function public.storage_orphan_candidates(text, timestamptz, text, int) from public, anon, authenticated;
grant execute on function public.storage_orphan_candidates(text, timestamptz, text, int) to service_role;

create or replace function public.storage_referenced_names(p_bucket text, p_names text[])
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_bucket is null or p_bucket not in ('evidence', 'reward-images', 'article-images') then
    raise exception 'unknown bucket' using errcode = '22023';
  end if;

  if p_bucket = 'evidence' then
    return query select s.evidence_path::text from public.submissions s where s.evidence_path = any (p_names);
  elsif p_bucket = 'reward-images' then
    return query select r.image_path::text from public.rewards r where r.image_path = any (p_names);
  else
    return query select a.cover_path::text from public.articles a where a.cover_path = any (p_names);
  end if;
end;
$$;

revoke all on function public.storage_referenced_names(text, text[]) from public, anon, authenticated;
grant execute on function public.storage_referenced_names(text, text[]) to service_role;
