begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(4);

create temporary table attempts_v2_fk_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table attempts_v2_fk_checks (
  name text primary key,
  bool_value boolean,
  int_value integer
) on commit drop;

grant select on table attempts_v2_fk_ids to public;
grant select, insert, update, delete on table attempts_v2_fk_checks to public;

insert into attempts_v2_fk_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'teacher',
  'class',
  'pupil',
  'test',
  'assignment_v2',
  'status',
  'attempt',
  'invalid_assignment'
]) as names(name);

create or replace function pg_temp.try_insert_attempt_for_assignment(p_assignment_id uuid) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  attempt_id uuid := gen_random_uuid();
begin
  set constraints attempts_assignment_id_fkey immediate;

  insert into public.attempts (
    id,
    assignment_id,
    pupil_id,
    test_id,
    mode,
    typed,
    correct,
    attempt_number,
    word_text,
    attempt_source
  )
  values (
    attempt_id,
    p_assignment_id,
    (select id from attempts_v2_fk_ids where name = 'pupil'),
    (select id from attempts_v2_fk_ids where name = 'test'),
    'focus_sound',
    'phase',
    true,
    1,
    'phase',
    'teacher_assigned'
  );

  set constraints attempts_assignment_id_fkey deferred;
  return true;
exception
  when foreign_key_violation then
    set constraints attempts_assignment_id_fkey deferred;
    return false;
end;
$$;

grant execute on function pg_temp.try_insert_attempt_for_assignment(uuid) to public;

do $$
declare
  teacher_id uuid := (select id from attempts_v2_fk_ids where name = 'teacher');
  class_id uuid := (select id from attempts_v2_fk_ids where name = 'class');
  pupil_id uuid := (select id from attempts_v2_fk_ids where name = 'pupil');
  test_id uuid := (select id from attempts_v2_fk_ids where name = 'test');
  assignment_v2_id uuid := (select id from attempts_v2_fk_ids where name = 'assignment_v2');
  status_id uuid := (select id from attempts_v2_fk_ids where name = 'status');
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
    'pgtap-attempts-v2-fk-' || substr(replace(teacher_id::text, '-', ''), 1, 10) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do nothing;

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values (teacher_id, 'teacher', true, teacher_id);

  insert into public.teachers (id, display_name)
  values (teacher_id, 'pgTAP Attempts V2 FK Teacher');

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values (class_id, teacher_id, 'pgTAP Attempts V2 FK Class', upper(substr(replace(class_id::text, '-', ''), 1, 6)), 'Year 7', 'form');

  insert into public.pupils (id, username, first_name, surname, pin, active)
  values (pupil_id, 'pgtap_attempts_v2_fk_' || substr(replace(pupil_id::text, '-', ''), 1, 8), 'Attempt', 'V2FK', '1234', true);

  insert into public.pupil_classes (pupil_id, class_id, active)
  values (pupil_id, class_id, true);

  insert into public.tests (id, teacher_id, title, status, question_type)
  values (test_id, teacher_id, 'pgTAP Attempts V2 FK Test', 'published', 'focus_sound');

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts)
  values (assignment_v2_id, teacher_id, class_id, test_id, 'practice', 2);

  insert into public.assignment_pupil_statuses (
    id,
    teacher_id,
    assignment_id,
    class_id,
    test_id,
    pupil_id,
    status,
    completed_at,
    total_words,
    correct_words,
    average_attempts,
    score_rate,
    result_json
  )
  values (
    status_id,
    teacher_id,
    assignment_v2_id,
    class_id,
    test_id,
    pupil_id,
    'completed',
    timezone('utc', now()),
    1,
    1,
    1,
    1,
    jsonb_build_array(jsonb_build_object(
      'word', 'phase',
      'typed', 'phase',
      'correct', true,
      'attemptsUsed', 1
    ))
  );
end;
$$;

insert into attempts_v2_fk_checks (name, bool_value, int_value)
values
  ('fk_references_assignments_v2', exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.attempts'::regclass
      and c.conname = 'attempts_assignment_id_fkey'
      and c.confrelid = 'public.assignments_v2'::regclass
  ), null),
  ('status_count_before_attempt', null, (
    select count(*)::integer
    from public.assignment_pupil_statuses
    where id = (select id from attempts_v2_fk_ids where name = 'status')
  ));

insert into attempts_v2_fk_checks (name, bool_value, int_value)
values
  ('v2_assignment_attempt_inserted', pg_temp.try_insert_attempt_for_assignment((select id from attempts_v2_fk_ids where name = 'assignment_v2')), null),
  ('invalid_assignment_attempt_blocked', not pg_temp.try_insert_attempt_for_assignment((select id from attempts_v2_fk_ids where name = 'invalid_assignment')), null),
  ('status_count_after_attempt', null, (
    select count(*)::integer
    from public.assignment_pupil_statuses
    where id = (select id from attempts_v2_fk_ids where name = 'status')
      and total_words = 1
      and correct_words = 1
      and average_attempts = 1
      and score_rate = 1
  ));

select ok((select bool_value from attempts_v2_fk_checks where name = 'fk_references_assignments_v2'), 'attempts assignment FK references assignments_v2');
select ok((select bool_value from attempts_v2_fk_checks where name = 'v2_assignment_attempt_inserted'), 'attempts can reference a v2 assignment id');
select ok((select bool_value from attempts_v2_fk_checks where name = 'invalid_assignment_attempt_blocked'), 'attempts reject unknown assignment ids');
select is(
  (select int_value from attempts_v2_fk_checks where name = 'status_count_after_attempt'),
  (select int_value from attempts_v2_fk_checks where name = 'status_count_before_attempt'),
  'inserting an attempt does not change assignment status summary fields'
);

select * from finish();

rollback;
