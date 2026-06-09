begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

-- Current schema note:
-- public.pupils.mis_id and public.pupils.username are globally unique today.
-- That means school-scoped pupil identifiers are not part of this pass and
-- remain a separate future schema decision. This test therefore verifies the
-- server-side school behavior that is meaningful under the current schema:
-- requested-school staff RPC scoping, requested-school pending access flows,
-- and requested-school pupil import class resolution / batch attribution.

select plan(21);

create temporary table tenant_rpc_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table tenant_rpc_checks (
  name text primary key,
  bool_value boolean,
  int_value integer,
  text_value text,
  json_value jsonb
) on commit drop;

grant select on table tenant_rpc_ids to public;
grant select, insert, update, delete on table tenant_rpc_checks to public;

insert into tenant_rpc_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'school_a',
  'school_b',
  'admin_a',
  'admin_b',
  'target_user',
  'pending_profile_a',
  'pending_profile_b',
  'import_profile_b',
  'class_a',
  'class_b',
  'school_b_pupil'
]) as names(name);

do $$
declare
  school_a_id uuid := (select id from tenant_rpc_ids where name = 'school_a');
  school_b_id uuid := (select id from tenant_rpc_ids where name = 'school_b');
  admin_a_id uuid := (select id from tenant_rpc_ids where name = 'admin_a');
  admin_b_id uuid := (select id from tenant_rpc_ids where name = 'admin_b');
  target_user_id uuid := (select id from tenant_rpc_ids where name = 'target_user');
  pending_profile_a_id uuid := (select id from tenant_rpc_ids where name = 'pending_profile_a');
  pending_profile_b_id uuid := (select id from tenant_rpc_ids where name = 'pending_profile_b');
  import_profile_b_id uuid := (select id from tenant_rpc_ids where name = 'import_profile_b');
  class_a_id uuid := (select id from tenant_rpc_ids where name = 'class_a');
  class_b_id uuid := (select id from tenant_rpc_ids where name = 'class_b');
  school_b_pupil_id uuid := (select id from tenant_rpc_ids where name = 'school_b_pupil');
  teacher_role_conflict_error text := null;
  pending_list_a jsonb := '[]'::jsonb;
  pending_detail_a jsonb := '{}'::jsonb;
  pending_save_result jsonb := '{}'::jsonb;
  pending_cancel_result jsonb := '{}'::jsonb;
  staff_preflight_a jsonb := '{}'::jsonb;
  staff_import_result jsonb := '{}'::jsonb;
  pupil_preflight_a jsonb := '{}'::jsonb;
  pupil_preflight_b jsonb := '{}'::jsonb;
  pupil_import_result jsonb := '{}'::jsonb;
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
    (school_a_id, 'rpc-school-a-' || substr(replace(school_a_id::text, '-', ''), 1, 8), 'RPC School A', false),
    (school_b_id, 'rpc-school-b-' || substr(replace(school_b_id::text, '-', ''), 1, 8), 'RPC School B', false)
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
    (admin_a_id, 'authenticated', 'authenticated', 'pgtap-rpc-admin-a-' || substr(replace(admin_a_id::text, '-', ''), 1, 8) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
    (admin_b_id, 'authenticated', 'authenticated', 'pgtap-rpc-admin-b-' || substr(replace(admin_b_id::text, '-', ''), 1, 8) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())),
    (target_user_id, 'authenticated', 'authenticated', 'pgtap-rpc-target-' || substr(replace(target_user_id::text, '-', ''), 1, 8) || '@example.test', '', timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now()))
  on conflict (id) do nothing;

  insert into public.school_memberships (school_id, user_id, source)
  values
    (school_a_id, admin_a_id, 'system'),
    (school_b_id, admin_b_id, 'system'),
    (school_b_id, target_user_id, 'system')
  on conflict do nothing;

  insert into public.staff_profiles (user_id, email, display_name, profile_source, school_id)
  values
    (admin_a_id, 'rpc-admin-a@example.test', 'RPC Admin A', 'self_service', school_a_id),
    (admin_b_id, 'rpc-admin-b@example.test', 'RPC Admin B', 'self_service', school_b_id),
    (target_user_id, 'rpc-target@example.test', 'RPC Target User', 'self_service', school_b_id),
    (null, 'shared-pending@example.test', 'Pending A', 'csv_import', school_a_id),
    (null, 'shared-pending@example.test', 'Pending B', 'csv_import', school_b_id),
    (null, 'import-shared@example.test', 'Imported B', 'csv_import', school_b_id)
  on conflict do nothing;

  update public.staff_profiles
  set id = pending_profile_a_id
  where school_id = school_a_id
    and lower(email) = 'shared-pending@example.test'
    and user_id is null;

  update public.staff_profiles
  set id = pending_profile_b_id
  where school_id = school_b_id
    and lower(email) = 'shared-pending@example.test'
    and user_id is null;

  update public.staff_profiles
  set id = import_profile_b_id
  where school_id = school_b_id
    and lower(email) = 'import-shared@example.test'
    and user_id is null;

  insert into public.staff_role_assignments (user_id, role, active, granted_by, school_id)
  values
    (admin_a_id, 'admin', true, admin_a_id, school_a_id),
    (admin_b_id, 'admin', true, admin_b_id, school_b_id),
    (target_user_id, 'teacher', true, admin_b_id, school_b_id);

  insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
  values
    (admin_a_id, 'admin', 'school', school_a_id::text, true, admin_a_id, school_a_id),
    (admin_b_id, 'admin', 'school', school_b_id::text, true, admin_b_id, school_b_id);

  insert into public.teachers (id, display_name, school_id)
  values
    (admin_a_id, 'RPC Admin A', school_a_id),
    (admin_b_id, 'RPC Admin B', school_b_id),
    (target_user_id, 'RPC Target User', school_b_id)
  on conflict (id) do nothing;

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type, school_id)
  values
    (class_a_id, admin_a_id, 'Shared Tutor', upper(substr(replace(class_a_id::text, '-', ''), 1, 6)), 'Year 7', 'form', school_a_id),
    (class_b_id, admin_b_id, 'Shared Tutor', upper(substr(replace(class_b_id::text, '-', ''), 1, 6)), 'Year 7', 'form', school_b_id);

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
  values
    (school_b_pupil_id, 'SCHOOL-B-ONLY', 'Shared', 'School B', 'shared.schoolb', '1111', false, true, school_b_id);

  insert into public.pupil_classes (pupil_id, class_id, active, school_id)
  values (school_b_pupil_id, class_b_id, true, school_b_id);

  perform set_config('request.jwt.claim.sub', admin_a_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_a_id::text, 'role', 'authenticated')::text,
    true
  );

  perform public.grant_staff_role(target_user_id, 'hoy', school_a_id);

  insert into tenant_rpc_checks (name, bool_value)
  values
    (
      'grant_role_school_a_active',
      exists (
        select 1
        from public.staff_role_assignments
        where user_id = target_user_id
          and role = 'hoy'
          and active is true
          and school_id = school_a_id
      )
    ),
    (
      'grant_role_school_a_membership_created',
      exists (
        select 1
        from public.school_memberships
        where user_id = target_user_id
          and school_id = school_a_id
          and active is true
      )
    ),
    (
      'grant_role_preserves_school_b_teacher',
      exists (
        select 1
        from public.staff_role_assignments
        where user_id = target_user_id
          and role = 'teacher'
          and active is true
          and school_id = school_b_id
      )
    );

  begin
    perform public.grant_staff_role(target_user_id, 'teacher', school_a_id);
  exception
    when others then
      teacher_role_conflict_error := sqlerrm;
  end;

  insert into tenant_rpc_checks (name, bool_value)
  values (
    'same_role_cross_school_blocked',
    coalesce(teacher_role_conflict_error, '') like 'This staff member already has the TEACHER role in %'
  );

  perform public.grant_staff_scope(target_user_id, 'hoy', 'class', class_a_id::text, school_a_id);

  insert into tenant_rpc_checks (name, bool_value)
  values (
    'grant_scope_school_a_class_active',
    exists (
      select 1
      from public.staff_scope_assignments
      where user_id = target_user_id
        and role = 'hoy'
        and scope_type = 'class'
        and scope_value = class_a_id::text
        and active is true
        and school_id = school_a_id
    )
  );

  perform public.revoke_staff_scope(target_user_id, 'hoy', 'class', class_a_id::text, school_a_id);

  insert into tenant_rpc_checks (name, bool_value)
  values (
    'revoke_scope_only_school_a_scope',
    not exists (
      select 1
      from public.staff_scope_assignments
      where user_id = target_user_id
        and role = 'hoy'
        and scope_type = 'class'
        and scope_value = class_a_id::text
        and active is true
        and school_id = school_a_id
    )
  );

  perform public.revoke_staff_role(target_user_id, 'hoy', school_a_id);

  insert into tenant_rpc_checks (name, bool_value)
  values (
    'revoke_role_only_school_a_hoy',
    not exists (
      select 1
      from public.staff_role_assignments
      where user_id = target_user_id
        and role = 'hoy'
        and active is true
        and school_id = school_a_id
    )
    and exists (
      select 1
      from public.staff_role_assignments
      where user_id = target_user_id
        and role = 'teacher'
        and active is true
        and school_id = school_b_id
    )
  );

  pending_list_a := public.list_staff_pending_access_summaries(school_a_id);
  pending_detail_a := public.read_staff_pending_access_detail(pending_profile_a_id, school_a_id);
  pending_save_result := public.save_staff_pending_access_approval(
    pending_profile_a_id,
    jsonb_build_array('teacher'),
    '[]'::jsonb,
    school_a_id
  );
  pending_cancel_result := public.cancel_staff_pending_access_approval(pending_profile_a_id, school_a_id);
  staff_preflight_a := public.staff_pending_access_duplicate_preflight(school_a_id);
  staff_import_result := public.import_staff_directory_csv(
    jsonb_build_array(
      jsonb_build_object(
        'final_action', 'create',
        'email', 'import-shared@example.test',
        'full_name', 'Imported A'
      )
    ),
    'staff-a.csv',
    jsonb_build_object('total_rows', 1),
    school_a_id
  );
  pupil_preflight_a := public.pupil_directory_duplicate_preflight(school_a_id);
  pupil_import_result := public.import_pupil_roster_csv(
    jsonb_build_array(
      jsonb_build_object(
        'final_action', 'create',
        'row_number', 1,
        'mis_id', 'SCHOOL-A-ONLY',
        'first_name', 'School',
        'surname', 'A Import',
        'form_class', 'Shared Tutor',
        'year_group', 'Year 7'
      )
    ),
    'pupils-a.csv',
    jsonb_build_object('total_rows', 1),
    school_a_id
  );

  insert into tenant_rpc_checks (name, bool_value)
  values
    (
      'pending_summaries_scoped_to_school_a',
      (
        select count(*)
        from jsonb_array_elements(pending_list_a) as item
        where item ->> 'staff_profile_id' = pending_profile_a_id::text
      ) = 1
      and (
        select count(*)
        from jsonb_array_elements(pending_list_a) as item
        where item ->> 'staff_profile_id' = pending_profile_b_id::text
      ) = 0
    ),
    (
      'pending_detail_school_a_can_approve',
      coalesce((pending_detail_a ->> 'can_approve')::boolean, false)
      and jsonb_array_length(coalesce(pending_detail_a -> 'duplicate_conflicts', '[]'::jsonb)) = 0
    ),
    (
      'pending_save_school_a_row',
      coalesce(pending_save_result -> 'approval' ->> 'status', '') = 'approved'
      and exists (
        select 1
        from public.staff_pending_access_approvals
        where id = (pending_save_result -> 'approval' ->> 'id')::uuid
          and school_id = school_a_id
      )
    ),
    (
      'pending_cancel_school_a_row',
      coalesce(pending_cancel_result -> 'approval' ->> 'status', '') = 'cancelled'
    ),
    (
      'staff_preflight_school_a_ignores_school_b_duplicates',
      coalesce((staff_preflight_a ->> 'has_conflicts')::boolean, false) = false
    ),
    (
      'staff_import_creates_school_a_profile',
      coalesce((staff_import_result ->> 'created_count')::integer, 0) = 1
      and (
        select count(*)
        from public.staff_profiles
        where lower(email) = 'import-shared@example.test'
          and school_id = school_a_id
      ) = 1
      and (
        select count(*)
        from public.staff_profiles
        where lower(email) = 'import-shared@example.test'
          and school_id = school_b_id
      ) = 1
    ),
    (
      'staff_import_batch_school_a',
      exists (
        select 1
        from public.staff_import_batches
        where id = (staff_import_result ->> 'batch_id')::uuid
          and school_id = school_a_id
      )
    ),
    (
      'pupil_mis_id_global_unique_constraint_present',
      exists (
        select 1
        from pg_constraint
        where conrelid = 'public.pupils'::regclass
          and conname = 'pupils_mis_id_key'
      )
    ),
    (
      'pupil_username_global_unique_constraint_present',
      exists (
        select 1
        from pg_constraint
        where conrelid = 'public.pupils'::regclass
          and conname = 'pupils_username_key'
      )
    ),
    (
      'pupil_preflight_school_a_has_no_conflicts_under_global_uniqueness',
      coalesce((pupil_preflight_a ->> 'has_conflicts')::boolean, false) = false
      and coalesce((pupil_preflight_a ->> 'mis_id_conflict_count')::integer, 0) = 0
      and coalesce((pupil_preflight_a ->> 'username_conflict_count')::integer, 0) = 0
    ),
    (
      'pupil_import_school_a_created_only_in_school_a',
      coalesce((pupil_import_result ->> 'created_count')::integer, 0) = 1
      and (
        select count(*)
        from public.pupils
        where mis_id = 'SCHOOL-A-ONLY'
      ) = 1
      and exists (
        select 1
        from public.pupils
        where mis_id = 'SCHOOL-A-ONLY'
          and school_id = school_a_id
      )
      and not exists (
        select 1
        from public.pupils
        where mis_id = 'SCHOOL-A-ONLY'
          and school_id = school_b_id
      )
    ),
    (
      'pupil_import_membership_school_a_class_only',
      exists (
        select 1
        from public.pupil_classes as pc
        join public.pupils as p
          on p.id = pc.pupil_id
        where p.mis_id = 'SCHOOL-A-ONLY'
          and p.school_id = school_a_id
          and pc.class_id = class_a_id
          and pc.active is true
          and pc.school_id = school_a_id
      )
      and not exists (
        select 1
        from public.pupil_classes as pc
        join public.pupils as p
          on p.id = pc.pupil_id
        where p.mis_id = 'SCHOOL-A-ONLY'
          and pc.class_id = class_b_id
      )
    ),
    (
      'pupil_import_batch_school_a',
      exists (
        select 1
        from public.pupil_import_batches
        where id = (pupil_import_result ->> 'batch_id')::uuid
          and school_id = school_a_id
      )
    );

  perform set_config('request.jwt.claim.sub', admin_b_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_b_id::text, 'role', 'authenticated')::text,
    true
  );

  pupil_preflight_b := public.pupil_directory_duplicate_preflight(school_b_id);

  insert into tenant_rpc_checks (name, bool_value)
  values (
    'pupil_preflight_school_b_has_no_conflicts_under_global_uniqueness',
    coalesce((pupil_preflight_b ->> 'has_conflicts')::boolean, false) = false
    and coalesce((pupil_preflight_b ->> 'mis_id_conflict_count')::integer, 0) = 0
    and coalesce((pupil_preflight_b ->> 'username_conflict_count')::integer, 0) = 0
  );
end;
$$;

select ok((select bool_value from tenant_rpc_checks where name = 'grant_role_school_a_active'), 'grant_staff_role writes the granted role into the requested school');
select ok((select bool_value from tenant_rpc_checks where name = 'grant_role_school_a_membership_created'), 'grant_staff_role creates membership in the requested school');
select ok((select bool_value from tenant_rpc_checks where name = 'grant_role_preserves_school_b_teacher'), 'grant_staff_role leaves other-school roles untouched');
select ok((select bool_value from tenant_rpc_checks where name = 'same_role_cross_school_blocked'), 'grant_staff_role blocks the same active role in another school instead of moving it');
select ok((select bool_value from tenant_rpc_checks where name = 'grant_scope_school_a_class_active'), 'grant_staff_scope writes the scope into the requested school');
select ok((select bool_value from tenant_rpc_checks where name = 'revoke_scope_only_school_a_scope'), 'revoke_staff_scope only deactivates the requested school scope');
select ok((select bool_value from tenant_rpc_checks where name = 'revoke_role_only_school_a_hoy'), 'revoke_staff_role only deactivates the requested school role');
select ok((select bool_value from tenant_rpc_checks where name = 'pending_summaries_scoped_to_school_a'), 'pending approval summaries are scoped to the requested school');
select ok((select bool_value from tenant_rpc_checks where name = 'pending_detail_school_a_can_approve'), 'pending approval detail ignores duplicate conflicts from other schools');
select ok((select bool_value from tenant_rpc_checks where name = 'pending_save_school_a_row'), 'pending approval save stores school_id on the approval row');
select ok((select bool_value from tenant_rpc_checks where name = 'pending_cancel_school_a_row'), 'pending approval cancel only updates the requested school approval');
select ok((select bool_value from tenant_rpc_checks where name = 'staff_preflight_school_a_ignores_school_b_duplicates'), 'staff duplicate preflight is scoped to the requested school');
select ok((select bool_value from tenant_rpc_checks where name = 'staff_import_creates_school_a_profile'), 'staff CSV import creates or updates records inside the requested school only');
select ok((select bool_value from tenant_rpc_checks where name = 'staff_import_batch_school_a'), 'staff CSV import batches record the requested school_id');
select ok((select bool_value from tenant_rpc_checks where name = 'pupil_mis_id_global_unique_constraint_present'), 'pupils.mis_id remains globally unique today');
select ok((select bool_value from tenant_rpc_checks where name = 'pupil_username_global_unique_constraint_present'), 'pupils.username remains globally unique today');
select ok((select bool_value from tenant_rpc_checks where name = 'pupil_preflight_school_a_has_no_conflicts_under_global_uniqueness'), 'pupil duplicate preflight returns no conflicts in School A under the current global uniqueness model');
select ok((select bool_value from tenant_rpc_checks where name = 'pupil_preflight_school_b_has_no_conflicts_under_global_uniqueness'), 'pupil duplicate preflight returns no conflicts in School B under the current global uniqueness model');
select ok((select bool_value from tenant_rpc_checks where name = 'pupil_import_school_a_created_only_in_school_a'), 'pupil import commit creates a new pupil only inside the requested school');
select ok((select bool_value from tenant_rpc_checks where name = 'pupil_import_membership_school_a_class_only'), 'pupil import commit resolves same-named classes inside the requested school only');
select ok((select bool_value from tenant_rpc_checks where name = 'pupil_import_batch_school_a'), 'pupil import batches record the requested school_id');

select * from finish();

rollback;
