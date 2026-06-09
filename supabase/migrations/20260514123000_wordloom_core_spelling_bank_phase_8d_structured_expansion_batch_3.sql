begin;

create temporary table wordloom_core_phase_8d_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_8d_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_8d_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_8d_word_count
)
values
  ('ai', 'ai', 'floor_core', 'needs_support', 10, 10),
  ('ee', 'ee', 'floor_core', 'needs_support', 20, 12),
  ('oa', 'oa', 'floor_core', 'needs_support', 30, 12),
  ('igh', 'igh', 'floor_core', 'core_developing', 40, 10),
  ('ar', 'ar', 'floor_core', 'core_developing', 50, 14),
  ('or', 'or', 'floor_core', 'core_developing', 60, 10),
  ('air', 'air', 'diagnostic', 'secure_expected', 70, 10),
  ('ear', 'ear', 'diagnostic', 'secure_expected', 80, 6),
  ('er', 'er', 'diagnostic', 'secure_expected', 90, 14),
  ('oy', 'oy', 'floor_core', 'core_developing', 100, 2),
  ('ou', 'ou', 'floor_core', 'core_developing', 120, 10),
  ('ow', 'ow', 'floor_core', 'core_developing', 130, 10),
  ('sh', 'sh', 'floor_core', 'needs_support', 140, 10),
  ('ch', 'ch', 'floor_core', 'needs_support', 150, 10),
  ('th', 'th', 'floor_core', 'core_developing', 160, 10),
  ('ng', 'ng', 'floor_core', 'core_developing', 170, 10),
  ('ck', 'ck', 'floor_core', 'needs_support', 180, 10),
  ('tion', 'tion', 'ceiling_challenge', 'early_stretch', 200, 10),
  ('ur', 'ur', 'diagnostic', 'secure_expected', 210, 10),
  ('ie', 'ie', 'ceiling_challenge', 'early_stretch', 220, 2),
  ('ci', 'ci', 'ceiling_challenge', 'early_stretch', 230, 2),
  ('au', 'au', 'ceiling_challenge', 'secure_expected', 240, 4),
  ('ay', 'ay', 'floor_core', 'needs_support', 250, 10),
  ('ea', 'ea', 'floor_core', 'core_developing', 260, 14),
  ('ew', 'ew', 'diagnostic', 'secure_expected', 270, 10),
  ('ure', 'ure', 'ceiling_challenge', 'early_stretch', 280, 4),
  ('aw', 'aw', 'diagnostic', 'secure_expected', 290, 10),
  ('tch', 'tch', 'diagnostic', 'secure_expected', 300, 4);

create temporary table wordloom_core_phase_8d_words (
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

insert into wordloom_core_phase_8d_words (
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
  ('afraid', 'afraid', 'ai', array['a','f','r','ai','d']::text[], array['ai']::text[], 'floor_core', 46, 'Core', 'Core ai word selected for Phase 8D structured expansion.', 'The puppy seemed afraid of thunder.', 'Feeling fear or worry.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('complain', 'complain', 'ai', array['c','o','m','p','l','ai','n']::text[], array['ai']::text[], 'floor_core', 50, 'Core', 'Core ai word selected for Phase 8D structured expansion.', 'Please tell me the problem calmly instead of complain.', 'To say that something is wrong or unfair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('frail', 'frail', 'ai', array['f','r','ai','l']::text[], array['ai']::text[], 'floor_core', 44, 'Core', 'Core ai word selected for Phase 8D structured expansion.', 'The frail branch snapped in the wind.', 'Weak or easily broken.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('hailstone', 'hailstone', 'ai', array['h','ai','l','s','t','o','n','e']::text[], array['ai']::text[], 'floor_core', 52, 'Core', 'Core ai word selected for Phase 8D structured expansion.', 'A hailstone bounced off the shed roof.', 'A small ball of ice that falls from clouds.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('mailroom', 'mailroom', 'ai', array['m','ai','l','r','oo','m']::text[], array['ai']::text[], 'floor_core', 50, 'Core', 'Core ai word selected for Phase 8D structured expansion.', 'The parcels waited in the school mailroom.', 'A room where letters and parcels are sorted.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('painful', 'painful', 'ai', array['p','ai','n','f','u','l']::text[], array['ai']::text[], 'floor_core', 48, 'Core', 'Core ai word selected for Phase 8D structured expansion.', 'The tiny splinter was painful.', 'Causing hurt or discomfort.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('praise', 'praise', 'ai', array['p','r','ai','s','e']::text[], array['ai']::text[], 'floor_core', 46, 'Core', 'Core ai word selected for Phase 8D structured expansion.', 'The coach gave praise after the careful effort.', 'Warm approval for good work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('raindrop', 'raindrop', 'ai', array['r','ai','n','d','r','o','p']::text[], array['ai']::text[], 'floor_core', 48, 'Core', 'Core ai word selected for Phase 8D structured expansion.', 'A raindrop slid down the window.', 'A single drop of rain.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('rainfall', 'rainfall', 'ai', array['r','ai','n','f','a','ll']::text[], array['ai']::text[], 'floor_core', 48, 'Core', 'Core ai word selected for Phase 8D structured expansion.', 'The rainfall filled the water butt.', 'The amount of rain that falls.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('sailing', 'sailing', 'ai', array['s','ai','l','i','ng']::text[], array['ai']::text[], 'floor_core', 46, 'Core', 'Core ai word selected for Phase 8D structured expansion.', 'The class watched a boat sailing across the lake.', 'Travelling on water in a boat with sails.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('beech', 'beech', 'ee', array['b','ee','ch']::text[], array['ee']::text[], 'floor_core', 44, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'A beech tree shaded the path.', 'A broad tree with smooth bark and small nuts.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('beehive', 'beehive', 'ee', array['b','ee','h','i','v','e']::text[], array['ee']::text[], 'floor_core', 48, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'The beekeeper checked the beehive carefully.', 'A home where bees live.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('beetle', 'beetle', 'ee', array['b','ee','t','l','e']::text[], array['ee']::text[], 'floor_core', 42, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'A beetle crawled under the leaf.', 'A small insect with hard wing covers.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('deer', 'deer', 'ee', array['d','ee','r']::text[], array['ee']::text[], 'floor_core', 40, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'A deer stepped quietly through the trees.', 'A gentle wild animal with long legs.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('eel', 'eel', 'ee', array['ee','l']::text[], array['ee']::text[], 'floor_core', 38, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'An eel slipped through the water.', 'A long fish shaped like a snake.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('fleece', 'fleece', 'ee', array['f','l','ee','c','e']::text[], array['ee']::text[], 'floor_core', 46, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'The jacket had a warm fleece lining.', 'A soft warm fabric.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('leek', 'leek', 'ee', array['l','ee','k']::text[], array['ee']::text[], 'floor_core', 40, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'Mum chopped a leek for the soup.', 'A long green and white vegetable.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('peek', 'peek', 'ee', array['p','ee','k']::text[], array['ee']::text[], 'floor_core', 40, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'Take a quick peek through the window.', 'A short secret look.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('reef', 'reef', 'ee', array['r','ee','f']::text[], array['ee']::text[], 'floor_core', 42, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'The reef was bright with sea life.', 'A ridge of rock or coral near the sea surface.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('screech', 'screech', 'ee', array['s','c','r','ee','ch']::text[], array['ee']::text[], 'floor_core', 50, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'A screech came from the brakes.', 'A high sharp noise.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('sleepy', 'sleepy', 'ee', array['s','l','ee','p','y']::text[], array['ee']::text[], 'floor_core', 44, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'The sleepy child rubbed her eyes.', 'Ready or wanting to sleep.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('steep', 'steep', 'ee', array['s','t','ee','p']::text[], array['ee']::text[], 'floor_core', 42, 'Core', 'Core ee word selected for Phase 8D structured expansion.', 'The path up the hill was steep.', 'Rising sharply upward.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('bloat', 'bloat', 'oa', array['b','l','oa','t']::text[], array['oa']::text[], 'floor_core', 48, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'Too much air can make the bag bloat.', 'To swell or become too full.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('board', 'board', 'oa', array['b','oa','r','d']::text[], array['oa']::text[], 'floor_core', 42, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'Write the date on the board.', 'A flat piece used for writing, building, or playing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('boarding', 'boarding', 'oa', array['b','oa','r','d','i','ng']::text[], array['oa']::text[], 'floor_core', 50, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'Boarding began after the gate opened.', 'Getting onto a bus, train, or plane.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('cloakroom', 'cloakroom', 'oa', array['c','l','oa','k','r','oo','m']::text[], array['oa']::text[], 'floor_core', 52, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'Coats were hung in the cloakroom.', 'A room where coats and bags are kept.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('coastline', 'coastline', 'oa', array['c','oa','s','t','l','i','n','e']::text[], array['oa']::text[], 'floor_core', 54, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'The map showed every bend in the coastline.', 'The edge of land beside the sea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('croak', 'croak', 'oa', array['c','r','oa','k']::text[], array['oa']::text[], 'floor_core', 46, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'The frog gave a deep croak.', 'A rough low sound made by a frog or voice.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('poach', 'poach', 'oa', array['p','oa','ch']::text[], array['oa']::text[], 'floor_core', 46, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'Dad will poach an egg for breakfast.', 'To cook gently in hot liquid.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('poacher', 'poacher', 'oa', array['p','oa','ch','er']::text[], array['oa']::text[], 'floor_core', 52, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'The ranger stopped a poacher in the story.', 'A person who hunts or takes animals illegally.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('roach', 'roach', 'oa', array['r','oa','ch']::text[], array['oa']::text[], 'floor_core', 44, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'A roach hid beneath the stone.', 'A small brown insect.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('roadside', 'roadside', 'oa', array['r','oa','d','s','i','d','e']::text[], array['oa']::text[], 'floor_core', 50, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'Wildflowers grew along the roadside.', 'The area next to a road.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('shoal', 'shoal', 'oa', array['sh','oa','l']::text[], array['oa']::text[], 'floor_core', 48, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'A shoal of fish moved together.', 'A large group of fish swimming together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('toadstool', 'toadstool', 'oa', array['t','oa','d','s','t','oo','l']::text[], array['oa']::text[], 'floor_core', 54, 'Core', 'Core oa word selected for Phase 8D structured expansion.', 'A red toadstool grew near the log.', 'A mushroom, especially a wild one.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('alight', 'alight', 'igh', array['a','l','igh','t']::text[], array['igh']::text[], 'floor_core', 48, 'Core', 'Core igh word selected for Phase 8D structured expansion.', 'The lantern was alight by dusk.', 'Lit or burning with light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('blight', 'blight', 'igh', array['b','l','igh','t']::text[], array['igh']::text[], 'floor_core', 50, 'Core', 'Core igh word selected for Phase 8D structured expansion.', 'The old leaves showed signs of blight.', 'A disease or damage that spoils plants.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('firelight', 'firelight', 'igh', array['f','i','r','e','l','igh','t']::text[], array['igh']::text[], 'floor_core', 54, 'Core', 'Core igh word selected for Phase 8D structured expansion.', 'The room glowed in the firelight.', 'Light from a fire.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('frightful', 'frightful', 'igh', array['f','r','igh','t','f','u','l']::text[], array['igh']::text[], 'floor_core', 56, 'Stretch', 'Stretch igh word selected for Phase 8D structured expansion.', 'The storm made a frightful noise.', 'Very unpleasant or scary.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('insightful', 'insightful', 'igh', array['i','n','s','igh','t','f','u','l']::text[], array['igh']::text[], 'floor_core', 58, 'Stretch', 'Stretch igh word selected for Phase 8D structured expansion.', 'Her insightful answer helped the group.', 'Showing clear and deep understanding.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('limelight', 'limelight', 'igh', array['l','i','m','e','l','igh','t']::text[], array['igh']::text[], 'floor_core', 54, 'Core', 'Core igh word selected for Phase 8D structured expansion.', 'The solo singer stood in the limelight.', 'The centre of attention.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('nightmare', 'nightmare', 'igh', array['n','igh','t','m','a','r','e']::text[], array['igh']::text[], 'floor_core', 54, 'Core', 'Core igh word selected for Phase 8D structured expansion.', 'The dream felt like a nightmare.', 'A frightening dream.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('plight', 'plight', 'igh', array['p','l','igh','t']::text[], array['igh']::text[], 'floor_core', 52, 'Core', 'Core igh word selected for Phase 8D structured expansion.', 'The film showed the plight of the lost hikers.', 'A difficult or worrying situation.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('sightseeing', 'sightseeing', 'igh', array['s','igh','t','s','ee','i','ng']::text[], array['igh']::text[], 'floor_core', 58, 'Stretch', 'Stretch igh word selected for Phase 8D structured expansion.', 'We spent the morning sightseeing in the city.', 'Visiting interesting places.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('tightrope', 'tightrope', 'igh', array['t','igh','t','r','o','p','e']::text[], array['igh']::text[], 'floor_core', 54, 'Core', 'Core igh word selected for Phase 8D structured expansion.', 'The performer balanced on a tightrope.', 'A rope stretched high for balancing on.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('bark', 'bark', 'ar', array['b','ar','k']::text[], array['ar']::text[], 'floor_core', 38, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'The bark on the tree felt rough.', 'The outer covering of a tree trunk.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('charcoal', 'charcoal', 'ar', array['ch','ar','c','oa','l']::text[], array['ar']::text[], 'floor_core', 52, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'Charcoal made dark marks on the paper.', 'A black drawing material or fuel made from wood.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('charm', 'charm', 'ar', array['ch','ar','m']::text[], array['ar']::text[], 'floor_core', 42, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'The old cottage had plenty of charm.', 'A pleasing or attractive quality.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('darken', 'darken', 'ar', array['d','ar','k','e','n']::text[], array['ar']::text[], 'floor_core', 46, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'Clouds began to darken the sky.', 'To make or become darker.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('farmyard', 'farmyard', 'ar', array['f','ar','m','y','ar','d']::text[], array['ar']::text[], 'floor_core', 48, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'The farmyard gate stood open.', 'The yard beside farm buildings.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('garment', 'garment', 'ar', array['g','ar','m','e','n','t']::text[], array['ar']::text[], 'floor_core', 50, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'Each garment was folded on the shelf.', 'A piece of clothing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('harmful', 'harmful', 'ar', array['h','ar','m','f','u','l']::text[], array['ar']::text[], 'floor_core', 50, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'The label warned that the liquid was harmful.', 'Able to cause damage or hurt.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('lark', 'lark', 'ar', array['l','ar','k']::text[], array['ar']::text[], 'floor_core', 38, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'A lark sang above the field.', 'A small songbird.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('marching', 'marching', 'ar', array['m','ar','ch','i','ng']::text[], array['ar']::text[], 'floor_core', 48, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'The band was marching down the street.', 'Walking with steady regular steps.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('partner', 'partner', 'ar', array['p','ar','t','n','er']::text[], array['ar']::text[], 'floor_core', 48, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'Choose a partner for the science task.', 'A person who works or plays with another person.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('scarlet', 'scarlet', 'ar', array['s','c','ar','l','e','t']::text[], array['ar']::text[], 'floor_core', 52, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'The scarf was a bright scarlet colour.', 'A bright red colour.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('sharpen', 'sharpen', 'ar', array['sh','ar','p','e','n']::text[], array['ar']::text[], 'floor_core', 46, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'Please sharpen the pencil before drawing.', 'To make an edge or point sharper.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('starfish', 'starfish', 'ar', array['s','t','ar','f','i','sh']::text[], array['ar']::text[], 'floor_core', 48, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'A starfish rested in the rock pool.', 'A sea animal shaped like a star.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('tart', 'tart', 'ar', array['t','ar','t']::text[], array['ar']::text[], 'floor_core', 40, 'Core', 'Core ar word selected for Phase 8D structured expansion.', 'The apple tart cooled on the tray.', 'A small open pie with a sweet filling.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('afford', 'afford', 'or', array['a','ff','or','d']::text[], array['or']::text[], 'floor_core', 48, 'Core', 'Core or word selected for Phase 8D structured expansion.', 'We can afford one new book today.', 'To have enough money or time for something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('before', 'before', 'or', array['b','e','f','or','e']::text[], array['or']::text[], 'floor_core', 44, 'Core', 'Core or word selected for Phase 8D structured expansion.', 'Wash your hands before lunch.', 'Earlier than a time or event.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('fort', 'fort', 'or', array['f','or','t']::text[], array['or']::text[], 'floor_core', 40, 'Core', 'Core or word selected for Phase 8D structured expansion.', 'The children built a fort from cushions.', 'A strong place built for protection.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('forty', 'forty', 'or', array['f','or','t','y']::text[], array['or']::text[], 'floor_core', 42, 'Core', 'Core or word selected for Phase 8D structured expansion.', 'Forty pupils joined the sports day.', 'The number after thirty-nine.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('porter', 'porter', 'or', array['p','or','t','er']::text[], array['or']::text[], 'floor_core', 48, 'Core', 'Core or word selected for Phase 8D structured expansion.', 'The porter carried the bags to the room.', 'A person whose job is to carry luggage.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('sailor', 'sailor', 'or', array['s','ai','l','or']::text[], array['or']::text[], 'floor_core', 46, 'Core', 'Core or word selected for Phase 8D structured expansion.', 'The sailor tied the rope neatly.', 'A person who works on a boat or ship.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('scorch', 'scorch', 'or', array['s','c','or','ch']::text[], array['or']::text[], 'floor_core', 50, 'Core', 'Core or word selected for Phase 8D structured expansion.', 'The hot pan could scorch the cloth.', 'To burn the surface of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('shorten', 'shorten', 'or', array['sh','or','t','e','n']::text[], array['or']::text[], 'floor_core', 46, 'Core', 'Core or word selected for Phase 8D structured expansion.', 'The tailor will shorten the trousers.', 'To make something shorter.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('tractor', 'tractor', 'or', array['t','r','a','c','t','or']::text[], array['or']::text[], 'floor_core', 50, 'Core', 'Core or word selected for Phase 8D structured expansion.', 'The tractor pulled the trailer across the field.', 'A strong farm vehicle.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('visitor', 'visitor', 'or', array['v','i','s','i','t','or']::text[], array['or']::text[], 'floor_core', 48, 'Core', 'Core or word selected for Phase 8D structured expansion.', 'A visitor signed in at the office.', 'A person who comes to a place for a short time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('airborne', 'airborne', 'air', array['air','b','or','n','e']::text[], array['air']::text[], 'diagnostic', 54, 'Core', 'Core air word selected for Phase 8D structured expansion.', 'The seeds became airborne in the breeze.', 'Carried through the air.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('aircrew', 'aircrew', 'air', array['air','c','r','ew']::text[], array['air']::text[], 'diagnostic', 52, 'Core', 'Core air word selected for Phase 8D structured expansion.', 'The aircrew prepared the plane for takeoff.', 'The people who work on an aircraft.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('airlock', 'airlock', 'air', array['air','l','o','ck']::text[], array['air']::text[], 'diagnostic', 52, 'Core', 'Core air word selected for Phase 8D structured expansion.', 'The airlock kept the two rooms sealed.', 'A small sealed space between two areas.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('airway', 'airway', 'air', array['air','w','ay']::text[], array['air']::text[], 'diagnostic', 50, 'Core', 'Core air word selected for Phase 8D structured expansion.', 'The doctor checked that the airway was clear.', 'A passage for air to move through.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('chairback', 'chairback', 'air', array['ch','air','b','a','ck']::text[], array['air']::text[], 'diagnostic', 52, 'Core', 'Core air word selected for Phase 8D structured expansion.', 'The coat hung over the chairback.', 'The back part of a chair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('deckchair', 'deckchair', 'air', array['d','e','ck','ch','air']::text[], array['air']::text[], 'diagnostic', 54, 'Core', 'Core air word selected for Phase 8D structured expansion.', 'Grandad unfolded a deckchair in the garden.', 'A folding chair used outside.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('hairpiece', 'hairpiece', 'air', array['h','air','p','ie','c','e']::text[], array['air']::text[], 'diagnostic', 56, 'Stretch', 'Stretch air word selected for Phase 8D structured expansion.', 'The costume box held a curly hairpiece.', 'A piece of false hair worn on the head.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('hairy', 'hairy', 'air', array['h','air','y']::text[], array['air']::text[], 'diagnostic', 44, 'Core', 'Core air word selected for Phase 8D structured expansion.', 'The hairy caterpillar moved along the twig.', 'Covered with hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('stairwell', 'stairwell', 'air', array['s','t','air','w','e','ll']::text[], array['air']::text[], 'diagnostic', 52, 'Core', 'Core air word selected for Phase 8D structured expansion.', 'The stairwell echoed after the bell.', 'The space where stairs run through a building.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('unpaired', 'unpaired', 'air', array['u','n','p','air','e','d']::text[], array['air']::text[], 'diagnostic', 54, 'Core', 'Core air word selected for Phase 8D structured expansion.', 'One sock was left unpaired after washing.', 'Not matched with a partner.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('earnest', 'earnest', 'ear', array['ear','n','e','s','t']::text[], array['ear']::text[], 'diagnostic', 48, 'Core', 'Core ear word selected for Phase 8D structured expansion.', 'His earnest promise sounded sincere.', 'Serious and honest.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('earthworm', 'earthworm', 'ear', array['ear','th','w','or','m']::text[], array['ear']::text[], 'diagnostic', 50, 'Core', 'Core ear word selected for Phase 8D structured expansion.', 'An earthworm wriggled through the soil.', 'A small worm that lives in soil.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('fearless', 'fearless', 'ear', array['f','ear','l','e','ss']::text[], array['ear']::text[], 'diagnostic', 52, 'Core', 'Core ear word selected for Phase 8D structured expansion.', 'The fearless climber reached the top.', 'Brave and not easily scared.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('learned', 'learned', 'ear', array['l','ear','n','e','d']::text[], array['ear']::text[], 'diagnostic', 48, 'Core', 'Core ear word selected for Phase 8D structured expansion.', 'We learned a new song in music.', 'Found out or gained knowledge.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('reappear', 'reappear', 'ear', array['r','e','a','p','p','ear']::text[], array['ear']::text[], 'diagnostic', 54, 'Core', 'Core ear word selected for Phase 8D structured expansion.', 'The moon seemed to reappear from behind the cloud.', 'To appear again.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('searching', 'searching', 'ear', array['s','ear','ch','i','ng']::text[], array['ear']::text[], 'diagnostic', 50, 'Core', 'Core ear word selected for Phase 8D structured expansion.', 'The team kept searching for the missing key.', 'Looking carefully for something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('banner', 'banner', 'er', array['b','a','nn','er']::text[], array['er']::text[], 'diagnostic', 44, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'A bright banner hung above the door.', 'A long sign made from cloth or paper.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('bitter', 'bitter', 'er', array['b','i','tt','er']::text[], array['er']::text[], 'diagnostic', 44, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'The lemon peel tasted bitter.', 'Having a sharp unpleasant taste.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('camper', 'camper', 'er', array['c','a','m','p','er']::text[], array['er']::text[], 'diagnostic', 46, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'Each camper carried a torch.', 'A person staying in a tent or campsite.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('dancer', 'dancer', 'er', array['d','a','n','c','er']::text[], array['er']::text[], 'diagnostic', 46, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'The dancer bowed at the end.', 'A person who dances.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('folder', 'folder', 'er', array['f','o','l','d','er']::text[], array['er']::text[], 'diagnostic', 46, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'Put the sheet inside the folder.', 'A cover used to hold papers.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('hamster', 'hamster', 'er', array['h','a','m','s','t','er']::text[], array['er']::text[], 'diagnostic', 48, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'The hamster ran on its wheel.', 'A small furry pet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('hunter', 'hunter', 'er', array['h','u','n','t','er']::text[], array['er']::text[], 'diagnostic', 48, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'The hunter in the tale followed old tracks.', 'A person or animal that looks for something to catch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('jumper', 'jumper', 'er', array['j','u','m','p','er']::text[], array['er']::text[], 'diagnostic', 46, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'She wore a warm jumper to school.', 'A knitted top worn for warmth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('shelter', 'shelter', 'er', array['sh','e','l','t','er']::text[], array['er']::text[], 'diagnostic', 50, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'The bus shelter kept us dry.', 'A place that gives cover or protection.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('tiger', 'tiger', 'er', array['t','i','g','er']::text[], array['er']::text[], 'diagnostic', 46, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'The tiger padded through the grass.', 'A large striped wild cat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('toddler', 'toddler', 'er', array['t','o','dd','l','er']::text[], array['er']::text[], 'diagnostic', 48, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'The toddler stacked the blocks.', 'A young child learning to walk.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('waiter', 'waiter', 'er', array['w','ai','t','er']::text[], array['er']::text[], 'diagnostic', 48, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'The waiter brought water to the table.', 'A person who serves food in a cafe or restaurant.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('wander', 'wander', 'er', array['w','a','n','d','er']::text[], array['er']::text[], 'diagnostic', 48, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'We like to wander through the market.', 'To walk around without a fixed plan.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('whisper', 'whisper', 'er', array['w','h','i','s','p','er']::text[], array['er']::text[], 'diagnostic', 50, 'Core', 'Core er word selected for Phase 8D structured expansion.', 'Please whisper while the baby sleeps.', 'To speak very quietly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('corduroy', 'corduroy', 'oy', array['c','or','d','u','r','oy']::text[], array['oy']::text[], 'floor_core', 56, 'Stretch', 'Stretch oy word selected for Phase 8D structured expansion.', 'The corduroy jacket had soft ridges.', 'A strong fabric with raised lines.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('joyride', 'joyride', 'oy', array['j','oy','r','i','d','e']::text[], array['oy']::text[], 'floor_core', 54, 'Core', 'Core oy word selected for Phase 8D structured expansion.', 'The fairground ride felt like a joyride.', 'A ride taken for fun.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('blouse', 'blouse', 'ou', array['b','l','ou','s','e']::text[], array['ou']::text[], 'floor_core', 46, 'Core', 'Core ou word selected for Phase 8D structured expansion.', 'The blouse had tiny blue buttons.', 'A loose shirt, often worn by women or girls.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('countless', 'countless', 'ou', array['c','ou','n','t','l','e','ss']::text[], array['ou']::text[], 'floor_core', 52, 'Core', 'Core ou word selected for Phase 8D structured expansion.', 'Countless stars filled the clear sky.', 'Too many to count.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('doubtful', 'doubtful', 'ou', array['d','ou','b','t','f','u','l']::text[], array['ou']::text[], 'floor_core', 52, 'Core', 'Core ou word selected for Phase 8D structured expansion.', 'The judge looked doubtful about the answer.', 'Not sure that something is true.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('foundry', 'foundry', 'ou', array['f','ou','n','d','r','y']::text[], array['ou']::text[], 'floor_core', 54, 'Core', 'Core ou word selected for Phase 8D structured expansion.', 'The old foundry made metal parts.', 'A place where metal is melted and shaped.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('household', 'household', 'ou', array['h','ou','s','e','h','o','l','d']::text[], array['ou']::text[], 'floor_core', 54, 'Core', 'Core ou word selected for Phase 8D structured expansion.', 'Each household put out a recycling box.', 'All the people living in one home.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('loudly', 'loudly', 'ou', array['l','ou','d','l','y']::text[], array['ou']::text[], 'floor_core', 44, 'Core', 'Core ou word selected for Phase 8D structured expansion.', 'The bell rang loudly in the hall.', 'In a loud way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('mouthwash', 'mouthwash', 'ou', array['m','ou','th','w','a','sh']::text[], array['ou']::text[], 'floor_core', 52, 'Core', 'Core ou word selected for Phase 8D structured expansion.', 'The dentist gave a small cup of mouthwash.', 'A liquid used to rinse the mouth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('roundabout', 'roundabout', 'ou', array['r','ou','n','d','a','b','ou','t']::text[], array['ou']::text[], 'floor_core', 54, 'Core', 'Core ou word selected for Phase 8D structured expansion.', 'Cars moved slowly around the roundabout.', 'A circular road junction.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('soundtrack', 'soundtrack', 'ou', array['s','ou','n','d','t','r','a','ck']::text[], array['ou']::text[], 'floor_core', 54, 'Core', 'Core ou word selected for Phase 8D structured expansion.', 'The film soundtrack was lively.', 'The music and audio for a film or show.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('southwest', 'southwest', 'ou', array['s','ou','th','w','e','s','t']::text[], array['ou']::text[], 'floor_core', 52, 'Core', 'Core ou word selected for Phase 8D structured expansion.', 'The wind blew from the southwest.', 'The direction between south and west.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('brow', 'brow', 'ow', array['b','r','ow']::text[], array['ow']::text[], 'floor_core', 40, 'Core', 'Core ow word selected for Phase 8D structured expansion.', 'Sweat ran down his brow.', 'The forehead or eyebrow area.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('downward', 'downward', 'ow', array['d','ow','n','w','ar','d']::text[], array['ow']::text[], 'floor_core', 50, 'Core', 'Core ow word selected for Phase 8D structured expansion.', 'The path sloped downward to the stream.', 'Moving or pointing toward a lower place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('flowerbed', 'flowerbed', 'ow', array['f','l','ow','er','b','e','d']::text[], array['ow']::text[], 'floor_core', 52, 'Core', 'Core ow word selected for Phase 8D structured expansion.', 'The flowerbed was full of tulips.', 'A piece of ground where flowers grow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('glowing', 'glowing', 'ow', array['g','l','ow','i','ng']::text[], array['ow']::text[], 'floor_core', 48, 'Core', 'Core ow word selected for Phase 8D structured expansion.', 'The glowing lamp warmed the room.', 'Giving out steady light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('grower', 'grower', 'ow', array['g','r','ow','er']::text[], array['ow']::text[], 'floor_core', 48, 'Core', 'Core ow word selected for Phase 8D structured expansion.', 'The grower sold tomatoes at the stall.', 'A person who grows plants or crops.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('lowland', 'lowland', 'ow', array['l','ow','l','a','n','d']::text[], array['ow']::text[], 'floor_core', 50, 'Core', 'Core ow word selected for Phase 8D structured expansion.', 'Mist covered the lowland fields.', 'Low flat land.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('snowman', 'snowman', 'ow', array['s','n','ow','m','a','n']::text[], array['ow']::text[], 'floor_core', 46, 'Core', 'Core ow word selected for Phase 8D structured expansion.', 'The snowman had a carrot nose.', 'A figure made from snow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('township', 'township', 'ow', array['t','ow','n','sh','i','p']::text[], array['ow']::text[], 'floor_core', 52, 'Core', 'Core ow word selected for Phase 8D structured expansion.', 'The township grew beside the river.', 'A small town or local area.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('windowless', 'windowless', 'ow', array['w','i','n','d','ow','l','e','ss']::text[], array['ow']::text[], 'floor_core', 52, 'Core', 'Core ow word selected for Phase 8D structured expansion.', 'The storage room was windowless.', 'Having no windows.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('yellowish', 'yellowish', 'ow', array['y','e','ll','ow','i','sh']::text[], array['ow']::text[], 'floor_core', 50, 'Core', 'Core ow word selected for Phase 8D structured expansion.', 'The paper had a yellowish edge.', 'Somewhat yellow in colour.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('blush', 'blush', 'sh', array['b','l','u','sh']::text[], array['sh']::text[], 'floor_core', 42, 'Core', 'Core sh word selected for Phase 8D structured expansion.', 'A blush spread across his cheeks.', 'A pink colour on the face from feeling shy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('hardship', 'hardship', 'sh', array['h','ar','d','sh','i','p']::text[], array['sh']::text[], 'floor_core', 52, 'Core', 'Core sh word selected for Phase 8D structured expansion.', 'The family faced hardship during the storm.', 'A difficult or painful situation.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('hush', 'hush', 'sh', array['h','u','sh']::text[], array['sh']::text[], 'floor_core', 38, 'Core', 'Core sh word selected for Phase 8D structured expansion.', 'A hush fell over the room.', 'A sudden quiet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('mishap', 'mishap', 'sh', array['m','i','sh','a','p']::text[], array['sh']::text[], 'floor_core', 48, 'Core', 'Core sh word selected for Phase 8D structured expansion.', 'A small mishap delayed the picnic.', 'A minor accident or mistake.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('reshape', 'reshape', 'sh', array['r','e','sh','a','p','e']::text[], array['sh']::text[], 'floor_core', 50, 'Core', 'Core sh word selected for Phase 8D structured expansion.', 'Use your hands to reshape the clay.', 'To give something a new shape.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('shellfish', 'shellfish', 'sh', array['sh','e','ll','f','i','sh']::text[], array['sh']::text[], 'floor_core', 50, 'Core', 'Core sh word selected for Phase 8D structured expansion.', 'Shellfish were listed on the menu.', 'Sea animals with shells that people may eat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('shopper', 'shopper', 'sh', array['sh','o','pp','er']::text[], array['sh']::text[], 'floor_core', 46, 'Core', 'Core sh word selected for Phase 8D structured expansion.', 'The shopper carried a reusable bag.', 'A person buying things in a shop.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('shyness', 'shyness', 'sh', array['sh','y','n','e','ss']::text[], array['sh']::text[], 'floor_core', 46, 'Core', 'Core sh word selected for Phase 8D structured expansion.', 'Her shyness faded after the first game.', 'The feeling of being shy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('sunshade', 'sunshade', 'sh', array['s','u','n','sh','a','d','e']::text[], array['sh']::text[], 'floor_core', 50, 'Core', 'Core sh word selected for Phase 8D structured expansion.', 'The sunshade kept the table cool.', 'A cover that gives shade from the sun.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('wishful', 'wishful', 'sh', array['w','i','sh','f','u','l']::text[], array['sh']::text[], 'floor_core', 46, 'Core', 'Core sh word selected for Phase 8D structured expansion.', 'That plan was wishful rather than likely.', 'Based more on hopes than facts.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('archer', 'archer', 'ch', array['ar','ch','er']::text[], array['ch']::text[], 'floor_core', 48, 'Core', 'Core ch word selected for Phase 8D structured expansion.', 'The archer aimed at the round target.', 'A person who shoots arrows with a bow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('checkup', 'checkup', 'ch', array['ch','e','ck','u','p']::text[], array['ch']::text[], 'floor_core', 48, 'Core', 'Core ch word selected for Phase 8D structured expansion.', 'The dog had a checkup at the vet.', 'A health examination.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('cheerleader', 'cheerleader', 'ch', array['ch','ee','r','l','ea','d','er']::text[], array['ch']::text[], 'floor_core', 54, 'Core', 'Core ch word selected for Phase 8D structured expansion.', 'The cheerleader started the chant.', 'A person who leads cheers for a team.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('chestnut', 'chestnut', 'ch', array['ch','e','s','t','n','u','t']::text[], array['ch']::text[], 'floor_core', 50, 'Core', 'Core ch word selected for Phase 8D structured expansion.', 'A chestnut fell from the tree.', 'A smooth brown nut from a chestnut tree.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('chipmunk', 'chipmunk', 'ch', array['ch','i','p','m','u','n','k']::text[], array['ch']::text[], 'floor_core', 50, 'Core', 'Core ch word selected for Phase 8D structured expansion.', 'A chipmunk darted over the rock.', 'A small striped animal like a squirrel.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('chisel', 'chisel', 'ch', array['ch','i','s','e','l']::text[], array['ch']::text[], 'floor_core', 48, 'Core', 'Core ch word selected for Phase 8D structured expansion.', 'The chisel was stored safely after woodwork.', 'A tool with a sharp edge for cutting or shaping.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('lunchbox', 'lunchbox', 'ch', array['l','u','n','ch','b','o','x']::text[], array['ch']::text[], 'floor_core', 50, 'Core', 'Core ch word selected for Phase 8D structured expansion.', 'The lunchbox fitted inside the bag.', 'A box used to carry lunch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('peachy', 'peachy', 'ch', array['p','ea','ch','y']::text[], array['ch']::text[], 'floor_core', 46, 'Core', 'Core ch word selected for Phase 8D structured expansion.', 'Everything looked peachy after the repair.', 'Very good or pleasant.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('richness', 'richness', 'ch', array['r','i','ch','n','e','ss']::text[], array['ch']::text[], 'floor_core', 50, 'Core', 'Core ch word selected for Phase 8D structured expansion.', 'The soup had a lovely richness.', 'A full or pleasing quality.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('touching', 'touching', 'ch', array['t','ou','ch','i','ng']::text[], array['ch']::text[], 'floor_core', 48, 'Core', 'Core ch word selected for Phase 8D structured expansion.', 'The ending was touching and kind.', 'Making someone feel gentle emotion.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('anthem', 'anthem', 'th', array['a','n','th','e','m']::text[], array['th']::text[], 'floor_core', 48, 'Core', 'Core th word selected for Phase 8D structured expansion.', 'The choir sang the school anthem.', 'A song that represents a group or place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('bathtub', 'bathtub', 'th', array['b','a','th','t','u','b']::text[], array['th']::text[], 'floor_core', 48, 'Core', 'Core th word selected for Phase 8D structured expansion.', 'The bathtub filled with warm water.', 'A large tub used for washing the body.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('bother', 'bother', 'th', array['b','o','th','er']::text[], array['th']::text[], 'floor_core', 46, 'Core', 'Core th word selected for Phase 8D structured expansion.', 'Do not bother the cat while it eats.', 'To annoy or disturb someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('fatherly', 'fatherly', 'th', array['f','a','th','er','l','y']::text[], array['th']::text[], 'floor_core', 50, 'Core', 'Core th word selected for Phase 8D structured expansion.', 'He gave fatherly advice before the trip.', 'Kind and caring like a father.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('gather', 'gather', 'th', array['g','a','th','er']::text[], array['th']::text[], 'floor_core', 46, 'Core', 'Core th word selected for Phase 8D structured expansion.', 'Gather the papers into one pile.', 'To bring things together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('lengthy', 'lengthy', 'th', array['l','e','ng','th','y']::text[], array['th']::text[], 'floor_core', 52, 'Core', 'Core th word selected for Phase 8D structured expansion.', 'The meeting became lengthy after many questions.', 'Taking a long time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('pathway', 'pathway', 'th', array['p','a','th','w','ay']::text[], array['th']::text[], 'floor_core', 48, 'Core', 'Core th word selected for Phase 8D structured expansion.', 'A stone pathway led to the pond.', 'A path for walking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('toothache', 'toothache', 'th', array['t','oo','th','a','ch','e']::text[], array['th']::text[], 'floor_core', 50, 'Core', 'Core th word selected for Phase 8D structured expansion.', 'A toothache kept him awake.', 'Pain in or near a tooth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('truthful', 'truthful', 'th', array['t','r','u','th','f','u','l']::text[], array['th']::text[], 'floor_core', 50, 'Core', 'Core th word selected for Phase 8D structured expansion.', 'A truthful answer is best.', 'Honest and telling the truth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('wealthy', 'wealthy', 'th', array['w','ea','l','th','y']::text[], array['th']::text[], 'floor_core', 52, 'Core', 'Core th word selected for Phase 8D structured expansion.', 'The wealthy merchant funded the bridge.', 'Having a lot of money or resources.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('belonging', 'belonging', 'ng', array['b','e','l','o','ng','i','ng']::text[], array['ng']::text[], 'floor_core', 50, 'Core', 'Core ng word selected for Phase 8D structured expansion.', 'A sense of belonging grew in the team.', 'Feeling accepted as part of a group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('clanging', 'clanging', 'ng', array['c','l','a','ng','i','ng']::text[], array['ng']::text[], 'floor_core', 48, 'Core', 'Core ng word selected for Phase 8D structured expansion.', 'The clanging bell echoed outside.', 'Making a loud ringing metal noise.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('fang', 'fang', 'ng', array['f','a','ng']::text[], array['ng']::text[], 'floor_core', 40, 'Core', 'Core ng word selected for Phase 8D structured expansion.', 'The model snake had one white fang.', 'A long pointed tooth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('finger', 'finger', 'ng', array['f','i','ng','er']::text[], array['ng']::text[], 'floor_core', 46, 'Core', 'Core ng word selected for Phase 8D structured expansion.', 'She lifted one finger to ask a question.', 'One of the five parts at the end of a hand.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('language', 'language', 'ng', array['l','a','ng','u','a','g','e']::text[], array['ng']::text[], 'floor_core', 54, 'Core', 'Core ng word selected for Phase 8D structured expansion.', 'Kind language made the message clearer.', 'Words used for speaking or writing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('longest', 'longest', 'ng', array['l','o','ng','e','s','t']::text[], array['ng']::text[], 'floor_core', 48, 'Core', 'Core ng word selected for Phase 8D structured expansion.', 'The longest ribbon reached the floor.', 'Greater in length than all the others.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('songbird', 'songbird', 'ng', array['s','o','ng','b','ir','d']::text[], array['ng']::text[], 'floor_core', 50, 'Core', 'Core ng word selected for Phase 8D structured expansion.', 'A songbird landed on the fence.', 'A bird known for singing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('springtime', 'springtime', 'ng', array['s','p','r','i','ng','t','i','m','e']::text[], array['ng']::text[], 'floor_core', 52, 'Core', 'Core ng word selected for Phase 8D structured expansion.', 'Springtime brought blossom to the trees.', 'The season of spring.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('stingray', 'stingray', 'ng', array['s','t','i','ng','r','ay']::text[], array['ng']::text[], 'floor_core', 52, 'Core', 'Core ng word selected for Phase 8D structured expansion.', 'A stingray glided over the sand.', 'A flat sea fish with a long tail.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('stronghold', 'stronghold', 'ng', array['s','t','r','o','ng','h','o','l','d']::text[], array['ng']::text[], 'floor_core', 54, 'Core', 'Core ng word selected for Phase 8D structured expansion.', 'The castle was a stronghold on the hill.', 'A strongly protected place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('attack', 'attack', 'ck', array['a','t','t','a','ck']::text[], array['ck']::text[], 'floor_core', 48, 'Core', 'Core ck word selected for Phase 8D structured expansion.', 'The team planned an attack in the board game.', 'A strong move against an opponent.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('blocker', 'blocker', 'ck', array['b','l','o','ck','er']::text[], array['ck']::text[], 'floor_core', 48, 'Core', 'Core ck word selected for Phase 8D structured expansion.', 'A blocker stood near the net.', 'A player or object that blocks something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('cracker', 'cracker', 'ck', array['c','r','a','ck','er']::text[], array['ck']::text[], 'floor_core', 46, 'Core', 'Core ck word selected for Phase 8D structured expansion.', 'The cracker snapped in two.', 'A thin crisp biscuit.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('duckling', 'duckling', 'ck', array['d','u','ck','l','i','ng']::text[], array['ck']::text[], 'floor_core', 46, 'Core', 'Core ck word selected for Phase 8D structured expansion.', 'A duckling followed its mother.', 'A young duck.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('necklace', 'necklace', 'ck', array['n','e','ck','l','a','c','e']::text[], array['ck']::text[], 'floor_core', 50, 'Core', 'Core ck word selected for Phase 8D structured expansion.', 'The necklace had a blue bead.', 'Jewellery worn around the neck.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('quicker', 'quicker', 'ck', array['qu','i','ck','er']::text[], array['ck']::text[], 'floor_core', 48, 'Core', 'Core ck word selected for Phase 8D structured expansion.', 'The second route was quicker.', 'Faster than something else.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('rocketship', 'rocketship', 'ck', array['r','o','ck','e','t','sh','i','p']::text[], array['ck']::text[], 'floor_core', 52, 'Core', 'Core ck word selected for Phase 8D structured expansion.', 'The toy rocketship stood on the shelf.', 'A spacecraft shaped like a rocket.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('shocking', 'shocking', 'ck', array['sh','o','ck','i','ng']::text[], array['ck']::text[], 'floor_core', 50, 'Core', 'Core ck word selected for Phase 8D structured expansion.', 'The news was shocking at first.', 'Very surprising or upsetting.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('stocking', 'stocking', 'ck', array['s','t','o','ck','i','ng']::text[], array['ck']::text[], 'floor_core', 50, 'Core', 'Core ck word selected for Phase 8D structured expansion.', 'A red stocking hung by the fireplace.', 'A long sock.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('unlock', 'unlock', 'ck', array['u','n','l','o','ck']::text[], array['ck']::text[], 'floor_core', 46, 'Core', 'Core ck word selected for Phase 8D structured expansion.', 'Use the key to unlock the gate.', 'To open a lock.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('conversation', 'conversation', 'tion', array['c','o','n','v','er','s','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch tion word selected for Phase 8D structured expansion.', 'The conversation stayed friendly.', 'A talk between people.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('exploration', 'exploration', 'tion', array['e','x','p','l','or','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8D structured expansion.', 'The cave exploration took all morning.', 'The act of looking around to learn about a place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('imagination', 'imagination', 'tion', array['i','m','a','g','i','n','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8D structured expansion.', 'The story showed great imagination.', 'The ability to form ideas or pictures in the mind.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('introduction', 'introduction', 'tion', array['i','n','t','r','o','d','u','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8D structured expansion.', 'The book had a short introduction.', 'The beginning part that explains something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('multiplication', 'multiplication', 'tion', array['m','u','l','t','i','p','l','i','c','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 64, 'Stretch', 'Stretch tion word selected for Phase 8D structured expansion.', 'Multiplication helped solve the puzzle.', 'A maths operation for finding repeated groups.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('observation', 'observation', 'tion', array['o','b','s','er','v','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8D structured expansion.', 'Careful observation helped the scientist.', 'Watching or noticing something carefully.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('preparation', 'preparation', 'tion', array['p','r','e','p','a','r','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch tion word selected for Phase 8D structured expansion.', 'Good preparation made the show smoother.', 'Work done before an event or task.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('presentation', 'presentation', 'tion', array['p','r','e','s','e','n','t','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8D structured expansion.', 'Her presentation used clear pictures.', 'A talk or display given to others.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('translation', 'translation', 'tion', array['t','r','a','n','s','l','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8D structured expansion.', 'The translation helped everyone read the sign.', 'Words changed from one language to another.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('transportation', 'transportation', 'tion', array['t','r','a','n','s','p','or','t','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 64, 'Stretch', 'Stretch tion word selected for Phase 8D structured expansion.', 'The city improved transportation for pupils.', 'Ways of moving people or goods from place to place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('blur', 'blur', 'ur', array['b','l','ur']::text[], array['ur']::text[], 'diagnostic', 42, 'Core', 'Core ur word selected for Phase 8D structured expansion.', 'The fast bike became a blur.', 'Something seen unclearly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('blurry', 'blurry', 'ur', array['b','l','ur','r','y']::text[], array['ur']::text[], 'diagnostic', 44, 'Core', 'Core ur word selected for Phase 8D structured expansion.', 'The photo looked blurry in the corner.', 'Not clear or sharp.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('disturb', 'disturb', 'ur', array['d','i','s','t','ur','b']::text[], array['ur']::text[], 'diagnostic', 50, 'Core', 'Core ur word selected for Phase 8D structured expansion.', 'Please do not disturb the reading group.', 'To interrupt or bother someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('hurdler', 'hurdler', 'ur', array['h','ur','d','l','er']::text[], array['ur']::text[], 'diagnostic', 50, 'Core', 'Core ur word selected for Phase 8D structured expansion.', 'The hurdler cleared the final jump.', 'A runner who jumps over hurdles.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('purring', 'purring', 'ur', array['p','ur','r','i','ng']::text[], array['ur']::text[], 'diagnostic', 46, 'Core', 'Core ur word selected for Phase 8D structured expansion.', 'The cat was purring on the blanket.', 'Making a low happy rumbling sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('slurp', 'slurp', 'ur', array['s','l','ur','p']::text[], array['ur']::text[], 'diagnostic', 44, 'Core', 'Core ur word selected for Phase 8D structured expansion.', 'Try not to slurp the soup.', 'To drink or eat noisily.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('suburb', 'suburb', 'ur', array['s','u','b','ur','b']::text[], array['ur']::text[], 'diagnostic', 48, 'Core', 'Core ur word selected for Phase 8D structured expansion.', 'The suburb had quiet streets.', 'An area of homes outside a city centre.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('surfboard', 'surfboard', 'ur', array['s','ur','f','b','oa','r','d']::text[], array['ur']::text[], 'diagnostic', 52, 'Core', 'Core ur word selected for Phase 8D structured expansion.', 'The surfboard leaned against the wall.', 'A long board used for riding waves.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('turnstile', 'turnstile', 'ur', array['t','ur','n','s','t','i','l','e']::text[], array['ur']::text[], 'diagnostic', 52, 'Core', 'Core ur word selected for Phase 8D structured expansion.', 'The turnstile clicked at the station entrance.', 'A turning gate that lets one person pass at a time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('upturn', 'upturn', 'ur', array['u','p','t','ur','n']::text[], array['ur']::text[], 'diagnostic', 48, 'Core', 'Core ur word selected for Phase 8D structured expansion.', 'There was an upturn in ticket sales.', 'An increase or improvement.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('cashier', 'cashier', 'ie', array['c','a','sh','ie','r']::text[], array['ie']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ie word selected for Phase 8D structured expansion.', 'The cashier counted the change.', 'A person who takes payments in a shop.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('frontier', 'frontier', 'ie', array['f','r','o','n','t','ie','r']::text[], array['ie']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch ie word selected for Phase 8D structured expansion.', 'The old map showed the frontier.', 'The edge or border of a settled area.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('spacious', 'spacious', 'ci', array['s','p','a','ci','ou','s']::text[], array['ci']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ci word selected for Phase 8D structured expansion.', 'The spacious hall held the whole school.', 'Having plenty of room.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('suspicious', 'suspicious', 'ci', array['s','u','s','p','i','ci','ou','s']::text[], array['ci']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch ci word selected for Phase 8D structured expansion.', 'The missing crumbs looked suspicious.', 'Making someone feel that something is wrong.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('automobile', 'automobile', 'au', array['au','t','o','m','o','b','i','l','e']::text[], array['au']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch au word selected for Phase 8D structured expansion.', 'The museum displayed an early automobile.', 'A car or motor vehicle.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('cautiously', 'cautiously', 'au', array['c','au','t','i','ou','s','l','y']::text[], array['au']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch au word selected for Phase 8D structured expansion.', 'The skater moved cautiously on the ice.', 'In a careful way that avoids risk.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('hauler', 'hauler', 'au', array['h','au','l','er']::text[], array['au']::text[], 'ceiling_challenge', 54, 'Core', 'Core au word selected for Phase 8D structured expansion.', 'The hauler moved logs from the forest.', 'A vehicle or person that carries heavy loads.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('vaulted', 'vaulted', 'au', array['v','au','l','t','e','d']::text[], array['au']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch au word selected for Phase 8D structured expansion.', 'The hall had a vaulted ceiling.', 'Built with a curved arch shape.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('array', 'array', 'ay', array['a','r','r','ay']::text[], array['ay']::text[], 'floor_core', 48, 'Core', 'Core ay word selected for Phase 8D structured expansion.', 'The buttons were set out in a neat array.', 'An ordered group or arrangement.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('betray', 'betray', 'ay', array['b','e','t','r','ay']::text[], array['ay']::text[], 'floor_core', 50, 'Core', 'Core ay word selected for Phase 8D structured expansion.', 'Do not betray a friend''s trust.', 'To break trust or be disloyal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('crayon', 'crayon', 'ay', array['c','r','ay','o','n']::text[], array['ay']::text[], 'floor_core', 46, 'Core', 'Core ay word selected for Phase 8D structured expansion.', 'The red crayon rolled under the desk.', 'A coloured wax stick used for drawing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('gateway', 'gateway', 'ay', array['g','a','t','e','w','ay']::text[], array['ay']::text[], 'floor_core', 50, 'Core', 'Core ay word selected for Phase 8D structured expansion.', 'The gateway opened into a garden.', 'An entrance with a gate.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('gray', 'gray', 'ay', array['g','r','ay']::text[], array['ay']::text[], 'floor_core', 40, 'Core', 'Core ay word selected for Phase 8D structured expansion.', 'The sky turned gray before rain.', 'A colour between black and white.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('mayor', 'mayor', 'ay', array['m','ay','or']::text[], array['ay']::text[], 'floor_core', 48, 'Core', 'Core ay word selected for Phase 8D structured expansion.', 'The mayor visited the library.', 'The elected leader of a town or city.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('portray', 'portray', 'ay', array['p','or','t','r','ay']::text[], array['ay']::text[], 'floor_core', 52, 'Core', 'Core ay word selected for Phase 8D structured expansion.', 'The actor tried to portray a brave explorer.', 'To show or describe someone or something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('someday', 'someday', 'ay', array['s','o','m','e','d','ay']::text[], array['ay']::text[], 'floor_core', 46, 'Core', 'Core ay word selected for Phase 8D structured expansion.', 'Someday we may visit the old castle.', 'At some time in the future.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('subway', 'subway', 'ay', array['s','u','b','w','ay']::text[], array['ay']::text[], 'floor_core', 48, 'Core', 'Core ay word selected for Phase 8D structured expansion.', 'The subway train arrived on time.', 'An underground railway.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('wayward', 'wayward', 'ay', array['w','ay','w','ar','d']::text[], array['ay']::text[], 'floor_core', 50, 'Core', 'Core ay word selected for Phase 8D structured expansion.', 'A wayward ball bounced over the fence.', 'Difficult to control or predict.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('bleach', 'bleach', 'ea', array['b','l','ea','ch']::text[], array['ea']::text[], 'floor_core', 48, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'Bleach should be kept away from young children.', 'A strong liquid used for cleaning or whitening.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('bleak', 'bleak', 'ea', array['b','l','ea','k']::text[], array['ea']::text[], 'floor_core', 46, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'The hill looked bleak in winter.', 'Cold, bare, and not cheerful.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('bleat', 'bleat', 'ea', array['b','l','ea','t']::text[], array['ea']::text[], 'floor_core', 42, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'The lamb gave a soft bleat.', 'The sound made by a sheep or goat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('cheat', 'cheat', 'ea', array['ch','ea','t']::text[], array['ea']::text[], 'floor_core', 44, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'It is wrong to cheat in a game.', 'To act unfairly to win or gain something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('cheater', 'cheater', 'ea', array['ch','ea','t','er']::text[], array['ea']::text[], 'floor_core', 48, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'The cheater had to start the game again.', 'A person who cheats.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('dean', 'dean', 'ea', array['d','ea','n']::text[], array['ea']::text[], 'floor_core', 44, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'The dean greeted visitors at the college.', 'A senior leader in a college or university.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('eager', 'eager', 'ea', array['ea','g','er']::text[], array['ea']::text[], 'floor_core', 46, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'The eager puppy ran to the door.', 'Very keen or excited to do something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('healer', 'healer', 'ea', array['h','ea','l','er']::text[], array['ea']::text[], 'floor_core', 48, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'The healer in the story mixed herbs.', 'A person who helps others become well.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('peanut', 'peanut', 'ea', array['p','ea','n','u','t']::text[], array['ea']::text[], 'floor_core', 46, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'A peanut fell from the snack bowl.', 'A small edible seed that grows in a shell.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('seagull', 'seagull', 'ea', array['s','ea','g','u','ll']::text[], array['ea']::text[], 'floor_core', 48, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'A seagull landed near the pier.', 'A common bird that lives near the sea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('seashore', 'seashore', 'ea', array['s','ea','sh','or','e']::text[], array['ea']::text[], 'floor_core', 52, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'We collected shells along the seashore.', 'The land at the edge of the sea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('seaweed', 'seaweed', 'ea', array['s','ea','w','ee','d']::text[], array['ea']::text[], 'floor_core', 50, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'Green seaweed floated in the tide pool.', 'A plant-like growth that lives in the sea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('teacup', 'teacup', 'ea', array['t','ea','c','u','p']::text[], array['ea']::text[], 'floor_core', 46, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'The teacup had a painted flower.', 'A small cup used for tea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('wreath', 'wreath', 'ea', array['w','r','ea','th']::text[], array['ea']::text[], 'floor_core', 50, 'Core', 'Core ea word selected for Phase 8D structured expansion.', 'A wreath hung on the front door.', 'A ring of leaves or flowers used as decoration.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('jewelry', 'jewelry', 'ew', array['j','ew','e','l','r','y']::text[], array['ew']::text[], 'diagnostic', 54, 'Core', 'Core ew word selected for Phase 8D structured expansion.', 'The box held simple silver jewelry.', 'Small decorative items worn by people.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('mew', 'mew', 'ew', array['m','ew']::text[], array['ew']::text[], 'diagnostic', 38, 'Core', 'Core ew word selected for Phase 8D structured expansion.', 'The kitten gave a tiny mew.', 'A soft cry made by a cat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('newscast', 'newscast', 'ew', array['n','ew','s','c','a','s','t']::text[], array['ew']::text[], 'diagnostic', 54, 'Core', 'Core ew word selected for Phase 8D structured expansion.', 'The evening newscast mentioned the parade.', 'A radio or television news programme.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('newsstand', 'newsstand', 'ew', array['n','ew','s','s','t','a','n','d']::text[], array['ew']::text[], 'diagnostic', 54, 'Core', 'Core ew word selected for Phase 8D structured expansion.', 'The newsstand sold comics and maps.', 'A small stall that sells newspapers and magazines.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('pewter', 'pewter', 'ew', array['p','ew','t','er']::text[], array['ew']::text[], 'diagnostic', 52, 'Core', 'Core ew word selected for Phase 8D structured expansion.', 'The old cup was made of pewter.', 'A dull grey metal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('sewer', 'sewer', 'ew', array['s','ew','er']::text[], array['ew']::text[], 'diagnostic', 50, 'Core', 'Core ew word selected for Phase 8D structured expansion.', 'The sewer carried water away from the street.', 'An underground pipe for waste water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('skew', 'skew', 'ew', array['s','k','ew']::text[], array['ew']::text[], 'diagnostic', 50, 'Core', 'Core ew word selected for Phase 8D structured expansion.', 'A bent frame can skew the picture.', 'To make something slant or become uneven.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('stewpot', 'stewpot', 'ew', array['s','t','ew','p','o','t']::text[], array['ew']::text[], 'diagnostic', 48, 'Core', 'Core ew word selected for Phase 8D structured expansion.', 'The stewpot simmered on the stove.', 'A large pot used for cooking stew.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('unscrew', 'unscrew', 'ew', array['u','n','s','c','r','ew']::text[], array['ew']::text[], 'diagnostic', 50, 'Core', 'Core ew word selected for Phase 8D structured expansion.', 'Unscrew the lid before pouring.', 'To loosen by turning.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('yew', 'yew', 'ew', array['y','ew']::text[], array['ew']::text[], 'diagnostic', 42, 'Core', 'Core ew word selected for Phase 8D structured expansion.', 'A yew grew beside the old path.', 'An evergreen tree with dark leaves.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('lure', 'lure', 'ure', array['l','ure']::text[], array['ure']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ure word selected for Phase 8D structured expansion.', 'The bright lure attracted the fish.', 'Something used to attract a person or animal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('pastureland', 'pastureland', 'ure', array['p','a','s','t','ure','l','a','n','d']::text[], array['ure']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch ure word selected for Phase 8D structured expansion.', 'Cows grazed on the pastureland.', 'Land covered with grass for animals to eat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('purely', 'purely', 'ure', array['p','ure','l','y']::text[], array['ure']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ure word selected for Phase 8D structured expansion.', 'The choice was purely for fun.', 'Only or completely.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('securely', 'securely', 'ure', array['s','e','c','ure','l','y']::text[], array['ure']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ure word selected for Phase 8D structured expansion.', 'The shelf was fixed securely to the wall.', 'In a safe and firm way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('awestruck', 'awestruck', 'aw', array['aw','e','s','t','r','u','ck']::text[], array['aw']::text[], 'diagnostic', 56, 'Stretch', 'Stretch aw word selected for Phase 8D structured expansion.', 'The crowd stood awestruck by the fireworks.', 'Filled with wonder or amazement.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('brawl', 'brawl', 'aw', array['b','r','aw','l']::text[], array['aw']::text[], 'diagnostic', 48, 'Core', 'Core aw word selected for Phase 8D structured expansion.', 'The referee stopped the brawl quickly.', 'A noisy rough fight or argument.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('crawfish', 'crawfish', 'aw', array['c','r','aw','f','i','sh']::text[], array['aw']::text[], 'diagnostic', 50, 'Core', 'Core aw word selected for Phase 8D structured expansion.', 'A crawfish hid under the river stone.', 'A small freshwater animal like a lobster.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('dawned', 'dawned', 'aw', array['d','aw','n','e','d']::text[], array['aw']::text[], 'diagnostic', 46, 'Core', 'Core aw word selected for Phase 8D structured expansion.', 'A new idea dawned on me.', 'Became clear or began.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('drawstring', 'drawstring', 'aw', array['d','r','aw','s','t','r','i','ng']::text[], array['aw']::text[], 'diagnostic', 54, 'Core', 'Core aw word selected for Phase 8D structured expansion.', 'The bag closed with a drawstring.', 'A cord used to pull something closed.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('hawthorn', 'hawthorn', 'aw', array['h','aw','th','or','n']::text[], array['aw']::text[], 'diagnostic', 54, 'Core', 'Core aw word selected for Phase 8D structured expansion.', 'The hawthorn hedge had white blossom.', 'A small tree or shrub with thorns.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('jigsawed', 'jigsawed', 'aw', array['j','i','g','s','aw','e','d']::text[], array['aw']::text[], 'diagnostic', 50, 'Core', 'Core aw word selected for Phase 8D structured expansion.', 'The pieces jigsawed together neatly.', 'Fitted together like parts of a puzzle.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('sawblade', 'sawblade', 'aw', array['s','aw','b','l','a','d','e']::text[], array['aw']::text[], 'diagnostic', 52, 'Core', 'Core aw word selected for Phase 8D structured expansion.', 'The sawblade was stored safely in a case.', 'The toothed cutting part of a saw.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('sprawling', 'sprawling', 'aw', array['s','p','r','aw','l','i','ng']::text[], array['aw']::text[], 'diagnostic', 54, 'Core', 'Core aw word selected for Phase 8D structured expansion.', 'The sprawling park covered many blocks.', 'Spread out over a wide area.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('withdrawal', 'withdrawal', 'aw', array['w','i','th','d','r','aw','a','l']::text[], array['aw']::text[], 'diagnostic', 56, 'Stretch', 'Stretch aw word selected for Phase 8D structured expansion.', 'The withdrawal of the old rule helped the club.', 'The act of taking something back or away.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('catchy', 'catchy', 'tch', array['c','a','tch','y']::text[], array['tch']::text[], 'diagnostic', 48, 'Core', 'Core tch word selected for Phase 8D structured expansion.', 'The song had a catchy tune.', 'Easy to remember and like.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('fetching', 'fetching', 'tch', array['f','e','tch','i','ng']::text[], array['tch']::text[], 'diagnostic', 48, 'Core', 'Core tch word selected for Phase 8D structured expansion.', 'The dog was fetching the ball.', 'Going to get something and bring it back.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('latchkey', 'latchkey', 'tch', array['l','a','tch','k','ey']::text[], array['tch']::text[], 'diagnostic', 52, 'Core', 'Core tch word selected for Phase 8D structured expansion.', 'The latchkey hung on a red ribbon.', 'A key used to open a latch or door.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true),
  ('watchdog', 'watchdog', 'tch', array['w','a','tch','d','o','g']::text[], array['tch']::text[], 'diagnostic', 52, 'Core', 'Core tch word selected for Phase 8D structured expansion.', 'The watchdog barked at the gate.', 'A dog trained to guard a place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8d_2026_05_14', true);

create temporary table wordloom_core_phase_8d_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_8d_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('afford', 'or', 'primary', 'r_controlled_vowel', 0),
  ('afraid', 'ai', 'primary', 'long_vowel_digraph', 0),
  ('airborne', 'air', 'primary', 'r_controlled_vowel', 0),
  ('aircrew', 'air', 'primary', 'r_controlled_vowel', 0),
  ('airlock', 'air', 'primary', 'r_controlled_vowel', 0),
  ('airway', 'air', 'primary', 'r_controlled_vowel', 0),
  ('alight', 'igh', 'primary', 'trigraph', 0),
  ('anthem', 'th', 'primary', 'consonant_digraph', 0),
  ('archer', 'ch', 'primary', 'consonant_digraph', 0),
  ('array', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('attack', 'ck', 'primary', 'consonant_digraph', 0),
  ('automobile', 'au', 'primary', 'vowel_digraph', 0),
  ('awestruck', 'aw', 'primary', 'vowel_digraph', 0),
  ('banner', 'er', 'primary', 'r_controlled_vowel', 0),
  ('bark', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('bathtub', 'th', 'primary', 'consonant_digraph', 0),
  ('beech', 'ee', 'primary', 'vowel_digraph', 0),
  ('beehive', 'ee', 'primary', 'vowel_digraph', 0),
  ('beetle', 'ee', 'primary', 'vowel_digraph', 0),
  ('before', 'or', 'primary', 'r_controlled_vowel', 0),
  ('belonging', 'ng', 'primary', 'consonant_digraph', 0),
  ('betray', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('bitter', 'er', 'primary', 'r_controlled_vowel', 0),
  ('bleach', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('bleak', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('bleat', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('blight', 'igh', 'primary', 'trigraph', 0),
  ('bloat', 'oa', 'primary', 'vowel_digraph', 0),
  ('blocker', 'ck', 'primary', 'consonant_digraph', 0),
  ('blouse', 'ou', 'primary', 'vowel_digraph', 0),
  ('blur', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('blurry', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('blush', 'sh', 'primary', 'consonant_digraph', 0),
  ('board', 'oa', 'primary', 'vowel_digraph', 0),
  ('boarding', 'oa', 'primary', 'vowel_digraph', 0),
  ('bother', 'th', 'primary', 'consonant_digraph', 0),
  ('brawl', 'aw', 'primary', 'vowel_digraph', 0),
  ('brow', 'ow', 'primary', 'vowel_digraph', 0),
  ('camper', 'er', 'primary', 'r_controlled_vowel', 0),
  ('cashier', 'ie', 'primary', 'vowel_digraph', 0),
  ('catchy', 'tch', 'primary', 'trigraph', 0),
  ('cautiously', 'au', 'primary', 'vowel_digraph', 0),
  ('chairback', 'air', 'primary', 'r_controlled_vowel', 0),
  ('charcoal', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('charm', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('cheat', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('cheater', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('checkup', 'ch', 'primary', 'consonant_digraph', 0),
  ('cheerleader', 'ch', 'primary', 'consonant_digraph', 0),
  ('chestnut', 'ch', 'primary', 'consonant_digraph', 0),
  ('chipmunk', 'ch', 'primary', 'consonant_digraph', 0),
  ('chisel', 'ch', 'primary', 'consonant_digraph', 0),
  ('clanging', 'ng', 'primary', 'consonant_digraph', 0),
  ('cloakroom', 'oa', 'primary', 'vowel_digraph', 0),
  ('coastline', 'oa', 'primary', 'vowel_digraph', 0),
  ('complain', 'ai', 'primary', 'long_vowel_digraph', 0),
  ('conversation', 'tion', 'primary', 'trigraph', 0),
  ('corduroy', 'oy', 'primary', 'vowel_digraph', 0),
  ('countless', 'ou', 'primary', 'vowel_digraph', 0),
  ('cracker', 'ck', 'primary', 'consonant_digraph', 0),
  ('crawfish', 'aw', 'primary', 'vowel_digraph', 0),
  ('crayon', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('croak', 'oa', 'primary', 'vowel_digraph', 0),
  ('dancer', 'er', 'primary', 'r_controlled_vowel', 0),
  ('darken', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('dawned', 'aw', 'primary', 'vowel_digraph', 0),
  ('dean', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('deckchair', 'air', 'primary', 'r_controlled_vowel', 0),
  ('deer', 'ee', 'primary', 'vowel_digraph', 0),
  ('disturb', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('doubtful', 'ou', 'primary', 'vowel_digraph', 0),
  ('downward', 'ow', 'primary', 'vowel_digraph', 0),
  ('drawstring', 'aw', 'primary', 'vowel_digraph', 0),
  ('duckling', 'ck', 'primary', 'consonant_digraph', 0),
  ('eager', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('earnest', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('earthworm', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('eel', 'ee', 'primary', 'vowel_digraph', 0),
  ('exploration', 'tion', 'primary', 'trigraph', 0),
  ('fang', 'ng', 'primary', 'consonant_digraph', 0),
  ('farmyard', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('fatherly', 'th', 'primary', 'consonant_digraph', 0),
  ('fearless', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('fetching', 'tch', 'primary', 'trigraph', 0),
  ('finger', 'ng', 'primary', 'consonant_digraph', 0),
  ('firelight', 'igh', 'primary', 'trigraph', 0),
  ('fleece', 'ee', 'primary', 'vowel_digraph', 0),
  ('flowerbed', 'ow', 'primary', 'vowel_digraph', 0),
  ('folder', 'er', 'primary', 'r_controlled_vowel', 0),
  ('fort', 'or', 'primary', 'r_controlled_vowel', 0),
  ('forty', 'or', 'primary', 'r_controlled_vowel', 0),
  ('foundry', 'ou', 'primary', 'vowel_digraph', 0),
  ('frail', 'ai', 'primary', 'long_vowel_digraph', 0),
  ('frightful', 'igh', 'primary', 'trigraph', 0),
  ('frontier', 'ie', 'primary', 'vowel_digraph', 0),
  ('garment', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('gateway', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('gather', 'th', 'primary', 'consonant_digraph', 0),
  ('glowing', 'ow', 'primary', 'vowel_digraph', 0),
  ('gray', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('grower', 'ow', 'primary', 'vowel_digraph', 0),
  ('hailstone', 'ai', 'primary', 'long_vowel_digraph', 0),
  ('hairpiece', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hairy', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hamster', 'er', 'primary', 'r_controlled_vowel', 0),
  ('hardship', 'sh', 'primary', 'consonant_digraph', 0),
  ('harmful', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('hauler', 'au', 'primary', 'vowel_digraph', 0),
  ('hawthorn', 'aw', 'primary', 'vowel_digraph', 0),
  ('healer', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('household', 'ou', 'primary', 'vowel_digraph', 0),
  ('hunter', 'er', 'primary', 'r_controlled_vowel', 0),
  ('hurdler', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('hush', 'sh', 'primary', 'consonant_digraph', 0),
  ('imagination', 'tion', 'primary', 'trigraph', 0),
  ('insightful', 'igh', 'primary', 'trigraph', 0),
  ('introduction', 'tion', 'primary', 'trigraph', 0),
  ('jewelry', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('jigsawed', 'aw', 'primary', 'vowel_digraph', 0),
  ('joyride', 'oy', 'primary', 'vowel_digraph', 0),
  ('jumper', 'er', 'primary', 'r_controlled_vowel', 0),
  ('language', 'ng', 'primary', 'consonant_digraph', 0),
  ('lark', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('latchkey', 'tch', 'primary', 'trigraph', 0),
  ('learned', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('leek', 'ee', 'primary', 'vowel_digraph', 0),
  ('lengthy', 'th', 'primary', 'consonant_digraph', 0),
  ('limelight', 'igh', 'primary', 'trigraph', 0),
  ('longest', 'ng', 'primary', 'consonant_digraph', 0),
  ('loudly', 'ou', 'primary', 'vowel_digraph', 0),
  ('lowland', 'ow', 'primary', 'vowel_digraph', 0),
  ('lunchbox', 'ch', 'primary', 'consonant_digraph', 0),
  ('lure', 'ure', 'primary', 'trigraph', 0),
  ('mailroom', 'ai', 'primary', 'long_vowel_digraph', 0),
  ('marching', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('mayor', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('mew', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('mishap', 'sh', 'primary', 'consonant_digraph', 0),
  ('mouthwash', 'ou', 'primary', 'vowel_digraph', 0),
  ('multiplication', 'tion', 'primary', 'trigraph', 0),
  ('necklace', 'ck', 'primary', 'consonant_digraph', 0),
  ('newscast', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('newsstand', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('nightmare', 'igh', 'primary', 'trigraph', 0),
  ('observation', 'tion', 'primary', 'trigraph', 0),
  ('painful', 'ai', 'primary', 'long_vowel_digraph', 0),
  ('partner', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('pastureland', 'ure', 'primary', 'trigraph', 0),
  ('pathway', 'th', 'primary', 'consonant_digraph', 0),
  ('peachy', 'ch', 'primary', 'consonant_digraph', 0),
  ('peanut', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('peek', 'ee', 'primary', 'vowel_digraph', 0),
  ('pewter', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('plight', 'igh', 'primary', 'trigraph', 0),
  ('poach', 'oa', 'primary', 'vowel_digraph', 0),
  ('poacher', 'oa', 'primary', 'vowel_digraph', 0),
  ('porter', 'or', 'primary', 'r_controlled_vowel', 0),
  ('portray', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('praise', 'ai', 'primary', 'long_vowel_digraph', 0),
  ('preparation', 'tion', 'primary', 'trigraph', 0),
  ('presentation', 'tion', 'primary', 'trigraph', 0),
  ('purely', 'ure', 'primary', 'trigraph', 0),
  ('purring', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('quicker', 'ck', 'primary', 'consonant_digraph', 0),
  ('raindrop', 'ai', 'primary', 'long_vowel_digraph', 0),
  ('rainfall', 'ai', 'primary', 'long_vowel_digraph', 0),
  ('reappear', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('reef', 'ee', 'primary', 'vowel_digraph', 0),
  ('reshape', 'sh', 'primary', 'consonant_digraph', 0),
  ('richness', 'ch', 'primary', 'consonant_digraph', 0),
  ('roach', 'oa', 'primary', 'vowel_digraph', 0),
  ('roadside', 'oa', 'primary', 'vowel_digraph', 0),
  ('rocketship', 'ck', 'primary', 'consonant_digraph', 0),
  ('roundabout', 'ou', 'primary', 'vowel_digraph', 0),
  ('sailing', 'ai', 'primary', 'long_vowel_digraph', 0),
  ('sailor', 'or', 'primary', 'r_controlled_vowel', 0),
  ('sawblade', 'aw', 'primary', 'vowel_digraph', 0),
  ('scarlet', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('scorch', 'or', 'primary', 'r_controlled_vowel', 0),
  ('screech', 'ee', 'primary', 'vowel_digraph', 0),
  ('seagull', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('searching', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('seashore', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('seaweed', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('securely', 'ure', 'primary', 'trigraph', 0),
  ('sewer', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('sharpen', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('shellfish', 'sh', 'primary', 'consonant_digraph', 0),
  ('shelter', 'er', 'primary', 'r_controlled_vowel', 0),
  ('shoal', 'oa', 'primary', 'vowel_digraph', 0),
  ('shocking', 'ck', 'primary', 'consonant_digraph', 0),
  ('shopper', 'sh', 'primary', 'consonant_digraph', 0),
  ('shorten', 'or', 'primary', 'r_controlled_vowel', 0),
  ('shyness', 'sh', 'primary', 'consonant_digraph', 0),
  ('sightseeing', 'igh', 'primary', 'trigraph', 0),
  ('skew', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('sleepy', 'ee', 'primary', 'vowel_digraph', 0),
  ('slurp', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('snowman', 'ow', 'primary', 'vowel_digraph', 0),
  ('someday', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('songbird', 'ng', 'primary', 'consonant_digraph', 0),
  ('soundtrack', 'ou', 'primary', 'vowel_digraph', 0),
  ('southwest', 'ou', 'primary', 'vowel_digraph', 0),
  ('spacious', 'ci', 'primary', 'soft_c', 0),
  ('sprawling', 'aw', 'primary', 'vowel_digraph', 0),
  ('springtime', 'ng', 'primary', 'consonant_digraph', 0),
  ('stairwell', 'air', 'primary', 'r_controlled_vowel', 0),
  ('starfish', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('steep', 'ee', 'primary', 'vowel_digraph', 0),
  ('stewpot', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('stingray', 'ng', 'primary', 'consonant_digraph', 0),
  ('stocking', 'ck', 'primary', 'consonant_digraph', 0),
  ('stronghold', 'ng', 'primary', 'consonant_digraph', 0),
  ('suburb', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('subway', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('sunshade', 'sh', 'primary', 'consonant_digraph', 0),
  ('surfboard', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('suspicious', 'ci', 'primary', 'soft_c', 0),
  ('tart', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('teacup', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('tiger', 'er', 'primary', 'r_controlled_vowel', 0),
  ('tightrope', 'igh', 'primary', 'trigraph', 0),
  ('toadstool', 'oa', 'primary', 'vowel_digraph', 0),
  ('toddler', 'er', 'primary', 'r_controlled_vowel', 0),
  ('toothache', 'th', 'primary', 'consonant_digraph', 0),
  ('touching', 'ch', 'primary', 'consonant_digraph', 0),
  ('township', 'ow', 'primary', 'vowel_digraph', 0),
  ('tractor', 'or', 'primary', 'r_controlled_vowel', 0),
  ('translation', 'tion', 'primary', 'trigraph', 0),
  ('transportation', 'tion', 'primary', 'trigraph', 0),
  ('truthful', 'th', 'primary', 'consonant_digraph', 0),
  ('turnstile', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('unlock', 'ck', 'primary', 'consonant_digraph', 0),
  ('unpaired', 'air', 'primary', 'r_controlled_vowel', 0),
  ('unscrew', 'ew', 'primary', 'long_vowel_digraph', 0),
  ('upturn', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('vaulted', 'au', 'primary', 'vowel_digraph', 0),
  ('visitor', 'or', 'primary', 'r_controlled_vowel', 0),
  ('waiter', 'er', 'primary', 'r_controlled_vowel', 0),
  ('wander', 'er', 'primary', 'r_controlled_vowel', 0),
  ('watchdog', 'tch', 'primary', 'trigraph', 0),
  ('wayward', 'ay', 'primary', 'long_vowel_digraph', 0),
  ('wealthy', 'th', 'primary', 'consonant_digraph', 0),
  ('whisper', 'er', 'primary', 'r_controlled_vowel', 0),
  ('windowless', 'ow', 'primary', 'vowel_digraph', 0),
  ('wishful', 'sh', 'primary', 'consonant_digraph', 0),
  ('withdrawal', 'aw', 'primary', 'vowel_digraph', 0),
  ('wreath', 'ea', 'primary', 'long_vowel_digraph', 0),
  ('yellowish', 'ow', 'primary', 'vowel_digraph', 0),
  ('yew', 'ew', 'primary', 'long_vowel_digraph', 0);

do $$
begin
  if (select count(*) from wordloom_core_phase_8d_words) <> 250 then
    raise exception 'Wordloom core Phase 8D batch must contain exactly 250 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8d_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_8d_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_8d_word_count
  ) then
    raise exception 'Wordloom core Phase 8D target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_8d_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 8D batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_8d_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> 'wordloom_core_v1_phase_8d_2026_05_14'
  ) then
    raise exception 'Wordloom core Phase 8D batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8d_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_8d_2026_05_14'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 8D words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8d_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ) then
    raise exception 'Wordloom core Phase 8D words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8d_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ) then
    raise exception 'Wordloom core Phase 8D words contain explicit spelling-hint context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8d_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 8D words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8d_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 8D primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8d_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 8D word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8d_word_targets as word_targets
    left join wordloom_core_phase_8d_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 8D word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_8d_words as words
    left join wordloom_core_phase_8d_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 8D word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 8D structured expansion batch 3 target'
from wordloom_core_phase_8d_targets
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
    from wordloom_core_phase_8d_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 8D linked targets must exist and be active.';
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
from wordloom_core_phase_8d_words
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
  'Wordloom core v1 Phase 8D structured expansion batch 3 target link'
from wordloom_core_phase_8d_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_8d_2026_05_14'
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
      and source_version = 'wordloom_core_v1_phase_8d_2026_05_14'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 250 then
    raise exception 'Wordloom core Phase 8D persisted word count must be exactly 250.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8d_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_8d_2026_05_14'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_8d_word_count
  ) then
    raise exception 'Wordloom core Phase 8D persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 8D.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_8d_2026_05_14'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 8D persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_8d_2026_05_14'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 8D persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_8d_2026_05_14'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 8D word must have exactly one primary target link.';
  end if;
  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join wordloom_core_phase_8d_words as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core Phase 8D must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join wordloom_core_phase_8d_words as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core Phase 8D must not add rows to school spelling bank additions.';
  end if;

end $$;

commit;
