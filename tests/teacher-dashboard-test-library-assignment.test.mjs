import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");

function readSource(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function sourceSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} should exist after ${startMarker}`);
  return source.slice(start, end);
}

function extractFunctionSource(source, functionName) {
  const functionStart = source.indexOf(`function ${functionName}(`);
  assert.notEqual(functionStart, -1, `${functionName} should exist`);

  const signatureStart = source.indexOf("(", functionStart);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    if (source[index] === ")") parenDepth -= 1;
    if (parenDepth === 0 && source[index] === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `${functionName} body should be discoverable`);

  let braceDepth = 0;
  let functionEnd = -1;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") braceDepth += 1;
    if (source[index] === "}") {
      braceDepth -= 1;
      if (braceDepth === 0) {
        functionEnd = index + 1;
        break;
      }
    }
  }
  assert.notEqual(functionEnd, -1, `${functionName} should have a complete body`);
  return source.slice(functionStart, functionEnd);
}

const teacherViewSource = readSource("js/teacherView.js");
const migrationSource = readSource("supabase/migrations/20260706123000_restrict_manual_assignment_to_owned_tests.sql");

function loadAssignmentHelpers() {
  let teacherAssignmentAccess = true;
  let manageOwnContent = true;
  let ownedClasses = [{ id: "class-1", teacher_id: "teacher-1", school_id: "school-1" }];
  let currentSchoolDetails = {
    activeSchoolId: "school-1",
    activeSchool: { id: "school-1", is_legacy_default: false },
  };
  const context = {
    String,
    canAssignTests: () => teacherAssignmentAccess,
    canManageOwnContent: () => manageOwnContent,
    getCurrentSchoolDetails: () => currentSchoolDetails,
    getOwnedAssignableClasses: () => ownedClasses,
    ownsTeacherRecord: (record) => String(record?.teacher_id || "").trim() === "teacher-1",
  };
  const helperSource = [
    "canEditTestRecord",
    "getNormalizedTestStatus",
    "isDashboardAssignableTestStatus",
    "isActiveSchoolSafeTestRecord",
    "getTestAssignmentAvailability",
    "canAssignFromTestRecord",
  ].map((functionName) => extractFunctionSource(teacherViewSource, functionName)).join("\n");
  const helpers = vm.runInNewContext(`${helperSource}
({
  canEditTestRecord,
  getTestAssignmentAvailability,
  canAssignFromTestRecord,
});`, context);

  return {
    helpers,
    setTeacherAssignmentAccess(value) {
      teacherAssignmentAccess = !!value;
    },
    setManageOwnContent(value) {
      manageOwnContent = !!value;
    },
    setOwnedClasses(nextClasses) {
      ownedClasses = nextClasses;
    },
    setCurrentSchoolDetails(nextDetails) {
      currentSchoolDetails = nextDetails;
    },
  };
}

const { helpers, setTeacherAssignmentAccess, setManageOwnContent, setOwnedClasses, setCurrentSchoolDetails } = loadAssignmentHelpers();

function resetAccess() {
  setTeacherAssignmentAccess(true);
  setManageOwnContent(true);
  setOwnedClasses([{ id: "class-1", teacher_id: "teacher-1", school_id: "school-1" }]);
  setCurrentSchoolDetails({
    activeSchoolId: "school-1",
    activeSchool: { id: "school-1", is_legacy_default: false },
  });
}

function availabilityFor(record) {
  return helpers.getTestAssignmentAvailability(record);
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadRenderTestCard({
  canAssign = false,
  canAssignAccess = true,
  canEdit = false,
  canPresent = false,
  reason = "Create or open one of your own classes before assigning a test.",
} = {}) {
  const context = {
    String,
    state: {
      activePanel: null,
      flashTestId: null,
    },
    canEditTestRecord: () => canEdit,
    getTestAssignmentAvailability: () => ({
      canAssign,
      reason,
      assignableClasses: canAssign ? [{ id: "class-1", name: "Class 1" }] : [],
    }),
    canAssignTests: () => canAssignAccess,
    canPresentTestRecord: () => canPresent,
    getSelectedTestIds: () => [],
    getManualAssignmentSelectedClassId: () => "",
    escapeAttr: escapeHtml,
    escapeHtml,
    renderTestMeta: () => "Published | 2 assigned",
    renderManualAssignmentDeliveryControl: () => "",
    renderManualAssignmentDuplicateWarning: () => "",
  };
  return vm.runInNewContext(`(${extractFunctionSource(teacherViewSource, "renderTestCard")})`, context);
}

function loadRenderClassCard({ canEdit = false } = {}) {
  const context = {
    String,
    state: {
      activePanel: null,
      flashClassId: null,
    },
    canEditClassRecord: () => canEdit,
    getSavedClassAutoAssignPolicy: () => null,
    getEffectiveClassAutoAssignPolicy: () => ({}),
    buildAutoAssignPolicySummary: () => "default",
    getClassTypeDisplayLabel: () => "Form group",
    escapeAttr: escapeHtml,
    escapeHtml,
    renderClassResultsPanel: () => "",
    renderClassRemovalPanel: () => "",
    AUTO_ASSIGN_POLICY_LENGTH_MIN: 1,
    AUTO_ASSIGN_POLICY_LENGTH_MAX: 50,
    AUTO_ASSIGN_SUPPORT_PRESET_OPTIONS: [],
    AUTO_ASSIGN_POLICY_DEFAULTS: {},
  };
  return vm.runInNewContext(`(${extractFunctionSource(teacherViewSource, "renderClassCard")})`, context);
}

resetAccess();
const visibleNonOwnedTest = {
  id: "test-visible",
  teacher_id: "teacher-2",
  school_id: "school-1",
  status: "published",
  is_auto_generated: false,
};
assert.equal(helpers.canEditTestRecord(visibleNonOwnedTest), false);
const visibleNonOwnedAvailability = availabilityFor(visibleNonOwnedTest);
assert.equal(
  visibleNonOwnedAvailability.canAssign,
  false,
  "visible suitable non-owned tests should not be dashboard-assignable"
);
assert.equal(
  visibleNonOwnedAvailability.reason,
  "Only the teacher who created this test can assign it."
);
assert.equal(helpers.canAssignFromTestRecord(visibleNonOwnedTest), false);

resetAccess();
assert.equal(
  availabilityFor({ ...visibleNonOwnedTest, teacher_id: "teacher-1", assignment_count: 3 }).canAssign,
  true,
  "live suitable tests should remain dashboard-assignable when owned classes exist"
);

resetAccess();
const ownEditableTest = {
  id: "test-own",
  teacher_id: "teacher-1",
  school_id: "school-1",
  status: "published",
  is_auto_generated: false,
};
assert.equal(helpers.canEditTestRecord(ownEditableTest), true);
assert.equal(
  availabilityFor(ownEditableTest).canAssign,
  true,
  "own editable published tests should remain dashboard-assignable"
);

resetAccess();
assert.equal(
  availabilityFor({ ...ownEditableTest, status: "draft" }).canAssign,
  false,
  "draft tests should not be dashboard-assignable"
);
assert.equal(
  availabilityFor({ ...ownEditableTest, status: "private" }).canAssign,
  false,
  "private tests should not be dashboard-assignable"
);
assert.equal(
  availabilityFor({ ...ownEditableTest, status: "archived" }).canAssign,
  false,
  "archived tests should not be dashboard-assignable"
);

resetAccess();
assert.equal(
  availabilityFor({ ...ownEditableTest, is_auto_generated: true }).canAssign,
  false,
  "auto-generated tests should not be dashboard-assignable"
);

resetAccess();
assert.equal(
  availabilityFor({ ...visibleNonOwnedTest, id: "" }).canAssign,
  false,
  "tests without ids should not be dashboard-assignable"
);

resetAccess();
setTeacherAssignmentAccess(false);
setManageOwnContent(false);
assert.equal(
  availabilityFor(visibleNonOwnedTest).canAssign,
  false,
  "admin-only/read-only access should not expose dashboard assignment"
);

resetAccess();
setCurrentSchoolDetails({
  activeSchoolId: "school-2",
  activeSchool: { id: "school-2", is_legacy_default: false },
});
assert.equal(
  availabilityFor(visibleNonOwnedTest).canAssign,
  false,
  "out-of-school tests should not be dashboard-assignable"
);

resetAccess();
setCurrentSchoolDetails({
  activeSchoolId: "legacy-school",
  activeSchool: { id: "legacy-school", is_legacy_default: true },
});
assert.equal(
  availabilityFor({ ...ownEditableTest, school_id: null }).canAssign,
  true,
  "legacy-default school context should still allow legacy null-school tests"
);

resetAccess();
setOwnedClasses([]);
const noOwnedClassAvailability = availabilityFor(ownEditableTest);
assert.equal(
  noOwnedClassAvailability.canAssign,
  false,
  "suitable tests should be blocked when only visible non-owned classes exist"
);
assert.equal(
  noOwnedClassAvailability.reason,
  "Create or open one of your own classes before assigning a test."
);

const assignGateSource = extractFunctionSource(teacherViewSource, "canAssignFromTestRecord");
assert.doesNotMatch(
  assignGateSource,
  /canEditTestRecord/,
  "dashboard assignment availability must not depend on edit ownership"
);

const renderTestCardSource = sourceSlice(
  teacherViewSource,
  "function renderTestCard(test)",
  "function renderClassRemovalWarningList"
);
assert.match(renderTestCardSource, /const assignmentAvailability = getTestAssignmentAvailability\(test\);/);
assert.match(renderTestCardSource, /const canAssignTest = assignmentAvailability\.canAssign;/);
assert.match(renderTestCardSource, /const canShowBlockedAssign = canAssignTests\(\) && !canAssignTest;/);
assert.match(renderTestCardSource, /td-disabled-assign-control/);
assert.match(renderTestCardSource, /title="\$\{escapeAttr\(assignmentBlockedReason\)\}"/);
assert.match(renderTestCardSource, /aria-describedby="\$\{escapeAttr\(assignmentBlockedReasonId\)\}"/);
assert.match(renderTestCardSource, /data-action="open-edit-test"/);
assert.match(renderTestCardSource, /data-action="duplicate-test"/);
assert.match(renderTestCardSource, /data-action="delete-test"/);
assert.match(renderTestCardSource, /canEditTest \? `<button class="td-btn td-btn--ghost" type="button" data-action="open-edit-test"/);

const blockedRenderTestCard = loadRenderTestCard({
  canAssign: false,
  canAssignAccess: true,
  reason: "Only the teacher who created this test can assign it.",
});
const blockedAssignHtml = blockedRenderTestCard({
  id: "test-visible",
  title: "Visible test",
  is_auto_generated: false,
});
assert.match(blockedAssignHtml, /td-disabled-assign-control/);
assert.match(blockedAssignHtml, /<button[\s\S]*disabled[\s\S]*>\s*Assign\s*<\/button>/);
assert.match(blockedAssignHtml, /Only the teacher who created this test can assign it\./);
assert.doesNotMatch(blockedAssignHtml, /data-action="open-assign-test"/);

const noAccessRenderTestCard = loadRenderTestCard({
  canAssign: false,
  canAssignAccess: false,
});
const noAccessAssignHtml = noAccessRenderTestCard({
  id: "test-visible",
  title: "Visible test",
  is_auto_generated: false,
});
assert.doesNotMatch(noAccessAssignHtml, />\s*Assign\s*</);

const renderClassCardSource = sourceSlice(
  teacherViewSource,
  "function renderClassCard(cls)",
  "function findTestRecord"
);
assert.match(renderClassCardSource, /subtitleParts\.push\(canEditClass \? "Ready for assignments" : "Visible to you"\);/);
const readOnlyRenderClassCard = loadRenderClassCard({ canEdit: false });
const readOnlyClassHtml = readOnlyRenderClassCard({
  id: "class-visible",
  name: "Visible Class",
  year_group: "Year 7",
  class_type: "form",
});
assert.match(readOnlyClassHtml, /Visible to you/);
assert.doesNotMatch(readOnlyClassHtml, /Ready for assignments/);
assert.doesNotMatch(readOnlyClassHtml, /data-action="open-edit-class"|data-action="delete-class"/);

const handleAssignSource = sourceSlice(
  teacherViewSource,
  "async function handleAssignTest(form)",
  "async function handleAssignmentDueDateForm"
);
assert.match(handleAssignSource, /const assignmentAvailability = getTestAssignmentAvailability\(selectedTest\);/);
assert.match(handleAssignSource, /if \(!canEditClassRecord\(selectedClass\)\)/);
assert.match(handleAssignSource, /const schoolScopedPayload = withActiveSchoolId\(payload, state\.accessContext\);/);
assert.match(handleAssignSource, /"assignments_v2",\s*schoolScopedPayload,/s);
assert.match(handleAssignSource, /\.\.\.deliveryFields,\s*analytics_target_words_enabled:/);
assert.doesNotMatch(handleAssignSource, /\.from\("tests"\)|updateRowsWithAnalyticsFallback\("tests"|\.from\("tests"\)\s*\.update/);

assert.match(migrationSource, /SECURITY DEFINER/);
assert.match(migrationSource, /checked_teacher_id is distinct from actor_user_id/);
assert.match(migrationSource, /c\.teacher_id = actor_user_id/);
assert.match(migrationSource, /public\.is_teacher_compat\(actor_user_id, class_school_id\)/);
assert.match(migrationSource, /test_teacher_id is distinct from actor_user_id/);
assert.match(migrationSource, /Only the teacher who created this test can assign it\./);
assert.match(migrationSource, /test_status in \('draft', 'private', 'archived'\)/);
assert.match(migrationSource, /assignment_engine_pool/);
assert.match(migrationSource, /assignment_automation_kind <> 'personalised'/);
assert.doesNotMatch(migrationSource, /update\s+public\.tests/i);

console.log("Passed teacher dashboard test-library assignment checks.");
