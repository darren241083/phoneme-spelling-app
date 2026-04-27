import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildPupilAttemptFeedbackSignals,
  buildPupilFeedbackCardModel,
  buildPupilProgressCardModel,
  buildPupilSpellingBeeSummaryModel,
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
  attemptedWordCount = 0,
  spellingBeeResult = null,
  spellingBeeEventClosed = false,
  spellingBeeRank = null,
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
    attemptedWordCount,
    spellingBeeResult,
    spellingBeeEventClosed,
    spellingBeeRank,
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
  assert.equal(nextFocus.text, "Practise words with 'ai' next.");
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
  assert.equal(model.blocks.find((item) => item.key === "next_focus")?.text, "Keep practising a mix of words to build confidence.");
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

test("spelling bee summary returns null when there is no completed Bee result", () => {
  const model = buildPupilSpellingBeeSummaryModel([
    assignment({
      id: "bee-1",
      isSpellingBee: true,
      completed: false,
      spellingBeeResult: { rounds_attempted: 3 },
    }),
  ]);

  assert.equal(model, null);
});

test("spelling bee summary uses the newest completed Bee as the latest result", () => {
  const model = buildPupilSpellingBeeSummaryModel([
    assignment({
      id: "bee-1",
      isSpellingBee: true,
      completedAt: "2026-04-02T09:00:00.000Z",
      attemptedWordCount: 4,
    }),
    assignment({
      id: "bee-2",
      isSpellingBee: true,
      completedAt: "2026-04-05T09:00:00.000Z",
      attemptedWordCount: 6,
    }),
  ]);

  assert.equal(model.latestText, "Latest Bee: You reached round 6.");
});

test("spelling bee summary uses the highest round as the best result", () => {
  const model = buildPupilSpellingBeeSummaryModel([
    assignment({
      id: "bee-1",
      isSpellingBee: true,
      completedAt: "2026-04-05T09:00:00.000Z",
      attemptedWordCount: 4,
    }),
    assignment({
      id: "bee-2",
      isSpellingBee: true,
      completedAt: "2026-04-03T09:00:00.000Z",
      spellingBeeResult: { rounds_attempted: 7 },
    }),
  ]);

  assert.equal(model.bestText, "Best result: Round 7.");
});

test("spelling bee summary hides rank when the event is not closed", () => {
  const model = buildPupilSpellingBeeSummaryModel([
    assignment({
      id: "bee-1",
      isSpellingBee: true,
      completedAt: "2026-04-05T09:00:00.000Z",
      attemptedWordCount: 5,
      spellingBeeEventClosed: false,
      spellingBeeRank: 3,
    }),
  ]);

  assert.equal(model.rankText, "");
});

test("spelling bee summary shows rank only when the event is closed and rank data exists", () => {
  const model = buildPupilSpellingBeeSummaryModel([
    assignment({
      id: "bee-1",
      isSpellingBee: true,
      completedAt: "2026-04-05T09:00:00.000Z",
      attemptedWordCount: 5,
      spellingBeeEventClosed: true,
      spellingBeeRank: 3,
    }),
  ]);

  assert.equal(model.rankText, "Your rank: #3");
});

test("spelling bee summary ignores normal non-Bee assignments", () => {
  const model = buildPupilSpellingBeeSummaryModel([
    assignment({
      id: "task-1",
      title: "Friday task",
      completedAt: "2026-04-06T09:00:00.000Z",
      attemptedWordCount: 9,
    }),
    assignment({
      id: "bee-1",
      isSpellingBee: true,
      completedAt: "2026-04-05T09:00:00.000Z",
      attemptedWordCount: 5,
    }),
  ]);

  assert.equal(model.latestText, "Latest Bee: You reached round 5.");
  assert.equal(model.bestText, "Best result: Round 5.");
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
