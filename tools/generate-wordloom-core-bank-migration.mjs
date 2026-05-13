import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PHASE_7B_SOURCE_VERSION = "wordloom_core_v1_phase_7b_2026_05_13";
const MIGRATION_FILENAME = "20260513120000_wordloom_core_spelling_bank_phase_7b_launch_batch.sql";
const PROOF_SOURCE_VERSION = "wordloom_core_proof_v1";
const EXPECTED_COUNTS = new Map([
  ["ay", 8],
  ["ea", 8],
  ["ew", 8],
  ["tch", 8],
  ["air", 4],
  ["au", 4],
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
const migrationPath = path.join(repoRoot, "supabase", "migrations", MIGRATION_FILENAME);

function fail(errors) {
  const list = Array.isArray(errors) ? errors : [errors];
  throw new Error(`Cannot generate Phase 7B migration:\n${list.map((item) => `- ${item}`).join("\n")}`);
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

function sqlInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) fail(`Expected integer value, got ${value}.`);
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

function validateSource(source) {
  const errors = [];
  const targets = Array.isArray(source?.targets) ? source.targets : [];
  const words = Array.isArray(source?.words) ? source.words : [];
  const targetByFocus = new Map();
  const phaseWords = words.filter((word) => word?.source_version === PHASE_7B_SOURCE_VERSION);
  const phaseNormalised = new Set();
  const duplicateNormalised = new Set();

  for (const target of targets) {
    const focus = normalizeText(target?.focus_grapheme);
    if (focus) targetByFocus.set(focus, target);
  }

  if (phaseWords.length !== 40) {
    errors.push(`expected_40_phase_7b_words_found_${phaseWords.length}`);
  }

  const counts = countByPrimaryFocus(phaseWords);
  for (const [focus, expected] of EXPECTED_COUNTS) {
    const actual = counts.get(focus) || 0;
    if (actual !== expected) errors.push(`target_${focus}_count_${actual}_expected_${expected}`);
  }
  for (const focus of counts.keys()) {
    if (!EXPECTED_COUNTS.has(focus)) errors.push(`unexpected_phase_7b_target_${focus}`);
  }

  for (const [index, word] of phaseWords.entries()) {
    const label = `phase7b_word[${index}]_${word?.normalised_word || word?.word || "unknown"}`;
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
    errors.push(`duplicate_phase_7b_word_${duplicate}`);
  }

  const activeOtherSourceWords = words
    .filter((word) => word?.is_active === true && word?.source_version !== PHASE_7B_SOURCE_VERSION)
    .map((word) => ({
      normalised_word: normalizeText(word?.normalised_word || word?.word),
      source_version: String(word?.source_version || ""),
    }))
    .filter((word) => word.normalised_word);
  const existingWords = [...activeOtherSourceWords, ...parseProofWords()];
  for (const existing of existingWords) {
    if (phaseNormalised.has(existing.normalised_word)) {
      errors.push(`phase_7b_word_${existing.normalised_word}_collides_with_${existing.source_version || "unknown_source"}`);
    }
  }

  if (errors.length) fail(errors);

  const targetRows = [...EXPECTED_COUNTS.keys()]
    .map((focus) => ({
      ...targetByFocus.get(focus),
      focus_grapheme: focus,
      expected_phase_7b_word_count: EXPECTED_COUNTS.get(focus),
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

  return { targetRows, wordRows };
}

function valuesBlock(rows, rowToFields) {
  return rows
    .map((row) => `  (${rowToFields(row).join(", ")})`)
    .join(",\n");
}

function buildMigrationSql({ targetRows, wordRows }) {
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
    sqlInt(target.sort_order),
    sqlInt(target.expected_phase_7b_word_count),
  ]);
  const wordValues = valuesBlock(wordRows, (word) => [
    sqlString(word.word),
    sqlString(word.normalised_word),
    sqlString(word.primary_focus_grapheme),
    sqlTextArray(word.grapheme_segments),
    sqlTextArray(word.focus_graphemes),
    sqlString(word.stage_band),
    sqlInt(word.difficulty_score),
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
    sqlInt(link.difficulty_modifier),
  ]);

  return `begin;

create temporary table wordloom_core_phase_7b_targets (
  focus_grapheme text primary key,
  display_label text not null,
  stage_band text not null,
  challenge_band text not null,
  sort_order integer not null,
  expected_phase_7b_word_count integer not null
) on commit drop;

insert into wordloom_core_phase_7b_targets (
  focus_grapheme,
  display_label,
  stage_band,
  challenge_band,
  sort_order,
  expected_phase_7b_word_count
)
values
${targetValues};

create temporary table wordloom_core_phase_7b_words (
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

insert into wordloom_core_phase_7b_words (
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

create temporary table wordloom_core_phase_7b_word_targets (
  normalised_word text not null,
  focus_grapheme text not null,
  target_role text not null,
  pattern_type text not null,
  difficulty_modifier integer not null default 0
) on commit drop;

insert into wordloom_core_phase_7b_word_targets (
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
  if (select count(*) from wordloom_core_phase_7b_words) <> 40 then
    raise exception 'Wordloom core Phase 7B batch must contain exactly 40 words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_targets as target
    left join (
      select primary_focus_grapheme, count(*)::integer as word_count
      from wordloom_core_phase_7b_words
      group by primary_focus_grapheme
    ) as actual
      on actual.primary_focus_grapheme = target.focus_grapheme
    where coalesce(actual.word_count, 0) <> target.expected_phase_7b_word_count
  ) then
    raise exception 'Wordloom core Phase 7B target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from wordloom_core_phase_7b_words
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core Phase 7B batch contains duplicate normalised words.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as existing
    inner join wordloom_core_phase_7b_words as phase_words
      on phase_words.normalised_word = existing.normalised_word
    where existing.is_active is true
      and coalesce(existing.source_version, '') <> '${PHASE_7B_SOURCE_VERSION}'
  ) then
    raise exception 'Wordloom core Phase 7B batch collides with existing active core words.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_words
    where is_active is not true
      or approval_status <> 'approved'
      or suitability_status <> 'suitable'
      or source <> 'wordloom_core'
      or source_version <> '${PHASE_7B_SOURCE_VERSION}'
      or btrim(sentence) = ''
      or btrim(meaning) = ''
  ) then
    raise exception 'Wordloom core Phase 7B words must be active approved suitable Wordloom rows with sentence and meaning.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_words
    where sentence ~* '\\m(placeholder|tbd|todo|lorem|sample sentence|example sentence|needs review)\\M'
      or meaning ~* '\\m(placeholder|tbd|todo|lorem|meaning goes here|definition goes here|needs review)\\M'
  ) then
    raise exception 'Wordloom core Phase 7B words contain placeholder context.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_words
    where array_to_string(grapheme_segments, '') <> normalised_word
  ) then
    raise exception 'Wordloom core Phase 7B words contain grapheme segments that do not reconstruct the word.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_words
    where not (primary_focus_grapheme = any(grapheme_segments))
      or not (primary_focus_grapheme = any(focus_graphemes))
  ) then
    raise exception 'Wordloom core Phase 7B primary focus values must appear in segments and focus_graphemes.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_word_targets
    where target_role not in ('primary', 'secondary', 'incidental')
  ) then
    raise exception 'Wordloom core Phase 7B word target links contain an invalid target_role.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_word_targets as word_targets
    left join wordloom_core_phase_7b_targets as targets
      on targets.focus_grapheme = word_targets.focus_grapheme
    where targets.focus_grapheme is null
  ) then
    raise exception 'Wordloom core Phase 7B word target links point to unknown targets.';
  end if;

  if exists (
    select words.normalised_word
    from wordloom_core_phase_7b_words as words
    left join wordloom_core_phase_7b_word_targets as word_targets
      on word_targets.normalised_word = words.normalised_word
     and word_targets.target_role = 'primary'
    group by words.normalised_word
    having count(word_targets.normalised_word) <> 1
  ) then
    raise exception 'Every Wordloom core Phase 7B word must have exactly one primary target link.';
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
  'Wordloom core v1 Phase 7B launch batch target'
from wordloom_core_phase_7b_targets
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
    from wordloom_core_phase_7b_targets as phase_targets
    left join public.wordloom_core_focus_targets as targets
      on targets.focus_grapheme = phase_targets.focus_grapheme
     and targets.is_active is true
    where targets.id is null
  ) then
    raise exception 'Wordloom core Phase 7B linked targets must exist and be active.';
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
from wordloom_core_phase_7b_words
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
  'Wordloom core v1 Phase 7B launch batch target link'
from wordloom_core_phase_7b_word_targets as word_targets
inner join public.wordloom_core_words as words
  on words.normalised_word = word_targets.normalised_word
 and words.source_version = '${PHASE_7B_SOURCE_VERSION}'
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
      and source_version = '${PHASE_7B_SOURCE_VERSION}'
      and is_active is true
      and approval_status = 'approved'
      and suitability_status = 'suitable'
  ) <> 40 then
    raise exception 'Wordloom core Phase 7B persisted word count must be exactly 40.';
  end if;

  if exists (
    select 1
    from wordloom_core_phase_7b_targets as expected
    left join (
      select
        word_targets.focus_grapheme,
        count(distinct words.id)::integer as word_count
      from public.wordloom_core_words as words
      inner join public.wordloom_core_word_targets as word_targets
        on word_targets.word_id = words.id
       and word_targets.target_role = 'primary'
      where words.source = 'wordloom_core'
        and words.source_version = '${PHASE_7B_SOURCE_VERSION}'
        and words.is_active is true
        and words.approval_status = 'approved'
        and words.suitability_status = 'suitable'
      group by word_targets.focus_grapheme
    ) as actual
      on actual.focus_grapheme = expected.focus_grapheme
    where coalesce(actual.word_count, 0) <> expected.expected_phase_7b_word_count
  ) then
    raise exception 'Wordloom core Phase 7B persisted target counts do not match expected coverage.';
  end if;

  if exists (
    select normalised_word
    from public.wordloom_core_words
    where is_active is true
    group by normalised_word
    having count(*) > 1
  ) then
    raise exception 'Wordloom core active words contain duplicate normalised words after Phase 7B.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    where words.source_version = '${PHASE_7B_SOURCE_VERSION}'
      and (
        btrim(coalesce(words.sentence, '')) = ''
        or btrim(coalesce(words.meaning, '')) = ''
      )
  ) then
    raise exception 'Wordloom core Phase 7B persisted words must retain sentence and meaning.';
  end if;

  if exists (
    select 1
    from public.wordloom_core_words as words
    inner join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    inner join public.wordloom_core_focus_targets as targets
      on targets.id = word_targets.focus_target_id
    where words.source_version = '${PHASE_7B_SOURCE_VERSION}'
      and (
        targets.is_active is not true
        or word_targets.focus_grapheme <> targets.focus_grapheme
      )
  ) then
    raise exception 'Wordloom core Phase 7B persisted links must point to active matching targets.';
  end if;

  if exists (
    select words.id
    from public.wordloom_core_words as words
    left join public.wordloom_core_word_targets as word_targets
      on word_targets.word_id = words.id
     and word_targets.target_role = 'primary'
    where words.source_version = '${PHASE_7B_SOURCE_VERSION}'
      and words.is_active is true
    group by words.id
    having count(word_targets.id) <> 1
  ) then
    raise exception 'Every persisted Wordloom core Phase 7B word must have exactly one primary target link.';
  end if;
end $$;

commit;
`;
}

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const { targetRows, wordRows } = validateSource(source);
mkdirSync(path.dirname(migrationPath), { recursive: true });
writeFileSync(migrationPath, buildMigrationSql({ targetRows, wordRows }), "utf8");

console.log(`Generated ${path.relative(repoRoot, migrationPath)} with ${wordRows.length} Phase 7B words.`);
