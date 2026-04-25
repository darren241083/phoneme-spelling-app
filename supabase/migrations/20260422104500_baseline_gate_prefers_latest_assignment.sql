begin;

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
  order by candidate.created_at desc nulls last, candidate.end_at asc nulls last, candidate.id desc
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

REVOKE ALL ON FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."read_pupil_baseline_gate_state"("requested_pupil_id" "uuid", "requested_standard_key" "text") TO "service_role";

commit;
