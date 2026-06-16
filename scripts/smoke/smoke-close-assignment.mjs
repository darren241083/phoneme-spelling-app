#!/usr/bin/env node

const DEFAULT_ASSIGNMENT_ID = "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d00a";
const DEFAULT_PUPIL_ID = "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d006";
const DEFAULT_CLASS_ID = "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d005";
const DEFAULT_TEST_ID = "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d008";
const DEFAULT_STATUS_ID = "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d00b";
const DEFAULT_BASELINE_END_AT = "2030-01-15T12:00:00.000Z";
const OVERRIDE_CONFIRM_VALUE = "WORDLOOM_SMOKE_DO_NOT_DELETE";
const ONE_MINUTE_MS = 60 * 1000;

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
].join(",");

main().catch((error) => {
  console.error(`ERROR: ${redactSecrets(error?.message || String(error))}`);
  process.exitCode = 1;
});

async function main() {
  if (typeof fetch !== "function") {
    throw new Error("This script requires Node.js with built-in fetch support.");
  }

  const config = readConfig();
  const client = createClient(config);

  let teacherId = null;
  let originalEndAt;
  let closedAt;
  let updateApplied = false;
  let restoreVerified = false;

  try {
    const session = await signIn(client, config);
    teacherId = session.userId;
    console.log(`Signed-in smoke teacher id: ${teacherId}`);
    console.log(`Smoke assignment id: ${config.assignmentId}`);

    const assignment = await readAssignment(client, config.assignmentId, session.accessToken);
    validateAssignment(assignment, config, teacherId);

    const status = await readAssignmentStatus(client, config, session.accessToken);
    validateAssignmentStatus(status, assignment, config);

    const beforeRuntime = await readPupilRuntimeAssignments(client, config);
    assertRuntimeOk(beforeRuntime, config, "before close");
    if (!findRuntimeAssignment(beforeRuntime, config.assignmentId)) {
      throw new Error("Smoke assignment was not present in pupil runtime assignments before close.");
    }

    originalEndAt = normalizeNullableEndAt(assignment.end_at);
    closedAt = new Date(Date.now() - ONE_MINUTE_MS).toISOString();
    console.log(`Original end_at: ${formatNullable(originalEndAt)}`);
    console.log(`Temporary closed end_at: ${closedAt}`);

    await patchAssignmentEndAt(client, config, closedAt, session.accessToken, teacherId);
    updateApplied = true;

    const closed = await readAssignment(client, config.assignmentId, session.accessToken);
    if (!closed || !sameNullableInstant(closed.end_at, closedAt)) {
      throw new Error(`Close verification failed: observed end_at ${formatNullable(closed?.end_at)}, expected ${closedAt}.`);
    }
    console.log("Close update verified: yes");

    const afterRuntime = await readPupilRuntimeAssignments(client, config);
    assertRuntimeOk(afterRuntime, config, "after close");
    if (findRuntimeAssignment(afterRuntime, config.assignmentId)) {
      throw new Error("Smoke assignment was still present in pupil runtime assignments after close.");
    }
    console.log("Runtime hidden verified: yes");
  } finally {
    if (updateApplied) {
      try {
        const session = await ensureRestoreSession(client, config, teacherId);
        await patchAssignmentEndAt(client, config, originalEndAt, session.accessToken, teacherId);
        const restored = await readAssignment(client, config.assignmentId, session.accessToken);
        restoreVerified = Boolean(restored && sameNullableInstant(restored.end_at, originalEndAt));
        console.log(`Restore verified: ${restoreVerified ? "yes" : "no"}`);
        if (!restoreVerified) {
          throw new Error(`Restore verification failed: observed end_at ${formatNullable(restored?.end_at)}, expected ${formatNullable(originalEndAt)}.`);
        }
      } catch (restoreError) {
        throw new Error(`Temporary close was applied, but restore failed: ${restoreError?.message || String(restoreError)}`);
      }
    }
  }

  if (!restoreVerified) {
    throw new Error("Close smoke did not reach restore verification.");
  }

  console.log("CLOSE ASSIGNMENT SMOKE PASSED");
}

function readConfig() {
  const supabaseUrl = cleanEnv("WORDLOOM_SUPABASE_URL");
  const anonKey = cleanEnv("WORDLOOM_SUPABASE_ANON_KEY");
  const teacherEmail = cleanEnv("WORDLOOM_SMOKE_TEACHER_EMAIL").toLowerCase();
  const teacherPassword = cleanEnv("WORDLOOM_SMOKE_TEACHER_PASSWORD");
  const assignmentOverride = cleanEnv("WORDLOOM_SMOKE_ASSIGNMENT_ID");
  const pupilOverride = cleanEnv("WORDLOOM_SMOKE_PUPIL_ID");
  const hasAssignmentOverride = assignmentOverride.length > 0;
  const hasPupilOverride = pupilOverride.length > 0;
  const assignmentId = (hasAssignmentOverride ? assignmentOverride : DEFAULT_ASSIGNMENT_ID).toLowerCase();
  const pupilId = (hasPupilOverride ? pupilOverride : DEFAULT_PUPIL_ID).toLowerCase();
  const overrideConfirm = cleanEnv("WORDLOOM_SMOKE_ASSIGNMENT_OVERRIDE_CONFIRM");

  const missing = [];
  if (!supabaseUrl) missing.push("WORDLOOM_SUPABASE_URL");
  if (!anonKey) missing.push("WORDLOOM_SUPABASE_ANON_KEY");
  if (!teacherEmail) missing.push("WORDLOOM_SMOKE_TEACHER_EMAIL");
  if (!teacherPassword) missing.push("WORDLOOM_SMOKE_TEACHER_PASSWORD");
  if (missing.length) {
    throw new Error(`Missing required env var(s): ${missing.join(", ")}.`);
  }

  if (!isUuid(assignmentId)) {
    throw new Error("WORDLOOM_SMOKE_ASSIGNMENT_ID must be a UUID when provided.");
  }
  if (!isUuid(pupilId)) {
    throw new Error("WORDLOOM_SMOKE_PUPIL_ID must be a UUID when provided.");
  }
  if (hasAssignmentOverride && assignmentId !== DEFAULT_ASSIGNMENT_ID && overrideConfirm !== OVERRIDE_CONFIRM_VALUE) {
    throw new Error(`Refusing non-default assignment id without WORDLOOM_SMOKE_ASSIGNMENT_OVERRIDE_CONFIRM=${OVERRIDE_CONFIRM_VALUE}.`);
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    anonKey,
    teacherEmail,
    teacherPassword,
    assignmentId,
    pupilId,
    usingDefaultAssignment: assignmentId === DEFAULT_ASSIGNMENT_ID,
    usingDefaultPupil: pupilId === DEFAULT_PUPIL_ID,
  };
}

function cleanEnv(name) {
  return String(process.env[name] || "").trim();
}

function createClient(config) {
  async function request(path, { method = "GET", body, accessToken, headers: extraHeaders = {} } = {}, label = "Supabase request") {
    const headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken || config.anonKey}`,
      Accept: "application/json",
      ...extraHeaders,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(new URL(path, `${config.supabaseUrl}/`), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return parseResponse(response, label);
  }

  return { request };
}

async function signIn(client, config) {
  const body = await client.request("auth/v1/token?grant_type=password", {
    method: "POST",
    body: {
      email: config.teacherEmail,
      password: config.teacherPassword,
    },
  }, "teacher sign-in");

  const accessToken = String(body?.access_token || "");
  const userId = String(body?.user?.id || "");
  if (!accessToken || !isUuid(userId)) {
    throw new Error("Teacher sign-in did not return a usable access token and user id.");
  }
  return { accessToken, userId };
}

async function ensureRestoreSession(client, config, expectedTeacherId) {
  const session = await signIn(client, config);
  if (session.userId !== expectedTeacherId) {
    throw new Error("Restore sign-in returned a different teacher id.");
  }
  return session;
}

async function readAssignment(client, assignmentId, accessToken) {
  const path = restPath("assignments_v2", [
    ["select", ASSIGNMENT_SELECT],
    ["id", `eq.${assignmentId}`],
    ["limit", "1"],
  ]);
  const rows = await client.request(path, { accessToken }, "read assignment");
  assertArrayResponse(rows, "Assignment read");
  return rows[0] || null;
}

async function readAssignmentStatus(client, config, accessToken) {
  const path = restPath("assignment_pupil_statuses", [
    ["select", STATUS_SELECT],
    ["assignment_id", `eq.${config.assignmentId}`],
    ["pupil_id", `eq.${config.pupilId}`],
    ["limit", "2"],
  ]);
  const rows = await client.request(path, { accessToken }, "read assignment pupil status");
  assertArrayResponse(rows, "Assignment pupil status read");
  if (rows.length > 1) {
    throw new Error(`Expected at most one smoke pupil status row, found ${rows.length}.`);
  }
  return rows[0] || null;
}

async function readPupilRuntimeAssignments(client, config) {
  const payload = await client.request("rest/v1/rpc/read_pupil_runtime_assignments", {
    method: "POST",
    body: {
      requested_pupil_id: config.pupilId,
    },
  }, "read pupil runtime assignments");
  return normalizeRuntimePayload(payload, config.pupilId);
}

async function patchAssignmentEndAt(client, config, endAt, accessToken, teacherId) {
  const path = restPath("assignments_v2", [
    ["select", "id,end_at"],
    ["id", `eq.${config.assignmentId}`],
    ["teacher_id", `eq.${teacherId}`],
  ]);
  const rows = await client.request(path, {
    method: "PATCH",
    accessToken,
    headers: { Prefer: "return=representation" },
    body: { end_at: endAt },
  }, "patch assignment end_at");
  assertArrayResponse(rows, "Patch assignment end_at");
  if (rows.length !== 1 || rows[0]?.id !== config.assignmentId) {
    throw new Error("Assignment end_at patch did not update exactly one expected smoke assignment row.");
  }
  return rows[0];
}

function validateAssignment(assignment, config, teacherId) {
  if (!assignment) {
    throw new Error(`Assignment ${config.assignmentId} was not readable by the signed-in smoke teacher.`);
  }
  if (assignment.id !== config.assignmentId) {
    throw new Error(`Refusing to run: assignment id ${assignment.id || "(missing)"} does not match configured id ${config.assignmentId}.`);
  }
  if (assignment.teacher_id !== teacherId) {
    throw new Error(`Refusing to run: assignment teacher_id ${assignment.teacher_id} does not match signed-in teacher ${teacherId}.`);
  }

  if (config.usingDefaultAssignment) {
    if (assignment.class_id !== DEFAULT_CLASS_ID) {
      throw new Error(`Refusing default fixture: assignment class_id ${assignment.class_id || "(missing)"} does not match ${DEFAULT_CLASS_ID}.`);
    }
    if (assignment.test_id !== DEFAULT_TEST_ID) {
      throw new Error(`Refusing default fixture: assignment test_id ${assignment.test_id || "(missing)"} does not match ${DEFAULT_TEST_ID}.`);
    }
  }

  const evidenceSource = String(assignment.evidence_source || "").trim().toLowerCase();
  if (evidenceSource && evidenceSource !== "assigned_core") {
    throw new Error(`Refusing to run: smoke assignment evidence_source is ${assignment.evidence_source}, expected blank or assigned_core.`);
  }

  for (const field of ["automation_kind", "automation_source", "automation_run_id"]) {
    if (String(assignment[field] || "").trim()) {
      throw new Error(`Refusing to run: smoke assignment has ${field} set.`);
    }
  }

  if (config.usingDefaultAssignment && assignment.end_at && !sameNullableInstant(assignment.end_at, DEFAULT_BASELINE_END_AT)) {
    console.log(`Baseline end_at drift: observed ${assignment.end_at}, expected ${DEFAULT_BASELINE_END_AT}; original value will still be restored.`);
  }
}

function validateAssignmentStatus(status, assignment, config) {
  if (!status) {
    throw new Error("Smoke pupil assignment status row was not readable; refusing to run against an unverified fixture.");
  }
  if (status.assignment_id !== config.assignmentId || status.pupil_id !== config.pupilId) {
    throw new Error("Smoke pupil assignment status row does not match configured assignment/pupil ids.");
  }
  if (status.teacher_id && assignment.teacher_id && status.teacher_id !== assignment.teacher_id) {
    throw new Error("Smoke pupil assignment status teacher_id does not match assignment owner.");
  }

  if (config.usingDefaultAssignment && config.usingDefaultPupil) {
    if (status.id !== DEFAULT_STATUS_ID) {
      throw new Error(`Refusing default fixture: status id ${status.id || "(missing)"} does not match ${DEFAULT_STATUS_ID}.`);
    }
    if (status.class_id !== DEFAULT_CLASS_ID) {
      throw new Error(`Refusing default fixture: status class_id ${status.class_id || "(missing)"} does not match ${DEFAULT_CLASS_ID}.`);
    }
    if (status.test_id !== DEFAULT_TEST_ID) {
      throw new Error(`Refusing default fixture: status test_id ${status.test_id || "(missing)"} does not match ${DEFAULT_TEST_ID}.`);
    }
  }

  const normalizedStatus = String(status.status || "").trim().toLowerCase();
  if (["completed", "complete"].includes(normalizedStatus) || status.completed_at) {
    throw new Error("Refusing to run: smoke pupil has completed assignment status/results.");
  }
  if (normalizedStatus && normalizedStatus !== "assigned") {
    throw new Error(`Refusing to run: smoke pupil status is ${status.status}, expected assigned/incomplete.`);
  }
  if (status.started_at || status.last_opened_at || status.last_activity_at) {
    throw new Error("Refusing to run: smoke pupil status has active progress timestamps.");
  }
  if (hasNonEmptyJson(status.result_json)) {
    throw new Error("Refusing to run: smoke pupil status has non-empty result_json evidence.");
  }

  for (const field of ["total_words", "correct_words", "average_attempts", "score_rate"]) {
    const value = Number(status[field] || 0);
    if (Number.isFinite(value) && value > 0) {
      throw new Error(`Refusing to run: smoke pupil status has ${field}=${value}, expected 0.`);
    }
  }
}

function normalizeRuntimePayload(payload, requestedPupilId) {
  const source = payload && typeof payload === "object" ? payload : {};
  const assignments = Array.isArray(source?.assignments)
    ? source.assignments
    : Array.isArray(payload)
      ? payload
      : [];

  return {
    status: String(source?.status || "ok").trim().toLowerCase() || "ok",
    pupilId: String(source?.pupil_id || source?.pupilId || requestedPupilId).trim(),
    assignments,
  };
}

function assertRuntimeOk(runtimePayload, config, label) {
  if (runtimePayload.status !== "ok") {
    throw new Error(`Pupil runtime ${label} returned status ${runtimePayload.status || "(blank)"}, expected ok.`);
  }
  if (runtimePayload.pupilId !== config.pupilId) {
    throw new Error(`Pupil runtime ${label} returned pupil_id ${runtimePayload.pupilId || "(missing)"}, expected ${config.pupilId}.`);
  }
}

function findRuntimeAssignment(runtimePayload, assignmentId) {
  return (runtimePayload.assignments || []).find((row) => String(row?.id || "").trim() === assignmentId) || null;
}

function assertArrayResponse(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} returned an unexpected response.`);
  }
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

function normalizeNullableEndAt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Assignment end_at is not parseable: ${String(value)}`);
  }
  return String(value);
}

function sameNullableInstant(left, right) {
  const leftEmpty = left === null || left === undefined || left === "";
  const rightEmpty = right === null || right === undefined || right === "";
  if (leftEmpty || rightEmpty) return leftEmpty && rightEmpty;

  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function hasNonEmptyJson(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  const text = String(value || "").trim();
  return text !== "" && text !== "[]" && text !== "{}" && text.toLowerCase() !== "null";
}

function formatNullable(value) {
  return value === null || value === undefined || value === "" ? "null" : String(value);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function redactSecrets(text) {
  let value = String(text || "");
  const secrets = [
    cleanEnv("WORDLOOM_SUPABASE_ANON_KEY"),
    cleanEnv("WORDLOOM_SMOKE_TEACHER_PASSWORD"),
  ].filter(Boolean);
  for (const secret of secrets) {
    value = value.split(secret).join("[redacted]");
  }
  return value;
}
