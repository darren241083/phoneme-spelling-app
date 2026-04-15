import {
  buildDuplicateValueMap,
  buildNormalizedRowFingerprint,
  collapseWhitespace,
  formatRowNumberList,
  isNumericOnlyIdentifier,
  isValidEmail,
  normalizeEmail,
  normalizeHeader,
  normalizeLookupKey,
  normalizeLooseId,
  parseCsvMatrix,
  splitSuggestionList,
} from "./csvImportShared.js?v=1.0";

const REQUIRED_COLUMNS = ["full_name", "email"];
const OPTIONAL_COLUMNS = [
  "external_staff_id",
  "role_suggestion",
  "department_suggestion",
  "year_group_suggestion",
  "class_scope_suggestion",
  "notes",
];
const SUPPORTED_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
const ALLOWED_ROLE_SUGGESTIONS = new Set([
  "teacher",
  "admin",
  "hoy",
  "hod",
  "senco",
  "literacy_lead",
]);

function normalizeName(value = "") {
  return collapseWhitespace(value);
}

function normalizeRoleSuggestion(value = "") {
  return collapseWhitespace(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function buildPreviewIssue(severity = "warning", title = "", items = []) {
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!safeItems.length) return null;
  return {
    severity,
    title: String(title || "").trim() || "Review needed",
    count: safeItems.length,
    items: safeItems,
  };
}

function buildExistingProfileMaps(existingProfiles = []) {
  const byEmail = new Map();
  const byExternalId = new Map();

  for (const profile of Array.isArray(existingProfiles) ? existingProfiles : []) {
    const safeEmail = normalizeEmail(profile?.email);
    if (safeEmail) {
      const next = byEmail.get(safeEmail) || [];
      next.push(profile);
      byEmail.set(safeEmail, next);
    }

    const safeExternalId = normalizeLookupKey(profile?.external_staff_id);
    if (safeExternalId) {
      const next = byExternalId.get(safeExternalId) || [];
      next.push(profile);
      byExternalId.set(safeExternalId, next);
    }
  }

  return { byEmail, byExternalId };
}

function buildClassLookup(classRecords = []) {
  const byLookupKey = new Map();

  for (const record of Array.isArray(classRecords) ? classRecords : []) {
    const classId = String(record?.id || "").trim();
    const className = collapseWhitespace(record?.name || "");
    const yearGroup = collapseWhitespace(record?.year_group || "");
    const classType = collapseWhitespace(record?.class_type || "");
    const labelParts = [className, yearGroup, classType].filter(Boolean);
    const keys = new Set([
      classId,
      normalizeLookupKey(className),
      normalizeLookupKey(labelParts.join(" - ")),
      normalizeLookupKey(labelParts.join(" | ")),
    ]);
    for (const key of keys) {
      if (!key) continue;
      const next = byLookupKey.get(key) || [];
      next.push(record);
      byLookupKey.set(key, next);
    }
  }

  return byLookupKey;
}

function buildActiveRolesByUserIdMap(roleAssignments = []) {
  const byUserId = new Map();
  for (const row of Array.isArray(roleAssignments) ? roleAssignments : []) {
    const userId = String(row?.user_id || "").trim();
    const role = normalizeRoleSuggestion(row?.role || "");
    if (!userId || !role) continue;
    const next = byUserId.get(userId) || [];
    next.push(role);
    byUserId.set(userId, next);
  }
  for (const [userId, roles] of byUserId.entries()) {
    byUserId.set(userId, [...new Set(roles)].sort((a, b) => a.localeCompare(b)));
  }
  return byUserId;
}

function countRowsWithMessages(rows = [], key = "warnings") {
  return rows.filter((row) => Array.isArray(row?.[key]) && row[key].length > 0).length;
}

function collectDuplicateHeaderNames(headers = []) {
  const counts = new Map();
  for (const header of Array.isArray(headers) ? headers : []) {
    if (!header) continue;
    counts.set(header, (counts.get(header) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([header]) => header)
    .sort((a, b) => a.localeCompare(b));
}

function pushIssue(messages = [], codes = [], code = "", message = "") {
  const safeMessage = String(message || "").trim();
  if (!safeMessage) return;
  messages.push(safeMessage);
  if (code) {
    codes.push(String(code || "").trim());
  }
}

function formatRowDisplay(row = null) {
  const fullName = String(row?.full_name || "").trim() || "Unnamed staff member";
  const email = String(row?.email || "").trim();
  return email ? `${fullName} (${email})` : fullName;
}

function buildFileIssueGroups({
  duplicateRows = new Map(),
  duplicateEmails = new Map(),
  duplicateExternalIds = new Map(),
  numericExternalIdRows = [],
  unknownColumns = [],
  previewRows = [],
} = {}) {
  const duplicateRowItems = [...duplicateRows.entries()]
    .map(([, rowNumbers]) => `Rows ${formatRowNumberList(rowNumbers)} are duplicates after normalization. Keep one copy.`)
    .sort((a, b) => a.localeCompare(b));
  const duplicateKeyItems = [
    ...[...duplicateEmails.entries()].map(([value, rowNumbers]) => `Email "${value}" appears in rows ${formatRowNumberList(rowNumbers)}.`),
    ...[...duplicateExternalIds.entries()].map(([value, rowNumbers]) => `External staff ID "${value}" appears in rows ${formatRowNumberList(rowNumbers)}.`),
  ].sort((a, b) => a.localeCompare(b));
  const numericIdItems = [...new Set(
    (Array.isArray(numericExternalIdRows) ? numericExternalIdRows : [])
      .map((row) => Number(row?.rowNumber || row?.row_number || 0) || 0)
      .filter((value) => value > 0)
  )]
    .sort((a, b) => a - b)
    .map((rowNumber) => `Row ${rowNumber} has a numeric-only external_staff_id. If leading zeros matter, export IDs as text.`);
  const ambiguousRows = (Array.isArray(previewRows) ? previewRows : [])
    .filter((row) => Array.isArray(row?.error_codes) && row.error_codes.some((code) => (
      code === "multiple_email_matches"
      || code === "multiple_external_id_matches"
      || code === "identity_key_conflict"
    )))
    .map((row) => `${formatRowDisplay(row)} needs review because the CSV keys do not map cleanly to one existing staff record.`);

  return [
    buildPreviewIssue("error", "Duplicate rows in this CSV", duplicateRowItems),
    buildPreviewIssue("error", "Duplicate staff keys in this CSV", duplicateKeyItems),
    buildPreviewIssue("error", "Ambiguous existing staff matches", ambiguousRows),
    buildPreviewIssue("warning", "Numeric-only staff IDs to double-check", numericIdItems),
    buildPreviewIssue(
      "warning",
      "Ignored extra columns",
      Array.isArray(unknownColumns) && unknownColumns.length
        ? [`These columns are not used by staff import: ${unknownColumns.join(", ")}`]
        : []
    ),
  ].filter(Boolean);
}

export function parseStaffImportCsv(text = "") {
  const matrix = parseCsvMatrix(String(text || ""));
  if (!matrix.length) {
    return {
      columns: [],
      rows: [],
      errors: ["The CSV file is empty."],
      unknownColumns: [],
      duplicateHeaders: [],
    };
  }

  const normalizedHeaders = matrix[0].map((value) => normalizeHeader(value));
  const duplicateHeaders = collectDuplicateHeaderNames(normalizedHeaders);
  const missingRequiredColumns = REQUIRED_COLUMNS.filter((column) => !normalizedHeaders.includes(column));
  const unknownColumns = normalizedHeaders.filter((column) => column && !SUPPORTED_COLUMNS.includes(column));
  const firstIndexByHeader = new Map();
  const effectiveHeaders = normalizedHeaders.map((header) => {
    if (!header) return "";
    if (firstIndexByHeader.has(header)) return "";
    firstIndexByHeader.set(header, true);
    return header;
  });

  const rows = matrix.slice(1).map((cells, rowIndex) => {
    const raw = {};
    effectiveHeaders.forEach((header, columnIndex) => {
      if (!header) return;
      raw[header] = String(cells[columnIndex] || "");
    });
    return {
      rowNumber: rowIndex + 2,
      raw,
    };
  });

  const errors = [];
  if (!normalizedHeaders.length || normalizedHeaders.every((header) => !header)) {
    errors.push("The CSV header row could not be read.");
  }
  if (missingRequiredColumns.length) {
    errors.push(`Missing required column${missingRequiredColumns.length === 1 ? "" : "s"}: ${missingRequiredColumns.join(", ")}`);
  }
  if (duplicateHeaders.length) {
    errors.push(`Duplicate column header${duplicateHeaders.length === 1 ? "" : "s"} after normalization: ${duplicateHeaders.join(", ")}`);
  }

  return {
    columns: effectiveHeaders.filter(Boolean),
    rows,
    errors,
    unknownColumns,
    duplicateHeaders,
  };
}

export function buildStaffImportPreview({
  parsedCsv = null,
  existingProfiles = [],
  activeRoleAssignments = [],
  yearGroupOptions = [],
  departmentOptions = [],
  classRecords = [],
} = {}) {
  const parsed = parsedCsv && typeof parsedCsv === "object"
    ? parsedCsv
    : { columns: [], rows: [], errors: [], unknownColumns: [], duplicateHeaders: [] };
  const previewErrors = Array.isArray(parsed?.errors) ? [...parsed.errors] : [];
  const existingProfileMaps = buildExistingProfileMaps(existingProfiles);
  const activeRolesByUserId = buildActiveRolesByUserIdMap(activeRoleAssignments);
  const classLookup = buildClassLookup(classRecords);
  const knownYearGroups = new Set((Array.isArray(yearGroupOptions) ? yearGroupOptions : []).map((item) => normalizeLookupKey(item)));
  const knownDepartments = new Set((Array.isArray(departmentOptions) ? departmentOptions : []).map((item) => normalizeLookupKey(item)));

  const duplicateEmails = buildDuplicateValueMap(parsed?.rows, (row) => normalizeEmail(row?.raw?.email));
  const duplicateExternalIds = buildDuplicateValueMap(parsed?.rows, (row) => normalizeLookupKey(row?.raw?.external_staff_id));
  const duplicateRows = buildDuplicateValueMap(parsed?.rows, (row) => buildNormalizedRowFingerprint(row?.raw, parsed?.columns));
  const numericExternalIdRows = (Array.isArray(parsed?.rows) ? parsed.rows : []).filter((row) => isNumericOnlyIdentifier(row?.raw?.external_staff_id));

  const previewRows = (Array.isArray(parsed?.rows) ? parsed.rows : []).map((row) => {
    const warnings = [];
    const errors = [];
    const warningCodes = [];
    const errorCodes = [];
    const fullName = normalizeName(row?.raw?.full_name);
    const email = normalizeEmail(row?.raw?.email);
    const externalStaffId = normalizeLooseId(row?.raw?.external_staff_id);
    const notes = collapseWhitespace(row?.raw?.notes);
    const roleSuggestionRaw = collapseWhitespace(row?.raw?.role_suggestion);
    const normalizedRoleSuggestion = normalizeRoleSuggestion(roleSuggestionRaw);
    const departmentSuggestionValues = splitSuggestionList(row?.raw?.department_suggestion);
    const yearGroupSuggestionValues = splitSuggestionList(row?.raw?.year_group_suggestion);
    const classSuggestionValues = splitSuggestionList(row?.raw?.class_scope_suggestion);
    const existingByEmail = email ? (existingProfileMaps.byEmail.get(email) || []) : [];
    const existingByExternalId = externalStaffId
      ? (existingProfileMaps.byExternalId.get(normalizeLookupKey(externalStaffId)) || [])
      : [];
    const rowFingerprint = buildNormalizedRowFingerprint(row?.raw, parsed?.columns);
    const rowNumberLabel = Number(row?.rowNumber || 0) || 0;

    if (!fullName) pushIssue(errors, errorCodes, "missing_full_name", "Missing full_name.");
    if (!email) pushIssue(errors, errorCodes, "missing_email", "Missing email.");
    else if (!isValidEmail(email)) pushIssue(errors, errorCodes, "invalid_email", "Invalid email format.");

    if (rowFingerprint && duplicateRows.has(rowFingerprint)) {
      pushIssue(
        errors,
        errorCodes,
        "duplicate_row",
        `This row is duplicated in the CSV (rows ${formatRowNumberList(duplicateRows.get(rowFingerprint))}). Keep one copy.`
      );
    }

    if (email && duplicateEmails.has(email)) {
      pushIssue(
        errors,
        errorCodes,
        "duplicate_email_in_file",
        `Email "${email}" appears more than once in this CSV (rows ${formatRowNumberList(duplicateEmails.get(email))}).`
      );
    }

    if (externalStaffId && duplicateExternalIds.has(normalizeLookupKey(externalStaffId))) {
      pushIssue(
        errors,
        errorCodes,
        "duplicate_external_id_in_file",
        `External staff ID "${externalStaffId}" appears more than once in this CSV (rows ${formatRowNumberList(duplicateExternalIds.get(normalizeLookupKey(externalStaffId)))}).`
      );
    }

    if (externalStaffId && isNumericOnlyIdentifier(externalStaffId)) {
      pushIssue(
        warnings,
        warningCodes,
        "numeric_external_id",
        "external_staff_id is numeric-only. If leading zeros matter in your HR export, double-check that this column was exported as text."
      );
    }

    let matchedProfile = null;
    let matchedBy = "";

    if (existingByEmail.length > 1) {
      pushIssue(errors, errorCodes, "multiple_email_matches", "Multiple existing staff records match this email.");
    } else if (existingByEmail.length === 1) {
      matchedProfile = existingByEmail[0];
      matchedBy = "email";
    }

    if (!matchedProfile && externalStaffId) {
      if (existingByExternalId.length > 1) {
        pushIssue(errors, errorCodes, "multiple_external_id_matches", "Multiple existing staff records match this external staff ID.");
      } else if (existingByExternalId.length === 1) {
        matchedProfile = existingByExternalId[0];
        matchedBy = "external_staff_id";
      }
    }

    if (
      existingByEmail.length === 1
      && existingByExternalId.length === 1
      && String(existingByEmail[0]?.id || "") !== String(existingByExternalId[0]?.id || "")
    ) {
      pushIssue(errors, errorCodes, "identity_key_conflict", "Email and external staff ID point to different existing staff records.");
    }

    if (roleSuggestionRaw && !ALLOWED_ROLE_SUGGESTIONS.has(normalizedRoleSuggestion)) {
      pushIssue(warnings, warningCodes, "unknown_role_suggestion", `Role suggestion "${roleSuggestionRaw}" is not recognised.`);
    }

    for (const department of departmentSuggestionValues) {
      if (!knownDepartments.has(normalizeLookupKey(department))) {
        pushIssue(warnings, warningCodes, "unknown_department_suggestion", `Department suggestion "${department}" was not recognised.`);
      }
    }

    for (const yearGroup of yearGroupSuggestionValues) {
      if (!knownYearGroups.has(normalizeLookupKey(yearGroup))) {
        pushIssue(warnings, warningCodes, "unknown_year_group_suggestion", `Year-group suggestion "${yearGroup}" was not recognised.`);
      }
    }

    for (const classSuggestion of classSuggestionValues) {
      const lookupMatches = classLookup.get(normalizeLookupKey(classSuggestion)) || [];
      if (!lookupMatches.length) {
        pushIssue(warnings, warningCodes, "unknown_class_suggestion", `Class suggestion "${classSuggestion}" was not recognised.`);
      }
    }

    const matchedUserId = String(matchedProfile?.user_id || "").trim();
    const activeRoles = matchedUserId ? (activeRolesByUserId.get(matchedUserId) || []) : [];
    if (matchedProfile) {
      pushIssue(
        warnings,
        warningCodes,
        "matched_existing_profile",
        `Existing staff record found by ${matchedBy === "external_staff_id" ? "external staff ID" : "email"}.`
      );
      if (fullName && normalizeLookupKey(fullName) !== normalizeLookupKey(matchedProfile?.display_name)) {
        pushIssue(
          warnings,
          warningCodes,
          "name_change",
          `Imported name differs from the stored name "${collapseWhitespace(matchedProfile?.display_name || "")}".`
        );
      }
      if (roleSuggestionRaw && activeRoles.length && !activeRoles.includes(normalizedRoleSuggestion)) {
        pushIssue(
          warnings,
          warningCodes,
          "active_role_differs",
          `Suggested role "${roleSuggestionRaw}" differs from current active access.`
        );
      }
      if (activeRoles.length) {
        pushIssue(
          warnings,
          warningCodes,
          "live_access_unchanged",
          `Existing live access will stay unchanged (${activeRoles.map((role) => role.replaceAll("_", " ")).join(", ")}).`
        );
      }
    }

    const safeUpdates = [];
    if (!matchedProfile) {
      safeUpdates.push("Create pending staff directory record");
    } else {
      if (fullName && normalizeLookupKey(fullName) !== normalizeLookupKey(matchedProfile?.display_name)) {
        safeUpdates.push("Update display name");
      }
      if (externalStaffId && normalizeLookupKey(externalStaffId) !== normalizeLookupKey(matchedProfile?.external_staff_id)) {
        safeUpdates.push("Store external staff ID");
      }
      if (notes && collapseWhitespace(notes) !== collapseWhitespace(matchedProfile?.notes)) {
        safeUpdates.push("Update notes");
      }
      if (
        roleSuggestionRaw
        || departmentSuggestionValues.length
        || yearGroupSuggestionValues.length
        || classSuggestionValues.length
      ) {
        safeUpdates.push("Refresh import suggestions");
      }
    }

    let action = "create";
    let actionLabel = "Create pending staff";
    if (errors.length) {
      action = "error";
      actionLabel = "Fix before import";
    } else if (matchedProfile) {
      if (safeUpdates.length) {
        action = "update";
        actionLabel = "Update directory only";
      } else {
        action = "skip";
        actionLabel = "Skip unchanged row";
      }
    }

    if (!matchedProfile && !safeUpdates.length) {
      safeUpdates.push("Create pending staff directory record");
    }

    return {
      rowNumber: rowNumberLabel,
      full_name: fullName,
      display_name: fullName || "Unnamed staff member",
      email,
      external_staff_id: externalStaffId,
      notes,
      role_suggestion: roleSuggestionRaw,
      normalized_role_suggestion: normalizedRoleSuggestion,
      department_suggestion_values: departmentSuggestionValues,
      year_group_suggestion_values: yearGroupSuggestionValues,
      class_scope_suggestion_values: classSuggestionValues,
      matched_profile_id: String(matchedProfile?.id || "").trim(),
      matched_user_id: matchedUserId,
      matched_display_name: collapseWhitespace(matchedProfile?.display_name || ""),
      matched_email: normalizeEmail(matchedProfile?.email || ""),
      matched_by: matchedBy,
      active_roles: activeRoles,
      action,
      action_label: actionLabel,
      safe_updates: safeUpdates,
      warnings,
      warning_codes: warningCodes,
      errors,
      error_codes: errorCodes,
      can_commit: action === "create" || action === "update",
      raw_row: { ...(row?.raw || {}) },
    };
  });

  const preflight = {
    issue_groups: buildFileIssueGroups({
      duplicateRows,
      duplicateEmails,
      duplicateExternalIds,
      numericExternalIdRows,
      unknownColumns: parsed?.unknownColumns || [],
      previewRows,
    }),
  };

  const summary = {
    total_rows: previewRows.length,
    safe_count: previewRows.filter((row) => row.can_commit).length,
    created_count: previewRows.filter((row) => row.action === "create").length,
    updated_count: previewRows.filter((row) => row.action === "update").length,
    skipped_count: previewRows.filter((row) => row.action === "skip").length,
    warning_count: countRowsWithMessages(previewRows, "warnings"),
    error_count: countRowsWithMessages(previewRows, "errors") + previewErrors.length,
  };

  return {
    columns: parsed?.columns || [],
    unknownColumns: Array.isArray(parsed?.unknownColumns) ? parsed.unknownColumns : [],
    duplicateHeaders: Array.isArray(parsed?.duplicateHeaders) ? parsed.duplicateHeaders : [],
    errors: previewErrors,
    rows: previewRows,
    summary,
    preflight,
    canCommit: !previewErrors.length && previewRows.some((row) => row.can_commit),
  };
}

export function buildStaffImportCommitPayload(preview = null) {
  const previewRows = Array.isArray(preview?.rows) ? preview.rows : [];
  return previewRows
    .filter((row) => row?.can_commit)
    .map((row) => ({
      full_name: row?.full_name || "",
      email: row?.email || "",
      external_staff_id: row?.external_staff_id || null,
      notes: row?.notes || null,
      role_suggestion: row?.role_suggestion || null,
      department_suggestion_values: row?.department_suggestion_values || [],
      year_group_suggestion_values: row?.year_group_suggestion_values || [],
      class_scope_suggestion_values: row?.class_scope_suggestion_values || [],
      matched_profile_id: row?.matched_profile_id || null,
      matched_user_id: row?.matched_user_id || null,
      matched_by: row?.matched_by || null,
      final_action: row?.action || "skip",
      warnings: Array.isArray(row?.warnings) ? row.warnings : [],
      errors: Array.isArray(row?.errors) ? row.errors : [],
    }));
}

export function getStaffImportRequiredColumns() {
  return [...REQUIRED_COLUMNS];
}

export function getStaffImportOptionalColumns() {
  return [...OPTIONAL_COLUMNS];
}

export function getStaffImportSupportedColumns() {
  return [...SUPPORTED_COLUMNS];
}
