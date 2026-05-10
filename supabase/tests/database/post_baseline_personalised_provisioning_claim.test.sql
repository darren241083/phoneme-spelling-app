begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(19);

create temporary table post_baseline_claim_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table post_baseline_claim_results (
  name text primary key,
  result jsonb not null
) on commit drop;

do $$
declare
  teacher_user_id uuid := gen_random_uuid();
  form_class_id uuid := gen_random_uuid();
  inactive_form_class_id uuid := gen_random_uuid();
  wrong_form_class_id uuid := gen_random_uuid();
  ready_pupil_id uuid := gen_random_uuid();
  incomplete_pupil_id uuid := gen_random_uuid();
  active_pupil_id uuid := gen_random_uuid();
  ineligible_pupil_id uuid := gen_random_uuid();
  baseline_test_id uuid;
  baseline_assignment_id uuid;
  live_policy_id uuid := gen_random_uuid();
  expired_policy_id uuid := gen_random_uuid();
  archived_policy_id uuid := gen_random_uuid();
  inactive_policy_id uuid := gen_random_uuid();
  bee_policy_id uuid := gen_random_uuid();
  wrong_target_policy_id uuid := gen_random_uuid();
  live_run_id uuid := gen_random_uuid();
  expired_run_id uuid := gen_random_uuid();
  archived_run_id uuid := gen_random_uuid();
  inactive_run_id uuid := gen_random_uuid();
  bee_run_id uuid := gen_random_uuid();
  wrong_target_run_id uuid := gen_random_uuid();
  ready_run_pupil_id uuid := gen_random_uuid();
  incomplete_run_pupil_id uuid := gen_random_uuid();
  active_run_pupil_id uuid := gen_random_uuid();
  expired_run_pupil_id uuid := gen_random_uuid();
  archived_run_pupil_id uuid := gen_random_uuid();
  inactive_run_pupil_id uuid := gen_random_uuid();
  bee_run_pupil_id uuid := gen_random_uuid();
  wrong_target_run_pupil_id uuid := gen_random_uuid();
  active_assignment_test_id uuid;
  active_assignment_word_id uuid;
  active_assignment_id uuid;
  final_assignment_test_id uuid;
  final_assignment_id uuid;
  first_claim jsonb;
  second_claim jsonb;
  release_result jsonb;
  reclaim_result jsonb;
  complete_result jsonb;
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
    'pgtap-post-baseline-claim-' || substr(replace(teacher_user_id::text, '-', ''), 1, 12) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.teachers (id, display_name)
  values (teacher_user_id, 'pgTAP Post Baseline Claim Teacher');

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values (teacher_user_id, 'admin', true, teacher_user_id);

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values
    (
      form_class_id,
      teacher_user_id,
      'pgTAP Post Baseline Claim Form',
      upper(substr(replace(form_class_id::text, '-', ''), 1, 6)),
      'Year 7',
      'form'
    ),
    (
      inactive_form_class_id,
      teacher_user_id,
      'pgTAP Inactive Policy Form',
      upper(substr(replace(inactive_form_class_id::text, '-', ''), 1, 6)),
      'Year 7',
      'form'
    ),
    (
      wrong_form_class_id,
      teacher_user_id,
      'pgTAP Wrong Target Form',
      upper(substr(replace(wrong_form_class_id::text, '-', ''), 1, 6)),
      'Year 8',
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
  values
    (
      ready_pupil_id,
      'PGTAP-READY-' || substr(replace(ready_pupil_id::text, '-', ''), 1, 8),
      'Ready',
      'Baseline',
      'pgtap.ready.' || substr(replace(ready_pupil_id::text, '-', ''), 1, 10),
      '1234',
      false,
      true
    ),
    (
      incomplete_pupil_id,
      'PGTAP-INCOMPLETE-' || substr(replace(incomplete_pupil_id::text, '-', ''), 1, 8),
      'Waiting',
      'Baseline',
      'pgtap.waiting.' || substr(replace(incomplete_pupil_id::text, '-', ''), 1, 10),
      '1234',
      false,
      true
    ),
    (
      active_pupil_id,
      'PGTAP-ACTIVE-' || substr(replace(active_pupil_id::text, '-', ''), 1, 8),
      'Already',
      'Active',
      'pgtap.active.' || substr(replace(active_pupil_id::text, '-', ''), 1, 10),
      '1234',
      false,
      true
    ),
    (
      ineligible_pupil_id,
      'PGTAP-INELIGIBLE-' || substr(replace(ineligible_pupil_id::text, '-', ''), 1, 8),
      'Policy',
      'Ineligible',
      'pgtap.ineligible.' || substr(replace(ineligible_pupil_id::text, '-', ''), 1, 10),
      '1234',
      false,
      true
    );

  insert into public.pupil_classes (pupil_id, class_id, active)
  values
    (ready_pupil_id, form_class_id, true),
    (incomplete_pupil_id, form_class_id, true),
    (active_pupil_id, form_class_id, true),
    (ineligible_pupil_id, form_class_id, true),
    (ineligible_pupil_id, inactive_form_class_id, true);

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
    'pgTAP Post Baseline Claim Baseline',
    'published',
    'segmented_spelling',
    false,
    0,
    timezone('utc', now())
  )
  returning id into baseline_test_id;

  insert into public.test_words (test_id, position, word, sentence, segments, choice)
  select
    baseline_test_id,
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
    baseline_test_id,
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
  returning id into baseline_assignment_id;

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
  values
    (
      teacher_user_id,
      baseline_assignment_id,
      form_class_id,
      baseline_test_id,
      ready_pupil_id,
      'completed',
      timezone('utc', now()) - interval '1 hour',
      timezone('utc', now()),
      18,
      18,
      1,
      1,
      '[]'::jsonb
    ),
    (
      teacher_user_id,
      baseline_assignment_id,
      form_class_id,
      baseline_test_id,
      active_pupil_id,
      'completed',
      timezone('utc', now()) - interval '1 hour',
      timezone('utc', now()),
      18,
      18,
      1,
      1,
      '[]'::jsonb
    ),
    (
      teacher_user_id,
      baseline_assignment_id,
      form_class_id,
      baseline_test_id,
      ineligible_pupil_id,
      'completed',
      timezone('utc', now()) - interval '1 hour',
      timezone('utc', now()),
      18,
      18,
      1,
      1,
      '[]'::jsonb
    );

  insert into public.personalised_automation_policies (
    id,
    teacher_id,
    active,
    assignment_length,
    support_preset,
    frequency,
    start_date,
    end_date,
    created_by,
    updated_by,
    name,
    archived_at,
    policy_type,
    bee_length_mode
  )
  values
    (
      live_policy_id,
      teacher_user_id,
      true,
      10,
      'balanced',
      'weekly',
      current_date,
      null,
      teacher_user_id,
      teacher_user_id,
      'pgTAP Live Personalised Policy',
      null,
      'regular_personalised',
      null
    ),
    (
      expired_policy_id,
      teacher_user_id,
      true,
      10,
      'balanced',
      'weekly',
      current_date - 14,
      current_date - 7,
      teacher_user_id,
      teacher_user_id,
      'pgTAP Expired Personalised Policy',
      null,
      'regular_personalised',
      null
    ),
    (
      archived_policy_id,
      teacher_user_id,
      true,
      10,
      'balanced',
      'weekly',
      current_date,
      null,
      teacher_user_id,
      teacher_user_id,
      'pgTAP Archived Personalised Policy',
      timezone('utc', now()),
      'regular_personalised',
      null
    ),
    (
      inactive_policy_id,
      teacher_user_id,
      false,
      10,
      'balanced',
      'weekly',
      current_date,
      null,
      teacher_user_id,
      teacher_user_id,
      'pgTAP Inactive Personalised Policy',
      null,
      'regular_personalised',
      null
    ),
    (
      bee_policy_id,
      teacher_user_id,
      true,
      10,
      'balanced',
      'weekly',
      current_date,
      null,
      teacher_user_id,
      teacher_user_id,
      'pgTAP Spelling Bee Policy',
      null,
      'spelling_bee',
      'capped'
    ),
    (
      wrong_target_policy_id,
      teacher_user_id,
      true,
      10,
      'balanced',
      'weekly',
      current_date,
      null,
      teacher_user_id,
      teacher_user_id,
      'pgTAP Wrong Target Personalised Policy',
      null,
      'regular_personalised',
      null
    );

  insert into public.personalised_automation_policy_targets (policy_id, teacher_id, class_id)
  values
    (live_policy_id, teacher_user_id, form_class_id),
    (expired_policy_id, teacher_user_id, form_class_id),
    (archived_policy_id, teacher_user_id, form_class_id),
    (inactive_policy_id, teacher_user_id, inactive_form_class_id),
    (bee_policy_id, teacher_user_id, form_class_id),
    (wrong_target_policy_id, teacher_user_id, wrong_form_class_id);

  insert into public.personalised_generation_runs (
    id,
    teacher_id,
    assignment_length,
    support_preset,
    selected_class_ids,
    class_count,
    included_pupil_count,
    skipped_pupil_count,
    status,
    finished_at,
    automation_policy_id,
    policy_type,
    bee_length_mode
  )
  values
    (
      live_run_id,
      teacher_user_id,
      10,
      'balanced',
      to_jsonb(array[form_class_id::text]),
      1,
      0,
      0,
      'completed',
      timezone('utc', now()),
      live_policy_id,
      'regular_personalised',
      null
    ),
    (
      expired_run_id,
      teacher_user_id,
      10,
      'balanced',
      to_jsonb(array[form_class_id::text]),
      1,
      0,
      0,
      'completed',
      timezone('utc', now()),
      expired_policy_id,
      'regular_personalised',
      null
    ),
    (
      archived_run_id,
      teacher_user_id,
      10,
      'balanced',
      to_jsonb(array[form_class_id::text]),
      1,
      0,
      0,
      'completed',
      timezone('utc', now()),
      archived_policy_id,
      'regular_personalised',
      null
    ),
    (
      inactive_run_id,
      teacher_user_id,
      10,
      'balanced',
      to_jsonb(array[inactive_form_class_id::text]),
      1,
      0,
      0,
      'completed',
      timezone('utc', now()),
      inactive_policy_id,
      'regular_personalised',
      null
    ),
    (
      bee_run_id,
      teacher_user_id,
      10,
      'balanced',
      to_jsonb(array[form_class_id::text]),
      1,
      0,
      0,
      'completed',
      timezone('utc', now()),
      bee_policy_id,
      'spelling_bee',
      'capped'
    ),
    (
      wrong_target_run_id,
      teacher_user_id,
      10,
      'balanced',
      to_jsonb(array[wrong_form_class_id::text]),
      1,
      0,
      0,
      'completed',
      timezone('utc', now()),
      wrong_target_policy_id,
      'regular_personalised',
      null
    );

  insert into public.personalised_generation_run_pupils (
    id,
    run_id,
    teacher_id,
    class_id,
    pupil_id,
    assignment_id,
    status,
    skip_reason
  )
  values
    (ready_run_pupil_id, live_run_id, teacher_user_id, form_class_id, ready_pupil_id, null, 'waiting', 'baseline_incomplete'),
    (incomplete_run_pupil_id, live_run_id, teacher_user_id, form_class_id, incomplete_pupil_id, null, 'waiting', 'no_baseline_assignment'),
    (active_run_pupil_id, live_run_id, teacher_user_id, form_class_id, active_pupil_id, null, 'waiting', 'baseline_incomplete'),
    (expired_run_pupil_id, expired_run_id, teacher_user_id, form_class_id, ineligible_pupil_id, null, 'waiting', 'baseline_incomplete'),
    (archived_run_pupil_id, archived_run_id, teacher_user_id, form_class_id, ineligible_pupil_id, null, 'waiting', 'baseline_incomplete'),
    (inactive_run_pupil_id, inactive_run_id, teacher_user_id, inactive_form_class_id, ineligible_pupil_id, null, 'waiting', 'baseline_incomplete'),
    (bee_run_pupil_id, bee_run_id, teacher_user_id, form_class_id, ineligible_pupil_id, null, 'waiting', 'baseline_incomplete'),
    (wrong_target_run_pupil_id, wrong_target_run_id, teacher_user_id, wrong_form_class_id, ineligible_pupil_id, null, 'waiting', 'baseline_incomplete');

  insert into public.tests (
    teacher_id,
    title,
    status,
    question_type,
    analytics_target_words_enabled,
    analytics_target_words_per_pupil
  )
  values (
    teacher_user_id,
    'pgTAP Existing Generated Test',
    'published',
    'segmented_spelling',
    true,
    10
  )
  returning id into active_assignment_test_id;

  insert into public.test_words (test_id, position, word, sentence, segments, choice)
  values (
    active_assignment_test_id,
    1,
    'phase',
    null,
    '["ph","a","se"]'::jsonb,
    '{"source":"assignment_engine","baseline_v2":false}'::jsonb
  )
  returning id into active_assignment_word_id;

  insert into public.assignments_v2 (
    teacher_id,
    class_id,
    test_id,
    mode,
    max_attempts,
    question_type,
    analytics_target_words_enabled,
    analytics_target_words_per_pupil,
    automation_kind,
    automation_source,
    automation_run_id,
    automation_triggered_by
  )
  values (
    teacher_user_id,
    form_class_id,
    active_assignment_test_id,
    'practice',
    3,
    'segmented_spelling',
    true,
    10,
    'personalised',
    'manual_run_now',
    live_run_id,
    teacher_user_id
  )
  returning id into active_assignment_id;

  insert into public.assignment_pupil_target_words (
    teacher_id,
    assignment_id,
    pupil_id,
    test_word_id,
    focus_grapheme
  )
  values (
    teacher_user_id,
    active_assignment_id,
    active_pupil_id,
    active_assignment_word_id,
    'ph'
  );

  insert into public.assignment_pupil_statuses (
    teacher_id,
    assignment_id,
    class_id,
    test_id,
    pupil_id,
    status
  )
  values (
    teacher_user_id,
    active_assignment_id,
    form_class_id,
    active_assignment_test_id,
    active_pupil_id,
    'assigned'
  );

  first_claim := public.claim_waiting_personalised_generation_run_pupil(ready_pupil_id);
  insert into post_baseline_claim_results (name, result)
  values ('first_claim', first_claim);

  insert into post_baseline_claim_results (name, result)
  select
    'ready_after_first_claim',
    jsonb_build_object('status', status, 'skip_reason', skip_reason)
  from public.personalised_generation_run_pupils
  where id = ready_run_pupil_id;

  second_claim := public.claim_waiting_personalised_generation_run_pupil(ready_pupil_id);
  insert into post_baseline_claim_results (name, result)
  values ('second_claim', second_claim);

  release_result := public.release_waiting_personalised_generation_run_pupil((first_claim ->> 'run_pupil_id')::uuid);
  insert into post_baseline_claim_results (name, result)
  values ('release', release_result);

  insert into post_baseline_claim_results (name, result)
  select
    'ready_after_release',
    jsonb_build_object('status', status, 'skip_reason', skip_reason)
  from public.personalised_generation_run_pupils
  where id = ready_run_pupil_id;

  reclaim_result := public.claim_waiting_personalised_generation_run_pupil(ready_pupil_id);
  insert into post_baseline_claim_results (name, result)
  values ('reclaim', reclaim_result);

  insert into public.tests (
    teacher_id,
    title,
    status,
    question_type,
    analytics_target_words_enabled,
    analytics_target_words_per_pupil
  )
  values (
    teacher_user_id,
    'pgTAP Final Generated Test',
    'published',
    'segmented_spelling',
    true,
    10
  )
  returning id into final_assignment_test_id;

  insert into public.test_words (test_id, position, word, sentence, segments, choice)
  values (
    final_assignment_test_id,
    1,
    'shape',
    null,
    '["sh","a","pe"]'::jsonb,
    '{"source":"assignment_engine","baseline_v2":false}'::jsonb
  );

  insert into public.assignments_v2 (
    teacher_id,
    class_id,
    test_id,
    mode,
    max_attempts,
    question_type,
    analytics_target_words_enabled,
    analytics_target_words_per_pupil,
    automation_kind,
    automation_source,
    automation_run_id,
    automation_triggered_by
  )
  values (
    teacher_user_id,
    form_class_id,
    final_assignment_test_id,
    'practice',
    3,
    'segmented_spelling',
    true,
    10,
    'personalised',
    'manual_run_now',
    live_run_id,
    teacher_user_id
  )
  returning id into final_assignment_id;

  complete_result := public.complete_waiting_personalised_generation_run_pupil(
    (reclaim_result ->> 'run_pupil_id')::uuid,
    final_assignment_id
  );
  insert into post_baseline_claim_results (name, result)
  values ('complete', complete_result);

  insert into post_baseline_claim_results (name, result)
  values
    ('incomplete_claim', public.claim_waiting_personalised_generation_run_pupil(incomplete_pupil_id)),
    ('active_claim', public.claim_waiting_personalised_generation_run_pupil(active_pupil_id)),
    ('ineligible_claim', public.claim_waiting_personalised_generation_run_pupil(ineligible_pupil_id));

  insert into post_baseline_claim_ids (name, id)
  values
    ('ready_run_pupil', ready_run_pupil_id),
    ('incomplete_run_pupil', incomplete_run_pupil_id),
    ('active_run_pupil', active_run_pupil_id),
    ('expired_run_pupil', expired_run_pupil_id),
    ('archived_run_pupil', archived_run_pupil_id),
    ('inactive_run_pupil', inactive_run_pupil_id),
    ('bee_run_pupil', bee_run_pupil_id),
    ('wrong_target_run_pupil', wrong_target_run_pupil_id),
    ('final_assignment', final_assignment_id);
end;
$$;

select ok(
  position('provisioning' in coalesce((
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.personalised_generation_run_pupils'::regclass
      and conname = 'personalised_generation_run_pupils_status_check'
  ), '')) > 0,
  'personalised generation run pupil status allows provisioning'
);

select ok(
  has_function_privilege('service_role', 'public.claim_waiting_personalised_generation_run_pupil(uuid)', 'execute'),
  'service_role can execute waiting personalised claim RPC'
);

select ok(
  not has_function_privilege('anon', 'public.claim_waiting_personalised_generation_run_pupil(uuid)', 'execute'),
  'anon cannot execute waiting personalised claim RPC'
);

select ok(
  has_function_privilege('service_role', 'public.complete_waiting_personalised_generation_run_pupil(uuid, uuid)', 'execute'),
  'service_role can execute waiting personalised complete RPC'
);

select ok(
  has_function_privilege('service_role', 'public.release_waiting_personalised_generation_run_pupil(uuid)', 'execute'),
  'service_role can execute waiting personalised release RPC'
);

select is(
  (select result ->> 'status' from post_baseline_claim_results where name = 'first_claim'),
  'claimed',
  'baseline-ready waiting pupil can be claimed'
);

select is(
  (select result ->> 'status' from post_baseline_claim_results where name = 'ready_after_first_claim'),
  'provisioning',
  'claim updates the waiting row to provisioning'
);

select is(
  (select result ->> 'status' from post_baseline_claim_results where name = 'second_claim'),
  'already_provisioning',
  'second claim does not reclaim a non-stale provisioning row'
);

select is(
  (select result ->> 'status' from post_baseline_claim_results where name = 'release'),
  'released',
  'release returns a provisioning row to waiting'
);

select ok(
  (
    select (result ->> 'status') = 'waiting'
      and (result ->> 'skip_reason') = 'baseline_incomplete'
    from post_baseline_claim_results
    where name = 'ready_after_release'
  ),
  'release returns the row to waiting and preserves the baseline waiting reason'
);

select ok(
  (
    select status = 'included'
      and assignment_id = (select id from post_baseline_claim_ids where name = 'final_assignment')
      and skip_reason is null
    from public.personalised_generation_run_pupils
    where id = (select id from post_baseline_claim_ids where name = 'ready_run_pupil')
  ),
  'complete marks the provisioning row included with assignment id and clears skip reason'
);

select is(
  (select result ->> 'status' from post_baseline_claim_results where name = 'complete'),
  'completed',
  'complete RPC reports completed'
);

select is(
  (select result ->> 'status' from post_baseline_claim_results where name = 'incomplete_claim'),
  'not_ready',
  'incomplete baseline pupil cannot be claimed'
);

select ok(
  (
    select status = 'waiting' and skip_reason = 'no_baseline_assignment'
    from public.personalised_generation_run_pupils
    where id = (select id from post_baseline_claim_ids where name = 'incomplete_run_pupil')
  ),
  'incomplete baseline row remains waiting'
);

select is(
  (select result ->> 'status' from post_baseline_claim_results where name = 'active_claim'),
  'already_active',
  'existing active generated personalised assignment blocks claiming'
);

select is(
  (
    select status
    from public.personalised_generation_run_pupils
    where id = (select id from post_baseline_claim_ids where name = 'active_run_pupil')
  ),
  'waiting',
  'active-assignment blocked row remains waiting'
);

select is(
  (select result ->> 'status' from post_baseline_claim_results where name = 'ineligible_claim'),
  'nothing_waiting',
  'expired archived inactive spelling bee and wrong-target policy rows are not claimed'
);

select ok(
  not exists (
    select 1
    from public.personalised_generation_run_pupils
    where id in (
      (select id from post_baseline_claim_ids where name = 'expired_run_pupil'),
      (select id from post_baseline_claim_ids where name = 'archived_run_pupil'),
      (select id from post_baseline_claim_ids where name = 'inactive_run_pupil'),
      (select id from post_baseline_claim_ids where name = 'bee_run_pupil'),
      (select id from post_baseline_claim_ids where name = 'wrong_target_run_pupil')
    )
      and status <> 'waiting'
  ),
  'ineligible policy rows remain waiting'
);

select is(
  (
    select count(*)::integer
    from public.personalised_generation_run_pupils
    where pupil_id = (
      select pupil_id
      from public.personalised_generation_run_pupils
      where id = (select id from post_baseline_claim_ids where name = 'ready_run_pupil')
    )
      and status = 'included'
  ),
  1,
  'claim and complete path includes only one run-pupil row for the ready pupil'
);

select * from finish();

rollback;
