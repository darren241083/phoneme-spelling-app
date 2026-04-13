create or replace function public.is_central_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teacher_app_roles
    where teacher_id = auth.uid()
      and app_role = 'central_owner'
  );
$$;

revoke all on function public.is_central_owner() from public;
grant execute on function public.is_central_owner() to authenticated;

create table if not exists public.personalised_automation_policies (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique,
  active boolean not null default false,
  assignment_length integer not null check (assignment_length between 4 and 20),
  support_preset text not null check (support_preset in ('balanced', 'independent_first', 'more_support_when_needed')),
  allow_starter_fallback boolean not null default true,
  frequency text not null check (frequency in ('weekly', 'fortnightly')),
  selected_weekdays text[] not null default array['friday']::text[],
  start_date date not null,
  end_date date null,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint personalised_automation_policies_selected_weekdays_check
    check (
      cardinality(selected_weekdays) > 0
      and selected_weekdays <@ array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::text[]
    ),
  constraint personalised_automation_policies_date_window_check
    check (end_date is null or end_date >= start_date)
);

create table if not exists public.personalised_automation_policy_targets (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.personalised_automation_policies(id) on delete cascade,
  teacher_id uuid not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (policy_id, class_id)
);

create index if not exists idx_personalised_automation_policies_teacher_updated
  on public.personalised_automation_policies (teacher_id, updated_at desc);

create index if not exists idx_personalised_automation_policy_targets_policy
  on public.personalised_automation_policy_targets (policy_id, created_at desc);

create index if not exists idx_personalised_automation_policy_targets_class
  on public.personalised_automation_policy_targets (class_id);

alter table if exists public.personalised_generation_runs
  add column if not exists automation_policy_id uuid references public.personalised_automation_policies(id) on delete set null,
  add column if not exists policy_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists derived_deadline_at timestamptz;

create index if not exists idx_personalised_generation_runs_policy
  on public.personalised_generation_runs (automation_policy_id, created_at desc);

grant select, insert, update, delete
  on table public.personalised_automation_policies
  to authenticated;

grant select, insert, update, delete
  on table public.personalised_automation_policy_targets
  to authenticated;

alter table if exists public.personalised_automation_policies
  enable row level security;

alter table if exists public.personalised_automation_policy_targets
  enable row level security;

drop policy if exists "Central owners can view own personalised automation policies"
  on public.personalised_automation_policies;
drop policy if exists "Central owners can insert own personalised automation policies"
  on public.personalised_automation_policies;
drop policy if exists "Central owners can update own personalised automation policies"
  on public.personalised_automation_policies;
drop policy if exists "Central owners can delete own personalised automation policies"
  on public.personalised_automation_policies;

create policy "Central owners can view own personalised automation policies"
  on public.personalised_automation_policies
  for select
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can insert own personalised automation policies"
  on public.personalised_automation_policies
  for insert
  to authenticated
  with check (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can update own personalised automation policies"
  on public.personalised_automation_policies
  for update
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner())
  with check (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can delete own personalised automation policies"
  on public.personalised_automation_policies
  for delete
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner());

drop policy if exists "Central owners can view own personalised automation policy targets"
  on public.personalised_automation_policy_targets;
drop policy if exists "Central owners can insert own personalised automation policy targets"
  on public.personalised_automation_policy_targets;
drop policy if exists "Central owners can update own personalised automation policy targets"
  on public.personalised_automation_policy_targets;
drop policy if exists "Central owners can delete own personalised automation policy targets"
  on public.personalised_automation_policy_targets;

create policy "Central owners can view own personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for select
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can insert own personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for insert
  to authenticated
  with check (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can update own personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for update
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner())
  with check (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can delete own personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for delete
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner());

drop policy if exists "Teachers can view own personalised generation runs"
  on public.personalised_generation_runs;
drop policy if exists "Teachers can insert own personalised generation runs"
  on public.personalised_generation_runs;
drop policy if exists "Teachers can update own personalised generation runs"
  on public.personalised_generation_runs;
drop policy if exists "Teachers can delete own personalised generation runs"
  on public.personalised_generation_runs;

create policy "Central owners can view own personalised generation runs"
  on public.personalised_generation_runs
  for select
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can insert own personalised generation runs"
  on public.personalised_generation_runs
  for insert
  to authenticated
  with check (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can update own personalised generation runs"
  on public.personalised_generation_runs
  for update
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner())
  with check (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can delete own personalised generation runs"
  on public.personalised_generation_runs
  for delete
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner());

drop policy if exists "Teachers can view own personalised generation run pupils"
  on public.personalised_generation_run_pupils;
drop policy if exists "Teachers can insert own personalised generation run pupils"
  on public.personalised_generation_run_pupils;
drop policy if exists "Teachers can update own personalised generation run pupils"
  on public.personalised_generation_run_pupils;
drop policy if exists "Teachers can delete own personalised generation run pupils"
  on public.personalised_generation_run_pupils;

create policy "Central owners can view own personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for select
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can insert own personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for insert
  to authenticated
  with check (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can update own personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for update
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner())
  with check (auth.uid() = teacher_id and public.is_central_owner());

create policy "Central owners can delete own personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for delete
  to authenticated
  using (auth.uid() = teacher_id and public.is_central_owner());
