const FORCED_SENTENCE_WORD_GROUPS = [
  ["there", "their", "they're"],
  ["to", "too", "two"],
  ["right", "write"],
  ["plain", "plane"],
  ["sea", "see"],
  ["hear", "here"],
  ["no", "know"],
  ["one", "won"],
  ["pair", "pear"],
  ["blue", "blew"],
  ["flower", "flour"],
];

const FORCED_SENTENCE_WORDS = new Set(FORCED_SENTENCE_WORD_GROUPS.flat().map(normalizeContextWord));
const UNAVAILABLE_CONTENT_STATUSES = new Set(["hidden", "needs_review", "ai_generated"]);
const APPROVED_CONTENT_STATUSES = new Set(["", "auto_approved", "teacher_entered", "teacher_edited", "approved"]);
const PUPIL_USABLE_CONTEXT_CACHE_STATUSES = new Set(["auto_approved", "teacher_entered", "teacher_edited"]);
const MAX_MEANING_CHARACTERS = 180;
const MAX_MEANING_WORDS = 32;
const MIN_TARGET_LEAK_STEM_LENGTH = 5;
const TARGET_LEAK_SUFFIXES = [
  { suffix: "ies", replacement: "y" },
  { suffix: "ing", replacement: "" },
  { suffix: "est", replacement: "" },
  { suffix: "ed", replacement: "" },
  { suffix: "er", replacement: "" },
  { suffix: "es", replacement: "" },
  { suffix: "ly", replacement: "" },
  { suffix: "s", replacement: "" },
];

const SPELLING_EXPLANATION_PATTERN = /\b(graphemes?|phonemes?|spelling\s+patterns?|letters?|digraphs?|vowels?|consonants?|sounds?)\b/i;
const URL_LIKE_PATTERN = /\b(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|org|net|co\.uk|edu|gov)\b)/i;
const HTML_LIKE_PATTERN = /<[^>]*>/;
const LIST_LIKE_PATTERN = /(^|\n)\s*(?:[-*]|\d+[.)])\s+/;
const TECHNICAL_MARKUP_PATTERN = /[`{}[\]|\\]|=>|::/;

export function normalizeContextWord(word) {
  return String(word ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z']/g, "")
    .replace(/^'+|'+$/g, "");
}

export function isForcedSentenceWord(word) {
  return FORCED_SENTENCE_WORDS.has(normalizeContextWord(word));
}

export function getSpellingContextSupport(item = null) {
  const source = item && typeof item === "object" ? item : {};
  const choice = getPlainObject(source.choice);
  const testWord = getPlainObject(source.test_word || source.testWord);
  const wordRow = getPlainObject(source.word);
  const context = mergeContextSources([
    getPlainObject(wordRow.contextSupport),
    getPlainObject(wordRow.context_support),
    getPlainObject(testWord.contextSupport),
    getPlainObject(testWord.context_support),
    getPlainObject(source.contextSupport),
    getPlainObject(source.context_support),
    getPlainObject(choice.contextSupport),
    getPlainObject(choice.context_support),
  ]);

  const word = normalizeContextWord(
    readWordText(source.word)
    || readWordText(source.word_text)
    || readWordText(source.correctSpelling)
    || readWordText(choice.word)
    || readWordText(testWord.word)
    || readWordText(testWord.word_text)
    || readWordText(wordRow.word)
    || readWordText(wordRow.word_text)
    || ""
  );
  const forcedSentence = isForcedSentenceWord(word);
  const sentenceStatus = normalizeStatus(readStatus(context, "sentence"));
  const meaningStatus = normalizeStatus(readStatus(context, "meaning"));
  const baselineLike = isBaselineLikeItem(source, choice);
  const explicitSentenceRequired = readBoolean(
    context.sentence_required,
    context.sentenceRequired,
    context.sentence?.required,
    source.sentence_required,
    source.sentenceRequired,
    choice.sentence_required,
    choice.sentenceRequired,
    testWord.sentence_required,
    testWord.sentenceRequired,
    wordRow.sentence_required,
    wordRow.sentenceRequired,
  );
  const sentenceRequired = forcedSentence || explicitSentenceRequired === true;
  const sentenceText = cleanSupportText(
    readText(context.sentence)
    || readText(context.sentence_text)
    || readText(context.sentenceText)
    || readText(source.sentence)
    || readText(choice.sentence)
    || readText(testWord.sentence)
    || readText(wordRow.sentence)
  );
  const meaningEnabled = baselineLike
    ? false
    : resolveMeaningEnabled(context, context.meaning_enabled, context.meaningEnabled, context.meaning?.enabled);
  const rawMeaningText = cleanSupportText(
    readText(context.meaning)
    || readText(context.definition)
    || readText(context.meaning_text)
    || readText(context.meaningText)
    || readText(source.meaning)
    || readText(choice.meaning)
    || readText(testWord.meaning)
    || readText(wordRow.meaning)
  );
  const meaningValidation = validateMeaningSupportText(rawMeaningText, word);

  const sentenceAvailable = !!sentenceText && isContentStatusAvailable(sentenceStatus);
  const meaningAvailable = !!rawMeaningText
    && meaningEnabled
    && isContentStatusAvailable(meaningStatus)
    && meaningValidation.valid;

  return {
    word,
    sentence: sentenceAvailable ? sentenceText : "",
    meaning: meaningAvailable ? meaningValidation.text : "",
    sentenceStatus,
    meaningStatus,
    explicitSentenceRequired: explicitSentenceRequired === true,
    sentenceRequired,
    forcedSentence,
    meaningEnabled,
    baselineLike,
    displayMeaningOnly: true,
    hasSentence: sentenceAvailable,
    hasMeaning: meaningAvailable,
    meaningValidation,
  };
}

export function hasSentenceSupport(item = null) {
  return getSpellingContextSupport(item).hasSentence;
}

export function hasMeaningSupport(item = null) {
  return getSpellingContextSupport(item).hasMeaning;
}

export function supportTextLeaksTargetWord(text, word = "") {
  const target = normalizeSupportLeakTerm(word);
  if (!target) return false;

  const targetTerms = buildSupportLeakTerms(target);
  const tokens = tokenizeSupportText(text);
  for (const token of tokens) {
    const tokenTerm = normalizeSupportLeakTerm(token);
    if (!tokenTerm) continue;
    if (tokenTerm === target) return true;

    const tokenTerms = buildSupportLeakTerms(tokenTerm);
    for (const term of tokenTerms) {
      if (term === target) return true;
      if (term.length >= MIN_TARGET_LEAK_STEM_LENGTH && targetTerms.has(term)) return true;
    }
  }

  return false;
}

export function maskPupilSupportTargetWord(text, word = "") {
  const value = cleanSupportText(text);
  const pattern = buildSupportTargetWordPattern(word);
  if (!value || !pattern) return value;
  return value.replace(pattern, "$1____");
}

export function getVisiblePupilSentenceSupport(sentence, word = "") {
  const maskedSentence = maskPupilSupportTargetWord(sentence, word);
  if (!maskedSentence) return "";
  return supportTextLeaksTargetWord(maskedSentence, word) ? "" : maskedSentence;
}

export function getVisiblePupilMeaningSupport(meaning, word = "") {
  const text = cleanSupportText(meaning);
  if (!text) return "";
  return supportTextLeaksTargetWord(text, word) ? "" : text;
}

export function validateMeaningSupportText(meaning, word = "") {
  const originalText = String(meaning ?? "");
  const text = collapseWhitespace(originalText);
  const reasons = [];

  if (!text) {
    reasons.push("empty");
  }

  if (originalText.includes("\n") || originalText.includes("\r") || LIST_LIKE_PATTERN.test(originalText)) {
    reasons.push("not_plain_text");
  }

  if (text.length > MAX_MEANING_CHARACTERS || countWords(text) > MAX_MEANING_WORDS) {
    reasons.push("too_long");
  }

  if (HTML_LIKE_PATTERN.test(text) || URL_LIKE_PATTERN.test(text) || TECHNICAL_MARKUP_PATTERN.test(text)) {
    reasons.push("not_plain_text");
  }

  if (SPELLING_EXPLANATION_PATTERN.test(text) || mentionsLetterByLetterSpelling(text, word)) {
    reasons.push("spelling_explanation");
  }

  if (supportTextLeaksTargetWord(text, word)) {
    reasons.push("target_leak");
  }

  return {
    valid: reasons.length === 0,
    reasons,
    text,
  };
}

export function buildTestWordContextSnapshot(word, cacheRow, overrides = {}) {
  const row = getPlainObject(cacheRow);
  const override = getPlainObject(overrides);
  const qualityFlags = normalizeQualityFlags(override.quality_flags ?? override.qualityFlags ?? row.quality_flags ?? row.qualityFlags);
  const normalizedWord = normalizeContextWord(word || row.display_word || row.displayWord || row.normalized_word || row.normalizedWord || "");
  const sentenceStatus = normalizeStatus(readFirstDefined(
    override.sentence_status,
    override.sentenceStatus,
    row.sentence_status,
    row.sentenceStatus,
  ));
  const meaningStatus = normalizeStatus(readFirstDefined(
    override.meaning_status,
    override.meaningStatus,
    row.meaning_status,
    row.meaningStatus,
  ));
  const sentenceText = cleanSupportText(readFirstDefined(override.sentence, row.sentence));
  const meaningText = cleanSupportText(readFirstDefined(override.meaning, row.meaning));
  const meaningEnabledOverride = readBoolean(
    override.meaning_enabled,
    override.meaningEnabled,
    override.meaning_enabled_by_default,
    override.meaningEnabledByDefault,
  );
  const meaningEnabled = meaningEnabledOverride === null
    ? readBoolean(row.meaning_enabled_by_default, row.meaningEnabledByDefault) === true
    : meaningEnabledOverride === true;
  const sentenceRequired = readBoolean(
    override.sentence_required,
    override.sentenceRequired,
    row.sentence_required,
    row.sentenceRequired,
  ) === true;
  const meaningValidation = validateMeaningSupportText(meaningText, normalizedWord);
  const sentenceUsable = !!sentenceText && isPupilUsableContextCacheStatus(sentenceStatus);
  const meaningUsable = !!meaningText
    && meaningEnabled
    && isPupilUsableContextCacheStatus(meaningStatus)
    && meaningValidation.valid;

  if (!sentenceUsable && !meaningUsable) return null;

  return {
    sentence: sentenceUsable ? sentenceText : "",
    meaning: meaningUsable ? meaningValidation.text : "",
    sentence_required: sentenceRequired,
    meaning_enabled: meaningEnabled,
    sentence_status: sentenceStatus,
    meaning_status: meaningStatus,
    source_context_id: String(readFirstDefined(row.id, override.source_context_id, override.sourceContextId, row.source_context_id, row.sourceContextId) || "").trim() || null,
    context_key: normalizeContextKey(readFirstDefined(override.context_key, override.contextKey, row.context_key, row.contextKey)),
    ambiguity_kind: String(readFirstDefined(qualityFlags.ambiguity_kind, qualityFlags.ambiguityKind) || "").trim().toLowerCase(),
    homophone_set: normalizeHomophoneSet(readFirstDefined(qualityFlags.homophone_set, qualityFlags.homophoneSet)),
  };
}

function getPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mergeContextSources(sources = []) {
  return sources.reduce((merged, source) => ({ ...merged, ...getPlainObject(source) }), {});
}

function cleanSupportText(value) {
  return collapseWhitespace(String(value ?? ""));
}

function normalizeContextKey(value = "") {
  return String(value || "default").trim().toLowerCase() || "default";
}

function normalizeQualityFlags(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeHomophoneSet(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function readFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function countWords(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

function readText(value) {
  if (typeof value === "string") return value;
  const source = getPlainObject(value);
  return source.text ?? source.value ?? source.copy ?? "";
}

function readWordText(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  const source = getPlainObject(value);
  return source.word ?? source.word_text ?? source.wordText ?? source.text ?? source.value ?? "";
}

function readStatus(context, key) {
  const source = getPlainObject(context);
  const nested = getPlainObject(source[key]);
  const snakeKey = `${key}_status`;
  const camelKey = `${key}Status`;
  return source[snakeKey] ?? source[camelKey] ?? nested.status ?? "";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function readBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    const clean = String(value ?? "").trim().toLowerCase();
    if (["true", "1", "yes"].includes(clean)) return true;
    if (["false", "0", "no"].includes(clean)) return false;
  }
  return null;
}

function resolveMeaningEnabled(context, ...values) {
  const explicit = readBoolean(...values);
  if (explicit !== null) return explicit;
  return !!(
    readText(context.meaning)
    || readText(context.definition)
    || readText(context.meaning_text)
    || readText(context.meaningText)
  );
}

function isContentStatusAvailable(status) {
  const normalized = normalizeStatus(status);
  if (UNAVAILABLE_CONTENT_STATUSES.has(normalized)) return false;
  return APPROVED_CONTENT_STATUSES.has(normalized) || !normalized;
}

function isPupilUsableContextCacheStatus(status) {
  return PUPIL_USABLE_CONTEXT_CACHE_STATUSES.has(normalizeStatus(status));
}

function isBaselineLikeItem(item, choice) {
  const source = normalizeStatus(choice.source || item.word_source || item.wordSource || item.attempt_source || item.attemptSource);
  return item.isBaseline === true
    || item.is_baseline === true
    || source === "baseline"
    || source === "baseline_v1"
    || source === "baseline_v2"
    || isTrueFlag(choice.baseline_v1)
    || isTrueFlag(choice.baselineV1)
    || isTrueFlag(choice.baseline_v2)
    || isTrueFlag(choice.baselineV2)
    || !!String(choice.baseline_standard_key || choice.baselineStandardKey || choice.baseline_version || choice.baselineVersion || choice.baseline_stage || choice.baselineStage || "").trim();
}

function mentionsLetterByLetterSpelling(text, word) {
  const normalizedWord = normalizeContextWord(word).replace(/'/g, "");
  if (normalizedWord.length < 2) return false;
  const letters = normalizedWord.split("").map(escapeRegExp);
  const spacedOrHyphenated = new RegExp(`\\b${letters.join("[\\s-]+")}\\b`, "i");
  return spacedOrHyphenated.test(text);
}

function normalizeSupportLeakTerm(value) {
  return normalizeContextWord(value).replace(/'/g, "");
}

function tokenizeSupportText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .match(/[a-z']+/g) || [];
}

function buildSupportLeakTerms(value) {
  const normalized = normalizeSupportLeakTerm(value);
  const terms = new Set();
  if (!normalized) return terms;
  terms.add(normalized);

  for (const { suffix, replacement } of TARGET_LEAK_SUFFIXES) {
    if (!normalized.endsWith(suffix) || normalized.length <= suffix.length) continue;
    const stem = `${normalized.slice(0, -suffix.length)}${replacement}`;
    if (stem.length >= MIN_TARGET_LEAK_STEM_LENGTH) terms.add(stem);
  }

  return terms;
}

function buildSupportTargetWordPattern(word) {
  const normalizedWord = normalizeContextWord(word);
  if (!normalizedWord) return null;
  const wordPattern = normalizedWord
    .split("")
    .map((letter) => (letter === "'" ? "['\u2019\u2018`]" : escapeRegExp(letter)))
    .join("");
  return new RegExp(`(^|[^A-Za-z'\u2019\u2018])(${wordPattern})(?=$|[^A-Za-z'\u2019\u2018])`, "gi");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isTrueFlag(value) {
  return value === true || ["true", "1", "yes"].includes(String(value ?? "").trim().toLowerCase());
}
