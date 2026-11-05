-- Таблицы, типы и индексы.

create type public.user_role as enum ('director', 'employee');

create type public.task_status as enum (
  'new',
  'in_progress',
  'on_review',
  'accepted',
  'needs_work'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  role public.user_role not null
);

create table public.objects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  name text not null,
  address text not null,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete restrict,
  employee_id uuid references public.profiles (id),
  name text not null,
  description text,
  status public.task_status not null default 'new',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id),
  revision integer not null check (revision >= 1),
  status public.task_status not null,
  changed_by uuid not null references public.profiles (id),
  comment text,
  created_at timestamptz not null default now(),
  unique (task_id, revision)
);

create index objects_owner_id_idx on public.objects (owner_id);

create index tasks_object_id_idx on public.tasks (object_id)
  where deleted_at is null;
create index tasks_employee_object_idx on public.tasks (employee_id, object_id)
  where deleted_at is null;
create index tasks_status_idx on public.tasks (status)
  where deleted_at is null;

create index task_status_history_changed_by_idx
  on public.task_status_history (changed_by);
