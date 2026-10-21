-- Task 19 fix round 1 (R133): orphan candidates for the cleanup cron, listed by one read-only query
-- instead of paging the Storage list API and a references table with offsets. Objects are still DELETED
-- only through the Storage API by the route (spec 8.4); this function only reads.

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
    and o.created_at < p_older_than
    and o.name > coalesce(p_after, '')
    and o.name not like '%.emptyFolderPlaceholder'
    and not case p_bucket
      when 'evidence' then exists (select 1 from public.submissions s where s.evidence_path = o.name)
      when 'reward-images' then exists (select 1 from public.rewards r where r.image_path = o.name)
      else exists (select 1 from public.articles a where a.cover_path = o.name)
    end
  order by o.name
  limit v_limit;
end;
$$;

revoke all on function public.storage_orphan_candidates(text, timestamptz, text, int) from public, anon, authenticated;
grant execute on function public.storage_orphan_candidates(text, timestamptz, text, int) to service_role;
