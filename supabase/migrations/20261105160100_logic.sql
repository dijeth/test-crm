-- Функции, триггеры и бизнес-логика.

-- Вспомогательные функции для RLS (security definer, чтобы избежать рекурсии политик).
create function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_object_owner(p_object_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.objects
    where id = p_object_id and owner_id = auth.uid()
  )
$$;

create function public.employee_has_object(p_object_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks
    where object_id = p_object_id
      and employee_id = auth.uid()
      and deleted_at is null
  )
$$;

create function public.employee_has_task(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tasks
    where id = p_task_id
      and employee_id = auth.uid()
      and deleted_at is null
  )
$$;

-- Валидация tasks: исполнитель, прямые изменения, soft delete.
create function public.tasks_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.employee_id is not null
     and (tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id)
     and not exists (
       select 1 from public.profiles
       where id = new.employee_id and role = 'employee'
     ) then
    raise exception 'Assignee must have the employee role';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'new' or new.deleted_at is not null then
      raise exception 'Task must be created with status new and not deleted';
    end if;
    return new;
  end if;

  -- Статус меняется только из триггера истории (глубина вызова > 1).
  if new.status is distinct from old.status and pg_trigger_depth() < 2 then
    raise exception 'Task status can only be changed via task_status_history';
  end if;

  if new.object_id is distinct from old.object_id
     or new.created_at is distinct from old.created_at then
    raise exception 'object_id and created_at are immutable';
  end if;

  if old.deleted_at is not null then
    raise exception 'Deleted task cannot be modified';
  end if;

  if new.employee_id is distinct from old.employee_id and old.status <> 'new' then
    raise exception 'Assignee can only be changed in status new';
  end if;

  if new.deleted_at is not null then
    if old.status <> 'new' then
      raise exception 'Only tasks in status new can be deleted';
    end if;
    if not public.is_object_owner(new.object_id) then
      raise exception 'Only the object owner can delete the task';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_guard
before insert or update on public.tasks
for each row execute function public.tasks_guard();

-- Проверки перед добавлением записи истории.
create function public.task_status_history_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
  v_role public.user_role;
  v_last_revision integer;
  v_prev public.task_status;
begin
  if new.changed_by is distinct from auth.uid() then
    raise exception 'changed_by must equal the current user';
  end if;

  select * into v_task from public.tasks where id = new.task_id for update;
  if not found or v_task.deleted_at is not null then
    raise exception 'Task not found';
  end if;

  select max(revision) into v_last_revision
  from public.task_status_history where task_id = new.task_id;

  if new.revision is distinct from coalesce(v_last_revision, 0) + 1 then
    raise exception 'Invalid revision: expected %', coalesce(v_last_revision, 0) + 1;
  end if;

  v_role := public.current_user_role();

  if new.revision = 1 then
    if new.status <> 'new' then
      raise exception 'First history record must have status new';
    end if;
    if v_role is distinct from 'director' or not public.is_object_owner(v_task.object_id) then
      raise exception 'Only the object owner can create tasks';
    end if;
    return new;
  end if;

  select status into v_prev
  from public.task_status_history
  where task_id = new.task_id and revision = new.revision - 1;

  if (v_prev, new.status) in (
    ('new', 'in_progress'),
    ('needs_work', 'in_progress'),
    ('in_progress', 'on_review')
  ) then
    if v_role is distinct from 'employee' or v_task.employee_id is distinct from auth.uid() then
      raise exception 'Only the assigned employee can make this transition';
    end if;
  elsif (v_prev, new.status) in (
    ('on_review', 'accepted'),
    ('on_review', 'needs_work')
  ) then
    if v_role is distinct from 'director' then
      raise exception 'Only a director can make this transition';
    end if;
  else
    raise exception 'Transition % -> % is not allowed', v_prev, new.status;
  end if;

  if new.status = 'needs_work' and nullif(btrim(coalesce(new.comment, '')), '') is null then
    raise exception 'Comment is required for needs_work';
  end if;

  return new;
end;
$$;

create trigger task_status_history_before_insert
before insert on public.task_status_history
for each row execute function public.task_status_history_before_insert();

-- Обновление текущего статуса задачи.
create function public.task_status_history_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.tasks set status = new.status where id = new.task_id;
  return new;
end;
$$;

create trigger task_status_history_after_insert
after insert on public.task_status_history
for each row execute function public.task_status_history_after_insert();

-- История append-only (в том числе для владельца таблицы).
create function public.task_status_history_immutable()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'task_status_history is append-only';
end;
$$;

create trigger task_status_history_no_update_delete
before update or delete on public.task_status_history
for each row execute function public.task_status_history_immutable();

create trigger task_status_history_no_truncate
before truncate on public.task_status_history
for each statement execute function public.task_status_history_immutable();

-- Атомарное создание задачи с первой записью истории.
create function public.create_task(
  p_object_id uuid,
  p_name text,
  p_description text default null,
  p_employee_id uuid default null
)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  if public.current_user_role() is distinct from 'director'
     or not public.is_object_owner(p_object_id) then
    raise exception 'Only the object owner can create tasks';
  end if;

  insert into public.tasks (object_id, employee_id, name, description)
  values (p_object_id, p_employee_id, p_name, p_description)
  returning * into v_task;

  insert into public.task_status_history (task_id, revision, status, changed_by)
  values (v_task.id, 1, 'new', auth.uid());

  return v_task;
end;
$$;

-- Soft delete задачи (валидация в tasks_guard).
create function public.delete_task(p_task_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_user_role() is distinct from 'director' then
    raise exception 'Only a director can delete tasks';
  end if;

  update public.tasks set deleted_at = now()
  where id = p_task_id and deleted_at is null;

  if not found then
    raise exception 'Task not found';
  end if;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.create_task(uuid, text, text, uuid),
  public.delete_task(uuid),
  public.current_user_role(),
  public.is_object_owner(uuid),
  public.employee_has_object(uuid),
  public.employee_has_task(uuid)
to authenticated;
