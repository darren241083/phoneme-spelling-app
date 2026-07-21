import assert from "node:assert/strict";

import {
  buildAutoAssignedPoolEntries,
  buildAutoAssignedPoolIdMap,
  buildAutoAssignedTargetRows,
  buildAttemptDerivedBaselineStatusRows,
  buildBaselineAssignmentMetaMap,
  buildBaselineEvidenceAttemptRows,
  buildPlacementCurrentProfiles,
  buildProvisioningPlan,
  buildProvisioningPolicy,
  buildPublicProvisioningResponse,
  hasIncompleteRequiredCoreRuntimeAssignment,
  isRequiredCoreRuntimeAssignment,
  mapWordloomCoreBankRowsToWordRows,
} from "../supabase/functions/provision-personalised-assignment/provisioningCore.mjs";
import {
  buildBaselineAssignmentDefinition,
} from "../supabase/functions/provision-personalised-assignment/pure/baselinePlacement.js";

const response = buildPublicProvisioningResponse({
  status: "provisioned",
  assignmentId: "11111111-1111-4111-8111-111111111111",
  wordRows: [{ word: "hidden" }],
});

assert.deepEqual(Object.keys(response).sort(), ["assignmentId", "status"]);
assert.equal(response.status, "provisioned");
assert.equal(response.assignmentId, "11111111-1111-4111-8111-111111111111");
assert.deepEqual(buildPublicProvisioningResponse({
  status: "already_active",
  assignmentId: "22222222-2222-4222-8222-222222222222",
}), {
  status: "already_active",
  assignmentId: "22222222-2222-4222-8222-222222222222",
});
assert.deepEqual(buildPublicProvisioningResponse({ status: "not_ready" }), { status: "not_ready" });
assert.deepEqual(buildPublicProvisioningResponse({ status: "not_eligible" }), { status: "not_eligible" });
assert.deepEqual(buildPublicProvisioningResponse({ status: "not_enough_evidence" }), { status: "not_enough_evidence" });
assert.deepEqual(buildPublicProvisioningResponse({ status: "error" }), { status: "error" });
assert.deepEqual(buildPublicProvisioningResponse({ status: "unexpected" }), { status: "generation_failed" });

const regularProvisioningPolicy = buildProvisioningPolicy({
  assignment_length: 4,
  support_preset: "balanced",
  allow_starter_fallback: false,
});
assert.equal(regularProvisioningPolicy.delivery_model, "support_ladder");
assert.equal(regularProvisioningPolicy.support_preset, "balanced");

function runtimeAssignment({
  evidenceSource = "assigned_core",
  attemptSource = "teacher_assigned",
  mode = "test",
  completed = false,
} = {}) {
  return {
    evidence_source: evidenceSource,
    assignment_source: evidenceSource,
    attempt_source: attemptSource,
    mode,
    completed,
  };
}

const teacherPracticeModeCore = runtimeAssignment({
  attemptSource: "teacher_assigned",
  mode: "practice",
});
const autoPracticeModeCore = runtimeAssignment({
  attemptSource: "auto_assigned",
  mode: "practice",
});
const explicitPracticeRuntime = runtimeAssignment({
  attemptSource: "practice",
  mode: "test",
});

assert.equal(isRequiredCoreRuntimeAssignment(teacherPracticeModeCore), true);
assert.equal(isRequiredCoreRuntimeAssignment(autoPracticeModeCore), true);
assert.equal(isRequiredCoreRuntimeAssignment(explicitPracticeRuntime), false);
assert.equal(hasIncompleteRequiredCoreRuntimeAssignment([teacherPracticeModeCore]), true);
assert.equal(hasIncompleteRequiredCoreRuntimeAssignment([autoPracticeModeCore]), true);
assert.equal(hasIncompleteRequiredCoreRuntimeAssignment([explicitPracticeRuntime]), false);

const incompleteAssignedCoreRuntime = runtimeAssignment();
const completedAssignedCoreRuntime = runtimeAssignment({ completed: true });
const activeExtraChallengeRuntime = runtimeAssignment({
  evidenceSource: "extra_challenge",
  attemptSource: "extra_challenge",
});
const completedExtraChallengeRuntime = runtimeAssignment({
  evidenceSource: "extra_challenge",
  attemptSource: "extra_challenge",
  completed: true,
});
const legacyMissingEvidenceSourceRuntime = {
  assignment_source: "",
  attempt_source: "teacher_assigned",
  mode: "test",
  completed: false,
};

assert.equal(isRequiredCoreRuntimeAssignment(incompleteAssignedCoreRuntime), true);
assert.equal(hasIncompleteRequiredCoreRuntimeAssignment([incompleteAssignedCoreRuntime]), true);
assert.equal(isRequiredCoreRuntimeAssignment(completedAssignedCoreRuntime), true);
assert.equal(hasIncompleteRequiredCoreRuntimeAssignment([completedAssignedCoreRuntime]), false);
assert.equal(isRequiredCoreRuntimeAssignment(activeExtraChallengeRuntime), false);
assert.equal(hasIncompleteRequiredCoreRuntimeAssignment([activeExtraChallengeRuntime]), false);
assert.equal(isRequiredCoreRuntimeAssignment(completedExtraChallengeRuntime), false);
assert.equal(hasIncompleteRequiredCoreRuntimeAssignment([completedExtraChallengeRuntime]), false);
assert.equal(isRequiredCoreRuntimeAssignment(legacyMissingEvidenceSourceRuntime), true);
assert.equal(hasIncompleteRequiredCoreRuntimeAssignment([legacyMissingEvidenceSourceRuntime]), true);

function coreBankWord({
  id,
  word,
  segments,
  focus,
  score = 42,
  approvalStatus = "approved",
  suitabilityStatus = "suitable",
  active = true,
}) {
  return {
    id,
    word,
    normalised_word: word,
    grapheme_segments: segments,
    primary_focus_grapheme: focus,
    difficulty_score: score,
    difficulty_label: "Core",
    difficulty_reason: `${focus} smoke-test word.`,
    sentence: `Spell ${word}.`,
    meaning: `${word} meaning.`,
    suitability_status: suitabilityStatus,
    approval_status: approvalStatus,
    source_version: "test",
    is_active: active,
  };
}

function buildCoreBankRowsForProvisioning() {
  const wordRows = [
    coreBankWord({ id: "core-action", word: "action", segments: ["a", "c", "tion"], focus: "tion", score: 44 }),
    coreBankWord({ id: "core-motion", word: "motion", segments: ["m", "o", "tion"], focus: "tion", score: 46 }),
    coreBankWord({ id: "core-station", word: "station", segments: ["s", "t", "a", "tion"], focus: "tion", score: 48 }),
    coreBankWord({ id: "core-fiction", word: "fiction", segments: ["f", "i", "c", "tion"], focus: "tion", score: 50 }),
    coreBankWord({ id: "core-boat", word: "boat", segments: ["b", "oa", "t"], focus: "oa", score: 28 }),
    coreBankWord({ id: "core-seed", word: "seed", segments: ["s", "ee", "d"], focus: "ee", score: 28 }),
    coreBankWord({ id: "core-train", word: "train", segments: ["t", "r", "ai", "n"], focus: "ai", score: 30 }),
    coreBankWord({ id: "core-light", word: "light", segments: ["l", "igh", "t"], focus: "igh", score: 32 }),
  ];
  const focusTargetRows = [...new Set(wordRows.map((row) => row.primary_focus_grapheme))]
    .map((focus) => ({ id: `target-${focus}`, focus_grapheme: focus, is_active: true }));
  return mapWordloomCoreBankRowsToWordRows({
    wordRows,
    wordTargetRows: wordRows.map((row) => ({
      id: `link-${row.id}`,
      word_id: row.id,
      focus_target_id: `target-${row.primary_focus_grapheme}`,
      focus_grapheme: row.primary_focus_grapheme,
      target_role: "primary",
    })),
    focusTargetRows,
  });
}

function buildUsageAwareCoreBankRowsForProvisioning() {
  const wordRows = [
    coreBankWord({ id: "core-action", word: "action", segments: ["a", "c", "tion"], focus: "tion", score: 44 }),
    coreBankWord({ id: "core-motion", word: "motion", segments: ["m", "o", "tion"], focus: "tion", score: 44 }),
    coreBankWord({ id: "core-boat", word: "boat", segments: ["b", "oa", "t"], focus: "oa", score: 28 }),
    coreBankWord({ id: "core-seed", word: "seed", segments: ["s", "ee", "d"], focus: "ee", score: 28 }),
    coreBankWord({ id: "core-train", word: "train", segments: ["t", "r", "ai", "n"], focus: "ai", score: 30 }),
    coreBankWord({ id: "core-light", word: "light", segments: ["l", "igh", "t"], focus: "igh", score: 32 }),
  ];
  const focusTargetRows = [...new Set(wordRows.map((row) => row.primary_focus_grapheme))]
    .map((focus) => ({ id: `target-${focus}`, focus_grapheme: focus, is_active: true }));
  return mapWordloomCoreBankRowsToWordRows({
    wordRows,
    wordTargetRows: wordRows.map((row) => ({
      id: `link-${row.id}`,
      word_id: row.id,
      focus_target_id: `target-${row.primary_focus_grapheme}`,
      focus_grapheme: row.primary_focus_grapheme,
      target_role: "primary",
    })),
    focusTargetRows,
  });
}

function buildLowCoverageCoreBankRowsForProvisioning() {
  const wordRows = [
    coreBankWord({ id: "core-action", word: "action", segments: ["a", "c", "tion"], focus: "tion", score: 46 }),
    coreBankWord({ id: "core-motion", word: "motion", segments: ["m", "o", "tion"], focus: "tion", score: 48 }),
    coreBankWord({ id: "core-boat", word: "boat", segments: ["b", "oa", "t"], focus: "oa", score: 28 }),
    coreBankWord({ id: "core-seed", word: "seed", segments: ["s", "ee", "d"], focus: "ee", score: 28 }),
    coreBankWord({ id: "core-train", word: "train", segments: ["t", "r", "ai", "n"], focus: "ai", score: 30 }),
    coreBankWord({ id: "core-light", word: "light", segments: ["l", "igh", "t"], focus: "igh", score: 32 }),
    coreBankWord({ id: "core-farm", word: "farm", segments: ["f", "ar", "m"], focus: "ar", score: 34 }),
    coreBankWord({ id: "core-start", word: "start", segments: ["s", "t", "ar", "t"], focus: "ar", score: 36 }),
    coreBankWord({ id: "core-storm", word: "storm", segments: ["s", "t", "or", "m"], focus: "or", score: 38 }),
    coreBankWord({ id: "core-short", word: "short", segments: ["sh", "or", "t"], focus: "or", score: 40 }),
    coreBankWord({ id: "core-green", word: "green", segments: ["g", "r", "ee", "n"], focus: "ee", score: 30 }),
    coreBankWord({ id: "core-paint", word: "paint", segments: ["p", "ai", "n", "t"], focus: "ai", score: 32 }),
    coreBankWord({ id: "core-pending-section", word: "section", segments: ["s", "e", "c", "tion"], focus: "tion", score: 46, approvalStatus: "pending" }),
    coreBankWord({ id: "core-blocked-fiction", word: "fiction", segments: ["f", "i", "c", "tion"], focus: "tion", score: 48, suitabilityStatus: "blocked" }),
    coreBankWord({ id: "core-unsuitable-station", word: "station", segments: ["s", "t", "a", "tion"], focus: "tion", score: 50, suitabilityStatus: "unsuitable" }),
    coreBankWord({ id: "core-inactive-nation", word: "nation", segments: ["n", "a", "tion"], focus: "tion", score: 44, active: false }),
  ];
  const focusTargetRows = [...new Set(wordRows.map((row) => row.primary_focus_grapheme))]
    .map((focus) => ({ id: `target-${focus}`, focus_grapheme: focus, is_active: true }));
  return mapWordloomCoreBankRowsToWordRows({
    wordRows,
    wordTargetRows: wordRows.map((row) => ({
      id: `link-${row.id}`,
      word_id: row.id,
      focus_target_id: `target-${row.primary_focus_grapheme}`,
      focus_grapheme: row.primary_focus_grapheme,
      target_role: "primary",
    })),
    focusTargetRows,
  });
}

function buildBaselineRows() {
  return buildBaselineAssignmentDefinition({})
    .wordRows
    .map((row, index) => ({
      ...row,
      id: `baseline-word-${index + 1}`,
    }));
}

function buildBaselineResultRows(rows) {
  return rows.map((row) => {
    const focus = row?.choice?.focus_graphemes?.[0] || "";
    const correct = focus !== "tion";
    return {
      baseTestWordId: row.id,
      word: row.word,
      correctSpelling: row.word,
      typed: correct ? row.word : "miss",
      correct,
      attemptsUsed: 1,
      questionType: row?.choice?.question_type || "segmented_spelling",
      focusGrapheme: focus,
      targetGraphemes: row.segments,
    };
  });
}

function buildBaselineAttemptRows(rows, {
  pupilId = "pupil-one",
  assignmentId = "baseline-assignment",
  completedAt = "2026-05-10T12:00:00.000Z",
} = {}) {
  const baseMs = new Date(completedAt).getTime();
  return buildBaselineResultRows(rows).map((row, index) => ({
    pupil_id: pupilId,
    assignment_id: assignmentId,
    test_word_id: row.baseTestWordId,
    assignment_target_id: null,
    mode: row.questionType,
    attempt_source: "baseline",
    correct: row.correct,
    attempt_number: row.attemptsUsed,
    created_at: new Date(baseMs + index * 1000).toISOString(),
    focus_grapheme: row.focusGrapheme,
    pattern_type: null,
    word_text: row.word,
    typed: row.typed,
    target_graphemes: row.targetGraphemes,
  }));
}

const baselineRows = buildBaselineRows();
const baselineAssignment = {
  id: "baseline-assignment",
  test: {
    test_words: baselineRows,
  },
};
const baselineStatusWithResultJson = {
  pupil_id: "pupil-one",
  assignment_id: "baseline-assignment",
  status: "completed",
  completed_at: "2026-05-10T12:00:00.000Z",
  result_json: buildBaselineResultRows(baselineRows),
};
const baselineMetaById = buildBaselineAssignmentMetaMap([baselineAssignment]);

assert.equal(baselineMetaById.get("baseline-assignment").wordRows.length, baselineRows.length);

const baselineEvidenceRows = buildBaselineEvidenceAttemptRows({
  attempts: [],
  baselineStatusRows: [baselineStatusWithResultJson],
  baselineAssignmentMetaById: baselineMetaById,
});
assert.equal(baselineEvidenceRows.length, baselineRows.length);
assert.equal(baselineEvidenceRows.filter((row) => row.focus_grapheme === "tion" && row.correct === false).length, 4);

const realAttempt = {
  pupil_id: "pupil-one",
  assignment_id: "baseline-assignment",
  test_word_id: "baseline-word-10",
  word_text: "question",
  correct: true,
  mode: "segmented_spelling",
  attempt_source: "baseline",
  attempt_number: 1,
  focus_grapheme: "tion",
  target_graphemes: ["qu", "e", "s", "tion"],
  typed: "question",
  created_at: "2026-05-10T11:59:00.000Z",
};
const questionResultRow = baselineStatusWithResultJson.result_json.find((row) => row.word === "question");
const dedupedBaselineEvidenceRows = buildBaselineEvidenceAttemptRows({
  attempts: [realAttempt],
  baselineStatusRows: [{
    ...baselineStatusWithResultJson,
    result_json: [questionResultRow],
  }],
  baselineAssignmentMetaById: baselineMetaById,
});
assert.equal(dedupedBaselineEvidenceRows.length, 1);
assert.equal(dedupedBaselineEvidenceRows[0].correct, true);

const placementProfilesFromResultJson = buildPlacementCurrentProfiles({
  pupilIds: ["pupil-one"],
  attempts: [],
  baselineStatusRows: [baselineStatusWithResultJson],
  baselineAssignmentMetaById: baselineMetaById,
});
assert.equal(placementProfilesFromResultJson["pupil-one"].concernRows[0].target, "tion");

const baselineAttemptRows = buildBaselineAttemptRows(baselineRows);
const attemptDerivedBaselineStatusRows = buildAttemptDerivedBaselineStatusRows({
  pupilId: "pupil-one",
  completedAssignmentId: "baseline-assignment",
  baselineAssignments: [baselineAssignment],
  baselineStatusRows: [],
  attemptRows: baselineAttemptRows,
});
assert.equal(attemptDerivedBaselineStatusRows.length, 1);
assert.equal(attemptDerivedBaselineStatusRows[0].assignment_id, "baseline-assignment");
assert.equal(attemptDerivedBaselineStatusRows[0].pupil_id, "pupil-one");
assert.equal(
  buildAttemptDerivedBaselineStatusRows({
    pupilId: "pupil-one",
    completedAssignmentId: "baseline-assignment",
    baselineAssignments: [baselineAssignment],
    baselineStatusRows: [baselineStatusWithResultJson],
    attemptRows: baselineAttemptRows,
  }).length,
  0,
);

const placementProfilesFromAttemptDerivedStatus = buildPlacementCurrentProfiles({
  pupilIds: ["pupil-one"],
  attempts: baselineAttemptRows,
  baselineStatusRows: attemptDerivedBaselineStatusRows,
  baselineAssignmentMetaById: baselineMetaById,
});
assert.equal(placementProfilesFromAttemptDerivedStatus["pupil-one"].concernRows[0].target, "tion");

const provisionedFromStatusOnly = buildProvisioningPlan({
  pupilId: "pupil-one",
  teacherTests: [],
  attemptRows: [],
  baselineAssignments: [baselineAssignment],
  baselineStatusRows: [baselineStatusWithResultJson],
  wordloomCoreWordRows: buildCoreBankRowsForProvisioning(),
  policy: regularProvisioningPolicy,
});
assert.equal(provisionedFromStatusOnly.plan.pupilPlans.length, 1);
assert.equal(provisionedFromStatusOnly.plan.pupilPlans[0].primaryTargetGrapheme, "tion");
assert.equal(
  provisionedFromStatusOnly.plan.pupilPlans[0].words.some((word) =>
    word.assignmentRole === "target" && word.focusGrapheme === "tion"
  ),
  true,
);
assert.equal(
  provisionedFromStatusOnly.plan.pupilPlans[0].words.some((word) => word.questionType === "focus_sound"),
  false,
);
assert.equal(
  provisionedFromStatusOnly.plan.pupilPlans[0].words.some((word) => word.questionType === "segmented_spelling"),
  true,
);

const provisionedFromAttemptDerivedStatus = buildProvisioningPlan({
  pupilId: "pupil-one",
  teacherTests: [],
  attemptRows: baselineAttemptRows,
  baselineAssignments: [baselineAssignment],
  baselineStatusRows: attemptDerivedBaselineStatusRows,
  wordloomCoreWordRows: buildCoreBankRowsForProvisioning(),
  policy: {
    assignment_length: 4,
    support_preset: "balanced",
    allow_starter_fallback: false,
  },
});
assert.equal(provisionedFromAttemptDerivedStatus.plan.pupilPlans.length, 1);
assert.equal(provisionedFromAttemptDerivedStatus.plan.pupilPlans[0].primaryTargetGrapheme, "tion");

const provisionedWithUsageAwareSelection = buildProvisioningPlan({
  pupilId: "pupil-one",
  teacherTests: [],
  attemptRows: [
    ...baselineAttemptRows,
    {
      pupil_id: "pupil-one",
      assignment_id: "live-assignment",
      test_word_id: "live-action",
      word_text: "action",
      correct: true,
      attempt_number: 1,
      mode: "no_support_assessment",
      attempt_source: "auto_assigned",
      created_at: "2026-05-10T12:10:00.000Z",
      focus_grapheme: "tion",
      target_graphemes: ["a", "c", "tion"],
      typed: "action",
    },
  ],
  baselineAssignments: [baselineAssignment],
  baselineStatusRows: attemptDerivedBaselineStatusRows,
  wordloomCoreWordRows: buildUsageAwareCoreBankRowsForProvisioning(),
  policy: {
    assignment_length: 4,
    support_preset: "balanced",
    allow_starter_fallback: false,
  },
});
const usageAwareTargetWords = provisionedWithUsageAwareSelection.plan.pupilPlans[0].words
  .filter((word) => word.assignmentRole === "target")
  .map((word) => word.word);
assert.deepEqual(usageAwareTargetWords, ["motion"]);

const provisionedWithAssignedTargetSpacing = buildProvisioningPlan({
  pupilId: "pupil-one",
  teacherTests: [],
  attemptRows: baselineAttemptRows,
  baselineAssignments: [baselineAssignment],
  baselineStatusRows: attemptDerivedBaselineStatusRows,
  wordloomCoreWordRows: buildUsageAwareCoreBankRowsForProvisioning(),
  assignmentTargetRows: [{
    id: "target-action",
    assignment_id: "generated-assignment",
    pupil_id: "pupil-one",
    test_word_id: "generated-action",
    target_source: "assignment_engine_v1",
    created_at: "2026-05-10T12:10:00.000Z",
    test_words: {
      id: "generated-action",
      word: "action",
    },
  }],
  policy: {
    assignment_length: 4,
    support_preset: "balanced",
    allow_starter_fallback: false,
  },
});
const assignedTargetSpacingWords = provisionedWithAssignedTargetSpacing.plan.pupilPlans[0].words
  .filter((word) => word.assignmentRole === "target")
  .map((word) => word.word);
assert.deepEqual(assignedTargetSpacingWords, ["motion"]);

const provisionedWithoutExtraChallengeUsage = buildProvisioningPlan({
  pupilId: "pupil-one",
  teacherTests: [],
  attemptRows: baselineAttemptRows,
  baselineAssignments: [baselineAssignment],
  baselineStatusRows: attemptDerivedBaselineStatusRows,
  wordloomCoreWordRows: buildUsageAwareCoreBankRowsForProvisioning(),
  policy: {
    assignment_length: 4,
    support_preset: "balanced",
    allow_starter_fallback: false,
  },
});
const provisionedIgnoringExtraChallengeUsage = buildProvisioningPlan({
  pupilId: "pupil-one",
  teacherTests: [],
  attemptRows: [
    ...baselineAttemptRows,
    {
      pupil_id: "pupil-one",
      assignment_id: "extra-assignment",
      test_word_id: "extra-action",
      word_text: "action",
      correct: true,
      attempt_number: 1,
      mode: "no_support_assessment",
      attempt_source: "extra_challenge",
      created_at: "2026-05-10T12:10:00.000Z",
      focus_grapheme: "tion",
      target_graphemes: ["a", "c", "tion"],
      typed: "action",
    },
  ],
  baselineAssignments: [baselineAssignment],
  baselineStatusRows: attemptDerivedBaselineStatusRows,
  wordloomCoreWordRows: buildUsageAwareCoreBankRowsForProvisioning(),
  policy: {
    assignment_length: 4,
    support_preset: "balanced",
    allow_starter_fallback: false,
  },
});
assert.deepEqual(
  provisionedIgnoringExtraChallengeUsage.plan.pupilPlans[0].words.map((word) => word.word),
  provisionedWithoutExtraChallengeUsage.plan.pupilPlans[0].words.map((word) => word.word),
);

const provisionedWithLowCoverageFallback = buildProvisioningPlan({
  pupilId: "pupil-one",
  teacherTests: [],
  attemptRows: [],
  baselineAssignments: [baselineAssignment],
  baselineStatusRows: [baselineStatusWithResultJson],
  wordloomCoreWordRows: buildLowCoverageCoreBankRowsForProvisioning(),
  assignmentTargetRows: [{
    id: "target-action-low-coverage",
    assignment_id: "generated-low-coverage",
    pupil_id: "pupil-one",
    test_word_id: "generated-low-coverage-action",
    target_source: "assignment_engine_v1",
    created_at: "2026-05-10T12:10:00.000Z",
    test_words: {
      id: "generated-low-coverage-action",
      word: "action",
    },
  }],
  policy: {
    assignment_length: 10,
    support_preset: "balanced",
    allow_starter_fallback: false,
  },
});
assert.equal(provisionedWithLowCoverageFallback.plan.pupilPlans.length, 1);
assert.equal(provisionedWithLowCoverageFallback.plan.coverageWarnings.length, 1);
assert.equal(provisionedWithLowCoverageFallback.plan.coverageWarnings[0].focusGrapheme, "tion");
assert.equal(provisionedWithLowCoverageFallback.plan.coverageWarnings[0].requestedTargetCount, 4);
assert.equal(provisionedWithLowCoverageFallback.plan.coverageWarnings[0].selectedTargetCount, 2);
assert.equal(provisionedWithLowCoverageFallback.plan.coverageWarnings[0].fallbackCount, 2);
const lowCoverageWords = provisionedWithLowCoverageFallback.plan.pupilPlans[0].words;
assert.equal(lowCoverageWords.length, 10);
const lowCoverageWordTexts = lowCoverageWords.map((word) => String(word.word || "").trim().toLowerCase());
assert.equal(new Set(lowCoverageWordTexts).size, lowCoverageWordTexts.length);
assert.deepEqual(
  lowCoverageWords
    .filter((word) => word.assignmentRole === "target" && word.focusGrapheme === "tion")
    .map((word) => word.word)
    .sort(),
  ["action", "motion"],
);
for (const excluded of ["section", "fiction", "station", "nation"]) {
  assert.equal(lowCoverageWordTexts.includes(excluded), false, `${excluded} should not be selected`);
}
const lowCoverageFallbackWords = lowCoverageWords.filter((word) => word.assignmentRole !== "target");
assert.equal(lowCoverageFallbackWords.length, 8);
assert.equal(lowCoverageFallbackWords.every((word) => word.originWordSource === "wordloom_core"), true);
assert.equal(lowCoverageWords.every((word) => word.originWordSource === "wordloom_core"), true);
assert.equal(provisionedWithLowCoverageFallback.plan.selectorDiagnostics.lowBankFallback.used, true);
assert.equal(provisionedWithLowCoverageFallback.plan.selectorDiagnostics.lowBankFallback.warningCount, 1);
assert.deepEqual(
  provisionedWithLowCoverageFallback.plan.selectorDiagnostics.lowBankFallback.warnings[0],
  provisionedWithLowCoverageFallback.plan.coverageWarnings[0],
);
assert.equal(provisionedWithLowCoverageFallback.plan.pupilPlans[0].selectorDiagnostics.lowBankFallback.used, true);
assert.equal(provisionedWithLowCoverageFallback.plan.pupilPlans[0].selectorDiagnostics.targetPurity.selectedPrimaryTargetCount, 2);

assert.throws(
  () => buildProvisioningPlan({
    pupilId: "pupil-one",
    teacherTests: [],
    attemptRows: [],
    baselineAssignments: [baselineAssignment],
    baselineStatusRows: [],
    wordloomCoreWordRows: buildCoreBankRowsForProvisioning(),
    policy: {
      assignment_length: 4,
      support_preset: "balanced",
      allow_starter_fallback: false,
    },
  }),
  /No grapheme focus could be identified from current evidence/,
);

const mappedCoreRows = mapWordloomCoreBankRowsToWordRows({
  wordRows: [
    {
      id: "core-farm",
      word: "farm",
      normalised_word: "farm",
      grapheme_segments: ["f", "ar", "m"],
      primary_focus_grapheme: "ar",
      difficulty_score: 34,
      difficulty_label: "Core",
      difficulty_reason: "Common ar word.",
      sentence: "The farm kept sheep.",
      meaning: "Land used for growing food.",
      suitability_status: "suitable",
      approval_status: "approved",
      source_version: "proof",
      is_active: true,
    },
    {
      id: "core-pending",
      word: "park",
      normalised_word: "park",
      grapheme_segments: ["p", "ar", "k"],
      primary_focus_grapheme: "ar",
      suitability_status: "suitable",
      approval_status: "pending",
      is_active: true,
    },
  ],
  wordTargetRows: [
    {
      id: "link-farm",
      word_id: "core-farm",
      focus_target_id: "target-ar",
      focus_grapheme: "ar",
      target_role: "primary",
    },
    {
      id: "link-pending",
      word_id: "core-pending",
      focus_target_id: "target-ar",
      focus_grapheme: "ar",
      target_role: "primary",
    },
  ],
  focusTargetRows: [
    { id: "target-ar", focus_grapheme: "ar", is_active: true },
  ],
});

assert.equal(mappedCoreRows.length, 1);
assert.equal(mappedCoreRows[0].word, "farm");
assert.deepEqual(mappedCoreRows[0].segments, ["f", "ar", "m"]);
assert.equal(mappedCoreRows[0].choice.source, "wordloom_core");
assert.equal(mappedCoreRows[0].choice.origin_bank_word_id, "core-farm");
assert.equal(mappedCoreRows[0].choice.context_support.meaning, "Land used for growing food.");

const pupilPlans = [
  {
    pupilId: "pupil-one",
    words: [
      {
        word: "farm",
        sentence: "The farm kept sheep.",
        segments: ["f", "ar", "m"],
        questionType: "segmented_spelling",
        assignmentRole: "target",
        assignmentSupport: "independent",
        focusGrapheme: "ar",
        targetReason: "target_independent",
      },
      {
        word: "farm",
        sentence: "The farm kept sheep.",
        segments: ["f", "ar", "m"],
        questionType: "segmented_spelling",
        assignmentRole: "target",
        assignmentSupport: "independent",
        focusGrapheme: "ar",
        targetReason: "target_independent",
      },
    ],
  },
];

const poolEntries = buildAutoAssignedPoolEntries(pupilPlans);
assert.equal(poolEntries.length, 1);
assert.equal(poolEntries[0].payload.word, "farm");
assert.equal(poolEntries[0].payload.choice.assignment_role, "target");
assert.equal(poolEntries[0].payload.choice.engine_focus_grapheme, "ar");

const poolIdBySignature = buildAutoAssignedPoolIdMap([
  {
    id: "test-word-one",
    word: "farm",
    sentence: "The farm kept sheep.",
    segments: ["f", "ar", "m"],
    choice: poolEntries[0].payload.choice,
  },
]);
const targetRows = buildAutoAssignedTargetRows({
  teacherId: "teacher-one",
  assignmentId: "assignment-one",
  assignmentCreatedAt: "2026-05-10T10:00:00.000Z",
  pupilPlans,
  poolIdBySignature,
  schoolId: "school-one",
});

assert.equal(targetRows.length, 2);
assert.equal(targetRows[0].teacher_id, "teacher-one");
assert.equal(targetRows[0].assignment_id, "assignment-one");
assert.equal(targetRows[0].test_word_id, "test-word-one");
assert.equal(targetRows[0].target_source, "assignment_engine_v1");
assert.equal(targetRows[0].school_id, "school-one");

console.log("Passed personalised provisioning helper checks.");
