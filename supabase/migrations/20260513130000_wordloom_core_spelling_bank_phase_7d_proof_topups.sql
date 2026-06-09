begin;

create temporary table wordloom_core_phase_7d_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_7d_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_7d_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_7d_word_count
)
values
  ('ai', 'ai', 'floor_core', 'needs_support', 10, 6),
  ('ee', 'ee', 'floor_core', 'needs_support', 20, 6),
  ('oa', 'oa', 'floor_core', 'needs_support', 30, 6),
  ('igh', 'igh', 'floor_core', 'core_developing', 40, 6),
  ('or', 'or', 'floor_core', 'core_developing', 60, 6),
  ('sh', 'sh', 'floor_core', 'needs_support', 140, 6),
  ('ch', 'ch', 'floor_core', 'needs_support', 150, 6),
  ('ck', 'ck', 'floor_core', 'needs_support', 180, 6);

create temporary table wordloom_core_phase_7d_words (
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

insert into wordloom_core_phase_7d_words (
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
  ('brain', 'brain', 'ai', array['b','r','ai','n']::text[], array['ai']::text[], 'floor_core', 34, 'Easier', 'Common ai word with an initial consonant blend.', 'Your brain helps you think and learn.', 'The part inside your head that controls thinking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('mail', 'mail', 'ai', array['m','ai','l']::text[], array['ai']::text[], 'floor_core', 22, 'Easier', 'Short common ai word with a final consonant.', 'I put the card in the mail.', 'Letters and parcels that are sent or delivered.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('plain', 'plain', 'ai', array['p','l','ai','n']::text[], array['ai']::text[], 'floor_core', 36, 'Core', 'Common ai word with an initial consonant blend.', 'The plain folder had no pictures.', 'Simple, with no decoration or pattern.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('sail', 'sail', 'ai', array['s','ai','l']::text[], array['ai']::text[], 'floor_core', 22, 'Easier', 'Short common ai word.', 'The boat moved under a white sail.', 'A sheet of cloth that catches wind to move a boat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('tail', 'tail', 'ai', array['t','ai','l']::text[], array['ai']::text[], 'floor_core', 20, 'Easier', 'Short common ai word.', 'The kite had a long tail.', 'The back or end part of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('trail', 'trail', 'ai', array['t','r','ai','l']::text[], array['ai']::text[], 'floor_core', 38, 'Core', 'Common ai word with an initial consonant blend.', 'Follow the trail through the park.', 'A path or track to follow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('bee', 'bee', 'ee', array['b','ee']::text[], array['ee']::text[], 'floor_core', 18, 'Easier', 'Short common ee word.', 'The bee moved from flower to flower.', 'A small flying insect that visits flowers.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('cheek', 'cheek', 'ee', array['ch','ee','k']::text[], array['ee']::text[], 'floor_core', 36, 'Core', 'Common ee word with another multiletter grapheme.', 'A smile lifted her cheek.', 'The soft side of the face below the eye.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('deep', 'deep', 'ee', array['d','ee','p']::text[], array['ee']::text[], 'floor_core', 22, 'Easier', 'Short common ee word with a final consonant.', 'The box was deep enough for all the books.', 'Going far down from the top.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('feet', 'feet', 'ee', array['f','ee','t']::text[], array['ee']::text[], 'floor_core', 24, 'Easier', 'Short common ee word.', 'My feet were warm in thick socks.', 'The parts at the ends of your legs that you stand on.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('keep', 'keep', 'ee', array['k','ee','p']::text[], array['ee']::text[], 'floor_core', 22, 'Easier', 'Short common ee word with a final consonant.', 'Keep your ticket in your pocket.', 'To hold or not lose something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('wheel', 'wheel', 'ee', array['wh','ee','l']::text[], array['ee']::text[], 'floor_core', 34, 'Easier', 'Common ee word with an initial wh segment.', 'One wheel on the trolley squeaked.', 'A round part that turns to help something move.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('coach', 'coach', 'oa', array['c','oa','ch']::text[], array['oa']::text[], 'floor_core', 36, 'Core', 'Common oa word with a final ch segment.', 'The coach helped us practise passing.', 'A person who helps a team or learner improve.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('coast', 'coast', 'oa', array['c','oa','s','t']::text[], array['oa']::text[], 'floor_core', 38, 'Core', 'Common oa word with a final consonant cluster.', 'We walked along the coast after breakfast.', 'Land next to the sea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('foam', 'foam', 'oa', array['f','oa','m']::text[], array['oa']::text[], 'floor_core', 24, 'Easier', 'Short oa word with a final consonant.', 'White foam floated on the water.', 'Light bubbles gathered together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('goal', 'goal', 'oa', array['g','oa','l']::text[], array['oa']::text[], 'floor_core', 26, 'Easier', 'Short common oa word.', 'The team scored a goal before lunch.', 'A point scored in a game or something you try to do.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('goat', 'goat', 'oa', array['g','oa','t']::text[], array['oa']::text[], 'floor_core', 20, 'Easier', 'Short common oa word.', 'The goat stood on the hill.', 'A farm animal with horns and hooves.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('loaf', 'loaf', 'oa', array['l','oa','f']::text[], array['oa']::text[], 'floor_core', 24, 'Easier', 'Short common oa word.', 'Dad cut the loaf into slices.', 'A whole piece of bread before it is sliced.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('flight', 'flight', 'igh', array['f','l','igh','t']::text[], array['igh']::text[], 'floor_core', 42, 'Core', 'Common igh word with an initial consonant blend.', 'Our flight left in the morning.', 'A journey through the air, often in a plane.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('might', 'might', 'igh', array['m','igh','t']::text[], array['igh']::text[], 'floor_core', 32, 'Easier', 'Common igh word with a final consonant.', 'You might need a coat today.', 'Could happen or be true.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('sigh', 'sigh', 'igh', array['s','igh']::text[], array['igh']::text[], 'floor_core', 26, 'Easier', 'Short igh word.', 'I gave a quiet sigh after the race.', 'A long breath that can show a feeling.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('slight', 'slight', 'igh', array['s','l','igh','t']::text[], array['igh']::text[], 'floor_core', 48, 'Core', 'Igh word with an initial consonant blend.', 'There was a slight mark on the page.', 'Small in amount or degree.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('tight', 'tight', 'igh', array['t','igh','t']::text[], array['igh']::text[], 'floor_core', 30, 'Easier', 'Common igh word with a final consonant.', 'The lid was tight on the jar.', 'Held firmly or fitting closely.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('tonight', 'tonight', 'igh', array['t','o','n','igh','t']::text[], array['igh']::text[], 'floor_core', 52, 'Core', 'Longer igh word with two syllable parts.', 'We will read a story tonight.', 'During this evening or night.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('corn', 'corn', 'or', array['c','or','n']::text[], array['or']::text[], 'floor_core', 24, 'Easier', 'Short common or word.', 'Corn grew in neat rows.', 'A plant that grows yellow grains used as food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('horse', 'horse', 'or', array['h','or','s','e']::text[], array['or']::text[], 'floor_core', 34, 'Easier', 'Common or word with a final silent-e segment.', 'The horse walked across the field.', 'A large animal that people can ride.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('morning', 'morning', 'or', array['m','or','n','i','ng']::text[], array['or']::text[], 'floor_core', 50, 'Core', 'Two-syllable or word with a final ng segment.', 'Morning light came through the curtains.', 'The early part of the day.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('north', 'north', 'or', array['n','or','th']::text[], array['or']::text[], 'floor_core', 38, 'Core', 'Common or word with a final th segment.', 'The map showed north at the top.', 'The direction opposite south.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('porch', 'porch', 'or', array['p','or','ch']::text[], array['or']::text[], 'floor_core', 42, 'Core', 'Common or word with a final ch segment.', 'Leave muddy boots in the porch.', 'A small covered entrance to a building.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('sport', 'sport', 'or', array['s','p','or','t']::text[], array['or']::text[], 'floor_core', 34, 'Easier', 'Common or word with consonant clusters.', 'Sport keeps the class active.', 'A game or activity that uses physical skill.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('dish', 'dish', 'sh', array['d','i','sh']::text[], array['sh']::text[], 'floor_core', 24, 'Easier', 'Short common sh word with final sh.', 'Put the clean dish on the shelf.', 'A plate or bowl used for food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('shadow', 'shadow', 'sh', array['sh','a','d','ow']::text[], array['sh']::text[], 'floor_core', 42, 'Core', 'Two-syllable sh word with another vowel digraph.', 'My shadow stretched across the path.', 'A dark shape made when light is blocked.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('shape', 'shape', 'sh', array['sh','a','p','e']::text[], array['sh']::text[], 'floor_core', 32, 'Easier', 'Common sh word with a final silent-e segment.', 'Draw a shape with four sides.', 'The outline or form of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('shed', 'shed', 'sh', array['sh','e','d']::text[], array['sh']::text[], 'floor_core', 22, 'Easier', 'Short common sh word.', 'The tools were kept in the shed.', 'A small building used for storage.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('shut', 'shut', 'sh', array['sh','u','t']::text[], array['sh']::text[], 'floor_core', 20, 'Easier', 'Short common sh word.', 'Shut the gate after playtime.', 'To close something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('wish', 'wish', 'sh', array['w','i','sh']::text[], array['sh']::text[], 'floor_core', 24, 'Easier', 'Short common sh word with final sh.', 'Make a wish before you blow gently.', 'A hope for something to happen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('chat', 'chat', 'ch', array['ch','a','t']::text[], array['ch']::text[], 'floor_core', 20, 'Easier', 'Short common ch word.', 'We had a quick chat before class.', 'A friendly talk.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('cheese', 'cheese', 'ch', array['ch','ee','s','e']::text[], array['ch']::text[], 'floor_core', 34, 'Easier', 'Common ch word with a vowel digraph.', 'Cheese melted on the warm toast.', 'A food made from milk.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('chick', 'chick', 'ch', array['ch','i','ck']::text[], array['ch']::text[], 'floor_core', 28, 'Easier', 'Common ch word with a final ck segment.', 'The chick pecked at some grain.', 'A young bird, especially a young chicken.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('chin', 'chin', 'ch', array['ch','i','n']::text[], array['ch']::text[], 'floor_core', 22, 'Easier', 'Short common ch word.', 'Rest your chin above the scarf.', 'The part of the face below the mouth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('march', 'march', 'ch', array['m','ar','ch']::text[], array['ch']::text[], 'floor_core', 42, 'Core', 'Common ch word with another vowel pattern.', 'We march in time during music.', 'To walk with steady regular steps.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('speech', 'speech', 'ch', array['s','p','ee','ch']::text[], array['ch']::text[], 'floor_core', 50, 'Core', 'Longer ch word with an initial consonant blend.', 'Maya gave a short speech to the class.', 'A talk given to other people.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('black', 'black', 'ck', array['b','l','a','ck']::text[], array['ck']::text[], 'floor_core', 32, 'Easier', 'Common ck word with an initial consonant blend.', 'The black pen was on the table.', 'The darkest colour.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('brick', 'brick', 'ck', array['b','r','i','ck']::text[], array['ck']::text[], 'floor_core', 34, 'Easier', 'Common ck word with an initial consonant blend.', 'A red brick lay beside the wall.', 'A hard block used for building.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('kick', 'kick', 'ck', array['k','i','ck']::text[], array['ck']::text[], 'floor_core', 22, 'Easier', 'Short common ck word.', 'Kick the ball gently to your partner.', 'To hit something with your foot.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('neck', 'neck', 'ck', array['n','e','ck']::text[], array['ck']::text[], 'floor_core', 22, 'Easier', 'Short common ck word.', 'The scarf warmed my neck.', 'The part between the head and shoulders.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('sock', 'sock', 'ck', array['s','o','ck']::text[], array['ck']::text[], 'floor_core', 20, 'Easier', 'Short common ck word.', 'One sock was under the chair.', 'A piece of clothing worn on the foot.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true),
  ('ticket', 'ticket', 'ck', array['t','i','ck','e','t']::text[], array['ck']::text[], 'floor_core', 42, 'Core', 'Two-syllable ck word.', 'Show your ticket at the door.', 'A small paper or digital pass for entry or travel.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7d_2026_05_13', true);

create temporary table wordloom_core_phase_7d_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_7d_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('bee', 'ee', 'primary', 'vowel_digraph', 0),
  ('black', 'ck', 'primary', 'consonant_digraph', 0),
  ('brain', 'ai', 'primary', 'vowel_digraph', 0),
  ('brick', 'ck', 'primary', 'consonant_digraph', 0),
  ('chat', 'ch', 'primary', 'consonant_digraph', 0),
  ('cheek', 'ee', 'primary', 'vowel_digraph', 0),
  ('cheese', 'ch', 'primary', 'consonant_digraph', 0),
  ('chick', 'ch', 'primary', 'consonant_digraph', 0),
  ('chin', 'ch', 'primary', 'consonant_digraph', 0),
  ('coach', 'oa', 'primary', 'vowel_digraph', 0),
  ('coast', 'oa', 'primary', 'vowel_digraph', 0),
  ('corn', 'or', 'primary', 'r_controlled_vowel', 0),
  ('deep', 'ee', 'primary', 'vowel_digraph', 0),
  ('dish', 'sh', 'primary', 'consonant_digraph', 0),
  ('feet', 'ee', 'primary', 'vowel_digraph', 0),
  ('flight', 'igh', 'primary', 'trigraph', 0),
  ('foam', 'oa', 'primary', 'vowel_digraph', 0),
  ('goal', 'oa', 'primary', 'vowel_digraph', 0),
  ('goat', 'oa', 'primary', 'vowel_digraph', 0),
  ('horse', 'or', 'primary', 'r_controlled_vowel', 0),
  ('keep', 'ee', 'primary', 'vowel_digraph', 0),
  ('kick', 'ck', 'primary', 'consonant_digraph', 0),
  ('loaf', 'oa', 'primary', 'vowel_digraph', 0),
  ('mail', 'ai', 'primary', 'vowel_digraph', 0),
  ('march', 'ch', 'primary', 'consonant_digraph', 0),
  ('might', 'igh', 'primary', 'trigraph', 0),
  ('morning', 'or', 'primary', 'r_controlled_vowel', 0),
  ('neck', 'ck', 'primary', 'consonant_digraph', 0),
  ('north', 'or', 'primary', 'r_controlled_vowel', 0),
  ('plain', 'ai', 'primary', 'vowel_digraph', 0),
  ('porch', 'or', 'primary', 'r_controlled_vowel', 0),
  ('sail', 'ai', 'primary', 'vowel_digraph', 0),
  ('shadow', 'sh', 'primary', 'consonant_digraph', 0),
  ('shape', 'sh', 'primary', 'consonant_digraph', 0),
  ('shed', 'sh', 'primary', 'consonant_digraph', 0),
  ('shut', 'sh', 'primary', 'consonant_digraph', 0),
  ('sigh', 'igh', 'primary', 'trigraph', 0),
  ('slight', 'igh', 'primary', 'trigraph', 0),
  ('sock', 'ck', 'primary', 'consonant_digraph', 0),
  ('speech', 'ch', 'primary', 'consonant_digraph', 0),
  ('sport', 'or', 'primary', 'r_controlled_vowel', 0),
  ('tail', 'ai', 'primary', 'vowel_digraph', 0),
  ('ticket', 'ck', 'primary', 'consonant_digraph', 0),
  ('tight', 'igh', 'primary', 'trigraph', 0),
  ('tonight', 'igh', 'primary', 'trigraph', 0),
  ('trail', 'ai', 'primary', 'vowel_digraph', 0),
  ('wheel', 'ee', 'primary', 'vowel_digraph', 0),
  ('wish', 'sh', 'primary', 'consonant_digraph', 0);

do $$
begin
  if (select count(*) from wordloom_core_phase_7d_words) <> 48 then
    raise exception 'Wordloom core Phase 7D batch must contain exactly 48 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7d_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_7d_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_7d_word_count
  ) then
    raise exception 'Wordloom core Phase 7D target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_7d_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 7D batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_7d_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> 'wordloom_core_v1_phase_7d_2026_05_13'
  ) then
    raise exception 'Wordloom core Phase 7D batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7d_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_7d_2026_05_13'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 7D words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7d_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ) then
    raise exception 'Wordloom core Phase 7D words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7d_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ) then
    raise exception 'Wordloom core Phase 7D words contain explicit spelling-hint context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7d_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 7D words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7d_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 7D primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7d_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 7D word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7d_word_targets as word_targets
    left join wordloom_core_phase_7d_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 7D word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_7d_words as words
    left join wordloom_core_phase_7d_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 7D word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 7D proof-target top-up batch target'
from wordloom_core_phase_7d_targets
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
    from wordloom_core_phase_7d_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 7D linked targets must exist and be active.';
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
from wordloom_core_phase_7d_words
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
  'Wordloom core v1 Phase 7D proof-target top-up batch target link'
from wordloom_core_phase_7d_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_7d_2026_05_13'
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
      and source_version = 'wordloom_core_v1_phase_7d_2026_05_13'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 48 then
    raise exception 'Wordloom core Phase 7D persisted word count must be exactly 48.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7d_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_7d_2026_05_13'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_7d_word_count
  ) then
    raise exception 'Wordloom core Phase 7D persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 7D.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_7d_2026_05_13'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 7D persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_7d_2026_05_13'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 7D persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_7d_2026_05_13'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 7D word must have exactly one primary target link.';
  end if;
  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join wordloom_core_phase_7d_words as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core Phase 7D must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join wordloom_core_phase_7d_words as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core Phase 7D must not add rows to school spelling bank additions.';
  end if;

end $$;

commit;
