-- Phase 1 baseline availability:
-- Automatically ensure the standard baseline assignment exists for form classes.
-- This keeps pupil baseline gating class-based, but removes manual setup as the normal onboarding path.

create or replace function public.list_standard_baseline_items(
  requested_standard_key text default 'core_v1'
)
returns table (
  word_position integer,
  word text,
  segments text[],
  question_type text,
  stage text,
  signal text,
  focus_grapheme text,
  preset text
)
language plpgsql
stable
set search_path = public
as $$
declare
  safe_standard_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
begin
  if safe_standard_key = '' then
    safe_standard_key := 'core_v1';
  end if;

  if safe_standard_key <> 'core_v1' then
    raise exception 'Standard baseline definition "%" is not available.', safe_standard_key;
  end if;

  return query
  values
    (1,  'train',  array['t','r','ai','n']::text[],     'segmented_spelling',            'broad_sweep',      'independent', 'ai',   'core'),
    (2,  'seed',   array['s','ee','d']::text[],         'segmented_spelling',            'broad_sweep',      'independent', 'ee',   'core'),
    (3,  'boat',   array['b','oa','t']::text[],         'segmented_spelling',            'broad_sweep',      'independent', 'oa',   'core'),
    (4,  'light',  array['l','igh','t']::text[],        'segmented_spelling',            'broad_sweep',      'independent', 'igh',  'core'),
    (5,  'sharp',  array['sh','ar','p']::text[],        'segmented_spelling',            'broad_sweep',      'independent', 'ar',   'core'),
    (6,  'storm',  array['s','t','or','m']::text[],     'segmented_spelling',            'broad_sweep',      'independent', 'or',   'core'),
    (7,  'turn',   array['t','ur','n']::text[],         'segmented_spelling',            'placement_confirm', 'independent', 'ur',   'core'),
    (8,  'cloud',  array['c','l','ow','d']::text[],     'segmented_spelling',            'placement_confirm', 'independent', 'ow',   'core'),
    (9,  'play',   array['p','l','ay']::text[],         'segmented_spelling',            'placement_confirm', 'independent', 'ay',   'core'),
    (10, 'beach',  array['b','ea','ch']::text[],        'segmented_spelling',            'placement_confirm', 'independent', 'ea',   'core'),
    (11, 'coin',   array['c','oi','n']::text[],         'segmented_spelling',            'placement_confirm', 'independent', 'oi',   'core'),
    (12, 'chair',  array['ch','air']::text[],           'segmented_spelling',            'placement_confirm', 'independent', 'air',  'core'),
    (13, 'paint',  array['p','ai','n','t']::text[],     'multiple_choice_grapheme_picker','diagnostic_check', 'diagnostic',  'ai',   'core'),
    (14, 'point',  array['p','oi','n','t']::text[],     'multiple_choice_grapheme_picker','diagnostic_check', 'diagnostic',  'oi',   'core'),
    (15, 'fair',   array['f','air']::text[],            'focus_sound',                   'diagnostic_check', 'diagnostic',  'air',  'core'),
    (16, 'nurse',  array['n','ur','s','e']::text[],     'focus_sound',                   'diagnostic_check', 'diagnostic',  'ur',   'core');
end;
$$;

create or replace function public.ensure_form_class_baseline_assignment_internal(
  requested_class_id uuid,
  requested_standard_key text default 'core_v1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class public.classes%rowtype;
  safe_standard_key text := lower(regexp_replace(coalesce(requested_standard_key, ''), '[^a-z0-9_-]+', '', 'g'));
  existing_assignment_id uuid;
  created_test_id uuid;
  created_assignment_id uuid;
  baseline_title text;
begin
  if requested_class_id is null then
    return jsonb_build_object(
      'status', 'skipped',
      'created', false,
      'reason', 'missing_class_id'
    );
  end if;

  if safe_standard_key = '' then
    safe_standard_key := 'core_v1';
  end if;

  if safe_standard_key <> 'core_v1' then
    raise exception 'Standard baseline definition "%" is not available.', safe_standard_key;
  end if;

  select *
  into target_class
  from public.classes
  where id = requested_class_id
  limit 1;

  if target_class.id is null then
    raise exception 'Class "%" was not found.', requested_class_id;
  end if;

  if coalesce(nullif(lower(btrim(coalesce(target_class.class_type, ''))), ''), 'form') <> 'form' then
    return jsonb_build_object(
      'status', 'skipped',
      'created', false,
      'reason', 'non_form_class',
      'class_id', target_class.id
    );
  end if;

  if target_class.teacher_id is null then
    raise exception 'Class "%" does not have a teacher owner.', target_class.id;
  end if;

  perform pg_advisory_xact_lock(
    2147481200,
    hashtext(target_class.id::text || ':' || safe_standard_key)
  );

  select candidate.assignment_id
  into existing_assignment_id
  from (
    select
      a.id as assignment_id,
      a.created_at,
      bool_and(
        lower(btrim(coalesce(tw.choice ->> 'source', ''))) = 'baseline_v1'
        or lower(btrim(coalesce(tw.choice ->> 'baseline_v1', ''))) in ('true', '1', 'yes')
      ) as all_baseline_rows,
      bool_or(
        lower(regexp_replace(coalesce(tw.choice ->> 'baseline_standard_key', ''), '[^a-z0-9_-]+', '', 'g')) = safe_standard_key
      ) as has_required_standard
    from public.assignments_v2 as a
    inner join public.tests as t
      on t.id = a.test_id
    inner join public.test_words as tw
      on tw.test_id = t.id
    where a.class_id = target_class.id
    group by a.id, a.created_at
  ) as candidate
  where candidate.all_baseline_rows is true
    and candidate.has_required_standard is true
  order by candidate.created_at desc nulls last, candidate.assignment_id desc
  limit 1;

  if existing_assignment_id is not null then
    return jsonb_build_object(
      'status', 'existing',
      'created', false,
      'class_id', target_class.id,
      'assignment_id', existing_assignment_id,
      'standard_key', safe_standard_key
    );
  end if;

  baseline_title := format(
    'Baseline Test | %s | %s',
    coalesce(nullif(btrim(coalesce(target_class.name, '')), ''), 'Class'),
    to_char(timezone('utc', now()), 'YYYY-MM-DD')
  );

  insert into public.tests (
    teacher_id,
    title,
    status,
    question_type,
    analytics_target_words_enabled,
    analytics_target_words_per_pupil
  )
  values (
    target_class.teacher_id,
    baseline_title,
    'published',
    'segmented_spelling',
    false,
    0
  )
  returning id
  into created_test_id;

  insert into public.test_words (
    test_id,
    position,
    word,
    sentence,
    segments,
    choice
  )
  select
    created_test_id,
    item.word_position,
    item.word,
    null,
    item.segments,
    jsonb_strip_nulls(
      jsonb_build_object(
        'focus_graphemes',
          case
            when nullif(btrim(coalesce(item.focus_grapheme, '')), '') is not null
              then jsonb_build_array(item.focus_grapheme)
            else null
          end,
        'source', 'baseline_v1',
        'question_type', item.question_type,
        'max_attempts', 1,
        'baseline_v1', true,
        'baseline_stage', item.stage,
        'baseline_role', 'placement',
        'baseline_signal', item.signal,
        'baseline_preset', item.preset,
        'baseline_standard_key', safe_standard_key,
        'visual_aids_mode',
          case
            when item.question_type = 'segmented_spelling' then 'none'
            else null
          end
      )
    )
  from public.list_standard_baseline_items(safe_standard_key) as item
  order by item.word_position;

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
    analytics_target_words_per_pupil
  )
  values (
    target_class.teacher_id,
    created_test_id,
    target_class.id,
    'test',
    null,
    true,
    false,
    null,
    false,
    0
  )
  returning id
  into created_assignment_id;

  return jsonb_build_object(
    'status', 'created',
    'created', true,
    'class_id', target_class.id,
    'assignment_id', created_assignment_id,
    'test_id', created_test_id,
    'standard_key', safe_standard_key
  );
end;
$$;

create or replace function public.ensure_form_class_baseline_assignments(
  requested_class_ids uuid[],
  requested_standard_key text default 'core_v1'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  safe_class_ids uuid[] := coalesce(requested_class_ids, array[]::uuid[]);
  requested_class_id uuid;
  helper_result jsonb;
  result_rows jsonb := '[]'::jsonb;
  created_count integer := 0;
  existing_count integer := 0;
  skipped_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Sign in is required before provisioning baseline assignments.';
  end if;

  if not public.is_teacher_compat(actor_user_id) then
    raise exception 'Teacher or admin access is required before provisioning baseline assignments.';
  end if;

  foreach requested_class_id in array safe_class_ids loop
    if requested_class_id is null then
      continue;
    end if;

    if not exists (
      select 1
      from public.classes as c
      where c.id = requested_class_id
        and (
          c.teacher_id = actor_user_id
          or public.is_admin_compat(actor_user_id)
        )
    ) then
      raise exception 'You can only manage baseline assignments for your own classes.';
    end if;

    helper_result := public.ensure_form_class_baseline_assignment_internal(
      requested_class_id,
      requested_standard_key
    );

    case coalesce(helper_result ->> 'status', '')
      when 'created' then
        created_count := created_count + 1;
      when 'existing' then
        existing_count := existing_count + 1;
      else
        skipped_count := skipped_count + 1;
    end case;

    result_rows := result_rows || jsonb_build_array(helper_result);
  end loop;

  return jsonb_build_object(
    'rows', result_rows,
    'requested_count', coalesce(array_length(safe_class_ids, 1), 0),
    'created_count', created_count,
    'existing_count', existing_count,
    'skipped_count', skipped_count
  );
end;
$$;

create or replace function public.trg_ensure_form_class_baseline_on_class_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is null then
    return new;
  end if;

  if coalesce(nullif(lower(btrim(coalesce(new.class_type, ''))), ''), 'form') = 'form' then
    perform public.ensure_form_class_baseline_assignment_internal(new.id, 'core_v1');
  end if;

  return new;
end;
$$;

create or replace function public.trg_ensure_form_class_baseline_on_membership_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.class_id is null or coalesce(new.active, false) is not true then
    return new;
  end if;

  perform public.ensure_form_class_baseline_assignment_internal(new.class_id, 'core_v1');
  return new;
end;
$$;

drop trigger if exists trg_ensure_form_class_baseline_after_insert on public.classes;
create trigger trg_ensure_form_class_baseline_after_insert
  after insert or update of class_type, teacher_id
  on public.classes
  for each row
  execute function public.trg_ensure_form_class_baseline_on_class_write();

drop trigger if exists trg_ensure_form_class_baseline_after_membership_write on public.pupil_classes;
create trigger trg_ensure_form_class_baseline_after_membership_write
  after insert or update of class_id, active
  on public.pupil_classes
  for each row
  execute function public.trg_ensure_form_class_baseline_on_membership_write();

revoke all on function public.list_standard_baseline_items(text) from public;
revoke all on function public.ensure_form_class_baseline_assignment_internal(uuid, text) from public;
revoke all on function public.ensure_form_class_baseline_assignments(uuid[], text) from public;
revoke all on function public.trg_ensure_form_class_baseline_on_class_write() from public;
revoke all on function public.trg_ensure_form_class_baseline_on_membership_write() from public;

grant execute on function public.ensure_form_class_baseline_assignments(uuid[], text) to authenticated, service_role;
