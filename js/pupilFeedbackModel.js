function parseDateMs(value) {
  const ms = new Date(value || "").getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeWordLabel(value = "") {
  return normalizeText(value);
}

function buildAttemptKey(attempt = {}) {
  const assignmentTargetId = normalizeText(attempt?.assignment_target_id || attempt?.assignmentTargetId);
  if (assignmentTargetId) return `target:${assignmentTargetId}`;

  const testWordId = normalizeText(attempt?.test_word_id || attempt?.testWordId);
  if (testWordId) return `word:${testWordId}`;

  const wordText = normalizeWordLabel(attempt?.word_text || attempt?.wordText);
  return wordText ? `text:${wordText.toLowerCase()}` : "";
}

function uniqueLabels(rows = [], limit = 3) {
  const labels = [];
  const seen = new Set();
  for (const row of rows) {
    const label = normalizeWordLabel(row?.word);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
    if (labels.length >= limit) break;
  }
  return labels;
}

function formatFocusLabel(value = "") {
  const clean = normalizeText(value).toLowerCase();
  if (!clean || clean === "general") return "Mixed";
  return clean;
}

function buildEncouragement({ wordsChecked = 0, pendingAssignments = 0, completedAssignments = 0 } = {}) {
  if (wordsChecked >= 4) return "Here are a few bright spots from your recent spelling.";
  if (completedAssignments > 0) return "Nice work. Your checked words are starting to build a picture.";
  if (pendingAssignments > 0) return "Your next checked word will help this card grow.";
  return "Every checked word helps build your progress.";
}

function normalizeAttemptSource(value = "") {
  return normalizeText(value).toLowerCase();
}

function isBaselineAttempt(attempt = null) {
  return normalizeAttemptSource(attempt?.attempt_source || attempt?.attemptSource) === "baseline";
}

function isPracticeAttempt(attempt = null) {
  return normalizeAttemptSource(attempt?.attempt_source || attempt?.attemptSource) === "practice";
}

function isIncludedProgressAttempt(attempt = null) {
  return !!attempt && !isBaselineAttempt(attempt) && !isPracticeAttempt(attempt);
}

function isIncludedRecentResult(item = null) {
  if (!item?.completed) return false;
  if (item?.isBaseline || item?.isSpellingBee) return false;
  return normalizeAttemptSource(item?.attempt_source || item?.attemptSource) !== "practice";
}

function formatCountLabel(value = 0, singular = "task", plural = "tasks") {
  const safeValue = Math.max(0, Number(value) || 0);
  return `${safeValue} ${safeValue === 1 ? singular : plural}`;
}

function formatResultScoreText(item = null) {
  const totalWords = Math.max(0, Number(
    item?.totalWordCount
    ?? item?.total_words
    ?? item?.totalWords
    ?? 0
  ));
  const correctWords = Math.max(0, Number(
    item?.correctWordCount
    ?? item?.correct_words
    ?? item?.correctWords
    ?? 0
  ));
  if (totalWords > 0) return `${correctWords}/${totalWords}`;

  const scoreRate = Number(item?.scoreRate ?? item?.score_rate ?? 0);
  if (Number.isFinite(scoreRate)) {
    return `${Math.round(scoreRate * 100)}%`;
  }
  return "";
}

function buildLatestResultText(item = null) {
  const totalWords = Math.max(0, Number(
    item?.totalWordCount
    ?? item?.total_words
    ?? item?.totalWords
    ?? 0
  ));
  const correctWords = Math.max(0, Number(
    item?.correctWordCount
    ?? item?.correct_words
    ?? item?.correctWords
    ?? 0
  ));
  if (totalWords > 0) {
    return `You spelled ${correctWords} out of ${totalWords} words correctly in your latest task.`;
  }

  const scoreRate = Number(item?.scoreRate ?? item?.score_rate ?? 0);
  if (Number.isFinite(scoreRate)) {
    return `You got ${Math.round(scoreRate * 100)}% correct in your latest task.`;
  }

  return "";
}

function buildShortDateLabel(value = "") {
  const ms = parseDateMs(value);
  if (!ms) return "Recently";
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function getAssignmentDisplayTitle(item = null) {
  return normalizeText(item?.pupilTitle || item?.pupil_title || item?.title || "Task") || "Task";
}

const PUPIL_STAGE_LABELS = {
  easier: "Foundations",
  core: "Core patterns",
  stretch: "Expanding patterns",
  challenge: "Advanced patterns",
};

const PUPIL_STAGE_SUMMARY_TEXT = {
  easier: {
    growing: "You're building confidence with foundation spelling patterns.",
    secure: "You're working securely with foundation spelling patterns.",
  },
  core: {
    growing: "You're building confidence with core patterns.",
    secure: "You're working securely with core patterns.",
  },
  stretch: {
    growing: "You're building confidence with expanding patterns.",
    secure: "You're working securely with expanding patterns.",
  },
  challenge: {
    growing: "You're building confidence with advanced patterns.",
    secure: "You're ready for more advanced spelling patterns.",
  },
};

const ATTAINMENT_LABEL_TO_STAGE_KEY = {
  foundations: "easier",
  "core patterns": "core",
  "expanding patterns": "stretch",
  "advanced patterns": "challenge",
};

function getBeeRoundReached(item = null) {
  const candidates = [
    item?.spellingBeeResult?.rounds_attempted,
    item?.attemptedWordCount,
    item?.spellingBeeResult?.streak,
    item?.correctWordCount,
  ];

  for (const value of candidates) {
    const roundReached = Math.max(0, Number(value) || 0);
    if (roundReached > 0) return roundReached;
  }

  return 0;
}

function compareBeeRows(a = null, b = null, mode = "latest") {
  const aCompletedAtMs = parseDateMs(a?.completedAt || a?.completed_at || a?.created_at);
  const bCompletedAtMs = parseDateMs(b?.completedAt || b?.completed_at || b?.created_at);
  const aRoundReached = getBeeRoundReached(a);
  const bRoundReached = getBeeRoundReached(b);

  if (mode === "best") {
    if (bRoundReached !== aRoundReached) return bRoundReached - aRoundReached;
    if (bCompletedAtMs !== aCompletedAtMs) return bCompletedAtMs - aCompletedAtMs;
  } else {
    if (bCompletedAtMs !== aCompletedAtMs) return bCompletedAtMs - aCompletedAtMs;
    if (bRoundReached !== aRoundReached) return bRoundReached - aRoundReached;
  }

  return normalizeText(b?.id || "").localeCompare(normalizeText(a?.id || ""));
}

function buildNextFocusModel(practiceModel = null, progress = null) {
  const rawFocus = normalizeText(
    practiceModel?.focusGrapheme
    || practiceModel?.packs?.[0]?.focus
    || progress?.practiseNext?.[0]?.target
    || ""
  );
  const focus = rawFocus ? formatFocusLabel(rawFocus) : "Mixed";

  if (focus === "Mixed") {
    return {
      key: "next_focus",
      label: "What to try next",
      text: "Keep practising a mix of words to build confidence.",
      chips: ["Mixed words"],
      variant: "practice",
    };
  }

  return {
    key: "next_focus",
    label: "What to try next",
    text: `Practise words with '${focus}' next.`,
    chips: [focus],
    variant: "practice",
  };
}

export function buildPupilAttemptFeedbackSignals(attempts = []) {
  const rows = Array.isArray(attempts) ? attempts : [];
  const latestByKey = new Map();
  const historyByKey = new Map();

  for (const attempt of rows) {
    const key = buildAttemptKey(attempt);
    if (!key) continue;

    latestByKey.set(key, attempt);
    const history = historyByKey.get(key) || [];
    history.push(attempt);
    historyByKey.set(key, history);
  }

  const recentEffortWords = uniqueLabels(
    Array.from(latestByKey.values())
      .map((attempt) => ({
        word: normalizeWordLabel(attempt?.word_text || attempt?.wordText),
        createdAtMs: parseDateMs(attempt?.created_at || attempt?.createdAt),
      }))
      .sort((a, b) => b.createdAtMs - a.createdAtMs),
    3,
  );

  const improvedWords = uniqueLabels(
    Array.from(historyByKey.values())
      .map((history) => history.slice().sort((a, b) => (
        parseDateMs(a?.created_at || a?.createdAt) - parseDateMs(b?.created_at || b?.createdAt)
      )))
      .map((history) => {
        const latestAttempt = history[history.length - 1] || null;
        if (!latestAttempt?.correct) return null;
        const hadEarlierIncorrect = history.slice(0, -1).some((attempt) => !attempt?.correct);
        if (!hadEarlierIncorrect) return null;
        return {
          word: normalizeWordLabel(latestAttempt?.word_text || latestAttempt?.wordText),
          createdAtMs: parseDateMs(latestAttempt?.created_at || latestAttempt?.createdAt),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.createdAtMs - a.createdAtMs),
    3,
  );

  return {
    recentEffortWords,
    improvedWords,
  };
}

export function buildPupilFeedbackCardModel({
  assignments = [],
  practiceModel = null,
  progress = null,
} = {}) {
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const attemptHistory = Array.isArray(progress?.attemptHistory) ? progress.attemptHistory : [];
  const signals = buildPupilAttemptFeedbackSignals(attemptHistory);
  const pendingAssignments = safeAssignments.filter((item) => !item?.completed).length;
  const completedAssignments = safeAssignments.filter((item) => !!item?.completed).length;
  const wordsChecked = Math.max(0, Number(progress?.wordsChecked || 0));

  const rawPracticeFocus = normalizeText(
    practiceModel?.focusGrapheme
    || practiceModel?.packs?.[0]?.focus
    || progress?.practiseNext?.[0]?.target
    || ""
  );
  const practiceFocus = rawPracticeFocus ? formatFocusLabel(rawPracticeFocus) : "";

  const items = [];
  if (signals.recentEffortWords.length) {
    items.push({
      key: "recent_effort",
      label: "Recently checked",
      text: signals.recentEffortWords.length === 1
        ? "You checked this word recently."
        : `You checked ${signals.recentEffortWords.length} words recently.`,
      chips: signals.recentEffortWords,
      variant: "wins",
    });
  }

  if (signals.improvedWords.length) {
    items.push({
      key: "improved_words",
      label: "Getting stronger",
      text: signals.improvedWords.length === 1
        ? "You got this word right after another try."
        : `You got ${signals.improvedWords.length} words right after another try.`,
      chips: signals.improvedWords,
      variant: "growing",
    });
  }

  if (practiceFocus) {
    items.push({
      key: "next_focus",
      label: "Practise next",
      text: practiceFocus === "Mixed"
        ? "A mixed practice set is ready for you next."
        : "This spelling pattern is a good next step.",
      chips: [practiceFocus],
      variant: "practice",
    });
  }

  if (!items.length) {
    items.push({
      key: "encouragement",
      label: "Keep going",
      text: buildEncouragement({ wordsChecked, pendingAssignments, completedAssignments }),
      chips: [],
      variant: "wins",
    });
  }

  const intro = items.length === 1 && items[0]?.key === "encouragement"
    ? ""
    : buildEncouragement({ wordsChecked, pendingAssignments, completedAssignments });

  return {
    title: "Good news so far",
    intro,
    items,
  };
}

export function buildPupilProgressCardModel({
  assignments = [],
  practiceModel = null,
  progress = null,
} = {}) {
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const filteredAttempts = (Array.isArray(progress?.attemptHistory) ? progress.attemptHistory : [])
    .filter((attempt) => isIncludedProgressAttempt(attempt));
  const signals = buildPupilAttemptFeedbackSignals(filteredAttempts);
  const recentResults = safeAssignments
    .filter((item) => isIncludedRecentResult(item))
    .sort((a, b) => (
      parseDateMs(b?.completedAt || b?.completed_at || b?.created_at)
      - parseDateMs(a?.completedAt || a?.completed_at || a?.created_at)
    ))
    .slice(0, 3)
    .map((item, index) => ({
      key: String(item?.id || `result-${index + 1}`),
      title: getAssignmentDisplayTitle(item),
      dateLabel: buildShortDateLabel(item?.completedAt || item?.completed_at || item?.created_at),
      scoreText: formatResultScoreText(item),
    }));
  const latestResultSource = recentResults[0]
    ? safeAssignments.find((item) => String(item?.id || "") === String(recentResults[0].key))
    : null;
  const improvedWords = Array.isArray(signals?.improvedWords) ? signals.improvedWords : [];
  const nextFocus = buildNextFocusModel(practiceModel, progress);
  const hasAnyEvidence = filteredAttempts.length > 0 || safeAssignments.some((item) => isIncludedRecentResult(item));

  const blocks = [];
  if (recentResults.length) {
    blocks.push({
      key: "recent_effort",
      label: "What you've done",
      text: `Great effort. You've finished ${formatCountLabel(recentResults.length, "recent task", "recent tasks")}.`,
      chips: [],
      variant: "wins",
    });
  }

  const latestResultText = buildLatestResultText(latestResultSource);
  if (latestResultText) {
    blocks.push({
      key: "latest_result",
      label: "Your latest result",
      text: latestResultText,
      chips: [],
      variant: "wins",
    });
  }

  if (improvedWords.length) {
    blocks.push({
      key: "getting_stronger",
      label: "Getting stronger",
      text: `You improved on ${formatCountLabel(improvedWords.length, "word", "words")} you had found tricky before.`,
      chips: improvedWords.slice(0, 3),
      variant: "growing",
    });
  }

  blocks.push(nextFocus);

  let intro = "";
  let state = "ready";
  if (!hasAnyEvidence) {
    state = "empty";
    intro = "Complete a few activities and your progress will appear here.";
  } else if (!recentResults.length) {
    state = "light";
    intro = "You're getting started. Each finished activity helps build your progress.";
  }

  return {
    title: "Your progress",
    state,
    intro,
    blocks,
    recentResults,
  };
}

export function buildPupilSpellingStageModel(progress = null) {
  const indicator = progress?.attainmentIndicator || null;
  const responseCount = Math.max(0, Number(indicator?.responseCount || 0));
  const evidenceKey = normalizeText(indicator?.evidence?.key).toLowerCase();
  if (!indicator || responseCount < 10 || (evidenceKey !== "secure" && evidenceKey !== "strong")) {
    return null;
  }

  const stageKey = normalizeText(indicator?.attainmentBand?.key).toLowerCase()
    || ATTAINMENT_LABEL_TO_STAGE_KEY[normalizeText(indicator?.attainmentDisplayLabel).toLowerCase()]
    || "";
  const stageLabel = PUPIL_STAGE_LABELS[stageKey];
  if (!stageLabel) return null;

  const performanceKey = normalizeText(indicator?.performanceKey).toLowerCase();
  const tone = performanceKey === "secure" || performanceKey === "strong"
    ? "secure"
    : "growing";
  const summaryText = PUPIL_STAGE_SUMMARY_TEXT[stageKey]?.[tone] || "";
  if (!summaryText) return null;

  return {
    title: "Current spelling stage",
    stageKey,
    stageLabel,
    summaryText,
    tone,
  };
}

export function buildPupilSpellingBeeSummaryModel(assignments = []) {
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const completedBeeRows = safeAssignments
    .filter((item) => !!item?.isSpellingBee && !!item?.completed)
    .map((item) => ({
      ...item,
      roundReached: getBeeRoundReached(item),
    }))
    .filter((item) => item.roundReached > 0);

  if (!completedBeeRows.length) return null;

  const latestBee = completedBeeRows.slice().sort((a, b) => compareBeeRows(a, b, "latest"))[0] || null;
  const bestBee = completedBeeRows.slice().sort((a, b) => compareBeeRows(a, b, "best"))[0] || null;
  if (!latestBee || !bestBee) return null;

  const rank = Math.max(0, Number(latestBee?.spellingBeeRank || 0)) || null;

  return {
    title: "Spelling Bee",
    latestText: `Latest Bee: You reached round ${latestBee.roundReached}.`,
    bestText: `Best result: Round ${bestBee.roundReached}.`,
    rankText: latestBee?.spellingBeeEventClosed && rank
      ? `Your rank: #${rank}`
      : "",
  };
}
