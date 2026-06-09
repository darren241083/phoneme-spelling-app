begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select set_config('repair_completed_assignment_result_attempts.skip_default_call', 'true', true);
\ir ../../snippets/repair_completed_assignment_result_attempts.sql

select plan(14);

create temporary table repair_attempt_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table repair_attempt_outputs (
  name text primary key,
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
) on commit drop;

create temporary table repair_attempt_checks (
  name text primary key,
  int_value integer,
  bool_value boolean,
  json_value jsonb,
  text_value text
) on commit drop;

grant select on table repair_attempt_ids to public;
grant select, insert, update, delete on table repair_attempt_outputs to public;
grant select, insert, update, delete on table repair_attempt_checks to public;

insert into repair_attempt_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'teacher',
  'class',
  'pupil',
  'test',
  'bee_test',
  'assignment',
  'bee_assignment',
  'status',
  'bee_status',
  'word_phase',
  'word_shark',
  'word_float',
  'word_plain_a',
  'word_plain_b',
  'word_blank_meta',
  'word_bee',
  'target_phase'
]) as names(name);

do $$
declare
  teacher_id uuid := (select id from repair_attempt_ids where name = 'teacher');
  class_id uuid := (select id from repair_attempt_ids where name = 'class');
  pupil_id uuid := (select id from repair_attempt_ids where name = 'pupil');
  test_id uuid := (select id from repair_attempt_ids where name = 'test');
  bee_test_id uuid := (select id from repair_attempt_ids where name = 'bee_test');
  assignment_id uuid := (select id from repair_attempt_ids where name = 'assignment');
  bee_assignment_id uuid := (select id from repair_attempt_ids where name = 'bee_assignment');
  status_id uuid := (select id from repair_attempt_ids where name = 'status');
  bee_status_id uuid := (select id from repair_attempt_ids where name = 'bee_status');
  word_phase_id uuid := (select id from repair_attempt_ids where name = 'word_phase');
  word_shark_id uuid := (select id from repair_attempt_ids where name = 'word_shark');
  word_float_id uuid := (select id from repair_attempt_ids where name = 'word_float');
  word_plain_a_id uuid := (select id from repair_attempt_ids where name = 'word_plain_a');
  word_plain_b_id uuid := (select id from repair_attempt_ids where name = 'word_plain_b');
  word_blank_meta_id uuid := (select id from repair_attempt_ids where name = 'word_blank_meta');
  word_bee_id uuid := (select id from repair_attempt_ids where name = 'word_bee');
  target_phase_id uuid := (select id from repair_attempt_ids where name = 'target_phase');
begin
  perform set_config('request.jwt.claim.sub', teacher_id::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', teacher_id::text, 'role', 'service_role')::text,
    true
  );

  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    teacher_id,
    'authenticated',
    'authenticated',
    'pgtap-repair-attempts-' || substr(replace(teacher_id::text, '-', ''), 1, 10) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do nothing;

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values (teacher_id, 'teacher', true, teacher_id);

  insert into public.teachers (id, display_name)
  values (teacher_id, 'pgTAP Result Repair Teacher');

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values (class_id, teacher_id, 'pgTAP Result Repair Class', upper(substr(replace(class_id::text, '-', ''), 1, 6)), 'Year 7', 'form');

  insert into public.pupils (
    id,
    mis_id,
    first_name,
    surname,
    username,
    pin,
    must_reset_pin,
    is_active
  )
  values (
    pupil_id,
    'PGTAP-REPAIR-' || substr(replace(pupil_id::text, '-', ''), 1, 8),
    'Repair',
    'Attempts',
    'repair.attempts.' || substr(replace(pupil_id::text, '-', ''), 1, 8),
    '1234',
    false,
    true
  );

  insert into public.pupil_classes (pupil_id, class_id, active)
  values (pupil_id, class_id, true);

  insert into public.tests (id, teacher_id, title, status, question_type)
  values
    (test_id, teacher_id, 'pgTAP Result Repair Test', 'published', 'full_recall'),
    (bee_test_id, teacher_id, 'pgTAP Result Repair Bee', 'published', 'no_support_assessment');

  insert into public.test_words (id, test_id, position, word, sentence, segments, choice)
  values
    (word_phase_id, test_id, 1, 'phase', 'A phase sentence.', '["ph","a","se"]'::jsonb, '{"source":"teacher","focus_graphemes":["ph"],"pattern_type":"digraph"}'::jsonb),
    (word_shark_id, test_id, 2, 'shark', 'A shark sentence.', '["sh","ar","k"]'::jsonb, '{"source":"teacher","focus_graphemes":["sh"],"pattern_type":"digraph"}'::jsonb),
    (word_float_id, test_id, 3, 'float', 'A float sentence.', '["fl","oa","t"]'::jsonb, '{"source":"teacher","focus_graphemes":["oa"],"pattern_type":"vowel_team"}'::jsonb),
    (word_plain_a_id, test_id, 4, 'plain', 'A plain sentence.', '["pl","ai","n"]'::jsonb, '{"source":"teacher","focus_graphemes":["ai"],"pattern_type":"vowel_team"}'::jsonb),
    (word_plain_b_id, test_id, 5, 'plain', 'Another plain sentence.', '["pl","ai","n"]'::jsonb, '{"source":"teacher","focus_graphemes":["ai"],"pattern_type":"vowel_team"}'::jsonb),
    (word_blank_meta_id, test_id, 6, 'mystery', 'A mystery sentence.', '[]'::jsonb, '{}'::jsonb),
    (word_bee_id, bee_test_id, 1, 'sting', 'A sting sentence.', '["s","t","i","ng"]'::jsonb, '{"source":"teacher","focus_graphemes":["ng"],"pattern_type":"digraph"}'::jsonb);

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts, question_type, automation_kind, created_at)
  values
    (assignment_id, teacher_id, class_id, test_id, 'practice', 3, 'full_recall', null, timezone('utc', now()) - interval '2 days'),
    (bee_assignment_id, teacher_id, class_id, bee_test_id, 'test', 1, 'no_support_assessment', 'spelling_bee', timezone('utc', now()) - interval '1 day');

  insert into public.assignment_pupil_target_words (
    id,
    teacher_id,
    assignment_id,
    pupil_id,
    test_word_id,
    focus_grapheme,
    target_source,
    target_reason
  )
  values (
    target_phase_id,
    teacher_id,
    assignment_id,
    pupil_id,
    word_phase_id,
    'ph',
    'analytics',
    'focus_grapheme'
  );

  insert into public.assignment_pupil_statuses (
    id,
    teacher_id,
    assignment_id,
    class_id,
    test_id,
    pupil_id,
    status,
    started_at,
    completed_at,
    total_words,
    correct_words,
    average_attempts,
    score_rate,
    result_json
  )
  values
  (
    status_id,
    teacher_id,
    assignment_id,
    class_id,
    test_id,
    pupil_id,
    'completed',
    timezone('utc', now()) - interval '1 day',
    timezone('utc', now()) - interval '1 day',
    5,
    1,
    1.2,
    0.2,
    jsonb_build_array(
      jsonb_build_object(
        'baseTestWordId', word_phase_id::text,
        'assignmentTargetId', target_phase_id::text,
        'word', 'phase',
        'correctSpelling', 'phase',
        'typed', 'fase',
        'correct', false,
        'attemptsUsed', 2,
        'attemptsAllowed', 3
      ),
      jsonb_build_object(
        'word', 'shark',
        'correctSpelling', 'shark',
        'typed', 'shark',
        'correct', true,
        'attemptsUsed', 1,
        'questionType', 'full_recall',
        'focusGrapheme', 'sh',
        'targetGraphemes', jsonb_build_array('sh', 'ar', 'k'),
        'patternType', 'digraph'
      ),
      jsonb_build_object(
        'baseTestWordId', word_float_id::text,
        'word', 'float',
        'correctSpelling', 'float',
        'typed', '',
        'correct', false,
        'attemptsUsed', 1
      ),
      jsonb_build_object(
        'word', 'plain',
        'correctSpelling', 'plain',
        'typed', 'plane',
        'correct', false,
        'attemptsUsed', 1
      ),
      jsonb_build_object(
        'baseTestWordId', word_blank_meta_id::text,
        'word', 'mystery',
        'correctSpelling', 'mystery',
        'typed', 'mistery',
        'correct', false,
        'attemptsUsed', 1
      )
    )
  ),
  (
    bee_status_id,
    teacher_id,
    bee_assignment_id,
    class_id,
    bee_test_id,
    pupil_id,
    'completed',
    timezone('utc', now()) - interval '12 hours',
    timezone('utc', now()) - interval '12 hours',
    1,
    1,
    1,
    1,
    jsonb_build_array(jsonb_build_object(
      'baseTestWordId', word_bee_id::text,
      'word', 'sting',
      'correctSpelling', 'sting',
      'typed', 'sting',
      'correct', true,
      'attemptsUsed', 1,
      'questionType', 'no_support_assessment',
      'focusGrapheme', 'ng',
      'targetGraphemes', jsonb_build_array('s', 't', 'i', 'ng')
    ))
  );
end;
$$;

insert into repair_attempt_checks (name, int_value, json_value)
values
  ('status_count_before', (
    select count(*)::integer
    from public.assignment_pupil_statuses
    where pupil_id = (select id from repair_attempt_ids where name = 'pupil')
  ), null),
  ('status_snapshot_before', null, (
    select jsonb_agg(
      jsonb_build_object(
        'id', id,
        'total_words', total_words,
        'correct_words', correct_words,
        'average_attempts', average_attempts,
        'score_rate', score_rate,
        'result_json', result_json
      )
      order by id
    )
    from public.assignment_pupil_statuses
    where pupil_id = (select id from repair_attempt_ids where name = 'pupil')
  ));

insert into repair_attempt_outputs
select
  'dry_run',
  r.scoped_parameters,
  r.candidate_status_count,
  r.candidate_result_row_count,
  r.insertable_row_count,
  r.inserted_count,
  r.skipped_counts,
  r.preview_rows,
  r.approved_word_bank_counts,
  r.inserted_attempt_ids,
  r.assignment_pupil_summary
from pg_temp.repair_completed_assignment_result_attempts(
  repair_pupil_id := (select id from repair_attempt_ids where name = 'pupil'),
  apply_changes := false
) as r;

insert into repair_attempt_checks (name, int_value)
values ('attempt_count_after_dry_run', (
  select count(*)::integer
  from public.attempts
  where pupil_id = (select id from repair_attempt_ids where name = 'pupil')
));

insert into repair_attempt_outputs
select
  'apply',
  r.scoped_parameters,
  r.candidate_status_count,
  r.candidate_result_row_count,
  r.insertable_row_count,
  r.inserted_count,
  r.skipped_counts,
  r.preview_rows,
  r.approved_word_bank_counts,
  r.inserted_attempt_ids,
  r.assignment_pupil_summary
from pg_temp.repair_completed_assignment_result_attempts(
  repair_pupil_id := (select id from repair_attempt_ids where name = 'pupil'),
  apply_changes := true
) as r;

insert into repair_attempt_outputs
select
  'second_apply',
  r.scoped_parameters,
  r.candidate_status_count,
  r.candidate_result_row_count,
  r.insertable_row_count,
  r.inserted_count,
  r.skipped_counts,
  r.preview_rows,
  r.approved_word_bank_counts,
  r.inserted_attempt_ids,
  r.assignment_pupil_summary
from pg_temp.repair_completed_assignment_result_attempts(
  repair_pupil_id := (select id from repair_attempt_ids where name = 'pupil'),
  apply_changes := true
) as r;

select is(
  (select int_value from repair_attempt_checks where name = 'attempt_count_after_dry_run'),
  0,
  'dry-run inserts no attempts'
);

select is(
  (select candidate_status_count from repair_attempt_outputs where name = 'dry_run'),
  2,
  'dry-run scopes completed status rows for the pupil'
);

select is(
  (select candidate_result_row_count from repair_attempt_outputs where name = 'dry_run'),
  6,
  'dry-run expands final result_json rows only'
);

select is(
  (select insertable_row_count from repair_attempt_outputs where name = 'dry_run'),
  2,
  'dry-run identifies only repairable final rows'
);

select ok(
  (select skipped_counts ->> 'missing_typed' from repair_attempt_outputs where name = 'dry_run') = '1'
  and (select skipped_counts ->> 'ambiguous_word_match' from repair_attempt_outputs where name = 'dry_run') = '1'
  and (select skipped_counts ->> 'incomplete_grapheme_metadata' from repair_attempt_outputs where name = 'dry_run') = '1'
  and (select skipped_counts ->> 'spelling_bee_skipped' from repair_attempt_outputs where name = 'dry_run') = '1',
  'dry-run reports focused skip reasons'
);

select is(
  (select inserted_count from repair_attempt_outputs where name = 'apply'),
  2,
  'apply inserts one final attempt per repairable result row'
);

select is(
  (
    select count(*)::integer
    from public.attempts
    where pupil_id = (select id from repair_attempt_ids where name = 'pupil')
      and assignment_id = (select id from repair_attempt_ids where name = 'assignment')
  ),
  2,
  'apply stores exactly the repairable attempts'
);

select ok(
  exists (
    select 1
    from public.attempts as a
    where a.assignment_id = (select id from repair_attempt_ids where name = 'assignment')
      and a.pupil_id = (select id from repair_attempt_ids where name = 'pupil')
      and a.test_word_id = (select id from repair_attempt_ids where name = 'word_phase')
      and a.assignment_target_id = (select id from repair_attempt_ids where name = 'target_phase')
      and a.typed = 'fase'
      and a.correct is false
      and a.attempt_number = 2
      and a.attempt_no = 2
      and a.attempt_source = 'teacher_assigned'
      and a.focus_grapheme = 'ph'
      and a.target_graphemes = '["ph","a","se"]'::jsonb
      and a.pattern_type = 'digraph'
      and a.mode = 'full_recall'
  ),
  'apply enriches attempt metadata from target rows and test_words'
);

select is(
  (
    select count(*)::integer
    from public.attempts
    where pupil_id = (select id from repair_attempt_ids where name = 'pupil')
      and word_text in ('float', 'plain', 'mystery', 'sting')
  ),
  0,
  'apply skips missing typed, ambiguous, incomplete metadata, and spelling bee rows'
);

select is(
  (select inserted_count from repair_attempt_outputs where name = 'second_apply'),
  0,
  'second apply inserts no duplicates'
);

select is(
  (select skipped_counts ->> 'existing_final_attempt' from repair_attempt_outputs where name = 'second_apply'),
  '2',
  'second apply recognises existing final attempts'
);

select ok(
  (
    select count(*) = 1
      and max(attempt_number) = 2
    from public.attempts
    where assignment_id = (select id from repair_attempt_ids where name = 'assignment')
      and pupil_id = (select id from repair_attempt_ids where name = 'pupil')
      and word_text = 'phase'
  ),
  'attemptsUsed greater than one creates one final row with the final attempt number'
);

select is(
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', id,
        'total_words', total_words,
        'correct_words', correct_words,
        'average_attempts', average_attempts,
        'score_rate', score_rate,
        'result_json', result_json
      )
      order by id
    )
    from public.assignment_pupil_statuses
    where pupil_id = (select id from repair_attempt_ids where name = 'pupil')
  )::text,
  (select json_value::text from repair_attempt_checks where name = 'status_snapshot_before'),
  'assignment summaries and result_json remain unchanged'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements((select approved_word_bank_counts from repair_attempt_outputs where name = 'dry_run')) as bank(value)
    where bank.value ->> 'focus_grapheme' = 'ph'
      and (bank.value ->> 'approved_teacher_word_bank_count')::integer >= 1
  )
  and exists (
    select 1
    from jsonb_array_elements((select approved_word_bank_counts from repair_attempt_outputs where name = 'dry_run')) as bank(value)
    where bank.value ->> 'focus_grapheme' = 'sh'
      and (bank.value ->> 'approved_teacher_word_bank_count')::integer >= 1
  ),
  'dry-run reports approved teacher word-bank counts by focus grapheme'
);

select * from finish();

rollback;
