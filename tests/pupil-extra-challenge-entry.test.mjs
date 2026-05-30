import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildExtraChallengeCardModel,
  findActiveExtraChallengeAssignment,
  getRequiredCoreAssignments,
  hasCompletedRequiredCoreAssignment,
  hasIncompleteRequiredCoreAssignment,
  isRequiredCoreAssignment,
} = await loadBrowserModule("../js/pupilExtraChallenge.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function assignment({
  id = "task-1",
  evidenceSource = "assigned_core",
  attemptSource = "teacher_assigned",
  completed = false,
  isBaseline = false,
  isSpellingBee = false,
  mode = "test",
} = {}) {
  return {
    id,
    evidence_source: evidenceSource,
    assignment_source: evidenceSource,
    attempt_source: attemptSource,
    completed,
    completedAt: completed ? "2026-05-01T09:00:00.000Z" : null,
    isBaseline,
    isSpellingBee,
    mode,
  };
}

const PUPIL_ID = "11111111-1111-4111-8111-111111111111";

test("required core detection excludes baseline Spelling Bee practice and extra challenge", () => {
  const rows = [
    assignment({ id: "core", completed: true }),
    assignment({ id: "baseline", isBaseline: true, attemptSource: "baseline", completed: true }),
    assignment({ id: "bee", isSpellingBee: true, attemptSource: "spelling_bee" }),
    assignment({ id: "practice", attemptSource: "practice", mode: "practice" }),
    assignment({ id: "extra", evidenceSource: "extra_challenge", attemptSource: "extra_challenge" }),
  ];

  assert.equal(isRequiredCoreAssignment(rows[0]), true);
  assert.equal(isRequiredCoreAssignment(rows[1]), false);
  assert.equal(isRequiredCoreAssignment(rows[2]), false);
  assert.equal(isRequiredCoreAssignment(rows[3]), false);
  assert.equal(isRequiredCoreAssignment(rows[4]), false);
  assert.deepEqual(getRequiredCoreAssignments(rows).map((row) => row.id), ["core"]);
});

test("assigned core teacher assignments remain required core when mode is practice", () => {
  const row = assignment({
    id: "teacher-practice-mode",
    attemptSource: "teacher_assigned",
    mode: "practice",
  });

  assert.equal(isRequiredCoreAssignment(row), true);
});

test("assigned core auto assignments remain required core when mode is practice", () => {
  const row = assignment({
    id: "auto-practice-mode",
    attemptSource: "auto_assigned",
    mode: "practice",
  });

  assert.equal(isRequiredCoreAssignment(row), true);
});

test("attempt source practice is excluded from required core", () => {
  const row = assignment({
    id: "practice-source",
    attemptSource: "practice",
    mode: "test",
  });

  assert.equal(isRequiredCoreAssignment(row), false);
});

test("hidden when a required core assignment is incomplete", () => {
  const rows = [
    assignment({ id: "done", completed: true }),
    assignment({ id: "waiting", completed: false }),
  ];

  assert.equal(hasIncompleteRequiredCoreAssignment(rows), true);
  assert.equal(buildExtraChallengeCardModel({ assignments: rows, pupilId: PUPIL_ID }), null);
});

test("hidden when no core assignment has been completed", () => {
  const rows = [];

  assert.equal(hasCompletedRequiredCoreAssignment(rows), false);
  assert.equal(buildExtraChallengeCardModel({ assignments: rows, pupilId: PUPIL_ID }), null);
});

test("hidden when only baseline practice or Spelling Bee exists", () => {
  const rows = [
    assignment({ id: "baseline", isBaseline: true, attemptSource: "baseline", completed: true }),
    assignment({ id: "practice", attemptSource: "practice", mode: "practice", completed: true }),
    assignment({ id: "bee", isSpellingBee: true, attemptSource: "spelling_bee", completed: true }),
  ];

  assert.equal(buildExtraChallengeCardModel({ assignments: rows, pupilId: PUPIL_ID }), null);
});

test("start state appears when all required core assignments are complete", () => {
  const model = buildExtraChallengeCardModel({
    pupilId: PUPIL_ID,
    assignments: [
      assignment({ id: "core-1", completed: true }),
      assignment({ id: "core-2", completed: true, attemptSource: "auto_assigned" }),
    ],
  });

  assert.equal(model?.state, "start");
  assert.equal(model?.title, "Ready for another challenge?");
  assert.equal(model?.body, "Today's required work is complete. Wordloom can build a short challenge just for you.");
  assert.equal(model?.buttonLabel, "Start my challenge");
});

test("continue state appears when an active extra challenge exists", () => {
  const rows = [
    assignment({ id: "core-1", completed: true }),
    assignment({ id: "extra-1", evidenceSource: "extra_challenge", attemptSource: "extra_challenge" }),
  ];
  const model = buildExtraChallengeCardModel({ assignments: rows, pupilId: PUPIL_ID });

  assert.equal(findActiveExtraChallengeAssignment(rows)?.id, "extra-1");
  assert.equal(model?.state, "continue");
  assert.equal(model?.body, "You have a challenge waiting.");
  assert.equal(model?.buttonLabel, "Continue my challenge");
  assert.equal(model?.assignmentId, "extra-1");
});

test("completed extra challenge alone does not make the start card eligible", () => {
  const rows = [
    assignment({
      id: "extra-complete",
      evidenceSource: "extra_challenge",
      attemptSource: "extra_challenge",
      completed: true,
    }),
  ];

  assert.equal(buildExtraChallengeCardModel({ assignments: rows, pupilId: PUPIL_ID }), null);
});

test("missing pupil id hides the card", () => {
  const rows = [assignment({ id: "core-1", completed: true })];
  assert.equal(buildExtraChallengeCardModel({ assignments: rows, pupilId: " " }), null);
});

let failures = 0;
for (const { name, fn } of TESTS) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures) {
  process.exitCode = 1;
} else {
  console.log(`all ${TESTS.length} pupil extra challenge entry checks passed`);
}
