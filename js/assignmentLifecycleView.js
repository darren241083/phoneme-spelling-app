export const ASSIGNMENT_LIFECYCLE_STALE_DAYS = 14;
export const ASSIGNMENT_LIFECYCLE_DUE_SOON_HOURS = 48;

export const ASSIGNMENT_LIFECYCLE_FILTER_OPTIONS = [
  { key: "live", label: "Live" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "ended", label: "Ended" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

const ASSIGNMENT_LIFECYCLE_FILTER_HELPERS = {
  live: "Live includes assignments pupils can still open, including assignments with no due date.",
  needs_attention: "Needs attention includes stale assignments and assignments whose pupil data needs checking.",
  ended: "Ended includes assignments that are no longer available to pupils.",
  completed: "Completed includes assignments finished by all known pupils.",
  all: "All shows every assignment lifecycle state in one view.",
};

export const ASSIGNMENT_LIFECYCLE_SECTION_OPTIONS = [
  { key: "stale", label: "Stale" },
  { key: "check_assignment_data", label: "Check assignment data" },
  { key: "ending_soon", label: "Ending soon" },
  { key: "due_later", label: "Due later" },
  { key: "no_due_date", label: "No due date" },
  { key: "ended", label: "Ended" },
  { key: "completed", label: "Completed" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_DUE_DATE_STEP_MS = 60 * 1000;
const ASSIGNMENT_DUE_DATE_EDITABLE_SOURCE_KEYS = new Set([
  "teacher_created",
  "generated_by_policy",
  "legacy_personalised",
]);
const ASSIGNMENT_CLOSE_ALLOWED_SOURCE_KEYS = new Set([
  "teacher_created",
  "generated_by_policy",
  "legacy_personalised",
]);

const STATE_META = {
  needs_attention: {
    key: "needs_attention",
    label: "Check assignment data",
    tone: "warning",
    detail: "Wordloom could not confirm who this assignment is for from the current data.",
  },
  waiting: {
    key: "waiting",
    label: "Not started",
    tone: "neutral",
    detail: "No pupils have started yet.",
  },
  in_progress: {
    key: "in_progress",
    label: "In progress",
    tone: "info",
    detail: "At least one pupil has started and the assignment is not complete.",
  },
  complete: {
    key: "complete",
    label: "Completed",
    tone: "success",
    detail: "All known pupils have completed this assignment.",
  },
  expired: {
    key: "expired",
    label: "Ended",
    tone: "warning",
    detail: "This assignment is no longer available. Its end time has passed.",
  },
  stale: {
    key: "stale",
    label: "Stale",
    tone: "warning",
    detail: `Still live, but no recent activity has been recorded for ${ASSIGNMENT_LIFECYCLE_STALE_DAYS} days.`,
  },
  no_deadline: {
    key: "no_deadline",
    label: "No due date",
    tone: "neutral",
    detail: "This assignment has no due date.",
  },
  unknown: {
    key: "unknown",
    label: "Check assignment data",
    tone: "neutral",
    detail: "Wordloom does not have enough lifecycle data to classify this assignment.",
  },
};

function cleanId(value = "") {
  return String(value || "").trim();
}

function uniqueIds(values = []) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(cleanId)
      .filter(Boolean)
  )];
}

function parseTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function getRowAssignmentId(row = {}) {
  return cleanId(row.assignment_id || row.assignmentId);
}

function getRowClassId(row = {}) {
  return cleanId(row.class_id || row.classId);
}

function getRowPupilId(row = {}) {
  return cleanId(row.pupil_id || row.pupilId);
}

function isStatusComplete(row = {}) {
  return !!(row.completed_at || row.completedAt)
    || String(row.status || "").trim().toLowerCase() === "completed"
    || String(row.status || "").trim().toLowerCase() === "complete";
}

function isStatusStarted(row = {}) {
  if (isStatusComplete(row)) return true;
  const status = String(row.status || "").trim().toLowerCase();
  return status === "started"
    || status === "in_progress"
    || !!(row.started_at || row.startedAt || row.last_opened_at || row.lastOpenedAt || row.last_activity_at || row.lastActivityAt);
}

function latestStatusTime(row = {}) {
  return Math.max(
    parseTime(row.completed_at || row.completedAt) || 0,
    parseTime(row.last_activity_at || row.lastActivityAt) || 0,
    parseTime(row.last_opened_at || row.lastOpenedAt) || 0,
    parseTime(row.started_at || row.startedAt) || 0,
    parseTime(row.updated_at || row.updatedAt) || 0,
    parseTime(row.created_at || row.createdAt) || 0,
  ) || null;
}

function getAssignmentDueAt(assignment = {}) {
  return assignment.deadline || assignment.end_at || assignment.endAt || null;
}

function getAssignmentCreatedAt(assignment = {}) {
  return assignment.created_at || assignment.createdAt || null;
}

function normalizeSourceKey(sourceKey = "") {
  return String(sourceKey || "").trim().toLowerCase();
}

function normalizeLifecycleKey(lifecycle = null) {
  return String(lifecycle?.key || "").trim().toLowerCase();
}

function isLifecycleComplete(lifecycle = null) {
  const total = Math.max(0, Number(lifecycle?.totalPupilCount || 0));
  const completed = Math.max(0, Number(lifecycle?.completedCount || 0));
  return normalizeLifecycleKey(lifecycle) === "complete" || (total > 0 && completed >= total);
}

export function buildAssignmentDueDateEditModel({
  assignment = null,
  lifecycle = null,
  sourceKey = "",
  canManage = false,
  now = new Date(),
} = {}) {
  const safeAssignment = assignment && typeof assignment === "object" ? assignment : {};
  const assignmentId = cleanId(safeAssignment.id);
  const normalizedSourceKey = normalizeSourceKey(sourceKey);
  const dueAt = lifecycle?.dueAt || getAssignmentDueAt(safeAssignment);
  const dueMs = parseTime(dueAt);
  const nowMs = parseTime(now) || Date.now();
  const currentDueAt = dueMs != null ? new Date(dueMs).toISOString() : null;
  const minDueAt = new Date(Math.max(nowMs, dueMs || 0) + MIN_DUE_DATE_STEP_MS).toISOString();

  const baseModel = {
    assignmentId,
    canEdit: false,
    reason: "unknown",
    sourceKey: normalizedSourceKey,
    currentDueAt,
    minDueAt,
    actionLabel: currentDueAt ? "Extend due date" : "Add due date",
    helperText: "Only the due date changes. Pupil work, completed results, and target words stay as they are.",
  };

  if (!assignmentId) return { ...baseModel, reason: "missing_assignment" };
  if (!canManage) return { ...baseModel, reason: "not_owner" };
  if (!ASSIGNMENT_DUE_DATE_EDITABLE_SOURCE_KEYS.has(normalizedSourceKey)) {
    return { ...baseModel, reason: "protected_source" };
  }
  if (isLifecycleComplete(lifecycle)) return { ...baseModel, reason: "complete" };

  return {
    ...baseModel,
    canEdit: true,
    reason: "editable",
  };
}

export function buildAssignmentCloseModel({
  assignment = null,
  lifecycle = null,
  sourceKey = "",
  canManage = false,
  now = new Date(),
} = {}) {
  const safeAssignment = assignment && typeof assignment === "object" ? assignment : {};
  const assignmentId = cleanId(safeAssignment.id);
  const normalizedSourceKey = normalizeSourceKey(sourceKey);
  const dueAt = lifecycle?.dueAt || getAssignmentDueAt(safeAssignment);
  const dueMs = parseTime(dueAt);
  const nowMs = parseTime(now) || Date.now();
  const currentDueAt = dueMs != null ? new Date(dueMs).toISOString() : null;

  const baseModel = {
    assignmentId,
    canClose: false,
    reason: "unknown",
    sourceKey: normalizedSourceKey,
    currentDueAt,
    actionLabel: "End assignment",
    confirmLabel: "End assignment",
    helperText: "This will stop pupils from opening this assignment. Existing results and evidence will be kept.",
  };

  if (!assignmentId) return { ...baseModel, reason: "missing_assignment" };
  if (!canManage) return { ...baseModel, reason: "not_owner" };
  if (!ASSIGNMENT_CLOSE_ALLOWED_SOURCE_KEYS.has(normalizedSourceKey)) {
    return { ...baseModel, reason: "protected_source" };
  }
  if (isLifecycleComplete(lifecycle)) return { ...baseModel, reason: "complete" };

  const lifecycleKey = normalizeLifecycleKey(lifecycle);
  if (lifecycleKey === "expired") return { ...baseModel, reason: "already_ended" };
  if (dueMs != null && dueMs <= nowMs) return { ...baseModel, reason: "already_ended" };

  return {
    ...baseModel,
    canClose: true,
    reason: "closable",
  };
}

export function validateAssignmentDueDateExtension({
  assignment = null,
  lifecycle = null,
  currentDueAt = "",
  nextDueAt = "",
  now = new Date(),
} = {}) {
  const safeAssignment = assignment && typeof assignment === "object" ? assignment : {};
  const rawNextDueAt = typeof nextDueAt === "string" ? nextDueAt.trim() : nextDueAt;
  const nextMs = parseTime(rawNextDueAt);

  if (!rawNextDueAt || nextMs == null) {
    return {
      ok: false,
      error: "Choose a valid future due date.",
    };
  }

  const nowMs = parseTime(now) || Date.now();
  if (nextMs <= nowMs) {
    return {
      ok: false,
      error: "Choose a due date in the future.",
    };
  }

  const currentRaw = currentDueAt || lifecycle?.dueAt || getAssignmentDueAt(safeAssignment);
  const currentMs = parseTime(currentRaw);
  if (currentMs != null && currentMs > nowMs && nextMs <= currentMs) {
    return {
      ok: false,
      error: "Choose a date later than the current due date.",
    };
  }

  return {
    ok: true,
    error: "",
    nextDueAt: new Date(nextMs).toISOString(),
  };
}

function getStateMeta(key) {
  return STATE_META[key] || STATE_META.unknown;
}

export function getAssignmentLifecycleDisplayMeta(modelOrKey = null, {
  staleDays = ASSIGNMENT_LIFECYCLE_STALE_DAYS,
} = {}) {
  const key = typeof modelOrKey === "string"
    ? String(modelOrKey || "").trim().toLowerCase()
    : String(modelOrKey?.key || "").trim().toLowerCase();
  const meta = getStateMeta(key);
  if (key !== "stale") return { ...meta };
  return {
    ...meta,
    detail: `Still live, but no recent activity has been recorded for ${Math.max(1, Number(staleDays || ASSIGNMENT_LIFECYCLE_STALE_DAYS))} days.`,
  };
}

function countKnownPupils({ rosterPupilIds, targetPupilIds, statusPupilIds }) {
  if (targetPupilIds.length) return targetPupilIds.length;
  if (rosterPupilIds.length) return rosterPupilIds.length;
  if (statusPupilIds.length) return statusPupilIds.length;
  return 0;
}

function buildWarningForState(key, { staleDays = ASSIGNMENT_LIFECYCLE_STALE_DAYS } = {}) {
  if (key === "expired") {
    return "Derived display signal: the deadline has passed before everyone completed.";
  }
  if (key === "stale") {
    return `Derived display signal: no pupil activity found in the last ${staleDays} days.`;
  }
  if (key === "needs_attention") {
    return "No active or targeted pupils were found in the current assignment data.";
  }
  return "";
}

export function buildAssignmentLifecycleModel({
  assignment = null,
  statusRows = [],
  targetRows = [],
  rosterPupilIds = [],
  now = new Date(),
  staleDays = ASSIGNMENT_LIFECYCLE_STALE_DAYS,
} = {}) {
  const safeAssignment = assignment && typeof assignment === "object" ? assignment : {};
  const assignmentId = cleanId(safeAssignment.id);
  const classId = cleanId(safeAssignment.class_id || safeAssignment.classId);
  const dueAt = getAssignmentDueAt(safeAssignment);
  const createdAt = getAssignmentCreatedAt(safeAssignment);
  const dueMs = parseTime(dueAt);
  const createdMs = parseTime(createdAt);
  const nowMs = parseTime(now) || Date.now();

  const filteredStatusRows = (Array.isArray(statusRows) ? statusRows : [])
    .filter((row) => !assignmentId || getRowAssignmentId(row) === assignmentId);
  const filteredTargetRows = (Array.isArray(targetRows) ? targetRows : [])
    .filter((row) => !assignmentId || getRowAssignmentId(row) === assignmentId);

  const targetPupilIds = uniqueIds(filteredTargetRows.map(getRowPupilId));
  const statusPupilIds = uniqueIds(filteredStatusRows.map(getRowPupilId));
  const safeRosterPupilIds = uniqueIds(rosterPupilIds);
  const totalPupilCount = countKnownPupils({
    rosterPupilIds: safeRosterPupilIds,
    targetPupilIds,
    statusPupilIds,
  });

  const completedPupilIds = new Set(
    filteredStatusRows
      .filter(isStatusComplete)
      .map(getRowPupilId)
      .filter(Boolean)
  );
  const startedPupilIds = new Set(
    filteredStatusRows
      .filter(isStatusStarted)
      .map(getRowPupilId)
      .filter(Boolean)
  );
  for (const pupilId of completedPupilIds) startedPupilIds.add(pupilId);

  const completedCount = completedPupilIds.size;
  const startedCount = startedPupilIds.size;
  const inProgressCount = Math.max(0, startedCount - completedCount);
  const waitingCount = totalPupilCount
    ? Math.max(0, totalPupilCount - startedCount)
    : filteredStatusRows.filter((row) => !isStatusStarted(row)).length;
  const lastStatusMs = Math.max(
    0,
    ...filteredStatusRows.map((row) => latestStatusTime(row) || 0),
  ) || null;
  const lastTargetMs = Math.max(
    0,
    ...filteredTargetRows.map((row) => parseTime(row.created_at || row.createdAt) || 0),
  ) || null;
  const lastActivityMs = Math.max(lastStatusMs || 0, lastTargetMs || 0, createdMs || 0) || null;
  const isComplete = totalPupilCount > 0 && completedCount >= totalPupilCount;
  const isExpired = !isComplete && dueMs != null && dueMs < nowMs;
  const staleBeforeMs = nowMs - Math.max(1, Number(staleDays || ASSIGNMENT_LIFECYCLE_STALE_DAYS)) * DAY_MS;
  const isStale = !isComplete
    && totalPupilCount > 0
    && lastActivityMs != null
    && lastActivityMs < staleBeforeMs
    && (!dueMs || dueMs >= nowMs);

  let key = "unknown";
  if (!totalPupilCount) key = "needs_attention";
  else if (isComplete) key = "complete";
  else if (isExpired) key = "expired";
  else if (isStale) key = "stale";
  else if (inProgressCount > 0) key = "in_progress";
  else if (!dueMs) key = "no_deadline";
  else if (waitingCount > 0) key = "waiting";

  const meta = getAssignmentLifecycleDisplayMeta(key, { staleDays });
  return {
    assignmentId,
    classId,
    key,
    label: meta.label,
    tone: meta.tone,
    detail: meta.detail,
    warning: buildWarningForState(key, { staleDays }),
    dueAt: dueAt || null,
    createdAt: createdAt || null,
    lastActivityAt: lastActivityMs ? new Date(lastActivityMs).toISOString() : null,
    startedCount,
    completedCount,
    inProgressCount,
    waitingCount,
    totalPupilCount,
    targetedPupilCount: targetPupilIds.length,
    statusPupilCount: statusPupilIds.length,
    rosterPupilCount: safeRosterPupilIds.length,
    hasCounts: totalPupilCount > 0,
    isDerivedDisplaySignal: key === "expired" || key === "stale",
  };
}

export function groupAssignmentLifecycleInputs({
  assignments = [],
  statusRows = [],
  targetRows = [],
  membershipRows = [],
  now = new Date(),
  staleDays = ASSIGNMENT_LIFECYCLE_STALE_DAYS,
} = {}) {
  const statusesByAssignment = new Map();
  for (const row of Array.isArray(statusRows) ? statusRows : []) {
    const assignmentId = getRowAssignmentId(row);
    if (!assignmentId) continue;
    const next = statusesByAssignment.get(assignmentId) || [];
    next.push(row);
    statusesByAssignment.set(assignmentId, next);
  }

  const targetsByAssignment = new Map();
  for (const row of Array.isArray(targetRows) ? targetRows : []) {
    const assignmentId = getRowAssignmentId(row);
    if (!assignmentId) continue;
    const next = targetsByAssignment.get(assignmentId) || [];
    next.push(row);
    targetsByAssignment.set(assignmentId, next);
  }

  const rosterByClass = new Map();
  for (const row of Array.isArray(membershipRows) ? membershipRows : []) {
    const classId = getRowClassId(row);
    const pupilId = getRowPupilId(row);
    if (!classId || !pupilId) continue;
    const next = rosterByClass.get(classId) || [];
    next.push(pupilId);
    rosterByClass.set(classId, uniqueIds(next));
  }

  return Object.fromEntries(
    (Array.isArray(assignments) ? assignments : [])
      .map((assignment) => {
        const assignmentId = cleanId(assignment?.id);
        if (!assignmentId) return null;
        const classId = cleanId(assignment?.class_id || assignment?.classId);
        return [
          assignmentId,
          buildAssignmentLifecycleModel({
            assignment,
            statusRows: statusesByAssignment.get(assignmentId) || [],
            targetRows: targetsByAssignment.get(assignmentId) || [],
            rosterPupilIds: rosterByClass.get(classId) || [],
            now,
            staleDays,
          }),
        ];
      })
      .filter(Boolean)
  );
}

export function getAssignmentLifecycleFilterKey(model = null) {
  const key = String(model?.key || "unknown");
  if (key === "complete") return "completed";
  if (key === "expired") return "ended";
  if (key === "stale" || key === "needs_attention" || key === "unknown") {
    return "needs_attention";
  }
  return "live";
}

export function getAssignmentLifecycleFilterHelper(filterKey = "live") {
  const key = String(filterKey || "").trim().toLowerCase();
  return ASSIGNMENT_LIFECYCLE_FILTER_HELPERS[key]
    || "Choose a lifecycle view to review assignments.";
}

export function doesAssignmentMatchLifecycleFilter(model = null, filterKey = "all") {
  const filter = String(filterKey || "all");
  if (filter === "all") return true;
  return getAssignmentLifecycleFilterKey(model) === filter;
}

export function buildAssignmentLifecycleFilterCounts(models = []) {
  const counts = {
    live: 0,
    needs_attention: 0,
    ended: 0,
    completed: 0,
    all: 0,
  };
  for (const model of Array.isArray(models) ? models : []) {
    counts.all += 1;
    const key = getAssignmentLifecycleFilterKey(model);
    if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
  }
  return counts;
}

export function getAssignmentLifecycleSectionKey(model = null, {
  now = new Date(),
  dueSoonHours = ASSIGNMENT_LIFECYCLE_DUE_SOON_HOURS,
} = {}) {
  const key = String(model?.key || "unknown").trim().toLowerCase();
  if (key === "stale") return "stale";
  if (key === "needs_attention" || key === "unknown") return "check_assignment_data";
  if (key === "expired") return "ended";
  if (key === "complete") return "completed";

  const dueMs = parseTime(model?.dueAt);
  if (dueMs == null) return "no_due_date";

  const nowMs = parseTime(now) || Date.now();
  const safeDueSoonHours = Math.max(1, Number(dueSoonHours || ASSIGNMENT_LIFECYCLE_DUE_SOON_HOURS));
  if (dueMs <= nowMs + safeDueSoonHours * HOUR_MS) return "ending_soon";
  return "due_later";
}

export function buildDuplicateManualAssignmentWarningModel({
  assignments = [],
  testId = "",
  classId = "",
  excludeAssignmentId = "",
} = {}) {
  const safeTestId = cleanId(testId);
  const safeClassId = cleanId(classId);
  const excluded = cleanId(excludeAssignmentId);
  if (!safeTestId || !safeClassId) {
    return {
      hasDuplicate: false,
      assignmentId: "",
      message: "",
    };
  }

  const matches = (Array.isArray(assignments) ? assignments : [])
    .filter((assignment) => {
      const assignmentId = cleanId(assignment?.id);
      return assignmentId
        && assignmentId !== excluded
        && cleanId(assignment?.test_id || assignment?.testId) === safeTestId
        && cleanId(assignment?.class_id || assignment?.classId) === safeClassId;
    })
    .sort((a, b) => (parseTime(b?.created_at || b?.createdAt) || 0) - (parseTime(a?.created_at || a?.createdAt) || 0));

  const duplicate = matches[0] || null;
  if (!duplicate) {
    return {
      hasDuplicate: false,
      assignmentId: "",
      message: "",
    };
  }

  return {
    hasDuplicate: true,
    assignmentId: cleanId(duplicate.id),
    createdAt: duplicate.created_at || duplicate.createdAt || null,
    deadline: getAssignmentDueAt(duplicate),
    message: "This class already has an assignment for this test. You can still assign it again, but check the existing assignment first.",
  };
}
