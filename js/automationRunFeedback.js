const BASELINE_INCOMPLETE_REASON = "baseline_incomplete";
const NO_BASELINE_ASSIGNMENT_REASON = "no_baseline_assignment";
const ACTIVE_AUTOMATED_ASSIGNMENT_REASON = "active_automated_assignment";
const DUPLICATE_PUPIL_IN_RUN_REASON = "duplicate_pupil_in_run";
const COVERAGE_WARNINGS_NOT_RECORDED_COPY = "Coverage warnings not recorded for this run.";
const NO_COVERAGE_WARNINGS_COPY = "No coverage warnings recorded for this run.";

const RUN_STATUS_LABELS = {
  included: "Generated/provisioned",
  generated: "Generated/provisioned",
  provisioned: "Generated/provisioned",
  waiting: "Waiting for baseline",
  provisioning: "Provisioning",
  skipped: "Skipped",
  error: "Error",
  failed: "Error",
  no_active_pupils: "No active pupils",
};

const RUN_REASON_LABELS = {
  [BASELINE_INCOMPLETE_REASON]: "Baseline incomplete",
  [NO_BASELINE_ASSIGNMENT_REASON]: "Baseline not created yet",
  [ACTIVE_AUTOMATED_ASSIGNMENT_REASON]: "Already assigned",
  [DUPLICATE_PUPIL_IN_RUN_REASON]: "Duplicate group membership",
};

const GENERATED_ASSIGNMENT_ROLE_LABELS = {
  review: "Review",
  target: "Target",
  stretch: "Stretch",
};

const GENERATED_ASSIGNMENT_SUPPORT_LABELS = {
  independent: "Independent",
  focus: "Focus",
  recognition: "Recognition",
  supported: "Segmented support",
};

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

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function getObjectValue(row, camelKey, snakeKey = "") {
  if (!row || typeof row !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(row, camelKey)) return row[camelKey];
  if (snakeKey && Object.prototype.hasOwnProperty.call(row, snakeKey)) return row[snakeKey];
  return undefined;
}

export function getAutomationRunStatusLabel(status) {
  const key = normalizeKey(status);
  return RUN_STATUS_LABELS[key] || "Skipped";
}

export function getAutomationRunReasonLabel(reason) {
  const key = normalizeKey(reason);
  if (!key) return "Other";
  return RUN_REASON_LABELS[key] || "Other";
}

function getGeneratedAssignmentRoleLabel(role) {
  const key = normalizeKey(role);
  return GENERATED_ASSIGNMENT_ROLE_LABELS[key] || "Target";
}

function getGeneratedAssignmentSupportLabel(support) {
  const key = normalizeKey(support);
  return GENERATED_ASSIGNMENT_SUPPORT_LABELS[key] || "Independent";
}

function summarizeReasonCounts(classResults = [], reasonKey = "skipReasons") {
  const counts = {};
  for (const result of Array.isArray(classResults) ? classResults : []) {
    const reasons = result?.[reasonKey] && typeof result[reasonKey] === "object"
      ? result[reasonKey]
      : {};
    for (const [key, value] of Object.entries(reasons)) {
      addCount(counts, key, value);
    }
  }
  return counts;
}

export function summarizeAutomationRunSkipReasons(classResults = []) {
  return summarizeReasonCounts(classResults, "skipReasons");
}

export function summarizeAutomationRunWaitingReasons(classResults = []) {
  return summarizeReasonCounts(classResults, "waitingReasons");
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

function buildBaselineWaitingSentence(count, { noAssignment = false } = {}) {
  const pupilText = formatCountLabel(count, "pupil");
  if (noAssignment) {
    return `${pupilText} ${formatPupilVerb(count)} waiting for baseline. Baseline tests are created automatically when pupils log in, or use Baseline status to provision them now.`;
  }
  return `${pupilText} ${formatPupilVerb(count)} waiting for baseline. They need to complete baseline before personalised tests can be generated.`;
}

function buildWaitingReasonSentences(waitingReasonCounts = {}) {
  const sentences = [];
  const noAssignmentCount = getSkipCount(waitingReasonCounts, NO_BASELINE_ASSIGNMENT_REASON);
  const baselineIncompleteCount = getSkipCount(waitingReasonCounts, BASELINE_INCOMPLETE_REASON);
  const baselineTotal = noAssignmentCount + baselineIncompleteCount;

  if (baselineTotal > 0) {
    sentences.push(buildBaselineWaitingSentence(baselineTotal, {
      noAssignment: noAssignmentCount > 0 && baselineIncompleteCount === 0,
    }));
  }

  return sentences;
}

function buildSkipReasonSentences(skipReasonCounts = {}) {
  const sentences = [];
  const activeAssignmentCount = getSkipCount(skipReasonCounts, ACTIVE_AUTOMATED_ASSIGNMENT_REASON);
  const duplicateCount = getSkipCount(skipReasonCounts, DUPLICATE_PUPIL_IN_RUN_REASON);

  if (activeAssignmentCount > 0) {
    sentences.push(`${formatCountLabel(activeAssignmentCount, "pupil")} already ${activeAssignmentCount === 1 ? "has" : "have"} an active personalised assignment.`);
  }
  if (duplicateCount > 0) {
    sentences.push(`${formatCountLabel(duplicateCount, "pupil")} ${formatPupilVerb(duplicateCount)} skipped because they appeared through more than one selected group.`);
  }

  return sentences;
}

function sumClassCount(classResults = [], key = "") {
  return (Array.isArray(classResults) ? classResults : [])
    .reduce((sum, item) => sum + toCount(item?.[key]), 0);
}

function countRowsWithStatus(rows = [], statuses = []) {
  const allowed = new Set((Array.isArray(statuses) ? statuses : [statuses]).map(normalizeKey));
  return (Array.isArray(rows) ? rows : [])
    .reduce((sum, row) => sum + (allowed.has(normalizeKey(row?.status)) ? 1 : 0), 0);
}

function reasonCountsFromRunRows(rows = [], statusFilter = null) {
  const allowedStatuses = Array.isArray(statusFilter)
    ? new Set(statusFilter.map(normalizeKey))
    : null;
  const counts = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    if (allowedStatuses && !allowedStatuses.has(normalizeKey(row?.status))) continue;
    const reason = normalizeKey(row?.skipReason || row?.skip_reason);
    if (!reason) continue;
    addCount(counts, reason, 1);
  }
  return counts;
}

function mergeReasonCounts(...items) {
  const merged = {};
  for (const item of items) {
    for (const [key, value] of Object.entries(item || {})) {
      addCount(merged, key, value);
    }
  }
  return merged;
}

function hasAnyReasonCount(counts = {}) {
  return Object.values(counts || {}).some((value) => toCount(value) > 0);
}

function normalizeCoverageWarning(row) {
  if (!row || typeof row !== "object") return null;
  const type = String(getObjectValue(row, "type") || "").trim();
  const focusGrapheme = String(getObjectValue(row, "focusGrapheme", "focus_grapheme") || "").trim().toLowerCase();
  const requestedTargetCount = toCount(getObjectValue(row, "requestedTargetCount", "requested_target_count"));
  const selectedTargetCount = toCount(getObjectValue(row, "selectedTargetCount", "selected_target_count"));
  const fallbackCount = toCount(getObjectValue(row, "fallbackCount", "fallback_count"));
  const message = String(getObjectValue(row, "message") || "").trim();
  const pupilId = String(getObjectValue(row, "pupilId", "pupil_id") || "").trim();
  if (!type && !focusGrapheme && !message && !requestedTargetCount && !selectedTargetCount && !fallbackCount) return null;
  return {
    type,
    pupilId,
    focusGrapheme,
    requestedTargetCount,
    selectedTargetCount,
    fallbackCount,
    message,
  };
}

export function normalizeCoverageWarnings(warnings = []) {
  return (Array.isArray(warnings) ? warnings : [])
    .map(normalizeCoverageWarning)
    .filter(Boolean);
}

function extractCoverageWarnings(source) {
  if (Array.isArray(source)) {
    return {
      hasCoverageData: true,
      warnings: normalizeCoverageWarnings(source),
    };
  }
  if (!source || typeof source !== "object") {
    return {
      hasCoverageData: false,
      warnings: [],
    };
  }

  if (Object.prototype.hasOwnProperty.call(source, "coverageWarnings")) {
    return {
      hasCoverageData: true,
      warnings: normalizeCoverageWarnings(source.coverageWarnings),
    };
  }
  if (source.summary && typeof source.summary === "object") {
    return extractCoverageWarnings(source.summary);
  }

  const classResults = Array.isArray(source.classes) ? source.classes : [];
  let hasCoverageData = false;
  const warnings = [];
  for (const result of classResults) {
    if (!result || typeof result !== "object") continue;
    if (!Object.prototype.hasOwnProperty.call(result, "coverageWarnings")) continue;
    hasCoverageData = true;
    warnings.push(...normalizeCoverageWarnings(result.coverageWarnings));
  }
  return {
    hasCoverageData,
    warnings,
  };
}

export function formatCoverageWarningCopy(warning = {}) {
  const normalized = normalizeCoverageWarning(warning);
  if (!normalized) return "Coverage warning recorded.";
  if (normalized.message) return normalized.message;
  if (normalized.focusGrapheme && normalized.requestedTargetCount > 0) {
    return `Only ${normalized.selectedTargetCount} of ${normalized.requestedTargetCount} requested target slots could use approved ${normalized.focusGrapheme} words; ${normalized.fallbackCount} slots used safe fallback, review, or consolidation words.`;
  }
  if (normalized.focusGrapheme) {
    return `Coverage warning recorded for ${normalized.focusGrapheme}.`;
  }
  return "Coverage warning recorded.";
}

export function buildCoverageWarningDisplay(source = null, {
  notRecordedMessage = COVERAGE_WARNINGS_NOT_RECORDED_COPY,
  clearMessage = NO_COVERAGE_WARNINGS_COPY,
} = {}) {
  const { hasCoverageData, warnings } = extractCoverageWarnings(source);
  if (!hasCoverageData) {
    return {
      state: "not_recorded",
      hasCoverageData: false,
      message: notRecordedMessage,
      warnings: [],
    };
  }
  if (!warnings.length) {
    return {
      state: "clear",
      hasCoverageData: true,
      message: clearMessage,
      warnings: [],
    };
  }
  const count = warnings.length;
  return {
    state: "warning",
    hasCoverageData: true,
    message: `${formatCountLabel(count, "coverage warning")} recorded.`,
    warnings: warnings.map((warning) => ({
      ...warning,
      displayCopy: formatCoverageWarningCopy(warning),
    })),
  };
}

function normalizeAutomationClassResults(run = {}) {
  const summary = run?.summary && typeof run.summary === "object" ? run.summary : run;
  return Array.isArray(summary?.classes) ? summary.classes : [];
}

function buildReasonChipList(reasonCounts = {}) {
  return Object.entries(reasonCounts || {})
    .map(([reason, count]) => ({
      reason,
      label: getAutomationRunReasonLabel(reason),
      count: toCount(count),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
}

function buildRunOutcomeNextAction({ includedCount, waitingCount, skippedCount, errorCount, activeAssignmentCount }) {
  if (toCount(errorCount) > 0) return "Review the class errors, then rerun after fixing the cause.";
  if (toCount(waitingCount) > 0 && toCount(includedCount) === 0) {
    return "Complete or provision baseline first, then run the policy again.";
  }
  if (toCount(waitingCount) > 0) return "Pupils waiting for baseline will be picked up once baseline is complete.";
  if (toCount(activeAssignmentCount) > 0 && toCount(includedCount) === 0) {
    return "Already assigned pupils were left untouched.";
  }
  if (toCount(skippedCount) > 0 && toCount(includedCount) === 0) return "Check the skipped reasons before rerunning.";
  if (toCount(includedCount) > 0) return "Assignments are ready for the generated pupils.";
  return "No eligible pupils were found in the selected groups.";
}

export function buildAutomationRunOutcomeViewModel({ run = null, pupilRows = null } = {}) {
  const sourceRun = run && typeof run === "object" ? run : {};
  const summary = sourceRun.summary && typeof sourceRun.summary === "object" ? sourceRun.summary : {};
  const classResults = normalizeAutomationClassResults(sourceRun);
  const rows = Array.isArray(pupilRows)
    ? pupilRows
    : (Array.isArray(sourceRun.pupilRows) ? sourceRun.pupilRows : []);

  const includedCount = Math.max(
    toCount(sourceRun.included_pupil_count || sourceRun.includedPupilCount),
    sumClassCount(classResults, "includedCount"),
    countRowsWithStatus(rows, ["included", "generated", "provisioned"])
  );
  const waitingCount = Math.max(
    toCount(summary.waitingPupilCount || sourceRun.waiting_pupil_count || sourceRun.waitingPupilCount),
    sumClassCount(classResults, "waitingCount"),
    countRowsWithStatus(rows, "waiting")
  );
  const skippedCount = Math.max(
    toCount(sourceRun.skipped_pupil_count || sourceRun.skippedPupilCount),
    sumClassCount(classResults, "skippedCount"),
    countRowsWithStatus(rows, "skipped")
  );
  const provisioningCount = countRowsWithStatus(rows, "provisioning");
  const classErrorCount = classResults.filter((item) => normalizeKey(item?.status) === "error").length;
  const failedRun = normalizeKey(sourceRun.status) === "failed";
  const errorCount = Math.max(toCount(summary.errorCount || sourceRun.errorCount), classErrorCount, failedRun ? 1 : 0);

  const classWaitingReasons = summarizeAutomationRunWaitingReasons(classResults);
  const classSkipReasons = summarizeAutomationRunSkipReasons(classResults);
  const waitingReasons = hasAnyReasonCount(classWaitingReasons)
    ? classWaitingReasons
    : reasonCountsFromRunRows(rows, "waiting");
  const skipReasons = hasAnyReasonCount(classSkipReasons)
    ? classSkipReasons
    : reasonCountsFromRunRows(rows, "skipped");
  const reasonCounts = mergeReasonCounts(waitingReasons, skipReasons);
  const activeAssignmentCount = toCount(reasonCounts[ACTIVE_AUTOMATED_ASSIGNMENT_REASON]);
  const duplicateCount = toCount(reasonCounts[DUPLICATE_PUPIL_IN_RUN_REASON]);
  const baselineWaitingCount = toCount(reasonCounts[BASELINE_INCOMPLETE_REASON]) + toCount(reasonCounts[NO_BASELINE_ASSIGNMENT_REASON]);
  const statusCounts = [
    { key: "generated", label: "Generated/provisioned", count: includedCount },
    { key: "waiting", label: "Waiting for baseline", count: waitingCount || baselineWaitingCount },
    { key: "skipped", label: "Skipped", count: skippedCount },
    { key: "already_assigned", label: "Already assigned", count: activeAssignmentCount },
    { key: "provisioning", label: "Provisioning", count: provisioningCount },
    { key: "error", label: "Errors", count: errorCount },
  ].filter((item) => item.count > 0);
  const reasonChips = buildReasonChipList(reasonCounts);
  const coverageDisplay = buildCoverageWarningDisplay(summary);
  const type = errorCount > 0
    ? "error"
    : (waitingCount > 0 || skippedCount > 0 || provisioningCount > 0 ? "warning" : (includedCount > 0 ? "success" : "info"));
  const headline = includedCount > 0
    ? `${formatCountLabel(includedCount, "pupil")} generated/provisioned`
    : "No pupils generated/provisioned";

  return {
    type,
    headline,
    nextAction: buildRunOutcomeNextAction({
      includedCount,
      waitingCount,
      skippedCount,
      errorCount,
      activeAssignmentCount,
    }),
    counts: {
      included: includedCount,
      waiting: waitingCount,
      skipped: skippedCount,
      provisioning: provisioningCount,
      errors: errorCount,
      alreadyAssigned: activeAssignmentCount,
      duplicate: duplicateCount,
    },
    statusCounts,
    reasonChips,
    coverageDisplay,
    classRows: classResults.map((item) => ({
      classId: String(item?.classId || item?.class_id || "").trim(),
      className: String(item?.className || item?.class_name || "Class").trim() || "Class",
      status: normalizeKey(item?.status) || "completed",
      statusLabel: getAutomationRunStatusLabel(item?.status),
      assignmentId: String(item?.assignmentId || item?.assignment_id || "").trim(),
      includedCount: toCount(item?.includedCount || item?.included_count),
      waitingCount: toCount(item?.waitingCount || item?.waiting_count),
      skippedCount: toCount(item?.skippedCount || item?.skipped_count),
      error: String(item?.error || "").trim(),
      reasonChips: buildReasonChipList(mergeReasonCounts(item?.waitingReasons, item?.skipReasons)),
      coverageDisplay: buildCoverageWarningDisplay(item),
    })),
  };
}

function collectGeneratedAssignmentWords({ sections = [], words = [], pupil = null } = {}) {
  if (Array.isArray(sections) && sections.length) {
    return sections.flatMap((section) => {
      const sectionRole = normalizeKey(section?.key);
      return (Array.isArray(section?.items) ? section.items : [])
        .map((item) => ({
          ...item,
          assignmentRole: normalizeKey(item?.assignmentRole || item?.assignment_role) || sectionRole,
        }));
    });
  }
  if (Array.isArray(words) && words.length) return [...words];
  if (Array.isArray(pupil?.targetWords)) return [...pupil.targetWords];
  if (Array.isArray(pupil?.wordResults)) return [...pupil.wordResults];
  return [];
}

function getMostCommonValue(values = []) {
  const counts = {};
  for (const value of values) {
    const key = normalizeKey(value);
    if (!key) continue;
    addCount(counts, key, 1);
  }
  return Object.entries(counts)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })[0]?.[0] || "";
}

function buildCountItems(counts = {}, orderedKeys = [], labelResolver = (key) => key) {
  return orderedKeys
    .map((key) => ({
      key,
      label: labelResolver(key),
      count: toCount(counts[key]),
    }))
    .filter((item) => item.count > 0);
}

function formatCountItems(items = []) {
  return items.length
    ? items.map((item) => `${item.label} ${item.count}`).join(", ")
    : "Not recorded";
}

function buildGeneratedAssignmentWhySentence({ focusGrapheme, roleItems, supportItems, hasMetadata }) {
  if (!hasMetadata) {
    return "Legacy assignment metadata is limited, so only available word details are shown.";
  }
  const hasBlend = roleItems.length > 1;
  const supportText = supportItems.length
    ? ` Support mix: ${formatCountItems(supportItems).toLowerCase()}.`
    : "";
  if (focusGrapheme && hasBlend) {
    return `Targets ${focusGrapheme} with a blend of review, target, and stretch words based on recent evidence.${supportText}`;
  }
  if (focusGrapheme) {
    return `Targets ${focusGrapheme} using the recorded personalised word metadata.${supportText}`;
  }
  return `Generated from available pupil progress evidence using the recorded personalised word metadata.${supportText}`;
}

export function buildGeneratedAssignmentExplainabilitySummary({
  sections = [],
  words = [],
  pupil = null,
} = {}) {
  const items = collectGeneratedAssignmentWords({ sections, words, pupil });
  const roleCounts = {};
  const supportCounts = {};
  const focusCandidates = [];
  let hasMetadata = false;

  for (const item of items) {
    const role = normalizeKey(item?.assignmentRole || item?.assignment_role);
    if (role) {
      addCount(roleCounts, role, 1);
      hasMetadata = true;
    }
    const support = normalizeKey(item?.assignmentSupport || item?.assignment_support);
    if (support) {
      addCount(supportCounts, support, 1);
      hasMetadata = true;
    }
    const focus = normalizeKey(item?.focusGrapheme || item?.focus_grapheme);
    if (focus) {
      focusCandidates.push(focus);
      hasMetadata = true;
    }
    if (normalizeKey(item?.targetReason || item?.target_reason)) {
      hasMetadata = true;
    }
  }

  const focusGrapheme = getMostCommonValue(focusCandidates);
  const roleItems = buildCountItems(roleCounts, ["review", "target", "stretch"], getGeneratedAssignmentRoleLabel);
  const supportItems = buildCountItems(
    supportCounts,
    ["independent", "focus", "supported", "recognition"],
    getGeneratedAssignmentSupportLabel
  );

  return {
    focusGrapheme,
    focusLabel: focusGrapheme || "Not recorded",
    roleItems,
    supportItems,
    roleMixText: formatCountItems(roleItems),
    supportMixText: formatCountItems(supportItems),
    whySentence: buildGeneratedAssignmentWhySentence({
      focusGrapheme,
      roleItems,
      supportItems,
      hasMetadata,
    }),
    hasMetadata,
  };
}

export function buildAutomationRunFeedbackNotice({
  classResults = [],
  includedPupilCount = 0,
  skippedPupilCount = 0,
  waitingPupilCount = null,
  errorCount = 0,
  runStatus = "completed",
} = {}) {
  const includedCount = toCount(includedPupilCount);
  const skippedCount = toCount(skippedPupilCount);
  const waitingCount = waitingPupilCount == null
    ? sumClassCount(classResults, "waitingCount")
    : toCount(waitingPupilCount);
  const failedClassCount = toCount(errorCount);
  const generatedClassCount = (Array.isArray(classResults) ? classResults : [])
    .filter((item) => item?.status === "generated")
    .length;
  const skipReasonCounts = summarizeAutomationRunSkipReasons(classResults);
  const skipReasonSentences = buildSkipReasonSentences(skipReasonCounts);
  const waitingReasonCounts = summarizeAutomationRunWaitingReasons(classResults);
  const waitingReasonSentences = buildWaitingReasonSentences(waitingReasonCounts);
  const failed = String(runStatus || "").trim().toLowerCase() === "failed";
  const type = failed
    ? "error"
    : (waitingCount > 0 || skippedCount > 0 || failedClassCount > 0 || includedCount === 0 ? "warning" : "success");

  if (includedCount === 0 && (waitingCount > 0 || skippedCount > 0) && !failedClassCount) {
    const parts = [
      "No personalised tests generated.",
      ...waitingReasonSentences,
      ...skipReasonSentences,
    ];
    if (waitingCount > 0 && !waitingReasonSentences.length) {
      parts.push(`${formatCountLabel(waitingCount, "pupil")} ${formatPupilVerb(waitingCount)} waiting for baseline.`);
    }
    if (skippedCount > 0 && !skipReasonSentences.length) {
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
  if (waitingCount > 0) {
    parts.push(...waitingReasonSentences);
    if (!waitingReasonSentences.length) {
      parts.push(`${formatCountLabel(waitingCount, "pupil")} ${formatPupilVerb(waitingCount)} waiting for baseline.`);
    }
  }
  if (skippedCount > 0) {
    parts.push(`Skipped ${formatCountLabel(skippedCount, "pupil")}.`);
    parts.push(...skipReasonSentences);
  }
  if (failedClassCount > 0) {
    parts.push(`${failedClassCount} class${failedClassCount === 1 ? "" : "es"} could not be processed.`);
  }
  if (includedCount === 0 && waitingCount === 0 && skippedCount === 0 && generatedClassCount === 0 && failedClassCount === 0) {
    parts.push("No active pupils were available in the selected groups.");
  }

  return {
    message: parts.join(" "),
    type,
  };
}
