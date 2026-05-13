begin;

create temporary table wordloom_core_phase_8b_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_8b_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_8b_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_8b_word_count
)
values
  ('ear', 'ear', 'diagnostic', 'secure_expected', 80, 22),
  ('oy', 'oy', 'floor_core', 'core_developing', 100, 28),
  ('oi', 'oi', 'floor_core', 'core_developing', 110, 30),
  ('dge', 'dge', 'ceiling_challenge', 'secure_expected', 190, 30),
  ('ie', 'ie', 'ceiling_challenge', 'early_stretch', 220, 28),
  ('ci', 'ci', 'ceiling_challenge', 'early_stretch', 230, 32),
  ('au', 'au', 'ceiling_challenge', 'secure_expected', 240, 24),
  ('ure', 'ure', 'ceiling_challenge', 'early_stretch', 280, 30),
  ('tch', 'tch', 'diagnostic', 'secure_expected', 300, 26);

create temporary table wordloom_core_phase_8b_words (
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

insert into wordloom_core_phase_8b_words (
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
  ('bearded', 'bearded', 'ear', array['b','ear','d','e','d']::text[], array['ear']::text[], 'diagnostic', 50, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The bearded actor bowed after the play.', 'Having hair on the chin and cheeks.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('clearance', 'clearance', 'ear', array['c','l','ear','a','n','c','e']::text[], array['ear']::text[], 'diagnostic', 54, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The low bridge had limited clearance.', 'Space allowed for something to pass through.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('earache', 'earache', 'ear', array['ear','a','c','h','e']::text[], array['ear']::text[], 'diagnostic', 46, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'Earache kept him awake at night.', 'Pain inside the ear.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('earbuds', 'earbuds', 'ear', array['ear','b','u','d','s']::text[], array['ear']::text[], 'diagnostic', 48, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'She put her earbuds in the case.', 'Small earphones worn inside the ears.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('earlobe', 'earlobe', 'ear', array['ear','l','o','b','e']::text[], array['ear']::text[], 'diagnostic', 48, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'An earring hung from the earlobe.', 'The soft lower part of the ear.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('early', 'early', 'ear', array['ear','l','y']::text[], array['ear']::text[], 'diagnostic', 42, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The early train arrived before sunrise.', 'Before the expected or usual time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('earn', 'earn', 'ear', array['ear','n']::text[], array['ear']::text[], 'diagnostic', 42, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'Luca helped to earn points for his team.', 'To get something through work or effort.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('earth', 'earth', 'ear', array['ear','t','h']::text[], array['ear']::text[], 'diagnostic', 46, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The seeds were covered with earth.', 'Soil, land, or our planet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('heard', 'heard', 'ear', array['h','ear','d']::text[], array['ear']::text[], 'diagnostic', 44, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'We heard thunder after lunch.', 'Past tense of hear.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('hearer', 'hearer', 'ear', array['h','ear','e','r']::text[], array['ear']::text[], 'diagnostic', 48, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'A good speaker thinks about each hearer.', 'A person who listens to something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('learn', 'learn', 'ear', array['l','ear','n']::text[], array['ear']::text[], 'diagnostic', 44, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'We learn new facts every day.', 'To gain knowledge or skill.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('learner', 'learner', 'ear', array['l','ear','n','e','r']::text[], array['ear']::text[], 'diagnostic', 48, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'Every learner needs time to practise.', 'A person who is learning.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('nearness', 'nearness', 'ear', array['n','ear','n','e','s','s']::text[], array['ear']::text[], 'diagnostic', 48, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The nearness of the station made travel easy.', 'The state of being close by.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('pearl', 'pearl', 'ear', array['p','ear','l']::text[], array['ear']::text[], 'diagnostic', 50, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'A pearl shone inside the shell.', 'A smooth round gem made inside a shell.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('rehearsal', 'rehearsal', 'ear', array['r','e','h','ear','s','a','l']::text[], array['ear']::text[], 'diagnostic', 54, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The rehearsal helped everyone feel ready.', 'A practice before a performance.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('rehearse', 'rehearse', 'ear', array['r','e','h','ear','s','e']::text[], array['ear']::text[], 'diagnostic', 52, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The choir met to rehearse after school.', 'To practise before a performance.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('research', 'research', 'ear', array['r','e','s','ear','c','h']::text[], array['ear']::text[], 'diagnostic', 54, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The project needed careful research.', 'Study done to discover facts.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('search', 'search', 'ear', array['s','ear','c','h']::text[], array['ear']::text[], 'diagnostic', 48, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The pupils began to search for clues.', 'To look carefully for something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('spearmint', 'spearmint', 'ear', array['s','p','ear','m','i','n','t']::text[], array['ear']::text[], 'diagnostic', 52, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The tea had a fresh spearmint smell.', 'A mint plant with a clean, sharp flavour.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('tearful', 'tearful', 'ear', array['t','ear','f','u','l']::text[], array['ear']::text[], 'diagnostic', 48, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The tearful child held a tissue.', 'Full of tears or close to crying.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('weary', 'weary', 'ear', array['w','ear','y']::text[], array['ear']::text[], 'diagnostic', 52, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The weary hikers rested by the gate.', 'Very tired after effort or worry.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('yearlong', 'yearlong', 'ear', array['y','ear','l','o','n','g']::text[], array['ear']::text[], 'diagnostic', 50, 'Core', 'Core ear word selected for Phase 8B structured coverage.', 'The class began a yearlong reading project.', 'Lasting for a whole year.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('annoyance', 'annoyance', 'oy', array['a','n','n','oy','a','n','c','e']::text[], array['oy']::text[], 'floor_core', 46, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The dripping tap became an annoyance.', 'Something that irritates or bothers someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('annoys', 'annoys', 'oy', array['a','n','n','oy','s']::text[], array['oy']::text[], 'floor_core', 40, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'A loud buzz annoys the reader.', 'Bothers or irritates.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('boycott', 'boycott', 'oy', array['b','oy','c','o','t','t']::text[], array['oy']::text[], 'floor_core', 52, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The group chose to boycott the unfair contest.', 'To refuse to use or join something as a protest.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('boyhood', 'boyhood', 'oy', array['b','oy','h','o','o','d']::text[], array['oy']::text[], 'floor_core', 44, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'Grandad told stories from his boyhood.', 'The time when a male person is a child.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('boyish', 'boyish', 'oy', array['b','oy','i','s','h']::text[], array['oy']::text[], 'floor_core', 42, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'He gave a boyish grin.', 'Like or typical of a boy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('deploy', 'deploy', 'oy', array['d','e','p','l','oy']::text[], array['oy']::text[], 'floor_core', 52, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The rescue team will deploy after sunrise.', 'To send people or equipment where needed.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('deployed', 'deployed', 'oy', array['d','e','p','l','oy','e','d']::text[], array['oy']::text[], 'floor_core', 54, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'Extra buses were deployed after the concert.', 'Sent out for a task.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('deployment', 'deployment', 'oy', array['d','e','p','l','oy','m','e','n','t']::text[], array['oy']::text[], 'floor_core', 56, 'Stretch', 'Stretch oy word selected for Phase 8B structured coverage.', 'The careful deployment of helpers saved time.', 'The act of sending resources into use.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('destroyed', 'destroyed', 'oy', array['d','e','s','t','r','oy','e','d']::text[], array['oy']::text[], 'floor_core', 48, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The old shed was destroyed by the storm.', 'Damaged so badly it could not be used.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('destroyer', 'destroyer', 'oy', array['d','e','s','t','r','oy','e','r']::text[], array['oy']::text[], 'floor_core', 56, 'Stretch', 'Stretch oy word selected for Phase 8B structured coverage.', 'The story described a space destroyer.', 'Something designed to destroy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('employee', 'employee', 'oy', array['e','m','p','l','oy','e','e']::text[], array['oy']::text[], 'floor_core', 50, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The employee opened the shop early.', 'A person who works for someone else.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('employer', 'employer', 'oy', array['e','m','p','l','oy','e','r']::text[], array['oy']::text[], 'floor_core', 50, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The employer thanked the weekend helpers.', 'A person or group that gives paid work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('employment', 'employment', 'oy', array['e','m','p','l','oy','m','e','n','t']::text[], array['oy']::text[], 'floor_core', 52, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The course helped people find employment.', 'Paid work or having a job.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('enjoyed', 'enjoyed', 'oy', array['e','n','j','oy','e','d']::text[], array['oy']::text[], 'floor_core', 40, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'We enjoyed the sunny walk.', 'Liked or had fun with something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('enjoys', 'enjoys', 'oy', array['e','n','j','oy','s']::text[], array['oy']::text[], 'floor_core', 38, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'Ari enjoys building models.', 'Likes doing something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('joyfulness', 'joyfulness', 'oy', array['j','oy','f','u','l','n','e','s','s']::text[], array['oy']::text[], 'floor_core', 50, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The choir sang with joyfulness.', 'A feeling of bright happiness.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('joyless', 'joyless', 'oy', array['j','oy','l','e','s','s']::text[], array['oy']::text[], 'floor_core', 46, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The empty hall felt joyless.', 'Without happiness or pleasure.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('overjoyed', 'overjoyed', 'oy', array['o','v','e','r','j','oy','e','d']::text[], array['oy']::text[], 'floor_core', 52, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'Nia was overjoyed by the surprise visit.', 'Extremely happy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('royalist', 'royalist', 'oy', array['r','oy','a','l','i','s','t']::text[], array['oy']::text[], 'floor_core', 54, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The historian wrote about a royalist family.', 'A person who supports a king or queen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('royally', 'royally', 'oy', array['r','oy','a','l','l','y']::text[], array['oy']::text[], 'floor_core', 48, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The guests were treated royally.', 'In a grand or generous way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('royalty', 'royalty', 'oy', array['r','oy','a','l','t','y']::text[], array['oy']::text[], 'floor_core', 50, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The castle display explained local royalty.', 'Kings, queens, or their families.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('schoolboy', 'schoolboy', 'oy', array['s','c','h','o','o','l','b','oy']::text[], array['oy']::text[], 'floor_core', 42, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The schoolboy waited by the gate.', 'A boy who goes to school.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('soybean', 'soybean', 'oy', array['s','oy','b','e','a','n']::text[], array['oy']::text[], 'floor_core', 46, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The farm grew soybean crops.', 'A bean used for food and oil.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('soybeans', 'soybeans', 'oy', array['s','oy','b','e','a','n','s']::text[], array['oy']::text[], 'floor_core', 46, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'Soybeans filled the storage sack.', 'Beans used for food and oil.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('toyed', 'toyed', 'oy', array['t','oy','e','d']::text[], array['oy']::text[], 'floor_core', 40, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'She toyed with the ribbon while thinking.', 'Played with something idly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('toying', 'toying', 'oy', array['t','oy','i','n','g']::text[], array['oy']::text[], 'floor_core', 42, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The kitten was toying with a ball of yarn.', 'Playing with something lightly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('toylike', 'toylike', 'oy', array['t','oy','l','i','k','e']::text[], array['oy']::text[], 'floor_core', 44, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The tiny car looked toylike beside the bus.', 'Small or simple like a toy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('voyager', 'voyager', 'oy', array['v','oy','a','g','e','r']::text[], array['oy']::text[], 'floor_core', 54, 'Core', 'Core oy word selected for Phase 8B structured coverage.', 'The voyager wrote notes about each island.', 'A person who travels a long way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('appoint', 'appoint', 'oi', array['a','p','p','oi','n','t']::text[], array['oi']::text[], 'floor_core', 50, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The club will appoint a new captain.', 'To choose someone for a job or role.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('appointment', 'appointment', 'oi', array['a','p','p','oi','n','t','m','e','n','t']::text[], array['oi']::text[], 'floor_core', 52, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The dentist appointment was at noon.', 'An arranged time to meet someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('boiler', 'boiler', 'oi', array['b','oi','l','e','r']::text[], array['oi']::text[], 'floor_core', 42, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The boiler warmed the school hall.', 'A machine that heats water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('boisterous', 'boisterous', 'oi', array['b','oi','s','t','e','r','o','u','s']::text[], array['oi']::text[], 'floor_core', 52, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The boisterous crowd cheered loudly.', 'Noisy, lively, and full of energy.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('broil', 'broil', 'oi', array['b','r','oi','l']::text[], array['oi']::text[], 'floor_core', 48, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The cook chose to broil the fish.', 'To cook with strong direct heat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('checkpoint', 'checkpoint', 'oi', array['c','h','e','c','k','p','oi','n','t']::text[], array['oi']::text[], 'floor_core', 48, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Cyclists stopped at the checkpoint.', 'A place where progress or safety is checked.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('coinage', 'coinage', 'oi', array['c','oi','n','a','g','e']::text[], array['oi']::text[], 'floor_core', 50, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The museum displayed old coinage.', 'Coins used as money in a place or time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('coincide', 'coincide', 'oi', array['c','oi','n','c','i','d','e']::text[], array['oi']::text[], 'floor_core', 56, 'Stretch', 'Stretch oi word selected for Phase 8B structured coverage.', 'The two club meetings coincide this week.', 'To happen at the same time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('disappoint', 'disappoint', 'oi', array['d','i','s','a','p','p','oi','n','t']::text[], array['oi']::text[], 'floor_core', 52, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Late rain did not disappoint the gardeners.', 'To make someone feel let down.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('disappointment', 'disappointment', 'oi', array['d','i','s','a','p','p','oi','n','t','m','e','n','t']::text[], array['oi']::text[], 'floor_core', 54, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The cancelled picnic caused disappointment.', 'Sadness when hopes are not met.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('embroider', 'embroider', 'oi', array['e','m','b','r','oi','d','e','r']::text[], array['oi']::text[], 'floor_core', 54, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Nana taught me to embroider a flower.', 'To decorate cloth with stitched designs.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('joiner', 'joiner', 'oi', array['j','oi','n','e','r']::text[], array['oi']::text[], 'floor_core', 46, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The joiner built a strong wooden shelf.', 'A craftsperson who makes things from wood.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('jointed', 'jointed', 'oi', array['j','oi','n','t','e','d']::text[], array['oi']::text[], 'floor_core', 44, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The jointed model could bend its arms.', 'Made with parts that can bend at joints.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('moisten', 'moisten', 'oi', array['m','oi','s','t','e','n']::text[], array['oi']::text[], 'floor_core', 46, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Moisten the cloth before wiping the table.', 'To make slightly wet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('oilcloth', 'oilcloth', 'oi', array['oi','l','c','l','o','t','h']::text[], array['oi']::text[], 'floor_core', 46, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Oilcloth covered the picnic table.', 'Waterproof cloth used as a covering.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('ointment', 'ointment', 'oi', array['oi','n','t','m','e','n','t']::text[], array['oi']::text[], 'floor_core', 48, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The nurse put ointment on the scrape.', 'A soft medicine rubbed on skin.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('parboil', 'parboil', 'oi', array['p','a','r','b','oi','l']::text[], array['oi']::text[], 'floor_core', 50, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The cook decided to parboil the potatoes.', 'To partly cook food in boiling water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('pinpoint', 'pinpoint', 'oi', array['p','i','n','p','oi','n','t']::text[], array['oi']::text[], 'floor_core', 50, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The map helped pinpoint the village.', 'To find or show the exact place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('pointing', 'pointing', 'oi', array['p','oi','n','t','i','n','g']::text[], array['oi']::text[], 'floor_core', 44, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Pointing at the map helped us find the town.', 'Showing a direction with a finger or mark.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('poison', 'poison', 'oi', array['p','oi','s','o','n']::text[], array['oi']::text[], 'floor_core', 48, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The label warned that the liquid was poison.', 'Something harmful if eaten, drunk, or touched.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('poisonous', 'poisonous', 'oi', array['p','oi','s','o','n','o','u','s']::text[], array['oi']::text[], 'floor_core', 52, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Some berries can be poisonous.', 'Able to harm by poison.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('rejoice', 'rejoice', 'oi', array['r','e','j','oi','c','e']::text[], array['oi']::text[], 'floor_core', 50, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The fans began to rejoice after the goal.', 'To feel or show great happiness.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('spoiler', 'spoiler', 'oi', array['s','p','oi','l','e','r']::text[], array['oi']::text[], 'floor_core', 48, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The review avoided giving away a spoiler.', 'Information that reveals a surprise in a story.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('subsoil', 'subsoil', 'oi', array['s','u','b','s','oi','l']::text[], array['oi']::text[], 'floor_core', 44, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Roots reached deep into the subsoil.', 'The layer of earth below the topsoil.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('toil', 'toil', 'oi', array['t','oi','l']::text[], array['oi']::text[], 'floor_core', 44, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The farmers had to toil in the sun.', 'To work very hard.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('toilet', 'toilet', 'oi', array['t','oi','l','e','t']::text[], array['oi']::text[], 'floor_core', 38, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The toilet block was beside the playground.', 'A bathroom fixture used for waste.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('topsoil', 'topsoil', 'oi', array['t','o','p','s','oi','l']::text[], array['oi']::text[], 'floor_core', 42, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Rain washed some topsoil down the hill.', 'The upper layer of soil.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('turmoil', 'turmoil', 'oi', array['t','u','r','m','oi','l']::text[], array['oi']::text[], 'floor_core', 54, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'The lost keys caused turmoil backstage.', 'A state of confusion or upset.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('viewpoint', 'viewpoint', 'oi', array['v','i','e','w','p','oi','n','t']::text[], array['oi']::text[], 'floor_core', 50, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Each pupil shared a different viewpoint.', 'A way of thinking about something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('voicemail', 'voicemail', 'oi', array['v','oi','c','e','m','a','i','l']::text[], array['oi']::text[], 'floor_core', 48, 'Core', 'Core oi word selected for Phase 8B structured coverage.', 'Mum left a voicemail after school.', 'A recorded phone message.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('abridge', 'abridge', 'dge', array['a','b','r','i','dge']::text[], array['dge']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch dge word selected for Phase 8B structured coverage.', 'The editor had to abridge the long speech.', 'To shorten a piece of writing or speaking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('acknowledge', 'acknowledge', 'dge', array['a','c','k','n','o','w','l','e','dge']::text[], array['dge']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch dge word selected for Phase 8B structured coverage.', 'The school will acknowledge every helper.', 'To accept or show that something is true.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('badgeholder', 'badgeholder', 'dge', array['b','a','dge','h','o','l','d','e','r']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The visitor clipped on a badgeholder.', 'A case used to display an identity badge.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('badger', 'badger', 'dge', array['b','a','dge','r']::text[], array['dge']::text[], 'ceiling_challenge', 50, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'A badger crossed the path at dusk.', 'A striped wild mammal that lives in a burrow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('bridged', 'bridged', 'dge', array['b','r','i','dge','d']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'A wooden plank bridged the narrow stream.', 'Joined or crossed a gap.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('cartridge', 'cartridge', 'dge', array['c','a','r','t','r','i','dge']::text[], array['dge']::text[], 'ceiling_challenge', 54, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The printer needed a new cartridge.', 'A small container that fits inside a machine.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('dodgeball', 'dodgeball', 'dge', array['d','o','dge','b','a','l','l']::text[], array['dge']::text[], 'ceiling_challenge', 50, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'Dodgeball was the favourite playground game.', 'A game where players avoid thrown balls.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('dodger', 'dodger', 'dge', array['d','o','dge','r']::text[], array['dge']::text[], 'ceiling_challenge', 50, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The quick dodger skipped past the marker.', 'Someone who moves aside to avoid something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('dredge', 'dredge', 'dge', array['d','r','e','dge']::text[], array['dge']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch dge word selected for Phase 8B structured coverage.', 'Workers used a machine to dredge the canal.', 'To clear mud from under water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('edgeless', 'edgeless', 'dge', array['e','dge','l','e','s','s']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The smooth screen looked edgeless.', 'Having no clear edge or border.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('edgewise', 'edgewise', 'dge', array['e','dge','w','i','s','e']::text[], array['dge']::text[], 'ceiling_challenge', 54, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The card slid edgewise into the narrow slot.', 'With the thin side facing forward.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('fledge', 'fledge', 'dge', array['f','l','e','dge']::text[], array['dge']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch dge word selected for Phase 8B structured coverage.', 'The young bird was ready to fledge.', 'To grow feathers and become ready to fly.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('footbridge', 'footbridge', 'dge', array['f','o','o','t','b','r','i','dge']::text[], array['dge']::text[], 'ceiling_challenge', 50, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The footbridge led safely over the railway.', 'A bridge for people walking.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('fudgemaker', 'fudgemaker', 'dge', array['f','u','dge','m','a','k','e','r']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The fudgemaker stirred the pan carefully.', 'A person who makes soft sweets from sugar and butter.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('grudge', 'grudge', 'dge', array['g','r','u','dge']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'Rina let go of her grudge after the game.', 'A lasting angry feeling about something unfair.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('hedgehog', 'hedgehog', 'dge', array['h','e','dge','h','o','g']::text[], array['dge']::text[], 'ceiling_challenge', 50, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'A hedgehog curled up under the leaves.', 'A small spiky animal.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('hedger', 'hedger', 'dge', array['h','e','dge','r']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The hedger trimmed the lane neatly.', 'A worker who cuts or looks after hedges.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('hedgerow', 'hedgerow', 'dge', array['h','e','dge','r','o','w']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'Birds nested safely in the hedgerow.', 'A long line of bushes between fields.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('judgement', 'judgement', 'dge', array['j','u','dge','m','e','n','t']::text[], array['dge']::text[], 'ceiling_challenge', 54, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'Good judgement helped her choose safely.', 'The ability to make sensible decisions.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('knowledge', 'knowledge', 'dge', array['k','n','o','w','l','e','dge']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'Reading builds knowledge every week.', 'Information and understanding.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('knowledgeable', 'knowledgeable', 'dge', array['k','n','o','w','l','e','dge','a','b','l','e']::text[], array['dge']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch dge word selected for Phase 8B structured coverage.', 'The guide was knowledgeable about fossils.', 'Knowing a lot about a subject.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('ledger', 'ledger', 'dge', array['l','e','dge','r']::text[], array['dge']::text[], 'ceiling_challenge', 54, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The treasurer wrote each payment in the ledger.', 'A book or record used for accounts.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('midge', 'midge', 'dge', array['m','i','dge']::text[], array['dge']::text[], 'ceiling_challenge', 50, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'A tiny midge landed on the window.', 'A very small flying insect.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('partridge', 'partridge', 'dge', array['p','a','r','t','r','i','dge']::text[], array['dge']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch dge word selected for Phase 8B structured coverage.', 'A partridge ran across the field.', 'A round wild bird often found on farmland.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('pledge', 'pledge', 'dge', array['p','l','e','dge']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The team made a pledge to play fairly.', 'A serious promise.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('sledgehammer', 'sledgehammer', 'dge', array['s','l','e','dge','h','a','m','m','e','r']::text[], array['dge']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch dge word selected for Phase 8B structured coverage.', 'The builder lifted a heavy sledgehammer.', 'A large hammer used for strong blows.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('smidge', 'smidge', 'dge', array['s','m','i','dge']::text[], array['dge']::text[], 'ceiling_challenge', 50, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'Add a smidge of salt to the dough.', 'A very small amount.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('trudge', 'trudge', 'dge', array['t','r','u','dge']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The hikers had to trudge through wet grass.', 'To walk slowly with effort.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('unabridged', 'unabridged', 'dge', array['u','n','a','b','r','i','dge','d']::text[], array['dge']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch dge word selected for Phase 8B structured coverage.', 'The library kept an unabridged dictionary.', 'Not shortened.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('widget', 'widget', 'dge', array['w','i','dge','t']::text[], array['dge']::text[], 'ceiling_challenge', 52, 'Core', 'Core dge word selected for Phase 8B structured coverage.', 'The app showed a weather widget.', 'A small tool or device with a simple job.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('achievement', 'achievement', 'ie', array['a','c','h','ie','v','e','m','e','n','t']::text[], array['ie']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ie word selected for Phase 8B structured coverage.', 'Finishing the project was a real achievement.', 'Something successful that took effort.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('alien', 'alien', 'ie', array['a','l','ie','n']::text[], array['ie']::text[], 'ceiling_challenge', 48, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The film showed a friendly alien.', 'A being from another planet.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('briefcase', 'briefcase', 'ie', array['b','r','ie','f','c','a','s','e']::text[], array['ie']::text[], 'ceiling_challenge', 48, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'Dad packed the papers in a briefcase.', 'A flat case used for carrying documents.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('briefing', 'briefing', 'ie', array['b','r','ie','f','i','n','g']::text[], array['ie']::text[], 'ceiling_challenge', 50, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The team listened to a safety briefing.', 'A short meeting that gives important information.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('brownie', 'brownie', 'ie', array['b','r','o','w','n','ie']::text[], array['ie']::text[], 'ceiling_challenge', 42, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The brownie was warm from the oven.', 'A small square chocolate cake.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('chieftain', 'chieftain', 'ie', array['c','h','ie','f','t','a','i','n']::text[], array['ie']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ie word selected for Phase 8B structured coverage.', 'The old tale described a brave chieftain.', 'The leader of a clan or group.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('collie', 'collie', 'ie', array['c','o','l','l','ie']::text[], array['ie']::text[], 'ceiling_challenge', 46, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The collie ran beside the shepherd.', 'A sheepdog with a long coat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('cookie', 'cookie', 'ie', array['c','o','o','k','ie']::text[], array['ie']::text[], 'ceiling_challenge', 38, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'A cookie crumbled on the plate.', 'A small sweet biscuit.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('diesel', 'diesel', 'ie', array['d','ie','s','e','l']::text[], array['ie']::text[], 'ceiling_challenge', 52, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The bus used diesel fuel.', 'A type of fuel used in some engines.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('fielder', 'fielder', 'ie', array['f','ie','l','d','e','r']::text[], array['ie']::text[], 'ceiling_challenge', 48, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The fielder caught the ball near the rope.', 'A player who stops or catches the ball in the field.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('fieldwork', 'fieldwork', 'ie', array['f','ie','l','d','w','o','r','k']::text[], array['ie']::text[], 'ceiling_challenge', 50, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The science group did fieldwork near the river.', 'Study or research done outside the classroom.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('fierce', 'fierce', 'ie', array['f','ie','r','c','e']::text[], array['ie']::text[], 'ceiling_challenge', 50, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'A fierce wind shook the trees.', 'Strong, wild, or intense.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('grief', 'grief', 'ie', array['g','r','ie','f']::text[], array['ie']::text[], 'ceiling_challenge', 52, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The story showed grief after a loss.', 'Deep sadness.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('hoodie', 'hoodie', 'ie', array['h','o','o','d','ie']::text[], array['ie']::text[], 'ceiling_challenge', 42, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'He zipped up his blue hoodie.', 'A sweatshirt with a hood.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('lie', 'lie', 'ie', array['l','ie']::text[], array['ie']::text[], 'ceiling_challenge', 40, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'It is better to tell the truth than lie.', 'To say something that is not true.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('magpie', 'magpie', 'ie', array['m','a','g','p','ie']::text[], array['ie']::text[], 'ceiling_challenge', 48, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'A magpie picked up a shiny wrapper.', 'A black-and-white bird.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('mischief', 'mischief', 'ie', array['m','i','s','c','h','ie','f']::text[], array['ie']::text[], 'ceiling_challenge', 54, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The puppy caused mischief in the kitchen.', 'Playful trouble or naughty behaviour.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('movie', 'movie', 'ie', array['m','o','v','ie']::text[], array['ie']::text[], 'ceiling_challenge', 40, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The class watched a short movie.', 'A moving story or film shown on a screen.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('piecemeal', 'piecemeal', 'ie', array['p','ie','c','e','m','e','a','l']::text[], array['ie']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ie word selected for Phase 8B structured coverage.', 'The model was repaired in a piecemeal way.', 'Done in small separate parts.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('pierce', 'pierce', 'ie', array['p','ie','r','c','e']::text[], array['ie']::text[], 'ceiling_challenge', 52, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The pin could pierce the thin card.', 'To make a hole through something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('prairie', 'prairie', 'ie', array['p','r','a','i','r','ie']::text[], array['ie']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ie word selected for Phase 8B structured coverage.', 'Tall grasses covered the prairie.', 'A wide area of flat grassland.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('relieve', 'relieve', 'ie', array['r','e','l','ie','v','e']::text[], array['ie']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ie word selected for Phase 8B structured coverage.', 'The medicine helped relieve the pain.', 'To make something less painful or worrying.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('retrieve', 'retrieve', 'ie', array['r','e','t','r','ie','v','e']::text[], array['ie']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ie word selected for Phase 8B structured coverage.', 'The dog ran to retrieve the ball.', 'To bring something back.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('rookie', 'rookie', 'ie', array['r','o','o','k','ie']::text[], array['ie']::text[], 'ceiling_challenge', 50, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The rookie player listened to the coach.', 'A person who is new at an activity.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('shielding', 'shielding', 'ie', array['s','h','ie','l','d','i','n','g']::text[], array['ie']::text[], 'ceiling_challenge', 52, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The shielding kept the cables safe.', 'Material or action that protects something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('siege', 'siege', 'ie', array['s','ie','g','e']::text[], array['ie']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ie word selected for Phase 8B structured coverage.', 'The history book described a long siege.', 'An attempt to surround and capture a place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('smoothie', 'smoothie', 'ie', array['s','m','o','o','t','h','ie']::text[], array['ie']::text[], 'ceiling_challenge', 46, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'The cafe sold a banana smoothie.', 'A thick drink made with blended fruit.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('untie', 'untie', 'ie', array['u','n','t','ie']::text[], array['ie']::text[], 'ceiling_challenge', 42, 'Core', 'Core ie word selected for Phase 8B structured coverage.', 'Please untie the knot in the ribbon.', 'To open or loosen something tied.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('accident', 'accident', 'ci', array['a','c','ci','d','e','n','t']::text[], array['ci']::text[], 'ceiling_challenge', 44, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The broken vase was an accident.', 'Something unplanned that happens by mistake.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('accidental', 'accidental', 'ci', array['a','c','ci','d','e','n','t','a','l']::text[], array['ci']::text[], 'ceiling_challenge', 50, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The mark on the paper was accidental.', 'Happening by chance rather than on purpose.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('acid', 'acid', 'ci', array['a','ci','d']::text[], array['ci']::text[], 'ceiling_challenge', 42, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The acid test showed which liquid was strongest.', 'A sharp or sour substance used in science.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('artificial', 'artificial', 'ci', array['a','r','t','i','f','i','ci','a','l']::text[], array['ci']::text[], 'ceiling_challenge', 64, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The stage used artificial snow.', 'Made by people rather than found in nature.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('beneficial', 'beneficial', 'ci', array['b','e','n','e','f','i','ci','a','l']::text[], array['ci']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'Regular reading is beneficial for learning.', 'Helpful or producing a good effect.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('capacity', 'capacity', 'ci', array['c','a','p','a','ci','t','y']::text[], array['ci']::text[], 'ceiling_challenge', 54, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The hall reached its full capacity.', 'The amount that something can hold.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('cicada', 'cicada', 'ci', array['ci','c','a','d','a']::text[], array['ci']::text[], 'ceiling_challenge', 50, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'A cicada buzzed loudly in the summer tree.', 'An insect known for a loud summer call.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('cinder', 'cinder', 'ci', array['ci','n','d','e','r']::text[], array['ci']::text[], 'ceiling_challenge', 46, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'A cinder cooled beside the campfire.', 'A small piece left after something burns.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('circuit', 'circuit', 'ci', array['ci','r','c','u','i','t']::text[], array['ci']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The lamp worked when the circuit was complete.', 'A closed path that electricity can follow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('circus', 'circus', 'ci', array['ci','r','c','u','s']::text[], array['ci']::text[], 'ceiling_challenge', 48, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The circus tent filled with music and lights.', 'A show with skilled performers and acts.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('citation', 'citation', 'ci', array['ci','t','a','t','i','o','n']::text[], array['ci']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The report included a citation for the book.', 'A note that names the source of information.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('cite', 'cite', 'ci', array['ci','t','e']::text[], array['ci']::text[], 'ceiling_challenge', 52, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The writer had to cite evidence from the article.', 'To mention a source as proof or support.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('civic', 'civic', 'ci', array['ci','v','i','c']::text[], array['ci']::text[], 'ceiling_challenge', 54, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The pupils joined a civic clean-up day.', 'Connected with a town or its people.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('civilian', 'civilian', 'ci', array['ci','v','i','l','i','a','n']::text[], array['ci']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The civilian helper guided visitors at the fair.', 'A person who is not serving in the armed forces.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('commercial', 'commercial', 'ci', array['c','o','m','m','e','r','ci','a','l']::text[], array['ci']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The commercial kitchen served hundreds of lunches.', 'Connected with buying, selling, or business.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('delicious', 'delicious', 'ci', array['d','e','l','i','ci','o','u','s']::text[], array['ci']::text[], 'ceiling_challenge', 54, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The soup smelled delicious after cooking.', 'Having a very pleasant taste.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('discipline', 'discipline', 'ci', array['d','i','s','ci','p','l','i','n','e']::text[], array['ci']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'Practice and discipline helped the choir improve.', 'Training yourself to follow rules or keep trying.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('efficient', 'efficient', 'ci', array['e','f','f','i','ci','e','n','t']::text[], array['ci']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The new route was efficient and quick.', 'Working well without wasting time or effort.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('electrician', 'electrician', 'ci', array['e','l','e','c','t','r','i','ci','a','n']::text[], array['ci']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The electrician repaired the classroom light.', 'A person whose job is working with electrical systems.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('electricity', 'electricity', 'ci', array['e','l','e','c','t','r','i','ci','t','y']::text[], array['ci']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The storm cut off the electricity.', 'Power used to make lights and machines work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('financial', 'financial', 'ci', array['f','i','n','a','n','ci','a','l']::text[], array['ci']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The club made a financial plan for the fair.', 'Connected with money.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('gracious', 'gracious', 'ci', array['g','r','a','ci','o','u','s']::text[], array['ci']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The winner was gracious to every player.', 'Kind, polite, and thoughtful.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('icicle', 'icicle', 'ci', array['i','ci','c','l','e']::text[], array['ci']::text[], 'ceiling_challenge', 48, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'An icicle hung from the roof edge.', 'A hanging spike of frozen water.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('medicine', 'medicine', 'ci', array['m','e','d','i','ci','n','e']::text[], array['ci']::text[], 'ceiling_challenge', 50, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The nurse gave medicine after lunch.', 'Something used to help a person get well.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('optician', 'optician', 'ci', array['o','p','t','i','ci','a','n']::text[], array['ci']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The optician checked Kai''s new glasses.', 'A person trained to test eyes or fit glasses.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('precious', 'precious', 'ci', array['p','r','e','ci','o','u','s']::text[], array['ci']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The family kept precious photos in a box.', 'Greatly loved or valuable.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('racing', 'racing', 'ci', array['r','a','ci','n','g']::text[], array['ci']::text[], 'ceiling_challenge', 46, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The racing cars sped around the track.', 'Moving or competing very fast.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('recite', 'recite', 'ci', array['r','e','ci','t','e']::text[], array['ci']::text[], 'ceiling_challenge', 52, 'Core', 'Core ci word selected for Phase 8B structured coverage.', 'The pupil could recite the poem aloud.', 'To say something from memory.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('society', 'society', 'ci', array['s','o','ci','e','t','y']::text[], array['ci']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'Every society has rules and traditions.', 'A community of people living together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('species', 'species', 'ci', array['s','p','e','ci','e','s']::text[], array['ci']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The pond survey found a rare species.', 'A group of living things of the same kind.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('specific', 'specific', 'ci', array['s','p','e','ci','f','i','c']::text[], array['ci']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The teacher asked for a specific example.', 'Clearly named or exact.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('technician', 'technician', 'ci', array['t','e','c','h','n','i','ci','a','n']::text[], array['ci']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ci word selected for Phase 8B structured coverage.', 'The technician fixed the projector before assembly.', 'A person skilled in practical or technical work.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('auction', 'auction', 'au', array['au','c','t','i','o','n']::text[], array['au']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch au word selected for Phase 8B structured coverage.', 'The school auction raised money for books.', 'A sale where people bid for items.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('audible', 'audible', 'au', array['au','d','i','b','l','e']::text[], array['au']::text[], 'ceiling_challenge', 54, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The bell was audible from the playground.', 'Loud enough to be heard.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('aunt', 'aunt', 'au', array['au','n','t']::text[], array['au']::text[], 'ceiling_challenge', 44, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'My aunt baked bread for the picnic.', 'The sister of a parent.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('authentic', 'authentic', 'au', array['au','t','h','e','n','t','i','c']::text[], array['au']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch au word selected for Phase 8B structured coverage.', 'The museum showed an authentic Roman coin.', 'Real and not copied.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('authority', 'authority', 'au', array['au','t','h','o','r','i','t','y']::text[], array['au']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch au word selected for Phase 8B structured coverage.', 'The ranger had authority in the park.', 'The power or right to make decisions.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('authorship', 'authorship', 'au', array['au','t','h','o','r','s','h','i','p']::text[], array['au']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch au word selected for Phase 8B structured coverage.', 'The class discussed the authorship of the poem.', 'The act or fact of writing a text.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('caught', 'caught', 'au', array['c','au','g','h','t']::text[], array['au']::text[], 'ceiling_challenge', 48, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The goalkeeper caught the ball.', 'Past tense of catch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('cauldron', 'cauldron', 'au', array['c','au','l','d','r','o','n']::text[], array['au']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch au word selected for Phase 8B structured coverage.', 'The play used a painted cauldron on stage.', 'A large round cooking pot.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('causeway', 'causeway', 'au', array['c','au','s','e','w','a','y']::text[], array['au']::text[], 'ceiling_challenge', 54, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The causeway crossed the wet marsh.', 'A raised road over water or low ground.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('cautious', 'cautious', 'au', array['c','au','t','i','o','u','s']::text[], array['au']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch au word selected for Phase 8B structured coverage.', 'The cautious cat stepped around the puddle.', 'Careful to avoid risk.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('daughter', 'daughter', 'au', array['d','au','g','h','t','e','r']::text[], array['au']::text[], 'ceiling_challenge', 48, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'Her daughter drew a picture of the garden.', 'A female child of a parent.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('faultless', 'faultless', 'au', array['f','au','l','t','l','e','s','s']::text[], array['au']::text[], 'ceiling_challenge', 52, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The gymnast gave a faultless routine.', 'Having no mistakes.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('haunted', 'haunted', 'au', array['h','au','n','t','e','d']::text[], array['au']::text[], 'ceiling_challenge', 54, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The fair had a haunted house.', 'Visited by ghosts in stories.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('haunting', 'haunting', 'au', array['h','au','n','t','i','n','g']::text[], array['au']::text[], 'ceiling_challenge', 54, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'A haunting tune echoed through the hall.', 'Beautiful, sad, or hard to forget.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('jaunty', 'jaunty', 'au', array['j','au','n','t','y']::text[], array['au']::text[], 'ceiling_challenge', 54, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The band played a jaunty tune.', 'Cheerful and lively.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('launcher', 'launcher', 'au', array['l','au','n','c','h','e','r']::text[], array['au']::text[], 'ceiling_challenge', 52, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The launcher held the model rocket steady.', 'A device that sends something into the air.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('launder', 'launder', 'au', array['l','au','n','d','e','r']::text[], array['au']::text[], 'ceiling_challenge', 54, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The hotel can launder muddy sports kits.', 'To wash clothes or cloth items.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('laurel', 'laurel', 'au', array['l','au','r','e','l']::text[], array['au']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch au word selected for Phase 8B structured coverage.', 'The athlete wore a laurel wreath.', 'A tree or a wreath used as a sign of honour.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('naughty', 'naughty', 'au', array['n','au','g','h','t','y']::text[], array['au']::text[], 'ceiling_challenge', 50, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The naughty puppy stole a sock.', 'Behaving badly in a playful way.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('restaurant', 'restaurant', 'au', array['r','e','s','t','au','r','a','n','t']::text[], array['au']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch au word selected for Phase 8B structured coverage.', 'The family ate at a small restaurant.', 'A place where meals are served to customers.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('sauceboat', 'sauceboat', 'au', array['s','au','c','e','b','o','a','t']::text[], array['au']::text[], 'ceiling_challenge', 54, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The sauceboat sat beside the roast dinner.', 'A small jug used for serving sauce.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('saucy', 'saucy', 'au', array['s','au','c','y']::text[], array['au']::text[], 'ceiling_challenge', 46, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The chef made a saucy pasta bake.', 'Covered in sauce or cheekily bold.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('taught', 'taught', 'au', array['t','au','g','h','t']::text[], array['au']::text[], 'ceiling_challenge', 48, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'Mr Patel taught the class a new song.', 'Past tense of teach.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('vault', 'vault', 'au', array['v','au','l','t']::text[], array['au']::text[], 'ceiling_challenge', 52, 'Core', 'Core au word selected for Phase 8B structured coverage.', 'The bank kept records in a vault.', 'A secure room or a jump over something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('allure', 'allure', 'ure', array['a','l','l','ure']::text[], array['ure']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The bright display had a strong allure.', 'A quality that makes something attractive.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('assure', 'assure', 'ure', array['a','s','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 54, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'The coach tried to assure the nervous team.', 'To tell someone something with confidence.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('brochure', 'brochure', 'ure', array['b','r','o','c','h','ure']::text[], array['ure']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The museum gave us a brochure at the door.', 'A small booklet with information.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('capture', 'capture', 'ure', array['c','a','p','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 52, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'The camera can capture tiny details.', 'To catch or record something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('closure', 'closure', 'ure', array['c','l','o','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The road closure changed the bus route.', 'The act of closing something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('creature', 'creature', 'ure', array['c','r','e','a','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 50, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'A tiny creature moved under the leaf.', 'A living animal or being.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('departure', 'departure', 'ure', array['d','e','p','a','r','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The train departure was delayed by rain.', 'The act of leaving a place.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('enclosure', 'enclosure', 'ure', array['e','n','c','l','o','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 64, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The rabbits stayed inside the safe enclosure.', 'An area with a fence or boundary around it.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('endure', 'endure', 'ure', array['e','n','d','ure']::text[], array['ure']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The climbers had to endure cold wind.', 'To keep going through something difficult.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('ensure', 'ensure', 'ure', array['e','n','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 54, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'A checklist can ensure nothing is missed.', 'To make certain that something happens.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('exposure', 'exposure', 'ure', array['e','x','p','o','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The seedlings needed exposure to sunlight.', 'Being open to something around you.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('failure', 'failure', 'ure', array['f','a','i','l','ure']::text[], array['ure']::text[], 'ceiling_challenge', 52, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'The bridge design avoided failure under weight.', 'A lack of success or a breakdown.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('fixture', 'fixture', 'ure', array['f','i','x','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 54, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'The next football fixture was on Friday.', 'A fixed item or a planned sports match.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('fracture', 'fracture', 'ure', array['f','r','a','c','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The doctor checked the bone for a fracture.', 'A crack or break in something hard.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('immature', 'immature', 'ure', array['i','m','m','a','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The immature plant needed more time to grow.', 'Not fully grown or developed.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('injure', 'injure', 'ure', array['i','n','j','ure']::text[], array['ure']::text[], 'ceiling_challenge', 54, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'Pads help stop players from being injured during sport.', 'To hurt a person or part of the body.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('leisure', 'leisure', 'ure', array['l','e','i','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'She read comics during her leisure time.', 'Free time for rest or enjoyment.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('literature', 'literature', 'ure', array['l','i','t','e','r','a','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 66, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The class studied literature from many places.', 'Stories, poems, and other written works.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('manicure', 'manicure', 'ure', array['m','a','n','i','c','ure']::text[], array['ure']::text[], 'ceiling_challenge', 58, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'A careful manicure made the nails neat.', 'A treatment that cleans and shapes nails.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('manufacture', 'manufacture', 'ure', array['m','a','n','u','f','a','c','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 68, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The factory can manufacture bicycle parts.', 'To make goods in large amounts.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('mature', 'mature', 'ure', array['m','a','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 54, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'A mature apple tree gives plenty of fruit.', 'Fully grown or sensible.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('nurture', 'nurture', 'ure', array['n','u','r','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'Gardeners nurture seedlings with water and care.', 'To care for and help something grow.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('overture', 'overture', 'ure', array['o','v','e','r','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 64, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The orchestra played an overture before the show.', 'An opening piece of music.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('pleasure', 'pleasure', 'ure', array['p','l','e','a','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 52, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'It was a pleasure to meet the new teacher.', 'A feeling of happiness or enjoyment.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('pressure', 'pressure', 'ure', array['p','r','e','s','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 54, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'The tyre lost pressure overnight.', 'Force pushing on something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('procedure', 'procedure', 'ure', array['p','r','o','c','e','d','ure']::text[], array['ure']::text[], 'ceiling_challenge', 62, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The lab followed a careful procedure.', 'A set of steps for doing something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('puncture', 'puncture', 'ure', array['p','u','n','c','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'A thorn made a puncture in the tyre.', 'A small hole made by something sharp.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('rupture', 'rupture', 'ure', array['r','u','p','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 60, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'Engineers checked the pipe for a rupture.', 'A split or break in something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('unsure', 'unsure', 'ure', array['u','n','s','ure']::text[], array['ure']::text[], 'ceiling_challenge', 48, 'Core', 'Core ure word selected for Phase 8B structured coverage.', 'Maya was unsure which path to take.', 'Not certain about something.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('venture', 'venture', 'ure', array['v','e','n','t','ure']::text[], array['ure']::text[], 'ceiling_challenge', 56, 'Stretch', 'Stretch ure word selected for Phase 8B structured coverage.', 'The walkers planned to venture beyond the gate.', 'To go somewhere that may be difficult or new.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('butcher', 'butcher', 'tch', array['b','u','tch','e','r']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The butcher prepared meat for the shop.', 'A person who cuts and sells meat.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('catcher', 'catcher', 'tch', array['c','a','tch','e','r']::text[], array['tch']::text[], 'diagnostic', 44, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The catcher wore a padded glove.', 'A player who catches the ball.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('catchphrase', 'catchphrase', 'tch', array['c','a','tch','p','h','r','a','s','e']::text[], array['tch']::text[], 'diagnostic', 52, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The presenter used a funny catchphrase.', 'A phrase often repeated by someone.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('ditchwater', 'ditchwater', 'tch', array['d','i','tch','w','a','t','e','r']::text[], array['tch']::text[], 'diagnostic', 54, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'Rain filled the ditchwater by the lane.', 'Water collected in a ditch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('hatchback', 'hatchback', 'tch', array['h','a','tch','b','a','c','k']::text[], array['tch']::text[], 'diagnostic', 52, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The hatchback parked near the school.', 'A car with a rear door that opens upward.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('itchy', 'itchy', 'tch', array['i','tch','y']::text[], array['tch']::text[], 'diagnostic', 40, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The wool scarf felt itchy.', 'Making you want to scratch.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('ketchup', 'ketchup', 'tch', array['k','e','tch','u','p']::text[], array['tch']::text[], 'diagnostic', 42, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'Ketchup dripped onto the plate.', 'A thick tomato sauce.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('matchmaker', 'matchmaker', 'tch', array['m','a','tch','m','a','k','e','r']::text[], array['tch']::text[], 'diagnostic', 54, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The story had a cheerful matchmaker.', 'Someone who helps people or teams fit together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('matchstick', 'matchstick', 'tch', array['m','a','tch','s','t','i','c','k']::text[], array['tch']::text[], 'diagnostic', 48, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'A matchstick snapped in half.', 'A small stick used to make a flame.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('patchwork', 'patchwork', 'tch', array['p','a','tch','w','o','r','k']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The blanket had a patchwork design.', 'Made from many small pieces joined together.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('patchy', 'patchy', 'tch', array['p','a','tch','y']::text[], array['tch']::text[], 'diagnostic', 46, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'Patchy fog covered the road.', 'Uneven or appearing in separate places.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('pitcher', 'pitcher', 'tch', array['p','i','tch','e','r']::text[], array['tch']::text[], 'diagnostic', 46, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The pitcher poured water into each cup.', 'A jug, or a player who throws the ball.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('pitchfork', 'pitchfork', 'tch', array['p','i','tch','f','o','r','k']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The farmer leaned a pitchfork by the barn.', 'A tool with long prongs for lifting hay.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('pitching', 'pitching', 'tch', array['p','i','tch','i','n','g']::text[], array['tch']::text[], 'diagnostic', 48, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The team practised pitching before the match.', 'Throwing a ball in a game.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('scratchy', 'scratchy', 'tch', array['s','c','r','a','tch','y']::text[], array['tch']::text[], 'diagnostic', 48, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The old record sounded scratchy.', 'Rough, harsh, or full of scratches.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('sketching', 'sketching', 'tch', array['s','k','e','tch','i','n','g']::text[], array['tch']::text[], 'diagnostic', 48, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The artist was sketching by the river.', 'Drawing quickly with simple lines.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('sketchpad', 'sketchpad', 'tch', array['s','k','e','tch','p','a','d']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'Her sketchpad was full of trees.', 'A pad of paper used for drawing.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('stitcher', 'stitcher', 'tch', array['s','t','i','tch','e','r']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The stitcher repaired the torn flag.', 'A person or tool that sews stitches.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('stitching', 'stitching', 'tch', array['s','t','i','tch','i','n','g']::text[], array['tch']::text[], 'diagnostic', 48, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The stitching kept the pocket strong.', 'Thread sewn into cloth.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('stopwatch', 'stopwatch', 'tch', array['s','t','o','p','w','a','tch']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The coach clicked the stopwatch.', 'A clock used to measure short times.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('switchboard', 'switchboard', 'tch', array['s','w','i','tch','b','o','a','r','d']::text[], array['tch']::text[], 'diagnostic', 56, 'Stretch', 'Stretch tch word selected for Phase 8B structured coverage.', 'The museum displayed an old switchboard.', 'A board used to connect phone lines or controls.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('switching', 'switching', 'tch', array['s','w','i','tch','i','n','g']::text[], array['tch']::text[], 'diagnostic', 52, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'Switching seats made the group quieter.', 'Changing from one thing to another.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('watchful', 'watchful', 'tch', array['w','a','tch','f','u','l']::text[], array['tch']::text[], 'diagnostic', 48, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The lifeguard stayed watchful by the pool.', 'Carefully alert.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('watching', 'watching', 'tch', array['w','a','tch','i','n','g']::text[], array['tch']::text[], 'diagnostic', 44, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'We were watching clouds drift by.', 'Looking at something for a time.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('witch', 'witch', 'tch', array['w','i','tch']::text[], array['tch']::text[], 'diagnostic', 44, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'The story had a kind witch in the forest.', 'A magical character in stories.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true),
  ('wristwatch', 'wristwatch', 'tch', array['w','r','i','s','t','w','a','tch']::text[], array['tch']::text[], 'diagnostic', 50, 'Core', 'Core tch word selected for Phase 8B structured coverage.', 'A wristwatch showed the exact time.', 'A small clock worn on the wrist.', 'approved', 'suitable', 'wordloom_core', 'wordloom_core_v1_phase_8b_2026_05_13', true);

create temporary table wordloom_core_phase_8b_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_8b_word_targets (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
  ('abridge', 'dge', 'primary', 'trigraph', 0),
  ('accident', 'ci', 'primary', 'soft_c', 0),
  ('accidental', 'ci', 'primary', 'soft_c', 0),
  ('achievement', 'ie', 'primary', 'vowel_digraph', 0),
  ('acid', 'ci', 'primary', 'soft_c', 0),
  ('acknowledge', 'dge', 'primary', 'trigraph', 0),
  ('alien', 'ie', 'primary', 'vowel_digraph', 0),
  ('allure', 'ure', 'primary', 'trigraph', 0),
  ('annoyance', 'oy', 'primary', 'vowel_digraph', 0),
  ('annoys', 'oy', 'primary', 'vowel_digraph', 0),
  ('appoint', 'oi', 'primary', 'vowel_digraph', 0),
  ('appointment', 'oi', 'primary', 'vowel_digraph', 0),
  ('artificial', 'ci', 'primary', 'soft_c', 0),
  ('assure', 'ure', 'primary', 'trigraph', 0),
  ('auction', 'au', 'primary', 'vowel_digraph', 0),
  ('audible', 'au', 'primary', 'vowel_digraph', 0),
  ('aunt', 'au', 'primary', 'vowel_digraph', 0),
  ('authentic', 'au', 'primary', 'vowel_digraph', 0),
  ('authority', 'au', 'primary', 'vowel_digraph', 0),
  ('authorship', 'au', 'primary', 'vowel_digraph', 0),
  ('badgeholder', 'dge', 'primary', 'trigraph', 0),
  ('badger', 'dge', 'primary', 'trigraph', 0),
  ('bearded', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('beneficial', 'ci', 'primary', 'soft_c', 0),
  ('boiler', 'oi', 'primary', 'vowel_digraph', 0),
  ('boisterous', 'oi', 'primary', 'vowel_digraph', 0),
  ('boycott', 'oy', 'primary', 'vowel_digraph', 0),
  ('boyhood', 'oy', 'primary', 'vowel_digraph', 0),
  ('boyish', 'oy', 'primary', 'vowel_digraph', 0),
  ('bridged', 'dge', 'primary', 'trigraph', 0),
  ('briefcase', 'ie', 'primary', 'vowel_digraph', 0),
  ('briefing', 'ie', 'primary', 'vowel_digraph', 0),
  ('brochure', 'ure', 'primary', 'trigraph', 0),
  ('broil', 'oi', 'primary', 'vowel_digraph', 0),
  ('brownie', 'ie', 'primary', 'vowel_digraph', 0),
  ('butcher', 'tch', 'primary', 'trigraph', 0),
  ('capacity', 'ci', 'primary', 'soft_c', 0),
  ('capture', 'ure', 'primary', 'trigraph', 0),
  ('cartridge', 'dge', 'primary', 'trigraph', 0),
  ('catcher', 'tch', 'primary', 'trigraph', 0),
  ('catchphrase', 'tch', 'primary', 'trigraph', 0),
  ('caught', 'au', 'primary', 'vowel_digraph', 0),
  ('cauldron', 'au', 'primary', 'vowel_digraph', 0),
  ('causeway', 'au', 'primary', 'vowel_digraph', 0),
  ('cautious', 'au', 'primary', 'vowel_digraph', 0),
  ('checkpoint', 'oi', 'primary', 'vowel_digraph', 0),
  ('chieftain', 'ie', 'primary', 'vowel_digraph', 0),
  ('cicada', 'ci', 'primary', 'soft_c', 0),
  ('cinder', 'ci', 'primary', 'soft_c', 0),
  ('circuit', 'ci', 'primary', 'soft_c', 0),
  ('circus', 'ci', 'primary', 'soft_c', 0),
  ('citation', 'ci', 'primary', 'soft_c', 0),
  ('cite', 'ci', 'primary', 'soft_c', 0),
  ('civic', 'ci', 'primary', 'soft_c', 0),
  ('civilian', 'ci', 'primary', 'soft_c', 0),
  ('clearance', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('closure', 'ure', 'primary', 'trigraph', 0),
  ('coinage', 'oi', 'primary', 'vowel_digraph', 0),
  ('coincide', 'oi', 'primary', 'vowel_digraph', 0),
  ('collie', 'ie', 'primary', 'vowel_digraph', 0),
  ('commercial', 'ci', 'primary', 'soft_c', 0),
  ('cookie', 'ie', 'primary', 'vowel_digraph', 0),
  ('creature', 'ure', 'primary', 'trigraph', 0),
  ('daughter', 'au', 'primary', 'vowel_digraph', 0),
  ('delicious', 'ci', 'primary', 'soft_c', 0),
  ('departure', 'ure', 'primary', 'trigraph', 0),
  ('deploy', 'oy', 'primary', 'vowel_digraph', 0),
  ('deployed', 'oy', 'primary', 'vowel_digraph', 0),
  ('deployment', 'oy', 'primary', 'vowel_digraph', 0),
  ('destroyed', 'oy', 'primary', 'vowel_digraph', 0),
  ('destroyer', 'oy', 'primary', 'vowel_digraph', 0),
  ('diesel', 'ie', 'primary', 'vowel_digraph', 0),
  ('disappoint', 'oi', 'primary', 'vowel_digraph', 0),
  ('disappointment', 'oi', 'primary', 'vowel_digraph', 0),
  ('discipline', 'ci', 'primary', 'soft_c', 0),
  ('ditchwater', 'tch', 'primary', 'trigraph', 0),
  ('dodgeball', 'dge', 'primary', 'trigraph', 0),
  ('dodger', 'dge', 'primary', 'trigraph', 0),
  ('dredge', 'dge', 'primary', 'trigraph', 0),
  ('earache', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('earbuds', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('earlobe', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('early', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('earn', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('earth', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('edgeless', 'dge', 'primary', 'trigraph', 0),
  ('edgewise', 'dge', 'primary', 'trigraph', 0),
  ('efficient', 'ci', 'primary', 'soft_c', 0),
  ('electrician', 'ci', 'primary', 'soft_c', 0),
  ('electricity', 'ci', 'primary', 'soft_c', 0),
  ('embroider', 'oi', 'primary', 'vowel_digraph', 0),
  ('employee', 'oy', 'primary', 'vowel_digraph', 0),
  ('employer', 'oy', 'primary', 'vowel_digraph', 0),
  ('employment', 'oy', 'primary', 'vowel_digraph', 0),
  ('enclosure', 'ure', 'primary', 'trigraph', 0),
  ('endure', 'ure', 'primary', 'trigraph', 0),
  ('enjoyed', 'oy', 'primary', 'vowel_digraph', 0),
  ('enjoys', 'oy', 'primary', 'vowel_digraph', 0),
  ('ensure', 'ure', 'primary', 'trigraph', 0),
  ('exposure', 'ure', 'primary', 'trigraph', 0),
  ('failure', 'ure', 'primary', 'trigraph', 0),
  ('faultless', 'au', 'primary', 'vowel_digraph', 0),
  ('fielder', 'ie', 'primary', 'vowel_digraph', 0),
  ('fieldwork', 'ie', 'primary', 'vowel_digraph', 0),
  ('fierce', 'ie', 'primary', 'vowel_digraph', 0),
  ('financial', 'ci', 'primary', 'soft_c', 0),
  ('fixture', 'ure', 'primary', 'trigraph', 0),
  ('fledge', 'dge', 'primary', 'trigraph', 0),
  ('footbridge', 'dge', 'primary', 'trigraph', 0),
  ('fracture', 'ure', 'primary', 'trigraph', 0),
  ('fudgemaker', 'dge', 'primary', 'trigraph', 0),
  ('gracious', 'ci', 'primary', 'soft_c', 0),
  ('grief', 'ie', 'primary', 'vowel_digraph', 0),
  ('grudge', 'dge', 'primary', 'trigraph', 0),
  ('hatchback', 'tch', 'primary', 'trigraph', 0),
  ('haunted', 'au', 'primary', 'vowel_digraph', 0),
  ('haunting', 'au', 'primary', 'vowel_digraph', 0),
  ('heard', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('hearer', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('hedgehog', 'dge', 'primary', 'trigraph', 0),
  ('hedger', 'dge', 'primary', 'trigraph', 0),
  ('hedgerow', 'dge', 'primary', 'trigraph', 0),
  ('hoodie', 'ie', 'primary', 'vowel_digraph', 0),
  ('icicle', 'ci', 'primary', 'soft_c', 0),
  ('immature', 'ure', 'primary', 'trigraph', 0),
  ('injure', 'ure', 'primary', 'trigraph', 0),
  ('itchy', 'tch', 'primary', 'trigraph', 0),
  ('jaunty', 'au', 'primary', 'vowel_digraph', 0),
  ('joiner', 'oi', 'primary', 'vowel_digraph', 0),
  ('jointed', 'oi', 'primary', 'vowel_digraph', 0),
  ('joyfulness', 'oy', 'primary', 'vowel_digraph', 0),
  ('joyless', 'oy', 'primary', 'vowel_digraph', 0),
  ('judgement', 'dge', 'primary', 'trigraph', 0),
  ('ketchup', 'tch', 'primary', 'trigraph', 0),
  ('knowledge', 'dge', 'primary', 'trigraph', 0),
  ('knowledgeable', 'dge', 'primary', 'trigraph', 0),
  ('launcher', 'au', 'primary', 'vowel_digraph', 0),
  ('launder', 'au', 'primary', 'vowel_digraph', 0),
  ('laurel', 'au', 'primary', 'vowel_digraph', 0),
  ('learn', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('learner', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('ledger', 'dge', 'primary', 'trigraph', 0),
  ('leisure', 'ure', 'primary', 'trigraph', 0),
  ('lie', 'ie', 'primary', 'vowel_digraph', 0),
  ('literature', 'ure', 'primary', 'trigraph', 0),
  ('magpie', 'ie', 'primary', 'vowel_digraph', 0),
  ('manicure', 'ure', 'primary', 'trigraph', 0),
  ('manufacture', 'ure', 'primary', 'trigraph', 0),
  ('matchmaker', 'tch', 'primary', 'trigraph', 0),
  ('matchstick', 'tch', 'primary', 'trigraph', 0),
  ('mature', 'ure', 'primary', 'trigraph', 0),
  ('medicine', 'ci', 'primary', 'soft_c', 0),
  ('midge', 'dge', 'primary', 'trigraph', 0),
  ('mischief', 'ie', 'primary', 'vowel_digraph', 0),
  ('moisten', 'oi', 'primary', 'vowel_digraph', 0),
  ('movie', 'ie', 'primary', 'vowel_digraph', 0),
  ('naughty', 'au', 'primary', 'vowel_digraph', 0),
  ('nearness', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('nurture', 'ure', 'primary', 'trigraph', 0),
  ('oilcloth', 'oi', 'primary', 'vowel_digraph', 0),
  ('ointment', 'oi', 'primary', 'vowel_digraph', 0),
  ('optician', 'ci', 'primary', 'soft_c', 0),
  ('overjoyed', 'oy', 'primary', 'vowel_digraph', 0),
  ('overture', 'ure', 'primary', 'trigraph', 0),
  ('parboil', 'oi', 'primary', 'vowel_digraph', 0),
  ('partridge', 'dge', 'primary', 'trigraph', 0),
  ('patchwork', 'tch', 'primary', 'trigraph', 0),
  ('patchy', 'tch', 'primary', 'trigraph', 0),
  ('pearl', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('piecemeal', 'ie', 'primary', 'vowel_digraph', 0),
  ('pierce', 'ie', 'primary', 'vowel_digraph', 0),
  ('pinpoint', 'oi', 'primary', 'vowel_digraph', 0),
  ('pitcher', 'tch', 'primary', 'trigraph', 0),
  ('pitchfork', 'tch', 'primary', 'trigraph', 0),
  ('pitching', 'tch', 'primary', 'trigraph', 0),
  ('pleasure', 'ure', 'primary', 'trigraph', 0),
  ('pledge', 'dge', 'primary', 'trigraph', 0),
  ('pointing', 'oi', 'primary', 'vowel_digraph', 0),
  ('poison', 'oi', 'primary', 'vowel_digraph', 0),
  ('poisonous', 'oi', 'primary', 'vowel_digraph', 0),
  ('prairie', 'ie', 'primary', 'vowel_digraph', 0),
  ('precious', 'ci', 'primary', 'soft_c', 0),
  ('pressure', 'ure', 'primary', 'trigraph', 0),
  ('procedure', 'ure', 'primary', 'trigraph', 0),
  ('puncture', 'ure', 'primary', 'trigraph', 0),
  ('racing', 'ci', 'primary', 'soft_c', 0),
  ('recite', 'ci', 'primary', 'soft_c', 0),
  ('rehearsal', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('rehearse', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('rejoice', 'oi', 'primary', 'vowel_digraph', 0),
  ('relieve', 'ie', 'primary', 'vowel_digraph', 0),
  ('research', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('restaurant', 'au', 'primary', 'vowel_digraph', 0),
  ('retrieve', 'ie', 'primary', 'vowel_digraph', 0),
  ('rookie', 'ie', 'primary', 'vowel_digraph', 0),
  ('royalist', 'oy', 'primary', 'vowel_digraph', 0),
  ('royally', 'oy', 'primary', 'vowel_digraph', 0),
  ('royalty', 'oy', 'primary', 'vowel_digraph', 0),
  ('rupture', 'ure', 'primary', 'trigraph', 0),
  ('sauceboat', 'au', 'primary', 'vowel_digraph', 0),
  ('saucy', 'au', 'primary', 'vowel_digraph', 0),
  ('schoolboy', 'oy', 'primary', 'vowel_digraph', 0),
  ('scratchy', 'tch', 'primary', 'trigraph', 0),
  ('search', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('shielding', 'ie', 'primary', 'vowel_digraph', 0),
  ('siege', 'ie', 'primary', 'vowel_digraph', 0),
  ('sketching', 'tch', 'primary', 'trigraph', 0),
  ('sketchpad', 'tch', 'primary', 'trigraph', 0),
  ('sledgehammer', 'dge', 'primary', 'trigraph', 0),
  ('smidge', 'dge', 'primary', 'trigraph', 0),
  ('smoothie', 'ie', 'primary', 'vowel_digraph', 0),
  ('society', 'ci', 'primary', 'soft_c', 0),
  ('soybean', 'oy', 'primary', 'vowel_digraph', 0),
  ('soybeans', 'oy', 'primary', 'vowel_digraph', 0),
  ('spearmint', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('species', 'ci', 'primary', 'soft_c', 0),
  ('specific', 'ci', 'primary', 'soft_c', 0),
  ('spoiler', 'oi', 'primary', 'vowel_digraph', 0),
  ('stitcher', 'tch', 'primary', 'trigraph', 0),
  ('stitching', 'tch', 'primary', 'trigraph', 0),
  ('stopwatch', 'tch', 'primary', 'trigraph', 0),
  ('subsoil', 'oi', 'primary', 'vowel_digraph', 0),
  ('switchboard', 'tch', 'primary', 'trigraph', 0),
  ('switching', 'tch', 'primary', 'trigraph', 0),
  ('taught', 'au', 'primary', 'vowel_digraph', 0),
  ('tearful', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('technician', 'ci', 'primary', 'soft_c', 0),
  ('toil', 'oi', 'primary', 'vowel_digraph', 0),
  ('toilet', 'oi', 'primary', 'vowel_digraph', 0),
  ('topsoil', 'oi', 'primary', 'vowel_digraph', 0),
  ('toyed', 'oy', 'primary', 'vowel_digraph', 0),
  ('toying', 'oy', 'primary', 'vowel_digraph', 0),
  ('toylike', 'oy', 'primary', 'vowel_digraph', 0),
  ('trudge', 'dge', 'primary', 'trigraph', 0),
  ('turmoil', 'oi', 'primary', 'vowel_digraph', 0),
  ('unabridged', 'dge', 'primary', 'trigraph', 0),
  ('unsure', 'ure', 'primary', 'trigraph', 0),
  ('untie', 'ie', 'primary', 'vowel_digraph', 0),
  ('vault', 'au', 'primary', 'vowel_digraph', 0),
  ('venture', 'ure', 'primary', 'trigraph', 0),
  ('viewpoint', 'oi', 'primary', 'vowel_digraph', 0),
  ('voicemail', 'oi', 'primary', 'vowel_digraph', 0),
  ('voyager', 'oy', 'primary', 'vowel_digraph', 0),
  ('watchful', 'tch', 'primary', 'trigraph', 0),
  ('watching', 'tch', 'primary', 'trigraph', 0),
  ('weary', 'ear', 'primary', 'r_controlled_vowel', 0),
  ('widget', 'dge', 'primary', 'trigraph', 0),
  ('witch', 'tch', 'primary', 'trigraph', 0),
  ('wristwatch', 'tch', 'primary', 'trigraph', 0),
  ('yearlong', 'ear', 'primary', 'r_controlled_vowel', 0);

do $$
begin
  if (select count(*) from wordloom_core_phase_8b_words) <> 250 then
    raise exception 'Wordloom core Phase 8B batch must contain exactly 250 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8b_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_8b_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_8b_word_count
  ) then
    raise exception 'Wordloom core Phase 8B target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_8b_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 8B batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_8b_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> 'wordloom_core_v1_phase_8b_2026_05_13'
  ) then
    raise exception 'Wordloom core Phase 8B batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8b_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> 'wordloom_core_v1_phase_8b_2026_05_13'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 8B words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8b_words
    where sentence ~* '\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\M'
      or meaning ~* '\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\M'
  ) then
    raise exception 'Wordloom core Phase 8B words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8b_words
    where sentence ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
      or meaning ~* '\m(grapheme|focus sound|target sound|spelling pattern)\M'
  ) then
    raise exception 'Wordloom core Phase 8B words contain explicit spelling-hint context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8b_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 8B words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8b_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 8B primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8b_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 8B word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8b_word_targets as word_targets
    left join wordloom_core_phase_8b_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 8B word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_8b_words as words
    left join wordloom_core_phase_8b_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 8B word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 8B structured expansion batch 1 target'
from wordloom_core_phase_8b_targets
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
    from wordloom_core_phase_8b_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 8B linked targets must exist and be active.';
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
from wordloom_core_phase_8b_words
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
  'Wordloom core v1 Phase 8B structured expansion batch 1 target link'
from wordloom_core_phase_8b_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = 'wordloom_core_v1_phase_8b_2026_05_13'
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
      and source_version = 'wordloom_core_v1_phase_8b_2026_05_13'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 250 then
    raise exception 'Wordloom core Phase 8B persisted word count must be exactly 250.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_8b_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = 'wordloom_core_v1_phase_8b_2026_05_13'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_8b_word_count
  ) then
    raise exception 'Wordloom core Phase 8B persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 8B.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = 'wordloom_core_v1_phase_8b_2026_05_13'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 8B persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = 'wordloom_core_v1_phase_8b_2026_05_13'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 8B persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = 'wordloom_core_v1_phase_8b_2026_05_13'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 8B word must have exactly one primary target link.';
  end if;
  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join wordloom_core_phase_8b_words as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core Phase 8B must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join wordloom_core_phase_8b_words as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core Phase 8B must not add rows to school spelling bank additions.';
  end if;

end $$;

commit;
