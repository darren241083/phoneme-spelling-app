#!/usr/bin/env node

const MARKER = "WORDLOOM_SMOKE_DO_NOT_DELETE";
const SCRIPT_NAME = "scripts/smoke/create-due-date-smoke-fixture.mjs";

const DEFAULT_IDS = {
  school: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d001",
  staffProfile: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d002",
  schoolMembership: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d003",
  staffRoleAssignment: "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d004",
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

const DEFAULT_BASELINE_END_AT = "2030-01-15T12:00:00.000Z";
const REQUIRED_BASELINE_STANDARD_KEY = "core_v2";
const SCHOOL_SLUG = "wordloom-smoke-do-not-delete";
const CLASS_JOIN_CODE = "SMKDD1";
const FORM_CLASS_JOIN_CODE = "SMKFM1";
const PUPIL_USERNAME = "wordloom_smoke_do_not_delete_pupil";
const PUPIL_MIS_ID = "WORDLOOM-SMOKE-DO-NOT-DELETE-PUPIL";

const MODES = new Set(["--dry-run", "--verify", "--apply", "--reset"]);
const WRITE_MODES = new Set(["--apply", "--reset"]);

main().catch((error) => {
  console.error(`ERROR: ${redactSecrets(error?.message || String(error))}`);
  process.exitCode = 1;
});

async function main() {
  if (typeof fetch !== "function") {
    throw new Error("This script requires Node.js with built-in fetch support.");
  }

  const mode = parseMode(process.argv.slice(2));
  const env = readEnv();
  const config = buildFixtureConfig(env);

  if (mode === "--dry-run") {
    printDryRun(config, env);
    return;
  }

  requireRemoteReadEnv(env);
  if (WRITE_MODES.has(mode)) {
    requireWriteEnv(env);
  }

  const client = createSupabaseAdminClient(env);

  if (mode === "--verify") {
    const report = await inspectFixture(client, config);
    printReport("--verify", report, config);
    if (!report.safe || !report.complete || !report.baseline) {
      process.exitCode = 1;
    }
    return;
  }

  if (mode === "--apply") {
    console.log("Mode: --apply (REMOTE/PRODUCTION WRITE)");
    const result = await applyFixture(client, config);
    printApplyResult(result, config);
    return;
  }

  if (mode === "--reset") {
    console.log("Mode: --reset (REMOTE/PRODUCTION WRITE)");
    const result = await resetFixture(client, config);
    printResetResult(result, config);
    return;
  }
}

function parseMode(args) {
  const modeFlags = args.filter((arg) => MODES.has(arg));
  const unknownFlags = args.filter((arg) => arg.startsWith("--") && !MODES.has(arg) && arg !== "--help");

  if (args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  if (unknownFlags.length) {
    throw new Error(`Unsupported option(s): ${unknownFlags.join(", ")}`);
  }
  if (modeFlags.length > 1) {
    throw new Error(`Choose exactly one mode flag; got ${modeFlags.join(", ")}.`);
  }
  return modeFlags[0] || "--dry-run";
}

function printHelp() {
  console.log(`${SCRIPT_NAME}

Creates, verifies, or resets the Wordloom due-date smoke fixture.

Modes:
  --dry-run   Local-only preview. Does not contact Supabase. Default.
  --verify    Read-only remote verification.
  --apply     REMOTE/PRODUCTION WRITE: create or repair fixture.
  --reset     REMOTE/PRODUCTION WRITE: restore existing fixture baseline.

Write modes require:
  WORDLOOM_SMOKE_CONFIRM=${MARKER}
  WORDLOOM_SUPABASE_URL
  WORDLOOM_SUPABASE_SERVICE_ROLE_KEY
  WORDLOOM_SMOKE_TEACHER_EMAIL
  WORDLOOM_SMOKE_TEACHER_PASSWORD
`);
}

function readEnv() {
  return {
    supabaseUrl: cleanEnv("WORDLOOM_SUPABASE_URL"),
    serviceRoleKey: cleanEnv("WORDLOOM_SUPABASE_SERVICE_ROLE_KEY"),
    teacherEmail: cleanEnv("WORDLOOM_SMOKE_TEACHER_EMAIL").toLowerCase(),
    teacherPassword: cleanEnv("WORDLOOM_SMOKE_TEACHER_PASSWORD"),
    confirm: cleanEnv("WORDLOOM_SMOKE_CONFIRM"),
    assignmentId: cleanEnv("WORDLOOM_SMOKE_ASSIGNMENT_ID"),
    baselineEndAt: cleanEnv("WORDLOOM_SMOKE_BASELINE_END_AT") || DEFAULT_BASELINE_END_AT,
  };
}

function cleanEnv(name) {
  return String(process.env[name] || "").trim();
}

function buildFixtureConfig(env) {
  const assignmentId = env.assignmentId || DEFAULT_IDS.assignment;
  if (!isUuid(assignmentId)) {
    throw new Error("WORDLOOM_SMOKE_ASSIGNMENT_ID must be a UUID when provided.");
  }
  if (!isIsoDate(env.baselineEndAt)) {
    throw new Error("WORDLOOM_SMOKE_BASELINE_END_AT must be a valid ISO datetime when provided.");
  }

  const metadata = {
    marker: MARKER,
    fixture: "due-date-smoke",
    managed_by: SCRIPT_NAME,
  };

  return {
    marker: MARKER,
    baselineEndAt: new Date(env.baselineEndAt).toISOString(),
    ids: {
      ...DEFAULT_IDS,
      assignment: assignmentId,
    },
    school: {
      slug: SCHOOL_SLUG,
      name: `${MARKER} School`,
    },
    teacher: {
      email: env.teacherEmail,
      displayName: `${MARKER} Due Date Teacher`,
      externalStaffId: `${MARKER}-DUE-DATE-TEACHER`,
    },
    class: {
      name: `${MARKER} Due Date Class`,
      joinCode: CLASS_JOIN_CODE,
      yearGroup: "Smoke",
      classType: "subject",
    },
    formClass: {
      name: `${MARKER} Current Form`,
      joinCode: FORM_CLASS_JOIN_CODE,
      yearGroup: "Smoke",
      classType: "form",
    },
    pupil: {
      firstName: MARKER,
      surname: "Due Date Pupil",
      username: PUPIL_USERNAME,
      misId: PUPIL_MIS_ID,
      pin: "0000",
    },
    test: {
      title: `${MARKER} Due Date Test`,
      questionType: "focus_sound",
    },
    testWord: {
      word: "rain",
      sentence: `${MARKER} smoke word.`,
      segments: ["r", "ai", "n"],
      focus: "ai",
    },
    metadata,
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isIsoDate(value) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime());
}

function sameInstant(left, right) {
  const leftTime = new Date(left || "").getTime();
  const rightTime = new Date(right || "").getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function requireRemoteReadEnv(env) {
  const missing = [];
  if (!env.supabaseUrl) missing.push("WORDLOOM_SUPABASE_URL");
  if (!env.serviceRoleKey) missing.push("WORDLOOM_SUPABASE_SERVICE_ROLE_KEY");
  if (!env.teacherEmail) missing.push("WORDLOOM_SMOKE_TEACHER_EMAIL");
  if (missing.length) {
    throw new Error(`Missing required env for remote read: ${missing.join(", ")}.`);
  }
}

function requireWriteEnv(env) {
  const missing = [];
  if (env.confirm !== MARKER) missing.push(`WORDLOOM_SMOKE_CONFIRM=${MARKER}`);
  if (!env.supabaseUrl) missing.push("WORDLOOM_SUPABASE_URL");
  if (!env.serviceRoleKey) missing.push("WORDLOOM_SUPABASE_SERVICE_ROLE_KEY");
  if (!env.teacherEmail) missing.push("WORDLOOM_SMOKE_TEACHER_EMAIL");
  if (!env.teacherPassword) missing.push("WORDLOOM_SMOKE_TEACHER_PASSWORD");
  if (missing.length) {
    throw new Error(`Refusing write mode. Missing required guard/env: ${missing.join(", ")}.`);
  }
}

function printDryRun(config, env) {
  console.log("Mode: --dry-run (local only; no remote reads or writes)");
  console.log(`Marker: ${MARKER}`);
  console.log(`Smoke school slug: ${config.school.slug}`);
  console.log(`Smoke teacher email: ${env.teacherEmail || "(not set)"}`);
  console.log(`Smoke assignment id: ${config.ids.assignment}`);
  console.log(`Smoke form class id: ${config.ids.formClass}`);
  console.log(`Smoke pupil form membership id: ${config.ids.pupilFormClass}`);
  console.log(`Smoke baseline gate status id: ${config.ids.baselineStatus}`);
  console.log(`Baseline end_at: ${config.baselineEndAt}`);
  console.log(`Baseline gate standard: ${REQUIRED_BASELINE_STANDARD_KEY}`);
  console.log("");
  console.log("Environment readiness:");
  console.log(`  WORDLOOM_SUPABASE_URL: ${env.supabaseUrl ? "set" : "missing"}`);
  console.log(`  WORDLOOM_SUPABASE_SERVICE_ROLE_KEY: ${env.serviceRoleKey ? "set (redacted)" : "missing"}`);
  console.log(`  WORDLOOM_SMOKE_TEACHER_EMAIL: ${env.teacherEmail ? "set" : "missing"}`);
  console.log(`  WORDLOOM_SMOKE_TEACHER_PASSWORD: ${env.teacherPassword ? "set (redacted)" : "missing"}`);
  console.log(`  WORDLOOM_SMOKE_CONFIRM: ${env.confirm === MARKER ? "set" : "missing or not confirmed"}`);
  console.log("");
  console.log("--apply and --reset are REMOTE/PRODUCTION WRITE modes and require the confirmation env var.");
}

function createSupabaseAdminClient(env) {
  const baseUrl = env.supabaseUrl.replace(/\/+$/, "");
  const serviceRoleKey = env.serviceRoleKey;

  function headers(extra = {}) {
    return {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
      ...extra,
    };
  }

  async function request(path, init = {}, label = "Supabase request") {
    const response = await fetch(buildUrl(baseUrl, path), {
      ...init,
      headers: headers(init.headers || {}),
    });
    return parseResponse(response, label);
  }

  async function authRequest(path, init = {}, label = "Supabase Auth Admin request") {
    const response = await fetch(buildUrl(baseUrl, path), {
      ...init,
      headers: headers({
        "Content-Type": "application/json",
        ...(init.headers || {}),
      }),
    });
    return parseResponse(response, label);
  }

  return {
    selectRows(table, filters = [], select = "*") {
      const params = [["select", select]];
      for (const filter of filters) params.push([filter.column, `${filter.op || "eq"}.${filter.value}`]);
      return request(restPath(table, params), { method: "GET" }, `select ${table}`);
    },
    insertRow(table, row) {
      return request(restPath(table), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(row),
      }, `insert ${table}`);
    },
    patchRows(table, filters, patch) {
      const params = filters.map((filter) => [filter.column, `${filter.op || "eq"}.${filter.value}`]);
      return request(restPath(table, params), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(patch),
      }, `patch ${table}`);
    },
    deleteRows(table, filters) {
      const params = filters.map((filter) => [filter.column, `${filter.op || "eq"}.${filter.value}`]);
      return request(restPath(table, params), {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      }, `delete ${table}`);
    },
    rpc(name, body = {}, label = `rpc ${name}`) {
      return request(`rest/v1/rpc/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, label);
    },
    readBaselineGateState(pupilId) {
      return this.rpc("read_pupil_baseline_gate_state", {
        requested_pupil_id: pupilId,
        requested_standard_key: REQUIRED_BASELINE_STANDARD_KEY,
      }, "read pupil baseline gate state");
    },
    ensureFormClassBaselineAssignments(formClassIds) {
      return this.rpc("ensure_form_class_baseline_assignments", {
        requested_class_ids: formClassIds,
        requested_standard_key: REQUIRED_BASELINE_STANDARD_KEY,
      }, "ensure form class baseline assignments");
    },
    getAuthUserById(userId) {
      return authRequest(`auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "GET",
      }, "get auth user");
    },
    createAuthUser(body) {
      return authRequest("auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify(body),
      }, "create auth user");
    },
    updateAuthUser(userId, body) {
      return authRequest(`auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }, "update auth user");
    },
    async listAuthUsersByEmail(email) {
      const matches = [];
      const perPage = 200;
      const maxPages = 50;

      for (let page = 1; page <= maxPages; page += 1) {
        const response = await fetch(buildUrl(baseUrl, "auth/v1/admin/users", [
          ["page", String(page)],
          ["per_page", String(perPage)],
        ]), {
          method: "GET",
          headers: headers(),
        });
        const body = await parseResponse(response, "list auth users");
        const users = Array.isArray(body) ? body : (body?.users || []);
        for (const user of users) {
          if (String(user?.email || "").toLowerCase() === email.toLowerCase()) {
            matches.push(user);
          }
        }
        const total = Number(response.headers.get("x-total-count") || body?.total || 0);
        if (users.length < perPage || (total && page * perPage >= total)) break;
      }

      return matches;
    },
  };
}

function buildUrl(baseUrl, path, params = []) {
  const url = new URL(String(path).replace(/^\/+/, ""), `${baseUrl}/`);
  for (const [key, value] of params) {
    url.searchParams.append(key, String(value));
  }
  return url;
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

async function applyFixture(client, config) {
  const actions = [];
  const teacherUser = await ensureSmokeAuthUser(client, config, true, actions);
  const school = await ensureSchool(client, config, actions);
  const teacherId = teacherUser.id;

  await ensureTeacherRows(client, config, teacherId, school.id, actions);
  await ensureClass(client, config, teacherId, school.id, actions);
  await ensurePupil(client, config, school.id, actions);
  await ensurePupilClass(client, config, school.id, actions);
  await ensureSmokeFormClass(client, config, teacherId, school.id, actions);
  await ensurePupilFormClass(client, config, school.id, actions);
  await ensureTest(client, config, teacherId, school.id, actions);
  await ensureTestWord(client, config, school.id, actions);
  await ensureAssignment(client, config, teacherId, school.id, actions);
  await ensureAssignmentStatus(client, config, teacherId, school.id, actions);
  const gate = await ensureSmokeBaselineGateReady(client, config, actions);
  const reset = await resetProgressRows(client, config, teacherId, school.id);

  const report = await inspectFixture(client, config);
  return { teacherId, schoolId: school.id, actions, gate, reset, report };
}

async function resetFixture(client, config) {
  const report = await inspectFixture(client, config);
  const blockingErrors = getResetBlockingErrors(report);
  if (blockingErrors.length) {
    throw new Error(`Refusing reset because fixture is unsafe: ${blockingErrors.join("; ")}`);
  }
  const blockingMissing = getResetBlockingMissing(report);
  if (blockingMissing.length) {
    throw new Error(`Refusing reset because the smoke fixture is incomplete: ${blockingMissing.join(", ")}. Run --apply first.`);
  }

  const teacherId = report.rows.authUser.id;
  const schoolId = report.rows.school.id;
  const actions = [];
  await ensureSmokeFormClass(client, config, teacherId, schoolId, actions);
  await ensurePupilFormClass(client, config, schoolId, actions);
  const gate = await ensureSmokeBaselineGateReady(client, config, actions);
  const reset = await resetProgressRows(client, config, teacherId, schoolId);
  const after = await inspectFixture(client, config);
  return { teacherId, schoolId, actions, gate, reset, report: after };
}

async function inspectFixture(client, config) {
  const rows = {};
  const errors = [];
  const missing = [];
  const drift = [];

  rows.school = await selectOne(client, "schools", [{ column: "slug", value: config.school.slug }]);
  if (!rows.school) rows.school = await selectOne(client, "schools", [{ column: "id", value: config.ids.school }]);
  checkRow("school", rows.school, missing, errors, (row) => hasMarker(row) && row.slug === config.school.slug);

  const profilesByEmail = await client.selectRows("staff_profiles", [
    { column: "email", value: config.teacher.email },
  ]);
  const profileByEmail = profilesByEmail[0] || null;
  rows.authUser = await findAuthUser(client, config.teacher.email, profileByEmail?.user_id || null);
  if (!rows.authUser) {
    missing.push("auth user");
  } else if (!isSmokeAuthUser(rows.authUser) && !hasMarker(profileByEmail)) {
    errors.push("auth user for smoke teacher email exists without smoke marker");
  }

  const teacherId = rows.authUser?.id || profileByEmail?.user_id || null;
  rows.teacher = teacherId ? await selectOne(client, "teachers", [{ column: "id", value: teacherId }]) : null;
  rows.staffProfile = teacherId
    ? await selectOne(client, "staff_profiles", [{ column: "user_id", value: teacherId }])
    : profileByEmail;
  rows.schoolMembership = teacherId && rows.school
    ? await selectOne(client, "school_memberships", [
      { column: "school_id", value: rows.school.id },
      { column: "user_id", value: teacherId },
      { column: "active", value: "true", op: "is" },
    ])
    : null;
  rows.staffRoleAssignment = teacherId
    ? await selectOne(client, "staff_role_assignments", [
      { column: "user_id", value: teacherId },
      { column: "role", value: "teacher" },
      { column: "active", value: "true", op: "is" },
    ])
    : null;
  rows.teacherAppRole = teacherId
    ? await selectOne(client, "teacher_app_roles", [{ column: "teacher_id", value: teacherId }])
    : null;

  if (!rows.teacher) missing.push("teacher row");
  if (!rows.staffProfile) missing.push("staff profile");
  else if (!hasMarker(rows.staffProfile)) errors.push("staff profile exists without smoke marker");
  if (!rows.schoolMembership) missing.push("school membership");
  if (!rows.staffRoleAssignment) missing.push("teacher staff role assignment");
  if (!rows.teacherAppRole) missing.push("legacy teacher_app_roles row");

  rows.class = await selectOne(client, "classes", [{ column: "id", value: config.ids.class }]);
  checkRow("class", rows.class, missing, errors, (row) =>
    hasMarker(row) &&
    row.teacher_id === teacherId &&
    row.school_id === rows.school?.id
  );

  rows.formClass = await selectOne(client, "classes", [{ column: "id", value: config.ids.formClass }]);
  rows.formClassByJoinCode = await selectOne(client, "classes", [{ column: "join_code", value: config.formClass.joinCode }]);
  if (rows.formClassByJoinCode && rows.formClassByJoinCode.id !== config.ids.formClass) {
    errors.push("smoke form class join code belongs to another row");
  }
  checkRow("form class", rows.formClass, missing, errors, (row) =>
    row.id === config.ids.formClass &&
    hasMarker(row) &&
    row.teacher_id === teacherId &&
    row.school_id === rows.school?.id &&
    row.name === config.formClass.name &&
    row.join_code === config.formClass.joinCode &&
    row.year_group === config.formClass.yearGroup &&
    row.class_type === config.formClass.classType &&
    row.department_key === null
  );

  rows.pupil = await selectOne(client, "pupils", [{ column: "id", value: config.ids.pupil }]);
  checkRow("pupil", rows.pupil, missing, errors, (row) =>
    hasMarker(row) &&
    row.school_id === rows.school?.id &&
    row.is_active === true
  );

  rows.pupilClass = await selectOne(client, "pupil_classes", [{ column: "id", value: config.ids.pupilClass }]);
  checkRow("pupil class membership", rows.pupilClass, missing, errors, (row) =>
    hasMarker(row) &&
    row.school_id === rows.school?.id &&
    row.class_id === config.ids.class &&
    row.pupil_id === config.ids.pupil &&
    row.active === true
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
    hasMarker(row) &&
    row.school_id === rows.school?.id &&
    row.class_id === config.ids.formClass &&
    row.pupil_id === config.ids.pupil &&
    row.active === true &&
    !row.left_at &&
    !row.ended_at &&
    !row.ended_by &&
    !row.ended_reason
  );

  rows.test = await selectOne(client, "tests", [{ column: "id", value: config.ids.test }]);
  checkRow("test", rows.test, missing, errors, (row) =>
    hasMarker(row) &&
    row.teacher_id === teacherId &&
    row.school_id === rows.school?.id &&
    row.status === "published"
  );

  rows.testWord = await selectOne(client, "test_words", [{ column: "id", value: config.ids.testWord }]);
  checkRow("test word", rows.testWord, missing, errors, (row) =>
    hasMarker(row) &&
    row.test_id === config.ids.test &&
    row.school_id === rows.school?.id
  );

  rows.assignment = await selectOne(client, "assignments_v2", [{ column: "id", value: config.ids.assignment }]);
  checkRow("assignment", rows.assignment, missing, errors, (row) =>
    row.teacher_id === teacherId &&
    row.school_id === rows.school?.id &&
    row.class_id === config.ids.class &&
    row.test_id === config.ids.test
  );
  if (rows.assignment && !sameInstant(rows.assignment.end_at, config.baselineEndAt)) {
    drift.push(`assignment end_at is ${rows.assignment.end_at || "null"}, expected ${config.baselineEndAt}`);
  }
  if (rows.assignment && rows.assignment.evidence_source !== "assigned_core") {
    drift.push(`assignment evidence_source is ${rows.assignment.evidence_source || "null"}, expected assigned_core`);
  }
  if (rows.assignment && rows.assignment.delivery_model !== "legacy_fixed") {
    drift.push(`assignment delivery_model is ${rows.assignment.delivery_model || "null"}, expected legacy_fixed`);
  }
  if (rows.assignment && rows.assignment.support_preset !== null && rows.assignment.support_preset !== undefined) {
    drift.push(`assignment support_preset is ${rows.assignment.support_preset}, expected null`);
  }
  if (rows.assignment && (rows.assignment.automation_kind || rows.assignment.automation_run_id)) {
    drift.push("assignment has automation fields set; reset will clear them");
  }

  rows.status = await selectOne(client, "assignment_pupil_statuses", [{ column: "id", value: config.ids.status }]);
  checkRow("assignment pupil status", rows.status, missing, errors, (row) =>
    row.teacher_id === teacherId &&
    row.school_id === rows.school?.id &&
    row.assignment_id === config.ids.assignment &&
    row.class_id === config.ids.class &&
    row.test_id === config.ids.test &&
    row.pupil_id === config.ids.pupil
  );
  if (rows.status && rows.status.status !== "assigned") {
    drift.push(`assignment pupil status is ${rows.status.status}, expected assigned`);
  }
  if (rows.status && (rows.status.started_at || rows.status.completed_at || rows.status.last_opened_at || rows.status.last_activity_at)) {
    drift.push("assignment pupil status has progress timestamps; reset will clear them");
  }
  if (rows.status && (
    Number(rows.status.total_words || 0) !== 0 ||
    Number(rows.status.correct_words || 0) !== 0 ||
    Number(rows.status.average_attempts || 0) !== 0 ||
    Number(rows.status.score_rate || 0) !== 0
  )) {
    drift.push("assignment pupil status has score counters; reset will clear them");
  }
  if (rows.status && hasSupportLadderStatusSummary(rows.status)) {
    drift.push("assignment pupil status has support-ladder counters; reset will clear them");
  }

  rows.baselineGate = normalizeBaselineGateState(await client.readBaselineGateState(config.ids.pupil));
  const gateReady = isSmokeBaselineGateReady(rows.baselineGate, config);
  if (!gateReady) {
    errors.push(formatBaselineGateNotReady(rows.baselineGate, config));
  }

  rows.baselineStatus = await selectOne(client, "assignment_pupil_statuses", [{ column: "id", value: config.ids.baselineStatus }]);
  checkRow("baseline gate status", rows.baselineStatus, missing, errors, (row) =>
    row.id === config.ids.baselineStatus &&
    (!rows.baselineGate.completedAssignmentId || row.assignment_id === rows.baselineGate.completedAssignmentId) &&
    row.pupil_id === config.ids.pupil &&
    row.status === "completed" &&
    !!row.completed_at
  );

  rows.personalisedBlockingRows = await readBlockingPersonalisedRows(client, config);
  if (rows.personalisedBlockingRows.length) {
    errors.push(`found ${rows.personalisedBlockingRows.length} waiting/provisioning personalised generation row(s) for the smoke pupil`);
  }

  const complete = missing.length === 0;
  const safe = errors.length === 0;
  const baseline = complete && safe && drift.length === 0 && gateReady && rows.personalisedBlockingRows.length === 0;
  return { complete, safe, baseline, gateReady, missing, errors, drift, rows };
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

function getResetBlockingErrors(report) {
  return (report.errors || [])
    .filter((message) => !String(message || "").startsWith("baseline gate is not ready"));
}

function getResetBlockingMissing(report) {
  const repairable = new Set(["form class", "pupil form membership", "baseline gate status"]);
  return (report.missing || []).filter((label) => !repairable.has(label));
}

async function ensureSmokeAuthUser(client, config, allowCreate, actions) {
  const profileByEmail = await selectOne(client, "staff_profiles", [
    { column: "email", value: config.teacher.email },
  ]);
  if (profileByEmail && !hasMarker(profileByEmail)) {
    throw new Error("Refusing to use smoke teacher email because an unmarked staff profile already uses it.");
  }

  const authUser = await findAuthUser(client, config.teacher.email, profileByEmail?.user_id || null);
  if (!authUser) {
    if (!allowCreate) throw new Error("Smoke auth user does not exist.");
    const created = await client.createAuthUser({
      email: config.teacher.email,
      password: cleanEnv("WORDLOOM_SMOKE_TEACHER_PASSWORD"),
      email_confirm: true,
      user_metadata: config.metadata,
    });
    actions.push("created auth user");
    return created?.user || created;
  }

  if (!isSmokeAuthUser(authUser) && !hasMarker(profileByEmail)) {
    throw new Error("Refusing to use smoke teacher email because the auth user is not marked as smoke data.");
  }

  await client.updateAuthUser(authUser.id, {
    password: cleanEnv("WORDLOOM_SMOKE_TEACHER_PASSWORD"),
    email_confirm: true,
    user_metadata: {
      ...(authUser.user_metadata || {}),
      ...config.metadata,
    },
  });
  actions.push("updated auth user metadata/password");
  return { ...authUser, user_metadata: { ...(authUser.user_metadata || {}), ...config.metadata } };
}

async function findAuthUser(client, email, userIdHint) {
  if (userIdHint) {
    try {
      const byId = await client.getAuthUserById(userIdHint);
      const user = byId?.user || byId;
      if (String(user?.email || "").toLowerCase() === email.toLowerCase()) return user;
    } catch {
      // Fall through to email search; a stale profile should not hide an existing auth user.
    }
  }

  const matches = await client.listAuthUsersByEmail(email);
  if (matches.length > 1) {
    throw new Error(`Refusing to continue because ${matches.length} auth users share the smoke teacher email.`);
  }
  return matches[0] || null;
}

async function ensureSchool(client, config, actions) {
  const bySlug = await selectOne(client, "schools", [{ column: "slug", value: config.school.slug }]);
  const byFixedId = await selectOne(client, "schools", [{ column: "id", value: config.ids.school }]);

  if (byFixedId && !hasMarker(byFixedId)) {
    throw new Error("Refusing to use fixed smoke school id because it belongs to unmarked data.");
  }
  if (bySlug && !hasMarker(bySlug)) {
    throw new Error("Refusing to use smoke school slug because it belongs to unmarked data.");
  }
  if (bySlug && byFixedId && bySlug.id !== byFixedId.id) {
    throw new Error("Refusing to continue because smoke school slug and fixed school id point at different rows.");
  }

  const row = bySlug || byFixedId;
  const payload = {
    id: row?.id || config.ids.school,
    slug: config.school.slug,
    name: config.school.name,
    is_legacy_default: false,
  };

  if (row) {
    const [updated] = await client.patchRows("schools", [{ column: "id", value: row.id }], payload);
    actions.push("reused smoke school");
    return updated || { ...row, ...payload };
  }

  const [inserted] = await client.insertRow("schools", payload);
  actions.push("created smoke school");
  return inserted || payload;
}

async function ensureTeacherRows(client, config, teacherId, schoolId, actions) {
  await ensureDirectRow(client, "teachers", config.teacher.displayName, [{ column: "id", value: teacherId }], {
    id: teacherId,
    display_name: config.teacher.displayName,
    school_id: schoolId,
  }, (row) => row.id === teacherId, actions, "teacher row");

  await ensureStaffProfile(client, config, teacherId, schoolId, actions);
  await ensureSchoolMembership(client, config, teacherId, schoolId, actions);
  await ensureStaffRoleAssignment(client, config, teacherId, schoolId, actions);

  await ensureDirectRow(client, "teacher_app_roles", MARKER, [{ column: "teacher_id", value: teacherId }], {
    teacher_id: teacherId,
    app_role: "teacher",
    school_id: schoolId,
  }, (row) => row.teacher_id === teacherId, actions, "legacy teacher_app_roles row");
}

async function ensureStaffProfile(client, config, teacherId, schoolId, actions) {
  const byId = await selectOne(client, "staff_profiles", [{ column: "id", value: config.ids.staffProfile }]);
  const byUser = await selectOne(client, "staff_profiles", [{ column: "user_id", value: teacherId }]);
  const byEmail = await selectOne(client, "staff_profiles", [{ column: "email", value: config.teacher.email }]);
  const existing = byUser || byEmail || byId;

  for (const row of [byId, byUser, byEmail].filter(Boolean)) {
    if (!hasMarker(row)) {
      throw new Error("Refusing to use staff profile because an existing row is not marked as smoke data.");
    }
  }
  if (byId && existing && byId.id !== existing.id) {
    throw new Error("Refusing to continue because fixed staff profile id points at a different smoke row.");
  }

  const payload = {
    id: existing?.id || config.ids.staffProfile,
    user_id: teacherId,
    email: config.teacher.email,
    display_name: config.teacher.displayName,
    external_staff_id: config.teacher.externalStaffId,
    notes: `${MARKER} due-date smoke fixture`,
    profile_source: "self_service",
    import_metadata: config.metadata,
    school_id: schoolId,
    archived_at: null,
    archived_by: null,
    archive_reason: null,
  };

  if (existing) {
    await client.patchRows("staff_profiles", [{ column: "id", value: existing.id }], payload);
    actions.push("reused staff profile");
    return;
  }

  await client.insertRow("staff_profiles", payload);
  actions.push("created staff profile");
}

async function ensureSchoolMembership(client, config, teacherId, schoolId, actions) {
  const byPair = await selectOne(client, "school_memberships", [
    { column: "school_id", value: schoolId },
    { column: "user_id", value: teacherId },
    { column: "active", value: "true", op: "is" },
  ]);
  const byId = await selectOne(client, "school_memberships", [{ column: "id", value: config.ids.schoolMembership }]);
  if (byId && byPair && byId.id !== byPair.id) {
    throw new Error("Refusing to continue because fixed school membership id points at a different row.");
  }
  if (byId && (byId.school_id !== schoolId || byId.user_id !== teacherId)) {
    throw new Error("Refusing to use fixed school membership id because it belongs to another user/school.");
  }

  const existing = byPair || byId;
  const payload = {
    id: existing?.id || config.ids.schoolMembership,
    school_id: schoolId,
    user_id: teacherId,
    active: true,
    source: "manual",
  };

  if (existing) {
    await client.patchRows("school_memberships", [{ column: "id", value: existing.id }], payload);
    actions.push("reused school membership");
    return;
  }

  await client.insertRow("school_memberships", payload);
  actions.push("created school membership");
}

async function ensureStaffRoleAssignment(client, config, teacherId, schoolId, actions) {
  const byRole = await selectOne(client, "staff_role_assignments", [
    { column: "user_id", value: teacherId },
    { column: "role", value: "teacher" },
    { column: "active", value: "true", op: "is" },
  ]);
  const byId = await selectOne(client, "staff_role_assignments", [
    { column: "id", value: config.ids.staffRoleAssignment },
  ]);
  if (byId && byRole && byId.id !== byRole.id) {
    throw new Error("Refusing to continue because fixed staff role id points at a different row.");
  }
  if (byId && (byId.user_id !== teacherId || byId.role !== "teacher")) {
    throw new Error("Refusing to use fixed staff role id because it belongs to another user/role.");
  }

  const existing = byRole || byId;
  const payload = {
    id: existing?.id || config.ids.staffRoleAssignment,
    user_id: teacherId,
    role: "teacher",
    active: true,
    granted_by: teacherId,
    school_id: schoolId,
  };

  if (existing) {
    await client.patchRows("staff_role_assignments", [{ column: "id", value: existing.id }], payload);
    actions.push("reused teacher staff role");
    return;
  }

  await client.insertRow("staff_role_assignments", payload);
  actions.push("created teacher staff role");
}

async function ensureClass(client, config, teacherId, schoolId, actions) {
  const byId = await selectOne(client, "classes", [{ column: "id", value: config.ids.class }]);
  const byJoinCode = await selectOne(client, "classes", [{ column: "join_code", value: config.class.joinCode }]);
  if (byId && !hasMarker(byId)) {
    throw new Error("Refusing to use fixed class id because it belongs to unmarked data.");
  }
  if (byJoinCode && (!hasMarker(byJoinCode) || byJoinCode.id !== config.ids.class)) {
    throw new Error("Refusing to use smoke class join code because it collides with another row.");
  }

  const payload = {
    id: config.ids.class,
    teacher_id: teacherId,
    school_id: schoolId,
    name: config.class.name,
    join_code: config.class.joinCode,
    year_group: config.class.yearGroup,
    class_type: config.class.classType,
    department_key: null,
  };
  await upsertById(client, "classes", config.ids.class, payload, actions, "class");
}

async function ensurePupil(client, config, schoolId, actions) {
  const byId = await selectOne(client, "pupils", [{ column: "id", value: config.ids.pupil }]);
  const byUsername = await selectOne(client, "pupils", [{ column: "username", value: config.pupil.username }]);
  const byMis = await selectOne(client, "pupils", [{ column: "mis_id", value: config.pupil.misId }]);
  for (const row of [byId, byUsername, byMis].filter(Boolean)) {
    if (!hasMarker(row) || row.id !== config.ids.pupil) {
      throw new Error("Refusing to use smoke pupil identifiers because they collide with another row.");
    }
  }

  const payload = {
    id: config.ids.pupil,
    school_id: schoolId,
    first_name: config.pupil.firstName,
    surname: config.pupil.surname,
    nickname: `${MARKER} Pupil`,
    username: config.pupil.username,
    mis_id: config.pupil.misId,
    pin: config.pupil.pin,
    must_reset_pin: false,
    is_active: true,
    archived_at: null,
    archived_by: null,
    archive_reason: null,
    import_metadata: config.metadata,
  };
  await upsertById(client, "pupils", config.ids.pupil, payload, actions, "pupil");
}

async function ensurePupilClass(client, config, schoolId, actions) {
  const byPair = await selectOne(client, "pupil_classes", [
    { column: "class_id", value: config.ids.class },
    { column: "pupil_id", value: config.ids.pupil },
    { column: "active", value: "true", op: "is" },
  ]);
  const byId = await selectOne(client, "pupil_classes", [{ column: "id", value: config.ids.pupilClass }]);
  if (byId && !hasMarker(byId)) {
    throw new Error("Refusing to use fixed pupil-class id because it belongs to unmarked data.");
  }
  if (byPair && byPair.id !== config.ids.pupilClass && !hasMarker(byPair)) {
    throw new Error("Refusing to use existing pupil-class membership because it is not marked as smoke data.");
  }

  const existing = byPair || byId;
  const payload = {
    id: existing?.id || config.ids.pupilClass,
    school_id: schoolId,
    class_id: config.ids.class,
    pupil_id: config.ids.pupil,
    active: true,
    left_at: null,
    ended_at: null,
    ended_by: null,
    ended_reason: null,
    import_metadata: config.metadata,
  };

  if (existing) {
    await client.patchRows("pupil_classes", [{ column: "id", value: existing.id }], payload);
    actions.push("reused pupil-class membership");
    return;
  }

  await client.insertRow("pupil_classes", payload);
  actions.push("created pupil-class membership");
}

async function ensureSmokeFormClass(client, config, teacherId, schoolId, actions) {
  const byId = await selectOne(client, "classes", [{ column: "id", value: config.ids.formClass }]);
  const byJoinCode = await selectOne(client, "classes", [{ column: "join_code", value: config.formClass.joinCode }]);
  if (byId && (!hasMarker(byId) || byId.school_id !== schoolId)) {
    throw new Error("Refusing to use fixed smoke form class id because it belongs to unmarked or different-school data.");
  }
  if (byJoinCode && (!hasMarker(byJoinCode) || byJoinCode.id !== config.ids.formClass || byJoinCode.school_id !== schoolId)) {
    throw new Error("Refusing to use smoke form class join code because it collides with another row.");
  }

  const payload = {
    id: config.ids.formClass,
    teacher_id: teacherId,
    school_id: schoolId,
    name: config.formClass.name,
    join_code: config.formClass.joinCode,
    year_group: config.formClass.yearGroup,
    class_type: config.formClass.classType,
    department_key: null,
  };
  await upsertById(client, "classes", config.ids.formClass, payload, actions, "form class");
}

async function ensurePupilFormClass(client, config, schoolId, actions) {
  const byPair = await selectOne(client, "pupil_classes", [
    { column: "class_id", value: config.ids.formClass },
    { column: "pupil_id", value: config.ids.pupil },
    { column: "active", value: "true", op: "is" },
  ]);
  const byId = await selectOne(client, "pupil_classes", [{ column: "id", value: config.ids.pupilFormClass }]);
  if (byId && !hasMarker(byId)) {
    throw new Error("Refusing to use fixed pupil-form membership id because it belongs to unmarked data.");
  }
  if (byPair && byPair.id !== config.ids.pupilFormClass) {
    throw new Error("Refusing to use smoke pupil form membership because an active non-fixed row already exists.");
  }

  const existing = byPair || byId;
  const payload = {
    id: existing?.id || config.ids.pupilFormClass,
    school_id: schoolId,
    class_id: config.ids.formClass,
    pupil_id: config.ids.pupil,
    active: true,
    left_at: null,
    ended_at: null,
    ended_by: null,
    ended_reason: null,
    import_metadata: config.metadata,
  };

  if (existing) {
    const rows = await client.patchRows("pupil_classes", [{ column: "id", value: existing.id }], payload);
    assertSingleRow(rows, "pupil form membership repair", existing.id);
    actions.push("reused pupil-form membership");
    return;
  }

  const rows = await client.insertRow("pupil_classes", payload);
  assertSingleRow(rows, "pupil form membership insert", config.ids.pupilFormClass);
  actions.push("created pupil-form membership");
}

async function ensureSmokeBaselineGateReady(client, config, actions) {
  const provision = await client.ensureFormClassBaselineAssignments([config.ids.formClass]);
  let baselineAssignmentId = extractBaselineAssignmentIdFromProvision(provision, config);
  if (!baselineAssignmentId) {
    const gateBeforeStatus = normalizeBaselineGateState(await client.readBaselineGateState(config.ids.pupil));
    baselineAssignmentId = gateBeforeStatus.assignmentId || gateBeforeStatus.completedAssignmentId;
  }
  if (!baselineAssignmentId) {
    throw new Error("Could not resolve the smoke form baseline assignment id after provisioning.");
  }

  const baselineAssignment = await selectOne(client, "assignments_v2", [
    { column: "id", value: baselineAssignmentId },
  ]);
  if (!baselineAssignment) {
    throw new Error("Smoke form baseline assignment was not found after provisioning.");
  }
  if (baselineAssignment.class_id !== config.ids.formClass) {
    throw new Error("Resolved baseline assignment does not belong to the smoke form class.");
  }

  await ensureCompletedBaselineStatus(client, config, baselineAssignment, actions);

  const gate = normalizeBaselineGateState(await client.readBaselineGateState(config.ids.pupil));
  if (!isSmokeBaselineGateReady(gate, config)) {
    throw new Error(formatBaselineGateNotReady(gate, config));
  }
  return { provision, baselineAssignmentId, gate };
}

async function ensureCompletedBaselineStatus(client, config, baselineAssignment, actions) {
  const byPair = await selectOne(client, "assignment_pupil_statuses", [
    { column: "assignment_id", value: baselineAssignment.id },
    { column: "pupil_id", value: config.ids.pupil },
  ]);
  const byId = await selectOne(client, "assignment_pupil_statuses", [{ column: "id", value: config.ids.baselineStatus }]);
  if (byId && (byId.assignment_id !== baselineAssignment.id || byId.pupil_id !== config.ids.pupil)) {
    throw new Error("Refusing to use fixed baseline status id because it belongs to another assignment/pupil.");
  }
  if (byPair && byPair.id !== config.ids.baselineStatus) {
    throw new Error("Refusing to create fixed baseline status because the smoke pupil already has a non-fixed baseline status row.");
  }

  const existing = byPair || byId;
  const now = new Date().toISOString();
  const payload = completedBaselineStatusPayload(config, baselineAssignment, existing?.id || config.ids.baselineStatus, now);
  if (existing) {
    const rows = await client.patchRows("assignment_pupil_statuses", [{ column: "id", value: existing.id }], payload);
    assertSingleRow(rows, "baseline gate status repair", existing.id);
    actions.push("reused baseline gate status");
    return;
  }

  const rows = await client.insertRow("assignment_pupil_statuses", payload);
  assertSingleRow(rows, "baseline gate status insert", config.ids.baselineStatus);
  actions.push("created baseline gate status");
}

async function ensureTest(client, config, teacherId, schoolId, actions) {
  const payload = {
    id: config.ids.test,
    teacher_id: teacherId,
    school_id: schoolId,
    title: config.test.title,
    status: "published",
    question_type: config.test.questionType,
    analytics_target_words_enabled: false,
    analytics_target_words_per_pupil: 0,
  };
  await upsertById(client, "tests", config.ids.test, payload, actions, "test");
}

async function ensureTestWord(client, config, schoolId, actions) {
  const payload = {
    id: config.ids.testWord,
    test_id: config.ids.test,
    school_id: schoolId,
    position: 1,
    word: config.testWord.word,
    sentence: config.testWord.sentence,
    segments: config.testWord.segments,
    choice: {
      source: "teacher",
      marker: MARKER,
      question_type: config.test.questionType,
      focus_graphemes: [config.testWord.focus],
    },
  };
  await upsertById(client, "test_words", config.ids.testWord, payload, actions, "test word");
}

async function ensureAssignment(client, config, teacherId, schoolId, actions) {
  const existing = await selectOne(client, "assignments_v2", [{ column: "id", value: config.ids.assignment }]);
  if (existing && (
    existing.teacher_id !== teacherId ||
    existing.class_id !== config.ids.class ||
    existing.test_id !== config.ids.test
  )) {
    throw new Error("Refusing to use fixed assignment id because it belongs to another teacher/class/test.");
  }

  const payload = {
    id: config.ids.assignment,
    teacher_id: teacherId,
    school_id: schoolId,
    class_id: config.ids.class,
    test_id: config.ids.test,
    mode: "practice",
    max_attempts: 2,
    end_at: config.baselineEndAt,
    question_type: config.test.questionType,
    audio_enabled: true,
    hints_enabled: false,
    analytics_target_words_enabled: false,
    analytics_target_words_per_pupil: 0,
    automation_kind: null,
    automation_source: null,
    automation_run_id: null,
    automation_triggered_by: null,
    evidence_source: "assigned_core",
    delivery_model: "legacy_fixed",
    support_preset: null,
  };
  await upsertById(client, "assignments_v2", config.ids.assignment, payload, actions, "assignment");
}

async function ensureAssignmentStatus(client, config, teacherId, schoolId, actions) {
  const byPair = await selectOne(client, "assignment_pupil_statuses", [
    { column: "assignment_id", value: config.ids.assignment },
    { column: "pupil_id", value: config.ids.pupil },
  ]);
  const byId = await selectOne(client, "assignment_pupil_statuses", [{ column: "id", value: config.ids.status }]);
  if (byId && byPair && byId.id !== byPair.id) {
    throw new Error("Refusing to continue because fixed assignment status id points at a different row.");
  }
  if (byId && (byId.assignment_id !== config.ids.assignment || byId.pupil_id !== config.ids.pupil)) {
    throw new Error("Refusing to use fixed assignment status id because it belongs to another assignment/pupil.");
  }

  const existing = byPair || byId;
  const payload = baselineStatusPayload(config, teacherId, schoolId, existing?.id || config.ids.status);
  if (existing) {
    await client.patchRows("assignment_pupil_statuses", [{ column: "id", value: existing.id }], payload);
    actions.push("reused assignment pupil status");
    return;
  }

  await client.insertRow("assignment_pupil_statuses", payload);
  actions.push("created assignment pupil status");
}

async function resetProgressRows(client, config, teacherId, schoolId) {
  const attempts = await client.deleteRows("attempts", [
    { column: "assignment_id", value: config.ids.assignment },
    { column: "pupil_id", value: config.ids.pupil },
    { column: "test_id", value: config.ids.test },
  ]);
  const targetWords = await client.deleteRows("assignment_pupil_target_words", [
    { column: "assignment_id", value: config.ids.assignment },
    { column: "pupil_id", value: config.ids.pupil },
  ]);
  const overrides = await client.deleteRows("assignment_pupil_overrides", [
    { column: "assignment_id", value: config.ids.assignment },
    { column: "pupil_id", value: config.ids.pupil },
  ]);

  const assignmentRows = await client.patchRows("assignments_v2", [{ column: "id", value: config.ids.assignment }], {
    teacher_id: teacherId,
    school_id: schoolId,
    class_id: config.ids.class,
    test_id: config.ids.test,
    mode: "practice",
    max_attempts: 2,
    end_at: config.baselineEndAt,
    question_type: config.test.questionType,
    audio_enabled: true,
    hints_enabled: false,
    analytics_target_words_enabled: false,
    analytics_target_words_per_pupil: 0,
    automation_kind: null,
    automation_source: null,
    automation_run_id: null,
    automation_triggered_by: null,
    evidence_source: "assigned_core",
    delivery_model: "legacy_fixed",
    support_preset: null,
  });
  assertSingleRow(assignmentRows, "smoke assignment reset", config.ids.assignment);

  const statusRows = await client.patchRows("assignment_pupil_statuses", [{ column: "id", value: config.ids.status }], {
    ...baselineStatusPayload(config, teacherId, schoolId, config.ids.status),
    updated_at: new Date().toISOString(),
  });
  assertSingleRow(statusRows, "smoke status reset", config.ids.status);

  return {
    attemptsDeleted: Array.isArray(attempts) ? attempts.length : 0,
    targetWordsDeleted: Array.isArray(targetWords) ? targetWords.length : 0,
    overridesDeleted: Array.isArray(overrides) ? overrides.length : 0,
  };
}

function baselineStatusPayload(config, teacherId, schoolId, id) {
  return {
    id,
    teacher_id: teacherId,
    school_id: schoolId,
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
  };
}

function completedBaselineStatusPayload(config, baselineAssignment, id, timestamp) {
  return {
    id,
    teacher_id: baselineAssignment.teacher_id,
    school_id: baselineAssignment.school_id,
    assignment_id: baselineAssignment.id,
    class_id: baselineAssignment.class_id,
    test_id: baselineAssignment.test_id,
    pupil_id: config.ids.pupil,
    status: "completed",
    started_at: timestamp,
    completed_at: timestamp,
    last_opened_at: timestamp,
    last_activity_at: timestamp,
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
    updated_at: timestamp,
  };
}

function hasSupportLadderStatusSummary(row = {}) {
  return [
    "independent_first_correct_words",
    "self_corrected_words",
    "supported_correct_words",
    "supported_incorrect_words",
    "access_issue_words",
    "headline_attempted_words",
    "headline_correct_words",
    "headline_score_rate",
  ].some((field) => row[field] !== null && row[field] !== undefined);
}

async function ensureDirectRow(client, table, marker, filters, payload, isSafe, actions, label) {
  const existing = await selectOne(client, table, filters);
  if (existing && !isSafe(existing)) {
    throw new Error(`Refusing to use ${label} because it belongs to another fixture/user.`);
  }
  if (existing && marker && !hasMarker(existing) && table !== "teacher_app_roles") {
    throw new Error(`Refusing to use ${label} because it is not marked as smoke data.`);
  }
  if (existing) {
    await client.patchRows(table, filters, payload);
    actions.push(`reused ${label}`);
    return;
  }
  await client.insertRow(table, payload);
  actions.push(`created ${label}`);
}

async function upsertById(client, table, id, payload, actions, label) {
  const existing = await selectOne(client, table, [{ column: "id", value: id }]);
  if (existing && !hasMarker(existing) && !["assignments_v2", "assignment_pupil_statuses"].includes(table)) {
    throw new Error(`Refusing to use fixed ${label} id because it belongs to unmarked data.`);
  }
  if (existing) {
    await client.patchRows(table, [{ column: "id", value: id }], payload);
    actions.push(`reused ${label}`);
    return;
  }
  await client.insertRow(table, payload);
  actions.push(`created ${label}`);
}

async function selectOne(client, table, filters, select = "*") {
  const rows = await client.selectRows(table, filters, select);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (rows.length > 1) {
    throw new Error(`Expected at most one ${table} row for ${describeFilters(filters)}, found ${rows.length}.`);
  }
  return rows[0];
}

async function readBlockingPersonalisedRows(client, config) {
  const rows = await client.selectRows("personalised_generation_run_pupils", [
    { column: "pupil_id", value: config.ids.pupil },
    { column: "status", value: "(waiting,provisioning)", op: "in" },
  ], "id,run_id,class_id,pupil_id,status,assignment_id,updated_at");
  if (!Array.isArray(rows)) {
    throw new Error("Personalised generation row check returned an unexpected response.");
  }
  return rows;
}

function normalizeIdList(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(
    source
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )];
}

function normalizeBaselineGateState(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const classIds = normalizeIdList(source.class_ids ?? source.classIds);
  const formClassIds = normalizeIdList(source.form_class_ids ?? source.formClassIds);
  return {
    status: String(source.status || "waiting").trim().toLowerCase() || "waiting",
    waitingReason: String(source.waiting_reason ?? source.waitingReason ?? "").trim().toLowerCase() || null,
    assignmentId: String(source.assignment_id ?? source.assignmentId ?? source.assignment?.id ?? "").trim(),
    completedAssignmentId: String(source.completed_assignment_id ?? source.completedAssignmentId ?? "").trim(),
    requiredStandardKey: String(source.required_standard_key ?? source.requiredStandardKey ?? REQUIRED_BASELINE_STANDARD_KEY).trim().toLowerCase() || REQUIRED_BASELINE_STANDARD_KEY,
    classIds,
    formClassIds,
  };
}

function isSmokeBaselineGateReady(gateState, config) {
  return gateState?.status === "ready"
    && gateState.formClassIds.includes(config.ids.formClass)
    && !!gateState.completedAssignmentId;
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

function formatIdList(values = []) {
  const list = normalizeIdList(values);
  return list.length ? list.join(",") : "[]";
}

function extractBaselineAssignmentIdFromProvision(provision = {}, config) {
  const results = Array.isArray(provision?.results) ? provision.results : [];
  const exact = results.find((row) =>
    String(row?.class_id || "").trim() === config.ids.formClass
    && String(row?.assignment_id || "").trim()
  );
  return String(exact?.assignment_id || "").trim();
}

function assertSingleRow(rows, label, expectedId) {
  if (!Array.isArray(rows)) {
    throw new Error(`${label} returned an unexpected response.`);
  }
  if (rows.length !== 1 || (expectedId && String(rows[0]?.id || "") !== String(expectedId))) {
    throw new Error(`${label} did not affect exactly the expected row.`);
  }
}

function describeFilters(filters) {
  return filters.map((filter) => `${filter.column}=${filter.value}`).join(", ");
}

function hasMarker(value) {
  return JSON.stringify(value || {}).includes(MARKER);
}

function isSmokeAuthUser(user) {
  return hasMarker(user?.user_metadata) || hasMarker(user?.raw_user_meta_data) || hasMarker(user?.app_metadata);
}

function printReport(mode, report, config) {
  console.log(`Mode: ${mode} (remote read-only)`);
  console.log(`Complete: ${report.complete ? "yes" : "no"}`);
  console.log(`Safe: ${report.safe ? "yes" : "no"}`);
  console.log(`At baseline: ${report.baseline ? "yes" : "no"}`);
  console.log(`Smoke assignment id: ${config.ids.assignment}`);
  console.log(`Smoke form class id: ${config.ids.formClass}`);
  console.log(`Smoke pupil form membership id: ${config.ids.pupilFormClass}`);
  console.log(`Smoke baseline gate status id: ${config.ids.baselineStatus}`);
  console.log(`Baseline end_at: ${config.baselineEndAt}`);
  if (report.rows.authUser?.id) console.log(`Smoke teacher user id: ${report.rows.authUser.id}`);
  if (report.rows.school?.id) console.log(`Smoke school id: ${report.rows.school.id}`);
  if (report.rows.assignment?.end_at) console.log(`Current assignment end_at: ${report.rows.assignment.end_at}`);
  printBaselineGateReport(report);
  if (report.missing.length) console.log(`Missing: ${report.missing.join(", ")}`);
  if (report.errors.length) console.log(`Unsafe: ${report.errors.join("; ")}`);
  if (report.drift.length) console.log(`Drift: ${report.drift.join("; ")}`);
}

function printApplyResult(result, config) {
  console.log("Fixture apply complete.");
  printResultCore(result, config);
  if (result.actions.length) console.log(`Actions: ${result.actions.join(", ")}`);
  printGateResult(result.gate);
  printResetCounts(result.reset);
}

function printResetResult(result, config) {
  console.log("Fixture reset complete.");
  printResultCore(result, config);
  if (result.actions?.length) console.log(`Actions: ${result.actions.join(", ")}`);
  printGateResult(result.gate);
  printResetCounts(result.reset);
}

function printResultCore(result, config) {
  console.log(`Smoke school id: ${result.schoolId}`);
  console.log(`Smoke teacher user id: ${result.teacherId}`);
  console.log(`Smoke class id: ${config.ids.class}`);
  console.log(`Smoke form class id: ${config.ids.formClass}`);
  console.log(`Smoke pupil id: ${config.ids.pupil}`);
  console.log(`Smoke pupil form membership id: ${config.ids.pupilFormClass}`);
  console.log(`Smoke test id: ${config.ids.test}`);
  console.log(`Smoke assignment id: ${config.ids.assignment}`);
  console.log(`Smoke baseline gate status id: ${config.ids.baselineStatus}`);
  console.log(`Baseline end_at: ${config.baselineEndAt}`);
  console.log(`Verified complete: ${result.report.complete ? "yes" : "no"}`);
  console.log(`Verified safe: ${result.report.safe ? "yes" : "no"}`);
  console.log(`Verified at baseline: ${result.report.baseline ? "yes" : "no"}`);
  printBaselineGateReport(result.report);
}

function printResetCounts(reset) {
  console.log(`Smoke attempts deleted: ${reset.attemptsDeleted}`);
  console.log(`Smoke target words deleted: ${reset.targetWordsDeleted}`);
  console.log(`Smoke overrides deleted: ${reset.overridesDeleted}`);
}

function printBaselineGateReport(report) {
  const gate = report?.rows?.baselineGate;
  if (!gate) {
    console.log("Baseline gate status: (not read)");
    return;
  }
  console.log(`Baseline gate status: ${gate.status}`);
  console.log(`Baseline gate waiting reason: ${gate.waitingReason || "null"}`);
  console.log(`Baseline gate form class ids: ${formatIdList(gate.formClassIds)}`);
  console.log(`Baseline gate completed assignment id: ${gate.completedAssignmentId || "null"}`);
  console.log(`Baseline gate ready: ${report.gateReady ? "yes" : "no"}`);
  const blockers = report?.rows?.personalisedBlockingRows || [];
  console.log(`Waiting/provisioning personalised rows for smoke pupil: ${blockers.length}`);
}

function printGateResult(gateResult) {
  if (!gateResult?.gate) return;
  console.log(`Gate repair baseline assignment id: ${gateResult.baselineAssignmentId || "null"}`);
  console.log(`Gate repair status: ${gateResult.gate.status}`);
  console.log(`Gate repair completed assignment id: ${gateResult.gate.completedAssignmentId || "null"}`);
}

function redactSecrets(text) {
  let value = String(text || "");
  const secrets = [
    cleanEnv("WORDLOOM_SUPABASE_SERVICE_ROLE_KEY"),
    cleanEnv("WORDLOOM_SMOKE_TEACHER_PASSWORD"),
  ].filter(Boolean);
  for (const secret of secrets) {
    value = value.split(secret).join("[redacted]");
  }
  return value;
}
