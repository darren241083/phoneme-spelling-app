const EXCEL_UNAVAILABLE_MESSAGE = "Excel export is unavailable. Please use CSV or reload and try again.";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function numberOrBlank(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : "";
}

function formatPercentValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : "";
}

function formatDecimalValue(value, digits = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : "";
}

function formatDateValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString();
}

function formatScoreValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : "";
}

function formatRankValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : "";
}

function joinList(value) {
  return asArray(value)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function securityBandLabel(band) {
  if (band === "secure") return "Secure";
  if (band === "nearly_secure") return "Developing";
  if (band === "insecure") return "Needs review";
  return cleanText(band);
}

function safeColumn(column) {
  if (typeof column === "string") {
    return { key: column, label: column };
  }
  return {
    key: cleanText(column?.key),
    label: cleanText(column?.label || column?.key),
  };
}

function sheetColumns(sheet = {}) {
  return asArray(sheet.columns).map(safeColumn).filter((column) => column.key);
}

function cellValue(row = {}, column = {}) {
  if (typeof column.value === "function") return column.value(row);
  return row?.[column.key] ?? "";
}

function escapeCsvCell(value = "") {
  const safeValue = String(value ?? "");
  if (/[",\r\n]/.test(safeValue)) {
    return `"${safeValue.replaceAll('"', '""')}"`;
  }
  return safeValue;
}

function toSheetRows(sheet = {}) {
  const columns = sheetColumns(sheet);
  return [
    columns.map((column) => column.label),
    ...asArray(sheet.rows).map((row) => columns.map((column) => cellValue(row, column))),
  ];
}

function safeSheetName(value, fallback = "Sheet") {
  const clean = cleanText(value, fallback)
    .replace(/[\[\]*?:/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  return clean || fallback;
}

function dedupeSheetName(name, usedNames) {
  let nextName = safeSheetName(name);
  if (!usedNames.has(nextName)) {
    usedNames.add(nextName);
    return nextName;
  }

  for (let index = 2; index < 100; index += 1) {
    const suffix = ` ${index}`;
    const candidate = safeSheetName(`${nextName.slice(0, 31 - suffix.length)}${suffix}`);
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }

  return nextName;
}

function metadataRows(metadata = []) {
  return asArray(metadata)
    .map((item) => ({
      label: cleanText(item?.label),
      value: item?.value ?? "",
    }))
    .filter((item) => item.label || item.value !== "");
}

function getPrimaryExportSheet(model = {}) {
  const sheets = asArray(model.sheets);
  const primaryName = cleanText(model.primarySheetName);
  return sheets.find((sheet) => cleanText(sheet?.name) === primaryName) || sheets[0] || null;
}

function hasSheetRows(sheet = {}) {
  return asArray(sheet.rows).length > 0;
}

function graphemeExportRows(rows = []) {
  return asArray(rows).map((row) => ({
    grapheme: cleanText(row?.target || row?.grapheme),
    band: cleanText(row?.statusMeta?.label || securityBandLabel(row?.securityBand)),
    checked: numberOrBlank(row?.total ?? row?.checked),
    correct: numberOrBlank(row?.correct),
    incorrect: numberOrBlank(row?.incorrect),
    accuracy: formatPercentValue(row?.accuracy),
    first_try: formatPercentValue(row?.firstTrySuccessRate),
    average_tries: formatDecimalValue(row?.averageAttempts),
    sample_words: joinList(row?.wordSamples || row?.words),
  }));
}

function pupilExportRows(rows = []) {
  return asArray(rows).map((row) => {
    const indicator = row?.attainmentIndicator || {};
    return {
      rank: formatRankValue(row?.performanceRank),
      pupil_name: cleanText(row?.name || row?.label, "Pupil"),
      classes: joinList(row?.classNames) || cleanText(row?.subtitle),
      checked_words: numberOrBlank(row?.checkedWords),
      accuracy: formatPercentValue(row?.accuracy),
      first_try: formatPercentValue(row?.firstTrySuccessRate),
      average_tries: formatDecimalValue(row?.averageAttempts),
      sai: formatScoreValue(indicator?.score ?? row?.attainmentScore),
      level: cleanText(indicator?.attainmentDisplayLabel || row?.attainmentDisplayLabel || row?.headlineAttainmentLabel),
      performance_descriptor: cleanText(indicator?.securityLabel || row?.securityLabel),
      signal: cleanText(row?.signalLabel || row?.statusLabel),
      focus_graphemes: joinList(row?.weakGraphemes || row?.focusGraphemes),
      latest_activity: formatDateValue(row?.latestActivity),
    };
  });
}

function classExportRows(rows = []) {
  return asArray(rows).map((row) => ({
    rank: formatRankValue(row?.performanceRank),
    class_name: cleanText(row?.className, "Class"),
    year_group: cleanText(row?.yearGroup),
    pupils: numberOrBlank(row?.pupilCount),
    active_pupils: numberOrBlank(row?.activePupilCount),
    checked_words: numberOrBlank(row?.checkedWords),
    accuracy: formatPercentValue(row?.accuracy),
    average_tries: formatDecimalValue(row?.averageAttempts),
    sai: formatScoreValue(row?.averageIndicatorScore),
    level: cleanText(row?.attainmentDisplayLabel || row?.headlineAttainmentLabel),
    performance_descriptor: cleanText(row?.securityLabel || row?.typicalSecurityLabel),
    review_count: numberOrBlank(row?.interventionCount),
    primary_concern: cleanText(row?.primaryConcern),
  }));
}

function timelineExportRows(rows = []) {
  return asArray(rows).map((row) => ({
    day: cleanText(row?.dayKey || row?.day),
    attempts: numberOrBlank(row?.attemptCount ?? row?.attempts),
    correct: numberOrBlank(row?.correctCount ?? row?.correct),
    active_pupils: numberOrBlank(row?.pupilCount ?? row?.activePupils),
    accuracy: formatPercentValue(row?.accuracy),
    expected_accuracy: formatPercentValue(row?.expectedAccuracy),
    average_difficulty: numberOrBlank(row?.averageDifficultyScore ?? row?.averageDifficulty),
  }));
}

function assignmentWordRows(pupilRows = []) {
  const rows = [];
  for (const pupil of asArray(pupilRows)) {
    const seen = new Set();
    const wordResults = [...asArray(pupil?.wordResults), ...asArray(pupil?.targetWords)];
    for (const wordResult of wordResults) {
      const key = [
        wordResult?.assignmentTargetId || "",
        wordResult?.baseTestWordId || wordResult?.wordId || "",
        wordResult?.word || "",
        wordResult?.isTargeted ? "target" : "word",
      ].join("::");
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        pupil_name: cleanText(pupil?.name, "Pupil"),
        word: cleanText(wordResult?.word, "Word"),
        role_or_target_reason: cleanText(wordResult?.targetReason || wordResult?.assignmentRole || (wordResult?.isTargeted ? "target" : "core")),
        focus_grapheme: cleanText(wordResult?.focusGrapheme),
        status: cleanText(wordResult?.statusLabel || wordResult?.attemptSummary),
        correct: wordResult?.latestAttempt ? (wordResult?.correct ? "Yes" : "No") : "",
        attempts_used: numberOrBlank(wordResult?.attemptsUsed),
        typed_answer: cleanText(
          wordResult?.latestAttempt?.typed ||
          wordResult?.latestAttempt?.typed_text ||
          wordResult?.latestAttempt?.answer ||
          wordResult?.latestAttempt?.response
        ),
        checked_at: formatDateValue(wordResult?.latestAttempt?.created_at),
      });
    }
  }
  return rows;
}

function assignmentMatrixRows(analytics = {}, matrixRows = []) {
  const wordColumns = asArray(analytics?.wordColumns);
  if (!wordColumns.length || !asArray(matrixRows).length) return null;

  const columns = [
    { key: "rank", label: "Rank" },
    { key: "pupil_name", label: "Pupil name" },
    { key: "status", label: "Status" },
    { key: "accuracy", label: "Accuracy" },
    { key: "out_of", label: "Out of" },
    { key: "targets", label: "Targets" },
    ...wordColumns.map((word, index) => ({
      key: `word_${index + 1}`,
      label: cleanText(word?.word, `Word ${index + 1}`),
    })),
  ];

  const rows = asArray(matrixRows).map((pupil) => {
    const row = {
      rank: formatRankValue(pupil?.accuracyRank),
      pupil_name: cleanText(pupil?.name, "Pupil"),
      status: cleanText(pupil?.status),
      accuracy: Number(pupil?.attemptedWords || 0) ? formatPercentValue(pupil?.checkedAccuracy) : "",
      out_of: `${Number(pupil?.correctWords || 0)}/${Number(pupil?.totalWords || 0)}`,
      targets: numberOrBlank(pupil?.targetWordCount),
    };
    for (const [index, word] of wordColumns.entries()) {
      const match = asArray(pupil?.wordResults).find((result) =>
        String(result?.wordId || result?.baseTestWordId || "") === String(word?.id || "")
      );
      row[`word_${index + 1}`] = cleanText(match?.statusLabel || match?.attemptSummary || "Not attempted");
    }
    return row;
  });

  return {
    name: "Matrix",
    columns,
    rows,
  };
}

export function sanitizeExportFileStem(value = "", fallback = "analytics-export") {
  const clean = cleanText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return clean || fallback;
}

export function buildExportFilename(model = {}, extension = "csv") {
  const suffix = cleanText(extension, "csv").replace(/^\.+/, "");
  return `${sanitizeExportFileStem(model.filenameStem || model.title || "analytics-export")}.${suffix}`;
}

export function serializeExportCsv(model = {}) {
  const sheet = getPrimaryExportSheet(model);
  if (!sheet) return "";
  const rows = toSheetRows(sheet);
  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}`;
}

export function writeExportWorkbook(model = {}, XLSX = null) {
  if (!XLSX?.utils?.book_new || !XLSX?.writeFile) {
    throw new Error(EXCEL_UNAVAILABLE_MESSAGE);
  }

  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();
  const metaRows = metadataRows(model.metadata);
  if (metaRows.length) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Field", "Value"],
        ...metaRows.map((item) => [item.label, item.value]),
      ]),
      dedupeSheetName("Metadata", usedNames),
    );
  }

  for (const sheet of asArray(model.sheets)) {
    const rows = toSheetRows(sheet);
    if (rows.length <= 1 && !hasSheetRows(sheet)) continue;
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      dedupeSheetName(sheet?.name || "Sheet", usedNames),
    );
  }

  if (!workbook.SheetNames?.length) {
    throw new Error("There is no analytics data to export yet.");
  }

  XLSX.writeFile(workbook, buildExportFilename(model, "xlsx"));
}

export function buildScopedAnalyticsExportModel({
  dataset = "summary",
  viewLabel = "",
  scopeLabel = "",
  graphemeLabel = "",
  windowDays = "",
  generatedAt = "",
  rows = [],
} = {}) {
  const safeDataset = String(dataset || "").trim().toLowerCase() === "attempts" ? "attempts" : "summary";
  const sheetName = safeDataset === "attempts" ? "Attempts" : "Summary";
  const title = `${sheetName} export`;
  const safeRows = asArray(rows);
  const columns = safeDataset === "attempts"
    ? [
      { key: "pupil_name", label: "pupil_name" },
      { key: "pupil_id", label: "pupil_id" },
      { key: "class_name", label: "class_name" },
      { key: "class_id", label: "class_id" },
      { key: "year_group", label: "year_group" },
      { key: "grapheme", label: "grapheme" },
      { key: "word", label: "word" },
      { key: "typed_answer", label: "typed_answer" },
      { key: "assignment_name", label: "assignment_name" },
      { key: "assignment_id", label: "assignment_id" },
      { key: "assignment_type", label: "assignment_type" },
      { key: "attempt_source", label: "attempt_source" },
      { key: "timestamp", label: "timestamp" },
      { key: "correct", label: "correct" },
      { key: "incorrect", label: "incorrect" },
      { key: "score", label: "score" },
      { key: "accuracy", label: "accuracy" },
      { key: "attempt_number", label: "attempt_number" },
      { key: "mode", label: "mode" },
      { key: "question_type", label: "question_type" },
      { key: "support", label: "support" },
      { key: "status", label: "status" },
      { key: "test_word_id", label: "test_word_id" },
    ]
    : [
      { key: "pupil_name", label: "pupil_name" },
      { key: "pupil_id", label: "pupil_id" },
      { key: "class_name", label: "class_name" },
      { key: "year_group", label: "year_group" },
      { key: "grapheme", label: "grapheme" },
      { key: "attempts_count", label: "attempts_count" },
      { key: "correct_count", label: "correct_count" },
      { key: "incorrect_count", label: "incorrect_count" },
      { key: "accuracy", label: "accuracy" },
      { key: "first_try", label: "first_try" },
      { key: "average_tries", label: "average_tries" },
      { key: "latest_activity", label: "latest_activity" },
      { key: "signal", label: "signal" },
      { key: "sai", label: "sai" },
      { key: "level", label: "level" },
      { key: "performance_descriptor", label: "performance_descriptor" },
    ];

  return {
    title,
    filenameStem: sanitizeExportFileStem([
      "analytics",
      safeDataset,
      viewLabel,
      scopeLabel,
      graphemeLabel || "all-graphemes",
    ].filter(Boolean).join("-")),
    primarySheetName: sheetName,
    metadata: [
      { label: "Export", value: title },
      { label: "Generated at", value: formatDateValue(generatedAt || new Date().toISOString()) },
      { label: "View", value: cleanText(viewLabel) },
      { label: "Focus", value: cleanText(scopeLabel) },
      { label: "Grapheme", value: cleanText(graphemeLabel, "All graphemes") },
      { label: "Window days", value: numberOrBlank(windowDays) },
      { label: "Dataset", value: sheetName },
    ],
    sheets: [
      {
        name: sheetName,
        columns,
        rows: safeRows,
      },
    ],
  };
}

export function buildAnalyticsSummaryExportModel({
  summary = null,
  context = {},
  pupilRows = [],
  graphemeRows = [],
  classRows = [],
  timelineRows = [],
} = {}) {
  const safeSummary = summary || {};
  const title = cleanText(context.title || safeSummary.label || "Analytics export", "Analytics export");
  const scopeLabel = cleanText(context.scopeLabel || safeSummary.label, "All classes");
  const scopeType = cleanText(context.scopeTypeLabel || safeSummary.scopeType, "All classes");
  const primarySheetName = cleanText(context.primarySheetName, "Summary");
  const summaryRow = {
    scope_type: scopeType,
    scope_label: scopeLabel,
    grapheme_filter: cleanText(context.graphemeFilterLabel || safeSummary.selectedGrapheme, "All graphemes"),
    window_days: numberOrBlank(context.windowDays ?? safeSummary.windowDays),
    pupils: numberOrBlank(safeSummary.pupilCount),
    active_pupils: numberOrBlank(safeSummary.activePupilCount),
    classes: numberOrBlank(safeSummary.classCount),
    checked_words: numberOrBlank(safeSummary.checkedWords),
    accuracy: formatPercentValue(safeSummary.accuracy),
    first_try: formatPercentValue(safeSummary.firstTrySuccessRate),
    average_tries: formatDecimalValue(safeSummary.averageAttempts),
    sai: formatScoreValue(safeSummary.averageIndicatorScore ?? safeSummary.attainmentIndicator?.score),
    level: cleanText(context.attainmentLevel || safeSummary.attainmentDisplayLabel || safeSummary.headlineAttainmentLabel),
    performance_descriptor: cleanText(context.performanceDescriptor || safeSummary.securityLabel || safeSummary.typicalSecurityLabel),
    top_concern: cleanText(safeSummary.topConcern),
    top_strength: cleanText(safeSummary.topStrength),
    latest_activity: formatDateValue(safeSummary.latestActivity),
  };

  return {
    title,
    filenameStem: sanitizeExportFileStem(`analytics-${scopeLabel}-${cleanText(safeSummary.selectedGrapheme || "all-graphemes")}`),
    primarySheetName,
    metadata: [
      { label: "Export", value: title },
      { label: "Generated at", value: formatDateValue(context.generatedAt || new Date().toISOString()) },
      { label: "Scope", value: scopeLabel },
      { label: "Scope type", value: scopeType },
      { label: "Grapheme filter", value: summaryRow.grapheme_filter },
      { label: "Pupil status filter", value: cleanText(context.pupilStatusFilterLabel, "All") },
      { label: "Grapheme status filter", value: cleanText(context.graphemeStatusFilterLabel, "All") },
      { label: "Pupil search", value: cleanText(context.pupilSearch, "None") },
      { label: "Class ranking", value: cleanText(context.classRankingLabel) },
      { label: "Pupil ranking", value: cleanText(context.pupilRankingLabel) },
    ],
    sheets: [
      {
        name: "Summary",
        columns: [
          { key: "scope_type", label: "Scope type" },
          { key: "scope_label", label: "Scope label" },
          { key: "grapheme_filter", label: "Grapheme filter" },
          { key: "window_days", label: "Window days" },
          { key: "pupils", label: "Pupils" },
          { key: "active_pupils", label: "Active pupils" },
          { key: "classes", label: "Classes" },
          { key: "checked_words", label: "Checked words" },
          { key: "accuracy", label: "Accuracy" },
          { key: "first_try", label: "First try" },
          { key: "average_tries", label: "Average tries" },
          { key: "sai", label: "SAI" },
          { key: "level", label: "Level" },
          { key: "performance_descriptor", label: "Performance descriptor" },
          { key: "top_concern", label: "Top concern" },
          { key: "top_strength", label: "Top strength" },
          { key: "latest_activity", label: "Latest activity" },
        ],
        rows: [summaryRow],
      },
      {
        name: "Pupils",
        columns: [
          { key: "rank", label: "Rank" },
          { key: "pupil_name", label: "Pupil name" },
          { key: "classes", label: "Classes" },
          { key: "checked_words", label: "Checked words" },
          { key: "accuracy", label: "Accuracy" },
          { key: "first_try", label: "First try" },
          { key: "average_tries", label: "Average tries" },
          { key: "sai", label: "SAI" },
          { key: "level", label: "Level" },
          { key: "performance_descriptor", label: "Performance descriptor" },
          { key: "signal", label: "Signal" },
          { key: "focus_graphemes", label: "Focus graphemes" },
          { key: "latest_activity", label: "Latest activity" },
        ],
        rows: pupilExportRows(pupilRows),
      },
      {
        name: "Graphemes",
        columns: [
          { key: "grapheme", label: "Grapheme" },
          { key: "band", label: "Band" },
          { key: "checked", label: "Checked" },
          { key: "correct", label: "Correct" },
          { key: "incorrect", label: "Incorrect" },
          { key: "accuracy", label: "Accuracy" },
          { key: "first_try", label: "First try" },
          { key: "average_tries", label: "Average tries" },
          { key: "sample_words", label: "Sample words" },
        ],
        rows: graphemeExportRows(graphemeRows),
      },
      {
        name: "Classes",
        columns: [
          { key: "rank", label: "Rank" },
          { key: "class_name", label: "Class name" },
          { key: "year_group", label: "Year group" },
          { key: "pupils", label: "Pupils" },
          { key: "active_pupils", label: "Active pupils" },
          { key: "checked_words", label: "Checked words" },
          { key: "accuracy", label: "Accuracy" },
          { key: "average_tries", label: "Average tries" },
          { key: "sai", label: "SAI" },
          { key: "level", label: "Level" },
          { key: "performance_descriptor", label: "Performance descriptor" },
          { key: "review_count", label: "Review count" },
          { key: "primary_concern", label: "Primary concern" },
        ],
        rows: classExportRows(classRows),
      },
      {
        name: "Timeline",
        columns: [
          { key: "day", label: "Day" },
          { key: "attempts", label: "Attempts" },
          { key: "correct", label: "Correct" },
          { key: "active_pupils", label: "Active pupils" },
          { key: "accuracy", label: "Accuracy" },
          { key: "expected_accuracy", label: "Expected accuracy" },
          { key: "average_difficulty", label: "Average difficulty" },
        ],
        rows: timelineExportRows(timelineRows),
      },
    ],
  };
}

export function buildAssignmentAnalyticsExportModel({
  analytics = null,
  assignment = null,
  context = {},
  matrixRows = [],
} = {}) {
  const safeAnalytics = analytics || {};
  const title = cleanText(context.title || assignment?.tests?.title || "Assignment analytics export", "Assignment analytics export");
  const className = cleanText(safeAnalytics.className || assignment?.classes?.name || context.className, "Class");
  const pupilRows = asArray(safeAnalytics.pupilRows);
  const sheets = [
    {
      name: "Pupils",
      columns: [
        { key: "pupil_name", label: "Pupil name" },
        { key: "status", label: "Status" },
        { key: "started_at", label: "Started at" },
        { key: "completed_at", label: "Completed at" },
        { key: "total_words", label: "Total words" },
        { key: "checked_words", label: "Checked words" },
        { key: "correct", label: "Correct" },
        { key: "incorrect", label: "Incorrect" },
        { key: "remaining", label: "Remaining" },
        { key: "accuracy", label: "Accuracy" },
        { key: "first_try", label: "First try" },
        { key: "average_tries", label: "Average tries" },
        { key: "sai", label: "SAI" },
        { key: "signal", label: "Signal" },
        { key: "priority_target", label: "Priority target" },
      ],
      rows: pupilRows.map((row) => ({
        pupil_name: cleanText(row?.name, "Pupil"),
        status: cleanText(row?.status),
        started_at: formatDateValue(row?.startedAt),
        completed_at: formatDateValue(row?.completedAt),
        total_words: numberOrBlank(row?.totalWords),
        checked_words: numberOrBlank(row?.attemptedWords),
        correct: numberOrBlank(row?.correctWords),
        incorrect: numberOrBlank(row?.incorrectWords),
        remaining: numberOrBlank(row?.remainingWords),
        accuracy: formatPercentValue(row?.checkedAccuracy),
        first_try: formatPercentValue(row?.firstTimeCorrectRate),
        average_tries: formatDecimalValue(row?.averageAttempts),
        sai: formatScoreValue(row?.attainmentIndicator?.score),
        signal: cleanText(row?.signalLabel),
        priority_target: cleanText(row?.priorityTarget),
      })),
    },
    {
      name: "Words",
      columns: [
        { key: "pupil_name", label: "Pupil name" },
        { key: "word", label: "Word" },
        { key: "role_or_target_reason", label: "Role/target reason" },
        { key: "focus_grapheme", label: "Focus grapheme" },
        { key: "status", label: "Status" },
        { key: "correct", label: "Correct" },
        { key: "attempts_used", label: "Attempts used" },
        { key: "typed_answer", label: "Typed answer" },
        { key: "checked_at", label: "Checked at" },
      ],
      rows: assignmentWordRows(pupilRows),
    },
  ];

  const matrixSheet = assignmentMatrixRows(safeAnalytics, matrixRows);
  if (matrixSheet) sheets.push(matrixSheet);

  return {
    title,
    filenameStem: sanitizeExportFileStem(`assignment-${className}-${title}`),
    primarySheetName: "Pupils",
    metadata: [
      { label: "Export", value: title },
      { label: "Generated at", value: formatDateValue(context.generatedAt || new Date().toISOString()) },
      { label: "Class", value: className },
      { label: "Assignment", value: title },
      { label: "Reference", value: cleanText(context.referenceLabel) },
      { label: "Total words", value: numberOrBlank(safeAnalytics.totalWords) },
      { label: "Roster", value: numberOrBlank(safeAnalytics.rosterCount) },
      { label: "Completed", value: numberOrBlank(safeAnalytics.completedCount) },
    ],
    sheets,
  };
}

export function exportModelHasRows(model = {}) {
  return asArray(model.sheets).some((sheet) => hasSheetRows(sheet));
}

export { EXCEL_UNAVAILABLE_MESSAGE };
