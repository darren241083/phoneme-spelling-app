begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(34);

create temporary table wordloom_bank_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table wordloom_bank_checks (
  name text primary key,
  bool_value boolean,
  int_value integer
) on commit drop;

grant select on table wordloom_bank_ids to public;
grant select, insert, update, delete on table wordloom_bank_checks to public;

insert into wordloom_bank_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'school_a',
  'school_b',
  'teacher_a',
  'teacher_b',
  'admin_a',
  'target_ar',
  'core_word_sharp',
  'override_a',
  'override_b',
  'school_word_a',
  'school_word_b'
]) as names(name);

create or replace function pg_temp.try_insert_core_focus_target(
  p_focus_grapheme text
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  insert into public.wordloom_core_focus_targets (focus_grapheme)
  values (p_focus_grapheme);

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.try_insert_core_word(
  p_word text,
  p_normalised_word text,
  p_grapheme_segments jsonb,
  p_focus_graphemes jsonb,
  p_suitability_status text,
  p_approval_status text,
  p_sentence text,
  p_meaning text,
  p_difficulty_score integer default 35
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  insert into public.wordloom_core_words (
    word,
    normalised_word,
    grapheme_segments,
    focus_graphemes,
    primary_focus_grapheme,
    difficulty_score,
    sentence,
    meaning,
    suitability_status,
    approval_status
  )
  values (
    p_word,
    p_normalised_word,
    p_grapheme_segments,
    p_focus_graphemes,
    p_focus_graphemes ->> 0,
    p_difficulty_score,
    p_sentence,
    p_meaning,
    p_suitability_status,
    p_approval_status
  );

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.try_insert_core_word_target(
  p_word_id uuid,
  p_focus_target_id uuid,
  p_focus_grapheme text,
  p_target_role text
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  insert into public.wordloom_core_word_targets (
    word_id,
    focus_target_id,
    focus_grapheme,
    target_role
  )
  values (
    p_word_id,
    p_focus_target_id,
    p_focus_grapheme,
    p_target_role
  );

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.try_insert_school_override(
  p_school_id uuid,
  p_core_word_id uuid,
  p_focus_target_id uuid,
  p_blocked boolean default true
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  insert into public.school_spelling_bank_overrides (
    school_id,
    core_word_id,
    focus_target_id,
    blocked,
    created_by
  )
  values (
    p_school_id,
    p_core_word_id,
    p_focus_target_id,
    p_blocked,
    auth.uid()
  );

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.try_insert_school_word(
  p_school_id uuid,
  p_word text,
  p_normalised_word text,
  p_approval_status text default 'pending',
  p_sentence text default null,
  p_meaning text default null
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  insert into public.school_spelling_bank_words (
    school_id,
    word,
    normalised_word,
    grapheme_segments,
    focus_graphemes,
    primary_focus_grapheme,
    difficulty_score,
    sentence,
    meaning,
    approval_status,
    created_by,
    reviewed_by,
    reviewed_at
  )
  values (
    p_school_id,
    p_word,
    p_normalised_word,
    '["sh","ar","p"]'::jsonb,
    '["ar"]'::jsonb,
    'ar',
    35,
    p_sentence,
    p_meaning,
    p_approval_status,
    auth.uid(),
    case when p_approval_status = 'pending' then null else auth.uid() end,
    case when p_approval_status = 'pending' then null else timezone('utc', now()) end
  );

  return true;
exception
  when others then
    return false;
end;
$$;

grant execute on function pg_temp.try_insert_core_focus_target(text) to public;
grant execute on function pg_temp.try_insert_core_word(text, text, jsonb, jsonb, text, text, text, text, integer) to public;
grant execute on function pg_temp.try_insert_core_word_target(uuid, uuid, text, text) to public;
grant execute on function pg_temp.try_insert_school_override(uuid, uuid, uuid, boolean) to public;
grant execute on function pg_temp.try_insert_school_word(uuid, text, text, text, text, text) to public;

do $$
declare
  school_a_id uuid := (select id from wordloom_bank_ids where name = 'school_a');
  school_b_id uuid := (select id from wordloom_bank_ids where name = 'school_b');
  teacher_a_id uuid := (select id from wordloom_bank_ids where name = 'teacher_a');
  teacher_b_id uuid := (select id from wordloom_bank_ids where name = 'teacher_b');
  admin_a_id uuid := (select id from wordloom_bank_ids where name = 'admin_a');
  target_ar_id uuid := (select id from wordloom_bank_ids where name = 'target_ar');
  core_word_sharp_id uuid := (select id from wordloom_bank_ids where name = 'core_word_sharp');
  override_a_id uuid := (select id from wordloom_bank_ids where name = 'override_a');
  override_b_id uuid := (select id from wordloom_bank_ids where name = 'override_b');
  school_word_a_id uuid := (select id from wordloom_bank_ids where name = 'school_word_a');
  school_word_b_id uuid := (select id from wordloom_bank_ids where name = 'school_word_b');
begin
  perform set_config('request.jwt.claim.sub', admin_a_id::text, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_a_id::text, 'role', 'service_role')::text,
    true
  );

  insert into public.schools (id, slug, name, is_legacy_default)
  values
    (school_a_id, 'wordloom-bank-a-' || substr(replace(school_a_id::text, '-', ''), 1, 8), 'Wordloom Bank A', false),
    (school_b_id, 'wordloom-bank-b-' || substr(replace(school_b_id::text, '-', ''), 1, 8), 'Wordloom Bank B', false);

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
  select
    id,
    'authenticated',
    'authenticated',
    'pgtap-wordloom-bank-' || name || '-' || substr(replace(id::text, '-', ''), 1, 8) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  from wordloom_bank_ids
  where name in ('teacher_a', 'teacher_b', 'admin_a');

  insert into public.school_memberships (school_id, user_id, source)
  values
    (school_a_id, teacher_a_id, 'system'),
    (school_b_id, teacher_b_id, 'system'),
    (school_a_id, admin_a_id, 'system');

  insert into public.staff_profiles (user_id, email, display_name, profile_source, school_id)
  values
    (teacher_a_id, 'wordloom-bank-teacher-a@example.test', 'Wordloom Bank Teacher A', 'self_service', school_a_id),
    (teacher_b_id, 'wordloom-bank-teacher-b@example.test', 'Wordloom Bank Teacher B', 'self_service', school_b_id),
    (admin_a_id, 'wordloom-bank-admin-a@example.test', 'Wordloom Bank Admin A', 'self_service', school_a_id);

  insert into public.staff_role_assignments (user_id, role, active, granted_by, school_id)
  values
    (teacher_a_id, 'teacher', true, admin_a_id, school_a_id),
    (teacher_b_id, 'teacher', true, admin_a_id, school_b_id),
    (admin_a_id, 'admin', true, admin_a_id, school_a_id);

  insert into public.teachers (id, display_name, school_id)
  values
    (teacher_a_id, 'Wordloom Bank Teacher A', school_a_id),
    (teacher_b_id, 'Wordloom Bank Teacher B', school_b_id);

  insert into public.wordloom_core_focus_targets (
    id,
    focus_grapheme,
    display_label,
    challenge_band,
    sort_order
  )
  values (
    target_ar_id,
    'ar',
    'ar',
    'needs_support',
    10
  );

  insert into public.wordloom_core_words (
    id,
    word,
    normalised_word,
    grapheme_segments,
    focus_graphemes,
    primary_focus_grapheme,
    difficulty_score,
    difficulty_label,
    difficulty_reason,
    sentence,
    meaning
  )
  values (
    core_word_sharp_id,
    'sharp',
    'sharp',
    '["sh","ar","p"]'::jsonb,
    '["ar"]'::jsonb,
    'ar',
    35,
    'Core',
    'pgTAP fixture',
    'The pencil has a sharp point.',
    'Having a fine point or edge.'
  );

  insert into public.wordloom_core_word_targets (
    word_id,
    focus_target_id,
    focus_grapheme,
    target_role
  )
  values (
    core_word_sharp_id,
    target_ar_id,
    'ar',
    'primary'
  );

  insert into public.school_spelling_bank_overrides (
    id,
    school_id,
    core_word_id,
    blocked,
    created_by
  )
  values
    (override_a_id, school_a_id, core_word_sharp_id, true, admin_a_id),
    (override_b_id, school_b_id, core_word_sharp_id, true, teacher_b_id);

  insert into public.school_spelling_bank_words (
    id,
    school_id,
    word,
    normalised_word,
    grapheme_segments,
    focus_graphemes,
    primary_focus_grapheme,
    difficulty_score,
    approval_status,
    created_by
  )
  values
    (school_word_a_id, school_a_id, 'yard', 'yard', '["y","ar","d"]'::jsonb, '["ar"]'::jsonb, 'ar', 30, 'pending', admin_a_id),
    (school_word_b_id, school_b_id, 'barn', 'barn', '["b","ar","n"]'::jsonb, '["ar"]'::jsonb, 'ar', 30, 'pending', teacher_b_id);
end $$;

insert into wordloom_bank_checks (name, bool_value)
values
  (
    'core_focus_target_has_no_school_id',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'wordloom_core_focus_targets'
        and column_name = 'school_id'
    )
  ),
  (
    'core_word_has_no_school_id',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'wordloom_core_words'
        and column_name = 'school_id'
    )
  ),
  (
    'core_word_target_link_exists',
    exists (
      select 1
      from public.wordloom_core_word_targets
      where word_id = (select id from wordloom_bank_ids where name = 'core_word_sharp')
        and focus_target_id = (select id from wordloom_bank_ids where name = 'target_ar')
        and focus_grapheme = 'ar'
        and target_role = 'primary'
    )
  ),
  (
    'active_core_word_unique_index_exists',
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'wordloom_core_words'
        and indexname = 'idx_wordloom_core_words_active_normalised_word'
    )
  ),
  (
    'school_override_school_index_exists',
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'school_spelling_bank_overrides'
        and indexname = 'idx_school_spelling_bank_overrides_school'
    )
  ),
  (
    'school_word_status_index_exists',
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'school_spelling_bank_words'
        and indexname = 'idx_school_spelling_bank_words_status'
    )
  ),
  (
    'invalid_core_suitability_blocked',
    not pg_temp.try_insert_core_word(
      'chart',
      'chart',
      '["ch","ar","t"]'::jsonb,
      '["ar"]'::jsonb,
      'standard',
      'approved',
      'The chart shows the pattern.',
      'A diagram or table.'
    )
  ),
  (
    'invalid_core_approval_blocked',
    not pg_temp.try_insert_core_word(
      'market',
      'market',
      '["m","ar","k","e","t"]'::jsonb,
      '["ar"]'::jsonb,
      'suitable',
      'live',
      'The market was busy.',
      'A place where goods are sold.'
    )
  ),
  (
    'core_approved_missing_context_blocked',
    not pg_temp.try_insert_core_word(
      'park',
      'park',
      '["p","ar","k"]'::jsonb,
      '["ar"]'::jsonb,
      'suitable',
      'approved',
      null,
      null
    )
  ),
  (
    'core_difficulty_score_range_blocked',
    not pg_temp.try_insert_core_word(
      'far',
      'far',
      '["f","ar"]'::jsonb,
      '["ar"]'::jsonb,
      'suitable',
      'approved',
      'The farm is far away.',
      'A long distance away.',
      120
    )
  ),
  (
    'invalid_target_role_blocked',
    not pg_temp.try_insert_core_word_target(
      (select id from wordloom_bank_ids where name = 'core_word_sharp'),
      (select id from wordloom_bank_ids where name = 'target_ar'),
      'ar',
      'main'
    )
  ),
  (
    'empty_override_blocked',
    not pg_temp.try_insert_school_override(
      (select id from wordloom_bank_ids where name = 'school_a'),
      null,
      null
    )
  ),
  (
    'null_school_override_blocked',
    not pg_temp.try_insert_school_override(
      null,
      (select id from wordloom_bank_ids where name = 'core_word_sharp'),
      null
    )
  ),
  (
    'null_school_word_blocked',
    not pg_temp.try_insert_school_word(
      null,
      'cart',
      'cart'
    )
  ),
  (
    'invalid_school_word_approval_blocked',
    not pg_temp.try_insert_school_word(
      (select id from wordloom_bank_ids where name = 'school_a'),
      'card',
      'card',
      'live',
      'The card is red.',
      'A small piece of thick paper.'
    )
  ),
  (
    'school_word_approved_missing_context_blocked',
    not pg_temp.try_insert_school_word(
      (select id from wordloom_bank_ids where name = 'school_a'),
      'hard',
      'hard',
      'approved',
      null,
      null
    )
  ),
  (
    'no_usage_event_table_added',
    to_regclass('public.spelling_bank_usage_events') is null
  );

select set_config('request.jwt.claim.sub', (select id::text from wordloom_bank_ids where name = 'teacher_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from wordloom_bank_ids where name = 'teacher_a'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

insert into wordloom_bank_checks (name, int_value)
values
  (
    'teacher_a_core_words_visible_count',
    (select count(*) from public.wordloom_core_words)
  ),
  (
    'teacher_a_overrides_visible_count',
    (select count(*) from public.school_spelling_bank_overrides)
  ),
  (
    'teacher_a_school_words_visible_count',
    (select count(*) from public.school_spelling_bank_words)
  );

insert into wordloom_bank_checks (name, bool_value)
values
  (
    'authenticated_insert_core_blocked',
    not pg_temp.try_insert_core_focus_target('ee')
  ),
  (
    'teacher_a_insert_school_a_override',
    pg_temp.try_insert_school_override(
      (select id from wordloom_bank_ids where name = 'school_a'),
      null,
      (select id from wordloom_bank_ids where name = 'target_ar')
    )
  ),
  (
    'teacher_a_insert_school_b_override_blocked',
    not pg_temp.try_insert_school_override(
      (select id from wordloom_bank_ids where name = 'school_b'),
      null,
      (select id from wordloom_bank_ids where name = 'target_ar')
    )
  ),
  (
    'teacher_a_insert_school_a_word',
    pg_temp.try_insert_school_word(
      (select id from wordloom_bank_ids where name = 'school_a'),
      'start',
      'start'
    )
  ),
  (
    'teacher_a_insert_school_b_word_blocked',
    not pg_temp.try_insert_school_word(
      (select id from wordloom_bank_ids where name = 'school_b'),
      'dark',
      'dark'
    )
  );

reset role;

select set_config('request.jwt.claim.sub', (select id::text from wordloom_bank_ids where name = 'teacher_b'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from wordloom_bank_ids where name = 'teacher_b'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

insert into wordloom_bank_checks (name, int_value)
values (
  'teacher_b_school_a_words_visible_count',
  (
    select count(*)
    from public.school_spelling_bank_words
    where school_id = (select id from wordloom_bank_ids where name = 'school_a')
  )
);

reset role;

update public.wordloom_core_words
set updated_at = '2000-01-01T00:00:00Z'::timestamptz
where id = (select id from wordloom_bank_ids where name = 'core_word_sharp');

insert into wordloom_bank_checks (name, bool_value)
values (
  'updated_at_trigger_refreshed',
  (
    select updated_at > '2020-01-01T00:00:00Z'::timestamptz
    from public.wordloom_core_words
    where id = (select id from wordloom_bank_ids where name = 'core_word_sharp')
  )
);

select has_table('public', 'wordloom_core_focus_targets', 'wordloom_core_focus_targets table exists');
select has_table('public', 'wordloom_core_words', 'wordloom_core_words table exists');
select has_table('public', 'wordloom_core_word_targets', 'wordloom_core_word_targets table exists');
select has_table('public', 'school_spelling_bank_overrides', 'school_spelling_bank_overrides table exists');
select has_table('public', 'school_spelling_bank_words', 'school_spelling_bank_words table exists');
select ok((select bool_value from wordloom_bank_checks where name = 'core_focus_target_has_no_school_id'), 'core focus targets are product-level and have no school_id');
select ok((select bool_value from wordloom_bank_checks where name = 'core_word_has_no_school_id'), 'core words are product-level and have no school_id');
select col_not_null('public', 'school_spelling_bank_overrides', 'school_id', 'school overrides require school_id');
select col_not_null('public', 'school_spelling_bank_words', 'school_id', 'school words require school_id');
select ok((select bool_value from wordloom_bank_checks where name = 'core_word_target_link_exists'), 'core word target links a word to a focus target');
select ok((select bool_value from wordloom_bank_checks where name = 'active_core_word_unique_index_exists'), 'active core words have a normalised word uniqueness index');
select ok((select bool_value from wordloom_bank_checks where name = 'school_override_school_index_exists'), 'school overrides have a school_id index');
select ok((select bool_value from wordloom_bank_checks where name = 'school_word_status_index_exists'), 'school words have a status lookup index');
select ok((select bool_value from wordloom_bank_checks where name = 'invalid_core_suitability_blocked'), 'invalid core suitability status is blocked');
select ok((select bool_value from wordloom_bank_checks where name = 'invalid_core_approval_blocked'), 'invalid core approval status is blocked');
select ok((select bool_value from wordloom_bank_checks where name = 'core_approved_missing_context_blocked'), 'approved active core words require sentence and meaning');
select ok((select bool_value from wordloom_bank_checks where name = 'core_difficulty_score_range_blocked'), 'core difficulty score must be in range');
select ok((select bool_value from wordloom_bank_checks where name = 'invalid_target_role_blocked'), 'invalid target role is blocked');
select ok((select bool_value from wordloom_bank_checks where name = 'empty_override_blocked'), 'school overrides must target a core word or focus target');
select ok((select bool_value from wordloom_bank_checks where name = 'null_school_override_blocked'), 'school overrides cannot be inserted without school_id');
select ok((select bool_value from wordloom_bank_checks where name = 'null_school_word_blocked'), 'school words cannot be inserted without school_id');
select ok((select bool_value from wordloom_bank_checks where name = 'invalid_school_word_approval_blocked'), 'invalid school word approval status is blocked');
select ok((select bool_value from wordloom_bank_checks where name = 'school_word_approved_missing_context_blocked'), 'approved active school words require sentence and meaning');
select ok((select bool_value from wordloom_bank_checks where name = 'no_usage_event_table_added'), 'Phase 1 does not add spelling bank usage events');
select is((select int_value from wordloom_bank_checks where name = 'teacher_a_core_words_visible_count'), 1, 'authenticated staff can read core bank words');
select is((select int_value from wordloom_bank_checks where name = 'teacher_a_overrides_visible_count'), 1, 'School A teacher reads only School A overrides');
select is((select int_value from wordloom_bank_checks where name = 'teacher_a_school_words_visible_count'), 1, 'School A teacher reads only School A school words');
select ok((select bool_value from wordloom_bank_checks where name = 'authenticated_insert_core_blocked'), 'authenticated app users cannot write core focus targets');
select ok((select bool_value from wordloom_bank_checks where name = 'teacher_a_insert_school_a_override'), 'School A teacher can insert School A override');
select ok((select bool_value from wordloom_bank_checks where name = 'teacher_a_insert_school_b_override_blocked'), 'School A teacher cannot insert School B override');
select ok((select bool_value from wordloom_bank_checks where name = 'teacher_a_insert_school_a_word'), 'School A teacher can insert School A school word');
select ok((select bool_value from wordloom_bank_checks where name = 'teacher_a_insert_school_b_word_blocked'), 'School A teacher cannot insert School B school word');
select is((select int_value from wordloom_bank_checks where name = 'teacher_b_school_a_words_visible_count'), 0, 'School B teacher cannot read School A school words');
select ok((select bool_value from wordloom_bank_checks where name = 'updated_at_trigger_refreshed'), 'updated_at refreshes for core bank rows');

select * from finish();

rollback;
