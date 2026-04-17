


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."activate_staff_pending_access_for_profile"("target_profile_id" "uuid", "target_user_id" "uuid", "signed_in_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."activate_staff_pending_access_for_profile"("target_profile_id" "uuid", "target_user_id" "uuid", "signed_in_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_staff_role_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "actor_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."apply_staff_role_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_staff_scope_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text", "actor_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."apply_staff_scope_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text", "actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."archive_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."archive_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authenticate_pupil"("requested_username" "text", "requested_pin" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."authenticate_pupil"("requested_username" "text", "requested_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bootstrap_first_admin"("target_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."bootstrap_first_admin"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."bootstrap_first_admin"("target_user_id" "uuid") IS 'If legacy central_owner backfill leaves zero active admins, run select public.bootstrap_first_admin(''<user_uuid>''); as the first admin user or from SQL editor.';



CREATE OR REPLACE FUNCTION "public"."build_pupil_import_row_message"("row_number" integer, "requested_first_name" "text" DEFAULT NULL::"text", "requested_surname" "text" DEFAULT NULL::"text", "message" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  safe_row_number integer := greatest(1, coalesce(row_number, 1));
  safe_first_name text := regexp_replace(btrim(coalesce(requested_first_name, '')), '\s+', ' ', 'g');
  safe_surname text := regexp_replace(btrim(coalesce(requested_surname, '')), '\s+', ' ', 'g');
  safe_message text := btrim(coalesce(message, ''));
  safe_name text := concat_ws(' ', safe_first_name, safe_surname);
  safe_prefix text;
begin
  if safe_name <> '' then
    safe_prefix := format('Row %s - %s:', safe_row_number, safe_name);
  else
    safe_prefix := format('Row %s:', safe_row_number);
  end if;

  if safe_message = '' then
    return safe_prefix;
  end if;

  return safe_prefix || ' ' || safe_message;
end;
$$;


ALTER FUNCTION "public"."build_pupil_import_row_message"("row_number" integer, "requested_first_name" "text", "requested_surname" "text", "message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_pupil_assignment_runtime"("requested_pupil_id" "uuid", "requested_assignment_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."can_access_pupil_assignment_runtime"("requested_pupil_id" "uuid", "requested_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_pupil_runtime"("requested_pupil_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.pupils as p
    where p.id = requested_pupil_id
      and p.is_active is true
      and p.archived_at is null
  );
$$;


ALTER FUNCTION "public"."can_access_pupil_runtime"("requested_pupil_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_import_csv"("requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_admin_compat(requested_user_id);
$$;


ALTER FUNCTION "public"."can_import_csv"("requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_automation"("requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_admin_compat(requested_user_id);
$$;


ALTER FUNCTION "public"."can_manage_automation"("requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_roles"("requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_admin_compat(requested_user_id);
$$;


ALTER FUNCTION "public"."can_manage_roles"("requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_assignment"("requested_assignment_id" "uuid", "requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.assignments_v2 as a
    where a.id = requested_assignment_id
      and public.can_view_class(a.class_id, requested_user_id)
  );
$$;


ALTER FUNCTION "public"."can_view_assignment"("requested_assignment_id" "uuid", "requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_class"("requested_class_id" "uuid", "requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."can_view_class"("requested_class_id" "uuid", "requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_pupil"("requested_pupil_id" "uuid", "requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.pupil_classes as pc
    where pc.pupil_id = requested_pupil_id
      and pc.active is true
      and public.can_view_class(pc.class_id, requested_user_id)
  );
$$;


ALTER FUNCTION "public"."can_view_pupil"("requested_pupil_id" "uuid", "requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_pupil_history"("requested_pupil_id" "uuid", "requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.pupil_classes as pc
    where pc.pupil_id = requested_pupil_id
      and public.can_view_class(pc.class_id, requested_user_id)
  );
$$;


ALTER FUNCTION "public"."can_view_pupil_history"("requested_pupil_id" "uuid", "requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_test"("requested_test_id" "uuid", "requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."can_view_test"("requested_test_id" "uuid", "requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_staff_pending_access_approval"("target_profile_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."cancel_staff_pending_access_approval"("target_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_assignment_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  checked_teacher_id uuid := coalesce(new.teacher_id, old.teacher_id);
  checked_class_id uuid := coalesce(new.class_id, old.class_id);
  checked_test_id uuid := coalesce(new.test_id, old.test_id);
  import_mode_enabled boolean := current_setting('app.pupil_import_mode', true) = 'on';
  baseline_provision_mode_enabled boolean := current_setting('app.baseline_provision_mode', true) = 'on';
  admin_import_enabled boolean := (import_mode_enabled or baseline_provision_mode_enabled) and public.can_import_csv(actor_user_id);
begin
  if actor_role in ('service_role', 'postgres') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if actor_user_id is null then
    raise exception 'Sign in is required before changing assignments.';
  end if;

  if not admin_import_enabled and not public.is_teacher_compat(actor_user_id) then
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


ALTER FUNCTION "public"."enforce_assignment_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_class_membership_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enforce_class_membership_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_legacy_teacher_app_role_lifecycle"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enforce_legacy_teacher_app_role_lifecycle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_policy"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.archived_at is null then
    perform public.raise_personalised_automation_policy_overlap(new.id);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_policy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_target"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.raise_personalised_automation_policy_overlap(coalesce(new.policy_id, old.policy_id));
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_target"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_staff_live_access_lifecycle"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enforce_staff_live_access_lifecycle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_teacher_content_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  import_mode_enabled boolean := current_setting('app.pupil_import_mode', true) = 'on';
  baseline_provision_mode_enabled boolean := current_setting('app.baseline_provision_mode', true) = 'on';
  admin_import_enabled boolean := (import_mode_enabled or baseline_provision_mode_enabled) and public.can_import_csv(actor_user_id);
begin
  if actor_role in ('service_role', 'postgres') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if actor_user_id is null then
    raise exception 'Sign in is required before changing teacher-owned content.';
  end if;

  if tg_table_name = 'pupils' then
    if not public.can_import_csv(actor_user_id) then
      raise exception 'Admin access is required before changing pupil records.';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if admin_import_enabled then
    if tg_table_name = 'classes' then
      if tg_op = 'INSERT' and new.teacher_id is distinct from actor_user_id then
        raise exception 'You can only create your own classes.';
      elsif tg_op = 'UPDATE' and (old.teacher_id is distinct from actor_user_id or new.teacher_id is distinct from actor_user_id) then
        raise exception 'You can only update your own classes.';
      elsif tg_op = 'DELETE' and old.teacher_id is distinct from actor_user_id then
        raise exception 'You can only delete your own classes.';
      end if;
      return case when tg_op = 'DELETE' then old else new end;
    elsif tg_table_name = 'tests' then
      if tg_op = 'INSERT' and new.teacher_id is distinct from actor_user_id then
        raise exception 'You can only create your own tests.';
      elsif tg_op = 'UPDATE' and (old.teacher_id is distinct from actor_user_id or new.teacher_id is distinct from actor_user_id) then
        raise exception 'You can only update your own tests.';
      elsif tg_op = 'DELETE' and old.teacher_id is distinct from actor_user_id then
        raise exception 'You can only delete your own tests.';
      end if;
      return case when tg_op = 'DELETE' then old else new end;
    end if;
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
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


ALTER FUNCTION "public"."enforce_teacher_content_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_form_class_baseline_assignment_internal"("requested_class_id" "uuid", "requested_standard_key" "text" DEFAULT 'core_v1'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_class public.classes%rowtype;
  safe_standard_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
  existing_assignment_id uuid;
  created_test_id uuid;
  created_assignment_id uuid;
  baseline_title text;
  segments_data_type text;
  choice_data_type text;
  tests_has_status_column boolean := false;
  tests_has_analytics_columns boolean := false;
  assignments_has_analytics_columns boolean := false;
begin
  if requested_class_id is null then
    return jsonb_build_object(
      'status', 'skipped',
      'created', false,
      'reason', 'missing_class_id'
    );
  end if;

  if safe_standard_key = '' then
    safe_standard_key := 'core_v1';
  end if;

  if safe_standard_key <> 'core_v1' then
    raise exception 'Standard baseline definition "%" is not available.', safe_standard_key;
  end if;

  perform set_config('app.baseline_provision_mode', 'on', true);

  select *
  into target_class
  from public.classes
  where id = requested_class_id
  limit 1;

  if target_class.id is null then
    raise exception 'Class "%" was not found.', requested_class_id;
  end if;

  if coalesce(nullif(lower(btrim(coalesce(target_class.class_type, ''))), ''), 'form') <> 'form' then
    return jsonb_build_object(
      'status', 'skipped',
      'created', false,
      'reason', 'non_form_class',
      'class_id', target_class.id
    );
  end if;

  if target_class.teacher_id is null then
    raise exception 'Class "%" does not have a teacher owner.', target_class.id;
  end if;

  perform pg_advisory_xact_lock(
    2147481200,
    hashtext(target_class.id::text || ':' || safe_standard_key)
  );

  select candidate.assignment_id
  into existing_assignment_id
  from (
    select
      a.id as assignment_id,
      a.created_at,
      bool_and(
        lower(btrim(coalesce(tw.choice ->> 'source', ''))) = 'baseline_v1'
        or lower(btrim(coalesce(tw.choice ->> 'baseline_v1', ''))) in ('true', '1', 'yes')
      ) as all_baseline_rows,
      bool_or(
        lower(regexp_replace(coalesce(tw.choice ->> 'baseline_standard_key', ''), '[^a-z0-9_-]+', '', 'g')) = safe_standard_key
      ) as has_required_standard
    from public.assignments_v2 as a
    inner join public.tests as t
      on t.id = a.test_id
    inner join public.test_words as tw
      on tw.test_id = t.id
    where a.class_id = target_class.id
    group by a.id, a.created_at
  ) as candidate
  where candidate.all_baseline_rows is true
    and candidate.has_required_standard is true
  order by candidate.created_at desc nulls last, candidate.assignment_id desc
  limit 1;

  if existing_assignment_id is not null then
    return jsonb_build_object(
      'status', 'existing',
      'created', false,
      'class_id', target_class.id,
      'assignment_id', existing_assignment_id,
      'standard_key', safe_standard_key
    );
  end if;

  select c.data_type
  into segments_data_type
  from information_schema.columns as c
  where c.table_schema = 'public'
    and c.table_name = 'test_words'
    and c.column_name = 'segments'
  limit 1;

  select c.data_type
  into choice_data_type
  from information_schema.columns as c
  where c.table_schema = 'public'
    and c.table_name = 'test_words'
    and c.column_name = 'choice'
  limit 1;

  select exists (
    select 1
    from information_schema.columns as c
    where c.table_schema = 'public'
      and c.table_name = 'tests'
      and c.column_name = 'status'
  )
  into tests_has_status_column;

  select exists (
    select 1
    from information_schema.columns as c
    where c.table_schema = 'public'
      and c.table_name = 'tests'
      and c.column_name = 'analytics_target_words_enabled'
  ) and exists (
    select 1
    from information_schema.columns as c
    where c.table_schema = 'public'
      and c.table_name = 'tests'
      and c.column_name = 'analytics_target_words_per_pupil'
  )
  into tests_has_analytics_columns;

  select exists (
    select 1
    from information_schema.columns as c
    where c.table_schema = 'public'
      and c.table_name = 'assignments_v2'
      and c.column_name = 'analytics_target_words_enabled'
  ) and exists (
    select 1
    from information_schema.columns as c
    where c.table_schema = 'public'
      and c.table_name = 'assignments_v2'
      and c.column_name = 'analytics_target_words_per_pupil'
  )
  into assignments_has_analytics_columns;

  baseline_title := format(
    'Baseline Test | %s | %s',
    coalesce(nullif(btrim(coalesce(target_class.name, '')), ''), 'Class'),
    to_char(timezone('utc', now()), 'YYYY-MM-DD')
  );

  if tests_has_status_column and tests_has_analytics_columns then
    insert into public.tests (
      teacher_id,
      title,
      status,
      question_type,
      analytics_target_words_enabled,
      analytics_target_words_per_pupil
    )
    values (
      target_class.teacher_id,
      baseline_title,
      'published',
      'segmented_spelling',
      false,
      0
    )
    returning id
    into created_test_id;
  elsif tests_has_status_column then
    insert into public.tests (
      teacher_id,
      title,
      status,
      question_type
    )
    values (
      target_class.teacher_id,
      baseline_title,
      'published',
      'segmented_spelling'
    )
    returning id
    into created_test_id;
  elsif tests_has_analytics_columns then
    insert into public.tests (
      teacher_id,
      title,
      question_type,
      analytics_target_words_enabled,
      analytics_target_words_per_pupil
    )
    values (
      target_class.teacher_id,
      baseline_title,
      'segmented_spelling',
      false,
      0
    )
    returning id
    into created_test_id;
  else
    insert into public.tests (
      teacher_id,
      title,
      question_type
    )
    values (
      target_class.teacher_id,
      baseline_title,
      'segmented_spelling'
    )
    returning id
    into created_test_id;
  end if;

  if coalesce(segments_data_type, '') in ('json', 'jsonb') then
    if coalesce(choice_data_type, '') = 'json' then
      insert into public.test_words (
        test_id,
        position,
        word,
        sentence,
        segments,
        choice
      )
      select
        created_test_id,
        prepared.word_position,
        prepared.word,
        null,
        array_to_json(prepared.segments)::json,
        prepared.choice_payload::json
      from (
        select
          item.word_position,
          item.word,
          item.segments,
          jsonb_strip_nulls(
            jsonb_build_object(
              'focus_graphemes',
                case
                  when nullif(btrim(coalesce(item.focus_grapheme, '')), '') is not null
                    then jsonb_build_array(item.focus_grapheme)
                  else null
                end,
              'source', 'baseline_v1',
              'question_type', item.question_type,
              'max_attempts', 1,
              'baseline_v1', true,
              'baseline_stage', item.stage,
              'baseline_role', 'placement',
              'baseline_signal', item.signal,
              'baseline_preset', item.preset,
              'baseline_standard_key', safe_standard_key,
              'visual_aids_mode',
                case
                  when item.question_type = 'segmented_spelling' then 'none'
                  else null
                end
            )
          ) as choice_payload
        from public.list_standard_baseline_items(safe_standard_key) as item
      ) as prepared
      order by prepared.word_position;
    else
      insert into public.test_words (
        test_id,
        position,
        word,
        sentence,
        segments,
        choice
      )
      select
        created_test_id,
        prepared.word_position,
        prepared.word,
        null,
        array_to_json(prepared.segments)::jsonb,
        prepared.choice_payload
      from (
        select
          item.word_position,
          item.word,
          item.segments,
          jsonb_strip_nulls(
            jsonb_build_object(
              'focus_graphemes',
                case
                  when nullif(btrim(coalesce(item.focus_grapheme, '')), '') is not null
                    then jsonb_build_array(item.focus_grapheme)
                  else null
                end,
              'source', 'baseline_v1',
              'question_type', item.question_type,
              'max_attempts', 1,
              'baseline_v1', true,
              'baseline_stage', item.stage,
              'baseline_role', 'placement',
              'baseline_signal', item.signal,
              'baseline_preset', item.preset,
              'baseline_standard_key', safe_standard_key,
              'visual_aids_mode',
                case
                  when item.question_type = 'segmented_spelling' then 'none'
                  else null
                end
            )
          ) as choice_payload
        from public.list_standard_baseline_items(safe_standard_key) as item
      ) as prepared
      order by prepared.word_position;
    end if;
  else
    if coalesce(choice_data_type, '') = 'json' then
      insert into public.test_words (
        test_id,
        position,
        word,
        sentence,
        segments,
        choice
      )
      select
        created_test_id,
        prepared.word_position,
        prepared.word,
        null,
        prepared.segments,
        prepared.choice_payload::json
      from (
        select
          item.word_position,
          item.word,
          item.segments,
          jsonb_strip_nulls(
            jsonb_build_object(
              'focus_graphemes',
                case
                  when nullif(btrim(coalesce(item.focus_grapheme, '')), '') is not null
                    then jsonb_build_array(item.focus_grapheme)
                  else null
                end,
              'source', 'baseline_v1',
              'question_type', item.question_type,
              'max_attempts', 1,
              'baseline_v1', true,
              'baseline_stage', item.stage,
              'baseline_role', 'placement',
              'baseline_signal', item.signal,
              'baseline_preset', item.preset,
              'baseline_standard_key', safe_standard_key,
              'visual_aids_mode',
                case
                  when item.question_type = 'segmented_spelling' then 'none'
                  else null
                end
            )
          ) as choice_payload
        from public.list_standard_baseline_items(safe_standard_key) as item
      ) as prepared
      order by prepared.word_position;
    else
      insert into public.test_words (
        test_id,
        position,
        word,
        sentence,
        segments,
        choice
      )
      select
        created_test_id,
        prepared.word_position,
        prepared.word,
        null,
        prepared.segments,
        prepared.choice_payload
      from (
        select
          item.word_position,
          item.word,
          item.segments,
          jsonb_strip_nulls(
            jsonb_build_object(
              'focus_graphemes',
                case
                  when nullif(btrim(coalesce(item.focus_grapheme, '')), '') is not null
                    then jsonb_build_array(item.focus_grapheme)
                  else null
                end,
              'source', 'baseline_v1',
              'question_type', item.question_type,
              'max_attempts', 1,
              'baseline_v1', true,
              'baseline_stage', item.stage,
              'baseline_role', 'placement',
              'baseline_signal', item.signal,
              'baseline_preset', item.preset,
              'baseline_standard_key', safe_standard_key,
              'visual_aids_mode',
                case
                  when item.question_type = 'segmented_spelling' then 'none'
                  else null
                end
            )
          ) as choice_payload
        from public.list_standard_baseline_items(safe_standard_key) as item
      ) as prepared
      order by prepared.word_position;
    end if;
  end if;

  if assignments_has_analytics_columns then
    insert into public.assignments_v2 (
      teacher_id,
      test_id,
      class_id,
      mode,
      max_attempts,
      audio_enabled,
      hints_enabled,
      end_at,
      analytics_target_words_enabled,
      analytics_target_words_per_pupil
    )
    values (
      target_class.teacher_id,
      created_test_id,
      target_class.id,
      'test',
      null,
      true,
      false,
      null,
      false,
      0
    )
    returning id
    into created_assignment_id;
  else
    insert into public.assignments_v2 (
      teacher_id,
      test_id,
      class_id,
      mode,
      max_attempts,
      audio_enabled,
      hints_enabled,
      end_at
    )
    values (
      target_class.teacher_id,
      created_test_id,
      target_class.id,
      'test',
      null,
      true,
      false,
      null
    )
    returning id
    into created_assignment_id;
  end if;

  return jsonb_build_object(
    'status', 'created',
    'created', true,
    'class_id', target_class.id,
    'assignment_id', created_assignment_id,
    'test_id', created_test_id,
    'standard_key', safe_standard_key
  );
end;
$$;


ALTER FUNCTION "public"."ensure_form_class_baseline_assignment_internal"("requested_class_id" "uuid", "requested_standard_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_form_class_baseline_assignments"("requested_class_ids" "uuid"[], "requested_standard_key" "text" DEFAULT 'core_v1'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_user_id uuid := auth.uid();
  safe_class_ids uuid[] := coalesce(requested_class_ids, array[]::uuid[]);
  requested_class_id uuid;
  helper_result jsonb;
  result_rows jsonb := '[]'::jsonb;
  created_count integer := 0;
  existing_count integer := 0;
  skipped_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before provisioning baseline assignments.';
  end if;

  if not public.is_teacher_compat(actor_user_id) and not public.can_import_csv(actor_user_id) then
    raise exception 'Teacher or admin access is required before provisioning baseline assignments.';
  end if;

  perform set_config('app.baseline_provision_mode', 'on', true);

  foreach requested_class_id in array safe_class_ids loop
    if requested_class_id is null then
      continue;
    end if;

    if not exists (
      select 1
      from public.classes as c
      where c.id = requested_class_id
        and (
          c.teacher_id = actor_user_id
          or public.is_admin_compat(actor_user_id)
        )
    ) then
      raise exception 'You can only manage baseline assignments for your own classes.';
    end if;

    helper_result := public.ensure_form_class_baseline_assignment_internal(
      requested_class_id,
      requested_standard_key
    );

    case coalesce(helper_result ->> 'status', '')
      when 'created' then
        created_count := created_count + 1;
      when 'existing' then
        existing_count := existing_count + 1;
      else
        skipped_count := skipped_count + 1;
    end case;

    result_rows := result_rows || jsonb_build_array(helper_result);
  end loop;

  return jsonb_build_object(
    'rows', result_rows,
    'requested_count', coalesce(array_length(safe_class_ids, 1), 0),
    'created_count', created_count,
    'existing_count', existing_count,
    'skipped_count', skipped_count
  );
end;
$$;


ALTER FUNCTION "public"."ensure_form_class_baseline_assignments"("requested_class_ids" "uuid"[], "requested_standard_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_pupil_import_join_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code_value text := '';
  char_index integer;
begin
  for char_index in 1..6 loop
    code_value := code_value || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return code_value;
end;
$$;


ALTER FUNCTION "public"."generate_pupil_import_join_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_pupil_import_pin"() RETURNS "text"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select lpad((floor(random() * 10000)::integer)::text, 4, '0');
$$;


ALTER FUNCTION "public"."generate_pupil_import_pin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_pupil_import_username"("requested_first_name" "text" DEFAULT NULL::"text", "requested_surname" "text" DEFAULT NULL::"text", "requested_mis_id" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  base_first text := regexp_replace(lower(coalesce(requested_first_name, '')), '[^a-z0-9]+', '', 'g');
  base_surname text := regexp_replace(lower(coalesce(requested_surname, '')), '[^a-z0-9]+', '', 'g');
  base_mis_id text := regexp_replace(lower(coalesce(requested_mis_id, '')), '[^a-z0-9]+', '', 'g');
  candidate_base text;
  candidate text;
  suffix_counter integer := 0;
begin
  candidate_base := left(
    concat(
      coalesce(nullif(left(base_first, 1), ''), 'p'),
      coalesce(nullif(base_surname, ''), 'upil'),
      coalesce(nullif(right(base_mis_id, 4), ''), '')
    ),
    24
  );

  if candidate_base = '' then
    candidate_base := 'pupil';
  end if;

  candidate := candidate_base;

  while exists (
    select 1
    from public.pupils
    where public.normalize_pupil_import_lookup_text(username) = candidate
  ) loop
    suffix_counter := suffix_counter + 1;
    candidate := left(candidate_base, greatest(1, 24 - length(suffix_counter::text))) || suffix_counter::text;
  end loop;

  return candidate;
end;
$$;


ALTER FUNCTION "public"."generate_pupil_import_username"("requested_first_name" "text", "requested_surname" "text", "requested_mis_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_access_context"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_my_access_context"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_access_context"() IS 'Stable version 2 frontend access-context payload for additive roles, capability gating, and scoped reads.';



CREATE OR REPLACE FUNCTION "public"."get_staff_profile_duplicate_conflicts"("target_profile_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_staff_profile_duplicate_conflicts"("target_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_staff_role"("target_user_id" "uuid", "requested_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."grant_staff_role"("target_user_id" "uuid", "requested_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."grant_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("requested_role" "text", "requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.staff_role_assignments as sra
    where sra.user_id = requested_user_id
      and sra.active is true
      and sra.role = lower(btrim(requested_role))
  );
$$;


ALTER FUNCTION "public"."has_role"("requested_role" "text", "requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_scope"("requested_scope_type" "text", "requested_scope_value" "text", "requested_role" "text" DEFAULT NULL::"text", "requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."has_scope"("requested_scope_type" "text", "requested_scope_value" "text", "requested_role" "text", "requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_pupil_roster_csv"("import_rows" "jsonb" DEFAULT '[]'::"jsonb", "import_file_name" "text" DEFAULT NULL::"text", "preview_summary" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_user_id uuid := auth.uid();
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

  if not public.can_import_csv(actor_user_id) then
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
    v_skipped_count,
    v_warning_count,
    v_error_count,
    jsonb_build_object(
      'source', 'csv_import',
      'preview_summary', safe_preview_summary
    ),
    timezone('utc', now())
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
      where public.normalize_pupil_import_lookup_text(mis_id) = normalized_mis_id;

      if matched_pupil_count > 1 then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('more than one pupil already uses MIS ID "%s". Review pupil records before importing.', safe_mis_id));
        raise exception '%', v_row_error_message;
      end if;

      if matched_pupil_count = 1 then
        select *
        into matched_pupil
        from public.pupils
        where public.normalize_pupil_import_lookup_text(mis_id) = normalized_mis_id
        limit 1;
      end if;

      select count(*)
      into exact_class_count
      from public.classes
      where public.normalize_pupil_import_lookup_text(name) = normalized_form_class;

      select count(*)
      into form_class_count
      from public.classes
      where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
        and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form';

      if normalized_year_group <> '' then
        select count(*)
        into exact_pair_count
        from public.classes
        where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
          and public.normalize_pupil_import_lookup_text(year_group) = normalized_year_group;

        select count(*)
        into form_pair_count
        from public.classes
        where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
          and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
          and public.normalize_pupil_import_lookup_text(year_group) = normalized_year_group;

        if form_pair_count = 1 then
          select *
          into target_class
          from public.classes
          where public.normalize_pupil_import_lookup_text(name) = normalized_form_class
            and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
            and public.normalize_pupil_import_lookup_text(year_group) = normalized_year_group
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
        and public.normalize_pupil_import_lookup_text(year_group) = planned_form_class.normalized_year_group;

      if form_pair_count = 1 then
        select *
        into target_class
        from public.classes
        where public.normalize_pupil_import_lookup_text(name) = planned_form_class.normalized_form_class
          and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
          and public.normalize_pupil_import_lookup_text(year_group) = planned_form_class.normalized_year_group
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
          and public.normalize_pupil_import_lookup_text(year_group) = planned_form_class.normalized_year_group;

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
              class_type
            )
            values (
              gen_random_uuid(),
              actor_user_id,
              planned_form_class.form_class,
              public.generate_pupil_import_join_code(),
              planned_form_class.year_group,
              'form'
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
                and public.normalize_pupil_import_lookup_text(year_group) = planned_form_class.normalized_year_group;

              if form_pair_count = 1 then
                select *
                into target_class
                from public.classes
                where public.normalize_pupil_import_lookup_text(name) = planned_form_class.normalized_form_class
                  and coalesce(nullif(lower(btrim(class_type)), ''), 'form') = 'form'
                  and public.normalize_pupil_import_lookup_text(year_group) = planned_form_class.normalized_year_group
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
      where public.normalize_pupil_import_lookup_text(mis_id) = normalized_mis_id;

      if matched_pupil_count > 1 then
        v_row_error_message := public.build_pupil_import_row_message(safe_row_number, safe_first_name, safe_surname, format('more than one pupil already uses MIS ID "%s". Review pupil records before importing.', safe_mis_id));
        raise exception '%', v_row_error_message;
      end if;

      if matched_pupil_count = 1 then
        select *
        into matched_pupil
        from public.pupils
        where public.normalize_pupil_import_lookup_text(mis_id) = normalized_mis_id
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
          last_imported_by
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
          actor_user_id
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
        and coalesce(nullif(lower(btrim(c.class_type)), ''), 'form') = 'form';

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
          and coalesce(nullif(lower(btrim(c.class_type)), ''), 'form') = 'form';
      end if;

      select *
      into target_membership
      from public.pupil_classes
      where pupil_id = working_pupil.id
        and class_id = target_class.id
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
          last_imported_by
        )
        values (
          working_pupil.id,
          target_class.id,
          true,
          safe_membership_metadata || jsonb_build_object('action', case when other_active_form_count > 0 then 'replace_form' else 'upsert_form_membership' end),
          batch_id,
          row_now,
          actor_user_id
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


ALTER FUNCTION "public"."import_pupil_roster_csv"("import_rows" "jsonb", "import_file_name" "text", "preview_summary" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_staff_directory_csv"("import_rows" "jsonb" DEFAULT '[]'::"jsonb", "import_file_name" "text" DEFAULT NULL::"text", "preview_summary" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."import_staff_directory_csv"("import_rows" "jsonb", "import_file_name" "text", "preview_summary" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invalidate_staff_pending_approvals_for_profile"("target_profile_id" "uuid", "failure_reason" "text", "actor_user_id" "uuid" DEFAULT NULL::"uuid", "event_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."invalidate_staff_pending_approvals_for_profile"("target_profile_id" "uuid", "failure_reason" "text", "actor_user_id" "uuid", "event_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_compat"("requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    requested_user_id is not null
    and (
      public.has_role('admin', requested_user_id)
      or public.legacy_teacher_app_role(requested_user_id) = 'central_owner'
    ),
    false
  );
$$;


ALTER FUNCTION "public"."is_admin_compat"("requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_central_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_admin_compat(auth.uid());
$$;


ALTER FUNCTION "public"."is_central_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_teacher_compat"("requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    requested_user_id is not null
    and (
      public.has_role('teacher', requested_user_id)
      or public.legacy_teacher_app_role(requested_user_id) = 'teacher'
    ),
    false
  );
$$;


ALTER FUNCTION "public"."is_teacher_compat"("requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."legacy_teacher_app_role"("requested_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."legacy_teacher_app_role"("requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_staff_pending_access_summaries"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."list_staff_pending_access_summaries"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_standard_baseline_items"("requested_standard_key" "text" DEFAULT 'core_v1'::"text") RETURNS TABLE("word_position" integer, "word" "text", "segments" "text"[], "question_type" "text", "stage" "text", "signal" "text", "focus_grapheme" "text", "preset" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  safe_standard_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
begin
  if safe_standard_key = '' then
    safe_standard_key := 'core_v1';
  end if;

  if safe_standard_key <> 'core_v1' then
    raise exception 'Standard baseline definition "%" is not available.', safe_standard_key;
  end if;

  return query
  values
    (1,  'train',  array['t','r','ai','n']::text[],     'segmented_spelling',            'broad_sweep',      'independent', 'ai',   'core'),
    (2,  'seed',   array['s','ee','d']::text[],         'segmented_spelling',            'broad_sweep',      'independent', 'ee',   'core'),
    (3,  'boat',   array['b','oa','t']::text[],         'segmented_spelling',            'broad_sweep',      'independent', 'oa',   'core'),
    (4,  'light',  array['l','igh','t']::text[],        'segmented_spelling',            'broad_sweep',      'independent', 'igh',  'core'),
    (5,  'sharp',  array['sh','ar','p']::text[],        'segmented_spelling',            'broad_sweep',      'independent', 'ar',   'core'),
    (6,  'storm',  array['s','t','or','m']::text[],     'segmented_spelling',            'broad_sweep',      'independent', 'or',   'core'),
    (7,  'turn',   array['t','ur','n']::text[],         'segmented_spelling',            'placement_confirm', 'independent', 'ur',   'core'),
    (8,  'cloud',  array['c','l','ow','d']::text[],     'segmented_spelling',            'placement_confirm', 'independent', 'ow',   'core'),
    (9,  'play',   array['p','l','ay']::text[],         'segmented_spelling',            'placement_confirm', 'independent', 'ay',   'core'),
    (10, 'beach',  array['b','ea','ch']::text[],        'segmented_spelling',            'placement_confirm', 'independent', 'ea',   'core'),
    (11, 'coin',   array['c','oi','n']::text[],         'segmented_spelling',            'placement_confirm', 'independent', 'oi',   'core'),
    (12, 'chair',  array['ch','air']::text[],           'segmented_spelling',            'placement_confirm', 'independent', 'air',  'core'),
    (13, 'paint',  array['p','ai','n','t']::text[],     'multiple_choice_grapheme_picker','diagnostic_check', 'diagnostic',  'ai',   'core'),
    (14, 'point',  array['p','oi','n','t']::text[],     'multiple_choice_grapheme_picker','diagnostic_check', 'diagnostic',  'oi',   'core'),
    (15, 'fair',   array['f','air']::text[],            'focus_sound',                   'diagnostic_check', 'diagnostic',  'air',  'core'),
    (16, 'nurse',  array['n','ur','s','e']::text[],     'focus_sound',                   'diagnostic_check', 'diagnostic',  'ur',   'core');
end;
$$;


ALTER FUNCTION "public"."list_standard_baseline_items"("requested_standard_key" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "join_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "year_group" "text",
    "class_type" "text" DEFAULT 'subject'::"text" NOT NULL,
    "department_key" "text",
    CONSTRAINT "classes_class_type_check" CHECK (("class_type" = ANY (ARRAY['form'::"text", 'subject'::"text", 'intervention'::"text"])))
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."classes"."department_key" IS 'Manual department mapping for HOD scope. Leave null until subject classes are explicitly mapped.';



CREATE OR REPLACE FUNCTION "public"."list_unmapped_department_classes"() RETURNS SETOF "public"."classes"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."list_unmapped_department_classes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_viewable_class_ids"("requested_user_id" "uuid", "requested_class_id" "uuid" DEFAULT NULL::"uuid", "requested_year_group" "text" DEFAULT NULL::"text", "requested_department_key" "text" DEFAULT NULL::"text") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."list_viewable_class_ids"("requested_user_id" "uuid", "requested_class_id" "uuid", "requested_year_group" "text", "requested_department_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_pupil_directory_event"("actor_user_id" "uuid", "target_pupil_id" "uuid", "event_action" "text" DEFAULT NULL::"text", "event_reason" "text" DEFAULT NULL::"text", "event_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."log_pupil_directory_event"("actor_user_id" "uuid", "target_pupil_id" "uuid", "event_action" "text", "event_reason" "text", "event_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_staff_access_event"("actor_user_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_role" "text" DEFAULT NULL::"text", "event_scope_type" "text" DEFAULT NULL::"text", "event_scope_value" "text" DEFAULT NULL::"text", "event_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."log_staff_access_event"("actor_user_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_role" "text", "event_scope_type" "text", "event_scope_value" "text", "event_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_staff_directory_event"("actor_user_id" "uuid", "target_profile_id" "uuid" DEFAULT NULL::"uuid", "target_user_id" "uuid" DEFAULT NULL::"uuid", "event_action" "text" DEFAULT NULL::"text", "event_reason" "text" DEFAULT NULL::"text", "event_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."log_staff_directory_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_reason" "text", "event_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_staff_pending_access_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_approval_id" "uuid", "event_action" "text", "event_message" "text" DEFAULT NULL::"text", "event_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."log_staff_pending_access_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_approval_id" "uuid", "event_action" "text", "event_message" "text", "event_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_pupil_form_membership"("target_pupil_id" "uuid", "target_form_class_id" "uuid", "requested_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."move_pupil_form_membership"("target_pupil_id" "uuid", "target_form_class_id" "uuid", "requested_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_pupil_import_group_value"("requested_group_type" "text" DEFAULT NULL::"text", "input_value" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $_$
declare
  safe_group_type text := lower(btrim(coalesce(requested_group_type, '')));
  safe_value text := regexp_replace(
    regexp_replace(
      lower(btrim(coalesce(input_value, ''))),
      '[‐‑‒–—―−]+',
      '-',
      'g'
    ),
    '[\s-]+',
    '_',
    'g'
  );
begin
  safe_value := regexp_replace(safe_value, '^_+|_+$', '', 'g');

  if safe_value = '' then
    return null;
  end if;

  if safe_group_type = 'pp' then
    if safe_value in ('1', 'true', 'yes', 'y', 'pp', 'pupil_premium') then
      return 'pp';
    end if;
    if safe_value in ('0', 'false', 'no', 'n', 'non_pp', 'not_pp') then
      return 'non_pp';
    end if;
    return null;
  end if;

  if safe_group_type = 'sen' then
    if safe_value in ('ehcp', 'education_health_care_plan', 'ehc_plan') then
      return 'ehcp';
    end if;
    if safe_value in ('sen_support', 'support') then
      return 'sen_support';
    end if;
    if safe_value in ('sen', 'send', 'true', 'yes', '1') then
      return 'sen';
    end if;
    if safe_value in ('none') then
      return 'none';
    end if;
    if safe_value in ('non_sen', 'not_sen', 'no_sen', 'false', 'no', '0') then
      return 'non_sen';
    end if;
    return null;
  end if;

  if safe_group_type = 'gender' then
    if safe_value in ('female', 'f', 'girl', 'girls') then
      return 'female';
    end if;
    if safe_value in ('male', 'm', 'boy', 'boys') then
      return 'male';
    end if;
    if safe_value in ('non_binary', 'nonbinary', 'nb') then
      return 'non_binary';
    end if;
    if safe_value in ('other') then
      return 'other';
    end if;
    return null;
  end if;

  return null;
end;
$_$;


ALTER FUNCTION "public"."normalize_pupil_import_group_value"("requested_group_type" "text", "input_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_pupil_import_lookup_text"("input_value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select lower(
    regexp_replace(
      btrim(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            replace(
                              replace(
                                replace(
                                  replace(
                                    replace(coalesce(input_value, ''), U&'\00A0', ' '),
                                    U&'\202F',
                                    ' '
                                  ),
                                  U&'\2007',
                                  ' '
                                ),
                                U&'\FEFF',
                                ''
                              ),
                              U&'\200B',
                              ''
                            ),
                            U&'\200C',
                            ''
                          ),
                          U&'\200D',
                          ''
                        ),
                        U&'\2010',
                        '-'
                      ),
                      U&'\2011',
                      '-'
                    ),
                    U&'\2012',
                    '-'
                  ),
                  U&'\2013',
                  '-'
                ),
                U&'\2014',
                '-'
              ),
              U&'\2015',
              '-'
            ),
            U&'\2212',
            '-'
          ),
          U&'\2019',
          ''''
        )
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;


ALTER FUNCTION "public"."normalize_pupil_import_lookup_text"("input_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_staff_scope_input"("requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."normalize_staff_scope_input"("requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pupil_directory_duplicate_preflight"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_user_id uuid := auth.uid();
  mis_id_conflicts jsonb := '[]'::jsonb;
  username_conflicts jsonb := '[]'::jsonb;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before reviewing pupil import data.';
  end if;

  if not public.can_import_csv(actor_user_id) then
    raise exception 'Admin access is required before reviewing pupil import data.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', 'mis_id',
        'value', conflict_value,
        'conflict_count', conflict_count,
        'message', format('MIS ID "%s" is used by %s pupil records. Review pupil records before importing.', conflict_value, conflict_count),
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
      ) as conflicting_pupils
    from (
      select
        public.normalize_pupil_import_lookup_text(mis_id) as normalized_value,
        min(btrim(mis_id)) as conflict_value,
        count(*)::integer as conflict_count
      from public.pupils
      where mis_id is not null and btrim(mis_id) <> ''
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
        'message', format('Username "%s" is used by %s pupil records. Review pupil records before uniqueness hardening.', conflict_value, conflict_count),
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
      ) as conflicting_pupils
    from (
      select
        public.normalize_pupil_import_lookup_text(username) as normalized_value,
        min(lower(btrim(username))) as conflict_value,
        count(*)::integer as conflict_count
      from public.pupils
      where username is not null and btrim(username) <> ''
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


ALTER FUNCTION "public"."pupil_directory_duplicate_preflight"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."raise_personalised_automation_policy_overlap"("p_policy_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  conflict_group_names text;
  conflict_policy_names text;
begin
  select
    string_agg(
      distinct coalesce(nullif(trim(c.name), ''), 'Untitled group'),
      ', '
      order by coalesce(nullif(trim(c.name), ''), 'Untitled group')
    ),
    string_agg(
      distinct coalesce(nullif(trim(other_policy.name), ''), 'Untitled policy'),
      ', '
      order by coalesce(nullif(trim(other_policy.name), ''), 'Untitled policy')
    )
  into conflict_group_names, conflict_policy_names
  from public.personalised_automation_policies policy
  join public.personalised_automation_policy_targets targets
    on targets.policy_id = policy.id
  join public.personalised_automation_policy_targets other_targets
    on other_targets.class_id = targets.class_id
   and other_targets.policy_id <> targets.policy_id
  join public.personalised_automation_policies other_policy
    on other_policy.id = other_targets.policy_id
  join public.classes c
    on c.id = targets.class_id
  where policy.id = p_policy_id
    and policy.archived_at is null
    and other_policy.teacher_id = policy.teacher_id
    and other_policy.archived_at is null
    and daterange(policy.start_date, coalesce(policy.end_date, 'infinity'::date), '[]')
      && daterange(other_policy.start_date, coalesce(other_policy.end_date, 'infinity'::date), '[]');

  if conflict_group_names is not null then
    raise exception 'These target groups are already used by another automation policy in an overlapping date window: %.', conflict_group_names
      using errcode = '23514',
            detail = case
              when conflict_policy_names is not null
                then format('Conflicting policy names: %s', conflict_policy_names)
              else null
            end,
            hint = 'Adjust the dates, archive the other policy, or change the target groups.';
  end if;
end;
$$;


ALTER FUNCTION "public"."raise_personalised_automation_policy_overlap"("p_policy_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text" DEFAULT 'core_v1'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  safe_required_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
  active_class_ids uuid[] := array[]::uuid[];
  active_form_class_ids uuid[] := array[]::uuid[];
  selected_assignment_id uuid := null;
  selected_assignment_payload jsonb := null;
begin
  if safe_required_key = '' then
    safe_required_key := 'core_v1';
  end if;

  if requested_pupil_id is null or not public.can_access_pupil_runtime(requested_pupil_id) then
    return jsonb_build_object(
      'status', 'waiting',
      'waiting_reason', 'runtime_inactive',
      'assignment_id', null,
      'required_standard_key', safe_required_key,
      'class_ids', '[]'::jsonb,
      'form_class_ids', '[]'::jsonb,
      'assignment', null
    );
  end if;

  select
    coalesce(array_agg(distinct pc.class_id), array[]::uuid[]),
    coalesce(
      array_agg(distinct pc.class_id) filter (
        where c.id is not null
          and lower(btrim(coalesce(c.class_type, ''))) in ('', 'form')
      ),
      array[]::uuid[]
    )
  into active_class_ids, active_form_class_ids
  from public.pupil_classes as pc
  left join public.classes as c
    on c.id = pc.class_id
  where pc.pupil_id = requested_pupil_id
    and pc.active is true;

  if coalesce(array_length(active_form_class_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'status', 'waiting',
      'waiting_reason', 'no_active_form_membership',
      'assignment_id', null,
      'required_standard_key', safe_required_key,
      'class_ids', to_jsonb(active_class_ids),
      'form_class_ids', to_jsonb(active_form_class_ids),
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
      'waiting_reason', null,
      'assignment_id', null,
      'completed_assignment_id', selected_assignment_id,
      'required_standard_key', safe_required_key,
      'class_ids', to_jsonb(active_class_ids),
      'form_class_ids', to_jsonb(active_form_class_ids),
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
      'waiting_reason', null,
      'assignment_id', selected_assignment_id,
      'required_standard_key', safe_required_key,
      'class_ids', to_jsonb(active_class_ids),
      'form_class_ids', to_jsonb(active_form_class_ids),
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
      'waiting_reason', null,
      'assignment_id', selected_assignment_id,
      'required_standard_key', safe_required_key,
      'class_ids', to_jsonb(active_class_ids),
      'form_class_ids', to_jsonb(active_form_class_ids),
      'assignment', selected_assignment_payload
    );
  end if;

  return jsonb_build_object(
    'status', 'waiting',
    'waiting_reason', 'no_baseline_assignment',
    'assignment_id', null,
    'required_standard_key', safe_required_key,
    'class_ids', to_jsonb(active_class_ids),
    'form_class_ids', to_jsonb(active_form_class_ids),
    'assignment', null
  );
end;
$$;


ALTER FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."read_staff_pending_access_detail"("target_profile_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."read_staff_pending_access_detail"("target_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_pupil_login_pin"("target_pupil_id" "uuid", "requested_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_user_id uuid := auth.uid();
  pupil_row public.pupils%rowtype;
  safe_reason text := nullif(btrim(coalesce(requested_reason, '')), '');
  issued_at timestamptz := timezone('utc', now());
  issued_pin text;
  display_name text;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before resetting a pupil PIN.';
  end if;

  if not public.can_import_csv(actor_user_id) then
    raise exception 'Admin access is required before resetting a pupil PIN.';
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

  if pupil_row.archived_at is not null then
    raise exception 'Restore this pupil before resetting their PIN.';
  end if;

  if pupil_row.is_active is not true then
    raise exception 'Only active pupils can have a PIN reset in this phase.';
  end if;

  if nullif(btrim(coalesce(pupil_row.username, '')), '') is null then
    raise exception 'This pupil does not have a username to reissue access.';
  end if;

  issued_pin := public.generate_pupil_import_pin();

  update public.pupils
  set pin = issued_pin
  where id = target_pupil_id
  returning *
  into pupil_row;

  display_name := nullif(btrim(concat_ws(' ', pupil_row.first_name, pupil_row.surname)), '');

  perform public.log_pupil_directory_event(
    actor_user_id,
    target_pupil_id,
    'reset_pin',
    safe_reason,
    jsonb_build_object(
      'username', lower(btrim(coalesce(pupil_row.username, ''))),
      'issued_at', issued_at
    )
  );

  return jsonb_build_object(
    'pupil_id', pupil_row.id,
    'first_name', btrim(coalesce(pupil_row.first_name, '')),
    'surname', btrim(coalesce(pupil_row.surname, '')),
    'display_name', coalesce(display_name, lower(btrim(coalesce(pupil_row.username, '')))),
    'username', lower(btrim(coalesce(pupil_row.username, ''))),
    'pin', issued_pin,
    'issued_at', issued_at
  );
end;
$$;


ALTER FUNCTION "public"."reset_pupil_login_pin"("target_pupil_id" "uuid", "requested_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reset_pupil_login_pin"("target_pupil_id" "uuid", "requested_reason" "text") IS 'Admin-only audited one-time pupil PIN reset. Keeps username unchanged and returns the newly issued PIN only in the RPC response.';



CREATE OR REPLACE FUNCTION "public"."restore_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."restore_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."restore_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_all_staff_live_access"("target_user_id" "uuid", "requested_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."revoke_all_staff_live_access"("target_user_id" "uuid", "requested_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_staff_role"("target_user_id" "uuid", "requested_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."revoke_staff_role"("target_user_id" "uuid", "requested_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."revoke_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_staff_pending_access_approval"("target_profile_id" "uuid", "requested_roles" "jsonb" DEFAULT '[]'::"jsonb", "requested_scopes" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."save_staff_pending_access_approval"("target_profile_id" "uuid", "requested_roles" "jsonb", "requested_scopes" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_assignment_pupil_overrides_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_assignment_pupil_overrides_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_test_groups_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_test_groups_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_pending_access_duplicate_preflight"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."staff_pending_access_duplicate_preflight"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_role_uses_automatic_school_scope"("requested_role" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select lower(btrim(coalesce(requested_role, ''))) in ('admin', 'senco', 'literacy_lead');
$$;


ALTER FUNCTION "public"."staff_role_uses_automatic_school_scope"("requested_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_pupil_class_lifecycle_state"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."sync_pupil_class_lifecycle_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_pupil_record_lifecycle_state"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."sync_pupil_record_lifecycle_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_ensure_form_class_baseline_on_class_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.id is null then
    return new;
  end if;

  if coalesce(nullif(lower(btrim(coalesce(new.class_type, ''))), ''), 'form') = 'form' then
    perform public.ensure_form_class_baseline_assignment_internal(new.id, 'core_v1');
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_ensure_form_class_baseline_on_class_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_ensure_form_class_baseline_on_membership_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.class_id is null or coalesce(new.active, false) is not true then
    return new;
  end if;

  perform public.ensure_form_class_baseline_assignment_internal(new.class_id, 'core_v1');
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_ensure_form_class_baseline_on_membership_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_my_staff_profile"("requested_email" "text" DEFAULT NULL::"text", "requested_display_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."upsert_my_staff_profile"("requested_email" "text", "requested_display_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_staff_data"("requested_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."user_has_staff_data"("requested_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_pupil_runtime_session"("requested_pupil_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."validate_pupil_runtime_session"("requested_pupil_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_pupil_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "pupil_id" "uuid" NOT NULL,
    "question_type" "text",
    "audio_enabled" boolean,
    "hints_enabled" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assignment_pupil_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_pupil_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "class_id" "uuid",
    "test_id" "uuid",
    "pupil_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "last_opened_at" timestamp with time zone,
    "last_activity_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "total_words" integer DEFAULT 0 NOT NULL,
    "correct_words" integer DEFAULT 0 NOT NULL,
    "average_attempts" double precision DEFAULT 0 NOT NULL,
    "score_rate" double precision DEFAULT 0 NOT NULL,
    "result_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "assignment_pupil_statuses_status_check" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'started'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."assignment_pupil_statuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_pupil_target_words" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "pupil_id" "uuid" NOT NULL,
    "test_word_id" "uuid" NOT NULL,
    "focus_grapheme" "text",
    "target_source" "text" DEFAULT 'analytics'::"text" NOT NULL,
    "target_reason" "text" DEFAULT 'focus_grapheme'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."assignment_pupil_target_words" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "test_id" "uuid" NOT NULL,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "teacher_id" "uuid",
    "deadline_enforced" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments_v2" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "test_id" "uuid" NOT NULL,
    "mode" "text" DEFAULT 'practice'::"text" NOT NULL,
    "max_attempts" integer,
    "end_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "question_type" "text" DEFAULT 'full_recall'::"text",
    "audio_enabled" boolean DEFAULT true,
    "hints_enabled" boolean DEFAULT false,
    "analytics_target_words_enabled" boolean DEFAULT false NOT NULL,
    "analytics_target_words_per_pupil" integer DEFAULT 3 NOT NULL,
    "automation_kind" "text",
    "automation_source" "text",
    "automation_run_id" "uuid",
    "automation_triggered_by" "uuid",
    CONSTRAINT "assignments_v2_automation_kind_check" CHECK ((("automation_kind" IS NULL) OR ("automation_kind" = 'personalised'::"text"))),
    CONSTRAINT "assignments_v2_automation_source_check" CHECK ((("automation_source" IS NULL) OR ("automation_source" = 'manual_run_now'::"text")))
);


ALTER TABLE "public"."assignments_v2" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid",
    "pupil_id" "uuid" NOT NULL,
    "word" "text",
    "typed" "text" NOT NULL,
    "mode" "text" NOT NULL,
    "is_correct" boolean,
    "attempt_no" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "test_id" "uuid",
    "test_word_id" "uuid",
    "attempt_number" integer,
    "attempts_allowed" integer,
    "word_text" "text",
    "attempt_source" "text",
    "target_graphemes" "jsonb",
    "focus_grapheme" "text",
    "pattern_type" "text",
    "correct" boolean,
    "assignment_target_id" "uuid",
    "word_source" "text"
);


ALTER TABLE "public"."attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_auto_assignment_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "assignment_length" integer NOT NULL,
    "support_preset" "text" NOT NULL,
    "allow_starter_fallback" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "class_auto_assignment_policies_assignment_length_check" CHECK ((("assignment_length" >= 4) AND ("assignment_length" <= 20))),
    CONSTRAINT "class_auto_assignment_policies_support_preset_check" CHECK (("support_preset" = ANY (ARRAY['balanced'::"text", 'independent_first'::"text", 'more_support_when_needed'::"text"])))
);


ALTER TABLE "public"."class_auto_assignment_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personalised_automation_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "assignment_length" integer NOT NULL,
    "support_preset" "text" NOT NULL,
    "allow_starter_fallback" boolean DEFAULT true NOT NULL,
    "frequency" "text" NOT NULL,
    "selected_weekdays" "text"[] DEFAULT ARRAY['friday'::"text"] NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "selected_weekdays_week_1" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "selected_weekdays_week_2" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    CONSTRAINT "personalised_automation_policies_assignment_length_check" CHECK ((("assignment_length" >= 4) AND ("assignment_length" <= 20))),
    CONSTRAINT "personalised_automation_policies_date_window_check" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "personalised_automation_policies_frequency_check" CHECK (("frequency" = ANY (ARRAY['weekly'::"text", 'fortnightly'::"text"]))),
    CONSTRAINT "personalised_automation_policies_selected_weekdays_check" CHECK ((("cardinality"("selected_weekdays") > 0) AND ("selected_weekdays" <@ ARRAY['monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text", 'sunday'::"text"]))),
    CONSTRAINT "personalised_automation_policies_selected_weekdays_week_1_check" CHECK (("selected_weekdays_week_1" <@ ARRAY['monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text", 'sunday'::"text"])),
    CONSTRAINT "personalised_automation_policies_selected_weekdays_week_2_check" CHECK (("selected_weekdays_week_2" <@ ARRAY['monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text", 'sunday'::"text"])),
    CONSTRAINT "personalised_automation_policies_support_preset_check" CHECK (("support_preset" = ANY (ARRAY['balanced'::"text", 'independent_first'::"text", 'more_support_when_needed'::"text"])))
);


ALTER TABLE "public"."personalised_automation_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personalised_automation_policy_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "personalised_automation_policy_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'updated'::"text", 'archived'::"text", 'restored'::"text", 'duplicated'::"text", 'run_started'::"text"])))
);


ALTER TABLE "public"."personalised_automation_policy_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personalised_automation_policy_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."personalised_automation_policy_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personalised_generation_run_pupils" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "class_id" "uuid" NOT NULL,
    "pupil_id" "uuid" NOT NULL,
    "assignment_id" "uuid",
    "status" "text" NOT NULL,
    "skip_reason" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "personalised_generation_run_pupils_skip_reason_check" CHECK (("skip_reason" = ANY (ARRAY['baseline_incomplete'::"text", 'active_automated_assignment'::"text"]))),
    CONSTRAINT "personalised_generation_run_pupils_status_check" CHECK (("status" = ANY (ARRAY['included'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."personalised_generation_run_pupils" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personalised_generation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "trigger_role" "text" DEFAULT 'central_owner'::"text" NOT NULL,
    "run_source" "text" DEFAULT 'manual_run_now'::"text" NOT NULL,
    "selected_class_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "assignment_length" integer NOT NULL,
    "support_preset" "text" NOT NULL,
    "allow_starter_fallback" boolean DEFAULT true NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "class_count" integer DEFAULT 0 NOT NULL,
    "included_pupil_count" integer DEFAULT 0 NOT NULL,
    "skipped_pupil_count" integer DEFAULT 0 NOT NULL,
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "automation_policy_id" "uuid",
    "policy_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "derived_deadline_at" timestamp with time zone,
    CONSTRAINT "personalised_generation_runs_assignment_length_check" CHECK ((("assignment_length" >= 4) AND ("assignment_length" <= 20))),
    CONSTRAINT "personalised_generation_runs_run_source_check" CHECK (("run_source" = 'manual_run_now'::"text")),
    CONSTRAINT "personalised_generation_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "personalised_generation_runs_support_preset_check" CHECK (("support_preset" = ANY (ARRAY['balanced'::"text", 'independent_first'::"text", 'more_support_when_needed'::"text"]))),
    CONSTRAINT "personalised_generation_runs_trigger_role_check" CHECK (("trigger_role" = 'central_owner'::"text"))
);


ALTER TABLE "public"."personalised_generation_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phonics_correction_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "word" "text" NOT NULL,
    "normalized_word" "text" NOT NULL,
    "original_output_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "corrected_output_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "correction_type" "text" NOT NULL,
    "correction_signature" "text" NOT NULL,
    "source" "text",
    "context_area" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."phonics_correction_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phonics_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "word" "text" NOT NULL,
    "normalized_word" "text" NOT NULL,
    "grapheme_data_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "focus_grapheme" "text",
    "classification" "text",
    "source" "text" DEFAULT 'teacher_manual_approval'::"text" NOT NULL,
    "approval_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "notes" "text",
    "times_seen" integer DEFAULT 0 NOT NULL,
    "times_used" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "phonics_exceptions_times_seen_check" CHECK (("times_seen" >= 0)),
    CONSTRAINT "phonics_exceptions_times_used_check" CHECK (("times_used" >= 0))
);


ALTER TABLE "public"."phonics_exceptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pupil_classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pupil_id" "uuid",
    "class_id" "uuid",
    "active" boolean DEFAULT true,
    "joined_at" timestamp without time zone DEFAULT "now"(),
    "left_at" timestamp without time zone,
    "import_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_import_batch_id" "uuid",
    "last_imported_at" timestamp with time zone,
    "last_imported_by" "uuid",
    "ended_at" timestamp with time zone,
    "ended_by" "uuid",
    "ended_reason" "text"
);


ALTER TABLE "public"."pupil_classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pupil_directory_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "target_pupil_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "pupil_directory_audit_log_action_check" CHECK (("action" = ANY (ARRAY['archive'::"text", 'restore'::"text", 'move_form'::"text", 'reset_pin'::"text"])))
);


ALTER TABLE "public"."pupil_directory_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pupil_import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "file_name" "text",
    "rows_processed" integer DEFAULT 0 NOT NULL,
    "created_count" integer DEFAULT 0 NOT NULL,
    "updated_count" integer DEFAULT 0 NOT NULL,
    "replaced_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "warning_count" integer DEFAULT 0 NOT NULL,
    "error_count" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."pupil_import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pupils" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nickname" "text",
    "login_code_hash" "text",
    "theme_bg" "text" DEFAULT '#ffffff'::"text",
    "theme_text" "text" DEFAULT '#111827'::"text",
    "default_mode" "text" DEFAULT 'guided'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mis_id" "text",
    "first_name" "text",
    "surname" "text",
    "username" "text",
    "pin" "text",
    "must_reset_pin" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "import_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_import_batch_id" "uuid",
    "last_imported_at" timestamp with time zone,
    "last_imported_by" "uuid",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "archive_reason" "text"
);


ALTER TABLE "public"."pupils" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_access_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "role" "text",
    "scope_type" "text",
    "scope_value" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "staff_access_audit_log_action_check" CHECK (("action" = ANY (ARRAY['bootstrap_admin'::"text", 'grant_role'::"text", 'revoke_role'::"text", 'grant_scope'::"text", 'revoke_scope'::"text"]))),
    CONSTRAINT "staff_access_audit_log_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'teacher'::"text", 'hoy'::"text", 'hod'::"text", 'senco'::"text", 'literacy_lead'::"text"]))),
    CONSTRAINT "staff_access_audit_log_scope_type_check" CHECK (("scope_type" = ANY (ARRAY['school'::"text", 'year_group'::"text", 'department'::"text", 'class'::"text"])))
);


ALTER TABLE "public"."staff_access_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_directory_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "target_profile_id" "uuid",
    "target_user_id" "uuid",
    "action" "text" NOT NULL,
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "staff_directory_audit_log_action_check" CHECK (("action" = ANY (ARRAY['archive'::"text", 'restore'::"text", 'revoke_all_live_access'::"text"])))
);


ALTER TABLE "public"."staff_directory_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "file_name" "text",
    "rows_processed" integer DEFAULT 0 NOT NULL,
    "created_count" integer DEFAULT 0 NOT NULL,
    "updated_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "warning_count" integer DEFAULT 0 NOT NULL,
    "error_count" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."staff_import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_pending_access_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_profile_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "approved_email" "text" NOT NULL,
    "approved_external_staff_id" "text",
    "approved_by" "uuid" NOT NULL,
    "approved_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "stale_after_at" timestamp with time zone,
    "activated_user_id" "uuid",
    "activated_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "invalidated_reason" "text",
    "last_failure_reason" "text",
    "last_failure_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "staff_pending_access_approvals_status_check" CHECK (("status" = ANY (ARRAY['approved'::"text", 'activated'::"text", 'cancelled'::"text", 'superseded'::"text", 'invalidated'::"text"])))
);


ALTER TABLE "public"."staff_pending_access_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_pending_access_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "staff_profile_id" "uuid" NOT NULL,
    "approval_id" "uuid",
    "action" "text" NOT NULL,
    "message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "staff_pending_access_audit_log_action_check" CHECK (("action" = ANY (ARRAY['approve'::"text", 'cancel'::"text", 'invalidate'::"text", 'activate'::"text", 'activate_blocked'::"text", 'supersede'::"text"])))
);


ALTER TABLE "public"."staff_pending_access_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_pending_role_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "staff_pending_role_assignments_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'teacher'::"text", 'hoy'::"text", 'hod'::"text", 'senco'::"text", 'literacy_lead'::"text"])))
);


ALTER TABLE "public"."staff_pending_role_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_pending_scope_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "scope_type" "text" NOT NULL,
    "scope_value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "staff_pending_scope_assignments_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'teacher'::"text", 'hoy'::"text", 'hod'::"text", 'senco'::"text", 'literacy_lead'::"text"]))),
    CONSTRAINT "staff_pending_scope_assignments_scope_type_check" CHECK (("scope_type" = ANY (ARRAY['school'::"text", 'year_group'::"text", 'department'::"text", 'class'::"text"])))
);


ALTER TABLE "public"."staff_pending_scope_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_profiles" (
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_staff_id" "text",
    "notes" "text",
    "profile_source" "text" DEFAULT 'self_service'::"text" NOT NULL,
    "import_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_import_batch_id" "uuid",
    "last_imported_at" timestamp with time zone,
    "last_imported_by" "uuid",
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    "archive_reason" "text",
    CONSTRAINT "staff_profiles_profile_source_check" CHECK (("profile_source" = ANY (ARRAY['self_service'::"text", 'csv_import'::"text"])))
);


ALTER TABLE "public"."staff_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_role_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "granted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "staff_role_assignments_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'teacher'::"text", 'hoy'::"text", 'hod'::"text", 'senco'::"text", 'literacy_lead'::"text"])))
);


ALTER TABLE "public"."staff_role_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_scope_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "scope_type" "text" NOT NULL,
    "scope_value" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "granted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "staff_scope_assignments_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'teacher'::"text", 'hoy'::"text", 'hod'::"text", 'senco'::"text", 'literacy_lead'::"text"]))),
    CONSTRAINT "staff_scope_assignments_scope_type_check" CHECK (("scope_type" = ANY (ARRAY['school'::"text", 'year_group'::"text", 'department'::"text", 'class'::"text"])))
);


ALTER TABLE "public"."staff_scope_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_ai_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "text" "text" NOT NULL,
    "scope_label" "text",
    "meta" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "teacher_ai_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."teacher_ai_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_ai_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'New chat'::"text" NOT NULL,
    "scope_type" "text" DEFAULT 'overview'::"text" NOT NULL,
    "scope_id" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "teacher_ai_threads_scope_type_check" CHECK (("scope_type" = ANY (ARRAY['overview'::"text", 'class'::"text", 'year_group'::"text", 'pupil'::"text"])))
);


ALTER TABLE "public"."teacher_ai_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_app_roles" (
    "teacher_id" "uuid" NOT NULL,
    "app_role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "teacher_app_roles_app_role_check" CHECK (("app_role" = ANY (ARRAY['teacher'::"text", 'central_owner'::"text"])))
);


ALTER TABLE "public"."teacher_app_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_pupil_group_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "pupil_id" "uuid" NOT NULL,
    "group_type" "text" NOT NULL,
    "group_value" "text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."teacher_pupil_group_values" OWNER TO "postgres";


COMMENT ON TABLE "public"."teacher_pupil_group_values" IS 'Teacher-owned group comparison attributes. Sensitive statuses should be stored here instead of public pupil records.';



CREATE TABLE IF NOT EXISTS "public"."teachers" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."teachers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."test_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    "type" "text" DEFAULT 'spell_from_audio'::"text" NOT NULL,
    "prompt_text" "text" NOT NULL,
    "answer_text" "text" NOT NULL,
    "meta_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."test_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_words" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "word" "text" NOT NULL,
    "sentence" "text",
    "segments" "jsonb",
    "choice" "jsonb"
);


ALTER TABLE "public"."test_words" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "group_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "question_type" "text" DEFAULT 'focus_grapheme'::"text" NOT NULL,
    "analytics_target_words_enabled" boolean DEFAULT false NOT NULL,
    "analytics_target_words_per_pupil" integer DEFAULT 3 NOT NULL
);


ALTER TABLE "public"."tests" OWNER TO "postgres";


ALTER TABLE ONLY "public"."assignment_pupil_overrides"
    ADD CONSTRAINT "assignment_pupil_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_pupil_overrides"
    ADD CONSTRAINT "assignment_pupil_overrides_unique" UNIQUE ("assignment_id", "pupil_id");



ALTER TABLE ONLY "public"."assignment_pupil_statuses"
    ADD CONSTRAINT "assignment_pupil_statuses_assignment_id_pupil_id_key" UNIQUE ("assignment_id", "pupil_id");



ALTER TABLE ONLY "public"."assignment_pupil_statuses"
    ADD CONSTRAINT "assignment_pupil_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_pupil_target_words"
    ADD CONSTRAINT "assignment_pupil_target_words_assignment_id_pupil_id_test_w_key" UNIQUE ("assignment_id", "pupil_id", "test_word_id");



ALTER TABLE ONLY "public"."assignment_pupil_target_words"
    ADD CONSTRAINT "assignment_pupil_target_words_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments_v2"
    ADD CONSTRAINT "assignments_v2_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attempts"
    ADD CONSTRAINT "attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_auto_assignment_policies"
    ADD CONSTRAINT "class_auto_assignment_policies_class_id_key" UNIQUE ("class_id");



ALTER TABLE ONLY "public"."class_auto_assignment_policies"
    ADD CONSTRAINT "class_auto_assignment_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_join_code_key" UNIQUE ("join_code");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personalised_automation_policies"
    ADD CONSTRAINT "personalised_automation_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personalised_automation_policy_events"
    ADD CONSTRAINT "personalised_automation_policy_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personalised_automation_policy_targets"
    ADD CONSTRAINT "personalised_automation_policy_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personalised_automation_policy_targets"
    ADD CONSTRAINT "personalised_automation_policy_targets_policy_id_class_id_key" UNIQUE ("policy_id", "class_id");



ALTER TABLE ONLY "public"."personalised_generation_run_pupils"
    ADD CONSTRAINT "personalised_generation_run_pupils_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personalised_generation_run_pupils"
    ADD CONSTRAINT "personalised_generation_run_pupils_run_id_class_id_pupil_id_key" UNIQUE ("run_id", "class_id", "pupil_id");



ALTER TABLE ONLY "public"."personalised_generation_runs"
    ADD CONSTRAINT "personalised_generation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phonics_correction_logs"
    ADD CONSTRAINT "phonics_correction_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phonics_exceptions"
    ADD CONSTRAINT "phonics_exceptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phonics_exceptions"
    ADD CONSTRAINT "phonics_exceptions_teacher_id_normalized_word_key" UNIQUE ("teacher_id", "normalized_word");



ALTER TABLE ONLY "public"."pupil_classes"
    ADD CONSTRAINT "pupil_classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pupil_directory_audit_log"
    ADD CONSTRAINT "pupil_directory_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pupil_import_batches"
    ADD CONSTRAINT "pupil_import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pupils"
    ADD CONSTRAINT "pupils_mis_id_key" UNIQUE ("mis_id");



ALTER TABLE ONLY "public"."pupils"
    ADD CONSTRAINT "pupils_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pupils"
    ADD CONSTRAINT "pupils_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."staff_access_audit_log"
    ADD CONSTRAINT "staff_access_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_directory_audit_log"
    ADD CONSTRAINT "staff_directory_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_import_batches"
    ADD CONSTRAINT "staff_import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_pending_access_approvals"
    ADD CONSTRAINT "staff_pending_access_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_pending_access_audit_log"
    ADD CONSTRAINT "staff_pending_access_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_pending_role_assignments"
    ADD CONSTRAINT "staff_pending_role_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_pending_scope_assignments"
    ADD CONSTRAINT "staff_pending_scope_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_role_assignments"
    ADD CONSTRAINT "staff_role_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_scope_assignments"
    ADD CONSTRAINT "staff_scope_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_ai_messages"
    ADD CONSTRAINT "teacher_ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_ai_threads"
    ADD CONSTRAINT "teacher_ai_threads_id_teacher_id_key" UNIQUE ("id", "teacher_id");



ALTER TABLE ONLY "public"."teacher_ai_threads"
    ADD CONSTRAINT "teacher_ai_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_app_roles"
    ADD CONSTRAINT "teacher_app_roles_pkey" PRIMARY KEY ("teacher_id");



ALTER TABLE ONLY "public"."teacher_pupil_group_values"
    ADD CONSTRAINT "teacher_pupil_group_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_pupil_group_values"
    ADD CONSTRAINT "teacher_pupil_group_values_teacher_id_pupil_id_group_type_key" UNIQUE ("teacher_id", "pupil_id", "group_type");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_groups"
    ADD CONSTRAINT "test_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_groups"
    ADD CONSTRAINT "test_groups_teacher_name_unique" UNIQUE ("teacher_id", "name");



ALTER TABLE ONLY "public"."test_questions"
    ADD CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_words"
    ADD CONSTRAINT "test_words_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_pkey" PRIMARY KEY ("id");



CREATE INDEX "attempts_assignment_id_idx" ON "public"."attempts" USING "btree" ("assignment_id");



CREATE INDEX "attempts_pupil_id_idx" ON "public"."attempts" USING "btree" ("pupil_id");



CREATE INDEX "attempts_test_id_idx" ON "public"."attempts" USING "btree" ("test_id");



CREATE INDEX "idx_assignment_pupil_overrides_assignment_id" ON "public"."assignment_pupil_overrides" USING "btree" ("assignment_id");



CREATE INDEX "idx_assignment_pupil_overrides_pupil_id" ON "public"."assignment_pupil_overrides" USING "btree" ("pupil_id");



CREATE INDEX "idx_assignment_pupil_statuses_assignment_completed" ON "public"."assignment_pupil_statuses" USING "btree" ("assignment_id", "completed_at" DESC);



CREATE INDEX "idx_assignment_pupil_statuses_assignment_pupil" ON "public"."assignment_pupil_statuses" USING "btree" ("assignment_id", "pupil_id");



CREATE INDEX "idx_assignment_pupil_statuses_pupil_completed" ON "public"."assignment_pupil_statuses" USING "btree" ("pupil_id", "completed_at" DESC);



CREATE INDEX "idx_assignment_pupil_statuses_teacher_assignment" ON "public"."assignment_pupil_statuses" USING "btree" ("teacher_id", "assignment_id", "updated_at" DESC);



CREATE INDEX "idx_assignment_pupil_target_words_assignment_pupil" ON "public"."assignment_pupil_target_words" USING "btree" ("assignment_id", "pupil_id", "created_at" DESC);



CREATE INDEX "idx_assignment_pupil_target_words_teacher_assignment" ON "public"."assignment_pupil_target_words" USING "btree" ("teacher_id", "assignment_id", "created_at" DESC);



CREATE INDEX "idx_assignments_v2_automation_kind" ON "public"."assignments_v2" USING "btree" ("automation_kind", "automation_source", "class_id", "created_at" DESC);



CREATE INDEX "idx_assignments_v2_automation_run" ON "public"."assignments_v2" USING "btree" ("automation_run_id");



CREATE INDEX "idx_assignments_v2_teacher_class_test_created" ON "public"."assignments_v2" USING "btree" ("teacher_id", "class_id", "test_id", "created_at" DESC);



CREATE INDEX "idx_attempts_assignment_created" ON "public"."attempts" USING "btree" ("assignment_id", "created_at" DESC);



CREATE INDEX "idx_attempts_assignment_pupil_word_created" ON "public"."attempts" USING "btree" ("assignment_id", "pupil_id", "test_word_id", "created_at" DESC);



CREATE INDEX "idx_attempts_assignment_target_created" ON "public"."attempts" USING "btree" ("assignment_target_id", "created_at" DESC);



CREATE INDEX "idx_attempts_pupil_focus_created" ON "public"."attempts" USING "btree" ("pupil_id", "focus_grapheme", "created_at" DESC);



CREATE INDEX "idx_class_auto_assignment_policies_class" ON "public"."class_auto_assignment_policies" USING "btree" ("class_id");



CREATE INDEX "idx_class_auto_assignment_policies_teacher_updated" ON "public"."class_auto_assignment_policies" USING "btree" ("teacher_id", "updated_at" DESC);



CREATE INDEX "idx_classes_teacher_department_name" ON "public"."classes" USING "btree" ("teacher_id", "department_key", "name");



CREATE INDEX "idx_classes_teacher_type_name" ON "public"."classes" USING "btree" ("teacher_id", "class_type", "name");



CREATE INDEX "idx_classes_teacher_year_group" ON "public"."classes" USING "btree" ("teacher_id", "year_group");



CREATE INDEX "idx_classes_year_group_name" ON "public"."classes" USING "btree" ("year_group", "name");



CREATE INDEX "idx_personalised_automation_policies_teacher_archived_updated" ON "public"."personalised_automation_policies" USING "btree" ("teacher_id", "archived_at", "updated_at" DESC);



CREATE INDEX "idx_personalised_automation_policies_teacher_updated" ON "public"."personalised_automation_policies" USING "btree" ("teacher_id", "updated_at" DESC);



CREATE INDEX "idx_personalised_automation_policy_events_policy_created" ON "public"."personalised_automation_policy_events" USING "btree" ("policy_id", "created_at" DESC);



CREATE INDEX "idx_personalised_automation_policy_targets_class" ON "public"."personalised_automation_policy_targets" USING "btree" ("class_id");



CREATE INDEX "idx_personalised_automation_policy_targets_policy" ON "public"."personalised_automation_policy_targets" USING "btree" ("policy_id", "created_at" DESC);



CREATE INDEX "idx_personalised_generation_run_pupils_pupil" ON "public"."personalised_generation_run_pupils" USING "btree" ("pupil_id", "created_at" DESC);



CREATE INDEX "idx_personalised_generation_run_pupils_run_status" ON "public"."personalised_generation_run_pupils" USING "btree" ("run_id", "status");



CREATE INDEX "idx_personalised_generation_runs_policy" ON "public"."personalised_generation_runs" USING "btree" ("automation_policy_id", "created_at" DESC);



CREATE INDEX "idx_personalised_generation_runs_teacher_created" ON "public"."personalised_generation_runs" USING "btree" ("teacher_id", "created_at" DESC);



CREATE INDEX "idx_phonics_correction_logs_signature" ON "public"."phonics_correction_logs" USING "btree" ("teacher_id", "correction_type", "correction_signature", "created_at" DESC);



CREATE INDEX "idx_phonics_correction_logs_teacher_created" ON "public"."phonics_correction_logs" USING "btree" ("teacher_id", "created_at" DESC);



CREATE INDEX "idx_phonics_exceptions_teacher_status" ON "public"."phonics_exceptions" USING "btree" ("teacher_id", "approval_status", "updated_at" DESC);



CREATE INDEX "idx_phonics_exceptions_teacher_word" ON "public"."phonics_exceptions" USING "btree" ("teacher_id", "normalized_word");



CREATE UNIQUE INDEX "idx_pupil_classes_active_membership_unique" ON "public"."pupil_classes" USING "btree" ("class_id", "pupil_id") WHERE ("active" IS TRUE);



CREATE INDEX "idx_pupil_classes_class_active_pupil" ON "public"."pupil_classes" USING "btree" ("class_id", "active", "pupil_id");



CREATE INDEX "idx_pupil_classes_pupil_active_lookup" ON "public"."pupil_classes" USING "btree" ("pupil_id", "active", "class_id");



CREATE INDEX "idx_pupil_directory_audit_pupil_created" ON "public"."pupil_directory_audit_log" USING "btree" ("target_pupil_id", "created_at" DESC);



CREATE INDEX "idx_pupils_archived_lookup" ON "public"."pupils" USING "btree" ("archived_at") WHERE ("archived_at" IS NOT NULL);



CREATE INDEX "idx_pupils_mis_id_lookup" ON "public"."pupils" USING "btree" ("public"."normalize_pupil_import_lookup_text"("mis_id")) WHERE (("mis_id" IS NOT NULL) AND ("btrim"("mis_id") <> ''::"text"));



CREATE INDEX "idx_pupils_runtime_auth_lookup" ON "public"."pupils" USING "btree" ("public"."normalize_pupil_import_lookup_text"("username"), "pin") WHERE (("username" IS NOT NULL) AND ("btrim"("username") <> ''::"text") AND ("archived_at" IS NULL) AND ("is_active" IS TRUE));



CREATE INDEX "idx_pupils_username_lookup" ON "public"."pupils" USING "btree" ("public"."normalize_pupil_import_lookup_text"("username")) WHERE (("username" IS NOT NULL) AND ("btrim"("username") <> ''::"text"));



CREATE INDEX "idx_staff_access_audit_log_actor_created" ON "public"."staff_access_audit_log" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "idx_staff_access_audit_log_target_created" ON "public"."staff_access_audit_log" USING "btree" ("target_user_id", "created_at" DESC);



CREATE INDEX "idx_staff_directory_audit_profile_created" ON "public"."staff_directory_audit_log" USING "btree" ("target_profile_id", "created_at" DESC);



CREATE INDEX "idx_staff_directory_audit_user_created" ON "public"."staff_directory_audit_log" USING "btree" ("target_user_id", "created_at" DESC);



CREATE INDEX "idx_staff_pending_access_audit_approval_created" ON "public"."staff_pending_access_audit_log" USING "btree" ("approval_id", "created_at" DESC);



CREATE INDEX "idx_staff_pending_access_audit_profile_created" ON "public"."staff_pending_access_audit_log" USING "btree" ("staff_profile_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_staff_pending_access_one_approved_per_profile" ON "public"."staff_pending_access_approvals" USING "btree" ("staff_profile_id") WHERE ("status" = 'approved'::"text");



CREATE INDEX "idx_staff_pending_access_profile_lookup" ON "public"."staff_pending_access_approvals" USING "btree" ("staff_profile_id", "updated_at" DESC);



CREATE UNIQUE INDEX "idx_staff_pending_role_assignments_unique" ON "public"."staff_pending_role_assignments" USING "btree" ("approval_id", "role");



CREATE UNIQUE INDEX "idx_staff_pending_scope_assignments_unique" ON "public"."staff_pending_scope_assignments" USING "btree" ("approval_id", "role", "scope_type", "scope_value");



CREATE INDEX "idx_staff_profiles_archived_lookup" ON "public"."staff_profiles" USING "btree" ("archived_at") WHERE ("archived_at" IS NOT NULL);



CREATE INDEX "idx_staff_profiles_email_lookup" ON "public"."staff_profiles" USING "btree" ("lower"("email"));



CREATE INDEX "idx_staff_profiles_external_staff_id_lookup" ON "public"."staff_profiles" USING "btree" ("lower"("external_staff_id")) WHERE (("external_staff_id" IS NOT NULL) AND ("btrim"("external_staff_id") <> ''::"text"));



CREATE UNIQUE INDEX "idx_staff_profiles_user_id_unique" ON "public"."staff_profiles" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_staff_role_assignments_user_active" ON "public"."staff_role_assignments" USING "btree" ("user_id", "updated_at" DESC) WHERE ("active" IS TRUE);



CREATE UNIQUE INDEX "idx_staff_role_assignments_user_role_active_unique" ON "public"."staff_role_assignments" USING "btree" ("user_id", "role") WHERE ("active" IS TRUE);



CREATE INDEX "idx_staff_scope_assignments_lookup" ON "public"."staff_scope_assignments" USING "btree" ("user_id", "scope_type", "scope_value", "updated_at" DESC) WHERE ("active" IS TRUE);



CREATE UNIQUE INDEX "idx_staff_scope_assignments_user_role_scope_active_unique" ON "public"."staff_scope_assignments" USING "btree" ("user_id", "role", "scope_type", "scope_value") WHERE ("active" IS TRUE);



CREATE INDEX "idx_teacher_ai_messages_teacher_created" ON "public"."teacher_ai_messages" USING "btree" ("teacher_id", "created_at" DESC);



CREATE INDEX "idx_teacher_ai_messages_thread_created" ON "public"."teacher_ai_messages" USING "btree" ("thread_id", "created_at");



CREATE INDEX "idx_teacher_ai_threads_teacher_recent" ON "public"."teacher_ai_threads" USING "btree" ("teacher_id", "last_message_at" DESC);



CREATE INDEX "idx_teacher_pupil_group_values_teacher_type_pupil" ON "public"."teacher_pupil_group_values" USING "btree" ("teacher_id", "group_type", "pupil_id");



CREATE INDEX "idx_teacher_pupil_group_values_teacher_type_value" ON "public"."teacher_pupil_group_values" USING "btree" ("teacher_id", "group_type", "group_value");



CREATE INDEX "idx_tests_group_id" ON "public"."tests" USING "btree" ("group_id");



CREATE INDEX "idx_tests_status" ON "public"."tests" USING "btree" ("status");



CREATE INDEX "idx_tests_teacher_id" ON "public"."tests" USING "btree" ("teacher_id");



CREATE INDEX "test_questions_test_id_position_idx" ON "public"."test_questions" USING "btree" ("test_id", "position");



CREATE INDEX "test_words_test_id_pos_idx" ON "public"."test_words" USING "btree" ("test_id", "position");



CREATE OR REPLACE TRIGGER "trg_assignment_pupil_overrides_updated_at" BEFORE UPDATE ON "public"."assignment_pupil_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_assignment_pupil_overrides_updated_at"();



CREATE OR REPLACE TRIGGER "trg_enforce_assignments_v2_write" BEFORE INSERT OR DELETE OR UPDATE ON "public"."assignments_v2" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_assignment_write"();



CREATE OR REPLACE TRIGGER "trg_enforce_classes_write" BEFORE INSERT OR DELETE OR UPDATE ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_teacher_content_write"();



CREATE OR REPLACE TRIGGER "trg_enforce_legacy_teacher_app_role_lifecycle" BEFORE INSERT OR UPDATE ON "public"."teacher_app_roles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_legacy_teacher_app_role_lifecycle"();



CREATE OR REPLACE TRIGGER "trg_enforce_pupil_classes_write" BEFORE INSERT OR DELETE OR UPDATE ON "public"."pupil_classes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_class_membership_write"();



CREATE OR REPLACE TRIGGER "trg_enforce_pupils_write" BEFORE INSERT OR DELETE OR UPDATE ON "public"."pupils" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_teacher_content_write"();



CREATE OR REPLACE TRIGGER "trg_enforce_staff_live_access_lifecycle_role" BEFORE INSERT OR UPDATE ON "public"."staff_role_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_staff_live_access_lifecycle"();



CREATE OR REPLACE TRIGGER "trg_enforce_staff_live_access_lifecycle_scope" BEFORE INSERT OR UPDATE ON "public"."staff_scope_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_staff_live_access_lifecycle"();



CREATE OR REPLACE TRIGGER "trg_enforce_tests_write" BEFORE INSERT OR DELETE OR UPDATE ON "public"."tests" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_teacher_content_write"();



CREATE OR REPLACE TRIGGER "trg_ensure_form_class_baseline_after_insert" AFTER INSERT OR UPDATE OF "class_type", "teacher_id" ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_ensure_form_class_baseline_on_class_write"();



CREATE OR REPLACE TRIGGER "trg_ensure_form_class_baseline_after_membership_write" AFTER INSERT OR UPDATE OF "class_id", "active" ON "public"."pupil_classes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_ensure_form_class_baseline_on_membership_write"();



CREATE OR REPLACE TRIGGER "trg_personalised_automation_policy_overlap_from_policy" AFTER INSERT OR UPDATE OF "start_date", "end_date", "archived_at" ON "public"."personalised_automation_policies" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_policy"();



CREATE OR REPLACE TRIGGER "trg_personalised_automation_policy_overlap_from_target" AFTER INSERT OR UPDATE OF "class_id", "policy_id" ON "public"."personalised_automation_policy_targets" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_target"();



CREATE OR REPLACE TRIGGER "trg_sync_pupil_class_lifecycle_state" BEFORE INSERT OR UPDATE ON "public"."pupil_classes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_pupil_class_lifecycle_state"();



CREATE OR REPLACE TRIGGER "trg_sync_pupil_record_lifecycle_state" BEFORE INSERT OR UPDATE ON "public"."pupils" FOR EACH ROW EXECUTE FUNCTION "public"."sync_pupil_record_lifecycle_state"();



CREATE OR REPLACE TRIGGER "trg_test_groups_updated_at" BEFORE UPDATE ON "public"."test_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_test_groups_updated_at"();



ALTER TABLE ONLY "public"."assignment_pupil_overrides"
    ADD CONSTRAINT "assignment_pupil_overrides_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments_v2"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_pupil_overrides"
    ADD CONSTRAINT "assignment_pupil_overrides_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "public"."pupils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_pupil_statuses"
    ADD CONSTRAINT "assignment_pupil_statuses_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments_v2"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_pupil_statuses"
    ADD CONSTRAINT "assignment_pupil_statuses_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "public"."pupils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_pupil_target_words"
    ADD CONSTRAINT "assignment_pupil_target_words_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments_v2"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_pupil_target_words"
    ADD CONSTRAINT "assignment_pupil_target_words_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "public"."pupils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_pupil_target_words"
    ADD CONSTRAINT "assignment_pupil_target_words_test_word_id_fkey" FOREIGN KEY ("test_word_id") REFERENCES "public"."test_words"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments_v2"
    ADD CONSTRAINT "assignments_v2_automation_run_id_fkey" FOREIGN KEY ("automation_run_id") REFERENCES "public"."personalised_generation_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignments_v2"
    ADD CONSTRAINT "assignments_v2_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments_v2"
    ADD CONSTRAINT "assignments_v2_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments_v2"
    ADD CONSTRAINT "assignments_v2_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempts"
    ADD CONSTRAINT "attempts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempts"
    ADD CONSTRAINT "attempts_assignment_target_id_fkey" FOREIGN KEY ("assignment_target_id") REFERENCES "public"."assignment_pupil_target_words"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attempts"
    ADD CONSTRAINT "attempts_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "public"."pupils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attempts"
    ADD CONSTRAINT "attempts_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_auto_assignment_policies"
    ADD CONSTRAINT "class_auto_assignment_policies_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personalised_automation_policy_events"
    ADD CONSTRAINT "personalised_automation_policy_events_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."personalised_automation_policies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personalised_automation_policy_targets"
    ADD CONSTRAINT "personalised_automation_policy_targets_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personalised_automation_policy_targets"
    ADD CONSTRAINT "personalised_automation_policy_targets_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."personalised_automation_policies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personalised_generation_run_pupils"
    ADD CONSTRAINT "personalised_generation_run_pupils_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments_v2"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."personalised_generation_run_pupils"
    ADD CONSTRAINT "personalised_generation_run_pupils_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personalised_generation_run_pupils"
    ADD CONSTRAINT "personalised_generation_run_pupils_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "public"."pupils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personalised_generation_run_pupils"
    ADD CONSTRAINT "personalised_generation_run_pupils_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."personalised_generation_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personalised_generation_runs"
    ADD CONSTRAINT "personalised_generation_runs_automation_policy_id_fkey" FOREIGN KEY ("automation_policy_id") REFERENCES "public"."personalised_automation_policies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pupil_classes"
    ADD CONSTRAINT "pupil_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."pupil_classes"
    ADD CONSTRAINT "pupil_classes_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "public"."pupils"("id");



ALTER TABLE ONLY "public"."pupil_directory_audit_log"
    ADD CONSTRAINT "pupil_directory_audit_log_target_pupil_id_fkey" FOREIGN KEY ("target_pupil_id") REFERENCES "public"."pupils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_directory_audit_log"
    ADD CONSTRAINT "staff_directory_audit_log_target_profile_id_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_pending_access_approvals"
    ADD CONSTRAINT "staff_pending_access_approvals_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_pending_access_audit_log"
    ADD CONSTRAINT "staff_pending_access_audit_log_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "public"."staff_pending_access_approvals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_pending_access_audit_log"
    ADD CONSTRAINT "staff_pending_access_audit_log_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_pending_role_assignments"
    ADD CONSTRAINT "staff_pending_role_assignments_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "public"."staff_pending_access_approvals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_pending_scope_assignments"
    ADD CONSTRAINT "staff_pending_scope_assignments_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "public"."staff_pending_access_approvals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_ai_messages"
    ADD CONSTRAINT "teacher_ai_messages_thread_teacher_fkey" FOREIGN KEY ("thread_id", "teacher_id") REFERENCES "public"."teacher_ai_threads"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_pupil_group_values"
    ADD CONSTRAINT "teacher_pupil_group_values_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "public"."pupils"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_groups"
    ADD CONSTRAINT "test_groups_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_questions"
    ADD CONSTRAINT "test_questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_words"
    ADD CONSTRAINT "test_words_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."test_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete own personalised automation policies" ON "public"."personalised_automation_policies" FOR DELETE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can delete own personalised generation runs" ON "public"."personalised_generation_runs" FOR DELETE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can delete owned personalised automation policy targets" ON "public"."personalised_automation_policy_targets" FOR DELETE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "personalised_automation_policy_targets"."class_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Admins can delete owned personalised generation run pupils" ON "public"."personalised_generation_run_pupils" FOR DELETE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "personalised_generation_run_pupils"."class_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Admins can insert own personalised automation policies" ON "public"."personalised_automation_policies" FOR INSERT TO "authenticated" WITH CHECK ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can insert own personalised automation policy events" ON "public"."personalised_automation_policy_events" FOR INSERT TO "authenticated" WITH CHECK ((("teacher_id" = "auth"."uid"()) AND ("actor_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can insert own personalised generation runs" ON "public"."personalised_generation_runs" FOR INSERT TO "authenticated" WITH CHECK ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can insert owned personalised automation policy targets" ON "public"."personalised_automation_policy_targets" FOR INSERT TO "authenticated" WITH CHECK ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "personalised_automation_policy_targets"."class_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Admins can insert owned personalised generation run pupils" ON "public"."personalised_generation_run_pupils" FOR INSERT TO "authenticated" WITH CHECK ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "personalised_generation_run_pupils"."class_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Admins can update own personalised automation policies" ON "public"."personalised_automation_policies" FOR UPDATE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"()))) WITH CHECK ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can update own personalised generation runs" ON "public"."personalised_generation_runs" FOR UPDATE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"()))) WITH CHECK ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can update owned personalised automation policy targets" ON "public"."personalised_automation_policy_targets" FOR UPDATE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "personalised_automation_policy_targets"."class_id") AND ("c"."teacher_id" = "auth"."uid"())))))) WITH CHECK ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "personalised_automation_policy_targets"."class_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Admins can update owned personalised generation run pupils" ON "public"."personalised_generation_run_pupils" FOR UPDATE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "personalised_generation_run_pupils"."class_id") AND ("c"."teacher_id" = "auth"."uid"())))))) WITH CHECK ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "personalised_generation_run_pupils"."class_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Admins can view access audit log" ON "public"."staff_access_audit_log" FOR SELECT TO "authenticated" USING ("public"."can_manage_roles"("auth"."uid"()));



CREATE POLICY "Admins can view own personalised automation policies" ON "public"."personalised_automation_policies" FOR SELECT TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can view own personalised automation policy events" ON "public"."personalised_automation_policy_events" FOR SELECT TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can view own personalised automation policy targets" ON "public"."personalised_automation_policy_targets" FOR SELECT TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can view own personalised generation run pupils" ON "public"."personalised_generation_run_pupils" FOR SELECT TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can view own personalised generation runs" ON "public"."personalised_generation_runs" FOR SELECT TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."can_manage_automation"("auth"."uid"())));



CREATE POLICY "Admins can view pending staff approval audit" ON "public"."staff_pending_access_audit_log" FOR SELECT TO "authenticated" USING ("public"."can_manage_roles"("auth"."uid"()));



CREATE POLICY "Admins can view pending staff approval roles" ON "public"."staff_pending_role_assignments" FOR SELECT TO "authenticated" USING ("public"."can_manage_roles"("auth"."uid"()));



CREATE POLICY "Admins can view pending staff approval scopes" ON "public"."staff_pending_scope_assignments" FOR SELECT TO "authenticated" USING ("public"."can_manage_roles"("auth"."uid"()));



CREATE POLICY "Admins can view pending staff approvals" ON "public"."staff_pending_access_approvals" FOR SELECT TO "authenticated" USING ("public"."can_manage_roles"("auth"."uid"()));



CREATE POLICY "Admins can view pupil directory audit log" ON "public"."pupil_directory_audit_log" FOR SELECT TO "authenticated" USING ("public"."can_import_csv"("auth"."uid"()));



CREATE POLICY "Admins can view pupil import batches" ON "public"."pupil_import_batches" FOR SELECT TO "authenticated" USING ("public"."can_import_csv"("auth"."uid"()));



CREATE POLICY "Admins can view staff directory audit log" ON "public"."staff_directory_audit_log" FOR SELECT TO "authenticated" USING ("public"."can_manage_roles"("auth"."uid"()));



CREATE POLICY "Admins can view staff import batches" ON "public"."staff_import_batches" FOR SELECT TO "authenticated" USING ("public"."can_manage_roles"("auth"."uid"()));



CREATE POLICY "Admins can view staff profiles" ON "public"."staff_profiles" FOR SELECT TO "authenticated" USING ("public"."can_manage_roles"("auth"."uid"()));



CREATE POLICY "Anon can insert assignment pupil statuses" ON "public"."assignment_pupil_statuses" FOR INSERT TO "anon" WITH CHECK ("public"."can_access_pupil_assignment_runtime"("pupil_id", "assignment_id"));



CREATE POLICY "Anon can insert assignment pupil target words" ON "public"."assignment_pupil_target_words" FOR INSERT TO "anon" WITH CHECK ("public"."can_access_pupil_assignment_runtime"("pupil_id", "assignment_id"));



CREATE POLICY "Anon can insert attempts" ON "public"."attempts" FOR INSERT TO "anon" WITH CHECK (("public"."can_access_pupil_runtime"("pupil_id") AND (("assignment_id" IS NULL) OR "public"."can_access_pupil_assignment_runtime"("pupil_id", "assignment_id"))));



CREATE POLICY "Anon can update assignment pupil statuses" ON "public"."assignment_pupil_statuses" FOR UPDATE TO "anon" USING ("public"."can_access_pupil_assignment_runtime"("pupil_id", "assignment_id")) WITH CHECK ("public"."can_access_pupil_assignment_runtime"("pupil_id", "assignment_id"));



CREATE POLICY "Anon can update assignment pupil target words" ON "public"."assignment_pupil_target_words" FOR UPDATE TO "anon" USING ("public"."can_access_pupil_assignment_runtime"("pupil_id", "assignment_id")) WITH CHECK ("public"."can_access_pupil_assignment_runtime"("pupil_id", "assignment_id"));



CREATE POLICY "Anon can view assignment pupil statuses" ON "public"."assignment_pupil_statuses" FOR SELECT TO "anon" USING ("public"."can_access_pupil_assignment_runtime"("pupil_id", "assignment_id"));



CREATE POLICY "Anon can view assignment pupil target words" ON "public"."assignment_pupil_target_words" FOR SELECT TO "anon" USING ("public"."can_access_pupil_assignment_runtime"("pupil_id", "assignment_id"));



CREATE POLICY "Anon can view attempts" ON "public"."attempts" FOR SELECT TO "anon" USING ("public"."can_access_pupil_runtime"("pupil_id"));



CREATE POLICY "Authenticated teachers can insert own attempts" ON "public"."attempts" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_view_pupil"("pupil_id") AND (EXISTS ( SELECT 1
   FROM "public"."assignments_v2" "a"
  WHERE (("a"."id" = "attempts"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"()) AND "public"."can_view_class"("a"."class_id"))))));



CREATE POLICY "Authenticated users can view scoped assignment pupil statuses" ON "public"."assignment_pupil_statuses" FOR SELECT TO "authenticated" USING (("public"."can_view_assignment"("assignment_id") AND "public"."can_view_pupil_history"("pupil_id")));



CREATE POLICY "Authenticated users can view scoped assignment pupil target wor" ON "public"."assignment_pupil_target_words" FOR SELECT TO "authenticated" USING (("public"."can_view_assignment"("assignment_id") AND "public"."can_view_pupil_history"("pupil_id")));



CREATE POLICY "Authenticated users can view scoped assignments" ON "public"."assignments_v2" FOR SELECT TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) OR "public"."can_view_assignment"("id")));



CREATE POLICY "Authenticated users can view scoped attempts" ON "public"."attempts" FOR SELECT TO "authenticated" USING (("public"."can_view_assignment"("assignment_id") AND "public"."can_view_pupil_history"("pupil_id")));



CREATE POLICY "Authenticated users can view scoped auto assign policies" ON "public"."class_auto_assignment_policies" FOR SELECT TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) OR "public"."can_view_class"("class_id")));



CREATE POLICY "Authenticated users can view scoped classes" ON "public"."classes" FOR SELECT TO "authenticated" USING ("public"."can_view_class"("id"));



CREATE POLICY "Authenticated users can view scoped group comparison values" ON "public"."teacher_pupil_group_values" FOR SELECT TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) OR "public"."can_view_pupil_history"("pupil_id")));



CREATE POLICY "Authenticated users can view scoped pupil classes" ON "public"."pupil_classes" FOR SELECT TO "authenticated" USING ("public"."can_view_class"("class_id"));



CREATE POLICY "Authenticated users can view scoped pupils" ON "public"."pupils" FOR SELECT TO "authenticated" USING ("public"."can_view_pupil_history"("id"));



CREATE POLICY "Authenticated users can view scoped tests" ON "public"."tests" FOR SELECT TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) OR "public"."can_view_test"("id")));



CREATE POLICY "Pupil can insert own attempt" ON "public"."attempts" FOR INSERT WITH CHECK (("pupil_id" = "auth"."uid"()));



CREATE POLICY "Staff can view own profile" ON "public"."staff_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Staff can view own role assignments" ON "public"."staff_role_assignments" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."can_manage_roles"("auth"."uid"())));



CREATE POLICY "Staff can view own scope assignments" ON "public"."staff_scope_assignments" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."can_manage_roles"("auth"."uid"())));



CREATE POLICY "Teacher can insert own profile" ON "public"."teachers" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Teacher can manage own assignments" ON "public"."assignments" USING ((EXISTS ( SELECT 1
   FROM "public"."tests"
  WHERE (("tests"."id" = "assignments"."test_id") AND ("tests"."teacher_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tests"
  WHERE (("tests"."id" = "assignments"."test_id") AND ("tests"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teacher can manage own classes" ON "public"."classes" USING (("teacher_id" = "auth"."uid"())) WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teacher can manage own tests" ON "public"."tests" USING (("teacher_id" = "auth"."uid"())) WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teacher can manage words of own tests" ON "public"."test_words" USING ((EXISTS ( SELECT 1
   FROM "public"."tests"
  WHERE (("tests"."id" = "test_words"."test_id") AND ("tests"."teacher_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tests"
  WHERE (("tests"."id" = "test_words"."test_id") AND ("tests"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teacher can update own profile" ON "public"."teachers" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Teacher can view attempts for own tests" ON "public"."attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tests"
  WHERE (("tests"."id" = "attempts"."test_id") AND ("tests"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teacher can view own profile" ON "public"."teachers" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Teachers can delete own AI messages" ON "public"."teacher_ai_messages" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can delete own AI threads" ON "public"."teacher_ai_threads" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can delete own assignments" ON "public"."assignments" FOR DELETE TO "authenticated" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can delete own assignments v2" ON "public"."assignments_v2" FOR DELETE TO "authenticated" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can delete own phonics exceptions" ON "public"."phonics_exceptions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can delete owned assignment pupil statuses" ON "public"."assignment_pupil_statuses" FOR DELETE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."assignments_v2" "a"
  WHERE (("a"."id" = "assignment_pupil_statuses"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can delete owned assignment pupil target words" ON "public"."assignment_pupil_target_words" FOR DELETE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."assignments_v2" "a"
  WHERE (("a"."id" = "assignment_pupil_target_words"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can delete owned auto assign policies" ON "public"."class_auto_assignment_policies" FOR DELETE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "class_auto_assignment_policies"."class_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can delete owned group comparison values" ON "public"."teacher_pupil_group_values" FOR DELETE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."is_teacher_compat"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."pupil_classes" "pc"
     JOIN "public"."classes" "c" ON (("c"."id" = "pc"."class_id")))
  WHERE (("pc"."pupil_id" = "teacher_pupil_group_values"."pupil_id") AND ("pc"."active" IS TRUE) AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can insert own AI messages" ON "public"."teacher_ai_messages" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can insert own AI threads" ON "public"."teacher_ai_threads" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can insert own assignments" ON "public"."assignments" FOR INSERT TO "authenticated" WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can insert own assignments v2" ON "public"."assignments_v2" FOR INSERT TO "authenticated" WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can insert own phonics correction logs" ON "public"."phonics_correction_logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can insert own phonics exceptions" ON "public"."phonics_exceptions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can insert owned assignment pupil statuses" ON "public"."assignment_pupil_statuses" FOR INSERT TO "authenticated" WITH CHECK ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."assignments_v2" "a"
  WHERE (("a"."id" = "assignment_pupil_statuses"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can insert owned assignment pupil target words" ON "public"."assignment_pupil_target_words" FOR INSERT TO "authenticated" WITH CHECK ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."assignments_v2" "a"
  WHERE (("a"."id" = "assignment_pupil_target_words"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can insert owned auto assign policies" ON "public"."class_auto_assignment_policies" FOR INSERT TO "authenticated" WITH CHECK ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "class_auto_assignment_policies"."class_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can insert owned group comparison values" ON "public"."teacher_pupil_group_values" FOR INSERT TO "authenticated" WITH CHECK ((("teacher_id" = "auth"."uid"()) AND "public"."is_teacher_compat"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."pupil_classes" "pc"
     JOIN "public"."classes" "c" ON (("c"."id" = "pc"."class_id")))
  WHERE (("pc"."pupil_id" = "teacher_pupil_group_values"."pupil_id") AND ("pc"."active" IS TRUE) AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can read own assignments" ON "public"."assignments" FOR SELECT TO "authenticated" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can read own assignments v2" ON "public"."assignments_v2" FOR SELECT TO "authenticated" USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can update own AI messages" ON "public"."teacher_ai_messages" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "teacher_id")) WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can update own AI threads" ON "public"."teacher_ai_threads" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "teacher_id")) WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can update own phonics exceptions" ON "public"."phonics_exceptions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "teacher_id")) WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can update owned assignment pupil statuses" ON "public"."assignment_pupil_statuses" FOR UPDATE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."assignments_v2" "a"
  WHERE (("a"."id" = "assignment_pupil_statuses"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"())))))) WITH CHECK ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."assignments_v2" "a"
  WHERE (("a"."id" = "assignment_pupil_statuses"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can update owned assignment pupil target words" ON "public"."assignment_pupil_target_words" FOR UPDATE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."assignments_v2" "a"
  WHERE (("a"."id" = "assignment_pupil_target_words"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"())))))) WITH CHECK ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."assignments_v2" "a"
  WHERE (("a"."id" = "assignment_pupil_target_words"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can update owned auto assign policies" ON "public"."class_auto_assignment_policies" FOR UPDATE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "class_auto_assignment_policies"."class_id") AND ("c"."teacher_id" = "auth"."uid"())))))) WITH CHECK ((("teacher_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classes" "c"
  WHERE (("c"."id" = "class_auto_assignment_policies"."class_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can update owned group comparison values" ON "public"."teacher_pupil_group_values" FOR UPDATE TO "authenticated" USING ((("teacher_id" = "auth"."uid"()) AND "public"."is_teacher_compat"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."pupil_classes" "pc"
     JOIN "public"."classes" "c" ON (("c"."id" = "pc"."class_id")))
  WHERE (("pc"."pupil_id" = "teacher_pupil_group_values"."pupil_id") AND ("pc"."active" IS TRUE) AND ("c"."teacher_id" = "auth"."uid"())))))) WITH CHECK ((("teacher_id" = "auth"."uid"()) AND "public"."is_teacher_compat"("auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."pupil_classes" "pc"
     JOIN "public"."classes" "c" ON (("c"."id" = "pc"."class_id")))
  WHERE (("pc"."pupil_id" = "teacher_pupil_group_values"."pupil_id") AND ("pc"."active" IS TRUE) AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can view own AI messages" ON "public"."teacher_ai_messages" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view own AI threads" ON "public"."teacher_ai_threads" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view own or admin app role" ON "public"."teacher_app_roles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "teacher_id") OR "public"."can_manage_roles"("auth"."uid"())));



CREATE POLICY "Teachers can view own phonics correction logs" ON "public"."phonics_correction_logs" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view own phonics exceptions" ON "public"."phonics_exceptions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "teacher_id"));



ALTER TABLE "public"."assignment_pupil_statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignment_pupil_target_words" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments_v2" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_auto_assignment_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dev allow all pupil_classes" ON "public"."pupil_classes" USING (true) WITH CHECK (true);



CREATE POLICY "dev allow all pupils" ON "public"."pupils" USING (true) WITH CHECK (true);



ALTER TABLE "public"."personalised_automation_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personalised_automation_policy_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personalised_automation_policy_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personalised_generation_run_pupils" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personalised_generation_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phonics_correction_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phonics_exceptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pupil_classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pupil_directory_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pupil_import_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pupils" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_access_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_directory_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_import_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_pending_access_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_pending_access_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_pending_role_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_pending_scope_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_role_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_scope_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher can delete their test questions" ON "public"."test_questions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "test_questions"."test_id") AND ("t"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "teacher can insert their test questions" ON "public"."test_questions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "test_questions"."test_id") AND ("t"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "teacher can select their test questions" ON "public"."test_questions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "test_questions"."test_id") AND ("t"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "teacher can update their test questions" ON "public"."test_questions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "test_questions"."test_id") AND ("t"."teacher_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "test_questions"."test_id") AND ("t"."teacher_id" = "auth"."uid"())))));



ALTER TABLE "public"."teacher_ai_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_ai_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_app_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_pupil_group_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teachers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tests" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































REVOKE ALL ON FUNCTION "public"."activate_staff_pending_access_for_profile"("target_profile_id" "uuid", "target_user_id" "uuid", "signed_in_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_staff_pending_access_for_profile"("target_profile_id" "uuid", "target_user_id" "uuid", "signed_in_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."activate_staff_pending_access_for_profile"("target_profile_id" "uuid", "target_user_id" "uuid", "signed_in_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_staff_pending_access_for_profile"("target_profile_id" "uuid", "target_user_id" "uuid", "signed_in_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_staff_role_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "actor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_staff_role_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "actor_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_staff_role_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "actor_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_staff_role_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "actor_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_staff_scope_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text", "actor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_staff_scope_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text", "actor_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_staff_scope_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text", "actor_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_staff_scope_assignment_internal"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text", "actor_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authenticate_pupil"("requested_username" "text", "requested_pin" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authenticate_pupil"("requested_username" "text", "requested_pin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."authenticate_pupil"("requested_username" "text", "requested_pin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authenticate_pupil"("requested_username" "text", "requested_pin" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bootstrap_first_admin"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bootstrap_first_admin"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bootstrap_first_admin"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bootstrap_first_admin"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."build_pupil_import_row_message"("row_number" integer, "requested_first_name" "text", "requested_surname" "text", "message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."build_pupil_import_row_message"("row_number" integer, "requested_first_name" "text", "requested_surname" "text", "message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_pupil_import_row_message"("row_number" integer, "requested_first_name" "text", "requested_surname" "text", "message" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_access_pupil_assignment_runtime"("requested_pupil_id" "uuid", "requested_assignment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_access_pupil_assignment_runtime"("requested_pupil_id" "uuid", "requested_assignment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_pupil_assignment_runtime"("requested_pupil_id" "uuid", "requested_assignment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_pupil_assignment_runtime"("requested_pupil_id" "uuid", "requested_assignment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_access_pupil_runtime"("requested_pupil_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_access_pupil_runtime"("requested_pupil_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_pupil_runtime"("requested_pupil_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_pupil_runtime"("requested_pupil_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_import_csv"("requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_import_csv"("requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_import_csv"("requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_import_csv"("requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_automation"("requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_automation"("requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_automation"("requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_automation"("requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_roles"("requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_roles"("requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_roles"("requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_roles"("requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_assignment"("requested_assignment_id" "uuid", "requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_assignment"("requested_assignment_id" "uuid", "requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_assignment"("requested_assignment_id" "uuid", "requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_assignment"("requested_assignment_id" "uuid", "requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_class"("requested_class_id" "uuid", "requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_class"("requested_class_id" "uuid", "requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_class"("requested_class_id" "uuid", "requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_class"("requested_class_id" "uuid", "requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_pupil"("requested_pupil_id" "uuid", "requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_pupil"("requested_pupil_id" "uuid", "requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_pupil"("requested_pupil_id" "uuid", "requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_pupil"("requested_pupil_id" "uuid", "requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_pupil_history"("requested_pupil_id" "uuid", "requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_pupil_history"("requested_pupil_id" "uuid", "requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_pupil_history"("requested_pupil_id" "uuid", "requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_pupil_history"("requested_pupil_id" "uuid", "requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_test"("requested_test_id" "uuid", "requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_test"("requested_test_id" "uuid", "requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_test"("requested_test_id" "uuid", "requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_test"("requested_test_id" "uuid", "requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_staff_pending_access_approval"("target_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_staff_pending_access_approval"("target_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_staff_pending_access_approval"("target_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_staff_pending_access_approval"("target_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_assignment_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_assignment_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_assignment_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_class_membership_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_class_membership_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_class_membership_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_legacy_teacher_app_role_lifecycle"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_legacy_teacher_app_role_lifecycle"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_legacy_teacher_app_role_lifecycle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_legacy_teacher_app_role_lifecycle"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_policy"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_policy"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_policy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_policy"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_target"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_target"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_target"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_personalised_automation_policy_overlap_from_target"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_staff_live_access_lifecycle"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_staff_live_access_lifecycle"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_staff_live_access_lifecycle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_staff_live_access_lifecycle"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_teacher_content_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_teacher_content_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_teacher_content_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_form_class_baseline_assignment_internal"("requested_class_id" "uuid", "requested_standard_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_form_class_baseline_assignment_internal"("requested_class_id" "uuid", "requested_standard_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_form_class_baseline_assignment_internal"("requested_class_id" "uuid", "requested_standard_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_form_class_baseline_assignment_internal"("requested_class_id" "uuid", "requested_standard_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_form_class_baseline_assignments"("requested_class_ids" "uuid"[], "requested_standard_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_form_class_baseline_assignments"("requested_class_ids" "uuid"[], "requested_standard_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_form_class_baseline_assignments"("requested_class_ids" "uuid"[], "requested_standard_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_form_class_baseline_assignments"("requested_class_ids" "uuid"[], "requested_standard_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_pupil_import_join_code"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_pupil_import_join_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_pupil_import_join_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_pupil_import_join_code"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_pupil_import_pin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_pupil_import_pin"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_pupil_import_pin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_pupil_import_pin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_pupil_import_username"("requested_first_name" "text", "requested_surname" "text", "requested_mis_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_pupil_import_username"("requested_first_name" "text", "requested_surname" "text", "requested_mis_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_pupil_import_username"("requested_first_name" "text", "requested_surname" "text", "requested_mis_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_pupil_import_username"("requested_first_name" "text", "requested_surname" "text", "requested_mis_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_access_context"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_access_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_access_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_access_context"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_staff_profile_duplicate_conflicts"("target_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_staff_profile_duplicate_conflicts"("target_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_profile_duplicate_conflicts"("target_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_profile_duplicate_conflicts"("target_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_staff_role"("target_user_id" "uuid", "requested_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_staff_role"("target_user_id" "uuid", "requested_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_staff_role"("target_user_id" "uuid", "requested_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_staff_role"("target_user_id" "uuid", "requested_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("requested_role" "text", "requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("requested_role" "text", "requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("requested_role" "text", "requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("requested_role" "text", "requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_scope"("requested_scope_type" "text", "requested_scope_value" "text", "requested_role" "text", "requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_scope"("requested_scope_type" "text", "requested_scope_value" "text", "requested_role" "text", "requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_scope"("requested_scope_type" "text", "requested_scope_value" "text", "requested_role" "text", "requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_scope"("requested_scope_type" "text", "requested_scope_value" "text", "requested_role" "text", "requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_pupil_roster_csv"("import_rows" "jsonb", "import_file_name" "text", "preview_summary" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_pupil_roster_csv"("import_rows" "jsonb", "import_file_name" "text", "preview_summary" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."import_pupil_roster_csv"("import_rows" "jsonb", "import_file_name" "text", "preview_summary" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_pupil_roster_csv"("import_rows" "jsonb", "import_file_name" "text", "preview_summary" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_staff_directory_csv"("import_rows" "jsonb", "import_file_name" "text", "preview_summary" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_staff_directory_csv"("import_rows" "jsonb", "import_file_name" "text", "preview_summary" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."import_staff_directory_csv"("import_rows" "jsonb", "import_file_name" "text", "preview_summary" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_staff_directory_csv"("import_rows" "jsonb", "import_file_name" "text", "preview_summary" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."invalidate_staff_pending_approvals_for_profile"("target_profile_id" "uuid", "failure_reason" "text", "actor_user_id" "uuid", "event_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invalidate_staff_pending_approvals_for_profile"("target_profile_id" "uuid", "failure_reason" "text", "actor_user_id" "uuid", "event_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."invalidate_staff_pending_approvals_for_profile"("target_profile_id" "uuid", "failure_reason" "text", "actor_user_id" "uuid", "event_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invalidate_staff_pending_approvals_for_profile"("target_profile_id" "uuid", "failure_reason" "text", "actor_user_id" "uuid", "event_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin_compat"("requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin_compat"("requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_compat"("requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_compat"("requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_central_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_central_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_central_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_central_owner"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_teacher_compat"("requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_teacher_compat"("requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_teacher_compat"("requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_teacher_compat"("requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."legacy_teacher_app_role"("requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."legacy_teacher_app_role"("requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."legacy_teacher_app_role"("requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."legacy_teacher_app_role"("requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_staff_pending_access_summaries"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_staff_pending_access_summaries"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_staff_pending_access_summaries"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_staff_pending_access_summaries"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_standard_baseline_items"("requested_standard_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_standard_baseline_items"("requested_standard_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."list_standard_baseline_items"("requested_standard_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_standard_baseline_items"("requested_standard_key" "text") TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_unmapped_department_classes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_unmapped_department_classes"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_unmapped_department_classes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_unmapped_department_classes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_viewable_class_ids"("requested_user_id" "uuid", "requested_class_id" "uuid", "requested_year_group" "text", "requested_department_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_viewable_class_ids"("requested_user_id" "uuid", "requested_class_id" "uuid", "requested_year_group" "text", "requested_department_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."list_viewable_class_ids"("requested_user_id" "uuid", "requested_class_id" "uuid", "requested_year_group" "text", "requested_department_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_viewable_class_ids"("requested_user_id" "uuid", "requested_class_id" "uuid", "requested_year_group" "text", "requested_department_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_pupil_directory_event"("actor_user_id" "uuid", "target_pupil_id" "uuid", "event_action" "text", "event_reason" "text", "event_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_pupil_directory_event"("actor_user_id" "uuid", "target_pupil_id" "uuid", "event_action" "text", "event_reason" "text", "event_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_pupil_directory_event"("actor_user_id" "uuid", "target_pupil_id" "uuid", "event_action" "text", "event_reason" "text", "event_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_pupil_directory_event"("actor_user_id" "uuid", "target_pupil_id" "uuid", "event_action" "text", "event_reason" "text", "event_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_staff_access_event"("actor_user_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_role" "text", "event_scope_type" "text", "event_scope_value" "text", "event_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_staff_access_event"("actor_user_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_role" "text", "event_scope_type" "text", "event_scope_value" "text", "event_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_staff_access_event"("actor_user_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_role" "text", "event_scope_type" "text", "event_scope_value" "text", "event_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_staff_access_event"("actor_user_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_role" "text", "event_scope_type" "text", "event_scope_value" "text", "event_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_staff_directory_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_reason" "text", "event_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_staff_directory_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_reason" "text", "event_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_staff_directory_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_reason" "text", "event_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_staff_directory_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_user_id" "uuid", "event_action" "text", "event_reason" "text", "event_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_staff_pending_access_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_approval_id" "uuid", "event_action" "text", "event_message" "text", "event_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_staff_pending_access_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_approval_id" "uuid", "event_action" "text", "event_message" "text", "event_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_staff_pending_access_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_approval_id" "uuid", "event_action" "text", "event_message" "text", "event_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_staff_pending_access_event"("actor_user_id" "uuid", "target_profile_id" "uuid", "target_approval_id" "uuid", "event_action" "text", "event_message" "text", "event_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."move_pupil_form_membership"("target_pupil_id" "uuid", "target_form_class_id" "uuid", "requested_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."move_pupil_form_membership"("target_pupil_id" "uuid", "target_form_class_id" "uuid", "requested_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."move_pupil_form_membership"("target_pupil_id" "uuid", "target_form_class_id" "uuid", "requested_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_pupil_form_membership"("target_pupil_id" "uuid", "target_form_class_id" "uuid", "requested_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_pupil_import_group_value"("requested_group_type" "text", "input_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_pupil_import_group_value"("requested_group_type" "text", "input_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_pupil_import_group_value"("requested_group_type" "text", "input_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_pupil_import_group_value"("requested_group_type" "text", "input_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_pupil_import_lookup_text"("input_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_pupil_import_lookup_text"("input_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_pupil_import_lookup_text"("input_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_staff_scope_input"("requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_staff_scope_input"("requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_staff_scope_input"("requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_staff_scope_input"("requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pupil_directory_duplicate_preflight"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pupil_directory_duplicate_preflight"() TO "anon";
GRANT ALL ON FUNCTION "public"."pupil_directory_duplicate_preflight"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pupil_directory_duplicate_preflight"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."raise_personalised_automation_policy_overlap"("p_policy_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."raise_personalised_automation_policy_overlap"("p_policy_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."raise_personalised_automation_policy_overlap"("p_policy_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."raise_personalised_automation_policy_overlap"("p_policy_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."read_staff_pending_access_detail"("target_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."read_staff_pending_access_detail"("target_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."read_staff_pending_access_detail"("target_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."read_staff_pending_access_detail"("target_profile_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_pupil_login_pin"("target_pupil_id" "uuid", "requested_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_pupil_login_pin"("target_pupil_id" "uuid", "requested_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_pupil_login_pin"("target_pupil_id" "uuid", "requested_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_pupil_login_pin"("target_pupil_id" "uuid", "requested_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_pupil_directory_record"("target_pupil_id" "uuid", "requested_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_staff_directory_record"("target_profile_id" "uuid", "requested_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_all_staff_live_access"("target_user_id" "uuid", "requested_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_all_staff_live_access"("target_user_id" "uuid", "requested_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_all_staff_live_access"("target_user_id" "uuid", "requested_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_all_staff_live_access"("target_user_id" "uuid", "requested_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_staff_role"("target_user_id" "uuid", "requested_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_staff_role"("target_user_id" "uuid", "requested_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_staff_role"("target_user_id" "uuid", "requested_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_staff_role"("target_user_id" "uuid", "requested_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_staff_scope"("target_user_id" "uuid", "requested_role" "text", "requested_scope_type" "text", "requested_scope_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_staff_pending_access_approval"("target_profile_id" "uuid", "requested_roles" "jsonb", "requested_scopes" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_staff_pending_access_approval"("target_profile_id" "uuid", "requested_roles" "jsonb", "requested_scopes" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_staff_pending_access_approval"("target_profile_id" "uuid", "requested_roles" "jsonb", "requested_scopes" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_staff_pending_access_approval"("target_profile_id" "uuid", "requested_roles" "jsonb", "requested_scopes" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_assignment_pupil_overrides_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_assignment_pupil_overrides_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_assignment_pupil_overrides_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_test_groups_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_test_groups_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_test_groups_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_pending_access_duplicate_preflight"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_pending_access_duplicate_preflight"() TO "anon";
GRANT ALL ON FUNCTION "public"."staff_pending_access_duplicate_preflight"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_pending_access_duplicate_preflight"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_role_uses_automatic_school_scope"("requested_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_role_uses_automatic_school_scope"("requested_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."staff_role_uses_automatic_school_scope"("requested_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_role_uses_automatic_school_scope"("requested_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_pupil_class_lifecycle_state"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_pupil_class_lifecycle_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_pupil_class_lifecycle_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_pupil_class_lifecycle_state"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_pupil_record_lifecycle_state"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_pupil_record_lifecycle_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_pupil_record_lifecycle_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_pupil_record_lifecycle_state"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_ensure_form_class_baseline_on_class_write"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_ensure_form_class_baseline_on_class_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_ensure_form_class_baseline_on_class_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_ensure_form_class_baseline_on_class_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_ensure_form_class_baseline_on_membership_write"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_ensure_form_class_baseline_on_membership_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_ensure_form_class_baseline_on_membership_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_ensure_form_class_baseline_on_membership_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_my_staff_profile"("requested_email" "text", "requested_display_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_my_staff_profile"("requested_email" "text", "requested_display_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_my_staff_profile"("requested_email" "text", "requested_display_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_my_staff_profile"("requested_email" "text", "requested_display_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."user_has_staff_data"("requested_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_has_staff_data"("requested_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_staff_data"("requested_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_staff_data"("requested_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_pupil_runtime_session"("requested_pupil_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_pupil_runtime_session"("requested_pupil_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_pupil_runtime_session"("requested_pupil_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_pupil_runtime_session"("requested_pupil_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."assignment_pupil_overrides" TO "anon";
GRANT ALL ON TABLE "public"."assignment_pupil_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_pupil_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."assignment_pupil_statuses" TO "anon";
GRANT ALL ON TABLE "public"."assignment_pupil_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_pupil_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."assignment_pupil_target_words" TO "anon";
GRANT ALL ON TABLE "public"."assignment_pupil_target_words" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_pupil_target_words" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."assignments_v2" TO "anon";
GRANT ALL ON TABLE "public"."assignments_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments_v2" TO "service_role";



GRANT ALL ON TABLE "public"."attempts" TO "anon";
GRANT ALL ON TABLE "public"."attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."attempts" TO "service_role";



GRANT ALL ON TABLE "public"."class_auto_assignment_policies" TO "anon";
GRANT ALL ON TABLE "public"."class_auto_assignment_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."class_auto_assignment_policies" TO "service_role";



GRANT ALL ON TABLE "public"."personalised_automation_policies" TO "anon";
GRANT ALL ON TABLE "public"."personalised_automation_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."personalised_automation_policies" TO "service_role";



GRANT ALL ON TABLE "public"."personalised_automation_policy_events" TO "anon";
GRANT ALL ON TABLE "public"."personalised_automation_policy_events" TO "authenticated";
GRANT ALL ON TABLE "public"."personalised_automation_policy_events" TO "service_role";



GRANT ALL ON TABLE "public"."personalised_automation_policy_targets" TO "anon";
GRANT ALL ON TABLE "public"."personalised_automation_policy_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."personalised_automation_policy_targets" TO "service_role";



GRANT ALL ON TABLE "public"."personalised_generation_run_pupils" TO "anon";
GRANT ALL ON TABLE "public"."personalised_generation_run_pupils" TO "authenticated";
GRANT ALL ON TABLE "public"."personalised_generation_run_pupils" TO "service_role";



GRANT ALL ON TABLE "public"."personalised_generation_runs" TO "anon";
GRANT ALL ON TABLE "public"."personalised_generation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."personalised_generation_runs" TO "service_role";



GRANT ALL ON TABLE "public"."phonics_correction_logs" TO "anon";
GRANT ALL ON TABLE "public"."phonics_correction_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."phonics_correction_logs" TO "service_role";



GRANT ALL ON TABLE "public"."phonics_exceptions" TO "anon";
GRANT ALL ON TABLE "public"."phonics_exceptions" TO "authenticated";
GRANT ALL ON TABLE "public"."phonics_exceptions" TO "service_role";



GRANT ALL ON TABLE "public"."pupil_classes" TO "anon";
GRANT ALL ON TABLE "public"."pupil_classes" TO "authenticated";
GRANT ALL ON TABLE "public"."pupil_classes" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pupil_directory_audit_log" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pupil_directory_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."pupil_directory_audit_log" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pupil_import_batches" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pupil_import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."pupil_import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."pupils" TO "anon";
GRANT ALL ON TABLE "public"."pupils" TO "authenticated";
GRANT ALL ON TABLE "public"."pupils" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_access_audit_log" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_access_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_access_audit_log" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_directory_audit_log" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_directory_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_directory_audit_log" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_import_batches" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_import_batches" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_pending_access_approvals" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_pending_access_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_pending_access_approvals" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_pending_access_audit_log" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_pending_access_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_pending_access_audit_log" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_pending_role_assignments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_pending_role_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_pending_role_assignments" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_pending_scope_assignments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_pending_scope_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_pending_scope_assignments" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_role_assignments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_role_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_role_assignments" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_scope_assignments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_scope_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_scope_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_ai_messages" TO "anon";
GRANT ALL ON TABLE "public"."teacher_ai_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_ai_messages" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_ai_threads" TO "anon";
GRANT ALL ON TABLE "public"."teacher_ai_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_ai_threads" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."teacher_app_roles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."teacher_app_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_app_roles" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_pupil_group_values" TO "anon";
GRANT ALL ON TABLE "public"."teacher_pupil_group_values" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_pupil_group_values" TO "service_role";



GRANT ALL ON TABLE "public"."teachers" TO "anon";
GRANT ALL ON TABLE "public"."teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."teachers" TO "service_role";



GRANT ALL ON TABLE "public"."test_groups" TO "anon";
GRANT ALL ON TABLE "public"."test_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."test_groups" TO "service_role";



GRANT ALL ON TABLE "public"."test_questions" TO "anon";
GRANT ALL ON TABLE "public"."test_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."test_questions" TO "service_role";



GRANT ALL ON TABLE "public"."test_words" TO "anon";
GRANT ALL ON TABLE "public"."test_words" TO "authenticated";
GRANT ALL ON TABLE "public"."test_words" TO "service_role";



GRANT ALL ON TABLE "public"."tests" TO "anon";
GRANT ALL ON TABLE "public"."tests" TO "authenticated";
GRANT ALL ON TABLE "public"."tests" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































