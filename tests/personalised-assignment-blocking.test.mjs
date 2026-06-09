import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildActiveAssignedCorePersonalisedAssignmentMap,
  isAssignedCorePersonalisedAutomationAssignment,
} = await loadBrowserModule("../js/personalisedAssignmentBlocking.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function assignment({
  id,
  evidenceSource,
  automationKind = "personalised",
  automationSource = "manual_run_now",
  testId = "generated-test",
} = {}) {
  const row = {
    id,
    class_id: "class-one",
    test_id: testId,
    automation_kind: automationKind,
    automation_source: automationSource,
    tests: { title: `${id} title` },
  };
  if (evidenceSource !== undefined) row.evidence_source = evidenceSource;
  return row;
}

const testsById = new Map([
  ["generated-test", { test_words: [{ generatedByEngine: true }] }],
  ["manual-test", { test_words: [{ generatedByEngine: false }] }],
]);
const isFullyGeneratedAssignmentWordRows = (rows = []) =>
  rows.length > 0 && rows.every((row) => row?.generatedByEngine === true);

test("assigned-core personalised assignments remain blocking candidates", () => {
  assert.equal(
    isAssignedCorePersonalisedAutomationAssignment(
      assignment({ id: "core-active", evidenceSource: "assigned_core" }),
      testsById,
      { isFullyGeneratedAssignmentWordRows }
    ),
    true
  );
});

test("extra challenge assignments are not assigned-core blocking candidates", () => {
  assert.equal(
    isAssignedCorePersonalisedAutomationAssignment(
      assignment({ id: "extra-active", evidenceSource: "extra_challenge" }),
      testsById,
      { isFullyGeneratedAssignmentWordRows }
    ),
    false
  );
});

test("missing legacy evidence source is treated as assigned-core", () => {
  assert.equal(
    isAssignedCorePersonalisedAutomationAssignment(
      assignment({
        id: "legacy-generated",
        automationKind: "",
        automationSource: "",
      }),
      testsById,
      { isFullyGeneratedAssignmentWordRows }
    ),
    true
  );
});

test("active assigned-core blocks while completed assigned-core and extra challenges do not", () => {
  const activeByPupil = buildActiveAssignedCorePersonalisedAssignmentMap({
    assignments: [
      assignment({ id: "core-active", evidenceSource: "assigned_core" }),
      assignment({ id: "core-completed", evidenceSource: "assigned_core" }),
      assignment({ id: "extra-active", evidenceSource: "extra_challenge" }),
      assignment({ id: "extra-completed", evidenceSource: "extra_challenge" }),
      assignment({ id: "legacy-active", automationKind: "", automationSource: "" }),
    ],
    testsById,
    targetRows: [
      { assignment_id: "core-active", pupil_id: "pupil-core-active" },
      { assignment_id: "core-completed", pupil_id: "pupil-core-completed" },
      { assignment_id: "extra-active", pupil_id: "pupil-extra-active" },
      { assignment_id: "extra-completed", pupil_id: "pupil-extra-completed" },
      { assignment_id: "legacy-active", pupil_id: "pupil-legacy-active" },
    ],
    statusRows: [
      { assignment_id: "core-active", pupil_id: "pupil-core-active", status: "started" },
      { assignment_id: "core-completed", pupil_id: "pupil-core-completed", status: "completed" },
      { assignment_id: "extra-active", pupil_id: "pupil-extra-active", status: "assigned" },
      { assignment_id: "extra-completed", pupil_id: "pupil-extra-completed", completed_at: "2026-05-31T10:00:00Z" },
      { assignment_id: "legacy-active", pupil_id: "pupil-legacy-active", status: "assigned" },
    ],
    pupilIds: [
      "pupil-core-active",
      "pupil-core-completed",
      "pupil-extra-active",
      "pupil-extra-completed",
      "pupil-legacy-active",
    ],
    isFullyGeneratedAssignmentWordRows,
  });

  assert.deepEqual(plain([...activeByPupil.keys()]), [
    "pupil-core-active",
    "pupil-legacy-active",
  ]);
  assert.equal(activeByPupil.get("pupil-core-active").assignmentId, "core-active");
  assert.equal(activeByPupil.get("pupil-legacy-active").assignmentId, "legacy-active");
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}
