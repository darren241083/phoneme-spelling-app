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

const quarantineKeys = ["bankMonitor", "upcoming", "classes", "tests"];
const helperSource = [
  "isNormalDashboardSectionQuarantined",
  "revealQuarantinedDashboardSection",
  "shouldRenderDashboardSection",
  "renderDashboardSection",
  "openDashboardSection",
].map((functionName) => extractFunctionSource(teacherViewSource, functionName)).join("\n");
const paintSource = extractFunctionSource(teacherViewSource, "paint");

function createDashboardContext() {
  return {
    String,
    NORMAL_DASHBOARD_QUARANTINED_SECTION_KEYS: new Set(quarantineKeys),
    DASHBOARD_SECTION_KEYS: ["staffAccess", "pupilOnboarding", "bankMonitor", "analytics", "upcoming", "classes", "tests"],
    rootEl: { innerHTML: "" },
    state: {
      user: { email: "teacher@example.test" },
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
    escapeHtml: (value) => String(value ?? ""),
    renderCurrentSchoolContextRow: () => "",
    renderNotice: () => "",
    renderCreateBar: () => "",
    renderSectionStaffAccess: () => "",
    renderSectionPupilOnboarding: () => "",
    renderSectionWordloomCoreBankMonitor: () => "<section>Core bank monitor</section>",
    renderAnalyticsBar: () => "<section>Analytics</section>",
    renderSectionUpcomingAssignments: () => "<section>Assignment lifecycle</section>",
    renderSectionClasses: () => "<section>Your classes</section>",
    renderSectionTests: () => "<section>Advanced manual tools</section>",
    renderFloatingAIButton: () => "",
    syncAnalyticsThreadPosition: () => {},
    syncAnalyticsComposerHeight: () => {},
    syncTableScrollShells: () => {},
    syncTargetPopoverLayouts: () => {},
  };
}

assert.match(
  teacherViewSource,
  /NORMAL_DASHBOARD_QUARANTINED_SECTION_KEYS = new Set\(\["bankMonitor", "upcoming", "classes", "tests"\]\)/,
  "the normal dashboard quarantine should list the hidden standalone sections"
);
assert.match(
  teacherViewSource,
  /analytics: true/,
  "analytics should default open on first dashboard paint"
);

for (const [functionName, title] of [
  ["renderSectionWordloomCoreBankMonitor", "Core bank monitor"],
  ["renderSectionUpcomingAssignments", "Assignment lifecycle"],
  ["renderSectionClasses", "Your classes"],
  ["renderSectionTests", "Advanced manual tools"],
]) {
  assert.match(teacherViewSource, new RegExp(`function ${functionName}\\(`), `${functionName} should remain defined`);
  assert.match(teacherViewSource, new RegExp(title), `${title} renderer copy should remain available`);
}

const paintBlock = paintSource;
assert.match(paintBlock, /renderDashboardSection\("bankMonitor", renderSectionWordloomCoreBankMonitor\)/);
assert.match(paintBlock, /renderDashboardSection\("upcoming", renderSectionUpcomingAssignments\)/);
assert.match(paintBlock, /renderDashboardSection\("classes", renderSectionClasses\)/);
assert.match(paintBlock, /renderDashboardSection\("tests", renderSectionTests\)/);
assert.doesNotMatch(paintBlock, /\$\{renderSectionWordloomCoreBankMonitor\(\)\}/);
assert.doesNotMatch(paintBlock, /\$\{renderSectionUpcomingAssignments\(\)\}/);
assert.doesNotMatch(paintBlock, /\$\{renderSectionClasses\(\)\}/);
assert.doesNotMatch(paintBlock, /\$\{renderSectionTests\(\)\}/);

const normalContext = createDashboardContext();
const normalHtml = vm.runInNewContext(`${helperSource}\n${paintSource}\npaint(); rootEl.innerHTML;`, normalContext);
assert.match(normalHtml, /Analytics/);
assert.doesNotMatch(normalHtml, /Core bank monitor/);
assert.doesNotMatch(normalHtml, /Assignment lifecycle/);
assert.doesNotMatch(normalHtml, /Your classes/);
assert.doesNotMatch(normalHtml, /Advanced manual tools/);

const revealedContext = createDashboardContext();
const revealedHtml = vm.runInNewContext(
  `${helperSource}\n${paintSource}\nopenDashboardSection("tests"); paint(); rootEl.innerHTML;`,
  revealedContext
);
assert.equal(revealedContext.state.revealedQuarantinedSections.tests, true);
assert.equal(revealedContext.state.sections.tests, true);
assert.match(revealedHtml, /Advanced manual tools/);

const urlStateStart = teacherViewSource.indexOf("function applyUrlState()");
const urlStateEnd = teacherViewSource.indexOf("\nfunction togglePanelWithAnchoredScroll", urlStateStart);
assert.notEqual(urlStateStart, -1, "applyUrlState should exist");
assert.notEqual(urlStateEnd, -1, "applyUrlState slice should be bounded");
const urlStateSource = teacherViewSource.slice(urlStateStart, urlStateEnd);
assert.match(urlStateSource, /openDashboardSection\("tests"\)/, "openAssign fallback should still reveal manual assignment tools");

console.log("Passed teacher dashboard analytics-first quarantine checks.");
