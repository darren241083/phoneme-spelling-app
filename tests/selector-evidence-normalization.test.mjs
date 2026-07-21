import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadBrowserModule } from "./load-browser-module.mjs";

const browserEngine = await loadBrowserModule("../js/assignmentEngine.js", import.meta.url);
const edgeEngine = await import("../supabase/functions/provision-personalised-assignment/pure/assignmentEngine.js");

const {
  buildGeneratedAssignmentPlan,
  buildProfileFromAttempts,
  normalizeSelectorEvidenceAttempts,
} = browserEngine;

assert.equal(
  browserEngine.ASSIGNMENT_ENGINE_USAGE_RECENT_WINDOW_MS,
  edgeEngine.ASSIGNMENT_ENGINE_USAGE_RECENT_WINDOW_MS,
);

const TESTS = [];
const USAGE_PARITY_RECENT_AS_OF_MS = Date.parse("2026-05-03T10:00:00.000Z");
const USAGE_PARITY_ATTEMPT_AT_MS = Date.parse("2026-05-01T10:00:00.000Z");
const USAGE_PARITY_JUST_INSIDE_AS_OF_MS =
  USAGE_PARITY_ATTEMPT_AT_MS + browserEngine.ASSIGNMENT_ENGINE_USAGE_RECENT_WINDOW_MS - 1;
const USAGE_PARITY_OUTSIDE_AS_OF_MS =
  USAGE_PARITY_ATTEMPT_AT_MS + browserEngine.ASSIGNMENT_ENGINE_USAGE_RECENT_WINDOW_MS + 1;

function test(name, fn) {
  TESTS.push({ name, fn });
}

function coreWordRow({
  id,
  word,
  focus,
  segments = [focus],
  score = 42,
} = {}) {
  return {
    id: id || `core-${word}`,
    word,
    sentence: `${word} sentence.`,
    segments,
    choice: {
      source: "wordloom_core",
      origin_word_source: "wordloom_core",
      origin_bank_word_id: `bank-${id || word}`,
      focus_graphemes: [focus],
      focus_target_links: [{ focus_grapheme: focus, target_role: "primary" }],
      approval_status: "approved",
      suitability_status: "suitable",
      is_active: true,
      difficulty: {
        coreScore: score,
        score,
        band: score <= 35 ? "easier" : score <= 55 ? "core" : "stretch",
      },
      context_support: {
        sentence: `${word} sentence.`,
        meaning: `${word} meaning.`,
        sentence_status: "approved",
        meaning_status: "approved",
        meaning_enabled: true,
      },
    },
  };
}

function teacherWordRow({
  id,
  word,
  focus,
  segments = [focus],
  score = 42,
} = {}) {
  return {
    id: id || `legacy-${word}`,
    word,
    sentence: `${word} legacy sentence.`,
    segments,
    choice: {
      source: "teacher",
      focus_graphemes: [focus],
      selection_suitability: "standard",
      difficulty: {
        coreScore: score,
        score,
        band: score <= 35 ? "easier" : score <= 55 ? "core" : "stretch",
      },
    },
  };
}

function sourceTest(words = []) {
  return {
    id: "selector-evidence-bank",
    title: "Selector evidence bank",
    test_words: words,
  };
}

function supportAttempt({
  pupilId = "pupil-1",
  word,
  focus,
  category,
  supportState = "independent",
  correct = true,
  attemptNumber = 1,
  attemptSource = "teacher_assigned",
  createdAt = "2026-05-01T09:00:00.000Z",
  id = `${word}-${category}`,
} = {}) {
  return {
    pupil_id: pupilId,
    assignment_id: `assignment-${id}`,
    test_word_id: `word-${id}`,
    assignment_target_id: `target-${id}`,
    word_text: word,
    typed: correct ? word : "miss",
    correct,
    attempt_number: attemptNumber,
    mode: "segmented_spelling",
    attempt_source: attemptSource,
    delivery_model: "support_ladder",
    support_state: supportState,
    evidence_category: category,
    support_actions: supportState === "supported" ? ["segmented_input"] : [],
    focus_grapheme: focus,
    target_graphemes: [focus],
    created_at: createdAt,
  };
}

function legacyAttempt({
  pupilId = "pupil-1",
  word,
  focus,
  correct = false,
  attemptNumber = 1,
  attemptSource = "teacher_assigned",
  createdAt = "2026-05-01T09:00:00.000Z",
  id = `${word}-legacy`,
} = {}) {
  return {
    pupil_id: pupilId,
    assignment_id: `assignment-${id}`,
    test_word_id: `word-${id}`,
    assignment_target_id: `target-${id}`,
    word_text: word,
    typed: correct ? word : "miss",
    correct,
    attempt_number: attemptNumber,
    mode: "no_support_assessment",
    attempt_source: attemptSource,
    focus_grapheme: focus,
    target_graphemes: [focus],
    created_at: createdAt,
  };
}

function buildLowCoverageParityWordRows() {
  return [
    coreWordRow({ word: "phone", focus: "ph", segments: ["ph", "o", "n", "e"], score: 40 }),
    coreWordRow({ word: "phonics", focus: "ph", segments: ["ph", "o", "n", "i", "ck", "s"], score: 42 }),
    coreWordRow({ word: "rain", focus: "ai", segments: ["r", "ai", "n"], score: 28 }),
    coreWordRow({ word: "train", focus: "ai", segments: ["t", "r", "ai", "n"], score: 30 }),
    coreWordRow({ word: "seed", focus: "ee", segments: ["s", "ee", "d"], score: 28 }),
    coreWordRow({ word: "green", focus: "ee", segments: ["g", "r", "ee", "n"], score: 30 }),
    coreWordRow({ word: "boat", focus: "oa", segments: ["b", "oa", "t"], score: 30 }),
    coreWordRow({ word: "coat", focus: "oa", segments: ["c", "oa", "t"], score: 32 }),
    coreWordRow({ word: "farm", focus: "ar", segments: ["f", "ar", "m"], score: 32 }),
    coreWordRow({ word: "start", focus: "ar", segments: ["s", "t", "ar", "t"], score: 34 }),
    coreWordRow({ word: "storm", focus: "or", segments: ["s", "t", "or", "m"], score: 38 }),
    coreWordRow({ word: "short", focus: "or", segments: ["sh", "or", "t"], score: 40 }),
    teacherWordRow({ word: "brain", focus: "ai", segments: ["b", "r", "ai", "n"], score: 28 }),
    teacherWordRow({ word: "sleep", focus: "ee", segments: ["s", "l", "ee", "p"], score: 28 }),
  ];
}

function buildLowCoverageParityProfile() {
  return {
    concernRows: [{ target: "ph", total: 4, securityBand: "insecure" }],
    secureRows: [
      { target: "ai", total: 4, securityBand: "secure" },
      { target: "ee", total: 4, securityBand: "secure" },
      { target: "oa", total: 4, securityBand: "secure" },
      { target: "ar", total: 4, securityBand: "secure" },
    ],
    developingRows: [{ target: "or", total: 3, securityBand: "nearly_secure" }],
    confusionByTarget: new Map(),
    placementMeta: { targetChallengeLevel: "needs_support" },
  };
}

function buildUsageParityProfile() {
  return {
    concernRows: [{ target: "ph", total: 4, securityBand: "insecure" }],
    secureRows: [
      { target: "ai", total: 4, securityBand: "secure" },
      { target: "ee", total: 4, securityBand: "secure" },
      { target: "oa", total: 4, securityBand: "secure" },
    ],
    developingRows: [{ target: "or", total: 3, securityBand: "nearly_secure" }],
    confusionByTarget: new Map(),
    placementMeta: { targetChallengeLevel: "needs_support" },
  };
}

function buildUsageParityWordRows({ includePhase = true, includeOutcomeTargets = false } = {}) {
  return [
    coreWordRow({ word: "rain", focus: "ai", segments: ["r", "ai", "n"], score: 24 }),
    coreWordRow({ word: "train", focus: "ai", segments: ["t", "r", "ai", "n"], score: 25 }),
    coreWordRow({ word: "seed", focus: "ee", segments: ["s", "ee", "d"], score: 24 }),
    coreWordRow({ word: "boat", focus: "oa", segments: ["b", "oa", "t"], score: 26 }),
    coreWordRow({ word: "storm", focus: "or", segments: ["s", "t", "or", "m"], score: 42 }),
    coreWordRow({ word: "short", focus: "or", segments: ["sh", "or", "t"], score: 44 }),
    coreWordRow({ word: "phone", focus: "ph", segments: ["ph", "o", "n", "e"], score: 30 }),
    ...(includePhase
      ? [coreWordRow({ word: "phase", focus: "ph", segments: ["ph", "a", "s", "e"], score: 31 })]
      : []),
    ...(includeOutcomeTargets
      ? [
        coreWordRow({ word: "photo", focus: "ph", segments: ["ph", "o", "t", "o"], score: 32 }),
        coreWordRow({ word: "phonics", focus: "ph", segments: ["ph", "o", "n", "i", "ck", "s"], score: 33 }),
      ]
      : []),
  ];
}

function usageTargetRow({
  assignmentId = "generated-assignment",
  word,
  createdAt = "2026-05-02T10:00:00.000Z",
  evidenceSource = "assigned_core",
  automationKind = "personalised",
  mode = "test",
  joinedAsArray = false,
} = {}) {
  const assignmentRow = {
    id: assignmentId,
    created_at: createdAt,
    evidence_source: evidenceSource,
    automation_kind: automationKind,
    mode,
  };
  return {
    id: `${assignmentId}-${word}`,
    assignment_id: assignmentId,
    pupil_id: "pupil-1",
    test_word_id: `${assignmentId}-${word}-word`,
    target_source: "assignment_engine_v1",
    created_at: createdAt,
    assignments_v2: joinedAsArray ? [assignmentRow] : assignmentRow,
    test_words: {
      id: `${assignmentId}-${word}-word`,
      word,
    },
  };
}

function buildLowCoverageParityPlan(engine) {
  return engine.buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [sourceTest(buildLowCoverageParityWordRows())],
    attempts: [],
    totalWords: 10,
    policy: {
      assignment_length: 10,
      support_preset: "balanced",
      allow_starter_fallback: false,
    },
    currentProfiles: {
      "pupil-1": buildLowCoverageParityProfile(),
    },
  });
}

function buildUsageParityPlan(engine, {
  words = buildUsageParityWordRows(),
  attempts = [],
  assignmentTargetRows = [],
  excludedUsageAssignmentIds = [],
  usageAsOfMs = USAGE_PARITY_RECENT_AS_OF_MS,
  totalWords = 4,
} = {}) {
  return engine.buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [sourceTest(words)],
    attempts,
    assignmentTargetRows,
    excludedUsageAssignmentIds,
    totalWords,
    policy: {
      assignment_length: totalWords,
      support_preset: "balanced",
      allow_starter_fallback: false,
    },
    currentProfiles: {
      "pupil-1": buildUsageParityProfile(),
    },
    usageAsOfMs,
  });
}

function roleWords(plan, role = "target") {
  return Array.from(plan.pupilPlans?.[0]?.words || [])
    .filter((word) => word.assignmentRole === role)
    .map((word) => String(word.word || "").trim().toLowerCase());
}

function normalizeWordList(words = []) {
  return Array.from(
    Array.isArray(words) ? words : [],
    (item) => String(item?.word || item || "").trim().toLowerCase(),
  )
    .filter(Boolean)
    .sort();
}

function stableCoverageWarning(warning = {}) {
  return {
    type: warning?.type || "",
    focusGrapheme: warning?.focusGrapheme || "",
    requestedTargetCount: warning?.requestedTargetCount || 0,
    selectedTargetCount: warning?.selectedTargetCount || 0,
    fallbackCount: warning?.fallbackCount || 0,
  };
}

function stableCoverageWarnings(warnings = []) {
  return Array.from(Array.isArray(warnings) ? warnings : [], stableCoverageWarning);
}

const mixedEvidence = [
  supportAttempt({
    word: "rain",
    focus: "ai",
    category: "correct_first_time",
  }),
  supportAttempt({
    word: "seed",
    focus: "ee",
    category: "correct_after_retry",
    supportState: "retry",
    attemptNumber: 2,
  }),
  supportAttempt({
    word: "shop",
    focus: "sh",
    category: "correct_with_support",
    supportState: "supported",
    correct: true,
    attemptNumber: 3,
  }),
  supportAttempt({
    word: "phone",
    focus: "ph",
    category: "incorrect_with_support",
    supportState: "supported",
    correct: false,
    attemptNumber: 3,
  }),
  supportAttempt({
    word: "chain",
    focus: "ai",
    category: "access_issue",
    supportState: "access_issue",
    correct: null,
  }),
  legacyAttempt({
    word: "boat",
    focus: "oa",
    correct: true,
    attemptNumber: 2,
  }),
];

test("normalizes Support Ladder evidence categories for selector scoring", () => {
  const normalized = normalizeSelectorEvidenceAttempts(mixedEvidence);
  assert.equal(normalized.attempts.length, 5);
  assert.equal(normalized.diagnostics.supportLadderAttemptRows, 5);
  assert.equal(normalized.diagnostics.legacyAttemptRows, 1);
  assert.equal(normalized.diagnostics.excludedAccessIssueRows, 1);
  assert.equal(normalized.diagnostics.categoryCounts.correct_first_time, 1);
  assert.equal(normalized.diagnostics.categoryCounts.correct_after_retry, 1);
  assert.equal(normalized.diagnostics.categoryCounts.correct_with_support, 1);
  assert.equal(normalized.diagnostics.categoryCounts.incorrect_with_support, 1);
  assert.equal(normalized.diagnostics.categoryCounts.access_issue, 1);
  assert.equal(normalized.diagnostics.categoryCounts.legacy_correct, 1);

  const byWord = new Map(normalized.attempts.map((attempt) => [attempt.word_text, attempt]));
  assert.equal(byWord.get("rain").correct, true);
  assert.equal(byWord.get("rain").attempt_number, 1);
  assert.equal(byWord.get("rain").selector_secure_evidence, true);
  assert.equal(byWord.get("seed").correct, true);
  assert.equal(byWord.get("seed").attempt_number, 2);
  assert.equal(byWord.get("seed").selector_evidence_rationale, "correct_after_retry");
  assert.equal(byWord.get("shop").correct, false);
  assert.equal(byWord.get("shop").selector_supported_dependence, true);
  assert.equal(byWord.get("phone").correct, false);
  assert.equal(byWord.get("phone").selector_evidence_rationale, "incorrect_with_support");
  assert.equal(byWord.has("chain"), false);
  assert.equal(byWord.get("boat").selectorEvidenceNormalized, undefined);
});

test("profile rows map first-time, retry, supported, incorrect, and access evidence correctly", () => {
  const secureProfile = buildProfileFromAttempts([
    supportAttempt({ word: "rain", focus: "ai", category: "correct_first_time" }),
  ]);
  assert.equal(secureProfile.secureRows[0]?.target, "ai");
  assert.equal(secureProfile.concernRows.some((row) => row.target === "ai"), false);

  const retryProfile = buildProfileFromAttempts([
    supportAttempt({
      word: "seed",
      focus: "ee",
      category: "correct_after_retry",
      supportState: "retry",
      attemptNumber: 2,
    }),
  ]);
  assert.equal(retryProfile.developingRows[0]?.target, "ee");
  assert.equal(retryProfile.concernRows[0]?.target, "ee");

  const supportedProfile = buildProfileFromAttempts([
    supportAttempt({
      word: "shop",
      focus: "sh",
      category: "correct_with_support",
      supportState: "supported",
      correct: true,
      attemptNumber: 3,
    }),
  ]);
  assert.equal(supportedProfile.concernRows[0]?.target, "sh");
  assert.equal(supportedProfile.concernRows[0]?.supportedDependenceCount, 1);

  const incorrectProfile = buildProfileFromAttempts([
    supportAttempt({
      word: "phone",
      focus: "ph",
      category: "incorrect_with_support",
      supportState: "supported",
      correct: false,
      attemptNumber: 3,
    }),
  ]);
  assert.equal(incorrectProfile.concernRows[0]?.target, "ph");
  assert.equal(incorrectProfile.concernRows[0]?.supportedIncorrectCount, 1);

  const accessProfile = buildProfileFromAttempts([
    supportAttempt({
      word: "chain",
      focus: "ai",
      category: "access_issue",
      supportState: "access_issue",
      correct: null,
    }),
  ]);
  assert.equal(accessProfile.totalEvidence, 0);
  assert.equal(accessProfile.concernRows.length, 0);
  assert.equal(accessProfile.selectorEvidenceDiagnostics.categoryCounts.access_issue, 1);
});

test("browser and edge normalizers both exclude extra challenge evidence", () => {
  const rows = [
    supportAttempt({
      word: "phone",
      focus: "ph",
      category: "incorrect_with_support",
      supportState: "supported",
      correct: false,
      attemptSource: "extra_challenge",
    }),
    legacyAttempt({
      word: "rain",
      focus: "ai",
      correct: false,
    }),
  ];
  const browserResult = normalizeSelectorEvidenceAttempts(rows);
  const edgeResult = edgeEngine.normalizeSelectorEvidenceAttempts(rows);

  assert.equal(browserResult.attempts.length, 1);
  assert.equal(edgeResult.attempts.length, 1);
  assert.equal(browserResult.attempts[0].word_text, "rain");
  assert.equal(edgeResult.attempts[0].word_text, "rain");
  assert.equal(browserResult.diagnostics.excludedExtraChallengeRows, 1);
  assert.equal(edgeResult.diagnostics.excludedExtraChallengeRows, 1);
});

test("repeated supported failures are capped and explained in selector diagnostics", () => {
  const repeatedFailures = [0, 1, 2, 3].map((index) => supportAttempt({
    word: "phone",
    focus: "ph",
    category: "incorrect_with_support",
    supportState: "supported",
    correct: false,
    attemptNumber: 3,
    id: `phone-supported-${index}`,
    createdAt: new Date(Date.UTC(2026, 4, 1, 9, index)).toISOString(),
  }));
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [sourceTest([
      coreWordRow({ word: "phone", focus: "ph", segments: ["ph", "o", "n", "e"], score: 40 }),
      coreWordRow({ word: "photo", focus: "ph", segments: ["ph", "o", "t", "o"], score: 42 }),
      coreWordRow({ word: "phase", focus: "ph", segments: ["ph", "a", "s", "e"], score: 44 }),
      coreWordRow({ word: "graph", focus: "ph", segments: ["g", "r", "a", "ph"], score: 46 }),
      coreWordRow({ word: "rain", focus: "ai", segments: ["r", "ai", "n"], score: 34 }),
      coreWordRow({ word: "seed", focus: "ee", segments: ["s", "ee", "d"], score: 34 }),
      coreWordRow({ word: "boat", focus: "oa", segments: ["b", "oa", "t"], score: 38 }),
      coreWordRow({ word: "shop", focus: "sh", segments: ["sh", "o", "p"], score: 36 }),
      coreWordRow({ word: "chain", focus: "ai", segments: ["ch", "ai", "n"], score: 48 }),
      coreWordRow({ word: "sleep", focus: "ee", segments: ["s", "l", "ee", "p"], score: 48 }),
    ])],
    attempts: repeatedFailures,
    totalWords: 10,
    policy: {
      assignment_length: 10,
      support_preset: "balanced",
      allow_starter_fallback: false,
    },
  });

  assert.equal(plan.error, "");
  const protectedPhone = plan.selectorDiagnostics.repeatedProtectedWords
    .find((item) => item.word === "phone");
  assert.ok(protectedPhone);
  assert.equal(protectedPhone.supportedIncorrectCount, 4);
  assert.equal(protectedPhone.incorrectCount, 2);
  assert.equal(protectedPhone.capped, true);
});

test("selector diagnostics report target purity and low-bank fallback", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [sourceTest([
      coreWordRow({ word: "phone", focus: "ph", segments: ["ph", "o", "n", "e"], score: 40 }),
      coreWordRow({ word: "photo", focus: "ph", segments: ["ph", "o", "t", "o"], score: 42 }),
      coreWordRow({ word: "rain", focus: "ai", segments: ["r", "ai", "n"], score: 34 }),
      coreWordRow({ word: "seed", focus: "ee", segments: ["s", "ee", "d"], score: 34 }),
      coreWordRow({ word: "boat", focus: "oa", segments: ["b", "oa", "t"], score: 38 }),
      coreWordRow({ word: "shop", focus: "sh", segments: ["sh", "o", "p"], score: 36 }),
      coreWordRow({ word: "chain", focus: "ai", segments: ["ch", "ai", "n"], score: 48 }),
      coreWordRow({ word: "sleep", focus: "ee", segments: ["s", "l", "ee", "p"], score: 48 }),
      coreWordRow({ word: "storm", focus: "or", segments: ["s", "t", "or", "m"], score: 46 }),
      coreWordRow({ word: "green", focus: "ee", segments: ["g", "r", "ee", "n"], score: 44 }),
    ])],
    attempts: [
      supportAttempt({
        word: "phone",
        focus: "ph",
        category: "incorrect_with_support",
        supportState: "supported",
        correct: false,
      }),
      supportAttempt({
        word: "photo",
        focus: "ph",
        category: "incorrect_with_support",
        supportState: "supported",
        correct: false,
        id: "photo-supported",
      }),
    ],
    totalWords: 10,
    policy: {
      assignment_length: 10,
      support_preset: "balanced",
      allow_starter_fallback: false,
    },
  });

  assert.equal(plan.error, "");
  assert.equal(plan.selectorDiagnostics.lowBankFallback.used, true);
  assert.equal(plan.selectorDiagnostics.lowBankFallback.warningCount, 1);
  const targetPurity = plan.selectorDiagnostics.targetPurity[0];
  assert.equal(targetPurity.requestedTargetCount, 4);
  assert.equal(targetPurity.selectedPrimaryTargetCount, 2);
  assert.ok(targetPurity.ratio < 1);
});

test("browser and edge low-coverage generation keep stable selector parity", () => {
  const browserPlan = buildLowCoverageParityPlan(browserEngine);
  const edgePlan = buildLowCoverageParityPlan(edgeEngine);
  const plans = [browserPlan, edgePlan];

  for (const plan of plans) {
    assert.equal(plan.error, "");
    assert.equal(plan.pupilPlans.length, 1);
    assert.equal(plan.coverageWarnings.length, 1);
    assert.deepEqual(stableCoverageWarning(plan.coverageWarnings[0]), {
      type: "target_coverage_low",
      focusGrapheme: "ph",
      requestedTargetCount: 4,
      selectedTargetCount: 2,
      fallbackCount: 2,
    });
    assert.equal(plan.selectorDiagnostics.lowBankFallback.used, true);
    assert.equal(plan.selectorDiagnostics.lowBankFallback.warningCount, 1);

    const pupilWords = plan.pupilPlans[0]?.words || [];
    const normalizedWords = normalizeWordList(pupilWords);
    assert.equal(pupilWords.length, 10);
    assert.equal(new Set(normalizedWords).size, normalizedWords.length);
    assert.deepEqual(
      normalizeWordList(pupilWords.filter((word) => word.assignmentRole === "target")),
      ["phone", "phonics"],
    );
    assert.equal(normalizedWords.includes("brain"), false);
    assert.equal(normalizedWords.includes("sleep"), false);
    assert.equal(
      pupilWords
        .filter((word) => word.assignmentRole !== "target")
        .every((word) => word.originWordSource === "wordloom_core"),
      true,
    );
    assert.equal(plan.pupilPlans[0].selectorDiagnostics.lowBankFallback.used, true);
  }

  const browserWords = browserPlan.pupilPlans[0].words;
  const edgeWords = edgePlan.pupilPlans[0].words;
  assert.deepEqual(normalizeWordList(browserWords), normalizeWordList(edgeWords));
  assert.deepEqual(
    normalizeWordList(browserWords.filter((word) => word.assignmentRole === "target")),
    normalizeWordList(edgeWords.filter((word) => word.assignmentRole === "target")),
  );
  assert.equal(browserWords.length, edgeWords.length);
  assert.deepEqual(
    stableCoverageWarnings(browserPlan.coverageWarnings),
    stableCoverageWarnings(edgePlan.coverageWarnings),
  );
  assert.deepEqual(
    {
      used: browserPlan.selectorDiagnostics.lowBankFallback.used,
      warningCount: browserPlan.selectorDiagnostics.lowBankFallback.warningCount,
      warnings: stableCoverageWarnings(browserPlan.selectorDiagnostics.lowBankFallback.warnings),
    },
    {
      used: edgePlan.selectorDiagnostics.lowBankFallback.used,
      warningCount: edgePlan.selectorDiagnostics.lowBankFallback.warningCount,
      warnings: stableCoverageWarnings(edgePlan.selectorDiagnostics.lowBankFallback.warnings),
    },
  );
});

test("browser and edge usage cooldown select the same stable target words", () => {
  const attempts = [
    legacyAttempt({
      word: "phone",
      focus: "ph",
      correct: true,
      attemptNumber: 1,
      attemptSource: "auto_assigned",
      createdAt: "2026-05-01T10:00:00.000Z",
    }),
  ];
  const browserPlan = buildUsageParityPlan(browserEngine, { attempts });
  const edgePlan = buildUsageParityPlan(edgeEngine, { attempts });

  assert.equal(browserPlan.error, "");
  assert.equal(edgePlan.error, "");
  assert.deepEqual(roleWords(browserPlan, "target"), ["phase"]);
  assert.deepEqual(roleWords(edgePlan, "target"), ["phase"]);
});

test("browser and edge usage cooldown boundary behaviour matches", () => {
  const attempts = [
    legacyAttempt({
      word: "phone",
      focus: "ph",
      correct: true,
      attemptNumber: 1,
      attemptSource: "auto_assigned",
      createdAt: "2026-05-01T10:00:00.000Z",
    }),
  ];
  const browserInside = buildUsageParityPlan(browserEngine, {
    attempts,
    usageAsOfMs: USAGE_PARITY_JUST_INSIDE_AS_OF_MS,
  });
  const edgeInside = buildUsageParityPlan(edgeEngine, {
    attempts,
    usageAsOfMs: USAGE_PARITY_JUST_INSIDE_AS_OF_MS,
  });
  const browserOutside = buildUsageParityPlan(browserEngine, {
    attempts,
    usageAsOfMs: USAGE_PARITY_OUTSIDE_AS_OF_MS,
  });
  const edgeOutside = buildUsageParityPlan(edgeEngine, {
    attempts,
    usageAsOfMs: USAGE_PARITY_OUTSIDE_AS_OF_MS,
  });

  assert.deepEqual(roleWords(browserInside, "target"), ["phase"]);
  assert.deepEqual(roleWords(edgeInside, "target"), ["phase"]);
  assert.deepEqual(roleWords(browserOutside, "target"), ["phone"]);
  assert.deepEqual(roleWords(edgeOutside, "target"), ["phone"]);
});

test("browser and edge source exclusions keep equivalent usage history", () => {
  const attempts = [
    legacyAttempt({
      word: "phone",
      focus: "ph",
      correct: true,
      attemptNumber: 1,
      attemptSource: "extra-challenge",
      id: "phone-extra",
    }),
    {
      ...legacyAttempt({
        word: "phone",
        focus: "ph",
        correct: true,
        attemptNumber: 1,
        attemptSource: "",
        id: "phone-hidden-baseline",
      }),
      assignment_id: "hidden-baseline",
    },
    legacyAttempt({
      word: "phase",
      focus: "ph",
      correct: true,
      attemptNumber: 1,
      attemptSource: "teacher assigned",
      id: "phase-standard",
    }),
  ];
  const assignmentTargetRows = [
    usageTargetRow({
      assignmentId: "extra-target",
      word: "phone",
      evidenceSource: "extra_challenge",
    }),
    usageTargetRow({
      assignmentId: "bee-target",
      word: "phone",
      evidenceSource: "assigned_core",
      automationKind: "spelling bee",
      joinedAsArray: true,
    }),
    usageTargetRow({
      assignmentId: "standard-target",
      word: "phase",
    }),
  ];
  const options = {
    attempts,
    assignmentTargetRows,
    excludedUsageAssignmentIds: ["hidden-baseline"],
  };
  const browserPlan = buildUsageParityPlan(browserEngine, options);
  const edgePlan = buildUsageParityPlan(edgeEngine, options);

  assert.deepEqual(roleWords(browserPlan, "target"), ["phone"]);
  assert.deepEqual(roleWords(edgePlan, "target"), ["phone"]);
});

test("browser and edge outcome priority matches for support ladder usage", () => {
  const attempts = [
    supportAttempt({ word: "phone", focus: "ph", category: "correct_first_time" }),
    supportAttempt({
      word: "phase",
      focus: "ph",
      category: "incorrect_with_support",
      supportState: "supported",
      correct: false,
      attemptNumber: 3,
      id: "phase-supported-incorrect",
    }),
    supportAttempt({
      word: "photo",
      focus: "ph",
      category: "correct_with_support",
      supportState: "supported",
      correct: true,
      attemptNumber: 2,
      id: "photo-supported-correct",
    }),
    supportAttempt({
      word: "phonics",
      focus: "ph",
      category: "correct_after_retry",
      supportState: "retry",
      correct: true,
      attemptNumber: 2,
      id: "phonics-retry",
    }),
    supportAttempt({
      word: "train",
      focus: "ai",
      category: "access_issue",
      supportState: "access_issue",
      correct: null,
      id: "train-access",
    }),
  ];
  const options = {
    words: buildUsageParityWordRows({ includeOutcomeTargets: true }),
    attempts,
    totalWords: 8,
  };
  const browserPlan = buildUsageParityPlan(browserEngine, options);
  const edgePlan = buildUsageParityPlan(edgeEngine, options);

  assert.deepEqual(roleWords(browserPlan, "target"), ["phase", "photo", "phonics"]);
  assert.deepEqual(roleWords(edgePlan, "target"), ["phase", "photo", "phonics"]);
  assert.equal(browserPlan.selectorDiagnostics.evidenceDiagnostics.excludedAccessIssueRows, 1);
  assert.equal(edgePlan.selectorDiagnostics.evidenceDiagnostics.excludedAccessIssueRows, 1);
});

test("browser and edge cooldown fallback matches when alternatives are insufficient", () => {
  const attempts = [
    legacyAttempt({
      word: "phone",
      focus: "ph",
      correct: true,
      attemptNumber: 1,
      attemptSource: "auto_assigned",
      createdAt: "2026-05-01T10:00:00.000Z",
    }),
  ];
  const options = {
    words: buildUsageParityWordRows({ includePhase: false }),
    attempts,
  };
  const browserPlan = buildUsageParityPlan(browserEngine, options);
  const edgePlan = buildUsageParityPlan(edgeEngine, options);

  assert.equal(browserPlan.error, "");
  assert.equal(edgePlan.error, "");
  assert.deepEqual(roleWords(browserPlan, "target"), ["phone"]);
  assert.deepEqual(roleWords(edgePlan, "target"), ["phone"]);
});

test("class and edge read paths request Support Ladder fields and class path excludes extra challenge", () => {
  const teacherViewSource = readFileSync(new URL("../js/teacherView.js", import.meta.url), "utf8");
  const edgeSource = readFileSync(
    new URL("../supabase/functions/provision-personalised-assignment/index.ts", import.meta.url),
    "utf8",
  );

  for (const field of ["delivery_model", "support_state", "evidence_category", "support_actions"]) {
    assert.match(teacherViewSource, new RegExp(field));
    assert.match(edgeSource, new RegExp(field));
  }
  for (const sourceField of ["assignments_v2", "evidence_source", "automation_kind", "mode"]) {
    assert.match(teacherViewSource, new RegExp(sourceField));
    assert.match(edgeSource, new RegExp(sourceField));
  }
  assert.match(teacherViewSource, /isSelectorStandardUsageAttempt/);
  assert.match(edgeSource, /assignments_v2 \(/);
});

for (const { name, fn } of TESTS) {
  try {
    await fn();
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
  console.log(`ok - ${name}`);
}

console.log(`all ${TESTS.length} selector evidence normalization checks passed`);
