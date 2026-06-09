begin;

create temporary table wordloom_core_phase_7h_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_7h_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_7h_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_7h_word_count
)
values
  ('ai', 'ai', 'floor_core', 'needs_support', 10, 6),
  ('ee', 'ee', 'floor_core', 'needs_support', 20, 6),
  ('oa', 'oa', 'floor_core', 'needs_support', 30, 6),
  ('igh', 'igh', 'floor_core', 'core_developing', 40, 6),
  ('ar', 'ar', 'floor_core', 'core_developing', 50, 8),
  ('or', 'or', 'floor_core', 'core_developing', 60, 6),
  ('air', 'air', 'diagnostic', 'secure_expected', 70, 4),
  ('ear', 'ear', 'diagnostic', 'secure_expected', 80, 6),
  ('er', 'er', 'diagnostic', 'secure_expected', 90, 8),
  ('oy', 'oy', 'floor_core', 'core_developing', 100, 6),
  ('oi', 'oi', 'floor_core', 'core_developing', 110, 6),
  ('ou', 'ou', 'floor_core', 'core_developing', 120, 8),
  ('ow', 'ow', 'floor_core', 'core_developing', 130, 8),
  ('sh', 'sh', 'floor_core', 'needs_support', 140, 6),
  ('ch', 'ch', 'floor_core', 'needs_support', 150, 6),
  ('th', 'th', 'floor_core', 'core_developing', 160, 8),
  ('ng', 'ng', 'floor_core', 'core_developing', 170, 8),
  ('ck', 'ck', 'floor_core', 'needs_support', 180, 6),
  ('dge', 'dge', 'ceiling_challenge', 'secure_expected', 190, 6),
  ('tion', 'tion', 'ceiling_challenge', 'early_stretch', 200, 4),
  ('ur', 'ur', 'diagnostic', 'secure_expected', 210, 6),
  ('ie', 'ie', 'ceiling_challenge', 'early_stretch', 220, 6),
  ('ci', 'ci', 'ceiling_challenge', 'early_stretch', 230, 4),
  ('au', 'au', 'ceiling_challenge', 'secure_expected', 240, 4),
  ('ay', 'ay', 'floor_core', 'needs_support', 250, 6),
  ('ea', 'ea', 'floor_core', 'core_developing', 260, 6),
  ('ew', 'ew', 'diagnostic', 'secure_expected', 270, 6),
  ('ure', 'ure', 'ceiling_challenge', 'early_stretch', 280, 4),
  ('aw', 'aw', 'diagnostic', 'secure_expected', 290, 4),
  ('tch', 'tch', 'diagnostic', 'secure_expected', 300, 8);

create temporary table wordloom_core_phase_7h_words (
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

insert into wordloom_core_phase_7h_words (
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
  ('container', 'container', 'ai', array['c','o','n','t','ai','n','er']::text[], array['ai']::text[], 'floor_core', 36, 'Core', 'ai vowel_digraph word with age-appropriate classroom context.', 'The container held dry pasta shapes.', 'A box, tub, or jar used to hold things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('explain', 'explain', 'ai', array['e','x','p','l','ai','n']::text[], array['ai']::text[], 'floor_core', 37, 'Core', 'ai vowel_digraph word with age-appropriate classroom context.', 'Mira will explain the game to Sam.', 'To make an idea clear to someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('mainly', 'mainly', 'ai', array['m','ai','n','l','y']::text[], array['ai']::text[], 'floor_core', 34, 'Easier', 'ai vowel_digraph word with age-appropriate classroom context.', 'The class mainly used blue paper.', 'Mostly, or more than anything else.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('railing', 'railing', 'ai', array['r','ai','l','i','ng']::text[], array['ai']::text[], 'floor_core', 32, 'Easier', 'ai vowel_digraph word with age-appropriate classroom context.', 'The railing helped us walk down the steps.', 'A bar that people hold for support.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('remain', 'remain', 'ai', array['r','e','m','ai','n']::text[], array['ai']::text[], 'floor_core', 32, 'Easier', 'ai vowel_digraph word with age-appropriate classroom context.', 'Three crayons remain in the pot.', 'To be left after others are gone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('trainer', 'trainer', 'ai', array['t','r','ai','n','er']::text[], array['ai']::text[], 'floor_core', 30, 'Easier', 'ai vowel_digraph word with age-appropriate classroom context.', 'The trainer tied the laces neatly.', 'A soft shoe worn for sport or play.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('creek', 'creek', 'ee', array['c','r','ee','k']::text[], array['ee']::text[], 'floor_core', 31, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'A tiny creek ran behind the park.', 'A narrow stream of water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('freezer', 'freezer', 'ee', array['f','r','ee','z','er']::text[], array['ee']::text[], 'floor_core', 34, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'The freezer kept the fruit lollies cold.', 'A cold cupboard for frozen food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('greet', 'greet', 'ee', array['g','r','ee','t']::text[], array['ee']::text[], 'floor_core', 27, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'We greet each visitor with a smile.', 'To say hello to someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('sleeve', 'sleeve', 'ee', array['s','l','ee','v','e']::text[], array['ee']::text[], 'floor_core', 30, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'A button was loose on my sleeve.', 'The part of clothing that covers an arm.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('speed', 'speed', 'ee', array['s','p','ee','d']::text[], array['ee']::text[], 'floor_core', 29, 'Easier', 'ee vowel_digraph word with age-appropriate classroom context.', 'The bike went at a safe speed.', 'How fast something moves.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('weekend', 'weekend', 'ee', array['w','ee','k','e','n','d']::text[], array['ee']::text[], 'floor_core', 35, 'Core', 'ee vowel_digraph word with age-appropriate classroom context.', 'The weekend was calm and sunny.', 'Saturday and Sunday together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('afloat', 'afloat', 'oa', array['a','f','l','oa','t']::text[], array['oa']::text[], 'floor_core', 32, 'Easier', 'oa vowel_digraph word with age-appropriate classroom context.', 'The paper boat stayed afloat in the tray.', 'Floating on top of water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('approach', 'approach', 'oa', array['a','pp','r','oa','ch']::text[], array['oa']::text[], 'floor_core', 34, 'Easier', 'oa vowel_digraph word with age-appropriate classroom context.', 'We approach the table quietly.', 'To move closer to something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('boating', 'boating', 'oa', array['b','oa','t','i','ng']::text[], array['oa']::text[], 'floor_core', 34, 'Easier', 'oa vowel_digraph word with age-appropriate classroom context.', 'Boating on the lake looked peaceful.', 'Travelling or playing in a boat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('raincoat', 'raincoat', 'oa', array['r','ai','n','c','oa','t']::text[], array['oa']::text[], 'floor_core', 35, 'Core', 'oa vowel_digraph word with age-appropriate classroom context.', 'A raincoat kept Leila dry on the walk.', 'A coat worn to keep off rain.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('roadway', 'roadway', 'oa', array['r','oa','d','w','ay']::text[], array['oa']::text[], 'floor_core', 30, 'Easier', 'oa vowel_digraph word with age-appropriate classroom context.', 'The roadway curved around the park.', 'The part of a road used by traffic.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('soaking', 'soaking', 'oa', array['s','oa','k','i','ng']::text[], array['oa']::text[], 'floor_core', 30, 'Easier', 'oa vowel_digraph word with age-appropriate classroom context.', 'The sponge was soaking in clean water.', 'Resting in liquid until very wet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('brightly', 'brightly', 'igh', array['b','r','igh','t','l','y']::text[], array['igh']::text[], 'floor_core', 47, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'The lamp shone brightly on the desk.', 'In a clear and shining way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('highchair', 'highchair', 'igh', array['h','igh','ch','air']::text[], array['igh']::text[], 'floor_core', 37, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'The highchair was folded after lunch.', 'A tall chair made for a young child.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('lightly', 'lightly', 'igh', array['l','igh','t','l','y']::text[], array['igh']::text[], 'floor_core', 40, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'Tap the drum lightly with one finger.', 'With gentle force or little weight.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('nighttime', 'nighttime', 'igh', array['n','igh','t','t','i','m','e']::text[], array['igh']::text[], 'floor_core', 48, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'Owls are often awake at nighttime.', 'The part of the day when it is dark.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('slightly', 'slightly', 'igh', array['s','l','igh','t','l','y']::text[], array['igh']::text[], 'floor_core', 47, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'The shelf is slightly higher than mine.', 'A little bit, but not much.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('tightly', 'tightly', 'igh', array['t','igh','t','l','y']::text[], array['igh']::text[], 'floor_core', 42, 'Core', 'igh trigraph word with age-appropriate classroom context.', 'The lid was screwed tightly on the jar.', 'In a firm and secure way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('backyard', 'backyard', 'ar', array['b','a','ck','y','ar','d']::text[], array['ar']::text[], 'floor_core', 47, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'The backyard had a small table outside.', 'An open space behind a home.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('cardboard', 'cardboard', 'ar', array['c','ar','d','b','oa','r','d']::text[], array['ar']::text[], 'floor_core', 46, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'We made a castle from cardboard.', 'Thick stiff paper used for boxes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('carton', 'carton', 'ar', array['c','ar','t','o','n']::text[], array['ar']::text[], 'floor_core', 42, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'The milk carton was ready for recycling.', 'A light box or container for food or drink.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('garlic', 'garlic', 'ar', array['g','ar','l','i','c']::text[], array['ar']::text[], 'floor_core', 42, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'Garlic gave the soup a strong smell.', 'A small bulb used to flavour food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('margin', 'margin', 'ar', array['m','ar','g','i','n']::text[], array['ar']::text[], 'floor_core', 42, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'Write the date near the margin.', 'The blank space at the side of a page.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('parcel', 'parcel', 'ar', array['p','ar','c','e','l']::text[], array['ar']::text[], 'floor_core', 44, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'A parcel arrived for the classroom.', 'A wrapped package sent or carried somewhere.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('starry', 'starry', 'ar', array['s','t','ar','r','y']::text[], array['ar']::text[], 'floor_core', 44, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'The starry sky looked clear and bright.', 'Full of visible stars.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('target', 'target', 'ar', array['t','ar','g','e','t']::text[], array['ar']::text[], 'floor_core', 40, 'Core', 'ar r_controlled_vowel word with age-appropriate classroom context.', 'The beanbag landed near the target.', 'A mark that someone tries to hit.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('cornfield', 'cornfield', 'or', array['c','or','n','f','ie','l','d']::text[], array['or']::text[], 'floor_core', 48, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'The cornfield was golden in late summer.', 'A field where corn is grown.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('cornflake', 'cornflake', 'or', array['c','or','n','f','l','a','k','e']::text[], array['or']::text[], 'floor_core', 53, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'One cornflake fell beside the bowl.', 'A thin crisp piece of breakfast cereal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('shortcake', 'shortcake', 'or', array['sh','or','t','c','a','k','e']::text[], array['or']::text[], 'floor_core', 46, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'We shared strawberry shortcake at the picnic.', 'A soft cake often served with fruit.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('sporty', 'sporty', 'or', array['s','p','or','t','y']::text[], array['or']::text[], 'floor_core', 42, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'The sporty jacket was easy to run in.', 'Suited to games, exercise, or active play.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('storytime', 'storytime', 'or', array['s','t','or','y','t','i','m','e']::text[], array['or']::text[], 'floor_core', 49, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'Storytime began after lunch.', 'A time set aside for reading stories.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('torchlight', 'torchlight', 'or', array['t','or','ch','l','igh','t']::text[], array['or']::text[], 'floor_core', 47, 'Core', 'or r_controlled_vowel word with age-appropriate classroom context.', 'Torchlight helped us find the lost pencil.', 'Light that comes from a small hand torch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('airflow', 'airflow', 'air', array['air','f','l','ow']::text[], array['air']::text[], 'diagnostic', 47, 'Core', 'air r_controlled_vowel word with age-appropriate classroom context.', 'The open window improved the airflow.', 'The movement of air through a space.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('airmail', 'airmail', 'air', array['air','m','ai','l']::text[], array['air']::text[], 'diagnostic', 49, 'Core', 'air r_controlled_vowel word with age-appropriate classroom context.', 'The old stamp said airmail on it.', 'Post sent by aircraft.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('downstairs', 'downstairs', 'air', array['d','ow','n','s','t','air','s']::text[], array['air']::text[], 'diagnostic', 56, 'Stretch', 'air r_controlled_vowel word with age-appropriate classroom context.', 'The art box is kept downstairs.', 'On or to a lower floor.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('hairdryer', 'hairdryer', 'air', array['h','air','d','r','y','er']::text[], array['air']::text[], 'diagnostic', 57, 'Stretch', 'air r_controlled_vowel word with age-appropriate classroom context.', 'The hairdryer was packed in the drawer.', 'A tool that blows warm air to dry hair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('appearing', 'appearing', 'ear', array['a','pp','ear','i','ng']::text[], array['ear']::text[], 'diagnostic', 52, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'A smile was appearing on her face.', 'Starting to be seen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('earmuffs', 'earmuffs', 'ear', array['ear','m','u','ff','s']::text[], array['ear']::text[], 'diagnostic', 50, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'The earmuffs kept Nora warm outside.', 'Soft covers worn over the ears.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('earphone', 'earphone', 'ear', array['ear','ph','o','n','e']::text[], array['ear']::text[], 'diagnostic', 52, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'One earphone was left in the case.', 'A small speaker worn in an ear.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('teardrop', 'teardrop', 'ear', array['t','ear','d','r','o','p']::text[], array['ear']::text[], 'diagnostic', 57, 'Stretch', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'A teardrop shape decorated the card.', 'A small shape like a drop of water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('wearable', 'wearable', 'ear', array['w','ear','a','b','l','e']::text[], array['ear']::text[], 'diagnostic', 53, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'The costume was neat and wearable.', 'Able to be worn comfortably.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('wearing', 'wearing', 'ear', array['w','ear','i','ng']::text[], array['ear']::text[], 'diagnostic', 51, 'Core', 'ear r_controlled_vowel word with age-appropriate classroom context.', 'Sam is wearing a green jumper.', 'Having clothing or an item on the body.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('baker', 'baker', 'er', array['b','a','k','er']::text[], array['er']::text[], 'diagnostic', 47, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The baker put rolls on the shelf.', 'A person who makes bread or cakes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('farmer', 'farmer', 'er', array['f','ar','m','er']::text[], array['er']::text[], 'diagnostic', 51, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The farmer filled a basket with carrots.', 'A person who works on a farm.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('gardener', 'gardener', 'er', array['g','ar','d','e','n','er']::text[], array['er']::text[], 'diagnostic', 55, 'Stretch', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The gardener watered the young plants.', 'A person who looks after a garden.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('maker', 'maker', 'er', array['m','a','k','er']::text[], array['er']::text[], 'diagnostic', 49, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The model maker used card and glue.', 'A person who creates something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('reader', 'reader', 'er', array['r','ea','d','er']::text[], array['er']::text[], 'diagnostic', 51, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The reader turned the page carefully.', 'A person who reads.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('scooter', 'scooter', 'er', array['s','c','oo','t','er']::text[], array['er']::text[], 'diagnostic', 54, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The scooter had a bright bell.', 'A small vehicle with a board and wheels.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('singer', 'singer', 'er', array['s','i','ng','er']::text[], array['er']::text[], 'diagnostic', 47, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The singer warmed up before choir.', 'A person who sings.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('swimmer', 'swimmer', 'er', array['s','w','i','mm','er']::text[], array['er']::text[], 'diagnostic', 52, 'Core', 'er r_controlled_vowel word with age-appropriate classroom context.', 'The swimmer used the lane calmly.', 'A person who swims.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('annoyed', 'annoyed', 'oy', array['a','nn','oy','e','d']::text[], array['oy']::text[], 'floor_core', 40, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'Tom felt annoyed when the lid stuck.', 'A little bothered or irritated.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('annoying', 'annoying', 'oy', array['a','nn','oy','i','ng']::text[], array['oy']::text[], 'floor_core', 44, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'The buzzing light was annoying, so we moved.', 'Bothering someone in a small way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('enjoying', 'enjoying', 'oy', array['e','n','j','oy','i','ng']::text[], array['oy']::text[], 'floor_core', 45, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'We are enjoying the quiet reading corner.', 'Taking pleasure in an activity.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('joyous', 'joyous', 'oy', array['j','oy','ou','s']::text[], array['oy']::text[], 'floor_core', 41, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'The joyous music filled the hall.', 'Very happy or full of joy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('loyally', 'loyally', 'oy', array['l','oy','a','ll','y']::text[], array['oy']::text[], 'floor_core', 42, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'The helper waited loyally beside the team.', 'In a faithful and supportive way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('loyalty', 'loyalty', 'oy', array['l','oy','a','l','t','y']::text[], array['oy']::text[], 'floor_core', 43, 'Core', 'oy vowel_digraph word with age-appropriate classroom context.', 'The team showed loyalty to each other.', 'Faithful support for a person or group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('boiling', 'boiling', 'oi', array['b','oi','l','i','ng']::text[], array['oi']::text[], 'floor_core', 42, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'The water was boiling in the kettle.', 'Hot enough to bubble strongly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('joining', 'joining', 'oi', array['j','oi','n','i','ng']::text[], array['oi']::text[], 'floor_core', 40, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'A new pupil is joining our table.', 'Becoming part of a group or activity.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('noisemaker', 'noisemaker', 'oi', array['n','oi','s','e','m','a','k','er']::text[], array['oi']::text[], 'floor_core', 49, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'The noisemaker rattled during the parade.', 'An object that makes a loud sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('noisily', 'noisily', 'oi', array['n','oi','s','i','l','y']::text[], array['oi']::text[], 'floor_core', 47, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'The chairs moved noisily on the floor.', 'In a loud way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('oilcan', 'oilcan', 'oi', array['oi','l','c','a','n']::text[], array['oi']::text[], 'floor_core', 42, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'The old oilcan sat on the workbench.', 'A small can used for holding oil.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('uncoil', 'uncoil', 'oi', array['u','n','c','oi','l']::text[], array['oi']::text[], 'floor_core', 44, 'Core', 'oi vowel_digraph word with age-appropriate classroom context.', 'Please uncoil the skipping rope before play.', 'To open out something that is curled round.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('amount', 'amount', 'ou', array['a','m','ou','n','t']::text[], array['ou']::text[], 'floor_core', 40, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'A small amount of glue was enough.', 'How much of something there is.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('counting', 'counting', 'ou', array['c','ou','n','t','i','ng']::text[], array['ou']::text[], 'floor_core', 45, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'Counting the shells took five minutes.', 'Saying numbers in order to find a total.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('houseboat', 'houseboat', 'ou', array['h','ou','s','e','b','oa','t']::text[], array['ou']::text[], 'floor_core', 50, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'A houseboat rested near the river bank.', 'A boat that people can live on.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('housework', 'housework', 'ou', array['h','ou','s','e','w','or','k']::text[], array['ou']::text[], 'floor_core', 46, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'Everyone helped finish the housework early.', 'Jobs done to keep a home tidy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('mouthful', 'mouthful', 'ou', array['m','ou','th','f','u','l']::text[], array['ou']::text[], 'floor_core', 45, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'Take a small mouthful and chew slowly.', 'The amount that fits in the mouth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('outdoor', 'outdoor', 'ou', array['ou','t','d','oo','r']::text[], array['ou']::text[], 'floor_core', 44, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'The outdoor table was dry by noon.', 'Used or happening outside.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('playhouse', 'playhouse', 'ou', array['p','l','ay','h','ou','s','e']::text[], array['ou']::text[], 'floor_core', 46, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'The playhouse had a tiny red door.', 'A small toy house for children to play in.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('soundly', 'soundly', 'ou', array['s','ou','n','d','l','y']::text[], array['ou']::text[], 'floor_core', 47, 'Core', 'ou vowel_digraph word with age-appropriate classroom context.', 'The baby slept soundly in the pram.', 'Deeply and peacefully.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('below', 'below', 'ow', array['b','e','l','ow']::text[], array['ow']::text[], 'floor_core', 39, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'The shoes were below the coat hooks.', 'In a lower place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('borrow', 'borrow', 'ow', array['b','o','rr','ow']::text[], array['ow']::text[], 'floor_core', 37, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'May I borrow your ruler for a moment?', 'To use something and give it back later.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('elbow', 'elbow', 'ow', array['e','l','b','ow']::text[], array['ow']::text[], 'floor_core', 41, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'Rest your elbow gently on the table.', 'The joint in the middle of the arm.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('flow', 'flow', 'ow', array['f','l','ow']::text[], array['ow']::text[], 'floor_core', 34, 'Easier', 'ow vowel_digraph word with age-appropriate classroom context.', 'The stream began to flow again.', 'To move smoothly like water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('meadow', 'meadow', 'ow', array['m','ea','d','ow']::text[], array['ow']::text[], 'floor_core', 41, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'The meadow was full of long grass.', 'A field of grass and wild plants.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('narrow', 'narrow', 'ow', array['n','a','rr','ow']::text[], array['ow']::text[], 'floor_core', 39, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'The narrow path led to the garden.', 'Not very wide.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('pillow', 'pillow', 'ow', array['p','i','ll','ow']::text[], array['ow']::text[], 'floor_core', 39, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'The pillow had a blue cover.', 'A soft cushion for resting the head.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('willow', 'willow', 'ow', array['w','i','ll','ow']::text[], array['ow']::text[], 'floor_core', 37, 'Core', 'ow vowel_digraph word with age-appropriate classroom context.', 'The willow tree leaned over the pond.', 'A tree with long narrow leaves.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('flash', 'flash', 'sh', array['f','l','a','sh']::text[], array['sh']::text[], 'floor_core', 27, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'A flash of light came from the camera.', 'A sudden short burst of light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('mushroom', 'mushroom', 'sh', array['m','u','sh','r','oo','m']::text[], array['sh']::text[], 'floor_core', 33, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'A mushroom grew beside the old log.', 'A small fungus with a cap and stem.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('plush', 'plush', 'sh', array['p','l','u','sh']::text[], array['sh']::text[], 'floor_core', 29, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'The plush blanket felt soft and warm.', 'Soft and thick to touch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('radish', 'radish', 'sh', array['r','a','d','i','sh']::text[], array['sh']::text[], 'floor_core', 32, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'The radish added crunch to the salad.', 'A small crisp root vegetable.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('shimmer', 'shimmer', 'sh', array['sh','i','mm','er']::text[], array['sh']::text[], 'floor_core', 31, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'The sequins shimmer under the light.', 'To shine with a soft flickering light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('vanish', 'vanish', 'sh', array['v','a','n','i','sh']::text[], array['sh']::text[], 'floor_core', 34, 'Easier', 'sh consonant_digraph word with age-appropriate classroom context.', 'The chalk marks vanish when we wipe them.', 'To disappear from sight.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('branch', 'branch', 'ch', array['b','r','a','n','ch']::text[], array['ch']::text[], 'floor_core', 30, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'A branch tapped the classroom window.', 'A part of a tree that grows from the trunk.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('chatter', 'chatter', 'ch', array['ch','a','tt','er']::text[], array['ch']::text[], 'floor_core', 27, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'The chatter stopped when the story began.', 'Quick lively talk.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('chocolate', 'chocolate', 'ch', array['ch','o','c','o','l','a','t','e']::text[], array['ch']::text[], 'floor_core', 43, 'Core', 'ch consonant_digraph word with age-appropriate classroom context.', 'Chocolate cake was shared at the party.', 'A sweet brown food made from cocoa.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('chosen', 'chosen', 'ch', array['ch','o','s','e','n']::text[], array['ch']::text[], 'floor_core', 34, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'The chosen book was placed on the stand.', 'Picked from a group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('chuckle', 'chuckle', 'ch', array['ch','u','ck','l','e']::text[], array['ch']::text[], 'floor_core', 32, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'A chuckle came from the reading corner.', 'A quiet laugh.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('pinch', 'pinch', 'ch', array['p','i','n','ch']::text[], array['ch']::text[], 'floor_core', 29, 'Easier', 'ch consonant_digraph word with age-appropriate classroom context.', 'Add a pinch of salt to the dough.', 'A very small amount held between fingers.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('feather', 'feather', 'th', array['f','ea','th','er']::text[], array['th']::text[], 'floor_core', 37, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'A feather drifted onto the path.', 'A light soft covering from a bird.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('smooth', 'smooth', 'th', array['s','m','oo','th']::text[], array['th']::text[], 'floor_core', 39, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'The pebble felt smooth in my hand.', 'Even and not rough.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('thimble', 'thimble', 'th', array['th','i','m','b','l','e']::text[], array['th']::text[], 'floor_core', 43, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'The thimble protected Grandma''s finger.', 'A small cap used when sewing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('thirsty', 'thirsty', 'th', array['th','ir','s','t','y']::text[], array['th']::text[], 'floor_core', 44, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'I felt thirsty after the run.', 'Needing a drink.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('thirteen', 'thirteen', 'th', array['th','ir','t','ee','n']::text[], array['th']::text[], 'floor_core', 42, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'Thirteen shells sat in the tray.', 'The number after twelve.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('throw', 'throw', 'th', array['th','r','ow']::text[], array['th']::text[], 'floor_core', 36, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'Throw the beanbag into the hoop.', 'To send something through the air by hand.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('tooth', 'tooth', 'th', array['t','oo','th']::text[], array['th']::text[], 'floor_core', 38, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'The tooth on the comb was bent.', 'One of the small points on a comb or gear.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('weather', 'weather', 'th', array['w','ea','th','er']::text[], array['th']::text[], 'floor_core', 41, 'Core', 'th consonant_digraph word with age-appropriate classroom context.', 'The weather changed before playtime.', 'The state of the sky, air, and temperature.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('baking', 'baking', 'ng', array['b','a','k','i','ng']::text[], array['ng']::text[], 'floor_core', 44, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'Baking bread took most of the morning.', 'Cooking food in an oven.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('cooking', 'cooking', 'ng', array['c','oo','k','i','ng']::text[], array['ng']::text[], 'floor_core', 42, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'Cooking soup made the kitchen smell warm.', 'Preparing food with heat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('dancing', 'dancing', 'ng', array['d','a','n','c','i','ng']::text[], array['ng']::text[], 'floor_core', 43, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'Dancing made the room feel lively.', 'Moving the body to music.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('going', 'going', 'ng', array['g','o','i','ng']::text[], array['ng']::text[], 'floor_core', 37, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'We are going to the library next.', 'Moving or travelling somewhere.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('jumping', 'jumping', 'ng', array['j','u','m','p','i','ng']::text[], array['ng']::text[], 'floor_core', 45, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'Jumping over cones was part of PE.', 'Pushing off the ground with the feet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('reading', 'reading', 'ng', array['r','ea','d','i','ng']::text[], array['ng']::text[], 'floor_core', 44, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'Reading quietly helped everyone focus.', 'Looking at written text and understanding it.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('ringing', 'ringing', 'ng', array['r','i','ng','i','ng']::text[], array['ng']::text[], 'floor_core', 44, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'The ringing bell meant lunch was ready.', 'Making a clear bell-like sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('sleeping', 'sleeping', 'ng', array['s','l','ee','p','i','ng']::text[], array['ng']::text[], 'floor_core', 43, 'Core', 'ng consonant_digraph word with age-appropriate classroom context.', 'The sleeping puppy lay on a blanket.', 'Resting with eyes closed.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('backpack', 'backpack', 'ck', array['b','a','ck','p','a','ck']::text[], array['ck']::text[], 'floor_core', 33, 'Easier', 'ck consonant_digraph word with age-appropriate classroom context.', 'The backpack hung on the peg.', 'A bag carried on the back.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('block', 'block', 'ck', array['b','l','o','ck']::text[], array['ck']::text[], 'floor_core', 31, 'Easier', 'ck consonant_digraph word with age-appropriate classroom context.', 'One wooden block rolled under the table.', 'A solid piece used for building or play.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('click', 'click', 'ck', array['c','l','i','ck']::text[], array['ck']::text[], 'floor_core', 29, 'Easier', 'ck consonant_digraph word with age-appropriate classroom context.', 'The lid closed with a click.', 'A short sharp sound.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('flock', 'flock', 'ck', array['f','l','o','ck']::text[], array['ck']::text[], 'floor_core', 31, 'Easier', 'ck consonant_digraph word with age-appropriate classroom context.', 'A flock flew across the sky.', 'A group of birds or sheep.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('pickle', 'pickle', 'ck', array['p','i','ck','l','e']::text[], array['ck']::text[], 'floor_core', 32, 'Easier', 'ck consonant_digraph word with age-appropriate classroom context.', 'A pickle added crunch to the sandwich.', 'A small vegetable kept in vinegar or salt water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('trick', 'trick', 'ck', array['t','r','i','ck']::text[], array['ck']::text[], 'floor_core', 27, 'Easier', 'ck consonant_digraph word with age-appropriate classroom context.', 'The card trick made everyone laugh.', 'A clever action that surprises people.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('fridges', 'fridges', 'dge', array['f','r','i','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'The fridges kept the picnic food cold.', 'Cupboards that keep food cold.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('hedges', 'hedges', 'dge', array['h','e','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 51, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'The hedges were trimmed into neat shapes.', 'Rows of bushes grown close together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('judges', 'judges', 'dge', array['j','u','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 47, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'The judges chose the neatest model.', 'People who decide results in a contest.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('nudges', 'nudges', 'dge', array['n','u','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 49, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'Mina gives the door two gentle nudges.', 'Small gentle pushes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('porridge', 'porridge', 'dge', array['p','o','rr','i','dge']::text[], array['dge']::text[], 'ceiling_challenge', 50, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'Warm porridge filled the breakfast bowl.', 'A soft breakfast made from oats.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('smudges', 'smudges', 'dge', array['s','m','u','dge','s']::text[], array['dge']::text[], 'ceiling_challenge', 54, 'Core', 'dge trigraph word with age-appropriate classroom context.', 'The page had pencil smudges near the corner.', 'Blurred marks made by rubbing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('competition', 'competition', 'tion', array['c','o','m','p','e','t','i','tion']::text[], array['tion']::text[], 'ceiling_challenge', 73, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'The skipping competition was friendly.', 'An event where people try to do their best.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('decoration', 'decoration', 'tion', array['d','e','c','or','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 69, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'The decoration hung above the door.', 'Something added to make a place look nice.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('foundation', 'foundation', 'tion', array['f','ou','n','d','a','tion']::text[], array['tion']::text[], 'ceiling_challenge', 71, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'The tower needed a firm foundation.', 'The strong base that supports something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('suggestion', 'suggestion', 'tion', array['s','u','gg','e','s','tion']::text[], array['tion']::text[], 'ceiling_challenge', 69, 'Stretch', 'tion trigraph word with age-appropriate classroom context.', 'Your suggestion made the plan clearer.', 'An idea offered for someone to consider.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('burrow', 'burrow', 'ur', array['b','ur','r','ow']::text[], array['ur']::text[], 'diagnostic', 49, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'A burrow opened under the hedge.', 'A hole or tunnel made by an animal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('curb', 'curb', 'ur', array['c','ur','b']::text[], array['ur']::text[], 'diagnostic', 46, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'Stop near the curb before crossing.', 'The raised edge beside a road.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('curve', 'curve', 'ur', array['c','ur','v','e']::text[], array['ur']::text[], 'diagnostic', 51, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The path made a gentle curve.', 'A line that bends smoothly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('furry', 'furry', 'ur', array['f','ur','r','y']::text[], array['ur']::text[], 'diagnostic', 51, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The furry blanket felt warm.', 'Covered with soft hair or fur.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('hurdle', 'hurdle', 'ur', array['h','ur','d','l','e']::text[], array['ur']::text[], 'diagnostic', 50, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The runner stepped over the low hurdle.', 'A frame that people jump over in sport.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('turkey', 'turkey', 'ur', array['t','ur','k','ey']::text[], array['ur']::text[], 'diagnostic', 47, 'Core', 'ur r_controlled_vowel word with age-appropriate classroom context.', 'The turkey feather lay on the farm path.', 'A large bird often kept on farms.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('briefly', 'briefly', 'ie', array['b','r','ie','f','l','y']::text[], array['ie']::text[], 'ceiling_challenge', 69, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'We briefly checked the timetable.', 'For a short time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('chiefly', 'chiefly', 'ie', array['ch','ie','f','l','y']::text[], array['ie']::text[], 'ceiling_challenge', 68, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'The club is chiefly for reading.', 'Mainly or mostly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('friendly', 'friendly', 'ie', array['f','r','ie','n','d','l','y']::text[], array['ie']::text[], 'ceiling_challenge', 70, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'The friendly dog sat by the gate.', 'Kind and pleasant to others.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('friendship', 'friendship', 'ie', array['f','r','ie','n','d','sh','i','p']::text[], array['ie']::text[], 'ceiling_challenge', 75, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'Their friendship grew during the project.', 'A kind relationship between friends.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('pier', 'pier', 'ie', array['p','ie','r']::text[], array['ie']::text[], 'ceiling_challenge', 62, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'The pier stretched over the water.', 'A platform built out over water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('yield', 'yield', 'ie', array['y','ie','l','d']::text[], array['ie']::text[], 'ceiling_challenge', 61, 'Stretch', 'ie vowel_digraph word with age-appropriate classroom context.', 'The garden bed will yield many peas.', 'To produce or give something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('decide', 'decide', 'ci', array['d','e','ci','d','e']::text[], array['ci']::text[], 'ceiling_challenge', 66, 'Stretch', 'ci soft_c word with age-appropriate classroom context.', 'We will decide after reading both choices.', 'To choose after thinking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('excited', 'excited', 'ci', array['e','x','ci','t','e','d']::text[], array['ci']::text[], 'ceiling_challenge', 67, 'Stretch', 'ci soft_c word with age-appropriate classroom context.', 'The class felt excited about the trip.', 'Very happy and eager.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('exercise', 'exercise', 'ci', array['e','x','er','ci','s','e']::text[], array['ci']::text[], 'ceiling_challenge', 71, 'Stretch', 'ci soft_c word with age-appropriate classroom context.', 'Gentle exercise helped us feel ready to learn.', 'Activity that keeps the body strong and healthy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('precise', 'precise', 'ci', array['p','r','e','ci','s','e']::text[], array['ci']::text[], 'ceiling_challenge', 71, 'Stretch', 'ci soft_c word with age-appropriate classroom context.', 'Use a precise line for the graph.', 'Exact and careful.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('applauding', 'applauding', 'au', array['a','pp','l','au','d','i','ng']::text[], array['au']::text[], 'ceiling_challenge', 56, 'Stretch', 'au vowel_digraph word with age-appropriate classroom context.', 'The audience kept applauding after the song.', 'Clapping to show approval.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('cauliflower', 'cauliflower', 'au', array['c','au','l','i','f','l','ow','er']::text[], array['au']::text[], 'ceiling_challenge', 63, 'Stretch', 'au vowel_digraph word with age-appropriate classroom context.', 'Cauliflower soup warmed the lunch table.', 'A pale vegetable with a firm head.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('faulty', 'faulty', 'au', array['f','au','l','t','y']::text[], array['au']::text[], 'ceiling_challenge', 52, 'Core', 'au vowel_digraph word with age-appropriate classroom context.', 'The faulty torch needed new batteries.', 'Not working correctly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('launching', 'launching', 'au', array['l','au','n','ch','i','ng']::text[], array['au']::text[], 'ceiling_challenge', 55, 'Stretch', 'au vowel_digraph word with age-appropriate classroom context.', 'The club is launching a paper rocket.', 'Sending something out or starting it.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('daydream', 'daydream', 'ay', array['d','ay','d','r','ea','m']::text[], array['ay']::text[], 'floor_core', 35, 'Core', 'ay vowel_digraph word with age-appropriate classroom context.', 'A daydream gave her a story idea.', 'A pleasant thought while awake.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('daytime', 'daytime', 'ay', array['d','ay','t','i','m','e']::text[], array['ay']::text[], 'floor_core', 33, 'Easier', 'ay vowel_digraph word with age-appropriate classroom context.', 'The daytime sky was pale blue.', 'The part of the day when it is light.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('essay', 'essay', 'ay', array['e','ss','ay']::text[], array['ay']::text[], 'floor_core', 28, 'Easier', 'ay vowel_digraph word with age-appropriate classroom context.', 'The essay described a favourite place.', 'A short piece of writing on one topic.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('hallway', 'hallway', 'ay', array['h','a','ll','w','ay']::text[], array['ay']::text[], 'floor_core', 32, 'Easier', 'ay vowel_digraph word with age-appropriate classroom context.', 'The hallway display showed winter art.', 'A passage inside a building.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('playful', 'playful', 'ay', array['p','l','ay','f','u','l']::text[], array['ay']::text[], 'floor_core', 37, 'Core', 'ay vowel_digraph word with age-appropriate classroom context.', 'The playful kitten chased a ribbon.', 'Full of fun and ready to play.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('playtime', 'playtime', 'ay', array['p','l','ay','t','i','m','e']::text[], array['ay']::text[], 'floor_core', 36, 'Core', 'ay vowel_digraph word with age-appropriate classroom context.', 'Playtime ended when the bell rang.', 'A time set aside for play.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('cream', 'cream', 'ea', array['c','r','ea','m']::text[], array['ea']::text[], 'floor_core', 39, 'Core', 'ea vowel_digraph word with age-appropriate classroom context.', 'Cream was poured over the berries.', 'A thick rich part of milk.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('heap', 'heap', 'ea', array['h','ea','p']::text[], array['ea']::text[], 'floor_core', 36, 'Core', 'ea vowel_digraph word with age-appropriate classroom context.', 'A heap of leaves sat by the tree.', 'A pile of things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('leader', 'leader', 'ea', array['l','ea','d','er']::text[], array['ea']::text[], 'floor_core', 37, 'Core', 'ea vowel_digraph word with age-appropriate classroom context.', 'The line leader held the door open.', 'A person who guides a group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('leap', 'leap', 'ea', array['l','ea','p']::text[], array['ea']::text[], 'floor_core', 38, 'Core', 'ea vowel_digraph word with age-appropriate classroom context.', 'The dancer made a light leap.', 'A large jump.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('stream', 'stream', 'ea', array['s','t','r','ea','m']::text[], array['ea']::text[], 'floor_core', 44, 'Core', 'ea vowel_digraph word with age-appropriate classroom context.', 'A clear stream ran beside the path.', 'A small narrow river.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('wheat', 'wheat', 'ea', array['wh','ea','t']::text[], array['ea']::text[], 'floor_core', 34, 'Easier', 'ea vowel_digraph word with age-appropriate classroom context.', 'Wheat grew in the field beyond school.', 'A grain used to make flour.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('fewer', 'fewer', 'ew', array['f','ew','er']::text[], array['ew']::text[], 'diagnostic', 44, 'Core', 'ew vowel_digraph word with age-appropriate classroom context.', 'This box has fewer pencils than that one.', 'A smaller number of things.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('newborn', 'newborn', 'ew', array['n','ew','b','or','n']::text[], array['ew']::text[], 'diagnostic', 54, 'Core', 'ew vowel_digraph word with age-appropriate classroom context.', 'The newborn lamb slept in the straw.', 'Recently born.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('newcomer', 'newcomer', 'ew', array['n','ew','c','o','m','er']::text[], array['ew']::text[], 'diagnostic', 55, 'Stretch', 'ew vowel_digraph word with age-appropriate classroom context.', 'The newcomer joined our table kindly.', 'A person who has recently arrived.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('newsletter', 'newsletter', 'ew', array['n','ew','s','l','e','tt','er']::text[], array['ew']::text[], 'diagnostic', 56, 'Stretch', 'ew vowel_digraph word with age-appropriate classroom context.', 'The newsletter listed the club dates.', 'A short report sent to a group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('newspaper', 'newspaper', 'ew', array['n','ew','s','p','a','p','er']::text[], array['ew']::text[], 'diagnostic', 60, 'Stretch', 'ew vowel_digraph word with age-appropriate classroom context.', 'The newspaper lay folded on the desk.', 'Printed pages with news and reports.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('skewer', 'skewer', 'ew', array['s','k','ew','er']::text[], array['ew']::text[], 'diagnostic', 49, 'Core', 'ew vowel_digraph word with age-appropriate classroom context.', 'The fruit skewer had melon and grapes.', 'A thin stick used to hold pieces of food.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('miniature', 'miniature', 'ure', array['m','i','n','i','a','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 70, 'Stretch', 'ure trigraph word with age-appropriate classroom context.', 'The miniature house fitted in a shoebox.', 'A very small version of something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('moisture', 'moisture', 'ure', array['m','oi','s','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 66, 'Stretch', 'ure trigraph word with age-appropriate classroom context.', 'Moisture beaded on the cold window.', 'A small amount of water or dampness.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('sculpture', 'sculpture', 'ure', array['s','c','u','l','p','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 70, 'Stretch', 'ure trigraph word with age-appropriate classroom context.', 'The sculpture was made from clay.', 'A piece of art shaped from material.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('structure', 'structure', 'ure', array['s','t','r','u','c','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 74, 'Stretch', 'ure trigraph word with age-appropriate classroom context.', 'The bridge structure looked strong.', 'The way parts are built or arranged.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('dawdle', 'dawdle', 'aw', array['d','aw','d','l','e']::text[], array['aw']::text[], 'diagnostic', 52, 'Core', 'aw vowel_digraph word with age-appropriate classroom context.', 'Please do not dawdle on the way in.', 'To move or act too slowly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('flawless', 'flawless', 'aw', array['f','l','aw','l','e','ss']::text[], array['aw']::text[], 'diagnostic', 57, 'Stretch', 'aw vowel_digraph word with age-appropriate classroom context.', 'The team gave a flawless reading.', 'Having no mistakes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('lawnchair', 'lawnchair', 'aw', array['l','aw','n','ch','air']::text[], array['aw']::text[], 'diagnostic', 54, 'Core', 'aw vowel_digraph word with age-appropriate classroom context.', 'The lawnchair folded flat for storage.', 'A chair used outside on grass or a patio.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('seesawing', 'seesawing', 'aw', array['s','ee','s','aw','i','ng']::text[], array['aw']::text[], 'diagnostic', 53, 'Core', 'aw vowel_digraph word with age-appropriate classroom context.', 'The board kept seesawing up and down.', 'Moving back and forth like a seesaw.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('catching', 'catching', 'tch', array['c','a','tch','i','ng']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'tch trigraph word with age-appropriate classroom context.', 'Catching the beanbag took practice.', 'Taking hold of something that is moving.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('latching', 'latching', 'tch', array['l','a','tch','i','ng']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'tch trigraph word with age-appropriate classroom context.', 'The gate was latching neatly again.', 'Fastening with a small catch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('matchbox', 'matchbox', 'tch', array['m','a','tch','b','o','x']::text[], array['tch']::text[], 'diagnostic', 57, 'Stretch', 'tch trigraph word with age-appropriate classroom context.', 'The matchbox held tiny craft sticks.', 'A small box normally used for matches.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('patched', 'patched', 'tch', array['p','a','tch','e','d']::text[], array['tch']::text[], 'diagnostic', 52, 'Core', 'tch trigraph word with age-appropriate classroom context.', 'Mum patched the knee of the jeans.', 'Mended with a piece of material.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('patches', 'patches', 'tch', array['p','a','tch','e','s']::text[], array['tch']::text[], 'diagnostic', 54, 'Core', 'tch trigraph word with age-appropriate classroom context.', 'The blanket had colourful patches.', 'Pieces of material used for mending or decoration.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('sketchbook', 'sketchbook', 'tch', array['s','k','e','tch','b','oo','k']::text[], array['tch']::text[], 'diagnostic', 58, 'Stretch', 'tch trigraph word with age-appropriate classroom context.', 'The sketchbook was full of pencil drawings.', 'A book used for drawing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('switches', 'switches', 'tch', array['s','w','i','tch','e','s']::text[], array['tch']::text[], 'diagnostic', 55, 'Stretch', 'tch trigraph word with age-appropriate classroom context.', 'The switches turned on the display lights.', 'Small controls used to turn things on or off.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true),
  ('watcher', 'watcher', 'tch', array['w','a','tch','er']::text[], array['tch']::text[], 'diagnostic', 47, 'Core', 'tch trigraph word with age-appropriate classroom context.', 'The bird watcher wrote notes quietly.', 'A person who looks carefully at something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_7h_2026_05_13', true);

create temporary table wordloom_core_phase_7h_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_7h_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('afloat', 'oa', 'primary', 'vowel_digraph', 0),
  ('airflow', 'air', 'primary', 'r_controlled_vowel', 0),
  ('airmail', 'air', 'primary', 'r_controlled_vowel', 0),
  ('amount', 'ou', 'primary', 'vowel_digraph', 0),
  ('annoyed', 'oy', 'primary', 'vowel_digraph', 0),
  ('annoying', 'oy', 'primary', 'vowel_digraph', 0),
  ('appearing', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('applauding', 'au', 'primary', 'vowel_digraph', 0),
  ('approach', 'oa', 'primary', 'vowel_digraph', 0),
  ('backpack', 'ck', 'primary', 'consonant_digraph', 0),
  ('backyard', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('baker', 'er', 'primary', 'r_controlled_vowel', 0),
  ('baking', 'ng', 'primary', 'consonant_digraph', 0),
  ('below', 'ow', 'primary', 'vowel_digraph', 0),
  ('block', 'ck', 'primary', 'consonant_digraph', 0),
  ('boating', 'oa', 'primary', 'vowel_digraph', 0),
  ('boiling', 'oi', 'primary', 'vowel_digraph', 0),
  ('borrow', 'ow', 'primary', 'vowel_digraph', 0),
  ('branch', 'ch', 'primary', 'consonant_digraph', 0),
  ('briefly', 'ie', 'primary', 'vowel_digraph', 0),
  ('brightly', 'igh', 'primary', 'trigraph', 0),
  ('burrow', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('cardboard', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('carton', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('catching', 'tch', 'primary', 'trigraph', 0),
  ('cauliflower', 'au', 'primary', 'vowel_digraph', 0),
  ('chatter', 'ch', 'primary', 'consonant_digraph', 0),
  ('chiefly', 'ie', 'primary', 'vowel_digraph', 0),
  ('chocolate', 'ch', 'primary', 'consonant_digraph', 0),
  ('chosen', 'ch', 'primary', 'consonant_digraph', 0),
  ('chuckle', 'ch', 'primary', 'consonant_digraph', 0),
  ('click', 'ck', 'primary', 'consonant_digraph', 0),
  ('competition', 'tion', 'primary', 'trigraph', 0),
  ('container', 'ai', 'primary', 'vowel_digraph', 0),
  ('cooking', 'ng', 'primary', 'consonant_digraph', 0),
  ('cornfield', 'or', 'primary', 'r_controlled_vowel', 0),
  ('cornflake', 'or', 'primary', 'r_controlled_vowel', 0),
  ('counting', 'ou', 'primary', 'vowel_digraph', 0),
  ('cream', 'ea', 'primary', 'vowel_digraph', 0),
  ('creek', 'ee', 'primary', 'vowel_digraph', 0),
  ('curb', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('curve', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('dancing', 'ng', 'primary', 'consonant_digraph', 0),
  ('dawdle', 'aw', 'primary', 'vowel_digraph', 0),
  ('daydream', 'ay', 'primary', 'vowel_digraph', 0),
  ('daytime', 'ay', 'primary', 'vowel_digraph', 0),
  ('decide', 'ci', 'primary', 'soft_c', 0),
  ('decoration', 'tion', 'primary', 'trigraph', 0),
  ('downstairs', 'air', 'primary', 'r_controlled_vowel', 0),
  ('earmuffs', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('earphone', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('elbow', 'ow', 'primary', 'vowel_digraph', 0),
  ('enjoying', 'oy', 'primary', 'vowel_digraph', 0),
  ('essay', 'ay', 'primary', 'vowel_digraph', 0),
  ('excited', 'ci', 'primary', 'soft_c', 0),
  ('exercise', 'ci', 'primary', 'soft_c', 0),
  ('explain', 'ai', 'primary', 'vowel_digraph', 0),
  ('farmer', 'er', 'primary', 'r_controlled_vowel', 0),
  ('faulty', 'au', 'primary', 'vowel_digraph', 0),
  ('feather', 'th', 'primary', 'consonant_digraph', 0),
  ('fewer', 'ew', 'primary', 'vowel_digraph', 0),
  ('flash', 'sh', 'primary', 'consonant_digraph', 0),
  ('flawless', 'aw', 'primary', 'vowel_digraph', 0),
  ('flock', 'ck', 'primary', 'consonant_digraph', 0),
  ('flow', 'ow', 'primary', 'vowel_digraph', 0),
  ('foundation', 'tion', 'primary', 'trigraph', 0),
  ('freezer', 'ee', 'primary', 'vowel_digraph', 0),
  ('fridges', 'dge', 'primary', 'trigraph', 0),
  ('friendly', 'ie', 'primary', 'vowel_digraph', 0),
  ('friendship', 'ie', 'primary', 'vowel_digraph', 0),
  ('furry', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('gardener', 'er', 'primary', 'r_controlled_vowel', 0),
  ('garlic', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('going', 'ng', 'primary', 'consonant_digraph', 0),
  ('greet', 'ee', 'primary', 'vowel_digraph', 0),
  ('hairdryer', 'air', 'primary', 'r_controlled_vowel', 0),
  ('hallway', 'ay', 'primary', 'vowel_digraph', 0),
  ('heap', 'ea', 'primary', 'vowel_digraph', 0),
  ('hedges', 'dge', 'primary', 'trigraph', 0),
  ('highchair', 'igh', 'primary', 'trigraph', 0),
  ('houseboat', 'ou', 'primary', 'vowel_digraph', 0),
  ('housework', 'ou', 'primary', 'vowel_digraph', 0),
  ('hurdle', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('joining', 'oi', 'primary', 'vowel_digraph', 0),
  ('joyous', 'oy', 'primary', 'vowel_digraph', 0),
  ('judges', 'dge', 'primary', 'trigraph', 0),
  ('jumping', 'ng', 'primary', 'consonant_digraph', 0),
  ('latching', 'tch', 'primary', 'trigraph', 0),
  ('launching', 'au', 'primary', 'vowel_digraph', 0),
  ('lawnchair', 'aw', 'primary', 'vowel_digraph', 0),
  ('leader', 'ea', 'primary', 'vowel_digraph', 0),
  ('leap', 'ea', 'primary', 'vowel_digraph', 0),
  ('lightly', 'igh', 'primary', 'trigraph', 0),
  ('loyally', 'oy', 'primary', 'vowel_digraph', 0),
  ('loyalty', 'oy', 'primary', 'vowel_digraph', 0),
  ('mainly', 'ai', 'primary', 'vowel_digraph', 0),
  ('maker', 'er', 'primary', 'r_controlled_vowel', 0),
  ('margin', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('matchbox', 'tch', 'primary', 'trigraph', 0),
  ('meadow', 'ow', 'primary', 'vowel_digraph', 0),
  ('miniature', 'ure', 'primary', 'trigraph', 0),
  ('moisture', 'ure', 'primary', 'trigraph', 0),
  ('mouthful', 'ou', 'primary', 'vowel_digraph', 0),
  ('mushroom', 'sh', 'primary', 'consonant_digraph', 0),
  ('narrow', 'ow', 'primary', 'vowel_digraph', 0),
  ('newborn', 'ew', 'primary', 'vowel_digraph', 0),
  ('newcomer', 'ew', 'primary', 'vowel_digraph', 0),
  ('newsletter', 'ew', 'primary', 'vowel_digraph', 0),
  ('newspaper', 'ew', 'primary', 'vowel_digraph', 0),
  ('nighttime', 'igh', 'primary', 'trigraph', 0),
  ('noisemaker', 'oi', 'primary', 'vowel_digraph', 0),
  ('noisily', 'oi', 'primary', 'vowel_digraph', 0),
  ('nudges', 'dge', 'primary', 'trigraph', 0),
  ('oilcan', 'oi', 'primary', 'vowel_digraph', 0),
  ('outdoor', 'ou', 'primary', 'vowel_digraph', 0),
  ('parcel', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('patched', 'tch', 'primary', 'trigraph', 0),
  ('patches', 'tch', 'primary', 'trigraph', 0),
  ('pickle', 'ck', 'primary', 'consonant_digraph', 0),
  ('pier', 'ie', 'primary', 'vowel_digraph', 0),
  ('pillow', 'ow', 'primary', 'vowel_digraph', 0),
  ('pinch', 'ch', 'primary', 'consonant_digraph', 0),
  ('playful', 'ay', 'primary', 'vowel_digraph', 0),
  ('playhouse', 'ou', 'primary', 'vowel_digraph', 0),
  ('playtime', 'ay', 'primary', 'vowel_digraph', 0),
  ('plush', 'sh', 'primary', 'consonant_digraph', 0),
  ('porridge', 'dge', 'primary', 'trigraph', 0),
  ('precise', 'ci', 'primary', 'soft_c', 0),
  ('radish', 'sh', 'primary', 'consonant_digraph', 0),
  ('railing', 'ai', 'primary', 'vowel_digraph', 0),
  ('raincoat', 'oa', 'primary', 'vowel_digraph', 0),
  ('reader', 'er', 'primary', 'r_controlled_vowel', 0),
  ('reading', 'ng', 'primary', 'consonant_digraph', 0),
  ('remain', 'ai', 'primary', 'vowel_digraph', 0),
  ('ringing', 'ng', 'primary', 'consonant_digraph', 0),
  ('roadway', 'oa', 'primary', 'vowel_digraph', 0),
  ('scooter', 'er', 'primary', 'r_controlled_vowel', 0),
  ('sculpture', 'ure', 'primary', 'trigraph', 0),
  ('seesawing', 'aw', 'primary', 'vowel_digraph', 0),
  ('shimmer', 'sh', 'primary', 'consonant_digraph', 0),
  ('shortcake', 'or', 'primary', 'r_controlled_vowel', 0),
  ('singer', 'er', 'primary', 'r_controlled_vowel', 0),
  ('sketchbook', 'tch', 'primary', 'trigraph', 0),
  ('skewer', 'ew', 'primary', 'vowel_digraph', 0),
  ('sleeping', 'ng', 'primary', 'consonant_digraph', 0),
  ('sleeve', 'ee', 'primary', 'vowel_digraph', 0),
  ('slightly', 'igh', 'primary', 'trigraph', 0),
  ('smooth', 'th', 'primary', 'consonant_digraph', 0),
  ('smudges', 'dge', 'primary', 'trigraph', 0),
  ('soaking', 'oa', 'primary', 'vowel_digraph', 0),
  ('soundly', 'ou', 'primary', 'vowel_digraph', 0),
  ('speed', 'ee', 'primary', 'vowel_digraph', 0),
  ('sporty', 'or', 'primary', 'r_controlled_vowel', 0),
  ('starry', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('storytime', 'or', 'primary', 'r_controlled_vowel', 0),
  ('stream', 'ea', 'primary', 'vowel_digraph', 0),
  ('structure', 'ure', 'primary', 'trigraph', 0),
  ('suggestion', 'tion', 'primary', 'trigraph', 0),
  ('swimmer', 'er', 'primary', 'r_controlled_vowel', 0),
  ('switches', 'tch', 'primary', 'trigraph', 0),
  ('target', 'ar', 'primary', 'r_controlled_vowel', 0),
  ('teardrop', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('thimble', 'th', 'primary', 'consonant_digraph', 0),
  ('thirsty', 'th', 'primary', 'consonant_digraph', 0),
  ('thirteen', 'th', 'primary', 'consonant_digraph', 0),
  ('throw', 'th', 'primary', 'consonant_digraph', 0),
  ('tightly', 'igh', 'primary', 'trigraph', 0),
  ('tooth', 'th', 'primary', 'consonant_digraph', 0),
  ('torchlight', 'or', 'primary', 'r_controlled_vowel', 0),
  ('trainer', 'ai', 'primary', 'vowel_digraph', 0),
  ('trick', 'ck', 'primary', 'consonant_digraph', 0),
  ('turkey', 'ur', 'primary', 'r_controlled_vowel', 0),
  ('uncoil', 'oi', 'primary', 'vowel_digraph', 0),
  ('vanish', 'sh', 'primary', 'consonant_digraph', 0),
  ('watcher', 'tch', 'primary', 'trigraph', 0),
  ('wearable', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('wearing', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('weather', 'th', 'primary', 'consonant_digraph', 0),
  ('weekend', 'ee', 'primary', 'vowel_digraph', 0),
  ('wheat', 'ea', 'primary', 'vowel_digraph', 0),
  ('willow', 'ow', 'primary', 'vowel_digraph', 0),
  ('yield', 'ie', 'primary', 'vowel_digraph', 0);

do $$
begin
  if (select count(*) from wordloom_core_phase_7h_words) <> 182 then
    raise exception 'Wordloom core Phase 7H batch must contain exactly 182 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7h_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_7h_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_7h_word_count
  ) then
    raise exception 'Wordloom core Phase 7H target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_7h_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 7H batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_7h_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> 'wordloom_core_v1_phase_7h_2026_05_13'
  ) then
    raise exception 'Wordloom core Phase 7H batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7h_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_7h_2026_05_13'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 7H words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7h_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ) then
    raise exception 'Wordloom core Phase 7H words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7h_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ) then
    raise exception 'Wordloom core Phase 7H words contain explicit spelling-hint context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7h_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 7H words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7h_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 7H primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7h_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 7H word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7h_word_targets as word_targets
    left join wordloom_core_phase_7h_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 7H word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_7h_words as words
    left join wordloom_core_phase_7h_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 7H word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 7H final core-bank expansion batch target'
from wordloom_core_phase_7h_targets
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
    from wordloom_core_phase_7h_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 7H linked targets must exist and be active.';
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
from wordloom_core_phase_7h_words
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
  'Wordloom core v1 Phase 7H final core-bank expansion batch target link'
from wordloom_core_phase_7h_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_7h_2026_05_13'
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
      and source_version = 'wordloom_core_v1_phase_7h_2026_05_13'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 182 then
    raise exception 'Wordloom core Phase 7H persisted word count must be exactly 182.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7h_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_7h_2026_05_13'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_7h_word_count
  ) then
    raise exception 'Wordloom core Phase 7H persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 7H.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_7h_2026_05_13'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 7H persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_7h_2026_05_13'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 7H persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_7h_2026_05_13'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 7H word must have exactly one primary target link.';
  end if;
  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join wordloom_core_phase_7h_words as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core Phase 7H must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join wordloom_core_phase_7h_words as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core Phase 7H must not add rows to school spelling bank additions.';
  end if;

end $$;

commit;
