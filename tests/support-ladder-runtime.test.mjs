import assert from "node:assert/strict";
import test from "node:test";

import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  advanceSupportLadderAfterSubmission,
  buildSupportLadderResultMetadata,
  createInitialSupportLadderState,
  getSupportLadderPhase,
  isSupportLadderDelivery,
  normalizeSupportLadderState,
  recordSupportLadderAction,
  resolveSupportLadderTerminalEvidence,
} = await loadBrowserModule("../js/supportLadderRuntime.js", import.meta.url);

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("initial state is independent and serializable", () => {
  const state = createInitialSupportLadderState();

  assert.deepEqual(plain(state), {
    phase: "independent",
    attemptNumber: 1,
    supportActions: [],
    lastSubmittedIncorrectAnswer: null,
    clarificationShown: false,
  });
  assert.equal(getSupportLadderPhase(null), "independent");
  assert.deepEqual(JSON.parse(JSON.stringify(state)), plain(state));
});

test("first attempt correct resolves to correct_first_time", () => {
  const result = advanceSupportLadderAfterSubmission(createInitialSupportLadderState(), {
    correct: true,
    typed: "phase",
  });

  assert.equal(result.terminal, true);
  assert.equal(result.completed, true);
  assert.equal(result.correct, true);
  assert.equal(result.evidenceCategory, "correct_first_time");
  assert.equal(result.supportState, "independent");
  assert.equal(result.attemptMetadata.evidenceCategory, "correct_first_time");
  assert.equal(result.resultMetadata.evidenceCategory, "correct_first_time");
});

test("first incorrect attempt advances to retry without terminal evidence", () => {
  const result = advanceSupportLadderAfterSubmission(createInitialSupportLadderState(), {
    correct: false,
    typed: "faze",
  });

  assert.equal(result.terminal, false);
  assert.equal(result.completed, false);
  assert.equal(result.correct, false);
  assert.equal(result.evidenceCategory, null);
  assert.equal(result.submittedState.phase, "independent");
  assert.equal(result.attemptMetadata.supportState, "independent");
  assert.equal(result.attemptMetadata.evidenceCategory, null);
  assert.equal(result.state.phase, "retry");
  assert.equal(result.state.attemptNumber, 2);
  assert.equal(result.state.lastSubmittedIncorrectAnswer, "faze");
});

test("retry correct resolves to correct_after_retry", () => {
  const retryState = advanceSupportLadderAfterSubmission(createInitialSupportLadderState(), {
    correct: false,
    typed: "faze",
  }).state;
  const result = advanceSupportLadderAfterSubmission(retryState, {
    correct: true,
    typed: "phase",
  });

  assert.equal(result.terminal, true);
  assert.equal(result.correct, true);
  assert.equal(result.evidenceCategory, "correct_after_retry");
  assert.equal(result.supportState, "retry");
  assert.equal(result.resultMetadata.evidenceCategory, "correct_after_retry");
});

test("retry incorrect advances to supported and records segmented input", () => {
  const retryState = normalizeSupportLadderState({ phase: "retry" });
  const result = advanceSupportLadderAfterSubmission(retryState, {
    correct: false,
    typed: "fayse",
  });

  assert.equal(result.terminal, false);
  assert.equal(result.submittedState.phase, "retry");
  assert.equal(result.attemptMetadata.supportState, "retry");
  assert.equal(result.state.phase, "supported");
  assert.equal(result.state.attemptNumber, 3);
  assert.deepEqual(plain(result.state.supportActions), ["segmented_input"]);
  assert.equal(result.state.lastSubmittedIncorrectAnswer, "fayse");
});

test("supported phase always includes segmented_input", () => {
  const supported = normalizeSupportLadderState({ phase: "supported" });

  assert.equal(supported.phase, "supported");
  assert.deepEqual(plain(supported.supportActions), ["segmented_input"]);
});

test("supported correct resolves to correct_with_support", () => {
  const supported = normalizeSupportLadderState({ phase: "supported" });
  const result = advanceSupportLadderAfterSubmission(supported, {
    correct: true,
    typed: "phase",
  });

  assert.equal(result.terminal, true);
  assert.equal(result.correct, true);
  assert.equal(result.evidenceCategory, "correct_with_support");
  assert.deepEqual(plain(result.supportActions), ["segmented_input"]);
});

test("supported incorrect resolves to incorrect_with_support", () => {
  const supported = normalizeSupportLadderState({ phase: "supported" });
  const result = advanceSupportLadderAfterSubmission(supported, {
    correct: false,
    typed: "faze",
  });

  assert.equal(result.terminal, true);
  assert.equal(result.correct, false);
  assert.equal(result.evidenceCategory, "incorrect_with_support");
  assert.deepEqual(plain(result.resultMetadata.supportActions), ["segmented_input"]);
});

test("access issue resolves to access_issue with null correctness and empty typed allowed", () => {
  const result = advanceSupportLadderAfterSubmission(createInitialSupportLadderState(), {
    accessIssue: true,
    correct: true,
    typed: "",
  });

  assert.equal(result.terminal, true);
  assert.equal(result.completed, true);
  assert.equal(result.typed, "");
  assert.equal(result.correct, null);
  assert.equal(result.evidenceCategory, "access_issue");
  assert.equal(result.supportState, "access_issue");
  assert.equal(result.attemptMetadata.correct, null);
  assert.equal(result.resultMetadata.correct, null);
});

test("replay and required sentence do not downgrade independent success", () => {
  for (const action of ["listen_again", "required_context_sentence"]) {
    const state = recordSupportLadderAction(createInitialSupportLadderState(), action);
    const evidence = resolveSupportLadderTerminalEvidence(state, { correct: true });

    assert.equal(evidence.category, "correct_first_time", action);
    assert.equal(evidence.rawCorrect, true, action);
    assert.equal(evidence.headlineCorrect, true, action);
  }
});

test("material support prevents independent-success classification", () => {
  for (const action of ["segmented_spelling", "focus", "definition", "context_sentence"]) {
    const state = recordSupportLadderAction(createInitialSupportLadderState(), action);
    const metadata = buildSupportLadderResultMetadata(state, { correct: true });

    assert.equal(metadata.evidenceCategory, "correct_with_support", action);
    assert.equal(metadata.correct, true, action);
  }
});

test("support actions dedupe and normalize consistently", () => {
  const state = normalizeSupportLadderState({
    phase: "supported",
    supportActions: [
      "focus",
      "listen_again",
      "segmented",
      "focus_sound",
      "bad_action",
      "required_context_sentence",
    ],
  });

  assert.deepEqual(plain(state.supportActions), [
    "replay_word",
    "required_sentence",
    "segmented_input",
    "focus_sound",
  ]);
});

test("legacy and missing delivery metadata do not enter ladder flow", () => {
  assert.equal(isSupportLadderDelivery(null), false);
  assert.equal(isSupportLadderDelivery({}), false);
  assert.equal(isSupportLadderDelivery({ delivery_model: "legacy_fixed" }), false);
  assert.equal(isSupportLadderDelivery({ deliveryModel: "support_ladder" }), true);
  assert.equal(isSupportLadderDelivery({ testMeta: { delivery_model: "support_ladder" } }), true);
  assert.equal(isSupportLadderDelivery("support_ladder"), true);
});

test("malformed saved state normalizes safely", () => {
  const state = normalizeSupportLadderState({
    phase: "not-a-phase",
    attemptNumber: -10,
    supportActions: "listen_again,focus,bad_action",
    lastSubmittedIncorrectAnswer: 123,
    clarificationShown: "yes",
  });

  assert.equal(state.phase, "independent");
  assert.equal(state.attemptNumber, 1);
  assert.deepEqual(plain(state.supportActions), ["replay_word", "focus_sound"]);
  assert.equal(state.lastSubmittedIncorrectAnswer, "123");
  assert.equal(state.clarificationShown, true);
});

test("state round-trips through JSON without changing meaning", () => {
  const state = recordSupportLadderAction(
    normalizeSupportLadderState({
      phase: "supported",
      lastSubmittedIncorrectAnswer: "faze",
      clarificationShown: true,
    }),
    "focus_sound"
  );
  const roundTrip = JSON.parse(JSON.stringify(state));

  assert.deepEqual(plain(normalizeSupportLadderState(roundTrip)), plain(state));
});
