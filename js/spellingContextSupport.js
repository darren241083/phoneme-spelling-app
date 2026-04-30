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
const APPROVED_CONTENT_STATUSES = new Set(["", "auto_approved", "teacher_edited", "approved"]);
const MAX_MEANING_CHARACTERS = 180;
const MAX_MEANING_WORDS = 32;

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
  const context = mergeContextSources([
    getPlainObject(source.contextSupport),
    getPlainObject(source.context_support),
    getPlainObject(choice.contextSupport),
    getPlainObject(choice.context_support),
  ]);

  const word = normalizeContextWord(source.word || source.word_text || source.correctSpelling || "");
  const forcedSentence = isForcedSentenceWord(word);
  const sentenceStatus = normalizeStatus(readStatus(context, "sentence"));
  const meaningStatus = normalizeStatus(readStatus(context, "meaning"));
  const baselineLike = isBaselineLikeItem(source, choice);
  const explicitSentenceRequired = readBoolean(
    context.sentence_required,
    context.sentenceRequired,
    context.sentence?.required,
    choice.sentence_required,
    choice.sentenceRequired,
  );
  const sentenceRequired = forcedSentence || explicitSentenceRequired === true;
  const sentenceText = cleanSupportText(
    readText(context.sentence) || readText(context.sentence_text) || readText(context.sentenceText) || source.sentence
  );
  const meaningEnabled = baselineLike
    ? false
    : resolveMeaningEnabled(context, context.meaning_enabled, context.meaningEnabled, context.meaning?.enabled);
  const rawMeaningText = cleanSupportText(
    readText(context.meaning) || readText(context.definition) || readText(context.meaning_text) || readText(context.meaningText)
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

  return {
    valid: reasons.length === 0,
    reasons,
    text,
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isTrueFlag(value) {
  return value === true || ["true", "1", "yes"].includes(String(value ?? "").trim().toLowerCase());
}
