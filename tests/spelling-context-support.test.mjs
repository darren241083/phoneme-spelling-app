import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  getSpellingContextSupport,
  hasMeaningSupport,
  hasSentenceSupport,
  isForcedSentenceWord,
  normalizeContextWord,
  validateMeaningSupportText,
} = await loadBrowserModule("../js/spellingContextSupport.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

test("normalises context words for lookup", () => {
  assert.equal(normalizeContextWord("  They’re! "), "they're");
  assert.equal(normalizeContextWord("Flower."), "flower");
});

test("detects forced sentence words including curly apostrophes", () => {
  assert.equal(isForcedSentenceWord("there"), true);
  assert.equal(isForcedSentenceWord("their"), true);
  assert.equal(isForcedSentenceWord("they’re"), true);
  assert.equal(isForcedSentenceWord("two"), true);
  assert.equal(isForcedSentenceWord("flour"), true);
  assert.equal(isForcedSentenceWord("train"), false);
});

test("accepts simple pupil-friendly meanings", () => {
  const result = validateMeaningSupportText(
    "Train means a vehicle that travels on tracks and carries people or goods.",
    "train",
  );
  assert.equal(result.valid, true);
  assert.equal(result.reasons.length, 0);
});

test("rejects spelling-pattern meaning explanations", () => {
  assert.equal(validateMeaningSupportText("Train has the ai sound in the middle.", "train").valid, false);
  assert.equal(validateMeaningSupportText("Train uses a vowel digraph.", "train").valid, false);
  assert.equal(validateMeaningSupportText("Train is spelled t-r-a-i-n.", "train").valid, false);
  assert.equal(validateMeaningSupportText("Train is spelled t r a i n.", "train").valid, false);
});

test("rejects empty, long, markup, url and list-like meanings", () => {
  assert.equal(validateMeaningSupportText("", "train").valid, false);
  assert.equal(validateMeaningSupportText("Train means " + "a ".repeat(40), "train").valid, false);
  assert.equal(validateMeaningSupportText("<b>Train</b> means a vehicle.", "train").valid, false);
  assert.equal(validateMeaningSupportText("See https://example.com/train for meaning.", "train").valid, false);
  assert.equal(validateMeaningSupportText("- A vehicle that travels on tracks.", "train").valid, false);
});

test("reads missing and empty context as safe defaults", () => {
  const context = getSpellingContextSupport(null);
  assert.equal(context.sentence, "");
  assert.equal(context.meaning, "");
  assert.equal(context.sentenceStatus, "");
  assert.equal(context.meaningStatus, "");
  assert.equal(context.sentenceRequired, false);
  assert.equal(context.forcedSentence, false);
  assert.equal(context.meaningEnabled, false);
  assert.equal(hasSentenceSupport(null), false);
  assert.equal(hasMeaningSupport(null), false);
});

test("reads context from supported item shapes", () => {
  const item = {
    word: "train",
    sentence: "The train arrived at the station.",
    choice: {
      context_support: {
        meaning: "Train means a vehicle that travels on tracks.",
        meaning_status: "teacher_edited",
      },
    },
  };
  const context = getSpellingContextSupport(item);
  assert.equal(context.sentence, "The train arrived at the station.");
  assert.equal(context.meaning, "Train means a vehicle that travels on tracks.");
  assert.equal(context.meaningStatus, "teacher_edited");
  assert.equal(context.meaningEnabled, true);
  assert.equal(hasSentenceSupport(item), true);
  assert.equal(hasMeaningSupport(item), true);
});

test("blocks unavailable meaning statuses", () => {
  for (const status of ["hidden", "needs_review", "ai_generated"]) {
    assert.equal(hasMeaningSupport({
      word: "train",
      choice: {
        contextSupport: {
          meaning: "Train means a vehicle that travels on tracks.",
          meaningStatus: status,
          meaningEnabled: true,
        },
      },
    }), false);
  }
});

test("baseline-like items disable meaning support", () => {
  const item = {
    word: "train",
    sentence: "The train arrived at the station.",
    choice: {
      source: "teacher",
      baseline_v1: false,
      baseline_v2: true,
      context_support: {
        meaning: "Train means a vehicle that travels on tracks.",
        meaning_status: "teacher_edited",
        meaning_enabled: true,
      },
    },
  };
  const context = getSpellingContextSupport(item);
  assert.equal(context.baselineLike, true);
  assert.equal(context.meaningEnabled, false);
  assert.equal(context.meaning, "");
  assert.equal(hasMeaningSupport(item), false);
  assert.equal(hasSentenceSupport(item), true);
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
  console.log(`all ${TESTS.length} spelling context support checks passed`);
}
