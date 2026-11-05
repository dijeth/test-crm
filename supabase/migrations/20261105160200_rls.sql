-- RLS и права доступа.

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

revoke all on public.profiles, public.objects, public.tasks, public.task_status_history
  from anon, authenticated;

-- Права на уровне колонок: статус и deleted_at меняются только через БД-логику.
grant select on public.profiles, public.objects, public.tasks, public.task_status_history
  to authenticated;
grant insert (owner_id, name, address) on public.objects to authenticated;
grant update (name, address) on public.objects to authenticated;
grant delete on public.objects to authenticated;
grant update (name, description, employee_id) on public.tasks to authenticated;
grant insert (task_id, revision, status, changed_by, comment)
  on public.task_status_history to authenticated;

-- profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_user_role() = 'director');

-- objects
create policy objects_select on public.objects
  for select to authenticated
  using (
    public.current_user_role() = 'director'
    or public.employee_has_object(id)
  );

create policy objects_insert on public.objects
  for insert to authenticated
  with check (
    public.current_user_role() = 'director' and owner_id = auth.uid()
  );

create policy objects_update on public.objects
  for update to authenticated
  using (public.current_user_role() = 'director' and owner_id = auth.uid())
  with check (public.current_user_role() = 'director' and owner_id = auth.uid());

create policy objects_delete on public.objects
  for delete to authenticated
  using (public.current_user_role() = 'director' and owner_id = auth.uid());

-- tasks (вставка только через create_task, удаление только через delete_task)
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    deleted_at is null
    and (
      public.current_user_role() = 'director'
      or employee_id = auth.uid()
    )
  );

create policy tasks_update on public.tasks
  for update to authenticated
  using (
    deleted_at is null
    and public.current_user_role() = 'director'
    and public.is_object_owner(object_id)
  )
  with check (
    deleted_at is null
    and public.current_user_role() = 'director'
    and public.is_object_owner(object_id)
  );

-- task_status_history (детальные проверки в триггере)
create policy history_select on public.task_status_history
  for select to authenticated
  using (
    public.current_user_role() = 'director'
    or public.employee_has_task(task_id)
  );

create policy history_insert on public.task_status_history
  for insert to authenticated
  with check (changed_by = auth.uid());
