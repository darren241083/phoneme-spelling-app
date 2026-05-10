import {
  ASSIGNMENT_ENGINE_TARGET_SOURCE,
  buildAssignmentEngineTitle,
  buildAssignmentEngineWordPayload,
  buildAssignmentEngineWordSignature,
  buildGeneratedAssignmentPlan,
  buildProfileFromAttempts,
} from "./pure/assignmentEngine.js";
import {
  buildPlacementSeedProfiles,
  buildStarterCatalogVirtualTests,
  isBaselineAssignmentWordRows,
  mergePlacementWithLiveProfiles,
  resolveBaselinePresetFromWordRows,
} from "./pure/baselinePlacement.js";
import { normalizeAutoAssignPolicy } from "./pure/autoAssignPolicy.js";
import { getQuestionEvidenceTier } from "./pure/questionTypes.js";

export const AUTOMATION_KIND_PERSONALISED = "personalised";
export const AUTOMATION_SOURCE_MANUAL_RUN_NOW = "manual_run_now";
export const WORDLOOM_CORE_WORD_TABLE = "wordloom_core_words";
export const WORDLOOM_CORE_WORD_TARGET_TABLE = "wordloom_core_word_targets";
export const WORDLOOM_CORE_FOCUS_TARGET_TABLE = "wordloom_core_focus_targets";

const BASELINE_LIVE_INDEPENDENT_MIN_ATTEMPTS = 4;
const PUBLIC_STATUSES = new Set([
  "invalid_pupil",
  "not_ready",
  "nothing_waiting",
  "already_active",
  "already_provisioning",
  "provisioned",
  "generation_failed",
]);

export function normalizeId(value = "") {
  return String(value || "").trim();
}

export function normalizeIdList(items = []) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => normalizeId(item))
      .filter(Boolean)
  )];
}

export function buildPublicProvisioningResponse({ status = "", assignmentId = "" } = {}) {
  const cleanStatus = String(status || "").trim().toLowerCase();
  const response = {
    status: PUBLIC_STATUSES.has(cleanStatus) ? cleanStatus : "generation_failed",
  };
  const cleanAssignmentId = normalizeId(assignmentId);
  if (response.status === "provisioned" && cleanAssignmentId) {
    response.assignmentId = cleanAssignmentId;
  }
  return response;
}

export function buildProvisioningPolicy(runRow = null) {
  return normalizeAutoAssignPolicy({
    assignment_length: runRow?.assignment_length,
    support_preset: runRow?.support_preset,
    allow_starter_fallback: runRow?.allow_starter_fallback,
  });
}

export function buildAutoAssignedPoolEntries(pupilPlans) {
  const poolBySignature = new Map();

  for (const plan of Array.isArray(pupilPlans) ? pupilPlans : []) {
    for (const wordSpec of Array.isArray(plan?.words) ? plan.words : []) {
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

export function buildAutoAssignedPoolIdMap(insertedRows) {
  const rows = Array.isArray(insertedRows) ? insertedRows : [];
  return new Map(rows.map((row) => ([
    buildAssignmentEngineWordSignature({
      word: row?.word,
      sentence: row?.sentence,
      segments: normalizeLoadedSegments(row?.segments),
      assignmentRole: row?.choice?.assignment_role,
      assignmentSupport: row?.choice?.assignment_support,
      focusGrapheme: row?.choice?.engine_focus_grapheme || row?.choice?.focus_graphemes?.[0] || "",
      questionType: row?.choice?.question_type,
    }),
    normalizeId(row?.id),
  ])));
}

export function buildAutoAssignedTargetRows({
  teacherId = "",
  assignmentId = "",
  assignmentCreatedAt = "",
  pupilPlans = [],
  poolIdBySignature = new Map(),
  schoolId = "",
} = {}) {
  const baseMs = new Date(assignmentCreatedAt || new Date().toISOString()).getTime();
  let sequence = 0;

  return (Array.isArray(pupilPlans) ? pupilPlans : []).flatMap((plan) =>
    (Array.isArray(plan?.words) ? plan.words : []).map((wordSpec) => {
      const signature = buildAssignmentEngineWordSignature(wordSpec);
      const testWordId = poolIdBySignature.get(signature) || "";
      const createdAt = new Date(baseMs + sequence * 1000).toISOString();
      sequence += 1;
      return {
        teacher_id: normalizeId(teacherId),
        assignment_id: normalizeId(assignmentId),
        pupil_id: normalizeId(plan?.pupilId),
        test_word_id: normalizeId(testWordId),
        focus_grapheme: String(wordSpec?.focusGrapheme || "").trim().toLowerCase() || null,
        target_source: ASSIGNMENT_ENGINE_TARGET_SOURCE,
        target_reason: String(wordSpec?.targetReason || "target_independent"),
        created_at: createdAt,
        school_id: normalizeId(schoolId) || null,
      };
    }).filter((row) => row.teacher_id && row.assignment_id && row.pupil_id && row.test_word_id)
  );
}

export function buildPupilWordCountByPupil(pupilPlans = []) {
  return Object.fromEntries(
    (Array.isArray(pupilPlans) ? pupilPlans : [])
      .map((plan) => {
        const pupilId = normalizeId(plan?.pupilId);
        return pupilId ? [pupilId, Math.max(0, Number(plan?.words?.length || 0))] : null;
      })
      .filter(Boolean)
  );
}

export function buildAssignmentTitle({ className = "", focusGrapheme = "" } = {}) {
  return buildAssignmentEngineTitle({
    className: className || "Class",
    focusGrapheme,
    date: new Date(),
  });
}

export function isCompletedAssignmentStatusRow(row) {
  return !!(row?.completed_at || row?.completedAt)
    || String(row?.status || "").trim().toLowerCase() === "completed";
}

export function buildBaselineAssignmentMetaMap(assignments) {
  return new Map(
    (Array.isArray(assignments) ? assignments : [])
      .filter((assignment) => assignment?.id)
      .map((assignment) => {
        const test = toSingleRow(assignment?.test) || toSingleRow(assignment?.tests) || null;
        return [
          normalizeId(assignment.id),
          {
            preset: resolveBaselinePresetFromWordRows(test?.test_words || []),
          },
        ];
      })
  );
}

export function isBaselineAttemptRow(attempt, baselineAssignmentMetaById) {
  const attemptSource = String(attempt?.attempt_source || attempt?.attemptSource || "").trim().toLowerCase();
  if (attemptSource === "baseline") return true;
  const assignmentId = normalizeId(attempt?.assignment_id || attempt?.assignmentId);
  return !!assignmentId && baselineAssignmentMetaById instanceof Map && baselineAssignmentMetaById.has(assignmentId);
}

export function isPracticeAttemptRow(attempt) {
  return String(attempt?.attempt_source || attempt?.attemptSource || "").trim().toLowerCase() === "practice";
}

export function getIndependentAttemptRows(attempts) {
  return (Array.isArray(attempts) ? attempts : [])
    .filter((attempt) => getQuestionEvidenceTier(attempt?.mode) === "independent");
}

export function buildPlacementCurrentProfiles({
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

  for (const pupilId of normalizeIdList(pupilIds)) {
    const placementProfile = placementSeedProfiles[pupilId];
    if (!placementProfile) continue;

    const pupilAttempts = (Array.isArray(attempts) ? attempts : [])
      .filter((attempt) => normalizeId(attempt?.pupil_id) === pupilId);
    const liveAttempts = pupilAttempts
      .filter((attempt) => !isBaselineAttemptRow(attempt, baselineAssignmentMetaById) && !isPracticeAttemptRow(attempt));
    const liveIndependentAttempts = getIndependentAttemptRows(liveAttempts);
    if (liveIndependentAttempts.length >= BASELINE_LIVE_INDEPENDENT_MIN_ATTEMPTS) continue;

    const liveIndependentProfile = liveIndependentAttempts.length
      ? buildProfileFromAttempts(liveIndependentAttempts, resolvedWordMap)
      : null;
    currentProfiles[pupilId] = mergePlacementWithLiveProfiles(liveIndependentProfile, placementProfile);
  }

  return currentProfiles;
}

export function needsStarterCatalogFallback(plan, pupilIds) {
  return !!plan?.error
    || !plan?.pupilPlans?.length
    || plan.pupilPlans.length < Math.max(0, Number((pupilIds || []).length || 0));
}

export function filterBaselineAssignments(assignments = []) {
  return (Array.isArray(assignments) ? assignments : [])
    .map((assignment) => ({
      ...assignment,
      test: toSingleRow(assignment?.test) || toSingleRow(assignment?.tests) || null,
    }))
    .filter((assignment) => isBaselineAssignmentWordRows(assignment?.test?.test_words || []));
}

export function buildProvisioningPlan({
  pupilId = "",
  teacherTests = [],
  attemptRows = [],
  baselineAssignments = [],
  baselineStatusRows = [],
  wordloomCoreWordRows = [],
  policy = null,
  resolvedWordMap = null,
} = {}) {
  const safePupilId = normalizeId(pupilId);
  const effectivePolicy = normalizeAutoAssignPolicy(policy);
  if (!safePupilId) throw new Error("A pupil id is required to build a provisioning plan.");

  const safeBaselineAssignments = filterBaselineAssignments(baselineAssignments);
  const baselineAssignmentMetaById = buildBaselineAssignmentMetaMap(safeBaselineAssignments);
  const currentProfiles = buildPlacementCurrentProfiles({
    pupilIds: [safePupilId],
    attempts: attemptRows,
    baselineStatusRows,
    baselineAssignmentMetaById,
    resolvedWordMap,
  });
  const nonBaselineAttempts = (Array.isArray(attemptRows) ? attemptRows : [])
    .filter((attempt) => !isBaselineAttemptRow(attempt, baselineAssignmentMetaById) && !isPracticeAttemptRow(attempt));
  const wordloomCoreTests = Array.isArray(wordloomCoreWordRows) && wordloomCoreWordRows.length
    ? [{
      id: "wordloom-core-spelling-bank",
      title: "Wordloom Core Spelling Bank",
      test_words: wordloomCoreWordRows,
    }]
    : [];
  const personalisedSourceTests = [...wordloomCoreTests, ...(Array.isArray(teacherTests) ? teacherTests : [])];

  let plan = buildGeneratedAssignmentPlan({
    pupilIds: [safePupilId],
    teacherTests: personalisedSourceTests,
    attempts: nonBaselineAttempts,
    totalWords: effectivePolicy.assignment_length,
    currentProfiles,
    resolvedWordMap,
    policy: effectivePolicy,
  });

  if (effectivePolicy.allow_starter_fallback && needsStarterCatalogFallback(plan, [safePupilId])) {
    plan = buildGeneratedAssignmentPlan({
      pupilIds: [safePupilId],
      teacherTests: [...personalisedSourceTests, ...buildStarterCatalogVirtualTests()],
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
        || `Not enough saved words are available to build a ${effectivePolicy.assignment_length}-word personalised test for this pupil.`;
    throw new Error(effectivePolicy.allow_starter_fallback
      ? baseError
      : `${baseError} Starter fallback is off for this run.`);
  }

  return {
    plan,
    effectivePolicy,
  };
}

export function normalizeLoadedChoice(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  const clean = String(value || "").trim();
  if (!clean) return {};
  try {
    const parsed = JSON.parse(clean);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizeLoadedSegments(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  const clean = String(value || "").trim();
  if (!clean) return [];

  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || "").trim()).filter(Boolean);
    }
  } catch {
    // Fall through to lightweight text parsing.
  }

  if (clean.startsWith("{") && clean.endsWith("}")) {
    return clean
      .slice(1, -1)
      .split(",")
      .map((item) => String(item || "").trim().replace(/^"(.*)"$/, "$1"))
      .filter(Boolean);
  }

  if (clean.includes("|")) {
    return clean
      .split("|")
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return [clean];
}

export function normalizeLoadedWordRow(wordRow) {
  const row = wordRow && typeof wordRow === "object" ? wordRow : {};
  return {
    ...row,
    segments: normalizeLoadedSegments(row?.segments),
    choice: normalizeLoadedChoice(row?.choice),
  };
}

export function normalizeLoadedWordRows(wordRows) {
  return (Array.isArray(wordRows) ? wordRows : []).map((row) => normalizeLoadedWordRow(row));
}

function normalizeWordloomCoreText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeWordloomCoreTextList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeWordloomCoreText(item)).filter(Boolean);
  }

  const clean = String(value || "").trim();
  if (!clean) return [];

  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => normalizeWordloomCoreText(item)).filter(Boolean);
    }
  } catch {
    // Fall through to the generic stored-segment parser below.
  }

  return normalizeLoadedSegments(clean)
    .map((item) => normalizeWordloomCoreText(item))
    .filter(Boolean);
}

function normalizeWordloomCoreDifficultyLabel(value = "") {
  const label = String(value || "").trim();
  const key = label.toLowerCase();
  if (key.includes("stretch") || key.includes("challenge")) return { key: "challenge", label: label || "Stretch" };
  if (key.includes("core")) return { key: "core", label: label || "Core" };
  if (key.includes("easier") || key.includes("foundation")) return { key: "easier", label: label || "Easier" };
  return { key: "", label };
}

function buildWordloomCoreDifficultyPayload(row = {}) {
  const score = Number(row?.difficulty_score ?? row?.difficultyScore);
  if (!Number.isFinite(score)) return null;
  const band = normalizeWordloomCoreDifficultyLabel(row?.difficulty_label || row?.difficultyLabel);
  const reason = String(row?.difficulty_reason || row?.difficultyReason || "").trim();
  return {
    version: "wordloom_core",
    coreScore: Math.round(score),
    adjustedScore: Math.round(score),
    score: Math.round(score),
    band: band.key || "core",
    coreBand: band.key || "core",
    label: band.label || "Core",
    coreLabel: band.label || "Core",
    reasons: reason ? [reason] : [],
    modifierReasons: [],
    flags: {},
    features: {},
    components: {},
    modifiers: {},
  };
}

function buildWordloomCoreContextSupport(row = {}) {
  const sentence = String(row?.sentence || "").trim();
  const meaning = String(row?.meaning || "").trim();
  const context = {};

  if (sentence) {
    context.sentence = sentence;
    context.sentence_status = "approved";
    context.sentence_required = false;
  }
  if (meaning) {
    context.meaning = meaning;
    context.meaning_status = "approved";
    context.meaning_enabled = true;
    context.meaning_enabled_by_default = true;
  }

  return Object.keys(context).length ? context : null;
}

function normalizeWordloomCoreTargetRow(row = {}) {
  const focusGrapheme = normalizeWordloomCoreText(row?.focus_grapheme || row?.focusGrapheme);
  const targetRole = String(row?.target_role || row?.targetRole || "").trim().toLowerCase();
  if (!focusGrapheme || !["primary", "secondary"].includes(targetRole)) return null;
  return {
    id: normalizeId(row?.id),
    word_id: normalizeId(row?.word_id || row?.wordId),
    focus_target_id: normalizeId(row?.focus_target_id || row?.focusTargetId),
    focus_grapheme: focusGrapheme,
    target_role: targetRole,
    difficulty_modifier: Number.isFinite(Number(row?.difficulty_modifier ?? row?.difficultyModifier))
      ? Number(row?.difficulty_modifier ?? row?.difficultyModifier)
      : 0,
    pattern_type: String(row?.pattern_type || row?.patternType || "").trim().toLowerCase(),
  };
}

export function chunkList(items = [], size = 100) {
  const list = Array.isArray(items) ? items : [];
  const chunks = [];
  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }
  return chunks;
}

export function mapWordloomCoreBankRowsToWordRows({
  wordRows = [],
  wordTargetRows = [],
  focusTargetRows = [],
} = {}) {
  const activeTargetIds = new Set(
    (Array.isArray(focusTargetRows) ? focusTargetRows : [])
      .filter((row) => row?.is_active !== false && row?.isActive !== false)
      .map((row) => normalizeId(row?.id))
      .filter(Boolean)
  );
  const targetRowsByWordId = new Map();

  for (const row of Array.isArray(wordTargetRows) ? wordTargetRows : []) {
    const target = normalizeWordloomCoreTargetRow(row);
    if (!target?.word_id) continue;
    if (!activeTargetIds.has(target.focus_target_id)) continue;
    const next = targetRowsByWordId.get(target.word_id) || [];
    next.push(target);
    targetRowsByWordId.set(target.word_id, next);
  }

  return (Array.isArray(wordRows) ? wordRows : [])
    .map((row) => {
      const id = normalizeId(row?.id);
      if (!id) return null;
      if (row?.is_active === false || row?.isActive === false) return null;
      if (String(row?.approval_status || row?.approvalStatus || "").trim().toLowerCase() !== "approved") return null;
      if (String(row?.suitability_status || row?.suitabilityStatus || "").trim().toLowerCase() !== "suitable") return null;

      const targets = (targetRowsByWordId.get(id) || [])
        .sort((a, b) => {
          const roleDiff = (a.target_role === "primary" ? 0 : 1) - (b.target_role === "primary" ? 0 : 1);
          if (roleDiff) return roleDiff;
          return a.focus_grapheme.localeCompare(b.focus_grapheme);
        });
      const focusGraphemes = [...new Set(targets.map((target) => target.focus_grapheme).filter(Boolean))];
      if (!focusGraphemes.length) return null;

      const word = normalizeWordloomCoreText(row?.normalised_word || row?.normalisedWord || row?.word);
      const segments = normalizeWordloomCoreTextList(row?.grapheme_segments ?? row?.graphemeSegments);
      if (!word || !segments.length) return null;

      const primaryFocus = normalizeWordloomCoreText(row?.primary_focus_grapheme || row?.primaryFocusGrapheme);
      const contextSupport = buildWordloomCoreContextSupport(row);
      const difficulty = buildWordloomCoreDifficultyPayload(row);
      const sourceVersion = String(row?.source_version || row?.sourceVersion || "").trim();

      return normalizeLoadedWordRow({
        id,
        word,
        sentence: String(row?.sentence || "").trim() || null,
        segments,
        choice: {
          source: "wordloom_core",
          source_version: sourceVersion || null,
          origin_word_source: "wordloom_core",
          origin_bank_word_id: id,
          focus_graphemes: focusGraphemes,
          primary_focus_grapheme: focusGraphemes.includes(primaryFocus) ? primaryFocus : focusGraphemes[0],
          focus_target_links: targets,
          selection_suitability: "standard",
          suitability_status: "suitable",
          approval_status: "approved",
          is_active: true,
          difficulty,
          difficulty_reason: String(row?.difficulty_reason || row?.difficultyReason || "").trim() || null,
          context_support: contextSupport,
        },
      });
    })
    .filter(Boolean);
}

function toSingleRow(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}
