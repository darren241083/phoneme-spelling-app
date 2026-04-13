import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_GROUP_SIZE = 5;
const GROUP_TYPES = new Set(["pp", "sen", "gender"]);
const METRIC_ORDER = [
  "attainment_indicator",
  "accuracy_rate",
  "first_time_correct_rate",
  "completion_rate",
  "average_attempts_per_correct_word",
];

const PRIOR_MEAN = 0;
const PRIOR_VARIANCE = 1.25;
const THETA_MIN = -4;
const THETA_MAX = 4;
const REPORTING_SCALE_DIVISOR = 1.15;
const SECURE_THRESHOLD_LOGIT = 1.0986122886681098;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GroupType = "pp" | "sen" | "gender";
type MetricType =
  | "accuracy_rate"
  | "average_attempts_per_correct_word"
  | "first_time_correct_rate"
  | "completion_rate"
  | "attainment_indicator";

type ComparisonRequest = {
  groupType?: GroupType | string;
  filters?: {
    classId?: string | null;
    yearGroup?: string | null;
    testId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  };
  accessToken?: string | null;
};

type AssignmentRow = {
  id: string | null;
  class_id: string | null;
  test_id: string | null;
  created_at: string | null;
};

type MembershipRow = {
  class_id: string | null;
  pupil_id: string | null;
};

type GroupValueRow = {
  pupil_id: string | null;
  group_value: string | null;
};

type TestWordRow = {
  id: string | null;
  test_id: string | null;
  choice?: {
    difficulty?: {
      coreScore?: number | null;
      score?: number | null;
    } | null;
  } | null;
};

type AttemptRow = {
  assignment_id: string | null;
  pupil_id: string | null;
  test_word_id: string | null;
  assignment_target_id: string | null;
  correct: boolean | null;
  attempt_number: number | null;
  created_at: string | null;
};

type GroupInfo = {
  key: string;
  label: string;
  sortOrder: number;
};

type MetricDetail = {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  numeratorLabel: string;
  denominatorLabel: string;
  medianSecureDifficultyScore?: number | null;
  typicalAttainmentDescriptor?: string | null;
};

type ResponseGroup = {
  key: string;
  label: string;
  pupilCount: number | null;
  suppressed: boolean;
  metrics: Partial<Record<MetricType, number | null>>;
  metricDetails: Partial<Record<MetricType, MetricDetail>>;
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

function normalizeGroupType(value: unknown): GroupType | null {
  const key = String(value || "").trim().toLowerCase();
  return GROUP_TYPES.has(key) ? key as GroupType : null;
}

function round(value: number, digits = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function logistic(value: number) {
  if (value >= 0) {
    const exp = Math.exp(-value);
    return 1 / (1 + exp);
  }
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function logit(probability: number) {
  const p = clamp(Number(probability || 0), 0.0001, 0.9999);
  return Math.log(p / (1 - p));
}

function difficultyScoreToLogit(score: number) {
  const safe = clamp(Number(score || 50), 0, 100);
  return (safe - 50) / 18;
}

function difficultyLogitToScore(logitValue: number) {
  return 50 + (18 * Number(logitValue || 0));
}

function thetaToScale(theta: number) {
  return Math.round(logistic(Number(theta || 0) / REPORTING_SCALE_DIVISOR) * 100);
}

function getDifficultyBandKey(score: number | null) {
  const safe = clamp(Number(score || 0), 0, 100);
  if (safe >= 80) return "challenge";
  if (safe >= 60) return "stretch";
  if (safe >= 35) return "core";
  return "easier";
}

function getAttainmentDisplayLabel(key: string | null) {
  if (key === "challenge") return "Advanced patterns";
  if (key === "stretch") return "Expanding patterns";
  if (key === "core") return "Core patterns";
  if (key === "easier") return "Foundations";
  return "Not yet banded";
}

function median(values: number[]) {
  const ordered = [...values]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (!ordered.length) return null;

  const middleIndex = Math.floor(ordered.length / 2);
  if (ordered.length % 2) return round(ordered[middleIndex], 1);
  return round((ordered[middleIndex - 1] + ordered[middleIndex]) / 2, 1);
}

function chunkArray<T>(items: T[], size = 100) {
  const chunkSize = Math.max(1, Number(size) || 1);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = 500,
  maxPages = 20,
) {
  const rows: T[] = [];

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

function isTruthyValue(value: string) {
  return ["1", "true", "yes", "y", "pp", "pupil_premium"].includes(value);
}

function isFalsyValue(value: string) {
  return ["0", "false", "no", "n", "non_pp", "not_pp"].includes(value);
}

function normalizePpGroup(value: string): GroupInfo | null {
  if (isTruthyValue(value)) return { key: "pp", label: "PP", sortOrder: 0 };
  if (isFalsyValue(value)) return { key: "non_pp", label: "Non-PP", sortOrder: 1 };
  return null;
}

function normalizeSenGroup(value: string): GroupInfo | null {
  if (["ehcp", "education_health_care_plan", "ehc_plan"].includes(value)) {
    return { key: "ehcp", label: "EHCP", sortOrder: 3 };
  }
  if (["sen_support", "sen-support", "support"].includes(value)) {
    return { key: "sen_support", label: "SEN support", sortOrder: 2 };
  }
  if (["sen", "send", "true", "yes", "1"].includes(value)) {
    return { key: "sen", label: "SEN", sortOrder: 1 };
  }
  if (["none"].includes(value)) {
    return { key: "none", label: "No SEN", sortOrder: 0 };
  }
  if (["non_sen", "non-sen", "not_sen", "no_sen", "false", "no", "0"].includes(value)) {
    return { key: "non_sen", label: "Non-SEN", sortOrder: 0 };
  }
  return null;
}

function normalizeGenderGroup(value: string): GroupInfo | null {
  if (["female", "f", "girl", "girls"].includes(value)) {
    return { key: "female", label: "Female", sortOrder: 0 };
  }
  if (["male", "m", "boy", "boys"].includes(value)) {
    return { key: "male", label: "Male", sortOrder: 1 };
  }
  if (["non_binary", "non-binary", "nonbinary", "nb"].includes(value)) {
    return { key: "non_binary", label: "Non-binary", sortOrder: 2 };
  }
  if (["other"].includes(value)) {
    return { key: "other", label: "Other", sortOrder: 3 };
  }
  return null;
}

function normalizeGroupInfo(groupType: GroupType, rawValue: unknown): GroupInfo | null {
  const value = String(rawValue || "").trim().toLowerCase();
  if (!value) return null;

  if (groupType === "pp") return normalizePpGroup(value);
  if (groupType === "sen") return normalizeSenGroup(value);
  return normalizeGenderGroup(value);
}

function getNotRecordedGroup(): GroupInfo {
  return {
    key: "not_recorded",
    label: "Not recorded",
    sortOrder: 98,
  };
}

function getGroupTypeLabel(groupType: GroupType) {
  if (groupType === "pp") return "PP";
  if (groupType === "sen") return "SEN";
  return "gender";
}

function getMetricLabel(metric: MetricType) {
  if (metric === "accuracy_rate") return "accuracy";
  if (metric === "average_attempts_per_correct_word") return "average attempts per correct word";
  if (metric === "first_time_correct_rate") return "first-time correct rate";
  if (metric === "attainment_indicator") return "attainment indicator";
  return "completion rate";
}

function estimateAttainmentIndicator(rows: AttemptRow[], difficultyScoreByWordId: Map<string, number>) {
  const normalized = (rows || [])
    .map((item) => ({
      correct: !!item?.correct,
      difficultyScore: difficultyScoreByWordId.get(String(item?.test_word_id || "")) ?? 50,
      difficultyLogit: difficultyScoreToLogit(
        difficultyScoreByWordId.get(String(item?.test_word_id || "")) ?? 50,
      ),
    }))
    .filter((item) => Number.isFinite(item.difficultyLogit));

  if (!normalized.length) {
    return {
      score: null,
      secureDifficultyScore: null,
      responseCount: 0,
      attainmentBandKey: null,
      attainmentDisplayLabel: null,
    };
  }

  const correctCount = normalized.filter((item) => item.correct).length;
  const proportionCorrect = (correctCount + 0.5) / (normalized.length + 1);
  const meanDifficultyLogit = normalized.reduce((sum, item) => sum + item.difficultyLogit, 0) / normalized.length;
  let theta = clamp(logit(proportionCorrect) + meanDifficultyLogit, THETA_MIN, THETA_MAX);

  for (let iteration = 0; iteration < 12; iteration += 1) {
    let firstDerivative = 0;
    let secondDerivative = 0;

    for (const item of normalized) {
      const probability = logistic(theta - item.difficultyLogit);
      firstDerivative += Number(item.correct) - probability;
      secondDerivative -= probability * (1 - probability);
    }

    firstDerivative -= (theta - PRIOR_MEAN) / PRIOR_VARIANCE;
    secondDerivative -= 1 / PRIOR_VARIANCE;

    if (!Number.isFinite(firstDerivative) || !Number.isFinite(secondDerivative) || Math.abs(secondDerivative) < 0.000001) {
      break;
    }

    const nextTheta = clamp(theta - (firstDerivative / secondDerivative), THETA_MIN, THETA_MAX);
    if (Math.abs(nextTheta - theta) < 0.0001) {
      theta = nextTheta;
      break;
    }
    theta = nextTheta;
  }

  const secureDifficultyLogit = theta - SECURE_THRESHOLD_LOGIT;
  const secureDifficultyScore = clamp(difficultyLogitToScore(secureDifficultyLogit), 0, 100);
  const attainmentBandKey = normalized.length >= 4 ? getDifficultyBandKey(secureDifficultyScore) : null;

  return {
    score: thetaToScale(theta),
    secureDifficultyScore: round(secureDifficultyScore, 1),
    responseCount: normalized.length,
    attainmentBandKey,
    attainmentDisplayLabel: attainmentBandKey ? getAttainmentDisplayLabel(attainmentBandKey) : null,
  };
}

function estimateAttainmentIndicatorScore(rows: AttemptRow[], difficultyScoreByWordId: Map<string, number>) {
  return estimateAttainmentIndicator(rows, difficultyScoreByWordId).score;
}

function buildDateRange(dateFrom?: string | null, dateTo?: string | null) {
  const normalizedFrom = String(dateFrom || "").trim();
  const normalizedTo = String(dateTo || "").trim();
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/;

  if (normalizedFrom && !isIsoDate.test(normalizedFrom)) {
    throw new Error("Date from must use YYYY-MM-DD format.");
  }
  if (normalizedTo && !isIsoDate.test(normalizedTo)) {
    throw new Error("Date to must use YYYY-MM-DD format.");
  }
  if (normalizedFrom && normalizedTo && normalizedFrom > normalizedTo) {
    throw new Error("Date from cannot be later than date to.");
  }

  return {
    dateFrom: normalizedFrom ? `${normalizedFrom}T00:00:00.000Z` : "",
    dateTo: normalizedTo ? `${normalizedTo}T23:59:59.999Z` : "",
    inputDateFrom: normalizedFrom,
    inputDateTo: normalizedTo,
  };
}

function isUuid(value: string | null | undefined) {
  return UUID_PATTERN.test(String(value || "").trim());
}

async function resolveVisibleClassIds(
  serviceClient: ReturnType<typeof createClient>,
  teacherId: string,
  {
    classId = "",
    yearGroup = "",
  }: {
    classId?: string;
    yearGroup?: string;
  },
) {
  const { data, error } = await serviceClient.rpc("list_viewable_class_ids", {
    requested_user_id: teacherId,
    requested_class_id: classId || null,
    requested_year_group: yearGroup || null,
    requested_department_key: null,
  });

  if (error) throw error;
  return Array.isArray(data)
    ? data.map((item) => String(item || "")).filter(Boolean)
    : [];
}

function dedupeLatestGroupRows(rows: Array<GroupValueRow & { updated_at?: string | null; created_at?: string | null }>) {
  const latestByPupilId = new Map<string, GroupValueRow>();

  for (const row of rows || []) {
    const pupilId = String(row?.pupil_id || "");
    if (!pupilId || latestByPupilId.has(pupilId)) continue;
    latestByPupilId.set(pupilId, {
      pupil_id: row?.pupil_id || null,
      group_value: row?.group_value || null,
    });
  }

  return Array.from(latestByPupilId.values());
}

function buildSelectedPupilIdsByClass(memberships: MembershipRow[]) {
  const pupilIdsByClass = new Map<string, string[]>();
  const selectedPupilIds = new Set<string>();

  for (const membership of memberships || []) {
    const classId = String(membership?.class_id || "");
    const pupilId = String(membership?.pupil_id || "");
    if (!classId || !pupilId) continue;

    const next = pupilIdsByClass.get(classId) || [];
    if (!next.includes(pupilId)) next.push(pupilId);
    pupilIdsByClass.set(classId, next);
    selectedPupilIds.add(pupilId);
  }

  return {
    pupilIdsByClass,
    selectedPupilIds: Array.from(selectedPupilIds),
  };
}

function buildGroupBuckets({
  groupType,
  selectedPupilIds,
  groupRows,
}: {
  groupType: GroupType;
  selectedPupilIds: string[];
  groupRows: GroupValueRow[];
}) {
  const groupValueByPupilId = new Map<string, string>();
  for (const row of groupRows || []) {
    const pupilId = String(row?.pupil_id || "");
    const value = String(row?.group_value || "");
    if (!pupilId) continue;
    groupValueByPupilId.set(pupilId, value);
  }

  const groupsByKey = new Map<string, { info: GroupInfo; pupilIds: Set<string> }>();

  for (const pupilId of selectedPupilIds) {
    const info = normalizeGroupInfo(groupType, groupValueByPupilId.get(pupilId)) || getNotRecordedGroup();
    const bucket = groupsByKey.get(info.key) || {
      info,
      pupilIds: new Set<string>(),
    };
    bucket.pupilIds.add(pupilId);
    groupsByKey.set(info.key, bucket);
  }

  return Array.from(groupsByKey.values())
    .map((bucket) => ({
      key: bucket.info.key,
      label: bucket.info.label,
      sortOrder: bucket.info.sortOrder,
      pupilIds: Array.from(bucket.pupilIds),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

function buildLatestAttemptState({
  attempts,
  assignments,
  validWordIdsByTestId,
}: {
  attempts: AttemptRow[];
  assignments: AssignmentRow[];
  validWordIdsByTestId: Map<string, Set<string>>;
}) {
  const assignmentById = new Map(
    (assignments || []).map((assignment) => [String(assignment?.id || ""), assignment]),
  );
  const latestByAssignmentPupilWord = new Map<string, AttemptRow>();

  for (const attempt of attempts || []) {
    const assignmentId = String(attempt?.assignment_id || "");
    const pupilId = String(attempt?.pupil_id || "");
    const testWordId = String(attempt?.test_word_id || "");
    if (!assignmentId || !pupilId || !testWordId) continue;
    if (attempt?.assignment_target_id) continue;

    const assignment = assignmentById.get(assignmentId);
    const testId = String(assignment?.test_id || "");
    const validWordIds = validWordIdsByTestId.get(testId);
    if (validWordIds && !validWordIds.has(testWordId)) continue;

    latestByAssignmentPupilWord.set(`${assignmentId}::${pupilId}::${testWordId}`, attempt);
  }

  const latestRows = Array.from(latestByAssignmentPupilWord.values());
  const latestRowsByAssignmentPupil = new Map<string, AttemptRow[]>();

  for (const row of latestRows) {
    const assignmentId = String(row?.assignment_id || "");
    const pupilId = String(row?.pupil_id || "");
    if (!assignmentId || !pupilId) continue;

    const key = `${assignmentId}::${pupilId}`;
    const next = latestRowsByAssignmentPupil.get(key) || [];
    next.push(row);
    latestRowsByAssignmentPupil.set(key, next);
  }

  return {
    latestRows,
    latestRowsByAssignmentPupil,
  };
}

function buildAssignmentSlots({
  assignments,
  pupilIdsByClass,
  wordCountByTestId,
}: {
  assignments: AssignmentRow[];
  pupilIdsByClass: Map<string, string[]>;
  wordCountByTestId: Map<string, number>;
}) {
  const slots: Array<{ assignmentId: string; pupilId: string; totalWords: number }> = [];

  for (const assignment of assignments || []) {
    const assignmentId = String(assignment?.id || "");
    const classId = String(assignment?.class_id || "");
    const testId = String(assignment?.test_id || "");
    if (!assignmentId || !classId || !testId) continue;

    const totalWords = Math.max(0, Number(wordCountByTestId.get(testId) || 0));
    if (!totalWords) continue;

    const rosterPupilIds = pupilIdsByClass.get(classId) || [];
    for (const pupilId of rosterPupilIds) {
      if (!pupilId) continue;
      slots.push({
        assignmentId,
        pupilId,
        totalWords,
      });
    }
  }

  return slots;
}

function calculateMetricDetail({
  metric,
  pupilIds,
  latestRows,
  latestRowsByAssignmentPupil,
  assignmentSlots,
  difficultyScoreByWordId,
}: {
  metric: MetricType;
  pupilIds: string[];
  latestRows: AttemptRow[];
  latestRowsByAssignmentPupil: Map<string, AttemptRow[]>;
  assignmentSlots: Array<{ assignmentId: string; pupilId: string; totalWords: number }>;
  difficultyScoreByWordId: Map<string, number>;
}) {
  const pupilIdSet = new Set((pupilIds || []).map((item) => String(item || "")).filter(Boolean));

  if (metric === "accuracy_rate") {
    const relevantRows = (latestRows || []).filter((row) =>
      pupilIdSet.has(String(row?.pupil_id || ""))
    );
    if (!relevantRows.length) {
      return {
        value: null,
        numerator: null,
        denominator: null,
        numeratorLabel: "correct words",
        denominatorLabel: "checked words",
      };
    }

    const correctCount = relevantRows.filter((row) => !!row?.correct).length;
    return {
      value: round(correctCount / relevantRows.length),
      numerator: correctCount,
      denominator: relevantRows.length,
      numeratorLabel: "correct words",
      denominatorLabel: "checked words",
    };
  }

  if (metric === "average_attempts_per_correct_word") {
    const correctRows = (latestRows || []).filter((row) =>
      pupilIdSet.has(String(row?.pupil_id || "")) && !!row?.correct
    );
    if (!correctRows.length) {
      return {
        value: null,
        numerator: null,
        denominator: null,
        numeratorLabel: "attempts",
        denominatorLabel: "correct words",
      };
    }

    const totalAttempts = correctRows.reduce(
      (sum, row) => sum + Math.max(1, Number(row?.attempt_number || 1)),
      0,
    );
    return {
      value: round(totalAttempts / correctRows.length),
      numerator: totalAttempts,
      denominator: correctRows.length,
      numeratorLabel: "attempts",
      denominatorLabel: "correct words",
    };
  }

  if (metric === "first_time_correct_rate") {
    const relevantRows = (latestRows || []).filter((row) =>
      pupilIdSet.has(String(row?.pupil_id || ""))
    );
    if (!relevantRows.length) {
      return {
        value: null,
        numerator: null,
        denominator: null,
        numeratorLabel: "first-time correct words",
        denominatorLabel: "checked words",
      };
    }

    const firstTimeCorrectCount = relevantRows.filter((row) =>
      !!row?.correct && Math.max(1, Number(row?.attempt_number || 1)) === 1
    ).length;
    return {
      value: round(firstTimeCorrectCount / relevantRows.length),
      numerator: firstTimeCorrectCount,
      denominator: relevantRows.length,
      numeratorLabel: "first-time correct words",
      denominatorLabel: "checked words",
    };
  }

  if (metric === "attainment_indicator") {
    const rowsByPupil = new Map<string, AttemptRow[]>();
    for (const row of latestRows || []) {
      const pupilId = String(row?.pupil_id || "");
      if (!pupilIdSet.has(pupilId)) continue;
      const next = rowsByPupil.get(pupilId) || [];
      next.push(row);
      rowsByPupil.set(pupilId, next);
    }

    const indicators = Array.from(rowsByPupil.values())
      .map((rows) => estimateAttainmentIndicator(rows, difficultyScoreByWordId));
    const scores = indicators
      .map((item) => item?.score)
      .filter((value) => Number.isFinite(Number(value)))
      .map((value) => Number(value));
    const medianSecureDifficultyScore = median(
      indicators
        .map((item) => item?.attainmentBandKey ? item?.secureDifficultyScore : null)
        .filter((value) => Number.isFinite(Number(value)))
        .map((value) => Number(value)),
    );
    const typicalAttainmentDescriptor = medianSecureDifficultyScore == null
      ? null
      : getAttainmentDisplayLabel(getDifficultyBandKey(medianSecureDifficultyScore));

    if (!scores.length) {
      return {
        value: null,
        numerator: 0,
        denominator: pupilIdSet.size || null,
        numeratorLabel: "pupils with indicator evidence",
        denominatorLabel: "pupils in group",
        medianSecureDifficultyScore,
        typicalAttainmentDescriptor,
      };
    }

    const totalScore = scores.reduce((sum, value) => sum + value, 0);
    return {
      value: round(totalScore / scores.length, 1),
      numerator: scores.length,
      denominator: pupilIdSet.size,
      numeratorLabel: "pupils with indicator evidence",
      denominatorLabel: "pupils in group",
      medianSecureDifficultyScore,
      typicalAttainmentDescriptor,
    };
  }

  const relevantSlots = (assignmentSlots || []).filter((slot) => pupilIdSet.has(String(slot?.pupilId || "")));
  if (!relevantSlots.length) {
    return {
      value: null,
      numerator: null,
      denominator: null,
      numeratorLabel: "completed assignments",
      denominatorLabel: "assigned pupil slots",
    };
  }

  const completedCount = relevantSlots.reduce((count, slot) => {
    const rows = latestRowsByAssignmentPupil.get(`${slot.assignmentId}::${slot.pupilId}`) || [];
    return count + (rows.length >= slot.totalWords ? 1 : 0);
  }, 0);

  return {
    value: round(completedCount / relevantSlots.length),
    numerator: completedCount,
    denominator: relevantSlots.length,
    numeratorLabel: "completed assignments",
    denominatorLabel: "assigned pupil slots",
  };
}

function buildGap(metric: MetricType, groups: Array<ResponseGroup & { comparable: boolean }>) {
  const comparableGroups = groups
    .filter((group) => group.comparable && !group.suppressed && Number.isFinite(Number(group.metricValue)))
    .sort((a, b) => Number(a.metricValue || 0) - Number(b.metricValue || 0));

  if (comparableGroups.length < 2) return null;

  const lowerGroup = comparableGroups[0];
  const higherGroup = comparableGroups[comparableGroups.length - 1];
  const absolute = Math.abs(Number(higherGroup.metricValue || 0) - Number(lowerGroup.metricValue || 0));

  return {
    absolute: round(absolute),
    higherGroupKey: higherGroup.key,
    higherGroupLabel: higherGroup.label,
    lowerGroupKey: lowerGroup.key,
    lowerGroupLabel: lowerGroup.label,
    metric,
  };
}

function buildInsight({
  groupType,
  metric,
  groups,
  gap,
  comparisonSuppressed,
  hasRecordedGroupData,
}: {
  groupType: GroupType;
  metric: MetricType;
  groups: Array<ResponseGroup & { comparable: boolean }>;
  gap: ReturnType<typeof buildGap>;
  comparisonSuppressed: boolean;
  hasRecordedGroupData: boolean;
}) {
  if (!groups.length) {
    return "No group data is available for this selection yet.";
  }

  if (!hasRecordedGroupData) {
    return "No recorded group data is available for this selection yet.";
  }

  if (comparisonSuppressed) {
    return "No result shown because one or more groups are below the minimum cohort size.";
  }

  const comparableVisibleGroups = groups.filter((group) =>
    group.comparable && !group.suppressed && Number.isFinite(Number(group.metricValue))
  );

  if (comparableVisibleGroups.length < 2 || !gap) {
    return "Not enough recorded group data is available for comparison in this selection.";
  }

  const smallGapThreshold = metric === "average_attempts_per_correct_word" ? 0.05 : 0.02;
  const threshold = metric === "attainment_indicator" ? 2 : smallGapThreshold;
  if (gap.absolute < threshold) {
    return `No clear difference is visible for ${getMetricLabel(metric)} in this selection.`;
  }

  if (comparableVisibleGroups.length > 2) {
    return `A difference is visible across the displayed ${getGroupTypeLabel(groupType)} groups for ${getMetricLabel(metric)} in this selection.`;
  }

  if (metric === "average_attempts_per_correct_word") {
    return `${gap.higherGroupLabel} pupils show a higher average number of attempts per correct word than ${gap.lowerGroupLabel} pupils in this selection.`;
  }

  if (metric === "completion_rate") {
    return `${gap.higherGroupLabel} pupils show a higher completion rate than ${gap.lowerGroupLabel} pupils in this selection.`;
  }

  if (metric === "accuracy_rate") {
    return `A difference is visible between ${gap.higherGroupLabel} and ${gap.lowerGroupLabel} pupils for accuracy in this selection.`;
  }

  if (metric === "attainment_indicator") {
    return `A difference is visible between ${gap.higherGroupLabel} and ${gap.lowerGroupLabel} pupils for the attainment indicator in this selection.`;
  }

  return `A difference is visible between ${gap.higherGroupLabel} and ${gap.lowerGroupLabel} pupils for first-time correct rate in this selection.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Supabase environment variables are not configured.");
    }

    const body = await req.json() as ComparisonRequest;
    const groupType = normalizeGroupType(body?.groupType);

    if (!groupType) {
      return json({ error: "A valid group type is required." }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? String(authHeader.slice(7) || "").trim()
      : "";
    const accessToken = String(body?.accessToken || "").trim();
    const jwt = bearerToken || accessToken;

    if (!jwt) {
      return json({ error: "Teacher authentication is required for group comparison." }, 401);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
    const teacherId = String(authData?.user?.id || "");

    if (authError || !teacherId) {
      return json({ error: "Your teacher session could not be verified. Please sign in again." }, 401);
    }

    const rawFilters = body?.filters || {};
    const classId = String(rawFilters?.classId || "").trim();
    const yearGroup = String(rawFilters?.yearGroup || "").trim();
    const testId = String(rawFilters?.testId || "").trim();
    const dateRange = buildDateRange(rawFilters?.dateFrom, rawFilters?.dateTo);

    if (classId && !isUuid(classId)) {
      return json({ error: "Class filter must be a valid class id." }, 400);
    }
    if (testId && !isUuid(testId)) {
      return json({ error: "Test filter must be a valid test id." }, 400);
    }

    const classIds = await resolveVisibleClassIds(serviceClient, teacherId, {
      classId,
      yearGroup,
    });

    if (!classIds.length) {
      return json({
        groupType,
        minimumGroupSize: MIN_GROUP_SIZE,
        filters: {
          classId,
          yearGroup,
          testId,
          dateFrom: dateRange.inputDateFrom,
          dateTo: dateRange.inputDateTo,
        },
        metricOrder: METRIC_ORDER,
        metricSummaries: [],
        groups: [],
        insight: "No group data is available for this selection yet.",
      });
    }

    const assignments = await fetchAllRows<AssignmentRow>(
      async (from, to) => {
        let query = serviceClient
          .from("assignments_v2")
          .select("id, class_id, test_id, created_at")
          .in("class_id", classIds)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (testId) {
          query = query.eq("test_id", testId);
        }
        if (dateRange.dateFrom) {
          query = query.gte("created_at", dateRange.dateFrom);
        }
        if (dateRange.dateTo) {
          query = query.lte("created_at", dateRange.dateTo);
        }

        return await query;
      },
      250,
      16,
    );

    const assignmentIds = assignments
      .map((item) => String(item?.id || ""))
      .filter(Boolean);

    if (!assignmentIds.length) {
      return json({
        groupType,
        minimumGroupSize: MIN_GROUP_SIZE,
        filters: {
          classId,
          yearGroup,
          testId,
          dateFrom: dateRange.inputDateFrom,
          dateTo: dateRange.inputDateTo,
        },
        metricOrder: METRIC_ORDER,
        metricSummaries: [],
        groups: [],
        insight: "No group data is available for this selection yet.",
      });
    }

    const assignmentClassIds = Array.from(new Set(
      assignments.map((item) => String(item?.class_id || "")).filter(Boolean),
    ));
    const testIds = Array.from(new Set(
      assignments.map((item) => String(item?.test_id || "")).filter(Boolean),
    ));

    const memberships = assignmentClassIds.length
      ? await fetchAllRows<MembershipRow>(
        async (from, to) => await serviceClient
          .from("pupil_classes")
          .select("class_id, pupil_id")
          .in("class_id", assignmentClassIds)
          .eq("active", true)
          .order("class_id", { ascending: true })
          .range(from, to),
        500,
        20,
      )
      : [];

    const { pupilIdsByClass, selectedPupilIds } = buildSelectedPupilIdsByClass(memberships);
    if (!selectedPupilIds.length) {
      return json({
        groupType,
        minimumGroupSize: MIN_GROUP_SIZE,
        filters: {
          classId,
          yearGroup,
          testId,
          dateFrom: dateRange.inputDateFrom,
          dateTo: dateRange.inputDateTo,
        },
        metricOrder: METRIC_ORDER,
        metricSummaries: [],
        groups: [],
        insight: "No group data is available for this selection yet.",
      });
    }

    const rawGroupRows: Array<GroupValueRow & { updated_at?: string | null; created_at?: string | null }> = [];
    for (const chunk of chunkArray(selectedPupilIds, 200)) {
      const { data, error } = await serviceClient
        .from("teacher_pupil_group_values")
        .select("pupil_id, group_value, updated_at, created_at")
        .eq("group_type", groupType)
        .in("pupil_id", chunk);

      if (error) throw error;
      rawGroupRows.push(...(data || []));
    }
    rawGroupRows.sort((a, b) => {
      const aTime = Date.parse(a?.updated_at || a?.created_at || "") || 0;
      const bTime = Date.parse(b?.updated_at || b?.created_at || "") || 0;
      return bTime - aTime;
    });
    const groupRows = dedupeLatestGroupRows(rawGroupRows);

    const testWords: TestWordRow[] = [];
    for (const chunk of chunkArray(testIds, 200)) {
      const { data, error } = await serviceClient
        .from("test_words")
        .select("id, test_id, choice")
        .in("test_id", chunk);

      if (error) throw error;
      testWords.push(...(data || []));
    }

    const validWordIdsByTestId = new Map<string, Set<string>>();
    const wordCountByTestId = new Map<string, number>();
    for (const word of testWords) {
      const nextTestId = String(word?.test_id || "");
      const wordId = String(word?.id || "");
      if (!nextTestId || !wordId) continue;

      const validWordIds = validWordIdsByTestId.get(nextTestId) || new Set<string>();
      validWordIds.add(wordId);
      validWordIdsByTestId.set(nextTestId, validWordIds);
      wordCountByTestId.set(nextTestId, validWordIds.size);
    }

    const difficultyScoreByWordId = new Map<string, number>();
    for (const word of testWords) {
      const wordId = String(word?.id || "");
      if (!wordId) continue;
      const storedScore = Number(word?.choice?.difficulty?.coreScore ?? word?.choice?.difficulty?.score);
      difficultyScoreByWordId.set(
        wordId,
        Number.isFinite(storedScore) ? clamp(storedScore, 0, 100) : 50,
      );
    }

    const attempts: AttemptRow[] = [];
    for (const chunk of chunkArray(assignmentIds, 100)) {
      const rows = await fetchAllRows<AttemptRow>(
        async (from, to) => {
          let query = serviceClient
            .from("attempts")
            .select("assignment_id, pupil_id, test_word_id, assignment_target_id, correct, attempt_number, created_at")
            .in("assignment_id", chunk)
            .order("created_at", { ascending: true })
            .range(from, to);

          if (dateRange.dateFrom) {
            query = query.gte("created_at", dateRange.dateFrom);
          }
          if (dateRange.dateTo) {
            query = query.lte("created_at", dateRange.dateTo);
          }

          return await query;
        },
        1000,
        20,
      );
      attempts.push(...rows);
    }

    const { latestRows, latestRowsByAssignmentPupil } = buildLatestAttemptState({
      attempts,
      assignments,
      validWordIdsByTestId,
    });

    const assignmentSlots = buildAssignmentSlots({
      assignments,
      pupilIdsByClass,
      wordCountByTestId,
    });

    const buckets = buildGroupBuckets({
      groupType,
      selectedPupilIds,
      groupRows,
    });

    const hasRecordedGroupData = buckets.some((bucket) => bucket.key !== "not_recorded");

    // Compliance note: this endpoint only returns aggregated teacher-view analytics.
    // It never returns pupil-level rows, suppresses any comparable subgroup below the
    // minimum cohort size, and keeps the insight text descriptive for internal use only.
    const groupsWithMetrics = buckets.map((bucket) => {
      const pupilCount = bucket.pupilIds.length;
      const suppressed = pupilCount < MIN_GROUP_SIZE;
      const metricDetails = Object.fromEntries(
        METRIC_ORDER.map((metricKey) => {
          const detail = suppressed
            ? {
              value: null,
              numerator: null,
              denominator: null,
              numeratorLabel: "",
              denominatorLabel: "",
            }
            : calculateMetricDetail({
              metric: metricKey as MetricType,
              pupilIds: bucket.pupilIds,
              latestRows,
              latestRowsByAssignmentPupil,
              assignmentSlots,
              difficultyScoreByWordId,
            });

          return [metricKey, detail];
        }),
      ) as Partial<Record<MetricType, MetricDetail>>;
      const metrics = Object.fromEntries(
        METRIC_ORDER.map((metricKey) => [metricKey, metricDetails[metricKey as MetricType]?.value ?? null]),
      ) as Partial<Record<MetricType, number | null>>;

      return {
        key: bucket.key,
        label: bucket.label,
        pupilCount: suppressed ? null : pupilCount,
        suppressed,
        metrics,
        metricDetails,
        comparable: bucket.key !== "not_recorded",
      };
    });

    const metricSummaries = METRIC_ORDER.map((metricKey) => {
      const metricGroups = groupsWithMetrics.map((group) => ({
        ...group,
        metricValue: group.metrics[metricKey as MetricType] ?? null,
      }));
      const comparisonSuppressed = metricGroups.some((group) => group.comparable && group.suppressed);
      const gap = comparisonSuppressed ? null : buildGap(metricKey as MetricType, metricGroups);
      const insight = buildInsight({
        groupType,
        metric: metricKey as MetricType,
        groups: metricGroups,
        gap,
        comparisonSuppressed,
        hasRecordedGroupData,
      });

      return {
        metric: metricKey,
        label: getMetricLabel(metricKey as MetricType),
        gap,
        comparisonSuppressed,
        insight,
      };
    });

    const defaultInsight = metricSummaries.find((item) => !item.comparisonSuppressed && item.gap)?.insight
      || metricSummaries[0]?.insight
      || "No group data is available for this selection yet.";

    return json({
      groupType,
      minimumGroupSize: MIN_GROUP_SIZE,
      filters: {
        classId,
        yearGroup,
        testId,
        dateFrom: dateRange.inputDateFrom,
        dateTo: dateRange.inputDateTo,
      },
      metricOrder: METRIC_ORDER,
      metricSummaries,
      groups: groupsWithMetrics.map(({ comparable, ...group }) => group),
      insight: defaultInsight,
    });
  } catch (error) {
    console.error("group-comparison error", error);
    return json({
      error: error instanceof Error ? error.message : "Could not build group comparison.",
    }, 500);
  }
});
