#!/usr/bin/env node

const DEFAULT_ASSIGNMENT_ID = "5f958e46-d1ec-4b0f-9bc9-e45fd1d5d00a";
const OVERRIDE_CONFIRM_VALUE = "WORDLOOM_SMOKE_DO_NOT_DELETE";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const ASSIGNMENT_SELECT = "id,teacher_id,end_at,class_id,test_id";

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
  let testEndAt;
  let updateApplied = false;
  let restoreVerified = false;

  try {
    const session = await signIn(client, config);
    teacherId = session.userId;
    console.log(`Signed-in smoke teacher id: ${teacherId}`);
    console.log(`Smoke assignment id: ${config.assignmentId}`);

    const assignment = await readAssignment(client, config.assignmentId, session.accessToken);
    if (!assignment) {
      throw new Error(`Assignment ${config.assignmentId} was not readable by the signed-in smoke teacher.`);
    }
    if (assignment.teacher_id !== teacherId) {
      throw new Error(`Refusing to run: assignment teacher_id ${assignment.teacher_id} does not match signed-in teacher ${teacherId}.`);
    }

    originalEndAt = normalizeNullableEndAt(assignment.end_at);
    testEndAt = computeTestEndAt(originalEndAt);
    console.log(`Original end_at: ${formatNullable(originalEndAt)}`);
    console.log(`Temporary test end_at: ${testEndAt}`);

    await patchAssignmentEndAt(client, config.assignmentId, testEndAt, session.accessToken);
    updateApplied = true;

    const updated = await readAssignment(client, config.assignmentId, session.accessToken);
    if (!updated || !sameNullableInstant(updated.end_at, testEndAt)) {
      throw new Error(`Update verification failed: observed end_at ${formatNullable(updated?.end_at)}, expected ${testEndAt}.`);
    }
    console.log("Update verified: yes");
  } finally {
    if (updateApplied) {
      try {
        const session = await ensureRestoreSession(client, config, teacherId);
        await patchAssignmentEndAt(client, config.assignmentId, originalEndAt, session.accessToken);
        const restored = await readAssignment(client, config.assignmentId, session.accessToken);
        restoreVerified = Boolean(restored && sameNullableInstant(restored.end_at, originalEndAt));
        console.log(`Restore verified: ${restoreVerified ? "yes" : "no"}`);
        if (!restoreVerified) {
          throw new Error(`Restore verification failed: observed end_at ${formatNullable(restored?.end_at)}, expected ${formatNullable(originalEndAt)}.`);
        }
      } catch (restoreError) {
        throw new Error(`Temporary update was applied, but restore failed: ${restoreError?.message || String(restoreError)}`);
      }
    }
  }

  if (!restoreVerified) {
    throw new Error("Smoke update did not reach restore verification.");
  }

  console.log("DUE-DATE SMOKE PASSED");
}

function readConfig() {
  const supabaseUrl = cleanEnv("WORDLOOM_SUPABASE_URL");
  const anonKey = cleanEnv("WORDLOOM_SUPABASE_ANON_KEY");
  const teacherEmail = cleanEnv("WORDLOOM_SMOKE_TEACHER_EMAIL").toLowerCase();
  const teacherPassword = cleanEnv("WORDLOOM_SMOKE_TEACHER_PASSWORD");
  const assignmentOverride = cleanEnv("WORDLOOM_SMOKE_ASSIGNMENT_ID");
  const assignmentId = assignmentOverride || DEFAULT_ASSIGNMENT_ID;
  const overrideConfirm = cleanEnv("WORDLOOM_SMOKE_ASSIGNMENT_OVERRIDE_CONFIRM");

  const missing = [];
  if (!supabaseUrl) missing.push("WORDLOOM_SUPABASE_URL");
  if (!anonKey) missing.push("WORDLOOM_SUPABASE_ANON_KEY");
  if (!teacherEmail) missing.push("WORDLOOM_SMOKE_TEACHER_EMAIL");
  if (!teacherPassword) missing.push("WORDLOOM_SMOKE_TEACHER_PASSWORD");
  if (missing.length) {
    throw new Error(`Missing required env var(s): ${missing.join(", ")}.`);
  }
  if (assignmentOverride && !isUuid(assignmentOverride)) {
    throw new Error("WORDLOOM_SMOKE_ASSIGNMENT_ID must be a UUID when provided.");
  }
  if (!assignmentOverride && !isUuid(DEFAULT_ASSIGNMENT_ID)) {
    throw new Error("Built-in default smoke assignment id is not a valid UUID.");
  }
  if (assignmentOverride && assignmentId !== DEFAULT_ASSIGNMENT_ID && overrideConfirm !== OVERRIDE_CONFIRM_VALUE) {
    throw new Error(`Refusing non-default assignment id without WORDLOOM_SMOKE_ASSIGNMENT_OVERRIDE_CONFIRM=${OVERRIDE_CONFIRM_VALUE}.`);
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    anonKey,
    teacherEmail,
    teacherPassword,
    assignmentId,
    usingDefaultAssignment: assignmentId === DEFAULT_ASSIGNMENT_ID,
  };
}

function cleanEnv(name) {
  return String(process.env[name] || "").trim();
}

function createClient(config) {
  async function request(path, { method = "GET", body, accessToken } = {}, label = "Supabase request") {
    const headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken || config.anonKey}`,
      Accept: "application/json",
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
  if (!Array.isArray(rows)) {
    throw new Error("Assignment read returned an unexpected response.");
  }
  return rows[0] || null;
}

async function patchAssignmentEndAt(client, assignmentId, endAt, accessToken) {
  const path = restPath("assignments_v2", [
    ["id", `eq.${assignmentId}`],
  ]);
  await client.request(path, {
    method: "PATCH",
    accessToken,
    body: { end_at: endAt },
  }, "patch assignment end_at");
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

function computeTestEndAt(originalEndAt) {
  const originalTime = originalEndAt ? new Date(originalEndAt).getTime() : NaN;
  const baseTime = Number.isFinite(originalTime) ? originalTime + ONE_DAY_MS : Date.now() + SEVEN_DAYS_MS;
  return new Date(baseTime).toISOString();
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

function formatNullable(value) {
  return value === null || value === undefined || value === "" ? "null" : String(value);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
