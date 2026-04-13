import { supabase } from "./supabaseClient.js";
import { chooseBestFocusGrapheme } from "./data/phonemeHelpers.js";
import {
  ASSIGNMENT_ENGINE_TARGET_SOURCE,
  isFullyGeneratedAssignmentWordRows,
} from "./assignmentEngine.js";

const ASSIGNMENT_TARGET_TABLE = "assignment_pupil_target_words";
const DEFAULT_TARGETS_PER_PUPIL = 3;

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLimitPerPupil(value, { fallback = DEFAULT_TARGETS_PER_PUPIL, allowZero = false } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;

  const rounded = Math.round(num);
  if (allowZero && rounded <= 0) return 0;
  return Math.max(1, Math.min(10, rounded));
}

function isMissingTargetTableError(error) {
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

export function normalizeTargetRow(row) {
  return {
    id: String(row?.id || ""),
    teacherId: String(row?.teacher_id || row?.teacherId || ""),
    assignmentId: String(row?.assignment_id || row?.assignmentId || ""),
    pupilId: String(row?.pupil_id || row?.pupilId || ""),
    testWordId: String(row?.test_word_id || row?.testWordId || ""),
    focusGrapheme: normalizeToken(row?.focus_grapheme || row?.focusGrapheme || ""),
    targetSource: String(row?.target_source || row?.targetSource || "analytics"),
    targetReason: String(row?.target_reason || row?.targetReason || "focus_grapheme"),
    createdAt: row?.created_at || row?.createdAt || null,
  };
}

function focusFromWordRow(wordRow) {
  const focusChoices = Array.isArray(wordRow?.choice?.focus_graphemes)
    ? wordRow.choice.focus_graphemes.map((item) => normalizeToken(item)).filter(Boolean)
    : [];
  if (focusChoices[0]) return focusChoices[0];

  const segments = Array.isArray(wordRow?.segments)
    ? wordRow.segments.map((item) => normalizeToken(item)).filter(Boolean)
    : [];
  return normalizeToken(chooseBestFocusGrapheme(segments));
}

function isBuilderTargetWordRow(wordRow) {
  const source = String(wordRow?.choice?.source || "").trim().toLowerCase();
  return source === "analytics_target" || !!wordRow?.choice?.targeted_support;
}

function analyticsTargetForAttempt(attempt) {
  const focus = normalizeToken(attempt?.focus_grapheme);
  if (focus) return focus;

  const targetGraphemes = Array.isArray(attempt?.target_graphemes)
    ? attempt.target_graphemes.map((item) => normalizeToken(item)).filter(Boolean)
    : [];
  const best = normalizeToken(chooseBestFocusGrapheme(targetGraphemes));
  if (best) return best;

  return normalizeToken(attempt?.pattern_type) || "general";
}

function buildLatestHistoryByPupilWord(attempts) {
  const latestByPupilWord = new Map();

  for (const attempt of attempts || []) {
    const pupilId = String(attempt?.pupil_id || "");
    const testWordId = String(attempt?.test_word_id || "");
    if (!pupilId || !testWordId) continue;

    const key = `${pupilId}::${testWordId}`;
    if (latestByPupilWord.has(key)) continue;
    latestByPupilWord.set(key, attempt);
  }

  return latestByPupilWord;
}

function buildLatestHistoryByPupil(latestByPupilWord) {
  const latestByPupil = new Map();

  for (const attempt of latestByPupilWord.values()) {
    const pupilId = String(attempt?.pupil_id || "");
    if (!pupilId) continue;
    const next = latestByPupil.get(pupilId) || [];
    next.push(attempt);
    latestByPupil.set(pupilId, next);
  }

  return latestByPupil;
}

function buildRecentIncorrectHistoryByPupil(attempts) {
  const recentByPupil = new Map();

  for (const attempt of attempts || []) {
    if (attempt?.correct) continue;
    const pupilId = String(attempt?.pupil_id || "");
    if (!pupilId) continue;

    const next = recentByPupil.get(pupilId) || [];
    const testWordId = String(attempt?.test_word_id || "");
    const focusGrapheme = analyticsTargetForAttempt(attempt);
    const word = normalizeWord(attempt?.word_text || "");
    const dedupeKey = testWordId || word || `focus:${focusGrapheme || "general"}`;
    if (!dedupeKey) continue;
    if (next.some((item) => item.dedupeKey === dedupeKey)) continue;

    next.push({
      dedupeKey,
      testWordId,
      word,
      focusGrapheme,
      createdAt: attempt?.created_at || null,
    });
    recentByPupil.set(pupilId, next);
  }

  return recentByPupil;
}

function buildWeakFocusStatsMap(attempts) {
  const stats = new Map();

  for (const attempt of attempts || []) {
    const target = analyticsTargetForAttempt(attempt);
    if (!target || target === "general") continue;

    const current = stats.get(target) || {
      target,
      total: 0,
      correct: 0,
      incorrect: 0,
      attemptTotal: 0,
    };

    current.total += 1;
    if (attempt?.correct) current.correct += 1;
    else current.incorrect += 1;
    current.attemptTotal += Math.max(1, Number(attempt?.attempt_number || 1));
    stats.set(target, current);
  }

  return new Map(
    Array.from(stats.values())
      .map((item) => ({
        ...item,
        accuracy: item.total ? item.correct / item.total : 0,
        averageAttempts: item.total ? item.attemptTotal / item.total : 0,
      }))
      .filter((item) => item.total >= 2 && (item.accuracy < 0.8 || item.incorrect > 0 || item.averageAttempts > 1.4))
      .map((item) => [item.target, item])
  );
}

function buildLatestHistoryByPupilText(attempts) {
  const latestByPupilText = new Map();

  for (const attempt of attempts || []) {
    const pupilId = String(attempt?.pupil_id || "");
    const word = normalizeWord(attempt?.word_text || "");
    if (!pupilId || !word) continue;

    const key = `${pupilId}::${word}`;
    if (latestByPupilText.has(key)) continue;
    latestByPupilText.set(key, attempt);
  }

  return latestByPupilText;
}

function scoreAssignmentWordTarget({
  pupilId,
  wordMeta,
  latestByPupilWord,
  latestByPupilText,
  weakFocusStats,
  recentIncorrectRows,
}) {
  const latestWordAttempt =
    latestByPupilWord.get(`${pupilId}::${wordMeta.testWordId}`)
    || latestByPupilText.get(`${pupilId}::${wordMeta.word}`)
    || null;
  const focusGrapheme = wordMeta.focusGrapheme || "";

  if (latestWordAttempt) {
    const attemptsUsed = Math.max(1, Number(latestWordAttempt?.attempt_number || 1));
    if (!latestWordAttempt?.correct) {
      return {
        ...wordMeta,
        focusGrapheme: focusGrapheme || analyticsTargetForAttempt(latestWordAttempt),
        targetReason: "same_word_incorrect",
        targetSource: "analytics",
        score: 180 + attemptsUsed * 6,
      };
    }

    if (attemptsUsed > 1) {
      return {
        ...wordMeta,
        focusGrapheme: focusGrapheme || analyticsTargetForAttempt(latestWordAttempt),
        targetReason: "same_word_retry",
        targetSource: "analytics",
        score: 135 + attemptsUsed * 4,
      };
    }
  }

  const recentIncorrectIndex = (recentIncorrectRows || []).findIndex((item) => item?.word && item.word === wordMeta.word);
  if (recentIncorrectIndex >= 0) {
    return {
      ...wordMeta,
      focusGrapheme: focusGrapheme || recentIncorrectRows[recentIncorrectIndex]?.focusGrapheme || "",
      targetReason: "recent_incorrect_word",
      targetSource: "analytics",
      score: 150 - recentIncorrectIndex,
    };
  }

  if (!focusGrapheme) return null;
  const focusStats = weakFocusStats.get(focusGrapheme);
  if (focusStats) {
    return {
      ...wordMeta,
      focusGrapheme,
      targetReason: "focus_grapheme",
      targetSource: "analytics",
      score: 80 + (1 - focusStats.accuracy) * 40 + focusStats.incorrect * 8 + Math.max(0, focusStats.averageAttempts - 1) * 12,
    };
  }

  const recentFocusIndex = (recentIncorrectRows || []).findIndex((item) => item?.focusGrapheme === focusGrapheme);
  if (recentFocusIndex < 0) return null;

  return {
    ...wordMeta,
    focusGrapheme,
    targetReason: "recent_incorrect_word",
    targetSource: "analytics",
    score: 60 - recentFocusIndex,
  };
}

function flattenTeacherWordRows(tests) {
  return (tests || []).flatMap((test) =>
    (Array.isArray(test?.test_words) ? test.test_words : [])
      .map((wordRow) => ({
        ...wordRow,
        test_id: String(wordRow?.test_id || test?.id || ""),
      }))
  );
}

function preferCorpusCandidate(existing, candidate) {
  if (!existing) return candidate;
  if (existing.isCurrentTestWord !== candidate.isCurrentTestWord) {
    return existing.isCurrentTestWord ? candidate : existing;
  }
  if (existing.isBuilderTarget !== candidate.isBuilderTarget) {
    return candidate.isBuilderTarget ? candidate : existing;
  }
  if (existing.position !== candidate.position) {
    return existing.position < candidate.position ? existing : candidate;
  }
  return String(existing.testWordId || "").localeCompare(String(candidate.testWordId || "")) <= 0
    ? existing
    : candidate;
}

function buildCorpusWordCandidates(wordRows, { currentTestId = "" } = {}) {
  const deduped = new Map();

  for (const wordRow of wordRows || []) {
    const testWordId = String(wordRow?.id || "");
    const word = normalizeWord(wordRow?.word || "");
    if (!testWordId || !word) continue;

    const candidate = {
      testWordId,
      testId: String(wordRow?.test_id || ""),
      word,
      wordLabel: String(wordRow?.word || "").trim() || "Unknown word",
      position: Number(wordRow?.position || 0),
      focusGrapheme: focusFromWordRow(wordRow),
      isBuilderTarget: isBuilderTargetWordRow(wordRow),
      isCurrentTestWord: String(wordRow?.test_id || "") === String(currentTestId || ""),
    };
    deduped.set(word, preferCorpusCandidate(deduped.get(word), candidate));
  }

  return Array.from(deduped.values());
}

function buildGeneratedTargetRows({
  teacherId,
  assignmentId,
  pupilIds,
  wordRows,
  teacherWordRows = [],
  currentTestId = "",
  historyAttempts,
  createdAt = null,
  limitPerPupil = DEFAULT_TARGETS_PER_PUPIL,
}) {
  const perPupilLimit = normalizeLimitPerPupil(limitPerPupil, {
    fallback: DEFAULT_TARGETS_PER_PUPIL,
    allowZero: true,
  });
  if (perPupilLimit < 1) return [];

  const latestByPupilWord = buildLatestHistoryByPupilWord(historyAttempts);
  const latestByPupilText = buildLatestHistoryByPupilText(historyAttempts);
  const latestByPupil = buildLatestHistoryByPupil(latestByPupilWord);
  const recentIncorrectByPupil = buildRecentIncorrectHistoryByPupil(historyAttempts);
  const corpusWordRows = Array.isArray(teacherWordRows) && teacherWordRows.length ? teacherWordRows : wordRows;
  const corpusWords = buildCorpusWordCandidates(corpusWordRows, { currentTestId });

  const createdAtIso = createdAt || new Date().toISOString();
  const rows = [];

  for (const pupilId of pupilIds || []) {
    const weakFocusStats = buildWeakFocusStatsMap(latestByPupil.get(String(pupilId || "")) || []);
    const recentIncorrectRows = recentIncorrectByPupil.get(String(pupilId || "")) || [];
    const scoredCandidates = corpusWords
      .map((wordMeta) => scoreAssignmentWordTarget({
        pupilId: String(pupilId || ""),
        wordMeta,
        latestByPupilWord,
        latestByPupilText,
        weakFocusStats,
        recentIncorrectRows,
      }))
      .filter(Boolean);

    const candidates = scoredCandidates
      .sort((a, b) =>
        Number(!!a.isCurrentTestWord) - Number(!!b.isCurrentTestWord)
        || Number(!!b.isBuilderTarget) - Number(!!a.isBuilderTarget)
        || b.score - a.score
        || a.position - b.position
        || a.word.localeCompare(b.word)
      )
      .slice(0, perPupilLimit);

    for (const candidate of candidates) {
      rows.push(normalizeTargetRow({
        teacher_id: teacherId,
        assignment_id: assignmentId,
        pupil_id: pupilId,
        test_word_id: candidate.testWordId,
        focus_grapheme: candidate.focusGrapheme || null,
        target_source: candidate.targetSource || "analytics",
        target_reason: candidate.targetReason || "focus_grapheme",
        created_at: createdAtIso,
      }));
    }
  }

  return rows;
}

export async function readAssignmentTargetRows(assignmentId) {
  const key = String(assignmentId || "");
  if (!key) return [];

  const { data, error } = await supabase
    .from(ASSIGNMENT_TARGET_TABLE)
    .select("id, teacher_id, assignment_id, pupil_id, test_word_id, focus_grapheme, target_source, target_reason, created_at")
    .eq("assignment_id", key)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTargetTableError(error)) return [];
    throw error;
  }

  return (data || []).map(normalizeTargetRow);
}

export async function persistAssignmentTargetRows({ existingRows, generatedRows }) {
  const desiredKeys = new Set(
    (generatedRows || []).map((row) => `${row.assignmentId}::${row.pupilId}::${row.testWordId}`)
  );
  const staleIds = (existingRows || [])
    .filter((row) => !desiredKeys.has(`${row.assignmentId}::${row.pupilId}::${row.testWordId}`))
    .map((row) => String(row.id || ""))
    .filter(Boolean);

  if (staleIds.length) {
    const { error: deleteError } = await supabase
      .from(ASSIGNMENT_TARGET_TABLE)
      .delete()
      .in("id", staleIds);
    if (deleteError && !isMissingTargetTableError(deleteError)) throw deleteError;
  }

  if (!(generatedRows || []).length) return [];

  const payload = generatedRows.map((row) => ({
    teacher_id: row.teacherId,
    assignment_id: row.assignmentId,
    pupil_id: row.pupilId,
    test_word_id: row.testWordId,
    focus_grapheme: row.focusGrapheme || null,
    target_source: row.targetSource || "analytics",
    target_reason: row.targetReason || "focus_grapheme",
    created_at: row.createdAt || new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from(ASSIGNMENT_TARGET_TABLE)
    .upsert(payload, { onConflict: "assignment_id,pupil_id,test_word_id" })
    .select("id, teacher_id, assignment_id, pupil_id, test_word_id, focus_grapheme, target_source, target_reason, created_at");

  if (error) {
    if (isMissingTargetTableError(error)) return generatedRows;
    throw error;
  }

  return (data || []).map(normalizeTargetRow);
}

export async function syncAssignmentPupilTargetWords({
  teacherId,
  assignmentId,
  classId,
  testId,
  createdAt = null,
  limitPerPupil = DEFAULT_TARGETS_PER_PUPIL,
  force = false,
} = {}) {
  const safeTeacherId = String(teacherId || "");
  const safeAssignmentId = String(assignmentId || "");
  const safeClassId = String(classId || "");
  const safeTestId = String(testId || "");
  const targetLimit = normalizeLimitPerPupil(limitPerPupil, {
    fallback: DEFAULT_TARGETS_PER_PUPIL,
    allowZero: true,
  });
  if (!safeTeacherId || !safeAssignmentId || !safeClassId || !safeTestId) return [];

  const existingRows = await readAssignmentTargetRows(safeAssignmentId);

  const [membershipRes, wordRes, teacherWordRes] = await Promise.all([
    supabase
      .from("pupil_classes")
      .select("pupil_id")
      .eq("class_id", safeClassId)
      .eq("active", true),
    supabase
      .from("test_words")
      .select("id, test_id, word, position, segments, choice")
      .eq("test_id", safeTestId)
      .order("position", { ascending: true }),
    supabase
      .from("tests")
      .select(`
        id,
        test_words (
          id,
          test_id,
          word,
          position,
          segments,
          choice
        )
      `)
      .eq("teacher_id", safeTeacherId),
  ]);

  if (membershipRes.error) throw membershipRes.error;
  if (wordRes.error) throw wordRes.error;
  if (teacherWordRes?.error) throw teacherWordRes.error;

  if (isFullyGeneratedAssignmentWordRows(wordRes.data || [])) {
    // Fully generated assignments persist exact pupil rows during creation. We leave that
    // personalised set intact here instead of re-deriving a generic replacement.
    return existingRows;
  }

  if (existingRows.length && !force) return existingRows;
  if (targetLimit < 1) {
    return await persistAssignmentTargetRows({ existingRows, generatedRows: [] });
  }

  const pupilIds = [...new Set((membershipRes.data || []).map((item) => String(item?.pupil_id || "")).filter(Boolean))];
  if (!pupilIds.length || !(wordRes.data || []).length) {
    return await persistAssignmentTargetRows({ existingRows, generatedRows: [] });
  }

  const cutoff = createdAt || new Date().toISOString();
  const historyLimit = Math.max(600, Math.min(3000, pupilIds.length * 120));
  const { data: historyRows, error: historyError } = await supabase
    .from("attempts")
    .select("pupil_id, test_word_id, correct, attempt_number, created_at, focus_grapheme, pattern_type, target_graphemes, word_text")
    .in("pupil_id", pupilIds)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(historyLimit);

  if (historyError) throw historyError;

  const generatedRows = buildGeneratedTargetRows({
    teacherId: safeTeacherId,
    assignmentId: safeAssignmentId,
    pupilIds,
    wordRows: wordRes.data || [],
    teacherWordRows: flattenTeacherWordRows(teacherWordRes?.data || []),
    currentTestId: safeTestId,
    historyAttempts: historyRows || [],
    createdAt: cutoff,
    limitPerPupil: targetLimit,
  });

  const persistedRows = await persistAssignmentTargetRows({ existingRows, generatedRows });
  console.log("Targeted words generated:", {
    assignmentId: safeAssignmentId,
    pupilCount: pupilIds.length,
    rowCount: persistedRows.length,
    rows: persistedRows.map((row) => ({
      pupilId: row.pupilId,
      testWordId: row.testWordId,
      targetReason: row.targetReason,
      targetSource: row.targetSource,
      focusGrapheme: row.focusGrapheme,
    })),
  });
  return persistedRows;
}

export const ASSIGNMENT_TARGET_SOURCE_ASSIGNMENT_ENGINE = ASSIGNMENT_ENGINE_TARGET_SOURCE;
