import {
  DELIVERY_MODEL_SUPPORT_LADDER,
  EVIDENCE_CATEGORY_ACCESS_ISSUE,
  SUPPORT_ACTION_CLARIFICATION_SENTENCE,
  SUPPORT_ACTION_MEANING,
  SUPPORT_ACTION_SEGMENTED_INPUT,
  SUPPORT_STATE_ACCESS_ISSUE,
  SUPPORT_STATE_INDEPENDENT,
  SUPPORT_STATE_RETRY,
  SUPPORT_STATE_SUPPORTED,
  interpretWordEvidence,
  normalizeDeliveryModel,
  normalizeSupportActions,
  normalizeSupportState,
} from "./supportLadderEvidence.js";

export const SUPPORT_LADDER_RUNTIME_PHASES = Object.freeze([
  SUPPORT_STATE_INDEPENDENT,
  SUPPORT_STATE_RETRY,
  SUPPORT_STATE_SUPPORTED,
  SUPPORT_STATE_ACCESS_ISSUE,
]);

const PHASE_ATTEMPT_NUMBERS = Object.freeze({
  [SUPPORT_STATE_INDEPENDENT]: 1,
  [SUPPORT_STATE_RETRY]: 2,
  [SUPPORT_STATE_SUPPORTED]: 3,
  [SUPPORT_STATE_ACCESS_ISSUE]: 1,
});

function readRuntimeFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeRuntimeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  const key = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(key)) return true;
  if (["false", "no", "n", "0"].includes(key)) return false;
  return false;
}

function normalizeOptionalCorrectness(value) {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  const key = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(key)) return true;
  if (["false", "no", "n", "0"].includes(key)) return false;
  return null;
}

function normalizeTypedValue(value) {
  return String(value ?? "").trim();
}

function normalizePhase(value) {
  return normalizeSupportState(value) || SUPPORT_STATE_INDEPENDENT;
}

function normalizeStateActions(source, phase) {
  const rawActions = readRuntimeFirstDefined(
    source?.supportActions,
    source?.support_actions,
    []
  );
  const actions = normalizeSupportActions(rawActions);
  if (phase === SUPPORT_STATE_SUPPORTED) {
    return normalizeSupportActions([...actions, SUPPORT_ACTION_SEGMENTED_INPUT]);
  }
  return actions;
}

function hasAccessIssueOutcome(outcome = null) {
  const source = isPlainObject(outcome) ? outcome : {};
  return normalizeRuntimeBoolean(readRuntimeFirstDefined(
    source.accessIssue,
    source.access_issue,
    source.wordAccessIssue,
    source.word_access_issue
  ));
}

function normalizeOutcomeCorrectness(outcome = null, { accessIssue = false } = {}) {
  if (accessIssue) return null;
  const source = isPlainObject(outcome) ? outcome : {};
  return normalizeOptionalCorrectness(readRuntimeFirstDefined(
    source.rawCorrect,
    source.raw_correct,
    source.correct,
    source.is_correct
  ));
}

function normalizeOutcomeTyped(outcome = null) {
  const source = isPlainObject(outcome) ? outcome : {};
  return normalizeTypedValue(readRuntimeFirstDefined(
    source.typed,
    source.answer,
    source.value,
    ""
  ));
}

function isTerminalOutcomeForState(state, outcome = null, correct = null) {
  if (state.phase === SUPPORT_STATE_ACCESS_ISSUE || hasAccessIssueOutcome(outcome)) return true;
  const source = isPlainObject(outcome) ? outcome : {};
  const explicit = readRuntimeFirstDefined(
    source.terminal,
    source.isTerminal,
    source.is_terminal,
    source.completed,
    source.final,
    source.isFinal,
    source.is_final
  );
  if (explicit !== undefined) return normalizeRuntimeBoolean(explicit);
  if (correct === true) return true;
  return state.phase === SUPPORT_STATE_SUPPORTED && correct === false;
}

function withPhase(state, phase, overrides = {}) {
  return normalizeSupportLadderState({
    ...state,
    ...overrides,
    phase,
  });
}

export function normalizeSupportLadderState(value = null) {
  const source = isPlainObject(value) ? value : {};
  const phase = normalizePhase(readRuntimeFirstDefined(
    source.phase,
    source.supportState,
    source.support_state
  ));
  const supportActions = normalizeStateActions(source, phase);
  const lastSubmittedIncorrectAnswer = normalizeTypedValue(readRuntimeFirstDefined(
    source.lastSubmittedIncorrectAnswer,
    source.last_submitted_incorrect_answer,
    ""
  )) || null;

  return {
    phase,
    attemptNumber: PHASE_ATTEMPT_NUMBERS[phase] || 1,
    supportActions,
    lastSubmittedIncorrectAnswer,
    clarificationShown: normalizeRuntimeBoolean(readRuntimeFirstDefined(
      source.clarificationShown,
      source.clarification_shown
    )),
  };
}

export function createInitialSupportLadderState(options = {}) {
  const source = isPlainObject(options) ? options : {};
  return normalizeSupportLadderState({
    ...source,
    phase: readRuntimeFirstDefined(source.phase, source.supportState, source.support_state, SUPPORT_STATE_INDEPENDENT),
  });
}

export function isSupportLadderDelivery(itemOrContext = null) {
  if (!isPlainObject(itemOrContext)) {
    return normalizeDeliveryModel(itemOrContext) === DELIVERY_MODEL_SUPPORT_LADDER;
  }

  const source = itemOrContext;
  const deliveryModel = readRuntimeFirstDefined(
    source.deliveryModel,
    source.delivery_model,
    source.testMeta?.deliveryModel,
    source.testMeta?.delivery_model,
    source.assignment?.deliveryModel,
    source.assignment?.delivery_model,
    source.item?.deliveryModel,
    source.item?.delivery_model
  );
  return normalizeDeliveryModel(deliveryModel) === DELIVERY_MODEL_SUPPORT_LADDER;
}

export function getSupportLadderPhase(state = null) {
  return normalizeSupportLadderState(state).phase;
}

export function recordSupportLadderAction(state = null, action = []) {
  const normalized = normalizeSupportLadderState(state);
  const nextActions = normalizeSupportActions([
    ...normalized.supportActions,
    ...normalizeSupportActions(action),
  ]);
  return normalizeSupportLadderState({
    ...normalized,
    supportActions: nextActions,
  });
}

export function recordSupportLadderClarification(state = null, options = {}) {
  const source = isPlainObject(options) ? options : {};
  const clarificationActions = [];
  const sentenceShown = normalizeRuntimeBoolean(readRuntimeFirstDefined(
    source.sentenceShown,
    source.sentence_shown
  ));
  const meaningShown = normalizeRuntimeBoolean(readRuntimeFirstDefined(
    source.meaningShown,
    source.meaning_shown
  ));

  if (sentenceShown) clarificationActions.push(SUPPORT_ACTION_CLARIFICATION_SENTENCE);
  if (meaningShown) clarificationActions.push(SUPPORT_ACTION_MEANING);

  const normalized = normalizeSupportLadderState(state);
  if (!clarificationActions.length) return normalized;

  return normalizeSupportLadderState({
    ...normalized,
    supportActions: [
      ...normalized.supportActions,
      ...clarificationActions,
    ],
    clarificationShown: true,
  });
}

export function resolveSupportLadderTerminalEvidence(state = null, outcome = {}) {
  const accessIssue = hasAccessIssueOutcome(outcome);
  const normalized = accessIssue
    ? withPhase(state, SUPPORT_STATE_ACCESS_ISSUE)
    : normalizeSupportLadderState(state);
  const correct = normalizeOutcomeCorrectness(outcome, {
    accessIssue: normalized.phase === SUPPORT_STATE_ACCESS_ISSUE,
  });
  const source = isPlainObject(outcome) ? outcome : {};

  return interpretWordEvidence({
    deliveryModel: DELIVERY_MODEL_SUPPORT_LADDER,
    supportState: normalized.phase,
    supportActions: normalized.supportActions,
    evidenceCategory: normalized.phase === SUPPORT_STATE_ACCESS_ISSUE
      ? EVIDENCE_CATEGORY_ACCESS_ISSUE
      : readRuntimeFirstDefined(source.evidenceCategory, source.evidence_category),
    correct,
    completed: true,
    terminal: true,
    attemptNumber: normalized.attemptNumber,
  });
}

export function buildSupportLadderAttemptMetadata(state = null, outcome = {}) {
  const accessIssue = hasAccessIssueOutcome(outcome);
  const normalized = accessIssue
    ? withPhase(state, SUPPORT_STATE_ACCESS_ISSUE)
    : normalizeSupportLadderState(state);
  const correct = normalizeOutcomeCorrectness(outcome, {
    accessIssue: normalized.phase === SUPPORT_STATE_ACCESS_ISSUE,
  });
  const terminal = isTerminalOutcomeForState(normalized, outcome, correct);
  const evidence = terminal ? resolveSupportLadderTerminalEvidence(normalized, outcome) : null;

  return {
    deliveryModel: DELIVERY_MODEL_SUPPORT_LADDER,
    supportState: normalized.phase,
    evidenceCategory: evidence?.category || null,
    supportActions: normalized.supportActions,
    attemptNumber: normalized.attemptNumber,
    correct,
  };
}

export function buildSupportLadderResultMetadata(state = null, outcome = {}) {
  const evidence = resolveSupportLadderTerminalEvidence(state, outcome);
  return {
    deliveryModel: DELIVERY_MODEL_SUPPORT_LADDER,
    supportState: evidence.supportState,
    evidenceCategory: evidence.category,
    supportActions: evidence.supportActions,
    attemptNumber: normalizeSupportLadderState({
      phase: evidence.supportState,
      supportActions: evidence.supportActions,
    }).attemptNumber,
    correct: evidence.rawCorrect,
  };
}

export function advanceSupportLadderAfterSubmission(state = null, submission = {}) {
  const current = normalizeSupportLadderState(state);
  const typed = normalizeOutcomeTyped(submission);
  const accessIssue = hasAccessIssueOutcome(submission) || current.phase === SUPPORT_STATE_ACCESS_ISSUE;
  const submittedState = accessIssue
    ? withPhase(current, SUPPORT_STATE_ACCESS_ISSUE)
    : current;
  const correct = normalizeOutcomeCorrectness(submission, { accessIssue });

  if (accessIssue || correct === true || submittedState.phase === SUPPORT_STATE_SUPPORTED) {
    const resultMetadata = buildSupportLadderResultMetadata(submittedState, {
      ...submission,
      correct,
      accessIssue,
      typed,
    });
    return {
      state: submittedState,
      submittedState,
      terminal: true,
      completed: true,
      correct: resultMetadata.correct,
      typed,
      evidenceCategory: resultMetadata.evidenceCategory,
      supportState: resultMetadata.supportState,
      supportActions: resultMetadata.supportActions,
      attemptMetadata: buildSupportLadderAttemptMetadata(submittedState, {
        ...submission,
        correct,
        accessIssue,
        typed,
        terminal: true,
      }),
      resultMetadata,
    };
  }

  const nextPhase = submittedState.phase === SUPPORT_STATE_INDEPENDENT
    ? SUPPORT_STATE_RETRY
    : SUPPORT_STATE_SUPPORTED;
  const nextState = withPhase(submittedState, nextPhase, {
    lastSubmittedIncorrectAnswer: typed,
  });

  return {
    state: nextState,
    submittedState,
    terminal: false,
    completed: false,
    correct: false,
    typed,
    evidenceCategory: null,
    supportState: submittedState.phase,
    supportActions: submittedState.supportActions,
    attemptMetadata: buildSupportLadderAttemptMetadata(submittedState, {
      ...submission,
      correct: false,
      typed,
      terminal: false,
    }),
    resultMetadata: null,
  };
}
