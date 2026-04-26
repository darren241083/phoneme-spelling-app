import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildPupilAttemptFeedbackSignals,
  buildPupilFeedbackCardModel,
  buildPupilProgressCardModel,
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
  attemptSource = "teacher_assigned",
} = {}) {
  return {
    assignment_target_id: assignmentTargetId || null,
    test_word_id: testWordId || null,
    word_text: word,
    correct,
    created_at: createdAt,
    attempt_source: attemptSource,
  };
}

function assignment({
  id = "",
  title = "Week 1",
  completed = true,
  completedAt = "2026-04-04T09:00:00.000Z",
  correctWordCount = 8,
  totalWordCount = 10,
  scoreRate = 0,
  isBaseline = false,
  isSpellingBee = false,
  attemptSource = "teacher_assigned",
} = {}) {
  return {
    id,
    title,
    pupilTitle: title,
    completed,
    completedAt,
    correctWordCount,
    totalWordCount,
    scoreRate,
    isBaseline,
    isSpellingBee,
    attempt_source: attemptSource,
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

test("progress card builds a latest result sentence from a completed normal assignment", () => {
  const model = buildPupilProgressCardModel({
    assignments: [
      assignment({
        id: "a1",
        title: "Friday task",
        correctWordCount: 8,
        totalWordCount: 10,
        completedAt: "2026-04-04T09:00:00.000Z",
      }),
    ],
    practiceModel: null,
    progress: {
      attemptHistory: [],
      practiseNext: [],
    },
  });

  const latestResult = model.blocks.find((item) => item.key === "latest_result");
  assert.equal(latestResult.text, "You spelled 8 out of 10 words correctly in your latest task.");
});

test("progress card excludes baseline assignments from recent results", () => {
  const model = buildPupilProgressCardModel({
    assignments: [
      assignment({
        id: "baseline-1",
        title: "Baseline Test",
        isBaseline: true,
        completedAt: "2026-04-05T09:00:00.000Z",
      }),
      assignment({
        id: "task-1",
        title: "Thursday task",
        completedAt: "2026-04-04T09:00:00.000Z",
      }),
    ],
    practiceModel: null,
    progress: {
      attemptHistory: [],
      practiseNext: [],
    },
  });

  assert.deepEqual(model.recentResults.map((item) => item.title), ["Thursday task"]);
});

test("progress card excludes Spelling Bee rows from recent results", () => {
  const model = buildPupilProgressCardModel({
    assignments: [
      assignment({
        id: "bee-1",
        title: "Spring Spelling Bee",
        isSpellingBee: true,
        completedAt: "2026-04-05T09:00:00.000Z",
      }),
      assignment({
        id: "task-1",
        title: "Friday task",
        completedAt: "2026-04-04T09:00:00.000Z",
      }),
    ],
    practiceModel: null,
    progress: {
      attemptHistory: [],
      practiseNext: [],
    },
  });

  assert.deepEqual(model.recentResults.map((item) => item.title), ["Friday task"]);
});

test("progress card excludes practice assignment rows from recent results", () => {
  const model = buildPupilProgressCardModel({
    assignments: [
      assignment({
        id: "practice-1",
        title: "igh practice",
        attemptSource: "practice",
        completedAt: "2026-04-05T09:00:00.000Z",
      }),
      assignment({
        id: "task-1",
        title: "Friday task",
        completedAt: "2026-04-04T09:00:00.000Z",
      }),
    ],
    practiceModel: null,
    progress: {
      attemptHistory: [],
      practiseNext: [],
    },
  });

  assert.deepEqual(model.recentResults.map((item) => item.title), ["Friday task"]);
});

test("progress card improved-word count excludes baseline attempts", () => {
  const model = buildPupilProgressCardModel({
    assignments: [],
    practiceModel: null,
    progress: {
      attemptHistory: [
        attempt({
          testWordId: "w1",
          word: "rain",
          correct: false,
          createdAt: "2026-04-01T09:00:00.000Z",
          attemptSource: "baseline",
        }),
        attempt({
          testWordId: "w1",
          word: "rain",
          correct: true,
          createdAt: "2026-04-02T09:00:00.000Z",
          attemptSource: "teacher_assigned",
        }),
      ],
      practiseNext: [],
    },
  });

  const gettingStronger = model.blocks.find((item) => item.key === "getting_stronger");
  assert.equal(gettingStronger, undefined);
});

test("progress card next focus prefers practice focus over progress focus", () => {
  const model = buildPupilProgressCardModel({
    assignments: [],
    practiceModel: {
      focusGrapheme: "ai",
      packs: [],
    },
    progress: {
      attemptHistory: [],
      practiseNext: [{ target: "ee" }],
    },
  });

  const nextFocus = model.blocks.find((item) => item.key === "next_focus");
  assert.equal(nextFocus.text, "Next focus: practise words with 'ai'.");
  assert.deepEqual(JSON.parse(JSON.stringify(nextFocus.chips)), ["ai"]);
});

test("progress card shows a positive fallback when there is not enough data", () => {
  const model = buildPupilProgressCardModel({
    assignments: [],
    practiceModel: null,
    progress: {
      attemptHistory: [],
      practiseNext: [],
    },
  });

  assert.equal(model.state, "empty");
  assert.equal(model.intro, "Complete a few activities and your progress will appear here.");
  assert.equal(model.blocks.find((item) => item.key === "next_focus")?.text, "Next focus: practise a mixed set of words.");
});

test("progress card recent results sort newest first and limit to 3", () => {
  const model = buildPupilProgressCardModel({
    assignments: [
      assignment({ id: "task-1", title: "Task 1", completedAt: "2026-04-01T09:00:00.000Z" }),
      assignment({ id: "task-2", title: "Task 2", completedAt: "2026-04-04T09:00:00.000Z" }),
      assignment({ id: "task-3", title: "Task 3", completedAt: "2026-04-03T09:00:00.000Z" }),
      assignment({ id: "task-4", title: "Task 4", completedAt: "2026-04-02T09:00:00.000Z" }),
    ],
    practiceModel: null,
    progress: {
      attemptHistory: [],
      practiseNext: [],
    },
  });

  assert.deepEqual(model.recentResults.map((item) => item.title), ["Task 2", "Task 3", "Task 4"]);
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
