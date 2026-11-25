-- Round 6 (old-site features 4): an optional display window for articles. Outside it, anon and students do not see
-- the article (list, page, search, not-found check: every public read goes through these policies); staff still do.

alter table public.articles
  add column show_from timestamptz,
  add column show_until timestamptz,
  add constraint articles_show_window check (show_from is null or show_until is null or show_until > show_from);

-- The public visibility rule in one place: published, and now() inside [show_from, show_until).
create function public.article_is_visible(a public.articles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select a.published
     and (a.show_from is null or a.show_from <= now())
     and (a.show_until is null or now() < a.show_until)
$$;

drop policy articles_select_public on public.articles;
create policy articles_select_public on public.articles
  for select to anon
  using (public.article_is_visible(articles));

drop policy articles_select on public.articles;
create policy articles_select on public.articles
  for select to authenticated
  using (public.article_is_visible(articles) or (select public.is_staff()));
