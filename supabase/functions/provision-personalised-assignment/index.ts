import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AUTOMATION_KIND_PERSONALISED,
  AUTOMATION_SOURCE_MANUAL_RUN_NOW,
  WORDLOOM_CORE_FOCUS_TARGET_TABLE,
  WORDLOOM_CORE_WORD_TABLE,
  WORDLOOM_CORE_WORD_TARGET_TABLE,
  buildAssignmentTitle,
  buildAttemptDerivedBaselineStatusRows,
  buildAutoAssignedPoolEntries,
  buildAutoAssignedPoolIdMap,
  buildAutoAssignedTargetRows,
  buildProvisioningPlan,
  buildProvisioningPolicy,
  buildPublicProvisioningResponse,
  buildPupilWordCountByPupil,
  chunkList,
  findActiveExtraChallengeRuntimeAssignment,
  hasCompletedRequiredCoreRuntimeAssignment,
  hasIncompleteRequiredCoreRuntimeAssignment,
  isCompletedAssignmentStatusRow,
  mapWordloomCoreBankRowsToWordRows,
  normalizeId,
  normalizeIdList,
  normalizeLoadedWordRows,
} from "./provisioningCore.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLAIMED_STATUS = "claimed";
const BASELINE_STANDARD_KEY = "core_v2";
const EVIDENCE_SOURCE_ASSIGNED_CORE = "assigned_core";
const EVIDENCE_SOURCE_EXTRA_CHALLENGE = "extra_challenge";
const EXTRA_CHALLENGE_ACTION = "extra_challenge";
const EXTRA_CHALLENGE_ASSIGNMENT_LENGTH = 5;
const EXTRA_CHALLENGE_SUPPORT_PRESET = "balanced";
const WORDLOOM_CORE_BANK_PAGE_SIZE = 1000;

type ServiceClient = ReturnType<typeof createClient>;

type CreatedArtifacts = {
  assignmentId: string;
  testId: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isUuid(value: unknown) {
  return UUID_PATTERN.test(String(value || "").trim());
}

function publicStatus(status = "", httpStatus = 200, assignmentId = "") {
  return json(buildPublicProvisioningResponse({ status, assignmentId }), httpStatus);
}

function getSupabaseEnv() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }
  return { supabaseUrl, supabaseServiceRoleKey };
}

async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function getPostgrestErrorCode(error: unknown) {
  return String((error as Record<string, unknown> | null)?.code || "").trim().toUpperCase();
}

function isMissingTableError(error: unknown, tableName = "") {
  const code = getPostgrestErrorCode(error);
  const message = String((error as Record<string, unknown> | null)?.message || "").toLowerCase();
  const cleanTable = String(tableName || "").trim().toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (cleanTable && message.includes(cleanTable) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingAnalyticsTargetColumnError(error: unknown) {
  const code = String((error as Record<string, unknown> | null)?.code || "").trim();
  const message = String((error as Record<string, unknown> | null)?.message || "").toLowerCase();
  const mentionsAnalyticsTargetColumn =
    message.includes("analytics_target_words_enabled")
    || message.includes("analytics_target_words_per_pupil");

  if (!mentionsAnalyticsTargetColumn) return false;
  return code === "PGRST204" || code === "42703" || message.includes("schema cache") || message.includes("column");
}

function stripAnalyticsTargetColumns(payload: Record<string, unknown>) {
  const {
    analytics_target_words_enabled: _analyticsEnabled,
    analytics_target_words_per_pupil: _analyticsPerPupil,
    ...rest
  } = payload || {};
  return rest;
}

async function insertSingleRowWithAnalyticsFallback(
  serviceClient: ServiceClient,
  table: string,
  payload: Record<string, unknown>,
  selectColumns = "*",
) {
  let result = await serviceClient
    .from(table)
    .insert(payload)
    .select(selectColumns)
    .single();

  if (result.error && isMissingAnalyticsTargetColumnError(result.error)) {
    result = await serviceClient
      .from(table)
      .insert(stripAnalyticsTargetColumns(payload))
      .select(selectColumns)
      .single();
  }

  return result;
}

async function claimWaitingRunPupil(serviceClient: ServiceClient, pupilId: string) {
  const { data, error } = await serviceClient.rpc("claim_waiting_personalised_generation_run_pupil", {
    requested_pupil_id: pupilId,
  });
  if (error) throw error;
  return data && typeof data === "object" ? data as Record<string, unknown> : { status: "nothing_waiting" };
}

async function completeClaim(serviceClient: ServiceClient, runPupilId: string, assignmentId: string) {
  const { data, error } = await serviceClient.rpc("complete_waiting_personalised_generation_run_pupil", {
    claimed_run_pupil_id: runPupilId,
    created_assignment_id: assignmentId,
  });
  if (error) throw error;
  return data && typeof data === "object" ? data as Record<string, unknown> : { status: "error" };
}

async function releaseClaim(serviceClient: ServiceClient, runPupilId: string) {
  if (!runPupilId) return null;
  const { data, error } = await serviceClient.rpc("release_waiting_personalised_generation_run_pupil", {
    claimed_run_pupil_id: runPupilId,
  });
  if (error) throw error;
  return data;
}

async function releaseClaimSafely(serviceClient: ServiceClient, runPupilId: string) {
  try {
    return await releaseClaim(serviceClient, runPupilId);
  } catch (error) {
    console.error("Could not release personalised provisioning claim:", error);
    return null;
  }
}

async function readMaybeSingle(
  serviceClient: ServiceClient,
  table: string,
  selectColumns: string,
  filters: Record<string, string>,
) {
  let query = serviceClient.from(table).select(selectColumns);
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function readClaimContext(
  serviceClient: ServiceClient,
  claim: Record<string, unknown>,
) {
  const runPupilId = normalizeId(claim.run_pupil_id);
  const claimRunId = normalizeId(claim.run_id);
  const claimPupilId = normalizeId(claim.pupil_id);
  const claimClassId = normalizeId(claim.class_id);
  const claimSchoolId = normalizeId(claim.school_id);

  const runPupil = await readMaybeSingle(
    serviceClient,
    "personalised_generation_run_pupils",
    "id, run_id, teacher_id, class_id, pupil_id, assignment_id, status, school_id, created_at, updated_at",
    { id: runPupilId },
  );
  if (!runPupil) throw new Error("Claimed run-pupil row was not found.");

  const teacherId = normalizeId(runPupil.teacher_id);
  const runId = normalizeId(runPupil.run_id);
  const classId = normalizeId(runPupil.class_id);
  const pupilId = normalizeId(runPupil.pupil_id);
  const schoolId = normalizeId(runPupil.school_id || claimSchoolId);

  if (
    !runPupilId
    || !teacherId
    || !runId
    || !classId
    || !pupilId
    || !schoolId
    || runId !== claimRunId
    || classId !== claimClassId
    || pupilId !== claimPupilId
  ) {
    throw new Error("Claimed personalised provisioning row is inconsistent.");
  }

  const [runRow, classRow, membershipRow] = await Promise.all([
    readMaybeSingle(
      serviceClient,
      "personalised_generation_runs",
      "id, teacher_id, automation_policy_id, assignment_length, support_preset, allow_starter_fallback, derived_deadline_at, policy_type, run_source, status, school_id",
      { id: runId, school_id: schoolId },
    ),
    readMaybeSingle(
      serviceClient,
      "classes",
      "id, teacher_id, name, year_group, class_type, school_id",
      { id: classId, school_id: schoolId },
    ),
    readMaybeSingle(
      serviceClient,
      "pupil_classes",
      "class_id, pupil_id, active, school_id",
      { class_id: classId, pupil_id: pupilId, school_id: schoolId },
    ),
  ]);

  if (!runRow || !classRow || !membershipRow || membershipRow.active !== true) {
    throw new Error("Claimed personalised provisioning context is no longer eligible.");
  }
  if (normalizeId(runRow.teacher_id) !== teacherId || normalizeId(classRow.teacher_id) !== teacherId) {
    throw new Error("Claimed personalised provisioning context is not teacher-scoped.");
  }

  return {
    runPupilId,
    runPupil,
    runRow,
    classRow,
    teacherId,
    runId,
    classId,
    pupilId,
    schoolId,
  };
}

async function readBaselineGateState(serviceClient: ServiceClient, pupilId: string) {
  const { data, error } = await serviceClient.rpc("read_pupil_baseline_gate_state", {
    requested_pupil_id: pupilId,
    requested_standard_key: BASELINE_STANDARD_KEY,
  });
  if (error) throw error;
  return data && typeof data === "object" ? data as Record<string, unknown> : {};
}

function getBaselineGateStatus(gateState: Record<string, unknown> | null) {
  return String(gateState?.status || "").trim().toLowerCase();
}

function getCompletedBaselineAssignmentId(gateState: Record<string, unknown> | null) {
  return normalizeId(gateState?.completed_assignment_id || gateState?.completedAssignmentId);
}

function mergeBaselineAssignments(...assignmentGroups: Record<string, unknown>[][]) {
  const mergedById = new Map<string, Record<string, unknown>>();
  for (const assignments of assignmentGroups) {
    for (const assignment of Array.isArray(assignments) ? assignments : []) {
      const id = normalizeId(assignment?.id);
      if (!id || mergedById.has(id)) continue;
      mergedById.set(id, assignment);
    }
  }
  return Array.from(mergedById.values());
}

function buildNonPracticeAttemptFilter(schoolId = "") {
  const safeSchoolId = normalizeId(schoolId);
  if (!safeSchoolId) return "attempt_source.is.null,and(attempt_source.neq.practice,attempt_source.neq.extra_challenge)";
  return [
    `and(school_id.eq.${safeSchoolId},attempt_source.is.null)`,
    `and(school_id.eq.${safeSchoolId},attempt_source.neq.practice,attempt_source.neq.extra_challenge)`,
    "and(school_id.is.null,attempt_source.is.null)",
    "and(school_id.is.null,attempt_source.neq.practice,attempt_source.neq.extra_challenge)",
  ].join(",");
}

async function hasActivePersonalisedAssignment(
  serviceClient: ServiceClient,
  { pupilId, schoolId }: { pupilId: string; schoolId: string },
) {
  const { data: membershipRows, error: membershipError } = await serviceClient
    .from("pupil_classes")
    .select("class_id")
    .eq("pupil_id", pupilId)
    .eq("school_id", schoolId)
    .eq("active", true);
  if (membershipError) throw membershipError;

  const classIds = normalizeIdList((membershipRows || []).map((row: Record<string, unknown>) => row.class_id));
  if (!classIds.length) return false;

  const { data: assignmentRows, error: assignmentError } = await serviceClient
    .from("assignments_v2")
    .select("id, class_id, test_id, created_at")
    .in("class_id", classIds)
    .eq("school_id", schoolId)
    .eq("evidence_source", EVIDENCE_SOURCE_ASSIGNED_CORE)
    .eq("automation_kind", AUTOMATION_KIND_PERSONALISED)
    .eq("automation_source", AUTOMATION_SOURCE_MANUAL_RUN_NOW)
    .order("created_at", { ascending: false })
    .limit(50);
  if (assignmentError) throw assignmentError;

  const assignmentIds = normalizeIdList((assignmentRows || []).map((row: Record<string, unknown>) => row.id));
  if (!assignmentIds.length) return false;

  const [targetRes, statusRes] = await Promise.all([
    serviceClient
      .from("assignment_pupil_target_words")
      .select("assignment_id, pupil_id")
      .in("assignment_id", assignmentIds)
      .eq("pupil_id", pupilId)
      .eq("school_id", schoolId),
    serviceClient
      .from("assignment_pupil_statuses")
      .select("assignment_id, pupil_id, status, completed_at")
      .in("assignment_id", assignmentIds)
      .eq("pupil_id", pupilId)
      .eq("school_id", schoolId),
  ]);

  if (targetRes.error && !isMissingTableError(targetRes.error, "assignment_pupil_target_words")) throw targetRes.error;
  if (statusRes.error && !isMissingTableError(statusRes.error, "assignment_pupil_statuses")) throw statusRes.error;

  const targetAssignmentIds = new Set(
    (targetRes.data || []).map((row: Record<string, unknown>) => normalizeId(row.assignment_id)).filter(Boolean)
  );
  const statusByAssignmentId = new Map(
    (statusRes.data || []).map((row: Record<string, unknown>) => [normalizeId(row.assignment_id), row])
  );

  for (const assignmentId of assignmentIds) {
    const statusRow = statusByAssignmentId.get(assignmentId) || null;
    if (statusRow && !isCompletedAssignmentStatusRow(statusRow)) return true;
    if (!statusRow && targetAssignmentIds.has(assignmentId)) return true;
  }

  return false;
}

async function readAttemptsForPupil(
  serviceClient: ServiceClient,
  { pupilId, schoolId }: { pupilId: string; schoolId: string },
) {
  let query = serviceClient
    .from("attempts")
    .select("pupil_id, assignment_id, test_word_id, assignment_target_id, mode, attempt_source, correct, attempt_number, created_at, focus_grapheme, pattern_type, word_text, typed, target_graphemes")
    .eq("pupil_id", pupilId)
    .or(buildNonPracticeAttemptFilter(schoolId));
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data || []).filter((row: Record<string, unknown>) =>
    String(row?.attempt_source || row?.attemptSource || "").trim().toLowerCase() !== EVIDENCE_SOURCE_EXTRA_CHALLENGE
  );
}

async function readTeacherTests(
  serviceClient: ServiceClient,
  { teacherId, schoolId }: { teacherId: string; schoolId: string },
) {
  const { data, error } = await serviceClient
    .from("tests")
    .select("id, title, status, question_type, school_id, test_words(id, position, word, sentence, segments, choice)")
    .eq("teacher_id", teacherId)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data || []).map((test: Record<string, unknown>) => ({
    ...test,
    test_words: normalizeLoadedWordRows(test.test_words),
  }));
}

async function readBaselineAssignmentsForClass(
  serviceClient: ServiceClient,
  { classId, schoolId }: { classId: string; schoolId: string },
) {
  let query = serviceClient
    .from("assignments_v2")
    .select("id, class_id, test_id, created_at, school_id, tests(id, title, test_words(id, position, word, sentence, segments, choice))")
    .eq("class_id", classId);
  const safeSchoolId = normalizeId(schoolId);
  if (safeSchoolId) {
    query = query.or(`school_id.eq.${safeSchoolId},school_id.is.null`);
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  return normalizeJoinedBaselineAssignments(data || []);
}

async function readBaselineAssignmentsById(
  serviceClient: ServiceClient,
  { assignmentIds, schoolId }: { assignmentIds: string[]; schoolId: string },
) {
  const safeAssignmentIds = normalizeIdList(assignmentIds);
  if (!safeAssignmentIds.length) return [];

  let query = serviceClient
    .from("assignments_v2")
    .select("id, class_id, test_id, created_at, school_id, tests(id, title, test_words(id, position, word, sentence, segments, choice))")
    .in("id", safeAssignmentIds);
  const safeSchoolId = normalizeId(schoolId);
  if (safeSchoolId) {
    query = query.or(`school_id.eq.${safeSchoolId},school_id.is.null`);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  return normalizeJoinedBaselineAssignments(data || []);
}

function normalizeJoinedBaselineAssignments(assignments: Record<string, unknown>[]) {
  return (assignments || []).map((assignment: Record<string, unknown>) => {
    const joinedTest = Array.isArray(assignment.tests) ? assignment.tests[0] : assignment.tests;
    return {
      ...assignment,
      test: joinedTest
        ? {
          ...(joinedTest as Record<string, unknown>),
          test_words: normalizeLoadedWordRows((joinedTest as Record<string, unknown>).test_words),
        }
        : null,
    };
  });
}

async function readCompletedBaselineStatusRows(
  serviceClient: ServiceClient,
  { assignmentIds, pupilId, schoolId }: { assignmentIds: string[]; pupilId: string; schoolId: string },
) {
  const safeAssignmentIds = normalizeIdList(assignmentIds);
  if (!safeAssignmentIds.length || !pupilId) return [];

  let query = serviceClient
    .from("assignment_pupil_statuses")
    .select("assignment_id, pupil_id, status, completed_at, result_json")
    .in("assignment_id", safeAssignmentIds)
    .eq("pupil_id", pupilId);
  const safeSchoolId = normalizeId(schoolId);
  if (safeSchoolId) {
    query = query.or(`school_id.eq.${safeSchoolId},school_id.is.null`);
  }
  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error, "assignment_pupil_statuses")) return [];
    throw error;
  }

  return (data || []).filter((row: Record<string, unknown>) => isCompletedAssignmentStatusRow(row));
}

function normalizeSourceKey(value: unknown = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

async function readRuntimeAssignmentsForPupil(serviceClient: ServiceClient, pupilId: string) {
  const { data, error } = await serviceClient.rpc("read_pupil_runtime_assignments", {
    requested_pupil_id: pupilId,
  });
  if (error) throw error;
  const rows = Array.isArray(data?.assignments)
    ? data.assignments
    : Array.isArray(data)
      ? data
      : [];
  return rows as Record<string, unknown>[];
}

async function readExtraChallengeContext(serviceClient: ServiceClient, pupilId: string) {
  const { data: pupilRow, error: pupilError } = await serviceClient
    .from("pupils")
    .select("id, school_id, is_active, archived_at")
    .eq("id", pupilId)
    .eq("is_active", true)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (pupilError) throw pupilError;
  if (!pupilRow) return null;

  const { data: membershipRows, error: membershipError } = await serviceClient
    .from("pupil_classes")
    .select("class_id, school_id, classes(id, teacher_id, name, class_type, school_id)")
    .eq("pupil_id", pupilId)
    .eq("active", true);
  if (membershipError) throw membershipError;

  const pupilSchoolId = normalizeId((pupilRow as Record<string, unknown>).school_id);
  const candidates = (membershipRows || [])
    .map((row: Record<string, unknown>) => {
      const classRow = (Array.isArray(row.classes) ? row.classes[0] : row.classes) as Record<string, unknown> | null;
      const schoolId = normalizeId(classRow?.school_id || row.school_id || pupilSchoolId);
      return {
        classId: normalizeId(row.class_id || classRow?.id),
        classRow,
        schoolId,
      };
    })
    .filter((item) =>
      item.classId
      && item.classRow
      && normalizeId(item.classRow.teacher_id)
      && item.schoolId
      && (!pupilSchoolId || item.schoolId === pupilSchoolId)
    )
    .sort((a, b) => {
      const aForm = normalizeSourceKey(a.classRow?.class_type) === "form" ? 0 : 1;
      const bForm = normalizeSourceKey(b.classRow?.class_type) === "form" ? 0 : 1;
      if (aForm !== bForm) return aForm - bForm;
      return String(a.classRow?.name || "").localeCompare(String(b.classRow?.name || ""));
    });

  const selected = candidates[0] || null;
  if (!selected) return null;

  return {
    pupilId,
    schoolId: selected.schoolId,
    classId: selected.classId,
    classRow: selected.classRow,
    teacherId: normalizeId(selected.classRow?.teacher_id),
  };
}

function normalizeWordloomCoreReadLimit(value: unknown = null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function readPagedWordloomCoreWordRows(serviceClient: ServiceClient, limit: unknown = null) {
  const rows: Record<string, unknown>[] = [];
  const safeLimit = normalizeWordloomCoreReadLimit(limit);
  let from = 0;

  while (safeLimit === null || rows.length < safeLimit) {
    const remaining = safeLimit === null
      ? WORDLOOM_CORE_BANK_PAGE_SIZE
      : Math.min(WORDLOOM_CORE_BANK_PAGE_SIZE, safeLimit - rows.length);
    if (remaining <= 0) break;

    const to = from + remaining - 1;
    const { data, error } = await serviceClient
      .from(WORDLOOM_CORE_WORD_TABLE)
      .select("id, word, normalised_word, grapheme_segments, focus_graphemes, primary_focus_grapheme, stage_band, difficulty_score, difficulty_label, difficulty_reason, sentence, meaning, suitability_status, approval_status, source, source_version, is_active")
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .eq("suitability_status", "suitable")
      .order("primary_focus_grapheme", { ascending: true })
      .order("difficulty_score", { ascending: true })
      .order("normalised_word", { ascending: true })
      .range(from, to);

    if (error) return { data: rows, error };

    const pageRows = Array.isArray(data) ? data : [];
    rows.push(...pageRows);
    if (pageRows.length < remaining) break;
    from += remaining;
  }

  return { data: rows, error: null };
}

async function readWordloomCoreSpellingBankWordRows(serviceClient: ServiceClient, limit: unknown = null) {
  const { data: wordRows, error: wordError } = await readPagedWordloomCoreWordRows(serviceClient, limit);

  if (wordError) {
    if (isMissingTableError(wordError, WORDLOOM_CORE_WORD_TABLE)) return [];
    throw wordError;
  }

  const safeWordRows = Array.isArray(wordRows) ? wordRows : [];
  const wordIds = safeWordRows.map((row: Record<string, unknown>) => normalizeId(row.id)).filter(Boolean);
  if (!wordIds.length) return [];

  const wordTargetRows: Record<string, unknown>[] = [];
  for (const chunk of chunkList(wordIds, 100)) {
    const { data, error: targetError } = await serviceClient
      .from(WORDLOOM_CORE_WORD_TARGET_TABLE)
      .select("id, word_id, focus_target_id, focus_grapheme, target_role, pattern_type, difficulty_modifier")
      .in("word_id", chunk)
      .in("target_role", ["primary", "secondary"]);

    if (targetError) {
      if (isMissingTableError(targetError, WORDLOOM_CORE_WORD_TARGET_TABLE)) return [];
      throw targetError;
    }
    wordTargetRows.push(...(Array.isArray(data) ? data : []));
  }

  const focusTargetIds = [...new Set(
    wordTargetRows
      .map((row) => normalizeId(row.focus_target_id))
      .filter(Boolean)
  )];
  if (!focusTargetIds.length) return [];

  const { data: focusTargetRows, error: focusError } = await serviceClient
    .from(WORDLOOM_CORE_FOCUS_TARGET_TABLE)
    .select("id, focus_grapheme, is_active")
    .in("id", focusTargetIds)
    .eq("is_active", true);

  if (focusError) {
    if (isMissingTableError(focusError, WORDLOOM_CORE_FOCUS_TARGET_TABLE)) return [];
    throw focusError;
  }

  return mapWordloomCoreBankRowsToWordRows({
    wordRows: safeWordRows,
    wordTargetRows,
    focusTargetRows: focusTargetRows || [],
  });
}

async function createGeneratedAssignment(
  serviceClient: ServiceClient,
  {
    teacherId,
    schoolId,
    classId,
    className,
    runId,
    deadlineIso,
    plan,
    artifacts,
    evidenceSource = EVIDENCE_SOURCE_ASSIGNED_CORE,
    automationSource = AUTOMATION_SOURCE_MANUAL_RUN_NOW,
    titleOverride = "",
  }: {
    teacherId: string;
    schoolId: string;
    classId: string;
    className: string;
    runId: string;
    deadlineIso: string | null;
    plan: Record<string, unknown>;
    artifacts?: CreatedArtifacts;
    evidenceSource?: string;
    automationSource?: string | null;
    titleOverride?: string;
  },
) {
  let createdTestId = "";
  let createdAssignmentId = "";

  const title = String(titleOverride || "").trim() || buildAssignmentTitle({
    className: className || "Class",
    focusGrapheme: String(plan?.clearFocusGrapheme || ""),
  });
  const safeEvidenceSource = normalizeSourceKey(evidenceSource) === EVIDENCE_SOURCE_EXTRA_CHALLENGE
    ? EVIDENCE_SOURCE_EXTRA_CHALLENGE
    : EVIDENCE_SOURCE_ASSIGNED_CORE;
  const safeAutomationSource = String(automationSource || "").trim() || null;

  const { data: createdTest, error: testError } = await insertSingleRowWithAnalyticsFallback(
    serviceClient,
    "tests",
    {
      teacher_id: teacherId,
      school_id: schoolId,
      title,
      status: "published",
      question_type: "segmented_spelling",
      analytics_target_words_enabled: false,
      analytics_target_words_per_pupil: 0,
    },
    "id",
  );
  if (testError || !createdTest?.id) throw testError || new Error("Could not create the generated test.");
  createdTestId = normalizeId(createdTest.id);
  if (artifacts) artifacts.testId = createdTestId;

  const pupilPlans = Array.isArray(plan?.pupilPlans) ? plan.pupilPlans : [];
  const poolEntries = buildAutoAssignedPoolEntries(pupilPlans);
  if (!poolEntries.length) throw new Error("Could not create generated words without a word pool.");

  const { data: insertedWordRows, error: wordError } = await serviceClient
    .from("test_words")
    .insert(poolEntries.map((entry: Record<string, unknown>) => ({
      test_id: createdTestId,
      school_id: schoolId,
      ...(entry.payload as Record<string, unknown>),
    })))
    .select("id, word, sentence, segments, choice");
  if (wordError) throw wordError;

  const poolIdBySignature = buildAutoAssignedPoolIdMap(insertedWordRows || []);
  const { data: createdAssignment, error: assignmentError } = await insertSingleRowWithAnalyticsFallback(
    serviceClient,
    "assignments_v2",
    {
      teacher_id: teacherId,
      school_id: schoolId,
      test_id: createdTestId,
      class_id: classId,
      mode: "test",
      max_attempts: null,
      audio_enabled: true,
      hints_enabled: true,
      end_at: deadlineIso || null,
      analytics_target_words_enabled: false,
      analytics_target_words_per_pupil: 0,
      evidence_source: safeEvidenceSource,
      automation_kind: AUTOMATION_KIND_PERSONALISED,
      automation_source: safeAutomationSource,
      automation_run_id: normalizeId(runId) || null,
      automation_triggered_by: teacherId,
    },
    "id, created_at",
  );
  if (assignmentError || !createdAssignment?.id) {
    throw assignmentError || new Error("Could not create the personalised assignment.");
  }
  createdAssignmentId = normalizeId(createdAssignment.id);
  if (artifacts) artifacts.assignmentId = createdAssignmentId;

  const targetRows = buildAutoAssignedTargetRows({
    teacherId,
    assignmentId: createdAssignmentId,
    assignmentCreatedAt: String(createdAssignment.created_at || new Date().toISOString()),
    pupilPlans,
    poolIdBySignature,
    schoolId,
  });
  if (!targetRows.length) throw new Error("Could not create generated target rows.");

  const { error: targetError } = await serviceClient
    .from("assignment_pupil_target_words")
    .upsert(targetRows, { onConflict: "assignment_id,pupil_id,test_word_id" });
  if (targetError) throw targetError;

  const pupilWordCountsByPupil = buildPupilWordCountByPupil(pupilPlans);
  const nowIso = new Date().toISOString();
  const statusRows = Object.entries(pupilWordCountsByPupil)
    .map(([pupilId, totalWords]) => ({
      teacher_id: teacherId,
      school_id: schoolId,
      assignment_id: createdAssignmentId,
      class_id: classId,
      test_id: createdTestId,
      pupil_id: pupilId,
      status: "assigned",
      started_at: null,
      completed_at: null,
      last_opened_at: null,
      last_activity_at: null,
      total_words: Math.max(0, Number(totalWords || 0)),
      correct_words: 0,
      average_attempts: 0,
      score_rate: 0,
      result_json: [],
      created_at: nowIso,
      updated_at: nowIso,
    }));

  const { error: statusError } = await serviceClient
    .from("assignment_pupil_statuses")
    .upsert(statusRows, { onConflict: "assignment_id,pupil_id" });
  if (statusError) throw statusError;

  return {
    assignmentId: createdAssignmentId,
    testId: createdTestId,
  };
}

async function cleanupGeneratedArtifacts(
  serviceClient: ServiceClient,
  { assignmentId, testId, teacherId, schoolId }: CreatedArtifacts & { teacherId: string; schoolId: string },
) {
  try {
    if (assignmentId) {
      const { error: statusError } = await serviceClient
        .from("assignment_pupil_statuses")
        .delete()
        .eq("assignment_id", assignmentId)
        .eq("school_id", schoolId);
      if (statusError && !isMissingTableError(statusError, "assignment_pupil_statuses")) throw statusError;

      const { error: targetError } = await serviceClient
        .from("assignment_pupil_target_words")
        .delete()
        .eq("assignment_id", assignmentId)
        .eq("school_id", schoolId);
      if (targetError && !isMissingTableError(targetError, "assignment_pupil_target_words")) throw targetError;

      const { error: assignmentError } = await serviceClient
        .from("assignments_v2")
        .delete()
        .eq("id", assignmentId)
        .eq("teacher_id", teacherId)
        .eq("school_id", schoolId);
      if (assignmentError) throw assignmentError;
    }

    if (testId) {
      const { error: wordError } = await serviceClient
        .from("test_words")
        .delete()
        .eq("test_id", testId)
        .eq("school_id", schoolId);
      if (wordError) throw wordError;

      const { error: testError } = await serviceClient
        .from("tests")
        .delete()
        .eq("id", testId)
        .eq("teacher_id", teacherId)
        .eq("school_id", schoolId);
      if (testError) throw testError;
    }
    return true;
  } catch (error) {
    console.error("Could not clean up generated personalised provisioning artifacts:", error);
    return false;
  }
}

async function buildProvisioningInputsForContext(
  serviceClient: ServiceClient,
  context: {
    pupilId: string;
    teacherId: string;
    schoolId: string;
    classId: string;
  },
  completedBaselineAssignmentId: string,
) {
  const [
    attemptRows,
    teacherTests,
    completedBaselineAssignments,
    classBaselineAssignments,
    wordloomCoreWordRows,
  ] = await Promise.all([
    readAttemptsForPupil(serviceClient, {
      pupilId: context.pupilId,
      schoolId: context.schoolId,
    }),
    readTeacherTests(serviceClient, {
      teacherId: context.teacherId,
      schoolId: context.schoolId,
    }),
    readBaselineAssignmentsById(serviceClient, {
      assignmentIds: [completedBaselineAssignmentId],
      schoolId: context.schoolId,
    }),
    readBaselineAssignmentsForClass(serviceClient, {
      classId: context.classId,
      schoolId: context.schoolId,
    }),
    readWordloomCoreSpellingBankWordRows(serviceClient),
  ]);
  const baselineAssignments = mergeBaselineAssignments(completedBaselineAssignments, classBaselineAssignments);
  const baselineStatusRows = await readCompletedBaselineStatusRows(serviceClient, {
    assignmentIds: baselineAssignments.map((assignment: Record<string, unknown>) => normalizeId(assignment.id)),
    pupilId: context.pupilId,
    schoolId: context.schoolId,
  });
  const attemptDerivedBaselineStatusRows = buildAttemptDerivedBaselineStatusRows({
    pupilId: context.pupilId,
    completedAssignmentId: completedBaselineAssignmentId,
    baselineAssignments,
    baselineStatusRows,
    attemptRows,
  });

  return {
    attemptRows,
    teacherTests,
    baselineAssignments,
    baselineStatusRows: [
      ...baselineStatusRows,
      ...attemptDerivedBaselineStatusRows,
    ],
    wordloomCoreWordRows,
  };
}

async function handleExtraChallengeProvisioning(serviceClient: ServiceClient, pupilId: string) {
  const context = await readExtraChallengeContext(serviceClient, pupilId);
  if (!context) return publicStatus("not_eligible");

  const baselineGateState = await readBaselineGateState(serviceClient, context.pupilId);
  if (getBaselineGateStatus(baselineGateState) !== "ready") {
    return publicStatus("not_eligible");
  }

  const runtimeAssignments = await readRuntimeAssignmentsForPupil(serviceClient, context.pupilId);
  if (hasIncompleteRequiredCoreRuntimeAssignment(runtimeAssignments)) {
    return publicStatus("not_eligible");
  }
  if (!hasCompletedRequiredCoreRuntimeAssignment(runtimeAssignments)) {
    return publicStatus("not_eligible");
  }

  const activeExtraChallenge = findActiveExtraChallengeRuntimeAssignment(runtimeAssignments);
  const activeExtraChallengeId = normalizeId(activeExtraChallenge?.id);
  if (activeExtraChallengeId) {
    return publicStatus("already_active", 200, activeExtraChallengeId);
  }

  const completedBaselineAssignmentId = getCompletedBaselineAssignmentId(baselineGateState);
  const inputs = await buildProvisioningInputsForContext(
    serviceClient,
    context,
    completedBaselineAssignmentId,
  );

  let plan: Record<string, unknown> | null = null;
  try {
    const built = buildProvisioningPlan({
      pupilId: context.pupilId,
      teacherTests: inputs.teacherTests,
      attemptRows: inputs.attemptRows,
      baselineAssignments: inputs.baselineAssignments,
      baselineStatusRows: inputs.baselineStatusRows,
      wordloomCoreWordRows: inputs.wordloomCoreWordRows,
      policy: {
        assignment_length: EXTRA_CHALLENGE_ASSIGNMENT_LENGTH,
        support_preset: EXTRA_CHALLENGE_SUPPORT_PRESET,
        allow_starter_fallback: false,
      },
      resolvedWordMap: null,
    });
    plan = built.plan;
  } catch (error) {
    console.log("Extra challenge not ready:", error);
    return publicStatus("not_enough_evidence");
  }

  const createdArtifacts: CreatedArtifacts = {
    assignmentId: "",
    testId: "",
  };

  try {
    const created = await createGeneratedAssignment(serviceClient, {
      teacherId: context.teacherId,
      schoolId: context.schoolId,
      classId: context.classId,
      className: String(context.classRow?.name || "Class"),
      runId: "",
      deadlineIso: null,
      plan,
      artifacts: createdArtifacts,
      evidenceSource: EVIDENCE_SOURCE_EXTRA_CHALLENGE,
      automationSource: null,
      titleOverride: "Extra challenge",
    });

    return publicStatus("provisioned", 200, created.assignmentId);
  } catch (error) {
    console.error("Extra challenge provisioning failed:", error);
    const hasArtifacts = !!(createdArtifacts.assignmentId || createdArtifacts.testId);
    if (hasArtifacts) {
      await cleanupGeneratedArtifacts(serviceClient, {
        ...createdArtifacts,
        teacherId: context.teacherId,
        schoolId: context.schoolId,
      });
    }
    return publicStatus("error", 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ status: "method_not_allowed" }, 405);
  }

  let serviceClient: ServiceClient | null = null;
  let runPupilId = "";
  let teacherId = "";
  let schoolId = "";
  let completedClaim = false;
  let requestedAction = "";
  const createdArtifacts: CreatedArtifacts = {
    assignmentId: "",
    testId: "",
  };

  try {
    const body = await readJsonBody(req) as Record<string, unknown>;
    const pupilId = normalizeId(body?.pupilId);
    if (!isUuid(pupilId)) {
      return publicStatus("invalid_pupil");
    }
    const action = normalizeSourceKey(body?.action || body?.mode || "");
    requestedAction = action;

    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();
    serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    if (action === EXTRA_CHALLENGE_ACTION) {
      return await handleExtraChallengeProvisioning(serviceClient, pupilId);
    }

    const claim = await claimWaitingRunPupil(serviceClient, pupilId);
    const claimStatus = String(claim.status || "").trim().toLowerCase();
    if (claimStatus !== CLAIMED_STATUS) {
      return publicStatus(claimStatus || "nothing_waiting");
    }

    const context = await readClaimContext(serviceClient, claim);
    runPupilId = context.runPupilId;
    teacherId = context.teacherId;
    schoolId = context.schoolId;

    const baselineGateState = await readBaselineGateState(serviceClient, context.pupilId);
    const baselineStatus = getBaselineGateStatus(baselineGateState);
    if (baselineStatus !== "ready") {
      await releaseClaim(serviceClient, runPupilId);
      return publicStatus("not_ready");
    }
    const completedBaselineAssignmentId = getCompletedBaselineAssignmentId(baselineGateState);

    if (await hasActivePersonalisedAssignment(serviceClient, {
      pupilId: context.pupilId,
      schoolId: context.schoolId,
    })) {
      await releaseClaim(serviceClient, runPupilId);
      return publicStatus("already_active");
    }

    const [
      attemptRows,
      teacherTests,
      completedBaselineAssignments,
      classBaselineAssignments,
      wordloomCoreWordRows,
    ] = await Promise.all([
      readAttemptsForPupil(serviceClient, {
        pupilId: context.pupilId,
        schoolId: context.schoolId,
      }),
      readTeacherTests(serviceClient, {
        teacherId: context.teacherId,
        schoolId: context.schoolId,
      }),
      readBaselineAssignmentsById(serviceClient, {
        assignmentIds: [completedBaselineAssignmentId],
        schoolId: context.schoolId,
      }),
      readBaselineAssignmentsForClass(serviceClient, {
        classId: context.classId,
        schoolId: context.schoolId,
      }),
      readWordloomCoreSpellingBankWordRows(serviceClient),
    ]);
    const baselineAssignments = mergeBaselineAssignments(completedBaselineAssignments, classBaselineAssignments);

    const baselineStatusRows = await readCompletedBaselineStatusRows(serviceClient, {
      assignmentIds: baselineAssignments.map((assignment: Record<string, unknown>) => normalizeId(assignment.id)),
      pupilId: context.pupilId,
      schoolId: context.schoolId,
    });
    const attemptDerivedBaselineStatusRows = buildAttemptDerivedBaselineStatusRows({
      pupilId: context.pupilId,
      completedAssignmentId: completedBaselineAssignmentId,
      baselineAssignments,
      baselineStatusRows,
      attemptRows,
    });
    const effectiveBaselineStatusRows = [
      ...baselineStatusRows,
      ...attemptDerivedBaselineStatusRows,
    ];
    const baselineAssignmentIds = new Set(
      baselineAssignments
        .map((assignment: Record<string, unknown>) => normalizeId(assignment.id))
        .filter(Boolean)
    );
    const baselineAttemptCount = attemptRows
      .filter((attempt: Record<string, unknown>) => baselineAssignmentIds.has(normalizeId(attempt.assignment_id)))
      .length;
    console.log("Personalised provisioning evidence counts:", {
      baselineAssignmentCount: baselineAssignments.length,
      completedBaselineStatusCount: baselineStatusRows.length,
      syntheticBaselineStatusCount: attemptDerivedBaselineStatusRows.length,
      baselineAttemptCount,
      teacherTestCount: Array.isArray(teacherTests) ? teacherTests.length : 0,
      wordloomCoreWordCount: Array.isArray(wordloomCoreWordRows) ? wordloomCoreWordRows.length : 0,
    });

    const { plan } = buildProvisioningPlan({
      pupilId: context.pupilId,
      teacherTests,
      attemptRows,
      baselineAssignments,
      baselineStatusRows: effectiveBaselineStatusRows,
      wordloomCoreWordRows,
      policy: buildProvisioningPolicy(context.runRow),
      resolvedWordMap: null,
    });

    const created = await createGeneratedAssignment(serviceClient, {
      teacherId: context.teacherId,
      schoolId: context.schoolId,
      classId: context.classId,
      className: String(context.classRow?.name || "Class"),
      runId: context.runId,
      deadlineIso: String(context.runRow?.derived_deadline_at || "") || null,
      plan,
      artifacts: createdArtifacts,
    });
    createdArtifacts.assignmentId = created.assignmentId;
    createdArtifacts.testId = created.testId;

    const completeResult = await completeClaim(serviceClient, runPupilId, created.assignmentId);
    if (String(completeResult.status || "").trim().toLowerCase() !== "completed") {
      throw new Error(`Could not complete personalised provisioning claim: ${String(completeResult.status || "unknown")}`);
    }
    completedClaim = true;

    return json(buildPublicProvisioningResponse({
      status: "provisioned",
      assignmentId: created.assignmentId,
    }));
  } catch (error) {
    console.error("Personalised provisioning failed:", error);

    if (serviceClient && runPupilId && !completedClaim) {
      const hasArtifacts = !!(createdArtifacts.assignmentId || createdArtifacts.testId);
      const cleanupOk = hasArtifacts
        ? await cleanupGeneratedArtifacts(serviceClient, {
          ...createdArtifacts,
          teacherId,
          schoolId,
        })
        : true;

      if (cleanupOk) {
        await releaseClaimSafely(serviceClient, runPupilId);
      }
    }

    return json(buildPublicProvisioningResponse({
      status: requestedAction === EXTRA_CHALLENGE_ACTION ? "error" : "generation_failed",
    }), 500);
  }
});
