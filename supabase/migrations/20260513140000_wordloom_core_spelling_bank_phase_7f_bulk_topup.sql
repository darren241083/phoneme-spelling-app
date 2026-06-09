begin;

create temporary table wordloom_core_phase_7f_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_7f_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_7f_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_7f_word_count
)
values
  ('ai', 'ai', 'floor_core', 'needs_support', 10, 14),
  ('ee', 'ee', 'floor_core', 'needs_support', 20, 14),
  ('oa', 'oa', 'floor_core', 'needs_support', 30, 12),
  ('igh', 'igh', 'floor_core', 'core_developing', 40, 8),
  ('ar', 'ar', 'floor_core', 'core_developing', 50, 14),
  ('or', 'or', 'floor_core', 'core_developing', 60, 14),
  ('air', 'air', 'diagnostic', 'secure_expected', 70, 8),
  ('sh', 'sh', 'floor_core', 'needs_support', 140, 12),
  ('ch', 'ch', 'floor_core', 'needs_support', 150, 12),
  ('ck', 'ck', 'floor_core', 'needs_support', 180, 12),
  ('au', 'au', 'ceiling_challenge', 'secure_expected', 240, 8),
  ('ay', 'ay', 'floor_core', 'needs_support', 250, 14),
  ('ea', 'ea', 'floor_core', 'core_developing', 260, 14),
  ('ew', 'ew', 'diagnostic', 'secure_expected', 270, 8),
  ('aw', 'aw', 'diagnostic', 'secure_expected', 290, 8),
  ('tch', 'tch', 'diagnostic', 'secure_expected', 300, 8);

create temporary table wordloom_core_phase_7f_words (
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

insert into wordloom_core_phase_7f_words (
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
  ('aid', 'aid', 'ai', array['ai','d']::text[], array['ai']::text[], 'floor_core', 24, 'Easier', 'Short common ai word.', 'The guide gave aid to the new pupil.', 'Help or support given to someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('aim', 'aim', 'ai', array['ai','m']::text[], array['ai']::text[], 'floor_core', 18, 'Easier', 'Short common ai word.', 'Point carefully before you throw the beanbag.', 'To point or direct something at a place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('braid', 'braid', 'ai', array['b','r','ai','d']::text[], array['ai']::text[], 'diagnostic', 40, 'Core', 'Common ai word with 4 segment parts.', 'She tied the ribbon around her braid.', 'Hair woven into three or more parts.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('claim', 'claim', 'ai', array['c','l','ai','m']::text[], array['ai']::text[], 'diagnostic', 42, 'Core', 'Common ai word with 4 segment parts.', 'You can claim a sticker after the quiz.', 'To say that something is yours or is true.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('daily', 'daily', 'ai', array['d','ai','l','y']::text[], array['ai']::text[], 'diagnostic', 48, 'Core', 'Common ai word with 4 segment parts.', 'We do daily reading after lunch.', 'Happening every day.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('daisy', 'daisy', 'ai', array['d','ai','s','y']::text[], array['ai']::text[], 'diagnostic', 44, 'Core', 'Common ai word with 4 segment parts.', 'A daisy grew beside the path.', 'A small flower with white petals and a yellow centre.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('drain', 'drain', 'ai', array['d','r','ai','n']::text[], array['ai']::text[], 'diagnostic', 36, 'Core', 'Common ai word with 4 segment parts.', 'Water ran down the drain.', 'A pipe or hole that carries water away.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('gain', 'gain', 'ai', array['g','ai','n']::text[], array['ai']::text[], 'floor_core', 30, 'Easier', 'Common ai word with 3 segment parts.', 'You gain points for each correct answer.', 'To get more of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('grain', 'grain', 'ai', array['g','r','ai','n']::text[], array['ai']::text[], 'floor_core', 34, 'Easier', 'Common ai word with 4 segment parts.', 'A grain of rice fell on the table.', 'A tiny seed or small hard piece.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('main', 'main', 'ai', array['m','ai','n']::text[], array['ai']::text[], 'floor_core', 24, 'Easier', 'Common ai word with 3 segment parts.', 'The main gate opened at eight.', 'The most important one.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('nail', 'nail', 'ai', array['n','ai','l']::text[], array['ai']::text[], 'floor_core', 22, 'Easier', 'Common ai word with 3 segment parts.', 'One nail held the picture frame in place.', 'A small metal pin used to fasten things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('paid', 'paid', 'ai', array['p','ai','d']::text[], array['ai']::text[], 'floor_core', 26, 'Easier', 'Common ai word with 3 segment parts.', 'Mum paid for the bus ticket online.', 'Gave money for something bought.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('rail', 'rail', 'ai', array['r','ai','l']::text[], array['ai']::text[], 'floor_core', 28, 'Easier', 'Common ai word with 3 segment parts.', 'Hold the rail as you walk down the steps.', 'A bar used for support or as a track.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('raise', 'raise', 'ai', array['r','ai','s','e']::text[], array['ai']::text[], 'diagnostic', 38, 'Core', 'Common ai word with 4 segment parts.', 'Raise your hand when you are ready.', 'To lift something higher.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('agree', 'agree', 'ee', array['a','g','r','ee']::text[], array['ee']::text[], 'diagnostic', 46, 'Core', 'Common ee word with 4 segment parts.', 'The group can agree on one answer.', 'To have the same opinion.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('between', 'between', 'ee', array['b','e','t','w','ee','n']::text[], array['ee']::text[], 'diagnostic', 52, 'Core', 'Common ee word with 6 segment parts.', 'The red book sat between two green books.', 'In the space separating two things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('breeze', 'breeze', 'ee', array['b','r','ee','z','e']::text[], array['ee']::text[], 'diagnostic', 42, 'Core', 'Common ee word with 5 segment parts.', 'A cool breeze moved the curtains.', 'A gentle wind.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('feel', 'feel', 'ee', array['f','ee','l']::text[], array['ee']::text[], 'floor_core', 24, 'Easier', 'Common ee word with 3 segment parts.', 'The soft scarf can feel warm.', 'To notice through touch or emotion.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('free', 'free', 'ee', array['f','r','ee']::text[], array['ee']::text[], 'floor_core', 24, 'Easier', 'Common ee word with 3 segment parts.', 'The library card is free for pupils.', 'Costing no money.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('meet', 'meet', 'ee', array['m','ee','t']::text[], array['ee']::text[], 'floor_core', 24, 'Easier', 'Common ee word with 3 segment parts.', 'Meet me by the classroom door.', 'To come together with someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('need', 'need', 'ee', array['n','ee','d']::text[], array['ee']::text[], 'floor_core', 22, 'Easier', 'Common ee word with 3 segment parts.', 'You need a pencil for the lesson.', 'To have to have something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('see', 'see', 'ee', array['s','ee']::text[], array['ee']::text[], 'floor_core', 18, 'Easier', 'Short common ee word.', 'I can see the clock from here.', 'To notice something with your eyes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sheep', 'sheep', 'ee', array['sh','ee','p']::text[], array['ee']::text[], 'floor_core', 30, 'Easier', 'Common ee word with another multiletter segment.', 'The sheep followed the farmer into the field.', 'A farm animal with a woolly coat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sheet', 'sheet', 'ee', array['sh','ee','t']::text[], array['ee']::text[], 'floor_core', 32, 'Easier', 'Common ee word with another multiletter segment.', 'Write your name at the top of the sheet.', 'A flat piece of paper or cloth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sweep', 'sweep', 'ee', array['s','w','ee','p']::text[], array['ee']::text[], 'diagnostic', 36, 'Core', 'Common ee word with 4 segment parts.', 'Sweep the sand into a neat pile.', 'To clean a floor with a brush.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sweet', 'sweet', 'ee', array['s','w','ee','t']::text[], array['ee']::text[], 'floor_core', 34, 'Easier', 'Common ee word with 4 segment parts.', 'The apple tasted sweet and crisp.', 'Having a taste like sugar.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('teeth', 'teeth', 'ee', array['t','ee','th']::text[], array['ee']::text[], 'floor_core', 34, 'Easier', 'Common ee word with another multiletter segment.', 'Brush your teeth before bedtime.', 'The hard white parts in your mouth used for biting.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('week', 'week', 'ee', array['w','ee','k']::text[], array['ee']::text[], 'floor_core', 24, 'Easier', 'Common ee word with 3 segment parts.', 'The club meets once each week.', 'A period of seven days.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('boast', 'boast', 'oa', array['b','oa','s','t']::text[], array['oa']::text[], 'diagnostic', 40, 'Core', 'Common oa word with 4 segment parts.', 'Do not boast when you win a game.', 'To talk too proudly about yourself.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('cloak', 'cloak', 'oa', array['c','l','oa','k']::text[], array['oa']::text[], 'diagnostic', 38, 'Core', 'Common oa word with 4 segment parts.', 'The cloak hung on a wooden peg.', 'A loose coat without sleeves.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('coaster', 'coaster', 'oa', array['c','oa','s','t','er']::text[], array['oa']::text[], 'diagnostic', 50, 'Core', 'Common oa word with another multiletter segment.', 'Put the cup on a coaster.', 'A small mat placed under a cup.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('groan', 'groan', 'oa', array['g','r','oa','n']::text[], array['oa']::text[], 'diagnostic', 42, 'Core', 'Common oa word with 4 segment parts.', 'The old door gave a loud groan.', 'A low sound made by a person or thing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('load', 'load', 'oa', array['l','oa','d']::text[], array['oa']::text[], 'floor_core', 28, 'Easier', 'Common oa word with 3 segment parts.', 'The van carried a heavy load.', 'Something that is carried.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('loan', 'loan', 'oa', array['l','oa','n']::text[], array['oa']::text[], 'floor_core', 32, 'Easier', 'Common oa word with 3 segment parts.', 'The library loan lasts for two weeks.', 'Something borrowed for a time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('oak', 'oak', 'oa', array['oa','k']::text[], array['oa']::text[], 'floor_core', 22, 'Easier', 'Short common oa word.', 'The oak table felt smooth.', 'A strong tree or the wood from it.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('oatmeal', 'oatmeal', 'oa', array['oa','t','m','ea','l']::text[], array['oa']::text[], 'diagnostic', 52, 'Core', 'Common oa word with another multiletter segment.', 'Oatmeal warmed the bowl at breakfast.', 'A soft food made from oats.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('oats', 'oats', 'oa', array['oa','t','s']::text[], array['oa']::text[], 'floor_core', 24, 'Easier', 'Common oa word with 3 segment parts.', 'Oats made the breakfast warm and filling.', 'Grains used as food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('roam', 'roam', 'oa', array['r','oa','m']::text[], array['oa']::text[], 'floor_core', 34, 'Easier', 'Common oa word with 3 segment parts.', 'We can roam around the safe garden.', 'To move about without a fixed path.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('roast', 'roast', 'oa', array['r','oa','s','t']::text[], array['oa']::text[], 'diagnostic', 36, 'Core', 'Common oa word with 4 segment parts.', 'Dad made roast potatoes for dinner.', 'Cooked with dry heat in an oven.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('soak', 'soak', 'oa', array['s','oa','k']::text[], array['oa']::text[], 'floor_core', 28, 'Easier', 'Common oa word with 3 segment parts.', 'Soak the cloth in clean water.', 'To make something very wet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('daylight', 'daylight', 'igh', array['d','ay','l','igh','t']::text[], array['igh']::text[], 'diagnostic', 50, 'Core', 'Common igh word with another multiletter segment.', 'Daylight filled the room by breakfast.', 'Natural light from the sun.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('delight', 'delight', 'igh', array['d','e','l','igh','t']::text[], array['igh']::text[], 'diagnostic', 52, 'Core', 'Common igh word with 5 segment parts.', 'The puppet show brought delight to the class.', 'A feeling of great pleasure.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('highway', 'highway', 'igh', array['h','igh','w','ay']::text[], array['igh']::text[], 'diagnostic', 54, 'Core', 'Common igh word with another multiletter segment.', 'The highway curved past the town.', 'A main road for travelling.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('midnight', 'midnight', 'igh', array['m','i','d','n','igh','t']::text[], array['igh']::text[], 'ceiling_challenge', 56, 'Stretch', 'Longer igh word with several segment parts.', 'The story clock chimed at midnight.', 'Twelve o clock at night.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('mighty', 'mighty', 'igh', array['m','igh','t','y']::text[], array['igh']::text[], 'diagnostic', 48, 'Core', 'Common igh word with 4 segment parts.', 'The mighty bridge crossed the river.', 'Very strong or powerful.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('spotlight', 'spotlight', 'igh', array['s','p','o','t','l','igh','t']::text[], array['igh']::text[], 'ceiling_challenge', 62, 'Stretch', 'Longer igh word with several segment parts.', 'The singer stood in the spotlight.', 'A strong light aimed at one place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('twilight', 'twilight', 'igh', array['t','w','i','l','igh','t']::text[], array['igh']::text[], 'ceiling_challenge', 58, 'Stretch', 'Longer igh word with several segment parts.', 'The garden looked calm in twilight.', 'The soft light after sunset or before sunrise.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('upright', 'upright', 'igh', array['u','p','r','igh','t']::text[], array['igh']::text[], 'diagnostic', 44, 'Core', 'Common igh word with 5 segment parts.', 'Sit upright on the chair.', 'In a straight vertical position.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('apart', 'apart', 'ar', array['a','p','ar','t']::text[], array['ar']::text[], 'diagnostic', 42, 'Core', 'Common ar word with 4 segment parts.', 'Keep the wet paintings apart.', 'Separated from each other.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('arm', 'arm', 'ar', array['ar','m']::text[], array['ar']::text[], 'floor_core', 20, 'Easier', 'Short common ar word.', 'He lifted one arm to wave.', 'The body part from shoulder to hand.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('car', 'car', 'ar', array['c','ar']::text[], array['ar']::text[], 'floor_core', 18, 'Easier', 'Short common ar word.', 'The car stopped beside the kerb.', 'A road vehicle with wheels.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('card', 'card', 'ar', array['c','ar','d']::text[], array['ar']::text[], 'floor_core', 24, 'Easier', 'Common ar word with 3 segment parts.', 'Write your name on the card.', 'A stiff piece of paper.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('carpet', 'carpet', 'ar', array['c','ar','p','e','t']::text[], array['ar']::text[], 'diagnostic', 46, 'Core', 'Common ar word with 5 segment parts.', 'The carpet felt soft under my feet.', 'A thick covering for a floor.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('harvest', 'harvest', 'ar', array['h','ar','v','e','s','t']::text[], array['ar']::text[], 'ceiling_challenge', 58, 'Stretch', 'Longer ar word with several segment parts.', 'The harvest filled baskets with apples.', 'The time when crops are gathered.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('jar', 'jar', 'ar', array['j','ar']::text[], array['ar']::text[], 'floor_core', 22, 'Easier', 'Short common ar word.', 'The jar held coloured pencils.', 'A glass container with a wide top.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('marker', 'marker', 'ar', array['m','ar','k','er']::text[], array['ar']::text[], 'diagnostic', 48, 'Core', 'Common ar word with another multiletter segment.', 'Use a marker to label the box.', 'A pen used for writing clear marks.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('part', 'part', 'ar', array['p','ar','t']::text[], array['ar']::text[], 'floor_core', 26, 'Easier', 'Common ar word with 3 segment parts.', 'Read the first part of the story.', 'One piece of something larger.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('party', 'party', 'ar', array['p','ar','t','y']::text[], array['ar']::text[], 'diagnostic', 40, 'Core', 'Common ar word with 4 segment parts.', 'The party games made everyone laugh.', 'A happy event where people meet together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('scarf', 'scarf', 'ar', array['s','c','ar','f']::text[], array['ar']::text[], 'floor_core', 34, 'Easier', 'Common ar word with 4 segment parts.', 'The scarf kept her neck warm.', 'A piece of cloth worn around the neck.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('smart', 'smart', 'ar', array['s','m','ar','t']::text[], array['ar']::text[], 'diagnostic', 36, 'Core', 'Common ar word with 4 segment parts.', 'That was a smart way to solve it.', 'Clever or neat in appearance.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sparkle', 'sparkle', 'ar', array['s','p','ar','k','l','e']::text[], array['ar']::text[], 'ceiling_challenge', 60, 'Stretch', 'Longer ar word with several segment parts.', 'Tiny lights made the card sparkle.', 'To shine with quick flashes of light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('yard', 'yard', 'ar', array['y','ar','d']::text[], array['ar']::text[], 'floor_core', 24, 'Easier', 'Common ar word with 3 segment parts.', 'The class lined up in the yard.', 'An open area beside a building.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('border', 'border', 'or', array['b','or','d','er']::text[], array['or']::text[], 'diagnostic', 50, 'Core', 'Common or word with another multiletter segment.', 'Draw a border around the poster.', 'A line or edge around something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('cord', 'cord', 'or', array['c','or','d']::text[], array['or']::text[], 'floor_core', 30, 'Easier', 'Common or word with 3 segment parts.', 'Tie the tag with a short cord.', 'A strong thick string.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('for', 'for', 'or', array['f','or']::text[], array['or']::text[], 'floor_core', 18, 'Easier', 'Short common or word.', 'This book is for our reading table.', 'Used to show who something is meant for.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('forest', 'forest', 'or', array['f','or','e','s','t']::text[], array['or']::text[], 'diagnostic', 44, 'Core', 'Common or word with 5 segment parts.', 'The forest path was quiet.', 'A large area covered with trees.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('form', 'form', 'or', array['f','or','m']::text[], array['or']::text[], 'floor_core', 28, 'Easier', 'Common or word with 3 segment parts.', 'Fill in the form with your name.', 'A paper or screen used to collect information.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('normal', 'normal', 'or', array['n','or','m','a','l']::text[], array['or']::text[], 'diagnostic', 46, 'Core', 'Common or word with 5 segment parts.', 'It is normal to practise before a show.', 'Usual or expected.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('orbit', 'orbit', 'or', array['or','b','i','t']::text[], array['or']::text[], 'diagnostic', 48, 'Core', 'Common or word with 4 segment parts.', 'The moon follows an orbit around Earth.', 'The path one object takes around another.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('order', 'order', 'or', array['or','d','er']::text[], array['or']::text[], 'diagnostic', 42, 'Core', 'Common or word with another multiletter segment.', 'Put the cards in number order.', 'The way things are arranged.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('report', 'report', 'or', array['r','e','p','or','t']::text[], array['or']::text[], 'diagnostic', 52, 'Core', 'Common or word with 5 segment parts.', 'Write a short report about the trip.', 'A spoken or written account of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sort', 'sort', 'or', array['s','or','t']::text[], array['or']::text[], 'floor_core', 28, 'Easier', 'Common or word with 3 segment parts.', 'Sort the buttons by colour.', 'To put things into groups.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('story', 'story', 'or', array['s','t','or','y']::text[], array['or']::text[], 'floor_core', 34, 'Easier', 'Common or word with 4 segment parts.', 'The story ended with a surprise.', 'A tale about events or people.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('support', 'support', 'or', array['s','u','pp','or','t']::text[], array['or']::text[], 'ceiling_challenge', 56, 'Stretch', 'Longer or word with several segment parts.', 'The shelf needs support at both ends.', 'Help or something that holds weight.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('torn', 'torn', 'or', array['t','or','n']::text[], array['or']::text[], 'floor_core', 32, 'Easier', 'Common or word with 3 segment parts.', 'The torn page was taped carefully.', 'Ripped or split.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('worn', 'worn', 'or', array['w','or','n']::text[], array['or']::text[], 'floor_core', 32, 'Easier', 'Common or word with 3 segment parts.', 'The worn path led to the gate.', 'Used so much that it looks old.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('airfield', 'airfield', 'air', array['air','f','ie','l','d']::text[], array['air']::text[], 'diagnostic', 54, 'Core', 'Common air word with another multiletter segment.', 'The small airfield had one runway.', 'A place where aircraft can take off and land.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('airline', 'airline', 'air', array['air','l','i','n','e']::text[], array['air']::text[], 'diagnostic', 52, 'Core', 'Common air word with 5 segment parts.', 'The airline printed the ticket.', 'A company that carries people by plane.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('airplane', 'airplane', 'air', array['air','p','l','a','n','e']::text[], array['air']::text[], 'diagnostic', 48, 'Core', 'Common air word with 6 segment parts.', 'The airplane crossed the cloudy sky.', 'A vehicle with wings that flies.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('armchair', 'armchair', 'air', array['ar','m','ch','air']::text[], array['air']::text[], 'diagnostic', 46, 'Core', 'Common air word with another multiletter segment.', 'The armchair stood by the window.', 'A comfortable chair with side supports for arms.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('dairy', 'dairy', 'air', array['d','air','y']::text[], array['air']::text[], 'diagnostic', 44, 'Core', 'Common air word with 3 segment parts.', 'The dairy shelf held milk and yogurt.', 'Foods made from milk, or a place that sells them.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('fairground', 'fairground', 'air', array['f','air','g','r','ou','n','d']::text[], array['air']::text[], 'ceiling_challenge', 58, 'Stretch', 'Longer air word with several segment parts.', 'The fairground lights shone after sunset.', 'A place with rides, stalls, and games.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('hairband', 'hairband', 'air', array['h','air','b','a','n','d']::text[], array['air']::text[], 'diagnostic', 46, 'Core', 'Common air word with 6 segment parts.', 'The red hairband kept her hair tidy.', 'A band worn to hold hair back.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('staircase', 'staircase', 'air', array['s','t','air','c','a','s','e']::text[], array['air']::text[], 'diagnostic', 50, 'Core', 'Common air word with 7 segment parts.', 'The staircase led to the art room.', 'A set of stairs inside a building.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('cash', 'cash', 'sh', array['c','a','sh']::text[], array['sh']::text[], 'floor_core', 28, 'Easier', 'Common sh word with 3 segment parts.', 'The shop kept cash in a small tin.', 'Money in coins or notes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('finish', 'finish', 'sh', array['f','i','n','i','sh']::text[], array['sh']::text[], 'diagnostic', 46, 'Core', 'Common sh word with 5 segment parts.', 'Finish the puzzle before snack time.', 'To bring something to an end.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('polish', 'polish', 'sh', array['p','o','l','i','sh']::text[], array['sh']::text[], 'diagnostic', 42, 'Core', 'Common sh word with 5 segment parts.', 'Polish the table with a soft cloth.', 'To rub something until it shines.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('push', 'push', 'sh', array['p','u','sh']::text[], array['sh']::text[], 'floor_core', 28, 'Easier', 'Common sh word with 3 segment parts.', 'Push the door gently.', 'To move something away with force.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('shelf', 'shelf', 'sh', array['sh','e','l','f']::text[], array['sh']::text[], 'floor_core', 34, 'Easier', 'Common sh word with 4 segment parts.', 'The game went back on the shelf.', 'A flat board used for holding things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('shine', 'shine', 'sh', array['sh','i','n','e']::text[], array['sh']::text[], 'floor_core', 28, 'Easier', 'Common sh word with 4 segment parts.', 'The clean window will shine in the sun.', 'To give out or reflect light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('shirt', 'shirt', 'sh', array['sh','ir','t']::text[], array['sh']::text[], 'floor_core', 32, 'Easier', 'Common sh word with another multiletter segment.', 'The blue shirt was in the drawer.', 'A piece of clothing worn on the upper body.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('shoe', 'shoe', 'sh', array['sh','oe']::text[], array['sh']::text[], 'floor_core', 22, 'Easier', 'Short common sh word.', 'Put each shoe under the bench.', 'A covering worn on the foot.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('show', 'show', 'sh', array['sh','ow']::text[], array['sh']::text[], 'floor_core', 26, 'Easier', 'Short common sh word.', 'Show your picture to the group.', 'To let someone see something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('splash', 'splash', 'sh', array['s','p','l','a','sh']::text[], array['sh']::text[], 'floor_core', 34, 'Easier', 'Common sh word with 5 segment parts.', 'A splash of water landed on the tray.', 'A small amount of liquid thrown about.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sunshine', 'sunshine', 'sh', array['s','u','n','sh','i','n','e']::text[], array['sh']::text[], 'diagnostic', 52, 'Core', 'Common sh word with 7 segment parts.', 'Sunshine warmed the classroom windows.', 'Light and warmth from the sun.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('wash', 'wash', 'sh', array['w','a','sh']::text[], array['sh']::text[], 'floor_core', 28, 'Easier', 'Common sh word with 3 segment parts.', 'Wash the paint from the brush.', 'To clean with water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('chance', 'chance', 'ch', array['ch','a','n','c','e']::text[], array['ch']::text[], 'diagnostic', 42, 'Core', 'Common ch word with 5 segment parts.', 'You have a chance to try again.', 'An opportunity to do something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('change', 'change', 'ch', array['ch','a','n','g','e']::text[], array['ch']::text[], 'diagnostic', 40, 'Core', 'Common ch word with 5 segment parts.', 'Change seats after the bell.', 'To make or become different.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('check', 'check', 'ch', array['ch','e','ck']::text[], array['ch']::text[], 'floor_core', 30, 'Easier', 'Common ch word with another multiletter segment.', 'Check your bag before you leave.', 'To look carefully to make sure something is right.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('cherry', 'cherry', 'ch', array['ch','e','rr','y']::text[], array['ch']::text[], 'diagnostic', 38, 'Core', 'Common ch word with another multiletter segment.', 'A cherry sat on top of the cake.', 'A small round red fruit.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('chess', 'chess', 'ch', array['ch','e','ss']::text[], array['ch']::text[], 'floor_core', 30, 'Easier', 'Common ch word with another multiletter segment.', 'We played chess on a rainy day.', 'A board game for two players.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('chest', 'chest', 'ch', array['ch','e','s','t']::text[], array['ch']::text[], 'floor_core', 32, 'Easier', 'Common ch word with 4 segment parts.', 'The treasure chest held wooden blocks.', 'A large box with a lid.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('child', 'child', 'ch', array['ch','i','l','d']::text[], array['ch']::text[], 'floor_core', 30, 'Easier', 'Common ch word with 4 segment parts.', 'Each child chose a reading book.', 'A young person.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('children', 'children', 'ch', array['ch','i','l','d','r','e','n']::text[], array['ch']::text[], 'diagnostic', 44, 'Core', 'Common ch word with 7 segment parts.', 'The children shared the paints.', 'Young people.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('choose', 'choose', 'ch', array['ch','oo','s','e']::text[], array['ch']::text[], 'diagnostic', 38, 'Core', 'Common ch word with another multiletter segment.', 'Choose a book from the shelf.', 'To pick one thing from a group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('each', 'each', 'ch', array['ea','ch']::text[], array['ch']::text[], 'floor_core', 26, 'Easier', 'Short common ch word.', 'Each pupil had a clean cup.', 'Every one in a group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('such', 'such', 'ch', array['s','u','ch']::text[], array['ch']::text[], 'floor_core', 28, 'Easier', 'Common ch word with 3 segment parts.', 'It was such a kind note.', 'Of that kind or amount.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('which', 'which', 'ch', array['wh','i','ch']::text[], array['ch']::text[], 'floor_core', 34, 'Easier', 'Common ch word with another multiletter segment.', 'Which colour do you prefer?', 'Used to ask about one from a group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('bucket', 'bucket', 'ck', array['b','u','ck','e','t']::text[], array['ck']::text[], 'diagnostic', 40, 'Core', 'Common ck word with 5 segment parts.', 'The bucket was full of shells.', 'A round open container with a handle.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('jacket', 'jacket', 'ck', array['j','a','ck','e','t']::text[], array['ck']::text[], 'diagnostic', 40, 'Core', 'Common ck word with 5 segment parts.', 'Hang your jacket on the peg.', 'A short coat worn over clothes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('lock', 'lock', 'ck', array['l','o','ck']::text[], array['ck']::text[], 'floor_core', 22, 'Easier', 'Common ck word with 3 segment parts.', 'Lock the cupboard after art club.', 'To fasten something with a key or catch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('luck', 'luck', 'ck', array['l','u','ck']::text[], array['ck']::text[], 'floor_core', 24, 'Easier', 'Common ck word with 3 segment parts.', 'Good luck with the quiz.', 'Things happening by chance.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('pack', 'pack', 'ck', array['p','a','ck']::text[], array['ck']::text[], 'floor_core', 22, 'Easier', 'Common ck word with 3 segment parts.', 'Pack your reading book carefully.', 'To put things into a bag or box.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('packet', 'packet', 'ck', array['p','a','ck','e','t']::text[], array['ck']::text[], 'diagnostic', 42, 'Core', 'Common ck word with 5 segment parts.', 'Open the packet of cards carefully.', 'A small wrapped container or bag.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('pick', 'pick', 'ck', array['p','i','ck']::text[], array['ck']::text[], 'floor_core', 22, 'Easier', 'Common ck word with 3 segment parts.', 'Pick one card from the pile.', 'To choose something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('rocket', 'rocket', 'ck', array['r','o','ck','e','t']::text[], array['ck']::text[], 'diagnostic', 42, 'Core', 'Common ck word with 5 segment parts.', 'The paper rocket flew across the room.', 'A vehicle or model that shoots upward.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('snack', 'snack', 'ck', array['s','n','a','ck']::text[], array['ck']::text[], 'floor_core', 34, 'Easier', 'Common ck word with 4 segment parts.', 'Eat your snack at break time.', 'A small amount of food between meals.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('stick', 'stick', 'ck', array['s','t','i','ck']::text[], array['ck']::text[], 'floor_core', 30, 'Easier', 'Common ck word with 4 segment parts.', 'A stick marked the start line.', 'A thin piece of wood.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('track', 'track', 'ck', array['t','r','a','ck']::text[], array['ck']::text[], 'floor_core', 34, 'Easier', 'Common ck word with 4 segment parts.', 'The runners stayed on the track.', 'A path or course for moving along.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('truck', 'truck', 'ck', array['t','r','u','ck']::text[], array['ck']::text[], 'floor_core', 34, 'Easier', 'Common ck word with 4 segment parts.', 'The truck carried boxes to the hall.', 'A large vehicle for carrying things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('applaud', 'applaud', 'au', array['a','p','p','l','au','d']::text[], array['au']::text[], 'ceiling_challenge', 58, 'Stretch', 'Longer au word with several segment parts.', 'The class began to applaud the reader.', 'To clap to show that you enjoyed something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('audience', 'audience', 'au', array['au','d','i','e','n','c','e']::text[], array['au']::text[], 'ceiling_challenge', 62, 'Stretch', 'Longer au word with several segment parts.', 'The audience clapped after the song.', 'People watching or listening to a performance.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('audio', 'audio', 'au', array['au','d','i','o']::text[], array['au']::text[], 'ceiling_challenge', 58, 'Stretch', 'Longer au word with several segment parts.', 'The tablet played clear audio.', 'Sound that can be heard or recorded.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('august', 'august', 'au', array['au','g','u','s','t']::text[], array['au']::text[], 'ceiling_challenge', 56, 'Stretch', 'Longer au word with several segment parts.', 'August often brings warm afternoons.', 'The month after July.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('automatic', 'automatic', 'au', array['au','t','o','m','a','t','i','c']::text[], array['au']::text[], 'ceiling_challenge', 68, 'Stretch', 'Longer au word with several segment parts.', 'The automatic door opened slowly.', 'Working by itself with little help.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('because', 'because', 'au', array['b','e','c','au','s','e']::text[], array['au']::text[], 'diagnostic', 54, 'Core', 'Common au word with 6 segment parts.', 'We stayed inside because it rained.', 'For the reason that.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('dinosaur', 'dinosaur', 'au', array['d','i','n','o','s','au','r']::text[], array['au']::text[], 'ceiling_challenge', 60, 'Stretch', 'Longer au word with several segment parts.', 'The museum had a tall dinosaur model.', 'A large reptile that lived long ago.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sausage', 'sausage', 'au', array['s','au','s','a','g','e']::text[], array['au']::text[], 'ceiling_challenge', 60, 'Stretch', 'Longer au word with several segment parts.', 'The sausage roll was still warm.', 'A tube-shaped food made from seasoned meat or vegetables.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('bay', 'bay', 'ay', array['b','ay']::text[], array['ay']::text[], 'floor_core', 24, 'Easier', 'Short common ay word.', 'The boat rested in the quiet bay.', 'A part of the sea or lake surrounded by land.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('delay', 'delay', 'ay', array['d','e','l','ay']::text[], array['ay']::text[], 'diagnostic', 38, 'Core', 'Common ay word with 4 segment parts.', 'A short delay gave us time to tidy.', 'A wait before something happens.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('display', 'display', 'ay', array['d','i','s','p','l','ay']::text[], array['ay']::text[], 'diagnostic', 48, 'Core', 'Common ay word with 6 segment parts.', 'Display the posters along the wall.', 'To show something where people can see it.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('friday', 'friday', 'ay', array['f','r','i','d','ay']::text[], array['ay']::text[], 'diagnostic', 42, 'Core', 'Common ay word with 5 segment parts.', 'Friday came at the end of the school week.', 'The day after Thursday.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('hay', 'hay', 'ay', array['h','ay']::text[], array['ay']::text[], 'floor_core', 22, 'Easier', 'Short common ay word.', 'The hay was stacked in the barn.', 'Dry grass used as food for farm animals.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('holiday', 'holiday', 'ay', array['h','o','l','i','d','ay']::text[], array['ay']::text[], 'diagnostic', 50, 'Core', 'Common ay word with 6 segment parts.', 'The holiday gave us time to rest.', 'Time away from school or work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('lay', 'lay', 'ay', array['l','ay']::text[], array['ay']::text[], 'floor_core', 22, 'Easier', 'Short common ay word.', 'Lay the mat flat on the floor.', 'To put something down gently.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('maybe', 'maybe', 'ay', array['m','ay','b','e']::text[], array['ay']::text[], 'diagnostic', 36, 'Core', 'Common ay word with 4 segment parts.', 'Maybe we can read outside today.', 'A word used when something might happen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('monday', 'monday', 'ay', array['m','o','n','d','ay']::text[], array['ay']::text[], 'diagnostic', 40, 'Core', 'Common ay word with 5 segment parts.', 'Monday is the first school day of the week.', 'The day after Sunday.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('player', 'player', 'ay', array['p','l','ay','er']::text[], array['ay']::text[], 'diagnostic', 42, 'Core', 'Common ay word with another multiletter segment.', 'The player passed the ball quickly.', 'A person who takes part in a game.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('playground', 'playground', 'ay', array['p','l','ay','g','r','ou','n','d']::text[], array['ay']::text[], 'diagnostic', 54, 'Core', 'Common ay word with another multiletter segment.', 'The playground was ready for break.', 'An outdoor place for children to play.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('ray', 'ray', 'ay', array['r','ay']::text[], array['ay']::text[], 'floor_core', 22, 'Easier', 'Short common ay word.', 'A ray of sunlight crossed the table.', 'A narrow beam of light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('spray', 'spray', 'ay', array['s','p','r','ay']::text[], array['ay']::text[], 'floor_core', 34, 'Easier', 'Common ay word with 4 segment parts.', 'Spray a little water on the plant.', 'To send out tiny drops of liquid.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('yesterday', 'yesterday', 'ay', array['y','e','s','t','er','d','ay']::text[], array['ay']::text[], 'diagnostic', 54, 'Core', 'Common ay word with another multiletter segment.', 'Yesterday we planted beans.', 'The day before today.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('bean', 'bean', 'ea', array['b','ea','n']::text[], array['ea']::text[], 'floor_core', 24, 'Easier', 'Common ea word with 3 segment parts.', 'The bean sprouted in the jar.', 'A seed from a plant, often eaten as food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('feast', 'feast', 'ea', array['f','ea','s','t']::text[], array['ea']::text[], 'diagnostic', 38, 'Core', 'Common ea word with 4 segment parts.', 'The picnic felt like a small feast.', 'A large special meal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('least', 'least', 'ea', array['l','ea','s','t']::text[], array['ea']::text[], 'diagnostic', 36, 'Core', 'Common ea word with 4 segment parts.', 'Take the least heavy box first.', 'The smallest amount or lowest number.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('mean', 'mean', 'ea', array['m','ea','n']::text[], array['ea']::text[], 'floor_core', 26, 'Easier', 'Common ea word with 3 segment parts.', 'What does this word mean?', 'To have a particular idea or message.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('neat', 'neat', 'ea', array['n','ea','t']::text[], array['ea']::text[], 'floor_core', 28, 'Easier', 'Common ea word with 3 segment parts.', 'Keep your desk neat after art.', 'Tidy and in order.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('pea', 'pea', 'ea', array['p','ea']::text[], array['ea']::text[], 'floor_core', 20, 'Easier', 'Short common ea word.', 'One pea rolled across the plate.', 'A small round green seed eaten as food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('peach', 'peach', 'ea', array['p','ea','ch']::text[], array['ea']::text[], 'floor_core', 34, 'Easier', 'Common ea word with another multiletter segment.', 'A peach rolled from the bowl.', 'A soft round fruit with a stone inside.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('read', 'read', 'ea', array['r','ea','d']::text[], array['ea']::text[], 'floor_core', 26, 'Easier', 'Common ea word with 3 segment parts.', 'Read the sign before you enter.', 'To look at words and understand them.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('reason', 'reason', 'ea', array['r','ea','s','o','n']::text[], array['ea']::text[], 'diagnostic', 44, 'Core', 'Common ea word with 5 segment parts.', 'Give a reason for your answer.', 'An explanation for why something happens.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sea', 'sea', 'ea', array['s','ea']::text[], array['ea']::text[], 'floor_core', 20, 'Easier', 'Short common ea word.', 'The calm sea looked blue.', 'A large area of salty water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('seal', 'seal', 'ea', array['s','ea','l']::text[], array['ea']::text[], 'floor_core', 28, 'Easier', 'Common ea word with 3 segment parts.', 'Seal the envelope before you post it.', 'To close something tightly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('season', 'season', 'ea', array['s','ea','s','o','n']::text[], array['ea']::text[], 'diagnostic', 46, 'Core', 'Common ea word with 5 segment parts.', 'Spring is my favourite season.', 'One part of the year with its own weather.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('steam', 'steam', 'ea', array['s','t','ea','m']::text[], array['ea']::text[], 'diagnostic', 36, 'Core', 'Common ea word with 4 segment parts.', 'Steam rose from the warm soup.', 'Hot mist made when water boils.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('tea', 'tea', 'ea', array['t','ea']::text[], array['ea']::text[], 'floor_core', 20, 'Easier', 'Short common ea word.', 'Grandad poured tea into a mug.', 'A warm drink made with leaves and water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('cashew', 'cashew', 'ew', array['c','a','sh','ew']::text[], array['ew']::text[], 'ceiling_challenge', 56, 'Stretch', 'Longer ew word with several segment parts.', 'A cashew sat beside the raisins.', 'A curved nut used as food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('dew', 'dew', 'ew', array['d','ew']::text[], array['ew']::text[], 'floor_core', 28, 'Easier', 'Short common ew word.', 'Dew sparkled on the grass at morning play.', 'Tiny drops of water that form overnight.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('fewest', 'fewest', 'ew', array['f','ew','e','s','t']::text[], array['ew']::text[], 'diagnostic', 46, 'Core', 'Common ew word with 5 segment parts.', 'This jar has the fewest counters.', 'The smallest number of things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('jewel', 'jewel', 'ew', array['j','ew','e','l']::text[], array['ew']::text[], 'diagnostic', 44, 'Core', 'Common ew word with 4 segment parts.', 'The pretend crown had a red jewel.', 'A precious stone used for decoration.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('nephew', 'nephew', 'ew', array['n','e','ph','ew']::text[], array['ew']::text[], 'ceiling_challenge', 58, 'Stretch', 'Longer ew word with several segment parts.', 'My nephew likes building towers.', 'The son of your brother or sister.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('newer', 'newer', 'ew', array['n','ew','er']::text[], array['ew']::text[], 'diagnostic', 38, 'Core', 'Common ew word with another multiletter segment.', 'The newer pencil has a sharp point.', 'More recently made or bought.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('newest', 'newest', 'ew', array['n','ew','e','s','t']::text[], array['ew']::text[], 'diagnostic', 42, 'Core', 'Common ew word with 5 segment parts.', 'The newest book is on display.', 'Made or added most recently.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('renew', 'renew', 'ew', array['r','e','n','ew']::text[], array['ew']::text[], 'diagnostic', 50, 'Core', 'Common ew word with 4 segment parts.', 'Renew the library book before Friday.', 'To make something start again or last longer.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('awesome', 'awesome', 'aw', array['aw','e','s','o','m','e']::text[], array['aw']::text[], 'diagnostic', 52, 'Core', 'Common aw word with 6 segment parts.', 'The view from the hill was awesome.', 'Very good or impressive.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('awning', 'awning', 'aw', array['aw','n','i','ng']::text[], array['aw']::text[], 'diagnostic', 48, 'Core', 'Common aw word with another multiletter segment.', 'The awning made shade over the shop.', 'A cover stretched out above a door or window.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('drawer', 'drawer', 'aw', array['d','r','aw','er']::text[], array['aw']::text[], 'diagnostic', 44, 'Core', 'Common aw word with another multiletter segment.', 'The ruler was in the top drawer.', 'A sliding box in furniture used for storage.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('drawn', 'drawn', 'aw', array['d','r','aw','n']::text[], array['aw']::text[], 'diagnostic', 38, 'Core', 'Common aw word with 4 segment parts.', 'A map was drawn on the board.', 'Made as a picture with lines.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('flaw', 'flaw', 'aw', array['f','l','aw']::text[], array['aw']::text[], 'diagnostic', 42, 'Core', 'Common aw word with 3 segment parts.', 'There was one small flaw in the plan.', 'A small mistake or weak part.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('lawnmower', 'lawnmower', 'aw', array['l','aw','n','m','ow','er']::text[], array['aw']::text[], 'ceiling_challenge', 58, 'Stretch', 'Longer aw word with several segment parts.', 'The lawnmower stood beside the shed.', 'A machine used to cut grass.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sawdust', 'sawdust', 'aw', array['s','aw','d','u','s','t']::text[], array['aw']::text[], 'diagnostic', 54, 'Core', 'Common aw word with 6 segment parts.', 'Sawdust covered the workshop floor.', 'Tiny bits of wood made by cutting.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('strawberry', 'strawberry', 'aw', array['s','t','r','aw','b','e','rr','y']::text[], array['aw']::text[], 'ceiling_challenge', 60, 'Stretch', 'Longer aw word with several segment parts.', 'A strawberry topped the pudding.', 'A small red fruit with tiny seeds on the outside.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('clutch', 'clutch', 'tch', array['c','l','u','tch']::text[], array['tch']::text[], 'diagnostic', 48, 'Core', 'Common tch word with 4 segment parts.', 'Clutch the rope with both hands.', 'To hold something tightly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('kitchen', 'kitchen', 'tch', array['k','i','tch','e','n']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'Common tch word with 5 segment parts.', 'The kitchen smelled of warm bread.', 'A room where food is prepared.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('latch', 'latch', 'tch', array['l','a','tch']::text[], array['tch']::text[], 'diagnostic', 40, 'Core', 'Common tch word with 3 segment parts.', 'Lift the latch to open the gate.', 'A small fastener for a door or gate.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('matching', 'matching', 'tch', array['m','a','tch','i','ng']::text[], array['tch']::text[], 'diagnostic', 52, 'Core', 'Common tch word with another multiletter segment.', 'Find the matching sock in the basket.', 'Going well with another thing or looking the same.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('notch', 'notch', 'tch', array['n','o','tch']::text[], array['tch']::text[], 'diagnostic', 42, 'Core', 'Common tch word with 3 segment parts.', 'Cut one notch in the craft stick.', 'A small cut or mark on an edge.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('scratch', 'scratch', 'tch', array['s','c','r','a','tch']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'Common tch word with 5 segment parts.', 'Scratch a line in the damp sand.', 'To mark a surface by scraping it.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('sketch', 'sketch', 'tch', array['s','k','e','tch']::text[], array['tch']::text[], 'diagnostic', 44, 'Core', 'Common tch word with 4 segment parts.', 'Sketch the shape before you colour it.', 'To make a quick drawing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true),
  ('stretch', 'stretch', 'tch', array['s','t','r','e','tch']::text[], array['tch']::text[], 'diagnostic', 46, 'Core', 'Common tch word with 5 segment parts.', 'Stretch the string across the table.', 'To make something longer or wider by pulling.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7f_2026_05_13', true);

create temporary table wordloom_core_phase_7f_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_7f_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('agree', 'ee', 'primary', 'vowel_digraph', 0),
  ('aid', 'ai', 'primary', 'vowel_digraph', 0),
  ('aim', 'ai', 'primary', 'vowel_digraph', 0),
  ('airfield', 'air', 'primary', 'r_controlled_vowel', 0),
  ('airline', 'air', 'primary', 'r_controlled_vowel', 0),
  ('airplane', 'air', 'primary', 'r_controlled_vowel', 0),
  ('apart', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('applaud', 'au', 'primary', 'vowel_digraph', 0),
  ('arm', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('armchair', 'air', 'primary', 'r_controlled_vowel', 0),
  ('audience', 'au', 'primary', 'vowel_digraph', 0),
  ('audio', 'au', 'primary', 'vowel_digraph', 0),
  ('august', 'au', 'primary', 'vowel_digraph', 0),
  ('automatic', 'au', 'primary', 'vowel_digraph', 0),
  ('awesome', 'aw', 'primary', 'vowel_digraph', 0),
  ('awning', 'aw', 'primary', 'vowel_digraph', 0),
  ('bay', 'ay', 'primary', 'vowel_digraph', 0),
  ('bean', 'ea', 'primary', 'vowel_digraph', 0),
  ('because', 'au', 'primary', 'vowel_digraph', 0),
  ('between', 'ee', 'primary', 'vowel_digraph', 0),
  ('boast', 'oa', 'primary', 'vowel_digraph', 0),
  ('border', 'or', 'primary', 'r_controlled_vowel', 0),
  ('braid', 'ai', 'primary', 'vowel_digraph', 0),
  ('breeze', 'ee', 'primary', 'vowel_digraph', 0),
  ('bucket', 'ck', 'primary', 'consonant_digraph', 0),
  ('car', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('card', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('carpet', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('cash', 'sh', 'primary', 'consonant_digraph', 0),
  ('cashew', 'ew', 'primary', 'vowel_digraph', 0),
  ('chance', 'ch', 'primary', 'consonant_digraph', 0),
  ('change', 'ch', 'primary', 'consonant_digraph', 0),
  ('check', 'ch', 'primary', 'consonant_digraph', 0),
  ('cherry', 'ch', 'primary', 'consonant_digraph', 0),
  ('chess', 'ch', 'primary', 'consonant_digraph', 0),
  ('chest', 'ch', 'primary', 'consonant_digraph', 0),
  ('child', 'ch', 'primary', 'consonant_digraph', 0),
  ('children', 'ch', 'primary', 'consonant_digraph', 0),
  ('choose', 'ch', 'primary', 'consonant_digraph', 0),
  ('claim', 'ai', 'primary', 'vowel_digraph', 0),
  ('cloak', 'oa', 'primary', 'vowel_digraph', 0),
  ('clutch', 'tch', 'primary', 'trigraph', 0),
  ('coaster', 'oa', 'primary', 'vowel_digraph', 0),
  ('cord', 'or', 'primary', 'r_controlled_vowel', 0),
  ('daily', 'ai', 'primary', 'vowel_digraph', 0),
  ('dairy', 'air', 'primary', 'r_controlled_vowel', 0),
  ('daisy', 'ai', 'primary', 'vowel_digraph', 0),
  ('daylight', 'igh', 'primary', 'trigraph', 0),
  ('delay', 'ay', 'primary', 'vowel_digraph', 0),
  ('delight', 'igh', 'primary', 'trigraph', 0),
  ('dew', 'ew', 'primary', 'vowel_digraph', 0),
  ('dinosaur', 'au', 'primary', 'vowel_digraph', 0),
  ('display', 'ay', 'primary', 'vowel_digraph', 0),
  ('drain', 'ai', 'primary', 'vowel_digraph', 0),
  ('drawer', 'aw', 'primary', 'vowel_digraph', 0),
  ('drawn', 'aw', 'primary', 'vowel_digraph', 0),
  ('each', 'ch', 'primary', 'consonant_digraph', 0),
  ('fairground', 'air', 'primary', 'r_controlled_vowel', 0),
  ('feast', 'ea', 'primary', 'vowel_digraph', 0),
  ('feel', 'ee', 'primary', 'vowel_digraph', 0),
  ('fewest', 'ew', 'primary', 'vowel_digraph', 0),
  ('finish', 'sh', 'primary', 'consonant_digraph', 0),
  ('flaw', 'aw', 'primary', 'vowel_digraph', 0),
  ('for', 'or', 'primary', 'r_controlled_vowel', 0),
  ('forest', 'or', 'primary', 'r_controlled_vowel', 0),
  ('form', 'or', 'primary', 'r_controlled_vowel', 0),
  ('free', 'ee', 'primary', 'vowel_digraph', 0),
  ('friday', 'ay', 'primary', 'vowel_digraph', 0),
  ('gain', 'ai', 'primary', 'vowel_digraph', 0),
  ('grain', 'ai', 'primary', 'vowel_digraph', 0),
  ('groan', 'oa', 'primary', 'vowel_digraph', 0),
  ('hairband', 'air', 'primary', 'r_controlled_vowel', 0),
  ('harvest', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('hay', 'ay', 'primary', 'vowel_digraph', 0),
  ('highway', 'igh', 'primary', 'trigraph', 0),
  ('holiday', 'ay', 'primary', 'vowel_digraph', 0),
  ('jacket', 'ck', 'primary', 'consonant_digraph', 0),
  ('jar', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('jewel', 'ew', 'primary', 'vowel_digraph', 0),
  ('kitchen', 'tch', 'primary', 'trigraph', 0),
  ('latch', 'tch', 'primary', 'trigraph', 0),
  ('lawnmower', 'aw', 'primary', 'vowel_digraph', 0),
  ('lay', 'ay', 'primary', 'vowel_digraph', 0),
  ('least', 'ea', 'primary', 'vowel_digraph', 0),
  ('load', 'oa', 'primary', 'vowel_digraph', 0),
  ('loan', 'oa', 'primary', 'vowel_digraph', 0),
  ('lock', 'ck', 'primary', 'consonant_digraph', 0),
  ('luck', 'ck', 'primary', 'consonant_digraph', 0),
  ('main', 'ai', 'primary', 'vowel_digraph', 0),
  ('marker', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('matching', 'tch', 'primary', 'trigraph', 0),
  ('maybe', 'ay', 'primary', 'vowel_digraph', 0),
  ('mean', 'ea', 'primary', 'vowel_digraph', 0),
  ('meet', 'ee', 'primary', 'vowel_digraph', 0),
  ('midnight', 'igh', 'primary', 'trigraph', 0),
  ('mighty', 'igh', 'primary', 'trigraph', 0),
  ('monday', 'ay', 'primary', 'vowel_digraph', 0),
  ('nail', 'ai', 'primary', 'vowel_digraph', 0),
  ('neat', 'ea', 'primary', 'vowel_digraph', 0),
  ('need', 'ee', 'primary', 'vowel_digraph', 0),
  ('nephew', 'ew', 'primary', 'vowel_digraph', 0),
  ('newer', 'ew', 'primary', 'vowel_digraph', 0),
  ('newest', 'ew', 'primary', 'vowel_digraph', 0),
  ('normal', 'or', 'primary', 'r_controlled_vowel', 0),
  ('notch', 'tch', 'primary', 'trigraph', 0),
  ('oak', 'oa', 'primary', 'vowel_digraph', 0),
  ('oatmeal', 'oa', 'primary', 'vowel_digraph', 0),
  ('oats', 'oa', 'primary', 'vowel_digraph', 0),
  ('orbit', 'or', 'primary', 'r_controlled_vowel', 0),
  ('order', 'or', 'primary', 'r_controlled_vowel', 0),
  ('pack', 'ck', 'primary', 'consonant_digraph', 0),
  ('packet', 'ck', 'primary', 'consonant_digraph', 0),
  ('paid', 'ai', 'primary', 'vowel_digraph', 0),
  ('part', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('party', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('pea', 'ea', 'primary', 'vowel_digraph', 0),
  ('peach', 'ea', 'primary', 'vowel_digraph', 0),
  ('pick', 'ck', 'primary', 'consonant_digraph', 0),
  ('player', 'ay', 'primary', 'vowel_digraph', 0),
  ('playground', 'ay', 'primary', 'vowel_digraph', 0),
  ('polish', 'sh', 'primary', 'consonant_digraph', 0),
  ('push', 'sh', 'primary', 'consonant_digraph', 0),
  ('rail', 'ai', 'primary', 'vowel_digraph', 0),
  ('raise', 'ai', 'primary', 'vowel_digraph', 0),
  ('ray', 'ay', 'primary', 'vowel_digraph', 0),
  ('read', 'ea', 'primary', 'vowel_digraph', 0),
  ('reason', 'ea', 'primary', 'vowel_digraph', 0),
  ('renew', 'ew', 'primary', 'vowel_digraph', 0),
  ('report', 'or', 'primary', 'r_controlled_vowel', 0),
  ('roam', 'oa', 'primary', 'vowel_digraph', 0),
  ('roast', 'oa', 'primary', 'vowel_digraph', 0),
  ('rocket', 'ck', 'primary', 'consonant_digraph', 0),
  ('sausage', 'au', 'primary', 'vowel_digraph', 0),
  ('sawdust', 'aw', 'primary', 'vowel_digraph', 0),
  ('scarf', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('scratch', 'tch', 'primary', 'trigraph', 0),
  ('sea', 'ea', 'primary', 'vowel_digraph', 0),
  ('seal', 'ea', 'primary', 'vowel_digraph', 0),
  ('season', 'ea', 'primary', 'vowel_digraph', 0),
  ('see', 'ee', 'primary', 'vowel_digraph', 0),
  ('sheep', 'ee', 'primary', 'vowel_digraph', 0),
  ('sheet', 'ee', 'primary', 'vowel_digraph', 0),
  ('shelf', 'sh', 'primary', 'consonant_digraph', 0),
  ('shine', 'sh', 'primary', 'consonant_digraph', 0),
  ('shirt', 'sh', 'primary', 'consonant_digraph', 0),
  ('shoe', 'sh', 'primary', 'consonant_digraph', 0),
  ('show', 'sh', 'primary', 'consonant_digraph', 0),
  ('sketch', 'tch', 'primary', 'trigraph', 0),
  ('smart', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('snack', 'ck', 'primary', 'consonant_digraph', 0),
  ('soak', 'oa', 'primary', 'vowel_digraph', 0),
  ('sort', 'or', 'primary', 'r_controlled_vowel', 0),
  ('sparkle', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('splash', 'sh', 'primary', 'consonant_digraph', 0),
  ('spotlight', 'igh', 'primary', 'trigraph', 0),
  ('spray', 'ay', 'primary', 'vowel_digraph', 0),
  ('staircase', 'air', 'primary', 'r_controlled_vowel', 0),
  ('steam', 'ea', 'primary', 'vowel_digraph', 0),
  ('stick', 'ck', 'primary', 'consonant_digraph', 0),
  ('story', 'or', 'primary', 'r_controlled_vowel', 0),
  ('strawberry', 'aw', 'primary', 'vowel_digraph', 0),
  ('stretch', 'tch', 'primary', 'trigraph', 0),
  ('such', 'ch', 'primary', 'consonant_digraph', 0),
  ('sunshine', 'sh', 'primary', 'consonant_digraph', 0),
  ('support', 'or', 'primary', 'r_controlled_vowel', 0),
  ('sweep', 'ee', 'primary', 'vowel_digraph', 0),
  ('sweet', 'ee', 'primary', 'vowel_digraph', 0),
  ('tea', 'ea', 'primary', 'vowel_digraph', 0),
  ('teeth', 'ee', 'primary', 'vowel_digraph', 0),
  ('torn', 'or', 'primary', 'r_controlled_vowel', 0),
  ('track', 'ck', 'primary', 'consonant_digraph', 0),
  ('truck', 'ck', 'primary', 'consonant_digraph', 0),
  ('twilight', 'igh', 'primary', 'trigraph', 0),
  ('upright', 'igh', 'primary', 'trigraph', 0),
  ('wash', 'sh', 'primary', 'consonant_digraph', 0),
  ('week', 'ee', 'primary', 'vowel_digraph', 0),
  ('which', 'ch', 'primary', 'consonant_digraph', 0),
  ('worn', 'or', 'primary', 'r_controlled_vowel', 0),
  ('yard', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('yesterday', 'ay', 'primary', 'vowel_digraph', 0);

do $$
begin
  if (select count(*) from wordloom_core_phase_7f_words) <> 180 then
    raise exception 'Wordloom core Phase 7F batch must contain exactly 180 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7f_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_7f_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_7f_word_count
  ) then
    raise exception 'Wordloom core Phase 7F target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_7f_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 7F batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_7f_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> 'wordloom_core_v1_phase_7f_2026_05_13'
  ) then
    raise exception 'Wordloom core Phase 7F batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7f_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_7f_2026_05_13'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 7F words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7f_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ) then
    raise exception 'Wordloom core Phase 7F words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7f_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ) then
    raise exception 'Wordloom core Phase 7F words contain explicit spelling-hint context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7f_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 7F words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7f_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 7F primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7f_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 7F word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7f_word_targets as word_targets
    left join wordloom_core_phase_7f_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 7F word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_7f_words as words
    left join wordloom_core_phase_7f_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 7F word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 7F bulk common-target strengthening batch target'
from wordloom_core_phase_7f_targets
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
    from wordloom_core_phase_7f_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 7F linked targets must exist and be active.';
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
from wordloom_core_phase_7f_words
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
  'Wordloom core v1 Phase 7F bulk common-target strengthening batch target link'
from wordloom_core_phase_7f_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_7f_2026_05_13'
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
      and source_version = 'wordloom_core_v1_phase_7f_2026_05_13'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 180 then
    raise exception 'Wordloom core Phase 7F persisted word count must be exactly 180.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7f_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_7f_2026_05_13'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_7f_word_count
  ) then
    raise exception 'Wordloom core Phase 7F persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 7F.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_7f_2026_05_13'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 7F persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_7f_2026_05_13'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 7F persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_7f_2026_05_13'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 7F word must have exactly one primary target link.';
  end if;
  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join wordloom_core_phase_7f_words as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core Phase 7F must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join wordloom_core_phase_7f_words as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core Phase 7F must not add rows to school spelling bank additions.';
  end if;

end $$;

commit;
