import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildSpellingBeeApprovedBank,
  buildSpellingBeeExposurePlan,
  buildSpellingBeeLadder,
  calculateSpellingBeeTimeLimitMs,
  getSpellingBeeTargetDifficulty,
  SPELLING_BEE_DUPLICATE_PUPIL_SKIP_REASON,
  SPELLING_BEE_UNTIL_WRONG_SAFETY_ROUNDS,
} = await loadBrowserModule("../js/spellingBeePolicy.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function wordRow({
  id,
  word,
  score,
  source = "teacher",
  segments = null,
} = {}) {
  return {
    id,
    word,
    sentence: `${word}.`,
    segments: segments || String(word || "").split(""),
    choice: {
      source,
      difficulty: {
        coreScore: score,
        score,
      },
    },
  };
}

function bank(count = 12) {
  return Array.from({ length: count }, (_item, index) => wordRow({
    id: `w${index + 1}`,
    word: `word${index + 1}`,
    score: 12 + (index * 8),
    segments: ["w", "or", "d", String(index + 1)],
  }));
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("approved bank excludes non-teacher/generated/baseline words", () => {
  const result = buildSpellingBeeApprovedBank([
    wordRow({ id: "1", word: "teacher", score: 20, source: "teacher" }),
    wordRow({ id: "2", word: "generated", score: 20, source: "assignment_engine_pool" }),
    wordRow({ id: "3", word: "baseline", score: 20, source: "baseline_v2" }),
    wordRow({ id: "4", word: "bee-copy", score: 20, source: "spelling_bee" }),
  ]);

  assert.deepEqual(result.map((row) => row.word), ["teacher"]);
});

test("same seed produces the same ladder", () => {
  const rows = bank(14);
  const a = buildSpellingBeeLadder({ wordRows: rows, maxRounds: 8, seed: "run-1" });
  const b = buildSpellingBeeLadder({ wordRows: rows, maxRounds: 8, seed: "run-1" });

  assert.equal(a.status, "ready");
  assert.deepEqual(a.words.map((row) => row.id), b.words.map((row) => row.id));
});

test("one event ladder can be reused for every pupil", () => {
  const rows = bank(14);
  const eventLadder = buildSpellingBeeLadder({ wordRows: rows, maxRounds: 6, seed: "shared-run" });
  const pupilA = eventLadder.words.map((row) => row.word);
  const pupilB = eventLadder.words.map((row) => row.word);

  assert.deepEqual(pupilA, pupilB);
});

test("until-wrong mode builds the same shared ladder beyond the capped limit", () => {
  const rows = bank(70);
  const eventLadder = buildSpellingBeeLadder({
    wordRows: rows,
    maxRounds: 6,
    lengthMode: "until_wrong",
    seed: "shared-until-wrong-run",
  });
  const pupilA = eventLadder.words.map((row) => row.word);
  const pupilB = eventLadder.words.map((row) => row.word);

  assert.equal(eventLadder.status, "ready");
  assert.equal(eventLadder.required, SPELLING_BEE_UNTIL_WRONG_SAFETY_ROUNDS);
  assert.ok(eventLadder.words.length > 20);
  assert.deepEqual(pupilA, pupilB);
});

test("insufficient approved words fails without fallback", () => {
  const result = buildSpellingBeeLadder({
    wordRows: [wordRow({ id: "1", word: "only", score: 20 })],
    maxRounds: 4,
    seed: "run-2",
  });

  assert.equal(result.status, "not_enough_approved_words");
  assert.equal(result.words.length, 0);
});

test("until-wrong mode fails cleanly when approved coverage is insufficient", () => {
  const result = buildSpellingBeeLadder({
    wordRows: bank(30),
    lengthMode: "until_wrong",
    seed: "thin-until-wrong-run",
  });

  assert.equal(result.status, "not_enough_approved_words");
  assert.equal(result.required, SPELLING_BEE_UNTIL_WRONG_SAFETY_ROUNDS);
  assert.equal(result.words.length, 0);
});

test("insufficient challenge coverage fails before release", () => {
  const result = buildSpellingBeeLadder({
    wordRows: [
      wordRow({ id: "1", word: "one", score: 16 }),
      wordRow({ id: "2", word: "two", score: 20 }),
      wordRow({ id: "3", word: "three", score: 24 }),
      wordRow({ id: "4", word: "four", score: 28 }),
      wordRow({ id: "5", word: "five", score: 32 }),
      wordRow({ id: "6", word: "six", score: 36 }),
    ],
    maxRounds: 6,
    seed: "weak-run",
  });

  assert.equal(result.status, "not_enough_approved_words");
  assert.equal(result.words.length, 0);
});

test("difficulty ramps quickly after round 2", () => {
  assert.equal(getSpellingBeeTargetDifficulty(0), 24);
  assert.equal(getSpellingBeeTargetDifficulty(1), 34);
  assert.ok(getSpellingBeeTargetDifficulty(2) >= 50);

  const result = buildSpellingBeeLadder({ wordRows: bank(16), maxRounds: 8, seed: "ramp-run" });
  assert.equal(result.status, "ready");
  const scores = result.words.map((row) => row.beeDifficultyScore);
  assert.ok(scores[2] >= scores[1]);
  assert.ok(scores.slice(2).some((score) => score >= 50));
});

test("timer formula clamps at min and max", () => {
  assert.equal(calculateSpellingBeeTimeLimitMs(wordRow({
    id: "short",
    word: "at",
    score: 10,
    segments: ["a", "t"],
  })), 4500);

  assert.equal(calculateSpellingBeeTimeLimitMs(wordRow({
    id: "mid",
    word: "garden",
    score: 40,
    segments: ["g", "ar", "d", "e", "n"],
  })), 6450);

  assert.equal(calculateSpellingBeeTimeLimitMs(wordRow({
    id: "long",
    word: "extraordinary",
    score: 80,
    segments: Array.from({ length: 20 }, (_item, index) => String(index)),
  })), 11000);
});

test("duplicate pupil across two selected form groups is exposed once", () => {
  const plan = buildSpellingBeeExposurePlan({
    classIds: ["form-a", "form-b"],
    pupilIdsByClassId: new Map([
      ["form-a", ["pupil-1"]],
      ["form-b", ["pupil-1"]],
    ]),
  });

  assert.deepEqual(plain(plan.releaseClassIds), ["form-a"]);
  assert.deepEqual(plain(plan.includedRows), [{ classId: "form-a", pupilId: "pupil-1" }]);
  assert.equal(plan.includedPupilCount, 1);
});

test("first selected class wins for duplicate Spelling Bee memberships", () => {
  const plan = buildSpellingBeeExposurePlan({
    classIds: ["form-b", "form-a"],
    pupilIdsByClassId: {
      "form-a": ["pupil-1"],
      "form-b": ["pupil-1"],
    },
  });

  assert.deepEqual(plain(plan.includedRows), [{ classId: "form-b", pupilId: "pupil-1" }]);
  assert.deepEqual(plain(plan.skippedRows), [{
    classId: "form-a",
    pupilId: "pupil-1",
    skipReason: SPELLING_BEE_DUPLICATE_PUPIL_SKIP_REASON,
  }]);
});

test("duplicate membership is skipped with duplicate_pupil_in_run", () => {
  const plan = buildSpellingBeeExposurePlan({
    classIds: ["form-a", "form-b", "form-c"],
    pupilIdsByClassId: new Map([
      ["form-a", ["pupil-1"]],
      ["form-b", ["pupil-1"]],
      ["form-c", ["pupil-1"]],
    ]),
  });

  assert.equal(plan.includedPupilCount, 1);
  assert.equal(plan.skippedPupilCount, 2);
  assert.deepEqual(plain(plan.skippedRows.map((row) => row.skipReason)), [
    "duplicate_pupil_in_run",
    "duplicate_pupil_in_run",
  ]);
});

test("mixed Spelling Bee classes keep unique pupils and skip duplicates", () => {
  const plan = buildSpellingBeeExposurePlan({
    classIds: ["form-a", "form-b"],
    pupilIdsByClassId: new Map([
      ["form-a", ["pupil-1", "pupil-2"]],
      ["form-b", ["pupil-2", "pupil-3"]],
    ]),
  });

  assert.deepEqual(plain(plan.releaseClassIds), ["form-a", "form-b"]);
  assert.deepEqual(plain(plan.classPlans.map((item) => ({
    classId: item.classId,
    includedPupilIds: item.includedPupilIds,
    duplicatePupilIds: item.duplicatePupilIds,
  }))), [
    { classId: "form-a", includedPupilIds: ["pupil-1", "pupil-2"], duplicatePupilIds: [] },
    { classId: "form-b", includedPupilIds: ["pupil-3"], duplicatePupilIds: ["pupil-2"] },
  ]);
  assert.equal(plan.includedPupilCount, 3);
  assert.equal(plan.skippedPupilCount, 1);
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}
