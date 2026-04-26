begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(14);

create temporary table test_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table check_values (
  name text primary key,
  bool_value boolean,
  int_value integer,
  text_value text,
  json_value jsonb
) on commit drop;

insert into test_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'teacher_user',
  'form_class',
  'pupil'
]) as names(name);

do $$
declare
  teacher_user_id uuid := (select id from test_ids where name = 'teacher_user');
  form_class_id uuid := (select id from test_ids where name = 'form_class');
  pupil_id uuid := (select id from test_ids where name = 'pupil');
  baseline_v2_assignment_id uuid;
  baseline_v1_assignment_id uuid;
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
    'pgtap-baseline-v2-' || substr(replace(teacher_user_id::text, '-', ''), 1, 12) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do nothing;

  insert into public.staff_role_assignments (user_id, role, active, granted_by)
  values (teacher_user_id, 'admin', true, teacher_user_id);

  insert into public.teachers (id, display_name)
  values (teacher_user_id, 'pgTAP Baseline V2 Teacher');

  insert into public.classes (id, teacher_id, name, join_code, year_group, class_type)
  values (
    form_class_id,
    teacher_user_id,
    'pgTAP Baseline V2 Form',
    upper(substr(replace(form_class_id::text, '-', ''), 1, 6)),
    'Year 7',
    'form'
  );

  perform public.ensure_form_class_baseline_assignment_internal(form_class_id);

  select a.id
  into baseline_v2_assignment_id
  from public.assignments_v2 as a
  inner join public.test_words as tw
    on tw.test_id = a.test_id
  where a.class_id = form_class_id
  group by a.id, a.created_at
  having bool_and(public.is_standard_baseline_choice(tw.choice, 'core_v2'))
  order by a.created_at desc
  limit 1;

  perform public.ensure_form_class_baseline_assignment_internal(form_class_id, 'core_v1');

  select a.id
  into baseline_v1_assignment_id
  from public.assignments_v2 as a
  inner join public.test_words as tw
    on tw.test_id = a.test_id
  where a.class_id = form_class_id
  group by a.id, a.created_at
  having bool_and(public.is_standard_baseline_choice(tw.choice, 'core_v1'))
  order by a.created_at desc
  limit 1;

  insert into public.pupils (
    id,
    mis_id,
    first_name,
    surname,
    username,
    pin_hash,
    has_set_pin,
    is_active
  )
  values (
    pupil_id,
    'PGTAP-BL2-' || substr(replace(pupil_id::text, '-', ''), 1, 10),
    'Baseline',
    'Pupil',
    'pgtap.baseline.' || substr(replace(pupil_id::text, '-', ''), 1, 10),
    '1234',
    false,
    true
  );

  insert into public.pupil_classes (pupil_id, class_id, active)
  values (pupil_id, form_class_id, true);

  insert into check_values (name, int_value)
  select 'catalog_v2_count', count(*)::integer
  from public.list_standard_baseline_items('core_v2');

  insert into check_values (name, text_value)
  select 'catalog_v2_words', string_agg(word, ',' order by word_position)
  from public.list_standard_baseline_items('core_v2');

  insert into check_values (name, int_value)
  select 'catalog_v2_floor_core_count', count(*)::integer
  from public.list_standard_baseline_items('core_v2')
  where stage = 'floor_core';

  insert into check_values (name, int_value)
  select 'catalog_v2_diagnostic_count', count(*)::integer
  from public.list_standard_baseline_items('core_v2')
  where stage = 'diagnostic';

  insert into check_values (name, int_value)
  select 'catalog_v2_ceiling_count', count(*)::integer
  from public.list_standard_baseline_items('core_v2')
  where stage = 'ceiling_challenge';

  insert into check_values (name, int_value)
  select 'catalog_v1_count', count(*)::integer
  from public.list_standard_baseline_items('core_v1');

  insert into check_values (name, int_value)
  select 'provisioned_v2_word_count', count(*)::integer
  from public.assignments_v2 as a
  inner join public.test_words as tw
    on tw.test_id = a.test_id
  where a.id = baseline_v2_assignment_id;

  insert into check_values (name, bool_value)
  select 'provisioned_v2_choice_metadata', bool_and(
    tw.choice ->> 'source' = 'baseline_v2'
    and tw.choice ->> 'baseline_standard_key' = 'core_v2'
    and lower(coalesce(tw.choice ->> 'baseline_v2', '')) = 'true'
    and coalesce(tw.choice ->> 'baseline_v1', '') = ''
    and tw.choice ->> 'max_attempts' = '1'
    and tw.choice ? 'difficulty'
  )
  from public.assignments_v2 as a
  inner join public.test_words as tw
    on tw.test_id = a.test_id
  where a.id = baseline_v2_assignment_id;

  insert into check_values (name, bool_value)
  select 'provisioned_v2_difficulty_bands', bool_and(
    case
      when tw.position between 1 and 6 then tw.choice -> 'difficulty' ->> 'coreBand' = 'easier'
      when tw.position between 7 and 10 then tw.choice -> 'difficulty' ->> 'coreBand' = 'core'
      when tw.position between 15 and 18 then tw.choice -> 'difficulty' ->> 'coreBand' in ('stretch', 'challenge')
      else true
    end
  )
  from public.assignments_v2 as a
  inner join public.test_words as tw
    on tw.test_id = a.test_id
  where a.id = baseline_v2_assignment_id;

  insert into check_values (name, json_value)
  values ('gate_v2_default', public.read_pupil_baseline_gate_state(pupil_id));

  insert into check_values (name, json_value)
  values ('gate_v1_legacy', public.read_pupil_baseline_gate_state(pupil_id, 'core_v1'));

  insert into check_values (name, int_value)
  select 'provisioned_v1_word_count', count(*)::integer
  from public.assignments_v2 as a
  inner join public.test_words as tw
    on tw.test_id = a.test_id
  where a.id = baseline_v1_assignment_id;
end;
$$;

select is(
  (select int_value from check_values where name = 'catalog_v2_count'),
  18,
  'core_v2 catalogue has exactly 18 words'
);

select is(
  (select text_value from check_values where name = 'catalog_v2_words'),
  'boat,seed,train,light,sharp,storm,enough,special,science,question,paint,point,fair,nurse,daughter,communication,description,subtraction',
  'core_v2 catalogue preserves the standardised word order'
);

select is(
  (select int_value from check_values where name = 'catalog_v2_floor_core_count'),
  10,
  'core_v2 has ten floor/core words'
);

select is(
  (select int_value from check_values where name = 'catalog_v2_diagnostic_count'),
  4,
  'core_v2 has four diagnostic words'
);

select is(
  (select int_value from check_values where name = 'catalog_v2_ceiling_count'),
  4,
  'core_v2 has four ceiling challenge words'
);

select is(
  (select int_value from check_values where name = 'catalog_v1_count'),
  16,
  'core_v1 catalogue remains readable for historical baseline rows'
);

select is(
  (select int_value from check_values where name = 'provisioned_v2_word_count'),
  18,
  'default form baseline provisioning creates the v2 word count'
);

select ok(
  (select bool_value from check_values where name = 'provisioned_v2_choice_metadata'),
  'provisioned v2 words carry source, standard key, max attempts, and persisted difficulty metadata'
);

select ok(
  (select bool_value from check_values where name = 'provisioned_v2_difficulty_bands'),
  'provisioned v2 difficulty metadata spans easier, core, and stretch ceiling bands'
);

select is(
  (select json_value ->> 'required_standard_key' from check_values where name = 'gate_v2_default'),
  'core_v2',
  'baseline gate defaults to core_v2'
);

select is(
  (select json_value ->> 'status' from check_values where name = 'gate_v2_default'),
  'start',
  'baseline gate selects the v2 baseline for a new active form pupil'
);

select is(
  jsonb_array_length((select json_value -> 'assignment' -> 'words' from check_values where name = 'gate_v2_default')),
  18,
  'baseline gate returns the 18-word v2 assignment payload'
);

select is(
  (select json_value ->> 'required_standard_key' from check_values where name = 'gate_v1_legacy'),
  'core_v1',
  'baseline gate can still read a requested core_v1 baseline'
);

select is(
  (select int_value from check_values where name = 'provisioned_v1_word_count'),
  16,
  'explicit core_v1 provisioning remains available for historical compatibility'
);

select * from finish();

rollback;
