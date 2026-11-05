alter table public.profiles
  alter column name set not null;

alter table public.profiles
  add constraint profiles_name_not_blank check (length(btrim(name)) > 0);
