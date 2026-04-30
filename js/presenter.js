import { supabase } from "./supabaseClient.js";
import { applyActiveSchoolFilter, readStaffAccessContext, resolveActiveSchoolDetails } from "./db.js?v=1.45";
import { mountGame } from "./game.js?v=1.41";
import {
  DEFAULT_QUESTION_TYPE,
  getQuestionTypeDisplayLabel,
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
} from "./spellingContextSupport.js?v=1.0";

const appEl = document.getElementById("app");
const params = new URLSearchParams(window.location.search);
const savedTestId = String(params.get("id") || "").trim();
const requestedDemoType = normalizeStoredQuestionType(params.get("demo") || DEFAULT_QUESTION_TYPE, {});

const QUESTION_TYPE_OPTIONS = [
  { value: "focus_sound", label: "Focus sound" },
  { value: "spell_loom", label: "Spell Loom" },
  { value: "type_what_you_hear", label: "Arrange what you hear" },
  { value: "segmented_spelling", label: "Segmented spelling" },
  { value: "no_support_assessment", label: "No support" },
];

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
};

const SAMPLE_CONTEXT_STATUS = "teacher_edited";

const STARTER_SETS = [
  { id: "ai_words", title: "ai sample test", questionType: "focus_sound", focus: "ai", words: SAMPLE_WORD_BANK.ai },
  { id: "magic_e", title: "magic e sample test", questionType: "spell_loom", focus: "a-e", words: SAMPLE_WORD_BANK["a-e"] },
  { id: "ee_words", title: "ee sample test", questionType: "type_what_you_hear", focus: "ee", words: SAMPLE_WORD_BANK.ee },
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
  if (questionType === "spell_loom") return "Spell Loom sample test";
  if (questionType === "type_what_you_hear") return "Arrange what you hear sample test";
  if (questionType === "segmented_spelling") return "Segmented spelling sample test";
  if (questionType === "no_support_assessment") return "Mixed focus sample test";
  return "Focus sound sample test";
}

function buildBuilderFromStarter(starter) {
  const wordCount = clampSampleWordCount(starter?.wordCount || SAMPLE_WORD_COUNT_DEFAULT);
  const focus = normalizeFocusValue(starter?.focus || "");
  const questionType = normalizeStoredQuestionType(starter?.questionType || requestedDemoType || DEFAULT_QUESTION_TYPE, {});
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
    questionType: normalizeStoredQuestionType(form.elements.namedItem("question_type")?.value || DEFAULT_QUESTION_TYPE, {}),
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
  return maskTargetWordInText(sentence, item?.word || context?.word || "");
}

function getVisibleSampleMeaning(context, item) {
  const meaning = String(context?.meaning || "").trim();
  if (!meaning || targetWordAppearsInText(meaning, item?.word || context?.word || "")) return "";
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
  const questionType = normalizeStoredQuestionType(builder.questionType || DEFAULT_QUESTION_TYPE, {});
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
