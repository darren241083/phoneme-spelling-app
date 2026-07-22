begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(24);

create temporary table phase_4f_expected_words (
  normalised_word text primary key,
  difficulty_score integer not null
) on commit drop;

insert into phase_4f_expected_words (normalised_word, difficulty_score)
values
  ('greenhouse', 52),
  ('needle', 48),
  ('sleepover', 54);

create temporary table phase_4f_words on commit drop as
select *
from public.wordloom_core_words
where source = 'wordloom_core'
  and source_version = 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22'
  and is_active is true;

create temporary table phase_4f_primary_links on commit drop as
select
  words.normalised_word,
  word_targets.id as word_target_id,
  word_targets.focus_grapheme,
  word_targets.target_role,
  word_targets.pattern_type,
  targets.focus_grapheme as target_focus_grapheme,
  targets.is_active as target_is_active
from phase_4f_words as words
inner join public.wordloom_core_word_targets as word_targets
  on word_targets.word_id = words.id
 and word_targets.target_role = 'primary'
inner join public.wordloom_core_focus_targets as targets
  on targets.id = word_targets.focus_target_id;

select is((select count(*)::integer from phase_4f_words), 3, 'Phase 4F ee buffer has exactly three active words');

select is(
  (
    select count(*)::integer
    from phase_4f_expected_words as expected
    inner join phase_4f_words as words
      on words.normalised_word = expected.normalised_word
  ),
  3,
  'Phase 4F ee buffer persisted the exact expected word set'
);

select is(
  (
    select count(*)::integer
    from phase_4f_words as words
    left join phase_4f_expected_words as expected
      on expected.normalised_word = words.normalised_word
    where expected.normalised_word is null
  ),
  0,
  'Phase 4F ee buffer has no unexpected source-version rows'
);

select ok(
  not exists (
    select 1
    from phase_4f_words
    where source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_4f_ee_buffer_2026_07_22'
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or is_active is not true
  ),
  'every Phase 4F word is active, approved, suitable, and Wordloom-owned'
);

select ok(
  not exists (
    select 1
    from phase_4f_words
    where primary_focus_grapheme <> 'ee'
  ),
  'every Phase 4F word is primary ee'
);

select ok(
  not exists (
    select 1
    from phase_4f_words as words
    inner join phase_4f_expected_words as expected
      on expected.normalised_word = words.normalised_word
    where words.difficulty_score <> expected.difficulty_score
      or words.difficulty_label <> 'Core'
  ),
  'Phase 4F words retain the expected difficulty scores and Core labels'
);

select ok(
  not exists (
    select 1
    from phase_4f_words
    where btrim(coalesce(sentence, '')) = ''
      or btrim(coalesce(meaning, '')) = ''
  ),
  'every Phase 4F word has sentence and meaning'
);

select ok(
  not exists (
    select 1
    from phase_4f_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ),
  'Phase 4F words do not contain placeholder context'
);

select ok(
  not exists (
    select 1
    from phase_4f_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ),
  'Phase 4F words do not contain explicit spelling-hint context'
);

select ok(
  not exists (
    select 1
    from phase_4f_words
    where jsonb_typeof(grapheme_segments) <> 'array'
      or jsonb_array_length(grapheme_segments) = 0
      or jsonb_typeof(focus_graphemes) <> 'array'
      or jsonb_array_length(focus_graphemes) = 0
  ),
  'Phase 4F words have non-empty grapheme and focus arrays'
);

select ok(
  not exists (
    select 1
    from phase_4f_words as words
    cross join lateral (
      select string_agg(segment.value, '' order by segment.ordinality) as reconstructed_word
      from jsonb_array_elements_text(words.grapheme_segments) with ordinality as segment(value, ordinality)
    ) as reconstructed
    where reconstructed.reconstructed_word <> words.normalised_word
  ),
  'Phase 4F grapheme_segments reconstruct normalised_word'
);

select ok(
  not exists (
    select 1
    from phase_4f_words
    where not (focus_graphemes ? primary_focus_grapheme)
  ),
  'Phase 4F primary_focus_grapheme appears in focus_graphemes'
);

select ok(
  not exists (
    select 1
    from phase_4f_words
    where not (grapheme_segments ? primary_focus_grapheme)
  ),
  'Phase 4F primary_focus_grapheme appears in grapheme_segments'
);

select ok(
  not exists (
    select words.id
    from phase_4f_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    group by words.id
    having count(word_targets.id) <> 1
  ),
  'every Phase 4F word has exactly one primary target link'
);

select is(
  (
    select count(*)::integer
    from phase_4f_primary_links
    where focus_grapheme = 'ee'
      and target_focus_grapheme = 'ee'
      and target_is_active is true
      and pattern_type = 'vowel_digraph'
  ),
  3,
  'Phase 4F has exactly three active matching primary ee links'
);

select is(
  (
    select count(*)::integer
    from phase_4f_primary_links
  ),
  3,
  'Phase 4F has one primary ee link per row'
);

select is(
  (
    select count(*)::integer
    from (
      select normalised_word
      from public.wordloom_core_words
      where is_active is true
      group by normalised_word
      having count(*) > 1
    ) as duplicates
  ),
  0,
  'active core words have no duplicate normalised words after Phase 4F'
);

select ok(
  not exists (
    select 1
    from public.wordloom_core_word_targets as word_targets
    inner join phase_4f_words as words
      on words.id = word_targets.word_id
    group by word_targets.word_id, word_targets.focus_target_id, word_targets.target_role
    having count(*) > 1
  ),
  'Phase 4F does not create duplicate word-target links'
);

select ok(
  not exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join phase_4f_words as words
      on words.id = overrides.core_word_id
  ),
  'Phase 4F does not create school override rows for repaired core words'
);

select ok(
  not exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join phase_4f_words as words
      on words.normalised_word = school_words.normalised_word
  ),
  'Phase 4F does not add rows to school spelling bank additions'
);

select is(
  (
    select count(*)::integer
    from public.wordloom_core_words as proof_words
    inner join phase_4f_expected_words as expected
      on expected.normalised_word = proof_words.normalised_word
    where proof_words.source_version = 'wordloom_core_proof_v1'
      and proof_words.is_active is true
  ),
  0,
  'Phase 4F does not reclaim proof-set words'
);

select is(
  (
    select count(*)::integer
    from public.wordloom_core_words
    where source = 'wordloom_core'
      and source_version = 'wordloom_core_v1_phase_4d1_tion_repair_2026_07_21'
      and is_active is true
  ),
  8,
  'Phase 4F preserves the unrelated Phase 4D1 repair rows'
);

select is(
  (
    select count(*)::integer
    from public.wordloom_core_words
    where source = 'wordloom_core'
      and approval_status = 'approved'
      and suitability_status = 'suitable'
      and is_active is true
  ),
  1756,
  'Wordloom core bank has 1,756 active approved suitable words in the deterministic Phase 4F test fixture'
);

select ok(
  not exists (
    select 1
    from phase_4f_expected_words as expected
    left join phase_4f_words as words
      on words.normalised_word = expected.normalised_word
    where words.normalised_word is null
  ),
  'Phase 4F migration remains idempotent for the expected normalised words'
);

select * from finish();

rollback;
