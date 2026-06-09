begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(12);

create temporary table tenant_runtime_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table tenant_runtime_checks (
  name text primary key,
  bool_value boolean,
  json_value jsonb
) on commit drop;

grant select on table tenant_runtime_ids to public;
grant select, insert, update, delete on table tenant_runtime_checks to public;

insert into tenant_runtime_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'school_a',
  'school_b',
  'legacy_teacher',
  'admin_a',
  'profile_user',
  'runtime_teacher',
  'runtime_class',
  'runtime_pupil',
  'runtime_test',
  'runtime_word',
  'runtime_assignment'
]) as names(name);

do $$
declare
  legacy_school_id uuid := public.default_legacy_school_id();
  school_a_id uuid := (select id from tenant_runtime_ids where name = 'school_a');
  school_b_id uuid := (select id from tenant_runtime_ids where name = 'school_b');
  legacy_teacher_id uuid := (select id from tenant_runtime_ids where name = 'legacy_teacher');
  admin_a_id uuid := (select id from tenant_runtime_ids where name = 'admin_a');
  profile_user_id uuid := (select id from tenant_runtime_ids where name = 'profile_user');
  runtime_teacher_id uuid := (select id from tenant_runtime_ids where name = 'runtime_teacher');
  runtime_class_id uuid := (select id from tenant_runtime_ids where name = 'runtime_class');
  runtime_pupil_id uuid := (select id from tenant_runtime_ids where name = 'runtime_pupil');
  runtime_test_id uuid := (select id from tenant_runtime_ids where name = 'runtime_test');
  runtime_word_id uuid := (select id from tenant_runtime_ids where name = 'runtime_word');
  runtime_assignment_id uuid := (select id from tenant_runtime_ids where name = 'runtime_assignment');
begin
  perform set_config('request.jwt.claim.sub', admin_a_id::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_a_id::text, 'role', 'service_role')::text,
    true
  );

  insert into public.schools (id, slug, name, is_legacy_default)
  values
    (school_a_id, 'phase3a-school-a-' || substr(replace(school_a_id::text, '-', ''), 1, 8), 'Phase 3A School A', false),
    (school_b_id, 'phase3a-school-b-' || substr(replace(school_b_id::text, '-', ''), 1, 8), 'Phase 3A School B', false)
  on conflict (slug) do nothing;

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
    (legacy_teacher_id, 'authenticated', 'authenticated', 'pgtap-phase3a-legacy-' || substr(replace(legacy_teacher_id::text, '-', ''), 1, 8) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
    (admin_a_id, 'authenticated', 'authenticated', 'pgtap-phase3a-admin-a-' || substr(replace(admin_a_id::text, '-', ''), 1, 8) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
    (profile_user_id, 'authenticated', 'authenticated', 'pgtap-phase3a-profile-' || substr(replace(profile_user_id::text, '-', ''), 1, 8) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
    (runtime_teacher_id, 'authenticated', 'authenticated', 'pgtap-phase3a-runtime-' || substr(replace(runtime_teacher_id::text, '-', ''), 1, 8) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()))
  on conflict (id) do nothing;

  insert into public.school_memberships (school_id, user_id, source)
  values
    (legacy_school_id, legacy_teacher_id, 'system'),
    (school_a_id, admin_a_id, 'system'),
    (legacy_school_id, runtime_teacher_id, 'system')
  on conflict do nothing;

  insert into public.staff_profiles (user_id, email, display_name, profile_source, school_id)
  values
    (legacy_teacher_id, 'phase3a-legacy@example.test', 'Phase 3A Legacy Teacher', 'self_service', legacy_school_id),
    (admin_a_id, 'phase3a-admin-a@example.test', 'Phase 3A Admin A', 'self_service', school_a_id),
    (runtime_teacher_id, 'phase3a-runtime@example.test', 'Phase 3A Runtime Teacher', 'self_service', legacy_school_id);

  insert into public.staff_role_assignments (user_id, role, active, granted_by, school_id)
  values
    (legacy_teacher_id, 'teacher', true, legacy_teacher_id, legacy_school_id),
    (admin_a_id, 'admin', true, admin_a_id, school_a_id),
    (runtime_teacher_id, 'teacher', true, runtime_teacher_id, legacy_school_id);

  insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
  values
    (admin_a_id, 'admin', 'school', school_a_id::text, true, admin_a_id, school_a_id);

  insert into public.teachers (id, display_name, school_id)
  values
    (legacy_teacher_id, 'Phase 3A Legacy Teacher', legacy_school_id),
    (runtime_teacher_id, 'Phase 3A Runtime Teacher', legacy_school_id);

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type, school_id)
  values (
    runtime_class_id,
    runtime_teacher_id,
    'Phase 3A Runtime Class',
    upper(substr(replace(runtime_class_id::text, '-', ''), 1, 6)),
    'Year 7',
    'form',
    legacy_school_id
  );

  insert into public.tests (id, teacher_id, title, status, question_type, school_id)
  values (
    runtime_test_id,
    runtime_teacher_id,
    'Phase 3A Runtime Test',
    'published',
    'full_recall',
    legacy_school_id
  );

  insert into public.test_words (id, test_id, position, word, sentence, segments, choice, school_id)
  values (
    runtime_word_id,
    runtime_test_id,
    1,
    'phase',
    'A phase sentence.',
    '["ph","a","se"]'::jsonb,
    '{"source":"teacher"}'::jsonb,
    legacy_school_id
  );

  insert into public.pupils (
    id,
    mis_id,
    first_name,
    surname,
    username,
    pin,
    must_reset_pin,
    is_active,
    school_id
  )
  values (
    runtime_pupil_id,
    'PHASE3A-' || substr(replace(runtime_pupil_id::text, '-', ''), 1, 10),
    'Runtime',
    'Pupil',
    'phase3a.runtime.' || substr(replace(runtime_pupil_id::text, '-', ''), 1, 8),
    '1111',
    false,
    true,
    legacy_school_id
  );

  insert into public.pupil_classes (pupil_id, class_id, active, school_id)
  values (runtime_pupil_id, runtime_class_id, true, legacy_school_id);

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts, created_at, school_id)
  values (
    runtime_assignment_id,
    runtime_teacher_id,
    runtime_class_id,
    runtime_test_id,
    'practice',
    2,
    timezone('utc', now()),
    legacy_school_id
  );
end;
$$;

select set_config('request.jwt.claim.sub', (select id::text from tenant_runtime_ids where name = 'legacy_teacher'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from tenant_runtime_ids where name = 'legacy_teacher'),
    'role', 'authenticated'
  )::text,
  true
);

insert into tenant_runtime_checks (name, json_value)
values ('legacy_context', public.get_my_access_context());

select set_config('request.jwt.claim.sub', (select id::text from tenant_runtime_ids where name = 'admin_a'), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from tenant_runtime_ids where name = 'admin_a'),
    'role', 'authenticated'
  )::text,
  true
);

insert into tenant_runtime_checks (name, json_value)
values
  (
    'admin_invalid_request_context',
    public.get_my_access_context((select id from tenant_runtime_ids where name = 'school_b'))
  ),
  (
    'admin_valid_request_context',
    public.get_my_access_context((select id from tenant_runtime_ids where name = 'school_a'))
  );

select set_config('request.jwt.claim.sub', (select id::text from tenant_runtime_ids where name = 'profile_user'), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from tenant_runtime_ids where name = 'profile_user'),
    'role', 'authenticated'
  )::text,
  true
);

insert into tenant_runtime_checks (name, json_value)
values (
  'profile_upsert_result',
  public.upsert_my_staff_profile('phase3a-profile-user@example.test', 'Phase 3A Profile User')
);

insert into tenant_runtime_checks (name, bool_value)
values
  (
    'profile_defaulted_school',
    exists (
      select 1
      from public.staff_profiles as sp
      where sp.user_id = (select id from tenant_runtime_ids where name = 'profile_user')
        and sp.school_id = public.default_legacy_school_id()
    )
  ),
  (
    'profile_membership_created',
    exists (
      select 1
      from public.school_memberships as sm
      where sm.user_id = (select id from tenant_runtime_ids where name = 'profile_user')
        and sm.school_id = public.default_legacy_school_id()
        and sm.active is true
    )
  );

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);

set local role anon;

insert into tenant_runtime_checks (name, json_value)
values (
  'runtime_assignment_payload',
  public.read_pupil_runtime_assignments((select id from tenant_runtime_ids where name = 'runtime_pupil'))
);

reset role;

select is((select json_value ->> 'version' from tenant_runtime_checks where name = 'legacy_context'), '2', 'get_my_access_context keeps version 2');
select ok(
  (select json_value ?& array['legacy', 'roles', 'capabilities', 'scopes', 'role_scopes', 'data_health'] from tenant_runtime_checks where name = 'legacy_context'),
  'get_my_access_context keeps existing frontend keys'
);
select ok(
  (select json_value ?& array['active_school_id', 'default_school_id', 'schools'] from tenant_runtime_checks where name = 'legacy_context'),
  'get_my_access_context adds school fields'
);
select is(
  (select json_value ->> 'active_school_id' from tenant_runtime_checks where name = 'legacy_context'),
  public.default_legacy_school_id()::text,
  'single-school legacy user resolves to legacy default school'
);
select ok(
  jsonb_path_exists(
    (select json_value from tenant_runtime_checks where name = 'legacy_context'),
    '$.schools[*] ? (@.slug == "legacy-default")'
  ),
  'legacy default school is included in available schools'
);
select isnt(
  (select json_value ->> 'active_school_id' from tenant_runtime_checks where name = 'admin_invalid_request_context'),
  (select id::text from tenant_runtime_ids where name = 'school_b'),
  'invalid requested school is not made active'
);
select is(
  (select json_value ->> 'active_school_id' from tenant_runtime_checks where name = 'admin_valid_request_context'),
  (select id::text from tenant_runtime_ids where name = 'school_a'),
  'valid requested school is made active'
);
select ok(
  ((select json_value -> 'capabilities' ->> 'can_manage_roles' from tenant_runtime_checks where name = 'admin_valid_request_context')::boolean),
  'active-school admin keeps admin capability in their school'
);
select ok((select bool_value from tenant_runtime_checks where name = 'profile_defaulted_school'), 'upsert_my_staff_profile defaults school_id');
select ok((select bool_value from tenant_runtime_checks where name = 'profile_membership_created'), 'upsert_my_staff_profile creates active school membership');
select is((select json_value ->> 'status' from tenant_runtime_checks where name = 'runtime_assignment_payload'), 'ok', 'existing pupil runtime assignment RPC still works');
select ok(
  jsonb_array_length((select json_value -> 'assignments' from tenant_runtime_checks where name = 'runtime_assignment_payload')) >= 1,
  'existing pupil runtime assignment payload still returns assignments'
);

select * from finish();

rollback;
