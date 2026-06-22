import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  ASSIGNMENT_LIFECYCLE_FILTER_OPTIONS,
  buildAssignmentCloseModel,
  buildAssignmentDueDateEditModel,
  buildAssignmentLifecycleFilterCounts,
  buildAssignmentLifecycleModel,
  buildAssignmentPupilFollowUpModel,
  buildDuplicateManualAssignmentWarningModel,
  doesAssignmentMatchLifecycleFilter,
  getAssignmentLifecycleDisplayMeta,
  getAssignmentLifecycleFilterKey,
  getAssignmentLifecycleFilterHelper,
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
    pupils: pupilId ? pupil(pupilId) : null,
    ...overrides,
  };
}

function target(pupilId, overrides = {}) {
  return {
    assignment_id: "assignment-1",
    pupil_id: pupilId,
    created_at: "2026-05-20T09:00:00.000Z",
    pupils: pupilId ? pupil(pupilId) : null,
    ...overrides,
  };
}

function pupil(pupilId, overrides = {}) {
  const suffix = String(pupilId || "").split("-").pop() || "1";
  return {
    id: pupilId,
    first_name: `Pupil ${suffix}`,
    surname: "Example",
    username: `pupil${suffix}`,
    ...overrides,
  };
}

function membership(pupilId, overrides = {}) {
  return {
    class_id: "class-a",
    pupil_id: pupilId,
    active: true,
    pupils: pupilId ? pupil(pupilId) : null,
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

test("old current Extra Challenge is optional practice instead of stale via evidence source", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment({
      evidence_source: "extra_challenge",
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

  assert.equal(model.key, "optional_practice");
  assert.equal(model.label, "Optional practice");
  assert.equal(model.isOptionalPractice, true);
  assert.equal(model.warning, "");
});

test("Extra Challenge is detected through assignment source", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment({
      assignment_source: "extra_challenge",
      created_at: "2026-05-01T09:00:00.000Z",
      end_at: null,
    }),
    rosterPupilIds: ["pupil-1"],
    statusRows: [],
    now: NOW,
  });

  assert.equal(model.key, "optional_practice");
  assert.equal(model.isOptionalPractice, true);
});

test("completed and expired Extra Challenges keep lifecycle precedence", () => {
  const completed = buildAssignmentLifecycleModel({
    assignment: assignment({
      evidence_source: "extra_challenge",
      end_at: "2026-05-25T09:00:00.000Z",
    }),
    rosterPupilIds: ["pupil-1"],
    statusRows: [status("pupil-1", {
      status: "completed",
      completed_at: "2026-05-24T09:00:00.000Z",
    })],
    now: NOW,
  });
  const expired = buildAssignmentLifecycleModel({
    assignment: assignment({
      evidence_source: "extra_challenge",
      end_at: "2026-05-25T09:00:00.000Z",
    }),
    rosterPupilIds: ["pupil-1"],
    statusRows: [status("pupil-1")],
    now: NOW,
  });

  assert.equal(completed.key, "complete");
  assert.equal(completed.label, "Completed");
  assert.equal(expired.key, "expired");
  assert.equal(expired.label, "Ended");
});

test("Extra Challenge with missing participants still needs data checking", () => {
  const model = buildAssignmentLifecycleModel({
    assignment: assignment({
      evidence_source: "extra_challenge",
      created_at: "2026-05-01T09:00:00.000Z",
    }),
    rosterPupilIds: [],
    statusRows: [],
    targetRows: [],
    now: NOW,
  });

  assert.equal(model.key, "needs_attention");
  assert.equal(model.isOptionalPractice, true);
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
    { key: "optional_practice" },
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
    "live",
    "needs_attention",
    "needs_attention",
    "needs_attention",
    "ended",
    "completed",
  ]);
  assert.deepEqual(plain(buildAssignmentLifecycleFilterCounts(models)), {
    live: 4,
    needs_attention: 3,
    ended: 1,
    completed: 1,
    all: 9,
  });
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "optional_practice" }, "live"), true);
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "optional_practice" }, "needs_attention"), false);
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "optional_practice" }, "all"), true);
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "waiting" }, "live"), true);
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "expired" }, "needs_attention"), false);
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "expired" }, "ended"), true);
  assert.equal(doesAssignmentMatchLifecycleFilter({ key: "complete" }, "all"), true);
});

test("lifecycle tabs provide filter-specific helper copy with a safe fallback", () => {
  assert.equal(
    getAssignmentLifecycleFilterHelper("live"),
    "Live includes assignments pupils can still open, including assignments with no due date."
  );
  assert.equal(
    getAssignmentLifecycleFilterHelper("needs_attention"),
    "Needs attention includes stale assignments and assignments whose pupil data needs checking."
  );
  assert.equal(
    getAssignmentLifecycleFilterHelper("ended"),
    "Ended includes assignments that are no longer available to pupils."
  );
  assert.equal(
    getAssignmentLifecycleFilterHelper("completed"),
    "Completed includes assignments finished by all known pupils."
  );
  assert.equal(
    getAssignmentLifecycleFilterHelper("all"),
    "All shows every assignment lifecycle state in one view."
  );
  assert.equal(
    getAssignmentLifecycleFilterHelper("not-a-filter"),
    "Choose a lifecycle view to review assignments."
  );
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
  assert.equal(getAssignmentLifecycleSectionKey({
    key: "optional_practice",
    dueAt: null,
  }, { now: NOW }), "optional_practice");
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
  assert.deepEqual(plain(getAssignmentLifecycleDisplayMeta("optional_practice")), {
    key: "optional_practice",
    label: "Optional practice",
    tone: "info",
    detail: "Optional extra challenges are pupil-led practice. No teacher follow-up is needed.",
  });
  assert.equal(getAssignmentLifecycleDisplayMeta("waiting").label, "Not started");
  assert.equal(getAssignmentLifecycleDisplayMeta("unknown").label, "Check assignment data");
});

test("grouped lifecycle inputs return models by assignment id", () => {
  const grouped = groupAssignmentLifecycleInputs({
    assignments: [assignment({ id: "assignment-1" })],
    membershipRows: [
      membership("pupil-1"),
      membership("pupil-2"),
    ],
    statusRows: [status("pupil-1", { completed_at: "2026-05-24T09:00:00.000Z" })],
    targetRows: [],
    now: NOW,
  });

  assert.equal(grouped["assignment-1"].totalPupilCount, 2);
  assert.equal(grouped["assignment-1"].completedCount, 1);
  assert.equal(grouped["assignment-1"].pupilFollowUp.counts.completed, 1);
  assert.equal(grouped["assignment-1"].pupilFollowUp.counts.not_started, 1);
});

test("pupil follow-up uses targeted pupils before roster and status pupils", () => {
  const model = buildAssignmentPupilFollowUpModel({
    assignment: assignment(),
    lifecycle: { key: "in_progress" },
    targetRows: [target("pupil-1"), target("pupil-2")],
    rosterRows: [membership("pupil-1"), membership("pupil-2"), membership("pupil-3")],
    statusRows: [
      status("pupil-1", { status: "completed", completed_at: "2026-05-24T09:00:00.000Z" }),
      status("pupil-3", { status: "started", started_at: "2026-05-25T09:00:00.000Z" }),
    ],
  });

  assert.equal(model.participantSource, "target");
  assert.equal(model.totalKnownParticipants, 2);
  assert.deepEqual(plain(model.groups.completed.map((row) => row.pupilId)), ["pupil-1"]);
  assert.deepEqual(plain(model.groups.not_started.map((row) => row.pupilId)), ["pupil-2"]);
  assert.equal(model.groups.in_progress.length, 0);
});

test("pupil follow-up uses active roster when no target rows exist", () => {
  const model = buildAssignmentPupilFollowUpModel({
    assignment: assignment(),
    lifecycle: { key: "in_progress" },
    rosterRows: [
      membership("pupil-1"),
      membership("pupil-2"),
      membership("pupil-3", { active: false }),
    ],
    statusRows: [
      status("pupil-1", { status: "started", started_at: "2026-05-25T09:00:00.000Z" }),
      status("pupil-3", { status: "completed", completed_at: "2026-05-25T10:00:00.000Z" }),
    ],
  });

  assert.equal(model.participantSource, "roster");
  assert.equal(model.totalKnownParticipants, 2);
  assert.deepEqual(plain(model.groups.in_progress.map((row) => row.pupilId)), ["pupil-1"]);
  assert.deepEqual(plain(model.groups.not_started.map((row) => row.pupilId)), ["pupil-2"]);
});

test("pupil follow-up falls back to status-row pupils", () => {
  const model = buildAssignmentPupilFollowUpModel({
    assignment: assignment(),
    lifecycle: { key: "in_progress" },
    statusRows: [
      status("pupil-1", { status: "started", started_at: "2026-05-25T09:00:00.000Z" }),
      status("pupil-2", { status: "completed", completed_at: "2026-05-25T10:00:00.000Z" }),
    ],
  });

  assert.equal(model.participantSource, "status");
  assert.equal(model.counts.in_progress, 1);
  assert.equal(model.counts.completed, 1);
});

test("pupil follow-up deduplicates repeated target and status rows", () => {
  const model = buildAssignmentPupilFollowUpModel({
    assignment: assignment(),
    lifecycle: { key: "in_progress" },
    targetRows: [
      target("pupil-1"),
      target("pupil-1", { created_at: "2026-05-21T09:00:00.000Z" }),
    ],
    statusRows: [
      status("pupil-1", { status: "started", started_at: "2026-05-25T09:00:00.000Z" }),
      status("pupil-1", { status: "in_progress", last_activity_at: "2026-05-25T10:00:00.000Z" }),
    ],
  });

  assert.equal(model.totalKnownParticipants, 1);
  assert.equal(model.counts.in_progress, 1);
  assert.equal(model.groups.in_progress[0].lastActivityAt, "2026-05-25T10:00:00.000Z");
});

test("pupil follow-up groups invalid, unnamed, and inconsistent records for checking", () => {
  const model = buildAssignmentPupilFollowUpModel({
    assignment: assignment(),
    lifecycle: { key: "in_progress" },
    rosterRows: [
      membership("pupil-1"),
      membership("pupil-2", { pupils: pupil("pupil-2", { first_name: "", surname: "" }) }),
      membership("pupil-3"),
      membership(null, { pupils: null }),
    ],
    statusRows: [
      status("pupil-1", { status: "paused" }),
      status("pupil-3", { status: "started", started_at: "2026-05-25T09:00:00.000Z" }),
      status("pupil-3", { status: "completed", completed_at: "2026-05-25T10:00:00.000Z" }),
    ],
  });

  assert.equal(model.counts.check_data, 4);
  assert.deepEqual(
    plain(model.groups.check_data.map((row) => row.reason).sort()),
    [
      "inconsistent_status_rows",
      "missing_pupil_id",
      "missing_pupil_identity",
      "unexpected_status",
    ]
  );
  assert.equal(
    model.groups.check_data.some((row) => row.displayName === "Pupil record unavailable"),
    true
  );
});

test("pupil follow-up treats mismatched embedded identity as inconsistent data", () => {
  const model = buildAssignmentPupilFollowUpModel({
    assignment: assignment(),
    lifecycle: { key: "waiting" },
    rosterRows: [
      membership("pupil-1", {
        pupils: pupil("pupil-other", { first_name: "Wrong", surname: "Pupil" }),
      }),
    ],
  });

  assert.equal(model.counts.check_data, 1);
  assert.equal(model.groups.check_data[0].reason, "inconsistent_pupil_identity");
});

test("pupil follow-up grouping is independent from lifecycle state", () => {
  const inputs = {
    assignment: assignment(),
    rosterRows: [membership("pupil-1"), membership("pupil-2")],
    statusRows: [status("pupil-1", {
      status: "completed",
      completed_at: "2026-05-25T09:00:00.000Z",
    })],
  };
  const waiting = buildAssignmentPupilFollowUpModel({ ...inputs, lifecycle: { key: "waiting" } });
  const ended = buildAssignmentPupilFollowUpModel({ ...inputs, lifecycle: { key: "expired" } });

  assert.deepEqual(plain(waiting.groups), plain(ended.groups));
});

test("pupil follow-up provides calm lifecycle decision hints", () => {
  const cases = [
    ["complete", "completed", /No follow-up is needed/],
    ["expired", "ended_incomplete", /Extending it would make it available again/],
    ["stale", "stale", /extend, end, or leave/],
    ["no_deadline", "no_due_date", /no due-date pressure/],
    ["waiting", "not_started", /still need the assignment/],
    ["needs_attention", "check_data", /Check the pupil information/],
  ];

  for (const [lifecycleKey, hintKey, copyPattern] of cases) {
    const model = buildAssignmentPupilFollowUpModel({
      assignment: assignment(),
      lifecycle: { key: lifecycleKey },
      rosterRows: [membership("pupil-1")],
      statusRows: lifecycleKey === "complete"
        ? [status("pupil-1", { status: "completed", completed_at: "2026-05-25T09:00:00.000Z" })]
        : [],
    });
    assert.equal(model.decisionHint.key, hintKey);
    assert.match(model.decisionHint.text, copyPattern);
  }
});

test("Extra Challenge pupil follow-up hint always uses optional-practice copy", () => {
  for (const lifecycleKey of ["optional_practice", "stale", "no_deadline", "needs_attention"]) {
    const model = buildAssignmentPupilFollowUpModel({
      assignment: assignment({ evidence_source: "extra_challenge" }),
      lifecycle: { key: lifecycleKey, isOptionalPractice: true },
      rosterRows: [membership("pupil-1")],
      statusRows: [],
    });

    assert.equal(model.decisionHint.key, "optional_practice");
    assert.equal(
      model.decisionHint.text,
      "This was an optional extra challenge. No follow-up is needed."
    );
    assert.doesNotMatch(model.decisionHint.text, /\b(extend|end|chase|leave alone)\b/i);
  }
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
