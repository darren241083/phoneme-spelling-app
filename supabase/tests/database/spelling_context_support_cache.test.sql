begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(38);

create temporary table spelling_context_ids (
  name text primary key,
  id uuid not null
) on commit drop;

create temporary table spelling_context_checks (
  name text primary key,
  bool_value boolean,
  int_value integer
) on commit drop;

grant select on table spelling_context_ids to public;
grant select, insert, update, delete on table spelling_context_checks to public;

insert into spelling_context_ids (name, id)
select name, gen_random_uuid()
from unnest(array[
  'school_a',
  'school_b',
  'teacher_a',
  'teacher_b',
  'admin_a',
  'hoy_a',
  'hod_a',
  'senco_a',
  'literacy_lead_a',
  'context_a',
  'context_b'
]) as names(name);

create or replace function pg_temp.try_insert_word_context(
  p_school_id uuid,
  p_word text,
  p_context_key text,
  p_sentence_status text,
  p_meaning_status text,
  p_source text,
  p_flags jsonb
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  insert into public.word_context_support (
    school_id,
    normalized_word,
    display_word,
    context_key,
    sentence,
    meaning,
    sentence_required,
    meaning_enabled_by_default,
    sentence_status,
    meaning_status,
    source,
    quality_flags,
    created_by,
    updated_by
  )
  values (
    p_school_id,
    lower(btrim(coalesce(p_word, ''))),
    coalesce(p_word, ''),
    coalesce(p_context_key, 'default'),
    'Use the word in this sentence.',
    'A short meaning for the word.',
    false,
    true,
    p_sentence_status,
    p_meaning_status,
    p_source,
    p_flags,
    auth.uid(),
    auth.uid()
  );

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.try_update_word_context(
  p_context_id uuid,
  p_meaning text
) returns boolean
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  update public.word_context_support
  set meaning = p_meaning,
      meaning_status = 'teacher_edited',
      updated_by = auth.uid()
  where id = p_context_id;

  return found;
exception
  when others then
    return false;
end;
$$;

grant execute on function pg_temp.try_insert_word_context(uuid, text, text, text, text, text, jsonb) to public;
grant execute on function pg_temp.try_update_word_context(uuid, text) to public;

do $$
declare
  school_a_id uuid := (select id from spelling_context_ids where name = 'school_a');
  school_b_id uuid := (select id from spelling_context_ids where name = 'school_b');
  teacher_a_id uuid := (select id from spelling_context_ids where name = 'teacher_a');
  teacher_b_id uuid := (select id from spelling_context_ids where name = 'teacher_b');
  admin_a_id uuid := (select id from spelling_context_ids where name = 'admin_a');
  hoy_a_id uuid := (select id from spelling_context_ids where name = 'hoy_a');
  hod_a_id uuid := (select id from spelling_context_ids where name = 'hod_a');
  senco_a_id uuid := (select id from spelling_context_ids where name = 'senco_a');
  literacy_lead_a_id uuid := (select id from spelling_context_ids where name = 'literacy_lead_a');
  context_a_id uuid := (select id from spelling_context_ids where name = 'context_a');
  context_b_id uuid := (select id from spelling_context_ids where name = 'context_b');
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
    (school_a_id, 'spelling-context-a-' || substr(replace(school_a_id::text, '-', ''), 1, 8), 'Spelling Context A', false),
    (school_b_id, 'spelling-context-b-' || substr(replace(school_b_id::text, '-', ''), 1, 8), 'Spelling Context B', false);

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
    'pgtap-spelling-context-' || name || '-' || substr(replace(id::text, '-', ''), 1, 8) || '@example.test',
    '',
    timezone('utc', now()),
    '{}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  from spelling_context_ids
  where name in (
    'teacher_a',
    'teacher_b',
    'admin_a',
    'hoy_a',
    'hod_a',
    'senco_a',
    'literacy_lead_a'
  );

  insert into public.school_memberships (school_id, user_id, source)
  values
    (school_a_id, teacher_a_id, 'system'),
    (school_b_id, teacher_b_id, 'system'),
    (school_a_id, admin_a_id, 'system'),
    (school_a_id, hoy_a_id, 'system'),
    (school_a_id, hod_a_id, 'system'),
    (school_a_id, senco_a_id, 'system'),
    (school_a_id, literacy_lead_a_id, 'system');

  insert into public.staff_profiles (user_id, email, display_name, profile_source, school_id)
  values
    (teacher_a_id, 'spelling-context-teacher-a@example.test', 'Spelling Context Teacher A', 'self_service', school_a_id),
    (teacher_b_id, 'spelling-context-teacher-b@example.test', 'Spelling Context Teacher B', 'self_service', school_b_id),
    (admin_a_id, 'spelling-context-admin-a@example.test', 'Spelling Context Admin A', 'self_service', school_a_id),
    (hoy_a_id, 'spelling-context-hoy-a@example.test', 'Spelling Context HOY A', 'self_service', school_a_id),
    (hod_a_id, 'spelling-context-hod-a@example.test', 'Spelling Context HOD A', 'self_service', school_a_id),
    (senco_a_id, 'spelling-context-senco-a@example.test', 'Spelling Context SENCO A', 'self_service', school_a_id),
    (literacy_lead_a_id, 'spelling-context-literacy-a@example.test', 'Spelling Context Literacy A', 'self_service', school_a_id);

  insert into public.staff_role_assignments (user_id, role, active, granted_by, school_id)
  values
    (teacher_a_id, 'teacher', true, admin_a_id, school_a_id),
    (teacher_b_id, 'teacher', true, admin_a_id, school_b_id),
    (admin_a_id, 'admin', true, admin_a_id, school_a_id),
    (hoy_a_id, 'hoy', true, admin_a_id, school_a_id),
    (hod_a_id, 'hod', true, admin_a_id, school_a_id),
    (senco_a_id, 'senco', true, admin_a_id, school_a_id),
    (literacy_lead_a_id, 'literacy_lead', true, admin_a_id, school_a_id);

  insert into public.teachers (id, display_name, school_id)
  values
    (teacher_a_id, 'Spelling Context Teacher A', school_a_id),
    (teacher_b_id, 'Spelling Context Teacher B', school_b_id);

  insert into public.word_context_support (
    id,
    school_id,
    normalized_word,
    display_word,
    context_key,
    sentence,
    meaning,
    sentence_required,
    meaning_enabled_by_default,
    sentence_status,
    meaning_status,
    source,
    quality_flags,
    created_by,
    updated_by
  )
  values
    (
      context_a_id,
      school_a_id,
      'train',
      'train',
      'default',
      'The train stopped at the station.',
      'A vehicle that travels on railway tracks.',
      false,
      true,
      'auto_approved',
      'auto_approved',
      'ai',
      '{"validated":true}'::jsonb,
      admin_a_id,
      admin_a_id
    ),
    (
      context_b_id,
      school_b_id,
      'train',
      'train',
      'default',
      'The train crossed the bridge.',
      'A vehicle that travels on railway tracks.',
      false,
      true,
      'teacher_entered',
      'teacher_entered',
      'teacher',
      '{}'::jsonb,
      teacher_b_id,
      teacher_b_id
    );
end $$;

insert into spelling_context_checks (name, bool_value)
values
  (
    'school_id_has_no_default',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'word_context_support'
        and column_name = 'school_id'
        and column_default is not null
    )
  ),
  (
    'unique_school_word_context_key_exists',
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.word_context_support'::regclass
        and conname = 'word_context_support_school_word_context_key'
        and contype = 'u'
    )
  ),
  (
    'rls_enabled',
    exists (
      select 1
      from pg_class
      where oid = 'public.word_context_support'::regclass
        and relrowsecurity is true
    )
  ),
  (
    'anon_select_revoked',
    not has_table_privilege('anon', 'public.word_context_support', 'select')
  ),
  (
    'anon_insert_revoked',
    not has_table_privilege('anon', 'public.word_context_support', 'insert')
  ),
  (
    'anon_update_revoked',
    not has_table_privilege('anon', 'public.word_context_support', 'update')
  ),
  (
    'anon_delete_revoked',
    not has_table_privilege('anon', 'public.word_context_support', 'delete')
  ),
  (
    'authenticated_delete_revoked',
    not has_table_privilege('authenticated', 'public.word_context_support', 'delete')
  ),
  (
    'same_word_allowed_across_schools',
    (select count(*)
     from public.word_context_support
     where normalized_word = 'train'
       and context_key = 'default') = 2
  ),
  (
    'duplicate_same_school_blocked',
    not pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_a'),
      'train',
      'default',
      'teacher_entered',
      'teacher_entered',
      'teacher',
      '{}'::jsonb
    )
  ),
  (
    'invalid_sentence_status_blocked',
    not pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_a'),
      'river',
      'default',
      'approved',
      'teacher_entered',
      'teacher',
      '{}'::jsonb
    )
  ),
  (
    'invalid_meaning_status_blocked',
    not pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_a'),
      'forest',
      'default',
      'teacher_entered',
      'approved',
      'teacher',
      '{}'::jsonb
    )
  ),
  (
    'invalid_source_blocked',
    not pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_a'),
      'garden',
      'default',
      'teacher_entered',
      'teacher_entered',
      'external',
      '{}'::jsonb
    )
  ),
  (
    'non_object_quality_flags_blocked',
    not pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_a'),
      'window',
      'default',
      'teacher_entered',
      'teacher_entered',
      'teacher',
      '[]'::jsonb
    )
  ),
  (
    'null_school_blocked',
    not pg_temp.try_insert_word_context(
      null,
      'plain',
      'default',
      'teacher_entered',
      'teacher_entered',
      'teacher',
      '{}'::jsonb
    )
  ),
  (
    'attempts_support_metadata_not_added',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'attempts'
        and column_name = 'support_metadata'
    )
  );

select set_config('request.jwt.claim.sub', (select id::text from spelling_context_ids where name = 'teacher_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from spelling_context_ids where name = 'teacher_a'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

insert into spelling_context_checks (name, int_value)
values (
  'teacher_a_visible_count',
  (select count(*) from public.word_context_support)
);

insert into spelling_context_checks (name, bool_value)
values
  (
    'teacher_a_insert_school_a',
    pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_a'),
      'teacherword',
      'default',
      'teacher_entered',
      'teacher_entered',
      'teacher',
      '{}'::jsonb
    )
  ),
  (
    'teacher_a_insert_school_b_blocked',
    not pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_b'),
      'blockedteacherword',
      'default',
      'teacher_entered',
      'teacher_entered',
      'teacher',
      '{}'::jsonb
    )
  ),
  (
    'teacher_a_update_school_b_blocked',
    not pg_temp.try_update_word_context(
      (select id from spelling_context_ids where name = 'context_b'),
      'Teacher A should not reach School B.'
    )
  ),
  (
    'teacher_a_update_school_a',
    pg_temp.try_update_word_context(
      (select id from spelling_context_ids where name = 'context_a'),
      'Teacher A can update their school cache.'
    )
  );

reset role;

select set_config('request.jwt.claim.sub', (select id::text from spelling_context_ids where name = 'teacher_b'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from spelling_context_ids where name = 'teacher_b'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

insert into spelling_context_checks (name, int_value)
values (
  'teacher_b_school_a_visible_count',
  (select count(*) from public.word_context_support where id = (select id from spelling_context_ids where name = 'context_a'))
);

reset role;

select set_config('request.jwt.claim.sub', (select id::text from spelling_context_ids where name = 'hoy_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from spelling_context_ids where name = 'hoy_a'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

insert into spelling_context_checks (name, int_value)
values (
  'hoy_a_visible_count',
  (select count(*) from public.word_context_support)
);

insert into spelling_context_checks (name, bool_value)
values
  (
    'hoy_a_insert_blocked',
    not pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_a'),
      'hoyword',
      'default',
      'teacher_entered',
      'teacher_entered',
      'teacher',
      '{}'::jsonb
    )
  ),
  (
    'hoy_a_update_blocked',
    not pg_temp.try_update_word_context(
      (select id from spelling_context_ids where name = 'context_a'),
      'HOY should not edit the cache.'
    )
  );

reset role;

select set_config('request.jwt.claim.sub', (select id::text from spelling_context_ids where name = 'hod_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from spelling_context_ids where name = 'hod_a'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

insert into spelling_context_checks (name, int_value)
values (
  'hod_a_visible_count',
  (select count(*) from public.word_context_support)
);

insert into spelling_context_checks (name, bool_value)
values
  (
    'hod_a_insert_blocked',
    not pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_a'),
      'hodword',
      'default',
      'teacher_entered',
      'teacher_entered',
      'teacher',
      '{}'::jsonb
    )
  ),
  (
    'hod_a_update_blocked',
    not pg_temp.try_update_word_context(
      (select id from spelling_context_ids where name = 'context_a'),
      'HOD should not edit the cache.'
    )
  );

reset role;

select set_config('request.jwt.claim.sub', (select id::text from spelling_context_ids where name = 'senco_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from spelling_context_ids where name = 'senco_a'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

insert into spelling_context_checks (name, int_value)
values (
  'senco_a_visible_count',
  (select count(*) from public.word_context_support)
);

insert into spelling_context_checks (name, bool_value)
values
  (
    'senco_a_insert_blocked',
    not pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_a'),
      'sencoword',
      'default',
      'teacher_entered',
      'teacher_entered',
      'teacher',
      '{}'::jsonb
    )
  ),
  (
    'senco_a_update_blocked',
    not pg_temp.try_update_word_context(
      (select id from spelling_context_ids where name = 'context_a'),
      'SENCO should not edit the cache.'
    )
  );

reset role;

select set_config('request.jwt.claim.sub', (select id::text from spelling_context_ids where name = 'literacy_lead_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from spelling_context_ids where name = 'literacy_lead_a'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

insert into spelling_context_checks (name, int_value)
values (
  'literacy_lead_a_visible_count',
  (select count(*) from public.word_context_support)
);

insert into spelling_context_checks (name, bool_value)
values
  (
    'literacy_lead_a_insert_blocked',
    not pg_temp.try_insert_word_context(
      (select id from spelling_context_ids where name = 'school_a'),
      'literacyleadword',
      'default',
      'teacher_entered',
      'teacher_entered',
      'teacher',
      '{}'::jsonb
    )
  ),
  (
    'literacy_lead_a_update_blocked',
    not pg_temp.try_update_word_context(
      (select id from spelling_context_ids where name = 'context_a'),
      'Literacy lead should not edit the cache.'
    )
  );

reset role;

select set_config('request.jwt.claim.sub', (select id::text from spelling_context_ids where name = 'admin_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select id::text from spelling_context_ids where name = 'admin_a'),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

insert into spelling_context_checks (name, bool_value)
values (
  'admin_a_update_school_a',
  pg_temp.try_update_word_context(
    (select id from spelling_context_ids where name = 'context_a'),
    'Admin A can update the school cache.'
  )
);

reset role;

update public.word_context_support
set updated_at = '2000-01-01T00:00:00Z'::timestamptz
where id = (select id from spelling_context_ids where name = 'context_a');

insert into spelling_context_checks (name, bool_value)
values (
  'updated_at_trigger_refreshed',
  (
    select updated_at > '2020-01-01T00:00:00Z'::timestamptz
    from public.word_context_support
    where id = (select id from spelling_context_ids where name = 'context_a')
  )
);

select has_table('public', 'word_context_support', 'word_context_support table exists');
select col_not_null('public', 'word_context_support', 'school_id', 'word_context_support.school_id is required');
select ok((select bool_value from spelling_context_checks where name = 'school_id_has_no_default'), 'word_context_support.school_id has no default/global fallback');
select ok((select bool_value from spelling_context_checks where name = 'unique_school_word_context_key_exists'), 'word_context_support is unique per school, normalized word, and context key');
select ok((select bool_value from spelling_context_checks where name = 'rls_enabled'), 'word_context_support has RLS enabled');
select ok((select bool_value from spelling_context_checks where name = 'anon_select_revoked'), 'anon cannot select word_context_support');
select ok((select bool_value from spelling_context_checks where name = 'anon_insert_revoked'), 'anon cannot insert word_context_support');
select ok((select bool_value from spelling_context_checks where name = 'anon_update_revoked'), 'anon cannot update word_context_support');
select ok((select bool_value from spelling_context_checks where name = 'anon_delete_revoked'), 'anon cannot delete word_context_support');
select ok((select bool_value from spelling_context_checks where name = 'authenticated_delete_revoked'), 'authenticated users cannot delete word_context_support');
select ok((select bool_value from spelling_context_checks where name = 'same_word_allowed_across_schools'), 'same normalized word/context key can exist in separate schools');
select ok((select bool_value from spelling_context_checks where name = 'duplicate_same_school_blocked'), 'duplicate normalized word/context key is blocked inside one school');
select ok((select bool_value from spelling_context_checks where name = 'invalid_sentence_status_blocked'), 'invalid sentence_status is blocked');
select ok((select bool_value from spelling_context_checks where name = 'invalid_meaning_status_blocked'), 'invalid meaning_status is blocked');
select ok((select bool_value from spelling_context_checks where name = 'invalid_source_blocked'), 'invalid context source is blocked');
select ok((select bool_value from spelling_context_checks where name = 'non_object_quality_flags_blocked'), 'quality_flags must be a JSON object');
select ok((select bool_value from spelling_context_checks where name = 'null_school_blocked'), 'word_context_support cannot be inserted without a school_id');
select ok((select bool_value from spelling_context_checks where name = 'attempts_support_metadata_not_added'), 'attempts.support_metadata is not added in this phase');
select is((select int_value from spelling_context_checks where name = 'teacher_a_visible_count'), 1, 'School A teacher reads only School A context rows');
select ok((select bool_value from spelling_context_checks where name = 'teacher_a_insert_school_a'), 'School A teacher can insert School A context rows');
select ok((select bool_value from spelling_context_checks where name = 'teacher_a_insert_school_b_blocked'), 'School A teacher cannot insert School B context rows');
select ok((select bool_value from spelling_context_checks where name = 'teacher_a_update_school_b_blocked'), 'School A teacher cannot update School B context rows');
select ok((select bool_value from spelling_context_checks where name = 'teacher_a_update_school_a'), 'School A teacher can update School A context rows');
select is((select int_value from spelling_context_checks where name = 'teacher_b_school_a_visible_count'), 0, 'School B teacher cannot read School A context rows');
select is((select int_value from spelling_context_checks where name = 'hoy_a_visible_count'), 2, 'HOY can read School A context rows');
select is((select int_value from spelling_context_checks where name = 'hod_a_visible_count'), 2, 'HOD can read School A context rows');
select is((select int_value from spelling_context_checks where name = 'senco_a_visible_count'), 2, 'SENCO can read School A context rows');
select is((select int_value from spelling_context_checks where name = 'literacy_lead_a_visible_count'), 2, 'Literacy lead can read School A context rows');
select ok((select bool_value from spelling_context_checks where name = 'hoy_a_insert_blocked'), 'HOY cannot insert context rows through this cache');
select ok((select bool_value from spelling_context_checks where name = 'hod_a_insert_blocked'), 'HOD cannot insert context rows through this cache');
select ok((select bool_value from spelling_context_checks where name = 'senco_a_insert_blocked'), 'SENCO cannot insert context rows through this cache');
select ok((select bool_value from spelling_context_checks where name = 'literacy_lead_a_insert_blocked'), 'Literacy lead cannot insert context rows through this cache');
select ok((select bool_value from spelling_context_checks where name = 'hoy_a_update_blocked'), 'HOY cannot update context rows through this cache');
select ok((select bool_value from spelling_context_checks where name = 'hod_a_update_blocked'), 'HOD cannot update context rows through this cache');
select ok((select bool_value from spelling_context_checks where name = 'senco_a_update_blocked'), 'SENCO cannot update context rows through this cache');
select ok((select bool_value from spelling_context_checks where name = 'literacy_lead_a_update_blocked'), 'Literacy lead cannot update context rows through this cache');
select ok((select bool_value from spelling_context_checks where name = 'admin_a_update_school_a'), 'School A admin can update School A context rows');
select ok((select bool_value from spelling_context_checks where name = 'updated_at_trigger_refreshed'), 'updated_at refreshes on update');

select * from finish();

rollback;
