import { splitWordToGraphemes } from "./wordParser.js?v=1.5";
import {
  SPELLING_BEE_LENGTH_MODE_UNTIL_WRONG,
  normalizeSpellingBeeLengthMode,
} from "./autoAssignPolicy.js?v=1.9";

export const SPELLING_BEE_RESULT_REASONS = Object.freeze([
  "wrong",
  "timeout",
  "completed",
  "abandoned",
]);

export const SPELLING_BEE_TIMER_MIN_MS = 4500;
export const SPELLING_BEE_TIMER_MAX_MS = 11000;
export const SPELLING_BEE_UNTIL_WRONG_SAFETY_ROUNDS = 50;

export function clampSpellingBeeTimerMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return SPELLING_BEE_TIMER_MIN_MS;
  return Math.max(SPELLING_BEE_TIMER_MIN_MS, Math.min(SPELLING_BEE_TIMER_MAX_MS, Math.round(numeric)));
}

export function countSpellingBeeGraphemes(wordRow = null) {
  const segments = Array.isArray(wordRow?.segments)
    ? wordRow.segments.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (segments.length) return segments.length;
  const word = String(wordRow?.word || "").trim();
  return splitWordToGraphemes(word).filter(Boolean).length || Math.max(1, word.length);
}

export function calculateSpellingBeeTimeLimitMs(wordRow = null) {
  return clampSpellingBeeTimerMs(2200 + (850 * countSpellingBeeGraphemes(wordRow)));
}

function normalizeChoice(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  const clean = String(value || "").trim();
  if (!clean) return {};
  try {
    const parsed = JSON.parse(clean);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeSegments(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const clean = String(value || "").trim();
  if (!clean) return [];
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item || "").trim()).filter(Boolean);
  } catch {
    // Fall through to light parsing.
  }
  if (clean.includes("|")) return clean.split("|").map((item) => String(item || "").trim()).filter(Boolean);
  return [clean];
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function getSpellingBeeDifficultyScore(wordRow = null) {
  const choice = normalizeChoice(wordRow?.choice);
  const difficulty = choice?.difficulty && typeof choice.difficulty === "object" ? choice.difficulty : {};
  const coreScore = numberOrNull(difficulty.coreScore);
  if (coreScore != null) return coreScore;
  const score = numberOrNull(difficulty.score);
  if (score != null) return score;
  return Math.min(100, Math.max(5, countSpellingBeeGraphemes(wordRow) * 8));
}

function hashString(value = "") {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicJitter(seed = "", wordRow = null) {
  const key = [
    seed,
    wordRow?.id || "",
    wordRow?.word || "",
  ].join("::");
  return hashString(key) / 0xffffffff;
}

export function isApprovedSpellingBeeWordRow(wordRow = null) {
  const choice = normalizeChoice(wordRow?.choice);
  return String(choice?.source || "").trim().toLowerCase() === "teacher"
    && !!String(wordRow?.word || "").trim();
}

export function buildSpellingBeeApprovedBank(wordRows = []) {
  const seenWords = new Set();
  return (Array.isArray(wordRows) ? wordRows : [])
    .map((wordRow) => ({
      ...wordRow,
      word: String(wordRow?.word || "").trim().toLowerCase(),
      segments: normalizeSegments(wordRow?.segments),
      choice: normalizeChoice(wordRow?.choice),
    }))
    .filter(isApprovedSpellingBeeWordRow)
    .filter((wordRow) => {
      const key = String(wordRow.word || "").trim().toLowerCase();
      if (!key || seenWords.has(key)) return false;
      seenWords.add(key);
      return true;
    })
    .map((wordRow) => ({
      ...wordRow,
      beeDifficultyScore: getSpellingBeeDifficultyScore(wordRow),
      beeGraphemeCount: countSpellingBeeGraphemes(wordRow),
      beeTimeLimitMs: calculateSpellingBeeTimeLimitMs(wordRow),
    }));
}

export function getSpellingBeeTargetDifficulty(roundIndex = 0) {
  const index = Math.max(0, Number(roundIndex) || 0);
  if (index === 0) return 24;
  if (index === 1) return 34;
  return Math.min(96, 50 + ((index - 2) * 8));
}

export function buildSpellingBeeLadder({
  wordRows = [],
  maxRounds = 10,
  lengthMode = "",
  seed = "",
} = {}) {
  const safeLengthMode = normalizeSpellingBeeLengthMode(lengthMode);
  const safeMaxRounds = safeLengthMode === SPELLING_BEE_LENGTH_MODE_UNTIL_WRONG
    ? SPELLING_BEE_UNTIL_WRONG_SAFETY_ROUNDS
    : Math.max(1, Math.round(Number(maxRounds) || 10));
  const approvedBank = buildSpellingBeeApprovedBank(wordRows);
  const challengeRoundCount = Math.max(0, safeMaxRounds - 2);
  const lengthLabel = safeLengthMode === SPELLING_BEE_LENGTH_MODE_UNTIL_WRONG
    ? "until-wrong Spelling Bee"
    : `${safeMaxRounds}-round Spelling Bee`;
  const lengthArticle = safeLengthMode === SPELLING_BEE_LENGTH_MODE_UNTIL_WRONG ? "an" : "a";
  if (approvedBank.length < safeMaxRounds) {
    return {
      status: "not_enough_approved_words",
      words: [],
      required: safeMaxRounds,
      available: approvedBank.length,
      lengthMode: safeLengthMode,
      error: `Not enough teacher-approved words are available for ${lengthArticle} ${lengthLabel}.`,
    };
  }
  if (challengeRoundCount > 0) {
    const challengeWords = approvedBank.filter((wordRow) => Number(wordRow?.beeDifficultyScore || 0) >= 46);
    if (challengeWords.length < challengeRoundCount) {
      return {
        status: "not_enough_approved_words",
        words: [],
        required: safeMaxRounds,
        available: approvedBank.length,
        lengthMode: safeLengthMode,
        error: `Not enough teacher-approved challenge words are available for a fair ${lengthLabel}.`,
      };
    }
  }

  const available = approvedBank
    .map((wordRow) => ({
      ...wordRow,
      beeSeedJitter: deterministicJitter(seed, wordRow),
    }))
    .sort((a, b) =>
      Number(a.beeDifficultyScore || 0) - Number(b.beeDifficultyScore || 0)
      || Number(a.beeSeedJitter || 0) - Number(b.beeSeedJitter || 0)
      || String(a.word || "").localeCompare(String(b.word || ""))
      || String(a.id || "").localeCompare(String(b.id || ""))
    );

  const selected = [];
  for (let roundIndex = 0; roundIndex < safeMaxRounds; roundIndex += 1) {
    const target = getSpellingBeeTargetDifficulty(roundIndex);
    const preferAtOrAbove = roundIndex >= 2;
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let candidateIndex = 0; candidateIndex < available.length; candidateIndex += 1) {
      const candidate = available[candidateIndex];
      const difficulty = Number(candidate.beeDifficultyScore || 0);
      const missesFastRamp = preferAtOrAbove && difficulty < Math.max(0, target - 4);
      const distance = Math.abs(difficulty - target);
      const penalty = missesFastRamp ? 1000 : 0;
      const tieBreaker = Number(candidate.beeSeedJitter || 0);
      const score = penalty + distance + (tieBreaker / 10);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = candidateIndex;
      }
    }
    if (bestIndex < 0) break;
    const [chosen] = available.splice(bestIndex, 1);
    selected.push({
      ...chosen,
      beeRound: roundIndex + 1,
      beeTargetDifficulty: target,
    });
  }

  if (selected.length < safeMaxRounds) {
    return {
      status: "not_enough_approved_words",
      words: [],
      required: safeMaxRounds,
      available: approvedBank.length,
      lengthMode: safeLengthMode,
      error: `Not enough teacher-approved words are available for ${lengthArticle} ${lengthLabel}.`,
    };
  }

  return {
    status: "ready",
    words: selected,
    required: safeMaxRounds,
    available: approvedBank.length,
    lengthMode: safeLengthMode,
    seed: String(seed || ""),
  };
}
