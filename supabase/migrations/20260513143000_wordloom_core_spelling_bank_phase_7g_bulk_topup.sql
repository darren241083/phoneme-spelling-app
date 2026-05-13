begin;

create temporary table wordloom_core_phase_7g_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_7g_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_7g_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_7g_word_count
)
values
  ('ai', 'ai', 'floor_core', 'needs_support', 10, 6),
  ('ee', 'ee', 'floor_core', 'needs_support', 20, 6),
  ('oa', 'oa', 'floor_core', 'needs_support', 30, 4),
  ('igh', 'igh', 'floor_core', 'core_developing', 40, 6),
  ('ar', 'ar', 'floor_core', 'core_developing', 50, 6),
  ('or', 'or', 'floor_core', 'core_developing', 60, 6),
  ('air', 'air', 'diagnostic', 'secure_expected', 70, 6),
  ('ear', 'ear', 'diagnostic', 'secure_expected', 80, 8),
  ('er', 'er', 'diagnostic', 'secure_expected', 90, 10),
  ('oy', 'oy', 'floor_core', 'core_developing', 100, 6),
  ('oi', 'oi', 'floor_core', 'core_developing', 110, 6),
  ('ou', 'ou', 'floor_core', 'core_developing', 120, 8),
  ('ow', 'ow', 'floor_core', 'core_developing', 130, 8),
  ('sh', 'sh', 'floor_core', 'needs_support', 140, 6),
  ('ch', 'ch', 'floor_core', 'needs_support', 150, 6),
  ('th', 'th', 'floor_core', 'core_developing', 160, 8),
  ('ng', 'ng', 'floor_core', 'core_developing', 170, 8),
  ('ck', 'ck', 'floor_core', 'needs_support', 180, 4),
  ('dge', 'dge', 'ceiling_challenge', 'secure_expected', 190, 6),
  ('tion', 'tion', 'ceiling_challenge', 'early_stretch', 200, 8),
  ('ur', 'ur', 'diagnostic', 'secure_expected', 210, 8),
  ('ie', 'ie', 'ceiling_challenge', 'early_stretch', 220, 6),
  ('ci', 'ci', 'ceiling_challenge', 'early_stretch', 230, 4),
  ('au', 'au', 'ceiling_challenge', 'secure_expected', 240, 4),
  ('ay', 'ay', 'floor_core', 'needs_support', 250, 6),
  ('ea', 'ea', 'floor_core', 'core_developing', 260, 6),
  ('ew', 'ew', 'diagnostic', 'secure_expected', 270, 6),
  ('ure', 'ure', 'ceiling_challenge', 'early_stretch', 280, 4),
  ('aw', 'aw', 'diagnostic', 'secure_expected', 290, 4);

create temporary table wordloom_core_phase_7g_words (
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

insert into wordloom_core_phase_7g_words (
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
  ('mailbox', 'mailbox', 'ai', array['m','ai','l','b','o','x']::text[], array['ai']::text[], 'floor_core', 37, 'Core', 'ai vowel_digraph word with age-appropriate classroom context.', 'The mailbox stood beside the front gate.', 'A box where letters can be delivered.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('painter', 'painter', 'ai', array['p','ai','n','t','er']::text[], array['ai']::text[], 'floor_core', 30, 'Easier', 'ai vowel_digraph word with age-appropriate classroom context.', 'The painter cleaned the brush after art club.', 'A person who adds colour to walls or pictures.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('painting', 'painting', 'ai', array['p','ai','n','t','i','ng']::text[], array['ai']::text[], 'floor_core', 35, 'Core', 'ai vowel_digraph word with age-appropriate classroom context.', 'The painting showed a bright garden path.', 'A picture made with paint.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('railway', 'railway', 'ai', array['r','ai','l','w','ay']::text[], array['ai']::text[], 'floor_core', 30, 'Easier', 'ai vowel_digraph word with age-appropriate classroom context.', 'The railway ran beside the fields.', 'A track system used by trains.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('rainbow', 'rainbow', 'ai', array['r','ai','n','b','ow']::text[], array['ai']::text[], 'floor_core', 34, 'Easier', 'ai vowel_digraph word with age-appropriate classroom context.', 'A rainbow appeared after the light rain.', 'A curved band of colours seen in the sky.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('sailboat', 'sailboat', 'ai', array['s','ai','l','b','oa','t']::text[], array['ai']::text[], 'floor_core', 35, 'Core', 'ai vowel_digraph word with age-appropriate classroom context.', 'The sailboat moved slowly across the lake.', 'A small boat that uses a sail.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('feed', 'feed', 'ee', array['f','ee','d']::text[], array['ee']::text[], 'floor_core', 24, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'We feed the class plant every Monday.', 'To give food to a person, animal, or plant.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('heel', 'heel', 'ee', array['h','ee','l']::text[], array['ee']::text[], 'floor_core', 28, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'The heel of the shoe was muddy.', 'The back part of a foot or shoe.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('peel', 'peel', 'ee', array['p','ee','l']::text[], array['ee']::text[], 'floor_core', 26, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'Dad helped peel the orange for lunch.', 'To take the outer skin off food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('screen', 'screen', 'ee', array['s','c','r','ee','n']::text[], array['ee']::text[], 'floor_core', 34, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'The screen showed the class timetable.', 'A flat surface that shows pictures or words.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('seem', 'seem', 'ee', array['s','ee','m']::text[], array['ee']::text[], 'floor_core', 24, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'The puzzle may seem tricky at first.', 'To give the feeling of being a certain way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('seen', 'seen', 'ee', array['s','ee','n']::text[], array['ee']::text[], 'floor_core', 26, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'I have seen that picture in a book.', 'Looked at or noticed before now.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('coal', 'coal', 'oa', array['c','oa','l']::text[], array['oa']::text[], 'floor_core', 26, 'Easier', 'oa vowel_digraph word with age-appropriate classroom context.', 'The drawing showed a black piece of coal.', 'A dark rock that can be used as fuel.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('foal', 'foal', 'oa', array['f','oa','l']::text[], array['oa']::text[], 'floor_core', 28, 'Easier', 'oa vowel_digraph word with age-appropriate classroom context.', 'The foal stayed close to its mother.', 'A young horse.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('moan', 'moan', 'oa', array['m','oa','n']::text[], array['oa']::text[], 'floor_core', 24, 'Easier', 'oa vowel_digraph word with age-appropriate classroom context.', 'Please ask for help instead of a moan.', 'A low unhappy sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('toad', 'toad', 'oa', array['t','oa','d']::text[], array['oa']::text[], 'floor_core', 24, 'Easier', 'oa vowel_digraph word with age-appropriate classroom context.', 'A toad sat quietly under the leaf.', 'A small hopping animal similar to a frog.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('highlight', 'highlight', 'igh', array['h','igh','l','igh','t']::text[], array['igh']::text[], 'floor_core', 44, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'Please highlight the title in yellow.', 'To mark something so it stands out.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('moonlight', 'moonlight', 'igh', array['m','oo','n','l','igh','t']::text[], array['igh']::text[], 'floor_core', 47, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'Moonlight shone on the quiet path.', 'Light that seems to come from the moon.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('nightfall', 'nightfall', 'igh', array['n','igh','t','f','a','ll']::text[], array['igh']::text[], 'floor_core', 43, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'We packed away the game before nightfall.', 'The time when evening becomes dark.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('skylight', 'skylight', 'igh', array['s','k','y','l','igh','t']::text[], array['igh']::text[], 'floor_core', 45, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'The skylight made the hall brighter.', 'A window set into a roof.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('starlight', 'starlight', 'igh', array['s','t','ar','l','igh','t']::text[], array['igh']::text[], 'floor_core', 43, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'Starlight sparkled above the campsite.', 'Light from stars in the night sky.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('sunlight', 'sunlight', 'igh', array['s','u','n','l','igh','t']::text[], array['igh']::text[], 'floor_core', 45, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'Sunlight warmed the classroom window.', 'Light that comes from the sun.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('arch', 'arch', 'ar', array['ar','ch']::text[], array['ar']::text[], 'floor_core', 38, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'The stone arch stood over the doorway.', 'A curved shape over an opening.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('art', 'art', 'ar', array['ar','t']::text[], array['ar']::text[], 'floor_core', 36, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'Art club painted leaves in bright colours.', 'Drawing, painting, or making creative work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('chart', 'chart', 'ar', array['ch','ar','t']::text[], array['ar']::text[], 'floor_core', 34, 'Easier', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'The chart showed our reading progress.', 'A page that displays information clearly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('harp', 'harp', 'ar', array['h','ar','p']::text[], array['ar']::text[], 'floor_core', 38, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'The harp made a gentle sound.', 'A large stringed musical instrument.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('marble', 'marble', 'ar', array['m','ar','b','l','e']::text[], array['ar']::text[], 'floor_core', 40, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'The marble rolled across the tray.', 'A small hard ball used in games.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('spark', 'spark', 'ar', array['s','p','ar','k']::text[], array['ar']::text[], 'floor_core', 39, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'A spark of sunlight lit the window.', 'A tiny bright flash of light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('cork', 'cork', 'or', array['c','or','k']::text[], array['or']::text[], 'floor_core', 36, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'The cork floated in the water tray.', 'A light material that can float.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('horn', 'horn', 'or', array['h','or','n']::text[], array['or']::text[], 'floor_core', 38, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'The bike horn made one short beep.', 'A device that makes a warning sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('northward', 'northward', 'or', array['n','or','th','w','ar','d']::text[], array['or']::text[], 'floor_core', 45, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'The path led northward across the field.', 'Moving or pointing towards the north.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('port', 'port', 'or', array['p','or','t']::text[], array['or']::text[], 'floor_core', 34, 'Easier', 'or r_controlled_vowel word with age-appropriate classroom context.', 'The ferry waited at the port.', 'A place where boats can stop.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('stormy', 'stormy', 'or', array['s','t','or','m','y']::text[], array['or']::text[], 'floor_core', 40, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'The stormy sky soon became calm.', 'Having strong wind or heavy rain.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('storybook', 'storybook', 'or', array['s','t','or','y','b','oo','k']::text[], array['or']::text[], 'floor_core', 50, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'The storybook had a red cover.', 'A book of stories.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('airing', 'airing', 'air', array['air','i','ng']::text[], array['air']::text[], 'diagnostic', 46, 'Core', 'air r_controlled_vowel word with age-appropriate classroom context.', 'The blanket was airing by the window.', 'Letting fresh air dry or freshen something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('airship', 'airship', 'air', array['air','sh','i','p']::text[], array['air']::text[], 'diagnostic', 47, 'Core', 'air r_controlled_vowel word with age-appropriate classroom context.', 'The airship floated across the poster.', 'A large flying craft filled with gas.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('chairlift', 'chairlift', 'air', array['ch','air','l','i','f','t']::text[], array['air']::text[], 'diagnostic', 57, 'Stretch', 'air r_controlled_vowel word with age-appropriate classroom context.', 'The chairlift carried riders up the hill.', 'A moving seat that carries people uphill.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('fairytale', 'fairytale', 'air', array['f','air','y','t','a','l','e']::text[], array['air']::text[], 'diagnostic', 56, 'Stretch', 'air r_controlled_vowel word with age-appropriate classroom context.', 'The fairytale ended with a clever plan.', 'A made-up story with magical events.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('hairclip', 'hairclip', 'air', array['h','air','c','l','i','p']::text[], array['air']::text[], 'diagnostic', 55, 'Stretch', 'air r_controlled_vowel word with age-appropriate classroom context.', 'A blue hairclip sat on the shelf.', 'A small clip used to hold hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('hairpin', 'hairpin', 'air', array['h','air','p','i','n']::text[], array['air']::text[], 'diagnostic', 54, 'Core', 'air r_controlled_vowel word with age-appropriate classroom context.', 'The hairpin kept the ribbon in place.', 'A thin pin used to hold hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('clearer', 'clearer', 'ear', array['c','l','ear','er']::text[], array['ear']::text[], 'diagnostic', 49, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'The second photo looked clearer.', 'Easier to see or understand.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('clearly', 'clearly', 'ear', array['c','l','ear','l','y']::text[], array['ear']::text[], 'diagnostic', 54, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'Please speak clearly to the group.', 'In a way that is easy to hear or understand.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('ear', 'ear', 'ear', array['ear']::text[], array['ear']::text[], 'diagnostic', 46, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'My ear felt warm under the hat.', 'The part of the body used for hearing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('fear', 'fear', 'ear', array['f','ear']::text[], array['ear']::text[], 'diagnostic', 48, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'The dark stage caused no fear for Maya.', 'A worried feeling about possible danger.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('nearby', 'nearby', 'ear', array['n','ear','b','y']::text[], array['ear']::text[], 'diagnostic', 51, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'A nearby bench was free in the park.', 'Close to a place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('nearly', 'nearly', 'ear', array['n','ear','l','y']::text[], array['ear']::text[], 'diagnostic', 47, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'The paper chain is nearly finished.', 'Almost, but not completely.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('yearbook', 'yearbook', 'ear', array['y','ear','b','oo','k']::text[], array['ear']::text[], 'diagnostic', 52, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'The yearbook showed photos from every class.', 'A book that remembers a school year.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('yearly', 'yearly', 'ear', array['y','ear','l','y']::text[], array['ear']::text[], 'diagnostic', 47, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'The school fair is a yearly event.', 'Happening once every year.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('answer', 'answer', 'er', array['a','n','s','w','er']::text[], array['er']::text[], 'diagnostic', 54, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'Write your answer on the line.', 'A reply to a question.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('clever', 'clever', 'er', array['c','l','e','v','er']::text[], array['er']::text[], 'diagnostic', 52, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The clever plan saved time.', 'Quick at learning or solving problems.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('cover', 'cover', 'er', array['c','o','v','er']::text[], array['er']::text[], 'diagnostic', 49, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The cover kept the book clean.', 'Something placed over or around another thing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('ever', 'ever', 'er', array['e','v','er']::text[], array['er']::text[], 'diagnostic', 48, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'This is the tallest tower ever built here.', 'At any time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('number', 'number', 'er', array['n','u','m','b','er']::text[], array['er']::text[], 'diagnostic', 50, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'Write the number at the top.', 'A symbol or amount used for counting.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('other', 'other', 'er', array['o','th','er']::text[], array['er']::text[], 'diagnostic', 44, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The other pencil is in the tray.', 'A different one from the first.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('paper', 'paper', 'er', array['p','a','p','er']::text[], array['er']::text[], 'diagnostic', 47, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The paper folded into a neat boat.', 'Thin material used for writing or drawing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('river', 'river', 'er', array['r','i','v','er']::text[], array['er']::text[], 'diagnostic', 49, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The river moved slowly past the town.', 'A long stream of water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('runner', 'runner', 'er', array['r','u','nn','er']::text[], array['er']::text[], 'diagnostic', 47, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The runner slowed near the finish line.', 'A person who runs.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('silver', 'silver', 'er', array['s','i','l','v','er']::text[], array['er']::text[], 'diagnostic', 54, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The silver ribbon shone in the light.', 'A shiny grey colour or metal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('enjoyment', 'enjoyment', 'oy', array['e','n','j','oy','m','e','n','t']::text[], array['oy']::text[], 'floor_core', 51, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'The game brought enjoyment to the group.', 'A feeling of pleasure in doing something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('joyfully', 'joyfully', 'oy', array['j','oy','f','u','ll','y']::text[], array['oy']::text[], 'floor_core', 47, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'The children sang joyfully in assembly.', 'In a happy way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('soy', 'soy', 'oy', array['s','oy']::text[], array['oy']::text[], 'floor_core', 34, 'Easier', 'oy vowel_digraph word with age-appropriate classroom context.', 'Soy milk stood beside the cereal.', 'A bean used to make some foods and drinks.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('toybox', 'toybox', 'oy', array['t','oy','b','o','x']::text[], array['oy']::text[], 'floor_core', 42, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'The toybox closed after tidy time.', 'A box used for keeping toys.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('toymaker', 'toymaker', 'oy', array['t','oy','m','a','k','er']::text[], array['oy']::text[], 'floor_core', 43, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'The toymaker carved a tiny boat.', 'A person who makes toys.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('toyshop', 'toyshop', 'oy', array['t','oy','sh','o','p']::text[], array['oy']::text[], 'floor_core', 44, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'The toyshop window had a train set.', 'A shop that sells toys.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('joined', 'joined', 'oi', array['j','oi','n','e','d']::text[], array['oi']::text[], 'floor_core', 44, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'The two tracks joined near the bridge.', 'Came together or became connected.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('moist', 'moist', 'oi', array['m','oi','s','t']::text[], array['oi']::text[], 'floor_core', 41, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'The soil was moist after rain.', 'Slightly wet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('oink', 'oink', 'oi', array['oi','n','k']::text[], array['oi']::text[], 'floor_core', 34, 'Easier', 'oi vowel_digraph word with age-appropriate classroom context.', 'The puppet pig made an oink sound.', 'The sound a pig makes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('pointed', 'pointed', 'oi', array['p','oi','n','t','e','d']::text[], array['oi']::text[], 'floor_core', 43, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'The sign pointed towards the library.', 'Showed a direction with a finger or marker.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('pointer', 'pointer', 'oi', array['p','oi','n','t','er']::text[], array['oi']::text[], 'floor_core', 42, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'The pointer helped us read the chart.', 'A stick or mark used to show something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('void', 'void', 'oi', array['v','oi','d']::text[], array['oi']::text[], 'floor_core', 36, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'Leave that box void of extra paper.', 'Empty or having nothing inside.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('cloudy', 'cloudy', 'ou', array['c','l','ou','d','y']::text[], array['ou']::text[], 'floor_core', 42, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'The cloudy sky kept the day cool.', 'Covered with many clouds.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('flour', 'flour', 'ou', array['f','l','ou','r']::text[], array['ou']::text[], 'floor_core', 39, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'Flour dusted the baking table.', 'Fine powder made from grain for baking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('hour', 'hour', 'ou', array['h','ou','r']::text[], array['ou']::text[], 'floor_core', 38, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'The lesson lasted one hour.', 'Sixty minutes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('outside', 'outside', 'ou', array['ou','t','s','i','d','e']::text[], array['ou']::text[], 'floor_core', 43, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'We lined up outside after lunch.', 'Not inside a building or room.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('pound', 'pound', 'ou', array['p','ou','n','d']::text[], array['ou']::text[], 'floor_core', 37, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'The bag weighed one pound on the scale.', 'A unit used to measure weight.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('scout', 'scout', 'ou', array['s','c','ou','t']::text[], array['ou']::text[], 'floor_core', 39, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'The scout looked ahead for the path.', 'Someone who searches or checks ahead.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('sprout', 'sprout', 'ou', array['s','p','r','ou','t']::text[], array['ou']::text[], 'floor_core', 40, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'A tiny sprout grew in the pot.', 'A new shoot from a seed or plant.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('trout', 'trout', 'ou', array['t','r','ou','t']::text[], array['ou']::text[], 'floor_core', 41, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'A trout swam under the bridge.', 'A fish that lives in rivers or lakes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('blow', 'blow', 'ow', array['b','l','ow']::text[], array['ow']::text[], 'floor_core', 38, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'Blow gently on the warm soup.', 'To move air from the mouth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('bow', 'bow', 'ow', array['b','ow']::text[], array['ow']::text[], 'floor_core', 38, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'Tie the ribbon into a bow.', 'A looped knot made with ribbon or string.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('glow', 'glow', 'ow', array['g','l','ow']::text[], array['ow']::text[], 'floor_core', 36, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'The lantern gave a warm glow.', 'A steady soft light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('low', 'low', 'ow', array['l','ow']::text[], array['ow']::text[], 'floor_core', 36, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'The low shelf was easy to reach.', 'Close to the ground.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('row', 'row', 'ow', array['r','ow']::text[], array['ow']::text[], 'floor_core', 34, 'Easier', 'ow vowel_digraph word with age-appropriate classroom context.', 'Sit in the front row for assembly.', 'A line of people or things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('slow', 'slow', 'ow', array['s','l','ow']::text[], array['ow']::text[], 'floor_core', 38, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'The slow train stopped at each village.', 'Moving with little speed.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('snow', 'snow', 'ow', array['s','n','ow']::text[], array['ow']::text[], 'floor_core', 34, 'Easier', 'ow vowel_digraph word with age-appropriate classroom context.', 'Snow covered the school field softly.', 'Soft white frozen flakes from clouds.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('wow', 'wow', 'ow', array['w','ow']::text[], array['ow']::text[], 'floor_core', 36, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'Wow, the model bridge is strong.', 'A word people say when surprised or pleased.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('ash', 'ash', 'sh', array['a','sh']::text[], array['sh']::text[], 'floor_core', 28, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'The ash from the cold fire was swept away.', 'Soft grey powder left after burning wood.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('shall', 'shall', 'sh', array['sh','a','ll']::text[], array['sh']::text[], 'floor_core', 26, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'Shall we start the puzzle now?', 'Used to ask or say what will happen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('shampoo', 'shampoo', 'sh', array['sh','a','m','p','oo']::text[], array['sh']::text[], 'floor_core', 30, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'The shampoo bottle was almost empty.', 'Liquid soap used for washing hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('share', 'share', 'sh', array['sh','a','r','e']::text[], array['sh']::text[], 'floor_core', 31, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'Please share the counters with your partner.', 'To let someone else use part of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('shovel', 'shovel', 'sh', array['sh','o','v','e','l']::text[], array['sh']::text[], 'floor_core', 32, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'Use the shovel to move the sand.', 'A tool for lifting soil, sand, or snow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('shy', 'shy', 'sh', array['sh','y']::text[], array['sh']::text[], 'floor_core', 24, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'The shy pupil smiled at the group.', 'Quiet or nervous with other people.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('chapter', 'chapter', 'ch', array['ch','a','p','t','er']::text[], array['ch']::text[], 'floor_core', 30, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'We read one chapter before lunch.', 'One main part of a book.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('chase', 'chase', 'ch', array['ch','a','s','e']::text[], array['ch']::text[], 'floor_core', 27, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'The children chase bubbles in the garden.', 'To run after something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('chill', 'chill', 'ch', array['ch','i','ll']::text[], array['ch']::text[], 'floor_core', 26, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'A chill came through the open door.', 'A feeling of being cold.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('chime', 'chime', 'ch', array['ch','i','m','e']::text[], array['ch']::text[], 'floor_core', 31, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'The clock gave a gentle chime.', 'A clear ringing sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('chimney', 'chimney', 'ch', array['ch','i','m','n','ey']::text[], array['ch']::text[], 'floor_core', 32, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'The chimney rose above the roof.', 'A tall pipe that carries smoke away.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('chunk', 'chunk', 'ch', array['ch','u','n','k']::text[], array['ch']::text[], 'floor_core', 31, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'A chunk of bread sat on the plate.', 'A thick piece of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('both', 'both', 'th', array['b','o','th']::text[], array['th']::text[], 'floor_core', 36, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'Both pencils need sharpening.', 'The two people or things together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('fifth', 'fifth', 'th', array['f','i','f','th']::text[], array['th']::text[], 'floor_core', 37, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'The fifth page has a map.', 'Number five in order.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('maths', 'maths', 'th', array['m','a','th','s']::text[], array['th']::text[], 'floor_core', 41, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'We used blocks in maths today.', 'A school subject about numbers and shapes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('sixth', 'sixth', 'th', array['s','i','x','th']::text[], array['th']::text[], 'floor_core', 39, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'The sixth runner wore a green bib.', 'Number six in order.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('tenth', 'tenth', 'th', array['t','e','n','th']::text[], array['th']::text[], 'floor_core', 41, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'The tenth question was the easiest.', 'Number ten in order.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('the', 'the', 'th', array['th','e']::text[], array['th']::text[], 'floor_core', 38, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'The small book is on the table.', 'A small helper term used before a noun.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('thirty', 'thirty', 'th', array['th','ir','t','y']::text[], array['th']::text[], 'floor_core', 37, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'Thirty chairs filled the hall.', 'The number after twenty-nine.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('with', 'with', 'th', array['w','i','th']::text[], array['th']::text[], 'floor_core', 34, 'Easier', 'th consonant_digraph word with age-appropriate classroom context.', 'Come with me to the library.', 'Together in the same place or activity.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('among', 'among', 'ng', array['a','m','o','ng']::text[], array['ng']::text[], 'floor_core', 37, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'The red bead was among the blue ones.', 'In the middle of a group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('bang', 'bang', 'ng', array['b','a','ng']::text[], array['ng']::text[], 'floor_core', 34, 'Easier', 'ng consonant_digraph word with age-appropriate classroom context.', 'The drum made a loud bang.', 'A sudden loud sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('longer', 'longer', 'ng', array['l','o','ng','er']::text[], array['ng']::text[], 'floor_core', 37, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'The longer ribbon reached the floor.', 'Having more length.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('rang', 'rang', 'ng', array['r','a','ng']::text[], array['ng']::text[], 'floor_core', 36, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'The bell rang after break.', 'Made a ringing sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('sang', 'sang', 'ng', array['s','a','ng']::text[], array['ng']::text[], 'floor_core', 38, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'The choir sang a cheerful tune.', 'Used the voice to make music.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('singing', 'singing', 'ng', array['s','i','ng','i','ng']::text[], array['ng']::text[], 'floor_core', 42, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'Singing filled the hall before assembly.', 'Making music with the voice.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('stronger', 'stronger', 'ng', array['s','t','r','o','ng','er']::text[], array['ng']::text[], 'floor_core', 47, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'The stronger box held all the books.', 'Having more strength.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('younger', 'younger', 'ng', array['y','ou','ng','er']::text[], array['ng']::text[], 'floor_core', 39, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'My younger cousin likes puzzles.', 'Less old than someone else.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('deck', 'deck', 'ck', array['d','e','ck']::text[], array['ck']::text[], 'floor_core', 24, 'Easier', 'ck consonant_digraph word with age-appropriate classroom context.', 'The card deck was shuffled carefully.', 'A set of playing cards.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('dock', 'dock', 'ck', array['d','o','ck']::text[], array['ck']::text[], 'floor_core', 28, 'Easier', 'ck consonant_digraph word with age-appropriate classroom context.', 'The boat waited by the dock.', 'A platform beside water for boats.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('sack', 'sack', 'ck', array['s','a','ck']::text[], array['ck']::text[], 'floor_core', 26, 'Easier', 'ck consonant_digraph word with age-appropriate classroom context.', 'The sack was full of soft balls.', 'A large bag made from strong material.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('stack', 'stack', 'ck', array['s','t','a','ck']::text[], array['ck']::text[], 'floor_core', 29, 'Easier', 'ck consonant_digraph word with age-appropriate classroom context.', 'Make a stack of clean trays.', 'A neat pile of things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('badges', 'badges', 'dge', array['b','a','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 47, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'The badges were pinned to the display.', 'Small signs worn or shown for a group or award.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('bridges', 'bridges', 'dge', array['b','r','i','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'Two bridges crossed the little stream.', 'Structures that let people cross over gaps.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('edges', 'edges', 'dge', array['e','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 48, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'The paper edges were straight.', 'The outside lines of an object.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('lodges', 'lodges', 'dge', array['l','o','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 49, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'Small lodges stood near the lake.', 'Small houses used for holidays or trips.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('ridges', 'ridges', 'dge', array['r','i','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 47, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'Ridges in the sand made wavy lines.', 'Long raised lines on a surface.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('wedges', 'wedges', 'dge', array['w','e','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 51, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'The wooden wedges held the door open.', 'Pieces with one thick end and one thin end.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('attention', 'attention', 'tion', array['a','tt','e','n','tion']::text[], array['tion']::text[], 'ceiling_challenge', 68, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'Please give attention to the speaker.', 'Careful listening or looking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('creation', 'creation', 'tion', array['c','r','ea','tion']::text[], array['tion']::text[], 'ceiling_challenge', 63, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'The clay creation dried on the shelf.', 'Something that has been made.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('education', 'education', 'tion', array['e','d','u','c','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 67, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'Education helps people learn new skills.', 'Learning and teaching, especially at school.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('instruction', 'instruction', 'tion', array['i','n','s','t','r','u','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 77, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'Read the instruction before you begin.', 'A direction that tells what to do.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('position', 'position', 'tion', array['p','o','s','i','tion']::text[], array['tion']::text[], 'ceiling_challenge', 64, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'Move the chair into a better position.', 'The place where something is set.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('prediction', 'prediction', 'tion', array['p','r','e','d','i','c','tion']::text[], array['tion']::text[], 'ceiling_challenge', 70, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'Our prediction was written on the board.', 'A sensible guess about what may happen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('solution', 'solution', 'tion', array['s','o','l','u','tion']::text[], array['tion']::text[], 'ceiling_challenge', 66, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'The solution to the puzzle was simple.', 'An answer that solves a problem.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('vacation', 'vacation', 'tion', array['v','a','c','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 68, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'The family planned a quiet vacation.', 'A holiday away from usual work or school.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('curled', 'curled', 'ur', array['c','ur','l','e','d']::text[], array['ur']::text[], 'diagnostic', 52, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The ribbon curled at the end.', 'Bent into a curved shape.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('further', 'further', 'ur', array['f','ur','th','er']::text[], array['ur']::text[], 'diagnostic', 51, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The sign was further along the path.', 'At a greater distance.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('murmur', 'murmur', 'ur', array['m','ur','m','ur']::text[], array['ur']::text[], 'diagnostic', 47, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'A quiet murmur came from the hall.', 'A low soft sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('purpose', 'purpose', 'ur', array['p','ur','p','o','s','e']::text[], array['ur']::text[], 'diagnostic', 55, 'Stretch', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The purpose of the box is storage.', 'The reason something is made or done.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('surface', 'surface', 'ur', array['s','ur','f','a','c','e']::text[], array['ur']::text[], 'diagnostic', 53, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The table surface was smooth.', 'The outside or top layer of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('surfer', 'surfer', 'ur', array['s','ur','f','er']::text[], array['ur']::text[], 'diagnostic', 51, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The surfer carried a board to the beach.', 'A person who rides waves on a board.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('turning', 'turning', 'ur', array['t','ur','n','i','ng']::text[], array['ur']::text[], 'diagnostic', 50, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The wheel kept turning slowly.', 'Moving around a centre point.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('turnip', 'turnip', 'ur', array['t','ur','n','i','p']::text[], array['ur']::text[], 'diagnostic', 54, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The turnip grew beside the carrots.', 'A round root vegetable.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('achieve', 'achieve', 'ie', array['a','ch','ie','v','e']::text[], array['ie']::text[], 'ceiling_challenge', 64, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'Practice helped the team achieve its goal.', 'To succeed in doing something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('believe', 'believe', 'ie', array['b','e','l','ie','v','e']::text[], array['ie']::text[], 'ceiling_challenge', 71, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'I believe the answer is correct.', 'To think that something is true.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('fried', 'fried', 'ie', array['f','r','ie','d']::text[], array['ie']::text[], 'ceiling_challenge', 63, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'Fried rice was packed for lunch.', 'Cooked in hot oil or fat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('fries', 'fries', 'ie', array['f','r','ie','s']::text[], array['ie']::text[], 'ceiling_challenge', 65, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'The fries cooled on the plate.', 'Thin pieces of potato cooked until crisp.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('skies', 'skies', 'ie', array['s','k','ie','s']::text[], array['ie']::text[], 'ceiling_challenge', 61, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'Blue skies followed the rain.', 'More than one view of the sky.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('tries', 'tries', 'ie', array['t','r','ie','s']::text[], array['ie']::text[], 'ceiling_challenge', 63, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'Leo tries hard during handwriting.', 'Makes an effort to do something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('cinnamon', 'cinnamon', 'ci', array['ci','nn','a','m','o','n']::text[], array['ci']::text[], 'ceiling_challenge', 67, 'Stretch', 'ci soft_c word with age-appropriate classroom context.', 'Cinnamon made the biscuits smell warm.', 'A sweet brown spice used in food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('citizen', 'citizen', 'ci', array['ci','t','i','z','e','n']::text[], array['ci']::text[], 'ceiling_challenge', 71, 'Stretch', 'ci soft_c word with age-appropriate classroom context.', 'Each citizen can help keep the park tidy.', 'A person who belongs to a town or country.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('civil', 'civil', 'ci', array['ci','v','i','l']::text[], array['ci']::text[], 'ceiling_challenge', 63, 'Stretch', 'ci soft_c word with age-appropriate classroom context.', 'The debate stayed civil and calm.', 'Polite and fair in behaviour.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('recital', 'recital', 'ci', array['r','e','ci','t','a','l']::text[], array['ci']::text[], 'ceiling_challenge', 69, 'Stretch', 'ci soft_c word with age-appropriate classroom context.', 'The piano recital began at four.', 'A performance of music or poems.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('audition', 'audition', 'au', array['au','d','i','tion']::text[], array['au']::text[], 'ceiling_challenge', 47, 'Core', 'au vowel_digraph word with age-appropriate classroom context.', 'The audition gave every singer a turn.', 'A short try-out for a part or performance.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('auditorium', 'auditorium', 'au', array['au','d','i','t','or','i','u','m']::text[], array['au']::text[], 'ceiling_challenge', 63, 'Stretch', 'au vowel_digraph word with age-appropriate classroom context.', 'The auditorium filled with quiet music.', 'A large room for an audience.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('autograph', 'autograph', 'au', array['au','t','o','g','r','a','ph']::text[], array['au']::text[], 'ceiling_challenge', 56, 'Stretch', 'au vowel_digraph word with age-appropriate classroom context.', 'The author wrote an autograph in the book.', 'A person''s written signature.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('autopilot', 'autopilot', 'au', array['au','t','o','p','i','l','o','t']::text[], array['au']::text[], 'ceiling_challenge', 61, 'Stretch', 'au vowel_digraph word with age-appropriate classroom context.', 'The model plane used autopilot in the story.', 'A system that can steer a vehicle by itself.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('always', 'always', 'ay', array['a','l','w','ay','s']::text[], array['ay']::text[], 'floor_core', 34, 'Easier', 'ay vowel_digraph word with age-appropriate classroom context.', 'Mum always checks the gate is shut.', 'Every time or on every occasion.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('anyway', 'anyway', 'ay', array['a','n','y','w','ay']::text[], array['ay']::text[], 'floor_core', 30, 'Easier', 'ay vowel_digraph word with age-appropriate classroom context.', 'It rained, but we played indoors anyway.', 'Even so, or despite something else.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('relay', 'relay', 'ay', array['r','e','l','ay']::text[], array['ay']::text[], 'floor_core', 29, 'Easier', 'ay vowel_digraph word with age-appropriate classroom context.', 'The relay team passed the baton carefully.', 'A race where team members take turns.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('saturday', 'saturday', 'ay', array['s','a','t','ur','d','ay']::text[], array['ay']::text[], 'floor_core', 33, 'Easier', 'ay vowel_digraph word with age-appropriate classroom context.', 'Saturday morning was bright and clear.', 'The day of the week after Friday.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('sunday', 'sunday', 'ay', array['s','u','n','d','ay']::text[], array['ay']::text[], 'floor_core', 32, 'Easier', 'ay vowel_digraph word with age-appropriate classroom context.', 'Sunday was sunny and quiet.', 'The day of the week after Saturday.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('tuesday', 'tuesday', 'ay', array['t','u','e','s','d','ay']::text[], array['ay']::text[], 'floor_core', 37, 'Core', 'ay vowel_digraph word with age-appropriate classroom context.', 'Tuesday is our library day.', 'The day of the week after Monday.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('beak', 'beak', 'ea', array['b','ea','k']::text[], array['ea']::text[], 'floor_core', 38, 'Core', 'ea vowel_digraph word with age-appropriate classroom context.', 'The bird held a twig in its beak.', 'The hard pointed mouth of a bird.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('eagle', 'eagle', 'ea', array['ea','g','l','e']::text[], array['ea']::text[], 'floor_core', 41, 'Core', 'ea vowel_digraph word with age-appropriate classroom context.', 'An eagle picture hung by the window.', 'A large bird with strong wings.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('easel', 'easel', 'ea', array['ea','s','e','l']::text[], array['ea']::text[], 'floor_core', 37, 'Core', 'ea vowel_digraph word with age-appropriate classroom context.', 'The easel held a fresh sheet of paper.', 'A stand used for painting or displaying work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('sneak', 'sneak', 'ea', array['s','n','ea','k']::text[], array['ea']::text[], 'floor_core', 39, 'Core', 'ea vowel_digraph word with age-appropriate classroom context.', 'The cat tried to sneak past the chair.', 'To move quietly without being noticed.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('teach', 'teach', 'ea', array['t','ea','ch']::text[], array['ea']::text[], 'floor_core', 36, 'Core', 'ea vowel_digraph word with age-appropriate classroom context.', 'Gran will teach me a new card game.', 'To help someone learn something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('weak', 'weak', 'ea', array['w','ea','k']::text[], array['ea']::text[], 'floor_core', 34, 'Easier', 'ea vowel_digraph word with age-appropriate classroom context.', 'The weak magnet held only one clip.', 'Not very strong.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('brew', 'brew', 'ew', array['b','r','ew']::text[], array['ew']::text[], 'diagnostic', 48, 'Core', 'ew vowel_digraph word with age-appropriate classroom context.', 'We brew mint tea in the pot.', 'To make a drink by soaking leaves in hot water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('brewing', 'brewing', 'ew', array['b','r','ew','i','ng']::text[], array['ew']::text[], 'diagnostic', 50, 'Core', 'ew vowel_digraph word with age-appropriate classroom context.', 'The tea was brewing on the counter.', 'Making a drink by soaking it in hot water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('chewy', 'chewy', 'ew', array['ch','ew','y']::text[], array['ew']::text[], 'diagnostic', 46, 'Core', 'ew vowel_digraph word with age-appropriate classroom context.', 'The chewy fruit bar took time to eat.', 'Needing to be chewed for a while.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('dewdrop', 'dewdrop', 'ew', array['d','ew','d','r','o','p']::text[], array['ew']::text[], 'diagnostic', 55, 'Stretch', 'ew vowel_digraph word with age-appropriate classroom context.', 'A dewdrop shone on the leaf.', 'A tiny drop of water found in the morning.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('newly', 'newly', 'ew', array['n','ew','l','y']::text[], array['ew']::text[], 'diagnostic', 51, 'Core', 'ew vowel_digraph word with age-appropriate classroom context.', 'The newly painted door looked bright.', 'Recently or not long ago.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('renewal', 'renewal', 'ew', array['r','e','n','ew','a','l']::text[], array['ew']::text[], 'diagnostic', 53, 'Core', 'ew vowel_digraph word with age-appropriate classroom context.', 'The library card renewal was quick.', 'The act of making something continue again.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('gesture', 'gesture', 'ure', array['g','e','s','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 64, 'Stretch', 'ure trigraph word with age-appropriate classroom context.', 'A kind gesture made Ben smile.', 'An action that shows a feeling or idea.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('pasture', 'pasture', 'ure', array['p','a','s','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 68, 'Stretch', 'ure trigraph word with age-appropriate classroom context.', 'The sheep grazed in the pasture.', 'A field where animals feed on grass.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('posture', 'posture', 'ure', array['p','o','s','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 68, 'Stretch', 'ure trigraph word with age-appropriate classroom context.', 'Good posture helped Ava sit comfortably.', 'The way someone holds their body.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('texture', 'texture', 'ure', array['t','e','x','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 66, 'Stretch', 'ure trigraph word with age-appropriate classroom context.', 'The fabric texture felt bumpy.', 'How a surface feels when touched.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('drawbridge', 'drawbridge', 'aw', array['d','r','aw','b','r','i','dge']::text[], array['aw']::text[], 'diagnostic', 58, 'Stretch', 'aw vowel_digraph word with age-appropriate classroom context.', 'The toy castle had a drawbridge.', 'A bridge that can be raised or lowered.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('drawing', 'drawing', 'aw', array['d','r','aw','i','ng']::text[], array['aw']::text[], 'diagnostic', 52, 'Core', 'aw vowel_digraph word with age-appropriate classroom context.', 'The drawing showed a tall tree.', 'A picture made with lines.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('pawprint', 'pawprint', 'aw', array['p','aw','p','r','i','n','t']::text[], array['aw']::text[], 'diagnostic', 56, 'Stretch', 'aw vowel_digraph word with age-appropriate classroom context.', 'A pawprint marked the muddy path.', 'A mark left by an animal''s paw.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true),
  ('strawhat', 'strawhat', 'aw', array['s','t','r','aw','h','a','t']::text[], array['aw']::text[], 'diagnostic', 60, 'Stretch', 'aw vowel_digraph word with age-appropriate classroom context.', 'The strawhat kept sun off his face.', 'A hat made from straw.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7g_2026_05_13', true);

create temporary table wordloom_core_phase_7g_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_7g_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('achieve', 'ie', 'primary', 'vowel_digraph', 0),
  ('airing', 'air', 'primary', 'r_controlled_vowel', 0),
  ('airship', 'air', 'primary', 'r_controlled_vowel', 0),
  ('always', 'ay', 'primary', 'vowel_digraph', 0),
  ('among', 'ng', 'primary', 'consonant_digraph', 0),
  ('answer', 'er', 'primary', 'r_controlled_vowel', 0),
  ('anyway', 'ay', 'primary', 'vowel_digraph', 0),
  ('arch', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('art', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('ash', 'sh', 'primary', 'consonant_digraph', 0),
  ('attention', 'tion', 'primary', 'trigraph', 0),
  ('audition', 'au', 'primary', 'vowel_digraph', 0),
  ('auditorium', 'au', 'primary', 'vowel_digraph', 0),
  ('autograph', 'au', 'primary', 'vowel_digraph', 0),
  ('autopilot', 'au', 'primary', 'vowel_digraph', 0),
  ('badges', 'dge', 'primary', 'trigraph', 0),
  ('bang', 'ng', 'primary', 'consonant_digraph', 0),
  ('beak', 'ea', 'primary', 'vowel_digraph', 0),
  ('believe', 'ie', 'primary', 'vowel_digraph', 0),
  ('blow', 'ow', 'primary', 'vowel_digraph', 0),
  ('both', 'th', 'primary', 'consonant_digraph', 0),
  ('bow', 'ow', 'primary', 'vowel_digraph', 0),
  ('brew', 'ew', 'primary', 'vowel_digraph', 0),
  ('brewing', 'ew', 'primary', 'vowel_digraph', 0),
  ('bridges', 'dge', 'primary', 'trigraph', 0),
  ('chairlift', 'air', 'primary', 'r_controlled_vowel', 0),
  ('chapter', 'ch', 'primary', 'consonant_digraph', 0),
  ('chart', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('chase', 'ch', 'primary', 'consonant_digraph', 0),
  ('chewy', 'ew', 'primary', 'vowel_digraph', 0),
  ('chill', 'ch', 'primary', 'consonant_digraph', 0),
  ('chime', 'ch', 'primary', 'consonant_digraph', 0),
  ('chimney', 'ch', 'primary', 'consonant_digraph', 0),
  ('chunk', 'ch', 'primary', 'consonant_digraph', 0),
  ('cinnamon', 'ci', 'primary', 'soft_c', 0),
  ('citizen', 'ci', 'primary', 'soft_c', 0),
  ('civil', 'ci', 'primary', 'soft_c', 0),
  ('clearer', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('clearly', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('clever', 'er', 'primary', 'r_controlled_vowel', 0),
  ('cloudy', 'ou', 'primary', 'vowel_digraph', 0),
  ('coal', 'oa', 'primary', 'vowel_digraph', 0),
  ('cork', 'or', 'primary', 'r_controlled_vowel', 0),
  ('cover', 'er', 'primary', 'r_controlled_vowel', 0),
  ('creation', 'tion', 'primary', 'trigraph', 0),
  ('curled', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('deck', 'ck', 'primary', 'consonant_digraph', 0),
  ('dewdrop', 'ew', 'primary', 'vowel_digraph', 0),
  ('dock', 'ck', 'primary', 'consonant_digraph', 0),
  ('drawbridge', 'aw', 'primary', 'vowel_digraph', 0),
  ('drawing', 'aw', 'primary', 'vowel_digraph', 0),
  ('eagle', 'ea', 'primary', 'vowel_digraph', 0),
  ('ear', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('easel', 'ea', 'primary', 'vowel_digraph', 0),
  ('edges', 'dge', 'primary', 'trigraph', 0),
  ('education', 'tion', 'primary', 'trigraph', 0),
  ('enjoyment', 'oy', 'primary', 'vowel_digraph', 0),
  ('ever', 'er', 'primary', 'r_controlled_vowel', 0),
  ('fairytale', 'air', 'primary', 'r_controlled_vowel', 0),
  ('fear', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('feed', 'ee', 'primary', 'vowel_digraph', 0),
  ('fifth', 'th', 'primary', 'consonant_digraph', 0),
  ('flour', 'ou', 'primary', 'vowel_digraph', 0),
  ('foal', 'oa', 'primary', 'vowel_digraph', 0),
  ('fried', 'ie', 'primary', 'vowel_digraph', 0),
  ('fries', 'ie', 'primary', 'vowel_digraph', 0),
  ('further', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('gesture', 'ure', 'primary', 'trigraph', 0),
  ('glow', 'ow', 'primary', 'vowel_digraph', 0),
  ('hairclip', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hairpin', 'air', 'primary', 'r_controlled_vowel', 0),
  ('harp', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('heel', 'ee', 'primary', 'vowel_digraph', 0),
  ('highlight', 'igh', 'primary', 'trigraph', 0),
  ('horn', 'or', 'primary', 'r_controlled_vowel', 0),
  ('hour', 'ou', 'primary', 'vowel_digraph', 0),
  ('instruction', 'tion', 'primary', 'trigraph', 0),
  ('joined', 'oi', 'primary', 'vowel_digraph', 0),
  ('joyfully', 'oy', 'primary', 'vowel_digraph', 0),
  ('lodges', 'dge', 'primary', 'trigraph', 0),
  ('longer', 'ng', 'primary', 'consonant_digraph', 0),
  ('low', 'ow', 'primary', 'vowel_digraph', 0),
  ('mailbox', 'ai', 'primary', 'vowel_digraph', 0),
  ('marble', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('maths', 'th', 'primary', 'consonant_digraph', 0),
  ('moan', 'oa', 'primary', 'vowel_digraph', 0),
  ('moist', 'oi', 'primary', 'vowel_digraph', 0),
  ('moonlight', 'igh', 'primary', 'trigraph', 0),
  ('murmur', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('nearby', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('nearly', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('newly', 'ew', 'primary', 'vowel_digraph', 0),
  ('nightfall', 'igh', 'primary', 'trigraph', 0),
  ('northward', 'or', 'primary', 'r_controlled_vowel', 0),
  ('number', 'er', 'primary', 'r_controlled_vowel', 0),
  ('oink', 'oi', 'primary', 'vowel_digraph', 0),
  ('other', 'er', 'primary', 'r_controlled_vowel', 0),
  ('outside', 'ou', 'primary', 'vowel_digraph', 0),
  ('painter', 'ai', 'primary', 'vowel_digraph', 0),
  ('painting', 'ai', 'primary', 'vowel_digraph', 0),
  ('paper', 'er', 'primary', 'r_controlled_vowel', 0),
  ('pasture', 'ure', 'primary', 'trigraph', 0),
  ('pawprint', 'aw', 'primary', 'vowel_digraph', 0),
  ('peel', 'ee', 'primary', 'vowel_digraph', 0),
  ('pointed', 'oi', 'primary', 'vowel_digraph', 0),
  ('pointer', 'oi', 'primary', 'vowel_digraph', 0),
  ('port', 'or', 'primary', 'r_controlled_vowel', 0),
  ('position', 'tion', 'primary', 'trigraph', 0),
  ('posture', 'ure', 'primary', 'trigraph', 0),
  ('pound', 'ou', 'primary', 'vowel_digraph', 0),
  ('prediction', 'tion', 'primary', 'trigraph', 0),
  ('purpose', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('railway', 'ai', 'primary', 'vowel_digraph', 0),
  ('rainbow', 'ai', 'primary', 'vowel_digraph', 0),
  ('rang', 'ng', 'primary', 'consonant_digraph', 0),
  ('recital', 'ci', 'primary', 'soft_c', 0),
  ('relay', 'ay', 'primary', 'vowel_digraph', 0),
  ('renewal', 'ew', 'primary', 'vowel_digraph', 0),
  ('ridges', 'dge', 'primary', 'trigraph', 0),
  ('river', 'er', 'primary', 'r_controlled_vowel', 0),
  ('row', 'ow', 'primary', 'vowel_digraph', 0),
  ('runner', 'er', 'primary', 'r_controlled_vowel', 0),
  ('sack', 'ck', 'primary', 'consonant_digraph', 0),
  ('sailboat', 'ai', 'primary', 'vowel_digraph', 0),
  ('sang', 'ng', 'primary', 'consonant_digraph', 0),
  ('saturday', 'ay', 'primary', 'vowel_digraph', 0),
  ('scout', 'ou', 'primary', 'vowel_digraph', 0),
  ('screen', 'ee', 'primary', 'vowel_digraph', 0),
  ('seem', 'ee', 'primary', 'vowel_digraph', 0),
  ('seen', 'ee', 'primary', 'vowel_digraph', 0),
  ('shall', 'sh', 'primary', 'consonant_digraph', 0),
  ('shampoo', 'sh', 'primary', 'consonant_digraph', 0),
  ('share', 'sh', 'primary', 'consonant_digraph', 0),
  ('shovel', 'sh', 'primary', 'consonant_digraph', 0),
  ('shy', 'sh', 'primary', 'consonant_digraph', 0),
  ('silver', 'er', 'primary', 'r_controlled_vowel', 0),
  ('singing', 'ng', 'primary', 'consonant_digraph', 0),
  ('sixth', 'th', 'primary', 'consonant_digraph', 0),
  ('skies', 'ie', 'primary', 'vowel_digraph', 0),
  ('skylight', 'igh', 'primary', 'trigraph', 0),
  ('slow', 'ow', 'primary', 'vowel_digraph', 0),
  ('sneak', 'ea', 'primary', 'vowel_digraph', 0),
  ('snow', 'ow', 'primary', 'vowel_digraph', 0),
  ('solution', 'tion', 'primary', 'trigraph', 0),
  ('soy', 'oy', 'primary', 'vowel_digraph', 0),
  ('spark', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('sprout', 'ou', 'primary', 'vowel_digraph', 0),
  ('stack', 'ck', 'primary', 'consonant_digraph', 0),
  ('starlight', 'igh', 'primary', 'trigraph', 0),
  ('stormy', 'or', 'primary', 'r_controlled_vowel', 0),
  ('storybook', 'or', 'primary', 'r_controlled_vowel', 0),
  ('strawhat', 'aw', 'primary', 'vowel_digraph', 0),
  ('stronger', 'ng', 'primary', 'consonant_digraph', 0),
  ('sunday', 'ay', 'primary', 'vowel_digraph', 0),
  ('sunlight', 'igh', 'primary', 'trigraph', 0),
  ('surface', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('surfer', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('teach', 'ea', 'primary', 'vowel_digraph', 0),
  ('tenth', 'th', 'primary', 'consonant_digraph', 0),
  ('texture', 'ure', 'primary', 'trigraph', 0),
  ('the', 'th', 'primary', 'consonant_digraph', 0),
  ('thirty', 'th', 'primary', 'consonant_digraph', 0),
  ('toad', 'oa', 'primary', 'vowel_digraph', 0),
  ('toybox', 'oy', 'primary', 'vowel_digraph', 0),
  ('toymaker', 'oy', 'primary', 'vowel_digraph', 0),
  ('toyshop', 'oy', 'primary', 'vowel_digraph', 0),
  ('tries', 'ie', 'primary', 'vowel_digraph', 0),
  ('trout', 'ou', 'primary', 'vowel_digraph', 0),
  ('tuesday', 'ay', 'primary', 'vowel_digraph', 0),
  ('turning', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('turnip', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('vacation', 'tion', 'primary', 'trigraph', 0),
  ('void', 'oi', 'primary', 'vowel_digraph', 0),
  ('weak', 'ea', 'primary', 'vowel_digraph', 0),
  ('wedges', 'dge', 'primary', 'trigraph', 0),
  ('with', 'th', 'primary', 'consonant_digraph', 0),
  ('wow', 'ow', 'primary', 'vowel_digraph', 0),
  ('yearbook', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('yearly', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('younger', 'ng', 'primary', 'consonant_digraph', 0);

do $$
begin
  if (select count(*) from wordloom_core_phase_7g_words) <> 180 then
    raise exception 'Wordloom core Phase 7G batch must contain exactly 180 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7g_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_7g_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_7g_word_count
  ) then
    raise exception 'Wordloom core Phase 7G target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_7g_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 7G batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_7g_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> 'wordloom_core_v1_phase_7g_2026_05_13'
  ) then
    raise exception 'Wordloom core Phase 7G batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7g_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_7g_2026_05_13'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 7G words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7g_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ) then
    raise exception 'Wordloom core Phase 7G words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7g_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ) then
    raise exception 'Wordloom core Phase 7G words contain explicit spelling-hint context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7g_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 7G words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7g_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 7G primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7g_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 7G word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7g_word_targets as word_targets
    left join wordloom_core_phase_7g_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 7G word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_7g_words as words
    left join wordloom_core_phase_7g_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 7G word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 7G bulk top-up batch target'
from wordloom_core_phase_7g_targets
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
    from wordloom_core_phase_7g_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 7G linked targets must exist and be active.';
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
from wordloom_core_phase_7g_words
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
  'Wordloom core v1 Phase 7G bulk top-up batch target link'
from wordloom_core_phase_7g_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_7g_2026_05_13'
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
      and source_version = 'wordloom_core_v1_phase_7g_2026_05_13'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 180 then
    raise exception 'Wordloom core Phase 7G persisted word count must be exactly 180.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7g_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_7g_2026_05_13'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_7g_word_count
  ) then
    raise exception 'Wordloom core Phase 7G persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 7G.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_7g_2026_05_13'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 7G persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_7g_2026_05_13'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 7G persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_7g_2026_05_13'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 7G word must have exactly one primary target link.';
  end if;
  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join wordloom_core_phase_7g_words as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core Phase 7G must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join wordloom_core_phase_7g_words as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core Phase 7G must not add rows to school spelling bank additions.';
  end if;

end $$;

commit;
