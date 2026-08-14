import { createHash } from "node:crypto";

export const STUDIO_READY_SCHEMA_VERSION = 1;
export const STUDIO_READY_CONTRACT_VERSION = "studio-ready/1";
export const STUDIO_READY_CONTRACT_TYPE = "studio_ready";
export const STUDIO_POLICY_PRECEDENCE = "deterministic_studio_policy_over_agent_opinion";

export const STUDIO_READY_INPUT_KINDS = Object.freeze([
  "studio_ready_brief",
  "structured_brief",
  "natural_intent",
]);

export const STUDIO_READY_MODES = Object.freeze([
  "plan",
  "build",
  "fix",
  "review",
  "qa",
]);

export const DECLARED_RISK_TIERS = Object.freeze(["tier_1", "tier_2", "tier_3", "unknown"]);

const DEFAULT_ROLE_IDS = Object.freeze([
  "product_owner",
  "principal_builder",
  "reviewer",
  "verifier",
]);

const PRODUCT_QUESTION_REASONS = Object.freeze([
  "product_ambiguity",
  "ux_design_choice",
  "domain_judgement",
  "commercial_decision",
  "privacy_legal_choice",
  "major_scope_choice",
  "other_product_judgement",
]);

const CONTRACT_ALLOWED_KEYS = new Set([
  "schema_version",
  "contract_type",
  "contract_id",
  "app_profile",
  "source_provenance",
  "intent",
  "desired_outcome",
  "mode",
  "scope",
  "non_goals",
  "acceptance_criteria",
  "guardrails",
  "affected_areas",
  "declared_risk",
  "evidence_required",
  "tests_required",
  "context_requirements",
  "stop_conditions",
  "product_questions",
  "execution_constraints",
  "policy",
  "metadata",
]);

const APP_PROFILE_ALLOWED_KEYS = new Set(["profile_id", "application_id", "guidance_refs"]);
const GUIDANCE_REF_ALLOWED_KEYS = new Set(["id", "path", "applies_to"]);
const ACCEPTANCE_CRITERION_ALLOWED_KEYS = new Set(["id", "text"]);
const DECLARED_RISK_ALLOWED_KEYS = new Set(["tier", "basis"]);
const PRODUCT_QUESTION_ALLOWED_KEYS = new Set(["id", "question", "reason", "owner_role"]);
const SOURCE_PROVENANCE_ALLOWED_KEYS = new Set(["input_kind", "fingerprint", "source_reference"]);
const EXECUTION_CONSTRAINTS_ALLOWED_KEYS = new Set([
  "protected_paths",
  "required_operations",
  "forbidden_operations",
  "writer_restrictions",
  "risk_requirements",
]);
const POLICY_ALLOWED_KEYS = new Set(["precedence", "constraints", "deviations"]);
const POLICY_DEVIATION_ALLOWED_KEYS = new Set([
  "id",
  "source_requirement",
  "studio_requirement",
  "reason",
]);
const METADATA_ALLOWED_KEYS = new Set(["contract_version", "revision", "status"]);

const BRIEF_ALLOWED_KEYS = new Set([
  "contract_id",
  "app_profile",
  "intent",
  "request",
  "desired_outcome",
  "mode",
  "scope",
  "non_goals",
  "acceptance_criteria",
  "guardrails",
  "affected_areas",
  "declared_risk",
  "evidence_required",
  "tests_required",
  "context_requirements",
  "stop_conditions",
  "product_questions",
  "protected_paths",
  "required_operations",
  "forbidden_operations",
  "writer_restrictions",
  "risk_requirements",
]);

const DETAILED_BRIEF_REQUIRED_KEYS = Object.freeze([
  "intent",
  "desired_outcome",
  "scope",
  "non_goals",
  "acceptance_criteria",
  "guardrails",
  "declared_risk",
  "evidence_required",
  "tests_required",
  "stop_conditions",
  "product_questions",
  "protected_paths",
  "required_operations",
  "forbidden_operations",
  "writer_restrictions",
  "risk_requirements",
]);

const CONTRACT_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const PROFILE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const REFERENCE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;
const ROLE_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const ACCEPTANCE_CRITERION_ID_PATTERN = /^AC-\d{3}$/;
const PRODUCT_QUESTION_ID_PATTERN = /^PQ-\d{3}$/;
const POLICY_DEVIATION_ID_PATTERN = /^PD-\d{3}$/;
const SOURCE_FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;

const TECHNICAL_LOOKUP_QUESTION_PATTERN =
  /^(which|what|where|how)\b.*\b(api|class|component|config|endpoint|file|function|migration|module|schema|selector|test)\b.*\b(configured|covers|defined|implements|live|lives|located|owns|references|runs|used)\b|^(which|what|where|how)\b.*\b(configured|covers|defined|implements|live|lives|located|owns|references|runs|used)\b.*\b(api|class|component|config|endpoint|file|function|migration|module|schema|selector|test)\b/i;
const STRONG_PRODUCT_DECISION_QUESTION_PATTERN =
  /\b(approval|approve|commercial|consent|legal|permission|privacy|scope|sensitive|visibility|whether|who can)\b|\bwho\b.*\b(approve|edit|export|see|share|view)\b/i;
const ACCESS_CONTROL_IMPERATIVE_PATTERN =
  /\b(?:allow|authorize|permit)\b.*\bto\b.*\b(?:access|approve|delete|download|edit|export|import|manage|share|view)\b|\b(?:deny|restrict)\b.*\b(?:access|approval|deletion|download|editing|export|import|management|sharing|view)\b|\b(?:prevent|prohibit|restrict)\b.*\bfrom\b.*\b(?:accessing|approving|deleting|downloading|editing|exporting|importing|managing|sharing|viewing)\b/i;
const WEAK_PRODUCT_DECISION_QUESTION_PATTERN =
  /\b(should|trade[- ]off)\b|\bor\b|would .*\bbetter\b/i;
const ROUTINE_REQUEST_QUESTION_PATTERN =
  /^(can|could|please|will|would)\s+(you|we|the studio)\b.*\b(add|change|clarify|fix|hide|improve|make|reduce|remove|show|update)\b/i;

export class StudioContractError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = "StudioContractError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new StudioContractError(code, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label, code = "CONTRACT_INVALID") {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
  return value;
}

function requireOnlyKeys(value, allowedKeys, label, code = "CONTRACT_INVALID") {
  for (const key of Object.keys(value).sort()) {
    if (!allowedKeys.has(key)) fail(code, `${label} contains unsupported field: ${key}.`);
  }
}

function requireString(value, label, code = "CONTRACT_INVALID") {
  if (typeof value !== "string" || !value.trim()) {
    fail(code, `${label} must be a non-empty string.`);
  }
  return value.trim().replace(/\s+/g, " ");
}

function requireSemanticText(value, label, code = "CONTRACT_INVALID") {
  if (typeof value !== "string" || !value.trim()) {
    fail(code, `${label} must be a non-empty string.`);
  }
  return value;
}

function requireIdentifier(value, label, pattern, code = "CONTRACT_INVALID") {
  const identifier = requireString(value, label, code);
  if (!pattern.test(identifier)) fail(code, `${label} has an invalid identifier: ${identifier}.`);
  return identifier;
}

function requireInteger(value, label, code = "CONTRACT_INVALID") {
  if (!Number.isInteger(value) || value < 1) fail(code, `${label} must be a positive integer.`);
  return value;
}

function requireArray(value, label, code = "CONTRACT_INVALID") {
  if (!Array.isArray(value)) fail(code, `${label} must be an array.`);
  return value;
}

function requireEnum(value, label, allowedValues, code = "CONTRACT_INVALID") {
  const text = requireString(value, label, code);
  if (!allowedValues.includes(text)) {
    fail(code, `${label} must be one of: ${allowedValues.join(", ")}.`);
  }
  return text;
}

function compactStringArray(value, label) {
  return requireArray(value ?? [], label).map((item, index) =>
    requireString(item, `${label}[${index}]`)
  );
}

function semanticStringArray(value, label) {
  return requireArray(value ?? [], label).map((item, index) =>
    requireSemanticText(item, `${label}[${index}]`)
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function fingerprintStudioReadySource(source) {
  if (typeof source === "string") {
    requireSemanticText(source, "Studio Ready source");
  } else {
    requireObject(source, "Studio Ready source");
  }
  return `sha256:${hashValue(source)}`;
}

function toSnakeAppProfile(appProfile) {
  const profile = requireObject(appProfile, "App profile reference");
  const guidanceRefs = (profile.guidance_refs ?? profile.guidanceRefs ?? []).map((ref) => ({
    id: ref.id,
    path: ref.path,
    ...(ref.applies_to !== undefined || ref.appliesTo !== undefined
      ? { applies_to: ref.applies_to ?? ref.appliesTo }
      : {}),
  }));
  return {
    profile_id: profile.profile_id ?? profile.profileId,
    application_id: profile.application_id ?? profile.applicationId,
    ...(guidanceRefs.length ? { guidance_refs: guidanceRefs } : {}),
  };
}

function appProfileFromStudio(studio) {
  const profile = studio?.operational?.profile;
  if (!profile) return undefined;
  return {
    profile_id: profile.profileId,
    application_id: profile.applicationId,
    guidance_refs: profile.studioReady?.guidanceRefs ?? [],
  };
}

function normalizeGuidanceRefs(value) {
  const refs = requireArray(value ?? [], "Contract app_profile.guidance_refs").map((rawRef, index) => {
    const ref = requireObject(rawRef, `Contract app_profile.guidance_refs[${index}]`);
    requireOnlyKeys(ref, GUIDANCE_REF_ALLOWED_KEYS, `Contract app_profile.guidance_refs[${index}]`);
    const appliesTo = compactStringArray(ref.applies_to ?? [], `Contract app_profile.guidance_refs[${index}].applies_to`);
    return {
      id: requireIdentifier(ref.id, `Contract app_profile.guidance_refs[${index}].id`, REFERENCE_ID_PATTERN),
      path: requireString(ref.path, `Contract app_profile.guidance_refs[${index}].path`),
      ...(appliesTo.length ? { applies_to: appliesTo } : {}),
    };
  });
  const refIds = refs.map(({ id }) => id);
  if (new Set(refIds).size !== refIds.length) {
    fail("CONTRACT_PROFILE_INVALID", "Contract app_profile.guidance_refs ids must be unique.");
  }
  return refs;
}

function normalizeAppProfile(value, { supportedAppProfiles } = {}) {
  const profile = requireObject(value, "Contract app_profile", "CONTRACT_PROFILE_INVALID");
  requireOnlyKeys(profile, APP_PROFILE_ALLOWED_KEYS, "Contract app_profile", "CONTRACT_PROFILE_INVALID");
  const profileId = requireIdentifier(
    profile.profile_id,
    "Contract app_profile.profile_id",
    PROFILE_ID_PATTERN,
    "CONTRACT_PROFILE_INVALID",
  );
  if (supportedAppProfiles && !supportedAppProfiles.includes(profileId)) {
    fail("CONTRACT_PROFILE_UNSUPPORTED", `Contract app_profile.profile_id is not supported: ${profileId}.`);
  }

  const guidanceRefs = normalizeGuidanceRefs(profile.guidance_refs ?? []);
  return {
    profile_id: profileId,
    application_id: requireIdentifier(
      profile.application_id,
      "Contract app_profile.application_id",
      PROFILE_ID_PATTERN,
      "CONTRACT_PROFILE_INVALID",
    ),
    ...(guidanceRefs.length ? { guidance_refs: guidanceRefs } : {}),
  };
}

function normalizeSourceProvenance(value) {
  const provenance = requireObject(value, "Contract source_provenance");
  requireOnlyKeys(provenance, SOURCE_PROVENANCE_ALLOWED_KEYS, "Contract source_provenance");
  const fingerprint = requireString(provenance.fingerprint, "Contract source_provenance.fingerprint");
  if (!SOURCE_FINGERPRINT_PATTERN.test(fingerprint)) {
    fail("CONTRACT_SOURCE_INVALID", "Contract source_provenance.fingerprint must be a sha256 fingerprint.");
  }
  return {
    input_kind: requireEnum(
      provenance.input_kind,
      "Contract source_provenance.input_kind",
      STUDIO_READY_INPUT_KINDS,
      "CONTRACT_SOURCE_INVALID",
    ),
    fingerprint,
    ...(provenance.source_reference === undefined
      ? {}
      : { source_reference: requireString(provenance.source_reference, "Contract source_provenance.source_reference") }),
  };
}

function normalizeExecutionConstraints(value) {
  const constraints = requireObject(value, "Contract execution_constraints");
  requireOnlyKeys(constraints, EXECUTION_CONSTRAINTS_ALLOWED_KEYS, "Contract execution_constraints");
  return {
    protected_paths: semanticStringArray(
      constraints.protected_paths ?? [],
      "Contract execution_constraints.protected_paths",
    ),
    required_operations: semanticStringArray(
      constraints.required_operations ?? [],
      "Contract execution_constraints.required_operations",
    ),
    forbidden_operations: semanticStringArray(
      constraints.forbidden_operations ?? [],
      "Contract execution_constraints.forbidden_operations",
    ),
    writer_restrictions: semanticStringArray(
      constraints.writer_restrictions ?? [],
      "Contract execution_constraints.writer_restrictions",
    ),
    risk_requirements: semanticStringArray(
      constraints.risk_requirements ?? [],
      "Contract execution_constraints.risk_requirements",
    ),
  };
}

function normalizePolicyDeviations(value) {
  const deviations = requireArray(value ?? [], "Contract policy.deviations").map((rawDeviation, index) => {
    const deviation = requireObject(rawDeviation, `Contract policy.deviations[${index}]`);
    requireOnlyKeys(deviation, POLICY_DEVIATION_ALLOWED_KEYS, `Contract policy.deviations[${index}]`);
    return {
      id: deviation.id === undefined
        ? `PD-${String(index + 1).padStart(3, "0")}`
        : requireIdentifier(
          deviation.id,
          `Contract policy.deviations[${index}].id`,
          POLICY_DEVIATION_ID_PATTERN,
          "CONTRACT_POLICY_INVALID",
        ),
      source_requirement: requireSemanticText(
        deviation.source_requirement,
        `Contract policy.deviations[${index}].source_requirement`,
        "CONTRACT_POLICY_INVALID",
      ),
      studio_requirement: requireSemanticText(
        deviation.studio_requirement,
        `Contract policy.deviations[${index}].studio_requirement`,
        "CONTRACT_POLICY_INVALID",
      ),
      reason: requireSemanticText(
        deviation.reason,
        `Contract policy.deviations[${index}].reason`,
        "CONTRACT_POLICY_INVALID",
      ),
    };
  });
  const ids = deviations.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    fail("CONTRACT_POLICY_INVALID", "Contract policy.deviation ids must be unique.");
  }
  return deviations;
}

function normalizePolicy(value) {
  const policy = requireObject(value, "Contract policy");
  requireOnlyKeys(policy, POLICY_ALLOWED_KEYS, "Contract policy");
  const precedence = requireString(policy.precedence, "Contract policy.precedence", "CONTRACT_POLICY_INVALID");
  if (precedence !== STUDIO_POLICY_PRECEDENCE) {
    fail(
      "CONTRACT_POLICY_INVALID",
      `Contract policy.precedence must be ${STUDIO_POLICY_PRECEDENCE}.`,
    );
  }
  return {
    precedence,
    constraints: semanticStringArray(policy.constraints ?? [], "Contract policy.constraints"),
    deviations: normalizePolicyDeviations(policy.deviations ?? []),
  };
}

function normalizeAcceptanceCriteria(value) {
  const criteria = requireArray(value, "Contract acceptance_criteria");
  if (criteria.length === 0) {
    fail("CONTRACT_ACCEPTANCE_CRITERIA_INVALID", "Contract acceptance_criteria must not be empty.");
  }
  const normalized = criteria.map((rawCriterion, index) => {
    if (typeof rawCriterion === "string") {
      return {
        id: `AC-${String(index + 1).padStart(3, "0")}`,
        text: requireSemanticText(rawCriterion, `Contract acceptance_criteria[${index}]`),
      };
    }

    const criterion = requireObject(rawCriterion, `Contract acceptance_criteria[${index}]`);
    requireOnlyKeys(criterion, ACCEPTANCE_CRITERION_ALLOWED_KEYS, `Contract acceptance_criteria[${index}]`);
    return {
      id: criterion.id === undefined
        ? `AC-${String(index + 1).padStart(3, "0")}`
        : requireIdentifier(
          criterion.id,
          `Contract acceptance_criteria[${index}].id`,
          ACCEPTANCE_CRITERION_ID_PATTERN,
          "CONTRACT_ACCEPTANCE_CRITERIA_INVALID",
        ),
      text: requireSemanticText(criterion.text, `Contract acceptance_criteria[${index}].text`),
    };
  });

  const criterionIds = normalized.map(({ id }) => id);
  if (new Set(criterionIds).size !== criterionIds.length) {
    fail("CONTRACT_ACCEPTANCE_CRITERIA_DUPLICATE", "Contract acceptance_criteria ids must be unique.");
  }
  return normalized;
}

function normalizeDeclaredRisk(value) {
  const risk = requireObject(value ?? { tier: "unknown", basis: [] }, "Contract declared_risk");
  requireOnlyKeys(risk, DECLARED_RISK_ALLOWED_KEYS, "Contract declared_risk");
  return {
    tier: requireEnum(risk.tier, "Contract declared_risk.tier", DECLARED_RISK_TIERS),
    basis: semanticStringArray(risk.basis ?? [], "Contract declared_risk.basis"),
  };
}

function normalizeProductQuestions(value, { roleIds = DEFAULT_ROLE_IDS } = {}) {
  const questions = requireArray(value ?? [], "Contract product_questions").map((rawQuestion, index) => {
    const question = requireObject(rawQuestion, `Contract product_questions[${index}]`);
    requireOnlyKeys(question, PRODUCT_QUESTION_ALLOWED_KEYS, `Contract product_questions[${index}]`);
    const ownerRole = requireIdentifier(
      question.owner_role ?? "product_owner",
      `Contract product_questions[${index}].owner_role`,
      ROLE_ID_PATTERN,
      "CONTRACT_ROLE_INVALID",
    );
    if (!roleIds.includes(ownerRole)) {
      fail("CONTRACT_ROLE_INVALID", `Contract product_questions[${index}].owner_role is unknown: ${ownerRole}.`);
    }
    return {
      id: question.id === undefined
        ? `PQ-${String(index + 1).padStart(3, "0")}`
        : requireIdentifier(
          question.id,
          `Contract product_questions[${index}].id`,
          PRODUCT_QUESTION_ID_PATTERN,
        ),
      question: requireSemanticText(question.question, `Contract product_questions[${index}].question`),
      reason: requireEnum(
        question.reason,
        `Contract product_questions[${index}].reason`,
        PRODUCT_QUESTION_REASONS,
      ),
      owner_role: ownerRole,
    };
  });
  const questionIds = questions.map(({ id }) => id);
  if (new Set(questionIds).size !== questionIds.length) {
    fail("CONTRACT_PRODUCT_QUESTIONS_DUPLICATE", "Contract product_questions ids must be unique.");
  }
  return questions;
}

function normalizeMetadata(value) {
  const metadata = requireObject(value, "Contract metadata");
  requireOnlyKeys(metadata, METADATA_ALLOWED_KEYS, "Contract metadata");
  const contractVersion = requireString(
    metadata.contract_version,
    "Contract metadata.contract_version",
    "CONTRACT_VERSION_UNSUPPORTED",
  );
  if (contractVersion !== STUDIO_READY_CONTRACT_VERSION) {
    fail("CONTRACT_VERSION_UNSUPPORTED", `Unsupported contract_version: ${contractVersion}.`);
  }

  return {
    contract_version: contractVersion,
    revision: requireInteger(metadata.revision, "Contract metadata.revision"),
    status: requireEnum(metadata.status, "Contract metadata.status", ["draft", "ready", "revised"]),
  };
}

function assertReadinessInvariants(contract) {
  if (contract.product_questions.length === 0) return;
  if (contract.mode === "build") {
    fail("CONTRACT_PRODUCT_QUESTIONS_UNRESOLVED", "Contracts with product_questions cannot use build mode.");
  }
  if (contract.metadata.status === "ready") {
    fail("CONTRACT_PRODUCT_QUESTIONS_UNRESOLVED", "Contracts with product_questions cannot be ready.");
  }
}

function inferOutcome(request) {
  const sentences = request.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  const actionSentence = sentences.find((sentence) => /\b(make|add|remove|reduce|show|hide|fix|improve|clarify)\b/i.test(sentence));
  return actionSentence || `The requested product outcome is observable: ${request}`;
}

function inferAffectedAreas(request) {
  const matches = [...request.matchAll(/\b([a-z0-9 -]{0,48}?\b(?:screen|page|view|flow|panel|summary|form|dialog|modal|report|table|list|card|banner|notification))\b/gi)];
  const areas = matches
    .map((match) => match[1].trim().replace(/^[^a-z0-9]+/i, ""))
    .filter(Boolean);
  return [...new Set(areas)].slice(0, 3);
}

function splitIntentFragments(request) {
  return request
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferQuestionBuckets(request) {
  const productQuestions = [];
  const contextRequirements = [];
  for (const fragment of splitIntentFragments(request)) {
    const isQuestion = fragment.endsWith("?");
    if (
      STRONG_PRODUCT_DECISION_QUESTION_PATTERN.test(fragment)
      || ACCESS_CONTROL_IMPERATIVE_PATTERN.test(fragment)
    ) {
      productQuestions.push({
        question: fragment,
        reason: "product_ambiguity",
        owner_role: "product_owner",
      });
    } else if (TECHNICAL_LOOKUP_QUESTION_PATTERN.test(fragment)) {
      contextRequirements.push(`Resolve through implementation evidence: ${fragment}`);
    } else if (!isQuestion || ROUTINE_REQUEST_QUESTION_PATTERN.test(fragment)) {
      continue;
    } else if (WEAK_PRODUCT_DECISION_QUESTION_PATTERN.test(fragment)) {
      productQuestions.push({
        question: fragment,
        reason: "product_ambiguity",
        owner_role: "product_owner",
      });
    } else {
      productQuestions.push({
        question: fragment,
        reason: "product_ambiguity",
        owner_role: "product_owner",
      });
    }
  }
  return { productQuestions, contextRequirements };
}

function buildContractId(seed) {
  return `studio-ready-${hashValue(seed).slice(0, 12)}`;
}

function validateBriefShape(value, { detailed = false } = {}) {
  const brief = requireObject(value, "Studio Ready brief", "STUDIO_READY_BRIEF_INVALID");
  requireOnlyKeys(brief, BRIEF_ALLOWED_KEYS, "Studio Ready brief", "STUDIO_READY_BRIEF_INVALID");
  if (detailed) {
    for (const key of DETAILED_BRIEF_REQUIRED_KEYS) {
      if (!(key in brief)) {
        fail("STUDIO_READY_BRIEF_INCOMPLETE", `Detailed Studio Ready brief is missing explicit field: ${key}.`);
      }
    }
  }
  return brief;
}

function briefContractOptions(brief) {
  return {
    request: brief.request ?? brief.intent,
    appProfile: brief.app_profile,
    contractId: brief.contract_id,
    mode: brief.mode,
    intent: brief.intent ?? brief.request,
    desiredOutcome: brief.desired_outcome,
    scope: brief.scope,
    nonGoals: brief.non_goals,
    acceptanceCriteria: brief.acceptance_criteria,
    guardrails: brief.guardrails,
    affectedAreas: brief.affected_areas,
    declaredRisk: brief.declared_risk,
    evidenceRequired: brief.evidence_required,
    testsRequired: brief.tests_required,
    contextRequirements: brief.context_requirements,
    stopConditions: brief.stop_conditions,
    productQuestions: brief.product_questions,
    protectedPaths: brief.protected_paths,
    requiredOperations: brief.required_operations,
    forbiddenOperations: brief.forbidden_operations,
    writerRestrictions: brief.writer_restrictions,
    riskRequirements: brief.risk_requirements,
  };
}

export function createStudioReadyContract({
  request,
  studio,
  appProfile,
  contractId,
  mode = "build",
  inputKind = "structured_brief",
  source,
  sourceReference,
  intent,
  desiredOutcome,
  scope,
  nonGoals,
  acceptanceCriteria,
  guardrails,
  affectedAreas,
  declaredRisk,
  evidenceRequired,
  testsRequired,
  contextRequirements,
  objectiveTechnicalContext,
  stopConditions,
  productQuestions,
  protectedPaths,
  requiredOperations,
  forbiddenOperations,
  writerRestrictions,
  riskRequirements,
  policyConstraints,
  policyDeviations,
  metadata,
} = {}) {
  const sourceRequest = requireSemanticText(request, "Product request");
  const resolvedInputKind = requireEnum(
    inputKind,
    "Studio Ready input kind",
    STUDIO_READY_INPUT_KINDS,
    "CONTRACT_SOURCE_INVALID",
  );
  const sourceProvenance = {
    input_kind: resolvedInputKind,
    fingerprint: fingerprintStudioReadySource(source ?? sourceRequest),
    ...(sourceReference === undefined ? {} : { source_reference: sourceReference }),
  };
  const resolvedAppProfile = toSnakeAppProfile(appProfile ?? appProfileFromStudio(studio));
  const inferredQuestions = inferQuestionBuckets(sourceRequest);
  const resolvedDesiredOutcome = requireSemanticText(
    desiredOutcome ?? inferOutcome(sourceRequest),
    "Contract desired_outcome",
  );
  const resolvedAffectedAreas = affectedAreas ?? inferAffectedAreas(sourceRequest);
  const useFallbackInference = resolvedInputKind !== "studio_ready_brief";
  const resolvedContextRequirements = [
    ...(contextRequirements ?? []),
    ...(objectiveTechnicalContext ?? []),
    ...(useFallbackInference ? inferredQuestions.contextRequirements : []),
  ];
  const suppliedProductQuestions = productQuestions ?? [];
  const suppliedQuestionTexts = new Set(suppliedProductQuestions.map(({ question }) => question));
  const resolvedProductQuestions = [
    ...suppliedProductQuestions,
    ...(useFallbackInference
      ? inferredQuestions.productQuestions.filter(({ question }) => !suppliedQuestionTexts.has(question))
      : []),
  ];
  const resolvedAcceptanceCriteria = normalizeAcceptanceCriteria(acceptanceCriteria);
  const requestedMode = requireEnum(mode, "Contract mode", STUDIO_READY_MODES, "CONTRACT_MODE_INVALID");
  const requiresDraft = resolvedProductQuestions.length > 0;
  const resolvedMode = requiresDraft && requestedMode === "build" ? "plan" : requestedMode;
  const readinessDeviations = requiresDraft && requestedMode === "build"
    ? [{
      source_requirement: "Execution mode: build.",
      studio_requirement: "Execution mode: plan until unresolved product judgement is resolved.",
      reason: "Contracts with product_questions cannot execute as build-ready.",
    }]
    : [];
  const resolvedMetadata = metadata ?? {
    contract_version: STUDIO_READY_CONTRACT_VERSION,
    revision: 1,
    status: requiresDraft ? "draft" : "ready",
  };
  const id = contractId ?? buildContractId({
    profile: resolvedAppProfile.profile_id,
    source_fingerprint: sourceProvenance.fingerprint,
    mode: resolvedMode,
    desired_outcome: resolvedDesiredOutcome,
    acceptance_criteria: resolvedAcceptanceCriteria,
  });

  return validateStudioReadyContract({
    schema_version: STUDIO_READY_SCHEMA_VERSION,
    contract_type: STUDIO_READY_CONTRACT_TYPE,
    contract_id: id,
    app_profile: resolvedAppProfile,
    source_provenance: sourceProvenance,
    intent: intent ?? sourceRequest,
    desired_outcome: resolvedDesiredOutcome,
    mode: resolvedMode,
    scope: scope ?? [],
    non_goals: nonGoals ?? [],
    acceptance_criteria: resolvedAcceptanceCriteria,
    guardrails: guardrails ?? [],
    affected_areas: resolvedAffectedAreas,
    declared_risk: declaredRisk ?? { tier: "unknown", basis: [] },
    evidence_required: evidenceRequired ?? ["Evidence that each acceptance criterion is satisfied."],
    tests_required: testsRequired ?? ["Targeted validation for each acceptance criterion."],
    context_requirements: resolvedContextRequirements,
    stop_conditions: stopConditions ?? [],
    product_questions: resolvedProductQuestions,
    execution_constraints: {
      protected_paths: protectedPaths ?? [],
      required_operations: requiredOperations ?? [],
      forbidden_operations: forbiddenOperations ?? [],
      writer_restrictions: writerRestrictions ?? [],
      risk_requirements: riskRequirements ?? [],
    },
    policy: {
      precedence: STUDIO_POLICY_PRECEDENCE,
      constraints: policyConstraints ?? [],
      deviations: [...(policyDeviations ?? []), ...readinessDeviations],
    },
    metadata: resolvedMetadata,
  });
}

export function intakeStudioReadyBrief({
  brief: rawBrief,
  studio,
  appProfile,
  sourceReference,
  objectiveTechnicalContext,
  policyConstraints,
  policyDeviations,
} = {}) {
  const brief = validateBriefShape(rawBrief, { detailed: true });
  return createStudioReadyContract({
    ...briefContractOptions(brief),
    studio,
    appProfile: brief.app_profile ?? appProfile,
    inputKind: "studio_ready_brief",
    source: brief,
    sourceReference,
    objectiveTechnicalContext,
    policyConstraints,
    policyDeviations,
  });
}

export function intakeStructuredBrief({
  brief: rawBrief,
  studio,
  appProfile,
  sourceReference,
  objectiveTechnicalContext,
  policyConstraints,
  policyDeviations,
} = {}) {
  const brief = validateBriefShape(rawBrief);
  return createStudioReadyContract({
    ...briefContractOptions(brief),
    studio,
    appProfile: brief.app_profile ?? appProfile,
    inputKind: "structured_brief",
    source: brief,
    sourceReference,
    objectiveTechnicalContext,
    policyConstraints,
    policyDeviations,
  });
}

export function intakeNaturalIntent(options = {}) {
  return createStudioReadyContract({
    ...options,
    inputKind: "natural_intent",
    source: options.source ?? options.request,
  });
}

export function translateStudioReadyRequest(options = {}) {
  return intakeNaturalIntent(options);
}

export function validateStudioReadyContract(value, options = {}) {
  const contract = requireObject(value, "Studio Ready contract");
  requireOnlyKeys(contract, CONTRACT_ALLOWED_KEYS, "Studio Ready contract");

  const schemaVersion = requireInteger(
    contract.schema_version,
    "Contract schema_version",
    "CONTRACT_VERSION_UNSUPPORTED",
  );
  if (schemaVersion !== STUDIO_READY_SCHEMA_VERSION) {
    fail("CONTRACT_VERSION_UNSUPPORTED", `Unsupported schema_version: ${schemaVersion}.`);
  }

  const contractType = requireString(contract.contract_type, "Contract contract_type");
  if (contractType !== STUDIO_READY_CONTRACT_TYPE) {
    fail("CONTRACT_INVALID", `Contract contract_type must be ${STUDIO_READY_CONTRACT_TYPE}.`);
  }

  const desiredOutcome = requireSemanticText(contract.desired_outcome, "Contract desired_outcome");
  const normalized = {
    schema_version: schemaVersion,
    contract_type: contractType,
    contract_id: requireIdentifier(
      contract.contract_id,
      "Contract contract_id",
      CONTRACT_ID_PATTERN,
      "CONTRACT_ID_INVALID",
    ),
    app_profile: normalizeAppProfile(contract.app_profile, options),
    source_provenance: normalizeSourceProvenance(contract.source_provenance),
    intent: requireSemanticText(contract.intent, "Contract intent"),
    desired_outcome: desiredOutcome,
    mode: requireEnum(contract.mode, "Contract mode", STUDIO_READY_MODES, "CONTRACT_MODE_INVALID"),
    scope: semanticStringArray(contract.scope ?? [], "Contract scope"),
    non_goals: semanticStringArray(contract.non_goals ?? [], "Contract non_goals"),
    acceptance_criteria: normalizeAcceptanceCriteria(contract.acceptance_criteria),
    guardrails: semanticStringArray(contract.guardrails ?? [], "Contract guardrails"),
    affected_areas: semanticStringArray(contract.affected_areas ?? [], "Contract affected_areas"),
    declared_risk: normalizeDeclaredRisk(contract.declared_risk),
    evidence_required: semanticStringArray(contract.evidence_required ?? [], "Contract evidence_required"),
    tests_required: semanticStringArray(contract.tests_required ?? [], "Contract tests_required"),
    context_requirements: semanticStringArray(contract.context_requirements ?? [], "Contract context_requirements"),
    stop_conditions: semanticStringArray(contract.stop_conditions ?? [], "Contract stop_conditions"),
    product_questions: normalizeProductQuestions(contract.product_questions ?? [], options),
    execution_constraints: normalizeExecutionConstraints(contract.execution_constraints),
    policy: normalizePolicy(contract.policy),
    metadata: normalizeMetadata(contract.metadata),
  };

  assertReadinessInvariants(normalized);
  return deepFreeze(normalized);
}

export function hashStudioReadyContract(contract) {
  const normalized = validateStudioReadyContract(contract);
  return hashValue(normalized);
}
