begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(21);

create temporary table test_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table gate_states (
  name text primary key,
  state jsonb not null
) on commit drop;

create temporary table check_values (
  name text primary key,
  bool_value boolean,
  int_value integer
) on commit drop;

insert into test_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'admin_user',
  'lifecycle_pupil',
  'original_form',
  'target_form',
  'original_membership',
  'no_form_pupil',
  'no_baseline_pupil',
  'no_baseline_form',
  'filter_pupil',
  'filter_active_form',
  'filter_subject',
  'filter_ended_form',
  'legacy_pupil',
  'legacy_blank_form',
  'legacy_null_form'
]) as names(name);

do $$
declare
  admin_user_id uuid := (select id from test_ids where name = 'admin_user');
  lifecycle_pupil_id uuid := (select id from test_ids where name = 'lifecycle_pupil');
  original_form_id uuid := (select id from test_ids where name = 'original_form');
  target_form_id uuid := (select id from test_ids where name = 'target_form');
  original_membership_id uuid := (select id from test_ids where name = 'original_membership');
  no_form_pupil_id uuid := (select id from test_ids where name = 'no_form_pupil');
  no_baseline_pupil_id uuid := (select id from test_ids where name = 'no_baseline_pupil');
  no_baseline_form_id uuid := (select id from test_ids where name = 'no_baseline_form');
  filter_pupil_id uuid := (select id from test_ids where name = 'filter_pupil');
  filter_active_form_id uuid := (select id from test_ids where name = 'filter_active_form');
  filter_subject_id uuid := (select id from test_ids where name = 'filter_subject');
  filter_ended_form_id uuid := (select id from test_ids where name = 'filter_ended_form');
  legacy_pupil_id uuid := (select id from test_ids where name = 'legacy_pupil');
  legacy_blank_form_id uuid := (select id from test_ids where name = 'legacy_blank_form');
  legacy_null_form_id uuid := (select id from test_ids where name = 'legacy_null_form');
begin
  perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_user_id::text, 'role', 'service_role')::text,
    true
  );

  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    admin_user_id,
    'authenticated',
    'authenticated',
    'pgtap-' || substr(replace(admin_user_id::text, '-', ''), 1, 12) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do nothing;

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values (admin_user_id, 'admin', true, admin_user_id);

  insert into public.teachers (id, display_name)
  values (admin_user_id, 'pgTAP Admin Teacher');

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values
    (original_form_id, admin_user_id, 'pgTAP original form', upper(substr(replace(original_form_id::text, '-', ''), 1, 6)), 'Year 7', 'form'),
    (target_form_id, admin_user_id, 'pgTAP target form', upper(substr(replace(target_form_id::text, '-', ''), 1, 6)), 'Year 7', 'form'),
    (no_baseline_form_id, admin_user_id, 'pgTAP no baseline form', upper(substr(replace(no_baseline_form_id::text, '-', ''), 1, 6)), 'Year 8', 'form'),
    (filter_active_form_id, admin_user_id, 'pgTAP active filter form', upper(substr(replace(filter_active_form_id::text, '-', ''), 1, 6)), 'Year 9', 'form'),
    (filter_subject_id, admin_user_id, 'pgTAP subject filter class', upper(substr(replace(filter_subject_id::text, '-', ''), 1, 6)), 'Year 9', 'subject'),
    (filter_ended_form_id, admin_user_id, 'pgTAP ended filter form', upper(substr(replace(filter_ended_form_id::text, '-', ''), 1, 6)), 'Year 9', 'form');

  perform public.ensure_form_class_baseline_assignment_internal(target_form_id, 'core_v1');
  perform public.ensure_form_class_baseline_assignment_internal(filter_active_form_id, 'core_v1');

  insert into public.pupils (
    id,
    mis_id,
    first_name,
    surname,
    username,
    pin,
    must_reset_pin,
    is_active
  )
  values
    (lifecycle_pupil_id, 'PGTAP-' || substr(replace(lifecycle_pupil_id::text, '-', ''), 1, 12), 'Lifecycle', 'Pupil', 'pgtap.lifecycle.' || substr(replace(lifecycle_pupil_id::text, '-', ''), 1, 12), '1111', false, true),
    (no_form_pupil_id, 'PGTAP-' || substr(replace(no_form_pupil_id::text, '-', ''), 1, 12), 'Noform', 'Pupil', 'pgtap.noform.' || substr(replace(no_form_pupil_id::text, '-', ''), 1, 12), '2222', false, true),
    (no_baseline_pupil_id, 'PGTAP-' || substr(replace(no_baseline_pupil_id::text, '-', ''), 1, 12), 'Nobase', 'Pupil', 'pgtap.nobase.' || substr(replace(no_baseline_pupil_id::text, '-', ''), 1, 12), '3333', false, true),
    (filter_pupil_id, 'PGTAP-' || substr(replace(filter_pupil_id::text, '-', ''), 1, 12), 'Filter', 'Pupil', 'pgtap.filter.' || substr(replace(filter_pupil_id::text, '-', ''), 1, 12), '4444', false, true),
    (legacy_pupil_id, 'PGTAP-' || substr(replace(legacy_pupil_id::text, '-', ''), 1, 12), 'Legacy', 'Pupil', 'pgtap.legacy.' || substr(replace(legacy_pupil_id::text, '-', ''), 1, 12), '5555', false, true);

  insert into public.pupil_classes (id, pupil_id, class_id, active)
  values
    (original_membership_id, lifecycle_pupil_id, original_form_id, true),
    (gen_random_uuid(), no_baseline_pupil_id, no_baseline_form_id, true),
    (gen_random_uuid(), filter_pupil_id, filter_active_form_id, true),
    (gen_random_uuid(), filter_pupil_id, filter_subject_id, true),
    (gen_random_uuid(), filter_pupil_id, filter_ended_form_id, false);

  update public.pupil_classes
  set ended_at = coalesce(ended_at, timezone('utc', now())),
      ended_by = admin_user_id,
      ended_reason = 'pgTAP ended membership fixture'
  where pupil_id = filter_pupil_id
    and class_id = filter_ended_form_id
    and active is false;

  delete from public.assignments_v2
  where class_id = no_baseline_form_id;

  insert into gate_states (name, state)
  values
    ('no_form', public.read_pupil_baseline_gate_state(no_form_pupil_id, 'core_v1')),
    ('no_baseline', public.read_pupil_baseline_gate_state(no_baseline_pupil_id, 'core_v1')),
    ('filtering', public.read_pupil_baseline_gate_state(filter_pupil_id, 'core_v1'));

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.classes'::regclass
      and conname = 'classes_class_type_check'
  ) then
    execute 'alter table public.classes drop constraint classes_class_type_check';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'classes'
      and column_name = 'class_type'
      and is_nullable = 'NO'
  ) then
    execute 'alter table public.classes alter column class_type drop not null';
  end if;

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values
    (legacy_blank_form_id, admin_user_id, 'pgTAP blank legacy form', upper(substr(replace(legacy_blank_form_id::text, '-', ''), 1, 6)), 'Year 10', ''),
    (legacy_null_form_id, admin_user_id, 'pgTAP null legacy form', upper(substr(replace(legacy_null_form_id::text, '-', ''), 1, 6)), 'Year 10', null);

  insert into public.pupil_classes (pupil_id, class_id, active)
  values
    (legacy_pupil_id, legacy_blank_form_id, true),
    (legacy_pupil_id, legacy_null_form_id, true);

  insert into gate_states (name, state)
  values ('legacy_class_type', public.read_pupil_baseline_gate_state(legacy_pupil_id, 'core_v1'));

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_user_id::text, 'role', 'authenticated')::text,
    true
  );

  perform public.archive_pupil_directory_record(
    lifecycle_pupil_id,
    'pgTAP lifecycle regression archive'
  );

  perform public.restore_pupil_directory_record(
    lifecycle_pupil_id,
    'pgTAP lifecycle regression restore'
  );

  insert into gate_states (name, state)
  values ('after_restore', public.read_pupil_baseline_gate_state(lifecycle_pupil_id, 'core_v1'));

  insert into check_values (name, bool_value)
  select 'pupil_active_after_restore', p.is_active is true and p.archived_at is null
  from public.pupils as p
  where p.id = lifecycle_pupil_id;

  insert into check_values (name, bool_value)
  select 'old_membership_inactive_after_restore', pc.active is false
  from public.pupil_classes as pc
  where pc.id = original_membership_id;

  insert into check_values (name, bool_value)
  select 'old_membership_ended_after_restore', pc.ended_at is not null
  from public.pupil_classes as pc
  where pc.id = original_membership_id;

  insert into check_values (name, int_value)
  select 'active_form_count_after_restore', count(*)::integer
  from public.pupil_classes as pc
  inner join public.classes as c
    on c.id = pc.class_id
  where pc.pupil_id = lifecycle_pupil_id
    and pc.active is true
    and coalesce(nullif(lower(btrim(c.class_type)), ''), 'form') = 'form';

  perform public.move_pupil_form_membership(
    lifecycle_pupil_id,
    target_form_id,
    'pgTAP lifecycle regression move'
  );

  insert into gate_states (name, state)
  values ('after_move', public.read_pupil_baseline_gate_state(lifecycle_pupil_id, 'core_v1'));

  insert into check_values (name, bool_value)
  select 'target_membership_active_after_move', exists (
    select 1
    from public.pupil_classes as pc
    where pc.pupil_id = lifecycle_pupil_id
      and pc.class_id = target_form_id
      and pc.active is true
      and pc.ended_at is null
  );
end;
$$;

select is(
  (select state ->> 'status' from gate_states where name = 'after_restore'),
  'waiting',
  'restored pupil gate keeps top-level status waiting without an active form'
);

select is(
  (select state ->> 'waiting_reason' from gate_states where name = 'after_restore'),
  'no_active_form_membership',
  'restored pupil gate reports no_active_form_membership'
);

select ok(
  (select bool_value from check_values where name = 'pupil_active_after_restore'),
  'restore makes the pupil active and clears archive state'
);

select ok(
  (select bool_value from check_values where name = 'old_membership_inactive_after_restore'),
  'restore does not reactivate the previous form membership'
);

select ok(
  (select bool_value from check_values where name = 'old_membership_ended_after_restore'),
  'restore leaves the previous form membership ended'
);

select is(
  (select int_value from check_values where name = 'active_form_count_after_restore'),
  0,
  'restore does not create any live form membership'
);

select ok(
  (select bool_value from check_values where name = 'target_membership_active_after_move'),
  'move creates or reopens the requested target form membership'
);

select is(
  (select state ->> 'status' from gate_states where name = 'after_move'),
  'start',
  'moving the restored pupil into a provisioned live form yields deterministic start state'
);

select is(
  (select state ->> 'status' from gate_states where name = 'no_form'),
  'waiting',
  'no active form membership keeps top-level status waiting'
);

select is(
  (select state ->> 'waiting_reason' from gate_states where name = 'no_form'),
  'no_active_form_membership',
  'no active form membership returns the expected waiting_reason'
);

select is(
  jsonb_array_length((select state -> 'form_class_ids' from gate_states where name = 'no_form')),
  0,
  'no active form membership returns an empty form_class_ids array'
);

select is(
  (select state ->> 'status' from gate_states where name = 'no_baseline'),
  'waiting',
  'live form without a baseline assignment keeps top-level status waiting'
);

select is(
  (select state ->> 'waiting_reason' from gate_states where name = 'no_baseline'),
  'no_baseline_assignment',
  'live form without a baseline assignment returns no_baseline_assignment'
);

select ok(
  (select state -> 'form_class_ids' from gate_states where name = 'no_baseline')
    ? (select id::text from test_ids where name = 'no_baseline_form'),
  'live form without baseline still reports the active form_class_id'
);

select is(
  jsonb_array_length((select state -> 'form_class_ids' from gate_states where name = 'filtering')),
  1,
  'form_class_ids contains only active form memberships'
);

select ok(
  (select state -> 'form_class_ids' from gate_states where name = 'filtering')
    ? (select id::text from test_ids where name = 'filter_active_form'),
  'form_class_ids includes the active form membership'
);

select ok(
  not (
    (select state -> 'form_class_ids' from gate_states where name = 'filtering')
      ? (select id::text from test_ids where name = 'filter_subject')
  ),
  'form_class_ids excludes subject memberships'
);

select ok(
  not (
    (select state -> 'form_class_ids' from gate_states where name = 'filtering')
      ? (select id::text from test_ids where name = 'filter_ended_form')
  ),
  'form_class_ids excludes ended form memberships'
);

select is(
  jsonb_array_length((select state -> 'form_class_ids' from gate_states where name = 'legacy_class_type')),
  2,
  'legacy null and blank class_type memberships are both treated as forms'
);

select ok(
  (select state -> 'form_class_ids' from gate_states where name = 'legacy_class_type')
    ? (select id::text from test_ids where name = 'legacy_blank_form'),
  'blank legacy class_type is returned in form_class_ids'
);

select ok(
  (select state -> 'form_class_ids' from gate_states where name = 'legacy_class_type')
    ? (select id::text from test_ids where name = 'legacy_null_form'),
  'null legacy class_type is returned in form_class_ids'
);

select * from finish();

rollback;
