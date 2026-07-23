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

assert.deepEqual(primaryViews.map((item) => item.label), ["Home", "Pupils", "Insights", "Setup"]);
assert.equal(primaryViews.some((item) => item.label === "Assignments"), false);
assert.equal(teacherViewSource.includes('primaryView: "home"'), true);

const helperSource = [
  "normalizePrimaryDashboardView",
  "closePrimaryDashboardSections",
  "closeQuarantinedDashboardSections",
  "resetPrimaryDashboardViewForFreshRender",
  "getPrimaryViewForDashboardSection",
  "revealQuarantinedDashboardSection",
  "openDashboardSection",
  "openSetupDashboardTool",
  "renderPrimaryDashboardNav",
  "mapTeacherHomeReadinessState",
  "getTeacherFirstUseActionDisplayLabel",
  "renderTeacherFirstUseReadinessPanel",
  "getHomeOverviewSummary",
  "getLifecycleFollowUpPupilIds",
  "getTeacherHomeAttentionReasons",
  "getTeacherHomeSummaryCards",
  "getTeacherHomeTrendMeta",
  "renderTeacherHomeSummaryCard",
  "renderTeacherHomeAttention",
  "renderHomeView",
].map((functionName) => extractFunctionSource(teacherViewSource, functionName)).join("\n");

const paintHelperSource = [
  "normalizePrimaryDashboardView",
  "getPrimaryViewForDashboardSection",
  "isNormalDashboardSectionQuarantined",
  "revealQuarantinedDashboardSection",
  "shouldRenderDashboardSection",
  "renderDashboardSection",
  "closePrimaryDashboardSections",
  "closeQuarantinedDashboardSections",
  "resetPrimaryDashboardViewForFreshRender",
  "openDashboardSection",
  "selectPrimaryDashboardView",
  "renderPrimaryDashboardNav",
  "renderPrimaryDashboardContent",
  "applyUrlState",
  "paint",
].map((functionName) => extractFunctionSource(teacherViewSource, functionName)).join("\n");

const setupHelperSource = [
  "renderPrimaryViewHeader",
  "renderDashboardAreaActionCard",
  "renderSetupActionCards",
  "renderSetupView",
].map((functionName) => extractFunctionSource(teacherViewSource, functionName)).join("\n");

const firstUseActionHelperSource = [
  "closePrimaryDashboardSections",
  "openSetupDashboardTool",
  "scrollTeacherFirstUseTarget",
  "handleTeacherFirstUseAction",
].map((functionName) => extractFunctionSource(teacherViewSource, functionName)).join("\n");

const overviewSummary = {
  checkedWords: 18,
  pupilCount: 4,
  activePupilCount: 3,
  interventionCount: 1,
  pupilRows: [
    { pupilId: "p1", checkedWords: 0, needsIntervention: false },
    { pupilId: "p2", checkedWords: 8, needsIntervention: true },
    { pupilId: "p3", checkedWords: 6, needsIntervention: false },
    { pupilId: "p4", checkedWords: 4, needsIntervention: false },
  ],
  recentTrend: {
    label: "Needs attention",
    direction: "down",
    dayCount: 3,
    startLabel: "1 Jul",
    endLabel: "8 Jul",
  },
};

const readinessModel = {
  state: "personalised_assignment_live",
  isLoading: false,
  title: "Personalised learning is live",
  message: "Pupils are working through the current learning cycle.",
  pupilAccessMessage: "Pupils sign in with username and PIN.",
  primaryAction: { id: "view_assignment_progress", label: "View assignment progress" },
};

const context = {
  String,
  Number,
  Math,
  Set,
  PRIMARY_DASHBOARD_VIEWS: primaryViews,
  PRIMARY_DASHBOARD_VIEW_KEYS: primaryViews.map((item) => item.key),
  TEACHER_FIRST_USE_ACTIONS: {
    OPEN_PUPIL_ONBOARDING: { id: "open_pupil_onboarding", label: "Open pupil onboarding" },
    CHECK_BASELINE_STATUS: { id: "check_baseline_status", label: "Check baseline status" },
    VIEW_ASSIGNMENT_PROGRESS: { id: "view_assignment_progress", label: "View assignment progress" },
    OPEN_ANALYTICS: { id: "open_analytics", label: "Open analytics" },
  },
  state: {
    primaryView: "home",
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
    createBaselineOpen: false,
    createClassOpen: false,
    createInterventionGroupOpen: false,
    createAutoAssignOpen: false,
    visualAnalytics: {
      status: "ready",
      summaries: {},
    },
  },
  createVisualScopeKey: () => "overview::",
  getVisualAnalyticsViewModel: () => ({ summaries: { "overview::": overviewSummary } }),
  buildCurrentTeacherFirstUseReadiness: () => readinessModel,
  buildTeacherFirstUseAssignmentRows: () => [
    {
      sourceKey: "generated_by_policy",
      lifecycle: {
        key: "in_progress",
        pupilFollowUp: {
          groups: {
            not_started: { pupils: [{ pupilId: "p1" }] },
            in_progress: { pupils: [{ pupil_id: "p2" }] },
            check_data: { pupils: [] },
          },
        },
      },
    },
  ],
  escapeAttr: (value) => String(value ?? ""),
  escapeHtml: (value) => String(value ?? ""),
};

const { navHtml, homeHtml } = vm.runInNewContext(`${helperSource}
({
  navHtml: renderPrimaryDashboardNav(),
  homeHtml: renderHomeView(),
});`, context);

assert.match(navHtml, /role="tablist"/);
assert.deepEqual([...navHtml.matchAll(/data-primary-view="([^"]+)"/g)].map((match) => match[1]), [
  "home",
  "pupils",
  "insights",
  "setup",
]);
assert.match(navHtml, /Home/);
assert.match(navHtml, /Pupils/);
assert.match(navHtml, /Insights/);
assert.match(navHtml, /Setup/);
assert.doesNotMatch(navHtml, /Assignments/);
assert.match(navHtml, /aria-selected="true"[\s\S]*data-primary-view="home"/);

assert.match(homeHtml, /Wordloom status/);
assert.doesNotMatch(homeHtml, /First-use readiness/);
assert.match(homeHtml, /View current learning/);
assert.doesNotMatch(homeHtml, /View assignment progress/);
assert.equal((homeHtml.match(/td-btn td-btn--primary/g) || []).length, 1, "Home should expose at most one primary action");
assert.match(homeHtml, /Current learning follow-up/);
assert.match(homeHtml, /No recent evidence/);
assert.match(homeHtml, /Needs attention/);
assert.match(homeHtml, /What changed/);
assert.match(homeHtml, /Declining/);
assert.doesNotMatch(homeHtml, /Analytics payload|Advanced manual tools/);

const actionHandlerStart = teacherViewSource.indexOf("function handleTeacherFirstUseAction(");
const actionHandlerEnd = teacherViewSource.indexOf("\nasync function onRootClick", actionHandlerStart);
assert.notEqual(actionHandlerStart, -1);
assert.notEqual(actionHandlerEnd, -1);
const actionHandlerSource = teacherViewSource.slice(actionHandlerStart, actionHandlerEnd);
assert.match(actionHandlerSource, /openDashboardSection\("upcoming"\)/);
assert.match(actionHandlerSource, /openDashboardSection\("analytics"\)/);
assert.doesNotMatch(actionHandlerSource, /openDashboardSection\("tests"\)/);

function createPaintContext() {
  return {
    String,
    URLSearchParams,
    PRIMARY_DASHBOARD_VIEWS: primaryViews,
    PRIMARY_DASHBOARD_VIEW_KEYS: primaryViews.map((item) => item.key),
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
    renderHomeView: () => '<main data-primary-view-panel="home">Wordloom status</main>',
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

let focusedBaselineInput = false;
class FakeHTMLElement {}
const fakeBaselineInput = new FakeHTMLElement();
fakeBaselineInput.scrollIntoView = () => {};
fakeBaselineInput.matches = () => true;
fakeBaselineInput.focus = () => {
  focusedBaselineInput = true;
};
const baselineActionContext = {
  String,
  HTMLElement: FakeHTMLElement,
  DASHBOARD_SECTION_KEYS: ["staffAccess", "pupilOnboarding", "bankMonitor", "analytics", "upcoming", "classes", "tests"],
  TEACHER_FIRST_USE_ACTIONS: {
    OPEN_PUPIL_ONBOARDING: { id: "open_pupil_onboarding" },
    CHECK_BASELINE_STATUS: { id: "check_baseline_status" },
    VIEW_ASSIGNMENT_PROGRESS: { id: "view_assignment_progress" },
    OPEN_ANALYTICS: { id: "open_analytics" },
  },
  state: {
    primaryView: "home",
    sections: {
      staffAccess: false,
      pupilOnboarding: false,
      bankMonitor: false,
      analytics: false,
      upcoming: false,
      classes: false,
      tests: false,
    },
    analyticsAssistant: { open: true },
    createBaselineOpen: false,
    createClassOpen: true,
    createInterventionGroupOpen: true,
    createAutoAssignOpen: true,
  },
  rootEl: {
    querySelector: (selector) => selector === "#tdBaselineClassInput"
      ? fakeBaselineInput
      : null,
  },
  requestAnimationFrame: (callback) => callback(),
  canImportCsv: () => false,
  canManageOwnContent: () => true,
  canAssignTests: () => true,
  showNotice: () => {},
  paint: () => {},
  loadPupilPlacementRows: () => {},
  openDashboardSection: () => {},
};
vm.runInNewContext(`${firstUseActionHelperSource}
handleTeacherFirstUseAction("check_baseline_status");`, baselineActionContext);
assert.equal(baselineActionContext.state.primaryView, "setup");
assert.equal(baselineActionContext.state.createBaselineOpen, true);
assert.equal(baselineActionContext.state.createClassOpen, false);
assert.equal(baselineActionContext.state.createInterventionGroupOpen, false);
assert.equal(baselineActionContext.state.createAutoAssignOpen, false);
assert.equal(baselineActionContext.state.analyticsAssistant.open, false);
assert.equal(focusedBaselineInput, true);

function renderSetupForPermissions({
  importCsv = false,
  baseline = false,
  automation = false,
  advancedManual = false,
} = {}) {
  const setupContext = {
    escapeAttr: (value) => String(value ?? ""),
    escapeHtml: (value) => String(value ?? ""),
    canImportCsv: () => importCsv,
    canManageOwnContent: () => baseline,
    canAssignTests: () => baseline,
    canManageAutomation: () => automation,
    renderCreateBar: () => "",
    renderSectionStaffAccess: () => "",
    renderSectionPupilOnboarding: () => "",
    canViewWordloomCoreBankMonitor: () => false,
    renderSectionWordloomCoreBankMonitor: () => "",
    renderSectionClasses: () => "",
    renderSectionTests: () => advancedManual ? "<section>Advanced manual tools</section>" : "",
  };
  return vm.runInNewContext(`${setupHelperSource}
renderSetupView();`, setupContext);
}

const restrictedSetupHtml = renderSetupForPermissions();
assert.doesNotMatch(restrictedSetupHtml, /td-view-action-card/);
assert.doesNotMatch(restrictedSetupHtml, /Pupil onboarding|Baseline readiness|Automation controls/);

const setupShortcutHtml = renderSetupForPermissions({
  importCsv: true,
  baseline: true,
  automation: true,
});
assert.match(setupShortcutHtml, /Pupil onboarding/);
assert.match(setupShortcutHtml, /data-section="pupilOnboarding"/);
assert.match(setupShortcutHtml, /Baseline readiness/);
assert.match(setupShortcutHtml, /data-action="open-setup-tool"[\s\S]*data-setup-tool="baseline"/);
assert.match(setupShortcutHtml, /Automation controls/);
assert.match(setupShortcutHtml, /data-action="open-setup-tool"[\s\S]*data-setup-tool="automation"/);

const setupToolContext = {
  String,
  DASHBOARD_SECTION_KEYS: ["staffAccess", "pupilOnboarding", "bankMonitor", "analytics", "upcoming", "classes", "tests"],
  state: {
    primaryView: "home",
    sections: {
      staffAccess: false,
      pupilOnboarding: false,
      bankMonitor: false,
      analytics: true,
      upcoming: false,
      classes: false,
      tests: true,
    },
    analyticsAssistant: { open: true },
    createBaselineOpen: false,
    createClassOpen: true,
    createInterventionGroupOpen: true,
    createAutoAssignOpen: false,
  },
};
vm.runInNewContext(`${helperSource}
openSetupDashboardTool("baseline");`, setupToolContext);
assert.equal(setupToolContext.state.primaryView, "setup");
assert.equal(setupToolContext.state.createBaselineOpen, true);
assert.equal(setupToolContext.state.createAutoAssignOpen, false);
assert.equal(setupToolContext.state.sections.tests, false);

vm.runInNewContext(`${helperSource}
openSetupDashboardTool("automation");`, setupToolContext);
assert.equal(setupToolContext.state.primaryView, "setup");
assert.equal(setupToolContext.state.createBaselineOpen, false);
assert.equal(setupToolContext.state.createAutoAssignOpen, true);
assert.equal(setupToolContext.state.analyticsAssistant.open, false);

console.log("Passed teacher dashboard Home navigation checks.");
