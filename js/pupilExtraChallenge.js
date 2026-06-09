import {
  EVIDENCE_SOURCE_ASSIGNED_CORE,
  EVIDENCE_SOURCE_EXTRA_CHALLENGE,
  getAssignmentEvidenceSource,
  isExtraChallengeAssignmentSource,
  normalizeAttemptSource,
} from "./evidenceSources.js?v=1.0";

export const EXTRA_CHALLENGE_CARD_TITLE = "Ready for another challenge?";
export const EXTRA_CHALLENGE_START_BODY = "Today's required work is complete. Wordloom can build a short challenge just for you.";
export const EXTRA_CHALLENGE_START_BUTTON = "Start my challenge";
export const EXTRA_CHALLENGE_CONTINUE_BODY = "You have a challenge waiting.";
export const EXTRA_CHALLENGE_CONTINUE_BUTTON = "Continue my challenge";
export const EXTRA_CHALLENGE_UNAVAILABLE_MESSAGE = "No extra challenge is ready just yet. Check back after your next task.";

function normalizeEvidenceSourceForCore(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

export function isCompletedAssignment(assignment = null) {
  const item = assignment && typeof assignment === "object" ? assignment : {};
  return item.completed === true
    || !!item.completed_at
    || !!item.completedAt
    || normalizeEvidenceSourceForCore(item.assignmentStatus || item.assignment_status) === "completed";
}

function isBaselineAssignment(assignment = null) {
  const item = assignment && typeof assignment === "object" ? assignment : {};
  return item.isBaseline === true
    || item.is_baseline === true
    || normalizeAttemptSource(item.attempt_source || item.attemptSource) === "baseline";
}

function isSpellingBeeAssignment(assignment = null) {
  const item = assignment && typeof assignment === "object" ? assignment : {};
  return item.isSpellingBee === true
    || item.is_spelling_bee === true
    || normalizeAttemptSource(item.attempt_source || item.attemptSource) === "spelling_bee"
    || normalizeEvidenceSourceForCore(item.automation_kind || item.automationKind) === "spelling_bee";
}

function isPracticeAssignment(assignment = null) {
  const item = assignment && typeof assignment === "object" ? assignment : {};
  return normalizeAttemptSource(item.attempt_source || item.attemptSource) === "practice";
}

function isStartedAssignment(assignment = null) {
  const item = assignment && typeof assignment === "object" ? assignment : {};
  return !!item.started_at
    || !!item.startedAt
    || normalizeEvidenceSourceForCore(item.assignmentStatus || item.assignment_status) === "started"
    || Math.max(0, Number(item.attemptedWordCount || item.attempted_word_count || 0)) > 0;
}

export function isRequiredCoreAssignment(assignment = null) {
  const item = assignment && typeof assignment === "object" ? assignment : {};
  const evidenceSource = getAssignmentEvidenceSource(item) || EVIDENCE_SOURCE_ASSIGNED_CORE;
  return evidenceSource === EVIDENCE_SOURCE_ASSIGNED_CORE
    && !isBaselineAssignment(item)
    && !isSpellingBeeAssignment(item)
    && !isPracticeAssignment(item)
    && !isExtraChallengeAssignmentSource(item)
    && normalizeAttemptSource(item.attempt_source || item.attemptSource) !== EVIDENCE_SOURCE_EXTRA_CHALLENGE;
}

export function getRequiredCoreAssignments(assignments = []) {
  return (Array.isArray(assignments) ? assignments : []).filter((assignment) =>
    isRequiredCoreAssignment(assignment)
  );
}

export function hasIncompleteRequiredCoreAssignment(assignments = []) {
  return getRequiredCoreAssignments(assignments).some((assignment) => !isCompletedAssignment(assignment));
}

export function hasCompletedRequiredCoreAssignment(assignments = []) {
  return getRequiredCoreAssignments(assignments).some((assignment) => isCompletedAssignment(assignment));
}

export function findActiveExtraChallengeAssignment(assignments = []) {
  return (Array.isArray(assignments) ? assignments : []).find((assignment) =>
    isExtraChallengeAssignmentSource(assignment)
    && !isCompletedAssignment(assignment)
  ) || null;
}

export function buildCompletionExtraChallengeActionModel(assignment = null) {
  const item = assignment && typeof assignment === "object" ? assignment : {};
  if (isExtraChallengeAssignmentSource(item)) {
    return {
      state: "start",
      buttonLabel: "Another challenge",
    };
  }
  if (!isRequiredCoreAssignment(item)) return null;

  return {
    state: "start",
    buttonLabel: "Next challenge",
  };
}

export function buildPupilDashboardMainActionModel({
  assignments = [],
  pupilId = "",
} = {}) {
  const rows = Array.isArray(assignments) ? assignments : [];
  const incompleteCore = getRequiredCoreAssignments(rows).find((assignment) =>
    !isCompletedAssignment(assignment)
  );
  if (incompleteCore) {
    const started = isStartedAssignment(incompleteCore);
    return {
      kind: "core",
      title: "Today's challenge",
      body: started ? "Pick up where you left off." : "Your next challenge is ready.",
      buttonLabel: started ? "Continue challenge" : "Start challenge",
      assignmentId: String(incompleteCore.id || "").trim(),
      assignment: incompleteCore,
    };
  }

  const activeExtraChallenge = findActiveExtraChallengeAssignment(rows);
  if (activeExtraChallenge) {
    return {
      kind: "extra_continue",
      title: "Continue challenge",
      body: EXTRA_CHALLENGE_CONTINUE_BODY,
      buttonLabel: EXTRA_CHALLENGE_CONTINUE_BUTTON,
      assignmentId: String(activeExtraChallenge.id || "").trim(),
      assignment: activeExtraChallenge,
    };
  }

  const safePupilId = String(pupilId || "").trim();
  if (safePupilId && hasCompletedRequiredCoreAssignment(rows)) {
    return {
      kind: "extra_start",
      title: "Next challenge",
      body: EXTRA_CHALLENGE_START_BODY,
      buttonLabel: EXTRA_CHALLENGE_START_BUTTON,
      assignmentId: "",
      assignment: null,
    };
  }

  return {
    kind: "complete",
    title: "All done for now",
    body: "New challenges will show here when they are ready.",
    buttonLabel: "",
    assignmentId: "",
    assignment: null,
  };
}

export function buildExtraChallengeUnavailableMessage() {
  return EXTRA_CHALLENGE_UNAVAILABLE_MESSAGE;
}

export function buildExtraChallengeCardModel({
  assignments = [],
  pupilId = "",
} = {}) {
  const safePupilId = String(pupilId || "").trim();
  if (!safePupilId) return null;
  if (hasIncompleteRequiredCoreAssignment(assignments)) return null;

  const activeExtraChallenge = findActiveExtraChallengeAssignment(assignments);
  if (activeExtraChallenge) {
    return {
      state: "continue",
      title: EXTRA_CHALLENGE_CARD_TITLE,
      body: EXTRA_CHALLENGE_CONTINUE_BODY,
      buttonLabel: EXTRA_CHALLENGE_CONTINUE_BUTTON,
      assignmentId: String(activeExtraChallenge.id || "").trim(),
      assignment: activeExtraChallenge,
    };
  }

  if (!hasCompletedRequiredCoreAssignment(assignments)) return null;

  return {
    state: "start",
    title: EXTRA_CHALLENGE_CARD_TITLE,
    body: EXTRA_CHALLENGE_START_BODY,
    buttonLabel: EXTRA_CHALLENGE_START_BUTTON,
    assignmentId: "",
    assignment: null,
  };
}
