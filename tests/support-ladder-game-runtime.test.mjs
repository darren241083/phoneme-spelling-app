import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

function stripQueryString(specifier = "") {
  return String(specifier || "").replace(/\?.*$/, "");
}

function parseBindings(bindings = "") {
  return String(bindings || "")
    .split(",")
    .map((binding) => binding.trim())
    .filter(Boolean)
    .map((binding) => {
      const [imported, local = imported] = binding.split(/\s+as\s+/i).map((part) => part.trim());
      return { imported, local };
    });
}

function transformBrowserModule(modulePath, { seen = new Set(), isEntry = false, mocks = {} } = {}) {
  const safePath = path.resolve(modulePath);
  if (seen.has(safePath)) {
    return { code: "", exportNames: [] };
  }
  seen.add(safePath);

  let sourceText = readFileSync(safePath, "utf8");
  const dependencyBlocks = [];

  sourceText = sourceText.replace(/import\s*\{([\s\S]*?)\}\s*from\s*["'](.+?)["'];?\s*/g, (_match, bindings, specifier) => {
    const stripped = stripQueryString(specifier);
    if (Object.hasOwn(mocks, stripped)) {
      const assignments = parseBindings(bindings)
        .map(({ imported, local }) => `${imported}: ${local}`)
        .join(", ");
      return `const { ${assignments} } = __mocks[${JSON.stringify(stripped)}];\n`;
    }

    if (/^https?:\/\//i.test(stripped)) return "";

    const resolvedPath = path.resolve(path.dirname(safePath), stripped);
    const dependency = transformBrowserModule(resolvedPath, { seen, isEntry: false, mocks });
    dependencyBlocks.push(dependency.code);
    return "";
  });

  const exportNames = [];
  sourceText = sourceText.replace(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    if (isEntry) exportNames.push(name);
    return `async function ${name}`;
  });
  sourceText = sourceText.replace(/export function\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    if (isEntry) exportNames.push(name);
    return `function ${name}`;
  });
  sourceText = sourceText.replace(/export const\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    if (isEntry) exportNames.push(name);
    return `const ${name}`;
  });
  sourceText = sourceText.replace(/export\s*\{([^}]+)\};?\s*/g, (_match, names) => {
    if (isEntry) {
      for (const item of String(names || "").split(",")) {
        const [localName] = item.split(/\s+as\s+/i).map((part) => String(part || "").trim());
        if (localName) exportNames.push(localName);
      }
    }
    return "";
  });

  return {
    code: `${dependencyBlocks.filter(Boolean).join("\n")}\n${sourceText}`,
    exportNames,
  };
}

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.values = new Set();
  }

  add(...classes) {
    classes.filter(Boolean).forEach((value) => this.values.add(value));
  }

  remove(...classes) {
    classes.filter(Boolean).forEach((value) => this.values.delete(value));
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(tagName = "div", id = "", owner = null) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.id = id;
    this.owner = owner || this;
    this.style = {};
    this.dataset = {};
    this.classList = new FakeClassList(this);
    this.listeners = new Map();
    this.children = [];
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.readOnly = false;
    this.attributes = new Map();
    this._innerHTML = "";
    if (id) this.owner.registerElement(this);
  }

  registerElement(element) {
    if (!this.elementsById) this.elementsById = new Map();
    if (!this.elements) this.elements = new Set();
    if (element.id) this.elementsById.set(element.id, element);
    this.elements.add(element);
  }

  set innerHTML(value) {
    this._innerHTML = String(value || "");
    this.children = [];
    this.textContent = "";
    const tagPattern = /<([a-zA-Z0-9]+)([^>]*?)>/g;
    let match;
    while ((match = tagPattern.exec(this._innerHTML))) {
      const [, tagName, attrs] = match;
      const id = /id="([^"]+)"/.exec(attrs)?.[1] || "";
      const element = tagName.toLowerCase() === "input"
        ? new FakeInputElement(tagName, id, this.owner)
        : new FakeElement(tagName, id, this.owner);
      const classAttr = /class="([^"]+)"/.exec(attrs)?.[1] || "";
      classAttr.split(/\s+/).filter(Boolean).forEach((className) => element.classList.add(className));
      for (const dataMatch of attrs.matchAll(/data-([a-zA-Z0-9-]+)="([^"]*)"/g)) {
        const key = dataMatch[1].replace(/-([a-z])/g, (_m, char) => char.toUpperCase());
        element.dataset[key] = dataMatch[2];
      }
      this.children.push(element);
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  querySelector(selector) {
    const clean = String(selector || "").trim();
    if (!clean) return null;
    if (clean.startsWith("#")) {
      const id = clean.slice(1);
      if (this.id === id) return this;
      return this.owner.elementsById?.get(id) || null;
    }
    if (clean.startsWith(".")) {
      const className = clean.slice(1);
      return [...(this.owner.elements || [])].find((element) => element.classList.contains(className)) || null;
    }
    return null;
  }

  addEventListener(type, handler) {
    const key = String(type || "");
    const list = this.listeners.get(key) || [];
    list.push(handler);
    this.listeners.set(key, list);
  }

  removeEventListener(type, handler) {
    const key = String(type || "");
    const list = this.listeners.get(key) || [];
    this.listeners.set(key, list.filter((entry) => entry !== handler));
  }

  async dispatchEvent(event) {
    const evt = event || {};
    if (!evt.target) evt.target = this;
    const list = this.listeners.get(String(evt.type || "")) || [];
    for (const handler of list) {
      await handler(evt);
    }
    return !evt.defaultPrevented;
  }

  async click() {
    await this.dispatchEvent({
      type: "click",
      target: this,
      preventDefault() {
        this.defaultPrevented = true;
      },
    });
  }

  focus() {
    this.focused = true;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "aria-hidden") this.hidden = String(value) === "true";
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  closest() {
    return null;
  }
}

class FakeInputElement extends FakeElement {
  constructor(tagName = "input", id = "", owner = null) {
    super(tagName, id, owner);
    this.value = "";
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  select() {
    this.selectionStart = 0;
    this.selectionEnd = String(this.value || "").length;
  }
}

class FakeDocument {
  constructor() {
    this.root = new FakeElement("root");
    this.root.owner = this.root;
    this.root.elementsById = new Map();
    this.root.elements = new Set();
  }

  getElementById(id) {
    return this.root.elementsById.get(String(id || "")) || null;
  }

  createElement(tagName) {
    return tagName === "input"
      ? new FakeInputElement(tagName, "", this.root)
      : new FakeElement(tagName, "", this.root);
  }
}

function createEvent(type, target, options = {}) {
  return {
    type,
    target,
    ...options,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

function loadGameHarness() {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const attempts = [];
  const mocks = {
    "./db.js": {
      async pupilRecordAttempt(payload) {
        attempts.push(JSON.parse(JSON.stringify(payload)));
        return payload;
      },
    },
  };
  const sourcePath = path.resolve(testDir, "../js/game.js");
  const { code, exportNames } = transformBrowserModule(sourcePath, {
    isEntry: true,
    mocks,
  });
  const transformedSource = `${code}
module.exports = {
  ${exportNames.join(",\n  ")}
};`;

  const document = new FakeDocument();
  const window = {
    innerWidth: 1024,
    localStorage: new Map(),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    addEventListener() {},
    removeEventListener() {},
    speechSynthesis: { cancel() {}, speak() {}, getVoices() { return []; } },
    SpeechSynthesisUtterance: class {
      constructor(text) {
        this.text = text;
      }
    },
  };
  const context = {
    __mocks: mocks,
    module: { exports: {} },
    exports: {},
    console,
    document,
    window,
    HTMLElement: FakeElement,
    HTMLInputElement: FakeInputElement,
    HTMLAudioElement: class {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  vm.runInNewContext(transformedSource, context, { filename: sourcePath });
  return { mountGame: context.module.exports.mountGame, attempts, document, window };
}

function defaultWord(overrides = {}) {
  return {
    id: "word-phase",
    word: "phase",
    segments: ["ph", "a", "s", "e"],
    choice: {
      question_type: "no_support_assessment",
    },
    ...overrides,
  };
}

function wordWithSafeContext(overrides = {}) {
  return defaultWord({
    choice: {
      question_type: "no_support_assessment",
      context_support: {
        sentence: "The phase lasted for two weeks.",
        sentence_status: "teacher_edited",
        meaning: "A stage in a process.",
        meaning_status: "teacher_edited",
        meaning_enabled: true,
      },
    },
    ...overrides,
  });
}

function mountRuntime({
  word = defaultWord(),
  testMeta = {},
  assignmentId = "assignment-1",
  recordAttempts = true,
  presentationMode = false,
  resumeState = null,
} = {}) {
  const { mountGame, attempts, document } = loadGameHarness();
  const host = new FakeElement("div", "host", document.root);
  const progressSnapshots = [];
  const completions = [];
  mountGame({
    host,
    words: [word],
    testMeta: {
      id: "test-1",
      title: "Runtime test",
      question_type: "no_support_assessment",
      mode: "test",
      max_attempts: 1,
      delivery_model: "support_ladder",
      support_preset: "balanced",
      attempt_source: "teacher_assigned",
      audio_enabled: false,
      hints_enabled: false,
      ...testMeta,
    },
    pupilId: "pupil-1",
    assignmentId,
    recordAttempts,
    presentationMode,
    resumeState,
    onProgress: async (snapshot) => {
      progressSnapshots.push(JSON.parse(JSON.stringify(snapshot)));
    },
    onComplete: async (payload) => {
      completions.push(JSON.parse(JSON.stringify(payload)));
    },
  });
  return { host, attempts, progressSnapshots, completions };
}

async function submitFullRecall(host, answer) {
  const input = host.querySelector("#pupilAnswer");
  assert.ok(input, "full recall input should exist");
  input.value = answer;
  await host.querySelector("#btnCheck").click();
}

async function typeSegmented(host, answer) {
  for (const char of answer) {
    const controller = host.querySelector("#segmentedController");
    assert.ok(controller, "segmented controller should exist");
    await host.querySelector("#main").dispatchEvent(createEvent("beforeinput", controller, {
      data: char,
      inputType: "insertText",
    }));
  }
}

function latestProgressEntry(progressSnapshots) {
  const snapshot = progressSnapshots.at(-1);
  return snapshot?.itemStates?.[0] || null;
}

async function flushRuntimeTasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

test("legacy item does not enter support-ladder flow and keeps old retry behaviour", async () => {
  const runtime = mountRuntime({
    testMeta: {
      delivery_model: "legacy_fixed",
      max_attempts: 2,
    },
  });

  assert.equal(runtime.host.querySelector("#promptLine").textContent, "Listen and type the spelling.");
  assert.equal(runtime.host.querySelector("#supportLadderAccessWrap").style.display, "none");
  await submitFullRecall(runtime.host, "faze");

  assert.equal(runtime.attempts.length, 1);
  assert.equal(runtime.attempts[0].deliveryModel, undefined);
  assert.equal(runtime.attempts[0].supportState, undefined);
  assert.equal(runtime.host.querySelector("#promptLine").textContent, "Listen and type the spelling.");
  assert.match(runtime.host.querySelector("#feedback").innerHTML, /Try again/);
});

test("support-ladder words show the small access issue control", async () => {
  const runtime = mountRuntime();

  assert.equal(runtime.host.querySelector("#supportLadderAccessWrap").style.display, "flex");
  assert.equal(runtime.host.querySelector("#btnSupportAccessIssue").disabled, false);
  assert.match(runtime.host.innerHTML, /Need help knowing the word/i);
});

test("legacy words show optional word-identification support as one help control", async () => {
  const runtime = mountRuntime({
    word: wordWithSafeContext(),
    testMeta: {
      delivery_model: "legacy_fixed",
      max_attempts: 2,
      hints_enabled: true,
    },
  });

  assert.equal(runtime.host.querySelector("#supportLadderAccessWrap").style.display, "none");
  assert.equal(runtime.host.querySelector("#btnWordIdHelp").style.display, "inline-block");
  assert.equal(runtime.host.querySelector("#btnWordIdHelp").disabled, false);

  await runtime.host.querySelector("#btnWordIdHelp").click();

  const panel = runtime.host.querySelector("#supportLadderClarification");
  assert.equal(panel.style.display, "block");
  assert.match(panel.innerHTML, /This might help identify the word/);
  assert.doesNotMatch(panel.innerHTML, /I'm not sure which word you mean/);
  assert.match(panel.innerHTML, /The ____ lasted for two weeks/);
  assert.match(panel.innerHTML, /A stage in a process/);
  assert.equal(runtime.host.querySelector("#btnSupportStillNotSure"), null);
  assert.equal(runtime.attempts.length, 0);
});

test("support-ladder smoke assignment overrides legacy practice mode", async () => {
  const runtime = mountRuntime({
    word: defaultWord({
      choice: {
        question_type: "focus_sound",
        focus_graphemes: ["a"],
      },
    }),
    testMeta: {
      question_type: "focus_sound",
      mode: "practice",
      attempt_source: "teacher_assigned",
      evidence_source: "assigned_core",
      delivery_model: "support_ladder",
      support_preset: "balanced",
      max_attempts: 2,
    },
  });

  assert.equal(runtime.host.querySelector("#promptLine").textContent, "Listen and spell the word.");
  assert.equal(runtime.host.querySelector(".focusSoundShell"), null);
  assert.ok(runtime.host.querySelector("#pupilAnswer"), "support ladder should use independent spelling input first");
  assert.equal(runtime.host.querySelector("#supportLadderAccessWrap").style.display, "flex");

  await submitFullRecall(runtime.host, "phase");

  assert.equal(runtime.attempts.length, 1);
  assert.equal(runtime.attempts[0].deliveryModel, "support_ladder");
  assert.equal(runtime.attempts[0].supportState, "independent");
  assert.equal(runtime.attempts[0].evidenceCategory, "correct_first_time");
});

test("support-ladder first attempt correct produces correct_first_time metadata", async () => {
  const runtime = mountRuntime();

  assert.equal(runtime.host.querySelector("#promptLine").textContent, "Listen and spell the word.");
  await submitFullRecall(runtime.host, "phase");

  assert.equal(runtime.attempts[0].correct, true);
  assert.equal(runtime.attempts[0].deliveryModel, "support_ladder");
  assert.equal(runtime.attempts[0].supportState, "independent");
  assert.equal(runtime.attempts[0].evidenceCategory, "correct_first_time");

  const entry = latestProgressEntry(runtime.progressSnapshots);
  assert.equal(entry.completed, true);
  assert.equal(entry.correct, true);
  assert.equal(entry.supportPreset, "balanced");
  assert.equal(entry.supportState, "independent");
  assert.equal(entry.evidenceCategory, "correct_first_time");
});

test("safe clarification shows masked sentence and meaning without logging an attempt", async () => {
  const runtime = mountRuntime({ word: wordWithSafeContext() });

  await runtime.host.querySelector("#btnSupportAccessIssue").click();
  await flushRuntimeTasks();

  const panel = runtime.host.querySelector("#supportLadderClarification");
  assert.equal(panel.style.display, "block");
  assert.match(panel.innerHTML, /This might help identify the word/);
  assert.doesNotMatch(panel.innerHTML, /I'm not sure which word you mean/);
  assert.match(panel.innerHTML, /Sentence:/);
  assert.match(panel.innerHTML, /The ____ lasted for two weeks/);
  assert.match(panel.innerHTML, /Meaning:/);
  assert.match(panel.innerHTML, /A stage in a process/);
  assert.doesNotMatch(panel.innerHTML, /\bphase\b/i);
  assert.equal(runtime.attempts.length, 0);

  const entry = latestProgressEntry(runtime.progressSnapshots);
  assert.equal(entry.completed, false);
  assert.equal(entry.supportLadderState.clarificationShown, true);
  assert.deepEqual(entry.supportActions, ["clarification_sentence", "meaning"]);
});

test("try spelling returns to the current input mode after clarification", async () => {
  const runtime = mountRuntime({ word: wordWithSafeContext() });

  await runtime.host.querySelector("#btnSupportAccessIssue").click();
  await runtime.host.querySelector("#btnSupportTrySpelling").click();

  assert.equal(runtime.host.querySelector("#supportLadderClarification").style.display, "none");
  assert.equal(runtime.host.querySelector("#pupilAnswer").focused, true);
  assert.ok(runtime.host.querySelector("#pupilAnswer"), "full recall input should remain active");
});

test("correct after clarification remains independent spelling evidence", async () => {
  const runtime = mountRuntime({ word: wordWithSafeContext() });

  await runtime.host.querySelector("#btnSupportAccessIssue").click();
  await flushRuntimeTasks();
  await submitFullRecall(runtime.host, "phase");

  assert.equal(runtime.attempts.length, 1);
  assert.equal(runtime.attempts[0].correct, true);
  assert.equal(runtime.attempts[0].supportState, "independent");
  assert.equal(runtime.attempts[0].evidenceCategory, "correct_first_time");
  assert.deepEqual(runtime.attempts[0].supportActions, ["clarification_sentence", "meaning"]);

  const entry = latestProgressEntry(runtime.progressSnapshots);
  assert.equal(entry.completed, true);
  assert.equal(entry.correct, true);
  assert.equal(entry.evidenceCategory, "correct_first_time");
  assert.equal(entry.supportState, "independent");
  assert.equal(entry.supportLadderState.clarificationShown, true);
  assert.deepEqual(entry.supportActions, ["clarification_sentence", "meaning"]);
});

test("retry correct after clarification remains retry spelling evidence", async () => {
  const runtime = mountRuntime({ word: wordWithSafeContext() });

  await submitFullRecall(runtime.host, "faze");
  await runtime.host.querySelector("#btnSupportAccessIssue").click();
  await flushRuntimeTasks();
  await submitFullRecall(runtime.host, "phase");

  assert.equal(runtime.attempts.length, 2);
  assert.equal(runtime.attempts[1].correct, true);
  assert.equal(runtime.attempts[1].supportState, "retry");
  assert.equal(runtime.attempts[1].evidenceCategory, "correct_after_retry");
  assert.deepEqual(runtime.attempts[1].supportActions, ["clarification_sentence", "meaning"]);

  const entry = latestProgressEntry(runtime.progressSnapshots);
  assert.equal(entry.completed, true);
  assert.equal(entry.correct, true);
  assert.equal(entry.supportState, "retry");
  assert.equal(entry.evidenceCategory, "correct_after_retry");
  assert.deepEqual(entry.supportActions, ["clarification_sentence", "meaning"]);
});

test("unsafe clarification content is blocked and records no support action", async () => {
  const runtime = mountRuntime({
    word: wordWithSafeContext({
      id: "word-fatherly",
      word: "fatherly",
      segments: ["f", "a", "th", "er", "l", "y"],
      choice: {
        question_type: "no_support_assessment",
        context_support: {
          sentence: "He gave father advice before the trip.",
          sentence_status: "teacher_edited",
          meaning: "Kind and caring like a father.",
          meaning_status: "teacher_edited",
          meaning_enabled: true,
        },
      },
    }),
  });

  await runtime.host.querySelector("#btnSupportAccessIssue").click();
  await flushRuntimeTasks();

  const panel = runtime.host.querySelector("#supportLadderClarification");
  assert.match(panel.innerHTML, /There isn't a safe clue/);
  assert.doesNotMatch(panel.innerHTML, /fatherly/i);
  assert.doesNotMatch(panel.innerHTML, /like a father/i);
  assert.equal(runtime.attempts.length, 0);
  assert.equal(latestProgressEntry(runtime.progressSnapshots), null);
});

test("still not sure completes an access issue without revealing spelling", async () => {
  const runtime = mountRuntime({ word: wordWithSafeContext() });

  await runtime.host.querySelector("#btnSupportAccessIssue").click();
  await flushRuntimeTasks();
  await runtime.host.querySelector("#btnSupportStillNotSure").click();
  await flushRuntimeTasks();

  assert.equal(runtime.attempts.length, 1);
  assert.equal(runtime.attempts[0].typed, "");
  assert.equal(runtime.attempts[0].correct, null);
  assert.equal(runtime.attempts[0].supportState, "access_issue");
  assert.equal(runtime.attempts[0].evidenceCategory, "access_issue");
  assert.deepEqual(runtime.attempts[0].supportActions, ["clarification_sentence", "meaning"]);

  const entry = latestProgressEntry(runtime.progressSnapshots);
  assert.equal(entry.completed, true);
  assert.equal(entry.typed, "");
  assert.equal(entry.correct, null);
  assert.equal(entry.supportState, "access_issue");
  assert.equal(entry.evidenceCategory, "access_issue");
  assert.deepEqual(entry.supportActions, ["clarification_sentence", "meaning"]);
  assert.match(runtime.host.querySelector("#feedback").innerHTML, /word-meaning issue/);
  assert.doesNotMatch(runtime.host.querySelector("#feedback").innerHTML, /The correct spelling is/);
  assert.equal(runtime.host.querySelector("#btnNext").style.display, "inline-block");
});

test("resume after clarification restores panel without duplicate actions", async () => {
  const word = wordWithSafeContext();
  const firstRuntime = mountRuntime({ word });

  await firstRuntime.host.querySelector("#btnSupportAccessIssue").click();
  await flushRuntimeTasks();
  const resumeState = firstRuntime.progressSnapshots.at(-1);
  assert.ok(resumeState, "clarification progress should be saved");

  const resumedRuntime = mountRuntime({ word, resumeState });
  assert.equal(resumedRuntime.attempts.length, 0);
  assert.equal(resumedRuntime.host.querySelector("#supportLadderClarification").style.display, "block");
  assert.match(resumedRuntime.host.querySelector("#supportLadderClarification").innerHTML, /A stage in a process/);

  await resumedRuntime.host.querySelector("#btnSupportAccessIssue").click();
  await flushRuntimeTasks();

  const entry = latestProgressEntry(resumedRuntime.progressSnapshots);
  assert.equal(entry.supportLadderState.clarificationShown, true);
  assert.deepEqual(entry.supportActions, ["clarification_sentence", "meaning"]);
});

test("support-ladder first incorrect attempt advances to retry instead of finishing", async () => {
  const runtime = mountRuntime();

  await submitFullRecall(runtime.host, "faze");

  assert.equal(runtime.attempts[0].correct, false);
  assert.equal(runtime.attempts[0].supportState, "independent");
  assert.equal(runtime.attempts[0].evidenceCategory, null);
  assert.equal(runtime.host.querySelector("#promptLine").textContent, "Not quite. Try once more.");
  assert.equal(runtime.host.querySelector("#pupilAnswer").value, "");
  assert.equal(runtime.host.querySelector("#btnNext").style.display, "none");
  assert.equal(runtime.host.querySelector("#supportLadderAccessWrap").style.display, "flex");

  const entry = latestProgressEntry(runtime.progressSnapshots);
  assert.equal(entry.completed, false);
  assert.equal(entry.supportState, "retry");
  assert.equal(entry.supportLadderState.phase, "retry");
  assert.equal(entry.lastSubmittedIncorrectAnswer, "faze");
});

test("support-ladder retry correct produces correct_after_retry", async () => {
  const runtime = mountRuntime();

  await submitFullRecall(runtime.host, "faze");
  await submitFullRecall(runtime.host, "phase");

  assert.equal(runtime.attempts.length, 2);
  assert.equal(runtime.attempts[1].correct, true);
  assert.equal(runtime.attempts[1].supportState, "retry");
  assert.equal(runtime.attempts[1].evidenceCategory, "correct_after_retry");

  const entry = latestProgressEntry(runtime.progressSnapshots);
  assert.equal(entry.completed, true);
  assert.equal(entry.correct, true);
  assert.equal(entry.supportState, "retry");
  assert.equal(entry.evidenceCategory, "correct_after_retry");
});

test("support-ladder retry incorrect advances to supported instead of finishing", async () => {
  const runtime = mountRuntime();

  await submitFullRecall(runtime.host, "faze");
  await submitFullRecall(runtime.host, "faize");

  assert.equal(runtime.attempts.length, 2);
  assert.equal(runtime.attempts[1].correct, false);
  assert.equal(runtime.attempts[1].supportState, "retry");
  assert.equal(runtime.attempts[1].evidenceCategory, null);
  assert.equal(runtime.host.querySelector("#promptLine").textContent, "Use the boxes to help spell the word.");
  assert.ok(runtime.host.querySelector("#segmentedController"));
  assert.equal(runtime.host.querySelector("#supportLadderAccessWrap").style.display, "flex");

  const entry = latestProgressEntry(runtime.progressSnapshots);
  assert.equal(entry.completed, false);
  assert.equal(entry.supportState, "supported");
  assert.deepEqual(entry.supportActions, ["segmented_input"]);
});

test("support-ladder supported correct records segmented_input and correct_with_support", async () => {
  const runtime = mountRuntime();

  await submitFullRecall(runtime.host, "faze");
  await submitFullRecall(runtime.host, "faize");
  await typeSegmented(runtime.host, "phase");
  await runtime.host.querySelector("#btnCheck").click();

  assert.equal(runtime.attempts.length, 3);
  assert.equal(runtime.attempts[2].correct, true);
  assert.equal(runtime.attempts[2].supportState, "supported");
  assert.equal(runtime.attempts[2].evidenceCategory, "correct_with_support");
  assert.deepEqual(runtime.attempts[2].supportActions, ["segmented_input"]);

  const entry = latestProgressEntry(runtime.progressSnapshots);
  assert.equal(entry.completed, true);
  assert.equal(entry.correct, true);
  assert.equal(entry.supportState, "supported");
  assert.equal(entry.evidenceCategory, "correct_with_support");
  assert.deepEqual(entry.supportActions, ["segmented_input"]);
});

test("support-ladder supported incorrect produces incorrect_with_support", async () => {
  const runtime = mountRuntime();

  await submitFullRecall(runtime.host, "faze");
  await submitFullRecall(runtime.host, "faize");
  await typeSegmented(runtime.host, "phaze");
  await runtime.host.querySelector("#btnCheck").click();

  assert.equal(runtime.attempts[2].correct, false);
  assert.equal(runtime.attempts[2].supportState, "supported");
  assert.equal(runtime.attempts[2].evidenceCategory, "incorrect_with_support");
  assert.deepEqual(runtime.attempts[2].supportActions, ["segmented_input"]);
  assert.match(runtime.host.querySelector("#feedback").innerHTML, /gameCorrectSpellingReveal/);
  assert.match(runtime.host.querySelector("#feedback").innerHTML, /The correct spelling is/);
  assert.match(runtime.host.querySelector("#feedback").innerHTML, /Look carefully before moving on/);

  const entry = latestProgressEntry(runtime.progressSnapshots);
  assert.equal(entry.completed, true);
  assert.equal(entry.correct, false);
  assert.equal(entry.evidenceCategory, "incorrect_with_support");
  assert.doesNotMatch(JSON.stringify({ attempts: runtime.attempts, entry }), /access_issue/);
});

test("legacy final incorrect behaviour still follows old max-attempt reveal", async () => {
  const runtime = mountRuntime({
    testMeta: {
      delivery_model: "legacy_fixed",
      max_attempts: 2,
    },
  });

  await submitFullRecall(runtime.host, "faze");
  await submitFullRecall(runtime.host, "faize");

  assert.equal(runtime.attempts.length, 2);
  assert.equal(runtime.attempts.some((attempt) => attempt.deliveryModel === "support_ladder"), false);
  assert.equal(latestProgressEntry(runtime.progressSnapshots).completed, true);
  assert.match(runtime.host.querySelector("#feedback").innerHTML, /The correct spelling is/);
  assert.match(runtime.host.querySelector("#feedback").innerHTML, /gameCorrectSpellingReveal/);
});

test("baseline, practice, sample, and Spelling Bee contexts do not enter ladder flow", async () => {
  const cases = [
    { name: "baseline", testMeta: { attempt_source: "baseline", max_attempts: 1 } },
    { name: "practice", testMeta: { mode: "practice", attempt_source: "practice", delivery_model: "support_ladder", support_preset: "balanced", max_attempts: 1 } },
    { name: "learn source", testMeta: { mode: "learn", attempt_source: "learn", delivery_model: "support_ladder", support_preset: "balanced", max_attempts: 1 } },
    { name: "extra challenge", testMeta: { mode: "test", attempt_source: "extra_challenge", evidence_source: "extra_challenge", max_attempts: 1 } },
    { name: "presenter", testMeta: { mode: "presentation", attempt_source: "presentation", max_attempts: 1 } },
    { name: "sample", testMeta: { sample_mode: true, max_attempts: 1 }, assignmentId: null, recordAttempts: false },
    { name: "spelling bee", testMeta: { competition_mode: "spelling_bee", spelling_bee: true, max_attempts: 1 } },
  ];

  for (const entry of cases) {
    const runtime = mountRuntime(entry);
    assert.notEqual(runtime.host.querySelector("#promptLine").textContent, "Listen and spell the word.", entry.name);
    assert.equal(runtime.host.querySelector("#supportLadderAccessWrap").style.display, "none", entry.name);
    if (runtime.host.querySelector("#pupilAnswer")) {
      await submitFullRecall(runtime.host, "faze");
    }
    assert.equal(runtime.attempts.some((attempt) => attempt.deliveryModel === "support_ladder"), false, entry.name);
  }
});
