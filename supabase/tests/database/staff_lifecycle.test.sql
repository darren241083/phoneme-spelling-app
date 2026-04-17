begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(23);

create temporary table test_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table lifecycle_checks (
  name text primary key,
  bool_value boolean,
  int_value integer,
  text_value text
) on commit drop;

insert into test_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'admin_user',
  'second_admin_user',
  'non_admin_user',
  'revoke_user',
  'archive_user',
  'admin_profile',
  'second_admin_profile',
  'revoke_profile',
  'archive_profile',
  'archive_approval'
]) as names(name);

do $$
declare
  admin_user_id uuid := (select id from test_ids where name = 'admin_user');
  second_admin_user_id uuid := (select id from test_ids where name = 'second_admin_user');
  non_admin_user_id uuid := (select id from test_ids where name = 'non_admin_user');
  revoke_user_id uuid := (select id from test_ids where name = 'revoke_user');
  archive_user_id uuid := (select id from test_ids where name = 'archive_user');
  admin_profile_id uuid := (select id from test_ids where name = 'admin_profile');
  second_admin_profile_id uuid := (select id from test_ids where name = 'second_admin_profile');
  revoke_profile_id uuid := (select id from test_ids where name = 'revoke_profile');
  archive_profile_id uuid := (select id from test_ids where name = 'archive_profile');
  archive_approval_id uuid := (select id from test_ids where name = 'archive_approval');
  non_admin_archive_error text := null;
  non_admin_restore_error text := null;
  non_admin_revoke_error text := null;
  last_admin_revoke_error text := null;
  last_admin_archive_error text := null;
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
  select
    id,
    'authenticated',
    'authenticated',
    'pgtap-staff-life-' || name || '-' || substr(replace(id::text, '-', ''), 1, 8) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  from test_ids
  where name in ('admin_user', 'second_admin_user', 'non_admin_user', 'revoke_user', 'archive_user')
  on conflict (id) do nothing;

  insert into public.staff_profiles (
    id,
    user_id,
    email,
    display_name,
    profile_source,
    created_at,
    updated_at
  )
  values
    (admin_profile_id, admin_user_id, 'pgtap-staff-life-admin@example.test', 'pgTAP Admin Lifecycle', 'self_service', timezone('utc', now()), timezone('utc', now())),
    (second_admin_profile_id, second_admin_user_id, 'pgtap-staff-life-second-admin@example.test', 'pgTAP Second Admin Lifecycle', 'self_service', timezone('utc', now()), timezone('utc', now())),
    (revoke_profile_id, revoke_user_id, 'pgtap-staff-life-revoke@example.test', 'pgTAP Revoke Lifecycle', 'self_service', timezone('utc', now()), timezone('utc', now())),
    (archive_profile_id, archive_user_id, 'pgtap-staff-life-archive@example.test', 'pgTAP Archive Lifecycle', 'self_service', timezone('utc', now()), timezone('utc', now()));

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values
    (admin_user_id, 'admin', true, admin_user_id),
    (second_admin_user_id, 'admin', true, admin_user_id),
    (revoke_user_id, 'teacher', true, admin_user_id),
    (revoke_user_id, 'hoy', true, admin_user_id),
    (archive_user_id, 'teacher', true, admin_user_id),
    (archive_user_id, 'hod', true, admin_user_id);

  insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by)
  values
    (revoke_user_id, 'hoy', 'year_group', 'Year 7', true, admin_user_id),
    (revoke_user_id, 'hoy', 'class', gen_random_uuid()::text, true, admin_user_id),
    (archive_user_id, 'hod', 'department', 'English', true, admin_user_id),
    (archive_user_id, 'hod', 'class', gen_random_uuid()::text, true, admin_user_id);

  insert into public.staff_pending_access_approvals (
    id,
    staff_profile_id,
    status,
    approved_email,
    approved_by,
    approved_at,
    stale_after_at,
    metadata,
    created_at,
    updated_at
  )
  values (
    archive_approval_id,
    archive_profile_id,
    'approved',
    'pgtap-staff-life-archive@example.test',
    admin_user_id,
    timezone('utc', now()),
    timezone('utc', now()) + interval '30 days',
    jsonb_build_object('source', 'pgtap_staff_lifecycle_fixture'),
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.staff_pending_role_assignments (approval_id, role)
  values (archive_approval_id, 'teacher');

  perform set_config('request.jwt.claim.sub', non_admin_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', non_admin_user_id::text, 'role', 'authenticated')::text,
    true
  );

  begin
    perform public.archive_staff_directory_record(archive_profile_id, 'pgTAP non-admin archive attempt');
  exception
    when others then
      non_admin_archive_error := sqlerrm;
  end;

  begin
    perform public.restore_staff_directory_record(archive_profile_id, 'pgTAP non-admin restore attempt');
  exception
    when others then
      non_admin_restore_error := sqlerrm;
  end;

  begin
    perform public.revoke_all_staff_live_access(revoke_user_id, 'pgTAP non-admin revoke attempt');
  exception
    when others then
      non_admin_revoke_error := sqlerrm;
  end;

  insert into lifecycle_checks (name, bool_value)
  values
    ('non_admin_archive_blocked', coalesce(non_admin_archive_error, '') like 'Admin access is required%'),
    ('non_admin_restore_blocked', coalesce(non_admin_restore_error, '') like 'Admin access is required%'),
    ('non_admin_revoke_blocked', coalesce(non_admin_revoke_error, '') like 'Admin access is required%');

  perform set_config('request.jwt.claim.sub', admin_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_user_id::text, 'role', 'authenticated')::text,
    true
  );

  perform public.revoke_all_staff_live_access(revoke_user_id, 'pgTAP revoke live access');

  insert into lifecycle_checks (name, bool_value)
  select 'revoke_roles_inactive', not exists (
    select 1
    from public.staff_role_assignments
    where user_id = revoke_user_id
      and active is true
  );

  insert into lifecycle_checks (name, bool_value)
  select 'revoke_scopes_inactive', not exists (
    select 1
    from public.staff_scope_assignments
    where user_id = revoke_user_id
      and active is true
  );

  insert into lifecycle_checks (name, int_value)
  select 'revoke_access_role_audit_count', count(*)::integer
  from public.staff_access_audit_log
  where target_user_id = revoke_user_id
    and action = 'revoke_role'
    and metadata ->> 'source' = 'revoke_all_staff_live_access';

  insert into lifecycle_checks (name, int_value)
  select 'revoke_access_scope_audit_count', count(*)::integer
  from public.staff_access_audit_log
  where target_user_id = revoke_user_id
    and action = 'revoke_scope'
    and metadata ->> 'source' = 'revoke_all_staff_live_access';

  insert into lifecycle_checks (name, int_value)
  select 'revoke_directory_audit_count', count(*)::integer
  from public.staff_directory_audit_log
  where target_user_id = revoke_user_id
    and target_profile_id = revoke_profile_id
    and action = 'revoke_all_live_access';

  perform public.archive_staff_directory_record(archive_profile_id, 'pgTAP archive staff record');

  insert into lifecycle_checks (name, bool_value)
  select 'archive_sets_fields',
    sp.archived_at is not null
    and sp.archived_by = admin_user_id
    and sp.archive_reason = 'pgTAP archive staff record'
  from public.staff_profiles as sp
  where sp.id = archive_profile_id;

  insert into lifecycle_checks (name, bool_value)
  select 'archive_roles_inactive', not exists (
    select 1
    from public.staff_role_assignments
    where user_id = archive_user_id
      and active is true
  );

  insert into lifecycle_checks (name, bool_value)
  select 'archive_scopes_inactive', not exists (
    select 1
    from public.staff_scope_assignments
    where user_id = archive_user_id
      and active is true
  );

  insert into lifecycle_checks (name, text_value)
  select 'archive_pending_status', status
  from public.staff_pending_access_approvals
  where id = archive_approval_id;

  insert into lifecycle_checks (name, int_value)
  select 'archive_directory_audit_count', count(*)::integer
  from public.staff_directory_audit_log
  where target_profile_id = archive_profile_id
    and action = 'archive';

  insert into lifecycle_checks (name, int_value)
  select 'archive_access_role_audit_count', count(*)::integer
  from public.staff_access_audit_log
  where target_user_id = archive_user_id
    and action = 'revoke_role'
    and metadata ->> 'source' = 'revoke_all_staff_live_access';

  perform public.restore_staff_directory_record(archive_profile_id, 'pgTAP restore staff record');

  insert into lifecycle_checks (name, bool_value)
  select 'restore_clears_archive_fields',
    sp.archived_at is null
    and sp.archived_by is null
    and sp.archive_reason is null
  from public.staff_profiles as sp
  where sp.id = archive_profile_id;

  insert into lifecycle_checks (name, bool_value)
  select 'restore_roles_remain_inactive', not exists (
    select 1
    from public.staff_role_assignments
    where user_id = archive_user_id
      and active is true
  );

  insert into lifecycle_checks (name, bool_value)
  select 'restore_scopes_remain_inactive', not exists (
    select 1
    from public.staff_scope_assignments
    where user_id = archive_user_id
      and active is true
  );

  insert into lifecycle_checks (name, text_value)
  select 'restore_pending_status', status
  from public.staff_pending_access_approvals
  where id = archive_approval_id;

  insert into lifecycle_checks (name, int_value)
  select 'restore_directory_audit_count', count(*)::integer
  from public.staff_directory_audit_log
  where target_profile_id = archive_profile_id
    and action = 'restore';

  update public.staff_role_assignments
  set active = false,
      updated_at = timezone('utc', now())
  where user_id = second_admin_user_id
    and role = 'admin'
    and active is true;

  begin
    perform public.revoke_staff_role(admin_user_id, 'admin');
  exception
    when others then
      last_admin_revoke_error := sqlerrm;
  end;

  begin
    perform public.archive_staff_directory_record(admin_profile_id, 'pgTAP archive last admin attempt');
  exception
    when others then
      last_admin_archive_error := sqlerrm;
  end;

  insert into lifecycle_checks (name, bool_value)
  values
    ('last_admin_revoke_blocked', coalesce(last_admin_revoke_error, '') like 'At least one active admin must remain.%'),
    ('last_admin_archive_blocked', coalesce(last_admin_archive_error, '') like 'At least one active admin must remain.%');

  insert into lifecycle_checks (name, bool_value)
  select 'last_admin_role_still_active', exists (
    select 1
    from public.staff_role_assignments
    where user_id = admin_user_id
      and role = 'admin'
      and active is true
  );

  insert into lifecycle_checks (name, bool_value)
  select 'last_admin_profile_not_archived', sp.archived_at is null
  from public.staff_profiles as sp
  where sp.id = admin_profile_id;
end;
$$;

select ok((select bool_value from lifecycle_checks where name = 'non_admin_archive_blocked'), 'non-admin cannot archive a staff record');
select ok((select bool_value from lifecycle_checks where name = 'non_admin_restore_blocked'), 'non-admin cannot restore a staff record');
select ok((select bool_value from lifecycle_checks where name = 'non_admin_revoke_blocked'), 'non-admin cannot revoke all live staff access');
select ok((select bool_value from lifecycle_checks where name = 'revoke_roles_inactive'), 'revoke-all-live-access deactivates active roles');
select ok((select bool_value from lifecycle_checks where name = 'revoke_scopes_inactive'), 'revoke-all-live-access deactivates active scopes');
select is((select int_value from lifecycle_checks where name = 'revoke_access_role_audit_count'), 2, 'revoke-all-live-access writes role access audit rows');
select is((select int_value from lifecycle_checks where name = 'revoke_access_scope_audit_count'), 2, 'revoke-all-live-access writes scope access audit rows');
select is((select int_value from lifecycle_checks where name = 'revoke_directory_audit_count'), 1, 'revoke-all-live-access writes one directory audit row');
select ok((select bool_value from lifecycle_checks where name = 'archive_sets_fields'), 'archive sets archive fields and reason');
select ok((select bool_value from lifecycle_checks where name = 'archive_roles_inactive'), 'archive revokes active roles');
select ok((select bool_value from lifecycle_checks where name = 'archive_scopes_inactive'), 'archive revokes active scopes');
select is((select text_value from lifecycle_checks where name = 'archive_pending_status'), 'invalidated', 'archive invalidates pending approval');
select is((select int_value from lifecycle_checks where name = 'archive_directory_audit_count'), 1, 'archive writes one directory audit row');
select is((select int_value from lifecycle_checks where name = 'archive_access_role_audit_count'), 2, 'archive writes separate access audit rows for revoked roles');
select ok((select bool_value from lifecycle_checks where name = 'restore_clears_archive_fields'), 'restore clears archive fields');
select ok((select bool_value from lifecycle_checks where name = 'restore_roles_remain_inactive'), 'restore does not recreate live roles');
select ok((select bool_value from lifecycle_checks where name = 'restore_scopes_remain_inactive'), 'restore does not recreate live scopes');
select is((select text_value from lifecycle_checks where name = 'restore_pending_status'), 'invalidated', 'restore does not recreate pending approval');
select is((select int_value from lifecycle_checks where name = 'restore_directory_audit_count'), 1, 'restore writes one directory audit row');
select ok((select bool_value from lifecycle_checks where name = 'last_admin_revoke_blocked'), 'last active admin cannot be directly revoked');
select ok((select bool_value from lifecycle_checks where name = 'last_admin_archive_blocked'), 'last active admin cannot be archived');
select ok((select bool_value from lifecycle_checks where name = 'last_admin_role_still_active'), 'blocked last-admin actions leave admin role active');
select ok((select bool_value from lifecycle_checks where name = 'last_admin_profile_not_archived'), 'blocked last-admin archive leaves profile active');

select * from finish();

rollback;
