import {
  buildDuplicateValueMap,
  buildNormalizedRowFingerprint,
  collapseWhitespace,
  formatRowNumberList,
  isNumericOnlyIdentifier,
  normalizeGroupLookupKey,
  normalizeHeader,
  normalizeLookupKey,
  parseCsvMatrix,
} from "./csvImportShared.js?v=1.0";

const REQUIRED_COLUMNS = ["mis_id", "first_name", "surname", "form_class"];
const OPTIONAL_COLUMNS = ["year_group", "pp", "sen", "gender"];
const SUPPORTED_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
const FORM_CLASS_TYPE = "form";
const SUBGROUP_FIELDS = ["pp", "sen", "gender"];

function countRowsWithMessages(rows = [], key = "warnings") {
  return rows.filter((row) => Array.isArray(row?.[key]) && row[key].length > 0).length;
}

function formatCountLabel(value = 0, singular = "row", plural = `${singular}s`) {
  const count = Number(value || 0);
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildRowPrefix(rowNumber = 0, firstName = "", surname = "") {
  const safeRowNumber = Math.max(1, Number(rowNumber) || 1);
  const displayName = [collapseWhitespace(firstName), collapseWhitespace(surname)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return displayName
    ? `Row ${safeRowNumber} - ${displayName}:`
    : `Row ${safeRowNumber}:`;
}

function buildRowMessage(rowNumber = 0, firstName = "", surname = "", message = "") {
  const safeMessage = String(message || "").trim();
  if (!safeMessage) return "";
  return `${buildRowPrefix(rowNumber, firstName, surname)} ${safeMessage}`;
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

function normalizeClassType(value = "") {
  return String(value || "").trim().toLowerCase() || FORM_CLASS_TYPE;
}

function getClassLabel(record = null) {
  const className = collapseWhitespace(record?.name || "");
  const yearGroup = collapseWhitespace(record?.year_group || "");
  if (className && yearGroup) return `${className} (${yearGroup})`;
  return className || "Unnamed form class";
}

function pushIssue(messages = [], codes = [], code = "", message = "") {
  const safeMessage = String(message || "").trim();
  if (!safeMessage) return;
  messages.push(safeMessage);
  if (code) {
    codes.push(String(code || "").trim());
  }
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

function formatPupilRowDisplay(row = null) {
  const displayName = String(row?.display_name || "").trim() || "Unnamed pupil";
  const misId = String(row?.mis_id || "").trim();
  return misId ? `${displayName} (${misId})` : displayName;
}

function buildExistingPupilMap(existingPupils = []) {
  const byMisId = new Map();
  for (const pupil of Array.isArray(existingPupils) ? existingPupils : []) {
    const normalizedMisId = normalizeLookupKey(pupil?.mis_id);
    if (!normalizedMisId) continue;
    const next = byMisId.get(normalizedMisId) || [];
    next.push({
      id: String(pupil?.id || "").trim(),
      mis_id: collapseWhitespace(pupil?.mis_id || ""),
      first_name: collapseWhitespace(pupil?.first_name || ""),
      surname: collapseWhitespace(pupil?.surname || ""),
      username: collapseWhitespace(pupil?.username || ""),
      is_active: pupil?.is_active !== false,
    });
    byMisId.set(normalizedMisId, next);
  }
  return byMisId;
}

function buildFormMembershipMap(formMemberships = [], classRecords = []) {
  const classById = new Map(
    (Array.isArray(classRecords) ? classRecords : [])
      .map((item) => [
        String(item?.id || "").trim(),
        {
          id: String(item?.id || "").trim(),
          name: collapseWhitespace(item?.name || ""),
          year_group: collapseWhitespace(item?.year_group || ""),
          class_type: normalizeClassType(item?.class_type),
        },
      ])
      .filter(([classId]) => !!classId)
  );

  const byPupilId = new Map();
  for (const membership of Array.isArray(formMemberships) ? formMemberships : []) {
    const pupilId = String(membership?.pupil_id || "").trim();
    const classId = String(membership?.class_id || "").trim();
    const classRecord = classById.get(classId);
    if (!pupilId || !classId || !classRecord) continue;
    if (classRecord.class_type !== FORM_CLASS_TYPE) continue;
    const next = byPupilId.get(pupilId) || [];
    next.push({
      id: String(membership?.id || "").trim(),
      pupil_id: pupilId,
      class_id: classId,
      active: membership?.active !== false,
      class_name: classRecord.name,
      class_year_group: classRecord.year_group,
      class_label: getClassLabel(classRecord),
    });
    byPupilId.set(pupilId, next);
  }

  return byPupilId;
}

function buildClassLookupPairKey(className = "", yearGroup = "") {
  const normalizedClassName = normalizeLookupKey(className);
  const normalizedYearGroup = normalizeLookupKey(yearGroup);
  return `${normalizedClassName}::${normalizedYearGroup}`;
}

function normalizeClassRecord(record = null) {
  return {
    ...record,
    id: String(record?.id || "").trim(),
    name: collapseWhitespace(record?.name || ""),
    year_group: collapseWhitespace(record?.year_group || ""),
    class_type: normalizeClassType(record?.class_type),
  };
}

function appendLookupRecord(map, key, value) {
  if (!key) return;
  const next = map.get(key) || [];
  next.push(value);
  map.set(key, next);
}

function buildClassLookupIndexes(classRecords = []) {
  const exactMatchesByName = new Map();
  const exactMatchesByPair = new Map();
  const formMatchesByName = new Map();
  const formMatchesByPair = new Map();

  for (const record of Array.isArray(classRecords) ? classRecords : []) {
    const normalizedRecord = normalizeClassRecord(record);
    const nameKey = normalizeLookupKey(normalizedRecord.name);
    const pairKey = buildClassLookupPairKey(normalizedRecord.name, normalizedRecord.year_group);
    if (!nameKey) continue;

    appendLookupRecord(exactMatchesByName, nameKey, normalizedRecord);
    appendLookupRecord(exactMatchesByPair, pairKey, normalizedRecord);

    if (normalizedRecord.class_type === FORM_CLASS_TYPE) {
      appendLookupRecord(formMatchesByName, nameKey, normalizedRecord);
      appendLookupRecord(formMatchesByPair, pairKey, normalizedRecord);
    }
  }

  return {
    exactMatchesByName,
    exactMatchesByPair,
    formMatchesByName,
    formMatchesByPair,
  };
}

function buildPlannedFormClassRecord(formClass = "", yearGroup = "") {
  return {
    id: "",
    name: collapseWhitespace(formClass),
    year_group: collapseWhitespace(yearGroup),
    class_type: FORM_CLASS_TYPE,
    is_new: true,
    planned_key: buildClassLookupPairKey(formClass, yearGroup),
  };
}

function normalizePpGroupValue(value = "") {
  const normalized = normalizeGroupLookupKey(value);
  if (!normalized) return "";
  if (["1", "true", "yes", "y", "pp", "pupil_premium"].includes(normalized)) return "pp";
  if (["0", "false", "no", "n", "non_pp", "not_pp", "nonpp"].includes(normalized)) return "non_pp";
  return null;
}

function normalizeSenGroupValue(value = "") {
  const normalized = normalizeGroupLookupKey(value);
  if (!normalized) return "";
  if (["ehcp", "education_health_care_plan", "ehc_plan"].includes(normalized)) return "ehcp";
  if (["sen_support", "support"].includes(normalized)) return "sen_support";
  if (["sen", "send", "true", "yes", "1"].includes(normalized)) return "sen";
  if (["none"].includes(normalized)) return "none";
  if (["non_sen", "not_sen", "no_sen", "nonsen", "false", "no", "0"].includes(normalized)) return "non_sen";
  return null;
}

function normalizeGenderGroupValue(value = "") {
  const normalized = normalizeGroupLookupKey(value);
  if (!normalized) return "";
  if (["female", "f", "girl", "girls"].includes(normalized)) return "female";
  if (["male", "m", "boy", "boys"].includes(normalized)) return "male";
  if (["non_binary", "nonbinary", "nb"].includes(normalized)) return "non_binary";
  if (["other"].includes(normalized)) return "other";
  return null;
}

function normalizeSubgroupImportValue(field = "", value = "") {
  if (field === "pp") return normalizePpGroupValue(value);
  if (field === "sen") return normalizeSenGroupValue(value);
  if (field === "gender") return normalizeGenderGroupValue(value);
  return "";
}

function getSubgroupFieldLabel(field = "") {
  if (field === "pp") return "PP";
  if (field === "sen") return "SEN";
  if (field === "gender") return "gender";
  return collapseWhitespace(field);
}

function getSubgroupValueLabel(field = "", value = "") {
  if (field === "pp") {
    if (value === "pp") return "PP";
    if (value === "non_pp") return "Non-PP";
  }

  if (field === "sen") {
    if (value === "ehcp") return "EHCP";
    if (value === "sen_support") return "SEN support";
    if (value === "sen") return "SEN";
    if (value === "none") return "No SEN";
    if (value === "non_sen") return "Non-SEN";
  }

  if (field === "gender") {
    if (value === "female") return "Female";
    if (value === "male") return "Male";
    if (value === "non_binary") return "Non-binary";
    if (value === "other") return "Other";
  }

  return collapseWhitespace(value);
}

function buildInvalidSubgroupMessage(field = "", rawValue = "") {
  const safeValue = collapseWhitespace(rawValue);
  if (field === "pp") {
    return `PP value "${safeValue}" is not recognised. Use PP/Yes/1 or Non-PP/No/0.`;
  }
  if (field === "sen") {
    return `SEN value "${safeValue}" is not recognised. Use SEN, SEN support, EHCP, No SEN, or Non-SEN.`;
  }
  if (field === "gender") {
    return `gender value "${safeValue}" is not recognised. Use female, male, non-binary, or other.`;
  }
  return `${getSubgroupFieldLabel(field)} value "${safeValue}" is not recognised.`;
}

function collectSubgroupImportValues({
  rowNumber = 0,
  firstName = "",
  surname = "",
  raw = {},
} = {}) {
  const normalizedValues = {};
  const rawValues = {};
  const updates = [];
  const errors = [];

  for (const field of SUBGROUP_FIELDS) {
    const rawValue = collapseWhitespace(raw?.[field] || "");
    const normalizedValue = normalizeSubgroupImportValue(field, rawValue);
    rawValues[field] = rawValue;
    normalizedValues[field] = normalizedValue || "";

    if (!rawValue) continue;
    if (!normalizedValue) {
      errors.push(buildRowMessage(rowNumber, firstName, surname, buildInvalidSubgroupMessage(field, rawValue)));
      continue;
    }

    updates.push(`Set ${getSubgroupFieldLabel(field)} subgroup to ${getSubgroupValueLabel(field, normalizedValue)}`);
  }

  return {
    rawValues,
    normalizedValues,
    updates,
    errors,
  };
}

function resolveTargetFormClass({
  rowNumber = 0,
  firstName = "",
  surname = "",
  formClass = "",
  yearGroup = "",
  classLookup = buildClassLookupIndexes(),
} = {}) {
  const errors = [];
  const safeFormClass = collapseWhitespace(formClass);
  const safeYearGroup = collapseWhitespace(yearGroup);
  const normalizedFormClass = normalizeLookupKey(safeFormClass);
  const normalizedYearGroup = normalizeLookupKey(safeYearGroup);
  const pairKey = buildClassLookupPairKey(safeFormClass, safeYearGroup);
  const exactMatches = classLookup.exactMatchesByName.get(normalizedFormClass) || [];
  const formMatches = classLookup.formMatchesByName.get(normalizedFormClass) || [];
  const exactPairMatches = normalizedYearGroup ? (classLookup.exactMatchesByPair.get(pairKey) || []) : [];
  const formPairMatches = normalizedYearGroup ? (classLookup.formMatchesByPair.get(pairKey) || []) : [];

  if (!safeFormClass) {
    errors.push(buildRowMessage(rowNumber, firstName, surname, "form class is missing. Add a value in the form_class column, then re-import."));
    return { matchedClass: null, plannedClass: null, willCreate: false, errors };
  }

  if (normalizedYearGroup) {
    if (formPairMatches.length === 1) {
      return { matchedClass: formPairMatches[0], plannedClass: null, willCreate: false, errors };
    }

    if (formPairMatches.length > 1) {
      errors.push(buildRowMessage(rowNumber, firstName, surname, `more than one form class matches "${safeFormClass}". Use the exact form class name.`));
      return { matchedClass: null, plannedClass: null, willCreate: false, errors };
    }

    if (exactPairMatches.length) {
      errors.push(buildRowMessage(rowNumber, firstName, surname, `"${safeFormClass}" is not a form class. Use a form or tutor class instead.`));
      return { matchedClass: null, plannedClass: null, willCreate: false, errors };
    }

    if (!formMatches.length) {
      if (exactMatches.length) {
        errors.push(buildRowMessage(rowNumber, firstName, surname, `"${safeFormClass}" is not a form class. Use a form or tutor class instead.`));
        return { matchedClass: null, plannedClass: null, willCreate: false, errors };
      }

      return {
        matchedClass: null,
        plannedClass: buildPlannedFormClassRecord(safeFormClass, safeYearGroup),
        willCreate: true,
        errors,
      };
    }

    if (formMatches.length === 1) {
      const onlyMatch = formMatches[0];
      const actualYearGroup = collapseWhitespace(onlyMatch?.year_group || "") || "a different year group";
      errors.push(buildRowMessage(rowNumber, firstName, surname, `form class "${safeFormClass}" exists in ${actualYearGroup}, not ${safeYearGroup}. Check the class or year group.`));
      return { matchedClass: null, plannedClass: null, willCreate: false, errors };
    }

    return {
      matchedClass: null,
      plannedClass: buildPlannedFormClassRecord(safeFormClass, safeYearGroup),
      willCreate: true,
      errors,
    };
  }

  if (!formMatches.length) {
    if (exactMatches.length) {
      errors.push(buildRowMessage(rowNumber, firstName, surname, `"${safeFormClass}" is not a form class. Use a form or tutor class instead.`));
    } else {
      errors.push(buildRowMessage(rowNumber, firstName, surname, `form class "${safeFormClass}" was not found. Add year_group so this new form group can be created.`));
    }
    return { matchedClass: null, plannedClass: null, willCreate: false, errors };
  }

  if (formMatches.length > 1) {
    errors.push(buildRowMessage(rowNumber, firstName, surname, `more than one form class matches "${safeFormClass}". Use year_group to pick the right form.`));
    return { matchedClass: null, plannedClass: null, willCreate: false, errors };
  }

  return { matchedClass: formMatches[0], plannedClass: null, willCreate: false, errors };
}

function buildFileIssueGroups({
  duplicateRows = new Map(),
  duplicateMisIds = new Map(),
  numericMisIdRows = [],
  unknownColumns = [],
  previewRows = [],
} = {}) {
  const duplicateRowItems = [...duplicateRows.entries()]
    .map(([, rowNumbers]) => `Rows ${formatRowNumberList(rowNumbers)} are duplicates after normalization. Keep one copy.`)
    .sort((a, b) => a.localeCompare(b));
  const duplicateMisIdItems = [...duplicateMisIds.entries()]
    .map(([value, rowNumbers]) => `MIS ID "${value}" appears in rows ${formatRowNumberList(rowNumbers)}.`)
    .sort((a, b) => a.localeCompare(b));
  const numericMisIdItems = [...new Set(
    (Array.isArray(numericMisIdRows) ? numericMisIdRows : [])
      .map((row) => Number(row?.rowNumber || row?.row_number || 0) || 0)
      .filter((value) => value > 0)
  )]
    .sort((a, b) => a - b)
    .map((rowNumber) => `Row ${rowNumber} has a numeric-only MIS ID. If leading zeros matter, export MIS IDs as text.`);
  const ambiguousRows = (Array.isArray(previewRows) ? previewRows : [])
    .filter((row) => Array.isArray(row?.error_codes) && row.error_codes.includes("multiple_existing_pupil_matches"))
    .map((row) => `${formatPupilRowDisplay(row)} needs review because more than one pupil already uses that MIS ID.`);

  return [
    buildPreviewIssue("error", "Duplicate rows in this CSV", duplicateRowItems),
    buildPreviewIssue("error", "Duplicate MIS IDs in this CSV", duplicateMisIdItems),
    buildPreviewIssue("error", "Ambiguous existing pupil matches", ambiguousRows),
    buildPreviewIssue("warning", "Numeric-only MIS IDs to double-check", numericMisIdItems),
    buildPreviewIssue(
      "warning",
      "Ignored extra columns",
      Array.isArray(unknownColumns) && unknownColumns.length
        ? [`These columns are not used by pupil import: ${unknownColumns.join(", ")}`]
        : []
    ),
  ].filter(Boolean);
}

export function parsePupilImportCsv(text = "") {
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

export function buildPupilImportPreview({
  parsedCsv = null,
  existingPupils = [],
  formMemberships = [],
  classRecords = [],
} = {}) {
  const parsed = parsedCsv && typeof parsedCsv === "object"
    ? parsedCsv
    : { columns: [], rows: [], errors: [], unknownColumns: [], duplicateHeaders: [] };
  const previewErrors = Array.isArray(parsed?.errors) ? [...parsed.errors] : [];
  const existingPupilMap = buildExistingPupilMap(existingPupils);
  const membershipsByPupilId = buildFormMembershipMap(formMemberships, classRecords);
  const classLookup = buildClassLookupIndexes(classRecords);
  const duplicateMisIds = buildDuplicateValueMap(parsed?.rows, (row) => normalizeLookupKey(row?.raw?.mis_id));
  const duplicateRows = buildDuplicateValueMap(parsed?.rows, (row) => buildNormalizedRowFingerprint(row?.raw, parsed?.columns));
  const numericMisIdRows = (Array.isArray(parsed?.rows) ? parsed.rows : []).filter((row) => isNumericOnlyIdentifier(row?.raw?.mis_id));

  const previewRows = (Array.isArray(parsed?.rows) ? parsed.rows : []).map((row) => {
    const rowNumber = Number(row?.rowNumber || 0) || 0;
    const firstName = collapseWhitespace(row?.raw?.first_name || "");
    const surname = collapseWhitespace(row?.raw?.surname || "");
    const misId = collapseWhitespace(row?.raw?.mis_id || "");
    const formClass = collapseWhitespace(row?.raw?.form_class || "");
    const yearGroup = collapseWhitespace(row?.raw?.year_group || "");
    const warnings = [];
    const errors = [];
    const warningCodes = [];
    const errorCodes = [];
    const safeUpdates = [];
    const normalizedMisId = normalizeLookupKey(misId);
    const existingMatches = normalizedMisId ? (existingPupilMap.get(normalizedMisId) || []) : [];
    const subgroupPlan = collectSubgroupImportValues({
      rowNumber,
      firstName,
      surname,
      raw: row?.raw || {},
    });
    const rowFingerprint = buildNormalizedRowFingerprint(row?.raw, parsed?.columns);

    if (!misId) {
      pushIssue(errors, errorCodes, "missing_mis_id", buildRowMessage(rowNumber, firstName, surname, "MIS ID is missing. Add a value in the mis_id column, then re-import."));
    }
    if (!firstName) {
      pushIssue(errors, errorCodes, "missing_first_name", buildRowMessage(rowNumber, firstName, surname, "first name is missing. Add it, then re-import."));
    }
    if (!surname) {
      pushIssue(errors, errorCodes, "missing_surname", buildRowMessage(rowNumber, firstName, surname, "surname is missing. Add it, then re-import."));
    }
    if (rowFingerprint && duplicateRows.has(rowFingerprint)) {
      pushIssue(
        errors,
        errorCodes,
        "duplicate_row",
        buildRowMessage(rowNumber, firstName, surname, `this row is duplicated in the CSV (rows ${formatRowNumberList(duplicateRows.get(rowFingerprint))}). Keep one copy.`)
      );
    }
    if (normalizedMisId && duplicateMisIds.has(normalizedMisId)) {
      pushIssue(
        errors,
        errorCodes,
        "duplicate_mis_id_in_file",
        buildRowMessage(rowNumber, firstName, surname, `MIS ID "${misId}" appears more than once in this CSV (rows ${formatRowNumberList(duplicateMisIds.get(normalizedMisId))}). Keep one row per pupil.`)
      );
    }
    if (misId && isNumericOnlyIdentifier(misId)) {
      pushIssue(
        warnings,
        warningCodes,
        "numeric_mis_id",
        buildRowMessage(rowNumber, firstName, surname, "MIS ID is numeric-only. If leading zeros matter in your MIS export, double-check that this column was exported as text.")
      );
    }
    if (existingMatches.length > 1) {
      pushIssue(
        errors,
        errorCodes,
        "multiple_existing_pupil_matches",
        buildRowMessage(rowNumber, firstName, surname, `more than one pupil already uses MIS ID "${misId}". Review pupil records before importing.`)
      );
    }

    for (const subgroupError of subgroupPlan.errors) {
      pushIssue(errors, errorCodes, "invalid_subgroup_value", subgroupError);
    }

    const { matchedClass, plannedClass, willCreate, errors: classErrors } = resolveTargetFormClass({
      rowNumber,
      firstName,
      surname,
      formClass,
      yearGroup,
      classLookup,
    });
    for (const classError of classErrors) {
      const code = classError.includes("not a form class")
        ? "class_type_mismatch"
        : classError.includes("exists in")
          ? "year_group_mismatch"
          : classError.includes("more than one form class matches")
            ? "ambiguous_form_match"
            : classError.includes("year_group")
              ? "missing_year_group_for_new_form"
              : "invalid_form_reference";
      pushIssue(errors, errorCodes, code, classError);
    }

    const matchedPupil = existingMatches.length === 1 ? existingMatches[0] : null;
    const matchedPupilId = String(matchedPupil?.id || "").trim();
    const formRows = matchedPupilId ? (membershipsByPupilId.get(matchedPupilId) || []) : [];
    const activeFormRows = formRows.filter((item) => item?.active);
    const matchedClassId = String(matchedClass?.id || "").trim();
    const targetMembership = matchedClassId
      ? formRows.find((item) => String(item?.class_id || "") === matchedClassId)
      : null;
    const otherActiveForms = matchedClassId
      ? activeFormRows.filter((item) => String(item?.class_id || "") !== matchedClassId)
      : activeFormRows;
    const nameChanged = !!matchedPupil && (
      normalizeLookupKey(matchedPupil?.first_name) !== normalizeLookupKey(firstName)
      || normalizeLookupKey(matchedPupil?.surname) !== normalizeLookupKey(surname)
    );
    const needsActivation = !!matchedPupil && matchedPupil.is_active === false;
    const targetLabel = matchedClass
      ? getClassLabel(matchedClass)
      : plannedClass
        ? getClassLabel(plannedClass)
        : "";
    const hasSubgroupUpdates = subgroupPlan.updates.length > 0;

    if (matchedPupil && nameChanged) {
      pushIssue(
        warnings,
        warningCodes,
        "name_change",
        buildRowMessage(
          rowNumber,
          firstName,
          surname,
          `stored pupil name is "${[matchedPupil.first_name, matchedPupil.surname].filter(Boolean).join(" ").trim() || matchedPupil.username || "Unknown pupil"}". The import will update it.`
        )
      );
    }

    let action = "create";
    let actionLabel = "Create pupil";

    if (!errors.length) {
      if (willCreate && targetLabel) {
        safeUpdates.push(`Create form class ${targetLabel}`);
      }

      if (!matchedPupil) {
        safeUpdates.push("Create pupil record");
        if (targetLabel) {
          safeUpdates.push(`Add to ${targetLabel}`);
        }
        safeUpdates.push(...subgroupPlan.updates);
      } else {
        if (nameChanged) {
          safeUpdates.push("Update pupil name");
        }
        if (needsActivation) {
          safeUpdates.push("Reactivate pupil");
        }

        const targetMembershipActive = !!targetMembership?.active;
        const hasOtherActiveForms = otherActiveForms.length > 0;
        const hasTargetMembership = !!targetMembership?.id;

        if (hasOtherActiveForms) {
          const previousLabels = otherActiveForms.map((item) => item.class_label).filter(Boolean);
          safeUpdates.push(
            previousLabels.length
              ? `Replace active form membership (${previousLabels.join(", ")} -> ${targetLabel})`
              : `Replace active form membership with ${targetLabel}`
          );
          action = "replace_form";
          actionLabel = "Replace form membership";
        } else if (hasTargetMembership && !targetMembershipActive) {
          safeUpdates.push(`Reactivate form membership for ${targetLabel}`);
          action = "update";
          actionLabel = "Update pupil";
        } else if (!hasTargetMembership) {
          safeUpdates.push(`Add form membership for ${targetLabel}`);
          action = "update";
          actionLabel = "Update pupil";
        }

        if (hasSubgroupUpdates) {
          safeUpdates.push(...subgroupPlan.updates);
        }

        if (action === "create" && (nameChanged || needsActivation || hasSubgroupUpdates || safeUpdates.length)) {
          action = "update";
          actionLabel = "Update pupil";
        }

        if (action === "create" && !safeUpdates.length) {
          action = "skip";
          actionLabel = "Skip unchanged row";
        }
      }
    }

    if (errors.length) {
      action = "error";
      actionLabel = "Fix before import";
    }

    return {
      row_number: rowNumber,
      first_name: firstName,
      surname,
      display_name: [firstName, surname].filter(Boolean).join(" ").trim() || "Unnamed pupil",
      mis_id: misId,
      normalized_mis_id: normalizedMisId,
      form_class: formClass,
      year_group: yearGroup,
      matched_pupil_id: matchedPupilId,
      matched_username: String(matchedPupil?.username || "").trim(),
      matched_is_active: matchedPupil?.is_active !== false,
      current_active_form_labels: activeFormRows.map((item) => item.class_label).filter(Boolean),
      target_form_class_id: matchedClassId,
      target_form_class_label: targetLabel,
      planned_form_class_key: String(plannedClass?.planned_key || ""),
      will_create_form_class: !!willCreate,
      pp: subgroupPlan.rawValues.pp || "",
      sen: subgroupPlan.rawValues.sen || "",
      gender: subgroupPlan.rawValues.gender || "",
      normalized_pp: subgroupPlan.normalizedValues.pp || "",
      normalized_sen: subgroupPlan.normalizedValues.sen || "",
      normalized_gender: subgroupPlan.normalizedValues.gender || "",
      action,
      action_label: actionLabel,
      safe_updates: safeUpdates,
      warnings,
      warning_codes: warningCodes,
      errors,
      error_codes: errorCodes,
      can_commit: action === "create" || action === "update" || action === "replace_form",
      raw_row: { ...(row?.raw || {}) },
    };
  });

  const formClassesToCreate = [...new Map(
    previewRows
      .filter((row) => row?.can_commit && row?.will_create_form_class && row?.planned_form_class_key)
      .map((row) => [
        row.planned_form_class_key,
        {
          key: row.planned_form_class_key,
          name: row.form_class,
          year_group: row.year_group,
          label: row.target_form_class_label,
        },
      ])
  ).values()];

  const preflight = {
    issue_groups: buildFileIssueGroups({
      duplicateRows,
      duplicateMisIds,
      numericMisIdRows,
      unknownColumns: parsed?.unknownColumns || [],
      previewRows,
    }),
  };

  const summary = {
    total_rows: previewRows.length,
    safe_count: previewRows.filter((row) => row.can_commit).length,
    created_count: previewRows.filter((row) => row.action === "create").length,
    updated_count: previewRows.filter((row) => row.action === "update").length,
    replace_count: previewRows.filter((row) => row.action === "replace_form").length,
    skipped_count: previewRows.filter((row) => row.action === "skip").length,
    warning_count: countRowsWithMessages(previewRows, "warnings"),
    error_count: countRowsWithMessages(previewRows, "errors") + previewErrors.length,
    form_class_create_count: formClassesToCreate.length,
  };

  return {
    columns: parsed?.columns || [],
    unknownColumns: Array.isArray(parsed?.unknownColumns) ? parsed.unknownColumns : [],
    duplicateHeaders: Array.isArray(parsed?.duplicateHeaders) ? parsed.duplicateHeaders : [],
    errors: previewErrors,
    rows: previewRows,
    summary,
    preflight,
    form_classes_to_create: formClassesToCreate,
    canCommit: !previewErrors.length && previewRows.some((row) => row.can_commit),
  };
}

export function buildPupilImportCommitPayload(preview = null) {
  const previewRows = Array.isArray(preview?.rows) ? preview.rows : [];
  return previewRows
    .filter((row) => row?.can_commit)
    .map((row) => ({
      row_number: Number(row?.row_number || 0) || null,
      mis_id: row?.mis_id || "",
      first_name: row?.first_name || "",
      surname: row?.surname || "",
      form_class: row?.form_class || "",
      year_group: row?.year_group || null,
      pp: row?.normalized_pp || null,
      sen: row?.normalized_sen || null,
      gender: row?.normalized_gender || null,
      final_action: row?.action || "skip",
    }));
}

export function getPupilImportRequiredColumns() {
  return [...REQUIRED_COLUMNS];
}

export function getPupilImportOptionalColumns() {
  return [...OPTIONAL_COLUMNS];
}

export function getPupilImportSupportedColumns() {
  return [...SUPPORTED_COLUMNS];
}

export function getPupilImportSummaryLabels(summary = {}) {
  return [
    formatCountLabel(summary?.created_count || 0, "new pupil"),
    formatCountLabel(summary?.updated_count || 0, "update"),
    formatCountLabel(summary?.replace_count || 0, "form move"),
    formatCountLabel(summary?.form_class_create_count || 0, "form class", "form classes"),
    formatCountLabel(summary?.skipped_count || 0, "skip"),
    formatCountLabel(summary?.warning_count || 0, "warning"),
    formatCountLabel(summary?.error_count || 0, "error"),
  ];
}
