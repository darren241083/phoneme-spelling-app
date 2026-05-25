import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildAutomationRunFeedbackNotice,
  buildAutomationRunOutcomeViewModel,
  buildCoverageWarningDisplay,
  buildGeneratedAssignmentExplainabilitySummary,
  formatCoverageWarningCopy,
  getAutomationRunReasonLabel,
  getAutomationRunStatusLabel,
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

test("run outcome view model groups status and reason copy", () => {
  const view = buildAutomationRunOutcomeViewModel({
    run: {
      status: "completed",
      included_pupil_count: 3,
      skipped_pupil_count: 2,
      summary: {
        waitingPupilCount: 2,
        errorCount: 1,
        coverageWarnings: [],
        classes: [{
          className: "Maple",
          status: "generated",
          includedCount: 3,
          waitingCount: 2,
          skippedCount: 2,
          waitingReasons: {
            baseline_incomplete: 1,
            no_baseline_assignment: 1,
          },
          skipReasons: {
            active_automated_assignment: 1,
            duplicate_pupil_in_run: 1,
          },
          coverageWarnings: [],
        }],
      },
      pupilRows: [
        { status: "included" },
        { status: "waiting", skip_reason: "baseline_incomplete" },
        { status: "skipped", skip_reason: "active_automated_assignment" },
      ],
    },
  });

  assert.equal(view.headline, "3 pupils generated/provisioned");
  assert.equal(view.counts.waiting, 2);
  assert.equal(view.counts.alreadyAssigned, 1);
  assert.equal(view.counts.duplicate, 1);
  assert.equal(view.counts.errors, 1);
  assert.deepEqual(
    plain(view.reasonChips.map((item) => `${item.label}:${item.count}`)),
    [
      "Already assigned:1",
      "Baseline incomplete:1",
      "Baseline not created yet:1",
      "Duplicate group membership:1",
    ]
  );
});

test("run status and reason labels use teacher-facing copy", () => {
  assert.equal(getAutomationRunStatusLabel("included"), "Generated/provisioned");
  assert.equal(getAutomationRunStatusLabel("waiting"), "Waiting for baseline");
  assert.equal(getAutomationRunStatusLabel("provisioning"), "Provisioning");
  assert.equal(getAutomationRunStatusLabel("failed"), "Error");
  assert.equal(getAutomationRunReasonLabel("baseline_incomplete"), "Baseline incomplete");
  assert.equal(getAutomationRunReasonLabel("no_baseline_assignment"), "Baseline not created yet");
  assert.equal(getAutomationRunReasonLabel("active_automated_assignment"), "Already assigned");
  assert.equal(getAutomationRunReasonLabel("duplicate_pupil_in_run"), "Duplicate group membership");
});

test("coverage warning display distinguishes missing legacy data from clear new data", () => {
  const missing = buildCoverageWarningDisplay({});
  assert.equal(missing.state, "not_recorded");
  assert.equal(missing.message, "Coverage warnings not recorded for this run.");

  const clear = buildCoverageWarningDisplay({ coverageWarnings: [] });
  assert.equal(clear.state, "clear");
  assert.equal(clear.message, "No coverage warnings recorded for this run.");

  const warning = {
    focusGrapheme: "tion",
    requestedTargetCount: 4,
    selectedTargetCount: 1,
    fallbackCount: 3,
  };
  assert.equal(
    formatCoverageWarningCopy(warning),
    "Only 1 of 4 requested target slots could use approved tion words; 3 slots used safe fallback, review, or consolidation words."
  );
  const display = buildCoverageWarningDisplay({ coverageWarnings: [warning] });
  assert.equal(display.state, "warning");
  assert.equal(display.warnings[0].displayCopy, formatCoverageWarningCopy(warning));
});

test("generated assignment explainability summarizes role mix support mix and focus", () => {
  const summary = buildGeneratedAssignmentExplainabilitySummary({
    sections: [
      {
        key: "review",
        items: [
          { word: "ship", focusGrapheme: "sh", assignmentSupport: "independent", targetReason: "review_retention" },
        ],
      },
      {
        key: "target",
        items: [
          { word: "shop", focusGrapheme: "sh", assignmentSupport: "focus", targetReason: "target_supported" },
          { word: "shed", focusGrapheme: "sh", assignmentSupport: "supported", targetReason: "target_supported" },
        ],
      },
      {
        key: "stretch",
        items: [
          { word: "splash", focusGrapheme: "sh", assignmentSupport: "independent", targetReason: "stretch_probe" },
        ],
      },
    ],
  });

  assert.equal(summary.focusGrapheme, "sh");
  assert.equal(summary.roleMixText, "Review 1, Target 2, Stretch 1");
  assert.equal(summary.supportMixText, "Independent 2, Focus 1, Segmented support 1");
  assert.match(summary.whySentence, /Targets sh with a blend of review, target, and stretch words/);
});

test("generated assignment explainability falls back for missing legacy metadata", () => {
  const summary = buildGeneratedAssignmentExplainabilitySummary({
    words: [{ word: "ship" }, { word: "shop" }],
  });

  assert.equal(summary.focusLabel, "Not recorded");
  assert.equal(summary.roleMixText, "Not recorded");
  assert.equal(summary.supportMixText, "Not recorded");
  assert.equal(summary.whySentence, "Legacy assignment metadata is limited, so only available word details are shown.");
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}
