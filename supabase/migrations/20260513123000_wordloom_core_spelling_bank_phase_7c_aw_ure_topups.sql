begin;

create temporary table wordloom_core_phase_7c_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_7c_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_7c_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_7c_word_count
)
values
  ('air', 'air', 'diagnostic', 'secure_expected', 70, 4),
  ('au', 'au', 'ceiling_challenge', 'secure_expected', 240, 4),
  ('ay', 'ay', 'floor_core', 'needs_support', 250, 4),
  ('ea', 'ea', 'floor_core', 'core_developing', 260, 4),
  ('ew', 'ew', 'diagnostic', 'secure_expected', 270, 4),
  ('ure', 'ure', 'ceiling_challenge', 'early_stretch', 280, 8),
  ('aw', 'aw', 'diagnostic', 'secure_expected', 290, 8),
  ('tch', 'tch', 'diagnostic', 'secure_expected', 300, 4);

create temporary table wordloom_core_phase_7c_words (
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

insert into wordloom_core_phase_7c_words (
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
  ('fairness', 'fairness', 'air', array['f','air','n','e','ss']::text[], array['air']::text[], 'diagnostic', 58, 'Stretch', 'Two-syllable air word with a suffix.', 'Fairness matters when we share equipment.', 'The quality of treating people equally.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('hairbrush', 'hairbrush', 'air', array['h','air','b','r','u','sh']::text[], array['air']::text[], 'diagnostic', 58, 'Stretch', 'Compound air word with another multiletter grapheme.', 'The hairbrush was in the drawer.', 'A brush used to tidy hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('unfair', 'unfair', 'air', array['u','n','f','air']::text[], array['air']::text[], 'diagnostic', 48, 'Core', 'Two-syllable air word with a prefix.', 'The unfair rule upset the class.', 'Not fair or equal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('upstairs', 'upstairs', 'air', array['u','p','s','t','air','s']::text[], array['air']::text[], 'diagnostic', 56, 'Stretch', 'Two-syllable air word with an initial consonant cluster before the target.', 'My jumper is upstairs.', 'On or to a higher floor.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('astronaut', 'astronaut', 'au', array['a','s','t','r','o','n','au','t']::text[], array['au']::text[], 'ceiling_challenge', 68, 'Stretch', 'Longer au word with several grapheme segments.', 'The astronaut floated inside the spacecraft.', 'A person trained to travel in space.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('haul', 'haul', 'au', array['h','au','l']::text[], array['au']::text[], 'ceiling_challenge', 58, 'Stretch', 'Short au word with a final consonant.', 'We helped haul the bag onto the shelf.', 'To pull or carry something heavy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('saucepan', 'saucepan', 'au', array['s','au','c','e','p','a','n']::text[], array['au']::text[], 'ceiling_challenge', 62, 'Stretch', 'Longer compound au word.', 'The saucepan stood on the hob.', 'A deep pan with a handle used for cooking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('saucer', 'saucer', 'au', array['s','au','c','er']::text[], array['au']::text[], 'ceiling_challenge', 60, 'Stretch', 'Two-syllable au word with a final er segment.', 'The cup sat on a saucer.', 'A small plate placed under a cup.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('away', 'away', 'ay', array['a','w','ay']::text[], array['ay']::text[], 'floor_core', 36, 'Core', 'Common two-syllable ay word.', 'The ball rolled away from the door.', 'To or at another place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('birthday', 'birthday', 'ay', array['b','ir','th','d','ay']::text[], array['ay']::text[], 'diagnostic', 50, 'Core', 'Longer two-syllable ay word with other multiletter graphemes.', 'Her birthday party was on Saturday.', 'The day each year when someone was born.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('may', 'may', 'ay', array['m','ay']::text[], array['ay']::text[], 'floor_core', 20, 'Easier', 'Short common ay word with the target at the end.', 'You may choose a book after lunch.', 'A word that shows something is allowed or possible.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('pay', 'pay', 'ay', array['p','ay']::text[], array['ay']::text[], 'floor_core', 22, 'Easier', 'Short common ay word with the target at the end.', 'We pay for the tickets at the desk.', 'To give money for something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('bead', 'bead', 'ea', array['b','ea','d']::text[], array['ea']::text[], 'floor_core', 30, 'Easier', 'Short common ea word with a final consonant.', 'A red bead rolled under the table.', 'A small object with a hole for string.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('please', 'please', 'ea', array['p','l','ea','s','e']::text[], array['ea']::text[], 'diagnostic', 42, 'Core', 'Common ea word with an initial blend and final e.', 'Please pass the glue.', 'A polite word used when asking for something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('speak', 'speak', 'ea', array['s','p','ea','k']::text[], array['ea']::text[], 'diagnostic', 40, 'Core', 'Common ea word with an initial consonant blend.', 'Please speak clearly to the group.', 'To say words aloud.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('teacher', 'teacher', 'ea', array['t','ea','ch','er']::text[], array['ea']::text[], 'diagnostic', 52, 'Core', 'Two-syllable ea word with other multiletter graphemes.', 'The teacher read a new story.', 'A person who helps pupils learn.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('crew', 'crew', 'ew', array['c','r','ew']::text[], array['ew']::text[], 'diagnostic', 44, 'Core', 'Common ew word with an initial consonant blend.', 'The boat crew worked together.', 'A group of people working as a team.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('news', 'news', 'ew', array['n','ew','s']::text[], array['ew']::text[], 'diagnostic', 38, 'Core', 'Common ew word with a final consonant.', 'The news told us about the weather.', 'New information about things that have happened.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('stew', 'stew', 'ew', array['s','t','ew']::text[], array['ew']::text[], 'diagnostic', 46, 'Core', 'Ew word with an initial consonant blend.', 'The stew warmed us after the walk.', 'A cooked dish made with pieces of food in liquid.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('threw', 'threw', 'ew', array['th','r','ew']::text[], array['ew']::text[], 'diagnostic', 50, 'Core', 'Common ew word with other multiletter graphemes.', 'She threw the beanbag into the hoop.', 'Sent something through the air with your hand.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('cure', 'cure', 'ure', array['c','ure']::text[], array['ure']::text[], 'ceiling_challenge', 60, 'Stretch', 'Short ure word with a single initial consonant.', 'The cure helped the patient get well.', 'A treatment that makes an illness better.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('future', 'future', 'ure', array['f','u','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 66, 'Stretch', 'Two-syllable ure word with several grapheme segments.', 'In the future, I want to learn guitar.', 'The time that has not happened yet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('mixture', 'mixture', 'ure', array['m','i','x','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 74, 'Stretch', 'Longer ure word with a consonant cluster before the target.', 'The mixture turned blue in the cup.', 'Two or more things mixed together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('nature', 'nature', 'ure', array['n','a','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 70, 'Stretch', 'Common two-syllable ure word with the target at the end.', 'We listened to nature during the walk.', 'Plants, animals, and the world around us.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('picture', 'picture', 'ure', array['p','i','c','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 68, 'Stretch', 'Common two-syllable ure word with a consonant before the target.', 'The picture showed a bright garden.', 'An image made by drawing, painting, or taking a photo.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('pure', 'pure', 'ure', array['p','ure']::text[], array['ure']::text[], 'ceiling_challenge', 58, 'Core', 'Short ure word with a single initial consonant.', 'The pure water looked clear.', 'Not mixed with anything else.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('secure', 'secure', 'ure', array['s','e','c','ure']::text[], array['ure']::text[], 'ceiling_challenge', 64, 'Stretch', 'Two-syllable ure word with the target at the end.', 'Keep your lunch box secure in your bag.', 'Safe and firmly held or protected.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('sure', 'sure', 'ure', array['s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 56, 'Core', 'Short common ure word.', 'Are you sure the gate is closed?', 'Certain that something is true.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('crawl', 'crawl', 'aw', array['c','r','aw','l']::text[], array['aw']::text[], 'diagnostic', 52, 'Core', 'Aw word with an initial blend and final consonant.', 'The baby began to crawl across the mat.', 'To move on hands and knees.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('dawn', 'dawn', 'aw', array['d','aw','n']::text[], array['aw']::text[], 'diagnostic', 44, 'Core', 'Common aw word with a final consonant.', 'Birds sang at dawn.', 'The first light at the start of the day.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('draw', 'draw', 'aw', array['d','r','aw']::text[], array['aw']::text[], 'diagnostic', 42, 'Core', 'Common aw word with an initial consonant blend.', 'Draw a small map of the classroom.', 'To make a picture with a pencil, pen, or crayon.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('jigsaw', 'jigsaw', 'aw', array['j','i','g','s','aw']::text[], array['aw']::text[], 'diagnostic', 58, 'Stretch', 'Two-syllable aw word with a compound structure.', 'The jigsaw had one piece missing.', 'A puzzle made of shaped pieces that fit together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('lawn', 'lawn', 'aw', array['l','aw','n']::text[], array['aw']::text[], 'diagnostic', 38, 'Core', 'Common aw word with a final consonant.', 'The lawn was wet after the rain.', 'An area of short grass near a home or building.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('saw', 'saw', 'aw', array['s','aw']::text[], array['aw']::text[], 'diagnostic', 36, 'Core', 'Short common aw word.', 'I saw a rainbow after the rain.', 'Looked at something with your eyes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('straw', 'straw', 'aw', array['s','t','r','aw']::text[], array['aw']::text[], 'diagnostic', 48, 'Core', 'Aw word with a longer initial consonant cluster.', 'A straw lay beside the drink.', 'A thin tube used for drinking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('yawn', 'yawn', 'aw', array['y','aw','n']::text[], array['aw']::text[], 'diagnostic', 40, 'Core', 'Common aw word with a final consonant.', 'A yawn came during the quiet story.', 'A long breath taken when tired or bored.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('batch', 'batch', 'tch', array['b','a','tch']::text[], array['tch']::text[], 'diagnostic', 42, 'Core', 'Common tch word with a short vowel before the target.', 'We baked a batch of biscuits.', 'A group of things made or done together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('itch', 'itch', 'tch', array['i','tch']::text[], array['tch']::text[], 'diagnostic', 36, 'Core', 'Short tch word with a short vowel before the target.', 'The wool hat made my head itch.', 'To feel a tickle that makes you want to scratch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('pitch', 'pitch', 'tch', array['p','i','tch']::text[], array['tch']::text[], 'diagnostic', 44, 'Core', 'Common tch word with a short vowel before the target.', 'The team ran across the pitch.', 'A marked area where a sport is played.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true),
  ('switch', 'switch', 'tch', array['s','w','i','tch']::text[], array['tch']::text[], 'diagnostic', 56, 'Stretch', 'Tch word with an initial consonant cluster.', 'Press the switch to turn on the light.', 'A small control that turns something on or off.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7c_2026_05_13', true);

create temporary table wordloom_core_phase_7c_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_7c_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('astronaut', 'au', 'primary', 'vowel_digraph', 0),
  ('away', 'ay', 'primary', 'vowel_digraph', 0),
  ('batch', 'tch', 'primary', 'trigraph', 0),
  ('bead', 'ea', 'primary', 'vowel_digraph', 0),
  ('birthday', 'ay', 'primary', 'vowel_digraph', 0),
  ('crawl', 'aw', 'primary', 'vowel_digraph', 0),
  ('crew', 'ew', 'primary', 'vowel_digraph', 0),
  ('cure', 'ure', 'primary', 'trigraph', 0),
  ('dawn', 'aw', 'primary', 'vowel_digraph', 0),
  ('draw', 'aw', 'primary', 'vowel_digraph', 0),
  ('fairness', 'air', 'primary', 'r_controlled_vowel', 0),
  ('future', 'ure', 'primary', 'trigraph', 0),
  ('hairbrush', 'air', 'primary', 'r_controlled_vowel', 0),
  ('haul', 'au', 'primary', 'vowel_digraph', 0),
  ('itch', 'tch', 'primary', 'trigraph', 0),
  ('jigsaw', 'aw', 'primary', 'vowel_digraph', 0),
  ('lawn', 'aw', 'primary', 'vowel_digraph', 0),
  ('may', 'ay', 'primary', 'vowel_digraph', 0),
  ('mixture', 'ure', 'primary', 'trigraph', 0),
  ('nature', 'ure', 'primary', 'trigraph', 0),
  ('news', 'ew', 'primary', 'vowel_digraph', 0),
  ('pay', 'ay', 'primary', 'vowel_digraph', 0),
  ('picture', 'ure', 'primary', 'trigraph', 0),
  ('pitch', 'tch', 'primary', 'trigraph', 0),
  ('please', 'ea', 'primary', 'vowel_digraph', 0),
  ('pure', 'ure', 'primary', 'trigraph', 0),
  ('saucepan', 'au', 'primary', 'vowel_digraph', 0),
  ('saucer', 'au', 'primary', 'vowel_digraph', 0),
  ('saw', 'aw', 'primary', 'vowel_digraph', 0),
  ('secure', 'ure', 'primary', 'trigraph', 0),
  ('speak', 'ea', 'primary', 'vowel_digraph', 0),
  ('stew', 'ew', 'primary', 'vowel_digraph', 0),
  ('straw', 'aw', 'primary', 'vowel_digraph', 0),
  ('sure', 'ure', 'primary', 'trigraph', 0),
  ('switch', 'tch', 'primary', 'trigraph', 0),
  ('teacher', 'ea', 'primary', 'vowel_digraph', 0),
  ('threw', 'ew', 'primary', 'vowel_digraph', 0),
  ('unfair', 'air', 'primary', 'r_controlled_vowel', 0),
  ('upstairs', 'air', 'primary', 'r_controlled_vowel', 0),
  ('yawn', 'aw', 'primary', 'vowel_digraph', 0);

do $$
begin
  if (select count(*) from wordloom_core_phase_7c_words) <> 40 then
    raise exception 'Wordloom core Phase 7C batch must contain exactly 40 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7c_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_7c_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_7c_word_count
  ) then
    raise exception 'Wordloom core Phase 7C target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_7c_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 7C batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_7c_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> 'wordloom_core_v1_phase_7c_2026_05_13'
  ) then
    raise exception 'Wordloom core Phase 7C batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7c_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_7c_2026_05_13'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 7C words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7c_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ) then
    raise exception 'Wordloom core Phase 7C words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7c_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ) then
    raise exception 'Wordloom core Phase 7C words contain explicit spelling-hint context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7c_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 7C words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7c_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 7C primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7c_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 7C word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7c_word_targets as word_targets
    left join wordloom_core_phase_7c_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 7C word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_7c_words as words
    left join wordloom_core_phase_7c_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 7C word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 7C aw, ure, and active target top-up batch target'
from wordloom_core_phase_7c_targets
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
    from wordloom_core_phase_7c_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 7C linked targets must exist and be active.';
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
from wordloom_core_phase_7c_words
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
  'Wordloom core v1 Phase 7C aw, ure, and active target top-up batch target link'
from wordloom_core_phase_7c_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_7c_2026_05_13'
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
      and source_version = 'wordloom_core_v1_phase_7c_2026_05_13'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 40 then
    raise exception 'Wordloom core Phase 7C persisted word count must be exactly 40.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7c_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_7c_2026_05_13'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_7c_word_count
  ) then
    raise exception 'Wordloom core Phase 7C persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 7C.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_7c_2026_05_13'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 7C persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_7c_2026_05_13'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 7C persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_7c_2026_05_13'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 7C word must have exactly one primary target link.';
  end if;
  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join wordloom_core_phase_7c_words as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core Phase 7C must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join wordloom_core_phase_7c_words as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core Phase 7C must not add rows to school spelling bank additions.';
  end if;

end $$;

commit;
