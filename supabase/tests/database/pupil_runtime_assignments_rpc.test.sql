begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(9);

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

insert into runtime_assignment_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'teacher_a',
  'teacher_b',
  'class_a',
  'class_b',
  'pupil_a',
  'pupil_b',
  'inactive_pupil',
  'test_a',
  'test_b',
  'word_a',
  'word_b',
  'assignment_a',
  'assignment_b'
]) as names(name);

do $$
declare
  teacher_a_id uuid := (select id from runtime_assignment_ids where name = 'teacher_a');
  teacher_b_id uuid := (select id from runtime_assignment_ids where name = 'teacher_b');
  class_a_id uuid := (select id from runtime_assignment_ids where name = 'class_a');
  class_b_id uuid := (select id from runtime_assignment_ids where name = 'class_b');
  pupil_a_id uuid := (select id from runtime_assignment_ids where name = 'pupil_a');
  pupil_b_id uuid := (select id from runtime_assignment_ids where name = 'pupil_b');
  inactive_pupil_id uuid := (select id from runtime_assignment_ids where name = 'inactive_pupil');
  test_a_id uuid := (select id from runtime_assignment_ids where name = 'test_a');
  test_b_id uuid := (select id from runtime_assignment_ids where name = 'test_b');
  word_a_id uuid := (select id from runtime_assignment_ids where name = 'word_a');
  word_b_id uuid := (select id from runtime_assignment_ids where name = 'word_b');
  assignment_a_id uuid := (select id from runtime_assignment_ids where name = 'assignment_a');
  assignment_b_id uuid := (select id from runtime_assignment_ids where name = 'assignment_b');
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
    (test_b_id, teacher_b_id, 'pgTAP Runtime Test B', 'published', 'full_recall');

  insert into public.test_words (id, test_id, position, word, sentence, segments, choice)
  values
    (word_a_id, test_a_id, 1, 'phase', 'A phase sentence.', '["ph","a","se"]'::jsonb, '{"source":"teacher"}'::jsonb),
    (word_b_id, test_b_id, 1, 'scope', 'A scope sentence.', '["s","c","o","pe"]'::jsonb, '{"source":"teacher"}'::jsonb);

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
    (inactive_pupil_id, 'RUNTIME-I-' || substr(replace(inactive_pupil_id::text, '-', ''), 1, 10), 'Runtime', 'Inactive', 'runtime.inactive.' || substr(replace(inactive_pupil_id::text, '-', ''), 1, 8), '3333', false, false);

  insert into public.pupil_classes (pupil_id, class_id, active)
  values
    (pupil_a_id, class_a_id, true),
    (pupil_b_id, class_b_id, true),
    (inactive_pupil_id, class_a_id, true);

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts, created_at)
  values
    (assignment_a_id, teacher_a_id, class_a_id, test_a_id, 'practice', 2, timezone('utc', now())),
    (assignment_b_id, teacher_b_id, class_b_id, test_b_id, 'practice', 2, timezone('utc', now()));
end;
$$;

insert into runtime_assignment_checks (name, bool_value)
values
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
    'inactive_pupil_payload',
    public.read_pupil_runtime_assignments((select id from runtime_assignment_ids where name = 'inactive_pupil'))
  );

reset role;

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
select is((select json_value ->> 'status' from runtime_assignment_checks where name = 'inactive_pupil_payload'), 'runtime_inactive', 'inactive pupil runtime assignment RPC is blocked');
select is(jsonb_array_length((select json_value -> 'assignments' from runtime_assignment_checks where name = 'inactive_pupil_payload')), 0, 'inactive pupil receives no assignments');

select * from finish();

rollback;
