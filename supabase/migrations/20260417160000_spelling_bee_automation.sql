alter table public.personalised_automation_policies
  add column if not exists policy_type text not null default 'regular_personalised';

alter table public.personalised_generation_runs
  add column if not exists policy_type text not null default 'regular_personalised';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'personalised_automation_policies_policy_type_check'
      and conrelid = 'public.personalised_automation_policies'::regclass
  ) then
    alter table public.personalised_automation_policies
      drop constraint personalised_automation_policies_policy_type_check;
  end if;
  alter table public.personalised_automation_policies
    add constraint personalised_automation_policies_policy_type_check
    check (policy_type in ('regular_personalised', 'spelling_bee'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'personalised_generation_runs_policy_type_check'
      and conrelid = 'public.personalised_generation_runs'::regclass
  ) then
    alter table public.personalised_generation_runs
      drop constraint personalised_generation_runs_policy_type_check;
  end if;
  alter table public.personalised_generation_runs
    add constraint personalised_generation_runs_policy_type_check
    check (policy_type in ('regular_personalised', 'spelling_bee'));
end $$;

alter table public.assignments_v2
  drop constraint if exists assignments_v2_automation_kind_check;

alter table public.assignments_v2
  add constraint assignments_v2_automation_kind_check
  check (automation_kind is null or automation_kind in ('personalised', 'spelling_bee'));

create table if not exists public.spelling_bee_results (
  id uuid default gen_random_uuid() not null primary key,
  teacher_id uuid not null,
  run_id uuid not null references public.personalised_generation_runs(id) on delete cascade,
  assignment_id uuid not null references public.assignments_v2(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  pupil_id uuid not null references public.pupils(id) on delete cascade,
  streak integer not null default 0 check (streak >= 0),
  rounds_attempted integer not null default 0 check (rounds_attempted >= 0),
  max_rounds integer not null default 0 check (max_rounds >= 0),
  ended_reason text check (ended_reason is null or ended_reason in ('wrong', 'timeout', 'completed', 'abandoned')),
  result_json jsonb not null default '[]'::jsonb,
  snapshot_year_group text,
  snapshot_form_class_id uuid,
  snapshot_form_class_name text,
  snapshot_form_year_group text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (run_id, pupil_id)
);

create index if not exists idx_spelling_bee_results_run_rank
  on public.spelling_bee_results (run_id, streak desc, completed_at);

create index if not exists idx_spelling_bee_results_assignment
  on public.spelling_bee_results (assignment_id, pupil_id);

create index if not exists idx_spelling_bee_results_teacher_run
  on public.spelling_bee_results (teacher_id, run_id);

create index if not exists idx_spelling_bee_results_snapshot_year
  on public.spelling_bee_results (run_id, snapshot_year_group);

create index if not exists idx_spelling_bee_results_snapshot_form
  on public.spelling_bee_results (run_id, snapshot_form_class_id);

alter table public.spelling_bee_results enable row level security;

drop policy if exists "Anon can insert spelling bee results" on public.spelling_bee_results;
create policy "Anon can insert spelling bee results"
  on public.spelling_bee_results
  for insert
  to anon
  with check (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id));

drop policy if exists "Anon can update spelling bee results" on public.spelling_bee_results;
create policy "Anon can update spelling bee results"
  on public.spelling_bee_results
  for update
  to anon
  using (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id))
  with check (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id));

drop policy if exists "Anon can view own spelling bee results" on public.spelling_bee_results;
create policy "Anon can view own spelling bee results"
  on public.spelling_bee_results
  for select
  to anon
  using (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id));

drop policy if exists "Authenticated users can view spelling bee results" on public.spelling_bee_results;
create policy "Authenticated users can view spelling bee results"
  on public.spelling_bee_results
  for select
  to authenticated
  using ((teacher_id = auth.uid()) or public.can_view_assignment(assignment_id));

drop policy if exists "Teachers can insert owned spelling bee results" on public.spelling_bee_results;
create policy "Teachers can insert owned spelling bee results"
  on public.spelling_bee_results
  for insert
  to authenticated
  with check (teacher_id = auth.uid());

drop policy if exists "Teachers can update owned spelling bee results" on public.spelling_bee_results;
create policy "Teachers can update owned spelling bee results"
  on public.spelling_bee_results
  for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create or replace function public.raise_personalised_automation_policy_overlap(p_policy_id uuid) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  conflict_group_names text;
  conflict_policy_names text;
begin
  select
    string_agg(
      distinct coalesce(nullif(trim(c.name), ''), 'Untitled group'),
      ', '
      order by coalesce(nullif(trim(c.name), ''), 'Untitled group')
    ),
    string_agg(
      distinct coalesce(nullif(trim(other_policy.name), ''), 'Untitled policy'),
      ', '
      order by coalesce(nullif(trim(other_policy.name), ''), 'Untitled policy')
    )
  into conflict_group_names, conflict_policy_names
  from public.personalised_automation_policies policy
  join public.personalised_automation_policy_targets targets
    on targets.policy_id = policy.id
  join public.personalised_automation_policy_targets other_targets
    on other_targets.class_id = targets.class_id
   and other_targets.policy_id <> targets.policy_id
  join public.personalised_automation_policies other_policy
    on other_policy.id = other_targets.policy_id
  join public.classes c
    on c.id = targets.class_id
  where policy.id = p_policy_id
    and policy.archived_at is null
    and other_policy.teacher_id = policy.teacher_id
    and other_policy.archived_at is null
    and coalesce(other_policy.policy_type, 'regular_personalised') = coalesce(policy.policy_type, 'regular_personalised')
    and daterange(policy.start_date, coalesce(policy.end_date, 'infinity'::date), '[]')
      && daterange(other_policy.start_date, coalesce(other_policy.end_date, 'infinity'::date), '[]');

  if conflict_group_names is not null then
    raise exception 'These target groups are already used by another automation policy in an overlapping date window: %.', conflict_group_names
      using errcode = '23514',
            detail = case
              when conflict_policy_names is not null
                then format('Conflicting policy names: %s', conflict_policy_names)
              else null
            end,
            hint = 'Adjust the dates, archive the other policy, or change the target groups.';
  end if;
end;
$$;

drop trigger if exists trg_personalised_automation_policy_overlap_from_policy
  on public.personalised_automation_policies;

create trigger trg_personalised_automation_policy_overlap_from_policy
  after insert or update of start_date, end_date, archived_at, policy_type
  on public.personalised_automation_policies
  for each row
  execute function public.enforce_personalised_automation_policy_overlap_from_policy();

grant all on table public.spelling_bee_results to anon;
grant all on table public.spelling_bee_results to authenticated;
grant all on table public.spelling_bee_results to service_role;
