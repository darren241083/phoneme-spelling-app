import { chooseBestFocusGrapheme } from "./data/phonemeHelpers.js";
import {
  BASELINE_DEFAULT_PRESET,
  BASELINE_PRESET_BLUEPRINTS,
  BASELINE_STARTER_WORD_BANK,
} from "./data/baselinePlacementCatalog.js";
import { buildProfileFromAttempts } from "./assignmentEngine.js?v=1.5";
import { getQuestionEvidenceTier } from "./questionTypes.js?v=1.1";
import { buildPersistedDifficultyPayload } from "./researchDifficulty.js?v=2.4";
import { splitWordToGraphemes } from "./wordParser.js?v=1.5";

const BASELINE_TITLE = "Baseline Test";
export const BASELINE_V1_WORD_SOURCE = "baseline_v1";
export const BASELINE_V2_WORD_SOURCE = "baseline_v2";
const BASELINE_WORD_SOURCE = BASELINE_V2_WORD_SOURCE;
const BASELINE_STARTER_SOURCE = "baseline_catalog";
export const BASELINE_V1_STANDARD_KEY = "core_v1";
export const BASELINE_V2_STANDARD_KEY = "core_v2";
export const REQUIRED_BASELINE_STANDARD_KEY = BASELINE_V2_STANDARD_KEY;
export const BASELINE_V2_FLOOR_CORE_STAGE = "floor_core";
export const BASELINE_V2_DIAGNOSTIC_STAGE = "diagnostic";
export const BASELINE_V2_CEILING_STAGE = "ceiling_challenge";
export const BASELINE_V2_INDEPENDENT_SIGNAL = "independent";
export const BASELINE_V2_DIAGNOSTIC_SIGNAL = "diagnostic";
export const BASELINE_V2_CEILING_SIGNAL = "ceiling";
const BASELINE_V2_FLOOR_WORD_COUNT = 6;

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
}

function normalizeMetadataKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function normalizeBaselineStandardKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function normalizeWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "")
    .replace(/[^a-z'-]/g, "");
}

function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  const clean = String(value || "").trim().toLowerCase();
  return clean === "true" || clean === "1" || clean === "yes";
}

function normalizeChoiceObject(value) {
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

function resolvePresetDefinition(preset) {
  const key = String(preset || "").trim().toLowerCase();
  return BASELINE_PRESET_BLUEPRINTS[key] || BASELINE_PRESET_BLUEPRINTS[BASELINE_DEFAULT_PRESET];
}

function resolvePresetKey(preset) {
  const clean = String(preset || "").trim().toLowerCase();
  return BASELINE_PRESET_BLUEPRINTS[clean] ? clean : BASELINE_DEFAULT_PRESET;
}

function formatDateLabel(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCatalogEntryMap() {
  return new Map(
    BASELINE_STARTER_WORD_BANK.map((entry) => [normalizeWord(entry?.word || ""), entry])
  );
}

function buildSegments(entry, fallbackWord = "") {
  const explicit = Array.isArray(entry?.segments)
    ? entry.segments.map((item) => normalizeToken(item)).filter(Boolean)
    : [];
  if (explicit.length) return explicit;
  return splitWordToGraphemes(String(fallbackWord || entry?.word || ""))
    .map((item) => normalizeToken(item))
    .filter(Boolean);
}

function resolveFocusGrapheme(entry, segments) {
  const focus = normalizeToken(entry?.focusGrapheme || entry?.focus_grapheme || "");
  if (focus) return focus;
  return normalizeToken(chooseBestFocusGrapheme(segments)) || "";
}

function buildBaselineChoicePayload({
  word = "",
  segments = [],
  focusGrapheme = "",
  questionType = "segmented_spelling",
  stage = "broad_sweep",
  signal = "independent",
  preset = BASELINE_DEFAULT_PRESET,
}) {
  const cleanWord = normalizeWord(word);
  const cleanSegments = buildSegments({ segments }, cleanWord);
  const focus = resolveFocusGrapheme({ focusGrapheme }, cleanSegments);
  return {
    focus_graphemes: focus ? [focus] : [],
    difficulty: buildPersistedDifficultyPayload({
      word: cleanWord,
      graphemes: cleanSegments,
      trickyWord: false,
    }),
    source: BASELINE_WORD_SOURCE,
    question_type: questionType,
    max_attempts: 1,
    baseline_v2: true,
    baseline_version: "v2",
    baseline_stage: stage,
    baseline_role: "placement",
    baseline_signal: signal,
    baseline_preset: preset,
    baseline_standard_key: REQUIRED_BASELINE_STANDARD_KEY,
    visual_aids_mode: questionType === "segmented_spelling" ? "none" : undefined,
  };
}

function buildAssignmentTitle({ className = "", preset = BASELINE_DEFAULT_PRESET, date = new Date() } = {}) {
  const presetKey = resolvePresetKey(preset);
  const parts = [BASELINE_TITLE];
  const scope = String(className || "").trim();
  if (scope) parts.push(scope);
  if (presetKey !== BASELINE_DEFAULT_PRESET) {
    parts.push(resolvePresetDefinition(presetKey).label);
  }
  parts.push(formatDateLabel(date));
  return parts.join(" | ");
}

function buildEmptyPlacementProfile() {
  return {
    totalEvidence: 0,
    graphemeRows: [],
    concernRows: [],
    secureRows: [],
    developingRows: [],
    confusionByTarget: new Map(),
  };
}

function sortGraphemeRows(rows) {
  const bandRank = (band) => (band === "insecure" ? 0 : band === "nearly_secure" ? 1 : 2);
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    if (bandRank(a?.securityBand) !== bandRank(b?.securityBand)) {
      return bandRank(a?.securityBand) - bandRank(b?.securityBand);
    }
    if (Number(a?.accuracy || 0) !== Number(b?.accuracy || 0)) {
      return Number(a?.accuracy || 0) - Number(b?.accuracy || 0);
    }
    if (Number(b?.averageAttempts || 0) !== Number(a?.averageAttempts || 0)) {
      return Number(b?.averageAttempts || 0) - Number(a?.averageAttempts || 0);
    }
    if (Number(b?.total || 0) !== Number(a?.total || 0)) {
      return Number(b?.total || 0) - Number(a?.total || 0);
    }
    return String(a?.target || "").localeCompare(String(b?.target || ""));
  });
}

function rebuildProfileCollections(profile = {}) {
  const graphemeRows = sortGraphemeRows(profile?.graphemeRows || []);
  return {
    ...buildEmptyPlacementProfile(),
    ...profile,
    graphemeRows,
    concernRows: graphemeRows.filter((item) => item?.securityBand !== "secure"),
    secureRows: graphemeRows.filter((item) => item?.securityBand === "secure"),
    developingRows: graphemeRows.filter((item) => item?.securityBand === "nearly_secure"),
    confusionByTarget: profile?.confusionByTarget instanceof Map ? profile.confusionByTarget : new Map(),
  };
}

function getAttemptIdentity(attempt) {
  const targetId = String(attempt?.assignment_target_id || attempt?.assignmentTargetId || "").trim();
  if (targetId) return `target:${targetId}`;
  const testWordId = String(attempt?.test_word_id || attempt?.testWordId || "").trim();
  if (testWordId) return `word:${testWordId}`;
  const word = normalizeWord(attempt?.word_text || attempt?.word || "");
  return word ? `text:${word}` : "";
}

function getLatestAttemptSummary(attempts) {
  const ordered = [...(Array.isArray(attempts) ? attempts : [])]
    .sort((a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime());
  const latestByIdentity = new Map();
  for (const attempt of ordered) {
    const key = getAttemptIdentity(attempt);
    if (!key) continue;
    latestByIdentity.set(key, attempt);
  }
  const latestAttempts = Array.from(latestByIdentity.values());
  const correctCount = latestAttempts.filter((attempt) => !!attempt?.correct).length;
  return {
    latestAttempts,
    total: latestAttempts.length,
    accuracy: latestAttempts.length ? correctCount / latestAttempts.length : 0,
  };
}

function hasCompletedCorrectFlag(attempt) {
  if (!attempt || attempt.correct == null) return false;
  if (typeof attempt.correct === "boolean") return true;
  const clean = String(attempt.correct).trim().toLowerCase();
  return ["true", "false", "1", "0"].includes(clean);
}

function isCorrectAttempt(attempt) {
  if (attempt?.correct === true) return true;
  const clean = String(attempt?.correct ?? "").trim().toLowerCase();
  return clean === "true" || clean === "1";
}

function getBaselineRowKey(row) {
  const id = String(row?.id || "").trim();
  if (id) return `id:${id}`;
  const word = normalizeWord(row?.word || "");
  return word ? `word:${word}` : "";
}

function getAttemptRowKeyCandidates(attempt) {
  const testWordId = String(attempt?.test_word_id || attempt?.testWordId || "").trim();
  if (testWordId) return [`id:${testWordId}`];
  const keys = [];
  const word = normalizeWord(attempt?.word_text || attempt?.word || "");
  if (word) keys.push(`word:${word}`);
  return keys;
}

function sortBaselineRowsByPosition(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const aPosition = Number(a?.position || 0);
    const bPosition = Number(b?.position || 0);
    if (Number.isFinite(aPosition) && Number.isFinite(bPosition) && aPosition !== bPosition) {
      return aPosition - bPosition;
    }
    return normalizeWord(a?.word || "").localeCompare(normalizeWord(b?.word || ""));
  });
}

export function buildBaselineV2Inference({ attempts = [], wordRows = [] } = {}) {
  const baselineRows = sortBaselineRowsByPosition((wordRows || []).filter((row) => isBaselineV2WordRow(row)));
  const rowByAttemptKey = new Map();
  for (const row of baselineRows) {
    const idKey = String(row?.id || "").trim() ? `id:${String(row.id).trim()}` : "";
    const wordKey = normalizeWord(row?.word || "") ? `word:${normalizeWord(row.word)}` : "";
    if (idKey) rowByAttemptKey.set(idKey, row);
    if (wordKey) rowByAttemptKey.set(wordKey, row);
  }

  const latestByRowKey = new Map();
  const orderedAttempts = [...(Array.isArray(attempts) ? attempts : [])]
    .filter((attempt) => hasCompletedCorrectFlag(attempt))
    .sort((a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime());

  for (const attempt of orderedAttempts) {
    const row = getAttemptRowKeyCandidates(attempt)
      .map((key) => rowByAttemptKey.get(key))
      .find(Boolean);
    if (!row || !isBaselineV2WordRow(row)) continue;
    const rowKey = getBaselineRowKey(row);
    if (!rowKey) continue;
    latestByRowKey.set(rowKey, attempt);
  }

  const floorCoreRows = baselineRows.filter((row) => getBaselineWordStage(row) === BASELINE_V2_FLOOR_CORE_STAGE);
  const floorRows = floorCoreRows.slice(0, BASELINE_V2_FLOOR_WORD_COUNT);
  const diagnosticRows = baselineRows.filter((row) => getBaselineWordStage(row) === BASELINE_V2_DIAGNOSTIC_STAGE);
  const challengeRows = baselineRows.filter((row) => getBaselineWordStage(row) === BASELINE_V2_CEILING_STAGE);

  const getAttempt = (row) => latestByRowKey.get(getBaselineRowKey(row)) || null;
  const countAttempted = (rows) => rows.filter((row) => !!getAttempt(row)).length;
  const countCorrect = (rows) => rows.filter((row) => isCorrectAttempt(getAttempt(row))).length;

  const floorCoreAttempted = countAttempted(floorCoreRows);
  const floorCoreCorrect = countCorrect(floorCoreRows);
  const floorAttempted = countAttempted(floorRows);
  const floorCorrect = countCorrect(floorRows);
  const challengeAttempted = countAttempted(challengeRows);
  const challengeCorrect = countCorrect(challengeRows);

  let placementKey = "baseline_incomplete";
  if (floorCoreAttempted >= floorCoreRows.length && floorCoreRows.length > 0) {
    if (floorCoreCorrect <= 5 || floorCorrect <= 3) {
      placementKey = "needs_support";
    } else if (floorCoreCorrect >= 8 && challengeCorrect >= 2) {
      placementKey = "early_stretch";
    } else if (floorCoreCorrect >= 7) {
      placementKey = "secure_expected";
    } else {
      placementKey = "core_developing";
    }
  }

  const missedFloorCoreFocuses = new Set(
    floorCoreRows
      .filter((row) => {
        const attempt = getAttempt(row);
        return attempt && !isCorrectAttempt(attempt);
      })
      .map((row) => getBaselineFocusGrapheme(row))
      .filter(Boolean)
  );
  const diagnosticConcerns = diagnosticRows
    .filter((row) => {
      const attempt = getAttempt(row);
      return attempt && !isCorrectAttempt(attempt);
    })
    .map((row) => {
      const focusGrapheme = getBaselineFocusGrapheme(row);
      return {
        word: normalizeWord(row?.word || ""),
        focusGrapheme,
        matchedFloorCoreMiss: !!focusGrapheme && missedFloorCoreFocuses.has(focusGrapheme),
      };
    });

  return {
    placementKey,
    headlinePlacement: placementKey,
    floorCoreTotal: floorCoreRows.length,
    floorCoreAttempted,
    floorCoreCorrect,
    floorTotal: floorRows.length,
    floorAttempted,
    floorCorrect,
    diagnosticTotal: diagnosticRows.length,
    diagnosticAttempted: countAttempted(diagnosticRows),
    diagnosticMissCount: diagnosticConcerns.length,
    diagnosticConcerns,
    challengeTotal: challengeRows.length,
    challengeAttempted,
    challengeCorrect,
  };
}

function buildPlacementBand(independentAttempts) {
  const summary = getLatestAttemptSummary(independentAttempts);
  if (summary.total >= 9 && summary.accuracy >= 0.8) return "extension";
  if (summary.total >= 6 && summary.accuracy >= 0.45) return "core";
  return "foundation";
}

function buildPlacementConfidence(independentCount, diagnosticCount) {
  const total = Math.max(0, Number(independentCount || 0)) + Math.max(0, Number(diagnosticCount || 0));
  if (independentCount >= 10 && total >= 12) return "high";
  if (independentCount >= 6 && total >= 8) return "medium";
  return "low";
}

function mergeConfusionMaps(baseMap, incomingMap) {
  const merged = new Map();
  for (const [target, entry] of baseMap instanceof Map ? baseMap.entries() : []) {
    merged.set(target, { ...entry });
  }
  for (const [target, entry] of incomingMap instanceof Map ? incomingMap.entries() : []) {
    const current = merged.get(target);
    if (!current) {
      merged.set(target, { ...entry });
      continue;
    }
    if (Number(entry?.attemptCount || 0) > Number(current?.attemptCount || 0)) {
      merged.set(target, { ...entry });
      continue;
    }
    if (
      Number(entry?.attemptCount || 0) === Number(current?.attemptCount || 0)
      && Number(entry?.substitutionCount || 0) >= Number(current?.substitutionCount || 0)
    ) {
      merged.set(target, { ...entry });
    }
  }
  return merged;
}

function sanitizeDiagnosticRow(row) {
  if (!row || !row.target) return null;
  const securityBand = row.securityBand === "secure" ? "nearly_secure" : row.securityBand;
  return {
    ...row,
    securityBand,
  };
}

function getAssignmentMeta(assignmentMetaById, assignmentId) {
  if (assignmentMetaById instanceof Map) return assignmentMetaById.get(String(assignmentId || "")) || null;
  return assignmentMetaById?.[assignmentId] || assignmentMetaById?.[String(assignmentId || "")] || null;
}

function isBaselineV1Choice(choice) {
  return normalizeBooleanFlag(choice?.baseline_v1)
    || normalizeMetadataKey(choice?.source) === BASELINE_V1_WORD_SOURCE;
}

function isBaselineV2Choice(choice) {
  return normalizeBooleanFlag(choice?.baseline_v2)
    || normalizeMetadataKey(choice?.source) === BASELINE_V2_WORD_SOURCE
    || normalizeBaselineStandardKey(choice?.baseline_standard_key) === BASELINE_V2_STANDARD_KEY;
}

function getBaselineChoice(wordRow) {
  return normalizeChoiceObject(wordRow?.choice);
}

export function isBaselineV2WordRow(wordRow) {
  return isBaselineV2Choice(getBaselineChoice(wordRow));
}

export function isBaselineWordRow(wordRow) {
  const choice = getBaselineChoice(wordRow);
  return isBaselineV1Choice(choice) || isBaselineV2Choice(choice);
}

export function getBaselineWordStage(wordRow) {
  return normalizeMetadataKey(getBaselineChoice(wordRow)?.baseline_stage);
}

export function getBaselineWordSignal(wordRow) {
  return normalizeMetadataKey(getBaselineChoice(wordRow)?.baseline_signal);
}

function getBaselineFocusGrapheme(wordRow) {
  const choice = getBaselineChoice(wordRow);
  const focusChoices = Array.isArray(choice?.focus_graphemes)
    ? choice.focus_graphemes.map((item) => normalizeToken(item)).filter(Boolean)
    : [];
  if (focusChoices[0]) return focusChoices[0];
  const segments = Array.isArray(wordRow?.segments)
    ? wordRow.segments.map((item) => normalizeToken(item)).filter(Boolean)
    : [];
  return normalizeToken(chooseBestFocusGrapheme(segments));
}

export function shouldIncludeBaselineResponseInHeadlineAttainment(response, wordRow) {
  if (!isBaselineV2WordRow(wordRow)) return true;

  const stage = getBaselineWordStage(wordRow);
  if (stage === BASELINE_V2_DIAGNOSTIC_STAGE) return false;
  if (stage === BASELINE_V2_CEILING_STAGE) return !!response?.correct;
  return true;
}

export function isBaselineAssignmentWordRows(wordRows) {
  const rows = Array.isArray(wordRows) ? wordRows.filter(Boolean) : [];
  return rows.length > 0 && rows.every((row) => isBaselineWordRow(row));
}

export function resolveBaselinePresetFromWordRows(wordRows) {
  const rows = Array.isArray(wordRows) ? wordRows : [];
  const preset = rows
    .map((row) => normalizeChoiceObject(row?.choice))
    .find((choice) => choice?.baseline_preset)?.baseline_preset;
  return resolvePresetKey(preset);
}

export function resolveBaselineStandardKeyFromWordRows(wordRows) {
  const rows = Array.isArray(wordRows) ? wordRows : [];
  const standardKey = rows
    .map((row) => normalizeChoiceObject(row?.choice))
    .find((choice) => choice?.baseline_standard_key)?.baseline_standard_key;
  return normalizeBaselineStandardKey(standardKey);
}

export function buildBaselinePupilReason() {
  return "A short baseline test to help choose the right practice.";
}

export function buildBaselineAssignmentDefinition({
  preset = BASELINE_DEFAULT_PRESET,
  className = "",
  date = new Date(),
} = {}) {
  const presetKey = resolvePresetKey(preset);
  const definition = resolvePresetDefinition(presetKey);
  const catalogByWord = getCatalogEntryMap();
  const words = definition.items.map((item, index) => {
    const catalogEntry = catalogByWord.get(normalizeWord(item?.word || ""));
    const cleanWord = normalizeWord(item?.word || catalogEntry?.word || "");
    const segments = buildSegments({
      ...(catalogEntry || {}),
      segments: Array.isArray(item?.segments) ? item.segments : catalogEntry?.segments,
    }, cleanWord);
    const focusGrapheme = resolveFocusGrapheme(
      { focusGrapheme: item?.focusGrapheme || catalogEntry?.focusGrapheme },
      segments,
    );
    return {
      position: index + 1,
      word: cleanWord,
      sentence: null,
      segments,
      choice: buildBaselineChoicePayload({
        word: cleanWord,
        segments,
        focusGrapheme,
        questionType: String(item?.questionType || "segmented_spelling"),
        stage: String(item?.stage || "broad_sweep"),
        signal: String(item?.signal || "independent"),
        preset: presetKey,
      }),
    };
  }).filter((row) => row.word && row.segments.length);

  return {
    preset: presetKey,
    label: definition.label,
    title: buildAssignmentTitle({ className, preset: presetKey, date }),
    questionType: "segmented_spelling",
    pupilTitle: BASELINE_TITLE,
    pupilReason: buildBaselinePupilReason(),
    wordRows: words,
    recommendedLength: words.length,
  };
}

export function buildStarterCatalogVirtualTests() {
  const rows = BASELINE_STARTER_WORD_BANK.map((entry, index) => {
    const cleanWord = normalizeWord(entry?.word || "");
    const segments = buildSegments(entry, cleanWord);
    const focusGrapheme = resolveFocusGrapheme(entry, segments);
    return {
      id: `baseline-catalog-word-${index + 1}`,
      position: index + 1,
      word: cleanWord,
      sentence: null,
      segments,
      choice: {
        focus_graphemes: focusGrapheme ? [focusGrapheme] : [],
        difficulty: buildPersistedDifficultyPayload({
          word: cleanWord,
          graphemes: segments,
          trickyWord: false,
        }),
        source: BASELINE_STARTER_SOURCE,
      },
    };
  }).filter((row) => row.word && row.segments.length);

  return rows.length
    ? [{
      id: "__baseline_starter_catalog__",
      title: "Baseline starter catalog",
      question_type: "segmented_spelling",
      test_words: rows,
    }]
    : [];
}

export function buildPlacementSeedProfiles({
  attempts = [],
  completedStatuses = [],
  assignmentMetaById = new Map(),
  resolvedWordMap = null,
} = {}) {
  const latestCompletedByPupil = new Map();

  for (const status of completedStatuses || []) {
    const pupilId = String(status?.pupil_id || status?.pupilId || "").trim();
    const assignmentId = String(status?.assignment_id || status?.assignmentId || "").trim();
    if (!pupilId || !assignmentId) continue;
    const assignmentMeta = getAssignmentMeta(assignmentMetaById, assignmentId);
    if (!assignmentMeta) continue;
    const completedAt = status?.completed_at || status?.completedAt || null;
    const completedMs = new Date(completedAt || 0).getTime();
    const current = latestCompletedByPupil.get(pupilId);
    if (!current || completedMs >= current.completedMs) {
      latestCompletedByPupil.set(pupilId, {
        assignmentId,
        completedAt: completedAt || null,
        completedMs: Number.isFinite(completedMs) ? completedMs : 0,
        preset: resolvePresetKey(assignmentMeta?.preset),
      });
    }
  }

  const profiles = {};

  for (const [pupilId, status] of latestCompletedByPupil.entries()) {
    const relevantAttempts = (attempts || [])
      .filter((attempt) => String(attempt?.pupil_id || "") === pupilId)
      .filter((attempt) => String(attempt?.assignment_id || "") === String(status.assignmentId));
    if (!relevantAttempts.length) continue;

    const independentAttempts = relevantAttempts.filter((attempt) => getQuestionEvidenceTier(attempt?.mode) === "independent");
    if (!independentAttempts.length) continue;
    const diagnosticAttempts = relevantAttempts.filter((attempt) => getQuestionEvidenceTier(attempt?.mode) === "diagnostic");

    const independentProfile = rebuildProfileCollections(
      buildProfileFromAttempts(independentAttempts, resolvedWordMap)
    );
    const diagnosticProfile = rebuildProfileCollections(
      buildProfileFromAttempts([...independentAttempts, ...diagnosticAttempts], resolvedWordMap)
    );

    const graphemeRowsByTarget = new Map(
      independentProfile.graphemeRows.map((row) => [String(row?.target || ""), { ...row }])
    );

    for (const row of diagnosticProfile.graphemeRows || []) {
      const target = String(row?.target || "");
      if (!target || graphemeRowsByTarget.has(target)) continue;
      const diagnosticRow = sanitizeDiagnosticRow(row);
      if (diagnosticRow) graphemeRowsByTarget.set(target, diagnosticRow);
    }

    const mergedProfile = rebuildProfileCollections({
      totalEvidence: independentProfile.totalEvidence + diagnosticAttempts.length,
      graphemeRows: Array.from(graphemeRowsByTarget.values()),
      confusionByTarget: mergeConfusionMaps(independentProfile.confusionByTarget, diagnosticProfile.confusionByTarget),
      placementMeta: {
        presetUsed: status.preset,
        provisionalPlacementBand: buildPlacementBand(independentAttempts),
        independentAttemptCount: independentAttempts.length,
        diagnosticAttemptCount: diagnosticAttempts.length,
        comparableUnsupportedCount: independentAttempts.length,
        confidence: buildPlacementConfidence(independentAttempts.length, diagnosticAttempts.length),
        completedAt: status.completedAt || null,
      },
    });

    profiles[pupilId] = mergedProfile;
  }

  return profiles;
}

export function mergePlacementWithLiveProfiles(liveProfile = null, placementProfile = null) {
  const safeLive = liveProfile && typeof liveProfile === "object"
    ? rebuildProfileCollections(liveProfile)
    : buildEmptyPlacementProfile();
  const safePlacement = placementProfile && typeof placementProfile === "object"
    ? rebuildProfileCollections(placementProfile)
    : buildEmptyPlacementProfile();

  if (!safePlacement.graphemeRows.length) return safeLive;
  if (!safeLive.graphemeRows.length) return safePlacement;

  const graphemeRowsByTarget = new Map(
    safePlacement.graphemeRows.map((row) => [String(row?.target || ""), { ...row }])
  );
  for (const row of safeLive.graphemeRows || []) {
    const target = String(row?.target || "");
    if (!target) continue;
    graphemeRowsByTarget.set(target, { ...row });
  }

  return rebuildProfileCollections({
    totalEvidence: Math.max(0, Number(safePlacement.totalEvidence || 0)) + Math.max(0, Number(safeLive.totalEvidence || 0)),
    graphemeRows: Array.from(graphemeRowsByTarget.values()),
    confusionByTarget: mergeConfusionMaps(safePlacement.confusionByTarget, safeLive.confusionByTarget),
    placementMeta: {
      ...(safePlacement?.placementMeta || {}),
      liveIndependentEvidenceCount: Math.max(0, Number(safeLive.totalEvidence || 0)),
    },
  });
}
