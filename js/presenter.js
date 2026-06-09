import { supabase } from "./supabaseClient.js";
import { applyActiveSchoolFilter, readStaffAccessContext, resolveActiveSchoolDetails } from "./db.js?v=1.49";
import { mountGame } from "./game.js?v=1.43";
import {
  DEFAULT_QUESTION_TYPE,
  getQuestionTypeDisplayLabel,
  getLaunchQuestionTypeOptions,
  normalizeLaunchQuestionType,
  normalizeStoredQuestionType,
} from "./questionTypes.js";
import { inferPattern, parseWordList, splitWordToGraphemes } from "./wordParser.js?v=1.5";
import { chooseBestFocusGrapheme } from "./data/phonemeHelpers.js";
import {
  getSpellingContextSupport,
  hasMeaningSupport,
  hasSentenceSupport,
  isForcedSentenceWord,
  normalizeContextWord,
} from "./spellingContextSupport.js?v=1.2";

const appEl = document.getElementById("app");
const params = new URLSearchParams(window.location.search);
const savedTestId = String(params.get("id") || "").trim();
const requestedDemoType = normalizeLaunchQuestionType(params.get("demo") || DEFAULT_QUESTION_TYPE, {});

const QUESTION_TYPE_OPTIONS = getLaunchQuestionTypeOptions();

const SAMPLE_WORD_COUNT_DEFAULT = 10;
const SAMPLE_WORD_COUNT_MAX = 10;

const FOCUS_GRAPHEME_OPTIONS = [
  { value: "ai", label: "ai" },
  { value: "ay", label: "ay" },
  { value: "a-e", label: "a-e" },
  { value: "ee", label: "ee" },
  { value: "ea", label: "ea" },
  { value: "igh", label: "igh" },
  { value: "i-e", label: "i-e" },
  { value: "oa", label: "oa" },
  { value: "ow", label: "ow" },
  { value: "o-e", label: "o-e" },
  { value: "oo", label: "oo" },
  { value: "ew", label: "ew" },
  { value: "sh", label: "sh" },
  { value: "ch", label: "ch" },
  { value: "th", label: "th" },
  { value: "ng", label: "ng" },
  { value: "ck", label: "ck" },
  { value: "qu", label: "qu" },
  { value: "ar", label: "ar" },
  { value: "or", label: "or" },
  { value: "er", label: "er" },
  { value: "oi", label: "oi" },
  { value: "oy", label: "oy" },
  { value: "", label: "Mixed focus" },
];

const SAMPLE_WORD_BANK = {
  ai: ["train", "snail", "paint", "chain", "rain", "sail", "brain", "plain", "wait", "tail"],
  ay: ["day", "play", "tray", "stay", "spray", "clay", "say", "pay", "hay", "way"],
  "a-e": ["cake", "make", "lake", "same", "game", "snake", "plane", "brave", "shape", "flame"],
  ee: ["see", "tree", "green", "sleep", "queen", "three", "street", "wheel", "feet", "seed"],
  ea: ["team", "seat", "read", "teach", "beach", "dream", "clean", "cream", "meal", "leaf"],
  igh: ["night", "light", "bright", "sight", "flight", "high", "sigh", "right", "might", "tight"],
  "i-e": ["bike", "like", "time", "shine", "smile", "drive", "prize", "slide", "white", "five"],
  oa: ["boat", "goat", "coat", "road", "toast", "float", "soak", "coach", "soap", "throat"],
  ow: ["cow", "now", "down", "brown", "clown", "town", "flower", "power", "shower", "crown"],
  "o-e": ["home", "hope", "rope", "note", "stone", "bone", "cone", "phone", "spoke", "those"],
  oo: ["moon", "spoon", "book", "look", "food", "soon", "room", "pool", "boot", "smooth"],
  ew: ["new", "chew", "grew", "flew", "drew", "screw", "threw", "few", "stew", "crew"],
  sh: ["ship", "shop", "fish", "wish", "shell", "brush", "shape", "fresh", "shout", "sheep"],
  ch: ["chip", "chop", "much", "lunch", "chin", "rich", "beach", "chair", "cheese", "teacher"],
  th: ["thin", "thick", "bath", "path", "moth", "three", "thank", "tooth", "cloth", "thorn"],
  ng: ["ring", "song", "king", "long", "thing", "swing", "bring", "strong", "bang", "sting"],
  ck: ["back", "duck", "sock", "pick", "lock", "truck", "stick", "clock", "black", "snack"],
  qu: ["queen", "quick", "quilt", "quiz", "quack", "quest", "quiet", "quake", "quote", "quite"],
  ar: ["car", "star", "farm", "sharp", "park", "charm", "start", "smart", "scarf", "garden"],
  or: ["fork", "horn", "storm", "sport", "short", "born", "corn", "horse", "morning", "thorn"],
  er: ["her", "fern", "term", "verb", "perch", "serve", "herd", "stern", "clerk", "person"],
  oi: ["coin", "soil", "boil", "spoil", "join", "point", "voice", "choice", "noise", "oil"],
  oy: ["boy", "toy", "joy", "enjoy", "royal", "annoy", "oyster", "cowboy", "destroy", "loyal"],
  mixed: ["night", "teacher", "shout", "rain", "cake", "green", "phone", "quick", "star", "toy"],
};

const SAMPLE_CONTEXT_SUPPORT = {
  train: {
    sentence: "The train pulled into the station.",
    meaning: "A vehicle that travels on tracks and carries people or goods.",
  },
  snail: {
    sentence: "The snail moved slowly across the path.",
    meaning: "A small animal with a soft body and a shell.",
  },
  paint: {
    sentence: "She used blue paint for the sky.",
    meaning: "Coloured liquid used to cover or decorate a surface.",
  },
  chain: {
    sentence: "The chain rattled in the box.",
    meaning: "Connected metal rings used for holding or pulling things.",
  },
  rain: {
    sentence: "The rain tapped on the window.",
    meaning: "Water that falls from clouds.",
  },
  sail: {
    sentence: "The sail filled with wind.",
    meaning: "A piece of cloth that helps move a boat.",
  },
  brain: {
    sentence: "Your brain helps you think and remember.",
    meaning: "The part inside your head that helps you think.",
  },
  plain: {
    sentence: "The answer was written in plain English.",
    meaning: "Simple and easy to understand.",
  },
  wait: {
    sentence: "Please wait by the door.",
    meaning: "To stay somewhere until something happens.",
  },
  tail: {
    sentence: "The dog wagged its tail.",
    meaning: "The part at the back of an animal's body.",
  },
  plane: {
    sentence: "The plane landed safely at the airport.",
    meaning: "An aircraft that flies through the sky.",
  },
  see: {
    sentence: "I can see the tree from here.",
    meaning: "To notice something with your eyes.",
  },
  right: {
    sentence: "The right answer was circled.",
    meaning: "Correct, or the side opposite left.",
  },
  flower: {
    sentence: "The flower opened in the sunshine.",
    meaning: "The colourful part of a plant that can make seeds.",
  },
  night: {
    sentence: "The stars shone at night.",
    meaning: "The dark time between evening and morning.",
  },
  teacher: {
    sentence: "The teacher smiled at the class.",
    meaning: "A person who helps others learn.",
  },
  shout: {
    sentence: "Do not shout in the library.",
    meaning: "To speak very loudly.",
  },
  cake: {
    sentence: "The cake was shared after lunch.",
    meaning: "A sweet baked food often eaten for a celebration.",
  },
  green: {
    sentence: "The green jumper was warm.",
    meaning: "The colour of grass and many leaves.",
  },
  phone: {
    sentence: "The phone buzzed on the desk.",
    meaning: "A device used to talk to someone far away.",
  },
  quick: {
    sentence: "The quick runner reached the gate first.",
    meaning: "Fast.",
  },
  star: {
    sentence: "A bright star appeared in the sky.",
    meaning: "A bright object seen in the night sky.",
  },
  toy: {
    sentence: "The toy car rolled under the chair.",
    meaning: "An object children play with.",
  },
  day: { sentence: "The day began with bright sunshine.", meaning: "A period of twenty-four hours, or when it is light outside." },
  play: { sentence: "The children play after lunch.", meaning: "To have fun in a game or activity." },
  tray: { sentence: "Mum put the cups on the tray.", meaning: "A flat board used for carrying cups or plates." },
  stay: { sentence: "We stay indoors when it rains.", meaning: "To remain in one place." },
  spray: { sentence: "The spray from the hose felt cold.", meaning: "Tiny drops sent through the air." },
  clay: { sentence: "We shaped the clay into a bowl.", meaning: "Soft earth used for making pots and models." },
  say: { sentence: "Please say your answer clearly.", meaning: "To use words when speaking." },
  pay: { sentence: "Dad will pay for the tickets.", meaning: "To give money for something." },
  hay: { sentence: "The horse ate fresh hay.", meaning: "Dried grass used as animal food." },
  way: { sentence: "This way leads to the playground.", meaning: "A route, method, or direction." },
  make: { sentence: "We make cards for the party.", meaning: "To create or build something." },
  lake: { sentence: "The ducks swam across the lake.", meaning: "A large area of water with land around it." },
  same: { sentence: "We wore the same colour socks.", meaning: "Not different." },
  game: { sentence: "The game ended before lunch.", meaning: "An activity with rules, often played for fun." },
  snake: { sentence: "The snake slid under a rock.", meaning: "A long, thin animal with no legs." },
  brave: { sentence: "The brave child tried again.", meaning: "Ready to do something difficult or frightening." },
  shape: { sentence: "Draw a shape on the paper.", meaning: "The outline or form of something." },
  flame: { sentence: "The candle flame flickered.", meaning: "The bright burning part of a fire." },
  tree: { sentence: "The tree gave us shade.", meaning: "A tall plant with a trunk, branches and leaves." },
  sleep: { sentence: "I sleep after a busy day.", meaning: "To rest with eyes closed, usually at night." },
  queen: { sentence: "The queen waved from the balcony.", meaning: "A female ruler or the wife of a king." },
  three: { sentence: "Three birds sat on the fence.", meaning: "The number after two." },
  street: { sentence: "The street was quiet.", meaning: "A road in a town with homes or shops." },
  wheel: { sentence: "The wheel turned quickly.", meaning: "A round part that turns to help something move." },
  feet: { sentence: "My feet were muddy.", meaning: "The parts at the ends of legs used for standing." },
  seed: { sentence: "We planted a seed in the pot.", meaning: "A small part of a plant that can grow." },
  team: { sentence: "Our team cheered loudly.", meaning: "A group of people working or playing together." },
  seat: { sentence: "Please take a seat.", meaning: "Something made for sitting on." },
  read: { sentence: "I like to read before bed.", meaning: "To look at written words and understand them." },
  teach: { sentence: "They teach music on Mondays.", meaning: "To help someone learn." },
  beach: { sentence: "We built a castle on the beach.", meaning: "A sandy or pebbly place beside the sea." },
  dream: { sentence: "I had a funny dream.", meaning: "Thoughts and pictures in your mind while asleep." },
  clean: { sentence: "Keep your desk clean.", meaning: "Free from dirt or mess." },
  cream: { sentence: "She poured cream on the pudding.", meaning: "A thick dairy food used in cooking or desserts." },
  meal: { sentence: "Lunch was my favourite meal.", meaning: "Food eaten at one time." },
  leaf: { sentence: "A leaf fell from the tree.", meaning: "A flat green part of a plant." },
  light: { sentence: "The light shone through the window.", meaning: "Brightness that lets you see." },
  bright: { sentence: "The bright lamp lit the room.", meaning: "Full of light or colour." },
  sight: { sentence: "The castle was a wonderful sight.", meaning: "The ability to see, or something seen." },
  flight: { sentence: "The flight left on time.", meaning: "A journey through the air." },
  high: { sentence: "The kite flew high.", meaning: "Far above the ground." },
  sigh: { sentence: "I heard Dad sigh after the walk.", meaning: "A long breath showing tiredness or relief." },
  might: { sentence: "It might rain later.", meaning: "A word used for something that could happen." },
  tight: { sentence: "The lid was too tight.", meaning: "Held firmly, with little room to move." },
  bike: { sentence: "I rode my bike to school.", meaning: "A vehicle with two wheels and pedals." },
  like: { sentence: "I like the warm soup.", meaning: "To enjoy something or think it is good." },
  time: { sentence: "What time is lunch?", meaning: "When something happens, measured by clocks." },
  shine: { sentence: "The stars shine at night.", meaning: "To give out or reflect light." },
  smile: { sentence: "Her smile made everyone feel welcome.", meaning: "A happy look on someone's face." },
  drive: { sentence: "Mum will drive us to the park.", meaning: "To control a vehicle." },
  prize: { sentence: "The prize was a new book.", meaning: "Something given for doing well." },
  slide: { sentence: "We slide down the hill.", meaning: "To move smoothly along a surface." },
  white: { sentence: "The white cup is on the shelf.", meaning: "The colour of snow or milk." },
  five: { sentence: "Five children joined the game.", meaning: "The number after four." },
  boat: { sentence: "The boat crossed the harbour.", meaning: "A small vehicle that travels on water." },
  goat: { sentence: "The goat climbed onto the wall.", meaning: "An animal with horns that often lives on a farm." },
  coat: { sentence: "Hang your coat by the door.", meaning: "Clothing worn over other clothes to stay warm." },
  road: { sentence: "The road curved past the school.", meaning: "A hard surface used by vehicles." },
  toast: { sentence: "I ate toast with jam.", meaning: "Bread browned by heat." },
  float: { sentence: "The leaf will float on the pond.", meaning: "To rest or move on top of water or air." },
  soak: { sentence: "The towel will soak up the spill.", meaning: "To make something very wet." },
  coach: { sentence: "The coach helped the team practise.", meaning: "A person who trains a team or player." },
  soap: { sentence: "Use soap before you rinse your hands.", meaning: "Something used with water for washing." },
  throat: { sentence: "My throat felt sore.", meaning: "The passage inside the neck used for swallowing." },
  cow: { sentence: "The cow stood by the gate.", meaning: "A large farm animal kept for milk or meat." },
  now: { sentence: "We need to leave now.", meaning: "At this moment." },
  down: { sentence: "The ball rolled down the hill.", meaning: "Towards a lower place." },
  brown: { sentence: "The brown bag is on the table.", meaning: "The colour of chocolate or soil." },
  clown: { sentence: "The clown made everyone laugh.", meaning: "A funny performer, often with bright clothes." },
  town: { sentence: "The town has a busy market.", meaning: "A place with many buildings and streets." },
  power: { sentence: "The torch needs power to work.", meaning: "Energy or strength used to make things work." },
  shower: { sentence: "A shower passed over the playground.", meaning: "A short fall of rain, or a way to wash." },
  crown: { sentence: "The king wore a golden crown.", meaning: "A special headpiece worn by a king or queen." },
  home: { sentence: "We walked home after school.", meaning: "The place where someone lives." },
  hope: { sentence: "I hope the sun comes out.", meaning: "A feeling that something good may happen." },
  rope: { sentence: "The rope was tied to the post.", meaning: "A strong thick cord." },
  note: { sentence: "Mum left a note on the fridge.", meaning: "A short written message." },
  stone: { sentence: "A smooth stone lay beside the path.", meaning: "A hard piece of rock." },
  bone: { sentence: "The dog buried a bone.", meaning: "A hard part inside the body." },
  cone: { sentence: "The cone stood near the roadworks.", meaning: "A solid shape with a point and round base." },
  spoke: { sentence: "She spoke kindly to the new pupil.", meaning: "Said something." },
  those: { sentence: "Those shoes belong by the door.", meaning: "The people or things already mentioned." },
  moon: { sentence: "The moon rose above the trees.", meaning: "The round object seen in the night sky." },
  spoon: { sentence: "Use a spoon for the soup.", meaning: "A tool used for eating or serving food." },
  book: { sentence: "The book was on the shelf.", meaning: "Pages joined together for reading." },
  look: { sentence: "Look at the picture carefully.", meaning: "To use your eyes." },
  food: { sentence: "The food smelled delicious.", meaning: "Things people or animals eat." },
  soon: { sentence: "The bus will arrive soon.", meaning: "After a short time." },
  room: { sentence: "The room was warm and bright.", meaning: "A space inside a building." },
  pool: { sentence: "The pool opened at ten.", meaning: "A small area of water for swimming." },
  boot: { sentence: "One boot was covered in mud.", meaning: "A strong shoe that covers the ankle." },
  smooth: { sentence: "The smooth pebble felt cool.", meaning: "Even, not rough." },
  new: { sentence: "The new pencil was sharp.", meaning: "Recently made, found, or started." },
  chew: { sentence: "Chew your food slowly.", meaning: "To bite food into smaller pieces." },
  grew: { sentence: "The plant grew taller each week.", meaning: "Became bigger or older." },
  flew: { sentence: "The bird flew over the fence.", meaning: "Moved through the air." },
  drew: { sentence: "She drew a picture of a boat.", meaning: "Made a picture with a pencil or pen." },
  screw: { sentence: "The screw held the shelf in place.", meaning: "A metal fastener turned into wood or metal." },
  threw: { sentence: "He threw the ball to his friend.", meaning: "Sent something from your hand through the air." },
  few: { sentence: "A few children stayed behind.", meaning: "A small number." },
  stew: { sentence: "The stew cooked in a big pot.", meaning: "A hot dish cooked slowly in liquid." },
  crew: { sentence: "The crew cleaned the deck.", meaning: "A group of people working together." },
  ship: { sentence: "The ship sailed across the bay.", meaning: "A large vehicle that travels on water." },
  shop: { sentence: "The shop opens at nine.", meaning: "A place where people buy things." },
  fish: { sentence: "The fish swam under the bridge.", meaning: "An animal that lives in water and has fins." },
  wish: { sentence: "Make a wish before bedtime.", meaning: "Something you want to happen." },
  shell: { sentence: "The shell was smooth and pink.", meaning: "A hard covering that protects some animals." },
  brush: { sentence: "Use a brush to clean your shoes.", meaning: "A tool with bristles used for cleaning or painting." },
  fresh: { sentence: "The fresh bread smelled wonderful.", meaning: "Recently made or picked; not stale." },
  sheep: { sentence: "The sheep stood in the field.", meaning: "A farm animal kept for wool and meat." },
  chip: { sentence: "A chip fell from the plate.", meaning: "A small piece broken from something, or fried potato." },
  chop: { sentence: "Chop the carrots carefully.", meaning: "To cut into pieces." },
  much: { sentence: "There was not much water left.", meaning: "A large amount." },
  lunch: { sentence: "Lunch is ready in the hall.", meaning: "A meal eaten in the middle of the day." },
  chin: { sentence: "The scarf covered his chin.", meaning: "The part of the face below the mouth." },
  rich: { sentence: "The cake had a rich flavour.", meaning: "Having a lot of money, or a strong quality." },
  chair: { sentence: "The chair was beside the window.", meaning: "A seat with a back." },
  cheese: { sentence: "The cheese melted on the toast.", meaning: "A food made from milk." },
  thin: { sentence: "A thin scarf hung on the hook.", meaning: "Narrow from one side to the other." },
  thick: { sentence: "The thick coat kept me warm.", meaning: "Wide from one side to the other, or not runny." },
  bath: { sentence: "The bath was full of bubbles.", meaning: "A wash while sitting in water." },
  path: { sentence: "The path led through the garden.", meaning: "A track or way for walking." },
  moth: { sentence: "A moth landed on the wall.", meaning: "An insect similar to a butterfly, often active at night." },
  thank: { sentence: "Remember to thank your helper.", meaning: "To show you are grateful." },
  tooth: { sentence: "My tooth felt wobbly.", meaning: "A hard white part in the mouth used for biting." },
  cloth: { sentence: "Wipe the table with a cloth.", meaning: "Woven material used for cleaning or making things." },
  thorn: { sentence: "A thorn caught on my sleeve.", meaning: "A sharp point on a plant stem." },
  ring: { sentence: "She wore a ring on her finger.", meaning: "A round band worn on a finger." },
  song: { sentence: "The class sang a cheerful song.", meaning: "Music with words sung by a voice." },
  king: { sentence: "The king sat on a tall chair.", meaning: "A male ruler." },
  long: { sentence: "The long road crossed the fields.", meaning: "Measuring a great distance from end to end." },
  thing: { sentence: "What is that thing on the shelf?", meaning: "An object, idea, or matter." },
  swing: { sentence: "The swing moved in the breeze.", meaning: "A seat hanging from ropes, or a back-and-forth movement." },
  bring: { sentence: "Please bring your book tomorrow.", meaning: "To carry something to a place." },
  strong: { sentence: "The strong wind pushed the gate.", meaning: "Having a lot of power or strength." },
  bang: { sentence: "The door closed with a bang.", meaning: "A sudden loud noise." },
  sting: { sentence: "The nettle can sting your hand.", meaning: "A painful prick from an insect or plant." },
  back: { sentence: "The bag is at the back of the room.", meaning: "The rear part of something." },
  duck: { sentence: "The duck paddled across the pond.", meaning: "A water bird with a broad beak." },
  sock: { sentence: "One sock was missing from the drawer.", meaning: "Clothing worn on the foot." },
  pick: { sentence: "Pick a card from the pile.", meaning: "To choose something, or lift it with fingers." },
  lock: { sentence: "The lock clicked shut.", meaning: "A device that keeps something shut." },
  truck: { sentence: "The truck carried boxes to the shop.", meaning: "A large road vehicle for carrying goods." },
  stick: { sentence: "The dog found a stick in the park.", meaning: "A thin piece of wood." },
  clock: { sentence: "The clock showed half past three.", meaning: "A device that shows the time." },
  black: { sentence: "The black cat slept on the chair.", meaning: "The darkest colour." },
  snack: { sentence: "I had a snack after school.", meaning: "A small amount of food eaten between meals." },
  quilt: { sentence: "The quilt kept the bed warm.", meaning: "A warm bed cover made with padding." },
  quiz: { sentence: "The quiz had ten questions.", meaning: "A set of questions used as a game or test." },
  quack: { sentence: "The duck gave a loud quack.", meaning: "A duck's call." },
  quest: { sentence: "The knight began a brave quest.", meaning: "A long search for something important." },
  quiet: { sentence: "The library was quiet.", meaning: "With very little noise." },
  quake: { sentence: "The ground began to quake.", meaning: "To shake strongly." },
  quote: { sentence: "The quote came from a story.", meaning: "Words repeated from what someone said or wrote." },
  quite: { sentence: "The puzzle was quite tricky.", meaning: "Completely, or to some degree." },
  car: { sentence: "The car stopped by the school gate.", meaning: "A road vehicle with four wheels." },
  farm: { sentence: "The farm had sheep and hens.", meaning: "Land used for growing food or keeping animals." },
  sharp: { sentence: "The sharp pencil made neat lines.", meaning: "Able to cut or pierce easily." },
  park: { sentence: "We met at the park after lunch.", meaning: "An open public place with grass or paths." },
  charm: { sentence: "The old cottage had charm.", meaning: "A pleasing quality, or a small lucky object." },
  start: { sentence: "The race will start soon.", meaning: "To begin." },
  smart: { sentence: "The smart pupil solved the puzzle.", meaning: "Clever, or neatly dressed." },
  scarf: { sentence: "Her scarf blew in the wind.", meaning: "A piece of cloth worn around the neck." },
  garden: { sentence: "The garden was full of flowers.", meaning: "A place where plants are grown." },
  fork: { sentence: "Put your fork beside the plate.", meaning: "A tool with prongs used for eating." },
  horn: { sentence: "The goat had one curved horn.", meaning: "A hard pointed part on some animals' heads." },
  storm: { sentence: "The storm passed during the night.", meaning: "Very bad weather with wind or heavy rain." },
  sport: { sentence: "Football is a popular sport.", meaning: "An activity with rules and physical effort." },
  short: { sentence: "The short path led to the gate.", meaning: "Not long or tall." },
  born: { sentence: "The lamb was born in spring.", meaning: "Brought into life as a baby." },
  corn: { sentence: "The corn grew tall in the field.", meaning: "A tall plant grown for grain, or its yellow kernels." },
  horse: { sentence: "The horse trotted across the field.", meaning: "A large animal people can ride." },
  morning: { sentence: "The morning sun warmed the playground.", meaning: "The early part of the day." },
  her: { sentence: "Give her the blue pencil.", meaning: "That girl or woman." },
  fern: { sentence: "A fern grew beside the path.", meaning: "A green plant with feathery leaves." },
  term: { sentence: "The term ends in July.", meaning: "A fixed period of school or a word for something." },
  verb: { sentence: "Find the verb in this sentence.", meaning: "A word that names an action or state." },
  perch: { sentence: "The bird sat on a perch.", meaning: "A branch or bar where a bird rests." },
  serve: { sentence: "They serve lunch at noon.", meaning: "To give food or help to someone." },
  herd: { sentence: "The herd moved across the field.", meaning: "A group of animals kept or moving together." },
  stern: { sentence: "The stern teacher spoke quietly.", meaning: "Serious, or the back of a boat." },
  clerk: { sentence: "The clerk checked the form.", meaning: "A person who works in an office or shop." },
  person: { sentence: "One person waited by the door.", meaning: "A human being." },
  coin: { sentence: "The coin rolled under the table.", meaning: "A small round piece of money." },
  soil: { sentence: "The soil felt damp after rain.", meaning: "The earth where plants grow." },
  boil: { sentence: "The kettle will boil soon.", meaning: "To heat liquid until it bubbles." },
  spoil: { sentence: "Do not spoil the surprise.", meaning: "To damage something or make it less good." },
  join: { sentence: "May I join your game?", meaning: "To put together or become part of a group." },
  point: { sentence: "The point of the pencil broke.", meaning: "A sharp end, or an idea being made." },
  voice: { sentence: "Her voice was calm and clear.", meaning: "The way someone speaks or sings." },
  choice: { sentence: "You have a choice at lunch.", meaning: "A decision between options." },
  noise: { sentence: "The noise came from the hall.", meaning: "Something heard that may be loud or unwanted." },
  oil: { sentence: "A little oil went into the pan.", meaning: "A thick liquid used for cooking, fuel, or machines." },
  boy: { sentence: "The boy carried the books.", meaning: "A male child." },
  joy: { sentence: "Her face was full of joy.", meaning: "A feeling of great happiness." },
  enjoy: { sentence: "I enjoy stories about space.", meaning: "To find something pleasant or fun." },
  royal: { sentence: "The royal coach passed the crowd.", meaning: "Linked to a king, queen, or their family." },
  annoy: { sentence: "Loud tapping can annoy the class.", meaning: "To make someone feel slightly angry." },
  oyster: { sentence: "The oyster shell was rough.", meaning: "A sea animal with a rough shell." },
  cowboy: { sentence: "The cowboy rode across the dusty track.", meaning: "A person who works with cattle, especially on horseback." },
  destroy: { sentence: "The storm could destroy the old shed.", meaning: "To damage something so badly it cannot be used." },
  loyal: { sentence: "The loyal friend kept the secret.", meaning: "Faithful and supportive." },
};

const SAMPLE_CONTEXT_STATUS = "teacher_edited";

const STARTER_SETS = [
  { id: "ai_words", title: "ai sample test", questionType: "focus_sound", focus: "ai", words: SAMPLE_WORD_BANK.ai },
  { id: "ee_segmented_words", title: "ee segmented spelling sample test", questionType: "segmented_spelling", focus: "ee", words: SAMPLE_WORD_BANK.ee },
  { id: "mixed_test", title: "mixed focus sample test", questionType: "no_support_assessment", focus: "", words: SAMPLE_WORD_BANK.mixed },
];

const state = {
  error: "",
  builder: getInitialBuilderState(),
  session: null,
  result: null,
  sampleContextController: null,
};

boot();

async function boot() {
  injectStyles();
  document.body.classList.add("presentPageBody");
  appEl?.classList.add("presentApp");
  appEl?.addEventListener("click", onClick);
  appEl?.addEventListener("input", onInput);
  appEl?.addEventListener("change", onChange);
  appEl?.addEventListener("submit", onSubmit);

  if (savedTestId) {
    renderLoading("Loading saved test...");
    try {
      const session = await loadSavedTest(savedTestId);
      launchSession(session);
      return;
    } catch (error) {
      state.error = error?.message || "Could not open this saved test.";
      renderError(state.error, true);
      return;
    }
  }

  renderBuilder();
}

function questionTypeLabel(value) {
  return getQuestionTypeDisplayLabel(value, {
    noSupportLabel: "No support",
    fallbackLabel: "Spelling",
  });
}

function clampSampleWordCount(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return SAMPLE_WORD_COUNT_DEFAULT;
  return Math.max(1, Math.min(SAMPLE_WORD_COUNT_MAX, parsed));
}

function buildWordsText(words) {
  return (Array.isArray(words) ? words : [])
    .map((word) => String(word || "").trim().toLowerCase())
    .filter(Boolean)
    .join("\n");
}

function getSampleWordsForFocus(focus, count, preferredWords = null) {
  const safeCount = clampSampleWordCount(count);
  const normalizedFocus = normalizeFocusValue(focus);
  const primary = Array.isArray(preferredWords) && preferredWords.length
    ? preferredWords
    : SAMPLE_WORD_BANK[normalizedFocus] || [];
  const fallback = SAMPLE_WORD_BANK.mixed;
  const seen = new Set();
  const words = [];

  for (const word of [...primary, ...fallback]) {
    const clean = String(word || "").trim().toLowerCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    words.push(clean);
    if (words.length >= safeCount) break;
  }

  return words;
}

function buildGeneratedWordsText(focus, count, preferredWords = null) {
  return buildWordsText(getSampleWordsForFocus(focus, count, preferredWords));
}

function buildSampleTitle(questionType, focus) {
  const normalizedFocus = normalizeFocusValue(focus);
  if (normalizedFocus) return `${normalizedFocus} sample test`;
  if (questionType === "segmented_spelling") return "Segmented spelling sample test";
  if (questionType === "no_support_assessment") return "Mixed focus sample test";
  return "Focus sound sample test";
}

function buildBuilderFromStarter(starter) {
  const wordCount = clampSampleWordCount(starter?.wordCount || SAMPLE_WORD_COUNT_DEFAULT);
  const focus = normalizeFocusValue(starter?.focus || "");
  const questionType = normalizeLaunchQuestionType(starter?.questionType || requestedDemoType || DEFAULT_QUESTION_TYPE, {});
  const generatedWordsText = buildGeneratedWordsText(focus, wordCount, starter?.words || null);
  const generatedTitle = String(starter?.title || "").trim() || buildSampleTitle(questionType, focus);

  return {
    starterId: String(starter?.id || "").trim(),
    title: generatedTitle,
    questionType,
    focus,
    wordCount,
    wordsText: generatedWordsText,
    generatedWordsText,
    generatedTitle,
    wordsEdited: false,
    titleEdited: false,
  };
}

function getInitialBuilderState() {
  const starter = STARTER_SETS.find((item) => item.questionType === requestedDemoType) || STARTER_SETS[0];
  return buildBuilderFromStarter(starter);
}

function normalizeFocusValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(/[,\s/|]+/)
    .filter(Boolean)[0] || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readBuilderForm() {
  const form = appEl?.querySelector("#presentBuilderForm");
  if (!(form instanceof HTMLFormElement)) return { ...state.builder };
  return {
    starterId: String(form.elements.namedItem("starter_id")?.value || "").trim(),
    title: String(form.elements.namedItem("title")?.value || "").trim(),
    questionType: normalizeLaunchQuestionType(form.elements.namedItem("question_type")?.value || DEFAULT_QUESTION_TYPE, {}),
    focus: normalizeFocusValue(form.elements.namedItem("focus")?.value || ""),
    wordCount: clampSampleWordCount(form.elements.namedItem("word_count")?.value || SAMPLE_WORD_COUNT_DEFAULT),
    wordsText: String(form.elements.namedItem("words_text")?.value || ""),
  };
}

function buildChoice(questionType, segments, focusOverride) {
  const { patternType } = inferPattern(segments);
  const preferredFocus = normalizeFocusValue(focusOverride);
  const inferredFocus = chooseBestFocusGrapheme(segments);
  const focus = preferredFocus && segments.includes(preferredFocus) ? preferredFocus : inferredFocus;
  const choice = {};
  if (focus) choice.focus_graphemes = [focus];
  if (patternType) choice.pattern_type = patternType;
  if (questionType === "spell_loom") choice.loom_decoy_level = "light";
  if (questionType === "segmented_spelling") choice.visual_aids_mode = "none";
  return choice;
}

function buildSampleContextSupport(word) {
  const normalizedWord = normalizeContextWord(word);
  const stored = SAMPLE_CONTEXT_SUPPORT[normalizedWord];
  if (!stored) return null;

  const sentence = String(stored.sentence || "").trim();
  const meaning = String(stored.meaning || "").trim();
  const forcedSentence = isForcedSentenceWord(normalizedWord);
  const contextSupport = {};

  if (sentence) {
    contextSupport.sentence = sentence;
    contextSupport.sentence_status = SAMPLE_CONTEXT_STATUS;
  }

  if (meaning) {
    contextSupport.meaning = meaning;
    contextSupport.meaning_status = SAMPLE_CONTEXT_STATUS;
    contextSupport.meaning_enabled = true;
  }

  if (forcedSentence) {
    contextSupport.sentence_required = true;
  }

  return Object.keys(contextSupport).length ? contextSupport : null;
}

function getVisibleSampleSentence(context, item) {
  const sentence = String(context?.sentence || "").trim();
  if (!sentence) return "";
  return maskTargetWordInText(sentence, context?.word || item?.word || "");
}

function getVisibleSampleMeaning(context, item) {
  const meaning = String(context?.meaning || "").trim();
  if (!meaning || targetWordAppearsInText(meaning, context?.word || item?.word || "")) return "";
  return meaning;
}

function maskTargetWordInText(text, word) {
  const pattern = buildTargetWordPattern(word);
  const value = String(text || "").trim();
  if (!value || !pattern) return value;
  return value.replace(pattern, "$1____");
}

function targetWordAppearsInText(text, word) {
  const pattern = buildTargetWordPattern(word);
  if (!pattern) return false;
  return pattern.test(String(text || ""));
}

function buildTargetWordPattern(word) {
  const normalizedWord = normalizeContextWord(word);
  if (!normalizedWord) return null;
  const wordPattern = normalizedWord
    .split("")
    .map((letter) => (letter === "'" ? "['\u2019\u2018`]" : escapeRegExpLiteral(letter)))
    .join("");
  return new RegExp(`(^|[^A-Za-z'\u2019\u2018])(${wordPattern})(?=$|[^A-Za-z'\u2019\u2018])`, "gi");
}

function escapeRegExpLiteral(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPublicSession(builder) {
  const questionType = normalizeLaunchQuestionType(builder.questionType || DEFAULT_QUESTION_TYPE, {});
  const focus = normalizeFocusValue(builder.focus);
  const rawWords = parseWordList(builder.wordsText || "").slice(0, SAMPLE_WORD_COUNT_MAX);

  if (!rawWords.length) {
    throw new Error("Add at least one word before starting the test.");
  }

  const words = rawWords.map((word, index) => {
    const segments = splitWordToGraphemes(word);
    const choice = buildChoice(questionType, segments, focus);
    const contextSupport = buildSampleContextSupport(word);
    if (contextSupport) {
      choice.context_support = contextSupport;
    }

    return {
      id: `public-${index + 1}`,
      position: index + 1,
      word,
      segments,
      choice,
    };
  });

  return {
    id: "",
    source: "public",
    title: String(builder.title || "").trim() || buildDefaultTitle(questionType, focus),
    questionType,
    words,
  };
}

function buildDefaultTitle(questionType, focus) {
  return buildSampleTitle(questionType, focus);
}

function isNoRowsError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "PGRST116"
    || message.includes("0 rows")
    || message.includes("json object requested");
}

async function loadSavedTest(testId) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) {
    throw new Error("Please sign in to present a saved test. You can still try the sample builder below.");
  }

  const accessContext = await readStaffAccessContext();
  const { activeSchool, activeSchoolName } = resolveActiveSchoolDetails(accessContext);

  let query = supabase
    .from("tests")
    .select(`
      id,
      title,
      question_type,
      test_words (
        id,
        position,
        word,
        sentence,
        segments,
        choice
      )
    `)
    .eq("id", testId)
    .eq("teacher_id", authData.user.id);
  query = applyActiveSchoolFilter(query, accessContext);
  const { data, error } = await query.single();

  if (error || !data?.id) {
    if (!data?.id && (!error || isNoRowsError(error))) {
      throw new Error("This test is not available in the current school.");
    }
    throw error || new Error("Could not load this saved test.");
  }

  const words = (Array.isArray(data.test_words) ? data.test_words : [])
    .sort((a, b) => Number(a?.position || 0) - Number(b?.position || 0))
    .map((item, index) => {
      const word = String(item?.word || "").trim().toLowerCase();
      const segments = Array.isArray(item?.segments) && item.segments.length
        ? item.segments.map((segment) => String(segment || "").trim().toLowerCase()).filter(Boolean)
        : splitWordToGraphemes(word);
      return {
        id: String(item?.id || `saved-${index + 1}`),
        position: Number(item?.position || index + 1),
        word,
        sentence: String(item?.sentence || "").trim(),
        segments,
        choice: item?.choice && typeof item.choice === "object" ? item.choice : {},
      };
    })
    .filter((item) => item.word);

  if (!words.length) {
    throw new Error("This test has no words yet.");
  }

  return {
    id: String(data.id),
    source: "saved",
    title: String(data.title || "Untitled test").trim() || "Untitled test",
    questionType: normalizeStoredQuestionType(data.question_type, { title: data.title }),
    school: activeSchool,
    schoolName: activeSchoolName,
    words,
  };
}

function launchSession(session) {
  cleanupSampleContextController();
  state.error = "";
  state.session = session;
  state.result = null;
  document.title = `${session.title} | ${session.source === "public" ? "Sample test" : "Live test"}`;
  appEl.innerHTML = `<div id="presentGameHost"></div>`;
  const host = appEl.querySelector("#presentGameHost");
  if (!(host instanceof HTMLElement)) return;

  mountGame({
    host,
    words: session.words,
    testMeta: {
      id: session.id || null,
      title: session.title,
      question_type: session.questionType,
      mode: "test",
      attempt_source: session.source === "saved" ? "presentation" : "public_presentation",
      audio_enabled: true,
      hints_enabled: true,
      school_name: session.schoolName || session.school?.name || "",
      ...(session.source === "public" ? { sample_mode: true } : {}),
    },
    pupilId: null,
    assignmentId: null,
    recordAttempts: false,
    presentationMode: true,
    onExit: () => {
      if (session.source === "saved") {
        leavePresenter();
        return;
      }
      renderBuilder();
    },
    onComplete: (result) => {
      state.result = result;
      renderComplete();
    },
  });

  if (session.source === "public") {
    state.sampleContextController = attachPublicSampleContextControls(host, session);
  }
}

function cleanupSampleContextController() {
  if (!state.sampleContextController) return;
  try {
    state.sampleContextController.cleanup?.();
  } catch {
    // Presenter-owned sample controls are disposable; cleanup should never block navigation.
  }
  state.sampleContextController = null;
}

function attachPublicSampleContextControls(host, session) {
  if (!(host instanceof HTMLElement) || session?.source !== "public") return null;

  const btnListen = host.querySelector("#btnListen");
  const actionRow = host.querySelector(".gameActionRow");
  const sentenceLine = host.querySelector("#sentenceLine");
  const wordNumber = host.querySelector("#wNum");

  if (
    !(btnListen instanceof HTMLButtonElement)
    || !(actionRow instanceof HTMLElement)
    || !(sentenceLine instanceof HTMLElement)
    || !(wordNumber instanceof HTMLElement)
  ) {
    return null;
  }

  btnListen.textContent = "Replay word";

  const sentenceButton = document.createElement("button");
  sentenceButton.className = "btn secondary presentContextButton";
  sentenceButton.type = "button";
  sentenceButton.textContent = "Sentence";

  const meaningButton = document.createElement("button");
  meaningButton.className = "btn secondary presentContextButton";
  meaningButton.type = "button";
  meaningButton.textContent = "Meaning";

  const insertAnchor = btnListen.nextSibling;
  actionRow.insertBefore(sentenceButton, insertAnchor);
  actionRow.insertBefore(meaningButton, insertAnchor);

  const meaningLine = document.createElement("div");
  meaningLine.id = "presentSampleMeaningLine";
  meaningLine.className = "muted presentContextMeaningLine";
  meaningLine.setAttribute("aria-live", "polite");
  meaningLine.style.display = "none";
  sentenceLine.insertAdjacentElement("afterend", meaningLine);

  let lastWordIndex = -1;

  const getCurrentIndex = () => {
    const parsed = Number.parseInt(String(wordNumber.textContent || "1"), 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min((session.words || []).length - 1, parsed - 1));
  };

  const getCurrentItem = () => (session.words || [])[getCurrentIndex()] || null;

  const clearMeaningLine = () => {
    meaningLine.textContent = "";
    meaningLine.style.display = "none";
    meaningButton.classList.remove("is-active");
  };

  const showForcedSentenceIfNeeded = (context, item) => {
    const visibleSentence = getVisibleSampleSentence(context, item);
    if (!context?.sentenceRequired || !visibleSentence) return;
    sentenceLine.textContent = visibleSentence;
    sentenceLine.style.display = "block";
  };

  const refreshControls = () => {
    const index = getCurrentIndex();
    const item = getCurrentItem();
    const context = getSpellingContextSupport(item);
    const visibleSentence = getVisibleSampleSentence(context, item);
    const visibleMeaning = getVisibleSampleMeaning(context, item);
    const sentenceAvailable = hasSentenceSupport(item) && !!visibleSentence;
    const meaningAvailable = hasMeaningSupport(item) && !!visibleMeaning;
    const showSentenceControl = sentenceAvailable || context.sentenceRequired;

    sentenceButton.hidden = !showSentenceControl;
    sentenceButton.disabled = !sentenceAvailable;
    sentenceButton.title = !sentenceAvailable && context.sentenceRequired
      ? "Sentence support is needed for this word, but no sample sentence is stored."
      : "";
    meaningButton.hidden = !meaningAvailable;
    meaningButton.disabled = !meaningAvailable;

    if (index !== lastWordIndex) {
      clearMeaningLine();
      meaningButton.classList.remove("is-active");
      lastWordIndex = index;
    }

    showForcedSentenceIfNeeded(context, item);
  };

  const onSentenceClick = () => {
    const item = getCurrentItem();
    const context = getSpellingContextSupport(item);
    const visibleSentence = getVisibleSampleSentence(context, item);
    if (!context.sentence || !visibleSentence) return;
    sentenceLine.textContent = visibleSentence;
    sentenceLine.style.display = "block";
    speakSampleSupportText(context.sentence);
  };

  const onMeaningClick = () => {
    const item = getCurrentItem();
    const context = getSpellingContextSupport(item);
    const visibleMeaning = getVisibleSampleMeaning(context, item);
    if (!visibleMeaning) return;
    meaningLine.textContent = visibleMeaning;
    meaningLine.style.display = "block";
    meaningButton.classList.add("is-active");
    speakSampleSupportText(visibleMeaning);
  };

  sentenceButton.addEventListener("click", onSentenceClick);
  meaningButton.addEventListener("click", onMeaningClick);

  const observer = new MutationObserver(refreshControls);
  observer.observe(wordNumber, { childList: true, characterData: true, subtree: true });
  refreshControls();

  return {
    cleanup() {
      observer.disconnect();
      sentenceButton.removeEventListener("click", onSentenceClick);
      meaningButton.removeEventListener("click", onMeaningClick);
      sentenceButton.remove();
      meaningButton.remove();
      meaningLine.remove();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
  };
}

function speakSampleSupportText(text) {
  const cleanText = String(text || "").trim();
  if (!cleanText || !("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance === "undefined") return;

  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(cleanText);
  utterance.rate = 0.9;
  const voices = window.speechSynthesis.getVoices?.() || [];
  const preferredVoice =
    voices.find((voice) => /en-GB/i.test(voice.lang)) ||
    voices.find((voice) => /^en/i.test(voice.lang));
  if (preferredVoice) utterance.voice = preferredVoice;
  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    // Support text remains visible even if browser speech playback is unavailable.
  }
}

function renderLoading(message) {
  appEl.innerHTML = `<section class="card presentBuilderCard"><p class="muted">${escapeHtml(message)}</p></section>`;
}

function renderError(message, allowPublicBuilder = false) {
  appEl.innerHTML = `
    <section class="card presentBuilderCard">
      <h1>Live test</h1>
      <p class="presentError">${escapeHtml(message)}</p>
      <div class="row presentActions">
        ${allowPublicBuilder ? `<button class="btn" type="button" data-action="open-builder">Open sample builder</button>` : ""}
        <button class="btn secondary" type="button" data-action="go-home">Back</button>
      </div>
    </section>
  `;
}

function renderBuilder() {
  cleanupSampleContextController();
  state.result = null;
  document.title = "Sample test builder";
  const builder = state.builder;
  const wordCount = clampSampleWordCount(builder.wordCount);

  appEl.innerHTML = `
    <div class="presentBuilderShell presentPublicShell">
      <header class="presentPublicTopbar">
        <a class="presentPublicWordmark" href="./index.html" aria-label="Wordloom homepage">
          <span class="presentPublicWordmarkMark" aria-hidden="true">W</span>
          <span>WORDLOOM</span>
        </a>
        <nav class="presentPublicNav" aria-label="Sample test navigation">
          <a href="./index.html">Back to homepage</a>
          <a href="./login.html">Log in</a>
        </nav>
      </header>
      <section class="card presentBuilderCard presentPublicCard">
        <div class="row presentBuilderTopRow">
          <button class="btn secondary" type="button" data-action="go-home">Back</button>
        </div>
        <span class="presentPublicEyebrow">Wordloom sample</span>
        <h1>Set up a sample test</h1>
        <p class="presentLead">Choose a sample format, adjust the words, then launch a no-save test.</p>
        ${state.error ? `<p class="presentError">${escapeHtml(state.error)}</p>` : ""}
        <form id="presentBuilderForm" class="presentBuilderForm">
          <input type="hidden" name="starter_id" value="${escapeHtml(builder.starterId || "")}" />
          <div class="presentFieldGrid presentPublicFormGrid">
            <label class="presentField">
              <span>Test type</span>
              <select class="select" name="question_type">
                ${QUESTION_TYPE_OPTIONS.map((item) => `<option value="${escapeHtml(item.value)}" ${builder.questionType === item.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
              </select>
            </label>
            <label class="presentField">
              <span>Focus grapheme</span>
              <select class="select" name="focus">
                ${FOCUS_GRAPHEME_OPTIONS.map((item) => `<option value="${escapeHtml(item.value)}" ${normalizeFocusValue(builder.focus) === item.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
              </select>
            </label>
            <label class="presentField">
              <span>Word count</span>
              <select class="select" name="word_count">
                ${Array.from({ length: SAMPLE_WORD_COUNT_MAX }, (_, index) => index + 1).map((count) => `<option value="${count}" ${wordCount === count ? "selected" : ""}>${count}</option>`).join("")}
              </select>
            </label>
            <label class="presentField">
              <span>Test title</span>
              <input class="input" type="text" name="title" value="${escapeHtml(builder.title || "")}" placeholder="Optional title" />
            </label>
          </div>

          <div class="presentField">
            <span>Starter sets</span>
            <div class="presentStarterGrid">
              ${STARTER_SETS.map((item) => `
                <button class="presentStarterButton ${builder.starterId === item.id ? "is-active" : ""}" type="button" data-action="use-starter" data-starter-id="${escapeHtml(item.id)}">
                  ${escapeHtml(item.title)}
                </button>
              `).join("")}
            </div>
          </div>

          <label class="presentField">
            <span>Words</span>
            <textarea class="textarea presentWordsInput" name="words_text" rows="8" placeholder="One word per line, or paste a comma-separated list.">${escapeHtml(builder.wordsText || "")}</textarea>
            <span class="presentHelper">Edit the generated words if needed. The sample uses up to 10 words.</span>
          </label>

          <div class="row presentActions">
            <button class="btn" type="submit">Launch test</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderComplete() {
  cleanupSampleContextController();
  const result = state.result || {};
  const totalWords = Number(result?.totalWords || 0);
  const totalCorrect = Number(result?.totalCorrect || 0);
  const incorrectCount = Math.max(0, totalWords - totalCorrect);
  const averageAttempts = Number(result?.averageAttempts || 0);
  const isSaved = state.session?.source === "saved";
  const meaningReview = renderSampleMeaningReview(state.session);

  appEl.innerHTML = `
    <div class="pupil-header">
      <h2>${escapeHtml(state.session?.title || "Test complete")}</h2>
      <p class="muted">${isSaved ? "You finished the test." : "You finished the sample test."}</p>
    </div>
    <section class="card test-card resultCardInline">
      <div class="resultSummaryGrid">
        <div class="resultSummaryCard">
          <div class="resultSummaryLabel">Score</div>
          <div class="resultSummaryValue">${escapeHtml(`${totalCorrect} / ${totalWords}`)}</div>
        </div>
        <div class="resultSummaryCard">
          <div class="resultSummaryLabel">Correct</div>
          <div class="resultSummaryValue">${escapeHtml(String(totalCorrect))}</div>
        </div>
        <div class="resultSummaryCard">
          <div class="resultSummaryLabel">To revisit</div>
          <div class="resultSummaryValue">${escapeHtml(String(incorrectCount))}</div>
        </div>
        <div class="resultSummaryCard">
          <div class="resultSummaryLabel">Average attempts</div>
          <div class="resultSummaryValue">${escapeHtml(averageAttempts.toFixed(1))}</div>
        </div>
      </div>
      ${meaningReview}
      <div class="row presentActions">
        <button class="btn" type="button" data-action="restart-session">Run again</button>
        <button class="btn secondary" type="button" data-action="${isSaved ? "go-home" : "edit-builder"}">${isSaved ? "Back to tests" : "Edit sample"}</button>
      </div>
    </section>
  `;
}

function renderSampleMeaningReview(session) {
  if (session?.source !== "public") return "";

  const items = (Array.isArray(session.words) ? session.words : [])
    .map((item) => ({
      word: String(item?.word || "").trim(),
      context: getSpellingContextSupport(item),
    }))
    .filter((item) => item.word && item.context.meaning);

  if (!items.length) return "";

  return `
    <section class="presentMeaningReview" aria-label="What these words mean">
      <h3>What these words mean</h3>
      <dl class="presentMeaningList">
        ${items.map(({ word, context }) => `
          <div class="presentMeaningRow">
            <dt>${escapeHtml(word)}</dt>
            <dd>${escapeHtml(context.meaning)}</dd>
          </div>
        `).join("")}
      </dl>
    </section>
  `;
}

function onInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
  if (!target.form || target.form.id !== "presentBuilderForm") return;

  if (target.name === "words_text") {
    const wordsText = String(target.value || "");
    state.builder = {
      ...state.builder,
      wordsText,
      wordsEdited: wordsText !== String(state.builder.generatedWordsText || ""),
    };
    return;
  }

  if (target.name === "title") {
    const title = String(target.value || "").trim();
    state.builder = {
      ...state.builder,
      title,
      titleEdited: state.builder.titleEdited === true || title !== String(state.builder.generatedTitle || ""),
    };
  }
}

function onChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (!target.form || target.form.id !== "presentBuilderForm") return;
  if (!["question_type", "focus", "word_count"].includes(target.name)) return;

  const formState = readBuilderForm();
  const currentGeneratedWords = String(state.builder.generatedWordsText || "");
  const wordsStillGenerated = String(formState.wordsText || "") === currentGeneratedWords;
  const nextGeneratedWordsText = buildGeneratedWordsText(formState.focus, formState.wordCount);
  const nextGeneratedTitle = buildSampleTitle(formState.questionType, formState.focus);
  const titleEdited = state.builder.titleEdited === true;

  state.builder = {
    ...state.builder,
    starterId: "",
    questionType: formState.questionType,
    focus: formState.focus,
    wordCount: formState.wordCount,
    title: titleEdited ? formState.title : nextGeneratedTitle,
    wordsText: wordsStillGenerated ? nextGeneratedWordsText : formState.wordsText,
    generatedTitle: nextGeneratedTitle,
    generatedWordsText: nextGeneratedWordsText,
    titleEdited,
    wordsEdited: !wordsStillGenerated,
  };
  state.error = "";
  renderBuilder();
}

function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "presentBuilderForm") return;
  event.preventDefault();

  try {
    state.builder = {
      ...state.builder,
      ...readBuilderForm(),
    };
    launchSession(buildPublicSession(state.builder));
  } catch (error) {
    state.error = error?.message || "Could not start the test.";
    renderBuilder();
  }
}

function onClick(event) {
  const button = event.target instanceof HTMLElement ? event.target.closest("[data-action]") : null;
  if (!(button instanceof HTMLElement)) return;

  const action = button.dataset.action || "";

  if (action === "use-starter") {
    const starter = STARTER_SETS.find((item) => item.id === button.dataset.starterId);
    if (!starter) return;
    state.builder = buildBuilderFromStarter(starter);
    state.error = "";
    renderBuilder();
    return;
  }

  if (action === "restart-session") {
    if (state.session) launchSession(state.session);
    return;
  }

  if (action === "edit-builder" || action === "open-builder") {
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url.toString());
    state.error = "";
    state.session = null;
    renderBuilder();
    return;
  }

  if (action === "go-home") {
    leavePresenter();
  }
}

function leavePresenter() {
  cleanupSampleContextController();
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  const url = new URL("./login.html", window.location.href);
  window.location.href = url.toString();
}

function injectStyles() {
  if (document.getElementById("presenterStyles")) return;
  const style = document.createElement("style");
  style.id = "presenterStyles";
  style.textContent = `
    .presentPageBody{
      background:
        linear-gradient(180deg, rgba(var(--wl-accent-rgb),.08), rgba(255,255,255,0) 46%),
        var(--wl-bg-soft);
      min-height:100vh;
    }
    .presentApp{
      width:min(1440px, 100%);
      margin:0 auto;
      padding:24px 16px 40px;
    }
    .presentPublicShell{
      width:min(980px, 100%);
      margin:0 auto;
      gap:22px;
    }
    .presentPublicTopbar{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:18px;
      padding:12px 0 18px;
      border-bottom:1px solid rgba(var(--wl-accent-rgb),.14);
    }
    .presentPublicWordmark{
      display:inline-flex;
      align-items:center;
      gap:10px;
      color:var(--wl-text);
      font-size:16px;
      font-weight:850;
      letter-spacing:0;
      text-decoration:none;
      white-space:nowrap;
    }
    .presentPublicWordmarkMark{
      display:inline-flex;
      width:36px;
      height:36px;
      align-items:center;
      justify-content:center;
      border:1px solid var(--wl-border);
      border-radius:8px;
      background:#fff;
      color:var(--wl-accent);
      font-weight:900;
      box-shadow:0 8px 24px rgba(28,28,28,.06);
    }
    .presentPublicNav{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:10px;
      flex-wrap:wrap;
    }
    .presentPublicNav a{
      display:inline-flex;
      min-height:38px;
      align-items:center;
      justify-content:center;
      border:1px solid var(--wl-border);
      border-radius:999px;
      padding:8px 14px;
      background:#fff;
      color:var(--wl-text-muted);
      font-size:13px;
      font-weight:800;
      text-decoration:none;
    }
    .presentPublicNav a:hover{
      border-color:rgba(var(--wl-accent-rgb),.28);
      color:var(--wl-text);
    }
    .presentBuilderShell{
      display:grid;
      gap:18px;
    }
    .presentBuilderCard{
      padding:24px;
    }
    .presentPublicCard{
      border:1px solid rgba(var(--wl-accent-rgb),.14);
      border-radius:14px;
      padding:28px;
      background:#fff;
      box-shadow:0 22px 60px rgba(28,28,28,.08);
    }
    .presentBuilderTopRow{
      justify-content:flex-start;
      margin-bottom:14px;
    }
    .presentPublicEyebrow{
      display:block;
      margin-bottom:10px;
      color:var(--wl-accent);
      font-size:12px;
      font-weight:850;
      letter-spacing:0;
      text-transform:uppercase;
    }
    .presentPublicCard h1{
      margin-top:0;
      margin-bottom:10px;
      color:var(--wl-text);
      font-size:38px;
      line-height:1.08;
    }
    .presentLead{
      max-width:70ch;
      color:var(--wl-text-muted);
      margin-top:0;
      margin-bottom:22px;
      font-size:17px;
      line-height:1.55;
    }
    .presentBuilderForm{
      display:grid;
      gap:18px;
    }
    .presentFieldGrid{
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
      gap:14px;
    }
    .presentPublicFormGrid{
      grid-template-columns:repeat(2, minmax(220px, 1fr));
    }
    .presentField{
      display:flex;
      flex-direction:column;
      gap:8px;
    }
    .presentField > span{
      font-size:13px;
      font-weight:700;
      color:var(--text);
    }
    .presentStarterGrid{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
    }
    .presentStarterButton{
      border:1px solid var(--line);
      border-radius:999px;
      padding:10px 14px;
      background:#fff;
      color:var(--text);
      font-weight:700;
      cursor:pointer;
    }
    .presentStarterButton:hover{
      border-color:rgba(var(--wl-accent-rgb),.28);
      background:var(--wl-bg-soft);
    }
    .presentStarterButton.is-active{
      border-color:rgba(var(--wl-accent-rgb),.36);
      background:var(--wl-accent-tint);
    }
    .presentWordsInput{
      min-height:190px;
      resize:vertical;
    }
    .presentHelper{
      font-size:13px;
      color:var(--muted);
    }
    .presentError{
      border:1px solid rgba(184,92,75,.30);
      background:rgba(184,92,75,.08);
      color:var(--wl-error-ink);
      border-radius:12px;
      padding:12px 14px;
      margin-bottom:0;
    }
    .presentActions{
      justify-content:center;
      flex-wrap:wrap;
      gap:12px;
    }
    .gameShell--present .presentContextButton{
      min-width:112px;
    }
    .gameShell--present .presentContextButton.is-active{
      border-color:rgba(var(--wl-accent-rgb),.36);
      background:var(--wl-accent-tint);
      color:var(--wl-text);
    }
    .presentContextMeaningLine{
      max-width:680px;
      margin:6px auto 0;
      text-align:center;
      font-size:15px;
      line-height:1.45;
      color:var(--wl-text-muted);
    }
    .presentMeaningReview{
      margin:20px 0 0;
      padding-top:18px;
      border-top:1px solid var(--wl-border);
    }
    .presentMeaningReview h3{
      margin:0 0 12px;
      color:var(--wl-text);
      font-size:18px;
      line-height:1.25;
    }
    .presentMeaningList{
      display:grid;
      gap:10px;
      margin:0;
    }
    .presentMeaningRow{
      display:grid;
      grid-template-columns:minmax(92px, 150px) 1fr;
      gap:10px 16px;
      align-items:start;
    }
    .presentMeaningRow dt{
      color:var(--wl-text);
      font-weight:850;
    }
    .presentMeaningRow dd{
      margin:0;
      color:var(--wl-text-muted);
      line-height:1.45;
    }
    @media (max-width: 720px){
      .presentApp{
        padding:18px 12px 28px;
      }
      .presentPublicTopbar{
        align-items:flex-start;
        flex-direction:column;
      }
      .presentPublicNav{
        width:100%;
        justify-content:flex-start;
      }
      .presentBuilderCard{
        padding:18px;
      }
      .presentPublicCard h1{
        font-size:32px;
      }
      .presentPublicFormGrid{
        grid-template-columns:1fr;
      }
      .gameShell--present .presentContextButton{
        min-width:0;
      }
      .presentMeaningRow{
        grid-template-columns:1fr;
        gap:3px;
      }
    }
  `;
  document.head.appendChild(style);
}
