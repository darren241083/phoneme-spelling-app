import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadBrowserModule } from "./load-browser-module.mjs";

const EXPECTED_PROOF_TARGET_COUNT = 24;
const EXPECTED_PROOF_WORD_COUNT = 150;
const EXPECTED_ASSIGNMENT_WORD_COUNT = 10;
const EXPECTED_LOW_COVERAGE_WARNINGS = new Map([
  ["air", { selectedTargetCount: 2, requestedTargetCount: 4 }],
  ["au", { selectedTargetCount: 3, requestedTargetCount: 4 }],
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

function difficultyBandForLabel(label = "") {
  const clean = String(label || "").trim().toLowerCase();
  if (clean.includes("stretch") || clean.includes("challenge")) return "challenge";
  if (clean.includes("easier") || clean.includes("foundation")) return "easier";
  return "core";
}

function toAssignmentWordRow(proofWord) {
  const band = difficultyBandForLabel(proofWord.difficultyLabel);
  return {
    id: `core-${proofWord.normalisedWord}`,
    word: proofWord.normalisedWord,
    sentence: proofWord.sentence,
    segments: proofWord.graphemeSegments,
    choice: {
      source: "wordloom_core",
      source_version: "wordloom_core_proof_v1",
      origin_word_source: "wordloom_core",
      origin_bank_word_id: `core-${proofWord.normalisedWord}`,
      focus_graphemes: [proofWord.primaryFocusGrapheme],
      primary_focus_grapheme: proofWord.primaryFocusGrapheme,
      focus_target_links: [{
        focus_grapheme: proofWord.primaryFocusGrapheme,
        target_role: "primary",
      }],
      selection_suitability: "standard",
      suitability_status: "suitable",
      approval_status: "approved",
      is_active: true,
      context_support: {
        sentence: proofWord.sentence,
        sentence_status: "approved",
        sentence_required: false,
        meaning: proofWord.meaning,
        meaning_status: "approved",
        meaning_enabled: true,
        meaning_enabled_by_default: true,
      },
      difficulty: {
        version: "wordloom_core",
        coreScore: proofWord.difficultyScore,
        adjustedScore: proofWord.difficultyScore,
        score: proofWord.difficultyScore,
        band,
        coreBand: band,
        label: proofWord.difficultyLabel,
        coreLabel: proofWord.difficultyLabel,
        reasons: proofWord.difficultyReason ? [proofWord.difficultyReason] : [],
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
    buildRow({ id: "invalid-inactive-ai", word: "trail", active: false }),
    buildRow({ id: "invalid-blocked-ai", word: "brain", selectionSuitability: "blocked" }),
    buildRow({ id: "invalid-unsuitable-ai", word: "raise", suitabilityStatus: "unsuitable" }),
    buildRow({ id: "invalid-excluded-ai", word: "plain", suitabilityStatus: "exclude", selectionSuitability: "exclude" }),
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

const migrationSql = readFileSync(proofSetMigrationPath, "utf8");
const proofTargets = parseProofTargets(migrationSql);
const proofWords = parseProofWords(migrationSql);
const assignmentRows = proofWords.map((proofWord) => toAssignmentWordRow(proofWord));
const proofWordCountByGrapheme = new Map();

for (const proofWord of proofWords) {
  proofWordCountByGrapheme.set(
    proofWord.primaryFocusGrapheme,
    (proofWordCountByGrapheme.get(proofWord.primaryFocusGrapheme) || 0) + 1,
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

const coverageReportRows = [];

for (const target of proofTargets) {
  const pupilId = `coverage-${target.focusGrapheme}`;
  const plan = buildPlanForTarget({
    target,
    targets: proofTargets,
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
    selectedWordCount: selectedWords.length,
    selectedPrimaryTargetCount,
    warningType: warning?.type || null,
    warningSelected: warning?.selectedTargetCount ?? null,
    warningRequested: warning?.requestedTargetCount ?? null,
    errors: rowErrors,
  });
}

const aiTarget = proofTargets.find((target) => target.focusGrapheme === "ai");
assert.ok(aiTarget, "Expected ai proof target for exclusion guard.");

const invalidRows = invalidWordRowsForExclusionGuard();
const exclusionPlan = buildPlanForTarget({
  target: aiTarget,
  targets: proofTargets,
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
  targetCount: proofTargets.length,
  proofWordCount: proofWords.length,
  assignmentWordCount: EXPECTED_ASSIGNMENT_WORD_COUNT,
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
