-- Read the pupil baseline gate from the backend so first-login baseline
-- does not depend on broad anon access to assignments/tests/classes.

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

  if requested_pupil_id is null then
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

revoke all on function public.read_pupil_baseline_gate_state(uuid, text) from public;
grant execute on function public.read_pupil_baseline_gate_state(uuid, text) to anon, authenticated, service_role;
