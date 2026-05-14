import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildAutoAssignmentComposition,
  buildGeneratedAssignmentPlan,
  selectApprovedTargetWords,
} = await loadBrowserModule("../js/assignmentEngine.js", import.meta.url);

const TESTS = [];
const AUDIT_VERSION = "selector_intelligence_audit_v1";
const AUDIT_NOW_ISO = "2026-05-14T12:00:00.000Z";
const ASSIGNMENT_LENGTH = 10;
const RECENT_UNIQUE_WORD_LIMIT = 4;
const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function test(name, fn) {
  TESTS.push({ name, fn });
}

function normalizeWord(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "")
    .replace(/[^a-z'-]/g, "");
}

function normalizeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
}

function bandForScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "unknown";
  if (value <= 35) return "easier";
  if (value <= 55) return "core";
  if (value <= 70) return "stretch";
  return "challenge";
}

function roundOne(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : null;
}

function average(values = []) {
  const clean = values.map((value) => Number(value)).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function incrementCount(target, key) {
  const cleanKey = String(key || "unknown").trim() || "unknown";
  target[cleanKey] = (target[cleanKey] || 0) + 1;
}

function countBy(items = [], getter) {
  const counts = {};
  for (const item of items) {
    incrementCount(counts, getter(item));
  }
  return counts;
}

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

function auditWordRow({
  id,
  word,
  focus,
  segments,
  score,
  source = "wordloom_core",
  band = null,
  sentence = null,
  meaning = null,
} = {}) {
  const cleanFocus = normalizeToken(focus);
  const cleanWord = normalizeWord(word);
  const difficultyBand = band || bandForScore(score);
  const choice = {
    source,
    focus_graphemes: [cleanFocus],
    selection_suitability: "standard",
    suitability_status: "suitable",
    approval_status: "approved",
    is_active: true,
    difficulty: {
      coreScore: score,
      score,
      band: difficultyBand,
      coreBand: difficultyBand,
    },
  };

  if (source === "wordloom_core") {
    choice.origin_word_source = "wordloom_core";
    choice.origin_bank_word_id = `core-${id}`;
    choice.primary_focus_grapheme = cleanFocus;
    choice.focus_target_links = [{ focus_grapheme: cleanFocus, target_role: "primary" }];
    choice.context_support = {
      sentence: sentence || `${cleanWord} appears in a sentence.`,
      meaning: meaning || `${cleanWord} meaning.`,
      sentence_status: "approved",
      meaning_status: "approved",
      meaning_enabled: true,
    };
  }

  return {
    id,
    word: cleanWord,
    sentence: sentence || `${cleanWord} appears in a sentence.`,
    segments,
    choice,
  };
}

function buildRowsForFocus(focus, entries, defaults = {}) {
  return entries.map(([word, score, segments, extra = {}], index) =>
    auditWordRow({
      id: `${focus}-${index + 1}`,
      word,
      focus,
      score,
      segments,
      ...defaults,
      ...extra,
    })
  );
}

function buildAuditBankRows() {
  return [
    ...buildRowsForFocus("ai", [
      ["rain", 24, ["r", "ai", "n"]],
      ["train", 26, ["t", "r", "ai", "n"]],
      ["paint", 28, ["p", "ai", "n", "t"]],
      ["snail", 30, ["s", "n", "ai", "l"]],
      ["brain", 32, ["b", "r", "ai", "n"]],
      ["chain", 34, ["ch", "ai", "n"]],
    ]),
    ...buildRowsForFocus("ee", [
      ["seed", 24, ["s", "ee", "d"]],
      ["green", 26, ["g", "r", "ee", "n"]],
      ["sleep", 28, ["s", "l", "ee", "p"]],
      ["queen", 30, ["qu", "ee", "n"]],
    ]),
    ...buildRowsForFocus("ow", [
      ["snow", 28, ["s", "n", "ow"]],
      ["crow", 30, ["c", "r", "ow"]],
      ["grow", 32, ["g", "r", "ow"]],
      ["yellow", 34, ["y", "e", "ll", "ow"]],
    ], { source: "teacher" }),
    ...buildRowsForFocus("oa", [
      ["boat", 26, ["b", "oa", "t"]],
      ["coat", 28, ["c", "oa", "t"]],
      ["road", 30, ["r", "oa", "d"]],
      ["float", 32, ["f", "l", "oa", "t"]],
    ]),
    ...buildRowsForFocus("igh", [
      ["light", 32, ["l", "igh", "t"]],
      ["night", 34, ["n", "igh", "t"]],
      ["bright", 36, ["b", "r", "igh", "t"]],
      ["flight", 38, ["f", "l", "igh", "t"]],
    ]),
    ...buildRowsForFocus("ph", [
      ["phone", 30, ["ph", "o", "n", "e"]],
      ["photo", 32, ["ph", "o", "t", "o"]],
    ]),
    ...buildRowsForFocus("sh", [
      ["shell", 34, ["sh", "e", "ll"]],
      ["shop", 36, ["sh", "o", "p"]],
      ["shape", 40, ["sh", "a", "p", "e"]],
      ["wish", 44, ["w", "i", "sh"]],
      ["shadow", 48, ["sh", "a", "d", "ow"]],
      ["shower", 52, ["sh", "ow", "er"]],
    ]),
    ...buildRowsForFocus("tion", [
      ["action", 44, ["a", "c", "tion"]],
      ["motion", 46, ["m", "o", "tion"]],
      ["station", 48, ["s", "t", "a", "tion"]],
      ["fiction", 50, ["f", "i", "c", "tion"]],
      ["mention", 54, ["m", "e", "n", "tion"]],
      ["question", 58, ["qu", "e", "s", "tion"]],
    ]),
    ...buildRowsForFocus("ie", [
      ["field", 56, ["f", "ie", "l", "d"]],
      ["brief", 60, ["b", "r", "ie", "f"]],
      ["shield", 62, ["sh", "ie", "l", "d"]],
      ["chief", 64, ["ch", "ie", "f"]],
      ["belief", 66, ["b", "e", "l", "ie", "f"], { band: "stretch" }],
      ["achieve", 72, ["a", "ch", "ie", "v", "e"], { band: "challenge" }],
    ]),
    ...buildRowsForFocus("or", [
      ["storm", 58, ["s", "t", "or", "m"]],
      ["short", 60, ["sh", "or", "t"]],
      ["north", 62, ["n", "or", "th"]],
      ["thorn", 64, ["th", "or", "n"]],
    ]),
    ...buildRowsForFocus("th", [
      ["three", 34, ["th", "r", "ee"]],
      ["thin", 36, ["th", "i", "n"]],
      ["path", 38, ["p", "a", "th"]],
      ["think", 40, ["th", "i", "n", "k"]],
    ]),
    ...buildRowsForFocus("dge", [
      ["bridge", 56, ["b", "r", "i", "dge"]],
      ["badge", 58, ["b", "a", "dge"]],
      ["edge", 60, ["e", "dge"]],
      ["dodge", 62, ["d", "o", "dge"]],
    ]),
    ...buildRowsForFocus("ci", [
      ["citrus", 62, ["ci", "t", "r", "u", "s"]],
      ["special", 66, ["s", "pe", "ci", "al"]],
      ["circle", 70, ["ci", "r", "c", "le"]],
      ["cinema", 74, ["ci", "n", "e", "m", "a"], { band: "challenge" }],
    ]),
    ...buildRowsForFocus("ure", [
      ["pure", 64, ["p", "ure"]],
      ["cure", 66, ["c", "ure"]],
      ["future", 70, ["f", "u", "t", "ure"]],
      ["picture", 72, ["p", "i", "c", "t", "ure"], { band: "challenge" }],
    ]),
  ];
}

const AUDIT_BANK_ROWS = buildAuditBankRows();
const WORD_META_BY_WORD = new Map(
  AUDIT_BANK_ROWS.map((row) => [normalizeWord(row.word), {
    segments: row.segments,
    focus: row.choice?.focus_graphemes?.[0] || "",
    score: row.choice?.difficulty?.coreScore ?? row.choice?.difficulty?.score ?? 0,
  }])
);

function makeProfile({
  band,
  concernRows,
  secureRows,
  developingRows,
  confusionByTarget = new Map(),
} = {}) {
  return {
    totalEvidence: concernRows.length + secureRows.length + developingRows.length,
    graphemeRows: [...concernRows, ...secureRows, ...developingRows],
    concernRows,
    secureRows,
    developingRows,
    confusionByTarget,
    placementMeta: {
      targetChallengeLevel: band,
      baselinePlacement: band,
      headlinePlacement: band,
      confidence: "audit_fixture",
    },
  };
}

function makeScenarioDefinitions() {
  return [
    {
      id: "needs_support",
      label: "Needs support pupil",
      pupilId: "audit-needs-support",
      primaryFocus: "ph",
      supportPreset: "balanced",
      profile: makeProfile({
        band: "needs_support",
        concernRows: [{
          target: "ph",
          total: 4,
          correct: 1,
          incorrect: 3,
          accuracy: 0.25,
          firstTrySuccessRate: 0.25,
          recentIncorrectCount: 2,
          securityBand: "insecure",
          repeatedFailure: true,
        }],
        secureRows: [
          { target: "ai", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
          { target: "ee", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
          { target: "ow", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
        ],
        developingRows: [
          { target: "or", total: 3, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure" },
        ],
        confusionByTarget: new Map([[
          "ph",
          { expected: "ph", actual: "f", attemptCount: 2, substitutionCount: 2 },
        ]]),
      }),
      initialAttempts: [
        makeAttempt({ pupilId: "audit-needs-support", word: "phone", correct: false, attemptNumber: 2, createdAt: "2026-05-10T09:00:00.000Z" }),
      ],
    },
    {
      id: "core_developing",
      label: "Core developing pupil",
      pupilId: "audit-core-developing",
      primaryFocus: "sh",
      supportPreset: "balanced",
      profile: makeProfile({
        band: "core_developing",
        concernRows: [{
          target: "sh",
          total: 4,
          correct: 2,
          incorrect: 2,
          accuracy: 0.5,
          firstTrySuccessRate: 0.5,
          securityBand: "nearly_secure",
        }],
        secureRows: [
          { target: "ai", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
          { target: "ee", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
          { target: "ow", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
        ],
        developingRows: [
          { target: "th", total: 3, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure" },
          { target: "or", total: 3, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure" },
        ],
      }),
      initialAttempts: [
        makeAttempt({ pupilId: "audit-core-developing", word: "shell", correct: true, attemptNumber: 1, createdAt: "2026-05-13T09:00:00.000Z" }),
      ],
    },
    {
      id: "secure_expected",
      label: "Secure expected pupil",
      pupilId: "audit-secure-expected",
      primaryFocus: "tion",
      supportPreset: "balanced",
      profile: makeProfile({
        band: "secure_expected",
        concernRows: [{
          target: "tion",
          total: 3,
          correct: 2,
          incorrect: 1,
          accuracy: 0.67,
          firstTrySuccessRate: 0.67,
          securityBand: "nearly_secure",
        }],
        secureRows: [
          { target: "ai", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
          { target: "ee", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
          { target: "oa", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
        ],
        developingRows: [
          { target: "dge", total: 3, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure" },
          { target: "or", total: 3, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure" },
        ],
      }),
      initialAttempts: [
        makeAttempt({ pupilId: "audit-secure-expected", word: "motion", correct: false, attemptNumber: 2, createdAt: "2026-04-20T09:00:00.000Z" }),
      ],
    },
    {
      id: "early_stretch",
      label: "Early stretch pupil",
      pupilId: "audit-early-stretch",
      primaryFocus: "ie",
      supportPreset: "balanced",
      profile: makeProfile({
        band: "early_stretch",
        concernRows: [{
          target: "ie",
          total: 3,
          correct: 2,
          incorrect: 1,
          accuracy: 0.67,
          firstTrySuccessRate: 0.67,
          securityBand: "nearly_secure",
        }],
        secureRows: [
          { target: "ai", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
          { target: "ee", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
          { target: "oa", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
          { target: "igh", total: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure" },
        ],
        developingRows: [
          { target: "ci", total: 3, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure" },
          { target: "ure", total: 3, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure" },
          { target: "dge", total: 3, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure" },
        ],
      }),
      initialAttempts: [
        makeAttempt({ pupilId: "audit-early-stretch", word: "chief", correct: true, attemptNumber: 1, createdAt: "2026-05-13T09:00:00.000Z" }),
      ],
    },
  ];
}

function makeAttempt({
  pupilId,
  word,
  correct = true,
  attemptNumber = 1,
  createdAt,
} = {}) {
  const cleanWord = normalizeWord(word);
  const meta = WORD_META_BY_WORD.get(cleanWord) || {};
  return {
    pupil_id: pupilId,
    assignment_id: `audit-history-${pupilId}`,
    test_word_id: `history-${cleanWord}`,
    assignment_target_id: null,
    mode: "no_support_assessment",
    attempt_source: "auto_assigned",
    correct,
    attempt_number: attemptNumber,
    created_at: createdAt || AUDIT_NOW_ISO,
    focus_grapheme: meta.focus || "",
    pattern_type: null,
    word_text: cleanWord,
    typed: correct ? cleanWord : "miss",
    target_graphemes: meta.segments || [],
  };
}

function buildUsageStats(attempts = []) {
  const usage = new Map();
  const events = [];

  for (const attempt of attempts) {
    const word = normalizeWord(attempt?.word_text || attempt?.word || "");
    if (!word) continue;
    const seenAt = new Date(attempt?.created_at || 0).getTime();
    const current = usage.get(word) || {
      word,
      count: 0,
      correctCount: 0,
      incorrectCount: 0,
      lastSeenAt: 0,
      lastCorrectAt: 0,
      lastIncorrectAt: 0,
      latestCorrect: null,
      latestAttemptNumber: 0,
      recentlySeen: false,
      recentlySecure: false,
      reviewDue: false,
    };
    const correct = attempt?.correct === true;
    const attemptNumber = Math.max(1, Number(attempt?.attempt_number || 1));
    current.count += 1;
    if (correct) {
      current.correctCount += 1;
      current.lastCorrectAt = Math.max(current.lastCorrectAt, seenAt);
    } else {
      current.incorrectCount += 1;
      current.lastIncorrectAt = Math.max(current.lastIncorrectAt, seenAt);
    }
    if (seenAt >= current.lastSeenAt) {
      current.lastSeenAt = seenAt;
      current.latestCorrect = correct;
      current.latestAttemptNumber = attemptNumber;
    }
    usage.set(word, current);
    events.push({ word, seenAt });
  }

  const latestEvidenceAt = events.reduce((latest, event) => Math.max(latest, event.seenAt), 0);
  const recentCutoff = latestEvidenceAt > 0 ? latestEvidenceAt - RECENT_WINDOW_MS : 0;
  const recentWords = new Set();
  for (const event of [...events].sort((a, b) => b.seenAt - a.seenAt)) {
    if (recentWords.size >= RECENT_UNIQUE_WORD_LIMIT) break;
    if (event.seenAt > 0 && event.seenAt >= recentCutoff) recentWords.add(event.word);
  }

  for (const current of usage.values()) {
    current.recentlySeen = current.lastSeenAt > 0 && recentWords.has(current.word);
    current.recentlySecure = current.recentlySeen
      && current.latestCorrect === true
      && current.latestAttemptNumber <= 1
      && current.incorrectCount === 0;
    current.reviewDue = current.count > 0 && current.lastSeenAt > 0 && !current.recentlySeen;
  }

  return usage;
}

function buildPlanForScenario(scenario, attempts = []) {
  return buildGeneratedAssignmentPlan({
    pupilIds: [scenario.pupilId],
    teacherTests: [{
      id: "selector-intelligence-audit-bank",
      title: "Selector Intelligence Audit Bank",
      test_words: AUDIT_BANK_ROWS,
    }],
    attempts,
    totalWords: ASSIGNMENT_LENGTH,
    currentProfiles: {
      [scenario.pupilId]: scenario.profile,
    },
    policy: {
      assignment_length: ASSIGNMENT_LENGTH,
      support_preset: scenario.supportPreset || "balanced",
      allow_starter_fallback: false,
    },
  });
}

function getDifficultyScore(wordSpec = {}) {
  const score = Number(wordSpec?.difficulty?.coreScore ?? wordSpec?.difficulty?.score);
  return Number.isFinite(score) ? score : null;
}

function getDifficultyBand(wordSpec = {}) {
  const explicit = wordSpec?.difficulty?.band || wordSpec?.difficulty?.coreBand;
  return explicit ? String(explicit) : bandForScore(getDifficultyScore(wordSpec));
}

function getAuditSource(wordSpec = {}) {
  const source = String(wordSpec?.originWordSource || wordSpec?.choice?.origin_word_source || "").trim();
  if (source === "wordloom_core") return "wordloom_core";
  if (source === "library") return "teacher_legacy";
  return source || "unknown";
}

function summarizeDifficulty(words = []) {
  const scores = words.map(getDifficultyScore).filter((value) => value !== null);
  return {
    min: scores.length ? Math.min(...scores) : null,
    max: scores.length ? Math.max(...scores) : null,
    average: roundOne(average(scores)),
    bands: countBy(words, getDifficultyBand),
  };
}

function summarizeSupport(words = []) {
  return {
    supports: countBy(words, (word) => word.assignmentSupport || "unknown"),
    questionTypes: countBy(words, (word) => word.questionType || "unknown"),
    reasons: countBy(words, (word) => word.supportLadderReason || "none"),
    byRole: Object.fromEntries(
      ["review", "target", "stretch"].map((role) => [
        role,
        {
          supports: countBy(words.filter((word) => word.assignmentRole === role), (word) => word.assignmentSupport || "unknown"),
          questionTypes: countBy(words.filter((word) => word.assignmentRole === role), (word) => word.questionType || "unknown"),
        },
      ])
    ),
  };
}

function summarizePlan(scenario, plan, attempts = []) {
  const usageByWord = buildUsageStats(attempts);
  const pupilPlan = plan?.pupilPlans?.[0] || null;
  const words = pupilPlan?.words || [];
  const developingTargets = new Set(
    (scenario.profile?.developingRows || [])
      .map((row) => normalizeToken(row?.target || ""))
      .filter(Boolean)
  );
  const wordSummaries = words.map((wordSpec, index) => {
    const word = normalizeWord(wordSpec.word);
    const usage = usageByWord.get(word) || null;
    const score = getDifficultyScore(wordSpec);
    return {
      position: index + 1,
      role: wordSpec.assignmentRole || "unknown",
      word,
      focusGrapheme: normalizeToken(wordSpec.focusGrapheme || ""),
      difficultyScore: score,
      difficultyBand: getDifficultyBand(wordSpec),
      source: getAuditSource(wordSpec),
      questionType: wordSpec.questionType || "",
      support: wordSpec.assignmentSupport || "",
      supportReason: wordSpec.supportLadderReason || "",
      targetReason: wordSpec.targetReason || "",
      repeatedFromPrior: !!usage?.count,
      usage: usage
        ? {
          count: usage.count,
          incorrectCount: usage.incorrectCount,
          recentlySeen: usage.recentlySeen,
          recentlySecure: usage.recentlySecure,
          reviewDue: usage.reviewDue,
        }
        : null,
    };
  });
  const byRole = Object.fromEntries(
    ["review", "target", "stretch"].map((role) => [
      role,
      words.filter((word) => word.assignmentRole === role),
    ])
  );
  const coverageWarnings = plan?.coverageWarnings || pupilPlan?.coverageWarnings || [];
  const fallbackCount = coverageWarnings.reduce((sum, warning) =>
    sum + Math.max(0, Number(warning?.fallbackCount || 0)), 0);
  const targetScores = byRole.target.map(getDifficultyScore).filter((value) => value !== null);
  const stretchScores = byRole.stretch.map(getDifficultyScore).filter((value) => value !== null);
  const stretchScoreLift = roundOne(average(stretchScores) - average(targetScores));

  return {
    id: scenario.id,
    label: scenario.label,
    primaryTargetGrapheme: pupilPlan?.primaryTargetGrapheme || "",
    planError: plan?.error || "",
    wordCount: words.length,
    roleMix: countBy(words, (word) => word.assignmentRole || "unknown"),
    focusGraphemes: countBy(words, (word) => word.focusGrapheme || "unknown"),
    sources: countBy(words, getAuditSource),
    difficulty: {
      all: summarizeDifficulty(words),
      review: summarizeDifficulty(byRole.review),
      target: summarizeDifficulty(byRole.target),
      stretch: summarizeDifficulty(byRole.stretch),
    },
    fallback: {
      used: fallbackCount > 0,
      fallbackCount,
      coverageWarnings: coverageWarnings.map((warning) => ({
        type: warning?.type || "",
        focusGrapheme: warning?.focusGrapheme || "",
        selectedTargetCount: warning?.selectedTargetCount ?? null,
        requestedTargetCount: warning?.requestedTargetCount ?? null,
        fallbackCount: warning?.fallbackCount ?? null,
      })),
    },
    supportLadder: summarizeSupport(words),
    stretch: {
      wordCount: byRole.stretch.length,
      averageStretchScore: roundOne(average(stretchScores)),
      averageTargetScore: roundOne(average(targetScores)),
      scoreLiftOverTarget: stretchScoreLift,
      alignedWithDevelopingTargetCount: byRole.stretch
        .filter((word) => developingTargets.has(normalizeToken(word.focusGrapheme || "")))
        .length,
      offTargetFocusWords: byRole.stretch
        .filter((word) => !developingTargets.has(normalizeToken(word.focusGrapheme || "")))
        .map((word) => ({
          word: normalizeWord(word.word),
          reportedFocusGrapheme: normalizeToken(word.focusGrapheme || ""),
        })),
      meaningfulForStrongProfile: scenario.id === "early_stretch"
        ? !!stretchScores.length && stretchScoreLift !== null && stretchScoreLift > 0 && Math.max(...stretchScores) >= 65
        : null,
    },
    repetitionSignals: {
      repeatedFromPriorCount: wordSummaries.filter((word) => word.repeatedFromPrior).length,
      recentlySecureReuseCount: wordSummaries.filter((word) => word.usage?.recentlySecure).length,
      incorrectReuseCount: wordSummaries.filter((word) => (word.usage?.incorrectCount || 0) > 0).length,
      reviewDueReuseCount: wordSummaries.filter((word) => word.usage?.reviewDue).length,
      safeWordCount: wordSummaries.filter((word) => Number(word.difficultyScore || 0) <= 35).length,
      safeWordReuseCount: wordSummaries.filter((word) => Number(word.difficultyScore || 0) <= 35 && word.repeatedFromPrior).length,
    },
    words: wordSummaries,
  };
}

function appendSyntheticCycleAttempts({ scenario, attempts, summary, cycle }) {
  const baseMs = new Date(AUDIT_NOW_ISO).getTime() + cycle * 24 * 60 * 60 * 1000;
  return [
    ...attempts,
    ...summary.words.map((word, index) => {
      const shouldStayIncorrect = scenario.id === "needs_support"
        && word.role === "target"
        && word.focusGrapheme === scenario.primaryFocus;
      return makeAttempt({
        pupilId: scenario.pupilId,
        word: word.word,
        correct: !shouldStayIncorrect,
        attemptNumber: shouldStayIncorrect ? 2 : 1,
        createdAt: new Date(baseMs + index * 1000).toISOString(),
      });
    }),
  ];
}

function summarizeRepeatedSelections(cycleSummaries, getter) {
  const counts = new Map();
  for (const cycle of cycleSummaries) {
    for (const word of cycle.words || []) {
      const value = getter(word);
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

function runRepeatGenerationAudit(scenario, cycleCount = 3) {
  let attempts = [...(scenario.initialAttempts || [])];
  const cycles = [];

  for (let cycle = 1; cycle <= cycleCount; cycle += 1) {
    const plan = buildPlanForScenario(scenario, attempts);
    const summary = summarizePlan(scenario, plan, attempts);
    cycles.push({
      cycle,
      wordCount: summary.wordCount,
      roleMix: summary.roleMix,
      fallbackCount: summary.fallback.fallbackCount,
      repeatedFromPriorCount: summary.repetitionSignals.repeatedFromPriorCount,
      recentlySecureReuseCount: summary.repetitionSignals.recentlySecureReuseCount,
      incorrectReuseCount: summary.repetitionSignals.incorrectReuseCount,
      safeWordReuseCount: summary.repetitionSignals.safeWordReuseCount,
      words: summary.words,
    });
    attempts = appendSyntheticCycleAttempts({ scenario, attempts, summary, cycle });
  }

  const repeatedWords = summarizeRepeatedSelections(cycles, (word) => word.word);
  const repeatedGraphemes = summarizeRepeatedSelections(cycles, (word) => word.focusGrapheme);
  const totalSafeWordReuseCount = cycles.reduce((sum, cycle) => sum + cycle.safeWordReuseCount, 0);

  return {
    profileId: scenario.id,
    cycleCount,
    repeatedWordSelections: repeatedWords,
    repeatedGraphemeSelections: repeatedGraphemes,
    totalRepeatedWordCount: repeatedWords.reduce((sum, item) => sum + item.count, 0),
    totalSafeWordReuseCount,
    cycles: cycles.map((cycle) => ({
      cycle: cycle.cycle,
      wordCount: cycle.wordCount,
      roleMix: cycle.roleMix,
      fallbackCount: cycle.fallbackCount,
      repeatedFromPriorCount: cycle.repeatedFromPriorCount,
      recentlySecureReuseCount: cycle.recentlySecureReuseCount,
      incorrectReuseCount: cycle.incorrectReuseCount,
      safeWordReuseCount: cycle.safeWordReuseCount,
      selectedWords: cycle.words.map((word) => word.word),
      selectedGraphemes: cycle.words.map((word) => word.focusGrapheme),
    })),
  };
}

function usageMeta(overrides = {}) {
  return {
    word: overrides.word || "",
    count: 1,
    correctCount: 0,
    incorrectCount: 0,
    lastSeenAt: 1000,
    lastCorrectAt: 0,
    lastIncorrectAt: 0,
    latestCorrect: null,
    latestAttemptNumber: 1,
    recentlySeen: false,
    recentlySecure: false,
    reviewDue: false,
    ...overrides,
  };
}

function selectedWords(result) {
  return (result.words || []).map((word) => word.word);
}

function runUsageProbeReport() {
  const phone = auditWordRow({
    id: "probe-core-phone",
    word: "phone",
    focus: "ph",
    segments: ["ph", "o", "n", "e"],
    score: 30,
    source: "wordloom_core",
  });
  const phase = auditWordRow({
    id: "probe-core-phase",
    word: "phase",
    focus: "ph",
    segments: ["ph", "a", "s", "e"],
    score: 30,
    source: "wordloom_core",
  });
  const teacherPhase = auditWordRow({
    id: "probe-teacher-phase",
    word: "phase",
    focus: "ph",
    segments: ["ph", "a", "s", "e"],
    score: 30,
    source: "teacher",
  });

  const recentSecureAvoided = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [phone, phase],
    usageByWord: new Map([
      ["phone", usageMeta({
        word: "phone",
        count: 1,
        correctCount: 1,
        latestCorrect: true,
        recentlySeen: true,
        recentlySecure: true,
      })],
    ]),
  });
  const incorrectPreferred = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [phone, phase],
    usageByWord: new Map([
      ["phone", usageMeta({
        word: "phone",
        count: 1,
        incorrectCount: 1,
        latestCorrect: false,
        recentlySeen: true,
      })],
    ]),
  });
  const recentSecureFallbackEligible = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [phone],
    usageByWord: new Map([
      ["phone", usageMeta({
        word: "phone",
        count: 1,
        correctCount: 1,
        latestCorrect: true,
        recentlySeen: true,
        recentlySecure: true,
      })],
    ]),
  });
  const sourcePriorityBeforeUsage = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [phone, teacherPhase],
    usageByWord: new Map([
      ["phone", usageMeta({
        word: "phone",
        count: 1,
        correctCount: 1,
        latestCorrect: true,
        recentlySeen: true,
        recentlySecure: true,
      })],
      ["phase", usageMeta({
        word: "phase",
        count: 1,
        incorrectCount: 1,
        latestCorrect: false,
        recentlySeen: true,
      })],
    ]),
  });

  return {
    recentSecureAvoided: {
      selectedWords: selectedWords(recentSecureAvoided),
      status: recentSecureAvoided.status,
      interpretation: "Recently secure words lose priority when equivalent alternatives exist.",
    },
    incorrectPreferred: {
      selectedWords: selectedWords(incorrectPreferred),
      status: incorrectPreferred.status,
      interpretation: "Previously incorrect words gain priority inside the same source and difficulty window.",
    },
    recentSecureFallbackEligible: {
      selectedWords: selectedWords(recentSecureFallbackEligible),
      status: recentSecureFallbackEligible.status,
      interpretation: "Recently secure words remain eligible when no equivalent alternative exists.",
    },
    sourcePriorityBeforeUsage: {
      selectedWords: selectedWords(sourcePriorityBeforeUsage),
      status: sourcePriorityBeforeUsage.status,
      interpretation: "Core-bank source priority is applied before usage history when ranking target candidates.",
    },
  };
}

function collectObservedConcerns(profileReports, repeatReports, usageProbes) {
  const concerns = [];
  const fallbackProfiles = profileReports.filter((profile) => profile.fallback.used);
  if (fallbackProfiles.length) {
    concerns.push({
      id: "availability_driven_fallback",
      profileIds: fallbackProfiles.map((profile) => profile.id),
      detail: "At least one profile cannot fill all target slots for the primary focus and uses fallback review/consolidation words.",
    });
  }

  const repeatProfiles = repeatReports.filter((profile) => profile.repeatedWordSelections.length);
  if (repeatProfiles.length) {
    concerns.push({
      id: "word_repetition_after_repeat_generation",
      profileIds: repeatProfiles.map((profile) => profile.profileId),
      detail: "Repeat generation can reuse words once available alternatives are thin or current usage rules still allow them.",
    });
  }

  const safeRepeatProfiles = repeatReports.filter((profile) => profile.totalSafeWordReuseCount > 0);
  if (safeRepeatProfiles.length) {
    concerns.push({
      id: "safe_word_reuse",
      profileIds: safeRepeatProfiles.map((profile) => profile.profileId),
      detail: "Low-difficulty words can reappear across cycles, especially where primary target coverage is limited.",
    });
  }

  const earlyStretch = profileReports.find((profile) => profile.id === "early_stretch");
  if (earlyStretch && !earlyStretch.stretch.meaningfulForStrongProfile) {
    concerns.push({
      id: "stretch_quality_needs_human_review",
      profileIds: ["early_stretch"],
      detail: "The early stretch fixture did not show a clear stretch score lift over target words.",
    });
  }

  const stretchFocusDriftProfiles = profileReports.filter((profile) => profile.stretch.offTargetFocusWords.length);
  if (stretchFocusDriftProfiles.length) {
    concerns.push({
      id: "stretch_reported_focus_can_drift",
      profileIds: stretchFocusDriftProfiles.map((profile) => profile.id),
      detail: "Some stretch words were selected from developing evidence targets but report a different focus grapheme in the generated word spec.",
    });
  }

  if (usageProbes.sourcePriorityBeforeUsage.selectedWords[0] === "phone") {
    concerns.push({
      id: "source_priority_before_usage",
      profileIds: ["usage_probe"],
      detail: "A Wordloom core candidate can outrank a teacher/legacy candidate even when the core word was recently secure and the teacher word was incorrect.",
    });
  }

  return concerns;
}

function buildSelectorIntelligenceAuditReport() {
  const scenarios = makeScenarioDefinitions();
  const profiles = scenarios.map((scenario) => {
    const plan = buildPlanForScenario(scenario, scenario.initialAttempts || []);
    return summarizePlan(scenario, plan, scenario.initialAttempts || []);
  });
  const repeatGeneration = scenarios.map((scenario) => runRepeatGenerationAudit(scenario, 3));
  const usageProbes = runUsageProbeReport();

  return {
    auditVersion: AUDIT_VERSION,
    generatedAt: AUDIT_NOW_ISO,
    assignmentLength: ASSIGNMENT_LENGTH,
    expectedComposition: buildAutoAssignmentComposition(ASSIGNMENT_LENGTH),
    profiles,
    repeatGeneration,
    usageProbes,
    observedConcerns: collectObservedConcerns(profiles, repeatGeneration, usageProbes),
  };
}

function printSelectorIntelligenceAudit(report) {
  console.log("SELECTOR_INTELLIGENCE_AUDIT_SUMMARY");
  console.log("profile | primary | mix | sources | targetAvg | stretchAvg | fallback | repeatWords");
  const repeatByProfile = new Map(report.repeatGeneration.map((item) => [item.profileId, item]));
  for (const profile of report.profiles) {
    const repeat = repeatByProfile.get(profile.id);
    console.log([
      profile.id,
      profile.primaryTargetGrapheme,
      `r${profile.roleMix.review || 0}/t${profile.roleMix.target || 0}/s${profile.roleMix.stretch || 0}`,
      Object.entries(profile.sources).map(([key, value]) => `${key}:${value}`).join(","),
      profile.difficulty.target.average,
      profile.difficulty.stretch.average,
      profile.fallback.fallbackCount,
      repeat?.repeatedWordSelections.length || 0,
    ].join(" | "));
  }
  console.log(`SELECTOR_INTELLIGENCE_AUDIT_JSON ${JSON.stringify(report)}`);
}

const AUDIT_REPORT = buildSelectorIntelligenceAuditReport();
printSelectorIntelligenceAudit(AUDIT_REPORT);

test("selector intelligence audit reports the four placement profiles", () => {
  assert.equal(AUDIT_REPORT.auditVersion, AUDIT_VERSION);
  assert.deepEqual(
    AUDIT_REPORT.profiles.map((profile) => profile.id).sort(),
    ["core_developing", "early_stretch", "needs_support", "secure_expected"],
  );

  for (const profile of AUDIT_REPORT.profiles) {
    assert.equal(profile.wordCount, ASSIGNMENT_LENGTH);
    assert.equal(profile.planError, "");
    assert.ok(profile.primaryTargetGrapheme);
    assert.ok(profile.roleMix.review >= 1);
    assert.ok(profile.roleMix.target >= 1);
    assert.ok(profile.roleMix.stretch >= 1);
    assert.ok(profile.words.every((word) => word.word && word.focusGrapheme && word.source && word.difficultyScore !== null));
    assert.ok(Object.keys(profile.supportLadder.questionTypes).length > 0);
  }
});

test("audit output includes source, fallback, support ladder, and stretch quality signals", () => {
  const allSourceCounts = {};
  for (const profile of AUDIT_REPORT.profiles) {
    for (const [source, count] of Object.entries(profile.sources)) {
      allSourceCounts[source] = (allSourceCounts[source] || 0) + count;
    }
  }

  assert.ok((allSourceCounts.wordloom_core || 0) > 0);
  assert.ok((allSourceCounts.teacher_legacy || 0) > 0);
  assert.equal(AUDIT_REPORT.profiles.find((profile) => profile.id === "needs_support").fallback.used, true);
  assert.ok(
    (AUDIT_REPORT.profiles.find((profile) => profile.id === "needs_support").supportLadder.questionTypes.focus_sound || 0) >= 1
  );
  assert.equal(
    AUDIT_REPORT.profiles.find((profile) => profile.id === "early_stretch").stretch.meaningfulForStrongProfile,
    true,
  );
});

test("repeat generation audit exposes repeated words and graphemes", () => {
  assert.equal(AUDIT_REPORT.repeatGeneration.length, 4);
  for (const repeatReport of AUDIT_REPORT.repeatGeneration) {
    assert.equal(repeatReport.cycleCount, 3);
    assert.equal(repeatReport.cycles.length, 3);
    assert.ok(repeatReport.repeatedGraphemeSelections.length > 0);
  }
  assert.ok(
    AUDIT_REPORT.repeatGeneration.some((report) => report.repeatedWordSelections.length > 0),
    "At least one profile should expose repeated word selection across repeat generations."
  );
  assert.ok(
    AUDIT_REPORT.repeatGeneration.some((report) => report.totalSafeWordReuseCount > 0),
    "At least one profile should expose safe-word reuse across repeat generations."
  );
});

test("usage probes document recent secure, incorrect, fallback, and source-priority handling", () => {
  assertJsonEqual(AUDIT_REPORT.usageProbes.recentSecureAvoided.selectedWords, ["phase"]);
  assertJsonEqual(AUDIT_REPORT.usageProbes.incorrectPreferred.selectedWords, ["phone"]);
  assertJsonEqual(AUDIT_REPORT.usageProbes.recentSecureFallbackEligible.selectedWords, ["phone"]);
  assertJsonEqual(AUDIT_REPORT.usageProbes.sourcePriorityBeforeUsage.selectedWords, ["phone"]);
  assert.ok(AUDIT_REPORT.observedConcerns.some((concern) => concern.id === "source_priority_before_usage"));
});

let failureCount = 0;

for (const entry of TESTS) {
  try {
    await entry.fn();
    console.log(`ok - ${entry.name}`);
  } catch (error) {
    failureCount += 1;
    console.error(`not ok - ${entry.name}`);
    console.error(error);
  }
}

if (failureCount) {
  throw new Error(`${failureCount} selector intelligence audit check${failureCount === 1 ? "" : "s"} failed.`);
}

console.log("Passed selector intelligence audit checks.");
