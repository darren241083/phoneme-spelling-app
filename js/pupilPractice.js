import { chooseBestFocusGrapheme } from "./data/phonemeHelpers.js";
import { getQuestionEvidenceTier } from "./questionTypes.js?v=1.1";

export const PRACTICE_WORD_COUNT = 5;
export const PRACTICE_EVIDENCE_LIMIT = 20;
export const PRACTICE_EVIDENCE_FETCH_LIMIT = 80;

export const PRACTICE_STATUS_READY = "ready";
export const PRACTICE_STATUS_NOT_ENOUGH_EVIDENCE = "not_enough_evidence";
export const PRACTICE_STATUS_NOT_ENOUGH_WORDS = "not_enough_words";

const BLOCKED_EVIDENCE_SOURCES = new Set(["baseline", "practice", "extra_challenge", "extrachallenge"]);
const BLOCKED_EVIDENCE_MODES = new Set(["practice", "learn"]);
const ELIGIBLE_EVIDENCE_TIERS = new Set(["independent", "diagnostic"]);

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
}

function normalizeWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "");
}

function parseMaybeJsonList(value) {
  if (Array.isArray(value)) return value;
  const text = String(value || "").trim();
  if (!text) return [];
  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeTokenList(value) {
  return parseMaybeJsonList(value)
    .map((item) => normalizeToken(item))
    .filter(Boolean);
}

function parseDateMs(value) {
  const ms = new Date(value || "").getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isFalseAttempt(value) {
  if (value === false) return true;
  return String(value).trim().toLowerCase() === "false";
}

function getChoice(row = null) {
  return row?.choice && typeof row.choice === "object" && !Array.isArray(row.choice)
    ? row.choice
    : {};
}

export function selectPracticeGraphemeFromAttempt(attempt = null) {
  const focus = normalizeToken(attempt?.focus_grapheme || attempt?.focusGrapheme || "");
  if (focus && focus !== "general") return focus;

  const targets = normalizeTokenList(attempt?.target_graphemes ?? attempt?.targetGraphemes);
  if (!targets.length) return "";
  if (targets.length === 1) return targets[0];

  return normalizeToken(chooseBestFocusGrapheme(targets)) || targets[0];
}

export function isEligiblePracticeEvidenceAttempt(attempt = null) {
  if (!attempt) return false;
  const source = normalizeToken(attempt?.attempt_source || attempt?.attemptSource || "");
  if (BLOCKED_EVIDENCE_SOURCES.has(source)) return false;
  const mode = normalizeToken(attempt?.mode || "");
  if (!mode || BLOCKED_EVIDENCE_MODES.has(mode)) return false;
  if (!ELIGIBLE_EVIDENCE_TIERS.has(getQuestionEvidenceTier(mode))) return false;
  if (!isFalseAttempt(attempt?.correct ?? attempt?.is_correct)) return false;
  if (!String(attempt?.typed ?? "").trim()) return false;
  if (!String(attempt?.test_word_id || attempt?.testWordId || attempt?.word_text || attempt?.word || "").trim()) return false;
  return !!selectPracticeGraphemeFromAttempt(attempt);
}

export function selectTopPracticeGrapheme(attempts = []) {
  const eligible = (Array.isArray(attempts) ? attempts : [])
    .filter((attempt) => isEligiblePracticeEvidenceAttempt(attempt))
    .sort((a, b) => {
      const dateDelta = parseDateMs(b?.created_at || b?.createdAt) - parseDateMs(a?.created_at || a?.createdAt);
      if (dateDelta !== 0) return dateDelta;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    })
    .slice(0, PRACTICE_EVIDENCE_LIMIT);

  const groups = new Map();
  for (const attempt of eligible) {
    const target = selectPracticeGraphemeFromAttempt(attempt);
    if (!target || target === "general") continue;
    const current = groups.get(target) || {
      target,
      incorrectCount: 0,
      latestAtMs: 0,
      attempts: [],
    };
    current.incorrectCount += 1;
    current.latestAtMs = Math.max(current.latestAtMs, parseDateMs(attempt?.created_at || attempt?.createdAt));
    current.attempts.push(attempt);
    groups.set(target, current);
  }

  return Array.from(groups.values())
    .filter((item) => item.incorrectCount >= 2)
    .sort((a, b) => {
      if (b.incorrectCount !== a.incorrectCount) return b.incorrectCount - a.incorrectCount;
      if (b.latestAtMs !== a.latestAtMs) return b.latestAtMs - a.latestAtMs;
      return a.target.localeCompare(b.target);
    })[0] || null;
}

export function getApprovedPracticeWordMatches(wordRows = [], focusGrapheme = "") {
  const focus = normalizeToken(focusGrapheme);
  if (!focus) return [];

  const byWord = new Map();
  for (const row of Array.isArray(wordRows) ? wordRows : []) {
    const choice = getChoice(row);
    if (normalizeToken(choice?.source) !== "teacher") continue;

    const focusGraphemes = [
      ...normalizeTokenList(choice?.focus_graphemes),
      normalizeToken(choice?.engine_focus_grapheme || choice?.engineFocusGrapheme || ""),
    ].filter(Boolean);
    if (!focusGraphemes.includes(focus)) continue;

    const word = normalizeWord(row?.word);
    const id = String(row?.id || "").trim();
    const testId = String(row?.test_id || row?.testId || "").trim();
    if (!word || !id || !testId) continue;

    const existing = byWord.get(word);
    if (!existing || id.localeCompare(String(existing?.id || "")) < 0) {
      byWord.set(word, row);
    }
  }

  return Array.from(byWord.values())
    .sort((a, b) => {
      const wordDelta = normalizeWord(a?.word).localeCompare(normalizeWord(b?.word));
      if (wordDelta !== 0) return wordDelta;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
}

export function getApprovedPracticeWordsForGrapheme(wordRows = [], focusGrapheme = "", {
  count = PRACTICE_WORD_COUNT,
} = {}) {
  const safeCount = Math.max(1, Number(count) || PRACTICE_WORD_COUNT);
  return getApprovedPracticeWordMatches(wordRows, focusGrapheme).slice(0, safeCount);
}

export function buildPupilPracticePlan({
  attempts = [],
  approvedWordRows = [],
  wordCount = PRACTICE_WORD_COUNT,
} = {}) {
  const topGrapheme = selectTopPracticeGrapheme(attempts);
  if (!topGrapheme) {
    return {
      status: PRACTICE_STATUS_NOT_ENOUGH_EVIDENCE,
      focusGrapheme: "",
      evidenceCount: 0,
      words: [],
      wordCount: 0,
    };
  }

  const matches = getApprovedPracticeWordMatches(approvedWordRows, topGrapheme.target);
  const safeWordCount = Math.max(1, Number(wordCount) || PRACTICE_WORD_COUNT);
  if (matches.length < safeWordCount) {
    return {
      status: PRACTICE_STATUS_NOT_ENOUGH_WORDS,
      focusGrapheme: topGrapheme.target,
      evidenceCount: topGrapheme.incorrectCount,
      words: [],
      wordCount: matches.length,
    };
  }

  return {
    status: PRACTICE_STATUS_READY,
    focusGrapheme: topGrapheme.target,
    evidenceCount: topGrapheme.incorrectCount,
    words: matches.slice(0, safeWordCount),
    wordCount: safeWordCount,
  };
}
