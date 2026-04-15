import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildStaffImportCommitPayload,
  buildStaffImportPreview,
  parseStaffImportCsv,
} = await loadBrowserModule("../js/staffCsvImport.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function buildPreview(csvText, {
  existingProfiles = [],
  activeRoleAssignments = [],
  yearGroupOptions = ["Year 7", "Year 8"],
  departmentOptions = ["English", "Science"],
  classRecords = [{ id: "class-1", name: "7A Tutor - North", year_group: "Year 7", class_type: "form" }],
} = {}) {
  return buildStaffImportPreview({
    parsedCsv: parseStaffImportCsv(csvText),
    existingProfiles,
    activeRoleAssignments,
    yearGroupOptions,
    departmentOptions,
    classRecords,
  });
}

function normalizeForAssert(value) {
  return JSON.parse(JSON.stringify(value));
}

test("new staff rows are classified as creates and included in the commit payload", () => {
  const preview = buildPreview(`full_name,email,external_staff_id,role_suggestion
Alex Carter,Alex.Carter@School.test,STA-100,Teacher`);

  assert.equal(preview.rows[0].action, "create");
  assert.equal(preview.canCommit, true);
  assert.deepEqual(normalizeForAssert(buildStaffImportCommitPayload(preview)), [
    {
      full_name: "Alex Carter",
      email: "alex.carter@school.test",
      external_staff_id: "STA-100",
      notes: null,
      role_suggestion: "Teacher",
      department_suggestion_values: [],
      year_group_suggestion_values: [],
      class_scope_suggestion_values: [],
      matched_profile_id: null,
      matched_user_id: null,
      matched_by: null,
      final_action: "create",
      warnings: [],
      errors: [],
    },
  ]);
});

test("duplicate staff emails in the CSV block both rows", () => {
  const preview = buildPreview(`full_name,email
Alex Carter,alex@school.test
Sam Reed, ALEX@school.test `);

  assert.equal(preview.rows[0].action, "error");
  assert.equal(preview.rows[1].action, "error");
  assert.match(preview.rows[0].errors.join(" | "), /appears more than once in this CSV/i);
  assert.deepEqual(normalizeForAssert(buildStaffImportCommitPayload(preview)), []);
});

test("duplicate headers are surfaced as file errors", () => {
  const parsed = parseStaffImportCsv(`full_name,email,email
Alex Carter,alex@school.test,alex@school.test`);

  assert.match(parsed.errors.join(" | "), /duplicate column header/i);
});

test("numeric-only external staff IDs are warned but still import", () => {
  const preview = buildPreview(`full_name,email,external_staff_id
Alex Carter,alex@school.test,001234`);

  assert.equal(preview.rows[0].action, "create");
  assert.match(preview.rows[0].warnings.join(" | "), /numeric-only/i);
});

test("class suggestions tolerate smart dashes and spacing quirks", () => {
  const preview = buildPreview(`full_name,email,class_scope_suggestion
Alex Carter,alex@school.test,7A Tutor – North`);

  assert.equal(preview.rows[0].warnings.some((item) => /Class suggestion/.test(item)), false);
});

test("matched staff rows become updates and keep live access as warnings only", () => {
  const preview = buildPreview(`full_name,email,role_suggestion
Alex Carter,alex@school.test,Admin`, {
    existingProfiles: [
      { id: "staff-1", user_id: "user-1", email: "alex@school.test", display_name: "Alex Carter" },
    ],
    activeRoleAssignments: [
      { user_id: "user-1", role: "teacher" },
    ],
  });

  assert.equal(preview.rows[0].action, "update");
  assert.match(preview.rows[0].warnings.join(" | "), /live access will stay unchanged/i);
});

let failureCount = 0;

for (const entry of TESTS) {
  try {
    await entry.fn();
    console.log(`ok - ${entry.name}`);
  } catch (error) {
    failureCount += 1;
    console.error(`not ok - ${entry.name}`);
    console.error(error);
  }
}

if (failureCount > 0) {
  process.exitCode = 1;
} else {
  console.log(`all ${TESTS.length} staff CSV checks passed`);
}
