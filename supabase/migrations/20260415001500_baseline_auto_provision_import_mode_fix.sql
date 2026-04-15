-- Allow admin-owned pupil import and baseline auto-provisioning writes
-- through the existing teacher-owned content and assignment triggers.

create or replace function public.enforce_teacher_content_write()
returns trigger
language plpgsql
set search_path = public
as $$
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

create or replace function public.ensure_form_class_baseline_assignments(
  requested_class_ids uuid[],
  requested_standard_key text default 'core_v1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
