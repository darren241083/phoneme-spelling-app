begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(4);

create temporary table delete_test_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table delete_test_checks (
  name text primary key,
  bool_value boolean
) on commit drop;

grant select on table delete_test_ids to public;
grant select, insert, update, delete on table delete_test_checks to public;

insert into delete_test_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'teacher_a',
  'teacher_b',
  'class_a',
  'class_b',
  'test_a',
  'test_b',
  'assignment_a',
  'assignment_b'
]) as names(name);

create or replace function pg_temp.try_delete_test(p_test_id uuid) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  delete from public.tests
  where id = p_test_id;

  return found;
exception
  when others then
    return false;
end;
$$;

grant execute on function pg_temp.try_delete_test(uuid) to public;

do $$
declare
  teacher_a_id uuid := (select id from delete_test_ids where name = 'teacher_a');
  teacher_b_id uuid := (select id from delete_test_ids where name = 'teacher_b');
  class_a_id uuid := (select id from delete_test_ids where name = 'class_a');
  class_b_id uuid := (select id from delete_test_ids where name = 'class_b');
  test_a_id uuid := (select id from delete_test_ids where name = 'test_a');
  test_b_id uuid := (select id from delete_test_ids where name = 'test_b');
  assignment_a_id uuid := (select id from delete_test_ids where name = 'assignment_a');
  assignment_b_id uuid := (select id from delete_test_ids where name = 'assignment_b');
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
    (teacher_a_id, 'authenticated', 'authenticated', 'pgtap-delete-test-a-' || substr(replace(teacher_a_id::text, '-', ''), 1, 10) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
    (teacher_b_id, 'authenticated', 'authenticated', 'pgtap-delete-test-b-' || substr(replace(teacher_b_id::text, '-', ''), 1, 10) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()))
  on conflict (id) do nothing;

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values
    (teacher_a_id, 'teacher', true, teacher_a_id),
    (teacher_b_id, 'teacher', true, teacher_a_id);

  insert into public.teachers (id, display_name)
  values
    (teacher_a_id, 'pgTAP Delete Test Teacher A'),
    (teacher_b_id, 'pgTAP Delete Test Teacher B');

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values
    (class_a_id, teacher_a_id, 'pgTAP Delete Test Class A', upper(substr(replace(class_a_id::text, '-', ''), 1, 6)), 'Year 7', 'form'),
    (class_b_id, teacher_b_id, 'pgTAP Delete Test Class B', upper(substr(replace(class_b_id::text, '-', ''), 1, 6)), 'Year 8', 'form');

  insert into public.tests (id, teacher_id, title, status, question_type)
  values
    (test_a_id, teacher_a_id, 'pgTAP Delete Assigned Test A', 'published', 'full_recall'),
    (test_b_id, teacher_b_id, 'pgTAP Delete Assigned Test B', 'published', 'full_recall');

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts)
  values
    (assignment_a_id, teacher_a_id, class_a_id, test_a_id, 'practice', 2),
    (assignment_b_id, teacher_b_id, class_b_id, test_b_id, 'practice', 2);
end;
$$;

select set_config('request.jwt.claim.sub', (select id::text from delete_test_ids where name = 'teacher_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id::text from delete_test_ids where name = 'teacher_a'), 'role', 'authenticated')::text,
  true
);

set local role authenticated;

insert into delete_test_checks (name, bool_value)
values
  ('teacher_a_can_delete_assigned_test', pg_temp.try_delete_test((select id from delete_test_ids where name = 'test_a'))),
  ('teacher_a_cannot_delete_teacher_b_test', not pg_temp.try_delete_test((select id from delete_test_ids where name = 'test_b')));

reset role;

insert into delete_test_checks (name, bool_value)
values
  ('assignment_a_cascaded', not exists (
    select 1
    from public.assignments_v2
    where id = (select id from delete_test_ids where name = 'assignment_a')
  )),
  ('assignment_b_remains', exists (
    select 1
    from public.assignments_v2
    where id = (select id from delete_test_ids where name = 'assignment_b')
  ));

select ok((select bool_value from delete_test_checks where name = 'teacher_a_can_delete_assigned_test'), 'teacher can delete own assigned test');
select ok((select bool_value from delete_test_checks where name = 'assignment_a_cascaded'), 'deleting own test cascades assigned test row');
select ok((select bool_value from delete_test_checks where name = 'teacher_a_cannot_delete_teacher_b_test'), 'teacher cannot delete another teacher test');
select ok((select bool_value from delete_test_checks where name = 'assignment_b_remains'), 'another teacher assignment remains');

select * from finish();

rollback;
