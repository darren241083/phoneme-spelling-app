import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIT_NOW_ISO,
  AUDIT_VERSION,
  buildCoreBankSelectorCoverageAuditReport,
  buildSelectorLogicFailures,
  classifyIssue,
  gradeCell,
  printCoreBankSelectorCoverageSummary,
} from "../../scripts/audit/core-bank-selector-coverage-audit.mjs";

const REPORT = buildCoreBankSelectorCoverageAuditReport();

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
});

test("each matrix cell includes required selector coverage and cooldown fields", () => {
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
    assert.ok(Array.isArray(cell.duplicateWords));
    assert.ok(Array.isArray(cell.invalidSelections));
    assert.equal(typeof cell.browserEdgeParity.match, "boolean");
    assert.ok(cell.cooldownPressure);
    assert.ok(["relaxed_safely", "not_applicable_no_target_candidate", "failed", "audit_integrity_missing_candidate_row"].includes(cell.cooldownPressure.status));
    assert.ok(Array.isArray(cell.selectedWords));

    if (!cell.completeAssignment && cell.selectorLogicFailures.length === 0) {
      assert.equal(cell.status, "red");
      assert.equal(cell.issueClass, "coverage");
    }
    if (cell.status === "red" && cell.issueClass === "coverage") {
      assert.equal(cell.selectorLogicFailures.length, 0);
    }
  }
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

test("summary formatter prints the human summary and final JSON marker", () => {
  const lines = captureConsoleLog(() => printCoreBankSelectorCoverageSummary(REPORT));
  assert.equal(lines[0], "CORE_BANK_SELECTOR_COVERAGE_AUDIT_SUMMARY");
  assert.ok(lines.some((line) => line.startsWith("headlineProfiles needs_support,secure_expected,early_stretch")));
  assert.ok(lines.some((line) => line.startsWith("diagnosticSelectorBands core_developing")));
  const marker = lines.find((line) => line.startsWith("CORE_BANK_SELECTOR_COVERAGE_AUDIT_JSON "));
  assert.ok(marker);
  const parsed = JSON.parse(marker.replace(/^CORE_BANK_SELECTOR_COVERAGE_AUDIT_JSON /, ""));
  assert.equal(parsed.auditVersion, AUDIT_VERSION);
  assert.equal(parsed.auditIntegrity.passed, true);
});

test("JSON-only payload is parseable and contains no summary marker", () => {
  const payload = JSON.stringify(REPORT);
  assert.equal(payload.includes("CORE_BANK_SELECTOR_COVERAGE_AUDIT_JSON"), false);
  const parsed = JSON.parse(payload);
  assert.equal(parsed.auditVersion, AUDIT_VERSION);
  assert.equal(parsed.totals.cellCount, REPORT.totals.cellCount);
});
