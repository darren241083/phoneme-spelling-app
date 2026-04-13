// /js/db.js
import { supabase } from "./supabaseClient.js";
import { DEFAULT_QUESTION_TYPE, normalizeStoredQuestionType } from "./questionTypes.js?v=1.1";
import {
  buildAssignmentEnginePupilReason,
  isFullyGeneratedAssignmentWordRows,
} from "./assignmentEngine.js?v=1.5";
import {
  buildBaselinePupilReason,
  isBaselineAssignmentWordRows,
  REQUIRED_BASELINE_STANDARD_KEY,
  resolveBaselineStandardKeyFromWordRows,
} from "./baselinePlacement.js?v=1.3";
import { syncAssignmentPupilTargetWords } from "./assignmentTargets.js";
import {
  buildDefaultPersonalisedAutomationPolicy,
  getLegacyPersonalisedAutomationPolicyActiveValue,
  getPersonalisedAutomationPolicyLifecycle,
  isPersonalisedAutomationPolicyUsable,
  normalizeAutoAssignPolicy,
  normalizePersonalisedAutomationPolicy,
} from "./autoAssignPolicy.js?v=1.7";

const ASSIGNMENT_TARGET_TABLE = "assignment_pupil_target_words";
const ASSIGNMENT_STATUS_TABLE = "assignment_pupil_statuses";
const CLASS_AUTO_ASSIGN_POLICY_TABLE = "class_auto_assignment_policies";
const TEACHER_APP_ROLE_TABLE = "teacher_app_roles";
const PERSONALISED_GENERATION_RUN_TABLE = "personalised_generation_runs";
const PERSONALISED_GENERATION_RUN_PUPIL_TABLE = "personalised_generation_run_pupils";
const PERSONALISED_AUTOMATION_POLICY_TABLE = "personalised_automation_policies";
const PERSONALISED_AUTOMATION_POLICY_TARGET_TABLE = "personalised_automation_policy_targets";
const PERSONALISED_AUTOMATION_POLICY_EVENT_TABLE = "personalised_automation_policy_events";
const STAFF_PROFILES_TABLE = "staff_profiles";
const STAFF_IMPORT_BATCH_TABLE = "staff_import_batches";
const STAFF_PENDING_ACCESS_APPROVALS_TABLE = "staff_pending_access_approvals";
const STAFF_PENDING_ROLE_ASSIGNMENTS_TABLE = "staff_pending_role_assignments";
const STAFF_PENDING_SCOPE_ASSIGNMENTS_TABLE = "staff_pending_scope_assignments";
const STAFF_ACCESS_CONTEXT_FUNCTION = "get_my_access_context";
const STAFF_PROFILE_UPSERT_FUNCTION = "upsert_my_staff_profile";
const STAFF_IMPORT_FUNCTION = "import_staff_directory_csv";
const STAFF_PENDING_ACCESS_PREFLIGHT_FUNCTION = "staff_pending_access_duplicate_preflight";
const STAFF_PENDING_ACCESS_SUMMARIES_FUNCTION = "list_staff_pending_access_summaries";
const STAFF_PENDING_ACCESS_DETAIL_FUNCTION = "read_staff_pending_access_detail";
const STAFF_PENDING_ACCESS_SAVE_FUNCTION = "save_staff_pending_access_approval";
const STAFF_PENDING_ACCESS_CANCEL_FUNCTION = "cancel_staff_pending_access_approval";

export const ASSIGNMENT_AUTOMATION_KIND_PERSONALISED = "personalised";
export const ASSIGNMENT_AUTOMATION_SOURCE_MANUAL_RUN_NOW = "manual_run_now";
export const CLASS_TYPE_FORM = "form";
export const CLASS_TYPE_SUBJECT = "subject";
export const CLASS_TYPE_INTERVENTION = "intervention";

let latestStaffProfileSyncNotice = null;

/* ---------------------------
   Helpers
---------------------------- */

function requireUserId(user) {
  const id = user?.id;
  if (!id) throw new Error("Not signed in.");
  return id;
}

function randomJoinCode(len = 6) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function isMissingAssignmentTargetTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(ASSIGNMENT_TARGET_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingAssignmentStatusTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(ASSIGNMENT_STATUS_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingClassAutoAssignPolicyTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(CLASS_AUTO_ASSIGN_POLICY_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingTeacherAppRoleTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(TEACHER_APP_ROLE_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingClassTypeColumnError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42703"
    || code === "PGRST204"
    || (message.includes("class_type") && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("column")
    ))
  );
}

function isMissingAssignmentAutomationColumnError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  const mentionsAutomationColumn =
    message.includes("automation_kind")
    || message.includes("automation_source")
    || message.includes("automation_run_id")
    || message.includes("automation_triggered_by");
  return mentionsAutomationColumn && (
    code === "42703"
    || code === "PGRST204"
    || message.includes("schema cache")
    || message.includes("column")
  );
}

function isMissingPersonalisedGenerationRunTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(PERSONALISED_GENERATION_RUN_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingPersonalisedGenerationRunPupilTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(PERSONALISED_GENERATION_RUN_PUPIL_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingPersonalisedGenerationRunColumnError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  const mentionsColumn =
    message.includes("automation_policy_id")
    || message.includes("policy_snapshot")
    || message.includes("derived_deadline_at");
  return mentionsColumn && (
    code === "42703"
    || code === "PGRST204"
    || message.includes("schema cache")
    || message.includes("column")
  );
}

function isMissingPersonalisedAutomationPolicyTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(PERSONALISED_AUTOMATION_POLICY_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingPersonalisedAutomationPolicyTargetTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(PERSONALISED_AUTOMATION_POLICY_TARGET_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingPersonalisedAutomationPolicyEventTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(PERSONALISED_AUTOMATION_POLICY_EVENT_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingPersonalisedAutomationPolicyColumnError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  const mentionsColumn =
    message.includes("selected_weekdays_week_1")
    || message.includes("selected_weekdays_week_2")
    || message.includes("name")
    || message.includes("description")
    || message.includes("archived_at")
    || message.includes("archived_by");
  return mentionsColumn && (
    code === "42703"
    || code === "PGRST204"
    || message.includes("schema cache")
    || message.includes("column")
  );
}

function normalizeTeacherAppRole(value) {
  return String(value || "").trim().toLowerCase() === "central_owner"
    ? "central_owner"
    : "teacher";
}

function normalizeStaffProfileDisplayName(value = "", fallbackEmail = "") {
  const safeValue = String(value || "").trim();
  if (safeValue) return safeValue;
  const emailLocalPart = String(fallbackEmail || "").trim().split("@")[0];
  return emailLocalPart || "Staff member";
}

function deriveStaffProfileDisplayName(user = null) {
  const metadata = user?.user_metadata && typeof user.user_metadata === "object"
    ? user.user_metadata
    : {};
  const email = String(user?.email || "").trim().toLowerCase();
  const directName = normalizeStaffProfileDisplayName(
    metadata.display_name || metadata.full_name || "",
    email,
  );
  if (directName && directName !== "Staff member") return directName;

  const firstName = String(metadata.first_name || "").trim();
  const lastName = String(metadata.last_name || "").trim();
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return normalizeStaffProfileDisplayName(combinedName, email);
}

function isMissingStaffAccessFoundationError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42883"
    || code === "42P01"
    || code === "PGRST202"
    || code === "PGRST204"
    || code === "PGRST205"
    || message.includes(STAFF_ACCESS_CONTEXT_FUNCTION)
    || message.includes("staff_role_assignments")
    || message.includes("staff_scope_assignments")
    || message.includes("is_admin_compat")
    || message.includes("function");
}

function isMissingStaffProfilesTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(STAFF_PROFILES_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingStaffProfilesColumnError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  const mentionsStaffProfileColumn =
    message.includes("staff_profiles")
    || message.includes("external_staff_id")
    || message.includes("profile_source")
    || message.includes("import_metadata")
    || message.includes("last_import_batch_id")
    || message.includes("last_imported_at")
    || message.includes("last_imported_by")
    || message.includes("notes")
    || message.includes("\"id\"");
  return mentionsStaffProfileColumn && (
    code === "42703"
    || code === "PGRST204"
    || message.includes("schema cache")
    || message.includes("column")
  );
}

function isMissingStaffProfileUpsertFunctionError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42883"
    || code === "PGRST202"
    || message.includes(STAFF_PROFILE_UPSERT_FUNCTION);
}

function isMissingStaffProfilesSupportError(error) {
  return isMissingStaffProfilesTableError(error)
    || isMissingStaffProfilesColumnError(error)
    || isMissingStaffProfileUpsertFunctionError(error);
}

function isMissingStaffImportBatchTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes(STAFF_IMPORT_BATCH_TABLE) && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

function isMissingStaffImportFunctionError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42883"
    || code === "PGRST202"
    || message.includes(STAFF_IMPORT_FUNCTION);
}

function isMissingStaffImportSupportError(error) {
  return isMissingStaffImportBatchTableError(error) || isMissingStaffImportFunctionError(error);
}

function isMissingStaffPendingAccessSupportError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "42883"
    || code === "PGRST202"
    || code === "PGRST204"
    || code === "PGRST205"
    || message.includes(STAFF_PENDING_ACCESS_APPROVALS_TABLE)
    || message.includes(STAFF_PENDING_ROLE_ASSIGNMENTS_TABLE)
    || message.includes(STAFF_PENDING_SCOPE_ASSIGNMENTS_TABLE)
    || message.includes(STAFF_PENDING_ACCESS_PREFLIGHT_FUNCTION)
    || message.includes(STAFF_PENDING_ACCESS_SUMMARIES_FUNCTION)
    || message.includes(STAFF_PENDING_ACCESS_DETAIL_FUNCTION)
    || message.includes(STAFF_PENDING_ACCESS_SAVE_FUNCTION)
    || message.includes(STAFF_PENDING_ACCESS_CANCEL_FUNCTION);
}

function setLatestStaffProfileSyncNotice(value = null) {
  const payload = value && typeof value === "object" ? value : null;
  const profileSyncMessage = String(payload?.profile_sync_message || "").trim();
  const pendingAccessResult = payload?.pending_access_result && typeof payload.pending_access_result === "object"
    ? payload.pending_access_result
    : null;
  const pendingStatus = String(pendingAccessResult?.status || "").trim().toLowerCase();
  const pendingMessage = String(pendingAccessResult?.message || "").trim();

  latestStaffProfileSyncNotice = null;
  if (pendingStatus === "activated" && pendingMessage) {
    latestStaffProfileSyncNotice = {
      kind: "success",
      message: pendingMessage,
    };
    return;
  }
  if ((pendingStatus === "invalidated" || pendingStatus === "blocked") && pendingMessage) {
    latestStaffProfileSyncNotice = {
      kind: "error",
      message: pendingMessage,
    };
    return;
  }
  if (profileSyncMessage) {
    latestStaffProfileSyncNotice = {
      kind: "error",
      message: profileSyncMessage,
    };
  }
}

function buildDefaultStaffAccessContext({
  userId = "",
  legacyRole = null,
} = {}) {
  const normalizedLegacyRole = legacyRole === "central_owner"
    ? "central_owner"
    : (legacyRole === "teacher" ? "teacher" : null);
  const isLegacyCentralOwner = normalizedLegacyRole === "central_owner";
  const hasLegacyTeacherCompat = normalizedLegacyRole === "teacher" || isLegacyCentralOwner;
  const createEmptyRoleScopes = () => ({
    school: false,
    year_groups: [],
    departments: [],
    class_ids: [],
  });
  return {
    version: 2,
    user_id: userId || null,
    legacy: {
      teacher_app_role: normalizedLegacyRole,
      is_legacy_central_owner: isLegacyCentralOwner,
    },
    roles: {
      admin: isLegacyCentralOwner,
      teacher: hasLegacyTeacherCompat,
      hoy: false,
      hod: false,
      senco: false,
      literacy_lead: false,
    },
    capabilities: {
      can_manage_automation: isLegacyCentralOwner,
      can_import_csv: isLegacyCentralOwner,
      can_manage_roles: isLegacyCentralOwner,
      can_create_classes: hasLegacyTeacherCompat,
      can_create_tests: hasLegacyTeacherCompat,
      can_assign_tests: hasLegacyTeacherCompat,
      can_manage_intervention_groups: isLegacyCentralOwner,
      can_manage_own_content: hasLegacyTeacherCompat,
      can_view_schoolwide_analytics: isLegacyCentralOwner,
    },
    scopes: {
      school: isLegacyCentralOwner,
      year_groups: [],
      departments: [],
      class_ids: [],
    },
    role_scopes: {
      admin: {
        ...createEmptyRoleScopes(),
        school: isLegacyCentralOwner,
      },
      teacher: createEmptyRoleScopes(),
      hoy: createEmptyRoleScopes(),
      hod: createEmptyRoleScopes(),
      senco: createEmptyRoleScopes(),
      literacy_lead: createEmptyRoleScopes(),
    },
    data_health: {
      unmapped_subject_class_count: 0,
    },
  };
}

function normalizeTextList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeRoleScopes(value = {}, fallback = {}) {
  return {
    school: value?.school == null ? !!fallback?.school : !!value.school,
    year_groups: normalizeTextList(value?.year_groups || fallback?.year_groups),
    departments: normalizeTextList(value?.departments || fallback?.departments),
    class_ids: normalizeTextList(value?.class_ids || fallback?.class_ids),
  };
}

function normalizeStaffProfileRow(row = {}) {
  const email = String(row?.email || "").trim().toLowerCase();
  const importMetadata = row?.import_metadata && typeof row.import_metadata === "object"
    ? row.import_metadata
    : {};
  return {
    id: String(row?.id || row?.user_id || "").trim(),
    user_id: String(row?.user_id || "").trim(),
    email,
    display_name: normalizeStaffProfileDisplayName(row?.display_name, email),
    external_staff_id: String(row?.external_staff_id || "").trim(),
    notes: String(row?.notes || "").trim(),
    profile_source: String(row?.profile_source || "self_service").trim().toLowerCase() || "self_service",
    import_metadata: importMetadata,
    last_import_batch_id: String(row?.last_import_batch_id || "").trim(),
    last_imported_at: String(row?.last_imported_at || "").trim(),
    last_imported_by: String(row?.last_imported_by || "").trim(),
    created_at: String(row?.created_at || "").trim(),
    updated_at: String(row?.updated_at || "").trim(),
  };
}

function normalizeStaffRoleAssignmentRow(row = {}) {
  return {
    id: String(row?.id || "").trim(),
    user_id: String(row?.user_id || "").trim(),
    role: String(row?.role || "").trim().toLowerCase(),
    active: !!row?.active,
    granted_by: String(row?.granted_by || "").trim(),
    created_at: String(row?.created_at || "").trim(),
    updated_at: String(row?.updated_at || "").trim(),
  };
}

function normalizeStaffScopeAssignmentRow(row = {}) {
  return {
    id: String(row?.id || "").trim(),
    user_id: String(row?.user_id || "").trim(),
    role: String(row?.role || "").trim().toLowerCase(),
    scope_type: String(row?.scope_type || "").trim().toLowerCase(),
    scope_value: String(row?.scope_value || "").trim(),
    active: !!row?.active,
    granted_by: String(row?.granted_by || "").trim(),
    created_at: String(row?.created_at || "").trim(),
    updated_at: String(row?.updated_at || "").trim(),
  };
}

function normalizeStaffAccessAuditRow(row = {}) {
  return {
    id: String(row?.id || "").trim(),
    actor_user_id: String(row?.actor_user_id || "").trim(),
    target_user_id: String(row?.target_user_id || "").trim(),
    action: String(row?.action || "").trim().toLowerCase(),
    role: String(row?.role || "").trim().toLowerCase(),
    scope_type: String(row?.scope_type || "").trim().toLowerCase(),
    scope_value: String(row?.scope_value || "").trim(),
    metadata: row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
    created_at: String(row?.created_at || "").trim(),
  };
}

function normalizeStaffPendingScopeRow(row = {}) {
  return {
    role: String(row?.role || "").trim().toLowerCase(),
    scope_type: String(row?.scope_type || "").trim().toLowerCase(),
    scope_value: String(row?.scope_value || "").trim(),
  };
}

function normalizeStaffPendingDuplicateConflictRow(row = {}) {
  const conflictProfiles = Array.isArray(row?.conflicting_profiles)
    ? row.conflicting_profiles
    : (Array.isArray(row?.profiles) ? row.profiles : []);
  return {
    kind: String(row?.kind || "").trim().toLowerCase(),
    value: String(row?.value || "").trim(),
    conflict_count: Math.max(0, Number(row?.conflict_count || 0)),
    message: String(row?.message || "").trim(),
    conflicting_profiles: conflictProfiles
      .map((item) => ({
        id: String(item?.id || "").trim(),
        user_id: String(item?.user_id || "").trim(),
        display_name: normalizeStaffProfileDisplayName(item?.display_name, item?.email),
        email: String(item?.email || "").trim().toLowerCase(),
        external_staff_id: String(item?.external_staff_id || "").trim(),
      }))
      .filter((item) => item.id),
  };
}

function normalizeStaffPendingApprovalRow(row = {}) {
  return {
    id: String(row?.id || row?.approval_id || "").trim(),
    staff_profile_id: String(row?.staff_profile_id || "").trim(),
    status: String(row?.status || "").trim().toLowerCase(),
    approved_email: String(row?.approved_email || "").trim().toLowerCase(),
    approved_external_staff_id: String(row?.approved_external_staff_id || "").trim(),
    approved_by: String(row?.approved_by || "").trim(),
    approved_at: String(row?.approved_at || "").trim(),
    stale_after_at: String(row?.stale_after_at || "").trim(),
    activated_user_id: String(row?.activated_user_id || "").trim(),
    activated_at: String(row?.activated_at || "").trim(),
    invalidated_reason: String(row?.invalidated_reason || "").trim(),
    last_failure_reason: String(row?.last_failure_reason || "").trim(),
    last_failure_at: String(row?.last_failure_at || "").trim(),
    metadata: row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
    created_at: String(row?.created_at || "").trim(),
    updated_at: String(row?.updated_at || "").trim(),
    pending_roles: normalizeTextList(row?.pending_roles),
    pending_scopes: (Array.isArray(row?.pending_scopes) ? row.pending_scopes : [])
      .map((item) => normalizeStaffPendingScopeRow(item))
      .filter((item) => item.role && item.scope_type && item.scope_value),
    duplicate_conflicts: (Array.isArray(row?.duplicate_conflicts) ? row.duplicate_conflicts : [])
      .map((item) => normalizeStaffPendingDuplicateConflictRow(item))
      .filter((item) => item.kind),
    has_duplicate_conflicts: !!row?.has_duplicate_conflicts,
    is_stale: !!row?.is_stale,
  };
}

function normalizeStaffPendingAccessDetail(value = {}) {
  const approval = value?.approval && typeof value.approval === "object"
    ? normalizeStaffPendingApprovalRow(value.approval)
    : null;
  return {
    staff_profile_id: String(value?.staff_profile_id || approval?.staff_profile_id || "").trim(),
    profile_linked: !!value?.profile_linked,
    can_approve: !!value?.can_approve,
    duplicate_conflicts: (Array.isArray(value?.duplicate_conflicts) ? value.duplicate_conflicts : [])
      .map((item) => normalizeStaffPendingDuplicateConflictRow(item))
      .filter((item) => item.kind),
    approval,
  };
}

function normalizeStaffPendingAccessDuplicatePreflight(value = {}) {
  return {
    has_conflicts: !!value?.has_conflicts,
    email_conflict_count: Math.max(0, Number(value?.email_conflict_count || 0)),
    external_id_conflict_count: Math.max(0, Number(value?.external_id_conflict_count || 0)),
    email_conflicts: (Array.isArray(value?.email_conflicts) ? value.email_conflicts : [])
      .map((item) => normalizeStaffPendingDuplicateConflictRow(item))
      .filter((item) => item.kind),
    external_id_conflicts: (Array.isArray(value?.external_id_conflicts) ? value.external_id_conflicts : [])
      .map((item) => normalizeStaffPendingDuplicateConflictRow(item))
      .filter((item) => item.kind),
  };
}

function normalizeStaffAccessContext(value, {
  userId = "",
  legacyRole = null,
} = {}) {
  const fallback = buildDefaultStaffAccessContext({
    userId,
    legacyRole,
  });
  if (!value || typeof value !== "object") return fallback;

  const legacyTeacherRole = String(value?.legacy?.teacher_app_role || "").trim().toLowerCase();
  const normalizedLegacyRole = legacyTeacherRole === "central_owner"
    ? "central_owner"
    : (legacyTeacherRole === "teacher" ? "teacher" : fallback.legacy.teacher_app_role);
  const normalizedRoles = {
    admin: value?.roles?.admin == null ? fallback.roles.admin : !!value.roles.admin,
    teacher: value?.roles?.teacher == null ? fallback.roles.teacher : !!value.roles.teacher,
    hoy: value?.roles?.hoy == null ? fallback.roles.hoy : !!value.roles.hoy,
    hod: value?.roles?.hod == null ? fallback.roles.hod : !!value.roles.hod,
    senco: value?.roles?.senco == null ? fallback.roles.senco : !!value.roles.senco,
    literacy_lead: value?.roles?.literacy_lead == null ? fallback.roles.literacy_lead : !!value.roles.literacy_lead,
  };
  const normalizedCapabilities = {
    can_manage_automation: !!value?.capabilities?.can_manage_automation,
    can_import_csv: !!value?.capabilities?.can_import_csv,
    can_manage_roles: !!value?.capabilities?.can_manage_roles,
    can_create_classes: !!value?.capabilities?.can_create_classes,
    can_create_tests: !!value?.capabilities?.can_create_tests,
    can_assign_tests: !!value?.capabilities?.can_assign_tests,
    can_manage_intervention_groups: !!value?.capabilities?.can_manage_intervention_groups,
    can_manage_own_content: !!value?.capabilities?.can_manage_own_content,
    can_view_schoolwide_analytics: !!value?.capabilities?.can_view_schoolwide_analytics,
  };

  return {
    version: Math.max(1, Number(value?.version || fallback.version) || 1),
    user_id: String(value?.user_id || userId || "") || null,
    legacy: {
      teacher_app_role: normalizedLegacyRole,
      is_legacy_central_owner: !!value?.legacy?.is_legacy_central_owner || normalizedLegacyRole === "central_owner",
    },
    roles: normalizedRoles,
    capabilities: {
      ...fallback.capabilities,
      ...normalizedCapabilities,
    },
    scopes: {
      school: value?.scopes?.school == null ? fallback.scopes.school : !!value.scopes.school,
      year_groups: normalizeTextList(value?.scopes?.year_groups || fallback.scopes.year_groups),
      departments: normalizeTextList(value?.scopes?.departments || fallback.scopes.departments),
      class_ids: normalizeTextList(value?.scopes?.class_ids || fallback.scopes.class_ids),
    },
    role_scopes: {
      admin: normalizeRoleScopes(value?.role_scopes?.admin, fallback.role_scopes.admin),
      teacher: normalizeRoleScopes(value?.role_scopes?.teacher, fallback.role_scopes.teacher),
      hoy: normalizeRoleScopes(value?.role_scopes?.hoy, fallback.role_scopes.hoy),
      hod: normalizeRoleScopes(value?.role_scopes?.hod, fallback.role_scopes.hod),
      senco: normalizeRoleScopes(value?.role_scopes?.senco, fallback.role_scopes.senco),
      literacy_lead: normalizeRoleScopes(value?.role_scopes?.literacy_lead, fallback.role_scopes.literacy_lead),
    },
    data_health: {
      unmapped_subject_class_count: Math.max(0, Number(value?.data_health?.unmapped_subject_class_count || 0)),
    },
  };
}

function deriveTeacherAppRoleFromAccessContext(accessContext) {
  return accessContext?.capabilities?.can_manage_automation
    || accessContext?.legacy?.is_legacy_central_owner
    || accessContext?.roles?.admin
    ? "central_owner"
    : "teacher";
}

const staffProfileUpsertRequests = new Map();

async function ensureMyStaffProfile({
  user = null,
  teacherId = "",
} = {}) {
  const safeTeacherId = String(teacherId || user?.id || "").trim();
  if (!safeTeacherId) return null;

  if (staffProfileUpsertRequests.has(safeTeacherId)) {
    return staffProfileUpsertRequests.get(safeTeacherId);
  }

  const request = (async () => {
    let safeUser = user;
    if (!safeUser || String(safeUser?.id || "").trim() !== safeTeacherId) {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      safeUser = data?.user || null;
    }

    if (!safeUser || String(safeUser?.id || "").trim() !== safeTeacherId) return null;

    const requestedEmail = String(safeUser?.email || "").trim().toLowerCase();
    const requestedDisplayName = deriveStaffProfileDisplayName(safeUser);

    const { data, error } = await supabase.rpc(STAFF_PROFILE_UPSERT_FUNCTION, {
      requested_email: requestedEmail || null,
      requested_display_name: requestedDisplayName || null,
    });
    if (error) {
      if (isMissingStaffProfilesSupportError(error)) return null;
      throw error;
    }
    setLatestStaffProfileSyncNotice(data || null);
    return data || null;
  })()
    .catch((error) => {
      if (isMissingStaffProfilesSupportError(error)) return null;
      console.warn("Could not update staff profile:", error);
      return null;
    })
    .finally(() => {
      staffProfileUpsertRequests.delete(safeTeacherId);
    });

  staffProfileUpsertRequests.set(safeTeacherId, request);
  return request;
}

export function normalizeClassType(value, { legacyFallback = CLASS_TYPE_FORM } = {}) {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === CLASS_TYPE_FORM
    || normalized === CLASS_TYPE_SUBJECT
    || normalized === CLASS_TYPE_INTERVENTION
  ) {
    return normalized;
  }
  return legacyFallback;
}

function normalizeClassRow(row, { legacyFallback = CLASS_TYPE_FORM } = {}) {
  if (!row || typeof row !== "object") return null;
  return {
    ...row,
    id: String(row?.id || "").trim(),
    teacher_id: String(row?.teacher_id || "").trim(),
    name: String(row?.name || "").trim() || "Untitled class",
    year_group: String(row?.year_group || "").trim() || null,
    join_code: String(row?.join_code || "").trim() || null,
    created_at: row?.created_at || null,
    class_type: normalizeClassType(row?.class_type, { legacyFallback }),
  };
}

function normalizeClassAutoAssignPolicyRow(row) {
  if (!row || typeof row !== "object") return null;
  const normalizedPolicy = normalizeAutoAssignPolicy(row);
  return {
    id: String(row?.id || ""),
    teacher_id: String(row?.teacher_id || ""),
    class_id: String(row?.class_id || ""),
    assignment_length: normalizedPolicy.assignment_length,
    support_preset: normalizedPolicy.support_preset,
    allow_starter_fallback: normalizedPolicy.allow_starter_fallback,
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

function normalizeIdList(items = []) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )];
}

function normalizePersonalisedGenerationRunRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: String(row?.id || ""),
    teacher_id: String(row?.teacher_id || ""),
    trigger_role: String(row?.trigger_role || "central_owner"),
    run_source: String(row?.run_source || ASSIGNMENT_AUTOMATION_SOURCE_MANUAL_RUN_NOW),
    selected_class_ids: normalizeIdList(row?.selected_class_ids),
    automation_policy_id: String(row?.automation_policy_id || "").trim() || null,
    assignment_length: Math.max(0, Number(row?.assignment_length || 0)),
    support_preset: normalizeAutoAssignPolicy(row).support_preset,
    allow_starter_fallback: row?.allow_starter_fallback !== false,
    policy_snapshot: row?.policy_snapshot && typeof row.policy_snapshot === "object" ? row.policy_snapshot : {},
    derived_deadline_at: row?.derived_deadline_at || null,
    status: String(row?.status || "running"),
    class_count: Math.max(0, Number(row?.class_count || 0)),
    included_pupil_count: Math.max(0, Number(row?.included_pupil_count || 0)),
    skipped_pupil_count: Math.max(0, Number(row?.skipped_pupil_count || 0)),
    summary: row?.summary && typeof row.summary === "object" ? row.summary : {},
    started_at: row?.started_at || null,
    finished_at: row?.finished_at || null,
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

function normalizePersonalisedAutomationPolicyRow(row) {
  if (!row || typeof row !== "object") return null;
  const targets = Array.isArray(row?.personalised_automation_policy_targets)
    ? row.personalised_automation_policy_targets
    : (Array.isArray(row?.targets) ? row.targets : []);
  return normalizePersonalisedAutomationPolicy({
    ...row,
    target_class_ids: targets
      .map((item) => String(item?.class_id || "").trim())
      .filter(Boolean),
  });
}

async function getSignedInTeacherContext() {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const signedInUser = userRes?.user || null;
  const teacherId = requireUserId(signedInUser);

  const accessContext = await readStaffAccessContextForTeacherId(teacherId, {
    user: signedInUser,
  });
  return {
    teacherId,
    appRole: deriveTeacherAppRoleFromAccessContext(accessContext),
    accessContext,
  };
}

async function readLegacyTeacherAppRoleForTeacherId(teacherId = "") {
  const safeTeacherId = String(teacherId || "").trim();
  if (!safeTeacherId) return null;

  const { data, error } = await supabase
    .from(TEACHER_APP_ROLE_TABLE)
    .select("app_role")
    .eq("teacher_id", safeTeacherId)
    .maybeSingle();

  if (error) {
    if (isMissingTeacherAppRoleTableError(error)) {
      return null;
    }
    throw error;
  }

  return data?.app_role ? normalizeTeacherAppRole(data.app_role) : null;
}

async function readStaffAccessContextForTeacherId(teacherId = "", { user = null } = {}) {
  const safeTeacherId = String(teacherId || "").trim();
  const legacyRole = await readLegacyTeacherAppRoleForTeacherId(safeTeacherId);
  await ensureMyStaffProfile({
    user,
    teacherId: safeTeacherId,
  });

  try {
    const { data, error } = await supabase.rpc(STAFF_ACCESS_CONTEXT_FUNCTION);
    if (error) {
      if (isMissingStaffAccessFoundationError(error)) {
        return buildDefaultStaffAccessContext({
          userId: safeTeacherId,
          legacyRole,
        });
      }
      throw error;
    }

    return normalizeStaffAccessContext(data, {
      userId: safeTeacherId,
      legacyRole,
    });
  } catch (error) {
    if (isMissingStaffAccessFoundationError(error)) {
      return buildDefaultStaffAccessContext({
        userId: safeTeacherId,
        legacyRole,
      });
    }
    throw error;
  }
}

async function requireCentralOwnerContext({
  message = "Central-owner access is required for personalised automation.",
} = {}) {
  const context = await getSignedInTeacherContext();
  if (!context?.accessContext?.capabilities?.can_manage_automation) {
    throw new Error(message);
  }
  return context;
}

async function recordPersonalisedAutomationPolicyEvent({
  teacherId = "",
  policyId = "",
  eventType = "",
  metadata = {},
} = {}) {
  const safeTeacherId = String(teacherId || "").trim();
  const safePolicyId = String(policyId || "").trim();
  const safeEventType = String(eventType || "").trim().toLowerCase();
  if (!safeTeacherId || !safePolicyId || !safeEventType) return null;

  const payload = {
    teacher_id: safeTeacherId,
    policy_id: safePolicyId,
    actor_id: safeTeacherId,
    event_type: safeEventType,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  };

  const { error } = await supabase
    .from(PERSONALISED_AUTOMATION_POLICY_EVENT_TABLE)
    .insert([payload]);

  if (error) {
    if (isMissingPersonalisedAutomationPolicyEventTableError(error)) {
      console.warn("automation policy event storage unavailable:", error);
      return null;
    }
    throw error;
  }

  return payload;
}

async function validateAutomationEligibleClassIds(teacherId, classIds = []) {
  const safeTeacherId = String(teacherId || "").trim();
  const safeClassIds = normalizeIdList(classIds);
  if (!safeTeacherId || !safeClassIds.length) return [];

  let query = supabase
    .from("classes")
    .select("id, class_type")
    .eq("teacher_id", safeTeacherId)
    .in("id", safeClassIds);

  let { data, error } = await query;
  if (error && isMissingClassTypeColumnError(error)) {
    const legacyResult = await supabase
      .from("classes")
      .select("id")
      .eq("teacher_id", safeTeacherId)
      .in("id", safeClassIds);
    data = legacyResult.data || [];
    error = legacyResult.error || null;
  }
  if (error) throw error;

  const rows = (data || []).map((row) => normalizeClassRow(row, { legacyFallback: CLASS_TYPE_FORM })).filter(Boolean);
  if (rows.length !== safeClassIds.length) {
    throw new Error("Choose only your own form or intervention groups for automation.");
  }

  const eligibleIds = rows
    .filter((row) => {
      const classType = normalizeClassType(row?.class_type, { legacyFallback: CLASS_TYPE_FORM });
      return classType === CLASS_TYPE_FORM || classType === CLASS_TYPE_INTERVENTION;
    })
    .map((row) => String(row?.id || "").trim());

  if (eligibleIds.length !== safeClassIds.length) {
    throw new Error("Automated personalised tests can only target form or intervention groups.");
  }

  return safeClassIds.filter((classId) => eligibleIds.includes(classId));
}

async function tryInsertAttempts(payload) {
  const legacyWord = payload.word ?? payload.word_text ?? null;
  const legacyIsCorrect = payload.is_correct ?? payload.correct ?? null;
  const legacyAttemptNo = payload.attempt_no ?? payload.attempt_number ?? null;
  const essentialAssignmentVariant = {
    pupil_id: payload.pupil_id,
    assignment_id: payload.assignment_id ?? null,
    test_id: payload.test_id,
    test_word_id: payload.test_word_id ?? null,
    assignment_target_id: payload.assignment_target_id ?? null,
    mode: payload.mode,
    typed: payload.typed,
    correct: payload.correct,
    attempt_number: payload.attempt_number ?? null,
    word_text: payload.word_text ?? payload.word ?? null,
    word_source: payload.word_source ?? null,
  };
  const modernVariant = {
    ...essentialAssignmentVariant,
    attempts_allowed: payload.attempts_allowed ?? null,
    attempt_source: payload.attempt_source ?? null,
    target_graphemes: payload.target_graphemes ?? null,
    focus_grapheme: payload.focus_grapheme ?? null,
    pattern_type: payload.pattern_type ?? null,
    created_at: payload.created_at ?? null,
  };
  const legacyRichVariant = {
    ...modernVariant,
    word: legacyWord,
    is_correct: legacyIsCorrect,
    attempt_no: legacyAttemptNo,
  };
  const assignmentSafeVariant = {
    ...essentialAssignmentVariant,
    attempt_source: payload.attempt_source ?? null,
    focus_grapheme: payload.focus_grapheme ?? null,
    pattern_type: payload.pattern_type ?? null,
  };
  const essentialNoTargetVariant = {
    pupil_id: payload.pupil_id,
    assignment_id: payload.assignment_id ?? null,
    test_id: payload.test_id,
    test_word_id: payload.test_word_id ?? null,
    mode: payload.mode,
    typed: payload.typed,
    correct: payload.correct,
    attempt_number: payload.attempt_number ?? null,
    word_text: payload.word_text ?? payload.word ?? null,
  };
  const essentialNoTargetLegacyVariant = {
    ...essentialNoTargetVariant,
    word: legacyWord,
    is_correct: legacyIsCorrect,
    attempt_no: legacyAttemptNo,
  };
  const variants = [
    { name: "full_payload", data: payload },
    { name: "modern_variant", data: modernVariant },
    { name: "legacy_rich_variant", data: legacyRichVariant },
    { name: "essential_assignment_variant", data: essentialAssignmentVariant },
    { name: "assignment_safe_variant", data: assignmentSafeVariant },
    { name: "essential_no_target_variant", data: essentialNoTargetVariant },
    { name: "essential_no_target_legacy_variant", data: essentialNoTargetLegacyVariant },
  ];

  let lastError = null;
  for (const variant of variants) {
    const { error } = await supabase
      .from("attempts")
      .insert([variant.data])
      ;

    if (!error) {
      return {
        ...variant.data,
        id: null,
      };
    }
    console.warn("attempt insert variant failed:", {
      variant: variant.name,
      code: error?.code || "",
      message: error?.message || "",
    });
    lastError = error;
  }

  throw lastError || new Error("Could not record attempt.");
}

function normalizeAssignmentStatusRow(row) {
  const rawResultJson = row?.result_json ?? row?.resultJson ?? null;
  return {
    id: String(row?.id || ""),
    teacherId: String(row?.teacher_id || row?.teacherId || ""),
    assignmentId: String(row?.assignment_id || row?.assignmentId || ""),
    classId: String(row?.class_id || row?.classId || ""),
    testId: String(row?.test_id || row?.testId || ""),
    pupilId: String(row?.pupil_id || row?.pupilId || ""),
    status: String(row?.status || "assigned"),
    startedAt: row?.started_at || row?.startedAt || null,
    completedAt: row?.completed_at || row?.completedAt || null,
    lastOpenedAt: row?.last_opened_at || row?.lastOpenedAt || null,
    lastActivityAt: row?.last_activity_at || row?.lastActivityAt || null,
    totalWords: Math.max(0, Number(row?.total_words ?? row?.totalWords ?? 0)),
    correctWords: Math.max(0, Number(row?.correct_words ?? row?.correctWords ?? 0)),
    averageAttempts: Number.isFinite(Number(row?.average_attempts ?? row?.averageAttempts))
      ? Number(row?.average_attempts ?? row?.averageAttempts)
      : 0,
    scoreRate: Number.isFinite(Number(row?.score_rate ?? row?.scoreRate))
      ? Number(row?.score_rate ?? row?.scoreRate)
      : 0,
    resultJson: Array.isArray(rawResultJson) ? rawResultJson : [],
    createdAt: row?.created_at || row?.createdAt || null,
    updatedAt: row?.updated_at || row?.updatedAt || null,
  };
}

function sanitizeAssignmentResultRows(results = []) {
  function sanitizeAssignmentInputState(inputState = null) {
    const source = inputState && typeof inputState === "object" ? inputState : null;
    const kind = String(source?.kind || "").trim().toLowerCase();
    if (!kind) return null;

    if (kind === "full_recall") {
      return {
        kind,
        value: String(source?.value ?? "").trim().toLowerCase(),
      };
    }

    if (kind === "scroll") {
      return {
        kind,
        values: Array.isArray(source?.values)
          ? source.values.map((value) => String(value ?? "").trim().toLowerCase())
          : [],
        activeIndex: Math.max(0, Number(source?.activeIndex || 0)),
      };
    }

    if (kind === "arrange") {
      return {
        kind,
        slots: Array.isArray(source?.slots)
          ? source.slots.map((value) => {
            const tokenId = String(value || "").trim();
            return tokenId || null;
          })
          : [],
        activeSlotIndex: Math.max(0, Number(source?.activeSlotIndex || 0)),
      };
    }

    if (kind === "loom") {
      return {
        kind,
        placements: Array.isArray(source?.placements)
          ? source.placements
            .map((entry) => ({
              tokenId: String(entry?.tokenId || "").trim(),
              start: Math.max(0, Number(entry?.start || 0)),
            }))
            .filter((entry) => entry.tokenId)
          : [],
      };
    }

    if (kind === "segmented") {
      return {
        kind,
        letters: Array.isArray(source?.letters)
          ? source.letters.map((value) => String(value ?? "").trim().toLowerCase())
          : [],
        activeIndex: Math.max(0, Number(source?.activeIndex || 0)),
      };
    }

    return null;
  }

  function sanitizeAssignmentFeedbackState(feedbackState = null) {
    const source = feedbackState && typeof feedbackState === "object" ? feedbackState : null;
    const kind = String(source?.kind || "").trim().toLowerCase();
    if (kind !== "final_wrong_reveal") return null;

    return {
      kind,
      pending: source?.pending !== false,
    };
  }

  return (Array.isArray(results) ? results : [])
    .map((entry, index) => ({
      itemKey: String(entry?.itemKey || "").trim() || null,
      index: index + 1,
      wordId: String(entry?.wordId || "").trim() || null,
      baseTestWordId: String(entry?.baseTestWordId || "").trim() || null,
      assignmentTargetId: String(entry?.assignmentTargetId || "").trim() || null,
      word: String(entry?.word || entry?.correctSpelling || "").trim() || "",
      correctSpelling: String(entry?.correctSpelling || entry?.word || "").trim() || "",
      typed: String(entry?.typed ?? "").trim(),
      correct: !!entry?.correct,
      attemptsUsed: entry?.completed === false
        ? Math.max(0, Number(entry?.attemptsUsed ?? 0))
        : Math.max(1, Number(entry?.attemptsUsed || 1)),
      attemptsAllowed: Number.isFinite(Number(entry?.attemptsAllowed ?? entry?.attempts_allowed))
        ? Math.max(1, Number(entry?.attemptsAllowed ?? entry?.attempts_allowed))
        : null,
      completed: entry?.completed === false ? false : true,
      questionType: String(entry?.questionType || "").trim() || null,
      modeKind: String(entry?.modeKind || "").trim() || null,
      wordSource: String(entry?.wordSource || "").trim() || (entry?.assignmentTargetId ? "targeted" : "base"),
      focusGrapheme: String(entry?.focusGrapheme || "").trim().toLowerCase() || null,
      patternType: String(entry?.patternType || "").trim().toLowerCase() || null,
      targetGraphemes: Array.isArray(entry?.targetGraphemes)
        ? entry.targetGraphemes.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
        : [],
      inputState: sanitizeAssignmentInputState(entry?.inputState),
      feedbackState: sanitizeAssignmentFeedbackState(entry?.feedbackState ?? entry?.feedback_state),
    }))
    .filter((entry) => entry.assignmentTargetId || entry.baseTestWordId || entry.word);
}

function buildAssignmentCompletionSummary(result = null) {
  const rows = sanitizeAssignmentResultRows(result?.results || []).map((entry) => ({
    ...entry,
    completed: true,
    inputState: null,
    feedbackState: null,
  }));
  const completedRows = rows.filter((entry) => entry.completed !== false);
  const totalWords = Math.max(0, Number(result?.totalWords || completedRows.length || rows.length || 0));
  const correctWords = completedRows.filter((entry) => entry.correct).length;
  const averageAttempts = Number.isFinite(Number(result?.averageAttempts))
    ? Number(result.averageAttempts)
    : (completedRows.length
      ? completedRows.reduce((sum, entry) => sum + Math.max(1, Number(entry?.attemptsUsed || 1)), 0) / completedRows.length
      : 0);
  return {
    resultJson: rows,
    totalWords,
    correctWords,
    averageAttempts,
    scoreRate: totalWords ? correctWords / totalWords : 0,
  };
}

function buildAssignmentProgressSummary(progress = null) {
  const rows = sanitizeAssignmentResultRows(progress?.itemStates || []);
  const completedRows = rows.filter((entry) => entry.completed !== false);
  const totalWords = Math.max(0, Number(progress?.totalWords || rows.length || 0));
  const correctWords = completedRows.filter((entry) => entry.correct).length;
  const averageAttempts = completedRows.length
    ? completedRows.reduce((sum, entry) => sum + Math.max(1, Number(entry?.attemptsUsed || 1)), 0) / completedRows.length
    : 0;
  return {
    resultJson: rows,
    totalWords,
    correctWords,
    averageAttempts,
    scoreRate: totalWords ? correctWords / totalWords : 0,
  };
}

function resolveAssignmentTargetSourceWord(targetRow, wordRowsById = new Map()) {
  const joinedWord = Array.isArray(targetRow?.test_words)
    ? targetRow.test_words[0] || null
    : (targetRow?.test_words || null);
  if (joinedWord?.id) return joinedWord;

  const testWordId = String(targetRow?.test_word_id || targetRow?.testWordId || "").trim();
  if (!testWordId) return null;
  return wordRowsById.get(testWordId) || null;
}

async function readAssignmentStatusRows({ assignmentIds = [], pupilId = "" } = {}) {
  const ids = [...new Set((Array.isArray(assignmentIds) ? assignmentIds : []).map((item) => String(item || "").trim()).filter(Boolean))];
  if (!ids.length) return [];

  let query = supabase
    .from(ASSIGNMENT_STATUS_TABLE)
    .select("*")
    .in("assignment_id", ids)
    .order("updated_at", { ascending: true });

  const safePupilId = String(pupilId || "").trim();
  if (safePupilId) query = query.eq("pupil_id", safePupilId);

  const { data, error } = await query;
  if (error) {
    if (isMissingAssignmentStatusTableError(error)) return [];
    throw error;
  }

  return (data || []).map(normalizeAssignmentStatusRow);
}

export async function readAssignmentPupilStatus({ assignmentId = "", pupilId = "" } = {}) {
  const rows = await readAssignmentStatusRows({
    assignmentIds: [assignmentId],
    pupilId,
  });
  return rows[0] || null;
}

async function upsertAssignmentPupilStatus({
  teacherId = "",
  assignmentId = "",
  classId = "",
  testId = "",
  pupilId = "",
  startedAt = null,
  completedAt = null,
  lastOpenedAt = null,
  lastActivityAt = null,
  totalWords = null,
  correctWords = null,
  averageAttempts = null,
  scoreRate = null,
  resultJson = null,
} = {}) {
  const safeAssignmentId = String(assignmentId || "").trim();
  const safePupilId = String(pupilId || "").trim();
  if (!safeAssignmentId || !safePupilId) return null;

  let existing = null;
  try {
    existing = await readAssignmentPupilStatus({
      assignmentId: safeAssignmentId,
      pupilId: safePupilId,
    });
  } catch (error) {
    if (!isMissingAssignmentStatusTableError(error)) throw error;
  }

  const nowIso = new Date().toISOString();
  const nextStartedAt = existing?.startedAt || startedAt || lastOpenedAt || lastActivityAt || completedAt || null;
  const nextCompletedAt = existing?.completedAt || completedAt || null;
  const nextResultJson = Array.isArray(resultJson)
    ? sanitizeAssignmentResultRows(resultJson)
    : (Array.isArray(existing?.resultJson) ? existing.resultJson : []);
  const nextTotalWords = totalWords == null ? Math.max(0, Number(existing?.totalWords || 0)) : Math.max(0, Number(totalWords || 0));
  const nextCorrectWords = correctWords == null ? Math.max(0, Number(existing?.correctWords || 0)) : Math.max(0, Number(correctWords || 0));
  const nextAverageAttempts = averageAttempts == null
    ? (Number.isFinite(Number(existing?.averageAttempts)) ? Number(existing.averageAttempts) : 0)
    : (Number.isFinite(Number(averageAttempts)) ? Number(averageAttempts) : 0);
  const nextScoreRate = scoreRate == null
    ? (Number.isFinite(Number(existing?.scoreRate)) ? Number(existing.scoreRate) : (nextTotalWords ? nextCorrectWords / nextTotalWords : 0))
    : (Number.isFinite(Number(scoreRate)) ? Number(scoreRate) : (nextTotalWords ? nextCorrectWords / nextTotalWords : 0));
  const payload = {
    teacher_id: String(teacherId || existing?.teacherId || "").trim() || null,
    assignment_id: safeAssignmentId,
    class_id: String(classId || existing?.classId || "").trim() || null,
    test_id: String(testId || existing?.testId || "").trim() || null,
    pupil_id: safePupilId,
    status: nextCompletedAt
      ? "completed"
      : nextStartedAt
        ? "started"
        : String(existing?.status || "assigned"),
    started_at: nextStartedAt,
    completed_at: nextCompletedAt,
    last_opened_at: lastOpenedAt || existing?.lastOpenedAt || null,
    last_activity_at: lastActivityAt || completedAt || existing?.lastActivityAt || null,
    total_words: nextTotalWords,
    correct_words: nextCorrectWords,
    average_attempts: nextAverageAttempts,
    score_rate: nextScoreRate,
    result_json: nextResultJson,
    created_at: existing?.createdAt || nowIso,
    updated_at: nowIso,
  };

  if (!payload.teacher_id) {
    throw new Error("Missing teacher context for assignment status.");
  }

  const { data, error } = await supabase
    .from(ASSIGNMENT_STATUS_TABLE)
    .upsert([payload], { onConflict: "assignment_id,pupil_id" })
    .select("*")
    .single();

  if (error) {
    if (isMissingAssignmentStatusTableError(error)) return normalizeAssignmentStatusRow(payload);
    throw error;
  }

  return normalizeAssignmentStatusRow(data || payload);
}

export async function markAssignmentSessionOpened({
  teacherId = "",
  assignmentId = "",
  classId = "",
  testId = "",
  pupilId = "",
  openedAt = null,
} = {}) {
  const existing = await readAssignmentPupilStatus({ assignmentId, pupilId }).catch((error) => {
    if (isMissingAssignmentStatusTableError(error)) return null;
    throw error;
  });
  if (existing?.completedAt) return existing;

  const openedAtIso = openedAt || new Date().toISOString();
  return await upsertAssignmentPupilStatus({
    teacherId,
    assignmentId,
    classId,
    testId,
    pupilId,
    startedAt: existing?.startedAt || openedAtIso,
    lastOpenedAt: openedAtIso,
    lastActivityAt: openedAtIso,
  });
}

export async function saveAssignmentProgress({
  teacherId = "",
  assignmentId = "",
  classId = "",
  testId = "",
  pupilId = "",
  progress = null,
  savedAt = null,
} = {}) {
  const savedAtIso = savedAt || new Date().toISOString();
  const summary = buildAssignmentProgressSummary(progress);
  return await upsertAssignmentPupilStatus({
    teacherId,
    assignmentId,
    classId,
    testId,
    pupilId,
    startedAt: progress?.startedAt || savedAtIso,
    lastActivityAt: savedAtIso,
    totalWords: summary.totalWords,
    correctWords: summary.correctWords,
    averageAttempts: summary.averageAttempts,
    scoreRate: summary.scoreRate,
    resultJson: summary.resultJson,
  });
}

export async function markAssignmentComplete({
  teacherId = "",
  assignmentId = "",
  classId = "",
  testId = "",
  pupilId = "",
  completedAt = null,
  result = null,
} = {}) {
  const completedAtIso = completedAt || new Date().toISOString();
  const summary = buildAssignmentCompletionSummary(result);
  console.log("COMPLETION/SUMMARY payload:", {
    teacherId: String(teacherId || ""),
    assignmentId: String(assignmentId || ""),
    classId: String(classId || ""),
    testId: String(testId || ""),
    pupilId: String(pupilId || ""),
    completedAt: completedAtIso,
    totalWords: summary.totalWords,
    correctWords: summary.correctWords,
    averageAttempts: summary.averageAttempts,
    scoreRate: summary.scoreRate,
    resultCount: summary.resultJson.length,
  });
  console.log("COMPLETION WRITE payload:", {
    teacherId: String(teacherId || ""),
    assignmentId: String(assignmentId || ""),
    classId: String(classId || ""),
    testId: String(testId || ""),
    pupilId: String(pupilId || ""),
    completedAt: completedAtIso,
  });
  const statusRow = await upsertAssignmentPupilStatus({
    teacherId,
    assignmentId,
    classId,
    testId,
    pupilId,
    startedAt: completedAtIso,
    completedAt: completedAtIso,
    lastOpenedAt: completedAtIso,
    lastActivityAt: completedAtIso,
    totalWords: summary.totalWords,
    correctWords: summary.correctWords,
    averageAttempts: summary.averageAttempts,
    scoreRate: summary.scoreRate,
    resultJson: summary.resultJson,
  });
  console.log("Assignment marked complete:", {
    assignmentId: String(assignmentId || ""),
    pupilId: String(pupilId || ""),
    completedAt: completedAtIso,
  });
  return statusRow;
}

/* ---------------------------
   Classes
---------------------------- */

export async function createClass({
  name,
  year_group = null,
  class_type = CLASS_TYPE_SUBJECT,
} = {}) {
  const context = await getSignedInTeacherContext();
  if (!context?.accessContext?.capabilities?.can_create_classes) {
    throw new Error("Teacher or admin access is required to create classes.");
  }
  const teacherId = context.teacherId;

  const className = (name || "").trim() || "New class";
  const yearGroup = String(year_group || "").trim() || null;
  const classType = normalizeClassType(class_type, {
    legacyFallback: CLASS_TYPE_SUBJECT,
  });

  let lastErr = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const join_code = randomJoinCode(6);
    const payload = {
      teacher_id: teacherId,
      name: className,
      join_code,
      year_group: yearGroup,
      class_type: classType,
    };

    const { data, error } = await supabase
      .from("classes")
      .insert([payload])
      .select("*")
      .single();

    if (!error) return normalizeClassRow(data, { legacyFallback: classType });

    lastErr = error;
    if (isMissingClassTypeColumnError(error)) {
      if (classType !== CLASS_TYPE_SUBJECT) {
        throw new Error("Class type storage is not available yet. Run the latest Supabase migration.");
      }

      const { data: legacyData, error: legacyError } = await supabase
        .from("classes")
        .insert([{
          teacher_id: teacherId,
          name: className,
          join_code,
          year_group: yearGroup,
        }])
        .select("*")
        .single();

      if (!legacyError) {
        return normalizeClassRow(legacyData, { legacyFallback: CLASS_TYPE_SUBJECT });
      }
      lastErr = legacyError;
      if (legacyError.code === "23505") continue;
      throw legacyError;
    }
    if (error.code === "23505") continue;
    throw error;
  }

  throw lastErr || new Error("Failed to create class (unknown error).");
}

export async function listClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || [])
    .map((row) => normalizeClassRow(row, { legacyFallback: CLASS_TYPE_FORM }))
    .filter(Boolean);
}

export async function createInterventionGroup({
  name,
  year_group = null,
  pupil_ids = [],
} = {}) {
  const context = await requireCentralOwnerContext({
    message: "Admin access is required to create intervention groups.",
  });
  const selectedPupilIds = normalizeIdList(pupil_ids);
  if (!selectedPupilIds.length) throw new Error("Choose at least one pupil for the intervention group.");

  let createdClassId = "";
  try {
    const createdClass = await createClass({
      name,
      year_group,
      class_type: CLASS_TYPE_INTERVENTION,
    });
    createdClassId = String(createdClass?.id || "").trim();
    if (!createdClassId) {
      throw new Error("Could not create the intervention group.");
    }

    const { error: membershipError } = await supabase
      .from("pupil_classes")
      .insert(
        selectedPupilIds.map((pupilId) => ({
          pupil_id: pupilId,
          class_id: createdClassId,
          active: true,
        }))
      );

    if (membershipError) {
      if (String(membershipError?.code || "").trim() === "23505") {
        throw new Error("One or more selected pupils are already active in this intervention group.");
      }
      throw membershipError;
    }

    return createdClass;
  } catch (error) {
    if (createdClassId) {
      try {
        await supabase
          .from("classes")
          .delete()
          .eq("id", createdClassId);
      } catch (cleanupError) {
        console.warn("Could not clean up failed intervention group:", cleanupError);
      }
    }
    if (isMissingClassTypeColumnError(error)) {
      throw new Error("Intervention groups are not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }
}

export async function listTeacherPupilDirectoryForInterventionGroups() {
  const context = await requireCentralOwnerContext({
    message: "Admin access is required to view the intervention group directory.",
  });
  let options = arguments[0];
  if (options == null || typeof options !== "object" || Array.isArray(options)) {
    options = {};
  }
  const safeYearGroup = String(options?.year_group || "").trim();
  const safeSourceClassId = String(options?.source_class_id || "").trim();
  const safeSearch = String(options?.search || "").trim();
  const teacherId = context.teacherId;

  if (!safeYearGroup && !safeSourceClassId && !safeSearch) {
    return {
      classes: [],
      pupils: [],
      resultCount: 0,
    };
  }

  const { data: classRows, error: classError } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("name", { ascending: true });
  if (classError) throw classError;

  const classes = (classRows || [])
    .map((row) => normalizeClassRow(row, { legacyFallback: CLASS_TYPE_FORM }))
    .filter(Boolean);
  const sourceClasses = classes.filter((row) => normalizeClassType(row?.class_type, { legacyFallback: CLASS_TYPE_FORM }) !== CLASS_TYPE_INTERVENTION);
  const candidateClasses = sourceClasses.filter((row) => {
    const classId = String(row?.id || "").trim();
    if (!classId) return false;
    if (safeSourceClassId && classId !== safeSourceClassId) return false;
    if (safeYearGroup && String(row?.year_group || "").trim() !== safeYearGroup) return false;
    return true;
  });
  const classIds = candidateClasses.map((row) => String(row?.id || "")).filter(Boolean);
  if (!classIds.length) {
    return {
      classes: [],
      pupils: [],
      resultCount: 0,
    };
  }

  const { data: membershipRows, error: membershipError } = await supabase
    .from("pupil_classes")
    .select("class_id, pupil_id, active")
    .in("class_id", classIds)
    .eq("active", true);
  if (membershipError) throw membershipError;

  const candidatePupilIds = normalizeIdList((membershipRows || []).map((row) => row?.pupil_id));
  if (!candidatePupilIds.length) {
    return {
      classes: candidateClasses,
      pupils: [],
      resultCount: 0,
    };
  }

  const pupils = [];
  const normalizedSearch = safeSearch.replace(/[,%()'"]/g, " ").replace(/\s+/g, " ").trim();
  const searchFilter = normalizedSearch
    ? `first_name.ilike.%${normalizedSearch}%,surname.ilike.%${normalizedSearch}%,username.ilike.%${normalizedSearch}%`
    : "";

  for (let index = 0; index < candidatePupilIds.length; index += 200) {
    const chunk = candidatePupilIds.slice(index, index + 200);
    if (!chunk.length) continue;
    let query = supabase
      .from("pupils")
      .select("id, first_name, surname, username, is_active")
      .in("id", chunk);
    if (searchFilter) {
      query = query.or(searchFilter);
    }
    const { data, error } = await query;
    if (error) throw error;
    pupils.push(...(data || []));
  }

  const classById = new Map(candidateClasses.map((row) => [String(row?.id || ""), row]));
  const membershipsByPupil = new Map();
  for (const row of membershipRows || []) {
    const classId = String(row?.class_id || "").trim();
    const pupilId = String(row?.pupil_id || "").trim();
    if (!classId || !pupilId) continue;
    const sourceClass = classById.get(classId);
    if (!sourceClass) continue;
    const next = membershipsByPupil.get(pupilId) || [];
    next.push({
      class_id: classId,
      class_name: String(sourceClass?.name || "").trim() || "Untitled class",
      class_type: normalizeClassType(sourceClass?.class_type, { legacyFallback: CLASS_TYPE_FORM }),
      year_group: String(sourceClass?.year_group || "").trim() || null,
    });
    membershipsByPupil.set(pupilId, next);
  }

  const directory = (pupils || [])
    .filter((pupil) => pupil?.is_active !== false)
    .map((pupil) => {
      const pupilId = String(pupil?.id || "").trim();
      const memberships = (membershipsByPupil.get(pupilId) || [])
        .filter((item) => !!item?.class_id)
        .sort((a, b) => String(a?.class_name || "").localeCompare(String(b?.class_name || "")));
      const yearGroups = [...new Set(
        memberships
          .map((item) => String(item?.year_group || "").trim())
          .filter(Boolean)
      )];
      const firstName = String(pupil?.first_name || "").trim();
      const surname = String(pupil?.surname || "").trim();
      const displayName = `${firstName} ${surname}`.trim() || String(pupil?.username || "Unknown pupil").trim() || "Unknown pupil";
      return {
        id: pupilId,
        first_name: firstName,
        surname,
        username: String(pupil?.username || "").trim(),
        display_name: displayName,
        year_groups: yearGroups,
        classes: memberships,
      };
    })
    .filter((pupil) => {
      if (!safeSearch) return true;
      const haystack = [
        String(pupil?.display_name || ""),
        String(pupil?.username || ""),
        ...(Array.isArray(pupil?.classes) ? pupil.classes.map((item) => String(item?.class_name || "")) : []),
      ].join(" ").toLowerCase();
      return haystack.includes(safeSearch.toLowerCase());
    })
    .sort((a, b) => String(a?.display_name || "").localeCompare(String(b?.display_name || "")));

  return {
    classes: candidateClasses,
    pupils: directory,
    resultCount: directory.length,
  };
}

export async function readStaffAccessContext() {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const signedInUser = userRes?.user || null;
  const teacherId = requireUserId(signedInUser);
  return readStaffAccessContextForTeacherId(teacherId, {
    user: signedInUser,
  });
}

export async function readTeacherAppRole() {
  const accessContext = await readStaffAccessContext();
  return deriveTeacherAppRoleFromAccessContext(accessContext);
}

export function consumeLatestStaffProfileSyncNotice() {
  const nextNotice = latestStaffProfileSyncNotice;
  latestStaffProfileSyncNotice = null;
  return nextNotice;
}

export async function listStaffProfiles() {
  const { data, error } = await supabase
    .from(STAFF_PROFILES_TABLE)
    .select("id, user_id, email, display_name, external_staff_id, notes, profile_source, import_metadata, last_import_batch_id, last_imported_at, last_imported_by, created_at, updated_at")
    .order("display_name", { ascending: true })
    .order("email", { ascending: true });

  if (error) {
    if (isMissingStaffProfilesSupportError(error)) {
      throw new Error("Staff access directory is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return (data || [])
    .map((row) => normalizeStaffProfileRow(row))
    .filter((row) => row.id);
}

export async function listActiveStaffRoleAssignments() {
  const { data, error } = await supabase
    .from("staff_role_assignments")
    .select("id, user_id, role, active, granted_by, created_at, updated_at")
    .eq("active", true)
    .order("user_id", { ascending: true })
    .order("role", { ascending: true });

  if (error) {
    if (isMissingStaffAccessFoundationError(error)) {
      throw new Error("Staff role data is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return (data || [])
    .map((row) => normalizeStaffRoleAssignmentRow(row))
    .filter((row) => row.user_id);
}

export async function listStaffRoleAssignments(targetUserId = "") {
  const safeTargetUserId = String(targetUserId || "").trim();
  if (!safeTargetUserId) return [];

  const { data, error } = await supabase
    .from("staff_role_assignments")
    .select("id, user_id, role, active, granted_by, created_at, updated_at")
    .eq("user_id", safeTargetUserId)
    .eq("active", true)
    .order("role", { ascending: true });

  if (error) {
    if (isMissingStaffAccessFoundationError(error)) {
      throw new Error("Staff role data is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return (data || [])
    .map((row) => normalizeStaffRoleAssignmentRow(row))
    .filter((row) => row.user_id);
}

export async function listStaffScopeAssignments(targetUserId = "") {
  const safeTargetUserId = String(targetUserId || "").trim();
  if (!safeTargetUserId) return [];

  const { data, error } = await supabase
    .from("staff_scope_assignments")
    .select("id, user_id, role, scope_type, scope_value, active, granted_by, created_at, updated_at")
    .eq("user_id", safeTargetUserId)
    .eq("active", true)
    .order("role", { ascending: true })
    .order("scope_type", { ascending: true })
    .order("scope_value", { ascending: true });

  if (error) {
    if (isMissingStaffAccessFoundationError(error)) {
      throw new Error("Staff scope data is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return (data || [])
    .map((row) => normalizeStaffScopeAssignmentRow(row))
    .filter((row) => row.user_id);
}

export async function listStaffAccessAuditEntries(targetUserId = "", { limit = 10 } = {}) {
  const safeTargetUserId = String(targetUserId || "").trim();
  if (!safeTargetUserId) return [];

  const safeLimit = Math.max(1, Math.min(25, Number(limit) || 10));
  const { data, error } = await supabase
    .from("staff_access_audit_log")
    .select("id, actor_user_id, target_user_id, action, role, scope_type, scope_value, metadata, created_at")
    .eq("target_user_id", safeTargetUserId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    if (isMissingStaffAccessFoundationError(error)) {
      throw new Error("Staff access audit history is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return (data || [])
    .map((row) => normalizeStaffAccessAuditRow(row))
    .filter((row) => row.target_user_id);
}

export async function listActiveAdminUserIds() {
  const { data, error } = await supabase
    .from("staff_role_assignments")
    .select("user_id")
    .eq("role", "admin")
    .eq("active", true);

  if (error) {
    if (isMissingStaffAccessFoundationError(error)) {
      throw new Error("Staff admin assignments are not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return normalizeIdList((data || []).map((row) => row?.user_id));
}

export async function readStaffPendingAccessDuplicatePreflight() {
  const { data, error } = await supabase.rpc(STAFF_PENDING_ACCESS_PREFLIGHT_FUNCTION);
  if (error) {
    if (isMissingStaffPendingAccessSupportError(error)) {
      return normalizeStaffPendingAccessDuplicatePreflight({});
    }
    throw error;
  }
  return normalizeStaffPendingAccessDuplicatePreflight(data || {});
}

export async function listStaffPendingAccessSummaries() {
  const { data, error } = await supabase.rpc(STAFF_PENDING_ACCESS_SUMMARIES_FUNCTION);
  if (error) {
    if (isMissingStaffPendingAccessSupportError(error)) return [];
    throw error;
  }
  return (Array.isArray(data) ? data : [])
    .map((row) => normalizeStaffPendingApprovalRow(row))
    .filter((row) => row.staff_profile_id);
}

export async function readStaffPendingAccessDetail(profileId = "") {
  const safeProfileId = String(profileId || "").trim();
  if (!safeProfileId) {
    return normalizeStaffPendingAccessDetail({});
  }

  const { data, error } = await supabase.rpc(STAFF_PENDING_ACCESS_DETAIL_FUNCTION, {
    target_profile_id: safeProfileId,
  });
  if (error) {
    if (isMissingStaffPendingAccessSupportError(error)) {
      return normalizeStaffPendingAccessDetail({
        staff_profile_id: safeProfileId,
      });
    }
    throw error;
  }
  return normalizeStaffPendingAccessDetail(data || {
    staff_profile_id: safeProfileId,
  });
}

export async function saveStaffPendingAccessApproval(profileId = "", {
  roles = [],
  scopes = [],
} = {}) {
  const safeProfileId = String(profileId || "").trim();
  if (!safeProfileId) throw new Error("Choose a pending staff record first.");

  const { data, error } = await supabase.rpc(STAFF_PENDING_ACCESS_SAVE_FUNCTION, {
    target_profile_id: safeProfileId,
    requested_roles: Array.isArray(roles) ? roles : [],
    requested_scopes: Array.isArray(scopes) ? scopes : [],
  });
  if (error) {
    if (isMissingStaffPendingAccessSupportError(error)) {
      throw new Error("Pending staff approvals are not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }
  return normalizeStaffPendingAccessDetail(data || {
    staff_profile_id: safeProfileId,
  });
}

export async function cancelStaffPendingAccessApproval(profileId = "") {
  const safeProfileId = String(profileId || "").trim();
  if (!safeProfileId) throw new Error("Choose a pending staff record first.");

  const { data, error } = await supabase.rpc(STAFF_PENDING_ACCESS_CANCEL_FUNCTION, {
    target_profile_id: safeProfileId,
  });
  if (error) {
    if (isMissingStaffPendingAccessSupportError(error)) {
      throw new Error("Pending staff approvals are not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }
  return normalizeStaffPendingAccessDetail(data || {
    staff_profile_id: safeProfileId,
  });
}

export async function grantStaffRole(targetUserId = "", role = "") {
  const safeTargetUserId = String(targetUserId || "").trim();
  const safeRole = String(role || "").trim().toLowerCase();
  if (!safeTargetUserId) throw new Error("Choose a staff member first.");
  if (!safeRole) throw new Error("Choose a role first.");

  const { data, error } = await supabase.rpc("grant_staff_role", {
    target_user_id: safeTargetUserId,
    requested_role: safeRole,
  });
  if (error) {
    if (isMissingStaffAccessFoundationError(error)) {
      throw new Error("Staff role changes are not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }
  return data || null;
}

export async function revokeStaffRole(targetUserId = "", role = "") {
  const safeTargetUserId = String(targetUserId || "").trim();
  const safeRole = String(role || "").trim().toLowerCase();
  if (!safeTargetUserId) throw new Error("Choose a staff member first.");
  if (!safeRole) throw new Error("Choose a role first.");

  const { data, error } = await supabase.rpc("revoke_staff_role", {
    target_user_id: safeTargetUserId,
    requested_role: safeRole,
  });
  if (error) {
    if (isMissingStaffAccessFoundationError(error)) {
      throw new Error("Staff role changes are not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }
  return data || null;
}

export async function grantStaffScope(targetUserId = "", role = "", scopeType = "", scopeValue = "") {
  const safeTargetUserId = String(targetUserId || "").trim();
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  const safeScopeValue = String(scopeValue || "").trim();
  if (!safeTargetUserId) throw new Error("Choose a staff member first.");
  if (!safeRole) throw new Error("Choose a role first.");
  if (!safeScopeType || !safeScopeValue) throw new Error("Choose a scope before adding it.");

  const { data, error } = await supabase.rpc("grant_staff_scope", {
    target_user_id: safeTargetUserId,
    requested_role: safeRole,
    requested_scope_type: safeScopeType,
    requested_scope_value: safeScopeValue,
  });
  if (error) {
    if (isMissingStaffAccessFoundationError(error)) {
      throw new Error("Staff scope changes are not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }
  return data || null;
}

export async function revokeStaffScope(targetUserId = "", role = "", scopeType = "", scopeValue = "") {
  const safeTargetUserId = String(targetUserId || "").trim();
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  const safeScopeValue = String(scopeValue || "").trim();
  if (!safeTargetUserId) throw new Error("Choose a staff member first.");
  if (!safeRole) throw new Error("Choose a role first.");
  if (!safeScopeType || !safeScopeValue) throw new Error("Choose a scope before removing it.");

  const { data, error } = await supabase.rpc("revoke_staff_scope", {
    target_user_id: safeTargetUserId,
    requested_role: safeRole,
    requested_scope_type: safeScopeType,
    requested_scope_value: safeScopeValue,
  });
  if (error) {
    if (isMissingStaffAccessFoundationError(error)) {
      throw new Error("Staff scope changes are not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }
  return data || null;
}

export async function importStaffDirectoryCsv({
  rows = [],
  fileName = "",
  previewSummary = {},
} = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) {
    throw new Error("Choose at least one valid CSV row before importing staff.");
  }

  const { data, error } = await supabase.rpc(STAFF_IMPORT_FUNCTION, {
    import_rows: safeRows,
    import_file_name: String(fileName || "").trim() || null,
    preview_summary: previewSummary && typeof previewSummary === "object" ? previewSummary : {},
  });

  if (error) {
    if (isMissingStaffImportSupportError(error) || isMissingStaffProfilesSupportError(error)) {
      throw new Error("CSV staff import is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return data || null;
}

function sortPersonalisedAutomationPolicies(rows = []) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const rankByState = {
      expiring_soon: 0,
      live: 1,
      scheduled: 2,
      expired: 3,
      archived: 4,
    };
    const aLifecycle = getPersonalisedAutomationPolicyLifecycle(a);
    const bLifecycle = getPersonalisedAutomationPolicyLifecycle(b);
    const aRank = rankByState[aLifecycle.state] ?? 99;
    const bRank = rankByState[bLifecycle.state] ?? 99;
    if (aRank !== bRank) return aRank - bRank;
    const aUpdated = new Date(a?.updated_at || a?.created_at || 0).getTime();
    const bUpdated = new Date(b?.updated_at || b?.created_at || 0).getTime();
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

async function readPersonalisedAutomationPoliciesInternal({
  teacherId = "",
  includeArchived = true,
} = {}) {
  const safeTeacherId = String(teacherId || "").trim();
  if (!safeTeacherId) return [];

  let query = supabase
    .from(PERSONALISED_AUTOMATION_POLICY_TABLE)
    .select("*")
    .eq("teacher_id", safeTeacherId)
    .order("updated_at", { ascending: false });

  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    if (
      isMissingPersonalisedAutomationPolicyTableError(error)
      || isMissingPersonalisedAutomationPolicyColumnError(error)
    ) {
      return [];
    }
    throw error;
  }

  const policyRows = Array.isArray(data) ? data : [];
  const policyIds = normalizeIdList(policyRows.map((row) => row?.id));
  if (!policyIds.length) return [];

  const { data: targetRows, error: targetError } = await supabase
    .from(PERSONALISED_AUTOMATION_POLICY_TARGET_TABLE)
    .select("policy_id, class_id")
    .eq("teacher_id", safeTeacherId)
    .in("policy_id", policyIds);

  if (targetError) {
    if (isMissingPersonalisedAutomationPolicyTargetTableError(targetError)) {
      return sortPersonalisedAutomationPolicies(
        policyRows.map((row) => normalizePersonalisedAutomationPolicyRow(row)).filter(Boolean)
      );
    }
    throw targetError;
  }

  const targetRowsByPolicyId = new Map();
  for (const row of targetRows || []) {
    const policyId = String(row?.policy_id || "").trim();
    if (!policyId) continue;
    const next = targetRowsByPolicyId.get(policyId) || [];
    next.push(row);
    targetRowsByPolicyId.set(policyId, next);
  }

  return sortPersonalisedAutomationPolicies(
    policyRows
      .map((row) => normalizePersonalisedAutomationPolicyRow({
        ...row,
        targets: targetRowsByPolicyId.get(String(row?.id || "").trim()) || [],
      }))
      .filter(Boolean)
  );
}

export async function listPersonalisedAutomationPolicies({ includeArchived = true } = {}) {
  const context = await getSignedInTeacherContext();
  if (!context?.accessContext?.capabilities?.can_manage_automation) return [];
  return readPersonalisedAutomationPoliciesInternal({
    teacherId: context.teacherId,
    includeArchived,
  });
}

export async function readPersonalisedAutomationPolicy(policyId = "") {
  const safePolicyId = String(policyId || "").trim();
  const rows = await listPersonalisedAutomationPolicies({ includeArchived: true });
  if (!safePolicyId) return rows[0] || null;
  return rows.find((row) => String(row?.id || "").trim() === safePolicyId) || null;
}

export async function upsertPersonalisedAutomationPolicy({
  id = "",
  name = "",
  description = "",
  active = false,
  assignment_length,
  support_preset,
  allow_starter_fallback,
  frequency,
  selected_weekdays = [],
  selected_weekdays_week_1 = [],
  selected_weekdays_week_2 = [],
  start_date = "",
  end_date = "",
  target_class_ids = [],
  archived_at = null,
  archived_by = "",
  duplicate_source_policy_id = "",
} = {}) {
  const context = await requireCentralOwnerContext({
    message: "Central-owner access is required to save the automation policy.",
  });
  const normalizedPolicy = normalizePersonalisedAutomationPolicy({
    id,
    name,
    description,
    active,
    assignment_length,
    support_preset,
    allow_starter_fallback,
    frequency,
    selected_weekdays,
    selected_weekdays_week_1,
    selected_weekdays_week_2,
    start_date,
    end_date,
    target_class_ids,
    archived_at,
    archived_by,
  });
  const validatedClassIds = await validateAutomationEligibleClassIds(context.teacherId, normalizedPolicy.target_class_ids);
  const safePolicyId = String(normalizedPolicy.id || "").trim();
  const safeDuplicateSourcePolicyId = String(duplicate_source_policy_id || "").trim();
  const legacyActive = getLegacyPersonalisedAutomationPolicyActiveValue(normalizedPolicy);

  if (!String(normalizedPolicy.name || "").trim()) {
    throw new Error("Give this automation policy a name before saving.");
  }
  if (!normalizedPolicy.selected_weekdays.length) {
    throw new Error("Choose at least one weekday for the automation policy.");
  }
  if (
    normalizedPolicy.frequency === "fortnightly"
    && !normalizedPolicy.selected_weekdays_week_1.length
    && !normalizedPolicy.selected_weekdays_week_2.length
  ) {
    throw new Error("Choose at least one release day in week 1 or week 2.");
  }
  if (!normalizedPolicy.start_date) {
    throw new Error("Choose a start date for the automation policy.");
  }
  if (normalizedPolicy.end_date && normalizedPolicy.end_date < normalizedPolicy.start_date) {
    throw new Error("The automation policy end date must be on or after the start date.");
  }

  const nowIso = new Date().toISOString();
  const basePayload = {
    teacher_id: context.teacherId,
    name: normalizedPolicy.name,
    description: normalizedPolicy.description || null,
    active: legacyActive,
    assignment_length: normalizedPolicy.assignment_length,
    support_preset: normalizedPolicy.support_preset,
    allow_starter_fallback: normalizedPolicy.allow_starter_fallback,
    frequency: normalizedPolicy.frequency,
    selected_weekdays: normalizedPolicy.selected_weekdays,
    selected_weekdays_week_1: normalizedPolicy.selected_weekdays_week_1,
    selected_weekdays_week_2: normalizedPolicy.selected_weekdays_week_2,
    start_date: normalizedPolicy.start_date,
    end_date: normalizedPolicy.end_date || null,
    archived_at: normalizedPolicy.archived_at || null,
    archived_by: normalizedPolicy.archived_at ? (normalizedPolicy.archived_by || context.teacherId) : null,
    updated_by: context.teacherId,
    updated_at: nowIso,
  };

  let data = null;
  let error = null;
  if (safePolicyId) {
    const result = await supabase
      .from(PERSONALISED_AUTOMATION_POLICY_TABLE)
      .update(basePayload)
      .eq("id", safePolicyId)
      .eq("teacher_id", context.teacherId)
      .select("id, teacher_id, name, description, active, assignment_length, support_preset, allow_starter_fallback, frequency, selected_weekdays, selected_weekdays_week_1, selected_weekdays_week_2, start_date, end_date, archived_at, archived_by, created_by, updated_by, created_at, updated_at")
      .single();
    data = result.data;
    error = result.error;
  } else {
    const result = await supabase
      .from(PERSONALISED_AUTOMATION_POLICY_TABLE)
      .insert([{
        ...basePayload,
        created_by: context.teacherId,
      }])
      .select("id, teacher_id, name, description, active, assignment_length, support_preset, allow_starter_fallback, frequency, selected_weekdays, selected_weekdays_week_1, selected_weekdays_week_2, start_date, end_date, archived_at, archived_by, created_by, updated_by, created_at, updated_at")
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) {
    if (
      isMissingPersonalisedAutomationPolicyTableError(error)
      || isMissingPersonalisedAutomationPolicyColumnError(error)
    ) {
      throw new Error("Automation policy storage is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  const policyId = String(data?.id || "").trim();
  if (!policyId) {
    throw new Error("Could not save the automation policy.");
  }

  const { data: existingTargetRows, error: existingTargetError } = await supabase
    .from(PERSONALISED_AUTOMATION_POLICY_TARGET_TABLE)
    .select("class_id")
    .eq("teacher_id", context.teacherId)
    .eq("policy_id", policyId);

  if (existingTargetError) {
    if (isMissingPersonalisedAutomationPolicyTargetTableError(existingTargetError)) {
      throw new Error("Automation policy target storage is not available yet. Run the latest Supabase migration.");
    }
    throw existingTargetError;
  }

  if (validatedClassIds.length) {
    const targetPayload = validatedClassIds.map((classId) => ({
      policy_id: policyId,
      teacher_id: context.teacherId,
      class_id: classId,
      updated_at: nowIso,
    }));

    const { error: targetError } = await supabase
      .from(PERSONALISED_AUTOMATION_POLICY_TARGET_TABLE)
      .upsert(targetPayload, { onConflict: "policy_id,class_id" });

    if (targetError) {
      if (isMissingPersonalisedAutomationPolicyTargetTableError(targetError)) {
        throw new Error("Automation policy target storage is not available yet. Run the latest Supabase migration.");
      }
      throw targetError;
    }
  }

  const existingIds = normalizeIdList((existingTargetRows || []).map((row) => row?.class_id));
  const idsToDelete = existingIds.filter((classId) => !validatedClassIds.includes(classId));
  if (idsToDelete.length) {
    const { error: deleteError } = await supabase
      .from(PERSONALISED_AUTOMATION_POLICY_TARGET_TABLE)
      .delete()
      .eq("teacher_id", context.teacherId)
      .eq("policy_id", policyId)
      .in("class_id", idsToDelete);

    if (deleteError && !isMissingPersonalisedAutomationPolicyTargetTableError(deleteError)) {
      throw deleteError;
    }
  }

  const savedPolicy = await readPersonalisedAutomationPolicy(policyId);
  try {
    await recordPersonalisedAutomationPolicyEvent({
      teacherId: context.teacherId,
      policyId,
      eventType: safePolicyId
        ? "updated"
        : (safeDuplicateSourcePolicyId ? "duplicated" : "created"),
      metadata: {
        name: normalizedPolicy.name,
        active: legacyActive,
        archived_at: normalizedPolicy.archived_at || null,
        target_class_ids: validatedClassIds,
        duplicate_source_policy_id: safeDuplicateSourcePolicyId || null,
      },
    });
  } catch (eventError) {
    console.warn("Could not record automation policy save event:", eventError);
  }

  return savedPolicy;
}

export async function setPersonalisedAutomationPolicyArchived({
  policyId = "",
  archived = true,
} = {}) {
  const safePolicyId = String(policyId || "").trim();
  if (!safePolicyId) throw new Error("Choose an automation policy first.");

  const context = await requireCentralOwnerContext({
    message: "Central-owner access is required to update the automation policy.",
  });
  const sourcePolicy = await readPersonalisedAutomationPolicy(safePolicyId);
  if (!sourcePolicy) {
    throw new Error("Could not update the automation policy.");
  }
  const nowIso = new Date().toISOString();
  const restoredPolicy = normalizePersonalisedAutomationPolicy({
    ...sourcePolicy,
    archived_at: null,
    archived_by: "",
  });
  const payload = {
    active: archived ? false : getLegacyPersonalisedAutomationPolicyActiveValue(restoredPolicy),
    archived_at: archived ? nowIso : null,
    archived_by: archived ? context.teacherId : null,
    updated_by: context.teacherId,
    updated_at: nowIso,
  };

  const { error } = await supabase
    .from(PERSONALISED_AUTOMATION_POLICY_TABLE)
    .update(payload)
    .eq("id", safePolicyId)
    .eq("teacher_id", context.teacherId);

  if (error) {
    if (
      isMissingPersonalisedAutomationPolicyTableError(error)
      || isMissingPersonalisedAutomationPolicyColumnError(error)
    ) {
      throw new Error("Automation policy storage is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  const savedPolicy = await readPersonalisedAutomationPolicy(safePolicyId);
  if (!savedPolicy) {
    throw new Error("Could not update the automation policy.");
  }
  try {
    await recordPersonalisedAutomationPolicyEvent({
      teacherId: context.teacherId,
      policyId: safePolicyId,
      eventType: archived ? "archived" : "restored",
      metadata: {
        archived,
      },
    });
  } catch (eventError) {
    console.warn("Could not record automation policy archive event:", eventError);
  }
  return savedPolicy;
}

export async function deletePersonalisedAutomationPolicy(policyId = "") {
  const safePolicyId = String(policyId || "").trim();
  if (!safePolicyId) throw new Error("Choose an automation policy first.");

  const context = await requireCentralOwnerContext({
    message: "Central-owner access is required to delete the automation policy.",
  });
  const existingPolicy = await readPersonalisedAutomationPolicy(safePolicyId);
  if (!existingPolicy) {
    throw new Error("Choose a saved automation policy first.");
  }

  const { error } = await supabase
    .from(PERSONALISED_AUTOMATION_POLICY_TABLE)
    .delete()
    .eq("id", safePolicyId)
    .eq("teacher_id", context.teacherId);

  if (error) {
    if (
      isMissingPersonalisedAutomationPolicyTableError(error)
      || isMissingPersonalisedAutomationPolicyColumnError(error)
    ) {
      throw new Error("Automation policy storage is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return existingPolicy;
}

export async function listClassAutoAssignPolicies() {
  const { data, error } = await supabase
    .from(CLASS_AUTO_ASSIGN_POLICY_TABLE)
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingClassAutoAssignPolicyTableError(error)) return [];
    throw error;
  }

  return (data || [])
    .map((row) => normalizeClassAutoAssignPolicyRow(row))
    .filter(Boolean);
}

export async function getClassAutoAssignPolicy(classId) {
  const safeClassId = String(classId || "").trim();
  if (!safeClassId) return null;

  const { data, error } = await supabase
    .from(CLASS_AUTO_ASSIGN_POLICY_TABLE)
    .select("*")
    .eq("class_id", safeClassId)
    .maybeSingle();

  if (error) {
    if (isMissingClassAutoAssignPolicyTableError(error)) return null;
    throw error;
  }

  return normalizeClassAutoAssignPolicyRow(data);
}

export async function upsertClassAutoAssignPolicy({
  class_id = "",
  assignment_length,
  support_preset,
  allow_starter_fallback,
} = {}) {
  const safeClassId = String(class_id || "").trim();
  if (!safeClassId) throw new Error("Choose a class before saving an auto-assign policy.");

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const teacherId = requireUserId(userRes?.user);
  const normalizedPolicy = normalizeAutoAssignPolicy({
    assignment_length,
    support_preset,
    allow_starter_fallback,
  });
  const nowIso = new Date().toISOString();
  const payload = {
    teacher_id: teacherId,
    class_id: safeClassId,
    assignment_length: normalizedPolicy.assignment_length,
    support_preset: normalizedPolicy.support_preset,
    allow_starter_fallback: normalizedPolicy.allow_starter_fallback,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from(CLASS_AUTO_ASSIGN_POLICY_TABLE)
    .upsert([payload], { onConflict: "class_id" })
    .select("*")
    .single();

  if (error) {
    if (isMissingClassAutoAssignPolicyTableError(error)) {
      throw new Error("Auto-assign policy storage is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return normalizeClassAutoAssignPolicyRow(data || payload);
}

export async function deleteClassAutoAssignPolicy(classId) {
  const safeClassId = String(classId || "").trim();
  if (!safeClassId) return;

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const teacherId = requireUserId(userRes?.user);

  const { error } = await supabase
    .from(CLASS_AUTO_ASSIGN_POLICY_TABLE)
    .delete()
    .eq("teacher_id", teacherId)
    .eq("class_id", safeClassId);

  if (error) {
    if (isMissingClassAutoAssignPolicyTableError(error)) {
      throw new Error("Auto-assign policy storage is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }
}

export async function createPersonalisedGenerationRun({
  selectedClassIds = [],
  automationPolicyId = "",
  policySnapshot = null,
  derivedDeadlineAt = null,
  assignment_length,
  support_preset,
  allow_starter_fallback,
} = {}) {
  const context = await requireCentralOwnerContext({
    message: "Central-owner access is required to run personalised automation.",
  });
  const validatedClassIds = await validateAutomationEligibleClassIds(context.teacherId, selectedClassIds);
  const normalizedPolicy = normalizeAutoAssignPolicy({
    assignment_length,
    support_preset,
    allow_starter_fallback,
  });
  const safePolicyId = String(automationPolicyId || "").trim();
  let resolvedPolicyId = null;

  if (safePolicyId) {
    const { data: policyRow, error: policyError } = await supabase
      .from(PERSONALISED_AUTOMATION_POLICY_TABLE)
      .select("id, archived_at, start_date, end_date")
      .eq("id", safePolicyId)
      .eq("teacher_id", context.teacherId)
      .maybeSingle();
    if (policyError) {
      if (isMissingPersonalisedAutomationPolicyTableError(policyError)) {
        throw new Error("Automation policy storage is not available yet. Run the latest Supabase migration.");
      }
      throw policyError;
    }
    if (!policyRow?.id) {
      throw new Error("Save an automation policy before running personalised generation.");
    }
    const lifecycle = getPersonalisedAutomationPolicyLifecycle(policyRow);
    if (String(policyRow?.archived_at || "").trim()) {
      throw new Error("Restore this automation policy before you run it.");
    }
    if (lifecycle.expired) {
      throw new Error("This automation policy has expired. Extend its dates or archive it before you run it.");
    }
    if (!isPersonalisedAutomationPolicyUsable(policyRow)) {
      throw new Error(`This automation policy is scheduled to start on ${String(policyRow?.start_date || "").trim() || "its start date"}.`);
    }
    resolvedPolicyId = String(policyRow.id);
  }
  const nowIso = new Date().toISOString();
  const payload = {
    teacher_id: context.teacherId,
    trigger_role: "central_owner",
    run_source: ASSIGNMENT_AUTOMATION_SOURCE_MANUAL_RUN_NOW,
    selected_class_ids: validatedClassIds,
    automation_policy_id: resolvedPolicyId,
    assignment_length: normalizedPolicy.assignment_length,
    support_preset: normalizedPolicy.support_preset,
    allow_starter_fallback: normalizedPolicy.allow_starter_fallback,
    policy_snapshot: policySnapshot && typeof policySnapshot === "object" ? policySnapshot : {},
    derived_deadline_at: derivedDeadlineAt || null,
    status: "running",
    class_count: 0,
    included_pupil_count: 0,
    skipped_pupil_count: 0,
    summary: {},
    started_at: nowIso,
    finished_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from(PERSONALISED_GENERATION_RUN_TABLE)
    .insert([payload])
    .select("*")
    .single();

  if (error) {
    if (isMissingPersonalisedGenerationRunTableError(error) || isMissingPersonalisedGenerationRunColumnError(error)) {
      throw new Error("Personalised automation run storage is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  if (resolvedPolicyId) {
    try {
      await recordPersonalisedAutomationPolicyEvent({
        teacherId: context.teacherId,
        policyId: resolvedPolicyId,
        eventType: "run_started",
        metadata: {
          run_id: String(data?.id || "").trim() || null,
          selected_class_ids: validatedClassIds,
          derived_deadline_at: derivedDeadlineAt || null,
        },
      });
    } catch (eventError) {
      console.warn("Could not record automation policy run event:", eventError);
    }
  }

  return normalizePersonalisedGenerationRunRow(data || payload);
}

export async function updatePersonalisedGenerationRun({
  runId = "",
  status = "completed",
  classCount = 0,
  includedPupilCount = 0,
  skippedPupilCount = 0,
  summary = {},
  finishedAt = null,
} = {}) {
  const safeRunId = String(runId || "").trim();
  if (!safeRunId) return null;

  const context = await requireCentralOwnerContext({
    message: "Central-owner access is required to update personalised automation runs.",
  });

  const payload = {
    status: String(status || "completed").trim().toLowerCase() === "failed" ? "failed" : "completed",
    class_count: Math.max(0, Number(classCount || 0)),
    included_pupil_count: Math.max(0, Number(includedPupilCount || 0)),
    skipped_pupil_count: Math.max(0, Number(skippedPupilCount || 0)),
    summary: summary && typeof summary === "object" ? summary : {},
    finished_at: finishedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(PERSONALISED_GENERATION_RUN_TABLE)
    .update(payload)
    .eq("id", safeRunId)
    .eq("teacher_id", context.teacherId)
    .select("*")
    .single();

  if (error) {
    if (isMissingPersonalisedGenerationRunTableError(error)) {
      throw new Error("Personalised automation run storage is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return normalizePersonalisedGenerationRunRow(data || { id: safeRunId, teacher_id: context.teacherId, ...payload });
}

export async function upsertPersonalisedGenerationRunPupilRows(rows = []) {
  const normalizedRows = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const runId = String(row?.run_id || row?.runId || "").trim();
      const classId = String(row?.class_id || row?.classId || "").trim();
      const pupilId = String(row?.pupil_id || row?.pupilId || "").trim();
      if (!runId || !classId || !pupilId) return null;
      const status = String(row?.status || "").trim().toLowerCase() === "included" ? "included" : "skipped";
      const skipReason = status === "skipped"
        ? String(row?.skip_reason || row?.skipReason || "").trim().toLowerCase() || null
        : null;
      return {
        run_id: runId,
        class_id: classId,
        pupil_id: pupilId,
        assignment_id: String(row?.assignment_id || row?.assignmentId || "").trim() || null,
        status,
        skip_reason: skipReason,
      };
    })
    .filter(Boolean);
  if (!normalizedRows.length) return [];

  const context = await requireCentralOwnerContext({
    message: "Central-owner access is required to update personalised automation audit rows.",
  });
  const nowIso = new Date().toISOString();

  const payload = normalizedRows.map((row) => ({
    teacher_id: context.teacherId,
    run_id: row.run_id,
    class_id: row.class_id,
    pupil_id: row.pupil_id,
    assignment_id: row.assignment_id,
    status: row.status,
    skip_reason: row.skip_reason,
    created_at: nowIso,
    updated_at: nowIso,
  }));

  const { data, error } = await supabase
    .from(PERSONALISED_GENERATION_RUN_PUPIL_TABLE)
    .upsert(payload, { onConflict: "run_id,class_id,pupil_id" })
    .select("id, run_id, class_id, pupil_id, assignment_id, status, skip_reason, created_at, updated_at");

  if (error) {
    if (isMissingPersonalisedGenerationRunPupilTableError(error)) {
      throw new Error("Personalised automation audit storage is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return Array.isArray(data) ? data : payload;
}

export async function seedAutomatedAssignmentPupilStatuses({
  assignmentId = "",
  classId = "",
  testId = "",
  pupilWordCountsByPupil = {},
} = {}) {
  const safeAssignmentId = String(assignmentId || "").trim();
  const safeClassId = String(classId || "").trim();
  const safeTestId = String(testId || "").trim();
  const entries = Object.entries(pupilWordCountsByPupil || {})
    .map(([pupilId, totalWords]) => ({
      pupilId: String(pupilId || "").trim(),
      totalWords: Math.max(0, Number(totalWords || 0)),
    }))
    .filter((entry) => entry.pupilId);
  if (!safeAssignmentId || !entries.length) return [];

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const teacherId = requireUserId(userRes?.user);
  const nowIso = new Date().toISOString();

  const payload = entries.map((entry) => ({
    teacher_id: teacherId,
    assignment_id: safeAssignmentId,
    class_id: safeClassId || null,
    test_id: safeTestId || null,
    pupil_id: entry.pupilId,
    status: "assigned",
    started_at: null,
    completed_at: null,
    last_opened_at: null,
    last_activity_at: null,
    total_words: entry.totalWords,
    correct_words: 0,
    average_attempts: 0,
    score_rate: 0,
    result_json: [],
    created_at: nowIso,
    updated_at: nowIso,
  }));

  const { data, error } = await supabase
    .from(ASSIGNMENT_STATUS_TABLE)
    .upsert(payload, { onConflict: "assignment_id,pupil_id" })
    .select("*");

  if (error) {
    if (isMissingAssignmentStatusTableError(error)) {
      throw new Error("Assignment status storage is not available yet. Run the latest Supabase migration.");
    }
    throw error;
  }

  return (data || []).map(normalizeAssignmentStatusRow);
}

function parseDateMs(value) {
  const ms = new Date(value || "").getTime();
  return Number.isFinite(ms) ? ms : null;
}

function hasStartedAssignmentStatus(row) {
  if (!row || row.completedAt || row.completed_at) return false;
  if (row.startedAt || row.started_at || row.lastOpenedAt || row.last_opened_at || row.lastActivityAt || row.last_activity_at) {
    return true;
  }
  if (String(row?.status || "").trim().toLowerCase() === "started") return true;
  const results = row?.resultJson ?? row?.result_json;
  return Array.isArray(results) && results.length > 0;
}

function compareBaselineGateAssignments(a, b) {
  const aDeadline = parseDateMs(a?.end_at);
  const bDeadline = parseDateMs(b?.end_at);
  if (aDeadline != null && bDeadline != null && aDeadline !== bDeadline) return aDeadline - bDeadline;
  if (aDeadline != null && bDeadline == null) return -1;
  if (aDeadline == null && bDeadline != null) return 1;

  const aCreated = parseDateMs(a?.created_at) ?? 0;
  const bCreated = parseDateMs(b?.created_at) ?? 0;
  return bCreated - aCreated;
}

export async function readPupilBaselineGateState({
  pupilId = "",
  requiredStandardKey = REQUIRED_BASELINE_STANDARD_KEY,
} = {}) {
  const safePupilId = String(pupilId || "").trim();
  const safeRequiredKey = String(requiredStandardKey || REQUIRED_BASELINE_STANDARD_KEY).trim().toLowerCase();

  if (!safePupilId) {
    return {
      status: "waiting",
      assignmentId: "",
      requiredStandardKey: safeRequiredKey,
    };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("pupil_classes")
    .select("class_id")
    .eq("pupil_id", safePupilId)
    .eq("active", true);
  if (membershipError) throw membershipError;

  const classIds = [...new Set(
    (memberships || [])
      .map((row) => String(row?.class_id || "").trim())
      .filter(Boolean)
  )];
  if (!classIds.length) {
    return {
      status: "waiting",
      assignmentId: "",
      requiredStandardKey: safeRequiredKey,
    };
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("assignments_v2")
    .select(`
      id,
      class_id,
      end_at,
      created_at,
      tests (
        id,
        test_words (
          id,
          position,
          word,
          sentence,
          segments,
          choice
        )
      )
    `)
    .in("class_id", classIds)
    .order("end_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (assignmentError) throw assignmentError;

  const requiredBaselineAssignments = (assignmentRows || [])
    .map((assignment) => {
      const wordRows = Array.isArray(assignment?.tests?.test_words)
        ? [...assignment.tests.test_words]
          .filter((row) => String(row?.word || "").trim())
          .sort((a, b) => Number(a?.position || 0) - Number(b?.position || 0))
        : [];
      if (!isBaselineAssignmentWordRows(wordRows)) return null;
      const standardKey = resolveBaselineStandardKeyFromWordRows(wordRows);
      if (standardKey !== safeRequiredKey) return null;
      return {
        id: String(assignment?.id || "").trim(),
        class_id: String(assignment?.class_id || "").trim(),
        end_at: assignment?.end_at || null,
        created_at: assignment?.created_at || null,
      };
    })
    .filter((assignment) => !!assignment?.id)
    .sort(compareBaselineGateAssignments);

  if (!requiredBaselineAssignments.length) {
    return {
      status: "waiting",
      assignmentId: "",
      requiredStandardKey: safeRequiredKey,
      classIds,
    };
  }

  const statusRows = await readAssignmentStatusRows({
    assignmentIds: requiredBaselineAssignments.map((assignment) => assignment.id),
    pupilId: safePupilId,
  });
  const statusByAssignmentId = new Map(
    statusRows.map((row) => [String(row?.assignmentId || row?.assignment_id || "").trim(), row])
  );

  const completedAssignment = requiredBaselineAssignments.find((assignment) => {
    const statusRow = statusByAssignmentId.get(assignment.id);
    return !!(statusRow?.completedAt || statusRow?.completed_at);
  });
  if (completedAssignment) {
    return {
      status: "ready",
      assignmentId: "",
      requiredStandardKey: safeRequiredKey,
      classIds,
      completedAssignmentId: completedAssignment.id,
    };
  }

  const resumableAssignment = requiredBaselineAssignments.find((assignment) => {
    const statusRow = statusByAssignmentId.get(assignment.id);
    return hasStartedAssignmentStatus(statusRow);
  });
  if (resumableAssignment) {
    return {
      status: "resume",
      assignmentId: resumableAssignment.id,
      requiredStandardKey: safeRequiredKey,
      classIds,
    };
  }

  return {
    status: "start",
    assignmentId: requiredBaselineAssignments[0]?.id || "",
    requiredStandardKey: safeRequiredKey,
    classIds,
  };
}

/* ---------------------------
   Tests
---------------------------- */

export async function createTest({ title, question_type = DEFAULT_QUESTION_TYPE }) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const teacherId = requireUserId(userRes?.user);

  const testTitle = (title || "").trim() || "New test";
  const safeQuestionType = normalizeStoredQuestionType(question_type, { title: testTitle });

  const { data, error } = await supabase
    .from("tests")
    .insert([{ teacher_id: teacherId, title: testTitle, question_type: safeQuestionType }])
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function listTests() {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const teacherId = requireUserId(userRes?.user);

  const { data, error } = await supabase
    .from("tests")
    .select("id, title, created_at, question_type")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((item) => ({
    ...item,
    question_type: normalizeStoredQuestionType(item.question_type, { title: item.title }),
  }));
}

/* ---------------------------
   Pupil assignments + attempts
---------------------------- */

export async function getPupilAssignments({ classId, pupilId = "" }) {
  if (!classId) return [];

  const baseSelect = `
      id,
      teacher_id,
      test_id,
      class_id,
      mode,
      max_attempts,
      audio_enabled,
      hints_enabled,
      analytics_target_words_enabled,
      analytics_target_words_per_pupil,
      end_at,
      created_at,
      tests (
        id,
        title,
        question_type,
        test_words (
          id,
          position,
          word,
          sentence,
          segments,
          choice
        )
      ),
      classes (
        id,
        name,
        join_code
      )
    `;
  const automationSelect = `
      ,
      automation_kind,
      automation_source,
      automation_run_id,
      automation_triggered_by
    `;

  let assignmentQuery = await supabase
    .from("assignments_v2")
    .select(`${baseSelect}${automationSelect}`)
    .eq("class_id", classId)
    .order("end_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (assignmentQuery.error && isMissingAssignmentAutomationColumnError(assignmentQuery.error)) {
    assignmentQuery = await supabase
      .from("assignments_v2")
      .select(baseSelect)
      .eq("class_id", classId)
      .order("end_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  }

  const { data, error } = assignmentQuery;
  if (error) throw error;

  const assignmentIds = (data || []).map((item) => String(item?.id || "")).filter(Boolean);
  let targetRows = [];
  let statusRows = [];
  console.log("TEST LOAD ids:", {
    classId: String(classId || ""),
    pupilId: String(pupilId || ""),
    assignmentIds,
    queriedTargetTable: !!(assignmentIds.length && pupilId),
  });

  if (assignmentIds.length && pupilId) {
    const [targetRes, statusRes] = await Promise.all([
      supabase
        .from(ASSIGNMENT_TARGET_TABLE)
        .select(`
          id,
          assignment_id,
          pupil_id,
          test_word_id,
          focus_grapheme,
          target_source,
          target_reason,
          created_at,
          test_words (
            id,
            word,
            sentence,
            segments,
            choice
          )
        `)
        .eq("pupil_id", pupilId)
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: true }),
      readAssignmentStatusRows({
        assignmentIds,
        pupilId,
      }),
    ]);

    if (targetRes.error) {
      if (!isMissingAssignmentTargetTableError(targetRes.error)) throw targetRes.error;
    } else {
      targetRows = targetRes.data || [];
    }
    statusRows = statusRes || [];
    console.log("TARGET QUERY rows:", {
      pupilId: String(pupilId || ""),
      assignmentIds,
      rowCount: targetRows.length,
      rows: targetRows.map((row) => ({
        id: String(row?.id || ""),
        assignmentId: String(row?.assignment_id || ""),
        pupilId: String(row?.pupil_id || ""),
        testWordId: String(row?.test_word_id || ""),
        focusGrapheme: String(row?.focus_grapheme || ""),
        targetSource: String(row?.target_source || ""),
        targetReason: String(row?.target_reason || ""),
      })),
    });
  }

  const targetRowsByAssignment = new Map();
  for (const targetRow of targetRows) {
    const assignmentId = String(targetRow?.assignment_id || "");
    if (!assignmentId) continue;
    const next = targetRowsByAssignment.get(assignmentId) || [];
    next.push(targetRow);
    targetRowsByAssignment.set(assignmentId, next);
  }
  const statusRowsByAssignment = new Map(
    statusRows.map((row) => [String(row?.assignmentId || row?.assignment_id || ""), row])
  );

  if (pupilId) {
    for (const assignment of data || []) {
      const assignmentId = String(assignment?.id || "");
      if (!assignmentId) continue;

      const baseWords = Array.isArray(assignment?.tests?.test_words)
        ? [...assignment.tests.test_words].sort((a, b) => Number(a?.position || 0) - Number(b?.position || 0))
        : [];
      const isGenerated = isFullyGeneratedAssignmentWordRows(baseWords);
      const hasPupilTargets = (targetRowsByAssignment.get(assignmentId) || []).length > 0;
      const shouldEnsureTargets = !isGenerated
        && !!assignment?.analytics_target_words_enabled
        && Math.max(0, Number(assignment?.analytics_target_words_per_pupil || 0)) > 0
        && !hasPupilTargets;

      if (!shouldEnsureTargets) continue;

      try {
        const refreshedRows = await syncAssignmentPupilTargetWords({
          teacherId: String(assignment?.teacher_id || "").trim(),
          assignmentId,
          classId: String(assignment?.class_id || "").trim(),
          testId: String(assignment?.test_id || "").trim(),
          createdAt: assignment?.created_at || null,
          limitPerPupil: assignment?.analytics_target_words_per_pupil,
          force: false,
        });
        const pupilRows = refreshedRows.filter((row) => String(row?.pupilId || row?.pupil_id || "") === String(pupilId || ""));
        targetRowsByAssignment.set(assignmentId, pupilRows);
      } catch (targetError) {
        console.warn("ensure pupil assignment targets error:", targetError);
      }
    }
  }

  return (data || [])
    .map((item) => {
      const baseWords = Array.isArray(item?.tests?.test_words)
        ? [...item.tests.test_words]
          .filter((wordRow) => String(wordRow?.word || "").trim())
          .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
        : [];
      const baseWordsById = new Map(baseWords.map((wordRow) => [String(wordRow?.id || ""), wordRow]));
      const isGenerated = isFullyGeneratedAssignmentWordRows(baseWords);
      const isBaseline = isBaselineAssignmentWordRows(baseWords);
      const automationKind = String(item?.automation_kind || "").trim().toLowerCase();
      const automationSource = String(item?.automation_source || "").trim().toLowerCase();
      const isCentralManualAutomation = automationKind === ASSIGNMENT_AUTOMATION_KIND_PERSONALISED
        && automationSource === ASSIGNMENT_AUTOMATION_SOURCE_MANUAL_RUN_NOW;
      const assignmentTargetRows = targetRowsByAssignment.get(String(item?.id || "")) || [];
      const targetWords = assignmentTargetRows
        .map((targetRow, index) => {
          const sourceWord = resolveAssignmentTargetSourceWord(targetRow, baseWordsById);
          if (!sourceWord?.id) return null;
          const focusGrapheme = String(targetRow?.focus_grapheme || sourceWord?.choice?.focus_graphemes?.[0] || "").trim().toLowerCase();
          return {
            id: `target:${String(targetRow?.id || sourceWord.id)}`,
            base_test_word_id: String(sourceWord.id),
            assignment_target_id: String(targetRow?.id || ""),
            is_target_word: true,
            position: isGenerated ? index + 1 : baseWords.length + index + 1,
            word: String(sourceWord.word || "").trim(),
            sentence: sourceWord.sentence,
            segments: Array.isArray(sourceWord.segments) ? sourceWord.segments : [],
            choice: {
              ...(sourceWord.choice || {}),
              focus_graphemes: focusGrapheme
                ? [focusGrapheme]
                : (Array.isArray(sourceWord?.choice?.focus_graphemes) ? sourceWord.choice.focus_graphemes : []),
            },
            target_reason: String(targetRow?.target_reason || "focus_grapheme"),
            target_source: String(targetRow?.target_source || "analytics"),
            target_created_at: targetRow?.created_at || null,
          };
        })
        .filter((word) => word && String(word?.word || "").trim());
      console.log("Loaded targeted words for pupil:", {
        assignmentId: String(item?.id || ""),
        pupilId: String(pupilId || ""),
        targetRowCount: assignmentTargetRows.length,
        targetWordCount: targetWords.length,
        targets: targetWords.map((word) => ({
          assignmentTargetId: word?.assignment_target_id || null,
          testWordId: word?.base_test_word_id || null,
          word: word?.word || "",
          focusGrapheme: word?.choice?.focus_graphemes?.[0] || "",
          source: word?.target_source || "analytics",
          reason: word?.target_reason || "focus_grapheme",
        })),
      });
      const words = isGenerated ? targetWords : [...baseWords, ...targetWords];
      console.log("TEST LOAD ids:", {
        assignmentId: String(item?.id || ""),
        pupilId: String(pupilId || ""),
        testId: String(item?.test_id || ""),
        isGenerated,
        baseWordCount: baseWords.length,
        targetWordCount: targetWords.length,
      });
      const statusRow = statusRowsByAssignment.get(String(item?.id || "")) || null;
      const generatedStatusWordCount = Math.max(0, Number(statusRow?.totalWords ?? statusRow?.total_words ?? 0));
      const generatedPupilWordCount = isGenerated
        ? (generatedStatusWordCount > 0
          ? generatedStatusWordCount
          : (targetWords.length > 0 ? targetWords.length : null))
        : null;
      const pupilTitle = isGenerated
        ? "Personalised test"
        : (isBaseline ? "Baseline Test" : (item?.tests?.title || "Untitled test"));
      const pupilReason = isGenerated
        ? buildAssignmentEnginePupilReason(targetWords)
        : (isBaseline ? buildBaselinePupilReason() : "");
      const completedAt = statusRow?.completedAt || statusRow?.completed_at || null;
      if (isCentralManualAutomation && !targetWords.length) {
        return null;
      }

      return {
        id: item.id,
        teacher_id: item.teacher_id,
        class_id: item.class_id,
        test_id: item.test_id,
        title: item?.tests?.title || "Untitled test",
        question_type: normalizeStoredQuestionType(item?.tests?.question_type, {
          title: item?.tests?.title,
        }),
        mode: item.mode || "test",
        max_attempts: item.max_attempts == null ? null : Number(item.max_attempts),
        audio_enabled: item.audio_enabled !== false,
        hints_enabled: item.hints_enabled !== false,
        automation_kind: automationKind || null,
        automation_source: automationSource || null,
        automation_run_id: String(item?.automation_run_id || "").trim() || null,
        automation_triggered_by: String(item?.automation_triggered_by || "").trim() || null,
        end_at: item.end_at || null,
        created_at: item.created_at || null,
        analytics_target_words_enabled: !!item?.analytics_target_words_enabled,
        analytics_target_words_per_pupil: Math.max(0, Number(item?.analytics_target_words_per_pupil || 0)),
        attempt_source: isGenerated ? "auto_assigned" : (isBaseline ? "baseline" : "teacher_assigned"),
        assignmentOrigin: isGenerated ? "auto_assigned" : (isBaseline ? "baseline" : "teacher_assigned"),
        isGenerated,
        isBaseline,
        assignmentStatus: statusRow?.status || (completedAt ? "completed" : "assigned"),
        started_at: statusRow?.startedAt || statusRow?.started_at || null,
        completed_at: completedAt,
        total_words: Math.max(0, Number(statusRow?.totalWords ?? statusRow?.total_words ?? 0)),
        correct_words: Math.max(0, Number(statusRow?.correctWords ?? statusRow?.correct_words ?? 0)),
        average_attempts: Number.isFinite(Number(statusRow?.averageAttempts ?? statusRow?.average_attempts))
          ? Number(statusRow?.averageAttempts ?? statusRow?.average_attempts)
          : 0,
        score_rate: Number.isFinite(Number(statusRow?.scoreRate ?? statusRow?.score_rate))
          ? Number(statusRow?.scoreRate ?? statusRow?.score_rate)
          : 0,
        result_json: Array.isArray(statusRow?.resultJson ?? statusRow?.result_json)
          ? (statusRow?.resultJson ?? statusRow?.result_json)
          : [],
        completed: !!completedAt,
        isLocked: !!completedAt,
        pupilTitle,
        pupilReason,
        pupilWordCount: generatedPupilWordCount,
        words,
      };
    })
    .filter(Boolean);
}

export async function pupilRecordAttempt({
  pupilId,
  assignmentId,
  testId,
  testWordId,
  assignmentTargetId,
  mode,
  typed,
  correct,
  attemptNumber,
  attemptsAllowed,
  wordText,
  wordSource,
  attemptSource,
  targetGraphemes,
  focusGrapheme,
  patternType,
}) {
  if (!testId || (!testWordId && !assignmentTargetId)) return null;

  try {
    const payload = {
      pupil_id: pupilId || null,
      assignment_id: assignmentId || null,
      test_id: testId,
      test_word_id: testWordId || null,
      assignment_target_id: assignmentTargetId || null,
      mode,
      typed,
      correct,
      is_correct: correct,
      attempt_number: attemptNumber || null,
      attempt_no: attemptNumber || null,
      attempts_allowed: attemptsAllowed || null,
      word: wordText || null,
      word_text: wordText || null,
      word_source: wordSource || null,
      attempt_source: attemptSource || null,
      target_graphemes: Array.isArray(targetGraphemes) ? targetGraphemes : null,
      focus_grapheme: focusGrapheme || null,
      pattern_type: patternType || null,
      created_at: new Date().toISOString(),
    };
    console.log("ATTEMPT WRITE payload:", {
      assignmentId: payload.assignment_id,
      pupilId: payload.pupil_id,
      testId: payload.test_id,
      testWordId: payload.test_word_id,
      assignmentTargetId: payload.assignment_target_id,
      word: payload.word_text,
      wordSource: payload.word_source,
      attemptNumber: payload.attempt_number,
      isCorrect: payload.correct,
    });

    return await tryInsertAttempts(payload);
  } catch (e) {
    console.warn("pupilRecordAttempt failed:", e?.message || e);
    return null;
  }
}

export async function readAssignmentAttemptRows({
  assignmentId = "",
  pupilId = "",
} = {}) {
  const safeAssignmentId = String(assignmentId || "").trim();
  const safePupilId = String(pupilId || "").trim();
  if (!safeAssignmentId || !safePupilId) return [];

  const { data, error } = await supabase
    .from("attempts")
    .select(`
      id,
      assignment_id,
      pupil_id,
      test_id,
      test_word_id,
      assignment_target_id,
      mode,
      typed,
      correct,
      attempt_number,
      attempts_allowed,
      word_text,
      word_source,
      attempt_source,
      target_graphemes,
      focus_grapheme,
      pattern_type,
      created_at
    `)
    .eq("assignment_id", safeAssignmentId)
    .eq("pupil_id", safePupilId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function buildAssignmentAttemptKey({ assignmentTargetId = "", testWordId = "" } = {}) {
  const safeTargetId = String(assignmentTargetId || "").trim();
  if (safeTargetId) return `target:${safeTargetId}`;
  const safeWordId = String(testWordId || "").trim();
  if (safeWordId) return `word:${safeWordId}`;
  return "";
}

function shouldBackfillAssignmentAttempt(existingAttempt, result) {
  if (!existingAttempt) return true;

  const expectedAttemptNumber = Math.max(1, Number(result?.attemptsUsed || 1));
  const existingAttemptNumber = Math.max(1, Number(existingAttempt?.attempt_number || existingAttempt?.attempt_no || 1));
  if (existingAttemptNumber < expectedAttemptNumber) return true;

  if (!!existingAttempt?.correct !== !!result?.correct) return true;

  const existingTyped = String(existingAttempt?.typed ?? "").trim().toLowerCase();
  const expectedTyped = String(result?.typed ?? "").trim().toLowerCase();
  if (expectedTyped && existingTyped !== expectedTyped) return true;

  return false;
}

export async function reconcileAssignmentResultAttempts({
  pupilId,
  assignmentId,
  testId,
  results = [],
  attemptsAllowed = null,
  attemptSource = "teacher_assigned",
} = {}) {
  const safePupilId = String(pupilId || "").trim();
  const safeAssignmentId = String(assignmentId || "").trim();
  const safeTestId = String(testId || "").trim();
  const resultRows = Array.isArray(results) ? results : [];
  if (!safePupilId || !safeAssignmentId || !safeTestId || !resultRows.length) {
    return { insertedCount: 0, existingCount: 0 };
  }

  const { data: existingRows, error } = await supabase
    .from("attempts")
    .select("assignment_target_id, test_word_id, correct, attempt_number, attempt_no, typed, created_at")
    .eq("assignment_id", safeAssignmentId)
    .eq("pupil_id", safePupilId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const latestByKey = new Map();
  for (const row of existingRows || []) {
    const key = buildAssignmentAttemptKey({
      assignmentTargetId: row?.assignment_target_id,
      testWordId: row?.test_word_id,
    });
    if (!key) continue;
    latestByKey.set(key, row);
  }

  let insertedCount = 0;
  for (const result of resultRows) {
    const assignmentTargetId = String(result?.assignmentTargetId || "").trim();
    const testWordId = String(result?.baseTestWordId || result?.wordId || "").trim();
    const key = buildAssignmentAttemptKey({ assignmentTargetId, testWordId });
    if (!key) continue;

    const existingAttempt = latestByKey.get(key) || null;
    if (!shouldBackfillAssignmentAttempt(existingAttempt, result)) continue;

    const inserted = await pupilRecordAttempt({
      pupilId: safePupilId,
      assignmentId: safeAssignmentId,
      testId: safeTestId,
      testWordId: testWordId || null,
      assignmentTargetId: assignmentTargetId || null,
      mode: String(result?.questionType || "").trim() || null,
      typed: String(result?.typed ?? ""),
      correct: !!result?.correct,
      attemptNumber: Math.max(1, Number(result?.attemptsUsed || 1)),
      attemptsAllowed: Number.isFinite(Number(result?.attemptsAllowed))
        ? Number(result.attemptsAllowed)
        : (Number.isFinite(Number(attemptsAllowed)) ? Number(attemptsAllowed) : null),
      wordText: String(result?.correctSpelling || result?.word || "").trim() || null,
      wordSource: String(result?.wordSource || "").trim() || (assignmentTargetId ? "targeted" : "base"),
      attemptSource,
      targetGraphemes: Array.isArray(result?.targetGraphemes) ? result.targetGraphemes : null,
      focusGrapheme: String(result?.focusGrapheme || "").trim() || null,
      patternType: String(result?.patternType || "").trim() || null,
    });

    if (inserted) {
      insertedCount += 1;
      latestByKey.set(key, {
        assignment_target_id: assignmentTargetId || null,
        test_word_id: testWordId || null,
        correct: !!result?.correct,
        attempt_number: Math.max(1, Number(result?.attemptsUsed || 1)),
        typed: String(result?.typed ?? ""),
      });
    }
  }

  console.log("ATTEMPT RECONCILE summary:", {
    assignmentId: safeAssignmentId,
    pupilId: safePupilId,
    testId: safeTestId,
    resultCount: resultRows.length,
    existingCount: latestByKey.size,
    insertedCount,
  });

  return {
    insertedCount,
    existingCount: latestByKey.size,
  };
}
