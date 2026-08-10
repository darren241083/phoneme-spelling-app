import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");
const teacherViewSource = readFileSync(path.join(rootDir, "js/teacherView.js"), "utf8");

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

const constantsStart = teacherViewSource.indexOf("const HOME_ACTIVITY_DEFAULT_PERIOD_DAYS");
const constantsEnd = teacherViewSource.indexOf("const DASHBOARD_SECTION_KEYS", constantsStart);
assert.notEqual(constantsStart, -1);
assert.notEqual(constantsEnd, -1);
const activityConstantsSource = teacherViewSource.slice(constantsStart, constantsEnd);

const helperSource = [
  "pupilDisplayName",
  "getHomeVisualSourceData",
  "getTeacherFirstUseActionDisplayLabel",
  "isTeacherHomeEssentialSetupAction",
  "normalizeHomeActivityPeriodDays",
  "getHomeActivityPeriodOption",
  "getHomeActivityPeriodPhrase",
  "normalizeHomeActivityGroup",
  "createDefaultHomeActivityDraftState",
  "ensureHomeActivityState",
  "getTeacherHomeActivityEvidenceState",
  "getHomeActivityClassById",
  "getHomeActivityPupilById",
  "getHomeActivityAssignmentById",
  "getHomeActivityYearOptions",
  "getHomeActivityClassOptions",
  "sanitizeTeacherHomeActivityFilters",
  "getTeacherHomeActivityFilters",
  "setTeacherHomeActivityFilters",
  "getHomeActivitySelectedClassIds",
  "buildTeacherHomeActivityRosterRows",
  "getHomeActivityAttemptClassId",
  "getHomeActivityAttemptTime",
  "isQualifyingHomeActivityAttempt",
  "buildHomeActivityAttemptKey",
  "getHomeActivityCheckedWordKey",
  "getTeacherHomeActivityScopedAttempts",
  "compareTeacherHomeActivityNames",
  "buildTeacherHomeActivityRows",
  "formatHomeActivityPercent",
  "buildTeacherHomeActivityModel",
  "getTeacherHomeActivityGroupMeta",
  "getTeacherHomeActivityGroupRows",
  "prepareTeacherHomeActivityDraft",
  "getTeacherHomeActivityPupilNames",
  "renderTeacherHomeSetupBlocker",
  "renderTeacherHomeActivityContextBar",
  "renderTeacherHomeActivitySummaryButton",
  "renderTeacherHomeActivityBar",
  "renderTeacherHomeActivityRow",
  "renderTeacherHomeActivityDraft",
  "renderTeacherHomeActivityList",
  "renderTeacherHomeActivitySection",
  "renderHomeView",
].map((functionName) => extractFunctionSource(teacherViewSource, functionName)).join("\n");

const DAY_MS = 24 * 60 * 60 * 1000;
const fixedNow = new Date("2026-07-23T12:00:00.000Z");

function daysAgo(days, offsetMs = 0) {
  return new Date(fixedNow.getTime() - days * DAY_MS + offsetMs).toISOString();
}

function buildSourceData({ classes, memberships, pupils, attempts, assignments = [] }) {
  const classById = new Map(classes.map((item) => [String(item.id), item]));
  const pupilById = new Map(pupils.map((item) => [String(item.id), item]));
  const assignmentById = new Map(assignments.map((item) => [String(item.id), item]));
  const membershipPairs = new Set();
  const pupilIdsByClass = new Map();
  const classIdsByPupil = new Map();

  for (const membership of memberships.filter((item) => item.active !== false)) {
    const classId = String(membership.class_id || "");
    const pupilId = String(membership.pupil_id || "");
    if (!classId || !pupilId) continue;
    membershipPairs.add(`${classId}::${pupilId}`);
    pupilIdsByClass.set(classId, [...(pupilIdsByClass.get(classId) || []), pupilId]);
    classIdsByPupil.set(pupilId, [...(classIdsByPupil.get(pupilId) || []), classId]);
  }

  return {
    windowDays: 180,
    classes,
    memberships,
    pupils,
    attempts,
    assignments,
    classById,
    pupilById,
    assignmentById,
    pupilIdsByClass,
    classIdsByPupil,
    membershipPairs,
  };
}

function createActivityState(overrides = {}) {
  return {
    yearGroup: "",
    classId: "",
    periodDays: 7,
    expandedGroup: "",
    draft: {
      open: false,
      group: "",
      text: "",
      statusMessage: "",
      statusTone: "info",
    },
    ...overrides,
  };
}

function createContext(sourceData, { status = "ready", message = "", homeActivity = createActivityState(), readiness = null } = {}) {
  const state = {
    homeActivity,
    visualAnalytics: {
      status,
      message,
      sourceData,
    },
  };
  return {
    String,
    Number,
    Math,
    Date,
    Set,
    Map,
    state,
    TEACHER_FIRST_USE_ACTIONS: {
      OPEN_PUPIL_ONBOARDING: { id: "open_pupil_onboarding", label: "Open pupil onboarding" },
      CHECK_BASELINE_STATUS: { id: "check_baseline_status", label: "Check baseline status" },
      VIEW_ASSIGNMENT_PROGRESS: { id: "view_assignment_progress", label: "View assignment progress" },
      OPEN_ANALYTICS: { id: "open_analytics", label: "Open analytics" },
    },
    getVisualAnalyticsViewModel: () => ({ sourceData }),
    buildCurrentTeacherFirstUseReadiness: () => readiness || {
      state: "assignment_evidence_available",
      isLoading: false,
      title: "Ready",
      message: "Ready",
      primaryAction: { id: "open_analytics", label: "Open analytics" },
    },
    escapeAttr: (value) => String(value ?? ""),
    escapeHtml: (value) => String(value ?? ""),
    formatCountLabel: (count, singular, plural = `${singular}s`) => `${Number(count)} ${Number(count) === 1 ? singular : plural}`,
    formatShortDate: (value) => {
      if (!value) return "--";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "--" : date.toISOString().slice(0, 10);
    },
    renderInfoTip: (text) => `<span data-tip>${String(text)}</span>`,
  };
}

function runActivity(script, context) {
  return vm.runInNewContext(`${activityConstantsSource}
${helperSource}
${script}`, context);
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

const sourceData = buildSourceData({
  classes: [
    { id: "class-a", name: "Aster", year_group: "Year 7" },
    { id: "class-b", name: "Birch", year_group: "Year 8" },
    { id: "class-c", name: "Cedar", year_group: "Year 7" },
  ],
  memberships: [
    { class_id: "class-a", pupil_id: "pupil-active", active: true },
    { class_id: "class-a", pupil_id: "pupil-active", active: true },
    { class_id: "class-a", pupil_id: "pupil-old", active: true },
    { class_id: "class-a", pupil_id: "pupil-missing-record", active: true },
    { class_id: "class-a", pupil_id: "pupil-inactive", active: false },
    { class_id: "class-b", pupil_id: "pupil-year8", active: true },
    { class_id: "class-c", pupil_id: "pupil-year7-c", active: true },
  ],
  pupils: [
    { id: "pupil-active", first_name: "Ada", surname: "Active", username: "ada" },
    { id: "pupil-old", first_name: "Owen", surname: "Old", username: "owen" },
    { id: "pupil-inactive", first_name: "Iris", surname: "Inactive", username: "iris" },
    { id: "pupil-year8", first_name: "Bea", surname: "Birch", username: "bea" },
    { id: "pupil-year7-c", first_name: "Cara", surname: "Cedar", username: "cara" },
  ],
  attempts: [
    { assignment_id: "a1", class_id: "class-a", pupil_id: "pupil-active", test_word_id: "word-1", word_text: "rain", attempt_number: 1, created_at: daysAgo(7) },
    { assignment_id: "a1", class_id: "class-a", pupil_id: "pupil-active", test_word_id: "word-1", word_text: "rain", attempt_number: 1, created_at: daysAgo(7) },
    { assignment_id: "a1", class_id: "class-a", pupil_id: "pupil-old", test_word_id: "word-2", word_text: "moon", attempt_number: 1, created_at: daysAgo(7, -1) },
    { assignment_id: "a1", class_id: "class-a", pupil_id: "pupil-inactive", test_word_id: "word-3", word_text: "star", attempt_number: 1, created_at: daysAgo(1) },
    { assignment_id: "b1", class_id: "class-b", pupil_id: "pupil-year8", test_word_id: "word-4", word_text: "tree", attempt_number: 1, created_at: daysAgo(1) },
    { assignment_id: "c1", class_id: "class-c", pupil_id: "pupil-year7-c", test_word_id: "word-5", word_text: "seed", attempt_number: 1, created_at: daysAgo(1) },
  ],
});

const defaults = runActivity(`getTeacherHomeActivityFilters(state.visualAnalytics.sourceData);`, createContext(sourceData, {
  homeActivity: {},
}));
assert.deepEqual(toPlain(defaults), { yearGroup: "", classId: "", periodDays: 7 });

const classASevenDayModel = runActivity(`buildTeacherHomeActivityModel({
  data: state.visualAnalytics.sourceData,
  filters: { yearGroup: "", classId: "class-a", periodDays: 7 },
  now: new Date("${fixedNow.toISOString()}"),
});`, createContext(sourceData));

assert.equal(classASevenDayModel.rosterCount, 3, "duplicate memberships and inactive memberships should not inflate the roster");
assert.equal(classASevenDayModel.activeCount, 1, "the exact 7-day boundary attempt should count as active");
assert.equal(classASevenDayModel.noRecentCount, 2);
assert.equal(classASevenDayModel.activeRows[0].pupilId, "pupil-active");
assert.equal(classASevenDayModel.activeRows[0].checkedCount, 1, "duplicate attempts should not inflate the checked count");
assert.deepEqual(toPlain(classASevenDayModel.noRecentRows.map((row) => row.pupilId)), ["pupil-missing-record", "pupil-old"]);
assert.equal(classASevenDayModel.noRecentRows.find((row) => row.pupilId === "pupil-missing-record").lastKnownActivity, null);
assert.equal(classASevenDayModel.noRecentRows.find((row) => row.pupilId === "pupil-old").lastKnownActivity, new Date(daysAgo(7, -1)).getTime());
assert.equal(classASevenDayModel.activeRows.some((row) => row.pupilId === "pupil-inactive"), false);
assert.equal(classASevenDayModel.activeRows.some((row) => row.pupilId === "pupil-year7-c"), false);

const retrySource = buildSourceData({
  classes: [{ id: "class-retry", name: "Retry", year_group: "Year 7" }],
  memberships: [{ class_id: "class-retry", pupil_id: "pupil-retry", active: true }],
  pupils: [{ id: "pupil-retry", first_name: "Rae", surname: "Retry", username: "rae" }],
  attempts: [
    { class_id: "class-retry", pupil_id: "pupil-retry", test_word_id: "word-1", word_text: "rain", attempt_number: 1, typed: "raim", created_at: daysAgo(2) },
    { class_id: "class-retry", pupil_id: "pupil-retry", test_word_id: "word-1", word_text: "rain", attempt_number: 2, typed: "rain", created_at: daysAgo(1) },
    { class_id: "class-retry", pupil_id: "pupil-retry", test_word_id: "word-2", word_text: "moon", attempt_number: 1, typed: "moon", created_at: daysAgo(1) },
  ],
});
const retryModel = runActivity(`buildTeacherHomeActivityModel({
  data: state.visualAnalytics.sourceData,
  filters: { yearGroup: "", classId: "class-retry", periodDays: 7 },
  now: new Date("${fixedNow.toISOString()}"),
});`, createContext(retrySource));
assert.equal(retryModel.activeCount, 1);
assert.equal(retryModel.activeRows[0].checkedCount, 2, "retry attempts should count as one checked word");
const retryRowHtml = runActivity(`const model = buildTeacherHomeActivityModel({
  data: state.visualAnalytics.sourceData,
  filters: { yearGroup: "", classId: "class-retry", periodDays: 7 },
  now: new Date("${fixedNow.toISOString()}"),
  expandedGroup: "active"
});
renderTeacherHomeActivityRow(model.activeRows[0], "active");`, createContext(retrySource));
assert.match(retryRowHtml, /2 checked words/);
assert.doesNotMatch(retryRowHtml, /3 checked words/);

const classAThirtyDayModel = runActivity(`buildTeacherHomeActivityModel({
  data: state.visualAnalytics.sourceData,
  filters: { yearGroup: "", classId: "class-a", periodDays: 30 },
  now: new Date("${fixedNow.toISOString()}"),
});`, createContext(sourceData));
assert.equal(classAThirtyDayModel.activeCount, 2, "changing the evidence period should update activity counts");
assert.deepEqual(toPlain(classAThirtyDayModel.activeRows.map((row) => row.pupilId)), ["pupil-active", "pupil-old"]);

const yearSevenModel = runActivity(`buildTeacherHomeActivityModel({
  data: state.visualAnalytics.sourceData,
  filters: { yearGroup: "Year 7", classId: "", periodDays: 7 },
  now: new Date("${fixedNow.toISOString()}"),
});`, createContext(sourceData));
assert.equal(yearSevenModel.rosterCount, 4);
assert.equal(yearSevenModel.activeCount, 2);
assert.equal(yearSevenModel.activeRows.some((row) => row.pupilId === "pupil-year8"), false);

const resetContext = createContext(sourceData, {
  homeActivity: createActivityState({ yearGroup: "Year 8", classId: "class-a", periodDays: 7 }),
});
const resetFilters = runActivity(`getTeacherHomeActivityFilters(state.visualAnalytics.sourceData);`, resetContext);
assert.deepEqual(toPlain(resetFilters), { yearGroup: "Year 8", classId: "", periodDays: 7 }, "invalid class selection should reset when year changes");

const boundarySource = buildSourceData({
  classes: [{ id: "class-boundary", name: "Boundary", year_group: "Year 9" }],
  memberships: [
    { class_id: "class-boundary", pupil_id: "p7", active: true },
    { class_id: "class-boundary", pupil_id: "p30", active: true },
    { class_id: "class-boundary", pupil_id: "p180", active: true },
    { class_id: "class-boundary", pupil_id: "p-before", active: true },
  ],
  pupils: [
    { id: "p7", first_name: "Seven", surname: "Boundary", username: "p7" },
    { id: "p30", first_name: "Thirty", surname: "Boundary", username: "p30" },
    { id: "p180", first_name: "One", surname: "Eighty", username: "p180" },
    { id: "p-before", first_name: "Before", surname: "Boundary", username: "pb" },
  ],
  attempts: [
    { class_id: "class-boundary", pupil_id: "p7", test_word_id: "w7", word_text: "seven", created_at: daysAgo(7) },
    { class_id: "class-boundary", pupil_id: "p30", test_word_id: "w30", word_text: "thirty", created_at: daysAgo(30) },
    { class_id: "class-boundary", pupil_id: "p180", test_word_id: "w180", word_text: "eighty", created_at: daysAgo(180) },
    { class_id: "class-boundary", pupil_id: "p-before", test_word_id: "wb", word_text: "before", created_at: daysAgo(7, -1) },
  ],
});

for (const [periodDays, expectedActive] of [
  [7, ["p7"]],
  [30, ["p7", "p30", "p-before"]],
  [180, ["p7", "p30", "p180", "p-before"]],
]) {
  const model = runActivity(`buildTeacherHomeActivityModel({
    data: state.visualAnalytics.sourceData,
    filters: { yearGroup: "", classId: "", periodDays: ${periodDays} },
    now: new Date("${fixedNow.toISOString()}"),
  });`, createContext(boundarySource));
  assert.deepEqual(toPlain(model.activeRows.map((row) => row.pupilId).sort()), expectedActive.sort(), `${periodDays}-day boundary should be deterministic`);
}

const loadingHtml = runActivity(`renderHomeView();`, createContext(null, {
  status: "loading",
  homeActivity: createActivityState(),
}));
assert.match(loadingHtml, /Checking recent pupil activity/);
assert.doesNotMatch(loadingHtml, /0 pupils/);
assert.doesNotMatch(loadingHtml, /td-home-activity-bar/);

const staleLoadingHtml = runActivity(`renderHomeView();`, createContext(sourceData, {
  status: "loading",
  homeActivity: createActivityState(),
}));
assert.match(staleLoadingHtml, /Checking recent pupil activity/);
assert.doesNotMatch(staleLoadingHtml, /Ada Active/);
assert.doesNotMatch(staleLoadingHtml, /td-home-activity-bar/);

const staleFilterContext = createContext(sourceData, {
  status: "loading",
  homeActivity: createActivityState({ yearGroup: "Year 7", classId: "class-a", periodDays: 30 }),
});
const staleFilterResult = runActivity(`({
  html: renderHomeView(),
  homeActivity: state.homeActivity,
});`, staleFilterContext);
assert.match(staleFilterResult.html, /Checking recent pupil activity/);
assert.doesNotMatch(staleFilterResult.html, /Ada Active/);
assert.deepEqual(toPlain(staleFilterResult.homeActivity), {
  yearGroup: "Year 7",
  classId: "class-a",
  periodDays: 30,
  expandedGroup: "",
  draft: {
    open: false,
    group: "",
    text: "",
    statusMessage: "",
    statusTone: "info",
  },
});

const errorHtml = runActivity(`renderHomeView();`, createContext(null, {
  status: "error",
  message: "Analytics query failed.",
  homeActivity: createActivityState(),
}));
assert.match(errorHtml, /Recent pupil activity is not available yet/);
assert.match(errorHtml, /Analytics query failed\./);

const expandedActiveHtml = runActivity(`state.homeActivity = {
  ...state.homeActivity,
  classId: "class-a",
  periodDays: 7,
  expandedGroup: "active"
};
const model = buildTeacherHomeActivityModel({
  data: state.visualAnalytics.sourceData,
  filters: getTeacherHomeActivityFilters(state.visualAnalytics.sourceData),
  now: new Date("${fixedNow.toISOString()}"),
  expandedGroup: state.homeActivity.expandedGroup,
  draft: state.homeActivity.draft
});
renderTeacherHomeActivitySection(model);`, createContext(sourceData));
assert.match(expandedActiveHtml, /Activity - Last 7 days/);
assert.match(expandedActiveHtml, /1 pupil has activity and 2 pupils have no recent activity recorded/);
assert.match(expandedActiveHtml, /Active in last 7 days/);
assert.match(expandedActiveHtml, /No recent activity recorded/);
assert.match(expandedActiveHtml, /1 pupil/);
assert.match(expandedActiveHtml, /2 pupils/);
assert.match(expandedActiveHtml, /33% of visible roster/);
assert.match(expandedActiveHtml, /67% of visible roster/);
assert.match(expandedActiveHtml, /data-activity-group="active"[\s\S]*aria-expanded="true"/);
assert.match(expandedActiveHtml, /Active in this period/);
assert.match(expandedActiveHtml, /Ada Active/);
assert.doesNotMatch(expandedActiveHtml, /Owen Old[\s\S]*data-action="open-visual-summary"/);
assert.match(expandedActiveHtml, /data-action="open-visual-summary"[\s\S]*data-scope-id="pupil-active"/);
assert.match(expandedActiveHtml, /Optional well-done draft/);
assert.match(expandedActiveHtml, /does not prove work was available/);
assert.doesNotMatch(expandedActiveHtml, /\bInactive\b/);
assert.doesNotMatch(expandedActiveHtml, /failed to complete|was assigned available work/i);
assert.doesNotMatch(expandedActiveHtml, /Why pupils may need review|Recent trend|data-role="teacher-home-metric"/);

const expandedNoRecentHtml = runActivity(`state.homeActivity = {
  ...state.homeActivity,
  classId: "class-a",
  periodDays: 7,
  expandedGroup: "no_recent"
};
const model = buildTeacherHomeActivityModel({
  data: state.visualAnalytics.sourceData,
  filters: getTeacherHomeActivityFilters(state.visualAnalytics.sourceData),
  now: new Date("${fixedNow.toISOString()}"),
  expandedGroup: state.homeActivity.expandedGroup,
  draft: state.homeActivity.draft
});
renderTeacherHomeActivitySection(model);`, createContext(sourceData));
assert.match(expandedNoRecentHtml, /No recent activity recorded/);
assert.match(expandedNoRecentHtml, /Unknown pupil/);
assert.match(expandedNoRecentHtml, /No recorded activity/);
assert.match(expandedNoRecentHtml, /Owen Old/);
assert.match(expandedNoRecentHtml, /Last recorded 2026-07-16/);
assert.match(expandedNoRecentHtml, /Summary unavailable/);
assert.doesNotMatch(expandedNoRecentHtml, /data-scope-id="pupil-missing-record"/);
assert.match(expandedNoRecentHtml, /Optional reminder draft/);

const draftChecks = runActivity(`({
  praise: prepareTeacherHomeActivityDraft("active", [{ name: "Ada Active" }], { periodDays: 7 }),
  reminder: prepareTeacherHomeActivityDraft("no_recent", [{ name: "Owen Old" }], { periodDays: 7 }),
  draftHtml: renderTeacherHomeActivityDraft({
    expandedGroup: "active",
    filters: { periodDays: 7 },
    activeRows: [{ name: "Ada Active" }],
    noRecentRows: [],
    rosterCount: 1,
    activeCount: 1,
    noRecentCount: 0,
    periodOption: getHomeActivityPeriodOption(7),
    draft: {
      open: true,
      group: "active",
      text: prepareTeacherHomeActivityDraft("active", [{ name: "Ada Active" }], { periodDays: 7 }),
      statusMessage: "Clipboard access failed. The text is still available to copy manually.",
      statusTone: "warning"
    }
  })
});`, createContext(sourceData));
assert.match(draftChecks.praise, /Well done for completing your recent Wordloom practice/);
assert.match(draftChecks.reminder, /Please remember to complete your Wordloom spelling practice/);
assert.match(draftChecks.praise, /school's normal communication system/);
assert.match(draftChecks.reminder, /school's normal communication system/);
assert.match(draftChecks.draftHtml, /Copy text/);
assert.match(draftChecks.draftHtml, /Copy pupil names/);
assert.match(draftChecks.draftHtml, /Close/);
assert.match(draftChecks.draftHtml, /aria-live="polite"/);
assert.match(draftChecks.draftHtml, /still available to copy manually/);
assert.doesNotMatch(draftChecks.draftHtml, /Send|Email|Recipient|emailed|messaged/i);

const allActiveSource = buildSourceData({
  classes: [{ id: "class-all", name: "All", year_group: "Year 10" }],
  memberships: [{ class_id: "class-all", pupil_id: "pupil-all", active: true }],
  pupils: [{ id: "pupil-all", first_name: "Allie", surname: "Active", username: "allie" }],
  attempts: [{ class_id: "class-all", pupil_id: "pupil-all", test_word_id: "word-all", word_text: "all", created_at: daysAgo(1) }],
});
const allActiveHtml = runActivity(`const model = buildTeacherHomeActivityModel({
  data: state.visualAnalytics.sourceData,
  filters: { periodDays: 7 },
  now: new Date("${fixedNow.toISOString()}")
});
renderTeacherHomeActivitySection(model);`, createContext(allActiveSource));
assert.match(allActiveHtml, /All visible pupils have recorded activity in this period/);
assert.match(allActiveHtml, /No recent activity recorded/);
assert.match(allActiveHtml, /0 pupils/);

const noAttemptsSource = buildSourceData({
  classes: [{ id: "class-empty", name: "Empty", year_group: "Year 11" }],
  memberships: [{ class_id: "class-empty", pupil_id: "pupil-empty", active: true }],
  pupils: [{ id: "pupil-empty", first_name: "Em", surname: "Pty", username: "em" }],
  attempts: [],
});
const noAttemptsHtml = runActivity(`const model = buildTeacherHomeActivityModel({
  data: state.visualAnalytics.sourceData,
  filters: { periodDays: 7 },
  now: new Date("${fixedNow.toISOString()}")
});
renderTeacherHomeActivitySection(model);`, createContext(noAttemptsSource));
assert.match(noAttemptsHtml, /No pupil activity has been recorded in this period/);
assert.match(noAttemptsHtml, /Active in last 7 days/);
assert.match(noAttemptsHtml, /0 pupils/);

const noRosterSource = buildSourceData({
  classes: [{ id: "class-none", name: "None", year_group: "Year 12" }],
  memberships: [],
  pupils: [],
  attempts: [],
});
const noRosterHtml = runActivity(`const model = buildTeacherHomeActivityModel({
  data: state.visualAnalytics.sourceData,
  filters: { periodDays: 7 },
  now: new Date("${fixedNow.toISOString()}")
});
renderTeacherHomeActivitySection(model);`, createContext(noRosterSource));
assert.match(noRosterHtml, /No pupils are available in this view/);
assert.doesNotMatch(noRosterHtml, /td-home-activity-bar/);

const clickHandlerStart = teacherViewSource.indexOf('if (action === "copy-home-activity-draft-text")');
assert.notEqual(clickHandlerStart, -1, "copy text handler should exist");
assert.equal(teacherViewSource.includes("handleCopyTeacherHomeActivityDraftText"), true);
assert.equal(teacherViewSource.includes("handleCopyTeacherHomeActivityPupilNames"), true);
assert.equal(teacherViewSource.includes("Clipboard access failed. The text is still available to copy manually."), true);
assert.equal(teacherViewSource.includes("supabase.from(\"parents\""), false);
assert.equal(teacherViewSource.includes("mailto:"), false);

console.log("Passed teacher dashboard Activity Home checks.");
