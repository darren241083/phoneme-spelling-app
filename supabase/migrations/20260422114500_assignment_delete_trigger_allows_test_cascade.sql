begin;

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

  if tg_op = 'DELETE' then
    if old.teacher_id is distinct from actor_user_id then
      raise exception 'You can only delete your own assignments.';
    end if;

    return old;
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

  return new;
end;
$$;

ALTER FUNCTION "public"."enforce_assignment_write"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."enforce_assignment_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_assignment_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_assignment_write"() TO "service_role";

commit;
