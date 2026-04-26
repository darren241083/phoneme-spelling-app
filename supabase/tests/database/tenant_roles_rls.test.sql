begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(19);

create temporary table tenant_role_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table tenant_role_checks (
  name text primary key,
  bool_value boolean,
  json_value jsonb
) on commit drop;

grant select on table tenant_role_ids to public;
grant select, insert, update, delete on table tenant_role_checks to public;

insert into tenant_role_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'school_a',
  'school_b',
  'admin_a',
  'hoy_a',
  'hod_a',
  'teacher_a',
  'teacher_b',
  'legacy_admin',
  'class_a_year7',
  'class_b_year7',
  'class_a_english',
  'class_b_english',
  'test_a',
  'test_b',
  'word_a',
  'pupil_a',
  'assignment_a'
]) as names(name);

do $$
declare
  legacy_school_id uuid := public.default_legacy_school_id();
  school_a_id uuid := (select id from tenant_role_ids where name = 'school_a');
  school_b_id uuid := (select id from tenant_role_ids where name = 'school_b');
  admin_a_id uuid := (select id from tenant_role_ids where name = 'admin_a');
  hoy_a_id uuid := (select id from tenant_role_ids where name = 'hoy_a');
  hod_a_id uuid := (select id from tenant_role_ids where name = 'hod_a');
  teacher_a_id uuid := (select id from tenant_role_ids where name = 'teacher_a');
  teacher_b_id uuid := (select id from tenant_role_ids where name = 'teacher_b');
  legacy_admin_id uuid := (select id from tenant_role_ids where name = 'legacy_admin');
  class_a_year7_id uuid := (select id from tenant_role_ids where name = 'class_a_year7');
  class_b_year7_id uuid := (select id from tenant_role_ids where name = 'class_b_year7');
  class_a_english_id uuid := (select id from tenant_role_ids where name = 'class_a_english');
  class_b_english_id uuid := (select id from tenant_role_ids where name = 'class_b_english');
  test_a_id uuid := (select id from tenant_role_ids where name = 'test_a');
  test_b_id uuid := (select id from tenant_role_ids where name = 'test_b');
  word_a_id uuid := (select id from tenant_role_ids where name = 'word_a');
  pupil_a_id uuid := (select id from tenant_role_ids where name = 'pupil_a');
  assignment_a_id uuid := (select id from tenant_role_ids where name = 'assignment_a');
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
    (school_a_id, 'phase2-school-a-' || substr(replace(school_a_id::text, '-', ''), 1, 8), 'Phase 2 School A', false),
    (school_b_id, 'phase2-school-b-' || substr(replace(school_b_id::text, '-', ''), 1, 8), 'Phase 2 School B', false)
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
  select
    id,
    'authenticated',
    'authenticated',
    'pgtap-phase2-' || name || '-' || substr(replace(id::text, '-', ''), 1, 8) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  from tenant_role_ids
  where name in ('admin_a', 'hoy_a', 'hod_a', 'teacher_a', 'teacher_b', 'legacy_admin')
  on conflict (id) do nothing;

  insert into public.school_memberships (school_id, user_id, source)
  values
    (school_a_id, admin_a_id, 'system'),
    (school_a_id, hoy_a_id, 'system'),
    (school_a_id, hod_a_id, 'system'),
    (school_a_id, teacher_a_id, 'system'),
    (school_b_id, teacher_b_id, 'system'),
    (legacy_school_id, legacy_admin_id, 'system')
  on conflict do nothing;

  insert into public.staff_profiles (user_id, email, display_name, profile_source, school_id)
  values
    (admin_a_id, 'phase2-admin-a@example.test', 'Phase 2 Admin A', 'self_service', school_a_id),
    (teacher_a_id, 'phase2-teacher-a@example.test', 'Phase 2 Teacher A', 'self_service', school_a_id),
    (teacher_b_id, 'phase2-teacher-b@example.test', 'Phase 2 Teacher B', 'self_service', school_b_id),
    (legacy_admin_id, 'phase2-legacy-admin@example.test', 'Phase 2 Legacy Admin', 'self_service', legacy_school_id);

  insert into public.staff_role_assignments (user_id, role, active, granted_by, school_id)
  values
    (admin_a_id, 'admin', true, admin_a_id, school_a_id),
    (hoy_a_id, 'hoy', true, admin_a_id, school_a_id),
    (hod_a_id, 'hod', true, admin_a_id, school_a_id),
    (teacher_a_id, 'teacher', true, admin_a_id, school_a_id),
    (teacher_b_id, 'teacher', true, admin_a_id, school_b_id),
    (legacy_admin_id, 'admin', true, legacy_admin_id, legacy_school_id);

  insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
  values
    (admin_a_id, 'admin', 'school', school_a_id::text, true, admin_a_id, school_a_id),
    (hoy_a_id, 'hoy', 'year_group', 'Year 7', true, admin_a_id, school_a_id),
    (hod_a_id, 'hod', 'department', 'English', true, admin_a_id, school_a_id),
    (legacy_admin_id, 'admin', 'school', 'default', true, legacy_admin_id, legacy_school_id);

  insert into public.teachers (id, display_name, school_id)
  values
    (teacher_a_id, 'Phase 2 Teacher A', school_a_id),
    (teacher_b_id, 'Phase 2 Teacher B', school_b_id);

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type, department_key, school_id)
  values
    (class_a_year7_id, teacher_a_id, 'Phase 2 A Year 7', upper(substr(replace(class_a_year7_id::text, '-', ''), 1, 6)), 'Year 7', 'form', 'Maths', school_a_id),
    (class_b_year7_id, teacher_b_id, 'Phase 2 B Year 7', upper(substr(replace(class_b_year7_id::text, '-', ''), 1, 6)), 'Year 7', 'form', 'Maths', school_b_id),
    (class_a_english_id, teacher_a_id, 'Phase 2 A English', upper(substr(replace(class_a_english_id::text, '-', ''), 1, 6)), 'Year 8', 'subject', 'English', school_a_id),
    (class_b_english_id, teacher_b_id, 'Phase 2 B English', upper(substr(replace(class_b_english_id::text, '-', ''), 1, 6)), 'Year 8', 'subject', 'English', school_b_id);

  insert into public.tests (id, teacher_id, title, status, question_type, school_id)
  values
    (test_a_id, teacher_a_id, 'Phase 2 Test A', 'published', 'full_recall', school_a_id),
    (test_b_id, teacher_b_id, 'Phase 2 Test B', 'published', 'full_recall', school_b_id);

  insert into public.test_words (id, test_id, position, word, sentence, segments, choice, school_id)
  values (
    word_a_id,
    test_a_id,
    1,
    'phase',
    'A phase sentence.',
    '["ph","a","se"]'::jsonb,
    '{"source":"teacher"}'::jsonb,
    school_a_id
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
    pupil_a_id,
    'PHASE2-PUPIL-' || substr(replace(pupil_a_id::text, '-', ''), 1, 8),
    'Phase',
    'Pupil',
    'phase2.pupil.' || substr(replace(pupil_a_id::text, '-', ''), 1, 8),
    '1111',
    false,
    true,
    school_a_id
  );

  insert into public.pupil_classes (pupil_id, class_id, active, school_id)
  values (pupil_a_id, class_a_year7_id, true, school_a_id);

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts, created_at, school_id)
  values (assignment_a_id, teacher_a_id, class_a_year7_id, test_a_id, 'practice', 2, timezone('utc', now()), school_a_id);
end $$;

insert into tenant_role_checks (name, bool_value)
values
  (
    'admin_a_can_manage_school_a',
    public.can_manage_roles(
      (select id from tenant_role_ids where name = 'admin_a'),
      (select id from tenant_role_ids where name = 'school_a')
    )
  ),
  (
    'admin_a_cannot_manage_school_b',
    not public.can_manage_roles(
      (select id from tenant_role_ids where name = 'admin_a'),
      (select id from tenant_role_ids where name = 'school_b')
    )
  ),
  (
    'hoy_a_can_view_year7_a',
    public.can_view_class(
      (select id from tenant_role_ids where name = 'class_a_year7'),
      (select id from tenant_role_ids where name = 'hoy_a')
    )
  ),
  (
    'hoy_a_cannot_view_year7_b',
    not public.can_view_class(
      (select id from tenant_role_ids where name = 'class_b_year7'),
      (select id from tenant_role_ids where name = 'hoy_a')
    )
  ),
  (
    'hod_a_can_view_english_a',
    public.can_view_class(
      (select id from tenant_role_ids where name = 'class_a_english'),
      (select id from tenant_role_ids where name = 'hod_a')
    )
  ),
  (
    'hod_a_cannot_view_english_b',
    not public.can_view_class(
      (select id from tenant_role_ids where name = 'class_b_english'),
      (select id from tenant_role_ids where name = 'hod_a')
    )
  ),
  (
    'teacher_a_can_view_own_test',
    public.can_view_test(
      (select id from tenant_role_ids where name = 'test_a'),
      (select id from tenant_role_ids where name = 'teacher_a')
    )
  ),
  (
    'teacher_a_cannot_view_school_b_test',
    not public.can_view_test(
      (select id from tenant_role_ids where name = 'test_b'),
      (select id from tenant_role_ids where name = 'teacher_a')
    )
  ),
  (
    'default_alias_resolves_to_legacy_school',
    public.has_scope(
      'school',
      'default',
      'admin',
      (select id from tenant_role_ids where name = 'legacy_admin'),
      public.default_legacy_school_id()
    )
  ),
  (
    'anon_school_memberships_select_still_revoked',
    not has_table_privilege('anon', 'public.school_memberships', 'select')
  ),
  (
    'anon_pupil_classes_select_still_revoked',
    not has_table_privilege('anon', 'public.pupil_classes', 'select')
  );

select set_config('request.jwt.claim.sub', (select id::text from tenant_role_ids where name = 'legacy_admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from tenant_role_ids where name = 'legacy_admin'),
    'role', 'authenticated'
  )::text,
  true
);

insert into tenant_role_checks (name, json_value)
values ('legacy_access_context', public.get_my_access_context());

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);

set local role anon;

insert into tenant_role_checks (name, json_value)
values (
  'runtime_assignment_payload',
  public.read_pupil_runtime_assignments((select id from tenant_role_ids where name = 'pupil_a'))
);

reset role;

select ok((select bool_value from tenant_role_checks where name = 'admin_a_can_manage_school_a'), 'School A admin can manage School A');
select ok((select bool_value from tenant_role_checks where name = 'admin_a_cannot_manage_school_b'), 'School A admin cannot manage School B');
select ok((select bool_value from tenant_role_checks where name = 'hoy_a_can_view_year7_a'), 'HOY for Year 7 in School A can view Year 7 in School A');
select ok((select bool_value from tenant_role_checks where name = 'hoy_a_cannot_view_year7_b'), 'HOY for Year 7 in School A cannot view Year 7 in School B');
select ok((select bool_value from tenant_role_checks where name = 'hod_a_can_view_english_a'), 'HOD for English in School A can view English in School A');
select ok((select bool_value from tenant_role_checks where name = 'hod_a_cannot_view_english_b'), 'HOD for English in School A cannot view English in School B');
select ok((select bool_value from tenant_role_checks where name = 'teacher_a_can_view_own_test'), 'teacher own-content access works inside school');
select ok((select bool_value from tenant_role_checks where name = 'teacher_a_cannot_view_school_b_test'), 'teacher own-content access does not cross schools');
select ok((select bool_value from tenant_role_checks where name = 'default_alias_resolves_to_legacy_school'), 'legacy scope_value default resolves to the legacy school');
select is((select json_value ->> 'version' from tenant_role_checks where name = 'legacy_access_context'), '2', 'get_my_access_context keeps version 2');
select ok((select json_value ? 'legacy' from tenant_role_checks where name = 'legacy_access_context'), 'get_my_access_context keeps legacy key');
select ok((select json_value ? 'roles' from tenant_role_checks where name = 'legacy_access_context'), 'get_my_access_context keeps roles key');
select ok((select json_value ? 'capabilities' from tenant_role_checks where name = 'legacy_access_context'), 'get_my_access_context keeps capabilities key');
select ok((select json_value ? 'scopes' from tenant_role_checks where name = 'legacy_access_context'), 'get_my_access_context keeps scopes key');
select ok((select json_value ? 'role_scopes' from tenant_role_checks where name = 'legacy_access_context'), 'get_my_access_context keeps role_scopes key');
select ok(((select json_value -> 'capabilities' ->> 'can_manage_roles' from tenant_role_checks where name = 'legacy_access_context')::boolean), 'legacy admin context still exposes can_manage_roles');
select is((select json_value ->> 'status' from tenant_role_checks where name = 'runtime_assignment_payload'), 'ok', 'existing pupil runtime assignment RPC still works');
select ok((select bool_value from tenant_role_checks where name = 'anon_school_memberships_select_still_revoked'), 'anon cannot directly select school_memberships');
select ok((select bool_value from tenant_role_checks where name = 'anon_pupil_classes_select_still_revoked'), 'anon cannot directly select pupil_classes');

select * from finish();

rollback;
