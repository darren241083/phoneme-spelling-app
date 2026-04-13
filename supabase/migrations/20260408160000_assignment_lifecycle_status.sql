alter table if exists public.attempts
  add column if not exists word_source text;

create table if not exists public.assignment_pupil_statuses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  assignment_id uuid not null references public.assignments_v2(id) on delete cascade,
  class_id uuid,
  test_id uuid,
  pupil_id uuid not null references public.pupils(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned', 'started', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  last_opened_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assignment_id, pupil_id)
);

create index if not exists idx_assignment_pupil_statuses_assignment_pupil
  on public.assignment_pupil_statuses (assignment_id, pupil_id);

create index if not exists idx_assignment_pupil_statuses_teacher_assignment
  on public.assignment_pupil_statuses (teacher_id, assignment_id, updated_at desc);

create index if not exists idx_assignment_pupil_statuses_pupil_completed
  on public.assignment_pupil_statuses (pupil_id, completed_at desc);

grant select, insert, update, delete
  on table public.assignment_pupil_statuses
  to authenticated;

grant select, insert, update
  on table public.assignment_pupil_statuses
  to anon;

alter table if exists public.assignment_pupil_statuses
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_pupil_statuses'
      and policyname = 'Teachers can view own assignment pupil statuses'
  ) then
    create policy "Teachers can view own assignment pupil statuses"
      on public.assignment_pupil_statuses
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
      and tablename = 'assignment_pupil_statuses'
      and policyname = 'Teachers can insert own assignment pupil statuses'
  ) then
    create policy "Teachers can insert own assignment pupil statuses"
      on public.assignment_pupil_statuses
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
      and tablename = 'assignment_pupil_statuses'
      and policyname = 'Teachers can update own assignment pupil statuses'
  ) then
    create policy "Teachers can update own assignment pupil statuses"
      on public.assignment_pupil_statuses
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
      and tablename = 'assignment_pupil_statuses'
      and policyname = 'Teachers can delete own assignment pupil statuses'
  ) then
    create policy "Teachers can delete own assignment pupil statuses"
      on public.assignment_pupil_statuses
      for delete
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
      and tablename = 'assignment_pupil_statuses'
      and policyname = 'Anon can view assignment pupil statuses'
  ) then
    create policy "Anon can view assignment pupil statuses"
      on public.assignment_pupil_statuses
      for select
      to anon
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_pupil_statuses'
      and policyname = 'Anon can insert assignment pupil statuses'
  ) then
    create policy "Anon can insert assignment pupil statuses"
      on public.assignment_pupil_statuses
      for insert
      to anon
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_pupil_statuses'
      and policyname = 'Anon can update assignment pupil statuses'
  ) then
    create policy "Anon can update assignment pupil statuses"
      on public.assignment_pupil_statuses
      for update
      to anon
      using (true)
      with check (true);
  end if;
end $$;
