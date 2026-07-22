import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIT_NOW_ISO,
  AUDIT_VERSION,
  TARGET_BUFFER_COUNT,
  buildCoreBankSelectorCoverageAuditReport,
  buildSelectorLogicFailures,
  classifyCoverageCell,
  classifyIssue,
  gradeCell,
  printCoreBankSelectorCoverageSummary,
} from "../../scripts/audit/core-bank-selector-coverage-audit.mjs";

const REPORT = buildCoreBankSelectorCoverageAuditReport();
const CLASSIFICATION_CATEGORIES = [
  "none",
  "expected_widening",
  "insufficient_target_buffer",
  "profile_target_mismatch",
  "genuine_low_band_gap",
  "assignment_blocked",
  "selector_logic_issue",
];
const CLASSIFICATION_SAFETY = ["none", "complete_exact", "constrained_but_safe", "blocked"];
const ACTION_RECOMMENDATIONS = [
  "none",
  "monitor",
  "top_up_buffer",
  "top_up_low_band",
  "repair_bank",
  "investigate_selector",
];
const EXPECTED_WIDENING_CELLS = [
  "ai/early_stretch",
  "oa/early_stretch",
  "ar/early_stretch",
  "or/early_stretch",
  "er/early_stretch",
  "oi/early_stretch",
  "ou/early_stretch",
  "ow/early_stretch",
  "sh/early_stretch",
  "ch/early_stretch",
  "th/early_stretch",
  "ng/early_stretch",
  "ck/early_stretch",
  "dge/needs_support",
  "ci/needs_support",
  "au/needs_support",
  "ay/early_stretch",
  "ea/early_stretch",
].sort();

function captureConsoleLog(fn) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => {
    lines.push(args.map((item) => String(item)).join(" "));
  };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

function cellKey(cell) {
  return `${cell.focusGrapheme}/${cell.profileId}`;
}

function findCell(focusGrapheme, profileId, matrixKind = "headline_pupil_profile") {
  const cell = REPORT.cells.find((item) =>
    item.focusGrapheme === focusGrapheme
    && item.profileId === profileId
    && item.matrixKind === matrixKind
  );
  assert.ok(cell, `Expected ${focusGrapheme}/${profileId}/${matrixKind} cell to exist`);
  return cell;
}

function cloneCell(cell) {
  return JSON.parse(JSON.stringify(cell));
}

function classifyMutatedCell(cell, mutate) {
  const copy = cloneCell(cell);
  mutate(copy);
  return classifyCoverageCell(copy);
}

test("Core Bank selector coverage audit builds the expected headline and diagnostic matrix", () => {
  assert.equal(REPORT.auditVersion, AUDIT_VERSION);
  assert.equal(REPORT.generatedAt, AUDIT_NOW_ISO);
  assert.equal(Number.isInteger(REPORT.source.activeTargetCount), true);
  assert.ok(REPORT.source.activeTargetCount > 0);
  assert.deepEqual(REPORT.headlineProfileIds, ["needs_support", "secure_expected", "early_stretch"]);
  assert.deepEqual(REPORT.diagnosticSelectorBandIds, ["core_developing"]);
  assert.equal(REPORT.headlineTotals.cellCount, REPORT.source.activeTargetCount * REPORT.headlineProfileIds.length);
  assert.equal(REPORT.diagnosticTotals.cellCount, REPORT.source.activeTargetCount);
  assert.equal(REPORT.totals.cellCount, REPORT.headlineTotals.cellCount + REPORT.diagnosticTotals.cellCount);
  assert.equal(REPORT.headlineTotals.green, 70);
  assert.equal(REPORT.headlineTotals.amber, 20);
  assert.equal(REPORT.headlineTotals.red, 0);
  assert.equal(REPORT.diagnosticTotals.green, 30);
  assert.equal(REPORT.diagnosticTotals.amber, 0);
  assert.equal(REPORT.diagnosticTotals.red, 0);

  const diagnostic = REPORT.profileTotals.find((item) => item.profileId === "core_developing");
  assert.equal(diagnostic?.matrixKind, "diagnostic_selector_band");
  const headlineKinds = REPORT.profileTotals
    .filter((item) => REPORT.headlineProfileIds.includes(item.profileId))
    .map((item) => item.matrixKind);
  assert.deepEqual([...new Set(headlineKinds)], ["headline_pupil_profile"]);
});

test("audit integrity passes without selector-logic, invalid-selection, duplicate, or parity failures", () => {
  assert.equal(REPORT.auditIntegrity.passed, true);
  assert.deepEqual(REPORT.selectorLogicFailures, []);
  assert.equal(REPORT.totals.selectorLogicIssueCount, 0);
  assert.equal(REPORT.totals.invalidSelectionIssueCount, 0);
  assert.equal(REPORT.totals.duplicateIssueCount, 0);
  assert.equal(REPORT.totals.browserEdgeMismatchCount, 0);
  assert.equal(REPORT.cells.every((cell) => ["green", "amber", "red"].includes(cell.status)), true);
  assert.equal(REPORT.cells.every((cell) => ["coverage", "selector_logic", "none"].includes(cell.issueClass)), true);
  assert.equal(REPORT.cells.every((cell) => cell.browserEdgeParity.match), true);
});

test("each matrix cell includes required selector coverage, supply, and classification fields", () => {
  for (const cell of REPORT.cells) {
    assert.equal(typeof cell.focusGrapheme, "string");
    assert.equal(typeof cell.profileId, "string");
    assert.equal(typeof cell.completeAssignment, "boolean");
    assert.equal(Number.isInteger(cell.assignmentLength), true);
    assert.ok(cell.assignmentLength >= 0);
    assert.ok(Array.isArray(cell.selectorLogicFailures));
    assert.equal(typeof cell.requestedTargetCount, "number");
    assert.equal(typeof cell.requestedTargetWordsAvailable, "number");
    assert.equal(typeof cell.selectedExactTargetCount, "number");
    assert.equal(typeof cell.widenedDifficultyWindowRequired, "boolean");
    assert.equal(typeof cell.reviewFallback.required, "boolean");
    assert.ok(Array.isArray(cell.coverageWarnings));
    assert.ok(Array.isArray(cell.allCoverageWarnings));
    assert.ok(Array.isArray(cell.duplicateWords));
    assert.ok(Array.isArray(cell.invalidSelections));
    assert.equal(typeof cell.browserEdgeParity.match, "boolean");
    assert.ok(cell.cooldownPressure);
    assert.ok(["relaxed_safely", "not_applicable_no_target_candidate", "failed", "audit_integrity_missing_candidate_row"].includes(cell.cooldownPressure.status));
    assert.ok(Array.isArray(cell.selectedWords));
    assert.equal(typeof cell.targetSupplyProbe.totalPrimaryCount, "number");
    assert.equal(typeof cell.targetSupplyProbe.baseWindowCount, "number");
    assert.equal(typeof cell.targetSupplyProbe.widenedWindowCount, "number");
    assert.equal(typeof cell.targetSupplyProbe.hardCeilingCount, "number");
    assert.ok(CLASSIFICATION_CATEGORIES.includes(cell.coverageClassification.category));
    assert.ok(CLASSIFICATION_SAFETY.includes(cell.coverageClassification.safety));
    assert.equal(typeof cell.coverageClassification.acceptedAmber, "boolean");
    assert.ok(ACTION_RECOMMENDATIONS.includes(cell.coverageClassification.actionRecommendation));
    assert.ok(Array.isArray(cell.coverageClassification.reasons));
    assert.equal(Object.prototype.hasOwnProperty.call(cell, "acceptedAmber"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(cell, "actionRecommendation"), false);

    if (!cell.completeAssignment && cell.selectorLogicFailures.length === 0) {
      assert.equal(cell.status, "red");
      assert.equal(cell.issueClass, "coverage");
    }
    if (cell.status === "red" && cell.issueClass === "coverage") {
      assert.equal(cell.selectorLogicFailures.length, 0);
    }
  }
});

test("current amber cells receive the expected classification baseline", () => {
  const expectedWideningCells = REPORT.cells
    .filter((cell) => cell.coverageClassification.category === "expected_widening")
    .map(cellKey)
    .sort();
  const insufficientBufferCells = REPORT.cells
    .filter((cell) => cell.coverageClassification.category === "insufficient_target_buffer")
    .map(cellKey);
  const profileMismatchCells = REPORT.cells
    .filter((cell) => cell.coverageClassification.category === "profile_target_mismatch")
    .map(cellKey);

  assert.deepEqual(expectedWideningCells, EXPECTED_WIDENING_CELLS);
  assert.deepEqual(insufficientBufferCells, ["ee/early_stretch"]);
  assert.deepEqual(profileMismatchCells, ["ure/needs_support"]);
  assert.deepEqual(REPORT.classificationCounts, {
    none: 100,
    expected_widening: 18,
    insufficient_target_buffer: 1,
    profile_target_mismatch: 1,
  });
  assert.equal(REPORT.acceptedAmberCount, 19);
  assert.equal(REPORT.actionableAmberCount, 1);
  assert.deepEqual(REPORT.actionableAmberCells.map(cellKey), ["ee/early_stretch"]);
});

test("ee early-stretch is the only actionable target-buffer amber", () => {
  const ee = findCell("ee", "early_stretch");
  assert.equal(ee.status, "amber");
  assert.equal(ee.selectedExactTargetCount, 4);
  assert.equal(ee.requestedTargetCount, 4);
  assert.equal(ee.targetBufferProbe.availableCount, 7);
  assert.equal(ee.targetBufferProbe.status, "not_enough_approved_words");
  assert.equal(ee.targetSupplyProbe.widenedWindowCount, 7);
  assert.deepEqual(ee.coverageClassification, {
    category: "insufficient_target_buffer",
    safety: "complete_exact",
    acceptedAmber: false,
    actionRecommendation: "top_up_buffer",
    reasons: [`targetBuffer:7/${TARGET_BUFFER_COUNT}`],
  });
});

test("ure needs-support satisfies every guarded profile-target mismatch expectation", () => {
  const ure = findCell("ure", "needs_support");
  assert.equal(ure.matrixKind, "headline_pupil_profile");
  assert.equal(ure.status, "amber");
  assert.equal(ure.completeAssignment, true);
  assert.equal(ure.browserEdgeParity.match, true);
  assert.deepEqual(ure.selectorLogicFailures, []);
  assert.deepEqual(ure.duplicateWords, []);
  assert.deepEqual(ure.invalidSelections, []);
  assert.equal(ure.cooldownPressure.canRelaxSafely, true);
  assert.equal(ure.targetSupplyProbe.totalPrimaryCount, 58);
  assert.equal(ure.targetSupplyProbe.widenedWindowCount, 2);
  assert.equal(ure.targetSupplyProbe.hardCeilingCount, 2);
  assert.equal(ure.selectedExactTargetCount, 2);
  assert.equal(ure.reviewFallback.targetShortfallFilledByNonTargetWords, 2);
  assert.equal(ure.allCoverageWarnings.length, 1);
  assert.equal(ure.allCoverageWarnings[0].type, "target_coverage_low");
  assert.deepEqual(ure.coverageClassification, {
    category: "profile_target_mismatch",
    safety: "constrained_but_safe",
    acceptedAmber: true,
    actionRecommendation: "monitor",
    reasons: [
      "guarded_profile_target_mismatch",
      "totalPrimaryCount:58",
      "hardCeilingCount:2",
      "fallbackCount:2",
    ],
  });
});

test("ure guarded mismatch becomes actionable when any expectation guard weakens", () => {
  const ure = findCell("ure", "needs_support");
  const guardBreakers = [
    ["total supply", (cell) => { cell.targetSupplyProbe.totalPrimaryCount = 57; }],
    ["widened supply", (cell) => { cell.targetSupplyProbe.widenedWindowCount = 1; }],
    ["hard ceiling supply", (cell) => { cell.targetSupplyProbe.hardCeilingCount = 1; }],
    ["selected exact targets", (cell) => { cell.selectedExactTargetCount = 1; }],
    ["fallback count", (cell) => { cell.reviewFallback.targetShortfallFilledByNonTargetWords = 3; }],
    ["warning type", (cell) => { cell.allCoverageWarnings = [{ ...cell.allCoverageWarnings[0], type: "unexpected_warning" }]; }],
    ["extra warning", (cell) => { cell.allCoverageWarnings.push({ type: "unexpected_warning", focusGrapheme: "ure" }); }],
    ["matrix kind", (cell) => { cell.matrixKind = "diagnostic_selector_band"; }],
  ];

  for (const [label, mutate] of guardBreakers) {
    const classification = classifyMutatedCell(ure, mutate);
    assert.equal(classification.category, "genuine_low_band_gap", label);
    assert.equal(classification.acceptedAmber, false, label);
    assert.equal(classification.actionRecommendation, "top_up_low_band", label);
  }
});

test("green cells classify as none", () => {
  const greenCells = REPORT.cells.filter((cell) => cell.status === "green");
  assert.equal(greenCells.length, 100);
  for (const cell of greenCells) {
    assert.deepEqual(cell.coverageClassification, {
      category: "none",
      safety: "none",
      acceptedAmber: false,
      actionRecommendation: "none",
      reasons: [],
    });
  }
});

test("red cells can never be accepted amber", () => {
  const greenTion = findCell("tion", "needs_support");
  const classification = classifyMutatedCell(greenTion, (cell) => {
    cell.status = "red";
    cell.completeAssignment = false;
    cell.selectedExactTargetCount = 0;
    cell.targetShortfall = 4;
  });
  assert.equal(classification.category, "assignment_blocked");
  assert.equal(classification.safety, "blocked");
  assert.equal(classification.acceptedAmber, false);
  assert.equal(classification.actionRecommendation, "repair_bank");
});

test("parity, selector, duplicate, invalid, and cooldown failures classify as selector issues", () => {
  const greenTion = findCell("tion", "needs_support");
  const selectorIssueMutations = [
    ["parity", (cell) => { cell.browserEdgeParity.match = false; }],
    ["selector logic", (cell) => { cell.selectorLogicFailures = [{ type: "synthetic_selector_failure" }]; }],
    ["duplicate", (cell) => { cell.duplicateWords = ["repeat"]; }],
    ["invalid", (cell) => { cell.invalidSelections = [{ word: "repeat", reason: "invalid" }]; }],
    ["cooldown", (cell) => { cell.cooldownPressure = { status: "failed", canRelaxSafely: false }; }],
  ];

  for (const [label, mutate] of selectorIssueMutations) {
    const classification = classifyMutatedCell(greenTion, mutate);
    assert.equal(classification.category, "selector_logic_issue", label);
    assert.equal(classification.safety, "blocked", label);
    assert.equal(classification.acceptedAmber, false, label);
    assert.equal(classification.actionRecommendation, "investigate_selector", label);
  }
});

test("tion remains green for every headline profile and diagnostic selector band", () => {
  const tionCells = [
    findCell("tion", "needs_support"),
    findCell("tion", "secure_expected"),
    findCell("tion", "early_stretch"),
    findCell("tion", "core_developing", "diagnostic_selector_band"),
  ];
  for (const cell of tionCells) {
    assert.equal(cell.status, "green");
    assert.equal(cell.selectedExactTargetCount, 4);
    assert.equal(cell.requestedTargetCount, 4);
    assert.equal(cell.targetBufferProbe.availableCount, TARGET_BUFFER_COUNT);
    assert.equal(cell.widenedDifficultyWindowRequired, false);
    assert.equal(cell.coverageClassification.category, "none");
  }
});

test("classification layer preserves selected words, counts, and parity-sensitive signatures", () => {
  const ee = findCell("ee", "early_stretch");
  assert.deepEqual(Array.from(ee.selectedWords, (word) => String(word.word)), [
    "eyesight",
    "reappear",
    "repair",
    "toadstool",
    "between",
    "screech",
    "beehive",
    "agree",
    "cheerleader",
    "seesawing",
  ]);
  assert.deepEqual(ee.roleCounts, { review: 4, target: 4, stretch: 2 });
  assert.deepEqual(ee.supportCounts, { independent: 6, supported: 4 });
  assert.deepEqual(ee.questionTypeCounts, { no_support_assessment: 6, segmented_spelling: 4 });

  const ure = findCell("ure", "needs_support");
  assert.deepEqual(Array.from(ure.selectedWords, (word) => String(word.word)), [
    "about",
    "carve",
    "horse",
    "mainly",
    "unsure",
    "creature",
    "border",
    "employer",
    "screen",
    "after",
  ]);
  assert.deepEqual(ure.roleCounts, { review: 6, target: 2, stretch: 2 });
  assert.deepEqual(ure.supportCounts, { independent: 6, focus: 1, supported: 3 });
  assert.deepEqual(ure.questionTypeCounts, { no_support_assessment: 6, focus_sound: 1, segmented_spelling: 3 });
  assert.equal(REPORT.cells.every((cell) => cell.browserEdgeParity.match), true);
});

test("incomplete assignment red cells are coverage issues, not selector-logic failures", () => {
  const selectorLogicFailures = buildSelectorLogicFailures({
    focus: "tion",
    profileId: "needs_support",
    duplicateWords: [],
    invalidSelections: [],
    parityMatch: true,
    cooldownPressure: {
      status: "not_applicable_no_target_candidate",
      canRelaxSafely: false,
    },
  });
  const status = gradeCell({
    completeAssignment: false,
    selectedExactCount: 0,
    requestedTargetCount: 4,
    requestedAvailableCount: 0,
    bufferAvailableCount: 0,
    wideningRequired: false,
    lowBankWarningCount: 0,
    targetShortfall: 4,
    selectorLogicFailureCount: selectorLogicFailures.length,
  });

  assert.deepEqual(selectorLogicFailures, []);
  assert.equal(status, "red");
  assert.equal(classifyIssue({ selectorLogicFailureCount: selectorLogicFailures.length, status }), "coverage");
});

test("summary formatter prints a concise human summary without the full JSON payload", () => {
  const lines = captureConsoleLog(() => printCoreBankSelectorCoverageSummary(REPORT));
  assert.equal(lines[0], "CORE_BANK_SELECTOR_COVERAGE_AUDIT_SUMMARY");
  assert.ok(lines.some((line) => line.startsWith("headlineProfiles needs_support,secure_expected,early_stretch")));
  assert.ok(lines.some((line) => line.startsWith("diagnosticSelectorBands core_developing")));
  assert.ok(lines.some((line) => line === "acceptedAmberCount 19"));
  assert.ok(lines.some((line) => line === "actionableAmberCount 1"));
  assert.ok(lines.some((line) => line.includes("expected_widening:18")));
  assert.ok(lines.some((line) => line.includes("ee/early_stretch insufficient_target_buffer action:top_up_buffer")));
  assert.ok(lines.some((line) => line.includes("profile_target_mismatch:1")));
  assert.equal(lines.some((line) => line.startsWith("CORE_BANK_SELECTOR_COVERAGE_AUDIT_JSON ")), false);
  assert.equal(lines.some((line) => line.includes('"cells"')), false);
});

test("JSON-only payload is parseable and contains complete classification data", () => {
  const payload = JSON.stringify(REPORT);
  assert.equal(payload.includes("CORE_BANK_SELECTOR_COVERAGE_AUDIT_JSON"), false);
  const parsed = JSON.parse(payload);
  assert.equal(parsed.auditVersion, AUDIT_VERSION);
  assert.equal(parsed.totals.cellCount, REPORT.totals.cellCount);
  assert.equal(parsed.acceptedAmberCount, 19);
  assert.equal(parsed.actionableAmberCount, 1);
  assert.equal(parsed.cells.every((cell) => cell.coverageClassification && cell.targetSupplyProbe), true);
  assert.equal(parsed.acceptedAmberCells.some((cell) => cell.focusGrapheme === "ure" && cell.profileId === "needs_support"), true);
  assert.deepEqual(parsed.actionableAmberCells.map(cellKey), ["ee/early_stretch"]);
});
