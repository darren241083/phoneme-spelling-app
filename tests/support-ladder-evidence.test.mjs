import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadBrowserModule } from "./load-browser-module.mjs";
import * as edgeEvidence from "../supabase/functions/provision-personalised-assignment/pure/supportLadderEvidence.js";

const browserEvidence = await loadBrowserModule("../js/supportLadderEvidence.js", import.meta.url);

function ladderOutcome(overrides = {}) {
  return {
    delivery_model: "support_ladder",
    support_state: "independent",
    correct: true,
    completed: true,
    attempt_number: 1,
    support_actions: [],
    attempt_source: "teacher_assigned",
    ...overrides,
  };
}

function normalizeForAssert(value) {
  return JSON.parse(JSON.stringify(value));
}

test("first independent success is headline-correct evidence", () => {
  const result = browserEvidence.interpretWordEvidence(ladderOutcome());
  assert.equal(result.category, "correct_first_time");
  assert.equal(result.rawCorrect, true);
  assert.equal(result.headlineIncluded, true);
  assert.equal(result.headlineCorrect, true);
  assert.equal(result.independentSignal, "independent_success");
});

test("retry success is raw-correct but headline-incorrect", () => {
  const result = browserEvidence.interpretWordEvidence(ladderOutcome({
    support_state: "retry",
    attempt_number: 2,
  }));
  assert.equal(result.category, "correct_after_retry");
  assert.equal(result.rawCorrect, true);
  assert.equal(result.headlineIncluded, true);
  assert.equal(result.headlineCorrect, false);
  assert.equal(result.diagnosticSignal, "self_correction");
});

test("supported success is diagnostic rather than headline mastery", () => {
  const result = browserEvidence.interpretWordEvidence(ladderOutcome({
    support_state: "supported",
    attempt_number: 3,
    support_actions: ["segmented_input"],
  }));
  assert.equal(result.category, "correct_with_support");
  assert.equal(result.rawCorrect, true);
  assert.equal(result.headlineCorrect, false);
  assert.equal(result.diagnosticSignal, "supported_success");
});

test("supported incorrect creates clear review evidence", () => {
  const result = browserEvidence.interpretWordEvidence(ladderOutcome({
    support_state: "supported",
    attempt_number: 3,
    correct: false,
    support_actions: ["segmented_input"],
  }));
  assert.equal(result.category, "incorrect_with_support");
  assert.equal(result.rawCorrect, false);
  assert.equal(result.headlineIncluded, true);
  assert.equal(result.headlineCorrect, false);
  assert.equal(result.reviewSignal, "high");
});

test("access issue takes precedence and is excluded from spelling denominators", () => {
  const result = browserEvidence.interpretWordEvidence(ladderOutcome({
    support_state: "access_issue",
    correct: true,
    evidence_category: "correct_first_time",
  }));
  assert.equal(result.category, "access_issue");
  assert.equal(result.rawCorrect, null);
  assert.equal(result.headlineIncluded, false);
  assert.equal(result.headlineCorrect, false);
  assert.equal(result.accessFlag, true);
});

test("neutral replay and required sentence do not downgrade independent success", () => {
  for (const action of ["replay_word", "required_sentence"]) {
    const result = browserEvidence.interpretWordEvidence(ladderOutcome({
      support_actions: [action],
    }));
    assert.equal(result.category, "correct_first_time", action);
    assert.equal(result.headlineCorrect, true, action);
  }
});

test("material support downgrades otherwise independent success", () => {
  for (const action of [
    "clarification_sentence",
    "meaning",
    "segmented_input",
    "focus_sound",
  ]) {
    const result = browserEvidence.interpretWordEvidence(ladderOutcome({
      support_actions: [action],
    }));
    assert.equal(result.category, "correct_with_support", action);
    assert.equal(result.rawCorrect, true, action);
    assert.equal(result.headlineCorrect, false, action);
  }
});

test("clarification followed by a correct spelling remains supported success", () => {
  const result = browserEvidence.interpretWordEvidence(ladderOutcome({
    support_state: "retry",
    attempt_number: 2,
    support_actions: ["clarification_sentence"],
  }));
  assert.equal(result.category, "correct_with_support");
  assert.equal(result.diagnosticSignal, "supported_success");
});

test("non-terminal attempt rows are excluded from progression", () => {
  const result = browserEvidence.interpretWordEvidence(ladderOutcome({
    completed: false,
    correct: false,
  }));
  assert.equal(result.terminal, false);
  assert.equal(result.category, null);
  assert.equal(result.headlineIncluded, false);

  const summary = browserEvidence.summarizeEvidence([ladderOutcome({
    completed: false,
    correct: false,
  })]);
  assert.equal(summary.terminalOutcomes, 0);
  assert.equal(summary.rawAttempted, 0);
  assert.equal(summary.headlineAttempted, 0);
});

test("legacy outcomes preserve binary semantics without invented ladder categories", () => {
  const correct = browserEvidence.interpretWordEvidence({
    correct: true,
    completed: true,
    evidence_category: "correct_with_support",
    support_actions: ["segmented_input"],
  });
  const incorrect = browserEvidence.interpretWordEvidence({
    delivery_model: "legacy_fixed",
    correct: false,
    completed: true,
  });

  assert.equal(correct.deliveryModel, "legacy_fixed");
  assert.equal(correct.category, null);
  assert.equal(correct.headlineCorrect, true);
  assert.equal(correct.displayKey, "legacy_correct");
  assert.equal(incorrect.category, null);
  assert.equal(incorrect.headlineIncluded, true);
  assert.equal(incorrect.headlineCorrect, false);
});

test("mixed evidence summary separates raw outcomes from headline attainment", () => {
  const summary = browserEvidence.summarizeEvidence([
    ladderOutcome(),
    ladderOutcome({ support_state: "retry", attempt_number: 2 }),
    ladderOutcome({
      support_state: "supported",
      attempt_number: 3,
      support_actions: ["segmented_input"],
    }),
    ladderOutcome({
      support_state: "supported",
      attempt_number: 3,
      correct: false,
      support_actions: ["focus_sound"],
    }),
    ladderOutcome({
      support_state: "access_issue",
      correct: null,
    }),
    { delivery_model: "legacy_fixed", correct: true, completed: true },
    ladderOutcome({ completed: false, correct: false }),
  ]);

  assert.equal(summary.totalOutcomes, 7);
  assert.equal(summary.terminalOutcomes, 6);
  assert.equal(summary.rawAttempted, 5);
  assert.equal(summary.rawCorrect, 4);
  assert.equal(summary.rawScoreRate, 0.8);
  assert.equal(summary.headlineAttempted, 5);
  assert.equal(summary.headlineCorrect, 2);
  assert.equal(summary.headlineScoreRate, 0.4);
  assert.equal(summary.independentFirstCorrectCount, 1);
  assert.equal(summary.selfCorrectedCount, 1);
  assert.equal(summary.supportedCorrectCount, 1);
  assert.equal(summary.supportedIncorrectCount, 1);
  assert.equal(summary.accessIssueCount, 1);
  assert.equal(summary.uncategorizedTerminalCount, 1);
});

test("selector priority follows learning-need ordering", () => {
  const repeatedIncorrect = browserEvidence.buildSelectorEvidenceSignal(
    ladderOutcome({
      support_state: "supported",
      correct: false,
      support_actions: ["segmented_input"],
    }),
    { incorrectWithSupportCount: 2 },
  );
  const singleIncorrect = browserEvidence.buildSelectorEvidenceSignal(ladderOutcome({
    support_state: "supported",
    correct: false,
    support_actions: ["segmented_input"],
  }));
  const supportedCorrect = browserEvidence.buildSelectorEvidenceSignal(ladderOutcome({
    support_state: "supported",
    support_actions: ["segmented_input"],
  }));
  const retryCorrect = browserEvidence.buildSelectorEvidenceSignal(ladderOutcome({
    support_state: "retry",
    attempt_number: 2,
  }));
  const insufficient = browserEvidence.buildSelectorEvidenceSignal(ladderOutcome({
    completed: false,
    correct: null,
  }));
  const firstCorrect = browserEvidence.buildSelectorEvidenceSignal(ladderOutcome());

  assert.ok(repeatedIncorrect.priority > singleIncorrect.priority);
  assert.ok(singleIncorrect.priority > supportedCorrect.priority);
  assert.ok(supportedCorrect.priority > retryCorrect.priority);
  assert.ok(retryCorrect.priority > insufficient.priority);
  assert.ok(insufficient.priority > firstCorrect.priority);
  assert.equal(supportedCorrect.secureEvidence, false);
  assert.equal(firstCorrect.secureEvidence, true);
});

test("repeated supported dependence is elevated without becoming secure evidence", () => {
  const profile = browserEvidence.buildSelectorEvidenceProfile([
    ladderOutcome({
      support_state: "supported",
      support_actions: ["segmented_input"],
    }),
    ladderOutcome({
      support_state: "supported",
      support_actions: ["focus_sound"],
    }),
  ]);
  assert.equal(profile.topSignal.rationale, "repeated_supported_dependence");
  assert.equal(profile.topSignal.priority, 90);
  assert.equal(profile.topSignal.secureEvidence, false);
});

test("access issue creates clarification flag rather than spelling weakness", () => {
  const signal = browserEvidence.buildSelectorEvidenceSignal(ladderOutcome({
    support_state: "access_issue",
    correct: null,
  }));
  assert.equal(signal.accessFlag, true);
  assert.equal(signal.clarificationFlag, true);
  assert.equal(signal.spellingNeed, false);
  assert.equal(signal.rationale, "access_clarification_needed");
});

test("source policy keeps optional and baseline evidence out of core progression", () => {
  const assigned = browserEvidence.classifyEvidenceSource("teacher_assigned");
  const extra = browserEvidence.classifyEvidenceSource("extra_challenge");
  const practice = browserEvidence.classifyEvidenceSource("practice");
  const baseline = browserEvidence.classifyEvidenceSource("baseline");
  const legacy = browserEvidence.classifyEvidenceSource("");

  assert.equal(assigned.coreProgressEligible, true);
  assert.equal(extra.coreProgressEligible, false);
  assert.equal(extra.optionalPractice, true);
  assert.equal(practice.coreProgressEligible, false);
  assert.equal(baseline.coreProgressEligible, false);
  assert.equal(baseline.baselineEligible, true);
  assert.equal(legacy.kind, "legacy");
  assert.equal(legacy.coreProgressEligible, true);
});

test("support action normalization is deterministic and separates neutral from material", () => {
  const actions = browserEvidence.normalizeSupportActions([
    "focus",
    "replay_audio",
    "segmented_spelling",
    "focus_sound",
  ]);
  assert.deepEqual(normalizeForAssert(actions), [
    "replay_word",
    "segmented_input",
    "focus_sound",
  ]);
  assert.equal(browserEvidence.hasMaterialSupportActions(["replay_word"]), false);
  assert.equal(browserEvidence.hasMaterialSupportActions(["required_sentence"]), false);
  assert.equal(browserEvidence.hasMaterialSupportActions(["meaning"]), true);
});

test("browser and Edge pure helpers remain in output parity", () => {
  const cases = [
    ladderOutcome(),
    ladderOutcome({ support_state: "retry", attempt_number: 2 }),
    ladderOutcome({
      support_state: "supported",
      support_actions: ["meaning", "segmented_input"],
    }),
    ladderOutcome({
      support_state: "supported",
      correct: false,
      support_actions: ["focus_sound"],
    }),
    ladderOutcome({ support_state: "access_issue", correct: null }),
    { correct: true, completed: true },
  ];

  for (const outcome of cases) {
    assert.deepEqual(
      normalizeForAssert(browserEvidence.interpretWordEvidence(outcome)),
      normalizeForAssert(edgeEvidence.interpretWordEvidence(outcome)),
    );
  }
  assert.deepEqual(
    normalizeForAssert(browserEvidence.summarizeEvidence(cases)),
    normalizeForAssert(edgeEvidence.summarizeEvidence(cases)),
  );
  assert.deepEqual(
    normalizeForAssert(browserEvidence.buildSelectorEvidenceProfile(cases)),
    normalizeForAssert(edgeEvidence.buildSelectorEvidenceProfile(cases)),
  );
  assert.deepEqual(
    normalizeForAssert(browserEvidence.classifyEvidenceSource("extra_challenge")),
    normalizeForAssert(edgeEvidence.classifyEvidenceSource("extra_challenge")),
  );
});

test("browser and Edge helper source stays mirrored apart from line endings", () => {
  const browserPath = fileURLToPath(new URL("../js/supportLadderEvidence.js", import.meta.url));
  const edgePath = fileURLToPath(new URL(
    "../supabase/functions/provision-personalised-assignment/pure/supportLadderEvidence.js",
    import.meta.url,
  ));
  const normalizeSource = (value) => String(value || "").replace(/\r\n/g, "\n");
  assert.equal(
    normalizeSource(readFileSync(browserPath, "utf8")),
    normalizeSource(readFileSync(edgePath, "utf8")),
  );
});
