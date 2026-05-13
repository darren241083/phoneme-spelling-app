import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..");
const sourcePath = path.join(repoRoot, "data", "wordloom-core-bank-v1.json");
const PHASE_7B_SOURCE_VERSION = "wordloom_core_v1_phase_7b_2026_05_13";
const EXPECTED_PHASE_7B_COUNTS = new Map([
  ["ay", 8],
  ["ea", 8],
  ["ew", 8],
  ["tch", 8],
  ["air", 4],
  ["au", 4],
]);

const TARGET_REQUIRED_FIELDS = [
  "focus_grapheme",
  "display_label",
  "stage_band",
  "challenge_band",
  "sort_order",
  "is_active",
];
const WORD_REQUIRED_FIELDS = [
  "word",
  "normalised_word",
  "grapheme_segments",
  "focus_graphemes",
  "primary_focus_grapheme",
  "stage_band",
  "difficulty_score",
  "difficulty_label",
  "difficulty_reason",
  "sentence",
  "meaning",
  "approval_status",
  "suitability_status",
  "source",
  "source_version",
  "is_active",
  "target_links",
];
const TARGET_ROLE_VALUES = new Set(["primary", "secondary", "incidental"]);
const ACTIVE_TARGET_LINK_ROLES = new Set(["primary", "secondary"]);
const PLACEHOLDER_PATTERNS = [
  /\bplaceholder\b/i,
  /\btbd\b/i,
  /\btodo\b/i,
  /\blorem\b/i,
  /\bsample sentence\b/i,
  /\bexample sentence\b/i,
  /\bmeaning goes here\b/i,
  /\bdefinition goes here\b/i,
  /\bneeds review\b/i,
];
const EXPLICIT_HINT_PATTERNS = [
  /\bgrapheme\b/i,
  /\bfocus sound\b/i,
  /\btarget sound\b/i,
  /\bspelling pattern\b/i,
];

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isNonEmptyText(value) {
  return String(value || "").trim().length > 0;
}

function assertHasFields(row, fields, label) {
  for (const field of fields) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(row, field),
      true,
      `${label} is missing ${field}.`,
    );
  }
}

function hasPlaceholderText(value = "") {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(String(value || "")));
}

function isWeakContext(value = "") {
  const clean = String(value || "").trim();
  return clean.length > 0 && clean.length < 12;
}

function hasExplicitHintText(value = "") {
  return EXPLICIT_HINT_PATTERNS.some((pattern) => pattern.test(String(value || "")));
}

function isCircularMeaning(word, meaning) {
  const cleanWord = normalizeText(word);
  const cleanMeaning = normalizeText(meaning)
    .replace(/[.?!]+$/g, "")
    .replace(/\s+/g, " ");
  return cleanMeaning === cleanWord
    || cleanMeaning === `to ${cleanWord}`
    || cleanMeaning === `a ${cleanWord}`
    || cleanMeaning === `an ${cleanWord}`
    || cleanMeaning === `the ${cleanWord}`;
}

function difficultyBandForScore(score) {
  const value = Number(score);
  if (value >= 55) return "stretch";
  if (value >= 35) return "core";
  return "easier";
}

function countDifficultyWindows(words, windows) {
  const counts = Object.fromEntries(
    Object.keys(windows).map((key) => [key, 0]),
  );
  for (const word of words) {
    const score = Number(word?.difficulty_score);
    for (const [key, window] of Object.entries(windows)) {
      if (score >= Number(window?.min) && score <= Number(window?.max)) {
        counts[key] += 1;
      }
    }
  }
  return counts;
}

function buildValidationReport(source) {
  const errors = [];
  const warnings = [];
  const metadata = source?.metadata && typeof source.metadata === "object" ? source.metadata : null;
  const targets = Array.isArray(source?.targets) ? source.targets : [];
  const words = Array.isArray(source?.words) ? source.words : [];
  const targetByKey = new Map();
  const activeTargetKeys = new Set();
  const normalisedWords = new Set();
  const duplicateNormalisedWords = new Set();
  const primaryWordsByTarget = new Map();
  const activeApprovedSuitableWords = [];
  const difficultyWindows = metadata?.difficulty_windows && typeof metadata.difficulty_windows === "object"
    ? metadata.difficulty_windows
    : {};
  const phase7BPrimaryCounts = Object.fromEntries(
    [...EXPECTED_PHASE_7B_COUNTS.keys()].map((focus) => [focus, 0]),
  );
  const phase7BWords = [];

  if (!metadata) errors.push("metadata_missing");
  if (!isNonEmptyText(metadata?.schema_version)) errors.push("metadata_schema_version_missing");
  if (!isNonEmptyText(metadata?.source_version)) errors.push("metadata_source_version_missing");
  if (!Array.isArray(targets) || !targets.length) errors.push("targets_missing");
  if (!Array.isArray(words) || !words.length) errors.push("words_missing");

  for (const [index, target] of targets.entries()) {
    const label = `target[${index}]`;
    assertHasFields(target, TARGET_REQUIRED_FIELDS, label);
    const focus = normalizeText(target.focus_grapheme);
    if (!focus) errors.push(`${label}_focus_grapheme_missing`);
    if (focus !== String(target.focus_grapheme || "").trim()) errors.push(`${label}_focus_grapheme_not_normalized`);
    if (targetByKey.has(focus)) errors.push(`duplicate_target_${focus}`);
    targetByKey.set(focus, target);
    if (target.is_active === true) {
      activeTargetKeys.add(focus);
      primaryWordsByTarget.set(focus, []);
    }
    if (!isNonEmptyText(target.display_label)) errors.push(`${label}_display_label_missing`);
    if (!isNonEmptyText(target.stage_band)) errors.push(`${label}_stage_band_missing`);
    if (!isNonEmptyText(target.challenge_band)) errors.push(`${label}_challenge_band_missing`);
    assert.equal(Number.isInteger(Number(target.sort_order)), true, `${label} sort_order must be numeric.`);
    assert.equal(typeof target.is_active, "boolean", `${label} is_active must be boolean.`);
  }

  for (const [index, word] of words.entries()) {
    const label = `word[${index}] ${word?.normalised_word || word?.word || ""}`.trim();
    assertHasFields(word, WORD_REQUIRED_FIELDS, label);

    const cleanWord = normalizeText(word.word);
    const normalisedWord = normalizeText(word.normalised_word);
    const segments = Array.isArray(word.grapheme_segments)
      ? word.grapheme_segments.map((item) => normalizeText(item)).filter(Boolean)
      : [];
    const focusGraphemes = Array.isArray(word.focus_graphemes)
      ? word.focus_graphemes.map((item) => normalizeText(item)).filter(Boolean)
      : [];
    const primaryFocus = normalizeText(word.primary_focus_grapheme);
    const targetLinks = Array.isArray(word.target_links) ? word.target_links : [];
    const score = Number(word.difficulty_score);
    const activeApprovedSuitable = word.is_active === true
      && normalizeText(word.approval_status) === "approved"
      && normalizeText(word.suitability_status) === "suitable";
    const isPhase7BWord = String(word.source_version || "") === PHASE_7B_SOURCE_VERSION;

    if (!cleanWord) errors.push(`${label}_word_missing`);
    if (!normalisedWord) errors.push(`${label}_normalised_word_missing`);
    if (normalisedWord && normalisedWord !== cleanWord) errors.push(`${label}_normalised_word_mismatch`);
    if (normalisedWord) {
      if (normalisedWords.has(normalisedWord)) duplicateNormalisedWords.add(normalisedWord);
      normalisedWords.add(normalisedWord);
    }
    if (!segments.length) errors.push(`${label}_segments_missing`);
    if (segments.join("") !== normalisedWord) errors.push(`${label}_segments_do_not_reconstruct_word`);
    if (!primaryFocus) errors.push(`${label}_primary_focus_missing`);
    if (primaryFocus && !segments.includes(primaryFocus)) errors.push(`${label}_primary_focus_missing_from_segments`);
    if (primaryFocus && !focusGraphemes.includes(primaryFocus)) errors.push(`${label}_primary_focus_missing_from_focus_graphemes`);
    assert.equal(Number.isFinite(score), true, `${label} difficulty_score must be numeric.`);
    if (score < 0 || score > 100) errors.push(`${label}_difficulty_score_out_of_range`);
    if (!isNonEmptyText(word.difficulty_label)) errors.push(`${label}_difficulty_label_missing`);
    if (!isNonEmptyText(word.difficulty_reason)) errors.push(`${label}_difficulty_reason_missing`);
    if (!targetLinks.length) errors.push(`${label}_target_links_missing`);

    if (activeApprovedSuitable) {
      activeApprovedSuitableWords.push(word);
      if (!isNonEmptyText(word.sentence)) errors.push(`${label}_sentence_missing`);
      if (!isNonEmptyText(word.meaning)) errors.push(`${label}_meaning_missing`);
      if (hasPlaceholderText(word.sentence)) errors.push(`${label}_sentence_placeholder`);
      if (hasPlaceholderText(word.meaning)) errors.push(`${label}_meaning_placeholder`);
    }

    if (isPhase7BWord) {
      phase7BWords.push(word);
      if (word.is_active !== true) errors.push(`${label}_phase7b_not_active`);
      if (normalizeText(word.approval_status) !== "approved") errors.push(`${label}_phase7b_not_approved`);
      if (normalizeText(word.suitability_status) !== "suitable") errors.push(`${label}_phase7b_not_suitable`);
      if (normalizeText(word.source) !== "wordloom_core") errors.push(`${label}_phase7b_wrong_source`);
      if (!EXPECTED_PHASE_7B_COUNTS.has(primaryFocus)) errors.push(`${label}_phase7b_unexpected_target_${primaryFocus || "missing"}`);
      if (isWeakContext(word.sentence)) errors.push(`${label}_phase7b_sentence_weak`);
      if (isWeakContext(word.meaning)) errors.push(`${label}_phase7b_meaning_weak`);
      if (isCircularMeaning(normalisedWord, word.meaning)) errors.push(`${label}_phase7b_meaning_circular`);
      if (hasExplicitHintText(word.sentence)) errors.push(`${label}_phase7b_sentence_spelling_hint`);
      if (phase7BPrimaryCounts[primaryFocus] !== undefined) {
        phase7BPrimaryCounts[primaryFocus] += 1;
      }
    }

    const primaryTargetLinks = [];
    for (const [linkIndex, link] of targetLinks.entries()) {
      const linkLabel = `${label}_target_link[${linkIndex}]`;
      const linkFocus = normalizeText(link?.focus_grapheme);
      const role = normalizeText(link?.target_role);
      if (!TARGET_ROLE_VALUES.has(role)) errors.push(`${linkLabel}_invalid_role`);
      if (ACTIVE_TARGET_LINK_ROLES.has(role) && !activeTargetKeys.has(linkFocus)) {
        errors.push(`${linkLabel}_unknown_or_inactive_target_${linkFocus || "missing"}`);
      }
      if ((role === "primary" || role === "secondary") && !segments.includes(linkFocus)) {
        errors.push(`${linkLabel}_focus_missing_from_segments`);
      }
      if (role === "primary") {
        primaryTargetLinks.push(link);
        const rows = primaryWordsByTarget.get(linkFocus);
        if (rows) rows.push(word);
      }
    }

    if (word.is_active === true && primaryTargetLinks.length !== 1 && word.allow_multiple_primary_target_links !== true) {
      errors.push(`${label}_active_word_primary_link_count_${primaryTargetLinks.length}`);
    }
  }

  for (const duplicate of duplicateNormalisedWords) {
    errors.push(`duplicate_normalised_word_${duplicate}`);
  }

  if (phase7BWords.length !== 40) {
    errors.push(`phase7b_word_count_${phase7BWords.length}_expected_40`);
  }
  for (const [focus, expected] of EXPECTED_PHASE_7B_COUNTS) {
    const actual = Number(phase7BPrimaryCounts[focus] || 0);
    if (actual !== expected) errors.push(`phase7b_target_${focus}_count_${actual}_expected_${expected}`);
  }

  const primaryCountsByTarget = {};
  const difficultyWindowCountsByTarget = {};
  for (const target of targets) {
    const focus = normalizeText(target.focus_grapheme);
    const targetWords = primaryWordsByTarget.get(focus) || [];
    primaryCountsByTarget[focus] = targetWords.length;
    difficultyWindowCountsByTarget[focus] = countDifficultyWindows(targetWords, difficultyWindows);
    if (target.is_active === true && targetWords.length === 0) {
      warnings.push(`target_${focus}_has_no_source_primary_words_in_phase_7a_sample`);
    }
  }

  const minimumPrimaryWords = Math.max(0, Number(metadata?.minimum_primary_words_per_active_target || 0));
  if (minimumPrimaryWords > 0) {
    for (const [focus, count] of Object.entries(primaryCountsByTarget)) {
      if (!activeTargetKeys.has(focus)) continue;
      if (count > 0 && count < minimumPrimaryWords) {
        warnings.push(`target_${focus}_below_v1_primary_goal_${count}_of_${minimumPrimaryWords}`);
      }
    }
  }

  const missingSentenceCount = activeApprovedSuitableWords.filter((word) => !isNonEmptyText(word.sentence)).length;
  const missingMeaningCount = activeApprovedSuitableWords.filter((word) => !isNonEmptyText(word.meaning)).length;
  const weakSentenceCount = activeApprovedSuitableWords.filter((word) => isWeakContext(word.sentence)).length;
  const weakMeaningCount = activeApprovedSuitableWords.filter((word) => isWeakContext(word.meaning)).length;
  const placeholderContextCount = activeApprovedSuitableWords.filter((word) =>
    hasPlaceholderText(word.sentence) || hasPlaceholderText(word.meaning)
  ).length;

  return {
    sourceVersion: String(metadata?.source_version || ""),
    sourceTargetCount: targets.length,
    sourceWordCount: words.length,
    errors,
    warnings,
    primaryCountsByTarget,
    difficultyWindowCountsByTarget,
    context: {
      missingSentenceCount,
      missingMeaningCount,
      weakSentenceCount,
      weakMeaningCount,
      placeholderContextCount,
    },
    phase7B: {
      sourceVersion: PHASE_7B_SOURCE_VERSION,
      wordCount: phase7BWords.length,
      primaryCountsByTarget: phase7BPrimaryCounts,
    },
    difficultyBands: Object.fromEntries(
      ["easier", "core", "stretch"].map((band) => [
        band,
        words.filter((word) => difficultyBandForScore(word?.difficulty_score) === band).length,
      ]),
    ),
  };
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const report = buildValidationReport(source);

assert.deepEqual(report.errors, [], `Wordloom source data errors: ${report.errors.join(", ")}`);
assert.equal(report.sourceVersion, "wordloom_core_v1_foundation_2026_05_13");
assert.equal(report.sourceTargetCount, 30);
assert.equal(report.sourceWordCount, 42);
assert.equal(report.context.missingSentenceCount, 0);
assert.equal(report.context.missingMeaningCount, 0);
assert.equal(report.context.weakSentenceCount, 0);
assert.equal(report.context.weakMeaningCount, 0);
assert.equal(report.context.placeholderContextCount, 0);
assert.equal(report.phase7B.wordCount, 40);
assert.deepEqual(report.phase7B.primaryCountsByTarget, {
  ay: 8,
  ea: 8,
  ew: 8,
  tch: 8,
  air: 4,
  au: 4,
});

console.log(`WORDLOOM_CORE_SOURCE_REPORT ${JSON.stringify({
  sourceVersion: report.sourceVersion,
  sourceTargetCount: report.sourceTargetCount,
  sourceWordCount: report.sourceWordCount,
  sourceValidationWarningCount: report.warnings.length,
  context: report.context,
  phase7B: report.phase7B,
  primaryCountsByTarget: report.primaryCountsByTarget,
  difficultyWindowCountsByTarget: report.difficultyWindowCountsByTarget,
})}`);
