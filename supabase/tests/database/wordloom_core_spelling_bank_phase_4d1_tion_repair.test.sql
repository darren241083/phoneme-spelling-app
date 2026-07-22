begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(22);

create temporary table phase_4d1_expected_words (
  normalised_word text primary key,
  was_proof_reclaim boolean not null
) on commit drop;

insert into phase_4d1_expected_words (normalised_word, was_proof_reclaim)
values
  ('action', true),
  ('station', true),
  ('nation', true),
  ('section', true),
  ('fiction', true),
  ('mention', false),
  ('emotion', false),
  ('relation', false);

create temporary table phase_4d1_words on commit drop as
select *
from public.wordloom_core_words
where source = 'wordloom_core'
  and source_version = 'wordloom_core_v1_phase_4d1_tion_repair_2026_07_21'
  and is_active is true;

create temporary table phase_4d1_primary_links on commit drop as
select
  words.normalised_word,
  word_targets.id as word_target_id,
  word_targets.focus_grapheme,
  word_targets.target_role,
  targets.focus_grapheme as target_focus_grapheme,
  targets.is_active as target_is_active
from phase_4d1_words as words
inner join public.wordloom_core_word_targets as word_targets
  on word_targets.word_id = words.id
 and word_targets.target_role = 'primary'
inner join public.wordloom_core_focus_targets as targets
  on targets.id = word_targets.focus_target_id;

select is((select count(*)::integer from phase_4d1_words), 8, 'Phase 4D1 tion repair has exactly eight active words');

select is(
  (
    select count(*)::integer
    from phase_4d1_expected_words as expected
    inner join phase_4d1_words as words
      on words.normalised_word = expected.normalised_word
  ),
  8,
  'Phase 4D1 tion repair persisted the exact expected word set'
);

select is(
  (
    select count(*)::integer
    from phase_4d1_words as words
    left join phase_4d1_expected_words as expected
      on expected.normalised_word = words.normalised_word
    where expected.normalised_word is null
  ),
  0,
  'Phase 4D1 tion repair has no unexpected source-version rows'
);

select ok(
  not exists (
    select 1
    from phase_4d1_words
    where source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_4d1_tion_repair_2026_07_21'
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or is_active is not true
  ),
  'every Phase 4D1 word is active, approved, suitable, and Wordloom-owned'
);

select ok(
  not exists (
    select 1
    from phase_4d1_words
    where primary_focus_grapheme <> 'tion'
  ),
  'every Phase 4D1 word is primary tion'
);

select ok(
  not exists (
    select 1
    from phase_4d1_words
    where btrim(coalesce(sentence, '')) = ''
      or btrim(coalesce(meaning, '')) = ''
  ),
  'every Phase 4D1 word has sentence and meaning'
);

select ok(
  not exists (
    select 1
    from phase_4d1_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ),
  'Phase 4D1 words do not contain placeholder context'
);

select ok(
  not exists (
    select 1
    from phase_4d1_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ),
  'Phase 4D1 words do not contain explicit spelling-hint context'
);

select ok(
  not exists (
    select 1
    from phase_4d1_words
    where jsonb_typeof(grapheme_segments) <> 'array'
      or jsonb_array_length(grapheme_segments) = 0
      or jsonb_typeof(focus_graphemes) <> 'array'
      or jsonb_array_length(focus_graphemes) = 0
  ),
  'Phase 4D1 words have non-empty grapheme and focus arrays'
);

select ok(
  not exists (
    select 1
    from phase_4d1_words as words
    cross join lateral (
      select string_agg(segment.value, '' order by segment.ordinality) as reconstructed_word
      from jsonb_array_elements_text(words.grapheme_segments) with ordinality as segment(value, ordinality)
    ) as reconstructed
    where reconstructed.reconstructed_word <> words.normalised_word
  ),
  'Phase 4D1 grapheme_segments reconstruct normalised_word'
);

select ok(
  not exists (
    select 1
    from phase_4d1_words
    where not (focus_graphemes ? primary_focus_grapheme)
  ),
  'Phase 4D1 primary_focus_grapheme appears in focus_graphemes'
);

select ok(
  not exists (
    select 1
    from phase_4d1_words
    where not (grapheme_segments ? primary_focus_grapheme)
  ),
  'Phase 4D1 primary_focus_grapheme appears in grapheme_segments'
);

select ok(
  not exists (
    select words.id
    from phase_4d1_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    group by words.id
    having count(word_targets.id) <> 1
  ),
  'every Phase 4D1 word has exactly one primary target link'
);

select is(
  (
    select count(*)::integer
    from phase_4d1_primary_links
    where focus_grapheme = 'tion'
      and target_focus_grapheme = 'tion'
      and target_is_active is true
  ),
  8,
  'Phase 4D1 has exactly eight active matching primary tion links'
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
  'active core words have no duplicate normalised words after Phase 4D1'
);

select ok(
  not exists (
    select 1
    from public.wordloom_core_word_targets as word_targets
    inner join phase_4d1_words as words
      on words.id = word_targets.word_id
    group by word_targets.word_id, word_targets.focus_target_id, word_targets.target_role
    having count(*) > 1
  ),
  'Phase 4D1 does not create duplicate word-target links'
);

select ok(
  not exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join phase_4d1_words as words
      on words.id = overrides.core_word_id
  ),
  'Phase 4D1 does not create school override rows for repaired core words'
);

select ok(
  not exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join phase_4d1_words as words
      on words.normalised_word = school_words.normalised_word
  ),
  'Phase 4D1 does not add rows to school spelling bank additions'
);

select is(
  (
    select count(*)::integer
    from phase_4d1_expected_words as expected
    inner join phase_4d1_words as words
      on words.normalised_word = expected.normalised_word
    where expected.was_proof_reclaim is true
  ),
  5,
  'Phase 4D1 reclaims five expected proof-set words'
);

select is(
  (
    select count(*)::integer
    from public.wordloom_core_words as words
    inner join phase_4d1_expected_words as expected
      on expected.normalised_word = words.normalised_word
     and expected.was_proof_reclaim is true
    where words.source_version = 'wordloom_core_proof_v1'
      and words.is_active is true
  ),
  0,
  'reclaimed Phase 4D1 words are no longer active proof-source rows'
);

select is(
  (
    select count(*)::integer
    from phase_4d1_expected_words as expected
    inner join phase_4d1_words as words
      on words.normalised_word = expected.normalised_word
    where expected.was_proof_reclaim is false
  ),
  3,
  'Phase 4D1 inserts three words that were absent from the proof set'
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
  1753,
  'Wordloom core bank has 1,753 active approved suitable words after Phase 4D1 tion repair'
);

select * from finish();

rollback;
