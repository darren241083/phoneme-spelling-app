#!/usr/bin/env node

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const MARKER = "WORDLOOM_SMOKE_DO_NOT_DELETE";
const SCRIPT_NAME = "scripts/smoke/smoke-support-ladder-runtime.mjs";
const CREATE_FIXTURE_SCRIPT = "scripts/smoke/create-due-date-smoke-fixture.mjs";

const DEFAULT_IDS = {
  school: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d001",
  class: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d005",
  pupil: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d006",
  pupilClass: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d007",
  test: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d008",
  testWord: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d009",
  assignment: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d00a",
  status: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d00b",
  formClass: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d00c",
  pupilFormClass: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d00d",
  baselineStatus: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d00e",
};

const SCHOOL_SLUG = "wordloom-smoke-do-not-delete";
const CLASS_JOIN_CODE = "SMKDD1";
const FORM_CLASS_JOIN_CODE = "SMKFM1";
const PUPIL_USERNAME = "wordloom_smoke_do_not_delete_pupil";
const PUPIL_PIN = "0000";
const TEST_WORD = "rain";
const REQUIRED_BASELINE_STANDARD_KEY = "core_v2";
const LEGACY_DELIVERY_MODEL = "legacy_fixed";
const SUPPORT_DELIVERY_MODEL = "support_ladder";
const SUPPORT_PRESET = "balanced";

const MODES = new Set(["--dry-run", "--verify", "--scenario"]);
const SCENARIOS = new Map([
  ["correct-first-time", {
    title: "Correct first time",
    finalSupportState: "independent",
    finalCategory: "correct_first_time",
    finalCorrect: true,
    finalTyped: TEST_WORD,
    expectedAttempts: 1,
    counters: {
      independent_first_correct_words: 1,
      self_corrected_words: 0,
      supported_correct_words: 0,
      supported_incorrect_words: 0,
      access_issue_words: 0,
      headline_attempted_words: 1,
      headline_correct_words: 1,
      headline_score_rate: 1,
      total_words: 1,
      correct_words: 1,
      score_rate: 1,
    },
    steps: [
      `Type "${TEST_WORD}" on the independent screen.`,
      "Click Check.",
      "Confirm the word completes as Correct with 1 attempt.",
    ],
  }],
  ["correct-after-retry", {
    title: "Correct after retry",
    finalSupportState: "retry",
    finalCategory: "correct_after_retry",
    finalCorrect: true,
    finalTyped: TEST_WORD,
    expectedAttempts: 2,
    counters: {
      independent_first_correct_words: 0,
      self_corrected_words: 1,
      supported_correct_words: 0,
      supported_incorrect_words: 0,
      access_issue_words: 0,
      headline_attempted_words: 1,
      headline_correct_words: 0,
      headline_score_rate: 0,
      total_words: 1,
      correct_words: 1,
      score_rate: 1,
    },
    steps: [
      'Type an incorrect spelling such as "rane".',
      "Click Check and confirm it advances to retry without revealing the answer.",
      `Type "${TEST_WORD}".`,
      "Click Check and confirm the word completes as Correct after retry.",
    ],
  }],
  ["correct-with-support", {
    title: "Correct with support",
    finalSupportState: "supported",
    finalCategory: "correct_with_support",
    finalCorrect: true,
    finalTyped: TEST_WORD,
    expectedAttempts: 3,
    requiredSupportAction: "segmented_input",
    counters: {
      independent_first_correct_words: 0,
      self_corrected_words: 0,
      supported_correct_words: 1,
      supported_incorrect_words: 0,
      access_issue_words: 0,
      headline_attempted_words: 1,
      headline_correct_words: 0,
      headline_score_rate: 0,
      total_words: 1,
      correct_words: 1,
      score_rate: 1,
    },
    steps: [
      'Type an incorrect spelling such as "rane".',
      "Click Check and confirm it advances to retry without revealing the answer.",
      'Type a different incorrect spelling such as "rein".',
      "Click Check and confirm it advances to supported segmented input.",
      `Enter "${TEST_WORD}" in the segmented input.`,
      "Click Check and confirm the word completes as Correct with support.",
    ],
  }],
  ["incorrect-with-support", {
    title: "Incorrect with support",
    finalSupportState: "supported",
    finalCategory: "incorrect_with_support",
    finalCorrect: false,
    finalTyped: "rein",
    expectedAttempts: 3,
    requiredSupportAction: "segmented_input",
    counters: {
      independent_first_correct_words: 0,
      self_corrected_words: 0,
      supported_correct_words: 0,
      supported_incorrect_words: 1,
      access_issue_words: 0,
      headline_attempted_words: 1,
      headline_correct_words: 0,
      headline_score_rate: 0,
      total_words: 1,
      correct_words: 0,
      score_rate: 0,
    },
    steps: [
      'Type an incorrect spelling such as "rane".',
      "Click Check and confirm it advances to retry without revealing the answer.",
      'Type a different incorrect spelling such as "ran".',
      "Click Check and confirm it advances to supported segmented input.",
      'Enter an incorrect spelling such as "rein" in the segmented input.',
      "Click Check and confirm it completes as Incorrect with support.",
    ],
  }],
  ["access-issue", {
    title: "Access issue",
    finalSupportState: "access_issue",
    finalCategory: "access_issue",
    finalCorrect: null,
    finalTyped: "",
    expectedAttempts: 1,
    counters: {
      independent_first_correct_words: 0,
      self_corrected_words: 0,
      supported_correct_words: 0,
      supported_incorrect_words: 0,
      access_issue_words: 1,
      headline_attempted_words: 0,
      headline_correct_words: 0,
      headline_score_rate: null,
      total_words: 1,
      correct_words: 0,
      score_rate: 0,
    },
    steps: [
      'Click "I\'m not sure which word you mean".',
      "Confirm safe clarification opens and no spelling reveal is shown.",
      'Click "Try spelling it" and confirm it returns to spelling without reveal.',
      'Click "I\'m not sure which word you mean" again.',
      'Click "Still not sure".',
      "Confirm the feedback marks a word-meaning issue and still does not reveal the spelling.",
    ],
  }],
  ["blank-attempt", {
    title: "Blank independent attempt",
    blankOnly: true,
    expectedAttempts: 0,
    steps: [
      "Leave the independent input blank.",
      "Click Check.",
      'Confirm the UI shows "Type an answer first."',
      "Do not complete the word; return here and press Enter.",
    ],
  }],
]);

const SUPPORT_COUNTER_FIELDS = [
  "independent_first_correct_words",
  "self_corrected_words",
  "supported_correct_words",
  "supported_incorrect_words",
  "access_issue_words",
  "headline_attempted_words",
  "headline_correct_words",
  "headline_score_rate",
];

const ASSIGNMENT_SELECT = [
  "id",
  "teacher_id",
  "school_id",
  "class_id",
  "test_id",
  "end_at",
  "mode",
  "max_attempts",
  "evidence_source",
  "automation_kind",
  "automation_source",
  "automation_run_id",
  "delivery_model",
  "support_preset",
  "created_at",
].join(",");

const STATUS_SELECT = [
  "id",
  "teacher_id",
  "school_id",
  "assignment_id",
  "class_id",
  "test_id",
  "pupil_id",
  "status",
  "started_at",
  "completed_at",
  "last_opened_at",
  "last_activity_at",
  "total_words",
  "correct_words",
  "average_attempts",
  "score_rate",
  "result_json",
  ...SUPPORT_COUNTER_FIELDS,
].join(",");

const ATTEMPT_SELECT = [
  "id",
  "assignment_id",
  "pupil_id",
  "test_id",
  "test_word_id",
  "assignment_target_id",
  "typed",
  "correct",
  "is_correct",
  "attempt_number",
  "attempt_no",
  "delivery_model",
  "support_state",
  "evidence_category",
  "support_actions",
  "created_at",
].join(",");

const BROWSER_LAUNCH_FIELDS = [
  "delivery_model",
  "support_preset",
  "mode",
  "question_type",
  "attempt_source",
  "assignmentOrigin",
  "evidence_source",
];

let interruptRequested = false;
let resolveManualWait = null;

process.once("SIGINT", () => {
  interruptRequested = true;
  console.log("");
  console.log("Interrupt requested. The script will restore the smoke fixture before exiting.");
  console.log(`Emergency restore command if this process dies: WORDLOOM_SMOKE_CONFIRM=${MARKER} node ${CREATE_FIXTURE_SCRIPT} --reset`);
  if (resolveManualWait) resolveManualWait("interrupt");
});

main().catch((error) => {
  console.error(`ERROR: ${redactSecrets(error?.message || String(error))}`);
  process.exitCode = interruptRequested ? 130 : 1;
});

async function main() {
  if (typeof fetch !== "function") {
    throw new Error("This script requires Node.js with built-in fetch support.");
  }

  const parsed = parseMode(process.argv.slice(2));
  const env = readEnv();
  const config = buildConfig(parsed);

  if (parsed.mode === "--dry-run") {
    printDryRun(config, env);
    return;
  }

  requireRemoteEnv(env);
  if (parsed.mode === "--scenario") requireWriteEnv(env);

  const admin = createSupabaseClient(env.supabaseUrl, env.serviceRoleKey, "service role");
  const runtime = createSupabaseClient(env.supabaseUrl, env.anonKey, "anon runtime");

  if (parsed.mode === "--verify") {
    const report = await inspectFixture(admin, config);
    const runtimeReport = await inspectRuntime(runtime, config);
    const gateReport = await inspectBaselineGate(runtime, config);
    printVerifyReport(report, runtimeReport, gateReport, config);
    if (!report.complete || !report.safe || !runtimeReport.ok || !gateReport.ready || !baselineStatusMatchesGate(report, gateReport)) {
      process.exitCode = 1;
    }
    return;
  }

  await runScenario(admin, runtime, config);
}

function parseMode(args) {
  if (args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  let mode = "--dry-run";
  let scenario = "";
  const seenModes = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run" || arg === "--verify") {
      mode = arg;
      seenModes.push(arg);
      continue;
    }
    if (arg === "--scenario") {
      mode = arg;
      seenModes.push(arg);
      scenario = String(args[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--scenario=")) {
      mode = "--scenario";
      seenModes.push("--scenario");
      scenario = arg.slice("--scenario=".length).trim();
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unsupported option: ${arg}`);
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (seenModes.length > 1) {
    throw new Error(`Choose exactly one mode flag; got ${seenModes.join(", ")}.`);
  }
  if (mode === "--scenario" && !SCENARIOS.has(scenario)) {
    throw new Error(`Unsupported scenario "${scenario}". Use one of: ${[...SCENARIOS.keys()].join(", ")}.`);
  }
  return { mode, scenario };
}

function printHelp() {
  console.log(`${SCRIPT_NAME}

Temporarily toggles the fixed Wordloom smoke assignment to Support Ladder for manual runtime checks, then restores it.

Modes:
  --dry-run              Local-only preview. Does not contact Supabase. Default.
  --verify               Read-only remote fixture/runtime verification.
  --scenario <name>      REMOTE/PRODUCTION WRITE: toggle, wait for manual test, verify, restore.

Scenarios:
  ${[...SCENARIOS.keys()].join("\n  ")}

Write mode requires:
  WORDLOOM_SMOKE_CONFIRM=${MARKER}
  WORDLOOM_SUPABASE_URL
  WORDLOOM_SUPABASE_SERVICE_ROLE_KEY
  WORDLOOM_SUPABASE_ANON_KEY
`);
}

function readEnv() {
  return {
    supabaseUrl: cleanEnv("WORDLOOM_SUPABASE_URL"),
    serviceRoleKey: cleanEnv("WORDLOOM_SUPABASE_SERVICE_ROLE_KEY"),
    anonKey: cleanEnv("WORDLOOM_SUPABASE_ANON_KEY"),
    confirm: cleanEnv("WORDLOOM_SMOKE_CONFIRM"),
  };
}

function cleanEnv(name) {
  return String(process.env[name] || "").trim();
}

function buildConfig(parsed) {
  return {
    ids: { ...DEFAULT_IDS },
    scenarioName: parsed.scenario,
    scenario: parsed.scenario ? SCENARIOS.get(parsed.scenario) : null,
    fields: {
      delivery_model: SUPPORT_DELIVERY_MODEL,
      support_preset: SUPPORT_PRESET,
    },
  };
}

function requireRemoteEnv(env) {
  const missing = [];
  if (!env.supabaseUrl) missing.push("WORDLOOM_SUPABASE_URL");
  if (!env.serviceRoleKey) missing.push("WORDLOOM_SUPABASE_SERVICE_ROLE_KEY");
  if (!env.anonKey) missing.push("WORDLOOM_SUPABASE_ANON_KEY");
  if (missing.length) {
    throw new Error(`Missing required env for remote verification: ${missing.join(", ")}.`);
  }
}

function requireWriteEnv(env) {
  const missing = [];
  if (env.confirm !== MARKER) missing.push(`WORDLOOM_SMOKE_CONFIRM=${MARKER}`);
  if (!env.supabaseUrl) missing.push("WORDLOOM_SUPABASE_URL");
  if (!env.serviceRoleKey) missing.push("WORDLOOM_SUPABASE_SERVICE_ROLE_KEY");
  if (!env.anonKey) missing.push("WORDLOOM_SUPABASE_ANON_KEY");
  if (missing.length) {
    throw new Error(`Refusing write mode. Missing required guard/env: ${missing.join(", ")}.`);
  }
}

function printDryRun(config, env) {
  console.log("Mode: --dry-run (local only; no remote reads or writes)");
  console.log(`Marker: ${MARKER}`);
  console.log("");
  printFixtureIds(config);
  console.log("");
  console.log("Temporary scenario patch:");
  console.log(`  assignments_v2.delivery_model = ${SUPPORT_DELIVERY_MODEL}`);
  console.log(`  assignments_v2.support_preset = ${SUPPORT_PRESET}`);
  console.log("  tests.delivery_model is not changed");
  console.log("  end_at is not changed");
  console.log("");
  console.log("Safety checks before writes:");
  console.log("  fixed smoke school/class/pupil/test/test word markers");
  console.log("  fixed smoke form class and active form membership");
  console.log("  read_pupil_baseline_gate_state is ready for the smoke pupil");
  console.log("  no waiting/provisioning personalised generation rows for the smoke pupil");
  console.log("  fixed assignment/status relationships");
  console.log("  exactly one assignment row patched");
  console.log("  exactly one status row reset");
  console.log("  attempts delete is scoped to fixed assignment/pupil/test");
  console.log("");
  console.log("Restore actions:");
  console.log(`  delivery_model -> ${LEGACY_DELIVERY_MODEL}`);
  console.log("  support_preset -> null");
  console.log("  delete fixed smoke attempts");
  console.log("  reset fixed smoke status progress and support-ladder counters");
  console.log("");
  console.log("Scenarios:");
  for (const [name, scenario] of SCENARIOS) {
    console.log(`  ${name}: ${scenario.title}`);
  }
  console.log("");
  console.log("Environment readiness:");
  console.log(`  WORDLOOM_SUPABASE_URL: ${env.supabaseUrl ? "set" : "missing"}`);
  console.log(`  WORDLOOM_SUPABASE_SERVICE_ROLE_KEY: ${env.serviceRoleKey ? "set (redacted)" : "missing"}`);
  console.log(`  WORDLOOM_SUPABASE_ANON_KEY: ${env.anonKey ? "set (redacted)" : "missing"}`);
  console.log(`  WORDLOOM_SMOKE_CONFIRM: ${env.confirm === MARKER ? "set" : "missing or not confirmed"}`);
}

function printFixtureIds(config) {
  console.log(`Smoke school id: ${config.ids.school}`);
  console.log(`Smoke class id: ${config.ids.class}`);
  console.log(`Smoke form class id: ${config.ids.formClass}`);
  console.log(`Smoke pupil id: ${config.ids.pupil}`);
  console.log(`Smoke pupil form membership id: ${config.ids.pupilFormClass}`);
  console.log(`Smoke test id: ${config.ids.test}`);
  console.log(`Smoke test word id: ${config.ids.testWord}`);
  console.log(`Smoke assignment id: ${config.ids.assignment}`);
  console.log(`Smoke status id: ${config.ids.status}`);
  console.log(`Smoke baseline gate status id: ${config.ids.baselineStatus}`);
  console.log(`Smoke pupil login: ${PUPIL_USERNAME} / PIN ${PUPIL_PIN}`);
}

function createSupabaseClient(rawBaseUrl, key, label) {
  const baseUrl = rawBaseUrl.replace(/\/+$/, "");

  async function request(path, { method = "GET", body, headers: extraHeaders = {} } = {}, requestLabel = "Supabase request") {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...extraHeaders,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(new URL(path, `${baseUrl}/`), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return parseResponse(response, `${label} ${requestLabel}`);
  }

  return {
    request,
    selectRows(table, filters = [], select = "*") {
      const params = [["select", select]];
      for (const filter of filters) params.push([filter.column, `${filter.op || "eq"}.${filter.value}`]);
      return request(restPath(table, params), { method: "GET" }, `select ${table}`);
    },
    patchRows(table, filters = [], patch = {}, select = "*") {
      const params = [["select", select]];
      for (const filter of filters) params.push([filter.column, `${filter.op || "eq"}.${filter.value}`]);
      return request(restPath(table, params), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: patch,
      }, `patch ${table}`);
    },
    deleteRows(table, filters = [], select = "id") {
      const params = [["select", select]];
      for (const filter of filters) params.push([filter.column, `${filter.op || "eq"}.${filter.value}`]);
      return request(restPath(table, params), {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      }, `delete ${table}`);
    },
    readRuntimeAssignments(pupilId) {
      return request("rest/v1/rpc/read_pupil_runtime_assignments", {
        method: "POST",
        body: { requested_pupil_id: pupilId },
      }, "read pupil runtime assignments");
    },
    readBaselineGateState(pupilId) {
      return request("rest/v1/rpc/read_pupil_baseline_gate_state", {
        method: "POST",
        body: {
          requested_pupil_id: pupilId,
          requested_standard_key: REQUIRED_BASELINE_STANDARD_KEY,
        },
      }, "read pupil baseline gate state");
    },
  };
}

function restPath(table, params = []) {
  const query = params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `rest/v1/${table}${query ? `?${query}` : ""}`;
}

async function parseResponse(response, label) {
  const text = await response.text();
  const body = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`${label} failed (${response.status}): ${redactSecrets(detail || response.statusText)}`);
  }
  return body;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function inspectFixture(client, config) {
  const rows = {};
  const missing = [];
  const errors = [];
  const drift = [];

  rows.school = await selectOne(client, "schools", [{ column: "id", value: config.ids.school }]);
  if (!rows.school) rows.school = await selectOne(client, "schools", [{ column: "slug", value: SCHOOL_SLUG }]);
  checkRow("school", rows.school, missing, errors, (row) =>
    row.id === config.ids.school && row.slug === SCHOOL_SLUG && hasMarker(row)
  );

  rows.class = await selectOne(client, "classes", [{ column: "id", value: config.ids.class }]);
  checkRow("class", rows.class, missing, errors, (row) =>
    row.id === config.ids.class &&
    row.school_id === config.ids.school &&
    row.join_code === CLASS_JOIN_CODE &&
    hasMarker(row)
  );

  rows.formClass = await selectOne(client, "classes", [{ column: "id", value: config.ids.formClass }]);
  rows.formClassByJoinCode = await selectOne(client, "classes", [{ column: "join_code", value: FORM_CLASS_JOIN_CODE }]);
  if (rows.formClassByJoinCode && rows.formClassByJoinCode.id !== config.ids.formClass) {
    errors.push("smoke form class join code belongs to another row");
  }
  checkRow("form class", rows.formClass, missing, errors, (row) =>
    row.id === config.ids.formClass &&
    row.school_id === config.ids.school &&
    row.teacher_id === rows.class?.teacher_id &&
    row.name === `${MARKER} Current Form` &&
    row.join_code === FORM_CLASS_JOIN_CODE &&
    row.year_group === "Smoke" &&
    row.class_type === "form" &&
    row.department_key === null &&
    hasMarker(row)
  );

  rows.pupil = await selectOne(client, "pupils", [{ column: "id", value: config.ids.pupil }]);
  checkRow("pupil", rows.pupil, missing, errors, (row) =>
    row.id === config.ids.pupil &&
    row.school_id === config.ids.school &&
    row.username === PUPIL_USERNAME &&
    row.is_active === true &&
    hasMarker(row)
  );

  rows.pupilClass = await selectOne(client, "pupil_classes", [{ column: "id", value: config.ids.pupilClass }]);
  checkRow("pupil class membership", rows.pupilClass, missing, errors, (row) =>
    row.id === config.ids.pupilClass &&
    row.school_id === config.ids.school &&
    row.class_id === config.ids.class &&
    row.pupil_id === config.ids.pupil &&
    row.active === true &&
    hasMarker(row)
  );

  rows.pupilFormClass = await selectOne(client, "pupil_classes", [{ column: "id", value: config.ids.pupilFormClass }]);
  rows.pupilFormClassByPair = await selectOne(client, "pupil_classes", [
    { column: "class_id", value: config.ids.formClass },
    { column: "pupil_id", value: config.ids.pupil },
    { column: "active", value: "true", op: "is" },
  ]);
  if (rows.pupilFormClassByPair && rows.pupilFormClassByPair.id !== config.ids.pupilFormClass) {
    errors.push("active smoke pupil form membership exists under a non-fixed id");
  }
  checkRow("pupil form membership", rows.pupilFormClass, missing, errors, (row) =>
    row.id === config.ids.pupilFormClass &&
    row.school_id === config.ids.school &&
    row.class_id === config.ids.formClass &&
    row.pupil_id === config.ids.pupil &&
    row.active === true &&
    !row.left_at &&
    !row.ended_at &&
    !row.ended_by &&
    !row.ended_reason &&
    hasMarker(row)
  );

  rows.test = await selectOne(client, "tests", [{ column: "id", value: config.ids.test }]);
  checkRow("test", rows.test, missing, errors, (row) =>
    row.id === config.ids.test &&
    row.school_id === config.ids.school &&
    row.teacher_id === rows.class?.teacher_id &&
    row.status === "published" &&
    hasMarker(row)
  );
  if (rows.test && rows.test.delivery_model && rows.test.delivery_model !== LEGACY_DELIVERY_MODEL) {
    drift.push(`test delivery_model is ${rows.test.delivery_model}; this script will not change tests.delivery_model`);
  }
  if (rows.test && rows.test.support_preset !== null && rows.test.support_preset !== undefined) {
    drift.push(`test support_preset is ${rows.test.support_preset}; this script will not change tests.support_preset`);
  }

  rows.testWord = await selectOne(client, "test_words", [{ column: "id", value: config.ids.testWord }]);
  checkRow("test word", rows.testWord, missing, errors, (row) =>
    row.id === config.ids.testWord &&
    row.test_id === config.ids.test &&
    row.school_id === config.ids.school &&
    String(row.word || "").trim().toLowerCase() === TEST_WORD &&
    hasMarker(row)
  );

  rows.assignment = await selectOne(client, "assignments_v2", [{ column: "id", value: config.ids.assignment }]);
  checkRow("assignment", rows.assignment, missing, errors, (row) =>
    row.id === config.ids.assignment &&
    row.school_id === config.ids.school &&
    row.teacher_id === rows.class?.teacher_id &&
    row.class_id === config.ids.class &&
    row.test_id === config.ids.test
  );
  if (rows.assignment && rows.assignment.evidence_source !== "assigned_core") {
    drift.push(`assignment evidence_source is ${rows.assignment.evidence_source || "null"}, expected assigned_core`);
  }
  if (rows.assignment && (rows.assignment.automation_kind || rows.assignment.automation_source || rows.assignment.automation_run_id)) {
    errors.push("assignment has automation fields set; refusing support-ladder smoke writes");
  }

  rows.status = await selectOne(client, "assignment_pupil_statuses", [{ column: "id", value: config.ids.status }]);
  checkRow("assignment pupil status", rows.status, missing, errors, (row) =>
    row.id === config.ids.status &&
    row.school_id === config.ids.school &&
    row.teacher_id === rows.class?.teacher_id &&
    row.assignment_id === config.ids.assignment &&
    row.class_id === config.ids.class &&
    row.test_id === config.ids.test &&
    row.pupil_id === config.ids.pupil
  );
  if (rows.status && rows.status.status !== "assigned") {
    drift.push(`assignment pupil status is ${rows.status.status}, expected assigned`);
  }
  if (rows.status && (rows.status.started_at || rows.status.completed_at || rows.status.last_opened_at || rows.status.last_activity_at)) {
    drift.push("assignment pupil status has progress timestamps");
  }
  if (rows.status && (
    Number(rows.status.total_words || 0) !== 0 ||
    Number(rows.status.correct_words || 0) !== 0 ||
    Number(rows.status.average_attempts || 0) !== 0 ||
    Number(rows.status.score_rate || 0) !== 0
  )) {
    drift.push("assignment pupil status has score counters");
  }
  if (rows.status && SUPPORT_COUNTER_FIELDS.some((field) => rows.status[field] !== null && rows.status[field] !== undefined)) {
    drift.push("assignment pupil status has support-ladder counters");
  }

  rows.baselineStatus = await selectOne(client, "assignment_pupil_statuses", [{ column: "id", value: config.ids.baselineStatus }]);
  checkRow("baseline gate status", rows.baselineStatus, missing, errors, (row) =>
    row.id === config.ids.baselineStatus &&
    row.pupil_id === config.ids.pupil &&
    row.status === "completed" &&
    !!row.completed_at
  );

  rows.attempts = await client.selectRows("attempts", [
    { column: "assignment_id", value: config.ids.assignment },
    { column: "pupil_id", value: config.ids.pupil },
  ], ATTEMPT_SELECT);
  const foreignAttempts = rows.attempts.filter((row) => String(row?.test_id || "") !== config.ids.test);
  if (foreignAttempts.length) {
    errors.push(`found ${foreignAttempts.length} smoke assignment attempt(s) outside the fixed test id`);
  }
  if (rows.attempts.length) {
    drift.push(`assignment has ${rows.attempts.length} smoke attempt row(s)`);
  }

  rows.personalisedBlockingRows = await readBlockingPersonalisedRows(client, config);
  if (rows.personalisedBlockingRows.length) {
    errors.push(`found ${rows.personalisedBlockingRows.length} waiting/provisioning personalised generation row(s) for the smoke pupil`);
  }

  return {
    complete: missing.length === 0,
    safe: errors.length === 0,
    baseline: missing.length === 0 && errors.length === 0 && drift.length === 0,
    missing,
    errors,
    drift,
    rows,
  };
}

async function selectOne(client, table, filters = [], select = "*") {
  const rows = await client.selectRows(table, filters, select);
  if (!Array.isArray(rows)) throw new Error(`Select ${table} returned an unexpected response.`);
  if (rows.length > 1) throw new Error(`Expected at most one ${table} row, found ${rows.length}.`);
  return rows[0] || null;
}

function checkRow(label, row, missing, errors, isSafe) {
  if (!row) {
    missing.push(label);
    return;
  }
  if (!isSafe(row)) {
    errors.push(`${label} exists but does not match the smoke fixture shape`);
  }
}

async function inspectRuntime(runtimeClient, config) {
  const payload = await runtimeClient.readRuntimeAssignments(config.ids.pupil);
  const normalized = normalizeRuntimePayload(payload, config.ids.pupil);
  const assignment = findRuntimeAssignment(normalized, config.ids.assignment);
  const ok = normalized.status === "ok" && normalized.pupilId === config.ids.pupil;
  return { ok, payload: normalized, assignment };
}

async function inspectBaselineGate(runtimeClient, config) {
  const payload = await runtimeClient.readBaselineGateState(config.ids.pupil);
  const normalized = normalizeBaselineGatePayload(payload);
  return {
    ready: isSmokeBaselineGateReady(normalized, config),
    payload: normalized,
  };
}

function normalizeRuntimePayload(payload, requestedPupilId) {
  const source = payload && typeof payload === "object" ? payload : {};
  const assignments = Array.isArray(source.assignments)
    ? source.assignments
    : Array.isArray(payload)
      ? payload
      : [];
  return {
    status: String(source.status || "ok").trim().toLowerCase() || "ok",
    pupilId: String(source.pupil_id || source.pupilId || requestedPupilId).trim(),
    assignments,
  };
}

function findRuntimeAssignment(runtimePayload, assignmentId) {
  return (runtimePayload.assignments || [])
    .find((row) => String(row?.id || "").trim() === assignmentId) || null;
}

async function readBlockingPersonalisedRows(client, config) {
  const rows = await client.selectRows("personalised_generation_run_pupils", [
    { column: "pupil_id", value: config.ids.pupil },
    { column: "status", value: "(waiting,provisioning)", op: "in" },
  ], "id,run_id,class_id,pupil_id,status,assignment_id,updated_at");
  assertArrayResponse(rows, "Personalised generation blocker check");
  return rows;
}

function normalizeBaselineGatePayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  return {
    status: String(source.status || "waiting").trim().toLowerCase() || "waiting",
    waitingReason: String(source.waiting_reason ?? source.waitingReason ?? "").trim().toLowerCase() || null,
    assignmentId: String(source.assignment_id ?? source.assignmentId ?? source.assignment?.id ?? "").trim(),
    completedAssignmentId: String(source.completed_assignment_id ?? source.completedAssignmentId ?? "").trim(),
    requiredStandardKey: String(source.required_standard_key ?? source.requiredStandardKey ?? REQUIRED_BASELINE_STANDARD_KEY).trim().toLowerCase() || REQUIRED_BASELINE_STANDARD_KEY,
    classIds: normalizeIdList(source.class_ids ?? source.classIds),
    formClassIds: normalizeIdList(source.form_class_ids ?? source.formClassIds),
  };
}

function normalizeIdList(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(
    source
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )];
}

function isSmokeBaselineGateReady(gateState, config) {
  return gateState?.status === "ready"
    && gateState.formClassIds.includes(config.ids.formClass)
    && !!gateState.completedAssignmentId;
}

function baselineStatusMatchesGate(fixtureReport, gateReport) {
  const row = fixtureReport?.rows?.baselineStatus || null;
  const completedAssignmentId = String(gateReport?.payload?.completedAssignmentId || "").trim();
  return !!row
    && !!completedAssignmentId
    && String(row.assignment_id || "").trim() === completedAssignmentId
    && String(row.pupil_id || "").trim() === fixtureReport?.rows?.pupil?.id
    && String(row.status || "").trim().toLowerCase() === "completed"
    && !!row.completed_at;
}

function formatIdList(values = []) {
  const list = normalizeIdList(values);
  return list.length ? list.join(",") : "[]";
}

function formatBaselineGateNotReady(gateState, config) {
  return [
    "baseline gate is not ready",
    `status=${gateState?.status || "null"}`,
    `waiting_reason=${gateState?.waitingReason || "null"}`,
    `form_class_ids=${formatIdList(gateState?.formClassIds)}`,
    `completed_assignment_id=${gateState?.completedAssignmentId || "null"}`,
    `expected_form_class_id=${config.ids.formClass}`,
  ].join("; ");
}

function printVerifyReport(report, runtimeReport, gateReport, config) {
  console.log("Mode: --verify (remote read-only)");
  printFixtureIds(config);
  console.log("");
  console.log(`Fixture complete: ${report.complete ? "yes" : "no"}`);
  console.log(`Fixture safe: ${report.safe ? "yes" : "no"}`);
  console.log(`Fixture baseline clean: ${report.baseline ? "yes" : "no"}`);
  if (report.missing.length) console.log(`Missing: ${report.missing.join(", ")}`);
  if (report.errors.length) console.log(`Unsafe: ${report.errors.join("; ")}`);
  if (report.drift.length) console.log(`Drift: ${report.drift.join("; ")}`);
  console.log("");
  console.log(`Baseline gate status: ${gateReport.payload.status}`);
  console.log(`Baseline gate waiting reason: ${gateReport.payload.waitingReason || "null"}`);
  console.log(`Baseline gate form class ids: ${formatIdList(gateReport.payload.formClassIds)}`);
  console.log(`Baseline gate completed assignment id: ${gateReport.payload.completedAssignmentId || "null"}`);
  console.log(`Baseline gate ready: ${gateReport.ready ? "yes" : "no"}`);
  console.log(`Baseline gate fixed status matches: ${baselineStatusMatchesGate(report, gateReport) ? "yes" : "no"}`);
  console.log(`Waiting/provisioning personalised rows for smoke pupil: ${report.rows.personalisedBlockingRows?.length || 0}`);
  console.log("");
  console.log(`Current assignment delivery_model: ${report.rows.assignment?.delivery_model || "(missing)"}`);
  console.log(`Current assignment support_preset: ${formatNullable(report.rows.assignment?.support_preset)}`);
  console.log(`Current assignment end_at: ${formatNullable(report.rows.assignment?.end_at)}`);
  console.log(`Current test delivery_model: ${report.rows.test?.delivery_model || "(missing/default)"}`);
  console.log(`Current test support_preset: ${formatNullable(report.rows.test?.support_preset)}`);
  console.log("");
  console.log(`Runtime RPC status: ${runtimeReport.payload.status}`);
  console.log(`Runtime pupil id: ${runtimeReport.payload.pupilId}`);
  if (runtimeReport.assignment) {
    console.log("Runtime smoke assignment visible: yes");
    console.log(`Runtime delivery_model: ${runtimeReport.assignment.delivery_model || "(missing)"}`);
    console.log(`Runtime support_preset: ${formatNullable(runtimeReport.assignment.support_preset)}`);
    printBrowserLaunchDiagnostics(runtimeReport.assignment);
  } else {
    console.log("Runtime smoke assignment visible: no");
  }
}

async function runScenario(admin, runtime, config) {
  const scenario = config.scenario;
  let writeApplied = false;
  let startingEndAt = null;

  console.log(`Mode: --scenario ${config.scenarioName} (REMOTE/PRODUCTION WRITE)`);
  console.log(`Scenario: ${scenario.title}`);
  console.log("");
  printFixtureIds(config);
  console.log("");
  console.log(`Emergency restore command if needed: WORDLOOM_SMOKE_CONFIRM=${MARKER} node ${CREATE_FIXTURE_SCRIPT} --reset`);

  try {
    const report = await inspectFixture(admin, config);
    validateFixtureForWrite(report);
    const gateReport = await inspectBaselineGate(runtime, config);
    validateBaselineGateForWrite(gateReport, report, config);
    console.log("Baseline gate readiness verified: yes");
    startingEndAt = report.rows.assignment.end_at || null;

    writeApplied = true;
    const preReset = await resetSmokeProgress(admin, config, report.rows);
    console.log(`Pre-test smoke attempts deleted: ${preReset.attemptsDeleted}`);
    console.log("Pre-test status reset verified: yes");

    const patched = await patchAssignmentDelivery(admin, config, {
      deliveryModel: SUPPORT_DELIVERY_MODEL,
      supportPreset: SUPPORT_PRESET,
    });
    assertSameNullableInstant(patched.end_at, startingEndAt, "assignment end_at changed during support-ladder patch");
    console.log(`Temporary assignment delivery_model: ${patched.delivery_model}`);
    console.log(`Temporary assignment support_preset: ${patched.support_preset}`);

    const runtimeReport = await inspectRuntime(runtime, config);
    assertRuntimeSupportLadder(runtimeReport, config);
    printBrowserLaunchDiagnostics(runtimeReport.assignment);
    assertRuntimeBrowserLaunchSupportLadder(runtimeReport.assignment);
    console.log("Runtime support-ladder visibility verified: yes");

    printManualInstructions(config);
    await waitForManualPass();
    if (interruptRequested) throw new Error("Interrupted before scenario verification.");

    await verifyScenarioOutcome(admin, config, scenario, startingEndAt);
    console.log(`Scenario verification passed: ${config.scenarioName}`);
  } finally {
    if (writeApplied) {
      const restoreReport = await restoreFixture(admin, runtime, config, startingEndAt);
      console.log("Restore verified: yes");
      console.log(`Restored attempts deleted: ${restoreReport.reset.attemptsDeleted}`);
    }
  }

  console.log("SUPPORT LADDER SMOKE SCENARIO PASSED");
}

function validateFixtureForWrite(report) {
  if (!report.complete) {
    throw new Error(`Refusing write mode because the smoke fixture is incomplete: ${report.missing.join(", ")}.`);
  }
  if (!report.safe) {
    throw new Error(`Refusing write mode because the smoke fixture is unsafe: ${report.errors.join("; ")}.`);
  }
}

function validateBaselineGateForWrite(gateReport, fixtureReport, config) {
  if (!gateReport.ready) {
    throw new Error(`Refusing write mode because ${formatBaselineGateNotReady(gateReport.payload, config)}.`);
  }
  if (!baselineStatusMatchesGate(fixtureReport, gateReport)) {
    throw new Error("Refusing write mode because the fixed baseline gate status row does not match the gate completed assignment.");
  }
  const blockers = fixtureReport.rows.personalisedBlockingRows || [];
  if (blockers.length) {
    throw new Error(`Refusing write mode because ${blockers.length} waiting/provisioning personalised generation row(s) exist for the smoke pupil.`);
  }
}

async function patchAssignmentDelivery(client, config, { deliveryModel, supportPreset }) {
  const rows = await client.patchRows("assignments_v2", [
    { column: "id", value: config.ids.assignment },
    { column: "class_id", value: config.ids.class },
    { column: "test_id", value: config.ids.test },
  ], {
    delivery_model: deliveryModel,
    support_preset: supportPreset,
  }, ASSIGNMENT_SELECT);
  assertArrayResponse(rows, "Assignment delivery patch");
  if (rows.length !== 1 || rows[0]?.id !== config.ids.assignment) {
    throw new Error("Assignment delivery patch did not update exactly one expected smoke assignment row.");
  }
  return rows[0];
}

async function resetSmokeProgress(client, config, fixtureRows) {
  const assignment = fixtureRows.assignment || {};
  const statusFilters = [
    { column: "id", value: config.ids.status },
    { column: "assignment_id", value: config.ids.assignment },
    { column: "pupil_id", value: config.ids.pupil },
    { column: "test_id", value: config.ids.test },
  ];
  const attemptFilters = [
    { column: "assignment_id", value: config.ids.assignment },
    { column: "pupil_id", value: config.ids.pupil },
    { column: "test_id", value: config.ids.test },
  ];

  const attempts = await client.deleteRows("attempts", attemptFilters, "id,assignment_id,pupil_id,test_id");
  assertArrayResponse(attempts, "Smoke attempts delete");

  const statusRows = await client.patchRows("assignment_pupil_statuses", statusFilters, {
    teacher_id: assignment.teacher_id,
    school_id: assignment.school_id,
    assignment_id: config.ids.assignment,
    class_id: config.ids.class,
    test_id: config.ids.test,
    pupil_id: config.ids.pupil,
    status: "assigned",
    started_at: null,
    completed_at: null,
    last_opened_at: null,
    last_activity_at: null,
    total_words: 0,
    correct_words: 0,
    average_attempts: 0,
    score_rate: 0,
    result_json: [],
    independent_first_correct_words: null,
    self_corrected_words: null,
    supported_correct_words: null,
    supported_incorrect_words: null,
    access_issue_words: null,
    headline_attempted_words: null,
    headline_correct_words: null,
    headline_score_rate: null,
    updated_at: new Date().toISOString(),
  }, STATUS_SELECT);
  assertArrayResponse(statusRows, "Smoke status reset");
  if (statusRows.length !== 1 || statusRows[0]?.id !== config.ids.status) {
    throw new Error("Smoke status reset did not update exactly one expected status row.");
  }

  return {
    attemptsDeleted: attempts.length,
    status: statusRows[0],
  };
}

function assertRuntimeSupportLadder(runtimeReport, config) {
  if (!runtimeReport.ok) {
    throw new Error(`Runtime RPC returned status ${runtimeReport.payload.status} for pupil ${runtimeReport.payload.pupilId}.`);
  }
  const assignment = runtimeReport.assignment;
  if (!assignment) {
    throw new Error("Smoke assignment was not visible in pupil runtime after support-ladder patch.");
  }
  if (assignment.delivery_model !== SUPPORT_DELIVERY_MODEL) {
    throw new Error(`Runtime delivery_model is ${assignment.delivery_model || "null"}, expected ${SUPPORT_DELIVERY_MODEL}.`);
  }
  if (assignment.support_preset !== SUPPORT_PRESET) {
    throw new Error(`Runtime support_preset is ${assignment.support_preset || "null"}, expected ${SUPPORT_PRESET}.`);
  }
}

function readFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function normalizeRuntimeKey(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeDeliveryModel(value = "") {
  const key = normalizeRuntimeKey(value);
  if (key === "supportladder" || key === "ladder") return SUPPORT_DELIVERY_MODEL;
  return key === SUPPORT_DELIVERY_MODEL ? SUPPORT_DELIVERY_MODEL : LEGACY_DELIVERY_MODEL;
}

function isExcludedBrowserLaunchSource(value = "") {
  const key = normalizeRuntimeKey(value);
  return key === "baseline"
    || key === "baseline_v1"
    || key === "baseline_v2"
    || key === "practice"
    || key === "learn"
    || key === "extra_challenge"
    || key === "spelling_bee"
    || key === "spellingbee"
    || key === "sample"
    || key === "demo"
    || key === "presenter"
    || key === "presentation"
    || key === "public_presentation";
}

function isAssignedBrowserLaunchSource(value = "") {
  const key = normalizeRuntimeKey(value);
  return key === "assigned_core"
    || key === "teacher_assigned"
    || key === "auto_assigned"
    || key === "auto_generated"
    || key === "generated"
    || key === "test";
}

function readBrowserLaunchSourceValues(assignment = null) {
  return [
    assignment?.attempt_source,
    assignment?.attemptSource,
    assignment?.assignment_origin,
    assignment?.assignmentOrigin,
    assignment?.evidence_source,
    assignment?.evidenceSource,
  ].filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function getBrowserLaunchFields(assignment = null) {
  const source = assignment && typeof assignment === "object" ? assignment : {};
  return {
    delivery_model: normalizeDeliveryModel(readFirstDefined(source.delivery_model, source.deliveryModel)),
    support_preset: readFirstDefined(source.support_preset, source.supportPreset) ?? null,
    mode: readFirstDefined(source.mode, source.assignmentMode) ?? null,
    question_type: readFirstDefined(source.question_type, source.questionType) ?? null,
    attempt_source: readFirstDefined(source.attempt_source, source.attemptSource) ?? null,
    assignmentOrigin: readFirstDefined(source.assignmentOrigin, source.assignment_origin) ?? null,
    evidence_source: readFirstDefined(source.evidence_source, source.evidenceSource) ?? null,
  };
}

function evaluateBrowserLaunchGate(assignment = null) {
  if (!assignment) {
    return { deliveryModel: LEGACY_DELIVERY_MODEL, reason: "runtime assignment missing" };
  }

  const fields = getBrowserLaunchFields(assignment);
  if (fields.delivery_model !== SUPPORT_DELIVERY_MODEL) {
    return { deliveryModel: LEGACY_DELIVERY_MODEL, reason: "delivery_model is not support_ladder" };
  }
  if (!assignment.id || !assignment.class_id) {
    return { deliveryModel: LEGACY_DELIVERY_MODEL, reason: "missing assigned dashboard context" };
  }

  const sourceValues = readBrowserLaunchSourceValues(assignment);
  const excludedSource = sourceValues.find((value) => isExcludedBrowserLaunchSource(value));
  if (excludedSource) {
    return { deliveryModel: LEGACY_DELIVERY_MODEL, reason: `excluded source ${excludedSource}` };
  }

  const modeKey = normalizeRuntimeKey(fields.mode);
  if (modeKey === "practice") {
    const hasAssignedSource = sourceValues.some((value) => isAssignedBrowserLaunchSource(value));
    return hasAssignedSource
      ? { deliveryModel: SUPPORT_DELIVERY_MODEL, reason: "explicit support_ladder assigned practice-mode fixture" }
      : { deliveryModel: LEGACY_DELIVERY_MODEL, reason: "practice mode without assigned source" };
  }

  if (isExcludedBrowserLaunchSource(fields.mode)) {
    return { deliveryModel: LEGACY_DELIVERY_MODEL, reason: `excluded mode ${fields.mode}` };
  }

  return { deliveryModel: SUPPORT_DELIVERY_MODEL, reason: "explicit support_ladder delivery" };
}

function printBrowserLaunchDiagnostics(assignment = null) {
  if (!assignment) return;
  const fields = getBrowserLaunchFields(assignment);
  const gate = evaluateBrowserLaunchGate(assignment);
  console.log("Runtime browser launch fields:");
  for (const field of BROWSER_LAUNCH_FIELDS) {
    console.log(`  ${field}: ${formatNullable(fields[field])}`);
  }
  console.log(`Browser launch gate expected: ${gate.deliveryModel}${gate.reason ? ` (${gate.reason})` : ""}`);
}

function assertRuntimeBrowserLaunchSupportLadder(assignment = null) {
  const gate = evaluateBrowserLaunchGate(assignment);
  if (gate.deliveryModel !== SUPPORT_DELIVERY_MODEL) {
    throw new Error(`Browser launch gate expected ${gate.deliveryModel}, expected ${SUPPORT_DELIVERY_MODEL}: ${gate.reason}.`);
  }
}

function printManualInstructions(config) {
  const scenario = config.scenario;
  console.log("");
  console.log("Manual browser instructions:");
  console.log(`  Log in as smoke pupil ${PUPIL_USERNAME} with PIN ${PUPIL_PIN}.`);
  console.log("  Open the smoke assignment.");
  console.log('  Confirm the first browser screen does not show "Question: Focus sound" or the old grapheme selector.');
  for (const step of scenario.steps) {
    console.log(`  - ${step}`);
  }
  console.log("");
  console.log("Behaviors to watch for:");
  console.log('  - blank independent attempt shows "Type an answer first." and records no attempt');
  console.log("  - first incorrect answer advances to retry without reveal");
  console.log("  - second incorrect answer advances to supported segmented input");
  console.log("  - supported segmented input is shown only after two incorrect spellings");
  console.log("  - access clarification never reveals the spelling");
  console.log("");
}

async function waitForManualPass() {
  if (!process.stdin.isTTY) {
    throw new Error("Scenario mode requires an interactive terminal so the script can wait for the manual browser pass.");
  }

  const rl = readline.createInterface({ input, output });
  try {
    const interruptPromise = new Promise((resolve) => {
      resolveManualWait = resolve;
    });
    const answerPromise = rl.question("Press Enter after the manual browser pass is complete. Ctrl+C restores and exits. ");
    const result = await Promise.race([
      answerPromise.then(() => "enter"),
      interruptPromise,
    ]);
    if (result === "interrupt") {
      throw new Error("Interrupted before manual verification; restore will run.");
    }
  } finally {
    resolveManualWait = null;
    rl.close();
  }
}

async function verifyScenarioOutcome(client, config, scenario, startingEndAt) {
  const assignment = await selectOne(client, "assignments_v2", [{ column: "id", value: config.ids.assignment }], ASSIGNMENT_SELECT);
  if (!assignment) throw new Error("Smoke assignment disappeared during scenario.");
  if (assignment.delivery_model !== SUPPORT_DELIVERY_MODEL || assignment.support_preset !== SUPPORT_PRESET) {
    throw new Error("Smoke assignment was no longer support_ladder/balanced before verification.");
  }
  assertSameNullableInstant(assignment.end_at, startingEndAt, "assignment end_at drifted during scenario");

  const attempts = await readSmokeAttempts(client, config);
  const status = await readSmokeStatus(client, config);
  if (!status) throw new Error("Smoke assignment status row disappeared during scenario.");

  if (scenario.blankOnly) {
    if (attempts.length !== 0) {
      throw new Error(`Blank-attempt scenario expected zero attempts, found ${attempts.length}.`);
    }
    if (status.completed_at) {
      throw new Error("Blank-attempt scenario should not complete the assignment.");
    }
    if (hasCompletedResult(status.result_json)) {
      throw new Error("Blank-attempt scenario should not create completed result_json evidence.");
    }
    return;
  }

  if (attempts.length < scenario.expectedAttempts) {
    throw new Error(`Expected at least ${scenario.expectedAttempts} attempt row(s), found ${attempts.length}.`);
  }

  const terminalAttempts = attempts.filter((attempt) => String(attempt.evidence_category || "").trim());
  const finalAttempt = terminalAttempts[terminalAttempts.length - 1] || null;
  if (!finalAttempt) throw new Error("No terminal support-ladder attempt was recorded.");
  assertAttemptMatchesScenario(finalAttempt, scenario);

  const resultRows = Array.isArray(status.result_json) ? status.result_json : [];
  const finalResult = resultRows.filter((row) => row?.completed !== false).slice(-1)[0] || null;
  if (!finalResult) throw new Error("No completed result_json row was recorded.");
  assertResultMatchesScenario(finalResult, scenario);

  if (status.status !== "completed" || !status.completed_at) {
    throw new Error(`Status is ${status.status || "null"} without completed_at; expected completed.`);
  }
  assertStatusCounters(status, scenario);
}

async function readSmokeAttempts(client, config) {
  const rows = await client.selectRows("attempts", [
    { column: "assignment_id", value: config.ids.assignment },
    { column: "pupil_id", value: config.ids.pupil },
    { column: "test_id", value: config.ids.test },
  ], ATTEMPT_SELECT);
  assertArrayResponse(rows, "Smoke attempts read");
  return rows.slice().sort((a, b) => {
    const attemptDelta = Number(a.attempt_number || a.attempt_no || 0) - Number(b.attempt_number || b.attempt_no || 0);
    if (attemptDelta !== 0) return attemptDelta;
    return getTimestampMs(a.created_at) - getTimestampMs(b.created_at);
  });
}

function getTimestampMs(value) {
  const ms = new Date(value || "").getTime();
  return Number.isFinite(ms) ? ms : 0;
}

async function readSmokeStatus(client, config) {
  return selectOne(client, "assignment_pupil_statuses", [
    { column: "id", value: config.ids.status },
    { column: "assignment_id", value: config.ids.assignment },
    { column: "pupil_id", value: config.ids.pupil },
    { column: "test_id", value: config.ids.test },
  ], STATUS_SELECT);
}

function assertAttemptMatchesScenario(attempt, scenario) {
  if (attempt.delivery_model !== SUPPORT_DELIVERY_MODEL) {
    throw new Error(`Final attempt delivery_model is ${attempt.delivery_model || "null"}, expected ${SUPPORT_DELIVERY_MODEL}.`);
  }
  if (attempt.support_state !== scenario.finalSupportState) {
    throw new Error(`Final attempt support_state is ${attempt.support_state || "null"}, expected ${scenario.finalSupportState}.`);
  }
  if (attempt.evidence_category !== scenario.finalCategory) {
    throw new Error(`Final attempt evidence_category is ${attempt.evidence_category || "null"}, expected ${scenario.finalCategory}.`);
  }
  const normalizedCorrect = normalizeNullableBoolean(attempt.correct);
  const normalizedIsCorrect = normalizeNullableBoolean(attempt.is_correct);
  if (normalizedCorrect !== scenario.finalCorrect) {
    throw new Error(`Final attempt correct is ${formatNullable(attempt.correct)}, expected ${formatNullable(scenario.finalCorrect)}.`);
  }
  if (normalizedIsCorrect !== scenario.finalCorrect) {
    throw new Error(`Final attempt is_correct is ${formatNullable(attempt.is_correct)}, expected ${formatNullable(scenario.finalCorrect)}.`);
  }
  if (scenario.finalTyped === "" && String(attempt.typed ?? "") !== "") {
    throw new Error(`Final attempt typed is "${attempt.typed}", expected blank.`);
  }
  if (scenario.finalTyped && String(attempt.typed || "").trim().toLowerCase() !== scenario.finalTyped) {
    throw new Error(`Final attempt typed is "${attempt.typed}", expected "${scenario.finalTyped}".`);
  }
  if (scenario.requiredSupportAction && !normalizeJsonArray(attempt.support_actions).includes(scenario.requiredSupportAction)) {
    throw new Error(`Final attempt support_actions did not include ${scenario.requiredSupportAction}.`);
  }
}

function assertResultMatchesScenario(result, scenario) {
  if (result.deliveryModel !== SUPPORT_DELIVERY_MODEL && result.delivery_model !== SUPPORT_DELIVERY_MODEL) {
    throw new Error("Completed result_json row is not marked support_ladder.");
  }
  const supportState = result.supportState ?? result.support_state;
  const category = result.evidenceCategory ?? result.evidence_category;
  if (supportState !== scenario.finalSupportState) {
    throw new Error(`Completed result support state is ${supportState || "null"}, expected ${scenario.finalSupportState}.`);
  }
  if (category !== scenario.finalCategory) {
    throw new Error(`Completed result evidence category is ${category || "null"}, expected ${scenario.finalCategory}.`);
  }
  const correct = normalizeNullableBoolean(result.correct ?? result.is_correct);
  if (correct !== scenario.finalCorrect) {
    throw new Error(`Completed result correct is ${formatNullable(correct)}, expected ${formatNullable(scenario.finalCorrect)}.`);
  }
}

function assertStatusCounters(status, scenario) {
  for (const [field, expected] of Object.entries(scenario.counters || {})) {
    const actual = status[field];
    if (expected === null) {
      if (actual !== null && actual !== undefined) {
        throw new Error(`Status ${field} is ${actual}, expected null.`);
      }
      continue;
    }
    if (!sameNumber(actual, expected)) {
      throw new Error(`Status ${field} is ${formatNullable(actual)}, expected ${expected}.`);
    }
  }
}

async function restoreFixture(client, runtime, config, startingEndAt) {
  const currentReport = await inspectFixture(client, config);
  if (!currentReport.rows.assignment) {
    throw new Error("Cannot restore because the fixed smoke assignment row is missing.");
  }

  const restored = await patchAssignmentDelivery(client, config, {
    deliveryModel: LEGACY_DELIVERY_MODEL,
    supportPreset: null,
  });
  if (restored.delivery_model !== LEGACY_DELIVERY_MODEL) {
    throw new Error(`Restore delivery_model is ${restored.delivery_model || "null"}, expected ${LEGACY_DELIVERY_MODEL}.`);
  }
  if (restored.support_preset !== null && restored.support_preset !== undefined) {
    throw new Error(`Restore support_preset is ${restored.support_preset}, expected null.`);
  }
  if (startingEndAt !== undefined) {
    assertSameNullableInstant(restored.end_at, startingEndAt, "assignment end_at drifted during restore");
  }

  const reset = await resetSmokeProgress(client, config, {
    assignment: restored,
  });
  const status = reset.status;
  assertClearedStatus(status);

  const runtimeReport = await inspectRuntime(runtime, config);
  if (runtimeReport.assignment) {
    if (runtimeReport.assignment.delivery_model !== LEGACY_DELIVERY_MODEL) {
      throw new Error(`Runtime restore delivery_model is ${runtimeReport.assignment.delivery_model || "null"}, expected ${LEGACY_DELIVERY_MODEL}.`);
    }
    if (runtimeReport.assignment.support_preset !== null && runtimeReport.assignment.support_preset !== undefined) {
      throw new Error(`Runtime restore support_preset is ${runtimeReport.assignment.support_preset}, expected null.`);
    }
  }

  return { reset, status, runtimeReport };
}

function assertClearedStatus(status) {
  if (status.status !== "assigned") {
    throw new Error(`Restored status is ${status.status || "null"}, expected assigned.`);
  }
  for (const field of ["started_at", "completed_at", "last_opened_at", "last_activity_at"]) {
    if (status[field]) throw new Error(`Restored status ${field} is not null.`);
  }
  for (const field of ["total_words", "correct_words", "average_attempts", "score_rate"]) {
    if (!sameNumber(status[field], 0)) throw new Error(`Restored status ${field} is ${status[field]}, expected 0.`);
  }
  for (const field of SUPPORT_COUNTER_FIELDS) {
    if (status[field] !== null && status[field] !== undefined) {
      throw new Error(`Restored status ${field} is ${status[field]}, expected null.`);
    }
  }
  if (hasNonEmptyJson(status.result_json)) {
    throw new Error("Restored status result_json is not empty.");
  }
}

function hasCompletedResult(resultJson) {
  return (Array.isArray(resultJson) ? resultJson : [])
    .some((row) => row?.completed === true || row?.evidenceCategory || row?.evidence_category);
}

function normalizeNullableBoolean(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  const key = String(value).trim().toLowerCase();
  if (["true", "t", "yes", "1"].includes(key)) return true;
  if (["false", "f", "no", "0"].includes(key)) return false;
  return null;
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function assertArrayResponse(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} returned an unexpected response.`);
  }
}

function assertSameNullableInstant(left, right, label) {
  if (!sameNullableInstant(left, right)) {
    throw new Error(`${label}: observed ${formatNullable(left)}, expected ${formatNullable(right)}.`);
  }
}

function sameNullableInstant(left, right) {
  const leftEmpty = left === null || left === undefined || left === "";
  const rightEmpty = right === null || right === undefined || right === "";
  if (leftEmpty || rightEmpty) return leftEmpty && rightEmpty;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function sameNumber(actual, expected) {
  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
  return Math.abs(actualNumber - expectedNumber) < 0.000001;
}

function hasNonEmptyJson(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  const text = String(value || "").trim();
  return text !== "" && text !== "[]" && text !== "{}" && text.toLowerCase() !== "null";
}

function hasMarker(value) {
  return JSON.stringify(value || {}).includes(MARKER);
}

function formatNullable(value) {
  return value === null || value === undefined || value === "" ? "null" : String(value);
}

function redactSecrets(text) {
  let value = String(text || "");
  const secrets = [
    cleanEnv("WORDLOOM_SUPABASE_SERVICE_ROLE_KEY"),
    cleanEnv("WORDLOOM_SUPABASE_ANON_KEY"),
  ].filter(Boolean);
  for (const secret of secrets) {
    value = value.split(secret).join("[redacted]");
  }
  return value;
}
