create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  is_legacy_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint schools_slug_not_blank check (btrim(slug) <> ''),
  constraint schools_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists schools_slug_key
  on public.schools (slug);

create unique index if not exists schools_one_legacy_default_idx
  on public.schools (is_legacy_default)
  where is_legacy_default is true;

insert into public.schools (slug, name, is_legacy_default)
values ('legacy-default', 'Legacy School', true)
on conflict (slug) do update
set
  name = excluded.name,
  is_legacy_default = true,
  updated_at = timezone('utc', now());

create table if not exists public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  source text not null default 'legacy_backfill',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_memberships_source_check
    check (source in ('legacy_backfill', 'manual', 'import', 'system'))
);

create unique index if not exists idx_school_memberships_active_unique
  on public.school_memberships (school_id, user_id)
  where active is true;

create index if not exists idx_school_memberships_user_active
  on public.school_memberships (user_id, active);

alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;

revoke all on table public.schools from anon;
revoke all on table public.school_memberships from anon;
revoke all on table public.school_memberships from authenticated;
grant select on table public.schools to authenticated;
grant all on table public.schools to service_role;
grant all on table public.school_memberships to service_role;

do $$
declare
  target_table text;
  target_tables text[] := array[
    'teachers',
    'classes',
    'pupils',
    'pupil_classes',
    'test_groups',
    'tests',
    'test_words',
    'test_questions',
    'assignments',
    'assignments_v2',
    'assignment_pupil_statuses',
    'assignment_pupil_target_words',
    'assignment_pupil_overrides',
    'attempts',
    'spelling_bee_results',
    'class_auto_assignment_policies',
    'personalised_automation_policies',
    'personalised_automation_policy_targets',
    'personalised_automation_policy_events',
    'personalised_generation_runs',
    'personalised_generation_run_pupils',
    'teacher_ai_threads',
    'teacher_ai_messages',
    'staff_profiles',
    'staff_role_assignments',
    'staff_scope_assignments',
    'staff_access_audit_log',
    'staff_directory_audit_log',
    'staff_import_batches',
    'staff_pending_access_approvals',
    'staff_pending_access_audit_log',
    'staff_pending_role_assignments',
    'staff_pending_scope_assignments',
    'pupil_import_batches',
    'pupil_directory_audit_log',
    'teacher_app_roles',
    'teacher_pupil_group_values',
    'phonics_exceptions',
    'phonics_correction_logs'
  ];
begin
  foreach target_table in array target_tables loop
    execute format(
      'alter table public.%I add column if not exists school_id uuid',
      target_table
    );
  end loop;
end $$;

create or replace function public.default_legacy_school_id() returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select id
  from public.schools
  where slug = 'legacy-default'
  limit 1;
$$;

alter function public.default_legacy_school_id() owner to postgres;
revoke all on function public.default_legacy_school_id() from public;
grant execute on function public.default_legacy_school_id() to service_role;

create or replace function public.backfill_legacy_school_ids() returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  legacy_school_id uuid := public.default_legacy_school_id();
  changed_count integer := 0;
  total_changed integer := 0;
  target_table text;
  root_tables text[] := array[
    'teachers',
    'classes',
    'pupils',
    'staff_profiles',
    'test_groups',
    'tests',
    'assignments',
    'assignments_v2',
    'class_auto_assignment_policies',
    'personalised_automation_policies',
    'personalised_generation_runs',
    'phonics_correction_logs',
    'phonics_exceptions',
    'pupil_import_batches',
    'staff_access_audit_log',
    'staff_directory_audit_log',
    'staff_import_batches',
    'staff_role_assignments',
    'staff_scope_assignments',
    'teacher_ai_threads',
    'teacher_app_roles',
    'teacher_pupil_group_values'
  ];
begin
  if legacy_school_id is null then
    raise exception 'Default legacy school is missing.';
  end if;

  if exists (
    select 1
    from public.schools
    where slug <> 'legacy-default'
  ) then
    raise exception 'Legacy school backfill is only safe before additional schools exist.';
  end if;

  foreach target_table in array root_tables loop
    execute format(
      'update public.%I set school_id = $1 where school_id is null',
      target_table
    ) using legacy_school_id;
    get diagnostics changed_count = row_count;
    total_changed := total_changed + changed_count;
  end loop;

  update public.pupil_classes as pc
  set school_id = c.school_id
  from public.classes as c
  where pc.school_id is null
    and pc.class_id = c.id
    and c.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.pupil_classes as pc
  set school_id = p.school_id
  from public.pupils as p
  where pc.school_id is null
    and pc.pupil_id = p.id
    and p.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.test_words as tw
  set school_id = t.school_id
  from public.tests as t
  where tw.school_id is null
    and tw.test_id = t.id
    and t.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.test_questions as tq
  set school_id = t.school_id
  from public.tests as t
  where tq.school_id is null
    and tq.test_id = t.id
    and t.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.assignment_pupil_statuses as aps
  set school_id = a.school_id
  from public.assignments_v2 as a
  where aps.school_id is null
    and aps.assignment_id = a.id
    and a.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.assignment_pupil_target_words as aptw
  set school_id = a.school_id
  from public.assignments_v2 as a
  where aptw.school_id is null
    and aptw.assignment_id = a.id
    and a.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.assignment_pupil_overrides as apo
  set school_id = a.school_id
  from public.assignments_v2 as a
  where apo.school_id is null
    and apo.assignment_id = a.id
    and a.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.attempts as at
  set school_id = a.school_id
  from public.assignments as a
  where at.school_id is null
    and at.assignment_id = a.id
    and a.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.attempts as at
  set school_id = t.school_id
  from public.tests as t
  where at.school_id is null
    and at.test_id = t.id
    and t.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.attempts as at
  set school_id = p.school_id
  from public.pupils as p
  where at.school_id is null
    and at.pupil_id = p.id
    and p.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.personalised_automation_policy_targets as target
  set school_id = policy.school_id
  from public.personalised_automation_policies as policy
  where target.school_id is null
    and target.policy_id = policy.id
    and policy.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.personalised_automation_policy_events as event
  set school_id = policy.school_id
  from public.personalised_automation_policies as policy
  where event.school_id is null
    and event.policy_id = policy.id
    and policy.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.personalised_generation_run_pupils as run_pupil
  set school_id = run.school_id
  from public.personalised_generation_runs as run
  where run_pupil.school_id is null
    and run_pupil.run_id = run.id
    and run.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.teacher_ai_messages as message
  set school_id = thread.school_id
  from public.teacher_ai_threads as thread
  where message.school_id is null
    and message.thread_id = thread.id
    and message.teacher_id = thread.teacher_id
    and thread.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.staff_pending_access_approvals as approval
  set school_id = profile.school_id
  from public.staff_profiles as profile
  where approval.school_id is null
    and approval.staff_profile_id = profile.id
    and profile.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.staff_pending_access_audit_log as audit
  set school_id = profile.school_id
  from public.staff_profiles as profile
  where audit.school_id is null
    and audit.staff_profile_id = profile.id
    and profile.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.staff_pending_access_audit_log as audit
  set school_id = approval.school_id
  from public.staff_pending_access_approvals as approval
  where audit.school_id is null
    and audit.approval_id = approval.id
    and approval.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.staff_pending_role_assignments as role_assignment
  set school_id = approval.school_id
  from public.staff_pending_access_approvals as approval
  where role_assignment.school_id is null
    and role_assignment.approval_id = approval.id
    and approval.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.staff_pending_scope_assignments as scope_assignment
  set school_id = approval.school_id
  from public.staff_pending_access_approvals as approval
  where scope_assignment.school_id is null
    and scope_assignment.approval_id = approval.id
    and approval.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.pupil_directory_audit_log as audit
  set school_id = p.school_id
  from public.pupils as p
  where audit.school_id is null
    and audit.target_pupil_id = p.id
    and p.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.spelling_bee_results as result
  set school_id = run.school_id
  from public.personalised_generation_runs as run
  where result.school_id is null
    and result.run_id = run.id
    and run.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.spelling_bee_results as result
  set school_id = assignment.school_id
  from public.assignments_v2 as assignment
  where result.school_id is null
    and result.assignment_id = assignment.id
    and assignment.school_id is not null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.pupil_classes set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.test_words set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.test_questions set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.assignment_pupil_statuses set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.assignment_pupil_target_words set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.assignment_pupil_overrides set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.attempts set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.personalised_automation_policy_targets set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.personalised_automation_policy_events set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.personalised_generation_run_pupils set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.teacher_ai_messages set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.staff_pending_access_approvals set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.staff_pending_access_audit_log set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.staff_pending_role_assignments set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.staff_pending_scope_assignments set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.pupil_directory_audit_log set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  update public.spelling_bee_results set school_id = legacy_school_id where school_id is null;
  get diagnostics changed_count = row_count;
  total_changed := total_changed + changed_count;

  return total_changed;
end;
$$;

alter function public.backfill_legacy_school_ids() owner to postgres;
revoke all on function public.backfill_legacy_school_ids() from public;
grant execute on function public.backfill_legacy_school_ids() to service_role;

create or replace function public.backfill_legacy_school_memberships() returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  legacy_school_id uuid := public.default_legacy_school_id();
  inserted_count integer := 0;
begin
  if legacy_school_id is null then
    raise exception 'Default legacy school is missing.';
  end if;

  with source_users as (
    select id as user_id from public.teachers
    union select teacher_id from public.classes
    union select teacher_id from public.tests
    union select teacher_id from public.test_groups
    union select teacher_id from public.assignments where teacher_id is not null
    union select teacher_id from public.assignments_v2
    union select teacher_id from public.assignment_pupil_statuses
    union select teacher_id from public.assignment_pupil_target_words
    union select teacher_id from public.class_auto_assignment_policies
    union select teacher_id from public.personalised_automation_policies
    union select created_by from public.personalised_automation_policies
    union select updated_by from public.personalised_automation_policies
    union select archived_by from public.personalised_automation_policies where archived_by is not null
    union select teacher_id from public.personalised_automation_policy_targets
    union select teacher_id from public.personalised_automation_policy_events
    union select actor_id from public.personalised_automation_policy_events
    union select teacher_id from public.personalised_generation_runs
    union select teacher_id from public.personalised_generation_run_pupils
    union select teacher_id from public.phonics_correction_logs
    union select teacher_id from public.phonics_exceptions
    union select actor_user_id from public.pupil_import_batches
    union select actor_user_id from public.pupil_directory_audit_log
    union select actor_user_id from public.staff_access_audit_log
    union select target_user_id from public.staff_access_audit_log
    union select actor_user_id from public.staff_directory_audit_log
    union select target_user_id from public.staff_directory_audit_log where target_user_id is not null
    union select actor_user_id from public.staff_import_batches
    union select approved_by from public.staff_pending_access_approvals
    union select activated_user_id from public.staff_pending_access_approvals where activated_user_id is not null
    union select cancelled_by from public.staff_pending_access_approvals where cancelled_by is not null
    union select actor_user_id from public.staff_pending_access_audit_log where actor_user_id is not null
    union select user_id from public.staff_profiles where user_id is not null
    union select user_id from public.staff_role_assignments
    union select granted_by from public.staff_role_assignments where granted_by is not null
    union select user_id from public.staff_scope_assignments
    union select granted_by from public.staff_scope_assignments where granted_by is not null
    union select teacher_id from public.teacher_ai_threads
    union select teacher_id from public.teacher_ai_messages
    union select teacher_id from public.teacher_app_roles
    union select teacher_id from public.teacher_pupil_group_values
    union select teacher_id from public.spelling_bee_results
  ),
  inserted as (
    insert into public.school_memberships (school_id, user_id, source)
    select distinct legacy_school_id, source_users.user_id, 'legacy_backfill'
    from source_users
    inner join auth.users as auth_user
      on auth_user.id = source_users.user_id
    where source_users.user_id is not null
      and not exists (
        select 1
        from public.school_memberships as existing
        where existing.school_id = legacy_school_id
          and existing.user_id = source_users.user_id
          and existing.active is true
      )
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

alter function public.backfill_legacy_school_memberships() owner to postgres;
revoke all on function public.backfill_legacy_school_memberships() from public;
grant execute on function public.backfill_legacy_school_memberships() to service_role;

create or replace function public.inherit_school_id_from_parent() returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  legacy_school_id uuid := public.default_legacy_school_id();
begin
  if new.school_id is not null then
    return new;
  end if;

  case tg_table_name
    when 'pupil_classes' then
      select c.school_id into new.school_id
      from public.classes as c
      where c.id = new.class_id;

      if new.school_id is null then
        select p.school_id into new.school_id
        from public.pupils as p
        where p.id = new.pupil_id;
      end if;

    when 'test_words' then
      select t.school_id into new.school_id
      from public.tests as t
      where t.id = new.test_id;

    when 'test_questions' then
      select t.school_id into new.school_id
      from public.tests as t
      where t.id = new.test_id;

    when 'assignment_pupil_statuses' then
      select a.school_id into new.school_id
      from public.assignments_v2 as a
      where a.id = new.assignment_id;

    when 'assignment_pupil_target_words' then
      select a.school_id into new.school_id
      from public.assignments_v2 as a
      where a.id = new.assignment_id;

    when 'assignment_pupil_overrides' then
      select a.school_id into new.school_id
      from public.assignments_v2 as a
      where a.id = new.assignment_id;

    when 'attempts' then
      select a.school_id into new.school_id
      from public.assignments as a
      where a.id = new.assignment_id;

      if new.school_id is null then
        select t.school_id into new.school_id
        from public.tests as t
        where t.id = new.test_id;
      end if;

      if new.school_id is null then
        select p.school_id into new.school_id
        from public.pupils as p
        where p.id = new.pupil_id;
      end if;

    when 'personalised_automation_policy_targets' then
      select policy.school_id into new.school_id
      from public.personalised_automation_policies as policy
      where policy.id = new.policy_id;

    when 'personalised_automation_policy_events' then
      select policy.school_id into new.school_id
      from public.personalised_automation_policies as policy
      where policy.id = new.policy_id;

    when 'personalised_generation_run_pupils' then
      select run.school_id into new.school_id
      from public.personalised_generation_runs as run
      where run.id = new.run_id;

    when 'teacher_ai_messages' then
      select thread.school_id into new.school_id
      from public.teacher_ai_threads as thread
      where thread.id = new.thread_id
        and thread.teacher_id = new.teacher_id;

    when 'staff_pending_access_approvals' then
      select profile.school_id into new.school_id
      from public.staff_profiles as profile
      where profile.id = new.staff_profile_id;

    when 'staff_pending_access_audit_log' then
      select profile.school_id into new.school_id
      from public.staff_profiles as profile
      where profile.id = new.staff_profile_id;

      if new.school_id is null then
        select approval.school_id into new.school_id
        from public.staff_pending_access_approvals as approval
        where approval.id = new.approval_id;
      end if;

    when 'staff_pending_role_assignments' then
      select approval.school_id into new.school_id
      from public.staff_pending_access_approvals as approval
      where approval.id = new.approval_id;

    when 'staff_pending_scope_assignments' then
      select approval.school_id into new.school_id
      from public.staff_pending_access_approvals as approval
      where approval.id = new.approval_id;

    when 'spelling_bee_results' then
      select run.school_id into new.school_id
      from public.personalised_generation_runs as run
      where run.id = new.run_id;

      if new.school_id is null then
        select assignment.school_id into new.school_id
        from public.assignments_v2 as assignment
        where assignment.id = new.assignment_id;
      end if;

    else
      null;
  end case;

  if new.school_id is null then
    new.school_id := legacy_school_id;
  end if;

  return new;
end;
$$;

alter function public.inherit_school_id_from_parent() owner to postgres;
revoke all on function public.inherit_school_id_from_parent() from public;
grant execute on function public.inherit_school_id_from_parent() to service_role;

drop trigger if exists trg_pupil_classes_inherit_school_id on public.pupil_classes;
create trigger trg_pupil_classes_inherit_school_id
  before insert or update of school_id, class_id, pupil_id
  on public.pupil_classes
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_test_words_inherit_school_id on public.test_words;
create trigger trg_test_words_inherit_school_id
  before insert or update of school_id, test_id
  on public.test_words
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_test_questions_inherit_school_id on public.test_questions;
create trigger trg_test_questions_inherit_school_id
  before insert or update of school_id, test_id
  on public.test_questions
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_assignment_pupil_statuses_inherit_school_id on public.assignment_pupil_statuses;
create trigger trg_assignment_pupil_statuses_inherit_school_id
  before insert or update of school_id, assignment_id
  on public.assignment_pupil_statuses
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_assignment_pupil_target_words_inherit_school_id on public.assignment_pupil_target_words;
create trigger trg_assignment_pupil_target_words_inherit_school_id
  before insert or update of school_id, assignment_id
  on public.assignment_pupil_target_words
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_assignment_pupil_overrides_inherit_school_id on public.assignment_pupil_overrides;
create trigger trg_assignment_pupil_overrides_inherit_school_id
  before insert or update of school_id, assignment_id
  on public.assignment_pupil_overrides
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_attempts_inherit_school_id on public.attempts;
create trigger trg_attempts_inherit_school_id
  before insert or update of school_id, assignment_id, test_id, pupil_id
  on public.attempts
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_personalised_automation_policy_targets_inherit_school_id on public.personalised_automation_policy_targets;
create trigger trg_personalised_automation_policy_targets_inherit_school_id
  before insert or update of school_id, policy_id
  on public.personalised_automation_policy_targets
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_personalised_automation_policy_events_inherit_school_id on public.personalised_automation_policy_events;
create trigger trg_personalised_automation_policy_events_inherit_school_id
  before insert or update of school_id, policy_id
  on public.personalised_automation_policy_events
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_personalised_generation_run_pupils_inherit_school_id on public.personalised_generation_run_pupils;
create trigger trg_personalised_generation_run_pupils_inherit_school_id
  before insert or update of school_id, run_id
  on public.personalised_generation_run_pupils
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_teacher_ai_messages_inherit_school_id on public.teacher_ai_messages;
create trigger trg_teacher_ai_messages_inherit_school_id
  before insert or update of school_id, thread_id, teacher_id
  on public.teacher_ai_messages
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_staff_pending_access_approvals_inherit_school_id on public.staff_pending_access_approvals;
create trigger trg_staff_pending_access_approvals_inherit_school_id
  before insert or update of school_id, staff_profile_id
  on public.staff_pending_access_approvals
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_staff_pending_access_audit_log_inherit_school_id on public.staff_pending_access_audit_log;
create trigger trg_staff_pending_access_audit_log_inherit_school_id
  before insert or update of school_id, staff_profile_id, approval_id
  on public.staff_pending_access_audit_log
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_staff_pending_role_assignments_inherit_school_id on public.staff_pending_role_assignments;
create trigger trg_staff_pending_role_assignments_inherit_school_id
  before insert or update of school_id, approval_id
  on public.staff_pending_role_assignments
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_staff_pending_scope_assignments_inherit_school_id on public.staff_pending_scope_assignments;
create trigger trg_staff_pending_scope_assignments_inherit_school_id
  before insert or update of school_id, approval_id
  on public.staff_pending_scope_assignments
  for each row execute function public.inherit_school_id_from_parent();

drop trigger if exists trg_spelling_bee_results_inherit_school_id on public.spelling_bee_results;
create trigger trg_spelling_bee_results_inherit_school_id
  before insert or update of school_id, run_id, assignment_id
  on public.spelling_bee_results
  for each row execute function public.inherit_school_id_from_parent();

do $$
declare
  previous_claim_role text := current_setting('request.jwt.claim.role', true);
  previous_claim_sub text := current_setting('request.jwt.claim.sub', true);
  previous_claims text := current_setting('request.jwt.claims', true);
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
  perform set_config(
    'request.jwt.claims',
    '{"role":"service_role","sub":"00000000-0000-0000-0000-000000000000"}',
    true
  );

  perform public.backfill_legacy_school_ids();
  perform public.backfill_legacy_school_memberships();

  perform set_config('request.jwt.claim.role', coalesce(previous_claim_role, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(previous_claim_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(previous_claims, ''), true);
end $$;

do $$
declare
  target_table text;
  target_tables text[] := array[
    'teachers',
    'classes',
    'pupils',
    'pupil_classes',
    'test_groups',
    'tests',
    'test_words',
    'test_questions',
    'assignments',
    'assignments_v2',
    'assignment_pupil_statuses',
    'assignment_pupil_target_words',
    'assignment_pupil_overrides',
    'attempts',
    'spelling_bee_results',
    'class_auto_assignment_policies',
    'personalised_automation_policies',
    'personalised_automation_policy_targets',
    'personalised_automation_policy_events',
    'personalised_generation_runs',
    'personalised_generation_run_pupils',
    'teacher_ai_threads',
    'teacher_ai_messages',
    'staff_profiles',
    'staff_role_assignments',
    'staff_scope_assignments',
    'staff_access_audit_log',
    'staff_directory_audit_log',
    'staff_import_batches',
    'staff_pending_access_approvals',
    'staff_pending_access_audit_log',
    'staff_pending_role_assignments',
    'staff_pending_scope_assignments',
    'pupil_import_batches',
    'pupil_directory_audit_log',
    'teacher_app_roles',
    'teacher_pupil_group_values',
    'phonics_exceptions',
    'phonics_correction_logs'
  ];
  constraint_name text;
begin
  foreach target_table in array target_tables loop
    execute format(
      'create index if not exists %I on public.%I (school_id)',
      'idx_' || target_table || '_school_id',
      target_table
    );

    constraint_name := target_table || '_school_id_fkey';

    if not exists (
      select 1
      from pg_constraint
      where conrelid = format('public.%I', target_table)::regclass
        and conname = constraint_name
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (school_id) references public.schools(id) on delete restrict not valid',
        target_table,
        constraint_name
      );
    end if;

    if exists (
      select 1
      from pg_constraint
      where conrelid = format('public.%I', target_table)::regclass
        and conname = constraint_name
        and convalidated is false
    ) then
      execute format(
        'alter table public.%I validate constraint %I',
        target_table,
        constraint_name
      );
    end if;
  end loop;
end $$;

create index if not exists idx_classes_school_teacher_type_name
  on public.classes (school_id, teacher_id, class_type, name);

create index if not exists idx_pupil_classes_school_pupil_active
  on public.pupil_classes (school_id, pupil_id, active, class_id);

create index if not exists idx_tests_school_teacher_created
  on public.tests (school_id, teacher_id, created_at desc);

create index if not exists idx_assignments_v2_school_class_created
  on public.assignments_v2 (school_id, class_id, created_at desc);

create index if not exists idx_attempts_school_pupil_created
  on public.attempts (school_id, pupil_id, created_at desc);

create index if not exists idx_spelling_bee_results_school_teacher_run
  on public.spelling_bee_results (school_id, teacher_id, run_id);
