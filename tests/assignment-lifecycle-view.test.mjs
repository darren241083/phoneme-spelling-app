import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildAssignmentDueDateEditModel,
  buildAssignmentLifecycleModel,
  buildDuplicateManualAssignmentWarningModel,
  groupAssignmentLifecycleInputs,
  validateAssignmentDueDateExtension,
} = await loadBrowserModule("../js/assignmentLifecycleView.js", import.meta.url);

const NOW = new Date("2026-05-26T12:00:00.000Z");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function assignment(overrides = {}) {
  return {
    id: "assignment-1",
    class_id: "class-a",
    test_id: "test-a",
    created_at: "2026-05-20T09:00:00.000Z",
    end_at: "2026-06-01T09:00:00.000Z",
    ...overrides,
  };
}

function status(pupilId, overrides = {}) {
  return {
    assignment_id: "assignment-1",
    pupil_id: pupilId,
    status: "assigned",
    created_at: "2026-05-20T09:00:00.000Z",
    updated_at: "2026-05-20T09:00:00.000Z",
    ...overrides,
  };
}

function target(pupilId, overrides = {}) {
  return {
    assignment_id: "assignment-1",
    pupil_id: pupilId,
    created_at: "2026-05-20T09:00:00.000Z",
    ...overrides,
  };
}

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

test("completed assignment is marked complete with completed counts", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment(),
    rosterPupilIds: ["pupil-1", "pupil-2"],
    statusRows: [
      status("pupil-1", { status: "completed", completed_at: "2026-05-22T09:00:00.000Z" }),
      status("pupil-2", { status: "completed", completed_at: "2026-05-22T10:00:00.000Z" }),
    ],
    now: NOW,
  });

  assert.equal(model.key, "complete");
  assert.equal(model.completedCount, 2);
  assert.equal(model.waitingCount, 0);
});

test("in-progress assignment is marked in progress", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment(),
    rosterPupilIds: ["pupil-1", "pupil-2"],
    statusRows: [
      status("pupil-1", { status: "started", started_at: "2026-05-25T09:00:00.000Z" }),
      status("pupil-2"),
    ],
    now: NOW,
  });

  assert.equal(model.key, "in_progress");
  assert.equal(model.startedCount, 1);
  assert.equal(model.waitingCount, 1);
});

test("waiting assignment is marked waiting when nobody has started", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment(),
    rosterPupilIds: ["pupil-1", "pupil-2", "pupil-3"],
    statusRows: [],
    now: NOW,
  });

  assert.equal(model.key, "waiting");
  assert.equal(model.waitingCount, 3);
});

test("overdue incomplete assignment is marked expired", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment({ end_at: "2026-05-25T09:00:00.000Z" }),
    rosterPupilIds: ["pupil-1", "pupil-2"],
    statusRows: [status("pupil-1", { status: "started", started_at: "2026-05-25T08:00:00.000Z" })],
    now: NOW,
  });

  assert.equal(model.key, "expired");
  assert.match(model.warning, /deadline has passed/);
});

test("old incomplete assignment with no recent activity is marked stale", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment({
      created_at: "2026-05-01T09:00:00.000Z",
      end_at: "2026-06-15T09:00:00.000Z",
    }),
    rosterPupilIds: ["pupil-1"],
    statusRows: [status("pupil-1", {
      created_at: "2026-05-01T09:00:00.000Z",
      updated_at: "2026-05-01T09:00:00.000Z",
    })],
    now: NOW,
    staleDays: 14,
  });

  assert.equal(model.key, "stale");
  assert.match(model.warning, /no pupil activity/);
});

test("recent no-deadline assignment is marked no deadline", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment({ end_at: null, created_at: "2026-05-25T09:00:00.000Z" }),
    rosterPupilIds: ["pupil-1", "pupil-2"],
    statusRows: [],
    now: NOW,
  });

  assert.equal(model.key, "no_deadline");
  assert.equal(model.totalPupilCount, 2);
});

test("generated assignment with targeted pupils uses target rows as pupil total", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment(),
    rosterPupilIds: ["pupil-1", "pupil-2", "pupil-3", "pupil-4"],
    targetRows: [target("pupil-1"), target("pupil-2")],
    statusRows: [status("pupil-1", { status: "completed", completed_at: "2026-05-24T09:00:00.000Z" })],
    now: NOW,
  });

  assert.equal(model.key, "waiting");
  assert.equal(model.totalPupilCount, 2);
  assert.equal(model.targetedPupilCount, 2);
  assert.equal(model.completedCount, 1);
  assert.equal(model.waitingCount, 1);
});

test("missing participant data is marked needs attention", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment(),
    rosterPupilIds: [],
    statusRows: [],
    targetRows: [],
    now: NOW,
  });

  assert.equal(model.key, "needs_attention");
});

test("grouped lifecycle inputs return models by assignment id", () => {
  const grouped = groupAssignmentLifecycleInputs({
    assignments: [assignment({ id: "assignment-1" })],
    membershipRows: [
      { class_id: "class-a", pupil_id: "pupil-1" },
      { class_id: "class-a", pupil_id: "pupil-2" },
    ],
    statusRows: [status("pupil-1", { completed_at: "2026-05-24T09:00:00.000Z" })],
    targetRows: [],
    now: NOW,
  });

  assert.equal(grouped["assignment-1"].totalPupilCount, 2);
  assert.equal(grouped["assignment-1"].completedCount, 1);
});

test("duplicate manual assignment warning finds the latest matching assignment", () => {
  const warning = buildDuplicateManualAssignmentWarningModel({
    assignments: [
      assignment({ id: "older", created_at: "2026-05-20T09:00:00.000Z" }),
      assignment({ id: "newer", created_at: "2026-05-21T09:00:00.000Z" }),
      assignment({ id: "other-class", class_id: "class-b", created_at: "2026-05-22T09:00:00.000Z" }),
    ],
    testId: "test-a",
    classId: "class-a",
  });

  assert.deepEqual(plain({
    hasDuplicate: warning.hasDuplicate,
    assignmentId: warning.assignmentId,
    message: warning.message,
  }), {
    hasDuplicate: true,
    assignmentId: "newer",
    message: "This class already has an assignment for this test. You can still assign it again, but check the existing assignment first.",
  });
});

test("due date edit model allows owned teacher-created assignment without a due date", () => {
  const model = buildAssignmentDueDateEditModel({
    assignment: assignment({ end_at: null }),
    lifecycle: { key: "no_deadline", completedCount: 0, totalPupilCount: 2 },
    sourceKey: "teacher_created",
    canManage: true,
    now: NOW,
  });

  assert.equal(model.canEdit, true);
  assert.equal(model.reason, "editable");
  assert.equal(model.actionLabel, "Add due date");
});

test("due date edit model allows owned personalised assignment with a due date", () => {
  const model = buildAssignmentDueDateEditModel({
    assignment: assignment({ end_at: "2026-06-01T09:00:00.000Z" }),
    lifecycle: { key: "waiting", completedCount: 0, totalPupilCount: 2 },
    sourceKey: "generated_by_policy",
    canManage: true,
    now: NOW,
  });

  assert.equal(model.canEdit, true);
  assert.equal(model.reason, "editable");
  assert.equal(model.actionLabel, "Extend due date");
  assert.equal(model.currentDueAt, "2026-06-01T09:00:00.000Z");
});

test("due date edit model blocks protected assignment sources", () => {
  for (const sourceKey of ["baseline", "spelling_bee", "extra_challenge"]) {
    const model = buildAssignmentDueDateEditModel({
      assignment: assignment(),
      lifecycle: { key: "waiting", completedCount: 0, totalPupilCount: 2 },
      sourceKey,
      canManage: true,
      now: NOW,
    });

    assert.equal(model.canEdit, false);
    assert.equal(model.reason, "protected_source");
  }
});

test("due date edit model blocks completed and non-owned assignments", () => {
  const completed = buildAssignmentDueDateEditModel({
    assignment: assignment(),
    lifecycle: { key: "complete", completedCount: 2, totalPupilCount: 2 },
    sourceKey: "teacher_created",
    canManage: true,
    now: NOW,
  });
  const notOwned = buildAssignmentDueDateEditModel({
    assignment: assignment(),
    lifecycle: { key: "waiting", completedCount: 0, totalPupilCount: 2 },
    sourceKey: "teacher_created",
    canManage: false,
    now: NOW,
  });

  assert.equal(completed.canEdit, false);
  assert.equal(completed.reason, "complete");
  assert.equal(notOwned.canEdit, false);
  assert.equal(notOwned.reason, "not_owner");
});

test("due date validation rejects missing, past, and shortened future dates", () => {
  assert.deepEqual(plain(validateAssignmentDueDateExtension({
    assignment: assignment(),
    nextDueAt: "",
    now: NOW,
  })), {
    ok: false,
    error: "Choose a valid future due date.",
  });

  assert.deepEqual(plain(validateAssignmentDueDateExtension({
    assignment: assignment(),
    nextDueAt: "2026-05-25T09:00:00.000Z",
    now: NOW,
  })), {
    ok: false,
    error: "Choose a due date in the future.",
  });

  assert.deepEqual(plain(validateAssignmentDueDateExtension({
    assignment: assignment({ end_at: "2026-06-01T09:00:00.000Z" }),
    nextDueAt: "2026-05-30T09:00:00.000Z",
    now: NOW,
  })), {
    ok: false,
    error: "Choose a date later than the current due date.",
  });
});

test("due date validation allows adding or extending to a future date", () => {
  const added = validateAssignmentDueDateExtension({
    assignment: assignment({ end_at: null }),
    nextDueAt: "2026-05-27T09:00:00.000Z",
    now: NOW,
  });
  const extendedExpired = validateAssignmentDueDateExtension({
    assignment: assignment({ end_at: "2026-05-25T09:00:00.000Z" }),
    nextDueAt: "2026-05-27T09:00:00.000Z",
    now: NOW,
  });

  assert.deepEqual(plain(added), {
    ok: true,
    error: "",
    nextDueAt: "2026-05-27T09:00:00.000Z",
  });
  assert.deepEqual(plain(extendedExpired), {
    ok: true,
    error: "",
    nextDueAt: "2026-05-27T09:00:00.000Z",
  });
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}
