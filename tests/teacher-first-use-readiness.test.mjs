import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");
const teacherViewSource = readFileSync(path.join(rootDir, "js/teacherView.js"), "utf8");

const helperStart = teacherViewSource.indexOf("const TEACHER_FIRST_USE_ACTIONS");
const helperEnd = teacherViewSource.indexOf("const AUTOMATION_TARGET_YEAR_ALL", helperStart);
assert.notEqual(helperStart, -1, "first-use action constants should exist");
assert.notEqual(helperEnd, -1, "first-use helper slice should be bounded");

const helperSource = teacherViewSource
  .slice(helperStart, helperEnd)
  .replace("export function buildTeacherFirstUseReadiness", "function buildTeacherFirstUseReadiness");

const context = {
  module: { exports: {} },
};
vm.runInNewContext(`${helperSource}
module.exports = { buildTeacherFirstUseReadiness };`, context);

const { buildTeacherFirstUseReadiness } = context.module.exports;

function model(input = {}) {
  return buildTeacherFirstUseReadiness({
    classDataKnown: true,
    formGroupCount: 1,
    ownedFormGroupCount: 1,
    pupilDataKnown: true,
    activePupilCount: 12,
    canImportCsv: true,
    canProvisionBaseline: true,
    assignments: [],
    loginPath: "./login.html",
    ...input,
  });
}

function assertAction(modelResult, id, label) {
  assert.equal(modelResult.primaryAction?.id || null, id);
  if (label) assert.equal(modelResult.primaryAction?.label, label);
  assert.ok(!modelResult.primaryAction || Object.keys(modelResult.primaryAction).length === 2);
}

function assertAtMostOneAction(modelResult) {
  assert.ok(!modelResult.primaryAction || typeof modelResult.primaryAction.id === "string");
}

const loading = buildTeacherFirstUseReadiness({
  classDataKnown: false,
  pupilDataKnown: false,
});
assert.equal(loading.state, "loading_or_unknown");
assert.equal(loading.isLoading, true);
assert.equal(loading.primaryAction, null);

const initialEmptyClassesStillLoading = model({
  classDataKnown: false,
  formGroupCount: 0,
  ownedFormGroupCount: 0,
  pupilDataKnown: false,
  activePupilCount: 0,
});
assert.equal(initialEmptyClassesStillLoading.state, "loading_or_unknown");
assert.equal(initialEmptyClassesStillLoading.primaryAction, null);

const unknownPupils = model({
  pupilDataKnown: false,
  activePupilCount: null,
});
assert.equal(unknownPupils.state, "loading_or_unknown");
assert.equal(unknownPupils.primaryAction, null);

const noFormGroups = model({ formGroupCount: 0 });
assert.equal(noFormGroups.state, "no_form_groups");
assertAction(noFormGroups, "open_pupil_onboarding", "Open pupil onboarding");

const noFormGroupsNoPermission = model({
  formGroupCount: 0,
  canImportCsv: false,
});
assert.equal(noFormGroupsNoPermission.state, "setup_blocked_by_permissions");
assert.equal(noFormGroupsNoPermission.primaryAction, null);

const noPupils = model({ activePupilCount: 0 });
assert.equal(noPupils.state, "form_groups_without_pupils");
assertAction(noPupils, "open_pupil_onboarding");

const pupilsWithoutBaseline = model();
assert.equal(pupilsWithoutBaseline.state, "pupils_without_baseline");
assertAction(pupilsWithoutBaseline, "check_baseline_status", "Check baseline status");

const noOwnedForm = model({ ownedFormGroupCount: 0 });
assert.equal(noOwnedForm.state, "setup_blocked_by_permissions");
assert.notEqual(noOwnedForm.primaryAction?.id, "check_baseline_status");

const noBaselineCapability = model({ canProvisionBaseline: false });
assert.equal(noBaselineCapability.state, "setup_blocked_by_permissions");
assert.notEqual(noBaselineCapability.primaryAction?.id, "check_baseline_status");

const baselineActive = model({
  assignments: [{ id: "baseline-1", sourceKey: "baseline", lifecycle: { key: "waiting", totalPupilCount: 12 } }],
});
assert.equal(baselineActive.state, "baseline_active");
assertAction(baselineActive, "view_assignment_progress", "View assignment progress");

const baselinePartial = model({
  assignments: [{
    id: "baseline-1",
    sourceKey: "baseline",
    lifecycle: { key: "in_progress", totalPupilCount: 12, startedCount: 8, completedCount: 4 },
  }],
});
assert.equal(baselinePartial.state, "baseline_partially_complete");
assertAction(baselinePartial, "view_assignment_progress");

const baselineCompleteWaiting = model({
  assignments: [{
    id: "baseline-1",
    sourceKey: "baseline",
    lifecycle: { key: "complete", totalPupilCount: 12, completedCount: 12 },
  }],
});
assert.equal(baselineCompleteWaiting.state, "baseline_complete_waiting_for_personalised");
assert.match(baselineCompleteWaiting.message, /prepared automatically/);
assertAction(baselineCompleteWaiting, "view_assignment_progress");

const baselineCompletePlusCompletedPersonalised = model({
  assignments: [
    {
      id: "baseline-1",
      sourceKey: "baseline",
      lifecycle: { key: "complete", totalPupilCount: 12, completedCount: 12 },
    },
    {
      id: "auto-1",
      sourceKey: "generated_by_policy",
      lifecycle: { key: "complete", totalPupilCount: 12, completedCount: 12 },
    },
  ],
});
assert.equal(baselineCompletePlusCompletedPersonalised.state, "all_current_work_complete");
assert.notEqual(baselineCompletePlusCompletedPersonalised.state, "baseline_complete_waiting_for_personalised");
assertAction(baselineCompletePlusCompletedPersonalised, "open_analytics");

const baselineCompletePlusCompletedPersonalisedWithAnalytics = model({
  assignments: [
    {
      id: "baseline-1",
      sourceKey: "baseline",
      lifecycle: { key: "complete", totalPupilCount: 12, completedCount: 12 },
    },
    {
      id: "auto-1",
      sourceKey: "generated_by_policy",
      lifecycle: { key: "complete", totalPupilCount: 12, completedCount: 12 },
    },
  ],
  hasAnalyticsEvidence: true,
});
assert.equal(baselineCompletePlusCompletedPersonalisedWithAnalytics.state, "assignment_evidence_available");
assert.notEqual(baselineCompletePlusCompletedPersonalisedWithAnalytics.state, "baseline_complete_waiting_for_personalised");
assertAction(baselineCompletePlusCompletedPersonalisedWithAnalytics, "open_analytics");

const personalisedLive = model({
  assignments: [{ id: "auto-1", sourceKey: "generated_by_policy", lifecycle: { key: "in_progress" } }],
});
assert.equal(personalisedLive.state, "personalised_assignment_live");
assertAction(personalisedLive, "view_assignment_progress");

const evidenceAvailable = model({
  assignments: [{ id: "teacher-1", sourceKey: "teacher_created", lifecycle: { key: "waiting" } }],
  hasAnalyticsEvidence: true,
});
assert.equal(evidenceAvailable.state, "assignment_evidence_available");
assertAction(evidenceAvailable, "open_analytics", "Open analytics");

const allComplete = model({
  assignments: [{ id: "teacher-1", sourceKey: "teacher_created", lifecycle: { key: "complete", totalPupilCount: 12, completedCount: 12 } }],
  hasAnalyticsEvidence: false,
});
assert.equal(allComplete.state, "all_current_work_complete");
assertAction(allComplete, "open_analytics");

for (const item of [
  loading,
  initialEmptyClassesStillLoading,
  unknownPupils,
  noFormGroups,
  noFormGroupsNoPermission,
  noPupils,
  pupilsWithoutBaseline,
  noOwnedForm,
  noBaselineCapability,
  baselineActive,
  baselinePartial,
  baselineCompleteWaiting,
  baselineCompletePlusCompletedPersonalised,
  baselineCompletePlusCompletedPersonalisedWithAnalytics,
  personalisedLive,
  evidenceAvailable,
  allComplete,
]) {
  assertAtMostOneAction(item);
  assert.match(item.pupilAccessMessage, /username and PIN/);
  assert.match(item.pupilAccessMessage, /shown once/);
}

const actionHandlerStart = teacherViewSource.indexOf("function handleTeacherFirstUseAction(");
const actionHandlerEnd = teacherViewSource.indexOf("\nasync function onRootClick", actionHandlerStart);
assert.notEqual(actionHandlerStart, -1, "first-use action handler should exist");
assert.notEqual(actionHandlerEnd, -1, "first-use action handler slice should be bounded");
const actionHandlerSource = teacherViewSource.slice(actionHandlerStart, actionHandlerEnd);
assert.match(actionHandlerSource, /openDashboardSection\("pupilOnboarding"\)/);
assert.match(actionHandlerSource, /openDashboardSection\("upcoming"\)/);
assert.match(actionHandlerSource, /openDashboardSection\("analytics"\)/);
assert.match(actionHandlerSource, /openSetupDashboardTool\("baseline"\)/);
assert.doesNotMatch(actionHandlerSource, /openDashboardSection\("tests"\)/);
assert.equal(teacherViewSource.includes('data-action="teacher-first-use-action"'), true);
assert.equal(teacherViewSource.includes("renderTeacherFirstUseReadinessPanel()"), true);
assert.equal(teacherViewSource.includes("Wordloom status"), true);
assert.equal(teacherViewSource.includes("First-use readiness"), false);

const setupToolStart = teacherViewSource.indexOf("function openSetupDashboardTool(");
const setupToolEnd = teacherViewSource.indexOf("\nfunction openDashboardSection", setupToolStart);
assert.notEqual(setupToolStart, -1, "setup tool opener should exist");
assert.notEqual(setupToolEnd, -1, "setup tool opener slice should be bounded");
const setupToolSource = teacherViewSource.slice(setupToolStart, setupToolEnd);
assert.match(setupToolSource, /state\.primaryView = "setup"/);
assert.match(setupToolSource, /state\.createBaselineOpen = true/);
assert.match(setupToolSource, /state\.createAutoAssignOpen = true/);

const currentBuilderStart = teacherViewSource.indexOf("function buildCurrentTeacherFirstUseReadiness()");
const currentBuilderEnd = teacherViewSource.indexOf("\nfunction renderTeacherFirstUseReadinessPanel", currentBuilderStart);
assert.notEqual(currentBuilderStart, -1, "current first-use builder should exist");
assert.notEqual(currentBuilderEnd, -1, "current first-use builder slice should be bounded");
const currentBuilderSource = teacherViewSource.slice(currentBuilderStart, currentBuilderEnd);
assert.match(currentBuilderSource, /isTeacherFirstUseClassDataLoaded\(\)/);
assert.doesNotMatch(currentBuilderSource, /classDataKnown:\s*Array\.isArray\(state\.classes\)/);
assert.match(currentBuilderSource, /formGroupCount:\s*classDataLoaded \? formClasses\.length : null/);

console.log("Passed teacher first-use readiness checks.");
