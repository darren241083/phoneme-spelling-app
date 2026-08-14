import path from "node:path";

import { hashStudioReadyContract, validateStudioReadyContract } from "./contracts.mjs";

export const ARTIFACT_LIFECYCLE_SCHEMA_VERSION = 1;
export const ARTIFACT_LIFECYCLE_VERSION = "artifact-lifecycle/1";
export const TIER_3_AUDIT_VERSION = "tier-3-audit/1";
export const TASK_ARTIFACT_WORKSPACE_ROOT = ".studio/tasks/";

export const ARTIFACT_LIFECYCLE_STATES = Object.freeze([
  "ephemeral",
  "promote",
  "retained-reference",
  "dispose",
]);

export const PROHIBITED_PROMOTION_SENSITIVITIES = Object.freeze([
  "credential",
  "raw_conversation",
  "secret",
  "unnecessary_personal_data",
]);

const DEFAULT_ROLE_IDS = Object.freeze([
  "product_owner",
  "principal_builder",
  "reviewer",
  "verifier",
]);

const DURABLE_REFERENCE_MAX_LENGTH = 300;

const TIER_3_CONCISE_LIMITS = Object.freeze({
  approvals: 12,
  evidence_outcomes: 30,
  material_deviations: 20,
  risk_basis: 20,
  outcome: 500,
  summary: 500,
  text: 500,
});

const TASK_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const REFERENCE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;
const CONTRACT_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ROLE_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const REFERENCE_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;

const LIFECYCLE_ALLOWED_KEYS = new Set([
  "schema_version",
  "task_id",
  "contract_id",
  "workspace",
  "state",
  "artifacts",
  "promotion",
  "retained_references",
  "disposal",
  "metadata",
]);

const WORKSPACE_ALLOWED_KEYS = new Set(["relative_path", "ignored_by_default"]);
const ARTIFACT_ALLOWED_KEYS = new Set(["id", "kind", "path", "sensitivity", "promotion_allowed"]);
const PROMOTION_ALLOWED_KEYS = new Set(["reason", "destination"]);
const DESTINATION_ALLOWED_KEYS = new Set(["id", "description", "path", "reference"]);
const RETAINED_REFERENCE_ALLOWED_KEYS = new Set(["id", "description", "reference"]);
const DISPOSAL_ALLOWED_KEYS = new Set(["reason"]);
const LIFECYCLE_METADATA_ALLOWED_KEYS = new Set(["lifecycle_version"]);

const TIER_3_AUDIT_ALLOWED_KEYS = new Set([
  "schema_version",
  "audit_type",
  "contract_id",
  "contract_hash",
  "risk_basis",
  "commit_ref",
  "release_ref",
  "evidence_outcomes",
  "material_deviations",
  "approvals",
  "metadata",
]);
const EVIDENCE_OUTCOME_ALLOWED_KEYS = new Set(["id", "outcome", "reference"]);
const APPROVAL_ALLOWED_KEYS = new Set(["id", "role", "summary", "reference"]);
const AUDIT_METADATA_ALLOWED_KEYS = new Set(["audit_version"]);

class ArtifactLifecycleError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = "ArtifactLifecycleError";
    this.code = code;
  }
}

export { ArtifactLifecycleError };

function fail(code, message) {
  throw new ArtifactLifecycleError(code, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label, code = "ARTIFACT_LIFECYCLE_INVALID") {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
  return value;
}

function requireOnlyKeys(value, allowedKeys, label, code = "ARTIFACT_LIFECYCLE_INVALID") {
  for (const key of Object.keys(value).sort()) {
    if (!allowedKeys.has(key)) fail(code, `${label} contains unsupported field: ${key}.`);
  }
}

function requireString(value, label, code = "ARTIFACT_LIFECYCLE_INVALID") {
  if (typeof value !== "string" || !value.trim()) {
    fail(code, `${label} must be a non-empty string.`);
  }
  return value.trim().replace(/\s+/g, " ");
}

function requireBoundedString(value, label, limit, code = "TIER_3_AUDIT_INVALID") {
  const text = requireString(value, label, code);
  if (text.length > limit) fail(code, `${label} must not exceed ${limit} characters.`);
  return text;
}

function requireIdentifier(value, label, pattern, code = "ARTIFACT_LIFECYCLE_INVALID") {
  const identifier = requireString(value, label, code);
  if (!pattern.test(identifier)) fail(code, `${label} has an invalid identifier: ${identifier}.`);
  return identifier;
}

function requireInteger(value, label, code = "ARTIFACT_LIFECYCLE_INVALID") {
  if (!Number.isInteger(value) || value < 1) fail(code, `${label} must be a positive integer.`);
  return value;
}

function requireArray(value, label, code = "ARTIFACT_LIFECYCLE_INVALID") {
  if (!Array.isArray(value)) fail(code, `${label} must be an array.`);
  return value;
}

function requireConciseArray(value, label, limit) {
  const items = requireArray(value ?? [], label, "TIER_3_AUDIT_INVALID");
  if (items.length > limit) {
    fail("TIER_3_AUDIT_INVALID", `${label} must not contain more than ${limit} items.`);
  }
  return items;
}

function assertUniqueIds(values, label, code) {
  const ids = values.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) fail(code, `${label} ids must be unique.`);
  return values;
}

function requireEnum(value, label, allowedValues, code = "ARTIFACT_LIFECYCLE_INVALID") {
  const text = requireString(value, label, code);
  if (!allowedValues.includes(text)) {
    fail(code, `${label} must be one of: ${allowedValues.join(", ")}.`);
  }
  return text;
}

function compactStringArray(value, label, code = "ARTIFACT_LIFECYCLE_INVALID") {
  return requireArray(value ?? [], label, code).map((item, index) =>
    requireString(item, `${label}[${index}]`, code)
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function normalizeRelativePath(value, label, code = "ARTIFACT_LIFECYCLE_INVALID") {
  const relativePath = requireString(value, label, code).replaceAll("\\", "/");
  if (path.isAbsolute(relativePath) || relativePath.split("/").includes("..")) {
    fail(code, `${label} must be a relative contained path.`);
  }
  return relativePath;
}

function normalizeWorkspace(value) {
  const workspace = requireObject(value, "Artifact workspace");
  requireOnlyKeys(workspace, WORKSPACE_ALLOWED_KEYS, "Artifact workspace");
  const relativePath = normalizeRelativePath(workspace.relative_path, "Artifact workspace.relative_path");
  if (!isTaskWorkspacePath(relativePath)) {
    fail("ARTIFACT_WORKSPACE_INVALID", `Artifact workspace.relative_path must be under ${TASK_ARTIFACT_WORKSPACE_ROOT}.`);
  }
  return {
    relative_path: relativePath.endsWith("/") ? relativePath : `${relativePath}/`,
    ignored_by_default: workspace.ignored_by_default === true,
  };
}

function normalizeArtifact(value, index) {
  const artifact = requireObject(value, `Artifact artifacts[${index}]`);
  requireOnlyKeys(artifact, ARTIFACT_ALLOWED_KEYS, `Artifact artifacts[${index}]`);
  return {
    id: requireIdentifier(artifact.id, `Artifact artifacts[${index}].id`, REFERENCE_ID_PATTERN),
    kind: requireIdentifier(artifact.kind, `Artifact artifacts[${index}].kind`, REFERENCE_ID_PATTERN),
    path: normalizeRelativePath(artifact.path, `Artifact artifacts[${index}].path`),
    sensitivity: requireIdentifier(
      artifact.sensitivity ?? "internal",
      `Artifact artifacts[${index}].sensitivity`,
      REFERENCE_ID_PATTERN,
    ),
    promotion_allowed: artifact.promotion_allowed !== false,
  };
}

function normalizeDestination(value) {
  const destination = requireObject(value, "Artifact promotion.destination", "ARTIFACT_PROMOTION_INVALID");
  requireOnlyKeys(destination, DESTINATION_ALLOWED_KEYS, "Artifact promotion.destination", "ARTIFACT_PROMOTION_INVALID");
  const normalized = {
    id: requireIdentifier(
      destination.id,
      "Artifact promotion.destination.id",
      REFERENCE_ID_PATTERN,
      "ARTIFACT_PROMOTION_INVALID",
    ),
    description: requireString(
      destination.description,
      "Artifact promotion.destination.description",
      "ARTIFACT_PROMOTION_INVALID",
    ),
  };
  if (destination.path !== undefined) {
    normalized.path = normalizeRelativePath(
      destination.path,
      "Artifact promotion.destination.path",
      "ARTIFACT_PROMOTION_INVALID",
    );
  }
  if (destination.reference !== undefined) {
    normalized.reference = requireString(
      destination.reference,
      "Artifact promotion.destination.reference",
      "ARTIFACT_PROMOTION_INVALID",
    );
  }
  if (!normalized.path && !normalized.reference) {
    fail("ARTIFACT_PROMOTION_INVALID", "Artifact promotion.destination requires path or reference.");
  }
  return normalized;
}

function normalizePromotion(value) {
  if (value === undefined) return undefined;
  const promotion = requireObject(value, "Artifact promotion", "ARTIFACT_PROMOTION_INVALID");
  requireOnlyKeys(promotion, PROMOTION_ALLOWED_KEYS, "Artifact promotion", "ARTIFACT_PROMOTION_INVALID");
  return {
    reason: requireString(promotion.reason, "Artifact promotion.reason", "ARTIFACT_PROMOTION_INVALID"),
    destination: normalizeDestination(promotion.destination),
  };
}

function normalizeRetainedReference(value, index) {
  const reference = requireObject(value, `Artifact retained_references[${index}]`);
  requireOnlyKeys(reference, RETAINED_REFERENCE_ALLOWED_KEYS, `Artifact retained_references[${index}]`);
  return {
    id: requireIdentifier(reference.id, `Artifact retained_references[${index}].id`, REFERENCE_ID_PATTERN),
    description: requireString(reference.description, `Artifact retained_references[${index}].description`),
    reference: requireDurableReference(
      reference.reference,
      `Artifact retained_references[${index}].reference`,
      "ARTIFACT_RETENTION_INVALID",
    ),
  };
}

function normalizeDisposal(value) {
  if (value === undefined) return undefined;
  const disposal = requireObject(value, "Artifact disposal");
  requireOnlyKeys(disposal, DISPOSAL_ALLOWED_KEYS, "Artifact disposal");
  return {
    reason: requireString(disposal.reason, "Artifact disposal.reason"),
  };
}

function normalizeLifecycleMetadata(value) {
  const metadata = requireObject(value, "Artifact metadata");
  requireOnlyKeys(metadata, LIFECYCLE_METADATA_ALLOWED_KEYS, "Artifact metadata");
  const version = requireString(
    metadata.lifecycle_version,
    "Artifact metadata.lifecycle_version",
    "ARTIFACT_LIFECYCLE_VERSION_UNSUPPORTED",
  );
  if (version !== ARTIFACT_LIFECYCLE_VERSION) {
    fail("ARTIFACT_LIFECYCLE_VERSION_UNSUPPORTED", `Unsupported lifecycle_version: ${version}.`);
  }
  return { lifecycle_version: version };
}

function getPolicyDestinationIds(policy) {
  return new Set((policy?.artifactPromotionDestinations ?? []).map(({ id }) => id));
}

function getPolicyDestination(policy, destinationId) {
  return (policy?.artifactPromotionDestinations ?? []).find(({ id }) => id === destinationId);
}

function getPolicyProhibitedSensitivities(policy) {
  const values = policy?.evidenceSensitivity?.prohibitedPromotion;
  return [...new Set([...PROHIBITED_PROMOTION_SENSITIVITIES, ...(values ?? [])])];
}

function assertPromotionDestination(promotion, policy) {
  if (promotion === undefined) return;
  if (!policy || !Array.isArray(policy.artifactPromotionDestinations)) {
    fail(
      "ARTIFACT_PROMOTION_POLICY_REQUIRED",
      "Artifact promotion requires an explicit destination policy.",
    );
  }
  const destinationIds = getPolicyDestinationIds(policy);
  const destinationId = promotion.destination.id;
  if (!destinationIds.has(destinationId)) {
    fail("ARTIFACT_PROMOTION_DESTINATION_INVALID", `Artifact promotion destination is not allowed: ${destinationId}.`);
  }
  const allowedDestination = getPolicyDestination(policy, destinationId);
  if (allowedDestination.path !== undefined && promotion.destination.path !== allowedDestination.path) {
    fail("ARTIFACT_PROMOTION_DESTINATION_INVALID", `Artifact promotion destination path must match policy for: ${destinationId}.`);
  }
  if (allowedDestination.path === undefined && promotion.destination.path !== undefined) {
    fail("ARTIFACT_PROMOTION_DESTINATION_INVALID", `Artifact promotion destination path is not allowed for: ${destinationId}.`);
  }
  if (allowedDestination.reference !== undefined && promotion.destination.reference !== allowedDestination.reference) {
    fail("ARTIFACT_PROMOTION_DESTINATION_INVALID", `Artifact promotion destination reference must match policy for: ${destinationId}.`);
  }
  if (allowedDestination.reference === undefined && promotion.destination.reference !== undefined) {
    fail("ARTIFACT_PROMOTION_DESTINATION_INVALID", `Artifact promotion destination reference is not allowed for: ${destinationId}.`);
  }
}

function assertPromotableArtifacts(artifacts, policy) {
  const prohibitedSensitivities = getPolicyProhibitedSensitivities(policy);
  for (const artifact of artifacts) {
    if (!artifact.promotion_allowed) {
      fail("ARTIFACT_PROMOTION_BLOCKED", `Artifact cannot be promoted: ${artifact.id}.`);
    }
    if (prohibitedSensitivities.includes(artifact.sensitivity)) {
      fail(
        "ARTIFACT_PROMOTION_BLOCKED",
        `Artifact sensitivity cannot be promoted: ${artifact.sensitivity}.`,
      );
    }
  }
}

function normalizeAuditOutcome(value, index) {
  const outcome = requireObject(value, `Tier 3 audit evidence_outcomes[${index}]`, "TIER_3_AUDIT_INVALID");
  requireOnlyKeys(outcome, EVIDENCE_OUTCOME_ALLOWED_KEYS, `Tier 3 audit evidence_outcomes[${index}]`, "TIER_3_AUDIT_INVALID");
  return {
    id: requireIdentifier(outcome.id, `Tier 3 audit evidence_outcomes[${index}].id`, REFERENCE_ID_PATTERN, "TIER_3_AUDIT_INVALID"),
    outcome: requireBoundedString(
      outcome.outcome,
      `Tier 3 audit evidence_outcomes[${index}].outcome`,
      TIER_3_CONCISE_LIMITS.outcome,
    ),
    ...(outcome.reference === undefined ? {} : {
      reference: requireDurableReference(
        outcome.reference,
        `Tier 3 audit evidence_outcomes[${index}].reference`,
      ),
    }),
  };
}

function requireDurableReference(value, label, code = "TIER_3_AUDIT_INVALID") {
  const reference = requireBoundedString(value, label, DURABLE_REFERENCE_MAX_LENGTH, code);
  if (isTaskWorkspacePath(reference)) {
    fail(code, `${label} must not point to an ephemeral task workspace.`);
  }
  return reference;
}

function assertWorkspaceInvariants(record) {
  const expectedWorkspace = `${TASK_ARTIFACT_WORKSPACE_ROOT}${record.task_id}/`;
  if (record.workspace.relative_path !== expectedWorkspace) {
    fail("ARTIFACT_WORKSPACE_INVALID", `Artifact workspace.relative_path must be ${expectedWorkspace}.`);
  }
  for (const artifact of record.artifacts) {
    if (!artifact.path.startsWith(record.workspace.relative_path)) {
      fail(
        "ARTIFACT_WORKSPACE_INVALID",
        `Artifact artifacts path must stay under ${record.workspace.relative_path}: ${artifact.id}.`,
      );
    }
  }
}

function assertStateInvariants(record, policy) {
  if (record.state === "ephemeral") {
    if (record.promotion !== undefined || record.disposal !== undefined || record.retained_references.length) {
      fail("ARTIFACT_STATE_INVALID", "Ephemeral records must not carry promotion, disposal, or retained references.");
    }
  }
  if (record.state === "promote") {
    if (record.promotion === undefined) {
      fail("ARTIFACT_PROMOTION_INVALID", "Promoted artifacts require a promotion destination.");
    }
    if (record.disposal !== undefined || record.retained_references.length) {
      fail("ARTIFACT_STATE_INVALID", "Promoted records must not carry disposal or retained references.");
    }
    assertPromotionDestination(record.promotion, policy);
    assertPromotableArtifacts(record.artifacts, policy);
  }
  if (record.state === "retained-reference") {
    if (record.promotion !== undefined || record.disposal !== undefined) {
      fail("ARTIFACT_STATE_INVALID", "Retained-reference records must not carry promotion or disposal details.");
    }
    if (record.artifacts.length) {
      fail("ARTIFACT_RETENTION_INVALID", "Retained-reference records must not keep artifact paths.");
    }
    if (record.retained_references.length === 0) {
      fail("ARTIFACT_RETENTION_INVALID", "Retained-reference records require at least one retained reference.");
    }
  }
  if (record.state === "dispose") {
    if (record.promotion !== undefined || record.retained_references.length) {
      fail("ARTIFACT_STATE_INVALID", "Disposed records must not carry promotion or retained references.");
    }
    if (record.disposal === undefined) {
      fail("ARTIFACT_DISPOSAL_INVALID", "Disposed artifacts require a disposal reason.");
    }
    if (record.artifacts.length) {
      fail("ARTIFACT_DISPOSAL_INVALID", "Disposed artifact records must not keep artifact paths.");
    }
  }
}

function normalizeApproval(value, index, { roleIds = DEFAULT_ROLE_IDS } = {}) {
  const approval = requireObject(value, `Tier 3 audit approvals[${index}]`, "TIER_3_AUDIT_INVALID");
  requireOnlyKeys(approval, APPROVAL_ALLOWED_KEYS, `Tier 3 audit approvals[${index}]`, "TIER_3_AUDIT_INVALID");
  const role = requireIdentifier(
    approval.role,
    `Tier 3 audit approvals[${index}].role`,
    ROLE_ID_PATTERN,
    "TIER_3_AUDIT_INVALID",
  );
  if (!roleIds.includes(role)) {
    fail("TIER_3_AUDIT_INVALID", `Tier 3 audit approvals[${index}].role is unknown: ${role}.`);
  }
  return {
    id: requireIdentifier(approval.id, `Tier 3 audit approvals[${index}].id`, REFERENCE_ID_PATTERN, "TIER_3_AUDIT_INVALID"),
    role,
    summary: requireBoundedString(
      approval.summary,
      `Tier 3 audit approvals[${index}].summary`,
      TIER_3_CONCISE_LIMITS.summary,
    ),
    ...(approval.reference === undefined ? {} : {
      reference: requireDurableReference(approval.reference, `Tier 3 audit approvals[${index}].reference`),
    }),
  };
}

export function isTaskWorkspacePath(relativePath) {
  const slashed = String(relativePath ?? "").trim().replaceAll("\\", "/");
  if (REFERENCE_SCHEME_PATTERN.test(slashed)) return false;

  const normalized = path.posix.normalize(slashed);
  return normalized === TASK_ARTIFACT_WORKSPACE_ROOT.slice(0, -1)
    || normalized.startsWith(TASK_ARTIFACT_WORKSPACE_ROOT);
}

export function taskWorkspaceIgnoreRule() {
  return TASK_ARTIFACT_WORKSPACE_ROOT;
}

export function gitignoreCoversTaskWorkspace(source) {
  return String(source ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .some((line) => line === ".studio/tasks/" || line === ".studio/tasks");
}

export function getTaskArtifactWorkspace({ repositoryRoot = ".", taskId } = {}) {
  const id = requireIdentifier(taskId, "Task id", TASK_ID_PATTERN);
  const resolvedRoot = path.resolve(repositoryRoot);
  const relativePath = `${TASK_ARTIFACT_WORKSPACE_ROOT}${id}/`;
  const absolutePath = path.resolve(resolvedRoot, relativePath);
  const relativeFromRoot = path.relative(resolvedRoot, absolutePath);
  if (relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
    fail("ARTIFACT_WORKSPACE_INVALID", "Task artifact workspace must stay inside the repository root.");
  }
  return deepFreeze({
    task_id: id,
    relative_path: relativePath,
    absolute_path: absolutePath,
    ignored_by_default: true,
  });
}

export function createArtifactLifecycleRecord({ taskId, contractId, artifacts = [] } = {}) {
  const workspace = getTaskArtifactWorkspace({ taskId });
  return validateArtifactLifecycleRecord({
    schema_version: ARTIFACT_LIFECYCLE_SCHEMA_VERSION,
    task_id: workspace.task_id,
    contract_id: contractId,
    workspace: {
      relative_path: workspace.relative_path,
      ignored_by_default: true,
    },
    state: "ephemeral",
    artifacts,
    retained_references: [],
    metadata: {
      lifecycle_version: ARTIFACT_LIFECYCLE_VERSION,
    },
  });
}

export function validateArtifactLifecycleRecord(value, { policy } = {}) {
  const record = requireObject(value, "Artifact lifecycle record");
  requireOnlyKeys(record, LIFECYCLE_ALLOWED_KEYS, "Artifact lifecycle record");
  const schemaVersion = requireInteger(
    record.schema_version,
    "Artifact schema_version",
    "ARTIFACT_LIFECYCLE_VERSION_UNSUPPORTED",
  );
  if (schemaVersion !== ARTIFACT_LIFECYCLE_SCHEMA_VERSION) {
    fail("ARTIFACT_LIFECYCLE_VERSION_UNSUPPORTED", `Unsupported schema_version: ${schemaVersion}.`);
  }

  const state = requireEnum(record.state, "Artifact state", ARTIFACT_LIFECYCLE_STATES);
  const artifacts = requireArray(record.artifacts ?? [], "Artifact artifacts").map(normalizeArtifact);
  const retainedReferences = requireArray(record.retained_references ?? [], "Artifact retained_references")
    .map(normalizeRetainedReference);
  const normalized = {
    schema_version: schemaVersion,
    task_id: requireIdentifier(record.task_id, "Artifact task_id", TASK_ID_PATTERN),
    contract_id: requireIdentifier(record.contract_id, "Artifact contract_id", CONTRACT_ID_PATTERN),
    workspace: normalizeWorkspace(record.workspace),
    state,
    artifacts: assertUniqueIds(artifacts, "Artifact artifacts", "ARTIFACT_LIFECYCLE_INVALID"),
    ...(record.promotion === undefined ? {} : { promotion: normalizePromotion(record.promotion) }),
    retained_references: assertUniqueIds(
      retainedReferences,
      "Artifact retained_references",
      "ARTIFACT_LIFECYCLE_INVALID",
    ),
    ...(record.disposal === undefined ? {} : { disposal: normalizeDisposal(record.disposal) }),
    metadata: normalizeLifecycleMetadata(record.metadata),
  };

  assertWorkspaceInvariants(normalized);
  assertStateInvariants(normalized, policy);

  return deepFreeze(normalized);
}

export function promoteArtifactLifecycle(record, promotion, options = {}) {
  const normalized = validateArtifactLifecycleRecord(record, options);
  if (normalized.state !== "ephemeral") {
    fail("ARTIFACT_TRANSITION_INVALID", "Only ephemeral artifacts can enter promotion.");
  }
  const normalizedPromotion = normalizePromotion(promotion);
  if (normalizedPromotion === undefined) {
    fail("ARTIFACT_PROMOTION_INVALID", "Promotion must be deliberate and name a destination.");
  }
  assertPromotionDestination(normalizedPromotion, options.policy);
  assertPromotableArtifacts(normalized.artifacts, options.policy);
  return validateArtifactLifecycleRecord({
    ...normalized,
    state: "promote",
    promotion: normalizedPromotion,
  }, options);
}

export function retainArtifactReference(record, reference, options = {}) {
  const normalized = validateArtifactLifecycleRecord(record, options);
  if (!["ephemeral", "promote"].includes(normalized.state)) {
    fail("ARTIFACT_TRANSITION_INVALID", "Only ephemeral or promoted artifacts can become retained references.");
  }
  const retainedReference = normalizeRetainedReference(reference, normalized.retained_references.length);
  const {
    promotion: _promotion,
    disposal: _disposal,
    ...baseRecord
  } = normalized;
  return validateArtifactLifecycleRecord({
    ...baseRecord,
    state: "retained-reference",
    artifacts: [],
    retained_references: [...normalized.retained_references, retainedReference],
  }, options);
}

export function disposeArtifactLifecycle(record, { reason } = {}, options = {}) {
  const normalized = validateArtifactLifecycleRecord(record, options);
  const {
    promotion: _promotion,
    disposal: _disposal,
    ...baseRecord
  } = normalized;
  return validateArtifactLifecycleRecord({
    ...baseRecord,
    state: "dispose",
    artifacts: [],
    retained_references: [],
    disposal: {
      reason: requireString(reason, "Artifact disposal.reason"),
    },
  }, options);
}

export function createTier3AuditRecord({
  contract,
  riskBasis,
  commitRef,
  releaseRef,
  evidenceOutcomes = [],
  materialDeviations = [],
  approvals = [],
} = {}, options = {}) {
  const normalizedContract = validateStudioReadyContract(contract);
  if (normalizedContract.declared_risk.tier !== "tier_3") {
    fail("TIER_3_AUDIT_INVALID", "Tier 3 audit requires a tier_3 contract.");
  }
  const normalizedRiskBasis = requireConciseArray(
    riskBasis,
    "Tier 3 audit risk_basis",
    TIER_3_CONCISE_LIMITS.risk_basis,
  ).map((item, index) => requireBoundedString(
    item,
    `Tier 3 audit risk_basis[${index}]`,
    TIER_3_CONCISE_LIMITS.text,
  ));
  if (normalizedRiskBasis.length === 0) {
    fail("TIER_3_AUDIT_INVALID", "Tier 3 audit risk_basis must not be empty.");
  }
  const audit = {
    schema_version: ARTIFACT_LIFECYCLE_SCHEMA_VERSION,
    audit_type: "tier_3_concise_audit",
    contract_id: normalizedContract.contract_id,
    contract_hash: hashStudioReadyContract(normalizedContract),
    risk_basis: normalizedRiskBasis,
    ...(commitRef === undefined ? {} : {
      commit_ref: requireDurableReference(commitRef, "Tier 3 audit commit_ref"),
    }),
    ...(releaseRef === undefined ? {} : {
      release_ref: requireDurableReference(releaseRef, "Tier 3 audit release_ref"),
    }),
    evidence_outcomes: assertUniqueIds(
      requireConciseArray(
        evidenceOutcomes,
        "Tier 3 audit evidence_outcomes",
        TIER_3_CONCISE_LIMITS.evidence_outcomes,
      ).map(normalizeAuditOutcome),
      "Tier 3 audit evidence_outcomes",
      "TIER_3_AUDIT_INVALID",
    ),
    material_deviations: requireConciseArray(
      materialDeviations,
      "Tier 3 audit material_deviations",
      TIER_3_CONCISE_LIMITS.material_deviations,
    ).map((item, index) => requireBoundedString(
      item,
      `Tier 3 audit material_deviations[${index}]`,
      TIER_3_CONCISE_LIMITS.text,
    )),
    approvals: assertUniqueIds(
      requireConciseArray(
        approvals,
        "Tier 3 audit approvals",
        TIER_3_CONCISE_LIMITS.approvals,
      ).map((approval, index) => normalizeApproval(approval, index, options)),
      "Tier 3 audit approvals",
      "TIER_3_AUDIT_INVALID",
    ),
    metadata: {
      audit_version: TIER_3_AUDIT_VERSION,
    },
  };
  return validateTier3AuditRecord(audit, options);
}

export function validateTier3AuditRecord(value, options = {}) {
  const audit = requireObject(value, "Tier 3 audit record", "TIER_3_AUDIT_INVALID");
  requireOnlyKeys(audit, TIER_3_AUDIT_ALLOWED_KEYS, "Tier 3 audit record", "TIER_3_AUDIT_INVALID");
  const schemaVersion = requireInteger(
    audit.schema_version,
    "Tier 3 audit schema_version",
    "TIER_3_AUDIT_VERSION_UNSUPPORTED",
  );
  if (schemaVersion !== ARTIFACT_LIFECYCLE_SCHEMA_VERSION) {
    fail("TIER_3_AUDIT_VERSION_UNSUPPORTED", `Unsupported schema_version: ${schemaVersion}.`);
  }
  if (audit.audit_type !== "tier_3_concise_audit") {
    fail("TIER_3_AUDIT_INVALID", "Tier 3 audit audit_type must be tier_3_concise_audit.");
  }
  const metadata = requireObject(audit.metadata, "Tier 3 audit metadata", "TIER_3_AUDIT_INVALID");
  requireOnlyKeys(metadata, AUDIT_METADATA_ALLOWED_KEYS, "Tier 3 audit metadata", "TIER_3_AUDIT_INVALID");
  if (metadata.audit_version !== TIER_3_AUDIT_VERSION) {
    fail("TIER_3_AUDIT_VERSION_UNSUPPORTED", `Unsupported audit_version: ${metadata.audit_version}.`);
  }

  const contractHash = requireString(
    audit.contract_hash,
    "Tier 3 audit contract_hash",
    "TIER_3_AUDIT_INVALID",
  );
  if (!SHA256_HEX_PATTERN.test(contractHash)) {
    fail(
      "TIER_3_AUDIT_INVALID",
      "Tier 3 audit contract_hash must be exactly 64 lowercase SHA-256 hexadecimal characters.",
    );
  }

  const normalizedRiskBasis = requireConciseArray(
    audit.risk_basis,
    "Tier 3 audit risk_basis",
    TIER_3_CONCISE_LIMITS.risk_basis,
  ).map((item, index) => requireBoundedString(
    item,
    `Tier 3 audit risk_basis[${index}]`,
    TIER_3_CONCISE_LIMITS.text,
  ));
  if (normalizedRiskBasis.length === 0) {
    fail("TIER_3_AUDIT_INVALID", "Tier 3 audit risk_basis must not be empty.");
  }

  return deepFreeze({
    schema_version: schemaVersion,
    audit_type: audit.audit_type,
    contract_id: requireIdentifier(audit.contract_id, "Tier 3 audit contract_id", CONTRACT_ID_PATTERN, "TIER_3_AUDIT_INVALID"),
    contract_hash: contractHash,
    risk_basis: normalizedRiskBasis,
    ...(audit.commit_ref === undefined ? {} : {
      commit_ref: requireDurableReference(audit.commit_ref, "Tier 3 audit commit_ref"),
    }),
    ...(audit.release_ref === undefined ? {} : {
      release_ref: requireDurableReference(audit.release_ref, "Tier 3 audit release_ref"),
    }),
    evidence_outcomes: assertUniqueIds(
      requireConciseArray(
        audit.evidence_outcomes ?? [],
        "Tier 3 audit evidence_outcomes",
        TIER_3_CONCISE_LIMITS.evidence_outcomes,
      ).map(normalizeAuditOutcome),
      "Tier 3 audit evidence_outcomes",
      "TIER_3_AUDIT_INVALID",
    ),
    material_deviations: requireConciseArray(
      audit.material_deviations ?? [],
      "Tier 3 audit material_deviations",
      TIER_3_CONCISE_LIMITS.material_deviations,
    ).map((item, index) => requireBoundedString(
      item,
      `Tier 3 audit material_deviations[${index}]`,
      TIER_3_CONCISE_LIMITS.text,
    )),
    approvals: assertUniqueIds(
      requireConciseArray(
        audit.approvals ?? [],
        "Tier 3 audit approvals",
        TIER_3_CONCISE_LIMITS.approvals,
      ).map((approval, index) => normalizeApproval(approval, index, options)),
      "Tier 3 audit approvals",
      "TIER_3_AUDIT_INVALID",
    ),
    metadata: { audit_version: metadata.audit_version },
  });
}
