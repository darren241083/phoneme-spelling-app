begin;

create temporary table wordloom_core_proof_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_primary_word_count integer not null
) on commit drop;

insert into wordloom_core_proof_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_primary_word_count
)
values
  ('ai', 'ai', 'floor_core', 'needs_support', 10, 6),
  ('ee', 'ee', 'floor_core', 'needs_support', 20, 6),
  ('oa', 'oa', 'floor_core', 'needs_support', 30, 6),
  ('igh', 'igh', 'floor_core', 'core_developing', 40, 6),
  ('ar', 'ar', 'floor_core', 'core_developing', 50, 12),
  ('or', 'or', 'floor_core', 'core_developing', 60, 6),
  ('air', 'air', 'diagnostic', 'secure_expected', 70, 6),
  ('ear', 'ear', 'diagnostic', 'secure_expected', 80, 6),
  ('er', 'er', 'diagnostic', 'secure_expected', 90, 6),
  ('oy', 'oy', 'floor_core', 'core_developing', 100, 6),
  ('oi', 'oi', 'floor_core', 'core_developing', 110, 6),
  ('ou', 'ou', 'floor_core', 'core_developing', 120, 6),
  ('ow', 'ow', 'floor_core', 'core_developing', 130, 6),
  ('sh', 'sh', 'floor_core', 'needs_support', 140, 6),
  ('ch', 'ch', 'floor_core', 'needs_support', 150, 6),
  ('th', 'th', 'floor_core', 'core_developing', 160, 6),
  ('ng', 'ng', 'floor_core', 'core_developing', 170, 6),
  ('ck', 'ck', 'floor_core', 'needs_support', 180, 6),
  ('dge', 'dge', 'ceiling_challenge', 'secure_expected', 190, 6),
  ('tion', 'tion', 'ceiling_challenge', 'early_stretch', 200, 6),
  ('ur', 'ur', 'diagnostic', 'secure_expected', 210, 6),
  ('ie', 'ie', 'ceiling_challenge', 'early_stretch', 220, 6),
  ('ci', 'ci', 'ceiling_challenge', 'early_stretch', 230, 6),
  ('au', 'au', 'ceiling_challenge', 'secure_expected', 240, 6);

create temporary table wordloom_core_proof_words (
  word text primary key,
  normalised_word text not null,
  primary_focus_grapheme text not null,
  grapheme_segments text[] not null,
  stage_band text not null,
  difficulty_score integer not null,
  difficulty_label text not null,
  difficulty_reason text not null,
  sentence text not null,
  meaning text not null
) on commit drop;

insert into wordloom_core_proof_words (
  word,
  normalised_word,
  primary_focus_grapheme,
  grapheme_segments,
  stage_band,
  difficulty_score,
  difficulty_label,
  difficulty_reason,
  sentence,
  meaning
)
values
  ('train', 'train', 'ai', array['t','r','ai','n']::text[], 'floor_core', 24, 'Easier', 'Common one-syllable ai word with an initial blend.', 'The train stopped at the small station.', 'A vehicle that runs on rails.'),
  ('paint', 'paint', 'ai', array['p','ai','n','t']::text[], 'floor_core', 28, 'Easier', 'Common ai word with a final consonant cluster.', 'We used blue paint for the poster.', 'Coloured liquid used to cover a surface.'),
  ('snail', 'snail', 'ai', array['s','n','ai','l']::text[], 'floor_core', 30, 'Easier', 'Common ai word with a starting blend.', 'The snail moved across the path.', 'A small animal with a shell.'),
  ('chain', 'chain', 'ai', array['ch','ai','n']::text[], 'floor_core', 32, 'Easier', 'Common ai word with another multiletter grapheme.', 'The chain held the gate closed.', 'A row of metal links joined together.'),
  ('rain', 'rain', 'ai', array['r','ai','n']::text[], 'floor_core', 20, 'Easier', 'Short common ai word.', 'Heavy rain fell after lunch.', 'Water that falls from clouds.'),
  ('wait', 'wait', 'ai', array['w','ai','t']::text[], 'floor_core', 22, 'Easier', 'Short common ai word.', 'Please wait by the classroom door.', 'To stay until something happens.'),

  ('seed', 'seed', 'ee', array['s','ee','d']::text[], 'floor_core', 18, 'Easier', 'Short common ee word.', 'The seed grew in the pot.', 'A small part of a plant that can grow.'),
  ('green', 'green', 'ee', array['g','r','ee','n']::text[], 'floor_core', 26, 'Easier', 'Common ee word with an initial blend.', 'The green book was on the desk.', 'The colour of grass.'),
  ('sleep', 'sleep', 'ee', array['s','l','ee','p']::text[], 'floor_core', 26, 'Easier', 'Common ee word with an initial blend.', 'Good sleep helps you feel ready.', 'Resting with your eyes closed.'),
  ('street', 'street', 'ee', array['s','t','r','ee','t']::text[], 'diagnostic', 42, 'Core', 'Longer ee word with a consonant cluster.', 'The street was quiet after school.', 'A road in a town or village.'),
  ('tree', 'tree', 'ee', array['t','r','ee']::text[], 'floor_core', 24, 'Easier', 'Common ee word with an initial blend.', 'A tall tree shaded the bench.', 'A large plant with a trunk and branches.'),
  ('queen', 'queen', 'ee', array['qu','ee','n']::text[], 'diagnostic', 38, 'Core', 'Common ee word with qu.', 'The queen wore a silver crown.', 'A female ruler.'),

  ('boat', 'boat', 'oa', array['b','oa','t']::text[], 'floor_core', 18, 'Easier', 'Short common oa word.', 'The boat crossed the lake.', 'A vehicle that travels on water.'),
  ('coat', 'coat', 'oa', array['c','oa','t']::text[], 'floor_core', 20, 'Easier', 'Short common oa word.', 'Hang your coat on the peg.', 'Clothing worn over other clothes.'),
  ('road', 'road', 'oa', array['r','oa','d']::text[], 'floor_core', 20, 'Easier', 'Short common oa word.', 'The road bends near the school.', 'A way for traffic to travel on.'),
  ('toast', 'toast', 'oa', array['t','oa','s','t']::text[], 'floor_core', 30, 'Easier', 'Common oa word with a final consonant cluster.', 'I ate warm toast for breakfast.', 'Bread that has been browned by heat.'),
  ('float', 'float', 'oa', array['f','l','oa','t']::text[], 'diagnostic', 34, 'Easier', 'Common oa word with initial and final clusters.', 'The leaf can float on the water.', 'To rest or move on top of liquid.'),
  ('soap', 'soap', 'oa', array['s','oa','p']::text[], 'floor_core', 22, 'Easier', 'Short common oa word.', 'Use soap to wash your hands.', 'Something used for washing.'),

  ('light', 'light', 'igh', array['l','igh','t']::text[], 'floor_core', 24, 'Easier', 'Common igh word.', 'The light shone through the window.', 'Brightness that helps us see.'),
  ('night', 'night', 'igh', array['n','igh','t']::text[], 'floor_core', 24, 'Easier', 'Common igh word.', 'The stars came out at night.', 'The dark part of the day.'),
  ('bright', 'bright', 'igh', array['b','r','igh','t']::text[], 'diagnostic', 38, 'Core', 'Common igh word with an initial blend.', 'The bright lamp lit the room.', 'Giving a lot of light.'),
  ('sight', 'sight', 'igh', array['s','igh','t']::text[], 'floor_core', 30, 'Easier', 'Common igh word.', 'The castle was an amazing sight.', 'Something that can be seen.'),
  ('high', 'high', 'igh', array['h','igh']::text[], 'floor_core', 24, 'Easier', 'Short common igh word.', 'The shelf is too high for me.', 'Far above the ground.'),
  ('right', 'right', 'igh', array['r','igh','t']::text[], 'diagnostic', 36, 'Core', 'Common igh word with a frequent rime.', 'You chose the right answer.', 'Correct or on the correct side.'),

  ('sharp', 'sharp', 'ar', array['sh','ar','p']::text[], 'floor_core', 32, 'Easier', 'Common ar word with sh.', 'The pencil has a sharp point.', 'Having a fine point or edge.'),
  ('farm', 'farm', 'ar', array['f','ar','m']::text[], 'floor_core', 22, 'Easier', 'Short common ar word.', 'The farm kept sheep and hens.', 'Land used for growing food or keeping animals.'),
  ('start', 'start', 'ar', array['s','t','ar','t']::text[], 'diagnostic', 42, 'Core', 'Common ar word with consonant clusters.', 'We start reading after lunch.', 'To begin doing something.'),
  ('garden', 'garden', 'ar', array['g','ar','d','e','n']::text[], 'diagnostic', 56, 'Core', 'Longer ar word with two syllables.', 'The garden had a small pond.', 'A place where plants are grown.'),
  ('park', 'park', 'ar', array['p','ar','k']::text[], 'floor_core', 20, 'Easier', 'Short common ar word.', 'We played football in the park.', 'An open place for play and walks.'),
  ('dark', 'dark', 'ar', array['d','ar','k']::text[], 'floor_core', 24, 'Easier', 'Short common ar word.', 'The room was dark before sunrise.', 'Having little or no light.'),
  ('hard', 'hard', 'ar', array['h','ar','d']::text[], 'floor_core', 24, 'Easier', 'Short common ar word.', 'The puzzle was hard at first.', 'Difficult or firm to touch.'),
  ('barn', 'barn', 'ar', array['b','ar','n']::text[], 'floor_core', 24, 'Easier', 'Short common ar word.', 'The hay was stored in the barn.', 'A farm building for animals or crops.'),
  ('cart', 'cart', 'ar', array['c','ar','t']::text[], 'floor_core', 26, 'Easier', 'Short common ar word.', 'The cart carried the books.', 'A small vehicle used for carrying things.'),
  ('star', 'star', 'ar', array['s','t','ar']::text[], 'floor_core', 24, 'Easier', 'Short ar word with an initial cluster.', 'A bright star appeared in the sky.', 'A shining object seen in the night sky.'),
  ('market', 'market', 'ar', array['m','ar','k','e','t']::text[], 'ceiling_challenge', 60, 'Stretch', 'Two-syllable ar word with a longer pattern.', 'The market sold fresh fruit.', 'A place where people buy and sell things.'),
  ('artist', 'artist', 'ar', array['ar','t','i','s','t']::text[], 'ceiling_challenge', 62, 'Stretch', 'Two-syllable ar word with a consonant cluster.', 'The artist drew a careful sketch.', 'A person who makes art.'),

  ('storm', 'storm', 'or', array['s','t','or','m']::text[], 'floor_core', 30, 'Easier', 'Common or word with an initial blend.', 'The storm passed before morning.', 'Very bad weather with wind or rain.'),
  ('fork', 'fork', 'or', array['f','or','k']::text[], 'floor_core', 24, 'Easier', 'Short common or word.', 'Use a fork to eat the pasta.', 'A tool used for eating food.'),
  ('short', 'short', 'or', array['sh','or','t']::text[], 'floor_core', 32, 'Easier', 'Common or word with sh.', 'The story was short and funny.', 'Not long.'),
  ('torch', 'torch', 'or', array['t','or','ch']::text[], 'diagnostic', 40, 'Core', 'Common or word with ch.', 'The torch helped us see the path.', 'A small light carried by hand.'),
  ('born', 'born', 'or', array['b','or','n']::text[], 'floor_core', 26, 'Easier', 'Short common or word.', 'The lamb was born in spring.', 'Brought into life.'),
  ('corner', 'corner', 'or', array['c','or','n','er']::text[], 'diagnostic', 52, 'Core', 'Longer or word with a final er segment.', 'The chair stood in the corner.', 'The place where two sides meet.'),

  ('chair', 'chair', 'air', array['ch','air']::text[], 'floor_core', 32, 'Easier', 'Common air word with ch.', 'The chair was beside the table.', 'A seat for one person.'),
  ('fair', 'fair', 'air', array['f','air']::text[], 'floor_core', 24, 'Easier', 'Short common air word.', 'The game was fair for everyone.', 'Treating people equally.'),
  ('stair', 'stair', 'air', array['s','t','air']::text[], 'diagnostic', 36, 'Core', 'Common air word with an initial cluster.', 'The stair creaked under my foot.', 'One step in a set of stairs.'),
  ('hair', 'hair', 'air', array['h','air']::text[], 'floor_core', 22, 'Easier', 'Short common air word.', 'Her hair was tied back for sport.', 'The fine strands that grow on your head.'),
  ('pair', 'pair', 'air', array['p','air']::text[], 'floor_core', 24, 'Easier', 'Short common air word.', 'I found a pair of socks.', 'Two things that belong together.'),
  ('airport', 'airport', 'air', array['air','p','or','t']::text[], 'ceiling_challenge', 62, 'Stretch', 'Longer air word with a second vowel pattern.', 'The airport was busy today.', 'A place where planes take off and land.'),

  ('hear', 'hear', 'ear', array['h','ear']::text[], 'floor_core', 24, 'Easier', 'Short common ear word.', 'I can hear music in the hall.', 'To notice a sound with your ears.'),
  ('clear', 'clear', 'ear', array['c','l','ear']::text[], 'diagnostic', 36, 'Core', 'Common ear word with an initial blend.', 'The instructions were clear.', 'Easy to understand or see through.'),
  ('near', 'near', 'ear', array['n','ear']::text[], 'floor_core', 22, 'Easier', 'Short common ear word.', 'The library is near our classroom.', 'Not far away.'),
  ('year', 'year', 'ear', array['y','ear']::text[], 'floor_core', 26, 'Easier', 'Short common ear word.', 'This year we studied plants.', 'A period of twelve months.'),
  ('beard', 'beard', 'ear', array['b','ear','d']::text[], 'diagnostic', 38, 'Core', 'Common ear word with a final consonant.', 'The man had a short beard.', 'Hair that grows on the chin and face.'),
  ('spear', 'spear', 'ear', array['s','p','ear']::text[], 'ceiling_challenge', 58, 'Core', 'Less common ear word with an initial cluster.', 'The museum showed an old spear.', 'A long pointed weapon used in the past.'),

  ('her', 'her', 'er', array['h','er']::text[], 'floor_core', 18, 'Easier', 'Short common er word.', 'I gave her the spare pencil.', 'A word used for a girl or woman.'),
  ('term', 'term', 'er', array['t','er','m']::text[], 'floor_core', 26, 'Easier', 'Short common er word.', 'The spring term starts in January.', 'A part of the school year.'),
  ('verb', 'verb', 'er', array['v','er','b']::text[], 'diagnostic', 34, 'Easier', 'Curriculum word with er.', 'A verb can show an action.', 'A word that shows an action or state.'),
  ('fern', 'fern', 'er', array['f','er','n']::text[], 'floor_core', 30, 'Easier', 'Short er word.', 'A fern grew beside the wall.', 'A green plant with divided leaves.'),
  ('letter', 'letter', 'er', array['l','e','tt','er']::text[], 'diagnostic', 46, 'Core', 'Common two-syllable er word.', 'The letter arrived in the post.', 'A written message sent to someone.'),
  ('winter', 'winter', 'er', array['w','i','n','t','er']::text[], 'diagnostic', 50, 'Core', 'Common two-syllable er word.', 'Winter mornings can be cold.', 'The coldest season of the year.'),

  ('boy', 'boy', 'oy', array['b','oy']::text[], 'floor_core', 18, 'Easier', 'Short common oy word.', 'The boy carried the tray.', 'A male child.'),
  ('joy', 'joy', 'oy', array['j','oy']::text[], 'floor_core', 20, 'Easier', 'Short common oy word.', 'The song brought joy to the class.', 'A feeling of great happiness.'),
  ('toy', 'toy', 'oy', array['t','oy']::text[], 'floor_core', 18, 'Easier', 'Short common oy word.', 'The toy car rolled under the sofa.', 'Something children play with.'),
  ('enjoy', 'enjoy', 'oy', array['e','n','j','oy']::text[], 'diagnostic', 42, 'Core', 'Common two-syllable oy word.', 'I enjoy reading funny stories.', 'To like doing something.'),
  ('annoy', 'annoy', 'oy', array['a','nn','oy']::text[], 'diagnostic', 46, 'Core', 'Two-syllable oy word with doubled consonant.', 'A loud buzz can annoy people.', 'To make someone feel bothered.'),
  ('royal', 'royal', 'oy', array['r','oy','a','l']::text[], 'diagnostic', 44, 'Core', 'Two-syllable oy word.', 'The royal coach was in the parade.', 'Linked with a king or queen.'),

  ('coin', 'coin', 'oi', array['c','oi','n']::text[], 'floor_core', 22, 'Easier', 'Short common oi word.', 'I found a coin by the gate.', 'A small piece of money made of metal.'),
  ('boil', 'boil', 'oi', array['b','oi','l']::text[], 'floor_core', 24, 'Easier', 'Short common oi word.', 'The water began to boil.', 'To get hot enough to bubble.'),
  ('soil', 'soil', 'oi', array['s','oi','l']::text[], 'floor_core', 24, 'Easier', 'Short common oi word.', 'The seed was covered with soil.', 'The earth that plants grow in.'),
  ('point', 'point', 'oi', array['p','oi','n','t']::text[], 'diagnostic', 32, 'Easier', 'Common oi word with a final consonant cluster.', 'Point to the answer you chose.', 'To show where something is.'),
  ('join', 'join', 'oi', array['j','oi','n']::text[], 'floor_core', 24, 'Easier', 'Short common oi word.', 'You can join our group game.', 'To become part of something.'),
  ('spoil', 'spoil', 'oi', array['s','p','oi','l']::text[], 'diagnostic', 36, 'Core', 'Common oi word with an initial blend.', 'Do not spoil the surprise.', 'To damage or ruin something.'),

  ('out', 'out', 'ou', array['ou','t']::text[], 'floor_core', 18, 'Easier', 'Short common ou word.', 'We went out after the rain.', 'Away from inside.'),
  ('loud', 'loud', 'ou', array['l','ou','d']::text[], 'floor_core', 22, 'Easier', 'Short common ou word.', 'The drum made a loud sound.', 'Making a strong noise.'),
  ('cloud', 'cloud', 'ou', array['c','l','ou','d']::text[], 'floor_core', 30, 'Easier', 'Common ou word with a blend.', 'A dark cloud covered the sun.', 'A mass of tiny drops in the sky.'),
  ('round', 'round', 'ou', array['r','ou','n','d']::text[], 'diagnostic', 34, 'Easier', 'Common ou word with a final consonant cluster.', 'The table was round.', 'Shaped like a circle or ball.'),
  ('count', 'count', 'ou', array['c','ou','n','t']::text[], 'diagnostic', 34, 'Easier', 'Common ou word with a final consonant cluster.', 'Count the pencils on the desk.', 'To find how many there are.'),
  ('found', 'found', 'ou', array['f','ou','n','d']::text[], 'diagnostic', 34, 'Easier', 'Common ou word with a final consonant cluster.', 'I found my ruler in the tray.', 'Discovered or came across.'),

  ('cow', 'cow', 'ow', array['c','ow']::text[], 'floor_core', 18, 'Easier', 'Short common ow word.', 'The cow stood near the fence.', 'A large farm animal kept for milk.'),
  ('now', 'now', 'ow', array['n','ow']::text[], 'floor_core', 18, 'Easier', 'Short common ow word.', 'We need to leave now.', 'At this moment.'),
  ('down', 'down', 'ow', array['d','ow','n']::text[], 'floor_core', 22, 'Easier', 'Short common ow word.', 'The ball rolled down the hill.', 'Towards a lower place.'),
  ('town', 'town', 'ow', array['t','ow','n']::text[], 'floor_core', 24, 'Easier', 'Short common ow word.', 'Our town has a small museum.', 'A place where many people live and work.'),
  ('brown', 'brown', 'ow', array['b','r','ow','n']::text[], 'diagnostic', 34, 'Easier', 'Common ow word with an initial blend.', 'The brown dog slept by the door.', 'The colour of wood or soil.'),
  ('crown', 'crown', 'ow', array['c','r','ow','n']::text[], 'diagnostic', 36, 'Core', 'Common ow word with an initial blend.', 'The crown was made of gold card.', 'A special head covering for a ruler.'),

  ('ship', 'ship', 'sh', array['sh','i','p']::text[], 'floor_core', 20, 'Easier', 'Short common sh word.', 'The ship sailed into the harbour.', 'A large boat.'),
  ('shop', 'shop', 'sh', array['sh','o','p']::text[], 'floor_core', 20, 'Easier', 'Short common sh word.', 'The shop opens at nine.', 'A place where things are sold.'),
  ('fish', 'fish', 'sh', array['f','i','sh']::text[], 'floor_core', 20, 'Easier', 'Short common sh word.', 'The fish swam under the bridge.', 'An animal that lives in water.'),
  ('shell', 'shell', 'sh', array['sh','e','ll']::text[], 'floor_core', 28, 'Easier', 'Common sh word with doubled consonant ending.', 'The shell was smooth and white.', 'A hard outer covering.'),
  ('brush', 'brush', 'sh', array['b','r','u','sh']::text[], 'diagnostic', 34, 'Easier', 'Common sh word with an initial blend.', 'Clean the tray with a brush.', 'A tool with bristles for cleaning or painting.'),
  ('fresh', 'fresh', 'sh', array['f','r','e','sh']::text[], 'diagnostic', 36, 'Core', 'Common sh word with an initial blend.', 'The bread was fresh this morning.', 'New, clean, or recently made.'),

  ('chip', 'chip', 'ch', array['ch','i','p']::text[], 'floor_core', 20, 'Easier', 'Short common ch word.', 'A chip fell from the plate.', 'A small piece broken from something.'),
  ('chop', 'chop', 'ch', array['ch','o','p']::text[], 'floor_core', 20, 'Easier', 'Short common ch word.', 'Chop the carrots into pieces.', 'To cut something into pieces.'),
  ('much', 'much', 'ch', array['m','u','ch']::text[], 'floor_core', 24, 'Easier', 'Short common ch word.', 'There was not much time left.', 'A large amount.'),
  ('lunch', 'lunch', 'ch', array['l','u','n','ch']::text[], 'diagnostic', 32, 'Easier', 'Common ch word with a final consonant cluster.', 'Lunch is after the lesson.', 'A meal eaten in the middle of the day.'),
  ('bench', 'bench', 'ch', array['b','e','n','ch']::text[], 'diagnostic', 34, 'Easier', 'Common ch word with a final consonant cluster.', 'We sat on the wooden bench.', 'A long seat for several people.'),
  ('rich', 'rich', 'ch', array['r','i','ch']::text[], 'floor_core', 26, 'Easier', 'Short common ch word.', 'The cake had a rich taste.', 'Having a lot of something, or strong in flavour.'),

  ('thin', 'thin', 'th', array['th','i','n']::text[], 'floor_core', 22, 'Easier', 'Short common th word.', 'Use a thin brush for the line.', 'Not thick.'),
  ('path', 'path', 'th', array['p','a','th']::text[], 'floor_core', 22, 'Easier', 'Short common th word.', 'The path led to the field.', 'A track for walking on.'),
  ('bath', 'bath', 'th', array['b','a','th']::text[], 'floor_core', 22, 'Easier', 'Short common th word.', 'The bath was full of warm water.', 'A large tub used for washing.'),
  ('moth', 'moth', 'th', array['m','o','th']::text[], 'floor_core', 24, 'Easier', 'Short th word.', 'A moth rested on the window.', 'An insect like a butterfly.'),
  ('three', 'three', 'th', array['th','r','ee']::text[], 'diagnostic', 36, 'Core', 'Common th word with a second vowel grapheme.', 'Three pupils shared the markers.', 'The number after two.'),
  ('thank', 'thank', 'th', array['th','a','n','k']::text[], 'diagnostic', 34, 'Easier', 'Common th word with a final consonant cluster.', 'Remember to thank the helper.', 'To show you are grateful.'),

  ('ring', 'ring', 'ng', array['r','i','ng']::text[], 'floor_core', 22, 'Easier', 'Short common ng word.', 'The bell will ring at noon.', 'To make a clear bell sound.'),
  ('song', 'song', 'ng', array['s','o','ng']::text[], 'floor_core', 22, 'Easier', 'Short common ng word.', 'The class learnt a new song.', 'Words and music sung together.'),
  ('king', 'king', 'ng', array['k','i','ng']::text[], 'floor_core', 22, 'Easier', 'Short common ng word.', 'The king waved from the balcony.', 'A male ruler.'),
  ('long', 'long', 'ng', array['l','o','ng']::text[], 'floor_core', 22, 'Easier', 'Short common ng word.', 'The corridor was long and bright.', 'Measuring a great distance from end to end.'),
  ('swing', 'swing', 'ng', array['s','w','i','ng']::text[], 'diagnostic', 36, 'Core', 'Common ng word with an initial blend.', 'The swing moved in the wind.', 'A seat that hangs and moves back and forth.'),
  ('strong', 'strong', 'ng', array['s','t','r','o','ng']::text[], 'diagnostic', 44, 'Core', 'Common ng word with a longer initial cluster.', 'The strong box held the tools.', 'Having a lot of power or strength.'),

  ('back', 'back', 'ck', array['b','a','ck']::text[], 'floor_core', 20, 'Easier', 'Short common ck word.', 'Put the book back on the shelf.', 'The rear part or to return something.'),
  ('duck', 'duck', 'ck', array['d','u','ck']::text[], 'floor_core', 20, 'Easier', 'Short common ck word.', 'The duck crossed the pond.', 'A water bird with a flat beak.'),
  ('rock', 'rock', 'ck', array['r','o','ck']::text[], 'floor_core', 20, 'Easier', 'Short common ck word.', 'A rock lay beside the path.', 'A hard piece of stone.'),
  ('clock', 'clock', 'ck', array['c','l','o','ck']::text[], 'diagnostic', 32, 'Easier', 'Common ck word with an initial blend.', 'The clock showed half past ten.', 'A device that shows the time.'),
  ('quick', 'quick', 'ck', array['qu','i','ck']::text[], 'diagnostic', 38, 'Core', 'Common ck word with qu.', 'She gave a quick answer.', 'Fast or taking little time.'),
  ('pocket', 'pocket', 'ck', array['p','o','ck','e','t']::text[], 'diagnostic', 42, 'Core', 'Two-syllable ck word.', 'The note was in my pocket.', 'A small pouch in clothing.'),

  ('edge', 'edge', 'dge', array['e','dge']::text[], 'diagnostic', 42, 'Core', 'Short dge word.', 'The cup sat near the edge.', 'The outside line or border of something.'),
  ('badge', 'badge', 'dge', array['b','a','dge']::text[], 'diagnostic', 44, 'Core', 'Common dge word.', 'The badge was pinned to her jumper.', 'A small sign worn on clothes.'),
  ('bridge', 'bridge', 'dge', array['b','r','i','dge']::text[], 'ceiling_challenge', 54, 'Core', 'Common dge word with an initial blend.', 'The bridge crossed the stream.', 'A structure built over water or a road.'),
  ('dodge', 'dodge', 'dge', array['d','o','dge']::text[], 'diagnostic', 46, 'Core', 'Common dge word.', 'Dodge the cones during the game.', 'To move quickly out of the way.'),
  ('fudge', 'fudge', 'dge', array['f','u','dge']::text[], 'diagnostic', 46, 'Core', 'Common dge word.', 'The fudge was cut into squares.', 'A soft sweet made with sugar.'),
  ('hedge', 'hedge', 'dge', array['h','e','dge']::text[], 'diagnostic', 46, 'Core', 'Common dge word.', 'The hedge grew beside the playground.', 'A row of bushes planted as a boundary.'),

  ('station', 'station', 'tion', array['s','t','a','tion']::text[], 'ceiling_challenge', 66, 'Stretch', 'Common tion word with two syllables.', 'The station was busy after school.', 'A place where trains or buses stop.'),
  ('action', 'action', 'tion', array['a','c','tion']::text[], 'ceiling_challenge', 62, 'Stretch', 'Common tion word with two syllables.', 'The story was full of action.', 'Something that is done.'),
  ('nation', 'nation', 'tion', array['n','a','tion']::text[], 'ceiling_challenge', 64, 'Stretch', 'Common tion word with two syllables.', 'Each nation sent a team.', 'A country and its people.'),
  ('section', 'section', 'tion', array['s','e','c','tion']::text[], 'ceiling_challenge', 68, 'Stretch', 'Common tion word with a consonant before tion.', 'Read the first section again.', 'One part of something larger.'),
  ('fiction', 'fiction', 'tion', array['f','i','c','tion']::text[], 'ceiling_challenge', 70, 'Stretch', 'Common tion word with a consonant before tion.', 'Fiction stories can be exciting.', 'Writing about imagined events.'),
  ('question', 'question', 'tion', array['qu','e','s','tion']::text[], 'ceiling_challenge', 72, 'Stretch', 'Common tion word with qu.', 'Ask one question at a time.', 'Something you ask to find out more.'),

  ('turn', 'turn', 'ur', array['t','ur','n']::text[], 'floor_core', 24, 'Easier', 'Short common ur word.', 'It is your turn to read.', 'A chance to do something.'),
  ('burn', 'burn', 'ur', array['b','ur','n']::text[], 'floor_core', 26, 'Easier', 'Short common ur word.', 'The candle can burn for an hour.', 'To be damaged or changed by fire or heat.'),
  ('church', 'church', 'ur', array['ch','ur','ch']::text[], 'diagnostic', 46, 'Core', 'Common ur word with ch at both ends.', 'The church bell rang at noon.', 'A building used for Christian worship.'),
  ('nurse', 'nurse', 'ur', array['n','ur','s','e']::text[], 'diagnostic', 38, 'Core', 'Common ur word with final e.', 'The nurse checked the bandage.', 'A person trained to care for people who are ill or hurt.'),
  ('hurt', 'hurt', 'ur', array['h','ur','t']::text[], 'floor_core', 28, 'Easier', 'Short common ur word.', 'My knee did not hurt for long.', 'To feel pain or cause pain.'),
  ('burst', 'burst', 'ur', array['b','ur','s','t']::text[], 'diagnostic', 42, 'Core', 'Common ur word with a final consonant cluster.', 'The balloon burst with a pop.', 'To break open suddenly.'),

  ('field', 'field', 'ie', array['f','ie','l','d']::text[], 'diagnostic', 44, 'Core', 'Common ie word.', 'The field was ready for sports day.', 'An open area of land.'),
  ('chief', 'chief', 'ie', array['ch','ie','f']::text[], 'diagnostic', 46, 'Core', 'Common ie word with ch.', 'The chief helper gave instructions.', 'The main or leading person.'),
  ('shield', 'shield', 'ie', array['sh','ie','l','d']::text[], 'ceiling_challenge', 58, 'Core', 'Longer ie word with sh.', 'The shield protected the knight.', 'A piece of armour used for protection.'),
  ('brief', 'brief', 'ie', array['b','r','ie','f']::text[], 'diagnostic', 48, 'Core', 'Common ie word with an initial blend.', 'The teacher gave a brief note.', 'Short in time or length.'),
  ('thief', 'thief', 'ie', array['th','ie','f']::text[], 'diagnostic', 50, 'Core', 'Common ie word with th.', 'The thief stole the silver cup in the story.', 'A person who steals.'),
  ('piece', 'piece', 'ie', array['p','ie','c','e']::text[], 'diagnostic', 48, 'Core', 'Common ie word with final e.', 'Take one piece of paper.', 'One part of something.'),

  ('special', 'special', 'ci', array['s','p','e','ci','a','l']::text[], 'ceiling_challenge', 58, 'Core', 'Common ci word with two syllables.', 'The class planned a special event.', 'Different from usual in a good way.'),
  ('social', 'social', 'ci', array['s','o','ci','a','l']::text[], 'ceiling_challenge', 60, 'Stretch', 'Common ci word with two syllables.', 'The club was a social group.', 'About meeting or being with other people.'),
  ('facial', 'facial', 'ci', array['f','a','ci','a','l']::text[], 'ceiling_challenge', 62, 'Stretch', 'Ci word linked to face.', 'Facial expressions can show feelings.', 'About the face.'),
  ('official', 'official', 'ci', array['o','ff','i','ci','a','l']::text[], 'ceiling_challenge', 72, 'Stretch', 'Longer ci word with doubled consonant.', 'The official result came after lunch.', 'Agreed or approved by someone in charge.'),
  ('ancient', 'ancient', 'ci', array['a','n','ci','e','n','t']::text[], 'ceiling_challenge', 70, 'Stretch', 'Longer ci word with several vowel letters.', 'The museum had ancient pots.', 'Very old.'),
  ('crucial', 'crucial', 'ci', array['c','r','u','ci','a','l']::text[], 'ceiling_challenge', 72, 'Stretch', 'Longer ci word with an initial blend.', 'It is crucial to read the question.', 'Extremely important.'),

  ('author', 'author', 'au', array['au','th','or']::text[], 'ceiling_challenge', 56, 'Core', 'Common au word with other multiletter graphemes.', 'The author visited our school.', 'A person who writes a book or story.'),
  ('launch', 'launch', 'au', array['l','au','n','ch']::text[], 'ceiling_challenge', 58, 'Core', 'Common au word with ch.', 'The team will launch the model rocket.', 'To send or start something.'),
  ('haunt', 'haunt', 'au', array['h','au','n','t']::text[], 'ceiling_challenge', 60, 'Stretch', 'Au word with a final consonant cluster.', 'Old stories can haunt a castle.', 'To appear often in a place or memory.'),
  ('fault', 'fault', 'au', array['f','au','l','t']::text[], 'ceiling_challenge', 58, 'Core', 'Common au word with a final consonant cluster.', 'The crack was not your fault.', 'The reason something went wrong.'),
  ('sauce', 'sauce', 'au', array['s','au','c','e']::text[], 'ceiling_challenge', 62, 'Stretch', 'Common au word with final e.', 'The sauce was warm and spicy.', 'A liquid added to food for flavour.'),
  ('laundry', 'laundry', 'au', array['l','au','n','d','r','y']::text[], 'ceiling_challenge', 68, 'Stretch', 'Longer au word with a consonant cluster.', 'The laundry dried in the sun.', 'Clothes and sheets that need washing or are newly washed.');

do $$
begin
  if (select count(*) from wordloom_core_proof_words) <> 150 then
    raise exception 'Wordloom core proof set must contain exactly 150 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_proof_words
    where normalised_word <> lower(btrim(word))
  ) then
    raise exception 'Wordloom core proof set contains a bad normalised_word value.';
  end if;

  if exists (
    select 1
    from wordloom_core_proof_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core proof set contains grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_proof_words
    where not (primary_focus_grapheme = any(grapheme_segments))
  ) then
    raise exception 'Wordloom core proof set contains a primary focus grapheme missing from grapheme_segments.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_proof_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core proof set contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from wordloom_core_proof_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_proof_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_primary_word_count
  ) then
    raise exception 'Wordloom core proof set target counts do not match the expected proof coverage.';
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
  'Wordloom core proof set v1 target'
from wordloom_core_proof_targets
on conflict (focus_grapheme) do update
set
  display_label = excluded.display_label,
  stage_band = excluded.stage_band,
  challenge_band = excluded.challenge_band,
  sort_order = excluded.sort_order,
  is_active = true,
  notes = excluded.notes;

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
  to_jsonb(array[primary_focus_grapheme]),
  primary_focus_grapheme,
  stage_band,
  difficulty_score,
  difficulty_label,
  difficulty_reason,
  sentence,
  meaning,
  'suitable',
  'approved',
  'wordloom_core',
  'wordloom_core_proof_v1',
  true
from wordloom_core_proof_words
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
  proof_words.primary_focus_grapheme,
  'primary',
  'wordloom_core_proof_v1',
  0,
  'Wordloom core proof set v1 primary target'
from wordloom_core_proof_words as proof_words
inner join public.wordloom_core_words as words
  on words.normalised_word = proof_words.normalised_word
 and words.source_version = 'wordloom_core_proof_v1'
 and words.is_active is true
inner join public.wordloom_core_focus_targets as targets
  on targets.focus_grapheme = proof_words.primary_focus_grapheme
on conflict (word_id, focus_target_id, target_role) do update
set
  focus_grapheme = excluded.focus_grapheme,
  pattern_type = excluded.pattern_type,
  difficulty_modifier = excluded.difficulty_modifier,
  notes = excluded.notes;

commit;
