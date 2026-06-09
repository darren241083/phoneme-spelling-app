begin;

create temporary table wordloom_core_phase_7b_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_7b_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_7b_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_7b_word_count
)
values
  ('air', 'air', 'diagnostic', 'secure_expected', 70, 4),
  ('au', 'au', 'ceiling_challenge', 'secure_expected', 240, 4),
  ('ay', 'ay', 'floor_core', 'needs_support', 250, 8),
  ('ea', 'ea', 'floor_core', 'core_developing', 260, 8),
  ('ew', 'ew', 'diagnostic', 'secure_expected', 270, 8),
  ('tch', 'tch', 'diagnostic', 'secure_expected', 300, 8);

create temporary table wordloom_core_phase_7b_words (
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

insert into wordloom_core_phase_7b_words (
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
  ('air', 'air', 'air', array['air']::text[], array['air']::text[], 'diagnostic', 38, 'Core', 'Short common air word.', 'Fresh air came through the open window.', 'The invisible gas around us that we breathe.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('haircut', 'haircut', 'air', array['h','air','c','u','t']::text[], array['air']::text[], 'diagnostic', 50, 'Core', 'Two-syllable air word with a compound structure.', 'He had a haircut after school.', 'A trim or style given to hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('repair', 'repair', 'air', array['r','e','p','air']::text[], array['air']::text[], 'diagnostic', 54, 'Core', 'Two-syllable air word with the target at the end.', 'We helped repair the broken chair.', 'To fix something that is broken.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('stairs', 'stairs', 'air', array['s','t','air','s']::text[], array['air']::text[], 'diagnostic', 44, 'Core', 'Common air word with an initial consonant blend and final consonant.', 'We walked up the stairs slowly.', 'A set of steps inside or outside a building.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('applause', 'applause', 'au', array['a','pp','l','au','s','e']::text[], array['au']::text[], 'ceiling_challenge', 56, 'Core', 'Longer au word with a doubled consonant pattern.', 'The play ended with loud applause.', 'Clapping that shows people enjoyed something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('autumn', 'autumn', 'au', array['au','t','u','m','n']::text[], array['au']::text[], 'ceiling_challenge', 54, 'Core', 'Common two-syllable au word.', 'Leaves often change colour in autumn.', 'The season after summer and before winter.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('cause', 'cause', 'au', array['c','au','s','e']::text[], array['au']::text[], 'ceiling_challenge', 50, 'Core', 'Common au word with final e.', 'The spill was the cause of the mess.', 'The reason something happens.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('pause', 'pause', 'au', array['p','au','s','e']::text[], array['au']::text[], 'ceiling_challenge', 48, 'Core', 'Common au word with final e.', 'Pause the video before you answer.', 'To stop for a short time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('clay', 'clay', 'ay', array['c','l','ay']::text[], array['ay']::text[], 'floor_core', 32, 'Easier', 'Common ay word with an initial consonant blend.', 'The class shaped clay into pots.', 'Soft earth used for making things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('day', 'day', 'ay', array['d','ay']::text[], array['ay']::text[], 'floor_core', 18, 'Easier', 'Short common ay word with the target at the end.', 'The sunny day felt warm.', 'A period of twenty-four hours.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('play', 'play', 'ay', array['p','l','ay']::text[], array['ay']::text[], 'floor_core', 24, 'Easier', 'Common ay word with an initial consonant blend.', 'We can play outside after the lesson.', 'To take part in a game or activity.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('say', 'say', 'ay', array['s','ay']::text[], array['ay']::text[], 'floor_core', 20, 'Easier', 'Short common ay word with the target at the end.', 'Please say your answer clearly.', 'To speak words.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('stay', 'stay', 'ay', array['s','t','ay']::text[], array['ay']::text[], 'floor_core', 28, 'Easier', 'Common ay word with an initial consonant blend.', 'We will stay inside until playtime.', 'To remain in one place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('today', 'today', 'ay', array['t','o','d','ay']::text[], array['ay']::text[], 'diagnostic', 42, 'Core', 'Common two-syllable ay word.', 'Today we planted seeds.', 'This day, not yesterday or tomorrow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('tray', 'tray', 'ay', array['t','r','ay']::text[], array['ay']::text[], 'floor_core', 30, 'Easier', 'Common ay word with an initial consonant blend.', 'The tray held cups and plates.', 'A flat object used for carrying things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('way', 'way', 'ay', array['w','ay']::text[], array['ay']::text[], 'floor_core', 20, 'Easier', 'Short common ay word with the target at the end.', 'This way leads to the library.', 'A route or direction.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('beach', 'beach', 'ea', array['b','ea','ch']::text[], array['ea']::text[], 'floor_core', 34, 'Easier', 'Common ea word with another multiletter grapheme.', 'The beach was quiet in the morning.', 'Land beside the sea, often covered with sand or stones.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('clean', 'clean', 'ea', array['c','l','ea','n']::text[], array['ea']::text[], 'diagnostic', 36, 'Core', 'Common ea word with an initial consonant blend.', 'Please clean the table after lunch.', 'To make something free from dirt.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('dream', 'dream', 'ea', array['d','r','ea','m']::text[], array['ea']::text[], 'diagnostic', 38, 'Core', 'Common ea word with an initial consonant blend.', 'She had a dream about flying.', 'Images or events imagined while sleeping.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('leaf', 'leaf', 'ea', array['l','ea','f']::text[], array['ea']::text[], 'floor_core', 30, 'Easier', 'Common one-syllable ea word.', 'A green leaf fell from the tree.', 'A flat part of a plant that grows from a stem.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('reach', 'reach', 'ea', array['r','ea','ch']::text[], array['ea']::text[], 'diagnostic', 38, 'Core', 'Common ea word with a final ch grapheme.', 'Can you reach the top shelf?', 'To stretch out and get to something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('seat', 'seat', 'ea', array['s','ea','t']::text[], array['ea']::text[], 'floor_core', 28, 'Easier', 'Common one-syllable ea word.', 'Take a seat near the front.', 'A place to sit.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('team', 'team', 'ea', array['t','ea','m']::text[], array['ea']::text[], 'floor_core', 30, 'Easier', 'Common one-syllable ea word.', 'Our team worked well together.', 'A group of people working or playing together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('treat', 'treat', 'ea', array['t','r','ea','t']::text[], array['ea']::text[], 'diagnostic', 40, 'Core', 'Common ea word with an initial consonant blend.', 'The class earned a small treat.', 'Something nice given for enjoyment.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('blew', 'blew', 'ew', array['b','l','ew']::text[], array['ew']::text[], 'diagnostic', 42, 'Core', 'Common ew word with an initial consonant blend.', 'The wind blew leaves across the path.', 'Moved air strongly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('chew', 'chew', 'ew', array['ch','ew']::text[], array['ew']::text[], 'diagnostic', 36, 'Core', 'Short ew word with an initial ch grapheme.', 'Please chew your food slowly.', 'To bite food into smaller pieces.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('drew', 'drew', 'ew', array['d','r','ew']::text[], array['ew']::text[], 'diagnostic', 42, 'Core', 'Common ew word with an initial consonant blend.', 'The pupil drew a map of the park.', 'Made a picture with a pencil or pen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('few', 'few', 'ew', array['f','ew']::text[], array['ew']::text[], 'floor_core', 30, 'Easier', 'Short common ew word.', 'A few pupils stayed to help tidy.', 'A small number.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('flew', 'flew', 'ew', array['f','l','ew']::text[], array['ew']::text[], 'diagnostic', 42, 'Core', 'Common ew word with an initial consonant blend.', 'The kite flew above the field.', 'Moved through the air.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('grew', 'grew', 'ew', array['g','r','ew']::text[], array['ew']::text[], 'diagnostic', 40, 'Core', 'Common ew word with an initial consonant blend.', 'The bean grew taller each week.', 'Became bigger or taller.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('new', 'new', 'ew', array['n','ew']::text[], array['ew']::text[], 'floor_core', 28, 'Easier', 'Short common ew word.', 'I put a new book on the shelf.', 'Not old or used before.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('screw', 'screw', 'ew', array['s','c','r','ew']::text[], array['ew']::text[], 'ceiling_challenge', 58, 'Stretch', 'Ew word with a longer initial consonant cluster.', 'The loose screw fell from the shelf.', 'A small metal fastener turned with a tool.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('catch', 'catch', 'tch', array['c','a','tch']::text[], array['tch']::text[], 'diagnostic', 36, 'Core', 'Common tch word with a short vowel before the target.', 'Catch the ball with both hands.', 'To stop and hold something that is moving.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('ditch', 'ditch', 'tch', array['d','i','tch']::text[], array['tch']::text[], 'diagnostic', 46, 'Core', 'Common tch word with a short vowel before the target.', 'Rain filled the ditch beside the road.', 'A long narrow channel in the ground.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('fetch', 'fetch', 'tch', array['f','e','tch']::text[], array['tch']::text[], 'diagnostic', 48, 'Core', 'Common tch word with a short vowel before the target.', 'Can you fetch the register, please?', 'To go and bring something back.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('hatch', 'hatch', 'tch', array['h','a','tch']::text[], array['tch']::text[], 'diagnostic', 44, 'Core', 'Common tch word with a short vowel before the target.', 'The chick began to hatch in spring.', 'To come out of an egg.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('match', 'match', 'tch', array['m','a','tch']::text[], array['tch']::text[], 'diagnostic', 38, 'Core', 'Common tch word with a short vowel before the target.', 'We won the final match.', 'A game or contest between teams or players.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('patch', 'patch', 'tch', array['p','a','tch']::text[], array['tch']::text[], 'diagnostic', 40, 'Core', 'Common tch word with a short vowel before the target.', 'A patch covered the hole in my bag.', 'A small piece used to cover or fix something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('stitch', 'stitch', 'tch', array['s','t','i','tch']::text[], array['tch']::text[], 'ceiling_challenge', 56, 'Stretch', 'Tch word with an initial consonant cluster.', 'One stitch held the torn cloth together.', 'A loop of thread used when sewing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true),
  ('watch', 'watch', 'tch', array['w','a','tch']::text[], array['tch']::text[], 'diagnostic', 42, 'Core', 'Common tch word with a short vowel before the target.', 'I like to watch the birds outside.', 'To look at something for a while.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7b_2026_05_13', true);

create temporary table wordloom_core_phase_7b_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_7b_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('air', 'air', 'primary', 'r_controlled_vowel', 0),
  ('applause', 'au', 'primary', 'vowel_digraph', 0),
  ('autumn', 'au', 'primary', 'vowel_digraph', 0),
  ('beach', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('blew', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('catch', 'tch', 'primary', 'trigraph', 0),
  ('cause', 'au', 'primary', 'vowel_digraph', 0),
  ('chew', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('clay', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('clean', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('day', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('ditch', 'tch', 'primary', 'trigraph', 0),
  ('dream', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('drew', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('fetch', 'tch', 'primary', 'trigraph', 0),
  ('few', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('flew', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('grew', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('haircut', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hatch', 'tch', 'primary', 'trigraph', 0),
  ('leaf', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('match', 'tch', 'primary', 'trigraph', 0),
  ('new', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('patch', 'tch', 'primary', 'trigraph', 0),
  ('pause', 'au', 'primary', 'vowel_digraph', 0),
  ('play', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('reach', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('repair', 'air', 'primary', 'r_controlled_vowel', 0),
  ('say', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('screw', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('seat', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('stairs', 'air', 'primary', 'r_controlled_vowel', 0),
  ('stay', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('stitch', 'tch', 'primary', 'trigraph', 0),
  ('team', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('today', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('tray', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('treat', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('watch', 'tch', 'primary', 'trigraph', 0),
  ('way', 'ay', 'primary', 'long_vowel_digraph', 0);

do $$
begin
  if (select count(*) from wordloom_core_phase_7b_words) <> 40 then
    raise exception 'Wordloom core Phase 7B batch must contain exactly 40 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_7b_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_7b_word_count
  ) then
    raise exception 'Wordloom core Phase 7B target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_7b_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 7B batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_7b_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> 'wordloom_core_v1_phase_7b_2026_05_13'
  ) then
    raise exception 'Wordloom core Phase 7B batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_7b_2026_05_13'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 7B words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ) then
    raise exception 'Wordloom core Phase 7B words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 7B words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 7B primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 7B word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_word_targets as word_targets
    left join wordloom_core_phase_7b_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 7B word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_7b_words as words
    left join wordloom_core_phase_7b_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 7B word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 7B launch batch target'
from wordloom_core_phase_7b_targets
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
    from wordloom_core_phase_7b_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 7B linked targets must exist and be active.';
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
from wordloom_core_phase_7b_words
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
  'Wordloom core v1 Phase 7B launch batch target link'
from wordloom_core_phase_7b_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_7b_2026_05_13'
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
      and source_version = 'wordloom_core_v1_phase_7b_2026_05_13'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 40 then
    raise exception 'Wordloom core Phase 7B persisted word count must be exactly 40.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_7b_2026_05_13'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_7b_word_count
  ) then
    raise exception 'Wordloom core Phase 7B persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 7B.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_7b_2026_05_13'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 7B persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_7b_2026_05_13'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 7B persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_7b_2026_05_13'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 7B word must have exactly one primary target link.';
  end if;
end $$;

commit;
