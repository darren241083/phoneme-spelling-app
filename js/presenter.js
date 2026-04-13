import { supabase } from "./supabaseClient.js";
import { mountGame } from "./game.js?v=1.29";
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

const STARTER_SETS = [
  { id: "ai_words", title: "ai words test", questionType: "focus_sound", focus: "ai", words: ["train", "snail", "paint", "chain"] },
  { id: "magic_e", title: "magic e test", questionType: "spell_loom", focus: "a-e", words: ["cake", "home", "bike", "cube"] },
  { id: "ee_words", title: "ee words test", questionType: "type_what_you_hear", focus: "ee", words: ["green", "sleep", "queen", "street"] },
  { id: "mixed_test", title: "mixed spelling test", questionType: "no_support_assessment", focus: "", words: ["night", "teacher", "shout", "rain"] },
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

function getInitialBuilderState() {
  const starter = STARTER_SETS.find((item) => item.questionType === requestedDemoType) || STARTER_SETS[0];
  return {
    starterId: starter.id,
    title: starter.title,
    questionType: starter.questionType,
    focus: starter.focus,
    wordsText: starter.words.join("\n"),
  };
}

function questionTypeLabel(value) {
  return getQuestionTypeDisplayLabel(value, {
    noSupportLabel: "No support",
    fallbackLabel: "Spelling",
  });
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
  const rawWords = parseWordList(builder.wordsText || "");

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
  if (focus) return `${focus} test`;
  if (questionType === "spell_loom") return "Spell Loom test";
  if (questionType === "type_what_you_hear") return "Arrange what you hear test";
  if (questionType === "segmented_spelling") return "Segmented spelling test";
  if (questionType === "no_support_assessment") return "Spelling test";
  return "Focus sound test";
}

async function loadSavedTest(testId) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) {
    throw new Error("Please sign in to present a saved test. You can still try the public builder below.");
  }

  const { data, error } = await supabase
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
    .eq("teacher_id", authData.user.id)
    .single();

  if (error || !data?.id) {
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
    words,
  };
}

function launchSession(session) {
  state.error = "";
  state.session = session;
  state.result = null;
  document.title = `${session.title} | Live test`;
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
        ${allowPublicBuilder ? `<button class="btn" type="button" data-action="open-builder">Open public builder</button>` : ""}
        <button class="btn secondary" type="button" data-action="go-home">Back</button>
      </div>
    </section>
  `;
}

function renderBuilder() {
  state.result = null;
  document.title = "Live test builder";
  const builder = state.builder;

  appEl.innerHTML = `
    <div class="presentBuilderShell">
      <section class="card presentBuilderCard">
        <div class="row presentBuilderTopRow">
          <button class="btn secondary" type="button" data-action="go-home">Back</button>
        </div>
        <h1>Build a live test</h1>
        <p class="presentLead">Use the exact pupil test screen on the big display. Choose a test type, load a starter set, or type your own words, then launch it.</p>
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
              <span>Focus spelling</span>
              <input class="input" type="text" name="focus" value="${escapeHtml(builder.focus || "")}" placeholder="Optional: ai, ay, oa, igh" />
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
            <span class="presentHelper">The live test will use the same pupil renderer, audio, and question flow. Add one word per line for best results.</span>
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
      <p class="muted">You finished the test.</p>
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
        <button class="btn secondary" type="button" data-action="${isSaved ? "go-home" : "edit-builder"}">${isSaved ? "Back to tests" : "Edit setup"}</button>
      </div>
    </section>
  `;
}

function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "presentBuilderForm") return;
  event.preventDefault();

  try {
    state.builder = readBuilderForm();
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
    state.builder = {
      starterId: starter.id,
      title: starter.title,
      questionType: starter.questionType,
      focus: starter.focus,
      wordsText: starter.words.join("\n"),
    };
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
  const url = new URL("./index.html", window.location.href);
  window.location.href = url.toString();
}

function injectStyles() {
  if (document.getElementById("presenterStyles")) return;
  const style = document.createElement("style");
  style.id = "presenterStyles";
  style.textContent = `
    .presentPageBody{
      background:#f8fafc;
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
      border-color:#93c5fd;
      background:#eff6ff;
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
      border:1px solid rgba(239,68,68,.2);
      background:rgba(239,68,68,.06);
      color:#991b1b;
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
