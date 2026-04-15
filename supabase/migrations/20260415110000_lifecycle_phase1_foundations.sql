alter table if exists public.staff_profiles
  add column if not exists archived_at timestamptz;

alter table if exists public.staff_profiles
  add column if not exists archived_by uuid;

alter table if exists public.staff_profiles
  add column if not exists archive_reason text;

alter table if exists public.pupils
  add column if not exists archived_at timestamptz;

alter table if exists public.pupils
  add column if not exists archived_by uuid;

alter table if exists public.pupils
  add column if not exists archive_reason text;

alter table if exists public.pupil_classes
  add column if not exists ended_at timestamptz;

alter table if exists public.pupil_classes
  add column if not exists ended_by uuid;

alter table if exists public.pupil_classes
  add column if not exists ended_reason text;

create index if not exists idx_staff_profiles_archived_lookup
  on public.staff_profiles (archived_at)
  where archived_at is not null;

create index if not exists idx_pupils_archived_lookup
  on public.pupils (archived_at)
  where archived_at is not null;

create index if not exists idx_pupils_runtime_auth_lookup
  on public.pupils (public.normalize_pupil_import_lookup_text(username), pin)
  where username is not null
    and btrim(username) <> ''
    and archived_at is null
    and is_active is true;

create table if not exists public.staff_directory_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  target_profile_id uuid references public.staff_profiles(id) on delete set null,
  target_user_id uuid,
  action text not null check (action in ('archive', 'restore', 'revoke_all_live_access')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_staff_directory_audit_profile_created
  on public.staff_directory_audit_log (target_profile_id, created_at desc);

create index if not exists idx_staff_directory_audit_user_created
  on public.staff_directory_audit_log (target_user_id, created_at desc);

create table if not exists public.pupil_directory_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  target_pupil_id uuid not null references public.pupils(id) on delete cascade,
  action text not null check (action in ('archive', 'restore', 'move_form')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_pupil_directory_audit_pupil_created
  on public.pupil_directory_audit_log (target_pupil_id, created_at desc);

revoke all on table public.staff_directory_audit_log from public;
revoke all on table public.pupil_directory_audit_log from public;
revoke insert, update, delete on table public.staff_directory_audit_log from authenticated, anon;
revoke insert, update, delete on table public.pupil_directory_audit_log from authenticated, anon;
grant select on table public.staff_directory_audit_log to authenticated;
grant select on table public.pupil_directory_audit_log to authenticated;

alter table if exists public.staff_directory_audit_log
  enable row level security;

alter table if exists public.pupil_directory_audit_log
  enable row level security;

create or replace function public.log_staff_directory_event(
  actor_user_id uuid,
  target_profile_id uuid default null,
  target_user_id uuid default null,
  event_action text default null,
  event_reason text default null,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if actor_user_id is null or nullif(btrim(coalesce(event_action, '')), '') is null then
    return;
  end if;

  insert into public.staff_directory_audit_log (
    actor_user_id,
    target_profile_id,
    target_user_id,
    action,
    reason,
    metadata
  )
  values (
    actor_user_id,
    target_profile_id,
    target_user_id,
    event_action,
    nullif(btrim(coalesce(event_reason, '')), ''),
    coalesce(event_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.log_pupil_directory_event(
  actor_user_id uuid,
  target_pupil_id uuid,
  event_action text default null,
  event_reason text default null,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if actor_user_id is null
    or target_pupil_id is null
    or nullif(btrim(coalesce(event_action, '')), '') is null then
    return;
  end if;

  insert into public.pupil_directory_audit_log (
    actor_user_id,
    target_pupil_id,
    action,
    reason,
    metadata
  )
  values (
    actor_user_id,
    target_pupil_id,
    event_action,
    nullif(btrim(coalesce(event_reason, '')), ''),
    coalesce(event_metadata, '{}'::jsonb)
  );
end;
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
        or (
          c.teacher_id = requested_user_id
          and public.is_teacher_compat(requested_user_id)
        )
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
        (
          t.teacher_id = requested_user_id
          and public.is_teacher_compat(requested_user_id)
        )
        or exists (
          select 1
          from public.assignments_v2 as a
          where a.test_id = t.id
            and public.can_view_class(a.class_id, requested_user_id)
        )
      )
  );
$$;

create or replace function public.can_view_pupil_history(requested_pupil_id uuid, requested_user_id uuid default auth.uid())
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
      and public.can_view_class(pc.class_id, requested_user_id)
  );
$$;

create or replace function public.can_access_pupil_runtime(requested_pupil_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pupils as p
    where p.id = requested_pupil_id
      and p.is_active is true
      and p.archived_at is null
  );
$$;

create or replace function public.can_access_pupil_assignment_runtime(
  requested_pupil_id uuid,
  requested_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    requested_assignment_id is not null
    and public.can_access_pupil_runtime(requested_pupil_id)
    and exists (
      select 1
      from public.assignments_v2 as a
      join public.pupil_classes as pc
        on pc.class_id = a.class_id
      where a.id = requested_assignment_id
        and pc.pupil_id = requested_pupil_id
        and pc.active is true
    );
$$;

create or replace function public.sync_pupil_record_lifecycle_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.archived_at is not null then
    new.is_active := false;
  elsif tg_op = 'UPDATE'
    and old.archived_at is not null
    and new.is_active is true then
    new.archived_at := null;
    new.archived_by := null;
    new.archive_reason := null;
  end if;

  return new;
end;
$$;

create or replace function public.sync_pupil_class_lifecycle_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.active is true then
    new.ended_at := null;
    new.ended_by := null;
    new.ended_reason := null;
  elsif tg_op = 'UPDATE'
    and old.active is true
    and new.active is false then
    if new.ended_at is null then
      new.ended_at := timezone('utc', now());
    end if;
    if new.ended_by is null then
      new.ended_by := auth.uid();
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_staff_live_access_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  safe_user_id uuid := coalesce(new.user_id, old.user_id);
begin
  if safe_user_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if coalesce(new.active, false) is true
    and exists (
      select 1
      from public.staff_profiles as sp
      where sp.user_id = safe_user_id
        and sp.archived_at is not null
    ) then
    raise exception 'Restore the staff directory record before granting live access.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.enforce_legacy_teacher_app_role_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  safe_user_id uuid := coalesce(new.teacher_id, old.teacher_id);
begin
  if safe_user_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
    and exists (
      select 1
      from public.staff_profiles as sp
      where sp.user_id = safe_user_id
        and sp.archived_at is not null
    ) then
    raise exception 'Restore the staff directory record before granting live access.';
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
  import_mode_enabled boolean := current_setting('app.pupil_import_mode', true) = 'on';
  lifecycle_mode_enabled boolean := current_setting('app.pupil_lifecycle_mode', true) = 'on';
begin
  if actor_role in ('service_role', 'postgres') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if actor_user_id is null then
    raise exception 'Sign in is required before changing class memberships.';
  end if;

  if (import_mode_enabled or lifecycle_mode_enabled)
    and public.can_import_csv(actor_user_id) then
    return case when tg_op = 'DELETE' then old else new end;
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

create or replace function public.revoke_all_staff_live_access(
  target_user_id uuid,
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  target_profile_id uuid := null;
  active_admin_count integer := 0;
  revoked_scope_count integer := 0;
  revoked_role_count integer := 0;
  revoked_roles text[] := array[]::text[];
  revoked_role_row record;
  revoked_scope_row record;
  legacy_role_row record;
  removed_legacy_roles text[] := array[]::text[];
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before removing live staff access.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
    raise exception 'Admin access is required to remove live staff access.';
  end if;

  if target_user_id is null then
    raise exception 'Choose a linked staff account first.';
  end if;

  if exists (
    select 1
    from public.staff_role_assignments
    where user_id = target_user_id
      and role = 'admin'
      and active is true
  ) then
    select count(*)
    into active_admin_count
    from public.staff_role_assignments
    where role = 'admin'
      and active is true;

    if active_admin_count <= 1 then
      raise exception 'At least one active admin must remain.';
    end if;
  end if;

  select sp.id
  into target_profile_id
  from public.staff_profiles as sp
  where sp.user_id = target_user_id
  order by sp.archived_at asc nulls first, sp.updated_at desc nulls last, sp.created_at desc nulls last
  limit 1;

  for revoked_scope_row in
    update public.staff_scope_assignments
    set active = false,
        granted_by = actor_user_id,
        updated_at = timezone('utc', now())
    where user_id = target_user_id
      and active is true
    returning role, scope_type, scope_value
  loop
    revoked_scope_count := revoked_scope_count + 1;

    perform public.log_staff_access_event(
      actor_user_id,
      target_user_id,
      'revoke_scope',
      revoked_scope_row.role,
      revoked_scope_row.scope_type,
      revoked_scope_row.scope_value,
      jsonb_build_object(
        'source', 'revoke_all_staff_live_access',
        'reason', safe_reason,
        'target_profile_id', target_profile_id
      )
    );
  end loop;

  for revoked_role_row in
    update public.staff_role_assignments
    set active = false,
        granted_by = actor_user_id,
        updated_at = timezone('utc', now())
    where user_id = target_user_id
      and active is true
    returning role
  loop
    revoked_role_count := revoked_role_count + 1;
    revoked_roles := array_append(revoked_roles, revoked_role_row.role);

    perform public.log_staff_access_event(
      actor_user_id,
      target_user_id,
      'revoke_role',
      revoked_role_row.role,
      null,
      null,
      jsonb_build_object(
        'source', 'revoke_all_staff_live_access',
        'reason', safe_reason,
        'target_profile_id', target_profile_id
      )
    );
  end loop;

  for legacy_role_row in
    delete from public.teacher_app_roles
    where teacher_id = target_user_id
    returning app_role
  loop
    removed_legacy_roles := array_append(removed_legacy_roles, legacy_role_row.app_role);
  end loop;

  perform public.log_staff_directory_event(
    actor_user_id,
    target_profile_id,
    target_user_id,
    'revoke_all_live_access',
    safe_reason,
    jsonb_build_object(
      'revoked_roles', to_jsonb(coalesce(revoked_roles, array[]::text[])),
      'revoked_role_count', revoked_role_count,
      'revoked_scope_count', revoked_scope_count,
      'removed_legacy_roles', to_jsonb(coalesce(removed_legacy_roles, array[]::text[]))
    )
  );

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'target_profile_id', target_profile_id,
    'revoked_roles', to_jsonb(coalesce(revoked_roles, array[]::text[])),
    'revoked_role_count', revoked_role_count,
    'revoked_scope_count', revoked_scope_count,
    'removed_legacy_roles', to_jsonb(coalesce(removed_legacy_roles, array[]::text[]))
  );
end;
$$;

create or replace function public.archive_staff_directory_record(
  target_profile_id uuid,
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  profile_row public.staff_profiles%rowtype;
  safe_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  revoke_result jsonb := '{}'::jsonb;
  invalidated_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before archiving a staff directory record.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
    raise exception 'Admin access is required before archiving a staff directory record.';
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

  if profile_row.user_id is not null then
    revoke_result := public.revoke_all_staff_live_access(
      profile_row.user_id,
      coalesce(safe_reason, 'Staff directory record archived.')
    );
  end if;

  update public.staff_profiles
  set archived_at = coalesce(archived_at, timezone('utc', now())),
      archived_by = actor_user_id,
      archive_reason = coalesce(safe_reason, archive_reason),
      updated_at = timezone('utc', now())
  where id = target_profile_id
  returning *
  into profile_row;

  invalidated_count := public.invalidate_staff_pending_approvals_for_profile(
    target_profile_id,
    'Staff directory record archived.',
    actor_user_id,
    jsonb_build_object(
      'source', 'archive_staff_directory_record'
    )
  );

  perform public.log_staff_directory_event(
    actor_user_id,
    target_profile_id,
    profile_row.user_id,
    'archive',
    safe_reason,
    jsonb_build_object(
      'revoke_result', coalesce(revoke_result, '{}'::jsonb),
      'invalidated_pending_approval_count', invalidated_count
    )
  );

  return jsonb_build_object(
    'staff_profile_id', profile_row.id,
    'user_id', profile_row.user_id,
    'archived_at', profile_row.archived_at,
    'archived_by', profile_row.archived_by,
    'archive_reason', profile_row.archive_reason,
    'revoke_result', coalesce(revoke_result, '{}'::jsonb),
    'invalidated_pending_approval_count', invalidated_count
  );
end;
$$;

create or replace function public.restore_staff_directory_record(
  target_profile_id uuid,
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  profile_row public.staff_profiles%rowtype;
  safe_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before restoring a staff directory record.';
  end if;

  if not public.can_manage_roles(actor_user_id) then
    raise exception 'Admin access is required before restoring a staff directory record.';
  end if;

  if target_profile_id is null then
    raise exception 'Choose a staff directory record first.';
  end if;

  update public.staff_profiles
  set archived_at = null,
      archived_by = null,
      archive_reason = null,
      updated_at = timezone('utc', now())
  where id = target_profile_id
  returning *
  into profile_row;

  if profile_row.id is null then
    raise exception 'Choose a staff directory record first.';
  end if;

  perform public.log_staff_directory_event(
    actor_user_id,
    target_profile_id,
    profile_row.user_id,
    'restore',
    safe_reason,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'staff_profile_id', profile_row.id,
    'user_id', profile_row.user_id,
    'archived_at', profile_row.archived_at
  );
end;
$$;

create or replace function public.archive_pupil_directory_record(
  target_pupil_id uuid,
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  pupil_row public.pupils%rowtype;
  safe_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  ended_membership_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before archiving a pupil record.';
  end if;

  if not public.can_import_csv(actor_user_id) then
    raise exception 'Admin access is required before archiving a pupil record.';
  end if;

  if target_pupil_id is null then
    raise exception 'Choose a pupil record first.';
  end if;

  select *
  into pupil_row
  from public.pupils
  where id = target_pupil_id
  limit 1;

  if pupil_row.id is null then
    raise exception 'Choose a pupil record first.';
  end if;

  perform set_config('app.pupil_lifecycle_mode', 'on', true);

  update public.pupil_classes
  set active = false,
      ended_at = coalesce(ended_at, timezone('utc', now())),
      ended_by = coalesce(ended_by, actor_user_id),
      ended_reason = coalesce(safe_reason, ended_reason, 'archived')
  where pupil_id = target_pupil_id
    and active is true;

  get diagnostics ended_membership_count = row_count;

  update public.pupils
  set is_active = false,
      archived_at = coalesce(archived_at, timezone('utc', now())),
      archived_by = actor_user_id,
      archive_reason = coalesce(safe_reason, archive_reason)
  where id = target_pupil_id
  returning *
  into pupil_row;

  perform public.log_pupil_directory_event(
    actor_user_id,
    target_pupil_id,
    'archive',
    safe_reason,
    jsonb_build_object(
      'ended_membership_count', ended_membership_count
    )
  );

  return jsonb_build_object(
    'pupil_id', pupil_row.id,
    'is_active', pupil_row.is_active,
    'archived_at', pupil_row.archived_at,
    'ended_membership_count', ended_membership_count
  );
end;
$$;

create or replace function public.restore_pupil_directory_record(
  target_pupil_id uuid,
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  pupil_row public.pupils%rowtype;
  safe_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before restoring a pupil record.';
  end if;

  if not public.can_import_csv(actor_user_id) then
    raise exception 'Admin access is required before restoring a pupil record.';
  end if;

  if target_pupil_id is null then
    raise exception 'Choose a pupil record first.';
  end if;

  update public.pupils
  set is_active = true,
      archived_at = null,
      archived_by = null,
      archive_reason = null
  where id = target_pupil_id
  returning *
  into pupil_row;

  if pupil_row.id is null then
    raise exception 'Choose a pupil record first.';
  end if;

  perform public.log_pupil_directory_event(
    actor_user_id,
    target_pupil_id,
    'restore',
    safe_reason,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'pupil_id', pupil_row.id,
    'is_active', pupil_row.is_active,
    'archived_at', pupil_row.archived_at
  );
end;
$$;

create or replace function public.move_pupil_form_membership(
  target_pupil_id uuid,
  target_form_class_id uuid,
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  pupil_row public.pupils%rowtype;
  target_class public.classes%rowtype;
  target_membership public.pupil_classes%rowtype;
  reused_existing_membership boolean := false;
  closed_membership_ids uuid[] := array[]::uuid[];
  closed_row record;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before moving a pupil form membership.';
  end if;

  if not public.can_import_csv(actor_user_id) then
    raise exception 'Admin access is required before moving a pupil form membership.';
  end if;

  if target_pupil_id is null then
    raise exception 'Choose a pupil record first.';
  end if;

  if target_form_class_id is null then
    raise exception 'Choose a target form class first.';
  end if;

  select *
  into pupil_row
  from public.pupils
  where id = target_pupil_id
  limit 1;

  if pupil_row.id is null then
    raise exception 'Choose a pupil record first.';
  end if;

  select *
  into target_class
  from public.classes
  where id = target_form_class_id
  limit 1;

  if target_class.id is null then
    raise exception 'Choose a target form class first.';
  end if;

  if coalesce(nullif(lower(btrim(target_class.class_type)), ''), 'form') <> 'form' then
    raise exception 'Move form only supports form classes in this phase.';
  end if;

  perform set_config('app.pupil_lifecycle_mode', 'on', true);

  for closed_row in
    update public.pupil_classes as pc
    set active = false,
        ended_at = coalesce(pc.ended_at, timezone('utc', now())),
        ended_by = coalesce(pc.ended_by, actor_user_id),
        ended_reason = coalesce(safe_reason, pc.ended_reason, 'moved_form')
    from public.classes as c
    where pc.class_id = c.id
      and pc.pupil_id = target_pupil_id
      and pc.active is true
      and pc.class_id <> target_form_class_id
      and coalesce(nullif(lower(btrim(c.class_type)), ''), 'form') = 'form'
    returning pc.id
  loop
    closed_membership_ids := array_append(closed_membership_ids, closed_row.id);
  end loop;

  select *
  into target_membership
  from public.pupil_classes
  where pupil_id = target_pupil_id
    and class_id = target_form_class_id
  order by active desc, id
  limit 1;

  if target_membership.id is null then
    insert into public.pupil_classes (
      pupil_id,
      class_id,
      active,
      ended_at,
      ended_by,
      ended_reason
    )
    values (
      target_pupil_id,
      target_form_class_id,
      true,
      null,
      null,
      null
    )
    returning *
    into target_membership;
  else
    reused_existing_membership := true;

    update public.pupil_classes
    set active = true,
        ended_at = null,
        ended_by = null,
        ended_reason = null
    where id = target_membership.id
    returning *
    into target_membership;
  end if;

  update public.pupils
  set is_active = true,
      archived_at = null,
      archived_by = null,
      archive_reason = null
  where id = target_pupil_id
  returning *
  into pupil_row;

  perform public.log_pupil_directory_event(
    actor_user_id,
    target_pupil_id,
    'move_form',
    safe_reason,
    jsonb_build_object(
      'target_form_class_id', target_form_class_id,
      'target_membership_id', target_membership.id,
      'reused_existing_membership', reused_existing_membership,
      'closed_membership_ids', to_jsonb(coalesce(closed_membership_ids, array[]::uuid[]))
    )
  );

  return jsonb_build_object(
    'pupil_id', pupil_row.id,
    'target_form_class_id', target_form_class_id,
    'target_membership_id', target_membership.id,
    'reused_existing_membership', reused_existing_membership,
    'closed_membership_ids', to_jsonb(coalesce(closed_membership_ids, array[]::uuid[])),
    'is_active', pupil_row.is_active,
    'archived_at', pupil_row.archived_at
  );
end;
$$;

create or replace function public.authenticate_pupil(
  requested_username text,
  requested_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_username text := public.normalize_pupil_import_lookup_text(requested_username);
  safe_pin text := btrim(coalesce(requested_pin, ''));
  matched_count integer := 0;
  pupil_row public.pupils%rowtype;
begin
  if safe_username = '' or safe_pin = '' then
    return null;
  end if;

  select count(*)
  into matched_count
  from public.pupils as p
  where public.normalize_pupil_import_lookup_text(p.username) = safe_username
    and btrim(coalesce(p.pin, '')) = safe_pin
    and public.can_access_pupil_runtime(p.id);

  if matched_count <> 1 then
    return null;
  end if;

  select *
  into pupil_row
  from public.pupils as p
  where public.normalize_pupil_import_lookup_text(p.username) = safe_username
    and btrim(coalesce(p.pin, '')) = safe_pin
    and public.can_access_pupil_runtime(p.id)
  limit 1;

  return jsonb_build_object(
    'id', pupil_row.id,
    'username', lower(btrim(coalesce(pupil_row.username, ''))),
    'first_name', btrim(coalesce(pupil_row.first_name, '')),
    'surname', btrim(coalesce(pupil_row.surname, '')),
    'must_reset_pin', coalesce(pupil_row.must_reset_pin, false)
  );
end;
$$;

create or replace function public.validate_pupil_runtime_session(requested_pupil_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pupil_row public.pupils%rowtype;
begin
  if requested_pupil_id is null or not public.can_access_pupil_runtime(requested_pupil_id) then
    return null;
  end if;

  select *
  into pupil_row
  from public.pupils
  where id = requested_pupil_id
  limit 1;

  if pupil_row.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', pupil_row.id,
    'username', lower(btrim(coalesce(pupil_row.username, ''))),
    'first_name', btrim(coalesce(pupil_row.first_name, '')),
    'surname', btrim(coalesce(pupil_row.surname, '')),
    'must_reset_pin', coalesce(pupil_row.must_reset_pin, false)
  );
end;
$$;

create or replace function public.read_pupil_baseline_gate_state(
  requested_pupil_id uuid,
  requested_standard_key text default 'core_v1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_required_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
  active_class_ids uuid[] := array[]::uuid[];
  selected_assignment_id uuid := null;
  selected_assignment_payload jsonb := null;
begin
  if safe_required_key = '' then
    safe_required_key := 'core_v1';
  end if;

  if requested_pupil_id is null or not public.can_access_pupil_runtime(requested_pupil_id) then
    return jsonb_build_object(
      'status', 'waiting',
      'assignment_id', null,
      'required_standard_key', safe_required_key,
      'class_ids', '[]'::jsonb,
      'assignment', null
    );
  end if;

  select coalesce(array_agg(distinct pc.class_id), array[]::uuid[])
  into active_class_ids
  from public.pupil_classes as pc
  where pc.pupil_id = requested_pupil_id
    and pc.active is true;

  if coalesce(array_length(active_class_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'status', 'waiting',
      'assignment_id', null,
      'required_standard_key', safe_required_key,
      'class_ids', to_jsonb(active_class_ids),
      'assignment', null
    );
  end if;

  with required_baseline_assignments as (
    select
      a.id,
      a.teacher_id,
      a.test_id,
      a.class_id,
      a.mode,
      a.max_attempts,
      a.audio_enabled,
      a.hints_enabled,
      a.end_at,
      a.created_at,
      t.title,
      t.question_type,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', tw.id,
            'position', tw.position,
            'word', tw.word,
            'sentence', tw.sentence,
            'segments', to_jsonb(tw.segments),
            'choice', to_jsonb(tw.choice)
          )
          order by tw.position
        ),
        '[]'::jsonb
      ) as words,
      aps.status as assignment_status,
      aps.started_at,
      aps.completed_at,
      aps.total_words,
      aps.correct_words,
      aps.average_attempts,
      aps.score_rate,
      coalesce(to_jsonb(aps.result_json), '[]'::jsonb) as result_json
    from public.assignments_v2 as a
    inner join public.tests as t
      on t.id = a.test_id
    inner join public.test_words as tw
      on tw.test_id = t.id
    left join public.assignment_pupil_statuses as aps
      on aps.assignment_id = a.id
     and aps.pupil_id = requested_pupil_id
    where a.class_id = any(active_class_ids)
    group by
      a.id,
      a.teacher_id,
      a.test_id,
      a.class_id,
      a.mode,
      a.max_attempts,
      a.audio_enabled,
      a.hints_enabled,
      a.end_at,
      a.created_at,
      t.title,
      t.question_type,
      aps.status,
      aps.started_at,
      aps.completed_at,
      aps.total_words,
      aps.correct_words,
      aps.average_attempts,
      aps.score_rate,
      aps.result_json
    having count(tw.id) > 0
      and bool_and(
        lower(btrim(coalesce(tw.choice ->> 'source', ''))) = 'baseline_v1'
        or lower(btrim(coalesce(tw.choice ->> 'baseline_v1', ''))) in ('true', '1', 'yes')
      )
      and bool_or(
        lower(regexp_replace(coalesce(tw.choice ->> 'baseline_standard_key', ''), '[^a-z0-9_-]+', '', 'g')) = safe_required_key
      )
  )
  select
    candidate.id,
    jsonb_build_object(
      'id', candidate.id,
      'teacher_id', candidate.teacher_id,
      'test_id', candidate.test_id,
      'class_id', candidate.class_id,
      'mode', coalesce(candidate.mode, 'test'),
      'max_attempts', candidate.max_attempts,
      'audio_enabled', coalesce(candidate.audio_enabled, true),
      'hints_enabled', coalesce(candidate.hints_enabled, true),
      'end_at', candidate.end_at,
      'created_at', candidate.created_at,
      'title', coalesce(nullif(btrim(coalesce(candidate.title, '')), ''), 'Baseline Test'),
      'question_type', coalesce(nullif(btrim(coalesce(candidate.question_type, '')), ''), 'segmented_spelling'),
      'assignment_status', coalesce(nullif(btrim(coalesce(candidate.assignment_status, '')), ''), case when candidate.completed_at is not null then 'completed' else 'assigned' end),
      'started_at', candidate.started_at,
      'completed_at', candidate.completed_at,
      'total_words', coalesce(candidate.total_words, jsonb_array_length(candidate.words)),
      'correct_words', coalesce(candidate.correct_words, 0),
      'average_attempts', coalesce(candidate.average_attempts, 0),
      'score_rate', coalesce(candidate.score_rate, 0),
      'result_json', candidate.result_json,
      'completed', candidate.completed_at is not null,
      'is_locked', candidate.completed_at is not null,
      'attempt_source', 'baseline',
      'assignment_origin', 'baseline',
      'is_generated', false,
      'is_baseline', true,
      'pupil_title', 'Baseline Test',
      'pupil_reason', 'A short baseline test to help choose the right practice.',
      'words', candidate.words
    )
  into selected_assignment_id, selected_assignment_payload
  from required_baseline_assignments as candidate
  where candidate.completed_at is not null
  order by candidate.end_at asc nulls last, candidate.created_at desc, candidate.id desc
  limit 1;

  if selected_assignment_id is not null then
    return jsonb_build_object(
      'status', 'ready',
      'assignment_id', null,
      'completed_assignment_id', selected_assignment_id,
      'required_standard_key', safe_required_key,
      'class_ids', to_jsonb(active_class_ids),
      'assignment', null
    );
  end if;

  selected_assignment_id := null;
  selected_assignment_payload := null;

  with required_baseline_assignments as (
    select
      a.id,
      a.teacher_id,
      a.test_id,
      a.class_id,
      a.mode,
      a.max_attempts,
      a.audio_enabled,
      a.hints_enabled,
      a.end_at,
      a.created_at,
      t.title,
      t.question_type,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', tw.id,
            'position', tw.position,
            'word', tw.word,
            'sentence', tw.sentence,
            'segments', to_jsonb(tw.segments),
            'choice', to_jsonb(tw.choice)
          )
          order by tw.position
        ),
        '[]'::jsonb
      ) as words,
      aps.status as assignment_status,
      aps.started_at,
      aps.completed_at,
      aps.total_words,
      aps.correct_words,
      aps.average_attempts,
      aps.score_rate,
      coalesce(to_jsonb(aps.result_json), '[]'::jsonb) as result_json
    from public.assignments_v2 as a
    inner join public.tests as t
      on t.id = a.test_id
    inner join public.test_words as tw
      on tw.test_id = t.id
    left join public.assignment_pupil_statuses as aps
      on aps.assignment_id = a.id
     and aps.pupil_id = requested_pupil_id
    where a.class_id = any(active_class_ids)
    group by
      a.id,
      a.teacher_id,
      a.test_id,
      a.class_id,
      a.mode,
      a.max_attempts,
      a.audio_enabled,
      a.hints_enabled,
      a.end_at,
      a.created_at,
      t.title,
      t.question_type,
      aps.status,
      aps.started_at,
      aps.completed_at,
      aps.total_words,
      aps.correct_words,
      aps.average_attempts,
      aps.score_rate,
      aps.result_json
    having count(tw.id) > 0
      and bool_and(
        lower(btrim(coalesce(tw.choice ->> 'source', ''))) = 'baseline_v1'
        or lower(btrim(coalesce(tw.choice ->> 'baseline_v1', ''))) in ('true', '1', 'yes')
      )
      and bool_or(
        lower(regexp_replace(coalesce(tw.choice ->> 'baseline_standard_key', ''), '[^a-z0-9_-]+', '', 'g')) = safe_required_key
      )
  )
  select
    candidate.id,
    jsonb_build_object(
      'id', candidate.id,
      'teacher_id', candidate.teacher_id,
      'test_id', candidate.test_id,
      'class_id', candidate.class_id,
      'mode', coalesce(candidate.mode, 'test'),
      'max_attempts', candidate.max_attempts,
      'audio_enabled', coalesce(candidate.audio_enabled, true),
      'hints_enabled', coalesce(candidate.hints_enabled, true),
      'end_at', candidate.end_at,
      'created_at', candidate.created_at,
      'title', coalesce(nullif(btrim(coalesce(candidate.title, '')), ''), 'Baseline Test'),
      'question_type', coalesce(nullif(btrim(coalesce(candidate.question_type, '')), ''), 'segmented_spelling'),
      'assignment_status', coalesce(nullif(btrim(coalesce(candidate.assignment_status, '')), ''), 'started'),
      'started_at', candidate.started_at,
      'completed_at', candidate.completed_at,
      'total_words', coalesce(candidate.total_words, jsonb_array_length(candidate.words)),
      'correct_words', coalesce(candidate.correct_words, 0),
      'average_attempts', coalesce(candidate.average_attempts, 0),
      'score_rate', coalesce(candidate.score_rate, 0),
      'result_json', candidate.result_json,
      'completed', false,
      'is_locked', false,
      'attempt_source', 'baseline',
      'assignment_origin', 'baseline',
      'is_generated', false,
      'is_baseline', true,
      'pupil_title', 'Baseline Test',
      'pupil_reason', 'A short baseline test to help choose the right practice.',
      'words', candidate.words
    )
  into selected_assignment_id, selected_assignment_payload
  from required_baseline_assignments as candidate
  where candidate.completed_at is null
    and (
      candidate.started_at is not null
      or lower(btrim(coalesce(candidate.assignment_status, ''))) = 'started'
      or (
        jsonb_typeof(candidate.result_json) = 'array'
        and jsonb_array_length(candidate.result_json) > 0
      )
    )
  order by candidate.end_at asc nulls last, candidate.created_at desc, candidate.id desc
  limit 1;

  if selected_assignment_id is not null then
    return jsonb_build_object(
      'status', 'resume',
      'assignment_id', selected_assignment_id,
      'required_standard_key', safe_required_key,
      'class_ids', to_jsonb(active_class_ids),
      'assignment', selected_assignment_payload
    );
  end if;

  selected_assignment_id := null;
  selected_assignment_payload := null;

  with required_baseline_assignments as (
    select
      a.id,
      a.teacher_id,
      a.test_id,
      a.class_id,
      a.mode,
      a.max_attempts,
      a.audio_enabled,
      a.hints_enabled,
      a.end_at,
      a.created_at,
      t.title,
      t.question_type,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', tw.id,
            'position', tw.position,
            'word', tw.word,
            'sentence', tw.sentence,
            'segments', to_jsonb(tw.segments),
            'choice', to_jsonb(tw.choice)
          )
          order by tw.position
        ),
        '[]'::jsonb
      ) as words,
      aps.status as assignment_status,
      aps.started_at,
      aps.completed_at,
      aps.total_words,
      aps.correct_words,
      aps.average_attempts,
      aps.score_rate,
      coalesce(to_jsonb(aps.result_json), '[]'::jsonb) as result_json
    from public.assignments_v2 as a
    inner join public.tests as t
      on t.id = a.test_id
    inner join public.test_words as tw
      on tw.test_id = t.id
    left join public.assignment_pupil_statuses as aps
      on aps.assignment_id = a.id
     and aps.pupil_id = requested_pupil_id
    where a.class_id = any(active_class_ids)
    group by
      a.id,
      a.teacher_id,
      a.test_id,
      a.class_id,
      a.mode,
      a.max_attempts,
      a.audio_enabled,
      a.hints_enabled,
      a.end_at,
      a.created_at,
      t.title,
      t.question_type,
      aps.status,
      aps.started_at,
      aps.completed_at,
      aps.total_words,
      aps.correct_words,
      aps.average_attempts,
      aps.score_rate,
      aps.result_json
    having count(tw.id) > 0
      and bool_and(
        lower(btrim(coalesce(tw.choice ->> 'source', ''))) = 'baseline_v1'
        or lower(btrim(coalesce(tw.choice ->> 'baseline_v1', ''))) in ('true', '1', 'yes')
      )
      and bool_or(
        lower(regexp_replace(coalesce(tw.choice ->> 'baseline_standard_key', ''), '[^a-z0-9_-]+', '', 'g')) = safe_required_key
      )
  )
  select
    candidate.id,
    jsonb_build_object(
      'id', candidate.id,
      'teacher_id', candidate.teacher_id,
      'test_id', candidate.test_id,
      'class_id', candidate.class_id,
      'mode', coalesce(candidate.mode, 'test'),
      'max_attempts', candidate.max_attempts,
      'audio_enabled', coalesce(candidate.audio_enabled, true),
      'hints_enabled', coalesce(candidate.hints_enabled, true),
      'end_at', candidate.end_at,
      'created_at', candidate.created_at,
      'title', coalesce(nullif(btrim(coalesce(candidate.title, '')), ''), 'Baseline Test'),
      'question_type', coalesce(nullif(btrim(coalesce(candidate.question_type, '')), ''), 'segmented_spelling'),
      'assignment_status', coalesce(nullif(btrim(coalesce(candidate.assignment_status, '')), ''), 'assigned'),
      'started_at', candidate.started_at,
      'completed_at', candidate.completed_at,
      'total_words', coalesce(candidate.total_words, jsonb_array_length(candidate.words)),
      'correct_words', coalesce(candidate.correct_words, 0),
      'average_attempts', coalesce(candidate.average_attempts, 0),
      'score_rate', coalesce(candidate.score_rate, 0),
      'result_json', candidate.result_json,
      'completed', false,
      'is_locked', false,
      'attempt_source', 'baseline',
      'assignment_origin', 'baseline',
      'is_generated', false,
      'is_baseline', true,
      'pupil_title', 'Baseline Test',
      'pupil_reason', 'A short baseline test to help choose the right practice.',
      'words', candidate.words
    )
  into selected_assignment_id, selected_assignment_payload
  from required_baseline_assignments as candidate
  order by candidate.end_at asc nulls last, candidate.created_at desc, candidate.id desc
  limit 1;

  if selected_assignment_id is not null then
    return jsonb_build_object(
      'status', 'start',
      'assignment_id', selected_assignment_id,
      'required_standard_key', safe_required_key,
      'class_ids', to_jsonb(active_class_ids),
      'assignment', selected_assignment_payload
    );
  end if;

  return jsonb_build_object(
    'status', 'waiting',
    'assignment_id', null,
    'required_standard_key', safe_required_key,
    'class_ids', to_jsonb(active_class_ids),
    'assignment', null
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

  if profile_row.archived_at is not null then
    raise exception 'Restore the staff directory record before approving live access.';
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
    timezone('utc', now())
  );

  insert into public.staff_pending_role_assignments (approval_id, role)
  select new_approval_id, role_value
  from unnest(normalized_roles) as role_value;

  if jsonb_typeof(requested_scopes) = 'array' then
    for scope_item in
      select value
      from jsonb_array_elements(requested_scopes)
    loop
      normalized_scope := public.normalize_staff_scope_input(
        scope_item ->> 'role',
        scope_item ->> 'scope_type',
        scope_item ->> 'scope_value'
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
        scope_value
      )
      values (
        new_approval_id,
        safe_role,
        safe_scope_type,
        safe_scope_value
      )
      on conflict do nothing;
    end loop;
  end if;

  insert into public.staff_pending_scope_assignments (
    approval_id,
    role,
    scope_type,
    scope_value
  )
  select
    new_approval_id,
    role_value,
    'school',
    'default'
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
      'role_count', coalesce(array_length(normalized_roles, 1), 0)
    )
  );

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

  if profile_row.archived_at is not null then
    failure_reason := 'Approved access cleared because the staff directory record is archived.';
    perform public.invalidate_staff_pending_approvals_for_profile(
      target_profile_id,
      failure_reason,
      target_user_id,
      jsonb_build_object(
        'source', 'pending_activation',
        'staff_archived', true
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
    select public.get_staff_profile_duplicate_conflicts(sp.id) as duplicate_conflicts
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
  ) as scope_rows on true
  where sp.archived_at is null;

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

drop trigger if exists trg_sync_pupil_record_lifecycle_state on public.pupils;
create trigger trg_sync_pupil_record_lifecycle_state
  before insert or update
  on public.pupils
  for each row
  execute function public.sync_pupil_record_lifecycle_state();

drop trigger if exists trg_sync_pupil_class_lifecycle_state on public.pupil_classes;
create trigger trg_sync_pupil_class_lifecycle_state
  before insert or update
  on public.pupil_classes
  for each row
  execute function public.sync_pupil_class_lifecycle_state();

drop trigger if exists trg_enforce_staff_live_access_lifecycle_role on public.staff_role_assignments;
create trigger trg_enforce_staff_live_access_lifecycle_role
  before insert or update
  on public.staff_role_assignments
  for each row
  execute function public.enforce_staff_live_access_lifecycle();

drop trigger if exists trg_enforce_staff_live_access_lifecycle_scope on public.staff_scope_assignments;
create trigger trg_enforce_staff_live_access_lifecycle_scope
  before insert or update
  on public.staff_scope_assignments
  for each row
  execute function public.enforce_staff_live_access_lifecycle();

drop trigger if exists trg_enforce_legacy_teacher_app_role_lifecycle on public.teacher_app_roles;
create trigger trg_enforce_legacy_teacher_app_role_lifecycle
  before insert or update
  on public.teacher_app_roles
  for each row
  execute function public.enforce_legacy_teacher_app_role_lifecycle();

drop policy if exists "Admins can view staff directory audit log" on public.staff_directory_audit_log;
create policy "Admins can view staff directory audit log"
  on public.staff_directory_audit_log
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid()));

drop policy if exists "Admins can view pupil directory audit log" on public.pupil_directory_audit_log;
create policy "Admins can view pupil directory audit log"
  on public.pupil_directory_audit_log
  for select
  to authenticated
  using (public.can_import_csv(auth.uid()));

drop policy if exists "Authenticated users can view scoped pupils" on public.pupils;
create policy "Authenticated users can view scoped pupils"
  on public.pupils
  for select
  to authenticated
  using (public.can_view_pupil_history(id));

drop policy if exists "Authenticated users can view scoped attempts" on public.attempts;
create policy "Authenticated users can view scoped attempts"
  on public.attempts
  for select
  to authenticated
  using (
    public.can_view_assignment(assignment_id)
    and public.can_view_pupil_history(pupil_id)
  );

drop policy if exists "Authenticated users can view scoped assignment pupil statuses" on public.assignment_pupil_statuses;
create policy "Authenticated users can view scoped assignment pupil statuses"
  on public.assignment_pupil_statuses
  for select
  to authenticated
  using (
    public.can_view_assignment(assignment_id)
    and public.can_view_pupil_history(pupil_id)
  );

drop policy if exists "Authenticated users can view scoped assignment pupil target words" on public.assignment_pupil_target_words;
create policy "Authenticated users can view scoped assignment pupil target words"
  on public.assignment_pupil_target_words
  for select
  to authenticated
  using (
    public.can_view_assignment(assignment_id)
    and public.can_view_pupil_history(pupil_id)
  );

drop policy if exists "Authenticated users can view scoped group comparison values" on public.teacher_pupil_group_values;
create policy "Authenticated users can view scoped group comparison values"
  on public.teacher_pupil_group_values
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    or public.can_view_pupil_history(pupil_id)
  );

drop policy if exists "Anon can view attempts" on public.attempts;
create policy "Anon can view attempts"
  on public.attempts
  for select
  to anon
  using (public.can_access_pupil_runtime(pupil_id));

drop policy if exists "Anon can insert attempts" on public.attempts;
create policy "Anon can insert attempts"
  on public.attempts
  for insert
  to anon
  with check (
    public.can_access_pupil_runtime(pupil_id)
    and (
      assignment_id is null
      or public.can_access_pupil_assignment_runtime(pupil_id, assignment_id)
    )
  );

drop policy if exists "Anon can view assignment pupil statuses" on public.assignment_pupil_statuses;
create policy "Anon can view assignment pupil statuses"
  on public.assignment_pupil_statuses
  for select
  to anon
  using (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id));

drop policy if exists "Anon can insert assignment pupil statuses" on public.assignment_pupil_statuses;
create policy "Anon can insert assignment pupil statuses"
  on public.assignment_pupil_statuses
  for insert
  to anon
  with check (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id));

drop policy if exists "Anon can update assignment pupil statuses" on public.assignment_pupil_statuses;
create policy "Anon can update assignment pupil statuses"
  on public.assignment_pupil_statuses
  for update
  to anon
  using (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id))
  with check (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id));

drop policy if exists "Anon can view assignment pupil target words" on public.assignment_pupil_target_words;
create policy "Anon can view assignment pupil target words"
  on public.assignment_pupil_target_words
  for select
  to anon
  using (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id));

drop policy if exists "Anon can insert assignment pupil target words" on public.assignment_pupil_target_words;
create policy "Anon can insert assignment pupil target words"
  on public.assignment_pupil_target_words
  for insert
  to anon
  with check (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id));

drop policy if exists "Anon can update assignment pupil target words" on public.assignment_pupil_target_words;
create policy "Anon can update assignment pupil target words"
  on public.assignment_pupil_target_words
  for update
  to anon
  using (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id))
  with check (public.can_access_pupil_assignment_runtime(pupil_id, assignment_id));

revoke all on function public.log_staff_directory_event(uuid, uuid, uuid, text, text, jsonb) from public;
revoke all on function public.log_pupil_directory_event(uuid, uuid, text, text, jsonb) from public;
revoke all on function public.can_view_pupil_history(uuid, uuid) from public;
revoke all on function public.can_access_pupil_runtime(uuid) from public;
revoke all on function public.can_access_pupil_assignment_runtime(uuid, uuid) from public;
revoke all on function public.sync_pupil_record_lifecycle_state() from public;
revoke all on function public.sync_pupil_class_lifecycle_state() from public;
revoke all on function public.enforce_staff_live_access_lifecycle() from public;
revoke all on function public.enforce_legacy_teacher_app_role_lifecycle() from public;
revoke all on function public.revoke_all_staff_live_access(uuid, text) from public;
revoke all on function public.archive_staff_directory_record(uuid, text) from public;
revoke all on function public.restore_staff_directory_record(uuid, text) from public;
revoke all on function public.archive_pupil_directory_record(uuid, text) from public;
revoke all on function public.restore_pupil_directory_record(uuid, text) from public;
revoke all on function public.move_pupil_form_membership(uuid, uuid, text) from public;
revoke all on function public.authenticate_pupil(text, text) from public;
revoke all on function public.validate_pupil_runtime_session(uuid) from public;
revoke all on function public.read_pupil_baseline_gate_state(uuid, text) from public;
revoke all on function public.list_staff_pending_access_summaries() from public;
revoke all on function public.read_staff_pending_access_detail(uuid) from public;
revoke all on function public.save_staff_pending_access_approval(uuid, jsonb, jsonb) from public;

grant execute on function public.can_view_pupil_history(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_access_pupil_runtime(uuid) to anon, authenticated, service_role;
grant execute on function public.can_access_pupil_assignment_runtime(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.revoke_all_staff_live_access(uuid, text) to authenticated, service_role;
grant execute on function public.archive_staff_directory_record(uuid, text) to authenticated, service_role;
grant execute on function public.restore_staff_directory_record(uuid, text) to authenticated, service_role;
grant execute on function public.archive_pupil_directory_record(uuid, text) to authenticated, service_role;
grant execute on function public.restore_pupil_directory_record(uuid, text) to authenticated, service_role;
grant execute on function public.move_pupil_form_membership(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.authenticate_pupil(text, text) to anon, authenticated, service_role;
grant execute on function public.validate_pupil_runtime_session(uuid) to anon, authenticated, service_role;
grant execute on function public.read_pupil_baseline_gate_state(uuid, text) to anon, authenticated, service_role;
grant execute on function public.list_staff_pending_access_summaries() to authenticated, service_role;
grant execute on function public.read_staff_pending_access_detail(uuid) to authenticated, service_role;
grant execute on function public.save_staff_pending_access_approval(uuid, jsonb, jsonb) to authenticated, service_role;
