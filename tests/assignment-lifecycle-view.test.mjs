import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  ASSIGNMENT_LIFECYCLE_FILTER_OPTIONS,
  buildAssignmentCloseModel,
  buildAssignmentDueDateEditModel,
  buildAssignmentLifecycleFilterCounts,
  buildAssignmentLifecycleModel,
  buildDuplicateManualAssignmentWarningModel,
  doesAssignmentMatchLifecycleFilter,
  getAssignmentLifecycleDisplayMeta,
  getAssignmentLifecycleFilterKey,
  getAssignmentLifecycleSectionKey,
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
  assert.equal(model.label, "Ended");
  assert.equal(model.detail, "This assignment is no longer available. Its end time has passed.");
  assert.match(model.warning, /deadline has passed/);
});

test("completed assignment outranks a past end date", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment({ end_at: "2026-05-25T09:00:00.000Z" }),
    rosterPupilIds: ["pupil-1", "pupil-2"],
    statusRows: [
      status("pupil-1", { status: "completed", completed_at: "2026-05-24T09:00:00.000Z" }),
      status("pupil-2", { status: "completed", completed_at: "2026-05-24T10:00:00.000Z" }),
    ],
    now: NOW,
  });

  assert.equal(model.key, "complete");
  assert.equal(model.label, "Completed");
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
  assert.equal(model.label, "Check assignment data");
});

test("lifecycle tabs map live attention ended completed and all states", () => {
  const models = [
    { key: "waiting" },
    { key: "in_progress" },
    { key: "no_deadline" },
    { key: "stale" },
    { key: "needs_attention" },
    { key: "unknown" },
    { key: "expired" },
    { key: "complete" },
  ];

  assert.deepEqual(
    plain(ASSIGNMENT_LIFECYCLE_FILTER_OPTIONS.map((option) => option.key)),
    ["live", "needs_attention", "ended", "completed", "all"]
  );
  assert.deepEqual(models.map(getAssignmentLifecycleFilterKey), [
    "live",
    "live",
    "live",
    "needs_attention",
    "needs_attention",
    "needs_attention",
    "ended",
    "completed",
  ]);
  assert.deepEqual(plain(buildAssignmentLifecycleFilterCounts(models)), {
    live: 3,
    needs_attention: 3,
    ended: 1,
    completed: 1,
    all: 8,
  });
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "waiting" }, "live"), true);
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "expired" }, "needs_attention"), false);
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "expired" }, "ended"), true);
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "complete" }, "all"), true);
});

test("ending-soon section includes the 48-hour boundary", () => {
  const atBoundary = getAssignmentLifecycleSectionKey({
    key: "waiting",
    dueAt: "2026-05-28T12:00:00.000Z",
  }, { now: NOW });
  const afterBoundary = getAssignmentLifecycleSectionKey({
    key: "waiting",
    dueAt: "2026-05-28T12:00:00.001Z",
  }, { now: NOW });

  assert.equal(atBoundary, "ending_soon");
  assert.equal(afterBoundary, "due_later");
});

test("lifecycle sections classify due no-date attention ended and completed states", () => {
  assert.equal(getAssignmentLifecycleSectionKey({
    key: "waiting",
    dueAt: "2026-06-10T12:00:00.000Z",
  }, { now: NOW }), "due_later");
  assert.equal(getAssignmentLifecycleSectionKey({
    key: "in_progress",
    dueAt: null,
  }, { now: NOW }), "no_due_date");
  assert.equal(getAssignmentLifecycleSectionKey({
    key: "stale",
    dueAt: "2026-06-10T12:00:00.000Z",
  }, { now: NOW }), "stale");
  assert.equal(getAssignmentLifecycleSectionKey({
    key: "needs_attention",
    dueAt: "2026-06-10T12:00:00.000Z",
  }, { now: NOW }), "check_assignment_data");
  assert.equal(getAssignmentLifecycleSectionKey({
    key: "unknown",
  }, { now: NOW }), "check_assignment_data");
  assert.equal(getAssignmentLifecycleSectionKey({
    key: "expired",
    dueAt: "2026-05-25T09:00:00.000Z",
  }, { now: NOW }), "ended");
  assert.equal(getAssignmentLifecycleSectionKey({
    key: "complete",
    dueAt: "2026-05-25T09:00:00.000Z",
  }, { now: NOW }), "completed");
});

test("teacher-facing display metadata distinguishes ended stale completed and waiting copy", () => {
  assert.deepEqual(plain(getAssignmentLifecycleDisplayMeta("expired")), {
    key: "expired",
    label: "Ended",
    tone: "warning",
    detail: "This assignment is no longer available. Its end time has passed.",
  });
  assert.equal(
    getAssignmentLifecycleDisplayMeta("stale", { staleDays: 14 }).detail,
    "Still live, but no recent activity has been recorded for 14 days."
  );
  assert.equal(getAssignmentLifecycleDisplayMeta("complete").label, "Completed");
  assert.equal(getAssignmentLifecycleDisplayMeta("no_deadline").label, "No due date");
  assert.equal(getAssignmentLifecycleDisplayMeta("waiting").label, "Not started");
  assert.equal(getAssignmentLifecycleDisplayMeta("unknown").label, "Check assignment data");
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

test("close model allows owned live teacher-created and personalised assignments", () => {
  const teacherCreated = buildAssignmentCloseModel({
    assignment: assignment({ end_at: "2026-06-01T09:00:00.000Z" }),
    lifecycle: { key: "waiting", completedCount: 0, totalPupilCount: 2, dueAt: "2026-06-01T09:00:00.000Z" },
    sourceKey: "teacher_created",
    canManage: true,
    now: NOW,
  });
  const personalised = buildAssignmentCloseModel({
    assignment: assignment({ end_at: null }),
    lifecycle: { key: "in_progress", completedCount: 1, totalPupilCount: 3 },
    sourceKey: "generated_by_policy",
    canManage: true,
    now: NOW,
  });

  assert.equal(teacherCreated.canClose, true);
  assert.equal(teacherCreated.reason, "closable");
  assert.equal(teacherCreated.actionLabel, "End assignment");
  assert.equal(personalised.canClose, true);
  assert.equal(personalised.reason, "closable");
});

test("close model blocks completed, already ended, and non-owned assignments", () => {
  const completed = buildAssignmentCloseModel({
    assignment: assignment(),
    lifecycle: { key: "complete", completedCount: 2, totalPupilCount: 2 },
    sourceKey: "teacher_created",
    canManage: true,
    now: NOW,
  });
  const expired = buildAssignmentCloseModel({
    assignment: assignment({ end_at: "2026-05-25T09:00:00.000Z" }),
    lifecycle: { key: "expired", completedCount: 1, totalPupilCount: 2, dueAt: "2026-05-25T09:00:00.000Z" },
    sourceKey: "teacher_created",
    canManage: true,
    now: NOW,
  });
  const notOwned = buildAssignmentCloseModel({
    assignment: assignment(),
    lifecycle: { key: "waiting", completedCount: 0, totalPupilCount: 2 },
    sourceKey: "teacher_created",
    canManage: false,
    now: NOW,
  });

  assert.equal(completed.canClose, false);
  assert.equal(completed.reason, "complete");
  assert.equal(expired.canClose, false);
  assert.equal(expired.reason, "already_ended");
  assert.equal(notOwned.canClose, false);
  assert.equal(notOwned.reason, "not_owner");
});

test("close model allows stale assignments when otherwise safe", () => {
  const stale = buildAssignmentCloseModel({
    assignment: assignment({ end_at: null }),
    lifecycle: { key: "stale", completedCount: 0, totalPupilCount: 2 },
    sourceKey: "teacher_created",
    canManage: true,
    now: NOW,
  });

  assert.equal(stale.canClose, true);
  assert.equal(stale.reason, "closable");
});

test("close model blocks protected assignment sources", () => {
  for (const sourceKey of ["baseline", "spelling_bee", "extra_challenge"]) {
    const model = buildAssignmentCloseModel({
      assignment: assignment(),
      lifecycle: { key: "waiting", completedCount: 0, totalPupilCount: 2 },
      sourceKey,
      canManage: true,
      now: NOW,
    });

    assert.equal(model.canClose, false);
    assert.equal(model.reason, "protected_source");
  }
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
