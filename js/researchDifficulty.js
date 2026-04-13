import { getPhonemeAlternativeOptions } from "./data/phonemeHelpers.js";
import { getLevelDisplayLabel } from "./reportingLabels.js?v=1.1";
import { normaliseWord, splitWordToGraphemes } from "./wordParser.js?v=1.5";

export const RESEARCH_DIFFICULTY_VERSION = "research_v2";

// Research basis:
// - Spencer (2007): phonemic length and letter/phoneme discrepancy predict spelling difficulty.
// - Saha et al. (2021): decoding difficulty is improved by grapheme-phoneme complexity and blend load.
// - Schmalz et al. (2025 review): multiletter/context-sensitive correspondences and irregularity are important.
// - Godin et al. (2021): silent letters are a meaningful source of spelling difficulty.
//
// We use these findings as feature-selection guidance. The literature does not establish a single
// classroom-standard weighting scheme for spelling tests, so v2 keeps a transparent equal-weight
// structural composite and separates contextual planning modifiers from the core score.

export const RESEARCH_DIFFICULTY_REFERENCES = [
  {
    short: "Spencer (2007)",
    title: "Predicting children's word-spelling difficulty for common English words from measures of orthographic transparency, phonemic and graphemic length and word frequency",
    link: "https://pubmed.ncbi.nlm.nih.gov/17456275/",
  },
  {
    short: "Saha et al. (2021)",
    title: "Initial validation of a measure of decoding difficulty as a unique predictor of miscues and passage reading fluency",
    link: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8011635/",
  },
  {
    short: "Schmalz et al. (2025)",
    title: "How we should measure orthographic depth: Or should we?",
    link: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12804241/",
  },
  {
    short: "Godin et al. (2021)",
    title: 'The "Sound of Silence": Sensitivity to Silent Letters in Children With and Without Developmental Language Disorder',
    link: "https://pubmed.ncbi.nlm.nih.gov/34185580/",
  },
];

export const DIFFICULTY_TARGET_OPTIONS = [
  {
    value: "any",
    label: "Any difficulty",
    description: "Keep any suitable words.",
    center: null,
    promptHint: "",
  },
  {
    value: "easier",
    label: "Foundations",
    description: "Mostly simpler spelling patterns and more familiar spellings.",
    center: 22,
    promptHint: "Prefer lower-complexity words with simpler grapheme-phoneme relationships, fewer blends, and fewer irregular spellings.",
  },
  {
    value: "core",
    label: "Core patterns",
    description: "A middle range for everyday class practice.",
    center: 45,
    promptHint: "Prefer a balanced classroom-practice range with a mix of straightforward and moderately complex spellings.",
  },
  {
    value: "stretch",
    label: "Expanding patterns",
    description: "Include broader spelling patterns and higher structural challenge.",
    center: 68,
    promptHint: "Prefer more structurally demanding spellings with multiletter graphemes, split digraphs, blends, or some irregularity.",
  },
  {
    value: "challenge",
    label: "Advanced patterns",
    description: "Aim for the highest structural difficulty in the current word list model.",
    center: 84,
    promptHint: "Prefer high-complexity words with several demanding spelling features, including irregular or less transparent correspondences.",
  },
];

const CONTEXT_SENSITIVE_GRAPHEMES = new Set([
  "c",
  "g",
  "ea",
  "ow",
  "ou",
  "oo",
  "ie",
  "er",
  "ir",
  "ur",
  "or",
  "ar",
  "y",
  "s",
]);

const VOWELISH_GRAPHEMES = new Set([
  "a",
  "e",
  "i",
  "o",
  "u",
  "y",
  "ai",
  "ay",
  "ea",
  "ee",
  "igh",
  "oa",
  "oe",
  "ow",
  "oi",
  "oy",
  "oo",
  "ou",
  "ue",
  "ew",
  "ie",
  "er",
  "ir",
  "ur",
  "or",
  "ar",
  "air",
  "ear",
  "ure",
  "a-e",
  "e-e",
  "i-e",
  "o-e",
  "u-e",
]);

const DIRECT_DOUBLE_PHONEME_GRAPHEMES = new Map([
  ["x", 2],
]);

const ODD_PATTERN_MATCHERS = [
  /tch/,
  /dge/,
  /tion/,
  /sion/,
  /ph/,
  /augh/,
  /ough/,
  /eigh/,
];

const MORPHOLOGY_PREFIXES = ["non", "sub", "dis", "mis", "pre", "un", "re"];
const MORPHOLOGY_SUFFIXES = ["tion", "sion", "less", "ment", "ness", "able", "ful", "est", "ing", "ly", "al", "er", "ed", "es", "s"];
const TRICKY_WORD_ADJUSTMENT = 6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeStringArray(items, limit = Infinity) {
  return (Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function countLetters(word) {
  return String(word || "").replace(/[^a-z]/g, "").length;
}

function hasVowel(value) {
  return /[aeiouy]/.test(String(value || ""));
}

function getSplitDigraphCount(graphemes) {
  return (Array.isArray(graphemes) ? graphemes : []).filter((item) => String(item || "").includes("-")).length;
}

function getMultiletterGraphemeCount(graphemes) {
  return (Array.isArray(graphemes) ? graphemes : [])
    .filter((item) => String(item || "").replace(/-/g, "").length > 1)
    .length;
}

function isVowelishGrapheme(grapheme) {
  const clean = String(grapheme || "").trim().toLowerCase();
  if (!clean) return false;
  if (VOWELISH_GRAPHEMES.has(clean)) return true;
  return /[aeiouy]/.test(clean);
}

function countBlendLoad(graphemes) {
  let runningConsonants = 0;
  let blendLoad = 0;

  for (const grapheme of Array.isArray(graphemes) ? graphemes : []) {
    if (isVowelishGrapheme(grapheme)) {
      if (runningConsonants > 1) blendLoad += runningConsonants - 1;
      runningConsonants = 0;
      continue;
    }
    runningConsonants += 1;
  }

  if (runningConsonants > 1) blendLoad += runningConsonants - 1;
  return blendLoad;
}

function countContextSensitiveGraphemes(graphemes) {
  return (Array.isArray(graphemes) ? graphemes : [])
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => CONTEXT_SENSITIVE_GRAPHEMES.has(item))
    .length;
}

function countAlternativeMappingGraphemes(graphemes) {
  return (Array.isArray(graphemes) ? graphemes : [])
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
    .filter((item) => getPhonemeAlternativeOptions(item, null, ["core", "all"]).length > 0)
    .length;
}

function countOddPatterns(word) {
  const clean = String(word || "").trim().toLowerCase();
  return ODD_PATTERN_MATCHERS.reduce((count, matcher) => count + (matcher.test(clean) ? 1 : 0), 0);
}

function buildSilentPatternSummary(word, graphemes) {
  const cleanWord = String(word || "").trim().toLowerCase();
  const silentTags = [];

  for (const grapheme of Array.isArray(graphemes) ? graphemes : []) {
    if (String(grapheme || "").includes("-")) {
      silentTags.push("split_digraph_silent_e");
    }
  }

  if (/^(kn|wr|gn|ps)/.test(cleanWord)) silentTags.push("silent_initial_letter");
  if (/[aeiou]gh(?:t|$)/.test(cleanWord)) silentTags.push("silent_gh");
  if (/mb$/.test(cleanWord)) silentTags.push("silent_b");

  return {
    count: new Set(silentTags).size,
    tags: Array.from(new Set(silentTags)),
  };
}

function estimatePhonemeCount(graphemes, silentTags) {
  let phonemeCount = 0;
  const tokens = Array.isArray(graphemes) ? graphemes : [];

  for (const grapheme of tokens) {
    const clean = String(grapheme || "").trim().toLowerCase();
    if (!clean) continue;

    if (clean.includes("-")) {
      phonemeCount += 1;
      continue;
    }

    if (clean === "gh" && silentTags.includes("silent_gh")) continue;
    if (clean === "b" && silentTags.includes("silent_b")) continue;
    if ((clean === "kn" || clean === "wr" || clean === "gn" || clean === "ps") && silentTags.includes("silent_initial_letter")) {
      phonemeCount += 1;
      continue;
    }

    phonemeCount += DIRECT_DOUBLE_PHONEME_GRAPHEMES.get(clean) || 1;
  }

  return Math.max(1, phonemeCount);
}

function normalizeComponent(raw, max) {
  return clamp(Number(raw || 0) / Math.max(1, Number(max || 1)), 0, 1);
}

function findConservativePrefix(cleanWord) {
  for (const prefix of MORPHOLOGY_PREFIXES) {
    if (!cleanWord.startsWith(prefix)) continue;
    const stem = cleanWord.slice(prefix.length);
    if (stem.length < 3) continue;
    if (!hasVowel(stem)) continue;
    return prefix;
  }
  return null;
}

function isLikelySuffixMatch(word, suffix, stem) {
  if (stem.length < 3) return false;
  if (!hasVowel(stem)) return false;
  if (suffix === "s" && /ss$/.test(word)) return false;
  return true;
}

function findConservativeSuffix(cleanWord) {
  for (const suffix of MORPHOLOGY_SUFFIXES) {
    if (!cleanWord.endsWith(suffix)) continue;
    const stem = cleanWord.slice(0, cleanWord.length - suffix.length);
    if (!isLikelySuffixMatch(cleanWord, suffix, stem)) continue;
    return suffix;
  }
  return null;
}

function detectMorphology(cleanWord) {
  if (!cleanWord) {
    return {
      prefixCount: 0,
      suffixCount: 0,
      estimatedMorphemeCount: 0,
      matchedPrefixes: [],
      matchedSuffixes: [],
    };
  }

  const prefix = findConservativePrefix(cleanWord);
  const remainder = prefix ? cleanWord.slice(prefix.length) : cleanWord;
  const suffix = findConservativeSuffix(remainder);
  const matchedPrefixes = prefix ? [prefix] : [];
  const matchedSuffixes = suffix ? [suffix] : [];
  const prefixCount = matchedPrefixes.length;
  const suffixCount = matchedSuffixes.length;

  return {
    prefixCount,
    suffixCount,
    estimatedMorphemeCount: 1 + prefixCount + suffixCount,
    matchedPrefixes,
    matchedSuffixes,
  };
}

function buildStructuralReasons({
  splitDigraphCount,
  multiletterCount,
  blendLoad,
  silentSummary,
  matchedPrefixes,
  matchedSuffixes,
  phonemeCount,
}) {
  const reasons = [];

  if (splitDigraphCount) reasons.push(splitDigraphCount === 1 ? "split digraph" : `${splitDigraphCount} split digraphs`);
  if (multiletterCount >= 2) reasons.push("multiple multiletter graphemes");
  else if (multiletterCount === 1) reasons.push("a multiletter grapheme");
  if (blendLoad) reasons.push(blendLoad === 1 ? "a consonant blend or cluster" : `${blendLoad} blend or cluster steps`);
  if (silentSummary.count) reasons.push(silentSummary.count === 1 ? "a silent-letter pattern" : `${silentSummary.count} silent-letter patterns`);

  if (matchedPrefixes.length || matchedSuffixes.length) {
    const parts = [];
    if (matchedPrefixes.length) parts.push(matchedPrefixes.map((item) => `${item}-`).join(", "));
    if (matchedSuffixes.length) parts.push(matchedSuffixes.map((item) => `-${item}`).join(", "));
    reasons.push(parts.length === 1 ? `a clear affix pattern (${parts[0]})` : `clear affix patterns (${parts.join(" and ")})`);
  }

  if (!reasons.length && phonemeCount >= 5) reasons.push("a longer phoneme sequence");
  return reasons.slice(0, 3);
}

function buildRuntimeDifficultyModel({
  coreScore = 0,
  adjustedScore = 0,
  reasons = [],
  modifierReasons = [],
  features = {},
  components = {},
  modifiers = {},
  flags = {},
} = {}) {
  const safeCoreScore = clamp(Math.round(Number(coreScore || 0)), 0, 100);
  const safeAdjustedScore = clamp(Math.round(Number(adjustedScore || 0)), 0, 100);
  const band = getDifficultyBand(safeAdjustedScore);
  const coreBand = getDifficultyBand(safeCoreScore);
  const trickyWordFlag = !!flags?.tricky_word || !!features?.trickyWord;

  return {
    version: RESEARCH_DIFFICULTY_VERSION,
    coreScore: safeCoreScore,
    adjustedScore: safeAdjustedScore,
    score: safeAdjustedScore,
    band,
    coreBand,
    label: band.label,
    coreLabel: coreBand.label,
    reasons: normalizeStringArray(reasons, 3),
    modifierReasons: normalizeStringArray(modifierReasons, 3),
    features: {
      ...features,
      trickyWord: trickyWordFlag,
    },
    components: {
      ...components,
    },
    modifiers: {
      trickyWordDelta: Number.isFinite(Number(modifiers?.trickyWordDelta)) ? Number(modifiers.trickyWordDelta) : 0,
      totalAdjustment: Number.isFinite(Number(modifiers?.totalAdjustment)) ? Number(modifiers.totalAdjustment) : 0,
    },
    flags: {
      tricky_word: trickyWordFlag,
    },
  };
}

function isStoredV2DifficultyComplete(stored) {
  return !!stored
    && stored.version === RESEARCH_DIFFICULTY_VERSION
    && Number.isFinite(Number(stored.coreScore))
    && Number.isFinite(Number(stored.adjustedScore))
    && Number.isFinite(Number(stored?.components?.morphology))
    && Number.isFinite(Number(stored?.features?.prefixCount))
    && Number.isFinite(Number(stored?.features?.suffixCount))
    && Number.isFinite(Number(stored?.modifiers?.totalAdjustment));
}

function normalizeStoredV2DifficultyModel(stored) {
  return buildRuntimeDifficultyModel({
    coreScore: stored.coreScore,
    adjustedScore: stored.adjustedScore,
    reasons: stored.reasons,
    modifierReasons: stored.modifierReasons,
    features: stored.features || {},
    components: stored.components || {},
    modifiers: stored.modifiers || {},
    flags: stored.flags || { tricky_word: !!stored?.features?.trickyWord },
  });
}

export function getDifficultyBand(score) {
  const value = clamp(Math.round(Number(score || 0)), 0, 100);
  if (value >= 80) return { key: "challenge", label: "Challenge", tone: "challenge" };
  if (value >= 60) return { key: "stretch", label: "Stretch", tone: "stretch" };
  if (value >= 35) return { key: "core", label: "Core", tone: "core" };
  return { key: "easier", label: "Easier", tone: "easier" };
}

export function getDifficultyDisplayLabel(key) {
  return getLevelDisplayLabel(key);
}

export function getDifficultyDisplayBand(bandLike) {
  if (!bandLike) return null;
  const band = typeof bandLike === "number" ? getDifficultyBand(bandLike) : bandLike;
  const key = String(band?.key || "").trim().toLowerCase();
  if (!key) return null;
  return {
    ...band,
    label: getDifficultyDisplayLabel(key),
  };
}

export function getDifficultyTargetOption(value) {
  const key = String(value || "").trim().toLowerCase();
  return DIFFICULTY_TARGET_OPTIONS.find((item) => item.value === key) || DIFFICULTY_TARGET_OPTIONS[0];
}

export function buildWordDifficultyModel({
  word = "",
  graphemes = null,
  trickyWord = false,
} = {}) {
  const cleanWord = normaliseWord(word);
  const normalizedGraphemes = Array.isArray(graphemes) && graphemes.length
    ? graphemes.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : splitWordToGraphemes(cleanWord);
  const splitDigraphCount = getSplitDigraphCount(normalizedGraphemes);
  const multiletterCount = getMultiletterGraphemeCount(normalizedGraphemes);
  const contextSensitiveCount = countContextSensitiveGraphemes(normalizedGraphemes);
  const alternativeMappingCount = countAlternativeMappingGraphemes(normalizedGraphemes);
  const blendLoad = countBlendLoad(normalizedGraphemes);
  const oddPatternCount = countOddPatterns(cleanWord);
  const silentSummary = buildSilentPatternSummary(cleanWord, normalizedGraphemes);
  const letterCount = countLetters(cleanWord);
  const phonemeCount = estimatePhonemeCount(normalizedGraphemes, silentSummary.tags);
  const discrepancy = Math.abs(letterCount - phonemeCount);
  const morphology = detectMorphology(cleanWord);

  const components = {
    phonemicLength: normalizeComponent(Math.max(0, phonemeCount - 3), 5),
    letterSoundDiscrepancy: normalizeComponent(discrepancy, 4),
    gpcComplexity: normalizeComponent(
      multiletterCount + splitDigraphCount + contextSensitiveCount + (alternativeMappingCount * 0.5),
      5,
    ),
    blendLoad: normalizeComponent(blendLoad, 3),
    irregularity: normalizeComponent(silentSummary.count + oddPatternCount, 4),
    morphology: normalizeComponent(morphology.prefixCount + morphology.suffixCount, 2),
  };

  const coreScore = Math.round(
    ((components.phonemicLength
      + components.letterSoundDiscrepancy
      + components.gpcComplexity
      + components.blendLoad
      + components.irregularity
      + components.morphology) / 6) * 100
  );

  const modifiers = {
    trickyWordDelta: trickyWord ? TRICKY_WORD_ADJUSTMENT : 0,
    totalAdjustment: trickyWord ? TRICKY_WORD_ADJUSTMENT : 0,
  };
  const adjustedScore = clamp(Math.round(coreScore + modifiers.totalAdjustment), 0, 100);
  const reasons = buildStructuralReasons({
    splitDigraphCount,
    multiletterCount,
    blendLoad,
    silentSummary,
    matchedPrefixes: morphology.matchedPrefixes,
    matchedSuffixes: morphology.matchedSuffixes,
    phonemeCount,
  });
  const modifierReasons = trickyWord ? ["teacher-marked tricky word"] : [];

  return buildRuntimeDifficultyModel({
    coreScore,
    adjustedScore,
    reasons,
    modifierReasons,
    features: {
      letterCount,
      graphemeCount: normalizedGraphemes.length,
      phonemeCount,
      discrepancy,
      splitDigraphCount,
      multiletterCount,
      contextSensitiveCount,
      alternativeMappingCount,
      blendLoad,
      silentLetterCount: silentSummary.count,
      oddPatternCount,
      prefixCount: morphology.prefixCount,
      suffixCount: morphology.suffixCount,
      estimatedMorphemeCount: morphology.estimatedMorphemeCount,
      matchedPrefixes: morphology.matchedPrefixes,
      matchedSuffixes: morphology.matchedSuffixes,
      trickyWord: !!trickyWord,
    },
    components: {
      phonemicLength: round(components.phonemicLength, 3),
      letterSoundDiscrepancy: round(components.letterSoundDiscrepancy, 3),
      gpcComplexity: round(components.gpcComplexity, 3),
      blendLoad: round(components.blendLoad, 3),
      irregularity: round(components.irregularity, 3),
      morphology: round(components.morphology, 3),
    },
    modifiers,
    flags: {
      tricky_word: !!trickyWord,
    },
  });
}

export function getStoredDifficultyModelForWord(wordRow) {
  const stored = wordRow?.choice?.difficulty;
  if (isStoredV2DifficultyComplete(stored)) {
    return normalizeStoredV2DifficultyModel(stored);
  }

  return buildWordDifficultyModel({
    word: wordRow?.word || "",
    graphemes: Array.isArray(wordRow?.segments) ? wordRow.segments : null,
    trickyWord: !!wordRow?.choice?.difficulty?.flags?.tricky_word || !!wordRow?.choice?.difficulty?.features?.trickyWord,
  });
}

export function buildPersistedDifficultyPayload({
  word = "",
  graphemes = null,
  trickyWord = false,
} = {}) {
  const model = buildWordDifficultyModel({ word, graphemes, trickyWord });
  return {
    version: model.version,
    coreScore: model.coreScore,
    adjustedScore: model.adjustedScore,
    score: model.score,
    band: model.band.key,
    coreBand: model.coreBand.key,
    label: model.label,
    coreLabel: model.coreLabel,
    reasons: model.reasons,
    modifierReasons: model.modifierReasons,
    flags: {
      tricky_word: !!trickyWord,
    },
    features: model.features,
    components: model.components,
    modifiers: model.modifiers,
  };
}

export function buildTestDifficultySummary(rows) {
  const validRows = (Array.isArray(rows) ? rows : []).filter((row) => String(row?.word || "").trim());
  if (!validRows.length) {
    return {
      coreScore: null,
      adjustedScore: null,
      score: null,
      band: null,
      coreBand: null,
      wordCount: 0,
      wordModels: [],
    };
  }

  const wordModels = validRows.map((row) => ({
    word: String(row?.word || ""),
    model: getStoredDifficultyModelForWord(row),
  }));

  const totalCore = wordModels.reduce((sum, item) => sum + Number(item?.model?.coreScore || item?.model?.score || 0), 0);
  const totalAdjusted = wordModels.reduce((sum, item) => sum + Number(item?.model?.adjustedScore || item?.model?.score || 0), 0);
  const coreScore = Math.round(totalCore / wordModels.length);
  const adjustedScore = Math.round(totalAdjusted / wordModels.length);

  return {
    coreScore,
    adjustedScore,
    score: adjustedScore,
    band: getDifficultyBand(adjustedScore),
    coreBand: getDifficultyBand(coreScore),
    wordCount: wordModels.length,
    wordModels,
  };
}

export function describeTeacherDifficultyScore() {
  return "This score estimates how structurally demanding the words in the test are likely to be to spell. The app now separates core structural difficulty from contextual planning modifiers. Core structural difficulty is used for attainment measurement, while adjusted difficulty helps with teacher planning and word selection.";
}

export function describeTechnicalDifficultyScore() {
  return "The research-based difficulty model combines phonemic length, letter-sound discrepancy, grapheme-phoneme complexity, blend load, irregularity, and conservative morphology detection into a core structural score. Contextual modifiers such as teacher-marked tricky words are stored separately and may adjust teacher-facing planning difficulty, but they do not change the core attainment difficulty used by the measurement model. Word frequency is noted in the literature, but it is not included here because the app does not yet store a validated frequency corpus.";
}
