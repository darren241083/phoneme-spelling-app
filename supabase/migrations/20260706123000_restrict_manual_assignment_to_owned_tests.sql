begin;

CREATE OR REPLACE FUNCTION "public"."enforce_assignment_write"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  checked_teacher_id uuid := coalesce(new.teacher_id, old.teacher_id);
  checked_class_id uuid := coalesce(new.class_id, old.class_id);
  checked_test_id uuid := coalesce(new.test_id, old.test_id);
  checked_school_id uuid := coalesce(new.school_id, old.school_id);
  class_school_id uuid;
  test_teacher_id uuid;
  test_school_id uuid;
  test_status text := '';
  test_is_generated boolean := false;
  assignment_changes_test boolean := false;
  assignment_automation_kind text := '';
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
    raise exception 'Teacher access is required before changing assignments.';
  end if;

  if tg_op = 'DELETE' then
    if old.teacher_id is distinct from actor_user_id then
      raise exception 'You can only delete your own assignments.';
    end if;

    return old;
  end if;

  if tg_op = 'INSERT' then
    assignment_changes_test := true;
  elsif tg_op = 'UPDATE' then
    assignment_changes_test := new.test_id is distinct from old.test_id;
  end if;
  assignment_automation_kind := coalesce(lower(btrim(new.automation_kind)), '');

  if checked_teacher_id is distinct from actor_user_id then
    raise exception 'You can only manage your own assignments.';
  end if;

  if tg_op = 'UPDATE' and old.teacher_id is distinct from actor_user_id then
    raise exception 'You can only update your own assignments.';
  end if;

  select coalesce(c.school_id, public.default_legacy_school_id())
    into class_school_id
  from public.classes as c
  where c.id = checked_class_id
    and c.teacher_id = actor_user_id;

  if class_school_id is null then
    raise exception 'You can only assign tests to your own classes.';
  end if;

  if not admin_import_enabled and not public.is_teacher_compat(actor_user_id, class_school_id) then
    raise exception 'Teacher access in this school is required before changing assignments.';
  end if;

  if coalesce(checked_school_id, class_school_id) is distinct from class_school_id then
    raise exception 'Assignments must stay in the selected class school.';
  end if;

  if tg_op = 'INSERT' and new.school_id is null then
    new.school_id := class_school_id;
  end if;

  select
      t.teacher_id,
      coalesce(t.school_id, public.default_legacy_school_id()),
      lower(btrim(coalesce(t.status, '')))
    into test_teacher_id, test_school_id, test_status
  from public.tests as t
  where t.id = checked_test_id
    and (
      t.teacher_id = actor_user_id
      or public.can_view_test(t.id, actor_user_id)
    );

  if test_school_id is null then
    raise exception 'You can only assign visible tests.';
  end if;

  if test_school_id is distinct from class_school_id then
    raise exception 'Tests can only be assigned inside their own school.';
  end if;

  if assignment_changes_test then
    if assignment_automation_kind <> 'personalised'
      and test_teacher_id is distinct from actor_user_id then
      raise exception 'Only the teacher who created this test can assign it.';
    end if;

    if test_status in ('draft', 'private', 'archived') then
      raise exception 'Draft and private tests cannot be assigned from the dashboard.';
    end if;

    if assignment_automation_kind <> 'personalised' then
      select coalesce(
        bool_and(
          lower(btrim(coalesce(tw.choice ->> 'source', ''))) in ('assignment_engine', 'assignment_engine_pool')
        ),
        false
      )
        into test_is_generated
      from public.test_words as tw
      where tw.test_id = checked_test_id;

      if test_is_generated then
        raise exception 'Auto-generated tests cannot be manually assigned from the dashboard.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."enforce_assignment_write"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."enforce_assignment_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_assignment_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_assignment_write"() TO "service_role";

commit;
