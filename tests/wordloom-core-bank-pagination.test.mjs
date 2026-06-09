import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

function loadDbHelpers({ supabase, globals = {} }) {
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
    supabase,
    ...globals,
  };
  vm.runInNewContext(transformedSource, context, { filename: sourcePath });
  return context.module.exports;
}

function makeCoreWord(index) {
  const padded = String(index).padStart(4, "0");
  return {
    id: `word-${padded}`,
    word: `bankword${padded}`,
    normalised_word: `bankword${padded}`,
    grapheme_segments: ["b", "a", "nk", "w", "or", "d"],
    focus_graphemes: ["or"],
    primary_focus_grapheme: "or",
    stage_band: "floor_core",
    difficulty_score: 30 + (index % 40),
    difficulty_label: index % 5 === 0 ? "Stretch" : "Core",
    difficulty_reason: "Pagination test word.",
    sentence: `The bankword${padded} row is used in a test sentence.`,
    meaning: "A generated row used to check pagination.",
    suitability_status: "suitable",
    approval_status: "approved",
    source: "wordloom_core",
    source_version: "pagination_test",
    is_active: true,
  };
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function createMockSupabase({ wordRows, wordTargetRows, focusTargetRows }) {
  const calls = [];
  const tables = {
    wordloom_core_words: wordRows,
    wordloom_core_word_targets: wordTargetRows,
    wordloom_core_focus_targets: focusTargetRows,
  };

  class Query {
    constructor(tableName) {
      this.tableName = tableName;
      this.filters = [];
      this.orders = [];
      this.rangeBounds = null;
    }

    select() {
      return this;
    }

    eq(field, value) {
      this.filters.push({ type: "eq", field, value });
      return this;
    }

    in(field, values) {
      this.filters.push({ type: "in", field, values: new Set(values || []) });
      return this;
    }

    order(field, options = {}) {
      this.orders.push({ field, ascending: options.ascending !== false });
      return this;
    }

    range(from, to) {
      this.rangeBounds = [from, to];
      return this;
    }

    then(resolve, reject) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }

    execute() {
      calls.push({
        tableName: this.tableName,
        filters: this.filters.map((filter) => ({ ...filter, values: filter.values ? [...filter.values] : undefined })),
        rangeBounds: this.rangeBounds,
      });

      let rows = [...(tables[this.tableName] || [])];
      for (const filter of this.filters) {
        if (filter.type === "eq") rows = rows.filter((row) => row?.[filter.field] === filter.value);
        if (filter.type === "in") rows = rows.filter((row) => filter.values.has(row?.[filter.field]));
      }
      for (const order of [...this.orders].reverse()) {
        rows.sort((a, b) => {
          const result = compareValues(a?.[order.field], b?.[order.field]);
          return order.ascending ? result : -result;
        });
      }
      if (this.rangeBounds) {
        rows = rows.slice(this.rangeBounds[0], this.rangeBounds[1] + 1);
      }
      return { data: rows, error: null };
    }
  }

  return {
    calls,
    from(tableName) {
      return new Query(tableName);
    },
  };
}

const wordRows = Array.from({ length: 1205 }, (_item, index) => makeCoreWord(index + 1));
const wordTargetRows = wordRows.map((row) => ({
  id: `link-${row.id}`,
  word_id: row.id,
  focus_target_id: "target-or",
  focus_grapheme: "or",
  target_role: "primary",
  pattern_type: "r_controlled",
  difficulty_modifier: 0,
}));
const focusTargetRows = [{ id: "target-or", focus_grapheme: "or", is_active: true }];
const supabase = createMockSupabase({ wordRows, wordTargetRows, focusTargetRows });
const { listWordloomCoreSpellingBankWordRows } = loadDbHelpers({ supabase });

const mappedRows = await listWordloomCoreSpellingBankWordRows();
const wordPageCalls = supabase.calls.filter((call) => call.tableName === "wordloom_core_words");

assert.equal(mappedRows.length, 1205);
assert.deepEqual(
  wordPageCalls.map((call) => call.rangeBounds),
  [[0, 999], [1000, 1999]],
);
assert.equal(mappedRows[0].choice.source, "wordloom_core");
assert.equal(mappedRows.at(-1).choice.origin_word_source, "wordloom_core");
assert.equal(new Set(mappedRows.map((row) => row.choice.origin_bank_word_id)).size, 1205);

const monitorWordRows = Array.from({ length: 2205 }, (_item, index) => makeCoreWord(index + 1));
const monitorWordTargetRows = monitorWordRows.map((row) => ({
  id: `monitor-link-${row.id}`,
  word_id: row.id,
  focus_target_id: "target-or",
  focus_grapheme: "or",
  target_role: "primary",
  pattern_type: "r_controlled",
  difficulty_modifier: 0,
}));
const monitorSupabase = createMockSupabase({
  wordRows: monitorWordRows,
  wordTargetRows: monitorWordTargetRows,
  focusTargetRows,
});
const { readWordloomCoreBankMonitor } = loadDbHelpers({
  supabase: monitorSupabase,
  globals: {
    buildGeneratedAssignmentPlan: () => ({ coverageWarnings: [] }),
  },
});
const monitor = await readWordloomCoreBankMonitor();
const monitorWordPageCalls = monitorSupabase.calls.filter((call) => call.tableName === "wordloom_core_words");

assert.equal(monitor.totalCoreWordCount, 2205);
assert.equal(monitor.usableActiveWordCount, 2205);
assert.deepEqual(
  monitorWordPageCalls.map((call) => call.rangeBounds),
  [[0, 999], [1000, 1999], [2000, 2999]],
);

const edgeFunctionSource = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../supabase/functions/provision-personalised-assignment/index.ts"),
  "utf8",
);
assert.doesNotMatch(edgeFunctionSource, /Math\.min\(1000,\s*Math\.round\(Number\(limit\)/);
assert.match(edgeFunctionSource, /\.range\(from, to\)/);

console.log("Passed Wordloom core bank pagination checks.");
