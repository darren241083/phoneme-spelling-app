export const DELIVERY_MODEL_LEGACY_FIXED = "legacy_fixed";
export const DELIVERY_MODEL_SUPPORT_LADDER = "support_ladder";

export const SUPPORT_STATE_INDEPENDENT = "independent";
export const SUPPORT_STATE_RETRY = "retry";
export const SUPPORT_STATE_SUPPORTED = "supported";
export const SUPPORT_STATE_ACCESS_ISSUE = "access_issue";

export const EVIDENCE_CATEGORY_CORRECT_FIRST_TIME = "correct_first_time";
export const EVIDENCE_CATEGORY_CORRECT_AFTER_RETRY = "correct_after_retry";
export const EVIDENCE_CATEGORY_CORRECT_WITH_SUPPORT = "correct_with_support";
export const EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT = "incorrect_with_support";
export const EVIDENCE_CATEGORY_ACCESS_ISSUE = "access_issue";

export const SUPPORT_ACTION_REPLAY_WORD = "replay_word";
export const SUPPORT_ACTION_REQUIRED_SENTENCE = "required_sentence";
export const SUPPORT_ACTION_CLARIFICATION_SENTENCE = "clarification_sentence";
export const SUPPORT_ACTION_MEANING = "meaning";
export const SUPPORT_ACTION_SEGMENTED_INPUT = "segmented_input";
export const SUPPORT_ACTION_FOCUS_SOUND = "focus_sound";

export const SUPPORT_LADDER_EVIDENCE_CATEGORIES = Object.freeze([
  EVIDENCE_CATEGORY_CORRECT_FIRST_TIME,
  EVIDENCE_CATEGORY_CORRECT_AFTER_RETRY,
  EVIDENCE_CATEGORY_CORRECT_WITH_SUPPORT,
  EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT,
  EVIDENCE_CATEGORY_ACCESS_ISSUE,
]);

export const SUPPORT_LADDER_SUPPORT_ACTIONS = Object.freeze([
  SUPPORT_ACTION_REPLAY_WORD,
  SUPPORT_ACTION_REQUIRED_SENTENCE,
  SUPPORT_ACTION_CLARIFICATION_SENTENCE,
  SUPPORT_ACTION_MEANING,
  SUPPORT_ACTION_SEGMENTED_INPUT,
  SUPPORT_ACTION_FOCUS_SOUND,
]);

export const SUPPORT_LADDER_NEUTRAL_ACTIONS = Object.freeze([
  SUPPORT_ACTION_REPLAY_WORD,
  SUPPORT_ACTION_REQUIRED_SENTENCE,
]);

export const SUPPORT_LADDER_PROMPT_IDENTIFICATION_ACTIONS = Object.freeze([
  SUPPORT_ACTION_CLARIFICATION_SENTENCE,
  SUPPORT_ACTION_MEANING,
]);

export const SUPPORT_LADDER_MATERIAL_ACTIONS = Object.freeze([
  SUPPORT_ACTION_SEGMENTED_INPUT,
  SUPPORT_ACTION_FOCUS_SOUND,
]);

const DELIVERY_MODEL_VALUES = new Set([
  DELIVERY_MODEL_LEGACY_FIXED,
  DELIVERY_MODEL_SUPPORT_LADDER,
]);
const SUPPORT_STATE_VALUES = new Set([
  SUPPORT_STATE_INDEPENDENT,
  SUPPORT_STATE_RETRY,
  SUPPORT_STATE_SUPPORTED,
  SUPPORT_STATE_ACCESS_ISSUE,
]);
const EVIDENCE_CATEGORY_VALUES = new Set(SUPPORT_LADDER_EVIDENCE_CATEGORIES);
const SUPPORT_ACTION_VALUES = new Set(SUPPORT_LADDER_SUPPORT_ACTIONS);
const PROMPT_IDENTIFICATION_ACTION_VALUES = new Set(SUPPORT_LADDER_PROMPT_IDENTIFICATION_ACTIONS);
const MATERIAL_SUPPORT_ACTION_VALUES = new Set(SUPPORT_LADDER_MATERIAL_ACTIONS);

function normalizeKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function readFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function normalizeOptionalBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  const key = normalizeKey(value);
  if (["true", "yes", "y", "1"].includes(key)) return true;
  if (["false", "no", "n", "0"].includes(key)) return false;
  return null;
}

function parseActionInput(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, enabled]) => normalizeOptionalBoolean(enabled) !== false && !!enabled)
      .map(([key]) => key);
  }

  const text = String(value || "").trim();
  if (!text) return [];
  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to simple token parsing.
    }
  }
  return text.split(/[\s,]+/).filter(Boolean);
}

export function normalizeDeliveryModel(value = "") {
  const key = normalizeKey(value);
  if (["supportladder", "ladder"].includes(key)) return DELIVERY_MODEL_SUPPORT_LADDER;
  if (DELIVERY_MODEL_VALUES.has(key)) return key;
  return DELIVERY_MODEL_LEGACY_FIXED;
}

export function normalizeSupportState(value = "") {
  const key = normalizeKey(value);
  if (["first", "first_attempt", "independent_first"].includes(key)) return SUPPORT_STATE_INDEPENDENT;
  if (["second", "second_attempt", "self_correction"].includes(key)) return SUPPORT_STATE_RETRY;
  if (["support", "scaffolded"].includes(key)) return SUPPORT_STATE_SUPPORTED;
  if (["access", "word_access_issue", "clarification_issue"].includes(key)) return SUPPORT_STATE_ACCESS_ISSUE;
  return SUPPORT_STATE_VALUES.has(key) ? key : "";
}

export function normalizeEvidenceCategory(value = "") {
  const key = normalizeKey(value);
  return EVIDENCE_CATEGORY_VALUES.has(key) ? key : "";
}

export function normalizeSupportAction(value = "") {
  const key = normalizeKey(value);
  if (["replay", "replay_audio", "hear_again", "listen_again"].includes(key)) {
    return SUPPORT_ACTION_REPLAY_WORD;
  }
  if (["sentence_required", "required_context_sentence"].includes(key)) {
    return SUPPORT_ACTION_REQUIRED_SENTENCE;
  }
  if (["clarification", "context_sentence", "optional_sentence"].includes(key)) {
    return SUPPORT_ACTION_CLARIFICATION_SENTENCE;
  }
  if (["definition", "context_meaning"].includes(key)) {
    return SUPPORT_ACTION_MEANING;
  }
  if (["segmented", "segmented_spelling"].includes(key)) {
    return SUPPORT_ACTION_SEGMENTED_INPUT;
  }
  if (["focus", "focus_grapheme", "focus_help"].includes(key)) {
    return SUPPORT_ACTION_FOCUS_SOUND;
  }
  return SUPPORT_ACTION_VALUES.has(key) ? key : "";
}

export function normalizeSupportActions(value = []) {
  const normalized = new Set(
    parseActionInput(value)
      .map((item) => normalizeSupportAction(item))
      .filter(Boolean)
  );
  return SUPPORT_LADDER_SUPPORT_ACTIONS.filter((action) => normalized.has(action));
}

export function hasMaterialSupportActions(value = []) {
  return normalizeSupportActions(value).some((action) => MATERIAL_SUPPORT_ACTION_VALUES.has(action));
}

export function hasPromptIdentificationActions(value = []) {
  return normalizeSupportActions(value).some((action) => PROMPT_IDENTIFICATION_ACTION_VALUES.has(action));
}

function getOutcomeSupportActions(outcome = null, context = null) {
  const source = outcome && typeof outcome === "object" ? outcome : {};
  const options = context && typeof context === "object" ? context : {};
  return normalizeSupportActions([
    ...parseActionInput(source.support_actions ?? source.supportActions),
    ...parseActionInput(options.support_actions ?? options.supportActions),
  ]);
}

function getOutcomeAttemptNumber(outcome = null) {
  const source = outcome && typeof outcome === "object" ? outcome : {};
  const value = Number(
    source.attempt_number
    ?? source.attemptNumber
    ?? source.attempts_used
    ?? source.attemptsUsed
    ?? 1
  );
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

function isTerminalOutcome(outcome = null) {
  const source = outcome && typeof outcome === "object" ? outcome : {};
  const explicit = readFirstDefined(
    source.terminal,
    source.is_terminal,
    source.isTerminal,
    source.completed,
    source.final,
    source.is_final,
    source.isFinal,
  );
  if (explicit !== undefined) return normalizeOptionalBoolean(explicit) === true;
  if (normalizeEvidenceCategory(source.evidence_category ?? source.evidenceCategory)) return true;
  if (normalizeSupportState(source.support_state ?? source.supportState) === SUPPORT_STATE_ACCESS_ISSUE) return true;
  return normalizeOptionalBoolean(source.rawCorrect ?? source.correct ?? source.is_correct) !== null;
}

function buildNotScoredInterpretation({
  deliveryModel,
  supportState = "",
  supportActions = [],
  rawCorrect = null,
  terminal = false,
} = {}) {
  return {
    deliveryModel,
    supportState,
    supportActions,
    terminal,
    category: null,
    rawCorrect,
    headlineIncluded: false,
    headlineCorrect: false,
    independentSignal: "none",
    diagnosticSignal: "none",
    reviewSignal: "none",
    accessFlag: false,
    displayKey: "not_scored",
  };
}

function interpretLegacyEvidence(outcome = null, context = null) {
  const source = outcome && typeof outcome === "object" ? outcome : {};
  const rawCorrect = normalizeOptionalBoolean(source.rawCorrect ?? source.correct ?? source.is_correct);
  const terminal = isTerminalOutcome(source);
  if (!terminal || rawCorrect === null) {
    return buildNotScoredInterpretation({
      deliveryModel: DELIVERY_MODEL_LEGACY_FIXED,
      supportActions: getOutcomeSupportActions(source, context),
      rawCorrect,
      terminal,
    });
  }

  return {
    deliveryModel: DELIVERY_MODEL_LEGACY_FIXED,
    supportState: "",
    supportActions: getOutcomeSupportActions(source, context),
    terminal: true,
    category: null,
    rawCorrect,
    headlineIncluded: true,
    headlineCorrect: rawCorrect,
    independentSignal: rawCorrect ? "legacy_correct" : "legacy_incorrect",
    diagnosticSignal: "none",
    reviewSignal: rawCorrect ? "low" : "high",
    accessFlag: false,
    displayKey: rawCorrect ? "legacy_correct" : "legacy_incorrect",
  };
}

function inferRawCorrectFromCategory(category = "") {
  if ([
    EVIDENCE_CATEGORY_CORRECT_FIRST_TIME,
    EVIDENCE_CATEGORY_CORRECT_AFTER_RETRY,
    EVIDENCE_CATEGORY_CORRECT_WITH_SUPPORT,
  ].includes(category)) {
    return true;
  }
  if (category === EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT) return false;
  return null;
}

export function interpretWordEvidence(outcome = null, context = null) {
  const source = outcome && typeof outcome === "object" ? outcome : {};
  const options = context && typeof context === "object" ? context : {};
  const requestedDeliveryModel = readFirstDefined(
    source.delivery_model,
    source.deliveryModel,
    options.delivery_model,
    options.deliveryModel,
  );
  const deliveryModel = normalizeDeliveryModel(requestedDeliveryModel);
  if (deliveryModel !== DELIVERY_MODEL_SUPPORT_LADDER) {
    return interpretLegacyEvidence(source, options);
  }

  const explicitCategory = normalizeEvidenceCategory(
    source.evidence_category
    ?? source.evidenceCategory
  );
  const supportActions = getOutcomeSupportActions(source, options);
  const materialSupportUsed = hasMaterialSupportActions(supportActions);
  const attemptNumber = getOutcomeAttemptNumber(source);
  let supportState = normalizeSupportState(
    source.support_state
    ?? source.supportState
    ?? options.support_state
    ?? options.supportState
  );
  if (!supportState) {
    supportState = attemptNumber > 1 ? SUPPORT_STATE_RETRY : SUPPORT_STATE_INDEPENDENT;
  }

  const accessFlag = supportState === SUPPORT_STATE_ACCESS_ISSUE
    || explicitCategory === EVIDENCE_CATEGORY_ACCESS_ISSUE
    || normalizeOptionalBoolean(source.access_issue ?? source.accessIssue) === true;
  const terminal = isTerminalOutcome(source) || accessFlag;
  let rawCorrect = normalizeOptionalBoolean(source.rawCorrect ?? source.correct ?? source.is_correct);
  if (rawCorrect === null) rawCorrect = inferRawCorrectFromCategory(explicitCategory);

  if (!terminal) {
    return buildNotScoredInterpretation({
      deliveryModel,
      supportState,
      supportActions,
      rawCorrect,
      terminal: false,
    });
  }

  if (accessFlag) {
    return {
      deliveryModel,
      supportState: SUPPORT_STATE_ACCESS_ISSUE,
      supportActions,
      terminal: true,
      category: EVIDENCE_CATEGORY_ACCESS_ISSUE,
      rawCorrect: null,
      headlineIncluded: false,
      headlineCorrect: false,
      independentSignal: "not_applicable",
      diagnosticSignal: "access_issue",
      reviewSignal: "clarification",
      accessFlag: true,
      displayKey: EVIDENCE_CATEGORY_ACCESS_ISSUE,
    };
  }

  if (rawCorrect === null) {
    return buildNotScoredInterpretation({
      deliveryModel,
      supportState,
      supportActions,
      rawCorrect,
      terminal: false,
    });
  }

  const supportedOutcome = materialSupportUsed
    || supportState === SUPPORT_STATE_SUPPORTED
    || explicitCategory === EVIDENCE_CATEGORY_CORRECT_WITH_SUPPORT
    || explicitCategory === EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT;

  let category = EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT;
  if (supportedOutcome) {
    category = rawCorrect
      ? EVIDENCE_CATEGORY_CORRECT_WITH_SUPPORT
      : EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT;
  } else if (rawCorrect && (
    supportState === SUPPORT_STATE_RETRY
    || attemptNumber > 1
    || explicitCategory === EVIDENCE_CATEGORY_CORRECT_AFTER_RETRY
  )) {
    category = EVIDENCE_CATEGORY_CORRECT_AFTER_RETRY;
  } else if (rawCorrect) {
    category = EVIDENCE_CATEGORY_CORRECT_FIRST_TIME;
  }

  const categoryMeta = {
    [EVIDENCE_CATEGORY_CORRECT_FIRST_TIME]: {
      headlineCorrect: true,
      independentSignal: "independent_success",
      diagnosticSignal: "none",
      reviewSignal: "low",
    },
    [EVIDENCE_CATEGORY_CORRECT_AFTER_RETRY]: {
      headlineCorrect: false,
      independentSignal: "self_corrected",
      diagnosticSignal: "self_correction",
      reviewSignal: "monitor",
    },
    [EVIDENCE_CATEGORY_CORRECT_WITH_SUPPORT]: {
      headlineCorrect: false,
      independentSignal: "not_independent",
      diagnosticSignal: "supported_success",
      reviewSignal: "review",
    },
    [EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT]: {
      headlineCorrect: false,
      independentSignal: "independent_incorrect",
      diagnosticSignal: "supported_need",
      reviewSignal: "high",
    },
  }[category];

  return {
    deliveryModel,
    supportState,
    supportActions,
    terminal: true,
    category,
    rawCorrect,
    headlineIncluded: true,
    headlineCorrect: categoryMeta.headlineCorrect,
    independentSignal: categoryMeta.independentSignal,
    diagnosticSignal: categoryMeta.diagnosticSignal,
    reviewSignal: categoryMeta.reviewSignal,
    accessFlag: false,
    displayKey: category,
  };
}

function isInterpretedEvidence(value = null) {
  return !!value
    && typeof value === "object"
    && Object.prototype.hasOwnProperty.call(value, "headlineIncluded")
    && Object.prototype.hasOwnProperty.call(value, "rawCorrect")
    && Object.prototype.hasOwnProperty.call(value, "displayKey");
}

function toEvidenceInterpretation(value = null) {
  return isInterpretedEvidence(value) ? value : interpretWordEvidence(value);
}

export function summarizeEvidence(outcomes = []) {
  const rows = (Array.isArray(outcomes) ? outcomes : [])
    .map((outcome) => toEvidenceInterpretation(outcome));
  const terminalRows = rows.filter((row) => row?.terminal === true);
  const categoryCounts = Object.fromEntries(
    SUPPORT_LADDER_EVIDENCE_CATEGORIES.map((category) => [category, 0])
  );
  let uncategorizedTerminalCount = 0;

  for (const row of terminalRows) {
    if (row?.category && Object.prototype.hasOwnProperty.call(categoryCounts, row.category)) {
      categoryCounts[row.category] += 1;
    } else {
      uncategorizedTerminalCount += 1;
    }
  }

  const rawAttemptRows = terminalRows.filter((row) => typeof row?.rawCorrect === "boolean");
  const headlineRows = terminalRows.filter((row) => row?.headlineIncluded === true);
  const rawCorrect = rawAttemptRows.filter((row) => row.rawCorrect).length;
  const headlineCorrect = headlineRows.filter((row) => row.headlineCorrect === true).length;

  return {
    totalOutcomes: rows.length,
    terminalOutcomes: terminalRows.length,
    uncategorizedTerminalCount,
    categoryCounts,
    rawAttempted: rawAttemptRows.length,
    rawCorrect,
    rawIncorrect: Math.max(0, rawAttemptRows.length - rawCorrect),
    rawScoreRate: rawAttemptRows.length ? rawCorrect / rawAttemptRows.length : null,
    headlineAttempted: headlineRows.length,
    headlineCorrect,
    headlineIncorrect: Math.max(0, headlineRows.length - headlineCorrect),
    headlineScoreRate: headlineRows.length ? headlineCorrect / headlineRows.length : null,
    accessIssueCount: categoryCounts[EVIDENCE_CATEGORY_ACCESS_ISSUE],
    selfCorrectedCount: categoryCounts[EVIDENCE_CATEGORY_CORRECT_AFTER_RETRY],
    supportedCorrectCount: categoryCounts[EVIDENCE_CATEGORY_CORRECT_WITH_SUPPORT],
    supportedIncorrectCount: categoryCounts[EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT],
    independentFirstCorrectCount: categoryCounts[EVIDENCE_CATEGORY_CORRECT_FIRST_TIME],
  };
}

function normalizeSourceInput(value = null) {
  if (value && typeof value === "object") {
    return normalizeKey(
      value.evidence_source
      ?? value.evidenceSource
      ?? value.attempt_source
      ?? value.attemptSource
      ?? value.source
      ?? ""
    );
  }
  return normalizeKey(value);
}

export function classifyEvidenceSource(value = null) {
  const source = normalizeSourceInput(value);
  if (["extra_challenge", "extrachallenge"].includes(source)) {
    return {
      source: "extra_challenge",
      kind: "extra_challenge",
      coreProgressEligible: false,
      headlineProgressEligible: false,
      baselineEligible: false,
      optionalPractice: true,
    };
  }
  if (["practice", "learn"].includes(source)) {
    return {
      source: source || "practice",
      kind: "practice",
      coreProgressEligible: false,
      headlineProgressEligible: false,
      baselineEligible: false,
      optionalPractice: true,
    };
  }
  if (["baseline", "baseline_v1", "baseline_v2"].includes(source)) {
    return {
      source: "baseline",
      kind: "baseline",
      coreProgressEligible: false,
      headlineProgressEligible: false,
      baselineEligible: true,
      optionalPractice: false,
    };
  }
  if ([
    "assigned_core",
    "teacher_assigned",
    "auto_assigned",
    "auto_generated",
    "generated",
    "test",
  ].includes(source)) {
    return {
      source: source || "assigned_core",
      kind: "assigned_core",
      coreProgressEligible: true,
      headlineProgressEligible: true,
      baselineEligible: false,
      optionalPractice: false,
    };
  }
  return {
    source,
    kind: "legacy",
    coreProgressEligible: true,
    headlineProgressEligible: true,
    baselineEligible: false,
    optionalPractice: false,
  };
}

function getCategoryCount(categoryCounts = null, category = "") {
  const value = Number(categoryCounts?.[category] || 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function buildSelectorEvidenceSignal(outcome = null, context = null) {
  const options = context && typeof context === "object" ? context : {};
  const interpreted = toEvidenceInterpretation(outcome);
  const sourcePolicy = classifyEvidenceSource(options.source ?? outcome);
  const categoryCounts = options.categoryCounts && typeof options.categoryCounts === "object"
    ? options.categoryCounts
    : null;
  const repeatedIncorrectCount = Number.isFinite(Number(options.incorrectWithSupportCount))
    ? Math.max(0, Number(options.incorrectWithSupportCount))
    : Math.max(
      getCategoryCount(categoryCounts, EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT),
      interpreted.category === EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT ? 1 : 0,
    );
  const supportedDependenceCount = Number.isFinite(Number(options.supportedDependenceCount))
    ? Math.max(0, Number(options.supportedDependenceCount))
    : Math.max(
      getCategoryCount(categoryCounts, EVIDENCE_CATEGORY_CORRECT_WITH_SUPPORT)
        + getCategoryCount(categoryCounts, EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT),
      [
        EVIDENCE_CATEGORY_CORRECT_WITH_SUPPORT,
        EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT,
      ].includes(interpreted.category) ? 1 : 0,
    );

  const base = {
    category: interpreted.category,
    priority: 30,
    priorityBand: "insufficient",
    rationale: "new_or_insufficient_evidence",
    spellingNeed: false,
    secureEvidence: false,
    supportedDependence: false,
    accessFlag: interpreted.accessFlag === true,
    clarificationFlag: interpreted.accessFlag === true,
    coreProgressEligible: sourcePolicy.coreProgressEligible,
    sourcePolicy,
  };

  if (interpreted.accessFlag) {
    return {
      ...base,
      priority: 0,
      priorityBand: "access",
      rationale: "access_clarification_needed",
    };
  }
  if (!interpreted.terminal || (!interpreted.category && interpreted.rawCorrect === null)) {
    return base;
  }
  if (interpreted.deliveryModel === DELIVERY_MODEL_LEGACY_FIXED) {
    return interpreted.rawCorrect
      ? {
        ...base,
        priority: 10,
        priorityBand: "low",
        rationale: "legacy_correct",
        secureEvidence: true,
      }
      : {
        ...base,
        priority: 90,
        priorityBand: "high",
        rationale: "legacy_incorrect",
        spellingNeed: true,
      };
  }
  if (
    interpreted.category === EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT
    && repeatedIncorrectCount >= 2
  ) {
    return {
      ...base,
      priority: 100,
      priorityBand: "highest",
      rationale: "repeated_incorrect_with_support",
      spellingNeed: true,
      supportedDependence: true,
    };
  }
  if (interpreted.category === EVIDENCE_CATEGORY_INCORRECT_WITH_SUPPORT) {
    return {
      ...base,
      priority: 90,
      priorityBand: "high",
      rationale: "incorrect_with_support",
      spellingNeed: true,
      supportedDependence: true,
    };
  }
  if (supportedDependenceCount >= 2) {
    return {
      ...base,
      priority: 90,
      priorityBand: "high",
      rationale: "repeated_supported_dependence",
      spellingNeed: true,
      supportedDependence: true,
    };
  }
  if (interpreted.category === EVIDENCE_CATEGORY_CORRECT_WITH_SUPPORT) {
    return {
      ...base,
      priority: 70,
      priorityBand: "review",
      rationale: "correct_with_support",
      spellingNeed: true,
      supportedDependence: true,
    };
  }
  if (interpreted.category === EVIDENCE_CATEGORY_CORRECT_AFTER_RETRY) {
    return {
      ...base,
      priority: 50,
      priorityBand: "monitor",
      rationale: "correct_after_retry",
    };
  }
  if (interpreted.category === EVIDENCE_CATEGORY_CORRECT_FIRST_TIME) {
    return {
      ...base,
      priority: 10,
      priorityBand: "low",
      rationale: "correct_first_time",
      secureEvidence: true,
    };
  }
  return base;
}

export function buildSelectorEvidenceProfile(outcomes = [], context = null) {
  const rows = Array.isArray(outcomes) ? outcomes : [];
  const summary = summarizeEvidence(rows);
  const signals = rows.map((outcome) => buildSelectorEvidenceSignal(outcome, {
    ...(context && typeof context === "object" ? context : {}),
    categoryCounts: summary.categoryCounts,
  }));
  const topSignal = [...signals].sort((a, b) => (
    Number(b?.priority || 0) - Number(a?.priority || 0)
  ))[0] || buildSelectorEvidenceSignal(null, context);

  return {
    ...summary,
    topSignal,
    signals,
    accessReviewRequired: summary.accessIssueCount > 0,
    coreEligibleOutcomeCount: signals.filter((signal) => signal?.coreProgressEligible).length,
  };
}
