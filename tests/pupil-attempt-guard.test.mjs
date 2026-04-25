import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  normalizeSubmittedAnswer,
  shouldBlockDuplicateIncorrectSubmission,
} = await loadBrowserModule("../js/pupilAttemptGuard.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

test("normalises submitted answers with trim and lowercase matching", () => {
  assert.equal(normalizeSubmittedAnswer("  Rain  "), "rain");
});

test("blocks the same submitted answer after an incorrect submission", () => {
  assert.equal(shouldBlockDuplicateIncorrectSubmission({
    previousResultWasIncorrect: true,
    lastSubmittedIncorrectAnswer: "rain",
    currentSubmittedAnswer: "rain",
  }), true);
});

test("allows a changed answer after an incorrect submission", () => {
  assert.equal(shouldBlockDuplicateIncorrectSubmission({
    previousResultWasIncorrect: true,
    lastSubmittedIncorrectAnswer: "rain",
    currentSubmittedAnswer: "train",
  }), false);
});

test("does not block when the previous submitted result was not incorrect", () => {
  assert.equal(shouldBlockDuplicateIncorrectSubmission({
    previousResultWasIncorrect: false,
    lastSubmittedIncorrectAnswer: "rain",
    currentSubmittedAnswer: "rain",
  }), false);
});

test("treats case-only changes as unchanged submissions", () => {
  assert.equal(shouldBlockDuplicateIncorrectSubmission({
    previousResultWasIncorrect: true,
    lastSubmittedIncorrectAnswer: "Rain",
    currentSubmittedAnswer: "  rain ",
  }), true);
});

test("does not block blank submissions", () => {
  assert.equal(shouldBlockDuplicateIncorrectSubmission({
    previousResultWasIncorrect: true,
    lastSubmittedIncorrectAnswer: "rain",
    currentSubmittedAnswer: "",
  }), false);
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
  console.log(`all ${TESTS.length} pupil attempt guard checks passed`);
}
