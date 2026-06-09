begin;

create temporary table wordloom_core_phase_8c_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_8c_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_8c_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_8c_word_count
)
values
  ('air', 'air', 'diagnostic', 'secure_expected', 70, 16),
  ('aw', 'aw', 'diagnostic', 'secure_expected', 290, 16),
  ('ew', 'ew', 'diagnostic', 'secure_expected', 270, 16),
  ('igh', 'igh', 'floor_core', 'core_developing', 40, 16),
  ('tion', 'tion', 'ceiling_challenge', 'early_stretch', 200, 16),
  ('ck', 'ck', 'floor_core', 'needs_support', 180, 14),
  ('oa', 'oa', 'floor_core', 'needs_support', 30, 14),
  ('ur', 'ur', 'diagnostic', 'secure_expected', 210, 14),
  ('ch', 'ch', 'floor_core', 'needs_support', 150, 12),
  ('ng', 'ng', 'floor_core', 'core_developing', 170, 12),
  ('ou', 'ou', 'floor_core', 'core_developing', 120, 12),
  ('ow', 'ow', 'floor_core', 'core_developing', 130, 12),
  ('sh', 'sh', 'floor_core', 'needs_support', 140, 12),
  ('ai', 'ai', 'floor_core', 'needs_support', 10, 10),
  ('ay', 'ay', 'floor_core', 'needs_support', 250, 10),
  ('ee', 'ee', 'floor_core', 'needs_support', 20, 10),
  ('or', 'or', 'floor_core', 'core_developing', 60, 10),
  ('th', 'th', 'floor_core', 'core_developing', 160, 10),
  ('ar', 'ar', 'floor_core', 'core_developing', 50, 6),
  ('ea', 'ea', 'floor_core', 'core_developing', 260, 6),
  ('er', 'er', 'diagnostic', 'secure_expected', 90, 6);

create temporary table wordloom_core_phase_8c_words (
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

insert into wordloom_core_phase_8c_words (
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
  ('airspace', 'airspace', 'air', array['air','s','p','a','c','e']::text[], array['air']::text[], 'diagnostic', 50, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The kite drifted into open airspace.', 'The area of sky above a place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('airbag', 'airbag', 'air', array['air','b','a','g']::text[], array['air']::text[], 'diagnostic', 44, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The car had an airbag for safety.', 'A safety bag that fills with air in a crash.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('aircraft', 'aircraft', 'air', array['air','c','r','a','f','t']::text[], array['air']::text[], 'diagnostic', 52, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The aircraft flew above the clouds.', 'A machine that can fly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('airlift', 'airlift', 'air', array['air','l','i','f','t']::text[], array['air']::text[], 'diagnostic', 50, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The rescue team planned an airlift.', 'Moving people or supplies by aircraft.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('airless', 'airless', 'air', array['air','l','e','s','s']::text[], array['air']::text[], 'diagnostic', 48, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The sealed jar seemed airless inside.', 'Without fresh air.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('hairless', 'hairless', 'air', array['h','air','l','e','s','s']::text[], array['air']::text[], 'diagnostic', 48, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The hairless patch on the toy was smooth.', 'Having no hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('hairnet', 'hairnet', 'air', array['h','air','n','e','t']::text[], array['air']::text[], 'diagnostic', 46, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The cook wore a hairnet in the kitchen.', 'A fine net worn over hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('hairline', 'hairline', 'air', array['h','air','l','i','n','e']::text[], array['air']::text[], 'diagnostic', 50, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'A tiny crack made a hairline mark.', 'Very thin, like a single hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('hairspray', 'hairspray', 'air', array['h','air','s','p','r','ay']::text[], array['air']::text[], 'diagnostic', 52, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'Hairspray held the dancer''s bun in place.', 'A spray used to keep hair tidy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('hairdresser', 'hairdresser', 'air', array['h','air','d','r','e','s','s','er']::text[], array['air']::text[], 'diagnostic', 56, 'Stretch', 'Stretch air word selected for Phase 8C structured coverage.', 'The hairdresser trimmed the fringe neatly.', 'A person who cuts and styles hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('fairway', 'fairway', 'air', array['f','air','w','ay']::text[], array['air']::text[], 'diagnostic', 50, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The ball rolled along the fairway.', 'The short grass area on a golf course.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('unfairly', 'unfairly', 'air', array['u','n','f','air','l','y']::text[], array['air']::text[], 'diagnostic', 54, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The points were shared unfairly at first.', 'In a way that is not fair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('chairperson', 'chairperson', 'air', array['ch','air','p','er','s','o','n']::text[], array['air']::text[], 'diagnostic', 58, 'Stretch', 'Stretch air word selected for Phase 8C structured coverage.', 'The chairperson opened the meeting.', 'The person who leads a meeting or group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('wheelchair', 'wheelchair', 'air', array['w','h','ee','l','ch','air']::text[], array['air']::text[], 'diagnostic', 54, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The ramp helped the wheelchair reach the door.', 'A chair with wheels used for moving around.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('pairing', 'pairing', 'air', array['p','air','i','ng']::text[], array['air']::text[], 'diagnostic', 48, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The pairing worked well for partner reading.', 'Putting two people or things together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('stairway', 'stairway', 'air', array['s','t','air','w','ay']::text[], array['air']::text[], 'diagnostic', 52, 'Core', 'Core air word selected for Phase 8C structured coverage.', 'The stairway led to the library balcony.', 'A set of stairs and the space around it.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('hawk', 'hawk', 'aw', array['h','aw','k']::text[], array['aw']::text[], 'diagnostic', 42, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'A hawk circled high above the field.', 'A bird that hunts small animals.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('fawn', 'fawn', 'aw', array['f','aw','n']::text[], array['aw']::text[], 'diagnostic', 40, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'A fawn stood quietly near the trees.', 'A young deer.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('spawn', 'spawn', 'aw', array['s','p','aw','n']::text[], array['aw']::text[], 'diagnostic', 46, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The pond held spawn in spring.', 'Eggs laid by some water animals.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('prawn', 'prawn', 'aw', array['p','r','aw','n']::text[], array['aw']::text[], 'diagnostic', 44, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'A prawn was added to the rice dish.', 'A small shellfish often eaten as food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('jawbone', 'jawbone', 'aw', array['j','aw','b','o','n','e']::text[], array['aw']::text[], 'diagnostic', 50, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The model showed the jawbone clearly.', 'The bone that forms the jaw.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('lawless', 'lawless', 'aw', array['l','aw','l','e','s','s']::text[], array['aw']::text[], 'diagnostic', 52, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The story described a lawless town.', 'Not controlled by rules or laws.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('lawful', 'lawful', 'aw', array['l','aw','f','u','l']::text[], array['aw']::text[], 'diagnostic', 50, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The lawful choice followed the rules.', 'Allowed by law.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('outlaw', 'outlaw', 'aw', array['ou','t','l','aw']::text[], array['aw']::text[], 'diagnostic', 52, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The tale followed an outlaw on the run.', 'A person who has broken the law.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('withdraw', 'withdraw', 'aw', array['w','i','th','d','r','aw']::text[], array['aw']::text[], 'diagnostic', 56, 'Stretch', 'Stretch aw word selected for Phase 8C structured coverage.', 'You may withdraw the card after reading it.', 'To take something back or away.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('drawback', 'drawback', 'aw', array['d','r','aw','b','a','ck']::text[], array['aw']::text[], 'diagnostic', 54, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The only drawback was the long walk.', 'A problem or disadvantage.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('sawmill', 'sawmill', 'aw', array['s','aw','m','i','ll']::text[], array['aw']::text[], 'diagnostic', 50, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The old sawmill stood by the river.', 'A place where logs are cut into wood.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('seesawed', 'seesawed', 'aw', array['s','ee','s','aw','e','d']::text[], array['aw']::text[], 'diagnostic', 50, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The board seesawed in the playground.', 'Moved up and down from side to side.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('crawling', 'crawling', 'aw', array['c','r','aw','l','i','ng']::text[], array['aw']::text[], 'diagnostic', 48, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The baby was crawling across the mat.', 'Moving on hands and knees.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('crawler', 'crawler', 'aw', array['c','r','aw','l','er']::text[], array['aw']::text[], 'diagnostic', 50, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The crawler moved slowly through the grass.', 'A person or thing that crawls.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('brawny', 'brawny', 'aw', array['b','r','aw','n','y']::text[], array['aw']::text[], 'diagnostic', 52, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'The brawny helper lifted the heavy box.', 'Strong and muscular.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('squawk', 'squawk', 'aw', array['s','qu','aw','k']::text[], array['aw']::text[], 'diagnostic', 50, 'Core', 'Core aw word selected for Phase 8C structured coverage.', 'A loud squawk came from the garden.', 'A harsh cry or loud complaint.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('pew', 'pew', 'ew', array['p','ew']::text[], array['ew']::text[], 'diagnostic', 38, 'Easier', 'Easier ew word selected for Phase 8C structured coverage.', 'The family sat on a wooden pew.', 'A long seat in a church or hall.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('newt', 'newt', 'ew', array['n','ew','t']::text[], array['ew']::text[], 'diagnostic', 40, 'Easier', 'Easier ew word selected for Phase 8C structured coverage.', 'A newt hid under the wet leaves.', 'A small creature like a lizard that lives near water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('curfew', 'curfew', 'ew', array['c','ur','f','ew']::text[], array['ew']::text[], 'diagnostic', 50, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'The camp had a curfew after sunset.', 'A set time when people must be indoors.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('mildew', 'mildew', 'ew', array['m','i','l','d','ew']::text[], array['ew']::text[], 'diagnostic', 52, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'Mildew marked the damp wall.', 'A thin growth that appears in damp places.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('dewy', 'dewy', 'ew', array['d','ew','y']::text[], array['ew']::text[], 'diagnostic', 42, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'The dewy grass sparkled in the morning.', 'Wet with tiny drops of water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('newsagent', 'newsagent', 'ew', array['n','ew','s','a','g','e','n','t']::text[], array['ew']::text[], 'diagnostic', 56, 'Stretch', 'Stretch ew word selected for Phase 8C structured coverage.', 'The newsagent sold magazines and cards.', 'A shop that sells newspapers and small items.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('newsroom', 'newsroom', 'ew', array['n','ew','s','r','oo','m']::text[], array['ew']::text[], 'diagnostic', 54, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'The newsroom prepared the school report.', 'A place where news is written or produced.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('newsprint', 'newsprint', 'ew', array['n','ew','s','p','r','i','n','t']::text[], array['ew']::text[], 'diagnostic', 56, 'Stretch', 'Stretch ew word selected for Phase 8C structured coverage.', 'The sketch was made on newsprint paper.', 'Thin paper often used for newspapers.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('renewed', 'renewed', 'ew', array['r','e','n','ew','e','d']::text[], array['ew']::text[], 'diagnostic', 50, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'The club renewed its library card.', 'Made valid or fresh again.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('renewing', 'renewing', 'ew', array['r','e','n','ew','i','ng']::text[], array['ew']::text[], 'diagnostic', 52, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'Renewing the pass took only a minute.', 'Making something valid again.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('renewable', 'renewable', 'ew', array['r','e','n','ew','a','b','l','e']::text[], array['ew']::text[], 'diagnostic', 58, 'Stretch', 'Stretch ew word selected for Phase 8C structured coverage.', 'Wind is a renewable source of power.', 'Able to be replaced naturally.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('chewed', 'chewed', 'ew', array['ch','ew','e','d']::text[], array['ew']::text[], 'diagnostic', 42, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'The puppy chewed the old slipper.', 'Bit something many times.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('chewing', 'chewing', 'ew', array['ch','ew','i','ng']::text[], array['ew']::text[], 'diagnostic', 44, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'Chewing carefully helps at lunchtime.', 'Biting food until it is ready to swallow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('screwed', 'screwed', 'ew', array['s','c','r','ew','e','d']::text[], array['ew']::text[], 'diagnostic', 50, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'The shelf was screwed to the wall.', 'Fixed with screws.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('screwing', 'screwing', 'ew', array['s','c','r','ew','i','ng']::text[], array['ew']::text[], 'diagnostic', 52, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'He was screwing the lid on tightly.', 'Turning something so it fastens.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('brewer', 'brewer', 'ew', array['b','r','ew','er']::text[], array['ew']::text[], 'diagnostic', 52, 'Core', 'Core ew word selected for Phase 8C structured coverage.', 'The brewer made ginger beer for the fair.', 'A person who makes brewed drinks.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('fright', 'fright', 'igh', array['f','r','igh','t']::text[], array['igh']::text[], 'floor_core', 42, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'The sudden noise gave me a fright.', 'A feeling of fear or shock.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('frighten', 'frighten', 'igh', array['f','r','igh','t','e','n']::text[], array['igh']::text[], 'floor_core', 48, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'The loud bang did not frighten the class.', 'To make someone feel afraid.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('frightened', 'frightened', 'igh', array['f','r','igh','t','e','n','e','d']::text[], array['igh']::text[], 'floor_core', 52, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'The frightened child held the teacher''s hand.', 'Feeling afraid or shocked.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('lightning', 'lightning', 'igh', array['l','igh','t','n','i','ng']::text[], array['igh']::text[], 'floor_core', 52, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'Lightning flashed during the storm.', 'A bright flash of electricity in the sky.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('lighthouse', 'lighthouse', 'igh', array['l','igh','t','h','ou','s','e']::text[], array['igh']::text[], 'floor_core', 54, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'The lighthouse guided ships at night.', 'A tall tower with a warning light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('highland', 'highland', 'igh', array['h','igh','l','a','n','d']::text[], array['igh']::text[], 'floor_core', 50, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'The highland path crossed open hills.', 'High land or an upland area.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('highness', 'highness', 'igh', array['h','igh','n','e','s','s']::text[], array['igh']::text[], 'floor_core', 50, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'The highness of the shelf surprised me.', 'The state of being high.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('tighten', 'tighten', 'igh', array['t','igh','t','e','n']::text[], array['igh']::text[], 'floor_core', 48, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'Please tighten the loose strap.', 'To make something tighter.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('rightful', 'rightful', 'igh', array['r','igh','t','f','u','l']::text[], array['igh']::text[], 'floor_core', 52, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'The trophy went to its rightful owner.', 'Fairly or properly belonging to someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('eyesight', 'eyesight', 'igh', array['eye','s','igh','t']::text[], array['igh']::text[], 'floor_core', 54, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'Good eyesight helps with reading signs.', 'The ability to see.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('nightlight', 'nightlight', 'igh', array['n','igh','t','l','igh','t']::text[], array['igh']::text[], 'floor_core', 50, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'A nightlight glowed beside the bed.', 'A small light left on at night.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('nightdress', 'nightdress', 'igh', array['n','igh','t','d','r','e','s','s']::text[], array['igh']::text[], 'floor_core', 50, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'The nightdress was folded on the chair.', 'Loose clothing worn for sleeping.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('nightshirt', 'nightshirt', 'igh', array['n','igh','t','sh','ir','t']::text[], array['igh']::text[], 'floor_core', 50, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'The nightshirt had blue stripes.', 'A long shirt worn for sleeping.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('highlighter', 'highlighter', 'igh', array['h','igh','l','igh','t','er']::text[], array['igh']::text[], 'floor_core', 56, 'Stretch', 'Stretch igh word selected for Phase 8C structured coverage.', 'Use a highlighter to mark the key word.', 'A pen used to mark important text.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('insight', 'insight', 'igh', array['i','n','s','igh','t']::text[], array['igh']::text[], 'floor_core', 54, 'Core', 'Core igh word selected for Phase 8C structured coverage.', 'The discussion gave us new insight.', 'A clear understanding of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('oversight', 'oversight', 'igh', array['o','v','er','s','igh','t']::text[], array['igh']::text[], 'floor_core', 58, 'Stretch', 'Stretch igh word selected for Phase 8C structured coverage.', 'Leaving the label off was an oversight.', 'A mistake made by forgetting to notice something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('connection', 'connection', 'tion', array['c','o','nn','e','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 58, 'Core', 'Core tion word selected for Phase 8C structured coverage.', 'The train connection saved time.', 'A link between people, places, or things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('caption', 'caption', 'tion', array['c','a','p','tion']::text[], array['tion']::text[], 'ceiling_challenge', 56, 'Core', 'Core tion word selected for Phase 8C structured coverage.', 'Write a caption under the picture.', 'Short text that explains a picture.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('location', 'location', 'tion', array['l','o','c','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 58, 'Core', 'Core tion word selected for Phase 8C structured coverage.', 'The map showed the exact location.', 'The place where something is.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('donation', 'donation', 'tion', array['d','o','n','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 58, 'Core', 'Core tion word selected for Phase 8C structured coverage.', 'The donation helped buy new books.', 'Something given to help a person or group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('election', 'election', 'tion', array['e','l','e','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 58, 'Core', 'Core tion word selected for Phase 8C structured coverage.', 'The school held an election for council.', 'A vote to choose someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('function', 'function', 'tion', array['f','u','n','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 58, 'Core', 'Core tion word selected for Phase 8C structured coverage.', 'The button had one clear function.', 'The job or purpose of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('fraction', 'fraction', 'tion', array['f','r','a','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch tion word selected for Phase 8C structured coverage.', 'A fraction shows part of a whole.', 'A number that names part of a whole.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('reaction', 'reaction', 'tion', array['r','e','a','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch tion word selected for Phase 8C structured coverage.', 'Her reaction was a wide smile.', 'What someone does or feels in response.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('protection', 'protection', 'tion', array['p','r','o','t','e','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8C structured coverage.', 'The helmet gave protection during cycling.', 'Something that keeps people or things safe.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('reflection', 'reflection', 'tion', array['r','e','f','l','e','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8C structured coverage.', 'The lake showed a clear reflection.', 'An image seen in a shiny surface.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('selection', 'selection', 'tion', array['s','e','l','e','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8C structured coverage.', 'The library had a wide selection of books.', 'A group of things chosen from a larger set.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('pollution', 'pollution', 'tion', array['p','o','ll','u','tion']::text[], array['tion']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch tion word selected for Phase 8C structured coverage.', 'The poster warned about river pollution.', 'Dirt or waste that harms air, water, or land.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('population', 'population', 'tion', array['p','o','p','u','l','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 64, 'Stretch', 'Stretch tion word selected for Phase 8C structured coverage.', 'The town''s population grew each year.', 'The number of people living in a place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('operation', 'operation', 'tion', array['o','p','er','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8C structured coverage.', 'The rescue operation finished safely.', 'An organised activity or piece of work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('tradition', 'tradition', 'tion', array['t','r','a','d','i','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch tion word selected for Phase 8C structured coverage.', 'The school kept a harvest tradition.', 'A custom passed on over time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('nutrition', 'nutrition', 'tion', array['n','u','t','r','i','tion']::text[], array['tion']::text[], 'ceiling_challenge', 64, 'Stretch', 'Stretch tion word selected for Phase 8C structured coverage.', 'Good nutrition helps pupils stay active.', 'The food and care the body needs to grow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('sick', 'sick', 'ck', array['s','i','ck']::text[], array['ck']::text[], 'floor_core', 22, 'Easier', 'Easier ck word selected for Phase 8C structured coverage.', 'Jay felt sick before breakfast.', 'Feeling unwell.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('lick', 'lick', 'ck', array['l','i','ck']::text[], array['ck']::text[], 'floor_core', 22, 'Easier', 'Easier ck word selected for Phase 8C structured coverage.', 'The stamp needed a quick lick.', 'To touch something with the tongue.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('rack', 'rack', 'ck', array['r','a','ck']::text[], array['ck']::text[], 'floor_core', 24, 'Easier', 'Easier ck word selected for Phase 8C structured coverage.', 'Put the coats on the rack.', 'A frame or stand for holding things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('tack', 'tack', 'ck', array['t','a','ck']::text[], array['ck']::text[], 'floor_core', 24, 'Easier', 'Easier ck word selected for Phase 8C structured coverage.', 'A tack held the notice in place.', 'A small sharp pin.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('muck', 'muck', 'ck', array['m','u','ck']::text[], array['ck']::text[], 'floor_core', 24, 'Easier', 'Easier ck word selected for Phase 8C structured coverage.', 'Muck stuck to the boots after the walk.', 'Wet dirt or mud.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('tucked', 'tucked', 'ck', array['t','u','ck','e','d']::text[], array['ck']::text[], 'floor_core', 30, 'Easier', 'Easier ck word selected for Phase 8C structured coverage.', 'She tucked the note inside the book.', 'Put something neatly into a small space.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('locking', 'locking', 'ck', array['l','o','ck','i','ng']::text[], array['ck']::text[], 'floor_core', 34, 'Core', 'Core ck word selected for Phase 8C structured coverage.', 'Locking the gate kept the garden safe.', 'Closing something with a lock.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('rocking', 'rocking', 'ck', array['r','o','ck','i','ng']::text[], array['ck']::text[], 'floor_core', 34, 'Core', 'Core ck word selected for Phase 8C structured coverage.', 'The chair was rocking gently.', 'Moving backwards and forwards.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('trickle', 'trickle', 'ck', array['t','r','i','ck','l','e']::text[], array['ck']::text[], 'floor_core', 36, 'Core', 'Core ck word selected for Phase 8C structured coverage.', 'A trickle of water ran down the path.', 'A small slow flow of liquid.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('knock', 'knock', 'ck', array['k','n','o','ck']::text[], array['ck']::text[], 'floor_core', 32, 'Easier', 'Easier ck word selected for Phase 8C structured coverage.', 'Knock on the door before entering.', 'To hit a door lightly to get attention.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('locker', 'locker', 'ck', array['l','o','ck','er']::text[], array['ck']::text[], 'floor_core', 36, 'Core', 'Core ck word selected for Phase 8C structured coverage.', 'The locker held her sports kit.', 'A small cupboard that can be locked.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('cricket', 'cricket', 'ck', array['c','r','i','ck','e','t']::text[], array['ck']::text[], 'floor_core', 38, 'Core', 'Core ck word selected for Phase 8C structured coverage.', 'Cricket practice began after school.', 'A bat-and-ball team game.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('lucky', 'lucky', 'ck', array['l','u','ck','y']::text[], array['ck']::text[], 'floor_core', 32, 'Easier', 'Easier ck word selected for Phase 8C structured coverage.', 'The lucky ticket won a prize.', 'Having good luck.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('sticky', 'sticky', 'ck', array['s','t','i','ck','y']::text[], array['ck']::text[], 'floor_core', 34, 'Core', 'Core ck word selected for Phase 8C structured coverage.', 'The sticky label would not peel off.', 'Able to stick to things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('toaster', 'toaster', 'oa', array['t','oa','s','t','er']::text[], array['oa']::text[], 'floor_core', 36, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'The toaster popped up two slices.', 'A machine that browns bread.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('foamy', 'foamy', 'oa', array['f','oa','m','y']::text[], array['oa']::text[], 'floor_core', 30, 'Easier', 'Easier oa word selected for Phase 8C structured coverage.', 'The foamy bubbles filled the sink.', 'Full of small bubbles.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('soapy', 'soapy', 'oa', array['s','oa','p','y']::text[], array['oa']::text[], 'floor_core', 30, 'Easier', 'Easier oa word selected for Phase 8C structured coverage.', 'Soapy water spilled onto the tray.', 'Covered with or like soap.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('boatyard', 'boatyard', 'oa', array['b','oa','t','y','ar','d']::text[], array['oa']::text[], 'floor_core', 42, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'The boatyard repaired the rowing boat.', 'A place where boats are built or repaired.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('boatload', 'boatload', 'oa', array['b','oa','t','l','oa','d']::text[], array['oa']::text[], 'floor_core', 40, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'A boatload of supplies reached the island.', 'As much as a boat can carry.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('roadwork', 'roadwork', 'oa', array['r','oa','d','w','or','k']::text[], array['oa']::text[], 'floor_core', 40, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'Roadwork slowed the traffic near school.', 'Repair or building work on a road.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('goalpost', 'goalpost', 'oa', array['g','oa','l','p','o','s','t']::text[], array['oa']::text[], 'floor_core', 38, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'The ball bounced off the goalpost.', 'A post that forms part of a goal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('goalkeeper', 'goalkeeper', 'oa', array['g','oa','l','k','ee','p','er']::text[], array['oa']::text[], 'floor_core', 44, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'The goalkeeper saved the shot.', 'The player who guards the goal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('coatroom', 'coatroom', 'oa', array['c','oa','t','r','oo','m']::text[], array['oa']::text[], 'floor_core', 38, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'The coatroom was beside the hall.', 'A room for storing coats and bags.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('coated', 'coated', 'oa', array['c','oa','t','e','d']::text[], array['oa']::text[], 'floor_core', 34, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'The biscuit was coated in chocolate.', 'Covered with a layer of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('loading', 'loading', 'oa', array['l','oa','d','i','ng']::text[], array['oa']::text[], 'floor_core', 36, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'Loading the boxes took ten minutes.', 'Putting things into a vehicle or container.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('roaming', 'roaming', 'oa', array['r','oa','m','i','ng']::text[], array['oa']::text[], 'floor_core', 36, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'The group was roaming around the museum.', 'Moving about without a fixed route.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('oatcake', 'oatcake', 'oa', array['oa','t','c','a','k','e']::text[], array['oa']::text[], 'floor_core', 38, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'An oatcake sat beside the soup.', 'A flat cake or biscuit made with oats.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('soapbox', 'soapbox', 'oa', array['s','oa','p','b','o','x']::text[], array['oa']::text[], 'floor_core', 40, 'Core', 'Core oa word selected for Phase 8C structured coverage.', 'The speaker stood on a small soapbox.', 'A box once used as a simple platform.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('churn', 'churn', 'ur', array['ch','ur','n']::text[], array['ur']::text[], 'diagnostic', 44, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'The machine began to churn the cream.', 'To stir or move something strongly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('nursery', 'nursery', 'ur', array['n','ur','s','er','y']::text[], array['ur']::text[], 'diagnostic', 48, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'The nursery had bright picture books.', 'A place where young children are cared for.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('nursing', 'nursing', 'ur', array['n','ur','s','i','ng']::text[], array['ur']::text[], 'diagnostic', 48, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'Nursing a sore ankle took patience.', 'Caring for someone who is unwell or injured.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('urgent', 'urgent', 'ur', array['ur','g','e','n','t']::text[], array['ur']::text[], 'diagnostic', 50, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'The urgent message reached the office.', 'Needing quick attention.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('furnace', 'furnace', 'ur', array['f','ur','n','a','c','e']::text[], array['ur']::text[], 'diagnostic', 54, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'The old furnace warmed the hall.', 'A large heater or oven.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('furnish', 'furnish', 'ur', array['f','ur','n','i','sh']::text[], array['ur']::text[], 'diagnostic', 54, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'They will furnish the reading corner.', 'To put furniture into a room.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('curling', 'curling', 'ur', array['c','ur','l','i','ng']::text[], array['ur']::text[], 'diagnostic', 50, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'The curling ribbon decorated the parcel.', 'Bending or twisting into curls.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('burden', 'burden', 'ur', array['b','ur','d','e','n']::text[], array['ur']::text[], 'diagnostic', 52, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'The heavy bag became a burden.', 'A load or worry that is hard to carry.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('surname', 'surname', 'ur', array['s','ur','n','a','m','e']::text[], array['ur']::text[], 'diagnostic', 52, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'Write your surname on the form.', 'A family name.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('curving', 'curving', 'ur', array['c','ur','v','i','ng']::text[], array['ur']::text[], 'diagnostic', 50, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'The curving path led to the gate.', 'Bending smoothly rather than going straight.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('curved', 'curved', 'ur', array['c','ur','v','e','d']::text[], array['ur']::text[], 'diagnostic', 48, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'A curved line joined the two dots.', 'Bent or rounded.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('burning', 'burning', 'ur', array['b','ur','n','i','ng']::text[], array['ur']::text[], 'diagnostic', 48, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'The burning candle gave a warm glow.', 'On fire or giving off heat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('turntable', 'turntable', 'ur', array['t','ur','n','t','a','b','l','e']::text[], array['ur']::text[], 'diagnostic', 56, 'Stretch', 'Stretch ur word selected for Phase 8C structured coverage.', 'The turntable spun the record slowly.', 'A round platform that turns.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('returned', 'returned', 'ur', array['r','e','t','ur','n','e','d']::text[], array['ur']::text[], 'diagnostic', 52, 'Core', 'Core ur word selected for Phase 8C structured coverage.', 'The books were returned before lunch.', 'Brought or sent back.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('champ', 'champ', 'ch', array['ch','a','m','p']::text[], array['ch']::text[], 'floor_core', 26, 'Easier', 'Easier ch word selected for Phase 8C structured coverage.', 'The champ shook hands after the race.', 'A person who wins a contest.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('chalk', 'chalk', 'ch', array['ch','a','l','k']::text[], array['ch']::text[], 'floor_core', 26, 'Easier', 'Easier ch word selected for Phase 8C structured coverage.', 'White chalk marked the playground line.', 'A soft material used for writing or drawing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('cheer', 'cheer', 'ch', array['ch','ee','r']::text[], array['ch']::text[], 'floor_core', 28, 'Easier', 'Easier ch word selected for Phase 8C structured coverage.', 'The crowd began to cheer loudly.', 'To shout happily in support.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('cheerful', 'cheerful', 'ch', array['ch','ee','r','f','u','l']::text[], array['ch']::text[], 'floor_core', 38, 'Core', 'Core ch word selected for Phase 8C structured coverage.', 'A cheerful smile greeted the class.', 'Happy and positive.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('chilly', 'chilly', 'ch', array['ch','i','ll','y']::text[], array['ch']::text[], 'floor_core', 30, 'Easier', 'Easier ch word selected for Phase 8C structured coverage.', 'The playground felt chilly at break.', 'Cold enough to notice.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('chicken', 'chicken', 'ch', array['ch','i','ck','e','n']::text[], array['ch']::text[], 'floor_core', 34, 'Core', 'Core ch word selected for Phase 8C structured coverage.', 'Chicken soup warmed the class cookery table.', 'Meat from a common farm bird.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('chatty', 'chatty', 'ch', array['ch','a','tt','y']::text[], array['ch']::text[], 'floor_core', 34, 'Core', 'Core ch word selected for Phase 8C structured coverage.', 'The chatty group settled down to listen.', 'Fond of talking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('bunch', 'bunch', 'ch', array['b','u','n','ch']::text[], array['ch']::text[], 'floor_core', 32, 'Easier', 'Easier ch word selected for Phase 8C structured coverage.', 'A bunch of pencils sat in the pot.', 'A group of things held together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('crunch', 'crunch', 'ch', array['c','r','u','n','ch']::text[], array['ch']::text[], 'floor_core', 36, 'Core', 'Core ch word selected for Phase 8C structured coverage.', 'The crisp made a loud crunch.', 'A hard biting or crushing sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('sandwich', 'sandwich', 'ch', array['s','a','n','d','w','i','ch']::text[], array['ch']::text[], 'floor_core', 38, 'Core', 'Core ch word selected for Phase 8C structured coverage.', 'The sandwich was wrapped for lunch.', 'Food between slices of bread.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('spinach', 'spinach', 'ch', array['s','p','i','n','a','ch']::text[], array['ch']::text[], 'floor_core', 40, 'Core', 'Core ch word selected for Phase 8C structured coverage.', 'Spinach leaves were added to the pasta.', 'A green leafy vegetable.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('chopstick', 'chopstick', 'ch', array['ch','o','p','s','t','i','ck']::text[], array['ch']::text[], 'floor_core', 42, 'Core', 'Core ch word selected for Phase 8C structured coverage.', 'One chopstick rolled off the table.', 'One of a pair of thin sticks used for eating.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('sting', 'sting', 'ng', array['s','t','i','ng']::text[], array['ng']::text[], 'floor_core', 34, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'A nettle sting can feel sharp.', 'A small painful mark or feeling.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('stung', 'stung', 'ng', array['s','t','u','ng']::text[], array['ng']::text[], 'floor_core', 34, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'Her finger stung after the scratch.', 'Felt a sharp pain.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('hung', 'hung', 'ng', array['h','u','ng']::text[], array['ng']::text[], 'floor_core', 30, 'Easier', 'Easier ng word selected for Phase 8C structured coverage.', 'The picture hung above the shelf.', 'Was attached from above.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('cling', 'cling', 'ng', array['c','l','i','ng']::text[], array['ng']::text[], 'floor_core', 34, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'Wet socks cling to your feet.', 'To hold tightly to something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('fling', 'fling', 'ng', array['f','l','i','ng']::text[], array['ng']::text[], 'floor_core', 34, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'Do not fling the beanbag too hard.', 'To throw something suddenly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('hanger', 'hanger', 'ng', array['h','a','ng','er']::text[], array['ng']::text[], 'floor_core', 38, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'The coat hung from a hanger.', 'A shaped frame for hanging clothes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('longing', 'longing', 'ng', array['l','o','ng','i','ng']::text[], array['ng']::text[], 'floor_core', 42, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'She felt a longing to visit the sea.', 'A strong wish for something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('kingdom', 'kingdom', 'ng', array['k','i','ng','d','o','m']::text[], array['ng']::text[], 'floor_core', 42, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'The story took place in a tiny kingdom.', 'A country ruled by a king or queen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('swinging', 'swinging', 'ng', array['s','w','i','ng','i','ng']::text[], array['ng']::text[], 'floor_core', 40, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'The gate was swinging in the wind.', 'Moving backwards and forwards.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('strongest', 'strongest', 'ng', array['s','t','r','o','ng','e','s','t']::text[], array['ng']::text[], 'floor_core', 46, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'The strongest bridge held the most blocks.', 'Having the most strength.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('ending', 'ending', 'ng', array['e','n','d','i','ng']::text[], array['ng']::text[], 'floor_core', 38, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'The story had a surprising ending.', 'The final part of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('nothing', 'nothing', 'ng', array['n','o','th','i','ng']::text[], array['ng']::text[], 'floor_core', 42, 'Core', 'Core ng word selected for Phase 8C structured coverage.', 'Nothing was missing from the box.', 'Not anything.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('pouch', 'pouch', 'ou', array['p','ou','ch']::text[], array['ou']::text[], 'floor_core', 34, 'Easier', 'Easier ou word selected for Phase 8C structured coverage.', 'The pouch held three counters.', 'A small soft bag.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('crouch', 'crouch', 'ou', array['c','r','ou','ch']::text[], array['ou']::text[], 'floor_core', 38, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'Crouch down to see under the table.', 'To bend low with knees bent.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('doubt', 'doubt', 'ou', array['d','ou','b','t']::text[], array['ou']::text[], 'floor_core', 40, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'I had no doubt that the plan would work.', 'A feeling of being unsure.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('fountain', 'fountain', 'ou', array['f','ou','n','t','ai','n']::text[], array['ou']::text[], 'floor_core', 46, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'Water splashed from the stone fountain.', 'A structure that sends water into the air.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('council', 'council', 'ou', array['c','ou','n','ci','l']::text[], array['ou']::text[], 'floor_core', 48, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'The school council chose a new project.', 'A group chosen to make decisions.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('outfit', 'outfit', 'ou', array['ou','t','f','i','t']::text[], array['ou']::text[], 'floor_core', 36, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'Her outfit was ready for the concert.', 'A set of clothes worn together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('outline', 'outline', 'ou', array['ou','t','l','i','n','e']::text[], array['ou']::text[], 'floor_core', 40, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'Draw the outline before adding colour.', 'The outside edge or main plan.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('outing', 'outing', 'ou', array['ou','t','i','ng']::text[], array['ou']::text[], 'floor_core', 36, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'The class outing was to the museum.', 'A short trip for enjoyment or learning.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('outcome', 'outcome', 'ou', array['ou','t','c','o','m','e']::text[], array['ou']::text[], 'floor_core', 42, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'The outcome was better than expected.', 'The result of an action or event.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('account', 'account', 'ou', array['a','c','c','ou','n','t']::text[], array['ou']::text[], 'floor_core', 46, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'She wrote an account of the visit.', 'A report or record of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('discount', 'discount', 'ou', array['d','i','s','c','ou','n','t']::text[], array['ou']::text[], 'floor_core', 48, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'The shop gave a discount on notebooks.', 'A reduction in the usual price.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('trousers', 'trousers', 'ou', array['t','r','ou','s','er','s']::text[], array['ou']::text[], 'floor_core', 44, 'Core', 'Core ou word selected for Phase 8C structured coverage.', 'The trousers were folded on the bed.', 'Clothing worn on the legs.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('howl', 'howl', 'ow', array['h','ow','l']::text[], array['ow']::text[], 'floor_core', 28, 'Easier', 'Easier ow word selected for Phase 8C structured coverage.', 'The wind made a low howl outside.', 'A long loud cry or sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('downpour', 'downpour', 'ow', array['d','ow','n','p','ou','r']::text[], array['ow']::text[], 'floor_core', 40, 'Core', 'Core ow word selected for Phase 8C structured coverage.', 'A downpour soaked the playground.', 'A sudden heavy fall of rain.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('prowl', 'prowl', 'ow', array['p','r','ow','l']::text[], array['ow']::text[], 'floor_core', 38, 'Core', 'Core ow word selected for Phase 8C structured coverage.', 'The cat began to prowl around the shed.', 'To move around quietly while searching.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('scowl', 'scowl', 'ow', array['s','c','ow','l']::text[], array['ow']::text[], 'floor_core', 38, 'Core', 'Core ow word selected for Phase 8C structured coverage.', 'A scowl crossed his face for a moment.', 'An angry or unhappy look.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('gown', 'gown', 'ow', array['g','ow','n']::text[], array['ow']::text[], 'floor_core', 34, 'Easier', 'Easier ow word selected for Phase 8C structured coverage.', 'The gown hung behind the door.', 'A long piece of clothing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('downhill', 'downhill', 'ow', array['d','ow','n','h','i','ll']::text[], array['ow']::text[], 'floor_core', 40, 'Core', 'Core ow word selected for Phase 8C structured coverage.', 'The path went downhill to the stream.', 'Sloping towards a lower place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('downtown', 'downtown', 'ow', array['d','ow','n','t','ow','n']::text[], array['ow']::text[], 'floor_core', 44, 'Core', 'Core ow word selected for Phase 8C structured coverage.', 'The bus went downtown after lunch.', 'In or towards the centre of a town.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('brownish', 'brownish', 'ow', array['b','r','ow','n','i','sh']::text[], array['ow']::text[], 'floor_core', 42, 'Core', 'Core ow word selected for Phase 8C structured coverage.', 'The paint looked brownish when it dried.', 'Somewhat brown in colour.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('crowded', 'crowded', 'ow', array['c','r','ow','d','e','d']::text[], array['ow']::text[], 'floor_core', 44, 'Core', 'Core ow word selected for Phase 8C structured coverage.', 'The hall was crowded after assembly.', 'Full of people or things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('flowerpot', 'flowerpot', 'ow', array['f','l','ow','er','p','o','t']::text[], array['ow']::text[], 'floor_core', 46, 'Core', 'Core ow word selected for Phase 8C structured coverage.', 'The flowerpot sat on the windowsill.', 'A container used for growing a plant.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('powdery', 'powdery', 'ow', array['p','ow','d','er','y']::text[], array['ow']::text[], 'floor_core', 44, 'Core', 'Core ow word selected for Phase 8C structured coverage.', 'The powdery snow brushed off easily.', 'Like fine dry powder.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('towering', 'towering', 'ow', array['t','ow','er','i','ng']::text[], array['ow']::text[], 'floor_core', 46, 'Core', 'Core ow word selected for Phase 8C structured coverage.', 'The towering wall made a long shadow.', 'Very tall or high.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('dash', 'dash', 'sh', array['d','a','sh']::text[], array['sh']::text[], 'floor_core', 22, 'Easier', 'Easier sh word selected for Phase 8C structured coverage.', 'Make a dash to the finish line.', 'A quick run or a short line mark.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('bash', 'bash', 'sh', array['b','a','sh']::text[], array['sh']::text[], 'floor_core', 24, 'Easier', 'Easier sh word selected for Phase 8C structured coverage.', 'Do not bash the blocks together.', 'To hit something hard.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('mash', 'mash', 'sh', array['m','a','sh']::text[], array['sh']::text[], 'floor_core', 24, 'Easier', 'Easier sh word selected for Phase 8C structured coverage.', 'Mash the potato until it is smooth.', 'To crush food until soft.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('crash', 'crash', 'sh', array['c','r','a','sh']::text[], array['sh']::text[], 'floor_core', 32, 'Easier', 'Easier sh word selected for Phase 8C structured coverage.', 'The blocks fell with a crash.', 'A loud noise after a hard hit.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('trash', 'trash', 'sh', array['t','r','a','sh']::text[], array['sh']::text[], 'floor_core', 32, 'Easier', 'Easier sh word selected for Phase 8C structured coverage.', 'Put the paper trash in the bin.', 'Waste material to throw away.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('should', 'should', 'sh', array['sh','ou','l','d']::text[], array['sh']::text[], 'floor_core', 34, 'Core', 'Core sh word selected for Phase 8C structured coverage.', 'You should check your bag before leaving.', 'Used to say what is right or expected.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('shoulder', 'shoulder', 'sh', array['sh','ou','l','d','er']::text[], array['sh']::text[], 'floor_core', 38, 'Core', 'Core sh word selected for Phase 8C structured coverage.', 'The bag strap slipped from my shoulder.', 'The part of the body where the arm joins.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('shark', 'shark', 'sh', array['sh','ar','k']::text[], array['sh']::text[], 'floor_core', 34, 'Core', 'Core sh word selected for Phase 8C structured coverage.', 'The book showed a shark in the ocean.', 'A large sea fish with sharp teeth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('shrink', 'shrink', 'sh', array['sh','r','i','n','k']::text[], array['sh']::text[], 'floor_core', 38, 'Core', 'Core sh word selected for Phase 8C structured coverage.', 'The jumper may shrink in hot water.', 'To become smaller.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('shred', 'shred', 'sh', array['sh','r','e','d']::text[], array['sh']::text[], 'floor_core', 34, 'Core', 'Core sh word selected for Phase 8C structured coverage.', 'Shred the paper for the art tray.', 'To tear or cut into thin pieces.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('shrub', 'shrub', 'sh', array['sh','r','u','b']::text[], array['sh']::text[], 'floor_core', 34, 'Core', 'Core sh word selected for Phase 8C structured coverage.', 'A small shrub grew by the path.', 'A short woody plant.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('foolish', 'foolish', 'sh', array['f','oo','l','i','sh']::text[], array['sh']::text[], 'floor_core', 38, 'Core', 'Core sh word selected for Phase 8C structured coverage.', 'It was foolish to run on the wet floor.', 'Not showing good sense.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('bait', 'bait', 'ai', array['b','ai','t']::text[], array['ai']::text[], 'floor_core', 26, 'Easier', 'Easier ai word selected for Phase 8C structured coverage.', 'The hook had bait on the end.', 'Food used to attract an animal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('waist', 'waist', 'ai', array['w','ai','s','t']::text[], array['ai']::text[], 'floor_core', 32, 'Easier', 'Easier ai word selected for Phase 8C structured coverage.', 'The belt fitted around his waist.', 'The middle part of the body.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('faint', 'faint', 'ai', array['f','ai','n','t']::text[], array['ai']::text[], 'floor_core', 34, 'Core', 'Core ai word selected for Phase 8C structured coverage.', 'The line was too faint to see clearly.', 'Weak or not strong.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('stain', 'stain', 'ai', array['s','t','ai','n']::text[], array['ai']::text[], 'floor_core', 34, 'Core', 'Core ai word selected for Phase 8C structured coverage.', 'A red stain marked the cloth.', 'A coloured mark that is hard to remove.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('strain', 'strain', 'ai', array['s','t','r','ai','n']::text[], array['ai']::text[], 'floor_core', 38, 'Core', 'Core ai word selected for Phase 8C structured coverage.', 'Do not strain your arm with the heavy box.', 'To stretch or use too much effort.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('sprain', 'sprain', 'ai', array['s','p','r','ai','n']::text[], array['ai']::text[], 'floor_core', 38, 'Core', 'Core ai word selected for Phase 8C structured coverage.', 'A sprain kept him out of games.', 'An injury caused by twisting a joint.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('email', 'email', 'ai', array['e','m','ai','l']::text[], array['ai']::text[], 'floor_core', 34, 'Core', 'Core ai word selected for Phase 8C structured coverage.', 'The email arrived before school.', 'A message sent by computer or phone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('detail', 'detail', 'ai', array['d','e','t','ai','l']::text[], array['ai']::text[], 'floor_core', 40, 'Core', 'Core ai word selected for Phase 8C structured coverage.', 'Add one more detail to the drawing.', 'A small part of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('faithful', 'faithful', 'ai', array['f','ai','th','f','u','l']::text[], array['ai']::text[], 'floor_core', 42, 'Core', 'Core ai word selected for Phase 8C structured coverage.', 'The faithful helper came every week.', 'Loyal and dependable.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('mainland', 'mainland', 'ai', array['m','ai','n','l','a','n','d']::text[], array['ai']::text[], 'floor_core', 42, 'Core', 'Core ai word selected for Phase 8C structured coverage.', 'The ferry sailed back to the mainland.', 'The main part of a country, not an island.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('staying', 'staying', 'ay', array['s','t','ay','i','ng']::text[], array['ay']::text[], 'floor_core', 34, 'Core', 'Core ay word selected for Phase 8C structured coverage.', 'We are staying inside during the rain.', 'Remaining in one place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('saying', 'saying', 'ay', array['s','ay','i','ng']::text[], array['ay']::text[], 'floor_core', 32, 'Easier', 'Easier ay word selected for Phase 8C structured coverage.', 'She was saying the poem clearly.', 'Speaking words aloud.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('payment', 'payment', 'ay', array['p','ay','m','e','n','t']::text[], array['ay']::text[], 'floor_core', 38, 'Core', 'Core ay word selected for Phase 8C structured coverage.', 'The payment was made at the office.', 'Money paid for something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('payable', 'payable', 'ay', array['p','ay','a','b','l','e']::text[], array['ay']::text[], 'floor_core', 40, 'Core', 'Core ay word selected for Phase 8C structured coverage.', 'The fee was payable by Friday.', 'Able or needing to be paid.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('payday', 'payday', 'ay', array['p','ay','d','ay']::text[], array['ay']::text[], 'floor_core', 34, 'Core', 'Core ay word selected for Phase 8C structured coverage.', 'Payday came at the end of the month.', 'A day when someone is paid.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('haystack', 'haystack', 'ay', array['h','ay','s','t','a','ck']::text[], array['ay']::text[], 'floor_core', 38, 'Core', 'Core ay word selected for Phase 8C structured coverage.', 'The haystack stood beside the barn.', 'A pile of dried grass stored together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('stray', 'stray', 'ay', array['s','t','r','ay']::text[], array['ay']::text[], 'floor_core', 32, 'Easier', 'Easier ay word selected for Phase 8C structured coverage.', 'A stray pencil rolled under the table.', 'Not in the right place or without a home.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('sway', 'sway', 'ay', array['s','w','ay']::text[], array['ay']::text[], 'floor_core', 30, 'Easier', 'Easier ay word selected for Phase 8C structured coverage.', 'The tall grass began to sway.', 'To move slowly from side to side.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('layer', 'layer', 'ay', array['l','ay','er']::text[], array['ay']::text[], 'floor_core', 36, 'Core', 'Core ay word selected for Phase 8C structured coverage.', 'Add a thin layer of glue.', 'One sheet or level of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('runway', 'runway', 'ay', array['r','u','n','w','ay']::text[], array['ay']::text[], 'floor_core', 36, 'Core', 'Core ay word selected for Phase 8C structured coverage.', 'The plane waited on the runway.', 'A long strip used by planes for takeoff.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('coffee', 'coffee', 'ee', array['c','o','ff','ee']::text[], array['ee']::text[], 'floor_core', 34, 'Core', 'Core ee word selected for Phase 8C structured coverage.', 'The coffee smelled warm in the kitchen.', 'A hot drink made from roasted beans.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('degree', 'degree', 'ee', array['d','e','g','r','ee']::text[], array['ee']::text[], 'floor_core', 42, 'Core', 'Core ee word selected for Phase 8C structured coverage.', 'The angle measured one degree more.', 'A unit used for temperature or angles.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('fifteen', 'fifteen', 'ee', array['f','i','f','t','ee','n']::text[], array['ee']::text[], 'floor_core', 38, 'Core', 'Core ee word selected for Phase 8C structured coverage.', 'Fifteen pupils joined the club.', 'The number after fourteen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('seventeen', 'seventeen', 'ee', array['s','e','v','e','n','t','ee','n']::text[], array['ee']::text[], 'floor_core', 44, 'Core', 'Core ee word selected for Phase 8C structured coverage.', 'Seventeen books were on the shelf.', 'The number after sixteen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('squeeze', 'squeeze', 'ee', array['s','qu','ee','z','e']::text[], array['ee']::text[], 'floor_core', 42, 'Core', 'Core ee word selected for Phase 8C structured coverage.', 'Squeeze the sponge over the sink.', 'To press something firmly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('kneel', 'kneel', 'ee', array['k','n','ee','l']::text[], array['ee']::text[], 'floor_core', 38, 'Core', 'Core ee word selected for Phase 8C structured coverage.', 'Kneel on the mat during the game.', 'To rest on one or both knees.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('freedom', 'freedom', 'ee', array['f','r','ee','d','o','m']::text[], array['ee']::text[], 'floor_core', 42, 'Core', 'Core ee word selected for Phase 8C structured coverage.', 'The story was about freedom.', 'The state of being free.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('speechless', 'speechless', 'ee', array['s','p','ee','ch','l','e','s','s']::text[], array['ee']::text[], 'floor_core', 46, 'Core', 'Core ee word selected for Phase 8C structured coverage.', 'The surprise left him speechless.', 'Unable to speak because of strong feeling.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('beekeeper', 'beekeeper', 'ee', array['b','ee','k','ee','p','er']::text[], array['ee']::text[], 'floor_core', 44, 'Core', 'Core ee word selected for Phase 8C structured coverage.', 'The beekeeper checked the wooden hive.', 'A person who looks after bees.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('evergreen', 'evergreen', 'ee', array['e','v','er','g','r','ee','n']::text[], array['ee']::text[], 'floor_core', 46, 'Core', 'Core ee word selected for Phase 8C structured coverage.', 'An evergreen branch stayed green in winter.', 'A plant that keeps leaves all year.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('shorter', 'shorter', 'or', array['sh','or','t','er']::text[], array['or']::text[], 'floor_core', 36, 'Core', 'Core or word selected for Phase 8C structured coverage.', 'The shorter route saved time.', 'Less long than something else.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('sporting', 'sporting', 'or', array['s','p','or','t','i','ng']::text[], array['or']::text[], 'floor_core', 42, 'Core', 'Core or word selected for Phase 8C structured coverage.', 'The sporting event filled the field.', 'Connected with sport.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('forget', 'forget', 'or', array['f','or','g','e','t']::text[], array['or']::text[], 'floor_core', 38, 'Core', 'Core or word selected for Phase 8C structured coverage.', 'Do not forget your reading book.', 'To fail to remember something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('forward', 'forward', 'or', array['f','or','w','ar','d']::text[], array['or']::text[], 'floor_core', 42, 'Core', 'Core or word selected for Phase 8C structured coverage.', 'Move one step forward.', 'Towards the front.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('orchard', 'orchard', 'or', array['or','ch','ar','d']::text[], array['or']::text[], 'floor_core', 44, 'Core', 'Core or word selected for Phase 8C structured coverage.', 'The orchard had rows of apple trees.', 'Land where fruit trees grow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('acorn', 'acorn', 'or', array['a','c','or','n']::text[], array['or']::text[], 'floor_core', 38, 'Core', 'Core or word selected for Phase 8C structured coverage.', 'An acorn fell from the oak tree.', 'The nut of an oak tree.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('bookstore', 'bookstore', 'or', array['b','oo','k','s','t','or','e']::text[], array['or']::text[], 'floor_core', 44, 'Core', 'Core or word selected for Phase 8C structured coverage.', 'The bookstore opened near the station.', 'A shop that sells books.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('corkscrew', 'corkscrew', 'or', array['c','or','k','s','c','r','ew']::text[], array['or']::text[], 'floor_core', 46, 'Core', 'Core or word selected for Phase 8C structured coverage.', 'The corkscrew was in the drawer.', 'A tool for pulling corks from bottles.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('stormcloud', 'stormcloud', 'or', array['s','t','or','m','c','l','ou','d']::text[], array['or']::text[], 'floor_core', 46, 'Core', 'Core or word selected for Phase 8C structured coverage.', 'A dark stormcloud covered the hill.', 'A cloud that may bring stormy weather.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('borderline', 'borderline', 'or', array['b','or','d','er','l','i','n','e']::text[], array['or']::text[], 'floor_core', 48, 'Core', 'Core or word selected for Phase 8C structured coverage.', 'The answer was a borderline case.', 'Close to being in one group or another.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('thanks', 'thanks', 'th', array['th','a','n','k','s']::text[], array['th']::text[], 'floor_core', 30, 'Easier', 'Easier th word selected for Phase 8C structured coverage.', 'Give thanks for the help you received.', 'Words or actions that show gratitude.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('thunder', 'thunder', 'th', array['th','u','n','d','er']::text[], array['th']::text[], 'floor_core', 36, 'Core', 'Core th word selected for Phase 8C structured coverage.', 'Thunder rumbled after the flash.', 'The loud sound heard during a storm.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('throat', 'throat', 'th', array['th','r','oa','t']::text[], array['th']::text[], 'floor_core', 38, 'Core', 'Core th word selected for Phase 8C structured coverage.', 'My throat felt dry after singing.', 'The passage inside the neck.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('thoughtful', 'thoughtful', 'th', array['th','ough','t','f','u','l']::text[], array['th']::text[], 'floor_core', 44, 'Core', 'Core th word selected for Phase 8C structured coverage.', 'The thoughtful card made her smile.', 'Kind or showing careful thought.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('together', 'together', 'th', array['t','o','g','e','th','er']::text[], array['th']::text[], 'floor_core', 40, 'Core', 'Core th word selected for Phase 8C structured coverage.', 'The group worked together on the model.', 'With each other or in one place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('clothing', 'clothing', 'th', array['c','l','o','th','i','ng']::text[], array['th']::text[], 'floor_core', 40, 'Core', 'Core th word selected for Phase 8C structured coverage.', 'Warm clothing was packed for camp.', 'Things people wear.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('method', 'method', 'th', array['m','e','th','o','d']::text[], array['th']::text[], 'floor_core', 40, 'Core', 'Core th word selected for Phase 8C structured coverage.', 'Her method kept the desk tidy.', 'A planned way of doing something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('healthy', 'healthy', 'th', array['h','ea','l','th','y']::text[], array['th']::text[], 'floor_core', 40, 'Core', 'Core th word selected for Phase 8C structured coverage.', 'A healthy snack kept everyone ready.', 'Well and strong.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('toothpaste', 'toothpaste', 'th', array['t','oo','th','p','a','s','t','e']::text[], array['th']::text[], 'floor_core', 42, 'Core', 'Core th word selected for Phase 8C structured coverage.', 'The toothpaste tube was nearly empty.', 'Paste used for cleaning teeth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('bathroom', 'bathroom', 'th', array['b','a','th','r','oo','m']::text[], array['th']::text[], 'floor_core', 38, 'Core', 'Core th word selected for Phase 8C structured coverage.', 'The bathroom sink was clean.', 'A room with a bath, shower, or toilet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('mark', 'mark', 'ar', array['m','ar','k']::text[], array['ar']::text[], 'floor_core', 28, 'Easier', 'Easier ar word selected for Phase 8C structured coverage.', 'Put a small mark beside your answer.', 'A sign or spot on a surface.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('parking', 'parking', 'ar', array['p','ar','k','i','ng']::text[], array['ar']::text[], 'floor_core', 36, 'Core', 'Core ar word selected for Phase 8C structured coverage.', 'Parking was easy near the library.', 'Leaving a vehicle in a place for a time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('darkness', 'darkness', 'ar', array['d','ar','k','n','e','s','s']::text[], array['ar']::text[], 'floor_core', 38, 'Core', 'Core ar word selected for Phase 8C structured coverage.', 'The torch shone through the darkness.', 'The state of having little or no light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('charge', 'charge', 'ar', array['ch','ar','g','e']::text[], array['ar']::text[], 'floor_core', 38, 'Core', 'Core ar word selected for Phase 8C structured coverage.', 'Please charge the tablet overnight.', 'To fill a battery with power or ask a price.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('alarm', 'alarm', 'ar', array['a','l','ar','m']::text[], array['ar']::text[], 'floor_core', 36, 'Core', 'Core ar word selected for Phase 8C structured coverage.', 'The alarm rang at seven o''clock.', 'A signal that warns or wakes people.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('carve', 'carve', 'ar', array['c','ar','v','e']::text[], array['ar']::text[], 'floor_core', 34, 'Core', 'Core ar word selected for Phase 8C structured coverage.', 'Carve a simple shape from the clay.', 'To cut and shape something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('dreamer', 'dreamer', 'ea', array['d','r','ea','m','er']::text[], array['ea']::text[], 'floor_core', 38, 'Core', 'Core ea word selected for Phase 8C structured coverage.', 'The dreamer imagined a castle in the clouds.', 'A person who imagines hopes or ideas.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('steamer', 'steamer', 'ea', array['s','t','ea','m','er']::text[], array['ea']::text[], 'floor_core', 38, 'Core', 'Core ea word selected for Phase 8C structured coverage.', 'The steamer warmed the vegetables.', 'A pan or machine that cooks with steam.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('teapot', 'teapot', 'ea', array['t','ea','p','o','t']::text[], array['ea']::text[], 'floor_core', 34, 'Core', 'Core ea word selected for Phase 8C structured coverage.', 'The teapot sat in the middle of the table.', 'A pot used for making and pouring tea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('seaside', 'seaside', 'ea', array['s','ea','s','i','d','e']::text[], array['ea']::text[], 'floor_core', 36, 'Core', 'Core ea word selected for Phase 8C structured coverage.', 'The seaside town was busy in summer.', 'A place beside the sea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('eastern', 'eastern', 'ea', array['ea','s','t','er','n']::text[], array['ea']::text[], 'floor_core', 40, 'Core', 'Core ea word selected for Phase 8C structured coverage.', 'The eastern sky grew bright.', 'In or from the east.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('teamwork', 'teamwork', 'ea', array['t','ea','m','w','or','k']::text[], array['ea']::text[], 'floor_core', 38, 'Core', 'Core ea word selected for Phase 8C structured coverage.', 'Teamwork helped finish the project.', 'Working together well.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('worker', 'worker', 'er', array['w','or','k','er']::text[], array['er']::text[], 'diagnostic', 46, 'Core', 'Core er word selected for Phase 8C structured coverage.', 'The worker repaired the classroom door.', 'A person who does a job.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('driver', 'driver', 'er', array['d','r','i','v','er']::text[], array['er']::text[], 'diagnostic', 46, 'Core', 'Core er word selected for Phase 8C structured coverage.', 'The driver waited by the bus.', 'A person who drives a vehicle.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('writer', 'writer', 'er', array['w','r','i','t','er']::text[], array['er']::text[], 'diagnostic', 48, 'Core', 'Core er word selected for Phase 8C structured coverage.', 'The writer shared a funny story.', 'A person who writes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('winner', 'winner', 'er', array['w','i','nn','er']::text[], array['er']::text[], 'diagnostic', 46, 'Core', 'Core er word selected for Phase 8C structured coverage.', 'The winner shook hands after the race.', 'A person who wins.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('printer', 'printer', 'er', array['p','r','i','n','t','er']::text[], array['er']::text[], 'diagnostic', 50, 'Core', 'Core er word selected for Phase 8C structured coverage.', 'The printer made a copy of the poster.', 'A machine that prints on paper.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true),
  ('computer', 'computer', 'er', array['c','o','m','p','u','t','er']::text[], array['er']::text[], 'diagnostic', 54, 'Core', 'Core er word selected for Phase 8C structured coverage.', 'The computer saved the class file.', 'An electronic machine for storing and using information.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8c_2026_05_14', true);

create temporary table wordloom_core_phase_8c_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_8c_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('airspace', 'air', 'primary', 'r_controlled_vowel', 0),
  ('airbag', 'air', 'primary', 'r_controlled_vowel', 0),
  ('aircraft', 'air', 'primary', 'r_controlled_vowel', 0),
  ('airlift', 'air', 'primary', 'r_controlled_vowel', 0),
  ('airless', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hairless', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hairnet', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hairline', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hairspray', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hairdresser', 'air', 'primary', 'r_controlled_vowel', 0),
  ('fairway', 'air', 'primary', 'r_controlled_vowel', 0),
  ('unfairly', 'air', 'primary', 'r_controlled_vowel', 0),
  ('chairperson', 'air', 'primary', 'r_controlled_vowel', 0),
  ('wheelchair', 'air', 'primary', 'r_controlled_vowel', 0),
  ('pairing', 'air', 'primary', 'r_controlled_vowel', 0),
  ('stairway', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hawk', 'aw', 'primary', 'vowel_digraph', 0),
  ('fawn', 'aw', 'primary', 'vowel_digraph', 0),
  ('spawn', 'aw', 'primary', 'vowel_digraph', 0),
  ('prawn', 'aw', 'primary', 'vowel_digraph', 0),
  ('jawbone', 'aw', 'primary', 'vowel_digraph', 0),
  ('lawless', 'aw', 'primary', 'vowel_digraph', 0),
  ('lawful', 'aw', 'primary', 'vowel_digraph', 0),
  ('outlaw', 'aw', 'primary', 'vowel_digraph', 0),
  ('withdraw', 'aw', 'primary', 'vowel_digraph', 0),
  ('drawback', 'aw', 'primary', 'vowel_digraph', 0),
  ('sawmill', 'aw', 'primary', 'vowel_digraph', 0),
  ('seesawed', 'aw', 'primary', 'vowel_digraph', 0),
  ('crawling', 'aw', 'primary', 'vowel_digraph', 0),
  ('crawler', 'aw', 'primary', 'vowel_digraph', 0),
  ('brawny', 'aw', 'primary', 'vowel_digraph', 0),
  ('squawk', 'aw', 'primary', 'vowel_digraph', 0),
  ('pew', 'ew', 'primary', 'vowel_digraph', 0),
  ('newt', 'ew', 'primary', 'vowel_digraph', 0),
  ('curfew', 'ew', 'primary', 'vowel_digraph', 0),
  ('mildew', 'ew', 'primary', 'vowel_digraph', 0),
  ('dewy', 'ew', 'primary', 'vowel_digraph', 0),
  ('newsagent', 'ew', 'primary', 'vowel_digraph', 0),
  ('newsroom', 'ew', 'primary', 'vowel_digraph', 0),
  ('newsprint', 'ew', 'primary', 'vowel_digraph', 0),
  ('renewed', 'ew', 'primary', 'vowel_digraph', 0),
  ('renewing', 'ew', 'primary', 'vowel_digraph', 0),
  ('renewable', 'ew', 'primary', 'vowel_digraph', 0),
  ('chewed', 'ew', 'primary', 'vowel_digraph', 0),
  ('chewing', 'ew', 'primary', 'vowel_digraph', 0),
  ('screwed', 'ew', 'primary', 'vowel_digraph', 0),
  ('screwing', 'ew', 'primary', 'vowel_digraph', 0),
  ('brewer', 'ew', 'primary', 'vowel_digraph', 0),
  ('fright', 'igh', 'primary', 'trigraph', 0),
  ('frighten', 'igh', 'primary', 'trigraph', 0),
  ('frightened', 'igh', 'primary', 'trigraph', 0),
  ('lightning', 'igh', 'primary', 'trigraph', 0),
  ('lighthouse', 'igh', 'primary', 'trigraph', 0),
  ('highland', 'igh', 'primary', 'trigraph', 0),
  ('highness', 'igh', 'primary', 'trigraph', 0),
  ('tighten', 'igh', 'primary', 'trigraph', 0),
  ('rightful', 'igh', 'primary', 'trigraph', 0),
  ('eyesight', 'igh', 'primary', 'trigraph', 0),
  ('nightlight', 'igh', 'primary', 'trigraph', 0),
  ('nightdress', 'igh', 'primary', 'trigraph', 0),
  ('nightshirt', 'igh', 'primary', 'trigraph', 0),
  ('highlighter', 'igh', 'primary', 'trigraph', 0),
  ('insight', 'igh', 'primary', 'trigraph', 0),
  ('oversight', 'igh', 'primary', 'trigraph', 0),
  ('connection', 'tion', 'primary', 'trigraph', 0),
  ('caption', 'tion', 'primary', 'trigraph', 0),
  ('location', 'tion', 'primary', 'trigraph', 0),
  ('donation', 'tion', 'primary', 'trigraph', 0),
  ('election', 'tion', 'primary', 'trigraph', 0),
  ('function', 'tion', 'primary', 'trigraph', 0),
  ('fraction', 'tion', 'primary', 'trigraph', 0),
  ('reaction', 'tion', 'primary', 'trigraph', 0),
  ('protection', 'tion', 'primary', 'trigraph', 0),
  ('reflection', 'tion', 'primary', 'trigraph', 0),
  ('selection', 'tion', 'primary', 'trigraph', 0),
  ('pollution', 'tion', 'primary', 'trigraph', 0),
  ('population', 'tion', 'primary', 'trigraph', 0),
  ('operation', 'tion', 'primary', 'trigraph', 0),
  ('tradition', 'tion', 'primary', 'trigraph', 0),
  ('nutrition', 'tion', 'primary', 'trigraph', 0),
  ('sick', 'ck', 'primary', 'consonant_digraph', 0),
  ('lick', 'ck', 'primary', 'consonant_digraph', 0),
  ('rack', 'ck', 'primary', 'consonant_digraph', 0),
  ('tack', 'ck', 'primary', 'consonant_digraph', 0),
  ('muck', 'ck', 'primary', 'consonant_digraph', 0),
  ('tucked', 'ck', 'primary', 'consonant_digraph', 0),
  ('locking', 'ck', 'primary', 'consonant_digraph', 0),
  ('rocking', 'ck', 'primary', 'consonant_digraph', 0),
  ('trickle', 'ck', 'primary', 'consonant_digraph', 0),
  ('knock', 'ck', 'primary', 'consonant_digraph', 0),
  ('locker', 'ck', 'primary', 'consonant_digraph', 0),
  ('cricket', 'ck', 'primary', 'consonant_digraph', 0),
  ('lucky', 'ck', 'primary', 'consonant_digraph', 0),
  ('sticky', 'ck', 'primary', 'consonant_digraph', 0),
  ('toaster', 'oa', 'primary', 'vowel_digraph', 0),
  ('foamy', 'oa', 'primary', 'vowel_digraph', 0),
  ('soapy', 'oa', 'primary', 'vowel_digraph', 0),
  ('boatyard', 'oa', 'primary', 'vowel_digraph', 0),
  ('boatload', 'oa', 'primary', 'vowel_digraph', 0),
  ('roadwork', 'oa', 'primary', 'vowel_digraph', 0),
  ('goalpost', 'oa', 'primary', 'vowel_digraph', 0),
  ('goalkeeper', 'oa', 'primary', 'vowel_digraph', 0),
  ('coatroom', 'oa', 'primary', 'vowel_digraph', 0),
  ('coated', 'oa', 'primary', 'vowel_digraph', 0),
  ('loading', 'oa', 'primary', 'vowel_digraph', 0),
  ('roaming', 'oa', 'primary', 'vowel_digraph', 0),
  ('oatcake', 'oa', 'primary', 'vowel_digraph', 0),
  ('soapbox', 'oa', 'primary', 'vowel_digraph', 0),
  ('churn', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('nursery', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('nursing', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('urgent', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('furnace', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('furnish', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('curling', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('burden', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('surname', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('curving', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('curved', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('burning', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('turntable', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('returned', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('champ', 'ch', 'primary', 'consonant_digraph', 0),
  ('chalk', 'ch', 'primary', 'consonant_digraph', 0),
  ('cheer', 'ch', 'primary', 'consonant_digraph', 0),
  ('cheerful', 'ch', 'primary', 'consonant_digraph', 0),
  ('chilly', 'ch', 'primary', 'consonant_digraph', 0),
  ('chicken', 'ch', 'primary', 'consonant_digraph', 0),
  ('chatty', 'ch', 'primary', 'consonant_digraph', 0),
  ('bunch', 'ch', 'primary', 'consonant_digraph', 0),
  ('crunch', 'ch', 'primary', 'consonant_digraph', 0),
  ('sandwich', 'ch', 'primary', 'consonant_digraph', 0),
  ('spinach', 'ch', 'primary', 'consonant_digraph', 0),
  ('chopstick', 'ch', 'primary', 'consonant_digraph', 0),
  ('sting', 'ng', 'primary', 'consonant_digraph', 0),
  ('stung', 'ng', 'primary', 'consonant_digraph', 0),
  ('hung', 'ng', 'primary', 'consonant_digraph', 0),
  ('cling', 'ng', 'primary', 'consonant_digraph', 0),
  ('fling', 'ng', 'primary', 'consonant_digraph', 0),
  ('hanger', 'ng', 'primary', 'consonant_digraph', 0),
  ('longing', 'ng', 'primary', 'consonant_digraph', 0),
  ('kingdom', 'ng', 'primary', 'consonant_digraph', 0),
  ('swinging', 'ng', 'primary', 'consonant_digraph', 0),
  ('strongest', 'ng', 'primary', 'consonant_digraph', 0),
  ('ending', 'ng', 'primary', 'consonant_digraph', 0),
  ('nothing', 'ng', 'primary', 'consonant_digraph', 0),
  ('pouch', 'ou', 'primary', 'vowel_digraph', 0),
  ('crouch', 'ou', 'primary', 'vowel_digraph', 0),
  ('doubt', 'ou', 'primary', 'vowel_digraph', 0),
  ('fountain', 'ou', 'primary', 'vowel_digraph', 0),
  ('council', 'ou', 'primary', 'vowel_digraph', 0),
  ('outfit', 'ou', 'primary', 'vowel_digraph', 0),
  ('outline', 'ou', 'primary', 'vowel_digraph', 0),
  ('outing', 'ou', 'primary', 'vowel_digraph', 0),
  ('outcome', 'ou', 'primary', 'vowel_digraph', 0),
  ('account', 'ou', 'primary', 'vowel_digraph', 0),
  ('discount', 'ou', 'primary', 'vowel_digraph', 0),
  ('trousers', 'ou', 'primary', 'vowel_digraph', 0),
  ('howl', 'ow', 'primary', 'vowel_digraph', 0),
  ('downpour', 'ow', 'primary', 'vowel_digraph', 0),
  ('prowl', 'ow', 'primary', 'vowel_digraph', 0),
  ('scowl', 'ow', 'primary', 'vowel_digraph', 0),
  ('gown', 'ow', 'primary', 'vowel_digraph', 0),
  ('downhill', 'ow', 'primary', 'vowel_digraph', 0),
  ('downtown', 'ow', 'primary', 'vowel_digraph', 0),
  ('brownish', 'ow', 'primary', 'vowel_digraph', 0),
  ('crowded', 'ow', 'primary', 'vowel_digraph', 0),
  ('flowerpot', 'ow', 'primary', 'vowel_digraph', 0),
  ('powdery', 'ow', 'primary', 'vowel_digraph', 0),
  ('towering', 'ow', 'primary', 'vowel_digraph', 0),
  ('dash', 'sh', 'primary', 'consonant_digraph', 0),
  ('bash', 'sh', 'primary', 'consonant_digraph', 0),
  ('mash', 'sh', 'primary', 'consonant_digraph', 0),
  ('crash', 'sh', 'primary', 'consonant_digraph', 0),
  ('trash', 'sh', 'primary', 'consonant_digraph', 0),
  ('should', 'sh', 'primary', 'consonant_digraph', 0),
  ('shoulder', 'sh', 'primary', 'consonant_digraph', 0),
  ('shark', 'sh', 'primary', 'consonant_digraph', 0),
  ('shrink', 'sh', 'primary', 'consonant_digraph', 0),
  ('shred', 'sh', 'primary', 'consonant_digraph', 0),
  ('shrub', 'sh', 'primary', 'consonant_digraph', 0),
  ('foolish', 'sh', 'primary', 'consonant_digraph', 0),
  ('bait', 'ai', 'primary', 'vowel_digraph', 0),
  ('waist', 'ai', 'primary', 'vowel_digraph', 0),
  ('faint', 'ai', 'primary', 'vowel_digraph', 0),
  ('stain', 'ai', 'primary', 'vowel_digraph', 0),
  ('strain', 'ai', 'primary', 'vowel_digraph', 0),
  ('sprain', 'ai', 'primary', 'vowel_digraph', 0),
  ('email', 'ai', 'primary', 'vowel_digraph', 0),
  ('detail', 'ai', 'primary', 'vowel_digraph', 0),
  ('faithful', 'ai', 'primary', 'vowel_digraph', 0),
  ('mainland', 'ai', 'primary', 'vowel_digraph', 0),
  ('staying', 'ay', 'primary', 'vowel_digraph', 0),
  ('saying', 'ay', 'primary', 'vowel_digraph', 0),
  ('payment', 'ay', 'primary', 'vowel_digraph', 0),
  ('payable', 'ay', 'primary', 'vowel_digraph', 0),
  ('payday', 'ay', 'primary', 'vowel_digraph', 0),
  ('haystack', 'ay', 'primary', 'vowel_digraph', 0),
  ('stray', 'ay', 'primary', 'vowel_digraph', 0),
  ('sway', 'ay', 'primary', 'vowel_digraph', 0),
  ('layer', 'ay', 'primary', 'vowel_digraph', 0),
  ('runway', 'ay', 'primary', 'vowel_digraph', 0),
  ('coffee', 'ee', 'primary', 'vowel_digraph', 0),
  ('degree', 'ee', 'primary', 'vowel_digraph', 0),
  ('fifteen', 'ee', 'primary', 'vowel_digraph', 0),
  ('seventeen', 'ee', 'primary', 'vowel_digraph', 0),
  ('squeeze', 'ee', 'primary', 'vowel_digraph', 0),
  ('kneel', 'ee', 'primary', 'vowel_digraph', 0),
  ('freedom', 'ee', 'primary', 'vowel_digraph', 0),
  ('speechless', 'ee', 'primary', 'vowel_digraph', 0),
  ('beekeeper', 'ee', 'primary', 'vowel_digraph', 0),
  ('evergreen', 'ee', 'primary', 'vowel_digraph', 0),
  ('shorter', 'or', 'primary', 'r_controlled_vowel', 0),
  ('sporting', 'or', 'primary', 'r_controlled_vowel', 0),
  ('forget', 'or', 'primary', 'r_controlled_vowel', 0),
  ('forward', 'or', 'primary', 'r_controlled_vowel', 0),
  ('orchard', 'or', 'primary', 'r_controlled_vowel', 0),
  ('acorn', 'or', 'primary', 'r_controlled_vowel', 0),
  ('bookstore', 'or', 'primary', 'r_controlled_vowel', 0),
  ('corkscrew', 'or', 'primary', 'r_controlled_vowel', 0),
  ('stormcloud', 'or', 'primary', 'r_controlled_vowel', 0),
  ('borderline', 'or', 'primary', 'r_controlled_vowel', 0),
  ('thanks', 'th', 'primary', 'consonant_digraph', 0),
  ('thunder', 'th', 'primary', 'consonant_digraph', 0),
  ('throat', 'th', 'primary', 'consonant_digraph', 0),
  ('thoughtful', 'th', 'primary', 'consonant_digraph', 0),
  ('together', 'th', 'primary', 'consonant_digraph', 0),
  ('clothing', 'th', 'primary', 'consonant_digraph', 0),
  ('method', 'th', 'primary', 'consonant_digraph', 0),
  ('healthy', 'th', 'primary', 'consonant_digraph', 0),
  ('toothpaste', 'th', 'primary', 'consonant_digraph', 0),
  ('bathroom', 'th', 'primary', 'consonant_digraph', 0),
  ('mark', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('parking', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('darkness', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('charge', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('alarm', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('carve', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('dreamer', 'ea', 'primary', 'vowel_digraph', 0),
  ('steamer', 'ea', 'primary', 'vowel_digraph', 0),
  ('teapot', 'ea', 'primary', 'vowel_digraph', 0),
  ('seaside', 'ea', 'primary', 'vowel_digraph', 0),
  ('eastern', 'ea', 'primary', 'vowel_digraph', 0),
  ('teamwork', 'ea', 'primary', 'vowel_digraph', 0),
  ('worker', 'er', 'primary', 'r_controlled_vowel', 0),
  ('driver', 'er', 'primary', 'r_controlled_vowel', 0),
  ('writer', 'er', 'primary', 'r_controlled_vowel', 0),
  ('winner', 'er', 'primary', 'r_controlled_vowel', 0),
  ('printer', 'er', 'primary', 'r_controlled_vowel', 0),
  ('computer', 'er', 'primary', 'r_controlled_vowel', 0);

do $$
begin
  if (select count(*)::integer from wordloom_core_phase_8c_words) <> 250 then
    raise exception 'Wordloom core Phase 8C word count must be exactly 250.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8c_targets as expected
    left join (
      select primary_focus_grapheme as focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_8c_words
      group by primary_focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_8c_word_count
  ) then
    raise exception 'Wordloom core Phase 8C target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_8c_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 8C contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8c_words
    where word <> normalised_word
      or normalised_word <> lower(btrim(normalised_word))
      or normalised_word = ''
      or primary_focus_grapheme <> lower(btrim(primary_focus_grapheme))
      or not (focus_graphemes @> array[primary_focus_grapheme])
      or not (grapheme_segments @> array[primary_focus_grapheme])
      or array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 8C word metadata is not normalized.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8c_words
    where approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_8c_2026_05_14'
      or is_active is not true
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 8C words must be approved, suitable, active, and supported by context.';
  end if;

  if exists (
    select word_targets.normalised_word
    from wordloom_core_phase_8c_words as words
    left join wordloom_core_phase_8c_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by word_targets.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 8C word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 8C structured expansion batch 2 target'
from wordloom_core_phase_8c_targets
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
    from wordloom_core_phase_8c_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 8C linked targets must exist and be active.';
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
from wordloom_core_phase_8c_words
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
  'Wordloom core v1 Phase 8C structured expansion batch 2 target link'
from wordloom_core_phase_8c_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_8c_2026_05_14'
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
      and source_version = 'wordloom_core_v1_phase_8c_2026_05_14'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 250 then
    raise exception 'Wordloom core Phase 8C persisted word count must be exactly 250.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8c_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_8c_2026_05_14'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_8c_word_count
  ) then
    raise exception 'Wordloom core Phase 8C persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 8C.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_8c_2026_05_14'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 8C persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_8c_2026_05_14'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 8C persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_8c_2026_05_14'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 8C word must have exactly one primary target link.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join wordloom_core_phase_8c_words as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core Phase 8C must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join wordloom_core_phase_8c_words as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core Phase 8C must not add rows to school spelling bank additions.';
  end if;
end $$;

commit;
