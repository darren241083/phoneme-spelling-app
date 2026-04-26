begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(45);

create temporary table test_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table check_values (
  name text primary key,
  bool_value boolean,
  int_value integer,
  json_value jsonb,
  text_value text
) on commit drop;

grant select on table test_ids to public;
grant select, insert, update, delete on table check_values to public;

insert into test_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'teacher_a',
  'teacher_b',
  'admin_user',
  'class_a',
  'class_b',
  'pupil_a',
  'pupil_b',
  'inactive_pupil',
  'new_pupil',
  'test_group_a',
  'test_group_b',
  'test_a',
  'test_b',
  'word_a',
  'word_b',
  'assignment_a',
  'assignment_b',
  'attempt_a',
  'attempt_b',
  'override_a',
  'override_b'
]) as names(name);

create or replace function pg_temp.try_insert_attempt(
  p_assignment_id uuid,
  p_pupil_id uuid,
  p_test_id uuid,
  p_test_word_id uuid,
  p_word text
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  insert into public.attempts (
    assignment_id,
    pupil_id,
    test_id,
    test_word_id,
    mode,
    typed,
    correct,
    attempt_number,
    word_text,
    attempt_source
  )
  values (
    p_assignment_id,
    p_pupil_id,
    p_test_id,
    p_test_word_id,
    'practice',
    p_word,
    true,
    1,
    p_word,
    'assignment'
  );

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.try_update_attempt(p_attempt_id uuid) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  update public.attempts
  set typed = typed || '-blocked'
  where id = p_attempt_id;

  return found;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.try_insert_membership(
  p_pupil_id uuid,
  p_class_id uuid
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  insert into public.pupil_classes (pupil_id, class_id, active)
  values (p_pupil_id, p_class_id, true);

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.try_insert_override(
  p_assignment_id uuid,
  p_pupil_id uuid,
  p_question_type text
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  insert into public.assignment_pupil_overrides (
    assignment_id,
    pupil_id,
    question_type
  )
  values (
    p_assignment_id,
    p_pupil_id,
    p_question_type
  );

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.try_insert_test_group(
  p_teacher_id uuid,
  p_name text
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  insert into public.test_groups (teacher_id, name)
  values (p_teacher_id, p_name);

  return true;
exception
  when others then
    return false;
end;
$$;

grant execute on function pg_temp.try_insert_attempt(uuid, uuid, uuid, uuid, text) to public;
grant execute on function pg_temp.try_update_attempt(uuid) to public;
grant execute on function pg_temp.try_insert_membership(uuid, uuid) to public;
grant execute on function pg_temp.try_insert_override(uuid, uuid, text) to public;
grant execute on function pg_temp.try_insert_test_group(uuid, text) to public;

do $$
declare
  teacher_a_id uuid := (select id from test_ids where name = 'teacher_a');
  teacher_b_id uuid := (select id from test_ids where name = 'teacher_b');
  admin_user_id uuid := (select id from test_ids where name = 'admin_user');
  class_a_id uuid := (select id from test_ids where name = 'class_a');
  class_b_id uuid := (select id from test_ids where name = 'class_b');
  pupil_a_id uuid := (select id from test_ids where name = 'pupil_a');
  pupil_b_id uuid := (select id from test_ids where name = 'pupil_b');
  inactive_pupil_id uuid := (select id from test_ids where name = 'inactive_pupil');
  new_pupil_id uuid := (select id from test_ids where name = 'new_pupil');
  test_group_a_id uuid := (select id from test_ids where name = 'test_group_a');
  test_group_b_id uuid := (select id from test_ids where name = 'test_group_b');
  test_a_id uuid := (select id from test_ids where name = 'test_a');
  test_b_id uuid := (select id from test_ids where name = 'test_b');
  word_a_id uuid := (select id from test_ids where name = 'word_a');
  word_b_id uuid := (select id from test_ids where name = 'word_b');
  assignment_a_id uuid := (select id from test_ids where name = 'assignment_a');
  assignment_b_id uuid := (select id from test_ids where name = 'assignment_b');
  attempt_a_id uuid := (select id from test_ids where name = 'attempt_a');
  attempt_b_id uuid := (select id from test_ids where name = 'attempt_b');
  override_a_id uuid := (select id from test_ids where name = 'override_a');
  override_b_id uuid := (select id from test_ids where name = 'override_b');
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
    (teacher_a_id, 'authenticated', 'authenticated', 'pgtap-phase0-teacher-a-' || substr(replace(teacher_a_id::text, '-', ''), 1, 10) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
    (teacher_b_id, 'authenticated', 'authenticated', 'pgtap-phase0-teacher-b-' || substr(replace(teacher_b_id::text, '-', ''), 1, 10) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
    (admin_user_id, 'authenticated', 'authenticated', 'pgtap-phase0-admin-' || substr(replace(admin_user_id::text, '-', ''), 1, 10) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()))
  on conflict (id) do nothing;

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values
    (teacher_a_id, 'teacher', true, admin_user_id),
    (teacher_b_id, 'teacher', true, admin_user_id),
    (admin_user_id, 'admin', true, admin_user_id);

  insert into public.teachers (id, display_name)
  values
    (teacher_a_id, 'pgTAP Phase 0 Teacher A'),
    (teacher_b_id, 'pgTAP Phase 0 Teacher B'),
    (admin_user_id, 'pgTAP Phase 0 Admin');

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values
    (class_a_id, teacher_a_id, 'pgTAP Phase 0 Class A', upper(substr(replace(class_a_id::text, '-', ''), 1, 6)), 'Year 7', 'form'),
    (class_b_id, teacher_b_id, 'pgTAP Phase 0 Class B', upper(substr(replace(class_b_id::text, '-', ''), 1, 6)), 'Year 8', 'form');

  insert into public.test_groups (id, teacher_id, name)
  values
    (test_group_a_id, teacher_a_id, 'pgTAP Phase 0 Group A'),
    (test_group_b_id, teacher_b_id, 'pgTAP Phase 0 Group B');

  insert into public.tests (id, teacher_id, title, group_id, status, question_type)
  values
    (test_a_id, teacher_a_id, 'pgTAP Phase 0 Test A', test_group_a_id, 'published', 'full_recall'),
    (test_b_id, teacher_b_id, 'pgTAP Phase 0 Test B', test_group_b_id, 'published', 'full_recall');

  insert into public.test_words (id, test_id, position, word, sentence, segments, choice)
  values
    (word_a_id, test_a_id, 1, 'phase', 'A phase sentence.', '[]'::jsonb, '{"source":"teacher"}'::jsonb),
    (word_b_id, test_b_id, 1, 'scope', 'A scope sentence.', '[]'::jsonb, '{"source":"teacher"}'::jsonb);

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
    (pupil_a_id, 'PHASE0-' || substr(replace(pupil_a_id::text, '-', ''), 1, 10), 'Phase', 'PupilA', 'phase0.pupil.a.' || substr(replace(pupil_a_id::text, '-', ''), 1, 8), '1111', false, true),
    (pupil_b_id, 'PHASE0-' || substr(replace(pupil_b_id::text, '-', ''), 1, 10), 'Phase', 'PupilB', 'phase0.pupil.b.' || substr(replace(pupil_b_id::text, '-', ''), 1, 8), '2222', false, true),
    (inactive_pupil_id, 'PHASE0-' || substr(replace(inactive_pupil_id::text, '-', ''), 1, 10), 'Phase', 'Inactive', 'phase0.inactive.' || substr(replace(inactive_pupil_id::text, '-', ''), 1, 8), '3333', false, false),
    (new_pupil_id, 'PHASE0-' || substr(replace(new_pupil_id::text, '-', ''), 1, 10), 'Phase', 'New', 'phase0.new.' || substr(replace(new_pupil_id::text, '-', ''), 1, 8), '4444', false, true);

  insert into public.pupil_classes (pupil_id, class_id, active)
  values
    (pupil_a_id, class_a_id, true),
    (pupil_b_id, class_b_id, true),
    (inactive_pupil_id, class_a_id, true);

  insert into public.assignments (id, class_id, test_id, teacher_id)
  values
    (assignment_a_id, class_a_id, test_a_id, teacher_a_id),
    (assignment_b_id, class_b_id, test_b_id, teacher_b_id);

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts)
  values
    (assignment_a_id, teacher_a_id, class_a_id, test_a_id, 'practice', 2),
    (assignment_b_id, teacher_b_id, class_b_id, test_b_id, 'practice', 2);

  insert into public.attempts (
    id,
    assignment_id,
    pupil_id,
    test_id,
    test_word_id,
    mode,
    typed,
    correct,
    attempt_number,
    word_text,
    attempt_source
  )
  values
    (attempt_a_id, assignment_a_id, pupil_a_id, test_a_id, word_a_id, 'practice', 'phase', true, 1, 'phase', 'assignment'),
    (attempt_b_id, assignment_b_id, pupil_b_id, test_b_id, word_b_id, 'practice', 'scope', true, 1, 'scope', 'assignment');

  insert into public.assignment_pupil_overrides (id, assignment_id, pupil_id, question_type)
  values
    (override_a_id, assignment_a_id, pupil_a_id, 'full_recall'),
    (override_b_id, assignment_b_id, pupil_b_id, 'full_recall');
end;
$$;

insert into check_values (name, bool_value)
values
  ('pupils_rls_enabled', (select relrowsecurity from pg_class where oid = 'public.pupils'::regclass)),
  ('pupil_classes_rls_enabled', (select relrowsecurity from pg_class where oid = 'public.pupil_classes'::regclass)),
  ('attempts_rls_enabled', (select relrowsecurity from pg_class where oid = 'public.attempts'::regclass)),
  ('test_words_rls_enabled', (select relrowsecurity from pg_class where oid = 'public.test_words'::regclass)),
  ('test_groups_rls_enabled', (select relrowsecurity from pg_class where oid = 'public.test_groups'::regclass)),
  ('assignment_pupil_overrides_rls_enabled', (select relrowsecurity from pg_class where oid = 'public.assignment_pupil_overrides'::regclass)),
  ('dev_pupils_policy_removed', not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pupils'
      and policyname = 'dev allow all pupils'
  )),
  ('dev_pupil_classes_policy_removed', not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pupil_classes'
      and policyname = 'dev allow all pupil_classes'
  )),
  ('attempts_broad_anon_select_removed', not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'attempts'
      and policyname = 'Anon can view attempts'
  )),
  ('attempts_assignment_scoped_anon_select_added', exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'attempts'
      and policyname = 'Anon can view assignment-scoped attempts'
  )),
  ('anon_pupils_select_revoked', not has_table_privilege('anon', 'public.pupils', 'select')),
  ('anon_pupil_classes_select_revoked', not has_table_privilege('anon', 'public.pupil_classes', 'select')),
  ('anon_test_words_select_revoked', not has_table_privilege('anon', 'public.test_words', 'select')),
  ('anon_test_groups_select_revoked', not has_table_privilege('anon', 'public.test_groups', 'select')),
  ('anon_assignment_pupil_overrides_select_revoked', not has_table_privilege('anon', 'public.assignment_pupil_overrides', 'select')),
  ('anon_attempts_insert_kept', has_table_privilege('anon', 'public.attempts', 'insert')),
  ('anon_attempts_select_kept', has_table_privilege('anon', 'public.attempts', 'select')),
  ('anon_attempts_update_revoked', not has_table_privilege('anon', 'public.attempts', 'update')),
  ('anon_attempts_delete_revoked', not has_table_privilege('anon', 'public.attempts', 'delete')),
  ('anon_authenticate_privilege_kept', has_function_privilege('anon', 'public.authenticate_pupil(text,text)', 'execute')),
  ('anon_validate_privilege_kept', has_function_privilege('anon', 'public.validate_pupil_runtime_session(uuid)', 'execute'));

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);

set local role anon;

insert into check_values (name, json_value)
values (
  'anon_authenticate_payload',
  public.authenticate_pupil(
    'phase0.pupil.a.' || substr(replace((select id::text from test_ids where name = 'pupil_a'), '-', ''), 1, 8),
    '1111'
  )
);

insert into check_values (name, json_value)
select
  'anon_validate_payload',
  public.validate_pupil_runtime_session((select id from test_ids where name = 'pupil_a'));

insert into check_values (name, bool_value)
values
  (
    'anon_valid_attempt_insert',
    pg_temp.try_insert_attempt(
      (select id from test_ids where name = 'assignment_a'),
      (select id from test_ids where name = 'pupil_a'),
      (select id from test_ids where name = 'test_a'),
      (select id from test_ids where name = 'word_a'),
      'phase'
    )
  ),
  (
    'anon_invalid_assignment_pair_blocked',
    not pg_temp.try_insert_attempt(
      (select id from test_ids where name = 'assignment_b'),
      (select id from test_ids where name = 'pupil_a'),
      (select id from test_ids where name = 'test_b'),
      (select id from test_ids where name = 'word_b'),
      'scope'
    )
  ),
  (
    'anon_inactive_pupil_attempt_blocked',
    not pg_temp.try_insert_attempt(
      (select id from test_ids where name = 'assignment_a'),
      (select id from test_ids where name = 'inactive_pupil'),
      (select id from test_ids where name = 'test_a'),
      (select id from test_ids where name = 'word_a'),
      'phase'
    )
  ),
  (
    'anon_attempt_update_blocked',
    not pg_temp.try_update_attempt((select id from test_ids where name = 'attempt_a'))
  );

reset role;

select set_config('request.jwt.claim.sub', (select id::text from test_ids where name = 'teacher_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id::text from test_ids where name = 'teacher_a'), 'role', 'authenticated')::text,
  true
);

set local role authenticated;

insert into check_values (name, int_value)
values
  ('teacher_a_visible_pupils', (select count(*)::integer from public.pupils)),
  ('teacher_a_visible_pupil_classes', (select count(*)::integer from public.pupil_classes)),
  ('teacher_a_visible_test_words', (select count(*)::integer from public.test_words)),
  ('teacher_a_visible_test_groups', (select count(*)::integer from public.test_groups)),
  ('teacher_a_visible_overrides', (select count(*)::integer from public.assignment_pupil_overrides)),
  ('teacher_a_visible_attempts', (select count(*)::integer from public.attempts));

insert into check_values (name, bool_value)
values
  (
    'teacher_a_cannot_see_teacher_b_pupil',
    not exists (
      select 1 from public.pupils
      where id = (select id from test_ids where name = 'pupil_b')
    )
  ),
  (
    'teacher_a_scoped_test_words_only',
    exists (
      select 1 from public.test_words
      where id = (select id from test_ids where name = 'word_a')
    )
    and not exists (
      select 1 from public.test_words
      where id = (select id from test_ids where name = 'word_b')
    )
  ),
  (
    'teacher_a_can_insert_own_test_group',
    pg_temp.try_insert_test_group(
      (select id from test_ids where name = 'teacher_a'),
      'pgTAP Phase 0 Teacher A Inserted Group'
    )
  ),
  (
    'teacher_a_can_insert_own_membership',
    pg_temp.try_insert_membership(
      (select id from test_ids where name = 'new_pupil'),
      (select id from test_ids where name = 'class_a')
    )
  ),
  (
    'teacher_a_can_insert_own_override',
    pg_temp.try_insert_override(
      (select id from test_ids where name = 'assignment_a'),
      (select id from test_ids where name = 'new_pupil'),
      'full_recall'
    )
  ),
  (
    'teacher_a_cross_assignment_override_blocked',
    not pg_temp.try_insert_override(
      (select id from test_ids where name = 'assignment_b'),
      (select id from test_ids where name = 'new_pupil'),
      'full_recall'
    )
  );

reset role;

select set_config('request.jwt.claim.sub', (select id::text from test_ids where name = 'teacher_b'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id::text from test_ids where name = 'teacher_b'), 'role', 'authenticated')::text,
  true
);

set local role authenticated;

insert into check_values (name, bool_value)
values
  (
    'teacher_b_cannot_see_teacher_a_pupil',
    not exists (
      select 1 from public.pupils
      where id = (select id from test_ids where name = 'pupil_a')
    )
  ),
  (
    'teacher_b_cannot_see_teacher_a_words',
    not exists (
      select 1 from public.test_words
      where id = (select id from test_ids where name = 'word_a')
    )
  ),
  (
    'teacher_b_cannot_see_teacher_a_override',
    not exists (
      select 1 from public.assignment_pupil_overrides
      where id = (select id from test_ids where name = 'override_a')
    )
  );

reset role;

select set_config('request.jwt.claim.sub', (select id::text from test_ids where name = 'admin_user'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id::text from test_ids where name = 'admin_user'), 'role', 'authenticated')::text,
  true
);

set local role authenticated;

insert into check_values (name, int_value)
values ('admin_visible_pupils', (select count(*)::integer from public.pupils));

reset role;

select ok((select bool_value from check_values where name = 'pupils_rls_enabled'), 'pupils RLS remains enabled');
select ok((select bool_value from check_values where name = 'pupil_classes_rls_enabled'), 'pupil_classes RLS remains enabled');
select ok((select bool_value from check_values where name = 'attempts_rls_enabled'), 'attempts RLS is enabled');
select ok((select bool_value from check_values where name = 'test_words_rls_enabled'), 'test_words RLS is enabled');
select ok((select bool_value from check_values where name = 'test_groups_rls_enabled'), 'test_groups RLS is enabled');
select ok((select bool_value from check_values where name = 'assignment_pupil_overrides_rls_enabled'), 'assignment_pupil_overrides RLS is enabled');

select ok((select bool_value from check_values where name = 'dev_pupils_policy_removed'), 'dev allow-all pupils policy is removed');
select ok((select bool_value from check_values where name = 'dev_pupil_classes_policy_removed'), 'dev allow-all pupil_classes policy is removed');
select ok((select bool_value from check_values where name = 'attempts_broad_anon_select_removed'), 'broad anon attempt select policy is removed');
select ok((select bool_value from check_values where name = 'attempts_assignment_scoped_anon_select_added'), 'assignment-scoped anon attempt select policy is installed');

select ok((select bool_value from check_values where name = 'anon_pupils_select_revoked'), 'anon cannot directly select pupils');
select ok((select bool_value from check_values where name = 'anon_pupil_classes_select_revoked'), 'anon cannot directly select pupil_classes');
select ok((select bool_value from check_values where name = 'anon_test_words_select_revoked'), 'anon cannot directly select test_words');
select ok((select bool_value from check_values where name = 'anon_test_groups_select_revoked'), 'anon cannot directly select test_groups');
select ok((select bool_value from check_values where name = 'anon_assignment_pupil_overrides_select_revoked'), 'anon cannot directly select assignment_pupil_overrides');
select ok((select bool_value from check_values where name = 'anon_attempts_insert_kept'), 'anon can still insert attempts');
select ok((select bool_value from check_values where name = 'anon_attempts_select_kept'), 'anon can still read attempt rows through RLS');
select ok((select bool_value from check_values where name = 'anon_attempts_update_revoked'), 'anon cannot update attempts');
select ok((select bool_value from check_values where name = 'anon_attempts_delete_revoked'), 'anon cannot delete attempts');
select ok((select bool_value from check_values where name = 'anon_authenticate_privilege_kept'), 'anon can still execute authenticate_pupil');
select ok((select bool_value from check_values where name = 'anon_validate_privilege_kept'), 'anon can still execute validate_pupil_runtime_session');

select ok((select json_value from check_values where name = 'anon_authenticate_payload') ? 'id', 'anon pupil authentication still returns limited identity');
select ok((select json_value from check_values where name = 'anon_validate_payload') ? 'id', 'anon pupil runtime validation still returns limited identity');
select ok((select json_value from check_values where name = 'anon_authenticate_payload') ?& array['school_id', 'school_name', 'school_slug', 'school_is_legacy_default'], 'anon pupil authentication includes school summary fields');
select ok((select json_value from check_values where name = 'anon_validate_payload') ?& array['school_id', 'school_name', 'school_slug', 'school_is_legacy_default'], 'anon pupil runtime validation includes school summary fields');
select is((select json_value from check_values where name = 'anon_authenticate_payload') ? 'pin', false, 'anon pupil authentication does not return PIN');
select ok((select bool_value from check_values where name = 'anon_valid_attempt_insert'), 'anon can insert a valid assignment attempt');
select ok((select bool_value from check_values where name = 'anon_invalid_assignment_pair_blocked'), 'anon cannot insert an attempt for a mismatched assignment/pupil pair');
select ok((select bool_value from check_values where name = 'anon_inactive_pupil_attempt_blocked'), 'anon cannot insert an attempt for an inactive pupil');
select ok((select bool_value from check_values where name = 'anon_attempt_update_blocked'), 'anon attempt update is blocked');

select is((select int_value from check_values where name = 'teacher_a_visible_pupils'), 2, 'teacher A can see scoped active/history pupils only');
select is((select int_value from check_values where name = 'teacher_a_visible_pupil_classes'), 2, 'teacher A can see scoped memberships only');
select ok((select bool_value from check_values where name = 'teacher_a_scoped_test_words_only'), 'teacher A can see scoped test words only');
select is((select int_value from check_values where name = 'teacher_a_visible_test_groups'), 1, 'teacher A can see own test group only');
select is((select int_value from check_values where name = 'teacher_a_visible_overrides'), 1, 'teacher A can see scoped assignment override only');
select is((select int_value from check_values where name = 'teacher_a_visible_attempts'), 2, 'teacher A can see scoped attempts including the new runtime attempt');
select ok((select bool_value from check_values where name = 'teacher_a_cannot_see_teacher_b_pupil'), 'teacher A cannot see teacher B pupil');
select ok((select bool_value from check_values where name = 'teacher_a_can_insert_own_test_group'), 'teacher A can still write own test groups');
select ok((select bool_value from check_values where name = 'teacher_a_can_insert_own_membership'), 'teacher A can still write own class membership');
select ok((select bool_value from check_values where name = 'teacher_a_can_insert_own_override'), 'teacher A can still write own assignment override');
select ok((select bool_value from check_values where name = 'teacher_a_cross_assignment_override_blocked'), 'teacher A cannot write another teacher assignment override');
select ok((select bool_value from check_values where name = 'teacher_b_cannot_see_teacher_a_pupil'), 'teacher B cannot see teacher A pupil');
select ok((select bool_value from check_values where name = 'teacher_b_cannot_see_teacher_a_words'), 'teacher B cannot see teacher A test words');
select ok((select bool_value from check_values where name = 'teacher_b_cannot_see_teacher_a_override'), 'teacher B cannot see teacher A override');
select is((select int_value from check_values where name = 'admin_visible_pupils'), 4, 'CSV admin can still see current single-school pupil directory');

select * from finish();

rollback;
