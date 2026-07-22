import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROOF_SOURCE_VERSION = "wordloom_core_proof_v1";
const PHASE_CONFIGS = new Map([
  ["7b", {
    key: "7b",
    sourceVersion: "wordloom_core_v1_phase_7b_2026_05_13",
    migrationFilename: "20260513120000_wordloom_core_spelling_bank_phase_7b_launch_batch.sql",
    tempTablePrefix: "phase_7b",
    expectedCountColumn: "expected_phase_7b_word_count",
    title: "Phase 7B",
    noteText: "Wordloom core v1 Phase 7B launch batch target",
    linkNoteText: "Wordloom core v1 Phase 7B launch batch target link",
    expectedCounts: new Map([
      ["ay", 8],
      ["ea", 8],
      ["ew", 8],
      ["tch", 8],
      ["air", 4],
      ["au", 4],
    ]),
    includeExplicitHintSqlCheck: false,
    includeSchoolScopeSqlCheck: false,
  }],
  ["7c", {
    key: "7c",
    sourceVersion: "wordloom_core_v1_phase_7c_2026_05_13",
    migrationFilename: "20260513123000_wordloom_core_spelling_bank_phase_7c_aw_ure_topups.sql",
    tempTablePrefix: "phase_7c",
    expectedCountColumn: "expected_phase_7c_word_count",
    title: "Phase 7C",
    noteText: "Wordloom core v1 Phase 7C aw, ure, and active target top-up batch target",
    linkNoteText: "Wordloom core v1 Phase 7C aw, ure, and active target top-up batch target link",
    expectedCounts: new Map([
      ["aw", 8],
      ["ure", 8],
      ["ay", 4],
      ["ea", 4],
      ["ew", 4],
      ["tch", 4],
      ["air", 4],
      ["au", 4],
    ]),
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
  ["7d", {
    key: "7d",
    sourceVersion: "wordloom_core_v1_phase_7d_2026_05_13",
    migrationFilename: "20260513130000_wordloom_core_spelling_bank_phase_7d_proof_topups.sql",
    tempTablePrefix: "phase_7d",
    expectedCountColumn: "expected_phase_7d_word_count",
    title: "Phase 7D",
    noteText: "Wordloom core v1 Phase 7D proof-target top-up batch target",
    linkNoteText: "Wordloom core v1 Phase 7D proof-target top-up batch target link",
    expectedCounts: new Map([
      ["ai", 6],
      ["ee", 6],
      ["oa", 6],
      ["igh", 6],
      ["or", 6],
      ["sh", 6],
      ["ch", 6],
      ["ck", 6],
    ]),
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
  ["7e", {
    key: "7e",
    sourceVersion: "wordloom_core_v1_phase_7e_2026_05_13",
    migrationFilename: "20260513133000_wordloom_core_spelling_bank_phase_7e_bulk_topup.sql",
    tempTablePrefix: "phase_7e",
    expectedCountColumn: "expected_phase_7e_word_count",
    title: "Phase 7E",
    noteText: "Wordloom core v1 Phase 7E bulk top-up batch target",
    linkNoteText: "Wordloom core v1 Phase 7E bulk top-up batch target link",
    expectedCounts: new Map([
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
    ]),
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
  ["7f", {
    key: "7f",
    sourceVersion: "wordloom_core_v1_phase_7f_2026_05_13",
    migrationFilename: "20260513140000_wordloom_core_spelling_bank_phase_7f_bulk_topup.sql",
    tempTablePrefix: "phase_7f",
    expectedCountColumn: "expected_phase_7f_word_count",
    title: "Phase 7F",
    noteText: "Wordloom core v1 Phase 7F bulk common-target strengthening batch target",
    linkNoteText: "Wordloom core v1 Phase 7F bulk common-target strengthening batch target link",
    expectedCounts: new Map([
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
    ]),
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
  ["7g", {
    key: "7g",
    sourceVersion: "wordloom_core_v1_phase_7g_2026_05_13",
    migrationFilename: "20260513143000_wordloom_core_spelling_bank_phase_7g_bulk_topup.sql",
    tempTablePrefix: "phase_7g",
    expectedCountColumn: "expected_phase_7g_word_count",
    title: "Phase 7G",
    noteText: "Wordloom core v1 Phase 7G bulk top-up batch target",
    linkNoteText: "Wordloom core v1 Phase 7G bulk top-up batch target link",
    expectedCounts: new Map([
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
    ]),
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
  ["7h", {
    key: "7h",
    sourceVersion: "wordloom_core_v1_phase_7h_2026_05_13",
    migrationFilename: "20260513150000_wordloom_core_spelling_bank_phase_7h_bulk_topup.sql",
    tempTablePrefix: "phase_7h",
    expectedCountColumn: "expected_phase_7h_word_count",
    title: "Phase 7H",
    noteText: "Wordloom core v1 Phase 7H final core-bank expansion batch target",
    linkNoteText: "Wordloom core v1 Phase 7H final core-bank expansion batch target link",
    expectedCounts: new Map([
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
    ]),
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
  ["8b", {
    key: "8b",
    sourceVersion: "wordloom_core_v1_phase_8b_2026_05_13",
    migrationFilename: "20260513153000_wordloom_core_spelling_bank_phase_8b_structured_expansion_batch_1.sql",
    tempTablePrefix: "phase_8b",
    expectedCountColumn: "expected_phase_8b_word_count",
    title: "Phase 8B",
    noteText: "Wordloom core v1 Phase 8B structured expansion batch 1 target",
    linkNoteText: "Wordloom core v1 Phase 8B structured expansion batch 1 target link",
    expectedCounts: new Map([
      ["ear", 22],
      ["oy", 28],
      ["oi", 30],
      ["dge", 30],
      ["ie", 28],
      ["ci", 32],
      ["au", 24],
      ["ure", 30],
      ["tch", 26],
    ]),
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
  ["8c", {
    key: "8c",
    sourceVersion: "wordloom_core_v1_phase_8c_2026_05_14",
    migrationFilename: "20260514120000_wordloom_core_spelling_bank_phase_8c_structured_expansion_batch_2.sql",
    tempTablePrefix: "phase_8c",
    expectedCountColumn: "expected_phase_8c_word_count",
    title: "Phase 8C",
    noteText: "Wordloom core v1 Phase 8C structured expansion batch 2 target",
    linkNoteText: "Wordloom core v1 Phase 8C structured expansion batch 2 target link",
    expectedCounts: new Map([
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
    ]),
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
  ["8d", {
    key: "8d",
    sourceVersion: "wordloom_core_v1_phase_8d_2026_05_14",
    migrationFilename: "20260514123000_wordloom_core_spelling_bank_phase_8d_structured_expansion_batch_3.sql",
    tempTablePrefix: "phase_8d",
    expectedCountColumn: "expected_phase_8d_word_count",
    title: "Phase 8D",
    noteText: "Wordloom core v1 Phase 8D structured expansion batch 3 target",
    linkNoteText: "Wordloom core v1 Phase 8D structured expansion batch 3 target link",
    expectedCounts: new Map([
      ["ar", 14],
      ["er", 14],
      ["ea", 14],
      ["ee", 12],
      ["oa", 12],
      ["ai", 10],
      ["igh", 10],
      ["or", 10],
      ["air", 10],
      ["ou", 10],
      ["ow", 10],
      ["sh", 10],
      ["ch", 10],
      ["th", 10],
      ["ng", 10],
      ["ck", 10],
      ["tion", 10],
      ["ur", 10],
      ["ay", 10],
      ["ew", 10],
      ["aw", 10],
      ["ear", 6],
      ["au", 4],
      ["ure", 4],
      ["tch", 4],
      ["oy", 2],
      ["ie", 2],
      ["ci", 2],
    ]),
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
  ["4d1", {
    key: "4d1",
    sourceVersion: "wordloom_core_v1_phase_4d1_tion_repair_2026_07_21",
    migrationFilename: "20260721120000_wordloom_core_spelling_bank_phase_4d1_tion_repair.sql",
    tempTablePrefix: "phase_4d1_tion_repair",
    expectedCountColumn: "expected_phase_4d1_tion_repair_word_count",
    title: "Phase 4D1 tion repair",
    noteText: "Wordloom core v1 Phase 4D1 tion repair target",
    linkNoteText: "Wordloom core v1 Phase 4D1 tion repair target link",
    expectedCounts: new Map([
      ["tion", 8],
    ]),
    allowedExistingActiveSourceVersions: [PROOF_SOURCE_VERSION],
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
  ["4f", {
    key: "4f",
    sourceVersion: "wordloom_core_v1_phase_4f_ee_buffer_2026_07_22",
    migrationFilename: "20260722120000_wordloom_core_spelling_bank_phase_4f_ee_buffer.sql",
    tempTablePrefix: "phase_4f_ee_buffer",
    expectedCountColumn: "expected_phase_4f_ee_buffer_word_count",
    title: "Phase 4F ee buffer",
    noteText: "Wordloom core v1 Phase 4F ee early-stretch buffer target",
    linkNoteText: "Wordloom core v1 Phase 4F ee early-stretch buffer target link",
    expectedCounts: new Map([
      ["ee", 3],
    ]),
    includeExplicitHintSqlCheck: true,
    includeSchoolScopeSqlCheck: true,
  }],
]);
const REQUIRED_WORD_FIELDS = [
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
const TARGET_ROLES = new Set(["primary", "secondary", "incidental"]);
const ACTIVE_TARGET_ROLES = new Set(["primary", "secondary"]);
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(repoRoot, "data", "wordloom-core-bank-v1.json");
const proofMigrationPath = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260508150000_wordloom_core_spelling_bank_proof_set.sql",
);

function fail(errors, config = null) {
  const list = Array.isArray(errors) ? errors : [errors];
  const phaseTitle = config?.title || "requested phase";
  throw new Error(`Cannot generate ${phaseTitle} migration:\n${list.map((item) => `- ${item}`).join("\n")}`);
}

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isNonEmptyText(value) {
  return String(value || "").trim().length > 0;
}

function hasPlaceholderText(value = "") {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(String(value || "")));
}

function hasExplicitHintText(value = "") {
  return EXPLICIT_HINT_PATTERNS.some((pattern) => pattern.test(String(value || "")));
}

function isWeakContext(value = "") {
  const clean = String(value || "").trim();
  return clean.length > 0 && clean.length < 12;
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

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlTextArray(values) {
  return `array[${values.map((value) => sqlString(value)).join(",")}]::text[]`;
}

function sqlInt(value, config = null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) fail(`Expected integer value, got ${value}.`, config);
  return String(parsed);
}

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
  if (startIndex === -1) return "";

  const valuesIndex = lowerSource.indexOf("values", startIndex);
  if (valuesIndex === -1) return "";

  const endIndex = findStatementEnd(source, valuesIndex);
  if (endIndex === -1) return "";

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
  if (!clean.startsWith("'") || !clean.endsWith("'")) return "";
  return clean.slice(1, -1).replace(/''/g, "'");
}

function parseProofWords() {
  const sql = readFileSync(proofMigrationPath, "utf8");
  return parseSqlTuples(extractInsertValues(sql, "wordloom_core_proof_words"))
    .map((tupleText) => {
      const fields = splitSqlFields(tupleText);
      return {
        normalised_word: normalizeText(unquoteSqlString(fields[1])),
        source_version: PROOF_SOURCE_VERSION,
      };
    })
    .filter((row) => row.normalised_word);
}

function countByPrimaryFocus(words) {
  const counts = new Map();
  for (const word of words) {
    const focus = normalizeText(word.primary_focus_grapheme);
    counts.set(focus, (counts.get(focus) || 0) + 1);
  }
  return counts;
}

function parsePhaseArg(argv = []) {
  const phaseArg = argv.find((arg) => String(arg || "").startsWith("--phase="));
  const phase = normalizeText(phaseArg ? phaseArg.split("=").slice(1).join("=") : "7b");
  const config = PHASE_CONFIGS.get(phase);
  if (!config) {
    fail(`Unsupported phase "${phase || "(missing)"}". Use --phase=7b, --phase=7c, --phase=7d, --phase=7e, --phase=7f, --phase=7g, --phase=7h, --phase=8b, --phase=8c, --phase=8d, --phase=4d1, or --phase=4f.`);
  }
  return config;
}

function validateSource(source, config) {
  const errors = [];
  const targets = Array.isArray(source?.targets) ? source.targets : [];
  const words = Array.isArray(source?.words) ? source.words : [];
  const targetByFocus = new Map();
  const phaseWords = words.filter((word) => word?.source_version === config.sourceVersion);
  const phaseNormalised = new Set();
  const duplicateNormalised = new Set();
  const expectedTotal = [...config.expectedCounts.values()].reduce((total, count) => total + count, 0);
  const allowedExistingActiveSourceVersions = new Set(config.allowedExistingActiveSourceVersions || []);

  for (const target of targets) {
    const focus = normalizeText(target?.focus_grapheme);
    if (focus) targetByFocus.set(focus, target);
  }

  for (const focus of config.expectedCounts.keys()) {
    if (!targetByFocus.has(focus)) errors.push(`target_${focus}_missing_from_source_targets`);
  }

  if (phaseWords.length !== expectedTotal) {
    errors.push(`expected_${expectedTotal}_${config.key}_words_found_${phaseWords.length}`);
  }

  const counts = countByPrimaryFocus(phaseWords);
  for (const [focus, expected] of config.expectedCounts) {
    const actual = counts.get(focus) || 0;
    if (actual !== expected) errors.push(`target_${focus}_count_${actual}_expected_${expected}`);
  }
  for (const focus of counts.keys()) {
    if (!config.expectedCounts.has(focus)) errors.push(`unexpected_${config.key}_target_${focus}`);
  }

  for (const [index, word] of phaseWords.entries()) {
    const label = `${config.key}_word[${index}]_${word?.normalised_word || word?.word || "unknown"}`;
    for (const field of REQUIRED_WORD_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(word, field)) errors.push(`${label}_missing_${field}`);
    }

    const cleanWord = normalizeText(word?.word);
    const normalisedWord = normalizeText(word?.normalised_word);
    const segments = Array.isArray(word?.grapheme_segments)
      ? word.grapheme_segments.map((item) => normalizeText(item)).filter(Boolean)
      : [];
    const focusGraphemes = Array.isArray(word?.focus_graphemes)
      ? word.focus_graphemes.map((item) => normalizeText(item)).filter(Boolean)
      : [];
    const primaryFocus = normalizeText(word?.primary_focus_grapheme);
    const targetLinks = Array.isArray(word?.target_links) ? word.target_links : [];
    const primaryLinks = targetLinks.filter((link) => normalizeText(link?.target_role) === "primary");

    if (!normalisedWord || normalisedWord !== cleanWord) errors.push(`${label}_normalised_word_mismatch`);
    if (normalisedWord) {
      if (phaseNormalised.has(normalisedWord)) duplicateNormalised.add(normalisedWord);
      phaseNormalised.add(normalisedWord);
    }
    if (segments.join("") !== normalisedWord) errors.push(`${label}_segments_do_not_reconstruct_word`);
    if (!segments.includes(primaryFocus)) errors.push(`${label}_primary_focus_missing_from_segments`);
    if (!focusGraphemes.includes(primaryFocus)) errors.push(`${label}_primary_focus_missing_from_focus_graphemes`);
    if (word?.approval_status !== "approved") errors.push(`${label}_not_approved`);
    if (word?.suitability_status !== "suitable") errors.push(`${label}_not_suitable`);
    if (word?.source !== "wordloom_core") errors.push(`${label}_wrong_source`);
    if (word?.is_active !== true) errors.push(`${label}_not_active`);
    if (!isNonEmptyText(word?.sentence)) errors.push(`${label}_sentence_missing`);
    if (!isNonEmptyText(word?.meaning)) errors.push(`${label}_meaning_missing`);
    if (hasPlaceholderText(word?.sentence)) errors.push(`${label}_sentence_placeholder`);
    if (hasPlaceholderText(word?.meaning)) errors.push(`${label}_meaning_placeholder`);
    if (isWeakContext(word?.sentence)) errors.push(`${label}_sentence_weak`);
    if (isWeakContext(word?.meaning)) errors.push(`${label}_meaning_weak`);
    if (isCircularMeaning(normalisedWord, word?.meaning)) errors.push(`${label}_meaning_circular`);
    if (hasExplicitHintText(word?.sentence)) errors.push(`${label}_sentence_spelling_hint`);
    if (hasExplicitHintText(word?.meaning)) errors.push(`${label}_meaning_spelling_hint`);
    if (primaryLinks.length !== 1) errors.push(`${label}_primary_link_count_${primaryLinks.length}`);

    for (const [linkIndex, link] of targetLinks.entries()) {
      const linkLabel = `${label}_target_link[${linkIndex}]`;
      const linkFocus = normalizeText(link?.focus_grapheme);
      const role = normalizeText(link?.target_role);
      if (!TARGET_ROLES.has(role)) errors.push(`${linkLabel}_invalid_role_${role || "missing"}`);
      if (!targetByFocus.has(linkFocus)) errors.push(`${linkLabel}_unknown_target_${linkFocus || "missing"}`);
      if (ACTIVE_TARGET_ROLES.has(role) && !segments.includes(linkFocus)) {
        errors.push(`${linkLabel}_focus_missing_from_segments`);
      }
    }
  }

  for (const duplicate of duplicateNormalised) {
    errors.push(`duplicate_${config.key}_word_${duplicate}`);
  }

  const activeOtherSourceWords = words
    .filter((word) => word?.is_active === true && word?.source_version !== config.sourceVersion)
    .map((word) => ({
      normalised_word: normalizeText(word?.normalised_word || word?.word),
      source_version: String(word?.source_version || ""),
    }))
    .filter((word) => word.normalised_word);
  const existingWords = [...activeOtherSourceWords, ...parseProofWords()];
  for (const existing of existingWords) {
    if (
      phaseNormalised.has(existing.normalised_word)
      && !allowedExistingActiveSourceVersions.has(existing.source_version)
    ) {
      errors.push(`${config.key}_word_${existing.normalised_word}_collides_with_${existing.source_version || "unknown_source"}`);
    }
  }

  if (errors.length) fail(errors, config);

  const targetRows = [...config.expectedCounts.keys()]
    .map((focus) => ({
      ...targetByFocus.get(focus),
      focus_grapheme: focus,
      [config.expectedCountColumn]: config.expectedCounts.get(focus),
    }))
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || a.focus_grapheme.localeCompare(b.focus_grapheme));
  const wordRows = phaseWords
    .map((word) => ({
      ...word,
      word: String(word.word).trim(),
      normalised_word: normalizeText(word.normalised_word),
      grapheme_segments: word.grapheme_segments.map((item) => normalizeText(item)),
      focus_graphemes: word.focus_graphemes.map((item) => normalizeText(item)),
      primary_focus_grapheme: normalizeText(word.primary_focus_grapheme),
      target_links: word.target_links.map((link) => ({
        focus_grapheme: normalizeText(link.focus_grapheme),
        target_role: normalizeText(link.target_role),
        pattern_type: String(link.pattern_type || "").trim(),
        difficulty_modifier: Number(link.difficulty_modifier || 0),
      })),
    }))
    .sort((a, b) =>
      Number(targetRows.find((target) => target.focus_grapheme === a.primary_focus_grapheme)?.sort_order || 999)
      - Number(targetRows.find((target) => target.focus_grapheme === b.primary_focus_grapheme)?.sort_order || 999)
      || a.normalised_word.localeCompare(b.normalised_word)
    );

  return { targetRows, wordRows, expectedTotal };
}

function valuesBlock(rows, rowToFields) {
  return rows
    .map((row) => `  (${rowToFields(row).join(", ")})`)
    .join(",\n");
}

function buildOptionalExplicitHintCheck(config, wordsTable) {
  if (!config.includeExplicitHintSqlCheck) return "";
  return `
  if exists (
    select 1
    from ${wordsTable}
    where sentence ~* '\\m(grapheme|focus sound|target sound|spelling pattern)\\M'
      or meaning ~* '\\m(grapheme|focus sound|target sound|spelling pattern)\\M'
  ) then
    raise exception 'Wordloom core ${config.title} words contain explicit spelling-hint context.';
  end if;
`;
}

function buildOptionalSchoolScopeCheck(config, wordsTable) {
  if (!config.includeSchoolScopeSqlCheck) return "";
  return `
  if exists (
    select 1
    from public.school_spelling_bank_overrides as overrides
    inner join ${wordsTable} as phase_words
      on phase_words.normalised_word in (
        select normalised_word
        from public.wordloom_core_words
        where id = overrides.core_word_id
      )
  ) then
    raise exception 'Wordloom core ${config.title} must not create school override rows for new core words.';
  end if;

  if exists (
    select 1
    from public.school_spelling_bank_words as school_words
    inner join ${wordsTable} as phase_words
      on phase_words.normalised_word = school_words.normalised_word
  ) then
    raise exception 'Wordloom core ${config.title} must not add rows to school spelling bank additions.';
  end if;
`;
}

function buildMigrationSql({ config, targetRows, wordRows, expectedTotal }) {
  const targetsTable = `wordloom_core_${config.tempTablePrefix}_targets`;
  const wordsTable = `wordloom_core_${config.tempTablePrefix}_words`;
  const wordTargetsTable = `wordloom_core_${config.tempTablePrefix}_word_targets`;
  const allowedExistingActiveSourceVersions = (config.allowedExistingActiveSourceVersions || [])
    .map((sourceVersion) => String(sourceVersion || "").trim())
    .filter(Boolean);
  const allowedExistingActiveSourceVersionSql = allowedExistingActiveSourceVersions.length
    ? `
      and coalesce(existing.source_version, '') not in (${allowedExistingActiveSourceVersions.map(sqlString).join(", ")})`
    : "";
  const wordTargetRows = wordRows.flatMap((word) =>
    word.target_links.map((link) => ({
      normalised_word: word.normalised_word,
      ...link,
    }))
  ).sort((a, b) =>
    a.normalised_word.localeCompare(b.normalised_word)
    || a.focus_grapheme.localeCompare(b.focus_grapheme)
    || a.target_role.localeCompare(b.target_role)
  );

  const targetValues = valuesBlock(targetRows, (target) => [
    sqlString(target.focus_grapheme),
    sqlString(target.display_label),
    sqlString(target.stage_band),
    sqlString(target.challenge_band),
    sqlInt(target.sort_order, config),
    sqlInt(target[config.expectedCountColumn], config),
  ]);
  const wordValues = valuesBlock(wordRows, (word) => [
    sqlString(word.word),
    sqlString(word.normalised_word),
    sqlString(word.primary_focus_grapheme),
    sqlTextArray(word.grapheme_segments),
    sqlTextArray(word.focus_graphemes),
    sqlString(word.stage_band),
    sqlInt(word.difficulty_score, config),
    sqlString(word.difficulty_label),
    sqlString(word.difficulty_reason),
    sqlString(word.sentence),
    sqlString(word.meaning),
    sqlString(word.approval_status),
    sqlString(word.suitability_status),
    sqlString(word.source),
    sqlString(word.source_version),
    word.is_active ? "true" : "false",
  ]);
  const linkValues = valuesBlock(wordTargetRows, (link) => [
    sqlString(link.normalised_word),
    sqlString(link.focus_grapheme),
    sqlString(link.target_role),
    sqlString(link.pattern_type),
    sqlInt(link.difficulty_modifier, config),
  ]);

  return `begin;

create temporary table ${targetsTable} (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  ${config.expectedCountColumn} integer not null
) on commit drop;

insert into ${targetsTable} (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  ${config.expectedCountColumn}
)
values
${targetValues};

create temporary table ${wordsTable} (
  word text primary key,
  normalised_word text not null,
  primary_focus_grapheme text not null,
  grapheme_segments text[] not null,
  focus_graphemes text[] not null,
  stage_band text not null,
  difficulty_score integer not null,
  difficulty_label text not null,
  difficulty_reason text not null,
  sentence text not null,
  meaning text not null,
  approval_status text not null,
  suitability_status text not null,
  source text not null,
  source_version text not null,
  is_active boolean not null
) on commit drop;

insert into ${wordsTable} (
  word,
  normalised_word,
  primary_focus_grapheme,
  grapheme_segments,
  focus_graphemes,
  stage_band,
  difficulty_score,
  difficulty_label,
  difficulty_reason,
  sentence,
  meaning,
  approval_status,
  suitability_status,
  source,
  source_version,
  is_active
)
values
${wordValues};

create temporary table ${wordTargetsTable} (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into ${wordTargetsTable} (
  normalised_word,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier
)
values
${linkValues};

do $$
begin
  if (select count(*) from ${wordsTable}) <> ${expectedTotal} then
    raise exception 'Wordloom core ${config.title} batch must contain exactly ${expectedTotal} words.';
  end if;

  if exists (
    select 1
    from ${targetsTable} as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from ${wordsTable}
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.${config.expectedCountColumn}
  ) then
    raise exception 'Wordloom core ${config.title} target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from ${wordsTable}
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core ${config.title} batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join ${wordsTable} as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> '${config.sourceVersion}'${allowedExistingActiveSourceVersionSql}
  ) then
    raise exception 'Wordloom core ${config.title} batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from ${wordsTable}
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> '${config.sourceVersion}'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core ${config.title} words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from ${wordsTable}
    where sentence ~* '\\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\\M'
      or meaning ~* '\\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\\M'
  ) then
    raise exception 'Wordloom core ${config.title} words contain placeholder context.';
  end if;
${buildOptionalExplicitHintCheck(config, wordsTable)}
  if exists (
    select 1
    from ${wordsTable}
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core ${config.title} words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from ${wordsTable}
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core ${config.title} primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from ${wordTargetsTable}
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core ${config.title} word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from ${wordTargetsTable} as word_targets
    left join ${targetsTable} as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core ${config.title} word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from ${wordsTable} as words
    left join ${wordTargetsTable} as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core ${config.title} word must have exactly one primary target link.';
  end if;
end $$;

insert into public.wordloom_core_focus_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  is_active,
  notes
)
select
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  true,
  '${config.noteText}'
from ${targetsTable}
on conflict (focus_grapheme) do update
set
  display_label = excluded.display_label,
  stage_band = excluded.stage_band,
  challenge_band = excluded.challenge_band,
  sort_order = excluded.sort_order,
  is_active = true,
  notes = coalesce(public.wordloom_core_focus_targets.notes, excluded.notes);

do $$
begin
  if exists (
    select 1
    from ${targetsTable} as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core ${config.title} linked targets must exist and be active.';
  end if;
end $$;

insert into public.wordloom_core_words (
  word,
  normalised_word,
  grapheme_segments,
  focus_graphemes,
  primary_focus_grapheme,
  stage_band,
  difficulty_score,
  difficulty_label,
  difficulty_reason,
  sentence,
  meaning,
  suitability_status,
  approval_status,
  source,
  source_version,
  is_active
)
select
  word,
  normalised_word,
  to_jsonb(grapheme_segments),
  to_jsonb(focus_graphemes),
  primary_focus_grapheme,
  stage_band,
  difficulty_score,
  difficulty_label,
  difficulty_reason,
  sentence,
  meaning,
  suitability_status,
  approval_status,
  source,
  source_version,
  is_active
from ${wordsTable}
on conflict (normalised_word) where is_active is true do update
set
  word = excluded.word,
  grapheme_segments = excluded.grapheme_segments,
  focus_graphemes = excluded.focus_graphemes,
  primary_focus_grapheme = excluded.primary_focus_grapheme,
  stage_band = excluded.stage_band,
  difficulty_score = excluded.difficulty_score,
  difficulty_label = excluded.difficulty_label,
  difficulty_reason = excluded.difficulty_reason,
  sentence = excluded.sentence,
  meaning = excluded.meaning,
  suitability_status = excluded.suitability_status,
  approval_status = excluded.approval_status,
  source = excluded.source,
  source_version = excluded.source_version,
  is_active = excluded.is_active;

insert into public.wordloom_core_word_targets (
  word_id,
  focus_target_id,
  focus_grapheme,
  target_role,
  pattern_type,
  difficulty_modifier,
  notes
)
select
  words.id,
  targets.id,
  word_targets.focus_grapheme,
  word_targets.target_role,
  word_targets.pattern_type,
  word_targets.difficulty_modifier,
  '${config.linkNoteText}'
from ${wordTargetsTable} as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = '${config.sourceVersion}'
 and words.is_active is true
inner join public.wordloom_core_focus_targets as targets
  on targets.focus_grapheme = word_targets.focus_grapheme
 and targets.is_active is true
on conflict (word_id, focus_target_id, target_role) do update
set
  focus_grapheme = excluded.focus_grapheme,
  pattern_type = excluded.pattern_type,
  difficulty_modifier = excluded.difficulty_modifier,
  notes = excluded.notes;

do $$
begin
  if (
    select count(*)::integer
    from public.wordloom_core_words
    where source = 'wordloom_core'
      and source_version = '${config.sourceVersion}'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> ${expectedTotal} then
    raise exception 'Wordloom core ${config.title} persisted word count must be exactly ${expectedTotal}.';
  end if;

  if exists (
    select 1
    from ${targetsTable} as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = '${config.sourceVersion}'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.${config.expectedCountColumn}
  ) then
    raise exception 'Wordloom core ${config.title} persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after ${config.title}.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = '${config.sourceVersion}'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core ${config.title} persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = '${config.sourceVersion}'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core ${config.title} persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = '${config.sourceVersion}'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core ${config.title} word must have exactly one primary target link.';
  end if;${buildOptionalSchoolScopeCheck(config, wordsTable)}
end $$;

commit;
`;
}

const config = parsePhaseArg(process.argv.slice(2));
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const { targetRows, wordRows, expectedTotal } = validateSource(source, config);
const migrationPath = path.join(repoRoot, "supabase", "migrations", config.migrationFilename);
mkdirSync(path.dirname(migrationPath), { recursive: true });
writeFileSync(migrationPath, buildMigrationSql({ config, targetRows, wordRows, expectedTotal }), "utf8");

console.log(`Generated ${path.relative(repoRoot, migrationPath)} with ${wordRows.length} ${config.title} words.`);
