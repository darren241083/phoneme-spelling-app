begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(21);

create temporary table tenant_foundation_target_tables (
  table_name text primary key
) on commit drop;

create temporary table tenant_foundation_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table tenant_foundation_checks (
  name text primary key,
  bool_value boolean,
  int_value integer,
  uuid_value uuid,
  json_value jsonb,
  text_value text
) on commit drop;

grant select on table tenant_foundation_target_tables to public;
grant select on table tenant_foundation_ids to public;
grant select, insert, update, delete on table tenant_foundation_checks to public;

insert into tenant_foundation_target_tables (table_name)
select unnest(array[
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
]);

insert into tenant_foundation_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'teacher_a',
  'admin_user',
  'class_a',
  'pupil_a',
  'test_group_a',
  'test_a',
  'word_a',
  'word_b',
  'question_a',
  'assignment_v1_a',
  'assignment_v2_a',
  'status_a',
  'target_word_a',
  'override_a',
  'attempt_a',
  'policy_a',
  'policy_target_a',
  'policy_event_a',
  'run_a',
  'run_pupil_a',
  'thread_a',
  'message_a',
  'staff_profile_a',
  'pending_approval_a',
  'pending_audit_a',
  'pending_role_a',
  'pending_scope_a',
  'spelling_bee_result_a',
  'teacher_group_value_a',
  'phonics_exception_a',
  'phonics_log_a',
  'school_membership_check'
]) as names(name);

insert into tenant_foundation_checks (name, uuid_value)
select 'legacy_school_id', id
from public.schools
where slug = 'legacy-default';

insert into tenant_foundation_checks (name, bool_value)
values
  (
    'target_tables_have_school_id',
    not exists (
      select 1
      from tenant_foundation_target_tables as target
      where not exists (
        select 1
        from information_schema.columns as column_info
        where column_info.table_schema = 'public'
          and column_info.table_name = target.table_name
          and column_info.column_name = 'school_id'
      )
    )
  ),
  (
    'school_id_columns_remain_nullable',
    not exists (
      select 1
      from tenant_foundation_target_tables as target
      inner join information_schema.columns as column_info
        on column_info.table_schema = 'public'
       and column_info.table_name = target.table_name
       and column_info.column_name = 'school_id'
      where column_info.is_nullable <> 'YES'
    )
  ),
  (
    'school_memberships_table_exists',
    to_regclass('public.school_memberships') is not null
  ),
  (
    'anon_school_memberships_select_revoked',
    not has_table_privilege('anon', 'public.school_memberships', 'select')
  ),
  (
    'anon_schools_select_revoked',
    not has_table_privilege('anon', 'public.schools', 'select')
  );

do $$
declare
  target record;
  null_count integer := 0;
  total_nulls integer := 0;
begin
  for target in select table_name from tenant_foundation_target_tables loop
    execute format('select count(*) from public.%I where school_id is null', target.table_name)
    into null_count;
    total_nulls := total_nulls + null_count;
  end loop;

  insert into tenant_foundation_checks (name, bool_value, int_value)
  values ('initial_target_rows_backfilled', total_nulls = 0, total_nulls);
end $$;

do $$
declare
  legacy_school_id uuid := (select uuid_value from tenant_foundation_checks where name = 'legacy_school_id');
  teacher_a_id uuid := (select id from tenant_foundation_ids where name = 'teacher_a');
  admin_user_id uuid := (select id from tenant_foundation_ids where name = 'admin_user');
  class_a_id uuid := (select id from tenant_foundation_ids where name = 'class_a');
  pupil_a_id uuid := (select id from tenant_foundation_ids where name = 'pupil_a');
  test_group_a_id uuid := (select id from tenant_foundation_ids where name = 'test_group_a');
  test_a_id uuid := (select id from tenant_foundation_ids where name = 'test_a');
  word_a_id uuid := (select id from tenant_foundation_ids where name = 'word_a');
  question_a_id uuid := (select id from tenant_foundation_ids where name = 'question_a');
  assignment_v1_a_id uuid := (select id from tenant_foundation_ids where name = 'assignment_v1_a');
  assignment_v2_a_id uuid := (select id from tenant_foundation_ids where name = 'assignment_v2_a');
  status_a_id uuid := (select id from tenant_foundation_ids where name = 'status_a');
  target_word_a_id uuid := (select id from tenant_foundation_ids where name = 'target_word_a');
  override_a_id uuid := (select id from tenant_foundation_ids where name = 'override_a');
  attempt_a_id uuid := (select id from tenant_foundation_ids where name = 'attempt_a');
  policy_a_id uuid := (select id from tenant_foundation_ids where name = 'policy_a');
  policy_target_a_id uuid := (select id from tenant_foundation_ids where name = 'policy_target_a');
  policy_event_a_id uuid := (select id from tenant_foundation_ids where name = 'policy_event_a');
  run_a_id uuid := (select id from tenant_foundation_ids where name = 'run_a');
  run_pupil_a_id uuid := (select id from tenant_foundation_ids where name = 'run_pupil_a');
  thread_a_id uuid := (select id from tenant_foundation_ids where name = 'thread_a');
  message_a_id uuid := (select id from tenant_foundation_ids where name = 'message_a');
  staff_profile_a_id uuid := (select id from tenant_foundation_ids where name = 'staff_profile_a');
  pending_approval_a_id uuid := (select id from tenant_foundation_ids where name = 'pending_approval_a');
  pending_audit_a_id uuid := (select id from tenant_foundation_ids where name = 'pending_audit_a');
  pending_role_a_id uuid := (select id from tenant_foundation_ids where name = 'pending_role_a');
  pending_scope_a_id uuid := (select id from tenant_foundation_ids where name = 'pending_scope_a');
  spelling_bee_result_a_id uuid := (select id from tenant_foundation_ids where name = 'spelling_bee_result_a');
  teacher_group_value_a_id uuid := (select id from tenant_foundation_ids where name = 'teacher_group_value_a');
  phonics_exception_a_id uuid := (select id from tenant_foundation_ids where name = 'phonics_exception_a');
  phonics_log_a_id uuid := (select id from tenant_foundation_ids where name = 'phonics_log_a');
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
  values
    (teacher_a_id, 'authenticated', 'authenticated', 'pgtap-tenant-teacher-' || substr(replace(teacher_a_id::text, '-', ''), 1, 10) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
    (admin_user_id, 'authenticated', 'authenticated', 'pgtap-tenant-admin-' || substr(replace(admin_user_id::text, '-', ''), 1, 10) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()))
  on conflict (id) do nothing;

  insert into public.teachers (id, display_name)
  values
    (teacher_a_id, 'pgTAP Tenant Teacher'),
    (admin_user_id, 'pgTAP Tenant Admin');

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values
    (teacher_a_id, 'teacher', true, admin_user_id),
    (admin_user_id, 'admin', true, admin_user_id);

  insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by)
  values
    (admin_user_id, 'admin', 'school', 'default', true, admin_user_id);

  insert into public.teacher_app_roles (teacher_id, app_role)
  values (admin_user_id, 'central_owner');

  insert into public.staff_profiles (id, user_id, email, display_name, profile_source)
  values (
    staff_profile_a_id,
    teacher_a_id,
    'pgtap-tenant-profile-' || substr(replace(staff_profile_a_id::text, '-', ''), 1, 10) || '@example.test',
    'pgTAP Tenant Profile',
    'self_service'
  );

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values (
    class_a_id,
    teacher_a_id,
    'pgTAP Tenant Class',
    upper(substr(replace(class_a_id::text, '-', ''), 1, 6)),
    'Year 7',
    'form'
  );

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
  values (
    pupil_a_id,
    'TENANT-MIS-' || substr(replace(pupil_a_id::text, '-', ''), 1, 10),
    'Tenant',
    'Pupil',
    'tenant.pupil.' || substr(replace(pupil_a_id::text, '-', ''), 1, 8),
    '1234',
    false,
    true
  );

  insert into public.pupil_classes (pupil_id, class_id, active)
  values (pupil_a_id, class_a_id, true);

  insert into public.test_groups (id, teacher_id, name)
  values (test_group_a_id, teacher_a_id, 'pgTAP Tenant Group');

  insert into public.tests (id, teacher_id, title, group_id, status, question_type)
  values (test_a_id, teacher_a_id, 'pgTAP Tenant Test', test_group_a_id, 'published', 'full_recall');

  insert into public.test_words (id, test_id, position, word, sentence, segments, choice)
  values (
    word_a_id,
    test_a_id,
    1,
    'phase',
    'A phase sentence.',
    '["ph","a","se"]'::jsonb,
    '{"source":"teacher"}'::jsonb
  );

  insert into public.test_questions (id, test_id, position, type, prompt_text, answer_text)
  values (question_a_id, test_a_id, 1, 'spell_from_audio', 'Spell phase', 'phase');

  insert into public.assignments (id, teacher_id, class_id, test_id)
  values (assignment_v1_a_id, teacher_a_id, class_a_id, test_a_id);

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts)
  values (assignment_v2_a_id, teacher_a_id, class_a_id, test_a_id, 'practice', 2);

  insert into public.assignment_pupil_statuses (
    id,
    teacher_id,
    assignment_id,
    class_id,
    test_id,
    pupil_id,
    status,
    total_words,
    correct_words,
    average_attempts,
    score_rate,
    result_json
  )
  values (
    status_a_id,
    teacher_a_id,
    assignment_v2_a_id,
    class_a_id,
    test_a_id,
    pupil_a_id,
    'assigned',
    1,
    0,
    0,
    0,
    '[]'::jsonb
  );

  insert into public.assignment_pupil_target_words (
    id,
    teacher_id,
    assignment_id,
    pupil_id,
    test_word_id,
    focus_grapheme
  )
  values (target_word_a_id, teacher_a_id, assignment_v2_a_id, pupil_a_id, word_a_id, 'ph');

  insert into public.assignment_pupil_overrides (id, assignment_id, pupil_id, question_type)
  values (override_a_id, assignment_v2_a_id, pupil_a_id, 'full_recall');

  insert into public.attempts (
    id,
    assignment_id,
    pupil_id,
    test_id,
    test_word_id,
    typed,
    mode,
    correct,
    attempt_number,
    word_text,
    attempt_source
  )
  values (
    attempt_a_id,
    assignment_v1_a_id,
    pupil_a_id,
    test_a_id,
    word_a_id,
    'phase',
    'practice',
    true,
    1,
    'phase',
    'assignment'
  );

  insert into public.class_auto_assignment_policies (
    teacher_id,
    class_id,
    assignment_length,
    support_preset
  )
  values (teacher_a_id, class_a_id, 10, 'balanced');

  insert into public.personalised_automation_policies (
    id,
    teacher_id,
    active,
    assignment_length,
    support_preset,
    frequency,
    start_date,
    created_by,
    updated_by,
    name
  )
  values (
    policy_a_id,
    teacher_a_id,
    true,
    10,
    'balanced',
    'weekly',
    current_date,
    admin_user_id,
    admin_user_id,
    'pgTAP Tenant Policy'
  );

  insert into public.personalised_automation_policy_targets (
    id,
    policy_id,
    teacher_id,
    class_id
  )
  values (policy_target_a_id, policy_a_id, teacher_a_id, class_a_id);

  insert into public.personalised_automation_policy_events (
    id,
    teacher_id,
    policy_id,
    actor_id,
    event_type
  )
  values (policy_event_a_id, teacher_a_id, policy_a_id, admin_user_id, 'created');

  insert into public.personalised_generation_runs (
    id,
    teacher_id,
    assignment_length,
    support_preset,
    selected_class_ids,
    class_count,
    included_pupil_count,
    skipped_pupil_count,
    automation_policy_id
  )
  values (
    run_a_id,
    teacher_a_id,
    10,
    'balanced',
    to_jsonb(array[class_a_id::text]),
    1,
    1,
    0,
    policy_a_id
  );

  insert into public.personalised_generation_run_pupils (
    id,
    run_id,
    teacher_id,
    class_id,
    pupil_id,
    assignment_id,
    status
  )
  values (run_pupil_a_id, run_a_id, teacher_a_id, class_a_id, pupil_a_id, assignment_v2_a_id, 'included');

  insert into public.teacher_ai_threads (id, teacher_id, title)
  values (thread_a_id, teacher_a_id, 'pgTAP Tenant Thread');

  insert into public.teacher_ai_messages (id, thread_id, teacher_id, role, text)
  values (message_a_id, thread_a_id, teacher_a_id, 'user', 'Show me the class summary.');

  insert into public.staff_access_audit_log (
    actor_user_id,
    target_user_id,
    action,
    role
  )
  values (admin_user_id, teacher_a_id, 'grant_role', 'teacher');

  insert into public.staff_directory_audit_log (
    actor_user_id,
    target_profile_id,
    target_user_id,
    action
  )
  values (admin_user_id, staff_profile_a_id, teacher_a_id, 'archive');

  insert into public.staff_import_batches (actor_user_id, file_name)
  values (admin_user_id, 'tenant-staff.csv');

  insert into public.staff_pending_access_approvals (
    id,
    staff_profile_id,
    status,
    approved_email,
    approved_by
  )
  values (
    pending_approval_a_id,
    staff_profile_a_id,
    'approved',
    'pending-' || substr(replace(pending_approval_a_id::text, '-', ''), 1, 10) || '@example.test',
    admin_user_id
  );

  insert into public.staff_pending_access_audit_log (
    id,
    actor_user_id,
    staff_profile_id,
    approval_id,
    action
  )
  values (pending_audit_a_id, admin_user_id, staff_profile_a_id, pending_approval_a_id, 'approve');

  insert into public.staff_pending_role_assignments (id, approval_id, role)
  values (pending_role_a_id, pending_approval_a_id, 'teacher');

  insert into public.staff_pending_scope_assignments (
    id,
    approval_id,
    role,
    scope_type,
    scope_value
  )
  values (pending_scope_a_id, pending_approval_a_id, 'teacher', 'school', 'default');

  insert into public.pupil_import_batches (actor_user_id, file_name)
  values (admin_user_id, 'tenant-pupils.csv');

  insert into public.pupil_directory_audit_log (
    actor_user_id,
    target_pupil_id,
    action
  )
  values (admin_user_id, pupil_a_id, 'reset_pin');

  insert into public.teacher_pupil_group_values (
    id,
    teacher_id,
    pupil_id,
    group_type,
    group_value
  )
  values (teacher_group_value_a_id, teacher_a_id, pupil_a_id, 'support', 'wave_1');

  insert into public.phonics_exceptions (
    id,
    teacher_id,
    word,
    normalized_word,
    grapheme_data_json
  )
  values (phonics_exception_a_id, teacher_a_id, 'phase', 'phase', '{}'::jsonb);

  insert into public.phonics_correction_logs (
    id,
    teacher_id,
    word,
    normalized_word,
    correction_type,
    correction_signature
  )
  values (phonics_log_a_id, teacher_a_id, 'phase', 'phase', 'manual', 'phase:manual');

  insert into public.spelling_bee_results (
    id,
    teacher_id,
    run_id,
    assignment_id,
    test_id,
    class_id,
    pupil_id,
    streak,
    rounds_attempted,
    max_rounds
  )
  values (
    spelling_bee_result_a_id,
    teacher_a_id,
    run_a_id,
    assignment_v2_a_id,
    test_a_id,
    class_a_id,
    pupil_a_id,
    1,
    1,
    10
  );

  insert into tenant_foundation_checks (name, bool_value)
  values (
    'compat_insert_without_school_id_succeeded',
    exists (
      select 1
      from public.assignments_v2
      where id = assignment_v2_a_id
    )
  );

  perform public.backfill_legacy_school_ids();
  perform public.backfill_legacy_school_memberships();

  insert into public.test_words (id, test_id, position, word, sentence, segments, choice)
  values (
    (select id from tenant_foundation_ids where name = 'word_b'),
    test_a_id,
    2,
    'scope',
    'A scope sentence.',
    '["s","c","o","pe"]'::jsonb,
    '{"source":"teacher"}'::jsonb
  );

  insert into tenant_foundation_checks (name, bool_value)
  values
    (
      'root_rows_backfilled',
      exists (select 1 from public.teachers where id = teacher_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.classes where id = class_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.pupils where id = pupil_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.tests where id = test_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.assignments_v2 where id = assignment_v2_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.staff_profiles where id = staff_profile_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.personalised_automation_policies where id = policy_a_id and school_id = legacy_school_id)
    ),
    (
      'child_rows_inherited_or_defaulted',
      exists (select 1 from public.pupil_classes where pupil_id = pupil_a_id and class_id = class_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.test_words where id = word_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.test_questions where id = question_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.assignment_pupil_statuses where id = status_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.assignment_pupil_target_words where id = target_word_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.assignment_pupil_overrides where id = override_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.attempts where id = attempt_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.personalised_automation_policy_targets where id = policy_target_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.personalised_automation_policy_events where id = policy_event_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.personalised_generation_run_pupils where id = run_pupil_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.teacher_ai_messages where id = message_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.staff_pending_access_approvals where id = pending_approval_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.staff_pending_access_audit_log where id = pending_audit_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.staff_pending_role_assignments where id = pending_role_a_id and school_id = legacy_school_id)
      and exists (select 1 from public.staff_pending_scope_assignments where id = pending_scope_a_id and school_id = legacy_school_id)
    ),
    (
      'spelling_bee_result_has_school_id',
      exists (
        select 1
        from public.spelling_bee_results
        where id = spelling_bee_result_a_id
          and school_id = legacy_school_id
      )
    ),
    (
      'seeded_staff_memberships_backfilled',
      exists (
        select 1
        from public.school_memberships
        where school_id = legacy_school_id
          and user_id = teacher_a_id
          and active is true
      )
      and exists (
        select 1
        from public.school_memberships
        where school_id = legacy_school_id
          and user_id = admin_user_id
          and active is true
      )
    ),
    (
      'limited_trigger_fills_new_child_school_id',
      exists (
        select 1
        from public.test_words
        where id = (select id from tenant_foundation_ids where name = 'word_b')
          and school_id = legacy_school_id
      )
    );
end;
$$;

insert into tenant_foundation_checks (name, bool_value)
values
  (
    'global_uniques_still_exist',
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.classes'::regclass
        and conname = 'classes_join_code_key'
        and contype = 'u'
    )
    and exists (
      select 1
      from pg_constraint
      where conrelid = 'public.pupils'::regclass
        and conname = 'pupils_username_key'
        and contype = 'u'
    )
    and exists (
      select 1
      from pg_constraint
      where conrelid = 'public.pupils'::regclass
        and conname = 'pupils_mis_id_key'
        and contype = 'u'
    )
  ),
  (
    'anon_pupil_classes_select_still_revoked',
    not has_table_privilege('anon', 'public.pupil_classes', 'select')
  ),
  (
    'anon_test_words_select_still_revoked',
    not has_table_privilege('anon', 'public.test_words', 'select')
  ),
  (
    'anon_runtime_rpc_execute_kept',
    has_function_privilege('anon', 'public.read_pupil_runtime_assignments(uuid)', 'execute')
  );

insert into tenant_foundation_checks (name, int_value)
select
  'school_id_fk_count',
  count(*)::integer
from pg_constraint as constraint_info
inner join tenant_foundation_target_tables as target
  on constraint_info.conrelid = format('public.%I', target.table_name)::regclass
 and constraint_info.conname = target.table_name || '_school_id_fkey'
where constraint_info.contype = 'f';

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);

set local role anon;

insert into tenant_foundation_checks (name, json_value)
values (
  'runtime_payload',
  public.read_pupil_runtime_assignments((select id from tenant_foundation_ids where name = 'pupil_a'))
);

reset role;

select is(
  (select count(*)::integer from public.schools where slug = 'legacy-default' and is_legacy_default is true),
  1,
  'default legacy school exists exactly once'
);
select ok((select bool_value from tenant_foundation_checks where name = 'school_memberships_table_exists'), 'school_memberships table exists');
select ok((select bool_value from tenant_foundation_checks where name = 'target_tables_have_school_id'), 'all Phase 1 target tables have school_id');
select ok((select bool_value from tenant_foundation_checks where name = 'initial_target_rows_backfilled'), 'pre-existing target rows were backfilled');
select ok((select bool_value from tenant_foundation_checks where name = 'school_id_columns_remain_nullable'), 'existing-table school_id columns remain nullable');
select ok((select bool_value from tenant_foundation_checks where name = 'anon_school_memberships_select_revoked'), 'anon cannot directly select school_memberships');
select ok((select bool_value from tenant_foundation_checks where name = 'anon_schools_select_revoked'), 'anon cannot directly select schools');
select ok((select bool_value from tenant_foundation_checks where name = 'compat_insert_without_school_id_succeeded'), 'single-school inserts still work without school_id');
select ok((select bool_value from tenant_foundation_checks where name = 'root_rows_backfilled'), 'legacy backfill populates representative root rows');
select ok((select bool_value from tenant_foundation_checks where name = 'child_rows_inherited_or_defaulted'), 'limited inheritance populates representative child rows');
select ok((select bool_value from tenant_foundation_checks where name = 'spelling_bee_result_has_school_id'), 'spelling_bee_results gets school_id');
select ok((select bool_value from tenant_foundation_checks where name = 'seeded_staff_memberships_backfilled'), 'legacy staff memberships are created for seeded users');
select ok((select bool_value from tenant_foundation_checks where name = 'limited_trigger_fills_new_child_school_id'), 'child trigger fills school_id when omitted');
select ok((select bool_value from tenant_foundation_checks where name = 'global_uniques_still_exist'), 'existing global unique constraints remain');
select is(
  (select int_value from tenant_foundation_checks where name = 'school_id_fk_count'),
  (select count(*)::integer from tenant_foundation_target_tables),
  'all Phase 1 target tables have school_id foreign keys'
);
select ok((select bool_value from tenant_foundation_checks where name = 'anon_pupil_classes_select_still_revoked'), 'anon direct pupil_classes select remains revoked');
select ok((select bool_value from tenant_foundation_checks where name = 'anon_test_words_select_still_revoked'), 'anon direct test_words select remains revoked');
select ok((select bool_value from tenant_foundation_checks where name = 'anon_runtime_rpc_execute_kept'), 'anon can still execute pupil runtime assignments RPC');
select is((select json_value ->> 'status' from tenant_foundation_checks where name = 'runtime_payload'), 'ok', 'runtime RPC still returns ok');
select ok(
  exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from tenant_foundation_checks where name = 'runtime_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from tenant_foundation_ids where name = 'assignment_v2_a')
  ),
  'runtime RPC still includes assigned class work'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from tenant_foundation_checks where name = 'runtime_payload')) as assignment_row(value)
    cross join jsonb_array_elements(assignment_row.value -> 'words') as word_row(value)
    where assignment_row.value ->> 'id' = (select id::text from tenant_foundation_ids where name = 'assignment_v2_a')
      and word_row.value ->> 'word' = 'phase'
  ),
  'runtime RPC still includes assignment words'
);

select * from finish();

rollback;
