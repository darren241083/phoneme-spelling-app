import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildAnalyticsSummaryExportModel,
  buildAssignmentAnalyticsExportModel,
  buildExportFilename,
  buildScopedAnalyticsExportModel,
  EXCEL_UNAVAILABLE_MESSAGE,
  exportModelHasRows,
  sanitizeExportFileStem,
  serializeExportCsv,
  writeExportWorkbook,
} = await loadBrowserModule("../js/analyticsExport.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function stripBom(value) {
  return String(value || "").replace(/^\uFEFF/, "");
}

test("CSV serializes the configured primary sheet only and escapes values", () => {
  const model = buildAnalyticsSummaryExportModel({
    summary: {
      label: "Year 8, Set A",
      scopeType: "class",
      pupilCount: 1,
      activePupilCount: 1,
      classCount: 1,
      checkedWords: 4,
      accuracy: 0.75,
      firstTrySuccessRate: 0.5,
      averageAttempts: 1.5,
      pupilRows: [],
    },
    context: {
      primarySheetName: "Pupils",
      scopeTypeLabel: "Class",
      scopeLabel: "Year 8, Set A",
    },
    pupilRows: [
      {
        name: "Asha, Green",
        classNames: ["Year 8"],
        checkedWords: 4,
        accuracy: 0.75,
        firstTrySuccessRate: 0.5,
        averageAttempts: 1.5,
        signalLabel: "Developing",
        weakGraphemes: ["ai"],
        performanceRank: 1,
      },
    ],
  });

  const csv = stripBom(serializeExportCsv(model));
  assert.match(csv.split("\r\n")[0], /Pupil name/);
  assert.doesNotMatch(csv.split("\r\n")[0], /Scope type/);
  assert.match(csv, /"Asha, Green"/);
});

test("analytics export model keeps full supplied datasets across sheets", () => {
  const model = buildAnalyticsSummaryExportModel({
    summary: {
      label: "All classes",
      scopeType: "overview",
      pupilCount: 2,
      activePupilCount: 2,
      classCount: 1,
      checkedWords: 8,
      accuracy: 0.625,
      firstTrySuccessRate: 0.5,
      averageAttempts: 1.8,
      topConcern: "ee",
      topStrength: "sh",
    },
    context: {
      primarySheetName: "Classes",
      scopeTypeLabel: "All classes",
      scopeLabel: "All classes",
    },
    pupilRows: [
      { name: "Pupil One", checkedWords: 4, accuracy: 0.75 },
      { name: "Pupil Two", checkedWords: 4, accuracy: 0.5 },
    ],
    graphemeRows: [
      { target: "ee", total: 3, correct: 1, incorrect: 2, accuracy: 1 / 3, securityBand: "insecure" },
    ],
    classRows: [
      { className: "8A", yearGroup: "Year 8", pupilCount: 2, activePupilCount: 2, checkedWords: 8, accuracy: 0.625, performanceRank: 1 },
    ],
    timelineRows: [
      { dayKey: "2026-04-19", attemptCount: 8, correctCount: 5, pupilCount: 2, accuracy: 0.625 },
    ],
  });

  assert.equal(exportModelHasRows(model), true);
  assert.equal(model.sheets.find((sheet) => sheet.name === "Pupils").rows.length, 2);
  assert.equal(model.sheets.find((sheet) => sheet.name === "Graphemes").rows[0].band, "Needs review");
  assert.equal(model.sheets.find((sheet) => sheet.name === "Timeline").rows[0].attempts, 8);
});

test("assignment export includes pupils, word detail, and matrix sheets", () => {
  const analytics = {
    className: "8A",
    totalWords: 2,
    rosterCount: 1,
    completedCount: 1,
    wordColumns: [
      { id: "w1", word: "shape" },
      { id: "w2", word: "shine" },
    ],
    pupilRows: [
      {
        name: "Pupil One",
        status: "Complete",
        totalWords: 2,
        attemptedWords: 2,
        correctWords: 1,
        incorrectWords: 1,
        remainingWords: 0,
        checkedAccuracy: 0.5,
        firstTimeCorrectRate: 0.5,
        averageAttempts: 1.5,
        signalLabel: "Needs review",
        priorityTarget: "sh",
        wordResults: [
          {
            wordId: "w1",
            word: "shape",
            statusLabel: "Correct first go",
            correct: true,
            attemptsUsed: 1,
            latestAttempt: { typed: "shape", created_at: "2026-04-19T10:00:00Z", correct: true },
          },
          {
            wordId: "w2",
            word: "shine",
            statusLabel: "Not correct yet",
            correct: false,
            attemptsUsed: 2,
            latestAttempt: { typed: "shin", created_at: "2026-04-19T10:01:00Z", correct: false },
          },
        ],
      },
    ],
  };
  const model = buildAssignmentAnalyticsExportModel({
    analytics,
    assignment: { tests: { title: "Week 1" }, classes: { name: "8A" } },
    matrixRows: [{ ...analytics.pupilRows[0], accuracyRank: 1 }],
  });

  assert.equal(model.primarySheetName, "Pupils");
  assert.equal(model.sheets.find((sheet) => sheet.name === "Pupils").rows.length, 1);
  assert.equal(model.sheets.find((sheet) => sheet.name === "Words").rows.length, 2);
  assert.equal(model.sheets.find((sheet) => sheet.name === "Matrix").rows[0].word_2, "Not correct yet");
});

test("filename sanitising and XLSX unavailable handling are stable", () => {
  assert.equal(sanitizeExportFileStem("Year 8 / Set A Analytics!"), "year-8-set-a-analytics");
  assert.equal(buildExportFilename({ filenameStem: "Year 8" }, "xlsx"), "year-8.xlsx");
  assert.throws(
    () => writeExportWorkbook({ sheets: [] }, null),
    new RegExp(EXCEL_UNAVAILABLE_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

test("scoped attempts export produces a flat primary sheet", () => {
  const model = buildScopedAnalyticsExportModel({
    dataset: "attempts",
    viewLabel: "Pupil",
    scopeLabel: "All pupils",
    graphemeLabel: "sh",
    windowDays: 180,
    rows: [
      {
        pupil_name: "Pupil One",
        pupil_id: "p1",
        class_name: "8A",
        class_id: "c1",
        year_group: "Year 8",
        grapheme: "sh",
        word: "shine",
        typed_answer: "shin",
        assignment_name: "Week 1",
        assignment_type: "teacher_assigned",
        attempt_source: "teacher_assigned",
        timestamp: "2026-04-19T10:00:00Z",
        correct: "No",
        incorrect: "Yes",
        score: 0,
        accuracy: "0%",
        attempt_number: 1,
      },
    ],
  });

  const csv = stripBom(serializeExportCsv(model));
  assert.equal(model.primarySheetName, "Attempts");
  assert.match(csv.split("\r\n")[0], /pupil_name/);
  assert.match(csv, /Pupil One/);
  assert.equal(exportModelHasRows(model), true);
});

test("scoped summary export supports no-row handling", () => {
  const model = buildScopedAnalyticsExportModel({
    dataset: "summary",
    viewLabel: "Class",
    scopeLabel: "__all_classes__",
    graphemeLabel: "All graphemes",
    rows: [],
  });

  const csv = stripBom(serializeExportCsv(model));
  assert.equal(model.primarySheetName, "Summary");
  assert.match(csv.split("\r\n")[0], /attempts_count/);
  assert.equal(exportModelHasRows(model), false);
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}
