begin;

create or replace function public.log_staff_access_event(
  actor_user_id uuid,
  target_user_id uuid,
  event_action text,
  event_role text default null,
  event_scope_type text default null,
  event_scope_value text default null,
  event_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  safe_action text := lower(btrim(coalesce(event_action, '')));
  safe_role text := nullif(lower(btrim(coalesce(event_role, ''))), '');
  safe_scope_type text := nullif(lower(btrim(coalesce(event_scope_type, ''))), '');
  safe_scope_value text := nullif(btrim(coalesce(event_scope_value, '')), '');
  audit_school_id uuid := public.phase2_try_uuid(coalesce(event_metadata ->> 'school_id', ''));
begin
  if actor_user_id is null or safe_action = '' then
    return;
  end if;

  insert into public.staff_access_audit_log (
    actor_user_id,
    target_user_id,
    action,
    role,
    scope_type,
    scope_value,
    school_id,
    metadata
  )
  values (
    actor_user_id,
    target_user_id,
    safe_action,
    safe_role,
    safe_scope_type,
    safe_scope_value,
    audit_school_id,
    coalesce(event_metadata, '{}'::jsonb)
  );
end;
$$;

alter function public.log_staff_access_event(uuid, uuid, text, text, text, text, jsonb) owner to postgres;

create or replace function public.log_staff_pending_access_event(
  actor_user_id uuid,
  target_profile_id uuid,
  target_approval_id uuid,
  event_action text,
  event_message text default null,
  event_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  safe_action text := lower(btrim(coalesce(event_action, '')));
  audit_school_id uuid := public.phase2_try_uuid(coalesce(event_metadata ->> 'school_id', ''));
begin
  if actor_user_id is null or safe_action = '' then
    return;
  end if;

  if audit_school_id is null and target_approval_id is not null then
    select coalesce(spa.school_id, public.default_legacy_school_id())
    into audit_school_id
    from public.staff_pending_access_approvals as spa
    where spa.id = target_approval_id
    limit 1;
  end if;

  if audit_school_id is null and target_profile_id is not null then
    select coalesce(sp.school_id, public.default_legacy_school_id())
    into audit_school_id
    from public.staff_profiles as sp
    where sp.id = target_profile_id
    limit 1;
  end if;

  insert into public.staff_pending_access_audit_log (
    actor_user_id,
    staff_profile_id,
    approval_id,
    action,
    message,
    school_id,
    metadata
  )
  values (
    actor_user_id,
    target_profile_id,
    target_approval_id,
    safe_action,
    nullif(btrim(coalesce(event_message, '')), ''),
    audit_school_id,
    coalesce(event_metadata, '{}'::jsonb)
  );
end;
$$;

alter function public.log_staff_pending_access_event(uuid, uuid, uuid, text, text, jsonb) owner to postgres;

create or replace function public.get_staff_profile_duplicate_conflicts(
  target_profile_id uuid,
  requested_school_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  profile_row public.staff_profiles%rowtype;
  safe_email text := '';
  safe_external_staff_id text := '';
  target_school_id uuid;
  email_conflicts jsonb := '[]'::jsonb;
  external_conflicts jsonb := '[]'::jsonb;
begin
  if target_profile_id is null then
    return '[]'::jsonb;
  end if;

  select *
  into profile_row
  from public.staff_profiles
  where id = target_profile_id
  limit 1;

  if profile_row.id is null then
    return '[]'::jsonb;
  end if;

  target_school_id := coalesce(
    requested_school_id,
    profile_row.school_id,
    public.default_legacy_school_id()
  );
  safe_email := lower(btrim(coalesce(profile_row.email, '')));
  safe_external_staff_id := lower(btrim(coalesce(profile_row.external_staff_id, '')));

  if safe_email <> '' then
    with conflict_rows as (
      select
        sp.id,
        sp.user_id,
        sp.display_name,
        sp.email
      from public.staff_profiles as sp
      where lower(btrim(coalesce(sp.email, ''))) = safe_email
        and coalesce(sp.school_id, public.default_legacy_school_id()) = target_school_id
      order by sp.display_name, sp.email, sp.id
    ),
    conflict_summary as (
      select
        count(*) as conflict_count,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'user_id', user_id,
              'display_name', display_name,
              'email', email
            )
          ),
          '[]'::jsonb
        ) as conflict_profiles
      from conflict_rows
    )
    select
      case
        when conflict_count > 1 then jsonb_build_array(
          jsonb_build_object(
            'kind', 'email',
            'value', safe_email,
            'conflict_count', conflict_count,
            'message', format(
              'Pending approval and activation are blocked because %s staff records in this school now share this email.',
              conflict_count
            ),
            'conflicting_profiles', conflict_profiles
          )
        )
        else '[]'::jsonb
      end
    into email_conflicts
    from conflict_summary;
  end if;

  if safe_external_staff_id <> '' then
    with conflict_rows as (
      select
        sp.id,
        sp.user_id,
        sp.display_name,
        sp.email,
        sp.external_staff_id
      from public.staff_profiles as sp
      where lower(btrim(coalesce(sp.external_staff_id, ''))) = safe_external_staff_id
        and coalesce(sp.school_id, public.default_legacy_school_id()) = target_school_id
      order by sp.display_name, sp.email, sp.id
    ),
    conflict_summary as (
      select
        count(*) as conflict_count,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'user_id', user_id,
              'display_name', display_name,
              'email', email,
              'external_staff_id', external_staff_id
            )
          ),
          '[]'::jsonb
        ) as conflict_profiles
      from conflict_rows
    )
    select
      case
        when conflict_count > 1 then jsonb_build_array(
          jsonb_build_object(
            'kind', 'external_staff_id',
            'value', safe_external_staff_id,
            'conflict_count', conflict_count,
            'message', format(
              'Pending approval and activation are blocked because %s staff records in this school now share this external staff ID.',
              conflict_count
            ),
            'conflicting_profiles', conflict_profiles
          )
        )
        else '[]'::jsonb
      end
    into external_conflicts
    from conflict_summary;
  end if;

  return coalesce(email_conflicts, '[]'::jsonb) || coalesce(external_conflicts, '[]'::jsonb);
end;
$$;

alter function public.get_staff_profile_duplicate_conflicts(uuid, uuid) owner to postgres;

create or replace function public.get_staff_profile_duplicate_conflicts(target_profile_id uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.get_staff_profile_duplicate_conflicts(
    target_profile_id,
    (
      select coalesce(sp.school_id, public.default_legacy_school_id())
      from public.staff_profiles as sp
      where sp.id = target_profile_id
      limit 1
    )
  );
$$;

alter function public.get_staff_profile_duplicate_conflicts(uuid) owner to postgres;

create or replace function public.grant_staff_role(
  target_user_id uuid,
  requested_role text,
  requested_school_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  target_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  school_scope_value text := case
    when target_school_id = public.default_legacy_school_id() then 'default'
    else target_school_id::text
  end;
  conflicting_school_name text := null;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before changing staff roles.';
  end if;

  if not public.can_manage_roles(actor_user_id, target_school_id) then
    raise exception 'Admin access is required to manage staff roles.';
  end if;

  if target_user_id is null then
    raise exception 'Choose a staff account before granting a role.';
  end if;

  if safe_role not in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead') then
    raise exception 'Invalid role.';
  end if;

  select coalesce(s.name, 'another school')
  into conflicting_school_name
  from public.staff_role_assignments as sra
  left join public.schools as s
    on s.id = coalesce(sra.school_id, public.default_legacy_school_id())
  where sra.user_id = target_user_id
    and sra.role = safe_role
    and sra.active is true
    and coalesce(sra.school_id, public.default_legacy_school_id()) <> target_school_id
  order by s.name, s.id
  limit 1;

  if conflicting_school_name is not null then
    raise exception 'This staff member already has the % role in %.', upper(safe_role), conflicting_school_name
      using hint = 'Revoke that role in the other school before granting it here.';
  end if;

  perform public.phase2_ensure_school_membership(target_user_id, target_school_id, 'manual');

  update public.staff_role_assignments
  set active = true,
      granted_by = actor_user_id,
      school_id = target_school_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role
    and coalesce(school_id, public.default_legacy_school_id()) = target_school_id;

  if not found then
    insert into public.staff_role_assignments (user_id, role, active, granted_by, school_id)
    values (target_user_id, safe_role, true, actor_user_id, target_school_id);
  end if;

  if public.staff_role_uses_automatic_school_scope(safe_role) then
    update public.staff_scope_assignments
    set active = true,
        granted_by = actor_user_id,
        school_id = target_school_id,
        scope_value = school_scope_value,
        updated_at = timezone('utc', now())
    where user_id = target_user_id
      and role = safe_role
      and scope_type = 'school'
      and coalesce(school_id, public.default_legacy_school_id()) = target_school_id
      and public.phase2_scope_value_matches(
        scope_type,
        scope_value,
        coalesce(school_id, public.default_legacy_school_id()),
        school_scope_value,
        target_school_id
      );

    if not found then
      insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
      values (target_user_id, safe_role, 'school', school_scope_value, true, actor_user_id, target_school_id)
      on conflict do nothing;
    end if;
  end if;

  perform public.log_staff_access_event(
    actor_user_id,
    target_user_id,
    'grant_role',
    safe_role,
    null,
    null,
    jsonb_build_object('school_id', target_school_id)
  );

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'school_id', target_school_id,
    'active', true
  );
end;
$$;

alter function public.grant_staff_role(uuid, text, uuid) owner to postgres;

create or replace function public.grant_staff_role(
  target_user_id uuid,
  requested_role text
) returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.grant_staff_role(target_user_id, requested_role, null);
$$;

alter function public.grant_staff_role(uuid, text) owner to postgres;

create or replace function public.grant_staff_scope(
  target_user_id uuid,
  requested_role text,
  requested_scope_type text,
  requested_scope_value text,
  requested_school_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  target_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  normalized_scope jsonb;
  safe_role text := '';
  safe_scope_type text := '';
  safe_scope_value text := '';
  conflicting_school_name text := null;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before changing staff scopes.';
  end if;

  if not public.can_manage_roles(actor_user_id, target_school_id) then
    raise exception 'Admin access is required to manage staff scopes.';
  end if;

  if target_user_id is null then
    raise exception 'Choose a staff account before granting a scope.';
  end if;

  normalized_scope := public.normalize_staff_scope_input(
    requested_role,
    requested_scope_type,
    requested_scope_value,
    target_school_id
  );

  safe_role := normalized_scope ->> 'role';
  safe_scope_type := normalized_scope ->> 'scope_type';
  safe_scope_value := normalized_scope ->> 'scope_value';

  if not public.has_role(safe_role, target_user_id, target_school_id) then
    raise exception 'Grant the role before assigning scopes to it.';
  end if;

  select coalesce(s.name, 'another school')
  into conflicting_school_name
  from public.staff_scope_assignments as ssa
  left join public.schools as s
    on s.id = coalesce(ssa.school_id, public.default_legacy_school_id())
  where ssa.user_id = target_user_id
    and ssa.role = safe_role
    and ssa.scope_type = safe_scope_type
    and ssa.active is true
    and coalesce(ssa.school_id, public.default_legacy_school_id()) <> target_school_id
    and public.phase2_scope_value_matches(
      ssa.scope_type,
      ssa.scope_value,
      coalesce(ssa.school_id, public.default_legacy_school_id()),
      safe_scope_value,
      target_school_id
    )
  order by s.name, s.id
  limit 1;

  if conflicting_school_name is not null then
    raise exception 'This staff member already has that scope in %.', conflicting_school_name
      using hint = 'Revoke the scope in the other school before granting it here.';
  end if;

  perform public.phase2_ensure_school_membership(target_user_id, target_school_id, 'manual');

  update public.staff_scope_assignments
  set active = true,
      granted_by = actor_user_id,
      school_id = target_school_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role
    and scope_type = safe_scope_type
    and coalesce(school_id, public.default_legacy_school_id()) = target_school_id
    and public.phase2_scope_value_matches(
      scope_type,
      scope_value,
      coalesce(school_id, public.default_legacy_school_id()),
      safe_scope_value,
      target_school_id
    );

  if not found then
    insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
    values (target_user_id, safe_role, safe_scope_type, safe_scope_value, true, actor_user_id, target_school_id);
  end if;

  perform public.log_staff_access_event(
    actor_user_id,
    target_user_id,
    'grant_scope',
    safe_role,
    safe_scope_type,
    safe_scope_value,
    jsonb_build_object('school_id', target_school_id)
  );

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'scope_type', safe_scope_type,
    'scope_value', safe_scope_value,
    'school_id', target_school_id,
    'active', true
  );
end;
$$;

alter function public.grant_staff_scope(uuid, text, text, text, uuid) owner to postgres;

create or replace function public.grant_staff_scope(
  target_user_id uuid,
  requested_role text,
  requested_scope_type text,
  requested_scope_value text
) returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.grant_staff_scope(
    target_user_id,
    requested_role,
    requested_scope_type,
    requested_scope_value,
    null
  );
$$;

alter function public.grant_staff_scope(uuid, text, text, text) owner to postgres;

create or replace function public.revoke_staff_role(
  target_user_id uuid,
  requested_role text,
  requested_school_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  target_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  active_admin_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before changing staff roles.';
  end if;

  if not public.can_manage_roles(actor_user_id, target_school_id) then
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
      and active is true
      and coalesce(school_id, public.default_legacy_school_id()) = target_school_id;

    if active_admin_count <= 1
      and exists (
        select 1
        from public.staff_role_assignments
        where user_id = target_user_id
          and role = 'admin'
          and active is true
          and coalesce(school_id, public.default_legacy_school_id()) = target_school_id
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
    and active is true
    and coalesce(school_id, public.default_legacy_school_id()) = target_school_id;

  update public.staff_scope_assignments
  set active = false,
      granted_by = actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role
    and active is true
    and coalesce(school_id, public.default_legacy_school_id()) = target_school_id;

  perform public.log_staff_access_event(
    actor_user_id,
    target_user_id,
    'revoke_role',
    safe_role,
    null,
    null,
    jsonb_build_object('school_id', target_school_id)
  );

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'school_id', target_school_id,
    'active', false
  );
end;
$$;

alter function public.revoke_staff_role(uuid, text, uuid) owner to postgres;

create or replace function public.revoke_staff_role(
  target_user_id uuid,
  requested_role text
) returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.revoke_staff_role(target_user_id, requested_role, null);
$$;

alter function public.revoke_staff_role(uuid, text) owner to postgres;

create or replace function public.revoke_staff_scope(
  target_user_id uuid,
  requested_role text,
  requested_scope_type text,
  requested_scope_value text,
  requested_school_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  safe_scope_type text := lower(btrim(coalesce(requested_scope_type, '')));
  safe_scope_value text := btrim(coalesce(requested_scope_value, ''));
  target_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  normalized_scope_value text := case
    when safe_scope_type = 'school' and lower(safe_scope_value) = 'default' and target_school_id <> public.default_legacy_school_id()
      then target_school_id::text
    else safe_scope_value
  end;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before changing staff scopes.';
  end if;

  if not public.can_manage_roles(actor_user_id, target_school_id) then
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

  if normalized_scope_value = '' then
    raise exception 'Scope value is required.';
  end if;

  if safe_role in ('admin', 'senco', 'literacy_lead')
    and safe_scope_type = 'school'
    and lower(normalized_scope_value) in ('default', lower(target_school_id::text))
    and public.has_role(safe_role, target_user_id, target_school_id) then
    raise exception 'Use revoke_staff_role to remove the schoolwide scope from this role.';
  end if;

  update public.staff_scope_assignments
  set active = false,
      granted_by = actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role
    and scope_type = safe_scope_type
    and active is true
    and coalesce(school_id, public.default_legacy_school_id()) = target_school_id
    and public.phase2_scope_value_matches(
      scope_type,
      scope_value,
      coalesce(school_id, public.default_legacy_school_id()),
      normalized_scope_value,
      target_school_id
    );

  perform public.log_staff_access_event(
    actor_user_id,
    target_user_id,
    'revoke_scope',
    safe_role,
    safe_scope_type,
    normalized_scope_value,
    jsonb_build_object('school_id', target_school_id)
  );

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'scope_type', safe_scope_type,
    'scope_value', normalized_scope_value,
    'school_id', target_school_id,
    'active', false
  );
end;
$$;

alter function public.revoke_staff_scope(uuid, text, text, text, uuid) owner to postgres;

create or replace function public.revoke_staff_scope(
  target_user_id uuid,
  requested_role text,
  requested_scope_type text,
  requested_scope_value text
) returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.revoke_staff_scope(
    target_user_id,
    requested_role,
    requested_scope_type,
    requested_scope_value,
    null
  );
$$;

alter function public.revoke_staff_scope(uuid, text, text, text) owner to postgres;

create or replace function public.list_staff_pending_access_summaries(requested_school_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  active_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  result jsonb := '[]'::jsonb;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before reviewing pending staff approvals.';
  end if;

  if not public.can_manage_roles(actor_user_id, active_school_id) then
    raise exception 'Admin access is required before reviewing pending staff approvals.';
  end if;

  with latest_approvals as (
    select distinct on (spa.staff_profile_id)
      spa.*
    from public.staff_pending_access_approvals as spa
    where coalesce(spa.school_id, public.default_legacy_school_id()) = active_school_id
    order by spa.staff_profile_id, spa.created_at desc, spa.updated_at desc, spa.id desc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'staff_profile_id', sp.id,
        'approval_id', la.id,
        'status', la.status,
        'approved_email', la.approved_email,
        'approved_external_staff_id', la.approved_external_staff_id,
        'approved_by', la.approved_by,
        'approved_at', la.approved_at,
        'stale_after_at', la.stale_after_at,
        'activated_user_id', la.activated_user_id,
        'activated_at', la.activated_at,
        'invalidated_reason', la.invalidated_reason,
        'last_failure_reason', la.last_failure_reason,
        'last_failure_at', la.last_failure_at,
        'metadata', coalesce(la.metadata, '{}'::jsonb),
        'created_at', la.created_at,
        'updated_at', la.updated_at,
        'pending_roles', coalesce(role_rows.pending_roles, '[]'::jsonb),
        'pending_scopes', coalesce(scope_rows.pending_scopes, '[]'::jsonb),
        'duplicate_conflicts', coalesce(duplicate_rows.duplicate_conflicts, '[]'::jsonb),
        'has_duplicate_conflicts', jsonb_array_length(coalesce(duplicate_rows.duplicate_conflicts, '[]'::jsonb)) > 0,
        'is_stale', coalesce(
          la.status = 'approved'
          and la.stale_after_at is not null
          and la.stale_after_at < timezone('utc', now()),
          false
        )
      )
      order by sp.display_name, sp.email, sp.id
    ),
    '[]'::jsonb
  )
  into result
  from public.staff_profiles as sp
  left join latest_approvals as la
    on la.staff_profile_id = sp.id
  left join lateral (
    select coalesce(
      jsonb_agg(spr.role order by spr.role),
      '[]'::jsonb
    ) as pending_roles
    from public.staff_pending_role_assignments as spr
    where spr.approval_id = la.id
      and coalesce(spr.school_id, public.default_legacy_school_id()) = active_school_id
  ) as role_rows on true
  left join lateral (
    select public.get_staff_profile_duplicate_conflicts(sp.id, active_school_id) as duplicate_conflicts
  ) as duplicate_rows on true
  left join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'role', sps.role,
          'scope_type', sps.scope_type,
          'scope_value', sps.scope_value
        )
        order by sps.role, sps.scope_type, sps.scope_value
      ),
      '[]'::jsonb
    ) as pending_scopes
    from public.staff_pending_scope_assignments as sps
    where sps.approval_id = la.id
      and coalesce(sps.school_id, public.default_legacy_school_id()) = active_school_id
  ) as scope_rows on true
  where sp.archived_at is null
    and coalesce(sp.school_id, public.default_legacy_school_id()) = active_school_id;

  return result;
end;
$$;

alter function public.list_staff_pending_access_summaries(uuid) owner to postgres;

create or replace function public.list_staff_pending_access_summaries()
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.list_staff_pending_access_summaries(null);
$$;

alter function public.list_staff_pending_access_summaries() owner to postgres;

create or replace function public.read_staff_pending_access_detail(
  target_profile_id uuid,
  requested_school_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  active_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  profile_row public.staff_profiles%rowtype;
  approval_row public.staff_pending_access_approvals%rowtype;
  pending_roles jsonb := '[]'::jsonb;
  pending_scopes jsonb := '[]'::jsonb;
  duplicate_conflicts jsonb := '[]'::jsonb;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before reviewing pending staff approvals.';
  end if;

  if not public.can_manage_roles(actor_user_id, active_school_id) then
    raise exception 'Admin access is required before reviewing pending staff approvals.';
  end if;

  if target_profile_id is null then
    raise exception 'Choose a staff directory record first.';
  end if;

  select *
  into profile_row
  from public.staff_profiles
  where id = target_profile_id
    and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
  limit 1;

  if profile_row.id is null then
    raise exception 'Choose a staff directory record first.';
  end if;

  select *
  into approval_row
  from public.staff_pending_access_approvals
  where staff_profile_id = target_profile_id
    and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
  order by created_at desc, updated_at desc, id desc
  limit 1;

  if approval_row.id is not null then
    select coalesce(
      jsonb_agg(role order by role),
      '[]'::jsonb
    )
    into pending_roles
    from public.staff_pending_role_assignments
    where approval_id = approval_row.id
      and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'role', role,
          'scope_type', scope_type,
          'scope_value', scope_value
        )
        order by role, scope_type, scope_value
      ),
      '[]'::jsonb
    )
    into pending_scopes
    from public.staff_pending_scope_assignments
    where approval_id = approval_row.id
      and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;
  end if;

  duplicate_conflicts := public.get_staff_profile_duplicate_conflicts(target_profile_id, active_school_id);

  return jsonb_build_object(
    'staff_profile_id', target_profile_id,
    'profile_linked', profile_row.user_id is not null,
    'archived_at', profile_row.archived_at,
    'archived_by', profile_row.archived_by,
    'archive_reason', profile_row.archive_reason,
    'duplicate_conflicts', duplicate_conflicts,
    'can_approve', profile_row.archived_at is null
      and profile_row.user_id is null
      and jsonb_array_length(duplicate_conflicts) = 0,
    'approval', case
      when approval_row.id is null then null
      else jsonb_build_object(
        'id', approval_row.id,
        'staff_profile_id', approval_row.staff_profile_id,
        'status', approval_row.status,
        'approved_email', approval_row.approved_email,
        'approved_external_staff_id', approval_row.approved_external_staff_id,
        'approved_by', approval_row.approved_by,
        'approved_at', approval_row.approved_at,
        'stale_after_at', approval_row.stale_after_at,
        'activated_user_id', approval_row.activated_user_id,
        'activated_at', approval_row.activated_at,
        'invalidated_reason', approval_row.invalidated_reason,
        'last_failure_reason', approval_row.last_failure_reason,
        'last_failure_at', approval_row.last_failure_at,
        'metadata', coalesce(approval_row.metadata, '{}'::jsonb),
        'created_at', approval_row.created_at,
        'updated_at', approval_row.updated_at,
        'pending_roles', pending_roles,
        'pending_scopes', pending_scopes,
        'is_stale', approval_row.status = 'approved'
          and approval_row.stale_after_at is not null
          and approval_row.stale_after_at < timezone('utc', now())
      )
    end
  );
end;
$$;

alter function public.read_staff_pending_access_detail(uuid, uuid) owner to postgres;

create or replace function public.read_staff_pending_access_detail(target_profile_id uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.read_staff_pending_access_detail(target_profile_id, null);
$$;

alter function public.read_staff_pending_access_detail(uuid) owner to postgres;

create or replace function public.save_staff_pending_access_approval(
  target_profile_id uuid,
  requested_roles jsonb default '[]'::jsonb,
  requested_scopes jsonb default '[]'::jsonb,
  requested_school_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  active_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  profile_row public.staff_profiles%rowtype;
  duplicate_conflicts jsonb := '[]'::jsonb;
  role_item jsonb;
  scope_item jsonb;
  normalized_scope jsonb;
  normalized_roles text[] := array[]::text[];
  safe_role text := '';
  safe_scope_type text := '';
  safe_scope_value text := '';
  new_approval_id uuid := gen_random_uuid();
  superseded_row record;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before approving pending access.';
  end if;

  if not public.can_manage_roles(actor_user_id, active_school_id) then
    raise exception 'Admin access is required before approving pending access.';
  end if;

  if target_profile_id is null then
    raise exception 'Choose a pending staff record first.';
  end if;

  select *
  into profile_row
  from public.staff_profiles
  where id = target_profile_id
    and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
  limit 1;

  if profile_row.id is null then
    raise exception 'Choose a pending staff record first.';
  end if;

  if profile_row.archived_at is not null then
    raise exception 'Restore the staff directory record before approving live access.';
  end if;

  if profile_row.user_id is not null then
    raise exception 'This staff member is already linked. Use the live access workflow instead.';
  end if;

  duplicate_conflicts := public.get_staff_profile_duplicate_conflicts(target_profile_id, active_school_id);
  if jsonb_array_length(duplicate_conflicts) > 0 then
    raise exception '%', coalesce(
      duplicate_conflicts -> 0 ->> 'message',
      'Pending approval and activation are blocked until duplicate staff records are resolved.'
    );
  end if;

  if jsonb_typeof(requested_roles) <> 'array' then
    raise exception 'Choose at least one intended role before approving pending sign-in.';
  end if;

  for role_item in
    select value
    from jsonb_array_elements(requested_roles)
  loop
    safe_role := lower(btrim(coalesce(role_item #>> '{}', '')));
    if safe_role = '' then
      continue;
    end if;

    if safe_role not in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead') then
      raise exception 'Invalid role.';
    end if;

    if not (safe_role = any(normalized_roles)) then
      normalized_roles := array_append(normalized_roles, safe_role);
    end if;
  end loop;

  if coalesce(array_length(normalized_roles, 1), 0) = 0 then
    raise exception 'Choose at least one intended role before approving pending sign-in.';
  end if;

  for superseded_row in
    update public.staff_pending_access_approvals
    set status = 'superseded',
        updated_at = timezone('utc', now())
    where staff_profile_id = target_profile_id
      and status = 'approved'
      and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
    returning id
  loop
    perform public.log_staff_pending_access_event(
      actor_user_id,
      target_profile_id,
      superseded_row.id,
      'supersede',
      'Previous pending approval superseded by a newer approval.',
      jsonb_build_object(
        'source', 'save_staff_pending_access_approval',
        'school_id', active_school_id
      )
    );
  end loop;

  insert into public.staff_pending_access_approvals (
    id,
    staff_profile_id,
    status,
    approved_email,
    approved_external_staff_id,
    approved_by,
    approved_at,
    stale_after_at,
    metadata,
    created_at,
    updated_at,
    school_id
  )
  values (
    new_approval_id,
    target_profile_id,
    'approved',
    lower(btrim(profile_row.email)),
    nullif(btrim(coalesce(profile_row.external_staff_id, '')), ''),
    actor_user_id,
    timezone('utc', now()),
    timezone('utc', now()) + interval '30 days',
    jsonb_build_object(
      'source', 'save_staff_pending_access_approval',
      'profile_archived', false
    ),
    timezone('utc', now()),
    timezone('utc', now()),
    active_school_id
  );

  insert into public.staff_pending_role_assignments (approval_id, role, school_id)
  select new_approval_id, role_value, active_school_id
  from unnest(normalized_roles) as role_value;

  if jsonb_typeof(requested_scopes) = 'array' then
    for scope_item in
      select value
      from jsonb_array_elements(requested_scopes)
    loop
      normalized_scope := public.normalize_staff_scope_input(
        scope_item ->> 'role',
        scope_item ->> 'scope_type',
        scope_item ->> 'scope_value',
        active_school_id
      );

      safe_role := normalized_scope ->> 'role';
      safe_scope_type := normalized_scope ->> 'scope_type';
      safe_scope_value := normalized_scope ->> 'scope_value';

      if safe_role = '' or safe_scope_type = '' or safe_scope_value = '' then
        continue;
      end if;

      if not (safe_role = any(normalized_roles)) then
        raise exception 'Choose the role before assigning scopes to it.';
      end if;

      insert into public.staff_pending_scope_assignments (
        approval_id,
        role,
        scope_type,
        scope_value,
        school_id
      )
      values (
        new_approval_id,
        safe_role,
        safe_scope_type,
        safe_scope_value,
        active_school_id
      )
      on conflict do nothing;
    end loop;
  end if;

  insert into public.staff_pending_scope_assignments (
    approval_id,
    role,
    scope_type,
    scope_value,
    school_id
  )
  select
    new_approval_id,
    role_value,
    'school',
    'default',
    active_school_id
  from unnest(normalized_roles) as role_value
  where public.staff_role_uses_automatic_school_scope(role_value)
  on conflict do nothing;

  perform public.log_staff_pending_access_event(
    actor_user_id,
    target_profile_id,
    new_approval_id,
    'approve',
    'Approved pending sign-in access saved.',
    jsonb_build_object(
      'source', 'save_staff_pending_access_approval',
      'role_count', coalesce(array_length(normalized_roles, 1), 0),
      'school_id', active_school_id
    )
  );

  return public.read_staff_pending_access_detail(target_profile_id, active_school_id);
end;
$$;

alter function public.save_staff_pending_access_approval(uuid, jsonb, jsonb, uuid) owner to postgres;

create or replace function public.save_staff_pending_access_approval(
  target_profile_id uuid,
  requested_roles jsonb default '[]'::jsonb,
  requested_scopes jsonb default '[]'::jsonb
) returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.save_staff_pending_access_approval(
    target_profile_id,
    requested_roles,
    requested_scopes,
    null
  );
$$;

alter function public.save_staff_pending_access_approval(uuid, jsonb, jsonb) owner to postgres;

create or replace function public.cancel_staff_pending_access_approval(
  target_profile_id uuid,
  requested_school_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  active_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  cancelled_row record;
  cancelled_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before cancelling pending access.';
  end if;

  if not public.can_manage_roles(actor_user_id, active_school_id) then
    raise exception 'Admin access is required before cancelling pending access.';
  end if;

  if target_profile_id is null then
    raise exception 'Choose a pending staff record first.';
  end if;

  for cancelled_row in
    update public.staff_pending_access_approvals
    set status = 'cancelled',
        cancelled_at = timezone('utc', now()),
        cancelled_by = actor_user_id,
        updated_at = timezone('utc', now())
    where staff_profile_id = target_profile_id
      and status = 'approved'
      and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
    returning id
  loop
    cancelled_count := cancelled_count + 1;
    perform public.log_staff_pending_access_event(
      actor_user_id,
      target_profile_id,
      cancelled_row.id,
      'cancel',
      'Pending approval cancelled.',
      jsonb_build_object(
        'source', 'cancel_staff_pending_access_approval',
        'school_id', active_school_id
      )
    );
  end loop;

  if cancelled_count = 0 then
    raise exception 'There is no active pending approval to cancel.';
  end if;

  return public.read_staff_pending_access_detail(target_profile_id, active_school_id);
end;
$$;

alter function public.cancel_staff_pending_access_approval(uuid, uuid) owner to postgres;

create or replace function public.cancel_staff_pending_access_approval(target_profile_id uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.cancel_staff_pending_access_approval(target_profile_id, null);
$$;

alter function public.cancel_staff_pending_access_approval(uuid) owner to postgres;

create or replace function public.staff_pending_access_duplicate_preflight(requested_school_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  active_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  email_conflicts jsonb := '[]'::jsonb;
  external_conflicts jsonb := '[]'::jsonb;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before reviewing duplicate staff records.';
  end if;

  if not public.can_manage_roles(actor_user_id, active_school_id) then
    raise exception 'Admin access is required before reviewing duplicate staff records.';
  end if;

  with duplicate_rows as (
    select
      lower(btrim(coalesce(sp.email, ''))) as conflict_value,
      count(*) as conflict_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', sp.id,
            'user_id', sp.user_id,
            'display_name', sp.display_name,
            'email', sp.email
          )
          order by sp.display_name, sp.email, sp.id
        ),
        '[]'::jsonb
      ) as profiles
    from public.staff_profiles as sp
    where nullif(lower(btrim(coalesce(sp.email, ''))), '') is not null
      and coalesce(sp.school_id, public.default_legacy_school_id()) = active_school_id
    group by lower(btrim(coalesce(sp.email, '')))
    having count(*) > 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', 'email',
        'value', conflict_value,
        'conflict_count', conflict_count,
        'message', format('%s staff records in this school share this email.', conflict_count),
        'profiles', profiles
      )
      order by conflict_value
    ),
    '[]'::jsonb
  )
  into email_conflicts
  from duplicate_rows;

  with duplicate_rows as (
    select
      lower(btrim(coalesce(sp.external_staff_id, ''))) as conflict_value,
      count(*) as conflict_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', sp.id,
            'user_id', sp.user_id,
            'display_name', sp.display_name,
            'email', sp.email,
            'external_staff_id', sp.external_staff_id
          )
          order by sp.display_name, sp.email, sp.id
        ),
        '[]'::jsonb
      ) as profiles
    from public.staff_profiles as sp
    where nullif(lower(btrim(coalesce(sp.external_staff_id, ''))), '') is not null
      and coalesce(sp.school_id, public.default_legacy_school_id()) = active_school_id
    group by lower(btrim(coalesce(sp.external_staff_id, '')))
    having count(*) > 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', 'external_staff_id',
        'value', conflict_value,
        'conflict_count', conflict_count,
        'message', format('%s staff records in this school share this external staff ID.', conflict_count),
        'profiles', profiles
      )
      order by conflict_value
    ),
    '[]'::jsonb
  )
  into external_conflicts
  from duplicate_rows;

  return jsonb_build_object(
    'has_conflicts', jsonb_array_length(email_conflicts) > 0 or jsonb_array_length(external_conflicts) > 0,
    'email_conflict_count', jsonb_array_length(email_conflicts),
    'external_id_conflict_count', jsonb_array_length(external_conflicts),
    'email_conflicts', email_conflicts,
    'external_id_conflicts', external_conflicts
  );
end;
$$;

alter function public.staff_pending_access_duplicate_preflight(uuid) owner to postgres;

create or replace function public.staff_pending_access_duplicate_preflight()
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.staff_pending_access_duplicate_preflight(null);
$$;

alter function public.staff_pending_access_duplicate_preflight() owner to postgres;

create or replace function public.activate_staff_pending_access_for_profile(
  target_profile_id uuid,
  target_user_id uuid,
  signed_in_email text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  profile_row public.staff_profiles%rowtype;
  approval_row public.staff_pending_access_approvals%rowtype;
  role_row record;
  scope_row record;
  duplicate_conflicts jsonb := '[]'::jsonb;
  safe_email text := lower(btrim(coalesce(signed_in_email, '')));
  failure_reason text := '';
  activated_roles text[] := array[]::text[];
  activated_scope_count integer := 0;
  audit_actor_user_id uuid := null;
  approval_school_id uuid := null;
  school_scope_value text := '';
  safe_role text := '';
  conflicting_school_name text := null;
begin
  if target_profile_id is null or target_user_id is null or safe_email = '' then
    return jsonb_build_object('status', 'noop');
  end if;

  select *
  into profile_row
  from public.staff_profiles
  where id = target_profile_id
  limit 1;

  if profile_row.id is null then
    return jsonb_build_object('status', 'noop');
  end if;

  if profile_row.archived_at is not null then
    failure_reason := 'Approved access cleared because the staff directory record is archived.';
    perform public.invalidate_staff_pending_approvals_for_profile(
      target_profile_id,
      failure_reason,
      target_user_id,
      jsonb_build_object(
        'source', 'pending_activation',
        'staff_archived', true,
        'school_id', coalesce(profile_row.school_id, public.default_legacy_school_id())
      )
    );
    return jsonb_build_object(
      'status', 'invalidated',
      'message', failure_reason
    );
  end if;

  if profile_row.user_id is distinct from target_user_id then
    return jsonb_build_object('status', 'noop');
  end if;

  if lower(btrim(coalesce(profile_row.email, ''))) <> safe_email then
    return jsonb_build_object('status', 'noop');
  end if;

  select *
  into approval_row
  from public.staff_pending_access_approvals
  where staff_profile_id = target_profile_id
    and status = 'approved'
  order by approved_at desc, created_at desc, id desc
  limit 1;

  if approval_row.id is null then
    return jsonb_build_object('status', 'none');
  end if;

  approval_school_id := coalesce(
    approval_row.school_id,
    profile_row.school_id,
    public.default_legacy_school_id()
  );

  duplicate_conflicts := public.get_staff_profile_duplicate_conflicts(target_profile_id, approval_school_id);
  if jsonb_array_length(duplicate_conflicts) > 0 then
    failure_reason := coalesce(
      duplicate_conflicts -> 0 ->> 'message',
      'Activation blocked because duplicate staff records need review.'
    );
    perform public.invalidate_staff_pending_approvals_for_profile(
      target_profile_id,
      failure_reason,
      target_user_id,
      jsonb_build_object(
        'source', 'pending_activation',
        'approval_id', approval_row.id,
        'duplicate_conflicts', duplicate_conflicts,
        'school_id', approval_school_id
      )
    );
    return jsonb_build_object(
      'status', 'invalidated',
      'message', failure_reason,
      'approval_id', approval_row.id
    );
  end if;

  if lower(btrim(coalesce(approval_row.approved_email, ''))) <> safe_email then
    failure_reason := 'Approval cleared because the imported email changed.';
    perform public.invalidate_staff_pending_approvals_for_profile(
      target_profile_id,
      failure_reason,
      target_user_id,
      jsonb_build_object(
        'source', 'pending_activation',
        'approval_id', approval_row.id,
        'school_id', approval_school_id
      )
    );
    return jsonb_build_object(
      'status', 'invalidated',
      'message', failure_reason,
      'approval_id', approval_row.id
    );
  end if;

  if approval_row.approved_external_staff_id is not null
    and lower(btrim(coalesce(profile_row.external_staff_id, ''))) <> lower(btrim(coalesce(approval_row.approved_external_staff_id, ''))) then
    failure_reason := 'Approval cleared because the imported external staff ID changed.';
    perform public.invalidate_staff_pending_approvals_for_profile(
      target_profile_id,
      failure_reason,
      target_user_id,
      jsonb_build_object(
        'source', 'pending_activation',
        'approval_id', approval_row.id,
        'school_id', approval_school_id
      )
    );
    return jsonb_build_object(
      'status', 'invalidated',
      'message', failure_reason,
      'approval_id', approval_row.id
    );
  end if;

  audit_actor_user_id := coalesce(approval_row.approved_by, target_user_id);
  school_scope_value := case
    when approval_school_id = public.default_legacy_school_id() then 'default'
    else approval_school_id::text
  end;

  begin
    for role_row in
      select role
      from public.staff_pending_role_assignments
      where approval_id = approval_row.id
        and coalesce(school_id, public.default_legacy_school_id()) = approval_school_id
      order by role
    loop
      safe_role := lower(btrim(coalesce(role_row.role, '')));

      select coalesce(s.name, 'another school')
      into conflicting_school_name
      from public.staff_role_assignments as sra
      left join public.schools as s
        on s.id = coalesce(sra.school_id, public.default_legacy_school_id())
      where sra.user_id = target_user_id
        and sra.role = safe_role
        and sra.active is true
        and coalesce(sra.school_id, public.default_legacy_school_id()) <> approval_school_id
      order by s.name, s.id
      limit 1;

      if conflicting_school_name is not null then
        raise exception 'This staff member already has the % role in %.', upper(safe_role), conflicting_school_name
          using hint = 'Revoke that role in the other school before activating it here.';
      end if;

      perform public.phase2_ensure_school_membership(target_user_id, approval_school_id, 'manual');

      update public.staff_role_assignments
      set active = true,
          granted_by = audit_actor_user_id,
          school_id = approval_school_id,
          updated_at = timezone('utc', now())
      where user_id = target_user_id
        and role = safe_role
        and coalesce(school_id, public.default_legacy_school_id()) = approval_school_id;

      if not found then
        insert into public.staff_role_assignments (user_id, role, active, granted_by, school_id)
        values (target_user_id, safe_role, true, audit_actor_user_id, approval_school_id);
      end if;

      if public.staff_role_uses_automatic_school_scope(safe_role) then
        update public.staff_scope_assignments
        set active = true,
            granted_by = audit_actor_user_id,
            school_id = approval_school_id,
            scope_value = school_scope_value,
            updated_at = timezone('utc', now())
        where user_id = target_user_id
          and role = safe_role
          and scope_type = 'school'
          and coalesce(school_id, public.default_legacy_school_id()) = approval_school_id
          and public.phase2_scope_value_matches(
            scope_type,
            scope_value,
            coalesce(school_id, public.default_legacy_school_id()),
            school_scope_value,
            approval_school_id
          );

        if not found then
          insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
          values (target_user_id, safe_role, 'school', school_scope_value, true, audit_actor_user_id, approval_school_id)
          on conflict do nothing;
        end if;
      end if;

      activated_roles := array_append(activated_roles, safe_role);

      perform public.log_staff_access_event(
        audit_actor_user_id,
        target_user_id,
        'grant_role',
        safe_role,
        null,
        null,
        jsonb_build_object(
          'source', 'pending_activation',
          'approval_id', approval_row.id,
          'staff_profile_id', target_profile_id,
          'school_id', approval_school_id
        )
      );
    end loop;

    for scope_row in
      select role, scope_type, scope_value
      from public.staff_pending_scope_assignments
      where approval_id = approval_row.id
        and coalesce(school_id, public.default_legacy_school_id()) = approval_school_id
      order by role, scope_type, scope_value
    loop
      if public.staff_role_uses_automatic_school_scope(scope_row.role)
        and scope_row.scope_type = 'school'
        and scope_row.scope_value = 'default' then
        continue;
      end if;

      if not public.has_role(scope_row.role, target_user_id, approval_school_id) then
        raise exception 'Grant the role before assigning scopes to it.';
      end if;

      select coalesce(s.name, 'another school')
      into conflicting_school_name
      from public.staff_scope_assignments as ssa
      left join public.schools as s
        on s.id = coalesce(ssa.school_id, public.default_legacy_school_id())
      where ssa.user_id = target_user_id
        and ssa.role = lower(btrim(coalesce(scope_row.role, '')))
        and ssa.scope_type = lower(btrim(coalesce(scope_row.scope_type, '')))
        and ssa.active is true
        and coalesce(ssa.school_id, public.default_legacy_school_id()) <> approval_school_id
        and public.phase2_scope_value_matches(
          ssa.scope_type,
          ssa.scope_value,
          coalesce(ssa.school_id, public.default_legacy_school_id()),
          scope_row.scope_value,
          approval_school_id
        )
      order by s.name, s.id
      limit 1;

      if conflicting_school_name is not null then
        raise exception 'This staff member already has that scope in %.', conflicting_school_name
          using hint = 'Revoke the scope in the other school before activating it here.';
      end if;

      update public.staff_scope_assignments
      set active = true,
          granted_by = audit_actor_user_id,
          school_id = approval_school_id,
          updated_at = timezone('utc', now())
      where user_id = target_user_id
        and role = lower(btrim(coalesce(scope_row.role, '')))
        and scope_type = lower(btrim(coalesce(scope_row.scope_type, '')))
        and coalesce(school_id, public.default_legacy_school_id()) = approval_school_id
        and public.phase2_scope_value_matches(
          scope_type,
          scope_value,
          coalesce(school_id, public.default_legacy_school_id()),
          scope_row.scope_value,
          approval_school_id
        );

      if not found then
        insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
        values (
          target_user_id,
          lower(btrim(coalesce(scope_row.role, ''))),
          lower(btrim(coalesce(scope_row.scope_type, ''))),
          btrim(coalesce(scope_row.scope_value, '')),
          true,
          audit_actor_user_id,
          approval_school_id
        );
      end if;

      activated_scope_count := activated_scope_count + 1;

      perform public.log_staff_access_event(
        audit_actor_user_id,
        target_user_id,
        'grant_scope',
        scope_row.role,
        scope_row.scope_type,
        scope_row.scope_value,
        jsonb_build_object(
          'source', 'pending_activation',
          'approval_id', approval_row.id,
          'staff_profile_id', target_profile_id,
          'school_id', approval_school_id
        )
      );
    end loop;

    update public.staff_pending_access_approvals
    set status = 'activated',
        activated_user_id = target_user_id,
        activated_at = timezone('utc', now()),
        last_failure_reason = null,
        last_failure_at = null,
        updated_at = timezone('utc', now())
    where id = approval_row.id;

    perform public.log_staff_pending_access_event(
      audit_actor_user_id,
      target_profile_id,
      approval_row.id,
      'activate',
      'Approved staff access activated on first sign-in.',
      jsonb_build_object(
        'source', 'pending_activation',
        'role_count', coalesce(array_length(activated_roles, 1), 0),
        'scope_count', activated_scope_count,
        'school_id', approval_school_id
      )
    );

    return jsonb_build_object(
      'status', 'activated',
      'approval_id', approval_row.id,
      'activated_roles', to_jsonb(coalesce(activated_roles, array[]::text[])),
      'activated_scope_count', activated_scope_count
    );
  exception
    when others then
      failure_reason := sqlerrm;

      update public.staff_pending_access_approvals
      set last_failure_reason = failure_reason,
          last_failure_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      where id = approval_row.id;

      perform public.log_staff_pending_access_event(
        audit_actor_user_id,
        target_profile_id,
        approval_row.id,
        'activate_blocked',
        failure_reason,
        jsonb_build_object(
          'source', 'pending_activation',
          'school_id', approval_school_id
        )
      );

      return jsonb_build_object(
        'status', 'blocked',
        'message', failure_reason,
        'approval_id', approval_row.id
      );
  end;
end;
$$;

alter function public.activate_staff_pending_access_for_profile(uuid, uuid, text) owner to postgres;

create or replace function public.import_staff_directory_csv(
  import_rows jsonb default '[]'::jsonb,
  import_file_name text default null,
  preview_summary jsonb default '{}'::jsonb,
  requested_school_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  active_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  batch_id uuid := gen_random_uuid();
  row_item jsonb;
  safe_rows jsonb := case when jsonb_typeof(import_rows) = 'array' then import_rows else '[]'::jsonb end;
  safe_file_name text := nullif(btrim(coalesce(import_file_name, '')), '');
  safe_email text;
  safe_display_name text;
  safe_external_staff_id text;
  safe_notes text;
  safe_role_suggestion text;
  safe_metadata jsonb;
  matched_by_email_count integer;
  matched_by_external_count integer;
  matched_email_profile public.staff_profiles%rowtype;
  matched_external_profile public.staff_profiles%rowtype;
  matched_profile public.staff_profiles%rowtype;
  final_action text;
  email_changed boolean;
  external_id_changed boolean;
  invalidation_reason text;
  v_rows_processed integer := 0;
  v_created_count integer := 0;
  v_updated_count integer := 0;
  v_skipped_count integer := 0;
  v_warning_count integer := greatest(0, coalesce((preview_summary ->> 'warning_count')::integer, 0));
  v_error_count integer := greatest(0, coalesce((preview_summary ->> 'error_count')::integer, 0));
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before importing staff.';
  end if;

  if not public.can_import_csv(actor_user_id, active_school_id) then
    raise exception 'Admin access is required before importing staff.';
  end if;

  if jsonb_typeof(safe_rows) <> 'array' or jsonb_array_length(safe_rows) = 0 then
    raise exception 'Choose at least one valid CSV row before importing staff.';
  end if;

  insert into public.staff_import_batches (
    id,
    actor_user_id,
    file_name,
    rows_processed,
    created_count,
    updated_count,
    skipped_count,
    warning_count,
    error_count,
    metadata,
    created_at,
    school_id
  )
  values (
    batch_id,
    actor_user_id,
    safe_file_name,
    0,
    0,
    0,
    0,
    v_warning_count,
    v_error_count,
    jsonb_build_object(
      'source', 'csv_import',
      'preview_summary', coalesce(preview_summary, '{}'::jsonb)
    ),
    timezone('utc', now()),
    active_school_id
  );

  for row_item in
    select value
    from jsonb_array_elements(safe_rows)
  loop
    v_rows_processed := v_rows_processed + 1;
    final_action := lower(btrim(coalesce(row_item ->> 'final_action', 'skip')));
    if final_action not in ('create', 'update') then
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    safe_email := lower(btrim(coalesce(row_item ->> 'email', '')));
    safe_display_name := regexp_replace(btrim(coalesce(row_item ->> 'full_name', '')), '\s+', ' ', 'g');
    safe_external_staff_id := nullif(regexp_replace(btrim(coalesce(row_item ->> 'external_staff_id', '')), '\s+', ' ', 'g'), '');
    safe_notes := nullif(btrim(coalesce(row_item ->> 'notes', '')), '');
    safe_role_suggestion := nullif(btrim(coalesce(row_item ->> 'role_suggestion', '')), '');

    if safe_email = '' or safe_display_name = '' or safe_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      v_error_count := v_error_count + 1;
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    matched_email_profile := null;
    matched_external_profile := null;
    matched_profile := null;

    select count(*)
    into matched_by_email_count
    from public.staff_profiles
    where lower(email) = safe_email
      and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

    if matched_by_email_count = 1 then
      select *
      into matched_email_profile
      from public.staff_profiles
      where lower(email) = safe_email
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
      limit 1;
    elsif matched_by_email_count > 1 then
      v_error_count := v_error_count + 1;
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    if safe_external_staff_id is not null then
      select count(*)
      into matched_by_external_count
      from public.staff_profiles
      where lower(coalesce(external_staff_id, '')) = lower(safe_external_staff_id)
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

      if matched_by_external_count = 1 then
        select *
        into matched_external_profile
        from public.staff_profiles
        where lower(coalesce(external_staff_id, '')) = lower(safe_external_staff_id)
          and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
        limit 1;
      elsif matched_by_external_count > 1 then
        v_error_count := v_error_count + 1;
        v_skipped_count := v_skipped_count + 1;
        continue;
      end if;
    end if;

    if matched_email_profile.id is not null and matched_external_profile.id is not null
      and matched_email_profile.id <> matched_external_profile.id then
      v_error_count := v_error_count + 1;
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    matched_profile := coalesce(matched_email_profile, matched_external_profile);
    safe_metadata := jsonb_strip_nulls(
      jsonb_build_object(
        'source', 'csv_import',
        'role_suggestion', safe_role_suggestion,
        'department_suggestion_values', coalesce(row_item -> 'department_suggestion_values', '[]'::jsonb),
        'year_group_suggestion_values', coalesce(row_item -> 'year_group_suggestion_values', '[]'::jsonb),
        'class_scope_suggestion_values', coalesce(row_item -> 'class_scope_suggestion_values', '[]'::jsonb),
        'notes', safe_notes,
        'external_staff_id', safe_external_staff_id,
        'file_name', safe_file_name
      )
    );

    if matched_profile.id is null then
      insert into public.staff_profiles (
        id,
        user_id,
        email,
        display_name,
        external_staff_id,
        notes,
        profile_source,
        import_metadata,
        last_import_batch_id,
        last_imported_at,
        last_imported_by,
        created_at,
        updated_at,
        school_id
      )
      values (
        gen_random_uuid(),
        null,
        safe_email,
        safe_display_name,
        safe_external_staff_id,
        safe_notes,
        'csv_import',
        safe_metadata,
        batch_id,
        timezone('utc', now()),
        actor_user_id,
        timezone('utc', now()),
        timezone('utc', now()),
        active_school_id
      );
      v_created_count := v_created_count + 1;
    else
      email_changed := matched_profile.user_id is null
        and lower(btrim(coalesce(matched_profile.email, ''))) <> safe_email;
      external_id_changed := safe_external_staff_id is not null
        and lower(btrim(coalesce(matched_profile.external_staff_id, ''))) <> lower(safe_external_staff_id);

      update public.staff_profiles
      set email = case
            when email_changed then safe_email
            else email
          end,
          display_name = safe_display_name,
          external_staff_id = coalesce(safe_external_staff_id, external_staff_id),
          notes = case when safe_notes is not null then safe_notes else notes end,
          import_metadata = safe_metadata,
          last_import_batch_id = batch_id,
          last_imported_at = timezone('utc', now()),
          last_imported_by = actor_user_id,
          updated_at = timezone('utc', now())
      where id = matched_profile.id;

      invalidation_reason := null;
      if email_changed and external_id_changed then
        invalidation_reason := 'Approval cleared because the imported email and external staff ID changed.';
      elsif email_changed then
        invalidation_reason := 'Approval cleared because the imported email changed.';
      elsif external_id_changed then
        invalidation_reason := 'Approval cleared because the imported external staff ID changed.';
      end if;

      if invalidation_reason is not null then
        perform public.invalidate_staff_pending_approvals_for_profile(
          matched_profile.id,
          invalidation_reason,
          actor_user_id,
          jsonb_build_object(
            'source', 'csv_import',
            'batch_id', batch_id,
            'file_name', safe_file_name,
            'school_id', active_school_id
          )
        );
      end if;

      v_updated_count := v_updated_count + 1;
    end if;
  end loop;

  update public.staff_import_batches as sib
  set rows_processed = greatest(v_rows_processed, coalesce((preview_summary ->> 'total_rows')::integer, v_rows_processed)),
      created_count = v_created_count,
      updated_count = v_updated_count,
      skipped_count = greatest(v_skipped_count, coalesce((preview_summary ->> 'skipped_count')::integer, v_skipped_count)),
      warning_count = v_warning_count,
      error_count = v_error_count,
      metadata = coalesce(sib.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'source', 'csv_import',
          'preview_summary', coalesce(preview_summary, '{}'::jsonb),
          'committed_row_count', v_created_count + v_updated_count
        )
  where id = batch_id;

  return jsonb_build_object(
    'batch_id', batch_id,
    'rows_processed', greatest(v_rows_processed, coalesce((preview_summary ->> 'total_rows')::integer, v_rows_processed)),
    'created_count', v_created_count,
    'updated_count', v_updated_count,
    'skipped_count', greatest(v_skipped_count, coalesce((preview_summary ->> 'skipped_count')::integer, v_skipped_count)),
    'warning_count', v_warning_count,
    'error_count', v_error_count
  );
end;
$$;

alter function public.import_staff_directory_csv(jsonb, text, jsonb, uuid) owner to postgres;

create or replace function public.import_staff_directory_csv(
  import_rows jsonb default '[]'::jsonb,
  import_file_name text default null,
  preview_summary jsonb default '{}'::jsonb
) returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.import_staff_directory_csv(
    import_rows,
    import_file_name,
    preview_summary,
    null
  );
$$;

alter function public.import_staff_directory_csv(jsonb, text, jsonb) owner to postgres;

create or replace function public.pupil_directory_duplicate_preflight(requested_school_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  active_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  mis_id_conflicts jsonb := '[]'::jsonb;
  username_conflicts jsonb := '[]'::jsonb;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before reviewing pupil import data.';
  end if;

  if not public.can_import_csv(actor_user_id, active_school_id) then
    raise exception 'Admin access is required before reviewing pupil import data.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', 'mis_id',
        'value', conflict_value,
        'conflict_count', conflict_count,
        'message', format('MIS ID "%s" is used by %s pupil records in this school. Review pupil records before importing.', conflict_value, conflict_count),
        'conflicting_pupils', conflicting_pupils
      )
      order by conflict_value
    ),
    '[]'::jsonb
  )
  into mis_id_conflicts
  from (
    select
      duplicated.conflict_value,
      duplicated.conflict_count,
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'mis_id', btrim(coalesce(p.mis_id, '')),
              'username', lower(btrim(coalesce(p.username, ''))),
              'first_name', btrim(coalesce(p.first_name, '')),
              'surname', btrim(coalesce(p.surname, ''))
            )
            order by btrim(coalesce(p.surname, '')), btrim(coalesce(p.first_name, '')), lower(btrim(coalesce(p.username, ''))), p.id
          ),
          '[]'::jsonb
        )
        from public.pupils as p
        where public.normalize_pupil_import_lookup_text(p.mis_id) = duplicated.normalized_value
          and coalesce(p.school_id, public.default_legacy_school_id()) = active_school_id
      ) as conflicting_pupils
    from (
      select
        public.normalize_pupil_import_lookup_text(mis_id) as normalized_value,
        min(btrim(mis_id)) as conflict_value,
        count(*)::integer as conflict_count
      from public.pupils
      where mis_id is not null
        and btrim(mis_id) <> ''
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
      group by public.normalize_pupil_import_lookup_text(mis_id)
      having count(*) > 1
    ) as duplicated
  ) as conflicts;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', 'username',
        'value', conflict_value,
        'conflict_count', conflict_count,
        'message', format('Username "%s" is used by %s pupil records in this school. Review pupil records before uniqueness hardening.', conflict_value, conflict_count),
        'conflicting_pupils', conflicting_pupils
      )
      order by conflict_value
    ),
    '[]'::jsonb
  )
  into username_conflicts
  from (
    select
      duplicated.conflict_value,
      duplicated.conflict_count,
      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'mis_id', btrim(coalesce(p.mis_id, '')),
              'username', lower(btrim(coalesce(p.username, ''))),
              'first_name', btrim(coalesce(p.first_name, '')),
              'surname', btrim(coalesce(p.surname, ''))
            )
            order by btrim(coalesce(p.surname, '')), btrim(coalesce(p.first_name, '')), lower(btrim(coalesce(p.username, ''))), p.id
          ),
          '[]'::jsonb
        )
        from public.pupils as p
        where public.normalize_pupil_import_lookup_text(p.username) = duplicated.normalized_value
          and coalesce(p.school_id, public.default_legacy_school_id()) = active_school_id
      ) as conflicting_pupils
    from (
      select
        public.normalize_pupil_import_lookup_text(username) as normalized_value,
        min(lower(btrim(username))) as conflict_value,
        count(*)::integer as conflict_count
      from public.pupils
      where username is not null
        and btrim(username) <> ''
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
      group by public.normalize_pupil_import_lookup_text(username)
      having count(*) > 1
    ) as duplicated
  ) as conflicts;

  return jsonb_build_object(
    'has_conflicts', jsonb_array_length(mis_id_conflicts) > 0 or jsonb_array_length(username_conflicts) > 0,
    'mis_id_conflict_count', jsonb_array_length(mis_id_conflicts),
    'username_conflict_count', jsonb_array_length(username_conflicts),
    'mis_id_conflicts', mis_id_conflicts,
    'username_conflicts', username_conflicts
  );
end;
$$;

alter function public.pupil_directory_duplicate_preflight(uuid) owner to postgres;

create or replace function public.pupil_directory_duplicate_preflight()
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.pupil_directory_duplicate_preflight(null);
$$;

alter function public.pupil_directory_duplicate_preflight() owner to postgres;

create or replace function public.import_pupil_roster_csv(
  import_rows jsonb default '[]'::jsonb,
  import_file_name text default null,
  preview_summary jsonb default '{}'::jsonb,
  requested_school_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  active_school_id uuid := public.phase3_resolve_active_school_id(actor_user_id, requested_school_id);
  batch_id uuid := gen_random_uuid();
  row_item jsonb;
  planned_row record;
  planned_form_class record;
  safe_rows jsonb := case when jsonb_typeof(import_rows) = 'array' then import_rows else '[]'::jsonb end;
  safe_file_name text := nullif(btrim(coalesce(import_file_name, '')), '');
  safe_preview_summary jsonb := case when jsonb_typeof(preview_summary) = 'object' then preview_summary else '{}'::jsonb end;
  safe_row_number integer := 1;
  safe_row_index integer := 0;
  safe_mis_id text;
  safe_first_name text;
  safe_surname text;
  safe_form_class text;
  safe_year_group text;
  safe_pp_value text;
  safe_sen_value text;
  safe_gender_value text;
  normalized_mis_id text;
  normalized_form_class text;
  normalized_year_group text;
  normalized_pp_value text;
  normalized_sen_value text;
  normalized_gender_value text;
  matched_pupil_count integer;
  exact_class_count integer;
  form_class_count integer;
  exact_pair_count integer;
  form_pair_count integer;
  other_active_form_count integer;
  actual_year_group text;
  final_action text;
  v_create_form_class boolean;
  v_create_form_class_key text;
  safe_target_class_label text;
  safe_import_metadata jsonb;
  safe_membership_metadata jsonb;
  matched_pupil public.pupils%rowtype;
  working_pupil public.pupils%rowtype;
  target_class public.classes%rowtype;
  target_membership public.pupil_classes%rowtype;
  created_username text;
  created_pin text;
  create_attempt integer;
  row_now timestamptz;
  v_rows_processed integer := 0;
  v_created_count integer := 0;
  v_updated_count integer := 0;
  v_replaced_count integer := 0;
  v_form_classes_created_count integer := 0;
  v_skipped_count integer := greatest(0, coalesce((safe_preview_summary ->> 'skipped_count')::integer, 0));
  v_warning_count integer := greatest(0, coalesce((safe_preview_summary ->> 'warning_count')::integer, 0));
  v_error_count integer := greatest(0, coalesce((safe_preview_summary ->> 'error_count')::integer, 0));
  v_late_errors jsonb := '[]'::jsonb;
  v_created_credentials jsonb := '[]'::jsonb;
  v_form_classes_created jsonb := '[]'::jsonb;
  v_row_error_message text;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before importing pupils.';
  end if;

  if not public.can_import_csv(actor_user_id, active_school_id) then
    raise exception 'Admin access is required before importing pupils.';
  end if;

  if jsonb_typeof(safe_rows) <> 'array' or jsonb_array_length(safe_rows) = 0 then
    raise exception 'Choose at least one safe CSV row before importing pupils.';
  end if;

  insert into public.pupil_import_batches (
    id,
    actor_user_id,
    file_name,
    rows_processed,
    created_count,
    updated_count,
    replaced_count,
    skipped_count,
    warning_count,
    error_count,
    metadata,
    created_at,
    school_id
  )
  values (
    batch_id,
    actor_user_id,
    safe_file_name,
    0,
    0,
    0,
    0,
    v_skipped_count,
    v_warning_count,
    v_error_count,
    jsonb_build_object(
      'source', 'csv_import',
      'preview_summary', safe_preview_summary
    ),
    timezone('utc', now()),
    active_school_id
  );

  perform set_config('app.pupil_import_mode', 'on', true);

  drop table if exists pg_temp.pupil_import_row_plan;
  create temp table pg_temp.pupil_import_row_plan (
    row_index integer not null,
    row_number integer not null,
    final_action text not null,
    mis_id text not null,
    normalized_mis_id text not null,
    first_name text not null,
    surname text not null,
    form_class text not null,
    normalized_form_class text not null,
    year_group text,
    normalized_year_group text,
    target_class_id uuid,
    create_form_class boolean not null default false,
    create_form_class_key text,
    pp_value text,
    sen_value text,
    gender_value text,
    late_error_message text
  ) on commit drop;

  for row_item in
    select value
    from jsonb_array_elements(safe_rows)
  loop
    v_rows_processed := v_rows_processed + 1;
    safe_row_index := v_rows_processed;
    safe_row_number := v_rows_processed;
    safe_mis_id := null;
    safe_first_name := null;
    safe_surname := null;
    safe_form_class := null;
    safe_year_group := null;
    safe_pp_value := null;
    safe_sen_value := null;
    safe_gender_value := null;
    normalized_mis_id := null;
    normalized_form_class := null;
    normalized_year_group := null;
    normalized_pp_value := null;
    normalized_sen_value := null;
    normalized_gender_value := null;
    v_row_error_message := null;
    target_class := null;
    v_create_form_class := false;
    v_create_form_class_key := null;

    begin
      final_action := lower(btrim(coalesce(row_item ->> 'final_action', 'skip')));
      if final_action not in ('create', 'update', 'replace_form') then
        v_skipped_count := v_skipped_count + 1;
        continue;
      end if;

      safe_row_number := greatest(1, coalesce(nullif(row_item ->> 'row_number', '')::integer, v_rows_processed));
      safe_mis_id := regexp_replace(btrim(coalesce(row_item ->> 'mis_id', '')), '\s+', ' ', 'g');
      safe_first_name := regexp_replace(btrim(coalesce(row_item ->> 'first_name', '')), '\s+', ' ', 'g');
      safe_surname := regexp_replace(btrim(coalesce(row_item ->> 'surname', '')), '\s+', ' ', 'g');
      safe_form_class := regexp_replace(btrim(coalesce(row_item ->> 'form_class', '')), '\s+', ' ', 'g');
      safe_year_group := nullif(regexp_replace(btrim(coalesce(row_item ->> 'year_group', '')), '\s+', ' ', 'g'), '');
      safe_pp_value := nullif(regexp_replace(btrim(coalesce(row_item ->> 'pp', '')), '\s+', ' ', 'g'), '');
      safe_sen_value := nullif(regexp_replace(btrim(coalesce(row_item ->> 'sen', '')), '\s+', ' ', 'g'), '');
      safe_gender_value := nullif(regexp_replace(btrim(coalesce(row_item ->> 'gender', '')), '\s+', ' ', 'g'), '');
      normalized_mis_id := public.normalize_pupil_import_lookup_text(safe_mis_id);
      normalized_form_class := public.normalize_pupil_import_lookup_text(safe_form_class);
      normalized_year_group := public.normalize_pupil_import_lookup_text(safe_year_group);
      normalized_pp_value := public.normalize_pupil_import_group_value('pp', safe_pp_value);
      normalized_sen_value := public.normalize_pupil_import_group_value('sen', safe_sen_value);
      normalized_gender_value := public.normalize_pupil_import_group_value('gender', safe_gender_value);

      if safe_mis_id = '' then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, 'MIS ID is missing. Add a value in the mis_id column, then re-import.');
        raise exception '%', v_row_error_message;
      end if;
      if safe_first_name = '' then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, 'first name is missing. Add it, then re-import.');
        raise exception '%', v_row_error_message;
      end if;
      if safe_surname = '' then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, 'surname is missing. Add it, then re-import.');
        raise exception '%', v_row_error_message;
      end if;
      if safe_form_class = '' then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, 'form class is missing. Add a value in the form_class column, then re-import.');
        raise exception '%', v_row_error_message;
      end if;
      if safe_pp_value is not null and normalized_pp_value is null then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('PP value "%s" is not recognised. Use PP/Yes/1 or Non-PP/No/0.', safe_pp_value));
        raise exception '%', v_row_error_message;
      end if;
      if safe_sen_value is not null and normalized_sen_value is null then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('SEN value "%s" is not recognised. Use SEN, SEN support, EHCP, No SEN, or Non-SEN.', safe_sen_value));
        raise exception '%', v_row_error_message;
      end if;
      if safe_gender_value is not null and normalized_gender_value is null then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('gender value "%s" is not recognised. Use female, male, non-binary, or other.', safe_gender_value));
        raise exception '%', v_row_error_message;
      end if;

      select count(*)
      into matched_pupil_count
      from public.pupils
      where public.normalize_pupil_import_lookup_text(mis_id) = normalized_mis_id
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

      if matched_pupil_count > 1 then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('more than one pupil already uses MIS ID "%s". Review pupil records before importing.', safe_mis_id));
        raise exception '%', v_row_error_message;
      end if;

      if matched_pupil_count = 1 then
        select *
        into matched_pupil
        from public.pupils
        where public.normalize_pupil_import_lookup_text(mis_id) = normalized_mis_id
          and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
        limit 1;
      end if;

      select count(*)
      into exact_class_count
      from public.classes
      where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

      select count(*)
      into form_class_count
      from public.classes
      where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
        and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

      if normalized_year_group <> '' then
        select count(*)
        into exact_pair_count
        from public.classes
        where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
          and public.normalize_pupil_import_lookup_text(year_group) = normalized_year_group
          and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

        select count(*)
        into form_pair_count
        from public.classes
        where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
          and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
          and public.normalize_pupil_import_lookup_text(year_group) = normalized_year_group
          and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

        if form_pair_count = 1 then
          select *
          into target_class
          from public.classes
          where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
            and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
            and public.normalize_pupil_import_lookup_text(year_group) = normalized_year_group
            and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
          order by name, year_group, id
          limit 1;
        elsif form_pair_count > 1 then
          v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('more than one form class matches "%s". Use the exact form class name.', safe_form_class));
          raise exception '%', v_row_error_message;
        elsif exact_pair_count > 0 then
          v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('"%s" is not a form class. Use a form or tutor class instead.', safe_form_class));
          raise exception '%', v_row_error_message;
        elsif form_class_count = 0 then
          if exact_class_count > 0 then
            v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('"%s" is not a form class. Use a form or tutor class instead.', safe_form_class));
            raise exception '%', v_row_error_message;
          end if;
          v_create_form_class := true;
          v_create_form_class_key := normalized_form_class || '::' || normalized_year_group;
        elsif form_class_count = 1 then
          select coalesce(nullif(btrim(year_group), ''), 'a different year group')
          into actual_year_group
          from public.classes
          where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
            and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
            and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
          order by name, year_group, id
          limit 1;

          v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('form class "%s" exists in %s, not %s. Check the class or year group.', safe_form_class, actual_year_group, safe_year_group));
          raise exception '%', v_row_error_message;
        else
          v_create_form_class := true;
          v_create_form_class_key := normalized_form_class || '::' || normalized_year_group;
        end if;
      elsif form_class_count = 0 then
        if exact_class_count > 0 then
          v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('"%s" is not a form class. Use a form or tutor class instead.', safe_form_class));
        else
          v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('form class "%s" was not found. Add year_group so this new form group can be created.', safe_form_class));
        end if;
        raise exception '%', v_row_error_message;
      elsif form_class_count > 1 then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('more than one form class matches "%s". Use year_group to pick the right form.', safe_form_class));
        raise exception '%', v_row_error_message;
      else
        select *
        into target_class
        from public.classes
        where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
          and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
          and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
        order by name, year_group, id
        limit 1;
      end if;

      insert into pg_temp.pupil_import_row_plan (
        row_index,
        row_number,
        final_action,
        mis_id,
        normalized_mis_id,
        first_name,
        surname,
        form_class,
        normalized_form_class,
        year_group,
        normalized_year_group,
        target_class_id,
        create_form_class,
        create_form_class_key,
        pp_value,
        sen_value,
        gender_value,
        late_error_message
      )
      values (
        safe_row_index,
        safe_row_number,
        final_action,
        safe_mis_id,
        normalized_mis_id,
        safe_first_name,
        safe_surname,
        safe_form_class,
        normalized_form_class,
        safe_year_group,
        normalized_year_group,
        target_class.id,
        v_create_form_class,
        v_create_form_class_key,
        normalized_pp_value,
        normalized_sen_value,
        normalized_gender_value,
        null
      );
    exception
      when others then
        v_row_error_message := coalesce(
          v_row_error_message,
          public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, 'Could not import this row. Review the pupil record and try again.')
        );
        v_error_count := v_error_count + 1;
        v_skipped_count := v_skipped_count + 1;
        v_late_errors := v_late_errors || jsonb_build_array(v_row_error_message);
    end;
  end loop;

  for planned_form_class in
    select distinct
      row_plan.create_form_class_key,
      row_plan.form_class,
      row_plan.normalized_form_class,
      row_plan.year_group,
      row_plan.normalized_year_group
    from pg_temp.pupil_import_row_plan as row_plan
    where row_plan.create_form_class = true
      and row_plan.create_form_class_key is not null
    order by row_plan.form_class, row_plan.year_group
  loop
    target_class := null;

    begin
      select count(*)
      into form_pair_count
      from public.classes
      where public.normalize_pupil_import_lookup_text(name) = planned_form_class.normalized_form_class
        and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
        and public.normalize_pupil_import_lookup_text(year_group) = planned_form_class.normalized_year_group
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

      if form_pair_count = 1 then
        select *
        into target_class
        from public.classes
        where public.normalize_pupil_import_lookup_text(name) = planned_form_class.normalized_form_class
          and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
          and public.normalize_pupil_import_lookup_text(year_group) = planned_form_class.normalized_year_group
          and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
        order by name, year_group, id
        limit 1;
      elsif form_pair_count > 1 then
        update pg_temp.pupil_import_row_plan as row_plan
        set late_error_message = public.build_pupil_import_row_message(
          row_number,
          first_name,
          surname,
          format('more than one form class matches "%s". Use the exact form class name.', planned_form_class.form_class)
        )
        where row_plan.create_form_class_key = planned_form_class.create_form_class_key
          and row_plan.late_error_message is null;
        continue;
      else
        select count(*)
        into exact_pair_count
        from public.classes
        where public.normalize_pupil_import_lookup_text(name) = planned_form_class.normalized_form_class
          and public.normalize_pupil_import_lookup_text(year_group) = planned_form_class.normalized_year_group
          and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

        if exact_pair_count > 0 then
          update pg_temp.pupil_import_row_plan as row_plan
          set late_error_message = public.build_pupil_import_row_message(
            row_number,
            first_name,
            surname,
            format('"%s" is not a form class. Use a form or tutor class instead.', planned_form_class.form_class)
          )
          where row_plan.create_form_class_key = planned_form_class.create_form_class_key
            and row_plan.late_error_message is null;
          continue;
        end if;

        for create_attempt in 1..24 loop
          begin
            insert into public.classes (
              id,
              teacher_id,
              name,
              join_code,
              year_group,
              class_type,
              school_id
            )
            values (
              gen_random_uuid(),
              actor_user_id,
              planned_form_class.form_class,
              public.generate_pupil_import_join_code(),
              planned_form_class.year_group,
              'form',
              active_school_id
            )
            returning *
            into target_class;
            exit;
          exception
            when unique_violation then
              select count(*)
              into form_pair_count
              from public.classes
              where public.normalize_pupil_import_lookup_text(name) = planned_form_class.normalized_form_class
                and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
                and public.normalize_pupil_import_lookup_text(year_group) = planned_form_class.normalized_year_group
                and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

              if form_pair_count = 1 then
                select *
                into target_class
                from public.classes
                where public.normalize_pupil_import_lookup_text(name) = planned_form_class.normalized_form_class
                  and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
                  and public.normalize_pupil_import_lookup_text(year_group) = planned_form_class.normalized_year_group
                  and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
                order by name, year_group, id
                limit 1;
                exit;
              end if;

              if create_attempt = 24 then
                raise;
              end if;
          end;
        end loop;

        if target_class.id is null then
          update pg_temp.pupil_import_row_plan as row_plan
          set late_error_message = public.build_pupil_import_row_message(
            row_number,
            first_name,
            surname,
            format('Could not create form class "%s" in %s. Review the form group and try again.', planned_form_class.form_class, planned_form_class.year_group)
          )
          where row_plan.create_form_class_key = planned_form_class.create_form_class_key
            and row_plan.late_error_message is null;
          continue;
        end if;

        safe_target_class_label := case
          when nullif(btrim(coalesce(target_class.name, '')), '') is not null
            and nullif(btrim(coalesce(target_class.year_group, '')), '') is not null
            then format('%s (%s)', btrim(target_class.name), btrim(target_class.year_group))
          when nullif(btrim(coalesce(target_class.name, '')), '') is not null
            then btrim(target_class.name)
          else 'Unnamed form class'
        end;

        v_form_classes_created_count := v_form_classes_created_count + 1;
        v_form_classes_created := v_form_classes_created || jsonb_build_array(
          jsonb_strip_nulls(
            jsonb_build_object(
              'id', target_class.id,
              'name', nullif(btrim(coalesce(target_class.name, '')), ''),
              'year_group', nullif(btrim(coalesce(target_class.year_group, '')), ''),
              'label', safe_target_class_label
            )
          )
        );
      end if;

      update pg_temp.pupil_import_row_plan as row_plan
      set target_class_id = target_class.id
      where row_plan.create_form_class_key = planned_form_class.create_form_class_key;
    exception
      when others then
        update pg_temp.pupil_import_row_plan as row_plan
        set late_error_message = public.build_pupil_import_row_message(
          row_number,
          first_name,
          surname,
          format('Could not create form class "%s" in %s. Review the form group and try again.', planned_form_class.form_class, planned_form_class.year_group)
        )
        where row_plan.create_form_class_key = planned_form_class.create_form_class_key
          and row_plan.late_error_message is null;
    end;
  end loop;

  for planned_row in
    select *
    from pg_temp.pupil_import_row_plan
    order by row_index
  loop
    safe_row_number := planned_row.row_number;
    safe_mis_id := planned_row.mis_id;
    safe_first_name := planned_row.first_name;
    safe_surname := planned_row.surname;
    safe_form_class := planned_row.form_class;
    safe_year_group := planned_row.year_group;
    normalized_mis_id := planned_row.normalized_mis_id;
    normalized_pp_value := planned_row.pp_value;
    normalized_sen_value := planned_row.sen_value;
    normalized_gender_value := planned_row.gender_value;
    v_row_error_message := planned_row.late_error_message;
    matched_pupil := null;
    working_pupil := null;
    target_class := null;
    target_membership := null;
    safe_target_class_label := null;
    created_username := null;
    created_pin := null;
    other_active_form_count := 0;
    row_now := timezone('utc', now());

    begin
      if v_row_error_message is not null then
        raise exception '%', v_row_error_message;
      end if;

      if planned_row.target_class_id is null then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, 'Could not resolve the target form class. Review the form group and try again.');
        raise exception '%', v_row_error_message;
      end if;

      select *
      into target_class
      from public.classes
      where id = planned_row.target_class_id
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
      limit 1;

      if target_class.id is null then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, 'Could not resolve the target form class. Review the form group and try again.');
        raise exception '%', v_row_error_message;
      end if;

      safe_target_class_label := case
        when nullif(btrim(coalesce(target_class.name, '')), '') is not null
          and nullif(btrim(coalesce(target_class.year_group, '')), '') is not null
          then format('%s (%s)', btrim(target_class.name), btrim(target_class.year_group))
        when nullif(btrim(coalesce(target_class.name, '')), '') is not null
          then btrim(target_class.name)
        else 'Unnamed form class'
      end;

      safe_import_metadata := jsonb_strip_nulls(
        jsonb_build_object(
          'source', 'csv_import',
          'file_name', safe_file_name,
          'row_number', safe_row_number,
          'mis_id', safe_mis_id,
          'form_class', safe_form_class,
          'year_group', safe_year_group,
          'pp', normalized_pp_value,
          'sen', normalized_sen_value,
          'gender', normalized_gender_value
        )
      );

      safe_membership_metadata := jsonb_strip_nulls(
        jsonb_build_object(
          'source', 'csv_import',
          'file_name', safe_file_name,
          'row_number', safe_row_number,
          'form_class', safe_form_class,
          'year_group', safe_year_group
        )
      );

      select count(*)
      into matched_pupil_count
      from public.pupils
      where public.normalize_pupil_import_lookup_text(mis_id) = normalized_mis_id
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id;

      if matched_pupil_count > 1 then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('more than one pupil already uses MIS ID "%s". Review pupil records before importing.', safe_mis_id));
        raise exception '%', v_row_error_message;
      end if;

      if matched_pupil_count = 1 then
        select *
        into matched_pupil
        from public.pupils
        where public.normalize_pupil_import_lookup_text(mis_id) = normalized_mis_id
          and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
        limit 1;
      end if;

      if matched_pupil.id is null then
        created_username := public.generate_pupil_import_username(safe_first_name, safe_surname, safe_mis_id);
        created_pin := public.generate_pupil_import_pin();

        insert into public.pupils (
          id,
          mis_id,
          first_name,
          surname,
          username,
          pin,
          must_reset_pin,
          is_active,
          import_metadata,
          last_import_batch_id,
          last_imported_at,
          last_imported_by,
          school_id
        )
        values (
          gen_random_uuid(),
          safe_mis_id,
          safe_first_name,
          safe_surname,
          created_username,
          created_pin,
          false,
          true,
          safe_import_metadata,
          batch_id,
          row_now,
          actor_user_id,
          active_school_id
        )
        returning *
        into working_pupil;

        v_created_count := v_created_count + 1;
        v_created_credentials := v_created_credentials || jsonb_build_array(
          jsonb_build_object(
            'pupil_id', working_pupil.id,
            'mis_id', safe_mis_id,
            'first_name', safe_first_name,
            'surname', safe_surname,
            'username', created_username,
            'pin', created_pin,
            'form_class_label', safe_target_class_label
          )
        );
      else
        update public.pupils
        set mis_id = safe_mis_id,
            first_name = safe_first_name,
            surname = safe_surname,
            is_active = true,
            import_metadata = safe_import_metadata,
            last_import_batch_id = batch_id,
            last_imported_at = row_now,
            last_imported_by = actor_user_id
        where id = matched_pupil.id
          and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
        returning *
        into working_pupil;
      end if;

      select count(*)
      into other_active_form_count
      from public.pupil_classes as pc
      inner join public.classes as c
        on c.id = pc.class_id
      where pc.pupil_id = working_pupil.id
        and pc.active = true
        and pc.class_id <> target_class.id
        and coalesce(nullif(lower(btrim(c.class_type)), ''), 'form') = 'form'
        and coalesce(c.school_id, public.default_legacy_school_id()) = active_school_id
        and coalesce(pc.school_id, public.default_legacy_school_id()) = active_school_id;

      if other_active_form_count > 0 then
        update public.pupil_classes as pc
        set active = false,
            import_metadata = safe_membership_metadata || jsonb_build_object('action', 'replace_form'),
            last_import_batch_id = batch_id,
            last_imported_at = row_now,
            last_imported_by = actor_user_id
        from public.classes as c
        where pc.class_id = c.id
          and pc.pupil_id = working_pupil.id
          and pc.active = true
          and pc.class_id <> target_class.id
          and coalesce(nullif(lower(btrim(c.class_type)), ''), 'form') = 'form'
          and coalesce(c.school_id, public.default_legacy_school_id()) = active_school_id
          and coalesce(pc.school_id, public.default_legacy_school_id()) = active_school_id;
      end if;

      select *
      into target_membership
      from public.pupil_classes
      where pupil_id = working_pupil.id
        and class_id = target_class.id
        and coalesce(school_id, public.default_legacy_school_id()) = active_school_id
      order by active desc, id
      limit 1;

      if target_membership.id is null then
        insert into public.pupil_classes (
          pupil_id,
          class_id,
          active,
          import_metadata,
          last_import_batch_id,
          last_imported_at,
          last_imported_by,
          school_id
        )
        values (
          working_pupil.id,
          target_class.id,
          true,
          safe_membership_metadata || jsonb_build_object('action', case when other_active_form_count > 0 then 'replace_form' else 'upsert_form_membership' end),
          batch_id,
          row_now,
          actor_user_id,
          active_school_id
        );
      else
        update public.pupil_classes
        set active = true,
            import_metadata = safe_membership_metadata || jsonb_build_object('action', case when other_active_form_count > 0 then 'replace_form' else 'upsert_form_membership' end),
            last_import_batch_id = batch_id,
            last_imported_at = row_now,
            last_imported_by = actor_user_id
        where id = target_membership.id;
      end if;

      if normalized_pp_value is not null then
        insert into public.teacher_pupil_group_values (
          teacher_id,
          pupil_id,
          group_type,
          group_value,
          source,
          updated_at
        )
        values (
          actor_user_id,
          working_pupil.id,
          'pp',
          normalized_pp_value,
          'csv_import',
          row_now
        )
        on conflict (teacher_id, pupil_id, group_type)
        do update
        set group_value = excluded.group_value,
            source = excluded.source,
            updated_at = excluded.updated_at;
      end if;

      if normalized_sen_value is not null then
        insert into public.teacher_pupil_group_values (
          teacher_id,
          pupil_id,
          group_type,
          group_value,
          source,
          updated_at
        )
        values (
          actor_user_id,
          working_pupil.id,
          'sen',
          normalized_sen_value,
          'csv_import',
          row_now
        )
        on conflict (teacher_id, pupil_id, group_type)
        do update
        set group_value = excluded.group_value,
            source = excluded.source,
            updated_at = excluded.updated_at;
      end if;

      if normalized_gender_value is not null then
        insert into public.teacher_pupil_group_values (
          teacher_id,
          pupil_id,
          group_type,
          group_value,
          source,
          updated_at
        )
        values (
          actor_user_id,
          working_pupil.id,
          'gender',
          normalized_gender_value,
          'csv_import',
          row_now
        )
        on conflict (teacher_id, pupil_id, group_type)
        do update
        set group_value = excluded.group_value,
            source = excluded.source,
            updated_at = excluded.updated_at;
      end if;

      if matched_pupil.id is null then
        null;
      elsif other_active_form_count > 0 then
        v_replaced_count := v_replaced_count + 1;
      else
        v_updated_count := v_updated_count + 1;
      end if;
    exception
      when others then
        v_row_error_message := coalesce(
          v_row_error_message,
          public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, 'Could not import this row. Review the pupil record and try again.')
        );
        v_error_count := v_error_count + 1;
        v_skipped_count := v_skipped_count + 1;
        v_late_errors := v_late_errors || jsonb_build_array(v_row_error_message);
    end;
  end loop;

  update public.pupil_import_batches as pib
  set rows_processed = greatest(v_rows_processed, coalesce((safe_preview_summary ->> 'total_rows')::integer, v_rows_processed)),
      created_count = v_created_count,
      updated_count = v_updated_count,
      replaced_count = v_replaced_count,
      skipped_count = v_skipped_count,
      warning_count = v_warning_count,
      error_count = v_error_count,
      metadata = coalesce(pib.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'source', 'csv_import',
          'preview_summary', safe_preview_summary,
          'late_error_count', jsonb_array_length(v_late_errors),
          'committed_row_count', v_created_count + v_updated_count + v_replaced_count,
          'created_credentials_count', jsonb_array_length(v_created_credentials),
          'form_class_create_count', v_form_classes_created_count,
          'created_form_classes_count', jsonb_array_length(v_form_classes_created)
        )
  where id = batch_id;

  return jsonb_build_object(
    'batch_id', batch_id,
    'rows_processed', greatest(v_rows_processed, coalesce((safe_preview_summary ->> 'total_rows')::integer, v_rows_processed)),
    'created_count', v_created_count,
    'updated_count', v_updated_count,
    'replaced_count', v_replaced_count,
    'skipped_count', v_skipped_count,
    'warning_count', v_warning_count,
    'error_count', v_error_count,
    'form_class_create_count', v_form_classes_created_count,
    'form_classes_created', v_form_classes_created,
    'late_errors', v_late_errors,
    'created_credentials', v_created_credentials
  );
end;
$$;

alter function public.import_pupil_roster_csv(jsonb, text, jsonb, uuid) owner to postgres;

create or replace function public.import_pupil_roster_csv(
  import_rows jsonb default '[]'::jsonb,
  import_file_name text default null,
  preview_summary jsonb default '{}'::jsonb
) returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.import_pupil_roster_csv(
    import_rows,
    import_file_name,
    preview_summary,
    null
  );
$$;

alter function public.import_pupil_roster_csv(jsonb, text, jsonb) owner to postgres;

commit;
