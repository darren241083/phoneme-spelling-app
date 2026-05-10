begin;

alter table public.personalised_generation_run_pupils
  drop constraint if exists personalised_generation_run_pupils_status_check;

alter table public.personalised_generation_run_pupils
  add constraint personalised_generation_run_pupils_status_check
  check (
    status in (
      'included',
      'skipped',
      'waiting',
      'provisioning'
    )
  );

create or replace function public.claim_waiting_personalised_generation_run_pupil(
  requested_pupil_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  safe_pupil_id uuid := requested_pupil_id;
  pupil_school_id uuid := null;
  baseline_state jsonb := null;
  stale_before timestamptz := timezone('utc', now()) - interval '10 minutes';
  claim_result jsonb := null;
begin
  if actor_role not in ('service_role', 'postgres') and current_user <> 'postgres' then
    raise exception 'Service role is required to claim personalised provisioning rows.';
  end if;

  if safe_pupil_id is null then
    return jsonb_build_object('status', 'invalid_pupil');
  end if;

  select coalesce(p.school_id, public.default_legacy_school_id())
  into pupil_school_id
  from public.pupils as p
  where p.id = safe_pupil_id
    and p.is_active is true
    and p.archived_at is null
  limit 1;

  if pupil_school_id is null then
    return jsonb_build_object('status', 'invalid_pupil');
  end if;

  baseline_state := public.read_pupil_baseline_gate_state(safe_pupil_id, 'core_v2');
  if coalesce(baseline_state ->> 'status', '') <> 'ready' then
    return jsonb_build_object('status', 'not_ready');
  end if;

  if exists (
    select 1
    from public.pupil_classes as pupil_class
    inner join public.assignments_v2 as assignment
      on assignment.class_id = pupil_class.class_id
    left join public.assignment_pupil_statuses as status_row
      on status_row.assignment_id = assignment.id
     and status_row.pupil_id = safe_pupil_id
    where pupil_class.pupil_id = safe_pupil_id
      and pupil_class.active is true
      and coalesce(pupil_class.school_id, public.default_legacy_school_id()) = pupil_school_id
      and coalesce(assignment.school_id, public.default_legacy_school_id()) = pupil_school_id
      and lower(btrim(coalesce(assignment.automation_kind, ''))) = 'personalised'
      and lower(btrim(coalesce(assignment.automation_source, ''))) = 'manual_run_now'
      and (
        status_row.assignment_id is null
        or (
          status_row.completed_at is null
          and lower(btrim(coalesce(status_row.status, 'assigned'))) <> 'completed'
        )
      )
      and (
        status_row.assignment_id is not null
        or exists (
          select 1
          from public.assignment_pupil_target_words as target_word
          where target_word.assignment_id = assignment.id
            and target_word.pupil_id = safe_pupil_id
            and coalesce(target_word.school_id, public.default_legacy_school_id()) = pupil_school_id
        )
      )
  ) then
    return jsonb_build_object('status', 'already_active');
  end if;

  if exists (
    select 1
    from public.personalised_generation_run_pupils as run_pupil
    where run_pupil.pupil_id = safe_pupil_id
      and lower(btrim(coalesce(run_pupil.status, ''))) = 'provisioning'
      and coalesce(run_pupil.school_id, public.default_legacy_school_id()) = pupil_school_id
      and run_pupil.updated_at >= stale_before
  ) then
    return jsonb_build_object('status', 'already_provisioning');
  end if;

  with candidate as (
    select
      run_pupil.id,
      run_pupil.run_id,
      run_pupil.class_id,
      run_pupil.pupil_id,
      run_pupil.school_id,
      run_row.automation_policy_id
    from public.personalised_generation_run_pupils as run_pupil
    inner join public.personalised_generation_runs as run_row
      on run_row.id = run_pupil.run_id
    inner join public.personalised_automation_policies as policy_row
      on policy_row.id = run_row.automation_policy_id
    where run_pupil.pupil_id = safe_pupil_id
      and (
        lower(btrim(coalesce(run_pupil.status, ''))) = 'waiting'
        or (
          lower(btrim(coalesce(run_pupil.status, ''))) = 'provisioning'
          and run_pupil.updated_at < stale_before
        )
      )
      and coalesce(run_pupil.school_id, public.default_legacy_school_id()) = pupil_school_id
      and coalesce(run_row.school_id, public.default_legacy_school_id()) = pupil_school_id
      and coalesce(policy_row.school_id, public.default_legacy_school_id()) = pupil_school_id
      and lower(btrim(coalesce(run_row.status, ''))) = 'completed'
      and lower(btrim(coalesce(run_row.run_source, ''))) = 'manual_run_now'
      and coalesce(nullif(lower(btrim(coalesce(run_row.policy_type, ''))), ''), 'regular_personalised') = 'regular_personalised'
      and policy_row.active is true
      and policy_row.archived_at is null
      and policy_row.start_date <= current_date
      and (policy_row.end_date is null or policy_row.end_date >= current_date)
      and coalesce(nullif(lower(btrim(coalesce(policy_row.policy_type, ''))), ''), 'regular_personalised') = 'regular_personalised'
      and coalesce(nullif(to_jsonb(policy_row) ->> 'deleted_at', ''), '') = ''
      and coalesce(nullif(to_jsonb(policy_row) ->> 'deleted_by', ''), '') = ''
      and not coalesce(
        case
          when to_jsonb(policy_row) ? 'deleted' then (to_jsonb(policy_row) ->> 'deleted')::boolean
          when to_jsonb(policy_row) ? 'is_deleted' then (to_jsonb(policy_row) ->> 'is_deleted')::boolean
          else false
        end,
        false
      )
      and exists (
        select 1
        from public.personalised_automation_policy_targets as policy_target
        inner join public.pupil_classes as pupil_class
          on pupil_class.class_id = policy_target.class_id
         and pupil_class.pupil_id = safe_pupil_id
         and pupil_class.active is true
        inner join public.classes as target_class
          on target_class.id = policy_target.class_id
        where policy_target.policy_id = policy_row.id
          and policy_target.class_id = run_pupil.class_id
          and coalesce(policy_target.school_id, public.default_legacy_school_id()) = pupil_school_id
          and coalesce(pupil_class.school_id, public.default_legacy_school_id()) = pupil_school_id
          and coalesce(target_class.school_id, public.default_legacy_school_id()) = pupil_school_id
          and coalesce(nullif(lower(btrim(coalesce(target_class.class_type, ''))), ''), 'form') = 'form'
      )
    order by run_row.created_at desc, run_pupil.created_at desc, run_pupil.id
    for update of run_pupil skip locked
    limit 1
  ),
  claimed as (
    update public.personalised_generation_run_pupils as run_pupil
    set status = 'provisioning',
        assignment_id = null,
        updated_at = timezone('utc', now())
    from candidate
    where run_pupil.id = candidate.id
    returning
      run_pupil.id,
      run_pupil.run_id,
      candidate.automation_policy_id,
      run_pupil.class_id,
      run_pupil.pupil_id,
      coalesce(run_pupil.school_id, pupil_school_id) as school_id
  )
  select jsonb_build_object(
    'status', 'claimed',
    'run_pupil_id', claimed.id,
    'run_id', claimed.run_id,
    'policy_id', claimed.automation_policy_id,
    'class_id', claimed.class_id,
    'pupil_id', claimed.pupil_id,
    'school_id', claimed.school_id
  )
  into claim_result
  from claimed;

  return coalesce(claim_result, jsonb_build_object('status', 'nothing_waiting'));
end;
$$;

create or replace function public.complete_waiting_personalised_generation_run_pupil(
  claimed_run_pupil_id uuid,
  created_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  claimed_row record;
  assignment_row record;
begin
  if actor_role not in ('service_role', 'postgres') and current_user <> 'postgres' then
    raise exception 'Service role is required to complete personalised provisioning rows.';
  end if;

  if claimed_run_pupil_id is null or created_assignment_id is null then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  select
    run_pupil.*,
    coalesce(run_pupil.school_id, public.default_legacy_school_id()) as resolved_school_id
  into claimed_row
  from public.personalised_generation_run_pupils as run_pupil
  where run_pupil.id = claimed_run_pupil_id
  for update;

  if claimed_row.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if lower(btrim(coalesce(claimed_row.status, ''))) <> 'provisioning' then
    return jsonb_build_object(
      'status', 'not_provisioning',
      'current_status', claimed_row.status
    );
  end if;

  select assignment.*
  into assignment_row
  from public.assignments_v2 as assignment
  where assignment.id = created_assignment_id
    and assignment.teacher_id = claimed_row.teacher_id
    and assignment.class_id = claimed_row.class_id
    and assignment.automation_run_id = claimed_row.run_id
    and lower(btrim(coalesce(assignment.automation_kind, ''))) = 'personalised'
    and lower(btrim(coalesce(assignment.automation_source, ''))) = 'manual_run_now'
    and coalesce(assignment.school_id, public.default_legacy_school_id()) = claimed_row.resolved_school_id
  limit 1;

  if assignment_row.id is null then
    return jsonb_build_object('status', 'invalid_assignment');
  end if;

  update public.personalised_generation_run_pupils
  set status = 'included',
      assignment_id = created_assignment_id,
      skip_reason = null,
      updated_at = timezone('utc', now())
  where id = claimed_run_pupil_id;

  return jsonb_build_object(
    'status', 'completed',
    'run_pupil_id', claimed_run_pupil_id,
    'assignment_id', created_assignment_id
  );
end;
$$;

create or replace function public.release_waiting_personalised_generation_run_pupil(
  claimed_run_pupil_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  claimed_row record;
begin
  if actor_role not in ('service_role', 'postgres') and current_user <> 'postgres' then
    raise exception 'Service role is required to release personalised provisioning rows.';
  end if;

  if claimed_run_pupil_id is null then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  select *
  into claimed_row
  from public.personalised_generation_run_pupils
  where id = claimed_run_pupil_id
  for update;

  if claimed_row.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if lower(btrim(coalesce(claimed_row.status, ''))) <> 'provisioning' then
    return jsonb_build_object(
      'status', 'not_provisioning',
      'current_status', claimed_row.status
    );
  end if;

  update public.personalised_generation_run_pupils
  set status = 'waiting',
      assignment_id = null,
      updated_at = timezone('utc', now())
  where id = claimed_run_pupil_id;

  return jsonb_build_object(
    'status', 'released',
    'run_pupil_id', claimed_run_pupil_id
  );
end;
$$;

comment on function public.claim_waiting_personalised_generation_run_pupil(uuid)
  is 'Service-role coordination RPC for claiming a baseline-ready waiting personalised run-pupil row for server-side provisioning.';

comment on function public.complete_waiting_personalised_generation_run_pupil(uuid, uuid)
  is 'Service-role coordination RPC for finalising a claimed personalised provisioning row after assignment creation.';

comment on function public.release_waiting_personalised_generation_run_pupil(uuid)
  is 'Service-role coordination RPC for returning a claimed personalised provisioning row to waiting after a recoverable failure.';

revoke all on function public.claim_waiting_personalised_generation_run_pupil(uuid) from public;
revoke all on function public.claim_waiting_personalised_generation_run_pupil(uuid) from anon;
revoke all on function public.claim_waiting_personalised_generation_run_pupil(uuid) from authenticated;
grant execute on function public.claim_waiting_personalised_generation_run_pupil(uuid) to service_role;

revoke all on function public.complete_waiting_personalised_generation_run_pupil(uuid, uuid) from public;
revoke all on function public.complete_waiting_personalised_generation_run_pupil(uuid, uuid) from anon;
revoke all on function public.complete_waiting_personalised_generation_run_pupil(uuid, uuid) from authenticated;
grant execute on function public.complete_waiting_personalised_generation_run_pupil(uuid, uuid) to service_role;

revoke all on function public.release_waiting_personalised_generation_run_pupil(uuid) from public;
revoke all on function public.release_waiting_personalised_generation_run_pupil(uuid) from anon;
revoke all on function public.release_waiting_personalised_generation_run_pupil(uuid) from authenticated;
grant execute on function public.release_waiting_personalised_generation_run_pupil(uuid) to service_role;

commit;
