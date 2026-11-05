create policy profiles_history_authors_select on public.profiles
  for select to authenticated
  using (
    public.current_user_role() = 'director'
    or id = auth.uid()
    or exists (
      select 1
      from public.task_status_history h
      where h.changed_by = profiles.id
        and public.employee_has_task(h.task_id)
    )
  );
