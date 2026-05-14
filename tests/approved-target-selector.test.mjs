import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  APPROVED_TARGET_SELECTOR_STATUS_NOT_ENOUGH_WORDS,
  APPROVED_TARGET_SELECTOR_STATUS_READY,
  buildAssignmentEngineWordPayload,
  buildGeneratedAssignmentPlan,
  selectApprovedTargetWords,
} = await loadBrowserModule("../js/assignmentEngine.js", import.meta.url);
const {
  buildBaselineAssignmentDefinition,
  buildPlacementSeedProfiles,
} = await loadBrowserModule("../js/baselinePlacement.js", import.meta.url);

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
  suitabilityStatus,
  approvalStatus,
  active,
  targetLinks,
  band,
  sentence = "",
  meaning = "",
} = {}) {
  const choice = {
    source,
    focus_graphemes: focus,
    selection_suitability: suitability,
    difficulty: {
      coreScore: score,
      score,
      band,
    },
  };
  if (suitabilityStatus !== undefined) choice.suitability_status = suitabilityStatus;
  if (approvalStatus !== undefined) choice.approval_status = approvalStatus;
  if (active !== undefined) choice.is_active = active;
  if (source === "wordloom_core") {
    choice.origin_word_source = "wordloom_core";
    choice.origin_bank_word_id = `core-${id}`;
    choice.focus_target_links = targetLinks === undefined
      ? focus.map((item) => ({ focus_grapheme: item, target_role: "primary" }))
      : targetLinks;
    choice.context_support = {
      sentence,
      meaning,
      sentence_status: "approved",
      meaning_status: "approved",
      meaning_enabled: !!meaning,
    };
  }

  return {
    id,
    word,
    sentence,
    segments,
    choice,
  };
}

function words(result) {
  return (result.words || []).map((item) => item.word);
}

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

function makeBaselineRows() {
  return buildBaselineAssignmentDefinition({ date: new Date("2026-04-17T09:00:00Z") })
    .wordRows
    .map((row, index) => ({
      ...row,
      id: `baseline-word-${index + 1}`,
    }));
}

function makeBaselineAttempts(rows, correctWords = new Set()) {
  return rows.map((row, index) => ({
    pupil_id: "pupil-1",
    assignment_id: "baseline-1",
    test_word_id: row.id,
    word_text: row.word,
    correct: correctWords.has(row.word),
    attempt_number: 1,
    mode: row?.choice?.question_type || "segmented_spelling",
    focus_grapheme: row?.choice?.focus_graphemes?.[0] || "",
    target_graphemes: Array.isArray(row?.segments) ? row.segments : [],
    attempt_source: "baseline",
    created_at: new Date(Date.UTC(2026, 3, 17, 10, index)).toISOString(),
  }));
}

function usageAttempt({
  pupilId = "pupil-1",
  word,
  correct = true,
  attemptNumber = 1,
  focus = "ph",
  segments = null,
  createdAt = "2026-05-01T10:00:00.000Z",
} = {}) {
  return {
    pupil_id: pupilId,
    assignment_id: `${pupilId}-assignment`,
    test_word_id: `${pupilId}-${word}`,
    word_text: word,
    correct,
    attempt_number: attemptNumber,
    mode: "no_support_assessment",
    focus_grapheme: focus,
    target_graphemes: Array.isArray(segments) ? segments : [focus],
    attempt_source: "auto_assigned",
    created_at: createdAt,
  };
}

function usageAwareProfile() {
  return {
    concernRows: [{ target: "ph", total: 3, securityBand: "insecure" }],
    secureRows: [{ target: "ai", total: 4, securityBand: "secure" }],
    developingRows: [{ target: "or", total: 3, securityBand: "nearly_secure" }],
    confusionByTarget: new Map(),
    placementMeta: { targetChallengeLevel: "needs_support" },
  };
}

function usageAwareTeacherTests({ includePhase = true } = {}) {
  return [{
    test_words: [
      wordRow({ id: "review-rain", word: "rain", score: 24, focus: ["ai"], segments: ["r", "ai", "n"] }),
      wordRow({ id: "review-train", word: "train", score: 25, focus: ["ai"], segments: ["t", "r", "ai", "n"] }),
      wordRow({ id: "stretch-storm", word: "storm", score: 58, focus: ["or"], segments: ["s", "t", "or", "m"] }),
      wordRow({ id: "target-phone", word: "phone", score: 30, focus: ["ph"], segments: ["ph", "o", "n", "e"] }),
      ...(includePhase
        ? [wordRow({ id: "target-phase", word: "phase", score: 30, focus: ["ph"], segments: ["ph", "a", "s", "e"] })]
        : []),
    ],
  }];
}

function targetWordsFor(plan, pupilId = "pupil-1") {
  const pupilPlan = (plan.pupilPlans || []).find((item) => item.pupilId === pupilId);
  return (pupilPlan?.words || [])
    .filter((item) => item.assignmentRole === "target")
    .map((item) => item.word);
}

function stretchWordsFor(plan, pupilId = "pupil-1") {
  const pupilPlan = (plan.pupilPlans || []).find((item) => item.pupilId === pupilId);
  return (pupilPlan?.words || [])
    .filter((item) => item.assignmentRole === "stretch");
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

test("generated runtime source is not selected as an approved source candidate", () => {
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

test("incorrect or review-due usage outranks source priority", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    usageByWord: new Map([
      ["phase", { count: 2, incorrectCount: 2, lastSeenAt: 1000, reviewDue: true }],
      ["phone", { count: 1, incorrectCount: 0, lastSeenAt: 2000, recentlySeen: true, recentlySecure: true }],
    ]),
    candidates: [
      wordRow({ id: "teacher-1", word: "phase", score: 30, source: "teacher" }),
      wordRow({
        id: "core-1",
        word: "phone",
        score: 30,
        source: "wordloom_core",
        approvalStatus: "approved",
        suitabilityStatus: "suitable",
      }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_READY);
  assertJsonEqual(words(result), ["phase"]);
});

test("neutral wordloom core source is selected before legacy teacher rows", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [
      wordRow({ id: "teacher-1", word: "phase", score: 30, source: "teacher" }),
      wordRow({
        id: "core-1",
        word: "phone",
        score: 30,
        source: "wordloom_core",
        approvalStatus: "approved",
        suitabilityStatus: "suitable",
      }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_READY);
  assertJsonEqual(words(result), ["phone"]);
});

test("legacy teacher rows fill only when core rows are insufficient", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 2,
    candidates: [
      wordRow({
        id: "core-1",
        word: "phone",
        score: 30,
        source: "wordloom_core",
        approvalStatus: "approved",
        suitabilityStatus: "suitable",
      }),
      wordRow({ id: "teacher-1", word: "phase", score: 31, source: "teacher" }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_READY);
  assertJsonEqual(words(result), ["phone", "phase"]);
});

test("wordloom core rows require active approved suitable status and target links", () => {
  const result = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [
      wordRow({ id: "pending", word: "phone", score: 30, source: "wordloom_core", approvalStatus: "pending", suitabilityStatus: "suitable" }),
      wordRow({ id: "rejected", word: "photo", score: 30, source: "wordloom_core", approvalStatus: "rejected", suitabilityStatus: "suitable" }),
      wordRow({ id: "retired", word: "phrase", score: 30, source: "wordloom_core", approvalStatus: "retired", suitabilityStatus: "suitable" }),
      wordRow({ id: "inactive", word: "graph", score: 30, source: "wordloom_core", approvalStatus: "approved", suitabilityStatus: "suitable", active: false }),
      wordRow({ id: "caution", word: "phantom", score: 30, source: "wordloom_core", approvalStatus: "approved", suitabilityStatus: "caution" }),
      wordRow({ id: "exclude", word: "sphere", score: 30, source: "wordloom_core", approvalStatus: "approved", suitabilityStatus: "exclude" }),
      wordRow({
        id: "incidental",
        word: "alpha",
        score: 30,
        source: "wordloom_core",
        focus: ["a"],
        segments: ["a", "l", "ph", "a"],
        approvalStatus: "approved",
        suitabilityStatus: "suitable",
        targetLinks: [{ focus_grapheme: "a", target_role: "primary" }],
      }),
      wordRow({
        id: "approved",
        word: "phonics",
        score: 30,
        source: "wordloom_core",
        approvalStatus: "approved",
        suitabilityStatus: "suitable",
      }),
    ],
  });

  assert.equal(result.status, APPROVED_TARGET_SELECTOR_STATUS_READY);
  assertJsonEqual(words(result), ["phonics"]);
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

test("ordering is stable by normalised word then id when ranking factors tie", () => {
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

test("generated assignment avoids recently secure approved words when equivalent alternatives exist", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: usageAwareTeacherTests(),
    attempts: [
      usageAttempt({
        word: "phone",
        correct: true,
        attemptNumber: 1,
        segments: ["ph", "o", "n", "e"],
      }),
    ],
    totalWords: 4,
    currentProfiles: {
      "pupil-1": usageAwareProfile(),
    },
  });

  assert.equal(plan.error, "");
  assertJsonEqual(targetWordsFor(plan), ["phase"]);
});

test("generated assignment prefers previously incorrect words within the same source and window", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: usageAwareTeacherTests(),
    attempts: [
      usageAttempt({
        word: "phone",
        correct: false,
        attemptNumber: 2,
        segments: ["ph", "o", "n", "e"],
      }),
    ],
    totalWords: 4,
    currentProfiles: {
      "pupil-1": usageAwareProfile(),
    },
  });

  assert.equal(plan.error, "");
  assertJsonEqual(targetWordsFor(plan), ["phone"]);
});

test("recently secure words are reduced in priority but remain eligible as fallback", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: usageAwareTeacherTests({ includePhase: false }),
    attempts: [
      usageAttempt({
        word: "phone",
        correct: true,
        attemptNumber: 1,
        segments: ["ph", "o", "n", "e"],
      }),
    ],
    totalWords: 4,
    currentProfiles: {
      "pupil-1": usageAwareProfile(),
    },
  });

  assert.equal(plan.error, "");
  assertJsonEqual(targetWordsFor(plan), ["phone"]);
});

test("multi-pupil generated assignment uses pupil-specific word usage history", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1", "pupil-2"],
    teacherTests: usageAwareTeacherTests(),
    attempts: [
      usageAttempt({
        pupilId: "pupil-1",
        word: "phone",
        correct: true,
        attemptNumber: 1,
        segments: ["ph", "o", "n", "e"],
        createdAt: "2026-05-01T10:00:00.000Z",
      }),
      usageAttempt({
        pupilId: "pupil-2",
        word: "phase",
        correct: true,
        attemptNumber: 1,
        segments: ["ph", "a", "s", "e"],
        createdAt: "2026-05-01T10:01:00.000Z",
      }),
    ],
    totalWords: 4,
    currentProfiles: {
      "pupil-1": usageAwareProfile(),
      "pupil-2": usageAwareProfile(),
    },
  });

  assert.equal(plan.error, "");
  assertJsonEqual(targetWordsFor(plan, "pupil-1"), ["phase"]);
  assertJsonEqual(targetWordsFor(plan, "pupil-2"), ["phone"]);
  for (const pupilPlan of plan.pupilPlans) {
    const selectedWords = pupilPlan.words.map((item) => item.word);
    assert.equal(new Set(selectedWords).size, selectedWords.length);
  }
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

test("generated assignment uses partial primary target coverage and fills safely with warnings", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        wordRow({ id: "review-ai-1", word: "rain", score: 24, focus: ["ai"], segments: ["r", "ai", "n"] }),
        wordRow({ id: "review-ai-2", word: "train", score: 25, focus: ["ai"], segments: ["t", "r", "ai", "n"] }),
        wordRow({ id: "review-ai-3", word: "paint", score: 26, focus: ["ai"], segments: ["p", "ai", "n", "t"] }),
        wordRow({ id: "review-ee-1", word: "seed", score: 24, focus: ["ee"], segments: ["s", "ee", "d"] }),
        wordRow({ id: "review-ee-2", word: "green", score: 25, focus: ["ee"], segments: ["g", "r", "ee", "n"] }),
        wordRow({ id: "review-ee-3", word: "sleep", score: 26, focus: ["ee"], segments: ["s", "l", "ee", "p"] }),
        wordRow({ id: "stretch-or-1", word: "storm", score: 58, focus: ["or"], segments: ["s", "t", "or", "m"] }),
        wordRow({ id: "stretch-or-2", word: "short", score: 60, focus: ["or"], segments: ["sh", "or", "t"] }),
        wordRow({ id: "target-ph-1", word: "phone", score: 30, focus: ["ph"], segments: ["ph", "o", "n", "e"] }),
        wordRow({ id: "target-sh-1", word: "shell", score: 31, focus: ["sh"], segments: ["sh", "e", "ll"] }),
        wordRow({ id: "generated-ph", word: "phase", score: 30, focus: ["ph"], segments: ["ph", "a", "s", "e"], source: "assignment_engine_pool" }),
        wordRow({ id: "pending-ph", word: "photo", score: 31, focus: ["ph"], segments: ["ph", "o", "t", "o"], approvalStatus: "pending" }),
        wordRow({ id: "blocked-ph", word: "graph", score: 32, focus: ["ph"], segments: ["g", "r", "a", "ph"], suitability: "blocked" }),
        wordRow({ id: "unsuitable-ph", word: "phantom", score: 33, focus: ["ph"], segments: ["ph", "a", "n", "t", "o", "m"], suitabilityStatus: "unsuitable" }),
        wordRow({ id: "inactive-ph", word: "sphere", score: 34, focus: ["ph"], segments: ["s", "ph", "ere"], active: false }),
      ],
    }],
    attempts: [],
    totalWords: 10,
    currentProfiles: {
      "pupil-1": {
        concernRows: [
          { target: "ph", total: 4, securityBand: "insecure" },
          { target: "sh", total: 3, securityBand: "insecure" },
        ],
        secureRows: [
          { target: "ai", total: 4, securityBand: "secure" },
          { target: "ee", total: 4, securityBand: "secure" },
        ],
        developingRows: [{ target: "or", total: 3, securityBand: "nearly_secure" }],
        confusionByTarget: new Map(),
        placementMeta: { targetChallengeLevel: "needs_support" },
      },
    },
  });

  assert.equal(plan.error, "");
  assert.equal(plan.coverageWarnings.length, 1);
  assertJsonEqual(plan.coverageWarnings[0], {
    type: "target_coverage_low",
    pupilId: "pupil-1",
    focusGrapheme: "ph",
    requestedTargetCount: 4,
    selectedTargetCount: 1,
    fallbackCount: 3,
    message: "Only 1 of 4 requested target slots could use approved ph words; 3 slots will use safe fallback, review, or consolidation words.",
  });

  const pupilPlan = plan.pupilPlans[0];
  const pupilWords = pupilPlan?.words || [];
  assert.equal(pupilPlan.coverageWarnings.length, 1);
  assert.equal(pupilWords.length, 10);
  assert.equal(new Set(pupilWords.map((item) => item.word)).size, pupilWords.length);

  const selectedWords = pupilWords.map((item) => item.word);
  assert.equal(selectedWords.includes("phone"), true);
  assert.equal(selectedWords.includes("shell"), true);
  for (const blocked of ["phase", "photo", "graph", "phantom", "sphere"]) {
    assert.equal(selectedWords.includes(blocked), false, `${blocked} should not be selected`);
  }

  const targetWords = pupilWords
    .filter((item) => item.assignmentRole === "target")
    .map((item) => item.word);
  assertJsonEqual(targetWords, ["phone", "shell"]);
});

test("generated assignment can use wordloom core ar bank with no teacher test_words", () => {
  const core = (data) => wordRow({
    source: "wordloom_core",
    approvalStatus: "approved",
    suitabilityStatus: "suitable",
    sentence: `${data.word} sentence.`,
    meaning: `${data.word} meaning.`,
    ...data,
  });
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        core({ id: "ai-1", word: "rain", score: 24, focus: ["ai"], segments: ["r", "ai", "n"] }),
        core({ id: "ai-2", word: "train", score: 25, focus: ["ai"], segments: ["t", "r", "ai", "n"] }),
        core({ id: "ai-3", word: "paint", score: 26, focus: ["ai"], segments: ["p", "ai", "n", "t"] }),
        core({ id: "ai-4", word: "snail", score: 27, focus: ["ai"], segments: ["s", "n", "ai", "l"] }),
        core({ id: "ar-1", word: "farm", score: 34, focus: ["ar"], segments: ["f", "ar", "m"] }),
        core({ id: "ar-2", word: "sharp", score: 38, focus: ["ar"], segments: ["sh", "ar", "p"] }),
        core({ id: "ar-3", word: "start", score: 42, focus: ["ar"], segments: ["s", "t", "ar", "t"] }),
        core({ id: "ar-4", word: "garden", score: 46, focus: ["ar"], segments: ["g", "ar", "d", "e", "n"] }),
        core({ id: "or-1", word: "storm", score: 58, focus: ["or"], segments: ["s", "t", "or", "m"] }),
        core({ id: "or-2", word: "short", score: 60, focus: ["or"], segments: ["sh", "or", "t"] }),
      ],
    }],
    attempts: [],
    totalWords: 10,
    currentProfiles: {
      "pupil-1": {
        concernRows: [{ target: "ar", total: 4, securityBand: "insecure" }],
        secureRows: [{ target: "ai", total: 4, securityBand: "secure" }],
        developingRows: [{ target: "or", total: 3, securityBand: "nearly_secure" }],
        confusionByTarget: new Map(),
        placementMeta: { targetChallengeLevel: "core_developing" },
      },
    },
  });

  assert.equal(plan.error, "");
  const pupilWords = plan.pupilPlans[0]?.words || [];
  assert.equal(pupilWords.length, 10);
  assert.equal(pupilWords.every((item) => item.originWordSource === "wordloom_core"), true);
  assert.equal(pupilWords.filter((item) => item.assignmentRole === "target" && item.focusGrapheme === "ar").length, 4);

  const arWord = pupilWords.find((item) => item.assignmentRole === "target" && item.focusGrapheme === "ar");
  const payload = buildAssignmentEngineWordPayload(arWord, 1);
  assert.equal(payload.choice.source, "assignment_engine_pool");
  assert.equal(payload.choice.origin_word_source, "wordloom_core");
  assert.match(payload.choice.origin_bank_word_id, /^core-ar-/);
  assert.equal(payload.choice.context_support.meaning_status, "approved");
  assert.equal(payload.choice.context_support.meaning_enabled, true);
});

test("stretch focus preserves the grapheme that caused selection for multi-grapheme words", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        wordRow({ id: "review-ai", word: "rain", score: 24, focus: ["ai"], segments: ["r", "ai", "n"] }),
        wordRow({ id: "review-ee", word: "seed", score: 24, focus: ["ee"], segments: ["s", "ee", "d"] }),
        wordRow({ id: "review-oa", word: "boat", score: 26, focus: ["oa"], segments: ["b", "oa", "t"] }),
        wordRow({ id: "review-igh", word: "light", score: 32, focus: ["igh"], segments: ["l", "igh", "t"] }),
        wordRow({ id: "target-belief", word: "belief", score: 66, focus: ["ie"], segments: ["b", "e", "l", "ie", "f"], band: "stretch" }),
        wordRow({ id: "target-shield", word: "shield", score: 62, focus: ["ie"], segments: ["sh", "ie", "l", "d"], band: "stretch" }),
        wordRow({ id: "target-brief", word: "brief", score: 60, focus: ["ie"], segments: ["b", "r", "ie", "f"], band: "stretch" }),
        wordRow({ id: "target-achieve", word: "achieve", score: 72, focus: ["ie"], segments: ["a", "ch", "ie", "v", "e"], band: "challenge" }),
        wordRow({ id: "stretch-picture", word: "picture", score: 72, focus: ["ure"], segments: ["p", "i", "c", "t", "ure"], band: "challenge" }),
        wordRow({ id: "stretch-think", word: "think", score: 40, focus: ["th"], segments: ["th", "i", "n", "k"] }),
      ],
    }],
    attempts: [],
    totalWords: 10,
    currentProfiles: {
      "pupil-1": {
        concernRows: [{ target: "ie", total: 3, securityBand: "nearly_secure" }],
        secureRows: [
          { target: "ai", total: 4, securityBand: "secure" },
          { target: "ee", total: 4, securityBand: "secure" },
          { target: "oa", total: 4, securityBand: "secure" },
          { target: "igh", total: 4, securityBand: "secure" },
        ],
        developingRows: [
          { target: "ure", total: 3, securityBand: "nearly_secure" },
          { target: "th", total: 3, securityBand: "nearly_secure" },
        ],
        confusionByTarget: new Map(),
        placementMeta: { targetChallengeLevel: "early_stretch" },
      },
    },
  });

  assert.equal(plan.error, "");
  const picture = stretchWordsFor(plan).find((item) => item.word === "picture");
  assert.equal(picture?.focusGrapheme, "ure");
});

test("needs support stretch slots use soft consolidation instead of hard stretch", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        wordRow({ id: "review-rain", word: "rain", score: 24, focus: ["ai"], segments: ["r", "ai", "n"] }),
        wordRow({ id: "review-train", word: "train", score: 26, focus: ["ai"], segments: ["t", "r", "ai", "n"] }),
        wordRow({ id: "review-brain", word: "brain", score: 32, focus: ["ai"], segments: ["b", "r", "ai", "n"] }),
        wordRow({ id: "review-chain", word: "chain", score: 34, focus: ["ai"], segments: ["ch", "ai", "n"] }),
        wordRow({ id: "target-phone", word: "phone", score: 30, focus: ["ph"], segments: ["ph", "o", "n", "e"] }),
        wordRow({ id: "target-photo", word: "photo", score: 32, focus: ["ph"], segments: ["ph", "o", "t", "o"] }),
        wordRow({ id: "hard-north", word: "north", score: 62, focus: ["or"], segments: ["n", "or", "th"], band: "stretch" }),
        wordRow({ id: "hard-thorn", word: "thorn", score: 64, focus: ["or"], segments: ["th", "or", "n"], band: "stretch" }),
      ],
    }],
    attempts: [],
    totalWords: 8,
    currentProfiles: {
      "pupil-1": {
        concernRows: [{ target: "ph", total: 4, securityBand: "insecure" }],
        secureRows: [{ target: "ai", total: 4, securityBand: "secure" }],
        developingRows: [{ target: "or", total: 3, securityBand: "nearly_secure" }],
        confusionByTarget: new Map(),
        placementMeta: { targetChallengeLevel: "needs_support" },
      },
    },
  });

  assert.equal(plan.error, "");
  const stretchWords = stretchWordsFor(plan);
  assert.ok(stretchWords.length > 0);
  assert.equal(stretchWords.some((item) => ["north", "thorn"].includes(item.word)), false);
  assert.equal(stretchWords.every((item) => Number(item.difficulty?.coreScore || 0) <= 35), true);
});

test("core developing stretch avoids large hard-stretch jumps", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        wordRow({ id: "review-rain", word: "rain", score: 24, focus: ["ai"], segments: ["r", "ai", "n"] }),
        wordRow({ id: "review-seed", word: "seed", score: 24, focus: ["ee"], segments: ["s", "ee", "d"] }),
        wordRow({ id: "review-train", word: "train", score: 26, focus: ["ai"], segments: ["t", "r", "ai", "n"] }),
        wordRow({ id: "review-green", word: "green", score: 26, focus: ["ee"], segments: ["g", "r", "ee", "n"] }),
        wordRow({ id: "target-shape", word: "shape", score: 40, focus: ["sh"], segments: ["sh", "a", "p", "e"] }),
        wordRow({ id: "target-shop", word: "shop", score: 36, focus: ["sh"], segments: ["sh", "o", "p"] }),
        wordRow({ id: "target-wish", word: "wish", score: 44, focus: ["sh"], segments: ["w", "i", "sh"] }),
        wordRow({ id: "target-shadow", word: "shadow", score: 48, focus: ["sh"], segments: ["sh", "a", "d", "ow"] }),
        wordRow({ id: "stretch-think", word: "think", score: 50, focus: ["th"], segments: ["th", "i", "n", "k"] }),
        wordRow({ id: "stretch-path", word: "path", score: 48, focus: ["th"], segments: ["p", "a", "th"] }),
        wordRow({ id: "hard-thorn", word: "thorn", score: 64, focus: ["or"], segments: ["th", "or", "n"], band: "stretch" }),
      ],
    }],
    attempts: [],
    totalWords: 10,
    currentProfiles: {
      "pupil-1": {
        concernRows: [{ target: "sh", total: 4, securityBand: "nearly_secure" }],
        secureRows: [{ target: "ai", total: 4, securityBand: "secure" }, { target: "ee", total: 4, securityBand: "secure" }],
        developingRows: [
          { target: "th", total: 3, securityBand: "nearly_secure" },
          { target: "or", total: 3, securityBand: "nearly_secure" },
        ],
        confusionByTarget: new Map(),
        placementMeta: { targetChallengeLevel: "core_developing" },
      },
    },
  });

  assert.equal(plan.error, "");
  const stretchWords = stretchWordsFor(plan);
  const targetAverage = plan.pupilPlans[0].words
    .filter((item) => item.assignmentRole === "target")
    .reduce((sum, item) => sum + Number(item.difficulty?.coreScore || 0), 0) / 4;
  assert.equal(stretchWords.some((item) => item.word === "thorn"), false);
  assert.equal(stretchWords.every((item) => Number(item.difficulty?.coreScore || 0) <= 55), true);
  assert.equal(stretchWords.every((item) => Number(item.difficulty?.coreScore || 0) > targetAverage), true);
  assertJsonEqual(stretchWords.map((item) => item.focusGrapheme), ["th", "th"]);
});

test("secure expected stretch chooses harder current-target words before unrelated developing targets", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        wordRow({ id: "review-rain", word: "rain", score: 24, focus: ["ai"], segments: ["r", "ai", "n"] }),
        wordRow({ id: "review-seed", word: "seed", score: 24, focus: ["ee"], segments: ["s", "ee", "d"] }),
        wordRow({ id: "review-boat", word: "boat", score: 26, focus: ["oa"], segments: ["b", "oa", "t"] }),
        wordRow({ id: "review-train", word: "train", score: 26, focus: ["ai"], segments: ["t", "r", "ai", "n"] }),
        wordRow({ id: "target-action", word: "action", score: 44, focus: ["tion"], segments: ["a", "c", "tion"] }),
        wordRow({ id: "target-motion", word: "motion", score: 46, focus: ["tion"], segments: ["m", "o", "tion"] }),
        wordRow({ id: "target-station", word: "station", score: 48, focus: ["tion"], segments: ["s", "t", "a", "tion"] }),
        wordRow({ id: "target-fiction", word: "fiction", score: 50, focus: ["tion"], segments: ["f", "i", "c", "tion"] }),
        wordRow({ id: "stretch-mention", word: "mention", score: 54, focus: ["tion"], segments: ["m", "e", "n", "tion"] }),
        wordRow({ id: "stretch-question", word: "question", score: 58, focus: ["tion"], segments: ["qu", "e", "s", "tion"], band: "stretch" }),
        wordRow({ id: "unrelated-dodge", word: "dodge", score: 62, focus: ["dge"], segments: ["d", "o", "dge"], band: "stretch" }),
      ],
    }],
    attempts: [],
    totalWords: 10,
    currentProfiles: {
      "pupil-1": {
        concernRows: [{ target: "tion", total: 3, securityBand: "nearly_secure" }],
        secureRows: [
          { target: "ai", total: 4, securityBand: "secure" },
          { target: "ee", total: 4, securityBand: "secure" },
          { target: "oa", total: 4, securityBand: "secure" },
        ],
        developingRows: [{ target: "dge", total: 3, securityBand: "nearly_secure" }],
        confusionByTarget: new Map(),
        placementMeta: { targetChallengeLevel: "secure_expected" },
      },
    },
  });

  assert.equal(plan.error, "");
  assertJsonEqual(stretchWordsFor(plan).map((item) => item.word), ["question", "mention"]);
  assertJsonEqual(stretchWordsFor(plan).map((item) => item.focusGrapheme), ["tion", "tion"]);
});

test("early stretch uses positive diagnostic misses with preserved focus", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        wordRow({ id: "review-rain", word: "rain", score: 24, focus: ["ai"], segments: ["r", "ai", "n"] }),
        wordRow({ id: "review-seed", word: "seed", score: 24, focus: ["ee"], segments: ["s", "ee", "d"] }),
        wordRow({ id: "review-boat", word: "boat", score: 26, focus: ["oa"], segments: ["b", "oa", "t"] }),
        wordRow({ id: "review-light", word: "light", score: 32, focus: ["igh"], segments: ["l", "igh", "t"] }),
        wordRow({ id: "target-belief", word: "belief", score: 66, focus: ["ie"], segments: ["b", "e", "l", "ie", "f"], band: "stretch" }),
        wordRow({ id: "target-shield", word: "shield", score: 62, focus: ["ie"], segments: ["sh", "ie", "l", "d"], band: "stretch" }),
        wordRow({ id: "target-brief", word: "brief", score: 60, focus: ["ie"], segments: ["b", "r", "ie", "f"], band: "stretch" }),
        wordRow({ id: "target-achieve", word: "achieve", score: 72, focus: ["ie"], segments: ["a", "ch", "ie", "v", "e"], band: "challenge" }),
        wordRow({ id: "stretch-cinema", word: "cinema", score: 74, focus: ["ci"], segments: ["ci", "n", "e", "m", "a"], band: "challenge" }),
        wordRow({ id: "stretch-picture", word: "picture", score: 72, focus: ["ure"], segments: ["p", "i", "c", "t", "ure"], band: "challenge" }),
      ],
    }],
    attempts: [],
    totalWords: 10,
    currentProfiles: {
      "pupil-1": {
        concernRows: [{ target: "ie", total: 3, securityBand: "nearly_secure" }],
        secureRows: [
          { target: "ai", total: 4, securityBand: "secure" },
          { target: "ee", total: 4, securityBand: "secure" },
          { target: "oa", total: 4, securityBand: "secure" },
          { target: "igh", total: 4, securityBand: "secure" },
        ],
        developingRows: [
          { target: "ci", total: 3, securityBand: "nearly_secure" },
          { target: "ure", total: 3, securityBand: "nearly_secure" },
        ],
        confusionByTarget: new Map(),
        placementMeta: { targetChallengeLevel: "early_stretch" },
      },
    },
  });

  assert.equal(plan.error, "");
  const stretchWords = stretchWordsFor(plan);
  const targetAverage = plan.pupilPlans[0].words
    .filter((item) => item.assignmentRole === "target")
    .reduce((sum, item) => sum + Number(item.difficulty?.coreScore || 0), 0) / 4;
  assertJsonEqual(stretchWords.map((item) => `${item.word}:${item.focusGrapheme}`), ["cinema:ci", "picture:ure"]);
  assert.equal(stretchWords.every((item) => Number(item.difficulty?.coreScore || 0) > targetAverage), true);
});

test("internal stretch planning fields are not persisted in assignment word payloads", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: usageAwareTeacherTests(),
    attempts: [],
    totalWords: 4,
    currentProfiles: {
      "pupil-1": usageAwareProfile(),
    },
  });

  assert.equal(plan.error, "");
  const stretchWord = stretchWordsFor(plan)[0];
  const payloadJson = JSON.stringify(buildAssignmentEngineWordPayload(stretchWord, 1));
  assert.equal(payloadJson.includes("stretchBasis"), false);
  assert.equal(payloadJson.includes("selectionFocusGrapheme"), false);
  assert.equal(payloadJson.includes("stretchQualityWarnings"), false);
});

test("early_stretch baseline seed drives advanced approved target choice in first generated plan", () => {
  const baselineRows = makeBaselineRows();
  const correctWords = new Set([
    "boat",
    "seed",
    "train",
    "light",
    "sharp",
    "storm",
    "enough",
    "special",
    "paint",
    "point",
    "fair",
    "nurse",
    "daughter",
    "description",
  ]);
  const currentProfiles = buildPlacementSeedProfiles({
    attempts: makeBaselineAttempts(baselineRows, correctWords),
    completedStatuses: [{
      pupil_id: "pupil-1",
      assignment_id: "baseline-1",
      status: "completed",
      completed_at: "2026-04-17T11:00:00.000Z",
    }],
    assignmentMetaById: new Map([[
      "baseline-1",
      {
        preset: "core",
        wordRows: baselineRows,
      },
    ]]),
  });

  assert.equal(currentProfiles["pupil-1"]?.placementMeta?.targetChallengeLevel, "early_stretch");
  assert.equal(currentProfiles["pupil-1"]?.concernRows?.[0]?.target, "ie");

  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        wordRow({ id: "review-1", word: "boat", score: 24, focus: ["oa"], segments: ["b", "oa", "t"] }),
        wordRow({ id: "review-2", word: "seed", score: 24, focus: ["ee"], segments: ["s", "ee", "d"] }),
        wordRow({ id: "stretch-1", word: "storm", score: 36, focus: ["or"], segments: ["s", "t", "or", "m"] }),
        wordRow({ id: "target-low", word: "field", score: 32, focus: ["ie"], segments: ["f", "ie", "l", "d"] }),
        wordRow({ id: "target-mid", word: "brief", score: 48, focus: ["ie"], segments: ["b", "r", "ie", "f"] }),
        wordRow({ id: "target-high", word: "chiefly", score: 64, focus: ["ie"], segments: ["ch", "ie", "f", "l", "y"], band: "challenge" }),
      ],
    }],
    attempts: [],
    totalWords: 2,
    currentProfiles,
  });

  assert.equal(plan.error, "");
  const targetWords = plan.pupilPlans[0].words
    .filter((item) => item.assignmentRole === "target")
    .map((item) => item.word);
  assertJsonEqual(targetWords, ["chiefly"]);
});

test("generated assignment fails only when safe non-duplicate fallback words are insufficient", () => {
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
  assert.equal(plan.error, "Not enough safe candidate words are available to build the assignment.");
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
