begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(6);

create temporary table historical_gate_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table historical_gate_values (
  name text primary key,
  state jsonb
) on commit drop;

grant select on table historical_gate_ids to public;
grant select, insert, update, delete on table historical_gate_values to public;

insert into historical_gate_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'teacher',
  'old_form_class',
  'current_form_class',
  'pupil',
  'attempt_pupil',
  'old_baseline_test',
  'old_baseline_assignment',
  'current_test',
  'current_assignment'
]) as names(name);

do $$
declare
  teacher_id uuid := (select id from historical_gate_ids where name = 'teacher');
  old_form_class_id uuid := (select id from historical_gate_ids where name = 'old_form_class');
  current_form_class_id uuid := (select id from historical_gate_ids where name = 'current_form_class');
  pupil_id uuid := (select id from historical_gate_ids where name = 'pupil');
  attempt_pupil_id uuid := (select id from historical_gate_ids where name = 'attempt_pupil');
  old_baseline_test_id uuid := (select id from historical_gate_ids where name = 'old_baseline_test');
  old_baseline_assignment_id uuid := (select id from historical_gate_ids where name = 'old_baseline_assignment');
  current_test_id uuid := (select id from historical_gate_ids where name = 'current_test');
  current_assignment_id uuid := (select id from historical_gate_ids where name = 'current_assignment');
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
    'pgtap-historical-baseline-' || substr(replace(teacher_id::text, '-', ''), 1, 10) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.teachers (id, display_name)
  values (teacher_id, 'pgTAP Historical Baseline Teacher');

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values
    (old_form_class_id, teacher_id, 'pgTAP Old Form', upper(substr(replace(old_form_class_id::text, '-', ''), 1, 6)), 'Year 6', 'form'),
    (current_form_class_id, teacher_id, 'pgTAP Current Form', upper(substr(replace(current_form_class_id::text, '-', ''), 1, 6)), 'Year 7', 'form');

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
    'PGTAP-HIST-' || substr(replace(pupil_id::text, '-', ''), 1, 8),
    'Historical',
    'Baseline',
    'historical.baseline.' || substr(replace(pupil_id::text, '-', ''), 1, 8),
    '1234',
    false,
    true
  ),
  (
    attempt_pupil_id,
    'PGTAP-HIST-A-' || substr(replace(attempt_pupil_id::text, '-', ''), 1, 8),
    'Attempt',
    'Baseline',
    'attempt.baseline.' || substr(replace(attempt_pupil_id::text, '-', ''), 1, 8),
    '1234',
    false,
    true
  );

  insert into public.pupil_classes (pupil_id, class_id, active)
  values
    (pupil_id, old_form_class_id, false),
    (pupil_id, current_form_class_id, true),
    (attempt_pupil_id, old_form_class_id, false),
    (attempt_pupil_id, current_form_class_id, true);

  insert into public.tests (id, teacher_id, title, status, question_type, created_at)
  values
    (old_baseline_test_id, teacher_id, 'Historical completed core v1 baseline', 'published', 'segmented_spelling', timezone('utc', now()) - interval '40 days'),
    (current_test_id, teacher_id, 'Current assigned class test', 'published', 'full_recall', timezone('utc', now()));

  insert into public.test_words (test_id, position, word, sentence, segments, choice)
  select
    old_baseline_test_id,
    item.word_position,
    item.word,
    null,
    to_jsonb(item.segments),
    jsonb_build_object(
      'source', 'baseline_v1',
      'baseline_v1', true,
      'baseline_standard_key', 'core_v1',
      'baseline_version', 'v1',
      'question_type', item.question_type,
      'max_attempts', 1,
      'focus_graphemes', case when item.focus_grapheme is null then '[]'::jsonb else jsonb_build_array(item.focus_grapheme) end
    )
  from public.list_standard_baseline_items('core_v1') as item;

  insert into public.test_words (test_id, position, word, sentence, segments, choice)
  values (
    current_test_id,
    1,
    'phase',
    'A phase sentence.',
    '["ph","a","se"]'::jsonb,
    '{"source":"teacher"}'::jsonb
  );

  insert into public.assignments_v2 (id, teacher_id, class_id, test_id, mode, max_attempts, created_at)
  values
    (old_baseline_assignment_id, teacher_id, old_form_class_id, old_baseline_test_id, 'test', 1, timezone('utc', now()) - interval '40 days'),
    (current_assignment_id, teacher_id, current_form_class_id, current_test_id, 'practice', 2, timezone('utc', now()));

  insert into public.assignments (id, teacher_id, class_id, test_id, created_at)
  values
    (old_baseline_assignment_id, teacher_id, old_form_class_id, old_baseline_test_id, timezone('utc', now()) - interval '40 days'),
    (current_assignment_id, teacher_id, current_form_class_id, current_test_id, timezone('utc', now()));

  insert into public.assignment_pupil_statuses (
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
  values (
    teacher_id,
    old_baseline_assignment_id,
    old_form_class_id,
    old_baseline_test_id,
    pupil_id,
    'completed',
    timezone('utc', now()) - interval '39 days',
    timezone('utc', now()) - interval '39 days',
    16,
    12,
    1,
    0.75,
    '[]'::jsonb
  );

  insert into public.attempts (
    assignment_id,
    pupil_id,
    test_id,
    test_word_id,
    word_text,
    typed,
    mode,
    correct,
    attempt_number,
    attempt_source,
    created_at
  )
  select
    old_baseline_assignment_id,
    attempt_pupil_id,
    old_baseline_test_id,
    tw.id,
    tw.word,
    tw.word,
    coalesce(nullif(tw.choice ->> 'question_type', ''), 'segmented_spelling'),
    true,
    1,
    'baseline',
    timezone('utc', now()) - interval '38 days' + (tw.position || ' minutes')::interval
  from public.test_words as tw
  where tw.test_id = old_baseline_test_id;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);

set local role anon;

insert into historical_gate_values (name, state)
values
  (
    'gate',
    public.read_pupil_baseline_gate_state((select id from historical_gate_ids where name = 'pupil'), 'core_v2')
  ),
  (
    'runtime_assignments',
    public.read_pupil_runtime_assignments((select id from historical_gate_ids where name = 'pupil'))
  ),
  (
    'attempt_gate',
    public.read_pupil_baseline_gate_state((select id from historical_gate_ids where name = 'attempt_pupil'), 'core_v2')
  );

reset role;

select is(
  (select state ->> 'status' from historical_gate_values where name = 'gate'),
  'ready',
  'historical completed baseline satisfies the pupil baseline gate'
);

select is(
  (select state ->> 'completed_assignment_id' from historical_gate_values where name = 'gate'),
  (select id::text from historical_gate_ids where name = 'old_baseline_assignment'),
  'gate points at the historical completed baseline assignment'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements((select state -> 'assignments' from historical_gate_values where name = 'runtime_assignments')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from historical_gate_ids where name = 'current_assignment')
  ),
  'runtime assignments still include current active-class work'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements((select state -> 'assignments' from historical_gate_values where name = 'runtime_assignments')) as assignment_row(value)
    where assignment_row.value ->> 'id' = (select id::text from historical_gate_ids where name = 'old_baseline_assignment')
  ),
  'runtime assignments do not reopen inactive historical-class assignments'
);

select is(
  (select state ->> 'status' from historical_gate_values where name = 'attempt_gate'),
  'ready',
  'historical complete baseline attempts satisfy the pupil baseline gate without a status row'
);

select is(
  (select state ->> 'completed_assignment_id' from historical_gate_values where name = 'attempt_gate'),
  (select id::text from historical_gate_ids where name = 'old_baseline_assignment'),
  'attempt-derived gate points at the historical completed baseline assignment'
);

select * from finish();

rollback;
