-- Green Campus core schema (spec section 5 and 5.1).
-- RLS is enabled on every table here; policies are added in the auth/RLS migration.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- profiles --------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  full_name text not null,
  display_name text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- waste_categories ------------------------------------------------------
create table public.waste_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  points_per_kg integer not null check (points_per_kg >= 0),
  carbon_kg_per_kg numeric not null check (carbon_kg_per_kg >= 0),
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- activities ------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  is_offsite boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  type text not null check (type in ('waste', 'trees', 'fixed')),
  requires_code boolean not null default false,
  unit_points integer not null default 0 check (unit_points >= 0),
  unit_carbon_kg numeric check (unit_carbon_kg is null or unit_carbon_kg >= 0),
  max_per_submission integer check (max_per_submission is null or max_per_submission > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);

-- participations --------------------------------------------------------
create table public.participations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (activity_id, student_id)
);

-- weigh_codes -----------------------------------------------------------
create table public.weigh_codes (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{6}$'),
  issued_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  used_at timestamptz,
  revoked_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index weigh_codes_one_active_per_pair
  on public.weigh_codes (activity_id, student_id)
  where used_at is null and revoked_at is null;
create index weigh_codes_student_idx on public.weigh_codes (student_id);

-- submissions -----------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete cascade,
  code_id uuid references public.weigh_codes (id) on delete set null,
  evidence_path text,
  evidence_sha256 text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index submissions_activity_idx on public.submissions (activity_id);
create index submissions_student_idx on public.submissions (student_id);
create index submissions_status_idx on public.submissions (status);

-- submission_items ------------------------------------------------------
create table public.submission_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  waste_category_id uuid references public.waste_categories (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
create index submission_items_submission_idx on public.submission_items (submission_id);

create or replace function public.check_submission_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type text;
begin
  select a.type into v_type
  from public.submissions s
  join public.activities a on a.id = s.activity_id
  where s.id = new.submission_id;

  if v_type is null then
    return new; -- missing submission is reported by the foreign key
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'submission item quantity must be > 0' using errcode = '23514';
  end if;

  if v_type = 'waste' then
    if new.waste_category_id is null then
      raise exception 'waste activity requires waste_category_id' using errcode = '23514';
    end if;
  else
    if new.waste_category_id is not null then
      raise exception '% activity must not have waste_category_id', v_type using errcode = '23514';
    end if;
    if v_type = 'fixed' and new.quantity <> 1 then
      raise exception 'fixed activity quantity must be 1' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger submission_items_check
  before insert or update on public.submission_items
  for each row execute function public.check_submission_item();

-- rewards ---------------------------------------------------------------
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points_cost integer not null check (points_cost > 0),
  stock integer not null default 0 check (stock >= 0),
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- orders ----------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending_pickup'
    check (status in ('pending_pickup', 'completed', 'cancelled', 'expired')),
  total_points integer not null check (total_points >= 0),
  expires_at timestamptz not null default (now() + interval '7 days'),
  completed_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_student_idx on public.orders (student_id);

-- order_items -----------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_cost integer not null check (unit_cost >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);

-- cart_items ------------------------------------------------------------
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid not null references public.rewards (id) on delete cascade,
  qty integer not null default 1 check (qty > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, reward_id)
);

-- ledger_entries --------------------------------------------------------
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('earn', 'redeem', 'refund', 'adjust')),
  points integer not null,
  carbon_kg numeric(12, 3) not null default 0,
  ref_submission_id uuid references public.submissions (id) on delete set null,
  ref_order_id uuid references public.orders (id) on delete set null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'earn' or points > 0),
  check (kind <> 'redeem' or points < 0),
  check (kind <> 'refund' or points > 0),
  check (kind not in ('redeem', 'refund') or carbon_kg = 0)
);
create index ledger_entries_student_idx on public.ledger_entries (student_id);

-- notifications ---------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at);

-- articles --------------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  body text not null default '',
  cover_path text,
  published boolean not null default false,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers ---------------------------------------------------
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger waste_categories_set_updated_at before update on public.waste_categories
  for each row execute function public.set_updated_at();
create trigger activities_set_updated_at before update on public.activities
  for each row execute function public.set_updated_at();
create trigger weigh_codes_set_updated_at before update on public.weigh_codes
  for each row execute function public.set_updated_at();
create trigger submissions_set_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();
create trigger rewards_set_updated_at before update on public.rewards
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger cart_items_set_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();
create trigger articles_set_updated_at before update on public.articles
  for each row execute function public.set_updated_at();

-- Row Level Security (policies come in the next migration) --------------
alter table public.profiles enable row level security;
alter table public.waste_categories enable row level security;
alter table public.activities enable row level security;
alter table public.participations enable row level security;
alter table public.weigh_codes enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_items enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.rewards enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;
alter table public.articles enable row level security;
