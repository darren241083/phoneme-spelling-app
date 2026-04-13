create table if not exists public.teacher_app_roles (
  teacher_id uuid primary key,
  app_role text not null check (app_role in ('teacher', 'central_owner')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

grant select, insert, update, delete
  on table public.teacher_app_roles
  to authenticated;

alter table if exists public.teacher_app_roles
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_app_roles'
      and policyname = 'Teachers can view own app role'
  ) then
    create policy "Teachers can view own app role"
      on public.teacher_app_roles
      for select
      to authenticated
      using (auth.uid() = teacher_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_app_roles'
      and policyname = 'Teachers can insert own app role'
  ) then
    create policy "Teachers can insert own app role"
      on public.teacher_app_roles
      for insert
      to authenticated
      with check (auth.uid() = teacher_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_app_roles'
      and policyname = 'Teachers can update own app role'
  ) then
    create policy "Teachers can update own app role"
      on public.teacher_app_roles
      for update
      to authenticated
      using (auth.uid() = teacher_id)
      with check (auth.uid() = teacher_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_app_roles'
      and policyname = 'Teachers can delete own app role'
  ) then
    create policy "Teachers can delete own app role"
      on public.teacher_app_roles
      for delete
      to authenticated
      using (auth.uid() = teacher_id);
  end if;
end $$;
