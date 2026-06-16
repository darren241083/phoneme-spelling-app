begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(33);

create temporary table runtime_assignment_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table runtime_assignment_checks (
  name text primary key,
  bool_value boolean,
  int_value integer,
  json_value jsonb,
  text_value text
) on commit drop;

grant select on table runtime_assignment_ids to public;
grant select, insert, update, delete on table runtime_assignment_checks to public;

create or replace function pg_temp.try_insert_runtime_assignment_with_source(
  requested_evidence_source text
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
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
  values (
    gen_random_uuid(),
    (select id from runtime_assignment_ids where name = 'teacher_a'),
    (select id from runtime_assignment_ids where name = 'class_a'),
    (select id from runtime_assignment_ids where name = 'test_a'),
    'practice',
    2,
    requested_evidence_source,
    timezone('utc', now())
  );

  return true;
exception
  when check_violation then
    return false;
end;
$$;

insert into runtime_assignment_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'teacher_a',
  'teacher_b',
  'class_a',
  'class_b',
  'pupil_a',
  'pupil_b',
  'pupil_c',
  'inactive_pupil',
  'test_a',
  'test_b',
  'test_mixed_baseline',
  'word_a',
  'word_b',
  'word_mixed_baseline',
  'word_mixed_teacher',
  'assignment_a',
  'assignment_b',
  'closed_incomplete_assignment',
  'closed_completed_assignment',
  'closed_mixed_baseline_assignment',
  'extra_assignment_unlinked',
  'extra_assignment_target_linked',
  'extra_assignment_status_linked'
]) as names(name);

do $$
declare
  teacher_a_id uuid := (select id from runtime_assignment_ids where name = 'teacher_a');
  teacher_b_id uuid := (select id from runtime_assignment_ids where name = 'teacher_b');
  class_a_id uuid := (select id from runtime_assignment_ids where name = 'class_a');
  class_b_id uuid := (select id from runtime_assignment_ids where name = 'class_b');
  pupil_a_id uuid := (select id from runtime_assignment_ids where name = 'pupil_a');
  pupil_b_id uuid := (select id from runtime_assignment_ids where name = 'pupil_b');
  pupil_c_id uuid := (select id from runtime_assignment_ids where name = 'pupil_c');
  inactive_pupil_id uuid := (select id from runtime_assignment_ids where name = 'inactive_pupil');
  test_a_id uuid := (select id from runtime_assignment_ids where name = 'test_a');
  test_b_id uuid := (select id from runtime_assignment_ids where name = 'test_b');
  test_mixed_baseline_id uuid := (select id from runtime_assignment_ids where name = 'test_mixed_baseline');
  word_a_id uuid := (select id from runtime_assignment_ids where name = 'word_a');
  word_b_id uuid := (select id from runtime_assignment_ids where name = 'word_b');
  word_mixed_baseline_id uuid := (select id from runtime_assignment_ids where name = 'word_mixed_baseline');
  word_mixed_teacher_id uuid := (select id from runtime_assignment_ids where name = 'word_mixed_teacher');
  assignment_a_id uuid := (select id from runtime_assignment_ids where name = 'assignment_a');
  assignment_b_id uuid := (select id from runtime_assignment_ids where name = 'assignment_b');
  closed_incomplete_assignment_id uuid := (select id from runtime_assignment_ids where name = 'closed_incomplete_assignment');
  closed_completed_assignment_id uuid := (select id from runtime_assignment_ids where name = 'closed_completed_assignment');
  closed_mixed_baseline_assignment_id uuid := (select id from runtime_assignment_ids where name = 'closed_mixed_baseline_assignment');
  extra_assignment_unlinked_id uuid := (select id from runtime_assignment_ids where name = 'extra_assignment_unlinked');
  extra_assignment_target_linked_id uuid := (select id from runtime_assignment_ids where name = 'extra_assignment_target_linked');
  extra_assignment_status_linked_id uuid := (select id from runtime_assignment_ids where name = 'extra_assignment_status_linked');
begin
  perform set_config('request.jwt.claim.sub', teacher_a_id::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', teacher_a_id::text, 'role', 'service_role')::text,
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
    (teacher_a_id, 'authenticated', 'authenticated', 'pgtap-runtime-assignments-a-' || substr(replace(teacher_a_id::text, '-', ''), 1, 10) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
    (teacher_b_id, 'authenticated', 'authenticated', 'pgtap-runtime-assignments-b-' || substr(replace(teacher_b_id::text, '-', ''), 1, 10) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()))
  on conflict (id) do nothing;

  insert into public.teachers (id, display_name)
  values
    (teacher_a_id, 'pgTAP Runtime Teacher A'),
    (teacher_b_id, 'pgTAP Runtime Teacher B');

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values
    (class_a_id, teacher_a_id, 'pgTAP Runtime Class A', upper(substr(replace(class_a_id::text, '-', ''), 1, 6)), 'Year 7', 'form'),
    (class_b_id, teacher_b_id, 'pgTAP Runtime Class B', upper(substr(replace(class_b_id::text, '-', ''), 1, 6)), 'Year 8', 'form');

  insert into public.tests (id, teacher_id, title, status, question_type)
  values
    (test_a_id, teacher_a_id, 'pgTAP Runtime Test A', 'published', 'full_recall'),
    (test_b_id, teacher_b_id, 'pgTAP Runtime Test B', 'published', 'full_recall'),
    (test_mixed_baseline_id, teacher_a_id, 'pgTAP Runtime Mixed Baseline Test', 'published', 'full_recall');

  insert into public.test_words (id, test_id, position, word, sentence, segments, choice)
  values
    (word_a_id, test_a_id, 1, 'phase', 'A phase sentence.', '["ph","a","se"]'::jsonb, '{"source":"teacher"}'::jsonb),
    (word_b_id, test_b_id, 1, 'scope', 'A scope sentence.', '["s","c","o","pe"]'::jsonb, '{"source":"teacher"}'::jsonb),
    (word_mixed_baseline_id, test_mixed_baseline_id, 1, 'plain', 'A mixed baseline sentence.', '["pl","ai","n"]'::jsonb, '{"source":"baseline_v2","baseline_standard_key":"core_v2"}'::jsonb),
    (word_mixed_teacher_id, test_mixed_baseline_id, 2, 'train', 'A mixed teacher sentence.', '["tr","ai","n"]'::jsonb, '{"source":"teacher"}'::jsonb);

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
    (pupil_a_id, 'RUNTIME-A-' || substr(replace(pupil_a_id::text, '-', ''), 1, 10), 'Runtime', 'PupilA', 'runtime.pupil.a.' || substr(replace(pupil_a_id::text, '-', ''), 1, 8), '1111', false, true),
    (pupil_b_id, 'RUNTIME-B-' || substr(replace(pupil_b_id::text, '-', ''), 1, 10), 'Runtime', 'PupilB', 'runtime.pupil.b.' || substr(replace(pupil_b_id::text, '-', ''), 1, 8), '2222', false, true),
    (pupil_c_id, 'RUNTIME-C-' || substr(replace(pupil_c_id::text, '-', ''), 1, 10), 'Runtime', 'PupilC', 'runtime.pupil.c.' || substr(replace(pupil_c_id::text, '-', ''), 1, 8), '4444', false, true),
    (inactive_pupil_id, 'RUNTIME-I-' || substr(replace(inactive_pupil_id::text, '-', ''), 1, 10), 'Runtime', 'Inactive', 'runtime.inactive.' || substr(replace(inactive_pupil_id::text, '-', ''), 1, 8), '3333', false, false);

  insert into public.pupil_classes (pupil_id, class_id, active)
  values
    (pupil_a_id, class_a_id, true),
    (pupil_b_id, class_b_id, true),
    (pupil_c_id, class_a_id, true),
    (inactive_pupil_id, class_a_id, true);

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts, created_at)
  values
    (assignment_a_id, teacher_a_id, class_a_id, test_a_id, 'practice', 2, timezone('utc', now())),
    (assignment_b_id, teacher_b_id, class_b_id, test_b_id, 'practice', 2, timezone('utc', now()));

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts, end_at, created_at)
  values
    (closed_incomplete_assignment_id, teacher_a_id, class_a_id, test_a_id, 'practice', 2, timezone('utc', now()) - interval '1 hour', timezone('utc', now()) - interval '2 hours'),
    (closed_completed_assignment_id, teacher_a_id, class_a_id, test_a_id, 'practice', 2, timezone('utc', now()) - interval '1 hour', timezone('utc', now()) - interval '2 hours'),
    (closed_mixed_baseline_assignment_id, teacher_a_id, class_a_id, test_mixed_baseline_id, 'practice', 2, timezone('utc', now()) - interval '1 hour', timezone('utc', now()) - interval '2 hours');

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
    (extra_assignment_unlinked_id, teacher_a_id, class_a_id, test_a_id, 'practice', 2, 'extra_challenge', timezone('utc', now())),
    (extra_assignment_target_linked_id, teacher_a_id, class_a_id, test_a_id, 'practice', 2, 'extra_challenge', timezone('utc', now())),
    (extra_assignment_status_linked_id, teacher_a_id, class_a_id, test_a_id, 'practice', 2, 'extra_challenge', timezone('utc', now()));

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
    teacher_a_id,
    extra_assignment_target_linked_id,
    pupil_a_id,
    word_a_id,
    'ph',
    'extra_challenge_v1',
    'post_core_challenge'
  );

  insert into public.assignment_pupil_statuses (
    teacher_id,
    assignment_id,
    class_id,
    test_id,
    pupil_id,
    status
  )
  values (
    teacher_a_id,
    extra_assignment_status_linked_id,
    class_a_id,
    test_a_id,
    pupil_a_id,
    'assigned'
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
    teacher_a_id,
    closed_completed_assignment_id,
    class_a_id,
    test_a_id,
    pupil_a_id,
    'completed',
    timezone('utc', now()) - interval '90 minutes',
    timezone('utc', now()) - interval '75 minutes',
    1,
    1,
    1,
    1,
    '[{"word":"phase","correct":true}]'::jsonb
  );
end;
$$;

insert into runtime_assignment_checks (name, bool_value)
values
  (
    'evidence_source_column_exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'assignments_v2'
        and column_name = 'evidence_source'
    )
  ),
  (
    'evidence_source_default_assigned_core',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'assignments_v2'
        and column_name = 'evidence_source'
        and column_default = '''assigned_core''::text'
    )
  ),
  (
    'evidence_source_not_null',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'assignments_v2'
        and column_name = 'evidence_source'
        and is_nullable = 'NO'
    )
  ),
  (
    'evidence_source_constraint_allows_assigned_core',
    position('assigned_core' in coalesce((
      select pg_get_constraintdef(oid)
      from pg_constraint
      where conrelid = 'public.assignments_v2'::regclass
        and conname = 'assignments_v2_evidence_source_check'
    ), '')) > 0
  ),
  (
    'evidence_source_constraint_allows_extra_challenge',
    position('extra_challenge' in coalesce((
      select pg_get_constraintdef(oid)
      from pg_constraint
      where conrelid = 'public.assignments_v2'::regclass
        and conname = 'assignments_v2_evidence_source_check'
    ), '')) > 0
  ),
  (
    'evidence_source_invalid_rejected',
    not pg_temp.try_insert_runtime_assignment_with_source('wrong_source')
  ),
  ('anon_rpc_execute_kept', has_function_privilege('anon', 'public.read_pupil_runtime_assignments(uuid)', 'execute')),
  ('anon_pupil_classes_select_still_revoked', not has_table_privilege('anon', 'public.pupil_classes', 'select'));

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);

set local role anon;

insert into runtime_assignment_checks (name, json_value)
values
  (
    'pupil_a_payload',
    public.read_pupil_runtime_assignments((select id from runtime_assignment_ids where name = 'pupil_a'))
  ),
  (
    'pupil_c_payload',
    public.read_pupil_runtime_assignments((select id from runtime_assignment_ids where name = 'pupil_c'))
  ),
  (
    'inactive_pupil_payload',
    public.read_pupil_runtime_assignments((select id from runtime_assignment_ids where name = 'inactive_pupil'))
  );

insert into runtime_assignment_checks (name, bool_value)
values
  (
    'can_access_extra_unlinked',
    public.can_access_pupil_assignment_runtime(
      (select id from runtime_assignment_ids where name = 'pupil_a'),
      (select id from runtime_assignment_ids where name = 'extra_assignment_unlinked')
    )
  ),
  (
    'can_access_extra_target_linked',
    public.can_access_pupil_assignment_runtime(
      (select id from runtime_assignment_ids where name = 'pupil_a'),
      (select id from runtime_assignment_ids where name = 'extra_assignment_target_linked')
    )
  ),
  (
    'can_access_extra_target_linked_other_pupil',
    public.can_access_pupil_assignment_runtime(
      (select id from runtime_assignment_ids where name = 'pupil_c'),
      (select id from runtime_assignment_ids where name = 'extra_assignment_target_linked')
    )
  ),
  (
    'can_access_closed_incomplete',
    public.can_access_pupil_assignment_runtime(
      (select id from runtime_assignment_ids where name = 'pupil_a'),
      (select id from runtime_assignment_ids where name = 'closed_incomplete_assignment')
    )
  ),
  (
    'can_access_closed_completed',
    public.can_access_pupil_assignment_runtime(
      (select id from runtime_assignment_ids where name = 'pupil_a'),
      (select id from runtime_assignment_ids where name = 'closed_completed_assignment')
    )
  ),
  (
    'can_access_closed_mixed_baseline',
    public.can_access_pupil_assignment_runtime(
      (select id from runtime_assignment_ids where name = 'pupil_a'),
      (select id from runtime_assignment_ids where name = 'closed_mixed_baseline_assignment')
    )
  );

reset role;

select ok((select bool_value from runtime_assignment_checks where name = 'evidence_source_column_exists'), 'assignments_v2 has evidence_source column');
select ok((select bool_value from runtime_assignment_checks where name = 'evidence_source_default_assigned_core'), 'assignments_v2 evidence_source defaults to assigned_core');
select ok((select bool_value from runtime_assignment_checks where name = 'evidence_source_not_null'), 'assignments_v2 evidence_source is not null');
select ok((select bool_value from runtime_assignment_checks where name = 'evidence_source_constraint_allows_assigned_core'), 'evidence source constraint allows assigned_core');
select ok((select bool_value from runtime_assignment_checks where name = 'evidence_source_constraint_allows_extra_challenge'), 'evidence source constraint allows extra_challenge');
select ok((select bool_value from runtime_assignment_checks where name = 'evidence_source_invalid_rejected'), 'evidence source constraint rejects unknown values');
select ok((select bool_value from runtime_assignment_checks where name = 'anon_rpc_execute_kept'), 'anon can execute narrow pupil runtime assignments RPC');
select ok((select bool_value from runtime_assignment_checks where name = 'anon_pupil_classes_select_still_revoked'), 'anon still cannot directly select pupil_classes');
select is((select json_value ->> 'status' from runtime_assignment_checks where name = 'pupil_a_payload'), 'ok', 'active pupil runtime assignment RPC returns ok');
select ok(jsonb_array_length((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) >= 1, 'active pupil sees active-class assignments');
select ok(
  exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'assignment_a')
  ),
  'active pupil payload includes own assignment'
);
select is(
  (
    select assignment_row.value ->> 'evidence_source'
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'assignment_a')
    limit 1
  ),
  'assigned_core',
  'assigned-core runtime assignments expose default evidence source'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    cross join jsonb_array_elements(assignment_row.value -> 'words') as word_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'assignment_a')
      and word_row.value ->> 'word' = 'phase'
  ),
  'active pupil payload includes own assignment word'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'assignment_b')
  ),
  'active pupil payload does not include another class assignment'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'closed_incomplete_assignment')
  ),
  'ended incomplete assigned-core assignment is hidden from pupil runtime payload'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'closed_mixed_baseline_assignment')
  ),
  'ended mixed baseline ordinary assignment is hidden from pupil runtime payload'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'closed_completed_assignment')
  ),
  'ended completed assigned-core assignment remains visible in pupil runtime payload'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'closed_completed_assignment')
      and (assignment_row.value ->> 'completed')::boolean is true
      and (assignment_row.value ->> 'isLocked')::boolean is true
      and assignment_row.value ->> 'assignmentStatus' = 'completed'
  ),
  'ended completed assigned-core assignment keeps completed result state'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'extra_assignment_unlinked')
  ),
  'broad extra challenge assignment without a pupil link is hidden'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'extra_assignment_target_linked')
  ),
  'extra challenge assignment with a target-word pupil link is visible to that pupil'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'extra_assignment_target_linked')
      and assignment_row.value ->> 'evidence_source' = 'extra_challenge'
      and assignment_row.value ->> 'assignment_source' = 'extra_challenge'
      and assignment_row.value ->> 'attempt_source' = 'extra_challenge'
      and (assignment_row.value ->> 'isExtraChallenge')::boolean is true
  ),
  'visible extra challenge runtime row exposes source metadata and extra attempt source'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_a_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'extra_assignment_status_linked')
  ),
  'extra challenge assignment with a status pupil link is visible to that pupil'
);
select is((select json_value ->> 'status' from runtime_assignment_checks where name = 'pupil_c_payload'), 'ok', 'same-class unlinked pupil runtime assignment RPC returns ok');
select ok(
  exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_c_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'assignment_a')
  ),
  'same-class unlinked pupil still sees assigned-core class assignment'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements((select json_value -> 'assignments' from runtime_assignment_checks where name = 'pupil_c_payload')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from runtime_assignment_ids where name = 'extra_assignment_target_linked')
  ),
  'same-class unlinked pupil does not see another pupil extra challenge assignment'
);
select ok(not (select bool_value from runtime_assignment_checks where name = 'can_access_extra_unlinked'), 'RLS helper denies broad extra challenge access without pupil link');
select ok((select bool_value from runtime_assignment_checks where name = 'can_access_extra_target_linked'), 'RLS helper allows linked extra challenge access for owning pupil');
select ok(not (select bool_value from runtime_assignment_checks where name = 'can_access_extra_target_linked_other_pupil'), 'RLS helper denies linked extra challenge access for another pupil');
select ok(not (select bool_value from runtime_assignment_checks where name = 'can_access_closed_incomplete'), 'RLS helper denies ended incomplete assigned-core access');
select ok((select bool_value from runtime_assignment_checks where name = 'can_access_closed_completed'), 'RLS helper allows ended completed assigned-core access');
select ok(not (select bool_value from runtime_assignment_checks where name = 'can_access_closed_mixed_baseline'), 'RLS helper denies ended mixed baseline ordinary access');
select is((select json_value ->> 'status' from runtime_assignment_checks where name = 'inactive_pupil_payload'), 'runtime_inactive', 'inactive pupil runtime assignment RPC is blocked');
select is(jsonb_array_length((select json_value -> 'assignments' from runtime_assignment_checks where name = 'inactive_pupil_payload')), 0, 'inactive pupil receives no assignments');

select * from finish();

rollback;
