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

function extractAuthRouteGuard(source) {
  const functionStart = source.indexOf("function shouldSkipAuthRouteForEvent(");
  assert.notEqual(functionStart, -1, "auth route guard should exist");
  const signatureEnd = source.indexOf("} = {}) {", functionStart);
  assert.notEqual(signatureEnd, -1, "auth route guard signature should be discoverable");
  const bodyStart = signatureEnd + "} = {}) ".length;

  let depth = 0;
  let functionEnd = -1;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        functionEnd = index + 1;
        break;
      }
    }
  }
  assert.notEqual(functionEnd, -1, "auth route guard should have a complete body");
  return vm.runInNewContext(`(${source.slice(functionStart, functionEnd)})`);
}

const appSource = readSource("js/app.js");
const teacherViewSource = readSource("js/teacherView.js");
const loginSource = readSource("login.html");
const shouldSkipAuthRouteForEvent = extractAuthRouteGuard(appSource);

assert.equal(
  shouldSkipAuthRouteForEvent({ authEvent: "TOKEN_REFRESHED" }),
  true,
  "token refreshes should not reload the current dashboard"
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
  "duplicate same-user teacher sign-ins should not reload a visible dashboard"
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
assert.equal(
  shouldSkipAuthRouteForEvent({ authEvent: "SIGNED_OUT" }),
  false,
  "sign-out should still route"
);
assert.equal(
  shouldSkipAuthRouteForEvent({ authEvent: "INITIAL_SESSION" }),
  false,
  "initial session handling should still route"
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
  assert.equal(
    handlerSource.includes("refreshAssignmentLifecycleUi"),
    true,
    `${label} filter should use the local lifecycle refresh path`
  );
  assert.equal(
    handlerSource.includes("paint();"),
    false,
    `${label} filter should not repaint the full teacher dashboard`
  );
  assert.equal(
    handlerSource.includes("if (nextFilter === getAssignment"),
    true,
    `${label} filter should skip rendering when the selected filter is unchanged`
  );
}

assert.equal(
  teacherViewSource.includes('data-role="assignment-lifecycle-body"'),
  true,
  "assignment lifecycle should expose a local replacement boundary"
);
assert.equal(appSource.includes('teacherView.js?v=7.01'), true);
assert.equal(loginSource.includes('app.js?v=5.130'), true);

console.log("Passed teacher dashboard auth and lifecycle render guard checks.");
