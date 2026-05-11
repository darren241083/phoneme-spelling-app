import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

function loadDbHelpers() {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const sourcePath = path.resolve(testDir, "../js/db.js");
  let source = readFileSync(sourcePath, "utf8");

  source = source.replace(/import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?\s*/g, "");

  const exportNames = [];
  source = source.replace(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    exportNames.push(name);
    return `async function ${name}`;
  });
  source = source.replace(/export function\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    exportNames.push(name);
    return `function ${name}`;
  });
  source = source.replace(/export const\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    exportNames.push(name);
    return `const ${name}`;
  });
  source = source.replace(/export\s*\{([^}]+)\};?\s*/g, (_match, names) => {
    for (const item of String(names || "").split(",")) {
      const [localName] = item.split(/\s+as\s+/i).map((part) => String(part || "").trim());
      if (localName) exportNames.push(localName);
    }
    return "";
  });

  const transformedSource = `${source}
module.exports = {
  ${[...new Set(exportNames)].join(",\n  ")}
};`;

  const context = {
    console,
    module: { exports: {} },
    exports: {},
    globalThis: {},
  };
  vm.runInNewContext(transformedSource, context, { filename: sourcePath });
  return context.module.exports;
}

const {
  buildWordloomCoreBankMonitorModel,
} = loadDbHelpers();

function target(id, focusGrapheme, overrides = {}) {
  return {
    id,
    focus_grapheme: focusGrapheme,
    display_label: focusGrapheme,
    stage_band: "floor_core",
    challenge_band: "secure_expected",
    sort_order: 10,
    is_active: true,
    ...overrides,
  };
}

function word(id, normalisedWord, focusGrapheme, overrides = {}) {
  return {
    id,
    word: normalisedWord,
    normalised_word: normalisedWord,
    grapheme_segments: normalisedWord.includes(focusGrapheme)
      ? normalisedWord.split(focusGrapheme).flatMap((part, index, list) =>
        index < list.length - 1 ? [part, focusGrapheme] : [part]
      ).filter(Boolean)
      : [normalisedWord],
    focus_graphemes: [focusGrapheme],
    primary_focus_grapheme: focusGrapheme,
    difficulty_score: 45,
    difficulty_label: "Core",
    difficulty_reason: "Test fixture.",
    sentence: `${normalisedWord} appears in a sentence.`,
    meaning: `${normalisedWord} meaning.`,
    suitability_status: "suitable",
    approval_status: "approved",
    source: "wordloom_core",
    source_version: "test",
    is_active: true,
    ...overrides,
  };
}

function link(id, wordId, targetId, focusGrapheme, overrides = {}) {
  return {
    id,
    word_id: wordId,
    focus_target_id: targetId,
    focus_grapheme: focusGrapheme,
    target_role: "primary",
    difficulty_modifier: 0,
    ...overrides,
  };
}

const focusTargetRows = [
  target("target-ai", "ai", { sort_order: 10 }),
  target("target-air", "air", { sort_order: 20 }),
  target("target-au", "au", { sort_order: 30 }),
  target("target-inactive", "zz", { sort_order: 40, is_active: false }),
];

const wordRows = [
  ...["rain", "wait", "train", "paint", "snail", "chain"].map((item, index) =>
    word(`word-ai-${index + 1}`, item, "ai")
  ),
  ...["chair", "fair", "stair", "hair", "pair"].map((item, index) =>
    word(`word-air-${index + 1}`, item, "air")
  ),
  word("word-au-1", "launch", "au"),
  word("word-au-pending", "author", "au", {
    approval_status: "pending",
    sentence: "",
    meaning: "",
  }),
  word("word-au-caution", "haunt", "au", {
    suitability_status: "caution",
  }),
  word("word-ai-inactive", "brain", "ai", {
    is_active: false,
  }),
];

const wordTargetRows = [
  ...wordRows
    .filter((row) => row.primary_focus_grapheme === "ai")
    .map((row, index) => link(`link-ai-${index + 1}`, row.id, "target-ai", "ai")),
  ...wordRows
    .filter((row) => row.primary_focus_grapheme === "air")
    .map((row, index) => link(`link-air-${index + 1}`, row.id, "target-air", "air")),
  ...wordRows
    .filter((row) => row.primary_focus_grapheme === "au")
    .map((row, index) => link(`link-au-${index + 1}`, row.id, "target-au", "au")),
];

const model = buildWordloomCoreBankMonitorModel({
  focusTargetRows,
  wordRows,
  wordTargetRows,
  selectorSmokeWarnings: [
    { focusGrapheme: "air", selectedTargetCount: 2, requestedTargetCount: 4 },
    { focus_grapheme: "au", selected_target_count: 3, requested_target_count: 4 },
  ],
  threshold: 6,
});

assert.equal(model.available, true);
assert.equal(model.totalCoreWordCount, 15);
assert.equal(model.usableActiveWordCount, 12);
assert.equal(model.activeFocusGraphemeCount, 3);
assert.equal(model.inactiveWordCount, 1);
assert.equal(model.missingSentenceCount, 1);
assert.equal(model.missingMeaningCount, 1);

const countsByGrapheme = Object.fromEntries(
  model.graphemes.map((row) => [row.focusGrapheme, row.usablePrimaryWordCount])
);
assert.deepEqual(countsByGrapheme, {
  ai: 6,
  air: 5,
  au: 1,
});
assert.deepEqual(Array.from(model.belowThresholdGraphemes, (row) => row.focusGrapheme), ["air", "au"]);

const approvalBreakdown = Object.fromEntries(model.approvalStatusBreakdown.map((row) => [row.status, row.count]));
assert.equal(approvalBreakdown.approved, 14);
assert.equal(approvalBreakdown.pending, 1);

const suitabilityBreakdown = Object.fromEntries(model.suitabilityStatusBreakdown.map((row) => [row.status, row.count]));
assert.equal(suitabilityBreakdown.suitable, 14);
assert.equal(suitabilityBreakdown.caution, 1);

assert.deepEqual(
  Array.from(
    model.selectorSmokeWarnings,
    (row) => `${row.focusGrapheme} ${row.selectedTargetCount}/${row.requestedTargetCount}`,
  ),
  ["air 2/4", "au 3/4"],
);
assert.equal(model.coverageConfidence.key, "needs_expansion");

const unavailable = buildWordloomCoreBankMonitorModel({
  available: false,
  message: "permission denied",
});
assert.equal(unavailable.available, false);
assert.equal(unavailable.coverageConfidence.key, "unavailable");
assert.equal(unavailable.graphemes.length, 0);

const empty = buildWordloomCoreBankMonitorModel();
assert.equal(empty.available, true);
assert.equal(empty.totalCoreWordCount, 0);
assert.equal(empty.coverageConfidence.key, "empty");

console.log("Passed Wordloom core bank monitor model checks.");
