-- Fix ambiguous PL/pgSQL variable vs temp-table column references in pupil CSV import.
-- This replaces the RPC body without relying on previously applied migration files.

create or replace function public.import_pupil_roster_csv(
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

revoke all on function public.import_pupil_roster_csv(jsonb, text, jsonb) from public;
grant execute on function public.import_pupil_roster_csv(jsonb, text, jsonb) to authenticated, service_role;
