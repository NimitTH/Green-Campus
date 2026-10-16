-- Default waste_categories and carbon rates (Task 5, spec 6.1-6.2).
-- Values and sources: docs/carbon-sources.md. Rows come from 0003_waste_categories.sql;
-- this file adds no fixtures, so it sees exactly the migrated rows.
begin;
select plan(8);

-- 1-2: exactly the four groups
select is((select count(*) from public.waste_categories), 4::bigint,
  'exactly 4 default waste categories');
select set_eq(
  $$select name from public.waste_categories$$,
  array['พลาสติก', 'กระดาษ', 'โลหะ/แก้ว', 'ขยะทั่วไป/อื่นๆ'],
  'the 4 groups have the agreed Thai names');

-- 3: every row documents where its carbon value comes from
select is((select count(*) from public.waste_categories
            where source_note is null or btrim(source_note) = ''),
  0::bigint, 'every row has a non-blank source_note');

-- 4: rates are non-negative
select is((select count(*) from public.waste_categories
            where points_per_kg < 0 or carbon_kg_per_kg < 0),
  0::bigint, 'points_per_kg and carbon_kg_per_kg are >= 0');

-- 5-7: a row is either a labelled estimate or a named TGO source with a URL
select is((select count(*) from public.waste_categories
            where source_note not like 'ค่าประมาณ:%'
              and source_note not like '%อบก%'
              and source_note not like '%TGO%'),
  0::bigint, 'non-estimate rows cite อบก./TGO; estimates start with ค่าประมาณ:');
select is((select count(*) from public.waste_categories
            where source_note not like 'ค่าประมาณ:%'
              and source_note not like '%https://%'),
  0::bigint, 'TGO-sourced rows include a URL');
select is((select count(*) from public.waste_categories
            where source_note not like 'ค่าประมาณ:%'
              and source_note !~ '25[0-9][0-9]'),
  0::bigint, 'TGO-sourced rows name the document year (B.E. 25xx)');

-- 8: the agreed values (docs/carbon-sources.md)
select set_eq(
  $$select name, points_per_kg, carbon_kg_per_kg from public.waste_categories$$,
  $$values ('พลาสติก'::text, 10, 1.0310::numeric),
           ('กระดาษ'::text, 5, 3.5460::numeric),
           ('โลหะ/แก้ว'::text, 15, 0.2760::numeric),
           ('ขยะทั่วไป/อื่นๆ'::text, 2, 0::numeric)$$,
  'default points and carbon values match docs/carbon-sources.md');

select * from finish();
rollback;
