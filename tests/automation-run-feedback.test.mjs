import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildAutomationRunFeedbackNotice,
  summarizeAutomationRunSkipReasons,
  summarizeAutomationRunWaitingReasons,
} = await loadBrowserModule("../js/automationRunFeedback.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("0 included baseline_incomplete returns warning with waiting copy", () => {
  const notice = buildAutomationRunFeedbackNotice({
    classResults: [{
      status: "waiting",
      waitingCount: 11,
      waitingReasons: { baseline_incomplete: 11 },
    }],
    includedPupilCount: 0,
    skippedPupilCount: 0,
    waitingPupilCount: 11,
    errorCount: 0,
  });

  assert.equal(notice.type, "warning");
  assert.equal(
    notice.message,
    "No personalised tests generated. 11 pupils were waiting for baseline. They need to complete baseline before personalised tests can be generated."
  );
  assert.equal(notice.message.includes("skipped because they have not completed baseline"), false);
});

test("0 included no_baseline_assignment returns warning with waiting setup copy", () => {
  const notice = buildAutomationRunFeedbackNotice({
    classResults: [{
      status: "waiting",
      waitingCount: 11,
      waitingReasons: { no_baseline_assignment: 11 },
    }],
    includedPupilCount: 0,
    skippedPupilCount: 0,
    waitingPupilCount: 11,
    errorCount: 0,
  });

  assert.equal(notice.type, "warning");
  assert.equal(
    notice.message,
    "No personalised tests generated. 11 pupils were waiting for baseline. Baseline tests are created automatically when pupils log in, or use Baseline status to provision them now."
  );
  assert.equal(notice.message.includes("skipped because they do not have a baseline assignment"), false);
});

test("included waiting and skipped pupils returns partial warning copy", () => {
  const notice = buildAutomationRunFeedbackNotice({
    classResults: [{
      status: "generated",
      waitingCount: 2,
      skippedCount: 1,
      waitingReasons: {
        baseline_incomplete: 2,
      },
      skipReasons: {
        active_automated_assignment: 1,
      },
    }],
    includedPupilCount: 5,
    skippedPupilCount: 1,
    waitingPupilCount: 2,
    errorCount: 0,
  });

  assert.equal(notice.type, "warning");
  assert.match(notice.message, /Generated 1 personalised test\./);
  assert.match(notice.message, /Included 5 pupils\./);
  assert.match(notice.message, /2 pupils were waiting for baseline\./);
  assert.match(notice.message, /Skipped 1 pupil\./);
  assert.match(notice.message, /1 pupil already has an active personalised assignment\./);
});

test("included without skipped pupils returns success", () => {
  const notice = buildAutomationRunFeedbackNotice({
    classResults: [{ status: "generated", waitingCount: 0, skippedCount: 0, waitingReasons: {}, skipReasons: {} }],
    includedPupilCount: 5,
    skippedPupilCount: 0,
    waitingPupilCount: 0,
    errorCount: 0,
  });

  assert.equal(notice.type, "success");
  assert.equal(notice.message, "Generated 1 personalised test. Included 5 pupils.");
});

test("skip reason counts are grouped across classes", () => {
  const counts = summarizeAutomationRunSkipReasons([
    { skipReasons: { active_automated_assignment: 1 } },
    { skipReasons: { duplicate_pupil_in_run: 2 } },
  ]);

  assert.deepEqual(plain(counts), {
    active_automated_assignment: 1,
    duplicate_pupil_in_run: 2,
  });
});

test("waiting reason counts are grouped separately from skipped reasons", () => {
  const waitingCounts = summarizeAutomationRunWaitingReasons([
    { waitingReasons: { baseline_incomplete: 2 } },
    { waitingReasons: { baseline_incomplete: 3, no_baseline_assignment: 1 } },
  ]);
  const skipCounts = summarizeAutomationRunSkipReasons([
    { waitingReasons: { baseline_incomplete: 5 } },
    { skipReasons: { active_automated_assignment: 1 } },
  ]);

  assert.deepEqual(plain(waitingCounts), {
    baseline_incomplete: 5,
    no_baseline_assignment: 1,
  });
  assert.deepEqual(plain(skipCounts), {
    active_automated_assignment: 1,
  });
});

test("active personalised assignment remains a skipped blocked case", () => {
  const notice = buildAutomationRunFeedbackNotice({
    classResults: [{
      status: "skipped",
      skippedCount: 1,
      skipReasons: { active_automated_assignment: 1 },
    }],
    includedPupilCount: 0,
    skippedPupilCount: 1,
    waitingPupilCount: 0,
    errorCount: 0,
  });

  assert.equal(notice.type, "warning");
  assert.equal(
    notice.message,
    "No personalised tests generated. 1 pupil already has an active personalised assignment."
  );
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}
