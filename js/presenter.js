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

function buildPublicSession(builder) {
  const questionType = normalizeStoredQuestionType(builder.questionType || DEFAULT_QUESTION_TYPE, {});
  const focus = normalizeFocusValue(builder.focus);
  const rawWords = parseWordList(builder.wordsText || "").slice(0, SAMPLE_WORD_COUNT_MAX);

  if (!rawWords.length) {
    throw new Error("Add at least one word before starting the test.");
  }

  const words = rawWords.map((word, index) => {
    const segments = splitWordToGraphemes(word);
    return {
      id: `public-${index + 1}`,
      position: index + 1,
      word,
      sentence: "",
      segments,
      choice: buildChoice(questionType, segments, focus),
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
  state.result = null;
  document.title = "Sample test builder";
  const builder = state.builder;
  const wordCount = clampSampleWordCount(builder.wordCount);

  appEl.innerHTML = `
    <div class="presentBuilderShell">
      <section class="card presentBuilderCard">
        <div class="row presentBuilderTopRow">
          <button class="btn secondary" type="button" data-action="go-home">Back</button>
        </div>
        <h1>Set up a sample test</h1>
        <p class="presentLead">Pick a focus, adjust the words, then launch. Nothing is saved.</p>
        ${state.error ? `<p class="presentError">${escapeHtml(state.error)}</p>` : ""}
        <form id="presentBuilderForm" class="presentBuilderForm">
          <input type="hidden" name="starter_id" value="${escapeHtml(builder.starterId || "")}" />
          <div class="presentFieldGrid">
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
  const result = state.result || {};
  const totalWords = Number(result?.totalWords || 0);
  const totalCorrect = Number(result?.totalCorrect || 0);
  const incorrectCount = Math.max(0, totalWords - totalCorrect);
  const averageAttempts = Number(result?.averageAttempts || 0);
  const isSaved = state.session?.source === "saved";

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
      <div class="row presentActions">
        <button class="btn" type="button" data-action="restart-session">Run again</button>
        <button class="btn secondary" type="button" data-action="${isSaved ? "go-home" : "edit-builder"}">${isSaved ? "Back to tests" : "Edit sample"}</button>
      </div>
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
      background:var(--wl-bg-soft);
      min-height:100vh;
    }
    .presentApp{
      width:min(1440px, 100%);
      margin:0 auto;
      padding:24px 16px 40px;
    }
    .presentBuilderShell{
      display:grid;
      gap:18px;
    }
    .presentBuilderCard{
      padding:24px;
    }
    .presentBuilderTopRow{
      justify-content:flex-start;
      margin-bottom:10px;
    }
    .presentLead{
      max-width:70ch;
      color:var(--muted);
      margin-bottom:20px;
    }
    .presentBuilderForm{
      display:grid;
      gap:16px;
    }
    .presentFieldGrid{
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
      gap:14px;
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
    @media (max-width: 720px){
      .presentApp{
        padding:18px 12px 28px;
      }
      .presentBuilderCard{
        padding:18px;
      }
    }
  `;
  document.head.appendChild(style);
}
