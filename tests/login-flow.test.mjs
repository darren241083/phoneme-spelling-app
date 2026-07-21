import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");

function readSource(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function countMatches(source, pattern) {
  return source.match(pattern)?.length || 0;
}

const loginSource = readSource("login.html");
const appSource = readSource("js/app.js");
const homeSource = readSource("index.html");

const loginViewStart = loginSource.indexOf('id="viewLogin"');
const teacherViewStart = loginSource.indexOf('id="viewTeacher"', loginViewStart);
assert.notEqual(loginViewStart, -1, "login page should expose a unified login view");
assert.notEqual(teacherViewStart, -1, "teacher dashboard mount should follow the login view");
const loginViewSource = loginSource.slice(loginViewStart, teacherViewStart);

for (const removedMarker of [
  "<h2>Choose role</h2>",
  'id="viewRole"',
  'id="btnTeacher"',
  'id="btnPupil"',
  "Back to role choice",
  "I&rsquo;m a teacher",
  "I&rsquo;m a pupil",
  "Staff login",
  "Pupil login",
  'id="staffEmail"',
  'id="staffPassword"',
  'id="btnStaffPasswordLogin"',
  'id="staffPasswordForm"',
  'id="pupilLoginForm"',
  'id="btnPupilLogin"',
  "Wordloom login",
  "Teacher tests, class presentation and pupil practice",
  "Sign in to Wordloom or open a quick sample.",
  'id="btnTryLesson"',
  "Try sample test",
  "loginSampleRow",
]) {
  assert.equal(
    loginSource.includes(removedMarker),
    false,
    `split or role-choice marker should be gone: ${removedMarker}`,
  );
}
assert.equal(loginViewSource.includes("Wordloom Login"), false, "visible login card should not repeat the page title");

for (const unifiedLoginMarker of [
  "<h2>Sign in</h2>",
  'id="btnGoogle"',
  "Continue with Google",
  'id="credentialLoginForm"',
  "Email or pupil username",
  'id="pupilClassCode"',
  "Password or PIN",
  'id="pupilCode"',
  'id="btnCredentialLogin"',
  ">Sign in</button>",
]) {
  assert.equal(
    loginViewSource.includes(unifiedLoginMarker),
    true,
    `single login should include ${unifiedLoginMarker}`,
  );
}

assert.equal(
  countMatches(loginViewSource, /type="submit"/g),
  1,
  "login card should have exactly one credential submit button",
);

assert.equal(appSource.includes("supabase.auth.signInWithOAuth({"), true);
assert.equal(appSource.includes('provider: "google"'), true);
assert.equal(appSource.includes('prompt: "select_account"'), true);

const submitStart = appSource.indexOf('credentialLoginForm?.addEventListener("submit"');
const submitEnd = appSource.indexOf('btnGoogle?.addEventListener("click"', submitStart);
assert.notEqual(submitStart, -1, "shared credential submit handler should exist");
assert.notEqual(submitEnd, -1, "shared credential submit handler end should be discoverable");
const submitSource = appSource.slice(submitStart, submitEnd);

assert.equal(
  submitSource.includes('const isStaffLogin = identifier.includes("@");'),
  true,
  "identifier containing @ should select staff email/password login",
);
assert.equal(
  submitSource.includes("supabase.auth.signInWithPassword({ email, password })"),
  true,
  "staff email/password login should use Supabase password auth",
);
assert.equal(
  submitSource.includes("await pupilLogin(username, pin)"),
  true,
  "non-email identifiers should use existing pupil username/PIN login",
);
assert.ok(
  submitSource.indexOf('if (isStaffLogin)') < submitSource.indexOf("supabase.auth.signInWithPassword"),
  "staff branch should guard Supabase password auth",
);
assert.ok(
  submitSource.indexOf("} else {") < submitSource.indexOf("await pupilLogin(username, pin)"),
  "pupil login should sit in the non-email branch",
);
assert.equal(submitSource.includes('setRole("teacher");'), true);
assert.equal(submitSource.includes('setRole("pupil");'), true);

assert.equal(appSource.includes('() => import("./authPupil.js?v=1.2")'), true);
assert.equal(appSource.includes("focus_sound"), false, "login app should not expose sample-test routing");
assert.equal(loginSource.includes("present.html?demo=focus_sound"), false);
assert.equal(homeSource.includes("./present.html?demo=focus_sound"), true);

assert.equal(appSource.includes('const ROLE_STORAGE_KEY = "ps_role_v1";'), true);
assert.equal(appSource.includes('const LEGACY_ROLE_STORAGE_KEY = "ps_role";'), true);
assert.equal(appSource.includes("localStorage.setItem(ROLE_STORAGE_KEY, oldRole)"), true);

const routeStart = appSource.indexOf("async function route()");
const routeEnd = appSource.indexOf('credentialLoginForm?.addEventListener("submit"', routeStart);
assert.notEqual(routeStart, -1, "route function should exist");
assert.notEqual(routeEnd, -1, "route function end should be discoverable");
const routeSource = appSource.slice(routeStart, routeEnd);

assert.equal(routeSource.includes("const role = getRole();"), true);
assert.equal(routeSource.includes('if (role === "pupil")'), true);
assert.equal(
  routeSource.includes("const automaticStaffSession = await readCurrentStaffSession({ reportErrors: false });"),
  true,
  "routing should detect existing staff Supabase sessions without requiring role choice",
);
assert.equal(
  routeSource.includes("await tryRenderStoredPupilSession({ rememberRole: true })"),
  true,
  "routing should detect existing pupil local sessions without requiring role choice",
);
assert.ok(
  routeSource.indexOf("const automaticStaffSession = await readCurrentStaffSession({ reportErrors: false });")
    < routeSource.indexOf("await tryRenderStoredPupilSession({ rememberRole: true })"),
  "when no role hint exists, staff Supabase sessions should be checked before pupil local sessions",
);

for (const source of [loginSource, appSource]) {
  assert.equal(source.includes("WORDLOOM_SMOKE"), false, "login flow must not hard-code smoke env names");
  assert.equal(source.includes("@wordloom.test"), false, "login flow must not hard-code smoke emails");
}

console.log("Passed single-form login-flow checks.");
