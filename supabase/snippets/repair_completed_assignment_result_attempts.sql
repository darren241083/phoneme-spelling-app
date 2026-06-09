-- Local/admin repair for completed assignment summaries that did not write attempts.
--
-- Dry-run first. For an apply run, wrap this snippet in an explicit transaction,
-- keep the returned inserted_attempt_ids, inspect the output, then commit or rollback.

create or replace function pg_temp.repair_completed_assignment_result_attempts(
  repair_pupil_id uuid default null,
  repair_assignment_id uuid default null,
  apply_changes boolean default false
)
returns table (
  scoped_parameters jsonb,
  candidate_status_count integer,
  candidate_result_row_count integer,
  insertable_row_count integer,
  inserted_count integer,
  skipped_counts jsonb,
  preview_rows jsonb,
  approved_word_bank_counts jsonb,
  inserted_attempt_ids uuid[],
  assignment_pupil_summary jsonb
)
language plpgsql
security invoker
set search_path to public, pg_temp
as $$
begin
  if repair_pupil_id is null and repair_assignment_id is null then
    raise exception 'Set repair_pupil_id and/or repair_assignment_id before running this repair.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.attempts'::regclass
      and conname = 'attempts_assignment_id_fkey'
      and confrelid = 'public.assignments_v2'::regclass
  ) then
    raise exception 'Abort: attempts_assignment_id_fkey must reference public.assignments_v2 before repair.';
  end if;

  drop table if exists pg_temp.repair_completed_assignment_statuses;
  drop table if exists pg_temp.repair_completed_assignment_candidates;
  drop table if exists pg_temp.repair_completed_assignment_inserted;

  create temporary table repair_completed_assignment_statuses on commit drop as
  with base_flags as (
    select
      tw.test_id,
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
    from public.test_words as tw
    group by tw.test_id
  )
  select
    aps.id as status_id,
    aps.assignment_id,
    aps.pupil_id,
    coalesce(aps.test_id, a.test_id) as test_id,
    aps.completed_at,
    aps.result_json,
    a.max_attempts,
    nullif(btrim(coalesce(a.question_type, '')), '') as assignment_question_type,
    nullif(btrim(coalesce(t.question_type, '')), '') as test_question_type,
    lower(btrim(coalesce(a.automation_kind, ''))) as automation_kind,
    coalesce(bf.all_baseline, false) as all_baseline,
    (
      lower(btrim(coalesce(a.automation_kind, ''))) = 'personalised'
      or coalesce(bf.all_assignment_engine, false)
    ) as is_generated,
    lower(btrim(coalesce(a.automation_kind, ''))) = 'spelling_bee' as is_spelling_bee
  from public.assignment_pupil_statuses as aps
  inner join public.assignments_v2 as a
    on a.id = aps.assignment_id
  left join public.tests as t
    on t.id = coalesce(aps.test_id, a.test_id)
  left join base_flags as bf
    on bf.test_id = coalesce(aps.test_id, a.test_id)
  where aps.status = 'completed'
    and aps.completed_at is not null
    and jsonb_typeof(aps.result_json) = 'array'
    and jsonb_array_length(aps.result_json) > 0
    and (repair_pupil_id is null or aps.pupil_id = repair_pupil_id)
    and (repair_assignment_id is null or aps.assignment_id = repair_assignment_id);

  create temporary table repair_completed_assignment_candidates on commit drop as
  with expanded as (
    select
      rs.*,
      result_row.value as result_json_row,
      result_row.ordinality::integer as result_index
    from repair_completed_assignment_statuses as rs
    cross join lateral jsonb_array_elements(rs.result_json) with ordinality as result_row(value, ordinality)
  ),
  raw_rows as (
    select
      e.*,
      nullif(btrim(coalesce(e.result_json_row ->> 'typed', '')), '') as typed,
      lower(nullif(btrim(coalesce(e.result_json_row ->> 'typed', '')), '')) as normalized_typed,
      coalesce(nullif(btrim(e.result_json_row ->> 'correctSpelling'), ''), nullif(btrim(e.result_json_row ->> 'word'), '')) as result_word_text,
      case
        when lower(btrim(coalesce(e.result_json_row ->> 'correct', 'false'))) in ('true', '1', 'yes') then true
        else false
      end as correct,
      greatest(
        1,
        case
          when btrim(coalesce(e.result_json_row ->> 'attemptsUsed', '')) ~ '^[0-9]+$'
          then (e.result_json_row ->> 'attemptsUsed')::integer
          else 1
        end
      ) as attempt_number,
      case
        when btrim(coalesce(e.result_json_row ->> 'attemptsAllowed', e.result_json_row ->> 'attempts_allowed', '')) ~ '^[0-9]+$'
        then greatest(1, (coalesce(e.result_json_row ->> 'attemptsAllowed', e.result_json_row ->> 'attempts_allowed'))::integer)
        when e.max_attempts is not null
        then greatest(1, e.max_attempts)
        else null
      end as attempts_allowed,
      case
        when btrim(coalesce(e.result_json_row ->> 'assignmentTargetId', '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (e.result_json_row ->> 'assignmentTargetId')::uuid
        else null
      end as result_assignment_target_id,
      case
        when btrim(coalesce(e.result_json_row ->> 'baseTestWordId', '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (e.result_json_row ->> 'baseTestWordId')::uuid
        else null
      end as result_base_test_word_id,
      case
        when btrim(coalesce(e.result_json_row ->> 'wordId', '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (e.result_json_row ->> 'wordId')::uuid
        else null
      end as result_word_id,
      nullif(btrim(coalesce(e.result_json_row ->> 'questionType', '')), '') as result_question_type,
      lower(nullif(btrim(coalesce(e.result_json_row ->> 'focusGrapheme', '')), '')) as result_focus_grapheme,
      lower(nullif(btrim(coalesce(e.result_json_row ->> 'patternType', '')), '')) as result_pattern_type,
      nullif(btrim(coalesce(e.result_json_row ->> 'wordSource', '')), '') as result_word_source,
      case
        when jsonb_typeof(e.result_json_row -> 'targetGraphemes') = 'array'
        then e.result_json_row -> 'targetGraphemes'
        else null
      end as result_target_graphemes
    from expanded as e
  ),
  word_matches as (
    select
      tw.test_id,
      lower(btrim(tw.word)) as word_key,
      count(*)::integer as word_match_count,
      (array_agg(tw.id order by tw.id::text))[1] as test_word_id
    from public.test_words as tw
    group by tw.test_id, lower(btrim(tw.word))
  ),
  first_pass as (
    select
      rr.*,
      target_direct.id as direct_assignment_target_id,
      target_direct.test_word_id as direct_target_test_word_id,
      target_direct.focus_grapheme as direct_focus_grapheme,
      target_by_result_word.id as result_word_assignment_target_id,
      target_by_result_word.test_word_id as result_word_target_test_word_id,
      target_by_result_word.focus_grapheme as result_word_focus_grapheme,
      wm.word_match_count,
      case when wm.word_match_count = 1 then wm.test_word_id else null end as unique_word_test_word_id,
      coalesce(
        target_direct.test_word_id,
        target_by_result_word.test_word_id,
        rr.result_base_test_word_id,
        rr.result_word_id,
        case when wm.word_match_count = 1 then wm.test_word_id else null end
      ) as candidate_test_word_id
    from raw_rows as rr
    left join public.assignment_pupil_target_words as target_direct
      on target_direct.id = rr.result_assignment_target_id
      and target_direct.assignment_id = rr.assignment_id
      and target_direct.pupil_id = rr.pupil_id
    left join public.assignment_pupil_target_words as target_by_result_word
      on target_by_result_word.assignment_id = rr.assignment_id
      and target_by_result_word.pupil_id = rr.pupil_id
      and target_by_result_word.test_word_id = coalesce(rr.result_base_test_word_id, rr.result_word_id)
    left join word_matches as wm
      on wm.test_id = rr.test_id
      and wm.word_key = lower(btrim(coalesce(rr.result_word_text, '')))
  ),
  resolved as (
    select
      fp.*,
      tw.id as resolved_test_word_id,
      tw.word as test_word_text,
      tw.segments as test_word_segments,
      tw.choice as test_word_choice,
      target_by_resolved.id as resolved_assignment_target_id,
      target_by_resolved.focus_grapheme as resolved_target_focus_grapheme
    from first_pass as fp
    left join public.test_words as tw
      on tw.id = fp.candidate_test_word_id
      and tw.test_id = fp.test_id
    left join public.assignment_pupil_target_words as target_by_resolved
      on target_by_resolved.assignment_id = fp.assignment_id
      and target_by_resolved.pupil_id = fp.pupil_id
      and target_by_resolved.test_word_id = tw.id
  ),
  finalized as (
    select
      r.status_id,
      r.assignment_id,
      r.pupil_id,
      r.test_id,
      r.result_index,
      r.completed_at as created_at,
      coalesce(r.resolved_assignment_target_id, r.direct_assignment_target_id, r.result_word_assignment_target_id) as assignment_target_id,
      r.resolved_test_word_id as test_word_id,
      r.typed,
      r.normalized_typed,
      coalesce(r.result_question_type, r.test_question_type, r.assignment_question_type) as mode,
      r.correct,
      r.attempt_number,
      r.attempts_allowed,
      coalesce(r.result_word_text, nullif(btrim(coalesce(r.test_word_text, '')), '')) as word_text,
      coalesce(
        r.result_word_source,
        case
          when coalesce(r.resolved_assignment_target_id, r.direct_assignment_target_id, r.result_word_assignment_target_id) is not null then 'targeted'
          else 'base'
        end
      ) as word_source,
      case
        when r.all_baseline then 'baseline'
        when r.is_generated then 'auto_assigned'
        else 'teacher_assigned'
      end as attempt_source,
      coalesce(
        r.result_focus_grapheme,
        lower(nullif(btrim(coalesce(r.resolved_target_focus_grapheme, '')), '')),
        lower(nullif(btrim(coalesce(r.direct_focus_grapheme, '')), '')),
        lower(nullif(btrim(coalesce(r.result_word_focus_grapheme, '')), '')),
        lower(nullif(btrim(coalesce(r.test_word_choice #>> '{focus_graphemes,0}', '')), ''))
      ) as focus_grapheme,
      coalesce(
        r.result_target_graphemes,
        case when jsonb_typeof(r.test_word_segments) = 'array' then r.test_word_segments else null end
      ) as target_graphemes,
      coalesce(
        r.result_pattern_type,
        lower(nullif(btrim(coalesce(r.test_word_choice ->> 'pattern_type', '')), ''))
      ) as pattern_type,
      r.is_spelling_bee,
      r.word_match_count
    from resolved as r
  ),
  classified as (
    select
      f.*,
      exists (
        select 1
        from public.attempts as a
        where a.assignment_id = f.assignment_id
          and a.pupil_id = f.pupil_id
          and (
            (f.assignment_target_id is not null and a.assignment_target_id = f.assignment_target_id)
            or (
              f.assignment_target_id is null
              and f.test_word_id is not null
              and a.test_word_id = f.test_word_id
            )
          )
          and lower(btrim(coalesce(a.typed, ''))) = f.normalized_typed
          and coalesce(a.correct, a.is_correct, false) = f.correct
          and greatest(1, coalesce(a.attempt_number, a.attempt_no, 1)) >= f.attempt_number
      ) as existing_final_attempt
    from finalized as f
  )
  select
    c.*,
    case
      when c.is_spelling_bee then 'spelling_bee_skipped'
      when c.existing_final_attempt then 'existing_final_attempt'
      when c.typed is null then 'missing_typed'
      when c.mode is null then 'missing_mode'
      when c.test_word_id is null and coalesce(c.word_match_count, 0) > 1 then 'ambiguous_word_match'
      when c.assignment_target_id is null and c.test_word_id is null then 'missing_word_key'
      when c.word_text is null then 'missing_word_key'
      when c.focus_grapheme is null
        or case
          when c.target_graphemes is null then true
          when jsonb_typeof(c.target_graphemes) <> 'array' then true
          else jsonb_array_length(c.target_graphemes) = 0
        end
      then 'incomplete_grapheme_metadata'
      else null
    end as skip_reason
  from classified as c;

  create temporary table repair_completed_assignment_inserted (
    id uuid,
    assignment_id uuid,
    pupil_id uuid
  ) on commit drop;

  if apply_changes then
    with inserted as (
      insert into public.attempts (
        assignment_id,
        pupil_id,
        test_id,
        test_word_id,
        assignment_target_id,
        typed,
        mode,
        correct,
        is_correct,
        attempt_number,
        attempt_no,
        attempts_allowed,
        word,
        word_text,
        word_source,
        attempt_source,
        focus_grapheme,
        target_graphemes,
        pattern_type,
        created_at
      )
      select
        c.assignment_id,
        c.pupil_id,
        c.test_id,
        c.test_word_id,
        c.assignment_target_id,
        c.typed,
        c.mode,
        c.correct,
        c.correct,
        c.attempt_number,
        c.attempt_number,
        c.attempts_allowed,
        c.word_text,
        c.word_text,
        c.word_source,
        c.attempt_source,
        c.focus_grapheme,
        c.target_graphemes,
        c.pattern_type,
        c.created_at
      from repair_completed_assignment_candidates as c
      where c.skip_reason is null
      returning id, assignment_id, pupil_id
    )
    insert into repair_completed_assignment_inserted (id, assignment_id, pupil_id)
    select inserted.id, inserted.assignment_id, inserted.pupil_id
    from inserted;
  end if;

  return query
  with skip_reasons(reason) as (
    values
      ('existing_final_attempt'),
      ('missing_typed'),
      ('missing_word_key'),
      ('missing_mode'),
      ('spelling_bee_skipped'),
      ('ambiguous_word_match'),
      ('incomplete_grapheme_metadata')
  ),
  skip_counts as (
    select
      sr.reason,
      coalesce(count(c.skip_reason), 0)::integer as skipped_count
    from skip_reasons as sr
    left join repair_completed_assignment_candidates as c
      on c.skip_reason = sr.reason
    group by sr.reason
  ),
  preview as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'assignment_id', c.assignment_id,
          'pupil_id', c.pupil_id,
          'word_text', c.word_text,
          'typed', c.typed,
          'correct', c.correct,
          'attempt_number', c.attempt_number,
          'attempt_source', c.attempt_source,
          'focus_grapheme', c.focus_grapheme,
          'target_graphemes', c.target_graphemes,
          'created_at', c.created_at
        )
        order by c.created_at, c.assignment_id, c.pupil_id, c.result_index
      ),
      '[]'::jsonb
    ) as rows
    from repair_completed_assignment_candidates as c
    where c.skip_reason is null
  ),
  approved_bank as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'focus_grapheme', bank.focus_grapheme,
          'approved_teacher_word_bank_count', bank.approved_teacher_word_bank_count
        )
        order by bank.focus_grapheme
      ),
      '[]'::jsonb
    ) as rows
    from (
      select
        f.focus_grapheme,
        count(tw.id)::integer as approved_teacher_word_bank_count
      from (
        select distinct c.focus_grapheme
        from repair_completed_assignment_candidates as c
        where c.focus_grapheme is not null
      ) as f
      left join public.test_words as tw
        on tw.choice @> jsonb_build_object(
          'source', 'teacher',
          'focus_graphemes', jsonb_build_array(f.focus_grapheme)
        )
      group by f.focus_grapheme
    ) as bank
  ),
  candidate_group as (
    select
      c.assignment_id,
      c.pupil_id,
      count(*)::integer as candidate_result_rows,
      count(*) filter (where c.skip_reason is null)::integer as insertable_rows
    from repair_completed_assignment_candidates as c
    group by c.assignment_id, c.pupil_id
  ),
  inserted_group as (
    select
      i.assignment_id,
      i.pupil_id,
      count(*)::integer as inserted_rows
    from repair_completed_assignment_inserted as i
    group by i.assignment_id, i.pupil_id
  ),
  summary as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'assignment_id', candidate_group.assignment_id,
          'pupil_id', candidate_group.pupil_id,
          'candidate_result_rows', candidate_group.candidate_result_rows,
          'insertable_rows', candidate_group.insertable_rows,
          'inserted_rows', coalesce(inserted_group.inserted_rows, 0)
        )
        order by candidate_group.assignment_id, candidate_group.pupil_id
      ),
      '[]'::jsonb
    ) as rows
    from candidate_group
    left join inserted_group
      on inserted_group.assignment_id = candidate_group.assignment_id
      and inserted_group.pupil_id = candidate_group.pupil_id
  )
  select
    jsonb_build_object(
      'repair_pupil_id', repair_pupil_id,
      'repair_assignment_id', repair_assignment_id,
      'apply_changes', apply_changes
    ) as scoped_parameters,
    (select count(*)::integer from repair_completed_assignment_statuses) as candidate_status_count,
    (select count(*)::integer from repair_completed_assignment_candidates) as candidate_result_row_count,
    (select count(*)::integer from repair_completed_assignment_candidates where skip_reason is null) as insertable_row_count,
    (select count(*)::integer from repair_completed_assignment_inserted) as inserted_count,
    (select jsonb_object_agg(reason, skipped_count order by reason) from skip_counts) as skipped_counts,
    (select rows from preview) as preview_rows,
    (select rows from approved_bank) as approved_word_bank_counts,
    coalesce((select array_agg(id order by id) from repair_completed_assignment_inserted), array[]::uuid[]) as inserted_attempt_ids,
    (select rows from summary) as assignment_pupil_summary;
end;
$$;

-- Edit the parameters below before running. This defaults to dry-run mode.
-- Tests can set repair_completed_assignment_result_attempts.skip_default_call=true
-- before including this snippet to load the temp function without running it.
with repair_completed_assignment_result_attempts_run as (
  select
    null::uuid as repair_pupil_id,
    null::uuid as repair_assignment_id,
    false as apply_changes
  where current_setting('repair_completed_assignment_result_attempts.skip_default_call', true) is distinct from 'true'
)
select result.*
from repair_completed_assignment_result_attempts_run as params
cross join lateral pg_temp.repair_completed_assignment_result_attempts(
  repair_pupil_id := params.repair_pupil_id,
  repair_assignment_id := params.repair_assignment_id,
  apply_changes := params.apply_changes
) as result;
