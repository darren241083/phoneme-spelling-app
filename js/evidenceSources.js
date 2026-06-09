export const EVIDENCE_SOURCE_ASSIGNED_CORE = "assigned_core";
export const EVIDENCE_SOURCE_EXTRA_CHALLENGE = "extra_challenge";

export const ATTEMPT_SOURCE_TEACHER_ASSIGNED = "teacher_assigned";
export const ATTEMPT_SOURCE_AUTO_ASSIGNED = "auto_assigned";
export const ATTEMPT_SOURCE_BASELINE = "baseline";
export const ATTEMPT_SOURCE_PRACTICE = "practice";
export const ATTEMPT_SOURCE_EXTRA_CHALLENGE = EVIDENCE_SOURCE_EXTRA_CHALLENGE;

const NON_CORE_PROGRESS_ATTEMPT_SOURCES = new Set([
  ATTEMPT_SOURCE_BASELINE,
  ATTEMPT_SOURCE_PRACTICE,
  ATTEMPT_SOURCE_EXTRA_CHALLENGE,
]);

const TRACKED_ACTIVITY_ATTEMPT_SOURCES = new Set([
  "",
  "test",
  ATTEMPT_SOURCE_TEACHER_ASSIGNED,
  ATTEMPT_SOURCE_AUTO_ASSIGNED,
  ATTEMPT_SOURCE_BASELINE,
  ATTEMPT_SOURCE_PRACTICE,
  ATTEMPT_SOURCE_EXTRA_CHALLENGE,
]);

function normalizeSourceKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

export function normalizeEvidenceSource(value = "") {
  const key = normalizeSourceKey(value);
  if (key === EVIDENCE_SOURCE_EXTRA_CHALLENGE) return EVIDENCE_SOURCE_EXTRA_CHALLENGE;
  if (key === EVIDENCE_SOURCE_ASSIGNED_CORE) return EVIDENCE_SOURCE_ASSIGNED_CORE;
  return key;
}

export function isExtraChallengeEvidenceSource(value = "") {
  return normalizeEvidenceSource(value) === EVIDENCE_SOURCE_EXTRA_CHALLENGE;
}

export function getAssignmentEvidenceSource(assignment = null) {
  const source = assignment && typeof assignment === "object" ? assignment : {};
  return normalizeEvidenceSource(
    source.evidence_source
    || source.evidenceSource
    || source.assignment_source
    || source.assignmentSource
    || ""
  );
}

export function isExtraChallengeAssignmentSource(assignment = null) {
  return isExtraChallengeEvidenceSource(getAssignmentEvidenceSource(assignment));
}

export function normalizeAttemptSource(value = "") {
  return normalizeSourceKey(value);
}

export function isExtraChallengeAttemptSource(value = "") {
  return normalizeAttemptSource(value) === ATTEMPT_SOURCE_EXTRA_CHALLENGE;
}

export function isCoreProgressAttemptSource(value = "") {
  return !NON_CORE_PROGRESS_ATTEMPT_SOURCES.has(normalizeAttemptSource(value));
}

export function isTrustedProgressAttemptSource(value = "") {
  const source = normalizeAttemptSource(value);
  return source !== ATTEMPT_SOURCE_PRACTICE
    && source !== ATTEMPT_SOURCE_EXTRA_CHALLENGE;
}

export function getCanonicalEvidenceSourceForAttemptSource(value = "") {
  return isExtraChallengeAttemptSource(value)
    ? EVIDENCE_SOURCE_EXTRA_CHALLENGE
    : EVIDENCE_SOURCE_ASSIGNED_CORE;
}

export function isTrackedActivityAttemptSource(value = "") {
  const source = normalizeAttemptSource(value);
  return TRACKED_ACTIVITY_ATTEMPT_SOURCES.has(source);
}
