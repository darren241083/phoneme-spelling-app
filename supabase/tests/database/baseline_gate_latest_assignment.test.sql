begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(3);

create temporary table latest_gate_values (
  name text primary key,
  id uuid,
  state jsonb
) on commit drop;

do $$
declare
  teacher_user_id uuid := gen_random_uuid();
  form_class_id uuid := gen_random_uuid();
  pupil_id uuid := gen_random_uuid();
  old_test_id uuid;
  old_assignment_id uuid;
  new_test_id uuid;
  new_assignment_id uuid;
  gate_state jsonb;
begin
  perform set_config('request.jwt.claim.sub', teacher_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', teacher_user_id::text, 'role', 'service_role')::text,
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
    teacher_user_id,
    'authenticated',
    'authenticated',
    'pgtap-baseline-latest-' || substr(replace(teacher_user_id::text, '-', ''), 1, 12) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values (teacher_user_id, 'admin', true, teacher_user_id);

  insert into public.teachers (id, display_name)
  values (teacher_user_id, 'pgTAP Latest Baseline Teacher');

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values (
    form_class_id,
    teacher_user_id,
    'pgTAP Latest Baseline Form',
    upper(substr(replace(form_class_id::text, '-', ''), 1, 6)),
    'Year 7',
    'form'
  );

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
    'PGTAP-LATEST-' || substr(replace(pupil_id::text, '-', ''), 1, 8),
    'Latest',
    'Baseline',
    'pgtap.latest.' || substr(replace(pupil_id::text, '-', ''), 1, 10),
    '1234',
    false,
    true
  );

  insert into public.pupil_classes (pupil_id, class_id, active)
  values (pupil_id, form_class_id, true);

  delete from public.assignments_v2
  where class_id = form_class_id;

  insert into public.tests (
    teacher_id,
    title,
    status,
    question_type,
    analytics_target_words_enabled,
    analytics_target_words_per_pupil,
    created_at
  )
  values (
    teacher_user_id,
    'Old completed baseline',
    'published',
    'segmented_spelling',
    false,
    0,
    timezone('utc', now()) - interval '2 days'
  )
  returning id into old_test_id;

  insert into public.test_words (test_id, position, word, sentence, segments, choice)
  select
    old_test_id,
    item.word_position,
    item.word,
    null,
    to_jsonb(item.segments),
    jsonb_build_object(
      'source', 'baseline_v2',
      'baseline_v1', true,
      'baseline_v2', true,
      'baseline_standard_key', 'core_v2',
      'baseline_version', 'v2',
      'baseline_stage', item.stage,
      'baseline_role', 'placement',
      'baseline_signal', item.signal,
      'baseline_preset', item.preset,
      'question_type', item.question_type,
      'max_attempts', 1,
      'focus_graphemes', case when item.focus_grapheme is null then '[]'::jsonb else jsonb_build_array(item.focus_grapheme) end
    )
  from public.list_standard_baseline_items('core_v2') as item;

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
    analytics_target_words_per_pupil,
    created_at
  )
  values (
    teacher_user_id,
    old_test_id,
    form_class_id,
    'test',
    null,
    true,
    false,
    null,
    false,
    0,
    timezone('utc', now()) - interval '2 days'
  )
  returning id into old_assignment_id;

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
    teacher_user_id,
    old_assignment_id,
    form_class_id,
    old_test_id,
    pupil_id,
    'completed',
    timezone('utc', now()) - interval '2 days',
    timezone('utc', now()) - interval '1 day',
    18,
    18,
    1,
    1,
    '[]'::jsonb
  );

  insert into public.tests (
    teacher_id,
    title,
    status,
    question_type,
    analytics_target_words_enabled,
    analytics_target_words_per_pupil,
    created_at
  )
  values (
    teacher_user_id,
    'New assigned baseline',
    'published',
    'segmented_spelling',
    false,
    0,
    timezone('utc', now())
  )
  returning id into new_test_id;

  insert into public.test_words (test_id, position, word, sentence, segments, choice)
  select
    new_test_id,
    item.word_position,
    item.word,
    null,
    to_jsonb(item.segments),
    jsonb_build_object(
      'source', 'baseline_v2',
      'baseline_v1', true,
      'baseline_v2', true,
      'baseline_standard_key', 'core_v2',
      'baseline_version', 'v2',
      'baseline_stage', item.stage,
      'baseline_role', 'placement',
      'baseline_signal', item.signal,
      'baseline_preset', item.preset,
      'question_type', item.question_type,
      'max_attempts', 1,
      'focus_graphemes', case when item.focus_grapheme is null then '[]'::jsonb else jsonb_build_array(item.focus_grapheme) end
    )
  from public.list_standard_baseline_items('core_v2') as item;

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
    analytics_target_words_per_pupil,
    created_at
  )
  values (
    teacher_user_id,
    new_test_id,
    form_class_id,
    'test',
    null,
    true,
    false,
    null,
    false,
    0,
    timezone('utc', now())
  )
  returning id into new_assignment_id;

  gate_state := public.read_pupil_baseline_gate_state(pupil_id, 'core_v2');

  insert into latest_gate_values (name, id, state)
  values
    ('old_completed', old_assignment_id, gate_state),
    ('new_assigned', new_assignment_id, gate_state);
end;
$$;

select is(
  (select state ->> 'status' from latest_gate_values where name = 'old_completed'),
  'ready',
  'completed baseline satisfies gate before a newer assigned baseline'
);

select is(
  (select state ->> 'completed_assignment_id' from latest_gate_values where name = 'old_completed'),
  (select id::text from latest_gate_values where name = 'old_completed'),
  'gate completed_assignment_id points to the completed baseline'
);

select ok(
  (select state -> 'assignment' from latest_gate_values where name = 'old_completed') = 'null'::jsonb,
  'gate does not return a baseline payload when the pupil has completed the required standard'
);

select * from finish();

rollback;
