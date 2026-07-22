begin;

create temporary table wordloom_core_phase_4f_ee_buffer_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_4f_ee_buffer_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_4f_ee_buffer_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_4f_ee_buffer_word_count
)
values
  ('ee', 'ee', 'floor_core', 'needs_support', 20, 3);

create temporary table wordloom_core_phase_4f_ee_buffer_words (
  word text primary key,
  normalised_word text not null,
  primary_focus_grapheme text not null,
  grapheme_segments text[] not null,
  focus_graphemes text[] not null,
  stage_band text not null,
  difficulty_score integer not null,
  difficulty_label text not null,
  difficulty_reason text not null,
  sentence text not null,
  meaning text not null,
  approval_status text not null,
  suitability_status text not null,
  source text not null,
  source_version text not null,
  is_active boolean not null
) on commit drop;

insert into wordloom_core_phase_4f_ee_buffer_words (
  word,
  normalised_word,
  primary_focus_grapheme,
  grapheme_segments,
  focus_graphemes,
  stage_band,
  difficulty_score,
  difficulty_label,
  difficulty_reason,
  sentence,
  meaning,
  approval_status,
  suitability_status,
  source,
  source_version,
  is_active
)
values
  ('greenhouse', 'greenhouse', 'ee', array['g','r','ee','n','h','ou','s','e']::text[], array['ee']::text[], 'floor_core', 52, 'Core', 'Core ee word selected for Phase 4F early-stretch buffer repair.', 'The class grew tomatoes in the greenhouse.', 'A glass building used for growing plants.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22', true),
  ('needle', 'needle', 'ee', array['n','ee','d','l','e']::text[], array['ee']::text[], 'floor_core', 48, 'Core', 'Core ee word selected for Phase 4F early-stretch buffer repair.', 'Maya used a blunt needle to pull thread through the cloth.', 'A thin tool used for sewing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22', true),
  ('sleepover', 'sleepover', 'ee', array['s','l','ee','p','o','v','er']::text[], array['ee']::text[], 'floor_core', 54, 'Core', 'Core ee word selected for Phase 4F early-stretch buffer repair.', 'Maya packed a toothbrush for the sleepover.', 'A visit where someone stays overnight.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22', true);

create temporary table wordloom_core_phase_4f_ee_buffer_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_4f_ee_buffer_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('greenhouse', 'ee', 'primary', 'vowel_digraph', 0),
  ('needle', 'ee', 'primary', 'vowel_digraph', 0),
  ('sleepover', 'ee', 'primary', 'vowel_digraph', 0);

do $$
begin
  if (select count(*) from wordloom_core_phase_4f_ee_buffer_words) <> 3 then
    raise exception 'Wordloom core Phase 4F ee buffer batch must contain exactly 3 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_4f_ee_buffer_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_4f_ee_buffer_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_4f_ee_buffer_word_count
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_4f_ee_buffer_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_4f_ee_buffer_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22'
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_4f_ee_buffer_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_4f_ee_buffer_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_4f_ee_buffer_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer words contain explicit spelling-hint context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_4f_ee_buffer_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_4f_ee_buffer_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_4f_ee_buffer_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_4f_ee_buffer_word_targets as word_targets
    left join wordloom_core_phase_4f_ee_buffer_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_4f_ee_buffer_words as words
    left join wordloom_core_phase_4f_ee_buffer_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 4F ee buffer word must have exactly one primary target link.';
  end if;
end $$;

insert into public.wordloom_core_focus_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  is_active,
  notes
)
select
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  true,
  'Wordloom core v1 Phase 4F ee early-stretch buffer target'
from wordloom_core_phase_4f_ee_buffer_targets
on conflict (focus_grapheme) do update
set
  display_label = excluded.display_label,
  stage_band = excluded.stage_band,
  challenge_band = excluded.challenge_band,
  sort_order = excluded.sort_order,
  is_active = true,
  notes = coalesce(public.wordloom_core_focus_targets.notes, excluded.notes);

do $$
begin
  if exists (
    select 1
    from wordloom_core_phase_4f_ee_buffer_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer linked targets must exist and be active.';
  end if;
end $$;

insert into public.wordloom_core_words (
  word,
  normalised_word,
  grapheme_segments,
  focus_graphemes,
  primary_focus_grapheme,
  stage_band,
  difficulty_score,
  difficulty_label,
  difficulty_reason,
  sentence,
  meaning,
  suitability_status,
  approval_status,
  source,
  source_version,
  is_active
)
select
  word,
  normalised_word,
  to_jsonb(grapheme_segments),
  to_jsonb(focus_graphemes),
  primary_focus_grapheme,
  stage_band,
  difficulty_score,
  difficulty_label,
  difficulty_reason,
  sentence,
  meaning,
  suitability_status,
  approval_status,
  source,
  source_version,
  is_active
from wordloom_core_phase_4f_ee_buffer_words
on conflict (normalised_word) where is_active is true do update
set
  word = excluded.word,
  grapheme_segments = excluded.grapheme_segments,
  focus_graphemes = excluded.focus_graphemes,
  primary_focus_grapheme = excluded.primary_focus_grapheme,
  stage_band = excluded.stage_band,
  difficulty_score = excluded.difficulty_score,
  difficulty_label = excluded.difficulty_label,
  difficulty_reason = excluded.difficulty_reason,
  sentence = excluded.sentence,
  meaning = excluded.meaning,
  suitability_status = excluded.suitability_status,
  approval_status = excluded.approval_status,
  source = excluded.source,
  source_version = excluded.source_version,
  is_active = excluded.is_active;

insert into public.wordloom_core_word_targets (
  word_id,
  focus_target_id,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier,
  notes
)
select
  words.id,
  targets.id,
  word_targets.focus_grapheme,
  word_targets.target_role,
  word_targets.pattern_type,
  word_targets.difficulty_modifier,
  'Wordloom core v1 Phase 4F ee early-stretch buffer target link'
from wordloom_core_phase_4f_ee_buffer_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22'
 and words.is_active is true
inner join public.wordloom_core_focus_targets as targets
  on targets.focus_grapheme = word_targets.focus_grapheme
 and targets.is_active is true
on conflict (word_id, focus_target_id, target_role) do update
set
  focus_grapheme = excluded.focus_grapheme,
  pattern_type = excluded.pattern_type,
  difficulty_modifier = excluded.difficulty_modifier,
  notes = excluded.notes;

do $$
begin
  if (
    select count(*)::integer
    from public.wordloom_core_words
    where source = 'wordloom_core'
      and source_version = 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 3 then
    raise exception 'Wordloom core Phase 4F ee buffer persisted word count must be exactly 3.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_4f_ee_buffer_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_4f_ee_buffer_word_count
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 4F ee buffer.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 4F ee buffer word must have exactly one primary target link.';
  end if;
  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join wordloom_core_phase_4f_ee_buffer_words as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join wordloom_core_phase_4f_ee_buffer_words as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core Phase 4F ee buffer must not add rows to school spelling bank additions.';
  end if;

end $$;

commit;
