begin;

create temporary table wordloom_core_phase_7e_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_7e_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_7e_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_7e_word_count
)
values
  ('ear', 'ear', 'diagnostic', 'secure_expected', 80, 10),
  ('er', 'er', 'diagnostic', 'secure_expected', 90, 16),
  ('oy', 'oy', 'floor_core', 'core_developing', 100, 10),
  ('oi', 'oi', 'floor_core', 'core_developing', 110, 10),
  ('ou', 'ou', 'floor_core', 'core_developing', 120, 14),
  ('ow', 'ow', 'floor_core', 'core_developing', 130, 14),
  ('th', 'th', 'floor_core', 'core_developing', 160, 16),
  ('ng', 'ng', 'floor_core', 'core_developing', 170, 14),
  ('dge', 'dge', 'ceiling_challenge', 'secure_expected', 190, 10),
  ('tion', 'tion', 'ceiling_challenge', 'early_stretch', 200, 14),
  ('ur', 'ur', 'diagnostic', 'secure_expected', 210, 14),
  ('ie', 'ie', 'ceiling_challenge', 'early_stretch', 220, 10),
  ('ci', 'ci', 'ceiling_challenge', 'early_stretch', 230, 10),
  ('ea', 'ea', 'floor_core', 'core_developing', 260, 2),
  ('ure', 'ure', 'ceiling_challenge', 'early_stretch', 280, 8),
  ('aw', 'aw', 'diagnostic', 'secure_expected', 290, 8);

create temporary table wordloom_core_phase_7e_words (
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

insert into wordloom_core_phase_7e_words (
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
  ('appear', 'appear', 'ear', array['a','pp','ear']::text[], array['ear']::text[], 'diagnostic', 54, 'Core', 'Two-syllable ear word with the target at the end.', 'Stars appear when the sky grows dark.', 'To become able to be seen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('clearing', 'clearing', 'ear', array['c','l','ear','i','ng']::text[], array['ear']::text[], 'diagnostic', 62, 'Stretch', 'Longer ear word with an initial blend and final ng segment.', 'Sunlight filled the clearing in the wood.', 'An open space in a group of trees.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('dear', 'dear', 'ear', array['d','ear']::text[], array['ear']::text[], 'diagnostic', 36, 'Core', 'Common ear word with a single initial consonant.', 'The dear note made Mum smile.', 'Loved, valued, or special to someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('disappear', 'disappear', 'ear', array['d','i','s','a','pp','ear']::text[], array['ear']::text[], 'diagnostic', 64, 'Stretch', 'Longer ear word with a prefix and target at the end.', 'The puddle will disappear in the sun.', 'To stop being seen or found.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('earring', 'earring', 'ear', array['ear','r','i','ng']::text[], array['ear']::text[], 'diagnostic', 56, 'Stretch', 'Two-syllable ear word with a final ng segment.', 'One silver earring was in the small box.', 'A piece of jewellery worn on the ear.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('gear', 'gear', 'ear', array['g','ear']::text[], array['ear']::text[], 'diagnostic', 38, 'Core', 'Common ear word with a single initial consonant.', 'Put your sports gear by the door.', 'Equipment or clothes used for an activity.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('hearing', 'hearing', 'ear', array['h','ear','i','ng']::text[], array['ear']::text[], 'diagnostic', 56, 'Stretch', 'Two-syllable ear word with an ing ending.', 'Good hearing helps us listen in class.', 'The ability to hear sounds.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('rear', 'rear', 'ear', array['r','ear']::text[], array['ear']::text[], 'diagnostic', 42, 'Core', 'Short ear word with a less common everyday meaning.', 'The rear door opened onto the garden.', 'The back part of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('tear', 'tear', 'ear', array['t','ear']::text[], array['ear']::text[], 'diagnostic', 42, 'Core', 'Short ear word with a common alternative meaning.', 'A tear rolled down his cheek after he yawned.', 'A drop of water that comes from the eye.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('wear', 'wear', 'ear', array['w','ear']::text[], array['ear']::text[], 'diagnostic', 40, 'Core', 'Common ear spelling with a different pronunciation.', 'Wear your coat on the cold walk.', 'To have clothes or shoes on your body.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('after', 'after', 'er', array['a','f','t','er']::text[], array['er']::text[], 'diagnostic', 36, 'Core', 'Common two-syllable er word.', 'We read quietly after lunch.', 'Later than something else.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('better', 'better', 'er', array['b','e','tt','er']::text[], array['er']::text[], 'diagnostic', 40, 'Core', 'Common er word with a doubled consonant.', 'The second try was better.', 'Of a higher quality or more useful.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('brother', 'brother', 'er', array['b','r','o','th','er']::text[], array['er']::text[], 'diagnostic', 50, 'Core', 'Common er word with an initial consonant blend.', 'My brother found the missing sock.', 'A boy or man with the same parent as another child.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('butter', 'butter', 'er', array['b','u','tt','er']::text[], array['er']::text[], 'diagnostic', 42, 'Core', 'Common er word with a doubled consonant.', 'Spread butter on the warm toast.', 'A soft yellow food made from cream.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('dinner', 'dinner', 'er', array['d','i','nn','er']::text[], array['er']::text[], 'diagnostic', 42, 'Core', 'Common er word with a doubled consonant.', 'Dinner was ready at six.', 'A main meal eaten during the day or evening.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('father', 'father', 'er', array['f','a','th','er']::text[], array['er']::text[], 'diagnostic', 46, 'Core', 'Common family word with th before er.', 'His father fixed the bike bell.', 'A male parent.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('flower', 'flower', 'er', array['f','l','ow','er']::text[], array['er']::text[], 'diagnostic', 54, 'Core', 'Two-syllable er word with another vowel digraph.', 'A yellow flower grew by the path.', 'The coloured part of a plant that can make seeds.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('helper', 'helper', 'er', array['h','e','l','p','er']::text[], array['er']::text[], 'diagnostic', 44, 'Core', 'Two-syllable er word with a final suffix.', 'The helper carried books to the shelf.', 'A person who helps with a task.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('ladder', 'ladder', 'er', array['l','a','dd','er']::text[], array['er']::text[], 'diagnostic', 44, 'Core', 'Two-syllable er word with a doubled consonant.', 'The ladder reached the low branch.', 'A tool with steps used for climbing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('mother', 'mother', 'er', array['m','o','th','er']::text[], array['er']::text[], 'diagnostic', 46, 'Core', 'Common family word with th before er.', 'Her mother packed a snack.', 'A female parent.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('never', 'never', 'er', array['n','e','v','er']::text[], array['er']::text[], 'diagnostic', 40, 'Core', 'Common two-syllable er word.', 'Never leave the gate open.', 'Not at any time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('over', 'over', 'er', array['o','v','er']::text[], array['er']::text[], 'diagnostic', 38, 'Core', 'Common positional er word.', 'The kite flew over the field.', 'Above or across something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('sister', 'sister', 'er', array['s','i','s','t','er']::text[], array['er']::text[], 'diagnostic', 48, 'Core', 'Common two-syllable er word.', 'Her sister chose the blue cup.', 'A girl or woman with the same parent as another child.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('summer', 'summer', 'er', array['s','u','mm','er']::text[], array['er']::text[], 'diagnostic', 44, 'Core', 'Common seasonal er word with a doubled consonant.', 'Summer days can feel bright and warm.', 'The season after spring and before autumn.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('under', 'under', 'er', array['u','n','d','er']::text[], array['er']::text[], 'diagnostic', 38, 'Core', 'Common positional er word.', 'The pencil rolled under the desk.', 'In or to a lower place than something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('water', 'water', 'er', array['w','a','t','er']::text[], array['er']::text[], 'diagnostic', 42, 'Core', 'Common er word with a different vowel sound.', 'Water filled the clear jug.', 'The clear liquid that people, plants, and animals need.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('cowboy', 'cowboy', 'oy', array['c','ow','b','oy']::text[], array['oy']::text[], 'floor_core', 54, 'Core', 'Two-syllable oy word with another vowel digraph.', 'The cowboy hat hung on a peg.', 'A person who works with cattle on a ranch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('decoy', 'decoy', 'oy', array['d','e','c','oy']::text[], array['oy']::text[], 'floor_core', 56, 'Stretch', 'Two-syllable oy word with the target at the end.', 'The wooden decoy floated on the pond.', 'Something used to attract attention away from the real thing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('destroy', 'destroy', 'oy', array['d','e','s','t','r','oy']::text[], array['oy']::text[], 'floor_core', 58, 'Stretch', 'Two-syllable oy word with an initial consonant cluster before the target.', 'Do not destroy the model after the show.', 'To damage something so it cannot be used.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('employ', 'employ', 'oy', array['e','m','p','l','oy']::text[], array['oy']::text[], 'floor_core', 58, 'Stretch', 'Two-syllable oy word with the target at the end.', 'The shop will employ a new helper.', 'To give someone paid work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('enjoyable', 'enjoyable', 'oy', array['e','n','j','oy','a','b','l','e']::text[], array['oy']::text[], 'floor_core', 62, 'Stretch', 'Longer oy word with a suffix.', 'The music lesson was enjoyable.', 'Pleasant and fun.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('joyful', 'joyful', 'oy', array['j','oy','f','u','l']::text[], array['oy']::text[], 'floor_core', 46, 'Core', 'Two-syllable oy word with a suffix.', 'The class gave a joyful cheer.', 'Full of happiness.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('loyal', 'loyal', 'oy', array['l','oy','a','l']::text[], array['oy']::text[], 'floor_core', 52, 'Core', 'Two-syllable oy word.', 'A loyal friend keeps a promise.', 'Faithful and ready to support someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('oyster', 'oyster', 'oy', array['oy','s','t','er']::text[], array['oy']::text[], 'floor_core', 58, 'Stretch', 'Two-syllable oy word with an er ending.', 'The oyster shell was smooth.', 'A shellfish that lives in the sea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('toys', 'toys', 'oy', array['t','oy','s']::text[], array['oy']::text[], 'floor_core', 32, 'Easier', 'Short common oy word with a final consonant.', 'The toys went back in the box.', 'Objects that children play with.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('voyage', 'voyage', 'oy', array['v','oy','a','g','e']::text[], array['oy']::text[], 'floor_core', 58, 'Stretch', 'Two-syllable oy word with final silent e.', 'The ship began its long voyage.', 'A long journey, often by sea or through space.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('avoid', 'avoid', 'oi', array['a','v','oi','d']::text[], array['oi']::text[], 'floor_core', 48, 'Core', 'Two-syllable oi word with the target in the middle.', 'Walk around the puddle to avoid wet shoes.', 'To keep away from something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('choice', 'choice', 'oi', array['ch','oi','c','e']::text[], array['oi']::text[], 'floor_core', 44, 'Core', 'Common oi word with another multiletter grapheme.', 'You have a choice of two books.', 'The act of choosing between things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('coil', 'coil', 'oi', array['c','oi','l']::text[], array['oi']::text[], 'floor_core', 38, 'Core', 'Short oi word with a final consonant.', 'The rope lay in a neat coil.', 'A round loop or curl of something long.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('foil', 'foil', 'oi', array['f','oi','l']::text[], array['oi']::text[], 'floor_core', 34, 'Easier', 'Short oi word with a final consonant.', 'Wrap the sandwich in foil.', 'Thin shiny metal used for covering food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('hoist', 'hoist', 'oi', array['h','oi','s','t']::text[], array['oi']::text[], 'floor_core', 52, 'Core', 'Oi word with a final consonant cluster.', 'We helped hoist the flag.', 'To lift something up.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('joint', 'joint', 'oi', array['j','oi','n','t']::text[], array['oi']::text[], 'floor_core', 46, 'Core', 'Oi word with a final consonant cluster.', 'The robot arm bent at one joint.', 'A place where two parts are joined.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('noise', 'noise', 'oi', array['n','oi','s','e']::text[], array['oi']::text[], 'floor_core', 38, 'Core', 'Common oi word with final silent e.', 'A loud noise came from the hall.', 'A sound, especially one that is loud or unwanted.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('noisy', 'noisy', 'oi', array['n','oi','s','y']::text[], array['oi']::text[], 'floor_core', 40, 'Core', 'Two-syllable oi word with a suffix.', 'The playground was noisy at break.', 'Full of loud sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('oil', 'oil', 'oi', array['oi','l']::text[], array['oi']::text[], 'floor_core', 28, 'Easier', 'Short common oi word.', 'A little oil made the wheel turn smoothly.', 'A thick liquid used for cooking or machines.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('voice', 'voice', 'oi', array['v','oi','c','e']::text[], array['oi']::text[], 'floor_core', 40, 'Core', 'Common oi word with final silent e.', 'Use a calm voice in the library.', 'The sound made when someone speaks or sings.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('about', 'about', 'ou', array['a','b','ou','t']::text[], array['ou']::text[], 'floor_core', 34, 'Easier', 'Common two-syllable ou word.', 'Tell me about your picture.', 'Connected with or on the subject of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('around', 'around', 'ou', array['a','r','ou','n','d']::text[], array['ou']::text[], 'floor_core', 38, 'Core', 'Common two-syllable ou word with a final consonant cluster.', 'We walked around the pond.', 'On all sides of something or in a circle.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('bounce', 'bounce', 'ou', array['b','ou','n','c','e']::text[], array['ou']::text[], 'floor_core', 42, 'Core', 'Common ou word with final silent e.', 'The ball can bounce on the hard floor.', 'To spring back after hitting a surface.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('couch', 'couch', 'ou', array['c','ou','ch']::text[], array['ou']::text[], 'floor_core', 40, 'Core', 'Common ou word with a final ch segment.', 'The cushion fell from the couch.', 'A long soft seat for sitting on.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('ground', 'ground', 'ou', array['g','r','ou','n','d']::text[], array['ou']::text[], 'floor_core', 44, 'Core', 'Common ou word with consonant clusters.', 'Leaves covered the ground.', 'The surface of the earth under your feet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('house', 'house', 'ou', array['h','ou','s','e']::text[], array['ou']::text[], 'floor_core', 34, 'Easier', 'Common ou word with final silent e.', 'The house had a red front door.', 'A building where people live.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('mountain', 'mountain', 'ou', array['m','ou','n','t','ai','n']::text[], array['ou']::text[], 'floor_core', 54, 'Core', 'Two-syllable ou word with another vowel digraph.', 'Snow lay on the mountain top.', 'A very high natural area of land.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('mouse', 'mouse', 'ou', array['m','ou','s','e']::text[], array['ou']::text[], 'floor_core', 36, 'Core', 'Common ou word with final silent e.', 'The toy mouse was grey.', 'A small animal with a long tail.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('mouth', 'mouth', 'ou', array['m','ou','th']::text[], array['ou']::text[], 'floor_core', 38, 'Core', 'Common ou word with a final th segment.', 'Smile with your mouth closed for the photo.', 'The part of the face used for eating and speaking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('proud', 'proud', 'ou', array['p','r','ou','d']::text[], array['ou']::text[], 'floor_core', 42, 'Core', 'Common ou word with an initial consonant blend.', 'Mia felt proud of her neat work.', 'Pleased because of something done well.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('shout', 'shout', 'ou', array['sh','ou','t']::text[], array['ou']::text[], 'floor_core', 40, 'Core', 'Common ou word with an initial sh segment.', 'Please do not shout across the room.', 'To speak very loudly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('sound', 'sound', 'ou', array['s','ou','n','d']::text[], array['ou']::text[], 'floor_core', 38, 'Core', 'Common ou word with a final consonant cluster.', 'The bell made a clear sound.', 'Something that can be heard.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('south', 'south', 'ou', array['s','ou','th']::text[], array['ou']::text[], 'floor_core', 44, 'Core', 'Common ou word with a final th segment.', 'The map showed south at the bottom.', 'The direction opposite north.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('thousand', 'thousand', 'ou', array['th','ou','s','a','n','d']::text[], array['ou']::text[], 'floor_core', 56, 'Stretch', 'Longer ou word with another multiletter grapheme.', 'A thousand grains of sand filled the jar.', 'The number 1000.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('allow', 'allow', 'ow', array['a','ll','ow']::text[], array['ow']::text[], 'floor_core', 48, 'Core', 'Two-syllable ow word with a doubled consonant.', 'The rules allow one extra turn.', 'To let something happen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('clown', 'clown', 'ow', array['c','l','ow','n']::text[], array['ow']::text[], 'floor_core', 42, 'Core', 'Common ow word with an initial consonant blend.', 'The clown wore a bright hat.', 'A performer who tries to make people laugh.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('crowd', 'crowd', 'ow', array['c','r','ow','d']::text[], array['ow']::text[], 'floor_core', 44, 'Core', 'Common ow word with an initial consonant blend.', 'A small crowd waited by the stage.', 'A large group of people together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('frown', 'frown', 'ow', array['f','r','ow','n']::text[], array['ow']::text[], 'floor_core', 44, 'Core', 'Ow word with an initial consonant blend.', 'A frown crossed his face for a moment.', 'A look that shows worry or displeasure.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('growl', 'growl', 'ow', array['g','r','ow','l']::text[], array['ow']::text[], 'floor_core', 46, 'Core', 'Ow word with an initial consonant blend and final consonant.', 'The engine made a low growl.', 'A deep rough sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('how', 'how', 'ow', array['h','ow']::text[], array['ow']::text[], 'floor_core', 28, 'Easier', 'Short common ow word.', 'How did you solve the puzzle?', 'In what way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('owl', 'owl', 'ow', array['ow','l']::text[], array['ow']::text[], 'floor_core', 32, 'Easier', 'Short ow word with a final consonant.', 'The owl picture was on the card.', 'A bird with large eyes that often hunts at night.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('powder', 'powder', 'ow', array['p','ow','d','er']::text[], array['ow']::text[], 'floor_core', 52, 'Core', 'Two-syllable ow word with an er ending.', 'Fine powder covered the tray.', 'Dry material made of tiny loose grains.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('power', 'power', 'ow', array['p','ow','er']::text[], array['ow']::text[], 'floor_core', 46, 'Core', 'Two-syllable ow word with an er ending.', 'The lamp needed power to shine.', 'Energy that makes something work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('shower', 'shower', 'ow', array['sh','ow','er']::text[], array['ow']::text[], 'floor_core', 48, 'Core', 'Two-syllable ow word with other multiletter segments.', 'A quick shower of rain passed over.', 'A short fall of rain or a spray of water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('towel', 'towel', 'ow', array['t','ow','e','l']::text[], array['ow']::text[], 'floor_core', 44, 'Core', 'Two-syllable ow word.', 'Hang the towel on the rail.', 'A piece of cloth used for drying things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('tower', 'tower', 'ow', array['t','ow','er']::text[], array['ow']::text[], 'floor_core', 46, 'Core', 'Two-syllable ow word with an er ending.', 'The tall tower had a clock.', 'A high narrow building or structure.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('window', 'window', 'ow', array['w','i','n','d','ow']::text[], array['ow']::text[], 'floor_core', 50, 'Core', 'Common two-syllable ow word with a different pronunciation.', 'Open the window a little.', 'An opening with glass that lets in light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('yellow', 'yellow', 'ow', array['y','e','ll','ow']::text[], array['ow']::text[], 'floor_core', 48, 'Core', 'Common two-syllable ow word with a different pronunciation.', 'The yellow cup was on the shelf.', 'The colour of lemons and sunshine.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('cloth', 'cloth', 'th', array['c','l','o','th']::text[], array['th']::text[], 'floor_core', 44, 'Core', 'Th word with an initial consonant blend and target at the end.', 'Use a cloth to wipe the table.', 'Material made from woven threads.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('month', 'month', 'th', array['m','o','n','th']::text[], array['th']::text[], 'floor_core', 42, 'Core', 'Common th word with the target at the end.', 'Next month we visit the museum.', 'One of the twelve parts of a year.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('than', 'than', 'th', array['th','a','n']::text[], array['th']::text[], 'floor_core', 32, 'Easier', 'Short common th word.', 'Sam is taller than Ben.', 'A word used when comparing things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('that', 'that', 'th', array['th','a','t']::text[], array['th']::text[], 'floor_core', 24, 'Easier', 'Short high-frequency th word.', 'That bag belongs on the hook.', 'A word used to point to a thing or idea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('them', 'them', 'th', array['th','e','m']::text[], array['th']::text[], 'floor_core', 28, 'Easier', 'Short common th word.', 'Give them a turn with the game.', 'A word used for other people or things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('then', 'then', 'th', array['th','e','n']::text[], array['th']::text[], 'floor_core', 28, 'Easier', 'Short common th word.', 'Finish the line, then check it.', 'After that time or next.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('there', 'there', 'th', array['th','er','e']::text[], array['th']::text[], 'floor_core', 36, 'Core', 'Common th word with an er segment.', 'Put the tray over there.', 'In or at that place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('these', 'these', 'th', array['th','e','s','e']::text[], array['th']::text[], 'floor_core', 34, 'Easier', 'Common th word with final silent e.', 'These pencils are sharp.', 'A word used for more than one thing close by.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('they', 'they', 'th', array['th','e','y']::text[], array['th']::text[], 'floor_core', 30, 'Easier', 'Short common th word.', 'They waited quietly by the door.', 'A word used for two or more people or things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('thick', 'thick', 'th', array['th','i','ck']::text[], array['th']::text[], 'floor_core', 40, 'Core', 'Common th word with a final ck segment.', 'The thick book stood on the shelf.', 'Wide from one side to the other.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('thing', 'thing', 'th', array['th','i','ng']::text[], array['th']::text[], 'floor_core', 38, 'Core', 'Common th word with a final ng segment.', 'One thing was missing from the box.', 'An object, idea, or item.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('think', 'think', 'th', array['th','i','n','k']::text[], array['th']::text[], 'floor_core', 36, 'Core', 'Common th word with a final consonant cluster.', 'Think before you answer.', 'To use your mind to consider something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('this', 'this', 'th', array['th','i','s']::text[], array['th']::text[], 'floor_core', 24, 'Easier', 'Short high-frequency th word.', 'This page has a map.', 'A word used for something close by.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('those', 'those', 'th', array['th','o','s','e']::text[], array['th']::text[], 'floor_core', 34, 'Easier', 'Common th word with final silent e.', 'Those shoes are by the mat.', 'A word used for more than one thing farther away.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('thread', 'thread', 'th', array['th','r','ea','d']::text[], array['th']::text[], 'floor_core', 48, 'Core', 'Th word with an initial consonant cluster and ea segment.', 'A red thread lay on the table.', 'A thin strand used for sewing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('thumb', 'thumb', 'th', array['th','u','m','b']::text[], array['th']::text[], 'floor_core', 42, 'Core', 'Common th word with a final silent consonant.', 'Press the button with your thumb.', 'The short thick finger on the side of your hand.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('along', 'along', 'ng', array['a','l','o','ng']::text[], array['ng']::text[], 'floor_core', 40, 'Core', 'Two-syllable ng word with target at the end.', 'Walk along the path to the gate.', 'Moving beside or following the length of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('belong', 'belong', 'ng', array['b','e','l','o','ng']::text[], array['ng']::text[], 'floor_core', 46, 'Core', 'Two-syllable ng word with target at the end.', 'The blue coat may belong to Omar.', 'To be owned by someone or fit in a place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('bring', 'bring', 'ng', array['b','r','i','ng']::text[], array['ng']::text[], 'floor_core', 36, 'Core', 'Common ng word with an initial consonant blend.', 'Bring your book to the carpet.', 'To carry something to a place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('evening', 'evening', 'ng', array['e','v','e','n','i','ng']::text[], array['ng']::text[], 'floor_core', 50, 'Core', 'Longer ng word with an ing ending.', 'The evening sky turned pink.', 'The later part of the day before night.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('helping', 'helping', 'ng', array['h','e','l','p','i','ng']::text[], array['ng']::text[], 'floor_core', 50, 'Core', 'Two-syllable ng word with an ing ending.', 'Helping a friend is kind.', 'Giving support or making a task easier.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('looking', 'looking', 'ng', array['l','oo','k','i','ng']::text[], array['ng']::text[], 'floor_core', 52, 'Core', 'Two-syllable ng word with an ing ending.', 'Looking carefully helped us find the clue.', 'Using your eyes to search or notice.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('playing', 'playing', 'ng', array['p','l','ay','i','ng']::text[], array['ng']::text[], 'floor_core', 52, 'Core', 'Two-syllable ng word with another vowel digraph.', 'Playing outside made everyone smile.', 'Taking part in a game or fun activity.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('sing', 'sing', 'ng', array['s','i','ng']::text[], array['ng']::text[], 'floor_core', 28, 'Easier', 'Short common ng word.', 'We sing the song together.', 'To make music with your voice.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('spring', 'spring', 'ng', array['s','p','r','i','ng']::text[], array['ng']::text[], 'floor_core', 44, 'Core', 'Ng word with a longer initial consonant cluster.', 'Spring flowers grew near the fence.', 'The season after winter and before summer.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('string', 'string', 'ng', array['s','t','r','i','ng']::text[], array['ng']::text[], 'floor_core', 46, 'Core', 'Ng word with a longer initial consonant cluster.', 'Tie the card with string.', 'Thin cord made from twisted threads.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('walking', 'walking', 'ng', array['w','a','l','k','i','ng']::text[], array['ng']::text[], 'floor_core', 50, 'Core', 'Two-syllable ng word with an ing ending.', 'Walking to school keeps us active.', 'Moving on foot at a steady pace.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('wing', 'wing', 'ng', array['w','i','ng']::text[], array['ng']::text[], 'floor_core', 30, 'Easier', 'Short common ng word.', 'The paper plane had one bent wing.', 'A part used for flying.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('wrong', 'wrong', 'ng', array['w','r','o','ng']::text[], array['ng']::text[], 'floor_core', 44, 'Core', 'Common ng word with a silent initial consonant.', 'The answer was wrong, so we tried again.', 'Not correct.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('young', 'young', 'ng', array['y','ou','ng']::text[], array['ng']::text[], 'floor_core', 42, 'Core', 'Common ng word with an ou segment.', 'The young plant needed water.', 'Not old or fully grown.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('budge', 'budge', 'dge', array['b','u','dge']::text[], array['dge']::text[], 'ceiling_challenge', 54, 'Core', 'Short dge word with a single initial consonant.', 'The heavy drawer would not budge.', 'To move a little.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('fridge', 'fridge', 'dge', array['f','r','i','dge']::text[], array['dge']::text[], 'ceiling_challenge', 56, 'Stretch', 'Common dge word with an initial consonant blend.', 'Put the milk back in the fridge.', 'A cold cupboard used to keep food fresh.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('judge', 'judge', 'dge', array['j','u','dge']::text[], array['dge']::text[], 'ceiling_challenge', 50, 'Core', 'Common dge word with a single initial consonant.', 'The judge chose the neatest poster.', 'A person who decides a result or choice.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('ledge', 'ledge', 'dge', array['l','e','dge']::text[], array['dge']::text[], 'ceiling_challenge', 50, 'Core', 'Short dge word with a single initial consonant.', 'The plant sat on the window ledge.', 'A narrow shelf-like edge.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('lodge', 'lodge', 'dge', array['l','o','dge']::text[], array['dge']::text[], 'ceiling_challenge', 54, 'Core', 'Short dge word with a single initial consonant.', 'The small lodge stood by the lake.', 'A small house or building used for stays.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('nudge', 'nudge', 'dge', array['n','u','dge']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Short dge word with a single initial consonant.', 'A gentle nudge moved the box along.', 'A small push.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('ridge', 'ridge', 'dge', array['r','i','dge']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Short dge word with a single initial consonant.', 'The path followed the ridge of the hill.', 'A long raised line or high narrow area.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('sledge', 'sledge', 'dge', array['s','l','e','dge']::text[], array['dge']::text[], 'ceiling_challenge', 58, 'Stretch', 'Dge word with an initial consonant blend.', 'The sledge slid over the snow.', 'A low frame used for sliding over snow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('smudge', 'smudge', 'dge', array['s','m','u','dge']::text[], array['dge']::text[], 'ceiling_challenge', 58, 'Stretch', 'Dge word with an initial consonant blend.', 'A smudge of paint marked the page.', 'A blurred or messy mark.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('wedge', 'wedge', 'dge', array['w','e','dge']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Short dge word with a single initial consonant.', 'A wooden wedge held the door open.', 'A piece with one thick end and one thin end.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('addition', 'addition', 'tion', array['a','dd','i','tion']::text[], array['tion']::text[], 'ceiling_challenge', 60, 'Stretch', 'Common tion word used in school maths.', 'Addition helps us find the total.', 'The act of adding numbers or things together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('caution', 'caution', 'tion', array['c','au','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Tion word with another vowel digraph.', 'Use caution near the wet floor.', 'Care taken to avoid a problem.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('celebration', 'celebration', 'tion', array['c','e','l','e','b','r','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 72, 'Stretch', 'Longer tion word with four syllable parts.', 'The celebration began with music.', 'A happy event for a special reason.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('collection', 'collection', 'tion', array['c','o','ll','e','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 68, 'Stretch', 'Longer tion word with a doubled consonant.', 'Her shell collection filled a small tray.', 'A group of things gathered together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('description', 'description', 'tion', array['d','e','s','c','r','i','p','tion']::text[], array['tion']::text[], 'ceiling_challenge', 74, 'Stretch', 'Longer tion word with a consonant cluster before the target.', 'Write a description of the garden.', 'Words that tell what someone or something is like.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('direction', 'direction', 'tion', array['d','i','r','e','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 66, 'Stretch', 'Longer tion word with several consonants before the target.', 'The arrow showed the right direction.', 'The way something points or moves.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('information', 'information', 'tion', array['i','n','f','or','m','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 72, 'Stretch', 'Longer tion word with an r-controlled segment.', 'The poster gave useful information.', 'Facts or details about something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('invention', 'invention', 'tion', array['i','n','v','e','n','tion']::text[], array['tion']::text[], 'ceiling_challenge', 66, 'Stretch', 'Tion word with the target after a consonant.', 'Her invention held pencils upright.', 'A new thing that someone has made or designed.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('invitation', 'invitation', 'tion', array['i','n','v','i','t','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 70, 'Stretch', 'Longer tion word with several syllable parts.', 'An invitation arrived in a blue envelope.', 'A request asking someone to come to an event.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('lotion', 'lotion', 'tion', array['l','o','tion']::text[], array['tion']::text[], 'ceiling_challenge', 58, 'Stretch', 'Shorter tion word with the target at the end.', 'The lotion made her hands soft.', 'A liquid or cream put on skin.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('motion', 'motion', 'tion', array['m','o','tion']::text[], array['tion']::text[], 'ceiling_challenge', 58, 'Stretch', 'Shorter tion word with the target at the end.', 'The swing moved in a smooth motion.', 'Movement from one place or position to another.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('option', 'option', 'tion', array['o','p','tion']::text[], array['tion']::text[], 'ceiling_challenge', 58, 'Stretch', 'Shorter tion word with the target at the end.', 'You can choose one option from the list.', 'A choice that is available.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('portion', 'portion', 'tion', array['p','or','tion']::text[], array['tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Tion word with an r-controlled segment.', 'Each pupil had a small portion of fruit.', 'A part or share of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('subtraction', 'subtraction', 'tion', array['s','u','b','t','r','a','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 70, 'Stretch', 'Longer tion word used in school maths.', 'Subtraction tells us how many are left.', 'The act of taking one number or amount from another.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('burger', 'burger', 'ur', array['b','ur','g','er']::text[], array['ur']::text[], 'diagnostic', 50, 'Core', 'Two-syllable ur word with an er ending.', 'The bean burger was warm.', 'A round cooked food served in a bun.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('curl', 'curl', 'ur', array['c','ur','l']::text[], array['ur']::text[], 'diagnostic', 38, 'Core', 'Short ur word with a final consonant.', 'One curl fell across her forehead.', 'A piece of hair or material in a curved shape.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('curly', 'curly', 'ur', array['c','ur','l','y']::text[], array['ur']::text[], 'diagnostic', 46, 'Core', 'Two-syllable ur word with a suffix.', 'Curly ribbon decorated the card.', 'Having curls or curved shapes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('curtain', 'curtain', 'ur', array['c','ur','t','ai','n']::text[], array['ur']::text[], 'diagnostic', 52, 'Core', 'Two-syllable ur word with another vowel digraph.', 'Close the curtain before the film.', 'Cloth that hangs by a window or stage.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('during', 'during', 'ur', array['d','ur','i','ng']::text[], array['ur']::text[], 'diagnostic', 50, 'Core', 'Two-syllable ur word with a final ng segment.', 'We listened during the story.', 'At some time while something is happening.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('fur', 'fur', 'ur', array['f','ur']::text[], array['ur']::text[], 'diagnostic', 34, 'Easier', 'Short common ur word.', 'The toy rabbit had soft fur.', 'The thick hair that covers some animals.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('hurry', 'hurry', 'ur', array['h','ur','r','y']::text[], array['ur']::text[], 'diagnostic', 46, 'Core', 'Two-syllable ur word.', 'Hurry gently so you do not trip.', 'To move or act quickly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('purple', 'purple', 'ur', array['p','ur','p','l','e']::text[], array['ur']::text[], 'diagnostic', 46, 'Core', 'Common two-syllable ur word.', 'The purple folder was on the desk.', 'A colour made from red and blue.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('purse', 'purse', 'ur', array['p','ur','s','e']::text[], array['ur']::text[], 'diagnostic', 42, 'Core', 'Common ur word with final silent e.', 'The coin was in a small purse.', 'A small bag for money or personal things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('return', 'return', 'ur', array['r','e','t','ur','n']::text[], array['ur']::text[], 'diagnostic', 52, 'Core', 'Two-syllable ur word with the target in the middle.', 'Return the book to the library.', 'To go or bring something back.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('surf', 'surf', 'ur', array['s','ur','f']::text[], array['ur']::text[], 'diagnostic', 42, 'Core', 'Short ur word with a final consonant.', 'The surf rolled onto the beach.', 'Waves breaking near the shore.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('surprise', 'surprise', 'ur', array['s','ur','p','r','i','s','e']::text[], array['ur']::text[], 'diagnostic', 58, 'Stretch', 'Longer ur word with consonant clusters.', 'The surprise note was inside the box.', 'Something unexpected.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('thursday', 'thursday', 'ur', array['th','ur','s','d','ay']::text[], array['ur']::text[], 'diagnostic', 60, 'Stretch', 'Longer ur word with other multiletter graphemes.', 'Thursday is our library day.', 'The day of the week after Wednesday.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('turtle', 'turtle', 'ur', array['t','ur','t','l','e']::text[], array['ur']::text[], 'diagnostic', 48, 'Core', 'Common two-syllable ur word.', 'The turtle moved slowly across the sand.', 'An animal with a hard shell.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('belief', 'belief', 'ie', array['b','e','l','ie','f']::text[], array['ie']::text[], 'ceiling_challenge', 60, 'Stretch', 'Longer ie word with the target in the middle.', 'His belief in teamwork helped the group.', 'An idea that someone thinks is true.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('cried', 'cried', 'ie', array['c','r','ie','d']::text[], array['ie']::text[], 'ceiling_challenge', 54, 'Core', 'Ie word with an initial consonant blend.', 'The baby cried until Dad sang softly.', 'Made tears or a loud upset sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('dried', 'dried', 'ie', array['d','r','ie','d']::text[], array['ie']::text[], 'ceiling_challenge', 54, 'Core', 'Ie word with an initial consonant blend.', 'The wet socks dried by the heater.', 'Became free from water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('friend', 'friend', 'ie', array['f','r','ie','n','d']::text[], array['ie']::text[], 'ceiling_challenge', 58, 'Stretch', 'Common ie word with a different pronunciation.', 'A friend saved me a seat.', 'Someone you like and know well.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('niece', 'niece', 'ie', array['n','ie','c','e']::text[], array['ie']::text[], 'ceiling_challenge', 58, 'Stretch', 'Ie word with final silent e.', 'My niece sent a drawing.', 'The daughter of your brother or sister.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('pie', 'pie', 'ie', array['p','ie']::text[], array['ie']::text[], 'ceiling_challenge', 42, 'Core', 'Short common ie word.', 'A small pie cooled on the tray.', 'A baked dish with pastry and filling.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('quiet', 'quiet', 'ie', array['q','u','ie','t']::text[], array['ie']::text[], 'ceiling_challenge', 62, 'Stretch', 'Two-syllable ie word with the target in the middle.', 'The room was quiet during reading.', 'Making little or no noise.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('relief', 'relief', 'ie', array['r','e','l','ie','f']::text[], array['ie']::text[], 'ceiling_challenge', 60, 'Stretch', 'Longer ie word with the target in the middle.', 'Relief came when the lost key was found.', 'A good feeling after worry or difficulty ends.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('tie', 'tie', 'ie', array['t','ie']::text[], array['ie']::text[], 'ceiling_challenge', 42, 'Core', 'Short common ie word.', 'Tie the ribbon in a bow.', 'To fasten something with a knot.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('tried', 'tried', 'ie', array['t','r','ie','d']::text[], array['ie']::text[], 'ceiling_challenge', 54, 'Core', 'Ie word with an initial consonant blend.', 'She tried the puzzle again.', 'Made an effort to do something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('cinema', 'cinema', 'ci', array['ci','n','e','m','a']::text[], array['ci']::text[], 'ceiling_challenge', 58, 'Stretch', 'Two-syllable soft ci word at the start.', 'The cinema showed a short film.', 'A place where people watch films.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('circle', 'circle', 'ci', array['ci','r','c','l','e']::text[], array['ci']::text[], 'ceiling_challenge', 54, 'Core', 'Common soft ci word at the start.', 'Draw a circle around the answer.', 'A round flat shape.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('citrus', 'citrus', 'ci', array['ci','t','r','u','s']::text[], array['ci']::text[], 'ceiling_challenge', 58, 'Stretch', 'Soft ci word with an initial target.', 'Citrus fruit can taste sharp and sweet.', 'Fruit such as oranges, lemons, or limes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('city', 'city', 'ci', array['ci','t','y']::text[], array['ci']::text[], 'ceiling_challenge', 48, 'Core', 'Common soft ci word at the start.', 'The city had a busy train station.', 'A large town where many people live and work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('decimal', 'decimal', 'ci', array['d','e','ci','m','a','l']::text[], array['ci']::text[], 'ceiling_challenge', 64, 'Stretch', 'Three-syllable soft ci word used in maths.', 'The decimal point was after the zero.', 'A number written with a point to show parts of one.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('decision', 'decision', 'ci', array['d','e','ci','s','i','o','n']::text[], array['ci']::text[], 'ceiling_challenge', 66, 'Stretch', 'Three-syllable soft ci word.', 'The team made a fair decision.', 'A choice made after thinking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('magician', 'magician', 'ci', array['m','a','g','i','ci','a','n']::text[], array['ci']::text[], 'ceiling_challenge', 70, 'Stretch', 'Longer soft ci word with several syllable parts.', 'The magician pulled a scarf from a hat.', 'A person who performs tricks for an audience.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('musician', 'musician', 'ci', array['m','u','s','i','ci','a','n']::text[], array['ci']::text[], 'ceiling_challenge', 70, 'Stretch', 'Longer soft ci word with several syllable parts.', 'The musician played a gentle tune.', 'A person who plays or writes music.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('pencil', 'pencil', 'ci', array['p','e','n','ci','l']::text[], array['ci']::text[], 'ceiling_challenge', 54, 'Core', 'Common soft ci word in the middle.', 'Sharpen the pencil before writing.', 'A tool used for writing or drawing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('recipe', 'recipe', 'ci', array['r','e','ci','p','e']::text[], array['ci']::text[], 'ceiling_challenge', 60, 'Stretch', 'Three-syllable soft ci word in the middle.', 'The recipe listed flour and eggs.', 'Instructions for making food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('heat', 'heat', 'ea', array['h','ea','t']::text[], array['ea']::text[], 'floor_core', 32, 'Easier', 'Short common ea word with a final consonant.', 'Heat from the sun dried the path.', 'Warmth or a high temperature.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('meal', 'meal', 'ea', array['m','ea','l']::text[], array['ea']::text[], 'floor_core', 30, 'Easier', 'Short common ea word with a final consonant.', 'The meal smelled warm and tasty.', 'Food eaten at one time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('adventure', 'adventure', 'ure', array['a','d','v','e','n','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 72, 'Stretch', 'Longer ure word with several consonants before the target.', 'The story was full of adventure.', 'An exciting experience or journey.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('culture', 'culture', 'ure', array['c','u','l','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 68, 'Stretch', 'Two-syllable ure word with a consonant cluster before the target.', 'Food and music can show culture.', 'The ideas, customs, and art shared by a group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('feature', 'feature', 'ure', array['f','ea','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 66, 'Stretch', 'Longer ure word with another vowel digraph.', 'The best feature was the secret drawer.', 'An important or noticeable part of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('furniture', 'furniture', 'ure', array['f','ur','n','i','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 72, 'Stretch', 'Longer ure word with another r-controlled segment.', 'The furniture was arranged neatly.', 'Large useful things in a room, such as tables and chairs.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('measure', 'measure', 'ure', array['m','ea','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 64, 'Stretch', 'Longer ure word with another vowel digraph.', 'Measure the ribbon before you cut it.', 'To find the size or amount of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('signature', 'signature', 'ure', array['s','i','g','n','a','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 74, 'Stretch', 'Longer ure word with several consonants before the target.', 'Write your signature at the bottom.', 'Your name written in your own way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('temperature', 'temperature', 'ure', array['t','e','m','p','er','a','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 76, 'Stretch', 'Longer ure word with an er segment.', 'The temperature was lower in the shade.', 'How hot or cold something is.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('treasure', 'treasure', 'ure', array['t','r','ea','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 64, 'Stretch', 'Longer ure word with another vowel digraph.', 'The treasure box held shiny buttons.', 'Something valuable or special.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('claw', 'claw', 'aw', array['c','l','aw']::text[], array['aw']::text[], 'diagnostic', 42, 'Core', 'Aw word with an initial consonant blend.', 'The model crab had one big claw.', 'A sharp curved nail or pincer.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('jaw', 'jaw', 'aw', array['j','aw']::text[], array['aw']::text[], 'diagnostic', 34, 'Easier', 'Short common aw word.', 'Her jaw moved as she chewed.', 'The bone area that holds the teeth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('law', 'law', 'aw', array['l','aw']::text[], array['aw']::text[], 'diagnostic', 36, 'Core', 'Short common aw word.', 'The class made a fair law for the game.', 'A rule made for people to follow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('paw', 'paw', 'aw', array['p','aw']::text[], array['aw']::text[], 'diagnostic', 34, 'Easier', 'Short common aw word.', 'The toy dog had a soft paw.', 'An animal foot with claws or pads.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('raw', 'raw', 'aw', array['r','aw']::text[], array['aw']::text[], 'diagnostic', 36, 'Core', 'Short common aw word.', 'The raw carrot snapped loudly.', 'Not cooked yet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('seesaw', 'seesaw', 'aw', array['s','ee','s','aw']::text[], array['aw']::text[], 'diagnostic', 50, 'Core', 'Two-syllable aw word with another vowel digraph.', 'The seesaw tipped up and down.', 'A playground board that moves up and down.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('shawl', 'shawl', 'aw', array['sh','aw','l']::text[], array['aw']::text[], 'diagnostic', 48, 'Core', 'Aw word with an initial sh segment.', 'Grandma folded the warm shawl.', 'A large piece of cloth worn over the shoulders.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true),
  ('thaw', 'thaw', 'aw', array['th','aw']::text[], array['aw']::text[], 'diagnostic', 46, 'Core', 'Aw word with an initial th segment.', 'The ice began to thaw in the sun.', 'To melt after being frozen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7e_2026_05_13', true);

create temporary table wordloom_core_phase_7e_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_7e_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('about', 'ou', 'primary', 'vowel_digraph', 0),
  ('addition', 'tion', 'primary', 'trigraph', 0),
  ('adventure', 'ure', 'primary', 'trigraph', 0),
  ('after', 'er', 'primary', 'r_controlled_vowel', 0),
  ('allow', 'ow', 'primary', 'vowel_digraph', 0),
  ('along', 'ng', 'primary', 'consonant_digraph', 0),
  ('appear', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('around', 'ou', 'primary', 'vowel_digraph', 0),
  ('avoid', 'oi', 'primary', 'vowel_digraph', 0),
  ('belief', 'ie', 'primary', 'vowel_digraph', 0),
  ('belong', 'ng', 'primary', 'consonant_digraph', 0),
  ('better', 'er', 'primary', 'r_controlled_vowel', 0),
  ('bounce', 'ou', 'primary', 'vowel_digraph', 0),
  ('bring', 'ng', 'primary', 'consonant_digraph', 0),
  ('brother', 'er', 'primary', 'r_controlled_vowel', 0),
  ('budge', 'dge', 'primary', 'trigraph', 0),
  ('burger', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('butter', 'er', 'primary', 'r_controlled_vowel', 0),
  ('caution', 'tion', 'primary', 'trigraph', 0),
  ('celebration', 'tion', 'primary', 'trigraph', 0),
  ('choice', 'oi', 'primary', 'vowel_digraph', 0),
  ('cinema', 'ci', 'primary', 'soft_c', 0),
  ('circle', 'ci', 'primary', 'soft_c', 0),
  ('citrus', 'ci', 'primary', 'soft_c', 0),
  ('city', 'ci', 'primary', 'soft_c', 0),
  ('claw', 'aw', 'primary', 'vowel_digraph', 0),
  ('clearing', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('cloth', 'th', 'primary', 'consonant_digraph', 0),
  ('clown', 'ow', 'primary', 'vowel_digraph', 0),
  ('coil', 'oi', 'primary', 'vowel_digraph', 0),
  ('collection', 'tion', 'primary', 'trigraph', 0),
  ('couch', 'ou', 'primary', 'vowel_digraph', 0),
  ('cowboy', 'oy', 'primary', 'vowel_digraph', 0),
  ('cried', 'ie', 'primary', 'vowel_digraph', 0),
  ('crowd', 'ow', 'primary', 'vowel_digraph', 0),
  ('culture', 'ure', 'primary', 'trigraph', 0),
  ('curl', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('curly', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('curtain', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('dear', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('decimal', 'ci', 'primary', 'soft_c', 0),
  ('decision', 'ci', 'primary', 'soft_c', 0),
  ('decoy', 'oy', 'primary', 'vowel_digraph', 0),
  ('description', 'tion', 'primary', 'trigraph', 0),
  ('destroy', 'oy', 'primary', 'vowel_digraph', 0),
  ('dinner', 'er', 'primary', 'r_controlled_vowel', 0),
  ('direction', 'tion', 'primary', 'trigraph', 0),
  ('disappear', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('dried', 'ie', 'primary', 'vowel_digraph', 0),
  ('during', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('earring', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('employ', 'oy', 'primary', 'vowel_digraph', 0),
  ('enjoyable', 'oy', 'primary', 'vowel_digraph', 0),
  ('evening', 'ng', 'primary', 'consonant_digraph', 0),
  ('father', 'er', 'primary', 'r_controlled_vowel', 0),
  ('feature', 'ure', 'primary', 'trigraph', 0),
  ('flower', 'er', 'primary', 'r_controlled_vowel', 0),
  ('foil', 'oi', 'primary', 'vowel_digraph', 0),
  ('fridge', 'dge', 'primary', 'trigraph', 0),
  ('friend', 'ie', 'primary', 'vowel_digraph', 0),
  ('frown', 'ow', 'primary', 'vowel_digraph', 0),
  ('fur', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('furniture', 'ure', 'primary', 'trigraph', 0),
  ('gear', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('ground', 'ou', 'primary', 'vowel_digraph', 0),
  ('growl', 'ow', 'primary', 'vowel_digraph', 0),
  ('hearing', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('heat', 'ea', 'primary', 'vowel_digraph', 0),
  ('helper', 'er', 'primary', 'r_controlled_vowel', 0),
  ('helping', 'ng', 'primary', 'consonant_digraph', 0),
  ('hoist', 'oi', 'primary', 'vowel_digraph', 0),
  ('house', 'ou', 'primary', 'vowel_digraph', 0),
  ('how', 'ow', 'primary', 'vowel_digraph', 0),
  ('hurry', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('information', 'tion', 'primary', 'trigraph', 0),
  ('invention', 'tion', 'primary', 'trigraph', 0),
  ('invitation', 'tion', 'primary', 'trigraph', 0),
  ('jaw', 'aw', 'primary', 'vowel_digraph', 0),
  ('joint', 'oi', 'primary', 'vowel_digraph', 0),
  ('joyful', 'oy', 'primary', 'vowel_digraph', 0),
  ('judge', 'dge', 'primary', 'trigraph', 0),
  ('ladder', 'er', 'primary', 'r_controlled_vowel', 0),
  ('law', 'aw', 'primary', 'vowel_digraph', 0),
  ('ledge', 'dge', 'primary', 'trigraph', 0),
  ('lodge', 'dge', 'primary', 'trigraph', 0),
  ('looking', 'ng', 'primary', 'consonant_digraph', 0),
  ('lotion', 'tion', 'primary', 'trigraph', 0),
  ('loyal', 'oy', 'primary', 'vowel_digraph', 0),
  ('magician', 'ci', 'primary', 'soft_c', 0),
  ('meal', 'ea', 'primary', 'vowel_digraph', 0),
  ('measure', 'ure', 'primary', 'trigraph', 0),
  ('month', 'th', 'primary', 'consonant_digraph', 0),
  ('mother', 'er', 'primary', 'r_controlled_vowel', 0),
  ('motion', 'tion', 'primary', 'trigraph', 0),
  ('mountain', 'ou', 'primary', 'vowel_digraph', 0),
  ('mouse', 'ou', 'primary', 'vowel_digraph', 0),
  ('mouth', 'ou', 'primary', 'vowel_digraph', 0),
  ('musician', 'ci', 'primary', 'soft_c', 0),
  ('never', 'er', 'primary', 'r_controlled_vowel', 0),
  ('niece', 'ie', 'primary', 'vowel_digraph', 0),
  ('noise', 'oi', 'primary', 'vowel_digraph', 0),
  ('noisy', 'oi', 'primary', 'vowel_digraph', 0),
  ('nudge', 'dge', 'primary', 'trigraph', 0),
  ('oil', 'oi', 'primary', 'vowel_digraph', 0),
  ('option', 'tion', 'primary', 'trigraph', 0),
  ('over', 'er', 'primary', 'r_controlled_vowel', 0),
  ('owl', 'ow', 'primary', 'vowel_digraph', 0),
  ('oyster', 'oy', 'primary', 'vowel_digraph', 0),
  ('paw', 'aw', 'primary', 'vowel_digraph', 0),
  ('pencil', 'ci', 'primary', 'soft_c', 0),
  ('pie', 'ie', 'primary', 'vowel_digraph', 0),
  ('playing', 'ng', 'primary', 'consonant_digraph', 0),
  ('portion', 'tion', 'primary', 'trigraph', 0),
  ('powder', 'ow', 'primary', 'vowel_digraph', 0),
  ('power', 'ow', 'primary', 'vowel_digraph', 0),
  ('proud', 'ou', 'primary', 'vowel_digraph', 0),
  ('purple', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('purse', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('quiet', 'ie', 'primary', 'vowel_digraph', 0),
  ('raw', 'aw', 'primary', 'vowel_digraph', 0),
  ('rear', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('recipe', 'ci', 'primary', 'soft_c', 0),
  ('relief', 'ie', 'primary', 'vowel_digraph', 0),
  ('return', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('ridge', 'dge', 'primary', 'trigraph', 0),
  ('seesaw', 'aw', 'primary', 'vowel_digraph', 0),
  ('shawl', 'aw', 'primary', 'vowel_digraph', 0),
  ('shout', 'ou', 'primary', 'vowel_digraph', 0),
  ('shower', 'ow', 'primary', 'vowel_digraph', 0),
  ('signature', 'ure', 'primary', 'trigraph', 0),
  ('sing', 'ng', 'primary', 'consonant_digraph', 0),
  ('sister', 'er', 'primary', 'r_controlled_vowel', 0),
  ('sledge', 'dge', 'primary', 'trigraph', 0),
  ('smudge', 'dge', 'primary', 'trigraph', 0),
  ('sound', 'ou', 'primary', 'vowel_digraph', 0),
  ('south', 'ou', 'primary', 'vowel_digraph', 0),
  ('spring', 'ng', 'primary', 'consonant_digraph', 0),
  ('string', 'ng', 'primary', 'consonant_digraph', 0),
  ('subtraction', 'tion', 'primary', 'trigraph', 0),
  ('summer', 'er', 'primary', 'r_controlled_vowel', 0),
  ('surf', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('surprise', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('tear', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('temperature', 'ure', 'primary', 'trigraph', 0),
  ('than', 'th', 'primary', 'consonant_digraph', 0),
  ('that', 'th', 'primary', 'consonant_digraph', 0),
  ('thaw', 'aw', 'primary', 'vowel_digraph', 0),
  ('them', 'th', 'primary', 'consonant_digraph', 0),
  ('then', 'th', 'primary', 'consonant_digraph', 0),
  ('there', 'th', 'primary', 'consonant_digraph', 0),
  ('these', 'th', 'primary', 'consonant_digraph', 0),
  ('they', 'th', 'primary', 'consonant_digraph', 0),
  ('thick', 'th', 'primary', 'consonant_digraph', 0),
  ('thing', 'th', 'primary', 'consonant_digraph', 0),
  ('think', 'th', 'primary', 'consonant_digraph', 0),
  ('this', 'th', 'primary', 'consonant_digraph', 0),
  ('those', 'th', 'primary', 'consonant_digraph', 0),
  ('thousand', 'ou', 'primary', 'vowel_digraph', 0),
  ('thread', 'th', 'primary', 'consonant_digraph', 0),
  ('thumb', 'th', 'primary', 'consonant_digraph', 0),
  ('thursday', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('tie', 'ie', 'primary', 'vowel_digraph', 0),
  ('towel', 'ow', 'primary', 'vowel_digraph', 0),
  ('tower', 'ow', 'primary', 'vowel_digraph', 0),
  ('toys', 'oy', 'primary', 'vowel_digraph', 0),
  ('treasure', 'ure', 'primary', 'trigraph', 0),
  ('tried', 'ie', 'primary', 'vowel_digraph', 0),
  ('turtle', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('under', 'er', 'primary', 'r_controlled_vowel', 0),
  ('voice', 'oi', 'primary', 'vowel_digraph', 0),
  ('voyage', 'oy', 'primary', 'vowel_digraph', 0),
  ('walking', 'ng', 'primary', 'consonant_digraph', 0),
  ('water', 'er', 'primary', 'r_controlled_vowel', 0),
  ('wear', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('wedge', 'dge', 'primary', 'trigraph', 0),
  ('window', 'ow', 'primary', 'vowel_digraph', 0),
  ('wing', 'ng', 'primary', 'consonant_digraph', 0),
  ('wrong', 'ng', 'primary', 'consonant_digraph', 0),
  ('yellow', 'ow', 'primary', 'vowel_digraph', 0),
  ('young', 'ng', 'primary', 'consonant_digraph', 0);

do $$
begin
  if (select count(*) from wordloom_core_phase_7e_words) <> 180 then
    raise exception 'Wordloom core Phase 7E batch must contain exactly 180 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7e_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_7e_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_7e_word_count
  ) then
    raise exception 'Wordloom core Phase 7E target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_7e_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 7E batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_7e_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> 'wordloom_core_v1_phase_7e_2026_05_13'
  ) then
    raise exception 'Wordloom core Phase 7E batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7e_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_7e_2026_05_13'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 7E words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7e_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ) then
    raise exception 'Wordloom core Phase 7E words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7e_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ) then
    raise exception 'Wordloom core Phase 7E words contain explicit spelling-hint context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7e_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 7E words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7e_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 7E primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7e_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 7E word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7e_word_targets as word_targets
    left join wordloom_core_phase_7e_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 7E word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_7e_words as words
    left join wordloom_core_phase_7e_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 7E word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 7E bulk top-up batch target'
from wordloom_core_phase_7e_targets
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
    from wordloom_core_phase_7e_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 7E linked targets must exist and be active.';
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
from wordloom_core_phase_7e_words
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
  'Wordloom core v1 Phase 7E bulk top-up batch target link'
from wordloom_core_phase_7e_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_7e_2026_05_13'
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
      and source_version = 'wordloom_core_v1_phase_7e_2026_05_13'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 180 then
    raise exception 'Wordloom core Phase 7E persisted word count must be exactly 180.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7e_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_7e_2026_05_13'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_7e_word_count
  ) then
    raise exception 'Wordloom core Phase 7E persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 7E.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_7e_2026_05_13'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 7E persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_7e_2026_05_13'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 7E persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_7e_2026_05_13'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 7E word must have exactly one primary target link.';
  end if;
  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join wordloom_core_phase_7e_words as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core Phase 7E must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join wordloom_core_phase_7e_words as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core Phase 7E must not add rows to school spelling bank additions.';
  end if;

end $$;

commit;
