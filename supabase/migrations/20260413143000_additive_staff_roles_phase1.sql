alter table public.staff_role_assignments
  drop constraint if exists staff_role_assignments_role_check;

alter table public.staff_role_assignments
  add constraint staff_role_assignments_role_check
  check (role in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead'));

alter table public.staff_scope_assignments
  drop constraint if exists staff_scope_assignments_role_check;

alter table public.staff_scope_assignments
  add constraint staff_scope_assignments_role_check
  check (role in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead'));

alter table public.staff_access_audit_log
  drop constraint if exists staff_access_audit_log_role_check;

alter table public.staff_access_audit_log
  add constraint staff_access_audit_log_role_check
  check (role in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead'));

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
        or public.has_scope('school', 'default', 'senco', requested_user_id)
        or public.has_scope('school', 'default', 'literacy_lead', requested_user_id)
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
  has_senco_role boolean := public.has_role('senco', current_user_id);
  has_literacy_lead_role boolean := public.has_role('literacy_lead', current_user_id);
  has_admin_compat boolean := public.is_admin_compat(current_user_id);
  has_teacher_compat boolean := public.is_teacher_compat(current_user_id);
  has_schoolwide_read_overlay boolean := false;
  school_scope boolean := false;
  scoped_year_groups text[] := array[]::text[];
  scoped_departments text[] := array[]::text[];
  scoped_class_ids text[] := array[]::text[];
  admin_school_scope boolean := false;
  hoy_year_groups text[] := array[]::text[];
  hoy_class_ids text[] := array[]::text[];
  hod_departments text[] := array[]::text[];
  hod_class_ids text[] := array[]::text[];
  senco_school_scope boolean := false;
  literacy_lead_school_scope boolean := false;
  unmapped_subject_class_count integer := 0;
begin
  if current_user_id is not null then
    select
      coalesce(
        bool_or(
          ssa.role = 'admin'
          and ssa.scope_type = 'school'
          and ssa.scope_value = 'default'
        ),
        false
      ),
      coalesce(
        array_agg(distinct ssa.scope_value order by ssa.scope_value)
          filter (where ssa.role = 'hoy' and ssa.scope_type = 'year_group'),
        array[]::text[]
      ),
      coalesce(
        array_agg(distinct ssa.scope_value order by ssa.scope_value)
          filter (where ssa.role = 'hoy' and ssa.scope_type = 'class'),
        array[]::text[]
      ),
      coalesce(
        array_agg(distinct ssa.scope_value order by ssa.scope_value)
          filter (where ssa.role = 'hod' and ssa.scope_type = 'department'),
        array[]::text[]
      ),
      coalesce(
        array_agg(distinct ssa.scope_value order by ssa.scope_value)
          filter (where ssa.role = 'hod' and ssa.scope_type = 'class'),
        array[]::text[]
      ),
      coalesce(
        bool_or(
          ssa.role = 'senco'
          and ssa.scope_type = 'school'
          and ssa.scope_value = 'default'
        ),
        false
      ),
      coalesce(
        bool_or(
          ssa.role = 'literacy_lead'
          and ssa.scope_type = 'school'
          and ssa.scope_value = 'default'
        ),
        false
      ),
      coalesce(
        bool_or(
          ssa.scope_type = 'school'
          and ssa.scope_value = 'default'
        ),
        false
      ),
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
    into
      admin_school_scope,
      hoy_year_groups,
      hoy_class_ids,
      hod_departments,
      hod_class_ids,
      senco_school_scope,
      literacy_lead_school_scope,
      school_scope,
      scoped_year_groups,
      scoped_departments,
      scoped_class_ids
    from public.staff_scope_assignments as ssa
    join public.staff_role_assignments as sra
      on sra.user_id = ssa.user_id
     and sra.role = ssa.role
     and sra.active is true
    where ssa.user_id = current_user_id
      and ssa.active is true;
  end if;

  if has_admin_compat then
    admin_school_scope := true;
    school_scope := true;
    select count(*)
    into unmapped_subject_class_count
    from public.classes as c
    where c.class_type = 'subject'
      and nullif(btrim(coalesce(c.department_key, '')), '') is null;
  end if;

  has_schoolwide_read_overlay := has_admin_compat or senco_school_scope or literacy_lead_school_scope;

  return jsonb_build_object(
    'version', 2,
    'user_id', current_user_id,
    'legacy', jsonb_build_object(
      'teacher_app_role', legacy_role,
      'is_legacy_central_owner', legacy_role = 'central_owner'
    ),
    'roles', jsonb_build_object(
      'admin', has_admin_role,
      'teacher', has_teacher_role,
      'hoy', has_hoy_role,
      'hod', has_hod_role,
      'senco', has_senco_role,
      'literacy_lead', has_literacy_lead_role
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
      'can_view_schoolwide_analytics', has_schoolwide_read_overlay
    ),
    'scopes', jsonb_build_object(
      'school', school_scope,
      'year_groups', to_jsonb(coalesce(scoped_year_groups, array[]::text[])),
      'departments', to_jsonb(coalesce(scoped_departments, array[]::text[])),
      'class_ids', to_jsonb(coalesce(scoped_class_ids, array[]::text[]))
    ),
    'role_scopes', jsonb_build_object(
      'admin', jsonb_build_object(
        'school', admin_school_scope,
        'year_groups', jsonb_build_array(),
        'departments', jsonb_build_array(),
        'class_ids', jsonb_build_array()
      ),
      'teacher', jsonb_build_object(
        'school', false,
        'year_groups', jsonb_build_array(),
        'departments', jsonb_build_array(),
        'class_ids', jsonb_build_array()
      ),
      'hoy', jsonb_build_object(
        'school', false,
        'year_groups', to_jsonb(coalesce(hoy_year_groups, array[]::text[])),
        'departments', jsonb_build_array(),
        'class_ids', to_jsonb(coalesce(hoy_class_ids, array[]::text[]))
      ),
      'hod', jsonb_build_object(
        'school', false,
        'year_groups', jsonb_build_array(),
        'departments', to_jsonb(coalesce(hod_departments, array[]::text[])),
        'class_ids', to_jsonb(coalesce(hod_class_ids, array[]::text[]))
      ),
      'senco', jsonb_build_object(
        'school', senco_school_scope,
        'year_groups', jsonb_build_array(),
        'departments', jsonb_build_array(),
        'class_ids', jsonb_build_array()
      ),
      'literacy_lead', jsonb_build_object(
        'school', literacy_lead_school_scope,
        'year_groups', jsonb_build_array(),
        'departments', jsonb_build_array(),
        'class_ids', jsonb_build_array()
      )
    ),
    'data_health', jsonb_build_object(
      'unmapped_subject_class_count', unmapped_subject_class_count
    )
  );
end;
$$;

comment on function public.get_my_access_context() is
  'Stable version 2 frontend access-context payload for additive roles, capability gating, and scoped reads.';

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
  set granted_by = audit_actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = 'admin'
    and active is true;

  insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by)
  values (target_user_id, 'admin', 'school', 'default', true, audit_actor_user_id)
  on conflict do nothing;

  update public.staff_scope_assignments
  set granted_by = audit_actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = 'admin'
    and scope_type = 'school'
    and scope_value = 'default'
    and active is true;

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
    'version', 2,
    'user_id', target_user_id,
    'legacy', jsonb_build_object(
      'teacher_app_role', public.legacy_teacher_app_role(target_user_id),
      'is_legacy_central_owner', public.legacy_teacher_app_role(target_user_id) = 'central_owner'
    ),
    'roles', jsonb_build_object(
      'admin', true,
      'teacher', public.has_role('teacher', target_user_id),
      'hoy', public.has_role('hoy', target_user_id),
      'hod', public.has_role('hod', target_user_id),
      'senco', public.has_role('senco', target_user_id),
      'literacy_lead', public.has_role('literacy_lead', target_user_id)
    ),
    'capabilities', jsonb_build_object(
      'can_manage_automation', true,
      'can_import_csv', true,
      'can_manage_roles', true,
      'can_create_classes', public.is_teacher_compat(target_user_id),
      'can_create_tests', public.is_teacher_compat(target_user_id),
      'can_assign_tests', public.is_teacher_compat(target_user_id),
      'can_manage_intervention_groups', true,
      'can_manage_own_content', public.is_teacher_compat(target_user_id),
      'can_view_schoolwide_analytics', true
    ),
    'scopes', jsonb_build_object(
      'school', true,
      'year_groups', jsonb_build_array(),
      'departments', jsonb_build_array(),
      'class_ids', jsonb_build_array()
    ),
    'role_scopes', jsonb_build_object(
      'admin', jsonb_build_object(
        'school', true,
        'year_groups', jsonb_build_array(),
        'departments', jsonb_build_array(),
        'class_ids', jsonb_build_array()
      ),
      'teacher', jsonb_build_object(
        'school', false,
        'year_groups', jsonb_build_array(),
        'departments', jsonb_build_array(),
        'class_ids', jsonb_build_array()
      ),
      'hoy', jsonb_build_object(
        'school', false,
        'year_groups', jsonb_build_array(),
        'departments', jsonb_build_array(),
        'class_ids', jsonb_build_array()
      ),
      'hod', jsonb_build_object(
        'school', false,
        'year_groups', jsonb_build_array(),
        'departments', jsonb_build_array(),
        'class_ids', jsonb_build_array()
      ),
      'senco', jsonb_build_object(
        'school', false,
        'year_groups', jsonb_build_array(),
        'departments', jsonb_build_array(),
        'class_ids', jsonb_build_array()
      ),
      'literacy_lead', jsonb_build_object(
        'school', false,
        'year_groups', jsonb_build_array(),
        'departments', jsonb_build_array(),
        'class_ids', jsonb_build_array()
      )
    ),
    'data_health', jsonb_build_object(
      'unmapped_subject_class_count', 0
    ),
    'bootstrap_mode', bootstrap_mode
  );
end;
$$;

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

  if safe_role not in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead') then
    raise exception 'Invalid role.';
  end if;

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values (target_user_id, safe_role, true, actor_user_id)
  on conflict do nothing;

  update public.staff_role_assignments
  set granted_by = actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role
    and active is true;

  if safe_role in ('admin', 'senco', 'literacy_lead') then
    insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by)
    values (target_user_id, safe_role, 'school', 'default', true, actor_user_id)
    on conflict do nothing;

    update public.staff_scope_assignments
    set granted_by = actor_user_id,
        updated_at = timezone('utc', now())
    where user_id = target_user_id
      and role = safe_role
      and scope_type = 'school'
      and scope_value = 'default'
      and active is true;
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

  if safe_role not in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead') then
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

  if safe_role not in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead') then
    raise exception 'Invalid role.';
  end if;

  if not public.has_role(safe_role, target_user_id) then
    raise exception 'Grant the role before assigning scopes to it.';
  end if;

  if safe_role = 'teacher' then
    raise exception 'Teacher uses owned-content access in this phase and does not take explicit scopes.';
  end if;

  if safe_role in ('admin', 'senco', 'literacy_lead') then
    if safe_scope_type <> 'school' then
      raise exception '% can only receive the school scope in this phase.', upper(safe_role);
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
  set granted_by = actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role
    and scope_type = safe_scope_type
    and scope_value = safe_scope_value
    and active is true;

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

  if safe_role not in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead') then
    raise exception 'Invalid role.';
  end if;

  if safe_scope_type not in ('school', 'year_group', 'department', 'class') then
    raise exception 'Invalid scope type.';
  end if;

  if safe_scope_value = '' then
    raise exception 'Scope value is required.';
  end if;

  if safe_role in ('admin', 'senco', 'literacy_lead')
    and safe_scope_type = 'school'
    and safe_scope_value = 'default'
    and public.has_role(safe_role, target_user_id) then
    raise exception 'Use revoke_staff_role to remove the schoolwide scope from this role.';
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

create or replace function public.is_central_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_compat(auth.uid());
$$;

insert into public.staff_role_assignments (user_id, role, active, granted_by)
select distinct tar.teacher_id, 'teacher', true, tar.teacher_id
from public.teacher_app_roles as tar
where tar.app_role = 'central_owner'
  and not exists (
    select 1
    from public.staff_role_assignments as sra
    where sra.user_id = tar.teacher_id
      and sra.role = 'teacher'
      and sra.active is true
  );

update public.staff_role_assignments as sra
set granted_by = coalesce(sra.granted_by, sra.user_id),
    updated_at = timezone('utc', now())
from public.teacher_app_roles as tar
where tar.app_role = 'central_owner'
  and tar.teacher_id = sra.user_id
  and sra.role = 'teacher'
  and sra.active is true;

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

update public.staff_role_assignments as sra
set granted_by = coalesce(sra.granted_by, sra.user_id),
    updated_at = timezone('utc', now())
from public.teacher_app_roles as tar
where tar.app_role = 'central_owner'
  and tar.teacher_id = sra.user_id
  and sra.role = 'admin'
  and sra.active is true;

insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by)
select distinct sra.user_id, sra.role, 'school', 'default', true, coalesce(sra.granted_by, sra.user_id)
from public.staff_role_assignments as sra
where sra.active is true
  and sra.role in ('admin', 'senco', 'literacy_lead')
  and not exists (
    select 1
    from public.staff_scope_assignments as ssa
    where ssa.user_id = sra.user_id
      and ssa.role = sra.role
      and ssa.scope_type = 'school'
      and ssa.scope_value = 'default'
      and ssa.active is true
  );

update public.staff_scope_assignments as ssa
set granted_by = coalesce(ssa.granted_by, sra.granted_by, sra.user_id),
    updated_at = timezone('utc', now())
from public.staff_role_assignments as sra
where sra.user_id = ssa.user_id
  and sra.role = ssa.role
  and sra.active is true
  and sra.role in ('admin', 'senco', 'literacy_lead')
  and ssa.scope_type = 'school'
  and ssa.scope_value = 'default'
  and ssa.active is true;
