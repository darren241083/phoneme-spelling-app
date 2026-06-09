begin;

create or replace function public.phase2_resolve_school_id(requested_school_id uuid default null)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(requested_school_id, public.default_legacy_school_id());
$$;

alter function public.phase2_resolve_school_id(uuid) owner to postgres;
revoke all on function public.phase2_resolve_school_id(uuid) from public;
grant execute on function public.phase2_resolve_school_id(uuid) to anon;
grant execute on function public.phase2_resolve_school_id(uuid) to authenticated;
grant execute on function public.phase2_resolve_school_id(uuid) to service_role;

create or replace function public.phase2_try_uuid(input_value text)
returns uuid
language plpgsql
immutable
set search_path to 'public'
as $$
begin
  return nullif(btrim(coalesce(input_value, '')), '')::uuid;
exception
  when others then
    return null;
end;
$$;

alter function public.phase2_try_uuid(text) owner to postgres;
revoke all on function public.phase2_try_uuid(text) from public;
grant execute on function public.phase2_try_uuid(text) to anon;
grant execute on function public.phase2_try_uuid(text) to authenticated;
grant execute on function public.phase2_try_uuid(text) to service_role;

create or replace function public.phase2_user_has_school_membership(
  requested_user_id uuid,
  requested_school_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    requested_user_id is not null
    and requested_school_id is not null
    and (
      exists (
        select 1
        from public.school_memberships as sm
        where sm.user_id = requested_user_id
          and sm.school_id = requested_school_id
          and sm.active is true
      )
      or not exists (
        select 1
        from public.school_memberships as sm
        where sm.user_id = requested_user_id
          and sm.active is true
      )
    ),
    false
  );
$$;

alter function public.phase2_user_has_school_membership(uuid, uuid) owner to postgres;
revoke all on function public.phase2_user_has_school_membership(uuid, uuid) from public;
grant execute on function public.phase2_user_has_school_membership(uuid, uuid) to anon;
grant execute on function public.phase2_user_has_school_membership(uuid, uuid) to authenticated;
grant execute on function public.phase2_user_has_school_membership(uuid, uuid) to service_role;

create or replace function public.phase2_staff_single_school_id(requested_user_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  resolved_school_id uuid;
  membership_count integer := 0;
  legacy_school_id uuid := public.default_legacy_school_id();
begin
  select min(sm.school_id), count(distinct sm.school_id)
  into resolved_school_id, membership_count
  from public.school_memberships as sm
  where sm.user_id = requested_user_id
    and sm.active is true;

  if membership_count = 1 then
    return resolved_school_id;
  end if;

  return legacy_school_id;
end;
$$;

alter function public.phase2_staff_single_school_id(uuid) owner to postgres;
revoke all on function public.phase2_staff_single_school_id(uuid) from public;
grant execute on function public.phase2_staff_single_school_id(uuid) to anon;
grant execute on function public.phase2_staff_single_school_id(uuid) to authenticated;
grant execute on function public.phase2_staff_single_school_id(uuid) to service_role;

create or replace function public.phase2_target_staff_school_id(
  target_user_id uuid,
  actor_user_id uuid default auth.uid()
) returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  resolved_school_id uuid;
begin
  select coalesce(sp.school_id, public.default_legacy_school_id())
  into resolved_school_id
  from public.staff_profiles as sp
  where sp.user_id = target_user_id
  order by sp.updated_at desc nulls last
  limit 1;

  if resolved_school_id is not null then
    return resolved_school_id;
  end if;

  select coalesce(sra.school_id, public.default_legacy_school_id())
  into resolved_school_id
  from public.staff_role_assignments as sra
  where sra.user_id = target_user_id
    and sra.active is true
  order by sra.updated_at desc nulls last
  limit 1;

  if resolved_school_id is not null then
    return resolved_school_id;
  end if;

  return public.phase2_staff_single_school_id(actor_user_id);
end;
$$;

alter function public.phase2_target_staff_school_id(uuid, uuid) owner to postgres;
revoke all on function public.phase2_target_staff_school_id(uuid, uuid) from public;
grant execute on function public.phase2_target_staff_school_id(uuid, uuid) to anon;
grant execute on function public.phase2_target_staff_school_id(uuid, uuid) to authenticated;
grant execute on function public.phase2_target_staff_school_id(uuid, uuid) to service_role;

create or replace function public.phase2_scope_school_id(
  requested_scope_type text,
  requested_scope_value text,
  fallback_school_id uuid default null
) returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  safe_scope_type text := lower(btrim(coalesce(requested_scope_type, '')));
  safe_scope_value text := btrim(coalesce(requested_scope_value, ''));
  parsed_school_id uuid;
  resolved_school_id uuid;
begin
  if fallback_school_id is not null then
    return fallback_school_id;
  end if;

  if safe_scope_type = 'school' then
    if safe_scope_value = '' or lower(safe_scope_value) = 'default' then
      return public.default_legacy_school_id();
    end if;

    parsed_school_id := public.phase2_try_uuid(safe_scope_value);
    if parsed_school_id is not null
      and exists (select 1 from public.schools where id = parsed_school_id) then
      return parsed_school_id;
    end if;
  elsif safe_scope_type = 'class' then
    select coalesce(c.school_id, public.default_legacy_school_id())
    into resolved_school_id
    from public.classes as c
    where c.id = public.phase2_try_uuid(safe_scope_value)
    limit 1;

    if resolved_school_id is not null then
      return resolved_school_id;
    end if;
  end if;

  return public.default_legacy_school_id();
end;
$$;

alter function public.phase2_scope_school_id(text, text, uuid) owner to postgres;
revoke all on function public.phase2_scope_school_id(text, text, uuid) from public;
grant execute on function public.phase2_scope_school_id(text, text, uuid) to anon;
grant execute on function public.phase2_scope_school_id(text, text, uuid) to authenticated;
grant execute on function public.phase2_scope_school_id(text, text, uuid) to service_role;

create or replace function public.phase2_scope_value_matches(
  stored_scope_type text,
  stored_scope_value text,
  stored_school_id uuid,
  requested_scope_value text,
  requested_school_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when lower(btrim(coalesce(stored_scope_type, ''))) = 'school' then
      coalesce(stored_school_id, public.default_legacy_school_id()) = requested_school_id
      and (
        lower(btrim(coalesce(stored_scope_value, ''))) = 'default'
        or btrim(coalesce(stored_scope_value, '')) = requested_school_id::text
        or lower(btrim(coalesce(requested_scope_value, ''))) = 'default'
        or btrim(coalesce(requested_scope_value, '')) = requested_school_id::text
      )
    else
      btrim(coalesce(stored_scope_value, '')) = btrim(coalesce(requested_scope_value, ''))
    end;
$$;

alter function public.phase2_scope_value_matches(text, text, uuid, text, uuid) owner to postgres;
revoke all on function public.phase2_scope_value_matches(text, text, uuid, text, uuid) from public;
grant execute on function public.phase2_scope_value_matches(text, text, uuid, text, uuid) to anon;
grant execute on function public.phase2_scope_value_matches(text, text, uuid, text, uuid) to authenticated;
grant execute on function public.phase2_scope_value_matches(text, text, uuid, text, uuid) to service_role;

create or replace function public.phase2_ensure_school_membership(
  requested_user_id uuid,
  requested_school_id uuid,
  requested_source text default 'system'
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if requested_user_id is null or requested_school_id is null then
    return;
  end if;

  insert into public.school_memberships (school_id, user_id, source)
  values (
    requested_school_id,
    requested_user_id,
    case when requested_source in ('legacy_backfill', 'manual', 'import', 'system') then requested_source else 'system' end
  )
  on conflict do nothing;

  update public.school_memberships
  set active = true,
      updated_at = timezone('utc', now())
  where school_id = requested_school_id
    and user_id = requested_user_id;
end;
$$;

alter function public.phase2_ensure_school_membership(uuid, uuid, text) owner to postgres;
revoke all on function public.phase2_ensure_school_membership(uuid, uuid, text) from public;
grant execute on function public.phase2_ensure_school_membership(uuid, uuid, text) to service_role;

update public.staff_profiles
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.staff_role_assignments
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.staff_scope_assignments
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.staff_access_audit_log
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.staff_directory_audit_log
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.staff_import_batches
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.staff_pending_access_approvals
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.staff_pending_access_audit_log
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.staff_pending_role_assignments
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.staff_pending_scope_assignments
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.pupil_import_batches
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.pupil_directory_audit_log
set school_id = public.default_legacy_school_id()
where school_id is null;

update public.teacher_app_roles
set school_id = public.default_legacy_school_id()
where school_id is null;

insert into public.school_memberships (school_id, user_id, source)
select distinct coalesce(sra.school_id, public.default_legacy_school_id()), sra.user_id, 'system'
from public.staff_role_assignments as sra
where sra.user_id is not null
  and sra.active is true
on conflict do nothing;

insert into public.school_memberships (school_id, user_id, source)
select distinct coalesce(sp.school_id, public.default_legacy_school_id()), sp.user_id, 'system'
from public.staff_profiles as sp
where sp.user_id is not null
on conflict do nothing;

insert into public.school_memberships (school_id, user_id, source)
select distinct coalesce(tar.school_id, public.default_legacy_school_id()), tar.teacher_id, 'system'
from public.teacher_app_roles as tar
where tar.teacher_id is not null
on conflict do nothing;

create index if not exists idx_staff_role_assignments_school_user_role_active
  on public.staff_role_assignments (school_id, user_id, role, active);

create index if not exists idx_staff_scope_assignments_school_user_role_scope_active
  on public.staff_scope_assignments (school_id, user_id, role, scope_type, scope_value, active);

create index if not exists idx_staff_profiles_school_user
  on public.staff_profiles (school_id, user_id);

create index if not exists idx_school_memberships_school_user_active
  on public.school_memberships (school_id, user_id, active);

create or replace function public.has_role(
  requested_role text,
  requested_user_id uuid,
  requested_school_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    requested_user_id is not null
    and requested_school_id is not null
    and exists (
      select 1
      from public.staff_role_assignments as sra
      where sra.user_id = requested_user_id
        and sra.active is true
        and sra.role = lower(btrim(coalesce(requested_role, '')))
        and coalesce(sra.school_id, public.default_legacy_school_id()) = requested_school_id
        and public.phase2_user_has_school_membership(requested_user_id, requested_school_id)
    ),
    false
  );
$$;

alter function public.has_role(text, uuid, uuid) owner to postgres;
revoke all on function public.has_role(text, uuid, uuid) from public;
grant execute on function public.has_role(text, uuid, uuid) to anon;
grant execute on function public.has_role(text, uuid, uuid) to authenticated;
grant execute on function public.has_role(text, uuid, uuid) to service_role;

create or replace function public.has_role(
  requested_role text,
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    requested_user_id is not null
    and exists (
      select 1
      from public.staff_role_assignments as sra
      where sra.user_id = requested_user_id
        and sra.active is true
        and sra.role = lower(btrim(coalesce(requested_role, '')))
        and public.phase2_user_has_school_membership(
          requested_user_id,
          coalesce(sra.school_id, public.default_legacy_school_id())
        )
    ),
    false
  );
$$;

alter function public.has_role(text, uuid) owner to postgres;

create or replace function public.has_scope(
  requested_scope_type text,
  requested_scope_value text,
  requested_role text,
  requested_user_id uuid,
  requested_school_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    requested_user_id is not null
    and requested_school_id is not null
    and exists (
      select 1
      from public.staff_scope_assignments as ssa
      join public.staff_role_assignments as sra
        on sra.user_id = ssa.user_id
       and sra.role = ssa.role
       and sra.active is true
       and coalesce(sra.school_id, public.default_legacy_school_id()) = requested_school_id
      where ssa.user_id = requested_user_id
        and ssa.active is true
        and ssa.scope_type = lower(btrim(coalesce(requested_scope_type, '')))
        and coalesce(ssa.school_id, public.default_legacy_school_id()) = requested_school_id
        and public.phase2_scope_value_matches(
          ssa.scope_type,
          ssa.scope_value,
          coalesce(ssa.school_id, public.default_legacy_school_id()),
          requested_scope_value,
          requested_school_id
        )
        and (
          requested_role is null
          or ssa.role = lower(btrim(requested_role))
        )
        and public.phase2_user_has_school_membership(requested_user_id, requested_school_id)
    ),
    false
  );
$$;

alter function public.has_scope(text, text, text, uuid, uuid) owner to postgres;
revoke all on function public.has_scope(text, text, text, uuid, uuid) from public;
grant execute on function public.has_scope(text, text, text, uuid, uuid) to anon;
grant execute on function public.has_scope(text, text, text, uuid, uuid) to authenticated;
grant execute on function public.has_scope(text, text, text, uuid, uuid) to service_role;

create or replace function public.has_scope(
  requested_scope_type text,
  requested_scope_value text,
  requested_role text default null,
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.has_scope(
    requested_scope_type,
    requested_scope_value,
    requested_role,
    requested_user_id,
    public.phase2_scope_school_id(requested_scope_type, requested_scope_value, null)
  );
$$;

alter function public.has_scope(text, text, text, uuid) owner to postgres;

create or replace function public.legacy_teacher_app_role(
  requested_user_id uuid,
  requested_school_id uuid
) returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select (
    select case
      when tar.app_role in ('teacher', 'central_owner') then tar.app_role
      else null
    end
    from public.teacher_app_roles as tar
    where tar.teacher_id = requested_user_id
      and requested_school_id = public.default_legacy_school_id()
      and coalesce(tar.school_id, public.default_legacy_school_id()) = requested_school_id
    limit 1
  );
$$;

alter function public.legacy_teacher_app_role(uuid, uuid) owner to postgres;
revoke all on function public.legacy_teacher_app_role(uuid, uuid) from public;
grant execute on function public.legacy_teacher_app_role(uuid, uuid) to anon;
grant execute on function public.legacy_teacher_app_role(uuid, uuid) to authenticated;
grant execute on function public.legacy_teacher_app_role(uuid, uuid) to service_role;

create or replace function public.legacy_teacher_app_role(
  requested_user_id uuid default auth.uid()
) returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.legacy_teacher_app_role(requested_user_id, public.default_legacy_school_id());
$$;

alter function public.legacy_teacher_app_role(uuid) owner to postgres;

create or replace function public.is_admin_compat(
  requested_user_id uuid,
  requested_school_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    requested_user_id is not null
    and requested_school_id is not null
    and (
      public.has_role('admin', requested_user_id, requested_school_id)
      or public.legacy_teacher_app_role(requested_user_id, requested_school_id) = 'central_owner'
    ),
    false
  );
$$;

alter function public.is_admin_compat(uuid, uuid) owner to postgres;
revoke all on function public.is_admin_compat(uuid, uuid) from public;
grant execute on function public.is_admin_compat(uuid, uuid) to anon;
grant execute on function public.is_admin_compat(uuid, uuid) to authenticated;
grant execute on function public.is_admin_compat(uuid, uuid) to service_role;

create or replace function public.is_admin_compat(
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
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

alter function public.is_admin_compat(uuid) owner to postgres;

create or replace function public.is_teacher_compat(
  requested_user_id uuid,
  requested_school_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    requested_user_id is not null
    and requested_school_id is not null
    and (
      public.has_role('teacher', requested_user_id, requested_school_id)
      or public.legacy_teacher_app_role(requested_user_id, requested_school_id) = 'teacher'
    ),
    false
  );
$$;

alter function public.is_teacher_compat(uuid, uuid) owner to postgres;
revoke all on function public.is_teacher_compat(uuid, uuid) from public;
grant execute on function public.is_teacher_compat(uuid, uuid) to anon;
grant execute on function public.is_teacher_compat(uuid, uuid) to authenticated;
grant execute on function public.is_teacher_compat(uuid, uuid) to service_role;

create or replace function public.is_teacher_compat(
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
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

alter function public.is_teacher_compat(uuid) owner to postgres;

create or replace function public.is_central_owner()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_admin_compat(auth.uid());
$$;

alter function public.is_central_owner() owner to postgres;

create or replace function public.can_manage_roles(
  requested_user_id uuid,
  requested_school_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_admin_compat(requested_user_id, requested_school_id);
$$;

alter function public.can_manage_roles(uuid, uuid) owner to postgres;
revoke all on function public.can_manage_roles(uuid, uuid) from public;
grant execute on function public.can_manage_roles(uuid, uuid) to anon;
grant execute on function public.can_manage_roles(uuid, uuid) to authenticated;
grant execute on function public.can_manage_roles(uuid, uuid) to service_role;

create or replace function public.can_manage_roles(
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_admin_compat(requested_user_id);
$$;

alter function public.can_manage_roles(uuid) owner to postgres;

create or replace function public.can_manage_automation(
  requested_user_id uuid,
  requested_school_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_admin_compat(requested_user_id, requested_school_id);
$$;

alter function public.can_manage_automation(uuid, uuid) owner to postgres;
revoke all on function public.can_manage_automation(uuid, uuid) from public;
grant execute on function public.can_manage_automation(uuid, uuid) to anon;
grant execute on function public.can_manage_automation(uuid, uuid) to authenticated;
grant execute on function public.can_manage_automation(uuid, uuid) to service_role;

create or replace function public.can_manage_automation(
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_admin_compat(requested_user_id);
$$;

alter function public.can_manage_automation(uuid) owner to postgres;

create or replace function public.can_import_csv(
  requested_user_id uuid,
  requested_school_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_admin_compat(requested_user_id, requested_school_id);
$$;

alter function public.can_import_csv(uuid, uuid) owner to postgres;
revoke all on function public.can_import_csv(uuid, uuid) from public;
grant execute on function public.can_import_csv(uuid, uuid) to anon;
grant execute on function public.can_import_csv(uuid, uuid) to authenticated;
grant execute on function public.can_import_csv(uuid, uuid) to service_role;

create or replace function public.can_import_csv(
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_admin_compat(requested_user_id);
$$;

alter function public.can_import_csv(uuid) owner to postgres;

create or replace function public.can_view_class(
  requested_class_id uuid,
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.classes as c
    cross join lateral (
      select coalesce(c.school_id, public.default_legacy_school_id()) as school_id
    ) as target
    where c.id = requested_class_id
      and (
        public.is_admin_compat(requested_user_id, target.school_id)
        or (
          c.teacher_id = requested_user_id
          and public.is_teacher_compat(requested_user_id, target.school_id)
        )
        or public.has_scope('school', 'default', 'admin', requested_user_id, target.school_id)
        or public.has_scope('school', 'default', 'senco', requested_user_id, target.school_id)
        or public.has_scope('school', 'default', 'literacy_lead', requested_user_id, target.school_id)
        or public.has_scope('class', c.id::text, null, requested_user_id, target.school_id)
        or (
          nullif(btrim(coalesce(c.year_group, '')), '') is not null
          and public.has_scope('year_group', c.year_group, 'hoy', requested_user_id, target.school_id)
        )
        or (
          nullif(btrim(coalesce(c.department_key, '')), '') is not null
          and public.has_scope('department', c.department_key, 'hod', requested_user_id, target.school_id)
        )
      )
  );
$$;

alter function public.can_view_class(uuid, uuid) owner to postgres;

create or replace function public.can_view_pupil(
  requested_pupil_id uuid,
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.pupil_classes as pc
    join public.pupils as p
      on p.id = pc.pupil_id
    join public.classes as c
      on c.id = pc.class_id
    where pc.pupil_id = requested_pupil_id
      and pc.active is true
      and coalesce(pc.school_id, c.school_id, p.school_id, public.default_legacy_school_id())
        = coalesce(c.school_id, p.school_id, pc.school_id, public.default_legacy_school_id())
      and public.can_view_class(pc.class_id, requested_user_id)
  );
$$;

alter function public.can_view_pupil(uuid, uuid) owner to postgres;

create or replace function public.can_view_pupil_history(
  requested_pupil_id uuid,
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.pupil_classes as pc
    join public.pupils as p
      on p.id = pc.pupil_id
    join public.classes as c
      on c.id = pc.class_id
    where pc.pupil_id = requested_pupil_id
      and coalesce(pc.school_id, c.school_id, p.school_id, public.default_legacy_school_id())
        = coalesce(c.school_id, p.school_id, pc.school_id, public.default_legacy_school_id())
      and public.can_view_class(pc.class_id, requested_user_id)
  );
$$;

alter function public.can_view_pupil_history(uuid, uuid) owner to postgres;

create or replace function public.can_view_assignment(
  requested_assignment_id uuid,
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.assignments_v2 as a
    join public.classes as c
      on c.id = a.class_id
    where a.id = requested_assignment_id
      and coalesce(a.school_id, c.school_id, public.default_legacy_school_id())
        = coalesce(c.school_id, a.school_id, public.default_legacy_school_id())
      and public.can_view_class(a.class_id, requested_user_id)
  );
$$;

alter function public.can_view_assignment(uuid, uuid) owner to postgres;

create or replace function public.can_view_test(
  requested_test_id uuid,
  requested_user_id uuid default auth.uid()
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.tests as t
    cross join lateral (
      select coalesce(t.school_id, public.default_legacy_school_id()) as school_id
    ) as target
    where t.id = requested_test_id
      and (
        (
          t.teacher_id = requested_user_id
          and public.is_teacher_compat(requested_user_id, target.school_id)
        )
        or exists (
          select 1
          from public.assignments_v2 as a
          join public.classes as c
            on c.id = a.class_id
          where a.test_id = t.id
            and coalesce(a.school_id, c.school_id, target.school_id) = target.school_id
            and public.can_view_class(a.class_id, requested_user_id)
        )
      )
  );
$$;

alter function public.can_view_test(uuid, uuid) owner to postgres;

create or replace function public.list_viewable_class_ids(
  requested_user_id uuid,
  requested_class_id uuid default null,
  requested_year_group text default null,
  requested_department_key text default null
) returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id
  from public.classes as c
  where (requested_class_id is null or c.id = requested_class_id)
    and (
      requested_year_group is null
      or lower(btrim(coalesce(c.year_group, ''))) = lower(btrim(requested_year_group))
    )
    and (
      requested_department_key is null
      or lower(btrim(coalesce(c.department_key, ''))) = lower(btrim(requested_department_key))
    )
    and public.can_view_class(c.id, requested_user_id)
  order by c.name;
$$;

alter function public.list_viewable_class_ids(uuid, uuid, text, text) owner to postgres;

create or replace function public.normalize_staff_scope_input(
  requested_role text,
  requested_scope_type text,
  requested_scope_value text,
  requested_school_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  safe_scope_type text := lower(btrim(coalesce(requested_scope_type, '')));
  safe_scope_value text := btrim(coalesce(requested_scope_value, ''));
  target_school_id uuid := public.phase2_resolve_school_id(requested_school_id);
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
    if target_school_id = public.default_legacy_school_id() then
      safe_scope_value := 'default';
    else
      safe_scope_value := target_school_id::text;
    end if;
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
      where c.id = public.phase2_try_uuid(safe_scope_value)
        and coalesce(c.school_id, public.default_legacy_school_id()) = target_school_id
    ) then
    raise exception 'Class scope must reference an existing class in this school.';
  end if;

  if safe_scope_type = 'year_group'
    and not exists (
      select 1
      from public.classes as c
      where lower(btrim(coalesce(c.year_group, ''))) = lower(safe_scope_value)
        and coalesce(c.school_id, public.default_legacy_school_id()) = target_school_id
    ) then
    raise exception 'Year-group scope must reference an existing class year group in this school.';
  end if;

  if safe_scope_type = 'department'
    and not exists (
      select 1
      from public.classes as c
      where nullif(btrim(coalesce(c.department_key, '')), '') is not null
        and lower(btrim(c.department_key)) = lower(safe_scope_value)
        and coalesce(c.school_id, public.default_legacy_school_id()) = target_school_id
    ) then
    raise exception 'Department scope must reference a mapped classes.department_key value in this school.';
  end if;

  return jsonb_build_object(
    'role', safe_role,
    'scope_type', safe_scope_type,
    'scope_value', safe_scope_value,
    'school_id', target_school_id
  );
end;
$$;

alter function public.normalize_staff_scope_input(text, text, text, uuid) owner to postgres;
revoke all on function public.normalize_staff_scope_input(text, text, text, uuid) from public;
grant execute on function public.normalize_staff_scope_input(text, text, text, uuid) to anon;
grant execute on function public.normalize_staff_scope_input(text, text, text, uuid) to authenticated;
grant execute on function public.normalize_staff_scope_input(text, text, text, uuid) to service_role;

create or replace function public.normalize_staff_scope_input(
  requested_role text,
  requested_scope_type text,
  requested_scope_value text
) returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.normalize_staff_scope_input(
    requested_role,
    requested_scope_type,
    requested_scope_value,
    public.phase2_scope_school_id(requested_scope_type, requested_scope_value, null)
  );
$$;

alter function public.normalize_staff_scope_input(text, text, text) owner to postgres;

create or replace function public.apply_staff_role_assignment_internal(
  target_user_id uuid,
  requested_role text,
  actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  target_school_id uuid := public.phase2_target_staff_school_id(target_user_id, actor_user_id);
  school_scope_value text := case
    when target_school_id = public.default_legacy_school_id() then 'default'
    else target_school_id::text
  end;
begin
  if target_user_id is null then
    raise exception 'Choose a staff account before granting a role.';
  end if;

  if safe_role not in ('admin', 'teacher', 'hoy', 'hod', 'senco', 'literacy_lead') then
    raise exception 'Invalid role.';
  end if;

  perform public.phase2_ensure_school_membership(target_user_id, target_school_id, 'manual');

  insert into public.staff_role_assignments (user_id, role, active, granted_by, school_id)
  values (target_user_id, safe_role, true, actor_user_id, target_school_id)
  on conflict do nothing;

  update public.staff_role_assignments
  set active = true,
      granted_by = actor_user_id,
      school_id = target_school_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = safe_role;

  if public.staff_role_uses_automatic_school_scope(safe_role) then
    insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
    values (target_user_id, safe_role, 'school', school_scope_value, true, actor_user_id, target_school_id)
    on conflict do nothing;

    update public.staff_scope_assignments
    set active = true,
        granted_by = actor_user_id,
        school_id = target_school_id,
        scope_value = school_scope_value,
        updated_at = timezone('utc', now())
    where user_id = target_user_id
      and role = safe_role
      and scope_type = 'school'
      and (
        scope_value = school_scope_value
        or (
          target_school_id = public.default_legacy_school_id()
          and scope_value = 'default'
        )
      );
  end if;

  return jsonb_build_object(
    'target_user_id', target_user_id,
    'role', safe_role,
    'school_id', target_school_id,
    'active', true
  );
end;
$$;

alter function public.apply_staff_role_assignment_internal(uuid, text, uuid) owner to postgres;

create or replace function public.apply_staff_scope_assignment_internal(
  target_user_id uuid,
  requested_role text,
  requested_scope_type text,
  requested_scope_value text,
  actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  target_school_id uuid := public.phase2_target_staff_school_id(target_user_id, actor_user_id);
  normalized_scope jsonb := public.normalize_staff_scope_input(
    requested_role,
    requested_scope_type,
    requested_scope_value,
    target_school_id
  );
  safe_role text := normalized_scope ->> 'role';
  safe_scope_type text := normalized_scope ->> 'scope_type';
  safe_scope_value text := normalized_scope ->> 'scope_value';
begin
  if target_user_id is null then
    raise exception 'Choose a staff account before granting a scope.';
  end if;

  perform public.phase2_ensure_school_membership(target_user_id, target_school_id, 'manual');

  insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
  values (target_user_id, safe_role, safe_scope_type, safe_scope_value, true, actor_user_id, target_school_id)
  on conflict do nothing;

  update public.staff_scope_assignments
  set active = true,
      granted_by = actor_user_id,
      school_id = target_school_id,
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
    'school_id', target_school_id,
    'active', true
  );
end;
$$;

alter function public.apply_staff_scope_assignment_internal(uuid, text, text, text, uuid) owner to postgres;

create or replace function public.grant_staff_role(
  target_user_id uuid,
  requested_role text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  target_school_id uuid := public.phase2_target_staff_school_id(target_user_id, actor_user_id);
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before changing staff roles.';
  end if;

  if not public.can_manage_roles(actor_user_id, target_school_id) then
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

alter function public.grant_staff_role(uuid, text) owner to postgres;

create or replace function public.grant_staff_scope(
  target_user_id uuid,
  requested_role text,
  requested_scope_type text,
  requested_scope_value text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  target_school_id uuid := public.phase2_target_staff_school_id(target_user_id, actor_user_id);
  normalized_scope jsonb;
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

  if not public.has_role(safe_role, target_user_id, target_school_id) then
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
    jsonb_build_object('school_id', target_school_id)
  );

  return normalized_scope;
end;
$$;

alter function public.grant_staff_scope(uuid, text, text, text) owner to postgres;

create or replace function public.revoke_staff_role(
  target_user_id uuid,
  requested_role text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_role text := lower(btrim(coalesce(requested_role, '')));
  target_school_id uuid := public.phase2_target_staff_school_id(target_user_id, actor_user_id);
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

alter function public.revoke_staff_role(uuid, text) owner to postgres;

create or replace function public.revoke_staff_scope(
  target_user_id uuid,
  requested_role text,
  requested_scope_type text,
  requested_scope_value text
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
  target_school_id uuid := public.phase2_target_staff_school_id(target_user_id, actor_user_id);
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
    and coalesce(school_id, public.default_legacy_school_id()) = target_school_id
    and (
      scope_value = normalized_scope_value
      or (
        safe_scope_type = 'school'
        and target_school_id = public.default_legacy_school_id()
        and scope_value = 'default'
      )
    )
    and active is true;

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

alter function public.revoke_staff_scope(uuid, text, text, text) owner to postgres;

create or replace function public.bootstrap_first_admin(
  target_user_id uuid default auth.uid()
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  audit_actor_user_id uuid := coalesce(auth.uid(), target_user_id);
  active_admin_count integer := 0;
  bootstrap_mode text := 'self_service';
  target_school_id uuid := public.default_legacy_school_id();
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
    and active is true
    and coalesce(school_id, public.default_legacy_school_id()) = target_school_id;

  if active_admin_count > 0 then
    raise exception 'An active admin already exists. Use the admin role assignment functions instead.';
  end if;

  if not public.user_has_staff_data(target_user_id) then
    raise exception 'First admin bootstrap is only available for an existing staff account.';
  end if;

  perform public.phase2_ensure_school_membership(target_user_id, target_school_id, 'manual');

  insert into public.staff_role_assignments (user_id, role, active, granted_by, school_id)
  values (target_user_id, 'admin', true, audit_actor_user_id, target_school_id)
  on conflict do nothing;

  update public.staff_role_assignments
  set granted_by = audit_actor_user_id,
      school_id = target_school_id,
      updated_at = timezone('utc', now())
  where user_id = target_user_id
    and role = 'admin'
    and active is true;

  insert into public.staff_scope_assignments (user_id, role, scope_type, scope_value, active, granted_by, school_id)
  values (target_user_id, 'admin', 'school', 'default', true, audit_actor_user_id, target_school_id)
  on conflict do nothing;

  update public.staff_scope_assignments
  set granted_by = audit_actor_user_id,
      school_id = target_school_id,
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
      'actor_role', actor_role,
      'school_id', target_school_id
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
      'admin', jsonb_build_object('school', true, 'year_groups', jsonb_build_array(), 'departments', jsonb_build_array(), 'class_ids', jsonb_build_array()),
      'teacher', jsonb_build_object('school', false, 'year_groups', jsonb_build_array(), 'departments', jsonb_build_array(), 'class_ids', jsonb_build_array()),
      'hoy', jsonb_build_object('school', false, 'year_groups', jsonb_build_array(), 'departments', jsonb_build_array(), 'class_ids', jsonb_build_array()),
      'hod', jsonb_build_object('school', false, 'year_groups', jsonb_build_array(), 'departments', jsonb_build_array(), 'class_ids', jsonb_build_array()),
      'senco', jsonb_build_object('school', false, 'year_groups', jsonb_build_array(), 'departments', jsonb_build_array(), 'class_ids', jsonb_build_array()),
      'literacy_lead', jsonb_build_object('school', false, 'year_groups', jsonb_build_array(), 'departments', jsonb_build_array(), 'class_ids', jsonb_build_array())
    ),
    'data_health', jsonb_build_object('unmapped_subject_class_count', 0),
    'bootstrap_mode', bootstrap_mode
  );
end;
$$;

alter function public.bootstrap_first_admin(uuid) owner to postgres;

create or replace function public.get_my_access_context()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
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
      coalesce(bool_or(ssa.role = 'admin' and ssa.scope_type = 'school'), false),
      coalesce(array_agg(distinct ssa.scope_value order by ssa.scope_value) filter (where ssa.role = 'hoy' and ssa.scope_type = 'year_group'), array[]::text[]),
      coalesce(array_agg(distinct ssa.scope_value order by ssa.scope_value) filter (where ssa.role = 'hoy' and ssa.scope_type = 'class'), array[]::text[]),
      coalesce(array_agg(distinct ssa.scope_value order by ssa.scope_value) filter (where ssa.role = 'hod' and ssa.scope_type = 'department'), array[]::text[]),
      coalesce(array_agg(distinct ssa.scope_value order by ssa.scope_value) filter (where ssa.role = 'hod' and ssa.scope_type = 'class'), array[]::text[]),
      coalesce(bool_or(ssa.role = 'senco' and ssa.scope_type = 'school'), false),
      coalesce(bool_or(ssa.role = 'literacy_lead' and ssa.scope_type = 'school'), false),
      coalesce(bool_or(ssa.scope_type = 'school'), false),
      coalesce(array_agg(distinct ssa.scope_value order by ssa.scope_value) filter (where ssa.scope_type = 'year_group'), array[]::text[]),
      coalesce(array_agg(distinct ssa.scope_value order by ssa.scope_value) filter (where ssa.scope_type = 'department'), array[]::text[]),
      coalesce(array_agg(distinct ssa.scope_value order by ssa.scope_value) filter (where ssa.scope_type = 'class'), array[]::text[])
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
     and coalesce(sra.school_id, public.default_legacy_school_id()) = coalesce(ssa.school_id, public.default_legacy_school_id())
    where ssa.user_id = current_user_id
      and ssa.active is true
      and public.phase2_user_has_school_membership(
        current_user_id,
        coalesce(ssa.school_id, public.default_legacy_school_id())
      );
  end if;

  if has_admin_compat then
    admin_school_scope := true;
    school_scope := true;
    select count(*)
    into unmapped_subject_class_count
    from public.classes as c
    where c.class_type = 'subject'
      and nullif(btrim(coalesce(c.department_key, '')), '') is null
      and public.can_manage_roles(
        current_user_id,
        coalesce(c.school_id, public.default_legacy_school_id())
      );
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
      'admin', jsonb_build_object('school', admin_school_scope, 'year_groups', jsonb_build_array(), 'departments', jsonb_build_array(), 'class_ids', jsonb_build_array()),
      'teacher', jsonb_build_object('school', false, 'year_groups', jsonb_build_array(), 'departments', jsonb_build_array(), 'class_ids', jsonb_build_array()),
      'hoy', jsonb_build_object('school', false, 'year_groups', to_jsonb(coalesce(hoy_year_groups, array[]::text[])), 'departments', jsonb_build_array(), 'class_ids', to_jsonb(coalesce(hoy_class_ids, array[]::text[]))),
      'hod', jsonb_build_object('school', false, 'year_groups', jsonb_build_array(), 'departments', to_jsonb(coalesce(hod_departments, array[]::text[])), 'class_ids', to_jsonb(coalesce(hod_class_ids, array[]::text[]))),
      'senco', jsonb_build_object('school', senco_school_scope, 'year_groups', jsonb_build_array(), 'departments', jsonb_build_array(), 'class_ids', jsonb_build_array()),
      'literacy_lead', jsonb_build_object('school', literacy_lead_school_scope, 'year_groups', jsonb_build_array(), 'departments', jsonb_build_array(), 'class_ids', jsonb_build_array())
    ),
    'data_health', jsonb_build_object(
      'unmapped_subject_class_count', unmapped_subject_class_count
    )
  );
end;
$$;

alter function public.get_my_access_context() owner to postgres;

drop policy if exists "Admins can view staff profiles" on public.staff_profiles;
create policy "Admins can view staff profiles"
  on public.staff_profiles
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Staff can view own role assignments" on public.staff_role_assignments;
create policy "Staff can view own role assignments"
  on public.staff_role_assignments
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
  );

drop policy if exists "Staff can view own scope assignments" on public.staff_scope_assignments;
create policy "Staff can view own scope assignments"
  on public.staff_scope_assignments
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
  );

drop policy if exists "Admins can view access audit log" on public.staff_access_audit_log;
create policy "Admins can view access audit log"
  on public.staff_access_audit_log
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view staff directory audit log" on public.staff_directory_audit_log;
create policy "Admins can view staff directory audit log"
  on public.staff_directory_audit_log
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view staff import batches" on public.staff_import_batches;
create policy "Admins can view staff import batches"
  on public.staff_import_batches
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view pending staff approvals" on public.staff_pending_access_approvals;
create policy "Admins can view pending staff approvals"
  on public.staff_pending_access_approvals
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view pending staff approval audit" on public.staff_pending_access_audit_log;
create policy "Admins can view pending staff approval audit"
  on public.staff_pending_access_audit_log
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view pending staff approval roles" on public.staff_pending_role_assignments;
create policy "Admins can view pending staff approval roles"
  on public.staff_pending_role_assignments
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view pending staff approval scopes" on public.staff_pending_scope_assignments;
create policy "Admins can view pending staff approval scopes"
  on public.staff_pending_scope_assignments
  for select
  to authenticated
  using (public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Teachers can view own or admin app role" on public.teacher_app_roles;
create policy "Teachers can view own or admin app role"
  on public.teacher_app_roles
  for select
  to authenticated
  using (
    auth.uid() = teacher_id
    or public.can_manage_roles(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
  );

drop policy if exists "Admins can view pupil import batches" on public.pupil_import_batches;
create policy "Admins can view pupil import batches"
  on public.pupil_import_batches
  for select
  to authenticated
  using (public.can_import_csv(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view pupil directory audit log" on public.pupil_directory_audit_log;
create policy "Admins can view pupil directory audit log"
  on public.pupil_directory_audit_log
  for select
  to authenticated
  using (public.can_import_csv(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "CSV admins can view pupils" on public.pupils;
create policy "CSV admins can view pupils"
  on public.pupils
  for select
  to authenticated
  using (public.can_import_csv(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "CSV admins can insert pupils" on public.pupils;
create policy "CSV admins can insert pupils"
  on public.pupils
  for insert
  to authenticated
  with check (public.can_import_csv(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "CSV admins can update pupils" on public.pupils;
create policy "CSV admins can update pupils"
  on public.pupils
  for update
  to authenticated
  using (public.can_import_csv(auth.uid(), coalesce(school_id, public.default_legacy_school_id())))
  with check (public.can_import_csv(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Teachers and CSV admins can insert scoped pupil classes" on public.pupil_classes;
create policy "Teachers and CSV admins can insert scoped pupil classes"
  on public.pupil_classes
  for insert
  to authenticated
  with check (
    pupil_id is not null
    and class_id is not null
    and public.can_access_pupil_runtime(pupil_id)
    and exists (
      select 1
      from public.classes as c
      where c.id = pupil_classes.class_id
        and (
          public.can_import_csv(auth.uid(), coalesce(pupil_classes.school_id, c.school_id, public.default_legacy_school_id()))
          or (
            c.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid(), coalesce(c.school_id, public.default_legacy_school_id()))
          )
        )
    )
  );

drop policy if exists "Teachers and CSV admins can update scoped pupil classes" on public.pupil_classes;
create policy "Teachers and CSV admins can update scoped pupil classes"
  on public.pupil_classes
  for update
  to authenticated
  using (
    class_id is not null
    and exists (
      select 1
      from public.classes as c
      where c.id = pupil_classes.class_id
        and (
          public.can_import_csv(auth.uid(), coalesce(pupil_classes.school_id, c.school_id, public.default_legacy_school_id()))
          or (
            c.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid(), coalesce(c.school_id, public.default_legacy_school_id()))
          )
        )
    )
  )
  with check (
    class_id is not null
    and exists (
      select 1
      from public.classes as c
      where c.id = pupil_classes.class_id
        and (
          public.can_import_csv(auth.uid(), coalesce(pupil_classes.school_id, c.school_id, public.default_legacy_school_id()))
          or (
            c.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid(), coalesce(c.school_id, public.default_legacy_school_id()))
          )
        )
    )
  );

drop policy if exists "Teachers and CSV admins can delete scoped pupil classes" on public.pupil_classes;
create policy "Teachers and CSV admins can delete scoped pupil classes"
  on public.pupil_classes
  for delete
  to authenticated
  using (
    class_id is not null
    and exists (
      select 1
      from public.classes as c
      where c.id = pupil_classes.class_id
        and (
          public.can_import_csv(auth.uid(), coalesce(pupil_classes.school_id, c.school_id, public.default_legacy_school_id()))
          or (
            c.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid(), coalesce(c.school_id, public.default_legacy_school_id()))
          )
        )
    )
  );

drop policy if exists "Teachers and admins can view scoped test groups" on public.test_groups;
create policy "Teachers and admins can view scoped test groups"
  on public.test_groups
  for select
  to authenticated
  using (
    public.is_admin_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    or (
      teacher_id = auth.uid()
      and public.is_teacher_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    )
  );

drop policy if exists "Teachers and admins can insert scoped test groups" on public.test_groups;
create policy "Teachers and admins can insert scoped test groups"
  on public.test_groups
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and (
      public.is_teacher_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
      or public.is_admin_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    )
  );

drop policy if exists "Teachers and admins can update scoped test groups" on public.test_groups;
create policy "Teachers and admins can update scoped test groups"
  on public.test_groups
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and (
      public.is_teacher_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
      or public.is_admin_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    )
  )
  with check (
    teacher_id = auth.uid()
    and (
      public.is_teacher_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
      or public.is_admin_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    )
  );

drop policy if exists "Teachers and admins can delete scoped test groups" on public.test_groups;
create policy "Teachers and admins can delete scoped test groups"
  on public.test_groups
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and (
      public.is_teacher_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
      or public.is_admin_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    )
  );

drop policy if exists "Teachers and admins can insert scoped assignment pupil overrides" on public.assignment_pupil_overrides;
create policy "Teachers and admins can insert scoped assignment pupil overrides"
  on public.assignment_pupil_overrides
  for insert
  to authenticated
  with check (
    public.can_view_pupil_history(pupil_id)
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_overrides.assignment_id
        and (
          public.is_admin_compat(auth.uid(), coalesce(a.school_id, assignment_pupil_overrides.school_id, public.default_legacy_school_id()))
          or (
            a.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid(), coalesce(a.school_id, assignment_pupil_overrides.school_id, public.default_legacy_school_id()))
          )
        )
    )
  );

drop policy if exists "Teachers and admins can update scoped assignment pupil overrides" on public.assignment_pupil_overrides;
create policy "Teachers and admins can update scoped assignment pupil overrides"
  on public.assignment_pupil_overrides
  for update
  to authenticated
  using (
    public.can_view_pupil_history(pupil_id)
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_overrides.assignment_id
        and (
          public.is_admin_compat(auth.uid(), coalesce(a.school_id, assignment_pupil_overrides.school_id, public.default_legacy_school_id()))
          or (
            a.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid(), coalesce(a.school_id, assignment_pupil_overrides.school_id, public.default_legacy_school_id()))
          )
        )
    )
  )
  with check (
    public.can_view_pupil_history(pupil_id)
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_overrides.assignment_id
        and (
          public.is_admin_compat(auth.uid(), coalesce(a.school_id, assignment_pupil_overrides.school_id, public.default_legacy_school_id()))
          or (
            a.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid(), coalesce(a.school_id, assignment_pupil_overrides.school_id, public.default_legacy_school_id()))
          )
        )
    )
  );

drop policy if exists "Teachers and admins can delete scoped assignment pupil overrides" on public.assignment_pupil_overrides;
create policy "Teachers and admins can delete scoped assignment pupil overrides"
  on public.assignment_pupil_overrides
  for delete
  to authenticated
  using (
    public.can_view_pupil_history(pupil_id)
    and exists (
      select 1
      from public.assignments_v2 as a
      where a.id = assignment_pupil_overrides.assignment_id
        and (
          public.is_admin_compat(auth.uid(), coalesce(a.school_id, assignment_pupil_overrides.school_id, public.default_legacy_school_id()))
          or (
            a.teacher_id = auth.uid()
            and public.is_teacher_compat(auth.uid(), coalesce(a.school_id, assignment_pupil_overrides.school_id, public.default_legacy_school_id()))
          )
        )
    )
  );

drop policy if exists "Admins can delete own personalised automation policies" on public.personalised_automation_policies;
create policy "Admins can delete own personalised automation policies"
  on public.personalised_automation_policies
  for delete
  to authenticated
  using (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can insert own personalised automation policies" on public.personalised_automation_policies;
create policy "Admins can insert own personalised automation policies"
  on public.personalised_automation_policies
  for insert
  to authenticated
  with check (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can update own personalised automation policies" on public.personalised_automation_policies;
create policy "Admins can update own personalised automation policies"
  on public.personalised_automation_policies
  for update
  to authenticated
  using (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())))
  with check (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view own personalised automation policies" on public.personalised_automation_policies;
create policy "Admins can view own personalised automation policies"
  on public.personalised_automation_policies
  for select
  to authenticated
  using (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can delete own personalised generation runs" on public.personalised_generation_runs;
create policy "Admins can delete own personalised generation runs"
  on public.personalised_generation_runs
  for delete
  to authenticated
  using (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can insert own personalised generation runs" on public.personalised_generation_runs;
create policy "Admins can insert own personalised generation runs"
  on public.personalised_generation_runs
  for insert
  to authenticated
  with check (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can update own personalised generation runs" on public.personalised_generation_runs;
create policy "Admins can update own personalised generation runs"
  on public.personalised_generation_runs
  for update
  to authenticated
  using (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())))
  with check (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view own personalised generation runs" on public.personalised_generation_runs;
create policy "Admins can view own personalised generation runs"
  on public.personalised_generation_runs
  for select
  to authenticated
  using (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can insert own personalised automation policy events" on public.personalised_automation_policy_events;
create policy "Admins can insert own personalised automation policy events"
  on public.personalised_automation_policy_events
  for insert
  to authenticated
  with check (teacher_id = auth.uid() and actor_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view own personalised automation policy events" on public.personalised_automation_policy_events;
create policy "Admins can view own personalised automation policy events"
  on public.personalised_automation_policy_events
  for select
  to authenticated
  using (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view own personalised automation policy targets" on public.personalised_automation_policy_targets;
create policy "Admins can view own personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for select
  to authenticated
  using (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can view own personalised generation run pupils" on public.personalised_generation_run_pupils;
create policy "Admins can view own personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for select
  to authenticated
  using (teacher_id = auth.uid() and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id())));

drop policy if exists "Admins can delete owned personalised automation policy targets" on public.personalised_automation_policy_targets;
create policy "Admins can delete owned personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_automation_policy_targets.class_id
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, public.default_legacy_school_id()) = coalesce(personalised_automation_policy_targets.school_id, public.default_legacy_school_id())
    )
  );

drop policy if exists "Admins can insert owned personalised automation policy targets" on public.personalised_automation_policy_targets;
create policy "Admins can insert owned personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_automation_policy_targets.class_id
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, public.default_legacy_school_id()) = coalesce(personalised_automation_policy_targets.school_id, public.default_legacy_school_id())
    )
  );

drop policy if exists "Admins can update owned personalised automation policy targets" on public.personalised_automation_policy_targets;
create policy "Admins can update owned personalised automation policy targets"
  on public.personalised_automation_policy_targets
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_automation_policy_targets.class_id
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, public.default_legacy_school_id()) = coalesce(personalised_automation_policy_targets.school_id, public.default_legacy_school_id())
    )
  )
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_automation_policy_targets.class_id
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, public.default_legacy_school_id()) = coalesce(personalised_automation_policy_targets.school_id, public.default_legacy_school_id())
    )
  );

drop policy if exists "Admins can delete owned personalised generation run pupils" on public.personalised_generation_run_pupils;
create policy "Admins can delete owned personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_generation_run_pupils.class_id
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, public.default_legacy_school_id()) = coalesce(personalised_generation_run_pupils.school_id, public.default_legacy_school_id())
    )
  );

drop policy if exists "Admins can insert owned personalised generation run pupils" on public.personalised_generation_run_pupils;
create policy "Admins can insert owned personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_generation_run_pupils.class_id
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, public.default_legacy_school_id()) = coalesce(personalised_generation_run_pupils.school_id, public.default_legacy_school_id())
    )
  );

drop policy if exists "Admins can update owned personalised generation run pupils" on public.personalised_generation_run_pupils;
create policy "Admins can update owned personalised generation run pupils"
  on public.personalised_generation_run_pupils
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_generation_run_pupils.class_id
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, public.default_legacy_school_id()) = coalesce(personalised_generation_run_pupils.school_id, public.default_legacy_school_id())
    )
  )
  with check (
    teacher_id = auth.uid()
    and public.can_manage_automation(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.classes as c
      where c.id = personalised_generation_run_pupils.class_id
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, public.default_legacy_school_id()) = coalesce(personalised_generation_run_pupils.school_id, public.default_legacy_school_id())
    )
  );

drop policy if exists "Teachers can delete owned group comparison values" on public.teacher_pupil_group_values;
create policy "Teachers can delete owned group comparison values"
  on public.teacher_pupil_group_values
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.is_teacher_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.pupil_classes as pc
      join public.classes as c on c.id = pc.class_id
      where pc.pupil_id = teacher_pupil_group_values.pupil_id
        and pc.active is true
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, pc.school_id, public.default_legacy_school_id()) = coalesce(teacher_pupil_group_values.school_id, public.default_legacy_school_id())
    )
  );

drop policy if exists "Teachers can insert owned group comparison values" on public.teacher_pupil_group_values;
create policy "Teachers can insert owned group comparison values"
  on public.teacher_pupil_group_values
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.is_teacher_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.pupil_classes as pc
      join public.classes as c on c.id = pc.class_id
      where pc.pupil_id = teacher_pupil_group_values.pupil_id
        and pc.active is true
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, pc.school_id, public.default_legacy_school_id()) = coalesce(teacher_pupil_group_values.school_id, public.default_legacy_school_id())
    )
  );

drop policy if exists "Teachers can update owned group comparison values" on public.teacher_pupil_group_values;
create policy "Teachers can update owned group comparison values"
  on public.teacher_pupil_group_values
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.is_teacher_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.pupil_classes as pc
      join public.classes as c on c.id = pc.class_id
      where pc.pupil_id = teacher_pupil_group_values.pupil_id
        and pc.active is true
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, pc.school_id, public.default_legacy_school_id()) = coalesce(teacher_pupil_group_values.school_id, public.default_legacy_school_id())
    )
  )
  with check (
    teacher_id = auth.uid()
    and public.is_teacher_compat(auth.uid(), coalesce(school_id, public.default_legacy_school_id()))
    and exists (
      select 1
      from public.pupil_classes as pc
      join public.classes as c on c.id = pc.class_id
      where pc.pupil_id = teacher_pupil_group_values.pupil_id
        and pc.active is true
        and c.teacher_id = auth.uid()
        and coalesce(c.school_id, pc.school_id, public.default_legacy_school_id()) = coalesce(teacher_pupil_group_values.school_id, public.default_legacy_school_id())
    )
  );

commit;
