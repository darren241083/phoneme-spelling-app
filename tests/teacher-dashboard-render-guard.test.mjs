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

function extractNamedFunction(source, functionName, context = {}) {
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
  return vm.runInNewContext(`(${source.slice(functionStart, functionEnd)})`, context);
}

const appSource = readSource("js/app.js");
const teacherViewSource = readSource("js/teacherView.js");
const loginSource = readSource("login.html");
const shouldSkipAuthRouteForEvent = extractNamedFunction(appSource, "shouldSkipAuthRouteForEvent");

assert.equal(
  shouldSkipAuthRouteForEvent({ authEvent: "TOKEN_REFRESHED" }),
  false,
  "token refresh should still route before a completed dashboard exists"
);
assert.equal(
  shouldSkipAuthRouteForEvent({
    authEvent: "TOKEN_REFRESHED",
    sessionUserId: "teacher-1",
    role: "teacher",
    currentTeacherUserId: "teacher-1",
    teacherDashboardVisible: true,
  }),
  true,
  "token refresh should be suppressed for the completed same-user dashboard"
);
assert.equal(
  shouldSkipAuthRouteForEvent({
    authEvent: "SIGNED_IN",
    sessionUserId: "teacher-1",
    role: "teacher",
    currentTeacherUserId: "",
    teacherDashboardVisible: true,
  }),
  false,
  "duplicate sign-in should still route before first paint is complete"
);
assert.equal(
  shouldSkipAuthRouteForEvent({
    authEvent: "SIGNED_IN",
    sessionUserId: "teacher-1",
    role: "teacher",
    currentTeacherUserId: "teacher-1",
    teacherDashboardVisible: true,
  }),
  true,
  "duplicate sign-in should be suppressed after same-user first paint"
);
assert.equal(
  shouldSkipAuthRouteForEvent({
    authEvent: "SIGNED_IN",
    sessionUserId: "teacher-2",
    role: "teacher",
    currentTeacherUserId: "teacher-1",
    teacherDashboardVisible: true,
  }),
  false,
  "a genuine user change should still route"
);
assert.equal(
  shouldSkipAuthRouteForEvent({
    authEvent: "SIGNED_IN",
    sessionUserId: "teacher-1",
    role: "teacher",
    currentTeacherUserId: "teacher-1",
    teacherDashboardVisible: false,
  }),
  false,
  "a real sign-in should route when the teacher dashboard is not displayed"
);
assert.equal(shouldSkipAuthRouteForEvent({ authEvent: "SIGNED_OUT" }), false);
assert.equal(shouldSkipAuthRouteForEvent({ authEvent: "INITIAL_SESSION" }), false);

const timeoutLogs = [];
const timeoutConsole = {
  error: (...args) => timeoutLogs.push(["error", ...args]),
  warn: (...args) => timeoutLogs.push(["warn", ...args]),
};
const withTimeout = extractNamedFunction(appSource, "withTimeout", {
  Promise,
  String,
  clearTimeout,
  console: timeoutConsole,
  setTimeout,
});

let resolveLate;
const lateResolution = new Promise((resolve) => {
  resolveLate = resolve;
});
await assert.rejects(
  withTimeout(lateResolution, 5, "renderTeacherDashboard", {
    getLastStage: () => "core_data",
    logLateOutcome: true,
  }),
  /last stage: core_data/
);
resolveLate();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(
  timeoutLogs.some(([level, message, detail]) =>
    level === "warn"
    && message === "renderTeacherDashboard resolved after timeout"
    && detail?.lastStage === "core_data"
  ),
  true,
  "late render resolution should be logged with the last stage"
);

let rejectLate;
const lateRejection = new Promise((_, reject) => {
  rejectLate = reject;
});
await assert.rejects(
  withTimeout(lateRejection, 5, "renderTeacherDashboard", {
    getLastStage: () => "lifecycle_summary",
    logLateOutcome: true,
  }),
  /last stage: lifecycle_summary/
);
rejectLate(new Error("late render failure"));
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(
  timeoutLogs.some(([level, message, detail]) =>
    level === "error"
    && message === "renderTeacherDashboard rejected after timeout"
    && detail?.lastStage === "lifecycle_summary"
    && detail?.error?.message === "late render failure"
  ),
  true,
  "late render rejection should be logged with the last stage"
);

const renderStart = teacherViewSource.indexOf("export async function renderTeacherDashboard");
const renderEnd = teacherViewSource.indexOf("async function initialiseUser", renderStart);
assert.notEqual(renderStart, -1);
assert.notEqual(renderEnd, -1);
const renderSource = teacherViewSource.slice(renderStart, renderEnd);
const firstPaintIndex = renderSource.indexOf("paint();");
const firstPaintStageIndex = renderSource.indexOf('reportTeacherDashboardStage(onStage, "first_paint")');
const deferredStartIndex = renderSource.indexOf("void runDeferredTeacherDashboardEnrichment(renderContext)");
assert.ok(firstPaintIndex >= 0, "teacher dashboard should paint");
assert.ok(firstPaintStageIndex > firstPaintIndex, "first-paint stage should follow the paint");
assert.ok(
  deferredStartIndex > firstPaintStageIndex,
  "deferred enrichment should start only after first paint"
);
assert.equal(
  renderSource.includes("await runDeferredTeacherDashboardEnrichment"),
  false,
  "first paint must not await deferred enrichment"
);

for (const stage of [
  "user",
  "access_context",
  "core_data",
  "lifecycle_summary",
  "first_paint",
  "deferred_enrichment",
]) {
  assert.equal(
    teacherViewSource.includes(`"${stage}"`),
    true,
    `teacher render should report ${stage}`
  );
}
assert.equal(
  teacherViewSource.includes("await Promise.allSettled(tasks)"),
  true,
  "deferred enrichment failures should settle independently"
);
assert.equal(
  teacherViewSource.includes("isCurrentTeacherDashboardRender(renderContext)"),
  true,
  "deferred repaint should verify the active render"
);
assert.equal(
  appSource.includes("getLastStage: () => lastRenderStage"),
  true,
  "app render guard should include stage reporting"
);

const lifecycleHandlerStart = teacherViewSource.indexOf('if (action === "set-assignment-lifecycle-filter")');
const sourceHandlerStart = teacherViewSource.indexOf('if (action === "set-assignment-source-filter")', lifecycleHandlerStart);
const nextHandlerStart = teacherViewSource.indexOf('if (action === "open-results-assignment")', sourceHandlerStart);
assert.notEqual(lifecycleHandlerStart, -1);
assert.notEqual(sourceHandlerStart, -1);
assert.notEqual(nextHandlerStart, -1);

const lifecycleHandler = teacherViewSource.slice(lifecycleHandlerStart, sourceHandlerStart);
const sourceHandler = teacherViewSource.slice(sourceHandlerStart, nextHandlerStart);
for (const [label, handlerSource] of [
  ["lifecycle", lifecycleHandler],
  ["source", sourceHandler],
]) {
  assert.equal(handlerSource.includes("refreshAssignmentLifecycleUi"), true);
  assert.equal(handlerSource.includes("paint();"), false);
  assert.equal(handlerSource.includes("if (nextFilter === getAssignment"), true);
}

const followUpHandlerStart = teacherViewSource.indexOf('if (action === "toggle-assignment-pupil-follow-up")');
const followUpHandlerEnd = teacherViewSource.indexOf('if (action === "edit-assignment-due-date")', followUpHandlerStart);
assert.notEqual(followUpHandlerStart, -1);
assert.notEqual(followUpHandlerEnd, -1);
const followUpHandler = teacherViewSource.slice(followUpHandlerStart, followUpHandlerEnd);
assert.equal(followUpHandler.includes("refreshAssignmentLifecycleCard"), true);
for (const forbidden of [
  "paint();",
  "supabase",
  "refreshAssignmentLifecycleSummaries",
  "ensureAssignmentAnalytics",
  "teacherAnalyticsChat",
  ".rpc(",
]) {
  assert.equal(
    followUpHandler.includes(forbidden),
    false,
    `pupil follow-up toggle must not call ${forbidden}`
  );
}

const cardRefreshStart = teacherViewSource.indexOf("function refreshAssignmentLifecycleCard(");
const cardRefreshEnd = teacherViewSource.indexOf("function renderSectionUpcomingAssignments", cardRefreshStart);
assert.notEqual(cardRefreshStart, -1);
assert.notEqual(cardRefreshEnd, -1);
const cardRefreshSource = teacherViewSource.slice(cardRefreshStart, cardRefreshEnd);
assert.equal(cardRefreshSource.includes("replaceWith"), true);
assert.equal(cardRefreshSource.includes("paint();"), false);
assert.equal(cardRefreshSource.includes("supabase"), false);

assert.equal(teacherViewSource.includes('data-role="assignment-lifecycle-body"'), true);
assert.equal(teacherViewSource.includes('assignmentLifecycleView.js?v=1.5'), true);
assert.equal(teacherViewSource.includes("function renderManualAssignmentDeliveryControl"), true);
assert.equal(teacherViewSource.includes("MANUAL_ASSIGNMENT_DELIVERY_COPY.label"), true);
assert.equal(teacherViewSource.includes('name="delivery_model"'), true);
assert.equal(teacherViewSource.includes('data-field="manual-assignment-delivery"'), true);
assert.equal(appSource.includes('teacherView.js?v=7.10'), true);
assert.equal(loginSource.includes('app.js?v=5.143'), true);

console.log("Passed teacher dashboard initial-render guard checks.");
