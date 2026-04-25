import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildPupilAttemptFeedbackSignals,
  buildPupilFeedbackCardModel,
} = await loadBrowserModule("../js/pupilFeedbackModel.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function attempt({
  assignmentTargetId = "",
  testWordId = "",
  word = "rain",
  correct = false,
  createdAt = "2026-04-01T09:00:00.000Z",
} = {}) {
  return {
    assignment_target_id: assignmentTargetId || null,
    test_word_id: testWordId || null,
    word_text: word,
    correct,
    created_at: createdAt,
  };
}

test("attempt signals keep recent checked words in newest-first order", () => {
  const signals = buildPupilAttemptFeedbackSignals([
    attempt({ testWordId: "w1", word: "rain", createdAt: "2026-04-01T09:00:00.000Z" }),
    attempt({ testWordId: "w2", word: "train", createdAt: "2026-04-02T09:00:00.000Z" }),
    attempt({ testWordId: "w3", word: "snail", createdAt: "2026-04-03T09:00:00.000Z" }),
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(signals.recentEffortWords)), ["snail", "train", "rain"]);
});

test("attempt signals detect words improved after another try", () => {
  const signals = buildPupilAttemptFeedbackSignals([
    attempt({ testWordId: "w1", word: "rain", correct: false, createdAt: "2026-04-01T09:00:00.000Z" }),
    attempt({ testWordId: "w1", word: "rain", correct: true, createdAt: "2026-04-02T09:00:00.000Z" }),
    attempt({ testWordId: "w2", word: "train", correct: false, createdAt: "2026-04-03T09:00:00.000Z" }),
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(signals.improvedWords)), ["rain"]);
});

test("feedback card prefers practice focus before derived progress focus", () => {
  const model = buildPupilFeedbackCardModel({
    assignments: [{ completed: false }],
    practiceModel: {
      focusGrapheme: "ai",
      packs: [],
    },
    progress: {
      wordsChecked: 4,
      attemptHistory: [
        attempt({ testWordId: "w1", word: "rain", correct: false, createdAt: "2026-04-01T09:00:00.000Z" }),
      ],
      practiseNext: [{ target: "ee" }],
    },
  });

  const nextFocus = model.items.find((item) => item.key === "next_focus");
  assert.equal(nextFocus.chips[0], "ai");
});

test("feedback card falls back to derived progress focus when practice focus is unavailable", () => {
  const model = buildPupilFeedbackCardModel({
    assignments: [{ completed: false }],
    practiceModel: {
      focusGrapheme: "",
      packs: [],
    },
    progress: {
      wordsChecked: 5,
      attemptHistory: [],
      practiseNext: [{ target: "ee" }],
    },
  });

  const nextFocus = model.items.find((item) => item.key === "next_focus");
  assert.equal(nextFocus.chips[0], "ee");
});

test("feedback card shows encouragement when evidence is still light", () => {
  const model = buildPupilFeedbackCardModel({
    assignments: [{ completed: false }],
    practiceModel: null,
    progress: {
      wordsChecked: 0,
      attemptHistory: [],
      practiseNext: [],
    },
  });

  assert.equal(model.items.length, 1);
  assert.equal(model.items[0].key, "encouragement");
  assert.match(model.items[0].text, /next checked word|progress/i);
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
  console.log(`all ${TESTS.length} pupil feedback model checks passed`);
}
