import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildGeneratedAssignmentPlan,
} = await loadBrowserModule("../js/assignmentEngine.js", import.meta.url);

const TESTS = [];
const LAUNCH_GENERATED_TYPES = new Set([
  "focus_sound",
  "segmented_spelling",
  "no_support_assessment",
]);
const DEPRECATED_GENERATED_TYPES = new Set([
  "type_what_you_hear",
  "spell_loom",
  "multiple_choice_grapheme_picker",
]);
const GENERATED_SUPPORT_VALUES = new Set([
  "independent",
  "supported",
  "focus",
]);

function test(name, fn) {
  TESTS.push({ name, fn });
}

function wordRow({
  id,
  word,
  focus,
  segments,
  score,
  sentence = "",
} = {}) {
  return {
    id,
    word,
    sentence,
    segments,
    choice: {
      source: "teacher",
      focus_graphemes: [focus],
      difficulty: {
        coreScore: score,
        score,
      },
    },
  };
}

function buildWordBank(targetScores) {
  return [{
    test_words: [
      wordRow({ id: "review-ai-1", word: "rain", focus: "ai", segments: ["r", "ai", "n"], score: 24 }),
      wordRow({ id: "review-ai-2", word: "train", focus: "ai", segments: ["t", "r", "ai", "n"], score: 25 }),
      wordRow({ id: "review-ai-3", word: "paint", focus: "ai", segments: ["p", "ai", "n", "t"], score: 26 }),
      wordRow({ id: "review-ai-4", word: "snail", focus: "ai", segments: ["s", "n", "ai", "l"], score: 27 }),
      wordRow({ id: "target-ph-1", word: "phone", focus: "ph", segments: ["ph", "o", "n", "e"], score: targetScores[0] }),
      wordRow({ id: "target-ph-2", word: "photo", focus: "ph", segments: ["ph", "o", "t", "o"], score: targetScores[1] }),
      wordRow({ id: "target-ph-3", word: "phase", focus: "ph", segments: ["ph", "a", "s", "e"], score: targetScores[2] }),
      wordRow({ id: "target-ph-4", word: "graph", focus: "ph", segments: ["g", "r", "a", "ph"], score: targetScores[3] }),
      wordRow({ id: "stretch-or-1", word: "storm", focus: "or", segments: ["s", "t", "or", "m"], score: 50 }),
      wordRow({ id: "stretch-or-2", word: "short", focus: "or", segments: ["sh", "or", "t"], score: 50 }),
    ],
  }];
}

function buildPlan({
  band,
  targetScores,
  concernRows,
  secureRows = [],
  developingRows = [],
  confusionByTarget = new Map(),
  policy = null,
} = {}) {
  const effectivePolicy = {
    delivery_model: "support_ladder",
    support_preset: "balanced",
    assignment_length: 10,
    ...(policy && typeof policy === "object" ? policy : {}),
  };
  return buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: buildWordBank(targetScores),
    attempts: [],
    totalWords: 10,
    policy: effectivePolicy,
    currentProfiles: {
      "pupil-1": {
        concernRows,
        secureRows,
        developingRows,
        confusionByTarget,
        placementMeta: { targetChallengeLevel: band },
      },
    },
  });
}

function getWords(plan) {
  assert.equal(plan.error, "");
  const words = plan.pupilPlans[0]?.words || [];
  assert.equal(words.length, 10);
  assertLaunchOnly(words);
  return words;
}

function assertLaunchOnly(words) {
  for (const item of words) {
    assert.equal(LAUNCH_GENERATED_TYPES.has(item.questionType), true, `${item.word} emitted ${item.questionType}`);
    assert.equal(DEPRECATED_GENERATED_TYPES.has(item.questionType), false, `${item.word} emitted deprecated ${item.questionType}`);
    assert.equal(GENERATED_SUPPORT_VALUES.has(item.assignmentSupport), true, `${item.word} emitted ${item.assignmentSupport}`);
  }
}

function byRole(words, role) {
  return words.filter((item) => item.assignmentRole === role);
}

function countType(words, questionType) {
  return words.filter((item) => item.questionType === questionType).length;
}

function countNonIndependentTargets(words) {
  return byRole(words, "target")
    .filter((item) => item.assignmentSupport !== "independent")
    .length;
}

function countIndependentTargets(words) {
  return byRole(words, "target")
    .filter((item) => item.assignmentSupport === "independent")
    .length;
}

test("needs_support defaults most generated items to segmented spelling without old focus support", () => {
  const words = getWords(buildPlan({
    band: "needs_support",
    targetScores: [30, 32, 34, 36],
    concernRows: [{
      target: "ph",
      total: 4,
      securityBand: "insecure",
      accuracy: 0.25,
      firstTrySuccessRate: 0.25,
      recentIncorrectCount: 2,
    }],
  }));

  assert.equal(countType(words, "segmented_spelling") > countType(words, "no_support_assessment"), true);
  assert.equal(countType(words, "focus_sound"), 0);
  assert.equal(countNonIndependentTargets(words), 2);
  assert.equal(countIndependentTargets(words), 2);
});

test("core_developing defaults target items to segmented spelling", () => {
  const words = getWords(buildPlan({
    band: "core_developing",
    targetScores: [34, 38, 42, 46],
    concernRows: [{
      target: "ph",
      total: 4,
      securityBand: "nearly_secure",
      accuracy: 0.6,
      firstTrySuccessRate: 0.5,
    }],
    secureRows: [{ target: "ai", total: 4, securityBand: "secure" }],
    developingRows: [{ target: "or", total: 3, securityBand: "nearly_secure" }],
  }));

  assert.equal(byRole(words, "target").some((item) => item.questionType === "segmented_spelling"), true);
  assert.equal(countNonIndependentTargets(words), 2);
  assert.equal(countIndependentTargets(words), 2);
  assert.equal(byRole(words, "review").every((item) => item.questionType === "no_support_assessment"), true);
  assert.equal(countType(words, "focus_sound"), 0);
});

test("secure_expected uses independent review and stretch but keeps weaker targets structured", () => {
  const words = getWords(buildPlan({
    band: "secure_expected",
    targetScores: [46, 48, 50, 52],
    concernRows: [{
      target: "ph",
      total: 3,
      securityBand: "nearly_secure",
      accuracy: 0.67,
      firstTrySuccessRate: 0.67,
    }],
    secureRows: [{ target: "ai", total: 4, securityBand: "secure" }],
    developingRows: [{ target: "or", total: 3, securityBand: "nearly_secure" }],
  }));

  assert.equal(byRole(words, "review").every((item) => item.questionType === "no_support_assessment"), true);
  assert.equal(byRole(words, "stretch").every((item) => item.questionType === "no_support_assessment"), true);
  assert.equal(countNonIndependentTargets(words), 2);
  assert.equal(countIndependentTargets(words), 2);
  assert.equal(byRole(words, "target").some((item) => item.questionType === "segmented_spelling"), true);
});

test("early_stretch skews independent while keeping target structure where evidence says it is needed", () => {
  const words = getWords(buildPlan({
    band: "early_stretch",
    targetScores: [60, 64, 68, 72],
    concernRows: [{
      target: "ph",
      total: 3,
      securityBand: "nearly_secure",
      accuracy: 0.67,
      firstTrySuccessRate: 0.67,
    }],
    secureRows: [{ target: "ai", total: 4, securityBand: "secure" }],
  }));

  assert.equal(countType(words, "no_support_assessment") > countType(words, "segmented_spelling"), true);
  assert.equal(countNonIndependentTargets(words), 2);
  assert.equal(countIndependentTargets(words), 2);
  assert.equal(byRole(words, "stretch").every((item) => item.questionType === "no_support_assessment"), true);
  assert.equal(countType(words, "focus_sound"), 0);
});

test("clear confusion routes to segmented spelling without deprecated generated support types", () => {
  const words = getWords(buildPlan({
    band: "core_developing",
    targetScores: [34, 38, 42, 46],
    concernRows: [{
      target: "ph",
      total: 4,
      securityBand: "nearly_secure",
      accuracy: 0.6,
      firstTrySuccessRate: 0.5,
    }],
    confusionByTarget: new Map([[
      "ph",
      { expected: "ph", actual: "f", attemptCount: 2, substitutionCount: 2 },
    ]]),
  }));

  assert.equal(countType(words, "focus_sound"), 0);
  assert.equal(byRole(words, "target").some((item) => item.questionType === "segmented_spelling"), true);
  assert.equal(words.some((item) => item.questionType === "multiple_choice_grapheme_picker"), false);
  assert.equal(words.some((item) => item.questionType === "type_what_you_hear"), false);
  assert.equal(words.some((item) => item.questionType === "spell_loom"), false);
});

test("independent_first emits no generated focus or segmented support for weak confused evidence", () => {
  const words = getWords(buildPlan({
    band: "core_developing",
    targetScores: [34, 38, 42, 46],
    concernRows: [{
      target: "ph",
      total: 4,
      securityBand: "insecure",
      accuracy: 0.25,
      firstTrySuccessRate: 0.25,
      recentIncorrectCount: 2,
    }],
    confusionByTarget: new Map([[
      "ph",
      { expected: "ph", actual: "f", attemptCount: 2, substitutionCount: 2 },
    ]]),
    policy: {
      support_preset: "independent_first",
      assignment_length: 10,
    },
  }));

  assert.equal(countType(words, "focus_sound"), 0);
  assert.equal(countType(words, "segmented_spelling"), 0);
  assert.equal(words.every((item) => item.questionType === "no_support_assessment"), true);
  assert.equal(countIndependentTargets(words), 4);
});

test("balanced respects the old base target non-independent cap", () => {
  const words = getWords(buildPlan({
    band: "core_developing",
    targetScores: [34, 38, 42, 46],
    concernRows: [{
      target: "ph",
      total: 4,
      securityBand: "insecure",
      accuracy: 0.25,
      firstTrySuccessRate: 0.25,
      recentIncorrectCount: 2,
    }],
    confusionByTarget: new Map([[
      "ph",
      { expected: "ph", actual: "f", attemptCount: 2, substitutionCount: 2 },
    ]]),
    policy: {
      support_preset: "balanced",
      assignment_length: 10,
    },
  }));

  assert.equal(countNonIndependentTargets(words), 2);
  assert.equal(countIndependentTargets(words), 2);
  assert.equal(countType(byRole(words, "target"), "focus_sound"), 0);
  assert.equal(countType(byRole(words, "target"), "segmented_spelling"), 2);
});

test("more_support_when_needed uses the extra target slot while preserving one independent target", () => {
  const words = getWords(buildPlan({
    band: "core_developing",
    targetScores: [34, 38, 42, 46],
    concernRows: [{
      target: "ph",
      total: 4,
      securityBand: "insecure",
      accuracy: 0.25,
      firstTrySuccessRate: 0.25,
      recentIncorrectCount: 2,
    }],
    confusionByTarget: new Map([[
      "ph",
      { expected: "ph", actual: "f", attemptCount: 2, substitutionCount: 2 },
    ]]),
    policy: {
      support_preset: "more_support_when_needed",
      assignment_length: 10,
    },
  }));

  assert.equal(countNonIndependentTargets(words), 3);
  assert.equal(countIndependentTargets(words), 1);
  assert.equal(countType(byRole(words, "target"), "focus_sound"), 0);
  assert.equal(countType(byRole(words, "target"), "segmented_spelling"), 3);
});

test("legacy fixed delivery can still emit launch focus support when explicitly requested", () => {
  const words = getWords(buildPlan({
    band: "core_developing",
    targetScores: [34, 38, 42, 46],
    concernRows: [{
      target: "ph",
      total: 4,
      securityBand: "insecure",
      accuracy: 0.25,
      firstTrySuccessRate: 0.25,
      recentIncorrectCount: 2,
    }],
    confusionByTarget: new Map([[
      "ph",
      { expected: "ph", actual: "f", attemptCount: 2, substitutionCount: 2 },
    ]]),
    policy: {
      delivery_model: "legacy_fixed",
      support_preset: "balanced",
      assignment_length: 10,
    },
  }));

  assert.equal(countNonIndependentTargets(words), 2);
  assert.equal(countIndependentTargets(words), 2);
  assert.equal(countType(byRole(words, "target"), "focus_sound"), 1);
  assert.equal(countType(byRole(words, "target"), "segmented_spelling"), 1);
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
  console.log(`all ${TESTS.length} personalised support ladder checks passed`);
}
