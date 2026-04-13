// /js/teacherView.js
import { fetchTeacherGroupComparison, manageDemoSchoolData, teacherAnalyticsChat } from "../ai.js?v=3.1";
import { supabase } from "./supabaseClient.js";
import {
  persistAssignmentTargetRows,
  readAssignmentTargetRows,
  syncAssignmentPupilTargetWords,
} from "./assignmentTargets.js?v=1.3";
import {
  DEFAULT_QUESTION_TYPE,
  getQuestionEvidenceTier,
  getQuestionTypeDisplayLabel,
  normalizeStoredQuestionType,
} from "./questionTypes.js?v=1.1";
import { chooseBestFocusGrapheme, getPhonemeAlternativeOptions, inferPhonemeFromGrapheme } from "./data/phonemeHelpers.js";
import { buildTestDifficultySummary, getDifficultyBand, getDifficultyDisplayLabel } from "./researchDifficulty.js?v=2.4";
import {
  averageSpellingIndicator,
  buildDifficultyMapFromWordRows,
  estimateSpellingAttainmentIndicator,
  getAttainmentDisplayLabel,
  getSpellingIndicatorEvidenceBands,
  getSpellingIndicatorTeacherDescription,
  getSpellingIndicatorTechnicalDescription,
} from "./spellingIndicator.js?v=1.6";
import { splitWordToGraphemes } from "./wordParser.js?v=1.5";
import { renderIconLabel, renderIconOnly, renderInfoTip } from "./uiIcons.js?v=1.3";
import {
  getLevelDefinition,
  getPerformanceDefinition,
  getScoreDefinition,
  LEVEL_LADDER_KEYS,
  PERFORMANCE_LADDER_KEYS,
  getLevelDisplayLabel,
  getPerformanceDisplayLabel,
} from "./reportingLabels.js?v=1.1";
import {
  ASSIGNMENT_ENGINE_DEFAULT_LENGTH,
  ASSIGNMENT_ENGINE_TARGET_SOURCE,
  buildProfileFromAttempts,
  buildAssignmentEngineTitle,
  buildAssignmentEngineWordPayload,
  buildAssignmentEngineWordSignature,
  buildGeneratedAssignmentPlan,
  isFullyGeneratedAssignmentWordRows,
} from "./assignmentEngine.js?v=1.5";
import {
  buildBaselineAssignmentDefinition,
  buildPlacementSeedProfiles,
  buildStarterCatalogVirtualTests,
  isBaselineAssignmentWordRows,
  mergePlacementWithLiveProfiles,
  resolveBaselinePresetFromWordRows,
} from "./baselinePlacement.js?v=1.3";
import { buildResolvedWordMap } from "./phonicsResolution.js?v=1.0";
import {
  cancelStaffPendingAccessApproval,
  consumeLatestStaffProfileSyncNotice,
  ASSIGNMENT_AUTOMATION_KIND_PERSONALISED,
  ASSIGNMENT_AUTOMATION_SOURCE_MANUAL_RUN_NOW,
  CLASS_TYPE_FORM,
  CLASS_TYPE_INTERVENTION,
  CLASS_TYPE_SUBJECT,
  createClass,
  createInterventionGroup,
  createPersonalisedGenerationRun,
  deleteClassAutoAssignPolicy,
  deletePersonalisedAutomationPolicy,
  grantStaffRole,
  grantStaffScope,
  importStaffDirectoryCsv,
  listTeacherPupilDirectoryForInterventionGroups,
  listActiveAdminUserIds,
  listActiveStaffRoleAssignments,
  listStaffAccessAuditEntries,
  listStaffPendingAccessSummaries,
  listStaffProfiles,
  listStaffRoleAssignments,
  listStaffScopeAssignments,
  listPersonalisedAutomationPolicies,
  listClassAutoAssignPolicies,
  normalizeClassType,
  readPupilBaselineGateState,
  readStaffAccessContext,
  readStaffPendingAccessDetail,
  readStaffPendingAccessDuplicatePreflight,
  readTeacherAppRole,
  revokeStaffRole,
  revokeStaffScope,
  saveStaffPendingAccessApproval,
  seedAutomatedAssignmentPupilStatuses,
  setPersonalisedAutomationPolicyArchived,
  updatePersonalisedGenerationRun,
  upsertPersonalisedAutomationPolicy,
  upsertPersonalisedGenerationRunPupilRows,
  upsertClassAutoAssignPolicy,
} from "./db.js?v=1.31";
import {
  buildStaffImportCommitPayload,
  buildStaffImportPreview,
  getStaffImportOptionalColumns,
  getStaffImportRequiredColumns,
  parseStaffImportCsv,
} from "./staffCsvImport.js?v=1.0";
import {
  AUTO_ASSIGN_POLICY_DEFAULTS,
  AUTO_ASSIGN_POLICY_LENGTH_MAX,
  AUTO_ASSIGN_POLICY_LENGTH_MIN,
  AUTO_ASSIGN_SUPPORT_PRESET_OPTIONS,
  buildAutoAssignPolicySummary,
  buildDefaultPersonalisedAutomationPolicy,
  doPersonalisedAutomationPolicyWindowsOverlap,
  derivePersonalisedAutomationDeadline,
  formatPersonalisedAutomationWeekdayList,
  getAutoAssignSupportPresetLabel,
  getPersonalisedAutomationPolicyLifecycle,
  normalizeAutoAssignPolicy,
  normalizePersonalisedAutomationPolicy,
  PERSONALISED_AUTOMATION_EXPIRY_WARNING_DAYS,
  PERSONALISED_AUTOMATION_FREQUENCY_OPTIONS,
  PERSONALISED_AUTOMATION_WEEKDAY_OPTIONS,
} from "./autoAssignPolicy.js?v=1.8";

const DEMO_CLASS_PREFIX = "[Demo]";
const DEMO_TEST_PREFIX = "[Demo]";
const VISUAL_ANALYTICS_WINDOW_DAYS = 180;
const DASHBOARD_SECTION_KEYS = ["staffAccess", "analytics", "upcoming", "classes", "tests"];
const ALL_CLASSES_SCOPE_VALUE = "__all_classes__";
const VISUAL_COMPARE_LIMIT = 3;
const ASSIGNMENT_PUPIL_ROWS_STEP = 5;
const CLASS_RESULTS_RECENT_LIMIT = 5;
const CLASS_RESULTS_RANGE_DEFAULT = "last_week";
const STAFF_ACCESS_AUDIT_LIMIT = 10;
const STAFF_ACCESS_MANAGED_ROLES = ["teacher", "admin", "hoy", "hod", "senco", "literacy_lead"];
const STAFF_ACCESS_RECENT_IMPORT_WINDOW_DAYS = 14;
const CLASS_RESULTS_RANGE_OPTIONS = [
  { key: "this_week", label: "This week" },
  { key: "last_week", label: "Last week" },
  { key: "last_30_days", label: "30 days" },
  { key: "all", label: "All" },
];
const VISUAL_TREND_FLAT_DELTA = 0.06;
const VISUAL_EXPECTED_MIN_ATTEMPTS = 4;
const VISUAL_STATUS_FILTER_OPTIONS = [
  { key: "needs_review", label: "Needs review", tone: "red" },
  { key: "developing", label: "Developing", tone: "amber" },
  { key: "secure", label: "Secure", tone: "green" },
];
const VISUAL_CLASS_RANK_OPTIONS = [
  { value: "attainment", label: "Attainment" },
  { value: "accuracy", label: "Accuracy" },
  { value: "participation", label: "Participation" },
  { value: "fewest_attempts", label: "Fewest tries" },
  { value: "review", label: "Most review needed" },
];
const VISUAL_RANK_TARGET_OPTIONS = [
  { value: "classes", label: "Classes" },
  { value: "pupils", label: "Pupils" },
];
const VISUAL_PUPIL_RANK_OPTIONS = [
  { value: "attainment", label: "Attainment" },
  { value: "accuracy", label: "Accuracy" },
  { value: "fewest_attempts", label: "Fewest tries" },
  { value: "review", label: "Most review needed" },
  { value: "checked_words", label: "Most checked words" },
];
const VISUAL_RANK_ROWS_STEP = 6;
const COMMON_CONFUSION_TEST_WORD_LIMIT = 8;
const BASELINE_LIVE_INDEPENDENT_MIN_ATTEMPTS = 4;
const ANALYTICS_ASSISTANT_THREAD_LIMIT = 10;
const AUTOMATION_POLICY_DRAFT_STORAGE_PREFIX = "ps_personalised_automation_policy_draft_v2";
const AUTOMATION_NEW_POLICY_KEY = "__new__";
const ANALYTICS_ASSISTANT_INTRO =
  "Ask about intervention priorities, weak graphemes, class or year comparisons, or what an individual pupil may need next.";
const GROUP_COMPARISON_MIN_COHORT_SIZE = 5;
const GROUP_COMPARISON_GROUP_OPTIONS = [
  { value: "pp", label: "PP" },
  { value: "sen", label: "SEN" },
  { value: "gender", label: "Gender" },
];
const GROUP_COMPARISON_SCOPE_OPTIONS = [
  { value: "whole_school", label: "Whole school" },
  { value: "year_group", label: "Year group" },
  { value: "class", label: "Class" },
];
const STANDARD_METRIC_LABELS = {
  attainment: "Attainment",
  accuracy: "Accuracy",
  first_try: "First try",
  completion: "Completion",
  average_tries: "Average tries",
  checked: "Checked",
  pupils: "Pupils",
  classes: "Classes",
};
const STANDARD_METRIC_ALIASES = {
  attainment_indicator: "attainment",
  accuracy_rate: "accuracy",
  checked_accuracy: "accuracy",
  first_time_correct_rate: "first_try",
  completion_rate: "completion",
  average_attempts_per_correct_word: "average_tries",
};
function normalizeStandardMetricKey(metricKey) {
  const key = String(metricKey || "");
  return STANDARD_METRIC_ALIASES[key] || key;
}

function getStandardMetricLabel(metricKey, { scopeType = "" } = {}) {
  const normalized = normalizeStandardMetricKey(metricKey);
  if (normalized === "pupils" && scopeType === "pupil") return STANDARD_METRIC_LABELS.classes;
  return STANDARD_METRIC_LABELS[normalized] || String(metricKey || "");
}

function getStandardMetricGapLabel(metricKey, options = {}) {
  return `${getStandardMetricLabel(metricKey, options)} gap`;
}

const GROUP_COMPARISON_METRICS = [
  { value: "attainment_indicator", label: getStandardMetricLabel("attainment_indicator"), shortLabel: getStandardMetricGapLabel("attainment_indicator"), format: "score" },
  { value: "accuracy_rate", label: getStandardMetricLabel("accuracy_rate"), shortLabel: getStandardMetricGapLabel("accuracy_rate"), format: "percent" },
  { value: "first_time_correct_rate", label: getStandardMetricLabel("first_time_correct_rate"), shortLabel: getStandardMetricGapLabel("first_time_correct_rate"), format: "percent" },
  { value: "completion_rate", label: getStandardMetricLabel("completion_rate"), shortLabel: getStandardMetricGapLabel("completion_rate"), format: "percent" },
  { value: "average_attempts_per_correct_word", label: getStandardMetricLabel("average_attempts_per_correct_word"), shortLabel: getStandardMetricGapLabel("average_attempts_per_correct_word"), format: "attempts" },
];
const GROUP_COMPARISON_PAIR_FALLBACKS = {
  pp: [
    { value: "pp", label: "PP" },
    { value: "non_pp", label: "Non-PP" },
  ],
  sen: [
    { value: "none", label: "No SEN" },
    { value: "sen_support", label: "SEN support" },
    { value: "ehcp", label: "EHCP" },
  ],
  gender: [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
    { value: "non_binary", label: "Non-binary" },
    { value: "other", label: "Other" },
  ],
};
const AUTOMATION_ELIGIBLE_CLASS_TYPES = new Set([CLASS_TYPE_FORM, CLASS_TYPE_INTERVENTION]);

function createDefaultGroupComparisonState() {
  return {
    status: "idle",
    message: "",
    result: null,
    compareKey: "",
    withKey: "",
    filters: {
      scopeType: "whole_school",
      scopeValue: "",
      testId: "",
      dateFrom: "",
      dateTo: "",
    },
  };
}

function createDefaultAnalyticsAssistantMessages() {
  return [
    {
      role: "assistant",
      text: ANALYTICS_ASSISTANT_INTRO,
    },
  ];
}

function createDefaultInterventionGroupState() {
  return {
    status: "idle",
    message: "Choose a filter to find pupils.",
    pupils: [],
    selectedPupilIds: [],
    selectedPupilsById: {},
    resultCount: 0,
    filters: {
      yearGroup: "",
      sourceClassId: "",
      search: "",
    },
  };
}

function createDefaultStaffPendingApprovalDraft() {
  return {
    roles: [],
    scopes: [],
  };
}

function createDefaultStaffPendingApprovalDetail() {
  return {
    staff_profile_id: "",
    profile_linked: false,
    can_approve: false,
    duplicate_conflicts: [],
    approval: null,
  };
}

function createDefaultStaffPendingDuplicatePreflight() {
  return {
    has_conflicts: false,
    email_conflict_count: 0,
    external_id_conflict_count: 0,
    email_conflicts: [],
    external_id_conflicts: [],
  };
}

function createDefaultStaffAccessState() {
  return {
    profiles: [],
    directoryRoleAssignments: [],
    activeAdminUserIds: [],
    pendingApprovalSummaries: [],
    pendingDuplicatePreflight: createDefaultStaffPendingDuplicatePreflight(),
    selectedPendingApproval: createDefaultStaffPendingApprovalDetail(),
    pendingApprovalDraft: createDefaultStaffPendingApprovalDraft(),
    search: "",
    filter: "all",
    selectedProfileId: "",
    selectedRoles: [],
    selectedScopes: [],
    selectedAuditEntries: [],
    importFileName: "",
    importPreview: null,
    importPreviewError: "",
    importPreviewLoading: false,
    importResult: null,
    recentImportBatchId: "",
    pendingScopeSelections: {
      hoy: {
        year_group: "",
        class_ids: [],
      },
      hod: {
        department: "",
        class_ids: [],
      },
    },
    confirmation: null,
    loadingDirectory: false,
    loadingDetails: false,
    mutating: false,
    error: "",
    detailError: "",
  };
}

function createDefaultAutomationTargetFilters() {
  return {
    yearGroup: "",
    classType: "all",
  };
}

function deriveAutomationTargetFiltersFromPolicy(rawPolicy = null) {
  const policy = rawPolicy && typeof rawPolicy === "object" ? rawPolicy : {};
  const selectedIds = normalizeIdList(policy.target_class_ids);
  if (!selectedIds.length) return createDefaultAutomationTargetFilters();

  const eligibleById = new Map(
    getAutomationEligibleClasses().map((item) => [String(item?.id || "").trim(), item])
  );
  const selectedClasses = selectedIds
    .map((classId) => eligibleById.get(classId) || null)
    .filter(Boolean);
  if (!selectedClasses.length) return createDefaultAutomationTargetFilters();

  const yearGroups = [...new Set(
    selectedClasses
      .map((item) => String(item?.year_group || "").trim())
      .filter(Boolean)
  )];
  const classTypes = [...new Set(
    selectedClasses
      .map((item) => getNormalizedClassType(item?.class_type, { legacyFallback: CLASS_TYPE_FORM }))
      .filter((item) => [CLASS_TYPE_FORM, CLASS_TYPE_INTERVENTION].includes(item))
  )];

  return {
    yearGroup: yearGroups.length === 1 ? yearGroups[0] : "",
    classType: classTypes.length === 1 ? classTypes[0] : "all",
  };
}

function createDefaultAccessContext(userId = "") {
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
      teacher_app_role: null,
      is_legacy_central_owner: false,
    },
    roles: {
      admin: false,
      teacher: false,
      hoy: false,
      hod: false,
      senco: false,
      literacy_lead: false,
    },
    capabilities: {
      can_manage_automation: false,
      can_import_csv: false,
      can_manage_roles: false,
      can_create_classes: false,
      can_create_tests: false,
      can_assign_tests: false,
      can_manage_intervention_groups: false,
      can_manage_own_content: false,
      can_view_schoolwide_analytics: false,
    },
    scopes: {
      school: false,
      year_groups: [],
      departments: [],
      class_ids: [],
    },
    role_scopes: {
      admin: createEmptyRoleScopes(),
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

const state = {
  user: null,
  accessContext: createDefaultAccessContext(),
  classes: [],
  tests: [],
  assignments: [],
  sections: {
    staffAccess: false,
    upcoming: false,
    classes: false,
    tests: false,
    analytics: false,
  },
  activePanel: null, // { type: "assign-test" | "edit-class" | "results-assignment" | "class-results", id: string }
  flashTestId: null,
  flashClassId: null,
  notice: "",
  noticeType: "info",
  testSearch: "",
  analyticsByAssignment: {},
  testGroupExpanded: {
    live: false,
    draft: false,
    ready: false,
  },
  visualAnalytics: {
    status: "idle",
    message: "",
    windowDays: VISUAL_ANALYTICS_WINDOW_DAYS,
    sourceData: null,
    selectedGrapheme: "",
    catalog: {
      overview: null,
      yearGroups: [],
      classes: [],
      pupils: [],
    },
    summaries: {},
    activeGroup: "overview",
    summaryOpen: true,
    selectedScopeType: "overview",
    selectedScopeId: "",
    selectedAssignmentByScope: {},
    rankingTargetByScope: {},
    visibleRankingRowsByScope: {},
    attainmentGuideOpen: false,
    classRankingMode: "attainment",
    pupilRankingMode: "attainment",
    pupilSearch: "",
    graphemeStatusFilter: "all",
    pupilStatusFilter: "all",
    compareSelections: [],
  },
  groupComparison: createDefaultGroupComparisonState(),
  analyticsAssistant: {
    open: false,
    scopeType: "overview",
    scopeId: "",
    questionDraft: "",
    loading: false,
    messages: createDefaultAnalyticsAssistantMessages(),
    activeThreadId: "",
    threads: [],
    threadsLoading: false,
    historyAvailable: true,
  },
  assignmentResultsUi: {
    visiblePupilRows: {},
    expandedPupilRows: {},
  },
  classResultsUi: {
    rangeByClass: {},
    selectedAssignmentByClass: {},
  },
  appRole: "teacher",
  classPoliciesByClassId: {},
  createClassOpen: false,
  createInterventionGroupOpen: false,
  createBaselineOpen: false,
  createAutoAssignOpen: false,
  createAutoAssignClassId: "",
  automationPolicies: [],
  automationSelectedPolicyKey: "",
  automationDraftsByKey: {},
  automationAction: createDefaultAutomationActionState(),
  interventionGroup: createDefaultInterventionGroupState(),
  staffAccess: createDefaultStaffAccessState(),
  demoData: {
    loading: false,
    action: "",
  },
};

let rootEl = null;
let eventsBound = false;
let visualCompareSeed = 0;
let groupComparisonRequestId = 0;
let staffAccessDirectoryRequestId = 0;
let staffAccessDetailsRequestId = 0;
let visualAnalyticsDerivedCache = {
  sourceData: null,
  grapheme: "",
  viewModel: null,
};

function buildClassPoliciesByClassId(rows = []) {
  return Object.fromEntries(
    (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const classId = String(row?.class_id || "").trim();
        return classId ? [classId, normalizeAutoAssignPolicy(row)] : null;
      })
      .filter(Boolean)
  );
}

function getSavedClassAutoAssignPolicy(classId) {
  const key = String(classId || "").trim();
  if (!key) return null;
  const policy = state.classPoliciesByClassId?.[key];
  return policy && typeof policy === "object" ? normalizeAutoAssignPolicy(policy) : null;
}

function getAccessContext() {
  return state.accessContext && typeof state.accessContext === "object"
    ? state.accessContext
    : createDefaultAccessContext(state.user?.id || "");
}

function getAccessCapabilities() {
  const capabilities = getAccessContext()?.capabilities;
  return capabilities && typeof capabilities === "object"
    ? capabilities
    : createDefaultAccessContext(state.user?.id || "").capabilities;
}

function canManageAutomation() {
  return !!getAccessCapabilities()?.can_manage_automation;
}

function canManageInterventionGroups() {
  return !!getAccessCapabilities()?.can_manage_intervention_groups;
}

function canManageRoles() {
  return !!getAccessCapabilities()?.can_manage_roles;
}

function canCreateClasses() {
  return !!getAccessCapabilities()?.can_create_classes;
}

function canCreateTests() {
  return !!getAccessCapabilities()?.can_create_tests;
}

function canAssignTests() {
  return !!getAccessCapabilities()?.can_assign_tests;
}

function canManageOwnContent() {
  return !!getAccessCapabilities()?.can_manage_own_content;
}

function getCurrentTeacherId() {
  return String(state.user?.id || "").trim();
}

function ownsTeacherRecord(record) {
  return String(record?.teacher_id || "").trim() !== ""
    && String(record?.teacher_id || "").trim() === getCurrentTeacherId();
}

function getEffectiveClassAutoAssignPolicy(classId) {
  return normalizeAutoAssignPolicy(
    getSavedClassAutoAssignPolicy(classId) || AUTO_ASSIGN_POLICY_DEFAULTS
  );
}

function getClassAutoAssignPolicySummary(classId, { useDefaultLabel = false } = {}) {
  return buildAutoAssignPolicySummary(
    getEffectiveClassAutoAssignPolicy(classId),
    { useDefaultLabel }
  );
}

function getSelectedAutoAssignPolicySummary() {
  const classId = String(state.createAutoAssignClassId || "").trim();
  if (!classId) {
    return `Default policy: ${buildAutoAssignPolicySummary(AUTO_ASSIGN_POLICY_DEFAULTS)}. Review / Target / Stretch stays 40% / 40% / 20%.`;
  }
  const hasSavedPolicy = !!getSavedClassAutoAssignPolicy(classId);
  return `${hasSavedPolicy ? "Using saved policy" : "Using default policy"}: ${getClassAutoAssignPolicySummary(classId)}. Review / Target / Stretch stays 40% / 40% / 20%.`;
}

function getTeacherAppRole() {
  return canManageAutomation()
    || String(state.appRole || "teacher").trim().toLowerCase() === "central_owner"
    ? "central_owner"
    : "teacher";
}

function isCentralOwnerAppRole() {
  return getTeacherAppRole() === "central_owner";
}

function getDashboardTitle() {
  const roles = getAccessContext()?.roles || {};

  if (canManageAutomation() || roles.admin) return "Admin dashboard";
  if (!roles.teacher && roles.hoy) return "Head of Year dashboard";
  if (!roles.teacher && !roles.hoy && roles.hod) return "Head of Department dashboard";
  if (roles.teacher || canCreateClasses() || canCreateTests() || canAssignTests() || canManageOwnContent()) {
    return "Teacher dashboard";
  }
  if (roles.hoy) return "Head of Year dashboard";
  if (roles.hod) return "Head of Department dashboard";
  return "Staff dashboard";
}

function getBaselineActionTooltipText() {
  return isCentralOwnerAppRole()
    ? "Set the standard baseline test for this class. Future exceptional overrides will stay under central control."
    : "Set the standard baseline test for this class before pupils move into the normal personalised flow.";
}

function getGeneratePersonalisedActionTooltipText() {
  return isCentralOwnerAppRole()
    ? "Manage named automation policies for selected form and intervention groups, then run one saved policy now. Pupils without the required baseline or with an active automated personalised test will be skipped."
    : "Personalised automation is now run from the central-owner control.";
}

function findClassRecord(classId) {
  return state.classes.find((item) => String(item?.id || "") === String(classId || "")) || null;
}

function canEditClassRecord(record) {
  return !!record && canManageOwnContent() && ownsTeacherRecord(record);
}

function canManageClassAutoAssignPolicyRecord(record) {
  return canEditClassRecord(record);
}

function canEditTestRecord(record) {
  return !!record && canManageOwnContent() && ownsTeacherRecord(record);
}

function canPresentTestRecord(record) {
  return canEditTestRecord(record);
}

function canAssignFromTestRecord(record) {
  return canEditTestRecord(record) && canAssignTests();
}

function canManageAssignmentRecord(record) {
  return !!record && canManageOwnContent() && ownsTeacherRecord(record);
}

function getOwnedClasses() {
  return (state.classes || []).filter((item) => canEditClassRecord(item));
}

function getOwnedAssignableClasses() {
  return getOwnedClasses().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
}

function getNormalizedClassType(value, { legacyFallback = CLASS_TYPE_FORM } = {}) {
  return normalizeClassType(value, { legacyFallback });
}

function getClassTypeDisplayLabel(value) {
  const classType = getNormalizedClassType(value);
  if (classType === CLASS_TYPE_INTERVENTION) return "Intervention group";
  if (classType === CLASS_TYPE_FORM) return "Form group";
  return "Subject class";
}

function isAutomationEligibleClass(item) {
  return AUTOMATION_ELIGIBLE_CLASS_TYPES.has(
    getNormalizedClassType(item?.class_type, { legacyFallback: CLASS_TYPE_FORM })
  );
}

function getAutomationEligibleClasses() {
  return (state.classes || [])
    .filter((item) => canEditClassRecord(item) && isAutomationEligibleClass(item))
    .sort((a, b) => {
      const typeDelta =
        (getNormalizedClassType(a?.class_type) === CLASS_TYPE_INTERVENTION ? 0 : 1)
        - (getNormalizedClassType(b?.class_type) === CLASS_TYPE_INTERVENTION ? 0 : 1);
      if (typeDelta !== 0) return typeDelta;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
}

function getInterventionBuilderSourceClasses() {
  return (state.classes || [])
    .filter((item) =>
      canEditClassRecord(item)
      && getNormalizedClassType(item?.class_type, { legacyFallback: CLASS_TYPE_FORM }) !== CLASS_TYPE_INTERVENTION
    )
    .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
}

function getInterventionBuilderYearGroupOptions() {
  return [...new Set(
    getInterventionBuilderSourceClasses()
      .map((item) => String(item?.year_group || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function getInterventionBuilderAvailableSourceClasses({ yearGroup = state.interventionGroup?.filters?.yearGroup } = {}) {
  const safeYearGroup = String(yearGroup || "").trim();
  return getInterventionBuilderSourceClasses()
    .filter((item) => !safeYearGroup || String(item?.year_group || "").trim() === safeYearGroup);
}

function syncInterventionBuilderSourceClassFilter({ yearGroup = state.interventionGroup?.filters?.yearGroup } = {}) {
  const currentSourceClassId = String(state.interventionGroup?.filters?.sourceClassId || "").trim();
  if (!currentSourceClassId) return false;

  const availableSourceClassIds = new Set(
    getInterventionBuilderAvailableSourceClasses({ yearGroup })
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean)
  );
  if (availableSourceClassIds.has(currentSourceClassId)) return false;

  state.interventionGroup.filters.sourceClassId = "";
  return true;
}

function getStaffAccessState() {
  return state.staffAccess && typeof state.staffAccess === "object"
    ? state.staffAccess
    : createDefaultStaffAccessState();
}

function getStaffAccessSelectedProfileId() {
  return String(getStaffAccessState()?.selectedProfileId || "").trim();
}

function getStaffAccessProfileMap() {
  return new Map(
    (getStaffAccessState()?.profiles || [])
      .map((profile) => [String(profile?.id || "").trim(), profile])
      .filter(([profileId]) => !!profileId)
  );
}

function getStaffAccessProfileByUserIdMap() {
  return new Map(
    (getStaffAccessState()?.profiles || [])
      .map((profile) => [String(profile?.user_id || "").trim(), profile])
      .filter(([userId]) => !!userId)
  );
}

function getStaffPendingApprovalSummaryMap() {
  return new Map(
    (Array.isArray(getStaffAccessState()?.pendingApprovalSummaries) ? getStaffAccessState().pendingApprovalSummaries : [])
      .map((summary) => [String(summary?.staff_profile_id || "").trim(), summary])
      .filter(([profileId]) => !!profileId)
  );
}

function getStaffPendingApprovalSummary(profile = null) {
  const profileId = String(profile?.id || "").trim();
  if (!profileId) return null;
  return getStaffPendingApprovalSummaryMap().get(profileId) || null;
}

function isStaffAccessProfileLinked(profile = null) {
  return !!String(profile?.user_id || "").trim();
}

function getStaffAccessSelectedProfile() {
  const selectedProfileId = getStaffAccessSelectedProfileId();
  if (!selectedProfileId) return null;
  return getStaffAccessProfileMap().get(selectedProfileId) || null;
}

function getSelectedStaffPendingApproval() {
  const value = getStaffAccessState()?.selectedPendingApproval;
  return value && typeof value === "object" ? value : createDefaultStaffPendingApprovalDetail();
}

function canManageSelectedStaffPendingApproval() {
  const selectedProfile = getStaffAccessSelectedProfile();
  if (!selectedProfile || isStaffAccessProfileLinked(selectedProfile)) return false;
  return !!getSelectedStaffPendingApproval()?.can_approve;
}

function getSelectedStaffAccessTargetUserId() {
  return String(getStaffAccessSelectedProfile()?.user_id || "").trim();
}

function getStaffAccessDirectoryRoleMap() {
  const roleMap = new Map();
  for (const row of Array.isArray(getStaffAccessState()?.directoryRoleAssignments)
    ? getStaffAccessState().directoryRoleAssignments
    : []) {
    const userId = String(row?.user_id || "").trim();
    const role = String(row?.role || "").trim().toLowerCase();
    if (!userId || !role) continue;
    const next = roleMap.get(userId) || [];
    next.push(role);
    roleMap.set(userId, next);
  }
  for (const [userId, roles] of roleMap.entries()) {
    roleMap.set(userId, [...new Set(roles)].sort((a, b) => a.localeCompare(b)));
  }
  return roleMap;
}

function getStaffAccessProfileActiveRoles(profile = null) {
  const safeUserId = String(profile?.user_id || "").trim();
  if (!safeUserId) return [];
  return getStaffAccessDirectoryRoleMap().get(safeUserId) || [];
}

function doesStaffAccessProfileHaveActiveAccess(profile = null) {
  return getStaffAccessProfileActiveRoles(profile).length > 0;
}

function doesStaffAccessProfileHaveNoRoleAssigned(profile = null) {
  return !doesStaffAccessProfileHaveActiveAccess(profile);
}

function doesStaffAccessProfileHavePendingAccess(profile = null) {
  return !isStaffAccessProfileLinked(profile)
    && doesStaffAccessProfileHaveNoRoleAssigned(profile)
    && (!!String(profile?.last_imported_at || "").trim() || String(profile?.profile_source || "") === "csv_import");
}

function isStaffAccessProfileRecentlyImported(profile = null) {
  const batchId = String(getStaffAccessState()?.recentImportBatchId || "").trim();
  const profileBatchId = String(profile?.last_import_batch_id || "").trim();
  if (batchId) {
    return !!profileBatchId && profileBatchId === batchId;
  }
  const importedAt = Date.parse(String(profile?.last_imported_at || ""));
  if (!Number.isFinite(importedAt)) return false;
  return importedAt >= Date.now() - (STAFF_ACCESS_RECENT_IMPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function getStaffAccessProfileStatusPills(profile = null) {
  const pills = [];
  if (!profile) return pills;
  const pendingSummary = getStaffPendingApprovalSummary(profile);
  if (pendingSummary?.status === "approved") {
    pills.push({ label: "Approved pending sign-in", muted: false });
  } else if (doesStaffAccessProfileHavePendingAccess(profile)) {
    pills.push({ label: "Pending access", muted: false });
  }
  if (pendingSummary?.is_stale) {
    pills.push({ label: "Needs review", muted: false });
  } else if (pendingSummary?.last_failure_reason || pendingSummary?.invalidated_reason || pendingSummary?.has_duplicate_conflicts) {
    pills.push({ label: "Needs review", muted: false });
  }
  if (isStaffAccessProfileRecentlyImported(profile)) {
    pills.push({ label: "Recently imported", muted: true });
  }
  return pills;
}

function getStaffAccessFilteredProfiles() {
  const safeSearch = String(getStaffAccessState()?.search || "").trim().toLowerCase();
  const safeFilter = String(getStaffAccessState()?.filter || "all").trim().toLowerCase();
  const profiles = Array.isArray(getStaffAccessState()?.profiles) ? getStaffAccessState().profiles : [];
  return profiles.filter((profile) => {
    if (safeFilter === "pending_access" && !doesStaffAccessProfileHavePendingAccess(profile)) return false;
    if (safeFilter === "active_access" && !doesStaffAccessProfileHaveActiveAccess(profile)) return false;
    if (safeFilter === "no_role_assigned" && !doesStaffAccessProfileHaveNoRoleAssigned(profile)) return false;
    if (safeFilter === "recently_imported" && !isStaffAccessProfileRecentlyImported(profile)) return false;
    if (!safeSearch) return true;
    const haystack = [
      String(profile?.display_name || ""),
      String(profile?.email || ""),
      String(profile?.external_staff_id || ""),
    ].join(" ").toLowerCase();
    return haystack.includes(safeSearch);
  });
}

function getStaffAccessSelectedRoleSet() {
  return new Set(
    (Array.isArray(getStaffAccessState()?.selectedRoles) ? getStaffAccessState().selectedRoles : [])
      .map((row) => String(row?.role || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

function getStaffAccessSelectedScopesForRole(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  return (Array.isArray(getStaffAccessState()?.selectedScopes) ? getStaffAccessState().selectedScopes : [])
    .filter((row) => String(row?.role || "").trim().toLowerCase() === safeRole);
}

function getStaffAccessScopeSourceClasses() {
  return [...(Array.isArray(state.classes) ? state.classes : [])];
}

function getStaffAccessScopedRoleConfig(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  if (safeRole === "hoy") {
    return {
      role: safeRole,
      primaryScopeType: "year_group",
      primaryLabel: "Year groups",
      primaryScopeHelpText: "Year group scope gives this oversight role visibility across one whole year group.",
      primaryFilterNote: "Classes list narrows to the selected year group.",
      classScopeHelpText: "Class scope gives this oversight role visibility for specific classes only.",
    };
  }
  if (safeRole === "hod") {
    return {
      role: safeRole,
      primaryScopeType: "department",
      primaryLabel: "Departments",
      primaryScopeHelpText: "Department scope gives this oversight role visibility across one department.",
      primaryFilterNote: "Classes list narrows to the selected department.",
      classScopeHelpText: "Class scope gives this oversight role visibility for specific classes only.",
    };
  }
  return null;
}

function getStaffAccessYearGroupOptions() {
  return [...new Set(
    getStaffAccessScopeSourceClasses()
      .map((item) => String(item?.year_group || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function getStaffAccessDepartmentOptions() {
  return [...new Set(
    getStaffAccessScopeSourceClasses()
      .map((item) => String(item?.department_key || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function getStaffAccessClassOptionsLegacyUnused() {
  return getStaffAccessScopeSourceClasses()
    .map((item) => {
      const classId = String(item?.id || "").trim();
      if (!classId) return null;
      const labelParts = [
        String(item?.name || "").trim() || "Untitled class",
        String(item?.year_group || "").trim(),
        getClassTypeDisplayLabel(item?.class_type),
      ].filter(Boolean);
      return {
        value: classId,
        label: labelParts.join(" · "),
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a?.label || "").localeCompare(String(b?.label || "")));
}

function buildStaffAccessClassOption(item = null) {
  const classId = String(item?.id || "").trim();
  if (!classId) return null;
  const labelParts = [
    String(item?.name || "").trim() || "Untitled class",
    String(item?.year_group || "").trim(),
    getClassTypeDisplayLabel(item?.class_type),
  ].filter(Boolean);
  return {
    value: classId,
    label: sanitizeStaffAccessText(labelParts.join(" - ")),
  };
}

function getStaffAccessFilteredClassRecords(role = "", { pendingOverride = null } = {}) {
  const safeRole = String(role || "").trim().toLowerCase();
  const scopedRoleConfig = getStaffAccessScopedRoleConfig(safeRole);
  let rows = getStaffAccessScopeSourceClasses();
  if (!scopedRoleConfig) return rows;

  const pending = pendingOverride && typeof pendingOverride === "object"
    ? pendingOverride
    : (getStaffAccessState()?.pendingScopeSelections?.[safeRole] || {});
  const primaryValue = String(pending?.[scopedRoleConfig.primaryScopeType] || "").trim();
  if (!primaryValue) return rows;

  if (scopedRoleConfig.primaryScopeType === "year_group") {
    return rows.filter((item) => String(item?.year_group || "").trim() === primaryValue);
  }
  if (scopedRoleConfig.primaryScopeType === "department") {
    return rows.filter((item) => String(item?.department_key || "").trim() === primaryValue);
  }
  return rows;
}

function getStaffAccessClassOptions({ role = "", applyPendingFilters = false, pendingOverride = null } = {}) {
  const sourceRows = applyPendingFilters
    ? getStaffAccessFilteredClassRecords(role, { pendingOverride })
    : getStaffAccessScopeSourceClasses();
  return sourceRows
    .map((item) => buildStaffAccessClassOption(item))
    .filter(Boolean)
    .sort((a, b) => String(a?.label || "").localeCompare(String(b?.label || "")));
}

function getStaffAccessRoleLabel(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  if (safeRole === "teacher") return "Teacher";
  if (safeRole === "admin") return "Admin";
  if (safeRole === "hoy") return "HOY";
  if (safeRole === "hod") return "HOD";
  if (safeRole === "senco") return "SENCO";
  if (safeRole === "literacy_lead") return "Literacy Lead";
  return safeRole || "Role";
}

function getStaffAccessScopeTypeLabel(scopeType = "") {
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  if (safeScopeType === "year_group") return "Year group";
  if (safeScopeType === "department") return "Department";
  if (safeScopeType === "class") return "Class";
  if (safeScopeType === "school") return "School";
  return "Scope";
}

function getStaffAccessScopeLabel(scope = null) {
  if (!scope) return "";
  const scopeType = String(scope?.scope_type || "").trim().toLowerCase();
  const scopeValue = String(scope?.scope_value || "").trim();
  if (scopeType === "school" && scopeValue === "default") return "Schoolwide";
  if (scopeType === "class") {
    const option = getStaffAccessClassOptions().find((item) => item.value === scopeValue);
    return sanitizeStaffAccessText(option?.label || scopeValue || "Class");
  }
  return sanitizeStaffAccessText(scopeValue || getStaffAccessScopeTypeLabel(scopeType));
}

function getStaffAccessAuditActionLabel(action = "") {
  const safeAction = String(action || "").trim().toLowerCase();
  if (safeAction === "grant_role") return "Granted role";
  if (safeAction === "revoke_role") return "Removed role";
  if (safeAction === "grant_scope") return "Added scope";
  if (safeAction === "revoke_scope") return "Removed scope";
  if (safeAction === "bootstrap_admin") return "Bootstrapped admin";
  return "Updated access";
}

function formatStaffAccessDateTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sanitizeStaffAccessText(value = "") {
  return String(value || "")
    .replaceAll("Â·", " - ")
    .replaceAll("â€¢", " - ")
    .replaceAll("â€™", "'")
    .replaceAll("Ã—", "x");
}

function isStaffPendingApprovalAutoScopeRole(role = "") {
  return ["admin", "senco", "literacy_lead"].includes(String(role || "").trim().toLowerCase());
}

function normalizeStaffPendingApprovalDraft(rawValue = null) {
  const value = rawValue && typeof rawValue === "object" ? rawValue : {};
  const roles = [...new Set(
    (Array.isArray(value?.roles) ? value.roles : [])
      .map((item) => String(item || "").trim().toLowerCase())
      .filter((role) => STAFF_ACCESS_MANAGED_ROLES.includes(role))
  )];
  const seenScopes = new Set();
  const scopes = (Array.isArray(value?.scopes) ? value.scopes : [])
    .map((item) => ({
      role: String(item?.role || "").trim().toLowerCase(),
      scope_type: String(item?.scope_type || "").trim().toLowerCase(),
      scope_value: String(item?.scope_value || "").trim(),
    }))
    .filter((item) => item.role && roles.includes(item.role) && item.scope_type && item.scope_value)
    .filter((item) => {
      const key = `${item.role}::${item.scope_type}::${item.scope_value}`;
      if (seenScopes.has(key)) return false;
      seenScopes.add(key);
      return true;
    });
  return {
    roles,
    scopes,
  };
}

function buildStaffPendingApprovalDraftFromDetail(detail = null) {
  const approval = detail?.approval && typeof detail.approval === "object" ? detail.approval : null;
  return normalizeStaffPendingApprovalDraft({
    roles: approval?.pending_roles || [],
    scopes: approval?.pending_scopes || [],
  });
}

function getStaffPendingApprovalDraft() {
  return normalizeStaffPendingApprovalDraft(getStaffAccessState()?.pendingApprovalDraft);
}

function getStaffPendingApprovalDraftRoleSet() {
  return new Set(getStaffPendingApprovalDraft().roles);
}

function getStaffPendingApprovalDraftScopesForRole(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  return getStaffPendingApprovalDraft().scopes
    .filter((item) => item.role === safeRole);
}

function getStaffPendingApprovalDraftScopeValueSet(role = "", scopeType = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  return new Set(
    getStaffPendingApprovalDraftScopesForRole(safeRole)
      .filter((item) => item.scope_type === safeScopeType)
      .map((item) => item.scope_value)
  );
}

function setStaffPendingApprovalDraft(nextDraft = null) {
  state.staffAccess.pendingApprovalDraft = normalizeStaffPendingApprovalDraft(nextDraft);
}

function toggleStaffPendingApprovalDraftRole(role = "", checked = false) {
  const safeRole = String(role || "").trim().toLowerCase();
  if (!STAFF_ACCESS_MANAGED_ROLES.includes(safeRole)) return;
  const draft = getStaffPendingApprovalDraft();
  const nextRoles = new Set(draft.roles);
  if (checked) nextRoles.add(safeRole);
  else nextRoles.delete(safeRole);

  let nextScopes = draft.scopes.filter((item) => checked || item.role !== safeRole);
  if (checked && isStaffPendingApprovalAutoScopeRole(safeRole)) {
    nextScopes = [...nextScopes, {
      role: safeRole,
      scope_type: "school",
      scope_value: "default",
    }];
  }
  if (!checked) {
    nextScopes = nextScopes.filter((item) => item.role !== safeRole);
  }
  setStaffPendingApprovalDraft({
    roles: [...nextRoles],
    scopes: nextScopes,
  });
}

function toggleStaffPendingApprovalDraftScope(role = "", scopeType = "", scopeValue = "", checked = false) {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  const safeScopeValue = String(scopeValue || "").trim();
  if (!safeRole || !safeScopeType || !safeScopeValue) return;
  const draft = getStaffPendingApprovalDraft();
  const nextRoles = new Set(draft.roles);
  nextRoles.add(safeRole);
  const nextScopes = draft.scopes.filter((item) => !(
    item.role === safeRole
    && item.scope_type === safeScopeType
    && item.scope_value === safeScopeValue
  ));
  if (checked) {
    nextScopes.push({
      role: safeRole,
      scope_type: safeScopeType,
      scope_value: safeScopeValue,
    });
  }
  setStaffPendingApprovalDraft({
    roles: [...nextRoles],
    scopes: nextScopes,
  });
}

function buildStaffPendingApprovalSavePayload() {
  const draft = getStaffPendingApprovalDraft();
  return {
    roles: draft.roles,
    scopes: draft.scopes
      .filter((item) => !(isStaffPendingApprovalAutoScopeRole(item.role) && item.scope_type === "school" && item.scope_value === "default"))
      .map((item) => ({
        role: item.role,
        scope_type: item.scope_type,
        scope_value: item.scope_value,
      })),
  };
}

function getStaffPendingApprovalDraftWarnings() {
  const warnings = [];
  const roleSet = getStaffPendingApprovalDraftRoleSet();
  if (roleSet.has("hoy") && getStaffPendingApprovalDraftScopesForRole("hoy").length === 0) {
    warnings.push("HOY is selected but has no year-group or class scope yet.");
  }
  if (roleSet.has("hod") && getStaffPendingApprovalDraftScopesForRole("hod").length === 0) {
    warnings.push("HOD is selected but has no department or class scope yet.");
  }
  if (roleSet.has("hod") && Number(getAccessContext()?.data_health?.unmapped_subject_class_count || 0) > 0) {
    warnings.push("Some subject classes still need department mapping before HOD coverage will be complete.");
  }
  return warnings;
}

function getStaffPendingApprovalFailureMessage(detail = null) {
  const approval = detail?.approval && typeof detail.approval === "object" ? detail.approval : null;
  return String(approval?.last_failure_reason || approval?.invalidated_reason || "").trim();
}

function getStaffPendingApprovalFilteredClassOptions(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const classRecords = getStaffAccessScopeSourceClasses();
  if (!["hoy", "hod"].includes(safeRole)) {
    return getStaffAccessClassOptions();
  }
  const selectedValues = safeRole === "hoy"
    ? getStaffPendingApprovalDraftScopeValueSet("hoy", "year_group")
    : getStaffPendingApprovalDraftScopeValueSet("hod", "department");
  const filteredRows = selectedValues.size
    ? classRecords.filter((item) => (
      safeRole === "hoy"
        ? selectedValues.has(String(item?.year_group || "").trim())
        : selectedValues.has(String(item?.department_key || "").trim())
    ))
    : classRecords;
  return filteredRows
    .map((item) => buildStaffAccessClassOption(item))
    .filter(Boolean)
    .sort((a, b) => String(a?.label || "").localeCompare(String(b?.label || "")));
}

function syncStaffAccessPendingScopeSelections() {
  const pending = getStaffAccessState()?.pendingScopeSelections || {};
  const yearGroupOptions = getStaffAccessYearGroupOptions();
  const departmentOptions = getStaffAccessDepartmentOptions();
  const assignedHoyYearGroups = [...getStaffAccessAssignedScopeValueSet("hoy", "year_group")]
    .filter((value) => yearGroupOptions.includes(value))
    .sort((a, b) => a.localeCompare(b));
  const assignedHodDepartments = [...getStaffAccessAssignedScopeValueSet("hod", "department")]
    .filter((value) => departmentOptions.includes(value))
    .sort((a, b) => a.localeCompare(b));
  const nextPending = {
    hoy: {
      year_group: yearGroupOptions.includes(String(pending?.hoy?.year_group || ""))
        ? String(pending?.hoy?.year_group || "")
        : String(assignedHoyYearGroups[0] || ""),
      class_ids: [],
    },
    hod: {
      department: departmentOptions.includes(String(pending?.hod?.department || ""))
        ? String(pending?.hod?.department || "")
        : String(assignedHodDepartments[0] || ""),
      class_ids: [],
    },
  };
  const hoyClassOptionIds = new Set(
    getStaffAccessClassOptions({ role: "hoy", applyPendingFilters: true, pendingOverride: nextPending.hoy })
      .map((item) => item.value)
  );
  const hodClassOptionIds = new Set(
    getStaffAccessClassOptions({ role: "hod", applyPendingFilters: true, pendingOverride: nextPending.hod })
      .map((item) => item.value)
  );
  nextPending.hoy.class_ids = nextPending.hoy.year_group
    ? []
    : normalizeIdList(pending?.hoy?.class_ids).filter((classId) => hoyClassOptionIds.has(classId));
  nextPending.hod.class_ids = nextPending.hod.department
    ? []
    : normalizeIdList(pending?.hod?.class_ids).filter((classId) => hodClassOptionIds.has(classId));
  state.staffAccess.pendingScopeSelections = nextPending;
}

function getStaffAccessPendingPrimaryScopeValue(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const scopedRoleConfig = getStaffAccessScopedRoleConfig(safeRole);
  if (!scopedRoleConfig) return "";
  return String(getStaffAccessState()?.pendingScopeSelections?.[safeRole]?.[scopedRoleConfig.primaryScopeType] || "").trim();
}

function getStaffAccessPendingClassIds(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  return normalizeIdList(getStaffAccessState()?.pendingScopeSelections?.[safeRole]?.class_ids);
}

function getStaffAccessAssignedScopeValueSet(role = "", scopeType = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  return new Set(
    getStaffAccessSelectedScopesForRole(safeRole)
      .filter((scope) => String(scope?.scope_type || "").trim().toLowerCase() === safeScopeType)
      .map((scope) => String(scope?.scope_value || "").trim())
      .filter(Boolean)
  );
}

function getStaffAccessScopedRolePendingPlan(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const scopedRoleConfig = getStaffAccessScopedRoleConfig(safeRole);
  if (!scopedRoleConfig) {
    return {
      role: safeRole,
      primaryScopeType: "",
      primaryValue: "",
      classIds: [],
      newPrimaryValues: [],
      newClassIds: [],
      hasSelections: false,
      hasNewScopes: false,
    };
  }

  const primaryScopeType = scopedRoleConfig.primaryScopeType;
  const primaryValue = getStaffAccessPendingPrimaryScopeValue(safeRole);
  const classIds = (safeRole === "hoy" || safeRole === "hod") && primaryValue
    ? []
    : getStaffAccessPendingClassIds(safeRole);
  const availableClassIds = new Set(
    getStaffAccessClassOptions({ role: safeRole, applyPendingFilters: true }).map((item) => item.value)
  );
  const existingPrimaryValues = getStaffAccessAssignedScopeValueSet(safeRole, primaryScopeType);
  const existingClassIds = getStaffAccessAssignedScopeValueSet(safeRole, "class");
  const newPrimaryValues = primaryValue && !existingPrimaryValues.has(primaryValue) ? [primaryValue] : [];
  const newClassIds = classIds
    .filter((classId) => availableClassIds.has(classId))
    .filter((classId) => !existingClassIds.has(classId));

  return {
    role: safeRole,
    primaryScopeType,
    primaryValue,
    classIds,
    newPrimaryValues,
    newClassIds,
    hasSelections: !!primaryValue || classIds.length > 0,
    hasNewScopes: newPrimaryValues.length > 0 || newClassIds.length > 0,
  };
}

function doesStaffAccessPrimaryScopeAutoIncludeClasses(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  return ["hoy", "hod"].includes(safeRole) && !!getStaffAccessPendingPrimaryScopeValue(safeRole);
}

function syncStaffAccessSelectedProfileId() {
  const profiles = Array.isArray(getStaffAccessState()?.profiles) ? getStaffAccessState().profiles : [];
  const visibleProfiles = getStaffAccessFilteredProfiles();
  const selectedProfileId = getStaffAccessSelectedProfileId();
  const currentUserId = getCurrentTeacherId();
  const currentFilter = String(getStaffAccessState()?.filter || "all").trim().toLowerCase();

  if (selectedProfileId && visibleProfiles.some((profile) => String(profile?.id || "").trim() === selectedProfileId)) {
    return selectedProfileId;
  }

  const currentProfile = profiles.find((profile) => String(profile?.user_id || "").trim() === currentUserId) || null;
  if (currentProfile && visibleProfiles.some((profile) => String(profile?.id || "").trim() === String(currentProfile?.id || ""))) {
    state.staffAccess.selectedProfileId = String(currentProfile.id || "").trim();
    return state.staffAccess.selectedProfileId;
  }

  if (currentFilter === "recently_imported" && visibleProfiles.length) {
    state.staffAccess.selectedProfileId = String(visibleProfiles[0]?.id || "").trim();
    return state.staffAccess.selectedProfileId;
  }

  state.staffAccess.selectedProfileId = "";
  return "";
}

function getStaffAccessSetupWarnings() {
  const roleSet = getStaffAccessSelectedRoleSet();
  const warnings = [];
  const selectedProfile = getStaffAccessSelectedProfile();

  if (roleSet.has("hoy") && !getStaffAccessSelectedScopesForRole("hoy").length) {
    warnings.push("HOY is active but has no year-group or class scope yet.");
  }

  if (roleSet.has("hod") && !getStaffAccessSelectedScopesForRole("hod").length) {
    warnings.push("HOD is active but has no department or class scope yet.");
  }

  if (roleSet.has("hod") && Number(getAccessContext()?.data_health?.unmapped_subject_class_count || 0) > 0) {
    warnings.push("Some subject classes still need department mapping before HOD coverage will be complete.");
  }

  if (selectedProfile && !getSelectedStaffAccessTargetUserId()) {
    warnings.push("This directory record is not linked to a signed-in staff account yet. Live roles can be granted after the staff member signs in.");
  }

  return warnings;
}

function canRevokeSelectedAdminRole() {
  const selectedUserId = getSelectedStaffAccessTargetUserId();
  const currentUserId = getCurrentTeacherId();
  if (!selectedUserId || selectedUserId !== currentUserId) return true;
  const activeAdminUserIds = Array.isArray(getStaffAccessState()?.activeAdminUserIds)
    ? getStaffAccessState().activeAdminUserIds
    : [];
  return activeAdminUserIds.length > 1;
}

function isSelectedStaffAccessAdminLastActiveAdmin() {
  const selectedUserId = getSelectedStaffAccessTargetUserId();
  const activeAdminUserIds = Array.isArray(getStaffAccessState()?.activeAdminUserIds)
    ? getStaffAccessState().activeAdminUserIds
    : [];
  return !!selectedUserId && activeAdminUserIds.length <= 1 && activeAdminUserIds.includes(selectedUserId);
}

function getStaffAccessDisplayName(identityValue = "") {
  const safeValue = String(identityValue || "").trim();
  const profile = safeValue
    ? (getStaffAccessProfileMap().get(safeValue) || getStaffAccessProfileByUserIdMap().get(safeValue) || null)
    : null;
  if (String(profile?.display_name || "").trim()) return String(profile.display_name).trim();
  if (String(profile?.email || "").trim()) return String(profile.email).trim();
  return safeValue || "this staff member";
}

function canManageSelectedStaffAccessLiveAccess() {
  return !!getSelectedStaffAccessTargetUserId();
}

function getStaffAccessFilterOptions() {
  return [
    { value: "all", label: "All staff" },
    { value: "pending_access", label: "Pending access" },
    { value: "active_access", label: "Active access" },
    { value: "no_role_assigned", label: "No role assigned" },
    { value: "recently_imported", label: "Recently imported" },
  ];
}

function getStaffAccessImportSuggestionRows(profile = null) {
  const metadata = profile?.import_metadata && typeof profile.import_metadata === "object"
    ? profile.import_metadata
    : {};
  const rows = [];
  const roleSuggestion = String(metadata?.role_suggestion || "").trim();
  const departmentSuggestions = Array.isArray(metadata?.department_suggestion_values) ? metadata.department_suggestion_values : [];
  const yearGroupSuggestions = Array.isArray(metadata?.year_group_suggestion_values) ? metadata.year_group_suggestion_values : [];
  const classSuggestions = Array.isArray(metadata?.class_scope_suggestion_values) ? metadata.class_scope_suggestion_values : [];
  const externalStaffId = String(profile?.external_staff_id || metadata?.external_staff_id || "").trim();
  const notes = String(profile?.notes || metadata?.notes || "").trim();

  if (externalStaffId) {
    rows.push({ label: "External staff ID", value: externalStaffId });
  }
  if (roleSuggestion) {
    rows.push({ label: "Suggested role", value: roleSuggestion });
  }
  if (departmentSuggestions.length) {
    rows.push({ label: "Department suggestion", value: departmentSuggestions.join(", ") });
  }
  if (yearGroupSuggestions.length) {
    rows.push({ label: "Year-group suggestion", value: yearGroupSuggestions.join(", ") });
  }
  if (classSuggestions.length) {
    rows.push({ label: "Class suggestion", value: classSuggestions.join(", ") });
  }
  if (notes) {
    rows.push({ label: "Notes", value: notes });
  }

  return rows;
}

function buildStaffAccessImportPreview() {
  const preview = getStaffAccessState()?.importPreview;
  if (!preview) return null;
  return buildStaffImportCommitPayload(preview);
}

function buildStaffAccessImportPreviewFromText(text = "", fileName = "") {
  const parsedCsv = parseStaffImportCsv(text);
  const preview = buildStaffImportPreview({
    parsedCsv,
    existingProfiles: getStaffAccessState()?.profiles || [],
    activeRoleAssignments: getStaffAccessState()?.directoryRoleAssignments || [],
    yearGroupOptions: getStaffAccessYearGroupOptions(),
    departmentOptions: getStaffAccessDepartmentOptions(),
    classRecords: getStaffAccessScopeSourceClasses(),
  });

  state.staffAccess.importFileName = String(fileName || "").trim();
  state.staffAccess.importPreview = preview;
  state.staffAccess.importPreviewError = "";
  state.staffAccess.importResult = null;

  if (Array.isArray(parsedCsv?.errors) && parsedCsv.errors.length && !preview.rows.length) {
    state.staffAccess.importPreviewError = parsedCsv.errors.join(" ");
  }
}

async function handleStaffAccessCsvFileSelection(file = null) {
  if (!(file instanceof File)) return;
  state.staffAccess.importPreviewLoading = true;
  state.staffAccess.importPreviewError = "";
  paint();

  try {
    const text = await file.text();
    buildStaffAccessImportPreviewFromText(text, file.name || "");
  } catch (error) {
    console.error("staff csv preview error:", error);
    state.staffAccess.importPreview = null;
    state.staffAccess.importPreviewError = error?.message || "Could not read that CSV file.";
  } finally {
    state.staffAccess.importPreviewLoading = false;
    paint();
  }
}

function clearStaffAccessImportPreview() {
  state.staffAccess.importFileName = "";
  state.staffAccess.importPreview = null;
  state.staffAccess.importPreviewError = "";
  state.staffAccess.importPreviewLoading = false;
}

async function handleCommitStaffAccessImport() {
  const preview = getStaffAccessState()?.importPreview;
  if (!preview) {
    showNotice("Choose a CSV file and review the preview first.", "error");
    paint();
    return;
  }

  const importRows = buildStaffAccessImportPreview();
  if (!importRows || !importRows.length || !preview.canCommit) {
    showNotice("There are no safe CSV rows ready to import.", "error");
    paint();
    return;
  }

  state.staffAccess.mutating = true;
  paint();

  try {
    const result = await importStaffDirectoryCsv({
      rows: importRows,
      fileName: getStaffAccessState()?.importFileName || "",
      previewSummary: preview.summary || {},
    });
    state.staffAccess.importResult = result || null;
    state.staffAccess.recentImportBatchId = String(result?.batch_id || "").trim();
    state.staffAccess.filter = "recently_imported";
    state.staffAccess.search = "";
    clearStaffAccessImportPreview();
    await loadStaffAccessDirectory({ preserveSelection: false });
    await syncStaffAccessSelectionForVisibleDirectory();
    if (Number(result?.created_count || 0) > 0) {
      showNotice(
        `Import complete. ${formatStaffAccessCountLabel(result?.created_count || 0, "staff member")} added to Pending access.`,
        "success"
      );
    } else {
      showNotice("Import complete. Staff directory records were updated for review.", "success");
    }
  } catch (error) {
    console.error("staff csv import commit error:", error);
    showNotice(error?.message || "Could not import that CSV.", "error");
  } finally {
    state.staffAccess.mutating = false;
    paint();
  }
}

function getInterventionBuilderPupils() {
  return Array.isArray(state.interventionGroup?.pupils) ? state.interventionGroup.pupils : [];
}

function getInterventionBuilderSelectedPupilIds() {
  return normalizeIdList(state.interventionGroup?.selectedPupilIds);
}

function getInterventionBuilderSelectedPupilMap() {
  const source = state.interventionGroup?.selectedPupilsById;
  return source && typeof source === "object" ? source : {};
}

function getInterventionBuilderSelectedPupils() {
  const selectedIds = getInterventionBuilderSelectedPupilIds();
  const selectedById = getInterventionBuilderSelectedPupilMap();
  return selectedIds
    .map((pupilId) => selectedById[pupilId] || null)
    .filter(Boolean)
    .sort((a, b) => String(a?.display_name || a?.username || "").localeCompare(String(b?.display_name || b?.username || "")));
}

function setInterventionBuilderSelectedPupilIds(nextPupilIds = []) {
  const safeIds = normalizeIdList(nextPupilIds);
  const visibleById = new Map(
    getInterventionBuilderPupils().map((item) => [String(item?.id || "").trim(), item])
  );
  const currentSelectedById = getInterventionBuilderSelectedPupilMap();
  const nextSelectedById = {};
  for (const pupilId of safeIds) {
    const record = visibleById.get(pupilId) || currentSelectedById[pupilId];
    if (record) nextSelectedById[pupilId] = record;
  }
  state.interventionGroup.selectedPupilIds = safeIds;
  state.interventionGroup.selectedPupilsById = nextSelectedById;
}

function toggleInterventionBuilderPupilId(pupilId, checked) {
  const safePupilId = String(pupilId || "").trim();
  if (!safePupilId) return;
  const current = new Set(getInterventionBuilderSelectedPupilIds());
  if (checked) current.add(safePupilId);
  else current.delete(safePupilId);
  state.interventionGroup.selectedPupilIds = [...current];
}

function getInterventionBuilderVisiblePupils() {
  return getInterventionBuilderPupils();
}

function getInterventionBuilderSelectedSummary() {
  const selectedIds = getInterventionBuilderSelectedPupilIds();
  if (!selectedIds.length) return "No pupils selected yet.";
  const selectedPupils = getInterventionBuilderSelectedPupils()
    .map((item) => String(item?.display_name || item?.username || "Unknown pupil").trim() || "Unknown pupil");
  if (selectedPupils.length === 1) return `1 pupil selected: ${selectedPupils[0]}.`;
  const preview = selectedPupils.slice(0, 3).join(", ");
  const extraCount = Math.max(0, selectedPupils.length - 3);
  return `${selectedPupils.length} pupils selected: ${preview}${extraCount ? ` and ${extraCount} more` : ""}.`;
}

function hasMeaningfulInterventionFilters(filters = state.interventionGroup?.filters || {}) {
  return !!(
    String(filters?.yearGroup || "").trim()
    || String(filters?.sourceClassId || "").trim()
    || String(filters?.search || "").trim()
  );
}

function markInterventionFiltersPending() {
  state.interventionGroup.status = "idle";
  state.interventionGroup.resultCount = 0;
  state.interventionGroup.pupils = [];
  state.interventionGroup.message = hasMeaningfulInterventionFilters()
    ? "Apply filters to load matching pupils."
    : "Choose a filter to find pupils.";
}

function sortAutomationRunClassIds(classIds = []) {
  const classesById = new Map((state.classes || []).map((item) => [String(item?.id || "").trim(), item]));
  return normalizeIdList(classIds).sort((a, b) => {
    const aClass = classesById.get(a) || null;
    const bClass = classesById.get(b) || null;
    const aRank = getNormalizedClassType(aClass?.class_type) === CLASS_TYPE_INTERVENTION ? 0 : 1;
    const bRank = getNormalizedClassType(bClass?.class_type) === CLASS_TYPE_INTERVENTION ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return String(aClass?.name || "").localeCompare(String(bClass?.name || ""));
  });
}

function normalizeIdList(items = []) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )];
}

function normalizeAutomationTargetFilters(rawFilters = null) {
  const source = rawFilters && typeof rawFilters === "object" ? rawFilters : {};
  const classType = String(source.classType || "all").trim().toLowerCase();
  return {
    yearGroup: String(source.yearGroup || "").trim(),
    classType: [CLASS_TYPE_FORM, CLASS_TYPE_INTERVENTION, "all"].includes(classType) ? classType : "all",
  };
}

function getAutomationTargetFilters() {
  return getCurrentAutomationDraftEntry().targetFilters;
}

function buildAutomationPolicyDraftStorageKey() {
  const teacherId = String(state.user?.id || "").trim();
  return teacherId ? `${AUTOMATION_POLICY_DRAFT_STORAGE_PREFIX}:${teacherId}` : "";
}

function clearAutomationPolicyDraftStorage() {
  const storageKey = buildAutomationPolicyDraftStorageKey();
  if (!storageKey) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn("Could not clear automation policy draft storage:", error);
  }
}

function getAutomationPolicies() {
  return [...(Array.isArray(state.automationPolicies) ? state.automationPolicies : [])]
    .map((item) => normalizePersonalisedAutomationPolicy(item))
    .sort((a, b) => {
      const rankByState = {
        expiring_soon: 0,
        live: 1,
        scheduled: 2,
        expired: 3,
        archived: 4,
      };
      const aRank = rankByState[getPersonalisedAutomationPolicyLifecycle(a).state] ?? 99;
      const bRank = rankByState[getPersonalisedAutomationPolicyLifecycle(b).state] ?? 99;
      if (aRank !== bRank) return aRank - bRank;
      const aUpdated = new Date(a?.updated_at || a?.created_at || 0).getTime();
      const bUpdated = new Date(b?.updated_at || b?.created_at || 0).getTime();
      if (aUpdated !== bUpdated) return bUpdated - aUpdated;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
}

function getSavedAutomationPolicyById(policyId = "") {
  const safePolicyId = String(policyId || "").trim();
  if (!safePolicyId) return null;
  return getAutomationPolicies().find((item) => String(item?.id || "").trim() === safePolicyId) || null;
}

function getAutomationPolicyDisplayName(policy, fallback = "Untitled policy") {
  const name = String(policy?.name || "").trim();
  return name || fallback;
}

function getAutomationPolicyStatusBadgeMeta(policy, { isDraft = false } = {}) {
  if (isDraft) {
    return {
      label: "Draft",
      className: "is-draft",
    };
  }

  const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy);
  if (lifecycle.archived) {
    return { label: "Archived", className: "is-archived" };
  }
  if (lifecycle.expired) {
    return { label: "Expired", className: "is-expired" };
  }
  if (lifecycle.expiringSoon) {
    return { label: "Expiring soon", className: "is-expiring" };
  }
  if (lifecycle.scheduled) {
    return { label: "Scheduled", className: "is-scheduled" };
  }
  return { label: "Live", className: "is-live" };
}

function getAutomationPolicyLifecycleNote(policy) {
  const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy);
  if (lifecycle.archived) {
    return "Archived policies stay visible for review and can be restored later.";
  }
  if (lifecycle.expired) {
    return `This policy expired on ${formatShortDate(policy?.end_date)} and is now review-only until you extend, archive, or delete it.`;
  }
  if (lifecycle.scheduled) {
    return `This policy becomes usable on ${formatShortDate(policy?.start_date)}.`;
  }
  if (lifecycle.expiringSoon && policy?.end_date) {
    const daysLabel = lifecycle.daysUntilExpiry === 0
      ? "today"
      : (lifecycle.daysUntilExpiry === 1 ? "in 1 day" : `in ${lifecycle.daysUntilExpiry} days`);
    return `This policy expires ${daysLabel} on ${formatShortDate(policy.end_date)}.`;
  }
  if (policy?.end_date) {
    return `This policy remains usable until ${formatShortDate(policy.end_date)}.`;
  }
  return "This policy stays usable until you archive it or add an end date.";
}

function buildAutomationPolicyAlertEntries() {
  return getAutomationPolicies()
    .map((policy) => {
      const policyId = String(policy?.id || "").trim();
      const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy);
      if (!policyId || lifecycle.archived || (!lifecycle.expired && !lifecycle.expiringSoon)) {
        return null;
      }
      return {
        policy,
        lifecycle,
        policyId,
        title: lifecycle.expired
          ? `${getAutomationPolicyDisplayName(policy)} expired`
          : `${getAutomationPolicyDisplayName(policy)} expires soon`,
        message: lifecycle.expired
          ? `This policy ended on ${formatShortDate(policy?.end_date)} and no longer behaves as a live policy.`
          : `This policy ends on ${formatShortDate(policy?.end_date)}. Extend the dates if it should stay usable.`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.lifecycle.expired !== b.lifecycle.expired) return a.lifecycle.expired ? -1 : 1;
      return Number(a.lifecycle.daysUntilExpiry ?? Number.POSITIVE_INFINITY)
        - Number(b.lifecycle.daysUntilExpiry ?? Number.POSITIVE_INFINITY);
    });
}

function buildAutomationDraftEntry(rawDraft = null, { basePolicy = null } = {}) {
  const source = rawDraft && typeof rawDraft === "object" ? rawDraft : {};
  const policySource = source.policy && typeof source.policy === "object"
    ? source.policy
    : {};
  const base = basePolicy && typeof basePolicy === "object"
    ? basePolicy
    : buildDefaultPersonalisedAutomationPolicy();
  const policy = normalizePersonalisedAutomationPolicy({
    ...base,
    ...policySource,
  });
  const targetFiltersTouched = source.targetFiltersTouched === true;
  return {
    policy,
    dirty: source.dirty === true,
    targetFilters: targetFiltersTouched
      ? normalizeAutomationTargetFilters(source.targetFilters)
      : deriveAutomationTargetFiltersFromPolicy(policy),
    targetFiltersTouched,
    duplicateSourcePolicyId: String(source.duplicateSourcePolicyId || "").trim(),
  };
}

function createDefaultAutomationActionState() {
  return {
    mode: "idle",
    policyKey: "",
    statusMessage: "",
  };
}

function getAutomationActionState() {
  const current = state.automationAction && typeof state.automationAction === "object"
    ? state.automationAction
    : {};
  const mode = ["idle", "saving", "saving_and_running", "running"].includes(current.mode)
    ? current.mode
    : "idle";
  return {
    mode,
    policyKey: String(current.policyKey || "").trim(),
    statusMessage: String(current.statusMessage || "").trim(),
  };
}

function setAutomationActionState(nextState = null) {
  const next = nextState && typeof nextState === "object" ? nextState : {};
  state.automationAction = {
    ...createDefaultAutomationActionState(),
    ...next,
    policyKey: String(next.policyKey || "").trim(),
    statusMessage: String(next.statusMessage || "").trim(),
  };
}

function clearAutomationActionState() {
  state.automationAction = createDefaultAutomationActionState();
}

function isAutomationActionBusyMode(mode = "idle") {
  return mode !== "idle";
}

function isAutomationRunMode(mode = "idle") {
  return mode === "saving_and_running" || mode === "running";
}

function resolveAutomationActionPolicyKey(
  policy = null,
  fallbackKey = getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY,
) {
  const policyId = String(policy?.id || "").trim();
  const safeFallback = String(fallbackKey || "").trim();
  return policyId || safeFallback || AUTOMATION_NEW_POLICY_KEY;
}

function getAutomationActionModeForPolicy(policyKey = getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY) {
  const current = getAutomationActionState();
  const safePolicyKey = String(policyKey || "").trim();
  if (!safePolicyKey || current.policyKey !== safePolicyKey) return "idle";
  return current.mode;
}

function getSelectedAutomationActionMode() {
  return getAutomationActionModeForPolicy(getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY);
}

function isSelectedAutomationPolicyBusy() {
  return isAutomationActionBusyMode(getSelectedAutomationActionMode());
}

function isSelectedAutomationPolicyRunActive() {
  return isAutomationRunMode(getSelectedAutomationActionMode());
}

function getAutomationActionStatusMessageForPolicy(policyKey = getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY) {
  const current = getAutomationActionState();
  const safePolicyKey = String(policyKey || "").trim();
  if (!safePolicyKey || current.policyKey !== safePolicyKey) return "";
  return current.statusMessage;
}

function getSelectedAutomationActionStatusMessage() {
  return getAutomationActionStatusMessageForPolicy(getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY);
}

function isAnyAutomationPolicyBusy() {
  return isAutomationActionBusyMode(getAutomationActionState().mode);
}

function showAutomationPolicyBusyNotice(
  message = "Wait for the current automation policy action to finish before changing this screen.",
) {
  showNotice(message, "info");
  paint();
}

function buildPersistableAutomationDrafts() {
  return Object.fromEntries(
    Object.entries(state.automationDraftsByKey || {})
      .map(([key, value]) => {
        const entry = buildAutomationDraftEntry(value);
        if (!entry.dirty && key !== AUTOMATION_NEW_POLICY_KEY) return null;
        if (
          key === AUTOMATION_NEW_POLICY_KEY
          && !entry.dirty
          && !String(entry?.policy?.name || "").trim()
          && !String(entry?.policy?.description || "").trim()
          && !(entry?.policy?.target_class_ids || []).length
        ) {
          return null;
        }
        return [key, entry];
      })
      .filter(Boolean)
  );
}

function persistAutomationPolicyDraft() {
  if (!isCentralOwnerAppRole()) return;
  const storageKey = buildAutomationPolicyDraftStorageKey();
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({
      selectedPolicyKey: state.automationSelectedPolicyKey || "",
      draftsByKey: buildPersistableAutomationDrafts(),
    }));
  } catch (error) {
    console.warn("Could not persist automation policy draft:", error);
  }
}

function restoreAutomationPolicyDraft() {
  if (!isCentralOwnerAppRole()) return;
  const storageKey = buildAutomationPolicyDraftStorageKey();
  if (!storageKey) return;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    const draftsByKey = parsed.draftsByKey && typeof parsed.draftsByKey === "object"
      ? parsed.draftsByKey
      : {};
    state.automationDraftsByKey = Object.fromEntries(
      Object.entries(draftsByKey)
        .map(([key, value]) => [key, buildAutomationDraftEntry(value)])
    );
    state.automationSelectedPolicyKey = String(parsed.selectedPolicyKey || "").trim();
  } catch (error) {
    console.warn("Could not restore automation policy draft:", error);
  }
}

function getAutomationSelectedPolicyKey() {
  const savedPolicies = getAutomationPolicies();
  const savedIds = new Set(savedPolicies.map((item) => String(item?.id || "").trim()).filter(Boolean));
  const requestedKey = String(state.automationSelectedPolicyKey || "").trim();
  if (requestedKey === AUTOMATION_NEW_POLICY_KEY && state.automationDraftsByKey?.[AUTOMATION_NEW_POLICY_KEY]) {
    return AUTOMATION_NEW_POLICY_KEY;
  }
  if (savedIds.has(requestedKey)) return requestedKey;
  if (state.automationDraftsByKey?.[AUTOMATION_NEW_POLICY_KEY]?.dirty) return AUTOMATION_NEW_POLICY_KEY;
  return String(savedPolicies[0]?.id || "").trim();
}

function getAutomationRunPolicy() {
  return getCurrentAutomationDraftEntry().policy;
}

function getCurrentAutomationDraftEntry() {
  const selectedKey = getAutomationSelectedPolicyKey();
  const existing = state.automationDraftsByKey?.[selectedKey];
  if (existing) {
    const basePolicy = selectedKey === AUTOMATION_NEW_POLICY_KEY
      ? buildDefaultPersonalisedAutomationPolicy()
      : (getSavedAutomationPolicyById(selectedKey) || buildDefaultPersonalisedAutomationPolicy());
    const normalized = buildAutomationDraftEntry(existing, { basePolicy });
    state.automationDraftsByKey[selectedKey] = normalized;
    return normalized;
  }

  const basePolicy = selectedKey === AUTOMATION_NEW_POLICY_KEY
    ? buildDefaultPersonalisedAutomationPolicy()
    : (getSavedAutomationPolicyById(selectedKey) || buildDefaultPersonalisedAutomationPolicy());
  const nextEntry = buildAutomationDraftEntry(null, { basePolicy });
  state.automationDraftsByKey[selectedKey || AUTOMATION_NEW_POLICY_KEY] = nextEntry;
  if (!selectedKey) {
    state.automationSelectedPolicyKey = AUTOMATION_NEW_POLICY_KEY;
  }
  return nextEntry;
}

function getAutomationPolicyDirty() {
  return !!getCurrentAutomationDraftEntry().dirty;
}

function getSavedAutomationPolicy(policyId = getAutomationSelectedPolicyKey()) {
  return getSavedAutomationPolicyById(policyId);
}

function setAutomationPolicies(policies = []) {
  state.automationPolicies = [...(Array.isArray(policies) ? policies : [])]
    .map((item) => normalizePersonalisedAutomationPolicy(item))
    .filter(Boolean);

  const nextDrafts = {};
  const savedPoliciesById = new Map(
    state.automationPolicies.map((item) => [String(item?.id || "").trim(), item])
  );

  for (const [key, value] of Object.entries(state.automationDraftsByKey || {})) {
    if (key === AUTOMATION_NEW_POLICY_KEY) {
      nextDrafts[key] = buildAutomationDraftEntry(value, {
        basePolicy: buildDefaultPersonalisedAutomationPolicy(),
      });
      continue;
    }
    const savedPolicy = savedPoliciesById.get(key);
    if (!savedPolicy) continue;
    nextDrafts[key] = buildAutomationDraftEntry(value, { basePolicy: savedPolicy });
  }

  state.automationDraftsByKey = nextDrafts;
  state.automationSelectedPolicyKey = getAutomationSelectedPolicyKey();
}

function markCurrentAutomationPolicySaved(
  savedPolicy = null,
  {
    previousKey = getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY,
    previousEntry = getCurrentAutomationDraftEntry(),
  } = {},
) {
  const normalized = savedPolicy ? normalizePersonalisedAutomationPolicy(savedPolicy) : null;
  const safePreviousKey = String(previousKey || "").trim() || AUTOMATION_NEW_POLICY_KEY;
  const policies = getAutomationPolicies().filter((item) => String(item?.id || "").trim() !== String(normalized?.id || "").trim());
  if (normalized) {
    policies.push(normalized);
  }
  state.automationPolicies = policies;

  if (safePreviousKey && state.automationDraftsByKey?.[safePreviousKey]) {
    delete state.automationDraftsByKey[safePreviousKey];
  }
  if (normalized?.id) {
    state.automationDraftsByKey[normalized.id] = buildAutomationDraftEntry({
      policy: normalized,
      dirty: false,
      targetFilters: previousEntry?.targetFilters || createDefaultAutomationTargetFilters(),
      targetFiltersTouched: previousEntry?.targetFiltersTouched === true,
    }, { basePolicy: normalized });
    state.automationSelectedPolicyKey = normalized.id;
  } else {
    state.automationSelectedPolicyKey = getAutomationSelectedPolicyKey();
  }
  persistAutomationPolicyDraft();
}

function selectAutomationPolicy(policyId = "") {
  const safePolicyId = String(policyId || "").trim();
  if (!safePolicyId) return;
  state.automationSelectedPolicyKey = safePolicyId;
  getCurrentAutomationDraftEntry();
  persistAutomationPolicyDraft();
}

function createBlankAutomationPolicyDraft() {
  return normalizePersonalisedAutomationPolicy({
    ...buildDefaultPersonalisedAutomationPolicy(),
    active: false,
    target_class_ids: [],
  });
}

function startNewAutomationPolicyDraft({ policy = null, duplicateSourcePolicyId = "" } = {}) {
  const basePolicy = policy && typeof policy === "object"
    ? policy
    : createBlankAutomationPolicyDraft();
  state.automationDraftsByKey = {
    ...state.automationDraftsByKey,
    [AUTOMATION_NEW_POLICY_KEY]: buildAutomationDraftEntry({
      policy: {
        ...basePolicy,
        id: "",
      },
      dirty: true,
      targetFilters: createDefaultAutomationTargetFilters(),
      targetFiltersTouched: false,
      duplicateSourcePolicyId,
    }, {
      basePolicy: buildDefaultPersonalisedAutomationPolicy(),
    }),
  };
  state.automationSelectedPolicyKey = AUTOMATION_NEW_POLICY_KEY;
  persistAutomationPolicyDraft();
}

function discardNewAutomationPolicyDraft() {
  if (state.automationDraftsByKey?.[AUTOMATION_NEW_POLICY_KEY]) {
    delete state.automationDraftsByKey[AUTOMATION_NEW_POLICY_KEY];
  }
  state.automationSelectedPolicyKey = String(getAutomationPolicies()[0]?.id || "").trim();
  persistAutomationPolicyDraft();
}

function discardCurrentAutomationPolicyChanges() {
  const selectedKey = getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY;
  if (selectedKey === AUTOMATION_NEW_POLICY_KEY) {
    discardNewAutomationPolicyDraft();
    return;
  }
  const savedPolicy = getSavedAutomationPolicyById(selectedKey);
  if (!savedPolicy) return;
  state.automationDraftsByKey = {
    ...state.automationDraftsByKey,
    [selectedKey]: buildAutomationDraftEntry({
      policy: savedPolicy,
      dirty: false,
      targetFilters: deriveAutomationTargetFiltersFromPolicy(savedPolicy),
      targetFiltersTouched: false,
      duplicateSourcePolicyId: "",
    }, { basePolicy: savedPolicy }),
  };
  persistAutomationPolicyDraft();
}

function setAutomationRunPolicy(nextPolicy = null) {
  const selectedKey = getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY;
  const currentEntry = getCurrentAutomationDraftEntry();
  const safeNextPolicy = nextPolicy && typeof nextPolicy === "object" ? nextPolicy : {};
  const nextTargetClassIds = Object.prototype.hasOwnProperty.call(safeNextPolicy, "target_class_ids")
    ? safeNextPolicy.target_class_ids
    : currentEntry.policy.target_class_ids;
  state.automationDraftsByKey = {
    ...state.automationDraftsByKey,
    [selectedKey]: buildAutomationDraftEntry({
      ...currentEntry,
      policy: {
        ...currentEntry.policy,
        ...safeNextPolicy,
        target_class_ids: nextTargetClassIds,
      },
      dirty: true,
    }, {
      basePolicy: selectedKey === AUTOMATION_NEW_POLICY_KEY
        ? buildDefaultPersonalisedAutomationPolicy()
        : (getSavedAutomationPolicyById(selectedKey) || buildDefaultPersonalisedAutomationPolicy()),
    }),
  };
  persistAutomationPolicyDraft();
}

function scrollAutomationPolicyViewToTop({ behavior = "auto" } = {}) {
  requestAnimationFrame(() => {
    rootEl
      ?.querySelector('.td-create-class-inline.is-open .td-automation-manager')
      ?.scrollIntoView?.({ block: "start", behavior });
  });
}

function getAutomationRunSelectedClassIds() {
  const availableIds = new Set(getAutomationEligibleClasses().map((item) => String(item?.id || "").trim()).filter(Boolean));
  return normalizeIdList(getAutomationRunPolicy()?.target_class_ids || []).filter((classId) => availableIds.has(classId));
}

function setAutomationRunSelectedClassIds(nextClassIds = []) {
  const filteredIds = sortAutomationRunClassIds(
    normalizeIdList(nextClassIds)
      .filter((classId) => getAutomationEligibleClasses().some((item) => String(item?.id || "").trim() === classId))
  );
  setAutomationRunPolicy({ target_class_ids: filteredIds });
}

function toggleAutomationRunSelectedClassId(classId, checked) {
  const safeClassId = String(classId || "").trim();
  if (!safeClassId) return;
  const current = new Set(getAutomationRunSelectedClassIds());
  if (checked) current.add(safeClassId);
  else current.delete(safeClassId);
  setAutomationRunSelectedClassIds([...current]);
}

function setAutomationTargetFilters(nextFilters = null) {
  const selectedKey = getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY;
  const currentEntry = getCurrentAutomationDraftEntry();
  state.automationDraftsByKey = {
    ...state.automationDraftsByKey,
    [selectedKey]: buildAutomationDraftEntry({
      ...currentEntry,
      targetFilters: {
        ...currentEntry.targetFilters,
        ...(nextFilters && typeof nextFilters === "object" ? nextFilters : {}),
      },
      targetFiltersTouched: true,
    }, {
      basePolicy: selectedKey === AUTOMATION_NEW_POLICY_KEY
        ? buildDefaultPersonalisedAutomationPolicy()
        : (getSavedAutomationPolicyById(selectedKey) || buildDefaultPersonalisedAutomationPolicy()),
    }),
  };
  persistAutomationPolicyDraft();
}

function getFilteredAutomationEligibleClasses() {
  const filters = getAutomationTargetFilters();
  return getAutomationEligibleClasses().filter((item) => {
    const yearGroup = String(item?.year_group || "").trim();
    const classType = getNormalizedClassType(item?.class_type, { legacyFallback: CLASS_TYPE_FORM });
    if (filters.yearGroup && filters.yearGroup !== yearGroup) return false;
    if (filters.classType !== "all" && filters.classType !== classType) return false;
    return true;
  });
}

function getAutomationRunPolicyValidation() {
  const policy = normalizePersonalisedAutomationPolicy({
    ...getAutomationRunPolicy(),
    target_class_ids: getAutomationRunSelectedClassIds(),
  });
  const errors = [];
  const selectedClassIds = getAutomationRunSelectedClassIds();

  if (!String(policy.name || "").trim()) {
    errors.push("Give this automation policy a name.");
  }
  if (!policy.selected_weekdays.length) {
    errors.push("Choose at least one weekday.");
  }
  if (
    policy.frequency === "fortnightly"
    && !policy.selected_weekdays_week_1.length
    && !policy.selected_weekdays_week_2.length
  ) {
    errors.push("Choose at least one release day in week 1 or week 2.");
  }
  if (!String(policy.start_date || "").trim()) {
    errors.push("Choose a start date.");
  }
  if (policy.end_date && policy.end_date < policy.start_date) {
    errors.push("End date must be on or after the start date.");
  }
  if (!String(policy.archived_at || "").trim() && selectedClassIds.length) {
    const overlappingPolicies = getAutomationPolicies()
      .filter((item) => {
        const itemId = String(item?.id || "").trim();
        const policyId = String(policy?.id || "").trim();
        return itemId
          && itemId !== policyId
          && doPersonalisedAutomationPolicyWindowsOverlap(policy, item);
      })
      .map((item) => ({
        policy: item,
        classIds: normalizeIdList(item?.target_class_ids || []),
      }))
      .filter((item) => item.classIds.some((classId) => selectedClassIds.includes(classId)));
    if (overlappingPolicies.length) {
      const classesById = new Map(getAutomationEligibleClasses().map((item) => [String(item?.id || "").trim(), item]));
      const overlapLabels = [...new Set(
        overlappingPolicies.flatMap((item) =>
          item.classIds
            .filter((classId) => selectedClassIds.includes(classId))
            .map((classId) => String(classesById.get(classId)?.name || "Untitled group").trim() || "Untitled group")
        )
      )];
      const policyLabels = [...new Set(
        overlappingPolicies.map((item) => getAutomationPolicyDisplayName(item.policy))
      )];
      errors.push(
        `These target groups are already used by ${policyLabels.length === 1 ? `policy "${policyLabels[0]}"` : "other policies"} during overlapping date windows: ${overlapLabels.join(", ")}. Adjust the dates or targets before saving.`
      );
    }
  }

  return {
    policy,
    errors,
  };
}

function getSavedAutomationRunReadyState() {
  const { policy, errors } = getAutomationRunPolicyValidation();
  const selectedClassIds = sortAutomationRunClassIds(policy?.target_class_ids || []);
  const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy);
  if (errors.length) {
    return {
      ready: false,
      actionLabel: "Run now",
      message: errors[0],
    };
  }
  if (!selectedClassIds.length) {
    return {
      ready: false,
      actionLabel: "Run now",
      message: "Choose at least one form or intervention group before you run this policy.",
    };
  }
  if (lifecycle.archived) {
    return {
      ready: false,
      actionLabel: "Run now",
      message: "Restore this policy before you run it.",
    };
  }
  if (lifecycle.expired) {
    return {
      ready: false,
      actionLabel: "Run now",
      message: `This policy expired on ${formatShortDate(policy?.end_date)}. Extend its dates before you run it.`,
    };
  }
  if (lifecycle.scheduled) {
    return {
      ready: false,
      actionLabel: "Run now",
      message: `This policy is scheduled to start on ${formatShortDate(policy?.start_date)}.`,
    };
  }
  return {
    ready: true,
    actionLabel: getAutomationPolicyDirty() || !String(policy?.id || "").trim()
      ? "Save and run now"
      : "Run now",
    message: getAutomationPolicyDirty() || !String(policy?.id || "").trim()
      ? "Save and run now will save this policy first, then run it."
      : `Run now will use the saved settings from "${getAutomationPolicyDisplayName(policy)}".`,
  };
}

function getAutomationPolicyTargetLabels(targetIds = []) {
  const eligibleById = new Map(
    getAutomationEligibleClasses().map((item) => [String(item?.id || "").trim(), item])
  );
  return normalizeIdList(targetIds)
    .map((classId) => eligibleById.get(classId) || null)
    .filter(Boolean)
    .map((item) => String(item?.name || "Untitled class").trim() || "Untitled class");
}

function getAutomationPolicyTargetSummary(targetIds = []) {
  const labels = getAutomationPolicyTargetLabels(targetIds);
  if (!labels.length) return "No target groups selected yet.";
  if (labels.length === 1) return `1 target group: ${labels[0]}.`;
  const preview = labels.slice(0, 3).join(", ");
  const extraCount = Math.max(0, labels.length - 3);
  return `${labels.length} target groups: ${preview}${extraCount ? ` and ${extraCount} more` : ""}.`;
}

function getAutomationPolicyDueDatePreview(policy) {
  const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy);
  if (lifecycle.archived) {
    return "Archived policies stay visible for review but are not available for run now.";
  }
  if (lifecycle.expired) {
    return `This policy expired on ${formatShortDate(policy?.end_date)} and cannot run until you extend its dates.`;
  }
  if (lifecycle.scheduled) {
    return `This policy is scheduled to start on ${formatShortDate(policy?.start_date)}. Run now becomes available then.`;
  }
  const { deadline, nextRelease } = derivePersonalisedAutomationDeadline(policy, { from: new Date() });
  const deadlineLabel = formatShortDate(deadline);
  if (nextRelease) {
    return `If you run now, the deadline will be ${deadlineLabel}, before the next scheduled release on ${formatShortDate(nextRelease)}.`;
  }
  return `If you run now, the deadline will be ${deadlineLabel} using the cadence fallback rule.`;
}

function joinAutomationSummaryParts(parts = []) {
  return (Array.isArray(parts) ? parts : [])
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" · ");
}

function formatAutomationCompactDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function getAutomationPolicyCompactMetaLine(policy, { savedAt = "", isDraft = false } = {}) {
  const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy);
  const parts = [];

  if (lifecycle.archived) {
    parts.push("Archived");
  } else if (lifecycle.scheduled && policy?.start_date) {
    parts.push(`Starts ${formatShortDate(policy.start_date)}`);
  } else if (lifecycle.expired && policy?.end_date) {
    parts.push(`Ended ${formatShortDate(policy.end_date)}`);
  } else if (policy?.end_date) {
    parts.push(`Ends ${formatShortDate(policy.end_date)}`);
  } else if (policy?.start_date) {
    parts.push(`Starts ${formatShortDate(policy.start_date)}`);
  }

  if (savedAt) {
    parts.push(`Last saved ${formatShortDate(savedAt)}`);
  } else if (isDraft || !String(policy?.id || "").trim()) {
    parts.push("Not saved yet");
  }

  return joinAutomationSummaryParts(parts);
}

function getAutomationPolicyCompactStateLabel(policy, { isDraft = false } = {}) {
  if (isDraft) return "Draft";

  const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy);
  if (lifecycle.archived) return "Archived";
  if (lifecycle.expired) return "Expired";
  if (lifecycle.scheduled) return "Scheduled";
  if (lifecycle.expiringSoon) return "Ends soon";
  return "";
}

function getAutomationPolicyCompactDateRange(policy) {
  const startLabel = formatAutomationCompactDate(policy?.start_date);
  const endLabel = formatAutomationCompactDate(policy?.end_date);

  if (startLabel && endLabel) return `${startLabel}-${endLabel}`;
  if (startLabel) return `From ${startLabel}`;
  if (endLabel) return `Ends ${endLabel}`;
  return "";
}

function getAutomationSupportPresetShortDescription(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "independent_first") {
    return "Keeps tests as independent as possible.";
  }
  if (normalized === "more_support_when_needed") {
    return "Adds support sooner when evidence is limited.";
  }
  return "Normal mix of independent and supported items.";
}

function openDashboardSection(sectionKey) {
  for (const key of DASHBOARD_SECTION_KEYS) {
    state.sections[key] = key === sectionKey;
  }
  if (sectionKey !== "analytics") {
    state.analyticsAssistant.open = false;
  }
}

function getAssignmentResultsContextKey(value) {
  return String(value || "default");
}

function getVisiblePupilRowCount(contextKey, total) {
  const key = getAssignmentResultsContextKey(contextKey);
  const saved = Number(state.assignmentResultsUi.visiblePupilRows[key] || ASSIGNMENT_PUPIL_ROWS_STEP);
  return Math.max(ASSIGNMENT_PUPIL_ROWS_STEP, Math.min(Number(total || 0), saved));
}

function isPupilRowExpanded(contextKey, pupilId) {
  const key = getAssignmentResultsContextKey(contextKey);
  const rowKey = String(pupilId || "");
  return !!state.assignmentResultsUi.expandedPupilRows[key]?.[rowKey];
}

function togglePupilRowExpanded(contextKey, pupilId) {
  const key = getAssignmentResultsContextKey(contextKey);
  const rowKey = String(pupilId || "");
  const current = { ...(state.assignmentResultsUi.expandedPupilRows[key] || {}) };
  if (current[rowKey]) {
    delete current[rowKey];
  } else {
    current[rowKey] = true;
  }
  state.assignmentResultsUi.expandedPupilRows = {
    ...state.assignmentResultsUi.expandedPupilRows,
    [key]: current,
  };
}

function showMorePupilRows(contextKey, total) {
  const key = getAssignmentResultsContextKey(contextKey);
  const current = getVisiblePupilRowCount(key, total);
  state.assignmentResultsUi.visiblePupilRows = {
    ...state.assignmentResultsUi.visiblePupilRows,
    [key]: Math.min(Number(total || 0), current + ASSIGNMENT_PUPIL_ROWS_STEP),
  };
}

function resetVisiblePupilRows(contextKey) {
  const key = getAssignmentResultsContextKey(contextKey);
  state.assignmentResultsUi.visiblePupilRows = {
    ...state.assignmentResultsUi.visiblePupilRows,
    [key]: ASSIGNMENT_PUPIL_ROWS_STEP,
  };
}

function getClassResultsRangeKey(classId) {
  const key = String(classId || "");
  const saved = String(state.classResultsUi.rangeByClass[key] || CLASS_RESULTS_RANGE_DEFAULT);
  return CLASS_RESULTS_RANGE_OPTIONS.some((item) => item.key === saved) ? saved : CLASS_RESULTS_RANGE_DEFAULT;
}

function setClassResultsRangeKey(classId, rangeKey) {
  const key = String(classId || "");
  const next = CLASS_RESULTS_RANGE_OPTIONS.some((item) => item.key === rangeKey)
    ? rangeKey
    : CLASS_RESULTS_RANGE_DEFAULT;

  state.classResultsUi.rangeByClass = {
    ...state.classResultsUi.rangeByClass,
    [key]: next,
  };
}

function getRecentClassResultsAssignments(classId, limit = CLASS_RESULTS_RECENT_LIMIT) {
  return getClassResultsAssignments(classId, "all").slice(0, Math.max(0, Number(limit) || 0));
}

function getSelectedClassResultsAssignmentId(classId, items = getRecentClassResultsAssignments(classId)) {
  const key = String(classId || "");
  const saved = String(state.classResultsUi.selectedAssignmentByClass[key] || "");
  if (items.some((item) => String(item?.id || "") === saved)) return saved;
  return String(items[0]?.id || "");
}

function setSelectedClassResultsAssignmentId(classId, assignmentId) {
  const key = String(classId || "");
  state.classResultsUi.selectedAssignmentByClass = {
    ...state.classResultsUi.selectedAssignmentByClass,
    [key]: String(assignmentId || ""),
  };
}

async function ensureRecentClassResultsAnalytics(classId, limit = CLASS_RESULTS_RECENT_LIMIT) {
  const items = getRecentClassResultsAssignments(classId, limit);
  if (!items.length) return;
  await Promise.allSettled(items.map((item) => ensureAssignmentAnalytics(item.id)));
}


function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfWeek(date) {
  const day = date.getDay();
  const offset = (day + 6) % 7;
  return addDays(startOfDay(date), -offset);
}

function getAssignmentReferenceTime(item) {
  const raw = item?.deadline || item?.created_at || null;
  const time = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

function isAssignmentInClassRange(item, rangeKey, now = new Date()) {
  if (rangeKey === "all") return true;

  const time = getAssignmentReferenceTime(item);
  if (!Number.isFinite(time)) return false;

  const target = new Date(time);
  const today = startOfDay(now);
  const thisWeekStart = startOfWeek(now);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const last30Start = addDays(today, -29);

  if (rangeKey === "this_week") {
    return target >= thisWeekStart && target < nextWeekStart;
  }

  if (rangeKey === "last_week") {
    return target >= lastWeekStart && target < thisWeekStart;
  }

  if (rangeKey === "last_30_days") {
    return target >= last30Start && target < addDays(today, 1);
  }

  return true;
}

function getClassResultsAssignments(classId, rangeKey = getClassResultsRangeKey(classId)) {
  const key = String(classId || "");
  return [...(state.assignments || [])]
    .filter((item) => String(item?.class_id || "") === key)
    .filter((item) => isAssignmentInClassRange(item, rangeKey))
    .sort((a, b) => {
      const aTime = getAssignmentReferenceTime(a) ?? 0;
      const bTime = getAssignmentReferenceTime(b) ?? 0;
      if (bTime !== aTime) return bTime - aTime;
      return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
    });
}

async function ensureClassResultsAnalytics(classId, rangeKey = getClassResultsRangeKey(classId)) {
  const items = getClassResultsAssignments(classId, rangeKey);
  if (!items.length) return;
  await Promise.allSettled(items.map((item) => ensureAssignmentAnalytics(item.id)));
}

function getAssignmentReferenceLabel(item) {
  if (item?.deadline) return `Due ${formatShortDate(item.deadline)}`;
  if (item?.created_at) return `Set ${formatShortDate(item.created_at)}`;
  return "No date";
}

function getVisualSummaryAssignmentOptions(summary, data = state.visualAnalytics.sourceData) {
  const classIdSet = new Set((summary?.classIds || []).map((item) => String(item || "")).filter(Boolean));
  if (!classIdSet.size) return [];

  return [...(data?.assignments || [])]
    .filter((item) => classIdSet.has(String(item?.class_id || "")))
    .sort((a, b) => {
      const aTime = getAssignmentReferenceTime(a) ?? 0;
      const bTime = getAssignmentReferenceTime(b) ?? 0;
      if (bTime !== aTime) return bTime - aTime;
      return new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime();
    });
}

function getSelectedVisualSummaryAssignmentId(summary, assignments = getVisualSummaryAssignmentOptions(summary)) {
  const scopeKey = createVisualScopeKey(summary?.scopeType, summary?.scopeId);
  const saved = String(state.visualAnalytics.selectedAssignmentByScope?.[scopeKey] || "");
  if (assignments.some((item) => String(item?.id || "") === saved)) return saved;
  return String(assignments[0]?.id || "");
}

function setSelectedVisualSummaryAssignmentId(scopeType, scopeId, assignmentId) {
  const scopeKey = createVisualScopeKey(scopeType, scopeId);
  state.visualAnalytics.selectedAssignmentByScope = {
    ...state.visualAnalytics.selectedAssignmentByScope,
    [scopeKey]: String(assignmentId || ""),
  };
}

function primeVisualSummaryAssignmentSelection(scopeType = state.visualAnalytics.selectedScopeType, scopeId = state.visualAnalytics.selectedScopeId) {
  if (String(scopeType || "") !== "pupil") return;

  const summary = getVisualScopeSummary(scopeType, scopeId, getSelectedVisualAnalyticsGrapheme());
  if (!summary) return;

  const assignments = getVisualSummaryAssignmentOptions(summary);
  const assignmentId = getSelectedVisualSummaryAssignmentId(summary, assignments);
  if (!assignmentId) return;

  setSelectedVisualSummaryAssignmentId(scopeType, scopeId, assignmentId);
  void ensureAssignmentAnalytics(assignmentId);
}

function getClassResultsSummary(items) {
  const ready = (items || [])
    .map((item) => state.analyticsByAssignment[String(item?.id || "")])
    .filter((entry) => entry?.status === "ready")
    .map((entry) => entry.data?.current)
    .filter(Boolean);

  const averageCompletion = ready.length
    ? ready.reduce((sum, item) => sum + Number(item?.completionRate || 0), 0) / ready.length
    : null;
  const averageIndicatorScore = ready.length
    ? averageSpellingIndicator(ready.map((item) => ({ score: item?.averageIndicatorScore })))
    : null;
  const averageScore = ready.length
    ? ready.reduce((sum, item) => sum + Number(item?.averageScore || 0), 0) / ready.length
    : null;

  return {
    count: (items || []).length,
    averageCompletion,
    averageIndicatorScore,
    averageScore,
  };
}

function getAssignmentWatchLabel(analytics) {
  return analytics?.weakGraphemes?.[0]?.target || analytics?.hardestWords?.[0]?.word || "--";
}

export async function renderTeacherDashboard(containerEl) {
  if (!containerEl) return;
  rootEl = containerEl;

  injectStyles();
  await initialiseUser();

  if (!state.user) {
    rootEl.innerHTML = `
      <section class="td-shell">
        <h2 class="td-page-title">${escapeHtml(getDashboardTitle())}</h2>
        <p class="td-muted">Please sign in to access the teacher dashboard.</p>
      </section>
    `;
    return;
  }

  await loadDashboardData();
  applyUrlState();
  paint();

  if (!eventsBound) {
    bindEvents();
    eventsBound = true;
  }

  void ensureDefaultGroupComparisonLoaded();
}

async function initialiseUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    state.user = null;
    state.accessContext = createDefaultAccessContext();
    state.appRole = "teacher";
    return;
  }
  state.user = data.user;
  state.accessContext = createDefaultAccessContext(data.user.id || "");
}

async function applyInterventionGroupFilters({ force = false } = {}) {
  if (!canManageInterventionGroups()) return;
  if (!force && state.interventionGroup.status === "loading") return;

  if (!hasMeaningfulInterventionFilters()) {
    markInterventionFiltersPending();
    if (rootEl?.isConnected) paint();
    return;
  }

  state.interventionGroup.status = "loading";
  state.interventionGroup.message = "";
  state.interventionGroup.resultCount = 0;
  if (rootEl?.isConnected) paint();

  try {
    const directory = await listTeacherPupilDirectoryForInterventionGroups({
      year_group: state.interventionGroup.filters?.yearGroup,
      source_class_id: state.interventionGroup.filters?.sourceClassId,
      search: state.interventionGroup.filters?.search,
    });
    state.interventionGroup.status = "ready";
    state.interventionGroup.message = (Number(directory?.resultCount || 0) || 0) > 0
      ? `${Number(directory?.resultCount || 0)} pupil${Number(directory?.resultCount || 0) === 1 ? "" : "s"} found.`
      : "No pupils match the current filters.";
    state.interventionGroup.resultCount = Math.max(0, Number(directory?.resultCount || 0));
    state.interventionGroup.pupils = Array.isArray(directory?.pupils) ? directory.pupils : [];
    setInterventionBuilderSelectedPupilIds(state.interventionGroup.selectedPupilIds);
  } catch (error) {
    console.error("load intervention group directory error:", error);
    state.interventionGroup.status = "error";
    state.interventionGroup.message = error?.message || "Could not load pupils for intervention groups.";
    state.interventionGroup.resultCount = 0;
    state.interventionGroup.pupils = [];
  }

  if (rootEl?.isConnected) paint();
}

async function loadDashboardData() {
  const teacherId = state.user.id;

  const [classes, tests, assignments, _analyticsThreads, classPolicies, accessContext, appRole, automationPolicies] = await Promise.all([
    loadClasses(),
    loadTests(),
    loadAssignments(),
    loadAnalyticsAssistantThreads(teacherId),
    listClassAutoAssignPolicies(),
    readStaffAccessContext(),
    readTeacherAppRole(),
    listPersonalisedAutomationPolicies({ includeArchived: true }),
  ]);

  state.classes = classes;
  state.tests = tests;
  state.assignments = sortAssignmentsForAttention(assignments);
  state.accessContext = accessContext || createDefaultAccessContext(teacherId);
  state.appRole = appRole;
  state.classPoliciesByClassId = buildClassPoliciesByClassId(classPolicies);
  setAutomationPolicies(automationPolicies);
  const profileSyncNotice = consumeLatestStaffProfileSyncNotice();
  restoreAutomationPolicyDraft();
  state.automationSelectedPolicyKey = getAutomationSelectedPolicyKey();
  if (!canCreateClasses()) {
    state.createClassOpen = false;
  }
  if (!(canManageOwnContent() && canAssignTests())) {
    state.createBaselineOpen = false;
  }
  if (!state.classes.some((item) => String(item?.id || "") === String(state.createAutoAssignClassId || ""))) {
    state.createAutoAssignClassId = "";
  }
  if (!canManageAutomation()) {
    state.createAutoAssignOpen = false;
    state.automationPolicies = [];
    state.automationDraftsByKey = {};
    state.automationSelectedPolicyKey = "";
  }
  if (!canManageInterventionGroups()) {
    state.createInterventionGroupOpen = false;
    state.interventionGroup = createDefaultInterventionGroupState();
  } else if (syncInterventionBuilderSourceClassFilter()) {
    markInterventionFiltersPending();
  }
  state.groupComparison = sanitizeGroupComparisonState(state.groupComparison);
  updateAnalyticsScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
  state.analyticsByAssignment = Object.fromEntries(
    Object.entries(state.analyticsByAssignment || {})
      .filter(([assignmentId]) => state.assignments.some((item) => String(item.id) === String(assignmentId)))
  );
  await refreshVisualAnalyticsSummary();
  if (state.visualAnalytics.summaryOpen) {
    openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
  }

  if (profileSyncNotice?.message) {
    showNotice(profileSyncNotice.message, profileSyncNotice.kind || "info");
  }

  if (canManageRoles()) {
    await loadStaffAccessDirectory();
  } else {
    state.staffAccess = createDefaultStaffAccessState();
    state.sections.staffAccess = false;
  }
}

async function loadStaffAccessDirectory({ preserveSelection = true } = {}) {
  const requestId = ++staffAccessDirectoryRequestId;
  state.staffAccess.loadingDirectory = true;
  state.staffAccess.error = "";
  if (!preserveSelection) {
    state.staffAccess.selectedProfileId = "";
  }

  try {
    const [profiles, directoryRoleAssignments, activeAdminUserIds, pendingApprovalSummaries, pendingDuplicatePreflight] = await Promise.all([
      listStaffProfiles(),
      listActiveStaffRoleAssignments(),
      listActiveAdminUserIds(),
      listStaffPendingAccessSummaries(),
      readStaffPendingAccessDuplicatePreflight(),
    ]);
    if (requestId !== staffAccessDirectoryRequestId) return;

    state.staffAccess.profiles = [...profiles].sort((a, b) => {
      const nameDelta = String(a?.display_name || "").localeCompare(String(b?.display_name || ""));
      if (nameDelta !== 0) return nameDelta;
      return String(a?.email || "").localeCompare(String(b?.email || ""));
    });
    state.staffAccess.directoryRoleAssignments = directoryRoleAssignments;
    state.staffAccess.activeAdminUserIds = activeAdminUserIds;
    state.staffAccess.pendingApprovalSummaries = pendingApprovalSummaries;
    state.staffAccess.pendingDuplicatePreflight = pendingDuplicatePreflight;
    syncStaffAccessPendingScopeSelections();
    const nextSelectedProfileId = preserveSelection ? syncStaffAccessSelectedProfileId() : getStaffAccessSelectedProfileId();

    if (nextSelectedProfileId) {
      await loadStaffAccessSelectionDetails(nextSelectedProfileId);
    } else {
      state.staffAccess.selectedRoles = [];
      state.staffAccess.selectedScopes = [];
      state.staffAccess.selectedAuditEntries = [];
      state.staffAccess.selectedPendingApproval = createDefaultStaffPendingApprovalDetail();
      state.staffAccess.pendingApprovalDraft = createDefaultStaffPendingApprovalDraft();
      state.staffAccess.detailError = "";
    }
  } catch (error) {
    if (requestId !== staffAccessDirectoryRequestId) return;
    console.error("load staff access directory error:", error);
    state.staffAccess.error = error?.message || "Could not load the staff access directory.";
    state.staffAccess.profiles = [];
    state.staffAccess.directoryRoleAssignments = [];
    state.staffAccess.activeAdminUserIds = [];
    state.staffAccess.pendingApprovalSummaries = [];
    state.staffAccess.pendingDuplicatePreflight = createDefaultStaffPendingDuplicatePreflight();
    state.staffAccess.selectedRoles = [];
    state.staffAccess.selectedScopes = [];
    state.staffAccess.selectedAuditEntries = [];
    state.staffAccess.selectedPendingApproval = createDefaultStaffPendingApprovalDetail();
    state.staffAccess.pendingApprovalDraft = createDefaultStaffPendingApprovalDraft();
    state.staffAccess.detailError = "";
  } finally {
    if (requestId === staffAccessDirectoryRequestId) {
      state.staffAccess.loadingDirectory = false;
    }
  }
}

async function loadStaffAccessSelectionDetails(profileId = "") {
  const safeProfileId = String(profileId || "").trim();
  const selectedProfile = safeProfileId ? getStaffAccessProfileMap().get(safeProfileId) || null : null;
  const isLinkedProfile = isStaffAccessProfileLinked(selectedProfile);
  const safeTargetUserId = String(selectedProfile?.user_id || "").trim();
  if (!safeProfileId) {
    state.staffAccess.selectedProfileId = "";
    state.staffAccess.selectedRoles = [];
    state.staffAccess.selectedScopes = [];
    state.staffAccess.selectedAuditEntries = [];
    state.staffAccess.selectedPendingApproval = createDefaultStaffPendingApprovalDetail();
    state.staffAccess.pendingApprovalDraft = createDefaultStaffPendingApprovalDraft();
    state.staffAccess.detailError = "";
    return;
  }

  const requestId = ++staffAccessDetailsRequestId;
  state.staffAccess.selectedProfileId = safeProfileId;
  state.staffAccess.loadingDetails = true;
  state.staffAccess.detailError = "";

  try {
    const requestParts = [
      readStaffPendingAccessDetail(safeProfileId),
      isLinkedProfile && safeTargetUserId
        ? listStaffRoleAssignments(safeTargetUserId)
        : Promise.resolve([]),
      isLinkedProfile && safeTargetUserId
        ? listStaffScopeAssignments(safeTargetUserId)
        : Promise.resolve([]),
      isLinkedProfile && safeTargetUserId
        ? listStaffAccessAuditEntries(safeTargetUserId, { limit: STAFF_ACCESS_AUDIT_LIMIT })
        : Promise.resolve([]),
    ];
    const [pendingApprovalDetail, roles, scopes, auditEntries] = await Promise.all(requestParts);
    if (requestId !== staffAccessDetailsRequestId) return;
    state.staffAccess.selectedPendingApproval = pendingApprovalDetail || createDefaultStaffPendingApprovalDetail();
    state.staffAccess.pendingApprovalDraft = isLinkedProfile
      ? createDefaultStaffPendingApprovalDraft()
      : buildStaffPendingApprovalDraftFromDetail(pendingApprovalDetail);
    state.staffAccess.selectedRoles = roles;
    state.staffAccess.selectedScopes = scopes;
    state.staffAccess.selectedAuditEntries = auditEntries;
    syncStaffAccessPendingScopeSelections();
  } catch (error) {
    if (requestId !== staffAccessDetailsRequestId) return;
    console.error("load staff access selection details error:", error);
    state.staffAccess.detailError = error?.message || "Could not load this staff member's access.";
    state.staffAccess.selectedRoles = [];
    state.staffAccess.selectedScopes = [];
    state.staffAccess.selectedAuditEntries = [];
    state.staffAccess.selectedPendingApproval = createDefaultStaffPendingApprovalDetail();
    state.staffAccess.pendingApprovalDraft = createDefaultStaffPendingApprovalDraft();
  } finally {
    if (requestId === staffAccessDetailsRequestId) {
      state.staffAccess.loadingDetails = false;
    }
  }
}

async function refreshStaffAccessAfterMutation({ targetUserId = "" } = {}) {
  const safeTargetUserId = String(targetUserId || "").trim();
  if (safeTargetUserId && safeTargetUserId === getCurrentTeacherId()) {
    await loadDashboardData();
    return;
  }
  await loadStaffAccessDirectory();
}

async function syncStaffAccessSelectionForVisibleDirectory() {
  const previousProfileId = getStaffAccessSelectedProfileId();
  const nextProfileId = syncStaffAccessSelectedProfileId();
  if (!nextProfileId) {
    state.staffAccess.selectedRoles = [];
    state.staffAccess.selectedScopes = [];
    state.staffAccess.selectedAuditEntries = [];
    state.staffAccess.selectedPendingApproval = createDefaultStaffPendingApprovalDetail();
    state.staffAccess.pendingApprovalDraft = createDefaultStaffPendingApprovalDraft();
    state.staffAccess.detailError = "";
    paint();
    return;
  }
  if (nextProfileId === previousProfileId && !getStaffAccessState()?.detailError) {
    paint();
    return;
  }
  state.staffAccess.loadingDetails = true;
  state.staffAccess.detailError = "";
  paint();
  await loadStaffAccessSelectionDetails(nextProfileId);
  paint();
}

function closeStaffAccessConfirmation() {
  state.staffAccess.confirmation = null;
}

function buildStaffAccessAdminConfirmation({ mode = "grant", blocked = false } = {}) {
  const selectedProfileId = getStaffAccessSelectedProfileId();
  const displayName = getStaffAccessDisplayName(selectedProfileId);

  if (blocked) {
    return {
      title: "Cannot remove the last active Admin",
      body: [
        `${displayName} is currently the last active Admin.`,
        "Admin gives school-wide setup and access-management permissions, so another active Admin must be in place first.",
      ],
      confirmLabel: "Close",
      dismissLabel: "",
      action: null,
      tone: "danger",
    };
  }

  if (mode === "revoke") {
    return {
      title: `Remove Admin from ${displayName}?`,
      body: [
        `${displayName} will lose school-wide setup and access-management permissions.`,
        "This does not remove other roles they already hold.",
      ],
      confirmLabel: "Remove Admin",
      dismissLabel: "Cancel",
      action: { type: "revoke-role", role: "admin" },
      tone: "danger",
    };
  }

  return {
    title: `Grant Admin to ${displayName}?`,
    body: [
      `${displayName} will gain school-wide setup and access-management permissions.`,
      "Admin does not add Teacher authoring unless Teacher is also assigned.",
    ],
    confirmLabel: "Grant Admin",
    dismissLabel: "Cancel",
    action: { type: "grant-role", role: "admin" },
    tone: "danger",
  };
}

function buildStaffPendingAccessApprovalConfirmation() {
  const selectedProfileId = getStaffAccessSelectedProfileId();
  const displayName = getStaffAccessDisplayName(selectedProfileId);
  return {
    title: `Approve Admin pending sign-in for ${displayName}?`,
    body: [
      `${displayName} will be marked as approved for Admin access, but it will not go live yet.`,
      "Admin access will only activate after this person signs in with the exact approved Google email and the staff record links safely.",
    ],
    confirmLabel: "Approve pending sign-in",
    dismissLabel: "Cancel",
    action: { type: "approve-pending-access" },
    tone: "danger",
  };
}

function openStaffAccessConfirmation(config = null) {
  state.staffAccess.confirmation = config && typeof config === "object" ? config : null;
}

async function handleConfirmStaffAccessAction() {
  const confirmation = getStaffAccessState()?.confirmation;
  if (!confirmation?.action) {
    closeStaffAccessConfirmation();
    paint();
    return;
  }

  const action = confirmation.action;
  closeStaffAccessConfirmation();
  paint();

  if (action.type === "grant-role") {
    await handleGrantStaffRoleFromDashboard(action.role, { skipConfirmation: true });
    return;
  }
  if (action.type === "revoke-role") {
    await handleRevokeStaffRoleFromDashboard(action.role, { skipConfirmation: true });
    return;
  }
  if (action.type === "approve-pending-access") {
    await handleSaveStaffPendingAccessApproval({ skipConfirmation: true });
  }
}

function togglePendingStaffAccessClassId(role = "", classId = "", checked = false) {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeClassId = String(classId || "").trim();
  if (!safeRole || !safeClassId || !state.staffAccess.pendingScopeSelections?.[safeRole]) return;
  const nextClassIds = new Set(getStaffAccessPendingClassIds(safeRole));
  if (checked) nextClassIds.add(safeClassId);
  else nextClassIds.delete(safeClassId);
  state.staffAccess.pendingScopeSelections[safeRole].class_ids = [...nextClassIds];
  syncStaffAccessPendingScopeSelections();
}

function removePendingStaffAccessClassId(role = "", classId = "") {
  togglePendingStaffAccessClassId(role, classId, false);
}

async function handleApplyStaffScopedRoleFromDashboard(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const selectedUserId = getSelectedStaffAccessTargetUserId();
  const scopedRoleConfig = getStaffAccessScopedRoleConfig(safeRole);
  const selectedRoleSet = getStaffAccessSelectedRoleSet();
  const roleIsActive = selectedRoleSet.has(safeRole);
  const pendingPlan = getStaffAccessScopedRolePendingPlan(safeRole);

  if (!selectedUserId) {
    showNotice("This staff record is waiting for sign-in linkage before live roles can be granted.", "error");
    paint();
    return;
  }
  if (!scopedRoleConfig) return;
  if (!pendingPlan.hasSelections) {
    showNotice(`Choose at least one ${scopedRoleConfig.primaryLabel.toLowerCase().slice(0, -1)} or class first.`, "error");
    paint();
    return;
  }
  if (!pendingPlan.hasNewScopes && roleIsActive) {
    showNotice("Choose at least one new scope to add.", "error");
    paint();
    return;
  }

  state.staffAccess.mutating = true;
  paint();

  try {
    if (!roleIsActive) {
      await grantStaffRole(selectedUserId, safeRole);
    }
    for (const scopeValue of pendingPlan.newPrimaryValues) {
      await grantStaffScope(selectedUserId, safeRole, pendingPlan.primaryScopeType, scopeValue);
    }
    for (const classId of pendingPlan.newClassIds) {
      await grantStaffScope(selectedUserId, safeRole, "class", classId);
    }
    if (state.staffAccess.pendingScopeSelections?.[safeRole]) {
      state.staffAccess.pendingScopeSelections[safeRole].class_ids = [];
    }
    await refreshStaffAccessAfterMutation({ targetUserId: selectedUserId });
    showNotice(
      roleIsActive
        ? `${getStaffAccessRoleLabel(safeRole)} scopes updated.`
        : `${getStaffAccessRoleLabel(safeRole)} assigned with selected scopes.`,
      "success"
    );
  } catch (error) {
    console.error("apply scoped staff role error:", error);
    showNotice(error?.message || "Could not update this scoped role.", "error");
  } finally {
    state.staffAccess.mutating = false;
    paint();
  }
}

async function handleSaveStaffPendingAccessApproval({ skipConfirmation = false } = {}) {
  const selectedProfile = getStaffAccessSelectedProfile();
  const selectedProfileId = String(selectedProfile?.id || "").trim();
  const pendingDetail = getSelectedStaffPendingApproval();
  const draft = getStaffPendingApprovalDraft();

  if (!selectedProfileId || !selectedProfile || isStaffAccessProfileLinked(selectedProfile)) {
    showNotice("Choose an unlinked staff record before approving pending sign-in access.", "error");
    paint();
    return;
  }
  if (!pendingDetail?.can_approve) {
    showNotice(
      getStaffPendingApprovalFailureMessage(pendingDetail) || "Pending approval is blocked until this staff record is safe to link.",
      "error"
    );
    paint();
    return;
  }
  if (!draft.roles.length) {
    showNotice("Choose at least one intended role before approving pending sign-in.", "error");
    paint();
    return;
  }
  if (draft.roles.includes("admin") && !skipConfirmation) {
    openStaffAccessConfirmation(buildStaffPendingAccessApprovalConfirmation());
    paint();
    return;
  }

  state.staffAccess.mutating = true;
  paint();

  try {
    await saveStaffPendingAccessApproval(selectedProfileId, buildStaffPendingApprovalSavePayload());
    await loadStaffAccessDirectory({ preserveSelection: true });
    showNotice("Pending approval saved. Access will activate automatically after exact-email sign-in and safe linking.", "success");
  } catch (error) {
    console.error("save pending staff approval error:", error);
    showNotice(error?.message || "Could not save the pending approval.", "error");
  } finally {
    state.staffAccess.mutating = false;
    paint();
  }
}

async function handleCancelStaffPendingAccessApproval() {
  const selectedProfile = getStaffAccessSelectedProfile();
  const selectedProfileId = String(selectedProfile?.id || "").trim();
  if (!selectedProfileId || !selectedProfile || isStaffAccessProfileLinked(selectedProfile)) {
    showNotice("Choose an unlinked staff record before cancelling pending approval.", "error");
    paint();
    return;
  }

  state.staffAccess.mutating = true;
  paint();

  try {
    await cancelStaffPendingAccessApproval(selectedProfileId);
    await loadStaffAccessDirectory({ preserveSelection: true });
    showNotice("Pending approval cancelled.", "success");
  } catch (error) {
    console.error("cancel pending staff approval error:", error);
    showNotice(error?.message || "Could not cancel the pending approval.", "error");
  } finally {
    state.staffAccess.mutating = false;
    paint();
  }
}

async function ensureDefaultGroupComparisonLoaded() {
  if (!canAccessSensitiveGroupComparisons()) return;
  if (state.groupComparison.status !== "idle") return;
  if (state.groupComparison.result) return;
  await loadGroupComparison();
}

function normalizeGroupComparisonScopeType(value) {
  const next = String(value || "").trim().toLowerCase();
  return GROUP_COMPARISON_SCOPE_OPTIONS.some((option) => option.value === next) ? next : "whole_school";
}

function normalizeGroupComparisonDateValue(value) {
  const clean = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : "";
}

function getGroupComparisonScopeValueOptions(scopeType) {
  if (scopeType === "class") return getAnalyticsClassOptions();
  if (scopeType === "year_group") {
    return getAnalyticsYearGroupOptions().map((item) => ({ value: item, label: item }));
  }
  return [];
}

function getGroupComparisonVisibleGroups(result, { includeNotRecorded = false } = {}) {
  return (Array.isArray(result?.groups) ? result.groups : []).filter((group) => {
    const key = String(group?.groupKey || group?.key || "");
    if (!includeNotRecorded && key === "not_recorded") return false;
    return !!String(group?.id || group?.key || "");
  });
}

function getAllGroupComparisonFallbackOptions() {
  return GROUP_COMPARISON_GROUP_OPTIONS.flatMap((family) =>
    (GROUP_COMPARISON_PAIR_FALLBACKS[family.value] || []).map((option) => ({
      value: `${family.value}::${option.value}`,
      label: option.label,
      groupType: family.value,
      groupKey: option.value,
      suppressed: false,
    }))
  );
}

function getGroupComparisonPairOptions(result) {
  const visibleGroups = getGroupComparisonVisibleGroups(result);
  if (result && Array.isArray(result.groups)) {
    return visibleGroups.map((group) => ({
      value: String(group?.id || ""),
      label: group?.suppressed
        ? `${String(group?.label || "Group")} (below minimum cohort)`
        : String(group?.label || "Group"),
      groupType: String(group?.groupType || ""),
      groupKey: String(group?.groupKey || group?.key || ""),
      suppressed: !!group?.suppressed,
    }));
  }

  return getAllGroupComparisonFallbackOptions();
}

function resolveGroupComparisonPair({
  result,
  compareKey,
  withKey,
}) {
  const options = getGroupComparisonPairOptions(result);
  const optionValues = options.map((option) => String(option?.value || "")).filter(Boolean);
  const nextCompareKey = optionValues.includes(String(compareKey || ""))
    ? String(compareKey || "")
    : String(optionValues[0] || "");
  let nextWithKey = optionValues.includes(String(withKey || "")) && String(withKey || "") !== nextCompareKey
    ? String(withKey || "")
    : "";

  if (!nextWithKey) {
    nextWithKey = optionValues.find((value) => value !== nextCompareKey) || "";
  }

  return {
    compareKey: nextCompareKey,
    withKey: nextWithKey,
    options,
  };
}

function sanitizeGroupComparisonState(current = createDefaultGroupComparisonState()) {
  const defaults = createDefaultGroupComparisonState();
  const validTestIds = new Set((state.tests || []).map((item) => String(item?.id || "")).filter(Boolean));
  const scopeType = normalizeGroupComparisonScopeType(current?.filters?.scopeType);
  const validScopeValues = new Set(
    getGroupComparisonScopeValueOptions(scopeType).map((item) => String(item?.value || "")).filter(Boolean)
  );
  const scopeValue = validScopeValues.has(String(current?.filters?.scopeValue || ""))
    ? String(current.filters.scopeValue)
    : "";
  const testId = validTestIds.has(String(current?.filters?.testId || "")) ? String(current.filters.testId) : "";
  const dateFrom = normalizeGroupComparisonDateValue(current?.filters?.dateFrom);
  const dateTo = normalizeGroupComparisonDateValue(current?.filters?.dateTo);
  const resolvedPair = resolveGroupComparisonPair({
    result: current?.result,
    compareKey: current?.compareKey,
    withKey: current?.withKey,
  });
  const preservesCurrentResult =
    scopeType === normalizeGroupComparisonScopeType(current?.filters?.scopeType) &&
    scopeValue === (validScopeValues.has(String(current?.filters?.scopeValue || "")) ? String(current?.filters?.scopeValue || "") : "") &&
    testId === (validTestIds.has(String(current?.filters?.testId || "")) ? String(current?.filters?.testId || "") : "") &&
    dateFrom === normalizeGroupComparisonDateValue(current?.filters?.dateFrom) &&
    dateTo === normalizeGroupComparisonDateValue(current?.filters?.dateTo);

  return {
    ...defaults,
    ...current,
    status: preservesCurrentResult ? String(current?.status || "idle") : "idle",
    message: preservesCurrentResult ? String(current?.message || "") : "",
    result: preservesCurrentResult ? current?.result || null : null,
    compareKey: resolvedPair.compareKey,
    withKey: resolvedPair.withKey,
    filters: {
      scopeType,
      scopeValue,
      testId,
      dateFrom,
      dateTo,
    },
  };
}

function markGroupComparisonDirty() {
  state.groupComparison = {
    ...state.groupComparison,
    status: "idle",
    message: "",
    result: null,
  };
}

function canAccessSensitiveGroupComparisons() {
  // Guard point for future teacher/admin role restriction.
  return !!state.user?.id;
}

async function getTeacherAccessTokenOrThrow() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  let accessToken = String(sessionData?.session?.access_token || "").trim();
  if (accessToken && sessionData?.session?.user?.id) {
    return accessToken;
  }

  const { data: refreshedSessionData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;
  accessToken = String(refreshedSessionData?.session?.access_token || "").trim();
  if (!accessToken) {
    throw new Error("Your teacher session has expired. Please sign in again.");
  }

  return accessToken;
}

async function loadGroupComparison({ button = null } = {}) {
  const preservedScrollY = window.scrollY;

  if (!canAccessSensitiveGroupComparisons()) {
    state.groupComparison = {
      ...state.groupComparison,
      status: "error",
      message: "Group comparison is limited to teacher accounts.",
      result: null,
    };
    paint();
    restoreWindowScroll(preservedScrollY);
    return;
  }

  const scopeType = normalizeGroupComparisonScopeType(state.groupComparison.filters.scopeType);
  const scopeValue = String(state.groupComparison.filters.scopeValue || "");
  if (scopeType !== "whole_school" && !scopeValue) {
    state.groupComparison = {
      ...state.groupComparison,
      status: "error",
      message: `Select a ${getGroupComparisonScopeFocusLabel(scopeType).toLowerCase()} to compare this view.`,
      result: null,
    };
    paint();
    restoreWindowScroll(preservedScrollY);
    return;
  }

  const requestId = ++groupComparisonRequestId;
  state.groupComparison = {
    ...state.groupComparison,
    status: "loading",
    message: "",
  };
  if (button) setBusy(button, true, "Updating...");

  try {
    const accessToken = await getTeacherAccessTokenOrThrow();
    const sharedFilters = {
      classId: scopeType === "class" ? scopeValue || null : null,
      yearGroup: scopeType === "year_group" ? scopeValue || null : null,
      testId: state.groupComparison.filters.testId || null,
      dateFrom: state.groupComparison.filters.dateFrom || null,
      dateTo: state.groupComparison.filters.dateTo || null,
    };
    const familyEntries = await Promise.all(
      GROUP_COMPARISON_GROUP_OPTIONS.map(async (option) => ([
        option.value,
        await fetchTeacherGroupComparison({
          groupType: option.value,
          filters: sharedFilters,
          accessToken,
        }),
      ]))
    );
    const result = buildMergedGroupComparisonResult(Object.fromEntries(familyEntries));

    if (requestId !== groupComparisonRequestId) return;

    const resolvedPair = resolveGroupComparisonPair({
      result,
      compareKey: state.groupComparison.compareKey,
      withKey: state.groupComparison.withKey,
    });

    state.groupComparison = {
      ...state.groupComparison,
      status: "ready",
      message: "",
      result,
      compareKey: resolvedPair.compareKey,
      withKey: resolvedPair.withKey,
    };
  } catch (error) {
    if (requestId !== groupComparisonRequestId) return;

    console.error("group comparison load error:", error);
    state.groupComparison = {
      ...state.groupComparison,
      status: "error",
      message: error?.message || "Could not load group comparison.",
      result: null,
    };
  } finally {
    if (button) setBusy(button, false);
    if (requestId === groupComparisonRequestId) {
      paint();
      restoreWindowScroll(preservedScrollY);
    }
  }
}

function getAnalyticsAssistantThreadTimestamp(thread) {
  return Date.parse(thread?.lastMessageAt || thread?.updatedAt || thread?.createdAt || "") || 0;
}

function normalizeAnalyticsAssistantThread(row) {
  const rawScopeType = String(row?.scope_type || row?.scopeType || "");
  const scopeType = ["class", "year_group", "pupil"].includes(rawScopeType)
    ? rawScopeType
    : "overview";

  return {
    id: String(row?.id || ""),
    title: String(row?.title || "New chat").trim() || "New chat",
    scopeType,
    scopeId: scopeType === "overview" ? "" : String(row?.scope_id || row?.scopeId || ""),
    createdAt: String(row?.created_at || row?.createdAt || ""),
    updatedAt: String(row?.updated_at || row?.updatedAt || row?.last_message_at || row?.lastMessageAt || row?.created_at || row?.createdAt || ""),
    lastMessageAt: String(row?.last_message_at || row?.lastMessageAt || row?.updated_at || row?.updatedAt || row?.created_at || row?.createdAt || ""),
  };
}

function normalizeAnalyticsAssistantMessage(row) {
  return {
    id: String(row?.id || ""),
    role: row?.role === "user" ? "user" : "assistant",
    text: String(row?.text || ""),
    scopeLabel: String(row?.scope_label || row?.scopeLabel || ""),
    meta: String(row?.meta || ""),
    createdAt: String(row?.created_at || row?.createdAt || ""),
  };
}

function sortAnalyticsAssistantThreads(threads) {
  return [...(threads || [])]
    .filter((item) => item?.id)
    .sort((a, b) => getAnalyticsAssistantThreadTimestamp(b) - getAnalyticsAssistantThreadTimestamp(a))
    .slice(0, ANALYTICS_ASSISTANT_THREAD_LIMIT);
}

function setAnalyticsAssistantThreads(threads) {
  state.analyticsAssistant.threads = sortAnalyticsAssistantThreads(threads);
}

function upsertAnalyticsAssistantThread(thread) {
  if (!thread?.id) return;
  const nextThreads = [
    normalizeAnalyticsAssistantThread(thread),
    ...(state.analyticsAssistant.threads || []).filter((item) => String(item?.id || "") !== String(thread.id)),
  ];
  setAnalyticsAssistantThreads(nextThreads);
}

function buildAnalyticsAssistantThreadTitle(question) {
  const cleanQuestion = String(question || "").replace(/\s+/g, " ").trim();
  if (!cleanQuestion) return "New chat";
  if (cleanQuestion.length <= 72) return cleanQuestion;
  return `${cleanQuestion.slice(0, 69).trimEnd()}...`;
}

function isMissingAnalyticsAssistantHistoryTableError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  const mentionsHistoryTable =
    message.includes("teacher_ai_threads") ||
    message.includes("teacher_ai_messages");

  if (!mentionsHistoryTable) return false;
  return code === "PGRST205" || code === "42P01" || message.includes("schema cache") || message.includes("relation");
}

function disableAnalyticsAssistantHistory(error) {
  console.warn("analytics assistant history unavailable:", error);
  state.analyticsAssistant.historyAvailable = false;
  state.analyticsAssistant.threadsLoading = false;
  state.analyticsAssistant.threads = [];
  state.analyticsAssistant.activeThreadId = "";
}

async function loadAnalyticsAssistantThreads(teacherId) {
  if (!teacherId || state.analyticsAssistant.historyAvailable === false) return [];

  state.analyticsAssistant.threadsLoading = true;
  const { data, error } = await supabase
    .from("teacher_ai_threads")
    .select("id, title, scope_type, scope_id, created_at, updated_at, last_message_at, archived_at")
    .eq("teacher_id", teacherId)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false })
    .limit(ANALYTICS_ASSISTANT_THREAD_LIMIT);

  state.analyticsAssistant.threadsLoading = false;

  if (error) {
    if (isMissingAnalyticsAssistantHistoryTableError(error)) {
      disableAnalyticsAssistantHistory(error);
      return [];
    }
    console.error("load analytics assistant threads error:", error);
    return state.analyticsAssistant.threads || [];
  }

  const threads = (data || []).map(normalizeAnalyticsAssistantThread);
  state.analyticsAssistant.historyAvailable = true;
  setAnalyticsAssistantThreads(threads);
  return threads;
}

async function loadAnalyticsAssistantThreadMessages(threadId) {
  if (!threadId || state.analyticsAssistant.historyAvailable === false) return null;

  const { data, error } = await supabase
    .from("teacher_ai_messages")
    .select("id, role, text, scope_label, meta, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingAnalyticsAssistantHistoryTableError(error)) {
      disableAnalyticsAssistantHistory(error);
      return null;
    }
    console.error("load analytics assistant messages error:", error);
    showNotice("Could not open that chat just now.", "error");
    paint();
    return null;
  }

  return (data || []).map(normalizeAnalyticsAssistantMessage);
}

async function createAnalyticsAssistantThread({
  teacherId,
  question,
  scopeType,
  scopeId,
}) {
  if (!teacherId || state.analyticsAssistant.historyAvailable === false) return null;

  const now = new Date().toISOString();
  const payload = {
    teacher_id: teacherId,
    title: buildAnalyticsAssistantThreadTitle(question),
    scope_type: ["class", "year_group", "pupil"].includes(String(scopeType || "")) ? String(scopeType) : "overview",
    scope_id: scopeType === "overview" ? "" : String(scopeId || ""),
    updated_at: now,
    last_message_at: now,
  };

  const { data, error } = await supabase
    .from("teacher_ai_threads")
    .insert(payload)
    .select("id, title, scope_type, scope_id, created_at, updated_at, last_message_at")
    .single();

  if (error) {
    if (isMissingAnalyticsAssistantHistoryTableError(error)) {
      disableAnalyticsAssistantHistory(error);
      return null;
    }
    console.error("create analytics assistant thread error:", error);
    return null;
  }

  const thread = normalizeAnalyticsAssistantThread(data);
  state.analyticsAssistant.historyAvailable = true;
  upsertAnalyticsAssistantThread(thread);
  return thread;
}

async function updateAnalyticsAssistantThread(threadId, {
  scopeType,
  scopeId,
  lastMessageAt,
}) {
  if (!threadId || state.analyticsAssistant.historyAvailable === false) return null;

  const payload = {
    scope_type: ["class", "year_group", "pupil"].includes(String(scopeType || "")) ? String(scopeType) : "overview",
    scope_id: scopeType === "overview" ? "" : String(scopeId || ""),
    updated_at: lastMessageAt || new Date().toISOString(),
    last_message_at: lastMessageAt || new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("teacher_ai_threads")
    .update(payload)
    .eq("id", threadId)
    .select("id, title, scope_type, scope_id, created_at, updated_at, last_message_at")
    .single();

  if (error) {
    if (isMissingAnalyticsAssistantHistoryTableError(error)) {
      disableAnalyticsAssistantHistory(error);
      return null;
    }
    console.error("update analytics assistant thread error:", error);
    return null;
  }

  const thread = normalizeAnalyticsAssistantThread(data);
  state.analyticsAssistant.historyAvailable = true;
  upsertAnalyticsAssistantThread(thread);
  return thread;
}

async function saveAnalyticsAssistantMessage({
  threadId,
  teacherId,
  role,
  text,
  scopeLabel,
  meta,
}) {
  if (!threadId || !teacherId || state.analyticsAssistant.historyAvailable === false) return null;

  const payload = {
    thread_id: threadId,
    teacher_id: teacherId,
    role: role === "user" ? "user" : "assistant",
    text: String(text || "").trim(),
    scope_label: String(scopeLabel || "").trim() || null,
    meta: String(meta || "").trim() || null,
  };

  const { data, error } = await supabase
    .from("teacher_ai_messages")
    .insert(payload)
    .select("id, role, text, scope_label, meta, created_at")
    .single();

  if (error) {
    if (isMissingAnalyticsAssistantHistoryTableError(error)) {
      disableAnalyticsAssistantHistory(error);
      return null;
    }
    console.error("save analytics assistant message error:", error);
    return null;
  }

  return normalizeAnalyticsAssistantMessage(data);
}

async function openAnalyticsAssistantThread(threadId) {
  if (!threadId || state.analyticsAssistant.loading) return;

  const thread = (state.analyticsAssistant.threads || []).find((item) => String(item?.id || "") === String(threadId));
  if (!thread) return;

  const messages = await loadAnalyticsAssistantThreadMessages(threadId);
  if (messages === null) return;

  openDashboardSection("analytics");
  state.analyticsAssistant.open = true;
  state.analyticsAssistant.activeThreadId = String(threadId);
  state.analyticsAssistant.messages = messages.length ? messages : createDefaultAnalyticsAssistantMessages();
  state.analyticsAssistant.questionDraft = "";
  updateAnalyticsScope(thread.scopeType, thread.scopeId);
  openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
  paint();
  requestAnimationFrame(() => {
    rootEl?.querySelector('[data-role="analytics-assistant-panel"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function startNewAnalyticsAssistantThread() {
  state.analyticsAssistant.activeThreadId = "";
  state.analyticsAssistant.messages = createDefaultAnalyticsAssistantMessages();
  state.analyticsAssistant.questionDraft = "";
}

async function loadClasses() {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("loadClasses error:", error);
    return [];
  }

  return (data || []).map((item) => ({
    ...item,
    class_type: getNormalizedClassType(item?.class_type, { legacyFallback: CLASS_TYPE_FORM }),
  }));
}

async function loadTests() {
  const { data, error } = await supabase
    .from("tests")
    .select(`
      *,
      test_words (
        id,
        word,
        sentence,
        segments,
        choice
      ),
      assignments_v2 (
        class_id,
        end_at,
        classes (
          name
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("loadTests error:", error);
    return [];
  }

  return (data || []).map((test) => {
    const assignments = Array.isArray(test.assignments_v2) ? test.assignments_v2 : [];
    const classNames = assignments
      .map((item) => item.classes?.name)
      .filter(Boolean);
    const uniqueClassNames = Array.from(new Set(classNames));
    const deadlineTimes = assignments
      .map((item) => item.end_at ? new Date(item.end_at).getTime() : null)
      .filter((value) => Number.isFinite(value));
    const earliestDeadline = deadlineTimes.length ? new Date(Math.min(...deadlineTimes)).toISOString() : null;
    const testWords = Array.isArray(test.test_words) ? test.test_words : [];
    const difficultySummary = buildTestDifficultySummary(testWords);
    const isAutoGenerated = isFullyGeneratedAssignmentWordRows(testWords);

    return {
      ...test,
      question_type: normalizeStoredQuestionType(test.question_type, { title: test.title }),
      question_count: testWords.length,
      difficulty_summary: difficultySummary,
      assigned_class_names: uniqueClassNames,
      earliest_deadline: earliestDeadline,
      assignment_count: assignments.length,
      is_auto_generated: isAutoGenerated,
    };
  });
}

async function loadAssignments() {
  const { data, error } = await supabase
    .from("assignments_v2")
    .select(`
      *,
      tests (
        id,
        title
      ),
      classes (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("loadAssignments error:", error);
    return [];
  }

  return (data || []).map((item) => ({ ...item, deadline: item.end_at || null }));
}

function getAnalyticsTargetSettingsFromSource(source) {
  const enabled = !!source?.analytics_target_words_enabled;
  const rawCount = Number(source?.analytics_target_words_per_pupil || 3);
  const count = Math.max(1, Math.min(10, Number.isFinite(rawCount) ? Math.round(rawCount) : 3));
  return {
    enabled,
    count,
    limitPerPupil: enabled ? count : 0,
  };
}

async function ensureAssignmentAnalytics(assignmentId, { force = false } = {}) {
  const key = String(assignmentId || "");
  if (!key) return;

  const existing = state.analyticsByAssignment[key];
  if (existing?.status === "loading") return;
  if (existing?.status === "ready" && !force) return;

  state.analyticsByAssignment[key] = { status: "loading" };
  if (rootEl?.isConnected) paint();

  try {
    const assignment = state.assignments.find((item) => String(item.id) === key);
    if (!assignment) throw new Error("Assignment not found.");
    const data = await loadAssignmentAnalytics(assignment);
    state.analyticsByAssignment[key] = { status: "ready", data };
  } catch (error) {
    console.error("load assignment analytics error:", error);
    state.analyticsByAssignment[key] = {
      status: "error",
      message: error?.message || "Could not load analytics.",
    };
  }

  if (rootEl?.isConnected) paint();
}

function isMissingAssignmentTargetTableError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || code === "PGRST205"
    || (message.includes("assignment_pupil_target_words") && (
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
    || (message.includes("assignment_pupil_statuses") && (
      message.includes("does not exist")
      || message.includes("schema cache")
      || message.includes("could not find the table")
      || message.includes("relation")
    ));
}

async function loadAssignmentAnalytics(assignment) {
  const currentAssignmentId = String(assignment?.id || "");
  const currentClassId = String(assignment?.class_id || "");
  const currentTestId = String(assignment?.test_id || "");
  if (!currentAssignmentId || !currentClassId || !currentTestId) {
    throw new Error("Assignment details are incomplete.");
  }

  const { data: siblingRaw, error: siblingError } = await supabase
    .from("assignments_v2")
    .select(`
      id,
      class_id,
      test_id,
      created_at,
      end_at,
      classes (
        name
      )
    `)
    .eq("test_id", currentTestId)
    .order("created_at", { ascending: false });
  if (siblingError) throw siblingError;

  const siblingAssignments = dedupeSiblingAssignments(siblingRaw || [], {
    currentAssignmentId,
    currentClassId,
  });
  const assignmentIds = siblingAssignments.map((item) => item.id).filter(Boolean);
  const classIds = [...new Set(siblingAssignments.map((item) => item.class_id).filter(Boolean))];
  console.log("TEACHER ROW QUERY ids:", {
    assignmentId: currentAssignmentId,
    classId: currentClassId,
    testId: currentTestId,
    assignmentIds,
    classIds,
  });
  console.log("ANALYTICS QUERY ids:", {
    assignmentId: currentAssignmentId,
    classId: currentClassId,
    testId: currentTestId,
    assignmentIds,
    classIds,
  });

  const [wordRes, membershipRes, attemptsRes, targetRes, statusRes] = await Promise.all([
    supabase
      .from("test_words")
      .select("id, position, word, sentence, segments, choice")
      .eq("test_id", currentTestId)
      .order("position", { ascending: true }),
    classIds.length
      ? supabase
        .from("pupil_classes")
        .select("class_id, pupil_id")
        .in("class_id", classIds)
        .eq("active", true)
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? supabase
        .from("attempts")
        .select("assignment_id, pupil_id, test_word_id, assignment_target_id, correct, attempt_number, created_at, focus_grapheme, pattern_type, word_text, typed, target_graphemes")
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? supabase
        .from("assignment_pupil_target_words")
        .select(`
          id,
          teacher_id,
          assignment_id,
          pupil_id,
          test_word_id,
          focus_grapheme,
          target_source,
          target_reason,
          created_at,
          test_words (
            id,
            test_id,
            position,
            word,
            sentence,
            segments,
            choice
          )
        `)
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? supabase
        .from("assignment_pupil_statuses")
        .select("*")
        .in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (wordRes.error) throw wordRes.error;
  if (membershipRes.error) throw membershipRes.error;
  if (attemptsRes.error) throw attemptsRes.error;
  if (targetRes.error && !isMissingAssignmentTargetTableError(targetRes.error)) throw targetRes.error;
  if (statusRes.error && !isMissingAssignmentStatusTableError(statusRes.error)) throw statusRes.error;

  const pupilIds = [...new Set((membershipRes.data || []).map((item) => item.pupil_id).filter(Boolean))];
  const pupilRes = pupilIds.length
    ? await supabase.from("pupils").select("id, first_name, surname, username").in("id", pupilIds)
    : { data: [], error: null };
  if (pupilRes.error) throw pupilRes.error;

  const wordRows = Array.isArray(wordRes.data) ? wordRes.data : [];
  const pupilsById = new Map(
    (pupilRes.data || []).map((item) => [String(item.id), item])
  );
  const rosterByClass = buildRosterByClass(membershipRes.data || [], pupilsById);
  const attemptsByAssignment = groupAttemptsByAssignment(attemptsRes.data || []);
  let targetRows = Array.isArray(targetRes.data) ? targetRes.data : [];
  const analyticsTargetSettings = getAnalyticsTargetSettingsFromSource(assignment);
  const statusRows = Array.isArray(statusRes.data) ? statusRes.data : [];
  console.log("ASSIGNMENTS source:", {
    assignmentId: currentAssignmentId,
    source: "assignment_pupil_statuses.result_json with attempts fallback",
    statusRowCount: statusRows.length,
    attemptRowCount: Array.isArray(attemptsRes.data) ? attemptsRes.data.length : 0,
  });
  console.log("ANALYTICS source:", {
    assignmentId: currentAssignmentId,
    source: "assignment_pupil_statuses.result_json with attempts fallback",
    statusRowCount: statusRows.length,
    attemptRowCount: Array.isArray(attemptsRes.data) ? attemptsRes.data.length : 0,
  });

  if (canManageAssignmentRecord(assignment)) {
    try {
      const syncedTargetRows = await syncAssignmentPupilTargetWords({
        teacherId: state.user.id,
        assignmentId: currentAssignmentId,
        classId: currentClassId,
        testId: currentTestId,
        createdAt: assignment?.created_at || null,
        limitPerPupil: analyticsTargetSettings.limitPerPupil,
      });
      targetRows = [
        ...targetRows.filter((row) => String(row?.assignment_id || row?.assignmentId || "") !== currentAssignmentId),
        ...syncedTargetRows,
      ];
    } catch (error) {
      console.warn("sync assignment pupil target words error:", error);
    }
  }
  const externalTargetWordIds = [...new Set(
    (targetRows || [])
      .map((row) => String(row?.test_word_id || row?.testWordId || ""))
      .filter(Boolean)
      .filter((wordId) => !wordRows.some((wordRow) => String(wordRow?.id || "") === wordId))
  )];
  const externalWordRes = externalTargetWordIds.length
    ? await supabase
      .from("test_words")
      .select("id, test_id, position, word, sentence, segments, choice")
      .in("id", externalTargetWordIds)
    : { data: [], error: null };
  if (externalWordRes.error) throw externalWordRes.error;
  const externalTargetWordRows = Array.isArray(externalWordRes.data) ? externalWordRes.data : [];
  console.log("Analytics fetch rows:", {
    assignmentId: currentAssignmentId,
    assignmentIds,
    wordRowCount: wordRows.length,
    externalTargetWordCount: externalTargetWordRows.length,
    pupilCount: pupilIds.length,
    attemptRowCount: Array.isArray(attemptsRes.data) ? attemptsRes.data.length : 0,
    targetRowCount: targetRows.length,
    statusRowCount: statusRows.length,
    sampleAttempts: (attemptsRes.data || []).slice(0, 5).map((row) => ({
      assignmentId: row?.assignment_id || null,
      pupilId: row?.pupil_id || null,
      testWordId: row?.test_word_id || null,
      assignmentTargetId: row?.assignment_target_id || null,
      correct: !!row?.correct,
      attemptNumber: row?.attempt_number || null,
    })),
    sampleStatuses: statusRows.slice(0, 5).map((row) => ({
      assignmentId: row?.assignment_id || row?.assignmentId || null,
      pupilId: row?.pupil_id || row?.pupilId || null,
      status: row?.status || "assigned",
      startedAt: row?.started_at || row?.startedAt || null,
      completedAt: row?.completed_at || row?.completedAt || null,
    })),
  });
  console.log("ANALYTICS SOURCE rows:", {
    assignmentId: currentAssignmentId,
    attempts: (attemptsRes.data || []).map((row) => ({
      assignmentId: row?.assignment_id || null,
      pupilId: row?.pupil_id || null,
      testWordId: row?.test_word_id || null,
      assignmentTargetId: row?.assignment_target_id || null,
      wordText: row?.word_text || "",
      correct: !!row?.correct,
      attemptNumber: row?.attempt_number || null,
    })),
    targetRows: (targetRows || []).map((row) => ({
      id: String(row?.id || row?.assignmentId || ""),
      assignmentId: String(row?.assignment_id || row?.assignmentId || ""),
      pupilId: String(row?.pupil_id || row?.pupilId || ""),
      testWordId: String(row?.test_word_id || row?.testWordId || ""),
      focusGrapheme: String(row?.focus_grapheme || row?.focusGrapheme || ""),
    })),
    statusRows: (statusRows || []).map((row) => ({
      assignmentId: String(row?.assignment_id || row?.assignmentId || ""),
      pupilId: String(row?.pupil_id || row?.pupilId || ""),
      status: String(row?.status || "assigned"),
      completedAt: row?.completed_at || row?.completedAt || null,
    })),
  });

  const targetRowsByAssignment = new Map();
  for (const row of targetRows || []) {
    const assignmentId = String(row?.assignment_id || row?.assignmentId || "");
    if (!assignmentId) continue;
    const next = targetRowsByAssignment.get(assignmentId) || [];
    next.push(row);
    targetRowsByAssignment.set(assignmentId, next);
  }

  const statusRowsByAssignment = new Map();
  for (const row of statusRows || []) {
    const assignmentId = String(row?.assignment_id || row?.assignmentId || "");
    if (!assignmentId) continue;
    const next = statusRowsByAssignment.get(assignmentId) || [];
    next.push(row);
    statusRowsByAssignment.set(assignmentId, next);
  }

  const currentClassName = assignment?.classes?.name || "Current class";
  const currentAnalytics = buildAssignmentAnalyticsSnapshot({
    assignmentId: currentAssignmentId,
    classId: currentClassId,
    className: currentClassName,
    roster: rosterByClass.get(currentClassId) || [],
    wordRows,
    extraWordRows: externalTargetWordRows,
    attempts: attemptsByAssignment.get(currentAssignmentId) || [],
    targetRows: targetRowsByAssignment.get(currentAssignmentId) || [],
    statusRows: statusRowsByAssignment.get(currentAssignmentId) || [],
  });

  const comparisonRows = siblingAssignments
    .map((item) => {
      const snapshot = buildAssignmentAnalyticsSnapshot({
        assignmentId: String(item.id),
        classId: String(item.class_id || ""),
        className: item?.classes?.name || "Class",
        roster: rosterByClass.get(String(item.class_id || "")) || [],
        wordRows,
        extraWordRows: externalTargetWordRows,
        attempts: attemptsByAssignment.get(String(item.id)) || [],
        targetRows: targetRowsByAssignment.get(String(item.id)) || [],
        statusRows: statusRowsByAssignment.get(String(item.id)) || [],
      });
      return {
        assignmentId: String(item.id),
        classId: String(item.class_id || ""),
        className: item?.classes?.name || "Class",
        rosterCount: snapshot.rosterCount,
        startedCount: snapshot.startedCount,
        completedCount: snapshot.completedCount,
        averageScore: snapshot.averageScore,
        averageIndicatorScore: snapshot.averageIndicatorScore,
        checkedAccuracy: snapshot.checkedAccuracy,
        averageAttempts: snapshot.averageAttempts,
        isCurrent: String(item.id) === currentAssignmentId,
      };
    })
    .sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      if (Number(b.averageIndicatorScore || -1) !== Number(a.averageIndicatorScore || -1)) {
        return Number(b.averageIndicatorScore || -1) - Number(a.averageIndicatorScore || -1);
      }
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      return String(a.className || "").localeCompare(String(b.className || ""));
    });
  console.log("Analytics derived result:", {
    assignmentId: currentAssignmentId,
    rosterCount: currentAnalytics.rosterCount,
    startedCount: currentAnalytics.startedCount,
    completedCount: currentAnalytics.completedCount,
    pupilRows: (currentAnalytics.pupilRows || []).map((row) => ({
      pupilId: row?.pupilId || "",
      status: row?.status || "Not started",
      attemptedWords: row?.attemptedWords || 0,
      totalWords: row?.totalWords || 0,
      completedAt: row?.completedAt || null,
      targetWordCount: row?.targetWordCount || 0,
    })),
  });
  console.log("Analytics updated:", {
    assignmentId: currentAssignmentId,
    startedCount: currentAnalytics.startedCount,
    completedCount: currentAnalytics.completedCount,
    targetedWordCount: currentAnalytics.pupilRows.reduce((sum, item) => sum + Math.max(0, Number(item?.targetWordCount || 0)), 0),
  });
  console.log("DONE COUNTER SOURCE rows:", {
    assignmentId: currentAssignmentId,
    rosterCount: currentAnalytics.rosterCount,
    completedCount: currentAnalytics.completedCount,
    statusRows: (statusRowsByAssignment.get(currentAssignmentId) || []).map((row) => ({
      pupilId: String(row?.pupil_id || row?.pupilId || ""),
      status: String(row?.status || "assigned"),
      completedAt: row?.completed_at || row?.completedAt || null,
    })),
  });
  return {
    assignmentId: currentAssignmentId,
    className: currentClassName,
    wordRows,
    current: currentAnalytics,
    comparisonRows,
  };
}

function dedupeSiblingAssignments(items, { currentAssignmentId, currentClassId }) {
  const latestByClass = new Map();
  for (const item of items || []) {
    const classId = String(item?.class_id || "");
    if (!classId) continue;
    if (classId === String(currentClassId || "") && String(item?.id || "") === String(currentAssignmentId || "")) {
      latestByClass.set(classId, item);
      continue;
    }
    if (latestByClass.has(classId)) continue;
    latestByClass.set(classId, item);
  }
  return Array.from(latestByClass.values());
}

function buildRosterByClass(memberships, pupilsById) {
  const rosterByClass = new Map();
  for (const membership of memberships || []) {
    const classId = String(membership?.class_id || "");
    const pupilId = String(membership?.pupil_id || "");
    if (!classId || !pupilId) continue;
    const pupil = pupilsById.get(pupilId);
    if (!pupil) continue;
    const next = rosterByClass.get(classId) || [];
    next.push(pupil);
    rosterByClass.set(classId, next);
  }
  for (const [classId, roster] of rosterByClass.entries()) {
    rosterByClass.set(classId, [...roster].sort((a, b) => pupilDisplayName(a).localeCompare(pupilDisplayName(b))));
  }
  return rosterByClass;
}

function groupAttemptsByAssignment(attempts) {
  const grouped = new Map();
  for (const attempt of attempts || []) {
    const assignmentId = String(attempt?.assignment_id || "");
    if (!assignmentId) continue;
    const next = grouped.get(assignmentId) || [];
    next.push(attempt);
    grouped.set(assignmentId, next);
  }
  return grouped;
}

function pupilDisplayName(pupil) {
  const first = String(pupil?.first_name || "").trim();
  const surname = String(pupil?.surname || "").trim();
  const full = `${first} ${surname}`.trim();
  return full || String(pupil?.username || "Unknown pupil");
}

function analyticsTargetForAttempt(attempt) {
  const focus = String(attempt?.focus_grapheme || "").trim().toLowerCase();
  if (focus) return focus;

  const targetGraphemes = Array.isArray(attempt?.target_graphemes)
    ? attempt.target_graphemes.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const best = chooseBestFocusGrapheme(targetGraphemes);
  if (best) return best;

  return String(attempt?.pattern_type || "").trim().toLowerCase() || "general";
}

function focusFromAssignmentWordRow(wordRow) {
  const focusChoices = Array.isArray(wordRow?.choice?.focus_graphemes)
    ? wordRow.choice.focus_graphemes.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  if (focusChoices[0]) return focusChoices[0];

  const segments = Array.isArray(wordRow?.segments)
    ? wordRow.segments.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  return String(chooseBestFocusGrapheme(segments) || "").trim().toLowerCase();
}

function resolveAnalyticsTargetWordRow(targetRow, wordRowsById = new Map()) {
  const joinedWord = Array.isArray(targetRow?.test_words)
    ? targetRow.test_words[0] || null
    : (targetRow?.test_words || null);
  if (joinedWord?.id) return joinedWord;

  const testWordId = String(targetRow?.testWordId || targetRow?.test_word_id || "").trim();
  if (!testWordId) return null;
  return wordRowsById.get(testWordId) || null;
}

function isBuilderTargetWord(wordRow) {
  const source = String(wordRow?.choice?.source || "").trim().toLowerCase();
  return source === "analytics_target" || !!wordRow?.choice?.targeted_support;
}

function describeAssignmentTargetReason(target) {
  const focus = String(target?.focusGrapheme || "").trim();
  const normalizedFocus = focus ? focus.toLowerCase() : "";

  if (target?.targetReason === "builder_targeted_support") {
    return normalizedFocus ? `Builder target for ${normalizedFocus}` : "Builder target";
  }
  if (target?.targetReason === "review_retention") {
    return normalizedFocus ? `Review check for ${normalizedFocus}` : "Review check";
  }
  if (target?.targetReason === "target_independent") {
    return normalizedFocus ? `Independent check for ${normalizedFocus}` : "Independent check";
  }
  if (target?.targetReason === "target_confusion") {
    return normalizedFocus ? `Confusion check for ${normalizedFocus}` : "Confusion check";
  }
  if (target?.targetReason === "target_supported") {
    return normalizedFocus ? `Supported practice for ${normalizedFocus}` : "Supported practice";
  }
  if (target?.targetReason === "stretch_probe") {
    return normalizedFocus ? `Stretch check for ${normalizedFocus}` : "Stretch check";
  }
  if (target?.targetReason === "same_word_incorrect") return "Missed before";
  if (target?.targetReason === "same_word_retry") return "Needed retries";
  if (normalizedFocus) return `Targets ${normalizedFocus}`;
  return "Targeted word";
}

function getPupilSignalRank(tone) {
  if (tone === "red") return 0;
  if (tone === "amber") return 1;
  return 2;
}

function getAssignmentPupilSignal({ attemptedWords = 0, totalWords = 0, checkedAccuracy = 0, averageAttempts = 0 }) {
  const checked = Math.max(0, Number(attemptedWords || 0));
  const total = Math.max(0, Number(totalWords || 0));
  const accuracy = checked ? Number(checkedAccuracy || 0) : 0;
  const tries = checked ? Number(averageAttempts || 0) : 0;
  const enoughEvidence = checked >= Math.max(2, Math.min(total || 2, 3));

  if (!checked) {
    return { tone: "amber", label: "Awaiting practice" };
  }

  if (accuracy < 0.55 || tries >= 2.4 || (enoughEvidence && accuracy < 0.65)) {
    return { tone: "red", label: "Needs review" };
  }

  if (enoughEvidence && accuracy >= 0.85 && tries <= 1.5) {
    return { tone: "green", label: "Secure" };
  }

  return { tone: "amber", label: "Developing" };
}

function getVisualPupilSignal({ needsIntervention = false, checkedWords = 0, accuracy = 0, averageAttempts = 0 }) {
  const checked = Math.max(0, Number(checkedWords || 0));
  const safeAccuracy = checked ? Number(accuracy || 0) : 0;
  const safeAttempts = checked ? Number(averageAttempts || 0) : 0;

  if (needsIntervention) {
    return { tone: "red", label: "Needs review" };
  }

  if (!checked) {
    return { tone: "amber", label: "Awaiting practice" };
  }

  if (checked >= 3 && safeAccuracy >= 0.85 && safeAttempts <= 1.5) {
    return { tone: "green", label: "Secure" };
  }

  return { tone: "amber", label: "Developing" };
}

function normalizeVisualStatusFilter(value) {
  const key = String(value || "").trim().toLowerCase();
  return VISUAL_STATUS_FILTER_OPTIONS.some((item) => item.key === key) ? key : "all";
}

function getVisualStatusFilterOption(filterKey) {
  return VISUAL_STATUS_FILTER_OPTIONS.find((item) => item.key === filterKey) || VISUAL_STATUS_FILTER_OPTIONS[0];
}

function getVisualStatusKeyFromTone(tone) {
  if (tone === "red") return "needs_review";
  if (tone === "green") return "secure";
  return "developing";
}

function getVisualPupilStatusMeta(item) {
  const signalTone = String(item?.signalTone || getVisualPupilSignal(item).tone || "amber");
  const checkedWords = Math.max(0, Number(item?.checkedWords || 0));
  const key = getVisualStatusKeyFromTone(signalTone);
  const option = getVisualStatusFilterOption(key);

  if (!checkedWords && key === "developing") {
    return {
      ...option,
      label: "Awaiting practice",
    };
  }

  return {
    ...option,
    label: option.label,
  };
}

function getVisualGraphemeStatusMeta(item) {
  const band = String(item?.securityBand || "insecure");
  const key = band === "secure"
    ? "secure"
    : band === "nearly_secure"
      ? "developing"
      : "needs_review";
  const option = getVisualStatusFilterOption(key);
  return {
    ...option,
    label: option.label,
  };
}

function getAnalyticsGraphemeStatusLabel(statusKey) {
  if (statusKey === "needs_review") return "Not secure";
  if (statusKey === "secure") return "Secure";
  return "Developing";
}

function countItemsByVisualStatus(items, metaResolver) {
  const counts = {
    needs_review: 0,
    developing: 0,
    secure: 0,
  };

  for (const item of items || []) {
    const key = metaResolver(item)?.key || "developing";
    if (!Object.prototype.hasOwnProperty.call(counts, key)) continue;
    counts[key] += 1;
  }

  return counts;
}

function filterItemsByVisualStatus(items, activeFilter, metaResolver) {
  const filterKey = normalizeVisualStatusFilter(activeFilter);
  if (filterKey === "all") return [...(items || [])];
  return (items || []).filter((item) => metaResolver(item)?.key === filterKey);
}

function renderPupilSignalBadge(signal, { title = "" } = {}) {
  const tone = ["red", "amber", "green"].includes(String(signal?.tone || "")) ? String(signal.tone) : "amber";
  const label = String(signal?.label || "Developing");
  const description = title || label;

  return `
    <span class="td-pupil-signal td-pupil-signal--${escapeAttr(tone)}" title="${escapeAttr(description)}" aria-label="${escapeAttr(description)}">
      <span class="td-pupil-signal-dot" aria-hidden="true"></span>
      <span>${escapeHtml(label)}</span>
    </span>
  `;
}

function renderPupilSignalLegend() {
  return `
    <div class="td-pupil-signal-legend" aria-label="Pupil review key">
      ${renderPupilSignalBadge({ tone: "red", label: "Needs review" })}
      ${renderPupilSignalBadge({ tone: "amber", label: "Developing / waiting" })}
      ${renderPupilSignalBadge({ tone: "green", label: "Secure" })}
    </div>
  `;
}

function getGeneratedAssignmentRoleLabel(role) {
  if (role === "review") return "Review";
  if (role === "stretch") return "Stretch";
  return "Target";
}

function getAssignmentSupportLabel(support) {
  if (support === "focus") return "Focus";
  if (support === "recognition") return "Recognition";
  if (support === "supported") return "Supported";
  return "Independent";
}

function buildGeneratedAssignmentSections(results) {
  const items = Array.isArray(results) ? results : [];
  return ["review", "target", "stretch"]
    .map((role) => ({
      key: role,
      label: getGeneratedAssignmentRoleLabel(role),
      items: items.filter((item) => String(item?.assignmentRole || "") === role),
    }))
    .filter((section) => section.items.length);
}

function buildSummaryAttemptFromResult({
  assignmentId = "",
  pupilId = "",
  completedAt = null,
  result = null,
} = {}) {
  if (!result) return null;

  const testWordId = String(result?.baseTestWordId || result?.wordId || "").trim();
  const assignmentTargetId = String(result?.assignmentTargetId || "").trim();
  const wordText = String(result?.correctSpelling || result?.word || "").trim();
  if (!assignmentTargetId && !testWordId && !wordText) return null;

  return {
    assignment_id: String(assignmentId || "").trim() || null,
    pupil_id: String(pupilId || "").trim() || null,
    test_word_id: testWordId || null,
    assignment_target_id: assignmentTargetId || null,
    correct: !!result?.correct,
    attempt_number: Math.max(1, Number(result?.attemptsUsed || 1)),
    created_at: completedAt || null,
    focus_grapheme: String(result?.focusGrapheme || "").trim().toLowerCase() || null,
    pattern_type: String(result?.patternType || "").trim().toLowerCase() || null,
    word_text: wordText || null,
    typed: String(result?.typed ?? "").trim(),
    target_graphemes: Array.isArray(result?.targetGraphemes)
      ? result.targetGraphemes.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [],
  };
}

function buildAssignmentAnalyticsSnapshot({ assignmentId, classId, className, roster, wordRows, extraWordRows = [], attempts, targetRows = [], statusRows = [] }) {
  const baseTotalWords = Array.isArray(wordRows) ? wordRows.length : 0;
  const isGeneratedAssignment = isFullyGeneratedAssignmentWordRows(wordRows || []);
  const builderTargetWordRows = (wordRows || []).filter((wordRow) => isBuilderTargetWord(wordRow));
  const rosterIds = new Set((roster || []).map((item) => String(item?.id || "")).filter(Boolean));
  const latestByPupilWord = new Map();
  const latestByPupilTarget = new Map();
  const latestRowsByPupil = new Map();
  const timelineByDay = new Map();
  const combinedWordRows = [...(wordRows || [])];
  const combinedWordIds = new Set(combinedWordRows.map((row) => String(row?.id || "")).filter(Boolean));
  for (const row of extraWordRows || []) {
    const rowId = String(row?.id || "");
    if (!rowId || combinedWordIds.has(rowId)) continue;
    combinedWordRows.push(row);
    combinedWordIds.add(rowId);
  }
  const wordRowsById = new Map(combinedWordRows.map((row) => [String(row.id), row]));
  const difficultyByWordId = buildDifficultyMapFromWordRows(combinedWordRows);
  const targetRowsByPupil = new Map();
  const statusRowsByPupil = new Map();

  for (const targetRow of targetRows || []) {
    const pupilId = String(targetRow?.pupilId || targetRow?.pupil_id || "");
    const testWordId = String(targetRow?.testWordId || targetRow?.test_word_id || "");
    if (!pupilId || !testWordId) continue;
    if (rosterIds.size && !rosterIds.has(pupilId)) continue;
    const sourceWordRow = resolveAnalyticsTargetWordRow(targetRow, wordRowsById);
    const next = targetRowsByPupil.get(pupilId) || [];
    next.push({
      id: String(targetRow?.id || ""),
      pupilId,
      testWordId,
      focusGrapheme: String(targetRow?.focusGrapheme || targetRow?.focus_grapheme || "").trim().toLowerCase(),
      targetReason: String(targetRow?.targetReason || targetRow?.target_reason || "focus_grapheme"),
      targetSource: String(targetRow?.targetSource || targetRow?.target_source || "analytics"),
      createdAt: targetRow?.createdAt || targetRow?.created_at || null,
      wordRow: sourceWordRow,
    });
    targetRowsByPupil.set(pupilId, next);
  }

  for (const statusRow of statusRows || []) {
    const pupilId = String(statusRow?.pupilId || statusRow?.pupil_id || "");
    if (!pupilId) continue;
    if (rosterIds.size && !rosterIds.has(pupilId)) continue;
    statusRowsByPupil.set(pupilId, {
      pupilId,
      status: String(statusRow?.status || "assigned"),
      startedAt: statusRow?.startedAt || statusRow?.started_at || null,
      completedAt: statusRow?.completedAt || statusRow?.completed_at || null,
      lastOpenedAt: statusRow?.lastOpenedAt || statusRow?.last_opened_at || null,
      lastActivityAt: statusRow?.lastActivityAt || statusRow?.last_activity_at || null,
      totalWords: Math.max(0, Number(statusRow?.totalWords ?? statusRow?.total_words ?? 0)),
      correctWords: Math.max(0, Number(statusRow?.correctWords ?? statusRow?.correct_words ?? 0)),
      averageAttempts: Number.isFinite(Number(statusRow?.averageAttempts ?? statusRow?.average_attempts))
        ? Number(statusRow?.averageAttempts ?? statusRow?.average_attempts)
        : 0,
      scoreRate: Number.isFinite(Number(statusRow?.scoreRate ?? statusRow?.score_rate))
        ? Number(statusRow?.scoreRate ?? statusRow?.score_rate)
        : 0,
      resultJson: Array.isArray(statusRow?.resultJson ?? statusRow?.result_json)
        ? (statusRow?.resultJson ?? statusRow?.result_json)
        : [],
    });
  }

  const completedSummaryPupilIds = new Set(
    Array.from(statusRowsByPupil.values())
      .filter((row) => !!row?.completedAt && Array.isArray(row?.resultJson) && row.resultJson.length)
      .map((row) => String(row?.pupilId || ""))
      .filter(Boolean)
  );

  for (const attempt of attempts || []) {
    const pupilId = String(attempt?.pupil_id || "");
    if (rosterIds.size && pupilId && !rosterIds.has(pupilId)) continue;
    if (completedSummaryPupilIds.has(pupilId)) continue;
    const assignmentTargetId = String(attempt?.assignment_target_id || "");
    const testWordId = String(attempt?.test_word_id || "");
    if (pupilId && assignmentTargetId) {
      latestByPupilTarget.set(`${pupilId}::${assignmentTargetId}`, attempt);
    }
    if (pupilId && testWordId) {
      latestByPupilWord.set(`${pupilId}::${testWordId}`, attempt);
    }

    const dayKey = analyticsDayKey(attempt?.created_at);
    const timelineEntry = timelineByDay.get(dayKey) || {
      dayKey,
      attemptCount: 0,
      correctCount: 0,
      pupilIds: new Set(),
    };
    timelineEntry.attemptCount += 1;
    if (attempt?.correct) timelineEntry.correctCount += 1;
    if (pupilId) timelineEntry.pupilIds.add(pupilId);
    timelineByDay.set(dayKey, timelineEntry);
  }

  for (const summaryRow of statusRowsByPupil.values()) {
    if (!summaryRow?.completedAt || !Array.isArray(summaryRow?.resultJson) || !summaryRow.resultJson.length) continue;
    for (const resultEntry of summaryRow.resultJson) {
      const syntheticAttempt = buildSummaryAttemptFromResult({
        assignmentId,
        pupilId: summaryRow.pupilId,
        completedAt: summaryRow.completedAt,
        result: resultEntry,
      });
      if (!syntheticAttempt) continue;

      const pupilId = String(syntheticAttempt?.pupil_id || "");
      const assignmentTargetId = String(syntheticAttempt?.assignment_target_id || "");
      const testWordId = String(syntheticAttempt?.test_word_id || "");
      if (pupilId && assignmentTargetId) {
        latestByPupilTarget.set(`${pupilId}::${assignmentTargetId}`, syntheticAttempt);
      }
      if (pupilId && testWordId) {
        latestByPupilWord.set(`${pupilId}::${testWordId}`, syntheticAttempt);
      }

      const dayKey = analyticsDayKey(syntheticAttempt?.created_at);
      const timelineEntry = timelineByDay.get(dayKey) || {
        dayKey,
        attemptCount: 0,
        correctCount: 0,
        pupilIds: new Set(),
      };
      timelineEntry.attemptCount += 1;
      if (syntheticAttempt?.correct) timelineEntry.correctCount += 1;
      if (pupilId) timelineEntry.pupilIds.add(pupilId);
      timelineByDay.set(dayKey, timelineEntry);
    }
  }

  const visibleRoster = isGeneratedAssignment
    ? (roster || []).filter((pupil) => {
      const pupilId = String(pupil?.id || "");
      if (!pupilId) return false;
      return targetRowsByPupil.has(pupilId) || statusRowsByPupil.has(pupilId);
    })
    : (roster || []);

  for (const attempt of latestByPupilWord.values()) {
    const pupilId = String(attempt?.pupil_id || "");
    if (!pupilId) continue;
    const next = latestRowsByPupil.get(pupilId) || [];
    next.push(attempt);
    latestRowsByPupil.set(pupilId, next);
  }

  const pupilRows = visibleRoster.map((pupil) => {
    const pupilId = String(pupil?.id || "");
    const latestRows = latestRowsByPupil.get(pupilId) || [];
    const pupilTargetRows = targetRowsByPupil.get(pupilId) || [];
    const pupilStatus = statusRowsByPupil.get(pupilId) || null;
    const latestRowsByWordId = new Map(
      latestRows
        .map((item) => [String(item?.test_word_id || ""), item])
        .filter(([wordId]) => Boolean(wordId))
    );
    const generatedWordResults = isGeneratedAssignment
      ? pupilTargetRows
        .map((targetRow) => {
          const targetId = String(targetRow?.id || "");
          const wordRow = targetRow?.wordRow || wordRowsById.get(String(targetRow?.testWordId || "")) || null;
          return buildAssignmentTargetResult(
            wordRow,
            latestByPupilTarget.get(`${pupilId}::${targetId}`) || latestRowsByWordId.get(String(targetRow?.testWordId || "")) || null,
            {
              ...targetRow,
              assignmentRole: String(wordRow?.choice?.assignment_role || "target"),
              assignmentSupport: String(wordRow?.choice?.assignment_support || "independent"),
            }
          );
        })
        .filter(Boolean)
      : [];
    const assignedTargetResults = !isGeneratedAssignment
      ? pupilTargetRows
        .map((targetRow) => {
          const targetId = String(targetRow?.id || "");
          const wordRow = targetRow?.wordRow || wordRowsById.get(String(targetRow?.testWordId || "")) || null;
          return buildAssignmentTargetResult(
            wordRow,
            latestByPupilTarget.get(`${pupilId}::${targetId}`) || latestRowsByWordId.get(String(targetRow?.testWordId || "")) || null,
            {
              ...targetRow,
              assignmentRole: String(wordRow?.choice?.assignment_role || "target"),
              assignmentSupport: String(wordRow?.choice?.assignment_support || "independent"),
            }
          );
        })
        .filter(Boolean)
      : [];
    const wordResults = isGeneratedAssignment
      ? generatedWordResults
      : (wordRows || []).map((wordRow) =>
        buildAssignmentWordResult(
          wordRow,
          latestRowsByWordId.get(String(wordRow?.id || "")) || null
        )
      );
    const targetWords = isGeneratedAssignment
      ? generatedWordResults
      : assignedTargetResults.length
        ? assignedTargetResults
        : builderTargetWordRows
          .map((wordRow) => buildAssignmentTargetResult(
            wordRow,
            latestRowsByWordId.get(String(wordRow?.id || "")) || null,
            {
              id: `builder:${String(wordRow?.id || "")}`,
              testWordId: String(wordRow?.id || ""),
              focusGrapheme: focusFromAssignmentWordRow(wordRow),
              targetReason: "builder_targeted_support",
              targetSource: "builder",
            }
          ))
          .filter(Boolean);
    const visibleWordResults = isGeneratedAssignment ? generatedWordResults : [...wordResults, ...targetWords];
    const totalWords = visibleWordResults.length;
    const attemptedWords = visibleWordResults.filter((item) => item?.statusKey !== "not_started").length;
    const correctWords = visibleWordResults.filter((item) => item?.correct).length;
    const scoreRate = totalWords ? correctWords / totalWords : 0;
    const checkedAccuracy = attemptedWords ? correctWords / attemptedWords : 0;
    const firstTimeCorrectRate = attemptedWords
      ? visibleWordResults.filter((item) => item?.correct && Math.max(1, Number(item?.attemptsUsed || 1)) === 1).length / attemptedWords
      : 0;
    const averageAttempts = attemptedWords
      ? visibleWordResults
        .filter((item) => item?.latestAttempt)
        .reduce((sum, item) => sum + Math.max(1, Number(item?.attemptsUsed || 1)), 0) / attemptedWords
      : 0;
    const completionRate = totalWords ? attemptedWords / totalWords : 0;
    const latestActivity = visibleWordResults
      .map((item) => new Date(item?.latestAttempt?.created_at || 0).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a)[0] || null;
    const completedByStatus = !!pupilStatus?.completedAt || (!pupilStatus && totalWords > 0 && attemptedWords >= totalWords);
    const startedByStatus = !!(pupilStatus?.startedAt || pupilStatus?.lastOpenedAt || pupilStatus?.lastActivityAt);
    console.log("Teacher completion source row:", {
      assignmentId,
      pupilId,
      statusRow: pupilStatus,
      attemptedWords,
      totalWords,
      latestActivity: latestActivity ? new Date(latestActivity).toISOString() : null,
      targetWordCount: pupilTargetRows.length,
    });
    const signal = getAssignmentPupilSignal({
      attemptedWords,
      totalWords,
      checkedAccuracy,
      averageAttempts,
    });
    const attainmentIndicator = estimateSpellingAttainmentIndicator({
      responses: visibleWordResults
        .filter((item) => item?.latestAttempt)
        .map((item) => ({
          correct: !!item?.correct,
          difficultyScore: difficultyByWordId.get(String(item?.baseTestWordId || item?.wordId || ""))?.coreScore
            ?? difficultyByWordId.get(String(item?.baseTestWordId || item?.wordId || ""))?.score
            ?? 50,
        })),
      checkedAccuracy,
      firstTimeCorrectRate,
      completionRate,
      averageAttempts,
    });
    const generatedSections = isGeneratedAssignment ? buildGeneratedAssignmentSections(generatedWordResults) : [];
    const resolvedStatus = completedByStatus ? "Complete" : (startedByStatus || attemptedWords > 0 ? "In progress" : "Not started");
    console.log("Resolved pupil assignment status:", {
      assignmentId,
      pupilId,
      status: resolvedStatus,
      completedByStatus,
      startedByStatus,
      attemptedWords,
      totalWords,
      completedAt: pupilStatus?.completedAt || null,
    });
    console.log("TEACHER ROW SOURCE rows:", {
      assignmentId,
      pupilId,
      pupilName: pupilDisplayName(pupil),
      latestRows: latestRows.map((attempt) => ({
        assignmentId: attempt?.assignment_id || null,
        pupilId: attempt?.pupil_id || null,
        testWordId: attempt?.test_word_id || null,
        assignmentTargetId: attempt?.assignment_target_id || null,
        wordText: attempt?.word_text || "",
        correct: !!attempt?.correct,
        attemptNumber: attempt?.attempt_number || null,
      })),
      targetRows: pupilTargetRows.map((target) => ({
        id: target?.id || "",
        testWordId: target?.testWordId || "",
        focusGrapheme: target?.focusGrapheme || "",
        targetReason: target?.targetReason || "",
      })),
    });
    if (completedByStatus && attemptedWords === 0) {
      console.log("HEADER VS ROW MISMATCH:", {
        assignmentId,
        pupilId,
        pupilName: pupilDisplayName(pupil),
        reason: "Completion header is driven by assignment_pupil_statuses, but no assignment-scoped attempt rows were resolved for this pupil row.",
        statusRow: pupilStatus,
        latestRowsCount: latestRows.length,
        targetRowsCount: pupilTargetRows.length,
      });
    }
    const exclusionReasons = [];
    if (completedByStatus && attemptedWords === 0) exclusionReasons.push("completed_without_assignment_attempt_rows");
    if (pupilTargetRows.length > 0 && targetWords.length === 0) exclusionReasons.push("target_rows_present_but_not_materialised");
    if (!latestRows.length) exclusionReasons.push("no_assignment_attempt_rows");
    if (exclusionReasons.length) {
      console.log("ANALYTICS EXCLUSION REASON:", {
        assignmentId,
        pupilId,
        pupilName: pupilDisplayName(pupil),
        reasons: exclusionReasons,
      });
    }

    return {
      pupilId,
      name: pupilDisplayName(pupil),
      status: resolvedStatus,
      startedAt: pupilStatus?.startedAt || null,
      completedAt: pupilStatus?.completedAt || (completedByStatus ? (latestActivity ? new Date(latestActivity).toISOString() : null) : null),
      totalWords,
      attemptedWords,
      correctWords,
      incorrectWords: Math.max(0, attemptedWords - correctWords),
      remainingWords: Math.max(0, totalWords - attemptedWords),
      scoreRate,
      checkedAccuracy,
      firstTimeCorrectRate,
      averageAttempts,
      completionRate,
      latestActivity,
      attainmentIndicator,
      wordResults,
      targetWords,
      generatedSections,
      targetWordCount: targetWords.length,
      secureWordCount: visibleWordResults.filter((item) => item.statusKey === "secure").length,
      developingWordCount: visibleWordResults.filter((item) => item.statusKey === "developing").length,
      needsReviewWordCount: visibleWordResults.filter((item) => item.statusKey === "needs_review").length,
      notStartedWordCount: visibleWordResults.filter((item) => item.statusKey === "not_started").length,
      signalTone: signal.tone,
      signalLabel: signal.label,
      priorityTarget: chooseBestFocusGrapheme(
        visibleWordResults
          .filter((item) => item?.statusKey === "needs_review" || item?.statusKey === "developing")
          .map((item) => item?.focusGrapheme || analyticsTargetForAttempt(item?.latestAttempt))
      ),
    };
  }).sort((a, b) => {
    if (getPupilSignalRank(a.signalTone) !== getPupilSignalRank(b.signalTone)) {
      return getPupilSignalRank(a.signalTone) - getPupilSignalRank(b.signalTone);
    }
    const statusRank = { "In progress": 0, "Not started": 1, "Complete": 2 };
    if ((statusRank[a.status] ?? 9) !== (statusRank[b.status] ?? 9)) {
      return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    }
    if (a.checkedAccuracy !== b.checkedAccuracy) return a.checkedAccuracy - b.checkedAccuracy;
    if (a.averageAttempts !== b.averageAttempts) return b.averageAttempts - a.averageAttempts;
    return a.name.localeCompare(b.name);
  });

  const latestRows = Array.from(latestByPupilWord.values());
  const startedCount = pupilRows.filter((item) => item.status !== "Not started").length;
  const completedCount = pupilRows.filter((item) => item.status === "Complete").length;
  const notStartedPupils = pupilRows.filter((item) => item.status === "Not started");
  const averageScore = pupilRows.length
    ? pupilRows.reduce((sum, item) => sum + item.scoreRate, 0) / pupilRows.length
    : 0;
  const averageIndicatorScore = averageSpellingIndicator(pupilRows.map((item) => item.attainmentIndicator));
  const attainmentHeadline = buildAttainmentHeadlineSummary(pupilRows);
  const checkedAccuracy = latestRows.length
    ? latestRows.filter((item) => item?.correct).length / latestRows.length
    : 0;
  const averageAttempts = latestRows.length
    ? latestRows.reduce((sum, item) => sum + Math.max(1, Number(item?.attempt_number || 1)), 0) / latestRows.length
    : 0;
  const completionRate = visibleRoster.length ? completedCount / visibleRoster.length : 0;

  const graphemeStats = new Map();
  const wordStats = new Map();
  for (const attempt of latestRows) {
    const target = analyticsTargetForAttempt(attempt);
    const wordKey = String(attempt?.test_word_id || attempt?.word_text || "");
    const wordLabel = String(attempt?.word_text || wordRowsById.get(String(attempt?.test_word_id || ""))?.word || "Unknown word");
    const graphemeEntry = graphemeStats.get(target) || {
      target,
      total: 0,
      correct: 0,
      incorrect: 0,
      attemptTotal: 0,
      firstTrySuccessCount: 0,
      words: new Set(),
    };
    graphemeEntry.total += 1;
    if (attempt?.correct) graphemeEntry.correct += 1;
    else graphemeEntry.incorrect += 1;
    graphemeEntry.attemptTotal += Math.max(1, Number(attempt?.attempt_number || 1));
    if (attempt?.correct && Math.max(1, Number(attempt?.attempt_number || 1)) === 1) {
      graphemeEntry.firstTrySuccessCount += 1;
    }
    graphemeEntry.words.add(wordLabel);
    graphemeStats.set(target, graphemeEntry);

    const wordEntry = wordStats.get(wordKey) || {
      word: wordLabel,
      total: 0,
      correct: 0,
      attemptTotal: 0,
    };
    wordEntry.total += 1;
    if (attempt?.correct) wordEntry.correct += 1;
    wordEntry.attemptTotal += Math.max(1, Number(attempt?.attempt_number || 1));
    wordStats.set(wordKey, wordEntry);
  }

  const graphemeRows = Array.from(graphemeStats.values())
    .map((item) => {
      const next = {
        ...item,
        accuracy: item.total ? item.correct / item.total : 0,
        averageAttempts: item.total ? item.attemptTotal / item.total : 0,
        firstTrySuccessRate: item.total ? item.firstTrySuccessCount / item.total : 0,
        wordSamples: Array.from(item.words).slice(0, 3),
        practiceWords: Array.from(item.words).slice(0, COMMON_CONFUSION_TEST_WORD_LIMIT),
      };
      return {
        ...next,
        securityBand: getSecurityBand(next),
      };
    })
    .filter((item) => item.target && item.target !== "general");

  const weakGraphemes = graphemeRows
    .filter((item) => item.total >= 2)
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      if (b.incorrect !== a.incorrect) return b.incorrect - a.incorrect;
      return String(a.target || "").localeCompare(String(b.target || ""));
    })
    .slice(0, 5);

  const strongGraphemes = graphemeRows
    .filter((item) => item.total >= 2)
    .sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (b.total !== a.total) return b.total - a.total;
      return String(a.target || "").localeCompare(String(b.target || ""));
    })
    .slice(0, 5);

  const hardestWords = Array.from(wordStats.values())
    .map((item) => ({
      ...item,
      accuracy: item.total ? item.correct / item.total : 0,
      averageAttempts: item.total ? item.attemptTotal / item.total : 0,
    }))
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      if (b.averageAttempts !== a.averageAttempts) return b.averageAttempts - a.averageAttempts;
      return String(a.word || "").localeCompare(String(b.word || ""));
    })
    .slice(0, 5);

  const timelineRows = Array.from(timelineByDay.values())
    .map((item) => ({
      dayKey: item.dayKey,
      attemptCount: item.attemptCount,
      correctCount: item.correctCount,
      pupilCount: item.pupilIds.size,
      accuracy: item.attemptCount ? item.correctCount / item.attemptCount : 0,
    }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    .slice(-7);
  const assignmentTotalWords = isGeneratedAssignment
    ? Math.max(0, ...pupilRows.map((item) => Number(item?.totalWords || 0)))
    : Math.max(baseTotalWords, ...pupilRows.map((item) => Number(item?.totalWords || 0)));

  return {
    assignmentId,
    classId,
    className,
    rosterCount: visibleRoster.length,
    totalWords: assignmentTotalWords,
    wordColumns: isGeneratedAssignment
      ? []
      : (wordRows || []).map((row) => ({
        id: String(row?.id || ""),
        word: String(row?.word || "").trim() || "Unknown word",
        position: Number(row?.position || 0),
      })),
    isGenerated: isGeneratedAssignment,
    startedCount,
    completedCount,
    notStartedCount: notStartedPupils.length,
    averageScore,
    averageIndicatorScore,
    ...attainmentHeadline,
    checkedAccuracy,
    averageAttempts,
    completionRate,
    weakGraphemes,
    strongGraphemes,
    hardestWords,
    pupilRows,
    notStartedPupils,
    timelineRows,
  };
}

async function refreshVisualAnalyticsSummary() {
  const previousGroup = state.visualAnalytics.activeGroup;
  const previousOpen = !!state.visualAnalytics.summaryOpen;
  const previousType = state.visualAnalytics.selectedScopeType;
  const previousId = state.visualAnalytics.selectedScopeId;
  const previousSelectedAssignmentByScope = state.visualAnalytics.selectedAssignmentByScope || {};
  const previousSearch = state.visualAnalytics.pupilSearch || "";
  const previousGrapheme = normalizeAnalyticsGrapheme(state.visualAnalytics.selectedGrapheme);
  const previousCompareSelections = state.visualAnalytics.compareSelections || [];

  state.visualAnalytics = {
    ...state.visualAnalytics,
    status: "loading",
    message: "",
  };

  try {
    const next = await loadVisualAnalyticsSummaryData();
    const previousKey = createVisualScopeKey(previousType, previousId);
    const hasPrevious = Object.prototype.hasOwnProperty.call(next.summaries, previousKey);
    const nextGraphemeOptions = getVisualAnalyticsGraphemeOptions(next.sourceData);
    const selectedGrapheme = nextGraphemeOptions.some((item) => item.value === previousGrapheme) ? previousGrapheme : "";

    state.visualAnalytics = {
      ...state.visualAnalytics,
      status: "ready",
      message: "",
      windowDays: next.windowDays,
      sourceData: next.sourceData || null,
      selectedGrapheme,
      catalog: next.catalog,
      summaries: next.summaries,
      activeGroup: ["overview", "year_group", "class", "pupil"].includes(previousGroup) ? previousGroup : "overview",
      summaryOpen: hasPrevious ? previousOpen : false,
      selectedScopeType: hasPrevious ? previousType : "overview",
      selectedScopeId: hasPrevious ? previousId : "",
      selectedAssignmentByScope: previousSelectedAssignmentByScope,
      pupilSearch: previousSearch,
      compareSelections: sanitizeVisualCompareSelections(previousCompareSelections, next.sourceData),
    };
    if (state.visualAnalytics.summaryOpen && state.visualAnalytics.selectedScopeType === "pupil") {
      primeVisualSummaryAssignmentSelection(state.visualAnalytics.selectedScopeType, state.visualAnalytics.selectedScopeId);
    }
  } catch (error) {
    console.error("visual analytics load error:", error);
    state.visualAnalytics = {
      ...state.visualAnalytics,
      status: "error",
      message: error?.message || "Could not load summary analytics.",
      sourceData: null,
      selectedGrapheme: "",
      catalog: {
        overview: null,
        yearGroups: [],
        classes: [],
        pupils: [],
      },
      summaries: {},
      activeGroup: ["overview", "year_group", "class", "pupil"].includes(previousGroup) ? previousGroup : "overview",
      summaryOpen: false,
      selectedScopeType: "overview",
      selectedScopeId: "",
      selectedAssignmentByScope: previousSelectedAssignmentByScope,
      pupilSearch: previousSearch,
      compareSelections: [],
    };
  }
}

async function loadVisualAnalyticsSummaryData() {
  if (!state.user?.id) {
    return {
      windowDays: VISUAL_ANALYTICS_WINDOW_DAYS,
      sourceData: null,
      catalog: {
        overview: null,
        yearGroups: [],
        classes: [],
        pupils: [],
      },
      summaries: {},
    };
  }

  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id, name, year_group")
    .order("name", { ascending: true });
  if (classError) throw classError;

  const classIds = [...new Set((classes || []).map((item) => String(item?.id || "")).filter(Boolean))];

  const [assignments, memberships] = await Promise.all([
    classIds.length
      ? loadPaginatedRows(
        (from, to) => supabase
          .from("assignments_v2")
          .select(`
            id,
            class_id,
            test_id,
            created_at,
            end_at,
            tests (
              title
            )
          `)
          .in("class_id", classIds)
          .order("created_at", { ascending: false })
          .range(from, to),
        200,
      )
      : Promise.resolve([]),
    classIds.length
      ? supabase
        .from("pupil_classes")
        .select("class_id, pupil_id, active")
        .in("class_id", classIds)
        .eq("active", true)
        .then(({ data, error }) => {
          if (error) throw error;
          return data || [];
        })
      : Promise.resolve([]),
  ]);

  const pupilIds = [...new Set((memberships || []).map((item) => String(item?.pupil_id || "")).filter(Boolean))];
  const pupils = [];
  for (const chunk of chunkArray(pupilIds, 200)) {
    if (!chunk.length) continue;
    const { data, error } = await supabase
      .from("pupils")
      .select("id, first_name, surname, username")
      .in("id", chunk);
    if (error) throw error;
    pupils.push(...(data || []));
  }

  const cutoff = new Date(Date.now() - VISUAL_ANALYTICS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const assignmentIds = [...new Set((assignments || []).map((item) => String(item?.id || "")).filter(Boolean))];
  const testIds = [...new Set((assignments || []).map((item) => String(item?.test_id || "")).filter(Boolean))];
  const attempts = [];
  for (const chunk of chunkArray(assignmentIds, 100)) {
    if (!chunk.length) continue;
    const rows = await loadPaginatedRows(
      (from, to) => supabase
        .from("attempts")
        .select("assignment_id, pupil_id, test_word_id, correct, attempt_number, created_at, focus_grapheme, pattern_type, word_text, typed, target_graphemes")
        .gte("created_at", cutoff)
        .in("assignment_id", chunk)
        .order("created_at", { ascending: true })
        .range(from, to),
      500,
    );
    attempts.push(...rows);
  }

  attempts.sort((a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime());

  const wordRows = [];
  for (const chunk of chunkArray(testIds, 100)) {
    if (!chunk.length) continue;
    const { data, error } = await supabase
      .from("test_words")
      .select("id, test_id, word, choice")
      .in("test_id", chunk);
    if (error) throw error;
    wordRows.push(...(data || []));
  }

  return buildVisualAnalyticsExplorerData({
    classes: classes || [],
    assignments,
    memberships,
    pupils,
    attempts,
    wordRows,
    windowDays: VISUAL_ANALYTICS_WINDOW_DAYS,
  });
}

async function loadPaginatedRows(fetchPage, pageSize = 400, maxPages = 24) {
  const rows = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function chunkArray(items, size = 100) {
  const list = Array.isArray(items) ? items : [];
  const chunkSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let index = 0; index < list.length; index += chunkSize) {
    chunks.push(list.slice(index, index + chunkSize));
  }
  return chunks;
}

function createVisualScopeKey(scopeType, scopeId = "") {
  return `${String(scopeType || "overview")}::${String(scopeId || "")}`;
}

function createVisualRankingListKey(scopeType, scopeId = "", target = "classes") {
  return `${createVisualScopeKey(scopeType, scopeId)}::${String(target || "classes")}`;
}

function getVisualRankingTargetOptions(summary) {
  const scopeType = String(summary?.scopeType || "");
  if (["overview", "year_group", "compare"].includes(scopeType)) {
    return VISUAL_RANK_TARGET_OPTIONS;
  }
  if (scopeType === "class") {
    return [VISUAL_RANK_TARGET_OPTIONS.find((item) => item.value === "pupils")].filter(Boolean);
  }
  return [];
}

function getSelectedVisualRankingTarget(summary) {
  const options = getVisualRankingTargetOptions(summary);
  if (!options.length) return "";

  const scopeKey = createVisualScopeKey(summary?.scopeType, summary?.scopeId);
  const saved = String(state.visualAnalytics.rankingTargetByScope?.[scopeKey] || "");
  if (options.some((item) => String(item.value) === saved)) return saved;

  const defaultValue = String(summary?.scopeType || "") === "class" ? "pupils" : "classes";
  return options.some((item) => String(item.value) === defaultValue)
    ? defaultValue
    : String(options[0]?.value || "");
}

function setSelectedVisualRankingTarget(scopeType, scopeId, target) {
  const nextTarget = String(target || "");
  const scopeKey = createVisualScopeKey(scopeType, scopeId);
  state.visualAnalytics.rankingTargetByScope = {
    ...state.visualAnalytics.rankingTargetByScope,
    [scopeKey]: nextTarget,
  };
}

function getVisibleVisualRankingRowCount(summary, target, total) {
  const totalRows = Math.max(0, Number(total) || 0);
  if (!totalRows) return 0;

  const listKey = createVisualRankingListKey(summary?.scopeType, summary?.scopeId, target);
  const saved = Number(state.visualAnalytics.visibleRankingRowsByScope?.[listKey] || VISUAL_RANK_ROWS_STEP);
  return Math.min(totalRows, Math.max(VISUAL_RANK_ROWS_STEP, saved));
}

function showMoreVisualRankingRows(scopeType, scopeId, target, total) {
  const totalRows = Math.max(0, Number(total) || 0);
  if (!totalRows) return;

  const summary = { scopeType, scopeId };
  const listKey = createVisualRankingListKey(scopeType, scopeId, target);
  const current = getVisibleVisualRankingRowCount(summary, target, totalRows);
  state.visualAnalytics.visibleRankingRowsByScope = {
    ...state.visualAnalytics.visibleRankingRowsByScope,
    [listKey]: Math.min(totalRows, current + VISUAL_RANK_ROWS_STEP),
  };
}

function resetVisibleVisualRankingRows(scopeType, scopeId, target) {
  const listKey = createVisualRankingListKey(scopeType, scopeId, target);
  state.visualAnalytics.visibleRankingRowsByScope = {
    ...state.visualAnalytics.visibleRankingRowsByScope,
    [listKey]: VISUAL_RANK_ROWS_STEP,
  };
}

function normalizeAnalyticsGrapheme(value) {
  return String(value || "").trim().toLowerCase();
}

function getVisualAnalyticsGraphemeOptions(data = state.visualAnalytics.sourceData) {
  const counts = new Map();
  for (const row of data?.latestRows || []) {
    const target = normalizeAnalyticsGrapheme(analyticsTargetForAttempt(row));
    if (!target || target === "general") continue;
    counts.set(target, (counts.get(target) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      label: value,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function isVisualAnalyticsGraphemeAvailable(grapheme, data = state.visualAnalytics.sourceData) {
  const normalized = normalizeAnalyticsGrapheme(grapheme);
  if (!normalized) return false;
  return getVisualAnalyticsGraphemeOptions(data).some((item) => item.value === normalized);
}

function getSelectedVisualAnalyticsGrapheme() {
  const normalized = normalizeAnalyticsGrapheme(state.visualAnalytics.selectedGrapheme);
  return isVisualAnalyticsGraphemeAvailable(normalized) ? normalized : "";
}

function getVisualAnalyticsViewModel() {
  const data = state.visualAnalytics.sourceData;
  const graphemeOptions = getVisualAnalyticsGraphemeOptions(data);
  const selectedGrapheme = graphemeOptions.some((item) => item.value === normalizeAnalyticsGrapheme(state.visualAnalytics.selectedGrapheme))
    ? normalizeAnalyticsGrapheme(state.visualAnalytics.selectedGrapheme)
    : "";

  if (!data || !selectedGrapheme) {
    return {
      catalog: state.visualAnalytics.catalog,
      summaries: state.visualAnalytics.summaries,
      sourceData: data,
      selectedGrapheme: "",
      graphemeOptions,
    };
  }

  if (
    visualAnalyticsDerivedCache.sourceData === data &&
    visualAnalyticsDerivedCache.grapheme === selectedGrapheme &&
    visualAnalyticsDerivedCache.viewModel
  ) {
    return visualAnalyticsDerivedCache.viewModel;
  }

  const viewModel = {
    ...buildVisualAnalyticsExplorerData({
      classes: data.classes || [],
      assignments: data.assignments || [],
      memberships: data.memberships || [],
      pupils: data.pupils || [],
      attempts: data.attempts || [],
      wordRows: data.wordRows || [],
      windowDays: data.windowDays || VISUAL_ANALYTICS_WINDOW_DAYS,
      graphemeFilter: selectedGrapheme,
    }),
    selectedGrapheme,
    graphemeOptions,
  };

  visualAnalyticsDerivedCache = {
    sourceData: data,
    grapheme: selectedGrapheme,
    viewModel,
  };

  return viewModel;
}

function createVisualCompareSelection(mode = "year_group") {
  visualCompareSeed += 1;
  return {
    id: `compare-${visualCompareSeed}`,
    mode,
    yearGroup: "",
    classIds: [],
  };
}

function createVisualCompareSelectionFromCurrentView() {
  const summary = getSelectedVisualSummary();
  if (summary?.scopeType === "year_group") {
    const selection = createVisualCompareSelection("year_group");
    selection.yearGroup = String(summary.scopeId || "");
    return selection;
  }
  if (summary?.scopeType === "class" && summary.scopeId) {
    const selection = createVisualCompareSelection("class_set");
    selection.classIds = [String(summary.scopeId)];
    return selection;
  }
  if (summary?.scopeType === "overview") {
    return createVisualCompareSelection("overview");
  }
  return createVisualCompareSelection("year_group");
}

function sanitizeVisualCompareSelections(selections, data) {
  const validClassIds = new Set((data?.classes || []).map((item) => String(item?.id || "")).filter(Boolean));
  const validYearGroups = new Set(
    (data?.classes || [])
      .map((item) => String(item?.year_group || "").trim())
      .filter(Boolean),
  );
  const yearGroupList = Array.from(validYearGroups).sort((a, b) => a.localeCompare(b));

  return (selections || [])
    .slice(0, VISUAL_COMPARE_LIMIT)
    .map((selection) => {
      const mode = ["overview", "year_group", "class_set"].includes(String(selection?.mode || ""))
        ? String(selection.mode)
        : "year_group";
      const next = {
        id: String(selection?.id || createVisualCompareSelection(mode).id),
        mode,
        yearGroup: "",
        classIds: [],
      };

      if (mode === "year_group") {
        const yearGroup = String(selection?.yearGroup || "").trim();
        next.yearGroup = validYearGroups.has(yearGroup) ? yearGroup : String(yearGroupList[0] || "");
      }

      if (mode === "class_set") {
        next.classIds = [...new Set(
          (selection?.classIds || [])
            .map((item) => String(item || ""))
            .filter((item) => validClassIds.has(item)),
        )];
      }

      return next;
    });
}

function buildVisualAnalyticsScopedData(data, classIds) {
  const selectedClassIdSet = new Set((classIds || []).map((item) => String(item || "")).filter(Boolean));
  const classes = (data?.classes || []).filter((item) => selectedClassIdSet.has(String(item?.id || "")));
  const assignments = (data?.assignments || []).filter((item) => selectedClassIdSet.has(String(item?.class_id || "")));
  const memberships = (data?.memberships || []).filter((item) => selectedClassIdSet.has(String(item?.class_id || "")));
  const attempts = (data?.attempts || []).filter((item) => selectedClassIdSet.has(String(item?.class_id || "")));
  const latestRows = (data?.latestRows || []).filter((item) => selectedClassIdSet.has(String(item?.class_id || "")));
  const pupilIdSet = new Set(memberships.map((item) => String(item?.pupil_id || "")).filter(Boolean));
  const pupils = (data?.pupils || []).filter((item) => pupilIdSet.has(String(item?.id || "")));
  const classById = new Map(classes.map((item) => [String(item?.id || ""), item]));
  const pupilById = new Map(pupils.map((item) => [String(item?.id || ""), item]));
  const assignmentById = new Map(assignments.map((item) => [String(item?.id || ""), item]));
  const membershipPairs = new Set();
  const pupilIdsByClass = new Map();
  const classIdsByPupil = new Map();

  for (const membership of memberships) {
    const classId = String(membership?.class_id || "");
    const pupilId = String(membership?.pupil_id || "");
    if (!classId || !pupilId) continue;
    membershipPairs.add(`${classId}::${pupilId}`);

    const classRoster = pupilIdsByClass.get(classId) || [];
    classRoster.push(pupilId);
    pupilIdsByClass.set(classId, classRoster);

    const pupilClasses = classIdsByPupil.get(pupilId) || [];
    pupilClasses.push(classId);
    classIdsByPupil.set(pupilId, pupilClasses);
  }

  return {
    windowDays: data?.windowDays || VISUAL_ANALYTICS_WINDOW_DAYS,
    classes,
    assignments,
    memberships,
    pupils,
    attempts,
    latestRows,
    wordRows: data?.wordRows || [],
    difficultyByWordId: data?.difficultyByWordId || new Map(),
    classById,
    pupilById,
    assignmentById,
    pupilIdsByClass,
    classIdsByPupil,
    membershipPairs,
  };
}

function resolveVisualCompareSelection(selection, data) {
  const mode = ["overview", "year_group", "class_set"].includes(String(selection?.mode || ""))
    ? String(selection.mode)
    : "year_group";
  const classes = data?.classes || [];

  if (mode === "overview") {
    const classIds = classes.map((item) => String(item?.id || "")).filter(Boolean);
    return {
      mode,
      label: "All classes",
      tone: "overview",
      classIds,
    };
  }

  if (mode === "year_group") {
    const yearGroup = String(selection?.yearGroup || "").trim();
    const classIds = classes
      .filter((item) => String(item?.year_group || "").trim() === yearGroup)
      .map((item) => String(item?.id || ""))
      .filter(Boolean);
    return {
      mode,
      label: yearGroup || "Select a year group",
      tone: "year_group",
      yearGroup,
      classIds,
    };
  }

  const classIds = [...new Set(
    (selection?.classIds || [])
      .map((item) => String(item || ""))
      .filter(Boolean),
  )];
  const labels = classIds
    .map((classId) => classes.find((item) => String(item?.id || "") === classId)?.name || "")
    .filter(Boolean);
  const label = labels.length
    ? labels.length === 1
      ? labels[0]
      : labels.length === 2
        ? labels.join(" + ")
        : `${labels.slice(0, 2).join(" + ")} +${labels.length - 2}`
    : "Select classes";

  return {
    mode,
    label,
    tone: "class_set",
    classIds,
  };
}

function buildVisualComparisonSummary(selection, data, graphemeFilter = "") {
  const resolved = resolveVisualCompareSelection(selection, data);
  if (!resolved.classIds.length) return null;

  const scopedData = buildVisualAnalyticsScopedData(data, resolved.classIds);
  const summary = buildVisualScopeSummary({ scopeType: "overview", scopeId: "", data: scopedData, graphemeFilter });
  const subtitleBase = resolved.mode === "overview"
    ? `Whole-school snapshot across ${summary.classCount} classes over the last ${scopedData.windowDays} days.`
    : resolved.mode === "year_group"
      ? `${summary.classCount} classes and ${summary.pupilCount} pupils in ${resolved.label} over the last ${scopedData.windowDays} days.`
      : `${summary.classCount} selected classes and ${summary.pupilCount} pupils over the last ${scopedData.windowDays} days.`;
  const subtitle = normalizeAnalyticsGrapheme(graphemeFilter)
    ? `${subtitleBase} Focused on ${normalizeAnalyticsGrapheme(graphemeFilter)}.`
    : subtitleBase;

  return {
    ...summary,
    scopeType: "compare",
    scopeId: String(selection?.id || ""),
    label: resolved.label,
    subtitle,
    comparisonMode: resolved.mode,
    comparisonTone: resolved.tone,
  };
}

function buildVisualAnalyticsExplorerData({ classes, assignments, memberships, pupils, attempts, wordRows = [], windowDays, graphemeFilter = "" }) {
  const classById = new Map((classes || []).map((item) => [String(item?.id || ""), item]));
  const pupilById = new Map((pupils || []).map((item) => [String(item?.id || ""), item]));
  const assignmentById = new Map((assignments || []).map((item) => [String(item?.id || ""), item]));
  const difficultyByWordId = buildDifficultyMapFromWordRows(wordRows || []);
  const activeMemberships = (memberships || []).filter((item) => item?.active !== false);
  const membershipPairs = new Set();
  const pupilIdsByClass = new Map();
  const classIdsByPupil = new Map();

  for (const membership of activeMemberships) {
    const classId = String(membership?.class_id || "");
    const pupilId = String(membership?.pupil_id || "");
    if (!classId || !pupilId) continue;
    membershipPairs.add(`${classId}::${pupilId}`);

    const classRoster = pupilIdsByClass.get(classId) || [];
    classRoster.push(pupilId);
    pupilIdsByClass.set(classId, classRoster);

    const pupilClasses = classIdsByPupil.get(pupilId) || [];
    pupilClasses.push(classId);
    classIdsByPupil.set(pupilId, pupilClasses);
  }

  const scopedAttempts = (attempts || [])
    .map((attempt) => {
      const assignmentId = String(attempt?.assignment_id || "");
      const classId = String(assignmentById.get(assignmentId)?.class_id || "");
      return {
        ...attempt,
        assignment_id: assignmentId,
        class_id: classId,
      };
    })
    .filter((attempt) => {
      const classId = String(attempt?.class_id || "");
      const pupilId = String(attempt?.pupil_id || "");
      return classId && pupilId && membershipPairs.has(`${classId}::${pupilId}`);
    })
    .sort((a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime());

  const latestByPupilWord = new Map();
  for (const attempt of scopedAttempts) {
    const pupilId = String(attempt?.pupil_id || "");
    const wordKey = String(attempt?.test_word_id || attempt?.word_text || "");
    if (!pupilId || !wordKey) continue;
    latestByPupilWord.set(`${pupilId}::${wordKey}`, attempt);
  }

  const data = {
    windowDays,
    classes: classes || [],
    assignments: assignments || [],
    memberships: activeMemberships,
    pupils: pupils || [],
    attempts: scopedAttempts,
    latestRows: Array.from(latestByPupilWord.values()),
    wordRows: wordRows || [],
    difficultyByWordId,
    classById,
    pupilById,
    assignmentById,
    pupilIdsByClass,
    classIdsByPupil,
    membershipPairs,
  };

  const summaries = {};
  const overviewSummary = buildVisualScopeSummary({ scopeType: "overview", scopeId: "", data, graphemeFilter });
  summaries[createVisualScopeKey("overview", "")] = overviewSummary;

  const yearGroups = Array.from(
    new Set(
      (classes || [])
        .map((item) => String(item?.year_group || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  for (const yearGroup of yearGroups) {
    summaries[createVisualScopeKey("year_group", yearGroup)] = buildVisualScopeSummary({
      scopeType: "year_group",
      scopeId: yearGroup,
      data,
      graphemeFilter,
    });
  }

  for (const cls of classes || []) {
    const classId = String(cls?.id || "");
    if (!classId) continue;
    summaries[createVisualScopeKey("class", classId)] = buildVisualScopeSummary({
      scopeType: "class",
      scopeId: classId,
      data,
      graphemeFilter,
    });
  }

  for (const pupil of pupils || []) {
    const pupilId = String(pupil?.id || "");
    if (!pupilId) continue;
    summaries[createVisualScopeKey("pupil", pupilId)] = buildVisualScopeSummary({
      scopeType: "pupil",
      scopeId: pupilId,
      data,
      graphemeFilter,
    });
  }

  const catalog = {
    overview: buildVisualScopeCatalogEntry(overviewSummary),
    yearGroups: yearGroups
      .map((item) => buildVisualScopeCatalogEntry(summaries[createVisualScopeKey("year_group", item)]))
      .filter(Boolean),
    classes: (classes || [])
      .map((item) => buildVisualScopeCatalogEntry(summaries[createVisualScopeKey("class", item?.id)]))
      .filter(Boolean),
    pupils: (pupils || [])
      .map((item) => buildVisualScopeCatalogEntry(summaries[createVisualScopeKey("pupil", item?.id)]))
      .filter(Boolean)
      .sort((a, b) => {
        if (Number(b.isPriority) !== Number(a.isPriority)) return Number(b.isPriority) - Number(a.isPriority);
        if (a.sortAttainment !== b.sortAttainment) return a.sortAttainment - b.sortAttainment;
        if (a.sortAccuracy !== b.sortAccuracy) return a.sortAccuracy - b.sortAccuracy;
        return String(a.label || "").localeCompare(String(b.label || ""));
      }),
  };

  return {
    windowDays,
    catalog,
    summaries,
    sourceData: data,
  };
}

function getVisualGraphemeConcernScore(item) {
  if (!item) return 0;
  const total = Math.max(0, Number(item?.total || 0));
  const incorrect = Math.max(0, Number(item?.incorrect || 0));
  const accuracy = Math.max(0, Math.min(1, Number(item?.accuracy || 0)));
  const challengeCount = getVisualGraphemeChallengeCount(item);
  const bandBoost = item?.securityBand === "insecure"
    ? 3
    : item?.securityBand === "nearly_secure"
      ? 1.5
      : 0;
  return challengeCount * 2 + incorrect * 1.5 + (1 - accuracy) * Math.max(1, total) + bandBoost;
}

function getVisualGraphemeChallengeCount(item) {
  const total = Math.max(0, Number(item?.total || 0));
  const firstTrySuccessRate = Math.max(0, Math.min(1, Number(item?.firstTrySuccessRate || 0)));
  return Math.max(0, total - Math.round(firstTrySuccessRate * total));
}

function normalizeConfusionToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
}

function getAttemptTargetGraphemes(attempt) {
  const direct = Array.isArray(attempt?.target_graphemes)
    ? attempt.target_graphemes.map((item) => normalizeConfusionToken(item)).filter(Boolean)
    : [];
  if (direct.length) return direct;
  return splitWordToGraphemes(String(attempt?.word_text || ""))
    .map((item) => normalizeConfusionToken(item))
    .filter(Boolean);
}

function getAttemptTypedGraphemes(attempt) {
  const typed = String(attempt?.typed || "").trim();
  if (!typed) return [];
  return splitWordToGraphemes(typed)
    .map((item) => normalizeConfusionToken(item))
    .filter(Boolean);
}

function alignGraphemeSequences(targetParts, typedParts) {
  const expected = Array.isArray(targetParts) ? targetParts : [];
  const actual = Array.isArray(typedParts) ? typedParts : [];
  const rows = expected.length;
  const cols = actual.length;
  const costs = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0));
  const moves = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill("match"));

  for (let i = 1; i <= rows; i += 1) {
    costs[i][0] = i;
    moves[i][0] = "delete";
  }
  for (let j = 1; j <= cols; j += 1) {
    costs[0][j] = j;
    moves[0][j] = "insert";
  }

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      const isMatch = expected[i - 1] === actual[j - 1];
      let bestCost = costs[i - 1][j - 1] + (isMatch ? 0 : 1);
      let bestMove = isMatch ? "match" : "substitute";

      const deleteCost = costs[i - 1][j] + 1;
      if (deleteCost < bestCost) {
        bestCost = deleteCost;
        bestMove = "delete";
      }

      const insertCost = costs[i][j - 1] + 1;
      if (insertCost < bestCost) {
        bestCost = insertCost;
        bestMove = "insert";
      }

      costs[i][j] = bestCost;
      moves[i][j] = bestMove;
    }
  }

  const alignment = [];
  let i = rows;
  let j = cols;
  while (i > 0 || j > 0) {
    const move = moves[i][j];
    if ((move === "match" || move === "substitute") && i > 0 && j > 0) {
      alignment.push({
        type: move,
        expected: expected[i - 1],
        actual: actual[j - 1],
      });
      i -= 1;
      j -= 1;
      continue;
    }
    if (move === "delete" && i > 0) {
      alignment.push({
        type: "delete",
        expected: expected[i - 1],
        actual: "",
      });
      i -= 1;
      continue;
    }
    alignment.push({
      type: "insert",
      expected: "",
      actual: actual[j - 1],
    });
    j -= 1;
  }

  return alignment.reverse();
}

function isSubmittedConfusionPair(expected, actual) {
  const expectedToken = normalizeConfusionToken(expected);
  const actualToken = normalizeConfusionToken(actual);
  if (!expectedToken || !actualToken || expectedToken === actualToken) return false;

  const expectedPhoneme = inferPhonemeFromGrapheme(expectedToken, "all");
  const actualPhoneme = inferPhonemeFromGrapheme(actualToken, "all");
  const expectedAlternatives = expectedPhoneme
    ? getPhonemeAlternativeOptions(expectedToken, expectedPhoneme, ["core", "all"])
    : [];
  const actualAlternatives = actualPhoneme
    ? getPhonemeAlternativeOptions(actualToken, actualPhoneme, ["core", "all"])
    : [];

  return expectedAlternatives.includes(actualToken) || actualAlternatives.includes(expectedToken);
}

function getVisualConfusionTone(pairTargets, rowByTarget, attemptCount) {
  const rows = pairTargets
    .map((item) => rowByTarget.get(item))
    .filter(Boolean);
  if (rows.some((item) => item?.securityBand === "insecure") || attemptCount >= 6) return "red";
  if (rows.some((item) => item?.securityBand === "nearly_secure") || attemptCount >= 2) return "amber";
  return "green";
}

function getVisualConfusionDisplayOrder(pairTargets, rowByTarget, targetCounts, selectedGrapheme = "") {
  const items = [...new Set((Array.isArray(pairTargets) ? pairTargets : []).map((item) => normalizeConfusionToken(item)).filter(Boolean))];
  if (items.length < 2) return items;

  const selected = normalizeConfusionToken(selectedGrapheme);
  if (selected && items.includes(selected)) {
    return [selected, items.find((item) => item !== selected) || selected];
  }

  return [...items].sort((a, b) => {
    const targetDiff = Math.max(0, Number(targetCounts.get(b) || 0)) - Math.max(0, Number(targetCounts.get(a) || 0));
    if (targetDiff) return targetDiff;

    const scoreDiff = getVisualGraphemeConcernScore(rowByTarget.get(b)) - getVisualGraphemeConcernScore(rowByTarget.get(a));
    if (scoreDiff) return scoreDiff;

    return a.localeCompare(b);
  });
}

function buildVisualCommonConfusions(attempts, graphemeRows, selectedGrapheme = "") {
  const rows = (Array.isArray(graphemeRows) ? graphemeRows : [])
    .filter((item) => item?.target && item.target !== "general");
  const rowByTarget = new Map(rows.map((item) => [normalizeConfusionToken(item.target), item]));
  const selected = normalizeConfusionToken(selectedGrapheme);
  const pairByKey = new Map();

  for (const attempt of attempts || []) {
    const targetParts = getAttemptTargetGraphemes(attempt);
    const typedParts = getAttemptTypedGraphemes(attempt);
    if (!targetParts.length || !typedParts.length) continue;

    const alignment = alignGraphemeSequences(targetParts, typedParts);
    const attemptPairKeys = new Set();
    const attemptWord = String(attempt?.word_text || "").trim() || "Unknown word";

    for (const item of alignment) {
      const expected = normalizeConfusionToken(item?.expected);
      const actual = normalizeConfusionToken(item?.actual);
      if (item?.type !== "substitute") continue;
      if (!expected || !actual || expected === actual) continue;
      if (selected && expected !== selected) continue;
      if (!isSubmittedConfusionPair(expected, actual)) continue;

      const pairTargets = [...new Set([expected, actual])].sort();
      if (pairTargets.length < 2) continue;
      const pairKey = pairTargets.join("::");
      const next = pairByKey.get(pairKey) || {
        key: pairKey,
        pairTargets,
        targetCounts: new Map(),
        attemptCount: 0,
        substitutionCount: 0,
        words: new Set(),
        wordAttemptCounts: new Map(),
      };

      next.substitutionCount += 1;
      next.words.add(attemptWord);
      next.targetCounts.set(expected, (next.targetCounts.get(expected) || 0) + 1);
      if (!attemptPairKeys.has(pairKey)) {
        next.attemptCount += 1;
        next.wordAttemptCounts.set(attemptWord, (next.wordAttemptCounts.get(attemptWord) || 0) + 1);
        attemptPairKeys.add(pairKey);
      }

      pairByKey.set(pairKey, next);
    }
  }

  return Array.from(pairByKey.values())
    .map((item) => {
      const [primary, alternate] = getVisualConfusionDisplayOrder(
        item.pairTargets,
        rowByTarget,
        item.targetCounts,
        selected,
      );
      const rankedWords = Array.from(item.wordAttemptCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([word]) => word);
      const wordSamples = rankedWords.slice(0, 3);
      const practiceWords = rankedWords.slice(0, COMMON_CONFUSION_TEST_WORD_LIMIT);
      const tone = getVisualConfusionTone(item.pairTargets, rowByTarget, item.attemptCount);
      const note = item.substitutionCount > item.attemptCount
        ? `${item.substitutionCount} submitted swaps across ${item.attemptCount} answers and ${item.words.size} words`
        : `${item.attemptCount} submitted answer${item.attemptCount === 1 ? "" : "s"} across ${item.words.size} word${item.words.size === 1 ? "" : "s"}`;

      return {
        key: item.key,
        label: `${primary} / ${alternate}`,
        primary,
        alternate,
        pairTargets: [primary, alternate].filter(Boolean),
        attemptCount: item.attemptCount,
        substitutionCount: item.substitutionCount,
        wordCount: item.words.size,
        wordSamples,
        practiceWords,
        tone,
        note,
        score: item.attemptCount * 3 + item.substitutionCount + getVisualGraphemeConcernScore(rowByTarget.get(primary)) + getVisualGraphemeConcernScore(rowByTarget.get(alternate)),
      };
    })
    .sort((a, b) => b.score - a.score || b.attemptCount - a.attemptCount || a.label.localeCompare(b.label))
    .slice(0, 3);
}

function calculateVisualTimelineAccuracy(rows) {
  const items = Array.isArray(rows) ? rows : [];
  const attemptCount = items.reduce((sum, item) => sum + Math.max(0, Number(item?.attemptCount || 0)), 0);
  if (!attemptCount) return 0;
  const correctCount = items.reduce((sum, item) => sum + Math.max(0, Number(item?.correctCount || 0)), 0);
  return correctCount / attemptCount;
}

function calculateVisualTimelineAttemptCount(rows) {
  return (Array.isArray(rows) ? rows : [])
    .reduce((sum, item) => sum + Math.max(0, Number(item?.attemptCount || 0)), 0);
}

function calculateVisualTimelineExpectedAccuracy(rows) {
  const items = Array.isArray(rows) ? rows : [];
  const expectedAccuracyCount = items.reduce((sum, item) => sum + Math.max(0, Number(item?.expectedAccuracyCount || 0)), 0);
  if (!expectedAccuracyCount) return null;
  const expectedAccuracyTotal = items.reduce((sum, item) => sum + Math.max(0, Number(item?.expectedAccuracyTotal || 0)), 0);
  return expectedAccuracyTotal / expectedAccuracyCount;
}

function getAnalyticsDifficultyScoreForExpectedAccuracy(difficultyModel) {
  if (!difficultyModel || typeof difficultyModel !== "object") return null;
  const score = Number(difficultyModel?.coreScore ?? difficultyModel?.score);
  return Number.isFinite(score) ? score : null;
}

function getExpectedAccuracyBucketFromDifficultyScore(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return null;

  // Reporting-only expected-accuracy buckets are mapped from the existing
  // research difficulty output. This keeps the underlying difficulty maths
  // unchanged while making the bucket conversion explicit:
  // - easier (<35) / bucket 1
  // - core (35-59) / bucket 2
  // - stretch (60-79) / bucket 3
  // - challenge (80+) / bucket 4
  const difficultyBandKey = String(getDifficultyBand(numericScore)?.key || "");
  if (difficultyBandKey === "easier") return 1;
  if (difficultyBandKey === "core") return 2;
  if (difficultyBandKey === "stretch") return 3;
  if (difficultyBandKey === "challenge") return 4;
  return null;
}

function getExpectedAccuracyForDifficultyScore(score) {
  const bucket = getExpectedAccuracyBucketFromDifficultyScore(score);
  if (bucket === 1) return 0.85;
  if (bucket === 2) return 0.7;
  if (bucket === 3) return 0.55;
  if (bucket === 4) return 0.4;
  return null;
}

function formatAnalyticsShortDayLabel(value) {
  const date = new Date(`${String(value || "").trim()}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function buildVisualExpectedBenchmarkPlaceholder({
  recentAttemptCount = 0,
  attempts = [],
  benchmarkComparableAttempt = null,
} = {}) {
  // Future expected-performance benchmarking should stay in the analytics
  // interpretation layer and only use benchmark-eligible evidence. That later
  // work should gate on enough evidence volume, comparable task types,
  // support/no-support distinctions, difficulty context, and potentially
  // benchmark-eligible subsets only rather than all instructional evidence.
  const comparableAttemptCount = typeof benchmarkComparableAttempt === "function"
    ? (Array.isArray(attempts) ? attempts.filter((item) => benchmarkComparableAttempt(item)).length : 0)
    : 0;

  return {
    label: "Expected benchmark coming soon",
    statusText: recentAttemptCount >= VISUAL_EXPECTED_MIN_ATTEMPTS
      ? "More evidence needed"
      : "Not enough data yet",
    note: "We need more app data across difficulty levels and question types before expected performance can be shown reliably.",
    tone: "neutral",
    comparableAttemptCount,
  };
}

function buildVisualRecentTrend(timelineRows, {
  attempts = [],
  benchmarkComparableAttempt = null,
} = {}) {
  const rows = (Array.isArray(timelineRows) ? timelineRows : []).filter((item) => item?.dayKey);
  const totalAttempts = rows.reduce((sum, item) => sum + Math.max(0, Number(item?.attemptCount || 0)), 0);
  const startLabel = rows.length ? formatAnalyticsShortDayLabel(rows[0].dayKey) : "";
  const endLabel = rows.length ? formatAnalyticsShortDayLabel(rows[rows.length - 1].dayKey) : "";
  const singleWindowAttemptCount = calculateVisualTimelineAttemptCount(rows);
  const singleWindowExpectedBenchmark = buildVisualExpectedBenchmarkPlaceholder({
    recentAttemptCount: singleWindowAttemptCount,
    attempts,
    benchmarkComparableAttempt,
  });

  if (rows.length < 2) {
    return {
      label: "Awaiting data",
      tone: "neutral",
      direction: "waiting",
      delta: 0,
      baselineAccuracy: rows[0]?.accuracy || 0,
      recentAccuracy: rows[0]?.accuracy || 0,
      summaryText: rows.length
        ? "Need one more activity day to compare earlier and recent performance."
        : "Progress over time will appear once there is activity in this view.",
      earlierExpectedAccuracy: rows[0]?.expectedAccuracy ?? null,
      recentExpectedAccuracy: rows[0]?.expectedAccuracy ?? null,
      recentAttemptCount: singleWindowAttemptCount,
      expectedBenchmark: singleWindowExpectedBenchmark,
      dayCount: rows.length,
      totalAttempts,
      startLabel,
      endLabel,
      points: rows,
    };
  }

  const splitIndex = Math.max(1, Math.floor(rows.length / 2));
  const earlierRows = rows.slice(0, splitIndex);
  const recentRows = rows.slice(splitIndex);
  const baselineAccuracy = calculateVisualTimelineAccuracy(earlierRows);
  const recentAccuracy = calculateVisualTimelineAccuracy(recentRows);
  const delta = recentAccuracy - baselineAccuracy;
  const earlierExpectedAccuracy = calculateVisualTimelineExpectedAccuracy(earlierRows);
  const recentExpectedAccuracy = calculateVisualTimelineExpectedAccuracy(recentRows);
  const recentAttemptCount = calculateVisualTimelineAttemptCount(recentRows);
  let label = "Steady";
  let tone = "neutral";
  let direction = "flat";

  if (delta >= VISUAL_TREND_FLAT_DELTA) {
    label = "Improving";
    tone = "green";
    direction = "up";
  } else if (delta <= -VISUAL_TREND_FLAT_DELTA) {
    label = "Declining";
    tone = "red";
    direction = "down";
  }

  const summaryText = label === "Improving"
    ? `Recent days averaged ${formatPercent(recentAccuracy)}, up from ${formatPercent(baselineAccuracy)} earlier in this view.`
    : label === "Declining"
      ? `Recent days averaged ${formatPercent(recentAccuracy)}, down from ${formatPercent(baselineAccuracy)} earlier in this view.`
      : `Recent days averaged ${formatPercent(recentAccuracy)}, close to the earlier ${formatPercent(baselineAccuracy)} in this view.`;
  const expectedBenchmark = buildVisualExpectedBenchmarkPlaceholder({
    recentAttemptCount,
    attempts,
    benchmarkComparableAttempt,
  });

  return {
    label,
    tone,
    direction,
    delta,
    baselineAccuracy,
    recentAccuracy,
    summaryText,
    earlierExpectedAccuracy,
    recentExpectedAccuracy,
    recentAttemptCount,
    expectedBenchmark,
    dayCount: rows.length,
    totalAttempts,
    startLabel,
    endLabel,
    points: rows,
  };
}

function buildVisualScopeSummary({ scopeType, scopeId, data, graphemeFilter = "" }) {
  const normalizedGraphemeFilter = normalizeAnalyticsGrapheme(graphemeFilter);
  const difficultyByWordId = data?.difficultyByWordId || new Map();
  const allClassIds = (data.classes || []).map((item) => String(item?.id || "")).filter(Boolean);
  const selectedClassIds = scopeType === "overview"
    ? allClassIds
    : scopeType === "year_group"
      ? (data.classes || [])
        .filter((item) => String(item?.year_group || "").trim() === String(scopeId || ""))
        .map((item) => String(item?.id || ""))
        .filter(Boolean)
      : scopeType === "class"
        ? [String(scopeId || "")]
        : [...new Set(data.classIdsByPupil.get(String(scopeId || "")) || [])];

  const selectedClassIdSet = new Set(selectedClassIds.filter(Boolean));
  const rosterPupilIds = scopeType === "pupil"
    ? [String(scopeId || "")]
    : Array.from(
      new Set(
        selectedClassIds.flatMap((classId) => data.pupilIdsByClass.get(String(classId || "")) || []),
      ),
    );
  const rosterPupilSet = new Set(rosterPupilIds.filter(Boolean));

  const scopeLatestRows = (data.latestRows || []).filter((row) => {
    const pupilId = String(row?.pupil_id || "");
    const classId = String(row?.class_id || "");
    if (!pupilId) return false;
    if (scopeType === "pupil") {
      return pupilId === String(scopeId || "") && (!selectedClassIdSet.size || selectedClassIdSet.has(classId));
    }
    return selectedClassIdSet.has(classId) && rosterPupilSet.has(pupilId);
  });

  const scopeAttempts = (data.attempts || []).filter((row) => {
    const pupilId = String(row?.pupil_id || "");
    const classId = String(row?.class_id || "");
    if (!pupilId) return false;
    if (scopeType === "pupil") {
      return pupilId === String(scopeId || "") && (!selectedClassIdSet.size || selectedClassIdSet.has(classId));
    }
    return selectedClassIdSet.has(classId) && rosterPupilSet.has(pupilId);
  });

  const scopedLatestRows = normalizedGraphemeFilter
    ? scopeLatestRows.filter((row) => normalizeAnalyticsGrapheme(analyticsTargetForAttempt(row)) === normalizedGraphemeFilter)
    : scopeLatestRows;

  const scopedAttempts = normalizedGraphemeFilter
    ? scopeAttempts.filter((row) => normalizeAnalyticsGrapheme(analyticsTargetForAttempt(row)) === normalizedGraphemeFilter)
    : scopeAttempts;

  const latestRowsByPupil = new Map();
  const latestRowsByClass = new Map();
  for (const row of scopedLatestRows) {
    const pupilId = String(row?.pupil_id || "");
    const classId = String(row?.class_id || "");
    if (pupilId) {
      const next = latestRowsByPupil.get(pupilId) || [];
      next.push(row);
      latestRowsByPupil.set(pupilId, next);
    }
    if (classId) {
      const next = latestRowsByClass.get(classId) || [];
      next.push(row);
      latestRowsByClass.set(classId, next);
    }
  }

  const interventionFloor = normalizedGraphemeFilter ? 2 : 4;
  const pupilRows = rosterPupilIds
    .filter(Boolean)
    .map((pupilId) => {
      const rows = latestRowsByPupil.get(String(pupilId)) || [];
      const total = rows.length;
      const correct = rows.filter((item) => item?.correct).length;
      const accuracy = total ? correct / total : 0;
      const firstTrySuccessRate = total
        ? rows.filter((item) => item?.correct && Math.max(1, Number(item?.attempt_number || 1)) === 1).length / total
        : 0;
      const averageAttempts = total
        ? rows.reduce((sum, item) => sum + Math.max(1, Number(item?.attempt_number || 1)), 0) / total
        : 0;
      const attainmentIndicator = estimateSpellingAttainmentIndicator({
        responses: rows.map((item) => ({
          correct: !!item?.correct,
          difficultyScore: difficultyByWordId.get(String(item?.test_word_id || ""))?.coreScore
            ?? difficultyByWordId.get(String(item?.test_word_id || ""))?.score
            ?? 50,
        })),
        checkedAccuracy: total ? accuracy : null,
        firstTimeCorrectRate: total ? firstTrySuccessRate : null,
        completionRate: null,
        averageAttempts: total ? averageAttempts : null,
      });
      const weakCounts = new Map();
      for (const row of rows) {
        if (row?.correct) continue;
        const target = analyticsTargetForAttempt(row);
        if (!target || target === "general") continue;
        weakCounts.set(target, (weakCounts.get(target) || 0) + 1);
      }
      const weakGraphemes = Array.from(weakCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([target]) => target);
      const recentWins = rows
        .filter((item) => item?.correct)
        .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
        .map((item) => String(item?.word_text || "").trim())
        .filter(Boolean)
        .filter((item, index, list) => list.indexOf(item) === index)
        .slice(0, 3);
      const relatedClassNames = [...new Set(
        (data.classIdsByPupil.get(String(pupilId)) || [])
          .filter((classId) => !selectedClassIdSet.size || selectedClassIdSet.has(String(classId)))
          .map((classId) => data.classById.get(String(classId))?.name || "")
          .filter(Boolean),
      )];
      const latestActivity = rows
        .map((item) => new Date(item?.created_at || 0).getTime())
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => b - a)[0] || null;
      const needsIntervention = total >= interventionFloor && (
        accuracy < 0.65 ||
        firstTrySuccessRate < 0.5 ||
        averageAttempts > 2.2
      );
      const signal = getVisualPupilSignal({
        needsIntervention,
        checkedWords: total,
        accuracy,
        averageAttempts,
      });

      return {
        pupilId: String(pupilId),
        name: pupilDisplayName(data.pupilById.get(String(pupilId))),
        checkedWords: total,
        accuracy,
        firstTrySuccessRate,
        averageAttempts,
        attainmentIndicator,
        weakGraphemes,
        recentWins,
        classNames: relatedClassNames,
        latestActivity,
        needsIntervention,
        signalTone: signal.tone,
        signalLabel: signal.label,
        focusedGrapheme: normalizedGraphemeFilter,
      };
    })
    .sort((a, b) => {
      if (getPupilSignalRank(a.signalTone) !== getPupilSignalRank(b.signalTone)) {
        return getPupilSignalRank(a.signalTone) - getPupilSignalRank(b.signalTone);
      }
      if (Number(a.checkedWords === 0) !== Number(b.checkedWords === 0)) {
        return Number(a.checkedWords === 0) - Number(b.checkedWords === 0);
      }
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      if (b.checkedWords !== a.checkedWords) return b.checkedWords - a.checkedWords;
      return a.name.localeCompare(b.name);
    });

  const checkedWords = scopedLatestRows.length;
  const correctWords = scopedLatestRows.filter((item) => item?.correct).length;
  const accuracy = checkedWords ? correctWords / checkedWords : 0;
  const firstTrySuccessRate = checkedWords
    ? scopedLatestRows.filter((item) => item?.correct && Math.max(1, Number(item?.attempt_number || 1)) === 1).length / checkedWords
    : 0;
  const averageAttempts = checkedWords
    ? scopedLatestRows.reduce((sum, item) => sum + Math.max(1, Number(item?.attempt_number || 1)), 0) / checkedWords
    : 0;
  const activePupilCount = pupilRows.filter((item) => item.checkedWords > 0).length;
  const interventionCount = pupilRows.filter((item) => item.needsIntervention).length;
  const averageIndicatorScore = averageSpellingIndicator(pupilRows.map((item) => item.attainmentIndicator));
  const attainmentHeadline = buildAttainmentHeadlineSummary(pupilRows);
  const pupilRowsById = new Map(pupilRows.map((item) => [String(item?.pupilId || ""), item]));

  const graphemeStats = new Map();
  const wordStats = new Map();
  for (const row of scopedLatestRows) {
    const target = analyticsTargetForAttempt(row);
    const wordLabel = String(row?.word_text || "Unknown word").trim() || "Unknown word";
    const graphemeEntry = graphemeStats.get(target) || {
      target,
      total: 0,
      correct: 0,
      incorrect: 0,
      attemptTotal: 0,
      firstTrySuccessCount: 0,
      words: new Set(),
    };
    graphemeEntry.total += 1;
    if (row?.correct) graphemeEntry.correct += 1;
    else graphemeEntry.incorrect += 1;
    graphemeEntry.attemptTotal += Math.max(1, Number(row?.attempt_number || 1));
    if (row?.correct && Math.max(1, Number(row?.attempt_number || 1)) === 1) {
      graphemeEntry.firstTrySuccessCount += 1;
    }
    graphemeEntry.words.add(wordLabel);
    graphemeStats.set(target, graphemeEntry);

    const wordKey = String(row?.test_word_id || wordLabel);
    const wordEntry = wordStats.get(wordKey) || {
      word: wordLabel,
      total: 0,
      correct: 0,
      attemptTotal: 0,
    };
    wordEntry.total += 1;
    if (row?.correct) wordEntry.correct += 1;
    wordEntry.attemptTotal += Math.max(1, Number(row?.attempt_number || 1));
    wordStats.set(wordKey, wordEntry);
  }

  const graphemeRows = Array.from(graphemeStats.values())
    .map((item) => {
      const next = {
        ...item,
        accuracy: item.total ? item.correct / item.total : 0,
        averageAttempts: item.total ? item.attemptTotal / item.total : 0,
        firstTrySuccessRate: item.total ? item.firstTrySuccessCount / item.total : 0,
        wordSamples: Array.from(item.words).slice(0, 3),
      };
      return {
        ...next,
        securityBand: getSecurityBand(next),
      };
    })
    .filter((item) => item.target && item.target !== "general");

  let weakGraphemes = graphemeRows
    .filter((item) => item.total >= 2)
    .sort((a, b) => a.accuracy - b.accuracy || b.incorrect - a.incorrect || a.target.localeCompare(b.target))
    .slice(0, 5);
  let strongGraphemes = graphemeRows
    .filter((item) => item.total >= 2)
    .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total || a.target.localeCompare(b.target))
    .slice(0, 5);
  const selectedGraphemeStats = normalizedGraphemeFilter
    ? graphemeRows.find((item) => item.target === normalizedGraphemeFilter) || null
    : null;
  if (normalizedGraphemeFilter && selectedGraphemeStats) {
    if (selectedGraphemeStats.securityBand === "secure") {
      weakGraphemes = [];
      strongGraphemes = [selectedGraphemeStats];
    } else {
      weakGraphemes = [selectedGraphemeStats];
      strongGraphemes = [];
    }
  }
  const hardestWords = Array.from(wordStats.values())
    .map((item) => ({
      ...item,
      accuracy: item.total ? item.correct / item.total : 0,
      averageAttempts: item.total ? item.attemptTotal / item.total : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.averageAttempts - a.averageAttempts || a.word.localeCompare(b.word))
    .slice(0, 5);

  const timelineRows = Array.from(
    scopedAttempts.reduce((map, row) => {
      const key = analyticsDayKey(row?.created_at);
      const difficultyModel = difficultyByWordId.get(String(row?.test_word_id || ""));
      const difficultyScore = getAnalyticsDifficultyScoreForExpectedAccuracy(difficultyModel);
      const expectedAccuracy = getExpectedAccuracyForDifficultyScore(difficultyScore);
      const current = map.get(key) || {
        dayKey: key,
        attemptCount: 0,
        correctCount: 0,
        pupilIds: new Set(),
        difficultyTotal: 0,
        difficultyCount: 0,
        expectedAccuracyTotal: 0,
        expectedAccuracyCount: 0,
      };
      current.attemptCount += 1;
      if (row?.correct) current.correctCount += 1;
      if (row?.pupil_id) current.pupilIds.add(String(row.pupil_id));
      if (Number.isFinite(difficultyScore)) {
        current.difficultyTotal += difficultyScore;
        current.difficultyCount += 1;
      }
      if (Number.isFinite(expectedAccuracy)) {
        current.expectedAccuracyTotal += expectedAccuracy;
        current.expectedAccuracyCount += 1;
      }
      map.set(key, current);
      return map;
    }, new Map()).values(),
  )
    .map((item) => ({
      dayKey: item.dayKey,
      attemptCount: item.attemptCount,
      correctCount: item.correctCount,
      pupilCount: item.pupilIds.size,
      accuracy: item.attemptCount ? item.correctCount / item.attemptCount : 0,
      averageDifficultyScore: item.difficultyCount ? item.difficultyTotal / item.difficultyCount : null,
      difficultyBandKey: item.difficultyCount ? String(getDifficultyBand(item.difficultyTotal / item.difficultyCount)?.key || "") : "",
      expectedAccuracy: item.expectedAccuracyCount ? item.expectedAccuracyTotal / item.expectedAccuracyCount : null,
      expectedAccuracyTotal: item.expectedAccuracyTotal,
      expectedAccuracyCount: item.expectedAccuracyCount,
    }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    .slice(-7);
  const commonConfusions = buildVisualCommonConfusions(scopedAttempts, graphemeRows, normalizedGraphemeFilter);
  const recentTrend = buildVisualRecentTrend(timelineRows, {
    attempts: scopedAttempts,
  });

  const classRows = selectedClassIds
    .filter(Boolean)
    .map((classId) => {
      const rows = latestRowsByClass.get(String(classId)) || [];
      const rosterPupilIds = [...new Set((data.pupilIdsByClass.get(String(classId)) || []).map((item) => String(item || "")).filter(Boolean))];
      const classPupilRows = rosterPupilIds
        .map((pupilId) => pupilRowsById.get(String(pupilId)))
        .filter(Boolean);
      const rosterCount = rosterPupilIds.length;
      const activeCount = new Set(rows.map((item) => String(item?.pupil_id || "")).filter(Boolean)).size;
      const total = rows.length;
      const correct = rows.filter((item) => item?.correct).length;
      const averageAttempts = total
        ? rows.reduce((sum, item) => sum + Math.max(1, Number(item?.attempt_number || 1)), 0) / total
        : 0;
      const classLatestRowsByPupil = new Map();
      for (const row of rows) {
        const pupilId = String(row?.pupil_id || "");
        if (!pupilId) continue;
        const next = classLatestRowsByPupil.get(pupilId) || [];
        next.push(row);
        classLatestRowsByPupil.set(pupilId, next);
      }
      const interventionCount = rosterPupilIds.reduce((count, pupilId) => {
        const pupilRowsForClass = classLatestRowsByPupil.get(String(pupilId)) || [];
        const pupilCheckedWords = pupilRowsForClass.length;
        if (!pupilCheckedWords) return count;
        const pupilCorrectWords = pupilRowsForClass.filter((item) => item?.correct).length;
        const pupilAccuracy = pupilCheckedWords ? pupilCorrectWords / pupilCheckedWords : 0;
        const pupilFirstTrySuccessRate = pupilCheckedWords
          ? pupilRowsForClass.filter((item) => item?.correct && Math.max(1, Number(item?.attempt_number || 1)) === 1).length / pupilCheckedWords
          : 0;
        const pupilAverageAttempts = pupilCheckedWords
          ? pupilRowsForClass.reduce((sum, item) => sum + Math.max(1, Number(item?.attempt_number || 1)), 0) / pupilCheckedWords
          : 0;
        const needsIntervention = pupilCheckedWords >= interventionFloor && (
          pupilAccuracy < 0.65 ||
          pupilFirstTrySuccessRate < 0.5 ||
          pupilAverageAttempts > 2.2
        );
        return count + Number(needsIntervention);
      }, 0);
      const participationRate = rosterCount ? activeCount / rosterCount : 0;
      const reviewRate = activeCount ? interventionCount / activeCount : 0;
      const classWeakTarget = rows
        .filter((item) => !item?.correct)
        .map((item) => analyticsTargetForAttempt(item))
        .filter((item) => item && item !== "general")
        .sort()[0] || "";
      const averageIndicatorScore = averageSpellingIndicator(classPupilRows.map((item) => item?.attainmentIndicator));
      const attainmentHeadline = buildAttainmentHeadlineSummary(classPupilRows);
      return {
        classId: String(classId),
        className: data.classById.get(String(classId))?.name || "Class",
        yearGroup: String(data.classById.get(String(classId))?.year_group || "").trim() || "",
        pupilCount: rosterCount,
        activePupilCount: activeCount,
        participationRate,
        checkedWords: total,
        accuracy: total ? correct / total : 0,
        averageAttempts,
        averageIndicatorScore,
        ...attainmentHeadline,
        interventionCount,
        reviewRate,
        primaryConcern: normalizedGraphemeFilter ? (total ? normalizedGraphemeFilter : "") : classWeakTarget,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy || a.className.localeCompare(b.className));

  const classCount = scopeType === "pupil" ? [...new Set(pupilRows[0]?.classNames || [])].length : classRows.length;
  const label = scopeType === "year_group"
    ? String(scopeId || "Year group")
    : scopeType === "class"
      ? data.classById.get(String(scopeId || ""))?.name || "Class"
      : scopeType === "pupil"
        ? pupilDisplayName(data.pupilById.get(String(scopeId || "")))
        : "All classes";
  const yearGroups = Array.from(
    new Set(
      selectedClassIds
        .map((classId) => String(data.classById.get(String(classId))?.year_group || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const yearGroup = scopeType === "class"
    ? String(data.classById.get(String(scopeId || ""))?.year_group || "").trim() || ""
    : "";
  const subtitleBase = scopeType === "overview"
    ? `Whole-school summary across ${classCount} classes over the last ${data.windowDays} days.`
    : scopeType === "year_group"
      ? `${classCount} classes and ${rosterPupilSet.size} pupils in ${label} over the last ${data.windowDays} days.`
      : scopeType === "class"
        ? `${yearGroup ? `${yearGroup} • ` : ""}${rosterPupilSet.size} pupils tracked over the last ${data.windowDays} days.`
        : `${(pupilRows[0]?.classNames || []).join(", ") || "No active classes"} • recent spelling picture across the last ${data.windowDays} days.`;
  const subtitle = normalizedGraphemeFilter ? `${subtitleBase} Focused on ${normalizedGraphemeFilter}.` : subtitleBase;

  return {
    scopeType,
    scopeId: String(scopeId || ""),
    label,
    subtitle,
    classIds: selectedClassIds,
    yearGroups,
    primaryYearGroup: yearGroups[0] || yearGroup || "",
    yearGroup,
    classCount,
    pupilCount: rosterPupilSet.size,
    activePupilCount,
    interventionCount,
    checkedWords,
    accuracy,
    firstTrySuccessRate,
    averageAttempts,
    averageIndicatorScore,
    ...attainmentHeadline,
    engagementRate: rosterPupilSet.size ? activePupilCount / rosterPupilSet.size : 0,
    graphemeRows,
    weakGraphemes,
    strongGraphemes,
    selectedGrapheme: normalizedGraphemeFilter,
    selectedGraphemeStats,
    hardestWords,
    timelineRows,
    commonConfusions,
    recentTrend,
    pupilRows,
    classRows,
    topConcern: normalizedGraphemeFilter
      ? selectedGraphemeStats && selectedGraphemeStats.securityBand !== "secure"
        ? normalizedGraphemeFilter
        : ""
      : weakGraphemes[0]?.target || pupilRows.find((item) => item.needsIntervention)?.weakGraphemes?.[0] || "",
    topStrength: normalizedGraphemeFilter
      ? selectedGraphemeStats?.securityBand === "secure"
        ? normalizedGraphemeFilter
        : ""
      : strongGraphemes[0]?.target || "",
    latestActivity: scopedAttempts
      .map((item) => new Date(item?.created_at || 0).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a)[0] || null,
  };
}

function buildVisualScopeCatalogEntry(summary) {
  if (!summary) return null;

  const noAttempts = !summary.checkedWords;
  const hasAttainment = summary.averageIndicatorScore != null;
  const primaryValue = getSummaryAttainmentLevel(summary);
  const attainmentSecurity = getSummaryAttainmentSecurity(summary);
  const detailLine = summary.scopeType === "pupil"
    ? noAttempts
      ? "No checked words yet"
      : `${formatPercent(summary.accuracy)} accuracy across ${summary.checkedWords} checked words`
    : getSummaryAttainmentSubtext(summary);
  const helper = summary.selectedGrapheme
    ? noAttempts
      ? `No ${summary.selectedGrapheme} attempts yet`
      : summary.interventionCount
        ? `${summary.interventionCount} pupil${summary.interventionCount === 1 ? "" : "s"} to review on ${summary.selectedGrapheme}`
        : `${summary.selectedGrapheme} in ${summary.activePupilCount}/${summary.pupilCount} active pupils`
    : summary.interventionCount
      ? `${summary.interventionCount} pupil${summary.interventionCount === 1 ? "" : "s"} to review`
      : summary.topConcern
        ? `Focus: ${summary.topConcern}`
        : summary.topStrength
          ? `Secure: ${summary.topStrength}`
          : noAttempts
            ? "Awaiting first attempts"
            : "Progress looks steady";

  return {
    scopeType: summary.scopeType,
    scopeId: summary.scopeId,
    label: summary.label,
    subtitle: summary.scopeType === "class"
      ? summary.yearGroup || summary.subtitle
      : summary.scopeType === "pupil"
        ? (summary.pupilRows[0]?.classNames || []).join(", ") || "No active classes"
        : summary.subtitle,
    primaryValue,
    secondaryValue: attainmentSecurity || detailLine,
    helper,
    tone: getVisualScopeTone(summary),
    accuracy: summary.accuracy,
    primaryProgress: hasAttainment ? Math.max(0, Math.min(100, Number(summary.averageIndicatorScore || 0))) / 100 : summary.accuracy,
    attainmentScore: hasAttainment ? Number(summary.averageIndicatorScore || 0) : null,
    checkedWords: summary.checkedWords,
    latestActivity: summary.latestActivity || null,
    sortAccuracy: summary.checkedWords ? summary.accuracy : Number.POSITIVE_INFINITY,
    sortAttainment: hasAttainment ? Number(summary.averageIndicatorScore || 0) : Number.POSITIVE_INFINITY,
    isPriority: summary.scopeType === "pupil" ? summary.interventionCount > 0 : summary.interventionCount > 1,
  };
}

function getVisualScopeTone(summary) {
  if (!summary || !summary.checkedWords) return "neutral";
  if (summary.interventionCount > 0 && summary.scopeType === "pupil") return "alert";
  if (summary.accuracy >= 0.85 && summary.firstTrySuccessRate >= 0.7) return "good";
  if (summary.accuracy >= 0.65) return "warm";
  return "alert";
}

function analyticsDayKey(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "Unknown";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bindEvents() {
  rootEl.addEventListener("click", onRootClick);
  rootEl.addEventListener("submit", onRootSubmit);
  rootEl.addEventListener("input", onRootInput);
  rootEl.addEventListener("change", onRootChange);
  rootEl.addEventListener("keydown", onRootKeyDown);
  rootEl.addEventListener("toggle", onRootToggle, true);
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("resize", syncTableScrollShells);
}

function closeOpenInfoTips(activeTip = null) {
  document.querySelectorAll(".uiInfoTip[open]").forEach((tip) => {
    if (!(tip instanceof HTMLDetailsElement)) return;
    if (activeTip && tip === activeTip) return;
    tip.open = false;
  });
}

function closeOpenTargetPopovers(activePopover = null) {
  document.querySelectorAll(".td-target-popover[open]").forEach((popover) => {
    if (!(popover instanceof HTMLDetailsElement)) return;
    if (activePopover && popover === activePopover) return;
    popover.open = false;
  });
}

function syncTargetPopoverLayouts() {
  requestAnimationFrame(() => {
    rootEl?.querySelectorAll(".td-assignment-matrix-shell").forEach((shell) => {
      if (!(shell instanceof HTMLElement)) return;
      shell.classList.toggle("has-open-target-popover", !!shell.querySelector(".td-target-popover[open]"));
    });
    rootEl?.querySelectorAll(".td-inline-panel, .td-results-block, .td-class-results-selected").forEach((container) => {
      if (!(container instanceof HTMLElement)) return;
      container.classList.toggle("has-open-target-popover", !!container.querySelector(".td-target-popover[open]"));
    });
  });
}

function onDocumentClick(event) {
  const activeTip = event.target instanceof Element
    ? event.target.closest(".uiInfoTip")
    : null;
  const activePopover = event.target instanceof Element
    ? event.target.closest(".td-target-popover")
    : null;
  closeOpenInfoTips(activeTip instanceof HTMLDetailsElement ? activeTip : null);
  closeOpenTargetPopovers(activePopover instanceof HTMLDetailsElement ? activePopover : null);
  syncTargetPopoverLayouts();
}

function onRootToggle(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.matches(".td-target-popover")) return;
  syncTargetPopoverLayouts();
}

function onRootInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.matches('[data-field="test-search"]')) {
    const nextValue = target.value || "";
    const selectionStart = typeof target.selectionStart === "number" ? target.selectionStart : nextValue.length;
    const selectionEnd = typeof target.selectionEnd === "number" ? target.selectionEnd : nextValue.length;
    state.testSearch = nextValue;
    paint();
    requestAnimationFrame(() => {
      const input = rootEl?.querySelector('[data-field="test-search"]');
      if (!(input instanceof HTMLInputElement)) return;
      input.focus();
      try {
        input.setSelectionRange(selectionStart, selectionEnd);
      } catch {
        // ignore browsers that do not support selection restore here
      }
    });
    return;
  }

  if (target.matches('[data-field="staff-access-search"]')) {
    const nextValue = target.value || "";
    const selectionStart = typeof target.selectionStart === "number" ? target.selectionStart : nextValue.length;
    const selectionEnd = typeof target.selectionEnd === "number" ? target.selectionEnd : nextValue.length;
    state.staffAccess.search = nextValue;
    void syncStaffAccessSelectionForVisibleDirectory();
    requestAnimationFrame(() => {
      const input = rootEl?.querySelector('[data-field="staff-access-search"]');
      if (!(input instanceof HTMLInputElement)) return;
      input.focus();
      try {
        input.setSelectionRange(selectionStart, selectionEnd);
      } catch {
        // ignore browsers that do not support selection restore here
      }
    });
    return;
  }

  if (target.matches('[data-field="analytics-question"]')) {
    state.analyticsAssistant.questionDraft = target.value || "";
    syncAnalyticsComposerHeight(target);
    return;
  }

  if (target.matches('[data-field="visual-pupil-search"]')) {
    const nextValue = target.value || "";
    const selectionStart = typeof target.selectionStart === "number" ? target.selectionStart : nextValue.length;
    const selectionEnd = typeof target.selectionEnd === "number" ? target.selectionEnd : nextValue.length;
    state.visualAnalytics.pupilSearch = nextValue;
    paint();
    requestAnimationFrame(() => {
      const input = rootEl?.querySelector('[data-field="visual-pupil-search"]');
      if (!(input instanceof HTMLInputElement)) return;
      input.focus();
      try {
        input.setSelectionRange(selectionStart, selectionEnd);
      } catch {
        // ignore browsers that do not support selection restore here
      }
    });
    return;
  }

  if (target.matches('[data-field="intervention-pupil-search"]')) {
    const nextValue = target.value || "";
    const selectionStart = typeof target.selectionStart === "number" ? target.selectionStart : nextValue.length;
    const selectionEnd = typeof target.selectionEnd === "number" ? target.selectionEnd : nextValue.length;
    state.interventionGroup.filters.search = nextValue;
    markInterventionFiltersPending();
    paint();
    requestAnimationFrame(() => {
      const input = rootEl?.querySelector('[data-field="intervention-pupil-search"]');
      if (!(input instanceof HTMLInputElement)) return;
      input.focus();
      try {
        input.setSelectionRange(selectionStart, selectionEnd);
      } catch {
        // ignore browsers that do not support selection restore here
      }
    });
    return;
  }

  if (target.matches('[data-field="automation-policy-name"]')) {
    setAutomationRunPolicy({ name: target.value || "" });
    return;
  }

  if (target.matches('[data-field="automation-policy-description"]')) {
    setAutomationRunPolicy({ description: target.value || "" });
  }
}

function onRootChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.matches('[data-field="staff-access-csv-file"]')) {
    const input = target instanceof HTMLInputElement ? target : null;
    const file = input?.files?.[0] || null;
    void handleStaffAccessCsvFileSelection(file);
    return;
  }

  if (target.matches('[data-field="staff-access-pending-scope"]')) {
    const role = String(target.dataset.role || "").trim().toLowerCase();
    const scopeType = String(target.dataset.scopeType || "").trim().toLowerCase();
    if (!role || !scopeType) return;
    if (!state.staffAccess.pendingScopeSelections?.[role]) return;
    state.staffAccess.pendingScopeSelections[role][scopeType] = String(target.value || "").trim();
    syncStaffAccessPendingScopeSelections();
    paint();
    return;
  }

  if (target.matches('[data-field="staff-access-class-toggle"]')) {
    const role = String(target.dataset.role || "").trim().toLowerCase();
    togglePendingStaffAccessClassId(role, target.value, !!target.checked);
    paint();
    return;
  }

  if (target.matches('[data-field="staff-pending-approval-role"]')) {
    const role = String(target.dataset.role || target.getAttribute("value") || "").trim().toLowerCase();
    toggleStaffPendingApprovalDraftRole(role, !!target.checked);
    paint();
    return;
  }

  if (target.matches('[data-field="staff-pending-approval-scope"]')) {
    const role = String(target.dataset.role || "").trim().toLowerCase();
    const scopeType = String(target.dataset.scopeType || "").trim().toLowerCase();
    const scopeValue = String(target.getAttribute("value") || "").trim();
    toggleStaffPendingApprovalDraftScope(role, scopeType, scopeValue, !!target.checked);
    paint();
    return;
  }

  if (target.matches('[data-field="automation-selected-policy"]')) {
    handleSelectAutomationPolicy(String(target.value || "").trim());
    return;
  }

  if (target.matches('[data-field="automation-run-class"]')) {
    toggleAutomationRunSelectedClassId(target.value, !!target.checked);
    paint();
    return;
  }

  if (target.matches('[data-field="intervention-pupil-toggle"]')) {
    toggleInterventionBuilderPupilId(target.value, !!target.checked);
    paint();
    return;
  }

  if (target.matches('[data-field="intervention-year-group"]')) {
    const nextYearGroup = String(target.value || "").trim();
    state.interventionGroup.filters.yearGroup = nextYearGroup;
    syncInterventionBuilderSourceClassFilter({ yearGroup: nextYearGroup });
    markInterventionFiltersPending();
    paint();
    return;
  }

  if (target.matches('[data-field="intervention-source-class"]')) {
    state.interventionGroup.filters.sourceClassId = String(target.value || "").trim();
    markInterventionFiltersPending();
    paint();
    return;
  }

  if (target.matches('[data-field="automation-run-length"]')) {
    setAutomationRunPolicy({ assignment_length: target.value });
    paint();
    return;
  }

  if (target.matches('[data-field="automation-run-support-preset"]')) {
    setAutomationRunPolicy({ support_preset: target.value });
    paint();
    return;
  }

  if (target.matches('[data-field="automation-run-starter-fallback"]')) {
    setAutomationRunPolicy({ allow_starter_fallback: !!target.checked });
    paint();
    return;
  }

  if (target.matches('[data-field="automation-target-year-group"]')) {
    setAutomationTargetFilters({ yearGroup: String(target.value || "").trim() });
    paint();
    return;
  }

  if (target.matches('[data-field="automation-target-class-type"]')) {
    setAutomationTargetFilters({ classType: String(target.value || "").trim().toLowerCase() });
    paint();
    return;
  }

  if (target.matches('[data-field="automation-policy-frequency"]')) {
    const nextFrequency = String(target.value || "").trim().toLowerCase();
    if (nextFrequency === "fortnightly") {
      const currentPolicy = getAutomationRunPolicy();
      setAutomationRunPolicy({
        frequency: nextFrequency,
        selected_weekdays_week_1: currentPolicy.selected_weekdays_week_1.length
          ? currentPolicy.selected_weekdays_week_1
          : currentPolicy.selected_weekdays,
        selected_weekdays_week_2: currentPolicy.selected_weekdays_week_2,
      });
    } else {
      const currentPolicy = getAutomationRunPolicy();
      setAutomationRunPolicy({
        frequency: nextFrequency,
        selected_weekdays: currentPolicy.selected_weekdays_week_1.length
          ? currentPolicy.selected_weekdays_week_1
          : currentPolicy.selected_weekdays,
      });
    }
    paint();
    return;
  }

  if (target.matches('[data-field="automation-policy-start-date"]')) {
    setAutomationRunPolicy({ start_date: String(target.value || "").trim() });
    paint();
    return;
  }

  if (target.matches('[data-field="automation-policy-end-date"]')) {
    setAutomationRunPolicy({ end_date: String(target.value || "").trim() });
    paint();
    return;
  }

  if (target.matches('[data-field="automation-policy-weekday-toggle"]')) {
    const currentPolicy = getAutomationRunPolicy();
    const weekKey = String(target.dataset.weekdayWeek || "weekly");
    const weekday = String(target.value || "").trim().toLowerCase();
    if (currentPolicy.frequency === "fortnightly") {
      const week1 = new Set(currentPolicy.selected_weekdays_week_1);
      const week2 = new Set(currentPolicy.selected_weekdays_week_2);
      const targetSet = weekKey === "2" ? week2 : week1;
      if (target.checked) targetSet.add(weekday);
      else targetSet.delete(weekday);
      setAutomationRunPolicy({
        selected_weekdays_week_1: [...week1],
        selected_weekdays_week_2: [...week2],
      });
    } else {
      const currentWeekdays = new Set(currentPolicy.selected_weekdays || []);
      if (target.checked) currentWeekdays.add(weekday);
      else currentWeekdays.delete(weekday);
      setAutomationRunPolicy({ selected_weekdays: [...currentWeekdays] });
    }
    paint();
    return;
  }

  if (target.matches('[data-field="auto-assign-class"]')) {
    state.createAutoAssignClassId = String(target.value || "");
    paint();
    return;
  }

  if (target.matches('[data-field="summary-scope-type"]')) {
    updateAnalyticsScope(String(target.value || "overview"));
    openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
    paint();
    return;
  }

  if (target.matches('[data-field="summary-scope-id"]')) {
    applyAnalyticsFocusSelection(target.value);
    openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
    paint();
    return;
  }

  if (target.matches('[data-field="summary-grapheme"]')) {
    state.visualAnalytics.selectedGrapheme = normalizeAnalyticsGrapheme(target.value);
    paint();
    return;
  }

  if (target.matches('[data-field="group-comparison-scope-type"]')) {
    state.groupComparison.filters.scopeType = normalizeGroupComparisonScopeType(target.value);
    state.groupComparison.filters.scopeValue = "";
    markGroupComparisonDirty();
    paint();
    return;
  }

  if (target.matches('[data-field="group-comparison-scope-value"]')) {
    state.groupComparison.filters.scopeValue = String(target.value || "");
    markGroupComparisonDirty();
    paint();
    return;
  }

  if (target.matches('[data-field="group-comparison-test"]')) {
    state.groupComparison.filters.testId = String(target.value || "");
    markGroupComparisonDirty();
    paint();
    return;
  }

  if (target.matches('[data-field="group-comparison-date-from"]')) {
    state.groupComparison.filters.dateFrom = normalizeGroupComparisonDateValue(target.value);
    markGroupComparisonDirty();
    paint();
    return;
  }

  if (target.matches('[data-field="group-comparison-date-to"]')) {
    state.groupComparison.filters.dateTo = normalizeGroupComparisonDateValue(target.value);
    markGroupComparisonDirty();
    paint();
    return;
  }

  if (target.matches('[data-field="group-comparison-compare"]')) {
    const resolvedPair = resolveGroupComparisonPair({
      result: state.groupComparison.result,
      compareKey: String(target.value || ""),
      withKey: state.groupComparison.withKey,
    });
    state.groupComparison.compareKey = resolvedPair.compareKey;
    state.groupComparison.withKey = resolvedPair.withKey;
    paint();
    return;
  }

  if (target.matches('[data-field="group-comparison-with"]')) {
    const resolvedPair = resolveGroupComparisonPair({
      result: state.groupComparison.result,
      compareKey: state.groupComparison.compareKey,
      withKey: String(target.value || ""),
    });
    state.groupComparison.compareKey = resolvedPair.compareKey;
    state.groupComparison.withKey = resolvedPair.withKey;
    paint();
    return;
  }

  if (target.matches('[data-field="analytics-scope-type"]')) {
    updateAnalyticsScope(String(target.value || "overview"));
    openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
    paint();
    return;
  }

  if (target.matches('[data-field="analytics-scope"]')) {
    const { scopeType, scopeId } = parseAnalyticsAssistantScopeValue(target.value);
    updateAnalyticsScope(scopeType, scopeId);
    openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
    paint();
    return;
  }

  if (target.matches('[data-field="analytics-scope-id"]')) {
    applyAnalyticsFocusSelection(target.value);
    openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
    paint();
    return;
  }

  if (target.matches('[data-field="compare-mode"]')) {
    const compareId = String(target.dataset.compareId || "");
    const nextMode = String(target.value || "year_group");
    const yearGroupOptions = getAnalyticsYearGroupOptions();
    updateVisualCompareSelection(compareId, (selection) => ({
      ...selection,
      mode: ["overview", "year_group", "class_set"].includes(nextMode) ? nextMode : "year_group",
      yearGroup: nextMode === "year_group"
        ? yearGroupOptions.includes(String(selection?.yearGroup || "")) ? String(selection?.yearGroup || "") : String(yearGroupOptions[0] || "")
        : "",
      classIds: nextMode === "class_set" ? (selection?.classIds || []) : [],
    }));
    paint();
    return;
  }

  if (target.matches('[data-field="compare-year-group"]')) {
    const compareId = String(target.dataset.compareId || "");
    updateVisualCompareSelection(compareId, (selection) => ({
      ...selection,
      yearGroup: String(target.value || ""),
    }));
    paint();
    return;
  }

  if (target.matches('[data-field="compare-class-toggle"]')) {
    const compareId = String(target.dataset.compareId || "");
    const classId = String(target.value || "");
    updateVisualCompareSelection(compareId, (selection) => {
      const currentIds = new Set((selection?.classIds || []).map((item) => String(item || "")));
      if (target instanceof HTMLInputElement && target.checked) currentIds.add(classId);
      else currentIds.delete(classId);
      return {
        ...selection,
        classIds: Array.from(currentIds),
      };
    });
    paint();
    return;
  }

  if (target.matches('[data-field="class-results-assignment"]')) {
    const classId = String(target.dataset.classId || "");
    const assignmentId = String(target.value || "");
    if (!classId) return;
    setSelectedClassResultsAssignmentId(classId, assignmentId);
    paint();
    if (assignmentId) {
      void ensureAssignmentAnalytics(assignmentId, { force: true });
    }
    return;
  }

  if (target.matches('[data-field="visual-pupil-assignment"]')) {
    const scopeType = String(target.dataset.scopeType || "pupil");
    const scopeId = String(target.dataset.scopeId || "");
    const assignmentId = String(target.value || "");
    if (!scopeId) return;
    setSelectedVisualSummaryAssignmentId(scopeType, scopeId, assignmentId);
    paint();
    if (assignmentId) {
      void ensureAssignmentAnalytics(assignmentId, { force: true });
    }
    return;
  }

  if (target.matches('[data-field="visual-ranking-target"]')) {
    const scopeType = String(target.dataset.scopeType || "overview");
    const scopeId = String(target.dataset.scopeId || "");
    setSelectedVisualRankingTarget(scopeType, scopeId, String(target.value || "classes"));
    paint();
    return;
  }

  if (target.matches('[data-field="visual-class-rank-mode"]')) {
    state.visualAnalytics.classRankingMode = String(target.value || "accuracy");
    paint();
    return;
  }

  if (target.matches('[data-field="visual-pupil-rank-mode"]')) {
    state.visualAnalytics.pupilRankingMode = String(target.value || "accuracy");
    paint();
  }
}

async function handleSelectStaffProfile(profileId = "") {
  const safeProfileId = String(profileId || "").trim();
  if (!safeProfileId) return;
  if (safeProfileId === getStaffAccessSelectedProfileId() && !getStaffAccessState()?.detailError) return;
  state.staffAccess.selectedProfileId = safeProfileId;
  state.staffAccess.loadingDetails = true;
  state.staffAccess.detailError = "";
  paint();
  await loadStaffAccessSelectionDetails(safeProfileId);
  paint();
}

async function handleGrantStaffRoleFromDashboard(role = "", { skipConfirmation = false } = {}) {
  const safeRole = String(role || "").trim().toLowerCase();
  const selectedUserId = getSelectedStaffAccessTargetUserId();
  if (!selectedUserId) {
    showNotice("This staff record is waiting for sign-in linkage before live roles can be granted.", "error");
    paint();
    return;
  }
  if (safeRole === "admin" && !skipConfirmation) {
    openStaffAccessConfirmation(buildStaffAccessAdminConfirmation({ mode: "grant" }));
    paint();
    return;
  }

  state.staffAccess.mutating = true;
  paint();

  try {
    await grantStaffRole(selectedUserId, safeRole);
    await refreshStaffAccessAfterMutation({ targetUserId: selectedUserId });
    showNotice(`${getStaffAccessRoleLabel(safeRole)} granted.`, "success");
  } catch (error) {
    console.error("grant staff role error:", error);
    showNotice(error?.message || "Could not update the staff role.", "error");
  } finally {
    state.staffAccess.mutating = false;
    paint();
  }
}

async function handleRevokeStaffRoleFromDashboard(role = "", { skipConfirmation = false } = {}) {
  const safeRole = String(role || "").trim().toLowerCase();
  const selectedUserId = getSelectedStaffAccessTargetUserId();
  if (!selectedUserId) {
    showNotice("This staff record is waiting for sign-in linkage before live roles can be granted.", "error");
    paint();
    return;
  }
  if (safeRole === "admin" && isSelectedStaffAccessAdminLastActiveAdmin()) {
    openStaffAccessConfirmation(buildStaffAccessAdminConfirmation({ mode: "revoke", blocked: true }));
    paint();
    return;
  }
  if (safeRole === "admin" && !skipConfirmation) {
    openStaffAccessConfirmation(buildStaffAccessAdminConfirmation({ mode: "revoke" }));
    paint();
    return;
  }
  if (safeRole === "admin" && !canRevokeSelectedAdminRole()) {
    showNotice("At least one active admin must remain.", "error");
    paint();
    return;
  }

  state.staffAccess.mutating = true;
  paint();

  try {
    await revokeStaffRole(selectedUserId, safeRole);
    await refreshStaffAccessAfterMutation({ targetUserId: selectedUserId });
    showNotice(`${getStaffAccessRoleLabel(safeRole)} removed.`, "success");
  } catch (error) {
    console.error("revoke staff role error:", error);
    showNotice(error?.message || "Could not update the staff role.", "error");
  } finally {
    state.staffAccess.mutating = false;
    paint();
  }
}

async function handleAddStaffScopeFromDashboard(role = "", scopeType = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  const selectedUserId = getSelectedStaffAccessTargetUserId();
  const scopeValue = String(getStaffAccessState()?.pendingScopeSelections?.[safeRole]?.[safeScopeType] || "").trim();

  if (!selectedUserId) {
    showNotice("This staff record is waiting for sign-in linkage before live roles can be granted.", "error");
    paint();
    return;
  }
  if (!scopeValue) {
    showNotice("Choose a scope before adding it.", "error");
    paint();
    return;
  }

  state.staffAccess.mutating = true;
  paint();

  try {
    await grantStaffScope(selectedUserId, safeRole, safeScopeType, scopeValue);
    await refreshStaffAccessAfterMutation({ targetUserId: selectedUserId });
    showNotice(`${getStaffAccessScopeTypeLabel(safeScopeType)} added.`, "success");
  } catch (error) {
    console.error("grant staff scope error:", error);
    showNotice(error?.message || "Could not add that scope.", "error");
  } finally {
    state.staffAccess.mutating = false;
    paint();
  }
}

async function handleRemoveStaffScopeFromDashboard(role = "", scopeType = "", scopeValue = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  const safeScopeValue = String(scopeValue || "").trim();
  const selectedUserId = getSelectedStaffAccessTargetUserId();

  if (!selectedUserId) {
    showNotice("This staff record is waiting for sign-in linkage before live roles can be granted.", "error");
    paint();
    return;
  }
  if (!safeScopeValue) return;

  state.staffAccess.mutating = true;
  paint();

  try {
    await revokeStaffScope(selectedUserId, safeRole, safeScopeType, safeScopeValue);
    await refreshStaffAccessAfterMutation({ targetUserId: selectedUserId });
    showNotice(`${getStaffAccessScopeTypeLabel(safeScopeType)} removed.`, "success");
  } catch (error) {
    console.error("revoke staff scope error:", error);
    showNotice(error?.message || "Could not remove that scope.", "error");
  } finally {
    state.staffAccess.mutating = false;
    paint();
  }
}

function onRootKeyDown(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (event.key === "Escape" && getStaffAccessState()?.confirmation) {
    closeStaffAccessConfirmation();
    paint();
    return;
  }

  if (target.matches('#tdCreateClassInput') && event.key === "Enter") {
    event.preventDefault();
    const form = target.closest("form");
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
    return;
  }

  if (target.matches('[data-field="analytics-question"]') && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    const form = target.closest("form");
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }
}

async function onRootClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "toggle-section") {
    const key = button.dataset.section;
    if (!key || !Object.prototype.hasOwnProperty.call(state.sections, key)) return;
    if (state.sections[key]) {
      state.sections[key] = false;
    } else {
      openDashboardSection(key);
    }
    if (key === "analytics" && !state.sections.analytics) {
      state.analyticsAssistant.open = false;
    }
    paint();
    return;
  }

  if (action === "toggle-test-group") {
    const key = String(button.dataset.group || "");
    if (!Object.prototype.hasOwnProperty.call(state.testGroupExpanded, key)) return;
    state.testGroupExpanded[key] = !state.testGroupExpanded[key];
    paint();
    return;
  }

  if (action === "dismiss-notice") {
    state.notice = "";
    paint();
    return;
  }

  if (action === "dismiss-staff-access-confirmation") {
    closeStaffAccessConfirmation();
    paint();
    return;
  }

  if (action === "confirm-staff-access-confirmation") {
    await handleConfirmStaffAccessAction();
    return;
  }

  if (action === "set-staff-access-filter") {
    state.staffAccess.filter = String(button.dataset.filter || "all").trim().toLowerCase() || "all";
    await syncStaffAccessSelectionForVisibleDirectory();
    return;
  }

  if (action === "clear-staff-import-preview") {
    clearStaffAccessImportPreview();
    paint();
    return;
  }

  if (action === "commit-staff-import") {
    await handleCommitStaffAccessImport();
    return;
  }

  if (action === "select-staff-profile") {
    await handleSelectStaffProfile(button.dataset.profileId || "");
    return;
  }

  if (action === "approve-staff-pending-access") {
    await handleSaveStaffPendingAccessApproval();
    return;
  }

  if (action === "cancel-staff-pending-access") {
    await handleCancelStaffPendingAccessApproval();
    return;
  }

  if (action === "grant-staff-role") {
    await handleGrantStaffRoleFromDashboard(button.dataset.role || "");
    return;
  }

  if (action === "apply-staff-scoped-role") {
    await handleApplyStaffScopedRoleFromDashboard(button.dataset.role || "");
    return;
  }

  if (action === "revoke-staff-role") {
    await handleRevokeStaffRoleFromDashboard(button.dataset.role || "");
    return;
  }

  if (action === "add-staff-scope") {
    await handleAddStaffScopeFromDashboard(button.dataset.role || "", button.dataset.scopeType || "");
    return;
  }

  if (action === "remove-staff-scope") {
    await handleRemoveStaffScopeFromDashboard(
      button.dataset.role || "",
      button.dataset.scopeType || "",
      button.dataset.scopeValue || "",
    );
    return;
  }

  if (action === "remove-pending-staff-class") {
    removePendingStaffAccessClassId(button.dataset.role || "", button.dataset.scopeValue || "");
    paint();
    return;
  }

  if (action === "set-visual-grapheme-filter") {
    const nextFilter = normalizeVisualStatusFilter(button.dataset.filter);
    state.visualAnalytics.graphemeStatusFilter =
      state.visualAnalytics.graphemeStatusFilter === nextFilter ? "all" : nextFilter;
    paint();
    return;
  }

  if (action === "set-visual-pupil-filter") {
    const nextFilter = normalizeVisualStatusFilter(button.dataset.filter);
    state.visualAnalytics.pupilStatusFilter =
      state.visualAnalytics.pupilStatusFilter === nextFilter ? "all" : nextFilter;
    paint();
    return;
  }

  if (action === "analytics-suggestion") {
    const question = String(button.dataset.question || "").trim();
    if (!question) return;
    state.analyticsAssistant.questionDraft = question;
    paint();
    await submitTeacherAnalyticsQuestion(question);
    return;
  }

  if (action === "new-analytics-thread") {
    if (state.analyticsAssistant.loading) {
      showNotice("Wait for the current reply to finish before starting a new chat.", "error");
      paint();
      return;
    }
    openDashboardSection("analytics");
    state.analyticsAssistant.open = true;
    startNewAnalyticsAssistantThread();
    paint();
    requestAnimationFrame(() => {
      rootEl?.querySelector('[data-role="analytics-assistant-panel"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "open-analytics-thread") {
    const threadId = String(button.dataset.threadId || "");
    if (!threadId) return;
    if (state.analyticsAssistant.loading) {
      showNotice("Wait for the current reply to finish before switching chats.", "error");
      paint();
      return;
    }
    await openAnalyticsAssistantThread(threadId);
    return;
  }

  if (action === "open-ai-assistant") {
    openDashboardSection("analytics");
    state.analyticsAssistant.open = true;
    state.visualAnalytics.attainmentGuideOpen = false;
    paint();
    requestAnimationFrame(() => {
      rootEl?.querySelector('[data-role="analytics-assistant-panel"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "open-attainment-guide") {
    openDashboardSection("analytics");
    state.visualAnalytics.attainmentGuideOpen = true;
    paint();
    requestAnimationFrame(() => {
      rootEl?.querySelector('[data-role="attainment-guide-page"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "close-attainment-guide") {
    state.visualAnalytics.attainmentGuideOpen = false;
    paint();
    requestAnimationFrame(() => {
      rootEl?.querySelector('[data-role="visual-summary-page"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "change-visual-group") {
    state.visualAnalytics.activeGroup = String(button.dataset.group || "overview");
    state.visualAnalytics.summaryOpen = false;
    paint();
    return;
  }

  if (action === "open-current-summary") {
    state.visualAnalytics.attainmentGuideOpen = false;
    openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
    paint();
    requestAnimationFrame(() => {
      rootEl?.querySelector('[data-role="visual-summary-page"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "open-visual-summary") {
    const nextType = String(button.dataset.scopeType || "overview");
    openDashboardSection("analytics");
    state.visualAnalytics.attainmentGuideOpen = false;
    updateAnalyticsScope(nextType, String(button.dataset.scopeId || ""));
    openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
    paint();
    requestAnimationFrame(() => {
      rootEl?.querySelector('[data-role="visual-summary-page"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "close-visual-summary") {
    state.visualAnalytics.summaryOpen = false;
    state.visualAnalytics.attainmentGuideOpen = false;
    paint();
    requestAnimationFrame(() => {
      rootEl?.querySelector('[data-role="analytics-bar"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "use-visual-summary-scope") {
    const scopeType = String(button.dataset.scopeType || "overview");
    const scopeId = String(button.dataset.scopeId || "");
    const scopeLabel = String(button.dataset.scopeLabel || getAnalyticsScopeLabel(scopeType, scopeId));
    const question = String(
      button.dataset.question || getVisualSummaryPrompt(scopeType, scopeLabel, state.visualAnalytics.selectedGrapheme),
    );

    openDashboardSection("analytics");
    state.analyticsAssistant.open = true;
    state.visualAnalytics.attainmentGuideOpen = false;
    updateAnalyticsScope(scopeType, scopeId);
    state.analyticsAssistant.questionDraft = question;
    openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
    paint();
    requestAnimationFrame(() => {
      rootEl?.querySelector('[data-role="analytics-assistant-panel"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "use-class-analytics") {
    const classId = String(button.dataset.classId || "");
    const className = String(button.dataset.className || "this class");
    openDashboardSection("analytics");
    state.analyticsAssistant.open = true;
    state.visualAnalytics.attainmentGuideOpen = false;
    updateAnalyticsScope("class", classId);
    state.analyticsAssistant.questionDraft = getVisualSummaryPrompt("class", className);
    openVisualSummaryForScope(state.analyticsAssistant.scopeType, state.analyticsAssistant.scopeId);
    paint();
    requestAnimationFrame(() => {
      rootEl?.querySelector('[data-role="analytics-assistant-panel"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "build-confusion-test") {
    await handleCreateTestFromCommonConfusion(button);
    return;
  }

  if (action === "build-grapheme-band-test") {
    await handleCreateTestFromGraphemeBand(button);
    return;
  }

  if (action === "close-ai-assistant") {
    state.analyticsAssistant.open = false;
    paint();
    return;
  }

  if (action === "add-compare-selection") {
    if ((state.visualAnalytics.compareSelections || []).length >= VISUAL_COMPARE_LIMIT) return;
    const nextSelection = (state.visualAnalytics.compareSelections || []).length === 0
      ? createVisualCompareSelectionFromCurrentView()
      : createVisualCompareSelection("year_group");
    const nextSelections = [...(state.visualAnalytics.compareSelections || []), nextSelection];
    state.visualAnalytics.compareSelections = sanitizeVisualCompareSelections(nextSelections, state.visualAnalytics.sourceData);
    paint();
    return;
  }

  if (action === "remove-compare-selection") {
    const compareId = String(button.dataset.compareId || "");
    state.visualAnalytics.compareSelections = (state.visualAnalytics.compareSelections || [])
      .filter((item) => String(item?.id || "") !== compareId);
    paint();
    return;
  }

  if (action === "toggle-pupil-details") {
    togglePupilRowExpanded(button.dataset.contextKey, button.dataset.pupilId);
    paint();
    return;
  }

  if (action === "show-more-pupils") {
    showMorePupilRows(button.dataset.contextKey, Number(button.dataset.totalRows || 0));
    paint();
    return;
  }

  if (action === "show-fewer-pupils") {
    resetVisiblePupilRows(button.dataset.contextKey);
    paint();
    return;
  }

  if (action === "show-more-visual-ranking") {
    showMoreVisualRankingRows(
      button.dataset.scopeType,
      button.dataset.scopeId,
      button.dataset.rankTarget,
      Number(button.dataset.totalRows || 0),
    );
    paint();
    return;
  }

  if (action === "show-fewer-visual-ranking") {
    resetVisibleVisualRankingRows(
      button.dataset.scopeType,
      button.dataset.scopeId,
      button.dataset.rankTarget,
    );
    paint();
    return;
  }

  if (action === "toggle-create-class") {
    if (!canCreateClasses()) {
      showNotice("Teacher or admin access is required to create classes.", "error");
      paint();
      return;
    }
    state.createClassOpen = !state.createClassOpen;
    if (state.createClassOpen) {
      state.createInterventionGroupOpen = false;
      state.createBaselineOpen = false;
      state.createAutoAssignOpen = false;
    }
    paint();

    if (state.createClassOpen) {
      requestAnimationFrame(() => {
        const input = rootEl.querySelector("#tdCreateClassInput");
        if (input instanceof HTMLInputElement) input.focus();
      });
    }
    return;
  }

  if (action === "toggle-create-baseline") {
    if (!(canManageOwnContent() && canAssignTests())) {
      showNotice("Teacher or admin access is required to set a baseline test.", "error");
      paint();
      return;
    }
    state.createBaselineOpen = !state.createBaselineOpen;
    if (state.createBaselineOpen) {
      state.createClassOpen = false;
      state.createInterventionGroupOpen = false;
      state.createAutoAssignOpen = false;
    }
    paint();

    if (state.createBaselineOpen) {
      requestAnimationFrame(() => {
        const input = rootEl.querySelector("#tdBaselineClassInput");
        if (input instanceof HTMLSelectElement) input.focus();
      });
    }
    return;
  }

  if (action === "toggle-create-intervention-group") {
    if (!canManageInterventionGroups()) {
      showNotice("Admin access is required to create intervention groups.", "error");
      paint();
      return;
    }
    state.createInterventionGroupOpen = !state.createInterventionGroupOpen;
    if (state.createInterventionGroupOpen) {
      state.createClassOpen = false;
      state.createBaselineOpen = false;
      state.createAutoAssignOpen = false;
      if (!state.interventionGroup.pupils.length && !state.interventionGroup.message) {
        state.interventionGroup.message = "Choose a filter to find pupils.";
      }
      paint();
    } else {
      paint();
    }

    if (state.createInterventionGroupOpen) {
      requestAnimationFrame(() => {
        const input = rootEl.querySelector("#tdInterventionGroupNameInput");
        if (input instanceof HTMLInputElement) input.focus();
      });
    }
    return;
  }

  if (action === "apply-intervention-filters") {
    void applyInterventionGroupFilters({ force: true });
    return;
  }

  if (action === "toggle-create-auto-assign") {
    if (!canManageAutomation()) {
      showNotice("Admin access is required to manage personalised generation.", "error");
      paint();
      return;
    }
    state.createAutoAssignOpen = !state.createAutoAssignOpen;
    if (state.createAutoAssignOpen) {
      state.createClassOpen = false;
      state.createInterventionGroupOpen = false;
      state.createBaselineOpen = false;
    }
    paint();
    return;
  }

  if (action === "new-automation-policy") {
    handleStartNewAutomationPolicy();
    return;
  }

  if (action === "select-automation-policy") {
    handleSelectAutomationPolicy(button.dataset.policyId || "");
    return;
  }

  if (action === "duplicate-automation-policy") {
    handleDuplicateAutomationPolicy(button.dataset.policyId || "");
    return;
  }

  if (action === "archive-automation-policy") {
    await handleSetAutomationPolicyArchived(button.dataset.policyId || "", true);
    return;
  }

  if (action === "restore-automation-policy") {
    await handleSetAutomationPolicyArchived(button.dataset.policyId || "", false);
    return;
  }

  if (action === "extend-automation-policy") {
    handleExtendAutomationPolicy(button.dataset.policyId || "");
    return;
  }

  if (action === "delete-automation-policy") {
    await handleDeleteAutomationPolicy(button.dataset.policyId || "");
    return;
  }

  if (action === "discard-new-automation-policy") {
    discardNewAutomationPolicyDraft();
    paint();
    return;
  }

  if (action === "discard-automation-policy-changes") {
    handleDiscardAutomationPolicyChanges();
    return;
  }

  if (action === "save-and-run-automation-policy") {
    await handleRunNowPersonalisedGeneration();
    return;
  }

  if (action === "run-now-automation-policy") {
    const policyId = String(button.dataset.policyId || "").trim();
    if (policyId) {
      handleSelectAutomationPolicy(policyId);
    }
    await handleRunNowPersonalisedGeneration();
    return;
  }

  if (action === "select-all-automation-classes") {
    setAutomationRunSelectedClassIds(
      getFilteredAutomationEligibleClasses().map((item) => String(item?.id || "").trim()).filter(Boolean)
    );
    paint();
    return;
  }

  if (action === "clear-automation-classes") {
    setAutomationRunSelectedClassIds([]);
    paint();
    return;
  }

  if (action === "select-all-filtered-intervention-pupils") {
    setInterventionBuilderSelectedPupilIds([
      ...getInterventionBuilderSelectedPupilIds(),
      ...getInterventionBuilderVisiblePupils().map((item) => String(item?.id || "").trim()),
    ]);
    paint();
    return;
  }

  if (action === "clear-intervention-pupil-selection") {
    setInterventionBuilderSelectedPupilIds([]);
    paint();
    return;
  }

  if (action === "remove-intervention-pupil") {
    const pupilId = String(button.dataset.pupilId || "").trim();
    if (!pupilId) return;
    setInterventionBuilderSelectedPupilIds(
      getInterventionBuilderSelectedPupilIds().filter((item) => item !== pupilId)
    );
    paint();
    return;
  }

  if (action === "seed-demo-data") {
    if (!canManageAutomation()) {
      showNotice("Admin access is required to load demo data.", "error");
      paint();
      return;
    }
    await handleManageDemoData("seed");
    return;
  }

  if (action === "clear-demo-data") {
    if (!canManageAutomation()) {
      showNotice("Admin access is required to clear demo data.", "error");
      paint();
      return;
    }
    await handleManageDemoData("clear");
    return;
  }

  if (action === "create-test") {
    if (!canCreateTests()) {
      showNotice("Teacher or admin access is required to create tests.", "error");
      paint();
      return;
    }
    await handleCreateTestFromDashboard(button);
    return;
  }

  if (action === "open-assign-test") {
    const testId = button.dataset.testId;
    if (!testId) return;
    const selectedTest = findTestRecord(testId);
    if (!canAssignFromTestRecord(selectedTest)) {
      showNotice("You can only assign tests that you own.", "error");
      paint();
      return;
    }

    togglePanelWithAnchoredScroll({
      type: "assign-test",
      id: testId,
      anchorEl: button.closest(".td-test-card"),
    });
    return;
  }

  if (action === "open-edit-test") {
    const testId = button.dataset.testId;
    if (!testId) return;
    const selectedTest = findTestRecord(testId);
    if (!canEditTestRecord(selectedTest)) {
      showNotice("You can only edit tests that you own.", "error");
      paint();
      return;
    }
    window.location.href = buildTestBuilderUrl(testId);
    return;
  }

  if (action === "open-present-test") {
    const testId = button.dataset.testId;
    if (!testId) return;
    const selectedTest = findTestRecord(testId);
    if (!canPresentTestRecord(selectedTest)) {
      showNotice("You can only present tests that you own.", "error");
      paint();
      return;
    }
    window.location.href = buildPresenterUrl(testId);
    return;
  }

  if (action === "open-edit-class") {
    const classId = button.dataset.classId;
    if (!classId) return;
    const selectedClass = findClassRecord(classId);
    if (!canEditClassRecord(selectedClass)) {
      showNotice("You can only edit classes that you own.", "error");
      paint();
      return;
    }

    togglePanelWithAnchoredScroll({
      type: "edit-class",
      id: classId,
      anchorEl: button.closest(".td-class-card"),
    });
    return;
  }

  if (action === "open-class-results") {
    const classId = button.dataset.classId;
    if (!classId) return;
    const wasSame =
      state.activePanel?.type === "class-results" &&
      String(state.activePanel.id) === String(classId);

    togglePanelWithAnchoredScroll({
      type: "class-results",
      id: classId,
      anchorEl: button.closest(".td-class-card"),
    });
    if (!wasSame) {
      const recentItems = getRecentClassResultsAssignments(classId);
      if (recentItems.length) {
        setSelectedClassResultsAssignmentId(classId, getSelectedClassResultsAssignmentId(classId, recentItems));
      }
      await ensureRecentClassResultsAnalytics(classId);
    }
    return;
  }

  if (action === "set-class-results-range") {
    const classId = button.dataset.classId;
    const rangeKey = button.dataset.rangeKey;
    if (!classId || !rangeKey) return;

    const anchorEl =
      button.closest(".td-class-card") ||
      button.closest(".td-inline-panel") ||
      rootEl;

    preserveScrollAround(anchorEl, () => {
      setClassResultsRangeKey(classId, rangeKey);
      paint();
    });
    await ensureClassResultsAnalytics(classId, rangeKey);
    return;
  }

  if (action === "open-results-assignment") {
    const assignmentId = button.dataset.assignmentId;
    if (!assignmentId) return;
    const wasSame =
      state.activePanel?.type === "results-assignment" &&
      String(state.activePanel.id) === String(assignmentId);

    togglePanelWithAnchoredScroll({
      type: "results-assignment",
      id: assignmentId,
      anchorEl: button.closest(".td-assignment-card"),
    });
    if (!wasSame) {
      await ensureAssignmentAnalytics(assignmentId, { force: true });
    }
    return;
  }

  if (action === "jump-assignment-results") {
    const assignmentId = button.dataset.assignmentId;
    if (!assignmentId) return;

    openDashboardSection("upcoming");
    state.activePanel = { type: "results-assignment", id: assignmentId };
    paint();
    await ensureAssignmentAnalytics(assignmentId, { force: true });

    requestAnimationFrame(() => {
      const target = rootEl?.querySelector(
        `[data-assignment-card-id="${window.CSS?.escape ? window.CSS.escape(String(assignmentId)) : String(assignmentId)}"]`
      );
      target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    return;
  }

  if (action === "close-panel") {
    const panelEl = button.closest(".td-inline-panel");
    const anchorEl =
      panelEl?.closest(".td-test-card, .td-class-card, .td-assignment-card") ||
      panelEl ||
      rootEl;

    closePanelWithAnchoredScroll(anchorEl);
    return;
  }

  if (action === "delete-test") {
    const testId = button.dataset.testId;
    if (!testId) return;
    await handleDeleteTest(testId);
    return;
  }

  if (action === "duplicate-test") {
    const testId = button.dataset.testId;
    if (!testId) return;
    await handleDuplicateTest(testId);
    return;
  }

  if (action === "reset-class-auto-assign-policy") {
    const classId = button.dataset.classId;
    if (!classId) return;
    const selectedClass = findClassRecord(classId);
    if (!canManageClassAutoAssignPolicyRecord(selectedClass)) {
      showNotice("You can only change auto-assign settings for classes that you own.", "error");
      paint();
      return;
    }
    await handleResetClassAutoAssignPolicy(classId, button);
    return;
  }

  if (action === "delete-class") {
    const classId = button.dataset.classId;
    if (!classId) return;
    const selectedClass = findClassRecord(classId);
    if (!canEditClassRecord(selectedClass)) {
      showNotice("You can only delete classes that you own.", "error");
      paint();
      return;
    }
    await handleDeleteClass(classId);
    return;
  }
}

async function onRootSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  event.preventDefault();

  if (form.matches('[data-form="create-class-inline"]')) {
    await handleCreateClass(form);
    return;
  }

  if (form.matches('[data-form="create-intervention-group"]')) {
    await handleCreateInterventionGroup(form);
    return;
  }

  if (form.matches('[data-form="create-baseline-assignment"]')) {
    await handleCreateBaselineAssignment(form);
    return;
  }

  if (form.matches('[data-form="run-now-personalised"]')) {
    await handleRunNowPersonalisedGeneration(form);
    return;
  }

  if (form.matches('[data-form="save-automation-policy"]')) {
    await handleSaveAutomationPolicy(form);
    return;
  }

  if (form.matches('[data-form="auto-assign-practice"]')) {
    await handleAutoAssignPractice(form);
    return;
  }

  if (form.matches('[data-form="assign-test"]')) {
    await handleAssignTest(form);
    return;
  }

  if (form.matches('[data-form="edit-class"]')) {
    await handleEditClass(form);
    return;
  }

  if (form.matches('[data-form="class-auto-assign-policy"]')) {
    await handleSaveClassAutoAssignPolicy(form);
    return;
  }

  if (form.matches('[data-form="group-comparison"]')) {
    await handleGroupComparisonForm(form);
    return;
  }

  if (form.matches('[data-form="teacher-analytics-chat"]')) {
    await handleTeacherAnalyticsForm(form);
  }
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);
  const openAssign = params.get("openAssign");

  if (openAssign) {
    openDashboardSection("tests");
    state.activePanel = { type: "assign-test", id: openAssign };
    state.flashTestId = openAssign;
    clearFlashLater("test");

    params.delete("openAssign");
    const newQuery = params.toString();
    const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", newUrl);
  }
}

function togglePanelWithAnchoredScroll({ type, id, anchorEl }) {
  const wasSame =
    state.activePanel &&
    state.activePanel.type === type &&
    String(state.activePanel.id) === String(id);

  preserveScrollAround(anchorEl, () => {
    state.activePanel = wasSame ? null : { type, id };
    paint();
  });
}

function closePanelWithAnchoredScroll(anchorEl) {
  preserveScrollAround(anchorEl, () => {
    state.activePanel = null;
    paint();
  });
}

function preserveScrollAround(anchorEl, callback) {
  const beforeTop = anchorEl?.getBoundingClientRect?.().top ?? null;

  callback();

  requestAnimationFrame(() => {
    if (beforeTop == null || !anchorEl?.isConnected) return;
    const afterTop = anchorEl.getBoundingClientRect().top;
    const delta = afterTop - beforeTop;

    if (Math.abs(delta) > 1) {
      window.scrollBy(0, delta);
    }
  });
}

async function preserveScrollAroundAsync(anchorTarget, callback) {
  const anchorEl = typeof anchorTarget === "string"
    ? rootEl?.querySelector(anchorTarget)
    : anchorTarget;
  const beforeTop = anchorEl?.getBoundingClientRect?.().top ?? null;
  const result = await callback();

  requestAnimationFrame(() => {
    if (beforeTop == null) return;
    const nextAnchorEl = typeof anchorTarget === "string"
      ? rootEl?.querySelector(anchorTarget)
      : anchorEl?.isConnected ? anchorEl : null;
    if (!nextAnchorEl) return;
    const afterTop = nextAnchorEl.getBoundingClientRect().top;
    const delta = afterTop - beforeTop;

    if (Math.abs(delta) > 1) {
      window.scrollBy(0, delta);
    }
  });

  return result;
}

function restoreWindowScroll(scrollY) {
  const targetY = Number(scrollY);
  if (!Number.isFinite(targetY)) return;

  window.scrollTo(0, targetY);
  requestAnimationFrame(() => {
    window.scrollTo(0, targetY);
  });
}

function buildMergedGroupComparisonResult(resultsByType = {}) {
  const groups = GROUP_COMPARISON_GROUP_OPTIONS.flatMap((family) => {
    const familyKey = String(family?.value || "");
    const familyResult = resultsByType?.[familyKey] || null;
    return getGroupComparisonVisibleGroups(familyResult, { includeNotRecorded: true }).map((group) => ({
      ...group,
      id: `${familyKey}::${String(group?.groupKey || group?.key || "")}`,
      groupType: familyKey,
      groupKey: String(group?.groupKey || group?.key || ""),
    }));
  });

  const firstResult = GROUP_COMPARISON_GROUP_OPTIONS
    .map((family) => resultsByType?.[family.value] || null)
    .find(Boolean);

  return {
    groups,
    minimumGroupSize: Number(firstResult?.minimumGroupSize || GROUP_COMPARISON_MIN_COHORT_SIZE),
    filters: firstResult?.filters || {},
    metricOrder: firstResult?.metricOrder || GROUP_COMPARISON_METRICS.map((metric) => metric.value),
    familyResults: resultsByType,
    insight: firstResult?.insight || "No group data is available for this selection yet.",
  };
}

async function handleCreateTestFromDashboard(button) {
  if (!canCreateTests()) {
    showNotice("Teacher or admin access is required to create tests.", "error");
    paint();
    return;
  }

  setBusy(button, true, "Creating...");

  const { data, error } = await supabase
    .from("tests")
    .insert({
      teacher_id: state.user.id,
      title: "Untitled test",
      question_type: DEFAULT_QUESTION_TYPE,
    })
    .select()
    .single();

  setBusy(button, false);

  if (error || !data) {
    console.error("create test error:", error);
    showNotice("Could not create test.", "error");
    paint();
    return;
  }

  window.location.href = buildTestBuilderUrl(data.id);
}

function parseDatasetJsonList(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Could not parse button dataset list.", error);
    return [];
  }
}

function buildGeneratedTestTitle(label, scopeLabel = "") {
  const cleanLabel = String(label || "").trim() || "Spelling";
  const scope = String(scopeLabel || "").trim();
  const testLabel = /test$/i.test(cleanLabel) ? cleanLabel : `${cleanLabel} test`;

  if (scope && scope !== "All classes") {
    return `${scope} - ${testLabel}`;
  }

  return testLabel;
}

function buildGeneratedTestWordPayload(word, focusTargets = [], position = 1) {
  const cleanWord = String(word || "").trim().toLowerCase();
  const segments = splitWordToGraphemes(cleanWord).filter(Boolean);
  const normalizedSegments = segments.map((item) => normalizeConfusionToken(item)).filter(Boolean);
  const normalizedTargets = [...new Set((Array.isArray(focusTargets) ? focusTargets : []).map((item) => normalizeConfusionToken(item)).filter(Boolean))];
  const focusGrapheme = normalizedTargets.find((target) => normalizedSegments.includes(target))
    || normalizeConfusionToken(chooseBestFocusGrapheme(segments))
    || normalizedTargets[0]
    || "";

  return {
    position,
    word: cleanWord,
    sentence: null,
    segments,
    choice: {
      focus_graphemes: focusGrapheme ? [focusGrapheme] : [],
      source: "teacher",
    },
  };
}

async function createDraftGeneratedTest({ title, practiceWords, focusTargets = [] }) {
  const { data, error } = await insertSingleRowWithAnalyticsFallback("tests", {
    teacher_id: state.user.id,
    title,
    status: "draft",
    question_type: DEFAULT_QUESTION_TYPE,
    analytics_target_words_enabled: false,
    analytics_target_words_per_pupil: 3,
  }, "id");

  if (error || !data?.id) throw error || new Error("Could not create test.");

  const wordRows = practiceWords.map((word, index) => ({
    test_id: data.id,
    ...buildGeneratedTestWordPayload(word, focusTargets, index + 1),
  }));
  const { error: wordError } = await supabase
    .from("test_words")
    .insert(wordRows);

  if (wordError) {
    const { error: cleanupError } = await supabase
      .from("tests")
      .delete()
      .eq("id", data.id)
      .eq("teacher_id", state.user.id);
    if (cleanupError) console.warn("Could not clean up draft test:", cleanupError);
    throw wordError;
  }

  return data.id;
}

function buildAutoAssignedPoolEntries(pupilPlans) {
  const poolBySignature = new Map();

  for (const plan of pupilPlans || []) {
    for (const wordSpec of plan?.words || []) {
      const signature = buildAssignmentEngineWordSignature(wordSpec);
      if (!signature || poolBySignature.has(signature)) continue;
      poolBySignature.set(signature, {
        signature,
        spec: wordSpec,
      });
    }
  }

  return Array.from(poolBySignature.values()).map((entry, index) => ({
    ...entry,
    payload: buildAssignmentEngineWordPayload(entry.spec, index + 1),
  }));
}

function buildAutoAssignedPoolIdMap(insertedRows) {
  const rows = Array.isArray(insertedRows) ? insertedRows : [];
  return new Map(rows.map((row) => ([
    buildAssignmentEngineWordSignature({
      word: row?.word,
      sentence: row?.sentence,
      segments: row?.segments,
      assignmentRole: row?.choice?.assignment_role,
      assignmentSupport: row?.choice?.assignment_support,
      focusGrapheme: row?.choice?.engine_focus_grapheme || row?.choice?.focus_graphemes?.[0] || "",
      questionType: row?.choice?.question_type,
    }),
    String(row?.id || ""),
  ])));
}

function buildAutoAssignedTargetRows({
  teacherId,
  assignmentId,
  assignmentCreatedAt,
  pupilPlans,
  poolIdBySignature,
}) {
  const baseMs = new Date(assignmentCreatedAt || new Date().toISOString()).getTime();
  let sequence = 0;

  return (pupilPlans || []).flatMap((plan) =>
    (plan?.words || []).map((wordSpec) => {
      const signature = buildAssignmentEngineWordSignature(wordSpec);
      const testWordId = poolIdBySignature.get(signature) || "";
      const createdAt = new Date(baseMs + sequence * 1000).toISOString();
      sequence += 1;
      return {
        teacherId,
        assignmentId,
        pupilId: String(plan?.pupilId || ""),
        testWordId,
        focusGrapheme: String(wordSpec?.focusGrapheme || "").trim().toLowerCase() || null,
        targetSource: ASSIGNMENT_ENGINE_TARGET_SOURCE,
        targetReason: String(wordSpec?.targetReason || "target_independent"),
        createdAt,
      };
    }).filter((row) => row.pupilId && row.testWordId)
  );
}

async function cleanupAutoAssignedArtifacts({ assignmentId, testId }) {
  const safeAssignmentId = String(assignmentId || "");
  const safeTestId = String(testId || "");

  if (safeAssignmentId) {
    try {
      await supabase.from("assignment_pupil_target_words").delete().eq("assignment_id", safeAssignmentId);
    } catch (error) {
      console.warn("Could not clean up assignment target rows:", error);
    }
    try {
      await supabase.from("assignments_v2").delete().eq("id", safeAssignmentId).eq("teacher_id", state.user.id);
    } catch (error) {
      console.warn("Could not clean up generated assignment:", error);
    }
  }

  if (safeTestId) {
    try {
      await supabase.from("test_words").delete().eq("test_id", safeTestId);
    } catch (error) {
      console.warn("Could not clean up generated test words:", error);
    }
    try {
      await supabase.from("tests").delete().eq("id", safeTestId).eq("teacher_id", state.user.id);
    } catch (error) {
      console.warn("Could not clean up generated test:", error);
    }
  }
}

function isCompletedAssignmentStatusRow(row) {
  return !!(row?.completed_at || row?.completedAt)
    || String(row?.status || "").trim().toLowerCase() === "completed";
}

function buildTestsByIdMap() {
  return new Map((state.tests || []).map((test) => [String(test?.id || ""), test]));
}

function getBaselineAssignmentsForClass(classId) {
  const safeClassId = String(classId || "");
  if (!safeClassId) return [];
  const testsById = buildTestsByIdMap();

  return (state.assignments || [])
    .filter((assignment) => String(assignment?.class_id || "") === safeClassId)
    .map((assignment) => ({
      ...assignment,
      test: testsById.get(String(assignment?.test_id || "")) || null,
    }))
    .filter((assignment) => isBaselineAssignmentWordRows(assignment?.test?.test_words));
}

function buildBaselineAssignmentMetaMap(assignments) {
  return new Map(
    (assignments || [])
      .filter((assignment) => assignment?.id)
      .map((assignment) => ([
        String(assignment.id),
        {
          preset: resolveBaselinePresetFromWordRows(assignment?.test?.test_words),
        },
      ]))
  );
}

function isBaselineAttemptRow(attempt, baselineAssignmentMetaById) {
  const attemptSource = String(attempt?.attempt_source || attempt?.attemptSource || "").trim().toLowerCase();
  if (attemptSource === "baseline") return true;
  const assignmentId = String(attempt?.assignment_id || attempt?.assignmentId || "").trim();
  return !!assignmentId && baselineAssignmentMetaById instanceof Map && baselineAssignmentMetaById.has(assignmentId);
}

function getIndependentAttemptRows(attempts) {
  return (Array.isArray(attempts) ? attempts : [])
    .filter((attempt) => getQuestionEvidenceTier(attempt?.mode) === "independent");
}

async function readCompletedBaselineStatusRows({ assignmentIds = [], pupilIds = [] } = {}) {
  const safeAssignmentIds = [...new Set((assignmentIds || []).map((item) => String(item || "")).filter(Boolean))];
  const safePupilIds = [...new Set((pupilIds || []).map((item) => String(item || "")).filter(Boolean))];
  if (!safeAssignmentIds.length || !safePupilIds.length) return [];

  const { data, error } = await supabase
    .from("assignment_pupil_statuses")
    .select("assignment_id, pupil_id, status, completed_at")
    .in("assignment_id", safeAssignmentIds)
    .in("pupil_id", safePupilIds);

  if (error) {
    if (isMissingAssignmentStatusTableError(error)) return [];
    throw error;
  }

  return (data || []).filter((row) => isCompletedAssignmentStatusRow(row));
}

function buildPlacementCurrentProfiles({
  pupilIds = [],
  attempts = [],
  baselineStatusRows = [],
  baselineAssignmentMetaById = new Map(),
  resolvedWordMap = null,
} = {}) {
  const placementSeedProfiles = buildPlacementSeedProfiles({
    attempts,
    completedStatuses: baselineStatusRows,
    assignmentMetaById: baselineAssignmentMetaById,
    resolvedWordMap,
  });
  const currentProfiles = {};

  for (const pupilId of pupilIds || []) {
    const safePupilId = String(pupilId || "");
    if (!safePupilId) continue;

    const placementProfile = placementSeedProfiles[safePupilId];
    if (!placementProfile) continue;

    const pupilAttempts = (attempts || []).filter((attempt) => String(attempt?.pupil_id || "") === safePupilId);
    const liveAttempts = pupilAttempts.filter((attempt) => !isBaselineAttemptRow(attempt, baselineAssignmentMetaById));
    const liveIndependentAttempts = getIndependentAttemptRows(liveAttempts);
    if (liveIndependentAttempts.length >= BASELINE_LIVE_INDEPENDENT_MIN_ATTEMPTS) continue;

    const liveIndependentProfile = liveIndependentAttempts.length
      ? buildProfileFromAttempts(liveIndependentAttempts, resolvedWordMap)
      : null;
    currentProfiles[safePupilId] = mergePlacementWithLiveProfiles(liveIndependentProfile, placementProfile);
  }

  return currentProfiles;
}

function needsStarterCatalogFallback(plan, pupilIds) {
  return !!plan?.error
    || !plan?.pupilPlans?.length
    || plan.pupilPlans.length < Math.max(0, Number((pupilIds || []).length || 0));
}

async function readActivePupilIdsByClass(classIds = []) {
  const safeClassIds = normalizeIdList(classIds);
  if (!safeClassIds.length) {
    return {
      pupilIdsByClassId: new Map(),
      allPupilIds: [],
    };
  }

  const { data: membershipRows, error: membershipError } = await supabase
    .from("pupil_classes")
    .select("class_id, pupil_id")
    .in("class_id", safeClassIds)
    .eq("active", true);
  if (membershipError) throw membershipError;

  const pupilIdsByClassId = new Map();
  for (const classId of safeClassIds) {
    pupilIdsByClassId.set(classId, []);
  }
  for (const row of membershipRows || []) {
    const classId = String(row?.class_id || "").trim();
    const pupilId = String(row?.pupil_id || "").trim();
    if (!classId || !pupilId) continue;
    const next = pupilIdsByClassId.get(classId) || [];
    next.push(pupilId);
    pupilIdsByClassId.set(classId, next);
  }

  for (const [classId, pupilIds] of pupilIdsByClassId.entries()) {
    pupilIdsByClassId.set(classId, normalizeIdList(pupilIds));
  }

  return {
    pupilIdsByClassId,
    allPupilIds: normalizeIdList(Array.from(pupilIdsByClassId.values()).flat()),
  };
}

function buildPupilWordCountByPupil(pupilPlans = []) {
  return Object.fromEntries(
    (Array.isArray(pupilPlans) ? pupilPlans : [])
      .map((plan) => {
        const pupilId = String(plan?.pupilId || "").trim();
        return pupilId ? [pupilId, Math.max(0, Number(plan?.words?.length || 0))] : null;
      })
      .filter(Boolean)
  );
}

function isAutomatedPersonalisedAssignment(assignment, testsById = new Map()) {
  const automationKind = String(assignment?.automation_kind || "").trim().toLowerCase();
  const automationSource = String(assignment?.automation_source || "").trim().toLowerCase();
  if (
    automationKind === ASSIGNMENT_AUTOMATION_KIND_PERSONALISED
    && automationSource === ASSIGNMENT_AUTOMATION_SOURCE_MANUAL_RUN_NOW
  ) {
    return true;
  }

  const testId = String(assignment?.test_id || "").trim();
  const test = testsById.get(testId) || null;
  return isFullyGeneratedAssignmentWordRows(test?.test_words || []);
}

async function buildActiveAutomatedAssignmentMap({ pupilIds = [] } = {}) {
  const safePupilIds = normalizeIdList(pupilIds);
  if (!safePupilIds.length) return new Map();

  const testsById = buildTestsByIdMap();
  const automatedAssignments = (state.assignments || []).filter((assignment) =>
    isAutomatedPersonalisedAssignment(assignment, testsById)
  );
  const assignmentIds = automatedAssignments
    .map((assignment) => String(assignment?.id || "").trim())
    .filter(Boolean);
  if (!assignmentIds.length) return new Map();

  const [targetRes, statusRes] = await Promise.all([
    supabase
      .from("assignment_pupil_target_words")
      .select("assignment_id, pupil_id")
      .in("assignment_id", assignmentIds)
      .in("pupil_id", safePupilIds),
    supabase
      .from("assignment_pupil_statuses")
      .select("assignment_id, pupil_id, status, completed_at")
      .in("assignment_id", assignmentIds)
      .in("pupil_id", safePupilIds),
  ]);

  if (targetRes.error && !isMissingAssignmentTargetTableError(targetRes.error)) throw targetRes.error;
  if (statusRes.error && !isMissingAssignmentStatusTableError(statusRes.error)) throw statusRes.error;

  const assignmentById = new Map(
    automatedAssignments.map((assignment) => [String(assignment?.id || "").trim(), assignment])
  );
  const statusByKey = new Map(
    (statusRes.data || []).map((row) => ([
      `${String(row?.assignment_id || "").trim()}::${String(row?.pupil_id || "").trim()}`,
      row,
    ]))
  );
  const activeByPupil = new Map();

  for (const row of targetRes.data || []) {
    const assignmentId = String(row?.assignment_id || "").trim();
    const pupilId = String(row?.pupil_id || "").trim();
    if (!assignmentId || !pupilId || activeByPupil.has(pupilId)) continue;
    const statusRow = statusByKey.get(`${assignmentId}::${pupilId}`) || null;
    if (isCompletedAssignmentStatusRow(statusRow)) continue;
    const assignment = assignmentById.get(assignmentId) || null;
    activeByPupil.set(pupilId, {
      assignmentId,
      classId: String(assignment?.class_id || "").trim(),
      title: String(assignment?.tests?.title || "").trim(),
    });
  }

  for (const row of statusRes.data || []) {
    const assignmentId = String(row?.assignment_id || "").trim();
    const pupilId = String(row?.pupil_id || "").trim();
    if (!assignmentId || !pupilId || activeByPupil.has(pupilId)) continue;
    if (isCompletedAssignmentStatusRow(row)) continue;
    const assignment = assignmentById.get(assignmentId) || null;
    activeByPupil.set(pupilId, {
      assignmentId,
      classId: String(assignment?.class_id || "").trim(),
      title: String(assignment?.tests?.title || "").trim(),
    });
  }

  return activeByPupil;
}

async function buildPersonalisedPlanForClass({
  classId = "",
  pupilIds = [],
  policy = AUTO_ASSIGN_POLICY_DEFAULTS,
  teacherTests = state.tests,
} = {}) {
  const safeClassId = String(classId || "").trim();
  const safePupilIds = normalizeIdList(pupilIds);
  const effectivePolicy = normalizeAutoAssignPolicy(policy);
  if (!safeClassId || !safePupilIds.length) {
    throw new Error("No eligible pupils were available for this class.");
  }

  const historyLimit = Math.max(800, Math.min(4000, safePupilIds.length * 180));
  const { data: attemptRows, error: attemptError } = await supabase
    .from("attempts")
    .select("pupil_id, assignment_id, test_word_id, assignment_target_id, mode, attempt_source, correct, attempt_number, created_at, focus_grapheme, pattern_type, word_text, typed, target_graphemes")
    .in("pupil_id", safePupilIds)
    .order("created_at", { ascending: false })
    .limit(historyLimit);
  if (attemptError) throw attemptError;

  const baselineAssignments = getBaselineAssignmentsForClass(safeClassId);
  const baselineAssignmentMetaById = buildBaselineAssignmentMetaMap(baselineAssignments);
  const baselineStatusRows = await readCompletedBaselineStatusRows({
    assignmentIds: baselineAssignments.map((assignment) => assignment?.id),
    pupilIds: safePupilIds,
  });

  const resolvedWordMap = await buildResolvedWordMap({
    teacherId: state.user.id,
    words: [
      ...(attemptRows || []).map((item) => item?.word_text || ""),
      ...(attemptRows || []).map((item) => item?.typed || ""),
    ],
  });

  const currentProfiles = buildPlacementCurrentProfiles({
    pupilIds: safePupilIds,
    attempts: attemptRows || [],
    baselineStatusRows,
    baselineAssignmentMetaById,
    resolvedWordMap,
  });
  const nonBaselineAttempts = (attemptRows || []).filter(
    (attempt) => !isBaselineAttemptRow(attempt, baselineAssignmentMetaById)
  );
  let plan = buildGeneratedAssignmentPlan({
    pupilIds: safePupilIds,
    teacherTests,
    attempts: nonBaselineAttempts,
    totalWords: effectivePolicy.assignment_length,
    currentProfiles,
    resolvedWordMap,
    policy: effectivePolicy,
  });

  if (effectivePolicy.allow_starter_fallback && needsStarterCatalogFallback(plan, safePupilIds)) {
    plan = buildGeneratedAssignmentPlan({
      pupilIds: safePupilIds,
      teacherTests: [...teacherTests, ...buildStarterCatalogVirtualTests()],
      attempts: nonBaselineAttempts,
      totalWords: effectivePolicy.assignment_length,
      currentProfiles,
      resolvedWordMap,
      policy: effectivePolicy,
    });
  }

  if (!plan?.pupilPlans?.length || plan.error) {
    const baseError =
      plan?.error
        || `Not enough saved words are available to build a ${effectivePolicy.assignment_length}-word personalised test for this class.`;
    const policyAwareError = effectivePolicy.allow_starter_fallback
      ? baseError
      : `${baseError} Starter fallback is off for this run.`;
    throw new Error(policyAwareError);
  }

  return {
    plan,
    effectivePolicy,
  };
}

async function createGeneratedAssignmentForClass({
  classId = "",
  className = "",
  deadlineIso = null,
  plan = null,
  automationContext = null,
  seedIncludedStatuses = false,
} = {}) {
  const safeClassId = String(classId || "").trim();
  if (!safeClassId || !plan?.pupilPlans?.length) {
    throw new Error("Could not create a personalised assignment without pupil plans.");
  }

  let createdTestId = "";
  let createdAssignmentId = "";

  try {
    const title = buildAssignmentEngineTitle({
      className: className || "Class",
      focusGrapheme: plan.clearFocusGrapheme,
      date: new Date(),
    });

    const { data: createdTest, error: testError } = await insertSingleRowWithAnalyticsFallback("tests", {
      teacher_id: state.user.id,
      title,
      status: "published",
      question_type: "no_support_assessment",
      analytics_target_words_enabled: false,
      analytics_target_words_per_pupil: 0,
    }, "id");
    if (testError || !createdTest?.id) throw testError || new Error("Could not create the generated test.");
    createdTestId = String(createdTest.id);

    const poolEntries = buildAutoAssignedPoolEntries(plan.pupilPlans);
    const { data: insertedWordRows, error: wordError } = await supabase
      .from("test_words")
      .insert(poolEntries.map((entry) => ({
        test_id: createdTestId,
        ...entry.payload,
      })))
      .select("id, word, sentence, segments, choice");
    if (wordError) throw wordError;

    const poolIdBySignature = buildAutoAssignedPoolIdMap(insertedWordRows || []);
    const { data: createdAssignment, error: assignmentError } = await insertSingleRowWithAnalyticsFallback(
      "assignments_v2",
      {
        teacher_id: state.user.id,
        test_id: createdTestId,
        class_id: safeClassId,
        mode: "test",
        max_attempts: null,
        audio_enabled: true,
        hints_enabled: true,
        end_at: deadlineIso || null,
        analytics_target_words_enabled: false,
        analytics_target_words_per_pupil: 0,
        automation_kind: automationContext?.kind || null,
        automation_source: automationContext?.source || null,
        automation_run_id: automationContext?.runId || null,
        automation_triggered_by: automationContext?.triggeredBy || null,
      },
      "id, created_at",
    );
    if (assignmentError && isMissingAutomationMetadataColumnError(assignmentError)) {
      throw new Error("Personalised automation fields are not available yet. Run the latest Supabase migration.");
    }
    if (assignmentError || !createdAssignment?.id) {
      throw assignmentError || new Error("Could not create the class assignment.");
    }
    createdAssignmentId = String(createdAssignment.id);

    const targetRows = buildAutoAssignedTargetRows({
      teacherId: state.user.id,
      assignmentId: createdAssignmentId,
      assignmentCreatedAt: createdAssignment.created_at || new Date().toISOString(),
      pupilPlans: plan.pupilPlans,
      poolIdBySignature,
    });
    await persistAssignmentTargetRows({
      existingRows: await readAssignmentTargetRows(createdAssignmentId),
      generatedRows: targetRows,
    });

    const pupilWordCountsByPupil = buildPupilWordCountByPupil(plan.pupilPlans);
    if (seedIncludedStatuses) {
      await seedAutomatedAssignmentPupilStatuses({
        assignmentId: createdAssignmentId,
        classId: safeClassId,
        testId: createdTestId,
        pupilWordCountsByPupil,
      });
    }

    return {
      assignmentId: createdAssignmentId,
      testId: createdTestId,
      pupilWordCountsByPupil,
      pupilPlans: plan.pupilPlans,
    };
  } catch (error) {
    if (createdAssignmentId || createdTestId) {
      await cleanupAutoAssignedArtifacts({
        assignmentId: createdAssignmentId,
        testId: createdTestId,
      });
    }
    throw error;
  }
}

async function handleCreateBaselineAssignment(form) {
  if (!(canManageOwnContent() && canAssignTests())) {
    showNotice("Teacher or admin access is required to set a baseline test.", "error");
    paint();
    return;
  }

  const fd = new FormData(form);
  const classId = String(fd.get("class_id") || "").trim();
  const deadlineRaw = String(fd.get("deadline") || "").trim();
  const selectedClass = state.classes.find((item) => String(item?.id || "") === classId) || null;

  if (!classId || !selectedClass || !canEditClassRecord(selectedClass)) {
    showNotice("Choose a class before setting the baseline test.", "error");
    paint();
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  setBusy(submitBtn, true, "Building...");

  let createdTestId = "";
  let createdAssignmentId = "";

  try {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("pupil_classes")
      .select("pupil_id")
      .eq("class_id", classId)
      .eq("active", true);
    if (membershipError) throw membershipError;
    if (!(membershipRows || []).some((row) => String(row?.pupil_id || "").trim())) {
      throw new Error("This class does not have any active pupils yet.");
    }

    const definition = buildBaselineAssignmentDefinition({
      className: selectedClass.name || "Class",
      date: new Date(),
    });
    if (!definition?.wordRows?.length) {
      throw new Error("Could not build the baseline test.");
    }

    const { data: createdTest, error: testError } = await insertSingleRowWithAnalyticsFallback("tests", {
      teacher_id: state.user.id,
      title: definition.title,
      status: "published",
      question_type: definition.questionType || "segmented_spelling",
      analytics_target_words_enabled: false,
      analytics_target_words_per_pupil: 0,
    }, "id");
    if (testError || !createdTest?.id) throw testError || new Error("Could not create the baseline test.");
    createdTestId = String(createdTest.id);

    const { error: wordError } = await supabase
      .from("test_words")
      .insert(
        definition.wordRows.map((row) => ({
          test_id: createdTestId,
          ...row,
        }))
      );
    if (wordError) throw wordError;

    const { data: createdAssignment, error: assignmentError } = await insertSingleRowWithAnalyticsFallback(
      "assignments_v2",
      {
        teacher_id: state.user.id,
        test_id: createdTestId,
        class_id: classId,
        mode: "test",
        max_attempts: null,
        audio_enabled: true,
        hints_enabled: false,
        end_at: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
        analytics_target_words_enabled: false,
        analytics_target_words_per_pupil: 0,
      },
      "id",
    );
    if (assignmentError || !createdAssignment?.id) {
      throw assignmentError || new Error("Could not create the class assignment.");
    }
    createdAssignmentId = String(createdAssignment.id);

    state.createBaselineOpen = false;
    await loadDashboardData();
    openDashboardSection("upcoming");
    state.activePanel = null;
    showNotice("Baseline test assigned.", "success");
    paint();
  } catch (error) {
    console.error("create baseline assignment error:", error);
    if (createdAssignmentId || createdTestId) {
      await cleanupAutoAssignedArtifacts({
        assignmentId: createdAssignmentId,
        testId: createdTestId,
      });
    }
    showNotice(error?.message || "Could not assign the baseline test.", "error");
    paint();
  } finally {
    setBusy(submitBtn, false);
  }
}

async function handleAutoAssignPractice(form) {
  const fd = new FormData(form);
  const classId = String(fd.get("class_id") || "");
  const deadlineRaw = String(fd.get("deadline") || "").trim();
  const selectedClass = state.classes.find((item) => String(item?.id || "") === classId) || null;

  if (!classId || !selectedClass) {
    showNotice("Choose a class before generating a personalised test.", "error");
    paint();
    return;
  }

  state.createAutoAssignClassId = classId;

  const submitBtn = form.querySelector('button[type="submit"]');
  setBusy(submitBtn, true, "Building...");

  let createdTestId = "";
  let createdAssignmentId = "";

  try {
    const { pupilIdsByClassId } = await readActivePupilIdsByClass([classId]);
    const pupilIds = pupilIdsByClassId.get(classId) || [];
    if (!pupilIds.length) {
      throw new Error("This class does not have any active pupils yet.");
    }
    const effectivePolicy = getEffectiveClassAutoAssignPolicy(classId);
    const { plan } = await buildPersonalisedPlanForClass({
      classId,
      pupilIds,
      policy: effectivePolicy,
    });
    const created = await createGeneratedAssignmentForClass({
      classId,
      className: selectedClass.name || "Class",
      deadlineIso: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
      plan,
    });
    createdTestId = String(created?.testId || "");
    createdAssignmentId = String(created?.assignmentId || "");

    state.createAutoAssignOpen = false;
    await loadDashboardData();
    openDashboardSection("upcoming");
    state.activePanel = null;
    showNotice("Personalised test generated.", "success");
    paint();
  } catch (error) {
    console.error("auto assign practice error:", error);
    if (createdAssignmentId || createdTestId) {
      await cleanupAutoAssignedArtifacts({
        assignmentId: createdAssignmentId,
        testId: createdTestId,
      });
    }
    showNotice(error?.message || "Could not generate the personalised test.", "error");
    paint();
  } finally {
    setBusy(submitBtn, false);
  }
}

function summarizeSkipReasons(rows = []) {
  const counts = {};
  for (const row of rows || []) {
    const key = String(row?.skip_reason || row?.skipReason || "").trim().toLowerCase();
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function buildRunNowNotice({
  classResults = [],
  includedPupilCount = 0,
  skippedPupilCount = 0,
  errorCount = 0,
} = {}) {
  const generatedClassCount = (classResults || []).filter((item) => item?.status === "generated").length;
  const parts = [
    generatedClassCount === 0
      ? "No new personalised tests were generated."
      : (generatedClassCount === 1
        ? "Generated 1 personalised test."
        : `Generated ${generatedClassCount} personalised tests.`),
    `Included ${Math.max(0, Number(includedPupilCount || 0))} pupil${Number(includedPupilCount || 0) === 1 ? "" : "s"}.`,
    `Skipped ${Math.max(0, Number(skippedPupilCount || 0))} pupil${Number(skippedPupilCount || 0) === 1 ? "" : "s"}.`,
  ];
  if (errorCount > 0) {
    parts.push(`${errorCount} class${errorCount === 1 ? "" : "es"} could not be processed.`);
  }
  return parts.join(" ");
}

async function handleSaveAutomationPolicy(form) {
  if (!canManageAutomation()) return;

  if (isSelectedAutomationPolicyBusy()) return;

  const selectedKey = getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY;
  const draftEntry = getCurrentAutomationDraftEntry();
  if (!draftEntry.dirty) return;
  const { policy, errors } = getAutomationRunPolicyValidation();
  if (errors.length) {
    showNotice(errors[0], "error");
    paint();
    return;
  }

  let shouldScrollToTop = false;
  setAutomationActionState({
    policyKey: resolveAutomationActionPolicyKey(policy, selectedKey),
    mode: "saving",
    statusMessage: "Saving changes to this policy...",
  });
  paint();

  try {
    const savedPolicy = await upsertPersonalisedAutomationPolicy({
      id: policy.id,
      name: policy.name,
      description: policy.description,
      assignment_length: policy.assignment_length,
      support_preset: policy.support_preset,
      allow_starter_fallback: policy.allow_starter_fallback,
      frequency: policy.frequency,
      selected_weekdays: policy.selected_weekdays,
      selected_weekdays_week_1: policy.selected_weekdays_week_1,
      selected_weekdays_week_2: policy.selected_weekdays_week_2,
      start_date: policy.start_date,
      end_date: policy.end_date,
      target_class_ids: policy.target_class_ids,
      archived_at: policy.archived_at,
      archived_by: policy.archived_by,
      duplicate_source_policy_id: draftEntry.duplicateSourcePolicyId,
    });
    markCurrentAutomationPolicySaved(savedPolicy, {
      previousKey: selectedKey,
      previousEntry: draftEntry,
    });
    showNotice(`Saved "${getAutomationPolicyDisplayName(savedPolicy)}".`, "success");
    shouldScrollToTop = true;
  } catch (error) {
    console.error("save automation policy error:", error);
    showNotice(error?.message || "Could not save the automation policy.", "error");
  } finally {
    clearAutomationActionState();
    paint();
    if (shouldScrollToTop) {
      scrollAutomationPolicyViewToTop({ behavior: "smooth" });
    }
  }
}

async function handleRunNowPersonalisedGeneration() {
  if (!canManageAutomation()) {
    showNotice("Admin access is required to run personalised generation.", "error");
    paint();
    return;
  }

  const selectedKey = getAutomationSelectedPolicyKey() || AUTOMATION_NEW_POLICY_KEY;
  const draftEntry = getCurrentAutomationDraftEntry();
  const { policy, errors } = getAutomationRunPolicyValidation();
  const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy);
  const requestedPolicyKey = resolveAutomationActionPolicyKey(policy, selectedKey);
  const currentAction = getAutomationActionState();
  if (isAutomationRunMode(currentAction.mode)) {
    showNotice("A personalised generation run is already in progress. Wait for it to finish before starting another run.", "info");
    paint();
    return;
  }
  if (
    currentAction.policyKey
    && currentAction.policyKey === requestedPolicyKey
    && currentAction.mode === "saving"
  ) {
    showNotice("Wait for the current save to finish before running this policy.", "info");
    paint();
    return;
  }
  if (errors.length) {
    showNotice(errors[0], "error");
    paint();
    return;
  }
  if (lifecycle.archived) {
    showNotice("Restore this policy before you run it.", "error");
    paint();
    return;
  }
  if (lifecycle.expired) {
    showNotice(`This policy expired on ${formatShortDate(policy.end_date)}. Extend its dates before you run it.`, "error");
    paint();
    return;
  }
  if (lifecycle.scheduled) {
    showNotice(`This policy is scheduled to start on ${formatShortDate(policy.start_date)}.`, "error");
    paint();
    return;
  }

  let effectivePolicy = policy;
  const selectedClassIds = sortAutomationRunClassIds(effectivePolicy.target_class_ids);
  const deadlineMeta = derivePersonalisedAutomationDeadline(effectivePolicy, { from: new Date() });
  const deadlineIso = deadlineMeta.deadlineIso || null;

  if (!selectedClassIds.length) {
    showNotice("Select at least one form or intervention group before you run personalised generation.", "error");
    paint();
    return;
  }

  setAutomationActionState({
    policyKey: requestedPolicyKey,
    mode: draftEntry.dirty || !String(policy.id || "").trim() ? "saving_and_running" : "running",
    statusMessage: "Generating personalised tests for this policy...",
  });
  paint();

  let runRecord = null;

  try {
    if (draftEntry.dirty || !String(effectivePolicy.id || "").trim()) {
      const savedFromRun = await upsertPersonalisedAutomationPolicy({
        id: effectivePolicy.id,
        name: effectivePolicy.name,
        description: effectivePolicy.description,
        assignment_length: effectivePolicy.assignment_length,
        support_preset: effectivePolicy.support_preset,
        allow_starter_fallback: effectivePolicy.allow_starter_fallback,
        frequency: effectivePolicy.frequency,
        selected_weekdays: effectivePolicy.selected_weekdays,
        selected_weekdays_week_1: effectivePolicy.selected_weekdays_week_1,
        selected_weekdays_week_2: effectivePolicy.selected_weekdays_week_2,
        start_date: effectivePolicy.start_date,
        end_date: effectivePolicy.end_date,
        target_class_ids: effectivePolicy.target_class_ids,
        archived_at: effectivePolicy.archived_at,
        archived_by: effectivePolicy.archived_by,
        duplicate_source_policy_id: draftEntry.duplicateSourcePolicyId,
      });
      markCurrentAutomationPolicySaved(savedFromRun, {
        previousKey: selectedKey,
        previousEntry: draftEntry,
      });
      effectivePolicy = normalizePersonalisedAutomationPolicy(savedFromRun);
      setAutomationActionState({
        policyKey: resolveAutomationActionPolicyKey(effectivePolicy, selectedKey),
        mode: "running",
        statusMessage: "Generating personalised tests for this policy...",
      });
      paint();
    }

    runRecord = await createPersonalisedGenerationRun({
      selectedClassIds,
      automationPolicyId: effectivePolicy.id || "",
      policySnapshot: effectivePolicy,
      derivedDeadlineAt: deadlineIso,
      assignment_length: effectivePolicy.assignment_length,
      support_preset: effectivePolicy.support_preset,
      allow_starter_fallback: effectivePolicy.allow_starter_fallback,
    });

    const { pupilIdsByClassId, allPupilIds } = await readActivePupilIdsByClass(selectedClassIds);
    const [activeAutomationByPupil, baselineGateEntries] = await Promise.all([
      buildActiveAutomatedAssignmentMap({ pupilIds: allPupilIds }),
      Promise.all(
        allPupilIds.map(async (pupilId) => ([
          pupilId,
          await readPupilBaselineGateState({ pupilId }),
        ]))
      ),
    ]);
    const baselineGateByPupil = new Map(baselineGateEntries);

    const classResults = [];
    let includedPupilCount = 0;
    let skippedPupilCount = 0;
    let errorCount = 0;

    for (const classId of selectedClassIds) {
      const selectedClass = state.classes.find((item) => String(item?.id || "") === classId) || null;
      const className = String(selectedClass?.name || "Class").trim() || "Class";
      const classPupilIds = pupilIdsByClassId.get(classId) || [];
      const skippedRows = [];

      if (!classPupilIds.length) {
        classResults.push({
          classId,
          className,
          status: "no_active_pupils",
          includedCount: 0,
          skippedCount: 0,
          skipReasons: {},
          assignmentId: "",
        });
        continue;
      }

      const includedPupilIds = [];
      for (const pupilId of classPupilIds) {
        const baselineGate = baselineGateByPupil.get(pupilId) || null;
        if (baselineGate?.status !== "ready") {
          skippedRows.push({
            runId: runRecord.id,
            classId,
            pupilId,
            status: "skipped",
            skipReason: "baseline_incomplete",
          });
          continue;
        }
        if (activeAutomationByPupil.has(pupilId)) {
          skippedRows.push({
            runId: runRecord.id,
            classId,
            pupilId,
            status: "skipped",
            skipReason: "active_automated_assignment",
          });
          continue;
        }
        includedPupilIds.push(pupilId);
      }

      skippedPupilCount += skippedRows.length;

      if (!includedPupilIds.length) {
        if (skippedRows.length) {
          await upsertPersonalisedGenerationRunPupilRows(skippedRows);
        }
        classResults.push({
          classId,
          className,
          status: "skipped",
          includedCount: 0,
          skippedCount: skippedRows.length,
          skipReasons: summarizeSkipReasons(skippedRows),
          assignmentId: "",
        });
        continue;
      }

      let created = null;
      try {
        const { plan } = await buildPersonalisedPlanForClass({
          classId,
          pupilIds: includedPupilIds,
          policy: effectivePolicy,
        });
        created = await createGeneratedAssignmentForClass({
          classId,
          className,
          deadlineIso,
          plan,
          automationContext: {
            kind: ASSIGNMENT_AUTOMATION_KIND_PERSONALISED,
            source: ASSIGNMENT_AUTOMATION_SOURCE_MANUAL_RUN_NOW,
            runId: runRecord.id,
            triggeredBy: state.user.id,
          },
          seedIncludedStatuses: true,
        });

        const includedRows = includedPupilIds.map((pupilId) => ({
          runId: runRecord.id,
          classId,
          pupilId,
          assignmentId: created.assignmentId,
          status: "included",
          skipReason: null,
        }));
        await upsertPersonalisedGenerationRunPupilRows([...includedRows, ...skippedRows]);

        for (const pupilId of includedPupilIds) {
          activeAutomationByPupil.set(pupilId, {
            assignmentId: created.assignmentId,
            classId,
            title: "",
          });
        }

        includedPupilCount += includedRows.length;
        classResults.push({
          classId,
          className,
          status: "generated",
          assignmentId: created.assignmentId,
          includedCount: includedRows.length,
          skippedCount: skippedRows.length,
          skipReasons: summarizeSkipReasons(skippedRows),
        });
      } catch (classError) {
        console.error("run now personalised generation class error:", {
          classId,
          error: classError,
        });
        if (created?.assignmentId || created?.testId) {
          await cleanupAutoAssignedArtifacts({
            assignmentId: created.assignmentId,
            testId: created.testId,
          });
        }
        errorCount += 1;
        if (skippedRows.length) {
          await upsertPersonalisedGenerationRunPupilRows(skippedRows);
        }
        classResults.push({
          classId,
          className,
          status: "error",
          assignmentId: "",
          includedCount: 0,
          skippedCount: skippedRows.length,
          skipReasons: summarizeSkipReasons(skippedRows),
          error: classError?.message || "Could not generate a personalised test for this class.",
        });
      }
    }

    const runStatus = errorCount > 0 && includedPupilCount === 0 ? "failed" : "completed";
    await updatePersonalisedGenerationRun({
      runId: runRecord.id,
      status: runStatus,
      classCount: selectedClassIds.length,
      includedPupilCount,
      skippedPupilCount,
      summary: {
        classes: classResults,
        errorCount,
        automationPolicyId: effectivePolicy.id || null,
        policySnapshot: effectivePolicy,
        derivedDeadlineAt: deadlineIso,
        nextReleaseAt: deadlineMeta.nextRelease ? deadlineMeta.nextRelease.toISOString() : null,
      },
    });

    await loadDashboardData();
    openDashboardSection("upcoming");
    state.createAutoAssignOpen = false;
    state.activePanel = null;
    showNotice(
      buildRunNowNotice({
        classResults,
        includedPupilCount,
        skippedPupilCount,
        errorCount,
      }),
      runStatus === "failed" ? "error" : (errorCount > 0 ? "info" : "success"),
    );
    paint();
  } catch (error) {
    console.error("run now personalised generation error:", error);
    if (runRecord?.id) {
      await updatePersonalisedGenerationRun({
        runId: runRecord.id,
        status: "failed",
        classCount: selectedClassIds.length,
        includedPupilCount: 0,
        skippedPupilCount: 0,
        summary: {
          error: error?.message || "Could not complete the automation run.",
        },
      }).catch((updateError) => {
        console.warn("Could not mark personalised generation run failed:", updateError);
      });
    }
    showNotice(error?.message || "Could not run personalised generation.", "error");
  } finally {
    clearAutomationActionState();
    paint();
  }
}

function buildDuplicatedAutomationPolicyDraft(sourcePolicy) {
  return normalizePersonalisedAutomationPolicy({
    ...sourcePolicy,
    id: "",
    name: `Copy of ${getAutomationPolicyDisplayName(sourcePolicy)}`,
    archived_at: null,
    archived_by: "",
    target_class_ids: [],
  });
}

function handleStartNewAutomationPolicy() {
  if (!canManageAutomation()) return;
  if (isAnyAutomationPolicyBusy()) {
    showAutomationPolicyBusyNotice();
    return;
  }
  startNewAutomationPolicyDraft({
    policy: createBlankAutomationPolicyDraft(),
    duplicateSourcePolicyId: "",
  });
  state.createAutoAssignOpen = true;
  paint();
}

function handleSelectAutomationPolicy(policyId) {
  if (!canManageAutomation()) return;
  if (isAnyAutomationPolicyBusy()) {
    showAutomationPolicyBusyNotice();
    return;
  }
  selectAutomationPolicy(policyId);
  state.createAutoAssignOpen = true;
  paint();
}

function focusAutomationPolicyScheduleField({ behavior = "smooth" } = {}) {
  requestAnimationFrame(() => {
    const input = rootEl?.querySelector('[data-field="automation-policy-end-date"]');
    input?.scrollIntoView?.({ behavior, block: "center" });
    if (input instanceof HTMLInputElement) {
      input.focus({ preventScroll: true });
    }
  });
}

function handleExtendAutomationPolicy(policyId) {
  if (!canManageAutomation()) return;
  if (isAnyAutomationPolicyBusy()) {
    showAutomationPolicyBusyNotice();
    return;
  }
  const sourcePolicy = getSavedAutomationPolicyById(policyId);
  if (!sourcePolicy) {
    showNotice("Choose a saved automation policy first.", "error");
    paint();
    return;
  }
  selectAutomationPolicy(policyId);
  state.createAutoAssignOpen = true;
  paint();
  focusAutomationPolicyScheduleField();
}

function handleDuplicateAutomationPolicy(policyId) {
  if (!canManageAutomation()) return;
  if (isAnyAutomationPolicyBusy()) {
    showAutomationPolicyBusyNotice();
    return;
  }
  const sourcePolicy = getSavedAutomationPolicyById(policyId);
  if (!sourcePolicy) {
    showNotice("Choose a saved automation policy to duplicate.", "error");
    paint();
    return;
  }
  startNewAutomationPolicyDraft({
    policy: buildDuplicatedAutomationPolicyDraft(sourcePolicy),
    duplicateSourcePolicyId: String(sourcePolicy.id || "").trim(),
  });
  state.createAutoAssignOpen = true;
  showNotice(`Started a draft copy of "${getAutomationPolicyDisplayName(sourcePolicy)}". Targets are intentionally left blank.`, "info");
  paint();
}

async function handleSetAutomationPolicyArchived(policyId, archived) {
  if (!canManageAutomation()) return;
  if (isAnyAutomationPolicyBusy()) {
    showAutomationPolicyBusyNotice();
    return;
  }
  const sourcePolicy = getSavedAutomationPolicyById(policyId);
  if (!sourcePolicy) {
    showNotice("Choose a saved automation policy first.", "error");
    paint();
    return;
  }
  const actionLabel = archived ? "archive" : "restore";
  const confirmed = window.confirm(
    archived
      ? `Archive "${getAutomationPolicyDisplayName(sourcePolicy)}"? It will stay on record but will not be available for future runs until restored.`
      : `Restore "${getAutomationPolicyDisplayName(sourcePolicy)}"?`
  );
  if (!confirmed) return;

  try {
    const savedPolicy = await setPersonalisedAutomationPolicyArchived({
      policyId,
      archived,
    });
    const nextPolicies = getAutomationPolicies()
      .filter((item) => String(item?.id || "").trim() !== String(policyId || "").trim());
    if (savedPolicy) nextPolicies.push(savedPolicy);
    state.automationPolicies = nextPolicies;
    if (String(getAutomationSelectedPolicyKey() || "") === String(policyId || "")) {
      const currentEntry = getCurrentAutomationDraftEntry();
      state.automationDraftsByKey[policyId] = buildAutomationDraftEntry({
        policy: savedPolicy,
        dirty: false,
        targetFilters: currentEntry?.targetFilters || createDefaultAutomationTargetFilters(),
        targetFiltersTouched: currentEntry?.targetFiltersTouched === true,
      }, { basePolicy: savedPolicy });
    }
    persistAutomationPolicyDraft();
    showNotice(
      archived
        ? `Archived "${getAutomationPolicyDisplayName(savedPolicy || sourcePolicy)}".`
        : `Restored "${getAutomationPolicyDisplayName(savedPolicy || sourcePolicy)}".`,
      "success",
    );
    paint();
  } catch (error) {
    console.error(`${actionLabel} automation policy error:`, error);
    showNotice(error?.message || `Could not ${actionLabel} the automation policy.`, "error");
    paint();
  }
}

async function handleDeleteAutomationPolicy(policyId) {
  if (!canManageAutomation()) return;
  if (isAnyAutomationPolicyBusy()) {
    showAutomationPolicyBusyNotice();
    return;
  }
  const sourcePolicy = getSavedAutomationPolicyById(policyId);
  if (!sourcePolicy) {
    showNotice("Choose a saved automation policy first.", "error");
    paint();
    return;
  }

  const confirmed = window.confirm(
    `Delete "${getAutomationPolicyDisplayName(sourcePolicy)}"? Past run records will keep their snapshots, but this saved policy and its target links will be removed.`
  );
  if (!confirmed) return;

  try {
    const deletedPolicy = await deletePersonalisedAutomationPolicy(policyId);
    state.automationPolicies = getAutomationPolicies()
      .filter((item) => String(item?.id || "").trim() !== String(policyId || "").trim());
    if (state.automationDraftsByKey?.[policyId]) {
      delete state.automationDraftsByKey[policyId];
    }
    if (String(state.automationSelectedPolicyKey || "").trim() === String(policyId || "").trim()) {
      state.automationSelectedPolicyKey = state.automationDraftsByKey?.[AUTOMATION_NEW_POLICY_KEY]
        ? AUTOMATION_NEW_POLICY_KEY
        : String(state.automationPolicies[0]?.id || "").trim();
    }
    persistAutomationPolicyDraft();
    showNotice(`Deleted "${getAutomationPolicyDisplayName(deletedPolicy || sourcePolicy)}".`, "success");
    paint();
  } catch (error) {
    console.error("delete automation policy error:", error);
    showNotice(error?.message || "Could not delete the automation policy.", "error");
    paint();
  }
}

function handleDiscardAutomationPolicyChanges() {
  if (!canManageAutomation()) return;
  if (isAnyAutomationPolicyBusy()) {
    showAutomationPolicyBusyNotice();
    return;
  }
  discardCurrentAutomationPolicyChanges();
  paint();
}

async function handleCreateTestFromCommonConfusion(button) {
  if (!canCreateTests()) {
    showNotice("Teacher or admin access is required to create tests.", "error");
    paint();
    return;
  }

  const confusionLabel = String(button?.dataset?.confusionLabel || "Common confusion").trim();
  const scopeLabel = String(button?.dataset?.scopeLabel || "").trim();
  const pairTargets = parseDatasetJsonList(button?.dataset?.confusionTargets)
    .map((item) => normalizeConfusionToken(item))
    .filter(Boolean);
  const practiceWords = [...new Set(
    parseDatasetJsonList(button?.dataset?.practiceWords)
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean),
  )].slice(0, COMMON_CONFUSION_TEST_WORD_LIMIT);

  if (!practiceWords.length) {
    showNotice("No words are ready for this test yet.", "error");
    paint();
    return;
  }

  setBusy(button, true, "Creating...");

  try {
    const testId = await createDraftGeneratedTest({
      title: buildGeneratedTestTitle(confusionLabel, scopeLabel),
      practiceWords,
      focusTargets: pairTargets,
    });
    window.location.href = buildTestBuilderUrl(testId);
  } catch (error) {
    console.error("create confusion test error:", error);
    setBusy(button, false);
    showNotice("Could not create a test from this confusion.", "error");
    paint();
  }
}

async function handleCreateTestFromGraphemeBand(button) {
  if (!canCreateTests()) {
    showNotice("Teacher or admin access is required to create tests.", "error");
    paint();
    return;
  }

  const bandLabel = String(button?.dataset?.bandLabel || "Spelling").trim();
  const scopeLabel = String(button?.dataset?.scopeLabel || "").trim();
  const focusTargets = parseDatasetJsonList(button?.dataset?.focusTargets)
    .map((item) => normalizeConfusionToken(item))
    .filter(Boolean);
  const practiceWords = [...new Set(
    parseDatasetJsonList(button?.dataset?.practiceWords)
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean),
  )].slice(0, COMMON_CONFUSION_TEST_WORD_LIMIT);

  if (!practiceWords.length) {
    showNotice(`No words are ready for the ${bandLabel.toLowerCase()} test yet.`, "error");
    paint();
    return;
  }

  setBusy(button, true, "Creating...");

  try {
    const testId = await createDraftGeneratedTest({
      title: buildGeneratedTestTitle(bandLabel, scopeLabel),
      practiceWords,
      focusTargets,
    });
    window.location.href = buildTestBuilderUrl(testId);
  } catch (error) {
    console.error("create grapheme band test error:", error);
    setBusy(button, false);
    showNotice(`Could not create a test for ${bandLabel.toLowerCase()}.`, "error");
    paint();
  }
}

async function handleGroupComparisonForm(form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  await loadGroupComparison({ button: submitBtn });
}

async function handleCreateClass(form) {
  if (!canCreateClasses()) {
    showNotice("Teacher or admin access is required to create classes.", "error");
    paint();
    return;
  }

  const fd = new FormData(form);
  const name = String(fd.get("class_name") || "").trim();
  const yearGroup = normalizeYearGroup(fd.get("year_group"));

  if (!name) {
    showNotice("Please enter a class name.", "error");
    paint();
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  setBusy(submitBtn, true, "Creating...");

  try {
    const data = await createClass({
      name,
      year_group: yearGroup,
      class_type: CLASS_TYPE_SUBJECT,
    });

    form.reset();
    await loadDashboardData();

    openDashboardSection("classes");
    state.createClassOpen = true;
    state.flashClassId = data?.id || null;
    showNotice(`Class created: ${name}`, "success");
    paint();

    requestAnimationFrame(() => {
      const input = rootEl.querySelector("#tdCreateClassInput");
      if (input instanceof HTMLInputElement) input.focus();
    });

    clearFlashLater("class");
  } catch (error) {
    console.error("create class error:", error);
    showNotice(error?.message || "Could not create class.", "error");
    paint();
  } finally {
    setBusy(submitBtn, false);
  }
}

async function handleCreateInterventionGroup(form) {
  if (!canManageInterventionGroups()) {
    showNotice("Admin access is required to create intervention groups.", "error");
    paint();
    return;
  }

  const fd = new FormData(form);
  const name = String(fd.get("group_name") || "").trim();
  const yearGroup = normalizeYearGroup(fd.get("year_group"));
  const selectedPupilIds = getInterventionBuilderSelectedPupilIds();

  if (!name) {
    showNotice("Please enter an intervention group name.", "error");
    paint();
    return;
  }

  if (!yearGroup) {
    showNotice("Choose a year group before creating the intervention group.", "error");
    paint();
    return;
  }

  if (!selectedPupilIds.length) {
    showNotice("Choose at least one pupil for the intervention group.", "error");
    paint();
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  setBusy(submitBtn, true, "Creating...");

  try {
    const createdGroup = await createInterventionGroup({
      name,
      year_group: yearGroup,
      pupil_ids: selectedPupilIds,
    });
    state.interventionGroup = createDefaultInterventionGroupState();
    state.createInterventionGroupOpen = false;
    await loadDashboardData();
    openDashboardSection("classes");
    state.flashClassId = createdGroup?.id || null;
    showNotice(`Intervention group created: ${name}`, "success");
    paint();
    clearFlashLater("class");
  } catch (error) {
    console.error("create intervention group error:", error);
    showNotice(error?.message || "Could not create the intervention group.", "error");
    paint();
  } finally {
    setBusy(submitBtn, false);
  }
}

async function handleAssignTest(form) {
  const fd = new FormData(form);

  const testId = String(fd.get("test_id") || "");
  const classId = String(fd.get("class_id") || "");
  const mode = String(fd.get("mode") || "practice");
  const maxAttemptsRaw = String(fd.get("max_attempts") || "").trim();
  const deadlineRaw = String(fd.get("deadline") || "").trim();
  const selectedTest = state.tests.find((item) => String(item?.id || "") === testId) || null;
  const analyticsTargetSettings = getAnalyticsTargetSettingsFromSource(selectedTest);

  if (!testId || !classId) {
    showNotice("Please choose a class before assigning.", "error");
    paint();
    return;
  }

  if (selectedTest?.is_auto_generated) {
    showNotice("Use Generate Personalised Test to create a fresh personalised set for a class.", "error");
    paint();
    return;
  }

  const selectedClass = findClassRecord(classId);
  if (!canAssignFromTestRecord(selectedTest) || !canEditClassRecord(selectedClass)) {
    showNotice("You can only assign your own tests to classes that you own.", "error");
    paint();
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  setBusy(submitBtn, true, "Assigning...");

  const payload = {
    teacher_id: state.user.id,
    test_id: testId,
    class_id: classId,
    mode,
    max_attempts: maxAttemptsRaw === "" ? null : Number(maxAttemptsRaw),
    audio_enabled: true,
    hints_enabled: true,
    end_at: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
    analytics_target_words_enabled: analyticsTargetSettings.enabled,
    analytics_target_words_per_pupil: analyticsTargetSettings.count,
  };

  const { data: insertedAssignment, error } = await insertSingleRowWithAnalyticsFallback(
    "assignments_v2",
    payload,
    "id, created_at",
  );

  setBusy(submitBtn, false);

  if (error) {
    console.error("assign test error:", error);
    showNotice("Could not assign test.", "error");
    paint();
    return;
  }

  if (insertedAssignment?.id) {
    try {
      await syncAssignmentPupilTargetWords({
        teacherId: state.user.id,
        assignmentId: insertedAssignment.id,
        classId,
        testId,
        createdAt: insertedAssignment.created_at || null,
        limitPerPupil: analyticsTargetSettings.limitPerPupil,
        force: true,
      });
    } catch (targetError) {
      console.warn("sync assignment targets error:", targetError);
    }
  }

  await loadDashboardData();
  openDashboardSection("upcoming");
  state.activePanel = null;
  showNotice("Test assigned successfully.", "success");
  paint();
}

async function handleEditClass(form) {
  const fd = new FormData(form);
  const classId = String(fd.get("class_id") || "");
  const name = String(fd.get("name") || "").trim();
  const yearGroup = normalizeYearGroup(fd.get("year_group"));
  const selectedClass = findClassRecord(classId);

  if (!classId || !name || !canEditClassRecord(selectedClass)) {
    showNotice("Please enter a class name.", "error");
    paint();
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  setBusy(submitBtn, true, "Saving...");

  const { error } = await supabase
    .from("classes")
    .update({ name, year_group: yearGroup })
    .eq("id", classId)
    .eq("teacher_id", state.user.id);

  setBusy(submitBtn, false);

  if (error) {
    console.error("edit class error:", error);
    showNotice("Could not save class changes.", "error");
    paint();
    return;
  }

  await loadDashboardData();
  state.activePanel = null;
  openDashboardSection("classes");
  showNotice("Class updated.", "success");
  paint();
}

async function handleSaveClassAutoAssignPolicy(form) {
  const fd = new FormData(form);
  const classId = String(fd.get("class_id") || "").trim();
  const selectedClass = state.classes.find((item) => String(item?.id || "") === classId) || null;
  if (!classId || !selectedClass || !canManageClassAutoAssignPolicyRecord(selectedClass)) {
    showNotice("Choose a class before saving the auto-assign policy.", "error");
    paint();
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  setBusy(submitBtn, true, "Saving...");

  try {
    await upsertClassAutoAssignPolicy({
      class_id: classId,
      assignment_length: fd.get("assignment_length"),
      support_preset: fd.get("support_preset"),
      allow_starter_fallback: String(fd.get("allow_starter_fallback") || "on").trim().toLowerCase() !== "off",
    });
    await loadDashboardData();
    state.activePanel = { type: "edit-class", id: classId };
    showNotice("Auto-assign policy saved.", "success");
    paint();
  } catch (error) {
    console.error("save auto-assign policy error:", error);
    showNotice(error?.message || "Could not save the auto-assign policy.", "error");
    paint();
  } finally {
    setBusy(submitBtn, false);
  }
}

async function handleResetClassAutoAssignPolicy(classId, button = null) {
  const safeClassId = String(classId || "").trim();
  if (!safeClassId) return;
  const selectedClass = findClassRecord(safeClassId);

  if (!canManageClassAutoAssignPolicyRecord(selectedClass)) {
    showNotice("You can only change auto-assign settings for classes that you own.", "error");
    paint();
    return;
  }

  if (!getSavedClassAutoAssignPolicy(safeClassId)) {
    showNotice("This class already uses the default auto-assign policy.", "info");
    paint();
    return;
  }

  setBusy(button, true, "Resetting...");

  try {
    await deleteClassAutoAssignPolicy(safeClassId);
    await loadDashboardData();
    state.activePanel = { type: "edit-class", id: safeClassId };
    showNotice("Auto-assign policy reset to default.", "success");
    paint();
  } catch (error) {
    console.error("reset auto-assign policy error:", error);
    showNotice(error?.message || "Could not reset the auto-assign policy.", "error");
    paint();
  } finally {
    setBusy(button, false);
  }
}

async function handleDeleteTest(testId) {
  const test = state.tests.find((t) => String(t.id) === String(testId));
  if (!canEditTestRecord(test)) {
    showNotice("You can only delete tests that you own.", "error");
    paint();
    return;
  }
  const label = test?.title || "this test";

  const ok = window.confirm(`Delete "${label}"?`);
  if (!ok) return;

  const { error } = await supabase
    .from("tests")
    .delete()
    .eq("id", testId)
    .eq("teacher_id", state.user.id);

  if (error) {
    console.error("delete test error:", error);
    showNotice("Could not delete test.", "error");
    paint();
    return;
  }

  await loadDashboardData();
  if (state.activePanel?.id === testId) state.activePanel = null;
  showNotice("Test deleted.", "success");
  paint();
}

async function handleDuplicateTest(testId) {
  const original = state.tests.find((t) => String(t.id) === String(testId));
  if (!canEditTestRecord(original)) {
    showNotice("You can only duplicate tests that you own.", "error");
    paint();
    return;
  }

  const { data: newTest, error: insertError } = await supabase
    .from("tests")
    .insert({
      teacher_id: state.user.id,
      title: `${original.title} (copy)`,
      question_type: normalizeStoredQuestionType(original.question_type, { title: original.title }),
    })
    .select()
    .single();

  if (insertError || !newTest) {
    console.error("duplicate test error:", insertError);
    showNotice("Could not duplicate test.", "error");
    paint();
    return;
  }

  const { data: originalWords, error: qError } = await supabase
    .from("test_words")
    .select("*")
    .eq("test_id", testId)
    .order("position", { ascending: true });

  if (!qError && Array.isArray(originalWords) && originalWords.length) {
    const wordRows = originalWords.map((q, index) => ({
      test_id: newTest.id,
      position: q.position ?? index + 1,
      word: q.word ?? "",
      sentence: q.sentence ?? null,
      segments: q.segments ?? null,
      choice: q.choice ?? null,
    }));

    const { error: copyWordsError } = await supabase
      .from("test_words")
      .insert(wordRows);

    if (copyWordsError) {
      console.error("duplicate words error:", copyWordsError);
    }
  }

  await loadDashboardData();
  openDashboardSection("tests");
  state.flashTestId = newTest.id;
  showNotice("Test duplicated.", "success");
  paint();

  clearFlashLater("test");
}

async function handleDeleteClass(classId) {
  const cls = state.classes.find((c) => String(c.id) === String(classId));
  if (!canEditClassRecord(cls)) {
    showNotice("You can only delete classes that you own.", "error");
    paint();
    return;
  }
  const label = cls?.name || "this class";

  const ok = window.confirm(`Delete "${label}"?`);
  if (!ok) return;

  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", classId)
    .eq("teacher_id", state.user.id);

  if (error) {
    console.error("delete class error:", error);
    showNotice("Could not delete class.", "error");
    paint();
    return;
  }

  await loadDashboardData();
  if (state.activePanel?.id === classId) state.activePanel = null;
  showNotice("Class deleted.", "success");
  paint();
}

function setBusy(button, isBusy, busyText = "Saving...") {
  if (!button) return;

  if (isBusy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function showNotice(message, type = "info") {
  state.notice = message;
  state.noticeType = type;
}

function hasDemoData() {
  const classMatch = (state.classes || []).some((cls) =>
    String(cls?.name || "").trim().startsWith(DEMO_CLASS_PREFIX)
  );
  const testMatch = (state.tests || []).some((test) =>
    String(test?.title || "").trim().startsWith(DEMO_TEST_PREFIX)
  );
  return classMatch || testMatch;
}

function formatCountLabel(value, singular, plural = `${singular}s`) {
  const count = Number(value || 0);
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildDemoSeedNotice(result, hadDemoDataBefore) {
  const summary = [
    formatCountLabel(result?.classesCreated, "class", "classes"),
    formatCountLabel(result?.pupilsCreated, "pupil", "pupils"),
    formatCountLabel(result?.testsCreated, "test", "tests"),
    formatCountLabel(result?.assignmentsCreated, "assignment", "assignments"),
    formatCountLabel(result?.attemptsCreated, "attempt", "attempts"),
  ].join(", ");
  const verb = hadDemoDataBefore ? "refreshed" : "loaded";
  return `Demo data ${verb}: ${summary}. Demo pupils use PIN 1234 and usernames like demo_y7_maple_1. PP, SEN, and gender group values are included in the seeded sample data.`;
}

function buildDemoClearNotice(result) {
  const removedTotal =
    Number(result?.classesCleared || 0) +
    Number(result?.testsCleared || 0) +
    Number(result?.pupilsCleared || 0) +
    Number(result?.assignmentsCleared || 0);

  if (!removedTotal) return "No demo data found to clear.";

  const summary = [
    formatCountLabel(result?.classesCleared, "class", "classes"),
    formatCountLabel(result?.pupilsCleared, "pupil", "pupils"),
    formatCountLabel(result?.testsCleared, "test", "tests"),
    formatCountLabel(result?.assignmentsCleared, "assignment", "assignments"),
  ].join(", ");

  return `Demo data cleared: ${summary}.`;
}

async function handleManageDemoData(action = "seed") {
  if (!canManageAutomation()) {
    showNotice("Admin access is required to manage demo data.", "error");
    paint();
    return;
  }

  if (state.demoData.loading) return;

  const normalizedAction = action === "clear" ? "clear" : "seed";
  const hadDemoDataBefore = hasDemoData();

  if (normalizedAction === "clear" && !hadDemoDataBefore) {
    showNotice("No demo data is loaded yet.", "info");
    paint();
    return;
  }

  if (normalizedAction === "clear") {
    const confirmed = window.confirm("Remove all demo classes, pupils, tests, assignments, and attempt history?");
    if (!confirmed) return;
  }

  state.demoData.loading = true;
  state.demoData.action = normalizedAction;
  showNotice(
    normalizedAction === "seed"
      ? (hadDemoDataBefore ? "Refreshing demo data..." : "Loading demo data...")
      : "Removing demo data...",
    "info"
  );
  paint();

  try {
    const accessToken = await getTeacherAccessTokenOrThrow();
    const result = await manageDemoSchoolData({
      action: normalizedAction,
      accessToken,
    });

    await loadDashboardData();
    state.activePanel = null;
    if (normalizedAction === "seed") {
      openDashboardSection("classes");
      showNotice(buildDemoSeedNotice(result, hadDemoDataBefore), "success");
    } else {
      showNotice(buildDemoClearNotice(result), "success");
    }
  } catch (error) {
    console.error("manage demo data error:", error);
    showNotice(
      error?.message || (normalizedAction === "seed" ? "Could not load demo data." : "Could not clear demo data."),
      "error"
    );
  } finally {
    state.demoData.loading = false;
    state.demoData.action = "";
    paint();
  }
}

function normalizeYearGroup(value) {
  const clean = String(value || "").trim();
  return clean || null;
}

function getAnalyticsClassOptions() {
  return (state.classes || []).map((cls) => ({
    value: String(cls.id),
    label: cls?.year_group ? `${cls.name} (${cls.year_group})` : String(cls.name || "Class"),
  }));
}

function getAnalyticsYearGroupOptions() {
  return Array.from(
    new Set(
      (state.classes || [])
        .map((cls) => String(cls?.year_group || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function getAnalyticsPupilOptions() {
  return (state.visualAnalytics.catalog?.pupils || []).map((item) => ({
    value: String(item.scopeId || ""),
    label: item?.subtitle ? `${String(item.label || "Pupil")} (${String(item.subtitle)})` : String(item.label || "Pupil"),
  }));
}

function getAnalyticsScopeOptions(scopeType = state.analyticsAssistant.scopeType) {
  if (scopeType === "class") return getAnalyticsClassOptions();
  if (scopeType === "year_group") {
    return getAnalyticsYearGroupOptions().map((item) => ({ value: item, label: item }));
  }
  if (scopeType === "pupil") return getAnalyticsPupilOptions();
  return [];
}

function getAnalyticsFocusOptions(scopeType = state.analyticsAssistant.scopeType) {
  if (scopeType === "overview") {
    return [{ value: "", label: "All classes" }];
  }
  if (scopeType === "class") {
    const classOptions = getAnalyticsClassOptions();
    return classOptions.length
      ? [{ value: ALL_CLASSES_SCOPE_VALUE, label: "All classes" }, ...classOptions]
      : [];
  }
  return getAnalyticsScopeOptions(scopeType);
}

function getAnalyticsFocusLabel(scopeType = state.analyticsAssistant.scopeType) {
  if (scopeType === "class") return "Class";
  if (scopeType === "year_group") return "Year group";
  if (scopeType === "pupil") return "Pupil";
  return "Focus";
}

function getAnalyticsFocusEmptyLabel(scopeType = state.analyticsAssistant.scopeType) {
  if (scopeType === "year_group") return "Add year groups first";
  if (scopeType === "pupil") return "No pupils yet";
  if (scopeType === "class") return "No classes yet";
  return "All classes";
}

function syncAnalyticsScopeId(scopeType = state.analyticsAssistant.scopeType, preferredId = state.analyticsAssistant.scopeId) {
  if (scopeType === "overview") return "";
  const options = getAnalyticsScopeOptions(scopeType);
  return options.some((item) => item.value === String(preferredId || ""))
    ? String(preferredId || "")
    : String(options[0]?.value || "");
}

function updateAnalyticsScope(scopeType, preferredId = "") {
  const nextType = ["class", "year_group", "pupil"].includes(String(scopeType || "")) ? String(scopeType) : "overview";
  state.analyticsAssistant.scopeType = nextType;
  state.analyticsAssistant.scopeId = nextType === "overview" ? "" : syncAnalyticsScopeId(nextType, preferredId);
}

function openVisualSummaryForScope(scopeType = state.analyticsAssistant.scopeType, preferredId = state.analyticsAssistant.scopeId) {
  const nextType = ["class", "year_group", "pupil"].includes(String(scopeType || "")) ? String(scopeType) : "overview";
  const nextId = nextType === "overview" ? "" : syncAnalyticsScopeId(nextType, preferredId);
  state.visualAnalytics.activeGroup = nextType;
  state.visualAnalytics.selectedScopeType = nextType;
  state.visualAnalytics.selectedScopeId = nextId;
  state.visualAnalytics.summaryOpen = true;
  state.visualAnalytics.pupilSearch = "";
  primeVisualSummaryAssignmentSelection(nextType, nextId);
}

function getAnalyticsScopeLabel(scopeType = state.analyticsAssistant.scopeType, scopeId = state.analyticsAssistant.scopeId) {
  if (scopeType === "class") {
    const cls = (state.classes || []).find((item) => String(item.id) === String(scopeId || ""));
    return cls?.name || "Selected class";
  }
  if (scopeType === "year_group") {
    return String(scopeId || "Selected year group");
  }
  if (scopeType === "pupil") {
    const pupil = (state.visualAnalytics.catalog?.pupils || []).find((item) => String(item.scopeId) === String(scopeId || ""));
    return pupil?.label || "Selected pupil";
  }
  return "All classes";
}

function getAnalyticsSuggestionPrompts(scopeType = state.analyticsAssistant.scopeType, scopeLabel = getAnalyticsScopeLabel(scopeType)) {
  if (scopeType === "class") {
    return [
      `Who in ${scopeLabel} needs intervention most, and why?`,
      `Which graphemes are least secure in ${scopeLabel}?`,
      `What should I teach next in ${scopeLabel}?`,
    ];
  }
  if (scopeType === "year_group") {
    return [
      `Which classes in ${scopeLabel} need the most support, and why?`,
      `Which graphemes are least secure across ${scopeLabel}?`,
      `Is anyone in ${scopeLabel} showing patterns that suggest review or screening may be sensible?`,
    ];
  }
  if (scopeType === "pupil") {
    return [
      `What does ${scopeLabel} need to practise next?`,
      `Which graphemes are least secure for ${scopeLabel}?`,
      `Is ${scopeLabel} improving or do they need closer review?`,
    ];
  }
  return [
    "Who currently needs intervention most, and why?",
    "Which graphemes are least secure across my classes?",
    "Is anyone showing patterns that suggest review or screening may be sensible?",
  ];
}

function renderAnalyticsFocusField({
  scopeType = state.analyticsAssistant.scopeType,
  scopeId = state.analyticsAssistant.scopeId,
  fieldName,
  displayLabel = getAnalyticsFocusLabel(scopeType),
  fieldClassName = "td-field td-field--compact",
}) {
  const focusOptions = getAnalyticsFocusOptions(scopeType);
  const selectedValue = scopeType === "overview" ? "" : String(scopeId || "");
  const hasOptions = scopeType === "overview" || focusOptions.length > 0;

  return `
    <label class="${escapeAttr(fieldClassName)}">
      <span>${escapeHtml(displayLabel)}</span>
      <select class="td-input" data-field="${escapeAttr(fieldName)}" ${hasOptions ? "" : "disabled"}>
        ${
          hasOptions
            ? focusOptions.map((item) => `
              <option value="${escapeAttr(item.value)}" ${String(item.value) === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>
            `).join("")
            : `<option value="">${escapeHtml(getAnalyticsFocusEmptyLabel(scopeType))}</option>`
        }
      </select>
    </label>
  `;
}

function renderAnalyticsGraphemeField({
  fieldName = "summary-grapheme",
  displayLabel = "Grapheme",
  fieldClassName = "td-field td-field--compact",
}) {
  const viewModel = getVisualAnalyticsViewModel();
  const options = viewModel.graphemeOptions || [];
  const selectedValue = viewModel.selectedGrapheme || "";

  return `
    <label class="${escapeAttr(fieldClassName)}">
      <span>${escapeHtml(displayLabel)}</span>
      <select class="td-input" data-field="${escapeAttr(fieldName)}" ${options.length ? "" : "disabled"}>
        <option value="">All graphemes</option>
        ${options.map((item) => `
          <option value="${escapeAttr(item.value)}" ${item.value === selectedValue ? "selected" : ""}>
            ${escapeHtml(`${item.label} (${item.count})`)}
          </option>
        `).join("")}
      </select>
    </label>
  `;
}

function applyAnalyticsFocusSelection(value) {
  const nextValue = String(value || "");
  if (state.analyticsAssistant.scopeType === "overview") {
    updateAnalyticsScope("overview");
    return;
  }
  if (state.analyticsAssistant.scopeType === "class" && nextValue === ALL_CLASSES_SCOPE_VALUE) {
    updateAnalyticsScope("overview");
    return;
  }
  state.analyticsAssistant.scopeId = nextValue;
}

function getVisualCompareSelectionIndex(compareId) {
  return (state.visualAnalytics.compareSelections || []).findIndex((item) => String(item?.id || "") === String(compareId || ""));
}

function updateVisualCompareSelection(compareId, updater) {
  const index = getVisualCompareSelectionIndex(compareId);
  if (index < 0) return false;

  const nextSelections = [...(state.visualAnalytics.compareSelections || [])];
  const current = nextSelections[index];
  nextSelections[index] = typeof updater === "function" ? updater(current) : current;
  state.visualAnalytics.compareSelections = sanitizeVisualCompareSelections(nextSelections, state.visualAnalytics.sourceData);
  return true;
}

function getVisualComparisonSummaries() {
  const viewModel = getVisualAnalyticsViewModel();
  const data = viewModel.sourceData;
  if (!data) return [];
  const graphemeFilter = viewModel.selectedGrapheme || "";

  return (state.visualAnalytics.compareSelections || [])
    .map((selection) => ({
      selection,
      summary: buildVisualComparisonSummary(selection, data, graphemeFilter),
    }))
    .filter((item) => item.summary);
}

async function handleTeacherAnalyticsForm(form) {
  const fd = new FormData(form);
  const question = String(fd.get("question") || "").trim();
  state.analyticsAssistant.questionDraft = question;
  await submitTeacherAnalyticsQuestion(question);
}

async function submitTeacherAnalyticsQuestion(question) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion || state.analyticsAssistant.loading) return;

  const scopeType = state.analyticsAssistant.scopeType || "overview";
  const scopeId = syncAnalyticsScopeId(scopeType, state.analyticsAssistant.scopeId);
  const scopeLabel = getAnalyticsScopeLabel(scopeType, scopeId);
  const history = getAnalyticsAssistantConversationMessages(state.analyticsAssistant.messages)
    .map((item) => ({ role: item.role, text: item.text }));

  if (scopeType !== "overview" && !scopeId) {
    showNotice("Choose a class, year group, or pupil before asking the assistant.", "error");
    paint();
    return;
  }

  state.analyticsAssistant.scopeId = scopeId;
  const nextMessages = [
    ...state.analyticsAssistant.messages,
    { role: "user", text: cleanQuestion, scopeLabel },
  ];
  state.analyticsAssistant.messages = nextMessages;
  state.analyticsAssistant.loading = true;
  state.analyticsAssistant.questionDraft = cleanQuestion;
  paint();

  const teacherId = String(state.user?.id || "");
  let threadId = String(state.analyticsAssistant.activeThreadId || "");

  if (teacherId && state.analyticsAssistant.historyAvailable !== false) {
    try {
      const messageTimestamp = new Date().toISOString();

      if (!threadId) {
        const createdThread = await createAnalyticsAssistantThread({
          teacherId,
          question: cleanQuestion,
          scopeType,
          scopeId,
        });
        threadId = String(createdThread?.id || "");
        if (threadId) {
          state.analyticsAssistant.activeThreadId = threadId;
        }
      } else {
        await updateAnalyticsAssistantThread(threadId, {
          scopeType,
          scopeId,
          lastMessageAt: messageTimestamp,
        });
      }

      if (threadId) {
        await saveAnalyticsAssistantMessage({
          threadId,
          teacherId,
          role: "user",
          text: cleanQuestion,
          scopeLabel,
        });
      }

      paint();
    } catch (error) {
      console.error("analytics assistant history save error:", error);
    }
  }

  try {
    const response = await teacherAnalyticsChat({
      question: cleanQuestion,
      scopeType,
      scopeId: scopeType === "overview" ? null : scopeId,
      scopeLabel,
      history,
    });
    const latestOutcomes = Number(response?.context?.counts?.latestWordOutcomes || 0);
    const isSampleData = Boolean(response?.context?.mockMode);
    const metaParts = [];
    if (isSampleData) metaParts.push("Using sample analytics data");
    if (latestOutcomes) metaParts.push(`${latestOutcomes} latest checked word outcomes analysed`);
    const assistantMessage = {
      role: "assistant",
      text: String(response?.answer || "").trim() || "I couldn't find enough evidence to answer that yet.",
      scopeLabel,
      meta: metaParts.join(" | "),
    };

    state.analyticsAssistant.messages = [
      ...nextMessages,
      assistantMessage,
    ];
    state.analyticsAssistant.questionDraft = "";

    if (teacherId && threadId && state.analyticsAssistant.historyAvailable !== false) {
      try {
        const replyTimestamp = new Date().toISOString();
        await saveAnalyticsAssistantMessage({
          threadId,
          teacherId,
          role: "assistant",
          text: assistantMessage.text,
          scopeLabel,
          meta: assistantMessage.meta,
        });
        await updateAnalyticsAssistantThread(threadId, {
          scopeType,
          scopeId,
          lastMessageAt: replyTimestamp,
        });
      } catch (error) {
        console.error("analytics assistant reply persistence error:", error);
      }
    }
  } catch (error) {
    console.error("teacher analytics chat error:", error);
    const assistantMessage = {
      role: "assistant",
      text: "I couldn't answer that just now. Please try again in a moment.",
      scopeLabel,
    };

    state.analyticsAssistant.messages = [
      ...nextMessages,
      assistantMessage,
    ];

    if (teacherId && threadId && state.analyticsAssistant.historyAvailable !== false) {
      try {
        const replyTimestamp = new Date().toISOString();
        await saveAnalyticsAssistantMessage({
          threadId,
          teacherId,
          role: "assistant",
          text: assistantMessage.text,
          scopeLabel,
        });
        await updateAnalyticsAssistantThread(threadId, {
          scopeType,
          scopeId,
          lastMessageAt: replyTimestamp,
        });
      } catch (persistError) {
        console.error("analytics assistant error persistence error:", persistError);
      }
    }

    showNotice(error?.message || "Could not load analytics chat.", "error");
  } finally {
    state.analyticsAssistant.loading = false;
    paint();
  }
}

function clearFlashLater(kind) {
  window.setTimeout(() => {
    if (kind === "test") state.flashTestId = null;
    if (kind === "class") state.flashClassId = null;
    if (rootEl?.isConnected) paint();
  }, 2200);
}

function buildTestBuilderUrl(testId) {
  const url = new URL("./test-builder.html", window.location.href);
  url.searchParams.set("id", String(testId));
  return url.toString();
}

function buildPresenterUrl(testId) {
  const url = new URL("./present.html", window.location.href);
  url.searchParams.set("id", String(testId));
  return url.toString();
}

function isMissingAnalyticsTargetColumnError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  const mentionsAnalyticsTargetColumn =
    message.includes("analytics_target_words_enabled") ||
    message.includes("analytics_target_words_per_pupil");

  if (!mentionsAnalyticsTargetColumn) return false;
  return code === "PGRST204" || code === "42703" || message.includes("schema cache") || message.includes("column");
}

function isMissingAutomationMetadataColumnError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  const mentionsAutomationColumn =
    message.includes("automation_kind")
    || message.includes("automation_source")
    || message.includes("automation_run_id")
    || message.includes("automation_triggered_by");
  if (!mentionsAutomationColumn) return false;
  return code === "PGRST204" || code === "42703" || message.includes("schema cache") || message.includes("column");
}

function stripAnalyticsTargetColumns(payload) {
  const {
    analytics_target_words_enabled,
    analytics_target_words_per_pupil,
    ...rest
  } = payload || {};
  return rest;
}

async function insertSingleRowWithAnalyticsFallback(table, payload, selectColumns = "*") {
  let result = await supabase
    .from(table)
    .insert(payload)
    .select(selectColumns)
    .single();

  if (result.error && isMissingAnalyticsTargetColumnError(result.error)) {
    result = await supabase
      .from(table)
      .insert(stripAnalyticsTargetColumns(payload))
      .select(selectColumns)
      .single();
  }

  return result;
}

function sortAssignmentsForAttention(assignments) {
  return [...(assignments || [])].sort((a, b) => {
    const aRank = getAssignmentSortRank(a);
    const bRank = getAssignmentSortRank(b);

    if (aRank !== bRank) return aRank - bRank;

    const aTime = getDeadlineTime(a);
    const bTime = getDeadlineTime(b);

    if (aTime !== bTime) return aTime - bTime;

    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}

function getDeadlineTime(item) {
  if (!item?.deadline) return Number.POSITIVE_INFINITY;
  const time = new Date(item.deadline).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function getAssignmentSortRank(item) {
  if (!item?.deadline) return 3;

  const now = new Date();
  const deadline = new Date(item.deadline);

  if (Number.isNaN(deadline.getTime())) return 3;
  if (deadline.getTime() < now.getTime()) return 0;

  const sameDay =
    deadline.getFullYear() === now.getFullYear() &&
    deadline.getMonth() === now.getMonth() &&
    deadline.getDate() === now.getDate();

  if (sameDay) return 1;
  return 2;
}

function getAssignmentStatus(item) {
  if (!item?.deadline) return "No deadline";

  const now = new Date();
  const deadline = new Date(item.deadline);

  if (Number.isNaN(deadline.getTime())) return "No deadline";
  if (deadline < now) return "Overdue";

  const sameDay =
    deadline.getFullYear() === now.getFullYear() &&
    deadline.getMonth() === now.getMonth() &&
    deadline.getDate() === now.getDate();

  if (sameDay) return "Due today";

  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 2) return "Due soon";
  return "Upcoming";
}

function paint() {
  rootEl.innerHTML = `
    <section class="td-shell">
      <div class="td-topbar">
        <div>
          <h2 class="td-page-title">${escapeHtml(getDashboardTitle())}</h2>
          <p class="td-muted">Signed in as ${escapeHtml(state.user?.email || "")}</p>
        </div>
      </div>

      ${renderNotice()}
      ${renderCreateBar()}
      ${renderSectionStaffAccess()}
      ${renderAnalyticsBar()}
      ${renderSectionUpcomingAssignments()}
      ${renderSectionClasses()}
      ${renderSectionTests()}
      ${renderFloatingAIButton()}
    </section>
  `;

  syncAnalyticsThreadPosition();
  syncAnalyticsComposerHeight();
  syncTableScrollShells();
  syncTargetPopoverLayouts();
}

function syncAnalyticsThreadPosition() {
  if (!state.analyticsAssistant.open) return;
  requestAnimationFrame(() => {
    const thread = rootEl?.querySelector('[data-role="analytics-thread"]');
    if (!(thread instanceof HTMLElement)) return;
    thread.scrollTop = thread.scrollHeight;
  });
}

function syncAnalyticsComposerHeight(element = rootEl?.querySelector('[data-field="analytics-question"]')) {
  if (!(element instanceof HTMLTextAreaElement)) return;

  const maxHeight = 160;
  element.style.height = "0px";
  const nextHeight = Math.max(element.scrollHeight, 24);
  element.style.height = `${Math.min(nextHeight, maxHeight)}px`;
  element.style.overflowY = nextHeight > maxHeight ? "auto" : "hidden";
}

function syncTableScrollShells() {
  requestAnimationFrame(() => {
    rootEl?.querySelectorAll("[data-scroll-shell]").forEach((shell) => {
      if (!(shell instanceof HTMLElement)) return;

      const track = shell.querySelector("[data-scroll-shell-track]");
      const trackSize = shell.querySelector("[data-scroll-shell-track-size]");
      const viewport = shell.querySelector("[data-scroll-shell-viewport]");
      if (!(track instanceof HTMLElement) || !(trackSize instanceof HTMLElement) || !(viewport instanceof HTMLElement)) {
        return;
      }

      if (shell.dataset.scrollShellBound !== "true") {
        let syncingFromTrack = false;
        let syncingFromViewport = false;

        track.addEventListener("scroll", () => {
          if (syncingFromViewport) return;
          syncingFromTrack = true;
          viewport.scrollLeft = track.scrollLeft;
          requestAnimationFrame(() => {
            syncingFromTrack = false;
          });
        }, { passive: true });

        viewport.addEventListener("scroll", () => {
          if (syncingFromTrack) return;
          syncingFromViewport = true;
          track.scrollLeft = viewport.scrollLeft;
          requestAnimationFrame(() => {
            syncingFromViewport = false;
          });
        }, { passive: true });

        shell.dataset.scrollShellBound = "true";
      }

      const widthSource = Math.max(
        viewport.scrollWidth,
        viewport.firstElementChild instanceof HTMLElement ? viewport.firstElementChild.scrollWidth : 0,
        viewport.clientWidth,
      );
      trackSize.style.width = `${widthSource}px`;
      track.scrollLeft = viewport.scrollLeft;
      shell.classList.toggle("is-scrollable", widthSource > viewport.clientWidth + 1);
    });
  });
}

function renderNotice() {
  if (!state.notice) return "";

  return `
    <div class="td-notice td-notice--${state.noticeType}">
      <span>${escapeHtml(state.notice)}</span>
      <button class="td-notice-close" data-action="dismiss-notice" type="button" aria-label="Dismiss message">×</button>
    </div>
  `;
}

function renderCreateBar() {
  const demoLoaded = hasDemoData();
  const demoBusy = state.demoData.loading;
  const demoBusyAction = state.demoData.action;
  const demoSeedLabel = demoBusy && demoBusyAction === "seed"
    ? (demoLoaded ? "Refreshing demo data..." : "Loading demo data...")
    : (demoLoaded ? "Refresh demo data" : "Load demo data");
  const showClearDemoButton = demoLoaded || (demoBusy && demoBusyAction === "clear");
  const demoClearLabel = demoBusy && demoBusyAction === "clear" ? "Removing demo data..." : "Clear demo data";
  const showCreateTest = canCreateTests();
  const showBaselineAction = canManageOwnContent() && canAssignTests();
  const showRunNowAutomation = canManageAutomation();
  const showCreateInterventionGroup = canManageInterventionGroups();
  const showDemoDataControls = canManageAutomation();
  const hasVisibleCreateControls =
    showCreateTest
    || showBaselineAction
    || showRunNowAutomation
    || showCreateInterventionGroup
    || showDemoDataControls;
  if (!hasVisibleCreateControls) return "";
  const automationPolicies = getAutomationPolicies();
  const automationPoliciesCurrentOrScheduled = automationPolicies.filter((policy) => {
    const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy);
    return !lifecycle.archived && !lifecycle.expired;
  });
  const automationPoliciesExpired = automationPolicies.filter((policy) => getPersonalisedAutomationPolicyLifecycle(policy).expired);
  const automationPoliciesArchived = automationPolicies.filter((policy) => !!String(policy?.archived_at || "").trim());
  const selectedAutomationPolicyKey = getAutomationSelectedPolicyKey();
  const hasAutomationSelection = !!selectedAutomationPolicyKey;
  const automationRunPolicy = hasAutomationSelection
    ? getAutomationRunPolicy()
    : buildDefaultPersonalisedAutomationPolicy();
  const savedAutomationPolicy = getSavedAutomationPolicy();
  const selectedAutomationClassIds = hasAutomationSelection ? getAutomationRunSelectedClassIds() : [];
  const automationPolicyValidation = hasAutomationSelection
    ? getAutomationRunPolicyValidation()
    : { policy: automationRunPolicy, errors: [] };
  const automationRunReadyState = hasAutomationSelection
    ? getSavedAutomationRunReadyState()
    : { ready: false, actionLabel: "Run now", message: "Create or select a policy first." };
  const automationEligibleClasses = getAutomationEligibleClasses();
  const automationTargetFilters = hasAutomationSelection
    ? getAutomationTargetFilters()
    : createDefaultAutomationTargetFilters();
  const filteredAutomationEligibleClasses = hasAutomationSelection
    ? getFilteredAutomationEligibleClasses()
    : [];
  const automationIsNewDraft = selectedAutomationPolicyKey === AUTOMATION_NEW_POLICY_KEY;
  const automationLifecycle = getPersonalisedAutomationPolicyLifecycle(automationRunPolicy, {
    warningDays: PERSONALISED_AUTOMATION_EXPIRY_WARNING_DAYS,
  });
  const automationIsArchived = automationLifecycle.archived;
  const automationDraftDirty = hasAutomationSelection ? getAutomationPolicyDirty() : false;
  const automationActionMode = hasAutomationSelection ? getSelectedAutomationActionMode() : "idle";
  const automationActionBusy = hasAutomationSelection ? isAutomationActionBusyMode(automationActionMode) : false;
  const automationRunActive = hasAutomationSelection ? isSelectedAutomationPolicyRunActive() : false;
  const automationBusyStatusMessage = hasAutomationSelection ? getSelectedAutomationActionStatusMessage() : "";
  const automationEditorLocked = automationActionBusy;
  const automationStructuralControlsDisabled = automationActionBusy;
  const selectedAutomationPolicyId = String(
    savedAutomationPolicy?.id
      || (!automationIsNewDraft ? automationRunPolicy?.id : "")
      || ""
  ).trim();
  const selectedAutomationPolicyName = getAutomationPolicyDisplayName(
    automationRunPolicy,
    automationIsNewDraft ? "New policy draft" : "Selected policy"
  );
  const automationStatusBadge = getAutomationPolicyStatusBadgeMeta(automationRunPolicy, {
    isDraft: automationIsNewDraft && !savedAutomationPolicy,
  });
  const automationYearGroupOptions = [...new Set(
    automationEligibleClasses
      .map((item) => String(item?.year_group || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
  const automationMetaSummary = getAutomationPolicyCompactMetaLine(automationRunPolicy, {
    savedAt: savedAutomationPolicy?.updated_at || "",
    isDraft: automationIsNewDraft && !savedAutomationPolicy,
  });
  const automationCadenceLabel = PERSONALISED_AUTOMATION_FREQUENCY_OPTIONS.find(
    (option) => option.value === automationRunPolicy.frequency
  )?.label || "Weekly";
  const automationReleasePatternLabel = automationRunPolicy.frequency === "fortnightly"
    ? `Week 1: ${formatPersonalisedAutomationWeekdayList(automationRunPolicy.selected_weekdays_week_1)} | Week 2: ${automationRunPolicy.selected_weekdays_week_2.length ? formatPersonalisedAutomationWeekdayList(automationRunPolicy.selected_weekdays_week_2) : "Not selected"}`
    : formatPersonalisedAutomationWeekdayList(automationRunPolicy.selected_weekdays);
  const automationScheduleWindowLabel = automationRunPolicy.end_date
    ? `${formatShortDate(automationRunPolicy.start_date)}-${formatShortDate(automationRunPolicy.end_date)}`
    : `From ${formatShortDate(automationRunPolicy.start_date)}`;
  const automationAlertEntries = buildAutomationPolicyAlertEntries();
  const automationCanDiscardChanges = automationDraftDirty;
  const automationShowDiscardChanges = automationCanDiscardChanges;
  const automationSaveDisabled = !automationDraftDirty || automationActionBusy;
  const automationSaveLabel = automationActionMode === "saving" ? "Saving..." : "Save";
  const automationShowRunNowButton = automationActionMode === "running"
    || (!automationDraftDirty && automationActionMode !== "saving_and_running");
  const automationPrimaryRunLabel = automationActionMode === "saving_and_running"
    ? "Saving and running..."
    : (automationActionMode === "running"
      ? "Running..."
      : (automationShowRunNowButton ? "Run now" : "Save and run now"));
  const automationPrimaryRunDisabled = automationActionBusy
    || (automationShowRunNowButton ? !automationRunReadyState.ready : (!automationDraftDirty || !automationRunReadyState.ready));
  const automationShowRunReadyMessage = !automationRunReadyState.ready
    && !!String(automationRunReadyState.message || "").trim();
  const automationAlertsHtml = automationAlertEntries.length
    ? `
      <div class="td-automation-alerts">
        ${automationAlertEntries.map((entry) => `
          <div class="td-automation-alert ${entry.lifecycle.expired ? "is-expired" : "is-warning"}">
            <div class="td-automation-alert-copy">
              <strong>${escapeHtml(entry.title)}</strong>
              <p>${escapeHtml(entry.message)}</p>
            </div>
            <div class="td-automation-alert-actions">
              <button class="td-btn td-btn--ghost td-btn--small" type="button" data-action="extend-automation-policy" data-policy-id="${escapeAttr(entry.policyId)}" ${automationStructuralControlsDisabled ? "disabled" : ""}>Extend dates</button>
            </div>
          </div>
        `).join("")}
      </div>
    `
    : "";
  const automationSummaryMetrics = [
    {
      label: "Word count",
      value: `${automationRunPolicy.assignment_length} words`,
    },
    {
      label: "Support preset",
      value: getAutoAssignSupportPresetLabel(automationRunPolicy.support_preset),
    },
    {
      label: "Frequency",
      value: automationCadenceLabel,
    },
    {
      label: "Release days",
      value: automationReleasePatternLabel,
    },
    {
      label: "Dates",
      value: automationScheduleWindowLabel,
    },
    {
      label: "Groups",
      value: `${selectedAutomationClassIds.length} selected`,
    },
  ];
  const buildAutomationWeekdayCheckboxGridHtml = ({ title, weekKey, selectedWeekdays }) => `
    <div class="td-automation-weekday-row">
      <div class="td-automation-weekday-row-title">${escapeHtml(title)}</div>
      <div class="td-automation-weekdays-grid">
        ${PERSONALISED_AUTOMATION_WEEKDAY_OPTIONS
          .map((option) => `
            <label class="td-checkbox-row td-checkbox-row--weekday">
              <input
                type="checkbox"
                value="${escapeAttr(option.value)}"
                data-field="automation-policy-weekday-toggle"
                data-weekday-week="${escapeAttr(weekKey)}"
                ${selectedWeekdays.includes(option.value) ? "checked" : ""}
              />
              <span>${escapeHtml(option.label)}</span>
            </label>
          `)
          .join("")}
      </div>
    </div>
  `;
  const automationWeekdayOptionsHtml = automationRunPolicy.frequency === "fortnightly"
    ? `
      ${buildAutomationWeekdayCheckboxGridHtml({
        title: "Week 1",
        weekKey: "1",
        selectedWeekdays: automationRunPolicy.selected_weekdays_week_1,
      })}
      ${buildAutomationWeekdayCheckboxGridHtml({
        title: "Week 2",
        weekKey: "2",
        selectedWeekdays: automationRunPolicy.selected_weekdays_week_2,
      })}
    `
    : buildAutomationWeekdayCheckboxGridHtml({
      title: "Every week",
      weekKey: "weekly",
      selectedWeekdays: automationRunPolicy.selected_weekdays,
    });
  const automationYearGroupOptionsHtml = automationYearGroupOptions
    .map((item) => `<option value="${escapeAttr(item)}" ${automationTargetFilters.yearGroup === item ? "selected" : ""}>${escapeHtml(item)}</option>`)
    .join("");
  const automationSelectedGroupSummary = joinAutomationSummaryParts([
    `${selectedAutomationClassIds.length} selected`,
    `${filteredAutomationEligibleClasses.length} shown`,
  ]);
  const automationBottomPrimarySummary = joinAutomationSummaryParts([
    `${automationPolicyValidation.policy.assignment_length} words`,
    getAutoAssignSupportPresetLabel(automationPolicyValidation.policy.support_preset),
    PERSONALISED_AUTOMATION_FREQUENCY_OPTIONS.find(
      (option) => option.value === automationPolicyValidation.policy.frequency
    )?.label || "Weekly",
    `${automationPolicyValidation.policy.target_class_ids.length} group${automationPolicyValidation.policy.target_class_ids.length === 1 ? "" : "s"}`,
  ]);
  const automationBottomSecondarySummary = joinAutomationSummaryParts([
    getAutomationPolicyCompactDateRange(automationPolicyValidation.policy),
    getAutomationPolicyCompactStateLabel(automationPolicyValidation.policy, {
      isDraft: automationIsNewDraft && !savedAutomationPolicy,
    }),
  ]);
  const automationTargetClassOptionsHtml = filteredAutomationEligibleClasses.length
    ? filteredAutomationEligibleClasses
      .map((cls) => {
        const classId = String(cls?.id || "");
        const checked = selectedAutomationClassIds.includes(classId);
        return `
          <label class="td-automation-class-option ${checked ? "is-selected" : ""}">
            <input
              type="checkbox"
              value="${escapeAttr(classId)}"
              data-field="automation-run-class"
              ${checked ? "checked" : ""}
            />
            <span>
              <strong>${escapeHtml(cls?.name || "Untitled class")}</strong>
              <small>${escapeHtml(getClassTypeDisplayLabel(cls?.class_type))}</small>
              ${cls?.year_group ? `<small>${escapeHtml(cls.year_group)}</small>` : ""}
            </span>
          </label>
        `;
      })
      .join("")
    : `<div class="td-empty td-empty--compact"><strong>No eligible groups match the current filters.</strong></div>`;
  const automationPresetGuideHtml = AUTO_ASSIGN_SUPPORT_PRESET_OPTIONS
    .map((option) => `
      <label class="td-automation-preset-guide-item ${automationRunPolicy.support_preset === option.value ? "is-current" : ""}">
        <input
          type="radio"
          name="automation_support_preset"
          value="${escapeAttr(option.value)}"
          data-field="automation-run-support-preset"
          ${automationRunPolicy.support_preset === option.value ? "checked" : ""}
        />
        <span>
        <strong>${escapeHtml(option.label)}</strong>
          <small>${escapeHtml(getAutomationSupportPresetShortDescription(option.value))}</small>
        </span>
      </label>
    `)
    .join("");
  const buildAutomationPolicyOptionHtml = (policy) => {
    const policyId = String(policy?.id || "").trim();
    const isSelected = selectedAutomationPolicyKey === policyId;
    const hasDirtyDraft = !!state.automationDraftsByKey?.[policyId]?.dirty;
    const statusLabel = getAutomationPolicyStatusBadgeMeta(policy).label;
    return `<option value="${escapeAttr(policyId)}" ${isSelected ? "selected" : ""}>${escapeHtml(`${getAutomationPolicyDisplayName(policy)} · ${statusLabel}${hasDirtyDraft ? " · Unsaved draft" : ""}`)}</option>`;
  };
  const automationPolicySelectorOptionsHtml = [
    automationIsNewDraft
      ? `<option value="${escapeAttr(AUTOMATION_NEW_POLICY_KEY)}" selected>New policy draft</option>`
      : "",
    automationPoliciesCurrentOrScheduled.length
      ? `<optgroup label="Current and scheduled policies">
          ${automationPoliciesCurrentOrScheduled.map(buildAutomationPolicyOptionHtml).join("")}
        </optgroup>`
      : "",
    automationPoliciesExpired.length
      ? `<optgroup label="Expired policies">
          ${automationPoliciesExpired.map(buildAutomationPolicyOptionHtml).join("")}
        </optgroup>`
      : "",
    automationPoliciesArchived.length
      ? `<optgroup label="Archived policies">
          ${automationPoliciesArchived.map(buildAutomationPolicyOptionHtml).join("")}
        </optgroup>`
      : "",
  ].filter(Boolean).join("");
  const interventionVisiblePupils = getInterventionBuilderVisiblePupils();
  const interventionSelectedPupilIds = getInterventionBuilderSelectedPupilIds();
  const interventionYearGroupOptions = getInterventionBuilderYearGroupOptions();
  const interventionYearGroup = String(state.interventionGroup?.filters?.yearGroup || "").trim();
  const interventionSourceClasses = getInterventionBuilderAvailableSourceClasses({ yearGroup: interventionYearGroup });
  const interventionSourceClassId = String(state.interventionGroup?.filters?.sourceClassId || "").trim();
  const ownedClasses = getOwnedClasses();

  return `
    <section class="td-action-bar">
      <div class="td-action-kicker">Create</div>

      <div class="td-action-row">
        ${showCreateTest ? `<button class="td-btn td-btn--primary" type="button" data-action="create-test">+ Create test</button>` : ""}
        ${showBaselineAction ? `
          <div class="td-action-button-shell">
            <button class="td-btn td-btn--ghost" type="button" data-action="toggle-create-baseline">Set Baseline Test</button>
            ${renderInfoTip(getBaselineActionTooltipText(), {
              label: "About Set Baseline Test",
              className: "td-action-info-tip",
              triggerClassName: "td-action-info-tip-trigger",
              bubbleClassName: "td-action-info-tip-bubble",
              align: "start",
            })}
          </div>
        ` : ""}
        ${showRunNowAutomation ? `
          <div class="td-action-button-shell">
            <button class="td-btn td-btn--ghost" type="button" data-action="toggle-create-auto-assign">Generate Personalised Test</button>
            ${renderInfoTip(getGeneratePersonalisedActionTooltipText(), {
              label: "About Generate Personalised Test",
              className: "td-action-info-tip",
              triggerClassName: "td-action-info-tip-trigger",
              bubbleClassName: "td-action-info-tip-bubble",
              align: "start",
            })}
          </div>
        ` : ""}
        ${showCreateInterventionGroup ? `<button class="td-btn td-btn--ghost" type="button" data-action="toggle-create-intervention-group">Create intervention group</button>` : ""}
      </div>

      ${showDemoDataControls ? `
        <div class="td-action-support">
          <div class="td-action-support-copy">
            <strong>Need sample data for a proper trial run?</strong>
            <span>Populate demo classes, pupils, tests, assignments, attempt history, and seeded PP, SEN, and gender group values. Demo pupils use PIN 1234 and usernames like demo_y7_maple_1.</span>
          </div>
          <div class="td-action-row td-action-row--support">
            <button class="td-btn td-btn--ghost" type="button" data-action="seed-demo-data" ${demoBusy ? "disabled" : ""}>${demoSeedLabel}</button>
            ${showClearDemoButton ? `<button class="td-btn td-btn--ghost" type="button" data-action="clear-demo-data" ${demoBusy ? "disabled" : ""}>${demoClearLabel}</button>` : ""}
          </div>
        </div>
      ` : ""}

      ${showCreateInterventionGroup ? `
        <div class="td-create-class-inline ${state.createInterventionGroupOpen ? "is-open" : ""}">
          <form data-form="create-intervention-group" class="td-form-stack td-form-stack--intervention">
            <div class="td-automation-run-head">
              <div class="td-action-inline-copy">
                Create a separate intervention group with filtered pupils. Choose a filter first, then apply it to load matching pupils.
              </div>
            </div>

            <label class="td-field td-field--intervention-name">
              <span>Group name</span>
              <input
                id="tdInterventionGroupNameInput"
                class="td-input"
                type="text"
                name="group_name"
                placeholder="Intervention group name"
                autocomplete="off"
                required
              />
            </label>

            <div class="td-intervention-filter-section">
              <div class="td-automation-class-picker-head td-automation-class-picker-head--intervention">
                <div>
                  <strong>Filter pupils</strong>
                  <div class="td-action-inline-copy">Choose at least one filter, then apply it to load matching pupils.</div>
                </div>
              </div>

              <div class="td-automation-run-grid td-automation-run-grid--intervention">
                <label class="td-field">
                  <span>Year group</span>
                  <select class="td-input" name="year_group" data-field="intervention-year-group">
                    <option value="">All year groups</option>
                    ${interventionYearGroupOptions
                      .map((item) => `<option value="${escapeAttr(item)}" ${interventionYearGroup === item ? "selected" : ""}>${escapeHtml(item)}</option>`)
                      .join("")}
                  </select>
                </label>

                <label class="td-field">
                  <span>Current group</span>
                  <select class="td-input" data-field="intervention-source-class">
                    <option value="">All current groups</option>
                    ${interventionSourceClasses
                      .map((cls) => `
                        <option value="${escapeAttr(cls.id)}" ${interventionSourceClassId === String(cls.id) ? "selected" : ""}>
                          ${escapeHtml(`${cls.name || "Untitled class"} (${getClassTypeDisplayLabel(cls.class_type)})`)}
                        </option>
                      `)
                      .join("")}
                  </select>
                </label>

                <label class="td-field td-field--intervention-search">
                  <span>Search pupils</span>
                  <input
                    class="td-input"
                    type="search"
                    data-field="intervention-pupil-search"
                    placeholder="Search by name, username, or current group"
                    value="${escapeAttr(String(state.interventionGroup?.filters?.search || ""))}"
                  />
                </label>
              </div>

              <div class="td-automation-run-actions td-automation-run-actions--intervention">
                <button
                  class="td-btn td-btn--ghost"
                  type="button"
                  data-action="apply-intervention-filters"
                  ${hasMeaningfulInterventionFilters() ? "" : "disabled"}
                >
                  Apply filters
                </button>
              </div>
            </div>

            <div class="td-automation-class-picker">
              <div class="td-automation-class-picker-head">
                <div>
                  <strong>Select pupils</strong>
                  <div class="td-action-inline-copy">${escapeHtml(getInterventionBuilderSelectedSummary())}</div>
                </div>
                <div class="td-automation-class-picker-actions">
                  <button class="td-btn td-btn--ghost td-btn--small" type="button" data-action="select-all-filtered-intervention-pupils" ${interventionVisiblePupils.length ? "" : "disabled"}>Select all</button>
                  <button class="td-btn td-btn--ghost td-btn--small" type="button" data-action="clear-intervention-pupil-selection" ${interventionSelectedPupilIds.length ? "" : "disabled"}>Clear</button>
                </div>
              </div>

              ${interventionSelectedPupilIds.length ? `
                <div class="td-intervention-selected-pupils">
                  ${getInterventionBuilderSelectedPupils()
                    .map((item) => `
                      <button
                        class="td-selection-chip"
                        type="button"
                        data-action="remove-intervention-pupil"
                        data-pupil-id="${escapeAttr(item.id)}"
                      >
                        <span>${escapeHtml(item.display_name || item.username || "Unknown pupil")}</span>
                        <span aria-hidden="true">×</span>
                      </button>
                    `)
                    .join("")}
                </div>
              ` : ""}

              ${
                state.interventionGroup.status === "loading"
                  ? `<div class="td-empty td-empty--compact"><strong>Loading pupils...</strong></div>`
                  : state.interventionGroup.status === "error"
                    ? `<div class="td-empty td-empty--compact"><strong>Could not load pupils.</strong><p>${escapeHtml(state.interventionGroup.message || "Please try again.")}</p></div>`
                    : state.interventionGroup.status === "idle"
                      ? `<div class="td-empty td-empty--compact"><strong>${escapeHtml(state.interventionGroup.message || "Choose a filter to find pupils.")}</strong></div>`
                    : `
                ${
                  interventionVisiblePupils.length
                    ? `<div class="td-intervention-pupil-grid">
                        ${interventionVisiblePupils.map((pupil) => {
                          const pupilId = String(pupil?.id || "").trim();
                          const pupilClasses = (Array.isArray(pupil?.classes) ? pupil.classes : [])
                            .filter((item) => getNormalizedClassType(item?.class_type, { legacyFallback: CLASS_TYPE_FORM }) !== CLASS_TYPE_INTERVENTION)
                            .map((item) => String(item?.class_name || "").trim())
                            .filter(Boolean);
                          return `
                            <label class="td-automation-class-option td-automation-class-option--pupil ${interventionSelectedPupilIds.includes(pupilId) ? "is-selected" : ""}">
                              <input
                                type="checkbox"
                                value="${escapeAttr(pupilId)}"
                                data-field="intervention-pupil-toggle"
                                ${interventionSelectedPupilIds.includes(pupilId) ? "checked" : ""}
                              />
                              <span>
                                <strong>${escapeHtml(pupil.display_name || pupil.username || "Unknown pupil")}</strong>
                                <small>${escapeHtml((Array.isArray(pupil?.year_groups) && pupil.year_groups.length) ? pupil.year_groups.join(", ") : "No year group")}</small>
                                ${pupilClasses.length ? `<small>${escapeHtml(pupilClasses.join(", "))}</small>` : ""}
                              </span>
                            </label>
                          `;
                        }).join("")}
                      </div>`
                    : `<div class="td-empty td-empty--compact"><strong>No pupils match the current filters.</strong></div>`
                }
              `}
            </div>

            <div class="td-form-actions">
              <button class="td-btn td-btn--primary" type="submit" ${state.interventionGroup.status === "loading" ? "disabled" : ""}>Create intervention group</button>
            </div>
          </form>
        </div>
      ` : ""}

      <div class="td-create-class-inline ${showBaselineAction && state.createBaselineOpen ? "is-open" : ""}">
        <form data-form="create-baseline-assignment" class="td-create-class-form td-create-class-form--auto-assign">
          <select
            id="tdBaselineClassInput"
            class="td-input"
            name="class_id"
            required
          >
            <option value="">Choose class...</option>
            ${ownedClasses
              .map((cls) => `<option value="${escapeAttr(cls.id)}">${escapeHtml(cls.name || "Untitled class")}</option>`)
              .join("")}
          </select>
          <input
            class="td-input"
            type="datetime-local"
            name="deadline"
            aria-label="Optional deadline"
          />
          <div class="td-action-inline-copy">Set the standard baseline test for this class. Each item keeps 1 scored attempt, with immediate post-scoring feedback if needed.</div>
          <button class="td-btn td-btn--ghost" type="submit">Set Baseline Test</button>
        </form>
      </div>

      ${showRunNowAutomation ? `
        <div class="td-create-class-inline ${state.createAutoAssignOpen ? "is-open" : ""}">
          <div class="td-create-class-form td-create-class-form--automation-run">
            <div class="td-form-stack td-form-stack--automation">
              <div class="td-automation-run-head">
                <div class="td-automation-panel-title-block">
                  <strong class="td-automation-panel-title">Automation policy</strong>
                  <div class="td-automation-panel-intro">Manage personalised test policies for form and intervention groups.</div>
                </div>
              </div>

              <div class="td-automation-manager">
                ${!automationPolicies.length && !automationIsNewDraft ? `
                  <div class="td-empty td-empty--compact td-empty--automation-policy">
                    <strong>No automation policies yet.</strong>
                    <p>Create a policy to choose schedule, groups, and test settings.</p>
                    <button class="td-btn td-btn--primary" type="button" data-action="new-automation-policy">New policy</button>
                  </div>
                ` : `
                  ${automationAlertsHtml}
                  <div class="td-automation-policy-topbar">
                    <div class="td-automation-policy-strip-head">
                      <div>
                        <strong>Current automation policy</strong>
                        <div class="td-automation-inline-copy-row">
                          <div class="td-action-inline-copy">Select a policy to edit or run.</div>
                          ${renderInfoTip("A group can only belong to one active policy in the same date window.", {
                            label: "About policy overlap",
                            className: "td-action-info-tip",
                            triggerClassName: "td-action-info-tip-trigger",
                            bubbleClassName: "td-action-info-tip-bubble",
                            align: "start",
                          })}
                        </div>
                      </div>
                    </div>

                    <div class="td-automation-policy-strip-controls">
                      <div class="td-automation-policy-switcher-group">
                        <label class="td-field td-automation-policy-select-shell">
                          <span>Policy</span>
                          <select class="td-input td-automation-policy-selector" data-field="automation-selected-policy" ${automationStructuralControlsDisabled ? "disabled" : ""}>
                            ${automationPolicySelectorOptionsHtml}
                          </select>
                        </label>
                        <button
                          class="td-btn td-btn--ghost td-btn--small"
                          type="button"
                          data-action="new-automation-policy"
                          ${automationStructuralControlsDisabled ? "disabled" : ""}
                        >
                          New policy
                        </button>
                      </div>
                      <div class="td-automation-policy-toolbar td-automation-policy-toolbar--structural">
                        <button
                          class="td-btn td-btn--ghost td-btn--small"
                          type="button"
                          data-action="duplicate-automation-policy"
                          data-policy-id="${escapeAttr(selectedAutomationPolicyId)}"
                          ${selectedAutomationPolicyId && !automationStructuralControlsDisabled ? "" : "disabled"}
                        >
                          Duplicate
                        </button>
                        <button
                          class="td-btn td-btn--ghost td-btn--small"
                          type="button"
                          data-action="${automationIsArchived ? "restore-automation-policy" : "archive-automation-policy"}"
                          data-policy-id="${escapeAttr(selectedAutomationPolicyId)}"
                          ${selectedAutomationPolicyId && !automationStructuralControlsDisabled ? "" : "disabled"}
                        >
                          ${automationIsArchived ? "Restore" : "Archive"}
                        </button>
                        <button
                          class="td-btn td-btn--ghost td-btn--small"
                          type="button"
                          data-action="delete-automation-policy"
                          data-policy-id="${escapeAttr(selectedAutomationPolicyId)}"
                          ${selectedAutomationPolicyId && !automationStructuralControlsDisabled ? "" : "disabled"}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div class="td-automation-selected-summary">
                      <div class="td-automation-selected-summary-head">
                        <div class="td-automation-selected-summary-main">
                          <strong>${escapeHtml(selectedAutomationPolicyName)}</strong>
                        </div>
                        <div class="td-automation-policy-status-badges">
                          <span class="td-automation-policy-status-badge ${automationStatusBadge.className}">${escapeHtml(automationStatusBadge.label)}</span>
                          ${automationDraftDirty
                            ? `<span class="td-automation-policy-status-badge is-dirty">Unsaved changes</span>`
                            : ""}
                        </div>
                      </div>

                      ${automationRunPolicy.description ? `<div class="td-action-inline-copy">${escapeHtml(automationRunPolicy.description)}</div>` : ""}

                      <div class="td-automation-summary-grid">
                        ${automationSummaryMetrics
                          .map((item) => `
                            <div class="td-automation-summary-item">
                              <span>${escapeHtml(item.label)}</span>
                              <strong>${escapeHtml(item.value)}</strong>
                            </div>
                          `)
                          .join("")}
                      </div>

                      <div class="td-automation-selected-summary-foot">
                        <div class="td-action-inline-copy">${escapeHtml(automationMetaSummary)}</div>
                        ${automationShowRunReadyMessage
                          ? `<div class="td-field-error">${escapeHtml(automationRunReadyState.message)}</div>`
                          : ""}
                      </div>
                    </div>
                  </div>

                  <div class="td-automation-editor-shell td-automation-editor-shell--full">
                    <form data-form="save-automation-policy" class="td-form-stack td-form-stack--automation-policy">
                      <fieldset class="td-automation-editor-fieldset" ${automationEditorLocked ? "disabled" : ""}>
                      <div class="td-automation-panel-section">
                        <div class="td-automation-panel-section-head">
                          <strong>Policy details</strong>
                        </div>
                        <div class="td-automation-run-grid td-automation-run-grid--policy-details">
                          <label class="td-field">
                            <span>Policy name</span>
                            <input
                              class="td-input"
                              type="text"
                              data-field="automation-policy-name"
                              value="${escapeAttr(String(automationRunPolicy.name || ""))}"
                              placeholder="e.g. Main automation policy"
                              autocomplete="off"
                            />
                          </label>
                          <label class="td-field td-field--automation-description">
                            <span>Short description</span>
                            <textarea
                              class="td-input td-input--textarea"
                              data-field="automation-policy-description"
                              rows="3"
                              placeholder="Optional note."
                            >${escapeHtml(String(automationRunPolicy.description || ""))}</textarea>
                          </label>
                        </div>
                      </div>

                      <div class="td-automation-panel-section">
                        <div class="td-automation-panel-section-head">
                          <strong>Schedule</strong>
                        </div>
                        <div class="td-automation-run-grid">
                          <label class="td-field">
                            <span>Frequency</span>
                            <select class="td-input" data-field="automation-policy-frequency">
                              ${PERSONALISED_AUTOMATION_FREQUENCY_OPTIONS
                                .map((option) => `<option value="${escapeAttr(option.value)}" ${automationRunPolicy.frequency === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
                                .join("")}
                            </select>
                          </label>
                          <label class="td-field">
                            <span>Start date</span>
                            <input
                              class="td-input"
                              type="date"
                              data-field="automation-policy-start-date"
                              value="${escapeAttr(String(automationRunPolicy.start_date || ""))}"
                            />
                          </label>
                          <label class="td-field">
                            <span>End date</span>
                            <input
                              class="td-input"
                              type="date"
                              data-field="automation-policy-end-date"
                              value="${escapeAttr(String(automationRunPolicy.end_date || ""))}"
                            />
                          </label>
                        </div>

                        <div class="td-automation-weekdays">
                          <span class="td-automation-weekdays-label">Release tests on</span>
                          <div class="td-automation-weekday-sets">
                            ${automationWeekdayOptionsHtml}
                          </div>
                        </div>
                      </div>

                      <div class="td-automation-panel-section">
                        <div class="td-automation-panel-section-head">
                          <strong>Target groups</strong>
                        </div>
                        <div class="td-automation-run-grid td-automation-run-grid--target-filters">
                          <label class="td-field">
                            <span>Year group</span>
                            <select class="td-input" data-field="automation-target-year-group">
                              <option value="">All year groups</option>
                              ${automationYearGroupOptionsHtml}
                            </select>
                          </label>
                          <label class="td-field">
                            <span>Group type</span>
                            <select class="td-input" data-field="automation-target-class-type">
                              <option value="all" ${automationTargetFilters.classType === "all" ? "selected" : ""}>All eligible groups</option>
                              <option value="${CLASS_TYPE_FORM}" ${automationTargetFilters.classType === CLASS_TYPE_FORM ? "selected" : ""}>Form only</option>
                              <option value="${CLASS_TYPE_INTERVENTION}" ${automationTargetFilters.classType === CLASS_TYPE_INTERVENTION ? "selected" : ""}>Intervention only</option>
                            </select>
                          </label>
                        </div>

                        <div class="td-automation-class-picker">
                          <div class="td-automation-class-picker-head">
                            <div>
                              <strong>Selected groups</strong>
                              <div class="td-action-inline-copy">${escapeHtml(automationSelectedGroupSummary)}</div>
                            </div>
                            <div class="td-automation-class-picker-actions">
                              <button class="td-btn td-btn--ghost td-btn--small" type="button" data-action="select-all-automation-classes">Select visible</button>
                              <button class="td-btn td-btn--ghost td-btn--small" type="button" data-action="clear-automation-classes" ${selectedAutomationClassIds.length ? "" : "disabled"}>Clear</button>
                            </div>
                          </div>
                          <div class="td-automation-class-grid">
                            ${automationTargetClassOptionsHtml}
                          </div>
                        </div>
                      </div>

                      <div class="td-automation-panel-section">
                        <div class="td-automation-panel-section-head">
                          <strong>Generation settings</strong>
                        </div>
                        <div class="td-automation-run-grid td-automation-run-grid--generation">
                          <label class="td-field">
                            <span>Word count</span>
                            <input
                              class="td-input"
                              type="number"
                              min="${AUTO_ASSIGN_POLICY_LENGTH_MIN}"
                              max="${AUTO_ASSIGN_POLICY_LENGTH_MAX}"
                              step="1"
                              data-field="automation-run-length"
                              value="${escapeAttr(String(automationRunPolicy.assignment_length))}"
                            />
                          </label>
                          <div class="td-field td-field--checkbox td-field--automation-checkbox" style="grid-column: span 2;">
                            <span class="td-automation-inline-label">
                              <span>Starter fallback</span>
                              ${renderInfoTip("Uses the starter catalog when pupil evidence is limited.", {
                                label: "About starter fallback",
                                className: "td-action-info-tip",
                                triggerClassName: "td-action-info-tip-trigger",
                                bubbleClassName: "td-action-info-tip-bubble",
                                align: "start",
                              })}
                            </span>
                            <label class="td-checkbox-row">
                              <input
                                type="checkbox"
                                data-field="automation-run-starter-fallback"
                                ${automationRunPolicy.allow_starter_fallback ? "checked" : ""}
                              />
                              <span>Use starter catalog</span>
                            </label>
                          </div>
                        </div>
                        <div class="td-automation-inline-label-row">
                          <strong>Support preset</strong>
                          ${renderInfoTip("Controls how much support generated tests use.", {
                            label: "About support preset",
                            className: "td-action-info-tip",
                            triggerClassName: "td-action-info-tip-trigger",
                            bubbleClassName: "td-action-info-tip-bubble",
                            align: "start",
                          })}
                        </div>
                        <div class="td-automation-preset-guide">
                          ${automationPresetGuideHtml}
                        </div>
                      </div>
                      </fieldset>

                      <div class="td-automation-panel-section">
                        <div class="td-automation-panel-section-head">
                          <strong>Editor actions</strong>
                        </div>
                        <div class="td-automation-policy-summary td-automation-policy-summary--draft">
                          <strong>${escapeHtml(getAutomationPolicyDisplayName(automationRunPolicy, automationIsNewDraft ? "New policy draft" : "Selected policy"))}</strong>
                          <div>${escapeHtml(automationBottomPrimarySummary)}</div>
                          ${automationBottomSecondarySummary ? `<div>${escapeHtml(automationBottomSecondarySummary)}</div>` : ""}
                          ${automationPolicyValidation.errors.length ? `<div class="td-field-error">${escapeHtml(automationPolicyValidation.errors[0])}</div>` : ""}
                        </div>

                        <div class="td-automation-policy-actions">
                          <div class="td-automation-policy-actions-group">
                            ${automationShowDiscardChanges ? `
                              <button
                                class="td-btn td-btn--ghost"
                                type="button"
                                data-action="discard-automation-policy-changes"
                                ${automationActionBusy ? "disabled" : ""}
                              >
                                Discard changes
                              </button>
                            ` : ""}
                            <button class="td-btn td-btn--ghost" type="submit" ${automationSaveDisabled ? "disabled" : ""}>${escapeHtml(automationSaveLabel)}</button>
                          </div>
                          <div class="td-automation-policy-actions-group td-automation-policy-actions-group--primary">
                            <div class="td-action-button-shell">
                              <button
                                class="td-btn td-btn--primary"
                                type="button"
                                data-action="${automationShowRunNowButton ? "run-now-automation-policy" : "save-and-run-automation-policy"}"
                                data-policy-id="${escapeAttr(selectedAutomationPolicyId)}"
                                ${automationPrimaryRunDisabled ? "disabled" : ""}
                              >
                                ${escapeHtml(automationPrimaryRunLabel)}
                              </button>
                              ${renderInfoTip("Run now creates a release from this policy and sets the next due date from today.", {
                                label: "About Run now",
                                className: "td-action-info-tip",
                                triggerClassName: "td-action-info-tip-trigger",
                                bubbleClassName: "td-action-info-tip-bubble",
                                align: "start",
                              })}
                            </div>
                          </div>
                        </div>
                        ${automationBusyStatusMessage
                          ? `<div class="td-automation-policy-action-status" aria-live="polite">${escapeHtml(automationBusyStatusMessage)}</div>`
                          : ""}
                      </div>
                    </form>
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>
      ` : ""}
    </section>
  `;
}

function renderAnalyticsBar() {
  const isOpen = state.sections.analytics;
  const scopeType = state.analyticsAssistant.scopeType || "overview";
  const scopeId = syncAnalyticsScopeId(scopeType, state.analyticsAssistant.scopeId);
  const summary = getSelectedVisualSummary();
  const status = state.visualAnalytics.status;
  const message = state.visualAnalytics.message || "Could not load analytics.";
  const showAttainmentGuide = !!state.visualAnalytics.attainmentGuideOpen;
  return `
    <section class="td-section td-section--analytics" data-role="analytics-bar">
      ${renderCollapsibleSectionHeader({
        title: "Analytics",
        section: "analytics",
        isOpen,
      })}

      ${
        isOpen
          ? `
        <div class="td-section-body">
          <div class="td-analytics-bar-card td-analytics-bar-card--toolbar">
            <div class="td-analytics-bar-row td-analytics-bar-row--toolbar">
              <label class="td-field td-field--compact td-field--toolbar">
                <span>View</span>
                <select class="td-input" data-field="summary-scope-type">
                  <option value="overview" ${scopeType === "overview" ? "selected" : ""}>All classes</option>
                  <option value="year_group" ${scopeType === "year_group" ? "selected" : ""}>Year group</option>
                  <option value="class" ${scopeType === "class" ? "selected" : ""}>Class</option>
                  <option value="pupil" ${scopeType === "pupil" ? "selected" : ""}>Pupil</option>
                </select>
              </label>

              ${
                scopeType === "overview"
                  ? ""
                  : renderAnalyticsFocusField({
                    scopeType,
                    scopeId,
                    fieldName: "summary-scope-id",
                    displayLabel: "Focus",
                    fieldClassName: "td-field td-field--compact td-field--toolbar",
                  })
              }
              ${renderAnalyticsGraphemeField({
                fieldName: "summary-grapheme",
                fieldClassName: "td-field td-field--compact td-field--toolbar",
              })}
            </div>
          </div>

          ${
            status === "loading"
              ? `
            <div class="td-empty td-empty--compact">
              <strong>Loading analytics...</strong>
            </div>
          `
              : status === "error"
                ? `
            <div class="td-empty td-empty--compact">
              <strong>Could not load analytics.</strong>
              <p>${escapeHtml(message)}</p>
            </div>
          `
              : summary
                  ? `
            <div class="td-analytics-bar-summary">
              ${showAttainmentGuide ? renderAttainmentGuidePage(summary) : renderVisualSummaryPanel(summary)}
            </div>
          `
                  : `
            <div class="td-empty td-empty--compact">
              <strong>No analytics yet.</strong>
            </div>
          `
          }

          ${showAttainmentGuide ? "" : renderGroupComparisonPanel()}
          ${showAttainmentGuide ? "" : renderInlineAnalyticsAssistant()}
        </div>
        </div>
      `
          : ""
      }
    </section>
  `;
}

function getGroupComparisonMetricConfig(value) {
  return GROUP_COMPARISON_METRICS.find((option) => option.value === value) || GROUP_COMPARISON_METRICS[0];
}

function formatGroupComparisonMetricValue(metric, value) {
  const config = getGroupComparisonMetricConfig(metric);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "No data yet";

  if (config?.format === "attempts") {
    return `${formatOneDecimal(numeric)} attempts`;
  }

  if (config?.format === "score") {
    return formatAverageIndicatorValue(numeric);
  }

  return formatPercent(numeric);
}

function formatGroupComparisonGap(metric, value) {
  const config = getGroupComparisonMetricConfig(metric);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "--";

  if (config?.format === "attempts") {
    return `${formatOneDecimal(numeric)} attempts`;
  }

  if (config?.format === "score") {
    return `${Math.round(numeric)} points`;
  }

  return `${formatOneDecimal(numeric * 100)} pp`;
}

function renderGroupComparisonMetricCell(metric, group) {
  if (group?.suppressed) {
    return "Insufficient group size";
  }

  const metricValue = group?.metrics?.[metric];
  if (metricValue == null) {
    return "No data yet";
  }

  return `
    <div class="td-group-comparison-metric-cell">
      <strong>${escapeHtml(formatGroupComparisonMetricValue(metric, metricValue))}</strong>
    </div>
  `;
}

function renderGroupComparisonEmptyState(title, copy) {
  return `
    <div class="td-empty td-empty--compact">
      <strong>${escapeHtml(title)}</strong>
      ${copy ? `<p>${escapeHtml(copy)}</p>` : ""}
    </div>
  `;
}

function getGroupComparisonScopeFocusLabel(scopeType) {
  if (scopeType === "year_group") return "Year group";
  if (scopeType === "class") return "Class";
  return "Focus";
}

function getGroupComparisonGapThreshold(metric) {
  if (metric === "attainment_indicator") return 2;
  return metric === "average_attempts_per_correct_word" ? 0.05 : 0.02;
}

function getGroupComparisonMetricRenderOrder(result = state.groupComparison.result) {
  const configuredOrder = Array.isArray(result?.metricOrder) ? result.metricOrder : GROUP_COMPARISON_METRICS.map((metric) => metric.value);
  const configByMetric = new Map(GROUP_COMPARISON_METRICS.map((metric) => [metric.value, metric]));
  const ordered = configuredOrder
    .map((metric) => configByMetric.get(String(metric || "")))
    .filter(Boolean);

  if (ordered.length === GROUP_COMPARISON_METRICS.length) return ordered;
  return GROUP_COMPARISON_METRICS;
}

function getGroupComparisonMetricInfoText(metric) {
  const normalized = normalizeStandardMetricKey(metric);

  if (normalized === "accuracy") {
    return `${getStandardMetricLabel(normalized)} shows the share of checked words that are currently correct in this selection.`;
  }

  if (normalized === "first_try") {
    return `${getStandardMetricLabel(normalized)} shows the share of checked words that were correct on the first attempt.`;
  }

  if (normalized === "completion") {
    return `${getStandardMetricLabel(normalized)} shows the share of assigned pupil slots that reached full completion for the selected test.`;
  }

  if (normalized === "attainment") {
    return `${getStandardMetricLabel(normalized)} shows the average pupil Spelling Attainment Indicator in this selection, not the descriptor-led headline used in the teacher summaries.`;
  }

  return `${getStandardMetricLabel(normalized)} shows how many attempts were needed, on average, for words that were eventually correct.`;
}

function renderGroupComparisonMetricRowLabel(metricConfig) {
  const infoText = getGroupComparisonMetricInfoText(metricConfig.value);
  const infoHtml = normalizeStandardMetricKey(metricConfig.value) === "attainment"
    ? buildAttainmentGuideInfoHtml("In this comparison, the value shown is the average pupil Spelling Attainment Indicator across the displayed selection, using only pupils with checked-response evidence. This row stays numeric in this view and does not show the descriptor-led headline.")
    : "";
  return `
    <div class="td-group-comparison-metric-label">
      <span>${escapeHtml(metricConfig.label)}</span>
      ${renderInfoTip(infoText, {
        label: `About ${metricConfig.label}`,
        align: "start",
        html: infoHtml,
      })}
    </div>
  `;
}

function getGroupComparisonSelectedPair(result = state.groupComparison.result) {
  const visibleGroups = getGroupComparisonVisibleGroups(result);
  const resolvedPair = resolveGroupComparisonPair({
    result,
    compareKey: state.groupComparison.compareKey,
    withKey: state.groupComparison.withKey,
  });
  const groupByKey = new Map(visibleGroups.map((group) => [String(group?.id || ""), group]));

  return {
    options: resolvedPair.options,
    compareKey: resolvedPair.compareKey,
    withKey: resolvedPair.withKey,
    compareGroup: groupByKey.get(resolvedPair.compareKey) || null,
    withGroup: groupByKey.get(resolvedPair.withKey) || null,
  };
}

function getGroupComparisonDisadvantageStatus(group) {
  const groupType = String(group?.groupType || "");
  const groupKey = String(group?.groupKey || group?.key || "");

  if (groupType === "pp") {
    if (groupKey === "pp") return "priority";
    if (groupKey === "non_pp") return "comparison";
    return "neutral";
  }

  if (groupType === "sen") {
    if (["sen", "sen_support", "ehcp"].includes(groupKey)) return "priority";
    if (["none", "non_sen"].includes(groupKey)) return "comparison";
    return "neutral";
  }

  return "neutral";
}

function getGroupComparisonGapDirection(metric, compareValue, withValue) {
  if (!Number.isFinite(compareValue) || !Number.isFinite(withValue) || compareValue === withValue) {
    return "equal";
  }

  if (metric === "average_attempts_per_correct_word") {
    return compareValue < withValue ? "compare_better" : "with_better";
  }

  return compareValue > withValue ? "compare_better" : "with_better";
}

function getGroupComparisonGapMeta(metric, compareGroup, withGroup) {
  if (!compareGroup || !withGroup) {
    return {
      value: "--",
      helper: "Select two groups",
      muted: true,
      tone: "neutral",
    };
  }

  if (compareGroup?.suppressed || withGroup?.suppressed) {
    return {
      value: "Insufficient group size",
      helper: `Minimum cohort ${GROUP_COMPARISON_MIN_COHORT_SIZE} pupils`,
      muted: true,
      tone: "neutral",
    };
  }

  const compareValue = Number(compareGroup?.metrics?.[metric]);
  const withValue = Number(withGroup?.metrics?.[metric]);
  if (!Number.isFinite(compareValue) || !Number.isFinite(withValue)) {
    return {
      value: "No data yet",
      helper: "",
      muted: true,
      tone: "neutral",
    };
  }

  const absoluteGap = Math.abs(compareValue - withValue);
  if (absoluteGap < getGroupComparisonGapThreshold(metric)) {
    return {
      value: formatGroupComparisonGap(metric, absoluteGap),
      helper: "No clear difference",
      muted: false,
      tone: "neutral",
    };
  }

  const compareStatus = getGroupComparisonDisadvantageStatus(compareGroup);
  const withStatus = getGroupComparisonDisadvantageStatus(withGroup);
  const direction = getGroupComparisonGapDirection(metric, compareValue, withValue);
  let tone = "neutral";
  if (compareStatus === "priority" && withStatus === "comparison") {
    tone = direction === "compare_better" ? "positive" : direction === "with_better" ? "negative" : "neutral";
  } else if (compareStatus === "comparison" && withStatus === "priority") {
    tone = direction === "with_better" ? "positive" : direction === "compare_better" ? "negative" : "neutral";
  }

  return {
    value: formatGroupComparisonGap(metric, absoluteGap),
    helper: tone === "positive"
      ? "Disadvantaged group stronger"
      : tone === "negative"
        ? "Disadvantaged group trailing"
        : `${compareValue > withValue ? compareGroup.label : withGroup.label} ${
          metric === "average_attempts_per_correct_word"
            ? "higher attempts"
            : metric === "attainment_indicator"
              ? "higher attainment"
              : "higher"
        }`,
    muted: false,
    tone,
  };
}

function renderGroupComparisonColumnHead(group) {
  if (!group) {
    return `
      <div class="td-group-comparison-column-head">
        <strong>Group</strong>
        <span>No data yet</span>
      </div>
    `;
  }

  const countText = group?.suppressed
    ? "Insufficient group size"
    : formatCountLabel(group?.pupilCount, "pupil", "pupils");

  return `
    <div class="td-group-comparison-column-head">
      <strong>${escapeHtml(group?.label || "Group")}</strong>
      <span>${escapeHtml(countText)}</span>
    </div>
  `;
}

function renderSyncedScrollShell(contentHtml, {
  shellClassName = "",
  viewportClassName = "",
} = {}) {
  const shellClasses = ["td-scroll-shell", shellClassName].filter(Boolean).join(" ");
  const viewportClasses = viewportClassName || "td-scroll-shell-viewport";
  return `
    <div class="${shellClasses}" data-scroll-shell>
      <div class="${viewportClasses}" data-scroll-shell-viewport>
        ${contentHtml}
      </div>
      <div class="td-scroll-shell-track" data-scroll-shell-track aria-hidden="true">
        <div class="td-scroll-shell-track-size" data-scroll-shell-track-size></div>
      </div>
    </div>
  `;
}

function renderGroupComparisonTable(result) {
  const { compareGroup, withGroup } = getGroupComparisonSelectedPair(result);
  const metricRows = getGroupComparisonMetricRenderOrder(result);

  if (!compareGroup || !withGroup) {
    return renderGroupComparisonEmptyState(
      "Choose two recorded groups to compare.",
      result?.insight || "At least two recorded groups are needed in this selection.",
    );
  }

  return renderSyncedScrollShell(`
    <table class="td-group-comparison-table td-group-comparison-table--pair">
      <thead>
        <tr>
          <th scope="col">Metric</th>
          <th scope="col">${renderGroupComparisonColumnHead(compareGroup)}</th>
          <th scope="col">Gap</th>
          <th scope="col">${renderGroupComparisonColumnHead(withGroup)}</th>
        </tr>
      </thead>
      <tbody>
        ${metricRows.map((metricConfig) => {
          const gapMeta = getGroupComparisonGapMeta(metricConfig.value, compareGroup, withGroup);

          return `
            <tr class="${metricConfig.value === "attainment_indicator" ? "is-primary" : ""}">
              <th scope="row">${renderGroupComparisonMetricRowLabel(metricConfig)}</th>
              <td>${renderGroupComparisonMetricCell(metricConfig.value, compareGroup)}</td>
              <td class="td-group-comparison-gap-cell ${gapMeta.muted ? "is-muted" : ""} ${gapMeta.tone ? `is-${gapMeta.tone}` : ""}">
                <strong>${escapeHtml(gapMeta.value)}</strong>
                ${gapMeta.helper ? `<span>${escapeHtml(gapMeta.helper)}</span>` : ""}
              </td>
              <td>${renderGroupComparisonMetricCell(metricConfig.value, withGroup)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `, {
    shellClassName: "td-group-comparison-scroll-shell",
    viewportClassName: "td-group-comparison-table-wrap",
  });
}

function renderGroupComparisonResults() {
  const status = state.groupComparison.status;
  const message = state.groupComparison.message || "Could not load group comparison.";
  const result = state.groupComparison.result;

  if (status === "loading") {
    return renderGroupComparisonEmptyState("Loading group comparison...", "Calculating aggregated results for the current selection.");
  }

  if (status === "error") {
    return renderGroupComparisonEmptyState("Could not load group comparison.", message);
  }

  if (status === "idle") {
    return renderGroupComparisonEmptyState(
      "Compare groups from the current dashboard filters.",
      "Load a comparison to see the selected groups side by side across every core metric in the current selection.",
    );
  }

  if (!result || !Array.isArray(result.groups) || !result.groups.length) {
    return renderGroupComparisonEmptyState(
      "No group data is available yet.",
      result?.insight || "Add recorded group values for the selected pupils to compare this view safely.",
    );
  }

  if (getGroupComparisonVisibleGroups(result).length < 2) {
    return renderGroupComparisonEmptyState(
      "No comparable recorded groups are available yet.",
      result?.insight || "At least two recorded groups are needed in this selection.",
    );
  }

  return `
    <div class="td-group-comparison-body">
      ${renderGroupComparisonTable(result)}
    </div>
  `;
}

function renderGroupComparisonPanel() {
  if (!canAccessSensitiveGroupComparisons()) return "";

  const scopeType = normalizeGroupComparisonScopeType(state.groupComparison.filters.scopeType);
  const scopeValueOptions = getGroupComparisonScopeValueOptions(scopeType);
  const selectedPair = getGroupComparisonSelectedPair();
  const pairOptions = selectedPair.options.length
    ? selectedPair.options
    : [{ value: "", label: state.groupComparison.status === "ready" ? "No recorded groups available" : "Load comparison first" }];
  const safeguardsText = [
    "Aggregated only.",
    "No pupil names, IDs, or row-level outcomes are shown in this comparison view.",
    `Groups below ${GROUP_COMPARISON_MIN_COHORT_SIZE} pupils are suppressed.`,
    "Groups chosen from different measures can overlap, so read cross-measure comparisons descriptively.",
    "Gap colour is green only when a disadvantaged group is stronger than its non-disadvantaged comparison group, red when the reverse is true, and neutral otherwise.",
  ].join(" ");

  return `
    <section class="td-group-comparison-card" data-role="group-comparison-card">
      <div class="td-group-comparison-head">
        <div class="td-group-comparison-copy">
          <div class="td-compare-panel-kicker">Group comparison</div>
          <div class="td-group-comparison-title">
            <h5>Compare cohort outcomes by group</h5>
            ${renderInfoTip(safeguardsText, {
              label: "About group comparison safeguards",
              align: "end",
            })}
          </div>
        </div>
      </div>

      <form data-form="group-comparison" class="td-group-comparison-form">
        <div class="td-group-comparison-grid">
          <label class="td-field td-field--compact">
            <span>Compare</span>
            <select class="td-input" data-field="group-comparison-compare" name="compare_key" ${selectedPair.options.length ? "" : "disabled"}>
              ${pairOptions.map((option) => `
                <option value="${escapeAttr(option.value)}" ${selectedPair.compareKey === String(option.value || "") ? "selected" : ""}>
                  ${escapeHtml(option.label || option.value)}
                </option>
              `).join("")}
            </select>
          </label>

          <label class="td-field td-field--compact">
            <span>With</span>
            <select class="td-input" data-field="group-comparison-with" name="with_key" ${selectedPair.options.length > 1 ? "" : "disabled"}>
              ${pairOptions.map((option) => `
                <option value="${escapeAttr(option.value)}" ${selectedPair.withKey === String(option.value || "") ? "selected" : ""}>
                  ${escapeHtml(option.label || option.value)}
                </option>
              `).join("")}
            </select>
          </label>

          <label class="td-field td-field--compact">
            <span>Scope</span>
            <select class="td-input" data-field="group-comparison-scope-type" name="scope_type">
              ${GROUP_COMPARISON_SCOPE_OPTIONS.map((option) => `
                <option value="${escapeAttr(option.value)}" ${state.groupComparison.filters.scopeType === option.value ? "selected" : ""}>
                  ${escapeHtml(option.label)}
                </option>
              `).join("")}
            </select>
          </label>

          ${
            scopeType === "whole_school"
              ? ""
              : `
            <label class="td-field td-field--compact">
              <span>${escapeHtml(getGroupComparisonScopeFocusLabel(scopeType))}</span>
              <select class="td-input" data-field="group-comparison-scope-value" name="scope_value" ${scopeValueOptions.length ? "" : "disabled"}>
                <option value="">${
                  scopeValueOptions.length
                    ? `Select ${escapeHtml(getGroupComparisonScopeFocusLabel(scopeType).toLowerCase())}`
                    : `No ${escapeHtml(getGroupComparisonScopeFocusLabel(scopeType).toLowerCase())} available`
                }</option>
                ${scopeValueOptions.map((option) => `
                  <option value="${escapeAttr(option.value)}" ${state.groupComparison.filters.scopeValue === String(option.value || "") ? "selected" : ""}>
                    ${escapeHtml(option.label || option.value)}
                  </option>
                `).join("")}
              </select>
            </label>
          `
          }

          <label class="td-field td-field--compact">
            <span>Test</span>
            <select class="td-input" data-field="group-comparison-test" name="test_id">
              <option value="">All tests</option>
              ${(state.tests || []).map((test) => `
                <option value="${escapeAttr(test.id)}" ${state.groupComparison.filters.testId === String(test.id || "") ? "selected" : ""}>
                  ${escapeHtml(test.title || "Untitled test")}
                </option>
              `).join("")}
            </select>
          </label>

          <label class="td-field td-field--compact">
            <span>Date from</span>
            <input
              class="td-input"
              type="date"
              data-field="group-comparison-date-from"
              name="date_from"
              value="${escapeAttr(state.groupComparison.filters.dateFrom || "")}"
            />
          </label>

          <label class="td-field td-field--compact">
            <span>Date to</span>
            <input
              class="td-input"
              type="date"
              data-field="group-comparison-date-to"
              name="date_to"
              value="${escapeAttr(state.groupComparison.filters.dateTo || "")}"
            />
          </label>
        </div>

        <div class="td-group-comparison-actions">
          <button class="td-btn td-btn--primary" type="submit">
            Update comparison
          </button>
        </div>
      </form>

      ${renderGroupComparisonResults()}
    </section>
  `;
}

function renderFloatingAIButton() {
  if (state.analyticsAssistant.open) return "";

  return `
    <button
      type="button"
      class="td-floating-ai"
      data-action="open-ai-assistant"
      aria-label="Open AI assistant"
      title="Open AI assistant"
    >
      <span class="td-floating-ai-badge">AI</span>
      <span>Ask AI</span>
    </button>
  `;
}

function getSelectedVisualSummary() {
  const viewModel = getVisualAnalyticsViewModel();
  const key = createVisualScopeKey(
    state.visualAnalytics.selectedScopeType,
    state.visualAnalytics.selectedScopeId,
  );
  return (
    viewModel.summaries[key] ||
    viewModel.summaries[createVisualScopeKey("overview", "")] ||
    null
  );
}

function getVisualScopeSummary(scopeType, scopeId, graphemeFilter = "") {
  if (!state.visualAnalytics.sourceData) return null;
  return buildVisualScopeSummary({
    scopeType,
    scopeId,
    data: state.visualAnalytics.sourceData,
    graphemeFilter,
  });
}

function getVisualScopeKindLabel(scopeType) {
  if (scopeType === "year_group") return "Year group";
  if (scopeType === "class") return "Class";
  if (scopeType === "pupil") return "Pupil";
  return "All classes";
}

function getVisualSummaryPrompt(scopeType, scopeLabel, selectedGrapheme = "") {
  const grapheme = normalizeAnalyticsGrapheme(selectedGrapheme);
  if (grapheme) {
    if (scopeType === "pupil") {
      return `How is ${scopeLabel} doing on ${grapheme}, and what should they practise next?`;
    }
    if (scopeType === "class") {
      return `Which pupils in ${scopeLabel} need the most support with ${grapheme}?`;
    }
    if (scopeType === "year_group") {
      return `How is ${grapheme} performing across ${scopeLabel}, and which classes or pupils need attention?`;
    }
    return `How is ${grapheme} performing across the school, and where is support needed most?`;
  }

  return getAnalyticsSuggestionPrompts(scopeType, scopeLabel)[0] || "Who needs support next?";
}

function renderCollapsibleSectionHeader({ title, section, isOpen }) {
  const actionLabel = `${isOpen ? "Collapse" : "Expand"} ${title}`;
  return `
    <button
      type="button"
      class="td-section-head td-section-head--inline td-section-head--toggle ${isOpen ? "is-open" : ""}"
      data-action="toggle-section"
      data-section="${escapeAttr(section)}"
      aria-expanded="${isOpen ? "true" : "false"}"
      aria-label="${escapeAttr(actionLabel)}"
    >
      <span class="td-section-head-main">
        <span class="td-section-kicker" aria-hidden="true"></span>
        <span class="td-section-title">${escapeHtml(title)}</span>
      </span>
      <span class="td-section-arrow ${isOpen ? "is-open" : ""}" aria-hidden="true">&#9656;</span>
    </button>
  `;
}

function renderSectionVisualSummaries() {
  const isOpen = state.sections.visuals;
  const viewModel = getVisualAnalyticsViewModel();
  const summary = getSelectedVisualSummary();
  const activeGroup = state.visualAnalytics.activeGroup || "overview";
  const overviewCard = viewModel.catalog?.overview;
  const pupilCards = (viewModel.catalog?.pupils || []);
  const pupilSearch = String(state.visualAnalytics.pupilSearch || "").trim().toLowerCase();
  const matchingPupilCards = pupilSearch
    ? pupilCards.filter((item) => {
      const haystack = `${item.label || ""} ${item.subtitle || ""} ${item.helper || ""}`.toLowerCase();
      return haystack.includes(pupilSearch);
    })
    : pupilCards;
  const visiblePupilCards = matchingPupilCards.slice(0, 18);

  return `
    <section class="td-section td-section--visuals">
      ${renderCollapsibleSectionHeader({
        title: "Summary browser",
        section: "visuals",
        isOpen,
      })}

      ${
        isOpen
          ? `
        <div class="td-section-body">
          ${
            state.visualAnalytics.status === "loading"
              ? `
            <div class="td-empty">
              <strong>Building visual summaries...</strong>
              <p>Pulling recent spelling data for overview, year, class, and student views.</p>
            </div>
          `
              : state.visualAnalytics.status === "error"
                ? `
            <div class="td-empty">
              <strong>Could not load visual summaries.</strong>
              <p>${escapeHtml(state.visualAnalytics.message || "Please try again in a moment.")}</p>
            </div>
          `
                : !overviewCard
                  ? `
            <div class="td-empty">
              <strong>No summary data yet.</strong>
              <p>Once pupils start completing spelling work, their class, year, and student summaries will appear here.</p>
            </div>
          `
                  : `
            ${
              state.visualAnalytics.summaryOpen && summary
                ? `
              <div class="td-visual-toolbar">
                <button type="button" class="td-btn td-btn--ghost" data-action="close-visual-summary">Back to summaries</button>
                <div class="td-chat-note">${escapeHtml(getVisualScopeKindLabel(summary.scopeType))}: ${escapeHtml(summary.label || "Summary")}</div>
              </div>
              ${renderVisualSummaryPanel(summary)}
            `
                : renderVisualSummaryChooser({
                  activeGroup,
                  overviewCard,
                  pupilCards,
                  matchingPupilCards,
                  visiblePupilCards,
                })
            }
          `
          }
        </div>
      `
          : ""
      }
    </section>
  `;
}

function renderVisualSummaryChooser({ activeGroup, overviewCard, pupilCards, matchingPupilCards, visiblePupilCards }) {
  const viewModel = getVisualAnalyticsViewModel();
  const counts = {
    overview: overviewCard ? 1 : 0,
    year_group: viewModel.catalog.yearGroups.length,
    class: viewModel.catalog.classes.length,
    pupil: pupilCards.length,
  };

  if (activeGroup === "pupil") {
    return renderVisualStudentChooser({ counts, pupilCards, matchingPupilCards });
  }

  const groupCopy = activeGroup === "year_group"
    ? {
      title: "Year groups",
      body: "Pick a cohort to open the fuller summary.",
      cards: viewModel.catalog.yearGroups,
      empty: "Add year groups to classes to unlock this view.",
    }
    : activeGroup === "class"
      ? {
        title: "Classes",
        body: "Pick a class to open the fuller summary.",
        cards: viewModel.catalog.classes,
        empty: "No classes yet.",
      }
      : {
          title: "All classes",
          body: "Start with the whole-dashboard summary.",
          cards: overviewCard ? [overviewCard] : [],
          empty: "No summary data yet.",
        };

  return `
    <div class="td-visual-browser td-visual-browser--compact">
      <div class="td-visual-group">
        <div class="td-visual-switcher">
          ${renderVisualGroupButton("overview", "All", counts.overview, activeGroup)}
          ${renderVisualGroupButton("year_group", "Years", counts.year_group, activeGroup)}
          ${renderVisualGroupButton("class", "Classes", counts.class, activeGroup)}
          ${renderVisualGroupButton("pupil", "Pupils", counts.pupil, activeGroup)}
        </div>

        <div class="td-visual-group-head td-visual-group-head--compact">
          <div>
            <h4>${escapeHtml(groupCopy.title)}</h4>
            <p>${escapeHtml(groupCopy.body)}</p>
          </div>
          ${
            activeGroup === "pupil"
              ? `
            <label class="td-visual-search">
              <span>Search</span>
              <input
                class="td-input"
                type="text"
                data-field="visual-pupil-search"
                value="${escapeAttr(state.visualAnalytics.pupilSearch || "")}"
                placeholder="Search students..."
                autocomplete="off"
              />
            </label>
          `
              : ""
          }
        </div>

        ${
          groupCopy.cards.length
            ? `
          <div class="td-visual-scope-grid ${activeGroup === "overview" ? "td-visual-scope-grid--solo" : activeGroup === "pupil" ? "td-visual-scope-grid--students" : ""}">
            ${groupCopy.cards.map(renderVisualScopeCard).join("")}
          </div>
          ${
            activeGroup === "pupil" && matchingPupilCards.length > visiblePupilCards.length
              ? `<p class="td-chat-note">Showing ${escapeHtml(String(visiblePupilCards.length))} of ${escapeHtml(String(matchingPupilCards.length))} pupils. Keep typing to narrow the list.</p>`
              : ""
          }
        `
            : `<div class="td-empty td-empty--compact"><strong>${escapeHtml(groupCopy.empty)}</strong></div>`
        }
      </div>
    </div>
  `;
}

function renderVisualStudentChooser({ counts, pupilCards, matchingPupilCards }) {
  const query = String(state.visualAnalytics.pupilSearch || "").trim();
  const isSearchReady = query.length >= 2;
  const needsMoreLetters = query.length > 0 && query.length < 2;
  const sortedPupilCards = sortVisualStudentItems(pupilCards);
  const filteredPupilCards = filterItemsByVisualStatus(
    sortedPupilCards,
    state.visualAnalytics.pupilStatusFilter,
    getVisualPupilStatusMeta,
  );
  const sortedMatchingPupilCards = sortVisualStudentItems(matchingPupilCards);
  const filteredMatchingPupilCards = filterItemsByVisualStatus(
    sortedMatchingPupilCards,
    state.visualAnalytics.pupilStatusFilter,
    getVisualPupilStatusMeta,
  );
  const defaultRows = filteredPupilCards.slice(0, 18);
  const searchResults = isSearchReady ? filteredMatchingPupilCards.slice(0, 20) : [];
  const allPupilsPill = filteredPupilCards.length === sortedPupilCards.length
    ? String(sortedPupilCards.length)
    : `${filteredPupilCards.length}/${sortedPupilCards.length}`;

  return `
    <div class="td-visual-browser td-visual-browser--compact">
      <div class="td-visual-group">
        <div class="td-visual-switcher">
          ${renderVisualGroupButton("overview", "All", counts.overview, "pupil")}
          ${renderVisualGroupButton("year_group", "Years", counts.year_group, "pupil")}
          ${renderVisualGroupButton("class", "Classes", counts.class, "pupil")}
          ${renderVisualGroupButton("pupil", "Pupils", counts.pupil, "pupil")}
        </div>

        <div class="td-visual-group-head td-visual-group-head--compact">
          <div>
            <h4>Pupils</h4>
            <p>Filter by current status or search for someone specific. Awaiting practice stays inside Developing until there is enough evidence to judge performance at this level.</p>
          </div>
          <label class="td-visual-search">
            <span>Search</span>
            <input
              class="td-input"
              type="text"
              data-field="visual-pupil-search"
              value="${escapeAttr(state.visualAnalytics.pupilSearch || "")}"
              placeholder="Type 2+ letters of a pupil name..."
              autocomplete="off"
            />
          </label>
        </div>

        ${renderVisualStatusFilters({
          items: sortedPupilCards,
          activeFilter: state.visualAnalytics.pupilStatusFilter,
          metaResolver: getVisualPupilStatusMeta,
          action: "set-visual-pupil-filter",
        })}
        ${renderResultsBlockNote("Click a status chip to filter the pupil list. Search works within the current filter.", {
          display: "tooltip",
          label: "About pupil filters",
        })}

        ${
          isSearchReady
            ? `
          <div class="td-results-block-head">
            <h5>Search results</h5>
            <span class="td-pill">${escapeHtml(String(filteredMatchingPupilCards.length))}</span>
          </div>
          ${
            searchResults.length
              ? `
            ${renderVisualStudentRows(searchResults)}
            ${
              filteredMatchingPupilCards.length > searchResults.length
                ? `<p class="td-chat-note">Showing the first ${escapeHtml(String(searchResults.length))} matches. Keep typing to narrow the list.</p>`
                : ""
            }
          `
              : `<div class="td-empty td-empty--compact"><strong>No pupils match "${escapeHtml(query)}".</strong></div>`
          }
        `
            : `
          <div class="td-results-block-head">
            <h5>All pupils</h5>
            <span class="td-pill">${escapeHtml(allPupilsPill)}</span>
          </div>
          ${renderVisualStudentRows(defaultRows)}
          ${
            filteredPupilCards.length > defaultRows.length
              ? `<p class="td-chat-note">Showing the first ${escapeHtml(String(defaultRows.length))} pupils ordered by review signal. Search to narrow the list.</p>`
              : ""
          }
          <p class="td-chat-note">${
            needsMoreLetters
              ? "Add one more letter to search the full pupil list."
              : `Type at least 2 letters to search across ${filteredPupilCards.length} pupils in the current filter.`
          }</p>
        `
        }
      </div>
    </div>
  `;
}

function renderVisualGroupButton(group, label, count, activeGroup) {
  return `
    <button
      type="button"
      class="td-visual-group-btn ${activeGroup === group ? "is-active" : ""}"
      data-action="change-visual-group"
      data-group="${escapeAttr(group)}"
    >
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(count))}</strong>
    </button>
  `;
}

function renderHeadingWithInfo(title, infoText, {
  tag = "h5",
  className = "",
  infoLabel = "",
  infoAlign = "start",
} = {}) {
  const tagName = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(String(tag).toLowerCase())
    ? String(tag).toLowerCase()
    : "h5";
  const headingClasses = ["td-heading-with-info", className].filter(Boolean).join(" ");

  return `
    <div class="${headingClasses}">
      <${tagName}>${escapeHtml(title)}</${tagName}>
      ${
        infoText
          ? renderInfoTip(infoText, {
              label: infoLabel || `About ${title}`,
              align: infoAlign,
            })
          : ""
      }
    </div>
  `;
}

function renderResultsBlockNote(text, {
  display = "inline",
  label = "More info",
  align = "start",
} = {}) {
  if (!text) return "";
  if (display === "tooltip") {
    return `
      <div class="td-results-block-note td-results-block-note--tip">
        ${renderInfoTip(text, { label, align })}
      </div>
    `;
  }
  return `<p class="td-results-block-note">${escapeHtml(text)}</p>`;
}

function renderVisualStatusFilters({ items, activeFilter = "all", metaResolver, action }) {
  const counts = countItemsByVisualStatus(items, metaResolver);
  const currentFilter = normalizeVisualStatusFilter(activeFilter);

  return `
    <div class="td-status-filter-row" role="group">
      ${VISUAL_STATUS_FILTER_OPTIONS.map((item) => `
        <button
          type="button"
          class="td-status-filter td-status-filter--${escapeAttr(item.tone)} ${currentFilter === item.key ? "is-active" : ""}"
          data-action="${escapeAttr(action)}"
          data-filter="${escapeAttr(item.key)}"
          aria-pressed="${currentFilter === item.key ? "true" : "false"}"
        >
          <span class="td-status-filter-dot" aria-hidden="true"></span>
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(String(counts[item.key] || 0))}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function decorateVisualStudentItem(item) {
  if (!item) return null;
  const signal = item.signalTone && item.signalLabel
    ? { tone: item.signalTone, label: item.signalLabel }
    : getVisualPupilSignal({
      needsIntervention: !!item.isPriority,
      checkedWords: Number(item.checkedWords || 0),
      accuracy: Number(item.accuracy || (Number.isFinite(Number(item.sortAccuracy)) ? Number(item.sortAccuracy) : 0)),
      averageAttempts: Number(item.averageAttempts || 0),
    });

  return {
    ...item,
    signalTone: signal.tone,
    signalLabel: signal.label,
  };
}

function sortVisualStudentItems(items) {
  return [...(items || [])]
    .map(decorateVisualStudentItem)
    .filter(Boolean)
    .sort((a, b) => {
      if (getPupilSignalRank(a.signalTone) !== getPupilSignalRank(b.signalTone)) {
        return getPupilSignalRank(a.signalTone) - getPupilSignalRank(b.signalTone);
      }
      if (Number(a.checkedWords === 0) !== Number(b.checkedWords === 0)) {
        return Number(a.checkedWords === 0) - Number(b.checkedWords === 0);
      }
      const aAttainment = Number.isFinite(Number(a.attainmentScore)) ? Number(a.attainmentScore) : Number.POSITIVE_INFINITY;
      const bAttainment = Number.isFinite(Number(b.attainmentScore)) ? Number(b.attainmentScore) : Number.POSITIVE_INFINITY;
      if (aAttainment !== bAttainment) return aAttainment - bAttainment;
      const aAccuracy = Number(a.checkedWords || 0) ? Number(a.accuracy || 0) : Number.POSITIVE_INFINITY;
      const bAccuracy = Number(b.checkedWords || 0) ? Number(b.accuracy || 0) : Number.POSITIVE_INFINITY;
      if (aAccuracy !== bAccuracy) return aAccuracy - bAccuracy;
      const aTime = Number(a.latestActivity || 0);
      const bTime = Number(b.latestActivity || 0);
      if (bTime !== aTime) return bTime - aTime;
      return String(a.label || "").localeCompare(String(b.label || ""));
    });
}

function countVisualStudentSignals(items) {
  return (items || []).reduce((counts, item) => {
    const tone = decorateVisualStudentItem(item)?.signalTone || "amber";
    counts[tone] = (counts[tone] || 0) + 1;
    return counts;
  }, { red: 0, amber: 0, green: 0 });
}

function renderVisualStudentRows(items) {
  if (!items.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No pupils to show yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-visual-student-list">
      ${items.map(renderVisualStudentRow).join("")}
    </div>
  `;
}

function renderVisualStudentRowLegacy(item) {
  const signal = decorateVisualStudentItem(item);
  const statusMeta = getVisualPupilStatusMeta(item);
  const checkedWords = Number(item?.checkedWords || 0);
  const statusLabel = statusMeta.label;
  const metricText = checkedWords
    ? `${formatPercent(item?.accuracy || 0)} • ${checkedWords} checked`
    : "No attempts yet";
  const helperText = item?.forceHelper
    ? String(item?.helper || "No activity yet")
    : item?.isPriority
    ? String(item?.helper || "Needs review")
    : checkedWords
      ? `Last active ${formatDate(item?.latestActivity || null)}`
      : "Awaiting first attempts";

  return `
    <button
      type="button"
      class="td-visual-student-row td-visual-student-row--${escapeAttr(statusMeta.key)} ${signal?.signalTone === "red" ? "is-alert" : ""}"
      data-action="open-visual-summary"
      data-scope-type="pupil"
      data-scope-id="${escapeAttr(item?.scopeId || "")}"
    >
      <div class="td-visual-student-main">
        <div class="td-visual-student-main-top">
          <strong>${escapeHtml(item?.label || "Pupil")}</strong>
          ${renderPupilSignalBadge(signal, { title: `${item?.label || "Pupil"}: ${signal?.signalLabel || "Developing"}` })}
        </div>
        <span>${escapeHtml(item?.subtitle || "No active classes")}</span>
      </div>
      <div class="td-visual-student-status">${escapeHtml(statusLabel)}</div>
      <div class="td-visual-student-metric">${escapeHtml(metricText)}</div>
      <div class="td-visual-student-helper">${escapeHtml(helperText)}</div>
    </button>
  `;
}

function buildVisualSummaryStudentItemsLegacy(summary) {
  return (summary?.pupilRows || []).map((item) => ({
    scopeId: item.pupilId,
    label: item.name,
    subtitle: item.classNames?.join(", ") || "No active classes",
    helper: summary?.selectedGrapheme
      ? item.checkedWords
        ? `${summary.selectedGrapheme}: ${formatPercent(item.accuracy)} across ${item.checkedWords} checks`
        : `No ${summary.selectedGrapheme} checks yet`
      : item.weakGraphemes?.length
        ? `Focus: ${item.weakGraphemes.join(", ")}`
        : "No standout focus yet",
    isPriority: !!item.needsIntervention,
    forceHelper: !!summary?.selectedGrapheme,
    checkedWords: Number(item.checkedWords || 0),
    accuracy: Number(item.accuracy || 0),
    averageAttempts: Number(item.averageAttempts || 0),
    latestActivity: item.latestActivity || 0,
    signalTone: item.signalTone,
    signalLabel: item.signalLabel,
  }));
}

function renderVisualStudentRow(item) {
  const signal = decorateVisualStudentItem(item);
  const statusMeta = getVisualPupilStatusMeta(item);
  const checkedWords = Number(item?.checkedWords || 0);
  const statusLabel = statusMeta.label;
  const metricText = item?.attainmentDisplayLabel
    ? String(item.attainmentDisplayLabel)
    : checkedWords
      ? "Not yet banded"
      : "No attempts yet";
  const securityText = item?.securityLabel ? String(item.securityLabel) : "";
  const helperText = item?.forceHelper
    ? String(item?.helper || "No activity yet")
    : item?.isPriority
      ? String(item?.helper || "Needs review")
      : checkedWords
        ? `${securityText ? `${securityText} | ` : ""}Last active ${formatDate(item?.latestActivity || null)}`
        : "Awaiting first attempts";

  return `
    <button
      type="button"
      class="td-visual-student-row td-visual-student-row--${escapeAttr(statusMeta.key)} ${signal?.signalTone === "red" ? "is-alert" : ""}"
      data-action="open-visual-summary"
      data-scope-type="pupil"
      data-scope-id="${escapeAttr(item?.scopeId || "")}"
    >
      <div class="td-visual-student-main">
        <div class="td-visual-student-main-top">
          <strong>${escapeHtml(item?.label || "Pupil")}</strong>
          ${renderPupilSignalBadge(signal, { title: `${item?.label || "Pupil"}: ${signal?.signalLabel || "Developing"}` })}
        </div>
        <span>${escapeHtml(item?.subtitle || "No active classes")}</span>
      </div>
      <div class="td-visual-student-status">${escapeHtml(statusLabel)}</div>
      <div class="td-visual-student-metric">${escapeHtml(metricText)}</div>
      <div class="td-visual-student-helper">${escapeHtml(helperText)}</div>
    </button>
  `;
}

function buildVisualSummaryStudentItems(summary) {
  return (summary?.pupilRows || []).map((item) => ({
    scopeId: item.pupilId,
    label: item.name,
    subtitle: item.classNames?.join(", ") || "No active classes",
    helper: summary?.selectedGrapheme
      ? item.checkedWords
        ? `${summary.selectedGrapheme}: ${formatPercent(item.accuracy)} across ${item.checkedWords} checks`
        : `No ${summary.selectedGrapheme} checks yet`
      : item.weakGraphemes?.length
        ? `Focus: ${item.weakGraphemes.join(", ")}`
        : "No standout focus yet",
    isPriority: !!item.needsIntervention,
    forceHelper: !!summary?.selectedGrapheme,
    headlineAttainmentLabel: item?.attainmentIndicator?.headlineAttainmentLabel || "Not yet banded",
    attainmentDisplayLabel: item?.attainmentIndicator?.attainmentDisplayLabel || "Not yet banded",
    securityLabel: item?.attainmentIndicator?.securityLabel || "",
    attainmentScore: item?.attainmentIndicator?.score ?? null,
    checkedWords: Number(item.checkedWords || 0),
    accuracy: Number(item.accuracy || 0),
    averageAttempts: Number(item.averageAttempts || 0),
    latestActivity: item.latestActivity || 0,
    signalTone: item.signalTone,
    signalLabel: item.signalLabel,
  }));
}

function renderVisualSummaryStudentExplorer(summary) {
  const pupilItems = sortVisualStudentItems(buildVisualSummaryStudentItems(summary));
  const filteredPupilItems = filterItemsByVisualStatus(
    pupilItems,
    state.visualAnalytics.pupilStatusFilter,
    getVisualPupilStatusMeta,
  );
  const query = String(state.visualAnalytics.pupilSearch || "").trim();
  const normalizedQuery = query.toLowerCase();
  const isSearchReady = query.length >= 2;
  const needsMoreLetters = query.length > 0 && query.length < 2;
  const matchingItems = normalizedQuery
    ? filteredPupilItems.filter((item) => {
      const haystack = `${item.label || ""} ${item.subtitle || ""} ${item.helper || ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    : filteredPupilItems;
  const defaultRows = filteredPupilItems.slice(0, 18);
  const searchRows = isSearchReady ? matchingItems.slice(0, 20) : [];
  const allPupilsPill = filteredPupilItems.length === pupilItems.length
    ? String(pupilItems.length)
    : `${filteredPupilItems.length}/${pupilItems.length}`;

  return `
    <div class="td-results-grid td-results-grid--analytics">
      <section class="td-results-block td-results-block--wide">
        <div class="td-results-block-head">
          <h5>Pupils</h5>
          <span class="td-pill">${escapeHtml(allPupilsPill)}</span>
        </div>

        <div class="td-visual-group-head td-visual-group-head--compact">
          <div>
            <p>${escapeHtml(
              summary.selectedGrapheme
                ? summary.scopeType === "year_group"
                  ? `Use shortlists or search to open a pupil for ${summary.selectedGrapheme} in this year.`
                  : `Use shortlists or search to open a pupil for ${summary.selectedGrapheme} across the school.`
                : summary.scopeType === "year_group"
                  ? "Use shortlists or search to open a pupil in this year."
                  : "Use shortlists or search to open a pupil across the school.",
            )}</p>
            <p>Filter by current status. Awaiting practice stays inside Developing until there is enough evidence to judge performance at this level.</p>
          </div>
          <label class="td-visual-search">
            <span>Search pupils</span>
            <input
              class="td-input"
              type="text"
              data-field="visual-pupil-search"
              value="${escapeAttr(state.visualAnalytics.pupilSearch || "")}"
              placeholder="Type 2+ letters of a pupil name..."
              autocomplete="off"
            />
          </label>
        </div>

        ${renderVisualStatusFilters({
          items: pupilItems,
          activeFilter: state.visualAnalytics.pupilStatusFilter,
          metaResolver: getVisualPupilStatusMeta,
          action: "set-visual-pupil-filter",
        })}
        ${renderResultsBlockNote("Click a status chip to filter the pupil list. Search works within the current filter.", {
          display: "tooltip",
          label: "About pupil filters",
        })}

        ${
          isSearchReady
            ? `
          <div class="td-results-block-head">
            <h5>Search results</h5>
            <span class="td-pill">${escapeHtml(String(matchingItems.length))}</span>
          </div>
          ${
            searchRows.length
              ? `
            ${renderVisualStudentRows(searchRows)}
            ${
              matchingItems.length > searchRows.length
                ? `<p class="td-chat-note">Showing the first ${escapeHtml(String(searchRows.length))} matches. Keep typing to narrow the list.</p>`
                : ""
            }
          `
              : `<div class="td-empty td-empty--compact"><strong>No pupils match "${escapeHtml(query)}".</strong></div>`
          }
        `
            : `
          <div class="td-results-block-head">
            <h5>All pupils</h5>
            <span class="td-pill">${escapeHtml(allPupilsPill)}</span>
          </div>
          ${renderVisualStudentRows(defaultRows)}
          ${
            filteredPupilItems.length > defaultRows.length
              ? `<p class="td-chat-note">Showing the first ${escapeHtml(String(defaultRows.length))} pupils ordered by review signal. Search to narrow the list.</p>`
              : ""
          }
          <p class="td-chat-note">${
            needsMoreLetters
              ? "Add one more letter to search the full pupil list."
              : summary.selectedGrapheme
                ? `Type at least 2 letters to search across ${filteredPupilItems.length} pupils for ${summary.selectedGrapheme} in the current filter.`
                : `Type at least 2 letters to search across ${filteredPupilItems.length} pupils in the current filter.`
          }</p>
        `
        }
      </section>
    </div>
  `;
}

function renderVisualScopeCard(item) {
  if (!item) return "";
  const selectedKey = createVisualScopeKey(
    state.visualAnalytics.selectedScopeType,
    state.visualAnalytics.selectedScopeId,
  );
  const itemKey = createVisualScopeKey(item.scopeType, item.scopeId);
  const isSelected = selectedKey === itemKey;
  const meterWidth = item.primaryValue === "No attempts"
    ? 0
    : Number(item.primaryProgress) > 0
      ? Math.max(8, Math.round((Number(item.primaryProgress) || 0) * 100))
      : 0;

  return `
    <button
      type="button"
      class="td-visual-scope-card td-visual-scope-card--${escapeAttr(item.tone || "neutral")} ${isSelected ? "is-selected" : ""}"
      data-action="open-visual-summary"
      data-scope-type="${escapeAttr(item.scopeType || "overview")}"
      data-scope-id="${escapeAttr(item.scopeId || "")}"
    >
      <div class="td-visual-scope-top">
        <strong>${escapeHtml(item.label || "Summary")}</strong>
        <span class="td-visual-scope-kind">${escapeHtml(getVisualScopeKindLabel(item.scopeType))}</span>
      </div>
      <div class="td-visual-scope-value">${escapeHtml(item.primaryValue || "No attempts")}</div>
      <div class="td-visual-scope-sub">${escapeHtml(item.secondaryValue || item.subtitle || "")}</div>
      <div class="td-visual-scope-bar"><span style="width:${meterWidth}%;"></span></div>
      <div class="td-visual-scope-helper">${escapeHtml(item.helper || item.subtitle || "")}</div>
    </button>
  `;
}

function renderVisualBlockHead(title, pillText = null) {
  return `
    <div class="td-results-block-head td-results-block-head--visual">
      <h5>${escapeHtml(title)}</h5>
      ${pillText === null ? "" : `<span class="td-pill">${escapeHtml(String(pillText))}</span>`}
    </div>
  `;
}

function sortAccuracyBucketItems(items, statusKey) {
  const rows = [...(items || [])];
  if (statusKey === "secure") {
    return rows.sort((a, b) =>
      Number(b.accuracy || 0) - Number(a.accuracy || 0)
      || Number(b.total || 0) - Number(a.total || 0)
      || String(a.target || "").localeCompare(String(b.target || ""))
    );
  }

  return rows.sort((a, b) =>
    Number(a.accuracy || 0) - Number(b.accuracy || 0)
    || Number(b.total || 0) - Number(a.total || 0)
    || String(a.target || "").localeCompare(String(b.target || ""))
  );
}

function buildAccuracySnapshotBands(summary) {
  const trackedRows = (summary?.graphemeRows || [])
    .filter((item) => Number(item?.total || 0) >= 2)
    .map((item) => ({
      ...item,
      statusMeta: getVisualGraphemeStatusMeta(item),
    }));
  const trackedCount = trackedRows.length;

  return VISUAL_STATUS_FILTER_OPTIONS.map((option) => {
    const items = sortAccuracyBucketItems(
      trackedRows.filter((item) => item.statusMeta?.key === option.key),
      option.key,
    );
    return {
      ...option,
      items,
      count: items.length,
      percent: trackedCount ? items.length / trackedCount : 0,
      trackedCount,
      focusTargets: [...new Set(items.map((item) => normalizeConfusionToken(item?.target)).filter(Boolean))],
      practiceWords: [...new Set(
        items.flatMap((item) => Array.isArray(item?.practiceWords) ? item.practiceWords : (item?.wordSamples || []))
          .map((word) => String(word || "").trim().toLowerCase())
          .filter(Boolean),
      )].slice(0, COMMON_CONFUSION_TEST_WORD_LIMIT),
    };
  });
}

function buildVisualSummaryInfoText(summary) {
  const buckets = buildAccuracySnapshotBands(summary);
  const trackedCount = buckets[0]?.trackedCount || 0;
  const lines = [];

  if (summary?.subtitle) {
    lines.push(summary.subtitle);
  }

  lines.push(
    summary?.checkedWords
      ? `${formatPercent(summary.accuracy)} accuracy across ${summary.checkedWords} checked words; ${summary.activePupilCount}/${summary.pupilCount} pupils contributing.`
      : "No checked words yet in this view."
  );

  lines.push(
    summary?.attainmentEvidencePupilCount
      ? summary.scopeType === "pupil"
        ? `Current spelling level ${getSummaryAttainmentNarrative(summary)}. ${getSummaryAttainmentSubtext(summary)}.`
        : `Typical level ${getSummaryAttainmentNarrative(summary)}. ${getSummaryAttainmentSubtext(summary)}.`
      : "The descriptor-led attainment headline will appear once there is enough response evidence in this view."
  );

  lines.push(
    trackedCount
      ? `${trackedCount} grapheme${trackedCount === 1 ? "" : "s"} currently have enough recent evidence for banding.`
      : "Grapheme banding appears after at least two recent checks for a grapheme."
  );

  return lines.filter(Boolean).join("\n");
}

function renderSummaryTokenRow(items, formatter = (item) => item?.target || item?.word || item, className = "") {
  const classes = ["td-visual-token-row", className].filter(Boolean).join(" ");
  return `
    <div class="${classes}">
      ${items.map((item) => `<span class="td-visual-token">${escapeHtml(formatter(item))}</span>`).join("")}
    </div>
  `;
}

function renderBuildTestButton({
  action,
  tone = "amber",
  labelAttrName,
  labelAttrValue,
  targetsAttrName,
  targets = [],
  practiceWords = [],
  scopeLabel = "",
}) {
  if (!canCreateTests()) return "";

  return `
    <button
      type="button"
      class="td-btn td-test-cta"
      data-action="${escapeAttr(action)}"
      ${escapeAttr(labelAttrName)}="${escapeAttr(labelAttrValue || "")}"
      ${escapeAttr(targetsAttrName)}="${escapeAttr(JSON.stringify(targets || []))}"
      data-practice-words="${escapeAttr(JSON.stringify(practiceWords || []))}"
      data-scope-label="${escapeAttr(scopeLabel || "")}"
      aria-label="${escapeAttr(`Build test draft: ${labelAttrValue || "Spelling"}`)}"
    >
      <span class="td-test-cta-label">Build test</span>
      <span class="td-test-cta-arrow" aria-hidden="true"></span>
    </button>
  `;
}

function renderAccuracyBandCard(bucket, summary) {
  const displayLabel = getAnalyticsGraphemeStatusLabel(bucket.key);
  return `
    <article class="td-accuracy-band-card td-accuracy-band-card--${escapeAttr(bucket.tone)}">
      <div class="td-accuracy-band-meter" aria-hidden="true">
        <span style="width:${bucket.percent > 0 ? Math.max(8, Math.round(bucket.percent * 100)) : 0}%;"></span>
      </div>
      <div class="td-accuracy-band-head">
        <strong>${escapeHtml(displayLabel)}</strong>
        <span>${escapeHtml(formatPercent(bucket.percent))}</span>
      </div>
      <div class="td-accuracy-band-sub">
        ${escapeHtml(
          bucket.trackedCount
            ? `${bucket.count} of ${bucket.trackedCount} tracked grapheme${bucket.trackedCount === 1 ? "" : "s"}`
            : "No tracked graphemes yet"
        )}
      </div>
      ${
        bucket.items.length
          ? renderSummaryTokenRow(bucket.items, (item) => item?.target || "")
          : `<p class="td-accuracy-band-empty">No graphemes here yet.</p>`
      }
      ${
        bucket.key !== "secure" && bucket.practiceWords?.length
          ? `
        <div class="td-confusion-item-actions">
          ${renderBuildTestButton({
            action: "build-grapheme-band-test",
            tone: bucket.tone,
            labelAttrName: "data-band-label",
            labelAttrValue: displayLabel || "Spelling",
            targetsAttrName: "data-focus-targets",
            targets: bucket.focusTargets || [],
            practiceWords: bucket.practiceWords || [],
            scopeLabel: summary?.label || "",
          })}
        </div>
      `
          : ""
      }
    </article>
  `;
}

function renderAccuracySnapshotSection(summary) {
  const buckets = buildAccuracySnapshotBands(summary);
  const trackedCount = buckets[0]?.trackedCount || 0;

  return `
    <div class="td-results-grid td-results-grid--analytics">
      <section class="td-results-block td-results-block--wide">
        <div class="td-results-block-head">
          ${renderHeadingWithInfo("Grapheme security", "Security snapshot only. Use Common confusions for what to teach next.", {
            tag: "h5",
            infoLabel: "About grapheme security",
          })}
          <span class="td-pill">${escapeHtml(String(trackedCount))}</span>
        </div>
        <div class="td-accuracy-band-grid">
          ${buckets.map((bucket) => renderAccuracyBandCard(bucket, summary)).join("")}
        </div>
      </section>
    </div>
  `;
}

function formatTrendDelta(value) {
  const roundedValue = Math.round((Number(value) || 0) * 100);
  if (!roundedValue) return "0 pts";
  return `${roundedValue > 0 ? "+" : "-"}${Math.abs(roundedValue)} pts`;
}

function getVisualTrendExplanation(dayCount) {
  return dayCount >= 2
    ? "This compares the earlier half of these activity days with the most recent half, so one day can dip without changing the overall direction."
    : "One activity day is not enough to compare earlier and recent performance yet.";
}

function getVisualTrendSplitIndex(dayCount) {
  return dayCount < 2 ? 1 : Math.max(1, Math.floor(dayCount / 2));
}

function clampTrendAccuracy(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(1, numericValue));
}

function formatTrendPointSummary(point) {
  const label = formatAnalyticsShortDayLabel(point?.dayKey || "");
  const accuracy = formatPercent(clampTrendAccuracy(point?.accuracy));
  const attemptCount = Math.max(0, Number(point?.attemptCount || 0));
  return `${label}: ${accuracy} accuracy across ${attemptCount} checked word${attemptCount === 1 ? "" : "s"}.`;
}

function renderVisualTrendChart(trend) {
  const points = Array.isArray(trend?.points) ? trend.points : [];
  const dayCount = points.length;
  if (!dayCount) return "";

  const splitIndex = getVisualTrendSplitIndex(dayCount);
  const tone = String(trend?.tone || "neutral");
  const rangeLabel = trend?.startLabel && trend?.endLabel
    ? trend.startLabel === trend.endLabel
      ? trend.startLabel
      : `${trend.startLabel} to ${trend.endLabel}`
    : trend?.startLabel || trend?.endLabel || "Recent activity";
  const a11yLabel = dayCount >= 2
    ? `Accuracy by activity day from ${rangeLabel}. Earlier average ${formatPercent(trend?.baselineAccuracy || 0)}. Recent average ${formatPercent(trend?.recentAccuracy || 0)}.`
    : `Accuracy for ${rangeLabel}: ${formatPercent(points[0]?.accuracy || 0)}.`;

  return `
    <div class="td-trend-chart td-trend-chart--${escapeAttr(tone)}" role="img" aria-label="${escapeAttr(a11yLabel)}">
      <div class="td-trend-chart-head">
        <strong>Accuracy by activity day</strong>
        ${
          dayCount >= 2
            ? `
          <div class="td-trend-chart-legend" aria-hidden="true">
            <span class="td-trend-legend td-trend-legend--earlier">Earlier</span>
            <span class="td-trend-legend td-trend-legend--${escapeAttr(tone)}">Recent</span>
          </div>
        `
            : ""
        }
      </div>
      <div class="td-trend-chart-shell">
        <div class="td-trend-chart-axis" aria-hidden="true">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div class="td-trend-chart-plot">
          <div class="td-trend-chart-grid" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="td-trend-chart-bars" style="--trend-day-count:${Math.max(1, dayCount)};">
            ${points.map((point, index) => {
              const accuracy = clampTrendAccuracy(point?.accuracy);
              const heightPercent = Math.round(accuracy * 100);
              const isRecent = dayCount < 2 || index >= splitIndex;
              const barTone = isRecent ? tone : "earlier";
              const pointSummary = formatTrendPointSummary(point);
              return `
                <div class="td-trend-bar-col" title="${escapeAttr(pointSummary)}">
                  <span class="td-trend-bar-value">${escapeHtml(formatPercent(accuracy))}</span>
                  <div class="td-trend-bar-slot">
                    <span class="td-trend-bar td-trend-bar--${escapeAttr(barTone)}" style="height:${heightPercent}%;"></span>
                  </div>
                  <span class="td-trend-bar-day">${escapeHtml(formatAnalyticsShortDayLabel(point?.dayKey || ""))}</span>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
      ${
        dayCount >= 2
          ? `
        <div class="td-trend-phase-row" aria-hidden="true">
          <span class="td-trend-phase td-trend-phase--earlier" style="flex:${splitIndex};">Earlier days</span>
          <span class="td-trend-phase td-trend-phase--${escapeAttr(tone)}" style="flex:${Math.max(1, dayCount - splitIndex)};">Recent days</span>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function renderVisualTrendSummary(trend) {
  const dayCount = Math.max(0, Number(trend?.dayCount || 0));
  if (!dayCount) return "";

  const hasComparison = dayCount >= 2;
  const startLabel = String(trend?.startLabel || "").trim();
  const endLabel = String(trend?.endLabel || "").trim();
  const rangeLabel = startLabel && endLabel
    ? startLabel === endLabel
      ? startLabel
      : `${startLabel} to ${endLabel}`
    : startLabel || endLabel;
  const summaryText = trend?.summaryText || "Progress over time will appear once there is activity in this view.";
  const expectedBenchmark = trend?.expectedBenchmark || {
    label: "Expected benchmark coming soon",
    statusText: "Not enough data yet",
    note: "We need more app data across difficulty levels and question types before expected performance can be shown reliably.",
    tone: "neutral",
  };

  return `
    <div class="td-trend-panel">
      <div class="td-trend-meta">
        ${rangeLabel ? `<span>${escapeHtml(rangeLabel)}</span>` : ""}
        <span>${escapeHtml(`${dayCount} activity day${dayCount === 1 ? "" : "s"}`)}</span>
      </div>
      ${renderVisualTrendChart(trend)}
      <div class="td-trend-compare">
        <div class="td-trend-stat">
          <span>${escapeHtml(hasComparison ? "Earlier average" : "Current accuracy")}</span>
          <strong>${escapeHtml(formatPercent(trend?.baselineAccuracy || 0))}</strong>
        </div>
        <div class="td-trend-change td-trend-change--${escapeAttr(expectedBenchmark.tone || "neutral")}">
          <span class="td-trend-change-label">${escapeHtml(expectedBenchmark.label || "Expected benchmark coming soon")}</span>
          <strong>${escapeHtml(expectedBenchmark.statusText || "More evidence needed")}</strong>
          <small class="td-trend-change-note">${escapeHtml(expectedBenchmark.note || "")}</small>
        </div>
        <div class="td-trend-stat">
          <span>${escapeHtml(hasComparison ? "Recent average" : "Activity days")}</span>
          <strong>${escapeHtml(hasComparison ? formatPercent(trend?.recentAccuracy || 0) : String(dayCount))}</strong>
        </div>
      </div>
      <p class="td-trend-summary-text">${escapeHtml(summaryText)}</p>
    </div>
  `;
}

function renderCommonConfusionsSection(summary) {
  const items = summary?.commonConfusions || [];
  const note = summary?.selectedGrapheme
    ? `Repeated submitted swaps involving ${summary.selectedGrapheme}. Use this to spot what to teach next; it will not list every not-secure grapheme.`
    : "Repeated submitted swaps in pupils' spellings. Use this to spot what to teach next; it will not list every not-secure grapheme.";

  return `
    <section class="td-results-block td-results-block--soft">
      <div class="td-results-block-head">
        ${renderHeadingWithInfo("Common confusions", note, {
          tag: "h5",
          infoLabel: "About common confusions",
        })}
        <span class="td-pill">${escapeHtml(String(items.length))}</span>
      </div>
      ${
        items.length
          ? `
        <div class="td-confusion-list">
          ${items.map((item) => `
            <article class="td-confusion-item td-confusion-item--${escapeAttr(item.tone || "amber")}">
              <div class="td-confusion-item-head">
                <strong>${escapeHtml(item.label || "")}</strong>
                <span>${escapeHtml(`${item.attemptCount} submitted answer${item.attemptCount === 1 ? "" : "s"}`)}</span>
              </div>
              <p>${escapeHtml(item.note || "")}</p>
              ${
                item.wordSamples?.length
                  ? renderSummaryTokenRow(item.wordSamples, (word) => word, "td-confusion-word-row")
                  : ""
              }
              ${
                item.practiceWords?.length
                  ? `
                <div class="td-confusion-item-actions">
                  ${renderBuildTestButton({
                    action: "build-confusion-test",
                    tone: item.tone || "amber",
                    labelAttrName: "data-confusion-label",
                    labelAttrValue: item.label || "Common confusion",
                    targetsAttrName: "data-confusion-targets",
                    targets: item.pairTargets || [],
                    practiceWords: item.practiceWords || [],
                    scopeLabel: summary?.label || "",
                  })}
                </div>
              `
                  : ""
              }
            </article>
          `).join("")}
        </div>
      `
          : `
        <div class="td-empty td-empty--compact">
          <strong>No repeated submitted confusion pairs yet.</strong>
        </div>
      `
      }
    </section>
  `;
}

function renderRecentTrendSection(summary) {
  const trend = summary?.recentTrend || {};
  const points = trend?.points || [];
  const expectedBenchmark = trend?.expectedBenchmark || {
    label: "Expected benchmark coming soon",
    statusText: "Not enough data yet",
    note: "We need more app data across difficulty levels and question types before expected performance can be shown reliably.",
  };
  const trendInfo = [
    "Raw accuracy stays visible here so you can see whether recent performance is improving, steady, or dropping.",
    expectedBenchmark.note,
    getVisualTrendExplanation(trend?.dayCount || 0),
  ].filter(Boolean).join("\n");

  return `
    <section class="td-results-block td-results-block--soft">
      <div class="td-results-block-head">
        ${renderHeadingWithInfo("Progress Over Time", trendInfo, {
          tag: "h5",
          infoLabel: "About progress over time",
        })}
        <span class="td-trend-pill td-trend-pill--${escapeAttr(trend.tone || "neutral")}">${escapeHtml(trend.label || "Awaiting data")}</span>
      </div>
      ${
        points.length
          ? `
        ${renderVisualTrendSummary(trend)}
      `
          : `
        <div class="td-empty td-empty--compact">
          <strong>No recent activity yet.</strong>
        </div>
      `
      }
    </section>
  `;
}

function buildDenseAccuracyRanking(items, {
  checkedSelector = (item) => Number(item?.checkedWords || item?.attemptedWords || 0),
  accuracySelector = (item) => Number(item?.accuracy ?? item?.checkedAccuracy ?? 0),
  labelSelector = (item) => String(item?.label || item?.name || item?.className || ""),
  tieBreaker = null,
} = {}) {
  const prepared = [...(items || [])].map((item) => ({
    item,
    checked: Math.max(0, Number(checkedSelector(item) || 0)),
    accuracy: Math.max(0, Math.min(1, Number(accuracySelector(item) || 0))),
  }));

  prepared.sort((a, b) => {
    const aHasChecks = Number(a.checked > 0);
    const bHasChecks = Number(b.checked > 0);
    if (bHasChecks !== aHasChecks) return bHasChecks - aHasChecks;
    if (bHasChecks && b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    const nextTieBreak = typeof tieBreaker === "function" ? tieBreaker(a.item, b.item) : 0;
    if (nextTieBreak) return nextTieBreak;
    return labelSelector(a.item).localeCompare(labelSelector(b.item));
  });

  let lastAccuracy = null;
  let lastRank = 0;

  return prepared.map(({ item, checked, accuracy }, index) => {
    if (!checked) {
      return {
        ...item,
        performanceRank: null,
      };
    }

    if (lastAccuracy === null || accuracy !== lastAccuracy) {
      lastRank = index + 1;
      lastAccuracy = accuracy;
    }

    return {
      ...item,
      performanceRank: lastRank,
    };
  });
}

function getVisualClassRankingMode() {
  const current = String(state.visualAnalytics.classRankingMode || "accuracy");
  return VISUAL_CLASS_RANK_OPTIONS.some((item) => item.value === current)
    ? current
    : VISUAL_CLASS_RANK_OPTIONS[0].value;
}

function getVisualPupilRankingMode() {
  const current = String(state.visualAnalytics.pupilRankingMode || "accuracy");
  return VISUAL_PUPIL_RANK_OPTIONS.some((item) => item.value === current)
    ? current
    : VISUAL_PUPIL_RANK_OPTIONS[0].value;
}

function renderVisualSelectField({
  fieldName,
  idSuffix = "",
  label = "Rank by",
  value = "",
  options = [],
  dataAttributes = {},
}) {
  const selectId = `${fieldName}-${idSuffix || "current"}`;
  const extraAttributes = Object.entries(dataAttributes)
    .filter(([, itemValue]) => itemValue !== undefined && itemValue !== null)
    .map(([key, itemValue]) => ` data-${escapeAttr(key)}="${escapeAttr(String(itemValue))}"`)
    .join("");
  return `
    <div class="td-field td-field--compact td-field--rank-select">
      <label for="${escapeAttr(selectId)}">${escapeHtml(label)}</label>
      <select id="${escapeAttr(selectId)}" class="td-input" data-field="${escapeAttr(fieldName)}"${extraAttributes}>
        ${options.map((option) => `
          <option value="${escapeAttr(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>
            ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
    </div>
  `;
}

function renderVisualRankingControls({
  summary,
  modeFieldName,
  modeValue = "",
  modeOptions = [],
}) {
  const scopeType = String(summary?.scopeType || "overview");
  const scopeId = String(summary?.scopeId || "");
  const targetOptions = getVisualRankingTargetOptions(summary);
  const targetValue = getSelectedVisualRankingTarget(summary);
  const fields = [];

  if (targetOptions.length > 1) {
    fields.push(
      renderVisualSelectField({
        fieldName: "visual-ranking-target",
        idSuffix: `${scopeType}-${scopeId || "current"}-target`,
        label: "Who to rank",
        value: targetValue,
        options: targetOptions,
        dataAttributes: {
          "scope-type": scopeType,
          "scope-id": scopeId,
        },
      }),
    );
  }

  fields.push(
    renderVisualSelectField({
      fieldName: modeFieldName,
      idSuffix: `${scopeType}-${scopeId || "current"}-${modeFieldName}`,
      label: "Rank by",
      value: modeValue,
      options: modeOptions,
    }),
  );

  return `
    <div class="td-analytics-rank-controls">
      ${fields.join("")}
    </div>
  `;
}

function renderVisualRankingDisclosure(summary, target, totalRows, visibleRows, singularLabel, pluralLabel = `${singularLabel}s`) {
  const hiddenCount = Math.max(0, Number(totalRows || 0) - Number(visibleRows || 0));
  const nextCount = Math.min(hiddenCount, VISUAL_RANK_ROWS_STEP);
  const itemLabel = nextCount === 1 ? singularLabel : pluralLabel;
  const total = Math.max(0, Number(totalRows) || 0);

  if (hiddenCount > 0) {
    return `
      <div class="td-list-disclosure">
        <button
          class="td-inline-disclosure"
          type="button"
          data-action="show-more-visual-ranking"
          data-scope-type="${escapeAttr(summary?.scopeType || "overview")}"
          data-scope-id="${escapeAttr(summary?.scopeId || "")}"
          data-rank-target="${escapeAttr(target)}"
          data-total-rows="${escapeAttr(String(total))}"
        >
          <span>${escapeHtml(`Show ${nextCount} more ${itemLabel}`)}</span>
          <span class="td-inline-disclosure-chev">&#9662;</span>
        </button>
      </div>
    `;
  }

  if (total > VISUAL_RANK_ROWS_STEP) {
    return `
      <div class="td-list-disclosure">
        <button
          class="td-inline-disclosure"
          type="button"
          data-action="show-fewer-visual-ranking"
          data-scope-type="${escapeAttr(summary?.scopeType || "overview")}"
          data-scope-id="${escapeAttr(summary?.scopeId || "")}"
          data-rank-target="${escapeAttr(target)}"
        >
          <span>${escapeHtml(`Show fewer ${pluralLabel}`)}</span>
          <span class="td-inline-disclosure-chev is-open">&#9662;</span>
        </button>
      </div>
    `;
  }

  return "";
}

function getVisualClassRankingTitle(summary) {
  if (summary?.scopeType === "year_group") return `${summary.label || "This year"} class ranking`;
  if (summary?.scopeType === "compare") return `${summary.label || "This view"} class ranking`;
  return "Class ranking";
}

function getVisualPupilRankingTitle(summary) {
  if (summary?.scopeType === "year_group") return `${summary.label || "This year"} pupil ranking`;
  if (summary?.scopeType === "class") return `${summary.label || "This class"} pupil ranking`;
  if (summary?.scopeType === "compare") return `${summary.label || "This view"} pupil ranking`;
  return "Pupil ranking";
}

function buildDenseRankedRows(items, {
  isRanked = () => true,
  compareFn = () => 0,
  rankValueSelector = (item) => String(item?.id || item?.label || ""),
  labelSelector = (item) => String(item?.label || item?.name || item?.className || ""),
} = {}) {
  const rows = [...(items || [])].sort((a, b) => {
    const aCanRank = Number(isRanked(a));
    const bCanRank = Number(isRanked(b));
    if (bCanRank !== aCanRank) return bCanRank - aCanRank;
    const nextComparison = compareFn(a, b);
    if (nextComparison) return nextComparison;
    return labelSelector(a).localeCompare(labelSelector(b));
  });

  let lastRankKey = null;
  let lastRank = 0;

  return rows.map((item, index) => {
    if (!isRanked(item)) {
      return {
        ...item,
        performanceRank: null,
      };
    }

    const rawRankValue = rankValueSelector(item);
    const rankKey = Array.isArray(rawRankValue) ? rawRankValue.join("|") : String(rawRankValue);
    if (lastRankKey === null || rankKey !== lastRankKey) {
      lastRank = index + 1;
      lastRankKey = rankKey;
    }

    return {
      ...item,
      performanceRank: lastRank,
    };
  });
}

function getVisualPupilReviewPriorityScore(item) {
  const checkedWords = Math.max(0, Number(item?.checkedWords || 0));
  if (!checkedWords) return -1;
  const accuracy = Math.max(0, Math.min(1, Number(item?.accuracy || 0)));
  const averageAttempts = Math.max(0, Number(item?.averageAttempts || 0));
  return (
    Number(!!item?.needsIntervention) * 100 +
    (1 - accuracy) * 20 +
    averageAttempts * 5 +
    Math.min(checkedWords, 20) * 0.01
  );
}

function getVisualClassRankingConfig(mode = getVisualClassRankingMode()) {
  if (mode === "attainment") {
    return {
      infoText: "Highest average Spelling Attainment Indicator first. This uses the app's difficulty scale and averages pupils with response evidence in the current view.",
      metricHeader: "Attainment",
      evidenceHeader: "Checked",
      isRanked: (item) => item?.averageIndicatorScore != null,
      compareFn: (a, b) =>
        Number(b?.averageIndicatorScore || 0) - Number(a?.averageIndicatorScore || 0) ||
        Number(b?.checkedWords || 0) - Number(a?.checkedWords || 0) ||
        Number(b?.activePupilCount || 0) - Number(a?.activePupilCount || 0),
      rankValueSelector: (item) => Number(item?.averageIndicatorScore || 0).toFixed(3),
      metricText: (item) => item?.averageIndicatorScore == null ? "Awaiting evidence" : formatAverageIndicatorValue(item.averageIndicatorScore),
      evidenceText: (item) => `${item?.checkedWords || 0} checked`,
    };
  }

  if (mode === "participation") {
    return {
      infoText: "Highest share of active pupils first. This helps compare where pupils are contributing enough evidence.",
      metricHeader: "Participation",
      evidenceHeader: "Checked",
      isRanked: (item) => Number(item?.pupilCount || 0) > 0,
      compareFn: (a, b) =>
        Number(b?.participationRate || 0) - Number(a?.participationRate || 0) ||
        Number(b?.activePupilCount || 0) - Number(a?.activePupilCount || 0) ||
        Number(b?.checkedWords || 0) - Number(a?.checkedWords || 0),
      rankValueSelector: (item) => Number(item?.participationRate || 0).toFixed(6),
      metricText: (item) => `${item?.activePupilCount || 0}/${item?.pupilCount || 0} active`,
      evidenceText: (item) => `${item?.checkedWords || 0} checked`,
    };
  }

  if (mode === "fewest_attempts") {
    return {
      infoText: "Lowest average tries first, so classes needing fewer retries rise to the top.",
      metricHeader: "Avg tries",
      evidenceHeader: "Accuracy",
      isRanked: (item) => Number(item?.checkedWords || 0) > 0,
      compareFn: (a, b) =>
        Number(a?.averageAttempts || 0) - Number(b?.averageAttempts || 0) ||
        Number(b?.checkedWords || 0) - Number(a?.checkedWords || 0) ||
        Number(b?.accuracy || 0) - Number(a?.accuracy || 0),
      rankValueSelector: (item) => Number(item?.averageAttempts || 0).toFixed(6),
      metricText: (item) => item?.checkedWords ? `${formatOneDecimal(item.averageAttempts)} tries` : "No attempts",
      evidenceText: (item) => item?.checkedWords ? formatPercent(item.accuracy) : "No attempts",
    };
  }

  if (mode === "review") {
    return {
      infoText: "Classes with a higher share of pupils currently needing review appear first.",
      metricHeader: "Review",
      evidenceHeader: "Accuracy",
      isRanked: (item) => Number(item?.activePupilCount || 0) > 0,
      compareFn: (a, b) =>
        Number(b?.reviewRate || 0) - Number(a?.reviewRate || 0) ||
        Number(b?.interventionCount || 0) - Number(a?.interventionCount || 0) ||
        Number(a?.accuracy || 0) - Number(b?.accuracy || 0),
      rankValueSelector: (item) => [
        Number(item?.reviewRate || 0).toFixed(6),
        String(item?.interventionCount || 0),
      ],
      metricText: (item) => `${item?.interventionCount || 0} review`,
      evidenceText: (item) => item?.checkedWords ? formatPercent(item.accuracy) : "No attempts",
    };
  }

  return {
    infoText: "Highest latest checked-word accuracy first. Classes with no checked words stay at the bottom and remain unranked.",
    metricHeader: "Accuracy",
    evidenceHeader: "Checked",
    isRanked: (item) => Number(item?.checkedWords || 0) > 0,
    compareFn: (a, b) =>
      Number(b?.accuracy || 0) - Number(a?.accuracy || 0) ||
      Number(b?.checkedWords || 0) - Number(a?.checkedWords || 0) ||
      Number(b?.activePupilCount || 0) - Number(a?.activePupilCount || 0),
    rankValueSelector: (item) => Number(item?.accuracy || 0).toFixed(6),
    metricText: (item) => item?.checkedWords ? formatPercent(item.accuracy) : "No attempts",
    evidenceText: (item) => `${item?.checkedWords || 0} checked`,
  };
}

function getVisualPupilRankingConfig(mode = getVisualPupilRankingMode()) {
  if (mode === "attainment") {
    return {
      infoText: "Highest Spelling Attainment Indicator first. This uses the app's difficulty scale and compares pupils with response evidence in the current view.",
      metricHeader: "Attainment",
      evidenceHeader: "Evidence",
      isRanked: (item) => item?.attainmentIndicator?.score != null,
      compareFn: (a, b) =>
        Number(b?.attainmentIndicator?.score || 0) - Number(a?.attainmentIndicator?.score || 0) ||
        Number(b?.checkedWords || 0) - Number(a?.checkedWords || 0) ||
        Number(a?.averageAttempts || 0) - Number(b?.averageAttempts || 0),
      rankValueSelector: (item) => Number(item?.attainmentIndicator?.score || 0).toFixed(3),
      metricText: (item) => item?.attainmentIndicator?.score == null ? "Awaiting evidence" : formatAverageIndicatorValue(item.attainmentIndicator.score),
      evidenceText: (item) => item?.attainmentIndicator?.evidence?.label || (item?.checkedWords ? `${item.checkedWords} checked` : "No attempts"),
    };
  }

  if (mode === "fewest_attempts") {
    return {
      infoText: "Lowest average tries first, so pupils needing fewer retries rise to the top.",
      metricHeader: "Avg tries",
      evidenceHeader: "Accuracy",
      isRanked: (item) => Number(item?.checkedWords || 0) > 0,
      compareFn: (a, b) =>
        Number(a?.averageAttempts || 0) - Number(b?.averageAttempts || 0) ||
        Number(b?.checkedWords || 0) - Number(a?.checkedWords || 0) ||
        Number(b?.accuracy || 0) - Number(a?.accuracy || 0),
      rankValueSelector: (item) => Number(item?.averageAttempts || 0).toFixed(6),
      metricText: (item) => item?.checkedWords ? `${formatOneDecimal(item.averageAttempts)} tries` : "No attempts",
      evidenceText: (item) => item?.checkedWords ? formatPercent(item.accuracy) : "No attempts",
    };
  }

  if (mode === "review") {
    return {
      infoText: "Pupils with the strongest current review signal appear first.",
      metricHeader: "Signal",
      evidenceHeader: "Accuracy",
      isRanked: (item) => Number(item?.checkedWords || 0) > 0,
      compareFn: (a, b) =>
        getVisualPupilReviewPriorityScore(b) - getVisualPupilReviewPriorityScore(a) ||
        Number(b?.checkedWords || 0) - Number(a?.checkedWords || 0) ||
        Number(a?.accuracy || 0) - Number(b?.accuracy || 0),
      rankValueSelector: (item) => getVisualPupilReviewPriorityScore(item).toFixed(6),
      metricText: (item) => String(item?.signalLabel || "Developing"),
      evidenceText: (item) => item?.checkedWords ? formatPercent(item.accuracy) : "No attempts",
    };
  }

  if (mode === "checked_words") {
    return {
      infoText: "Pupils with the most checked words first. This helps you see who has the strongest evidence base.",
      metricHeader: "Checked",
      evidenceHeader: "Accuracy",
      isRanked: (item) => Number(item?.checkedWords || 0) > 0,
      compareFn: (a, b) =>
        Number(b?.checkedWords || 0) - Number(a?.checkedWords || 0) ||
        Number(b?.accuracy || 0) - Number(a?.accuracy || 0) ||
        Number(a?.averageAttempts || 0) - Number(b?.averageAttempts || 0),
      rankValueSelector: (item) => String(item?.checkedWords || 0),
      metricText: (item) => `${item?.checkedWords || 0} checked`,
      evidenceText: (item) => item?.checkedWords ? formatPercent(item.accuracy) : "No attempts",
    };
  }

  return {
    infoText: "Highest latest checked-word accuracy first. Pupils with no checked words stay at the bottom and remain unranked.",
    metricHeader: "Accuracy",
    evidenceHeader: "Checked",
    isRanked: (item) => Number(item?.checkedWords || 0) > 0,
    compareFn: (a, b) =>
      Number(b?.accuracy || 0) - Number(a?.accuracy || 0) ||
      Number(b?.checkedWords || 0) - Number(a?.checkedWords || 0) ||
      Number(a?.averageAttempts || 0) - Number(b?.averageAttempts || 0),
    rankValueSelector: (item) => Number(item?.accuracy || 0).toFixed(6),
    metricText: (item) => item?.checkedWords ? formatPercent(item.accuracy) : "No attempts",
    evidenceText: (item) => `${item?.checkedWords || 0} checked`,
  };
}

function renderVisualClassRankingSection(summary) {
  const mode = getVisualClassRankingMode();
  const config = getVisualClassRankingConfig(mode);
  const rows = buildDenseRankedRows(summary?.classRows || [], {
    isRanked: config.isRanked,
    compareFn: config.compareFn,
    rankValueSelector: config.rankValueSelector,
    labelSelector: (item) => String(item?.className || ""),
  });
  const visibleCount = getVisibleVisualRankingRowCount(summary, "classes", rows.length);
  const visibleRows = rows.slice(0, visibleCount);
  const title = getVisualClassRankingTitle(summary);
  const infoText = summary?.selectedGrapheme
    ? `${config.infoText}\nCurrent grapheme filter: ${summary.selectedGrapheme}.`
    : config.infoText;

  return `
    <section class="td-results-block td-results-block--wide">
      <div class="td-results-block-head">
        ${renderHeadingWithInfo(title, infoText, {
          tag: "h5",
          infoLabel: `About ${title.toLowerCase()}`,
        })}
        <span class="td-pill">${escapeHtml(String(rows.length))}</span>
      </div>
      ${renderVisualRankingControls({
        summary,
        modeFieldName: "visual-class-rank-mode",
        modeValue: mode,
        modeOptions: VISUAL_CLASS_RANK_OPTIONS,
      })}
      ${
        rows.length
          ? `
        <div class="td-analytics-rank-table">
          <div class="td-analytics-rank-head td-analytics-rank-head--class">
            <span>Rank</span>
            <span>Class</span>
            <span>${escapeHtml(config.metricHeader)}</span>
            <span>${escapeHtml(config.evidenceHeader)}</span>
          </div>
          ${visibleRows.map((item) => `
              <button
                type="button"
                class="td-analytics-rank-row td-analytics-rank-row--class ${item?.performanceRank ? "" : "is-muted"}"
                data-action="open-visual-summary"
                data-scope-type="class"
                data-scope-id="${escapeAttr(item?.classId || "")}"
              >
                <span class="td-analytics-rank-position">${escapeHtml(item?.performanceRank ? `#${item.performanceRank}` : "--")}</span>
                <span class="td-analytics-rank-main">
                  <strong>${escapeHtml(item?.className || "Class")}</strong>
                  <span>${escapeHtml(item?.yearGroup || "No year group")}</span>
                </span>
                <span class="td-analytics-rank-metric">${escapeHtml(config.metricText(item))}</span>
                <span class="td-analytics-rank-metric">${escapeHtml(config.evidenceText(item))}</span>
              </button>
          `).join("")}
        </div>
        ${renderVisualRankingDisclosure(summary, "classes", rows.length, visibleRows.length, "class", "classes")}
      `
          : `
        <div class="td-empty td-empty--compact">
          <strong>No classes in this view yet.</strong>
        </div>
      `
      }
    </section>
  `;
}

function renderVisualPupilRankingSection(summary) {
  const mode = getVisualPupilRankingMode();
  const config = getVisualPupilRankingConfig(mode);
  const rows = buildDenseRankedRows(summary?.pupilRows || [], {
    isRanked: config.isRanked,
    compareFn: config.compareFn,
    rankValueSelector: config.rankValueSelector,
    labelSelector: (item) => String(item?.name || ""),
  });
  const visibleCount = getVisibleVisualRankingRowCount(summary, "pupils", rows.length);
  const visibleRows = rows.slice(0, visibleCount);
  const title = getVisualPupilRankingTitle(summary);
  const infoText = summary?.selectedGrapheme
    ? `${config.infoText}\nCurrent grapheme filter: ${summary.selectedGrapheme}.`
    : config.infoText;

  return `
    <section class="td-results-block td-results-block--wide">
      <div class="td-results-block-head">
        ${renderHeadingWithInfo(title, infoText, {
          tag: "h5",
          infoLabel: "About pupil ranking",
        })}
        <span class="td-pill">${escapeHtml(String(rows.length))}</span>
      </div>
      ${renderVisualRankingControls({
        summary,
        modeFieldName: "visual-pupil-rank-mode",
        modeValue: mode,
        modeOptions: VISUAL_PUPIL_RANK_OPTIONS,
      })}
      ${
        rows.length
          ? `
        <div class="td-analytics-rank-table">
          <div class="td-analytics-rank-head td-analytics-rank-head--pupil">
            <span>Rank</span>
            <span>Pupil</span>
            <span>${escapeHtml(config.metricHeader)}</span>
            <span>${escapeHtml(config.evidenceHeader)}</span>
          </div>
          ${visibleRows.map((item) => {
            const signal = {
              tone: item?.signalTone || "amber",
              label: item?.signalLabel || "Developing",
            };
            const statusMeta = getVisualPupilStatusMeta(item);
            return `
              <button
                type="button"
                class="td-analytics-rank-row td-analytics-rank-row--pupil td-analytics-rank-row--${escapeAttr(statusMeta.key)} ${item?.performanceRank ? "" : "is-muted"}"
                data-action="open-visual-summary"
                data-scope-type="pupil"
                data-scope-id="${escapeAttr(item?.pupilId || "")}"
              >
                <span class="td-analytics-rank-position">${escapeHtml(item?.performanceRank ? `#${item.performanceRank}` : "--")}</span>
                <span class="td-analytics-rank-main">
                  <span class="td-analytics-rank-main-top">
                    <strong>${escapeHtml(item?.name || "Pupil")}</strong>
                    ${renderPupilSignalBadge(signal, { title: `${item?.name || "Pupil"}: ${signal.label}` })}
                  </span>
                  <span>${escapeHtml(item?.checkedWords ? `Last active ${item?.latestActivity ? formatDate(item.latestActivity) : "--"}` : "Awaiting checks")}</span>
                </span>
                <span class="td-analytics-rank-metric">${escapeHtml(config.metricText(item))}</span>
                <span class="td-analytics-rank-metric">${escapeHtml(config.evidenceText(item))}</span>
              </button>
            `;
          }).join("")}
        </div>
        ${renderVisualRankingDisclosure(summary, "pupils", rows.length, visibleRows.length, "pupil", "pupils")}
      `
          : `
        <div class="td-empty td-empty--compact">
          <strong>No pupils in this view yet.</strong>
        </div>
      `
      }
    </section>
  `;
}

function buildVisualPupilPerformanceCards(summary) {
  const viewModel = getVisualAnalyticsViewModel();
  const pupilSummaries = (viewModel?.sourceData?.pupils || [])
    .map((item) => viewModel.summaries?.[createVisualScopeKey("pupil", item?.id)])
    .filter(Boolean);
  const currentScopeId = String(summary?.scopeId || "");
  const primaryYearGroup = String(summary?.primaryYearGroup || "").trim();
  const trendMeta = getContextRankTrendMeta(summary);

  const buildCard = (label, items, emptyText) => {
    const ranked = buildDenseRankedRows(items, {
      isRanked: (item) => item?.averageIndicatorScore != null,
      compareFn: (a, b) =>
        Number(b?.averageIndicatorScore || 0) - Number(a?.averageIndicatorScore || 0) ||
        Number(b?.checkedWords || 0) - Number(a?.checkedWords || 0) ||
        String(a?.label || "").localeCompare(String(b?.label || "")),
      rankValueSelector: (item) => Number(item?.averageIndicatorScore || 0).toFixed(3),
      labelSelector: (item) => String(item?.label || ""),
    });
    const rankedCount = ranked.filter((item) => item?.performanceRank !== null).length;
    const current = ranked.find((item) => String(item?.scopeId || "") === currentScopeId) || null;
    const hasRank = current?.performanceRank != null;

    return {
      label,
      value: hasRank ? `#${current.performanceRank} of ${rankedCount}` : "Not ranked yet",
      note: summary?.checkedWords
        ? rankedCount
          ? emptyText(rankedCount)
          : `No ${String(label || "group").toLowerCase()} ranks yet.`
        : "No checked words in this view yet.",
      trendMeta,
    };
  };

  const cards = [];
  if (primaryYearGroup) {
    cards.push(buildCard(
      primaryYearGroup,
      pupilSummaries.filter((item) => (item?.yearGroups || []).includes(primaryYearGroup)),
      (count) => `Compared with ${count} pupil${count === 1 ? "" : "s"} in ${primaryYearGroup} with data.`,
    ));
  }
  cards.push(buildCard(
    "School",
    pupilSummaries,
    (count) => `Compared with ${count} pupil${count === 1 ? "" : "s"} across school with data.`,
  ));

  return cards;
}

function getContextRankTrendMeta(summary) {
  const trend = summary?.recentTrend || {};
  const direction = String(trend?.direction || "flat");
  const dayCount = Math.max(0, Number(trend?.dayCount || 0));

  if (!summary?.checkedWords || dayCount < 2) {
    return {
      tone: "slate",
      label: "Awaiting data",
      iconHtml: "&rarr;",
      title: "Not enough recent activity yet to compare earlier and recent performance.",
    };
  }

  if (direction === "up" || String(trend?.tone || "") === "green") {
    return {
      tone: "green",
      label: String(trend?.label || "Improving"),
      iconHtml: "&uarr;",
      title: String(trend?.summaryText || "Recent performance is improving."),
    };
  }

  if (direction === "down" || String(trend?.tone || "") === "red") {
    return {
      tone: "red",
      label: String(trend?.label || "Declining"),
      iconHtml: "&darr;",
      title: String(trend?.summaryText || "Recent performance is declining."),
    };
  }

  return {
    tone: "amber",
    label: String(trend?.label || "Steady"),
    iconHtml: "&rarr;",
    title: String(trend?.summaryText || "Recent performance is holding steady."),
  };
}

function renderVisualPupilPerformanceContextSection(summary) {
  const cards = buildVisualPupilPerformanceCards(summary);
  const infoText = "Ranks are based on the Spelling Attainment Indicator in the current view. If a grapheme filter is active, the rank reflects that filter too. The arrow chip shows whether recent performance is improving, steady, or dropping.";

  return `
    <section class="td-results-block td-results-block--soft td-results-block--wide">
      <div class="td-results-block-head">
        ${renderHeadingWithInfo("Performance in context", infoText, {
          tag: "h5",
          infoLabel: "About performance in context",
        })}
      </div>
      ${
        cards.length
          ? `
        <div class="td-context-rank-grid">
          ${cards.map((item) => `
            <article class="td-context-rank-card td-context-rank-card--${escapeAttr(item?.trendMeta?.tone || "slate")}">
              <div class="td-context-rank-card-head">
                <span class="td-context-rank-card-label">${escapeHtml(item.label)}</span>
                ${item.note
                  ? renderInfoTip(item.note, {
                      label: `About ${item.label || "this comparison"}`,
                      align: "end",
                    })
                  : ""}
              </div>
              <strong>${escapeHtml(item.value)}</strong>
              <div
                class="td-context-rank-chip td-context-rank-chip--${escapeAttr(item?.trendMeta?.tone || "slate")}"
                title="${escapeAttr(item?.trendMeta?.title || "")}"
                aria-label="${escapeAttr(item?.trendMeta?.title || item?.trendMeta?.label || "")}"
              >
                <span class="td-context-rank-chip-content">
                  <span class="td-context-rank-chip-icon" aria-hidden="true">${item?.trendMeta?.iconHtml || "&rarr;"}</span>
                  <span class="td-context-rank-chip-label">${escapeHtml(item?.trendMeta?.label || "Awaiting data")}</span>
                </span>
              </div>
            </article>
          `).join("")}
        </div>
      `
          : `
        <div class="td-empty td-empty--compact">
          <strong>No comparison ranks available yet.</strong>
        </div>
      `
      }
    </section>
  `;
}

function renderVisualPupilRecentAssignmentSection(summary) {
  const data = state.visualAnalytics.sourceData;
  const assignments = getVisualSummaryAssignmentOptions(summary);
  const selectedAssignmentId = getSelectedVisualSummaryAssignmentId(summary, assignments);
  const analyticsState = selectedAssignmentId ? state.analyticsByAssignment[selectedAssignmentId] : null;
  const analytics = analyticsState?.status === "ready" ? analyticsState.data?.current : null;
  const pupilRow = analytics?.pupilRows?.find((item) => String(item?.pupilId || "") === String(summary?.scopeId || "")) || null;
  const assignmentSelectId = `visual-pupil-assignment-${String(summary?.scopeId || "current")}`;
  const infoText = summary?.selectedGrapheme
    ? "This shows the chosen assignment exactly as it was set for the pupil, using the same results table as upcoming assignments. It is not limited to the current grapheme filter."
    : "The most recent relevant assignment is selected by default. Use the dropdown to revisit earlier tests for this pupil in the same results table used for upcoming assignments.";

  return `
    <section class="td-results-block td-results-block--soft td-results-block--wide">
      <div class="td-results-block-head">
        ${renderHeadingWithInfo("Recent test results", infoText, {
          tag: "h5",
          infoLabel: "About recent test results",
        })}
      </div>
      ${
        !assignments.length
          ? `
        <div class="td-empty td-empty--compact">
          <strong>No recent assignments found for this pupil.</strong>
        </div>
      `
          : `
        <div class="td-field td-field--compact td-field--results-select td-field--results-select-wide">
          <select
            id="${escapeAttr(assignmentSelectId)}"
            class="td-input"
            data-field="visual-pupil-assignment"
            data-scope-type="${escapeAttr(summary?.scopeType || "pupil")}"
            data-scope-id="${escapeAttr(summary?.scopeId || "")}"
          >
            ${assignments.map((item) => {
              const optionClassName = data?.classById?.get(String(item?.class_id || ""))?.name || "Class";
              const optionLabel = `${item?.tests?.title || "Untitled test"} (${optionClassName} | ${getAssignmentReferenceLabel(item)})`;
              return `
                <option value="${escapeAttr(item?.id || "")}" ${String(item?.id || "") === selectedAssignmentId ? "selected" : ""}>
                  ${escapeHtml(optionLabel)}
                </option>
              `;
            }).join("")}
          </select>
        </div>
        ${
          !analyticsState || analyticsState.status === "loading"
            ? `
          <div class="td-empty td-empty--compact">
            <strong>Loading assignment results...</strong>
          </div>
        `
            : analyticsState.status === "error"
              ? `
          <div class="td-empty td-empty--compact">
            <strong>Could not load this assignment.</strong>
            <p>${escapeHtml(analyticsState.message || "Please try again.")}</p>
          </div>
        `
              : pupilRow
                ? `
          <div class="td-class-results-selected">
            ${renderAssignmentResultsTable(analytics, {
              visiblePupilIds: [summary?.scopeId || ""],
            })}
          </div>
        `
                : `
          <div class="td-empty td-empty--compact">
            <strong>No pupil-level results found for this assignment.</strong>
          </div>
        `
        }
      `
      }
    </section>
  `;
}

function renderVisualBottomSection(summary) {
  if (!summary) return "";
  const rankingTarget = getSelectedVisualRankingTarget(summary);

  if (summary.scopeType === "pupil") {
    return `
      <div class="td-results-grid td-results-grid--analytics td-results-grid--stacked">
        ${renderVisualPupilPerformanceContextSection(summary)}
        ${renderVisualPupilRecentAssignmentSection(summary)}
      </div>
    `;
  }

  if (summary.scopeType === "class") {
    return `
      <div class="td-results-grid td-results-grid--analytics td-results-grid--stacked">
        ${renderVisualPupilRankingSection(summary)}
      </div>
    `;
  }

  if (summary.scopeType === "overview" || summary.scopeType === "year_group" || summary.scopeType === "compare") {
    return `
      <div class="td-results-grid td-results-grid--analytics td-results-grid--stacked">
        ${rankingTarget === "pupils" ? renderVisualPupilRankingSection(summary) : renderVisualClassRankingSection(summary)}
      </div>
    `;
  }

  return "";
}

function renderVisualInsightSection(summary) {
  return `
    <div class="td-results-grid td-results-grid--analytics">
      ${renderCommonConfusionsSection(summary)}
      ${renderRecentTrendSection(summary)}
    </div>
    ${renderVisualBottomSection(summary)}
  `;
}

function buildAssignmentWordBuckets(wordResults) {
  const items = Array.isArray(wordResults) ? wordResults : [];
  const totalWords = items.length;
  const notStartedItems = items.filter((item) => item.statusKey === "not_started");
  const buckets = VISUAL_STATUS_FILTER_OPTIONS.map((option) => {
    const bucketItems = items.filter((item) => item.statusKey === option.key);
    return {
      ...option,
      items: bucketItems,
      count: bucketItems.length,
      percent: totalWords ? bucketItems.length / totalWords : 0,
      totalWords,
    };
  });

  return {
    totalWords,
    notStartedItems,
    buckets,
  };
}

function renderAssignmentPupilWordSummary(pupilRow) {
  const { totalWords, notStartedItems, buckets } = buildAssignmentWordBuckets(pupilRow?.wordResults || []);
  const indicator = pupilRow?.attainmentIndicator;
  const levelText = getIndicatorLevelText(indicator);
  const performanceText = getIndicatorPerformanceText(indicator);
  const indicatorMetricSummary = indicator?.score == null
    ? escapeHtml("Awaiting enough responses")
    : buildTeacherIndicatorMetricPartsHtml(indicator, "teacher", { includeRange: true });
  const supportingLine = [
    indicator?.secureDifficultyScore == null ? "" : escapeHtml(`Secure difficulty ${formatSecureDifficultyScore(indicator.secureDifficultyScore)}`),
    getIndicatorNextDescriptorText(indicator) ? escapeHtml(getIndicatorNextDescriptorText(indicator)) : "",
  ].filter(Boolean).join('<span class="td-attainment-inline-separator" aria-hidden="true">|</span>');
  const indicatorSummary = indicator?.score == null
    ? "Awaiting enough responses"
    : indicator?.scoreRange
      ? `Indicator ${indicator.score} • ${indicator.scoreRange.lower}-${indicator.scoreRange.upper} • ${indicator.evidence?.label || "Evidence pending"}`
      : `Indicator ${indicator.score} • ${indicator.evidence?.label || "Evidence pending"}`;

  return `
    <div class="td-pupil-word-summary">
      <div class="td-pupil-indicator-card">
        <div class="td-pupil-indicator-head">
          <strong>Current spelling level</strong>
          <span>${escapeHtml(indicator?.score == null ? "—" : String(indicator.score))}</span>
        </div>
        ${buildTeacherAttainmentCardBodyHtml({
          levelText,
          levelTooltip: indicator?.levelDefinitionTeacher || getLevelDefinition(indicator?.attainmentBand?.key || "not_yet_banded", "teacher"),
          performanceText,
          performanceTooltip: indicator?.performanceDefinitionTeacher || getPerformanceDefinition(indicator?.performanceKey || "building_profile", "teacher"),
          metaLines: [
            indicatorMetricSummary,
            supportingLine,
          ],
        })}
      </div>
      <p class="td-accuracy-section-note">
        ${escapeHtml(
          totalWords
            ? `${totalWords} word${totalWords === 1 ? "" : "s"} in this assignment.${notStartedItems.length ? ` ${notStartedItems.length} not yet attempted.` : ""}`
            : "No words available for this assignment."
        )}
      </p>
      <div class="td-accuracy-band-grid">
        ${buckets.map((bucket) => `
          <article class="td-accuracy-band-card td-accuracy-band-card--${escapeAttr(bucket.tone)}">
            <div class="td-accuracy-band-meter" aria-hidden="true">
              <span style="width:${bucket.percent > 0 ? Math.max(8, Math.round(bucket.percent * 100)) : 0}%;"></span>
            </div>
            <div class="td-accuracy-band-head">
              <strong>${escapeHtml(bucket.label)}</strong>
              <span>${escapeHtml(formatPercent(bucket.percent))}</span>
            </div>
            <div class="td-accuracy-band-sub">
              ${escapeHtml(`${bucket.count} of ${bucket.totalWords} words`)}
            </div>
            ${
              bucket.items.length
                ? renderSummaryTokenRow(bucket.items, (item) => item?.word || "")
                : `<p class="td-accuracy-band-empty">No words here.</p>`
            }
          </article>
        `).join("")}
      </div>
      ${
        notStartedItems.length
          ? `
        <div class="td-assignment-word-footer">
          <span>Not yet attempted</span>
          ${renderSummaryTokenRow(notStartedItems, (item) => item?.word || "")}
        </div>
      `
          : ""
      }
    </div>
  `;
}

function renderAssignmentStatusDot(result) {
  const statusKey = String(result?.statusKey || "not_started");
  const label = String(result?.title || result?.statusLabel || "No result");
  const isTargeted = !!result?.isTargeted;
  const rawShortLabel = String(
    result?.shortLabel ||
    result?.statusShortLabel ||
    (statusKey === "secure"
      ? "1"
      : statusKey === "developing"
        ? "2"
        : statusKey === "needs_review"
          ? "x"
          : "-")
  );
  const shortLabel = rawShortLabel === "â€”" || rawShortLabel === "—"
    ? "-"
    : rawShortLabel;
  return `
    <span class="td-status-dot td-status-dot--${escapeAttr(statusKey)} ${isTargeted ? "td-status-dot--targeted" : ""}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">
      <span aria-hidden="true">${escapeHtml(shortLabel)}</span>
      <span class="sr-only">${escapeHtml(label)}</span>
    </span>
  `;
}

function buildAssignmentMatrixRows(pupilRows) {
  const sortedRows = [...(pupilRows || [])]
    .map((pupil) => ({
      ...pupil,
      attemptedWords: Math.max(0, Number(pupil?.attemptedWords || 0)),
      correctWords: Math.max(0, Number(pupil?.correctWords || 0)),
      totalWords: Math.max(0, Number(pupil?.totalWords || 0)),
      checkedAccuracy: Math.max(0, Number(pupil?.checkedAccuracy || 0)),
    }))
    .sort((a, b) => {
      const aHasChecks = Number(a.attemptedWords > 0);
      const bHasChecks = Number(b.attemptedWords > 0);
      if (bHasChecks !== aHasChecks) return bHasChecks - aHasChecks;
      if (b.checkedAccuracy !== a.checkedAccuracy) return b.checkedAccuracy - a.checkedAccuracy;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  let lastAccuracy = null;
  let lastRank = 0;

  return sortedRows.map((pupil, index) => {
    if (!pupil.attemptedWords) {
      return {
        ...pupil,
        accuracyRank: null,
      };
    }

    if (lastAccuracy === null || pupil.checkedAccuracy !== lastAccuracy) {
      lastRank = index + 1;
      lastAccuracy = pupil.checkedAccuracy;
    }

    return {
      ...pupil,
      accuracyRank: lastRank,
    };
  });
}

function renderAssignmentTargetsPopover(pupil) {
  const targets = Array.isArray(pupil?.targetWords) ? pupil.targetWords : [];
  if (!targets.length) {
    return `<span class="td-target-summary td-target-summary--empty">-</span>`;
  }

  const attemptedCount = targets.filter((target) => target?.statusKey !== "not_started").length;
  const secureCount = targets.filter((target) => target?.statusKey === "secure").length;
  const summaryLabel = `${targets.length} target${targets.length === 1 ? "" : "s"}`;
  const summaryParts = [
    summaryLabel,
    `${attemptedCount} done`,
    `${secureCount} secure`,
  ];

  return `
    <details class="td-target-popover">
      <summary class="td-target-popover-trigger" aria-label="${escapeAttr(`Show target words for ${pupil?.name || "this pupil"}`)}">
        <span class="td-target-summary-chip">${escapeHtml(summaryLabel)}</span>
        <span class="td-target-summary-meta">${escapeHtml(summaryParts.slice(1).join(" | "))}</span>
      </summary>
      <div class="td-target-popover-card" role="note">
        <div class="td-target-popover-head">
          <strong>${escapeHtml(pupil?.name || "Pupil")}</strong>
          <span>${escapeHtml(summaryParts.join(" | "))}</span>
        </div>
        <table class="td-target-mini-table">
          <colgroup>
            <col class="td-target-mini-table-col-word">
            <col class="td-target-mini-table-col-why">
            <col class="td-target-mini-table-col-now">
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Word</th>
              <th scope="col">Why</th>
              <th scope="col">Now</th>
            </tr>
          </thead>
          <tbody>
            ${targets.map((target) => `
              <tr>
                <th scope="row"><span class="td-target-mini-word">${escapeHtml(target.word || "Word")}</span></th>
                <td><span class="td-target-mini-why">${escapeHtml(describeAssignmentTargetReason(target))}</span></td>
                <td>
                  <div class="td-target-mini-status-cell">
                    <span class="td-target-mini-status">
                      ${renderAssignmentStatusDot({
                        statusKey: target?.statusKey,
                        title: target?.title,
                        shortLabel: target?.statusShortLabel,
                      })}
                      <span>${escapeHtml(target?.attemptSummary || target?.statusLabel || "No result")}</span>
                    </span>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function renderAssignmentResultsMatrix(analytics, options = {}) {
  const wordColumns = analytics?.wordColumns || [];
  const pupilRows = analytics?.pupilRows || [];
  const highlightedPupilId = String(options?.highlightedPupilId || "");
  const visiblePupilIds = Array.isArray(options?.visiblePupilIds)
    ? new Set(options.visiblePupilIds.map((value) => String(value || "")).filter(Boolean))
    : null;
  const matrixRows = buildAssignmentMatrixRows(pupilRows)
    .filter((pupil) => !visiblePupilIds || visiblePupilIds.has(String(pupil?.pupilId || "")));

  if (!wordColumns.length || !matrixRows.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No assignment data to show yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-assignment-matrix-shell">
      <div class="td-assignment-matrix-legend">
        <span>${renderAssignmentStatusDot({ statusKey: "needs_review", title: "Not correct yet", shortLabel: "x" })} Not correct yet</span>
        <span>${renderAssignmentStatusDot({ statusKey: "developing", title: "Correct after retry", shortLabel: "2" })} Correct after retry</span>
        <span>${renderAssignmentStatusDot({ statusKey: "secure", title: "Correct first go", shortLabel: "1" })} Correct first go</span>
        <span>${renderAssignmentStatusDot({ statusKey: "not_started", title: "Not attempted", shortLabel: "-" })} Not attempted</span>
      </div>
      ${renderSyncedScrollShell(`
        <table class="td-assignment-matrix">
          <thead>
            <tr>
              <th scope="col">Pupil</th>
              <th scope="col" class="td-assignment-matrix-col-rank">Rank</th>
              <th scope="col" class="td-assignment-matrix-col-accuracy">Accuracy</th>
              <th scope="col" class="td-assignment-matrix-col-outof">Out of</th>
              <th scope="col" class="td-assignment-matrix-col-targets">Targets</th>
              ${wordColumns.map((word) => `<th scope="col">${escapeHtml(word.word || "Word")}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${matrixRows.map((pupil) => {
              const hasChecks = Number(pupil?.attemptedWords || 0) > 0;
              const isHighlighted = highlightedPupilId && String(pupil?.pupilId || "") === highlightedPupilId;
              const pupilName = String(pupil?.name || "Pupil");
              const pupilId = String(pupil?.pupilId || "");
              const rankValue = hasChecks ? String(pupil?.accuracyRank || "") : "--";
              const accuracyValue = hasChecks ? formatPercent(pupil?.checkedAccuracy || 0) : "--";
              const outOfValue = `${Math.max(0, Number(pupil?.correctWords || 0))}/${Math.max(0, Number(pupil?.totalWords || 0))}`;
              const outOfTitle = hasChecks
                ? `${pupil.correctWords} of ${pupil.totalWords} words correct so far.${pupil.attemptedWords < pupil.totalWords ? ` ${pupil.attemptedWords} checked.` : ""}`
                : `0 of ${pupil.totalWords} words correct so far.`;
              const pupilLabel = escapeHtml(pupilName);
              const pupilCell = pupilId
                ? `
                  <button
                    type="button"
                    class="td-assignment-matrix-pupil-link"
                    data-action="open-visual-summary"
                    data-scope-type="pupil"
                    data-scope-id="${escapeAttr(pupilId)}"
                    title="${escapeAttr(`Open pupil analytics for ${pupilName}`)}"
                    aria-label="${escapeAttr(`Open pupil analytics for ${pupilName}`)}"
                  >
                    ${pupilLabel}
                  </button>
                `
                : pupilLabel;
              return `
              <tr class="${isHighlighted ? "td-assignment-matrix-row--highlight" : ""}">
                <th scope="row">${pupilCell}</th>
                <td class="td-assignment-matrix-cell--metric ${hasChecks ? "" : "is-muted"}" title="${escapeAttr(hasChecks ? `Accuracy rank based on ${accuracyValue} checked-word accuracy.` : "No checked words yet.")}">
                  ${escapeHtml(rankValue)}
                </td>
                <td class="td-assignment-matrix-cell--metric ${hasChecks ? "" : "is-muted"}" title="${escapeAttr(hasChecks ? `${pupil.correctWords}/${pupil.attemptedWords} latest checked words correct.` : "No checked words yet.")}">
                  ${escapeHtml(accuracyValue)}
                </td>
                <td class="td-assignment-matrix-cell--metric" title="${escapeAttr(outOfTitle)}">
                  ${escapeHtml(outOfValue)}
                </td>
                <td class="td-assignment-matrix-cell--targets">
                  ${renderAssignmentTargetsPopover(pupil)}
                </td>
                ${(pupil.wordResults || []).map((result) => `
                  <td>${renderAssignmentStatusDot(result)}</td>
                `).join("")}
              </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `, {
        shellClassName: "td-assignment-matrix-scroll-shell",
        viewportClassName: "td-assignment-matrix-wrap",
      })}
    </div>
  `;
}

function renderGeneratedAssignmentResults(analytics, options = {}) {
  const highlightedPupilId = String(options?.highlightedPupilId || "");
  const visiblePupilIds = Array.isArray(options?.visiblePupilIds)
    ? new Set(options.visiblePupilIds.map((value) => String(value || "")).filter(Boolean))
    : null;
  const rows = buildAssignmentMatrixRows(analytics?.pupilRows || [])
    .filter((pupil) => !visiblePupilIds || visiblePupilIds.has(String(pupil?.pupilId || "")));

  if (!rows.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No assignment data to show yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-generated-results-shell">
      ${rows.map((pupil) => {
        const pupilId = String(pupil?.pupilId || "");
        const isHighlighted = highlightedPupilId && pupilId === highlightedPupilId;
        const sections = Array.isArray(pupil?.generatedSections) ? pupil.generatedSections : [];
        const nameHtml = pupilId
          ? `
            <button
              type="button"
              class="td-assignment-matrix-pupil-link"
              data-action="open-visual-summary"
              data-scope-type="pupil"
              data-scope-id="${escapeAttr(pupilId)}"
              title="${escapeAttr(`Open pupil analytics for ${pupil?.name || "this pupil"}`)}"
              aria-label="${escapeAttr(`Open pupil analytics for ${pupil?.name || "this pupil"}`)}"
            >
              ${escapeHtml(pupil?.name || "Pupil")}
            </button>
          `
          : `<strong>${escapeHtml(pupil?.name || "Pupil")}</strong>`;

        return `
          <article class="td-generated-results-card ${isHighlighted ? "td-generated-results-card--highlight" : ""}">
            <div class="td-generated-results-head">
              <div>
                ${nameHtml}
                <div class="td-generated-results-metrics">
                  <span>${escapeHtml(`Accuracy ${formatPercent(pupil?.checkedAccuracy || 0)}`)}</span>
                  <span>${escapeHtml(`Out of ${Math.max(0, Number(pupil?.correctWords || 0))}/${Math.max(0, Number(pupil?.totalWords || 0))}`)}</span>
                  <span>${escapeHtml(`Avg tries ${formatOneDecimal(pupil?.averageAttempts || 0)}`)}</span>
                </div>
              </div>
              ${renderPupilSignalBadge({ tone: pupil?.signalTone, label: pupil?.signalLabel })}
            </div>
            <div class="td-generated-results-sections">
              ${sections.map((section) => `
                <section class="td-generated-results-section">
                  <div class="td-generated-results-section-head">
                    <strong>${escapeHtml(section.label)}</strong>
                    <span>${escapeHtml(String(section.items.length))}</span>
                  </div>
                  <div class="td-generated-results-items">
                    ${section.items.map((item) => `
                      <div class="td-generated-results-item">
                        <div class="td-generated-results-item-main">
                          <span class="td-generated-results-word">${escapeHtml(item?.word || "Word")}</span>
                          <span class="td-generated-results-note">${escapeHtml(describeAssignmentTargetReason(item))}</span>
                        </div>
                        <div class="td-generated-results-item-meta">
                          <span class="td-generated-results-tag">${escapeHtml(getAssignmentSupportLabel(item?.assignmentSupport || "independent"))}</span>
                          ${renderAssignmentStatusDot(item)}
                        </div>
                      </div>
                    `).join("")}
                  </div>
                </section>
              `).join("")}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderAssignmentResultsTable(analytics, options = {}) {
  if (analytics?.isGenerated) {
    return renderGeneratedAssignmentResults(analytics, options);
  }
  return renderAssignmentResultsMatrix(analytics, options);
}

function renderAnalyticsMetricCard(icon, label, value, { className = "", showLeadingIcon = true } = {}) {
  const cardClassName = ["td-analytics-summary-card", className].filter(Boolean).join(" ");
  return `
    <article class="${cardClassName}">
      <div class="td-analytics-summary-label td-analytics-summary-label--rich">
        ${showLeadingIcon ? renderIconOnly(icon, label) : ""}
        <span>${escapeHtml(label)}</span>
      </div>
      <div class="td-analytics-summary-value">${escapeHtml(String(value))}</div>
    </article>
  `;
}

function renderAnalyticsMetricCardWithInfo(
  icon,
  label,
  value,
  infoText,
  subtext = "",
  {
    className = "",
    showLeadingIcon = true,
    infoHtml = "",
    secondaryValue = "",
    valueHtml = "",
    secondaryValueHtml = "",
    subtextHtml = "",
    bodyHtml = "",
  } = {},
) {
  const cardClassName = ["td-analytics-summary-card", className].filter(Boolean).join(" ");
  return `
    <article class="${cardClassName}">
      <div class="td-analytics-summary-label td-analytics-summary-label--rich">
        ${showLeadingIcon ? renderIconOnly(icon, label) : ""}
        <span>${escapeHtml(label)}</span>
        ${infoText || infoHtml ? renderInfoTip(infoText, {
          label: `About ${label}`,
          align: "start",
          html: infoHtml,
        }) : ""}
      </div>
      ${bodyHtml || `
      <div class="td-analytics-summary-value">${valueHtml || escapeHtml(String(value))}</div>
      ${secondaryValueHtml ? `<div class="td-analytics-summary-secondary">${secondaryValueHtml}</div>` : secondaryValue ? `<div class="td-analytics-summary-secondary">${escapeHtml(String(secondaryValue))}</div>` : ""}
      ${subtextHtml ? `<div class="td-analytics-summary-sub">${subtextHtml}</div>` : subtext ? `<div class="td-analytics-summary-sub">${escapeHtml(subtext)}</div>` : ""}
      `}
    </article>
  `;
}

function renderInfoTipParagraphHtml(text, className = "uiInfoTipBody") {
  const value = String(text || "").trim();
  if (!value) return "";
  return `<p class="${escapeAttr(className)}">${escapeHtml(value)}</p>`;
}

function renderAttainmentInlineInfoTip(
  value,
  tooltipText,
  label,
  {
    triggerHtml = "",
    className = "",
    triggerClassName = "",
    bubbleClassName = "",
    align = "start",
  } = {},
) {
  const displayValue = String(value || "").trim();
  if (!displayValue) return "";
  if (!tooltipText) return escapeHtml(displayValue);
  return renderInfoTip(tooltipText, {
    label,
    className: ["uiInfoTip--text", "td-attainment-inline-tip", className].filter(Boolean).join(" "),
    triggerClassName: ["uiInfoTipTrigger--text", "td-attainment-inline-tip-trigger", triggerClassName].filter(Boolean).join(" "),
    bubbleClassName: ["td-attainment-inline-tip-bubble", bubbleClassName].filter(Boolean).join(" "),
    align,
    triggerHtml: triggerHtml || `<span class="uiInfoTipTriggerText">${escapeHtml(displayValue)}</span>`,
    showIcon: false,
  });
}

function getAttainmentDefinitionContext(scopeType) {
  return scopeType === "pupil" ? "teacher" : "group";
}

function renderAttainmentDescriptorList(keys, getLabel, getDefinition, context) {
  return `
    <div class="td-attainment-reference-list">
      ${keys.map((key) => `
        <div class="td-attainment-reference">
          <span>${escapeHtml(getLabel(key))}</span>
          <small>${escapeHtml(getDefinition(key, context))}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function buildAttainmentGuideInfoHtml(...details) {
  return [
    renderInfoTipParagraphHtml("This shows current spelling level based on how well words of different difficulty are being spelt."),
    renderInfoTipParagraphHtml("Level = what difficulty can currently be handled", "uiInfoTipMeta"),
    renderInfoTipParagraphHtml("Performance = how consistently it is being spelt correctly", "uiInfoTipMeta"),
    renderInfoTipParagraphHtml("SAI = the underlying score used to calculate the level", "uiInfoTipMeta"),
    '<button type="button" class="uiInfoTipLink" data-action="open-attainment-guide">Read more</button>',
  ].join("");
}

function getVisualSummaryMetricInfoText(metric, summary) {
  const normalized = normalizeStandardMetricKey(metric);

  if (normalized === "attainment") {
    return `${getStandardMetricLabel(normalized)} shows the current spelling level estimate and supporting indicator score on the app's difficulty scale for this selection.`;
  }

  if (normalized === "accuracy") {
    return `${getStandardMetricLabel(normalized)} shows the share of checked words that are currently correct in this selection.`;
  }

  if (normalized === "first_try") {
    return `${getStandardMetricLabel(normalized)} shows the share of checked words that were correct on the first attempt.`;
  }

  if (normalized === "average_tries") {
    return `${getStandardMetricLabel(normalized)} shows how many attempts were needed, on average, for checked words in this selection.`;
  }

  if (normalized === "completion") {
    return `${getStandardMetricLabel(normalized)} shows the share of assigned pupil slots that reached full completion for the selected test.`;
  }

  if (normalized === "checked") {
    return `${getStandardMetricLabel(normalized)} shows the number of word responses currently included in this view.`;
  }

  if (normalized === "pupils") {
    return summary?.scopeType === "pupil"
      ? `${getStandardMetricLabel("classes")} shows how many classes this pupil currently belongs to in the dashboard.`
      : `${getStandardMetricLabel(normalized)} shows how many pupils are included in the current selection.`;
  }

  return "";
}

function renderAnalyticsMetaLine(icon, text) {
  return `
    <div class="td-analytics-item-sub">
      ${renderIconLabel(icon, text)}
    </div>
  `;
}

function renderVisualComparisonSelectionEditor(selection, index) {
  const resolved = resolveVisualCompareSelection(selection, state.visualAnalytics.sourceData);
  const yearGroupOptions = getAnalyticsYearGroupOptions();
  const classOptions = getAnalyticsClassOptions();
  const selectedClassIds = new Set((selection?.classIds || []).map((item) => String(item || "")));

  return `
    <article class="td-compare-config-card">
      <div class="td-compare-config-head">
        <div>
          <div class="td-compare-config-kicker">Compare ${escapeHtml(String(index + 1))}</div>
          <strong>${escapeHtml(resolved.label || "Comparison")}</strong>
        </div>
        <button
          type="button"
          class="td-btn td-btn--ghost td-btn--tiny"
          data-action="remove-compare-selection"
          data-compare-id="${escapeAttr(selection?.id || "")}"
        >
          Remove
        </button>
      </div>

      <label class="td-field td-field--compact">
        <span>View</span>
        <select class="td-input" data-field="compare-mode" data-compare-id="${escapeAttr(selection?.id || "")}">
          <option value="overview" ${selection?.mode === "overview" ? "selected" : ""}>All classes</option>
          <option value="year_group" ${selection?.mode === "year_group" ? "selected" : ""}>Year group</option>
          <option value="class_set" ${selection?.mode === "class_set" ? "selected" : ""}>Selected classes</option>
        </select>
      </label>

      ${
        selection?.mode === "year_group"
          ? `
        <label class="td-field td-field--compact">
          <span>Year group</span>
          <select class="td-input" data-field="compare-year-group" data-compare-id="${escapeAttr(selection?.id || "")}" ${yearGroupOptions.length ? "" : "disabled"}>
            ${
              yearGroupOptions.length
                ? yearGroupOptions.map((item) => `
              <option value="${escapeAttr(item)}" ${item === String(selection?.yearGroup || "") ? "selected" : ""}>${escapeHtml(item)}</option>
            `).join("")
                : `<option value="">Add year groups first</option>`
            }
          </select>
        </label>
      `
          : selection?.mode === "class_set"
            ? `
        <div class="td-field td-field--compact">
          <span>Classes</span>
          ${
            classOptions.length
              ? `
            <div class="td-compare-class-grid">
              ${classOptions.map((item) => `
                <label class="td-compare-class-option ${selectedClassIds.has(String(item.value || "")) ? "is-selected" : ""}">
                  <input
                    type="checkbox"
                    data-field="compare-class-toggle"
                    data-compare-id="${escapeAttr(selection?.id || "")}"
                    value="${escapeAttr(item.value)}"
                    ${selectedClassIds.has(String(item.value || "")) ? "checked" : ""}
                  />
                  <span>${escapeHtml(item.label)}</span>
                </label>
              `).join("")}
            </div>
            <p class="td-compare-picker-note">${
              selectedClassIds.size
                ? `${escapeHtml(String(selectedClassIds.size))} class${selectedClassIds.size === 1 ? "" : "es"} selected.`
                : "Choose one or more classes to compare."
            }</p>
          `
              : `<p class="td-compare-picker-note">Create classes first to compare them here.</p>`
          }
        </div>
      `
            : `<p class="td-compare-picker-note">Whole-school view across every class in your dashboard.</p>`
      }
    </article>
  `;
}

function renderVisualComparisonCard(summary) {
  const stats = [
    { label: "Accuracy", value: summary.checkedWords ? formatPercent(summary.accuracy) : "No attempts" },
    { label: "First try", value: summary.checkedWords ? formatPercent(summary.firstTrySuccessRate) : "No attempts" },
    { label: "Participation", value: summary.pupilCount ? formatPercent(summary.engagementRate) : "No pupils" },
    { label: "Pupils", value: String(summary.pupilCount) },
    { label: "Checked", value: String(summary.checkedWords) },
    { label: "Review", value: String(summary.interventionCount) },
  ];
  const highlights = [
    { label: "Watch", value: summary.topConcern || "No standout concern yet." },
    { label: "Secure", value: summary.topStrength || "No standout strength yet." },
    { label: "Latest", value: summary.latestActivity ? formatDate(summary.latestActivity) : "No recent activity yet." },
  ];

  return `
    <article class="td-compare-panel td-compare-panel--${escapeAttr(summary.comparisonTone || "overview")}">
      <div class="td-compare-panel-head">
        <div class="td-compare-panel-kicker">${
          summary.comparisonMode === "year_group"
            ? "Year group"
            : summary.comparisonMode === "class_set"
              ? "Selected classes"
              : "All classes"
        }</div>
        <h6>${escapeHtml(summary.label || "Comparison")}</h6>
        <p>${escapeHtml(summary.subtitle || "")}</p>
      </div>

      <div class="td-compare-panel-stats">
        ${stats.map((item) => `
          <div class="td-compare-panel-stat">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `).join("")}
      </div>

      <div class="td-compare-panel-list">
        ${highlights.map((item) => `
          <div class="td-compare-panel-note">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `).join("")}
      </div>

      <div class="td-compare-panel-token-group">
        <span>Focus</span>
        ${
          summary.weakGraphemes.length
            ? `<div class="td-visual-token-row">${summary.weakGraphemes.slice(0, 3).map((item) => `<span class="td-visual-token">${escapeHtml(item.target)}</span>`).join("")}</div>`
            : `<p class="td-compare-picker-note">No grapheme concerns standing out here yet.</p>`
        }
      </div>

      <div class="td-compare-panel-token-group">
        <span>Secure</span>
        ${
          summary.strongGraphemes.length
            ? `<div class="td-visual-token-row">${summary.strongGraphemes.slice(0, 3).map((item) => `<span class="td-visual-token">${escapeHtml(item.target)}</span>`).join("")}</div>`
            : `<p class="td-compare-picker-note">No standout secure grapheme yet.</p>`
        }
      </div>
    </article>
  `;
}

function renderVisualComparisonSection() {
  return "";
}

function renderVisualSummaryPanel(summary) {
  return `
    <section class="td-visual-summary-page" data-role="visual-summary-page">
      <div class="td-visual-summary-head td-visual-summary-head--compact">
        <div class="td-visual-summary-copy">
          ${renderHeadingWithInfo(summary.label || "Overview", buildVisualSummaryInfoText(summary), {
            tag: "h4",
            className: "td-heading-with-info--summary",
            infoLabel: `About ${summary.label || "this view"}`,
          })}
          ${summary.selectedGrapheme ? `<div class="td-visual-focus-pill">Grapheme focus: ${escapeHtml(summary.selectedGrapheme)}</div>` : ""}
        </div>

        <div class="td-visual-summary-actions">
          <button
            type="button"
            class="td-btn td-btn--primary"
            data-action="use-visual-summary-scope"
            data-scope-type="${escapeAttr(summary.scopeType || "overview")}"
            data-scope-id="${escapeAttr(summary.scopeId || "")}"
            data-scope-label="${escapeAttr(summary.label || "This view")}"
            data-question="${escapeAttr(getVisualSummaryPrompt(summary.scopeType, summary.label, summary.selectedGrapheme))}"
          >
            Ask AI
          </button>
        </div>
      </div>

      ${renderVisualSummaryCards(summary)}
      ${renderAccuracySnapshotSection(summary)}
      ${renderVisualInsightSection(summary)}
    </section>
  `;
}

function renderVisualSummaryCardsLegacy(summary) {
  return `
    <div class="td-analytics-summary-grid td-analytics-summary-grid--visual">
      ${renderAnalyticsMetricCard(summary.scopeType === "pupil" ? "grid" : "users", summary.scopeType === "pupil" ? "Classes" : "Pupils", String(summary.scopeType === "pupil" ? summary.classCount : summary.pupilCount))}
      ${renderAnalyticsMetricCard("activity", summary.scopeType === "pupil" ? "Active now" : "Active", summary.scopeType === "pupil" ? (summary.activePupilCount ? "Yes" : "No") : String(summary.activePupilCount))}
      ${renderAnalyticsMetricCard("target", "Accuracy", summary.checkedWords ? formatPercent(summary.accuracy) : "â€”")}
        <div class="td-analytics-summary-value">${escapeHtml(summary.checkedWords ? formatPercent(summary.accuracy) : "—")}</div>
      <article class="td-analytics-summary-card">
        <div class="td-analytics-summary-label">First try</div>
        <div class="td-analytics-summary-value">${escapeHtml(summary.checkedWords ? formatPercent(summary.firstTrySuccessRate) : "—")}</div>
      </article>
      <article class="td-analytics-summary-card">
        <div class="td-analytics-summary-label">Avg tries</div>
        <div class="td-analytics-summary-value">${escapeHtml(summary.checkedWords ? formatOneDecimal(summary.averageAttempts) : "—")}</div>
      </article>
      <article class="td-analytics-summary-card">
        <div class="td-analytics-summary-label">Checked</div>
        <div class="td-analytics-summary-value">${escapeHtml(String(summary.checkedWords))}</div>
      </article>
    </div>
  `;
}

function renderVisualProgressBars(summary) {
  const graphemeLabel = summary.selectedGrapheme ? `${summary.selectedGrapheme} ` : "";
  const rows = [
    {
      label: "Accuracy",
      value: summary.accuracy,
      helper: summary.checkedWords
        ? `${formatPercent(summary.accuracy)} of latest ${graphemeLabel}checked words correct`
        : summary.selectedGrapheme
          ? `No ${summary.selectedGrapheme} checks yet`
          : "No checked words yet",
    },
    {
      label: "First-try success",
      value: summary.firstTrySuccessRate,
      helper: summary.checkedWords
        ? `${formatPercent(summary.firstTrySuccessRate)} correct on the first go`
        : summary.selectedGrapheme
          ? `No ${summary.selectedGrapheme} checks yet`
          : "No checked words yet",
    },
    {
      label: "Participation",
      value: summary.engagementRate,
      helper: summary.pupilCount
        ? summary.selectedGrapheme
          ? `${summary.activePupilCount}/${summary.pupilCount} pupils have ${summary.selectedGrapheme} data in this view`
          : `${summary.activePupilCount}/${summary.pupilCount} pupils active in this view`
        : "No pupils in this view yet",
    },
  ];

  return `
    <div class="td-visual-progress-list">
      ${rows.map((item) => `
        <div class="td-visual-progress-row">
          <div class="td-visual-progress-head">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(formatPercent(item.value || 0))}</span>
          </div>
          <div class="td-visual-progress-bar"><span style="width:${Number(item.value) > 0 ? Math.max(6, Math.round((Number(item.value) || 0) * 100)) : 0}%;"></span></div>
          <div class="td-visual-progress-note">${escapeHtml(item.helper)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderVisualSpotlight(summary) {
  const latestActivityText = summary.latestActivity ? formatDate(summary.latestActivity) : "No recent activity yet";
  const focusStats = summary.selectedGraphemeStats;
  const spotlight = summary.selectedGrapheme
    ? [
      `Focus: ${summary.selectedGrapheme}`,
      focusStats
        ? `${focusStats.correct}/${focusStats.total} latest responses correct for ${summary.selectedGrapheme}.`
        : `No ${summary.selectedGrapheme} activity yet in this view.`,
      summary.interventionCount
        ? `${summary.interventionCount} pupil${summary.interventionCount === 1 ? "" : "s"} may need review on ${summary.selectedGrapheme}.`
        : `No pupils clearly flagged on ${summary.selectedGrapheme} yet.`,
      `Latest: ${latestActivityText}.`,
    ]
    : [
      summary.topConcern ? `Watch: ${summary.topConcern}` : "No standout concern yet.",
      summary.topStrength ? `Secure: ${summary.topStrength}` : "No standout strength yet.",
      summary.interventionCount
        ? `${summary.interventionCount} pupil${summary.interventionCount === 1 ? "" : "s"} to review.`
        : "No pupils clearly flagged for review.",
      `Latest: ${latestActivityText}.`,
    ];

  return `
    <div class="td-visual-spotlight-list">
      ${spotlight.map((line) => `<div class="td-visual-spotlight-item">${escapeHtml(line)}</div>`).join("")}
    </div>
  `;
}

function buildVisualGraphemePriorityItems(summary) {
  return [...(summary?.graphemeRows || [])]
    .filter((item) => Number(item?.total || 0) >= 2)
    .map((item) => ({
      ...item,
      statusMeta: getVisualGraphemeStatusMeta(item),
    }))
    .sort((a, b) => {
      const toneRankDiff = getPupilSignalRank(a.statusMeta?.tone) - getPupilSignalRank(b.statusMeta?.tone);
      if (toneRankDiff !== 0) return toneRankDiff;
      const accuracyDiff = Number(a.accuracy || 0) - Number(b.accuracy || 0);
      if (accuracyDiff !== 0) return accuracyDiff;
      const totalDiff = Number(b.total || 0) - Number(a.total || 0);
      if (totalDiff !== 0) return totalDiff;
      return String(a.target || "").localeCompare(String(b.target || ""));
    });
}

function renderVisualGraphemePriorityList(items, activeFilter = "all") {
  const filteredItems = filterItemsByVisualStatus(items, activeFilter, (item) => item.statusMeta);
  if (!filteredItems.length) {
    const filterKey = normalizeVisualStatusFilter(activeFilter);
    const emptyMessage = filterKey === "all"
      ? "No grapheme patterns stand out in this view yet."
      : `No ${getVisualStatusFilterOption(filterKey).label.toLowerCase()} graphemes in this view yet.`;
    return `
      <div class="td-empty td-empty--compact">
        <strong>${escapeHtml(emptyMessage)}</strong>
      </div>
    `;
  }

  return `
    <div class="td-analytics-list">
      ${filteredItems.map((item) => `
        <article class="td-analytics-item td-analytics-item--status-${escapeAttr(item.statusMeta?.key || "developing")}">
          <div class="td-analytics-item-top">
            <strong>${escapeHtml(item.target)}</strong>
            <span class="td-band td-band--${escapeAttr(item.securityBand || "insecure")}">${escapeHtml(securityBandLabel(item.securityBand))}</span>
          </div>
          ${renderAnalyticsMetaLine("checkCircle", `${item.correct}/${item.total} latest responses correct`)}
          ${renderAnalyticsMetaLine("target", `${formatPercent(item.accuracy)} latest accuracy`)}
          ${renderAnalyticsMetaLine("zap", `${formatPercent(item.firstTrySuccessRate)} first-try success`)}
          ${renderAnalyticsMetaLine("repeat", `${formatOneDecimal(item.averageAttempts)} average tries`)}
          ${renderAnalyticsMetaLine("book", item.wordSamples?.length ? item.wordSamples.join(", ") : "No sample words yet")}
        </article>
      `).join("")}
    </div>
  `;
}

function renderSelectedGraphemeSamples(summary) {
  const samples = summary.selectedGraphemeStats?.wordSamples || [];
  if (!summary.selectedGrapheme || !samples.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>${escapeHtml(summary.selectedGrapheme ? `No ${summary.selectedGrapheme} word samples yet.` : "No word samples yet.")}</strong>
      </div>
    `;
  }

  return `
    <div class="td-visual-token-row">
      ${samples.map((item) => `<span class="td-visual-token">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function renderVisualPupilCardsLegacy(items) {
  const visible = (items || []).slice(0, 12);
  if (!visible.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No pupils to show yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-visual-pupil-list">
      ${visible.map((item) => `
        <button
          type="button"
          class="td-visual-mini-card ${item.needsIntervention ? "is-alert" : ""}"
          data-action="open-visual-summary"
          data-scope-type="pupil"
          data-scope-id="${escapeAttr(item.pupilId || "")}"
        >
          <div class="td-visual-mini-top">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.checkedWords ? formatPercent(item.accuracy) : "No attempts")}</span>
          </div>
          <div class="td-visual-mini-sub">${escapeHtml(item.classNames?.join(", ") || "No active classes")}</div>
          <div class="td-visual-mini-sub">${escapeHtml(formatSpellingIndicatorSummary(item.attainmentIndicator, { short: true }))}</div>
          <div class="td-visual-mini-sub">${escapeHtml(item.weakGraphemes.length ? `Focus: ${item.weakGraphemes.join(", ")}` : "No standout focus yet")}</div>
        </button>
      `).join("")}
    </div>
  `;
}

function renderVisualPupilTableLegacy(items) {
  const visible = (items || []).slice(0, 30);
  if (!visible.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No pupils to show yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-visual-pupil-table">
      <div class="td-visual-pupil-table-head">
        <span>Pupil</span>
        <span>Checked</span>
        <span>Accuracy</span>
        <span>Avg tries</span>
        <span>Watch</span>
      </div>
      ${visible.map((item) => {
        const status = item.needsIntervention ? "Review" : item.checkedWords ? "Active" : "Waiting";
        const watchText = item.weakGraphemes.length ? item.weakGraphemes.join(", ") : "—";
        return `
          <button
            type="button"
            class="td-visual-pupil-row ${item.needsIntervention ? "is-alert" : ""}"
            data-action="open-visual-summary"
            data-scope-type="pupil"
            data-scope-id="${escapeAttr(item.pupilId || "")}"
          >
            <div class="td-visual-pupil-cell td-visual-pupil-cell--main">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(status)}</span>
            </div>
            <div class="td-visual-pupil-cell">${escapeHtml(String(item.checkedWords || 0))}</div>
            <div class="td-visual-pupil-cell">${escapeHtml(item.checkedWords ? formatPercent(item.accuracy) : "—")}</div>
            <div class="td-visual-pupil-cell">${escapeHtml(item.checkedWords ? formatOneDecimal(item.averageAttempts) : "—")}</div>
            <div class="td-visual-pupil-cell td-visual-pupil-cell--focus">${escapeHtml(watchText)}</div>
          </button>
        `;
      }).join("")}
      ${
        items.length > visible.length
          ? `<p class="td-chat-note">Showing the first ${escapeHtml(String(visible.length))} pupils.</p>`
          : ""
      }
    </div>
  `;
}

function renderVisualClassRows(items) {
  if (!items.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No classes in this view yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-visual-class-list">
      ${items.map((item) => `
        <button
          type="button"
          class="td-visual-class-row"
          data-action="open-visual-summary"
          data-scope-type="class"
          data-scope-id="${escapeAttr(item.classId || "")}"
        >
          <div class="td-visual-class-main">
            <strong>${escapeHtml(item.className)}</strong>
            <span>${escapeHtml(item.yearGroup || "No year group")}</span>
          </div>
          <div class="td-visual-class-metric td-visual-class-metric--stack">
            <strong>${escapeHtml(getSummaryAttainmentLevel(item))}</strong>
            ${item?.typicalSecurityLabel ? `<span class="td-visual-class-security">${escapeHtml(item.typicalSecurityLabel)}</span>` : ""}
          </div>
          <div class="td-visual-class-metric">${escapeHtml(getSummaryAttainmentSubtext(item))}</div>
        </button>
      `).join("")}
    </div>
  `;
}

function renderVisualPupilDetail(pupil) {
  if (!pupil) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No pupil summary available yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-results-grid td-results-grid--analytics td-results-grid--stacked">
      <section class="td-results-block">
        ${renderVisualBlockHead("Pupil Snapshot", pupil.needsIntervention ? "Review" : "Steady")}
        <div class="td-visual-spotlight-list">
          <div class="td-visual-spotlight-item">${escapeHtml(`Classes: ${pupil.classNames?.join(", ") || "No active classes"}`)}</div>
          <div class="td-visual-spotlight-item">${escapeHtml(`Checked words: ${pupil.checkedWords}`)}</div>
          <div class="td-visual-spotlight-item">${escapeHtml(formatSpellingIndicatorSummary(pupil.attainmentIndicator))}</div>
          <div class="td-visual-spotlight-item">${escapeHtml(`Latest activity: ${pupil.latestActivity ? formatDate(pupil.latestActivity) : "No recent activity yet"}`)}</div>
          <div class="td-visual-spotlight-item">${escapeHtml(pupil.weakGraphemes.length ? `Focus: ${pupil.weakGraphemes.join(", ")}` : "No standout focus yet.")}</div>
        </div>
      </section>

      <section class="td-results-block">
        ${renderVisualBlockHead("Recent Wins", String(pupil.recentWins?.length || 0))}
        ${
          pupil.recentWins?.length
            ? `<div class="td-visual-token-row">${pupil.recentWins.map((item) => `<span class="td-visual-token">${escapeHtml(item)}</span>`).join("")}</div>`
            : `<div class="td-empty td-empty--compact"><strong>No recent wins recorded yet.</strong></div>`
        }
      </section>
    </div>
  `;
}

function getAnalyticsAssistantViewState() {
  const visibleMessages = getAnalyticsAssistantConversationMessages(state.analyticsAssistant.messages);
  const hasConversation = visibleMessages.some((item) => item?.role === "user");

  return {
    hasConversation,
    visibleMessages,
  };
}

function isAnalyticsAssistantIntroMessage(item, index) {
  return (
    index === 0 &&
    item?.role === "assistant" &&
    String(item?.text || "").trim() === ANALYTICS_ASSISTANT_INTRO
  );
}

function getAnalyticsAssistantConversationMessages(messages = state.analyticsAssistant.messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((item, index) => {
      if (item?.role !== "user" && item?.role !== "assistant") return false;
      return !isAnalyticsAssistantIntroMessage(item, index);
    });
}

function getAnalyticsAssistantHint(scopeType, hasScopeOptions) {
  if (!hasScopeOptions && scopeType === "year_group") {
    return "Add a year group on each class card to unlock year-group analysis.";
  }
  if (!hasScopeOptions && scopeType === "pupil") {
    return "Pupil drill-down unlocks once pupils are added to classes.";
  }
  return "Press Ctrl+Enter to send quickly.";
}

function encodeAnalyticsAssistantScopeValue(scopeType, scopeId = "") {
  return `${String(scopeType || "overview")}::${String(scopeId || "")}`;
}

function parseAnalyticsAssistantScopeValue(value) {
  const [scopeType = "overview", ...rest] = String(value || "overview::").split("::");
  return {
    scopeType: ["overview", "class", "year_group", "pupil"].includes(scopeType) ? scopeType : "overview",
    scopeId: rest.join("::"),
  };
}

function getAnalyticsAssistantScopeEntries() {
  return [
    { value: encodeAnalyticsAssistantScopeValue("overview", ""), label: "All classes" },
    ...getAnalyticsYearGroupOptions().map((item) => ({
      value: encodeAnalyticsAssistantScopeValue("year_group", item),
      label: `Year: ${item}`,
    })),
    ...getAnalyticsClassOptions().map((item) => ({
      value: encodeAnalyticsAssistantScopeValue("class", item.value),
      label: `Class: ${item.label}`,
    })),
    ...getAnalyticsPupilOptions().map((item) => ({
      value: encodeAnalyticsAssistantScopeValue("pupil", item.value),
      label: `Pupil: ${item.label}`,
    })),
  ];
}

function renderAnalyticsAssistantScopePicker({
  scopeType,
  scopeId,
}) {
  const entries = getAnalyticsAssistantScopeEntries();
  const selectedValue = scopeType === "overview"
    ? encodeAnalyticsAssistantScopeValue("overview", "")
    : encodeAnalyticsAssistantScopeValue(scopeType, scopeId);

  return `
    <div class="td-chat-toolbar-scope">
      <select class="td-input" data-field="analytics-scope" aria-label="Assistant scope">
        ${entries.map((item) => `
          <option value="${escapeAttr(item.value)}" ${item.value === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>
        `).join("")}
      </select>
    </div>
  `;
}

function renderAnalyticsAssistantScopeControls({
  scopeType,
  scopeId,
}) {
  return `
    <div class="td-chat-toolbar-actions">
      ${renderAnalyticsAssistantScopePicker({ scopeType, scopeId })}
    </div>
  `;
}

function renderAnalyticsAssistantThreadChip(thread) {
  const isActive = String(thread?.id || "") === String(state.analyticsAssistant.activeThreadId || "");
  const stamp = thread?.lastMessageAt ? formatShortDate(thread.lastMessageAt) : "";

  return `
    <button
      class="td-chat-history-item ${isActive ? "is-active" : ""}"
      type="button"
      data-action="open-analytics-thread"
      data-thread-id="${escapeAttr(thread?.id || "")}"
      title="${escapeAttr(thread?.title || "Chat")}"
    >
      <span class="td-chat-history-item-title">${escapeHtml(thread?.title || "Chat")}</span>
      ${stamp ? `<span class="td-chat-history-item-meta">${escapeHtml(stamp)}</span>` : ""}
    </button>
  `;
}

function renderAnalyticsAssistantThreadRail() {
  const threads = state.analyticsAssistant.threads || [];
  const isNewChatActive = !state.analyticsAssistant.activeThreadId;

  return `
    <aside class="td-chat-sidebar">
      <button
        class="td-chat-history-new ${isNewChatActive ? "is-active" : ""}"
        type="button"
        data-action="new-analytics-thread"
      >
        New chat
      </button>
      <div class="td-chat-sidebar-label">Recent chats</div>
      <div class="td-chat-history-list">
        ${
          threads.length
            ? threads.map(renderAnalyticsAssistantThreadChip).join("")
            : `<div class="td-chat-history-empty">Chats will appear here once you start asking questions.</div>`
        }
      </div>
      ${state.analyticsAssistant.threadsLoading ? `<div class="td-chat-history-status">Loading chats...</div>` : ""}
    </aside>
  `;
}

function renderAnalyticsAssistantComposer({
  isDisabled,
  home = false,
}) {
  const sendLabel = state.analyticsAssistant.loading ? "Thinking" : "Send question";
  const sendIcon = state.analyticsAssistant.loading ? "spark" : "arrowRight";

  return `
    <div class="td-chat-footer td-chat-footer--${home ? "home" : "thread"}">
      <form data-form="teacher-analytics-chat" class="td-chat-composer td-chat-composer--familiar ${home ? "is-home" : ""}">
        <div class="td-chat-composer-shell ${home ? "td-chat-composer-shell--home" : "td-chat-composer-shell--thread"}">
          <label class="td-chat-composer-field td-chat-composer-field--shell">
            <span class="td-chat-composer-label">Message</span>
            <textarea
              class="td-textarea td-textarea--chat"
              name="question"
              data-field="analytics-question"
              rows="1"
              placeholder="Ask anything"
            >${escapeHtml(state.analyticsAssistant.questionDraft || "")}</textarea>
          </label>
          <div class="td-chat-composer-actions td-chat-composer-actions--shell">
            <button
              class="td-btn td-chat-send td-chat-send--icon"
              type="submit"
              aria-label="${escapeAttr(sendLabel)}"
              title="${escapeAttr(sendLabel)}"
              ${isDisabled ? "disabled" : ""}
            >
              ${renderIconOnly(sendIcon, sendLabel, `td-chat-send-icon ${state.analyticsAssistant.loading ? "is-thinking" : ""}`)}
            </button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function renderAnalyticsAssistantHome({
  prompts,
  isDisabled,
}) {
  return `
    <div class="td-chat-stage td-chat-stage--empty">
      <div class="td-chat-home">
        <h5 class="td-chat-home-title">What do you want to understand?</h5>
      </div>
      ${renderAnalyticsAssistantComposer({
        isDisabled,
        home: true,
      })}
      <div class="td-chat-chip-row td-chat-chip-row--hero">
        ${prompts.map((prompt) => `
          <button class="td-chip-btn td-chip-btn--hero" type="button" data-action="analytics-suggestion" data-question="${escapeAttr(prompt)}">${escapeHtml(prompt)}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderAnalyticsAssistantConversation({
  messages,
  scopeLabel,
  isDisabled,
}) {
  return `
    <div class="td-chat-stage td-chat-stage--conversation">
      <div class="td-chat-thread-wrap td-chat-thread-wrap--conversation">
        <div class="td-chat-thread" data-role="analytics-thread">
          ${messages.map(renderTeacherAnalyticsMessage).join("")}
          ${
            state.analyticsAssistant.loading
              ? `
            <article class="td-chat-message td-chat-message--assistant is-loading">
              <div class="td-chat-message-head">
                <strong>AI</strong>
                <span>${escapeHtml(scopeLabel)}</span>
              </div>
              <div class="td-chat-message-body">Looking through the latest spelling data...</div>
            </article>
          `
              : ""
          }
        </div>
      </div>
      ${renderAnalyticsAssistantComposer({
        isDisabled,
        home: false,
      })}
    </div>
  `;
}

function renderAnalyticsAssistantShell({
  showCloseButton = false,
  inline = false,
}) {
  const scopeType = state.analyticsAssistant.scopeType || "overview";
  const scopeId = syncAnalyticsScopeId(scopeType, state.analyticsAssistant.scopeId);
  const scopeLabel = getAnalyticsScopeLabel(scopeType, scopeId);
  const prompts = getAnalyticsSuggestionPrompts(scopeType, scopeLabel);
  const scopeOptions = getAnalyticsScopeOptions(scopeType);
  const hasScopeOptions = scopeType === "overview" || scopeOptions.length > 0;
  const isDisabled = state.analyticsAssistant.loading || !hasScopeOptions;
  const { hasConversation, visibleMessages } = getAnalyticsAssistantViewState();
  const showHistory = state.analyticsAssistant.historyAvailable !== false;

  return `
    <section class="td-chat-card td-chat-card--surface ${inline ? "td-chat-card--inline" : ""}" data-role="analytics-assistant-panel">
      ${showCloseButton ? `<button class="td-chat-close-btn" type="button" data-action="close-ai-assistant" aria-label="Close AI">&times;</button>` : ""}
      <div class="td-chat-shell-layout ${showHistory ? "" : "is-history-hidden"}">
        ${showHistory ? renderAnalyticsAssistantThreadRail() : ""}
        <div class="td-chat-main">
          <div class="td-chat-toolbar">
            ${renderAnalyticsAssistantScopeControls({ scopeType, scopeId })}
          </div>
          ${
            hasConversation
              ? renderAnalyticsAssistantConversation({
                messages: visibleMessages,
                scopeLabel,
                isDisabled,
              })
              : renderAnalyticsAssistantHome({
                prompts,
                isDisabled,
              })
          }
        </div>
      </div>
    </section>
  `;
}

function renderTeacherAnalyticsMessage(item) {
  const role = item?.role === "user" ? "user" : "assistant";
  const label = role === "user" ? "You" : "AI";
  return `
    <article class="td-chat-message td-chat-message--${escapeAttr(role)}">
      <div class="td-chat-message-head">
        <strong>${escapeHtml(label)}</strong>
        ${item?.scopeLabel ? `<span>${escapeHtml(item.scopeLabel)}</span>` : ""}
      </div>
      <div class="td-chat-message-body">${escapeHtml(String(item?.text || "")).replaceAll("\n", "<br>")}</div>
      ${item?.meta ? `<div class="td-chat-message-meta">${escapeHtml(item.meta)}</div>` : ""}
    </article>
  `;
}

function getStaffAccessRoleDescription(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  if (safeRole === "teacher") return "Base content role for creating, editing, and assigning owned teaching content.";
  if (safeRole === "admin") return "System setup and access-management role. Schoolwide access is automatic.";
  if (safeRole === "hoy") return "Year-group oversight overlay. Add year groups or classes to make it usable.";
  if (safeRole === "hod") return "Department oversight overlay. Add departments or classes to make it usable.";
  if (safeRole === "senco") return "Schoolwide SEN oversight overlay. Schoolwide access is automatic.";
  if (safeRole === "literacy_lead") return "Schoolwide literacy and intervention oversight overlay. Schoolwide access is automatic.";
  return "Role";
}

function getStaffAccessRoleHelpText(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  if (safeRole === "teacher") return "Teacher is the base authoring role for owned classes, tests, and assignments.";
  if (safeRole === "admin") return "Admin gives school-wide setup and access-management permissions. It does not add Teacher authoring unless Teacher is also assigned.";
  if (safeRole === "hoy") return "HOY adds read-only oversight for the selected year groups or classes.";
  if (safeRole === "hod") return "HOD adds read-only oversight for the selected departments or classes.";
  if (safeRole === "senco") return "SENCO adds school-wide read-only SEN oversight.";
  if (safeRole === "literacy_lead") return "Literacy Lead adds school-wide read-only literacy and intervention oversight.";
  return "Role controls the kind of access this staff member has.";
}

function getStaffAccessSummaryHelpText(kind = "") {
  const safeKind = String(kind || "").trim().toLowerCase();
  if (safeKind === "role") {
    return "A role controls the kind of access this staff member has. Some roles also need scopes to narrow where that access applies.";
  }
  if (safeKind === "scope") {
    return "A scope limits an overlay role to the right year groups, departments, or classes.";
  }
  return "";
}

function getStaffAccessScopeHelpText(scopeType = "") {
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  if (safeScopeType === "year_group") return "Year group scope gives this oversight role visibility across one whole year group.";
  if (safeScopeType === "department") return "Department scope gives this oversight role visibility across one department.";
  if (safeScopeType === "class") return "Class scope gives this oversight role visibility for specific classes only.";
  if (safeScopeType === "school") return "School scope gives this role school-wide visibility.";
  return "Scope limits where this role applies.";
}

function renderStaffAccessInlineTip(text = "", label = "More info") {
  if (!text) return "";
  return renderInfoTip(text, {
    label,
    align: "start",
    className: "td-staff-access-inline-tip",
    triggerClassName: "td-staff-access-inline-tip-trigger",
  });
}

function formatStaffAccessCountLabel(count, singular, plural = `${singular}s`) {
  const safeCount = Number(count || 0);
  return `${safeCount} ${safeCount === 1 ? singular : plural}`;
}

function renderStaffAccessAssignedScopeList(role = "", scopeType = "", { emptyText = "" } = {}) {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  const scopes = getStaffAccessSelectedScopesForRole(safeRole)
    .filter((scope) => String(scope?.scope_type || "").trim().toLowerCase() === safeScopeType);

  if (!scopes.length) {
    return emptyText ? `<p class="td-staff-access-note td-staff-access-note--compact">${escapeHtml(emptyText)}</p>` : "";
  }

  return `
    <div class="td-staff-access-assigned-list">
      ${scopes.map((scope) => `
        <div class="td-staff-access-assigned-item">
          <span>${escapeHtml(getStaffAccessScopeLabel(scope))}</span>
          <button
            class="td-btn td-btn--ghost td-btn--tiny"
            type="button"
            data-action="remove-staff-scope"
            data-role="${escapeAttr(safeRole)}"
            data-scope-type="${escapeAttr(safeScopeType)}"
            data-scope-value="${escapeAttr(scope.scope_value)}"
            ${getStaffAccessState()?.mutating || !canManageSelectedStaffAccessLiveAccess() ? "disabled" : ""}
          >
            Remove
          </button>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStaffAccessIncludedClassList(items = [], { helperText = "" } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No included classes match this filter yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-staff-access-included-wrap">
      ${helperText ? `<p class="td-staff-access-note td-staff-access-note--compact">${escapeHtml(helperText)}</p>` : ""}
      <div class="td-staff-access-included-list">
        ${safeItems.map((item) => `
          <div class="td-staff-access-included-item">
            <div class="td-staff-access-included-copy">
              <strong>${escapeHtml(item?.label || "Class")}</strong>
              ${item?.meta ? `<span>${escapeHtml(item.meta)}</span>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderStaffAccessRoleFooterActions({
  role = "",
  roleIsActive = false,
  primaryActionLabel = "",
  primaryActionDisabled = false,
  primaryAction = "",
  revokeDisabled = false,
} = {}) {
  const safeRole = String(role || "").trim().toLowerCase();
  const safePrimaryAction = String(primaryAction || "").trim();
  const footerClasses = ["td-staff-access-role-btns", roleIsActive ? "" : "is-single"]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="td-staff-access-role-footer">
      <div class="${footerClasses}">
        <button
          class="td-btn td-btn--small"
          type="button"
          ${safePrimaryAction ? `data-action="${escapeAttr(safePrimaryAction)}" data-role="${escapeAttr(safeRole)}"` : ""}
          ${primaryActionDisabled ? "disabled" : ""}
        >
          ${escapeHtml(primaryActionLabel)}
        </button>
        ${
          roleIsActive
            ? `
              <button
                class="td-btn td-btn--ghost td-btn--small td-staff-access-btn--danger"
                type="button"
                data-action="revoke-staff-role"
                data-role="${escapeAttr(safeRole)}"
                ${revokeDisabled ? "disabled" : ""}
              >
                Remove role
              </button>
            `
            : ""
        }
      </div>
    </div>
  `;
}

function getStaffAccessScopedPrimaryActionLabel(role = "", { roleIsActive = false, hasSelections = false } = {}) {
  const safeRole = String(role || "").trim().toLowerCase();
  if (!["hoy", "hod"].includes(safeRole)) return roleIsActive ? "Role active" : "Grant role";
  if (roleIsActive) return "Save scope changes";
  return "Grant role with selected scopes";
}

function renderStaffAccessRoleSummary() {
  const selectedRoleSet = getStaffAccessSelectedRoleSet();
  if (!selectedRoleSet.size) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No roles assigned yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-staff-access-chip-row">
      ${STAFF_ACCESS_MANAGED_ROLES
        .filter((role) => selectedRoleSet.has(role))
        .map((role) => `<span class="td-staff-access-chip">${escapeHtml(getStaffAccessRoleLabel(role))}</span>`)
        .join("")}
    </div>
  `;
}

function renderStaffAccessScopeSummary() {
  const scopes = Array.isArray(getStaffAccessState()?.selectedScopes) ? getStaffAccessState().selectedScopes : [];
  if (!scopes.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No scopes assigned yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-staff-access-chip-row">
      ${scopes.map((scope) => `
        <span class="td-staff-access-chip td-staff-access-chip--scope">
          ${escapeHtml(`${getStaffAccessRoleLabel(scope.role)}: ${getStaffAccessScopeLabel(scope)}`)}
        </span>
      `).join("")}
    </div>
  `;
}

function renderStaffAccessWarnings() {
  const warnings = getStaffAccessSetupWarnings();
  if (!warnings.length) return "";

  return `
    <div class="td-staff-access-warning-list">
      ${warnings.map((warning) => `
        <div class="td-staff-access-warning">
          <strong>Setup warning</strong>
          <p>${escapeHtml(warning)}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStaffAccessScopeChips(role = "", scopeType = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  const scopes = getStaffAccessSelectedScopesForRole(safeRole)
    .filter((scope) => String(scope?.scope_type || "").trim().toLowerCase() === safeScopeType);

  if (!scopes.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No ${escapeHtml(getStaffAccessScopeTypeLabel(safeScopeType).toLowerCase())} scopes yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-staff-access-scope-list">
      ${scopes.map((scope) => `
        <div class="td-staff-access-scope-chip">
          <span>${escapeHtml(getStaffAccessScopeLabel(scope))}</span>
          <button
            class="td-icon-chip-btn"
            type="button"
            data-action="remove-staff-scope"
            data-role="${escapeAttr(safeRole)}"
            data-scope-type="${escapeAttr(safeScopeType)}"
            data-scope-value="${escapeAttr(scope.scope_value)}"
            ${getStaffAccessState()?.mutating ? "disabled" : ""}
            aria-label="${escapeAttr(`Remove ${getStaffAccessScopeLabel(scope)}`)}"
          >
            ×
          </button>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStaffAccessScopeManager({
  role = "",
  scopeType = "",
  label = "",
  options = [],
} = {}) {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  const pendingValue = String(getStaffAccessState()?.pendingScopeSelections?.[safeRole]?.[safeScopeType] || "").trim();
  const safeOptions = Array.isArray(options) ? options : [];
  const activeScopeValues = getStaffAccessAssignedScopeValueSet(safeRole, safeScopeType);
  const hasAvailableOptions = safeOptions.length > 0;
  let helperText = "";

  if (!hasAvailableOptions) {
    helperText = `No ${label.toLowerCase()} are available in the current schoolwide class data yet.`;
  } else if (safeRole === "hoy" && safeScopeType === "year_group") {
    helperText = pendingValue
      ? `All classes in ${pendingValue} are included automatically.`
      : "Select a year group to load matching classes, or tick classes individually below.";
  } else if (safeRole === "hod" && safeScopeType === "department") {
    helperText = pendingValue
      ? `All classes in ${pendingValue} are included automatically.`
      : "Select a department to automatically include matching classes, or select classes individually below.";
  } else if (pendingValue && activeScopeValues.has(pendingValue)) {
    helperText = `${getStaffAccessScopeTypeLabel(safeScopeType)} already assigned.`;
  }

  return `
    <div class="td-staff-access-scope-block">
      <div class="td-staff-access-scope-head">
        <span class="td-staff-access-head-inline">
          <strong>${escapeHtml(label)}</strong>
          ${renderStaffAccessInlineTip(getStaffAccessScopeHelpText(safeScopeType), `${getStaffAccessScopeTypeLabel(safeScopeType)} scope help`)}
        </span>
      </div>
      ${renderStaffAccessAssignedScopeList(safeRole, safeScopeType)}
      <div class="td-staff-access-scope-form">
        <select
          class="td-input"
          data-field="staff-access-pending-scope"
          data-role="${escapeAttr(safeRole)}"
          data-scope-type="${escapeAttr(safeScopeType)}"
          ${getStaffAccessState()?.mutating || !hasAvailableOptions || !canManageSelectedStaffAccessLiveAccess() ? "disabled" : ""}
        >
          <option value="">Choose ${escapeHtml(label.toLowerCase())}</option>
          ${safeOptions.map((option) => `
            <option value="${escapeAttr(option.value)}" ${pendingValue === option.value ? "selected" : ""}>${escapeHtml(sanitizeStaffAccessText(option.label))}</option>
          `).join("")}
        </select>
      </div>
      ${helperText ? `<p class="td-staff-access-note td-staff-access-note--compact">${escapeHtml(helperText)}</p>` : ""}
    </div>
  `;
}

function renderStaffAccessPendingClassChips(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const classIds = getStaffAccessPendingClassIds(safeRole);
  if (!classIds.length) return "";

  return `
    <div class="td-staff-access-chip-row td-staff-access-chip-row--pending">
      ${classIds.map((classId) => {
        const option = getStaffAccessClassOptions().find((item) => item.value === classId);
        const label = option?.label || classId;
        return `
          <span class="td-staff-access-chip td-staff-access-chip--scope td-staff-access-chip--pending">
            ${escapeHtml(label)}
            <button
              class="td-icon-chip-btn"
              type="button"
              data-action="remove-pending-staff-class"
              data-role="${escapeAttr(safeRole)}"
              data-scope-value="${escapeAttr(classId)}"
              ${getStaffAccessState()?.mutating ? "disabled" : ""}
              aria-label="${escapeAttr(`Remove ${label} from pending classes`)}"
            >
              ×
            </button>
          </span>
        `;
      }).join("")}
    </div>
  `;
}

function renderStaffAccessClassScopeManager(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const primaryValue = getStaffAccessPendingPrimaryScopeValue(safeRole);
  const classOptions = getStaffAccessClassOptions({ role: safeRole, applyPendingFilters: true });
  const pendingClassIds = new Set(getStaffAccessPendingClassIds(safeRole));
  const assignedClassIds = getStaffAccessAssignedScopeValueSet(safeRole, "class");
  const scopedRoleConfig = getStaffAccessScopedRoleConfig(safeRole);
  const isAutoIncluded = doesStaffAccessPrimaryScopeAutoIncludeClasses(safeRole);
  const heading = isAutoIncluded ? `Classes included by ${primaryValue}` : "Classes";
  const helperText = isAutoIncluded
    ? `All classes in ${primaryValue} are included automatically. Included classes are shown below for reference.`
    : safeRole === "hoy"
      ? "Select a year group to automatically include matching classes, or select classes individually below."
      : "Select a department to automatically include matching classes, or select classes individually below.";
  const includedItemMeta = primaryValue ? `Included via ${primaryValue}` : "Included via selected scope";
  const assignedScopeList = renderStaffAccessAssignedScopeList(safeRole, "class");

  return `
    <div class="td-staff-access-scope-block td-staff-access-scope-block--classes">
      <div class="td-staff-access-scope-head">
        <span class="td-staff-access-head-inline">
          <strong>${escapeHtml(heading)}</strong>
          ${renderStaffAccessInlineTip(
            scopedRoleConfig?.classScopeHelpText || getStaffAccessScopeHelpText("class"),
            "Class scope help"
          )}
        </span>
      </div>
      ${assignedScopeList}
      <p class="td-staff-access-note td-staff-access-note--compact">${escapeHtml(helperText)}</p>
      ${
        !classOptions.length
          ? `
            <div class="td-empty td-empty--compact">
              <strong>${escapeHtml(isAutoIncluded ? "No included classes match this filter yet." : "No classes are available yet.")}</strong>
            </div>
          `
          : isAutoIncluded
            ? renderStaffAccessIncludedClassList(
              classOptions.map((option) => ({
                label: option.label,
                meta: includedItemMeta,
              })),
            )
            : `
            <div class="td-staff-access-checklist">
              ${classOptions.map((option) => {
                const isAssigned = assignedClassIds.has(option.value);
                const isChecked = pendingClassIds.has(option.value);
                const helperLabel = isAssigned ? "Already added" : "";
                return `
                  <label class="td-staff-access-check-item ${isAssigned ? "is-disabled" : ""}">
                    <input
                      type="checkbox"
                      data-field="staff-access-class-toggle"
                      data-role="${escapeAttr(safeRole)}"
                      value="${escapeAttr(option.value)}"
                      ${isChecked ? "checked" : ""}
                      ${getStaffAccessState()?.mutating || isAssigned || !canManageSelectedStaffAccessLiveAccess() ? "disabled" : ""}
                    />
                    <span class="td-staff-access-check-copy">
                      <strong>${escapeHtml(option.label)}</strong>
                      ${helperLabel ? `<em>${escapeHtml(helperLabel)}</em>` : ""}
                    </span>
                  </label>
                `;
              }).join("")}
            </div>
          `
      }
    </div>
  `;
}

function renderStaffAccessConfirmModal() {
  const confirmation = getStaffAccessState()?.confirmation;
  if (!confirmation) return "";

  const toneClass = confirmation?.tone === "danger" ? "is-danger" : "";
  const hasConfirmAction = !!confirmation?.action;
  const dismissLabel = confirmation && Object.prototype.hasOwnProperty.call(confirmation, "dismissLabel")
    ? String(confirmation?.dismissLabel || "").trim()
    : "Cancel";

  return `
    <div class="td-staff-access-modal-shell" role="dialog" aria-modal="true" aria-labelledby="tdStaffAccessModalTitle">
      <div class="td-staff-access-modal-backdrop"></div>
      <div class="td-staff-access-modal ${toneClass}">
        <div class="td-staff-access-modal-head">
          <h3 id="tdStaffAccessModalTitle">${escapeHtml(String(confirmation?.title || "Confirm change"))}</h3>
        </div>
        <div class="td-staff-access-modal-body">
          ${(Array.isArray(confirmation?.body) ? confirmation.body : [])
            .map((line) => `<p>${escapeHtml(String(line || ""))}</p>`)
            .join("")}
        </div>
        <div class="td-staff-access-modal-actions">
          ${
            dismissLabel
              ? `
                <button
                  class="td-btn td-btn--ghost"
                  type="button"
                  data-action="dismiss-staff-access-confirmation"
                  ${getStaffAccessState()?.mutating ? "disabled" : ""}
                >
                  ${escapeHtml(dismissLabel)}
                </button>
              `
              : ""
          }
          <button
            class="td-btn ${hasConfirmAction ? "td-btn--danger" : ""}"
            type="button"
            data-action="${hasConfirmAction ? "confirm-staff-access-confirmation" : "dismiss-staff-access-confirmation"}"
            ${getStaffAccessState()?.mutating ? "disabled" : ""}
          >
            ${escapeHtml(String(confirmation?.confirmLabel || "Close"))}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderStaffAccessRoleCard(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const selectedRoleSet = getStaffAccessSelectedRoleSet();
  const roleIsActive = selectedRoleSet.has(safeRole);
  const roleLabel = getStaffAccessRoleLabel(safeRole);
  const mutating = !!getStaffAccessState()?.mutating;
  const hasLiveAccessTarget = canManageSelectedStaffAccessLiveAccess();
  const waitingForSignInLink = !hasLiveAccessTarget;
  const revokeDisabled = safeRole === "admin" && roleIsActive && !canRevokeSelectedAdminRole();
  const actionDisabled = mutating || revokeDisabled;
  const scopedRoleConfig = getStaffAccessScopedRoleConfig(safeRole);
  const scopedRolePlan = getStaffAccessScopedRolePendingPlan(safeRole);
  let primaryActionLabel = scopedRoleConfig
    ? getStaffAccessScopedPrimaryActionLabel(safeRole, {
      roleIsActive,
      hasSelections: scopedRolePlan.hasSelections,
    })
    : (roleIsActive ? "Role active" : "Grant role");
  let primaryActionDisabled = scopedRoleConfig
    ? (!hasLiveAccessTarget || mutating || (roleIsActive ? !scopedRolePlan.hasNewScopes : !scopedRolePlan.hasSelections))
    : (!hasLiveAccessTarget || mutating || roleIsActive);
  let primaryAction = scopedRoleConfig
    ? "apply-staff-scoped-role"
    : (roleIsActive ? "" : "grant-staff-role");

  if (waitingForSignInLink) {
    primaryActionLabel = "Waiting for sign-in";
    primaryActionDisabled = true;
    primaryAction = "";
  }

  const yearGroupOptions = getStaffAccessYearGroupOptions().map((item) => ({ value: item, label: item }));
  const departmentOptions = getStaffAccessDepartmentOptions().map((item) => ({ value: item, label: item }));

  return `
    <article class="td-staff-access-role-card ${roleIsActive ? "is-active" : ""}">
      <div class="td-staff-access-role-head">
        <div class="td-staff-access-role-copy">
          <h4>
            <span class="td-staff-access-head-inline">
              <span>${escapeHtml(roleLabel)}</span>
              ${renderStaffAccessInlineTip(getStaffAccessRoleHelpText(safeRole), `${roleLabel} help`)}
            </span>
          </h4>
          <p>${escapeHtml(getStaffAccessRoleDescription(safeRole))}</p>
        </div>
        <div class="td-staff-access-role-actions">
          <span class="td-pill ${roleIsActive ? "" : "td-pill--muted"}">${escapeHtml(roleIsActive ? "Active" : "Inactive")}</span>
        </div>
      </div>
      ${
        safeRole === "teacher"
          ? `<p class="td-staff-access-note">Teacher does not take explicit scopes in this phase.</p>`
          : ""
      }
      ${
        ["admin", "senco", "literacy_lead"].includes(safeRole)
          ? `<p class="td-staff-access-note">Schoolwide access is automatic for this role.</p>`
          : ""
      }
      ${
        revokeDisabled
          ? `<p class="td-staff-access-note td-staff-access-note--warning">You cannot remove your own admin role while you are the last active admin.</p>`
          : ""
      }
      ${
        waitingForSignInLink
          ? `<p class="td-staff-access-note td-staff-access-note--warning">This imported staff record is pending sign-in linkage, so live access cannot be granted yet.</p>`
          : ""
      }
      ${
        safeRole === "hoy" && hasLiveAccessTarget
          ? `
            <div class="td-staff-access-scope-grid">
              ${renderStaffAccessScopeManager({
                role: safeRole,
                scopeType: "year_group",
                label: "Year groups",
                options: yearGroupOptions,
              })}
              ${renderStaffAccessClassScopeManager(safeRole)}
            </div>
          `
          : ""
      }
      ${
        safeRole === "hod" && hasLiveAccessTarget
          ? `
            <div class="td-staff-access-scope-grid">
              ${renderStaffAccessScopeManager({
                role: safeRole,
                scopeType: "department",
                label: "Departments",
                options: departmentOptions,
              })}
              ${renderStaffAccessClassScopeManager(safeRole)}
            </div>
          `
          : ""
      }
      ${
        scopedRoleConfig && hasLiveAccessTarget
          ? `
            <div class="td-staff-access-flow-note">
              <p class="td-staff-access-note">
                ${
                  roleIsActive
                    ? `Review the selected scopes, then save any changes with the main action below.`
                    : `Choose ${escapeHtml(scopedRoleConfig.primaryLabel.toLowerCase())} and/or classes, then grant this role with the main action below.`
                }
              </p>
            </div>
          `
          : ""
      }
      ${
        scopedRoleConfig && waitingForSignInLink
          ? `
            <p class="td-staff-access-note td-staff-access-note--compact">
              Scope setup will become available after the staff member signs in and links this directory record.
            </p>
          `
          : ""
      }
      ${renderStaffAccessRoleFooterActions({
        role: safeRole,
        roleIsActive,
        primaryActionLabel,
        primaryActionDisabled,
        primaryAction,
        revokeDisabled: actionDisabled,
      })}
    </article>
  `;
}

function renderStaffAccessAuditList() {
  const auditEntries = Array.isArray(getStaffAccessState()?.selectedAuditEntries) ? getStaffAccessState().selectedAuditEntries : [];
  const profileMap = getStaffAccessProfileByUserIdMap();

  if (!auditEntries.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No recent access changes yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-staff-access-audit-list">
      ${auditEntries.map((entry) => {
        const actorUserId = String(entry?.actor_user_id || "").trim();
        const actorLabel = actorUserId === getCurrentTeacherId()
          ? "You"
          : (profileMap.get(actorUserId)?.display_name || actorUserId || "Unknown");
        const detailParts = [];
        if (entry?.role) detailParts.push(getStaffAccessRoleLabel(entry.role));
        if (entry?.scope_type && entry?.scope_value) {
          detailParts.push(`${getStaffAccessScopeTypeLabel(entry.scope_type)}: ${getStaffAccessScopeLabel(entry)}`);
        }
        return `
          <div class="td-staff-access-audit-item">
            <div class="td-staff-access-audit-copy">
              <strong>${escapeHtml(getStaffAccessAuditActionLabel(entry?.action))}</strong>
              <span>${escapeHtml(detailParts.join(" · ") || "Access change")}</span>
            </div>
            <div class="td-staff-access-audit-meta">
              <span>${escapeHtml(actorLabel)}</span>
              <span>${escapeHtml(formatStaffAccessDateTime(entry?.created_at))}</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderStaffAccessProfileBadges(profile = null, { includeCurrentUser = false } = {}) {
  const pills = [...getStaffAccessProfileStatusPills(profile)];
  if (includeCurrentUser && String(profile?.user_id || "").trim() === getCurrentTeacherId()) {
    pills.push({ label: "You", muted: true });
  }
  if (!pills.length) return "";
  return pills
    .map((pill) => `<span class="td-pill ${pill?.muted ? "td-pill--muted" : ""}">${escapeHtml(String(pill?.label || ""))}</span>`)
    .join("");
}

function renderStaffAccessFilterBar() {
  const currentFilter = String(getStaffAccessState()?.filter || "all").trim().toLowerCase();
  return `
    <div class="td-staff-access-filter-row">
      ${getStaffAccessFilterOptions().map((option) => `
        <button
          class="td-btn td-btn--ghost td-btn--small ${currentFilter === option.value ? "is-selected" : ""}"
          type="button"
          data-action="set-staff-access-filter"
          data-filter="${escapeAttr(option.value)}"
          ${getStaffAccessState()?.mutating ? "disabled" : ""}
        >
          ${escapeHtml(option.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderStaffAccessImportResultCard() {
  const result = getStaffAccessState()?.importResult;
  if (!result) return "";
  const createdCount = Number(result?.created_count || 0);
  const updatedCount = Number(result?.updated_count || 0);
  const headline = createdCount > 0
    ? `${formatStaffAccessCountLabel(createdCount, "staff member")} added to Pending access. Review imported staff below and save any pending approvals you want ready for first sign-in.`
    : updatedCount > 0
      ? `${formatStaffAccessCountLabel(updatedCount, "staff directory record")} updated. Review imported staff below and update any pending approvals if needed.`
      : "No staff directory changes were committed from this import.";

  return `
    <div class="td-staff-access-import-card td-staff-access-import-card--result">
      <div class="td-staff-access-import-head">
        <div>
          <h4>Import complete</h4>
          <p>${escapeHtml(headline)}</p>
        </div>
      </div>
      <div class="td-staff-access-import-summary">
        <span>${escapeHtml(formatStaffAccessCountLabel(result?.created_count || 0, "created row", "created rows"))}</span>
        <span>${escapeHtml(formatStaffAccessCountLabel(result?.updated_count || 0, "updated row", "updated rows"))}</span>
        <span>${escapeHtml(formatStaffAccessCountLabel(result?.skipped_count || 0, "skipped row", "skipped rows"))}</span>
        <span>${escapeHtml(formatStaffAccessCountLabel(result?.warning_count || 0, "warning"))}</span>
        <span>${escapeHtml(formatStaffAccessCountLabel(result?.error_count || 0, "error"))}</span>
      </div>
    </div>
  `;
}

function renderStaffAccessImportPreviewCard() {
  const preview = getStaffAccessState()?.importPreview;
  const previewError = String(getStaffAccessState()?.importPreviewError || "").trim();
  const isLoading = !!getStaffAccessState()?.importPreviewLoading;

  if (!preview && !previewError && !isLoading) {
    return `
      <div class="td-staff-access-import-card">
        <div class="td-staff-access-import-head">
          <div>
            <h4>CSV staff import</h4>
            <p>Upload a CSV to create or update staff directory records. Imported staff will be added in Pending access until an admin reviews and approves intended access.</p>
            <p>Required columns: ${escapeHtml(getStaffImportRequiredColumns().join(", "))}. Optional columns: ${escapeHtml(getStaffImportOptionalColumns().join(", "))}.</p>
          </div>
        </div>
        <div class="td-staff-access-import-actions">
          <input
            class="td-input td-input--file"
            type="file"
            accept=".csv,text/csv"
            data-field="staff-access-csv-file"
            ${getStaffAccessState()?.mutating ? "disabled" : ""}
          />
        </div>
      </div>
    `;
  }

  if (isLoading) {
    return `
      <div class="td-staff-access-import-card">
        <div class="td-empty td-empty--compact">
          <strong>Preparing CSV preview...</strong>
        </div>
      </div>
    `;
  }

  if (!preview) {
    return `
      <div class="td-staff-access-import-card">
        <div class="td-empty td-empty--compact">
          <strong>Could not prepare the CSV preview.</strong>
          <p>${escapeHtml(previewError || "Please choose a valid CSV file.")}</p>
        </div>
        <div class="td-staff-access-import-actions">
          <input
            class="td-input td-input--file"
            type="file"
            accept=".csv,text/csv"
            data-field="staff-access-csv-file"
            ${getStaffAccessState()?.mutating ? "disabled" : ""}
          />
        </div>
      </div>
    `;
  }

  const sections = [
    { key: "error", title: "Rows with errors", rows: preview.rows.filter((row) => row.action === "error") },
    { key: "create", title: "New staff to create", rows: preview.rows.filter((row) => row.action === "create") },
    { key: "update", title: "Existing staff to update", rows: preview.rows.filter((row) => row.action === "update") },
    { key: "skip", title: "Rows skipped", rows: preview.rows.filter((row) => row.action === "skip") },
  ].filter((section) => section.rows.length);

  return `
    <div class="td-staff-access-import-card">
      <div class="td-staff-access-import-head">
        <div>
          <h4>Review staff before import</h4>
          <p>Suggested roles and scopes are shown for reference only and will not be applied automatically.</p>
        </div>
        <div class="td-staff-access-import-file">
          <strong>${escapeHtml(getStaffAccessState()?.importFileName || "CSV preview")}</strong>
        </div>
      </div>
      ${
        preview.errors.length
          ? `<div class="td-staff-access-warning-list">${preview.errors.map((item) => `<div class="td-staff-access-warning"><strong>Import error</strong><p>${escapeHtml(item)}</p></div>`).join("")}</div>`
          : ""
      }
      ${
        preview.unknownColumns.length
          ? `<p class="td-staff-access-note td-staff-access-note--compact">Ignored extra columns: ${escapeHtml(preview.unknownColumns.join(", "))}</p>`
          : ""
      }
      <div class="td-staff-access-import-summary">
        <span>${escapeHtml(formatStaffAccessCountLabel(preview.summary?.created_count || 0, "new row"))}</span>
        <span>${escapeHtml(formatStaffAccessCountLabel(preview.summary?.updated_count || 0, "update"))}</span>
        <span>${escapeHtml(formatStaffAccessCountLabel(preview.summary?.skipped_count || 0, "skip"))}</span>
        <span>${escapeHtml(formatStaffAccessCountLabel(preview.summary?.warning_count || 0, "warning"))}</span>
        <span>${escapeHtml(formatStaffAccessCountLabel(preview.summary?.error_count || 0, "error"))}</span>
      </div>
      <div class="td-staff-access-import-preview-list">
        ${sections.map((section) => `
          <div class="td-staff-access-import-preview-group">
            <div class="td-staff-access-import-preview-head">
              <strong>${escapeHtml(section.title)}</strong>
              <span>${escapeHtml(String(section.rows.length))}</span>
            </div>
            ${section.rows.map((row) => `
              <div class="td-staff-access-import-row">
                <div class="td-staff-access-import-row-head">
                  <div>
                    <strong>${escapeHtml(row?.full_name || "Unnamed staff member")}</strong>
                    <span>${escapeHtml(row?.email || "No email")}</span>
                  </div>
                  <span class="td-pill ${row?.action === "error" ? "td-pill--muted" : ""}">${escapeHtml(row?.action_label || "Review row")}</span>
                </div>
                <div class="td-staff-access-import-row-copy">
                  <p>${escapeHtml(row?.matched_profile_id ? `Matched existing record${row?.matched_by ? ` by ${row.matched_by.replaceAll("_", " ")}` : ""}.` : "No existing staff record matched.")}</p>
                  ${
                    row?.role_suggestion
                      || row?.department_suggestion_values?.length
                      || row?.year_group_suggestion_values?.length
                      || row?.class_scope_suggestion_values?.length
                      ? `
                        <p>
                          ${escapeHtml([
                            row?.role_suggestion ? `Role: ${row.role_suggestion}` : "",
                            row?.department_suggestion_values?.length ? `Department: ${row.department_suggestion_values.join(", ")}` : "",
                            row?.year_group_suggestion_values?.length ? `Year group: ${row.year_group_suggestion_values.join(", ")}` : "",
                            row?.class_scope_suggestion_values?.length ? `Class: ${row.class_scope_suggestion_values.join(", ")}` : "",
                          ].filter(Boolean).join(" | "))}
                        </p>
                      `
                      : ""
                  }
                  ${row?.safe_updates?.length ? `<p>${escapeHtml(row.safe_updates.join(" | "))}</p>` : ""}
                  ${row?.warnings?.length ? `<div class="td-staff-access-import-row-messages">${row.warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}</div>` : ""}
                  ${row?.errors?.length ? `<div class="td-staff-access-import-row-messages is-error">${row.errors.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
                </div>
              </div>
            `).join("")}
          </div>
        `).join("")}
      </div>
      <div class="td-staff-access-import-actions">
        <input
          class="td-input td-input--file"
          type="file"
          accept=".csv,text/csv"
          data-field="staff-access-csv-file"
          ${getStaffAccessState()?.mutating ? "disabled" : ""}
        />
        <button
          class="td-btn td-btn--ghost"
          type="button"
          data-action="clear-staff-import-preview"
          ${getStaffAccessState()?.mutating ? "disabled" : ""}
        >
          Cancel preview
        </button>
        <button
          class="td-btn"
          type="button"
          data-action="commit-staff-import"
          ${getStaffAccessState()?.mutating || !preview.canCommit ? "disabled" : ""}
        >
          Import to Pending access
        </button>
      </div>
    </div>
  `;
}

function renderStaffAccessImportSuggestionsCard(profile = null) {
  const rows = getStaffAccessImportSuggestionRows(profile);
  if (!rows.length) return "";

  return `
    <div class="td-staff-access-summary-card">
      <span class="td-staff-access-head-inline">
        <span>Import suggestions</span>
        ${renderStaffAccessInlineTip("Suggested roles and scopes are reference only. They do not grant access until an admin reviews and applies the right workflow.", "Import help")}
      </span>
      <div class="td-staff-access-import-detail-list">
        ${rows.map((row) => `
          <div class="td-staff-access-import-detail-item">
            <strong>${escapeHtml(row.label)}</strong>
            <span>${escapeHtml(row.value)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderStaffPendingDuplicateConflictList(conflicts = []) {
  const safeConflicts = Array.isArray(conflicts) ? conflicts.filter((item) => item?.message || item?.kind) : [];
  if (!safeConflicts.length) return "";

  return `
    <div class="td-staff-access-warning-list">
      ${safeConflicts.map((conflict) => {
        const relatedProfiles = Array.isArray(conflict?.conflicting_profiles) ? conflict.conflicting_profiles : [];
        const relatedLabel = relatedProfiles.length
          ? relatedProfiles
            .map((item) => {
              const name = String(item?.display_name || item?.email || "Staff record").trim();
              const email = String(item?.email || "").trim();
              return email && email !== name ? `${name} (${email})` : name;
            })
            .join(", ")
          : "";
        return `
          <div class="td-staff-access-warning">
            <strong>${escapeHtml(String(conflict?.message || "Pending approval is blocked until duplicate staff records are resolved."))}</strong>
            ${relatedLabel ? `<p>${escapeHtml(`Matching records: ${relatedLabel}`)}</p>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderStaffPendingAccessPreflightCard() {
  const preflight = getStaffAccessState()?.pendingDuplicatePreflight || createDefaultStaffPendingDuplicatePreflight();
  if (!preflight?.has_conflicts) return "";

  const summaryParts = [];
  if (Number(preflight?.email_conflict_count || 0) > 0) {
    summaryParts.push(formatStaffAccessCountLabel(preflight.email_conflict_count, "email conflict"));
  }
  if (Number(preflight?.external_id_conflict_count || 0) > 0) {
    summaryParts.push(formatStaffAccessCountLabel(preflight.external_id_conflict_count, "external staff ID conflict"));
  }
  const previewConflicts = [
    ...(Array.isArray(preflight?.email_conflicts) ? preflight.email_conflicts : []),
    ...(Array.isArray(preflight?.external_id_conflicts) ? preflight.external_id_conflicts : []),
  ].slice(0, 4);

  return `
    <div class="td-staff-access-warning-list">
      <div class="td-staff-access-warning">
        <strong>Directory review needed before some pending approvals can activate.</strong>
        <p>${escapeHtml(summaryParts.join(" and ") || "Duplicate staff records need review.")}</p>
      </div>
    </div>
    ${renderStaffPendingDuplicateConflictList(previewConflicts)}
  `;
}

function renderStaffPendingApprovalIntentSummary() {
  const draft = getStaffPendingApprovalDraft();
  const safeScopes = Array.isArray(draft?.scopes) ? draft.scopes : [];
  return `
    <div class="td-staff-access-summary-card">
      <span class="td-staff-access-head-inline">
        <span>Intended access</span>
        ${renderStaffAccessInlineTip("These roles and scopes stay pending until the exact Google email signs in and links safely.", "Pending access help")}
      </span>
      ${
        draft.roles.length
          ? `
            <div class="td-staff-access-chip-row">
              ${draft.roles.map((role) => `<span class="td-staff-access-chip">${escapeHtml(getStaffAccessRoleLabel(role))}</span>`).join("")}
            </div>
          `
          : `
            <div class="td-empty td-empty--compact">
              <strong>No intended roles selected yet.</strong>
            </div>
          `
      }
      ${
        safeScopes.length
          ? `
            <div class="td-staff-access-chip-row">
              ${safeScopes.map((scope) => `
                <span class="td-staff-access-chip td-staff-access-chip--scope">
                  ${escapeHtml(`${getStaffAccessRoleLabel(scope.role)}: ${getStaffAccessScopeLabel(scope)}`)}
                </span>
              `).join("")}
            </div>
          `
          : '<p class="td-staff-access-note td-staff-access-note--compact">No scoped overlays selected yet.</p>'
      }
    </div>
  `;
}

function renderStaffPendingApprovalStatusCard(profile = null) {
  const detail = getSelectedStaffPendingApproval();
  const approval = detail?.approval;
  const statusLabel = approval?.status === "approved"
    ? "Approved pending sign-in"
    : approval?.status === "invalidated"
      ? "Needs review"
      : approval?.status === "activated"
        ? "Activated"
        : "Not approved yet";
  const exactEmail = String(approval?.approved_email || profile?.email || "").trim();
  const statusRows = [
    { label: "Workflow", value: "Unlinked profile -> pending approval workflow" },
    { label: "Status", value: statusLabel },
    { label: "Exact email", value: exactEmail || "Missing email" },
  ];
  if (approval?.approved_at) {
    statusRows.push({ label: "Last approved", value: formatStaffAccessDateTime(approval.approved_at) });
  }
  if (approval?.stale_after_at) {
    statusRows.push({
      label: approval?.is_stale ? "Review overdue" : "Review by",
      value: formatStaffAccessDateTime(approval.stale_after_at),
    });
  }

  return `
    <div class="td-staff-access-summary-card">
      <span class="td-staff-access-head-inline">
        <span>Pending approval</span>
        ${renderStaffAccessInlineTip("Access is not live yet. Activation only happens after exact-email sign-in and safe linking.", "Workflow help")}
      </span>
      <div class="td-staff-access-import-detail-list">
        ${statusRows.map((row) => `
          <div class="td-staff-access-import-detail-item">
            <strong>${escapeHtml(row.label)}</strong>
            <span>${escapeHtml(row.value)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderStaffPendingApprovalScopeChecklist({
  role = "",
  scopeType = "",
  title = "",
  helperText = "",
  options = [],
} = {}) {
  const safeRole = String(role || "").trim().toLowerCase();
  const safeScopeType = String(scopeType || "").trim().toLowerCase();
  const safeOptions = Array.isArray(options) ? options.filter((item) => item?.value) : [];
  const selectedValues = getStaffPendingApprovalDraftScopeValueSet(safeRole, safeScopeType);
  const disabled = !!getStaffAccessState()?.mutating || !canManageSelectedStaffPendingApproval();

  return `
    <div class="td-staff-access-scope-block">
      <div class="td-staff-access-scope-head">
        <span class="td-staff-access-head-inline">
          <strong>${escapeHtml(title || getStaffAccessScopeTypeLabel(safeScopeType))}</strong>
          ${renderStaffAccessInlineTip(getStaffAccessScopeHelpText(safeScopeType), `${getStaffAccessScopeTypeLabel(safeScopeType)} help`)}
        </span>
      </div>
      ${
        safeOptions.length
          ? `
            <div class="td-staff-access-checklist">
              ${safeOptions.map((option) => `
                <label class="td-staff-access-check-item">
                  <input
                    type="checkbox"
                    data-field="staff-pending-approval-scope"
                    data-role="${escapeAttr(safeRole)}"
                    data-scope-type="${escapeAttr(safeScopeType)}"
                    value="${escapeAttr(option.value)}"
                    ${selectedValues.has(option.value) ? "checked" : ""}
                    ${disabled ? "disabled" : ""}
                  />
                  <span class="td-staff-access-check-copy">
                    <strong>${escapeHtml(sanitizeStaffAccessText(option.label || option.value))}</strong>
                  </span>
                </label>
              `).join("")}
            </div>
          `
          : `
            <div class="td-empty td-empty--compact">
              <strong>${escapeHtml(`No ${String(title || getStaffAccessScopeTypeLabel(safeScopeType)).toLowerCase()} are available yet.`)}</strong>
            </div>
          `
      }
      ${helperText ? `<p class="td-staff-access-note td-staff-access-note--compact">${escapeHtml(helperText)}</p>` : ""}
    </div>
  `;
}

function renderStaffPendingApprovalRoleCard(role = "") {
  const safeRole = String(role || "").trim().toLowerCase();
  const roleLabel = getStaffAccessRoleLabel(safeRole);
  const isSelected = getStaffPendingApprovalDraftRoleSet().has(safeRole);
  const disabled = !!getStaffAccessState()?.mutating || !canManageSelectedStaffPendingApproval();
  const yearGroupOptions = getStaffAccessYearGroupOptions().map((item) => ({ value: item, label: item }));
  const departmentOptions = getStaffAccessDepartmentOptions().map((item) => ({ value: item, label: item }));
  const classOptions = getStaffPendingApprovalFilteredClassOptions(safeRole);

  return `
    <article class="td-staff-access-role-card ${isSelected ? "is-active" : ""}">
      <label class="td-staff-access-check-item">
        <input
          type="checkbox"
          data-field="staff-pending-approval-role"
          data-role="${escapeAttr(safeRole)}"
          value="${escapeAttr(safeRole)}"
          ${isSelected ? "checked" : ""}
          ${disabled ? "disabled" : ""}
        />
        <span class="td-staff-access-check-copy">
          <strong>${escapeHtml(roleLabel)}</strong>
          <em>${escapeHtml(getStaffAccessRoleDescription(safeRole))}</em>
        </span>
      </label>
      ${
        safeRole === "teacher"
          ? '<p class="td-staff-access-note td-staff-access-note--compact">Teacher does not take explicit scopes in this phase.</p>'
          : ""
      }
      ${
        isSelected && isStaffPendingApprovalAutoScopeRole(safeRole)
          ? '<p class="td-staff-access-note td-staff-access-note--compact">Schoolwide access will be applied automatically if this approval activates.</p>'
          : ""
      }
      ${
        isSelected && safeRole === "hoy"
          ? `
            <div class="td-staff-access-scope-grid">
              ${renderStaffPendingApprovalScopeChecklist({
                role: safeRole,
                scopeType: "year_group",
                title: "Year groups",
                helperText: "Choose year groups for broader oversight, and add class scopes only when a narrower exception is helpful.",
                options: yearGroupOptions,
              })}
              ${renderStaffPendingApprovalScopeChecklist({
                role: safeRole,
                scopeType: "class",
                title: "Classes",
                helperText: "Class scopes are optional. The list narrows to selected year groups when any are ticked.",
                options: classOptions,
              })}
            </div>
          `
          : ""
      }
      ${
        isSelected && safeRole === "hod"
          ? `
            <div class="td-staff-access-scope-grid">
              ${renderStaffPendingApprovalScopeChecklist({
                role: safeRole,
                scopeType: "department",
                title: "Departments",
                helperText: "Choose departments for broader oversight, and add class scopes only when a narrower exception is helpful.",
                options: departmentOptions,
              })}
              ${renderStaffPendingApprovalScopeChecklist({
                role: safeRole,
                scopeType: "class",
                title: "Classes",
                helperText: "Class scopes are optional. The list narrows to selected departments when any are ticked.",
                options: classOptions,
              })}
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderStaffPendingAccessDetail(profile = null) {
  const detail = getSelectedStaffPendingApproval();
  const approval = detail?.approval;
  const failureMessage = getStaffPendingApprovalFailureMessage(detail);
  const draftWarnings = getStaffPendingApprovalDraftWarnings();
  const canApprove = canManageSelectedStaffPendingApproval();
  const duplicateConflicts = Array.isArray(detail?.duplicate_conflicts) ? detail.duplicate_conflicts : [];

  return `
    ${renderStaffAccessWarnings()}
    ${
      failureMessage
        ? `
          <div class="td-staff-access-warning-list">
            <div class="td-staff-access-warning">
              <strong>${escapeHtml(approval?.status === "invalidated" ? "Approval cleared" : "Activation blocked")}</strong>
              <p>${escapeHtml(failureMessage)}</p>
            </div>
          </div>
        `
        : ""
    }
    ${renderStaffPendingDuplicateConflictList(duplicateConflicts)}
    ${
      draftWarnings.length
        ? `
          <div class="td-staff-access-warning-list">
            ${draftWarnings.map((warning) => `
              <div class="td-staff-access-warning">
                <strong>Review before approving</strong>
                <p>${escapeHtml(warning)}</p>
              </div>
            `).join("")}
          </div>
        `
        : ""
    }
    <div class="td-staff-access-summary-grid">
      ${renderStaffPendingApprovalStatusCard(profile)}
      ${renderStaffPendingApprovalIntentSummary()}
      ${renderStaffAccessImportSuggestionsCard(profile)}
    </div>
    <div class="td-staff-access-summary-card">
      <span class="td-staff-access-head-inline">
        <span>Pending sign-in workflow</span>
        ${renderStaffAccessInlineTip("Linked profiles use live access controls. Unlinked profiles use this approval workflow only.", "Workflow split")}
      </span>
      <p class="td-staff-access-note">
        Access is not live yet. Review the imported record, choose intended roles and scopes, then save the approval bundle.
        It only activates after the exact email signs in and the row links safely.
      </p>
      ${
        !canApprove
          ? '<p class="td-staff-access-note td-staff-access-note--warning">This record cannot be approved yet. Resolve the review issues above first.</p>'
          : ""
      }
    </div>
    <div class="td-staff-access-role-grid">
      ${STAFF_ACCESS_MANAGED_ROLES.map((role) => renderStaffPendingApprovalRoleCard(role)).join("")}
    </div>
    <div class="td-staff-access-summary-card">
      <div class="td-staff-access-role-footer">
        <div class="td-staff-access-role-btns">
          <button
            class="td-btn"
            type="button"
            data-action="approve-staff-pending-access"
            ${getStaffAccessState()?.mutating || !canApprove || !getStaffPendingApprovalDraft().roles.length ? "disabled" : ""}
          >
            Approve pending sign-in
          </button>
          ${
            approval?.status === "approved"
              ? `
                <button
                  class="td-btn td-btn--ghost td-btn--small td-staff-access-btn--danger"
                  type="button"
                  data-action="cancel-staff-pending-access"
                  ${getStaffAccessState()?.mutating ? "disabled" : ""}
                >
                  Cancel pending approval
                </button>
              `
              : ""
          }
        </div>
      </div>
      <p class="td-staff-access-note td-staff-access-note--compact">
        Linked profile -> live access workflow. Unlinked profile -> pending approval workflow.
      </p>
    </div>
  `;
}

function renderStaffAccessLiveDetail(selectedProfile = null) {
  return `
    ${renderStaffAccessWarnings()}
    <div class="td-staff-access-summary-grid">
      <div class="td-staff-access-summary-card">
        <span class="td-staff-access-head-inline">
          <span>Active roles</span>
          ${renderStaffAccessInlineTip(getStaffAccessSummaryHelpText("role"), "Role help")}
        </span>
        ${renderStaffAccessRoleSummary()}
      </div>
      <div class="td-staff-access-summary-card">
        <span class="td-staff-access-head-inline">
          <span>Active scopes</span>
          ${renderStaffAccessInlineTip(getStaffAccessSummaryHelpText("scope"), "Scope help")}
        </span>
        ${renderStaffAccessScopeSummary()}
      </div>
      ${renderStaffAccessImportSuggestionsCard(selectedProfile)}
    </div>
    <div class="td-staff-access-role-grid">
      ${STAFF_ACCESS_MANAGED_ROLES.map((role) => renderStaffAccessRoleCard(role)).join("")}
    </div>
    <div class="td-staff-access-audit-card">
      <div class="td-staff-access-audit-head">
        <h4>Recent access changes</h4>
        <span>Latest ${escapeHtml(String(STAFF_ACCESS_AUDIT_LIMIT))}</span>
      </div>
      ${renderStaffAccessAuditList()}
    </div>
  `;
}

function renderSectionStaffAccess() {
  if (!canManageRoles()) return "";
  const isOpen = !!state.sections.staffAccess;
  const selectedProfile = getStaffAccessSelectedProfile();
  const selectedProfileLinked = isStaffAccessProfileLinked(selectedProfile);
  const filteredProfiles = getStaffAccessFilteredProfiles();
  const hasDirectorySearch = !!String(getStaffAccessState()?.search || "").trim();
  const directoryEmptyMessage = "Only staff who have signed in and opened the staff dashboard appear here yet. Imported CSV staff will also appear here in Pending access.";

  return `
    <section class="td-section td-section--staff-access">
      ${renderCollapsibleSectionHeader({
        title: "Staff access",
        section: "staffAccess",
        isOpen,
      })}
      ${
        isOpen
          ? `
            <div class="td-section-body">
              ${renderStaffAccessImportResultCard()}
              ${renderStaffAccessImportPreviewCard()}
              ${renderStaffPendingAccessPreflightCard()}
              <div class="td-staff-access-layout">
                <aside class="td-staff-access-sidebar">
                  ${renderStaffAccessFilterBar()}
                  <div class="td-search-row">
                    <input
                      class="td-input"
                      type="text"
                      data-field="staff-access-search"
                      value="${escapeAttr(String(getStaffAccessState()?.search || ""))}"
                      placeholder="Search staff by name or email..."
                      autocomplete="off"
                    />
                  </div>
                  ${
                    getStaffAccessState()?.loadingDirectory
                      ? `
                        <div class="td-empty td-empty--compact">
                          <strong>Loading staff directory...</strong>
                        </div>
                      `
                      : getStaffAccessState()?.error
                        ? `
                          <div class="td-empty td-empty--compact">
                            <strong>Could not load staff access.</strong>
                            <p>${escapeHtml(getStaffAccessState().error)}</p>
                          </div>
                        `
                        : filteredProfiles.length
                          ? `
                            <div class="td-staff-access-directory">
                              ${filteredProfiles.map((profile) => {
                                const isSelected = String(profile?.id || "") === getStaffAccessSelectedProfileId();
                                const isCurrentUser = String(profile?.user_id || "") === getCurrentTeacherId();
                                return `
                                  <button
                                    class="td-staff-access-person ${isSelected ? "is-selected" : ""}"
                                    type="button"
                                    data-action="select-staff-profile"
                                    data-profile-id="${escapeAttr(profile.id)}"
                                    ${getStaffAccessState()?.mutating ? "disabled" : ""}
                                  >
                                    <span class="td-staff-access-person-copy">
                                      <strong>${escapeHtml(profile.display_name)}</strong>
                                      <span>${escapeHtml(profile.email)}</span>
                                    </span>
                                    <span class="td-staff-access-person-badges">
                                      ${renderStaffAccessProfileBadges(profile, { includeCurrentUser: isCurrentUser })}
                                    </span>
                                  </button>
                                `;
                              }).join("")}
                            </div>
                          `
                          : `
                            <div class="td-empty td-empty--compact">
                              <strong>${escapeHtml(hasDirectorySearch ? "No staff match this search." : "No staff to show yet.")}</strong>
                              <p>${escapeHtml(directoryEmptyMessage)}</p>
                            </div>
                          `
                  }
                </aside>

                <div class="td-staff-access-main">
                  ${
                    !selectedProfile
                      ? `
                        <div class="td-empty">
                          <strong>Select a staff member to view roles, scopes, and recent access changes.</strong>
                          <p>Only staff who have signed in and opened the staff dashboard appear here yet. Imported CSV staff will also appear here in Pending access.</p>
                        </div>
                      `
                      : `
                        <div class="td-staff-access-detail">
                          <div class="td-staff-access-header">
                            <div>
                              <h3>${escapeHtml(selectedProfile.display_name)}</h3>
                              <p>${escapeHtml(selectedProfile.email)}</p>
                            </div>
                            <div class="td-staff-access-header-pills">
                              ${renderStaffAccessProfileBadges(selectedProfile, { includeCurrentUser: true })}
                            </div>
                          </div>

                          ${
                            getStaffAccessState()?.loadingDetails
                              ? `
                                <div class="td-empty td-empty--compact">
                                  <strong>Loading access details...</strong>
                                </div>
                              `
                              : getStaffAccessState()?.detailError
                                ? `
                                  <div class="td-empty td-empty--compact">
                                    <strong>Could not load this staff member’s access.</strong>
                                    <p>${escapeHtml(getStaffAccessState().detailError)}</p>
                                  </div>
                                `
                                : (selectedProfileLinked
                                  ? renderStaffAccessLiveDetail(selectedProfile)
                                  : renderStaffPendingAccessDetail(selectedProfile))
                          }
                        </div>
                      `
                  }
                </div>
              </div>
            </div>
          `
          : ""
      }
      ${renderStaffAccessConfirmModal()}
    </section>
  `;
}

function renderSectionAnalyticsAssistant() {
  const isOpen = state.sections.analytics;

  return `
    <section class="td-section td-section--analytics">
      ${renderCollapsibleSectionHeader({
        title: "Ask AI",
        section: "analytics",
        isOpen,
      })}

      ${
        isOpen
          ? `
        <div class="td-section-body">
          ${renderAnalyticsAssistantShell({
            title: "Ask about next steps",
            subtitle: "Use the latest spelling data to spot weak areas, patterns, and who needs help next.",
            inline: false,
          })}
        </div>
      `
          : ""
      }
    </section>
  `;
}

function renderInlineAnalyticsAssistant() {
  if (!state.analyticsAssistant.open) return "";
  return renderAnalyticsAssistantShell({
    title: "Ask AI",
    subtitle: "Ask about the current view, then decide what to teach or who needs support next.",
    showCloseButton: true,
    inline: true,
  });
}

function renderSectionUpcomingAssignments() {
  const isOpen = state.sections.upcoming;

  return `
    <section class="td-section td-section--upcoming">
      ${renderCollapsibleSectionHeader({
        title: "Upcoming assignments",
        section: "upcoming",
        isOpen,
      })}

      ${
        isOpen
          ? `
        <div class="td-section-body">
          ${
            state.assignments.length
              ? `<div class="td-list">${state.assignments.map(renderAssignmentCardCompact).join("")}</div>`
              : `
            <div class="td-empty">
              <strong>No assignments yet.</strong>
              <p>Create a test, then assign it to a class to see activity here.</p>
            </div>
          `
          }
        </div>
      `
          : ""
      }
    </section>
  `;
}

function renderSectionTestsLegacy() {
  const isOpen = state.sections.tests;
  const term = state.testSearch.trim().toLowerCase();
  const filteredTests = state.tests.filter((test) =>
    String(test.title || "").toLowerCase().includes(term)
  );

  return `
    <section class="td-section td-section--tests">
      ${renderCollapsibleSectionHeader({
        title: "Tests",
        section: "tests",
        isOpen,
      })}

      ${
        isOpen
          ? `
        <div class="td-section-body">
          <div class="td-search-row">
            <input
              class="td-input"
              type="text"
              data-field="test-search"
              value="${escapeAttr(state.testSearch)}"
              placeholder="Search tests..."
              autocomplete="off"
            />
          </div>

          ${
            state.tests.length
              ? filteredTests.length
                ? `<div class="td-list">${filteredTests.map(renderTestCard).join("")}</div>`
                : `
                <div class="td-empty">
                  <strong>No matching tests.</strong>
                  <p>Try a different search term.</p>
                </div>
              `
              : `
            <div class="td-empty">
              <strong>You haven’t created any tests yet.</strong>
              <p>Use + Create test above to build your first one.</p>
            </div>
          `
          }
        </div>
      `
          : ""
      }
    </section>
  `;
}

const TEST_GROUP_LIMIT = 6;

function matchesTestSearch(test, term) {
  if (!term) return true;
  const haystack = [
    test?.title || "",
    String(test?.question_type || "").replaceAll("_", " "),
    ...(Array.isArray(test?.assigned_class_names) ? test.assigned_class_names : []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function getTestGroupKey(test) {
  if (Number(test?.assignment_count || 0) > 0) return "live";
  if (String(test?.status || "").trim().toLowerCase() === "draft") return "draft";
  return "ready";
}

function getGroupedTests(term) {
  const groups = {
    live: [],
    draft: [],
    ready: [],
  };

  for (const test of state.tests) {
    if (!matchesTestSearch(test, term)) continue;
    groups[getTestGroupKey(test)].push(test);
  }

  groups.live.sort((a, b) => {
    const aTime = a.earliest_deadline ? new Date(a.earliest_deadline).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.earliest_deadline ? new Date(b.earliest_deadline).getTime() : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
  groups.draft.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  groups.ready.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return groups;
}

function renderTestLibrarySummary(groups, filteredCount) {
  return `
    <div class="td-test-summary-row">
      <div class="td-summary-chip">
        <span>Showing</span>
        <strong>${escapeHtml(String(filteredCount))}</strong>
      </div>
      <div class="td-summary-chip">
        <span>Live</span>
        <strong>${escapeHtml(String(groups.live.length))}</strong>
      </div>
      <div class="td-summary-chip">
        <span>Drafts</span>
        <strong>${escapeHtml(String(groups.draft.length))}</strong>
      </div>
      <div class="td-summary-chip">
        <span>Ready</span>
        <strong>${escapeHtml(String(groups.ready.length))}</strong>
      </div>
    </div>
  `;
}

function renderTestGroupSection({ key, title, description, tests, term }) {
  if (!tests.length) return "";

  const isExpanded = !!state.testGroupExpanded[key];
  const shouldCollapse = !term && tests.length > TEST_GROUP_LIMIT;
  const visibleTests = shouldCollapse && !isExpanded ? tests.slice(0, TEST_GROUP_LIMIT) : tests;
  const hiddenCount = Math.max(0, tests.length - visibleTests.length);
  const toggleLabel = isExpanded ? "Show less" : `Show ${hiddenCount} more`;

  return `
    <section class="td-test-group">
      <div class="td-test-group-head">
        <div class="td-test-group-copy">
          <h4>${escapeHtml(title)}</h4>
          <p>${escapeHtml(description)}</p>
        </div>
        <div class="td-test-group-meta">
          <span class="td-pill">${escapeHtml(String(tests.length))}</span>
        </div>
      </div>
      <div class="td-list">${visibleTests.map(renderTestCard).join("")}</div>
      ${
        shouldCollapse
          ? `
            <div class="appShowMoreWrap">
              <button class="appShowMoreButton" type="button" data-action="toggle-test-group" data-group="${escapeAttr(key)}" aria-expanded="${isExpanded ? "true" : "false"}">
                <span>${escapeHtml(toggleLabel)}</span>
                <span class="appShowMoreChevron">${isExpanded ? "&#9650;" : "&#9660;"}</span>
              </button>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderSectionTests() {
  const isOpen = state.sections.tests;
  const term = state.testSearch.trim().toLowerCase();
  const groups = getGroupedTests(term);
  const filteredCount = groups.live.length + groups.draft.length + groups.ready.length;

  return `
    <section class="td-section td-section--tests">
      ${renderCollapsibleSectionHeader({
        title: "Test library",
        section: "tests",
        isOpen,
      })}

      ${
        isOpen
          ? `
        <div class="td-section-body">
          <div class="td-search-row">
            <input
              class="td-input"
              type="text"
              data-field="test-search"
              value="${escapeAttr(state.testSearch)}"
              placeholder="Search tests, classes, or test types..."
              autocomplete="off"
            />
          </div>

          ${
            state.tests.length
              ? filteredCount
                ? `
                  ${renderTestLibrarySummary(groups, filteredCount)}
                  <div class="td-test-groups">
                    ${renderTestGroupSection({
                      key: "live",
                      title: "Live tests",
                      description: "Currently assigned to one or more classes.",
                      tests: groups.live,
                      term,
                    })}
                    ${renderTestGroupSection({
                      key: "draft",
                      title: "Drafts",
                      description: "Still being built or checked before assigning.",
                      tests: groups.draft,
                      term,
                    })}
                    ${renderTestGroupSection({
                      key: "ready",
                      title: "Ready to assign",
                      description: "Built and available, but not currently live in a class.",
                      tests: groups.ready,
                      term,
                    })}
                  </div>
                `
                : `
                <div class="td-empty">
                  <strong>No matching tests.</strong>
                  <p>Try a different search term.</p>
                </div>
              `
              : `
            <div class="td-empty">
              <strong>You haven’t created any tests yet.</strong>
              <p>Use + Create test above to build your first one.</p>
            </div>
          `
          }
        </div>
      `
          : ""
      }
    </section>
  `;
}

function renderSectionClasses() {
  const isOpen = state.sections.classes;

  return `
    <section class="td-section td-section--classes">
      ${renderCollapsibleSectionHeader({
        title: "Your classes",
        section: "classes",
        isOpen,
      })}

      ${
        isOpen
          ? `
        <div class="td-section-body">
          ${
            state.classes.length
              ? `<div class="td-list">${state.classes.map(renderClassCard).join("")}</div>`
              : `
            <div class="td-empty">
              <strong>No classes yet.</strong>
              <p>Create a class above so tests can be assigned later.</p>
            </div>
          `
          }
        </div>
      `
          : ""
      }
    </section>
  `;
}

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function formatOneDecimal(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(1) : "0.0";
}

function getSecurityBand(item) {
  const accuracy = Number(item?.accuracy || 0);
  const firstTrySuccessRate = Number(item?.firstTrySuccessRate || 0);
  const total = Number(item?.total || 0);

  if (total >= 3 && accuracy >= 0.85 && firstTrySuccessRate >= 0.7) return "secure";
  if (accuracy >= 0.6) return "nearly_secure";
  return "insecure";
}

function securityBandLabel(band) {
  if (band === "secure") return "Secure";
  if (band === "nearly_secure") return "Developing";
  return "Needs review";
}

function getStatusMetaByKey(statusKey) {
  return VISUAL_STATUS_FILTER_OPTIONS.find((item) => item.key === statusKey) || VISUAL_STATUS_FILTER_OPTIONS[1];
}

function getAssignmentWordStatusMeta(latestAttempt) {
  if (!latestAttempt) {
    return {
      key: "not_started",
      label: "Not attempted",
      tone: "slate",
      shortLabel: "—",
    };
  }

  const attemptsUsed = Math.max(1, Number(latestAttempt?.attempt_number || 1));
  const correct = !!latestAttempt?.correct;

  if (correct && attemptsUsed <= 1) {
    return {
      key: "secure",
      label: "Correct first go",
      tone: "green",
      shortLabel: "1",
    };
  }

  if (correct) {
    return {
      key: "developing",
      label: "Correct after retry",
      tone: "amber",
      shortLabel: attemptsUsed > 9 ? "9+" : String(attemptsUsed),
    };
  }

  return {
    key: "needs_review",
    label: "Not correct yet",
    tone: "red",
    shortLabel: "x",
  };
}

function buildAssignmentWordResult(wordRow, latestAttempt, targetMeta = null) {
  const wordId = String(wordRow?.id || latestAttempt?.test_word_id || "");
  const word = String(wordRow?.word || latestAttempt?.word_text || "Unknown word").trim() || "Unknown word";
  const statusMeta = getAssignmentWordStatusMeta(latestAttempt);
  const attemptsUsed = latestAttempt ? Math.max(1, Number(latestAttempt?.attempt_number || 1)) : 0;
  const focusGrapheme = String(targetMeta?.focusGrapheme || focusFromAssignmentWordRow(wordRow) || "").trim().toLowerCase();
  const assignmentRole = String(targetMeta?.assignmentRole || wordRow?.choice?.assignment_role || "").trim().toLowerCase();
  const assignmentSupport = String(targetMeta?.assignmentSupport || wordRow?.choice?.assignment_support || "").trim().toLowerCase();
  const attemptSummary = !latestAttempt
    ? "Not yet attempted"
    : latestAttempt?.correct
      ? attemptsUsed === 1
        ? "Correct on the first attempt"
        : `Correct after ${attemptsUsed} attempts`
      : attemptsUsed === 1
        ? "Incorrect on the first attempt"
        : `Incorrect after ${attemptsUsed} attempts`;
  const targetDetail = targetMeta
    ? `${attemptSummary}. Target word${focusGrapheme ? ` for ${focusGrapheme}` : ""}.`
    : `${attemptSummary}.`;

  return {
    wordId,
    word,
    attemptsUsed,
    correct: !!latestAttempt?.correct,
    latestAttempt: latestAttempt || null,
    attemptSummary,
    statusKey: statusMeta.key,
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    statusShortLabel: statusMeta.shortLabel,
    isTargeted: !!targetMeta,
    targetReason: String(targetMeta?.targetReason || ""),
    targetSource: String(targetMeta?.targetSource || ""),
    focusGrapheme,
    assignmentRole,
    assignmentSupport,
    title: `${word}: ${targetDetail}`,
  };
}

function buildAssignmentTargetResult(wordRow, latestAttempt, targetMeta = null) {
  if (!wordRow && !latestAttempt) return null;
  const result = buildAssignmentWordResult(wordRow, latestAttempt, targetMeta);
  return {
    ...result,
    wordId: String(targetMeta?.id || result.wordId || ""),
    assignmentTargetId: String(targetMeta?.id || ""),
    baseTestWordId: String(targetMeta?.testWordId || wordRow?.id || latestAttempt?.test_word_id || ""),
    isTargeted: true,
  };
}

function renderAnalyticsSummaryCardsLegacy(analytics) {
  return `
    <div class="td-analytics-summary-grid">
      <article class="td-analytics-summary-card">
        <div class="td-analytics-summary-label">Pupils started</div>
        <div class="td-analytics-summary-value">${escapeHtml(`${analytics.startedCount} / ${analytics.rosterCount}`)}</div>
      </article>
      <article class="td-analytics-summary-card">
        <div class="td-analytics-summary-label">${escapeHtml(getStandardMetricLabel("completion"))}</div>
        <div class="td-analytics-summary-value">${escapeHtml(formatPercent(analytics.completionRate))}</div>
      </article>
      <article class="td-analytics-summary-card">
        <div class="td-analytics-summary-label">Average score</div>
        <div class="td-analytics-summary-value">${escapeHtml(formatPercent(analytics.averageScore))}</div>
      </article>
      <article class="td-analytics-summary-card">
        <div class="td-analytics-summary-label">${escapeHtml(getStandardMetricLabel("accuracy"))}</div>
        <div class="td-analytics-summary-value">${escapeHtml(formatPercent(analytics.checkedAccuracy))}</div>
      </article>
      <article class="td-analytics-summary-card">
        <div class="td-analytics-summary-label">${escapeHtml(getStandardMetricLabel("average_tries"))}</div>
        <div class="td-analytics-summary-value">${escapeHtml(formatOneDecimal(analytics.averageAttempts))}</div>
      </article>
      <article class="td-analytics-summary-card">
        <div class="td-analytics-summary-label">Not started</div>
        <div class="td-analytics-summary-value">${escapeHtml(String(analytics.notStartedCount))}</div>
      </article>
    </div>
  `;
}

function renderGraphemeInsightsLegacy(items, emptyMessage, tone = "weak") {
  if (!items.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>${escapeHtml(emptyMessage)}</strong>
      </div>
    `;
  }

  return `
    <div class="td-analytics-list">
      ${items.map((item) => `
        <article class="td-analytics-item td-analytics-item--${escapeAttr(tone)}">
          <div class="td-analytics-item-top">
            <strong>${escapeHtml(item.target)}</strong>
            <span class="td-band td-band--${escapeAttr(item.securityBand || "insecure")}">${escapeHtml(securityBandLabel(item.securityBand))}</span>
          </div>
          <div class="td-analytics-item-sub">
            ${escapeHtml(`${item.correct}/${item.total} latest responses correct`)}
          </div>
          <div class="td-analytics-item-sub">
            ${escapeHtml(`Latest accuracy: ${formatPercent(item.accuracy)}`)}
          </div>
          <div class="td-analytics-item-sub">
            ${escapeHtml(`First-try success: ${formatPercent(item.firstTrySuccessRate)}`)}
          </div>
          <div class="td-analytics-item-sub">
            ${escapeHtml(`Average tries: ${formatOneDecimal(item.averageAttempts)}`)}
          </div>
          <div class="td-analytics-item-sub">
            ${escapeHtml(`Words: ${item.wordSamples.join(", ")}`)}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderHardestWordsLegacy(items) {
  if (!items.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No word-level data yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-analytics-list">
      ${items.map((item) => `
        <article class="td-analytics-item">
          <div class="td-analytics-item-top">
            <strong>${escapeHtml(item.word)}</strong>
            <span>${escapeHtml(formatPercent(item.accuracy))}</span>
          </div>
          <div class="td-analytics-item-sub">
            ${escapeHtml(`${item.correct}/${item.total} pupils correct on their latest try`)}
          </div>
          <div class="td-analytics-item-sub">
            ${escapeHtml(`Average tries: ${formatOneDecimal(item.averageAttempts)}`)}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderTimelineRows(items) {
  if (!items.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No attempt history yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-timeline-list">
      ${items.map((item) => `
        <div class="td-timeline-row">
          <div class="td-timeline-copy">
            <strong>${escapeHtml(item.dayKey)}</strong>
            <span>${escapeHtml(`${item.attemptCount} attempts by ${item.pupilCount} pupil${item.pupilCount === 1 ? "" : "s"}`)}</span>
          </div>
          <div class="td-timeline-bar">
            <span style="width:${Math.max(6, Math.round(item.accuracy * 100))}%"></span>
          </div>
          <div class="td-timeline-rate">${escapeHtml(formatPercent(item.accuracy))}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPupilRowsLegacy(items) {
  if (!items.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No pupils in this class yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-pupil-table">
      ${items.map((item) => `
        <div class="td-pupil-row ${item.status === "Not started" ? "is-muted" : ""}">
          <div class="td-pupil-main">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.status)}</span>
          </div>
          <div class="td-pupil-metric">${escapeHtml(`${item.correctWords}/${item.attemptedWords || 0} words checked`)}</div>
          <div class="td-pupil-metric">${escapeHtml(`${formatPercent(item.scoreRate)} score`)}</div>
          <div class="td-pupil-metric">${escapeHtml(`${formatOneDecimal(item.averageAttempts)} tries`)}</div>
          <div class="td-pupil-metric">${escapeHtml(item.priorityTarget ? `Watch: ${item.priorityTarget}` : "Watch: —")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderClassComparison(rows) {
  if (rows.length <= 1) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No class comparison yet.</strong>
        <p>Assign this same test to another class to compare progress.</p>
      </div>
    `;
  }

  return `
    <div class="td-comparison-table">
      <div class="td-comparison-row td-comparison-row--head">
        <span>Class</span>
        <span>Started</span>
        <span>Completed</span>
        <span>Average score</span>
      </div>
      ${rows.map((item) => `
        <div class="td-comparison-row ${item.isCurrent ? "is-current" : ""}">
          <span>${escapeHtml(item.className)}</span>
          <span>${escapeHtml(`${item.startedCount}/${item.rosterCount}`)}</span>
          <span>${escapeHtml(String(item.completedCount))}</span>
          <span>${escapeHtml(formatPercent(item.averageScore))}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderVisualSummaryCards(summary) {
  const noValue = "--";
  const attainmentLabel = summary.scopeType === "pupil" ? "Current spelling level" : "Typical level";
  const attainmentValue = getSummaryAttainmentLevel(summary);
  const attainmentPerformance = getSummaryAttainmentSecurity(summary);
  const attainmentSubtext = getSummaryAttainmentSubtext(summary);
  const attainmentBodyHtml = buildTeacherAttainmentCardBodyHtml({
    levelText: attainmentValue,
    levelTooltip: getSummaryAttainmentLevelDefinition(summary),
    performanceText: attainmentPerformance,
    performanceTooltip: getSummaryAttainmentPerformanceDefinition(summary),
    metaLines: buildVisualSummaryAttainmentMetaLines(summary),
    layout: "horizontal",
  });
  return `
    <div class="td-analytics-summary-hero-row">
      ${renderAnalyticsMetricCardWithInfo("award", attainmentLabel, attainmentValue, getVisualSummaryMetricInfoText("attainment", summary), attainmentSubtext, {
        className: "td-analytics-summary-card--primary td-analytics-summary-card--hero",
        showLeadingIcon: false,
        infoHtml: buildAttainmentGuideInfoHtml(attainmentSubtext),
        bodyHtml: attainmentBodyHtml,
      })}
    </div>
    <div class="td-analytics-summary-grid td-analytics-summary-grid--visual td-analytics-summary-grid--visual-secondary">
      ${renderAnalyticsMetricCardWithInfo("target", getStandardMetricLabel("accuracy"), summary.checkedWords ? formatPercent(summary.accuracy) : noValue, getVisualSummaryMetricInfoText("accuracy", summary), "", { showLeadingIcon: false })}
      ${renderAnalyticsMetricCardWithInfo("zap", getStandardMetricLabel("first_try"), summary.checkedWords ? formatPercent(summary.firstTrySuccessRate) : noValue, getVisualSummaryMetricInfoText("first_try", summary), "", { showLeadingIcon: false })}
      ${renderAnalyticsMetricCardWithInfo("repeat", getStandardMetricLabel("average_tries"), summary.checkedWords ? formatOneDecimal(summary.averageAttempts) : noValue, getVisualSummaryMetricInfoText("average_tries", summary), "", { showLeadingIcon: false })}
      ${renderAnalyticsMetricCardWithInfo("list", getStandardMetricLabel("checked"), String(summary.checkedWords), getVisualSummaryMetricInfoText("checked", summary), "", { showLeadingIcon: false })}
      ${renderAnalyticsMetricCardWithInfo(summary.scopeType === "pupil" ? "grid" : "users", getStandardMetricLabel("pupils", { scopeType: summary.scopeType }), String(summary.scopeType === "pupil" ? summary.classCount : summary.pupilCount), getVisualSummaryMetricInfoText("pupils", summary), "", { showLeadingIcon: false })}
    </div>
  `;
}

function renderVisualPupilCards(items) {
  const visible = (items || []).slice(0, 12);
  if (!visible.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No pupils to show yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-visual-pupil-list">
      ${visible.map((item) => {
        const statusMeta = getVisualPupilStatusMeta(item);
        return `
        <button
          type="button"
          class="td-visual-mini-card ${statusMeta.key === "needs_review" ? "is-alert" : ""}"
          data-action="open-visual-summary"
          data-scope-type="pupil"
          data-scope-id="${escapeAttr(item.pupilId || "")}"
        >
          <div class="td-visual-mini-top">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.checkedWords ? formatPercent(item.accuracy) : "No attempts")}</span>
          </div>
          <div class="td-visual-mini-sub">${escapeHtml(item.classNames?.join(", ") || "No active classes")}</div>
          <div class="td-visual-mini-sub">${item.weakGraphemes.length ? renderIconLabel("book", `Focus: ${item.weakGraphemes.join(", ")}`) : escapeHtml("No standout focus yet")}</div>
        </button>
      `;
      }).join("")}
    </div>
  `;
}

function renderVisualPupilTable(items) {
  const visible = (items || []).slice(0, 30);
  if (!visible.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No pupils to show yet.</strong>
      </div>
    `;
  }

  return renderSyncedScrollShell(`
    <div class="td-visual-pupil-table">
      <div class="td-visual-pupil-table-head">
        <span>Pupil</span>
        <span>${renderIconOnly("list", "Checked words")}</span>
        <span>${renderIconOnly("target", "Accuracy")}</span>
        <span>${renderIconOnly("repeat", "Average tries")}</span>
        <span>${renderIconOnly("book", "Focus graphemes")}</span>
      </div>
      ${visible.map((item) => {
        const signal = item.signalTone && item.signalLabel
          ? { tone: item.signalTone, label: item.signalLabel }
          : getVisualPupilSignal(item);
        const statusMeta = getVisualPupilStatusMeta(item);
        const focusText = item.weakGraphemes.length ? item.weakGraphemes.join(", ") : "--";
        return `
          <button
            type="button"
            class="td-visual-pupil-row td-visual-pupil-row--${escapeAttr(statusMeta.key)} ${signal.tone === "red" ? "is-alert" : ""}"
            data-action="open-visual-summary"
            data-scope-type="pupil"
            data-scope-id="${escapeAttr(item.pupilId || "")}"
          >
            <div class="td-visual-pupil-cell td-visual-pupil-cell--main">
              <div class="td-visual-pupil-main-top">
                <strong>${escapeHtml(item.name)}</strong>
                ${renderPupilSignalBadge(signal, { title: `${item.name}: ${statusMeta.label}` })}
              </div>
              <span>${escapeHtml(`${statusMeta.label} • ${formatSpellingIndicatorSummary(item.attainmentIndicator, { short: true })}`)}</span>
            </div>
            <div class="td-visual-pupil-cell">${escapeHtml(String(item.checkedWords || 0))}</div>
            <div class="td-visual-pupil-cell">${escapeHtml(item.checkedWords ? formatPercent(item.accuracy) : "--")}</div>
            <div class="td-visual-pupil-cell">${escapeHtml(item.checkedWords ? formatOneDecimal(item.averageAttempts) : "--")}</div>
            <div class="td-visual-pupil-cell td-visual-pupil-cell--focus">${escapeHtml(focusText)}</div>
          </button>
        `;
      }).join("")}
      ${
        items.length > visible.length
          ? `<p class="td-chat-note">Showing the first ${escapeHtml(String(visible.length))} pupils.</p>`
          : ""
      }
    </div>
  `, {
    shellClassName: "td-visual-pupil-table-shell",
    viewportClassName: "td-visual-pupil-table-wrap",
  });
}

function formatAverageIndicatorValueLegacy(value) {
  return value == null ? "—" : String(Math.round(Number(value || 0)));
}

function getSpellingIndicatorInfoTextLegacy() {
  return `${getSpellingIndicatorTeacherDescription()} ${getSpellingIndicatorTechnicalDescription()}`;
}

function formatSpellingIndicatorSummaryLegacy(indicator, { short = false } = {}) {
  if (!indicator || indicator?.score == null) {
    return short ? "Indicator awaiting evidence" : "Spelling Attainment Indicator awaiting evidence";
  }

  const parts = [short ? `SAI ${indicator.score}` : `Spelling Attainment Indicator ${indicator.score}`];
  if (indicator?.evidence?.label) parts.push(indicator.evidence.label);
  return parts.join(" • ");
}

function renderAnalyticsSummaryCards(analytics) {
  const indicatorInfo = getSpellingIndicatorInfoText();
  const attainmentValue = getSummaryAttainmentLevel(analytics);
  const attainmentPerformance = getSummaryAttainmentSecurity(analytics);
  const attainmentSubtext = getSummaryAttainmentSubtext(analytics);
  const attainmentBodyHtml = buildTeacherAttainmentCardBodyHtml({
    levelText: attainmentValue,
    levelTooltip: getSummaryAttainmentLevelDefinition(analytics),
    performanceText: attainmentPerformance,
    performanceTooltip: getSummaryAttainmentPerformanceDefinition(analytics),
    metaLines: [buildSummaryAttainmentSubtextHtml(analytics)],
  });
  return `
    <div class="td-analytics-summary-grid">
      ${renderAnalyticsMetricCardWithInfo("award", "Typical level", attainmentValue, indicatorInfo, attainmentSubtext, {
        className: "td-analytics-summary-card--primary",
        infoHtml: buildAttainmentGuideInfoHtml(attainmentSubtext),
        bodyHtml: attainmentBodyHtml,
      })}
      ${renderAnalyticsMetricCard("target", getStandardMetricLabel("accuracy"), formatPercent(analytics.checkedAccuracy))}
      ${renderAnalyticsMetricCard("checkCircle", getStandardMetricLabel("completion"), formatPercent(analytics.completionRate))}
      ${renderAnalyticsMetricCard("repeat", getStandardMetricLabel("average_tries"), formatOneDecimal(analytics.averageAttempts))}
      ${renderAnalyticsMetricCard("users", "Pupils started", `${analytics.startedCount} / ${analytics.rosterCount}`)}
      ${renderAnalyticsMetricCard("pause", "Not started", String(analytics.notStartedCount))}
    </div>
  `;
}

function formatAverageIndicatorValue(value) {
  return value == null ? "--" : String(Math.round(Number(value || 0)));
}

function formatSecureDifficultyScore(value) {
  return value == null ? "--" : formatOneDecimal(value);
}

function roundToOneDecimal(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * 10) / 10;
}

function hasIndicatorAttainmentEvidence(indicator) {
  return !!indicator?.attainmentBand && Number.isFinite(Number(indicator?.secureDifficultyScore));
}

function formatAttainmentHeadlineParts(level, performance) {
  const cleanLevel = String(level || "").trim() || "Not yet banded";
  const cleanPerformance = String(performance || "").trim();
  return cleanPerformance ? `${cleanLevel} (${cleanPerformance})` : cleanLevel;
}

function getIndicatorLevelText(indicator) {
  return indicator?.attainmentDisplayLabel || "Not yet banded";
}

function getIndicatorPerformanceText(indicator) {
  if (!indicator) return null;
  return indicator?.performanceDisplayLabel || indicator?.securityLabel || "Building profile";
}

function getIndicatorSecurityText(indicator) {
  return getIndicatorPerformanceText(indicator);
}

function getIndicatorHeadlineText(indicator) {
  return formatAttainmentHeadlineParts(getIndicatorLevelText(indicator), getIndicatorSecurityText(indicator));
}

function getIndicatorNextDescriptorText(indicator) {
  return indicator?.nextStepLabel || null;
}

function buildAttainmentHeadlineSummary(pupilRows) {
  const rows = Array.isArray(pupilRows) ? pupilRows : [];
  const evidencedIndicators = rows
    .map((item) => item?.attainmentIndicator || null)
    .filter((indicator) => hasIndicatorAttainmentEvidence(indicator));

  if (!evidencedIndicators.length) {
    return {
      headlineAttainmentLabel: "Not yet banded",
      typicalAttainmentKey: "not_yet_banded",
      typicalAttainmentDescriptor: "Not yet banded",
      typicalPerformanceLabel: null,
      typicalSecurityLabel: null,
      medianSecureDifficultyScore: null,
      attainmentEvidencePupilCount: 0,
    };
  }

  const orderedScores = evidencedIndicators
    .map((indicator) => Number(indicator?.secureDifficultyScore))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  const middleIndex = Math.floor(orderedScores.length / 2);
  const medianSecureDifficultyScore = orderedScores.length % 2
    ? roundToOneDecimal(orderedScores[middleIndex])
    : roundToOneDecimal((orderedScores[middleIndex - 1] + orderedScores[middleIndex]) / 2);
  const medianBand = getDifficultyBand(medianSecureDifficultyScore);
  const typicalAttainmentDescriptor = getAttainmentDisplayLabel(medianBand?.key);
  const performanceCounts = new Map();

  for (const indicator of evidencedIndicators) {
    const key = String(indicator?.performanceKey || indicator?.securityKey || "").trim().toLowerCase();
    if (!key) continue;
    performanceCounts.set(key, Number(performanceCounts.get(key) || 0) + 1);
  }

  const performanceOrder = ["building_profile", "emerging", "developing", "secure", "strong"];
  const typicalPerformanceKey = Array.from(performanceCounts.entries())
    .sort((a, b) =>
      Number(b[1] || 0) - Number(a[1] || 0)
      || performanceOrder.indexOf(a[0]) - performanceOrder.indexOf(b[0])
      || String(a[0]).localeCompare(String(b[0]))
    )[0]?.[0] || "";
  const typicalPerformanceLabel = evidencedIndicators.find((indicator) => (indicator?.performanceKey || indicator?.securityKey) === typicalPerformanceKey)?.performanceDisplayLabel
    || evidencedIndicators.find((indicator) => (indicator?.performanceKey || indicator?.securityKey) === typicalPerformanceKey)?.securityLabel
    || null;

  return {
    headlineAttainmentLabel: formatAttainmentHeadlineParts(typicalAttainmentDescriptor, typicalPerformanceLabel),
    typicalAttainmentKey: medianBand?.key || "not_yet_banded",
    typicalAttainmentDescriptor,
    typicalPerformanceKey,
    typicalPerformanceLabel,
    typicalSecurityLabel: typicalPerformanceLabel,
    medianSecureDifficultyScore,
    attainmentEvidencePupilCount: evidencedIndicators.length,
  };
}

function getSummaryAttainmentLevel(summary) {
  if (summary?.scopeType === "pupil") {
    return getIndicatorLevelText(summary?.pupilRows?.[0]?.attainmentIndicator || null);
  }
  return String(summary?.typicalAttainmentDescriptor || "Not yet banded");
}

function getSummaryAttainmentSecurity(summary) {
  if (summary?.scopeType === "pupil") {
    return getIndicatorSecurityText(summary?.pupilRows?.[0]?.attainmentIndicator || null);
  }
  return summary?.typicalPerformanceLabel || summary?.typicalSecurityLabel || null;
}

function getSummaryAttainmentHeadline(summary) {
  return formatAttainmentHeadlineParts(getSummaryAttainmentLevel(summary), getSummaryAttainmentSecurity(summary));
}

function getSummaryAttainmentNarrative(summary) {
  const level = getSummaryAttainmentLevel(summary);
  const performance = getSummaryAttainmentSecurity(summary);
  return performance ? `${level} with ${performance} performance` : level;
}

function getTeacherIndicatorBandText(indicator) {
  return getIndicatorLevelText(indicator);
}

function getTeacherIndicatorNextBandText(indicator) {
  return getIndicatorNextDescriptorText(indicator);
}

function buildTeacherIndicatorBandParts(indicator) {
  if (!indicator) return ["Not yet banded"];
  return [
    getTeacherIndicatorBandText(indicator),
    getIndicatorPerformanceText(indicator),
    indicator?.secureDifficultyScore == null ? null : `Secure difficulty ${formatSecureDifficultyScore(indicator.secureDifficultyScore)}`,
    getTeacherIndicatorNextBandText(indicator),
  ].filter(Boolean);
}

function buildTeacherIndicatorMetricParts(indicator, { includeRange = true } = {}) {
  if (!indicator || indicator?.score == null) return [];
  return [
    `SAI ${indicator.score}`,
    includeRange && indicator?.scoreRange ? `Range ${indicator.scoreRange.lower}-${indicator.scoreRange.upper}` : null,
    indicator?.evidenceDisplayLabel || indicator?.evidence?.label || "Building evidence",
  ].filter(Boolean);
}

function formatSpellingIndicatorSummary(indicator, { short = false } = {}) {
  if (!indicator || indicator?.score == null) {
    return short ? "Indicator awaiting evidence" : "Spelling Attainment Indicator awaiting evidence";
  }

  const parts = [
    short ? null : "Spelling Attainment Indicator",
    ...buildTeacherIndicatorBandParts(indicator),
    ...buildTeacherIndicatorMetricParts(indicator, { includeRange: !short }),
  ].filter(Boolean);
  return parts.join(" | ");
}

function getSpellingIndicatorInfoText() {
  return `${getSpellingIndicatorTeacherDescription()} ${getSpellingIndicatorTechnicalDescription()}`;
}

function getSummaryAttainmentEvidenceCount(summary) {
  if (Number.isFinite(Number(summary?.attainmentEvidencePupilCount))) {
    return Number(summary.attainmentEvidencePupilCount);
  }
  return (summary?.pupilRows || []).filter((item) => hasIndicatorAttainmentEvidence(item?.attainmentIndicator)).length;
}

function getSummaryAttainmentSubtext(summary) {
  if (!summary) return "Awaiting evidence";

  if (summary.scopeType === "pupil") {
    const pupilIndicator = summary?.pupilRows?.[0]?.attainmentIndicator || null;
    if (pupilIndicator?.score == null) return "Awaiting evidence";
    const parts = [
      pupilIndicator?.secureDifficultyScore == null ? null : `Secure difficulty ${formatSecureDifficultyScore(pupilIndicator.secureDifficultyScore)}`,
      getIndicatorNextDescriptorText(pupilIndicator),
      ...buildTeacherIndicatorMetricParts(pupilIndicator, { includeRange: true }),
    ];
    return parts.join(" | ");
  }

  const evidenceCount = getSummaryAttainmentEvidenceCount(summary);
  if (!evidenceCount) return "Not enough checked-response evidence yet";
  const totalPupilCount = Number(summary?.pupilCount ?? summary?.rosterCount ?? 0);
  const parts = [
    summary?.averageIndicatorScore == null ? null : `Average SAI ${formatAverageIndicatorValue(summary.averageIndicatorScore)}`,
    totalPupilCount ? `${evidenceCount}/${totalPupilCount} pupils with evidence` : `${evidenceCount} pupils with evidence`,
  ];
  return parts.filter(Boolean).join(" | ");
}

function renderAttainmentScoreInlineTip(text, context = "teacher") {
  return renderAttainmentInlineInfoTip(text, getScoreDefinition(context), "About SAI");
}

function buildTeacherIndicatorMetricPartsHtml(indicator, context = "teacher", { includeRange = true } = {}) {
  if (!indicator || indicator?.score == null) return "";
  const parts = [
    renderAttainmentScoreInlineTip(`SAI ${indicator.score}`, context),
    includeRange && indicator?.scoreRange ? escapeHtml(`Range ${indicator.scoreRange.lower}-${indicator.scoreRange.upper}`) : "",
    escapeHtml(indicator?.evidenceDisplayLabel || indicator?.evidence?.label || "Building evidence"),
  ].filter(Boolean);
  return parts.join('<span class="td-attainment-inline-separator"> | </span>');
}

function buildSummaryAttainmentSubtextHtml(summary) {
  if (!summary) return "";
  if (summary.scopeType === "pupil") {
    const pupilIndicator = summary?.pupilRows?.[0]?.attainmentIndicator || null;
    if (pupilIndicator?.score == null) return escapeHtml("Awaiting evidence");
    const parts = [
      pupilIndicator?.secureDifficultyScore == null ? "" : escapeHtml(`Secure difficulty ${formatSecureDifficultyScore(pupilIndicator.secureDifficultyScore)}`),
      escapeHtml(getIndicatorNextDescriptorText(pupilIndicator) || ""),
      buildTeacherIndicatorMetricPartsHtml(pupilIndicator, "teacher", { includeRange: true }),
    ].filter(Boolean);
    return parts.join('<span class="td-attainment-inline-separator"> | </span>');
  }
  const evidenceCount = getSummaryAttainmentEvidenceCount(summary);
  if (!evidenceCount) return escapeHtml("Not enough checked-response evidence yet");
  const totalPupilCount = Number(summary?.pupilCount ?? summary?.rosterCount ?? 0);
  const parts = [
    summary?.averageIndicatorScore == null ? "" : renderAttainmentScoreInlineTip(`Average SAI ${formatAverageIndicatorValue(summary.averageIndicatorScore)}`, "group"),
    escapeHtml(totalPupilCount ? `${evidenceCount}/${totalPupilCount} pupils with evidence` : `${evidenceCount} pupils with evidence`),
  ].filter(Boolean);
  return parts.join('<span class="td-attainment-inline-separator"> | </span>');
}

function buildVisualSummaryAttainmentMetaLines(summary) {
  if (!summary) return [];

  if (summary.scopeType === "pupil") {
    const pupilIndicator = summary?.pupilRows?.[0]?.attainmentIndicator || null;
    if (pupilIndicator?.score == null) {
      return [escapeHtml("Awaiting evidence")];
    }

    const primaryLine = [
      pupilIndicator?.secureDifficultyScore == null
        ? ""
        : escapeHtml(`Secure difficulty ${formatSecureDifficultyScore(pupilIndicator.secureDifficultyScore)}`),
      escapeHtml(getIndicatorNextDescriptorText(pupilIndicator) || ""),
    ].filter(Boolean).join('<span class="td-attainment-inline-separator"> | </span>');

    const secondaryLine = buildTeacherIndicatorMetricPartsHtml(pupilIndicator, "teacher", { includeRange: true });
    return [primaryLine, secondaryLine].filter(Boolean);
  }

  const evidenceCount = getSummaryAttainmentEvidenceCount(summary);
  if (!evidenceCount) {
    return [escapeHtml("Not enough checked-response evidence yet")];
  }

  const totalPupilCount = Number(summary?.pupilCount ?? summary?.rosterCount ?? 0);
  return [
    summary?.averageIndicatorScore == null
      ? ""
      : renderAttainmentScoreInlineTip(`Average SAI ${formatAverageIndicatorValue(summary.averageIndicatorScore)}`, "group"),
    escapeHtml(totalPupilCount ? `${evidenceCount}/${totalPupilCount} pupils with evidence` : `${evidenceCount} pupils with evidence`),
  ].filter(Boolean);
}

function getSummaryAttainmentLevelDefinition(summary) {
  if (summary?.scopeType === "pupil") {
    return summary?.pupilRows?.[0]?.attainmentIndicator?.levelDefinitionTeacher
      || getLevelDefinition(summary?.pupilRows?.[0]?.attainmentIndicator?.attainmentBand?.key || "not_yet_banded", "teacher");
  }
  return getLevelDefinition(summary?.typicalAttainmentKey || "not_yet_banded", getAttainmentDefinitionContext(summary?.scopeType));
}

function getSummaryAttainmentPerformanceDefinition(summary) {
  if (summary?.scopeType === "pupil") {
    return summary?.pupilRows?.[0]?.attainmentIndicator?.performanceDefinitionTeacher
      || getPerformanceDefinition(summary?.pupilRows?.[0]?.attainmentIndicator?.performanceKey || "building_profile", "teacher");
  }
  return getPerformanceDefinition(summary?.typicalPerformanceKey || "building_profile", getAttainmentDefinitionContext(summary?.scopeType));
}

function buildTeacherAttainmentCardBodyHtml({
  levelText = "Not yet banded",
  levelTooltip = "",
  performanceText = "",
  performanceTooltip = "",
  metaLines = [],
  layout = "stacked",
} = {}) {
  const isHorizontal = layout === "horizontal";
  const levelHtml = renderAttainmentInlineInfoTip(levelText, levelTooltip, "About spelling level", {
    triggerHtml: `<span class="td-attainment-card-main-text uiInfoTipTriggerText">${escapeHtml(levelText)}</span>`,
  });
  const performanceTriggerClassName = [
    "td-attainment-card-badge",
    isHorizontal ? "td-attainment-card-badge--text uiInfoTipTriggerText" : "",
  ].filter(Boolean).join(" ");
  const performanceHtml = performanceText
    ? renderAttainmentInlineInfoTip(performanceText, performanceTooltip, "About spelling performance", {
      triggerHtml: `<span class="${performanceTriggerClassName}">${escapeHtml(performanceText)}</span>`,
    })
    : "";
  const lines = (Array.isArray(metaLines) ? metaLines : []).map((item) => String(item || "").trim()).filter(Boolean);
  const bodyClassName = ["td-attainment-card-body", isHorizontal ? "td-attainment-card-body--horizontal" : ""].filter(Boolean).join(" ");
  return `
    <div class="${bodyClassName}">
      <div class="td-attainment-card-block td-attainment-card-block--level">
        <div class="td-attainment-card-section-label">LEVEL</div>
        <div class="td-attainment-card-main">${levelHtml}</div>
      </div>
      <div class="td-attainment-card-block td-attainment-card-block--performance">
        <div class="td-attainment-card-section-label">PERFORMANCE</div>
        <div class="td-attainment-card-performance">${performanceHtml}</div>
      </div>
      ${lines.length ? `
        <div class="td-attainment-card-block td-attainment-card-block--meta">
          <div class="td-attainment-card-meta">
            ${lines.map((line) => `<div class="td-attainment-card-meta-line">${line}</div>`).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderAttainmentGuidePage(summary) {
  const evidenceBands = getSpellingIndicatorEvidenceBands();
  const evidenceCount = getSummaryAttainmentEvidenceCount(summary);
  const pupilIndicator = summary?.scopeType === "pupil"
    ? summary?.pupilRows?.[0]?.attainmentIndicator || null
    : null;
  const definitionContext = getAttainmentDefinitionContext(summary?.scopeType);
  const scopeSummary = summary?.scopeType === "pupil"
    ? pupilIndicator?.score == null
      ? "This pupil does not have enough checked responses yet for a stable attainment estimate."
      : `This view reports the pupil's current spelling level as ${getSummaryAttainmentNarrative(summary)}. ${getSummaryAttainmentSubtext(summary)}.`
    : evidenceCount
      ? `This view reports the current group headline as ${getSummaryAttainmentNarrative(summary)}. ${getSummaryAttainmentSubtext(summary)}.`
      : "No pupil in this selection has enough checked responses yet to contribute a descriptor-led attainment headline.";

  return `
    <section class="td-visual-summary-page td-visual-summary-page--guide" data-role="attainment-guide-page">
      <div class="td-visual-summary-head td-visual-summary-head--compact">
        <div class="td-visual-summary-copy">
          <div class="td-visual-summary-kicker">Attainment guide</div>
          <h4>How attainment is calculated</h4>
          <div class="td-attainment-guide-meta">
            ${
              summary
                ? `<span class="td-pill">${escapeHtml(`${getVisualScopeKindLabel(summary.scopeType)}: ${summary.label || "Current view"}`)}</span>`
                : ""
            }
            <span class="td-pill">${escapeHtml(summary?.scopeType === "pupil" ? "Main metric" : evidenceCount ? `${evidenceCount} with evidence` : "Method overview")}</span>
          </div>
          <p class="td-attainment-guide-note">${escapeHtml(scopeSummary)}</p>
        </div>
        <div class="td-visual-summary-actions">
          <button type="button" class="td-btn td-btn--ghost" data-action="close-attainment-guide">Back to analytics</button>
        </div>
      </div>

      <div class="td-attainment-method-grid">
        <article class="td-attainment-method-card">
          <strong>What this measures</strong>
          <p>${escapeHtml(scopeSummary)}</p>
        </article>
        <article class="td-attainment-method-card">
          <strong>Level descriptors</strong>
          ${renderAttainmentDescriptorList(LEVEL_LADDER_KEYS, getLevelDisplayLabel, getLevelDefinition, definitionContext)}
        </article>
        <article class="td-attainment-method-card">
          <strong>Performance descriptors</strong>
          ${renderAttainmentDescriptorList(PERFORMANCE_LADDER_KEYS, getPerformanceDisplayLabel, getPerformanceDefinition, definitionContext)}
        </article>
        <article class="td-attainment-method-card">
          <strong>What SAI means</strong>
          <p>${escapeHtml(getScoreDefinition(definitionContext))}</p>
          <div class="td-attainment-reference-list">
            ${evidenceBands.map((item) => `
              <div class="td-attainment-reference">
                <span>${escapeHtml(item.label)}</span>
                <small>${escapeHtml(item.description)}${item.minResponses ? ` Minimum ${item.minResponses}+ checked responses.` : ""}${item.maxStandardError != null ? ` Max standard error ${item.maxStandardError}.` : ""}</small>
              </div>
            `).join("")}
          </div>
        </article>
        <article class="td-attainment-method-card">
          <strong>How it works (short version)</strong>
          <p>The app gives each checked word a core structural difficulty score, then applies a Rasch-style one-parameter logistic estimate to correct and incorrect responses against those core difficulty values.</p>
          <p>The estimate is translated into a spelling level, a performance descriptor, and the supporting SAI. Accuracy, first try, completion, and average tries stay visible as companion measures, but they are not blended into the core attainment estimate.</p>
        </article>
        <article class="td-attainment-method-card">
          <strong>What is not included</strong>
          <div class="td-attainment-reference-list">
            ${[
              "Completion, first try, and average tries are shown alongside attainment but do not change the core estimate.",
              "Contextual planning modifiers such as tricky-word marking do not change the core structural difficulty used for attainment.",
              "This indicator supports review and planning. It is not a grade, diagnosis, or fixed label.",
            ].map((item) => `
              <div class="td-attainment-reference">
                <small>${escapeHtml(item)}</small>
              </div>
            `).join("")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderGraphemeInsights(items, emptyMessage, tone = "weak") {
  if (!items.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>${escapeHtml(emptyMessage)}</strong>
      </div>
    `;
  }

  return `
    <div class="td-analytics-list">
      ${items.map((item) => `
        <article class="td-analytics-item td-analytics-item--${escapeAttr(tone)}">
          <div class="td-analytics-item-top">
            <strong>${escapeHtml(item.target)}</strong>
            <span class="td-band td-band--${escapeAttr(item.securityBand || "insecure")}">${escapeHtml(securityBandLabel(item.securityBand))}</span>
          </div>
          ${renderAnalyticsMetaLine("checkCircle", `${item.correct}/${item.total} latest responses correct`)}
          ${renderAnalyticsMetaLine("target", `${formatPercent(item.accuracy)} latest accuracy`)}
          ${renderAnalyticsMetaLine("zap", `${formatPercent(item.firstTrySuccessRate)} first-try success`)}
          ${renderAnalyticsMetaLine("repeat", `${formatOneDecimal(item.averageAttempts)} average tries`)}
          ${renderAnalyticsMetaLine("book", item.wordSamples.join(", "))}
        </article>
      `).join("")}
    </div>
  `;
}

function renderHardestWords(items) {
  if (!items.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No word-level data yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-analytics-list">
      ${items.map((item) => `
        <article class="td-analytics-item">
          <div class="td-analytics-item-top">
            <strong>${escapeHtml(item.word)}</strong>
            <span>${escapeHtml(formatPercent(item.accuracy))}</span>
          </div>
          ${renderAnalyticsMetaLine("checkCircle", `${item.correct}/${item.total} pupils correct on latest try`)}
          ${renderAnalyticsMetaLine("repeat", `${formatOneDecimal(item.averageAttempts)} average tries`)}
        </article>
      `).join("")}
    </div>
  `;
}

function renderPupilRows(items, { contextKey = "" } = {}) {
  if (!items.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No pupils in this class yet.</strong>
      </div>
    `;
  }

  const visibleCount = getVisiblePupilRowCount(contextKey, items.length);
  const visibleItems = items.slice(0, visibleCount);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);
  const nextCount = Math.min(hiddenCount, ASSIGNMENT_PUPIL_ROWS_STEP);

  return `
    <div class="td-pupil-table">
      ${visibleItems.map((item) => {
        const isExpanded = isPupilRowExpanded(contextKey, item.pupilId);
        const signal = { tone: item.signalTone, label: item.signalLabel };
        return `
        <article class="td-pupil-row ${item.status === "Not started" ? "is-muted" : ""} ${signal.tone === "red" ? "is-alert" : ""} ${isExpanded ? "is-open" : ""}">
          <div class="td-pupil-row-summary">
            <div class="td-pupil-main">
              <div class="td-pupil-main-top">
                <strong>${escapeHtml(item.name)}</strong>
                ${renderPupilSignalBadge(signal, { title: `${item.name}: ${signal.label}` })}
              </div>
              <span>${escapeHtml(item.status)}</span>
              <span>${escapeHtml(formatSpellingIndicatorSummary(item.attainmentIndicator))}</span>
            </div>
            <div class="td-pupil-metric">${escapeHtml(item.attainmentIndicator?.score == null ? "SAI —" : `SAI ${item.attainmentIndicator.score}`)}</div>
            <div class="td-pupil-metric">${escapeHtml(`${item.developingWordCount || 0} developing`)}</div>
            <div class="td-pupil-metric">${escapeHtml(`${item.needsReviewWordCount || 0} needs review`)}</div>
            <div class="td-pupil-metric">${escapeHtml(item.attainmentIndicator?.evidence?.label || `${item.notStartedWordCount || 0} waiting`)}</div>
          </div>
          <div class="td-inline-disclosure-wrap">
            <button
              class="td-inline-disclosure"
              type="button"
              data-action="toggle-pupil-details"
              data-context-key="${escapeAttr(contextKey)}"
              data-pupil-id="${escapeAttr(item.pupilId || "")}"
              aria-expanded="${isExpanded ? "true" : "false"}"
            >
              <span>${isExpanded ? "Hide details" : "Show details"}</span>
              <span class="td-inline-disclosure-chev ${isExpanded ? "is-open" : ""}">&#9662;</span>
            </button>
          </div>
          ${
            isExpanded
              ? `
            <div class="td-pupil-details">
              ${renderAssignmentPupilWordSummary(item)}
            </div>
          `
              : ""
          }
        </article>
      `;
      }).join("")}
      ${
        hiddenCount
          ? `
        <div class="td-list-disclosure">
          <button
            class="td-inline-disclosure"
            type="button"
            data-action="show-more-pupils"
            data-context-key="${escapeAttr(contextKey)}"
            data-total-rows="${escapeAttr(String(items.length))}"
          >
            <span>${escapeHtml(`Show ${nextCount} more pupil${nextCount === 1 ? "" : "s"}`)}</span>
            <span class="td-inline-disclosure-chev">&#9662;</span>
          </button>
        </div>
      `
          : items.length > ASSIGNMENT_PUPIL_ROWS_STEP
            ? `
        <div class="td-list-disclosure">
          <button
            class="td-inline-disclosure"
            type="button"
            data-action="show-fewer-pupils"
            data-context-key="${escapeAttr(contextKey)}"
          >
            <span>Show fewer pupils</span>
            <span class="td-inline-disclosure-chev is-open">&#9662;</span>
          </button>
        </div>
      `
            : ""
      }
    </div>
  `;
}

function renderAssignmentProgressSnapshot(analytics) {
  const rosterCount = Math.max(1, Number(analytics?.rosterCount || 0));
  const completed = Math.max(0, Number(analytics?.completedCount || 0));
  const started = Math.max(0, Number(analytics?.startedCount || 0));
  const inProgress = Math.max(0, started - completed);
  const waiting = Math.max(0, rosterCount - started);
  const completedWidth = Math.round((completed / rosterCount) * 100);
  const inProgressWidth = Math.round((inProgress / rosterCount) * 100);
  const waitingWidth = Math.max(0, 100 - completedWidth - inProgressWidth);

  return `
    <section class="td-progress-hero">
      <div class="td-progress-hero-head">
        <div>
          <h5>Class progress</h5>
          <p>${escapeHtml(`${completed}/${analytics.rosterCount} done • ${started}/${analytics.rosterCount} started`)}</p>
        </div>
        <span class="td-pill">${escapeHtml(`${analytics.notStartedCount} waiting`)}</span>
      </div>
      <div class="td-progress-hero-bar" aria-label="Assignment progress">
        <span class="is-done" style="width:${completedWidth}%"></span>
        <span class="is-live" style="width:${inProgressWidth}%"></span>
        <span class="is-wait" style="width:${waitingWidth}%"></span>
      </div>
      <div class="td-progress-hero-legend">
        <span class="td-progress-legend-pill is-done">Done ${escapeHtml(String(completed))}</span>
        <span class="td-progress-legend-pill is-live">Live ${escapeHtml(String(inProgress))}</span>
        <span class="td-progress-legend-pill is-wait">Waiting ${escapeHtml(String(waiting))}</span>
      </div>
    </section>
  `;
}

function renderAssignmentCompactSummary(analytics) {
  const attainmentValue = getSummaryAttainmentLevel(analytics);
  const attainmentPerformance = getSummaryAttainmentSecurity(analytics);
  const attainmentSubtext = getSummaryAttainmentSubtext(analytics);
  const attainmentBodyHtml = buildTeacherAttainmentCardBodyHtml({
    levelText: attainmentValue,
    levelTooltip: getSummaryAttainmentLevelDefinition(analytics),
    performanceText: attainmentPerformance,
    performanceTooltip: getSummaryAttainmentPerformanceDefinition(analytics),
    metaLines: [buildSummaryAttainmentSubtextHtml(analytics)],
  });
  return `
    <div class="td-compact-summary-grid">
      ${renderAnalyticsMetricCardWithInfo("award", "Typical level", attainmentValue, "", attainmentSubtext, {
        className: "td-analytics-summary-card--primary",
        bodyHtml: attainmentBodyHtml,
      })}
      ${renderAnalyticsMetricCard("activity", "Started", `${analytics.startedCount}/${analytics.rosterCount}`)}
      ${renderAnalyticsMetricCard("checkCircle", "Done", `${analytics.completedCount}/${analytics.rosterCount}`)}
    </div>
  `;
}

function renderAssignmentWatchSummary(analytics) {
  const weak = (analytics?.weakGraphemes || []).slice(0, 3);
  const words = (analytics?.hardestWords || []).slice(0, 3);

  if (!analytics?.startedCount) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No pupil attempts yet.</strong>
        <p>This will fill in once someone starts the assignment.</p>
      </div>
    `;
  }

  if (!weak.length && !words.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No clear watch items yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-focus-strip">
      ${
        weak.length
          ? `
        <div class="td-focus-group">
          <span>Watch sounds</span>
          <div class="td-visual-token-row">
            ${weak.map((item) => `<span class="td-visual-token">${escapeHtml(item.target)}</span>`).join("")}
          </div>
        </div>
      `
          : ""
      }
      ${
        words.length
          ? `
        <div class="td-focus-group">
          <span>Tricky words</span>
          <div class="td-visual-token-row">
            ${words.map((item) => `<span class="td-visual-token td-visual-token--warm">${escapeHtml(item.word)}</span>`).join("")}
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function getAssignmentPriorityItems(items) {
  const sourceItems = (items || []).filter((item) => item.status !== "Complete");
  return sourceItems.length ? sourceItems : (items || []);
}

function renderAssignmentPriorityList(items) {
  const priorityItems = getAssignmentPriorityItems(items);
  const visible = priorityItems.slice(0, 3);

  if (!visible.length) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No pupil activity yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-pupil-compact-list">
      ${visible.map((item) => {
        const focusText = item.priorityTarget
          ? `Watch ${item.priorityTarget}`
          : item.status === "Not started"
            ? "Waiting to begin"
            : "Making progress";
        return `
        <article class="td-pupil-compact-row ${item.status === "Not started" ? "is-muted" : ""}">
          <div class="td-pupil-compact-top">
            <div class="td-pupil-compact-copy">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(focusText)}</span>
            </div>
            <div class="td-pupil-compact-side">
              <span class="td-pupil-compact-state">${escapeHtml(item.status)}</span>
              <strong>${escapeHtml(formatPercent(item.scoreRate || 0))}</strong>
            </div>
          </div>
          <div class="td-pupil-compact-meta">
            <span>${escapeHtml(`${item.attemptedWords}/${item.totalWords || 0} checked`)}</span>
            <span>${escapeHtml(item.correctWords ? `${item.correctWords} correct` : "No checks yet")}</span>
          </div>
        </article>
      `;
      }).join("")}
    </div>
    ${
      priorityItems.length > visible.length
        ? `<p class="td-chat-note">Showing the first ${escapeHtml(String(visible.length))} pupils to check. Use All pupils below for the full list.</p>`
        : ""
    }
  `;
}

function renderClassComparisonCompact(rows) {
  if ((rows || []).length <= 1) {
    return `
      <div class="td-empty td-empty--compact">
        <strong>No comparison yet.</strong>
      </div>
    `;
  }

  return `
    <div class="td-compare-mini-list">
      ${rows.map((item) => {
        const startedRate = item.rosterCount ? item.startedCount / item.rosterCount : 0;
        const startedWidth = startedRate > 0 ? Math.max(6, Math.round(startedRate * 100)) : 0;
        return `
        <div class="td-compare-mini-row ${item.isCurrent ? "is-current" : ""}">
          <div class="td-compare-mini-copy">
            <strong>${escapeHtml(item.className)}</strong>
            <span>${escapeHtml(`${item.startedCount}/${item.rosterCount} started`)}</span>
          </div>
          <div class="td-compare-mini-bar"><span style="width:${startedWidth}%"></span></div>
          <strong>${escapeHtml(formatAverageIndicatorValue(item.averageIndicatorScore))}</strong>
        </div>
      `;
      }).join("")}
    </div>
  `;
}

function renderAssignmentProgressHero(analytics) {
  const rosterCount = Math.max(1, Number(analytics?.rosterCount || 0));
  const completed = Math.max(0, Number(analytics?.completedCount || 0));
  const started = Math.max(0, Number(analytics?.startedCount || 0));
  const inProgress = Math.max(0, started - completed);
  const waiting = Math.max(0, rosterCount - started);
  const completedWidth = Math.round((completed / rosterCount) * 100);
  const inProgressWidth = Math.round((inProgress / rosterCount) * 100);
  const waitingWidth = Math.max(0, 100 - completedWidth - inProgressWidth);
  const summaryText = started
    ? `${started}/${analytics.rosterCount} pupils have started`
    : `${analytics.rosterCount} pupils are ready to begin`;

  return `
    <section class="td-progress-hero">
      <div class="td-progress-hero-head">
        <div>
          <h5>Class progress</h5>
          <p>${escapeHtml(summaryText)}</p>
        </div>
      </div>
      <div class="td-progress-hero-bar" aria-label="Assignment progress">
        <span class="is-done" style="width:${completedWidth}%"></span>
        <span class="is-live" style="width:${inProgressWidth}%"></span>
        <span class="is-wait" style="width:${waitingWidth}%"></span>
      </div>
      <div class="td-progress-hero-legend">
        <span class="td-progress-legend-pill is-done">Done ${escapeHtml(String(completed))}</span>
        <span class="td-progress-legend-pill is-live">Live ${escapeHtml(String(inProgress))}</span>
        <span class="td-progress-legend-pill is-wait">Waiting ${escapeHtml(String(waiting))}</span>
      </div>
    </section>
  `;
}

function renderAssignmentResultsPanelCalmLegacy(item) {
  const assignmentId = String(item.id);
  const analyticsState = state.analyticsByAssignment[assignmentId];

  if (!analyticsState || analyticsState.status === "loading") {
    return `
      <div class="td-inline-panel td-inline-panel--attached td-inline-panel--calm">
        <div class="td-inline-head">
          <h4>Results</h4>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
        </div>
        <div class="td-empty td-empty--compact">
          <strong>Loading analytics...</strong>
          <p>Pulling pupil, grapheme, and class comparison data now.</p>
        </div>
      </div>
    `;
  }

  if (analyticsState.status === "error") {
    return `
      <div class="td-inline-panel td-inline-panel--attached td-inline-panel--calm">
        <div class="td-inline-head">
          <h4>Results</h4>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
        </div>
        <div class="td-empty td-empty--compact">
          <strong>Could not load analytics.</strong>
          <p>${escapeHtml(analyticsState.message || "Please try again.")}</p>
        </div>
      </div>
    `;
  }

  const analytics = analyticsState.data?.current;
  if (!analytics) {
    return `
      <div class="td-inline-panel td-inline-panel--attached td-inline-panel--calm">
        <div class="td-inline-head">
          <h4>Results</h4>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
        </div>
        <div class="td-empty td-empty--compact">
          <strong>No analytics available yet.</strong>
        </div>
      </div>
    `;
  }

  return `
    <div class="td-inline-panel td-inline-panel--attached td-inline-panel--calm">
      <div class="td-inline-head">
        <h4>Results</h4>
        <div class="td-inline-actions">
          <button
            type="button"
            class="td-btn td-btn--tiny td-btn--ghost"
            data-action="open-visual-summary"
            data-scope-type="class"
            data-scope-id="${escapeAttr(analytics.classId || "")}"
          >
            Open analytics
          </button>
          <button
            type="button"
            class="td-btn td-btn--tiny td-btn--ghost"
            data-action="use-class-analytics"
            data-class-id="${escapeAttr(analytics.classId || "")}"
            data-class-name="${escapeAttr(analytics.className || "this class")}"
          >
            Ask AI about this class
          </button>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
        </div>
      </div>

      ${renderAssignmentProgressHero(analytics)}
      ${renderAssignmentCompactSummary(analytics)}

      <div class="td-results-grid td-results-grid--analytics">
        <section class="td-results-block td-results-block--soft td-results-block--wide">
          <div class="td-results-block-head">
            <h5>Watch next</h5>
            <span class="td-pill">${escapeHtml(String(Math.min(6, analytics.weakGraphemes.length + analytics.hardestWords.length)))}</span>
          </div>
          ${renderAssignmentWatchSummary(analytics)}
        </section>
      </div>

      <div class="td-results-grid td-results-grid--analytics">
        <section class="td-results-block td-results-block--soft td-results-block--wide">
          <div class="td-results-block-head">
            <h5>All pupils</h5>
            <span class="td-pill">${escapeHtml(String(analytics.pupilRows.length))}</span>
          </div>
          ${renderPupilSignalLegend()}
          ${renderPupilRows(analytics.pupilRows, { contextKey: assignmentId })}
        </section>
      </div>
    </div>
  `;
}

function renderAssignmentResultsPanelLegacy(item) {
  const assignmentId = String(item.id);
  const analyticsState = state.analyticsByAssignment[assignmentId];

  if (!analyticsState || analyticsState.status === "loading") {
    return `
      <div class="td-inline-panel td-inline-panel--attached">
        <div class="td-inline-head">
          <h4>Results overview</h4>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">× Close</button>
        </div>
        <div class="td-empty td-empty--compact">
          <strong>Loading analytics…</strong>
          <p>Pulling pupil, grapheme, and class comparison data now.</p>
        </div>
      </div>
    `;
  }

  if (analyticsState.status === "error") {
    return `
      <div class="td-inline-panel td-inline-panel--attached">
        <div class="td-inline-head">
          <h4>Results overview</h4>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">× Close</button>
        </div>
        <div class="td-empty td-empty--compact">
          <strong>Could not load analytics.</strong>
          <p>${escapeHtml(analyticsState.message || "Please try again.")}</p>
        </div>
      </div>
    `;
  }

  const analytics = analyticsState.data?.current;
  if (!analytics) {
    return `
      <div class="td-inline-panel td-inline-panel--attached">
        <div class="td-inline-head">
          <h4>Results overview</h4>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">× Close</button>
        </div>
        <div class="td-empty td-empty--compact">
          <strong>No analytics available yet.</strong>
        </div>
      </div>
    `;
  }

  return `
    <div class="td-inline-panel td-inline-panel--attached">
      <div class="td-inline-head">
        <h4>Results overview</h4>
        <div class="td-inline-actions">
          <button
            type="button"
            class="td-btn td-btn--tiny td-btn--ghost"
            data-action="open-visual-summary"
            data-scope-type="class"
            data-scope-id="${escapeAttr(analytics.classId || "")}"
          >
            Open analytics
          </button>
          <button
            type="button"
            class="td-btn td-btn--tiny td-btn--ghost"
            data-action="use-class-analytics"
            data-class-id="${escapeAttr(analytics.classId || "")}"
            data-class-name="${escapeAttr(analytics.className || "this class")}"
          >
            Ask AI about this class
          </button>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">× Close</button>
        </div>
      </div>

      ${renderAnalyticsSummaryCards(analytics)}

      <div class="td-results-grid td-results-grid--analytics">
        <section class="td-results-block">
          <div class="td-results-block-head">
            <h5>Areas for development</h5>
            <span class="td-pill">${escapeHtml(String(analytics.weakGraphemes.length))}</span>
          </div>
          ${renderGraphemeInsights(analytics.weakGraphemes, "No grapheme concerns are standing out yet.", "weak")}
        </section>

        <section class="td-results-block">
          <div class="td-results-block-head">
            <h5>Current strengths</h5>
            <span class="td-pill">${escapeHtml(String(analytics.strongGraphemes.length))}</span>
          </div>
          ${renderGraphemeInsights(analytics.strongGraphemes, "No strong grapheme pattern yet.", "strong")}
        </section>

        <section class="td-results-block">
          <div class="td-results-block-head">
            <h5>Hardest words</h5>
            <span class="td-pill">${escapeHtml(String(analytics.hardestWords.length))}</span>
          </div>
          ${renderHardestWords(analytics.hardestWords)}
        </section>

        <section class="td-results-block">
          <div class="td-results-block-head">
            <h5>Progress over time</h5>
            <span class="td-pill">${escapeHtml(String(analytics.timelineRows.length))}</span>
          </div>
          ${renderTimelineRows(analytics.timelineRows)}
        </section>
      </div>

      <div class="td-results-grid td-results-grid--analytics td-results-grid--stacked">
        <section class="td-results-block td-results-block--wide">
          <div class="td-results-block-head">
            <h5>Pupil progress</h5>
            <span class="td-pill">${escapeHtml(String(analytics.pupilRows.length))}</span>
          </div>
          ${renderPupilSignalLegend()}
          ${renderPupilRows(analytics.pupilRows, { contextKey: assignmentId })}
        </section>
      </div>
    </div>
  `;
}

function renderAssignmentResultsContent(item, panelClassName = "") {
  const assignmentId = String(item.id);
  const analyticsState = state.analyticsByAssignment[assignmentId];
  const panelClasses = ["td-inline-panel", "td-inline-panel--attached", panelClassName].filter(Boolean).join(" ");

  if (!analyticsState || analyticsState.status === "loading") {
    return `
      <div class="${panelClasses}">
        <div class="td-inline-head">
          <h4>Results</h4>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
        </div>
        <div class="td-empty td-empty--compact">
          <strong>Loading results...</strong>
          <p>Pulling the latest pupil attempts for this assignment.</p>
        </div>
      </div>
    `;
  }

  if (analyticsState.status === "error") {
    return `
      <div class="${panelClasses}">
        <div class="td-inline-head">
          <h4>Results</h4>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
        </div>
        <div class="td-empty td-empty--compact">
          <strong>Could not load analytics.</strong>
          <p>${escapeHtml(analyticsState.message || "Please try again.")}</p>
        </div>
      </div>
    `;
  }

  const analytics = analyticsState.data?.current;
  if (!analytics) {
    return `
      <div class="${panelClasses}">
        <div class="td-inline-head">
          <h4>Results</h4>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
        </div>
        <div class="td-empty td-empty--compact">
          <strong>No analytics available yet.</strong>
        </div>
      </div>
    `;
  }

  return `
    <div class="${panelClasses}">
      <div class="td-inline-head">
        <h4>Results</h4>
        <div class="td-inline-actions">
          <button
            type="button"
            class="td-btn td-btn--tiny td-btn--ghost"
            data-action="open-visual-summary"
            data-scope-type="class"
            data-scope-id="${escapeAttr(analytics.classId || "")}"
          >
            Open analytics
          </button>
          <button
            type="button"
            class="td-btn td-btn--tiny td-btn--ghost"
            data-action="use-class-analytics"
            data-class-id="${escapeAttr(analytics.classId || "")}"
            data-class-name="${escapeAttr(analytics.className || "this class")}"
          >
            Ask AI about this class
          </button>
          <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
        </div>
      </div>

      ${renderAssignmentProgressHero(analytics)}

      <div class="td-results-grid td-results-grid--analytics">
        <section class="td-results-block td-results-block--wide">
            <div class="td-class-results-selected">
              <div class="td-class-results-selected-head">
                <strong>${escapeHtml(item?.tests?.title || "Untitled test")}</strong>
                <span>${escapeHtml(getAssignmentReferenceLabel(item))}</span>
              </div>
            ${renderAssignmentResultsTable(analytics)}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderAssignmentResultsPanelCalm(item) {
  return renderAssignmentResultsContent(item, "td-inline-panel--calm");
}

function renderAssignmentResultsPanel(item) {
  return renderAssignmentResultsContent(item);
}

function renderAssignmentCard(item) {
  const assignmentId = String(item.id);
  const title = item.tests?.title || "Untitled test";
  const className = item.classes?.name || "Unknown class";
  const isAutoGenerated = isAutoGeneratedAssignment(item);
  const isResultsOpen =
    state.activePanel?.type === "results-assignment" &&
    String(state.activePanel.id) === assignmentId;

  const status = getAssignmentStatus(item);
  const isActive = isResultsOpen;

  return `
    <article class="td-assignment-card ${isActive ? "is-active" : ""}">
      <div class="td-card-row">
        <div class="td-card-main">
          <div class="td-card-title">
            ${escapeHtml(title)}
            ${isAutoGenerated ? `<span class="td-pill">Auto-assigned</span>` : ""}
          </div>
          <div class="td-card-subtitle">Class: ${escapeHtml(className)}</div>

          <div class="td-assignment-meta td-assignment-meta--stack">
            <span>Deadline: ${formatDate(item.deadline)}</span>
            <span>Assigned: ${formatDate(item.created_at)}</span>
            <span>Completed: ${escapeHtml(state.analyticsByAssignment[assignmentId]?.status === "ready" ? `${state.analyticsByAssignment[assignmentId].data.current.completedCount}/${state.analyticsByAssignment[assignmentId].data.current.rosterCount}` : "— / —")}</span>
            <span>Avg attainment: ${escapeHtml(state.analyticsByAssignment[assignmentId]?.status === "ready" ? formatAverageIndicatorValue(state.analyticsByAssignment[assignmentId].data.current.averageIndicatorScore) : "—")}</span>
            <span>Status: <strong>${status}</strong></span>
          </div>
        </div>

        <div class="td-card-actions">
          <button
            class="td-btn td-btn--ghost"
            type="button"
            data-action="open-results-assignment"
            data-assignment-id="${escapeAttr(assignmentId)}"
          >
            ${isResultsOpen ? "Hide results" : "View results"}
          </button>
        </div>
      </div>

      ${isResultsOpen ? renderAssignmentResultsPanel(item) : ""}

      ${
        false && isResultsOpen
          ? `
        <div class="td-inline-panel td-inline-panel--attached">
          <div class="td-inline-head">
            <h4>Results overview</h4>
            <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">× Close</button>
          </div>

          <div class="td-results-grid">
            <section class="td-results-block">
              <div class="td-results-block-head">
                <h5>Completed</h5>
                <span class="td-pill">0</span>
              </div>
              <div class="td-empty td-empty--compact">
                <strong>No pupil tracking data yet.</strong>
                <p>Completed pupil results will appear here once pupil accounts and attempts are added.</p>
              </div>
            </section>

            <section class="td-results-block">
              <div class="td-results-block-head">
                <h5>Not started</h5>
                <span class="td-pill">0</span>
              </div>
              <div class="td-empty td-empty--compact">
                <strong>No pupil tracking data yet.</strong>
                <p>Pupils who have not started will appear here once pupil accounts are added.</p>
              </div>
            </section>
          </div>

          <div class="td-results-footer-note">
            Ready for next phase: pupil accounts, attempt tracking, scores, completion counts and insights.
          </div>
        </div>
      `
          : ""
      }
    </article>
  `;
}

function renderAssignmentCardCompact(item) {
  const assignmentId = String(item.id);
  const title = item.tests?.title || "Untitled test";
  const className = item.classes?.name || "Unknown class";
  const isResultsOpen =
    state.activePanel?.type === "results-assignment" &&
    String(state.activePanel.id) === assignmentId;

  const status = getAssignmentStatus(item);
  const isActive = isResultsOpen;
  const analyticsReady = state.analyticsByAssignment[assignmentId]?.status === "ready";
  const analytics = analyticsReady ? state.analyticsByAssignment[assignmentId].data.current : null;
  const dueLabel = item.deadline ? `Due ${formatDate(item.deadline)}` : "No due date";
  const progressLabel = analytics ? `${analytics.completedCount}/${analytics.rosterCount} done` : "Results pending";
  const scoreLabel = analytics ? `${formatAverageIndicatorValue(analytics.averageIndicatorScore)} attainment` : "No indicator yet";

  return `
    <article class="td-assignment-card ${isActive ? "is-active" : ""}" data-assignment-card-id="${escapeAttr(assignmentId)}">
      <div class="td-card-row">
        <div class="td-card-main">
          <div class="td-card-title">${escapeHtml(title)}</div>
          <div class="td-card-subtitle">Class: ${escapeHtml(className)}</div>

          <div class="td-assignment-meta td-assignment-meta--stack td-assignment-meta--compact">
            <span class="td-assignment-chip">${renderIconLabel("calendar", dueLabel)}</span>
            <span class="td-assignment-chip">${renderIconLabel("checkCircle", progressLabel)}</span>
            <span class="td-assignment-chip">${renderIconLabel("award", scoreLabel)}</span>
            <span class="td-assignment-chip td-assignment-chip--status">${escapeHtml(status)}</span>
          </div>
        </div>

        <div class="td-card-actions">
          <button
            class="td-btn td-btn--ghost"
            type="button"
            data-action="open-results-assignment"
            data-assignment-id="${escapeAttr(assignmentId)}"
          >
            ${isResultsOpen ? "Hide results" : "View results"}
          </button>
        </div>
      </div>

      ${isResultsOpen ? renderAssignmentResultsPanelCalm(item) : ""}
    </article>
  `;
}

function renderClassResultsRow(item) {
  const assignmentId = String(item?.id || "");
  const title = item?.tests?.title || "Untitled test";
  const status = getAssignmentStatus(item);
  const analyticsState = state.analyticsByAssignment[assignmentId];

  if (analyticsState?.status === "ready") {
    const analytics = analyticsState.data?.current;
    const rosterCount = Math.max(1, Number(analytics?.rosterCount || 0));
    const completed = Math.max(0, Number(analytics?.completedCount || 0));
    const started = Math.max(0, Number(analytics?.startedCount || 0));
    const inProgress = Math.max(0, started - completed);
    const waiting = Math.max(0, rosterCount - started);
    const completedWidth = Math.round((completed / rosterCount) * 100);
    const inProgressWidth = Math.round((inProgress / rosterCount) * 100);
    const waitingWidth = Math.max(0, 100 - completedWidth - inProgressWidth);

    return `
      <article class="td-class-results-row">
        <div class="td-class-results-head">
          <div class="td-class-results-copy">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(getAssignmentReferenceLabel(item))}</span>
          </div>
          <div class="td-class-results-actions">
            <span class="td-assignment-chip td-assignment-chip--status">${escapeHtml(status)}</span>
            <button
              class="td-btn td-btn--tiny td-btn--ghost"
              type="button"
              data-action="jump-assignment-results"
              data-assignment-id="${escapeAttr(assignmentId)}"
            >
              Full results
            </button>
          </div>
        </div>
        <div class="td-class-results-progress" aria-label="Assignment progress">
          <span class="is-done" style="width:${completedWidth}%"></span>
          <span class="is-live" style="width:${inProgressWidth}%"></span>
          <span class="is-wait" style="width:${waitingWidth}%"></span>
        </div>
        <div class="td-class-results-stats">
          <span class="td-class-results-stat">${renderIconLabel("checkCircle", `${completed}/${analytics.rosterCount}`)}</span>
          <span class="td-class-results-stat">${renderIconLabel("award", formatAverageIndicatorValue(analytics.averageIndicatorScore))}</span>
          <span class="td-class-results-stat">${renderIconLabel("eye", getAssignmentWatchLabel(analytics))}</span>
        </div>
      </article>
    `;
  }

  return `
    <article class="td-class-results-row">
      <div class="td-class-results-head">
        <div class="td-class-results-copy">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(getAssignmentReferenceLabel(item))}</span>
        </div>
        <div class="td-class-results-actions">
          <span class="td-assignment-chip td-assignment-chip--status">${escapeHtml(status)}</span>
          <button
            class="td-btn td-btn--tiny td-btn--ghost"
            type="button"
            data-action="jump-assignment-results"
            data-assignment-id="${escapeAttr(assignmentId)}"
          >
            Full results
          </button>
        </div>
      </div>
      <div class="td-class-results-loading">
        ${escapeHtml(analyticsState?.status === "error" ? "Could not load summary yet." : "Loading summary...")}
      </div>
    </article>
  `;
}

function renderClassResultsPanelLegacy(cls) {
  const classId = String(cls?.id || "");
  const rangeKey = getClassResultsRangeKey(classId);
  const items = getClassResultsAssignments(classId, rangeKey);
  const summary = getClassResultsSummary(items);

  return `
    <div class="td-inline-panel td-inline-panel--attached td-inline-panel--calm">
      <div class="td-inline-head">
        <h4>Class results</h4>
        <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
      </div>

      <div class="td-filter-chip-row">
        ${CLASS_RESULTS_RANGE_OPTIONS.map((option) => `
          <button
            class="td-filter-chip ${rangeKey === option.key ? "is-active" : ""}"
            type="button"
            data-action="set-class-results-range"
            data-class-id="${escapeAttr(classId)}"
            data-range-key="${escapeAttr(option.key)}"
          >
            ${escapeHtml(option.label)}
          </button>
        `).join("")}
      </div>

      <div class="td-test-summary-row">
        <div class="td-summary-chip">
          <span>Assignments</span>
          <strong>${escapeHtml(String(summary.count))}</strong>
        </div>
        <div class="td-summary-chip">
          <span>Avg done</span>
          <strong>${escapeHtml(summary.averageCompletion == null ? "--" : formatPercent(summary.averageCompletion))}</strong>
        </div>
        <div class="td-summary-chip">
          <span>Avg attainment</span>
          <strong>${escapeHtml(formatAverageIndicatorValue(summary.averageIndicatorScore))}</strong>
        </div>
      </div>

      ${
        items.length
          ? `<div class="td-class-results-list">${items.map(renderClassResultsRow).join("")}</div>`
          : `
            <div class="td-empty td-empty--compact">
              <strong>No assignments in this range.</strong>
              <p>Try This week, 30 days, or All.</p>
            </div>
          `
      }
    </div>
  `;
}

function renderTestCard(test) {
  const canEditTest = canEditTestRecord(test);
  const canAssignTest = canAssignFromTestRecord(test);
  const canPresentTest = canPresentTestRecord(test);
  const assignableClasses = getOwnedAssignableClasses();
  const isAssignOpen =
    canAssignTest &&
    state.activePanel?.type === "assign-test" &&
    String(state.activePanel.id) === String(test.id);

  const isFlashed = String(state.flashTestId) === String(test.id);

  return `
    <article class="td-test-card ${isAssignOpen ? "is-active" : ""} ${isFlashed ? "is-flash" : ""}">
      <div class="td-card-row">
        <div class="td-card-main">
          <div class="td-card-title">
            ${escapeHtml(test.title || "Untitled test")}
            ${test?.is_auto_generated ? `<span class="td-pill">Auto-assigned</span>` : ""}
          </div>
          <div class="td-card-subtitle">${renderTestMeta(test)}</div>
        </div>

        <div class="td-card-actions">
          ${canPresentTest ? `<button class="td-btn td-btn--ghost" type="button" data-action="open-present-test" data-test-id="${escapeAttr(test.id)}">Present</button>` : ""}
          ${canAssignTest ? `
            <button
              class="td-btn td-btn--ghost"
              type="button"
              ${test?.is_auto_generated ? "disabled title=\"Use Generate Personalised Test to create a fresh personalised set.\"" : `data-action="open-assign-test" data-test-id="${escapeAttr(test.id)}"`}
            >
              ${test?.is_auto_generated ? "Generated" : "Assign"}
            </button>
          ` : ""}
          ${canEditTest ? `<button class="td-btn td-btn--ghost" type="button" data-action="open-edit-test" data-test-id="${escapeAttr(test.id)}">Edit</button>` : ""}
          ${canEditTest ? `<button class="td-btn td-btn--ghost" type="button" data-action="duplicate-test" data-test-id="${escapeAttr(test.id)}">Duplicate</button>` : ""}
          ${canEditTest ? `<button class="td-btn td-btn--ghost" type="button" data-action="delete-test" data-test-id="${escapeAttr(test.id)}">Delete</button>` : ""}
        </div>
      </div>

      ${
        isAssignOpen
          ? `
        <div class="td-inline-panel td-inline-panel--attached">
          <div class="td-inline-head">
            <h4>Assign: ${escapeHtml(test.title || "Untitled test")}</h4>
            <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">× Close</button>
          </div>

          <form data-form="assign-test" class="td-form-stack">
            <input type="hidden" name="test_id" value="${escapeAttr(test.id)}" />

            <div class="td-form-grid td-form-grid--assign">
              <label class="td-field">
                <span>Class</span>
                <select class="td-input" name="class_id" required>
                  <option value="">Select class...</option>
                  ${assignableClasses
                    .map(
                      (cls) =>
                        `<option value="${escapeAttr(cls.id)}">${escapeHtml(cls.name || "Untitled class")}</option>`
                    )
                    .join("")}
                </select>
              </label>

              <label class="td-field">
                <span>Mode</span>
                <select class="td-input" name="mode">
                  <option value="practice">practice</option>
                  <option value="test">test</option>
                </select>
              </label>

              <label class="td-field">
                <span>Attempts per word</span>
                <input class="td-input" type="number" name="max_attempts" min="1" placeholder="blank = unlimited per word" />
              </label>

              <label class="td-field">
                <span>Deadline</span>
                <input class="td-input" type="datetime-local" name="deadline" />
              </label>
            </div>

            <div class="td-form-actions">
              <button class="td-btn td-btn--primary" type="submit">Assign</button>
            </div>
          </form>
        </div>
      `
          : ""
      }
    </article>
  `;
}

function renderClassCardLegacy(cls) {
  const isEditOpen =
    state.activePanel?.type === "edit-class" &&
    String(state.activePanel.id) === String(cls.id);
  const isResultsOpen =
    state.activePanel?.type === "class-results" &&
    String(state.activePanel.id) === String(cls.id);

  const isActive = isEditOpen || isResultsOpen;
  const isFlashed = String(state.flashClassId) === String(cls.id);
  const subtitleParts = [];
  if (cls?.year_group) subtitleParts.push(cls.year_group);
  subtitleParts.push("Ready for assignments");

  return `
    <article class="td-class-card ${isActive ? "is-active" : ""} ${isFlashed ? "is-flash" : ""}">
      <div class="td-card-row">
        <div class="td-card-main">
          <div class="td-card-title">${escapeHtml(cls.name || "Untitled class")}</div>
          <div class="td-card-subtitle">${escapeHtml(subtitleParts.join(" • "))}</div>
        </div>

        <div class="td-card-actions">
          <button
            class="td-btn td-btn--ghost"
            type="button"
            data-action="open-class-results"
            data-class-id="${escapeAttr(cls.id)}"
          >
            ${isResultsOpen ? "Hide results" : "Results"}
          </button>
          <button
            class="td-btn td-btn--ghost"
            type="button"
            data-action="open-visual-summary"
            data-scope-type="class"
            data-scope-id="${escapeAttr(cls.id)}"
          >
            Analytics
          </button>
          <button class="td-btn td-btn--ghost" type="button" data-action="open-edit-class" data-class-id="${escapeAttr(cls.id)}">Edit</button>
          <button class="td-btn td-btn--ghost" type="button" data-action="delete-class" data-class-id="${escapeAttr(cls.id)}">Delete</button>
        </div>
      </div>

      ${
        isResultsOpen
          ? renderClassResultsPanel(cls)
          : isEditOpen
          ? `
        <div class="td-inline-panel td-inline-panel--attached">
          <div class="td-inline-head">
            <h4>Edit class</h4>
            <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">× Close</button>
          </div>

          <form data-form="edit-class" class="td-form-stack">
            <input type="hidden" name="class_id" value="${escapeAttr(cls.id)}" />

            <label class="td-field">
              <span>Class name</span>
              <input class="td-input" type="text" name="name" value="${escapeAttr(cls.name || "")}" required />
            </label>

            <label class="td-field">
              <span>Year group</span>
              <input class="td-input" type="text" name="year_group" value="${escapeAttr(cls.year_group || "")}" placeholder="e.g. Year 8" />
            </label>

            <div class="td-form-actions">
              <button class="td-btn td-btn--primary" type="submit">Save changes</button>
            </div>
          </form>
        </div>
      `
          : ""
      }
    </article>
  `;
}

function renderClassResultsPanel(cls) {
  const classId = String(cls?.id || "");
  const assignmentSelectId = `class-results-assignment-${classId || "current"}`;
  const items = getRecentClassResultsAssignments(classId);
  const selectedAssignmentId = getSelectedClassResultsAssignmentId(classId, items);
  const selectedItem = items.find((item) => String(item?.id || "") === selectedAssignmentId) || null;
  const selectedAnalyticsState = selectedAssignmentId ? state.analyticsByAssignment[selectedAssignmentId] : null;
  const selectedAnalytics = selectedAnalyticsState?.status === "ready" ? selectedAnalyticsState.data?.current : null;

  return `
    <div class="td-inline-panel td-inline-panel--attached td-inline-panel--calm">
      <div class="td-inline-head">
        <h4>Class results</h4>
        <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
      </div>

      <div class="td-results-grid td-results-grid--analytics">
        <section class="td-results-block td-results-block--wide">
          ${
            !items.length
              ? `
            <div class="td-empty td-empty--compact">
              <strong>No assignments yet for this class.</strong>
            </div>
          `
              : ""
          }

          ${
            items.length
              ? `
            <div class="td-field td-field--compact td-field--results-select">
              <div class="td-field-label-row">
                <label for="${escapeAttr(assignmentSelectId)}">Recent assignments</label>
                ${renderInfoTip("Choose from the five most recent assignments for this class to open the pupil-by-word results table.", {
                  label: "About recent assignments",
                  align: "start",
                })}
              </div>
              <select id="${escapeAttr(assignmentSelectId)}" class="td-input" data-field="class-results-assignment" data-class-id="${escapeAttr(classId)}">
                ${items.map((item) => `
                  <option value="${escapeAttr(item.id)}" ${String(item.id) === selectedAssignmentId ? "selected" : ""}>
                    ${escapeHtml(item?.tests?.title || "Untitled test")} (${escapeHtml(getAssignmentReferenceLabel(item))})
                  </option>
                `).join("")}
              </select>
            </div>
          `
              : ""
          }

          ${
            items.length && selectedAnalytics
              ? `${renderAssignmentProgressHero(selectedAnalytics)}`
              : ""
          }

          ${
            !items.length
              ? ""
              : !selectedAnalyticsState || selectedAnalyticsState.status === "loading"
                ? `
            <div class="td-empty td-empty--compact">
              <strong>Loading assignment results...</strong>
            </div>
          `
                : selectedAnalyticsState.status === "error"
                  ? `
            <div class="td-empty td-empty--compact">
              <strong>Could not load this assignment.</strong>
              <p>${escapeHtml(selectedAnalyticsState.message || "Please try again.")}</p>
            </div>
          `
                  : `
            <div class="td-class-results-selected">
              <div class="td-class-results-selected-head">
                <strong>${escapeHtml(selectedItem?.tests?.title || "Untitled test")}</strong>
                <span>${escapeHtml(getAssignmentReferenceLabel(selectedItem))}</span>
              </div>
              ${renderAssignmentResultsTable(selectedAnalyticsState.data?.current)}
            </div>
          `
          }
        </section>
      </div>
    </div>
  `;
}

function renderClassCard(cls) {
  const canEditClass = canEditClassRecord(cls);
  const isEditOpen =
    canEditClass &&
    state.activePanel?.type === "edit-class" &&
    String(state.activePanel.id) === String(cls.id);
  const isResultsOpen =
    state.activePanel?.type === "class-results" &&
    String(state.activePanel.id) === String(cls.id);

  const isActive = isEditOpen || isResultsOpen;
  const isFlashed = String(state.flashClassId) === String(cls.id);
  const savedAutoAssignPolicy = getSavedClassAutoAssignPolicy(cls.id);
  const effectiveAutoAssignPolicy = getEffectiveClassAutoAssignPolicy(cls.id);
  const autoAssignSummary = savedAutoAssignPolicy
    ? buildAutoAssignPolicySummary(effectiveAutoAssignPolicy)
    : "default";
  const subtitleParts = [];
  if (cls?.year_group) subtitleParts.push(cls.year_group);
  subtitleParts.push(getClassTypeDisplayLabel(cls?.class_type));
  subtitleParts.push("Ready for assignments");

  return `
    <article class="td-class-card ${isActive ? "is-active" : ""} ${isFlashed ? "is-flash" : ""}">
      <div class="td-card-row">
        <div class="td-card-main">
          <div class="td-card-title">${escapeHtml(cls.name || "Untitled class")}</div>
          <div class="td-card-subtitle">${escapeHtml(subtitleParts.join(" | "))}</div>
          ${canEditClass ? `<div class="td-card-subtitle">${escapeHtml(`Auto-assign: ${autoAssignSummary}`)}</div>` : ""}
        </div>

        <div class="td-card-actions">
          <button
            class="td-btn td-btn--ghost"
            type="button"
            data-action="open-class-results"
            data-class-id="${escapeAttr(cls.id)}"
          >
            ${isResultsOpen ? "Hide results" : "Results"}
          </button>
          ${canEditClass ? `<button class="td-btn td-btn--ghost" type="button" data-action="open-edit-class" data-class-id="${escapeAttr(cls.id)}">Edit</button>` : ""}
          ${canEditClass ? `<button class="td-btn td-btn--ghost" type="button" data-action="delete-class" data-class-id="${escapeAttr(cls.id)}">Delete</button>` : ""}
        </div>
      </div>

      ${
        isResultsOpen
          ? renderClassResultsPanel(cls)
          : canEditClass && isEditOpen
            ? `
        <div class="td-inline-panel td-inline-panel--attached">
          <div class="td-inline-head">
            <h4>Edit class</h4>
            <button type="button" class="td-btn td-btn--tiny" data-action="close-panel">Close</button>
          </div>

          <form data-form="edit-class" class="td-form-stack">
            <input type="hidden" name="class_id" value="${escapeAttr(cls.id)}" />

            <label class="td-field">
              <span>Class name</span>
              <input class="td-input" type="text" name="name" value="${escapeAttr(cls.name || "")}" required />
            </label>

            <label class="td-field">
              <span>Group type</span>
              <input class="td-input" type="text" value="${escapeAttr(getClassTypeDisplayLabel(cls?.class_type))}" disabled />
            </label>

            <label class="td-field">
              <span>Year group</span>
              <input class="td-input" type="text" name="year_group" value="${escapeAttr(cls.year_group || "")}" placeholder="e.g. Year 8" />
            </label>

            <div class="td-form-actions">
              <button class="td-btn td-btn--primary" type="submit">Save changes</button>
            </div>
          </form>

          <div class="td-inline-head">
            <h4>Auto-assign policy</h4>
          </div>

          <form data-form="class-auto-assign-policy" class="td-form-stack">
            <input type="hidden" name="class_id" value="${escapeAttr(cls.id)}" />

            <label class="td-field">
              <span>Assignment length</span>
              <input
                class="td-input"
                type="number"
                name="assignment_length"
                min="${AUTO_ASSIGN_POLICY_LENGTH_MIN}"
                max="${AUTO_ASSIGN_POLICY_LENGTH_MAX}"
                step="1"
                value="${escapeAttr(String(effectiveAutoAssignPolicy.assignment_length))}"
                required
              />
            </label>

            <label class="td-field">
              <span>Support preset</span>
              <select class="td-input" name="support_preset">
                ${AUTO_ASSIGN_SUPPORT_PRESET_OPTIONS
                  .map((option) => `<option value="${escapeAttr(option.value)}" ${effectiveAutoAssignPolicy.support_preset === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
                  .join("")}
              </select>
            </label>

            <label class="td-field">
              <span>Starter fallback</span>
              <select class="td-input" name="allow_starter_fallback">
                <option value="on" ${effectiveAutoAssignPolicy.allow_starter_fallback ? "selected" : ""}>On</option>
                <option value="off" ${effectiveAutoAssignPolicy.allow_starter_fallback ? "" : "selected"}>Off</option>
              </select>
            </label>

            <div class="td-action-inline-copy">
              ${escapeHtml(savedAutoAssignPolicy
                ? `Saved policy: ${buildAutoAssignPolicySummary(effectiveAutoAssignPolicy)}`
                : `Default policy: ${buildAutoAssignPolicySummary(AUTO_ASSIGN_POLICY_DEFAULTS)}`)}
            </div>

            <div class="td-form-actions">
              <button class="td-btn td-btn--primary" type="submit">Save policy</button>
              <button
                class="td-btn td-btn--ghost"
                type="button"
                data-action="reset-class-auto-assign-policy"
                data-class-id="${escapeAttr(cls.id)}"
                ${savedAutoAssignPolicy ? "" : "disabled"}
              >
                Reset to default
              </button>
            </div>
          </form>
        </div>
      `
            : ""
      }
    </article>
  `;
}


function renderLegacyTestMeta(test) {
  const parts = [];
  parts.push(`${Number(test.question_count || 0)} words`);

  const classNames = Array.isArray(test.assigned_class_names) ? test.assigned_class_names : [];
  if (classNames.length) {
    parts.push(classNames.length <= 2 ? classNames.join(", ") : `${classNames.slice(0, 2).join(", ")} +${classNames.length - 2}`);
  } else {
    parts.push("Not assigned");
  }

  if (test.earliest_deadline) {
    parts.push(getAssignmentStatus({ deadline: test.earliest_deadline }));
  }

  return parts.join(" • ");
}

function readableTeacherQuestionType(type) {
  return getQuestionTypeDisplayLabel(type, {
    noSupportLabel: "No support",
    fallbackLabel: "Test",
  });
}

function findTestRecord(testId) {
  return state.tests.find((item) => String(item?.id || "") === String(testId || "")) || null;
}

function isAutoGeneratedAssignment(item) {
  return !!findTestRecord(item?.test_id)?.is_auto_generated;
}

function renderTestMeta(test) {
  const parts = [];
  const generatedWordCount = Math.max(1, Number(test?.question_count || 0) || ASSIGNMENT_ENGINE_DEFAULT_LENGTH);
  parts.push(readableTeacherQuestionType(test.question_type));
  parts.push(test?.is_auto_generated
    ? `Personalised ${generatedWordCount}-word set`
    : `${Number(test.question_count || 0)} words`);
  if (test?.is_auto_generated) parts.push("Auto-assigned");
  if (test?.difficulty_summary?.score != null && test?.difficulty_summary?.band?.label) {
    parts.push(`Difficulty ${test.difficulty_summary.band?.key ? getDifficultyDisplayLabel(test.difficulty_summary.band.key) : test.difficulty_summary.band.label} (${test.difficulty_summary.score})`);
  }

  const classNames = Array.isArray(test.assigned_class_names) ? test.assigned_class_names : [];
  if (classNames.length) {
    parts.push(classNames.length <= 2 ? classNames.join(", ") : `${classNames.slice(0, 2).join(", ")} +${classNames.length - 2}`);
  } else if (String(test.status || "").trim().toLowerCase() === "draft") {
    parts.push("Draft");
  } else {
    parts.push("Ready to assign");
  }

  if (test.earliest_deadline) {
    parts.push(getAssignmentStatus({ deadline: test.earliest_deadline }));
  }

  return parts.join(" • ");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatShortDate(value) {
  if (!value) return "â€”";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "â€”";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function injectStyles() {
  if (document.getElementById("teacher-dashboard-styles")) return;

  const style = document.createElement("style");
  style.id = "teacher-dashboard-styles";
  style.textContent = `
    .td-shell{
      max-width:1100px;
      margin:0 auto;
      padding:24px 18px 56px;
      color:#0f172a;
    }

    .td-topbar{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      margin-bottom:18px;
    }

    .td-page-title{
      margin:0;
      font-size:1.7rem;
      line-height:1.1;
      font-weight:800;
      letter-spacing:-0.02em;
    }

    .td-muted{
      margin:6px 0 0;
      color:#64748b;
      font-size:0.95rem;
    }

    .td-notice{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:12px 14px;
      border-radius:14px;
      border:1px solid #dbeafe;
      margin:0 0 18px;
      font-size:0.95rem;
    }

    .td-notice--info{
      background:#f8fafc;
      border-color:#e2e8f0;
    }

    .td-notice--success{
      background:#f0fdf4;
      border-color:#bbf7d0;
    }

    .td-notice--error{
      background:#fef2f2;
      border-color:#fecaca;
    }

    .td-notice-close{
      appearance:none;
      border:0;
      background:transparent;
      font-size:1.1rem;
      cursor:pointer;
      color:#475569;
    }

    .td-action-bar{
      background:#fff;
      border:1px solid #e2e8f0;
      border-radius:18px;
      padding:18px;
      box-shadow:0 12px 32px rgba(15,23,42,0.04);
      margin:0 0 26px;
    }

    .td-action-kicker{
      font-size:.82rem;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:#64748b;
      margin-bottom:12px;
    }

    .td-action-row{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      align-items:center;
    }

    .td-action-support{
      margin-top:14px;
      padding-top:14px;
      border-top:1px solid #e2e8f0;
      display:grid;
      grid-template-columns:minmax(0,1.3fr) auto;
      gap:14px;
      align-items:center;
    }

    .td-action-support-copy{
      display:flex;
      flex-direction:column;
      gap:4px;
    }

    .td-action-support-copy strong{
      color:#0f172a;
      font-size:0.98rem;
      line-height:1.3;
    }

    .td-action-support-copy span{
      color:#64748b;
      font-size:0.9rem;
      line-height:1.45;
    }

    .td-action-row--support{
      justify-content:flex-end;
    }

    .td-action-button-shell{
      display:inline-flex;
      align-items:center;
      gap:8px;
      flex-wrap:nowrap;
    }

    .td-action-info-tip{
      flex:0 0 auto;
    }

    .td-action-info-tip-trigger{
      width:28px;
      height:28px;
      min-width:28px;
    }

    .td-create-class-inline{
      display:none;
      margin-top:14px;
      padding:16px 18px;
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#f8fafc;
    }

    .td-create-class-inline.is-open{
      display:block;
    }

    .td-create-class-form{
      display:flex;
      gap:10px;
      align-items:center;
      flex-wrap:wrap;
    }

    .td-create-class-form--auto-assign{
      align-items:flex-start;
    }

    .td-action-inline-copy{
      color:#64748b;
      font-size:0.88rem;
      line-height:1.45;
      max-width:none;
    }

    .td-btn--small{
      padding:8px 12px;
      font-size:0.84rem;
      border-radius:999px;
    }

    .td-checkbox-row{
      display:inline-flex;
      align-items:center;
      gap:8px;
      color:#334155;
      font-size:0.9rem;
      line-height:1.4;
    }

    .td-automation-run-head{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .td-automation-panel-title-block{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .td-automation-panel-title{
      color:#0f172a;
      font-size:1.05rem;
      line-height:1.3;
    }

    .td-automation-panel-intro{
      color:#64748b;
      font-size:0.9rem;
      line-height:1.55;
      max-width:72ch;
    }

    .td-automation-manager{
      display:flex;
      flex-direction:column;
      gap:16px;
    }

    .td-automation-alerts{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-automation-alert{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:14px 16px;
      flex-wrap:wrap;
      padding:14px 16px;
      border:1px solid #e2e8f0;
      border-radius:16px;
      background:#fff;
    }

    .td-automation-alert.is-warning{
      background:#fffbeb;
      border-color:#fde68a;
    }

    .td-automation-alert.is-expired{
      background:#fef2f2;
      border-color:#fecaca;
    }

    .td-automation-alert-copy{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
      flex:1 1 320px;
    }

    .td-automation-alert-copy strong{
      color:#0f172a;
      font-size:0.96rem;
      line-height:1.35;
    }

    .td-automation-alert-copy p{
      margin:0;
      color:#475569;
      font-size:0.9rem;
      line-height:1.5;
    }

    .td-automation-alert-actions{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      justify-content:flex-end;
    }

    .td-automation-editor-shell{
      display:flex;
      flex-direction:column;
      gap:12px;
      min-width:0;
    }

    .td-automation-editor-shell--full{
      width:100%;
    }

    .td-automation-policy-topbar{
      display:flex;
      flex-direction:column;
      gap:14px;
      padding:16px;
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#fff;
      box-shadow:0 8px 20px rgba(15,23,42,0.04);
    }

    .td-automation-policy-strip-head{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      flex-wrap:wrap;
      gap:12px 18px;
    }

    .td-automation-policy-strip-head strong{
      color:#0f172a;
      font-size:0.98rem;
      line-height:1.3;
    }

    .td-automation-policy-strip-controls{
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:12px 16px;
      flex-wrap:wrap;
    }

    .td-automation-policy-switcher-group{
      display:flex;
      align-items:flex-end;
      gap:8px;
      flex-wrap:wrap;
      flex:1 1 420px;
      min-width:0;
    }

    .td-automation-policy-select-shell{
      flex:1 1 320px;
      max-width:420px;
      min-width:260px;
    }

    .td-automation-policy-selector{
      min-width:240px;
    }

    .td-automation-policy-toolbar{
      display:flex;
      align-items:flex-end;
      justify-content:flex-end;
      gap:8px;
      flex-wrap:wrap;
      flex:1 1 360px;
    }

    .td-automation-policy-toolbar--structural{
      flex:0 1 auto;
    }

    .td-automation-policy-run-form{
      margin:0;
    }

    .td-automation-editor-fieldset{
      display:flex;
      flex-direction:column;
      gap:0;
      min-width:0;
      margin:0;
      padding:0;
      border:0;
    }

    .td-automation-selected-summary{
      display:flex;
      flex-direction:column;
      gap:12px;
      padding:16px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      background:#f8fafc;
    }

    .td-automation-selected-summary-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px 18px;
      flex-wrap:wrap;
    }

    .td-automation-selected-summary-main{
      display:flex;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
    }

    .td-automation-selected-summary-main strong{
      color:#0f172a;
      font-size:1rem;
      line-height:1.3;
    }

    .td-automation-summary-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:10px;
    }

    .td-automation-summary-item{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
      padding:10px 12px;
      border:1px solid #e2e8f0;
      border-radius:14px;
      background:#fff;
    }

    .td-automation-summary-item span{
      color:#64748b;
      font-size:0.76rem;
      font-weight:800;
      letter-spacing:0.05em;
      text-transform:uppercase;
    }

    .td-automation-summary-item strong{
      color:#0f172a;
      font-size:0.92rem;
      line-height:1.45;
      word-break:break-word;
    }

    .td-automation-selected-summary-foot{
      display:flex;
      flex-direction:column;
      gap:6px;
      color:#475569;
      font-size:0.92rem;
      line-height:1.5;
    }

    .td-empty--automation-policy{
      align-items:flex-start;
      text-align:left;
    }

    .td-automation-panel-section{
      display:flex;
      flex-direction:column;
      gap:12px;
      padding-top:6px;
      border-top:1px solid #e2eaf3;
    }

    .td-automation-panel-section:first-child{
      padding-top:0;
      border-top:none;
    }

    .td-automation-panel-section-head{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .td-automation-panel-section-head strong{
      color:#0f172a;
      font-size:0.98rem;
      line-height:1.3;
    }

    .td-automation-inline-copy-row,
    .td-automation-inline-label,
    .td-automation-inline-label-row{
      display:inline-flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
      min-width:0;
    }

    .td-automation-inline-copy-row .td-action-inline-copy{
      margin:0;
    }

    .td-automation-inline-label{
      color:#334155;
      font-size:0.88rem;
      font-weight:700;
      line-height:1.3;
    }

    .td-automation-inline-label-row strong{
      color:#334155;
      font-size:0.88rem;
      line-height:1.3;
    }

    .td-automation-run-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:12px;
      align-items:start;
    }

    .td-automation-run-grid--policy-details{
      grid-template-columns:minmax(260px,0.9fr) minmax(320px,1.35fr);
    }

    .td-automation-run-grid--generation{
      grid-template-columns:minmax(220px,280px) minmax(280px,1fr);
    }

    .td-automation-run-grid--intervention{
      grid-template-columns:repeat(3,minmax(0,1fr));
    }

    .td-intervention-filter-section{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-field--intervention-name{
      max-width:420px;
    }

    .td-field--automation-checkbox{
      justify-content:flex-end;
      align-self:end;
    }

    .td-field--automation-description{
      grid-column:span 2;
    }

    .td-automation-class-picker{
      display:flex;
      flex-direction:column;
      gap:12px;
      padding-top:4px;
    }

    .td-automation-class-picker-head{
      display:flex;
      gap:12px;
      justify-content:space-between;
      align-items:flex-start;
    }

    .td-automation-class-picker-head--intervention{
      justify-content:flex-start;
    }

    .td-automation-class-picker-head strong{
      color:#0f172a;
      font-size:0.96rem;
      line-height:1.3;
    }

    .td-automation-class-picker-actions{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }

    .td-automation-class-grid{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(280px,280px));
      gap:10px;
      justify-content:flex-start;
    }

    .td-automation-class-option{
      display:flex;
      align-items:flex-start;
      gap:10px;
      padding:12px 14px;
      border:1px solid #dbe3ee;
      border-radius:14px;
      background:#fff;
      color:#0f172a;
      font-size:0.92rem;
      line-height:1.35;
      cursor:pointer;
    }

    .td-automation-class-option input{
      margin-top:2px;
      flex:0 0 auto;
    }

    .td-automation-class-option span{
      display:block;
      min-width:0;
    }

    .td-automation-class-option span strong{
      display:block;
      font-size:0.94rem;
      line-height:1.35;
      color:#0f172a;
      font-weight:700;
    }

    .td-automation-class-option span small{
      display:block;
      margin-top:2px;
      color:#64748b;
      font-size:0.8rem;
      line-height:1.35;
    }

    .td-automation-class-option.is-selected{
      border-color:#94a3b8;
      background:#eff6ff;
      box-shadow:inset 0 0 0 1px rgba(148,163,184,0.16);
    }

    .td-automation-run-actions{
      display:flex;
      justify-content:flex-end;
      padding-top:4px;
    }

    .td-automation-run-actions--intervention{
      padding-top:0;
    }

    .td-automation-policy-summary{
      display:flex;
      flex-direction:column;
      gap:6px;
      padding:14px 16px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      background:#fff;
      color:#475569;
      font-size:0.92rem;
      line-height:1.5;
    }

    .td-automation-policy-summary strong{
      color:#0f172a;
      font-size:0.95rem;
      line-height:1.3;
    }

    .td-automation-policy-actions{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px 16px;
      flex-wrap:wrap;
    }

    .td-automation-policy-actions-group{
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
    }

    .td-automation-policy-actions-group--primary{
      margin-left:auto;
    }

    .td-automation-policy-action-status{
      color:#475569;
      font-size:0.9rem;
      line-height:1.45;
    }

    .td-automation-policy-summary--saved{
      gap:8px;
    }

    .td-automation-policy-status-row{
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:flex-start;
      flex-wrap:wrap;
    }

    .td-automation-policy-status-main{
      display:flex;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
    }

    .td-automation-policy-status-badges{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }

    .td-automation-policy-status-badge{
      display:inline-flex;
      align-items:center;
      border-radius:999px;
      padding:6px 10px;
      background:#eef2f7;
      color:#475569;
      font-size:0.78rem;
      font-weight:700;
      line-height:1.1;
    }

    .td-automation-policy-status-badge.is-live{
      background:#dcfce7;
      color:#166534;
    }

    .td-automation-policy-status-badge.is-scheduled{
      background:#dbeafe;
      color:#1d4ed8;
    }

    .td-automation-policy-status-badge.is-expiring{
      background:#fef3c7;
      color:#92400e;
    }

    .td-automation-policy-status-badge.is-expired{
      background:#fee2e2;
      color:#991b1b;
    }

    .td-automation-policy-status-badge.is-dirty{
      background:#fef3c7;
      color:#92400e;
    }

    .td-automation-policy-status-badge.is-archived{
      background:#e2e8f0;
      color:#334155;
    }

    .td-automation-policy-status-badge.is-draft{
      background:#eef2f7;
      color:#475569;
    }

    .td-input--textarea{
      min-height:110px;
      resize:vertical;
      padding-top:12px;
    }

    .td-automation-weekdays{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-automation-weekdays-label{
      color:#334155;
      font-size:0.88rem;
      font-weight:700;
      line-height:1.3;
    }

    .td-automation-weekdays-grid{
      display:flex;
      flex-wrap:wrap;
      gap:10px 14px;
    }

    .td-automation-weekday-sets{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-automation-weekday-row{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .td-automation-weekday-row-title{
      color:#475569;
      font-size:0.8rem;
      font-weight:800;
      letter-spacing:0.05em;
      text-transform:uppercase;
    }

    .td-checkbox-row--weekday{
      border:1px solid #dbe3ee;
      border-radius:999px;
      padding:8px 12px;
      background:#fff;
    }

    .td-checkbox-row--policy-active{
      border:1px solid #dbe3ee;
      border-radius:999px;
      padding:8px 12px;
      background:#f8fafc;
      color:#0f172a;
      font-weight:700;
    }

    .td-automation-preset-guide{
      display:grid;
      gap:10px;
      grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
    }

    .td-automation-preset-guide-item{
      display:flex;
      align-items:flex-start;
      gap:10px;
      padding:14px;
      border:1px solid #dbe3ee;
      border-radius:14px;
      background:#fff;
      color:#475569;
      font-size:0.86rem;
      line-height:1.45;
      cursor:pointer;
      transition:border-color .18s ease, background .18s ease, box-shadow .18s ease;
    }

    .td-automation-preset-guide-item:hover{
      border-color:#94a3b8;
      background:#f8fafc;
    }

    .td-automation-preset-guide-item input{
      margin-top:2px;
      flex:0 0 auto;
    }

    .td-automation-preset-guide-item span{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }

    .td-automation-preset-guide-item strong{
      color:#0f172a;
      font-size:0.9rem;
      line-height:1.3;
    }

    .td-automation-preset-guide-item small{
      color:#475569;
      font-size:0.84rem;
      line-height:1.45;
    }

    .td-automation-preset-guide-item.is-current{
      border-color:#94a3b8;
      background:#eff6ff;
      box-shadow:inset 0 0 0 1px rgba(148,163,184,0.14);
    }

    .td-field-error{
      color:#b91c1c;
      font-size:0.84rem;
      line-height:1.45;
    }

    .td-intervention-selected-pupils{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
    }

    .td-selection-chip{
      appearance:none;
      border:1px solid #dbe3ee;
      background:#fff;
      border-radius:999px;
      padding:8px 12px;
      display:inline-flex;
      align-items:center;
      gap:8px;
      color:#0f172a;
      font-size:0.84rem;
      line-height:1.2;
      cursor:pointer;
    }

    .td-selection-chip:hover{
      border-color:#94a3b8;
      background:#f8fafc;
    }

    .td-intervention-pupil-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:10px;
    }

    .td-automation-class-option--pupil{
      min-height:86px;
    }

    .td-form-stack{
      display:flex;
      flex-direction:column;
      gap:14px;
      flex:1 1 auto;
    }

    .td-form-grid{
      display:grid;
      gap:12px;
    }

    .td-form-grid--assign{
      grid-template-columns:1.3fr 0.8fr 0.9fr 1fr;
    }

    .td-field{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .td-field > span{
      font-size:0.83rem;
      color:#64748b;
      font-weight:600;
    }

    .td-input,
    .td-textarea{
      width:100%;
      box-sizing:border-box;
      font:inherit;
    }

    .td-input,
    .td-textarea{
      border:1px solid #dbe3ee;
      background:#fff;
      border-radius:12px;
      padding:11px 12px;
      color:#0f172a;
      outline:none;
      transition:border-color .18s ease, box-shadow .18s ease;
    }

    .td-input:focus,
    .td-textarea:focus{
      border-color:#94a3b8;
      box-shadow:0 0 0 3px rgba(148,163,184,0.15);
    }

    select.td-input{
      appearance:none;
      -webkit-appearance:none;
      min-height:46px;
      border-radius:12px;
      padding:11px 44px 11px 12px;
      padding-right:44px;
      background-color:#fff;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14' fill='none'%3E%3Cpath d='M3.25 5.5L7 9.25L10.75 5.5' stroke='%23475569' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat:no-repeat;
      background-position:right 16px center;
      background-size:14px 14px;
      cursor:pointer;
    }

    .td-form-actions{
      display:flex;
      justify-content:flex-end;
      gap:10px;
      margin-top:2px;
    }

    .td-form-grid--analytics-chat{
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
      width:min(100%, 480px);
    }

    .td-chat-card{
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#fff;
      padding:16px;
      box-shadow:0 10px 24px rgba(15,23,42,0.03);
    }

    .td-chat-card--surface{
      display:flex;
      flex-direction:column;
      gap:16px;
      min-height:680px;
    }

    .td-chat-card--inline{
      min-height:unset;
      margin-top:18px;
    }

    .td-chat-shell-head{
      display:flex;
      flex-wrap:wrap;
      align-items:flex-end;
      justify-content:space-between;
      gap:14px;
    }

    .td-chat-card-head{
      margin:0;
      flex:1 1 260px;
    }

    .td-chat-card-head h4{
      margin:0 0 4px;
      font-size:1rem;
      font-weight:800;
      color:#0f172a;
    }

    .td-chat-card-head p{
      margin:0;
      color:#64748b;
      font-size:0.92rem;
    }

    .td-field--compact{
      gap:6px;
    }

    .td-field--compact span{
      font-size:0.82rem;
      font-weight:700;
      color:#475569;
    }

    .td-field-label-row{
      display:inline-flex;
      align-items:center;
      gap:8px;
      width:fit-content;
    }

    .td-field-label-row label{
      font-size:0.82rem;
      font-weight:700;
      color:#475569;
    }

    .td-chat-thread-wrap{
      flex:1 1 auto;
      min-height:0;
      border:1px solid #e2e8f0;
      border-radius:20px;
      background:linear-gradient(180deg,#f8fafc 0%,#ffffff 18%);
      padding:18px 14px 18px 18px;
    }

    .td-textarea--chat{
      min-height:74px;
      max-height:160px;
      resize:vertical;
    }

    .td-chat-chip-row{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
    }

    .td-chat-footer{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-chat-composer{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      gap:12px;
      align-items:end;
    }

    .td-chat-composer-field{
      display:flex;
      flex-direction:column;
      gap:8px;
      min-width:0;
    }

    .td-chat-composer-label{
      font-size:0.82rem;
      font-weight:700;
      color:#475569;
    }

    .td-chat-composer-actions{
      display:flex;
      align-items:flex-end;
      justify-content:flex-end;
    }

    .td-chat-send{
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }

    .td-chip-btn{
      appearance:none;
      border:1px solid #dbe3ee;
      border-radius:999px;
      padding:8px 12px;
      background:#f8fafc;
      color:#334155;
      font:inherit;
      font-size:0.88rem;
      cursor:pointer;
      transition:border-color .18s ease, background .18s ease, color .18s ease;
    }

    .td-chip-btn:hover{
      border-color:#94a3b8;
      background:#eff6ff;
      color:#0f172a;
    }

    .td-chat-note{
      margin:0;
      color:#64748b;
      font-size:0.88rem;
    }

    .td-chat-thread{
      display:flex;
      flex-direction:column;
      gap:12px;
      min-height:360px;
      max-height:560px;
      height:100%;
      overflow:auto;
      padding-right:8px;
      scroll-behavior:smooth;
    }

    .td-chat-message{
      border:1px solid #dbe3ee;
      border-radius:18px;
      padding:12px 14px;
      background:#fff;
      max-width:min(82%, 720px);
      box-shadow:0 10px 24px rgba(15,23,42,0.04);
    }

    .td-chat-message--user{
      margin-left:auto;
      background:#eff6ff;
      border-color:#bfdbfe;
    }

    .td-chat-message--assistant{
      margin-right:auto;
      background:#fff;
    }

    .td-chat-message.is-loading{
      opacity:0.8;
    }

    .td-chat-message-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-bottom:6px;
      color:#64748b;
      font-size:0.82rem;
    }

    .td-chat-message-head strong{
      color:#0f172a;
      font-size:0.86rem;
    }

    .td-chat-message-body{
      color:#0f172a;
      font-size:0.95rem;
      line-height:1.55;
    }

    .td-chat-message-meta{
      margin-top:8px;
      color:#64748b;
      font-size:0.82rem;
    }

    .td-chat-card{
      position:relative;
      border:1px solid #dbe3ee;
      border-radius:28px;
      background:
        radial-gradient(circle at top, rgba(255,255,255,0.96), rgba(248,250,252,0.92) 58%, rgba(241,245,249,0.9) 100%);
      padding:20px;
      box-shadow:0 24px 52px rgba(15,23,42,0.07);
    }

    .td-chat-card--surface{
      display:flex;
      flex-direction:column;
      gap:0;
      min-height:840px;
    }

    .td-chat-card--inline{
      min-height:unset;
      margin-top:18px;
    }

    .td-chat-shell-layout{
      display:grid;
      grid-template-columns:220px minmax(0,1fr);
      gap:30px;
      flex:1 1 auto;
      min-height:792px;
    }

    .td-chat-shell-layout.is-history-hidden{
      grid-template-columns:minmax(0,1fr);
    }

    .td-chat-sidebar{
      display:flex;
      flex-direction:column;
      gap:8px;
      min-height:0;
      padding:10px 0 10px 2px;
      border-right:1px solid #e2eaf3;
    }

    .td-chat-history-new{
      appearance:none;
      border:none;
      background:transparent;
      color:#0f172a;
      font:inherit;
      font-size:0.98rem;
      font-weight:700;
      text-align:left;
      border-radius:14px;
      padding:10px 12px;
      cursor:pointer;
      transition:background .18s ease, color .18s ease;
    }

    .td-chat-history-new:hover{
      background:#f4f7fb;
    }

    .td-chat-history-new.is-active{
      background:#eef5fc;
    }

    .td-chat-sidebar-label{
      padding:10px 12px 4px;
      color:#94a3b8;
      font-size:0.8rem;
      font-weight:700;
      letter-spacing:0.02em;
      text-transform:uppercase;
    }

    .td-chat-history-list{
      display:flex;
      flex-direction:column;
      gap:2px;
      min-height:0;
      overflow:auto;
      padding-right:10px;
    }

    .td-chat-history-item{
      appearance:none;
      border:none;
      background:transparent;
      color:#334155;
      font:inherit;
      text-align:left;
      border-radius:14px;
      padding:10px 12px;
      cursor:pointer;
      transition:background .18s ease, color .18s ease;
    }

    .td-chat-history-item:hover{
      background:#f4f7fb;
      color:#0f172a;
    }

    .td-chat-history-item.is-active{
      background:#eef5fc;
      color:#0f172a;
    }

    .td-chat-history-item-title{
      display:block;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      font-size:0.94rem;
      font-weight:600;
      line-height:1.35;
    }

    .td-chat-history-item-meta{
      display:block;
      margin-top:3px;
      font-size:0.78rem;
      color:#94a3b8;
    }

    .td-chat-history-empty{
      padding:10px 12px;
      color:#94a3b8;
      font-size:0.88rem;
      line-height:1.45;
    }

    .td-chat-history-status{
      padding:6px 12px 0;
      color:#64748b;
      font-size:0.84rem;
    }

    .td-chat-main{
      display:flex;
      flex-direction:column;
      gap:24px;
      min-width:0;
      min-height:0;
      padding:10px 0 10px 0;
    }

    .td-chat-toolbar{
      display:flex;
      flex-wrap:wrap;
      align-items:flex-start;
      justify-content:flex-end;
      gap:18px;
      padding-right:52px;
    }

    .td-chat-toolbar-actions{
      display:flex;
      align-items:flex-end;
      justify-content:flex-end;
      gap:10px;
      flex-wrap:wrap;
    }

    .td-chat-toolbar-scope{
      width:min(100%, 292px);
    }

    .td-chat-toolbar-scope .td-input{
      min-height:56px;
      border-color:#d9e5f1;
      background:rgba(255,255,255,0.88);
      padding-left:18px;
      box-shadow:0 10px 22px rgba(15,23,42,0.04);
    }

    .td-chat-close-btn{
      position:absolute;
      top:14px;
      right:14px;
      width:38px;
      height:38px;
      border:1px solid #dbe3ee;
      border-radius:999px;
      background:rgba(255,255,255,0.95);
      color:#475569;
      font:inherit;
      font-size:1.35rem;
      line-height:1;
      cursor:pointer;
      box-shadow:0 8px 18px rgba(15,23,42,0.08);
      transition:background .18s ease, border-color .18s ease, color .18s ease, transform .18s ease;
    }

    .td-chat-close-btn:hover{
      background:#f8fafc;
      border-color:#94a3b8;
      color:#0f172a;
    }

    .td-chat-close-btn:active{
      transform:translateY(1px);
    }

    .td-chat-stage{
      flex:1 1 auto;
      min-height:0;
      display:flex;
      flex-direction:column;
      gap:24px;
    }

    .td-chat-stage--empty{
      justify-content:center;
      padding:28px 0 36px;
    }

    .td-chat-home{
      max-width:820px;
      margin:0 auto;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:12px;
      text-align:center;
    }

    .td-chat-home-title{
      margin:0;
      font-size:clamp(2rem, 3vw, 3rem);
      line-height:1.05;
      letter-spacing:-0.03em;
      color:#0f172a;
    }

    .td-chat-thread-wrap{
      flex:1 1 auto;
      min-height:0;
      border:1px solid #e2e8f0;
      border-radius:24px;
      background:linear-gradient(180deg,rgba(255,255,255,0.88) 0%, rgba(248,250,252,0.92) 100%);
      padding:20px 16px 20px 20px;
    }

    .td-chat-thread-wrap--conversation{
      background:rgba(248,250,252,0.64);
    }

    .td-chat-thread{
      display:flex;
      flex-direction:column;
      gap:14px;
      min-height:240px;
      max-height:560px;
      height:100%;
      overflow:auto;
      padding-right:8px;
      scroll-behavior:smooth;
    }

    .td-chat-footer{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-chat-footer--home{
      align-items:stretch;
    }

    .td-chat-composer--familiar{
      display:block;
      width:100%;
    }

    .td-chat-composer-shell{
      display:flex;
      align-items:center;
      gap:10px;
      border:1px solid #d9e5f1;
      border-radius:30px;
      background:rgba(255,255,255,0.98);
      padding:10px 12px 10px 18px;
      box-shadow:0 18px 36px rgba(15,23,42,0.07);
    }

    .td-chat-composer-shell--home{
      width:min(100%, 940px);
      margin:0 auto;
    }

    .td-chat-composer-field--shell{
      display:flex;
      flex-direction:column;
      gap:0;
      min-width:0;
      flex:1 1 auto;
    }

    .td-chat-composer-field--shell .td-chat-composer-label{
      display:none;
    }

    .td-chat-composer-shell .td-textarea--chat{
      min-height:22px;
      max-height:160px;
      border:none;
      background:transparent;
      box-shadow:none;
      padding:4px 0 3px;
      resize:none;
      overflow-y:hidden;
      font-size:1rem;
      line-height:1.45;
    }

    .td-chat-composer-shell .td-textarea--chat:focus{
      border:none;
      box-shadow:none;
    }

    .td-chat-composer-actions--shell{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      flex:0 0 auto;
    }

    .td-chat-send--icon{
      width:42px;
      min-width:42px;
      height:42px;
      border:none;
      border-radius:999px;
      padding:0;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      background:transparent;
      color:#64748b;
      box-shadow:none;
    }

    .td-chat-send--icon:hover{
      background:#eef2f7;
      color:#0f172a;
    }

    .td-chat-send--icon:disabled{
      background:transparent;
    }

    .td-chat-send-icon{
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }

    .td-chat-send-icon .uiIcon{
      width:18px;
      height:18px;
      transform:rotate(-90deg);
    }

    .td-chat-send-icon.is-thinking .uiIcon{
      transform:none;
    }

    .td-chat-chip-row{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
    }

    .td-chat-chip-row--hero{
      justify-content:center;
    }

    .td-chip-btn{
      appearance:none;
      border:1px solid #d9e5f1;
      border-radius:999px;
      padding:12px 18px;
      background:rgba(255,255,255,0.97);
      color:#334155;
      font:inherit;
      font-size:0.95rem;
      cursor:pointer;
      transition:border-color .18s ease, background .18s ease, color .18s ease, transform .18s ease;
    }

    .td-chip-btn:hover{
      border-color:#94a3b8;
      background:#eff6ff;
      color:#0f172a;
      transform:translateY(-1px);
    }

    .td-chip-btn--hero{
      padding:13px 20px;
      box-shadow:0 10px 22px rgba(15,23,42,0.04);
    }

    .td-chat-message{
      border:1px solid #e2e8f0;
      border-radius:22px;
      padding:14px 16px;
      background:#fff;
      max-width:min(78%, 760px);
      box-shadow:0 12px 28px rgba(15,23,42,0.05);
    }

    .td-chat-message--user{
      margin-left:auto;
      background:#0f172a;
      border-color:#0f172a;
      color:#fff;
    }

    .td-chat-message--user .td-chat-message-head,
    .td-chat-message--user .td-chat-message-head strong,
    .td-chat-message--user .td-chat-message-body,
    .td-chat-message--user .td-chat-message-meta{
      color:#f8fafc;
    }

    .td-chat-message--assistant{
      margin-right:auto;
      background:#fff;
    }

    .td-chat-message.is-loading{
      opacity:0.8;
    }

    .td-chat-message-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-bottom:6px;
      color:#64748b;
      font-size:0.82rem;
    }

    .td-chat-message-head strong{
      color:#0f172a;
      font-size:0.86rem;
    }

    .td-chat-message-body{
      color:#0f172a;
      font-size:0.96rem;
      line-height:1.65;
    }

    .td-chat-message-meta{
      margin-top:8px;
      color:#64748b;
      font-size:0.82rem;
    }

    .td-btn{
      appearance:none;
      border:1px solid #dbe3ee;
      background:#fff;
      color:#0f172a;
      padding:10px 14px;
      border-radius:12px;
      font:inherit;
      font-weight:700;
      cursor:pointer;
      transition:transform .08s ease, background .18s ease, border-color .18s ease, opacity .18s ease;
      white-space:nowrap;
    }

    .td-btn:hover{
      background:#f8fafc;
    }

    .td-btn:active{
      transform:translateY(1px);
    }

    .td-btn:disabled{
      opacity:.6;
      cursor:not-allowed;
    }

    .td-btn--primary{
      background:#0f172a;
      color:#fff;
      border-color:#0f172a;
    }

    .td-btn--primary:hover{
      background:#1e293b;
      border-color:#1e293b;
    }

    .td-btn--ghost{
      background:#fff;
    }

    .td-btn--danger{
      background:#b91c1c;
      color:#fff;
      border-color:#b91c1c;
    }

    .td-btn--danger:hover{
      background:#991b1b;
      border-color:#991b1b;
    }

    .td-btn--tiny{
      padding:8px 10px;
      font-size:.88rem;
      border-radius:10px;
    }

    .td-test-cta{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      min-width:116px;
      max-width:100%;
      padding:7px 12px;
      border:1px solid #cbd5e1;
      border-radius:999px;
      background:#fff;
      color:#475569;
      white-space:nowrap;
      text-align:center;
      box-shadow:none;
      transition:transform .14s ease, border-color .18s ease, background .18s ease;
    }

    .td-test-cta:hover,
    .td-test-cta:focus-visible{
      transform:translateY(-1px);
      background:#f8fafc;
      border-color:#94a3b8;
      box-shadow:none;
      outline:none;
    }

    .td-test-cta-label{
      color:#475569;
      font-size:.75rem;
      font-weight:700;
      line-height:1;
      letter-spacing:.01em;
      text-transform:none;
    }

    .td-test-cta-arrow{
      width:8px;
      height:8px;
      flex:0 0 8px;
      border-top:2px solid #64748b;
      border-right:2px solid #64748b;
      transform:rotate(45deg);
    }

    .td-section{
      margin-top:28px;
    }

    .td-section-head{
      display:flex;
      align-items:center;
      gap:12px;
      margin:0 0 10px;
    }

    .td-section-head--inline{
      justify-content:space-between;
      gap:10px;
      padding:10px 12px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      background:#fff;
      box-shadow:0 10px 24px rgba(15,23,42,0.03);
      margin-bottom:8px;
    }

    .td-section-head--toggle{
      width:100%;
      appearance:none;
      -webkit-appearance:none;
      text-align:left;
      cursor:pointer;
      transition:border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s ease;
    }

    .td-section-head--toggle:hover{
      border-color:#cbd5e1;
      background:#f8fafc;
    }

    .td-section-head--toggle:focus-visible{
      outline:none;
      border-color:#93c5fd;
      box-shadow:0 0 0 3px rgba(147,197,253,0.24), 0 10px 24px rgba(15,23,42,0.03);
    }

    .td-section-head--toggle.is-open{
      background:#f8fbff;
      border-color:#bfdbfe;
    }

    .td-section-head-main{
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0;
      flex:1 1 auto;
    }

    .td-section-kicker{
      width:8px;
      height:28px;
      border-radius:999px;
      background:linear-gradient(180deg,#7dd3fc 0%,#2563eb 100%);
      box-shadow:0 0 0 1px rgba(37,99,235,0.12), 0 8px 18px rgba(37,99,235,0.16);
      flex:0 0 auto;
    }

    .td-section-title{
      margin:0;
      font-size:1.18rem;
      line-height:1.1;
      font-weight:800;
      letter-spacing:-0.02em;
      color:#0f172a;
      margin-right:auto;
    }

    .td-section-head-main .td-section-title{
      margin-right:0;
    }

    .td-section-arrow{
      display:inline-block;
      margin-left:auto;
      color:#0f172a;
      width:32px;
      text-align:center;
      font-size:32px;
      font-weight:900;
      line-height:1;
      flex:0 0 auto;
      transition:transform .18s ease, color .18s ease;
      transform-origin:center center;
    }

    .td-section-arrow.is-open{
      transform:rotate(90deg);
      color:#0f172a;
    }

    .td-toggle{
      display:flex;
      align-items:center;
      gap:8px;
      font-weight:700;
      text-align:left;
      cursor:pointer;
      color:#0f172a;
      transition:color .18s ease;
    }

    .td-toggle--inline{
      width:auto;
      padding:8px 12px;
      border:1px solid #dbe3ee;
      background:#f8fafc;
      border-radius:999px;
      font-size:0.92rem;
      font-weight:700;
      color:#0f172a;
      margin-left:2px;
    }

    .td-toggle--inline:hover{
      background:#eef2f7;
      color:#334155;
    }

    .td-toggle--inline.is-open{
      background:#0f172a;
      border-color:#0f172a;
      color:#fff;
    }

    .td-toggle-chev{
      display:inline-block;
      transition:transform .18s ease;
      transform-origin:center;
      font-size:.82em;
    }

    .td-toggle-chev.is-open{
      transform:rotate(90deg);
    }

    .td-section-body{
      margin-top:14px;
    }

    .td-analytics-bar{
      margin-top:24px;
    }

    .td-analytics-bar-card{
      border:1px solid #dbe3ee;
      border-radius:20px;
      background:#fff;
      padding:14px 16px;
      box-shadow:0 12px 28px rgba(15,23,42,0.04);
    }

    .td-analytics-bar-card--toolbar{
      padding:12px 14px;
      background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);
    }

    .td-analytics-bar-row{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
      align-items:end;
    }

    .td-analytics-bar-row--toolbar{
      width:100%;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    }

    .td-field--toolbar{
      gap:4px;
      min-width:0;
    }

    .td-field--toolbar .td-input{
      width:100%;
      min-height:48px;
      border-radius:999px;
      padding-left:14px;
      padding-right:14px;
      background-color:#f8fafc;
    }

    .td-analytics-bar-title{
      margin:0;
      font-size:1.12rem;
      font-weight:800;
      color:#0f172a;
    }

    .td-analytics-bar-actions{
      display:flex;
      flex-wrap:wrap;
      justify-content:flex-end;
      gap:8px;
    }

    .td-analytics-bar-controls{
      display:grid;
      grid-template-columns:minmax(220px,0.95fr) minmax(220px,1.1fr);
      gap:12px;
      align-items:end;
    }

    .td-analytics-bar-chip{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-height:60px;
      border:1px solid #dbe3ee;
      border-radius:14px;
      background:#f8fafc;
      padding:11px 12px;
      color:#475569;
    }

    .td-analytics-bar-chip strong{
      color:#0f172a;
      font-size:1rem;
    }

    .td-analytics-bar-summary{
      margin-top:14px;
    }

    .td-floating-ai{
      position:fixed;
      right:24px;
      bottom:24px;
      z-index:60;
      display:inline-flex;
      align-items:center;
      gap:10px;
      border:1px solid #0f172a;
      border-radius:999px;
      background:#0f172a;
      color:#fff;
      padding:12px 16px;
      font:inherit;
      font-weight:800;
      cursor:pointer;
      box-shadow:0 16px 32px rgba(15,23,42,0.2);
    }

    .td-floating-ai-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:28px;
      height:28px;
      border-radius:999px;
      background:#fff;
      color:#0f172a;
      font-size:0.82rem;
      font-weight:800;
      flex:0 0 auto;
    }

    .td-chat-note--bar{
      margin-top:12px;
    }

    .td-search-row{
      margin-bottom:14px;
    }

    .td-staff-access-layout{
      display:grid;
      grid-template-columns:minmax(240px, 320px) minmax(0, 1fr);
      gap:18px;
      align-items:start;
    }

    .td-staff-access-sidebar,
    .td-staff-access-detail,
    .td-staff-access-audit-card{
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#fff;
      box-shadow:0 10px 24px rgba(15,23,42,0.03);
    }

    .td-staff-access-sidebar{
      padding:16px;
    }

    .td-staff-access-import-card{
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#fff;
      box-shadow:0 10px 24px rgba(15,23,42,0.03);
      padding:16px 18px;
      margin-bottom:18px;
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .td-staff-access-import-card--result{
      background:#f8fbff;
      border-color:#bfdbfe;
    }

    .td-staff-access-import-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      flex-wrap:wrap;
    }

    .td-staff-access-import-head h4{
      margin:0 0 4px;
      color:#0f172a;
      font-size:1rem;
      line-height:1.3;
    }

    .td-staff-access-import-head p{
      margin:0;
      color:#64748b;
      font-size:0.9rem;
      line-height:1.5;
      max-width:70ch;
    }

    .td-staff-access-import-file{
      color:#475569;
      font-size:0.84rem;
      line-height:1.4;
    }

    .td-staff-access-import-summary{
      display:flex;
      flex-wrap:wrap;
      gap:8px 12px;
      color:#64748b;
      font-size:0.84rem;
    }

    .td-staff-access-import-actions{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      align-items:center;
      justify-content:flex-end;
    }

    .td-input--file{
      min-width:min(100%, 320px);
    }

    .td-staff-access-import-preview-list{
      display:flex;
      flex-direction:column;
      gap:12px;
      max-height:min(52vh, 540px);
      overflow:auto;
      padding-right:4px;
    }

    .td-staff-access-import-preview-group{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-staff-access-import-preview-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      color:#475569;
      font-size:0.84rem;
    }

    .td-staff-access-import-row{
      border:1px solid #e2e8f0;
      border-radius:14px;
      background:#f8fafc;
      padding:12px 14px;
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-staff-access-import-row-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      flex-wrap:wrap;
    }

    .td-staff-access-import-row-head strong{
      display:block;
      color:#0f172a;
      font-size:0.92rem;
      line-height:1.35;
    }

    .td-staff-access-import-row-head span{
      color:#64748b;
      font-size:0.82rem;
      line-height:1.4;
    }

    .td-staff-access-import-row-copy{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .td-staff-access-import-row-copy p{
      margin:0;
      color:#475569;
      font-size:0.84rem;
      line-height:1.45;
    }

    .td-staff-access-import-row-messages{
      display:flex;
      flex-direction:column;
      gap:4px;
      color:#92400e;
      font-size:0.8rem;
      line-height:1.4;
    }

    .td-staff-access-import-row-messages.is-error{
      color:#991b1b;
    }

    .td-staff-access-filter-row{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-bottom:14px;
    }

    .td-staff-access-filter-row .td-btn.is-selected{
      background:#eff6ff;
      border-color:#93c5fd;
      color:#1d4ed8;
    }

    .td-staff-access-directory{
      display:flex;
      flex-direction:column;
      gap:10px;
      max-height:min(68vh, 520px);
      overflow-y:auto;
      overflow-x:hidden;
      padding-right:2px;
    }

    .td-staff-access-person{
      appearance:none;
      width:100%;
      border:1px solid #dbe3ee;
      border-radius:14px;
      background:#fff;
      padding:12px 14px;
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      justify-content:flex-start;
      gap:12px;
      text-align:left;
      cursor:pointer;
      transition:border-color .18s ease, background .18s ease, box-shadow .18s ease;
      overflow:visible;
      min-height:unset;
      max-height:none;
      white-space:normal;
    }

    .td-staff-access-person:hover{
      border-color:#94a3b8;
      background:#f8fafc;
    }

    .td-staff-access-person.is-selected{
      border-color:#93c5fd;
      background:#eff6ff;
      box-shadow:inset 0 0 0 1px rgba(147,197,253,0.35);
    }

    .td-staff-access-person-copy{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
      width:100%;
    }

    .td-staff-access-person-copy strong{
      color:#0f172a;
      font-size:0.95rem;
      line-height:1.3;
      white-space:normal;
      overflow-wrap:anywhere;
    }

    .td-staff-access-person-copy span{
      color:#64748b;
      font-size:0.84rem;
      line-height:1.4;
      white-space:normal;
      overflow-wrap:anywhere;
      word-break:normal;
    }

    .td-staff-access-person-badges{
      display:flex;
      flex-wrap:wrap;
      justify-content:flex-start;
      gap:6px;
      width:100%;
      min-width:0;
    }

    .td-staff-access-main{
      display:flex;
      flex-direction:column;
      gap:16px;
      min-width:0;
    }

    .td-staff-access-detail{
      padding:18px;
      display:flex;
      flex-direction:column;
      gap:16px;
    }

    .td-staff-access-header{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      flex-wrap:wrap;
    }

    .td-staff-access-header h3{
      margin:0 0 4px;
      color:#0f172a;
      font-size:1.1rem;
      line-height:1.3;
    }

    .td-staff-access-header p{
      margin:0;
      color:#64748b;
      font-size:0.9rem;
      line-height:1.45;
    }

    .td-staff-access-header-pills{
      display:flex;
      flex-wrap:wrap;
      justify-content:flex-end;
      gap:8px;
    }

    .td-staff-access-warning-list{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-staff-access-warning{
      padding:12px 14px;
      border:1px solid #fde68a;
      border-radius:14px;
      background:#fffbeb;
    }

    .td-staff-access-warning strong{
      display:block;
      color:#92400e;
      font-size:0.84rem;
      margin-bottom:4px;
    }

    .td-staff-access-warning p{
      margin:0;
      color:#92400e;
      font-size:0.9rem;
      line-height:1.45;
    }

    .td-staff-access-summary-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:14px;
    }

    .td-staff-access-summary-card{
      border:1px solid #dbe3ee;
      border-radius:16px;
      background:#f8fafc;
      padding:14px;
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-staff-access-summary-card > span{
      color:#475569;
      font-size:0.82rem;
      font-weight:800;
      letter-spacing:.05em;
      text-transform:uppercase;
    }

    .td-staff-access-import-detail-list{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .td-staff-access-import-detail-item{
      display:flex;
      flex-direction:column;
      gap:4px;
    }

    .td-staff-access-import-detail-item strong{
      color:#0f172a;
      font-size:0.84rem;
      line-height:1.35;
    }

    .td-staff-access-import-detail-item span{
      color:#475569;
      font-size:0.84rem;
      line-height:1.45;
      word-break:break-word;
    }

    .td-staff-access-head-inline{
      display:inline-flex;
      align-items:center;
      gap:6px;
      flex-wrap:wrap;
    }

    .td-staff-access-inline-tip{
      display:inline-flex;
      align-items:center;
    }

    .td-staff-access-inline-tip-trigger{
      color:#64748b;
    }

    .td-staff-access-chip-row{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
    }

    .td-staff-access-chip{
      display:inline-flex;
      align-items:center;
      gap:6px;
      border-radius:999px;
      background:#e2e8f0;
      color:#334155;
      padding:7px 11px;
      font-size:0.84rem;
      font-weight:700;
      line-height:1.2;
    }

    .td-staff-access-chip--scope{
      background:#eef2ff;
      color:#3730a3;
    }

    .td-staff-access-chip--pending{
      background:#dbeafe;
      color:#1d4ed8;
    }

    .td-staff-access-role-grid{
      display:grid;
      gap:14px;
    }

    .td-staff-access-role-card{
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#fff;
      padding:16px;
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .td-staff-access-role-card.is-active{
      border-color:#cbd5e1;
      box-shadow:0 10px 22px rgba(15,23,42,0.04);
    }

    .td-staff-access-role-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:14px;
      flex-wrap:wrap;
    }

    .td-staff-access-role-copy{
      display:flex;
      flex-direction:column;
      gap:6px;
      min-width:0;
    }

    .td-staff-access-role-copy h4{
      margin:0;
      color:#0f172a;
      font-size:1rem;
      line-height:1.3;
    }

    .td-staff-access-role-copy p{
      margin:0;
      color:#64748b;
      font-size:0.9rem;
      line-height:1.5;
      max-width:70ch;
    }

    .td-staff-access-role-actions{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:10px;
      flex:0 0 auto;
    }

    .td-staff-access-note{
      margin:0;
      color:#64748b;
      font-size:0.88rem;
      line-height:1.45;
    }

    .td-staff-access-note--compact{
      font-size:0.84rem;
    }

    .td-staff-access-note--warning{
      color:#92400e;
    }

    .td-staff-access-role-btns{
      display:grid;
      grid-template-columns:repeat(2, minmax(148px, 1fr));
      gap:8px;
      min-width:320px;
    }

    .td-staff-access-role-btns.is-single{
      grid-template-columns:1fr;
      min-width:0;
      width:100%;
      max-width:100%;
    }

    .td-staff-access-role-btns.is-single .td-btn{
      width:fit-content;
      max-width:100%;
      justify-self:end;
    }

    .td-staff-access-role-footer{
      margin-top:auto;
      padding-top:12px;
      border-top:1px solid #e2e8f0;
      display:flex;
      justify-content:flex-end;
    }

    .td-staff-access-role-btns .td-btn,
    .td-staff-access-btn-slot{
      width:100%;
    }

    .td-staff-access-btn-slot{
      visibility:hidden;
      pointer-events:none;
    }

    .td-staff-access-btn--danger{
      border-color:#fecaca;
      color:#991b1b;
    }

    .td-staff-access-btn--danger:hover{
      background:#fef2f2;
      border-color:#fca5a5;
    }

    .td-staff-access-scope-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
    }

    .td-staff-access-scope-block{
      border:1px solid #e2e8f0;
      border-radius:16px;
      background:#f8fafc;
      padding:14px;
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-staff-access-scope-head strong{
      color:#0f172a;
      font-size:0.92rem;
      line-height:1.3;
    }

    .td-staff-access-scope-list{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
    }

    .td-staff-access-scope-chip{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:7px 10px;
      border-radius:999px;
      border:1px solid #cbd5e1;
      background:#fff;
      color:#334155;
      font-size:0.83rem;
      line-height:1.2;
    }

    .td-staff-access-scope-form{
      display:grid;
      grid-template-columns:minmax(0,1fr);
      gap:10px;
      align-items:center;
    }

    .td-staff-access-assigned-list{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .td-staff-access-assigned-item{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:8px 0;
      border-bottom:1px solid #e2e8f0;
    }

    .td-staff-access-assigned-item:last-child{
      border-bottom:none;
      padding-bottom:0;
    }

    .td-staff-access-assigned-item span{
      color:#334155;
      font-size:0.84rem;
      line-height:1.35;
    }

    .td-staff-access-included-wrap{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-staff-access-included-list{
      display:flex;
      flex-direction:column;
      gap:8px;
      max-height:220px;
      overflow:auto;
      padding-right:4px;
    }

    .td-staff-access-included-item{
      border:1px solid #e2e8f0;
      border-radius:14px;
      background:#fff;
      padding:10px 12px;
    }

    .td-staff-access-included-copy{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }

    .td-staff-access-included-copy strong{
      color:#0f172a;
      font-size:0.86rem;
      line-height:1.35;
    }

    .td-staff-access-included-copy span{
      color:#64748b;
      font-size:0.78rem;
      line-height:1.35;
    }

    .td-staff-access-checklist{
      display:flex;
      flex-direction:column;
      gap:8px;
      max-height:220px;
      overflow:auto;
      padding-right:4px;
    }

    .td-staff-access-check-item{
      display:flex;
      align-items:flex-start;
      gap:10px;
      border:1px solid #dbe3ee;
      border-radius:14px;
      background:#fff;
      padding:10px 12px;
      cursor:pointer;
    }

    .td-staff-access-check-item.is-disabled{
      background:#f8fafc;
      color:#94a3b8;
      cursor:not-allowed;
    }

    .td-staff-access-check-item.is-disabled .td-staff-access-check-copy strong,
    .td-staff-access-check-item.is-disabled .td-staff-access-check-copy em{
      color:#94a3b8;
    }

    .td-staff-access-check-item input{
      margin-top:2px;
    }

    .td-staff-access-check-copy{
      display:flex;
      flex-direction:column;
      gap:3px;
      min-width:0;
    }

    .td-staff-access-check-copy strong{
      color:#0f172a;
      font-size:0.86rem;
      line-height:1.35;
    }

    .td-staff-access-check-copy em{
      color:#64748b;
      font-size:0.77rem;
      font-style:normal;
      line-height:1.35;
    }

    .td-staff-access-flow-note{
      border-top:1px solid #e2e8f0;
      padding-top:12px;
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .td-staff-access-audit-card{
      padding:16px;
    }

    .td-staff-access-audit-head{
      display:flex;
      align-items:baseline;
      justify-content:space-between;
      gap:10px;
      margin-bottom:12px;
      flex-wrap:wrap;
    }

    .td-staff-access-audit-head h4{
      margin:0;
      color:#0f172a;
      font-size:0.98rem;
      line-height:1.3;
    }

    .td-staff-access-audit-head span{
      color:#64748b;
      font-size:0.84rem;
      line-height:1.3;
    }

    .td-staff-access-audit-list{
      display:flex;
      flex-direction:column;
      gap:10px;
      max-height:min(46vh, 360px);
      overflow:auto;
      padding-right:4px;
    }

    .td-staff-access-audit-item{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:14px;
      padding:12px 0;
      border-top:1px solid #e2e8f0;
    }

    .td-staff-access-audit-item:first-child{
      border-top:none;
      padding-top:0;
    }

    .td-staff-access-audit-copy,
    .td-staff-access-audit-meta{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }

    .td-staff-access-audit-copy strong{
      color:#0f172a;
      font-size:0.9rem;
      line-height:1.3;
    }

    .td-staff-access-audit-copy span,
    .td-staff-access-audit-meta span{
      color:#64748b;
      font-size:0.82rem;
      line-height:1.4;
    }

    .td-staff-access-modal-shell{
      position:fixed;
      inset:0;
      z-index:1200;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
    }

    .td-staff-access-modal-backdrop{
      position:absolute;
      inset:0;
      background:rgba(15,23,42,0.48);
    }

    .td-staff-access-modal{
      position:relative;
      width:min(100%, 520px);
      border:1px solid #dbe3ee;
      border-radius:20px;
      background:#fff;
      box-shadow:0 24px 60px rgba(15,23,42,0.24);
      padding:20px;
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .td-staff-access-modal.is-danger{
      border-color:#fecaca;
    }

    .td-staff-access-modal-head h3{
      margin:0;
      color:#0f172a;
      font-size:1.05rem;
      line-height:1.35;
    }

    .td-staff-access-modal-body{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-staff-access-modal-body p{
      margin:0;
      color:#475569;
      font-size:0.93rem;
      line-height:1.5;
    }

    .td-staff-access-modal-actions{
      display:flex;
      justify-content:flex-end;
      gap:10px;
      flex-wrap:wrap;
    }

    .td-visual-browser{
      display:flex;
      flex-direction:column;
      gap:16px;
      margin-bottom:18px;
    }

    .td-visual-browser--compact{
      margin-bottom:0;
    }

    .td-visual-group{
      border:1px solid #dbe3ee;
      border-radius:20px;
      background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%);
      padding:16px;
      box-shadow:0 12px 28px rgba(15,23,42,0.04);
    }

    .td-visual-switcher{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-bottom:14px;
    }

    .td-visual-group-btn{
      appearance:none;
      border:1px solid #dbe3ee;
      border-radius:999px;
      padding:8px 12px;
      background:#fff;
      color:#334155;
      cursor:pointer;
      display:inline-flex;
      align-items:center;
      gap:8px;
      font:inherit;
      font-size:0.88rem;
      font-weight:700;
      transition:border-color .18s ease, background .18s ease, color .18s ease;
    }

    .td-visual-group-btn strong{
      color:#0f172a;
      font-size:0.86rem;
    }

    .td-visual-group-btn.is-active{
      background:#0f172a;
      border-color:#0f172a;
      color:#fff;
    }

    .td-visual-group-btn.is-active strong{
      color:#fff;
    }

    .td-visual-group-head{
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:14px;
      margin-bottom:14px;
    }

    .td-visual-group-head--compact{
      margin-bottom:12px;
    }

    .td-visual-group-head h4{
      margin:0 0 4px;
      font-size:1rem;
      font-weight:800;
      color:#0f172a;
    }

    .td-visual-group-head p{
      margin:0;
      color:#64748b;
      font-size:0.92rem;
    }

    .td-visual-search{
      display:flex;
      flex-direction:column;
      gap:6px;
      min-width:min(280px, 100%);
    }

    .td-visual-search span{
      font-size:0.82rem;
      font-weight:700;
      color:#475569;
    }

    .td-visual-scope-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:12px;
    }

    .td-visual-scope-grid--solo{
      grid-template-columns:minmax(240px, 1fr);
    }

    .td-visual-scope-grid--students{
      grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
    }

    .td-visual-scope-card{
      appearance:none;
      text-align:left;
      border:1px solid #dbe3ee;
      border-radius:18px;
      padding:12px;
      background:#fff;
      color:#0f172a;
      cursor:pointer;
      transition:transform .08s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
      box-shadow:0 10px 24px rgba(15,23,42,0.03);
    }

    .td-visual-scope-card:hover{
      border-color:#94a3b8;
      box-shadow:0 14px 30px rgba(15,23,42,0.07);
    }

    .td-visual-scope-card:active{
      transform:translateY(1px);
    }

    .td-visual-scope-card.is-selected{
      border-color:#0f172a;
      box-shadow:0 16px 34px rgba(15,23,42,0.1);
      background:#f8fafc;
    }

    .td-visual-scope-card--good{
      background:linear-gradient(180deg,#f0fdf4 0%,#ffffff 100%);
    }

    .td-visual-scope-card--warm{
      background:linear-gradient(180deg,#fffbeb 0%,#ffffff 100%);
    }

    .td-visual-scope-card--alert{
      background:linear-gradient(180deg,#fff7ed 0%,#ffffff 100%);
    }

    .td-visual-scope-top{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:10px;
    }

    .td-visual-scope-kind{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      border-radius:999px;
      padding:4px 9px;
      background:#e2e8f0;
      color:#334155;
      font-size:0.74rem;
      font-weight:800;
      white-space:nowrap;
    }

    .td-visual-scope-value{
      font-size:clamp(1.12rem,0.98rem + 0.55vw,1.42rem);
      font-weight:800;
      line-height:1.2;
      color:#0f172a;
      margin-top:10px;
      white-space:normal;
      word-break:normal;
      overflow-wrap:normal;
      hyphens:none;
      display:-webkit-box;
      -webkit-box-orient:vertical;
      -webkit-line-clamp:2;
      overflow:hidden;
      text-wrap:balance;
    }

    .td-visual-scope-sub{
      margin-top:6px;
      color:#475569;
      font-size:0.88rem;
      line-height:1.35;
    }

    .td-visual-scope-helper{
      color:#64748b;
      font-size:0.83rem;
      line-height:1.4;
    }

    .td-visual-scope-helper{
      margin-top:6px;
    }

    .td-visual-scope-bar{
      height:8px;
      border-radius:999px;
      background:#e2e8f0;
      overflow:hidden;
      margin-top:8px;
    }

    .td-visual-scope-bar span{
      display:block;
      height:100%;
      border-radius:999px;
      background:#0f172a;
    }

    .td-visual-summary-page{
      border:1px solid #dbe3ee;
      border-radius:24px;
      padding:18px;
      background:#fff;
      box-shadow:0 18px 36px rgba(15,23,42,0.05);
    }

    .td-visual-toolbar{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:12px;
    }

    .td-visual-summary-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      margin-bottom:16px;
    }

    .td-visual-summary-head--compact{
      align-items:center;
    }

    .td-visual-summary-copy{
      display:flex;
      flex-direction:column;
      gap:6px;
      min-width:0;
    }

    .td-attainment-guide-meta{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
    }

    .td-attainment-guide-note{
      margin:0;
      color:#475569;
      font-size:0.94rem;
      line-height:1.6;
    }

    .td-heading-with-info{
      display:inline-flex;
      align-items:center;
      gap:8px;
      min-width:0;
    }

    .td-heading-with-info--summary{
      max-width:100%;
    }

    .td-heading-with-info--summary h4{
      margin:0;
    }

    .td-visual-summary-kicker{
      display:inline-flex;
      align-items:center;
      gap:8px;
      font-size:0.8rem;
      font-weight:800;
      letter-spacing:0.08em;
      text-transform:uppercase;
      color:#64748b;
      margin-bottom:6px;
    }

    .td-visual-summary-head h4{
      margin:0;
      font-size:clamp(1.55rem, 1.3rem + 0.8vw, 1.85rem);
      line-height:1.05;
      font-weight:800;
      color:#0f172a;
    }

    .td-visual-summary-head p{
      margin:0;
      color:#64748b;
      font-size:0.95rem;
    }

    .td-visual-focus-pill{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      margin-top:10px;
      padding:6px 12px;
      border-radius:999px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      color:#1d4ed8;
      font-size:0.82rem;
      font-weight:800;
    }

    .td-pupil-signal-legend{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin:0 0 12px;
    }

    .td-status-filter-row{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      margin:0 0 8px;
    }

    .td-status-filter{
      appearance:none;
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 12px;
      border-radius:999px;
      border:1px solid #dbe3ee;
      background:#fff;
      color:#475569;
      cursor:pointer;
      font-size:0.86rem;
      font-weight:700;
      transition:border-color .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease;
    }

    .td-status-filter strong{
      font-size:0.82rem;
    }

    .td-status-filter-dot{
      width:10px;
      height:10px;
      border-radius:999px;
      background:#94a3b8;
      flex:0 0 auto;
    }

    .td-status-filter.is-active{
      box-shadow:0 10px 18px rgba(15,23,42,0.08);
    }

    .td-status-filter--red{
      border-color:#fdba74;
      background:#fff7ed;
      color:#9a3412;
    }

    .td-status-filter--red .td-status-filter-dot{
      background:#dc2626;
    }

    .td-status-filter--amber{
      border-color:#fde68a;
      background:#fffbeb;
      color:#92400e;
    }

    .td-status-filter--amber .td-status-filter-dot{
      background:#f59e0b;
    }

    .td-status-filter--green{
      border-color:#86efac;
      background:#f0fdf4;
      color:#166534;
    }

    .td-status-filter--green .td-status-filter-dot{
      background:#16a34a;
    }

    .td-pupil-signal{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid #e2e8f0;
      background:#fff;
      color:#475569;
      font-size:0.78rem;
      font-weight:800;
      white-space:nowrap;
    }

    .td-pupil-signal-dot{
      width:10px;
      height:10px;
      border-radius:999px;
      background:#94a3b8;
      flex:0 0 auto;
      box-shadow:0 0 0 2px rgba(255,255,255,0.85);
    }

    .td-pupil-signal--red{
      background:#fff7ed;
      border-color:#fdba74;
      color:#9a3412;
    }

    .td-pupil-signal--red .td-pupil-signal-dot{
      background:#dc2626;
    }

    .td-pupil-signal--amber{
      background:#fffbeb;
      border-color:#fde68a;
      color:#92400e;
    }

    .td-pupil-signal--amber .td-pupil-signal-dot{
      background:#f59e0b;
    }

    .td-pupil-signal--green{
      background:#f0fdf4;
      border-color:#86efac;
      color:#166534;
    }

    .td-pupil-signal--green .td-pupil-signal-dot{
      background:#16a34a;
    }

    .td-visual-summary-actions{
      display:flex;
      flex-wrap:wrap;
      justify-content:flex-end;
      gap:8px;
    }

    .td-analytics-summary-grid--visual{
      grid-template-columns:repeat(6,minmax(0,1fr));
      margin-bottom:16px;
    }

    .td-analytics-summary-hero-row{
      margin-bottom:16px;
    }

    .td-analytics-summary-grid--visual .td-analytics-summary-card{
      padding:12px;
    }

    .td-analytics-summary-card--hero{
      width:100%;
      padding:14px 16px;
    }

    .td-analytics-summary-card--hero .td-analytics-summary-label{
      margin-bottom:12px;
    }

    .td-analytics-summary-card--hero .td-analytics-summary-label--rich{
      gap:8px;
      flex-wrap:nowrap;
      justify-content:space-between;
    }

    .td-analytics-summary-grid--visual .td-analytics-summary-label{
      margin-bottom:10px;
      font-size:0.78rem;
    }

    .td-analytics-summary-grid--visual .td-analytics-summary-label--rich{
      gap:6px;
      flex-wrap:nowrap;
      justify-content:space-between;
    }

    .td-analytics-summary-grid--visual .td-analytics-summary-label--rich span{
      overflow:visible;
      text-overflow:clip;
      white-space:nowrap;
    }

    .td-analytics-summary-grid--visual .td-analytics-summary-label--rich .uiInfoTip{
      margin-left:auto;
      flex:0 0 auto;
    }

    .td-analytics-summary-grid--visual .td-analytics-summary-label--rich .uiInfoTipTrigger{
      width:22px;
      height:22px;
    }

    .td-analytics-summary-grid--visual .td-analytics-summary-value{
      font-size:clamp(1.05rem,0.95rem + 0.45vw,1.28rem);
      line-height:1.15;
    }

    .td-analytics-summary-grid--visual .td-analytics-summary-card--primary .td-analytics-summary-value{
      font-size:clamp(1.3rem,1.05rem + 0.8vw,1.75rem);
    }

    .td-analytics-summary-grid--visual .td-analytics-summary-sub{
      display:none;
    }

    .td-analytics-summary-grid--visual .td-analytics-summary-card--primary .td-analytics-summary-sub{
      display:block;
    }

    .td-test-summary-row--visual{
      margin-bottom:16px;
    }

    .td-visual-student-panels{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:14px;
      margin-bottom:12px;
    }

    .td-visual-student-list{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-visual-student-row{
      appearance:none;
      width:100%;
      display:grid;
      grid-template-columns:minmax(0,1.5fr) auto auto;
      gap:10px 14px;
      align-items:center;
      text-align:left;
      border:1px solid #dbe3ee;
      border-radius:14px;
      padding:12px 14px;
      background:#fff;
      cursor:pointer;
      transition:border-color .18s ease, box-shadow .18s ease, background .18s ease;
    }

    .td-visual-student-row:hover{
      border-color:#94a3b8;
      box-shadow:0 12px 24px rgba(15,23,42,0.06);
    }

    .td-visual-student-row.is-alert{
      background:#fff7ed;
      border-color:#fdba74;
    }

    .td-visual-student-row--developing{
      background:#fffdf5;
      border-color:#fde68a;
    }

    .td-visual-student-row--secure{
      background:#f7fcf8;
      border-color:#bbf7d0;
    }

    .td-visual-student-main{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }

    .td-visual-student-main-top,
    .td-visual-pupil-main-top,
    .td-pupil-main-top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      min-width:0;
    }

    .td-visual-student-main-top strong,
    .td-visual-pupil-main-top strong,
    .td-pupil-main-top strong{
      min-width:0;
    }

    .td-visual-student-main span,
    .td-visual-student-helper{
      color:#64748b;
      font-size:0.88rem;
      line-height:1.4;
    }

    .td-visual-student-status{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:5px 10px;
      border-radius:999px;
      background:#e2e8f0;
      color:#334155;
      font-size:0.78rem;
      font-weight:800;
      white-space:nowrap;
    }

    .td-visual-student-metric{
      color:#0f172a;
      font-size:0.9rem;
      font-weight:700;
      white-space:normal;
      line-height:1.3;
      word-break:normal;
      overflow-wrap:normal;
      hyphens:none;
      justify-self:end;
      text-align:right;
    }

    .td-visual-student-helper{
      grid-column:1 / -1;
    }

    .td-visual-progress-list{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-visual-progress-row{
      border:1px solid #dbe3ee;
      border-radius:14px;
      background:#fff;
      padding:12px;
    }

    .td-visual-progress-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-bottom:8px;
    }

    .td-visual-progress-head span{
      color:#334155;
      font-weight:700;
    }

    .td-visual-progress-bar{
      height:10px;
      border-radius:999px;
      background:#e2e8f0;
      overflow:hidden;
      margin-bottom:8px;
    }

    .td-visual-progress-bar span{
      display:block;
      height:100%;
      border-radius:999px;
      background:linear-gradient(90deg,#0f172a 0%,#334155 100%);
    }

    .td-visual-progress-note{
      color:#64748b;
      font-size:0.88rem;
      line-height:1.4;
    }

    .td-visual-spotlight-list{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-visual-spotlight-item{
      border:1px solid #dbe3ee;
      border-radius:14px;
      padding:12px;
      background:#fff;
      color:#334155;
      font-size:0.92rem;
      line-height:1.45;
    }

    .td-visual-pupil-list{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-visual-pupil-table-shell{
      gap:0;
    }

    .td-visual-pupil-table-wrap{
      max-height:520px;
      overflow-y:auto;
      overflow-x:hidden;
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#fff;
      box-shadow:0 10px 24px rgba(15,23,42,0.04);
    }

    .td-visual-pupil-table{
      display:flex;
      flex-direction:column;
      gap:8px;
      min-width:760px;
      padding:8px;
    }

    .td-visual-pupil-table-head{
      display:grid;
      grid-template-columns:minmax(180px,1.4fr) repeat(3,minmax(86px,0.7fr)) minmax(140px,1fr);
      gap:10px;
      align-items:center;
      position:sticky;
      top:0;
      padding:10px 12px;
      margin:-8px -8px 0;
      border-bottom:1px solid #e2e8f0;
      background:#f8fafc;
      color:#64748b;
      font-size:0.76rem;
      font-weight:800;
      letter-spacing:0.06em;
      text-transform:uppercase;
      z-index:3;
    }

    .td-visual-pupil-table-head span{
      display:flex;
      align-items:center;
    }

    .td-visual-pupil-table-head span:first-child{
      position:sticky;
      left:0;
      z-index:4;
      background:#f8fafc;
      padding-right:12px;
    }

    .td-visual-pupil-row{
      appearance:none;
      width:100%;
      display:grid;
      grid-template-columns:minmax(180px,1.4fr) repeat(3,minmax(86px,0.7fr)) minmax(140px,1fr);
      gap:10px;
      align-items:center;
      text-align:left;
      border:1px solid #dbe3ee;
      border-radius:14px;
      padding:12px;
      background:#fff;
      cursor:pointer;
      transition:border-color .18s ease, box-shadow .18s ease, background .18s ease;
    }

    .td-visual-pupil-row:hover{
      border-color:#94a3b8;
      box-shadow:0 12px 24px rgba(15,23,42,0.06);
    }

    .td-visual-pupil-row.is-alert{
      background:#fff7ed;
      border-color:#fdba74;
    }

    .td-visual-pupil-row--developing{
      background:#fffdf5;
      border-color:#fde68a;
    }

    .td-visual-pupil-row--secure{
      background:#f7fcf8;
      border-color:#bbf7d0;
    }

    .td-visual-pupil-cell{
      color:#334155;
      font-size:0.9rem;
    }

    .td-visual-pupil-cell--main{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
      position:sticky;
      left:0;
      z-index:2;
      background:inherit;
      padding-right:12px;
    }

    .td-visual-pupil-cell--main span{
      color:#64748b;
      font-size:0.84rem;
      line-height:1.35;
    }

    .td-visual-pupil-cell--focus{
      color:#64748b;
    }

    .td-visual-mini-card{
      appearance:none;
      text-align:left;
      border:1px solid #dbe3ee;
      border-radius:14px;
      padding:12px;
      background:#fff;
      cursor:pointer;
      transition:border-color .18s ease, box-shadow .18s ease, background .18s ease;
    }

    .td-visual-mini-card:hover,
    .td-visual-class-row:hover{
      border-color:#94a3b8;
      box-shadow:0 12px 24px rgba(15,23,42,0.06);
    }

    .td-visual-mini-card.is-alert{
      background:#fff7ed;
      border-color:#fdba74;
    }

    .td-visual-mini-top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:6px;
      color:#0f172a;
    }

    .td-visual-mini-sub{
      color:#64748b;
      font-size:0.88rem;
      line-height:1.4;
    }

    .td-visual-class-list{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-visual-class-row{
      appearance:none;
      width:100%;
      display:grid;
      grid-template-columns:minmax(0,1.4fr) auto auto;
      gap:12px;
      align-items:center;
      text-align:left;
      border:1px solid #dbe3ee;
      border-radius:14px;
      padding:12px;
      background:#fff;
      cursor:pointer;
      transition:border-color .18s ease, box-shadow .18s ease, background .18s ease;
    }

    .td-visual-class-main{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }

    .td-visual-class-main span,
    .td-visual-class-metric{
      color:#64748b;
      font-size:0.88rem;
    }

    .td-visual-class-metric{
      white-space:normal;
      font-weight:700;
      line-height:1.35;
    }

    .td-visual-class-metric--stack{
      display:flex;
      flex-direction:column;
      align-items:flex-end;
      gap:6px;
    }

    .td-visual-class-metric--stack strong{
      color:#0f172a;
      font-size:0.96rem;
      line-height:1.25;
      text-align:right;
    }

    .td-visual-class-security{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:4px 10px;
      border-radius:999px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      color:#1d4ed8;
      font-size:0.76rem;
      font-weight:800;
      line-height:1.2;
      white-space:normal;
      word-break:normal;
      overflow-wrap:break-word;
      hyphens:none;
    }

    .td-analytics-rank-table{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .td-analytics-rank-controls{
      display:flex;
      flex-wrap:wrap;
      gap:12px;
      align-items:flex-end;
      margin-bottom:14px;
    }

    .td-analytics-rank-head{
      display:grid;
      gap:10px;
      align-items:center;
      padding:0 12px;
      color:#64748b;
      font-size:0.76rem;
      font-weight:800;
      letter-spacing:0.06em;
      text-transform:uppercase;
    }

    .td-analytics-rank-head--class,
    .td-analytics-rank-row--class{
      grid-template-columns:72px minmax(220px,1.55fr) minmax(110px,0.8fr) minmax(96px,0.7fr);
    }

    .td-analytics-rank-head--pupil,
    .td-analytics-rank-row--pupil{
      grid-template-columns:72px minmax(250px,1.7fr) minmax(110px,0.8fr) minmax(92px,0.65fr);
    }

    .td-analytics-rank-head span{
      display:flex;
      align-items:center;
    }

    .td-analytics-rank-row{
      appearance:none;
      width:100%;
      display:grid;
      gap:10px;
      align-items:center;
      text-align:left;
      border:1px solid #dbe3ee;
      border-radius:14px;
      padding:12px;
      background:#fff;
      cursor:pointer;
      transition:border-color .18s ease, box-shadow .18s ease, background .18s ease;
    }

    .td-analytics-rank-row:hover{
      border-color:#94a3b8;
      box-shadow:0 12px 24px rgba(15,23,42,0.06);
    }

    .td-analytics-rank-row.is-muted{
      background:#f8fafc;
    }

    .td-analytics-rank-row--needs_review{
      background:#fff7ed;
      border-color:#fdba74;
    }

    .td-analytics-rank-row--developing{
      background:#fffdf5;
      border-color:#fde68a;
    }

    .td-analytics-rank-row--secure{
      background:#f7fcf8;
      border-color:#bbf7d0;
    }

    .td-analytics-rank-position{
      color:#0f172a;
      font-size:0.96rem;
      font-weight:800;
      white-space:nowrap;
    }

    .td-analytics-rank-main{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
      color:#334155;
      font-size:0.9rem;
    }

    .td-analytics-rank-main span{
      color:#64748b;
      font-size:0.84rem;
      line-height:1.35;
    }

    .td-analytics-rank-main-top{
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:8px;
      color:#0f172a;
    }

    .td-analytics-rank-metric{
      color:#334155;
      font-size:0.9rem;
      font-weight:700;
      white-space:nowrap;
    }

    .td-analytics-rank-helper{
      color:#64748b;
      font-size:0.88rem;
      line-height:1.35;
    }

    .td-context-rank-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:12px;
    }

    .td-context-rank-card{
      position:relative;
      overflow:hidden;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:10px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      padding:16px;
      background:#fff;
      box-shadow:0 10px 24px rgba(15,23,42,0.06);
      text-align:center;
    }

    .td-context-rank-card::before{
      content:"";
      position:absolute;
      inset:0 0 auto 0;
      height:4px;
      background:#cbd5e1;
    }

    .td-context-rank-card--green{
      border-color:#86efac;
      background:linear-gradient(180deg,#f0fdf4 0%, #ffffff 72%);
    }

    .td-context-rank-card--green::before{
      background:#22c55e;
    }

    .td-context-rank-card--amber{
      border-color:#fcd34d;
      background:linear-gradient(180deg,#fffbeb 0%, #ffffff 72%);
    }

    .td-context-rank-card--amber::before{
      background:#f59e0b;
    }

    .td-context-rank-card--red{
      border-color:#fca5a5;
      background:linear-gradient(180deg,#fef2f2 0%, #ffffff 72%);
    }

    .td-context-rank-card--red::before{
      background:#ef4444;
    }

    .td-context-rank-card--slate{
      border-color:#cbd5e1;
      background:linear-gradient(180deg,#f8fafc 0%, #ffffff 72%);
    }

    .td-context-rank-card--slate::before{
      background:#94a3b8;
    }

    .td-context-rank-card-head{
      display:flex;
      align-items:center;
      justify-content:center;
      width:100%;
      gap:8px;
    }

    .td-context-rank-card-label{
      color:#64748b;
      font-size:0.78rem;
      font-weight:800;
      letter-spacing:0.06em;
      text-transform:uppercase;
    }

    .td-context-rank-card-head .uiInfoTipTrigger{
      width:22px;
      height:22px;
    }

    .td-context-rank-card-head .uiInfoTipTrigger .uiIcon{
      width:12px;
      height:12px;
    }

    .td-context-rank-card strong{
      color:#0f172a;
      font-size:1.5rem;
      line-height:1.1;
      letter-spacing:-0.03em;
      width:100%;
      text-align:center;
    }

    .td-context-rank-chip{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      align-self:center;
      min-width:148px;
      padding:7px 12px;
      border-radius:999px;
      border:1px solid transparent;
      font-size:0.8rem;
      font-weight:800;
      line-height:1;
      text-align:center;
      white-space:nowrap;
    }

    .td-context-rank-chip-content{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:8px;
    }

    .td-context-rank-chip-icon{
      display:flex;
      align-items:center;
      justify-content:center;
      width:20px;
      height:20px;
      border-radius:999px;
      background:rgba(255,255,255,0.78);
      font-size:0.92rem;
      line-height:1;
    }

    .td-context-rank-chip-label{
      display:inline-block;
    }

    .td-context-rank-chip--green{
      background:#dcfce7;
      border-color:#86efac;
      color:#166534;
    }

    .td-context-rank-chip--amber{
      background:#fef3c7;
      border-color:#fcd34d;
      color:#92400e;
    }

    .td-context-rank-chip--red{
      background:#fee2e2;
      border-color:#fca5a5;
      color:#991b1b;
    }

    .td-context-rank-chip--slate{
      background:#e2e8f0;
      border-color:#cbd5e1;
      color:#334155;
    }

    .td-visual-token-row{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
    }

    .td-visual-token{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:8px 12px;
      border-radius:999px;
      background:#eff6ff;
      color:#1e3a8a;
      font-size:0.88rem;
      font-weight:700;
      border:1px solid #bfdbfe;
    }

    .td-list{
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .td-test-summary-row{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      margin-bottom:14px;
    }

    .td-summary-chip{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:110px;
      padding:12px 14px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      background:#f8fafc;
      color:#475569;
    }

    .td-summary-chip strong{
      color:#0f172a;
      font-size:1.15rem;
    }

    .td-test-groups{
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .td-test-group{
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#f8fafc;
      padding:14px;
    }

    .td-test-group-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }

    .td-test-group-copy h4{
      margin:0 0 4px;
      font-size:1rem;
      font-weight:800;
      color:#0f172a;
    }

    .td-test-group-copy p{
      margin:0;
      color:#64748b;
      font-size:0.92rem;
    }

    .td-test-group-meta{
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }

    .td-empty{
      border:1px dashed #dbe3ee;
      border-radius:16px;
      padding:18px;
      background:#fff;
      color:#475569;
    }

    .td-empty--compact{
      padding:14px;
      border-radius:14px;
    }

    .td-empty strong{
      display:block;
      color:#0f172a;
      margin-bottom:4px;
    }

    .td-empty p{
      margin:0;
    }

    .td-test-card,
    .td-class-card,
    .td-assignment-card{
      background:#fff;
      border:1px solid #e2e8f0;
      border-radius:18px;
      box-shadow:0 10px 24px rgba(15,23,42,0.03);
      overflow:hidden;
      transition:border-color .18s ease, box-shadow .18s ease, background .18s ease;
    }

    .td-class-card.is-active,
    .td-assignment-card.is-active,
    .td-test-card.is-active{
      border-color:#94a3b8;
      background:#fbfdff;
      box-shadow:0 14px 30px rgba(15,23,42,0.06);
    }

    .td-test-card.is-flash,
    .td-class-card.is-flash{
      animation:tdFlash 2s ease;
    }

    @keyframes tdFlash{
      0%{ box-shadow:0 0 0 0 rgba(15,23,42,0.18); background:#f8fafc; }
      100%{ box-shadow:0 10px 24px rgba(15,23,42,0.03); background:#fff; }
    }

    .td-card-row{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      padding:16px;
    }

    .td-card-main{
      min-width:0;
      flex:1 1 auto;
    }

    .td-card-title{
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:8px;
      font-size:1rem;
      line-height:1.25;
      font-weight:700;
      color:#0f172a;
      margin:0 0 4px;
      word-break:break-word;
    }

    .td-card-subtitle{
      color:#64748b;
      font-size:0.92rem;
    }

    .td-card-actions{
      display:flex;
      flex-wrap:wrap;
      justify-content:flex-end;
      gap:8px;
      flex:0 0 auto;
    }

    .td-inline-panel{
      margin:0 16px 16px;
      border:1px solid #dbe3ee;
      background:#f8fafc;
      border-radius:16px;
      padding:14px;
    }

    .td-inline-panel--attached{
      position:relative;
      animation:tdDrop .16s ease-out;
    }

    @keyframes tdDrop{
      from{
        opacity:0;
        transform:translateY(-6px);
      }
      to{
        opacity:1;
        transform:translateY(0);
      }
    }

    .td-inline-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:12px;
    }

    .td-inline-actions{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:8px;
      flex-wrap:wrap;
    }

    .td-inline-head h4{
      margin:0;
      font-size:1rem;
      font-weight:800;
      color:#334155;
    }

    .td-assignment-meta{
      display:flex;
      flex-wrap:wrap;
      gap:8px 14px;
      color:#64748b;
      font-size:0.92rem;
    }

    .td-assignment-meta--stack{
      margin-top:10px;
    }

    .td-assignment-meta--compact{
      gap:8px;
    }

    .td-assignment-chip{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 10px;
      border:1px solid #dbe3ee;
      border-radius:999px;
      background:#fff;
      color:#475569;
      font-size:0.88rem;
      font-weight:700;
    }

    .td-assignment-chip .uiIconLabel{
      gap:6px;
    }

    .td-assignment-chip .uiIcon{
      width:15px;
      height:15px;
    }

    .td-assignment-chip--status{
      background:#eff6ff;
      border-color:#bfdbfe;
      color:#1d4ed8;
    }

    .td-filter-chip-row{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-bottom:14px;
    }

    .td-filter-chip{
      appearance:none;
      border:1px solid #dbe3ee;
      border-radius:999px;
      background:#fff;
      color:#475569;
      padding:8px 12px;
      font:inherit;
      font-size:0.88rem;
      font-weight:700;
      cursor:pointer;
      transition:border-color .18s ease, background .18s ease, color .18s ease;
    }

    .td-filter-chip:hover{
      border-color:#94a3b8;
      background:#f8fafc;
    }

    .td-filter-chip.is-active{
      border-color:#bfdbfe;
      background:#eff6ff;
      color:#1d4ed8;
    }

    .td-results-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:14px;
    }

    .td-results-block{
      display:flex;
      flex-direction:column;
      gap:10px;
      min-width:0;
    }

    .td-results-grid--compact{
      grid-template-columns:repeat(2,minmax(0,1fr));
    }

    .td-results-block--soft{
      padding:14px;
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#fff;
      box-shadow:0 12px 28px rgba(15,23,42,0.05);
    }

    .td-results-block--wide{
      grid-column:1 / -1;
    }

    .td-results-block--soft .td-results-block-head{
      padding:0;
      border:0;
      border-radius:0;
      background:transparent;
    }

    .td-results-block-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:10px 12px;
      border:1px solid #dbe3ee;
      border-radius:14px;
      background:#fff;
    }

    .td-results-block-head h5{
      margin:0;
      font-size:0.98rem;
      font-weight:800;
      color:#0f172a;
    }

    .td-results-block-note{
      margin:0 0 2px;
      color:#64748b;
      font-size:0.9rem;
      line-height:1.45;
    }

    .td-results-block-note--tip{
      display:flex;
      align-items:center;
      margin:0 0 6px;
    }

    .td-results-block-head--visual{
      padding:12px 14px;
      border-color:#cbd5e1;
      background:linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%);
      box-shadow:0 10px 24px rgba(148,163,184,0.08);
    }

    .td-results-block-head--visual h5{
      font-size:1.04rem;
      font-weight:900;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }

    .td-results-block-head--visual .td-pill{
      background:#0f172a;
      color:#fff;
    }

    .td-pill{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:28px;
      padding:4px 8px;
      border-radius:999px;
      background:#e2e8f0;
      color:#334155;
      font-size:0.84rem;
      font-weight:700;
    }

    .td-pill--muted{
      background:#f1f5f9;
      color:#64748b;
    }

    .td-icon-chip-btn{
      appearance:none;
      border:none;
      background:transparent;
      color:#475569;
      padding:0;
      width:18px;
      height:18px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      font-size:0;
      line-height:1;
    }

    .td-icon-chip-btn::before{
      content:"\\00d7";
      font-size:0.95rem;
      line-height:1;
    }

    .td-results-footer-note{
      margin-top:14px;
      color:#64748b;
      font-size:0.92rem;
    }

    .td-results-grid--analytics{
      margin-top:16px;
      align-items:start;
    }

    .td-results-grid--stacked{
      grid-template-columns:1.4fr 1fr;
    }

    .td-inline-panel--calm{
      background:#f8fafc;
    }

    .td-inline-panel,
    .td-results-block,
    .td-class-results-selected{
      transition:padding-bottom .18s ease, gap .18s ease;
    }

    .td-inline-panel.has-open-target-popover,
    .td-results-block.has-open-target-popover,
    .td-class-results-selected.has-open-target-popover{
      padding-bottom:18px;
    }

    .td-progress-hero{
      display:flex;
      flex-direction:column;
      gap:12px;
      padding:16px;
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#fff;
      box-shadow:0 12px 28px rgba(15,23,42,0.05);
    }

    .td-progress-hero-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
    }

    .td-progress-hero-head h5{
      margin:0 0 4px;
      font-size:1rem;
      font-weight:800;
      color:#0f172a;
    }

    .td-progress-hero-head p{
      margin:0;
      color:#64748b;
      font-size:0.9rem;
    }

    .td-progress-hero-bar{
      display:flex;
      height:14px;
      border-radius:999px;
      background:#e2e8f0;
      overflow:hidden;
    }

    .td-progress-hero-bar span{
      display:block;
      height:100%;
    }

    .td-progress-hero-bar .is-done{
      background:#0f766e;
    }

    .td-progress-hero-bar .is-live{
      background:#f59e0b;
    }

    .td-progress-hero-bar .is-wait{
      background:#cbd5e1;
    }

    .td-progress-hero-legend{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
    }

    .td-progress-legend-pill{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:6px 10px;
      border-radius:999px;
      font-size:0.82rem;
      font-weight:800;
      background:#f8fafc;
      color:#334155;
      border:1px solid #e2e8f0;
    }

    .td-progress-legend-pill.is-done{
      color:#115e59;
      background:#ecfdf5;
      border-color:#99f6e4;
    }

    .td-progress-legend-pill.is-live{
      color:#92400e;
      background:#fffbeb;
      border-color:#fde68a;
    }

    .td-progress-legend-pill.is-wait{
      color:#475569;
    }

    .td-compact-summary-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:12px;
      margin-top:16px;
    }

    .td-focus-strip{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-focus-group{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .td-focus-group > span{
      color:#64748b;
      font-size:0.78rem;
      font-weight:800;
      letter-spacing:0.06em;
      text-transform:uppercase;
    }

    .td-visual-token--warm{
      background:#fff7ed;
      border-color:#fdba74;
      color:#9a3412;
    }

    .td-pupil-compact-list{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-pupil-compact-row{
      display:flex;
      flex-direction:column;
      gap:8px;
      border:1px solid #e2e8f0;
      border-radius:14px;
      padding:10px 12px;
      background:#fff;
    }

    .td-pupil-compact-row.is-muted{
      background:#f8fafc;
    }

    .td-pupil-compact-top{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:10px;
    }

    .td-pupil-compact-copy{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }

    .td-pupil-compact-copy span{
      color:#64748b;
      font-size:0.88rem;
      line-height:1.4;
    }

    .td-pupil-compact-side{
      display:flex;
      flex-direction:column;
      align-items:flex-end;
      gap:4px;
      flex:0 0 auto;
    }

    .td-pupil-compact-state{
      color:#475569;
      font-size:0.8rem;
      font-weight:800;
      white-space:nowrap;
    }

    .td-pupil-compact-side strong{
      color:#0f172a;
      font-size:0.92rem;
      white-space:nowrap;
    }

    .td-pupil-compact-meta{
      display:flex;
      flex-wrap:wrap;
      gap:6px 12px;
      color:#64748b;
      font-size:0.84rem;
      line-height:1.4;
    }

    .td-pupil-compact-bar-row{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      gap:10px;
      align-items:center;
    }

    .td-pupil-compact-bar{
      height:10px;
      border-radius:999px;
      background:#e2e8f0;
      overflow:hidden;
    }

    .td-pupil-compact-bar span{
      display:block;
      height:100%;
      border-radius:999px;
      background:#0f172a;
    }

    .td-compare-mini-list{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-compare-mini-row{
      display:grid;
      grid-template-columns:minmax(140px,1fr) minmax(90px,1fr) auto;
      gap:10px;
      align-items:center;
      border:1px solid #e2e8f0;
      border-radius:14px;
      padding:12px;
      background:#fff;
    }

    .td-compare-mini-row.is-current{
      border-color:#93c5fd;
      background:#eff6ff;
    }

    .td-compare-mini-copy{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }

    .td-compare-mini-copy span{
      color:#64748b;
      font-size:0.88rem;
    }

    .td-compare-mini-bar{
      height:10px;
      border-radius:999px;
      background:#dbeafe;
      overflow:hidden;
    }

    .td-compare-mini-bar span{
      display:block;
      height:100%;
      border-radius:999px;
      background:#2563eb;
    }

    .td-class-results-list{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-class-results-row{
      display:flex;
      flex-direction:column;
      gap:12px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      background:#fff;
      padding:14px;
      box-shadow:0 12px 28px rgba(15,23,42,0.04);
    }

    .td-class-results-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
    }

    .td-class-results-copy{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }

    .td-class-results-copy strong{
      color:#0f172a;
      font-size:1rem;
      line-height:1.3;
    }

    .td-class-results-copy span{
      color:#64748b;
      font-size:0.88rem;
    }

    .td-class-results-actions{
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }

    .td-class-results-progress{
      display:flex;
      height:10px;
      border-radius:999px;
      background:#e2e8f0;
      overflow:hidden;
    }

    .td-class-results-progress span{
      display:block;
      height:100%;
    }

    .td-class-results-progress .is-done{
      background:#0f766e;
    }

    .td-class-results-progress .is-live{
      background:#f59e0b;
    }

    .td-class-results-progress .is-wait{
      background:#cbd5e1;
    }

    .td-class-results-stats{
      display:flex;
      flex-wrap:wrap;
      gap:14px;
      color:#64748b;
      font-size:0.88rem;
    }

    .td-class-results-stat .uiIconLabel{
      gap:6px;
    }

    .td-class-results-stat .uiIcon{
      width:15px;
      height:15px;
    }

    .td-class-results-loading{
      color:#64748b;
      font-size:0.9rem;
      line-height:1.45;
      padding:2px 0;
    }

    .td-results-block--compare{
      margin-top:16px;
    }

    .td-compare-toolbar{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      flex-wrap:wrap;
      margin:12px 0 14px;
    }

    .td-compare-toolbar .td-results-footer-note{
      margin:0;
      flex:1 1 340px;
    }

    .td-compare-config-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:12px;
      margin-bottom:14px;
    }

    .td-compare-config-card{
      display:flex;
      flex-direction:column;
      gap:12px;
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#fff;
      padding:14px;
      box-shadow:0 10px 24px rgba(15,23,42,0.04);
    }

    .td-compare-config-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:10px;
    }

    .td-compare-config-kicker{
      color:#64748b;
      font-size:0.76rem;
      font-weight:800;
      letter-spacing:0.08em;
      text-transform:uppercase;
      margin-bottom:4px;
    }

    .td-compare-picker-note{
      margin:0;
      color:#64748b;
      font-size:0.88rem;
      line-height:1.45;
    }

    .td-compare-class-grid{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
    }

    .td-compare-class-option{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 10px;
      border:1px solid #dbe3ee;
      border-radius:12px;
      background:#f8fafc;
      color:#334155;
      font-size:0.88rem;
      cursor:pointer;
      transition:border-color .18s ease, background .18s ease, color .18s ease;
    }

    .td-compare-class-option.is-selected{
      border-color:#93c5fd;
      background:#eff6ff;
      color:#1d4ed8;
    }

    .td-compare-class-option input{
      margin:0;
      accent-color:#0f172a;
    }

    .td-compare-panel-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
      gap:14px;
      margin-top:14px;
    }

    .td-compare-panel{
      display:flex;
      flex-direction:column;
      gap:14px;
      border:1px solid #dbe3ee;
      border-radius:20px;
      background:#fff;
      padding:16px;
      box-shadow:0 14px 30px rgba(15,23,42,0.05);
    }

    .td-compare-panel--overview{
      border-color:#cbd5e1;
      background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);
    }

    .td-compare-panel--year_group{
      border-color:#bfdbfe;
      background:linear-gradient(180deg,#ffffff 0%,#eff6ff 100%);
    }

    .td-compare-panel--class_set{
      border-color:#d9f99d;
      background:linear-gradient(180deg,#ffffff 0%,#f7fee7 100%);
    }

    .td-compare-panel-head h6{
      margin:4px 0 6px;
      font-size:1.08rem;
      font-weight:800;
      color:#0f172a;
    }

    .td-compare-panel-head p{
      margin:0;
      color:#64748b;
      font-size:0.9rem;
      line-height:1.45;
    }

    .td-compare-panel-kicker{
      color:#64748b;
      font-size:0.76rem;
      font-weight:800;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }

    .td-compare-panel-stats{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:10px;
    }

    .td-compare-panel-stat{
      display:flex;
      flex-direction:column;
      gap:6px;
      border:1px solid #dbe3ee;
      border-radius:14px;
      background:#f8fafc;
      padding:10px;
    }

    .td-compare-panel-stat span{
      color:#64748b;
      font-size:0.76rem;
      font-weight:800;
      letter-spacing:0.06em;
      text-transform:uppercase;
    }

    .td-compare-panel-stat strong{
      color:#0f172a;
      font-size:0.98rem;
      line-height:1.25;
    }

    .td-compare-panel-list{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .td-compare-panel-note{
      display:flex;
      flex-direction:column;
      gap:4px;
      border:1px solid #e2e8f0;
      border-radius:14px;
      background:#fff;
      padding:10px 12px;
    }

    .td-compare-panel-note span{
      color:#64748b;
      font-size:0.74rem;
      font-weight:800;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }

    .td-compare-panel-note strong{
      color:#0f172a;
      font-size:0.92rem;
      line-height:1.45;
    }

    .td-compare-panel-token-group{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .td-compare-panel-token-group > span{
      color:#64748b;
      font-size:0.74rem;
      font-weight:800;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }

    .td-group-comparison-card{
      display:flex;
      flex-direction:column;
      gap:16px;
      margin-top:16px;
      padding:18px;
      border:1px solid #dbe3ee;
      border-radius:24px;
      background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);
      box-shadow:0 14px 32px rgba(15,23,42,0.05);
    }

    .td-group-comparison-head{
      display:flex;
      align-items:flex-start;
      gap:14px;
      flex-wrap:wrap;
    }

    .td-group-comparison-title{
      display:flex;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
    }

    .td-group-comparison-copy h5{
      margin:4px 0 0;
      color:#0f172a;
      font-size:1.08rem;
      font-weight:800;
    }

    .td-group-comparison-title .uiInfoTipTrigger{
      width:30px;
      height:30px;
    }

    .td-group-comparison-form{
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .td-group-comparison-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
      gap:12px;
    }

    .td-group-comparison-actions{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:12px;
      flex-wrap:wrap;
    }

    .td-group-comparison-body{
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .td-scroll-shell{
      display:flex;
      flex-direction:column;
      gap:0;
      min-width:0;
    }

    .td-scroll-shell-track{
      overflow-x:auto;
      overflow-y:hidden;
      height:12px;
      position:sticky;
      bottom:10px;
      margin-top:10px;
      border:none;
      border-radius:0;
      background:transparent;
      box-shadow:none;
      scrollbar-width:auto;
      scrollbar-color:#a6a6a6 #f1f1f1;
      z-index:6;
    }

    .td-scroll-shell-track::-webkit-scrollbar{
      height:12px;
      background:#f1f1f1;
    }

    .td-scroll-shell-track::-webkit-scrollbar-track{
      background:#f1f1f1;
      border-radius:0;
    }

    .td-scroll-shell-track::-webkit-scrollbar-thumb{
      background:#a6a6a6;
      border:1px solid #8f8f8f;
      border-radius:8px;
    }

    .td-scroll-shell-track::-webkit-scrollbar-thumb:hover{
      background:#8f8f8f;
      border-color:#767676;
    }

    .td-scroll-shell-track::-webkit-scrollbar-button{
      display:block;
      width:12px;
      background-color:#f1f1f1;
      background-repeat:no-repeat;
      background-position:center;
      background-size:6px 6px;
    }

    .td-scroll-shell-track::-webkit-scrollbar-button:hover{
      background-color:#e5e5e5;
    }

    .td-scroll-shell-track::-webkit-scrollbar-button:single-button:horizontal:decrement{
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6' viewBox='0 0 6 6'%3E%3Cpath fill='%23666666' d='M4.75 0.75 1.5 3l3.25 2.25V0.75Z'/%3E%3C/svg%3E");
    }

    .td-scroll-shell-track::-webkit-scrollbar-button:single-button:horizontal:increment{
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6' viewBox='0 0 6 6'%3E%3Cpath fill='%23666666' d='M1.25 0.75 4.5 3 1.25 5.25V0.75Z'/%3E%3C/svg%3E");
    }

    .td-scroll-shell-track::-webkit-scrollbar-corner{
      background:#f1f1f1;
    }

    .td-scroll-shell-track-size{
      height:1px;
    }

    .td-scroll-shell:not(.is-scrollable) .td-scroll-shell-track{
      display:none;
    }

    .td-group-comparison-table-wrap{
      overflow-y:auto;
      overflow-x:hidden;
      max-height:min(70vh, 520px);
      border:1px solid #dbe3ee;
      border-radius:20px;
      background:#fff;
      box-shadow:0 10px 24px rgba(15,23,42,0.04);
    }

    .td-group-comparison-table{
      width:100%;
      min-width:760px;
      border-collapse:collapse;
      font-variant-numeric:tabular-nums;
    }

    .td-group-comparison-table th,
    .td-group-comparison-table td{
      padding:12px 14px;
      text-align:left;
      vertical-align:top;
    }

    .td-group-comparison-table thead th{
      position:sticky;
      top:0;
      color:#475569;
      font-size:0.76rem;
      font-weight:800;
      letter-spacing:0.06em;
      text-transform:uppercase;
      background:#f8fafc;
      border-bottom:1px solid #dbe3ee;
      white-space:nowrap;
      z-index:2;
    }

    .td-group-comparison-table tbody th{
      position:sticky;
      left:0;
      color:#0f172a;
      font-weight:800;
      white-space:nowrap;
      background:#fff;
      z-index:1;
    }

    .td-group-comparison-table thead th:first-child{
      left:0;
      z-index:3;
    }

    .td-group-comparison-table tbody td,
    .td-group-comparison-table tbody th{
      color:#334155;
      font-size:0.9rem;
      border-top:1px solid #e2e8f0;
    }

    .td-group-comparison-table tbody tr.is-primary th,
    .td-group-comparison-table tbody tr.is-primary td:not(.td-group-comparison-gap-cell){
      background:#f8fbff;
    }

    .td-group-comparison-table tbody tr.is-suppressed{
      background:#f8fafc;
    }

    .td-group-comparison-table tbody tr.is-suppressed td,
    .td-group-comparison-table tbody tr.is-suppressed th{
      color:#64748b;
    }

    .td-group-comparison-column-head{
      display:flex;
      flex-direction:column;
      gap:4px;
    }

    .td-group-comparison-column-head strong{
      color:#0f172a;
      font-size:0.95rem;
      font-weight:800;
      letter-spacing:normal;
      text-transform:none;
    }

    .td-group-comparison-column-head span{
      color:#64748b;
      font-size:0.84rem;
      font-weight:700;
      letter-spacing:normal;
      text-transform:none;
    }

    .td-group-comparison-metric-cell{
      display:flex;
      flex-direction:column;
      gap:2px;
    }

    .td-group-comparison-metric-cell strong{
      color:#0f172a;
      font-size:0.95rem;
      font-weight:800;
      line-height:1.4;
    }

    .td-group-comparison-metric-label{
      display:inline-flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
    }

    .td-group-comparison-metric-label .uiInfoTipTrigger{
      width:22px;
      height:22px;
    }

    .td-group-comparison-metric-label .uiInfoTipTrigger .uiIcon{
      width:12px;
      height:12px;
    }

    .td-group-comparison-gap-cell{
      min-width:180px;
      background:#f8fafc;
    }

    .td-group-comparison-gap-cell.is-positive{
      background:#ecfdf3;
    }

    .td-group-comparison-gap-cell.is-negative{
      background:#fff1f2;
    }

    .td-group-comparison-gap-cell.is-neutral{
      background:#f8fafc;
    }

    .td-group-comparison-gap-cell strong{
      display:block;
      color:#0f172a;
      font-size:0.95rem;
      font-weight:800;
      line-height:1.4;
    }

    .td-group-comparison-gap-cell span{
      display:block;
      margin-top:2px;
      color:#64748b;
      font-size:0.84rem;
      line-height:1.4;
    }

    .td-group-comparison-gap-cell.is-positive strong,
    .td-group-comparison-gap-cell.is-positive span{
      color:#166534;
    }

    .td-group-comparison-gap-cell.is-negative strong,
    .td-group-comparison-gap-cell.is-negative span{
      color:#b42318;
    }

    .td-group-comparison-gap-cell.is-muted strong,
    .td-group-comparison-gap-cell.is-muted span{
      color:#64748b;
    }

    .td-analytics-summary-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
      gap:12px;
    }

    .td-analytics-summary-card{
      border:1px solid #dbe3ee;
      border-radius:16px;
      padding:14px;
      background:#fff;
    }

    .td-analytics-summary-card--primary{
      border-color:#93c5fd;
      background:linear-gradient(180deg,#eff6ff 0%, #ffffff 72%);
      box-shadow:0 12px 28px rgba(37,99,235,0.08);
    }

    .td-analytics-summary-card--primary .td-analytics-summary-value{
      font-size:clamp(1.45rem,1.1rem + 0.95vw,1.95rem);
    }

    .td-analytics-summary-label{
      display:flex;
      align-items:center;
      font-size:0.82rem;
      color:#64748b;
      margin-bottom:6px;
    }

    .td-analytics-summary-label--rich{
      gap:8px;
      flex-wrap:wrap;
    }

    .td-analytics-summary-label--rich .uiInfoTipTrigger{
      width:24px;
      height:24px;
    }

    .td-analytics-summary-label .uiIconOnly{
      background:#eef2f7;
      color:#475569;
    }

    .td-analytics-summary-value{
      font-size:clamp(1.1rem,0.95rem + 0.55vw,1.45rem);
      font-weight:800;
      line-height:1.15;
      color:#0f172a;
      white-space:normal;
      word-break:normal;
      overflow-wrap:break-word;
      hyphens:none;
      text-overflow:clip;
      text-wrap:balance;
    }

    .td-analytics-summary-secondary{
      margin-top:8px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:fit-content;
      padding:5px 10px;
      border-radius:999px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      color:#1d4ed8;
      font-size:0.78rem;
      font-weight:800;
      line-height:1.2;
      max-width:100%;
      white-space:normal;
      word-break:normal;
      overflow-wrap:break-word;
      hyphens:none;
    }

    .td-analytics-summary-sub{
      margin-top:6px;
      color:#64748b;
      font-size:0.84rem;
      line-height:1.45;
      white-space:normal;
      word-break:normal;
      overflow-wrap:break-word;
      hyphens:none;
    }

    .td-attainment-inline-tip-bubble{
      width:min(280px,calc(100vw - 32px));
      min-width:min(220px,calc(100vw - 32px));
    }

    .td-attainment-inline-separator{
      color:#94a3b8;
    }

    .td-attainment-card-body{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .td-attainment-card-body--horizontal{
      display:grid;
      grid-template-columns:minmax(0,1.45fr) minmax(180px,0.9fr) minmax(0,1.15fr);
      align-items:center;
      gap:18px;
    }

    .td-attainment-card-block{
      min-width:0;
    }

    .td-attainment-card-block--level,
    .td-attainment-card-block--performance{
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    .td-attainment-card-block--meta{
      display:flex;
      align-items:center;
      min-width:0;
    }

    .td-attainment-card-body--horizontal .td-attainment-card-block--meta{
      justify-content:flex-start;
      padding-left:18px;
      border-left:1px solid #dbe3ee;
    }

    .td-attainment-card-section-label{
      font-size:0.68rem;
      font-weight:800;
      color:#64748b;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }

    .td-attainment-card-main{
      color:#0f172a;
      line-height:1;
    }

    .td-attainment-card-main .uiInfoTip,
    .td-attainment-card-performance .uiInfoTip{
      max-width:100%;
    }

    .td-attainment-card-main-text{
      display:block;
      max-width:100%;
      font-size:clamp(1rem,0.9rem + 0.9vw,1.85rem);
      font-weight:900;
      line-height:1.02;
      letter-spacing:-0.02em;
      white-space:nowrap;
      word-break:normal;
      overflow-wrap:normal;
      hyphens:none;
      text-overflow:clip;
    }

    .td-attainment-card-body--horizontal .td-attainment-card-main-text{
      font-size:clamp(1.2rem,0.95rem + 1vw,2.05rem);
    }

    .td-attainment-card-performance{
      display:flex;
      align-items:flex-start;
    }

    .td-attainment-card-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:5px 10px;
      border-radius:999px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      color:#1d4ed8;
      font-size:0.78rem;
      font-weight:800;
      line-height:1.2;
      max-width:100%;
      white-space:normal;
      word-break:normal;
      overflow-wrap:break-word;
      hyphens:none;
      text-align:center;
    }

    .td-attainment-card-badge--text{
      display:inline;
      padding:0;
      border:none;
      border-radius:0;
      background:transparent;
      color:#0f172a;
      font-size:clamp(1rem,0.9rem + 0.5vw,1.25rem);
      font-weight:900;
      line-height:1.08;
      max-width:none;
      white-space:nowrap;
      overflow-wrap:normal;
      text-align:left;
    }

    .td-attainment-card-meta-line{
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      color:#64748b;
      font-size:0.78rem;
      font-weight:700;
      line-height:1.35;
    }

    .td-attainment-card-meta{
      display:flex;
      flex-direction:column;
      gap:6px;
      min-width:0;
    }

    .td-attainment-card-body--horizontal .td-attainment-card-meta{
      width:100%;
    }

    .td-attainment-card-body--horizontal .td-attainment-card-meta-line{
      font-size:0.77rem;
      line-height:1.3;
    }

    .td-attainment-method-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:12px;
    }

    .td-attainment-method-card{
      display:flex;
      flex-direction:column;
      gap:10px;
      padding:16px;
      border:1px solid #dbe3ee;
      border-radius:18px;
      background:#fff;
      box-shadow:0 10px 24px rgba(15,23,42,0.04);
    }

    .td-attainment-method-card strong{
      color:#0f172a;
      font-size:0.96rem;
      line-height:1.35;
    }

    .td-attainment-method-card p{
      margin:0;
      color:#475569;
      font-size:0.9rem;
      line-height:1.55;
    }

    .td-attainment-reference-list{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-attainment-reference{
      display:flex;
      flex-direction:column;
      gap:4px;
      padding:10px 12px;
      border-radius:14px;
      background:#f8fafc;
    }

    .td-attainment-reference span{
      color:#0f172a;
      font-size:0.84rem;
      font-weight:800;
      line-height:1.35;
    }

    .td-attainment-reference small{
      color:#64748b;
      font-size:0.8rem;
      line-height:1.45;
    }

    .td-attainment-reference-link{
      display:inline-flex;
      align-items:center;
      width:fit-content;
      margin-top:2px;
      color:#1d4ed8;
      font-size:0.8rem;
      font-weight:700;
      text-decoration:underline;
      text-underline-offset:2px;
    }

    .td-attainment-reference-link:hover,
    .td-attainment-reference-link:focus-visible{
      color:#1e40af;
    }

    .td-pupil-indicator-card{
      display:flex;
      flex-direction:column;
      gap:6px;
      margin-bottom:14px;
      padding:12px 14px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      background:#f8fafc;
    }

    .td-pupil-indicator-head{
      display:flex;
      align-items:center;
      justify-content:flex-start;
      gap:12px;
    }

    .td-pupil-indicator-head strong{
      color:#0f172a;
      font-size:0.96rem;
    }

    .td-pupil-indicator-head span{
      display:none;
    }

    .td-pupil-indicator-value{
      color:#0f172a;
      font-size:clamp(1.2rem,1rem + 0.7vw,1.6rem);
      font-weight:800;
      line-height:1.2;
      white-space:normal;
      word-break:normal;
      overflow-wrap:break-word;
      hyphens:none;
      text-overflow:clip;
      text-wrap:balance;
    }

    .td-pupil-indicator-status{
      display:flex;
      justify-content:flex-start;
    }

    .td-pupil-indicator-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:5px 10px;
      border-radius:999px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      color:#1d4ed8;
      font-size:0.78rem;
      font-weight:800;
      line-height:1.2;
      max-width:100%;
      white-space:normal;
      word-break:normal;
      overflow-wrap:break-word;
      hyphens:none;
      text-align:center;
    }

    .td-pupil-indicator-sub{
      color:#64748b;
      font-size:0.88rem;
      line-height:1.45;
      white-space:normal;
      word-break:normal;
      overflow-wrap:break-word;
      hyphens:none;
    }

    .td-accuracy-section-note{
      margin:0 0 14px;
      color:#64748b;
      font-size:0.92rem;
      line-height:1.5;
    }

    .td-accuracy-band-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:14px;
    }

    .td-accuracy-band-card{
      display:flex;
      flex-direction:column;
      gap:10px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      padding:14px;
      background:#fff;
      min-width:0;
    }

    .td-accuracy-band-card--red{
      background:#fff7ed;
      border-color:#fdba74;
    }

    .td-accuracy-band-card--amber{
      background:#fffbeb;
      border-color:#fde68a;
    }

    .td-accuracy-band-card--green{
      background:#f0fdf4;
      border-color:#86efac;
    }

    .td-accuracy-band-meter{
      height:10px;
      border-radius:999px;
      background:rgba(148,163,184,0.22);
      overflow:hidden;
    }

    .td-accuracy-band-meter span{
      display:block;
      height:100%;
      border-radius:999px;
      background:#0f172a;
    }

    .td-accuracy-band-card--red .td-accuracy-band-meter span{
      background:#dc2626;
    }

    .td-accuracy-band-card--amber .td-accuracy-band-meter span{
      background:#d97706;
    }

    .td-accuracy-band-card--green .td-accuracy-band-meter span{
      background:#16a34a;
    }

    .td-accuracy-band-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      color:#0f172a;
    }

    .td-accuracy-band-head strong{
      font-size:0.98rem;
    }

    .td-accuracy-band-head span{
      font-size:0.95rem;
      font-weight:800;
      white-space:nowrap;
    }

    .td-accuracy-band-sub{
      color:#64748b;
      font-size:0.86rem;
      line-height:1.4;
    }

    .td-accuracy-band-empty{
      margin:0;
      color:#64748b;
      font-size:0.9rem;
    }

    .td-confusion-list{
      display:grid;
      gap:10px;
    }

    .td-confusion-item{
      display:flex;
      flex-direction:column;
      gap:8px;
      padding:12px 14px;
      border:1px solid #dbe3ee;
      border-radius:14px;
      background:#fff;
    }

    .td-confusion-item--red{
      background:#fff7ed;
      border-color:#fdba74;
    }

    .td-confusion-item--amber{
      background:#fffbeb;
      border-color:#fde68a;
    }

    .td-confusion-item--green{
      background:#f0fdf4;
      border-color:#86efac;
    }

    .td-confusion-item-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      color:#0f172a;
    }

    .td-confusion-item-head strong{
      font-size:0.95rem;
    }

    .td-confusion-item-head span{
      color:#475569;
      font-size:0.82rem;
      font-weight:800;
      white-space:nowrap;
    }

    .td-confusion-item p{
      margin:0;
      color:#64748b;
      font-size:0.88rem;
      line-height:1.45;
    }

    .td-confusion-word-row{
      margin-top:2px;
    }

    .td-confusion-item-actions{
      display:flex;
      justify-content:flex-start;
      margin-top:2px;
    }

    .td-trend-pill{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:88px;
      padding:6px 10px;
      border-radius:999px;
      font-size:0.82rem;
      font-weight:800;
      border:1px solid #dbe3ee;
      background:#f8fafc;
      color:#475569;
    }

    .td-trend-pill--green{
      border-color:#86efac;
      background:#f0fdf4;
      color:#166534;
    }

    .td-trend-pill--red{
      border-color:#fdba74;
      background:#fff7ed;
      color:#c2410c;
    }

    .td-trend-pill--neutral{
      border-color:#cbd5e1;
      background:#f8fafc;
      color:#475569;
    }

    .td-trend-panel{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-trend-chart{
      display:flex;
      flex-direction:column;
      gap:12px;
      padding:14px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);
    }

    .td-trend-chart--green{
      border-color:#bbf7d0;
    }

    .td-trend-chart--red{
      border-color:#fed7aa;
    }

    .td-trend-chart-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      flex-wrap:wrap;
      gap:8px 12px;
    }

    .td-trend-chart-head strong{
      color:#334155;
      font-size:0.76rem;
      font-weight:900;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }

    .td-trend-chart-legend{
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
    }

    .td-trend-legend{
      display:inline-flex;
      align-items:center;
      gap:6px;
      color:#64748b;
      font-size:0.76rem;
      font-weight:700;
    }

    .td-trend-legend::before{
      content:"";
      width:10px;
      height:10px;
      border-radius:999px;
      background:#94a3b8;
      flex:0 0 auto;
    }

    .td-trend-legend--earlier::before{
      background:#94a3b8;
    }

    .td-trend-legend--neutral::before{
      background:#2563eb;
    }

    .td-trend-legend--green::before{
      background:#16a34a;
    }

    .td-trend-legend--red::before{
      background:#ea580c;
    }

    .td-trend-chart-shell{
      display:grid;
      grid-template-columns:42px minmax(0,1fr);
      gap:10px;
      align-items:stretch;
    }

    .td-trend-chart-axis{
      display:grid;
      grid-template-rows:repeat(3,minmax(0,1fr));
      align-content:space-between;
      color:#94a3b8;
      font-size:0.74rem;
      font-weight:700;
      padding:4px 0 22px;
    }

    .td-trend-chart-axis span{
      display:flex;
      align-items:flex-start;
      justify-content:flex-end;
      line-height:1;
    }

    .td-trend-chart-axis span:last-child{
      align-items:flex-end;
    }

    .td-trend-chart-plot{
      position:relative;
      min-height:220px;
      border-bottom:1px solid #cbd5e1;
    }

    .td-trend-chart-grid{
      position:absolute;
      inset:0 0 24px 0;
      display:grid;
      grid-template-rows:repeat(3,minmax(0,1fr));
      pointer-events:none;
    }

    .td-trend-chart-grid span{
      border-top:1px dashed #dbe3ee;
    }

    .td-trend-chart-grid span:first-child{
      border-top:1px solid #e2e8f0;
    }

    .td-trend-chart-bars{
      position:relative;
      z-index:1;
      display:grid;
      grid-template-columns:repeat(var(--trend-day-count),minmax(0,1fr));
      gap:10px;
      align-items:end;
      min-height:220px;
      height:100%;
      padding-top:4px;
    }

    .td-trend-bar-col{
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:8px;
      min-width:0;
      height:100%;
    }

    .td-trend-bar-value{
      color:#334155;
      font-size:0.76rem;
      font-weight:800;
      line-height:1;
      white-space:nowrap;
    }

    .td-trend-bar-slot{
      display:flex;
      align-items:flex-end;
      justify-content:center;
      width:100%;
      flex:1 1 auto;
      min-height:140px;
      padding:0 2px;
    }

    .td-trend-bar{
      display:block;
      width:min(38px,100%);
      min-height:0;
      border-radius:14px 14px 4px 4px;
      background:linear-gradient(180deg,#cbd5e1 0%,#94a3b8 100%);
      box-shadow:inset 0 -1px 0 rgba(15,23,42,0.12);
    }

    .td-trend-bar--earlier{
      background:linear-gradient(180deg,#cbd5e1 0%,#94a3b8 100%);
    }

    .td-trend-bar--neutral{
      background:linear-gradient(180deg,#93c5fd 0%,#2563eb 100%);
    }

    .td-trend-bar--green{
      background:linear-gradient(180deg,#86efac 0%,#16a34a 100%);
    }

    .td-trend-bar--red{
      background:linear-gradient(180deg,#fdba74 0%,#ea580c 100%);
    }

    .td-trend-bar-day{
      color:#64748b;
      font-size:0.74rem;
      font-weight:700;
      line-height:1.2;
      text-align:center;
      word-break:break-word;
    }

    .td-trend-phase-row{
      display:flex;
      gap:8px;
    }

    .td-trend-phase{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:0;
      padding:6px 10px;
      border-radius:999px;
      font-size:0.76rem;
      font-weight:800;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }

    .td-trend-phase--earlier{
      background:#e2e8f0;
      color:#475569;
    }

    .td-trend-phase--neutral{
      background:#dbeafe;
      color:#1d4ed8;
    }

    .td-trend-phase--green{
      background:#dcfce7;
      color:#166534;
    }

    .td-trend-phase--red{
      background:#ffedd5;
      color:#c2410c;
    }

    .td-trend-meta{
      display:flex;
      align-items:center;
      justify-content:space-between;
      flex-wrap:wrap;
      gap:8px 12px;
      color:#64748b;
      font-size:0.82rem;
      font-weight:600;
    }

    .td-trend-compare{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:10px;
    }

    .td-trend-stat{
      display:flex;
      flex-direction:column;
      gap:4px;
      padding:12px;
      border:1px solid #e2e8f0;
      border-radius:14px;
      background:#fff;
    }

    .td-trend-stat span{
      color:#64748b;
      font-size:0.78rem;
      font-weight:800;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }

    .td-trend-stat strong{
      color:#0f172a;
      font-size:1rem;
    }

    .td-trend-change{
      display:flex;
      flex-direction:column;
      gap:4px;
      align-items:center;
      justify-content:center;
      padding:12px;
      border:1px solid #dbe3ee;
      border-radius:14px;
      background:#f8fafc;
      color:#475569;
      text-align:center;
    }

    .td-trend-change--green{
      border-color:#86efac;
      background:#f0fdf4;
      color:#166534;
    }

    .td-trend-change--red{
      border-color:#fdba74;
      background:#fff7ed;
      color:#c2410c;
    }

    .td-trend-change--neutral{
      border-color:#cbd5e1;
      background:#f8fafc;
      color:#475569;
    }

    .td-trend-change span{
      font-size:0.78rem;
      font-weight:800;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }

    .td-trend-change-label{
      letter-spacing:0.02em;
      text-transform:none;
    }

    .td-trend-change strong{
      color:currentColor;
      font-size:1.08rem;
    }

    .td-trend-change small{
      font-size:0.78rem;
      font-weight:600;
    }

    .td-trend-change-note{
      opacity:0.82;
    }

    .td-trend-summary-text{
      margin:0;
      color:#475569;
      font-size:0.88rem;
      line-height:1.45;
    }

    .td-trend-explainer{
      margin:0;
      color:#64748b;
      font-size:0.84rem;
      line-height:1.45;
    }

    .td-inline-disclosure--summary{
      align-self:flex-start;
      padding:6px 12px;
      font-size:0.85rem;
    }

    .td-pupil-word-summary{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-assignment-word-footer{
      display:flex;
      flex-direction:column;
      gap:8px;
      border-top:1px solid #e2e8f0;
      padding-top:12px;
    }

    .td-assignment-word-footer > span{
      color:#64748b;
      font-size:0.8rem;
      font-weight:800;
      letter-spacing:0.06em;
      text-transform:uppercase;
    }

    .td-status-dot{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:22px;
      height:22px;
      padding:0 6px;
      border-radius:999px;
      border:1px solid #cbd5e1;
      background:#fff;
      color:#64748b;
      font-size:0.76rem;
      font-weight:800;
      line-height:1;
      flex:0 0 auto;
      cursor:help;
    }

    .td-status-dot--needs_review{
      border-color:#fecaca;
      background:#fef2f2;
      color:#b91c1c;
    }

    .td-status-dot--developing{
      border-color:#fcd34d;
      background:#fffbeb;
      color:#b45309;
    }

    .td-status-dot--secure{
      border-color:#86efac;
      background:#f0fdf4;
      color:#166534;
    }

    .td-status-dot--not_started{
      border-color:#cbd5e1;
      background:#f8fafc;
      color:#94a3b8;
    }

    .td-status-dot--targeted{
      box-shadow:0 0 0 2px #0f172a;
    }

    .td-assignment-matrix-shell{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-assignment-matrix-legend{
      display:flex;
      flex-wrap:wrap;
      gap:10px 16px;
      color:#475569;
      font-size:0.88rem;
    }

    .td-assignment-matrix-legend span{
      display:inline-flex;
      align-items:center;
      gap:8px;
    }

    .td-assignment-matrix-scroll-shell{
      gap:0;
    }

    .td-assignment-matrix-wrap{
      overflow-y:auto;
      overflow-x:hidden;
      max-height:min(78vh, 760px);
      padding-bottom:28px;
      scroll-padding-bottom:28px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      background:#fff;
      transition:max-height .18s ease, padding-bottom .18s ease;
    }

    .td-assignment-matrix-shell.has-open-target-popover .td-assignment-matrix-wrap{
      max-height:min(86vh, 980px);
      padding-bottom:180px;
      scroll-padding-bottom:180px;
    }

    .td-assignment-matrix-shell.has-open-target-popover .td-scroll-shell-track{
      margin-top:16px;
    }

    .td-assignment-matrix{
      width:100%;
      border-collapse:separate;
      border-spacing:0;
      min-width:1100px;
    }

    .td-assignment-matrix th,
    .td-assignment-matrix td{
      padding:12px 10px;
      border-bottom:1px solid #e2e8f0;
      border-right:1px solid #f1f5f9;
      text-align:center;
      vertical-align:middle;
    }

    .td-assignment-matrix thead th{
      position:sticky;
      top:0;
      background:#f8fafc;
      color:#475569;
      font-size:0.82rem;
      font-weight:800;
      z-index:1;
      min-width:88px;
    }

    .td-assignment-matrix-col-rank{
      min-width:74px;
    }

    .td-assignment-matrix-col-accuracy{
      min-width:88px;
    }

    .td-assignment-matrix-col-outof{
      min-width:86px;
    }

    .td-assignment-matrix-col-targets{
      min-width:180px;
    }

    .td-assignment-matrix thead th:first-child,
    .td-assignment-matrix tbody th{
      position:sticky;
      left:0;
      background:#fff;
      z-index:2;
      text-align:left;
    }

    .td-assignment-matrix thead th:first-child{
      z-index:3;
      background:#f8fafc;
      min-width:180px;
    }

    .td-assignment-matrix tbody th{
      color:#0f172a;
      font-size:0.9rem;
      font-weight:700;
      min-width:180px;
    }

    .td-assignment-matrix-pupil-link{
      display:inline-flex;
      align-items:center;
      padding:0;
      border:none;
      background:none;
      color:inherit;
      font:inherit;
      font-weight:inherit;
      line-height:inherit;
      text-align:left;
      cursor:pointer;
      text-decoration:none;
      transition:color .18s ease, text-decoration-color .18s ease;
      appearance:none;
      -webkit-appearance:none;
    }

    .td-assignment-matrix-pupil-link:hover,
    .td-assignment-matrix-pupil-link:focus-visible{
      color:#1d4ed8;
      text-decoration:underline;
      text-underline-offset:0.16em;
    }

    .td-assignment-matrix-pupil-link:focus-visible{
      outline:2px solid rgba(37,99,235,.28);
      outline-offset:3px;
      border-radius:8px;
    }

    .td-assignment-matrix-row--highlight th,
    .td-assignment-matrix-row--highlight td{
      background:#eff6ff;
    }

    .td-assignment-matrix-row--highlight th{
      box-shadow:inset 4px 0 0 #2563eb;
    }

    .td-assignment-matrix-cell--metric{
      background:#f8fafc;
      color:#334155;
      font-size:0.84rem;
      font-weight:800;
      white-space:nowrap;
    }

    .td-assignment-matrix-cell--metric.is-muted{
      color:#94a3b8;
      font-weight:700;
    }

    .td-assignment-matrix-cell--targets{
      background:#f8fafc;
      min-width:180px;
    }

    .td-target-summary{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:44px;
      color:#334155;
      font-size:0.82rem;
      font-weight:800;
    }

    .td-target-summary--empty{
      color:#94a3b8;
      font-weight:700;
    }

    .td-target-popover{
      position:relative;
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }

    .td-target-popover summary{
      list-style:none;
    }

    .td-target-popover summary::-webkit-details-marker{
      display:none;
    }

    .td-target-popover-trigger{
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      justify-content:center;
      min-width:150px;
      padding:8px 12px;
      border:1px solid #cbd5e1;
      border-radius:14px;
      background:#fff;
      color:#334155;
      cursor:pointer;
      font-size:0.78rem;
      font-weight:800;
      line-height:1.2;
      transition:border-color .18s ease, background .18s ease, box-shadow .18s ease;
    }

    .td-target-summary-chip{
      color:#0f172a;
      font-size:0.82rem;
      font-weight:800;
      white-space:nowrap;
    }

    .td-target-summary-meta{
      color:#64748b;
      font-size:0.72rem;
      font-weight:700;
      white-space:nowrap;
      margin-top:3px;
    }

    .td-target-popover:hover .td-target-popover-trigger,
    .td-target-popover:focus-within .td-target-popover-trigger,
    .td-target-popover[open] .td-target-popover-trigger{
      background:#eff6ff;
      border-color:#93c5fd;
      box-shadow:0 0 0 3px rgba(59,130,246,.12);
    }

    .td-target-popover-card{
      position:absolute;
      left:0;
      top:calc(100% + 10px);
      width:min(440px,calc(100vw - 48px));
      padding:16px;
      border:1px solid #dbe3ee;
      border-radius:16px;
      background:#fff;
      box-shadow:0 18px 42px rgba(15,23,42,0.18);
      text-align:left;
      z-index:25;
    }

    .td-target-popover-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:10px;
      margin-bottom:10px;
    }

    .td-target-popover-head strong{
      color:#0f172a;
      font-size:0.92rem;
      line-height:1.3;
    }

    .td-target-popover-head span{
      color:#64748b;
      font-size:0.78rem;
      font-weight:700;
      white-space:nowrap;
    }

    .td-target-mini-table{
      width:100%;
      border-collapse:separate;
      border-spacing:0;
      table-layout:fixed;
      font-size:0.8rem;
      border:1px solid #e2e8f0;
      border-radius:14px;
      overflow:hidden;
      background:#fff;
    }

    .td-target-mini-table-col-word{
      width:30%;
    }

    .td-target-mini-table-col-why{
      width:36%;
    }

    .td-target-mini-table-col-now{
      width:34%;
    }

    .td-target-mini-table th,
    .td-target-mini-table td{
      padding:10px 12px;
      border-bottom:1px solid #e2e8f0;
      border-right:1px solid #eef2f7;
      text-align:left;
      vertical-align:middle;
      background:inherit;
    }

    .td-target-mini-table thead th{
      color:#64748b;
      font-size:0.72rem;
      font-weight:800;
      letter-spacing:0.04em;
      text-transform:uppercase;
      background:#f8fafc;
      border-bottom:1px solid #dbe3ee;
    }

    .td-target-mini-table thead th:last-child,
    .td-target-mini-table tbody td:last-child{
      border-right:none;
    }

    .td-target-mini-table tbody tr{
      background:#fff;
    }

    .td-target-mini-table tbody th{
      color:#0f172a;
      font-weight:700;
    }

    .td-target-mini-word,
    .td-target-mini-why{
      display:block;
      line-height:1.4;
    }

    .td-target-mini-table tr:last-child th,
    .td-target-mini-table tr:last-child td{
      border-bottom:none;
    }

    .td-target-mini-status-cell{
      display:flex;
      align-items:center;
      min-height:100%;
    }

    .td-target-mini-status{
      display:flex;
      align-items:center;
      gap:8px;
      width:100%;
      color:#475569;
      line-height:1.35;
    }

    .td-assignment-matrix tr:last-child th,
    .td-assignment-matrix tr:last-child td{
      border-bottom:none;
    }

    .td-assignment-matrix td:last-child,
    .td-assignment-matrix th:last-child{
      border-right:none;
    }

    .td-generated-results-shell{
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .td-generated-results-card{
      border:1px solid #dbe5f4;
      border-radius:20px;
      background:#fff;
      padding:16px;
      box-shadow:0 10px 24px rgba(15,23,42,.04);
    }

    .td-generated-results-card--highlight{
      border-color:#93c5fd;
      box-shadow:0 14px 28px rgba(59,130,246,.12);
    }

    .td-generated-results-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }

    .td-generated-results-metrics{
      display:flex;
      flex-wrap:wrap;
      gap:8px 14px;
      margin-top:6px;
      color:#64748b;
      font-size:0.88rem;
    }

    .td-generated-results-sections{
      display:grid;
      gap:12px;
    }

    .td-generated-results-section{
      border:1px solid #e2e8f0;
      border-radius:16px;
      padding:12px;
      background:#f8fbff;
    }

    .td-generated-results-section-head{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:8px;
      color:#334155;
      font-size:0.92rem;
    }

    .td-generated-results-items{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .td-generated-results-item{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:10px 12px;
      border-radius:14px;
      background:#fff;
      border:1px solid #e2e8f0;
    }

    .td-generated-results-item-main{
      display:flex;
      flex-direction:column;
      gap:3px;
      min-width:0;
    }

    .td-generated-results-word{
      font-weight:800;
      color:#0f172a;
    }

    .td-generated-results-note{
      color:#64748b;
      font-size:0.84rem;
      line-height:1.35;
    }

    .td-generated-results-item-meta{
      display:flex;
      align-items:center;
      gap:8px;
      flex-shrink:0;
    }

    .td-generated-results-tag{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:4px 10px;
      border-radius:999px;
      background:#eff6ff;
      color:#1d4ed8;
      font-size:0.78rem;
      font-weight:800;
      border:1px solid #bfdbfe;
    }

    .td-field--results-select{
      max-width:460px;
      margin-bottom:14px;
    }

    .td-field--results-select-wide{
      width:100%;
      max-width:none;
    }

    .td-field--rank-select{
      max-width:260px;
      margin-bottom:0;
      flex:1 1 220px;
    }

    .td-class-results-selected{
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    .td-class-results-selected-head{
      display:flex;
      flex-wrap:wrap;
      justify-content:space-between;
      gap:10px 14px;
      color:#64748b;
      font-size:0.92rem;
    }

    .td-class-results-selected-head strong{
      color:#0f172a;
      font-size:1rem;
    }

    .td-analytics-list{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-analytics-item{
      border:1px solid #dbe3ee;
      border-radius:14px;
      padding:12px;
      background:#fff;
    }

    .td-analytics-item--weak{
      background:#fff7ed;
      border-color:#fdba74;
    }

    .td-analytics-item--strong{
      background:#f0fdf4;
      border-color:#86efac;
    }

    .td-analytics-item--status-needs_review{
      background:#fff7ed;
      border-color:#fdba74;
    }

    .td-analytics-item--status-developing{
      background:#fffbeb;
      border-color:#fde68a;
    }

    .td-analytics-item--status-secure{
      background:#f0fdf4;
      border-color:#86efac;
    }

    .td-analytics-item-top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:6px;
    }

    .td-band{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:4px 10px;
      border-radius:999px;
      font-size:0.78rem;
      font-weight:800;
      white-space:nowrap;
      border:1px solid transparent;
    }

    .td-band--secure{
      background:#dcfce7;
      border-color:#86efac;
      color:#166534;
    }

    .td-band--nearly_secure{
      background:#fef3c7;
      border-color:#fcd34d;
      color:#92400e;
    }

    .td-band--insecure{
      background:#fee2e2;
      border-color:#fca5a5;
      color:#991b1b;
    }

    .td-analytics-item-sub{
      display:flex;
      align-items:center;
      color:#64748b;
      font-size:0.9rem;
      line-height:1.4;
    }

    .td-analytics-item-sub .uiIconLabel,
    .td-pupil-metric .uiIconLabel,
    .td-visual-mini-sub .uiIconLabel{
      gap:6px;
    }

    .td-analytics-item-sub .uiIcon,
    .td-pupil-metric .uiIcon,
    .td-visual-mini-sub .uiIcon,
    .td-visual-pupil-table-head .uiIcon{
      width:15px;
      height:15px;
    }

    .td-visual-pupil-table-head .uiIconOnly{
      width:24px;
      height:24px;
    }

    .td-timeline-list{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .td-timeline-row{
      display:grid;
      grid-template-columns:minmax(0,1fr) minmax(120px,1fr) auto;
      gap:12px;
      align-items:center;
    }

    .td-timeline-copy{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }

    .td-timeline-copy span{
      color:#64748b;
      font-size:0.88rem;
    }

    .td-timeline-bar{
      height:10px;
      border-radius:999px;
      background:#e2e8f0;
      overflow:hidden;
    }

    .td-timeline-bar span{
      display:block;
      height:100%;
      border-radius:999px;
      background:#0f172a;
    }

    .td-timeline-rate{
      font-weight:700;
      color:#334155;
      min-width:46px;
      text-align:right;
    }

    .td-pupil-table{
      display:flex;
      flex-direction:column;
      gap:8px;
      max-height:360px;
      overflow:auto;
      padding-right:4px;
    }

    .td-pupil-row{
      display:flex;
      flex-direction:column;
      gap:12px;
      border:1px solid #dbe3ee;
      border-radius:14px;
      padding:12px;
      background:#fff;
    }

    .td-pupil-row.is-muted{
      background:#f8fafc;
    }

    .td-pupil-row.is-alert{
      background:#fff7ed;
      border-color:#fdba74;
    }

    .td-pupil-row.is-open{
      border-color:#94a3b8;
      box-shadow:0 12px 24px rgba(15,23,42,0.06);
    }

    .td-pupil-row-summary{
      display:grid;
      grid-template-columns:minmax(160px,1.2fr) repeat(4,minmax(90px,1fr));
      gap:10px;
      align-items:center;
    }

    .td-pupil-main{
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }

    .td-pupil-main span,
    .td-pupil-metric{
      color:#64748b;
      font-size:0.9rem;
    }

    .td-inline-disclosure-wrap,
    .td-list-disclosure{
      position:relative;
      display:flex;
      justify-content:center;
      align-items:center;
      margin-top:2px;
    }

    .td-inline-disclosure-wrap::before,
    .td-list-disclosure::before{
      content:"";
      position:absolute;
      left:0;
      right:0;
      top:50%;
      height:1px;
      background:#dbe3ee;
    }

    .td-inline-disclosure{
      position:relative;
      z-index:1;
      display:inline-flex;
      align-items:center;
      gap:10px;
      padding:8px 16px;
      border:1px solid #dbe3ee;
      border-radius:999px;
      background:#fff;
      color:#334155;
      font:inherit;
      font-weight:700;
      cursor:pointer;
      transition:border-color .18s ease, background .18s ease, color .18s ease;
    }

    .td-inline-disclosure:hover{
      background:#f8fafc;
      border-color:#94a3b8;
    }

    .td-inline-disclosure-chev{
      display:inline-block;
      font-size:0.92rem;
      line-height:1;
      transition:transform .18s ease;
    }

    .td-inline-disclosure-chev.is-open{
      transform:rotate(180deg);
    }

    .td-pupil-details{
      margin-top:-2px;
    }

    .td-pupil-detail-grid{
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
      gap:10px;
    }

    .td-pupil-detail{
      display:flex;
      flex-direction:column;
      gap:6px;
      border:1px solid #e2e8f0;
      border-radius:12px;
      background:#fff;
      padding:10px 12px;
    }

    .td-pupil-detail span{
      color:#64748b;
      font-size:0.76rem;
      font-weight:800;
      letter-spacing:0.06em;
      text-transform:uppercase;
    }

    .td-pupil-detail strong{
      color:#0f172a;
      font-size:0.94rem;
      line-height:1.35;
    }

    .td-comparison-table{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .td-comparison-row{
      display:grid;
      grid-template-columns:minmax(120px,1.2fr) repeat(3,minmax(70px,1fr));
      gap:10px;
      align-items:center;
      border:1px solid #dbe3ee;
      border-radius:14px;
      padding:12px;
      background:#fff;
      font-size:0.9rem;
    }

    .td-comparison-row--head{
      background:#f8fafc;
      font-weight:800;
      color:#475569;
    }

    .td-comparison-row.is-current{
      border-color:#94a3b8;
      background:#eff6ff;
    }

    @media (max-width: 920px){
      .td-attainment-card-body--horizontal{
        grid-template-columns:1fr;
        gap:12px;
      }

      .td-attainment-card-body--horizontal .td-attainment-card-block--meta{
        padding-left:0;
        border-left:none;
        padding-top:10px;
        border-top:1px solid #dbe3ee;
      }

      .td-action-support{
        grid-template-columns:1fr;
        align-items:flex-start;
      }

      .td-action-row--support{
        justify-content:flex-start;
      }

      .td-analytics-bar-row{
        grid-template-columns:1fr;
      }

      .td-analytics-bar-row--toolbar{
        width:100%;
      }

      .td-form-grid--assign{
        grid-template-columns:1fr 1fr;
      }

      .td-automation-run-grid{
        grid-template-columns:1fr;
      }

      .td-automation-run-grid--policy-details,
      .td-automation-run-grid--generation{
        grid-template-columns:1fr;
      }

      .td-automation-policy-strip-controls,
      .td-automation-policy-switcher-group,
      .td-automation-policy-toolbar,
      .td-automation-alert,
      .td-automation-policy-actions,
      .td-automation-selected-summary-head,
      .td-automation-selected-summary-main{
        flex-direction:column;
        align-items:stretch;
      }

      .td-automation-policy-actions-group--primary{
        margin-left:0;
      }

      .td-field--automation-description{
        grid-column:auto;
      }

      .td-automation-class-picker-head{
        flex-direction:column;
      }

      .td-automation-class-picker-actions{
        justify-content:flex-start;
      }

      .td-automation-alert-actions{
        justify-content:flex-start;
      }

      .td-automation-class-grid{
        grid-template-columns:repeat(auto-fill,minmax(220px,220px));
      }

      .td-automation-summary-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }

      .td-staff-access-layout,
      .td-staff-access-summary-grid,
      .td-staff-access-scope-grid{
        grid-template-columns:1fr;
      }

      .td-staff-access-audit-item,
      .td-staff-access-role-head,
      .td-staff-access-flow-note,
      .td-staff-access-import-head,
      .td-staff-access-import-row-head{
        flex-direction:column;
        align-items:stretch;
      }

      .td-staff-access-role-actions{
        grid-template-columns:1fr;
      }

      .td-staff-access-import-actions{
        justify-content:flex-start;
      }

      .td-staff-access-role-btns{
        min-width:0;
        grid-template-columns:1fr;
      }

      .td-chat-toolbar,
      .td-chat-toolbar-actions{
        flex-direction:column;
        align-items:stretch;
      }

      .td-chat-shell-layout{
        grid-template-columns:1fr;
        gap:18px;
        min-height:unset;
      }

      .td-chat-sidebar{
        border-right:none;
        border-bottom:1px solid #e2eaf3;
        padding:0 0 16px;
      }

      .td-chat-history-list{
        max-height:220px;
        padding-right:0;
      }

      .td-chat-toolbar-scope{
        width:100%;
      }

      .td-results-grid--stacked{
        grid-template-columns:1fr;
      }

      .td-analytics-summary-grid--visual{
        grid-template-columns:repeat(3,minmax(0,1fr));
      }

      .td-compare-toolbar{
        align-items:stretch;
      }

      .td-group-comparison-head,
      .td-group-comparison-actions{
        flex-direction:column;
        align-items:stretch;
      }

      .td-analytics-rank-controls{
        flex-direction:column;
        align-items:stretch;
      }

      .td-analytics-rank-controls .td-field--rank-select{
        max-width:none;
        width:100%;
      }

      .td-compare-panel-stats{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }

      .td-test-group-head{
        flex-direction:column;
        align-items:stretch;
      }

      .td-visual-group-head,
      .td-visual-summary-head,
      .td-visual-toolbar{
        flex-direction:column;
        align-items:stretch;
      }

      .td-visual-student-panels{
        grid-template-columns:1fr;
      }

      .td-test-group-meta{
        justify-content:flex-start;
      }

      .td-card-row{
        flex-direction:column;
        align-items:stretch;
      }

      .td-card-actions{
        justify-content:flex-start;
      }

      .td-chat-card--surface{
        min-height:unset;
      }

      .td-chat-message{
        max-width:100%;
      }

      .td-results-grid{
        grid-template-columns:1fr;
      }

      .td-accuracy-band-grid{
        grid-template-columns:1fr;
      }

      .td-trend-chart-shell{
        grid-template-columns:34px minmax(0,1fr);
      }

      .td-trend-chart-bars{
        gap:8px;
      }

      .td-trend-compare{
        grid-template-columns:1fr;
      }

      .td-trend-meta{
        flex-direction:column;
        align-items:flex-start;
      }

      .td-compact-summary-grid{
        grid-template-columns:1fr;
      }

      .td-compare-panel-stats{
        grid-template-columns:1fr;
      }

      .td-pupil-row-summary,
      .td-compare-mini-row,
      .td-comparison-row,
      .td-timeline-row,
      .td-analytics-rank-row,
      .td-visual-pupil-row,
      .td-visual-class-row,
      .td-visual-student-row{
        grid-template-columns:1fr;
      }

      .td-progress-hero-head,
      .td-pupil-compact-top,
      .td-class-results-head{
        flex-direction:column;
        align-items:flex-start;
      }

      .td-pupil-compact-side{
        align-items:flex-start;
      }

      .td-visual-pupil-table-head{
        display:none;
      }

      .td-analytics-rank-head{
        display:none;
      }

      .td-timeline-rate{
        text-align:left;
      }
    }

    @media (max-width: 640px){
      .td-analytics-summary-card--hero{
        padding:12px 14px;
      }

      .td-attainment-card-body--horizontal .td-attainment-card-main-text{
        font-size:clamp(1.05rem,0.95rem + 1vw,1.55rem);
      }

      .td-shell{
        padding:18px 12px 44px;
      }

      .td-form-grid--assign{
        grid-template-columns:1fr;
      }

      .td-card-actions{
        display:grid;
        grid-template-columns:1fr 1fr;
      }

      .td-action-button-shell{
        width:100%;
      }

      .td-action-button-shell .td-btn{
        flex:1 1 auto;
      }

      .td-btn--ghost{
        width:100%;
      }

      .td-staff-access-person{
        align-items:flex-start;
      }

      .td-chat-card{
        padding:16px;
        border-radius:24px;
      }

      .td-chat-close-btn{
        top:12px;
        right:12px;
      }

      .td-chat-home-title{
        font-size:2.15rem;
      }

      .td-chat-composer-shell{
        border-radius:24px;
        padding:8px 10px 8px 14px;
        gap:8px;
      }

      .td-chat-send--icon{
        width:38px;
        min-width:38px;
        height:38px;
      }

      .td-chat-chip-row--hero{
        justify-content:flex-start;
      }

      .td-analytics-summary-grid--visual{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }

      .td-inline-head{
        flex-direction:column;
        align-items:flex-start;
      }

      .td-assignment-matrix{
        min-width:640px;
      }

      .td-create-class-form{
        flex-direction:column;
        align-items:stretch;
      }

      .td-automation-class-grid{
        grid-template-columns:1fr;
      }

      .td-automation-summary-grid{
        grid-template-columns:1fr;
      }

      .td-action-inline-copy{
        max-width:none;
      }

      .td-generated-results-head,
      .td-generated-results-item{
        flex-direction:column;
        align-items:flex-start;
      }

      .td-generated-results-item-meta{
        width:100%;
        justify-content:space-between;
      }

      .td-floating-ai{
        right:14px;
        bottom:14px;
        padding:12px 14px;
      }

      .td-trend-chart{
        padding:12px;
      }

      .td-trend-chart-head{
        align-items:flex-start;
      }

      .td-trend-chart-axis{
        font-size:0.68rem;
      }

      .td-trend-bar-value{
        font-size:0.68rem;
      }

      .td-trend-bar-day{
        font-size:0.68rem;
      }

      .td-trend-phase-row{
        flex-direction:column;
      }
    }
  `;
  document.head.appendChild(style);
}
