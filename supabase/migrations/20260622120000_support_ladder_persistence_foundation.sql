begin;

alter table public.tests
  add column if not exists delivery_model text,
  add column if not exists support_preset text;

update public.tests
set delivery_model = 'legacy_fixed'
where delivery_model is null
   or btrim(delivery_model) = '';

alter table public.tests
  alter column delivery_model set default 'legacy_fixed',
  alter column delivery_model set not null;

alter table public.tests
  drop constraint if exists tests_delivery_model_check,
  drop constraint if exists tests_support_preset_check,
  drop constraint if exists tests_support_ladder_preset_required_check;

alter table public.tests
  add constraint tests_delivery_model_check
    check (delivery_model in ('legacy_fixed', 'support_ladder')),
  add constraint tests_support_preset_check
    check (
      support_preset is null
      or support_preset in ('balanced', 'independent_first', 'more_support_when_needed')
    ),
  add constraint tests_support_ladder_preset_required_check
    check (delivery_model <> 'support_ladder' or support_preset is not null);

alter table public.assignments_v2
  add column if not exists delivery_model text,
  add column if not exists support_preset text;

update public.assignments_v2
set delivery_model = 'legacy_fixed'
where delivery_model is null
   or btrim(delivery_model) = '';

alter table public.assignments_v2
  alter column delivery_model set default 'legacy_fixed',
  alter column delivery_model set not null;

alter table public.assignments_v2
  drop constraint if exists assignments_v2_delivery_model_check,
  drop constraint if exists assignments_v2_support_preset_check,
  drop constraint if exists assignments_v2_support_ladder_preset_required_check;

alter table public.assignments_v2
  add constraint assignments_v2_delivery_model_check
    check (delivery_model in ('legacy_fixed', 'support_ladder')),
  add constraint assignments_v2_support_preset_check
    check (
      support_preset is null
      or support_preset in ('balanced', 'independent_first', 'more_support_when_needed')
    ),
  add constraint assignments_v2_support_ladder_preset_required_check
    check (delivery_model <> 'support_ladder' or support_preset is not null);

alter table public.attempts
  add column if not exists delivery_model text,
  add column if not exists support_state text,
  add column if not exists evidence_category text,
  add column if not exists support_actions jsonb;

update public.attempts
set delivery_model = 'legacy_fixed'
where delivery_model is null
   or btrim(delivery_model) = '';

alter table public.attempts
  alter column delivery_model set default 'legacy_fixed',
  alter column delivery_model set not null;

alter table public.attempts
  drop constraint if exists attempts_delivery_model_check,
  drop constraint if exists attempts_support_state_check,
  drop constraint if exists attempts_evidence_category_check,
  drop constraint if exists attempts_support_actions_array_check;

alter table public.attempts
  add constraint attempts_delivery_model_check
    check (delivery_model in ('legacy_fixed', 'support_ladder')),
  add constraint attempts_support_state_check
    check (
      support_state is null
      or support_state in ('independent', 'retry', 'supported', 'access_issue')
    ),
  add constraint attempts_evidence_category_check
    check (
      evidence_category is null
      or evidence_category in (
        'correct_first_time',
        'correct_after_retry',
        'correct_with_support',
        'incorrect_with_support',
        'access_issue'
      )
    ),
  add constraint attempts_support_actions_array_check
    check (support_actions is null or jsonb_typeof(support_actions) = 'array');

alter table public.assignment_pupil_statuses
  add column if not exists independent_first_correct_words integer,
  add column if not exists self_corrected_words integer,
  add column if not exists supported_correct_words integer,
  add column if not exists supported_incorrect_words integer,
  add column if not exists access_issue_words integer,
  add column if not exists headline_attempted_words integer,
  add column if not exists headline_correct_words integer,
  add column if not exists headline_score_rate double precision;

alter table public.assignment_pupil_statuses
  drop constraint if exists assignment_pupil_statuses_support_ladder_counts_nonnegative_check,
  drop constraint if exists assignment_pupil_statuses_headline_correct_not_above_attempted_check,
  drop constraint if exists assignment_pupil_statuses_headline_score_rate_check;

alter table public.assignment_pupil_statuses
  add constraint assignment_pupil_statuses_support_ladder_counts_nonnegative_check
    check (
      (independent_first_correct_words is null or independent_first_correct_words >= 0)
      and (self_corrected_words is null or self_corrected_words >= 0)
      and (supported_correct_words is null or supported_correct_words >= 0)
      and (supported_incorrect_words is null or supported_incorrect_words >= 0)
      and (access_issue_words is null or access_issue_words >= 0)
      and (headline_attempted_words is null or headline_attempted_words >= 0)
      and (headline_correct_words is null or headline_correct_words >= 0)
    ),
  add constraint assignment_pupil_statuses_headline_correct_not_above_attempted_check
    check (
      headline_correct_words is null
      or headline_attempted_words is null
      or headline_correct_words <= headline_attempted_words
    ),
  add constraint assignment_pupil_statuses_headline_score_rate_check
    check (
      headline_score_rate is null
      or (headline_score_rate >= 0 and headline_score_rate <= 1)
    );

do $$
declare
  function_sql text;
  previous_text text;
  replacement_text text;
begin
  select pg_get_functiondef('public.read_pupil_runtime_assignments(uuid)'::regprocedure)
    into function_sql;
  function_sql := replace(function_sql, E'\r\n', E'\n');

  if position('''delivery_model'', c.delivery_model' in function_sql) > 0 then
    return;
  end if;

  previous_text := $previous$
    coalesce(nullif(lower(btrim(coalesce(a.evidence_source, ''))), ''), 'assigned_core') as evidence_source,
    a.end_at,
$previous$;
  replacement_text := $replacement$
    coalesce(nullif(lower(btrim(coalesce(a.evidence_source, ''))), ''), 'assigned_core') as evidence_source,
    coalesce(nullif(lower(btrim(coalesce(a.delivery_model, ''))), ''), 'legacy_fixed') as delivery_model,
    a.support_preset,
    a.end_at,
$replacement$;
  if position(previous_text in function_sql) = 0 then
    raise exception 'Could not add support-ladder assignment fields to read_pupil_runtime_assignments.';
  end if;
  function_sql := replace(function_sql, previous_text, replacement_text);

  previous_text := $previous$
    aps.score_rate,
    coalesce(to_jsonb(aps.result_json), '[]'::jsonb) as result_json
$previous$;
  replacement_text := $replacement$
    aps.score_rate,
    aps.independent_first_correct_words,
    aps.self_corrected_words,
    aps.supported_correct_words,
    aps.supported_incorrect_words,
    aps.access_issue_words,
    aps.headline_attempted_words,
    aps.headline_correct_words,
    aps.headline_score_rate,
    coalesce(to_jsonb(aps.result_json), '[]'::jsonb) as result_json
$replacement$;
  if position(previous_text in function_sql) = 0 then
    raise exception 'Could not add support-ladder status fields to read_pupil_runtime_assignments.';
  end if;
  function_sql := replace(function_sql, previous_text, replacement_text);

  previous_text := $previous$
    sr.score_rate,
    sr.result_json,
$previous$;
  replacement_text := $replacement$
    sr.score_rate,
    sr.independent_first_correct_words,
    sr.self_corrected_words,
    sr.supported_correct_words,
    sr.supported_incorrect_words,
    sr.access_issue_words,
    sr.headline_attempted_words,
    sr.headline_correct_words,
    sr.headline_score_rate,
    sr.result_json,
$replacement$;
  if position(previous_text in function_sql) = 0 then
    raise exception 'Could not carry support-ladder status fields through read_pupil_runtime_assignments.';
  end if;
  function_sql := replace(function_sql, previous_text, replacement_text);

  previous_text := $previous$
    ) as payload
  from computed_assignments as c
$previous$;
  replacement_text := $replacement$
    ) || jsonb_build_object(
      'delivery_model', c.delivery_model,
      'support_preset', c.support_preset,
      'independent_first_correct_words', c.independent_first_correct_words,
      'self_corrected_words', c.self_corrected_words,
      'supported_correct_words', c.supported_correct_words,
      'supported_incorrect_words', c.supported_incorrect_words,
      'access_issue_words', c.access_issue_words,
      'headline_attempted_words', c.headline_attempted_words,
      'headline_correct_words', c.headline_correct_words,
      'headline_score_rate', c.headline_score_rate
    ) as payload
  from computed_assignments as c
$replacement$;
  if position(previous_text in function_sql) = 0 then
    raise exception 'Could not extend read_pupil_runtime_assignments payload.';
  end if;
  function_sql := replace(function_sql, previous_text, replacement_text);

  execute function_sql;
end $$;

do $$
declare
  function_sql text;
  previous_text text;
  replacement_text text;
begin
  select pg_get_functiondef('public.read_pupil_baseline_gate_state(uuid,text)'::regprocedure)
    into function_sql;
  function_sql := replace(function_sql, E'\r\n', E'\n');

  if position('''headline_score_rate'', candidate.headline_score_rate' in function_sql) > 0 then
    return;
  end if;

  previous_text := $previous$
      a.hints_enabled,
      a.end_at,
$previous$;
  replacement_text := $replacement$
      a.hints_enabled,
      a.delivery_model,
      a.support_preset,
      a.end_at,
$replacement$;
  if position(previous_text in function_sql) = 0 then
    raise exception 'Could not add support-ladder assignment fields to read_pupil_baseline_gate_state.';
  end if;
  function_sql := replace(function_sql, previous_text, replacement_text);

  previous_text := $previous$
      aps.score_rate,
      coalesce(to_jsonb(aps.result_json), '[]'::jsonb) as result_json
$previous$;
  replacement_text := $replacement$
      aps.score_rate,
      aps.independent_first_correct_words,
      aps.self_corrected_words,
      aps.supported_correct_words,
      aps.supported_incorrect_words,
      aps.access_issue_words,
      aps.headline_attempted_words,
      aps.headline_correct_words,
      aps.headline_score_rate,
      coalesce(to_jsonb(aps.result_json), '[]'::jsonb) as result_json
$replacement$;
  if position(previous_text in function_sql) = 0 then
    raise exception 'Could not add support-ladder status fields to read_pupil_baseline_gate_state.';
  end if;
  function_sql := replace(function_sql, previous_text, replacement_text);

  previous_text := $previous$
      aps.score_rate,
      aps.result_json
$previous$;
  replacement_text := $replacement$
      aps.score_rate,
      aps.independent_first_correct_words,
      aps.self_corrected_words,
      aps.supported_correct_words,
      aps.supported_incorrect_words,
      aps.access_issue_words,
      aps.headline_attempted_words,
      aps.headline_correct_words,
      aps.headline_score_rate,
      aps.result_json
$replacement$;
  if position(previous_text in function_sql) = 0 then
    raise exception 'Could not group support-ladder status fields in read_pupil_baseline_gate_state.';
  end if;
  function_sql := replace(function_sql, previous_text, replacement_text);

  previous_text := $previous$
      'words', candidate.words
    ),
    candidate.state_rank
$previous$;
  replacement_text := $replacement$
      'words', candidate.words
    ) || jsonb_build_object(
      'delivery_model', coalesce(
        nullif(lower(btrim(coalesce(candidate.delivery_model, ''))), ''),
        'legacy_fixed'
      ),
      'support_preset', candidate.support_preset,
      'independent_first_correct_words', candidate.independent_first_correct_words,
      'self_corrected_words', candidate.self_corrected_words,
      'supported_correct_words', candidate.supported_correct_words,
      'supported_incorrect_words', candidate.supported_incorrect_words,
      'access_issue_words', candidate.access_issue_words,
      'headline_attempted_words', candidate.headline_attempted_words,
      'headline_correct_words', candidate.headline_correct_words,
      'headline_score_rate', candidate.headline_score_rate
    ),
    candidate.state_rank
$replacement$;
  if position(previous_text in function_sql) = 0 then
    raise exception 'Could not extend read_pupil_baseline_gate_state payload.';
  end if;
  function_sql := replace(function_sql, previous_text, replacement_text);

  execute function_sql;
end $$;

commit;
