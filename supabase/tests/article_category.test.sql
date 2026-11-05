-- Redesign 4 (DESIGN-4 7.2): articles.category
begin;
select plan(4);

select has_column('public', 'articles', 'category', 'articles.category exists');
select is((select column_default from information_schema.columns
           where table_schema = 'public' and table_name = 'articles' and column_name = 'category'),
  '''knowledge''::text', 'default is knowledge');
select lives_ok($$insert into public.articles (title, slug, category) values ('AC a', 'ac-a', 'announcement')$$,
  'announcement is accepted');
select throws_ok($$insert into public.articles (title, slug, category) values ('AC b', 'ac-b', 'news')$$,
  '23514', null, 'news is rejected');

select * from finish();
rollback;
