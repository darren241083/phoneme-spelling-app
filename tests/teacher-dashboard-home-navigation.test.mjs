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

const primaryViewsStart = teacherViewSource.indexOf("const PRIMARY_DASHBOARD_VIEWS");
const primaryViewsEnd = teacherViewSource.indexOf("const DASHBOARD_SECTION_KEYS", primaryViewsStart);
assert.notEqual(primaryViewsStart, -1);
assert.notEqual(primaryViewsEnd, -1);
const primaryViewConstantsSource = teacherViewSource.slice(primaryViewsStart, primaryViewsEnd);
const primaryViews = JSON.parse(JSON.stringify(vm.runInNewContext(`${primaryViewConstantsSource}
PRIMARY_DASHBOARD_VIEWS;`, {})));

const homeSource = extractFunctionSource(teacherViewSource, "renderHomeView");
assert.deepEqual(primaryViews.map((item) => item.label), ["Home", "Pupils", "Insights", "Setup"]);
assert.equal(primaryViews.some((item) => item.label === "Assignments"), false);
assert.match(primaryViewConstantsSource, /Pupil overview/);
assert.match(primaryViewConstantsSource, /Current learning/);
assert.match(primaryViewConstantsSource, /Classes and groups/);
assert.match(teacherViewSource, /primaryView: "home"/);
assert.match(homeSource, /renderTeacherHomeActivityContextBar\(activityModel\)/);
assert.match(homeSource, /renderTeacherHomeActivitySection\(activityModel\)/);
assert.doesNotMatch(homeSource, /renderTeacherHomeStatusPanel/);
assert.doesNotMatch(homeSource, /renderTeacherHomeTrend/);
assert.doesNotMatch(homeSource, /renderTeacherHomeAttentionPanel/);
assert.doesNotMatch(homeSource, /renderTeacherHomeMetric/);
assert.doesNotMatch(homeSource, /renderAnalyticsBar\(\)/);
assert.doesNotMatch(homeSource, /renderSectionTests\(\)/);

const helperSource = [
  "normalizePrimaryDashboardView",
  "normalizePupilWorkspaceTab",
  "normalizePupilOverviewFilter",
  "ensurePupilWorkspaceState",
  "closeSetupInlineToolPanels",
  "closePrimaryDashboardSections",
  "closeQuarantinedDashboardSections",
  "resetPrimaryDashboardViewForFreshRender",
  "getPrimaryViewForDashboardSection",
  "isNormalDashboardSectionQuarantined",
  "revealQuarantinedDashboardSection",
  "openPupilWorkspaceTab",
  "openDashboardSection",
  "openSetupDashboardTool",
  "openSetupDashboardPanel",
  "renderPrimaryDashboardNav",
  "pupilDisplayName",
  "getHomeOverviewSummary",
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
  "renderPupilWorkspaceTabs",
].map((functionName) => extractFunctionSource(teacherViewSource, functionName)).join("\n");

const paintHelperSource = [
  "normalizePrimaryDashboardView",
  "normalizePupilWorkspaceTab",
  "normalizePupilOverviewFilter",
  "ensurePupilWorkspaceState",
  "getPrimaryViewForDashboardSection",
  "isNormalDashboardSectionQuarantined",
  "revealQuarantinedDashboardSection",
  "shouldRenderDashboardSection",
  "renderDashboardSection",
  "closeSetupInlineToolPanels",
  "closePrimaryDashboardSections",
  "closeQuarantinedDashboardSections",
  "openPupilWorkspaceTab",
  "resetPrimaryDashboardViewForFreshRender",
  "openDashboardSection",
  "selectPrimaryDashboardView",
  "renderPrimaryDashboardNav",
  "renderPrimaryDashboardContent",
  "applyUrlState",
  "paint",
].map((functionName) => extractFunctionSource(teacherViewSource, functionName)).join("\n");

const now = new Date();
const recentDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
const oldDate = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString();

const activitySourceData = {
  windowDays: 180,
  classes: [{ id: "class-a", name: "Aster", year_group: "Year 7" }],
  memberships: [
    { class_id: "class-a", pupil_id: "pupil-active", active: true },
    { class_id: "class-a", pupil_id: "pupil-quiet", active: true },
  ],
  pupils: [
    { id: "pupil-active", first_name: "Ada", surname: "Active", username: "ada" },
    { id: "pupil-quiet", first_name: "Quinn", surname: "Quiet", username: "quinn" },
  ],
  assignments: [],
  attempts: [
    { class_id: "class-a", pupil_id: "pupil-active", test_word_id: "word-1", word_text: "rain", attempt_number: 1, created_at: recentDate },
    { class_id: "class-a", pupil_id: "pupil-quiet", test_word_id: "word-2", word_text: "moon", attempt_number: 1, created_at: oldDate },
  ],
  classById: new Map([["class-a", { id: "class-a", name: "Aster", year_group: "Year 7" }]]),
  pupilById: new Map([
    ["pupil-active", { id: "pupil-active", first_name: "Ada", surname: "Active", username: "ada" }],
    ["pupil-quiet", { id: "pupil-quiet", first_name: "Quinn", surname: "Quiet", username: "quinn" }],
  ]),
  assignmentById: new Map(),
  pupilIdsByClass: new Map([["class-a", ["pupil-active", "pupil-quiet"]]]),
  classIdsByPupil: new Map([
    ["pupil-active", ["class-a"]],
    ["pupil-quiet", ["class-a"]],
  ]),
  membershipPairs: new Set(["class-a::pupil-active", "class-a::pupil-quiet"]),
};

const readyReadiness = {
  state: "assignment_evidence_available",
  isLoading: false,
  title: "Ready",
  message: "Ready",
  primaryAction: { id: "open_analytics", label: "Open analytics" },
};

function createHomeContext({ sourceData = activitySourceData, readiness = readyReadiness, status = "ready", message = "" } = {}) {
  const state = {
    primaryView: "home",
    pupilWorkspace: {
      activeTab: "overview",
      overviewFilter: "needs_attention",
    },
    homeActivity: {
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
    },
    sections: {
      staffAccess: false,
      pupilOnboarding: false,
      bankMonitor: false,
      upcoming: false,
      classes: false,
      tests: false,
      analytics: false,
    },
    revealedQuarantinedSections: {
      bankMonitor: false,
      upcoming: false,
      classes: false,
      tests: false,
    },
    analyticsAssistant: { open: false },
    visualAnalytics: {
      status,
      message,
      sourceData,
      summaries: {},
    },
  };
  return {
    String,
    Number,
    Math,
    Date,
    Set,
    Map,
    PRIMARY_DASHBOARD_VIEWS: primaryViews,
    PRIMARY_DASHBOARD_VIEW_KEYS: primaryViews.map((item) => item.key),
    PUPIL_WORKSPACE_TABS: [
      { key: "overview", label: "Pupil overview" },
      { key: "currentLearning", label: "Current learning" },
      { key: "classes", label: "Classes and groups" },
    ],
    PUPIL_WORKSPACE_TAB_KEYS: ["overview", "currentLearning", "classes"],
    PUPIL_OVERVIEW_FILTER_KEYS: ["needs_attention", "no_recent_evidence", "all"],
    TEACHER_FIRST_USE_ACTIONS: {
      OPEN_PUPIL_ONBOARDING: { id: "open_pupil_onboarding", label: "Open pupil onboarding" },
      CHECK_BASELINE_STATUS: { id: "check_baseline_status", label: "Check baseline status" },
      VIEW_ASSIGNMENT_PROGRESS: { id: "view_assignment_progress", label: "View assignment progress" },
      OPEN_ANALYTICS: { id: "open_analytics", label: "Open analytics" },
    },
    state,
    createVisualScopeKey: () => "overview::",
    getVisualAnalyticsViewModel: () => ({ summaries: {}, sourceData }),
    buildCurrentTeacherFirstUseReadiness: () => readiness,
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

const { navHtml, homeHtml, pupilTabsHtml } = vm.runInNewContext(`${primaryViewConstantsSource}
${helperSource}
({
  navHtml: renderPrimaryDashboardNav(),
  homeHtml: renderHomeView(),
  pupilTabsHtml: renderPupilWorkspaceTabs("overview"),
});`, createHomeContext());

assert.match(navHtml, /role="tablist"/);
assert.deepEqual([...navHtml.matchAll(/data-primary-view="([^"]+)"/g)].map((match) => match[1]), [
  "home",
  "pupils",
  "insights",
  "setup",
]);
assert.match(navHtml, /aria-selected="true"[\s\S]*data-primary-view="home"/);
assert.equal((navHtml.match(/is-selected/g) || []).length, 1);
assert.doesNotMatch(navHtml, /Assignments/);

assert.match(homeHtml, /data-primary-view-panel="home"/);
assert.match(homeHtml, /data-field="home-activity-year"/);
assert.match(homeHtml, /All visible years/);
assert.match(homeHtml, /data-field="home-activity-class"/);
assert.match(homeHtml, /All visible classes/);
assert.match(homeHtml, /data-field="home-activity-period"/);
assert.match(homeHtml, /Last 7 days/);
assert.match(homeHtml, /Activity - Last 7 days/);
assert.match(homeHtml, /Active in last 7 days/);
assert.match(homeHtml, /No recent activity recorded/);
assert.match(homeHtml, /data-action="toggle-home-activity-group"/);
assert.doesNotMatch(homeHtml, /Wordloom status/);
assert.doesNotMatch(homeHtml, /<strong>Needs attention<\/strong>/);
assert.doesNotMatch(homeHtml, /Why pupils may need review/);
assert.doesNotMatch(homeHtml, /Recent trend/);
assert.doesNotMatch(homeHtml, /data-role="teacher-home-metric"/);
assert.doesNotMatch(homeHtml, /Analytics payload|Advanced manual tools|Ask AI/);

assert.match(pupilTabsHtml, /role="group"/);
assert.match(pupilTabsHtml, /aria-pressed="true"[\s\S]*Pupil overview/);
assert.match(pupilTabsHtml, /aria-pressed="false"[\s\S]*Current learning/);
assert.match(pupilTabsHtml, /aria-pressed="false"[\s\S]*Classes and groups/);
assert.doesNotMatch(pupilTabsHtml, /role="tablist"/);

const setupBlockedHtml = vm.runInNewContext(`${primaryViewConstantsSource}
${helperSource}
renderHomeView();`, createHomeContext({
  readiness: {
    state: "no_form_groups",
    isLoading: false,
    title: "Add pupils",
    message: "Add active pupils before first use.",
    primaryAction: { id: "open_pupil_onboarding", label: "Open pupil onboarding" },
  },
}));
assert.match(setupBlockedHtml, /data-role="teacher-home-setup-blocker"/);
assert.match(setupBlockedHtml, /Add pupils/);
assert.match(setupBlockedHtml, /data-action="teacher-first-use-action"/);
assert.doesNotMatch(setupBlockedHtml, /data-role="teacher-home-status"/);

const actionHandlerSource = extractFunctionSource(teacherViewSource, "handleTeacherFirstUseAction");
assert.match(actionHandlerSource, /openDashboardSection\("upcoming"\)/);
assert.match(actionHandlerSource, /openDashboardSection\("analytics"\)/);
assert.doesNotMatch(actionHandlerSource, /openDashboardSection\("tests"\)/);

function createPaintContext() {
  return {
    String,
    URLSearchParams,
    PRIMARY_DASHBOARD_VIEWS: primaryViews,
    PRIMARY_DASHBOARD_VIEW_KEYS: primaryViews.map((item) => item.key),
    PUPIL_WORKSPACE_TAB_KEYS: ["overview", "currentLearning", "classes"],
    PUPIL_OVERVIEW_FILTER_KEYS: ["needs_attention", "no_recent_evidence", "all"],
    NORMAL_DASHBOARD_QUARANTINED_SECTION_KEYS: new Set(["bankMonitor", "upcoming", "classes", "tests"]),
    DASHBOARD_SECTION_KEYS: ["staffAccess", "pupilOnboarding", "bankMonitor", "analytics", "upcoming", "classes", "tests"],
    rootEl: { innerHTML: "" },
    state: {
      user: { email: "teacher@example.test" },
      primaryView: "insights",
      sections: {
        staffAccess: false,
        pupilOnboarding: false,
        bankMonitor: false,
        analytics: true,
        upcoming: false,
        classes: false,
        tests: true,
      },
      revealedQuarantinedSections: {
        bankMonitor: false,
        upcoming: false,
        classes: false,
        tests: true,
      },
      pupilWorkspace: {
        activeTab: "overview",
        overviewFilter: "needs_attention",
      },
      analyticsAssistant: { open: true },
      createBaselineOpen: true,
      createClassOpen: false,
      createInterventionGroupOpen: true,
      createAutoAssignOpen: true,
      activePanel: { type: "assign-test", id: "stale-test" },
      flashTestId: "stale-test",
      flashClassId: "stale-class",
    },
    window: {
      location: {
        search: "",
        pathname: "/login.html",
        hash: "",
      },
      history: {
        replaceState() {},
      },
    },
    clearFlashLater: () => {},
    getDashboardTitle: () => "Teacher dashboard",
    escapeAttr: (value) => String(value ?? ""),
    escapeHtml: (value) => String(value ?? ""),
    renderCurrentSchoolContextRow: () => "",
    renderNotice: () => "",
    renderHomeView: () => '<main data-primary-view-panel="home">Activity - Last 7 days</main>',
    renderPupilsView: () => '<main data-primary-view-panel="pupils">Pupils Current learning</main>',
    renderInsightsView: () => '<main data-primary-view-panel="insights">Insights Analytics payload</main>',
    renderSetupView: () => '<main data-primary-view-panel="setup">Setup Advanced manual tools</main>',
    renderFloatingAIButton: () => '<button>Ask AI</button>',
    syncAnalyticsThreadPosition: () => {},
    syncAnalyticsComposerHeight: () => {},
    syncTableScrollShells: () => {},
    syncTargetPopoverLayouts: () => {},
  };
}

const staleFreshContext = createPaintContext();
const freshHomeHtml = vm.runInNewContext(`${paintHelperSource}
resetPrimaryDashboardViewForFreshRender();
paint();
rootEl.innerHTML;`, staleFreshContext);
assert.equal(staleFreshContext.state.primaryView, "home");
assert.equal(staleFreshContext.state.pupilWorkspace.activeTab, "overview");
assert.equal(staleFreshContext.state.pupilWorkspace.overviewFilter, "needs_attention");
assert.equal(staleFreshContext.state.analyticsAssistant.open, false);
assert.equal(staleFreshContext.state.sections.analytics, false);
assert.equal(staleFreshContext.state.sections.tests, false);
assert.equal(staleFreshContext.state.createBaselineOpen, false);
assert.equal(staleFreshContext.state.createAutoAssignOpen, false);
assert.equal(staleFreshContext.state.activePanel, null);
assert.match(freshHomeHtml, /data-primary-view-panel="home"/);
assert.doesNotMatch(freshHomeHtml, /Analytics payload|Advanced manual tools|Ask AI/);

const ordinaryNavigationContext = createPaintContext();
vm.runInNewContext(`${paintHelperSource}
selectPrimaryDashboardView("insights");
paint();
paint();`, ordinaryNavigationContext);
assert.equal(ordinaryNavigationContext.state.primaryView, "insights");
assert.equal(ordinaryNavigationContext.state.sections.analytics, true);
assert.match(ordinaryNavigationContext.rootEl.innerHTML, /Analytics payload/);
assert.match(ordinaryNavigationContext.rootEl.innerHTML, /Ask AI/);

const pupilWorkspaceContext = createPaintContext();
vm.runInNewContext(`${paintHelperSource}
selectPrimaryDashboardView("pupils");
openPupilWorkspaceTab("currentLearning");
paint();`, pupilWorkspaceContext);
assert.equal(pupilWorkspaceContext.state.primaryView, "pupils");
assert.equal(pupilWorkspaceContext.state.pupilWorkspace.activeTab, "currentLearning");
assert.equal(pupilWorkspaceContext.state.sections.upcoming, true);
assert.equal(pupilWorkspaceContext.state.revealedQuarantinedSections.upcoming, true);

const openAssignContext = createPaintContext();
openAssignContext.window.location.search = "?openAssign=test-123";
let replacedUrl = "";
openAssignContext.window.history.replaceState = (_state, _title, url) => {
  replacedUrl = url;
};
vm.runInNewContext(`${paintHelperSource}
resetPrimaryDashboardViewForFreshRender();
applyUrlState();
paint();`, openAssignContext);
assert.equal(openAssignContext.state.primaryView, "setup");
assert.equal(openAssignContext.state.sections.tests, true);
assert.equal(openAssignContext.state.revealedQuarantinedSections.tests, true);
assert.equal(openAssignContext.state.activePanel?.type, "assign-test");
assert.equal(openAssignContext.state.activePanel?.id, "test-123");
assert.equal(openAssignContext.state.flashTestId, "test-123");
assert.equal(replacedUrl, "/login.html");

for (const forbidden of [
  'data-action="seed-demo-data"',
  'data-action="clear-demo-data"',
  "seedDemoData",
  "clearDemoData",
]) {
  assert.equal(teacherViewSource.includes(forbidden), false, `${forbidden} should not be present`);
}

console.log("Passed teacher dashboard Home navigation checks.");
