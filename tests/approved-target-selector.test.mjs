import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  APPROVED_TARGET_SELECTOR_STATUS_NOT_ENOUGH_WORDS,
  APPROVED_TARGET_SELECTOR_STATUS_READY,
  buildGeneratedAssignmentPlan,
  selectApprovedTargetWords,
} = await loadBrowserModule("../js/assignmentEngine.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function wordRow({
  id,
  word,
  score,
  focus = ["ph"],
  segments = ["ph"],
  source = "teacher",
  suitability,
  band,
  sentence = "",
} = {}) {
  return {
    id,
    word,
    sentence,
    segments,
    choice: {
      source,
      focus_graphemes: focus,
      selection_suitability: suitability,
      difficulty: {
        coreScore: score,
        score,
        band,
      },
    },
  };
}

function words(result) {
  return (result.words || []).map((item) => item.word);
}

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

test("same grapheme selects different difficulty-fit words for support, secure, and stretch", () => {
  const candidates = [
    wordRow({ id: "1", word: "photo", score: 32, sentence: "Take a photo." }),
    wordRow({ id: "2", word: "phrase", score: 48, sentence: "Read the phrase." }),
    wordRow({ id: "3", word: "graph", score: 64, sentence: "Draw a graph." }),
  ];

  assertJsonEqual(words(selectApprovedTargetWords({
    focusGrapheme: "ph",
    candidates,
    challengeLevel: "needs_support",
    count: 1,
  })), ["photo"]);
  assertJsonEqual(words(selectApprovedTargetWords({
    focusGrapheme: "ph",
    candidates,
    challengeLevel: "secure_expected",
    count: 1,
  })), ["phrase"]);
  assertJsonEqual(words(selectApprovedTargetWords({
    focusGrapheme: "ph",
    candidates,
    challengeLevel: "early_stretch",
    count: 1,
  })), ["graph"]);
});

test("focus grapheme metadata outranks incidental segment matches", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [
      wordRow({ id: "1", word: "alpha", score: 30, focus: ["a"], segments: ["a", "l", "ph", "a"] }),
      wordRow({ id: "2", word: "phone", score: 30, focus: ["ph"], segments: ["ph", "o", "n", "e"] }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_READY);
  assertJsonEqual(words(result), ["phone"]);
});

test("exclude is never selected and caution is skipped for automated targeting", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [
      wordRow({ id: "1", word: "photo", score: 30, suitability: "exclude" }),
      wordRow({ id: "2", word: "phone", score: 31, suitability: "caution" }),
      wordRow({ id: "3", word: "phase", score: 32, suitability: "standard" }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_READY);
  assertJsonEqual(words(result), ["phase"]);
});

test("missing suitability defaults to standard for teacher approved rows", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [
      wordRow({ id: "1", word: "phone", score: 30, suitability: undefined }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_READY);
  assertJsonEqual(words(result), ["phone"]);
});

test("non-teacher source is not selected even with matching grapheme and difficulty", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [
      wordRow({ id: "1", word: "phone", score: 30, source: "assignment_engine_pool" }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_NOT_ENOUGH_WORDS);
  assertJsonEqual(words(result), []);
});

test("ideal window is preferred before widened window and widening is reported", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 2,
    candidates: [
      wordRow({ id: "1", word: "photo", score: 32 }),
      wordRow({ id: "2", word: "phrase", score: 50 }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_READY);
  assert.equal(result.widened, true);
  assertJsonEqual(result.window, {
    min: 5,
    max: 50,
    center: 30,
    hardMax: 50,
    widened: true,
  });
  assertJsonEqual(words(result), ["photo", "phrase"]);
});

test("widening happens once and respects hard max", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [
      wordRow({ id: "1", word: "phantom", score: 51 }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_NOT_ENOUGH_WORDS);
  assertJsonEqual(words(result), []);
  assert.equal(result.window.max, 50);
});

test("support and secure selections do not receive challenge-band words", () => {
  const supportResult = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [
      wordRow({ id: "1", word: "phone", score: 48, band: "challenge" }),
    ],
  });
  const secureResult = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "secure_expected",
    count: 1,
    candidates: [
      wordRow({ id: "1", word: "phrase", score: 48, band: "challenge" }),
    ],
  });

  assert.equal(supportResult.status, APPROVED_TARGET_SELECTOR_STATUS_NOT_ENOUGH_WORDS);
  assert.equal(secureResult.status, APPROVED_TARGET_SELECTOR_STATUS_NOT_ENOUGH_WORDS);
});

test("insufficient approved words returns not_enough_approved_words without fallback", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "early_stretch",
    count: 2,
    candidates: [
      wordRow({ id: "1", word: "graph", score: 64 }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_NOT_ENOUGH_WORDS);
  assertJsonEqual(words(result), []);
  assert.equal(result.availableCount, 1);
});

test("ordering is stable by normalized word then id when ranking factors tie", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 2,
    candidates: [
      wordRow({ id: "b", word: "phase", score: 30 }),
      wordRow({ id: "a", word: "phone", score: 30 }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_READY);
  assertJsonEqual(words(result), ["phase", "phone"]);
});

test("generated assignment target section uses approved selector and skips non-approved same-grapheme words", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        wordRow({ id: "review-1", word: "rain", score: 24, focus: ["ai"], segments: ["r", "ai", "n"] }),
        wordRow({ id: "review-2", word: "seed", score: 24, focus: ["ee"], segments: ["s", "ee", "d"] }),
        wordRow({ id: "stretch-1", word: "storm", score: 36, focus: ["or"], segments: ["s", "t", "or", "m"] }),
        wordRow({ id: "target-1", word: "phone", score: 30, focus: ["ph"], segments: ["ph", "o", "n", "e"] }),
        wordRow({ id: "target-2", word: "phase", score: 30, focus: ["ph"], segments: ["ph", "a", "s", "e"], source: "assignment_engine_pool" }),
      ],
    }],
    attempts: [],
    totalWords: 2,
    currentProfiles: {
      "pupil-1": {
        concernRows: [{ target: "ph", total: 2 }],
        secureRows: [],
        developingRows: [],
        confusionByTarget: new Map(),
        placementMeta: { targetChallengeLevel: "needs_support" },
      },
    },
  });

  assert.equal(plan.error, "");
  const targetWords = plan.pupilPlans[0].words
    .filter((item) => item.assignmentRole === "target")
    .map((item) => item.word);
  assertJsonEqual(targetWords, ["phone"]);
});

test("generated assignment does not fall back when approved target bank is insufficient", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        wordRow({ id: "review-1", word: "rain", score: 24, focus: ["ai"], segments: ["r", "ai", "n"] }),
        wordRow({ id: "target-1", word: "phase", score: 30, focus: ["ph"], segments: ["ph", "a", "s", "e"], source: "assignment_engine_pool" }),
      ],
    }],
    attempts: [],
    totalWords: 2,
    currentProfiles: {
      "pupil-1": {
        concernRows: [{ target: "ph", total: 2 }],
        secureRows: [],
        developingRows: [],
        confusionByTarget: new Map(),
        placementMeta: { targetChallengeLevel: "needs_support" },
      },
    },
  });

  assert.equal(plan.pupilPlans.length, 0);
  assert.equal(plan.error, "Not enough saved words are available for ph.");
});

let failureCount = 0;

for (const entry of TESTS) {
  try {
    await entry.fn();
    console.log(`ok - ${entry.name}`);
  } catch (error) {
    failureCount += 1;
    console.error(`not ok - ${entry.name}`);
    console.error(error);
  }
}

if (failureCount > 0) {
  process.exitCode = 1;
} else {
  console.log(`all ${TESTS.length} approved target selector checks passed`);
}
