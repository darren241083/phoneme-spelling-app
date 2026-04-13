alter table if exists public.classes
  add column if not exists department_key text;

comment on column public.classes.department_key is
  'Manual department mapping for HOD scope. Leave null until subject classes are explicitly mapped.';

create index if not exists idx_classes_teacher_department_name
  on public.classes (teacher_id, department_key, name);

create index if not exists idx_classes_year_group_name
  on public.classes (year_group, name);

create table if not exists public.staff_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('admin', 'teacher', 'hoy', 'hod')),
  active boolean not null default true,
  granted_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_staff_role_assignments_user_role_active_unique
  on public.staff_role_assignments (user_id, role)
  where active is true;

create index if not exists idx_staff_role_assignments_user_active
  on public.staff_role_assignments (user_id, updated_at desc)
  where active is true;

create table if not exists public.staff_scope_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('admin', 'teacher', 'hoy', 'hod')),
  scope_type text not null check (scope_type in ('school', 'year_group', 'department', 'class')),
  scope_value text not null,
  active boolean not null default true,
  granted_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_staff_scope_assignments_user_role_scope_active_unique
  on public.staff_scope_assignments (user_id, role, scope_type, scope_value)
  where active is true;

create index if not exists idx_staff_scope_assignments_lookup
  on public.staff_scope_assignments (user_id, scope_type, scope_value, updated_at desc)
  where active is true;

create table if not exists public.staff_access_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  target_user_id uuid not null,
  action text not null check (action in ('bootstrap_admin', 'grant_role', 'revoke_role', 'grant_scope', 'revoke_scope')),
  role text check (role in ('admin', 'teacher', 'hoy', 'hod')),
  scope_type text check (scope_type in ('school', 'year_group', 'department', 'class')),
  scope_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_staff_access_audit_log_target_created
  on public.staff_access_audit_log (target_user_id, created_at desc);

create index if not exists idx_staff_access_audit_log_actor_created
  on public.staff_access_audit_log (actor_user_id, created_at desc);

revoke all on table public.staff_role_assignments from public;
revoke all on table public.staff_scope_assignments from public;
revoke all on table public.staff_access_audit_log from public;
revoke insert, update, delete on table public.staff_role_assignments from authenticated, anon;
revoke insert, update, delete on table public.staff_scope_assignments from authenticated, anon;
revoke insert, update, delete on table public.staff_access_audit_log from authenticated, anon;

grant select on table public.staff_role_assignments to authenticated;
grant select on table public.staff_scope_assignments to authenticated;
grant select on table public.staff_access_audit_log to authenticated;

alter table if exists public.staff_role_assignments
  enable row level security;

alter table if exists public.staff_scope_assignments
  enable row level security;

alter table if exists public.staff_access_audit_log
  enable row level security;

create or replace function public.legacy_teacher_app_role(requested_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select (
    select case
      when tar.app_role in ('teacher', 'central_owner') then tar.app_role
      else null
    end
    from public.teacher_app_roles as tar
    where tar.teacher_id = requested_user_id
    limit 1
  );
$$;

create or replace function public.has_role(requested_role text, requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_role_assignments as sra
    where sra.user_id = requested_user_id
      and sra.active is true
      and sra.role = lower(btrim(requested_role))
  );
$$;

create or replace function public.is_admin_compat(requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    requested_user_id is not null
    and (
      public.has_role('admin', requested_user_id)
      or public.legacy_teacher_app_role(requested_user_id) = 'central_owner'
    ),
    false
  );
$$;

create or replace function public.is_teacher_compat(requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    requested_user_id is not null
    and (
      public.has_role('teacher', requested_user_id)
      or public.is_admin_compat(requested_user_id)
      or public.legacy_teacher_app_role(requested_user_id) = 'teacher'
    ),
    false
  );
$$;

create or replace function public.has_scope(
  requested_scope_type text,
  requested_scope_value text,
  requested_role text default null,
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_scope_assignments as ssa
    join public.staff_role_assignments as sra
      on sra.user_id = ssa.user_id
     and sra.role = ssa.role
     and sra.active is true
    where ssa.user_id = requested_user_id
      and ssa.active is true
      and ssa.scope_type = lower(btrim(requested_scope_type))
      and ssa.scope_value = btrim(coalesce(requested_scope_value, ''))
      and (
        requested_role is null
        or ssa.role = lower(btrim(requested_role))
      )
  );
$$;

create or replace function public.can_view_class(requested_class_id uuid, requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes as c
    where c.id = requested_class_id
      and (
        public.is_admin_compat(requested_user_id)
        or c.teacher_id = requested_user_id
        or public.has_scope('school', 'default', 'admin', requested_user_id)
        or public.has_scope('class', c.id::text, null, requested_user_id)
        or (
          nullif(btrim(coalesce(c.year_group, '')), '') is not null
          and public.has_scope('year_group', c.year_group, 'hoy', requested_user_id)
        )
        or (
          nullif(btrim(coalesce(c.department_key, '')), '') is not null
          and public.has_scope('department', c.department_key, 'hod', requested_user_id)
        )
      )
  );
$$;

create or replace function public.can_view_pupil(requested_pupil_id uuid, requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pupil_classes as pc
    where pc.pupil_id = requested_pupil_id
      and pc.active is true
      and public.can_view_class(pc.class_id, requested_user_id)
  );
$$;

create or replace function public.can_view_assignment(requested_assignment_id uuid, requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments_v2 as a
    where a.id = requested_assignment_id
      and public.can_view_class(a.class_id, requested_user_id)
  );
$$;

create or replace function public.can_view_test(requested_test_id uuid, requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tests as t
    where t.id = requested_test_id
      and (
        t.teacher_id = requested_user_id
        or exists (
          select 1
          from public.assignments_v2 as a
          where a.test_id = t.id
            and public.can_view_class(a.class_id, requested_user_id)
        )
      )
  );
$$;

create or replace function public.can_manage_automation(requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_compat(requested_user_id);
$$;

create or replace function public.can_import_csv(requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_compat(requested_user_id);
$$;

create or replace function public.can_manage_roles(requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_compat(requested_user_id);
$$;

create or replace function public.list_viewable_class_ids(
  requested_user_id uuid,
  requested_class_id uuid default null,
  requested_year_group text default null,
  requested_department_key text default null
)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.classes as c
  where (requested_class_id is null or c.id = requested_class_id)
    and (
      nullif(btrim(coalesce(requested_year_group, '')), '') is null
      or lower(btrim(coalesce(c.year_group, ''))) = lower(btrim(requested_year_group))
    )
    and (
      nullif(btrim(coalesce(requested_department_key, '')), '') is null
      or lower(btrim(coalesce(c.department_key, ''))) = lower(btrim(requested_department_key))
    )
    and public.can_view_class(c.id, requested_user_id)
  order by c.id;
$$;

create or replace function public.list_unmapped_department_classes()
returns setof public.classes
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_manage_roles(auth.uid()) then
    return;
  end if;

  return query
  select c.*
  from public.classes as c
  where c.class_type = 'subject'
    and nullif(btrim(coalesce(c.department_key, '')), '') is null
  order by c.name, c.created_at;
end;
$$;

create or replace function public.get_my_access_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  legacy_role text := public.legacy_teacher_app_role(current_user_id);
  has_admin_role boolean := public.has_role('admin', current_user_id);
  has_teacher_role boolean := public.has_role('teacher', current_user_id);
  has_hoy_role boolean := public.has_role('hoy', current_user_id);
  has_hod_role boolean := public.has_role('hod', current_user_id);
  has_admin_compat boolean := public.is_admin_compat(current_user_id);
  has_teacher_compat boolean := public.is_teacher_compat(current_user_id);
  school_scope boolean := false;
  scoped_year_groups text[] := array[]::text[];
  scoped_departments text[] := array[]::text[];
  scoped_class_ids text[] := array[]::text[];
  unmapped_subject_class_count integer := 0;
begin
  if current_user_id is not null then
    select
      public.has_scope('school', 'default', 'admin', current_user_id),
      coalesce(
        array_agg(distinct ssa.scope_value order by ssa.scope_value)
          filter (where ssa.scope_type = 'year_group'),
        array[]::text[]
      ),
      coalesce(
        array_agg(distinct ssa.scope_value order by ssa.scope_value)
          filter (where ssa.scope_type = 'department'),
        array[]::text[]
      ),
      coalesce(
        array_agg(distinct ssa.scope_value order by ssa.scope_value)
          filter (where ssa.scope_type = 'class'),
        array[]::text[]
      )
    into school_scope, scoped_year_groups, scoped_departments, scoped_class_ids
    from public.staff_scope_assignments as ssa
    join public.staff_role_assignments as sra
      on sra.user_id = ssa.user_id
     and sra.role = ssa.role
     and sra.active is true
    where ssa.user_id = current_user_id
      and ssa.active is true;
  end if;

  if has_admin_compat then
    school_scope := true;
    select count(*)
    into unmapped_subject_class_count
    from public.classes as c
    where c.class_type = 'subject'
      and nullif(btrim(coalesce(c.department_key, '')), '') is null;
  end if;

  return jsonb_build_object(
    'version', 1,
    'user_id', current_user_id,
    'legacy', jsonb_build_object(
      'teacher_app_role', legacy_role,
      'is_legacy_central_owner', legacy_role = 'central_owner'
    ),
    'roles', jsonb_build_object(
      'admin', has_admin_role,
      'teacher', has_teacher_role,
      'hoy', has_hoy_role,
      'hod', has_hod_role
    ),
    'capabilities', jsonb_build_object(
      'can_manage_automation', has_admin_compat,
      'can_import_csv', has_admin_compat,
      'can_manage_roles', has_admin_compat,
      'can_create_classes', has_teacher_compat,
      'can_create_tests', has_teacher_compat,
      'can_assign_tests', has_teacher_compat,
      'can_manage_intervention_groups', has_admin_compat,
      'can_manage_own_content', has_teacher_compat,
      'can_view_schoolwide_analytics', has_admin_compat
    ),
    'scopes', jsonb_build_object(
      'school', school_scope,
      'year_groups', to_jsonb(coalesce(scoped_year_groups, array[]::text[])),
      'departments', to_jsonb(coalesce(scoped_departments, array[]::text[])),
      'class_ids', to_jsonb(coalesce(scoped_class_ids, array[]::text[]))
    ),
    'data_health', jsonb_build_object(
      'unmapped_subject_class_count', unmapped_subject_class_count
    )
  );
end;
$$;

comment on function public.get_my_access_context() is
  'Stable version 1 frontend access-context payload for capability gating and scoped reads.';

create or replace function public.user_has_staff_data(requested_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from (
      select teacher_id as user_id from public.teacher_app_roles
      union all
      select teacher_id as user_id from public.classes
      union all
      select teacher_id as user_id from public.tests
      union all
      select teacher_id as user_id from public.assignments_v2
      union all
      select teacher_id as user_id from public.class_auto_assignment_policies
      union all
      select teacher_id as user_id from public.teacher_ai_threads
      union all
      select teacher_id as user_id from public.teacher_pupil_group_values
      union all
      select teacher_id as user_id from public.personalised_generation_runs
      union all
      select teacher_id as user_id from public.personalised_automation_policies
    ) as sources
    where sources.user_id = requested_user_id
  );
$$;

create or replace function public.log_staff_access_event(
  actor_user_id uuid,
  target_user_id uuid,
  event_action text,
  event_role text default null,
  event_scope_type text default null,
  event_scope_value text default null,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_access_audit_log (
    actor_user_id,
    target_user_id,
    action,
    role,
    scope_type,
    scope_value,
    metadata
  )
  values (
    actor_user_id,
    target_user_id,
    event_action,
    event_role,
    event_scope_type,
    event_scope_value,
    coalesce(event_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.bootstrap_first_admin(target_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  audit_actor_user_id uuid := coalesce(auth.uid(), target_user_id);
  active_admin_count integer := 0;
  bootstrap_mode text := 'self_service';
begin
  if target_user_id is null then
    raise exception 'Choose a staff account before bootstrapping admin access.';
  end if;

  if actor_user_id is null then
    if actor_role not in ('service_role', 'postgres') then
      raise exception 'Sign in is required before bootstrapping admin access.';
    end if;
    bootstrap_mode := 'manual_seed';
  elsif target_user_id is distinct from actor_user_id then
    raise exception 'You can only bootstrap your own admin access.';
  end if;

  select count(*)
  into active_admin_count
  from public.staff_role_assignments
  where role = 'admin'
    and active is true;

  if active_admin_count > 0 then
    raise exception 'An active admin already exists. Use the admin role assignment functions instead.';
  end if;

  if not public.user_has_staff_data(target_user_id) then
    raise exception 'First admin bootstrap is only available for an existing staff account.';
  end if;

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values (target_user_id, 'admin', true, audit_actor_user_id)
  on conflict do nothing;

  update public.staff_role_assignments
  set active = true,
      granted_by = audit_actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = 'admin';

  insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by)
  values (target_user_id, 'admin', 'school', 'default', true, audit_actor_user_id)
  on conflict do nothing;

  update public.staff_scope_assignments
  set active = true,
      granted_by = audit_actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = 'admin'
    and scope_type = 'school'
    and scope_value = 'default';

  perform public.log_staff_access_event(
    audit_actor_user_id,
    target_user_id,
    'bootstrap_admin',
    'admin',
    'school',
    'default',
    jsonb_build_object(
      'source', 'bootstrap_first_admin',
      'bootstrap_mode', bootstrap_mode,
      'actor_role', actor_role
    )
  );

  if actor_user_id is not null and actor_user_id = target_user_id then
    return public.get_my_access_context();
  end if;

  return jsonb_build_object(
    'version', 1,
    'user_id', target_user_id,
    'roles', jsonb_build_object(
      'admin', true,
      'teacher', public.has_role('teacher', target_user_id),
      'hoy', public.has_role('hoy', target_user_id),
      'hod', public.has_role('hod', target_user_id)
    ),
    'capabilities', jsonb_build_object(
      'can_manage_automation', true,
      'can_import_csv', true,
      'can_manage_roles', true
    ),
    'scopes', jsonb_build_object(
      'school', true,
      'year_groups', jsonb_build_array(),
      'departments', jsonb_build_array(),
      'class_ids', jsonb_build_array()
    ),
    'bootstrap_mode', bootstrap_mode
  );
end;
$$;

comment on function public.bootstrap_first_admin(uuid) is
  'If legacy central_owner backfill leaves zero active admins, run select public.bootstrap_first_admin(''<user_uuid>''); as the first admin user or from SQL editor.';

create or replace function public.grant_staff_role(target_user_id uuid, requested_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_role text := lower(btrim(coalesce(requested_role, '')));
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before changing staff roles.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
    raise exception 'Admin access is required to manage staff roles.';
  end if;

  if target_user_id is null then
    raise exception 'Choose a staff account before granting a role.';
  end if;

  if safe_role not in ('admin', 'teacher', 'hoy', 'hod') then
    raise exception 'Invalid role.';
  end if;

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values (target_user_id, safe_role, true, actor_user_id)
  on conflict do nothing;

  update public.staff_role_assignments
  set active = true,
      granted_by = actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role;

  if safe_role = 'admin' then
    insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by)
    values (target_user_id, 'admin', 'school', 'default', true, actor_user_id)
    on conflict do nothing;

    update public.staff_scope_assignments
    set active = true,
        granted_by = actor_user_id,
        updated_at = timezone('utc', now())
    where user_id = target_user_id
      and role = 'admin'
      and scope_type = 'school'
      and scope_value = 'default';
  end if;

  perform public.log_staff_access_event(
    actor_user_id,
    target_user_id,
    'grant_role',
    safe_role,
    null,
    null,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'active', true
  );
end;
$$;

create or replace function public.revoke_staff_role(target_user_id uuid, requested_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  active_admin_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before changing staff roles.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
    raise exception 'Admin access is required to manage staff roles.';
  end if;

  if target_user_id is null then
    raise exception 'Choose a staff account before revoking a role.';
  end if;

  if safe_role not in ('admin', 'teacher', 'hoy', 'hod') then
    raise exception 'Invalid role.';
  end if;

  if safe_role = 'admin' then
    select count(*)
    into active_admin_count
    from public.staff_role_assignments
    where role = 'admin'
      and active is true;

    if active_admin_count <= 1
      and exists (
        select 1
        from public.staff_role_assignments
        where user_id = target_user_id
          and role = 'admin'
          and active is true
      ) then
      raise exception 'At least one active admin must remain.';
    end if;
  end if;

  update public.staff_role_assignments
  set active = false,
      granted_by = actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role
    and active is true;

  update public.staff_scope_assignments
  set active = false,
      granted_by = actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role
    and active is true;

  perform public.log_staff_access_event(
    actor_user_id,
    target_user_id,
    'revoke_role',
    safe_role,
    null,
    null,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'active', false
  );
end;
$$;

create or replace function public.grant_staff_scope(
  target_user_id uuid,
  requested_role text,
  requested_scope_type text,
  requested_scope_value text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  safe_scope_type text := lower(btrim(coalesce(requested_scope_type, '')));
  safe_scope_value text := btrim(coalesce(requested_scope_value, ''));
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before changing staff scopes.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
    raise exception 'Admin access is required to manage staff scopes.';
  end if;

  if target_user_id is null then
    raise exception 'Choose a staff account before granting a scope.';
  end if;

  if safe_role not in ('admin', 'teacher', 'hoy', 'hod') then
    raise exception 'Invalid role.';
  end if;

  if not public.has_role(safe_role, target_user_id) then
    raise exception 'Grant the role before assigning scopes to it.';
  end if;

  if safe_role = 'teacher' then
    raise exception 'Teacher uses owned-content access in this phase and does not take explicit scopes.';
  end if;

  if safe_role = 'admin' then
    if safe_scope_type <> 'school' then
      raise exception 'Admin can only receive the school scope in this phase.';
    end if;
    safe_scope_value := 'default';
  elsif safe_role = 'hoy' then
    if safe_scope_type not in ('year_group', 'class') then
      raise exception 'HOY can only receive year group or class scopes in this phase.';
    end if;
  elsif safe_role = 'hod' then
    if safe_scope_type not in ('department', 'class') then
      raise exception 'HOD can only receive department or class scopes in this phase.';
    end if;
  end if;

  if safe_scope_value = '' then
    raise exception 'Scope value is required.';
  end if;

  if safe_scope_type = 'class'
    and not exists (
      select 1
      from public.classes as c
      where c.id::text = safe_scope_value
    ) then
    raise exception 'Class scope must reference an existing class.';
  end if;

  if safe_scope_type = 'year_group'
    and not exists (
      select 1
      from public.classes as c
      where lower(btrim(coalesce(c.year_group, ''))) = lower(safe_scope_value)
    ) then
    raise exception 'Year-group scope must reference an existing class year group.';
  end if;

  if safe_scope_type = 'department'
    and not exists (
      select 1
      from public.classes as c
      where nullif(btrim(coalesce(c.department_key, '')), '') is not null
        and lower(btrim(c.department_key)) = lower(safe_scope_value)
    ) then
    raise exception 'Department scope must reference a mapped classes.department_key value.';
  end if;

  insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by)
  values (target_user_id, safe_role, safe_scope_type, safe_scope_value, true, actor_user_id)
  on conflict do nothing;

  update public.staff_scope_assignments
  set active = true,
      granted_by = actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role
    and scope_type = safe_scope_type
    and scope_value = safe_scope_value;

  perform public.log_staff_access_event(
    actor_user_id,
    target_user_id,
    'grant_scope',
    safe_role,
    safe_scope_type,
    safe_scope_value,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'scope_type', safe_scope_type,
    'scope_value', safe_scope_value,
    'active', true
  );
end;
$$;

create or replace function public.revoke_staff_scope(
  target_user_id uuid,
  requested_role text,
  requested_scope_type text,
  requested_scope_value text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  safe_scope_type text := lower(btrim(coalesce(requested_scope_type, '')));
  safe_scope_value text := btrim(coalesce(requested_scope_value, ''));
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before changing staff scopes.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
    raise exception 'Admin access is required to manage staff scopes.';
  end if;

  if target_user_id is null then
    raise exception 'Choose a staff account before revoking a scope.';
  end if;

  if safe_role not in ('admin', 'teacher', 'hoy', 'hod') then
    raise exception 'Invalid role.';
  end if;

  if safe_scope_type not in ('school', 'year_group', 'department', 'class') then
    raise exception 'Invalid scope type.';
  end if;

  if safe_scope_value = '' then
    raise exception 'Scope value is required.';
  end if;

  update public.staff_scope_assignments
  set active = false,
      granted_by = actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role
    and scope_type = safe_scope_type
    and scope_value = safe_scope_value
    and active is true;

  perform public.log_staff_access_event(
    actor_user_id,
    target_user_id,
    'revoke_scope',
    safe_role,
    safe_scope_type,
    safe_scope_value,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'scope_type', safe_scope_type,
    'scope_value', safe_scope_value,
    'active', false
  );
end;
$$;

revoke all on function public.legacy_teacher_app_role(uuid) from public;
revoke all on function public.has_role(text, uuid) from public;
revoke all on function public.is_admin_compat(uuid) from public;
revoke all on function public.is_teacher_compat(uuid) from public;
revoke all on function public.has_scope(text, text, text, uuid) from public;
revoke all on function public.can_view_class(uuid, uuid) from public;
revoke all on function public.can_view_pupil(uuid, uuid) from public;
revoke all on function public.can_view_assignment(uuid, uuid) from public;
revoke all on function public.can_view_test(uuid, uuid) from public;
revoke all on function public.can_manage_automation(uuid) from public;
revoke all on function public.can_import_csv(uuid) from public;
revoke all on function public.can_manage_roles(uuid) from public;
revoke all on function public.list_viewable_class_ids(uuid, uuid, text, text) from public;
revoke all on function public.list_unmapped_department_classes() from public;
revoke all on function public.get_my_access_context() from public;
revoke all on function public.user_has_staff_data(uuid) from public;
revoke all on function public.log_staff_access_event(uuid, uuid, text, text, text, text, jsonb) from public;
revoke all on function public.bootstrap_first_admin(uuid) from public;
revoke all on function public.grant_staff_role(uuid, text) from public;
revoke all on function public.revoke_staff_role(uuid, text) from public;
revoke all on function public.grant_staff_scope(uuid, text, text, text) from public;
revoke all on function public.revoke_staff_scope(uuid, text, text, text) from public;

grant execute on function public.legacy_teacher_app_role(uuid) to authenticated, service_role;
grant execute on function public.has_role(text, uuid) to authenticated, service_role;
grant execute on function public.is_admin_compat(uuid) to authenticated, service_role;
grant execute on function public.is_teacher_compat(uuid) to authenticated, service_role;
grant execute on function public.has_scope(text, text, text, uuid) to authenticated, service_role;
grant execute on function public.can_view_class(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_view_pupil(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_view_assignment(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_view_test(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_automation(uuid) to authenticated, service_role;
grant execute on function public.can_import_csv(uuid) to authenticated, service_role;
grant execute on function public.can_manage_roles(uuid) to authenticated, service_role;
grant execute on function public.list_viewable_class_ids(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.list_unmapped_department_classes() to authenticated, service_role;
grant execute on function public.get_my_access_context() to authenticated, service_role;
grant execute on function public.user_has_staff_data(uuid) to authenticated, service_role;
grant execute on function public.bootstrap_first_admin(uuid) to authenticated, service_role;
grant execute on function public.grant_staff_role(uuid, text) to authenticated, service_role;
grant execute on function public.revoke_staff_role(uuid, text) to authenticated, service_role;
grant execute on function public.grant_staff_scope(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.revoke_staff_scope(uuid, text, text, text) to authenticated, service_role;

create or replace function public.is_central_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_compat(auth.uid());
$$;

revoke all on function public.is_central_owner() from public;
grant execute on function public.is_central_owner() to authenticated, service_role;

insert into public.staff_role_assignments (user_id, role, active, granted_by)
select distinct teacher_id, 'teacher', true, teacher_id
from (
  select teacher_id from public.teacher_app_roles
  union all
  select teacher_id from public.classes
  union all
  select teacher_id from public.tests
  union all
  select teacher_id from public.assignments_v2
  union all
  select teacher_id from public.class_auto_assignment_policies
  union all
  select teacher_id from public.assignment_pupil_target_words
  union all
  select teacher_id from public.assignment_pupil_statuses
  union all
  select teacher_id from public.teacher_ai_threads
  union all
  select teacher_id from public.teacher_pupil_group_values
  union all
  select teacher_id from public.personalised_generation_runs
  union all
  select teacher_id from public.personalised_automation_policies
) as teacher_sources
where teacher_id is not null
  and not exists (
    select 1
    from public.staff_role_assignments as sra
    where sra.user_id = teacher_sources.teacher_id
      and sra.role = 'teacher'
      and sra.active is true
  );

insert into public.staff_role_assignments (user_id, role, active, granted_by)
select distinct tar.teacher_id, 'admin', true, tar.teacher_id
from public.teacher_app_roles as tar
where tar.app_role = 'central_owner'
  and not exists (
    select 1
    from public.staff_role_assignments as sra
    where sra.user_id = tar.teacher_id
      and sra.role = 'admin'
      and sra.active is true
  );

insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by)
select distinct tar.teacher_id, 'admin', 'school', 'default', true, tar.teacher_id
from public.teacher_app_roles as tar
where tar.app_role = 'central_owner'
  and not exists (
    select 1
    from public.staff_scope_assignments as ssa
    where ssa.user_id = tar.teacher_id
      and ssa.role = 'admin'
      and ssa.scope_type = 'school'
      and ssa.scope_value = 'default'
      and ssa.active is true
  );

drop policy if exists "Staff can view own role assignments" on public.staff_role_assignments;
create policy "Staff can view own role assignments"
  on public.staff_role_assignments
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.can_manage_roles(auth.uid())
  );

drop policy if exists "Staff can view own scope assignments" on public.staff_scope_assignments;
create policy "Staff can view own scope assignments"
  on public.staff_scope_assignments
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.can_manage_roles(auth.uid())
  );

drop policy if exists "Admins can view access audit log" on public.staff_access_audit_log;
create policy "Admins can view access audit log"
  on public.staff_access_audit_log
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid()));

revoke insert, update, delete on table public.teacher_app_roles from authenticated, anon;

drop policy if exists "Teachers can view own app role" on public.teacher_app_roles;
drop policy if exists "Teachers can insert own app role" on public.teacher_app_roles;
drop policy if exists "Teachers can update own app role" on public.teacher_app_roles;
drop policy if exists "Teachers can delete own app role" on public.teacher_app_roles;
drop policy if exists "Teachers can view own or admin app role" on public.teacher_app_roles;

create policy "Teachers can view own or admin app role"
  on public.teacher_app_roles
  for select
  to authenticated
  using (
    auth.uid() = teacher_id
    or public.can_manage_roles(auth.uid())
  );

alter table if exists public.classes
  enable row level security;

alter table if exists public.pupil_classes
  enable row level security;

alter table if exists public.pupils
  enable row level security;

alter table if exists public.tests
  enable row level security;

alter table if exists public.assignments_v2
  enable row level security;

drop policy if exists "Authenticated users can view scoped classes" on public.classes;
create policy "Authenticated users can view scoped classes"
  on public.classes
  for select
  to authenticated
  using (public.can_view_class(id));

drop policy if exists "Authenticated users can view scoped pupil classes" on public.pupil_classes;
create policy "Authenticated users can view scoped pupil classes"
  on public.pupil_classes
  for select
  to authenticated
  using (public.can_view_class(class_id));

drop policy if exists "Authenticated users can view scoped pupils" on public.pupils;
create policy "Authenticated users can view scoped pupils"
  on public.pupils
  for select
  to authenticated
  using (public.can_view_pupil(id));

drop policy if exists "Authenticated users can view scoped tests" on public.tests;
create policy "Authenticated users can view scoped tests"
  on public.tests
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    or public.can_view_test(id)
  );

drop policy if exists "Authenticated users can view scoped assignments" on public.assignments_v2;
create policy "Authenticated users can view scoped assignments"
  on public.assignments_v2
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    or public.can_view_assignment(id)
  );

create or replace function public.enforce_teacher_content_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
begin
  if actor_role in ('service_role', 'postgres') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if actor_user_id is null then
    raise exception 'Sign in is required before changing teacher-owned content.';
  end if;

  if not public.is_teacher_compat(actor_user_id) then
    raise exception 'Teacher or admin access is required for this action.';
  end if;

  if tg_table_name = 'classes' then
    if tg_op = 'INSERT' and new.teacher_id is distinct from actor_user_id then
      raise exception 'You can only create your own classes.';
    elsif tg_op = 'UPDATE' and (old.teacher_id is distinct from actor_user_id or new.teacher_id is distinct from actor_user_id) then
      raise exception 'You can only update your own classes.';
    elsif tg_op = 'DELETE' and old.teacher_id is distinct from actor_user_id then
      raise exception 'You can only delete your own classes.';
    end if;
  elsif tg_table_name = 'tests' then
    if tg_op = 'INSERT' and new.teacher_id is distinct from actor_user_id then
      raise exception 'You can only create your own tests.';
    elsif tg_op = 'UPDATE' and (old.teacher_id is distinct from actor_user_id or new.teacher_id is distinct from actor_user_id) then
      raise exception 'You can only update your own tests.';
    elsif tg_op = 'DELETE' and old.teacher_id is distinct from actor_user_id then
      raise exception 'You can only delete your own tests.';
    end if;
  elsif tg_table_name = 'pupils' then
    if not public.can_import_csv(actor_user_id) then
      raise exception 'Admin access is required before changing pupil records.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.enforce_assignment_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  checked_teacher_id uuid := coalesce(new.teacher_id, old.teacher_id);
  checked_class_id uuid := coalesce(new.class_id, old.class_id);
  checked_test_id uuid := coalesce(new.test_id, old.test_id);
begin
  if actor_role in ('service_role', 'postgres') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if actor_user_id is null then
    raise exception 'Sign in is required before changing assignments.';
  end if;

  if not public.is_teacher_compat(actor_user_id) then
    raise exception 'Teacher or admin access is required before changing assignments.';
  end if;

  if checked_teacher_id is distinct from actor_user_id then
    raise exception 'You can only manage your own assignments.';
  end if;

  if not exists (
    select 1
    from public.classes as c
    where c.id = checked_class_id
      and c.teacher_id = actor_user_id
  ) then
    raise exception 'You can only assign tests to your own classes.';
  end if;

  if not exists (
    select 1
    from public.tests as t
    where t.id = checked_test_id
      and t.teacher_id = actor_user_id
  ) then
    raise exception 'You can only assign your own tests.';
  end if;

  if tg_op = 'UPDATE' and old.teacher_id is distinct from actor_user_id then
    raise exception 'You can only update your own assignments.';
  end if;

  if tg_op = 'DELETE' and old.teacher_id is distinct from actor_user_id then
    raise exception 'You can only delete your own assignments.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.enforce_class_membership_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  checked_class_id uuid := coalesce(new.class_id, old.class_id);
begin
  if actor_role in ('service_role', 'postgres') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if actor_user_id is null then
    raise exception 'Sign in is required before changing class memberships.';
  end if;

  if not public.is_teacher_compat(actor_user_id) then
    raise exception 'Teacher or admin access is required before changing class memberships.';
  end if;

  if not exists (
    select 1
    from public.classes as c
    where c.id = checked_class_id
      and c.teacher_id = actor_user_id
  ) then
    raise exception 'You can only manage memberships for your own classes.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_enforce_classes_write on public.classes;
create trigger trg_enforce_classes_write
  before insert or update or delete
  on public.classes
  for each row
  execute function public.enforce_teacher_content_write();

drop trigger if exists trg_enforce_tests_write on public.tests;
create trigger trg_enforce_tests_write
  before insert or update or delete
  on public.tests
  for each row
  execute function public.enforce_teacher_content_write();

drop trigger if exists trg_enforce_pupils_write on public.pupils;
create trigger trg_enforce_pupils_write
  before insert or update or delete
  on public.pupils
  for each row
  execute function public.enforce_teacher_content_write();

drop trigger if exists trg_enforce_assignments_v2_write on public.assignments_v2;
create trigger trg_enforce_assignments_v2_write
  before insert or update or delete
  on public.assignments_v2
  for each row
  execute function public.enforce_assignment_write();

drop trigger if exists trg_enforce_pupil_classes_write on public.pupil_classes;
create trigger trg_enforce_pupil_classes_write
  before insert or update or delete
  on public.pupil_classes
  for each row
  execute function public.enforce_class_membership_write();

drop policy if exists "Authenticated can view attempts" on public.attempts;
drop policy if exists "Authenticated can insert attempts" on public.attempts;
drop policy if exists "Authenticated users can view scoped attempts" on public.attempts;
drop policy if exists "Authenticated teachers can insert own attempts" on public.attempts;

create policy "Authenticated users can view scoped attempts"
  on public.attempts
  for select
  to authenticated
  using (
    public.can_view_assignment(assignment_id)
    and public.can_view_pupil(pupil_id)
  );

create policy "Authenticated teachers can insert own attempts"
  on public.attempts
  for insert
  to authenticated
  with check (
    public.can_view_pupil(pupil_id)
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = attempts.assignment_id
        and a.teacher_id = auth.uid()
        and public.can_view_class(a.class_id)
    )
  );

drop policy if exists "Teachers can view own assignment pupil statuses" on public.assignment_pupil_statuses;
drop policy if exists "Teachers can insert own assignment pupil statuses" on public.assignment_pupil_statuses;
drop policy if exists "Teachers can update own assignment pupil statuses" on public.assignment_pupil_statuses;
drop policy if exists "Teachers can delete own assignment pupil statuses" on public.assignment_pupil_statuses;
drop policy if exists "Authenticated users can view scoped assignment pupil statuses" on public.assignment_pupil_statuses;
drop policy if exists "Teachers can insert owned assignment pupil statuses" on public.assignment_pupil_statuses;
drop policy if exists "Teachers can update owned assignment pupil statuses" on public.assignment_pupil_statuses;
drop policy if exists "Teachers can delete owned assignment pupil statuses" on public.assignment_pupil_statuses;

create policy "Authenticated users can view scoped assignment pupil statuses"
  on public.assignment_pupil_statuses
  for select
  to authenticated
  using (
    public.can_view_assignment(assignment_id)
    and public.can_view_pupil(pupil_id)
  );

create policy "Teachers can insert owned assignment pupil statuses"
  on public.assignment_pupil_statuses
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_statuses.assignment_id
        and a.teacher_id = auth.uid()
    )
  );

create policy "Teachers can update owned assignment pupil statuses"
  on public.assignment_pupil_statuses
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_statuses.assignment_id
        and a.teacher_id = auth.uid()
    )
  )
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_statuses.assignment_id
        and a.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete owned assignment pupil statuses"
  on public.assignment_pupil_statuses
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_statuses.assignment_id
        and a.teacher_id = auth.uid()
    )
  );

drop policy if exists "Teachers can view own assignment pupil target words" on public.assignment_pupil_target_words;
drop policy if exists "Teachers can insert own assignment pupil target words" on public.assignment_pupil_target_words;
drop policy if exists "Teachers can update own assignment pupil target words" on public.assignment_pupil_target_words;
drop policy if exists "Teachers can delete own assignment pupil target words" on public.assignment_pupil_target_words;
drop policy if exists "Authenticated users can view scoped assignment pupil target words" on public.assignment_pupil_target_words;
drop policy if exists "Teachers can insert owned assignment pupil target words" on public.assignment_pupil_target_words;
drop policy if exists "Teachers can update owned assignment pupil target words" on public.assignment_pupil_target_words;
drop policy if exists "Teachers can delete owned assignment pupil target words" on public.assignment_pupil_target_words;

create policy "Authenticated users can view scoped assignment pupil target words"
  on public.assignment_pupil_target_words
  for select
  to authenticated
  using (
    public.can_view_assignment(assignment_id)
    and public.can_view_pupil(pupil_id)
  );

create policy "Teachers can insert owned assignment pupil target words"
  on public.assignment_pupil_target_words
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_target_words.assignment_id
        and a.teacher_id = auth.uid()
    )
  );

create policy "Teachers can update owned assignment pupil target words"
  on public.assignment_pupil_target_words
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_target_words.assignment_id
        and a.teacher_id = auth.uid()
    )
  )
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_target_words.assignment_id
        and a.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete owned assignment pupil target words"
  on public.assignment_pupil_target_words
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_target_words.assignment_id
        and a.teacher_id = auth.uid()
    )
  );

drop policy if exists "Teachers can view own auto assign policies" on public.class_auto_assignment_policies;
drop policy if exists "Teachers can insert own auto assign policies" on public.class_auto_assignment_policies;
drop policy if exists "Teachers can update own auto assign policies" on public.class_auto_assignment_policies;
drop policy if exists "Teachers can delete own auto assign policies" on public.class_auto_assignment_policies;
drop policy if exists "Authenticated users can view scoped auto assign policies" on public.class_auto_assignment_policies;
drop policy if exists "Teachers can insert owned auto assign policies" on public.class_auto_assignment_policies;
drop policy if exists "Teachers can update owned auto assign policies" on public.class_auto_assignment_policies;
drop policy if exists "Teachers can delete owned auto assign policies" on public.class_auto_assignment_policies;

create policy "Authenticated users can view scoped auto assign policies"
  on public.class_auto_assignment_policies
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    or public.can_view_class(class_id)
  );

create policy "Teachers can insert owned auto assign policies"
  on public.class_auto_assignment_policies
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.classes as c
      where c.id = class_auto_assignment_policies.class_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Teachers can update owned auto assign policies"
  on public.class_auto_assignment_policies
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.classes as c
      where c.id = class_auto_assignment_policies.class_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.classes as c
      where c.id = class_auto_assignment_policies.class_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete owned auto assign policies"
  on public.class_auto_assignment_policies
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.classes as c
      where c.id = class_auto_assignment_policies.class_id
        and c.teacher_id = auth.uid()
    )
  );

drop policy if exists "Central owners can view own personalised automation policies" on public.personalised_automation_policies;
drop policy if exists "Central owners can insert own personalised automation policies" on public.personalised_automation_policies;
drop policy if exists "Central owners can update own personalised automation policies" on public.personalised_automation_policies;
drop policy if exists "Central owners can delete own personalised automation policies" on public.personalised_automation_policies;
drop policy if exists "Admins can view own personalised automation policies" on public.personalised_automation_policies;
drop policy if exists "Admins can insert own personalised automation policies" on public.personalised_automation_policies;
drop policy if exists "Admins can update own personalised automation policies" on public.personalised_automation_policies;
drop policy if exists "Admins can delete own personalised automation policies" on public.personalised_automation_policies;

create policy "Admins can view own personalised automation policies"
  on public.personalised_automation_policies
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

create policy "Admins can insert own personalised automation policies"
  on public.personalised_automation_policies
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

create policy "Admins can update own personalised automation policies"
  on public.personalised_automation_policies
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  )
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

create policy "Admins can delete own personalised automation policies"
  on public.personalised_automation_policies
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

drop policy if exists "Central owners can view own personalised automation policy targets" on public.personalised_automation_policy_targets;
drop policy if exists "Central owners can insert own personalised automation policy targets" on public.personalised_automation_policy_targets;
drop policy if exists "Central owners can update own personalised automation policy targets" on public.personalised_automation_policy_targets;
drop policy if exists "Central owners can delete own personalised automation policy targets" on public.personalised_automation_policy_targets;
drop policy if exists "Admins can view own personalised automation policy targets" on public.personalised_automation_policy_targets;
drop policy if exists "Admins can insert owned personalised automation policy targets" on public.personalised_automation_policy_targets;
drop policy if exists "Admins can update owned personalised automation policy targets" on public.personalised_automation_policy_targets;
drop policy if exists "Admins can delete owned personalised automation policy targets" on public.personalised_automation_policy_targets;

create policy "Admins can view own personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

create policy "Admins can insert owned personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_automation_policy_targets.class_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Admins can update owned personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_automation_policy_targets.class_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_automation_policy_targets.class_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Admins can delete owned personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_automation_policy_targets.class_id
        and c.teacher_id = auth.uid()
    )
  );

drop policy if exists "Central owners can view own personalised automation policy events" on public.personalised_automation_policy_events;
drop policy if exists "Central owners can insert own personalised automation policy events" on public.personalised_automation_policy_events;
drop policy if exists "Admins can view own personalised automation policy events" on public.personalised_automation_policy_events;
drop policy if exists "Admins can insert own personalised automation policy events" on public.personalised_automation_policy_events;

create policy "Admins can view own personalised automation policy events"
  on public.personalised_automation_policy_events
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

create policy "Admins can insert own personalised automation policy events"
  on public.personalised_automation_policy_events
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and actor_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

drop policy if exists "Central owners can view own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Central owners can insert own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Central owners can update own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Central owners can delete own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Teachers can view own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Teachers can insert own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Teachers can update own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Teachers can delete own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Admins can view own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Admins can insert own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Admins can update own personalised generation runs" on public.personalised_generation_runs;
drop policy if exists "Admins can delete own personalised generation runs" on public.personalised_generation_runs;

create policy "Admins can view own personalised generation runs"
  on public.personalised_generation_runs
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

create policy "Admins can insert own personalised generation runs"
  on public.personalised_generation_runs
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

create policy "Admins can update own personalised generation runs"
  on public.personalised_generation_runs
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  )
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

create policy "Admins can delete own personalised generation runs"
  on public.personalised_generation_runs
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

drop policy if exists "Central owners can view own personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Central owners can insert own personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Central owners can update own personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Central owners can delete own personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Teachers can view own personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Teachers can insert own personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Teachers can update own personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Teachers can delete own personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Admins can view own personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Admins can insert owned personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Admins can update owned personalised generation run pupils" on public.personalised_generation_run_pupils;
drop policy if exists "Admins can delete owned personalised generation run pupils" on public.personalised_generation_run_pupils;

create policy "Admins can view own personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
  );

create policy "Admins can insert owned personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_generation_run_pupils.class_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Admins can update owned personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_generation_run_pupils.class_id
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_generation_run_pupils.class_id
        and c.teacher_id = auth.uid()
    )
  );

create policy "Admins can delete owned personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid())
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_generation_run_pupils.class_id
        and c.teacher_id = auth.uid()
    )
  );

drop policy if exists "Teachers can view own group comparison values" on public.teacher_pupil_group_values;
drop policy if exists "Teachers can insert own group comparison values" on public.teacher_pupil_group_values;
drop policy if exists "Teachers can update own group comparison values" on public.teacher_pupil_group_values;
drop policy if exists "Teachers can delete own group comparison values" on public.teacher_pupil_group_values;
drop policy if exists "Authenticated users can view scoped group comparison values" on public.teacher_pupil_group_values;
drop policy if exists "Teachers can insert owned group comparison values" on public.teacher_pupil_group_values;
drop policy if exists "Teachers can update owned group comparison values" on public.teacher_pupil_group_values;
drop policy if exists "Teachers can delete owned group comparison values" on public.teacher_pupil_group_values;

create policy "Authenticated users can view scoped group comparison values"
  on public.teacher_pupil_group_values
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    or public.can_view_pupil(pupil_id)
  );

create policy "Teachers can insert owned group comparison values"
  on public.teacher_pupil_group_values
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.is_teacher_compat(auth.uid())
    and exists (
      select 1
      from public.pupil_classes as pc
      join public.classes as c
        on c.id = pc.class_id
      where pc.pupil_id = teacher_pupil_group_values.pupil_id
        and pc.active is true
        and c.teacher_id = auth.uid()
    )
  );

create policy "Teachers can update owned group comparison values"
  on public.teacher_pupil_group_values
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.is_teacher_compat(auth.uid())
    and exists (
      select 1
      from public.pupil_classes as pc
      join public.classes as c
        on c.id = pc.class_id
      where pc.pupil_id = teacher_pupil_group_values.pupil_id
        and pc.active is true
        and c.teacher_id = auth.uid()
    )
  )
  with check (
    teacher_id = auth.uid()
    and public.is_teacher_compat(auth.uid())
    and exists (
      select 1
      from public.pupil_classes as pc
      join public.classes as c
        on c.id = pc.class_id
      where pc.pupil_id = teacher_pupil_group_values.pupil_id
        and pc.active is true
        and c.teacher_id = auth.uid()
    )
  );

create policy "Teachers can delete owned group comparison values"
  on public.teacher_pupil_group_values
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.is_teacher_compat(auth.uid())
    and exists (
      select 1
      from public.pupil_classes as pc
      join public.classes as c
        on c.id = pc.class_id
      where pc.pupil_id = teacher_pupil_group_values.pupil_id
        and pc.active is true
        and c.teacher_id = auth.uid()
    )
  );
