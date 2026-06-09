import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  BASELINE_V2_CEILING_STAGE,
  BASELINE_V2_DIAGNOSTIC_STAGE,
  BASELINE_V2_FLOOR_CORE_STAGE,
  REQUIRED_BASELINE_STANDARD_KEY,
  buildBaselineAssignmentDefinition,
  buildBaselineV2Inference,
  buildPlacementSeedProfiles,
  isBaselineAssignmentWordRows,
  isBaselineV2WordRow,
  resolveBaselineStandardKeyFromWordRows,
  shouldIncludeBaselineResponseInHeadlineAttainment,
} = await loadBrowserModule("../js/baselinePlacement.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function makeBaselineRows() {
  return buildBaselineAssignmentDefinition({ date: new Date("2026-04-17T09:00:00Z") })
    .wordRows
    .map((row, index) => ({
      ...row,
      id: `word-${index + 1}`,
    }));
}

function stageRows(rows, stage) {
  return rows.filter((row) => row?.choice?.baseline_stage === stage);
}

function makeAttempts(rows, correctWords = new Set(), {
  pupilId = "",
  assignmentId = "",
  attemptSource = "baseline",
} = {}) {
  return rows.map((row, index) => ({
    ...(pupilId ? { pupil_id: pupilId } : {}),
    ...(assignmentId ? { assignment_id: assignmentId } : {}),
    test_word_id: row.id,
    word_text: row.word,
    correct: correctWords.has(row.word),
    attempt_number: 1,
    mode: row?.choice?.question_type || "segmented_spelling",
    focus_grapheme: row?.choice?.focus_graphemes?.[0] || "",
    target_graphemes: Array.isArray(row?.segments) ? row.segments : [],
    attempt_source: attemptSource,
    created_at: new Date(Date.UTC(2026, 3, 17, 10, index)).toISOString(),
  }));
}

test("v1 baseline rows remain recognised for history", () => {
  const rows = [
    {
      id: "row-1",
      word: "train",
      choice: {
        source: "baseline_v1",
        baseline_v1: true,
        baseline_standard_key: "core_v1",
      },
    },
  ];

  assert.equal(isBaselineAssignmentWordRows(rows), true);
  assert.equal(resolveBaselineStandardKeyFromWordRows(rows), "core_v1");
});

test("baseline rows are recognised when choice payloads arrive as stringified JSON", () => {
  const rows = [
    {
      id: "row-1",
      word: "train",
      choice: JSON.stringify({
        source: "baseline_v1",
        baseline_v1: true,
        baseline_standard_key: "core_v1",
      }),
    },
    {
      id: "row-2",
      word: "seed",
      choice: JSON.stringify({
        source: "baseline_v1",
        baseline_v1: true,
        baseline_standard_key: "core_v1",
      }),
    },
  ];

  assert.equal(isBaselineAssignmentWordRows(rows), true);
  assert.equal(resolveBaselineStandardKeyFromWordRows(rows), "core_v1");
});

test("core baseline definition now creates the exact v2 catalogue with staged metadata", () => {
  const rows = makeBaselineRows();
  assert.equal(rows.length, 18);
  assert.equal(REQUIRED_BASELINE_STANDARD_KEY, "core_v2");
  assert.equal(isBaselineAssignmentWordRows(rows), true);
  assert.equal(resolveBaselineStandardKeyFromWordRows(rows), "core_v2");
  assert.equal(stageRows(rows, BASELINE_V2_FLOOR_CORE_STAGE).length, 10);
  assert.equal(stageRows(rows, BASELINE_V2_DIAGNOSTIC_STAGE).length, 4);
  assert.equal(stageRows(rows, BASELINE_V2_CEILING_STAGE).length, 4);

  for (const row of rows) {
    assert.equal(isBaselineV2WordRow(row), true);
    assert.equal(row.choice.source, "baseline_v2");
    assert.equal(row.choice.baseline_v2, true);
    assert.equal(row.choice.baseline_standard_key, "core_v2");
    assert.equal(row.choice.max_attempts, 1);
    assert.ok(row.choice.baseline_stage);
    assert.ok(row.choice.baseline_signal);
    assert.ok(row.choice.focus_graphemes?.length > 0);
    assert.ok(row.choice.difficulty?.coreBand);
  }
});

test("v2 catalogue spans floor, core, and ceiling difficulty under the current model", () => {
  const rows = makeBaselineRows();
  const floorCoreRows = stageRows(rows, BASELINE_V2_FLOOR_CORE_STAGE);
  const floorRows = floorCoreRows.slice(0, 6);
  const coreRows = floorCoreRows.slice(6);
  const challengeRows = stageRows(rows, BASELINE_V2_CEILING_STAGE);
  const diagnosticRows = stageRows(rows, BASELINE_V2_DIAGNOSTIC_STAGE);

  assert.equal(floorRows.every((row) => row.choice.difficulty.coreBand === "easier"), true);
  assert.equal(coreRows.every((row) => ["easier", "core"].includes(row.choice.difficulty.coreBand)), true);
  assert.ok(coreRows.some((row) => row.choice.difficulty.coreBand === "core"));
  assert.equal(challengeRows.every((row) => ["core", "stretch", "challenge"].includes(row.choice.difficulty.coreBand)), true);
  assert.ok(challengeRows.some((row) => ["stretch", "challenge"].includes(row.choice.difficulty.coreBand)));
  assert.equal(diagnosticRows.every((row) => row.choice.baseline_signal === "diagnostic"), true);
});

test("weak floor/core performance returns needs_support", () => {
  const rows = makeBaselineRows();
  const correctWords = new Set(["boat", "seed", "train", "light", "sharp"]);
  const inference = buildBaselineV2Inference({
    wordRows: rows,
    attempts: makeAttempts(rows, correctWords),
  });

  assert.equal(inference.placementKey, "needs_support");
  assert.equal(inference.floorCoreCorrect, 5);
});

test("weak floor subset returns needs_support even with stronger core words", () => {
  const rows = makeBaselineRows();
  const correctWords = new Set(["boat", "seed", "train", "enough", "special", "science", "question"]);
  const inference = buildBaselineV2Inference({
    wordRows: rows,
    attempts: makeAttempts(rows, correctWords),
  });

  assert.equal(inference.placementKey, "needs_support");
  assert.equal(inference.floorCoreCorrect, 7);
  assert.equal(inference.floorCorrect, 3);
});

test("six floor/core correct returns core_developing", () => {
  const rows = makeBaselineRows();
  const correctWords = new Set(["boat", "seed", "train", "light", "sharp", "storm"]);
  const inference = buildBaselineV2Inference({
    wordRows: rows,
    attempts: makeAttempts(rows, correctWords),
  });

  assert.equal(inference.placementKey, "core_developing");
  assert.equal(inference.floorCoreCorrect, 6);
});

test("same-word attempts with non-matching word ids do not pollute v2 inference", () => {
  const rows = makeBaselineRows();
  const correctWords = new Set(["boat", "seed", "train", "light", "sharp", "storm", "enough"]);
  const attempts = [
    ...makeAttempts(rows, correctWords),
    {
      test_word_id: "other-boat",
      word_text: "boat",
      correct: false,
      attempt_number: 1,
      created_at: "2026-04-17T12:00:00.000Z",
    },
  ];
  const inference = buildBaselineV2Inference({ wordRows: rows, attempts });

  assert.equal(inference.placementKey, "secure_expected");
  assert.equal(inference.floorCorrect, 6);
});

test("strong floor/core with weak challenge tail returns secure_expected", () => {
  const rows = makeBaselineRows();
  const correctWords = new Set(["boat", "seed", "train", "light", "sharp", "storm", "enough", "special"]);
  const inference = buildBaselineV2Inference({
    wordRows: rows,
    attempts: makeAttempts(rows, correctWords),
  });

  assert.equal(inference.placementKey, "secure_expected");
  assert.equal(inference.challengeCorrect, 0);
});

test("strong floor/core plus two challenge successes returns early_stretch", () => {
  const rows = makeBaselineRows();
  const correctWords = new Set([
    "boat",
    "seed",
    "train",
    "light",
    "sharp",
    "storm",
    "enough",
    "special",
    "daughter",
    "description",
  ]);
  const inference = buildBaselineV2Inference({
    wordRows: rows,
    attempts: makeAttempts(rows, correctWords),
  });

  assert.equal(inference.placementKey, "early_stretch");
  assert.equal(inference.challengeCorrect, 2);
});

test("completed v2 baseline seed profile propagates early_stretch metadata", () => {
  const rows = makeBaselineRows();
  const correctWords = new Set([
    "boat",
    "seed",
    "train",
    "light",
    "sharp",
    "storm",
    "enough",
    "special",
    "daughter",
    "description",
  ]);
  const profiles = buildPlacementSeedProfiles({
    attempts: makeAttempts(rows, correctWords, {
      pupilId: "pupil-1",
      assignmentId: "baseline-1",
    }),
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
        wordRows: rows,
      },
    ]]),
  });

  const meta = profiles["pupil-1"]?.placementMeta || {};
  assert.equal(meta.baselinePlacement, "early_stretch");
  assert.equal(meta.headlinePlacement, "early_stretch");
  assert.equal(meta.targetChallengeLevel, "early_stretch");
  assert.equal(meta.floorCoreCorrect, 8);
  assert.equal(meta.floorCorrect, 6);
  assert.equal(meta.challengeCorrect, 2);
  assert.equal(meta.diagnosticMissCount, 4);
  assert.equal(meta.provisionalPlacementBand, undefined);
});

test("placement seed falls back to provisional band when v2 word rows are unavailable", () => {
  const rows = makeBaselineRows();
  const correctWords = new Set([
    "boat",
    "seed",
    "train",
    "light",
    "sharp",
    "storm",
    "enough",
    "special",
    "science",
    "question",
    "daughter",
    "description",
  ]);
  const profiles = buildPlacementSeedProfiles({
    attempts: makeAttempts(rows, correctWords, {
      pupilId: "pupil-1",
      assignmentId: "legacy-baseline-1",
    }),
    completedStatuses: [{
      pupil_id: "pupil-1",
      assignment_id: "legacy-baseline-1",
      status: "completed",
      completed_at: "2026-04-17T11:00:00.000Z",
    }],
    assignmentMetaById: new Map([[
      "legacy-baseline-1",
      {
        preset: "core",
      },
    ]]),
  });

  const meta = profiles["pupil-1"]?.placementMeta || {};
  assert.equal(meta.provisionalPlacementBand, "extension");
  assert.equal(meta.targetChallengeLevel, undefined);
  assert.equal(meta.baselinePlacement, undefined);
});

test("diagnostic success alone does not fast-track a weak floor/core baseline", () => {
  const rows = makeBaselineRows();
  const diagnosticWords = stageRows(rows, BASELINE_V2_DIAGNOSTIC_STAGE).map((row) => row.word);
  const correctWords = new Set([
    "boat",
    "seed",
    "train",
    "light",
    "sharp",
    ...diagnosticWords,
  ]);
  const profiles = buildPlacementSeedProfiles({
    attempts: makeAttempts(rows, correctWords, {
      pupilId: "pupil-1",
      assignmentId: "baseline-1",
    }),
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
        wordRows: rows,
      },
    ]]),
  });

  const meta = profiles["pupil-1"]?.placementMeta || {};
  assert.equal(meta.baselinePlacement, "needs_support");
  assert.equal(meta.targetChallengeLevel, "needs_support");
  assert.equal(meta.floorCoreCorrect, 5);
  assert.equal(meta.challengeCorrect, 0);
});

test("diagnostic misses explain concerns without changing headline placement", () => {
  const rows = makeBaselineRows();
  const correctWords = new Set([
    "boat",
    "seed",
    "light",
    "sharp",
    "storm",
    "enough",
    "special",
    "science",
    "question",
  ]);
  const inference = buildBaselineV2Inference({
    wordRows: rows,
    attempts: makeAttempts(rows, correctWords),
  });

  assert.equal(inference.placementKey, "secure_expected");
  assert.equal(inference.floorCoreCorrect, 9);
  assert.equal(inference.diagnosticMissCount, 4);
  assert.equal(
    inference.diagnosticConcerns.some((item) => item.focusGrapheme === "ai" && item.matchedFloorCoreMiss),
    true,
  );
});

test("diagnostic misses and challenge misses are excluded from headline attainment responses", () => {
  const rows = makeBaselineRows();
  const byWord = new Map(rows.map((row) => [row.word, row]));

  assert.equal(shouldIncludeBaselineResponseInHeadlineAttainment({ correct: false }, byWord.get("paint")), false);
  assert.equal(shouldIncludeBaselineResponseInHeadlineAttainment({ correct: false }, byWord.get("daughter")), false);
  assert.equal(shouldIncludeBaselineResponseInHeadlineAttainment({ correct: true }, byWord.get("daughter")), true);
  assert.equal(shouldIncludeBaselineResponseInHeadlineAttainment({ correct: false }, byWord.get("boat")), true);
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
  console.log(`all ${TESTS.length} baseline placement checks passed`);
}
