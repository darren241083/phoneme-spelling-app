import { supabase } from "./supabaseClient.js";
import {
  markAssignmentComplete,
  markAssignmentSessionOpened,
  normalizeSchoolSummary,
  readPupilBaselineGateState,
  readPupilRuntimeAssignments,
  readAssignmentAttemptRows,
  reconcileAssignmentResultAttempts,
  listApprovedPracticeWordBankRows,
  listPupilPracticeEvidenceAttempts,
  listSpellingBeeResultsForRun,
  readAssignmentPupilStatus,
  saveAssignmentProgress,
  startSpellingBeeResult,
  finalizeSpellingBeeResult,
} from "./db.js?v=1.47";
import { mountGame } from "./game.js?v=1.41";
import { applyAccessibilitySettings, renderAccessibilityControls, saveAccessibilitySettings } from "./accessibility.js";
import { chooseBestFocusGrapheme } from "./data/phonemeHelpers.js";
import { resolveItemAttemptsAllowed } from "./questionTypes.js?v=1.1";
import { renderIcon, renderIconLabel, renderInfoTip } from "./uiIcons.js?v=1.3";
import {
  PRACTICE_EVIDENCE_FETCH_LIMIT,
  PRACTICE_STATUS_NOT_ENOUGH_EVIDENCE,
  PRACTICE_STATUS_NOT_ENOUGH_WORDS,
  PRACTICE_STATUS_READY,
  PRACTICE_WORD_COUNT,
  buildPupilPracticePlan,
  selectTopPracticeGrapheme,
} from "./pupilPractice.js?v=1.0";
import {
  buildDifficultyMapFromWordRows,
  estimateSpellingAttainmentIndicator,
} from "./spellingIndicator.js?v=1.5";
import { shouldIncludeBaselineResponseInHeadlineAttainment } from "./baselinePlacement.js?v=1.5";
import { SPELLING_BEE_LENGTH_MODE_UNTIL_WRONG } from "./autoAssignPolicy.js?v=1.9";
import { buildPupilProgressCardModel } from "./pupilFeedbackModel.js?v=1.1";

const PUPIL_SECTION_LIMIT = 3;
const pupilDashboardState = {
  expandedSections: {
    teacher_tasks: false,
  },
  beeLeaderboardOpenByAssignment: {},
};

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInfoTipParagraphHtml(text, className = "uiInfoTipBody") {
  const value = String(text || "").trim();
  if (!value) return "";
  return `<p class="${escapeHtml(className)}">${escapeHtml(value)}</p>`;
}

function renderPupilInlineInfoTip(
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
    className: ["uiInfoTip--text", "pupilInlineInfoTip", className].filter(Boolean).join(" "),
    triggerClassName: ["uiInfoTipTrigger--text", "pupilInlineInfoTipTrigger", triggerClassName].filter(Boolean).join(" "),
    bubbleClassName: ["pupilInlineInfoTipBubble", bubbleClassName].filter(Boolean).join(" "),
    align,
    triggerHtml: triggerHtml || `<span class="uiInfoTipTriggerText">${escapeHtml(displayValue)}</span>`,
    showIcon: false,
  });
}

function formatDeadline(endAt) {
  if (!endAt) return "No deadline";
  const d = new Date(endAt);
  if (Number.isNaN(d.getTime())) return "No deadline";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const deadlineStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const dayDiff = Math.round((deadlineStart - todayStart) / dayMs);

  if (dayDiff < 0) {
    const overdueDays = Math.abs(dayDiff);
    return overdueDays === 1 ? "Overdue by 1 day" : `Overdue by ${overdueDays} days`;
  }
  if (dayDiff === 0) return "Due today";
  if (dayDiff === 1) return "Due tomorrow";
  return `Due in ${dayDiff} days`;
}

function deadlineClass(endAt) {
  if (!endAt) return "deadline-normal";
  const diffMs = new Date(endAt).getTime() - Date.now();
  const hours = diffMs / (1000 * 60 * 60);
  if (hours < 12) return "deadline-urgent";
  if (hours < 48) return "deadline-warning";
  return "deadline-normal";
}

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function parseDateMs(value) {
  const ms = new Date(value || "").getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function getAssignmentWordKey(word) {
  if (word?.is_target_word) {
    const targetId = String(word.assignment_target_id || word.assignmentTargetId || "").trim();
    return targetId ? `target:${targetId}` : "";
  }
  const wordId = String(word?.id || "").trim();
  return wordId ? `word:${wordId}` : "";
}

function getAssignmentAttemptKey(attempt) {
  const targetId = String(attempt?.assignment_target_id || attempt?.assignmentTargetId || "").trim();
  if (targetId) return `target:${targetId}`;
  const wordId = String(attempt?.test_word_id || attempt?.testWordId || "").trim();
  return wordId ? `word:${wordId}` : "";
}

function getStoredProgressKey(entry) {
  const explicitKey = String(entry?.itemKey || "").trim();
  if (explicitKey) return explicitKey;
  const targetId = String(entry?.assignmentTargetId || entry?.assignment_target_id || "").trim();
  if (targetId) return `target:${targetId}`;
  const wordId = String(entry?.baseTestWordId || entry?.base_test_word_id || entry?.wordId || entry?.word_id || "").trim();
  return wordId ? `word:${wordId}` : "";
}

function normalizeStoredFeedbackState(feedbackState) {
  const source = feedbackState && typeof feedbackState === "object" ? feedbackState : null;
  const kind = String(source?.kind || "").trim().toLowerCase();
  if (kind !== "final_wrong_reveal") return null;

  return {
    kind,
    pending: source?.pending !== false,
  };
}

function hasPendingFinalWrongReveal(entry) {
  return !!entry?.completed
    && !entry?.correct
    && entry?.feedbackState?.kind === "final_wrong_reveal"
    && entry.feedbackState.pending !== false;
}

function getAttemptOrderValue(attempt) {
  const attemptNumber = Number(attempt?.attempt_number ?? attempt?.attempt_no ?? 0);
  if (Number.isFinite(attemptNumber) && attemptNumber > 0) return attemptNumber;
  return 0;
}

function getAttemptTimestampMs(attempt) {
  const ms = new Date(attempt?.created_at || attempt?.createdAt || "").getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function buildAssignmentResumeState(item, statusRow, attemptRows = []) {
  const words = Array.isArray(item?.words) ? item.words : [];
  if (!words.length) return null;

  const snapshotRows = Array.isArray(statusRow?.resultJson ?? statusRow?.result_json)
    ? (statusRow?.resultJson ?? statusRow?.result_json)
    : [];
  const snapshotByKey = new Map(
    snapshotRows
      .map((entry) => [getStoredProgressKey(entry), entry])
      .filter(([key]) => !!key)
  );

  const attemptsByKey = new Map();
  for (const attempt of attemptRows || []) {
    const key = getAssignmentAttemptKey(attempt);
    if (!key) continue;
    const current = attemptsByKey.get(key) || [];
    current.push(attempt);
    attemptsByKey.set(key, current);
  }

  const testMeta = {
    title: getDisplayedAssignmentTitle(item),
    question_type: item?.question_type || "focus_sound",
    mode: item?.mode || "test",
    max_attempts: item?.max_attempts == null ? null : item.max_attempts,
    attempt_source: item?.attempt_source || "test",
    assignmentOrigin: item?.assignmentOrigin || item?.attempt_source || "test",
  };

  const itemStates = words.map((word, index) => {
    const itemKey = getAssignmentWordKey(word);
    if (!itemKey) return null;

    const snapshotEntry = snapshotByKey.get(itemKey) || null;
    const itemAttempts = (attemptsByKey.get(itemKey) || []).slice().sort((a, b) => {
      const attemptDelta = getAttemptOrderValue(a) - getAttemptOrderValue(b);
      if (attemptDelta !== 0) return attemptDelta;
      return getAttemptTimestampMs(a) - getAttemptTimestampMs(b);
    });
    const latestAttempt = itemAttempts[itemAttempts.length - 1] || null;
    const latestIncorrectAttempt = itemAttempts.filter((attempt) => !attempt?.correct).slice(-1)[0] || null;
    const derivedAttemptsUsed = itemAttempts.reduce((max, attempt) => Math.max(max, getAttemptOrderValue(attempt)), 0);
    const snapshotAttemptsUsed = Math.max(0, Number(snapshotEntry?.attemptsUsed || 0));
    const attemptsAllowed = resolveItemAttemptsAllowed(word, testMeta);
    const attemptsUsed = Math.max(derivedAttemptsUsed, snapshotAttemptsUsed);
    const completedFromAttempts = attemptsUsed > 0 && (!!latestAttempt?.correct || attemptsUsed >= attemptsAllowed);
    const completed = snapshotEntry?.completed === true || completedFromAttempts;
    const correct = latestAttempt
      ? !!latestAttempt.correct
      : !!snapshotEntry?.correct;
    const feedbackState = normalizeStoredFeedbackState(snapshotEntry?.feedbackState ?? snapshotEntry?.feedback_state);
    const lastSubmittedIncorrectAnswer = completed
      ? null
      : (
        String(latestIncorrectAttempt?.typed ?? "").trim()
        || String(snapshotEntry?.lastSubmittedIncorrectAnswer ?? snapshotEntry?.last_submitted_incorrect_answer ?? "").trim()
        || null
      );
    const typed = latestAttempt
      ? String(latestAttempt?.typed ?? "").trim()
      : String(snapshotEntry?.typed ?? "").trim();
    const storedInputState = completed && !hasPendingFinalWrongReveal({
      completed,
      correct,
      feedbackState,
    })
      ? null
      : (snapshotEntry?.inputState || null);

    return {
      itemKey,
      index: index + 1,
      wordId: word?.id || null,
      baseTestWordId: word?.base_test_word_id || word?.id || null,
      assignmentTargetId: word?.assignment_target_id || word?.assignmentTargetId || null,
      word: String(word?.word || "").trim(),
      correctSpelling: String(word?.word || "").trim(),
      typed,
      correct,
      completed,
      attemptsUsed,
      attemptsAllowed,
      questionType: snapshotEntry?.questionType || null,
      modeKind: snapshotEntry?.modeKind || null,
      wordSource: snapshotEntry?.wordSource || (word?.is_target_word ? "targeted" : "base"),
      focusGrapheme: snapshotEntry?.focusGrapheme || null,
      patternType: snapshotEntry?.patternType || null,
      targetGraphemes: Array.isArray(snapshotEntry?.targetGraphemes)
        ? snapshotEntry.targetGraphemes
        : (Array.isArray(word?.segments) ? word.segments : []),
      lastSubmittedIncorrectAnswer,
      feedbackState,
      inputState: storedInputState,
    };
  }).filter((entry) => {
    if (!entry) return false;
    if (entry.completed) return true;
    if (entry.attemptsUsed > 0) return true;
    if (String(entry.typed || "").trim()) return true;
    return !!entry.inputState;
  });

  const nextIndex = words.findIndex((word) => {
    const itemKey = getAssignmentWordKey(word);
    const entry = itemStates.find((row) => row?.itemKey === itemKey);
    return !entry?.completed;
  });
  const pendingRevealIndex = words.findIndex((word) => {
    const itemKey = getAssignmentWordKey(word);
    const entry = itemStates.find((row) => row?.itemKey === itemKey);
    return hasPendingFinalWrongReveal(entry);
  });

  return {
    startedAt: statusRow?.startedAt || statusRow?.started_at || null,
    nextIndex: pendingRevealIndex >= 0 ? pendingRevealIndex : (nextIndex >= 0 ? nextIndex : words.length),
    itemStates,
  };
}

function formatCompletedLabel(completedAt) {
  const completedMs = parseDateMs(completedAt);
  if (!completedMs) return "Done";

  const diffMs = Date.now() - completedMs;
  const dayMs = 24 * 60 * 60 * 1000;
  const dayDiff = Math.floor(diffMs / dayMs);
  if (dayDiff <= 0) return "Done today";
  if (dayDiff === 1) return "Done yesterday";
  if (dayDiff < 7) return `Done ${dayDiff}d ago`;

  return `Done ${new Date(completedMs).toLocaleDateString([], { month: "short", day: "numeric" })}`;
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

function buildPupilAttainmentInfoHtml(progress) {
  const indicator = progress?.attainmentIndicator || null;
  const responseCount = Math.max(0, Number(indicator?.responseCount || progress?.wordsChecked || 0));
  const checkedLine = responseCount === 1
    ? "1 checked word is part of this picture so far."
    : `${responseCount} checked words are part of this picture so far.`;
  const confidenceLine = responseCount >= 4
    ? "This picture will keep getting clearer as you finish more checked words."
    : "The app is still getting to know your spelling.";
  return [
    renderInfoTipParagraphHtml("This card shows where your spelling is now and what to work on next."),
    renderInfoTipParagraphHtml("Level shows the shared spelling band that fits your checked work right now.", "uiInfoTipMeta"),
    renderInfoTipParagraphHtml("How it's going shows how often you are getting those spellings right.", "uiInfoTipMeta"),
    renderInfoTipParagraphHtml("Try this next points you to the next kind of spelling to practise.", "uiInfoTipMeta"),
    renderInfoTipParagraphHtml(confidenceLine, "uiInfoTipMeta"),
    renderInfoTipParagraphHtml(checkedLine, "uiInfoTipMeta"),
  ].filter(Boolean).join("");
}

function buildPupilAttainmentPerformance(progress) {
  const indicator = progress?.attainmentIndicator || null;
  const performanceKey = String(indicator?.performanceKey || indicator?.securityKey || "building_profile").trim().toLowerCase();
  if (performanceKey === "emerging") return "Keep practising";
  if (performanceKey === "developing") return "Getting stronger";
  if (performanceKey === "secure") return "Doing well";
  if (performanceKey === "strong") return "Really confident";
  return "Still warming up";
}

function getPupilAttainmentPerformanceHelp(progress) {
  const indicator = progress?.attainmentIndicator || null;
  const performanceKey = String(indicator?.performanceKey || indicator?.securityKey || "building_profile").trim().toLowerCase();
  if (performanceKey === "emerging") return "These spellings are still feeling tricky right now.";
  if (performanceKey === "developing") return "You are getting some right and building confidence.";
  if (performanceKey === "secure") return "You are usually getting these spellings right.";
  if (performanceKey === "strong") return "You are getting these spellings right again and again.";
  return "The app needs a few more checked words to give you a clear picture.";
}

function buildPupilAttainmentSupportingLine(progress) {
  const indicator = progress?.attainmentIndicator || null;
  const responseCount = Math.max(0, Number(indicator?.responseCount || progress?.wordsChecked || 0));
  const bandKey = String(indicator?.attainmentBand?.key || "not_yet_banded").trim().toLowerCase();
  if (responseCount < 4) return "Complete a few more checked words to unlock your next step.";
  if (bandKey === "easier") return "Practise more everyday spellings next.";
  if (bandKey === "core") return "Start trying trickier spellings next.";
  if (bandKey === "stretch") return "Keep pushing into challenge spellings.";
  if (bandKey === "challenge") return "Keep stretching yourself with challenge words.";
  return "Keep going and finish a few more checked words.";
}

function buildPupilAttainmentCardBodyHtml(progress) {
  const indicator = progress?.attainmentIndicator || null;
  const responseCount = Math.max(0, Number(indicator?.responseCount || progress?.wordsChecked || 0));
  const checkedSummary = responseCount === 1
    ? "Based on 1 checked word so far."
    : `Based on ${responseCount} checked words so far.`;
  const levelText = indicator?.attainmentDisplayLabel || "Not yet banded";
  const performanceText = buildPupilAttainmentPerformance(progress);
  const nextStepText = buildPupilAttainmentSupportingLine(progress);
  const levelHtml = renderPupilInlineInfoTip(
    levelText,
    indicator?.levelDefinitionPupil || "You do not have enough checked work yet for the app to estimate your spelling level.",
    "About this level",
    {
      triggerHtml: `<span class="pupilProgressAttainmentValueText uiInfoTipTriggerText">${escapeHtml(levelText)}</span>`,
    },
  );
  const performanceHtml = renderPupilInlineInfoTip(
    performanceText,
    getPupilAttainmentPerformanceHelp(progress),
    "About how it's going",
    {
      triggerHtml: `<span class="pupilProgressStatBadge">${escapeHtml(performanceText)}</span>`,
    },
  );
  return `
    <div class="pupilProgressAttainmentBody">
      <div class="pupilProgressAttainmentHero">
        <div class="pupilProgressAttainmentSectionLabel">Level</div>
        <div class="pupilProgressAttainmentValue">${levelHtml}</div>
        <div class="pupilProgressAttainmentMetaLine">${escapeHtml(checkedSummary)}</div>
      </div>
      <div class="pupilProgressAttainmentPanel">
        <div class="pupilProgressAttainmentSectionLabel">How it's going</div>
        <div class="pupilProgressAttainmentPerformance">${performanceHtml}</div>
      </div>
      <div class="pupilProgressAttainmentPanel">
        <div class="pupilProgressAttainmentSectionLabel">Try this next</div>
        <div class="pupilProgressAttainmentNextStep">${escapeHtml(nextStepText)}</div>
      </div>
    </div>
  `;
}

function buildPupilProgressSnapshot(attempts, difficultyByWordId = new Map(), wordRowsById = new Map()) {
  const latestByWord = new Map();
  for (const attempt of attempts || []) {
    const key = String(attempt?.assignment_target_id || attempt?.test_word_id || attempt?.word_text || "");
    if (!key) continue;
    latestByWord.set(key, attempt);
  }

  const latestRows = Array.from(latestByWord.values());
  const wordsChecked = latestRows.length;
  const correctCount = latestRows.filter((item) => item?.correct).length;
  const accuracy = wordsChecked ? correctCount / wordsChecked : 0;
  const firstTrySuccessRate = wordsChecked
    ? latestRows.filter((item) => item?.correct && Math.max(1, Number(item?.attempt_number || 1)) === 1).length / wordsChecked
    : 0;
  const averageAttempts = wordsChecked
    ? latestRows.reduce((sum, item) => sum + Math.max(1, Number(item?.attempt_number || 1)), 0) / wordsChecked
    : 0;
  const headlineRows = latestRows.filter((item) =>
    shouldIncludeBaselineResponseInHeadlineAttainment(
      item,
      wordRowsById.get(String(item?.test_word_id || ""))
    )
  );
  const headlineChecked = headlineRows.length;
  const headlineCorrect = headlineRows.filter((item) => item?.correct).length;
  const headlineAccuracy = headlineChecked ? headlineCorrect / headlineChecked : 0;
  const headlineFirstTrySuccessRate = headlineChecked
    ? headlineRows.filter((item) => item?.correct && Math.max(1, Number(item?.attempt_number || 1)) === 1).length / headlineChecked
    : 0;
  const headlineAverageAttempts = headlineChecked
    ? headlineRows.reduce((sum, item) => sum + Math.max(1, Number(item?.attempt_number || 1)), 0) / headlineChecked
    : 0;
  const attainmentIndicator = estimateSpellingAttainmentIndicator({
    responses: headlineRows.map((item) => ({
      correct: !!item?.correct,
      difficultyScore: difficultyByWordId.get(String(item?.test_word_id || ""))?.coreScore
        ?? difficultyByWordId.get(String(item?.test_word_id || ""))?.score
        ?? 50,
    })),
    checkedAccuracy: headlineChecked ? headlineAccuracy : null,
    firstTimeCorrectRate: headlineChecked ? headlineFirstTrySuccessRate : null,
    completionRate: null,
    averageAttempts: headlineChecked ? headlineAverageAttempts : null,
  });

  const graphemeStats = new Map();
  for (const attempt of latestRows) {
    const target = analyticsTargetForAttempt(attempt);
    if (!target || target === "general") continue;
    const current = graphemeStats.get(target) || {
      target,
      total: 0,
      correct: 0,
      attemptTotal: 0,
      firstTrySuccessCount: 0,
    };
    current.total += 1;
    if (attempt?.correct) current.correct += 1;
    current.attemptTotal += Math.max(1, Number(attempt?.attempt_number || 1));
    if (attempt?.correct && Math.max(1, Number(attempt?.attempt_number || 1)) === 1) {
      current.firstTrySuccessCount += 1;
    }
    graphemeStats.set(target, current);
  }

  const graphemeRows = Array.from(graphemeStats.values()).map((item) => ({
    ...item,
    accuracy: item.total ? item.correct / item.total : 0,
    averageAttempts: item.total ? item.attemptTotal / item.total : 0,
    firstTrySuccessRate: item.total ? item.firstTrySuccessCount / item.total : 0,
  }));

  const secureNow = graphemeRows
    .filter((item) => item.total >= 2 && item.accuracy >= 0.85 && item.firstTrySuccessRate >= 0.7)
    .sort((a, b) => b.total - a.total || b.accuracy - a.accuracy || a.target.localeCompare(b.target))
    .slice(0, 4);

  const secureTargets = new Set(secureNow.map((item) => item.target));
  const growing = graphemeRows
    .filter((item) => item.total >= 2 && !secureTargets.has(item.target) && item.accuracy >= 0.55)
    .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total || a.target.localeCompare(b.target))
    .slice(0, 4);

  const practiseNext = graphemeRows
    .filter((item) => !secureTargets.has(item.target))
    .sort((a, b) => a.accuracy - b.accuracy || b.averageAttempts - a.averageAttempts || b.total - a.total || a.target.localeCompare(b.target))
    .slice(0, 4);

  const recentWins = latestRows
    .filter((item) => item?.correct)
    .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
    .map((item) => String(item?.word_text || "").trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4);

  return {
    wordsChecked,
    accuracy,
    firstTrySuccessRate,
    averageAttempts,
    attemptHistory: attempts,
    attainmentIndicator,
    secureNow,
    growing,
    practiseNext,
    recentWins,
  };
}

async function loadPupilProgress(pupilId) {
  if (!pupilId) return null;
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("attempts")
    .select("assignment_target_id, test_word_id, correct, attempt_number, created_at, focus_grapheme, pattern_type, word_text, target_graphemes, attempt_source")
    .eq("pupil_id", pupilId)
    .gte("created_at", cutoff)
    .or("attempt_source.is.null,attempt_source.neq.practice")
    .order("created_at", { ascending: true })
    .limit(600);
  if (error) return null;

  const attempts = (data || []).filter((item) => String(item?.attempt_source || "").trim().toLowerCase() !== "practice");
  const testWordIds = [...new Set(
    attempts
      .map((item) => String(item?.test_word_id || "").trim())
      .filter(Boolean)
  )];
  let difficultyByWordId = new Map();
  let wordRowsById = new Map();

  if (testWordIds.length) {
    const { data: wordRows } = await supabase
      .from("test_words")
      .select("id,word,segments,choice")
      .in("id", testWordIds);
    difficultyByWordId = buildDifficultyMapFromWordRows(wordRows || []);
    wordRowsById = new Map((wordRows || []).map((row) => [String(row?.id || ""), row]).filter(([id]) => !!id));
  }

  return buildPupilProgressSnapshot(attempts, difficultyByWordId, wordRowsById);
}

async function loadAssignments(pupilId) {
  const perClass = await readPupilRuntimeAssignments({ pupilId });
  const rows = [];
  const beeRowIndexByRun = new Map();
  for (const item of perClass) {
    if (item?.isSpellingBee && item?.automation_run_id) {
      const runKey = String(item.automation_run_id || "");
      const existingIndex = beeRowIndexByRun.get(runKey);
      if (existingIndex == null) {
        beeRowIndexByRun.set(runKey, rows.length);
        rows.push(item);
        continue;
      }
      const existing = rows[existingIndex];
      if (!existing?.spellingBeeResult && item?.spellingBeeResult) {
        rows[existingIndex] = item;
      }
      continue;
    }
    rows.push(item);
  }
  const assignmentIds = rows
    .filter((r) => !r?.isSpellingBee)
    .map((r) => r.id)
    .filter(Boolean);
  const latestAttemptByAssignmentWord = new Map();
  const nowMs = Date.now();

  if (assignmentIds.length) {
    const { data: attempts } = await supabase
      .from("attempts")
      .select("assignment_id,test_word_id,assignment_target_id,correct,created_at")
      .eq("pupil_id", pupilId)
      .in("assignment_id", assignmentIds)
      .order("created_at", { ascending: true });

    for (const item of attempts || []) {
      const assignmentId = String(item.assignment_id || "");
      if (!assignmentId) continue;
      const wordKey = item.assignment_target_id
        ? `target:${String(item.assignment_target_id)}`
        : item.test_word_id
          ? `word:${String(item.test_word_id)}`
          : "";
      if (!wordKey) continue;
      const current = latestAttemptByAssignmentWord.get(assignmentId) || new Map();
      current.set(wordKey, item);
      latestAttemptByAssignmentWord.set(assignmentId, current);
    }
  }

  const mappedAssignments = rows
    .map((item) => {
      if (item?.isSpellingBee) {
        const result = item?.spellingBeeResult || null;
        const totalWordCount = Math.max(0, Number(result?.max_rounds || item?.words?.length || 0));
        const correctWordCount = Math.max(0, Number(result?.streak || 0));
        const completedAtMs = parseDateMs(result?.completed_at || item?.completed_at || item?.completedAt);
        const dueAtMs = parseDateMs(item?.end_at);
        const isOverdue = !!dueAtMs && dueAtMs <= nowMs;
        return {
          ...item,
          attemptedWordCount: Math.max(0, Number(result?.rounds_attempted || 0)),
          totalWordCount,
          correctWordCount,
          scoreRate: totalWordCount ? correctWordCount / totalWordCount : 0,
          completed: !!completedAtMs,
          completedAt: completedAtMs ? new Date(completedAtMs).toISOString() : null,
          isLocked: !!completedAtMs,
          isOverdue,
          keepVisible: true,
          spellingBeeEventClosed: isOverdue,
          spellingBeeRank: null,
          spellingBeeYearRank: null,
          spellingBeeFormRank: null,
          spellingBeeLeaderboardRows: [],
        };
      }
      const summaryRows = Array.isArray(item?.result_json) ? item.result_json : [];
      const hasSummary = !!item?.completed_at && Math.max(0, Number(item?.total_words || 0)) > 0 && summaryRows.length > 0;
      const wordKeys = (Array.isArray(item?.words) ? item.words : [])
        .map(getAssignmentWordKey)
        .filter(Boolean);
      const latestByWord = latestAttemptByAssignmentWord.get(String(item.id)) || new Map();
      const latestAttempts = wordKeys
        .map((key) => latestByWord.get(key))
        .filter(Boolean);
      const attemptedWordCount = hasSummary ? summaryRows.length : latestAttempts.length;
      const totalWordCount = hasSummary ? Math.max(0, Number(item?.total_words || 0)) : wordKeys.length;
      const correctWordCount = hasSummary
        ? Math.max(0, Number(item?.correct_words || 0))
        : latestAttempts.filter((attempt) => !!attempt?.correct).length;
      const completed = !!item?.completed || (totalWordCount > 0 && attemptedWordCount >= totalWordCount);
      const completedAtMs = parseDateMs(item?.completed_at || item?.completedAt)
        || (completed
          ? latestAttempts.reduce((latest, attempt) => Math.max(latest, parseDateMs(attempt?.created_at)), 0)
          : 0);
      const dueAtMs = parseDateMs(item?.end_at);
      const isOverdue = !!dueAtMs && dueAtMs < nowMs;

      return {
        ...item,
        attemptedWordCount,
        totalWordCount,
        correctWordCount,
        scoreRate: hasSummary
          ? (Number.isFinite(Number(item?.score_rate)) ? Number(item.score_rate) : (totalWordCount ? correctWordCount / totalWordCount : 0))
          : (totalWordCount ? correctWordCount / totalWordCount : 0),
        completed,
        completedAt: completedAtMs ? new Date(completedAtMs).toISOString() : null,
        isLocked: completed,
        isOverdue,
        keepVisible: true,
      };
    })
    .sort((a, b) => {
      if (!!a.completed !== !!b.completed) return a.completed ? 1 : -1;
      if (a.completed && b.completed) {
        return parseDateMs(b.completedAt || b.created_at) - parseDateMs(a.completedAt || a.created_at);
      }
      const aTime = a.end_at ? new Date(a.end_at).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.end_at ? new Date(b.end_at).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });

  const closedBeeRuns = [...new Set(
    mappedAssignments
      .filter((item) => item?.isSpellingBee && item?.completed && item?.spellingBeeEventClosed && item?.automation_run_id)
      .map((item) => String(item.automation_run_id || ""))
      .filter(Boolean)
  )];
  const leaderboardsByRun = new Map();
  await Promise.all(closedBeeRuns.map(async (runId) => {
    const leaderboardRows = await listSpellingBeeResultsForRun({ runId }).catch((error) => {
      console.warn("read spelling bee leaderboard error:", error);
      return [];
    });
    leaderboardsByRun.set(runId, leaderboardRows);
  }));

  return mappedAssignments.map((item) => {
    if (!item?.isSpellingBee || !item?.completed || !item?.spellingBeeEventClosed) return item;
    const leaderboardRows = leaderboardsByRun.get(String(item.automation_run_id || "")) || [];
    const ownRow = leaderboardRows.find((row) => String(row?.pupil_id || "") === String(pupilId || "")) || null;
    return {
      ...item,
      spellingBeeRank: ownRow?.rank || null,
      spellingBeeYearRank: ownRow?.year_rank || null,
      spellingBeeFormRank: ownRow?.form_rank || null,
      spellingBeeLeaderboardRows: leaderboardRows,
    };
  });
}

function formatPracticeFocusLabel(focus) {
  const clean = String(focus || "").trim().toLowerCase();
  if (!clean || clean === "general") return "Mixed";
  return clean;
}

function createEmptyPracticeModel(status = PRACTICE_STATUS_NOT_ENOUGH_EVIDENCE, overrides = {}) {
  return {
    status,
    focusGrapheme: "",
    evidenceCount: 0,
    wordCount: 0,
    packs: [],
    ...overrides,
  };
}

function getPracticePacks(practiceModel = null) {
  if (Array.isArray(practiceModel)) return practiceModel;
  return Array.isArray(practiceModel?.packs) ? practiceModel.packs : [];
}

function normalizePracticeWordRow(row = {}, focus = "", index = 0) {
  const choice = row?.choice && typeof row.choice === "object" ? row.choice : {};
  const focusGrapheme = String(focus || "").trim().toLowerCase();
  return {
    ...row,
    id: String(row?.id || "").trim(),
    base_test_word_id: String(row?.id || "").trim(),
    test_id: String(row?.test_id || "").trim(),
    position: index + 1,
    word_source: "approved_word_bank",
    choice: {
      ...choice,
      question_type: "focus_sound",
      focus_graphemes: focusGrapheme ? [focusGrapheme] : [],
    },
  };
}

function buildPracticePackFromPlan(plan = null) {
  if (!plan || plan.status !== PRACTICE_STATUS_READY || !Array.isArray(plan.words) || plan.words.length !== PRACTICE_WORD_COUNT) {
    return null;
  }
  const focus = String(plan.focusGrapheme || "").trim().toLowerCase();
  const focusLabel = formatPracticeFocusLabel(focus);
  const words = plan.words.map((row, index) => normalizePracticeWordRow(row, focus, index));
  return {
    id: `practice:${focus}`,
    title: `${focusLabel} practice`,
    shortLabel: focusLabel === "Mixed" ? "Practice" : `Practise ${focusLabel}`,
    focus: focusLabel,
    words,
    test_id: words[0]?.test_id || null,
    attempt_source: "practice",
    max_attempts: 3,
    mode: "practice",
    audio_enabled: true,
    hints_enabled: true,
  };
}

async function loadPracticeModel(pupilId) {
  if (!pupilId) return createEmptyPracticeModel();

  try {
    const attempts = await listPupilPracticeEvidenceAttempts({
      pupilId,
      limit: PRACTICE_EVIDENCE_FETCH_LIMIT,
    });
    const topGrapheme = selectTopPracticeGrapheme(attempts);
    if (!topGrapheme?.target) {
      return createEmptyPracticeModel(PRACTICE_STATUS_NOT_ENOUGH_EVIDENCE);
    }

    const approvedWordRows = await listApprovedPracticeWordBankRows({
      focusGrapheme: topGrapheme.target,
      limit: 50,
    });
    const plan = buildPupilPracticePlan({
      attempts,
      approvedWordRows,
      wordCount: PRACTICE_WORD_COUNT,
    });

    if (plan.status !== PRACTICE_STATUS_READY) {
      return createEmptyPracticeModel(plan.status, {
        focusGrapheme: plan.focusGrapheme,
        evidenceCount: plan.evidenceCount,
        wordCount: plan.wordCount,
      });
    }

    const pack = buildPracticePackFromPlan(plan);
    return createEmptyPracticeModel(PRACTICE_STATUS_READY, {
      focusGrapheme: plan.focusGrapheme,
      evidenceCount: plan.evidenceCount,
      wordCount: plan.wordCount,
      packs: pack ? [pack] : [],
    });
  } catch (error) {
    console.warn("load practice model error:", error);
    return createEmptyPracticeModel(PRACTICE_STATUS_NOT_ENOUGH_EVIDENCE);
  }
}

function renderSummaryCard(name) {
  return renderSummaryCardWithSchool(name, null);
}

function getSessionSchoolSummary(session) {
  return normalizeSchoolSummary(session?.school || session || null);
}

function getSessionSchoolName(session) {
  const school = getSessionSchoolSummary(session);
  return String(school?.name || session?.school_name || "").trim();
}

function renderSchoolLabelChip(schoolName) {
  const safeSchoolName = String(schoolName || "").trim();
  if (!safeSchoolName) return "";
  return `
    <span class="schoolContextLabel" title="${escapeHtml(safeSchoolName)}">
      <span>School</span>
      <strong>${escapeHtml(safeSchoolName)}</strong>
    </span>
  `;
}

function renderSummaryCardWithSchool(name, session = null) {
  const schoolName = getSessionSchoolName(session);
  return `
    <div class="pupil-header">
      <h2>Hello ${escapeHtml(name)}</h2>
      <p class="muted">Loading your latest wins and next steps.</p>
      ${schoolName ? `<div class="schoolContextRow">${renderSchoolLabelChip(schoolName)}</div>` : ""}
    </div>
  `;
}

function renderBaselineGateState(name, {
  mode = "waiting",
  assignment = null,
  waitingReason = null,
  session = null,
} = {}) {
  const isResume = mode === "resume";
  const isStart = mode === "start";
  const isRuntimeInactive = mode === "waiting" && waitingReason === "runtime_inactive";
  const isMissingCurrentForm = mode === "waiting" && waitingReason === "no_active_form_membership";
  const title = isResume
    ? "Finish your baseline test first"
    : isStart
      ? "Start your baseline test first"
      : isRuntimeInactive
        ? "This pupil login is no longer active"
        : isMissingCurrentForm
          ? "You're not in a current form yet"
          : "Baseline test not ready yet";
  const text = isResume
    ? "Complete your baseline test before you move into your normal tasks."
    : isStart
      ? "Complete your baseline test before you move into your normal tasks."
      : isRuntimeInactive
        ? "Please ask a teacher for help."
        : isMissingCurrentForm
          ? "A teacher needs to place you in your current form before your baseline test can begin."
          : "Your teacher will set your baseline test soon.";
  const subtitle = isRuntimeInactive
    ? "Please ask a teacher for help."
    : isMissingCurrentForm
      ? "Your teacher is still setting things up."
      : "Your baseline test comes first.";
  const buttonHtml = assignment
    ? `<button class="btn primary start-test-btn" type="button" data-action="open-gated-baseline" data-assignment-id="${escapeHtml(String(assignment?.id || ""))}">${isResume ? "Continue baseline test" : "Start baseline test"}</button>`
    : "";
  return `
    <div class="pupilDashboardShell">
      <div class="pupil-header">
        <h2>Hello ${escapeHtml(name)}</h2>
        <p class="muted">${escapeHtml(subtitle)}</p>
        ${getSessionSchoolName(session) ? `<div class="schoolContextRow">${renderSchoolLabelChip(getSessionSchoolName(session))}</div>` : ""}
      </div>
      <section class="card pupilSectionCard pupilEmptyCard">
        <div class="pupilSectionTitleRow">
          <h3>${renderIconLabel("checkCircle", title)}</h3>
        </div>
        <p class="pupilEmptyText">${escapeHtml(text)}</p>
        ${buttonHtml}
      </section>
      ${renderReadingHelpSection()}
    </div>
  `;
}

function hasVisibleBaselineProgress(assignment) {
  if (!assignment || assignment?.completed) return false;
  if (assignment?.started_at) return true;
  if (String(assignment?.assignmentStatus || "").trim().toLowerCase() === "started") return true;
  return Math.max(0, Number(assignment?.attemptedWordCount || 0)) > 0;
}

function findVisibleBaselineAssignment(assignments, preferredAssignmentId = "") {
  const rows = (Array.isArray(assignments) ? assignments : [])
    .filter((item) => item?.isBaseline && !item?.completed);
  if (!rows.length) return null;

  const preferredId = String(preferredAssignmentId || "").trim();
  if (preferredId) {
    const preferred = rows.find((item) => String(item?.id || "") === preferredId);
    if (preferred) return preferred;
  }

  return rows[0] || null;
}

function buildVisibleBaselineGate(assignments, preferredAssignmentId = "") {
  const assignment = findVisibleBaselineAssignment(assignments, preferredAssignmentId);
  if (!assignment) return null;
  return {
    status: hasVisibleBaselineProgress(assignment) ? "resume" : "start",
    assignment,
  };
}

function buildPupilHeroModel(assignments, practiceModel, progress) {
  const pendingAssignments = (assignments || []).filter((item) => !item?.completed);
  const completedAssignments = (assignments || []).filter((item) => !!item?.completed);
  const wordsChecked = Number(progress?.wordsChecked || 0);
  const strongSounds = progress?.secureNow || [];
  const growingSounds = progress?.growing || [];
  const nextStretch = progress?.practiseNext || [];
  const recentWins = progress?.recentWins || [];
  const practiceCount = getPracticePacks(practiceModel).length;
  let summary = "You are all caught up.";

  if (pendingAssignments.length) {
    summary = pendingAssignments.length === 1
      ? "You have 1 teacher task to do."
      : `You have ${pendingAssignments.length} teacher tasks to do.`;
  } else if (completedAssignments.length) {
    summary = "Nice work. Your finished tasks stay here for a little while.";
  } else if (practiceCount) {
    summary = "Your teacher tasks are done. Extra practice is ready if you want it.";
  } else if (!wordsChecked) {
    summary = "Start when you feel ready.";
  } else if (strongSounds.length >= 2 || Number(progress?.accuracy || 0) >= 0.85) {
    summary = "You are doing really well.";
  } else if (growingSounds.length || recentWins.length) {
    summary = "You are getting stronger.";
  }

  const highlightGroups = [
    {
      label: "Strong",
      items: strongSounds,
      variant: "secure",
      formatter: (item) => item?.target || item,
    },
    {
      label: "Growing",
      items: growingSounds,
      variant: "growing",
      formatter: (item) => item?.target || item,
    },
    {
      label: "Next",
      items: nextStretch,
      variant: "practice",
      formatter: (item) => item?.target || item,
    },
    {
      label: "Wins",
      items: recentWins,
      variant: "wins",
      formatter: (item) => item,
    },
  ].filter((group, index) => {
    if (!group.items?.length) return false;
    if (index === 3 && (strongSounds.length || growingSounds.length || nextStretch.length)) return false;
    return true;
  }).slice(0, 3);

  return {
    summary,
    highlightGroups,
  };
}

function renderPupilHeroGroup(group) {
  return `
    <article class="pupilHeroGroup">
      <div class="pupilHeroGroupLabel">${escapeHtml(group.label)}</div>
      ${renderProgressChipList(group.items, group.variant, group.formatter)}
    </article>
  `;
}

function renderPupilAnalyticsHero(name, assignments, practiceModel, progress, session = null) {
  const hero = buildPupilHeroModel(assignments, practiceModel, progress);
  const schoolName = getSessionSchoolName(session);

  return `
    <section class="card pupilHeroCard">
      <div class="pupilHeroTop">
        <div class="pupilHeroIntro">
          <h2>Hello ${escapeHtml(name)}</h2>
          <p class="pupilHeroCopy">${escapeHtml(hero.summary)}</p>
          ${schoolName ? `<div class="schoolContextRow">${renderSchoolLabelChip(schoolName)}</div>` : ""}
        </div>
      </div>

      ${hero.highlightGroups.length ? `
        <div class="pupilHeroHighlights">
          ${hero.highlightGroups.map(renderPupilHeroGroup).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function getDisplayedAssignmentTitle(item) {
  return String(item?.pupilTitle || item?.title || "Test").trim() || "Test";
}

function renderSpellingBeeLeaderboardPreview(item) {
  const rows = Array.isArray(item?.spellingBeeLeaderboardRows) ? item.spellingBeeLeaderboardRows : [];
  const visibleRows = rows.slice(0, 8);
  if (!visibleRows.length) return "";
  return `
    <div class="resultsList">
      ${visibleRows.map((row) => `
        <article class="resultRow ${String(row?.pupil_id || "") === String(item?.spellingBeeResult?.pupil_id || "") ? "resultOk" : ""}">
          <div class="resultWordLine">
            <span>${escapeHtml(`${row?.rank ? `#${row.rank}` : "Unranked"} ${row?.pupil_name || "Pupil"}`)}</span>
            <span class="resultAttempts">${escapeHtml(`${Math.max(0, Number(row?.streak || 0))} streak`)}</span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSpellingBeeAssignmentCard(item) {
  const isComplete = !!item.completed;
  const hasStarted = !!item?.spellingBeeResult?.started_at || !!item?.started_at;
  const eventClosed = !!item.spellingBeeEventClosed;
  const streak = Math.max(0, Number(item?.correctWordCount || item?.spellingBeeResult?.streak || 0));
  const leaderboardOpen = !!pupilDashboardState.beeLeaderboardOpenByAssignment?.[String(item.id || "")];
  const untilWrong = String(item?.spellingBeeLengthMode || item?.spellingBeeResult?.bee_length_mode || "").trim().toLowerCase() === SPELLING_BEE_LENGTH_MODE_UNTIL_WRONG;
  const rankLine = item?.spellingBeeRank
    ? `<span class="pupilMetaPill pupilMetaPill--result" title="Competition rank">${renderIcon("award")}<span>${escapeHtml(`Your rank: ${item.spellingBeeRank}`)}</span></span>`
    : "";
  const yearRankLine = item?.spellingBeeYearRank
    ? `<span class="pupilMetaPill" title="Year rank">${renderIcon("list")}<span>${escapeHtml(`Year rank: ${item.spellingBeeYearRank}`)}</span></span>`
    : "";
  const formRankLine = item?.spellingBeeFormRank
    ? `<span class="pupilMetaPill" title="Form rank">${renderIcon("list")}<span>${escapeHtml(`Form rank: ${item.spellingBeeFormRank}`)}</span></span>`
    : "";

  return `
    <article class="card test-card pupilTestCard ${isComplete ? "pupilTestCard--complete" : ""}">
      <h3>Spelling Bee</h3>
      <p class="pupilTaskReason">Optional competition</p>
      <p class="pupilTaskReason">Take part if you want to</p>
      <div class="pupilTestMeta">
        ${isComplete ? `
          <span class="pupilMetaPill pupilMetaPill--complete" title="Completed competition">
            ${renderIcon("checkCircle")}
            <span>Spelling Bee completed</span>
          </span>
          <span class="pupilMetaPill pupilMetaPill--result" title="Streak">
            ${renderIcon("list")}
            <span>${escapeHtml(`Your streak: ${streak}`)}</span>
          </span>
          ${eventClosed ? `${rankLine}${yearRankLine}${formRankLine}` : `
            <span class="pupilMetaPill" title="Results timing">
              ${renderIcon("calendar")}
              <span>Ranking and results are released after the competition closes</span>
            </span>
          `}
        ` : hasStarted ? `
          <span class="pupilMetaPill pupilMetaPill--complete" title="Entered competition">
            ${renderIcon("checkCircle")}
            <span>Already entered</span>
          </span>
          <span class="pupilMetaPill" title="Competition entry">
            ${renderIcon("calendar")}
            <span>You cannot restart this event</span>
          </span>
        ` : `
          <span class="pupilMetaPill" title="Optional competition">
            ${renderIcon("spark")}
            <span>Optional competition</span>
          </span>
          ${untilWrong ? `
            <span class="pupilMetaPill" title="Competition length">
              ${renderIcon("list")}
              <span>Ends when you get one wrong</span>
            </span>
          ` : ""}
          <span class="pupilMetaPill pupilMetaPill--deadline ${deadlineClass(item.end_at)}" title="Competition closes">
            ${renderIcon("calendar")}
            <span>${escapeHtml(formatDeadline(item.end_at))}</span>
          </span>
        `}
      </div>
      ${
        isComplete
          ? (eventClosed
            ? `<button class="btn secondary start-test-btn" data-action="toggle-bee-leaderboard" data-assignment-id="${escapeHtml(String(item.id || ""))}" type="button">${leaderboardOpen ? "Hide results" : "View results"}</button>`
            : `<button class="btn secondary start-test-btn start-test-btn--locked" type="button" disabled aria-disabled="true">Completed</button>`)
          : hasStarted
            ? `<button class="btn secondary start-test-btn start-test-btn--locked" type="button" disabled aria-disabled="true">Already entered</button>`
          : (eventClosed
            ? `<button class="btn secondary start-test-btn start-test-btn--locked" type="button" disabled aria-disabled="true">Competition closed</button>`
            : `<button class="btn primary start-test-btn" data-assignment="${escapeHtml(item.id)}" type="button">Start competition</button>`)
      }
      ${isComplete && eventClosed && leaderboardOpen ? renderSpellingBeeLeaderboardPreview(item) : ""}
    </article>
  `;
}

function renderAssignmentCard(item) {
  if (item?.isSpellingBee) return renderSpellingBeeAssignmentCard(item);
  const defaultQuestionCount = Array.isArray(item.words) ? item.words.length : 0;
  const generatedQuestionCount = Number.isFinite(Number(item?.pupilWordCount))
    ? Math.max(0, Number(item.pupilWordCount))
    : null;
  const questionCount = item?.isGenerated
    ? generatedQuestionCount
    : defaultQuestionCount;
  const showQuestionCount = Number.isFinite(Number(questionCount)) && Number(questionCount) > 0;
  const dueText = formatDeadline(item.end_at);
  const isComplete = !!item.completed;
  const isInProgress = !isComplete && (
    !!item?.started_at
    || String(item?.assignmentStatus || "").trim().toLowerCase() === "started"
    || Math.max(0, Number(item?.attemptedWordCount || 0)) > 0
  );
  const resultText = item.totalWordCount
    ? `${item.correctWordCount || 0}/${item.totalWordCount}`
    : formatPercent(item.scoreRate || 0);
  const statusText = isComplete ? formatCompletedLabel(item.completedAt) : dueText;
  const title = getDisplayedAssignmentTitle(item);
  const reason = String(item?.pupilReason || "").trim();

  return `
    <article class="card test-card pupilTestCard ${isComplete ? "pupilTestCard--complete" : ""}">
      <h3>${escapeHtml(title)}</h3>
      ${reason ? `<p class="pupilTaskReason">${escapeHtml(reason)}</p>` : ""}
      <div class="pupilTestMeta">
        ${
          isComplete
            ? `
              <span class="pupilMetaPill pupilMetaPill--complete" title="Completed task">
                ${renderIcon("checkCircle")}
                <span>Completed</span>
              </span>
            `
            : ""
        }
        ${
          isComplete
            ? `
              <span class="pupilMetaPill pupilMetaPill--result" title="Result">
                ${renderIcon("list")}
                <span>${escapeHtml(`Score ${resultText}`)}</span>
              </span>
            `
            : (showQuestionCount
              ? `
                <span class="pupilMetaPill" title="Questions">
                  ${renderIcon("list")}
                  <span>${escapeHtml(`${questionCount} ${questionCount === 1 ? "word" : "words"}`)}</span>
                </span>
              `
              : "")
        }
        <span class="pupilMetaPill ${isComplete ? "pupilMetaPill--completeTime" : `pupilMetaPill--deadline ${deadlineClass(item.end_at)}`}" title="${escapeHtml(isComplete ? "Completed" : item.end_at ? "Deadline" : "Availability")}">
          ${renderIcon("calendar")}
          <span>${escapeHtml(statusText)}</span>
        </span>
      </div>
      ${
        isComplete
          ? `<button class="btn secondary start-test-btn start-test-btn--locked" type="button" disabled aria-disabled="true" title="This task is locked because it is complete.">Completed</button>`
          : `<button class="btn primary start-test-btn" data-assignment="${escapeHtml(item.id)}" type="button">${isInProgress ? "Continue task" : "Open task"}</button>`
      }
    </article>
  `;
}

function renderPracticeOption(pack, index) {
  const wordCount = Array.isArray(pack?.words) ? pack.words.length : 0;
  return `
    <button
      class="pupilPracticeOption"
      type="button"
      data-action="start-practice"
      data-practice-index="${index}"
    >
      <span class="pupilPracticeOptionTitle">${escapeHtml(pack?.shortLabel || "Practice")}</span>
      <span class="pupilPracticeOptionMeta">${escapeHtml(`${wordCount} ${wordCount === 1 ? "word" : "words"}`)}</span>
    </button>
  `;
}

function renderProgressChipList(items, variant = "neutral", formatter = (item) => item.target || item, emptyMessage = "Nothing here yet.") {
  if (!items?.length) {
    return `<div class="pupilProgressEmpty">${escapeHtml(emptyMessage)}</div>`;
  }

  return `
    <div class="pupilProgressChips">
      ${items.map((item) => `
        <span class="pupilProgressChip pupilProgressChip--${escapeHtml(variant)}">${escapeHtml(formatter(item))}</span>
      `).join("")}
    </div>
  `;
}

function getProgressMood(progress) {
  const recentScore = Number(progress?.accuracy || 0);
  const firstGoScore = Number(progress?.firstTrySuccessRate || 0);

  if (recentScore >= 0.9 || firstGoScore >= 0.85) {
    return { label: "Brilliant", tone: "bright" };
  }
  if (recentScore >= 0.75 || firstGoScore >= 0.65) {
    return { label: "Growing", tone: "steady" };
  }
  if (Number(progress?.wordsChecked || 0) >= 8) {
    return { label: "Keep going", tone: "warm" };
  }
  return { label: "On your way", tone: "soft" };
}

function renderProgressStatCard({
  label,
  value,
  valueHtml = "",
  bodyHtml = "",
  subvalue = "",
  subvalueHtml = "",
  supportingLine = "",
  fill = 0,
  tone = "blue",
  featured = false,
  infoText = "",
  infoHtml = "",
  metaHtml = "",
  details = [],
}) {
  const clampedFill = Math.max(0, Math.min(100, Number(fill) || 0));
  return `
    <article class="pupilProgressStatCard ${featured ? "pupilProgressStatCard--featured" : ""} pupilProgressStatCard--${escapeHtml(tone)}">
      <div class="pupilProgressStatHead">
        <div class="pupilProgressStatLabel">${escapeHtml(label)}</div>
        ${renderInfoTip(infoText, {
          label: `What ${label.toLowerCase()} means`,
          className: "pupilProgressInfoTip",
          triggerClassName: "pupilProgressInfoTipTrigger",
          bubbleClassName: "pupilProgressInfoTipBubble",
          align: "end",
          html: infoHtml,
        })}
      </div>
      ${bodyHtml || `
      <div class="pupilProgressStatValue">${valueHtml || escapeHtml(String(value))}</div>
      ${subvalueHtml ? `<div class="pupilProgressStatSubvalue">${subvalueHtml}</div>` : subvalue ? `<div class="pupilProgressStatSubvalue"><span class="pupilProgressStatBadge">${escapeHtml(String(subvalue))}</span></div>` : ""}
      ${supportingLine ? `<div class="pupilProgressStatSupportLine">${escapeHtml(String(supportingLine))}</div>` : ""}
      ${metaHtml || ""}
      `}
      ${Array.isArray(details) && details.length
        ? details.map((item) => `<div class="pupilProgressEmpty">${escapeHtml(item)}</div>`).join("")
        : ""}
      <div class="pupilProgressStatBar" aria-hidden="true">
        <span style="width:${clampedFill}%;"></span>
      </div>
    </article>
  `;
}

function renderProgressFocusBlock(block) {
  return `
    <article class="pupilProgressFocusCard pupilProgressFocusCard--${escapeHtml(block.variant)}">
      <div class="pupilProgressFocusTitle">${escapeHtml(block.title)}</div>
      ${renderProgressChipList(block.items, block.variant, block.formatter)}
    </article>
  `;
}

function renderProgressSection(progress) {
  if (!progress || !progress.wordsChecked) return "";

  const mood = getProgressMood(progress);
  const secureDifficultyScore = Number(progress?.attainmentIndicator?.secureDifficultyScore);
  const recentPercent = Number(progress?.accuracy || 0) * 100;
  const firstGoPercent = Number(progress?.firstTrySuccessRate || 0) * 100;
  const statCards = [
    {
      label: "Your spelling snapshot",
      bodyHtml: buildPupilAttainmentCardBodyHtml(progress),
      fill: progress?.attainmentIndicator?.attainmentBand && Number.isFinite(secureDifficultyScore) ? secureDifficultyScore : 0,
      tone: "blue",
      featured: true,
      infoHtml: buildPupilAttainmentInfoHtml(progress),
    },
    {
      label: "Accuracy",
      value: formatPercent(progress.accuracy),
      fill: recentPercent,
      tone: recentPercent >= 85 ? "green" : recentPercent >= 65 ? "blue" : "amber",
      infoText: "This shows how many checked words you got right.",
    },
    {
      label: "First try",
      value: formatPercent(progress.firstTrySuccessRate),
      fill: firstGoPercent,
      tone: firstGoPercent >= 80 ? "green" : firstGoPercent >= 60 ? "blue" : "amber",
      infoText: "This shows how many checked words you got right on your first try.",
    },
    {
      label: "Checked",
      value: Number(progress.wordsChecked || 0),
      fill: Math.min(100, Number(progress.wordsChecked || 0) * 6),
      tone: "violet",
      infoText: "This shows how many checked words have counted towards your progress so far.",
    },
  ];

  const blocks = [
    {
      title: "Strong",
      items: progress.secureNow,
      variant: "secure",
      formatter: (item) => item.target || item,
    },
    {
      title: "Growing",
      items: progress.growing,
      variant: "growing",
      formatter: (item) => item.target || item,
    },
    {
      title: "Next",
      items: progress.practiseNext,
      variant: "practice",
      formatter: (item) => item.target || item,
    },
    {
      title: "Wins",
      items: progress.recentWins,
      variant: "wins",
      formatter: (item) => item,
    },
  ].filter((block) => block.items?.length);

  const summaryCard = statCards[0];
  const secondaryStatCards = statCards.slice(1);

  return `
    <section class="card pupilProgressCard">
      <div class="pupilProgressTop">
        <div class="pupilSectionTitleRow">
          <h3>${renderIconLabel("chart", "How you're doing")}</h3>
        </div>
        <span class="pupilProgressMood pupilProgressMood--${escapeHtml(mood.tone)}">${escapeHtml(mood.label)}</span>
      </div>

      <div class="pupilProgressSummaryRow" aria-label="Progress summary">
        ${renderProgressStatCard(summaryCard)}
      </div>

      <div class="pupilProgressVisuals" aria-label="Progress stats">
        ${secondaryStatCards.map(renderProgressStatCard).join("")}
      </div>

      ${blocks.length ? `
        <div class="pupilProgressFocusGrid">
          ${blocks.map(renderProgressFocusBlock).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderYourProgressBlock(item) {
  const chips = Array.isArray(item?.chips) ? item.chips : [];
  const variant = String(item?.variant || "wins").trim() || "wins";
  return `
    <article class="pupilYourProgressBlock pupilYourProgressBlock--${escapeHtml(variant)}">
      <div class="pupilYourProgressLabel">${escapeHtml(item?.label || "")}</div>
      <div class="pupilYourProgressText">${escapeHtml(item?.text || "")}</div>
      ${chips.length ? renderProgressChipList(chips, variant, (chip) => chip) : ""}
    </article>
  `;
}

function renderYourProgressResultRow(item) {
  return `
    <article class="pupilYourProgressTimelineRow">
      <div class="pupilYourProgressTimelineCopy">
        <div class="pupilYourProgressTimelineTask">${escapeHtml(item?.title || "Task")}</div>
        <div class="pupilYourProgressTimelineDate">${escapeHtml(item?.dateLabel || "Recently")}</div>
      </div>
      <div class="pupilYourProgressTimelineScore">${escapeHtml(item?.scoreText || "Done")}</div>
    </article>
  `;
}

function renderYourProgressCard(assignments, practiceModel, progress) {
  const model = buildPupilProgressCardModel({ assignments, practiceModel, progress });
  if (!model) return "";

  return `
    <section class="card pupilYourProgressCard">
      <div class="pupilSectionHead pupilSectionHead--compact">
        <div class="pupilSectionTitleRow">
          <h3>${renderIconLabel("chart", model.title || "Your progress")}</h3>
        </div>
      </div>
      ${model?.intro ? `<p class="pupilYourProgressIntro">${escapeHtml(model.intro)}</p>` : ""}
      <div class="pupilYourProgressGrid">
        ${(Array.isArray(model?.blocks) ? model.blocks : []).map(renderYourProgressBlock).join("")}
      </div>
      ${Array.isArray(model?.recentResults) && model.recentResults.length ? `
        <div class="pupilYourProgressTimeline">
          <div class="pupilYourProgressTimelineTitle">Recent results</div>
          <div class="pupilYourProgressTimelineList">
            ${model.recentResults.map(renderYourProgressResultRow).join("")}
          </div>
        </div>
      ` : ""}
    </section>
  `;
}

function renderAssignments(assignments) {
  if (!assignments.length) return "";

  const pendingCount = assignments.filter((item) => !item?.completed).length;
  const completedCount = assignments.filter((item) => !!item?.completed).length;
  const sectionTitle = "My tasks";
  const sectionCount = pendingCount || completedCount;
  const isExpanded = !!pupilDashboardState.expandedSections.teacher_tasks;
  const shouldCollapse = assignments.length > PUPIL_SECTION_LIMIT;
  const visibleItems = shouldCollapse && !isExpanded ? assignments.slice(0, PUPIL_SECTION_LIMIT) : assignments;
  const hiddenCount = Math.max(0, assignments.length - visibleItems.length);
  const toggleLabel = isExpanded ? "Show less" : `Show ${hiddenCount} more`;

  return `
    <section class="card pupilSectionCard">
      <div class="pupilSectionHead">
        <div class="pupilSectionTitleRow">
          <h3>${renderIconLabel("checkCircle", sectionTitle)}</h3>
          <span class="pupilSectionCount">${escapeHtml(String(sectionCount))}</span>
        </div>
      </div>
      <div class="pupilSectionGrid">
        ${visibleItems.map(renderAssignmentCard).join("")}
      </div>
      ${
        shouldCollapse
          ? `
            <div class="appShowMoreWrap">
              <button class="appShowMoreButton" type="button" data-action="toggle-pupil-section" data-section="teacher_tasks" aria-expanded="${isExpanded ? "true" : "false"}">
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

function renderAssignmentsEmptyState() {
  return `
    <section class="card pupilSectionCard pupilEmptyCard">
      <div class="pupilSectionTitleRow">
        <h3>${renderIconLabel("checkCircle", "No tasks waiting")}</h3>
      </div>
      <p class="pupilEmptyText">New tasks will show up here.</p>
    </section>
  `;
}

function getPracticeEmptyText(practiceModel = null) {
  const status = String(practiceModel?.status || PRACTICE_STATUS_NOT_ENOUGH_EVIDENCE).trim();
  if (status === PRACTICE_STATUS_NOT_ENOUGH_WORDS) return "Practice words are not ready yet.";
  return "Finish a few more words first.";
}

function renderPracticeSection(practiceModel) {
  const practicePacks = getPracticePacks(practiceModel);

  return `
    <section class="card pupilSectionCard pupilPracticeSection">
      <div class="pupilSectionHead">
        <div class="pupilSectionTitleRow">
          <h3>${renderIconLabel("spark", "Extra practice")}</h3>
        </div>
      </div>
      ${
        practicePacks.length
          ? `
            <div class="pupilPracticeOptions">
              ${practicePacks.map((pack, index) => renderPracticeOption(pack, index)).join("")}
            </div>
          `
          : `<p class="pupilEmptyText">${escapeHtml(getPracticeEmptyText(practiceModel))}</p>`
      }
    </section>
  `;
}

function renderReadingHelpSection() {
  return `
    <details class="card pupilDetailsCard pupilReadingHelpCard">
      <summary>${renderIconLabel("eye", "Reading help")}</summary>
      <div class="pupilDetailsBody pupilReadingHelpShell">
        ${renderAccessibilityControls()}
      </div>
    </details>
  `;
}

function formatResultAnswer(value) {
  const clean = String(value ?? "").trim();
  return clean || "No answer";
}

function renderCompletionRow(entry, index) {
  const label = String(entry?.word || entry?.correctSpelling || "").trim() || `Word ${index + 1}`;
  const typed = formatResultAnswer(entry?.typed);
  const correctSpelling = String(entry?.correctSpelling || entry?.word || "").trim() || "Unknown";
  const attemptsUsed = Math.max(1, Number(entry?.attemptsUsed || 1));

  return `
    <article class="resultRow ${entry?.correct ? "resultOk" : "resultBad"}">
      <div class="resultWordLine">
        <span>${escapeHtml(`${index + 1}. ${label}`)}</span>
        <span class="${entry?.correct ? "badgeOk" : "badgeBad"}">${entry?.correct ? "Correct" : "Incorrect"}</span>
        <span class="resultAttempts">${escapeHtml(`${attemptsUsed} ${attemptsUsed === 1 ? "attempt" : "attempts"}`)}</span>
      </div>
      <div class="resultTyped">Your answer: <strong>${escapeHtml(typed)}</strong></div>
      ${entry?.correct ? "" : `<div class="resultCorrection">Correct spelling: <strong>${escapeHtml(correctSpelling)}</strong></div>`}
    </article>
  `;
}

function renderCompletionSummary(item, result) {
  const rows = Array.isArray(result?.results) ? result.results : [];
  const totalWords = Number(result?.totalWords || rows.length || 0);
  const totalCorrect = Number(result?.totalCorrect || 0);
  const incorrectCount = Math.max(0, totalWords - totalCorrect);
  const averageAttempts = Number(result?.averageAttempts || 0);

  return `
    <div class="pupil-header">
      <h2>${escapeHtml(getDisplayedAssignmentTitle(item) || "Activity complete")}</h2>
      <p class="muted">You finished ${item.attempt_source === "practice" ? "practice" : "the test"}.</p>
    </div>
    <section class="card test-card resultCardInline">
      <div class="resultSummaryGrid">
        <div class="resultSummaryCard">
          <div class="resultSummaryLabel">Score</div>
          <div class="resultSummaryValue">${escapeHtml(`${totalCorrect} / ${totalWords}`)}</div>
        </div>
        <div class="resultSummaryCard">
          <div class="resultSummaryLabel">Correct</div>
          <div class="resultSummaryValue">${escapeHtml(String(totalCorrect))}</div>
        </div>
        <div class="resultSummaryCard">
          <div class="resultSummaryLabel">Stretch next</div>
          <div class="resultSummaryValue">${escapeHtml(String(incorrectCount))}</div>
        </div>
        <div class="resultSummaryCard">
          <div class="resultSummaryLabel">Average attempts</div>
          <div class="resultSummaryValue">${escapeHtml(averageAttempts.toFixed(1))}</div>
        </div>
      </div>
      <div class="resultSummaryLabel">Word review</div>
      <div class="resultsList">
        ${rows.map((entry, index) => renderCompletionRow(entry, index)).join("")}
      </div>
      <button class="btn primary start-test-btn" id="btnBackToPupilDashboard" type="button">Back to dashboard</button>
    </section>
  `;
}

function renderSpellingBeeCompletionSummary(item, result, leaderboardRows = []) {
  const streak = Math.max(0, Number(result?.streak ?? result?.totalCorrect ?? 0));
  const eventClosed = item?.end_at ? new Date(item.end_at).getTime() <= Date.now() : false;
  const audioFailed = result?.audioFailed === true || result?.audio_failed === true;
  const ownRow = eventClosed
    ? (leaderboardRows || []).find((row) => String(row?.pupil_id || "") === String(item?.spellingBeeResult?.pupil_id || result?.pupil_id || result?.pupilId || ""))
    : null;
  const rows = Array.isArray(leaderboardRows) ? leaderboardRows.slice(0, 8) : [];

  return `
    <div class="pupil-header">
      <h2>${audioFailed ? "Spelling Bee stopped" : "Spelling Bee completed"}</h2>
      <p class="muted">${audioFailed ? "Audio could not play clearly enough for a fair round." : (eventClosed ? "Results are available now." : "Ranking and results are released after the competition closes.")}</p>
    </div>
    <section class="card test-card resultCardInline">
      <div class="resultSummaryGrid">
        <div class="resultSummaryCard">
          <div class="resultSummaryLabel">Your streak</div>
          <div class="resultSummaryValue">${escapeHtml(String(streak))}</div>
        </div>
        ${eventClosed && ownRow?.rank ? `
          <div class="resultSummaryCard">
            <div class="resultSummaryLabel">Your rank</div>
            <div class="resultSummaryValue">${escapeHtml(String(ownRow.rank))}</div>
          </div>
        ` : ""}
        ${eventClosed && ownRow?.year_rank ? `
          <div class="resultSummaryCard">
            <div class="resultSummaryLabel">Year rank</div>
            <div class="resultSummaryValue">${escapeHtml(String(ownRow.year_rank))}</div>
          </div>
        ` : ""}
        ${eventClosed && ownRow?.form_rank ? `
          <div class="resultSummaryCard">
            <div class="resultSummaryLabel">Form rank</div>
            <div class="resultSummaryValue">${escapeHtml(String(ownRow.form_rank))}</div>
          </div>
        ` : ""}
      </div>
      ${eventClosed && rows.length ? `
        <div class="resultSummaryLabel">Leaderboard</div>
        <div class="resultsList">
          ${rows.map((row) => `
            <article class="resultRow ${String(row?.pupil_id || "") === String(ownRow?.pupil_id || "") ? "resultOk" : ""}">
              <div class="resultWordLine">
                <span>${escapeHtml(`${row?.rank ? `#${row.rank}` : "Unranked"} ${row?.pupil_name || "Pupil"}`)}</span>
                <span class="resultAttempts">${escapeHtml(`${Math.max(0, Number(row?.streak || 0))} streak`)}</span>
              </div>
            </article>
          `).join("")}
        </div>
      ` : ""}
      <button class="btn primary start-test-btn" id="btnBackToPupilDashboard" type="button">Back to dashboard</button>
    </section>
  `;
}

function canStartSpellingBeeAudio() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";
}

function renderSpellingBeeAudioBlocked() {
  return `
    <div class="pupil-header">
      <h2>Spelling Bee</h2>
      <p class="muted">Audio is needed for this competition.</p>
    </div>
    <section class="card test-card resultCardInline">
      <p class="pupilTaskReason">This browser cannot play the word audio right now.</p>
      <p class="pupilTaskReason">Try again on a device with audio before the competition closes.</p>
      <button class="btn primary start-test-btn" id="btnBackToPupilDashboard" type="button">Back to dashboard</button>
    </section>
  `;
}

function renderSpellingBeeAlreadyStarted() {
  return `
    <div class="pupil-header">
      <h2>Spelling Bee</h2>
      <p class="muted">You have already entered this competition.</p>
    </div>
    <section class="card test-card resultCardInline">
      <p class="pupilTaskReason">Only one live run is allowed.</p>
      <p class="pupilTaskReason">You cannot restart the same event.</p>
      <button class="btn primary start-test-btn" id="btnBackToPupilDashboard" type="button">Back to dashboard</button>
    </section>
  `;
}

function attachDashboardEvents(containerEl, session, assignments, practiceModel, progress) {
  const practicePacks = getPracticePacks(practiceModel);
  containerEl.querySelectorAll("[data-assignment]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.starting === "true") return;
      button.dataset.starting = "true";
      button.disabled = true;
      const assignmentId = button.getAttribute("data-assignment");
      const assignment = assignments.find((item) => String(item.id) === String(assignmentId));
      if (!assignment) return;
      openSession(containerEl, session, assignment, assignments, practicePacks);
    });
  });

  containerEl.querySelectorAll('[data-action="start-practice"]').forEach((button) => {
    button.addEventListener("click", () => {
      const practiceIndex = Number(button.getAttribute("data-practice-index") || 0);
      const practicePack = practicePacks?.[practiceIndex];
      if (!practicePack) return;
      openSession(containerEl, session, practicePack, assignments, practicePacks);
    });
  });

  containerEl.querySelectorAll('[data-action="toggle-pupil-section"]').forEach((button) => {
    button.addEventListener("click", () => {
      const key = String(button.getAttribute("data-section") || "");
      if (!Object.prototype.hasOwnProperty.call(pupilDashboardState.expandedSections, key)) return;
      pupilDashboardState.expandedSections[key] = !pupilDashboardState.expandedSections[key];
      renderDashboard(containerEl, session, assignments, practiceModel, progress);
    });
  });

  containerEl.querySelectorAll('[data-action="toggle-bee-leaderboard"]').forEach((button) => {
    button.addEventListener("click", () => {
      const assignmentId = String(button.getAttribute("data-assignment-id") || "");
      if (!assignmentId) return;
      pupilDashboardState.beeLeaderboardOpenByAssignment = {
        ...(pupilDashboardState.beeLeaderboardOpenByAssignment || {}),
        [assignmentId]: !pupilDashboardState.beeLeaderboardOpenByAssignment?.[assignmentId],
      };
      renderDashboard(containerEl, session, assignments, practiceModel, progress);
    });
  });

  bindAccessibilityControlEvents(containerEl);
}

function bindAccessibilityControlEvents(containerEl) {
  containerEl.querySelectorAll("[data-acc-field]").forEach((el) => {
    el.addEventListener("change", () => {
      saveAccessibilitySettings({ [el.getAttribute("data-acc-field")]: el.value });
    });
  });
}

async function renderPupilHome(containerEl, session, { autoOpenBaseline = true } = {}) {
  if (!containerEl) return;

  const pupilId = String(session?.pupil_id || "").trim();
  const name = session?.first_name || session?.username || "Pupil";
  const gateState = await readPupilBaselineGateState({ pupilId });
  const waitingReason = String(gateState?.waitingReason || gateState?.waiting_reason || "").trim().toLowerCase() || null;
  let assignments = null;
  const ensureAssignments = async () => {
    if (assignments) return assignments;
    assignments = await loadAssignments(pupilId);
    return assignments;
  };

  let resolvedGate = null;
  if (gateState?.status === "resume" || gateState?.status === "start") {
    resolvedGate = {
      status: gateState.status,
      assignment: gateState?.assignment || null,
    };
    if (!resolvedGate.assignment?.id) {
      containerEl.innerHTML = renderBaselineGateState(name, {
        mode: "waiting",
        waitingReason: "no_baseline_assignment",
        session,
      });
      bindAccessibilityControlEvents(containerEl);
      return;
    }
  } else if (gateState?.status === "waiting" && waitingReason !== "no_active_form_membership" && waitingReason !== "runtime_inactive") {
    // Phase 0 hardening removed anon access to raw class membership tables.
    // The baseline gate RPC is now the runtime source of truth for baseline readiness.
    resolvedGate = null;
  }

  if (resolvedGate?.assignment?.id) {
    const assignmentList = Array.isArray(assignments) && assignments.length
      ? assignments
      : [resolvedGate.assignment];
    if (autoOpenBaseline) {
      await openSession(containerEl, session, resolvedGate.assignment, assignmentList, []);
      return;
    }
    containerEl.innerHTML = renderBaselineGateState(name, {
      mode: resolvedGate.status,
      assignment: resolvedGate.assignment,
      session,
    });
    containerEl.querySelector('[data-action="open-gated-baseline"]')?.addEventListener("click", async () => {
      await openSession(containerEl, session, resolvedGate.assignment, assignmentList, []);
    });
    bindAccessibilityControlEvents(containerEl);
    return;
  }

  if (gateState?.status === "waiting") {
    if (waitingReason === "no_baseline_assignment") {
      const loadedAssignments = await ensureAssignments().catch((error) => {
        console.warn("load pupil assignments after missing baseline gate error:", error);
        return [];
      });
      const dashboardAssignments = loadedAssignments.filter((item) => !item?.isBaseline);
      if (dashboardAssignments.length) {
        const [practiceModel, progress] = await Promise.all([
          loadPracticeModel(pupilId),
          loadPupilProgress(pupilId),
        ]);
        renderDashboard(containerEl, session, dashboardAssignments, practiceModel, progress);
        return;
      }
    }
    containerEl.innerHTML = renderBaselineGateState(name, {
      mode: "waiting",
      waitingReason,
      session,
    });
    bindAccessibilityControlEvents(containerEl);
    return;
  }

  const loadedAssignments = await ensureAssignments().catch((error) => {
    console.warn("load pupil assignments error:", error);
    return [];
  });
  const dashboardAssignments = gateState?.status === "ready"
    ? loadedAssignments.filter((item) => !item?.isBaseline)
    : loadedAssignments;

  const [practiceModel, progress] = await Promise.all([
    loadPracticeModel(pupilId),
    loadPupilProgress(pupilId),
  ]);
  renderDashboard(containerEl, session, dashboardAssignments, practiceModel, progress);
}

async function openSession(containerEl, session, item, assignments, practicePacks) {
  const isSpellingBee = !!item?.isSpellingBee;
  const isAssignedTask = !!item?.class_id && item?.attempt_source !== "practice" && !isSpellingBee;
  let latestStatus = null;
  let resumeState = null;
  console.log("TEST LOAD ids:", {
    assignmentId: String(item?.id || ""),
    pupilId: String(session?.pupil_id || ""),
    testId: String(item?.test_id || ""),
    isAssignedTask,
  });

  if (isAssignedTask && item?.id && session?.pupil_id) {
    const [statusResult, attemptRows] = await Promise.all([
      readAssignmentPupilStatus({
        assignmentId: item.id,
        pupilId: session.pupil_id,
      }).catch((error) => {
        console.warn("read assignment status error:", error);
        return null;
      }),
      readAssignmentAttemptRows({
        assignmentId: item.id,
        pupilId: session.pupil_id,
      }).catch((error) => {
        console.warn("read assignment attempts error:", error);
        return [];
      }),
    ]);
    latestStatus = statusResult;
    if (latestStatus?.completedAt || item?.completed) {
      await renderPupilHome(containerEl, session, { autoOpenBaseline: false });
      return;
    }
    resumeState = buildAssignmentResumeState(item, latestStatus, attemptRows);

    await markAssignmentSessionOpened({
      teacherId: item?.teacher_id,
      assignmentId: item?.id,
      classId: item?.class_id,
      testId: item?.test_id,
      pupilId: session?.pupil_id,
    }).catch((error) => {
      console.warn("mark assignment opened error:", error);
    });
  }

  console.log("Session words:", (item?.words || []).map((word, index) => ({
    index: index + 1,
    word: word?.word,
    wordSource: word?.is_target_word ? "targeted" : "base",
    assignmentTargetId: word?.assignment_target_id || null,
    testWordId: word?.base_test_word_id || word?.id || null,
  })));
  console.log("Merged session words:", {
    assignmentId: String(item?.id || ""),
    pupilId: String(session?.pupil_id || ""),
    totalWords: Array.isArray(item?.words) ? item.words.length : 0,
    baseWordCount: (Array.isArray(item?.words) ? item.words : []).filter((word) => !word?.is_target_word).length,
    targetedWordCount: (Array.isArray(item?.words) ? item.words : []).filter((word) => !!word?.is_target_word).length,
    words: (item?.words || []).map((word, index) => ({
      index: index + 1,
      word: word?.word || "",
      wordSource: word?.is_target_word ? "targeted" : "base",
      assignmentTargetId: word?.assignment_target_id || null,
      testWordId: word?.base_test_word_id || word?.id || null,
    })),
  });
  console.log("FINAL SESSION WORDS:", {
    assignmentId: String(item?.id || ""),
    pupilId: String(session?.pupil_id || ""),
    testId: String(item?.test_id || ""),
    words: (item?.words || []).map((word, index) => ({
      index: index + 1,
      word: word?.word || "",
      wordSource: word?.is_target_word ? "targeted" : "base",
      assignmentTargetId: word?.assignment_target_id || null,
      testWordId: word?.base_test_word_id || word?.id || null,
    })),
  });

  let spellingBeeStartRow = null;
  if (isSpellingBee) {
    if (item?.completed || item?.spellingBeeResult?.completed_at) {
      await renderPupilHome(containerEl, session, { autoOpenBaseline: false });
      return;
    }
    if (item?.spellingBeeEventClosed) {
      await renderPupilHome(containerEl, session, { autoOpenBaseline: false });
      return;
    }
    if (item?.spellingBeeResult?.started_at || item?.started_at) {
      containerEl.innerHTML = renderSpellingBeeAlreadyStarted();
      containerEl.querySelector("#btnBackToPupilDashboard")?.addEventListener("click", async () => {
        await renderPupilHome(containerEl, session, { autoOpenBaseline: false });
      });
      return;
    }
    if (!canStartSpellingBeeAudio()) {
      containerEl.innerHTML = renderSpellingBeeAudioBlocked();
      containerEl.querySelector("#btnBackToPupilDashboard")?.addEventListener("click", async () => {
        await renderPupilHome(containerEl, session, { autoOpenBaseline: false });
      });
      return;
    }
    spellingBeeStartRow = await startSpellingBeeResult({
      teacherId: item?.teacher_id,
      runId: item?.automation_run_id,
      assignmentId: item?.id,
      testId: item?.test_id,
      classId: item?.class_id,
      pupilId: session?.pupil_id,
      maxRounds: Array.isArray(item?.words) ? item.words.length : item?.totalWordCount,
      beeLengthMode: item?.spellingBeeLengthMode || item?.words?.[0]?.choice?.bee_length_mode || "",
    });
    if (spellingBeeStartRow?.completed_at) {
      await renderPupilHome(containerEl, session, { autoOpenBaseline: false });
      return;
    }
    if (spellingBeeStartRow?.already_started && !spellingBeeStartRow?.completed_at) {
      containerEl.innerHTML = renderSpellingBeeAlreadyStarted();
      containerEl.querySelector("#btnBackToPupilDashboard")?.addEventListener("click", async () => {
        await renderPupilHome(containerEl, session, { autoOpenBaseline: false });
      });
      return;
    }
    item = {
      ...item,
      spellingBeeResult: spellingBeeStartRow,
      started_at: spellingBeeStartRow?.started_at || new Date().toISOString(),
    };
  }

  mountGame({
    host: containerEl,
    words: item.words || [],
    testMeta: {
      id: item.test_id,
      title: getDisplayedAssignmentTitle(item),
      question_type: isSpellingBee ? "no_support_assessment" : (item.question_type || "focus_sound"),
      mode: item.mode || "test",
      max_attempts: isSpellingBee ? 1 : (item.max_attempts == null ? null : item.max_attempts),
      attempt_source: item.attempt_source || "test",
      audio_enabled: item.audio_enabled !== false,
      hints_enabled: isSpellingBee ? false : item.hints_enabled !== false,
      competition_mode: isSpellingBee ? "spelling_bee" : null,
      spelling_bee: isSpellingBee,
      bee_length_mode: isSpellingBee
        ? (item?.spellingBeeLengthMode || item?.words?.[0]?.choice?.bee_length_mode || "")
        : null,
      school_name: getSessionSchoolName(session),
    },
    pupilId: session?.pupil_id,
    assignmentId: isAssignedTask || isSpellingBee ? item.id : null,
    resumeState,
    recordAttempts: !isSpellingBee,
    onProgress: isAssignedTask && item?.id && session?.pupil_id
      ? async (progress) => {
        await saveAssignmentProgress({
          teacherId: item?.teacher_id,
          assignmentId: item?.id,
          classId: item?.class_id,
          testId: item?.test_id,
          pupilId: session?.pupil_id,
          progress,
        });
      }
      : null,
    onAbandon: isSpellingBee
      ? async (result) => {
        await finalizeSpellingBeeResult({
          runId: item?.automation_run_id,
          pupilId: session?.pupil_id,
          endedReason: "abandoned",
          result,
        });
      }
      : null,
    onExit: async () => {
      await renderPupilHome(containerEl, session, { autoOpenBaseline: false });
    },
    onComplete: async (result) => {
      console.log("FINISH TEST handler start:", {
        pupilId: String(session?.pupil_id || ""),
        testId: String(item?.test_id || ""),
        assignmentId: String(item?.id || ""),
        sessionAttemptId: null,
        resultCount: Array.isArray(result?.results) ? result.results.length : 0,
      });
      if (isSpellingBee && item?.id && session?.pupil_id) {
        const finalizedResult = await finalizeSpellingBeeResult({
          runId: item?.automation_run_id,
          pupilId: session?.pupil_id,
          endedReason: result?.endedReason || "completed",
          result,
        });
        const eventClosed = item?.end_at ? new Date(item.end_at).getTime() <= Date.now() : false;
        const leaderboardRows = eventClosed
          ? await listSpellingBeeResultsForRun({ runId: item?.automation_run_id }).catch((error) => {
            console.warn("read spelling bee leaderboard error:", error);
            return [];
          })
          : [];
        const summaryItem = {
          ...item,
          spellingBeeResult: finalizedResult || spellingBeeStartRow || item?.spellingBeeResult || null,
        };
        containerEl.innerHTML = renderSpellingBeeCompletionSummary(summaryItem, finalizedResult || result, leaderboardRows);
        containerEl.querySelector("#btnBackToPupilDashboard")?.addEventListener("click", async () => {
          await renderPupilHome(containerEl, session, { autoOpenBaseline: false });
        });
        return;
      }

      if (isAssignedTask && item?.id && session?.pupil_id) {
        console.log("FINISH TEST writes:", {
          assignmentId: String(item?.id || ""),
          pupilId: String(session?.pupil_id || ""),
          testId: String(item?.test_id || ""),
          writes: [
            "attempts.reconcile",
            "assignment_pupil_statuses.result_json",
            "assignment_pupil_statuses.completed",
          ],
        });
        await reconcileAssignmentResultAttempts({
          pupilId: session?.pupil_id,
          assignmentId: item?.id,
          testId: item?.test_id,
          results: result?.results || [],
          attemptsAllowed: item?.isGenerated ? null : item?.max_attempts,
          attemptSource: item?.attempt_source || "teacher_assigned",
        }).catch((error) => {
          console.warn("reconcile assignment result attempts error:", error);
        });
        await markAssignmentComplete({
          teacherId: item?.teacher_id,
          assignmentId: item?.id,
          classId: item?.class_id,
          testId: item?.test_id,
          pupilId: session?.pupil_id,
          result,
        }).catch((error) => {
          console.warn("mark assignment complete error:", error);
        });
      }
      console.log("POST-FINISH refresh triggered:", {
        assignmentId: String(item?.id || ""),
        pupilId: String(session?.pupil_id || ""),
        testId: String(item?.test_id || ""),
      });
      containerEl.innerHTML = renderCompletionSummary(item, result);
      containerEl.querySelector("#btnBackToPupilDashboard")?.addEventListener("click", async () => {
        await renderPupilHome(containerEl, session, { autoOpenBaseline: false });
      });
    },
  });
}

function renderDashboard(containerEl, session, assignments, practiceModel, progress) {
  const name = session?.first_name || session?.username || "Pupil";
  containerEl.innerHTML = `
    <div class="pupilDashboardShell">
      ${renderPupilAnalyticsHero(name, assignments, practiceModel, progress, session)}
      ${renderYourProgressCard(assignments, practiceModel, progress)}
      ${assignments.length ? renderAssignments(assignments) : renderAssignmentsEmptyState()}
      ${renderPracticeSection(practiceModel)}
      ${renderReadingHelpSection()}
    </div>
  `;
  attachDashboardEvents(containerEl, session, assignments, practiceModel, progress);
}

export async function renderPupilView(containerEl, session) {
  if (!containerEl) return;
  applyAccessibilitySettings();
  const name = session?.first_name || session?.username || "Pupil";
  containerEl.innerHTML = renderSummaryCardWithSchool(name, session);
  try {
    await renderPupilHome(containerEl, session);
  } catch (error) {
    containerEl.innerHTML = `${renderSummaryCardWithSchool(name, session)}<section class="card"><p class="muted">Could not load assigned tests.</p><pre style="white-space:pre-wrap;">${escapeHtml(error?.message || String(error))}</pre></section>`;
  }
}
