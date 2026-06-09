begin;

create or replace function public.phase3_staff_school_options(requested_user_id uuid)
returns table (
  id uuid,
  slug text,
  name text,
  is_legacy_default boolean
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with membership_schools as (
    select distinct
      s.id,
      s.slug,
      s.name,
      s.is_legacy_default
    from public.school_memberships as sm
    join public.schools as s
      on s.id = sm.school_id
    where requested_user_id is not null
      and sm.user_id = requested_user_id
      and sm.active is true
  ),
  legacy_fallback as (
    select
      s.id,
      s.slug,
      s.name,
      s.is_legacy_default
    from public.schools as s
    where requested_user_id is not null
      and s.id = public.default_legacy_school_id()
      and not exists (select 1 from membership_schools)
      and (
        public.user_has_staff_data(requested_user_id)
        or exists (
          select 1
          from public.staff_profiles as sp
          where sp.user_id = requested_user_id
        )
        or exists (
          select 1
          from public.staff_role_assignments as sra
          where sra.user_id = requested_user_id
            and sra.active is true
        )
        or exists (
          select 1
          from public.teacher_app_roles as tar
          where tar.teacher_id = requested_user_id
        )
      )
  )
  select option_rows.id, option_rows.slug, option_rows.name, option_rows.is_legacy_default
  from (
    select * from membership_schools
    union
    select * from legacy_fallback
  ) as option_rows
  order by option_rows.is_legacy_default desc, option_rows.name, option_rows.slug, option_rows.id;
$$;

alter function public.phase3_staff_school_options(uuid) owner to postgres;
revoke all on function public.phase3_staff_school_options(uuid) from public;
grant execute on function public.phase3_staff_school_options(uuid) to authenticated;
grant execute on function public.phase3_staff_school_options(uuid) to service_role;

create or replace function public.phase3_resolve_active_school_id(
  requested_user_id uuid,
  requested_school_id uuid default null
) returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  legacy_school_id uuid := public.default_legacy_school_id();
  option_count integer := 0;
  only_school_id uuid;
  resolved_school_id uuid;
begin
  if requested_user_id is null then
    return null;
  end if;

  if requested_school_id is not null
    and exists (
      select 1
      from public.phase3_staff_school_options(requested_user_id) as options
      where options.id = requested_school_id
    ) then
    return requested_school_id;
  end if;

  select count(*)
  into option_count
  from public.phase3_staff_school_options(requested_user_id) as options;

  if option_count = 1 then
    select options.id
    into only_school_id
    from public.phase3_staff_school_options(requested_user_id) as options
    order by options.name, options.slug, options.id
    limit 1;

    return only_school_id;
  end if;

  select options.id
  into resolved_school_id
  from public.phase3_staff_school_options(requested_user_id) as options
  where options.id = legacy_school_id
  limit 1;

  if resolved_school_id is not null then
    return resolved_school_id;
  end if;

  select options.id
  into resolved_school_id
  from public.phase3_staff_school_options(requested_user_id) as options
  order by options.name, options.slug, options.id
  limit 1;

  return resolved_school_id;
end;
$$;

alter function public.phase3_resolve_active_school_id(uuid, uuid) owner to postgres;
revoke all on function public.phase3_resolve_active_school_id(uuid, uuid) from public;
grant execute on function public.phase3_resolve_active_school_id(uuid, uuid) to authenticated;
grant execute on function public.phase3_resolve_active_school_id(uuid, uuid) to service_role;

create or replace function public.get_my_access_context(requested_school_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  current_user_id uuid := auth.uid();
  default_school_id uuid := public.default_legacy_school_id();
  active_school_id uuid := public.phase3_resolve_active_school_id(current_user_id, requested_school_id);
  legacy_role text := public.legacy_teacher_app_role(current_user_id, active_school_id);
  has_admin_role boolean := public.has_role('admin', current_user_id, active_school_id);
  has_teacher_role boolean := public.has_role('teacher', current_user_id, active_school_id);
  has_hoy_role boolean := public.has_role('hoy', current_user_id, active_school_id);
  has_hod_role boolean := public.has_role('hod', current_user_id, active_school_id);
  has_senco_role boolean := public.has_role('senco', current_user_id, active_school_id);
  has_literacy_lead_role boolean := public.has_role('literacy_lead', current_user_id, active_school_id);
  has_admin_compat boolean := public.is_admin_compat(current_user_id, active_school_id);
  has_teacher_compat boolean := public.is_teacher_compat(current_user_id, active_school_id);
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
  school_options jsonb := '[]'::jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', options.id,
        'slug', options.slug,
        'name', options.name,
        'is_legacy_default', options.is_legacy_default
      )
      order by options.is_legacy_default desc, options.name, options.slug, options.id
    ),
    '[]'::jsonb
  )
  into school_options
  from public.phase3_staff_school_options(current_user_id) as options;

  if current_user_id is not null and active_school_id is not null then
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
     and coalesce(sra.school_id, default_school_id) = active_school_id
    where ssa.user_id = current_user_id
      and ssa.active is true
      and coalesce(ssa.school_id, default_school_id) = active_school_id
      and public.phase2_user_has_school_membership(current_user_id, active_school_id);
  end if;

  if has_admin_compat and active_school_id is not null then
    admin_school_scope := true;
    school_scope := true;
    select count(*)
    into unmapped_subject_class_count
    from public.classes as c
    where c.class_type = 'subject'
      and nullif(btrim(coalesce(c.department_key, '')), '') is null
      and coalesce(c.school_id, default_school_id) = active_school_id
      and public.can_manage_roles(current_user_id, active_school_id);
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
    ),
    'active_school_id', active_school_id,
    'default_school_id', default_school_id,
    'schools', school_options
  );
end;
$$;

alter function public.get_my_access_context(uuid) owner to postgres;
revoke all on function public.get_my_access_context(uuid) from public;
grant execute on function public.get_my_access_context(uuid) to anon;
grant execute on function public.get_my_access_context(uuid) to authenticated;
grant execute on function public.get_my_access_context(uuid) to service_role;

create or replace function public.get_my_access_context()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.get_my_access_context(null::uuid);
$$;

alter function public.get_my_access_context() owner to postgres;
revoke all on function public.get_my_access_context() from public;
grant execute on function public.get_my_access_context() to anon;
grant execute on function public.get_my_access_context() to authenticated;
grant execute on function public.get_my_access_context() to service_role;

create or replace function public.upsert_my_staff_profile(
  requested_email text default null,
  requested_display_name text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_user_id uuid := auth.uid();
  target_school_id uuid;
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

  target_school_id := coalesce(
    public.phase3_resolve_active_school_id(actor_user_id, null),
    public.default_legacy_school_id()
  );

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
      school_id,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      actor_user_id,
      safe_email,
      safe_display_name,
      'self_service',
      target_school_id,
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
        school_id = coalesce(existing_profile.school_id, target_school_id),
        updated_at = timezone('utc', now())
    where id = existing_profile.id
    returning *
    into existing_profile;
  end if;

  if existing_profile.school_id is not null then
    perform public.phase2_ensure_school_membership(
      actor_user_id,
      existing_profile.school_id,
      'system'
    );
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

alter function public.upsert_my_staff_profile(text, text) owner to postgres;

commit;
