begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(20);

create temporary table phase_8c_expected_targets (
  focus_grapheme text primary key,
  expected_primary_word_count integer not null
) on commit drop;

insert into phase_8c_expected_targets (focus_grapheme, expected_primary_word_count)
values
  ('air', 16),
  ('aw', 16),
  ('ew', 16),
  ('igh', 16),
  ('tion', 16),
  ('ck', 14),
  ('oa', 14),
  ('ur', 14),
  ('ch', 12),
  ('ng', 12),
  ('ou', 12),
  ('ow', 12),
  ('sh', 12),
  ('ai', 10),
  ('ay', 10),
  ('ee', 10),
  ('or', 10),
  ('th', 10),
  ('ar', 6),
  ('ea', 6),
  ('er', 6);

create temporary table phase_8c_words on commit drop as
select *
from public.wordloom_core_words
where source = 'wordloom_core'
  and source_version = 'wordloom_core_v1_phase_8c_2026_05_14'
  and is_active is true;

create temporary table phase_8c_primary_coverage on commit drop as
select
  word_targets.focus_grapheme,
  count(distinct words.id)::integer as word_count
from phase_8c_words as words
inner join public.wordloom_core_word_targets as word_targets
  on word_targets.word_id = words.id
 and word_targets.target_role = 'primary'
group by word_targets.focus_grapheme;

select is((select count(*)::integer from phase_8c_words), 250, 'Phase 8C has exactly 250 active core words');

select is(
  (
    select count(*)::integer
    from phase_8c_expected_targets as expected
    inner join phase_8c_primary_coverage as actual
      on actual.focus_grapheme = expected.focus_grapheme
     and actual.word_count = expected.expected_primary_word_count
  ),
  21,
  'Phase 8C per-target primary counts match expected coverage'
);

select is(
  (
    select count(*)::integer
    from public.wordloom_core_focus_targets as targets
    inner join phase_8c_expected_targets as expected
      on expected.focus_grapheme = targets.focus_grapheme
    where targets.is_active is true
  ),
  21,
  'Phase 8C targets exist and are active'
);

select ok(
  not exists (
    select 1
    from phase_8c_words as phase_words
    inner join public.wordloom_core_words as prior_words
      on prior_words.normalised_word = phase_words.normalised_word
     and prior_words.source_version in (
       'wordloom_core_proof_v1',
       'wordloom_core_v1_phase_7b_2026_05_13',
       'wordloom_core_v1_phase_7c_2026_05_13',
       'wordloom_core_v1_phase_7d_2026_05_13',
       'wordloom_core_v1_phase_7e_2026_05_13',
       'wordloom_core_v1_phase_7f_2026_05_13',
       'wordloom_core_v1_phase_7g_2026_05_13',
       'wordloom_core_v1_phase_7h_2026_05_13',
       'wordloom_core_v1_phase_8b_2026_05_13'
     )
     and prior_words.is_active is true
  ),
  'Phase 8C rows do not duplicate earlier production words'
);

select ok(
  not exists (
    select 1
    from phase_8c_words
    where btrim(coalesce(sentence, '')) = ''
      or btrim(coalesce(meaning, '')) = ''
  ),
  'every Phase 8C word has sentence and meaning'
);

select ok(
  not exists (
    select 1
    from phase_8c_words
    where approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_8c_2026_05_14'
      or is_active is not true
  ),
  'every Phase 8C word is approved, suitable, active, and Wordloom-owned'
);

select ok(
  not exists (
    select 1
    from phase_8c_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ),
  'Phase 8C words do not contain placeholder context'
);

select ok(
  not exists (
    select 1
    from phase_8c_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ),
  'Phase 8C words do not contain explicit spelling-hint context'
);

select ok(
  not exists (
    select 1
    from phase_8c_words
    where jsonb_typeof(grapheme_segments) <> 'array'
      or jsonb_array_length(grapheme_segments) = 0
      or jsonb_typeof(focus_graphemes) <> 'array'
      or jsonb_array_length(focus_graphemes) = 0
  ),
  'Phase 8C words have non-empty grapheme and focus arrays'
);

select ok(
  not exists (
    select 1
    from phase_8c_words as words
    cross join lateral (
      select string_agg(segment.value, '' order by segment.ordinality) as reconstructed_word
      from jsonb_array_elements_text(words.grapheme_segments) with ordinality as segment(value, ordinality)
    ) as reconstructed
    where reconstructed.reconstructed_word <> words.normalised_word
  ),
  'Phase 8C grapheme_segments reconstruct normalised_word'
);

select ok(
  not exists (
    select 1
    from phase_8c_words
    where not (focus_graphemes ? primary_focus_grapheme)
  ),
  'Phase 8C primary_focus_grapheme appears in focus_graphemes'
);

select ok(
  not exists (
    select 1
    from phase_8c_words
    where not (grapheme_segments ? primary_focus_grapheme)
  ),
  'Phase 8C primary_focus_grapheme appears in grapheme_segments'
);

select ok(
  not exists (
    select words.id
    from phase_8c_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    group by words.id
    having count(word_targets.id) <> 1
  ),
  'every Phase 8C word has exactly one primary target link'
);

select is(
  (
    select count(*)::integer
    from phase_8c_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
  ),
  250,
  'Phase 8C has exactly 250 primary word-target links'
);

select ok(
  not exists (
    select 1
    from phase_8c_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
    where word_targets.target_role not in ('primary', 'secondary', 'incidental')
  ),
  'Phase 8C target_role values are valid'
);

select ok(
  not exists (
    select 1
    from phase_8c_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where targets.is_active is not true
      or word_targets.focus_grapheme <> targets.focus_grapheme
  ),
  'Phase 8C links point to active matching focus targets'
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
  'active core words have no duplicate normalised words after Phase 8C'
);

select ok(
  not exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join phase_8c_words as words
      on words.id = overrides.core_word_id
  ),
  'Phase 8C does not create school override rows for new core words'
);

select ok(
  not exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join phase_8c_words as words
      on words.normalised_word = school_words.normalised_word
  ),
  'Phase 8C does not add rows to school spelling bank additions'
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
  1500,
  'Wordloom core bank has 1,500 active approved suitable words after Phase 8C'
);

select * from finish();

rollback;
