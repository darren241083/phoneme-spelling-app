-- Harden baseline auto-provisioning against schema shape differences.
-- In particular, support either array-backed or json-backed test_words.segments,
-- and tolerate older test / assignment analytics columns being absent.

create or replace function public.ensure_form_class_baseline_assignment_internal(
  requested_class_id uuid,
  requested_standard_key text default 'core_v1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
