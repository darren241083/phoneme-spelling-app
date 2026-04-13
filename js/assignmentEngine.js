import {
  chooseBestFocusGrapheme,
  getPhonemeAlternativeOptions,
  inferPhonemeFromGrapheme,
} from "./data/phonemeHelpers.js";
import {
  buildPersistedDifficultyPayload,
  getStoredDifficultyModelForWord,
} from "./researchDifficulty.js?v=2.4";
import { normalizeLookupWord } from "./phonicsResolution.js?v=1.0";
import { splitWordToGraphemes } from "./wordParser.js?v=1.5";
import {
  AUTO_ASSIGN_POLICY_DEFAULTS,
  buildAutoAssignEngineOptions,
  normalizeAutoAssignPolicy,
} from "./autoAssignPolicy.js?v=1.0";

export const ASSIGNMENT_ENGINE_WORD_SOURCE = "assignment_engine_pool";
export const ASSIGNMENT_ENGINE_TARGET_SOURCE = "assignment_engine_v1";
export const ASSIGNMENT_ENGINE_DEFAULT_LENGTH = AUTO_ASSIGN_POLICY_DEFAULTS.assignment_length;

const SECTION_RATIOS = {
  review: 0.4,
  target: 0.4,
  stretch: 0.2,
};

const TARGET_REASON_BY_SUPPORT = {
  independent: "target_independent",
  recognition: "target_confusion",
  focus: "target_confusion",
  supported: "target_supported",
};

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
    .replace(/^[^a-z]+|[^a-z]+$/g, "")
    .replace(/[^a-z'-]/g, "");
}

function getResolvedWordEntry(resolvedWordMap, rawWord) {
  if (!(resolvedWordMap instanceof Map)) return null;
  return resolvedWordMap.get(normalizeLookupWord(rawWord)) || null;
}

function normalizeSegments(word, segments, resolvedWordMap = null) {
  const explicit = Array.isArray(segments)
    ? segments.map((item) => normalizeToken(item)).filter(Boolean)
    : [];
  if (explicit.length) return explicit;
  const resolved = getResolvedWordEntry(resolvedWordMap, word);
  if (Array.isArray(resolved?.segments) && resolved.segments.length) {
    return resolved.segments.map((item) => normalizeToken(item)).filter(Boolean);
  }
  return splitWordToGraphemes(word)
    .map((item) => normalizeToken(item))
    .filter(Boolean);
}

function normalizeFocusList(items) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => normalizeToken(item))
      .filter(Boolean)
  )];
}

function roundToNearestInt(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function formatDateLabel(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildLargestRemainderCounts(totalWords) {
  const total = Math.max(1, roundToNearestInt(totalWords) || ASSIGNMENT_ENGINE_DEFAULT_LENGTH);
  const base = Object.fromEntries(
    Object.entries(SECTION_RATIOS).map(([key, ratio]) => [key, Math.floor(total * ratio)])
  );
  let remaining = total - Object.values(base).reduce((sum, value) => sum + value, 0);
  const order = Object.entries(SECTION_RATIOS)
    .map(([key, ratio]) => ({
      key,
      remainder: total * ratio - Math.floor(total * ratio),
    }))
    .sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key));

  let index = 0;
  while (remaining > 0) {
    const next = order[index % order.length];
    base[next.key] += 1;
    remaining -= 1;
    index += 1;
  }

  return base;
}

function getSecurityBand(stats) {
  const accuracy = Number(stats?.accuracy || 0);
  const firstTrySuccessRate = Number(stats?.firstTrySuccessRate || 0);
  const total = Number(stats?.total || 0);

  if (total >= 3 && accuracy >= 0.85 && firstTrySuccessRate >= 0.7) return "secure";
  if (accuracy >= 0.6) return "nearly_secure";
  return "insecure";
}

function getAttemptIdentity(attempt) {
  const targetId = String(attempt?.assignment_target_id || "").trim();
  if (targetId) return `target:${targetId}`;
  const testWordId = String(attempt?.test_word_id || "").trim();
  if (testWordId) return `word:${testWordId}`;
  const word = normalizeWord(attempt?.word_text || "");
  return word ? `text:${word}` : "";
}

export function analyticsTargetForAttempt(attempt, resolvedWordMap = null) {
  const focus = normalizeToken(attempt?.focus_grapheme);
  if (focus) return focus;

  const targetGraphemes = Array.isArray(attempt?.target_graphemes)
    ? attempt.target_graphemes.map((item) => normalizeToken(item)).filter(Boolean)
    : [];
  const best = normalizeToken(chooseBestFocusGrapheme(targetGraphemes));
  if (best) return best;

  const resolved = getResolvedWordEntry(resolvedWordMap, attempt?.word_text || "");
  const resolvedFocus = normalizeToken(resolved?.focusGrapheme);
  if (resolvedFocus) return resolvedFocus;

  return normalizeToken(attempt?.pattern_type) || "general";
}

function normalizeConfusionToken(value) {
  return normalizeToken(value);
}

function getAttemptTargetGraphemes(attempt, resolvedWordMap = null) {
  const direct = Array.isArray(attempt?.target_graphemes)
    ? attempt.target_graphemes.map((item) => normalizeConfusionToken(item)).filter(Boolean)
    : [];
  if (direct.length) return direct;
  return normalizeSegments(String(attempt?.word_text || ""), [], resolvedWordMap)
    .map((item) => normalizeConfusionToken(item))
    .filter(Boolean);
}

function getAttemptTypedGraphemes(attempt, resolvedWordMap = null) {
  const typed = String(attempt?.typed || "").trim();
  if (!typed) return [];
  return normalizeSegments(typed, [], resolvedWordMap)
    .map((item) => normalizeConfusionToken(item))
    .filter(Boolean);
}

function alignGraphemeSequences(targetParts, typedParts) {
  const expected = Array.isArray(targetParts) ? targetParts : [];
  const actual = Array.isArray(typedParts) ? typedParts : [];
  const rows = expected.length;
  const cols = actual.length;
  const costs = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0));
  const moves = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill("match"));

  for (let i = 1; i <= rows; i += 1) {
    costs[i][0] = i;
    moves[i][0] = "delete";
  }
  for (let j = 1; j <= cols; j += 1) {
    costs[0][j] = j;
    moves[0][j] = "insert";
  }

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      const isMatch = expected[i - 1] === actual[j - 1];
      let bestCost = costs[i - 1][j - 1] + (isMatch ? 0 : 1);
      let bestMove = isMatch ? "match" : "substitute";

      const deleteCost = costs[i - 1][j] + 1;
      if (deleteCost < bestCost) {
        bestCost = deleteCost;
        bestMove = "delete";
      }

      const insertCost = costs[i][j - 1] + 1;
      if (insertCost < bestCost) {
        bestCost = insertCost;
        bestMove = "insert";
      }

      costs[i][j] = bestCost;
      moves[i][j] = bestMove;
    }
  }

  const alignment = [];
  let i = rows;
  let j = cols;
  while (i > 0 || j > 0) {
    const move = moves[i][j];
    if ((move === "match" || move === "substitute") && i > 0 && j > 0) {
      alignment.push({
        type: move,
        expected: expected[i - 1],
        actual: actual[j - 1],
      });
      i -= 1;
      j -= 1;
      continue;
    }
    if (move === "delete" && i > 0) {
      alignment.push({
        type: "delete",
        expected: expected[i - 1],
        actual: "",
      });
      i -= 1;
      continue;
    }
    alignment.push({
      type: "insert",
      expected: "",
      actual: actual[j - 1],
    });
    j -= 1;
  }

  return alignment.reverse();
}

function isSubmittedConfusionPair(expected, actual) {
  const expectedToken = normalizeConfusionToken(expected);
  const actualToken = normalizeConfusionToken(actual);
  if (!expectedToken || !actualToken || expectedToken === actualToken) return false;

  const expectedPhoneme = inferPhonemeFromGrapheme(expectedToken, "all");
  const actualPhoneme = inferPhonemeFromGrapheme(actualToken, "all");
  const expectedAlternatives = expectedPhoneme
    ? getPhonemeAlternativeOptions(expectedToken, expectedPhoneme, ["core", "all"])
    : [];
  const actualAlternatives = actualPhoneme
    ? getPhonemeAlternativeOptions(actualToken, actualPhoneme, ["core", "all"])
    : [];

  return expectedAlternatives.includes(actualToken) || actualAlternatives.includes(expectedToken);
}

function buildConfusionByExpected(attempts, resolvedWordMap = null) {
  const pairByKey = new Map();

  for (const attempt of attempts || []) {
    const targetParts = getAttemptTargetGraphemes(attempt, resolvedWordMap);
    const typedParts = getAttemptTypedGraphemes(attempt, resolvedWordMap);
    if (!targetParts.length || !typedParts.length) continue;

    const alignment = alignGraphemeSequences(targetParts, typedParts);
    const seenPairs = new Set();

    for (const item of alignment) {
      if (item?.type !== "substitute") continue;
      const expected = normalizeConfusionToken(item?.expected);
      const actual = normalizeConfusionToken(item?.actual);
      if (!expected || !actual || expected === actual) continue;
      if (!isSubmittedConfusionPair(expected, actual)) continue;

      const key = `${expected}::${actual}`;
      const next = pairByKey.get(key) || {
        expected,
        actual,
        attemptCount: 0,
        substitutionCount: 0,
      };
      next.substitutionCount += 1;
      if (!seenPairs.has(key)) {
        next.attemptCount += 1;
        seenPairs.add(key);
      }
      pairByKey.set(key, next);
    }
  }

  const bestByExpected = new Map();
  for (const entry of pairByKey.values()) {
    const current = bestByExpected.get(entry.expected);
    if (!current
      || entry.attemptCount > current.attemptCount
      || (entry.attemptCount === current.attemptCount && entry.substitutionCount > current.substitutionCount)
      || (
        entry.attemptCount === current.attemptCount
        && entry.substitutionCount === current.substitutionCount
        && entry.actual.localeCompare(current.actual) < 0
      )) {
      bestByExpected.set(entry.expected, entry);
    }
  }

  return bestByExpected;
}

function buildWordUsageStats(attempts) {
  const usage = new Map();

  for (const attempt of attempts || []) {
    const word = normalizeWord(attempt?.word_text || "");
    if (!word) continue;
    const current = usage.get(word) || {
      word,
      count: 0,
      incorrectCount: 0,
      lastSeenAt: 0,
    };
    current.count += 1;
    if (!attempt?.correct) current.incorrectCount += 1;
    const seenAt = new Date(attempt?.created_at || 0).getTime();
    if (Number.isFinite(seenAt)) current.lastSeenAt = Math.max(current.lastSeenAt, seenAt);
    usage.set(word, current);
  }

  return usage;
}

export function buildAutoAssignmentComposition(totalWords = ASSIGNMENT_ENGINE_DEFAULT_LENGTH) {
  const counts = buildLargestRemainderCounts(totalWords);
  return {
    totalWords: counts.review + counts.target + counts.stretch,
    review: counts.review,
    target: counts.target,
    stretch: counts.stretch,
  };
}

export function isAssignmentEngineWordRow(wordRow) {
  return normalizeToken(wordRow?.choice?.source) === ASSIGNMENT_ENGINE_WORD_SOURCE;
}

export function isFullyGeneratedAssignmentWordRows(wordRows) {
  const rows = Array.isArray(wordRows) ? wordRows.filter(Boolean) : [];
  return rows.length > 0 && rows.every(isAssignmentEngineWordRow);
}

function resolveStoredFocusGrapheme(wordRow) {
  const explicit = normalizeFocusList(wordRow?.choice?.focus_graphemes);
  if (explicit[0]) return explicit[0];
  const segments = normalizeSegments(wordRow?.word || "", wordRow?.segments);
  return normalizeToken(chooseBestFocusGrapheme(segments));
}

function buildLibraryCandidate(wordRow) {
  const word = normalizeWord(wordRow?.word || "");
  if (!word) return null;
  const segments = normalizeSegments(word, wordRow?.segments);
  if (!segments.length) return null;

  return {
    word,
    sentence: String(wordRow?.sentence || "").trim() || null,
    segments,
    focusGraphemes: normalizeFocusList([
      ...(Array.isArray(wordRow?.choice?.focus_graphemes) ? wordRow.choice.focus_graphemes : []),
      resolveStoredFocusGrapheme(wordRow),
    ]),
    originTestWordId: String(wordRow?.id || "") || null,
    originWordSource: "library",
    difficulty: getStoredDifficultyModelForWord(wordRow),
    rawChoice: wordRow?.choice && typeof wordRow.choice === "object" ? wordRow.choice : {},
  };
}

function buildAttemptHistoryCandidate(attempt, resolvedWordMap = null) {
  const word = normalizeWord(attempt?.word_text || "");
  if (!word) return null;
  const segments = normalizeSegments(word, attempt?.target_graphemes, resolvedWordMap);
  if (!segments.length) return null;
  const focus = analyticsTargetForAttempt(attempt, resolvedWordMap);

  return {
    word,
    sentence: null,
    segments,
    focusGraphemes: normalizeFocusList([focus, chooseBestFocusGrapheme(segments)]),
    originTestWordId: null,
    originWordSource: "attempt_history",
    difficulty: buildPersistedDifficultyPayload({
      word,
      graphemes: segments,
      trickyWord: false,
    }),
    rawChoice: {},
  };
}

function mergeCandidates(existing, candidate) {
  if (!existing) return candidate;
  const existingIsLibrary = existing.originWordSource === "library";
  const candidateIsLibrary = candidate.originWordSource === "library";
  const preferred = existingIsLibrary || !candidateIsLibrary ? existing : candidate;
  const secondary = preferred === existing ? candidate : existing;

  return {
    ...preferred,
    sentence: preferred.sentence || secondary.sentence || null,
    segments: preferred.segments?.length ? preferred.segments : secondary.segments,
    focusGraphemes: normalizeFocusList([
      ...(preferred.focusGraphemes || []),
      ...(secondary.focusGraphemes || []),
    ]),
    originTestWordId: preferred.originTestWordId || secondary.originTestWordId || null,
    difficulty: preferred.difficulty || secondary.difficulty || null,
    rawChoice: {
      ...(secondary.rawChoice || {}),
      ...(preferred.rawChoice || {}),
    },
  };
}

function buildCandidatePool({ teacherTests, attempts, resolvedWordMap = null }) {
  const pool = new Map();

  for (const test of teacherTests || []) {
    for (const wordRow of Array.isArray(test?.test_words) ? test.test_words : []) {
      if (isAssignmentEngineWordRow(wordRow)) continue;
      const candidate = buildLibraryCandidate(wordRow);
      if (!candidate) continue;
      pool.set(candidate.word, mergeCandidates(pool.get(candidate.word), candidate));
    }
  }

  for (const attempt of attempts || []) {
    const candidate = buildAttemptHistoryCandidate(attempt, resolvedWordMap);
    if (!candidate) continue;
    pool.set(candidate.word, mergeCandidates(pool.get(candidate.word), candidate));
  }

  return {
    candidates: Array.from(pool.values()),
    usageByWord: buildWordUsageStats(attempts),
  };
}

function buildGraphemeStats(latestAttempts, allAttempts, resolvedWordMap = null) {
  const statsByTarget = new Map();
  const attemptsByTarget = new Map();

  for (const attempt of allAttempts || []) {
    const target = analyticsTargetForAttempt(attempt, resolvedWordMap);
    if (!target || target === "general") continue;
    const next = attemptsByTarget.get(target) || [];
    next.push(attempt);
    attemptsByTarget.set(target, next);
  }

  for (const attempt of latestAttempts || []) {
    const target = analyticsTargetForAttempt(attempt, resolvedWordMap);
    if (!target || target === "general") continue;

    const current = statsByTarget.get(target) || {
      target,
      total: 0,
      correct: 0,
      incorrect: 0,
      attemptTotal: 0,
      firstTrySuccessCount: 0,
      lastSeenAt: 0,
    };

    current.total += 1;
    if (attempt?.correct) current.correct += 1;
    else current.incorrect += 1;
    current.attemptTotal += Math.max(1, Number(attempt?.attempt_number || 1));
    if (attempt?.correct && Math.max(1, Number(attempt?.attempt_number || 1)) === 1) {
      current.firstTrySuccessCount += 1;
    }
    const seenAt = new Date(attempt?.created_at || 0).getTime();
    if (Number.isFinite(seenAt)) current.lastSeenAt = Math.max(current.lastSeenAt, seenAt);
    statsByTarget.set(target, current);
  }

  return Array.from(statsByTarget.values())
    .map((item) => {
      const history = attemptsByTarget.get(item.target) || [];
      const recentHistory = [...history]
        .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
        .slice(0, 4);
      const accuracy = item.total ? item.correct / item.total : 0;
      const averageAttempts = item.total ? item.attemptTotal / item.total : 0;
      const firstTrySuccessRate = item.total ? item.firstTrySuccessCount / item.total : 0;
      const securityBand = getSecurityBand({
        total: item.total,
        accuracy,
        firstTrySuccessRate,
      });
      const recentIncorrectCount = recentHistory.filter((attempt) => !attempt?.correct).length;
      const repeatedFailure = item.total >= 2
        && firstTrySuccessRate < 0.5
        && (averageAttempts > 2 || recentIncorrectCount >= 2);

      return {
        ...item,
        accuracy,
        averageAttempts,
        firstTrySuccessRate,
        securityBand,
        recentIncorrectCount,
        repeatedFailure,
      };
    })
    .sort((a, b) => {
      const bandRank = (band) => (band === "insecure" ? 0 : band === "nearly_secure" ? 1 : 2);
      if (bandRank(a.securityBand) !== bandRank(b.securityBand)) {
        return bandRank(a.securityBand) - bandRank(b.securityBand);
      }
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      if (b.averageAttempts !== a.averageAttempts) return b.averageAttempts - a.averageAttempts;
      if (b.total !== a.total) return b.total - a.total;
      return a.target.localeCompare(b.target);
    });
}

export function buildProfileFromAttempts(attempts, resolvedWordMap = null) {
  const ordered = [...(Array.isArray(attempts) ? attempts : [])]
    .sort((a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime());
  const latestByIdentity = new Map();

  for (const attempt of ordered) {
    const key = getAttemptIdentity(attempt);
    if (!key) continue;
    latestByIdentity.set(key, attempt);
  }

  const latestAttempts = Array.from(latestByIdentity.values());
  const graphemeRows = buildGraphemeStats(latestAttempts, ordered, resolvedWordMap);
  const confusionByTarget = buildConfusionByExpected(ordered, resolvedWordMap);

  return {
    totalEvidence: latestAttempts.length,
    graphemeRows,
    concernRows: graphemeRows.filter((item) => item.securityBand !== "secure"),
    secureRows: graphemeRows.filter((item) => item.securityBand === "secure"),
    developingRows: graphemeRows.filter((item) => item.securityBand === "nearly_secure"),
    confusionByTarget,
  };
}

function getPrimaryTarget(profile, fallbackProfile) {
  const topPupilConcern = profile?.concernRows?.[0] || null;
  if (topPupilConcern && Number(topPupilConcern.total || 0) >= 2) return topPupilConcern;
  return fallbackProfile?.concernRows?.[0] || topPupilConcern || null;
}

function getUniqueTargetList(rows, exclude = []) {
  const blocked = new Set((Array.isArray(exclude) ? exclude : []).map((item) => normalizeToken(item)).filter(Boolean));
  return (Array.isArray(rows) ? rows : [])
    .map((item) => normalizeToken(item?.target))
    .filter((item) => item && !blocked.has(item))
    .filter((item, index, list) => list.indexOf(item) === index);
}

function getCandidateCoverage(candidate, grapheme) {
  const target = normalizeToken(grapheme);
  if (!target) return 0;
  if ((candidate?.focusGraphemes || []).includes(target)) return 2;
  if ((candidate?.segments || []).includes(target)) return 1;
  return 0;
}

function getCandidateDifficultyScore(candidate) {
  const score = Number(candidate?.difficulty?.coreScore ?? candidate?.difficulty?.score ?? 0);
  return Number.isFinite(score) ? score : 0;
}

function getUsageMeta(candidate, usageByWord) {
  return usageByWord.get(normalizeWord(candidate?.word || "")) || {
    count: 0,
    incorrectCount: 0,
    lastSeenAt: 0,
  };
}

function sortCandidatesForRole(candidates, {
  grapheme = "",
  role = "target",
  usageByWord = new Map(),
} = {}) {
  const cleanGrapheme = normalizeToken(grapheme);
  return [...(Array.isArray(candidates) ? candidates : [])].sort((a, b) => {
    const coverageDiff = getCandidateCoverage(b, cleanGrapheme) - getCandidateCoverage(a, cleanGrapheme);
    if (coverageDiff) return coverageDiff;

    const sentenceDiff = Number(!!b?.sentence) - Number(!!a?.sentence);
    if (sentenceDiff) return sentenceDiff;

    const usageA = getUsageMeta(a, usageByWord);
    const usageB = getUsageMeta(b, usageByWord);

    if (role === "review") {
      if (usageA.count !== usageB.count) return usageA.count - usageB.count;
      if (usageA.lastSeenAt !== usageB.lastSeenAt) return usageA.lastSeenAt - usageB.lastSeenAt;
      if (getCandidateDifficultyScore(a) !== getCandidateDifficultyScore(b)) {
        return getCandidateDifficultyScore(a) - getCandidateDifficultyScore(b);
      }
    } else if (role === "stretch") {
      if (getCandidateDifficultyScore(b) !== getCandidateDifficultyScore(a)) {
        return getCandidateDifficultyScore(b) - getCandidateDifficultyScore(a);
      }
      if (usageA.count !== usageB.count) return usageA.count - usageB.count;
    } else {
      if (usageB.incorrectCount !== usageA.incorrectCount) return usageB.incorrectCount - usageA.incorrectCount;
      const distanceA = Math.abs(getCandidateDifficultyScore(a) - 50);
      const distanceB = Math.abs(getCandidateDifficultyScore(b) - 50);
      if (distanceA !== distanceB) return distanceA - distanceB;
      if (usageA.count !== usageB.count) return usageA.count - usageB.count;
    }

    return String(a?.word || "").localeCompare(String(b?.word || ""));
  });
}

function filterCandidatesForGrapheme(candidates, grapheme, usedWords) {
  const cleanGrapheme = normalizeToken(grapheme);
  return (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => !usedWords.has(candidate.word))
    .filter((candidate) => getCandidateCoverage(candidate, cleanGrapheme) > 0);
}

function pickCandidatesByGraphemeOrder({
  count,
  graphemeOrder,
  role,
  candidates,
  usageByWord,
  usedWords,
  fallbackFilter = null,
}) {
  const selected = [];
  const order = Array.isArray(graphemeOrder) ? graphemeOrder.filter(Boolean) : [];

  for (let pass = 0; pass < Math.max(1, count * 2) && selected.length < count; pass += 1) {
    let addedOnPass = false;
    for (const grapheme of order) {
      const next = sortCandidatesForRole(
        filterCandidatesForGrapheme(candidates, grapheme, usedWords),
        { grapheme, role, usageByWord }
      )[0];
      if (!next) continue;
      usedWords.add(next.word);
      selected.push(next);
      addedOnPass = true;
      if (selected.length >= count) break;
    }
    if (!addedOnPass) break;
  }

  if (selected.length >= count) return selected;

  const fallback = sortCandidatesForRole(
    (Array.isArray(candidates) ? candidates : [])
      .filter((candidate) => !usedWords.has(candidate.word))
      .filter((candidate) => (typeof fallbackFilter === "function" ? fallbackFilter(candidate) : true)),
    { grapheme: order[0] || "", role, usageByWord }
  );

  for (const candidate of fallback) {
    usedWords.add(candidate.word);
    selected.push(candidate);
    if (selected.length >= count) break;
  }

  return selected;
}

function chooseRecognitionQuestionType(focusGrapheme) {
  const focus = normalizeToken(focusGrapheme);
  const phoneme = focus ? inferPhonemeFromGrapheme(focus, "all") : "";
  const alternatives = phoneme
    ? getPhonemeAlternativeOptions(focus, phoneme, ["core", "all"])
    : [];
  return alternatives.length ? "focus_sound" : "multiple_choice_grapheme_picker";
}

function resolveQuestionTypeForSupport(support, focusGrapheme) {
  if (support === "recognition") return "multiple_choice_grapheme_picker";
  if (support === "focus") return chooseRecognitionQuestionType(focusGrapheme);
  if (support === "supported") return "type_what_you_hear";
  return "no_support_assessment";
}

export function buildAssignmentEngineWordSignature(spec = {}) {
  const word = normalizeWord(spec.word || "");
  const sentence = String(spec.sentence || "").trim().toLowerCase();
  const segments = normalizeSegments(word, spec.segments).join("|");
  const role = normalizeToken(spec.assignmentRole || spec.assignment_role || "");
  const support = normalizeToken(spec.assignmentSupport || spec.assignment_support || "");
  const focus = normalizeToken(spec.focusGrapheme || spec.engine_focus_grapheme || "");
  const questionType = normalizeToken(spec.questionType || spec.question_type || "");
  return [word, sentence, segments, role, support, focus, questionType].join("::");
}

function buildWordSpec(candidate, {
  role,
  support = "independent",
  focusGrapheme = "",
  targetReason = "",
}) {
  const focus = normalizeToken(focusGrapheme)
    || normalizeToken(chooseBestFocusGrapheme(candidate?.focusGraphemes || candidate?.segments || []))
    || normalizeToken(candidate?.focusGraphemes?.[0] || "");
  const questionType = resolveQuestionTypeForSupport(support, focus);
  return {
    word: candidate.word,
    sentence: candidate.sentence || null,
    segments: normalizeSegments(candidate.word, candidate.segments),
    questionType,
    assignmentRole: role,
    assignmentSupport: support,
    focusGrapheme: focus,
    targetReason: targetReason || (role === "review"
      ? "review_retention"
      : role === "stretch"
        ? "stretch_probe"
        : TARGET_REASON_BY_SUPPORT[support] || "target_independent"),
    originTestWordId: candidate.originTestWordId || null,
    originWordSource: candidate.originWordSource || "library",
    difficulty: candidate.difficulty || buildPersistedDifficultyPayload({
      word: candidate.word,
      graphemes: candidate.segments,
    }),
  };
}

export function buildAssignmentEngineWordPayload(spec = {}, position = 1) {
  const word = normalizeWord(spec.word || "");
  const segments = normalizeSegments(word, spec.segments);
  const focus = normalizeToken(spec.focusGrapheme || spec.engine_focus_grapheme || chooseBestFocusGrapheme(segments));
  const difficulty = spec.difficulty || buildPersistedDifficultyPayload({
    word,
    graphemes: segments,
  });

  return {
    position,
    word,
    sentence: String(spec.sentence || "").trim() || null,
    segments,
    choice: {
      focus_graphemes: focus ? [focus] : [],
      difficulty,
      source: ASSIGNMENT_ENGINE_WORD_SOURCE,
      question_type: spec.questionType || spec.question_type || "no_support_assessment",
      assignment_role: spec.assignmentRole || spec.assignment_role || "target",
      assignment_support: spec.assignmentSupport || spec.assignment_support || "independent",
      engine_focus_grapheme: focus || "",
      origin_test_word_id: spec.originTestWordId || spec.origin_test_word_id || null,
      origin_word_source: spec.originWordSource || spec.origin_word_source || "library",
    },
  };
}

function buildPupilPlan({
  pupilId,
  profile,
  fallbackProfile,
  composition,
  pool,
  engineOptions,
}) {
  const candidates = Array.isArray(pool?.candidates) ? pool.candidates : [];
  const usageByWord = pool?.usageByWord instanceof Map ? pool.usageByWord : new Map();
  const usedWords = new Set();
  const effectiveEngineOptions = engineOptions && typeof engineOptions === "object"
    ? engineOptions
    : buildAutoAssignEngineOptions();

  const primaryTargetRow = getPrimaryTarget(profile, fallbackProfile);
  const primaryTarget = normalizeToken(primaryTargetRow?.target);
  if (!primaryTarget) {
    return {
      pupilId,
      missingGraphemes: [],
      words: [],
      error: "No grapheme focus could be identified from current evidence.",
    };
  }

  const baseNonIndependentLimit = composition.target >= 4 ? 2 : 1;
  const reservedPrimarySlots = Math.min(composition.target, Math.max(2, composition.target - 1));
  const primaryCoverage = filterCandidatesForGrapheme(candidates, primaryTarget, new Set())
    .map((candidate) => candidate.word)
    .filter((word, index, list) => list.indexOf(word) === index);

  if (primaryCoverage.length < reservedPrimarySlots) {
    return {
      pupilId,
      missingGraphemes: [primaryTarget],
      words: [],
      error: `Not enough words are available for ${primaryTarget}.`,
    };
  }

  const reviewTargets = getUniqueTargetList(
    (profile?.secureRows?.length ? profile.secureRows : fallbackProfile?.secureRows) || [],
    [primaryTarget]
  );
  const stretchTargets = getUniqueTargetList(
    [
      ...(profile?.developingRows || []),
      ...((fallbackProfile?.developingRows || []).filter((item) => !profile?.developingRows?.some((own) => own.target === item.target))),
    ],
    [primaryTarget]
  );
  const secondaryTargetList = getUniqueTargetList(
    [
      ...(profile?.concernRows || []),
      ...((fallbackProfile?.concernRows || []).filter((item) => !profile?.concernRows?.some((own) => own.target === item.target))),
    ],
    [primaryTarget]
  );

  const reviewCandidates = pickCandidatesByGraphemeOrder({
    count: composition.review,
    graphemeOrder: reviewTargets,
    role: "review",
    candidates,
    usageByWord,
    usedWords,
    fallbackFilter: (candidate) => !candidate.segments.includes(primaryTarget),
  }).map((candidate) => buildWordSpec(candidate, {
    role: "review",
    support: "independent",
    focusGrapheme: chooseBestFocusGrapheme(candidate.segments) || candidate.focusGraphemes?.[0] || "",
    targetReason: "review_retention",
  }));

  if (reviewCandidates.length < composition.review) {
    return {
      pupilId,
      missingGraphemes: [],
      words: [],
      error: "Not enough candidate words are available to build the review section.",
    };
  }

  const primaryTargetCandidates = pickCandidatesByGraphemeOrder({
    count: reservedPrimarySlots,
    graphemeOrder: [primaryTarget],
    role: "target",
    candidates,
    usageByWord,
    usedWords,
  });

  const remainingTargetCandidates = pickCandidatesByGraphemeOrder({
    count: Math.max(0, composition.target - primaryTargetCandidates.length),
    graphemeOrder: [primaryTarget, ...secondaryTargetList],
    role: "target",
    candidates,
    usageByWord,
    usedWords,
    fallbackFilter: () => true,
  });

  const targetCandidates = [...primaryTargetCandidates, ...remainingTargetCandidates].slice(0, composition.target);
  if (targetCandidates.length < composition.target) {
    return {
      pupilId,
      missingGraphemes: [],
      words: [],
      error: "Not enough candidate words are available to build the target section.",
    };
  }

  const confusion = profile?.confusionByTarget?.get(primaryTarget) || fallbackProfile?.confusionByTarget?.get(primaryTarget) || null;
  const repeatedFailure = !!(profile?.concernRows || []).find((item) => item.target === primaryTarget && item.repeatedFailure)
    || !!(fallbackProfile?.concernRows || []).find((item) => item.target === primaryTarget && item.repeatedFailure);

  const targetSpecs = targetCandidates.map((candidate) => buildWordSpec(candidate, {
    role: "target",
    support: "independent",
    focusGrapheme: (candidate.segments || []).includes(primaryTarget) || (candidate.focusGraphemes || []).includes(primaryTarget)
      ? primaryTarget
      : chooseBestFocusGrapheme(candidate.segments) || candidate.focusGraphemes?.[0] || primaryTarget,
    targetReason: "target_independent",
  }));

  const minimumIndependentTargetItems = Math.max(
    0,
    Math.min(
      targetSpecs.length,
      Number(effectiveEngineOptions.minimumIndependentTargetItems || 0),
    ),
  );
  let nonIndependentLimit = effectiveEngineOptions.allowConfusionSubstitution || effectiveEngineOptions.allowSupportedSubstitution
    ? baseNonIndependentLimit + Math.max(0, Number(effectiveEngineOptions.extraTargetSupportSlots || 0))
    : 0;
  nonIndependentLimit = Math.max(
    0,
    Math.min(
      targetSpecs.length - minimumIndependentTargetItems,
      nonIndependentLimit,
    ),
  );
  let nonIndependentUsed = 0;
  if (
    effectiveEngineOptions.allowConfusionSubstitution
    && confusion
    && Number(confusion.attemptCount || 0) >= 2
    && targetSpecs.length
    && nonIndependentUsed < nonIndependentLimit
  ) {
    const focusSupport = chooseRecognitionQuestionType(primaryTarget) === "focus_sound" ? "focus" : "recognition";
    targetSpecs[0] = {
      ...targetSpecs[0],
      assignmentSupport: focusSupport,
      questionType: resolveQuestionTypeForSupport(focusSupport, primaryTarget),
      targetReason: "target_confusion",
    };
    nonIndependentUsed += 1;
  }

  if (
    effectiveEngineOptions.allowSupportedSubstitution
    && repeatedFailure
    && targetSpecs.length > nonIndependentUsed
    && nonIndependentUsed < nonIndependentLimit
  ) {
    const supportedIndex = targetSpecs.findIndex((item) => item.assignmentSupport === "independent");
    if (supportedIndex >= 0) {
      targetSpecs[supportedIndex] = {
        ...targetSpecs[supportedIndex],
        assignmentSupport: "supported",
        questionType: "type_what_you_hear",
        targetReason: "target_supported",
      };
      nonIndependentUsed += 1;
    }
  }

  if (
    effectiveEngineOptions.supportPreset === "more_support_when_needed"
    && (confusion || repeatedFailure)
    && nonIndependentUsed < nonIndependentLimit
  ) {
    const supportedIndex = targetSpecs.findIndex((item) => item.assignmentSupport === "independent");
    if (supportedIndex >= 0) {
      targetSpecs[supportedIndex] = {
        ...targetSpecs[supportedIndex],
        assignmentSupport: "supported",
        questionType: "type_what_you_hear",
        targetReason: "target_supported",
      };
      nonIndependentUsed += 1;
    }
  }

  const stretchCandidates = pickCandidatesByGraphemeOrder({
    count: composition.stretch,
    graphemeOrder: stretchTargets,
    role: "stretch",
    candidates,
    usageByWord,
    usedWords,
    fallbackFilter: (candidate) => !candidate.segments.includes(primaryTarget),
  });

  if (stretchCandidates.length < composition.stretch) {
    return {
      pupilId,
      missingGraphemes: [],
      words: [],
      error: "Not enough candidate words are available to build the stretch section.",
    };
  }

  const stretchSpecs = stretchCandidates.map((candidate) => buildWordSpec(candidate, {
    role: "stretch",
    support: "independent",
    focusGrapheme: chooseBestFocusGrapheme(candidate.segments) || primaryTarget,
    targetReason: "stretch_probe",
  }));

  return {
    pupilId,
    primaryTargetGrapheme: primaryTarget,
    words: [...reviewCandidates, ...targetSpecs, ...stretchSpecs],
    missingGraphemes: [],
  };
}

function extractAttemptsForPupil(attempts, pupilId) {
  const key = String(pupilId || "");
  return (Array.isArray(attempts) ? attempts : []).filter((attempt) => String(attempt?.pupil_id || "") === key);
}

function normalizePupilList(pupilIds) {
  return [...new Set(
    (Array.isArray(pupilIds) ? pupilIds : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )];
}

export function resolveAssignmentEngineFocus(words) {
  const targetWords = (Array.isArray(words) ? words : [])
    .filter((item) => normalizeToken(item?.choice?.assignment_role || item?.assignmentRole || item?.assignment_role) === "target");
  if (!targetWords.length) return "";

  const counts = new Map();
  for (const item of targetWords) {
    const focus = normalizeToken(
      item?.choice?.engine_focus_grapheme
      || item?.focusGrapheme
      || item?.engine_focus_grapheme
      || (Array.isArray(item?.choice?.focus_graphemes) ? item.choice.focus_graphemes[0] : "")
    );
    if (!focus) continue;
    counts.set(focus, (counts.get(focus) || 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked[0];
  if (!top) return "";
  const next = ranked[1];
  const minimumNeeded = Math.ceil(targetWords.length / 2);
  if (top[1] < minimumNeeded) return "";
  if (next && top[1] === next[1]) return "";
  return top[0];
}

export function buildAssignmentEnginePupilReason(words) {
  const focus = resolveAssignmentEngineFocus(words);
  if (focus) return `Today's practice focuses on ${focus}.`;
  return "A mix of review and new challenge based on your recent progress.";
}

export function buildAssignmentEngineTitle({
  className = "",
  focusGrapheme = "",
  date = new Date(),
} = {}) {
  const parts = [
    "Auto practice",
    String(className || "").trim() || "Class",
    formatDateLabel(date),
  ];
  const focus = normalizeToken(focusGrapheme);
  if (focus) parts.push(focus);
  return parts.join(" | ");
}

export function buildGeneratedAssignmentPlan({
  pupilIds = [],
  teacherTests = [],
  attempts = [],
  totalWords = ASSIGNMENT_ENGINE_DEFAULT_LENGTH,
  currentProfiles = null,
  resolvedWordMap = null,
  policy = null,
} = {}) {
  const normalizedPolicy = normalizeAutoAssignPolicy({
    ...(policy && typeof policy === "object" ? policy : {}),
    assignment_length: policy?.assignment_length ?? totalWords,
  });
  const engineOptions = buildAutoAssignEngineOptions(normalizedPolicy);
  const pupils = normalizePupilList(pupilIds);
  const composition = buildAutoAssignmentComposition(normalizedPolicy.assignment_length);
  const sortedAttempts = [...(Array.isArray(attempts) ? attempts : [])]
    .sort((a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime());
  const pool = buildCandidatePool({
    teacherTests,
    attempts: sortedAttempts,
    resolvedWordMap,
  });

  // Future baseline placement can inject a richer profile object here without changing the planner shape.
  const fallbackProfile = buildProfileFromAttempts(sortedAttempts, resolvedWordMap);
  const pupilPlans = [];
  const missingGraphemes = new Set();
  const errors = [];

  for (const pupilId of pupils) {
    const providedProfile = currentProfiles && typeof currentProfiles === "object"
      ? currentProfiles[pupilId] || currentProfiles[String(pupilId)] || null
      : null;
    const profile = providedProfile || buildProfileFromAttempts(
      extractAttemptsForPupil(sortedAttempts, pupilId),
      resolvedWordMap,
    );
    const plan = buildPupilPlan({
      pupilId,
      profile,
      fallbackProfile,
      composition,
      pool,
      engineOptions,
    });

    if (plan?.error) errors.push(plan.error);
    for (const missing of plan?.missingGraphemes || []) {
      missingGraphemes.add(missing);
    }
    if (Array.isArray(plan?.words) && plan.words.length) {
      pupilPlans.push({
        pupilId,
        primaryTargetGrapheme: plan.primaryTargetGrapheme || "",
        words: plan.words.slice(0, composition.totalWords),
      });
    }
  }

  const allTargetWords = pupilPlans.flatMap((plan) =>
    (plan.words || []).map((item) => ({
      ...item,
      choice: {
        assignment_role: item.assignmentRole,
        engine_focus_grapheme: item.focusGrapheme,
        focus_graphemes: item.focusGrapheme ? [item.focusGrapheme] : [],
      },
    }))
  );

  return {
    totalWords: composition.totalWords,
    composition,
    clearFocusGrapheme: resolveAssignmentEngineFocus(allTargetWords),
    pupilPlans,
    missingGraphemes: [...missingGraphemes],
    error: missingGraphemes.size
      ? `Not enough saved words are available for ${[...missingGraphemes].join(", ")}.`
      : (errors[0] || ""),
  };
}
