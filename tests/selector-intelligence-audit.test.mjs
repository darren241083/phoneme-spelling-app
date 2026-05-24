import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildAutoAssignmentComposition,
  buildAssignmentEngineWordPayload,
  buildGeneratedAssignmentPlan,
  selectApprovedTargetWords,
} = await loadBrowserModule("../js/assignmentEngine.js", import.meta.url);
const {
  getPhonemeAlternativeOptions,
  inferPhonemeFromGrapheme,
} = await loadBrowserModule("../js/data/phonemeHelpers.js", import.meta.url);

const TESTS = [];
const AUDIT_VERSION = "selector_intelligence_audit_v4";
const CONTEXTUAL_DIFFICULTY_AUDIT_VERSION = "contextual_difficulty_v3a_audit_only";
const AUDIT_NOW_ISO = "2026-05-14T12:00:00.000Z";
const SELECTOR_AUDIT_BASELINE_URL = new URL("../selector-audit-output.txt", import.meta.url);
const ASSIGNMENT_LENGTH = 10;
const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const REVIEW_BASIS_PROTECTED_REVIEW = "protected_review";
const REVIEW_BASIS_NEARLY_SECURE_CONSOLIDATION = "nearly_secure_consolidation";
const REVIEW_BASIS_SECURE_REVIEW = "secure_review";
const REVIEW_BASIS_RELATED_FAMILY_REVIEW = "related_family_review";
const REVIEW_BASIS_LAST_RESORT_SAFE_REVIEW = "last_resort_safe_review";
const CONTEXTUAL_PLACEMENT_WINDOWS = {
  needs_support: { min: 15, center: 30, max: 45, hardMax: 50 },
  core_developing: { min: 25, center: 40, max: 55, hardMax: 60 },
  secure_expected: { min: 35, center: 48, max: 60, hardMax: 65 },
  early_stretch: { min: 55, center: 65, max: 75, hardMax: 80 },
};
const CONTEXTUAL_PLACEMENT_FITS = ["below_band", "comfortable", "high_for_band", "above_hard_cap"];
const CONTEXTUAL_RISK_FLAGS = [
  "high_for_band",
  "above_hard_cap",
  "independent_high_effective",
  "support_masking_high_static",
  "missing_context_high_effective",
];
const CONTEXTUAL_EVIDENCE_CATEGORIES = [
  "primary_concern",
  "concern",
  "developing",
  "secure",
  "related_family",
  "unknown",
];

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

function countByWithKeys(items = [], keys = [], getter) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const item of items) {
    incrementCount(counts, getter(item));
  }
  return counts;
}

function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

function normalizeMetadataKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeBoolean(value) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
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
      ["three", 44, ["th", "r", "ee"]],
      ["thin", 46, ["th", "i", "n"]],
      ["path", 48, ["p", "a", "th"]],
      ["think", 50, ["th", "i", "n", "k"]],
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

function isRelatedFocus(source = "", target = "") {
  const cleanSource = normalizeToken(source);
  const cleanTarget = normalizeToken(target);
  if (!cleanSource || !cleanTarget || cleanSource === cleanTarget) return false;
  const sourcePhoneme = inferPhonemeFromGrapheme(cleanSource, "all");
  const targetPhoneme = inferPhonemeFromGrapheme(cleanTarget, "all");
  if (sourcePhoneme && targetPhoneme && sourcePhoneme === targetPhoneme) return true;
  return getPhonemeAlternativeOptions(cleanSource, sourcePhoneme, ["core", "all"]).includes(cleanTarget)
    || getPhonemeAlternativeOptions(cleanTarget, targetPhoneme, ["core", "all"]).includes(cleanSource);
}

function scenarioTargetSet(scenario, key, { includeNearlyConcerns = false } = {}) {
  const rows = [
    ...(scenario.profile?.[key] || []),
    ...(includeNearlyConcerns
      ? (scenario.profile?.concernRows || [])
        .filter((row) => normalizeToken(row?.target || "") !== normalizeToken(scenario.primaryFocus || ""))
        .filter((row) => normalizeToken(row?.securityBand || row?.security_band || "") === "nearly_secure")
      : []),
  ];
  return new Set(
    rows
      .map((row) => normalizeToken(row?.target || ""))
      .filter(Boolean)
      .filter((target) => target !== normalizeToken(scenario.primaryFocus || ""))
  );
}

function classifyReviewBasis({ scenario, word } = {}) {
  const focus = normalizeToken(word?.focusGrapheme || "");
  const usage = word?.usage || {};
  if ((usage.incorrectCount || 0) > 0 || usage.reviewDue) return REVIEW_BASIS_PROTECTED_REVIEW;
  if (scenarioTargetSet(scenario, "developingRows", { includeNearlyConcerns: true }).has(focus)) {
    return REVIEW_BASIS_NEARLY_SECURE_CONSOLIDATION;
  }
  if (scenarioTargetSet(scenario, "secureRows").has(focus)) return REVIEW_BASIS_SECURE_REVIEW;
  if (isRelatedFocus(scenario.primaryFocus, focus)) return REVIEW_BASIS_RELATED_FAMILY_REVIEW;
  return REVIEW_BASIS_LAST_RESORT_SAFE_REVIEW;
}

function getStretchCapForProfile(profileId = "") {
  if (profileId === "needs_support") return { maxScore: 50, disallowBands: new Set(["stretch", "challenge"]) };
  if (profileId === "core_developing") return { maxScore: 55, disallowBands: new Set(["stretch", "challenge"]) };
  if (profileId === "secure_expected") return { maxScore: 65, disallowBands: new Set(["challenge"]) };
  if (profileId === "early_stretch") return { maxScore: 80, disallowBands: new Set() };
  return { maxScore: 80, disallowBands: new Set() };
}

function classifyStretchBasis({ scenario, word, targetAverageScore }) {
  const primary = normalizeToken(scenario.primaryFocus);
  const focus = normalizeToken(word?.focusGrapheme || "");
  const score = Number(word?.difficultyScore || 0);
  const diagnosticTargets = new Set([
    ...(scenario.profile?.concernRows || []),
    ...(scenario.profile?.developingRows || []),
  ].map((row) => normalizeToken(row?.target)).filter((target) => target && target !== primary));
  const secureTargets = new Set(
    (scenario.profile?.secureRows || [])
      .map((row) => normalizeToken(row?.target))
      .filter(Boolean)
  );

  if (focus === primary && Number.isFinite(Number(targetAverageScore)) && score > Number(targetAverageScore)) {
    return "current_target";
  }
  if (diagnosticTargets.has(focus)) return "diagnostic_miss";
  if (isRelatedFocus(primary, focus)) return "related_family";
  if (secureTargets.has(focus) || score <= 55) return "soft_consolidation";
  return "unlinked_fallback";
}

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

  for (const current of usage.values()) {
    current.recentlySeen = current.lastSeenAt > 0 && current.lastSeenAt >= recentCutoff;
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

function resolveContextualPlacementBand(scenario = {}) {
  const meta = scenario.profile?.placementMeta || {};
  const key = normalizeMetadataKey(
    meta.targetChallengeLevel
      || meta.baselinePlacement
      || meta.headlinePlacement
      || scenario.id
  );
  return CONTEXTUAL_PLACEMENT_WINDOWS[key] ? key : "secure_expected";
}

function findProfileEvidenceRow(scenario = {}, key = "", focus = "") {
  const cleanFocus = normalizeToken(focus);
  return (scenario.profile?.[key] || [])
    .find((row) => normalizeToken(row?.target || "") === cleanFocus) || null;
}

function hasRepeatedFailure(row = null) {
  return !!(row?.repeatedFailure || row?.repeated_failure);
}

function buildContextualEvidenceSignal(scenario = {}, word = {}) {
  const focus = normalizeToken(word?.focusGrapheme || "");
  const primary = normalizeToken(scenario.primaryFocus || "");
  const drivers = [];
  const concernRow = findProfileEvidenceRow(scenario, "concernRows", focus);
  const developingRow = findProfileEvidenceRow(scenario, "developingRows", focus);
  const secureRow = findProfileEvidenceRow(scenario, "secureRows", focus);

  if (concernRow && (focus === primary || hasRepeatedFailure(concernRow))) {
    drivers.push(hasRepeatedFailure(concernRow) ? "repeated_failure_evidence" : "primary_concern_evidence");
    return { category: "primary_concern", adjustment: 10, drivers };
  }
  if (concernRow) {
    drivers.push("concern_evidence");
    return { category: "concern", adjustment: 8, drivers };
  }
  if (developingRow) {
    drivers.push("developing_evidence");
    return { category: "developing", adjustment: 4, drivers };
  }
  if (secureRow) {
    drivers.push("secure_evidence");
    return { category: "secure", adjustment: -6, drivers };
  }
  if (isRelatedFocus(primary, focus)) {
    drivers.push("related_family_evidence");
    return { category: "related_family", adjustment: 2, drivers };
  }
  return { category: "unknown", adjustment: 0, drivers };
}

function buildContextualHistorySignal(usage = null) {
  const history = {
    count: Math.max(0, Number(usage?.count || 0)),
    incorrectCount: Math.max(0, Number(usage?.incorrectCount || 0)),
    recentlySeen: !!usage?.recentlySeen,
    recentlySecure: !!usage?.recentlySecure,
    reviewDue: !!usage?.reviewDue,
  };
  const drivers = [];
  let adjustment = 0;

  if (history.reviewDue) {
    adjustment += 8;
    drivers.push("review_due");
  }
  if (history.incorrectCount > 0) {
    adjustment += Math.min(8, history.incorrectCount * 4);
    drivers.push("recent_incorrect");
  }
  if (history.recentlySecure) {
    adjustment -= 6;
    drivers.push("recently_secure");
  }

  return { history, adjustment, drivers };
}

function buildContextualSupportSignal(word = {}) {
  const assignmentSupport = normalizeMetadataKey(word.support || word.assignmentSupport || "");
  const questionType = normalizeMetadataKey(word.questionType || "");
  const focusRelief = assignmentSupport === "focus" || questionType === "focus_sound";
  const supportedRelief = assignmentSupport === "supported" || questionType === "segmented_spelling";
  const supportRelief = focusRelief ? 10 : supportedRelief ? 6 : 0;
  const supportAdjustment = -supportRelief;
  const drivers = [];

  if (focusRelief) drivers.push("focus_support_relief");
  else if (supportedRelief) drivers.push("supported_relief");

  return {
    assignmentSupport: word.support || word.assignmentSupport || "",
    questionType: word.questionType || "",
    supportAdjustment,
    supportRelief,
    drivers,
  };
}

function getDifficultyFeatures(wordSpec = {}) {
  const features = wordSpec?.difficulty?.features || wordSpec?.choice?.difficulty?.features;
  return features && typeof features === "object" && !Array.isArray(features) ? features : null;
}

function countLetters(value = "") {
  return normalizeWord(value).replace(/[^a-z]/g, "").length;
}

function normalizeSegmentsForAudit(wordSpec = {}, word = "") {
  const segments = Array.isArray(wordSpec?.segments) && wordSpec.segments.length
    ? wordSpec.segments
    : WORD_META_BY_WORD.get(normalizeWord(word))?.segments || [];
  return segments.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
}

function buildFallbackStructureAdjustment({ word = "", segments = [] } = {}) {
  const letterCount = countLetters(word);
  const graphemeCount = segments.length;
  const cleanSegments = segments.map((segment) => segment.replace(/[^a-z]/g, ""));
  const multiLetterGraphemeCount = cleanSegments.filter((segment) => segment.length > 1).length;
  const longGraphemeCount = cleanSegments.filter((segment) => segment.length > 2).length;
  const adjustment = Math.min(6,
    (letterCount >= 6 ? 1 : 0)
      + (letterCount >= 8 ? 1 : 0)
      + (graphemeCount >= 5 ? 1 : 0)
      + (graphemeCount >= 6 ? 1 : 0)
      + Math.min(2, multiLetterGraphemeCount)
      + Math.min(1, longGraphemeCount)
  );

  return {
    source: "fallback_segments",
    letterCount,
    graphemeCount,
    multiLetterGraphemeCount,
    longGraphemeCount,
    adjustment,
  };
}

function buildContextualStructureSignal(wordSpec = {}, word = "") {
  const features = getDifficultyFeatures(wordSpec);
  const segments = normalizeSegmentsForAudit(wordSpec, word);
  if (features) {
    const letterCount = Number(features.letterCount ?? countLetters(word));
    const graphemeCount = Number(features.graphemeCount ?? segments.length);
    const multiLetterGraphemeCount = Number(
      features.multiletterCount
        ?? features.multiLetterGraphemeCount
        ?? segments.filter((segment) => segment.replace(/[^a-z]/g, "").length > 1).length
    );
    const longGraphemeCount = Number(
      features.longGraphemeCount
        ?? segments.filter((segment) => segment.replace(/[^a-z]/g, "").length > 2).length
    );
    return {
      source: "stored_features",
      letterCount: Number.isFinite(letterCount) ? letterCount : countLetters(word),
      graphemeCount: Number.isFinite(graphemeCount) ? graphemeCount : segments.length,
      multiLetterGraphemeCount: Number.isFinite(multiLetterGraphemeCount) ? multiLetterGraphemeCount : 0,
      longGraphemeCount: Number.isFinite(longGraphemeCount) ? longGraphemeCount : 0,
      adjustment: 0,
    };
  }

  return buildFallbackStructureAdjustment({ word, segments });
}

function getContextStatus(context = {}, key = "") {
  const status = context?.[`${key}_status`]
    ?? context?.[`${key}Status`]
    ?? context?.[key]?.status
    ?? "";
  return String(status || "").trim();
}

function buildContextualContextSignal(wordSpec = {}) {
  const context = wordSpec?.contextSupport && typeof wordSpec.contextSupport === "object"
    ? wordSpec.contextSupport
    : {};
  const hasSentence = !!String(wordSpec?.sentence || context?.sentence || "").trim();
  const hasMeaning = !!String(wordSpec?.meaning || context?.meaning || context?.definition || "").trim();
  const sentenceRequired = normalizeBoolean(
    context?.sentence_required
      ?? context?.sentenceRequired
      ?? wordSpec?.sentenceRequired
      ?? wordSpec?.sentence_required
  );
  const sentenceStatus = getContextStatus(context, "sentence");
  const meaningStatus = getContextStatus(context, "meaning");
  let availability = "sentence_and_meaning";
  let adjustment = 0;
  const drivers = [];

  if (sentenceRequired && !hasSentence) {
    availability = hasMeaning ? "required_sentence_missing" : "required_sentence_and_meaning_missing";
    adjustment = 8;
    drivers.push("required_sentence_missing");
  } else if (!hasSentence && !hasMeaning) {
    availability = "missing_both";
    adjustment = 5;
    drivers.push("missing_context");
  } else if (!hasSentence) {
    availability = "missing_sentence";
    adjustment = 3;
    drivers.push("missing_sentence");
  } else if (!hasMeaning) {
    availability = "missing_meaning";
    adjustment = 2;
    drivers.push("missing_meaning");
  }

  return {
    hasSentence,
    hasMeaning,
    sentenceStatus,
    meaningStatus,
    sentenceRequired,
    availability,
    adjustment,
    drivers,
  };
}

function resolvePlacementFit(score, window) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "comfortable";
  if (value < Number(window.min)) return "below_band";
  if (value > Number(window.hardMax)) return "above_hard_cap";
  if (value > Number(window.max)) return "high_for_band";
  return "comfortable";
}

function buildContextualRiskFlags({
  contextual,
  window,
  contextSignal,
  supportSignal,
  unsupportedScore,
} = {}) {
  const flags = [];
  const supportName = normalizeMetadataKey(supportSignal?.assignmentSupport || "");
  const questionType = normalizeMetadataKey(supportSignal?.questionType || "");
  const independent = (!supportName || supportName === "independent")
    && (!questionType || questionType === "no_support_assessment");

  if (contextual.placementFit === "high_for_band") flags.push("high_for_band");
  if (contextual.placementFit === "above_hard_cap") flags.push("above_hard_cap");
  if (independent && Number(contextual.effectiveScore || 0) > Number(window.max)) {
    flags.push("independent_high_effective");
  }
  if (
    Number(supportSignal?.supportRelief || 0) > 0
    && Number(unsupportedScore || 0) > Number(window.max)
    && Number(contextual.effectiveScore || 0) <= Number(window.max)
  ) {
    flags.push("support_masking_high_static");
  }
  if (Number(contextSignal?.adjustment || 0) > 0 && Number(contextual.effectiveScore || 0) > Number(window.max)) {
    flags.push("missing_context_high_effective");
  }
  return flags;
}

function buildContextualDifficultyAudit({ scenario, wordSummary, wordSpec } = {}) {
  const staticScore = getDifficultyScore(wordSpec);
  const staticBand = getDifficultyBand(wordSpec);
  const placementBand = resolveContextualPlacementBand(scenario);
  const placementWindow = CONTEXTUAL_PLACEMENT_WINDOWS[placementBand];
  const evidenceSignal = buildContextualEvidenceSignal(scenario, wordSummary);
  const historySignal = buildContextualHistorySignal(wordSummary.usage);
  const supportSignal = buildContextualSupportSignal(wordSummary);
  const structureSignal = buildContextualStructureSignal(wordSpec, wordSummary.word);
  const contextSignal = buildContextualContextSignal(wordSpec);
  const unsupportedScore = clampScore(
    Number(staticScore || 0)
      + evidenceSignal.adjustment
      + historySignal.adjustment
      + structureSignal.adjustment
      + contextSignal.adjustment
  );
  const effectiveScore = clampScore(Number(unsupportedScore || 0) + supportSignal.supportAdjustment);
  const scoreVsPlacementCenter = effectiveScore === null ? null : effectiveScore - placementWindow.center;
  const baseContextual = {
    modelVersion: CONTEXTUAL_DIFFICULTY_AUDIT_VERSION,
    staticScore,
    staticBand,
    unsupportedScore,
    effectiveScore,
    effectiveBand: bandForScore(effectiveScore),
    scoreDelta: effectiveScore === null || staticScore === null ? null : effectiveScore - staticScore,
    placementBand,
    placementCenter: placementWindow.center,
    scoreVsPlacementCenter,
    placementFit: resolvePlacementFit(effectiveScore, placementWindow),
    abovePlacementHardMax: effectiveScore !== null && effectiveScore > placementWindow.hardMax,
    evidenceCategory: evidenceSignal.category,
    history: historySignal.history,
    support: {
      assignmentSupport: supportSignal.assignmentSupport,
      questionType: supportSignal.questionType,
      supportAdjustment: supportSignal.supportAdjustment,
      supportRelief: supportSignal.supportRelief,
    },
    structure: structureSignal,
    context: {
      hasSentence: contextSignal.hasSentence,
      hasMeaning: contextSignal.hasMeaning,
      sentenceStatus: contextSignal.sentenceStatus,
      meaningStatus: contextSignal.meaningStatus,
      sentenceRequired: contextSignal.sentenceRequired,
      availability: contextSignal.availability,
      adjustment: contextSignal.adjustment,
    },
    drivers: [
      ...evidenceSignal.drivers,
      ...historySignal.drivers,
      ...supportSignal.drivers,
      ...(structureSignal.adjustment > 0 ? ["fallback_structure_complexity"] : []),
      ...contextSignal.drivers,
    ],
    flags: [],
  };

  return {
    ...baseContextual,
    flags: buildContextualRiskFlags({
      contextual: baseContextual,
      window: placementWindow,
      contextSignal,
      supportSignal,
      unsupportedScore,
    }),
  };
}

function summarizeContextualGroup(words = []) {
  const effectiveScores = words
    .map((word) => Number(word.contextualDifficulty?.effectiveScore))
    .filter(Number.isFinite);
  const staticScores = words
    .map((word) => Number(word.contextualDifficulty?.staticScore))
    .filter(Number.isFinite);
  const scoreDeltas = words
    .map((word) => Number(word.contextualDifficulty?.scoreDelta))
    .filter(Number.isFinite);

  return {
    minEffectiveScore: effectiveScores.length ? Math.min(...effectiveScores) : null,
    maxEffectiveScore: effectiveScores.length ? Math.max(...effectiveScores) : null,
    averageEffectiveScore: roundOne(average(effectiveScores)),
    effectiveBands: countBy(words, (word) => word.contextualDifficulty?.effectiveBand || "unknown"),
    averageStaticScore: roundOne(average(staticScores)),
    averageDelta: roundOne(average(scoreDeltas)),
  };
}

function summarizeContextCoverage(words = []) {
  const totalWords = words.length;
  const sentenceCount = words.filter((word) => word.contextualDifficulty?.context?.hasSentence).length;
  const meaningCount = words.filter((word) => word.contextualDifficulty?.context?.hasMeaning).length;
  const bothCount = words.filter((word) =>
    word.contextualDifficulty?.context?.hasSentence && word.contextualDifficulty?.context?.hasMeaning
  ).length;

  return {
    totalWords,
    sentenceCount,
    meaningCount,
    bothCount,
    sentenceCoverageRate: roundOne(sentenceCount / Math.max(1, totalWords)),
    meaningCoverageRate: roundOne(meaningCount / Math.max(1, totalWords)),
    bothCoverageRate: roundOne(bothCount / Math.max(1, totalWords)),
    missingSentenceCount: totalWords - sentenceCount,
    missingMeaningCount: totalWords - meaningCount,
  };
}

function summarizeSupportRelief(words = []) {
  const byRole = Object.fromEntries(
    ["review", "target", "stretch"].map((role) => {
      const roleWords = words.filter((word) => word.role === role);
      const reliefValues = roleWords.map((word) => Number(word.contextualDifficulty?.support?.supportRelief || 0));
      const totalRelief = reliefValues.reduce((sum, value) => sum + value, 0);
      return [role, {
        count: roleWords.length,
        totalRelief,
        averageRelief: roundOne(average(reliefValues)),
      }];
    })
  );
  const allRelief = words.map((word) => Number(word.contextualDifficulty?.support?.supportRelief || 0));

  return {
    averageRelief: roundOne(average(allRelief)),
    totalReliefByRole: Object.fromEntries(
      Object.entries(byRole).map(([role, summary]) => [role, summary.totalRelief])
    ),
    byRole,
  };
}

function summarizeRiskFlags(words = []) {
  return countByWithKeys(
    words.flatMap((word) => word.contextualDifficulty?.flags || []),
    CONTEXTUAL_RISK_FLAGS,
    (flag) => flag,
  );
}

function summarizeContextualDifficulty(words = []) {
  return {
    modelVersion: CONTEXTUAL_DIFFICULTY_AUDIT_VERSION,
    all: summarizeContextualGroup(words),
    review: summarizeContextualGroup(words.filter((word) => word.role === "review")),
    target: summarizeContextualGroup(words.filter((word) => word.role === "target")),
    stretch: summarizeContextualGroup(words.filter((word) => word.role === "stretch")),
    placementPressure: countByWithKeys(
      words,
      CONTEXTUAL_PLACEMENT_FITS,
      (word) => word.contextualDifficulty?.placementFit || "comfortable",
    ),
    contextCoverage: summarizeContextCoverage(words),
    supportRelief: summarizeSupportRelief(words),
    evidenceMix: countByWithKeys(
      words,
      CONTEXTUAL_EVIDENCE_CATEGORIES,
      (word) => word.contextualDifficulty?.evidenceCategory || "unknown",
    ),
    riskFlags: summarizeRiskFlags(words),
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
    const bankMeta = WORD_META_BY_WORD.get(word) || {};
    const summary = {
      position: index + 1,
      role: wordSpec.assignmentRole || "unknown",
      word,
      focusGrapheme: normalizeToken(wordSpec.focusGrapheme || ""),
      bankFocusGrapheme: normalizeToken(bankMeta.focus || ""),
      difficultyScore: score,
      difficultyBand: getDifficultyBand(wordSpec),
      source: getAuditSource(wordSpec),
      hasSentence: !!String(wordSpec.sentence || "").trim(),
      hasMeaning: !!String(wordSpec.meaning || wordSpec.contextSupport?.meaning || "").trim(),
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
    return {
      ...summary,
      contextualDifficulty: buildContextualDifficultyAudit({
        scenario,
        wordSummary: summary,
        wordSpec,
      }),
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
  const targetAverageScore = average(targetScores);
  const stretchWordSummaries = wordSummaries.filter((word) => word.role === "stretch");
  const stretchClassifications = stretchWordSummaries.map((word) => ({
    ...word,
    stretchBasis: classifyStretchBasis({
      scenario,
      word,
      targetAverageScore,
    }),
  }));
  const stretchCap = getStretchCapForProfile(scenario.id);
  const focusDriftCount = stretchClassifications
    .filter((word) => word.bankFocusGrapheme && word.focusGrapheme !== word.bankFocusGrapheme)
    .length;
  const capBreachCount = stretchClassifications
    .filter((word) => Number(word.difficultyScore || 0) > stretchCap.maxScore
      || stretchCap.disallowBands.has(word.difficultyBand))
    .length;
  const unlinkedHardCount = stretchClassifications
    .filter((word) => word.stretchBasis === "unlinked_fallback"
      && (Number(word.difficultyScore || 0) > 55 || word.difficultyBand === "stretch" || word.difficultyBand === "challenge"))
    .length;
  const evidenceLinkedCount = stretchClassifications
    .filter((word) => word.stretchBasis !== "unlinked_fallback")
    .length;
  const meaningfulForStrongProfile = ["secure_expected", "early_stretch"].includes(scenario.id)
    ? !!stretchScores.length
      && stretchScoreLift !== null
      && stretchScoreLift > 0
      && evidenceLinkedCount === stretchClassifications.length
      && focusDriftCount === 0
      && capBreachCount === 0
    : null;
  const expectedComposition = buildAutoAssignmentComposition(ASSIGNMENT_LENGTH);
  const reviewWordSummaries = wordSummaries.filter((word) => word.role === "review");
  const reviewClassifications = reviewWordSummaries.map((word) => ({
    ...word,
    reviewBasis: classifyReviewBasis({ scenario, word }),
  }));
  const fallbackReviewClassifications = reviewClassifications
    .filter((word) => word.position > expectedComposition.review);
  const secondaryWeakTargets = scenarioTargetSet(scenario, "concernRows");
  const shortfallFilledBySecondaryWeakTarget = wordSummaries
    .filter((word) => word.role === "target")
    .filter((word) => word.focusGrapheme !== scenario.primaryFocus && secondaryWeakTargets.has(word.focusGrapheme))
    .length;

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
    contextualDifficulty: summarizeContextualDifficulty(wordSummaries),
    fallback: {
      used: fallbackCount > 0,
      fallbackCount,
      targetShortfall: fallbackCount,
      shortfallFilledBySecondaryWeakTarget,
      fallbackReviewCount: fallbackReviewClassifications.length,
      basisCounts: countBy(fallbackReviewClassifications, (word) => word.reviewBasis),
      unlinkedFallbackCount: fallbackReviewClassifications
        .filter((word) => word.reviewBasis === REVIEW_BASIS_LAST_RESORT_SAFE_REVIEW)
        .length,
      sourceCounts: countBy(fallbackReviewClassifications, (word) => word.source),
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
      basisCounts: countBy(stretchClassifications, (word) => word.stretchBasis),
      evidenceLinkedCount,
      focusDriftCount,
      capBreachCount,
      unlinkedHardCount,
      softConsolidationCount: stretchClassifications
        .filter((word) => word.stretchBasis === "soft_consolidation")
        .length,
      alignedWithDevelopingTargetCount: byRole.stretch
        .filter((word) => developingTargets.has(normalizeToken(word.focusGrapheme || "")))
        .length,
      offTargetFocusWords: stretchClassifications
        .filter((word) => word.stretchBasis === "unlinked_fallback"
          || (word.bankFocusGrapheme && word.focusGrapheme !== word.bankFocusGrapheme))
        .map((word) => ({
          word: normalizeWord(word.word),
          reportedFocusGrapheme: normalizeToken(word.focusGrapheme || ""),
          bankFocusGrapheme: normalizeToken(word.bankFocusGrapheme || ""),
          stretchBasis: word.stretchBasis,
        })),
      meaningfulForStrongProfile,
      words: stretchClassifications.map((word) => ({
        word: word.word,
        focusGrapheme: word.focusGrapheme,
        bankFocusGrapheme: word.bankFocusGrapheme,
        difficultyScore: word.difficultyScore,
        difficultyBand: word.difficultyBand,
        stretchBasis: word.stretchBasis,
        repeatedFromPrior: word.repeatedFromPrior,
        hasSentence: word.hasSentence,
        hasMeaning: word.hasMeaning,
      })),
    },
    review: {
      wordCount: reviewClassifications.length,
      basisCounts: countBy(reviewClassifications, (word) => word.reviewBasis),
      repeatedFromPriorCount: reviewClassifications.filter((word) => word.repeatedFromPrior).length,
      safeReviewReuseCount: reviewClassifications
        .filter((word) => Number(word.difficultyScore || 0) <= 35 && word.repeatedFromPrior)
        .length,
      recentlySecureReuseCount: reviewClassifications.filter((word) => word.usage?.recentlySecure).length,
      protectedReuseCount: reviewClassifications
        .filter((word) => (word.usage?.incorrectCount || 0) > 0 || word.usage?.reviewDue)
        .length,
      sourceCounts: countBy(reviewClassifications, (word) => word.source),
      fallbackReviewCount: fallbackReviewClassifications.length,
      words: reviewClassifications.map((word) => ({
        word: word.word,
        focusGrapheme: word.focusGrapheme,
        difficultyScore: word.difficultyScore,
        source: word.source,
        reviewBasis: word.reviewBasis,
        repeatedFromPrior: word.repeatedFromPrior,
      })),
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

function summarizeCycleToCycleOverlap(cycleSummaries) {
  const overlaps = [];
  for (let index = 1; index < cycleSummaries.length; index += 1) {
    const previous = cycleSummaries[index - 1];
    const current = cycleSummaries[index];
    const previousWords = new Set((previous.words || []).map((word) => word.word));
    const currentWords = (current.words || []).map((word) => word.word);
    const repeatedWords = currentWords.filter((word) => previousWords.has(word));
    const previousSelectedWords = (previous.words || []).map((word) => word.word);
    overlaps.push({
      fromCycle: previous.cycle,
      toCycle: current.cycle,
      repeatedWordCount: repeatedWords.length,
      overlapRate: roundOne(repeatedWords.length / Math.max(1, currentWords.length)),
      identicalToPrevious: repeatedWords.length === currentWords.length
        && previousSelectedWords.length === currentWords.length
        && currentWords.every((word) => previousWords.has(word)),
      repeatedWords,
    });
  }
  return overlaps;
}

function runRepeatGenerationAudit(scenario, cycleCount = 3) {
  let attempts = [...(scenario.initialAttempts || [])];
  const cycles = [];

  for (let cycle = 1; cycle <= cycleCount; cycle += 1) {
    const plan = buildPlanForScenario(scenario, attempts);
    const summary = summarizePlan(scenario, plan, attempts);
    const contextualScores = summary.words
      .map((word) => Number(word.contextualDifficulty?.effectiveScore))
      .filter(Number.isFinite);
    const repeatedHighEffectiveWords = summary.words
      .filter((word) => word.repeatedFromPrior)
      .filter((word) => ["high_for_band", "above_hard_cap"].includes(word.contextualDifficulty?.placementFit || ""));
    cycles.push({
      cycle,
      wordCount: summary.wordCount,
      roleMix: summary.roleMix,
      fallbackCount: summary.fallback.fallbackCount,
      repeatedFromPriorCount: summary.repetitionSignals.repeatedFromPriorCount,
      recentlySecureReuseCount: summary.repetitionSignals.recentlySecureReuseCount,
      incorrectReuseCount: summary.repetitionSignals.incorrectReuseCount,
      reviewDueReuseCount: summary.repetitionSignals.reviewDueReuseCount,
      protectedReuseCount: summary.repetitionSignals.incorrectReuseCount + summary.repetitionSignals.reviewDueReuseCount,
      safeWordReuseCount: summary.repetitionSignals.safeWordReuseCount,
      reviewRepeatedFromPriorCount: summary.review.repeatedFromPriorCount,
      safeReviewReuseCount: summary.review.safeReviewReuseCount,
      recentlySecureReviewReuseCount: summary.review.recentlySecureReuseCount,
      protectedReviewReuseCount: summary.review.protectedReuseCount,
      contextualEffectiveAverage: roundOne(average(contextualScores)),
      contextualHighForBandCount: summary.words
        .filter((word) => word.contextualDifficulty?.placementFit === "high_for_band")
        .length,
      contextualAboveHardCapCount: summary.words
        .filter((word) => word.contextualDifficulty?.placementFit === "above_hard_cap")
        .length,
      contextualRepeatedHighEffectiveWordCount: repeatedHighEffectiveWords.length,
      words: summary.words,
    });
    attempts = appendSyntheticCycleAttempts({ scenario, attempts, summary, cycle });
  }

  const repeatedWords = summarizeRepeatedSelections(cycles, (word) => word.word);
  const repeatedGraphemes = summarizeRepeatedSelections(cycles, (word) => word.focusGrapheme);
  const cycleToCycleOverlap = summarizeCycleToCycleOverlap(cycles);
  const totalRecentlySecureReuseCount = cycles.reduce((sum, cycle) => sum + cycle.recentlySecureReuseCount, 0);
  const totalSafeWordReuseCount = cycles.reduce((sum, cycle) => sum + cycle.safeWordReuseCount, 0);
  const totalProtectedReuseCount = cycles.reduce((sum, cycle) => sum + cycle.protectedReuseCount, 0);
  const totalReviewRepeatCount = cycles.reduce((sum, cycle) => sum + cycle.reviewRepeatedFromPriorCount, 0);
  const totalSafeReviewReuseCount = cycles.reduce((sum, cycle) => sum + cycle.safeReviewReuseCount, 0);
  const totalProtectedReviewReuseCount = cycles.reduce((sum, cycle) => sum + cycle.protectedReviewReuseCount, 0);
  const totalRepeatedHighEffectiveWordCount = cycles
    .reduce((sum, cycle) => sum + cycle.contextualRepeatedHighEffectiveWordCount, 0);

  return {
    profileId: scenario.id,
    cycleCount,
    repeatedWordSelections: repeatedWords,
    repeatedGraphemeSelections: repeatedGraphemes,
    cycleToCycleOverlap,
    totalRepeatedWordCount: repeatedWords.reduce((sum, item) => sum + item.count, 0),
    totalRecentlySecureReuseCount,
    totalSafeWordReuseCount,
    totalProtectedReuseCount,
    totalReviewRepeatCount,
    totalSafeReviewReuseCount,
    totalProtectedReviewReuseCount,
    totalRepeatedHighEffectiveWordCount,
    maxCycleToCycleOverlapCount: cycleToCycleOverlap.reduce((max, item) => Math.max(max, item.repeatedWordCount), 0),
    cycles: cycles.map((cycle) => ({
      cycle: cycle.cycle,
      wordCount: cycle.wordCount,
      roleMix: cycle.roleMix,
      fallbackCount: cycle.fallbackCount,
      repeatedFromPriorCount: cycle.repeatedFromPriorCount,
      recentlySecureReuseCount: cycle.recentlySecureReuseCount,
      incorrectReuseCount: cycle.incorrectReuseCount,
      reviewDueReuseCount: cycle.reviewDueReuseCount,
      protectedReuseCount: cycle.protectedReuseCount,
      safeWordReuseCount: cycle.safeWordReuseCount,
      reviewRepeatedFromPriorCount: cycle.reviewRepeatedFromPriorCount,
      safeReviewReuseCount: cycle.safeReviewReuseCount,
      recentlySecureReviewReuseCount: cycle.recentlySecureReviewReuseCount,
      protectedReviewReuseCount: cycle.protectedReviewReuseCount,
      contextualEffectiveAverage: cycle.contextualEffectiveAverage,
      contextualHighForBandCount: cycle.contextualHighForBandCount,
      contextualAboveHardCapCount: cycle.contextualAboveHardCapCount,
      contextualRepeatedHighEffectiveWordCount: cycle.contextualRepeatedHighEffectiveWordCount,
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
  const neutralSourcePriority = selectApprovedTargetWords({
    focusGrapheme: "ph",
    challengeLevel: "needs_support",
    count: 1,
    candidates: [phone, teacherPhase],
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
      interpretation: "Protected usage spacing is applied before source priority when ranking target candidates.",
    },
    neutralSourcePriority: {
      selectedWords: selectedWords(neutralSourcePriority),
      status: neutralSourcePriority.status,
      interpretation: "Wordloom core source priority remains a tie-break among neutral same-tier candidates.",
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

  const nonEvidenceReviewProfiles = profileReports.filter((profile) =>
    (profile.review.basisCounts?.[REVIEW_BASIS_LAST_RESORT_SAFE_REVIEW] || 0) > 0
  );
  if (nonEvidenceReviewProfiles.length) {
    concerns.push({
      id: "review_not_evidence_linked",
      profileIds: nonEvidenceReviewProfiles.map((profile) => profile.id),
      detail: "At least one review word was selected as a last-resort safe review rather than from protected, developing, secure, or related evidence.",
    });
  }

  const lastResortFallbackProfiles = profileReports.filter((profile) =>
    profile.fallback.unlinkedFallbackCount > 0
      && (
        (profile.review.basisCounts?.[REVIEW_BASIS_PROTECTED_REVIEW] || 0)
        + (profile.review.basisCounts?.[REVIEW_BASIS_NEARLY_SECURE_CONSOLIDATION] || 0)
        + (profile.review.basisCounts?.[REVIEW_BASIS_SECURE_REVIEW] || 0)
        + (profile.review.basisCounts?.[REVIEW_BASIS_RELATED_FAMILY_REVIEW] || 0)
      ) > 0
  );
  if (lastResortFallbackProfiles.length) {
    concerns.push({
      id: "last_resort_fallback_used_when_evidence_exists",
      profileIds: lastResortFallbackProfiles.map((profile) => profile.id),
      detail: "A fallback review slot used last-resort safe review even though the profile had some evidence-linked review choices.",
    });
  }

  const needsSupportSafeReviewProfiles = repeatReports.filter((profile) =>
    profile.profileId === "needs_support" && profile.totalSafeReviewReuseCount > 0
  );
  if (needsSupportSafeReviewProfiles.length) {
    concerns.push({
      id: "needs_support_safe_review_recycling",
      profileIds: needsSupportSafeReviewProfiles.map((profile) => profile.profileId),
      detail: "Needs-support repeat generation still reuses some safe review words when low primary coverage leaves few alternatives.",
    });
  }

  const strongProfileUnlinkedFallback = profileReports.filter((profile) =>
    ["secure_expected", "early_stretch"].includes(profile.id)
      && profile.fallback.unlinkedFallbackCount > 0
  );
  if (strongProfileUnlinkedFallback.length) {
    concerns.push({
      id: "strong_profile_unlinked_fallback",
      profileIds: strongProfileUnlinkedFallback.map((profile) => profile.id),
      detail: "A strong profile used an unlinked fallback review word instead of evidence-linked challenge or consolidation.",
    });
  }

  const focusDriftProfiles = profileReports.filter((profile) => profile.stretch.focusDriftCount > 0);
  if (focusDriftProfiles.length) {
    concerns.push({
      id: "stretch_focus_drift",
      profileIds: focusDriftProfiles.map((profile) => profile.id),
      detail: "At least one stretch word reported a different focus from the bank focus that caused selection.",
    });
  }

  const unlinkedProfiles = profileReports.filter((profile) =>
    profile.stretch.evidenceLinkedCount < profile.stretch.wordCount
  );
  if (unlinkedProfiles.length) {
    concerns.push({
      id: "stretch_unlinked_to_evidence",
      profileIds: unlinkedProfiles.map((profile) => profile.id),
      detail: "At least one stretch word was not linked to the current target, diagnostic evidence, a related family, or soft consolidation evidence.",
    });
  }

  const capBreachProfiles = profileReports.filter((profile) => profile.stretch.capBreachCount > 0);
  if (capBreachProfiles.length) {
    concerns.push({
      id: "stretch_too_hard_for_profile",
      profileIds: capBreachProfiles.map((profile) => profile.id),
      detail: "At least one stretch word exceeded the profile's stretch difficulty cap.",
    });
  }

  const availabilityDrivenProfiles = profileReports.filter((profile) =>
    (profile.stretch.basisCounts?.unlinked_fallback || 0) > 0 || profile.stretch.unlinkedHardCount > 0
  );
  if (availabilityDrivenProfiles.length) {
    concerns.push({
      id: "stretch_availability_driven",
      profileIds: availabilityDrivenProfiles.map((profile) => profile.id),
      detail: "At least one stretch word appears to be a fallback rather than a meaningful evidence-linked choice.",
    });
  }

  const weakStrongProfiles = profileReports.filter((profile) =>
    ["secure_expected", "early_stretch"].includes(profile.id)
      && profile.stretch.meaningfulForStrongProfile !== true
  );
  if (weakStrongProfiles.length) {
    concerns.push({
      id: "strong_profile_stretch_not_meaningful",
      profileIds: weakStrongProfiles.map((profile) => profile.id),
      detail: "A strong profile did not show positive, evidence-linked, in-cap stretch challenge.",
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

function projectWordSignature(word = {}) {
  return {
    position: word.position,
    word: word.word,
    role: word.role,
    focusGrapheme: word.focusGrapheme,
    source: word.source,
    difficultyScore: word.difficultyScore,
    difficultyBand: word.difficultyBand,
    questionType: word.questionType,
    support: word.support,
    supportReason: word.supportReason,
    targetReason: word.targetReason,
  };
}

function projectReviewWord(word = {}) {
  return {
    word: word.word,
    focusGrapheme: word.focusGrapheme,
    difficultyScore: word.difficultyScore,
    source: word.source,
    reviewBasis: word.reviewBasis,
    repeatedFromPrior: word.repeatedFromPrior,
  };
}

function projectStretchWord(word = {}) {
  return {
    word: word.word,
    focusGrapheme: word.focusGrapheme,
    bankFocusGrapheme: word.bankFocusGrapheme,
    difficultyScore: word.difficultyScore,
    difficultyBand: word.difficultyBand,
    stretchBasis: word.stretchBasis,
    repeatedFromPrior: word.repeatedFromPrior,
    hasSentence: word.hasSentence,
    hasMeaning: word.hasMeaning,
  };
}

function buildSelectorBehaviorProjection(report = {}) {
  return {
    assignmentLength: report.assignmentLength,
    expectedComposition: report.expectedComposition,
    profiles: (report.profiles || []).map((profile) => ({
      id: profile.id,
      label: profile.label,
      primaryTargetGrapheme: profile.primaryTargetGrapheme,
      planError: profile.planError,
      wordCount: profile.wordCount,
      roleMix: profile.roleMix,
      focusGraphemes: profile.focusGraphemes,
      sources: profile.sources,
      difficulty: profile.difficulty,
      fallback: profile.fallback,
      supportLadder: profile.supportLadder,
      stretch: {
        wordCount: profile.stretch?.wordCount,
        averageStretchScore: profile.stretch?.averageStretchScore,
        averageTargetScore: profile.stretch?.averageTargetScore,
        scoreLiftOverTarget: profile.stretch?.scoreLiftOverTarget,
        basisCounts: profile.stretch?.basisCounts,
        evidenceLinkedCount: profile.stretch?.evidenceLinkedCount,
        focusDriftCount: profile.stretch?.focusDriftCount,
        capBreachCount: profile.stretch?.capBreachCount,
        unlinkedHardCount: profile.stretch?.unlinkedHardCount,
        softConsolidationCount: profile.stretch?.softConsolidationCount,
        alignedWithDevelopingTargetCount: profile.stretch?.alignedWithDevelopingTargetCount,
        offTargetFocusWords: profile.stretch?.offTargetFocusWords,
        meaningfulForStrongProfile: profile.stretch?.meaningfulForStrongProfile,
        words: (profile.stretch?.words || []).map(projectStretchWord),
      },
      review: {
        wordCount: profile.review?.wordCount,
        basisCounts: profile.review?.basisCounts,
        repeatedFromPriorCount: profile.review?.repeatedFromPriorCount,
        safeReviewReuseCount: profile.review?.safeReviewReuseCount,
        recentlySecureReuseCount: profile.review?.recentlySecureReuseCount,
        protectedReuseCount: profile.review?.protectedReuseCount,
        sourceCounts: profile.review?.sourceCounts,
        fallbackReviewCount: profile.review?.fallbackReviewCount,
        words: (profile.review?.words || []).map(projectReviewWord),
      },
      repetitionSignals: profile.repetitionSignals,
      wordSignatures: (profile.words || []).map(projectWordSignature),
    })),
    repeatGeneration: (report.repeatGeneration || []).map((repeat) => ({
      profileId: repeat.profileId,
      cycleCount: repeat.cycleCount,
      repeatedWordSelections: repeat.repeatedWordSelections,
      repeatedGraphemeSelections: repeat.repeatedGraphemeSelections,
      cycleToCycleOverlap: repeat.cycleToCycleOverlap,
      totalRepeatedWordCount: repeat.totalRepeatedWordCount,
      totalRecentlySecureReuseCount: repeat.totalRecentlySecureReuseCount,
      totalSafeWordReuseCount: repeat.totalSafeWordReuseCount,
      totalProtectedReuseCount: repeat.totalProtectedReuseCount,
      totalReviewRepeatCount: repeat.totalReviewRepeatCount,
      totalSafeReviewReuseCount: repeat.totalSafeReviewReuseCount,
      totalProtectedReviewReuseCount: repeat.totalProtectedReviewReuseCount,
      maxCycleToCycleOverlapCount: repeat.maxCycleToCycleOverlapCount,
      cycles: (repeat.cycles || []).map((cycle) => ({
        cycle: cycle.cycle,
        wordCount: cycle.wordCount,
        roleMix: cycle.roleMix,
        fallbackCount: cycle.fallbackCount,
        repeatedFromPriorCount: cycle.repeatedFromPriorCount,
        recentlySecureReuseCount: cycle.recentlySecureReuseCount,
        incorrectReuseCount: cycle.incorrectReuseCount,
        reviewDueReuseCount: cycle.reviewDueReuseCount,
        protectedReuseCount: cycle.protectedReuseCount,
        safeWordReuseCount: cycle.safeWordReuseCount,
        reviewRepeatedFromPriorCount: cycle.reviewRepeatedFromPriorCount,
        safeReviewReuseCount: cycle.safeReviewReuseCount,
        recentlySecureReviewReuseCount: cycle.recentlySecureReviewReuseCount,
        protectedReviewReuseCount: cycle.protectedReviewReuseCount,
        selectedWords: cycle.selectedWords,
        selectedGraphemes: cycle.selectedGraphemes,
      })),
    })),
    usageProbes: report.usageProbes,
    observedConcerns: report.observedConcerns,
  };
}

function readSavedSelectorAuditBaseline() {
  if (!existsSync(SELECTOR_AUDIT_BASELINE_URL)) return null;
  const buffer = readFileSync(SELECTOR_AUDIT_BASELINE_URL);
  const content = (
    buffer[0] === 0xff && buffer[1] === 0xfe
      ? buffer.toString("utf16le")
      : buffer.toString("utf8")
  ).replace(/^\uFEFF/, "");
  const jsonLine = content
    .split(/\r?\n/)
    .find((line) => line.startsWith("SELECTOR_INTELLIGENCE_AUDIT_JSON "));
  if (!jsonLine) return null;
  try {
    return JSON.parse(jsonLine.replace("SELECTOR_INTELLIGENCE_AUDIT_JSON ", ""));
  } catch {
    return null;
  }
}

function buildSavedBaselineComparison(currentReport = {}) {
  const savedBaseline = readSavedSelectorAuditBaseline();
  if (!savedBaseline) {
    return {
      baselinePath: "selector-audit-output.txt",
      savedBaselineStatus: "missing_or_unreadable",
      matched: null,
    };
  }

  const currentProjection = buildSelectorBehaviorProjection(currentReport);
  const savedProjection = buildSelectorBehaviorProjection(savedBaseline);
  const matched = JSON.stringify(currentProjection) === JSON.stringify(savedProjection);
  return {
    baselinePath: "selector-audit-output.txt",
    savedBaselineStatus: matched ? "matched" : "different",
    matched,
    note: matched
      ? "Saved v2 audit projection matches the current audit-only projection."
      : "Saved audit output differs from the current local selector projection; the hard invariant test uses the current frozen v2 signature projection.",
  };
}

function buildSelectorIntelligenceAuditReport() {
  const scenarios = makeScenarioDefinitions();
  const profiles = scenarios.map((scenario) => {
    const plan = buildPlanForScenario(scenario, scenario.initialAttempts || []);
    return summarizePlan(scenario, plan, scenario.initialAttempts || []);
  });
  const repeatGeneration = scenarios.map((scenario) => runRepeatGenerationAudit(scenario, 3));
  const usageProbes = runUsageProbeReport();

  const report = {
    auditVersion: AUDIT_VERSION,
    contextualDifficultyAuditVersion: CONTEXTUAL_DIFFICULTY_AUDIT_VERSION,
    generatedAt: AUDIT_NOW_ISO,
    assignmentLength: ASSIGNMENT_LENGTH,
    expectedComposition: buildAutoAssignmentComposition(ASSIGNMENT_LENGTH),
    profiles,
    repeatGeneration,
    usageProbes,
    observedConcerns: collectObservedConcerns(profiles, repeatGeneration, usageProbes),
  };
  report.selectorBehaviorInvariant = buildSelectorBehaviorProjection(report);
  report.v2Comparison = buildSavedBaselineComparison(report);
  return report;
}

function printSelectorIntelligenceAudit(report) {
  console.log("SELECTOR_INTELLIGENCE_AUDIT_SUMMARY");
  console.log("profile | primary | mix | sources | targetAvg | stretchAvg | reviewBasis | stretchBasis | fallbackReview | unlinkedFallback | repeatWords | maxOverlap | reviewRepeats | safeReviewReuse | protectedReviewReuse");
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
      Object.entries(profile.review.basisCounts || {}).map(([key, value]) => `${key}:${value}`).join(","),
      Object.entries(profile.stretch.basisCounts || {}).map(([key, value]) => `${key}:${value}`).join(","),
      profile.fallback.fallbackReviewCount,
      profile.fallback.unlinkedFallbackCount,
      repeat?.repeatedWordSelections.length || 0,
      repeat?.maxCycleToCycleOverlapCount || 0,
      repeat?.totalReviewRepeatCount || 0,
      repeat?.totalSafeReviewReuseCount || 0,
      repeat?.totalProtectedReviewReuseCount || 0,
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
  for (const profile of AUDIT_REPORT.profiles) {
    assert.ok(profile.stretch.basisCounts);
    assert.ok(profile.review.basisCounts);
    assert.equal(typeof profile.review.repeatedFromPriorCount, "number");
    assert.equal(typeof profile.review.safeReviewReuseCount, "number");
    assert.equal(typeof profile.review.recentlySecureReuseCount, "number");
    assert.equal(typeof profile.review.protectedReuseCount, "number");
    assert.equal(typeof profile.fallback.targetShortfall, "number");
    assert.equal(typeof profile.fallback.shortfallFilledBySecondaryWeakTarget, "number");
    assert.equal(typeof profile.fallback.fallbackReviewCount, "number");
    assert.equal(typeof profile.fallback.unlinkedFallbackCount, "number");
    assert.ok(profile.fallback.basisCounts);
    assert.ok(profile.fallback.sourceCounts);
    assert.equal(typeof profile.stretch.evidenceLinkedCount, "number");
    assert.equal(typeof profile.stretch.focusDriftCount, "number");
    assert.equal(typeof profile.stretch.capBreachCount, "number");
    assert.equal(typeof profile.stretch.unlinkedHardCount, "number");
    assert.equal(typeof profile.stretch.softConsolidationCount, "number");
    assert.equal(profile.stretch.focusDriftCount, 0);
    assert.equal(profile.stretch.capBreachCount, 0);
    assert.equal(profile.stretch.unlinkedHardCount, 0);
  }
  assert.equal(AUDIT_REPORT.profiles.find((profile) => profile.id === "needs_support").stretch.basisCounts.soft_consolidation, 2);
  assert.equal(AUDIT_REPORT.profiles.find((profile) => profile.id === "needs_support").fallback.targetShortfall, 2);
  assert.equal(AUDIT_REPORT.profiles.find((profile) => profile.id === "needs_support").fallback.fallbackReviewCount, 2);
  assert.equal((AUDIT_REPORT.profiles.find((profile) => profile.id === "needs_support").fallback.basisCounts.secure_review || 0) >= 1, true);
  assert.equal(AUDIT_REPORT.profiles.find((profile) => profile.id === "needs_support").fallback.unlinkedFallbackCount, 0);
  assert.equal((AUDIT_REPORT.profiles.find((profile) => profile.id === "core_developing").review.basisCounts.nearly_secure_consolidation || 0) >= 1, true);
  assert.equal(AUDIT_REPORT.profiles.find((profile) => profile.id === "core_developing").stretch.basisCounts.diagnostic_miss, 2);
  assert.ok(AUDIT_REPORT.profiles.find((profile) => profile.id === "core_developing").stretch.scoreLiftOverTarget > 0);
  assert.equal(AUDIT_REPORT.profiles.find((profile) => profile.id === "secure_expected").stretch.basisCounts.current_target, 2);
  assert.equal(AUDIT_REPORT.profiles.find((profile) => profile.id === "early_stretch").stretch.basisCounts.diagnostic_miss, 2);
  assert.equal(AUDIT_REPORT.profiles.find((profile) => profile.id === "secure_expected").stretch.meaningfulForStrongProfile, true);
  assert.equal(AUDIT_REPORT.profiles.find((profile) => profile.id === "early_stretch").stretch.meaningfulForStrongProfile, true);
});

test("contextual difficulty v3A reports audit-only per-word and profile metrics", () => {
  assert.equal(AUDIT_REPORT.contextualDifficultyAuditVersion, CONTEXTUAL_DIFFICULTY_AUDIT_VERSION);

  for (const profile of AUDIT_REPORT.profiles) {
    assert.equal(profile.contextualDifficulty.modelVersion, CONTEXTUAL_DIFFICULTY_AUDIT_VERSION);
    assert.equal(typeof profile.contextualDifficulty.all.averageEffectiveScore, "number");
    assert.equal(typeof profile.contextualDifficulty.all.averageStaticScore, "number");
    assert.equal(typeof profile.contextualDifficulty.all.averageDelta, "number");
    assert.ok(profile.contextualDifficulty.all.effectiveBands);
    assert.ok(profile.contextualDifficulty.review.effectiveBands);
    assert.ok(profile.contextualDifficulty.target.effectiveBands);
    assert.ok(profile.contextualDifficulty.stretch.effectiveBands);
    assert.ok(profile.contextualDifficulty.placementPressure);
    assert.ok(profile.contextualDifficulty.contextCoverage);
    assert.ok(profile.contextualDifficulty.supportRelief);
    assert.ok(profile.contextualDifficulty.evidenceMix);
    assert.ok(profile.contextualDifficulty.riskFlags);

    for (const fit of CONTEXTUAL_PLACEMENT_FITS) {
      assert.equal(typeof profile.contextualDifficulty.placementPressure[fit], "number");
    }
    for (const category of CONTEXTUAL_EVIDENCE_CATEGORIES) {
      assert.equal(typeof profile.contextualDifficulty.evidenceMix[category], "number");
    }
    for (const flag of CONTEXTUAL_RISK_FLAGS) {
      assert.equal(typeof profile.contextualDifficulty.riskFlags[flag], "number");
    }

    for (const word of profile.words) {
      const contextual = word.contextualDifficulty;
      assert.equal(contextual.modelVersion, CONTEXTUAL_DIFFICULTY_AUDIT_VERSION);
      assert.equal(typeof contextual.staticScore, "number");
      assert.equal(typeof contextual.staticBand, "string");
      assert.equal(typeof contextual.unsupportedScore, "number");
      assert.equal(typeof contextual.effectiveScore, "number");
      assert.equal(typeof contextual.effectiveBand, "string");
      assert.equal(typeof contextual.scoreDelta, "number");
      assert.equal(typeof contextual.placementBand, "string");
      assert.equal(typeof contextual.placementCenter, "number");
      assert.equal(typeof contextual.scoreVsPlacementCenter, "number");
      assert.ok(CONTEXTUAL_PLACEMENT_FITS.includes(contextual.placementFit));
      assert.equal(typeof contextual.abovePlacementHardMax, "boolean");
      assert.ok(CONTEXTUAL_EVIDENCE_CATEGORIES.includes(contextual.evidenceCategory));
      assert.equal(typeof contextual.history.count, "number");
      assert.equal(typeof contextual.history.incorrectCount, "number");
      assert.equal(typeof contextual.history.recentlySeen, "boolean");
      assert.equal(typeof contextual.history.recentlySecure, "boolean");
      assert.equal(typeof contextual.history.reviewDue, "boolean");
      assert.equal(typeof contextual.support.assignmentSupport, "string");
      assert.equal(typeof contextual.support.questionType, "string");
      assert.equal(typeof contextual.support.supportAdjustment, "number");
      assert.equal(typeof contextual.support.supportRelief, "number");
      assert.equal(typeof contextual.structure.source, "string");
      assert.equal(typeof contextual.structure.letterCount, "number");
      assert.equal(typeof contextual.structure.graphemeCount, "number");
      assert.equal(typeof contextual.structure.multiLetterGraphemeCount, "number");
      assert.equal(typeof contextual.structure.longGraphemeCount, "number");
      assert.equal(typeof contextual.structure.adjustment, "number");
      assert.equal(typeof contextual.context.hasSentence, "boolean");
      assert.equal(typeof contextual.context.hasMeaning, "boolean");
      assert.equal(typeof contextual.context.availability, "string");
      assert.equal(typeof contextual.context.adjustment, "number");
      assert.ok(Array.isArray(contextual.drivers));
      assert.ok(Array.isArray(contextual.flags));
    }
  }
});

test("repeat generation audit shows avoidable repetition is reduced", () => {
  assert.equal(AUDIT_REPORT.repeatGeneration.length, 4);
  for (const repeatReport of AUDIT_REPORT.repeatGeneration) {
    assert.equal(repeatReport.cycleCount, 3);
    assert.equal(repeatReport.cycles.length, 3);
    assert.equal(repeatReport.cycleToCycleOverlap.length, 2);
    assert.ok(repeatReport.repeatedGraphemeSelections.length > 0);
    assert.equal(typeof repeatReport.totalReviewRepeatCount, "number");
    assert.equal(typeof repeatReport.totalSafeReviewReuseCount, "number");
    assert.equal(typeof repeatReport.totalProtectedReviewReuseCount, "number");
    assert.equal(typeof repeatReport.totalRepeatedHighEffectiveWordCount, "number");
    for (const cycle of repeatReport.cycles) {
      assert.equal(typeof cycle.contextualEffectiveAverage, "number");
      assert.equal(typeof cycle.contextualHighForBandCount, "number");
      assert.equal(typeof cycle.contextualAboveHardCapCount, "number");
      assert.equal(typeof cycle.contextualRepeatedHighEffectiveWordCount, "number");
    }
  }
  const totalSafeWordReuseCount = AUDIT_REPORT.repeatGeneration.reduce((sum, report) => sum + report.totalSafeWordReuseCount, 0);
  const totalRecentlySecureReuseCount = AUDIT_REPORT.repeatGeneration.reduce((sum, report) => sum + report.totalRecentlySecureReuseCount, 0);
  const totalProtectedReuseCount = AUDIT_REPORT.repeatGeneration.reduce((sum, report) => sum + report.totalProtectedReuseCount, 0);
  const identicalRepeatCycles = AUDIT_REPORT.repeatGeneration
    .flatMap((report) => report.cycleToCycleOverlap)
    .filter((overlap) => overlap.identicalToPrevious);
  const needsSupportRepeat = AUDIT_REPORT.repeatGeneration.find((report) => report.profileId === "needs_support");
  const needsSupportSelectedWords = needsSupportRepeat.cycles.flatMap((cycle) => cycle.selectedWords);
  const needsSupportSelectedGraphemes = needsSupportRepeat.cycles.flatMap((cycle) => cycle.selectedGraphemes);

  assert.equal(identicalRepeatCycles.length, 0, "Repeat cycles should not select an identical word set when alternatives exist.");
  assert.ok(totalSafeWordReuseCount < 41, "Safe-word reuse should be reduced from the v1 audit baseline.");
  assert.ok(totalRecentlySecureReuseCount <= 41, "Recently secure reuse should remain bounded while allowing intentional needs-support review repetition.");
  assert.ok(totalProtectedReuseCount > 0, "Previously incorrect or review-due words should remain protected and reusable.");
  assert.equal(needsSupportSelectedWords.some((word) => ["think", "path"].includes(word)), false);
  assert.equal(needsSupportSelectedGraphemes.includes("th"), false);
});

test("usage probes document recent secure, incorrect, fallback, and source-priority handling", () => {
  assertJsonEqual(AUDIT_REPORT.usageProbes.recentSecureAvoided.selectedWords, ["phase"]);
  assertJsonEqual(AUDIT_REPORT.usageProbes.incorrectPreferred.selectedWords, ["phone"]);
  assertJsonEqual(AUDIT_REPORT.usageProbes.recentSecureFallbackEligible.selectedWords, ["phone"]);
  assertJsonEqual(AUDIT_REPORT.usageProbes.sourcePriorityBeforeUsage.selectedWords, ["phase"]);
  assertJsonEqual(AUDIT_REPORT.usageProbes.neutralSourcePriority.selectedWords, ["phone"]);
  assert.equal(AUDIT_REPORT.observedConcerns.some((concern) => concern.id === "source_priority_before_usage"), false);
});

test("contextual v3A preserves selector v2 invariant word signatures", () => {
  const projection = AUDIT_REPORT.selectorBehaviorInvariant;
  assertJsonEqual(projection, buildSelectorBehaviorProjection(AUDIT_REPORT));
  assert.equal(JSON.stringify(projection).includes("contextualDifficulty"), false);
  assert.equal(JSON.stringify(projection).includes("effectiveScore"), false);

  const expectedProfileWords = {
    needs_support: ["yellow", "grow", "crow", "snow", "phone", "photo", "chain", "brain", "queen", "snail"],
    core_developing: ["three", "thin", "yellow", "grow", "shape", "shop", "wish", "shadow", "think", "path"],
    secure_expected: ["bridge", "badge", "storm", "edge", "motion", "station", "fiction", "action", "question", "mention"],
    early_stretch: ["badge", "bridge", "edge", "citrus", "belief", "shield", "brief", "achieve", "cinema", "picture"],
  };
  const expectedRepeatWords = {
    needs_support: [
      ["yellow", "grow", "crow", "snow", "phone", "photo", "chain", "brain", "queen", "snail"],
      ["train", "rain", "yellow", "grow", "phone", "photo", "paint", "sleep", "crow", "snow"],
      ["chain", "brain", "snail", "train", "phone", "photo", "green", "seed", "rain", "paint"],
    ],
    core_developing: [
      ["three", "thin", "yellow", "grow", "shape", "shop", "wish", "shadow", "think", "path"],
      ["crow", "snow", "chain", "brain", "shower", "shell", "shape", "shop", "three", "thin"],
      ["snail", "paint", "train", "rain", "wish", "shadow", "shower", "shell", "think", "path"],
    ],
    secure_expected: [
      ["bridge", "badge", "storm", "edge", "motion", "station", "fiction", "action", "question", "mention"],
      ["short", "chain", "brain", "float", "motion", "station", "fiction", "action", "question", "mention"],
      ["road", "snail", "coat", "paint", "motion", "station", "fiction", "action", "question", "mention"],
    ],
    early_stretch: [
      ["badge", "bridge", "edge", "citrus", "belief", "shield", "brief", "achieve", "cinema", "picture"],
      ["dodge", "pure", "cure", "special", "field", "chief", "belief", "shield", "achieve", "circle"],
      ["future", "flight", "bright", "chain", "brief", "field", "chief", "belief", "shield", "achieve"],
    ],
  };

  for (const profile of projection.profiles) {
    assertJsonEqual(
      profile.wordSignatures.map((word) => word.word),
      expectedProfileWords[profile.id],
    );
    for (const signature of profile.wordSignatures) {
      assert.equal(typeof signature.role, "string");
      assert.equal(typeof signature.focusGrapheme, "string");
      assert.equal(typeof signature.source, "string");
      assert.equal(typeof signature.questionType, "string");
      assert.equal(typeof signature.support, "string");
      assert.equal(typeof signature.supportReason, "string");
      assert.equal(typeof signature.targetReason, "string");
    }
  }

  for (const repeat of projection.repeatGeneration) {
    assertJsonEqual(
      repeat.cycles.map((cycle) => cycle.selectedWords),
      expectedRepeatWords[repeat.profileId],
    );
  }

  assert.ok(["matched", "different", "missing_or_unreadable"].includes(AUDIT_REPORT.v2Comparison.savedBaselineStatus));
});

test("contextual v3A fields are not persisted in assignment word payloads", () => {
  const scenario = makeScenarioDefinitions()[0];
  const plan = buildPlanForScenario(scenario, scenario.initialAttempts || []);
  const payload = buildAssignmentEngineWordPayload(plan.pupilPlans[0].words[0], 1);
  const payloadJson = JSON.stringify(payload);

  assert.equal(payloadJson.includes("contextualDifficulty"), false);
  assert.equal(payloadJson.includes("effectiveScore"), false);
  assert.equal(payloadJson.includes(CONTEXTUAL_DIFFICULTY_AUDIT_VERSION), false);
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
