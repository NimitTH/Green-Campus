-- Green Campus: Task 18 Part B fix round 1. 0020 and 0021 are not edited.
--
-- * articles.cover_path must live in the article's own folder ({article id}/{uuid}.jpg). saveArticle
--   already checks this; the database now does too, so a direct API write cannot point an article at
--   another article's cover (whose delete would then remove a picture still in use). Existing rows
--   that break it lose their cover reference first (the object is left for the Task 19 cleanup).
-- * handle_new_user: the 0021 body, also trimming display_name after the clip to 50, so it never ends
--   in whitespace (e.g. a name whose 50th character is a space).

update public.articles
set cover_path = null
where cover_path is not null and split_part(cover_path, '/', 1) <> id::text;

alter table public.articles drop constraint articles_cover_path_format;
alter table public.articles
  add constraint articles_cover_path_format
    check (
      cover_path is null
      or (cover_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
          and split_part(cover_path, '/', 1) = id::text)
    );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
begin
  v_full_name := left(coalesce(
    nullif(regexp_replace(new.raw_user_meta_data ->> 'full_name', '^\s+|\s+$', '', 'g'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    nullif(new.email, ''),
    'ผู้ใช้ใหม่'
  ), 100);
  -- clipping can leave trailing whitespace (e.g. a space at position 100); trim again
  v_full_name := coalesce(nullif(regexp_replace(v_full_name, '^\s+|\s+$', '', 'g'), ''), 'ผู้ใช้ใหม่');

  insert into public.profiles (id, role, full_name, display_name)
  values (new.id, 'student', v_full_name, regexp_replace(left(v_full_name, 50), '\s+$', '', 'g'));

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
