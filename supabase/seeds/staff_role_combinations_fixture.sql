-- Local-only staff role combination fixture for additive role testing.
--
-- This file is intentionally manual-only:
-- - Do not add it to supabase/config.toml seed paths.
-- - Do not run it against hosted or production databases.
-- - It refuses to run unless psql receives: -v staff_role_combinations_fixture=1
--
-- Apply:
-- Get-Content -Raw supabase/seeds/staff_role_combinations_fixture.sql | docker exec -i supabase_db_phoneme-spelling-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -v staff_role_combinations_fixture=1
--
-- Clear only:
-- Get-Content -Raw supabase/seeds/staff_role_combinations_fixture.sql | docker exec -i supabase_db_phoneme-spelling-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -v staff_role_combinations_fixture=1 -v clear_only=1
--
-- Local browser sign-in helper:
-- const { supabase } = await import("./js/supabaseClient.js");
-- await supabase.auth.signInWithPassword({
--   email: "rolelab.teacher.hoy@wordloom.test",
--   password: "WordloomLocalOnly!2026"
-- });
-- location.reload();

\if :{?staff_role_combinations_fixture}
\else
\echo 'Refusing to run staff_role_combinations_fixture.sql. Pass -v staff_role_combinations_fixture=1 to confirm this is a deliberate local fixture load.'
\quit 3
\endif

\if :staff_role_combinations_fixture
\else
\echo 'Refusing to run staff_role_combinations_fixture.sql. staff_role_combinations_fixture must be set to 1.'
\quit 3
\endif

\if :{?clear_only}
\if :clear_only
\set rolelab_clear_only 1
\else
\set rolelab_clear_only 0
\endif
\else
\set rolelab_clear_only 0
\endif

begin;

drop table if exists fixture_rolelab_validation;
drop table if exists fixture_rolelab_scopes;
drop table if exists fixture_rolelab_roles;
drop table if exists fixture_rolelab_staff;
drop table if exists fixture_rolelab_schools;

create temporary table fixture_rolelab_schools (
  school_key text primary key,
  school_id uuid not null,
  slug text not null,
  name text not null
) on commit drop;

insert into fixture_rolelab_schools (school_key, school_id, slug, name)
values (
  'rolelab',
  '90000000-0000-4000-8000-000000000001',
  'wordloom-rolelab-local',
  'Wordloom Role Lab Local'
);

create temporary table fixture_rolelab_staff (
  staff_key text primary key,
  user_id uuid not null,
  profile_id uuid not null,
  email text not null,
  display_name text not null
) on commit drop;

insert into fixture_rolelab_staff (staff_key, user_id, profile_id, email, display_name)
values
  ('teacher', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'rolelab.teacher@wordloom.test', 'Role Lab Teacher'),
  ('hoy', '91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 'rolelab.hoy@wordloom.test', 'Role Lab HOY'),
  ('teacher_hoy', '91000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000003', 'rolelab.teacher.hoy@wordloom.test', 'Role Lab Teacher HOY'),
  ('admin', '91000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000004', 'rolelab.admin@wordloom.test', 'Role Lab Admin'),
  ('admin_teacher', '91000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-000000000005', 'rolelab.admin.teacher@wordloom.test', 'Role Lab Admin Teacher'),
  ('senco', '91000000-0000-4000-8000-000000000006', '92000000-0000-4000-8000-000000000006', 'rolelab.senco@wordloom.test', 'Role Lab SENCO'),
  ('senco_teacher', '91000000-0000-4000-8000-000000000007', '92000000-0000-4000-8000-000000000007', 'rolelab.senco.teacher@wordloom.test', 'Role Lab SENCO Teacher'),
  ('literacy', '91000000-0000-4000-8000-000000000008', '92000000-0000-4000-8000-000000000008', 'rolelab.literacy@wordloom.test', 'Role Lab Literacy Lead'),
  ('literacy_teacher', '91000000-0000-4000-8000-000000000009', '92000000-0000-4000-8000-000000000009', 'rolelab.literacy.teacher@wordloom.test', 'Role Lab Literacy Teacher');

create temporary table fixture_rolelab_roles (
  staff_key text not null references fixture_rolelab_staff(staff_key),
  role text not null
) on commit drop;

insert into fixture_rolelab_roles (staff_key, role)
values
  ('teacher', 'teacher'),
  ('hoy', 'hoy'),
  ('teacher_hoy', 'teacher'),
  ('teacher_hoy', 'hoy'),
  ('admin', 'admin'),
  ('admin_teacher', 'admin'),
  ('admin_teacher', 'teacher'),
  ('senco', 'senco'),
  ('senco_teacher', 'senco'),
  ('senco_teacher', 'teacher'),
  ('literacy', 'literacy_lead'),
  ('literacy_teacher', 'literacy_lead'),
  ('literacy_teacher', 'teacher');

create temporary table fixture_rolelab_scopes (
  staff_key text not null references fixture_rolelab_staff(staff_key),
  role text not null,
  scope_type text not null,
  scope_value_key text not null
) on commit drop;

insert into fixture_rolelab_scopes (staff_key, role, scope_type, scope_value_key)
values
  ('hoy', 'hoy', 'year_group', 'Year 7'),
  ('teacher_hoy', 'hoy', 'year_group', 'Year 7'),
  ('admin', 'admin', 'school', 'school'),
  ('admin_teacher', 'admin', 'school', 'school'),
  ('senco', 'senco', 'school', 'school'),
  ('senco_teacher', 'senco', 'school', 'school'),
  ('literacy', 'literacy_lead', 'school', 'school'),
  ('literacy_teacher', 'literacy_lead', 'school', 'school');

-- Exact fixture cleanup only: fixed UUIDs and rolelab.*@wordloom.test emails.
delete from public.staff_scope_assignments
where user_id in (select user_id from fixture_rolelab_staff);

delete from public.staff_role_assignments
where user_id in (select user_id from fixture_rolelab_staff);

delete from public.staff_profiles
where id in (select profile_id from fixture_rolelab_staff)
   or user_id in (select user_id from fixture_rolelab_staff)
   or lower(email) in (select lower(email) from fixture_rolelab_staff);

delete from public.school_memberships
where school_id in (select school_id from fixture_rolelab_schools)
  and user_id in (select user_id from fixture_rolelab_staff);

delete from public.teachers
where id in (select user_id from fixture_rolelab_staff);

do $$
begin
  if to_regclass('auth.identities') is not null then
    execute 'delete from auth.identities where user_id in (select user_id from fixture_rolelab_staff)';
  end if;
end $$;

delete from auth.users
where id in (select user_id from fixture_rolelab_staff)
   or lower(email) in (select lower(email) from fixture_rolelab_staff);

delete from public.schools
where id in (select school_id from fixture_rolelab_schools);

\if :rolelab_clear_only
commit;
\echo 'Cleared local staff role combination fixture rows.'
\quit
\endif

insert into public.schools (id, slug, name, is_legacy_default)
select school_id, slug, name, false
from fixture_rolelab_schools;

insert into auth.users (
  instance_id,
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
  '00000000-0000-0000-0000-000000000000'::uuid,
  user_id,
  'authenticated',
  'authenticated',
  email,
  extensions.crypt('WordloomLocalOnly!2026', extensions.gen_salt('bf', 10)),
  timezone('utc', now()),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object(
    'sub', user_id::text,
    'email', email,
    'email_verified', true,
    'phone_verified', false,
    'name', display_name,
    'fixture', 'staff_role_combinations_v1'
  ),
  timezone('utc', now()),
  timezone('utc', now())
from fixture_rolelab_staff;

do $$
declare
  token_column text;
  token_columns text[] := array[
    'confirmation_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'reauthentication_token',
    'phone_change_token'
  ];
begin
  foreach token_column in array token_columns loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = token_column
    ) then
      execute format(
        'update auth.users set %I = '''' where id in (select user_id from fixture_rolelab_staff)',
        token_column
      );
    end if;
  end loop;
end $$;

do $$
declare
  has_id boolean;
  has_user_id boolean;
  has_identity_data boolean;
  has_provider boolean;
  has_provider_id boolean;
  has_created_at boolean;
  has_updated_at boolean;
  has_last_sign_in_at boolean;
  id_is_uuid boolean;
  insert_columns text[];
  insert_values text[];
begin
  if to_regclass('auth.identities') is null then
    raise notice 'auth.identities does not exist; inserted auth.users only.';
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'id'
  ) into has_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'identity_data'
  ) into has_identity_data;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'provider'
  ) into has_provider;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'provider_id'
  ) into has_provider_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'created_at'
  ) into has_created_at;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'updated_at'
  ) into has_updated_at;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'last_sign_in_at'
  ) into has_last_sign_in_at;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'identities'
      and column_name = 'id'
      and udt_name = 'uuid'
  ) into id_is_uuid;

  if not (has_user_id and has_identity_data and has_provider) then
    raise exception 'auth.identities exists but does not expose expected user_id, identity_data and provider columns.';
  end if;

  insert_columns := array[]::text[];
  insert_values := array[]::text[];

  if has_id then
    insert_columns := array_append(insert_columns, 'id');
    insert_values := array_append(insert_values, case when id_is_uuid then 'staff.user_id' else 'staff.user_id::text' end);
  end if;

  insert_columns := insert_columns || array['user_id', 'identity_data', 'provider'];
  insert_values := insert_values || array[
    'staff.user_id',
    'jsonb_build_object(''sub'', staff.user_id::text, ''email'', staff.email, ''email_verified'', true, ''phone_verified'', false)',
    '''email'''
  ];

  if has_provider_id then
    insert_columns := array_append(insert_columns, 'provider_id');
    insert_values := array_append(insert_values, 'staff.user_id::text');
  end if;

  if has_created_at then
    insert_columns := array_append(insert_columns, 'created_at');
    insert_values := array_append(insert_values, 'timezone(''utc'', now())');
  end if;

  if has_updated_at then
    insert_columns := array_append(insert_columns, 'updated_at');
    insert_values := array_append(insert_values, 'timezone(''utc'', now())');
  end if;

  if has_last_sign_in_at then
    insert_columns := array_append(insert_columns, 'last_sign_in_at');
    insert_values := array_append(insert_values, 'timezone(''utc'', now())');
  end if;

  execute format(
    'insert into auth.identities (%s) select %s from fixture_rolelab_staff as staff',
    array_to_string(insert_columns, ', '),
    array_to_string(insert_values, ', ')
  );
end $$;

insert into public.teachers (id, display_name, school_id)
select staff.user_id, staff.display_name, schools.school_id
from fixture_rolelab_staff as staff
cross join fixture_rolelab_schools as schools;

insert into public.school_memberships (school_id, user_id, source)
select schools.school_id, staff.user_id, 'system'
from fixture_rolelab_staff as staff
cross join fixture_rolelab_schools as schools;

insert into public.staff_profiles (
  id,
  user_id,
  email,
  display_name,
  profile_source,
  import_metadata,
  school_id
)
select
  staff.profile_id,
  staff.user_id,
  staff.email,
  staff.display_name,
  'self_service',
  jsonb_build_object('fixture', 'staff_role_combinations_v1'),
  schools.school_id
from fixture_rolelab_staff as staff
cross join fixture_rolelab_schools as schools;

insert into public.staff_role_assignments (user_id, role, active, granted_by, school_id)
select
  staff.user_id,
  roles.role,
  true,
  (select user_id from fixture_rolelab_staff where staff_key = 'admin'),
  schools.school_id
from fixture_rolelab_roles as roles
join fixture_rolelab_staff as staff
  on staff.staff_key = roles.staff_key
cross join fixture_rolelab_schools as schools;

insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
select
  staff.user_id,
  scopes.role,
  scopes.scope_type,
  case
    when scopes.scope_value_key = 'school' then schools.school_id::text
    else scopes.scope_value_key
  end,
  true,
  (select user_id from fixture_rolelab_staff where staff_key = 'admin'),
  schools.school_id
from fixture_rolelab_scopes as scopes
join fixture_rolelab_staff as staff
  on staff.staff_key = scopes.staff_key
cross join fixture_rolelab_schools as schools;

create temporary table fixture_rolelab_validation (
  check_name text primary key,
  expected text not null,
  actual text not null,
  ok boolean not null
) on commit drop;

insert into fixture_rolelab_validation (check_name, expected, actual, ok)
select 'auth_users', '9', count(*)::text, count(*) = 9
from auth.users
where id in (select user_id from fixture_rolelab_staff);

insert into fixture_rolelab_validation (check_name, expected, actual, ok)
select 'active_school_memberships', '9', count(*)::text, count(*) = 9
from public.school_memberships
where school_id = (select school_id from fixture_rolelab_schools)
  and user_id in (select user_id from fixture_rolelab_staff)
  and active is true;

insert into fixture_rolelab_validation (check_name, expected, actual, ok)
select 'teacher_role_accounts_have_teacher_compat', '5', count(*)::text, count(*) = 5
from fixture_rolelab_staff as staff
cross join fixture_rolelab_schools as schools
where staff.staff_key in ('teacher', 'teacher_hoy', 'admin_teacher', 'senco_teacher', 'literacy_teacher')
  and public.has_role('teacher', staff.user_id, schools.school_id)
  and public.is_teacher_compat(staff.user_id, schools.school_id);

insert into fixture_rolelab_validation (check_name, expected, actual, ok)
select 'overlay_only_accounts_not_teacher_compat', '4', count(*)::text, count(*) = 4
from fixture_rolelab_staff as staff
cross join fixture_rolelab_schools as schools
where staff.staff_key in ('hoy', 'admin', 'senco', 'literacy')
  and not public.has_role('teacher', staff.user_id, schools.school_id)
  and not public.is_teacher_compat(staff.user_id, schools.school_id);

insert into fixture_rolelab_validation (check_name, expected, actual, ok)
select 'hoy_year_7_scopes', '2', count(*)::text, count(*) = 2
from fixture_rolelab_staff as staff
cross join fixture_rolelab_schools as schools
where staff.staff_key in ('hoy', 'teacher_hoy')
  and public.has_role('hoy', staff.user_id, schools.school_id)
  and public.has_scope('year_group', 'Year 7', 'hoy', staff.user_id, schools.school_id);

insert into fixture_rolelab_validation (check_name, expected, actual, ok)
select 'admin_accounts_have_admin_compat', '2', count(*)::text, count(*) = 2
from fixture_rolelab_staff as staff
cross join fixture_rolelab_schools as schools
where staff.staff_key in ('admin', 'admin_teacher')
  and public.has_role('admin', staff.user_id, schools.school_id)
  and public.is_admin_compat(staff.user_id, schools.school_id);

insert into fixture_rolelab_validation (check_name, expected, actual, ok)
select 'teacher_overlay_accounts_have_both_roles', '4', count(*)::text, count(*) = 4
from fixture_rolelab_staff as staff
cross join fixture_rolelab_schools as schools
where (
    staff.staff_key = 'teacher_hoy'
    and public.has_role('teacher', staff.user_id, schools.school_id)
    and public.has_role('hoy', staff.user_id, schools.school_id)
  )
  or (
    staff.staff_key = 'admin_teacher'
    and public.has_role('teacher', staff.user_id, schools.school_id)
    and public.has_role('admin', staff.user_id, schools.school_id)
  )
  or (
    staff.staff_key = 'senco_teacher'
    and public.has_role('teacher', staff.user_id, schools.school_id)
    and public.has_role('senco', staff.user_id, schools.school_id)
  )
  or (
    staff.staff_key = 'literacy_teacher'
    and public.has_role('teacher', staff.user_id, schools.school_id)
    and public.has_role('literacy_lead', staff.user_id, schools.school_id)
  );

do $$
declare
  failures jsonb;
  passed_count integer;
begin
  select jsonb_agg(
    jsonb_build_object(
      'check', check_name,
      'expected', expected,
      'actual', actual
    )
    order by check_name
  )
  into failures
  from fixture_rolelab_validation
  where ok is not true;

  if failures is not null then
    raise exception 'staff_role_combinations_fixture validation failed: %', failures;
  end if;

  select count(*)
  into passed_count
  from fixture_rolelab_validation;

  raise notice 'staff_role_combinations_fixture validation passed: % checks.', passed_count;
end $$;

select check_name, expected, actual, ok
from fixture_rolelab_validation
order by check_name;

commit;
