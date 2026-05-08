begin;

create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions;

select plan(22);

create temporary table proof_expected_targets (
  focus_grapheme text primary key,
  expected_primary_word_count integer not null
) on commit drop;

insert into proof_expected_targets (focus_grapheme, expected_primary_word_count)
values
  ('ai', 6),
  ('ee', 6),
  ('oa', 6),
  ('igh', 6),
  ('ar', 12),
  ('or', 6),
  ('air', 6),
  ('ear', 6),
  ('er', 6),
  ('oy', 6),
  ('oi', 6),
  ('ou', 6),
  ('ow', 6),
  ('sh', 6),
  ('ch', 6),
  ('th', 6),
  ('ng', 6),
  ('ck', 6),
  ('dge', 6),
  ('tion', 6),
  ('ur', 6),
  ('ie', 6),
  ('ci', 6),
  ('au', 6);

create temporary table proof_words on commit drop as
select *
from public.wordloom_core_words
where source = 'wordloom_core'
  and source_version = 'wordloom_core_proof_v1'
  and is_active is true
  and approval_status = 'approved';

create temporary table proof_target_role_coverage on commit drop as
select
  word_targets.focus_grapheme,
  word_targets.target_role,
  count(distinct words.id)::integer as word_count
from proof_words as words
inner join public.wordloom_core_word_targets as word_targets
  on word_targets.word_id = words.id
group by word_targets.focus_grapheme, word_targets.target_role;

select is(
  (
    select count(*)::integer
    from proof_expected_targets as expected
    inner join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = expected.focus_grapheme
     and targets.is_active is true
  ),
  24,
  'all proof focus targets exist and are active'
);

select is(
  (select count(*)::integer from proof_words),
  150,
  'proof set has exactly 150 active approved Wordloom core words'
);

select is(
  (
    select coalesce(word_count, 0)
    from proof_target_role_coverage
    where focus_grapheme = 'ar'
      and target_role = 'primary'
  ),
  12,
  'ar has exactly 12 primary-linked proof words'
);

select is(
  (
    select count(*)::integer
    from proof_expected_targets as expected
    left join proof_target_role_coverage as actual
      on actual.focus_grapheme = expected.focus_grapheme
     and actual.target_role = 'primary'
    where expected.focus_grapheme <> 'ar'
      and coalesce(actual.word_count, 0) = expected.expected_primary_word_count
  ),
  23,
  'every non-ar proof target has exactly six primary-linked proof words'
);

select ok(
  not exists (
    select 1
    from proof_words
    where btrim(coalesce(sentence, '')) = ''
      or btrim(coalesce(meaning, '')) = ''
  ),
  'every active approved proof word has sentence and meaning'
);

select ok(
  not exists (
    select 1
    from proof_words
    where jsonb_typeof(grapheme_segments) <> 'array'
      or jsonb_array_length(grapheme_segments) = 0
  ),
  'every active approved proof word has non-empty grapheme_segments'
);

select ok(
  not exists (
    select 1
    from proof_words
    where jsonb_typeof(focus_graphemes) <> 'array'
      or jsonb_array_length(focus_graphemes) = 0
  ),
  'every active approved proof word has non-empty focus_graphemes'
);

select ok(
  not exists (
    select 1
    from proof_words as words
    where not exists (
      select 1
      from public.wordloom_core_word_targets as word_targets
      where word_targets.word_id = words.id
    )
  ),
  'every active approved proof word has at least one word-target link'
);

select ok(
  not exists (
    select 1
    from proof_words
    where not (focus_graphemes ? primary_focus_grapheme)
  ),
  'primary_focus_grapheme appears in focus_graphemes'
);

select ok(
  not exists (
    select 1
    from proof_words
    where not (grapheme_segments ? primary_focus_grapheme)
  ),
  'primary_focus_grapheme appears in grapheme_segments'
);

select ok(
  not exists (
    select 1
    from proof_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where word_targets.focus_grapheme <> targets.focus_grapheme
  ),
  'linked focus_graphemes match existing focus targets'
);

select ok(
  not exists (
    select 1
    from proof_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
    where not (words.grapheme_segments ? word_targets.focus_grapheme)
  ),
  'linked focus_graphemes appear in the word grapheme_segments'
);

select is(
  (
    select count(*)::integer
    from (
      select normalised_word
      from proof_words
      group by normalised_word
      having count(*) > 1
    ) as duplicates
  ),
  0,
  'proof set has no duplicate active normalised words'
);

select ok(
  not exists (
    select 1
    from proof_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
    where word_targets.target_role not in ('primary', 'secondary', 'incidental')
  ),
  'target_role values are valid'
);

select ok(
  (
    select count(*)::integer
    from proof_words
    where primary_focus_grapheme = 'ar'
      and difficulty_score <= 50
  ) >= 6,
  'ar has at least six words at difficulty_score <= 50'
);

select ok(
  (
    select count(*)::integer
    from proof_words
    where primary_focus_grapheme = 'ar'
      and difficulty_score between 55 and 75
  ) >= 3,
  'ar has at least three words between difficulty_score 55 and 75'
);

select is(
  (
    select count(*)::integer
    from proof_target_role_coverage
    where target_role = 'primary'
  ),
  24,
  'grouped coverage query returns one primary row per proof target'
);

select is(
  (
    select count(*)::integer
    from proof_expected_targets as expected
    inner join proof_target_role_coverage as actual
      on actual.focus_grapheme = expected.focus_grapheme
     and actual.target_role = 'primary'
     and actual.word_count = expected.expected_primary_word_count
  ),
  24,
  'grouped coverage query by target and role matches expected counts'
);

select ok(
  not exists (
    select 1
    from proof_words
    where suitability_status <> 'suitable'
      or approval_status <> 'approved'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_proof_v1'
      or is_active is not true
  ),
  'proof words carry the expected source, approval, suitability, and active flags'
);

select ok(
  not exists (
    select 1
    from proof_words as words
    cross join lateral (
      select string_agg(segment.value, '' order by segment.ordinality) as reconstructed_word
      from jsonb_array_elements_text(words.grapheme_segments) with ordinality as segment(value, ordinality)
    ) as reconstructed
    where reconstructed.reconstructed_word <> words.normalised_word
  ),
  'proof word grapheme_segments reconstruct normalised_word'
);

select ok(
  not exists (
    select 1
    from proof_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where word_targets.focus_grapheme <> words.primary_focus_grapheme
  ),
  'primary target links match primary_focus_grapheme'
);

select is(
  (
    select count(*)::integer
    from proof_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
  ),
  150,
  'each proof word has one primary target link'
);

select * from finish();

rollback;
