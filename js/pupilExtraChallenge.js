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
