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

function normalizeHeader(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function collapseWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value = "") {
  return collapseWhitespace(value).toLowerCase();
}

function normalizeName(value = "") {
  return collapseWhitespace(value);
}

function normalizeLooseId(value = "") {
  return collapseWhitespace(value);
}

function normalizeRoleSuggestion(value = "") {
  return collapseWhitespace(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeLookupKey(value = "") {
  return collapseWhitespace(value).toLowerCase();
}

function splitSuggestionList(value = "") {
  const safeValue = String(value || "").trim();
  if (!safeValue) return [];
  return [...new Set(
    safeValue
      .split(/[;\n|]+/g)
      .map((item) => collapseWhitespace(item))
      .filter(Boolean)
  )];
}

function isValidEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function parseCsvMatrix(text = "") {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (!insideQuotes && (character === "\n" || character === "\r")) {
      currentRow.push(currentCell);
      currentCell = "";
      const isMeaningfulRow = currentRow.some((cell) => String(cell || "").length > 0);
      if (isMeaningfulRow) {
        rows.push(currentRow);
      }
      currentRow = [];
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => String(cell || "").length > 0)) {
    rows.push(currentRow);
  }

  return rows;
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

export function parseStaffImportCsv(text = "") {
  const matrix = parseCsvMatrix(String(text || ""));
  if (!matrix.length) {
    return {
      columns: [],
      rows: [],
      errors: ["The CSV file is empty."],
    };
  }

  const rawHeaders = matrix[0].map((value) => normalizeHeader(value));
  const missingRequiredColumns = REQUIRED_COLUMNS.filter((column) => !rawHeaders.includes(column));
  const unknownColumns = rawHeaders.filter((column) => column && !SUPPORTED_COLUMNS.includes(column));

  const rows = matrix.slice(1).map((cells, rowIndex) => {
    const row = {};
    rawHeaders.forEach((header, columnIndex) => {
      if (!header) return;
      row[header] = String(cells[columnIndex] || "");
    });
    return {
      rowNumber: rowIndex + 2,
      raw: row,
    };
  });

  const errors = [];
  if (missingRequiredColumns.length) {
    errors.push(`Missing required column${missingRequiredColumns.length === 1 ? "" : "s"}: ${missingRequiredColumns.join(", ")}`);
  }
  if (!rawHeaders.length || rawHeaders.every((header) => !header)) {
    errors.push("The CSV header row could not be read.");
  }

  return {
    columns: rawHeaders,
    rows,
    errors,
    unknownColumns,
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
  const parsed = parsedCsv && typeof parsedCsv === "object" ? parsedCsv : { columns: [], rows: [], errors: [] };
  const previewErrors = Array.isArray(parsed?.errors) ? [...parsed.errors] : [];
  const existingProfileMaps = buildExistingProfileMaps(existingProfiles);
  const activeRolesByUserId = buildActiveRolesByUserIdMap(activeRoleAssignments);
  const classLookup = buildClassLookup(classRecords);
  const knownYearGroups = new Set((Array.isArray(yearGroupOptions) ? yearGroupOptions : []).map((item) => normalizeLookupKey(item)));
  const knownDepartments = new Set((Array.isArray(departmentOptions) ? departmentOptions : []).map((item) => normalizeLookupKey(item)));
  const duplicateEmails = new Map();
  const duplicateExternalIds = new Map();

  for (const row of Array.isArray(parsed?.rows) ? parsed.rows : []) {
    const email = normalizeEmail(row?.raw?.email);
    const externalStaffId = normalizeLookupKey(row?.raw?.external_staff_id);
    if (email) duplicateEmails.set(email, (duplicateEmails.get(email) || 0) + 1);
    if (externalStaffId) duplicateExternalIds.set(externalStaffId, (duplicateExternalIds.get(externalStaffId) || 0) + 1);
  }

  const previewRows = (Array.isArray(parsed?.rows) ? parsed.rows : []).map((row) => {
    const warnings = [];
    const errors = [];
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

    if (!fullName) errors.push("Missing full_name.");
    if (!email) errors.push("Missing email.");
    else if (!isValidEmail(email)) errors.push("Invalid email format.");
    if (email && (duplicateEmails.get(email) || 0) > 1) {
      errors.push("Duplicate email appears more than once in this CSV.");
    }
    if (externalStaffId && (duplicateExternalIds.get(normalizeLookupKey(externalStaffId)) || 0) > 1) {
      errors.push("Duplicate external staff ID appears more than once in this CSV.");
    }

    let matchedProfile = null;
    let matchedBy = "";

    if (existingByEmail.length > 1) {
      errors.push("Multiple existing staff records match this email.");
    } else if (existingByEmail.length === 1) {
      matchedProfile = existingByEmail[0];
      matchedBy = "email";
    }

    if (!matchedProfile && externalStaffId) {
      if (existingByExternalId.length > 1) {
        errors.push("Multiple existing staff records match this external staff ID.");
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
      errors.push("Email and external staff ID point to different existing staff records.");
    }

    if (roleSuggestionRaw && !ALLOWED_ROLE_SUGGESTIONS.has(normalizedRoleSuggestion)) {
      warnings.push(`Role suggestion "${roleSuggestionRaw}" is not recognised.`);
    }

    for (const department of departmentSuggestionValues) {
      if (!knownDepartments.has(normalizeLookupKey(department))) {
        warnings.push(`Department suggestion "${department}" was not recognised.`);
      }
    }

    for (const yearGroup of yearGroupSuggestionValues) {
      if (!knownYearGroups.has(normalizeLookupKey(yearGroup))) {
        warnings.push(`Year-group suggestion "${yearGroup}" was not recognised.`);
      }
    }

    for (const classSuggestion of classSuggestionValues) {
      const lookupMatches = classLookup.get(normalizeLookupKey(classSuggestion)) || [];
      if (!lookupMatches.length) {
        warnings.push(`Class suggestion "${classSuggestion}" was not recognised.`);
      }
    }

    const matchedUserId = String(matchedProfile?.user_id || "").trim();
    const activeRoles = matchedUserId ? (activeRolesByUserId.get(matchedUserId) || []) : [];
    if (matchedProfile) {
      warnings.push(`Existing staff record found by ${matchedBy === "external_staff_id" ? "external staff ID" : "email"}.`);
      if (fullName && normalizeLookupKey(fullName) !== normalizeLookupKey(matchedProfile?.display_name)) {
        warnings.push(`Imported name differs from the stored name "${collapseWhitespace(matchedProfile?.display_name || "")}".`);
      }
      if (roleSuggestionRaw && activeRoles.length && !activeRoles.includes(normalizedRoleSuggestion)) {
        warnings.push(`Suggested role "${roleSuggestionRaw}" differs from current active access.`);
      }
      if (activeRoles.length) {
        warnings.push(`Existing live access will stay unchanged (${activeRoles.map((role) => role.replaceAll("_", " ")).join(", ")}).`);
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
      rowNumber: row?.rowNumber,
      full_name: fullName,
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
      errors,
      can_commit: action === "create" || action === "update",
    };
  });

  const summary = {
    total_rows: previewRows.length,
    created_count: previewRows.filter((row) => row.action === "create").length,
    updated_count: previewRows.filter((row) => row.action === "update").length,
    skipped_count: previewRows.filter((row) => row.action === "skip").length,
    warning_count: countRowsWithMessages(previewRows, "warnings"),
    error_count: countRowsWithMessages(previewRows, "errors") + previewErrors.length,
  };

  return {
    columns: parsed?.columns || [],
    unknownColumns: Array.isArray(parsed?.unknownColumns) ? parsed.unknownColumns : [],
    errors: previewErrors,
    rows: previewRows,
    summary,
    canCommit: !previewErrors.length && previewRows.some((row) => row.can_commit),
  };
}

export function buildStaffImportCommitPayload(preview = null) {
  const previewRows = Array.isArray(preview?.rows) ? preview.rows : [];
  return previewRows.map((row) => ({
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
