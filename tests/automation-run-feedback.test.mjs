import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildAutomationRunFeedbackNotice,
  summarizeAutomationRunSkipReasons,
} = await loadBrowserModule("../js/automationRunFeedback.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("0 included baseline_incomplete returns warning with baseline completion copy", () => {
  const notice = buildAutomationRunFeedbackNotice({
    classResults: [{
      status: "skipped",
      skippedCount: 11,
      skipReasons: { baseline_incomplete: 11 },
    }],
    includedPupilCount: 0,
    skippedPupilCount: 11,
    errorCount: 0,
  });

  assert.equal(notice.type, "warning");
  assert.equal(
    notice.message,
    "No personalised tests generated. 11 pupils were skipped because they have not completed baseline yet. Pupils need to complete baseline before personalised tests can be generated. Baseline tests are created automatically when pupils log in, or use Baseline status to provision them now."
  );
});

test("0 included no_baseline_assignment returns warning with provision-focused copy", () => {
  const notice = buildAutomationRunFeedbackNotice({
    classResults: [{
      status: "skipped",
      skippedCount: 11,
      skipReasons: { no_baseline_assignment: 11 },
    }],
    includedPupilCount: 0,
    skippedPupilCount: 11,
    errorCount: 0,
  });

  assert.equal(notice.type, "warning");
  assert.equal(
    notice.message,
    "No personalised tests generated. 11 pupils were skipped because they do not have a baseline assignment yet. Baseline tests are created automatically when pupils log in, or use Baseline status to provision them now."
  );
});

test("included and skipped pupils returns partial warning copy", () => {
  const notice = buildAutomationRunFeedbackNotice({
    classResults: [{
      status: "generated",
      skippedCount: 2,
      skipReasons: {
        active_automated_assignment: 1,
        duplicate_pupil_in_run: 1,
      },
    }],
    includedPupilCount: 5,
    skippedPupilCount: 2,
    errorCount: 0,
  });

  assert.equal(notice.type, "warning");
  assert.match(notice.message, /Generated 1 personalised test\./);
  assert.match(notice.message, /Included 5 pupils\./);
  assert.match(notice.message, /Skipped 2 pupils\./);
  assert.match(notice.message, /Some pupils already have an active personalised assignment\./);
  assert.match(notice.message, /Some pupils were skipped because they appeared through more than one selected group\./);
});

test("included without skipped pupils returns success", () => {
  const notice = buildAutomationRunFeedbackNotice({
    classResults: [{ status: "generated", skippedCount: 0, skipReasons: {} }],
    includedPupilCount: 5,
    skippedPupilCount: 0,
    errorCount: 0,
  });

  assert.equal(notice.type, "success");
  assert.equal(notice.message, "Generated 1 personalised test. Included 5 pupils.");
});

test("skip reason counts are grouped across classes", () => {
  const counts = summarizeAutomationRunSkipReasons([
    { skipReasons: { baseline_incomplete: 2, active_automated_assignment: 1 } },
    { skipReasons: { baseline_incomplete: 3, duplicate_pupil_in_run: 2 } },
  ]);

  assert.deepEqual(plain(counts), {
    baseline_incomplete: 5,
    active_automated_assignment: 1,
    duplicate_pupil_in_run: 2,
  });
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}
