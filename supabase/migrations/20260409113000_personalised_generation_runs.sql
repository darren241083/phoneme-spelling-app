create table if not exists public.personalised_generation_runs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  trigger_role text not null default 'central_owner' check (trigger_role in ('central_owner')),
  run_source text not null default 'manual_run_now' check (run_source in ('manual_run_now')),
  selected_class_ids jsonb not null default '[]'::jsonb,
  assignment_length integer not null check (assignment_length between 4 and 20),
  support_preset text not null check (support_preset in ('balanced', 'independent_first', 'more_support_when_needed')),
  allow_starter_fallback boolean not null default true,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  class_count integer not null default 0,
  included_pupil_count integer not null default 0,
  skipped_pupil_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.personalised_generation_run_pupils (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.personalised_generation_runs(id) on delete cascade,
  teacher_id uuid not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  pupil_id uuid not null references public.pupils(id) on delete cascade,
  assignment_id uuid references public.assignments_v2(id) on delete set null,
  status text not null check (status in ('included', 'skipped')),
  skip_reason text null check (skip_reason in ('baseline_incomplete', 'active_automated_assignment')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (run_id, class_id, pupil_id)
);

alter table if exists public.assignments_v2
  add column if not exists automation_kind text,
  add column if not exists automation_source text,
  add column if not exists automation_run_id uuid references public.personalised_generation_runs(id) on delete set null,
  add column if not exists automation_triggered_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assignments_v2_automation_kind_check'
  ) then
    alter table public.assignments_v2
      add constraint assignments_v2_automation_kind_check
      check (automation_kind is null or automation_kind in ('personalised'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'assignments_v2_automation_source_check'
  ) then
    alter table public.assignments_v2
      add constraint assignments_v2_automation_source_check
      check (automation_source is null or automation_source in ('manual_run_now'));
  end if;
end $$;

create index if not exists idx_personalised_generation_runs_teacher_created
  on public.personalised_generation_runs (teacher_id, created_at desc);

create index if not exists idx_personalised_generation_run_pupils_run_status
  on public.personalised_generation_run_pupils (run_id, status);

create index if not exists idx_personalised_generation_run_pupils_pupil
  on public.personalised_generation_run_pupils (pupil_id, created_at desc);

create index if not exists idx_assignments_v2_automation_run
  on public.assignments_v2 (automation_run_id);

create index if not exists idx_assignments_v2_automation_kind
  on public.assignments_v2 (automation_kind, automation_source, class_id, created_at desc);

grant select, insert, update, delete
  on table public.personalised_generation_runs
  to authenticated;

grant select, insert, update, delete
  on table public.personalised_generation_run_pupils
  to authenticated;

alter table if exists public.personalised_generation_runs
  enable row level security;

alter table if exists public.personalised_generation_run_pupils
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'personalised_generation_runs'
      and policyname = 'Teachers can view own personalised generation runs'
  ) then
    create policy "Teachers can view own personalised generation runs"
      on public.personalised_generation_runs
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
      and tablename = 'personalised_generation_runs'
      and policyname = 'Teachers can insert own personalised generation runs'
  ) then
    create policy "Teachers can insert own personalised generation runs"
      on public.personalised_generation_runs
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
      and tablename = 'personalised_generation_runs'
      and policyname = 'Teachers can update own personalised generation runs'
  ) then
    create policy "Teachers can update own personalised generation runs"
      on public.personalised_generation_runs
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
      and tablename = 'personalised_generation_runs'
      and policyname = 'Teachers can delete own personalised generation runs'
  ) then
    create policy "Teachers can delete own personalised generation runs"
      on public.personalised_generation_runs
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
      and tablename = 'personalised_generation_run_pupils'
      and policyname = 'Teachers can view own personalised generation run pupils'
  ) then
    create policy "Teachers can view own personalised generation run pupils"
      on public.personalised_generation_run_pupils
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
      and tablename = 'personalised_generation_run_pupils'
      and policyname = 'Teachers can insert own personalised generation run pupils'
  ) then
    create policy "Teachers can insert own personalised generation run pupils"
      on public.personalised_generation_run_pupils
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
      and tablename = 'personalised_generation_run_pupils'
      and policyname = 'Teachers can update own personalised generation run pupils'
  ) then
    create policy "Teachers can update own personalised generation run pupils"
      on public.personalised_generation_run_pupils
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
      and tablename = 'personalised_generation_run_pupils'
      and policyname = 'Teachers can delete own personalised generation run pupils'
  ) then
    create policy "Teachers can delete own personalised generation run pupils"
      on public.personalised_generation_run_pupils
      for delete
      to authenticated
      using (auth.uid() = teacher_id);
  end if;
end $$;
