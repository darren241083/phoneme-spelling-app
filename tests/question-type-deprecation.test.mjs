import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  DEFAULT_QUESTION_TYPE,
  getLaunchQuestionTypeOptions,
  getQuestionTypeDisplayLabel,
  isLaunchVisibleQuestionType,
  normalizeLaunchQuestionType,
  normalizeStoredQuestionType,
} = await loadBrowserModule("../js/questionTypes.js", import.meta.url);

const {
  buildGeneratedAssignmentPlan,
} = await loadBrowserModule("../js/assignmentEngine.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function wordRow({
  id,
  word,
  focus,
  segments,
  score = 30,
  sentence = "",
} = {}) {
  return {
    id,
    word,
    sentence,
    segments,
    choice: {
      source: "teacher",
      focus_graphemes: [focus],
      difficulty: {
        coreScore: score,
        score,
      },
    },
  };
}

test("launch-visible question types exclude deprecated Arrange", () => {
  assert.equal(JSON.stringify(getLaunchQuestionTypeOptions().map((option) => option.value)), JSON.stringify([
    "focus_sound",
    "segmented_spelling",
    "no_support_assessment",
  ]));
  assert.equal(isLaunchVisibleQuestionType("type_what_you_hear"), false);
  assert.equal(isLaunchVisibleQuestionType("focus_sound"), true);
});

test("deprecated demo question type falls back to launch default", () => {
  assert.equal(normalizeLaunchQuestionType("type_what_you_hear"), DEFAULT_QUESTION_TYPE);
  assert.equal(normalizeLaunchQuestionType("spell_loom"), DEFAULT_QUESTION_TYPE);
  assert.equal(normalizeLaunchQuestionType("segmented_spelling"), "segmented_spelling");
});

test("legacy Arrange normalization and display label remain available", () => {
  assert.equal(normalizeStoredQuestionType("type_what_you_hear"), "type_what_you_hear");
  assert.equal(normalizeStoredQuestionType("supported_typing"), "type_what_you_hear");
  assert.equal(getQuestionTypeDisplayLabel("type_what_you_hear"), "Arrange what you hear");
});

test("generated personalised support uses segmented spelling, not deprecated Arrange", () => {
  const plan = buildGeneratedAssignmentPlan({
    pupilIds: ["pupil-1"],
    teacherTests: [{
      test_words: [
        wordRow({ id: "review-ai-1", word: "rain", focus: "ai", segments: ["r", "ai", "n"], score: 24 }),
        wordRow({ id: "review-ai-2", word: "train", focus: "ai", segments: ["t", "r", "ai", "n"], score: 25 }),
        wordRow({ id: "review-ai-3", word: "paint", focus: "ai", segments: ["p", "ai", "n", "t"], score: 26 }),
        wordRow({ id: "review-ai-4", word: "snail", focus: "ai", segments: ["s", "n", "ai", "l"], score: 27 }),
        wordRow({ id: "target-ph-1", word: "phone", focus: "ph", segments: ["ph", "o", "n", "e"], score: 30 }),
        wordRow({ id: "target-ph-2", word: "photo", focus: "ph", segments: ["ph", "o", "t", "o"], score: 31 }),
        wordRow({ id: "target-ph-3", word: "phase", focus: "ph", segments: ["ph", "a", "s", "e"], score: 32 }),
        wordRow({ id: "target-ph-4", word: "graph", focus: "ph", segments: ["g", "r", "a", "ph"], score: 33 }),
        wordRow({ id: "stretch-or-1", word: "storm", focus: "or", segments: ["s", "t", "or", "m"], score: 36 }),
        wordRow({ id: "stretch-or-2", word: "short", focus: "or", segments: ["sh", "or", "t"], score: 38 }),
      ],
    }],
    attempts: [],
    totalWords: 10,
    currentProfiles: {
      "pupil-1": {
        concernRows: [{ target: "ph", total: 4, repeatedFailure: true }],
        secureRows: [{ target: "ai" }],
        developingRows: [{ target: "or" }],
        confusionByTarget: new Map(),
        placementMeta: { targetChallengeLevel: "needs_support" },
      },
    },
  });

  assert.equal(plan.error, "");
  const words = plan.pupilPlans[0]?.words || [];
  assert.equal(words.some((item) => item.assignmentSupport === "supported"), true);
  assert.equal(words.some((item) => item.questionType === "type_what_you_hear"), false);
  assert.equal(words.some((item) => item.assignmentSupport === "supported" && item.questionType === "segmented_spelling"), true);
});

test("legacy Arrange runtime branch remains present", () => {
  const gamePath = fileURLToPath(new URL("../js/game.js", import.meta.url));
  const source = readFileSync(gamePath, "utf8");
  assert.match(source, /type_what_you_hear/);
  assert.match(source, /renderSupportedArrangement/);
});

let failureCount = 0;

for (const entry of TESTS) {
  try {
    await entry.fn();
    console.log(`ok - ${entry.name}`);
  } catch (error) {
    failureCount += 1;
    console.error(`not ok - ${entry.name}`);
    console.error(error);
  }
}

if (failureCount > 0) {
  process.exitCode = 1;
} else {
  console.log(`all ${TESTS.length} question type deprecation checks passed`);
}
