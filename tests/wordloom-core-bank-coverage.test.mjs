import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadBrowserModule } from "./load-browser-module.mjs";

const EXPECTED_PROOF_TARGET_COUNT = 24;
const EXPECTED_PROOF_WORD_COUNT = 150;
const EXPECTED_PHASE_7B_TARGET_COUNT = 6;
const EXPECTED_PHASE_7B_WORD_COUNT = 40;
const EXPECTED_PHASE_7C_TARGET_COUNT = 8;
const EXPECTED_PHASE_7C_WORD_COUNT = 40;
const EXPECTED_PHASE_7D_TARGET_COUNT = 8;
const EXPECTED_PHASE_7D_WORD_COUNT = 48;
const EXPECTED_PHASE_7E_TARGET_COUNT = 16;
const EXPECTED_PHASE_7E_WORD_COUNT = 180;
const EXPECTED_PHASE_7F_TARGET_COUNT = 16;
const EXPECTED_PHASE_7F_WORD_COUNT = 180;
const EXPECTED_PHASE_7G_TARGET_COUNT = 29;
const EXPECTED_PHASE_7G_WORD_COUNT = 180;
const EXPECTED_PHASE_7H_TARGET_COUNT = 30;
const EXPECTED_PHASE_7H_WORD_COUNT = 182;
const EXPECTED_PHASE_8B_TARGET_COUNT = 9;
const EXPECTED_PHASE_8B_WORD_COUNT = 250;
const EXPECTED_PHASE_8C_TARGET_COUNT = 21;
const EXPECTED_PHASE_8C_WORD_COUNT = 250;
const EXPECTED_ASSIGNMENT_WORD_COUNT = 10;
const PROOF_SOURCE_VERSION = "wordloom_core_proof_v1";
const PHASE_7B_SOURCE_VERSION = "wordloom_core_v1_phase_7b_2026_05_13";
const PHASE_7C_SOURCE_VERSION = "wordloom_core_v1_phase_7c_2026_05_13";
const PHASE_7D_SOURCE_VERSION = "wordloom_core_v1_phase_7d_2026_05_13";
const PHASE_7E_SOURCE_VERSION = "wordloom_core_v1_phase_7e_2026_05_13";
const PHASE_7F_SOURCE_VERSION = "wordloom_core_v1_phase_7f_2026_05_13";
const PHASE_7G_SOURCE_VERSION = "wordloom_core_v1_phase_7g_2026_05_13";
const PHASE_7H_SOURCE_VERSION = "wordloom_core_v1_phase_7h_2026_05_13";
const PHASE_8B_SOURCE_VERSION = "wordloom_core_v1_phase_8b_2026_05_13";
const PHASE_8C_SOURCE_VERSION = "wordloom_core_v1_phase_8c_2026_05_14";
const EXPECTED_LOW_COVERAGE_WARNINGS = new Map();
const EXPECTED_PHASE_7B_COUNTS = new Map([
  ["ay", 8],
  ["ea", 8],
  ["ew", 8],
  ["tch", 8],
  ["air", 4],
  ["au", 4],
]);
const EXPECTED_PHASE_7C_COUNTS = new Map([
  ["aw", 8],
  ["ure", 8],
  ["ay", 4],
  ["ea", 4],
  ["ew", 4],
  ["tch", 4],
  ["air", 4],
  ["au", 4],
]);
const EXPECTED_PHASE_7D_COUNTS = new Map([
  ["ai", 6],
  ["ee", 6],
  ["oa", 6],
  ["igh", 6],
  ["or", 6],
  ["sh", 6],
  ["ch", 6],
  ["ck", 6],
]);
const EXPECTED_PHASE_7E_COUNTS = new Map([
  ["ear", 10],
  ["er", 16],
  ["oy", 10],
  ["oi", 10],
  ["ou", 14],
  ["ow", 14],
  ["th", 16],
  ["ng", 14],
  ["dge", 10],
  ["tion", 14],
  ["ur", 14],
  ["ie", 10],
  ["ci", 10],
  ["aw", 8],
  ["ure", 8],
  ["ea", 2],
]);
const EXPECTED_PHASE_7F_COUNTS = new Map([
  ["ai", 14],
  ["ee", 14],
  ["oa", 12],
  ["igh", 8],
  ["ar", 14],
  ["or", 14],
  ["sh", 12],
  ["ch", 12],
  ["ck", 12],
  ["ay", 14],
  ["ea", 14],
  ["ew", 8],
  ["air", 8],
  ["au", 8],
  ["aw", 8],
  ["tch", 8],
]);
const EXPECTED_PHASE_7G_COUNTS = new Map([
  ["ai", 6],
  ["ee", 6],
  ["oa", 4],
  ["igh", 6],
  ["ar", 6],
  ["or", 6],
  ["air", 6],
  ["ear", 8],
  ["er", 10],
  ["oy", 6],
  ["oi", 6],
  ["ou", 8],
  ["ow", 8],
  ["sh", 6],
  ["ch", 6],
  ["th", 8],
  ["ng", 8],
  ["ck", 4],
  ["dge", 6],
  ["tion", 8],
  ["ur", 8],
  ["ie", 6],
  ["ci", 4],
  ["au", 4],
  ["ay", 6],
  ["ea", 6],
  ["ew", 6],
  ["ure", 4],
  ["aw", 4],
]);
const EXPECTED_PHASE_7H_COUNTS = new Map([
  ["ai", 6],
  ["ee", 6],
  ["oa", 6],
  ["igh", 6],
  ["ar", 8],
  ["or", 6],
  ["air", 4],
  ["ear", 6],
  ["er", 8],
  ["oy", 6],
  ["oi", 6],
  ["ou", 8],
  ["ow", 8],
  ["sh", 6],
  ["ch", 6],
  ["th", 8],
  ["ng", 8],
  ["ck", 6],
  ["dge", 6],
  ["tion", 4],
  ["ur", 6],
  ["ie", 6],
  ["ci", 4],
  ["au", 4],
  ["ay", 6],
  ["ea", 6],
  ["ew", 6],
  ["ure", 4],
  ["aw", 4],
  ["tch", 8],
]);
const EXPECTED_PHASE_8B_COUNTS = new Map([
  ["ci", 32],
  ["ure", 30],
  ["dge", 30],
  ["ie", 28],
  ["oi", 30],
  ["oy", 28],
  ["tch", 26],
  ["au", 24],
  ["ear", 22],
]);
const EXPECTED_PHASE_8C_COUNTS = new Map([
  ["air", 16],
  ["aw", 16],
  ["ew", 16],
  ["igh", 16],
  ["tion", 16],
  ["ck", 14],
  ["oa", 14],
  ["ur", 14],
  ["ch", 12],
  ["ng", 12],
  ["ou", 12],
  ["ow", 12],
  ["sh", 12],
  ["ai", 10],
  ["ay", 10],
  ["ee", 10],
  ["or", 10],
  ["th", 10],
  ["ar", 6],
  ["ea", 6],
  ["er", 6],
]);
const EXPECTED_PHASE_8C_PRODUCTION_TOTALS = new Map([
  ["ai", 48],
  ["ee", 48],
  ["oa", 48],
  ["igh", 48],
  ["ar", 46],
  ["or", 48],
  ["air", 48],
  ["ear", 52],
  ["er", 46],
  ["oy", 56],
  ["oi", 58],
  ["ou", 48],
  ["ow", 48],
  ["sh", 48],
  ["ch", 48],
  ["th", 48],
  ["ng", 48],
  ["ck", 48],
  ["dge", 58],
  ["tion", 48],
  ["ur", 48],
  ["ie", 56],
  ["ci", 56],
  ["au", 54],
  ["ay", 48],
  ["ea", 46],
  ["ew", 48],
  ["ure", 54],
  ["aw", 48],
  ["tch", 54],
]);

const { buildGeneratedAssignmentPlan } = await loadBrowserModule("../js/assignmentEngine.js", import.meta.url);

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..");
const proofSetMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260508150000_wordloom_core_spelling_bank_proof_set.sql",
);
const phase7BMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260513120000_wordloom_core_spelling_bank_phase_7b_launch_batch.sql",
);
const phase7CMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260513123000_wordloom_core_spelling_bank_phase_7c_aw_ure_topups.sql",
);
const phase7DMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260513130000_wordloom_core_spelling_bank_phase_7d_proof_topups.sql",
);
const phase7EMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260513133000_wordloom_core_spelling_bank_phase_7e_bulk_topup.sql",
);
const phase7FMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260513140000_wordloom_core_spelling_bank_phase_7f_bulk_topup.sql",
);
const phase7GMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260513143000_wordloom_core_spelling_bank_phase_7g_bulk_topup.sql",
);
const phase7HMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260513150000_wordloom_core_spelling_bank_phase_7h_bulk_topup.sql",
);
const phase8BMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260513153000_wordloom_core_spelling_bank_phase_8b_structured_expansion_batch_1.sql",
);
const phase8CMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260514120000_wordloom_core_spelling_bank_phase_8c_structured_expansion_batch_2.sql",
);
const sourceDataPath = path.join(repoRoot, "data", "wordloom-core-bank-v1.json");
const SOURCE_PLACEHOLDER_PATTERNS = [
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

function findStatementEnd(source, startIndex) {
  let inQuote = false;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "'") {
      if (inQuote && source[index + 1] === "'") {
        index += 1;
        continue;
      }
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && char === ";") return index;
  }
  return -1;
}

function extractInsertValues(source, tableName) {
  const lowerSource = source.toLowerCase();
  const startIndex = lowerSource.indexOf(`insert into ${tableName.toLowerCase()}`);
  assert.notEqual(startIndex, -1, `Could not find insert statement for ${tableName}.`);

  const valuesIndex = lowerSource.indexOf("values", startIndex);
  assert.notEqual(valuesIndex, -1, `Could not find values block for ${tableName}.`);

  const endIndex = findStatementEnd(source, valuesIndex);
  assert.notEqual(endIndex, -1, `Could not find end of insert statement for ${tableName}.`);

  return source.slice(valuesIndex + "values".length, endIndex);
}

function parseSqlTuples(valuesBlock) {
  const tuples = [];
  let current = "";
  let depth = 0;
  let inQuote = false;

  for (let index = 0; index < valuesBlock.length; index += 1) {
    const char = valuesBlock[index];

    if (char === "'") {
      current += char;
      if (inQuote && valuesBlock[index + 1] === "'") {
        current += valuesBlock[index + 1];
        index += 1;
        continue;
      }
      inQuote = !inQuote;
      continue;
    }

    if (inQuote) {
      current += char;
      continue;
    }

    if (char === "(") {
      if (depth > 0) current += char;
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        tuples.push(current.trim());
        current = "";
        continue;
      }
      current += char;
      continue;
    }

    if (depth > 0) current += char;
  }

  return tuples;
}

function splitSqlFields(tupleText) {
  const fields = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;
  let inQuote = false;

  for (let index = 0; index < tupleText.length; index += 1) {
    const char = tupleText[index];

    if (char === "'") {
      current += char;
      if (inQuote && tupleText[index + 1] === "'") {
        current += tupleText[index + 1];
        index += 1;
        continue;
      }
      inQuote = !inQuote;
      continue;
    }

    if (!inQuote) {
      if (char === "[") bracketDepth += 1;
      if (char === "]") bracketDepth -= 1;
      if (char === "(") parenDepth += 1;
      if (char === ")") parenDepth -= 1;
      if (char === "," && bracketDepth === 0 && parenDepth === 0) {
        fields.push(current.trim());
        current = "";
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) fields.push(current.trim());
  return fields;
}

function unquoteSqlString(value) {
  const clean = String(value || "").trim();
  assert.equal(clean.startsWith("'"), true, `Expected SQL string, got ${clean}.`);
  assert.equal(clean.endsWith("'"), true, `Expected SQL string, got ${clean}.`);
  return clean.slice(1, -1).replace(/''/g, "'");
}

function parseSqlInteger(value) {
  const parsed = Number(String(value || "").trim());
  assert.equal(Number.isInteger(parsed), true, `Expected integer, got ${value}.`);
  return parsed;
}

function parseSqlTextArray(value) {
  return [...String(value || "").matchAll(/'((?:''|[^'])*)'/g)]
    .map((match) => match[1].replace(/''/g, "'"));
}

function parseProofTargets(source) {
  return parseSqlTuples(extractInsertValues(source, "wordloom_core_proof_targets"))
    .map((tupleText) => {
      const fields = splitSqlFields(tupleText);
      assert.equal(fields.length, 6, `Expected 6 proof target fields, got ${fields.length}.`);
      return {
        focusGrapheme: unquoteSqlString(fields[0]),
        displayLabel: unquoteSqlString(fields[1]),
        stageBand: unquoteSqlString(fields[2]),
        challengeBand: unquoteSqlString(fields[3]),
        sortOrder: parseSqlInteger(fields[4]),
        expectedPrimaryWordCount: parseSqlInteger(fields[5]),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function parseProofWords(source) {
  return parseSqlTuples(extractInsertValues(source, "wordloom_core_proof_words"))
    .map((tupleText) => {
      const fields = splitSqlFields(tupleText);
      assert.equal(fields.length, 10, `Expected 10 proof word fields, got ${fields.length}.`);
      return {
        word: unquoteSqlString(fields[0]),
        normalisedWord: unquoteSqlString(fields[1]),
        primaryFocusGrapheme: unquoteSqlString(fields[2]),
        graphemeSegments: parseSqlTextArray(fields[3]),
        stageBand: unquoteSqlString(fields[4]),
        difficultyScore: parseSqlInteger(fields[5]),
        difficultyLabel: unquoteSqlString(fields[6]),
        difficultyReason: unquoteSqlString(fields[7]),
        sentence: unquoteSqlString(fields[8]),
        meaning: unquoteSqlString(fields[9]),
      };
    });
}

function parsePhaseTargets(source, tableName, label) {
  return parseSqlTuples(extractInsertValues(source, tableName))
    .map((tupleText) => {
      const fields = splitSqlFields(tupleText);
      assert.equal(fields.length, 6, `Expected 6 ${label} target fields, got ${fields.length}.`);
      return {
        focusGrapheme: unquoteSqlString(fields[0]),
        displayLabel: unquoteSqlString(fields[1]),
        stageBand: unquoteSqlString(fields[2]),
        challengeBand: unquoteSqlString(fields[3]),
        sortOrder: parseSqlInteger(fields[4]),
        expectedPrimaryWordCount: parseSqlInteger(fields[5]),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function parsePhaseWords(source, tableName, label) {
  return parseSqlTuples(extractInsertValues(source, tableName))
    .map((tupleText) => {
      const fields = splitSqlFields(tupleText);
      assert.equal(fields.length, 16, `Expected 16 ${label} word fields, got ${fields.length}.`);
      return {
        word: unquoteSqlString(fields[0]),
        normalisedWord: unquoteSqlString(fields[1]),
        primaryFocusGrapheme: unquoteSqlString(fields[2]),
        graphemeSegments: parseSqlTextArray(fields[3]),
        focusGraphemes: parseSqlTextArray(fields[4]),
        stageBand: unquoteSqlString(fields[5]),
        difficultyScore: parseSqlInteger(fields[6]),
        difficultyLabel: unquoteSqlString(fields[7]),
        difficultyReason: unquoteSqlString(fields[8]),
        sentence: unquoteSqlString(fields[9]),
        meaning: unquoteSqlString(fields[10]),
        approvalStatus: unquoteSqlString(fields[11]),
        suitabilityStatus: unquoteSqlString(fields[12]),
        source: unquoteSqlString(fields[13]),
        sourceVersion: unquoteSqlString(fields[14]),
        active: String(fields[15]).trim().toLowerCase() === "true",
      };
    });
}

function parsePhaseWordTargets(source, tableName, label) {
  return parseSqlTuples(extractInsertValues(source, tableName))
    .map((tupleText) => {
      const fields = splitSqlFields(tupleText);
      assert.equal(fields.length, 5, `Expected 5 ${label} word-target fields, got ${fields.length}.`);
      return {
        normalisedWord: unquoteSqlString(fields[0]),
        focusGrapheme: unquoteSqlString(fields[1]),
        targetRole: unquoteSqlString(fields[2]),
        patternType: unquoteSqlString(fields[3]),
        difficultyModifier: parseSqlInteger(fields[4]),
      };
    });
}

function parsePhase7BTargets(source) {
  return parsePhaseTargets(source, "wordloom_core_phase_7b_targets", "Phase 7B");
}

function parsePhase7BWords(source) {
  return parsePhaseWords(source, "wordloom_core_phase_7b_words", "Phase 7B");
}

function parsePhase7BWordTargets(source) {
  return parsePhaseWordTargets(source, "wordloom_core_phase_7b_word_targets", "Phase 7B");
}

function parsePhase7CTargets(source) {
  return parsePhaseTargets(source, "wordloom_core_phase_7c_targets", "Phase 7C");
}

function parsePhase7CWords(source) {
  return parsePhaseWords(source, "wordloom_core_phase_7c_words", "Phase 7C");
}

function parsePhase7CWordTargets(source) {
  return parsePhaseWordTargets(source, "wordloom_core_phase_7c_word_targets", "Phase 7C");
}

function parsePhase7DTargets(source) {
  return parsePhaseTargets(source, "wordloom_core_phase_7d_targets", "Phase 7D");
}

function parsePhase7DWords(source) {
  return parsePhaseWords(source, "wordloom_core_phase_7d_words", "Phase 7D");
}

function parsePhase7DWordTargets(source) {
  return parsePhaseWordTargets(source, "wordloom_core_phase_7d_word_targets", "Phase 7D");
}

function parsePhase7ETargets(source) {
  return parsePhaseTargets(source, "wordloom_core_phase_7e_targets", "Phase 7E");
}

function parsePhase7EWords(source) {
  return parsePhaseWords(source, "wordloom_core_phase_7e_words", "Phase 7E");
}

function parsePhase7EWordTargets(source) {
  return parsePhaseWordTargets(source, "wordloom_core_phase_7e_word_targets", "Phase 7E");
}

function parsePhase7FTargets(source) {
  return parsePhaseTargets(source, "wordloom_core_phase_7f_targets", "Phase 7F");
}

function parsePhase7FWords(source) {
  return parsePhaseWords(source, "wordloom_core_phase_7f_words", "Phase 7F");
}

function parsePhase7FWordTargets(source) {
  return parsePhaseWordTargets(source, "wordloom_core_phase_7f_word_targets", "Phase 7F");
}

function parsePhase7GTargets(source) {
  return parsePhaseTargets(source, "wordloom_core_phase_7g_targets", "Phase 7G");
}

function parsePhase7GWords(source) {
  return parsePhaseWords(source, "wordloom_core_phase_7g_words", "Phase 7G");
}

function parsePhase7GWordTargets(source) {
  return parsePhaseWordTargets(source, "wordloom_core_phase_7g_word_targets", "Phase 7G");
}

function parsePhase7HTargets(source) {
  return parsePhaseTargets(source, "wordloom_core_phase_7h_targets", "Phase 7H");
}

function parsePhase7HWords(source) {
  return parsePhaseWords(source, "wordloom_core_phase_7h_words", "Phase 7H");
}

function parsePhase7HWordTargets(source) {
  return parsePhaseWordTargets(source, "wordloom_core_phase_7h_word_targets", "Phase 7H");
}

function parsePhase8BTargets(source) {
  return parsePhaseTargets(source, "wordloom_core_phase_8b_targets", "Phase 8B");
}

function parsePhase8BWords(source) {
  return parsePhaseWords(source, "wordloom_core_phase_8b_words", "Phase 8B");
}

function parsePhase8BWordTargets(source) {
  return parsePhaseWordTargets(source, "wordloom_core_phase_8b_word_targets", "Phase 8B");
}

function parsePhase8CTargets(source) {
  return parsePhaseTargets(source, "wordloom_core_phase_8c_targets", "Phase 8C");
}

function parsePhase8CWords(source) {
  return parsePhaseWords(source, "wordloom_core_phase_8c_words", "Phase 8C");
}

function parsePhase8CWordTargets(source) {
  return parsePhaseWordTargets(source, "wordloom_core_phase_8c_word_targets", "Phase 8C");
}

function difficultyBandForLabel(label = "") {
  const clean = String(label || "").trim().toLowerCase();
  if (clean.includes("stretch") || clean.includes("challenge")) return "challenge";
  if (clean.includes("easier") || clean.includes("foundation")) return "easier";
  return "core";
}

function normalizeSourceText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function hasSourcePlaceholderText(value = "") {
  return SOURCE_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(String(value || "")));
}

function hasExplicitHintText(value = "") {
  return EXPLICIT_HINT_PATTERNS.some((pattern) => pattern.test(String(value || "")));
}

function isWeakSourceContext(value = "") {
  const clean = String(value || "").trim();
  return clean.length > 0 && clean.length < 12;
}

function isCircularMeaning(word, meaning) {
  const cleanWord = normalizeSourceText(word);
  const cleanMeaning = normalizeSourceText(meaning)
    .replace(/[.?!]+$/g, "")
    .replace(/\s+/g, " ");
  return cleanMeaning === cleanWord
    || cleanMeaning === `to ${cleanWord}`
    || cleanMeaning === `a ${cleanWord}`
    || cleanMeaning === `an ${cleanWord}`
    || cleanMeaning === `the ${cleanWord}`;
}

function isActiveApprovedSuitableSourceWord(word = {}) {
  return word?.is_active === true
    && normalizeSourceText(word?.approval_status) === "approved"
    && normalizeSourceText(word?.suitability_status) === "suitable";
}

function countSourceDifficultyWindows(words, windows) {
  return Object.fromEntries(
    Object.entries(windows || {}).map(([key, window]) => {
      const min = Number(window?.min);
      const max = Number(window?.max);
      const count = (Array.isArray(words) ? words : [])
        .filter((word) => {
          const score = Number(word?.difficulty_score);
          return Number.isFinite(score)
            && Number.isFinite(min)
            && Number.isFinite(max)
            && score >= min
            && score <= max;
        })
        .length;
      return [key, count];
    }),
  );
}

function countRowsByKey(rows, keyFn) {
  const counts = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(keyFn(row) || "unknown");
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function buildSourceDataCoverageReport(source = {}) {
  const metadata = source?.metadata && typeof source.metadata === "object" ? source.metadata : {};
  const targets = Array.isArray(source?.targets) ? source.targets : [];
  const words = Array.isArray(source?.words) ? source.words : [];
  const activeApprovedSuitableWords = words.filter(isActiveApprovedSuitableSourceWord);
  const difficultyWindows = metadata?.difficulty_windows && typeof metadata.difficulty_windows === "object"
    ? metadata.difficulty_windows
    : {};
  const minimumPrimaryWords = Math.max(0, Number(metadata?.minimum_primary_words_per_active_target || 0));
  const sourceTargets = targets
    .map((target) => {
      const focus = normalizeSourceText(target?.focus_grapheme);
      const primaryWords = activeApprovedSuitableWords.filter((word) =>
        (Array.isArray(word?.target_links) ? word.target_links : []).some((link) =>
          normalizeSourceText(link?.target_role) === "primary"
          && normalizeSourceText(link?.focus_grapheme) === focus
        )
      );
      return {
        grapheme: focus,
        active: target?.is_active === true,
        sourcePrimaryWordCount: primaryWords.length,
        difficultyWindowCounts: countSourceDifficultyWindows(primaryWords, difficultyWindows),
      };
    })
    .filter((target) => target.grapheme)
    .sort((a, b) => a.grapheme.localeCompare(b.grapheme));
  const context = {
    missingSentenceCount: activeApprovedSuitableWords.filter((word) => !String(word?.sentence || "").trim()).length,
    missingMeaningCount: activeApprovedSuitableWords.filter((word) => !String(word?.meaning || "").trim()).length,
    weakSentenceCount: activeApprovedSuitableWords.filter((word) => isWeakSourceContext(word?.sentence)).length,
    weakMeaningCount: activeApprovedSuitableWords.filter((word) => isWeakSourceContext(word?.meaning)).length,
    placeholderContextCount: activeApprovedSuitableWords.filter((word) =>
      hasSourcePlaceholderText(word?.sentence) || hasSourcePlaceholderText(word?.meaning)
    ).length,
  };
  const warningCount = sourceTargets.filter((target) =>
    target.active
    && (
      target.sourcePrimaryWordCount === 0
      || (minimumPrimaryWords > 0 && target.sourcePrimaryWordCount < minimumPrimaryWords)
    )
  ).length
    + context.missingSentenceCount
    + context.missingMeaningCount
    + context.weakSentenceCount
    + context.weakMeaningCount
    + context.placeholderContextCount;

  return {
    sourceVersion: String(metadata?.source_version || ""),
    sourceTargetCount: targets.length,
    sourceWordCount: words.length,
    sourceValidationWarningCount: warningCount,
    sourceTargets,
    sourceContext: context,
  };
}

function toAssignmentWordRow(bankWord, sourceVersion = PROOF_SOURCE_VERSION) {
  const band = difficultyBandForLabel(bankWord.difficultyLabel);
  return {
    id: `core-${sourceVersion}-${bankWord.normalisedWord}`,
    word: bankWord.normalisedWord,
    sentence: bankWord.sentence,
    segments: bankWord.graphemeSegments,
    choice: {
      source: "wordloom_core",
      source_version: sourceVersion,
      origin_word_source: "wordloom_core",
      origin_bank_word_id: `core-${sourceVersion}-${bankWord.normalisedWord}`,
      focus_graphemes: Array.isArray(bankWord.focusGraphemes) && bankWord.focusGraphemes.length
        ? bankWord.focusGraphemes
        : [bankWord.primaryFocusGrapheme],
      primary_focus_grapheme: bankWord.primaryFocusGrapheme,
      focus_target_links: [{
        focus_grapheme: bankWord.primaryFocusGrapheme,
        target_role: "primary",
      }],
      selection_suitability: "standard",
      suitability_status: "suitable",
      approval_status: "approved",
      is_active: true,
      context_support: {
        sentence: bankWord.sentence,
        sentence_status: "approved",
        sentence_required: false,
        meaning: bankWord.meaning,
        meaning_status: "approved",
        meaning_enabled: true,
        meaning_enabled_by_default: true,
      },
      difficulty: {
        version: "wordloom_core",
        coreScore: bankWord.difficultyScore,
        adjustedScore: bankWord.difficultyScore,
        score: bankWord.difficultyScore,
        band,
        coreBand: band,
        label: bankWord.difficultyLabel,
        coreLabel: bankWord.difficultyLabel,
        reasons: bankWord.difficultyReason ? [bankWord.difficultyReason] : [],
        modifierReasons: [],
        flags: {},
        features: {},
        components: {},
        modifiers: {},
      },
    },
  };
}

function buildSampleProfile(target, allTargets) {
  const fallbackTargets = allTargets
    .filter((item) => item.focusGrapheme !== target.focusGrapheme)
    .map((item) => item.focusGrapheme);

  return {
    concernRows: [{
      target: target.focusGrapheme,
      total: 4,
      securityBand: "insecure",
    }],
    secureRows: fallbackTargets.map((focusGrapheme) => ({
      target: focusGrapheme,
      total: 4,
      securityBand: "secure",
    })),
    developingRows: fallbackTargets.map((focusGrapheme) => ({
      target: focusGrapheme,
      total: 3,
      securityBand: "nearly_secure",
    })),
    confusionByTarget: new Map(),
    placementMeta: {
      targetChallengeLevel: target.challengeBand,
    },
  };
}

function getTargetCoverageWarnings(plan) {
  return (plan.coverageWarnings || [])
    .filter((warning) => warning?.type === "target_coverage_low");
}

function assertExpectedWarning(target, warnings) {
  const expected = EXPECTED_LOW_COVERAGE_WARNINGS.get(target.focusGrapheme) || null;
  if (!expected) {
    assert.equal(warnings.length, 0, `${target.focusGrapheme} should not produce low-coverage warnings.`);
    return;
  }

  assert.equal(warnings.length, 1, `${target.focusGrapheme} should produce one low-coverage warning.`);
  assert.equal(warnings[0].focusGrapheme, target.focusGrapheme);
  assert.equal(warnings[0].selectedTargetCount, expected.selectedTargetCount);
  assert.equal(warnings[0].requestedTargetCount, expected.requestedTargetCount);
}

function invalidWordRowsForExclusionGuard() {
  const buildRow = ({
    id,
    word,
    source = "wordloom_core",
    approvalStatus = "approved",
    suitabilityStatus = "suitable",
    selectionSuitability,
    active = true,
  }) => {
    const choice = {
      source,
      origin_word_source: source === "wordloom_core" ? "wordloom_core" : source,
      origin_bank_word_id: id,
      focus_graphemes: ["ai"],
      primary_focus_grapheme: "ai",
      focus_target_links: [{ focus_grapheme: "ai", target_role: "primary" }],
      suitability_status: suitabilityStatus,
      approval_status: approvalStatus,
      is_active: active,
      context_support: {
        sentence: `${word} should not be selected.`,
        sentence_status: "approved",
        meaning: `${word} invalid test fixture.`,
        meaning_status: "approved",
        meaning_enabled: true,
      },
      difficulty: {
        version: "test",
        coreScore: 30,
        score: 30,
        band: "easier",
        coreBand: "easier",
        label: "Easier",
      },
    };
    if (selectionSuitability !== undefined) choice.selection_suitability = selectionSuitability;
    return {
      id,
      word,
      sentence: `${word} should not be selected.`,
      segments: ["br", "ai", "n"],
      choice,
    };
  };

  return [
    buildRow({ id: "invalid-generated-ai", word: "aim", source: "assignment_engine_pool" }),
    buildRow({ id: "invalid-pending-ai", word: "grain", approvalStatus: "pending" }),
    buildRow({ id: "invalid-inactive-ai", word: "claim", active: false }),
    buildRow({ id: "invalid-blocked-ai", word: "braid", selectionSuitability: "blocked" }),
    buildRow({ id: "invalid-unsuitable-ai", word: "raise", suitabilityStatus: "unsuitable" }),
    buildRow({ id: "invalid-excluded-ai", word: "waist", suitabilityStatus: "exclude", selectionSuitability: "exclude" }),
  ];
}

function buildPlanForTarget({ target, targets, assignmentRows, pupilId }) {
  return buildGeneratedAssignmentPlan({
    pupilIds: [pupilId],
    teacherTests: [{
      id: "wordloom-core-proof-bank",
      title: "Wordloom Core Proof Bank",
      test_words: assignmentRows,
    }],
    attempts: [],
    totalWords: EXPECTED_ASSIGNMENT_WORD_COUNT,
    currentProfiles: {
      [pupilId]: buildSampleProfile(target, targets),
    },
  });
}

function countSourceWordsByVersion(source = {}, sourceVersion = "") {
  const counts = new Map();
  for (const word of Array.isArray(source?.words) ? source.words : []) {
    if (word?.source_version !== sourceVersion) continue;
    if (word?.is_active !== true) continue;
    const focus = normalizeSourceText(word?.primary_focus_grapheme);
    counts.set(focus, (counts.get(focus) || 0) + 1);
  }
  return counts;
}

const proofMigrationSql = readFileSync(proofSetMigrationPath, "utf8");
const phase7BMigrationSql = readFileSync(phase7BMigrationPath, "utf8");
const phase7CMigrationSql = readFileSync(phase7CMigrationPath, "utf8");
const phase7DMigrationSql = readFileSync(phase7DMigrationPath, "utf8");
const phase7EMigrationSql = readFileSync(phase7EMigrationPath, "utf8");
const phase7FMigrationSql = readFileSync(phase7FMigrationPath, "utf8");
const phase7GMigrationSql = readFileSync(phase7GMigrationPath, "utf8");
const phase7HMigrationSql = readFileSync(phase7HMigrationPath, "utf8");
const phase8BMigrationSql = readFileSync(phase8BMigrationPath, "utf8");
const phase8CMigrationSql = readFileSync(phase8CMigrationPath, "utf8");
const sourceData = JSON.parse(readFileSync(sourceDataPath, "utf8"));
const sourceCoverageReport = buildSourceDataCoverageReport(sourceData);
const phase7BSourceWordCountByGrapheme = countSourceWordsByVersion(sourceData, PHASE_7B_SOURCE_VERSION);
const phase7CSourceWordCountByGrapheme = countSourceWordsByVersion(sourceData, PHASE_7C_SOURCE_VERSION);
const phase7DSourceWordCountByGrapheme = countSourceWordsByVersion(sourceData, PHASE_7D_SOURCE_VERSION);
const phase7ESourceWordCountByGrapheme = countSourceWordsByVersion(sourceData, PHASE_7E_SOURCE_VERSION);
const phase7FSourceWordCountByGrapheme = countSourceWordsByVersion(sourceData, PHASE_7F_SOURCE_VERSION);
const phase7GSourceWordCountByGrapheme = countSourceWordsByVersion(sourceData, PHASE_7G_SOURCE_VERSION);
const phase7HSourceWordCountByGrapheme = countSourceWordsByVersion(sourceData, PHASE_7H_SOURCE_VERSION);
const phase8BSourceWordCountByGrapheme = countSourceWordsByVersion(sourceData, PHASE_8B_SOURCE_VERSION);
const phase8CSourceWordCountByGrapheme = countSourceWordsByVersion(sourceData, PHASE_8C_SOURCE_VERSION);
const proofTargets = parseProofTargets(proofMigrationSql);
const proofWords = parseProofWords(proofMigrationSql);
const phase7BTargets = parsePhase7BTargets(phase7BMigrationSql);
const phase7BWords = parsePhase7BWords(phase7BMigrationSql);
const phase7BWordTargets = parsePhase7BWordTargets(phase7BMigrationSql);
const phase7CTargets = parsePhase7CTargets(phase7CMigrationSql);
const phase7CWords = parsePhase7CWords(phase7CMigrationSql);
const phase7CWordTargets = parsePhase7CWordTargets(phase7CMigrationSql);
const phase7DTargets = parsePhase7DTargets(phase7DMigrationSql);
const phase7DWords = parsePhase7DWords(phase7DMigrationSql);
const phase7DWordTargets = parsePhase7DWordTargets(phase7DMigrationSql);
const phase7ETargets = parsePhase7ETargets(phase7EMigrationSql);
const phase7EWords = parsePhase7EWords(phase7EMigrationSql);
const phase7EWordTargets = parsePhase7EWordTargets(phase7EMigrationSql);
const phase7FTargets = parsePhase7FTargets(phase7FMigrationSql);
const phase7FWords = parsePhase7FWords(phase7FMigrationSql);
const phase7FWordTargets = parsePhase7FWordTargets(phase7FMigrationSql);
const phase7GTargets = parsePhase7GTargets(phase7GMigrationSql);
const phase7GWords = parsePhase7GWords(phase7GMigrationSql);
const phase7GWordTargets = parsePhase7GWordTargets(phase7GMigrationSql);
const phase7HTargets = parsePhase7HTargets(phase7HMigrationSql);
const phase7HWords = parsePhase7HWords(phase7HMigrationSql);
const phase7HWordTargets = parsePhase7HWordTargets(phase7HMigrationSql);
const phase8BTargets = parsePhase8BTargets(phase8BMigrationSql);
const phase8BWords = parsePhase8BWords(phase8BMigrationSql);
const phase8BWordTargets = parsePhase8BWordTargets(phase8BMigrationSql);
const phase8CTargets = parsePhase8CTargets(phase8CMigrationSql);
const phase8CWords = parsePhase8CWords(phase8CMigrationSql);
const phase8CWordTargets = parsePhase8CWordTargets(phase8CMigrationSql);
const proofWordCountByGrapheme = new Map();
const phase7BWordCountByGrapheme = new Map();
const phase7CWordCountByGrapheme = new Map();
const phase7DWordCountByGrapheme = new Map();
const phase7EWordCountByGrapheme = new Map();
const phase7FWordCountByGrapheme = new Map();
const phase7GWordCountByGrapheme = new Map();
const phase7HWordCountByGrapheme = new Map();
const phase8BWordCountByGrapheme = new Map();
const phase8CWordCountByGrapheme = new Map();
const combinedWordCountByGrapheme = new Map();
const proofWordsByNormalised = new Set(proofWords.map((word) => word.normalisedWord));
const phase7BWordsByNormalised = new Set(phase7BWords.map((word) => word.normalisedWord));
const phase7CWordsByNormalised = new Set(phase7CWords.map((word) => word.normalisedWord));
const phase7DWordsByNormalised = new Set(phase7DWords.map((word) => word.normalisedWord));
const phase7EWordsByNormalised = new Set(phase7EWords.map((word) => word.normalisedWord));
const phase7FWordsByNormalised = new Set(phase7FWords.map((word) => word.normalisedWord));
const phase7GWordsByNormalised = new Set(phase7GWords.map((word) => word.normalisedWord));
const phase7HWordsByNormalised = new Set(phase7HWords.map((word) => word.normalisedWord));
const phase8BWordsByNormalised = new Set(phase8BWords.map((word) => word.normalisedWord));

for (const proofWord of proofWords) {
  proofWordCountByGrapheme.set(
    proofWord.primaryFocusGrapheme,
    (proofWordCountByGrapheme.get(proofWord.primaryFocusGrapheme) || 0) + 1,
  );
  combinedWordCountByGrapheme.set(
    proofWord.primaryFocusGrapheme,
    (combinedWordCountByGrapheme.get(proofWord.primaryFocusGrapheme) || 0) + 1,
  );
}

for (const phaseWord of phase7BWords) {
  phase7BWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (phase7BWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
  combinedWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (combinedWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
}

for (const phaseWord of phase7CWords) {
  phase7CWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (phase7CWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
  combinedWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (combinedWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
}

for (const phaseWord of phase7DWords) {
  phase7DWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (phase7DWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
  combinedWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (combinedWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
}

for (const phaseWord of phase7EWords) {
  phase7EWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (phase7EWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
  combinedWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (combinedWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
}

for (const phaseWord of phase7FWords) {
  phase7FWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (phase7FWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
  combinedWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (combinedWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
}

for (const phaseWord of phase7GWords) {
  phase7GWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (phase7GWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
  combinedWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (combinedWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
}

for (const phaseWord of phase7HWords) {
  phase7HWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (phase7HWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
  combinedWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (combinedWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
}

for (const phaseWord of phase8BWords) {
  phase8BWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (phase8BWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
  combinedWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (combinedWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
}

for (const phaseWord of phase8CWords) {
  phase8CWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (phase8CWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
  combinedWordCountByGrapheme.set(
    phaseWord.primaryFocusGrapheme,
    (combinedWordCountByGrapheme.get(phaseWord.primaryFocusGrapheme) || 0) + 1,
  );
}

assert.equal(
  proofTargets.length,
  EXPECTED_PROOF_TARGET_COUNT,
  `Expected ${EXPECTED_PROOF_TARGET_COUNT} proof targets in ${proofSetMigrationPath}.`,
);
assert.equal(
  proofWords.length,
  EXPECTED_PROOF_WORD_COUNT,
  `Expected ${EXPECTED_PROOF_WORD_COUNT} proof words in ${proofSetMigrationPath}.`,
);
assert.equal(
  phase7BTargets.length,
  EXPECTED_PHASE_7B_TARGET_COUNT,
  `Expected ${EXPECTED_PHASE_7B_TARGET_COUNT} Phase 7B targets in ${phase7BMigrationPath}.`,
);
assert.equal(
  phase7BWords.length,
  EXPECTED_PHASE_7B_WORD_COUNT,
  `Expected ${EXPECTED_PHASE_7B_WORD_COUNT} Phase 7B words in ${phase7BMigrationPath}.`,
);
assert.equal(
  phase7BWordTargets.length,
  EXPECTED_PHASE_7B_WORD_COUNT,
  "Phase 7B migration should define one word-target link per word.",
);
assert.equal(
  phase7CTargets.length,
  EXPECTED_PHASE_7C_TARGET_COUNT,
  `Expected ${EXPECTED_PHASE_7C_TARGET_COUNT} Phase 7C targets in ${phase7CMigrationPath}.`,
);
assert.equal(
  phase7CWords.length,
  EXPECTED_PHASE_7C_WORD_COUNT,
  `Expected ${EXPECTED_PHASE_7C_WORD_COUNT} Phase 7C words in ${phase7CMigrationPath}.`,
);
assert.equal(
  phase7CWordTargets.length,
  EXPECTED_PHASE_7C_WORD_COUNT,
  "Phase 7C migration should define one word-target link per word.",
);
assert.equal(
  phase7DTargets.length,
  EXPECTED_PHASE_7D_TARGET_COUNT,
  `Expected ${EXPECTED_PHASE_7D_TARGET_COUNT} Phase 7D targets in ${phase7DMigrationPath}.`,
);
assert.equal(
  phase7DWords.length,
  EXPECTED_PHASE_7D_WORD_COUNT,
  `Expected ${EXPECTED_PHASE_7D_WORD_COUNT} Phase 7D words in ${phase7DMigrationPath}.`,
);
assert.equal(
  phase7DWordTargets.length,
  EXPECTED_PHASE_7D_WORD_COUNT,
  "Phase 7D migration should define one word-target link per word.",
);
assert.equal(
  phase7ETargets.length,
  EXPECTED_PHASE_7E_TARGET_COUNT,
  `Expected ${EXPECTED_PHASE_7E_TARGET_COUNT} Phase 7E targets in ${phase7EMigrationPath}.`,
);
assert.equal(
  phase7EWords.length,
  EXPECTED_PHASE_7E_WORD_COUNT,
  `Expected ${EXPECTED_PHASE_7E_WORD_COUNT} Phase 7E words in ${phase7EMigrationPath}.`,
);
assert.equal(
  phase7EWordTargets.length,
  EXPECTED_PHASE_7E_WORD_COUNT,
  "Phase 7E migration should define one word-target link per word.",
);
assert.equal(
  phase7FTargets.length,
  EXPECTED_PHASE_7F_TARGET_COUNT,
  `Expected ${EXPECTED_PHASE_7F_TARGET_COUNT} Phase 7F targets in ${phase7FMigrationPath}.`,
);
assert.equal(
  phase7FWords.length,
  EXPECTED_PHASE_7F_WORD_COUNT,
  `Expected ${EXPECTED_PHASE_7F_WORD_COUNT} Phase 7F words in ${phase7FMigrationPath}.`,
);
assert.equal(
  phase7FWordTargets.length,
  EXPECTED_PHASE_7F_WORD_COUNT,
  "Phase 7F migration should define one word-target link per word.",
);
assert.equal(
  phase7GTargets.length,
  EXPECTED_PHASE_7G_TARGET_COUNT,
  `Expected ${EXPECTED_PHASE_7G_TARGET_COUNT} Phase 7G targets in ${phase7GMigrationPath}.`,
);
assert.equal(
  phase7GWords.length,
  EXPECTED_PHASE_7G_WORD_COUNT,
  `Expected ${EXPECTED_PHASE_7G_WORD_COUNT} Phase 7G words in ${phase7GMigrationPath}.`,
);
assert.equal(
  phase7GWordTargets.length,
  EXPECTED_PHASE_7G_WORD_COUNT,
  "Phase 7G migration should define one word-target link per word.",
);
assert.equal(
  phase7HTargets.length,
  EXPECTED_PHASE_7H_TARGET_COUNT,
  `Expected ${EXPECTED_PHASE_7H_TARGET_COUNT} Phase 7H targets in ${phase7HMigrationPath}.`,
);
assert.equal(
  phase7HWords.length,
  EXPECTED_PHASE_7H_WORD_COUNT,
  `Expected ${EXPECTED_PHASE_7H_WORD_COUNT} Phase 7H words in ${phase7HMigrationPath}.`,
);
assert.equal(
  phase7HWordTargets.length,
  EXPECTED_PHASE_7H_WORD_COUNT,
  "Phase 7H migration should define one word-target link per word.",
);
assert.equal(
  phase8BTargets.length,
  EXPECTED_PHASE_8B_TARGET_COUNT,
  `Expected ${EXPECTED_PHASE_8B_TARGET_COUNT} Phase 8B targets in ${phase8BMigrationPath}.`,
);
assert.equal(
  phase8BWords.length,
  EXPECTED_PHASE_8B_WORD_COUNT,
  `Expected ${EXPECTED_PHASE_8B_WORD_COUNT} Phase 8B words in ${phase8BMigrationPath}.`,
);
assert.equal(
  phase8BWordTargets.length,
  EXPECTED_PHASE_8B_WORD_COUNT,
  "Phase 8B migration should define one word-target link per word.",
);
assert.equal(
  phase8CTargets.length,
  EXPECTED_PHASE_8C_TARGET_COUNT,
  `Expected ${EXPECTED_PHASE_8C_TARGET_COUNT} Phase 8C targets in ${phase8CMigrationPath}.`,
);
assert.equal(
  phase8CWords.length,
  EXPECTED_PHASE_8C_WORD_COUNT,
  `Expected ${EXPECTED_PHASE_8C_WORD_COUNT} Phase 8C words in ${phase8CMigrationPath}.`,
);
assert.equal(
  phase8CWordTargets.length,
  EXPECTED_PHASE_8C_WORD_COUNT,
  "Phase 8C migration should define one word-target link per word.",
);
assert.equal(
  sourceCoverageReport.sourceWordCount,
  1352,
  "Phase 8C source data should contain 1,352 rows after structured expansion batch 2.",
);

for (const [focus, expectedCount] of EXPECTED_PHASE_7B_COUNTS) {
  assert.equal(
    phase7BWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} should have ${expectedCount} Phase 7B words.`,
  );
  assert.equal(
    phase7BSourceWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} source coverage should include ${expectedCount} Phase 7B words.`,
  );
}

for (const [focus, expectedCount] of EXPECTED_PHASE_7C_COUNTS) {
  assert.equal(
    phase7CWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} should have ${expectedCount} Phase 7C words.`,
  );
  assert.equal(
    phase7CSourceWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} source coverage should include ${expectedCount} Phase 7C words.`,
  );
}

for (const [focus, expectedCount] of EXPECTED_PHASE_7D_COUNTS) {
  assert.equal(
    phase7DWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} should have ${expectedCount} Phase 7D words.`,
  );
  assert.equal(
    phase7DSourceWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} source coverage should include ${expectedCount} Phase 7D words.`,
  );
}

for (const [focus, expectedCount] of EXPECTED_PHASE_7E_COUNTS) {
  assert.equal(
    phase7EWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} should have ${expectedCount} Phase 7E words.`,
  );
  assert.equal(
    phase7ESourceWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} source coverage should include ${expectedCount} Phase 7E words.`,
  );
}

for (const [focus, expectedCount] of EXPECTED_PHASE_7F_COUNTS) {
  assert.equal(
    phase7FWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} should have ${expectedCount} Phase 7F words.`,
  );
  assert.equal(
    phase7FSourceWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} source coverage should include ${expectedCount} Phase 7F words.`,
  );
}

for (const [focus, expectedCount] of EXPECTED_PHASE_7G_COUNTS) {
  assert.equal(
    phase7GWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} should have ${expectedCount} Phase 7G words.`,
  );
  assert.equal(
    phase7GSourceWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} source coverage should include ${expectedCount} Phase 7G words.`,
  );
}

for (const [focus, expectedCount] of EXPECTED_PHASE_7H_COUNTS) {
  assert.equal(
    phase7HWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} should have ${expectedCount} Phase 7H words.`,
  );
  assert.equal(
    phase7HSourceWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} source coverage should include ${expectedCount} Phase 7H words.`,
  );
}

for (const [focus, expectedCount] of EXPECTED_PHASE_8B_COUNTS) {
  assert.equal(
    phase8BWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} should have ${expectedCount} Phase 8B words.`,
  );
  assert.equal(
    phase8BSourceWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} source coverage should include ${expectedCount} Phase 8B words.`,
  );
}

for (const [focus, expectedCount] of EXPECTED_PHASE_8C_COUNTS) {
  assert.equal(
    phase8CWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} should have ${expectedCount} Phase 8C words.`,
  );
  assert.equal(
    phase8CSourceWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} source coverage should include ${expectedCount} Phase 8C words.`,
  );
}

for (const launchTarget of ["ay", "ea", "ew", "tch"]) {
  assert.equal(
    phase7BTargets.some((target) => target.focusGrapheme === launchTarget),
    true,
    `${launchTarget} should be included as a Phase 7B launch target.`,
  );
}

for (const launchTarget of ["aw", "ure"]) {
  assert.equal(
    phase7CTargets.some((target) => target.focusGrapheme === launchTarget),
    true,
    `${launchTarget} should be included as a Phase 7C launch target.`,
  );
}

for (const launchTarget of ["ai", "ee", "oa", "igh", "or", "sh", "ch", "ck"]) {
  assert.equal(
    phase7DTargets.some((target) => target.focusGrapheme === launchTarget),
    true,
    `${launchTarget} should be included as a Phase 7D proof-target top-up target.`,
  );
}

for (const [launchTarget] of EXPECTED_PHASE_7E_COUNTS) {
  assert.equal(
    phase7ETargets.some((target) => target.focusGrapheme === launchTarget),
    true,
    `${launchTarget} should be included as a Phase 7E bulk top-up target.`,
  );
}

for (const [launchTarget] of EXPECTED_PHASE_7F_COUNTS) {
  assert.equal(
    phase7FTargets.some((target) => target.focusGrapheme === launchTarget),
    true,
    `${launchTarget} should be included as a Phase 7F bulk common-target strengthening target.`,
  );
}

for (const [launchTarget] of EXPECTED_PHASE_7G_COUNTS) {
  assert.equal(
    phase7GTargets.some((target) => target.focusGrapheme === launchTarget),
    true,
    `${launchTarget} should be included as a Phase 7G bulk top-up target.`,
  );
}

for (const [launchTarget] of EXPECTED_PHASE_7H_COUNTS) {
  assert.equal(
    phase7HTargets.some((target) => target.focusGrapheme === launchTarget),
    true,
    `${launchTarget} should be included as a Phase 7H final expansion target.`,
  );
}

for (const [launchTarget] of EXPECTED_PHASE_8B_COUNTS) {
  assert.equal(
    phase8BTargets.some((target) => target.focusGrapheme === launchTarget),
    true,
    `${launchTarget} should be included as a Phase 8B structured expansion target.`,
  );
}

for (const [launchTarget] of EXPECTED_PHASE_8C_COUNTS) {
  assert.equal(
    phase8CTargets.some((target) => target.focusGrapheme === launchTarget),
    true,
    `${launchTarget} should be included as a Phase 8C structured expansion target.`,
  );
}

const phase7BLinksByWord = new Map();
for (const link of phase7BWordTargets) {
  const next = phase7BLinksByWord.get(link.normalisedWord) || [];
  next.push(link);
  phase7BLinksByWord.set(link.normalisedWord, next);
}
const phase7CLinksByWord = new Map();
for (const link of phase7CWordTargets) {
  const next = phase7CLinksByWord.get(link.normalisedWord) || [];
  next.push(link);
  phase7CLinksByWord.set(link.normalisedWord, next);
}
const phase7DLinksByWord = new Map();
for (const link of phase7DWordTargets) {
  const next = phase7DLinksByWord.get(link.normalisedWord) || [];
  next.push(link);
  phase7DLinksByWord.set(link.normalisedWord, next);
}
const phase7ELinksByWord = new Map();
for (const link of phase7EWordTargets) {
  const next = phase7ELinksByWord.get(link.normalisedWord) || [];
  next.push(link);
  phase7ELinksByWord.set(link.normalisedWord, next);
}
const phase7FLinksByWord = new Map();
for (const link of phase7FWordTargets) {
  const next = phase7FLinksByWord.get(link.normalisedWord) || [];
  next.push(link);
  phase7FLinksByWord.set(link.normalisedWord, next);
}
const phase7GLinksByWord = new Map();
for (const link of phase7GWordTargets) {
  const next = phase7GLinksByWord.get(link.normalisedWord) || [];
  next.push(link);
  phase7GLinksByWord.set(link.normalisedWord, next);
}
const phase7HLinksByWord = new Map();
for (const link of phase7HWordTargets) {
  const next = phase7HLinksByWord.get(link.normalisedWord) || [];
  next.push(link);
  phase7HLinksByWord.set(link.normalisedWord, next);
}
const phase8BLinksByWord = new Map();
for (const link of phase8BWordTargets) {
  const next = phase8BLinksByWord.get(link.normalisedWord) || [];
  next.push(link);
  phase8BLinksByWord.set(link.normalisedWord, next);
}
const phase8CLinksByWord = new Map();
for (const link of phase8CWordTargets) {
  const next = phase8CLinksByWord.get(link.normalisedWord) || [];
  next.push(link);
  phase8CLinksByWord.set(link.normalisedWord, next);
}

for (const phaseWord of phase7BWords) {
  assert.equal(phaseWord.source, "wordloom_core", `${phaseWord.normalisedWord} should be Wordloom core source.`);
  assert.equal(phaseWord.sourceVersion, PHASE_7B_SOURCE_VERSION, `${phaseWord.normalisedWord} should carry Phase 7B source_version.`);
  assert.equal(phaseWord.approvalStatus, "approved", `${phaseWord.normalisedWord} should be approved.`);
  assert.equal(phaseWord.suitabilityStatus, "suitable", `${phaseWord.normalisedWord} should be suitable.`);
  assert.equal(phaseWord.active, true, `${phaseWord.normalisedWord} should be active.`);
  assert.equal(String(phaseWord.sentence || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful sentence.`);
  assert.equal(String(phaseWord.meaning || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful meaning.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be placeholder text.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be placeholder text.`);
  assert.equal(isWeakSourceContext(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be weak context.`);
  assert.equal(isWeakSourceContext(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be weak context.`);
  assert.equal(isCircularMeaning(phaseWord.normalisedWord, phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be circular.`);
  assert.equal(hasExplicitHintText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be spelling-hint text.`);
  assert.equal(hasExplicitHintText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be spelling-hint text.`);
  assert.equal(phaseWord.graphemeSegments.join(""), phaseWord.normalisedWord, `${phaseWord.normalisedWord} segments should reconstruct the word.`);
  assert.equal(phaseWord.graphemeSegments.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in segments.`);
  assert.equal(phaseWord.focusGraphemes.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in focus_graphemes.`);
  assert.equal(proofWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a proof word.`);

  const primaryLinks = (phase7BLinksByWord.get(phaseWord.normalisedWord) || [])
    .filter((link) => link.targetRole === "primary");
  assert.equal(primaryLinks.length, 1, `${phaseWord.normalisedWord} should have exactly one primary Phase 7B target link.`);
  assert.equal(primaryLinks[0]?.focusGrapheme, phaseWord.primaryFocusGrapheme, `${phaseWord.normalisedWord} primary link should match primary focus.`);
}

for (const phaseWord of phase7CWords) {
  assert.equal(phaseWord.source, "wordloom_core", `${phaseWord.normalisedWord} should be Wordloom core source.`);
  assert.equal(phaseWord.sourceVersion, PHASE_7C_SOURCE_VERSION, `${phaseWord.normalisedWord} should carry Phase 7C source_version.`);
  assert.equal(phaseWord.approvalStatus, "approved", `${phaseWord.normalisedWord} should be approved.`);
  assert.equal(phaseWord.suitabilityStatus, "suitable", `${phaseWord.normalisedWord} should be suitable.`);
  assert.equal(phaseWord.active, true, `${phaseWord.normalisedWord} should be active.`);
  assert.equal(String(phaseWord.sentence || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful sentence.`);
  assert.equal(String(phaseWord.meaning || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful meaning.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be placeholder text.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be placeholder text.`);
  assert.equal(isWeakSourceContext(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be weak context.`);
  assert.equal(isWeakSourceContext(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be weak context.`);
  assert.equal(isCircularMeaning(phaseWord.normalisedWord, phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be circular.`);
  assert.equal(hasExplicitHintText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be spelling-hint text.`);
  assert.equal(hasExplicitHintText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be spelling-hint text.`);
  assert.equal(phaseWord.graphemeSegments.join(""), phaseWord.normalisedWord, `${phaseWord.normalisedWord} segments should reconstruct the word.`);
  assert.equal(phaseWord.graphemeSegments.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in segments.`);
  assert.equal(phaseWord.focusGraphemes.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in focus_graphemes.`);
  assert.equal(proofWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a proof word.`);
  assert.equal(phase7BWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7B word.`);

  const primaryLinks = (phase7CLinksByWord.get(phaseWord.normalisedWord) || [])
    .filter((link) => link.targetRole === "primary");
  assert.equal(primaryLinks.length, 1, `${phaseWord.normalisedWord} should have exactly one primary Phase 7C target link.`);
  assert.equal(primaryLinks[0]?.focusGrapheme, phaseWord.primaryFocusGrapheme, `${phaseWord.normalisedWord} primary link should match primary focus.`);
}

for (const phaseWord of phase7DWords) {
  assert.equal(phaseWord.source, "wordloom_core", `${phaseWord.normalisedWord} should be Wordloom core source.`);
  assert.equal(phaseWord.sourceVersion, PHASE_7D_SOURCE_VERSION, `${phaseWord.normalisedWord} should carry Phase 7D source_version.`);
  assert.equal(phaseWord.approvalStatus, "approved", `${phaseWord.normalisedWord} should be approved.`);
  assert.equal(phaseWord.suitabilityStatus, "suitable", `${phaseWord.normalisedWord} should be suitable.`);
  assert.equal(phaseWord.active, true, `${phaseWord.normalisedWord} should be active.`);
  assert.equal(String(phaseWord.sentence || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful sentence.`);
  assert.equal(String(phaseWord.meaning || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful meaning.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be placeholder text.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be placeholder text.`);
  assert.equal(isWeakSourceContext(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be weak context.`);
  assert.equal(isWeakSourceContext(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be weak context.`);
  assert.equal(isCircularMeaning(phaseWord.normalisedWord, phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be circular.`);
  assert.equal(hasExplicitHintText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be spelling-hint text.`);
  assert.equal(hasExplicitHintText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be spelling-hint text.`);
  assert.equal(phaseWord.graphemeSegments.join(""), phaseWord.normalisedWord, `${phaseWord.normalisedWord} segments should reconstruct the word.`);
  assert.equal(phaseWord.graphemeSegments.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in segments.`);
  assert.equal(phaseWord.focusGraphemes.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in focus_graphemes.`);
  assert.equal(proofWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a proof word.`);
  assert.equal(phase7BWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7B word.`);
  assert.equal(phase7CWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7C word.`);

  const primaryLinks = (phase7DLinksByWord.get(phaseWord.normalisedWord) || [])
    .filter((link) => link.targetRole === "primary");
  assert.equal(primaryLinks.length, 1, `${phaseWord.normalisedWord} should have exactly one primary Phase 7D target link.`);
  assert.equal(primaryLinks[0]?.focusGrapheme, phaseWord.primaryFocusGrapheme, `${phaseWord.normalisedWord} primary link should match primary focus.`);
}

for (const phaseWord of phase7EWords) {
  assert.equal(phaseWord.source, "wordloom_core", `${phaseWord.normalisedWord} should be Wordloom core source.`);
  assert.equal(phaseWord.sourceVersion, PHASE_7E_SOURCE_VERSION, `${phaseWord.normalisedWord} should carry Phase 7E source_version.`);
  assert.equal(phaseWord.approvalStatus, "approved", `${phaseWord.normalisedWord} should be approved.`);
  assert.equal(phaseWord.suitabilityStatus, "suitable", `${phaseWord.normalisedWord} should be suitable.`);
  assert.equal(phaseWord.active, true, `${phaseWord.normalisedWord} should be active.`);
  assert.equal(String(phaseWord.sentence || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful sentence.`);
  assert.equal(String(phaseWord.meaning || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful meaning.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be placeholder text.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be placeholder text.`);
  assert.equal(isWeakSourceContext(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be weak context.`);
  assert.equal(isWeakSourceContext(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be weak context.`);
  assert.equal(isCircularMeaning(phaseWord.normalisedWord, phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be circular.`);
  assert.equal(hasExplicitHintText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be spelling-hint text.`);
  assert.equal(hasExplicitHintText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be spelling-hint text.`);
  assert.equal(phaseWord.graphemeSegments.join(""), phaseWord.normalisedWord, `${phaseWord.normalisedWord} segments should reconstruct the word.`);
  assert.equal(phaseWord.graphemeSegments.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in segments.`);
  assert.equal(phaseWord.focusGraphemes.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in focus_graphemes.`);
  assert.equal(proofWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a proof word.`);
  assert.equal(phase7BWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7B word.`);
  assert.equal(phase7CWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7C word.`);
  assert.equal(phase7DWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7D word.`);

  const primaryLinks = (phase7ELinksByWord.get(phaseWord.normalisedWord) || [])
    .filter((link) => link.targetRole === "primary");
  assert.equal(primaryLinks.length, 1, `${phaseWord.normalisedWord} should have exactly one primary Phase 7E target link.`);
  assert.equal(primaryLinks[0]?.focusGrapheme, phaseWord.primaryFocusGrapheme, `${phaseWord.normalisedWord} primary link should match primary focus.`);
}

for (const phaseWord of phase7FWords) {
  assert.equal(phaseWord.source, "wordloom_core", `${phaseWord.normalisedWord} should be Wordloom core source.`);
  assert.equal(phaseWord.sourceVersion, PHASE_7F_SOURCE_VERSION, `${phaseWord.normalisedWord} should carry Phase 7F source_version.`);
  assert.equal(phaseWord.approvalStatus, "approved", `${phaseWord.normalisedWord} should be approved.`);
  assert.equal(phaseWord.suitabilityStatus, "suitable", `${phaseWord.normalisedWord} should be suitable.`);
  assert.equal(phaseWord.active, true, `${phaseWord.normalisedWord} should be active.`);
  assert.equal(String(phaseWord.sentence || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful sentence.`);
  assert.equal(String(phaseWord.meaning || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful meaning.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be placeholder text.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be placeholder text.`);
  assert.equal(isWeakSourceContext(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be weak context.`);
  assert.equal(isWeakSourceContext(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be weak context.`);
  assert.equal(isCircularMeaning(phaseWord.normalisedWord, phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be circular.`);
  assert.equal(hasExplicitHintText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be spelling-hint text.`);
  assert.equal(hasExplicitHintText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be spelling-hint text.`);
  assert.equal(phaseWord.graphemeSegments.join(""), phaseWord.normalisedWord, `${phaseWord.normalisedWord} segments should reconstruct the word.`);
  assert.equal(phaseWord.graphemeSegments.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in segments.`);
  assert.equal(phaseWord.focusGraphemes.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in focus_graphemes.`);
  assert.equal(proofWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a proof word.`);
  assert.equal(phase7BWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7B word.`);
  assert.equal(phase7CWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7C word.`);
  assert.equal(phase7DWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7D word.`);
  assert.equal(phase7EWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7E word.`);

  const primaryLinks = (phase7FLinksByWord.get(phaseWord.normalisedWord) || [])
    .filter((link) => link.targetRole === "primary");
  assert.equal(primaryLinks.length, 1, `${phaseWord.normalisedWord} should have exactly one primary Phase 7F target link.`);
  assert.equal(primaryLinks[0]?.focusGrapheme, phaseWord.primaryFocusGrapheme, `${phaseWord.normalisedWord} primary link should match primary focus.`);
}

for (const phaseWord of phase7GWords) {
  assert.equal(phaseWord.source, "wordloom_core", `${phaseWord.normalisedWord} should be Wordloom core source.`);
  assert.equal(phaseWord.sourceVersion, PHASE_7G_SOURCE_VERSION, `${phaseWord.normalisedWord} should carry Phase 7G source_version.`);
  assert.equal(phaseWord.approvalStatus, "approved", `${phaseWord.normalisedWord} should be approved.`);
  assert.equal(phaseWord.suitabilityStatus, "suitable", `${phaseWord.normalisedWord} should be suitable.`);
  assert.equal(phaseWord.active, true, `${phaseWord.normalisedWord} should be active.`);
  assert.equal(String(phaseWord.sentence || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful sentence.`);
  assert.equal(String(phaseWord.meaning || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful meaning.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be placeholder text.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be placeholder text.`);
  assert.equal(isWeakSourceContext(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be weak context.`);
  assert.equal(isWeakSourceContext(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be weak context.`);
  assert.equal(isCircularMeaning(phaseWord.normalisedWord, phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be circular.`);
  assert.equal(hasExplicitHintText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be spelling-hint text.`);
  assert.equal(hasExplicitHintText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be spelling-hint text.`);
  assert.equal(phaseWord.graphemeSegments.join(""), phaseWord.normalisedWord, `${phaseWord.normalisedWord} segments should reconstruct the word.`);
  assert.equal(phaseWord.graphemeSegments.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in segments.`);
  assert.equal(phaseWord.focusGraphemes.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in focus_graphemes.`);
  assert.equal(proofWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a proof word.`);
  assert.equal(phase7BWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7B word.`);
  assert.equal(phase7CWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7C word.`);
  assert.equal(phase7DWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7D word.`);
  assert.equal(phase7EWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7E word.`);
  assert.equal(phase7FWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7F word.`);

  const primaryLinks = (phase7GLinksByWord.get(phaseWord.normalisedWord) || [])
    .filter((link) => link.targetRole === "primary");
  assert.equal(primaryLinks.length, 1, `${phaseWord.normalisedWord} should have exactly one primary Phase 7G target link.`);
  assert.equal(primaryLinks[0]?.focusGrapheme, phaseWord.primaryFocusGrapheme, `${phaseWord.normalisedWord} primary link should match primary focus.`);
}

for (const phaseWord of phase7HWords) {
  assert.equal(phaseWord.source, "wordloom_core", `${phaseWord.normalisedWord} should be Wordloom core source.`);
  assert.equal(phaseWord.sourceVersion, PHASE_7H_SOURCE_VERSION, `${phaseWord.normalisedWord} should carry Phase 7H source_version.`);
  assert.equal(phaseWord.approvalStatus, "approved", `${phaseWord.normalisedWord} should be approved.`);
  assert.equal(phaseWord.suitabilityStatus, "suitable", `${phaseWord.normalisedWord} should be suitable.`);
  assert.equal(phaseWord.active, true, `${phaseWord.normalisedWord} should be active.`);
  assert.equal(String(phaseWord.sentence || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful sentence.`);
  assert.equal(String(phaseWord.meaning || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful meaning.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be placeholder text.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be placeholder text.`);
  assert.equal(isWeakSourceContext(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be weak context.`);
  assert.equal(isWeakSourceContext(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be weak context.`);
  assert.equal(isCircularMeaning(phaseWord.normalisedWord, phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be circular.`);
  assert.equal(hasExplicitHintText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be spelling-hint text.`);
  assert.equal(hasExplicitHintText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be spelling-hint text.`);
  assert.equal(phaseWord.graphemeSegments.join(""), phaseWord.normalisedWord, `${phaseWord.normalisedWord} segments should reconstruct the word.`);
  assert.equal(phaseWord.graphemeSegments.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in segments.`);
  assert.equal(phaseWord.focusGraphemes.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in focus_graphemes.`);
  assert.equal(proofWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a proof word.`);
  assert.equal(phase7BWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7B word.`);
  assert.equal(phase7CWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7C word.`);
  assert.equal(phase7DWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7D word.`);
  assert.equal(phase7EWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7E word.`);
  assert.equal(phase7FWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7F word.`);
  assert.equal(phase7GWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7G word.`);

  const primaryLinks = (phase7HLinksByWord.get(phaseWord.normalisedWord) || [])
    .filter((link) => link.targetRole === "primary");
  assert.equal(primaryLinks.length, 1, `${phaseWord.normalisedWord} should have exactly one primary Phase 7H target link.`);
  assert.equal(primaryLinks[0]?.focusGrapheme, phaseWord.primaryFocusGrapheme, `${phaseWord.normalisedWord} primary link should match primary focus.`);
}

for (const phaseWord of phase8BWords) {
  assert.equal(phaseWord.source, "wordloom_core", `${phaseWord.normalisedWord} should be Wordloom core source.`);
  assert.equal(phaseWord.sourceVersion, PHASE_8B_SOURCE_VERSION, `${phaseWord.normalisedWord} should carry Phase 8B source_version.`);
  assert.equal(phaseWord.approvalStatus, "approved", `${phaseWord.normalisedWord} should be approved.`);
  assert.equal(phaseWord.suitabilityStatus, "suitable", `${phaseWord.normalisedWord} should be suitable.`);
  assert.equal(phaseWord.active, true, `${phaseWord.normalisedWord} should be active.`);
  assert.equal(String(phaseWord.sentence || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful sentence.`);
  assert.equal(String(phaseWord.meaning || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful meaning.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be placeholder text.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be placeholder text.`);
  assert.equal(isWeakSourceContext(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be weak context.`);
  assert.equal(isWeakSourceContext(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be weak context.`);
  assert.equal(isCircularMeaning(phaseWord.normalisedWord, phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be circular.`);
  assert.equal(hasExplicitHintText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be spelling-hint text.`);
  assert.equal(hasExplicitHintText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be spelling-hint text.`);
  assert.equal(phaseWord.graphemeSegments.join(""), phaseWord.normalisedWord, `${phaseWord.normalisedWord} segments should reconstruct the word.`);
  assert.equal(phaseWord.graphemeSegments.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in segments.`);
  assert.equal(phaseWord.focusGraphemes.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in focus_graphemes.`);
  assert.equal(proofWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a proof word.`);
  assert.equal(phase7BWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7B word.`);
  assert.equal(phase7CWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7C word.`);
  assert.equal(phase7DWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7D word.`);
  assert.equal(phase7EWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7E word.`);
  assert.equal(phase7FWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7F word.`);
  assert.equal(phase7GWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7G word.`);
  assert.equal(phase7HWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7H word.`);

  const primaryLinks = (phase8BLinksByWord.get(phaseWord.normalisedWord) || [])
    .filter((link) => link.targetRole === "primary");
  assert.equal(primaryLinks.length, 1, `${phaseWord.normalisedWord} should have exactly one primary Phase 8B target link.`);
  assert.equal(primaryLinks[0]?.focusGrapheme, phaseWord.primaryFocusGrapheme, `${phaseWord.normalisedWord} primary link should match primary focus.`);
}

for (const phaseWord of phase8CWords) {
  assert.equal(phaseWord.source, "wordloom_core", `${phaseWord.normalisedWord} should be Wordloom core source.`);
  assert.equal(phaseWord.sourceVersion, PHASE_8C_SOURCE_VERSION, `${phaseWord.normalisedWord} should carry Phase 8C source_version.`);
  assert.equal(phaseWord.approvalStatus, "approved", `${phaseWord.normalisedWord} should be approved.`);
  assert.equal(phaseWord.suitabilityStatus, "suitable", `${phaseWord.normalisedWord} should be suitable.`);
  assert.equal(phaseWord.active, true, `${phaseWord.normalisedWord} should be active.`);
  assert.equal(String(phaseWord.sentence || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful sentence.`);
  assert.equal(String(phaseWord.meaning || "").trim().length >= 12, true, `${phaseWord.normalisedWord} should have a useful meaning.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be placeholder text.`);
  assert.equal(hasSourcePlaceholderText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be placeholder text.`);
  assert.equal(isWeakSourceContext(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be weak context.`);
  assert.equal(isWeakSourceContext(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be weak context.`);
  assert.equal(isCircularMeaning(phaseWord.normalisedWord, phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be circular.`);
  assert.equal(hasExplicitHintText(phaseWord.sentence), false, `${phaseWord.normalisedWord} sentence should not be spelling-hint text.`);
  assert.equal(hasExplicitHintText(phaseWord.meaning), false, `${phaseWord.normalisedWord} meaning should not be spelling-hint text.`);
  assert.equal(phaseWord.graphemeSegments.join(""), phaseWord.normalisedWord, `${phaseWord.normalisedWord} segments should reconstruct the word.`);
  assert.equal(phaseWord.graphemeSegments.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in segments.`);
  assert.equal(phaseWord.focusGraphemes.includes(phaseWord.primaryFocusGrapheme), true, `${phaseWord.normalisedWord} primary focus should be in focus_graphemes.`);
  assert.equal(proofWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a proof word.`);
  assert.equal(phase7BWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7B word.`);
  assert.equal(phase7CWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7C word.`);
  assert.equal(phase7DWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7D word.`);
  assert.equal(phase7EWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7E word.`);
  assert.equal(phase7FWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7F word.`);
  assert.equal(phase7GWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7G word.`);
  assert.equal(phase7HWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 7H word.`);
  assert.equal(phase8BWordsByNormalised.has(phaseWord.normalisedWord), false, `${phaseWord.normalisedWord} should not duplicate a Phase 8B word.`);

  const primaryLinks = (phase8CLinksByWord.get(phaseWord.normalisedWord) || [])
    .filter((link) => link.targetRole === "primary");
  assert.equal(primaryLinks.length, 1, `${phaseWord.normalisedWord} should have exactly one primary Phase 8C target link.`);
  assert.equal(primaryLinks[0]?.focusGrapheme, phaseWord.primaryFocusGrapheme, `${phaseWord.normalisedWord} primary link should match primary focus.`);
}

const combinedTargetByFocus = new Map();
for (const target of proofTargets) combinedTargetByFocus.set(target.focusGrapheme, target);
for (const target of phase7BTargets) {
  const existing = combinedTargetByFocus.get(target.focusGrapheme);
  if (existing) {
    assert.equal(target.challengeBand, existing.challengeBand, `${target.focusGrapheme} Phase 7B target should preserve challenge band.`);
    assert.equal(target.stageBand, existing.stageBand, `${target.focusGrapheme} Phase 7B target should preserve stage band.`);
  } else {
    combinedTargetByFocus.set(target.focusGrapheme, target);
  }
}
for (const target of phase7CTargets) {
  const existing = combinedTargetByFocus.get(target.focusGrapheme);
  if (existing) {
    assert.equal(target.challengeBand, existing.challengeBand, `${target.focusGrapheme} Phase 7C target should preserve challenge band.`);
    assert.equal(target.stageBand, existing.stageBand, `${target.focusGrapheme} Phase 7C target should preserve stage band.`);
  } else {
    combinedTargetByFocus.set(target.focusGrapheme, target);
  }
}
for (const target of phase7DTargets) {
  const existing = combinedTargetByFocus.get(target.focusGrapheme);
  if (existing) {
    assert.equal(target.challengeBand, existing.challengeBand, `${target.focusGrapheme} Phase 7D target should preserve challenge band.`);
    assert.equal(target.stageBand, existing.stageBand, `${target.focusGrapheme} Phase 7D target should preserve stage band.`);
  } else {
    combinedTargetByFocus.set(target.focusGrapheme, target);
  }
}
for (const target of phase7ETargets) {
  const existing = combinedTargetByFocus.get(target.focusGrapheme);
  if (existing) {
    assert.equal(target.challengeBand, existing.challengeBand, `${target.focusGrapheme} Phase 7E target should preserve challenge band.`);
    assert.equal(target.stageBand, existing.stageBand, `${target.focusGrapheme} Phase 7E target should preserve stage band.`);
  } else {
    combinedTargetByFocus.set(target.focusGrapheme, target);
  }
}
for (const target of phase7FTargets) {
  const existing = combinedTargetByFocus.get(target.focusGrapheme);
  if (existing) {
    assert.equal(target.challengeBand, existing.challengeBand, `${target.focusGrapheme} Phase 7F target should preserve challenge band.`);
    assert.equal(target.stageBand, existing.stageBand, `${target.focusGrapheme} Phase 7F target should preserve stage band.`);
  } else {
    combinedTargetByFocus.set(target.focusGrapheme, target);
  }
}
for (const target of phase7GTargets) {
  const existing = combinedTargetByFocus.get(target.focusGrapheme);
  if (existing) {
    assert.equal(target.challengeBand, existing.challengeBand, `${target.focusGrapheme} Phase 7G target should preserve challenge band.`);
    assert.equal(target.stageBand, existing.stageBand, `${target.focusGrapheme} Phase 7G target should preserve stage band.`);
  } else {
    combinedTargetByFocus.set(target.focusGrapheme, target);
  }
}
for (const target of phase7HTargets) {
  const existing = combinedTargetByFocus.get(target.focusGrapheme);
  if (existing) {
    assert.equal(target.challengeBand, existing.challengeBand, `${target.focusGrapheme} Phase 7H target should preserve challenge band.`);
    assert.equal(target.stageBand, existing.stageBand, `${target.focusGrapheme} Phase 7H target should preserve stage band.`);
  } else {
    combinedTargetByFocus.set(target.focusGrapheme, target);
  }
}
for (const target of phase8BTargets) {
  const existing = combinedTargetByFocus.get(target.focusGrapheme);
  if (existing) {
    assert.equal(target.challengeBand, existing.challengeBand, `${target.focusGrapheme} Phase 8B target should preserve challenge band.`);
    assert.equal(target.stageBand, existing.stageBand, `${target.focusGrapheme} Phase 8B target should preserve stage band.`);
  } else {
    combinedTargetByFocus.set(target.focusGrapheme, target);
  }
}
for (const target of phase8CTargets) {
  const existing = combinedTargetByFocus.get(target.focusGrapheme);
  if (existing) {
    assert.equal(target.challengeBand, existing.challengeBand, `${target.focusGrapheme} Phase 8C target should preserve challenge band.`);
    assert.equal(target.stageBand, existing.stageBand, `${target.focusGrapheme} Phase 8C target should preserve stage band.`);
  } else {
    combinedTargetByFocus.set(target.focusGrapheme, target);
  }
}
const combinedTargets = [...combinedTargetByFocus.values()]
  .sort((a, b) => a.sortOrder - b.sortOrder || a.focusGrapheme.localeCompare(b.focusGrapheme));
assert.equal(combinedTargets.length, 30, "Proof plus Phase 7B through Phase 8C should cover 30 production targets.");
assert.equal(combinedTargets.some((target) => target.focusGrapheme === "aw"), true, "Combined production coverage should include aw.");
assert.equal(combinedTargets.some((target) => target.focusGrapheme === "ure"), true, "Combined production coverage should include ure.");
const productionWords = [
  ...proofWords,
  ...phase7BWords,
  ...phase7CWords,
  ...phase7DWords,
  ...phase7EWords,
  ...phase7FWords,
  ...phase7GWords,
  ...phase7HWords,
  ...phase8BWords,
  ...phase8CWords,
];
const assignmentRows = [
  ...proofWords.map((proofWord) => toAssignmentWordRow(proofWord, PROOF_SOURCE_VERSION)),
  ...phase7BWords.map((phaseWord) => toAssignmentWordRow(phaseWord, PHASE_7B_SOURCE_VERSION)),
  ...phase7CWords.map((phaseWord) => toAssignmentWordRow(phaseWord, PHASE_7C_SOURCE_VERSION)),
  ...phase7DWords.map((phaseWord) => toAssignmentWordRow(phaseWord, PHASE_7D_SOURCE_VERSION)),
  ...phase7EWords.map((phaseWord) => toAssignmentWordRow(phaseWord, PHASE_7E_SOURCE_VERSION)),
  ...phase7FWords.map((phaseWord) => toAssignmentWordRow(phaseWord, PHASE_7F_SOURCE_VERSION)),
  ...phase7GWords.map((phaseWord) => toAssignmentWordRow(phaseWord, PHASE_7G_SOURCE_VERSION)),
  ...phase7HWords.map((phaseWord) => toAssignmentWordRow(phaseWord, PHASE_7H_SOURCE_VERSION)),
  ...phase8BWords.map((phaseWord) => toAssignmentWordRow(phaseWord, PHASE_8B_SOURCE_VERSION)),
  ...phase8CWords.map((phaseWord) => toAssignmentWordRow(phaseWord, PHASE_8C_SOURCE_VERSION)),
];
assert.equal(assignmentRows.length, 1500, "Proof plus Phase 7B through Phase 8C should provide 1,500 production words.");

const targetByFocus = new Map(combinedTargets.map((target) => [target.focusGrapheme, target]));
const normalisedWordCounts = countRowsByKey(productionWords, (word) => word.normalisedWord);
const productionBankAudit = {
  activeApprovedSuitableWordloomCoreCount: productionWords.length,
  duplicateNormalisedWords: Object.entries(normalisedWordCounts)
    .filter(([, count]) => count > 1)
    .map(([word]) => word)
    .sort(),
  missingSentenceCount: productionWords.filter((word) => !String(word.sentence || "").trim()).length,
  missingMeaningCount: productionWords.filter((word) => !String(word.meaning || "").trim()).length,
  primaryCoverage: Object.fromEntries(
    [...EXPECTED_PHASE_8C_PRODUCTION_TOTALS.keys()].map((focus) => [
      focus,
      combinedWordCountByGrapheme.get(focus) || 0,
    ]),
  ),
  stageCoverage: countRowsByKey(productionWords, (word) => word.stageBand),
  challengeCoverage: countRowsByKey(
    productionWords,
    (word) => targetByFocus.get(word.primaryFocusGrapheme)?.challengeBand,
  ),
  difficultyLabelCoverage: countRowsByKey(productionWords, (word) => difficultyBandForLabel(word.difficultyLabel)),
  difficultyWindowCoverage: {
    needs_support: productionWords.filter((word) => word.difficultyScore >= 15 && word.difficultyScore <= 50).length,
    core_developing: productionWords.filter((word) => word.difficultyScore >= 25 && word.difficultyScore <= 60).length,
    secure_expected: productionWords.filter((word) => word.difficultyScore >= 35 && word.difficultyScore <= 65).length,
    early_stretch: productionWords.filter((word) => word.difficultyScore >= 55 && word.difficultyScore <= 80).length,
  },
};

assert.equal(productionBankAudit.activeApprovedSuitableWordloomCoreCount, 1500, "Current production bank audit should cover exactly 1,500 active approved suitable Wordloom core words.");
assert.deepEqual(productionBankAudit.duplicateNormalisedWords, [], "Current production bank audit should not find duplicate active normalised words.");
assert.equal(productionBankAudit.missingSentenceCount, 0, "Current production bank audit should not find missing sentence support.");
assert.equal(productionBankAudit.missingMeaningCount, 0, "Current production bank audit should not find missing meaning support.");
assert.deepEqual(productionBankAudit.primaryCoverage, Object.fromEntries(EXPECTED_PHASE_8C_PRODUCTION_TOTALS), "Current production bank audit should match expected per-focus primary coverage.");
assert.deepEqual(productionBankAudit.stageCoverage, {
  floor_core: 741,
  diagnostic: 427,
  ceiling_challenge: 332,
});
assert.deepEqual(productionBankAudit.challengeCoverage, {
  needs_support: 336,
  core_developing: 494,
  secure_expected: 456,
  early_stretch: 214,
});
assert.equal(productionBankAudit.difficultyLabelCoverage.easier > 0, true, "Current production bank audit should include easier words.");
assert.equal(productionBankAudit.difficultyLabelCoverage.core > 0, true, "Current production bank audit should include core words.");
assert.equal(productionBankAudit.difficultyLabelCoverage.challenge > 0, true, "Current production bank audit should include stretch/challenge words.");
assert.equal(productionBankAudit.difficultyWindowCoverage.needs_support > 0, true, "Current production bank audit should include needs-support score coverage.");
assert.equal(productionBankAudit.difficultyWindowCoverage.core_developing > 0, true, "Current production bank audit should include core-developing score coverage.");
assert.equal(productionBankAudit.difficultyWindowCoverage.secure_expected > 0, true, "Current production bank audit should include secure-expected score coverage.");
assert.equal(productionBankAudit.difficultyWindowCoverage.early_stretch > 0, true, "Current production bank audit should include early-stretch score coverage.");

for (const [focus, expectedCount] of EXPECTED_PHASE_8C_PRODUCTION_TOTALS) {
  assert.equal(
    combinedWordCountByGrapheme.get(focus) || 0,
    expectedCount,
    `${focus} should have ${expectedCount} production words after Phase 8C.`,
  );
}

const coverageReportRows = [];

for (const target of combinedTargets) {
  const pupilId = `coverage-${target.focusGrapheme}`;
  const plan = buildPlanForTarget({
    target,
    targets: combinedTargets,
    assignmentRows,
    pupilId,
  });
  const pupilPlan = plan.pupilPlans?.[0] || null;
  const selectedWords = pupilPlan?.words || [];
  const selectedWordTexts = selectedWords.map((item) => item.word);
  const duplicateWords = selectedWordTexts
    .filter((word, index) => selectedWordTexts.indexOf(word) !== index);
  const selectedPrimaryTargetCount = selectedWords
    .filter((item) => item.assignmentRole === "target" && item.focusGrapheme === target.focusGrapheme)
    .length;
  const warnings = getTargetCoverageWarnings(plan);
  const warning = warnings[0] || null;

  const rowErrors = [];
  if (plan.error) rowErrors.push(plan.error);
  if (!pupilPlan) rowErrors.push("missing_pupil_plan");
  if (selectedWords.length !== EXPECTED_ASSIGNMENT_WORD_COUNT) {
    rowErrors.push(`selected_word_count_${selectedWords.length}`);
  }
  if (duplicateWords.length) rowErrors.push(`duplicate_words_${duplicateWords.join("|")}`);
  if (selectedPrimaryTargetCount < 1) rowErrors.push("no_primary_target_word_selected");

  assert.equal(plan.error, "", `${target.focusGrapheme} should not fail plan generation.`);
  assert.ok(pupilPlan, `${target.focusGrapheme} should generate one pupil plan.`);
  assert.equal(
    selectedWords.length,
    EXPECTED_ASSIGNMENT_WORD_COUNT,
    `${target.focusGrapheme} should select ${EXPECTED_ASSIGNMENT_WORD_COUNT} words.`,
  );
  assert.equal(
    new Set(selectedWordTexts).size,
    selectedWordTexts.length,
    `${target.focusGrapheme} should not select duplicate words.`,
  );
  assert.equal(
    selectedPrimaryTargetCount >= 1,
    true,
    `${target.focusGrapheme} should select at least one primary target word.`,
  );
  assertExpectedWarning(target, warnings);

  coverageReportRows.push({
    grapheme: target.focusGrapheme,
    proofWordCount: proofWordCountByGrapheme.get(target.focusGrapheme) || 0,
    phase7BWordCount: phase7BWordCountByGrapheme.get(target.focusGrapheme) || 0,
    phase7CWordCount: phase7CWordCountByGrapheme.get(target.focusGrapheme) || 0,
    phase7DWordCount: phase7DWordCountByGrapheme.get(target.focusGrapheme) || 0,
    phase7EWordCount: phase7EWordCountByGrapheme.get(target.focusGrapheme) || 0,
    phase7FWordCount: phase7FWordCountByGrapheme.get(target.focusGrapheme) || 0,
    phase7GWordCount: phase7GWordCountByGrapheme.get(target.focusGrapheme) || 0,
    phase7HWordCount: phase7HWordCountByGrapheme.get(target.focusGrapheme) || 0,
    phase8BWordCount: phase8BWordCountByGrapheme.get(target.focusGrapheme) || 0,
    phase8CWordCount: phase8CWordCountByGrapheme.get(target.focusGrapheme) || 0,
    combinedWordCount: combinedWordCountByGrapheme.get(target.focusGrapheme) || 0,
    selectedWordCount: selectedWords.length,
    selectedPrimaryTargetCount,
    warningType: warning?.type || null,
    warningSelected: warning?.selectedTargetCount ?? null,
    warningRequested: warning?.requestedTargetCount ?? null,
    errors: rowErrors,
  });
}

const aiTarget = combinedTargets.find((target) => target.focusGrapheme === "ai");
assert.ok(aiTarget, "Expected ai proof target for exclusion guard.");

const invalidRows = invalidWordRowsForExclusionGuard();
const exclusionPlan = buildPlanForTarget({
  target: aiTarget,
  targets: combinedTargets,
  assignmentRows: [...assignmentRows, ...invalidRows],
  pupilId: "coverage-exclusion-ai",
});
const selectedInvalidWords = new Set(exclusionPlan.pupilPlans?.[0]?.words?.map((item) => item.word) || []);
for (const invalidRow of invalidRows) {
  assert.equal(
    selectedInvalidWords.has(invalidRow.word),
    false,
    `${invalidRow.word} should be excluded from generated assignments.`,
  );
}

const report = {
  proofTargetCount: proofTargets.length,
  phase7BTargetCount: phase7BTargets.length,
  phase7CTargetCount: phase7CTargets.length,
  phase7DTargetCount: phase7DTargets.length,
  phase7ETargetCount: phase7ETargets.length,
  phase7FTargetCount: phase7FTargets.length,
  phase7GTargetCount: phase7GTargets.length,
  phase7HTargetCount: phase7HTargets.length,
  phase8BTargetCount: phase8BTargets.length,
  phase8CTargetCount: phase8CTargets.length,
  targetCount: combinedTargets.length,
  proofWordCount: proofWords.length,
  phase7BWordCount: phase7BWords.length,
  phase7CWordCount: phase7CWords.length,
  phase7DWordCount: phase7DWords.length,
  phase7EWordCount: phase7EWords.length,
  phase7FWordCount: phase7FWords.length,
  phase7GWordCount: phase7GWords.length,
  phase7HWordCount: phase7HWords.length,
  phase8BWordCount: phase8BWords.length,
  phase8CWordCount: phase8CWords.length,
  combinedWordCount: assignmentRows.length,
  assignmentWordCount: EXPECTED_ASSIGNMENT_WORD_COUNT,
  sourceVersion: sourceCoverageReport.sourceVersion,
  sourceTargetCount: sourceCoverageReport.sourceTargetCount,
  sourceWordCount: sourceCoverageReport.sourceWordCount,
  sourceValidationWarningCount: sourceCoverageReport.sourceValidationWarningCount,
  sourceTargets: sourceCoverageReport.sourceTargets,
  sourceContext: sourceCoverageReport.sourceContext,
  expectedWarnings: Object.fromEntries(
    [...EXPECTED_LOW_COVERAGE_WARNINGS.entries()]
      .map(([grapheme, warning]) => [
        grapheme,
        `${warning.selectedTargetCount}/${warning.requestedTargetCount}`,
      ]),
  ),
  graphemes: coverageReportRows,
  gaps: coverageReportRows
    .filter((row) => row.errors.length)
    .map((row) => ({ grapheme: row.grapheme, errors: row.errors })),
};

console.log(`WORDLOOM_CORE_COVERAGE_REPORT ${JSON.stringify(report)}`);
