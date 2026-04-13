export const DEFAULT_QUESTION_TYPE = "focus_sound";

function normaliseValue(value) {
  return String(value || "").trim().toLowerCase();
}

function inferLegacyFocusGraphemeType({ title = "" } = {}) {
  const text = normaliseValue(title);

  if (/(^|\b)(no support|assessment|independent)(\b|$)/.test(text)) {
    return "no_support_assessment";
  }
  if (/(spell loom|loom)/.test(text)) {
    return "spell_loom";
  }
  if (/(type what you hear|arrange what you hear|dictation|listen and type|listen and arrange)/.test(text)) {
    return "type_what_you_hear";
  }
  if (/(multiple choice|grapheme picker|picker)/.test(text)) {
    return "type_what_you_hear";
  }
  if (/(focused sound|focus sound)/.test(text)) {
    return "focus_sound";
  }
  if (/(build the word|build whole word|whole word|build word)/.test(text)) {
    return "type_what_you_hear";
  }

  return DEFAULT_QUESTION_TYPE;
}

export function normalizeStoredQuestionType(questionType, context = {}) {
  const value = normaliseValue(questionType);

  if (!value) return DEFAULT_QUESTION_TYPE;

  if (["segmented_spelling", "segmentedspelling", "segmented", "segmented_boxes", "segmented_independent"].includes(value)) {
    return "segmented_spelling";
  }
  if (["focus_sound", "focussound"].includes(value)) {
    return "focus_sound";
  }
  if (["spell_loom", "spellloom", "loom"].includes(value)) {
    return "spell_loom";
  }
  if (["build_whole_word", "buildwholeword", "full_picker", "full_word_build"].includes(value)) {
    return "type_what_you_hear";
  }
  if (["multiple_choice_grapheme_picker", "multiplechoicegraphemepicker", "grapheme_picker", "multiple_choice"].includes(value)) {
    return "type_what_you_hear";
  }
  if (["type_what_you_hear", "typewhatyouhear", "supported_typing", "supported_type"].includes(value)) {
    return "type_what_you_hear";
  }
  if (["no_support_assessment", "nosupportassessment", "independent", "independent_spelling"].includes(value)) {
    return "no_support_assessment";
  }
  if (value === "focus_grapheme") {
    return inferLegacyFocusGraphemeType(context);
  }

  return DEFAULT_QUESTION_TYPE;
}

export function isIndependentQuestionType(questionType, context = {}) {
  const normalized = normalizeStoredQuestionType(questionType, context);
  return normalized === "segmented_spelling" || normalized === "no_support_assessment";
}

export function getQuestionEvidenceTier(questionType, context = {}) {
  const explicit = normaliseValue(questionType);

  if ([
    "segmented_spelling",
    "segmentedspelling",
    "segmented",
    "segmented_boxes",
    "segmented_independent",
    "no_support_assessment",
    "nosupportassessment",
    "independent",
    "independent_spelling",
    "full_recall",
    "full",
    "test",
  ].includes(explicit)) {
    return "independent";
  }

  if ([
    "focus_sound",
    "focussound",
    "guided_encoding",
    "guided",
    "scroll",
    "grapheme_choice",
    "scroll_picker",
    "multiple_choice_grapheme_picker",
    "multiplechoicegraphemepicker",
    "grapheme_picker",
    "multiple_choice",
  ].includes(explicit)) {
    return "diagnostic";
  }

  if ([
    "spell_loom",
    "spellloom",
    "loom",
    "build_whole_word",
    "buildwholeword",
    "full_picker",
    "full_word_build",
    "type_what_you_hear",
    "typewhatyouhear",
    "supported_typing",
    "supported_type",
    "dictation_sentence",
    "dictation",
    "sentence",
    "audio",
  ].includes(explicit)) {
    return "supported";
  }

  const normalized = normalizeStoredQuestionType(questionType, context);
  if (isIndependentQuestionType(normalized, context)) return "independent";
  if (normalized === "focus_sound") return "diagnostic";
  return "supported";
}

function parsePositiveAttemptLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return null;
  return Math.max(1, Math.trunc(numeric));
}

function isGeneratedAttemptSource(value) {
  return ["auto_assigned", "auto-generated", "generated"].includes(normaliseValue(value));
}

function isSupportTypeRequiringTwoAttempts(value) {
  return ["focus", "recognition", "supported"].includes(normaliseValue(value));
}

export function resolveItemAttemptsAllowed(item = null, testMeta = null) {
  const choice = item?.choice && typeof item.choice === "object" ? item.choice : {};
  const explicitItemLimit = parsePositiveAttemptLimit(
    item?.max_attempts
    ?? item?.maxAttempts
    ?? choice?.max_attempts
    ?? choice?.maxAttempts
  );
  if (explicitItemLimit) return explicitItemLimit;

  const generated = isGeneratedAttemptSource(
    item?.attempt_source
    ?? item?.attemptSource
    ?? item?.assignmentOrigin
    ?? testMeta?.attempt_source
    ?? testMeta?.attemptSource
    ?? testMeta?.assignmentOrigin
  );

  if (generated) {
    const supportType = normaliseValue(choice?.assignment_support || choice?.assignmentSupport || "");
    if (supportType === "independent") return 1;
    if (isSupportTypeRequiringTwoAttempts(supportType)) return 2;

    const explicitType = normalizeStoredQuestionType(
      choice?.question_type
      ?? choice?.questionType
      ?? item?.question_type
      ?? item?.questionType
      ?? testMeta?.question_type
      ?? testMeta?.questionType,
      {
        title: item?.title || testMeta?.title || "",
        mode: item?.mode || testMeta?.mode || "",
      }
    );
    return isIndependentQuestionType(explicitType) ? 1 : 2;
  }

  const manualLimit = parsePositiveAttemptLimit(testMeta?.max_attempts ?? testMeta?.maxAttempts);
  if (manualLimit) return manualLimit;

  const fallbackType = normalizeStoredQuestionType(
    choice?.question_type
    ?? choice?.questionType
    ?? item?.question_type
    ?? item?.questionType
    ?? testMeta?.question_type
    ?? testMeta?.questionType,
    {
      title: item?.title || testMeta?.title || "",
      mode: item?.mode || testMeta?.mode || "",
    }
  );
  return isIndependentQuestionType(fallbackType) ? 1 : 2;
}

export function getQuestionTypeDisplayLabel(questionType, {
  noSupportLabel = "No support",
  fallbackLabel = "Test",
} = {}) {
  const value = normaliseValue(questionType);
  if (!value) return fallbackLabel;

  if (["segmented_spelling", "segmentedspelling", "segmented", "segmented_boxes", "segmented_independent"].includes(value)) {
    return "Segmented spelling";
  }
  if (["focus_sound", "focussound"].includes(value)) {
    return "Focus sound";
  }
  if (["spell_loom", "spellloom", "loom"].includes(value)) {
    return "Spell Loom";
  }
  if ([
    "build_whole_word",
    "buildwholeword",
    "full_picker",
    "full_word_build",
    "multiple_choice_grapheme_picker",
    "multiplechoicegraphemepicker",
    "grapheme_picker",
    "multiple_choice",
    "type_what_you_hear",
    "typewhatyouhear",
    "supported_typing",
    "supported_type",
  ].includes(value)) {
    return "Arrange what you hear";
  }
  if (["no_support_assessment", "nosupportassessment", "independent", "independent_spelling"].includes(value)) {
    return noSupportLabel;
  }
  if (value === "focus_grapheme") {
    return getQuestionTypeDisplayLabel(normalizeStoredQuestionType(questionType, {}), {
      noSupportLabel,
      fallbackLabel,
    });
  }
  return fallbackLabel;
}
