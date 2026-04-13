create table if not exists public.teacher_pupil_group_values (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  pupil_id uuid not null references public.pupils(id) on delete cascade,
  group_type text not null,
  group_value text not null,
  source text not null default 'manual',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (teacher_id, pupil_id, group_type)
);

comment on table public.teacher_pupil_group_values is
  'Teacher-owned group comparison attributes. Sensitive statuses should be stored here instead of public pupil records.';

create index if not exists idx_teacher_pupil_group_values_teacher_type_pupil
  on public.teacher_pupil_group_values (teacher_id, group_type, pupil_id);

create index if not exists idx_teacher_pupil_group_values_teacher_type_value
  on public.teacher_pupil_group_values (teacher_id, group_type, group_value);

grant select, insert, update, delete
  on table public.teacher_pupil_group_values
  to authenticated;

alter table if exists public.teacher_pupil_group_values
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teacher_pupil_group_values'
      and policyname = 'Teachers can view own group comparison values'
  ) then
    create policy "Teachers can view own group comparison values"
      on public.teacher_pupil_group_values
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
      and tablename = 'teacher_pupil_group_values'
      and policyname = 'Teachers can insert own group comparison values'
  ) then
    create policy "Teachers can insert own group comparison values"
      on public.teacher_pupil_group_values
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
      and tablename = 'teacher_pupil_group_values'
      and policyname = 'Teachers can update own group comparison values'
  ) then
    create policy "Teachers can update own group comparison values"
      on public.teacher_pupil_group_values
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
      and tablename = 'teacher_pupil_group_values'
      and policyname = 'Teachers can delete own group comparison values'
  ) then
    create policy "Teachers can delete own group comparison values"
      on public.teacher_pupil_group_values
      for delete
      to authenticated
      using (auth.uid() = teacher_id);
  end if;
end $$;
