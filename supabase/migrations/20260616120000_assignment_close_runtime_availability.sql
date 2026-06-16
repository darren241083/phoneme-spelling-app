begin;

create or replace function public.can_access_pupil_assignment_runtime(
  requested_pupil_id uuid,
  requested_assignment_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
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
        and (
          a.end_at is null
          or a.end_at > timezone('utc', now())
          or lower(btrim(coalesce(a.automation_kind, ''))) = 'spelling_bee'
          or coalesce(nullif(lower(btrim(coalesce(a.evidence_source, ''))), ''), 'assigned_core') = 'extra_challenge'
          or exists (
            select 1
            from public.assignment_pupil_statuses as completed_status
            where completed_status.assignment_id = a.id
              and completed_status.pupil_id = requested_pupil_id
              and (
                completed_status.completed_at is not null
                or lower(btrim(coalesce(completed_status.status, ''))) in ('completed', 'complete')
              )
          )
          or (
            exists (
              select 1
              from public.test_words as baseline_word
              where baseline_word.test_id = a.test_id
            )
            and not exists (
              select 1
              from public.test_words as non_baseline_word
              where non_baseline_word.test_id = a.test_id
                and not (
                  lower(btrim(coalesce(non_baseline_word.choice ->> 'source', ''))) in ('baseline_v1', 'baseline_v2')
                  or lower(btrim(coalesce(non_baseline_word.choice ->> 'baseline_v1', ''))) in ('true', '1', 'yes')
                  or lower(btrim(coalesce(non_baseline_word.choice ->> 'baseline_v2', ''))) in ('true', '1', 'yes')
                  or nullif(btrim(coalesce(non_baseline_word.choice ->> 'baseline_standard_key', '')), '') is not null
                )
            )
          )
        )
        and (
          coalesce(nullif(lower(btrim(coalesce(a.evidence_source, ''))), ''), 'assigned_core') <> 'extra_challenge'
          or exists (
            select 1
            from public.assignment_pupil_target_words as target_word
            where target_word.assignment_id = a.id
              and target_word.pupil_id = requested_pupil_id
          )
          or exists (
            select 1
            from public.assignment_pupil_statuses as status_row
            where status_row.assignment_id = a.id
              and status_row.pupil_id = requested_pupil_id
          )
        )
    );
$$;

alter function public.can_access_pupil_assignment_runtime(uuid, uuid) owner to postgres;

revoke all on function public.can_access_pupil_assignment_runtime(uuid, uuid) from public;
grant execute on function public.can_access_pupil_assignment_runtime(uuid, uuid) to anon;
grant execute on function public.can_access_pupil_assignment_runtime(uuid, uuid) to authenticated;
grant execute on function public.can_access_pupil_assignment_runtime(uuid, uuid) to service_role;

create or replace function public.read_pupil_runtime_assignments(requested_pupil_id uuid) returns jsonb
language sql
security definer
set search_path to 'public'
as $$
with runtime as (
  select requested_pupil_id as pupil_id
  where requested_pupil_id is not null
    and public.can_access_pupil_runtime(requested_pupil_id)
),
active_classes as (
  select distinct pc.class_id
  from public.pupil_classes as pc
  inner join runtime as r
    on r.pupil_id = pc.pupil_id
  where pc.active is true
),
assignment_rows as (
  select
    a.id,
    a.teacher_id,
    a.test_id,
    a.class_id,
    a.mode,
    a.max_attempts,
    a.audio_enabled,
    a.hints_enabled,
    a.analytics_target_words_enabled,
    a.analytics_target_words_per_pupil,
    a.automation_kind,
    a.automation_source,
    a.automation_run_id,
    a.automation_triggered_by,
    coalesce(nullif(lower(btrim(coalesce(a.evidence_source, ''))), ''), 'assigned_core') as evidence_source,
    a.end_at,
    a.created_at,
    t.title,
    t.question_type
  from public.assignments_v2 as a
  inner join active_classes as ac
    on ac.class_id = a.class_id
  inner join public.tests as t
    on t.id = a.test_id
  where (
    lower(btrim(coalesce(a.automation_kind, ''))) <> 'spelling_bee'
    or a.automation_run_id is null
    or (
      not exists (
        select 1
        from public.personalised_generation_run_pupils as bee_run_pupil_rows
        where bee_run_pupil_rows.run_id = a.automation_run_id
      )
      and not exists (
        select 1
        from public.personalised_generation_runs as bee_run
        where bee_run.id = a.automation_run_id
          and lower(btrim(coalesce(bee_run.status, ''))) = 'running'
      )
    )
    or exists (
      select 1
      from public.personalised_generation_run_pupils as own_bee_run_pupil
      where own_bee_run_pupil.run_id = a.automation_run_id
        and own_bee_run_pupil.assignment_id = a.id
        and own_bee_run_pupil.pupil_id = requested_pupil_id
        and lower(btrim(coalesce(own_bee_run_pupil.status, ''))) = 'included'
    )
  )
  and (
    coalesce(nullif(lower(btrim(coalesce(a.evidence_source, ''))), ''), 'assigned_core') <> 'extra_challenge'
    or exists (
      select 1
      from public.assignment_pupil_target_words as extra_target_word
      where extra_target_word.assignment_id = a.id
        and extra_target_word.pupil_id = requested_pupil_id
    )
    or exists (
      select 1
      from public.assignment_pupil_statuses as extra_status_row
      where extra_status_row.assignment_id = a.id
        and extra_status_row.pupil_id = requested_pupil_id
    )
  )
),
base_words as (
  select
    ar.id as assignment_id,
    count(tw.id)::integer as word_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', tw.id,
          'position', tw.position,
          'word', tw.word,
          'sentence', tw.sentence,
          'segments', coalesce(tw.segments, '[]'::jsonb),
          'choice', coalesce(tw.choice, '{}'::jsonb)
        )
        order by tw.position
      ) filter (where tw.id is not null),
      '[]'::jsonb
    ) as words,
    coalesce(
      bool_and(
        lower(btrim(coalesce(tw.choice ->> 'source', ''))) in ('baseline_v1', 'baseline_v2')
        or lower(btrim(coalesce(tw.choice ->> 'baseline_v1', ''))) in ('true', '1', 'yes')
        or lower(btrim(coalesce(tw.choice ->> 'baseline_v2', ''))) in ('true', '1', 'yes')
        or nullif(btrim(coalesce(tw.choice ->> 'baseline_standard_key', '')), '') is not null
      ) filter (where tw.id is not null),
      false
    ) as all_baseline,
    coalesce(
      bool_and(lower(btrim(coalesce(tw.choice ->> 'source', ''))) = 'assignment_engine')
        filter (where tw.id is not null),
      false
    ) as all_assignment_engine
  from assignment_rows as ar
  left join public.test_words as tw
    on tw.test_id = ar.test_id
  group by ar.id
),
target_words as (
  select
    ar.id as assignment_id,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', 'target:' || target_row.assignment_target_id::text,
          'base_test_word_id', target_row.test_word_id,
          'assignment_target_id', target_row.assignment_target_id,
          'is_target_word', true,
          'position',
            case
              when lower(btrim(coalesce(ar.automation_kind, ''))) = 'personalised'
                or bw.all_assignment_engine
              then target_row.target_position
              else bw.word_count + target_row.target_position
            end,
          'word', target_row.word,
          'sentence', target_row.sentence,
          'segments', coalesce(target_row.segments, '[]'::jsonb),
          'choice',
            coalesce(target_row.choice, '{}'::jsonb)
            || jsonb_build_object(
              'focus_graphemes',
              case
                when nullif(btrim(coalesce(target_row.focus_grapheme, '')), '') is not null
                then jsonb_build_array(lower(btrim(target_row.focus_grapheme)))
                else coalesce(target_row.choice -> 'focus_graphemes', '[]'::jsonb)
              end
            ),
          'target_reason', coalesce(nullif(btrim(coalesce(target_row.target_reason, '')), ''), 'focus_grapheme'),
          'target_source', coalesce(nullif(btrim(coalesce(target_row.target_source, '')), ''), 'analytics'),
          'target_created_at', target_row.created_at
        )
        order by target_row.target_position
      )
      from (
        select
          aptw.id as assignment_target_id,
          aptw.test_word_id,
          aptw.focus_grapheme,
          aptw.target_source,
          aptw.target_reason,
          aptw.created_at,
          tw.word,
          tw.sentence,
          tw.segments,
          tw.choice,
          row_number() over (order by aptw.created_at, tw.position, aptw.id)::integer as target_position
        from public.assignment_pupil_target_words as aptw
        inner join public.test_words as tw
          on tw.id = aptw.test_word_id
        where aptw.assignment_id = ar.id
          and aptw.pupil_id = requested_pupil_id
      ) as target_row
    ), '[]'::jsonb) as words
  from assignment_rows as ar
  inner join base_words as bw
    on bw.assignment_id = ar.id
),
status_rows as (
  select
    ar.id as assignment_id,
    aps.status,
    aps.started_at,
    aps.completed_at,
    aps.total_words,
    aps.correct_words,
    aps.average_attempts,
    aps.score_rate,
    coalesce(to_jsonb(aps.result_json), '[]'::jsonb) as result_json
  from assignment_rows as ar
  left join public.assignment_pupil_statuses as aps
    on aps.assignment_id = ar.id
   and aps.pupil_id = requested_pupil_id
),
spelling_bee_rows as (
  select
    ar.id as assignment_id,
    to_jsonb(sbr) as result_json
  from assignment_rows as ar
  left join lateral (
    select result.*
    from public.spelling_bee_results as result
    where result.assignment_id = ar.id
      and result.pupil_id = requested_pupil_id
    order by
      result.completed_at desc nulls last,
      result.started_at desc nulls last,
      result.created_at desc nulls last
    limit 1
  ) as sbr on true
),
computed_assignments as (
  select
    ar.*,
    bw.word_count,
    bw.words as base_words,
    tw.words as target_words,
    bw.all_baseline,
    (
      lower(btrim(coalesce(ar.automation_kind, ''))) = 'personalised'
      or bw.all_assignment_engine
    ) as is_generated,
    lower(btrim(coalesce(ar.automation_kind, ''))) = 'spelling_bee' as is_spelling_bee,
    (
      lower(btrim(coalesce(ar.automation_kind, ''))) = 'personalised'
      and lower(btrim(coalesce(ar.automation_source, ''))) = 'manual_run_now'
    ) as is_central_manual_automation,
    ar.evidence_source = 'extra_challenge' as is_extra_challenge,
    sr.status,
    sr.started_at,
    sr.completed_at,
    sr.total_words,
    sr.correct_words,
    sr.average_attempts,
    sr.score_rate,
    sr.result_json,
    sbr.result_json as spelling_bee_result
  from assignment_rows as ar
  inner join base_words as bw
    on bw.assignment_id = ar.id
  inner join target_words as tw
    on tw.assignment_id = ar.id
  left join status_rows as sr
    on sr.assignment_id = ar.id
  left join spelling_bee_rows as sbr
    on sbr.assignment_id = ar.id
),
assignment_payloads as (
  select
    c.id,
    c.end_at,
    c.created_at,
    jsonb_build_object(
      'id', c.id,
      'teacher_id', c.teacher_id,
      'class_id', c.class_id,
      'test_id', c.test_id,
      'title', coalesce(nullif(btrim(coalesce(c.title, '')), ''), 'Untitled test'),
      'question_type',
        case
          when c.is_spelling_bee then 'no_support_assessment'
          else coalesce(nullif(btrim(coalesce(c.question_type, '')), ''), 'focus_grapheme')
        end,
      'mode', coalesce(nullif(btrim(coalesce(c.mode, '')), ''), 'test'),
      'max_attempts',
        case
          when c.is_spelling_bee then 1
          else c.max_attempts
        end,
      'audio_enabled', coalesce(c.audio_enabled, true),
      'hints_enabled',
        case
          when c.is_spelling_bee then false
          else coalesce(c.hints_enabled, true)
        end,
      'automation_kind', nullif(btrim(coalesce(c.automation_kind, '')), ''),
      'automation_source', nullif(btrim(coalesce(c.automation_source, '')), ''),
      'automation_run_id', c.automation_run_id,
      'automation_triggered_by', c.automation_triggered_by,
      'evidence_source', c.evidence_source,
      'assignment_source', c.evidence_source,
      'isExtraChallenge', c.is_extra_challenge,
      'end_at', c.end_at,
      'created_at', c.created_at,
      'analytics_target_words_enabled', coalesce(c.analytics_target_words_enabled, false),
      'analytics_target_words_per_pupil', coalesce(c.analytics_target_words_per_pupil, 0),
      'attempt_source',
        case
          when c.is_spelling_bee then 'spelling_bee'
          when c.is_extra_challenge then 'extra_challenge'
          when c.is_generated then 'auto_assigned'
          when c.all_baseline then 'baseline'
          else 'teacher_assigned'
        end,
      'assignmentOrigin',
        case
          when c.is_spelling_bee then 'spelling_bee'
          when c.is_extra_challenge then 'extra_challenge'
          when c.is_generated then 'auto_assigned'
          when c.all_baseline then 'baseline'
          else 'teacher_assigned'
        end,
      'isSpellingBee', c.is_spelling_bee,
      'isGenerated', c.is_generated,
      'isBaseline', c.all_baseline,
      'assignmentStatus',
        case
          when c.is_spelling_bee then
            case
              when nullif(c.spelling_bee_result ->> 'completed_at', '') is not null then 'completed'
              when nullif(c.spelling_bee_result ->> 'started_at', '') is not null then 'started'
              else 'assigned'
            end
          else coalesce(
            nullif(btrim(coalesce(c.status, '')), ''),
            case when c.completed_at is not null then 'completed' else 'assigned' end
          )
        end,
      'spellingBeeLengthMode',
        case
          when c.is_spelling_bee then coalesce(
            nullif(c.spelling_bee_result ->> 'bee_length_mode', ''),
            nullif(c.base_words #>> '{0,choice,bee_length_mode}', ''),
            nullif(c.base_words #>> '{0,choice,beeLengthMode}', '')
          )
          else null
        end,
      'started_at',
        case
          when c.is_spelling_bee then nullif(c.spelling_bee_result ->> 'started_at', '')
          else c.started_at::text
        end,
      'completed_at',
        case
          when c.is_spelling_bee then nullif(c.spelling_bee_result ->> 'completed_at', '')
          else c.completed_at::text
        end,
      'total_words',
        case
          when c.is_spelling_bee then coalesce(nullif(c.spelling_bee_result ->> 'max_rounds', '')::integer, jsonb_array_length(c.base_words))
          else coalesce(c.total_words, 0)
        end,
      'correct_words',
        case
          when c.is_spelling_bee then coalesce(nullif(c.spelling_bee_result ->> 'streak', '')::integer, 0)
          else coalesce(c.correct_words, 0)
        end,
      'average_attempts',
        case
          when c.is_spelling_bee then 1
          else coalesce(c.average_attempts, 0)
        end,
      'score_rate',
        case
          when c.is_spelling_bee and jsonb_array_length(c.base_words) > 0
            then coalesce(nullif(c.spelling_bee_result ->> 'streak', '')::numeric, 0) / jsonb_array_length(c.base_words)
          else coalesce(c.score_rate, 0)
        end,
      'result_json',
        case
          when c.is_spelling_bee then coalesce(c.spelling_bee_result -> 'result_json', '[]'::jsonb)
          else coalesce(c.result_json, '[]'::jsonb)
        end,
      'completed',
        case
          when c.is_spelling_bee then nullif(c.spelling_bee_result ->> 'completed_at', '') is not null
          else c.completed_at is not null
            or lower(btrim(coalesce(c.status, ''))) in ('completed', 'complete')
        end,
      'isLocked',
        case
          when c.is_spelling_bee then nullif(c.spelling_bee_result ->> 'completed_at', '') is not null
          else c.completed_at is not null
            or lower(btrim(coalesce(c.status, ''))) in ('completed', 'complete')
        end,
      'spellingBeeResult', coalesce(c.spelling_bee_result, 'null'::jsonb),
      'spellingBeeEventClosed', c.end_at is not null and c.end_at <= timezone('utc', now()),
      'pupilTitle',
        case
          when c.is_spelling_bee then 'Spelling Bee'
          when c.is_generated then 'Personalised test'
          when c.all_baseline then 'Baseline Test'
          else coalesce(nullif(btrim(coalesce(c.title, '')), ''), 'Untitled test')
        end,
      'pupilReason',
        case
          when c.is_spelling_bee then 'Optional competition | Take part if you want to'
          when c.is_generated then 'Personalised from your recent practice.'
          when c.all_baseline then 'A short baseline test to help choose the right practice.'
          else ''
        end,
      'pupilWordCount',
        case
          when c.is_generated then nullif(coalesce(c.total_words, jsonb_array_length(c.target_words)), 0)
          else null
        end,
      'words',
        case
          when c.is_spelling_bee then (
            select coalesce(
              jsonb_agg(
                word_entry.value
                || jsonb_build_object(
                  'position', word_entry.ordinality,
                  'choice',
                    coalesce(word_entry.value -> 'choice', '{}'::jsonb)
                    || jsonb_build_object(
                      'question_type', 'no_support_assessment',
                      'spelling_bee', true
                    )
                )
                order by word_entry.ordinality
              ),
              '[]'::jsonb
            )
            from jsonb_array_elements(c.base_words) with ordinality as word_entry(value, ordinality)
          )
          when c.is_generated then c.target_words
          else c.base_words || c.target_words
        end
    ) as payload
  from computed_assignments as c
  where not (
    c.is_central_manual_automation
    and not c.is_spelling_bee
    and jsonb_array_length(c.target_words) = 0
  )
  and (
    c.end_at is null
    or c.end_at > timezone('utc', now())
    or c.completed_at is not null
    or lower(btrim(coalesce(c.status, ''))) in ('completed', 'complete')
    or c.is_spelling_bee
    or c.is_extra_challenge
    or c.all_baseline
  )
)
select jsonb_build_object(
  'status',
    case
      when exists (select 1 from runtime) then 'ok'
      else 'runtime_inactive'
    end,
  'pupil_id', requested_pupil_id,
  'assignments',
    coalesce(
      (
        select jsonb_agg(ap.payload order by ap.end_at asc nulls last, ap.created_at desc nulls last, ap.id)
        from assignment_payloads as ap
      ),
      '[]'::jsonb
    )
);
$$;

alter function public.read_pupil_runtime_assignments(uuid) owner to postgres;

revoke all on function public.read_pupil_runtime_assignments(uuid) from public;
grant execute on function public.read_pupil_runtime_assignments(uuid) to anon;
grant execute on function public.read_pupil_runtime_assignments(uuid) to authenticated;
grant execute on function public.read_pupil_runtime_assignments(uuid) to service_role;

commit;
