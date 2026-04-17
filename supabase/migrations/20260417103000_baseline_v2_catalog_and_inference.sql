CREATE OR REPLACE FUNCTION "public"."is_standard_baseline_choice"("choice_payload" "jsonb", "required_standard_key" "text" DEFAULT 'core_v2'::"text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  safe_required_key text := lower(regexp_replace(coalesce(required_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
  source_key text := lower(btrim(coalesce(choice_payload ->> 'source', '')));
  choice_standard_key text := lower(regexp_replace(coalesce(choice_payload ->> 'baseline_standard_key', ''), '[^a-z0-9_-]+', '', 'g'));
begin
  if safe_required_key = '' then
    safe_required_key := 'core_v2';
  end if;

  return choice_standard_key = safe_required_key
    and (
      source_key in ('baseline_v1', 'baseline_v2')
      or lower(btrim(coalesce(choice_payload ->> 'baseline_v1', ''))) in ('true', '1', 'yes')
      or lower(btrim(coalesce(choice_payload ->> 'baseline_v2', ''))) in ('true', '1', 'yes')
    );
end;
$$;


ALTER FUNCTION "public"."is_standard_baseline_choice"("choice_payload" "jsonb", "required_standard_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."standard_baseline_item_difficulty"("item_word" "text", "requested_standard_key" "text" DEFAULT 'core_v2'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  safe_standard_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
  clean_word text := lower(btrim(coalesce(item_word, '')));
  core_score integer := null;
  band_key text := null;
  band_label text := null;
begin
  if safe_standard_key = '' then
    safe_standard_key := 'core_v2';
  end if;

  if safe_standard_key <> 'core_v2' then
    return null;
  end if;

  core_score := case clean_word
    when 'boat' then 9
    when 'seed' then 14
    when 'train' then 18
    when 'light' then 18
    when 'paint' then 18
    when 'point' then 18
    when 'fair' then 15
    when 'sharp' then 22
    when 'nurse' then 23
    when 'storm' then 26
    when 'enough' then 36
    when 'special' then 41
    when 'science' then 42
    when 'question' then 46
    when 'daughter' then 63
    when 'communication' then 62
    when 'description' then 68
    when 'subtraction' then 76
    else null
  end;

  if core_score is null then
    return null;
  end if;

  band_key := case
    when core_score >= 80 then 'challenge'
    when core_score >= 60 then 'stretch'
    when core_score >= 35 then 'core'
    else 'easier'
  end;
  band_label := case band_key
    when 'challenge' then 'Challenge'
    when 'stretch' then 'Stretch'
    when 'core' then 'Core'
    else 'Easier'
  end;

  return jsonb_build_object(
    'version', 'research_v2',
    'coreScore', core_score,
    'adjustedScore', core_score,
    'score', core_score,
    'band', band_key,
    'coreBand', band_key,
    'label', band_label,
    'coreLabel', band_label,
    'reasons', jsonb_build_array('baseline catalog difficulty'),
    'modifierReasons', '[]'::jsonb,
    'flags', jsonb_build_object('tricky_word', false),
    'features', jsonb_build_object(
      'prefixCount', 0,
      'suffixCount', 0,
      'trickyWord', false
    ),
    'components', jsonb_build_object(
      'morphology', 0
    ),
    'modifiers', jsonb_build_object(
      'trickyWordDelta', 0,
      'totalAdjustment', 0
    )
  );
end;
$$;


ALTER FUNCTION "public"."standard_baseline_item_difficulty"("item_word" "text", "requested_standard_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_standard_baseline_items"("requested_standard_key" "text" DEFAULT 'core_v2'::"text") RETURNS TABLE("word_position" integer, "word" "text", "segments" "text"[], "question_type" "text", "stage" "text", "signal" "text", "focus_grapheme" "text", "preset" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  safe_standard_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
begin
  if safe_standard_key = '' then
    safe_standard_key := 'core_v2';
  end if;

  if safe_standard_key not in ('core_v1', 'core_v2') then
    raise exception 'Standard baseline definition "%" is not available.', safe_standard_key;
  end if;

  if safe_standard_key = 'core_v1' then
    return query
    values
      (1,  'train',  array['t','r','ai','n']::text[],      'segmented_spelling',             'broad_sweep',       'independent', 'ai',   'core'),
      (2,  'seed',   array['s','ee','d']::text[],          'segmented_spelling',             'broad_sweep',       'independent', 'ee',   'core'),
      (3,  'boat',   array['b','oa','t']::text[],          'segmented_spelling',             'broad_sweep',       'independent', 'oa',   'core'),
      (4,  'light',  array['l','igh','t']::text[],         'segmented_spelling',             'broad_sweep',       'independent', 'igh',  'core'),
      (5,  'sharp',  array['sh','ar','p']::text[],         'segmented_spelling',             'broad_sweep',       'independent', 'ar',   'core'),
      (6,  'storm',  array['s','t','or','m']::text[],      'segmented_spelling',             'broad_sweep',       'independent', 'or',   'core'),
      (7,  'turn',   array['t','ur','n']::text[],          'segmented_spelling',             'placement_confirm', 'independent', 'ur',   'core'),
      (8,  'cloud',  array['c','l','ow','d']::text[],      'segmented_spelling',             'placement_confirm', 'independent', 'ow',   'core'),
      (9,  'play',   array['p','l','ay']::text[],          'segmented_spelling',             'placement_confirm', 'independent', 'ay',   'core'),
      (10, 'beach',  array['b','ea','ch']::text[],         'segmented_spelling',             'placement_confirm', 'independent', 'ea',   'core'),
      (11, 'coin',   array['c','oi','n']::text[],          'segmented_spelling',             'placement_confirm', 'independent', 'oi',   'core'),
      (12, 'chair',  array['ch','air']::text[],            'segmented_spelling',             'placement_confirm', 'independent', 'air',  'core'),
      (13, 'paint',  array['p','ai','n','t']::text[],      'multiple_choice_grapheme_picker','diagnostic_check',  'diagnostic',  'ai',   'core'),
      (14, 'point',  array['p','oi','n','t']::text[],      'multiple_choice_grapheme_picker','diagnostic_check',  'diagnostic',  'oi',   'core'),
      (15, 'fair',   array['f','air']::text[],             'focus_sound',                    'diagnostic_check',  'diagnostic',  'air',  'core'),
      (16, 'nurse',  array['n','ur','s','e']::text[],      'focus_sound',                    'diagnostic_check',  'diagnostic',  'ur',   'core');
    return;
  end if;

  return query
  values
    (1,  'boat',          array['b','oa','t']::text[],                         'segmented_spelling',             'floor_core',        'independent', 'oa',   'core'),
    (2,  'seed',          array['s','ee','d']::text[],                         'segmented_spelling',             'floor_core',        'independent', 'ee',   'core'),
    (3,  'train',         array['t','r','ai','n']::text[],                     'segmented_spelling',             'floor_core',        'independent', 'ai',   'core'),
    (4,  'light',         array['l','igh','t']::text[],                        'segmented_spelling',             'floor_core',        'independent', 'igh',  'core'),
    (5,  'sharp',         array['sh','ar','p']::text[],                        'segmented_spelling',             'floor_core',        'independent', 'ar',   'core'),
    (6,  'storm',         array['s','t','or','m']::text[],                     'segmented_spelling',             'floor_core',        'independent', 'or',   'core'),
    (7,  'enough',        array['e','n','ou','gh']::text[],                    'segmented_spelling',             'floor_core',        'independent', 'ou',   'core'),
    (8,  'special',       array['s','p','e','ci','a','l']::text[],             'segmented_spelling',             'floor_core',        'independent', 'ci',   'core'),
    (9,  'science',       array['s','c','ie','n','c','e']::text[],             'segmented_spelling',             'floor_core',        'independent', 'ie',   'core'),
    (10, 'question',      array['qu','e','s','tion']::text[],                  'segmented_spelling',             'floor_core',        'independent', 'tion', 'core'),
    (11, 'paint',         array['p','ai','n','t']::text[],                     'multiple_choice_grapheme_picker','diagnostic',        'diagnostic',  'ai',   'core'),
    (12, 'point',         array['p','oi','n','t']::text[],                     'multiple_choice_grapheme_picker','diagnostic',        'diagnostic',  'oi',   'core'),
    (13, 'fair',          array['f','air']::text[],                            'focus_sound',                    'diagnostic',        'diagnostic',  'air',  'core'),
    (14, 'nurse',         array['n','ur','s','e']::text[],                     'focus_sound',                    'diagnostic',        'diagnostic',  'ur',   'core'),
    (15, 'daughter',      array['d','au','g','h','t','er']::text[],            'segmented_spelling',             'ceiling_challenge', 'ceiling',     'au',   'core'),
    (16, 'communication', array['c','o','m','m','u','n','i','c','a','tion']::text[], 'segmented_spelling',       'ceiling_challenge', 'ceiling',     'tion', 'core'),
    (17, 'description',   array['d','e','s','c','r','i','p','tion']::text[],   'segmented_spelling',             'ceiling_challenge', 'ceiling',     'tion', 'core'),
    (18, 'subtraction',   array['s','u','b','t','r','a','c','tion']::text[],   'segmented_spelling',             'ceiling_challenge', 'ceiling',     'tion', 'core');
end;
$$;


ALTER FUNCTION "public"."list_standard_baseline_items"("requested_standard_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_form_class_baseline_assignment_internal"("requested_class_id" "uuid", "requested_standard_key" "text" DEFAULT 'core_v2'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_class public.classes%rowtype;
  safe_standard_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
  baseline_source text;
  baseline_version text;
  existing_assignment_id uuid;
  created_test_id uuid;
  created_assignment_id uuid;
  baseline_title text;
begin
  if requested_class_id is null then
    return jsonb_build_object(
      'status', 'skipped',
      'created', false,
      'reason', 'missing_class_id'
    );
  end if;

  if safe_standard_key = '' then
    safe_standard_key := 'core_v2';
  end if;

  if safe_standard_key not in ('core_v1', 'core_v2') then
    raise exception 'Standard baseline definition "%" is not available.', safe_standard_key;
  end if;

  baseline_source := case when safe_standard_key = 'core_v2' then 'baseline_v2' else 'baseline_v1' end;
  baseline_version := case when safe_standard_key = 'core_v2' then 'v2' else 'v1' end;

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
      bool_and(public.is_standard_baseline_choice(tw.choice, safe_standard_key)) as all_required_baseline_rows
    from public.assignments_v2 as a
    inner join public.tests as t
      on t.id = a.test_id
    inner join public.test_words as tw
      on tw.test_id = t.id
    where a.class_id = target_class.id
    group by a.id, a.created_at
  ) as candidate
  where candidate.all_required_baseline_rows is true
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

  baseline_title := format(
    'Baseline Test | %s | %s',
    coalesce(nullif(btrim(coalesce(target_class.name, '')), ''), 'Class'),
    to_char(timezone('utc', now()), 'YYYY-MM-DD')
  );

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
    to_jsonb(prepared.segments),
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
          'difficulty', public.standard_baseline_item_difficulty(item.word, safe_standard_key),
          'source', baseline_source,
          'question_type', item.question_type,
          'max_attempts', 1,
          'baseline_v1', case when baseline_source = 'baseline_v1' then true else null end,
          'baseline_v2', case when baseline_source = 'baseline_v2' then true else null end,
          'baseline_version', baseline_version,
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


CREATE OR REPLACE FUNCTION "public"."ensure_form_class_baseline_assignments"("requested_class_ids" "uuid"[], "requested_standard_key" "text" DEFAULT 'core_v2'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  safe_standard_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
  class_id uuid;
  helper_result jsonb;
  results jsonb := '[]'::jsonb;
  created_count integer := 0;
begin
  if safe_standard_key = '' then
    safe_standard_key := 'core_v2';
  end if;

  if requested_class_ids is null or coalesce(array_length(requested_class_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'status', 'skipped',
      'created_count', 0,
      'results', results,
      'standard_key', safe_standard_key
    );
  end if;

  foreach class_id in array requested_class_ids loop
    helper_result := public.ensure_form_class_baseline_assignment_internal(class_id, safe_standard_key);
    results := results || jsonb_build_array(helper_result);
    if coalesce((helper_result ->> 'created')::boolean, false) then
      created_count := created_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'ok',
    'created_count', created_count,
    'results', results,
    'standard_key', safe_standard_key
  );
end;
$$;


ALTER FUNCTION "public"."ensure_form_class_baseline_assignments"("requested_class_ids" "uuid"[], "requested_standard_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text" DEFAULT 'core_v2'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  safe_required_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
  active_class_ids uuid[] := array[]::uuid[];
  active_form_class_ids uuid[] := array[]::uuid[];
  selected_assignment_id uuid := null;
  selected_assignment_payload jsonb := null;
  selected_rank integer := null;
begin
  if safe_required_key = '' then
    safe_required_key := 'core_v2';
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
      and bool_and(public.is_standard_baseline_choice(tw.choice, safe_required_key))
  ),
  ranked_baseline_assignments as (
    select
      candidate.*,
      case
        when candidate.completed_at is not null then 0
        when candidate.started_at is not null
          or lower(btrim(coalesce(candidate.assignment_status, ''))) = 'started'
          or (
            jsonb_typeof(candidate.result_json) = 'array'
            and jsonb_array_length(candidate.result_json) > 0
          )
          then 1
        else 2
      end as state_rank
    from required_baseline_assignments as candidate
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
      'assignment_status',
        case
          when candidate.state_rank = 0 then coalesce(nullif(btrim(coalesce(candidate.assignment_status, '')), ''), 'completed')
          when candidate.state_rank = 1 then coalesce(nullif(btrim(coalesce(candidate.assignment_status, '')), ''), 'started')
          else coalesce(nullif(btrim(coalesce(candidate.assignment_status, '')), ''), 'assigned')
        end,
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
    ),
    candidate.state_rank
  into selected_assignment_id, selected_assignment_payload, selected_rank
  from ranked_baseline_assignments as candidate
  order by candidate.state_rank asc, candidate.end_at asc nulls last, candidate.created_at desc, candidate.id desc
  limit 1;

  if selected_assignment_id is null then
    return jsonb_build_object(
      'status', 'waiting',
      'waiting_reason', 'no_baseline_assignment',
      'assignment_id', null,
      'required_standard_key', safe_required_key,
      'class_ids', to_jsonb(active_class_ids),
      'form_class_ids', to_jsonb(active_form_class_ids),
      'assignment', null
    );
  end if;

  if selected_rank = 0 then
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

  if selected_rank = 1 then
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

  return jsonb_build_object(
    'status', 'start',
    'waiting_reason', null,
    'assignment_id', selected_assignment_id,
    'required_standard_key', safe_required_key,
    'class_ids', to_jsonb(active_class_ids),
    'form_class_ids', to_jsonb(active_form_class_ids),
    'assignment', selected_assignment_payload
  );
end;
$$;


ALTER FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_ensure_form_class_baseline_on_class_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op in ('INSERT', 'UPDATE')
    and coalesce(nullif(lower(btrim(coalesce(new.class_type, ''))), ''), 'form') = 'form'
  then
    perform public.ensure_form_class_baseline_assignment_internal(new.id, 'core_v2');
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_ensure_form_class_baseline_on_class_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_ensure_form_class_baseline_on_membership_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op in ('INSERT', 'UPDATE') and coalesce(new.active, true) is true then
    perform public.ensure_form_class_baseline_assignment_internal(new.class_id, 'core_v2');
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_ensure_form_class_baseline_on_membership_write"() OWNER TO "postgres";
