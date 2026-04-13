create table if not exists public.staff_pending_access_approvals (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  status text not null check (status in ('approved', 'activated', 'cancelled', 'superseded', 'invalidated')),
  approved_email text not null,
  approved_external_staff_id text,
  approved_by uuid not null,
  approved_at timestamptz not null default timezone('utc', now()),
  stale_after_at timestamptz,
  activated_user_id uuid,
  activated_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  invalidated_reason text,
  last_failure_reason text,
  last_failure_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_staff_pending_access_one_approved_per_profile
  on public.staff_pending_access_approvals (staff_profile_id)
  where status = 'approved';

create index if not exists idx_staff_pending_access_profile_lookup
  on public.staff_pending_access_approvals (staff_profile_id, updated_at desc);

create table if not exists public.staff_pending_role_assignments (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.staff_pending_access_approvals(id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_staff_pending_role_assignments_unique
  on public.staff_pending_role_assignments (approval_id, role);

create table if not exists public.staff_pending_scope_assignments (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.staff_pending_access_approvals(id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead')),
  scope_type text not null check (scope_type in ('school', 'year_group', 'department', 'class')),
  scope_value text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_staff_pending_scope_assignments_unique
  on public.staff_pending_scope_assignments (approval_id, role, scope_type, scope_value);

create table if not exists public.staff_pending_access_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  approval_id uuid references public.staff_pending_access_approvals(id) on delete set null,
  action text not null check (action in ('approve', 'cancel', 'invalidate', 'activate', 'activate_blocked', 'supersede')),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_staff_pending_access_audit_profile_created
  on public.staff_pending_access_audit_log (staff_profile_id, created_at desc);

create index if not exists idx_staff_pending_access_audit_approval_created
  on public.staff_pending_access_audit_log (approval_id, created_at desc);

revoke all on table public.staff_pending_access_approvals from public;
revoke all on table public.staff_pending_role_assignments from public;
revoke all on table public.staff_pending_scope_assignments from public;
revoke all on table public.staff_pending_access_audit_log from public;
revoke insert, update, delete on table public.staff_pending_access_approvals from authenticated, anon;
revoke insert, update, delete on table public.staff_pending_role_assignments from authenticated, anon;
revoke insert, update, delete on table public.staff_pending_scope_assignments from authenticated, anon;
revoke insert, update, delete on table public.staff_pending_access_audit_log from authenticated, anon;
grant select on table public.staff_pending_access_approvals to authenticated;
grant select on table public.staff_pending_role_assignments to authenticated;
grant select on table public.staff_pending_scope_assignments to authenticated;
grant select on table public.staff_pending_access_audit_log to authenticated;

alter table if exists public.staff_pending_access_approvals
  enable row level security;

alter table if exists public.staff_pending_role_assignments
  enable row level security;

alter table if exists public.staff_pending_scope_assignments
  enable row level security;

alter table if exists public.staff_pending_access_audit_log
  enable row level security;

create or replace function public.log_staff_pending_access_event(
  actor_user_id uuid,
  target_profile_id uuid,
  target_approval_id uuid,
  event_action text,
  event_message text default null,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_pending_access_audit_log (
    actor_user_id,
    staff_profile_id,
    approval_id,
    action,
    message,
    metadata
  )
  values (
    actor_user_id,
    target_profile_id,
    target_approval_id,
    lower(btrim(coalesce(event_action, ''))),
    nullif(btrim(coalesce(event_message, '')), ''),
    coalesce(event_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.staff_role_uses_automatic_school_scope(requested_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(btrim(coalesce(requested_role, ''))) in ('admin', 'senco', 'literacy_lead');
$$;

create or replace function public.normalize_staff_scope_input(
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
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  safe_scope_type text := lower(btrim(coalesce(requested_scope_type, '')));
  safe_scope_value text := btrim(coalesce(requested_scope_value, ''));
begin
  if safe_role not in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead') then
    raise exception 'Invalid role.';
  end if;

  if safe_role = 'teacher' then
    raise exception 'Teacher uses owned-content access in this phase and does not take explicit scopes.';
  end if;

  if public.staff_role_uses_automatic_school_scope(safe_role) then
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

  return jsonb_build_object(
    'role', safe_role,
    'scope_type', safe_scope_type,
    'scope_value', safe_scope_value
  );
end;
$$;

create or replace function public.apply_staff_role_assignment_internal(
  target_user_id uuid,
  requested_role text,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_role text := lower(btrim(coalesce(requested_role, '')));
begin
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
  set active = true,
      granted_by = actor_user_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role;

  if public.staff_role_uses_automatic_school_scope(safe_role) then
    insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by)
    values (target_user_id, safe_role, 'school', 'default', true, actor_user_id)
    on conflict do nothing;

    update public.staff_scope_assignments
    set active = true,
        granted_by = actor_user_id,
        updated_at = timezone('utc', now())
    where user_id = target_user_id
      and role = safe_role
      and scope_type = 'school'
      and scope_value = 'default';
  end if;

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'active', true
  );
end;
$$;

create or replace function public.apply_staff_scope_assignment_internal(
  target_user_id uuid,
  requested_role text,
  requested_scope_type text,
  requested_scope_value text,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_scope jsonb := public.normalize_staff_scope_input(
    requested_role,
    requested_scope_type,
    requested_scope_value
  );
  safe_role text := normalized_scope ->> 'role';
  safe_scope_type text := normalized_scope ->> 'scope_type';
  safe_scope_value text := normalized_scope ->> 'scope_value';
begin
  if target_user_id is null then
    raise exception 'Choose a staff account before granting a scope.';
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

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'scope_type', safe_scope_type,
    'scope_value', safe_scope_value,
    'active', true
  );
end;
$$;

create or replace function public.get_staff_profile_duplicate_conflicts(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.staff_profiles%rowtype;
  safe_email text := '';
  safe_external_staff_id text := '';
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
              'Pending approval and activation are blocked because %s staff records now share this email.',
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
              'Pending approval and activation are blocked because %s staff records now share this external staff ID.',
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

create or replace function public.invalidate_staff_pending_approvals_for_profile(
  target_profile_id uuid,
  failure_reason text,
  actor_user_id uuid default null,
  event_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_reason text := nullif(btrim(coalesce(failure_reason, '')), '');
  approval_row record;
  invalidated_count integer := 0;
begin
  if target_profile_id is null or safe_reason is null then
    return 0;
  end if;

  for approval_row in
    update public.staff_pending_access_approvals
    set status = 'invalidated',
        invalidated_reason = safe_reason,
        last_failure_reason = safe_reason,
        last_failure_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where staff_profile_id = target_profile_id
      and status = 'approved'
    returning id
  loop
    invalidated_count := invalidated_count + 1;
    perform public.log_staff_pending_access_event(
      actor_user_id,
      target_profile_id,
      approval_row.id,
      'invalidate',
      safe_reason,
      coalesce(event_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'reason', safe_reason,
          'source', coalesce(event_metadata ->> 'source', 'system')
        )
    );
  end loop;

  return invalidated_count;
end;
$$;

create or replace function public.staff_pending_access_duplicate_preflight()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  email_conflicts jsonb := '[]'::jsonb;
  external_conflicts jsonb := '[]'::jsonb;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before reviewing duplicate staff records.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
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
    group by lower(btrim(coalesce(sp.email, '')))
    having count(*) > 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', 'email',
        'value', conflict_value,
        'conflict_count', conflict_count,
        'message', format('%s staff records share this email.', conflict_count),
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
    group by lower(btrim(coalesce(sp.external_staff_id, '')))
    having count(*) > 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', 'external_staff_id',
        'value', conflict_value,
        'conflict_count', conflict_count,
        'message', format('%s staff records share this external staff ID.', conflict_count),
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

create or replace function public.list_staff_pending_access_summaries()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  result jsonb := '[]'::jsonb;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before reviewing pending staff approvals.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
    raise exception 'Admin access is required before reviewing pending staff approvals.';
  end if;

  with latest_approvals as (
    select distinct on (spa.staff_profile_id)
      spa.*
    from public.staff_pending_access_approvals as spa
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
  ) as role_rows on true
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
  ) as scope_rows on true
  left join lateral (
    select public.get_staff_profile_duplicate_conflicts(sp.id) as duplicate_conflicts
  ) as duplicate_rows on true;

  return result;
end;
$$;

create or replace function public.read_staff_pending_access_detail(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  profile_row public.staff_profiles%rowtype;
  approval_row public.staff_pending_access_approvals%rowtype;
  pending_roles jsonb := '[]'::jsonb;
  pending_scopes jsonb := '[]'::jsonb;
  duplicate_conflicts jsonb := '[]'::jsonb;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before reviewing pending staff approvals.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
    raise exception 'Admin access is required before reviewing pending staff approvals.';
  end if;

  if target_profile_id is null then
    raise exception 'Choose a staff directory record first.';
  end if;

  select *
  into profile_row
  from public.staff_profiles
  where id = target_profile_id
  limit 1;

  if profile_row.id is null then
    raise exception 'Choose a staff directory record first.';
  end if;

  select *
  into approval_row
  from public.staff_pending_access_approvals
  where staff_profile_id = target_profile_id
  order by created_at desc, updated_at desc, id desc
  limit 1;

  if approval_row.id is not null then
    select coalesce(
      jsonb_agg(role order by role),
      '[]'::jsonb
    )
    into pending_roles
    from public.staff_pending_role_assignments
    where approval_id = approval_row.id;

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
    where approval_id = approval_row.id;
  end if;

  duplicate_conflicts := public.get_staff_profile_duplicate_conflicts(target_profile_id);

  return jsonb_build_object(
    'staff_profile_id', target_profile_id,
    'profile_linked', profile_row.user_id is not null,
    'duplicate_conflicts', duplicate_conflicts,
    'can_approve', profile_row.user_id is null and jsonb_array_length(duplicate_conflicts) = 0,
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

create or replace function public.save_staff_pending_access_approval(
  target_profile_id uuid,
  requested_roles jsonb default '[]'::jsonb,
  requested_scopes jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
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

  if not public.can_manage_roles(actor_user_id) then
    raise exception 'Admin access is required before approving pending access.';
  end if;

  if target_profile_id is null then
    raise exception 'Choose a pending staff record first.';
  end if;

  select *
  into profile_row
  from public.staff_profiles
  where id = target_profile_id
  limit 1;

  if profile_row.id is null then
    raise exception 'Choose a pending staff record first.';
  end if;

  if profile_row.user_id is not null then
    raise exception 'This staff member is already linked. Use the live access workflow instead.';
  end if;

  duplicate_conflicts := public.get_staff_profile_duplicate_conflicts(target_profile_id);
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
    returning id
  loop
    perform public.log_staff_pending_access_event(
      actor_user_id,
      target_profile_id,
      superseded_row.id,
      'supersede',
      'Previous pending approval superseded by a newer approval.',
      jsonb_build_object('source', 'save_staff_pending_access_approval')
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
    updated_at
  )
  values (
    new_approval_id,
    target_profile_id,
    'approved',
    lower(btrim(coalesce(profile_row.email, ''))),
    nullif(btrim(coalesce(profile_row.external_staff_id, '')), ''),
    actor_user_id,
    timezone('utc', now()),
    timezone('utc', now()) + interval '90 days',
    jsonb_build_object('source', 'save_staff_pending_access_approval'),
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.staff_pending_role_assignments (approval_id, role)
  select new_approval_id, role_value
  from unnest(normalized_roles) as role_value;

  insert into public.staff_pending_scope_assignments (approval_id, role, scope_type, scope_value)
  select new_approval_id, role_value, 'school', 'default'
  from unnest(normalized_roles) as role_value
  where public.staff_role_uses_automatic_school_scope(role_value)
  on conflict do nothing;

  if jsonb_typeof(requested_scopes) = 'array' then
    for scope_item in
      select value
      from jsonb_array_elements(requested_scopes)
    loop
      safe_role := lower(btrim(coalesce(scope_item ->> 'role', '')));
      safe_scope_type := lower(btrim(coalesce(scope_item ->> 'scope_type', '')));
      safe_scope_value := btrim(coalesce(scope_item ->> 'scope_value', ''));

      if safe_role = '' or safe_scope_type = '' or safe_scope_value = '' then
        continue;
      end if;

      if not (safe_role = any(normalized_roles)) then
        raise exception 'Add the role before choosing scopes for it.';
      end if;

      normalized_scope := public.normalize_staff_scope_input(
        safe_role,
        safe_scope_type,
        safe_scope_value
      );

      insert into public.staff_pending_scope_assignments (
        approval_id,
        role,
        scope_type,
        scope_value
      )
      values (
        new_approval_id,
        normalized_scope ->> 'role',
        normalized_scope ->> 'scope_type',
        normalized_scope ->> 'scope_value'
      )
      on conflict do nothing;
    end loop;
  end if;

  perform public.log_staff_pending_access_event(
    actor_user_id,
    target_profile_id,
    new_approval_id,
    'approve',
    'Approved pending sign-in access saved.',
    jsonb_build_object(
      'source', 'save_staff_pending_access_approval',
      'role_count', coalesce(array_length(normalized_roles, 1), 0)
    )
  );

  return public.read_staff_pending_access_detail(target_profile_id);
end;
$$;

create or replace function public.cancel_staff_pending_access_approval(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  cancelled_row record;
  cancelled_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before cancelling pending access.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
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
    returning id
  loop
    cancelled_count := cancelled_count + 1;
    perform public.log_staff_pending_access_event(
      actor_user_id,
      target_profile_id,
      cancelled_row.id,
      'cancel',
      'Pending approval cancelled.',
      jsonb_build_object('source', 'cancel_staff_pending_access_approval')
    );
  end loop;

  if cancelled_count = 0 then
    raise exception 'There is no active pending approval to cancel.';
  end if;

  return public.read_staff_pending_access_detail(target_profile_id);
end;
$$;

create or replace function public.activate_staff_pending_access_for_profile(
  target_profile_id uuid,
  target_user_id uuid,
  signed_in_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  duplicate_conflicts := public.get_staff_profile_duplicate_conflicts(target_profile_id);
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
        'duplicate_conflicts', duplicate_conflicts
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
        'approval_id', approval_row.id
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
        'approval_id', approval_row.id
      )
    );
    return jsonb_build_object(
      'status', 'invalidated',
      'message', failure_reason,
      'approval_id', approval_row.id
    );
  end if;

  audit_actor_user_id := coalesce(approval_row.approved_by, target_user_id);

  begin
    for role_row in
      select role
      from public.staff_pending_role_assignments
      where approval_id = approval_row.id
      order by role
    loop
      perform public.apply_staff_role_assignment_internal(
        target_user_id,
        role_row.role,
        audit_actor_user_id
      );
      activated_roles := array_append(activated_roles, role_row.role);

      perform public.log_staff_access_event(
        audit_actor_user_id,
        target_user_id,
        'grant_role',
        role_row.role,
        null,
        null,
        jsonb_build_object(
          'source', 'pending_activation',
          'approval_id', approval_row.id,
          'staff_profile_id', target_profile_id
        )
      );
    end loop;

    for scope_row in
      select role, scope_type, scope_value
      from public.staff_pending_scope_assignments
      where approval_id = approval_row.id
      order by role, scope_type, scope_value
    loop
      if public.staff_role_uses_automatic_school_scope(scope_row.role)
        and scope_row.scope_type = 'school'
        and scope_row.scope_value = 'default' then
        continue;
      end if;

      perform public.apply_staff_scope_assignment_internal(
        target_user_id,
        scope_row.role,
        scope_row.scope_type,
        scope_row.scope_value,
        audit_actor_user_id
      );
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
          'staff_profile_id', target_profile_id
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
      'Approved access activated automatically when the matching Google account signed in.',
      jsonb_build_object(
        'source', 'pending_activation',
        'activated_user_id', target_user_id
      )
    );
  exception
    when others then
      failure_reason := coalesce(nullif(SQLERRM, ''), 'Could not activate approved access.');
      update public.staff_pending_access_approvals
      set last_failure_reason = failure_reason,
          last_failure_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
      where id = approval_row.id
        and status = 'approved';

      perform public.log_staff_pending_access_event(
        target_user_id,
        target_profile_id,
        approval_row.id,
        'activate_blocked',
        failure_reason,
        jsonb_build_object(
          'source', 'pending_activation',
          'approval_id', approval_row.id
        )
      );

      return jsonb_build_object(
        'status', 'blocked',
        'message', failure_reason,
        'approval_id', approval_row.id
      );
  end;

  return jsonb_build_object(
    'status', 'activated',
    'message', 'Approved access is now live.',
    'approval_id', approval_row.id,
    'roles', to_jsonb(coalesce(activated_roles, array[]::text[])),
    'scope_count', activated_scope_count
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

  perform public.apply_staff_role_assignment_internal(
    target_user_id,
    safe_role,
    actor_user_id
  );

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
  normalized_scope jsonb;
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

  if not public.has_role(safe_role, target_user_id) then
    raise exception 'Grant the role before assigning scopes to it.';
  end if;

  normalized_scope := public.apply_staff_scope_assignment_internal(
    target_user_id,
    safe_role,
    requested_scope_type,
    requested_scope_value,
    actor_user_id
  );

  perform public.log_staff_access_event(
    actor_user_id,
    target_user_id,
    'grant_scope',
    normalized_scope ->> 'role',
    normalized_scope ->> 'scope_type',
    normalized_scope ->> 'scope_value',
    '{}'::jsonb
  );

  return normalized_scope;
end;
$$;

create or replace function public.upsert_my_staff_profile(
  requested_email text default null,
  requested_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  existing_profile public.staff_profiles%rowtype;
  email_match public.staff_profiles%rowtype;
  auth_email text := lower(btrim(coalesce(requested_email, '')));
  safe_email text := lower(btrim(coalesce(requested_email, '')));
  safe_display_name text := btrim(coalesce(requested_display_name, ''));
  exact_email_match_count integer := 0;
  conflicting_email_count integer := 0;
  final_email text := '';
  profile_sync_message text := null;
  activation_result jsonb := jsonb_build_object('status', 'none');
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before updating your staff profile.';
  end if;

  select *
  into existing_profile
  from public.staff_profiles
  where user_id = actor_user_id
  limit 1;

  if safe_email = '' then
    safe_email := lower(btrim(coalesce(existing_profile.email, '')));
  end if;

  if safe_email = '' then
    raise exception 'A staff email is required to create your staff profile.';
  end if;

  if safe_display_name = '' then
    safe_display_name := btrim(coalesce(existing_profile.display_name, ''));
  end if;

  if safe_display_name = '' then
    safe_display_name := split_part(safe_email, '@', 1);
  end if;

  if safe_display_name = '' then
    safe_display_name := 'Staff member';
  end if;

  if existing_profile.id is null then
    select count(*)
    into exact_email_match_count
    from public.staff_profiles
    where lower(btrim(coalesce(email, ''))) = safe_email;

    if exact_email_match_count = 1 then
      select *
      into email_match
      from public.staff_profiles
      where lower(btrim(coalesce(email, ''))) = safe_email
      limit 1;

      if email_match.user_id is not null
        and email_match.user_id <> actor_user_id then
        profile_sync_message := 'Could not link this staff account automatically because the exact email is already linked to another staff record.';
      else
        existing_profile := email_match;
      end if;
    elsif exact_email_match_count > 1 then
      profile_sync_message := 'Could not link this staff account automatically because multiple staff records share this email. An admin needs to review the staff directory.';
    end if;
  end if;

  if existing_profile.id is null then
    if exact_email_match_count > 0 and profile_sync_message is not null then
      return jsonb_build_object(
        'id', null,
        'user_id', actor_user_id,
        'email', safe_email,
        'display_name', safe_display_name,
        'profile_source', null,
        'profile_sync_message', profile_sync_message,
        'pending_access_result', activation_result
      );
    end if;

    insert into public.staff_profiles (
      id,
      user_id,
      email,
      display_name,
      profile_source,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      actor_user_id,
      safe_email,
      safe_display_name,
      'self_service',
      timezone('utc', now()),
      timezone('utc', now())
    )
    returning *
    into existing_profile;
  else
    final_email := lower(btrim(coalesce(existing_profile.email, '')));

    if final_email <> safe_email then
      select count(*)
      into conflicting_email_count
      from public.staff_profiles
      where lower(btrim(coalesce(email, ''))) = safe_email
        and id <> existing_profile.id;

      if conflicting_email_count > 0 then
        profile_sync_message := 'Could not update this linked staff profile because another staff record already uses this email.';
        safe_email := final_email;
      end if;
    end if;

    update public.staff_profiles
    set user_id = actor_user_id,
        email = safe_email,
        display_name = safe_display_name,
        updated_at = timezone('utc', now())
    where id = existing_profile.id
    returning *
    into existing_profile;
  end if;

  final_email := lower(btrim(coalesce(existing_profile.email, '')));
  if existing_profile.id is not null
    and final_email = coalesce(nullif(auth_email, ''), safe_email) then
    activation_result := public.activate_staff_pending_access_for_profile(
      existing_profile.id,
      actor_user_id,
      coalesce(nullif(auth_email, ''), safe_email)
    );
  end if;

  return jsonb_build_object(
    'id', existing_profile.id,
    'user_id', actor_user_id,
    'email', existing_profile.email,
    'display_name', existing_profile.display_name,
    'profile_source', existing_profile.profile_source,
    'profile_sync_message', profile_sync_message,
    'pending_access_result', activation_result
  );
end;
$$;

create or replace function public.import_staff_directory_csv(
  import_rows jsonb default '[]'::jsonb,
  import_file_name text default null,
  preview_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
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

  if not public.can_import_csv(actor_user_id) then
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
    created_at
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
    timezone('utc', now())
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
    where lower(email) = safe_email;

    if matched_by_email_count = 1 then
      select *
      into matched_email_profile
      from public.staff_profiles
      where lower(email) = safe_email
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
      where lower(coalesce(external_staff_id, '')) = lower(safe_external_staff_id);

      if matched_by_external_count = 1 then
        select *
        into matched_external_profile
        from public.staff_profiles
        where lower(coalesce(external_staff_id, '')) = lower(safe_external_staff_id)
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
        updated_at
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
        timezone('utc', now())
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
            'file_name', safe_file_name
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

revoke all on function public.log_staff_pending_access_event(uuid, uuid, uuid, text, text, jsonb) from public;
revoke all on function public.staff_role_uses_automatic_school_scope(text) from public;
revoke all on function public.normalize_staff_scope_input(text, text, text) from public;
revoke all on function public.apply_staff_role_assignment_internal(uuid, text, uuid) from public;
revoke all on function public.apply_staff_scope_assignment_internal(uuid, text, text, text, uuid) from public;
revoke all on function public.get_staff_profile_duplicate_conflicts(uuid) from public;
revoke all on function public.invalidate_staff_pending_approvals_for_profile(uuid, text, uuid, jsonb) from public;
revoke all on function public.staff_pending_access_duplicate_preflight() from public;
revoke all on function public.list_staff_pending_access_summaries() from public;
revoke all on function public.read_staff_pending_access_detail(uuid) from public;
revoke all on function public.save_staff_pending_access_approval(uuid, jsonb, jsonb) from public;
revoke all on function public.cancel_staff_pending_access_approval(uuid) from public;
revoke all on function public.activate_staff_pending_access_for_profile(uuid, uuid, text) from public;
revoke all on function public.grant_staff_role(uuid, text) from public;
revoke all on function public.grant_staff_scope(uuid, text, text, text) from public;
revoke all on function public.upsert_my_staff_profile(text, text) from public;
revoke all on function public.import_staff_directory_csv(jsonb, text, jsonb) from public;

grant execute on function public.staff_pending_access_duplicate_preflight() to authenticated, service_role;
grant execute on function public.list_staff_pending_access_summaries() to authenticated, service_role;
grant execute on function public.read_staff_pending_access_detail(uuid) to authenticated, service_role;
grant execute on function public.save_staff_pending_access_approval(uuid, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.cancel_staff_pending_access_approval(uuid) to authenticated, service_role;
grant execute on function public.grant_staff_role(uuid, text) to authenticated, service_role;
grant execute on function public.grant_staff_scope(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.upsert_my_staff_profile(text, text) to authenticated, service_role;
grant execute on function public.import_staff_directory_csv(jsonb, text, jsonb) to authenticated, service_role;

drop policy if exists "Admins can view pending staff approvals" on public.staff_pending_access_approvals;
create policy "Admins can view pending staff approvals"
  on public.staff_pending_access_approvals
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid()));

drop policy if exists "Admins can view pending staff approval roles" on public.staff_pending_role_assignments;
create policy "Admins can view pending staff approval roles"
  on public.staff_pending_role_assignments
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid()));

drop policy if exists "Admins can view pending staff approval scopes" on public.staff_pending_scope_assignments;
create policy "Admins can view pending staff approval scopes"
  on public.staff_pending_scope_assignments
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid()));

drop policy if exists "Admins can view pending staff approval audit" on public.staff_pending_access_audit_log;
create policy "Admins can view pending staff approval audit"
  on public.staff_pending_access_audit_log
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid()));
