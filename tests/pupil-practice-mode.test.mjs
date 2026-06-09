import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  PRACTICE_STATUS_NOT_ENOUGH_EVIDENCE,
  PRACTICE_STATUS_NOT_ENOUGH_WORDS,
  PRACTICE_STATUS_READY,
  buildPupilPracticePlan,
  getApprovedPracticeWordsForGrapheme,
  isEligiblePracticeEvidenceAttempt,
  selectPracticeGraphemeFromAttempt,
  selectTopPracticeGrapheme,
} = await loadBrowserModule("../js/pupilPractice.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function attempt({
  id = "",
  focus = "",
  targets = [],
  source = "teacher_assigned",
  correct = false,
  typed = "wrong",
  mode = "focus_sound",
  word = "paint",
  created = "2026-04-01T09:00:00.000Z",
} = {}) {
  return {
    id,
    focus_grapheme: focus,
    target_graphemes: targets,
    attempt_source: source,
    correct,
    typed,
    mode,
    word_text: word,
    test_word_id: `${word}-id`,
    created_at: created,
  };
}

function wordRow({
  id,
  word,
  focus = "ai",
  source = "teacher",
  testId = "test-1",
} = {}) {
  return {
    id,
    test_id: testId,
    word,
    sentence: null,
    segments: [word],
    choice: {
      source,
      focus_graphemes: [focus],
    },
  };
}

function normalizeForAssert(value) {
  return JSON.parse(JSON.stringify(value));
}

test("practice evidence is real spelling evidence only", () => {
  assert.equal(isEligiblePracticeEvidenceAttempt(attempt({ id: "good", focus: "ai" })), true);
  assert.equal(isEligiblePracticeEvidenceAttempt(attempt({ id: "correct", focus: "ai", correct: true })), false);
  assert.equal(isEligiblePracticeEvidenceAttempt(attempt({ id: "practice", focus: "ai", source: "practice" })), false);
  assert.equal(isEligiblePracticeEvidenceAttempt(attempt({ id: "baseline", focus: "ai", source: "baseline" })), false);
  assert.equal(isEligiblePracticeEvidenceAttempt(attempt({ id: "extra", focus: "ai", source: "extra_challenge" })), false);
  assert.equal(isEligiblePracticeEvidenceAttempt(attempt({ id: "blank", focus: "ai", typed: "" })), false);
  assert.equal(isEligiblePracticeEvidenceAttempt(attempt({ id: "legacy", focus: "ai", mode: "" })), false);
  assert.equal(isEligiblePracticeEvidenceAttempt(attempt({ id: "supported", focus: "ai", mode: "type_what_you_hear" })), false);
  assert.equal(isEligiblePracticeEvidenceAttempt(attempt({ id: "mode-practice", focus: "ai", mode: "practice", source: "teacher_assigned" })), false);
  assert.equal(isEligiblePracticeEvidenceAttempt(attempt({ id: "no-grapheme" })), false);
});

test("target grapheme fallback uses existing grapheme-aware choice deterministically", () => {
  assert.equal(selectPracticeGraphemeFromAttempt(attempt({ targets: ["p", "ai", "n", "t"] })), "ai");
  assert.equal(selectPracticeGraphemeFromAttempt(attempt({ focus: "ee", targets: ["ai"] })), "ee");
});

test("top weak grapheme uses count, recency, then alphabetical tie-break", () => {
  const topByCount = selectTopPracticeGrapheme([
    attempt({ id: "1", focus: "ai", created: "2026-04-01T09:00:00.000Z" }),
    attempt({ id: "2", focus: "ai", created: "2026-04-02T09:00:00.000Z" }),
    attempt({ id: "3", focus: "ai", created: "2026-04-03T09:00:00.000Z" }),
    attempt({ id: "4", focus: "ee", created: "2026-04-04T09:00:00.000Z" }),
    attempt({ id: "5", focus: "ee", created: "2026-04-05T09:00:00.000Z" }),
  ]);
  assert.equal(topByCount.target, "ai");

  const topByRecency = selectTopPracticeGrapheme([
    attempt({ id: "1", focus: "ai", created: "2026-04-01T09:00:00.000Z" }),
    attempt({ id: "2", focus: "ai", created: "2026-04-02T09:00:00.000Z" }),
    attempt({ id: "3", focus: "ee", created: "2026-04-01T09:00:00.000Z" }),
    attempt({ id: "4", focus: "ee", created: "2026-04-03T09:00:00.000Z" }),
  ]);
  assert.equal(topByRecency.target, "ee");

  const topByName = selectTopPracticeGrapheme([
    attempt({ id: "1", focus: "ee", created: "2026-04-01T09:00:00.000Z" }),
    attempt({ id: "2", focus: "ee", created: "2026-04-02T09:00:00.000Z" }),
    attempt({ id: "3", focus: "ai", created: "2026-04-01T09:00:00.000Z" }),
    attempt({ id: "4", focus: "ai", created: "2026-04-02T09:00:00.000Z" }),
  ]);
  assert.equal(topByName.target, "ai");
});

test("approved practice words require exact five approved word-bank matches", () => {
  const words = [
    wordRow({ id: "w5", word: "rain" }),
    wordRow({ id: "w1", word: "paint" }),
    wordRow({ id: "w2", word: "train" }),
    wordRow({ id: "w3", word: "snail" }),
    wordRow({ id: "w4", word: "chain" }),
    wordRow({ id: "dup", word: "paint" }),
    wordRow({ id: "wrong-focus", word: "seed", focus: "ee" }),
    wordRow({ id: "generated", word: "plain", source: "analytics_target" }),
  ];
  const selected = getApprovedPracticeWordsForGrapheme(words, "ai");
  assert.equal(selected.length, 5);
  assert.deepEqual(normalizeForAssert(selected.map((row) => row.word)), ["chain", "paint", "rain", "snail", "train"]);
});

test("practice plan returns empty states for insufficient evidence or words", () => {
  assert.equal(buildPupilPracticePlan({
    attempts: [attempt({ focus: "ai" })],
    approvedWordRows: [],
  }).status, PRACTICE_STATUS_NOT_ENOUGH_EVIDENCE);

  assert.equal(buildPupilPracticePlan({
    attempts: [
      attempt({ id: "1", focus: "ai" }),
      attempt({ id: "2", focus: "ai" }),
    ],
    approvedWordRows: [
      wordRow({ id: "w1", word: "paint" }),
      wordRow({ id: "w2", word: "train" }),
      wordRow({ id: "w3", word: "snail" }),
      wordRow({ id: "w4", word: "chain" }),
    ],
  }).status, PRACTICE_STATUS_NOT_ENOUGH_WORDS);
});

test("practice plan is ready only for two misses and five approved words", () => {
  const plan = buildPupilPracticePlan({
    attempts: [
      attempt({ id: "1", focus: "ai" }),
      attempt({ id: "2", focus: "ai" }),
      attempt({ id: "practice", focus: "ee", source: "practice" }),
      attempt({ id: "baseline", focus: "ee", source: "baseline" }),
    ],
    approvedWordRows: [
      wordRow({ id: "w1", word: "paint" }),
      wordRow({ id: "w2", word: "train" }),
      wordRow({ id: "w3", word: "snail" }),
      wordRow({ id: "w4", word: "chain" }),
      wordRow({ id: "w5", word: "rain" }),
    ],
  });

  assert.equal(plan.status, PRACTICE_STATUS_READY);
  assert.equal(plan.focusGrapheme, "ai");
  assert.equal(plan.words.length, 5);
});

let failures = 0;
for (const { name, fn } of TESTS) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures) {
  process.exitCode = 1;
} else {
  console.log(`all ${TESTS.length} pupil practice checks passed`);
}
