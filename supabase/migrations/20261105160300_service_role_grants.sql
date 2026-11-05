-- Auth Admin seed script writes user profiles and reads/creates CRM data.
grant all on table
  public.profiles,
  public.objects,
  public.tasks,
  public.task_status_history
to service_role;
