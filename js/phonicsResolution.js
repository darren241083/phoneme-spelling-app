import { inferPattern, splitWordToGraphemes } from "./wordParser.js?v=1.5";

export const PHONICS_CLASSIFICATION_SOURCES = {
  teacherManualOverride: "teacher_manual_override",
  approvedWordBank: "approved_word_bank",
  approvedException: "approved_exception",
  ruleEngine: "rule_engine",
  aiFallback: "ai_fallback",
};

export const PHONICS_CORRECTION_TYPE_ORDER = [
  "false_split_digraph",
  "wrong_adjacent_digraph_grouping",
  "wrong_focus_grapheme",
  "wrong_fallback_split",
  "irregular_word_override",
];

const PHONICS_EXCEPTION_TABLE = "phonics_exceptions";
const PHONICS_CORRECTION_LOG_TABLE = "phonics_correction_logs";
const APPROVED_WORD_BANK_SOURCES = new Set(["teacher"]);

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
}

function normalizeSentence(value) {
  const text = String(value || "").trim();
  return text || null;
}

function getSupabaseErrorCode(error) {
  return String(error?.code || "").trim().toUpperCase();
}

function isMissingTableError(error, tableName = "") {
  const code = getSupabaseErrorCode(error);
  const message = String(error?.message || "").toLowerCase();
  const cleanTable = String(tableName || "").trim().toLowerCase();
  return code === "42P01"
    || code === "PGRST204"
    || (cleanTable && message.includes(cleanTable) && message.includes("does not exist"));
}

async function getSupabase() {
  const module = await import("./supabaseClient.js");
  return module.supabase;
}

function toSegmentList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => normalizeToken(item))
    .filter(Boolean);
}

function getFallbackFocus(segments) {
  return normalizeToken(inferPattern(segments).focusGrapheme || "");
}

function normalizeFocusFromRow(choice = {}, segments = []) {
  const focusChoices = Array.isArray(choice?.focus_graphemes)
    ? choice.focus_graphemes.map((item) => normalizeToken(item)).filter(Boolean)
    : [];
  return focusChoices[0] || getFallbackFocus(segments);
}

function compareSnapshots(a = {}, b = {}) {
  return buildPhonicsSnapshotKey(a) === buildPhonicsSnapshotKey(b);
}

function pickCorrectionTypeCandidates(original = {}, corrected = {}) {
  const originalSegments = toSegmentList(original.segments);
  const correctedSegments = toSegmentList(corrected.segments);
  const originalFocus = normalizeToken(original.focusGrapheme);
  const correctedFocus = normalizeToken(corrected.focusGrapheme);
  const originalHasSplit = originalSegments.some((item) => item.includes("-e"));
  const correctedHasSplit = correctedSegments.some((item) => item.includes("-e"));
  const segmentsChanged = originalSegments.join("|") !== correctedSegments.join("|");
  const focusChanged = originalFocus !== correctedFocus;

  if (originalHasSplit && !correctedHasSplit) return "false_split_digraph";
  if (segmentsChanged && !compareSnapshots(
    { ...original, focusGrapheme: "", classificationSource: "" },
    { ...corrected, focusGrapheme: "", classificationSource: "" },
  )) return "wrong_adjacent_digraph_grouping";
  if (focusChanged) return "wrong_focus_grapheme";
  if (segmentsChanged) return "wrong_fallback_split";
  return "irregular_word_override";
}

function buildStoredResolution({
  word = "",
  sentence = null,
  segments = [],
  focusGrapheme = "",
  patternType = "",
  classificationSource = PHONICS_CLASSIFICATION_SOURCES.ruleEngine,
  approvedExceptionId = "",
  matchedWordRowId = "",
} = {}) {
  const cleanSegments = toSegmentList(segments);
  const cleanFocus = normalizeToken(focusGrapheme) || getFallbackFocus(cleanSegments);
  const meta = inferPattern(cleanSegments);
  return {
    word: normalizeLookupWord(word),
    sentence: normalizeSentence(sentence),
    segments: cleanSegments,
    focusGrapheme: cleanFocus,
    patternType: String(patternType || meta.patternType || "").trim().toLowerCase() || "single",
    classificationSource: classificationSource || PHONICS_CLASSIFICATION_SOURCES.ruleEngine,
    approvedExceptionId: String(approvedExceptionId || "").trim(),
    matchedWordRowId: String(matchedWordRowId || "").trim(),
  };
}

function buildStoredWordBankResolution(wordRow) {
  const segments = toSegmentList(wordRow?.segments);
  if (!segments.length) return null;
  const choice = wordRow?.choice && typeof wordRow.choice === "object" ? wordRow.choice : {};
  return buildStoredResolution({
    word: wordRow?.word || "",
    sentence: wordRow?.sentence || null,
    segments,
    focusGrapheme: normalizeFocusFromRow(choice, segments),
    classificationSource: PHONICS_CLASSIFICATION_SOURCES.approvedWordBank,
    approvedExceptionId: choice?.approved_exception_id || "",
    matchedWordRowId: wordRow?.id || "",
  });
}

function buildExceptionResolution(exceptionRow, fallbackWord = "") {
  const graphemeData = exceptionRow?.grapheme_data_json && typeof exceptionRow.grapheme_data_json === "object"
    ? exceptionRow.grapheme_data_json
    : {};
  return buildStoredResolution({
    word: fallbackWord || exceptionRow?.word || exceptionRow?.normalized_word || "",
    segments: graphemeData?.segments || [],
    focusGrapheme: graphemeData?.focusGrapheme || exceptionRow?.focus_grapheme || "",
    patternType: graphemeData?.patternType || exceptionRow?.classification || "",
    classificationSource: PHONICS_CLASSIFICATION_SOURCES.approvedException,
    approvedExceptionId: exceptionRow?.id || "",
  });
}

function pickBestWordBankRow(rows = [], excludeTestWordId = "") {
  const blockedId = String(excludeTestWordId || "").trim();
  return [...rows]
    .filter((row) => String(row?.id || "").trim() !== blockedId)
    .sort((a, b) => {
      const aChoice = a?.choice && typeof a.choice === "object" ? a.choice : {};
      const bChoice = b?.choice && typeof b.choice === "object" ? b.choice : {};
      const aApproved = Number(!!aChoice?.approved_exception_id);
      const bApproved = Number(!!bChoice?.approved_exception_id);
      if (bApproved !== aApproved) return bApproved - aApproved;

      const aFocus = Array.isArray(aChoice?.focus_graphemes) ? aChoice.focus_graphemes.length : 0;
      const bFocus = Array.isArray(bChoice?.focus_graphemes) ? bChoice.focus_graphemes.length : 0;
      if (bFocus !== aFocus) return bFocus - aFocus;

      const aSegments = Array.isArray(a?.segments) ? a.segments.length : 0;
      const bSegments = Array.isArray(b?.segments) ? b.segments.length : 0;
      if (bSegments !== aSegments) return bSegments - aSegments;

      return String(a?.id || "").localeCompare(String(b?.id || ""));
    })[0] || null;
}

async function readApprovedWordBankRows(teacherId, normalizedWords = []) {
  const words = [...new Set((Array.isArray(normalizedWords) ? normalizedWords : []).map((item) => normalizeLookupWord(item)).filter(Boolean))];
  if (!teacherId || !words.length) return [];

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("test_words")
    .select(`
      id,
      test_id,
      word,
      sentence,
      segments,
      choice,
      tests!inner (
        teacher_id
      )
    `)
    .eq("tests.teacher_id", teacherId)
    .in("word", words);

  if (error) throw error;

  return (data || [])
    .filter((row) => normalizeLookupWord(row?.word) && words.includes(normalizeLookupWord(row.word)))
    .filter((row) => isTeacherOwnedBuilderSource(row?.choice?.source))
    .filter((row) => toSegmentList(row?.segments).length > 0);
}

async function readApprovedExceptions(teacherId, normalizedWords = []) {
  const words = [...new Set((Array.isArray(normalizedWords) ? normalizedWords : []).map((item) => normalizeLookupWord(item)).filter(Boolean))];
  if (!teacherId || !words.length) return [];

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from(PHONICS_EXCEPTION_TABLE)
    .select("*")
    .eq("teacher_id", teacherId)
    .eq("approval_status", "approved")
    .in("normalized_word", words);

  if (error) {
    if (isMissingTableError(error, PHONICS_EXCEPTION_TABLE)) return [];
    throw error;
  }

  return data || [];
}

export function normalizeLookupWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "");
}

export function isTeacherOwnedBuilderSource(source) {
  return APPROVED_WORD_BANK_SOURCES.has(String(source || "").trim().toLowerCase());
}

export function buildRuleEngineResolution(word = "") {
  const normalizedWord = normalizeLookupWord(word);
  const segments = splitWordToGraphemes(word);
  const meta = inferPattern(segments);
  return buildStoredResolution({
    word: normalizedWord,
    sentence: null,
    segments,
    focusGrapheme: meta.focusGrapheme || "",
    patternType: meta.patternType || "",
    classificationSource: PHONICS_CLASSIFICATION_SOURCES.ruleEngine,
    approvedExceptionId: "",
  });
}

export function buildPhonicsSnapshotKey(value = {}) {
  const segments = toSegmentList(value?.segments).join("|");
  const focus = normalizeToken(value?.focusGrapheme || value?.focus_grapheme || "");
  const patternType = String(value?.patternType || value?.pattern_type || "").trim().toLowerCase();
  const source = String(value?.classificationSource || value?.classification_source || "").trim().toLowerCase();
  const exceptionId = String(value?.approvedExceptionId || value?.approved_exception_id || "").trim();
  return [segments, focus, patternType, source, exceptionId].join("::");
}

export function buildCorrectionType(original = {}, corrected = {}) {
  return pickCorrectionTypeCandidates(original, corrected);
}

export function buildCorrectionSignature(correctionType = "", original = {}, corrected = {}) {
  const type = String(correctionType || buildCorrectionType(original, corrected)).trim().toLowerCase() || "irregular_word_override";
  const originalSegments = toSegmentList(original.segments).join("|") || "none";
  const correctedSegments = toSegmentList(corrected.segments).join("|") || "none";
  const originalFocus = normalizeToken(original.focusGrapheme) || "none";
  const correctedFocus = normalizeToken(corrected.focusGrapheme) || "none";
  return [type, originalSegments, correctedSegments, originalFocus, correctedFocus].join("::");
}

export async function resolvePhonicsBatch({ teacherId = "", items = [] } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) return [];

  const normalizedWords = safeItems
    .map((item) => normalizeLookupWord(item?.word))
    .filter(Boolean);

  let approvedWordBankRows = [];
  let approvedExceptions = [];

  try {
    [approvedWordBankRows, approvedExceptions] = await Promise.all([
      readApprovedWordBankRows(teacherId, normalizedWords),
      readApprovedExceptions(teacherId, normalizedWords),
    ]);
  } catch (error) {
    console.warn("resolvePhonicsBatch fallback:", error);
  }

  const wordBankByWord = new Map();
  for (const row of approvedWordBankRows) {
    const key = normalizeLookupWord(row?.word);
    if (!key) continue;
    const next = wordBankByWord.get(key) || [];
    next.push(row);
    wordBankByWord.set(key, next);
  }

  const exceptionsByWord = new Map();
  for (const row of approvedExceptions) {
    const key = normalizeLookupWord(row?.normalized_word || row?.word);
    if (!key) continue;
    exceptionsByWord.set(key, row);
  }

  return safeItems.map((item) => {
    const normalizedWord = normalizeLookupWord(item?.word);
    if (!normalizedWord) {
      return buildRuleEngineResolution("");
    }

    const wordBankMatch = pickBestWordBankRow(
      wordBankByWord.get(normalizedWord) || [],
      item?.excludeTestWordId || item?.exclude_test_word_id || "",
    );
    if (wordBankMatch) {
      return buildStoredWordBankResolution(wordBankMatch) || buildRuleEngineResolution(normalizedWord);
    }

    const approvedException = exceptionsByWord.get(normalizedWord);
    if (approvedException) {
      return buildExceptionResolution(approvedException, normalizedWord);
    }

    return buildRuleEngineResolution(normalizedWord);
  });
}

export async function buildResolvedWordMap({ teacherId = "", words = [] } = {}) {
  const safeWords = [...new Set((Array.isArray(words) ? words : []).map((item) => String(item || "")).filter(Boolean))];
  const results = await resolvePhonicsBatch({
    teacherId,
    items: safeWords.map((word) => ({ word })),
  });

  const map = new Map();
  safeWords.forEach((word, index) => {
    map.set(normalizeLookupWord(word), results[index] || buildRuleEngineResolution(word));
  });
  return map;
}

export async function readApprovedExceptionForWord({ teacherId = "", normalizedWord = "" } = {}) {
  const [row] = await readApprovedExceptions(teacherId, [normalizedWord]);
  return row || null;
}

export async function upsertApprovedPhonicsException({
  teacherId = "",
  word = "",
  notes = "",
  source = "builder_manual_approval",
  resolution = null,
} = {}) {
  const normalizedWord = normalizeLookupWord(word);
  const safeResolution = resolution && typeof resolution === "object"
    ? resolution
    : buildRuleEngineResolution(normalizedWord);
  if (!teacherId || !normalizedWord) throw new Error("Missing word approval details.");

  const existing = await readApprovedExceptionForWord({
    teacherId,
    normalizedWord,
  }).catch(() => null);

  const payload = {
    teacher_id: teacherId,
    word: normalizedWord,
    normalized_word: normalizedWord,
    grapheme_data_json: {
      segments: toSegmentList(safeResolution.segments),
      focusGrapheme: normalizeToken(safeResolution.focusGrapheme),
      patternType: String(safeResolution.patternType || "").trim().toLowerCase() || "single",
    },
    focus_grapheme: normalizeToken(safeResolution.focusGrapheme) || null,
    classification: String(safeResolution.patternType || "").trim().toLowerCase() || "single",
    source: String(source || "builder_manual_approval").trim().toLowerCase(),
    approval_status: "approved",
    notes: String(notes || "").trim() || null,
    times_seen: Math.max(0, Number(existing?.times_seen || 0)) + 1,
    times_used: Math.max(0, Number(existing?.times_used || 0)) + 1,
    updated_at: new Date().toISOString(),
  };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from(PHONICS_EXCEPTION_TABLE)
    .upsert([payload], {
      onConflict: "teacher_id,normalized_word",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function recordPhonicsCorrectionLogs({ teacherId = "", logs = [] } = {}) {
  const rows = (Array.isArray(logs) ? logs : [])
    .filter((item) => item && teacherId && normalizeLookupWord(item.word))
    .map((item) => ({
      teacher_id: teacherId,
      word: normalizeLookupWord(item.word),
      normalized_word: normalizeLookupWord(item.word),
      original_output_json: {
        segments: toSegmentList(item.original?.segments),
        focusGrapheme: normalizeToken(item.original?.focusGrapheme),
        patternType: String(item.original?.patternType || "").trim().toLowerCase() || "single",
        classificationSource: String(item.original?.classificationSource || "").trim().toLowerCase() || PHONICS_CLASSIFICATION_SOURCES.ruleEngine,
      },
      corrected_output_json: {
        segments: toSegmentList(item.corrected?.segments),
        focusGrapheme: normalizeToken(item.corrected?.focusGrapheme),
        patternType: String(item.corrected?.patternType || "").trim().toLowerCase() || "single",
        classificationSource: String(item.corrected?.classificationSource || "").trim().toLowerCase() || PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride,
      },
      correction_type: String(item.correctionType || buildCorrectionType(item.original, item.corrected)).trim().toLowerCase(),
      correction_signature: String(item.correctionSignature || buildCorrectionSignature(item.correctionType, item.original, item.corrected)).trim().toLowerCase(),
      source: String(item.source || item.original?.classificationSource || PHONICS_CLASSIFICATION_SOURCES.ruleEngine).trim().toLowerCase(),
      context_area: String(item.contextArea || "builder").trim().toLowerCase(),
      created_at: item.createdAt || new Date().toISOString(),
    }));

  if (!rows.length) return [];

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from(PHONICS_CORRECTION_LOG_TABLE)
    .insert(rows)
    .select("*");

  if (error) {
    if (isMissingTableError(error, PHONICS_CORRECTION_LOG_TABLE)) return [];
    throw error;
  }

  return data || [];
}
