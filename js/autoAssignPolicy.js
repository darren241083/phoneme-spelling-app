export const AUTO_ASSIGN_POLICY_LENGTH_MIN = 4;
export const AUTO_ASSIGN_POLICY_LENGTH_MAX = 20;

export const AUTO_ASSIGN_SUPPORT_PRESET_OPTIONS = Object.freeze([
  {
    value: "balanced",
    label: "Balanced",
    description: "Mix independent and supported items using the normal personalised balance.",
  },
  {
    value: "independent_first",
    label: "Independent-first",
    description: "Keep the test as independent as possible and only avoid support where it is not needed.",
  },
  {
    value: "more_support_when_needed",
    label: "More support when needed",
    description: "Use extra support more readily when the pupil profile suggests they need it.",
  },
]);

export const AUTO_ASSIGN_POLICY_DEFAULTS = Object.freeze({
  assignment_length: 10,
  support_preset: "balanced",
  allow_starter_fallback: true,
});

export const PERSONALISED_AUTOMATION_FREQUENCY_OPTIONS = Object.freeze([
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
]);

export const PERSONALISED_AUTOMATION_WEEKDAY_OPTIONS = Object.freeze([
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
]);
export const PERSONALISED_AUTOMATION_EXPIRY_WARNING_DAYS = 7;

const PERSONALISED_AUTOMATION_WEEKDAY_SET = new Set(
  PERSONALISED_AUTOMATION_WEEKDAY_OPTIONS.map((option) => option.value)
);

const PERSONALISED_AUTOMATION_DEFAULT_WEEKDAYS = Object.freeze(["friday"]);
const PERSONALISED_AUTOMATION_DAY_MS = 24 * 60 * 60 * 1000;

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function formatDateInputValue(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function normalizeDateInputValue(value) {
  const clean = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : "";
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 0, 0);
}

function startOfWeek(date) {
  const offset = (date.getDay() + 6) % 7;
  return addDays(startOfDay(date), -offset);
}

function parseLocalDate(value) {
  const normalized = normalizeDateInputValue(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map((part) => Number(part));
  const next = new Date(year, month - 1, day);
  return Number.isNaN(next.getTime()) ? null : next;
}

function getDayDifference(fromDate, toDate) {
  const fromTime = startOfDay(fromDate).getTime();
  const toTime = startOfDay(toDate).getTime();
  return Math.round((toTime - fromTime) / PERSONALISED_AUTOMATION_DAY_MS);
}

function normalizeFrequency(value) {
  const next = String(value || "").trim().toLowerCase();
  return PERSONALISED_AUTOMATION_FREQUENCY_OPTIONS.some((option) => option.value === next)
    ? next
    : "weekly";
}

function normalizeWeekdayList(value, { fallbackToDefault = true } = {}) {
  const source = Array.isArray(value)
    ? value
    : (typeof value === "string" && value.includes(",") ? value.split(",") : [value]);
  const normalized = [...new Set(
    source
      .map((item) => String(item || "").trim().toLowerCase())
      .filter((item) => PERSONALISED_AUTOMATION_WEEKDAY_SET.has(item))
  )];
  return normalized.length || !fallbackToDefault ? normalized : [...PERSONALISED_AUTOMATION_DEFAULT_WEEKDAYS];
}

function mergeWeekdayLists(...weekdayLists) {
  return [...new Set(
    weekdayLists.flatMap((items) => normalizeWeekdayList(items, { fallbackToDefault: false }))
  )];
}

function normalizeIdList(items = []) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )];
}

export function buildDefaultPersonalisedAutomationPolicy({ today = new Date() } = {}) {
  return {
    id: "",
    teacher_id: "",
    name: "",
    description: "",
    active: false,
    assignment_length: AUTO_ASSIGN_POLICY_DEFAULTS.assignment_length,
    support_preset: AUTO_ASSIGN_POLICY_DEFAULTS.support_preset,
    allow_starter_fallback: AUTO_ASSIGN_POLICY_DEFAULTS.allow_starter_fallback,
    frequency: "weekly",
    selected_weekdays: [...PERSONALISED_AUTOMATION_DEFAULT_WEEKDAYS],
    selected_weekdays_week_1: [...PERSONALISED_AUTOMATION_DEFAULT_WEEKDAYS],
    selected_weekdays_week_2: [],
    start_date: formatDateInputValue(today),
    end_date: "",
    target_class_ids: [],
    archived_at: null,
    archived_by: "",
    created_at: null,
    updated_at: null,
    created_by: "",
    updated_by: "",
  };
}

function toInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
}

function clampInteger(value, min, max, fallback) {
  const numeric = toInteger(value, fallback);
  return Math.min(max, Math.max(min, numeric));
}

function normalizeSupportPreset(value) {
  const next = String(value || "").trim().toLowerCase();
  return AUTO_ASSIGN_SUPPORT_PRESET_OPTIONS.some((option) => option.value === next)
    ? next
    : AUTO_ASSIGN_POLICY_DEFAULTS.support_preset;
}

function normalizePolicyName(value) {
  return String(value || "").trim();
}

function normalizePolicyDescription(value) {
  return String(value || "").trim();
}

export function normalizeAutoAssignPolicy(rawPolicy = null) {
  const source = rawPolicy && typeof rawPolicy === "object" ? rawPolicy : {};
  return {
    assignment_length: clampInteger(
      source.assignment_length,
      AUTO_ASSIGN_POLICY_LENGTH_MIN,
      AUTO_ASSIGN_POLICY_LENGTH_MAX,
      AUTO_ASSIGN_POLICY_DEFAULTS.assignment_length,
    ),
    support_preset: normalizeSupportPreset(source.support_preset),
    allow_starter_fallback: source.allow_starter_fallback !== false,
  };
}

export function isDefaultAutoAssignPolicy(rawPolicy = null) {
  const normalized = normalizeAutoAssignPolicy(rawPolicy);
  return normalized.assignment_length === AUTO_ASSIGN_POLICY_DEFAULTS.assignment_length
    && normalized.support_preset === AUTO_ASSIGN_POLICY_DEFAULTS.support_preset
    && normalized.allow_starter_fallback === AUTO_ASSIGN_POLICY_DEFAULTS.allow_starter_fallback;
}

export function getAutoAssignSupportPresetLabel(value) {
  const normalized = normalizeSupportPreset(value);
  return AUTO_ASSIGN_SUPPORT_PRESET_OPTIONS.find((option) => option.value === normalized)?.label || "Balanced";
}

export function getAutoAssignSupportPresetDescription(value) {
  const normalized = normalizeSupportPreset(value);
  return AUTO_ASSIGN_SUPPORT_PRESET_OPTIONS.find((option) => option.value === normalized)?.description
    || "Mix independent and supported items using the normal personalised balance.";
}

export function buildAutoAssignPolicySummary(rawPolicy = null, { useDefaultLabel = false } = {}) {
  const normalized = normalizeAutoAssignPolicy(rawPolicy);
  if (useDefaultLabel && isDefaultAutoAssignPolicy(normalized)) return "default";
  return `${normalized.assignment_length} words | ${getAutoAssignSupportPresetLabel(normalized.support_preset)} | Starter fallback ${normalized.allow_starter_fallback ? "on" : "off"}`;
}

export function buildAutoAssignEngineOptions(rawPolicy = null) {
  const policy = normalizeAutoAssignPolicy(rawPolicy);
  const baseOptions = {
    policy,
    supportPreset: policy.support_preset,
    allowConfusionSubstitution: true,
    allowSupportedSubstitution: true,
    extraTargetSupportSlots: 0,
    minimumIndependentTargetItems: 0,
  };

  if (policy.support_preset === "independent_first") {
    return {
      ...baseOptions,
      allowConfusionSubstitution: false,
      allowSupportedSubstitution: false,
    };
  }

  if (policy.support_preset === "more_support_when_needed") {
    return {
      ...baseOptions,
      extraTargetSupportSlots: 1,
      minimumIndependentTargetItems: 1,
    };
  }

  return baseOptions;
}

export function normalizePersonalisedAutomationPolicy(rawPolicy = null, { today = new Date() } = {}) {
  const source = rawPolicy && typeof rawPolicy === "object" ? rawPolicy : {};
  const defaults = buildDefaultPersonalisedAutomationPolicy({ today });
  const normalizedBase = normalizeAutoAssignPolicy(source);
  const frequency = normalizeFrequency(source.frequency);
  const legacySelectedWeekdays = normalizeWeekdayList(source.selected_weekdays);
  let selectedWeekdaysWeek1 = normalizeWeekdayList(source.selected_weekdays_week_1, { fallbackToDefault: false });
  let selectedWeekdaysWeek2 = normalizeWeekdayList(source.selected_weekdays_week_2, { fallbackToDefault: false });
  if (frequency === "fortnightly" && !selectedWeekdaysWeek1.length && !selectedWeekdaysWeek2.length) {
    selectedWeekdaysWeek1 = legacySelectedWeekdays;
  }
  if (frequency === "weekly") {
    selectedWeekdaysWeek1 = legacySelectedWeekdays;
    selectedWeekdaysWeek2 = [];
  }
  const selectedWeekdays = frequency === "fortnightly"
    ? mergeWeekdayLists(selectedWeekdaysWeek1, selectedWeekdaysWeek2)
    : legacySelectedWeekdays;
  return {
    id: String(source.id || "").trim(),
    teacher_id: String(source.teacher_id || "").trim(),
    name: normalizePolicyName(source.name),
    description: normalizePolicyDescription(source.description),
    active: source.active === true || String(source.active || "").trim().toLowerCase() === "true",
    assignment_length: normalizedBase.assignment_length,
    support_preset: normalizedBase.support_preset,
    allow_starter_fallback: normalizedBase.allow_starter_fallback,
    frequency,
    selected_weekdays: selectedWeekdays.length ? selectedWeekdays : [...PERSONALISED_AUTOMATION_DEFAULT_WEEKDAYS],
    selected_weekdays_week_1: selectedWeekdaysWeek1,
    selected_weekdays_week_2: selectedWeekdaysWeek2,
    start_date: normalizeDateInputValue(source.start_date) || defaults.start_date,
    end_date: normalizeDateInputValue(source.end_date),
    target_class_ids: normalizeIdList(source.target_class_ids),
    archived_at: source.archived_at || null,
    archived_by: String(source.archived_by || "").trim(),
    created_at: source.created_at || null,
    updated_at: source.updated_at || null,
    created_by: String(source.created_by || "").trim(),
    updated_by: String(source.updated_by || "").trim(),
  };
}

export function isPersonalisedAutomationPolicyArchived(rawPolicy = null) {
  const policy = normalizePersonalisedAutomationPolicy(rawPolicy);
  return !!String(policy.archived_at || "").trim();
}

export function getPersonalisedAutomationPolicyLifecycle(
  rawPolicy = null,
  { today = new Date(), warningDays = PERSONALISED_AUTOMATION_EXPIRY_WARNING_DAYS } = {},
) {
  const policy = normalizePersonalisedAutomationPolicy(rawPolicy, { today });
  const currentDay = startOfDay(today);
  const startDate = parseLocalDate(policy.start_date) || currentDay;
  const endDate = parseLocalDate(policy.end_date);
  const archived = isPersonalisedAutomationPolicyArchived(policy);
  const scheduled = !archived && currentDay < startDate;
  const expired = !archived && !!endDate && currentDay > endDate;
  const inWindow = !archived && !scheduled && !expired;
  const daysUntilStart = scheduled ? getDayDifference(currentDay, startDate) : null;
  const daysUntilExpiry = endDate ? getDayDifference(currentDay, endDate) : null;
  const expiringSoon = inWindow
    && Number.isFinite(daysUntilExpiry)
    && daysUntilExpiry >= 0
    && daysUntilExpiry <= Math.max(0, Number(warningDays || 0));
  const state = archived
    ? "archived"
    : expired
      ? "expired"
      : scheduled
        ? "scheduled"
        : expiringSoon
          ? "expiring_soon"
          : "live";
  const label = state === "archived"
    ? "Archived"
    : state === "expired"
      ? "Expired"
      : state === "scheduled"
        ? "Scheduled"
        : state === "expiring_soon"
          ? "Expiring soon"
          : "Live";

  return {
    policy,
    state,
    label,
    archived,
    scheduled,
    expired,
    inWindow,
    usable: inWindow,
    expiringSoon,
    startDate,
    endDate,
    daysUntilStart,
    daysUntilExpiry,
    warningDays: Math.max(0, Number(warningDays || 0)),
  };
}

export function isPersonalisedAutomationPolicyUsable(rawPolicy = null, options = {}) {
  return getPersonalisedAutomationPolicyLifecycle(rawPolicy, options).usable;
}

export function getLegacyPersonalisedAutomationPolicyActiveValue(rawPolicy = null, options = {}) {
  return isPersonalisedAutomationPolicyUsable(rawPolicy, options);
}

export function doPersonalisedAutomationPolicyWindowsOverlap(rawPolicyA = null, rawPolicyB = null) {
  const policyA = normalizePersonalisedAutomationPolicy(rawPolicyA);
  const policyB = normalizePersonalisedAutomationPolicy(rawPolicyB);
  if (isPersonalisedAutomationPolicyArchived(policyA) || isPersonalisedAutomationPolicyArchived(policyB)) {
    return false;
  }

  const startA = parseLocalDate(policyA.start_date);
  const startB = parseLocalDate(policyB.start_date);
  if (!startA || !startB) return false;

  const endA = parseLocalDate(policyA.end_date);
  const endB = parseLocalDate(policyB.end_date);
  const startATime = startOfDay(startA).getTime();
  const startBTime = startOfDay(startB).getTime();
  const endATime = endA ? startOfDay(endA).getTime() : Number.POSITIVE_INFINITY;
  const endBTime = endB ? startOfDay(endB).getTime() : Number.POSITIVE_INFINITY;

  return startATime <= endBTime && startBTime <= endATime;
}

export function getPersonalisedAutomationFrequencyLabel(value) {
  const normalized = normalizeFrequency(value);
  return PERSONALISED_AUTOMATION_FREQUENCY_OPTIONS.find((option) => option.value === normalized)?.label || "Weekly";
}

export function formatPersonalisedAutomationWeekdayList(values = []) {
  const normalized = normalizeWeekdayList(values);
  return normalized
    .map((value) => PERSONALISED_AUTOMATION_WEEKDAY_OPTIONS.find((option) => option.value === value)?.label || value)
    .join(", ");
}

export function formatPersonalisedAutomationDateDisplay(value) {
  const normalized = normalizeDateInputValue(value);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

export function buildPersonalisedAutomationPolicySummary(rawPolicy = null, { includeTargets = false } = {}) {
  const policy = normalizePersonalisedAutomationPolicy(rawPolicy);
  const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy);
  const cadenceText = policy.frequency === "fortnightly"
    ? `Fortnightly | Week 1: ${formatPersonalisedAutomationWeekdayList(policy.selected_weekdays_week_1)} | Week 2: ${policy.selected_weekdays_week_2.length ? formatPersonalisedAutomationWeekdayList(policy.selected_weekdays_week_2) : "not selected"}`
    : `${getPersonalisedAutomationFrequencyLabel(policy.frequency)} on ${formatPersonalisedAutomationWeekdayList(policy.selected_weekdays)}`;
  const parts = [
    lifecycle.label,
    `${policy.assignment_length} words`,
    getAutoAssignSupportPresetLabel(policy.support_preset),
    `Starter fallback ${policy.allow_starter_fallback ? "on" : "off"}`,
    cadenceText,
    policy.end_date
      ? `${formatPersonalisedAutomationDateDisplay(policy.start_date)} to ${formatPersonalisedAutomationDateDisplay(policy.end_date)}`
      : `From ${formatPersonalisedAutomationDateDisplay(policy.start_date)}`,
  ];
  if (includeTargets) {
    parts.push(`${policy.target_class_ids.length} target group${policy.target_class_ids.length === 1 ? "" : "s"}`);
  }
  return parts.join(" | ");
}

function getWeekdayValue(date) {
  return PERSONALISED_AUTOMATION_WEEKDAY_OPTIONS[date.getDay() === 0 ? 6 : date.getDay() - 1]?.value || "monday";
}

function getReleaseCycleWeekIndex(candidate, startDate) {
  const candidateWeek = startOfWeek(candidate).getTime();
  const startWeek = startOfWeek(startDate).getTime();
  return Math.floor((candidateWeek - startWeek) / (7 * 24 * 60 * 60 * 1000));
}

function getFortnightlyReleaseWeekdays(policy, candidate, startDate) {
  const weekIndex = getReleaseCycleWeekIndex(candidate, startDate);
  if (weekIndex < 0) return [];
  return weekIndex % 2 === 0
    ? policy.selected_weekdays_week_1
    : policy.selected_weekdays_week_2;
}

export function deriveNextPersonalisedAutomationRelease(rawPolicy = null, { from = new Date() } = {}) {
  const policy = normalizePersonalisedAutomationPolicy(rawPolicy, { today: from });
  const startDate = parseLocalDate(policy.start_date) || startOfDay(from);
  const endDate = parseLocalDate(policy.end_date);
  let scanDate = addDays(startOfDay(from), 1);
  if (scanDate < startDate) scanDate = startDate;

  for (let offset = 0; offset < 400; offset += 1) {
    const candidate = addDays(scanDate, offset);
    if (endDate && candidate > endDate) break;
    const candidateWeekday = getWeekdayValue(candidate);
    if (policy.frequency === "fortnightly") {
      if (!getFortnightlyReleaseWeekdays(policy, candidate, startDate).includes(candidateWeekday)) continue;
    } else if (!policy.selected_weekdays.includes(candidateWeekday)) {
      continue;
    }
    return candidate;
  }

  return null;
}

export function derivePersonalisedAutomationDeadline(rawPolicy = null, { from = new Date() } = {}) {
  const policy = normalizePersonalisedAutomationPolicy(rawPolicy, { today: from });
  const today = startOfDay(from);
  const endDate = parseLocalDate(policy.end_date);
  const nextRelease = deriveNextPersonalisedAutomationRelease(policy, { from });
  let deadlineDay = nextRelease ? addDays(nextRelease, -1) : addDays(today, policy.frequency === "fortnightly" ? 13 : 6);

  if (deadlineDay < today) deadlineDay = today;
  if (endDate && deadlineDay > endDate) deadlineDay = endDate < today ? today : endDate;

  const deadline = endOfDay(deadlineDay);
  return {
    nextRelease,
    deadline,
    deadlineIso: deadline.toISOString(),
  };
}
