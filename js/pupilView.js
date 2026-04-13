import { supabase } from "./supabaseClient.js";
import {
  getPupilAssignments,
  markAssignmentComplete,
  markAssignmentSessionOpened,
  readPupilBaselineGateState,
  readAssignmentAttemptRows,
  reconcileAssignmentResultAttempts,
  readAssignmentPupilStatus,
  saveAssignmentProgress,
} from "./db.js?v=1.20";
import { mountGame } from "./game.js?v=1.29";
import { applyAccessibilitySettings, renderAccessibilityControls, saveAccessibilitySettings } from "./accessibility.js";
import { chooseBestFocusGrapheme } from "./data/phonemeHelpers.js";
import { resolveItemAttemptsAllowed } from "./questionTypes.js?v=1.1";
import { renderIcon, renderIconLabel, renderInfoTip } from "./uiIcons.js?v=1.3";
import {
  buildDifficultyMapFromWordRows,
  estimateSpellingAttainmentIndicator,
} from "./spellingIndicator.js?v=1.5";

const PUPIL_SECTION_LIMIT = 3;
const pupilDashboardState = {
  expandedSections: {
    teacher_tasks: false,
  },
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

function buildPupilProgressSnapshot(attempts, difficultyByWordId = new Map()) {
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
  const attainmentIndicator = estimateSpellingAttainmentIndicator({
    responses: latestRows.map((item) => ({
      correct: !!item?.correct,
      difficultyScore: difficultyByWordId.get(String(item?.test_word_id || ""))?.coreScore
        ?? difficultyByWordId.get(String(item?.test_word_id || ""))?.score
        ?? 50,
    })),
    checkedAccuracy: accuracy,
    firstTimeCorrectRate: firstTrySuccessRate,
    completionRate: null,
    averageAttempts,
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
    .select("assignment_target_id, test_word_id, correct, attempt_number, created_at, focus_grapheme, pattern_type, word_text, target_graphemes")
    .eq("pupil_id", pupilId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(600);
  if (error) return null;

  const attempts = data || [];
  const testWordIds = [...new Set(
    attempts
      .map((item) => String(item?.test_word_id || "").trim())
      .filter(Boolean)
  )];
  let difficultyByWordId = new Map();

  if (testWordIds.length) {
    const { data: wordRows } = await supabase
      .from("test_words")
      .select("id,word,segments,choice")
      .in("id", testWordIds);
    difficultyByWordId = buildDifficultyMapFromWordRows(wordRows || []);
  }

  return buildPupilProgressSnapshot(attempts, difficultyByWordId);
}

async function loadAssignments(pupilId) {
  const { data: memberships, error: membershipError } = await supabase
    .from("pupil_classes")
    .select("class_id")
    .eq("pupil_id", pupilId)
    .eq("active", true);
  if (membershipError) throw membershipError;

  const classIds = (memberships || []).map((m) => m.class_id).filter(Boolean);
  if (!classIds.length) return [];

  const perClass = await Promise.all(classIds.map((classId) => getPupilAssignments({ classId, pupilId })));
  const rows = perClass.flat();
  const assignmentIds = rows.map((r) => r.id).filter(Boolean);
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

  return rows
    .map((item) => {
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

      console.log("PUPIL DASHBOARD source:", {
        assignmentId: String(item?.id || ""),
        pupilId: String(pupilId || ""),
        source: hasSummary ? "assignment_pupil_statuses.result_json" : "attempts",
        totalWords: totalWordCount,
        correctWords: correctWordCount,
        summaryCount: summaryRows.length,
        attemptCount: latestAttempts.length,
      });

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
}

function formatPracticeFocusLabel(focus) {
  const clean = String(focus || "").trim().toLowerCase();
  if (!clean || clean === "general") return "Mixed";
  return clean;
}

function buildPracticePackFromWords({ focus, words, id }) {
  if (!Array.isArray(words) || !words.length) return null;
  const focusLabel = formatPracticeFocusLabel(focus);
  return {
    id,
    title: `${focusLabel} practice`,
    shortLabel: focusLabel === "Mixed" ? "Mixed practice" : `Practise ${focusLabel}`,
    focus: focusLabel,
    words: words.map((row) => ({
      ...row,
      choice: {
        ...(row.choice || {}),
        question_type: "focus_sound",
      },
    })),
    test_id: words[0].test_id,
    attempt_source: "practice",
    max_attempts: 3,
    mode: "practice",
    audio_enabled: true,
    hints_enabled: true,
  };
}

async function loadPracticePacks(pupilId) {
  const { data: attempts, error } = await supabase
    .from("attempts")
    .select("test_word_id, test_id, correct, pattern_type, focus_grapheme, created_at")
    .eq("pupil_id", pupilId)
    .eq("correct", false)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  const latestWrong = attempts || [];
  if (!latestWrong.length) return [];

  const focusGroups = new Map();
  for (const item of latestWrong) {
    const key = String(item.focus_grapheme || item.pattern_type || "general").trim().toLowerCase() || "general";
    const next = focusGroups.get(key) || [];
    next.push(item);
    focusGroups.set(key, next);
  }
  const rankedFocuses = [...focusGroups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  const testWordIds = [...new Set(
    rankedFocuses.flatMap(([, items]) => items.map((item) => item.test_word_id).filter(Boolean))
  )];
  if (!testWordIds.length) return [];

  const { data: wordRows } = await supabase.from("test_words").select("id,test_id,word,sentence,segments,choice").in("id", testWordIds);
  const wordsById = new Map((wordRows || []).map((row) => [String(row.id), row]));
  const packs = rankedFocuses
    .map(([focus, items], index) => {
      const words = [...new Set(items.map((item) => item.test_word_id).filter(Boolean))]
        .map((id) => wordsById.get(String(id)))
        .filter(Boolean)
        .slice(0, 6);
      return buildPracticePackFromWords({
        id: `focus:${focus}:${index}`,
        focus,
        words,
      });
    })
    .filter(Boolean);

  if (packs.length) return packs;

  const fallbackWords = [...new Set(latestWrong.map((item) => item.test_word_id).filter(Boolean))]
    .map((id) => wordsById.get(String(id)))
    .filter(Boolean)
    .slice(0, 6);
  const fallbackPack = buildPracticePackFromWords({
    id: "focus:mixed:0",
    focus: "general",
    words: fallbackWords,
  });
  return fallbackPack ? [fallbackPack] : [];
}

function renderSummaryCard(name) {
  return `
    <div class="pupil-header">
      <h2>Hello ${escapeHtml(name)}</h2>
      <p class="muted">Loading your latest wins and next steps.</p>
    </div>
  `;
}

function renderBaselineGateState(name, { mode = "waiting", assignment = null } = {}) {
  const isResume = mode === "resume";
  const isStart = mode === "start";
  const title = isResume
    ? "Finish your baseline test first"
    : isStart
      ? "Start your baseline test first"
      : "Baseline test not ready yet";
  const text = isResume
    ? "Complete your baseline test before you move into your normal tasks."
    : isStart
      ? "Complete your baseline test before you move into your normal tasks."
      : "Your teacher will set your baseline test soon.";
  const buttonHtml = assignment
    ? `<button class="btn primary start-test-btn" type="button" data-action="open-gated-baseline" data-assignment-id="${escapeHtml(String(assignment?.id || ""))}">${isResume ? "Continue baseline test" : "Start baseline test"}</button>`
    : "";
  return `
    <div class="pupilDashboardShell">
      <div class="pupil-header">
        <h2>Hello ${escapeHtml(name)}</h2>
        <p class="muted">Your baseline test comes first.</p>
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

function buildPupilHeroModel(assignments, practicePacks, progress) {
  const pendingAssignments = (assignments || []).filter((item) => !item?.completed);
  const completedAssignments = (assignments || []).filter((item) => !!item?.completed);
  const wordsChecked = Number(progress?.wordsChecked || 0);
  const strongSounds = progress?.secureNow || [];
  const growingSounds = progress?.growing || [];
  const nextStretch = progress?.practiseNext || [];
  const recentWins = progress?.recentWins || [];
  const practiceCount = Array.isArray(practicePacks) ? practicePacks.length : 0;
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

function renderPupilAnalyticsHero(name, assignments, practicePacks, progress) {
  const hero = buildPupilHeroModel(assignments, practicePacks, progress);

  return `
    <section class="card pupilHeroCard">
      <div class="pupilHeroTop">
        <div class="pupilHeroIntro">
          <h2>Hello ${escapeHtml(name)}</h2>
          <p class="pupilHeroCopy">${escapeHtml(hero.summary)}</p>
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

function renderAssignmentCard(item) {
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

function renderPracticeSection(practicePacks) {
  if (!practicePacks?.length) return "";

  return `
    <section class="card pupilSectionCard pupilPracticeSection">
      <div class="pupilSectionHead">
        <div class="pupilSectionTitleRow">
          <h3>${renderIconLabel("spark", "Extra practice")}</h3>
        </div>
      </div>
      <div class="pupilPracticeOptions">
        ${practicePacks.map((pack, index) => renderPracticeOption(pack, index)).join("")}
      </div>
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

function attachDashboardEvents(containerEl, session, assignments, practicePacks, progress) {
  containerEl.querySelectorAll("[data-assignment]").forEach((button) => {
    button.addEventListener("click", () => {
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
      renderDashboard(containerEl, session, assignments, practicePacks, progress);
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

  if (gateState?.status === "waiting") {
    containerEl.innerHTML = renderBaselineGateState(name, { mode: "waiting" });
    bindAccessibilityControlEvents(containerEl);
    return;
  }

  const assignments = await loadAssignments(pupilId);

  if (gateState?.status === "resume" || gateState?.status === "start") {
    const baselineAssignment = assignments.find((item) => String(item?.id || "") === String(gateState?.assignmentId || ""));
    if (!baselineAssignment) {
      containerEl.innerHTML = renderBaselineGateState(name, { mode: "waiting" });
      bindAccessibilityControlEvents(containerEl);
      return;
    }
    if (autoOpenBaseline) {
      await openSession(containerEl, session, baselineAssignment, assignments, []);
      return;
    }
    containerEl.innerHTML = renderBaselineGateState(name, {
      mode: gateState.status,
      assignment: baselineAssignment,
    });
    containerEl.querySelector('[data-action="open-gated-baseline"]')?.addEventListener("click", async () => {
      await openSession(containerEl, session, baselineAssignment, assignments, []);
    });
    bindAccessibilityControlEvents(containerEl);
    return;
  }

  const [practicePacks, progress] = await Promise.all([
    loadPracticePacks(pupilId),
    loadPupilProgress(pupilId),
  ]);
  renderDashboard(containerEl, session, assignments, practicePacks, progress);
}

async function openSession(containerEl, session, item, assignments, practicePacks) {
  const isAssignedTask = !!item?.class_id && item?.attempt_source !== "practice";
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

  mountGame({
    host: containerEl,
    words: item.words || [],
    testMeta: {
      id: item.test_id,
      title: getDisplayedAssignmentTitle(item),
      question_type: item.question_type || "focus_sound",
      mode: item.mode || "test",
      max_attempts: item.max_attempts == null ? null : item.max_attempts,
      attempt_source: item.attempt_source || "test",
      audio_enabled: item.audio_enabled !== false,
      hints_enabled: item.hints_enabled !== false,
    },
    pupilId: session?.pupil_id,
    assignmentId: item.id || null,
    resumeState,
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

function renderDashboard(containerEl, session, assignments, practicePacks, progress) {
  const name = session?.first_name || session?.username || "Pupil";
  containerEl.innerHTML = `
    <div class="pupilDashboardShell">
      ${renderPupilAnalyticsHero(name, assignments, practicePacks, progress)}
      ${renderProgressSection(progress)}
      ${assignments.length ? renderAssignments(assignments) : renderAssignmentsEmptyState()}
      ${renderPracticeSection(practicePacks)}
      ${renderReadingHelpSection()}
    </div>
  `;
  attachDashboardEvents(containerEl, session, assignments, practicePacks, progress);
}

export async function renderPupilView(containerEl, session) {
  if (!containerEl) return;
  applyAccessibilitySettings();
  const name = session?.first_name || session?.username || "Pupil";
  containerEl.innerHTML = renderSummaryCard(name);
  try {
    await renderPupilHome(containerEl, session);
  } catch (error) {
    containerEl.innerHTML = `${renderSummaryCard(name)}<section class="card"><p class="muted">Could not load assigned tests.</p><pre style="white-space:pre-wrap;">${escapeHtml(error?.message || String(error))}</pre></section>`;
  }
}
