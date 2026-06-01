import {
  EVIDENCE_SOURCE_ASSIGNED_CORE,
  getAssignmentEvidenceSource,
} from "./evidenceSources.js?v=1.0";

const AUTOMATION_KIND_PERSONALISED = "personalised";
const AUTOMATION_SOURCE_MANUAL_RUN_NOW = "manual_run_now";

function normalizeKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeId(value = "") {
  return String(value || "").trim();
}

function isCompletedStatusRow(row = null) {
  return !!(row?.completed_at || row?.completedAt)
    || normalizeKey(row?.status) === "completed";
}

function hasAssignedCoreEvidenceSource(assignment = null) {
  const evidenceSource = getAssignmentEvidenceSource(assignment);
  return !evidenceSource || evidenceSource === EVIDENCE_SOURCE_ASSIGNED_CORE;
}

export function isAssignedCorePersonalisedAutomationAssignment(
  assignment,
  testsById = new Map(),
  { isFullyGeneratedAssignmentWordRows = () => false } = {}
) {
  if (!hasAssignedCoreEvidenceSource(assignment)) return false;

  const automationKind = normalizeKey(assignment?.automation_kind || assignment?.automationKind);
  const automationSource = normalizeKey(assignment?.automation_source || assignment?.automationSource);
  if (
    automationKind === AUTOMATION_KIND_PERSONALISED
    && automationSource === AUTOMATION_SOURCE_MANUAL_RUN_NOW
  ) {
    return true;
  }

  const testId = normalizeId(assignment?.test_id || assignment?.testId);
  const test = testsById && typeof testsById.get === "function"
    ? testsById.get(testId)
    : (testsById && typeof testsById === "object" ? testsById[testId] : null);
  return typeof isFullyGeneratedAssignmentWordRows === "function"
    ? isFullyGeneratedAssignmentWordRows(test?.test_words || test?.testWords || [])
    : false;
}

export function buildActiveAssignedCorePersonalisedAssignmentMap({
  assignments = [],
  testsById = new Map(),
  targetRows = [],
  statusRows = [],
  pupilIds = [],
  isFullyGeneratedAssignmentWordRows = () => false,
} = {}) {
  const safePupilIds = new Set((Array.isArray(pupilIds) ? pupilIds : [])
    .map((pupilId) => normalizeId(pupilId))
    .filter(Boolean));
  const shouldFilterPupils = safePupilIds.size > 0;
  const blockingAssignments = (Array.isArray(assignments) ? assignments : []).filter((assignment) =>
    isAssignedCorePersonalisedAutomationAssignment(assignment, testsById, {
      isFullyGeneratedAssignmentWordRows,
    })
  );
  const assignmentById = new Map(
    blockingAssignments
      .map((assignment) => [normalizeId(assignment?.id), assignment])
      .filter(([assignmentId]) => assignmentId)
  );
  const statusByKey = new Map(
    (Array.isArray(statusRows) ? statusRows : [])
      .map((row) => {
        const assignmentId = normalizeId(row?.assignment_id || row?.assignmentId);
        const pupilId = normalizeId(row?.pupil_id || row?.pupilId);
        return assignmentId && pupilId ? [`${assignmentId}::${pupilId}`, row] : null;
      })
      .filter(Boolean)
  );
  const activeByPupil = new Map();

  for (const row of Array.isArray(targetRows) ? targetRows : []) {
    const assignmentId = normalizeId(row?.assignment_id || row?.assignmentId);
    const pupilId = normalizeId(row?.pupil_id || row?.pupilId);
    if (!assignmentById.has(assignmentId) || !pupilId || activeByPupil.has(pupilId)) continue;
    if (shouldFilterPupils && !safePupilIds.has(pupilId)) continue;
    const statusRow = statusByKey.get(`${assignmentId}::${pupilId}`) || null;
    if (isCompletedStatusRow(statusRow)) continue;
    const assignment = assignmentById.get(assignmentId) || null;
    activeByPupil.set(pupilId, {
      assignmentId,
      classId: normalizeId(assignment?.class_id || assignment?.classId),
      title: String(assignment?.tests?.title || assignment?.test?.title || "").trim(),
    });
  }

  for (const row of Array.isArray(statusRows) ? statusRows : []) {
    const assignmentId = normalizeId(row?.assignment_id || row?.assignmentId);
    const pupilId = normalizeId(row?.pupil_id || row?.pupilId);
    if (!assignmentById.has(assignmentId) || !pupilId || activeByPupil.has(pupilId)) continue;
    if (shouldFilterPupils && !safePupilIds.has(pupilId)) continue;
    if (isCompletedStatusRow(row)) continue;
    const assignment = assignmentById.get(assignmentId) || null;
    activeByPupil.set(pupilId, {
      assignmentId,
      classId: normalizeId(assignment?.class_id || assignment?.classId),
      title: String(assignment?.tests?.title || assignment?.test?.title || "").trim(),
    });
  }

  return activeByPupil;
}
