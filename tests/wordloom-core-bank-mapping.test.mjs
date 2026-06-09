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
  mapWordloomCoreBankRowsToWordRows,
} = loadDbHelpers();

const focusTargetRows = [
  { id: "target-ar", focus_grapheme: "ar", is_active: true },
  { id: "target-ai", focus_grapheme: "ai", is_active: true },
  { id: "target-inactive", focus_grapheme: "or", is_active: false },
];

function coreWord(overrides = {}) {
  return {
    id: "word-ar-1",
    word: "farm",
    normalised_word: "farm",
    grapheme_segments: ["f", "ar", "m"],
    focus_graphemes: ["ar"],
    primary_focus_grapheme: "ar",
    difficulty_score: 34,
    difficulty_label: "Core",
    difficulty_reason: "Common ar word.",
    sentence: "The farm kept sheep.",
    meaning: "Land used for growing food.",
    suitability_status: "suitable",
    approval_status: "approved",
    source: "wordloom_core",
    source_version: "proof",
    is_active: true,
    ...overrides,
  };
}

function targetLink(overrides = {}) {
  return {
    id: "link-ar-1",
    word_id: "word-ar-1",
    focus_target_id: "target-ar",
    focus_grapheme: "ar",
    target_role: "primary",
    difficulty_modifier: 0,
    ...overrides,
  };
}

const mapped = mapWordloomCoreBankRowsToWordRows({
  wordRows: [
    coreWord(),
    coreWord({ id: "word-pending", word: "park", normalised_word: "park", approval_status: "pending" }),
    coreWord({ id: "word-caution", word: "cart", normalised_word: "cart", suitability_status: "caution" }),
    coreWord({ id: "word-inactive", word: "dark", normalised_word: "dark", is_active: false }),
    coreWord({ id: "word-no-active-link", word: "storm", normalised_word: "storm", primary_focus_grapheme: "or" }),
  ],
  wordTargetRows: [
    targetLink(),
    targetLink({ id: "link-pending", word_id: "word-pending" }),
    targetLink({ id: "link-caution", word_id: "word-caution" }),
    targetLink({ id: "link-inactive", word_id: "word-inactive" }),
    targetLink({
      id: "link-no-active-link",
      word_id: "word-no-active-link",
      focus_target_id: "target-inactive",
      focus_grapheme: "or",
    }),
  ],
  focusTargetRows,
});

assert.equal(mapped.length, 1);
assert.equal(mapped[0].word, "farm");
assert.equal(JSON.stringify(mapped[0].segments), JSON.stringify(["f", "ar", "m"]));
assert.equal(JSON.stringify(mapped[0].choice.focus_graphemes), JSON.stringify(["ar"]));
assert.equal(mapped[0].choice.source, "wordloom_core");
assert.equal(mapped[0].choice.origin_word_source, "wordloom_core");
assert.equal(mapped[0].choice.origin_bank_word_id, "word-ar-1");
assert.equal(mapped[0].choice.selection_suitability, "standard");
assert.equal(mapped[0].choice.approval_status, "approved");
assert.equal(mapped[0].choice.suitability_status, "suitable");
assert.equal(mapped[0].choice.difficulty.coreScore, 34);
assert.equal(mapped[0].choice.context_support.meaning, "Land used for growing food.");
assert.equal(mapped[0].choice.context_support.meaning_status, "approved");
assert.equal(mapped[0].choice.focus_target_links[0].target_role, "primary");

console.log("Passed Wordloom core bank mapping checks.");
