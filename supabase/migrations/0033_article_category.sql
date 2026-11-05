-- Redesign 4 (DESIGN-4 7.2): article category.
alter table public.articles
  add column category text not null default 'knowledge';
alter table public.articles
  add constraint articles_category_check check (category in ('knowledge', 'announcement', 'other'));
create index articles_published_category_idx on public.articles (published, category);
