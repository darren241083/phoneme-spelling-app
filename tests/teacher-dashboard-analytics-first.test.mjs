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
assert.notEqual(primaryViewsStart, -1, "primary dashboard view constants should exist");
assert.notEqual(primaryViewsEnd, -1, "primary dashboard view constants should be bounded");
const primaryViewConstantsSource = teacherViewSource.slice(primaryViewsStart, primaryViewsEnd);
const primaryViews = JSON.parse(JSON.stringify(vm.runInNewContext(`${primaryViewConstantsSource}
PRIMARY_DASHBOARD_VIEWS;`, {})));
assert.deepEqual(primaryViews.map((item) => item.label), ["Home", "Pupils", "Insights", "Setup"]);
assert.deepEqual(primaryViews.map((item) => item.key), ["home", "pupils", "insights", "setup"]);
assert.equal(primaryViews.some((item) => item.label === "Assignments"), false);

assert.match(
  teacherViewSource,
  /NORMAL_DASHBOARD_QUARANTINED_SECTION_KEYS = new Set\(\["bankMonitor", "upcoming", "classes", "tests"\]\)/,
  "the normal dashboard quarantine should still list the low-frequency standalone sections"
);
assert.match(teacherViewSource, /primaryView: "home"/, "Home should be the default primary view");

for (const [functionName, title] of [
  ["renderSectionWordloomCoreBankMonitor", "Core bank"],
  ["renderSectionUpcomingAssignments", "Current learning"],
  ["renderSectionClasses", "Classes and form groups"],
  ["renderSectionTests", "Advanced manual tools"],
]) {
  assert.match(teacherViewSource, new RegExp(`function ${functionName}\\(`), `${functionName} should remain defined`);
  assert.match(teacherViewSource, new RegExp(title), `${title} renderer copy should remain available`);
}

const homeSource = extractFunctionSource(teacherViewSource, "renderHomeView");
const pupilsSource = extractFunctionSource(teacherViewSource, "renderPupilsView");
const insightsSource = extractFunctionSource(teacherViewSource, "renderInsightsView");
const setupSource = extractFunctionSource(teacherViewSource, "renderSetupView");
const paintSource = extractFunctionSource(teacherViewSource, "paint");

assert.match(homeSource, /renderTeacherFirstUseReadinessPanel\(\)/);
assert.match(homeSource, /Wordloom status|td-primary-view--home/);
assert.doesNotMatch(homeSource, /renderAnalyticsBar\(\)/, "Home should not render analytics content");
assert.doesNotMatch(homeSource, /renderSectionTests\(\)/, "Home should not render advanced manual tools");
assert.match(pupilsSource, /renderDashboardSection\("upcoming", renderSectionUpcomingAssignments\)/);
assert.match(pupilsSource, /renderDashboardSection\("classes", renderSectionClasses\)/);
assert.match(insightsSource, /renderAnalyticsBar\(\)/, "analytics should live under Insights");
assert.match(setupSource, /renderCreateBar\(\)/);
assert.match(setupSource, /renderSectionStaffAccess\(\)/);
assert.match(setupSource, /renderSectionPupilOnboarding\(\)/);
assert.match(setupSource, /renderSectionClasses\(\)/);
assert.match(setupSource, /renderSectionTests\(\)/);
assert.doesNotMatch(setupSource, /openDashboardSection\("tests"\)/, "Setup should not auto-open advanced manual tools");

assert.ok(
  paintSource.indexOf("renderNotice()") < paintSource.indexOf("renderPrimaryDashboardNav()")
    && paintSource.indexOf("renderPrimaryDashboardNav()") < paintSource.indexOf("renderPrimaryDashboardContent()"),
  "paint should render notice, primary nav, then selected primary view"
);
assert.doesNotMatch(paintSource, /renderAnalyticsBar\(\)/, "paint should not place analytics outside primary views");
assert.doesNotMatch(paintSource, /renderSectionUpcomingAssignments\(\)/, "paint should not place current learning outside primary views");

const helperSource = [
  "normalizePrimaryDashboardView",
  "getPrimaryViewForDashboardSection",
  "isNormalDashboardSectionQuarantined",
  "revealQuarantinedDashboardSection",
  "shouldRenderDashboardSection",
  "renderDashboardSection",
  "openDashboardSection",
  "selectPrimaryDashboardView",
  "renderPrimaryDashboardNav",
  "renderPrimaryDashboardContent",
  "paint",
].map((functionName) => extractFunctionSource(teacherViewSource, functionName)).join("\n");

function createDashboardContext() {
  const context = {
    String,
    PRIMARY_DASHBOARD_VIEWS: primaryViews,
    PRIMARY_DASHBOARD_VIEW_KEYS: primaryViews.map((item) => item.key),
    NORMAL_DASHBOARD_QUARANTINED_SECTION_KEYS: new Set(["bankMonitor", "upcoming", "classes", "tests"]),
    DASHBOARD_SECTION_KEYS: ["staffAccess", "pupilOnboarding", "bankMonitor", "analytics", "upcoming", "classes", "tests"],
    rootEl: { innerHTML: "" },
    state: {
      user: { email: "teacher@example.test" },
      primaryView: "home",
      sections: {
        staffAccess: false,
        pupilOnboarding: false,
        bankMonitor: false,
        upcoming: false,
        classes: false,
        tests: false,
        analytics: true,
      },
      revealedQuarantinedSections: {
        bankMonitor: false,
        upcoming: false,
        classes: false,
        tests: false,
      },
      analyticsAssistant: { open: true },
    },
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
  return context;
}

const homeContext = createDashboardContext();
const homeHtml = vm.runInNewContext(`${helperSource}
paint();
rootEl.innerHTML;`, homeContext);
assert.match(homeHtml, /Wordloom status/);
assert.match(homeHtml, /Home/);
assert.match(homeHtml, /Pupils/);
assert.match(homeHtml, /Insights/);
assert.match(homeHtml, /Setup/);
assert.doesNotMatch(homeHtml, /Assignments/);
assert.doesNotMatch(homeHtml, /Analytics payload/);
assert.doesNotMatch(homeHtml, /Advanced manual tools/);

const insightsContext = createDashboardContext();
const insightsHtml = vm.runInNewContext(`${helperSource}
selectPrimaryDashboardView("insights");
paint();
rootEl.innerHTML;`, insightsContext);
assert.equal(insightsContext.state.primaryView, "insights");
assert.equal(insightsContext.state.sections.analytics, true);
assert.match(insightsHtml, /Analytics payload/);
assert.match(insightsHtml, /Ask AI/);

const pupilsContext = createDashboardContext();
vm.runInNewContext(`${helperSource}
selectPrimaryDashboardView("pupils");`, pupilsContext);
assert.equal(pupilsContext.state.primaryView, "pupils");
assert.equal(pupilsContext.state.sections.upcoming, true);
assert.equal(pupilsContext.state.revealedQuarantinedSections.upcoming, true);
assert.equal(pupilsContext.state.sections.tests, false);

const setupContext = createDashboardContext();
vm.runInNewContext(`${helperSource}
selectPrimaryDashboardView("setup");`, setupContext);
assert.equal(setupContext.state.primaryView, "setup");
assert.equal(setupContext.state.sections.tests, false, "Setup tab should keep advanced manual tools closed");
assert.equal(setupContext.state.revealedQuarantinedSections.tests, false);

const testsContext = createDashboardContext();
vm.runInNewContext(`${helperSource}
openDashboardSection("tests");`, testsContext);
assert.equal(testsContext.state.primaryView, "setup");
assert.equal(testsContext.state.sections.tests, true);
assert.equal(testsContext.state.revealedQuarantinedSections.tests, true);

for (const forbidden of [
  'data-action="seed-demo-data"',
  'data-action="clear-demo-data"',
  "state.demoData",
  "handleManageDemoData",
  "manageDemoSchoolData",
]) {
  assert.equal(teacherViewSource.includes(forbidden), false, `${forbidden} should not remain in the dashboard UI`);
}

const urlStateStart = teacherViewSource.indexOf("function applyUrlState()");
const urlStateEnd = teacherViewSource.indexOf("\nfunction togglePanelWithAnchoredScroll", urlStateStart);
assert.notEqual(urlStateStart, -1, "applyUrlState should exist");
assert.notEqual(urlStateEnd, -1, "applyUrlState slice should be bounded");
const urlStateSource = teacherViewSource.slice(urlStateStart, urlStateEnd);
assert.match(urlStateSource, /openDashboardSection\("tests"\)/, "openAssign fallback should still reveal manual tools only when explicitly needed");

console.log("Passed teacher dashboard primary-view quarantine checks.");
