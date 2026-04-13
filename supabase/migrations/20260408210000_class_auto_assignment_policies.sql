create table if not exists public.class_auto_assignment_policies (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  assignment_length integer not null check (assignment_length between 4 and 20),
  support_preset text not null check (support_preset in ('balanced', 'independent_first', 'more_support_when_needed')),
  allow_starter_fallback boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (class_id)
);

create index if not exists idx_class_auto_assignment_policies_teacher_updated
  on public.class_auto_assignment_policies (teacher_id, updated_at desc);

create index if not exists idx_class_auto_assignment_policies_class
  on public.class_auto_assignment_policies (class_id);

grant select, insert, update, delete
  on table public.class_auto_assignment_policies
  to authenticated;

alter table if exists public.class_auto_assignment_policies
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'class_auto_assignment_policies'
      and policyname = 'Teachers can view own auto assign policies'
  ) then
    create policy "Teachers can view own auto assign policies"
      on public.class_auto_assignment_policies
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
      and tablename = 'class_auto_assignment_policies'
      and policyname = 'Teachers can insert own auto assign policies'
  ) then
    create policy "Teachers can insert own auto assign policies"
      on public.class_auto_assignment_policies
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
      and tablename = 'class_auto_assignment_policies'
      and policyname = 'Teachers can update own auto assign policies'
  ) then
    create policy "Teachers can update own auto assign policies"
      on public.class_auto_assignment_policies
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
      and tablename = 'class_auto_assignment_policies'
      and policyname = 'Teachers can delete own auto assign policies'
  ) then
    create policy "Teachers can delete own auto assign policies"
      on public.class_auto_assignment_policies
      for delete
      to authenticated
      using (auth.uid() = teacher_id);
  end if;
end $$;
