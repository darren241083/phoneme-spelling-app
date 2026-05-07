const BASELINE_INCOMPLETE_REASON = "baseline_incomplete";
const NO_BASELINE_ASSIGNMENT_REASON = "no_baseline_assignment";
const ACTIVE_AUTOMATED_ASSIGNMENT_REASON = "active_automated_assignment";
const DUPLICATE_PUPIL_IN_RUN_REASON = "duplicate_pupil_in_run";

function toCount(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function formatCountLabel(value, singular, plural = `${singular}s`) {
  const count = toCount(value);
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatPupilVerb(value) {
  return toCount(value) === 1 ? "was" : "were";
}

function addCount(counts, key, value = 1) {
  const safeKey = String(key || "").trim().toLowerCase();
  if (!safeKey) return;
  counts[safeKey] = toCount(counts[safeKey]) + toCount(value || 1);
}

export function summarizeAutomationRunSkipReasons(classResults = []) {
  const counts = {};
  for (const result of Array.isArray(classResults) ? classResults : []) {
    const skipReasons = result?.skipReasons && typeof result.skipReasons === "object"
      ? result.skipReasons
      : {};
    for (const [key, value] of Object.entries(skipReasons)) {
      addCount(counts, key, value);
    }
  }
  return counts;
}

function getSkipCount(skipReasonCounts, key) {
  return toCount(skipReasonCounts?.[key]);
}

function buildGeneratedClassCopy(generatedClassCount, includedPupilCount) {
  const generatedCount = toCount(generatedClassCount);
  if (generatedCount > 0) {
    return generatedCount === 1
      ? "Generated 1 personalised test."
      : `Generated ${generatedCount} personalised tests.`;
  }
  if (toCount(includedPupilCount) > 0) {
    return "Generated personalised tests.";
  }
  return "No personalised tests generated.";
}

function buildBaselineSkipSentence(count, { noAssignment = false } = {}) {
  const pupilText = formatCountLabel(count, "pupil");
  if (noAssignment) {
    return `${pupilText} ${formatPupilVerb(count)} skipped because they do not have a baseline assignment yet. Baseline tests are created automatically when pupils log in, or use Baseline status to provision them now.`;
  }
  return `${pupilText} ${formatPupilVerb(count)} skipped because they have not completed baseline yet. Pupils need to complete baseline before personalised tests can be generated. Baseline tests are created automatically when pupils log in, or use Baseline status to provision them now.`;
}

function buildSkipReasonSentences(skipReasonCounts = {}) {
  const sentences = [];
  const noAssignmentCount = getSkipCount(skipReasonCounts, NO_BASELINE_ASSIGNMENT_REASON);
  const baselineIncompleteCount = getSkipCount(skipReasonCounts, BASELINE_INCOMPLETE_REASON);
  const baselineTotal = noAssignmentCount + baselineIncompleteCount;

  if (baselineTotal > 0) {
    sentences.push(buildBaselineSkipSentence(baselineTotal, {
      noAssignment: noAssignmentCount > 0 && baselineIncompleteCount === 0,
    }));
  }
  if (getSkipCount(skipReasonCounts, ACTIVE_AUTOMATED_ASSIGNMENT_REASON) > 0) {
    sentences.push("Some pupils already have an active personalised assignment.");
  }
  if (getSkipCount(skipReasonCounts, DUPLICATE_PUPIL_IN_RUN_REASON) > 0) {
    sentences.push("Some pupils were skipped because they appeared through more than one selected group.");
  }

  return sentences;
}

export function buildAutomationRunFeedbackNotice({
  classResults = [],
  includedPupilCount = 0,
  skippedPupilCount = 0,
  errorCount = 0,
  runStatus = "completed",
} = {}) {
  const includedCount = toCount(includedPupilCount);
  const skippedCount = toCount(skippedPupilCount);
  const failedClassCount = toCount(errorCount);
  const generatedClassCount = (Array.isArray(classResults) ? classResults : [])
    .filter((item) => item?.status === "generated")
    .length;
  const skipReasonCounts = summarizeAutomationRunSkipReasons(classResults);
  const skipReasonSentences = buildSkipReasonSentences(skipReasonCounts);
  const failed = String(runStatus || "").trim().toLowerCase() === "failed";
  const type = failed
    ? "error"
    : (skippedCount > 0 || failedClassCount > 0 || includedCount === 0 ? "warning" : "success");

  if (includedCount === 0 && skippedCount > 0 && !failedClassCount) {
    const parts = [
      "No personalised tests generated.",
      ...skipReasonSentences,
    ];
    if (!skipReasonSentences.length) {
      parts.push(`${formatCountLabel(skippedCount, "pupil")} ${formatPupilVerb(skippedCount)} skipped.`);
    }
    return {
      message: parts.join(" "),
      type,
    };
  }

  const parts = [
    buildGeneratedClassCopy(generatedClassCount, includedCount),
  ];

  if (includedCount > 0) {
    parts.push(`Included ${formatCountLabel(includedCount, "pupil")}.`);
  }
  if (skippedCount > 0) {
    parts.push(`Skipped ${formatCountLabel(skippedCount, "pupil")}.`);
    parts.push(...skipReasonSentences);
  }
  if (failedClassCount > 0) {
    parts.push(`${failedClassCount} class${failedClassCount === 1 ? "" : "es"} could not be processed.`);
  }
  if (includedCount === 0 && skippedCount === 0 && generatedClassCount === 0 && failedClassCount === 0) {
    parts.push("No active pupils were available in the selected groups.");
  }

  return {
    message: parts.join(" "),
    type,
  };
}
