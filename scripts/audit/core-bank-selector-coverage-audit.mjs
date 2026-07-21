import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadBrowserModule } from "../../tests/load-browser-module.mjs";
import { mapWordloomCoreBankRowsToWordRows } from "../../supabase/functions/provision-personalised-assignment/provisioningCore.mjs";

const browserEngine = await loadBrowserModule("../../js/assignmentEngine.js", import.meta.url);
const edgeEngine = await import("../../supabase/functions/provision-personalised-assignment/pure/assignmentEngine.js");

export const AUDIT_VERSION = "core_bank_selector_coverage_audit_v1";
export const AUDIT_NOW_ISO = "2026-07-21T12:00:00.000Z";
export const AUDIT_NOW_MS = Date.parse(AUDIT_NOW_ISO);
export const ASSIGNMENT_LENGTH = 10;
export const TARGET_BUFFER_COUNT = 8;
export const SOURCE_DATA_URL = new URL("../../data/wordloom-core-bank-v1.json", import.meta.url);

const HEADLINE_PROFILE_IDS = ["needs_support", "secure_expected", "early_stretch"];
const DIAGNOSTIC_PROFILE_IDS = ["core_developing"];
const ALL_PROFILE_IDS = [...HEADLINE_PROFILE_IDS, ...DIAGNOSTIC_PROFILE_IDS];
const STATUS_WEIGHT = { green: 0, amber: 1, red: 2 };
const FIXED_RECENT_ATTEMPT_ISO = "2026-07-20T12:00:00.000Z";
const VALID_PROFILE_IDS = new Set(ALL_PROFILE_IDS);
const PROFILE_FALLBACK_TARGET_LIMIT = 12;
const CELL_FALLBACK_ROWS_PER_FOCUS = 8;

function normalizeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
}

function normalizeMetadataKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeWord(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "")
    .replace(/[^a-z'-]/g, "");
}

function normalizeSourceText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function incrementCount(target, key, amount = 1) {
  const cleanKey = String(key || "unknown").trim() || "unknown";
  target[cleanKey] = (target[cleanKey] || 0) + amount;
}

function countBy(items = [], getter) {
  const counts = {};
  for (const item of Array.isArray(items) ? items : []) {
    incrementCount(counts, getter(item));
  }
  return counts;
}

function readCoreBankSource(sourceUrl = SOURCE_DATA_URL) {
  return JSON.parse(readFileSync(sourceUrl, "utf8"));
}

function buildSourceWordId(word = {}, index = 0) {
  const sourceVersion = normalizeMetadataKey(word?.source_version || "source");
  const normalised = normalizeWord(word?.normalised_word || word?.normalisedWord || word?.word);
  return `core-source-${sourceVersion}-${String(index + 1).padStart(4, "0")}-${normalised || "word"}`;
}

function buildCoreBankSelectorInputs(source = {}) {
  const targets = (Array.isArray(source?.targets) ? source.targets : [])
    .map((target, index) => {
      const focus = normalizeToken(target?.focus_grapheme || target?.focusGrapheme);
      if (!focus) return null;
      return {
        id: `core-target-${focus}`,
        focus_grapheme: focus,
        display_label: String(target?.display_label || target?.displayLabel || focus).trim() || focus,
        stage_band: normalizeMetadataKey(target?.stage_band || target?.stageBand || ""),
        challenge_band: normalizeMetadataKey(target?.challenge_band || target?.challengeBand || ""),
        sort_order: Number.isFinite(Number(target?.sort_order ?? target?.sortOrder))
          ? Number(target?.sort_order ?? target?.sortOrder)
          : index + 1,
        expected_primary_word_count_v1: Number(target?.expected_primary_word_count_v1 || 0) || 0,
        is_active: target?.is_active !== false && target?.isActive !== false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sort_order - b.sort_order || a.focus_grapheme.localeCompare(b.focus_grapheme));
  const targetIdByFocus = new Map(targets.map((target) => [target.focus_grapheme, target.id]));

  const rawWords = Array.isArray(source?.words) ? source.words : [];
  const wordRows = rawWords.map((word, index) => {
    const normalised = normalizeWord(word?.normalised_word || word?.normalisedWord || word?.word);
    return {
      id: buildSourceWordId(word, index),
      word: normalizeWord(word?.word || normalised),
      normalised_word: normalised,
      grapheme_segments: Array.isArray(word?.grapheme_segments)
        ? word.grapheme_segments
        : (Array.isArray(word?.graphemeSegments) ? word.graphemeSegments : []),
      primary_focus_grapheme: normalizeToken(word?.primary_focus_grapheme || word?.primaryFocusGrapheme),
      difficulty_score: Number(word?.difficulty_score ?? word?.difficultyScore),
      difficulty_label: String(word?.difficulty_label || word?.difficultyLabel || "").trim(),
      difficulty_reason: String(word?.difficulty_reason || word?.difficultyReason || "").trim(),
      sentence: String(word?.sentence || "").trim(),
      meaning: String(word?.meaning || "").trim(),
      suitability_status: normalizeSourceText(word?.suitability_status || word?.suitabilityStatus),
      approval_status: normalizeSourceText(word?.approval_status || word?.approvalStatus),
      source: normalizeSourceText(word?.source),
      source_version: String(word?.source_version || word?.sourceVersion || "").trim(),
      is_active: word?.is_active === true || word?.isActive === true,
      __sourceIndex: index,
    };
  });
  const rawWordById = new Map(wordRows.map((word) => [word.id, word]));
  const wordTargetRows = rawWords.flatMap((word, wordIndex) => {
    const wordId = wordRows[wordIndex]?.id;
    const links = Array.isArray(word?.target_links)
      ? word.target_links
      : (Array.isArray(word?.targetLinks) ? word.targetLinks : []);
    return links
      .map((link, linkIndex) => {
        const focus = normalizeToken(link?.focus_grapheme || link?.focusGrapheme);
        const targetRole = normalizeMetadataKey(link?.target_role || link?.targetRole);
        if (!wordId || !focus || !targetRole) return null;
        return {
          id: `core-link-${String(wordIndex + 1).padStart(4, "0")}-${linkIndex + 1}-${focus}`,
          word_id: wordId,
          focus_target_id: targetIdByFocus.get(focus) || `missing-target-${focus}`,
          focus_grapheme: focus,
          target_role: targetRole,
          pattern_type: normalizeMetadataKey(link?.pattern_type || link?.patternType),
          difficulty_modifier: Number.isFinite(Number(link?.difficulty_modifier ?? link?.difficultyModifier))
            ? Number(link?.difficulty_modifier ?? link?.difficultyModifier)
            : 0,
        };
      })
      .filter(Boolean);
  });

  const mappedWordRows = mapWordloomCoreBankRowsToWordRows({
    wordRows,
    wordTargetRows,
    focusTargetRows: targets,
  });
  const activeTargets = targets.filter((target) => target.is_active);
  const usablePrimaryWordCountByFocus = new Map(activeTargets.map((target) => [target.focus_grapheme, 0]));
  const usableWordIds = new Set(
    mappedWordRows
      .map((row) => String(row?.choice?.origin_bank_word_id || row?.id || "").trim())
      .filter(Boolean)
  );

  for (const link of wordTargetRows) {
    if (link.target_role !== "primary") continue;
    if (!usableWordIds.has(link.word_id)) continue;
    const focus = normalizeToken(link.focus_grapheme);
    if (!usablePrimaryWordCountByFocus.has(focus)) continue;
    usablePrimaryWordCountByFocus.set(focus, usablePrimaryWordCountByFocus.get(focus) + 1);
  }

  return {
    metadata: source?.metadata && typeof source.metadata === "object" ? source.metadata : {},
    focusTargetRows: targets,
    activeTargets,
    sourceWordRows: wordRows,
    sourceWordTargetRows: wordTargetRows,
    mappedWordRows,
    rawWordById,
    usablePrimaryWordCountByFocus,
  };
}

function buildEvidenceRows(target, allTargets, profileId) {
  const primary = normalizeToken(target?.focus_grapheme || target?.focusGrapheme || target?.focus || "");
  const fallbackTargets = (Array.isArray(allTargets) ? allTargets : [])
    .map((item) => normalizeToken(item?.focus_grapheme || item?.focusGrapheme || item?.focus || ""))
    .filter((focus) => focus && focus !== primary)
    .slice(0, PROFILE_FALLBACK_TARGET_LIMIT);
  const concernTemplate = {
    needs_support: {
      total: 4,
      correct: 1,
      incorrect: 3,
      accuracy: 0.25,
      firstTrySuccessRate: 0.25,
      recentIncorrectCount: 2,
      securityBand: "insecure",
      repeatedFailure: true,
    },
    core_developing: {
      total: 4,
      correct: 2,
      incorrect: 2,
      accuracy: 0.5,
      firstTrySuccessRate: 0.5,
      recentIncorrectCount: 1,
      securityBand: "nearly_secure",
    },
    secure_expected: {
      total: 4,
      correct: 3,
      incorrect: 1,
      accuracy: 0.75,
      firstTrySuccessRate: 0.75,
      recentIncorrectCount: 1,
      securityBand: "nearly_secure",
    },
    early_stretch: {
      total: 4,
      correct: 3,
      incorrect: 1,
      accuracy: 0.75,
      firstTrySuccessRate: 0.75,
      recentIncorrectCount: 1,
      securityBand: "nearly_secure",
    },
  };
  const template = concernTemplate[profileId] || concernTemplate.secure_expected;
  const secureRows = fallbackTargets.map((focus) => ({
    target: focus,
    total: 4,
    correct: 4,
    incorrect: 0,
    accuracy: 1,
    firstTrySuccessRate: 1,
    securityBand: "secure",
  }));
  const developingRows = fallbackTargets.map((focus) => ({
    target: focus,
    total: 3,
    correct: 2,
    incorrect: 1,
    accuracy: 0.67,
    firstTrySuccessRate: 0.67,
    securityBand: "nearly_secure",
  }));

  return {
    totalEvidence: 1 + secureRows.length + developingRows.length,
    graphemeRows: [
      { target: primary, ...template },
      ...secureRows,
      ...developingRows,
    ],
    concernRows: [{ target: primary, ...template }],
    secureRows,
    developingRows,
    confusionByTarget: new Map(),
    placementMeta: {
      targetChallengeLevel: profileId,
      baselinePlacement: profileId,
      headlinePlacement: profileId,
      confidence: "core_bank_selector_coverage_audit_fixture",
    },
  };
}

function buildProfileDefinition(target, allTargets, profileId) {
  const matrixKind = HEADLINE_PROFILE_IDS.includes(profileId)
    ? "headline_pupil_profile"
    : "diagnostic_selector_band";
  return {
    id: profileId,
    matrixKind,
    label: profileId === "core_developing" ? "Core developing diagnostic band" : profileId.replace(/_/g, " "),
    profile: buildEvidenceRows(target, allTargets, profileId),
  };
}

function hasTargetLink(row = {}, focus = "") {
  const cleanFocus = normalizeToken(focus);
  const links = row?.choice?.focus_target_links || row?.focus_target_links || [];
  return (Array.isArray(links) ? links : []).some((link) =>
    normalizeToken(link?.focus_grapheme || link?.focusGrapheme) === cleanFocus
  );
}

function runSelectorProbe(engine, {
  focus,
  profileId,
  wordRows,
  count,
  usedWords = new Set(),
  attempts = [],
} = {}) {
  const usageByWord = new Map();
  const result = engine.selectApprovedTargetWords({
    focusGrapheme: focus,
    candidates: wordRows,
    challengeLevel: profileId,
    count,
    usageByWord,
    usedWords,
  });
  const selectedWords = Array.isArray(result?.words) ? result.words.map((word) => normalizeWord(word?.word)).filter(Boolean) : [];
  const availableCount = result?.status === engine.APPROVED_TARGET_SELECTOR_STATUS_READY
    ? selectedWords.length
    : Math.max(0, Number(result?.availableCount || 0));

  return {
    status: String(result?.status || ""),
    requestedCount: Math.max(0, Number(count || 0)),
    availableCount,
    selectedWords,
    widened: result?.widened === true,
    window: result?.window || null,
    attemptCount: Array.isArray(attempts) ? attempts.length : 0,
  };
}

function stableCoverageWarnings(warnings = []) {
  return (Array.isArray(warnings) ? warnings : [])
    .map((warning) => ({
      type: String(warning?.type || ""),
      focusGrapheme: normalizeToken(warning?.focusGrapheme || warning?.focus_grapheme || ""),
      requestedTargetCount: Math.max(0, Number(warning?.requestedTargetCount ?? warning?.requested_target_count ?? 0)),
      selectedTargetCount: Math.max(0, Number(warning?.selectedTargetCount ?? warning?.selected_target_count ?? 0)),
      fallbackCount: Math.max(0, Number(warning?.fallbackCount ?? warning?.fallback_count ?? 0)),
    }))
    .sort((a, b) => a.focusGrapheme.localeCompare(b.focusGrapheme) || a.type.localeCompare(b.type));
}

function stableWordSignature(word = {}) {
  return {
    word: normalizeWord(word?.word || ""),
    role: normalizeMetadataKey(word?.assignmentRole || word?.assignment_role || ""),
    focusGrapheme: normalizeToken(word?.focusGrapheme || word?.focus_grapheme || ""),
    questionType: normalizeMetadataKey(word?.questionType || word?.question_type || ""),
    support: normalizeMetadataKey(word?.assignmentSupport || word?.assignment_support || ""),
    supportReason: normalizeMetadataKey(word?.supportLadderReason || word?.support_ladder_reason || ""),
    targetReason: normalizeMetadataKey(word?.targetReason || word?.target_reason || ""),
    originWordSource: normalizeMetadataKey(word?.originWordSource || word?.origin_word_source || ""),
    originBankWordId: String(word?.originBankWordId || word?.origin_bank_word_id || "").trim(),
    difficultyScore: Number.isFinite(Number(word?.difficulty?.coreScore ?? word?.difficulty?.score))
      ? Number(word?.difficulty?.coreScore ?? word?.difficulty?.score)
      : null,
  };
}

function stablePlanSignature(plan = null) {
  const pupilPlan = plan?.pupilPlans?.[0] || null;
  return {
    error: String(plan?.error || ""),
    totalWords: Math.max(0, Number(plan?.totalWords || 0)),
    clearFocusGrapheme: normalizeToken(plan?.clearFocusGrapheme || ""),
    coverageWarnings: stableCoverageWarnings(plan?.coverageWarnings),
    words: (Array.isArray(pupilPlan?.words) ? pupilPlan.words : []).map(stableWordSignature),
  };
}

function buildPlanWithEngine(engine, {
  pupilId,
  profile,
  wordRows,
  attempts = [],
  assignmentTargetRows = [],
} = {}) {
  return engine.buildGeneratedAssignmentPlan({
    pupilIds: [pupilId],
    teacherTests: [{
      id: "core-bank-selector-coverage-audit-bank",
      title: "Core Bank Selector Coverage Audit Bank",
      test_words: wordRows,
    }],
    attempts,
    assignmentTargetRows,
    totalWords: ASSIGNMENT_LENGTH,
    currentProfiles: {
      [pupilId]: profile,
    },
    policy: {
      assignment_length: ASSIGNMENT_LENGTH,
      support_preset: "balanced",
      allow_starter_fallback: false,
    },
    usageAsOfMs: AUDIT_NOW_MS,
  });
}

function normalizeSelectedWords(plan = null) {
  const pupilPlan = plan?.pupilPlans?.[0] || null;
  return Array.isArray(pupilPlan?.words) ? pupilPlan.words : [];
}

function duplicateWordsFor(words = []) {
  const seen = new Set();
  const duplicates = new Set();
  for (const word of words.map((item) => normalizeWord(item?.word))) {
    if (!word) continue;
    if (seen.has(word)) duplicates.add(word);
    seen.add(word);
  }
  return [...duplicates].sort();
}

function validateSelectedWords(words = [], rawWordById = new Map()) {
  const invalid = [];
  for (const word of words) {
    const signature = stableWordSignature(word);
    if (signature.originWordSource !== "wordloom_core") {
      invalid.push({
        word: signature.word,
        reason: "excluded_or_non_core_source",
        originWordSource: signature.originWordSource,
        originBankWordId: signature.originBankWordId || null,
      });
      continue;
    }
    if (!signature.originBankWordId) {
      invalid.push({
        word: signature.word,
        reason: "missing_origin_bank_word_id",
        originWordSource: signature.originWordSource,
      });
      continue;
    }
    const raw = rawWordById.get(signature.originBankWordId);
    if (!raw) {
      invalid.push({
        word: signature.word,
        reason: "missing_source_row",
        originBankWordId: signature.originBankWordId,
      });
      continue;
    }
    if (normalizeSourceText(raw.source) !== "wordloom_core") {
      invalid.push({ word: signature.word, reason: "source_not_wordloom_core", originBankWordId: signature.originBankWordId });
    }
    if (raw.is_active !== true) {
      invalid.push({ word: signature.word, reason: "inactive_source_row", originBankWordId: signature.originBankWordId });
    }
    if (normalizeSourceText(raw.approval_status) !== "approved") {
      invalid.push({
        word: signature.word,
        reason: normalizeSourceText(raw.approval_status) === "pending" ? "pending_source_row" : "unapproved_source_row",
        originBankWordId: signature.originBankWordId,
        approvalStatus: raw.approval_status || "",
      });
    }
    if (normalizeSourceText(raw.suitability_status) !== "suitable") {
      invalid.push({
        word: signature.word,
        reason: "unsuitable_source_row",
        originBankWordId: signature.originBankWordId,
        suitabilityStatus: raw.suitability_status || "",
      });
    }
  }
  return invalid;
}

function selectedExactTargetCount(words = [], focus = "") {
  const target = normalizeToken(focus);
  return (Array.isArray(words) ? words : [])
    .filter((word) =>
      normalizeMetadataKey(word?.assignmentRole || word?.assignment_role) === "target"
      && normalizeToken(word?.focusGrapheme || word?.focus_grapheme) === target
    )
    .length;
}

function roleCounts(words = []) {
  return countBy(words, (word) => normalizeMetadataKey(word?.assignmentRole || word?.assignment_role || "unknown"));
}

function supportCounts(words = []) {
  return countBy(words, (word) => normalizeMetadataKey(word?.assignmentSupport || word?.assignment_support || "unknown"));
}

function questionTypeCounts(words = []) {
  return countBy(words, (word) => normalizeMetadataKey(word?.questionType || word?.question_type || "unknown"));
}

function buildRecentSecureAttempt({ pupilId, word, focus, segments }) {
  const cleanWord = normalizeWord(word);
  return {
    pupil_id: pupilId,
    assignment_id: `cooldown-pressure-${pupilId}`,
    test_word_id: `cooldown-pressure-${cleanWord}`,
    assignment_target_id: null,
    mode: "no_support_assessment",
    attempt_source: "auto_assigned",
    correct: true,
    attempt_number: 1,
    created_at: FIXED_RECENT_ATTEMPT_ISO,
    focus_grapheme: normalizeToken(focus),
    pattern_type: null,
    word_text: cleanWord,
    typed: cleanWord,
    target_graphemes: Array.isArray(segments) ? segments : [normalizeToken(focus)].filter(Boolean),
    delivery_model: "support_ladder",
    support_state: "independent",
    evidence_category: "correct_first_time",
    support_actions: [],
  };
}

function getRowPrimaryFocus(row = {}) {
  const links = row?.choice?.focus_target_links || [];
  const primary = (Array.isArray(links) ? links : [])
    .find((link) => normalizeMetadataKey(link?.target_role || link?.targetRole) === "primary");
  return normalizeToken(
    primary?.focus_grapheme
    || primary?.focusGrapheme
    || row?.choice?.primary_focus_grapheme
    || row?.choice?.primaryFocusGrapheme
    || row?.choice?.focus_graphemes?.[0]
    || "",
  );
}

function getRowDifficultyScore(row = {}) {
  const value = Number(row?.choice?.difficulty?.coreScore ?? row?.choice?.difficulty?.score);
  return Number.isFinite(value) ? value : 0;
}

function buildCooldownFallbackSubsetRows(fullWordRows = [], {
  focus = "",
  candidateWord = "",
  perFocus = 9,
} = {}) {
  const cleanFocus = normalizeToken(focus);
  const cleanCandidate = normalizeWord(candidateWord);
  const selectedByWord = new Map();
  const rowsByFocus = new Map();

  for (const row of Array.isArray(fullWordRows) ? fullWordRows : []) {
    const word = normalizeWord(row?.word);
    if (!word) continue;
    if (word === cleanCandidate) {
      selectedByWord.set(word, row);
      continue;
    }
    if (hasTargetLink(row, cleanFocus)) continue;
    const rowFocus = getRowPrimaryFocus(row);
    if (!rowFocus) continue;
    const rows = rowsByFocus.get(rowFocus) || [];
    rows.push(row);
    rowsByFocus.set(rowFocus, rows);
  }

  for (const rows of rowsByFocus.values()) {
    const sorted = [...rows].sort((a, b) =>
      getRowDifficultyScore(a) - getRowDifficultyScore(b)
      || normalizeWord(a?.word).localeCompare(normalizeWord(b?.word))
    );
    const picks = new Set();
    for (let index = 0; index < Math.min(perFocus, sorted.length); index += 1) {
      const position = perFocus <= 1
        ? 0
        : Math.round(index * (sorted.length - 1) / (perFocus - 1));
      picks.add(sorted[position]);
    }
    for (const row of picks) {
      selectedByWord.set(normalizeWord(row?.word), row);
    }
  }

  return [...selectedByWord.values()].sort((a, b) =>
    getRowPrimaryFocus(a).localeCompare(getRowPrimaryFocus(b))
    || getRowDifficultyScore(a) - getRowDifficultyScore(b)
    || normalizeWord(a?.word).localeCompare(normalizeWord(b?.word))
  );
}

function buildCellSelectorRows(fullWordRows = [], { focus = "" } = {}) {
  const cleanFocus = normalizeToken(focus);
  const selectedByWord = new Map();
  for (const row of Array.isArray(fullWordRows) ? fullWordRows : []) {
    if (hasTargetLink(row, cleanFocus)) {
      selectedByWord.set(normalizeWord(row?.word), row);
    }
  }
  for (const row of buildCooldownFallbackSubsetRows(fullWordRows, {
    focus: cleanFocus,
    candidateWord: "",
    perFocus: CELL_FALLBACK_ROWS_PER_FOCUS,
  })) {
    selectedByWord.set(normalizeWord(row?.word), row);
  }
  return [...selectedByWord.values()].sort((a, b) => {
    const aExact = hasTargetLink(a, cleanFocus);
    const bExact = hasTargetLink(b, cleanFocus);
    if (aExact !== bExact) return Number(bExact) - Number(aExact);
    return getRowPrimaryFocus(a).localeCompare(getRowPrimaryFocus(b))
      || getRowDifficultyScore(a) - getRowDifficultyScore(b)
      || normalizeWord(a?.word).localeCompare(normalizeWord(b?.word));
  });
}

function buildCooldownPressureProbe({
  profileId,
  target,
  profile,
  fullWordRows,
  rawWordById,
} = {}) {
  const focus = normalizeToken(target?.focus_grapheme || "");
  const pupilId = `audit-cooldown-${profileId}-${focus}`;
  const singleTargetProbe = runSelectorProbe(browserEngine, {
    focus,
    profileId,
    wordRows: fullWordRows,
    count: 1,
  });
  const candidateWord = singleTargetProbe.selectedWords[0] || "";
  if (!candidateWord) {
    return {
      status: "not_applicable_no_target_candidate",
      candidateWord: null,
      canRelaxSafely: null,
      selectedRecentlySecure: false,
      completeAssignment: false,
      selectedExactTargetCount: 0,
      issue: null,
    };
  }

  const candidateRow = fullWordRows.find((row) => normalizeWord(row?.word) === candidateWord && hasTargetLink(row, focus));
  if (!candidateRow) {
    return {
      status: "audit_integrity_missing_candidate_row",
      candidateWord,
      canRelaxSafely: false,
      selectedRecentlySecure: false,
      completeAssignment: false,
      selectedExactTargetCount: 0,
      issue: "candidate row selected by selector probe was not found in mapped rows",
    };
  }

  const constrainedRows = buildCooldownFallbackSubsetRows(fullWordRows, {
    focus,
    candidateWord,
  });
  const attempt = buildRecentSecureAttempt({
    pupilId,
    word: candidateWord,
    focus,
    segments: candidateRow?.segments || [],
  });
  const browserPlan = buildPlanWithEngine(browserEngine, {
    pupilId,
    profile,
    wordRows: constrainedRows,
    attempts: [attempt],
  });
  const edgePlan = buildPlanWithEngine(edgeEngine, {
    pupilId,
    profile,
    wordRows: constrainedRows,
    attempts: [attempt],
  });
  const browserSignature = stablePlanSignature(browserPlan);
  const edgeSignature = stablePlanSignature(edgePlan);
  const words = normalizeSelectedWords(browserPlan);
  const invalidSelections = validateSelectedWords(words, rawWordById);
  const duplicates = duplicateWordsFor(words);
  const completeAssignment = !browserPlan?.error && words.length === ASSIGNMENT_LENGTH;
  const selectedRecentlySecure = words.some((word) => normalizeWord(word?.word) === candidateWord);
  const exactCount = selectedExactTargetCount(words, focus);
  const parityMatch = JSON.stringify(browserSignature) === JSON.stringify(edgeSignature);
  const canRelaxSafely = completeAssignment
    && selectedRecentlySecure
    && exactCount >= 1
    && invalidSelections.length === 0
    && duplicates.length === 0
    && parityMatch;

  return {
    status: canRelaxSafely ? "relaxed_safely" : "failed",
    candidateWord,
    canRelaxSafely,
    selectedRecentlySecure,
    completeAssignment,
    selectedExactTargetCount: exactCount,
    constrainedTargetCandidateCount: 1,
    warningCount: stableCoverageWarnings(browserPlan?.coverageWarnings).length,
    coverageWarnings: stableCoverageWarnings(browserPlan?.coverageWarnings),
    browserEdgeParity: {
      match: parityMatch,
    },
    invalidSelectionCount: invalidSelections.length,
    duplicateWords: duplicates,
    issue: canRelaxSafely ? null : "recently secure target candidate was not safely reusable under constrained coverage",
  };
}

export function buildSelectorLogicFailures({
  focus,
  profileId,
  duplicateWords,
  invalidSelections,
  parityMatch,
  cooldownPressure,
} = {}) {
  const failures = [];
  if (duplicateWords.length) {
    failures.push({
      type: "duplicate_selected_words",
      focusGrapheme: focus,
      profileId,
      words: duplicateWords,
    });
  }
  for (const invalid of invalidSelections) {
    failures.push({
      type: "invalid_selected_source_row",
      focusGrapheme: focus,
      profileId,
      ...invalid,
    });
  }
  if (!parityMatch) {
    failures.push({
      type: "browser_edge_mismatch",
      focusGrapheme: focus,
      profileId,
    });
  }
  if (cooldownPressure?.canRelaxSafely === false && cooldownPressure?.status !== "not_applicable_no_target_candidate") {
    failures.push({
      type: "cooldown_relaxation_failed",
      focusGrapheme: focus,
      profileId,
      candidateWord: cooldownPressure.candidateWord,
      issue: cooldownPressure.issue,
    });
  }
  return failures;
}

export function gradeCell({
  completeAssignment,
  selectedExactCount,
  requestedTargetCount,
  requestedAvailableCount,
  bufferAvailableCount,
  wideningRequired,
  lowBankWarningCount,
  targetShortfall,
  selectorLogicFailureCount,
} = {}) {
  if (selectorLogicFailureCount > 0) return "red";
  if (!completeAssignment || selectedExactCount === 0) return "red";
  if (
    selectedExactCount < requestedTargetCount
    || requestedAvailableCount < requestedTargetCount
    || bufferAvailableCount < TARGET_BUFFER_COUNT
    || wideningRequired
    || lowBankWarningCount > 0
    || targetShortfall > 0
  ) {
    return "amber";
  }
  return "green";
}

export function classifyIssue({ selectorLogicFailureCount, status } = {}) {
  if (selectorLogicFailureCount > 0) return "selector_logic";
  if (status === "green") return "none";
  return "coverage";
}

function buildCellReport({
  target,
  profileDefinition,
  inputs,
} = {}) {
  const focus = normalizeToken(target?.focus_grapheme || "");
  const profileId = profileDefinition.id;
  const pupilId = `audit-clean-${profileId}-${focus}`;
  const cellWordRows = buildCellSelectorRows(inputs.mappedWordRows, { focus });
  const browserPlan = buildPlanWithEngine(browserEngine, {
    pupilId,
    profile: profileDefinition.profile,
    wordRows: cellWordRows,
  });
  const edgePlan = buildPlanWithEngine(edgeEngine, {
    pupilId,
    profile: profileDefinition.profile,
    wordRows: cellWordRows,
  });
  const browserSignature = stablePlanSignature(browserPlan);
  const edgeSignature = stablePlanSignature(edgePlan);
  const parityMatch = JSON.stringify(browserSignature) === JSON.stringify(edgeSignature);
  const words = normalizeSelectedWords(browserPlan);
  const completeAssignment = !browserPlan?.error && words.length === ASSIGNMENT_LENGTH;
  const duplicateWords = duplicateWordsFor(words);
  const invalidSelections = validateSelectedWords(words, inputs.rawWordById);
  const requestedTargetCount = Math.max(0, Number(browserPlan?.composition?.target || 0));
  const exactSelectedCount = selectedExactTargetCount(words, focus);
  const targetShortfall = Math.max(0, requestedTargetCount - exactSelectedCount);
  const lowBankWarnings = stableCoverageWarnings(browserPlan?.coverageWarnings)
    .filter((warning) => warning.type === "target_coverage_low");
  const requestedProbe = runSelectorProbe(browserEngine, {
    focus,
    profileId,
    wordRows: cellWordRows,
    count: requestedTargetCount,
  });
  const bufferProbe = runSelectorProbe(browserEngine, {
    focus,
    profileId,
    wordRows: cellWordRows,
    count: TARGET_BUFFER_COUNT,
  });
  const cooldownPressure = buildCooldownPressureProbe({
    profileId,
    target,
    profile: profileDefinition.profile,
    fullWordRows: cellWordRows,
    rawWordById: inputs.rawWordById,
  });
  const selectorLogicFailures = buildSelectorLogicFailures({
    focus,
    profileId,
    duplicateWords,
    invalidSelections,
    parityMatch,
    cooldownPressure,
  });
  const status = gradeCell({
    completeAssignment,
    selectedExactCount: exactSelectedCount,
    requestedTargetCount,
    requestedAvailableCount: requestedProbe.availableCount,
    bufferAvailableCount: bufferProbe.availableCount,
    wideningRequired: requestedProbe.widened,
    lowBankWarningCount: lowBankWarnings.length,
    targetShortfall,
    selectorLogicFailureCount: selectorLogicFailures.length,
  });

  return {
    focusGrapheme: focus,
    displayLabel: target.display_label,
    stageBand: target.stage_band,
    challengeBand: target.challenge_band,
    sortOrder: target.sort_order,
    profileId,
    matrixKind: profileDefinition.matrixKind,
    selectorCandidateCount: cellWordRows.length,
    status,
    issueClass: classifyIssue({ selectorLogicFailureCount: selectorLogicFailures.length, status }),
    completeAssignment,
    planError: String(browserPlan?.error || ""),
    assignmentLength: words.length,
    requestedTargetCount,
    requestedTargetWordsAvailable: requestedProbe.availableCount,
    selectedExactTargetCount: exactSelectedCount,
    targetShortfall,
    widenedDifficultyWindowRequired: requestedProbe.widened,
    widenedWindowSatisfiedRequest: requestedProbe.status === browserEngine.APPROVED_TARGET_SELECTOR_STATUS_READY && requestedProbe.widened,
    targetAvailabilityProbe: requestedProbe,
    targetBufferProbe: bufferProbe,
    reviewFallback: {
      reviewWordCount: words.filter((word) => normalizeMetadataKey(word?.assignmentRole || word?.assignment_role) === "review").length,
      stretchWordCount: words.filter((word) => normalizeMetadataKey(word?.assignmentRole || word?.assignment_role) === "stretch").length,
      targetShortfallFilledByNonTargetWords: targetShortfall,
      required: targetShortfall > 0,
    },
    coverageWarnings: lowBankWarnings,
    lowBankWarningProduced: lowBankWarnings.length > 0,
    duplicateWords,
    invalidSelections,
    browserEdgeParity: {
      match: parityMatch,
      ...(parityMatch ? {} : { browserSignature, edgeSignature }),
    },
    cooldownPressure,
    selectorLogicFailures,
    selectedWords: browserSignature.words,
    roleCounts: roleCounts(words),
    supportCounts: supportCounts(words),
    questionTypeCounts: questionTypeCounts(words),
  };
}

function summarizeCells(cells = []) {
  const safeCells = Array.isArray(cells) ? cells : [];
  const totals = {
    cellCount: safeCells.length,
    green: 0,
    amber: 0,
    red: 0,
    coverageIssueCount: 0,
    selectorLogicIssueCount: 0,
    completeAssignmentCount: 0,
    lowBankWarningCount: 0,
    widenedWindowCount: 0,
    targetShortfallCount: 0,
    duplicateIssueCount: 0,
    invalidSelectionIssueCount: 0,
    browserEdgeMismatchCount: 0,
    cooldownRelaxedCount: 0,
    cooldownNotApplicableCount: 0,
  };
  for (const cell of safeCells) {
    incrementCount(totals, cell.status);
    if (cell.issueClass === "coverage") totals.coverageIssueCount += 1;
    if (cell.issueClass === "selector_logic") totals.selectorLogicIssueCount += 1;
    if (cell.completeAssignment) totals.completeAssignmentCount += 1;
    if (cell.lowBankWarningProduced) totals.lowBankWarningCount += 1;
    if (cell.widenedDifficultyWindowRequired) totals.widenedWindowCount += 1;
    if (cell.targetShortfall > 0) totals.targetShortfallCount += 1;
    if (cell.duplicateWords.length) totals.duplicateIssueCount += 1;
    if (cell.invalidSelections.length) totals.invalidSelectionIssueCount += 1;
    if (!cell.browserEdgeParity.match) totals.browserEdgeMismatchCount += 1;
    if (cell.cooldownPressure?.canRelaxSafely === true) totals.cooldownRelaxedCount += 1;
    if (cell.cooldownPressure?.status === "not_applicable_no_target_candidate") totals.cooldownNotApplicableCount += 1;
  }
  return totals;
}

function summarizeProfiles(cells = []) {
  return ALL_PROFILE_IDS.map((profileId) => {
    const profileCells = cells.filter((cell) => cell.profileId === profileId);
    return {
      profileId,
      matrixKind: HEADLINE_PROFILE_IDS.includes(profileId) ? "headline_pupil_profile" : "diagnostic_selector_band",
      totals: summarizeCells(profileCells),
    };
  });
}

function buildWeakestGraphemeSummary(cells = []) {
  const byFocus = new Map();
  for (const cell of Array.isArray(cells) ? cells : []) {
    const focus = normalizeToken(cell.focusGrapheme);
    if (!focus) continue;
    const current = byFocus.get(focus) || {
      focusGrapheme: focus,
      statuses: { green: 0, amber: 0, red: 0 },
      worstStatus: "green",
      minRequestedTargetWordsAvailable: Number.POSITIVE_INFINITY,
      minSelectedExactTargetCount: Number.POSITIVE_INFINITY,
      totalTargetShortfall: 0,
      totalLowBankWarnings: 0,
      widenedWindowCount: 0,
      selectorLogicFailureCount: 0,
      issueClasses: {},
      profiles: [],
    };
    incrementCount(current.statuses, cell.status);
    if ((STATUS_WEIGHT[cell.status] || 0) > (STATUS_WEIGHT[current.worstStatus] || 0)) {
      current.worstStatus = cell.status;
    }
    current.minRequestedTargetWordsAvailable = Math.min(
      current.minRequestedTargetWordsAvailable,
      Math.max(0, Number(cell.requestedTargetWordsAvailable || 0)),
    );
    current.minSelectedExactTargetCount = Math.min(
      current.minSelectedExactTargetCount,
      Math.max(0, Number(cell.selectedExactTargetCount || 0)),
    );
    current.totalTargetShortfall += Math.max(0, Number(cell.targetShortfall || 0));
    current.totalLowBankWarnings += Array.isArray(cell.coverageWarnings) ? cell.coverageWarnings.length : 0;
    current.widenedWindowCount += cell.widenedDifficultyWindowRequired ? 1 : 0;
    current.selectorLogicFailureCount += Array.isArray(cell.selectorLogicFailures) ? cell.selectorLogicFailures.length : 0;
    incrementCount(current.issueClasses, cell.issueClass || "none");
    current.profiles.push({
      profileId: cell.profileId,
      status: cell.status,
      issueClass: cell.issueClass,
      selectedExactTargetCount: cell.selectedExactTargetCount,
      requestedTargetWordsAvailable: cell.requestedTargetWordsAvailable,
      targetShortfall: cell.targetShortfall,
      widenedDifficultyWindowRequired: cell.widenedDifficultyWindowRequired,
      lowBankWarningProduced: cell.lowBankWarningProduced,
    });
    byFocus.set(focus, current);
  }

  return [...byFocus.values()]
    .map((item) => ({
      ...item,
      minRequestedTargetWordsAvailable: Number.isFinite(item.minRequestedTargetWordsAvailable)
        ? item.minRequestedTargetWordsAvailable
        : 0,
      minSelectedExactTargetCount: Number.isFinite(item.minSelectedExactTargetCount)
        ? item.minSelectedExactTargetCount
        : 0,
    }))
    .sort((a, b) =>
      (STATUS_WEIGHT[b.worstStatus] || 0) - (STATUS_WEIGHT[a.worstStatus] || 0)
      || b.selectorLogicFailureCount - a.selectorLogicFailureCount
      || (b.statuses.red || 0) - (a.statuses.red || 0)
      || (b.statuses.amber || 0) - (a.statuses.amber || 0)
      || a.minSelectedExactTargetCount - b.minSelectedExactTargetCount
      || a.minRequestedTargetWordsAvailable - b.minRequestedTargetWordsAvailable
      || b.totalTargetShortfall - a.totalTargetShortfall
      || b.totalLowBankWarnings - a.totalLowBankWarnings
      || a.focusGrapheme.localeCompare(b.focusGrapheme)
    );
}

function flattenSelectorLogicFailures(cells = []) {
  return (Array.isArray(cells) ? cells : [])
    .flatMap((cell) => (cell.selectorLogicFailures || []).map((failure) => ({
      ...failure,
      focusGrapheme: failure.focusGrapheme || cell.focusGrapheme,
      profileId: failure.profileId || cell.profileId,
      matrixKind: cell.matrixKind,
    })));
}

export function buildCoreBankSelectorCoverageAuditReport({ source = readCoreBankSource() } = {}) {
  const inputs = buildCoreBankSelectorInputs(source);
  const composition = browserEngine.buildAutoAssignmentComposition(ASSIGNMENT_LENGTH);
  const cells = [];

  for (const target of inputs.activeTargets) {
    for (const profileId of ALL_PROFILE_IDS) {
      if (!VALID_PROFILE_IDS.has(profileId)) continue;
      const profileDefinition = buildProfileDefinition(target, inputs.activeTargets, profileId);
      cells.push(buildCellReport({
        target,
        profileDefinition,
        inputs,
      }));
    }
  }

  const headlineCells = cells.filter((cell) => cell.matrixKind === "headline_pupil_profile");
  const diagnosticCells = cells.filter((cell) => cell.matrixKind === "diagnostic_selector_band");
  const selectorLogicFailures = flattenSelectorLogicFailures(cells);
  const report = {
    auditVersion: AUDIT_VERSION,
    generatedAt: AUDIT_NOW_ISO,
    source: {
      path: "data/wordloom-core-bank-v1.json",
      sourceVersion: String(inputs.metadata?.source_version || ""),
      sourceStatus: String(inputs.metadata?.status || ""),
      activeTargetCount: inputs.activeTargets.length,
      sourceWordCount: inputs.sourceWordRows.length,
      mappedUsableWordCount: inputs.mappedWordRows.length,
    },
    assignmentLength: ASSIGNMENT_LENGTH,
    expectedComposition: composition,
    headlineProfileIds: HEADLINE_PROFILE_IDS,
    diagnosticSelectorBandIds: DIAGNOSTIC_PROFILE_IDS,
    totals: summarizeCells(cells),
    headlineTotals: summarizeCells(headlineCells),
    diagnosticTotals: summarizeCells(diagnosticCells),
    profileTotals: summarizeProfiles(cells),
    weakestGraphemes: buildWeakestGraphemeSummary(headlineCells),
    diagnosticWeakestGraphemes: buildWeakestGraphemeSummary(diagnosticCells),
    selectorLogicFailures,
    auditIntegrity: {
      passed: selectorLogicFailures.length === 0,
      failureCount: selectorLogicFailures.length,
    },
    cells,
  };
  return report;
}

function formatTotals(totals = {}) {
  return [
    `cells:${totals.cellCount || 0}`,
    `green:${totals.green || 0}`,
    `amber:${totals.amber || 0}`,
    `red:${totals.red || 0}`,
    `coverage:${totals.coverageIssueCount || 0}`,
    `selector:${totals.selectorLogicIssueCount || 0}`,
  ].join(" ");
}

function formatWeakest(items = [], limit = 10) {
  return (Array.isArray(items) ? items : [])
    .slice(0, limit)
    .map((item) => `${item.focusGrapheme}:${item.worstStatus}:exact${item.minSelectedExactTargetCount}:avail${item.minRequestedTargetWordsAvailable}:short${item.totalTargetShortfall}`)
    .join(", ") || "none";
}

export function printCoreBankSelectorCoverageSummary(report = {}) {
  console.log("CORE_BANK_SELECTOR_COVERAGE_AUDIT_SUMMARY");
  console.log(`version ${report.auditVersion} generatedAt ${report.generatedAt}`);
  console.log(`source ${report.source?.sourceVersion || "unknown"} activeTargets ${report.source?.activeTargetCount || 0} usableWords ${report.source?.mappedUsableWordCount || 0}`);
  console.log(`headlineProfiles ${report.headlineProfileIds?.join(",") || ""} ${formatTotals(report.headlineTotals)}`);
  console.log(`diagnosticSelectorBands ${report.diagnosticSelectorBandIds?.join(",") || ""} ${formatTotals(report.diagnosticTotals)}`);
  console.log(`allCells ${formatTotals(report.totals)}`);
  console.log(`weakestHeadline ${formatWeakest(report.weakestGraphemes)}`);
  console.log(`weakestDiagnostic ${formatWeakest(report.diagnosticWeakestGraphemes, 5)}`);
  console.log(`selectorLogicFailures ${report.selectorLogicFailures?.length || 0}`);
  console.log(`CORE_BANK_SELECTOR_COVERAGE_AUDIT_JSON ${JSON.stringify(report)}`);
}

function isDirectRun() {
  return !!process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isDirectRun()) {
  const jsonOnly = process.argv.includes("--json");
  const report = buildCoreBankSelectorCoverageAuditReport();
  if (jsonOnly) {
    console.log(JSON.stringify(report));
  } else {
    printCoreBankSelectorCoverageSummary(report);
  }
  if (!report.auditIntegrity.passed) {
    process.exitCode = 1;
  }
}
