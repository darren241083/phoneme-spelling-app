begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(53);

create temporary table support_ladder_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table support_ladder_checks (
  name text primary key,
  bool_value boolean,
  int_value integer,
  numeric_value double precision,
  text_value text,
  json_value jsonb
) on commit drop;

grant select on table support_ladder_ids to public;
grant select, insert, update, delete on table support_ladder_checks to public;

insert into support_ladder_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'teacher',
  'class',
  'pupil',
  'legacy_test',
  'ladder_test',
  'legacy_word',
  'ladder_word',
  'legacy_assignment',
  'ladder_assignment',
  'authoritative_legacy_assignment',
  'closed_incomplete_assignment',
  'closed_completed_assignment',
  'extra_unlinked_assignment',
  'extra_linked_assignment',
  'legacy_attempt',
  'ladder_attempt',
  'access_attempt'
]) as names(name);

create or replace function pg_temp.try_insert_test(
  requested_delivery_model text,
  requested_support_preset text
) returns boolean
language plpgsql
security invoker
set search_path to public, pg_temp
as $$
begin
  insert into public.tests (
    teacher_id,
    title,
    status,
    question_type,
    delivery_model,
    support_preset
  )
  values (
    (select id from support_ladder_ids where name = 'teacher'),
    'pgTAP Support Ladder Invalid Test ' || gen_random_uuid()::text,
    'draft',
    'full_recall',
    requested_delivery_model,
    requested_support_preset
  );
  return true;
exception
  when check_violation then
    return false;
end;
$$;

create or replace function pg_temp.try_insert_assignment(
  requested_delivery_model text,
  requested_support_preset text
) returns boolean
language plpgsql
security invoker
set search_path to public, pg_temp
as $$
begin
  insert into public.assignments_v2 (
    teacher_id,
    class_id,
    test_id,
    mode,
    max_attempts,
    delivery_model,
    support_preset
  )
  values (
    (select id from support_ladder_ids where name = 'teacher'),
    (select id from support_ladder_ids where name = 'class'),
    (select id from support_ladder_ids where name = 'legacy_test'),
    'test',
    2,
    requested_delivery_model,
    requested_support_preset
  );
  return true;
exception
  when check_violation then
    return false;
end;
$$;

create or replace function pg_temp.try_insert_attempt(
  requested_delivery_model text,
  requested_support_state text,
  requested_evidence_category text,
  requested_support_actions jsonb
) returns boolean
language plpgsql
security invoker
set search_path to public, pg_temp
as $$
begin
  insert into public.attempts (
    assignment_id,
    pupil_id,
    test_id,
    test_word_id,
    typed,
    mode,
    correct,
    is_correct,
    attempt_number,
    attempt_no,
    delivery_model,
    support_state,
    evidence_category,
    support_actions
  )
  values (
    (select id from support_ladder_ids where name = 'ladder_assignment'),
    (select id from support_ladder_ids where name = 'pupil'),
    (select id from support_ladder_ids where name = 'ladder_test'),
    (select id from support_ladder_ids where name = 'ladder_word'),
    'phase',
    'full_recall',
    true,
    true,
    1,
    1,
    requested_delivery_model,
    requested_support_state,
    requested_evidence_category,
    requested_support_actions
  );
  return true;
exception
  when check_violation then
    return false;
end;
$$;

create or replace function pg_temp.try_insert_status_summary(
  requested_independent_count integer,
  requested_headline_attempted integer,
  requested_headline_correct integer,
  requested_headline_rate double precision
) returns boolean
language plpgsql
security invoker
set search_path to public, pg_temp
as $$
begin
  insert into public.assignment_pupil_statuses (
    teacher_id,
    assignment_id,
    class_id,
    test_id,
    pupil_id,
    status,
    independent_first_correct_words,
    headline_attempted_words,
    headline_correct_words,
    headline_score_rate
  )
  values (
    (select id from support_ladder_ids where name = 'teacher'),
    (select id from support_ladder_ids where name = 'extra_unlinked_assignment'),
    (select id from support_ladder_ids where name = 'class'),
    (select id from support_ladder_ids where name = 'legacy_test'),
    (select id from support_ladder_ids where name = 'pupil'),
    'assigned',
    requested_independent_count,
    requested_headline_attempted,
    requested_headline_correct,
    requested_headline_rate
  );
  return true;
exception
  when check_violation then
    return false;
end;
$$;

do $$
declare
  teacher_id uuid := (select id from support_ladder_ids where name = 'teacher');
  class_id uuid := (select id from support_ladder_ids where name = 'class');
  pupil_id uuid := (select id from support_ladder_ids where name = 'pupil');
  legacy_test_id uuid := (select id from support_ladder_ids where name = 'legacy_test');
  ladder_test_id uuid := (select id from support_ladder_ids where name = 'ladder_test');
  legacy_word_id uuid := (select id from support_ladder_ids where name = 'legacy_word');
  ladder_word_id uuid := (select id from support_ladder_ids where name = 'ladder_word');
  legacy_assignment_id uuid := (select id from support_ladder_ids where name = 'legacy_assignment');
  ladder_assignment_id uuid := (select id from support_ladder_ids where name = 'ladder_assignment');
  authoritative_legacy_assignment_id uuid := (select id from support_ladder_ids where name = 'authoritative_legacy_assignment');
  closed_incomplete_assignment_id uuid := (select id from support_ladder_ids where name = 'closed_incomplete_assignment');
  closed_completed_assignment_id uuid := (select id from support_ladder_ids where name = 'closed_completed_assignment');
  extra_unlinked_assignment_id uuid := (select id from support_ladder_ids where name = 'extra_unlinked_assignment');
  extra_linked_assignment_id uuid := (select id from support_ladder_ids where name = 'extra_linked_assignment');
begin
  perform set_config('request.jwt.claim.sub', teacher_id::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', teacher_id::text, 'role', 'service_role')::text,
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
    teacher_id,
    'authenticated',
    'authenticated',
    'pgtap-support-ladder-' || substr(replace(teacher_id::text, '-', ''), 1, 10) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do nothing;

  insert into public.teachers (id, display_name)
  values (teacher_id, 'pgTAP Support Ladder Teacher');

  insert into public.classes (
    id,
    teacher_id,
    name,
    join_code,
    year_group,
    class_type
  )
  values (
    class_id,
    teacher_id,
    'pgTAP Support Ladder Form',
    upper(substr(replace(class_id::text, '-', ''), 1, 6)),
    'Year 7',
    'form'
  );

  insert into public.tests (
    id,
    teacher_id,
    title,
    status,
    question_type
  )
  values (
    legacy_test_id,
    teacher_id,
    'pgTAP Legacy Test',
    'published',
    'full_recall'
  );

  insert into public.tests (
    id,
    teacher_id,
    title,
    status,
    question_type,
    delivery_model,
    support_preset
  )
  values (
    ladder_test_id,
    teacher_id,
    'pgTAP Ladder Authoring Test',
    'published',
    'full_recall',
    'support_ladder',
    'balanced'
  );

  insert into public.test_words (
    id,
    test_id,
    position,
    word,
    sentence,
    segments,
    choice
  )
  values
    (
      legacy_word_id,
      legacy_test_id,
      1,
      'plain',
      'A plain sentence.',
      '["pl","ai","n"]'::jsonb,
      '{"source":"teacher"}'::jsonb
    ),
    (
      ladder_word_id,
      ladder_test_id,
      1,
      'phase',
      'A phase sentence.',
      '["ph","a","se"]'::jsonb,
      '{"source":"teacher"}'::jsonb
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
    pupil_id,
    'SUPPORT-' || substr(replace(pupil_id::text, '-', ''), 1, 10),
    'Support',
    'Pupil',
    'support.pupil.' || substr(replace(pupil_id::text, '-', ''), 1, 8),
    '1111',
    false,
    true
  );

  insert into public.pupil_classes (pupil_id, class_id, active)
  values (pupil_id, class_id, true);

  insert into public.assignments_v2 (
    id,
    teacher_id,
    class_id,
    test_id,
    mode,
    max_attempts,
    created_at
  )
  values
    (
      legacy_assignment_id,
      teacher_id,
      class_id,
      legacy_test_id,
      'test',
      2,
      timezone('utc', now()) - interval '20 minutes'
    ),
    (
      authoritative_legacy_assignment_id,
      teacher_id,
      class_id,
      ladder_test_id,
      'test',
      2,
      timezone('utc', now()) - interval '15 minutes'
    );

  insert into public.assignments_v2 (
    id,
    teacher_id,
    class_id,
    test_id,
    mode,
    max_attempts,
    delivery_model,
    support_preset,
    created_at
  )
  values (
    ladder_assignment_id,
    teacher_id,
    class_id,
    ladder_test_id,
    'test',
    3,
    'support_ladder',
    'balanced',
    timezone('utc', now()) - interval '10 minutes'
  );

  insert into public.assignments_v2 (
    id,
    teacher_id,
    class_id,
    test_id,
    mode,
    max_attempts,
    end_at,
    created_at
  )
  values
    (
      closed_incomplete_assignment_id,
      teacher_id,
      class_id,
      legacy_test_id,
      'test',
      2,
      timezone('utc', now()) - interval '1 hour',
      timezone('utc', now()) - interval '2 hours'
    ),
    (
      closed_completed_assignment_id,
      teacher_id,
      class_id,
      legacy_test_id,
      'test',
      2,
      timezone('utc', now()) - interval '1 hour',
      timezone('utc', now()) - interval '2 hours'
    );

  insert into public.assignments_v2 (
    id,
    teacher_id,
    class_id,
    test_id,
    mode,
    max_attempts,
    evidence_source,
    created_at
  )
  values
    (
      extra_unlinked_assignment_id,
      teacher_id,
      class_id,
      legacy_test_id,
      'test',
      2,
      'extra_challenge',
      timezone('utc', now()) - interval '8 minutes'
    ),
    (
      extra_linked_assignment_id,
      teacher_id,
      class_id,
      legacy_test_id,
      'test',
      2,
      'extra_challenge',
      timezone('utc', now()) - interval '7 minutes'
    );

  insert into public.assignment_pupil_target_words (
    teacher_id,
    assignment_id,
    pupil_id,
    test_word_id,
    focus_grapheme,
    target_source,
    target_reason
  )
  values (
    teacher_id,
    extra_linked_assignment_id,
    pupil_id,
    legacy_word_id,
    'ai',
    'extra_challenge_v1',
    'post_core_challenge'
  );

  insert into public.assignment_pupil_statuses (
    teacher_id,
    assignment_id,
    class_id,
    test_id,
    pupil_id,
    status,
    started_at,
    completed_at,
    total_words,
    correct_words,
    average_attempts,
    score_rate,
    result_json,
    independent_first_correct_words,
    self_corrected_words,
    supported_correct_words,
    supported_incorrect_words,
    access_issue_words,
    headline_attempted_words,
    headline_correct_words,
    headline_score_rate
  )
  values (
    teacher_id,
    ladder_assignment_id,
    class_id,
    ladder_test_id,
    pupil_id,
    'completed',
    timezone('utc', now()) - interval '6 minutes',
    timezone('utc', now()) - interval '5 minutes',
    5,
    4,
    2,
    0.8,
    '[{"word":"phase","correct":true}]'::jsonb,
    1,
    1,
    1,
    1,
    1,
    4,
    1,
    0.25
  );

  insert into public.assignment_pupil_statuses (
    teacher_id,
    assignment_id,
    class_id,
    test_id,
    pupil_id,
    status,
    started_at,
    completed_at,
    total_words,
    correct_words,
    average_attempts,
    score_rate,
    result_json
  )
  values (
    teacher_id,
    closed_completed_assignment_id,
    class_id,
    legacy_test_id,
    pupil_id,
    'completed',
    timezone('utc', now()) - interval '90 minutes',
    timezone('utc', now()) - interval '75 minutes',
    1,
    1,
    1,
    1,
    '[{"word":"plain","correct":true}]'::jsonb
  );

  insert into public.attempts (
    id,
    assignment_id,
    pupil_id,
    test_id,
    test_word_id,
    typed,
    mode,
    correct,
    is_correct,
    attempt_number,
    attempt_no
  )
  values (
    (select id from support_ladder_ids where name = 'legacy_attempt'),
    legacy_assignment_id,
    pupil_id,
    legacy_test_id,
    legacy_word_id,
    'plain',
    'full_recall',
    true,
    true,
    1,
    1
  );

  insert into public.attempts (
    id,
    assignment_id,
    pupil_id,
    test_id,
    test_word_id,
    typed,
    mode,
    correct,
    is_correct,
    attempt_number,
    attempt_no,
    delivery_model,
    support_state,
    evidence_category,
    support_actions
  )
  values
    (
      (select id from support_ladder_ids where name = 'ladder_attempt'),
      ladder_assignment_id,
      pupil_id,
      ladder_test_id,
      ladder_word_id,
      'phase',
      'full_recall',
      true,
      true,
      2,
      2,
      'support_ladder',
      'retry',
      'correct_after_retry',
      '["replay_word"]'::jsonb
    ),
    (
      (select id from support_ladder_ids where name = 'access_attempt'),
      ladder_assignment_id,
      pupil_id,
      ladder_test_id,
      ladder_word_id,
      '',
      'full_recall',
      null,
      null,
      1,
      1,
      'support_ladder',
      'access_issue',
      'access_issue',
      '["clarification_sentence"]'::jsonb
    );
end;
$$;

insert into support_ladder_checks (name, bool_value)
values
  (
    'tests_delivery_default_not_null',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tests'
        and column_name = 'delivery_model'
        and is_nullable = 'NO'
        and column_default = '''legacy_fixed''::text'
    )
  ),
  (
    'assignments_delivery_default_not_null',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'assignments_v2'
        and column_name = 'delivery_model'
        and is_nullable = 'NO'
        and column_default = '''legacy_fixed''::text'
    )
  ),
  (
    'attempts_delivery_default_not_null',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'attempts'
        and column_name = 'delivery_model'
        and is_nullable = 'NO'
        and column_default = '''legacy_fixed''::text'
    )
  ),
  (
    'status_summary_columns_nullable',
    (
      select count(*) = 8
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'assignment_pupil_statuses'
        and column_name in (
          'independent_first_correct_words',
          'self_corrected_words',
          'supported_correct_words',
          'supported_incorrect_words',
          'access_issue_words',
          'headline_attempted_words',
          'headline_correct_words',
          'headline_score_rate'
        )
        and is_nullable = 'YES'
    )
  ),
  (
    'attempt_evidence_columns_nullable',
    (
      select count(*) = 3
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'attempts'
        and column_name in ('support_state', 'evidence_category', 'support_actions')
        and is_nullable = 'YES'
    )
  ),
  (
    'attempt_correctness_nullable',
    (
      select count(*) = 2
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'attempts'
        and column_name in ('correct', 'is_correct')
        and is_nullable = 'YES'
    )
  ),
  (
    'invalid_test_delivery_rejected',
    not pg_temp.try_insert_test('unknown_model', null)
  ),
  (
    'invalid_assignment_delivery_rejected',
    not pg_temp.try_insert_assignment('unknown_model', null)
  ),
  (
    'invalid_attempt_delivery_rejected',
    not pg_temp.try_insert_attempt('unknown_model', null, null, null)
  ),
  (
    'invalid_test_preset_rejected',
    not pg_temp.try_insert_test('legacy_fixed', 'unknown_preset')
  ),
  (
    'invalid_assignment_preset_rejected',
    not pg_temp.try_insert_assignment('legacy_fixed', 'unknown_preset')
  ),
  (
    'ladder_test_requires_preset',
    not pg_temp.try_insert_test('support_ladder', null)
  ),
  (
    'ladder_assignment_requires_preset',
    not pg_temp.try_insert_assignment('support_ladder', null)
  ),
  (
    'invalid_support_state_rejected',
    not pg_temp.try_insert_attempt('support_ladder', 'unknown_state', 'correct_first_time', '[]'::jsonb)
  ),
  (
    'invalid_evidence_category_rejected',
    not pg_temp.try_insert_attempt('support_ladder', 'independent', 'unknown_category', '[]'::jsonb)
  ),
  (
    'non_array_support_actions_rejected',
    not pg_temp.try_insert_attempt('support_ladder', 'independent', 'correct_first_time', '{}'::jsonb)
  ),
  (
    'negative_status_count_rejected',
    not pg_temp.try_insert_status_summary(-1, 1, 1, 1)
  ),
  (
    'headline_correct_above_attempted_rejected',
    not pg_temp.try_insert_status_summary(1, 1, 2, 1)
  ),
  (
    'headline_rate_above_one_rejected',
    not pg_temp.try_insert_status_summary(1, 1, 1, 1.1)
  ),
  (
    'anon_runtime_execute_kept',
    has_function_privilege('anon', 'public.read_pupil_runtime_assignments(uuid)', 'execute')
  ),
  (
    'anon_baseline_execute_kept',
    has_function_privilege('anon', 'public.read_pupil_baseline_gate_state(uuid,text)', 'execute')
  ),
  (
    'anon_attempt_select_insert_kept',
    has_table_privilege('anon', 'public.attempts', 'select')
      and has_table_privilege('anon', 'public.attempts', 'insert')
  ),
  (
    'anon_attempt_update_delete_still_revoked',
    not has_table_privilege('anon', 'public.attempts', 'update')
      and not has_table_privilege('anon', 'public.attempts', 'delete')
  ),
  (
    'authenticated_end_at_update_kept',
    has_column_privilege('authenticated', 'public.assignments_v2', 'end_at', 'update')
  ),
  (
    'authenticated_delivery_model_update_not_granted',
    not has_column_privilege('authenticated', 'public.assignments_v2', 'delivery_model', 'update')
  ),
  (
    'attempt_select_policy_preserved',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'attempts'
        and policyname = 'Anon can view assignment-scoped attempts'
        and position('can_access_pupil_assignment_runtime' in coalesce(qual, '')) > 0
    )
  ),
  (
    'attempt_insert_policy_preserved',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'attempts'
        and policyname = 'Anon can insert attempts'
        and position('can_access_pupil_assignment_runtime' in coalesce(with_check, '')) > 0
    )
  ),
  (
    'status_select_policy_preserved',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'assignment_pupil_statuses'
        and policyname = 'Anon can view assignment pupil statuses'
        and position('can_access_pupil_assignment_runtime' in coalesce(qual, '')) > 0
    )
  );

insert into support_ladder_checks (name, text_value)
values
  (
    'legacy_test_delivery',
    (
      select delivery_model
      from public.tests
      where id = (select id from support_ladder_ids where name = 'legacy_test')
    )
  ),
  (
    'legacy_assignment_delivery',
    (
      select delivery_model
      from public.assignments_v2
      where id = (select id from support_ladder_ids where name = 'legacy_assignment')
    )
  ),
  (
    'authoritative_assignment_delivery',
    (
      select delivery_model
      from public.assignments_v2
      where id = (select id from support_ladder_ids where name = 'authoritative_legacy_assignment')
    )
  ),
  (
    'legacy_attempt_delivery',
    (
      select delivery_model
      from public.attempts
      where id = (select id from support_ladder_ids where name = 'legacy_attempt')
    )
  );

insert into support_ladder_checks (name, bool_value)
values
  (
    'legacy_attempt_details_null',
    exists (
      select 1
      from public.attempts
      where id = (select id from support_ladder_ids where name = 'legacy_attempt')
        and support_state is null
        and evidence_category is null
        and support_actions is null
    )
  ),
  (
    'ladder_attempt_round_trips',
    exists (
      select 1
      from public.attempts
      where id = (select id from support_ladder_ids where name = 'ladder_attempt')
        and delivery_model = 'support_ladder'
        and support_state = 'retry'
        and evidence_category = 'correct_after_retry'
        and support_actions = '["replay_word"]'::jsonb
        and correct is true
        and is_correct is true
    )
  ),
  (
    'access_issue_allows_null_correctness',
    exists (
      select 1
      from public.attempts
      where id = (select id from support_ladder_ids where name = 'access_attempt')
        and delivery_model = 'support_ladder'
        and support_state = 'access_issue'
        and evidence_category = 'access_issue'
        and correct is null
        and is_correct is null
    )
  ),
  (
    'status_raw_and_headline_metrics_separate',
    exists (
      select 1
      from public.assignment_pupil_statuses
      where assignment_id = (select id from support_ladder_ids where name = 'ladder_assignment')
        and pupil_id = (select id from support_ladder_ids where name = 'pupil')
        and total_words = 5
        and correct_words = 4
        and score_rate = 0.8
        and headline_attempted_words = 4
        and headline_correct_words = 1
        and headline_score_rate = 0.25
        and independent_first_correct_words = 1
        and self_corrected_words = 1
        and supported_correct_words = 1
        and supported_incorrect_words = 1
        and access_issue_words = 1
    )
  ),
  (
    'baseline_created_as_legacy',
    not exists (
      select 1
      from public.assignments_v2 as assignment
      inner join public.test_words as word
        on word.test_id = assignment.test_id
      where assignment.class_id = (select id from support_ladder_ids where name = 'class')
        and (
          lower(btrim(coalesce(word.choice ->> 'source', ''))) in ('baseline_v1', 'baseline_v2')
          or nullif(btrim(coalesce(word.choice ->> 'baseline_standard_key', '')), '') is not null
        )
        and (
          assignment.delivery_model <> 'legacy_fixed'
          or assignment.support_preset is not null
        )
    )
  );

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);

set local role anon;

insert into support_ladder_checks (name, json_value)
values
  (
    'runtime_payload',
    public.read_pupil_runtime_assignments(
      (select id from support_ladder_ids where name = 'pupil')
    )
  ),
  (
    'baseline_payload',
    public.read_pupil_baseline_gate_state(
      (select id from support_ladder_ids where name = 'pupil'),
      'core_v2'
    )
  );

insert into support_ladder_checks (name, bool_value)
values
  (
    'extra_linked_access',
    public.can_access_pupil_assignment_runtime(
      (select id from support_ladder_ids where name = 'pupil'),
      (select id from support_ladder_ids where name = 'extra_linked_assignment')
    )
  ),
  (
    'extra_unlinked_access',
    public.can_access_pupil_assignment_runtime(
      (select id from support_ladder_ids where name = 'pupil'),
      (select id from support_ladder_ids where name = 'extra_unlinked_assignment')
    )
  ),
  (
    'closed_incomplete_access',
    public.can_access_pupil_assignment_runtime(
      (select id from support_ladder_ids where name = 'pupil'),
      (select id from support_ladder_ids where name = 'closed_incomplete_assignment')
    )
  ),
  (
    'closed_completed_access',
    public.can_access_pupil_assignment_runtime(
      (select id from support_ladder_ids where name = 'pupil'),
      (select id from support_ladder_ids where name = 'closed_completed_assignment')
    )
  );

reset role;

select ok(
  (select bool_value from support_ladder_checks where name = 'tests_delivery_default_not_null'),
  'tests.delivery_model defaults to legacy_fixed and is not null'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'assignments_delivery_default_not_null'),
  'assignments_v2.delivery_model defaults to legacy_fixed and is not null'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'attempts_delivery_default_not_null'),
  'attempts.delivery_model defaults to legacy_fixed and is not null'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'status_summary_columns_nullable'),
  'all support-ladder status summary columns are nullable'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'attempt_evidence_columns_nullable'),
  'attempt support/evidence details remain nullable'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'attempt_correctness_nullable'),
  'attempt correctness columns already allow null'
);
select is(
  (select text_value from support_ladder_checks where name = 'legacy_test_delivery'),
  'legacy_fixed',
  'test insert without a delivery model resolves to legacy_fixed'
);
select is(
  (select text_value from support_ladder_checks where name = 'legacy_assignment_delivery'),
  'legacy_fixed',
  'assignment insert without a delivery model resolves to legacy_fixed'
);
select is(
  (select text_value from support_ladder_checks where name = 'authoritative_assignment_delivery'),
  'legacy_fixed',
  'assignment delivery remains authoritative when its test authoring default is support_ladder'
);
select is(
  (select text_value from support_ladder_checks where name = 'legacy_attempt_delivery'),
  'legacy_fixed',
  'attempt insert without a delivery model resolves to legacy_fixed'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'legacy_attempt_details_null'),
  'legacy attempts do not receive invented support or evidence details'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'invalid_test_delivery_rejected'),
  'tests reject an invalid delivery model'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'invalid_assignment_delivery_rejected'),
  'assignments reject an invalid delivery model'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'invalid_attempt_delivery_rejected'),
  'attempts reject an invalid delivery model'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'invalid_test_preset_rejected'),
  'tests reject an invalid support preset'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'invalid_assignment_preset_rejected'),
  'assignments reject an invalid support preset'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'ladder_test_requires_preset'),
  'support-ladder tests require a support preset'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'ladder_assignment_requires_preset'),
  'support-ladder assignments require a support preset'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'invalid_support_state_rejected'),
  'attempts reject an invalid support state'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'invalid_evidence_category_rejected'),
  'attempts reject an invalid evidence category'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'non_array_support_actions_rejected'),
  'attempts reject non-array support actions'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'ladder_attempt_round_trips'),
  'complete support-ladder attempt evidence can be inserted and read'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'access_issue_allows_null_correctness'),
  'access issues can be stored with null correctness'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'status_raw_and_headline_metrics_separate'),
  'status rows keep raw and headline/category summaries separate'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'negative_status_count_rejected'),
  'negative support-ladder summary counts are rejected'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'headline_correct_above_attempted_rejected'),
  'headline correct count cannot exceed headline attempted count'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'headline_rate_above_one_rejected'),
  'headline score rate must be between zero and one'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'anon_runtime_execute_kept'),
  'anon runtime RPC execute privilege is unchanged'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'anon_baseline_execute_kept'),
  'anon baseline RPC execute privilege is unchanged'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'anon_attempt_select_insert_kept'),
  'anon attempt select and insert privileges are unchanged'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'anon_attempt_update_delete_still_revoked'),
  'anon attempt update and delete privileges remain revoked'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'authenticated_end_at_update_kept'),
  'authenticated end_at update privilege remains available'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'authenticated_delivery_model_update_not_granted'),
  'authenticated users are not granted delivery_model update access'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'attempt_select_policy_preserved'),
  'assignment-scoped anon attempt select policy is preserved'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'attempt_insert_policy_preserved'),
  'anon attempt insert policy is preserved'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'status_select_policy_preserved'),
  'anon assignment status select policy is preserved'
);
select is(
  (select json_value ->> 'status' from support_ladder_checks where name = 'runtime_payload'),
  'ok',
  'pupil runtime RPC remains available'
);
select is(
  (
    select assignment_row.value ->> 'delivery_model'
    from jsonb_array_elements(
      (select json_value -> 'assignments' from support_ladder_checks where name = 'runtime_payload')
    ) as assignment_row(value)
    where assignment_row.value ->> 'id' = (
      select id::text from support_ladder_ids where name = 'ladder_assignment'
    )
  ),
  'support_ladder',
  'runtime payload exposes assignment delivery_model'
);
select is(
  (
    select assignment_row.value ->> 'support_preset'
    from jsonb_array_elements(
      (select json_value -> 'assignments' from support_ladder_checks where name = 'runtime_payload')
    ) as assignment_row(value)
    where assignment_row.value ->> 'id' = (
      select id::text from support_ladder_ids where name = 'ladder_assignment'
    )
  ),
  'balanced',
  'runtime payload exposes assignment support_preset'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements(
      (select json_value -> 'assignments' from support_ladder_checks where name = 'runtime_payload')
    ) as assignment_row(value)
    where assignment_row.value ->> 'id' = (
      select id::text from support_ladder_ids where name = 'ladder_assignment'
    )
      and (assignment_row.value ->> 'correct_words')::integer = 4
      and (assignment_row.value ->> 'score_rate')::double precision = 0.8
      and (assignment_row.value ->> 'headline_attempted_words')::integer = 4
      and (assignment_row.value ->> 'headline_correct_words')::integer = 1
      and (assignment_row.value ->> 'headline_score_rate')::double precision = 0.25
      and (assignment_row.value ->> 'access_issue_words')::integer = 1
  ),
  'runtime payload exposes headline/category summaries without replacing raw metrics'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements(
      (select json_value -> 'assignments' from support_ladder_checks where name = 'runtime_payload')
    ) as assignment_row(value)
    where assignment_row.value ->> 'id' = (
      select id::text from support_ladder_ids where name = 'authoritative_legacy_assignment'
    )
      and assignment_row.value ->> 'delivery_model' = 'legacy_fixed'
      and assignment_row.value -> 'support_preset' = 'null'::jsonb
  ),
  'runtime uses assignment legacy defaults rather than test authoring defaults'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements(
      (select json_value -> 'assignments' from support_ladder_checks where name = 'runtime_payload')
    ) as assignment_row(value)
    where assignment_row.value ->> 'id' = (
      select id::text from support_ladder_ids where name = 'extra_linked_assignment'
    )
      and assignment_row.value ->> 'evidence_source' = 'extra_challenge'
      and assignment_row.value ->> 'attempt_source' = 'extra_challenge'
      and assignment_row.value ->> 'delivery_model' = 'legacy_fixed'
  ),
  'linked Extra Challenge keeps source separation and legacy delivery'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      (select json_value -> 'assignments' from support_ladder_checks where name = 'runtime_payload')
    ) as assignment_row(value)
    where assignment_row.value ->> 'id' = (
      select id::text from support_ladder_ids where name = 'extra_unlinked_assignment'
    )
  ),
  'unlinked Extra Challenge remains hidden'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      (select json_value -> 'assignments' from support_ladder_checks where name = 'runtime_payload')
    ) as assignment_row(value)
    where assignment_row.value ->> 'id' = (
      select id::text from support_ladder_ids where name = 'closed_incomplete_assignment'
    )
  ),
  'ended incomplete assignment remains hidden'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements(
      (select json_value -> 'assignments' from support_ladder_checks where name = 'runtime_payload')
    ) as assignment_row(value)
    where assignment_row.value ->> 'id' = (
      select id::text from support_ladder_ids where name = 'closed_completed_assignment'
    )
      and (assignment_row.value ->> 'completed')::boolean is true
      and (assignment_row.value ->> 'isLocked')::boolean is true
      and assignment_row.value ->> 'delivery_model' = 'legacy_fixed'
  ),
  'ended completed assignment remains visible and locked'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'extra_linked_access')
    and not (select bool_value from support_ladder_checks where name = 'extra_unlinked_access'),
  'Extra Challenge runtime access scoping is unchanged'
);
select ok(
  not (select bool_value from support_ladder_checks where name = 'closed_incomplete_access')
    and (select bool_value from support_ladder_checks where name = 'closed_completed_access'),
  'end_at runtime access behavior is unchanged'
);
select ok(
  (select json_value ->> 'status' from support_ladder_checks where name = 'baseline_payload') in ('start', 'resume'),
  'baseline gate remains startable or resumable'
);
select is(
  (select json_value #>> '{assignment,delivery_model}' from support_ladder_checks where name = 'baseline_payload'),
  'legacy_fixed',
  'baseline payload exposes legacy_fixed delivery'
);
select ok(
  (select json_value #> '{assignment,support_preset}' from support_ladder_checks where name = 'baseline_payload') = 'null'::jsonb,
  'baseline payload exposes a null support preset'
);
select ok(
  (select json_value #> '{assignment}' from support_ladder_checks where name = 'baseline_payload')
    ?& array[
      'independent_first_correct_words',
      'self_corrected_words',
      'supported_correct_words',
      'supported_incorrect_words',
      'access_issue_words',
      'headline_attempted_words',
      'headline_correct_words',
      'headline_score_rate'
    ],
  'baseline payload exposes nullable support-ladder summary fields'
);
select ok(
  (select json_value #>> '{assignment,attempt_source}' from support_ladder_checks where name = 'baseline_payload') = 'baseline'
    and (select (json_value #>> '{assignment,is_baseline}')::boolean from support_ladder_checks where name = 'baseline_payload') is true,
  'baseline identity and behavior are unchanged'
);
select ok(
  (select bool_value from support_ladder_checks where name = 'baseline_created_as_legacy'),
  'baseline assignment creation still produces legacy/default rows'
);

select * from finish();

rollback;
