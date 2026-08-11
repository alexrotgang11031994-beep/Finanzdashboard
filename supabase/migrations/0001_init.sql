-- Finanzdashboard — Grundschema mit Mandantentrennung auf Zeilenebene.
--
-- Leitgedanke: user_id steht auf JEDER Tabelle, auch wo sie über den
-- Fremdschlüssel herleitbar wäre. Damit kommt jede RLS-Policy ohne Subquery
-- oder Join aus. Das ist kein Schönheitsfehler, sondern Absicht: Policies mit
-- Joins verschlucken Zeilen still, und Policies mit Subqueries über große
-- Tabellen werden langsam.

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  locale        text not null default 'de-DE',
  base_currency text not null default 'EUR',
  theme         text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- clusters

-- Aus config.js in die Datenbank gewandert, damit jeder Nutzer eigene
-- Kategorien pflegen kann.
create table public.clusters (
  user_id    uuid not null references auth.users on delete cascade,
  key        text not null check (key ~ '^[A-Z0-9_]{2,16}$'),
  label      text not null,
  color      text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  target     numeric(5, 2) not null default 0 check (target >= 0 and target <= 100),
  is_core    boolean not null default false,
  sort_order integer not null default 0,
  primary key (user_id, key)
);

-- Höchstens ein Kern-Cluster pro Nutzer — die Mindestquote prüft gegen genau eines.
create unique index clusters_one_core_per_user
  on public.clusters (user_id) where is_core;

-- ------------------------------------------------------------------- rules

create table public.rules (
  user_id             uuid primary key references auth.users on delete cascade,
  max_single_position numeric(5, 2) not null default 8,
  max_cluster         numeric(5, 2) not null default 25,
  min_core            numeric(5, 2) not null default 20,
  max_positions       integer       not null default 25,
  min_position_size   numeric(5, 2) not null default 0.3
);

-- -------------------------------------------------------------- portfolios

create table public.portfolios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  broker     text,
  as_of      date,
  created_at timestamptz not null default now()
);

create index portfolios_user_idx on public.portfolios (user_id);

-- --------------------------------------------------------------- positions

create table public.positions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  portfolio_id uuid not null references public.portfolios on delete cascade,
  name         text not null,
  ticker       text,
  isin         text check (isin is null or isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  quantity     numeric(20, 8),
  value        numeric(16, 2) not null check (value >= 0),
  currency     text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  cluster      text,
  type         text,
  source       text not null default 'manual' check (source in ('manual', 'photo', 'csv')),
  created_at   timestamptz not null default now(),
  -- Das Cluster muss dem Nutzer gehören. Diese Fremdschlüsselbeziehung ist der
  -- Grund, warum der Cluster-Mismatch der alten JSON-Daten hier nicht mehr
  -- auftreten kann.
  foreign key (user_id, cluster) references public.clusters (user_id, key) on delete set null
);

create index positions_portfolio_idx on public.positions (portfolio_id);
create index positions_user_idx on public.positions (user_id);

-- ----------------------------------------------------------- savings_plans

create table public.savings_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  portfolio_id uuid not null references public.portfolios on delete cascade,
  name         text not null,
  amount       numeric(12, 2) not null check (amount > 0),
  interval     text not null check (interval in ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  cluster      text,
  monthly      numeric(12, 2) not null check (monthly >= 0),
  created_at   timestamptz not null default now(),
  foreign key (user_id, cluster) references public.clusters (user_id, key) on delete set null
);

create index savings_plans_portfolio_idx on public.savings_plans (portfolio_id);

-- --------------------------------------------------------------- snapshots

create table public.snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  portfolio_id uuid not null references public.portfolios on delete cascade,
  date         date not null,
  value        numeric(16, 2) not null check (value >= 0),
  note         text,
  created_at   timestamptz not null default now(),
  -- Ein Stand je Tag und Depot. Ersetzt die Upsert-nach-Datum-Logik aus store.js.
  unique (portfolio_id, date)
);

create index snapshots_portfolio_date_idx on public.snapshots (portfolio_id, date);

-- --------------------------------------------------------- Row Level Security

alter table public.profiles      enable row level security;
alter table public.clusters      enable row level security;
alter table public.rules         enable row level security;
alter table public.portfolios    enable row level security;
alter table public.positions     enable row level security;
alter table public.savings_plans enable row level security;
alter table public.snapshots     enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own clusters" on public.clusters
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own rules" on public.rules
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own portfolios" on public.portfolios
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own positions" on public.positions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own savings_plans" on public.savings_plans
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own snapshots" on public.snapshots
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ------------------------------------------------- Startbestand je neuem Nutzer

-- Legt Profil, Regelwerk, die Standard-Cluster und ein leeres Depot an.
-- Die Cluster-Vorgaben entsprechen dem CLUSTERS-Block der alten config.js.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));

  insert into public.rules (user_id) values (new.id);

  insert into public.clusters (user_id, key, label, color, target, is_core, sort_order)
  values
    (new.id, 'SEMI',  'Halbleiter & KI-Chips',   '#A8391F', 24, false, 1),
    (new.id, 'PHYS',  'Physical AI & Robotik',   '#C9752B', 12, false, 2),
    (new.id, 'INFRA', 'KI-Infrastruktur',        '#6E8C2F', 12, false, 3),
    (new.id, 'SOFT',  'Software & Plattformen',  '#2C4A6E', 12, false, 4),
    (new.id, 'KERN',  'Breiter Markt',           '#0E7A6E', 20, true,  5),
    (new.id, 'ROHS',  'Edelmetalle & Rohstoffe', '#8C7628',  9, false, 6),
    (new.id, 'INDU',  'Industrie & Rüstung',     '#3D5A4C',  7, false, 7),
    (new.id, 'DEFE',  'Defensiv',                '#6E6A62',  3, false, 8),
    (new.id, 'SPEK',  'Spekulativ',              '#7A4E77',  1, false, 9);

  insert into public.portfolios (user_id, name) values (new.id, 'Mein Depot');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
