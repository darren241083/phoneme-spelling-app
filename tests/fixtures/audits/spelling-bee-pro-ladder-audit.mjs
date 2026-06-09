import { loadBrowserModule } from "../../load-browser-module.mjs";

const {
  buildSpellingBeeApprovedBank,
  buildSpellingBeeExposurePlan,
  buildSpellingBeeLadder,
  calculateSpellingBeeTimeLimitMs,
  SPELLING_BEE_DUPLICATE_PUPIL_SKIP_REASON,
  SPELLING_BEE_UNTIL_WRONG_SAFETY_ROUNDS,
} = await loadBrowserModule("../../../js/spellingBeePolicy.js", import.meta.url);

export const SPELLING_BEE_PRO_LADDER_AUDIT_VERSION = "spelling_bee_pro_ladder_audit_v1";
export const SPELLING_BEE_PRO_CONTEXTUAL_AUDIT_VERSION = "contextual_difficulty_v3a_audit_only";
export const SPELLING_BEE_PRO_LADDER_AUDIT_NOW_ISO = "2026-05-25T12:00:00.000Z";
export const REQUIRED_SPELLING_BEE_PRO_BANK_PROFILES = [
  "balanced_teacher_bank",
  "thin_high_tier_bank",
  "long_word_heavy_bank",
  "narrow_grapheme_bank",
  "strong_context_bank",
  "missing_context_bank",
  "near_minimum_until_wrong_bank",
];

const AUDIT_SEEDS = ["bee-audit-alpha", "bee-audit-beta", "bee-audit-gamma"];
const AUDIT_SCENARIOS = [
  { id: "capped_4", label: "Capped 4 rounds", maxRounds: 4, lengthMode: "capped" },
  { id: "capped_10", label: "Capped 10 rounds", maxRounds: 10, lengthMode: "capped" },
  { id: "capped_20", label: "Capped 20 rounds", maxRounds: 20, lengthMode: "capped" },
  { id: "until_wrong_50", label: "Until wrong safety cap", maxRounds: 10, lengthMode: "until_wrong" },
];
const TEACHER_REVIEW_PROMPTS = [
  "Would this feel like a genuine spelling challenge?",
  "Is the word age-appropriate and teacher-credible?",
  "Is the challenge about spelling structure rather than just length or rarity?",
  "Would the sentence and meaning help a teacher review fit quickly?",
  "Does the upper ladder feel smooth enough before any behaviour change?",
];
const CONTEXTUAL_PLACEMENT_FITS = ["below_round", "comfortable", "high_for_round", "above_hard_cap"];
const CONTEXTUAL_RISK_FLAGS = [
  "high_for_round",
  "above_hard_cap",
  "missing_context_high_effective",
  "structure_spike",
  "long_rare_without_structure",
];

function normalizeWord(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "")
    .replace(/[^a-z'-]/g, "");
}

function normalizeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function roundOne(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : null;
}

function average(values = []) {
  const clean = values.map((value) => Number(value)).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function incrementCount(target, key) {
  const safeKey = String(key || "unknown").trim() || "unknown";
  target[safeKey] = (target[safeKey] || 0) + 1;
}

function countBy(items = [], getter) {
  const counts = {};
  for (const item of items || []) incrementCount(counts, getter(item));
  return counts;
}

function countByWithKeys(items = [], keys = [], getter) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const item of items || []) incrementCount(counts, getter(item));
  return counts;
}

function difficultyBandForScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "unknown";
  if (value <= 35) return "easier";
  if (value <= 55) return "core";
  if (value <= 70) return "stretch";
  return "challenge";
}

function getChoice(row = null) {
  return row?.choice && typeof row.choice === "object" && !Array.isArray(row.choice)
    ? row.choice
    : {};
}

function getFocus(row = null) {
  const choice = getChoice(row);
  const focusList = Array.isArray(choice.focus_graphemes) ? choice.focus_graphemes : [];
  return normalizeToken(
    choice.primary_focus_grapheme
    || row?.primary_focus_grapheme
    || focusList[0]
    || row?.focus_grapheme
    || ""
  );
}

function getMeaning(row = null) {
  const choice = getChoice(row);
  const context = choice.context_support && typeof choice.context_support === "object"
    ? choice.context_support
    : {};
  return String(row?.meaning || context.meaning || "").trim();
}

function hasApprovedSentence(row = null) {
  const choice = getChoice(row);
  const context = choice.context_support && typeof choice.context_support === "object"
    ? choice.context_support
    : {};
  return !!String(row?.sentence || context.sentence || "").trim();
}

function hasApprovedMeaning(row = null) {
  return !!getMeaning(row);
}

function wordFamilyForFocus(focus = "") {
  const clean = normalizeToken(focus);
  if (["tion", "ci", "tch", "dge"].includes(clean)) return "morphology";
  if (["ar", "or", "er", "ur", "air", "ear"].includes(clean)) return "r_controlled";
  if (["sh", "ch", "th", "ng", "ph", "wh", "ck"].includes(clean)) return "consonant_digraph";
  if (["ai", "ay", "ee", "ea", "oa", "igh", "ie", "oi", "oy", "ou", "ow", "au", "aw", "ew", "ure"].includes(clean)) return "vowel_pattern";
  return clean || "unknown";
}

function analyseStructure(row = null) {
  const word = normalizeWord(row?.word || "");
  const segments = Array.isArray(row?.segments)
    ? row.segments.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const letterCount = word.replace(/[^a-z]/g, "").length;
  const graphemeCount = segments.length || Math.max(1, letterCount);
  const multiLetterGraphemeCount = segments.filter((item) => item.length > 1).length;
  const longGraphemeCount = segments.filter((item) => item.length >= 3).length;
  const clusterCount = segments.filter((item) => /^(str|scr|spr|thr|spl|tion|dge|tch)$/i.test(item)).length;
  const structureScore = (multiLetterGraphemeCount * 3)
    + (longGraphemeCount * 5)
    + (clusterCount * 3)
    + Math.max(0, graphemeCount - 5);

  return {
    letterCount,
    graphemeCount,
    multiLetterGraphemeCount,
    longGraphemeCount,
    clusterCount,
    structureScore,
  };
}

function buildContextualDifficultyAudit(row = null) {
  const staticScore = clampScore(row?.beeDifficultyScore ?? getChoice(row).difficulty?.coreScore);
  const target = clampScore(row?.beeTargetDifficulty || 50);
  const structure = analyseStructure(row);
  const hasSentence = hasApprovedSentence(row);
  const hasMeaning = hasApprovedMeaning(row);
  const missingContextCount = Number(!hasSentence) + Number(!hasMeaning);
  const structureAdjustment = Math.min(14, Math.max(0, structure.structureScore - 8));
  const contextAdjustment = missingContextCount * (Number(staticScore || 0) >= 56 ? 5 : 3);
  const noSupportAdjustment = 4;
  const effectiveScore = clampScore(Number(staticScore || 0) + structureAdjustment + contextAdjustment + noSupportAdjustment);
  const hardMax = Math.min(100, Number(target || 0) + 18);
  const scoreVsRoundTarget = effectiveScore === null ? null : effectiveScore - Number(target || 0);
  let placementFit = "comfortable";
  if (effectiveScore !== null && effectiveScore < Number(target || 0) - 16) placementFit = "below_round";
  if (effectiveScore !== null && effectiveScore > Number(target || 0) + 12) placementFit = "high_for_round";
  if (effectiveScore !== null && effectiveScore > hardMax) placementFit = "above_hard_cap";
  const flags = [];
  if (placementFit === "high_for_round") flags.push("high_for_round");
  if (placementFit === "above_hard_cap") flags.push("above_hard_cap");
  if (missingContextCount > 0 && Number(effectiveScore || 0) >= 60) flags.push("missing_context_high_effective");
  if (Number(effectiveScore || 0) - Number(staticScore || 0) >= 12) flags.push("structure_spike");
  if (structure.letterCount >= 10 && structure.multiLetterGraphemeCount <= 1 && Number(staticScore || 0) >= 60) {
    flags.push("long_rare_without_structure");
  }

  return {
    modelVersion: SPELLING_BEE_PRO_CONTEXTUAL_AUDIT_VERSION,
    staticScore,
    staticBand: difficultyBandForScore(staticScore),
    effectiveScore,
    effectiveBand: difficultyBandForScore(effectiveScore),
    scoreDelta: effectiveScore === null || staticScore === null ? null : effectiveScore - staticScore,
    roundTarget: target,
    hardMax,
    scoreVsRoundTarget,
    placementFit,
    noSupportAdjustment,
    structureAdjustment,
    contextAdjustment,
    structure,
    context: {
      hasSentence,
      hasMeaning,
      availability: hasSentence && hasMeaning
        ? "sentence_and_meaning"
        : hasSentence
          ? "sentence_only"
          : hasMeaning
            ? "meaning_only"
            : "missing",
    },
    flags,
  };
}

function sentenceFor(word, phrase = "The class discussed it during the lesson.") {
  return `${phrase.replace(/\bit\b/g, word)}`;
}

function meaningFor(word, phrase = "A word selected for spelling practice.") {
  return `${phrase.replace(/\bit\b/g, word)}`;
}

function wordRow([word, focus, segments, score, sentence = "", meaning = ""], index, overrides = {}) {
  const cleanWord = normalizeWord(word);
  const cleanFocus = normalizeToken(focus);
  const finalSentence = overrides.omitSentence ? "" : (sentence || sentenceFor(cleanWord, `The class used ${cleanWord} in a clear sentence.`));
  const finalMeaning = overrides.omitMeaning ? "" : (meaning || meaningFor(cleanWord));
  const band = difficultyBandForScore(score);
  return {
    id: `${overrides.idPrefix || "bee-audit"}-${index + 1}-${cleanWord}`,
    word: cleanWord,
    normalised_word: cleanWord,
    sentence: finalSentence,
    meaning: finalMeaning,
    segments: Array.isArray(segments) ? segments : String(cleanWord).split(""),
    choice: {
      source: "teacher",
      approved_source: "teacher",
      focus_graphemes: [cleanFocus],
      primary_focus_grapheme: cleanFocus,
      selection_suitability: "standard",
      suitability_status: "suitable",
      approval_status: "approved",
      is_active: true,
      difficulty: {
        coreScore: score,
        score,
        band,
        coreBand: band,
      },
      context_support: {
        sentence: finalSentence,
        sentence_status: finalSentence ? "approved" : "missing",
        meaning: finalMeaning,
        meaning_status: finalMeaning ? "approved" : "missing",
        meaning_enabled: !!finalMeaning,
      },
    },
  };
}

const BALANCED_ENTRIES = [
  ["rain", "ai", ["r", "ai", "n"], 24, "Rain tapped on the classroom window.", "Water drops falling from clouds."],
  ["seed", "ee", ["s", "ee", "d"], 26, "A seed was planted in the pot.", "The part of a plant that can grow."],
  ["boat", "oa", ["b", "oa", "t"], 28, "The boat crossed the lake.", "A small vehicle for travelling on water."],
  ["light", "igh", ["l", "igh", "t"], 30, "The light flickered above the desk.", "Brightness that helps people see."],
  ["shell", "sh", ["sh", "e", "ll"], 32, "The shell was smooth and white.", "A hard outer covering."],
  ["chain", "ai", ["ch", "ai", "n"], 34, "The chain rattled on the gate.", "Linked metal rings."],
  ["badge", "dge", ["b", "a", "dge"], 36, "He pinned the badge to his jumper.", "A small sign worn on clothing."],
  ["phone", "ph", ["ph", "o", "n", "e"], 38, "The phone buzzed on the desk.", "A device used for calls and messages."],
  ["beehive", "ee", ["b", "ee", "h", "i", "v", "e"], 40, "The beekeeper checked the beehive.", "A home where bees live."],
  ["yellow", "ow", ["y", "e", "ll", "ow"], 42, "The yellow pencil rolled away.", "The colour of lemons or sunshine."],
  ["whisper", "er", ["w", "h", "i", "s", "p", "er"], 44, "Please whisper near the library door.", "To speak very quietly."],
  ["teacher", "ch", ["t", "ea", "ch", "er"], 45, "The teacher read the sentence aloud.", "A person who helps pupils learn."],
  ["action", "tion", ["a", "c", "tion"], 46, "The story was full of action.", "Something that is done."],
  ["bridge", "dge", ["b", "r", "i", "dge"], 48, "They crossed the bridge together.", "A structure over a road, river, or gap."],
  ["morning", "or", ["m", "or", "n", "i", "ng"], 48, "Morning sunlight filled the room.", "The early part of the day."],
  ["shower", "ow", ["sh", "ow", "er"], 50, "A short shower passed over the playground.", "A brief fall of rain."],
  ["thunder", "th", ["th", "u", "n", "d", "er"], 50, "Thunder rumbled after the flash.", "The loud sound after lightning."],
  ["station", "tion", ["s", "t", "a", "tion"], 52, "The station was busy after school.", "A place where trains or buses stop."],
  ["sparkle", "ar", ["s", "p", "ar", "k", "l", "e"], 52, "Tiny lights made the card sparkle.", "To shine with quick flashes."],
  ["secure", "ure", ["s", "e", "c", "ure"], 54, "Keep your lunch box secure.", "Safe and firmly held."],
  ["fiction", "tion", ["f", "i", "c", "tion"], 54, "Fiction books stood on the shelf.", "Stories that are imagined."],
  ["midnight", "igh", ["m", "i", "d", "n", "igh", "t"], 56, "The clock chimed at midnight.", "Twelve o'clock at night."],
  ["support", "or", ["s", "u", "pp", "or", "t"], 56, "The shelf needs support at both ends.", "Help or something that holds weight."],
  ["picture", "ure", ["p", "i", "c", "t", "ure"], 58, "The picture showed a bright garden.", "An image made by drawing or a camera."],
  ["audience", "au", ["au", "d", "i", "e", "n", "c", "e"], 58, "The audience clapped after the song.", "People watching or listening."],
  ["nature", "ure", ["n", "a", "t", "ure"], 60, "We listened to nature during the walk.", "Plants, animals, and the world around us."],
  ["conversation", "tion", ["c", "o", "n", "v", "er", "s", "a", "tion"], 60, "The conversation stayed friendly.", "A talk between people."],
  ["preparation", "tion", ["p", "r", "e", "p", "a", "r", "a", "tion"], 60, "Good preparation made the show smoother.", "Work done before an event or task."],
  ["presentation", "tion", ["p", "r", "e", "s", "e", "n", "t", "a", "tion"], 62, "Her presentation used clear pictures.", "A talk or display given to others."],
  ["description", "tion", ["d", "e", "s", "c", "r", "i", "p", "tion"], 62, "The description helped us draw the scene.", "Words that explain what something is like."],
  ["translation", "tion", ["t", "r", "a", "n", "s", "l", "a", "tion"], 62, "The translation helped everyone read the sign.", "Words changed into another language."],
  ["subtraction", "tion", ["s", "u", "b", "t", "r", "a", "c", "tion"], 64, "Subtraction solved the maths problem.", "Taking one number away from another."],
  ["communication", "tion", ["c", "o", "m", "m", "u", "n", "i", "c", "a", "tion"], 64, "Clear communication helped the team.", "Sharing information with others."],
  ["manufacture", "ure", ["m", "a", "n", "u", "f", "a", "c", "t", "ure"], 66, "The factory can manufacture bicycle parts.", "To make goods in large amounts."],
  ["literature", "ure", ["l", "i", "t", "e", "r", "a", "t", "ure"], 66, "The class studied literature from many places.", "Stories, poems, and other writing."],
  ["imagination", "tion", ["i", "m", "a", "g", "i", "n", "a", "tion"], 66, "The story showed great imagination.", "The ability to form ideas in the mind."],
  ["transportation", "tion", ["t", "r", "a", "n", "s", "p", "or", "t", "a", "tion"], 68, "The city improved transportation for pupils.", "Ways of moving people or goods."],
  ["multiplication", "tion", ["m", "u", "l", "t", "i", "p", "l", "i", "c", "a", "tion"], 68, "Multiplication helped solve the puzzle.", "A maths operation for repeated groups."],
  ["investigation", "tion", ["i", "n", "v", "e", "s", "t", "i", "g", "a", "tion"], 70, "The investigation found the missing key.", "A careful search for facts."],
  ["automatic", "au", ["au", "t", "o", "m", "a", "t", "i", "c"], 70, "The automatic door opened slowly.", "Working by itself."],
  ["adventure", "ure", ["a", "d", "v", "e", "n", "t", "ure"], 70, "The adventure began after breakfast.", "An exciting or unusual experience."],
  ["observation", "tion", ["o", "b", "s", "er", "v", "a", "tion"], 72, "Careful observation helped the scientist.", "Watching or noticing carefully."],
  ["expedition", "tion", ["e", "x", "p", "e", "d", "i", "tion"], 72, "The expedition crossed the hills.", "A journey made for a purpose."],
  ["cashier", "ie", ["c", "a", "sh", "ie", "r"], 58, "The cashier counted the change.", "A person who takes payments in a shop."],
  ["frontier", "ie", ["f", "r", "o", "n", "t", "ie", "r"], 60, "The old map showed the frontier.", "The edge or border of a settled area."],
  ["spacious", "ci", ["s", "p", "a", "ci", "ou", "s"], 58, "The spacious hall held the whole school.", "Having plenty of room."],
  ["suspicious", "ci", ["s", "u", "s", "p", "i", "ci", "ou", "s"], 60, "The missing crumbs looked suspicious.", "Making someone feel something is wrong."],
  ["cautiously", "au", ["c", "au", "t", "i", "ou", "s", "l", "y"], 60, "The skater moved cautiously on the ice.", "In a careful way that avoids risk."],
  ["daughter", "au", ["d", "au", "g", "h", "t", "er"], 58, "His daughter joined the choir.", "A person's female child."],
  ["applaud", "au", ["a", "p", "p", "l", "au", "d"], 58, "The class began to applaud the reader.", "To clap to show enjoyment."],
  ["dinosaur", "au", ["d", "i", "n", "o", "s", "au", "r"], 60, "The museum had a tall dinosaur model.", "A large reptile that lived long ago."],
  ["cashew", "ew", ["c", "a", "sh", "ew"], 56, "A cashew sat beside the raisins.", "A curved nut used as food."],
  ["nephew", "ew", ["n", "e", "ph", "ew"], 58, "My nephew likes building towers.", "The son of your brother or sister."],
  ["lawnmower", "aw", ["l", "aw", "n", "m", "ow", "er"], 58, "The lawnmower stood beside the shed.", "A machine used to cut grass."],
  ["strawberry", "aw", ["s", "t", "r", "aw", "b", "e", "rr", "y"], 60, "A strawberry topped the pudding.", "A small red fruit."],
  ["stretch", "tch", ["s", "t", "r", "e", "tch"], 46, "Stretch the string across the table.", "To make something longer by pulling."],
  ["switch", "tch", ["s", "w", "i", "tch"], 56, "Press the switch to turn on the light.", "A small control that turns something on or off."],
  ["watchful", "tch", ["w", "a", "tch", "f", "u", "l"], 58, "The watchful goalkeeper stayed ready.", "Paying close attention."],
  ["thorny", "th", ["th", "or", "n", "y"], 50, "The thorny branch caught his sleeve.", "Covered with sharp points."],
  ["beanstalk", "ea", ["b", "ea", "n", "s", "t", "a", "l", "k"], 54, "The beanstalk grew beside the wall.", "The stem of a bean plant."],
  ["earthquake", "ear", ["ear", "th", "qu", "a", "k", "e"], 64, "The earthquake shook the old bridge.", "A sudden shaking of the ground."],
];

const LONG_WORD_ENTRIES = [
  ["calendar", "ar", ["c", "a", "l", "e", "n", "d", "a", "r"], 48],
  ["volunteer", "ee", ["v", "o", "l", "u", "n", "t", "ee", "r"], 52],
  ["remembering", "er", ["r", "e", "m", "e", "m", "b", "er", "i", "ng"], 56],
  ["character", "ch", ["ch", "a", "r", "a", "c", "t", "er"], 58],
  ["important", "or", ["i", "m", "p", "or", "t", "a", "n", "t"], 60],
  ["different", "er", ["d", "i", "ff", "er", "e", "n", "t"], 60],
  ["beautiful", "eau", ["b", "eau", "t", "i", "f", "u", "l"], 62],
  ["interesting", "ing", ["i", "n", "t", "er", "e", "s", "t", "i", "ng"], 64],
  ["vegetable", "ge", ["v", "e", "g", "e", "t", "a", "b", "l", "e"], 64],
  ["ordinary", "or", ["or", "d", "i", "n", "a", "r", "y"], 66],
  ["favourite", "ou", ["f", "a", "v", "ou", "r", "i", "t", "e"], 66],
  ["separate", "ar", ["s", "e", "p", "a", "r", "a", "t", "e"], 68],
  ["medicine", "ci", ["m", "e", "d", "i", "ci", "n", "e"], 68],
  ["business", "s", ["b", "u", "s", "i", "n", "e", "ss"], 70],
  ["exercise", "ci", ["e", "x", "er", "ci", "s", "e"], 70],
  ["february", "ar", ["f", "e", "b", "r", "u", "a", "r", "y"], 72],
  ["wednesday", "ay", ["w", "e", "d", "n", "e", "s", "d", "ay"], 72],
  ["knowledge", "dge", ["k", "n", "ow", "l", "e", "dge"], 74],
  ["surprise", "ur", ["s", "ur", "p", "r", "i", "s", "e"], 74],
  ["responsibility", "y", ["r", "e", "s", "p", "o", "n", "s", "i", "b", "i", "l", "i", "t", "y"], 78],
  ["opportunity", "y", ["o", "p", "p", "or", "t", "u", "n", "i", "t", "y"], 78],
  ["temperature", "ure", ["t", "e", "m", "p", "e", "r", "a", "t", "ure"], 80],
  ["environment", "er", ["e", "n", "v", "i", "r", "o", "n", "m", "e", "n", "t"], 82],
  ["pronunciation", "tion", ["p", "r", "o", "n", "u", "n", "ci", "a", "tion"], 84],
];

const NARROW_TION_WORDS = [
  "action", "motion", "station", "fiction", "mention", "question", "section", "option",
  "nation", "position", "direction", "connection", "attention", "invention", "extension",
  "collection", "selection", "protection", "instruction", "description", "introduction",
  "subtraction", "tradition", "translation", "conversation", "preparation", "presentation",
  "observation", "imagination", "transportation", "multiplication", "investigation",
  "celebration", "decoration", "information", "invitation",
];

function buildRows(entries, options = {}) {
  return entries.map((entry, index) => {
    const omitSentence = typeof options.omitSentence === "function"
      ? options.omitSentence(entry, index)
      : !!options.omitSentence;
    const omitMeaning = typeof options.omitMeaning === "function"
      ? options.omitMeaning(entry, index)
      : !!options.omitMeaning;
    return wordRow(entry, index, {
      idPrefix: options.idPrefix,
      omitSentence,
      omitMeaning,
    });
  });
}

function buildThinHighTierBank() {
  return buildRows([
    ...BALANCED_ENTRIES.slice(0, 12),
    BALANCED_ENTRIES[12],
    BALANCED_ENTRIES[13],
    BALANCED_ENTRIES[17],
  ], { idPrefix: "thin-high-tier" });
}

function buildLongWordHeavyBank() {
  return buildRows([
    ...BALANCED_ENTRIES.slice(0, 3),
    ...LONG_WORD_ENTRIES,
  ], { idPrefix: "long-word-heavy" });
}

function buildNarrowGraphemeBank() {
  return buildRows(NARROW_TION_WORDS.map((word, index) => [
    word,
    "tion",
    normalizeWord(word).endsWith("tion")
      ? [...normalizeWord(word).slice(0, -"tion".length)].map((item) => item).concat("tion")
      : String(word).split(""),
    Math.min(86, 46 + (index * 2)),
    `The word ${word} appeared in the spelling list.`,
    `A ${word} word selected for a narrow tion coverage simulation.`,
  ]), { idPrefix: "narrow-grapheme" });
}

function buildMissingContextBank() {
  return buildRows(BALANCED_ENTRIES, {
    idPrefix: "missing-context",
    omitSentence: (_entry, index) => index % 4 === 0 || index >= 24,
    omitMeaning: (_entry, index) => index % 3 === 0 || index >= 24,
  });
}

function buildNearMinimumUntilWrongBank() {
  const lowRows = BALANCED_ENTRIES.slice(0, 2);
  const challengeRows = BALANCED_ENTRIES.filter((entry) => Number(entry[3]) >= 46).slice(0, 48);
  return buildRows([...lowRows, ...challengeRows], { idPrefix: "near-minimum-until-wrong" });
}

function buildAuditBankProfiles() {
  return [
    {
      id: "balanced_teacher_bank",
      label: "Balanced teacher-approved bank",
      purpose: "Baseline Bee/pro ladder with broad grapheme and challenge coverage.",
      rows: buildRows(BALANCED_ENTRIES, { idPrefix: "balanced-teacher" }),
    },
    {
      id: "thin_high_tier_bank",
      label: "Thin high-tier coverage",
      purpose: "Shows release pressure when total rows exist but challenge rows are scarce.",
      rows: buildThinHighTierBank(),
    },
    {
      id: "long_word_heavy_bank",
      label: "Long-word-heavy challenge bank",
      purpose: "Tests whether pro challenge is structurally rich or mostly long/rare.",
      rows: buildLongWordHeavyBank(),
    },
    {
      id: "narrow_grapheme_bank",
      label: "Narrow grapheme coverage",
      purpose: "Tests ladder reliance on one grapheme family at upper tiers.",
      rows: buildNarrowGraphemeBank(),
    },
    {
      id: "strong_context_bank",
      label: "Strong context coverage",
      purpose: "Control bank where sentence and meaning are available throughout.",
      rows: buildRows(BALANCED_ENTRIES, { idPrefix: "strong-context" }),
    },
    {
      id: "missing_context_bank",
      label: "Missing upper-tier context",
      purpose: "Exposes hidden difficulty from absent sentence/meaning support.",
      rows: buildMissingContextBank(),
    },
    {
      id: "near_minimum_until_wrong_bank",
      label: "Near-minimum until-wrong bank",
      purpose: "Exactly meets the current until-wrong safety cap without coverage buffer.",
      rows: buildNearMinimumUntilWrongBank(),
    },
  ];
}

function summarizeContextCoverage(rows = []) {
  const totalWords = rows.length;
  const sentenceCount = rows.filter(hasApprovedSentence).length;
  const meaningCount = rows.filter(hasApprovedMeaning).length;
  const bothCount = rows.filter((row) => hasApprovedSentence(row) && hasApprovedMeaning(row)).length;
  return {
    totalWords,
    sentenceCount,
    meaningCount,
    bothCount,
    sentenceCoverageRate: roundOne(sentenceCount / Math.max(1, totalWords)),
    meaningCoverageRate: roundOne(meaningCount / Math.max(1, totalWords)),
    bothCoverageRate: roundOne(bothCount / Math.max(1, totalWords)),
    missingSentenceCount: totalWords - sentenceCount,
    missingMeaningCount: totalWords - meaningCount,
  };
}

function summarizeBankProfile(profile) {
  const approvedBank = buildSpellingBeeApprovedBank(profile.rows);
  const challengeRows = approvedBank.filter((row) => Number(row.beeDifficultyScore || 0) >= 46);
  const proRows = approvedBank.filter((row) => Number(row.beeDifficultyScore || 0) >= 60);
  const highTierContext = summarizeContextCoverage(proRows);
  const structures = approvedBank.map(analyseStructure);
  const focusCounts = countBy(approvedBank, getFocus);
  const dominantFocus = Object.entries(focusCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || ["", 0];

  return {
    id: profile.id,
    label: profile.label,
    purpose: profile.purpose,
    sourceRows: profile.rows.length,
    approvedCount: approvedBank.length,
    challengeWordCount: challengeRows.length,
    proWordCount: proRows.length,
    untilWrongRequired: SPELLING_BEE_UNTIL_WRONG_SAFETY_ROUNDS,
    capped20ChallengeShortfall: Math.max(0, 18 - challengeRows.length),
    untilWrongChallengeShortfall: Math.max(0, (SPELLING_BEE_UNTIL_WRONG_SAFETY_ROUNDS - 2) - challengeRows.length),
    untilWrongBuffer: approvedBank.length - SPELLING_BEE_UNTIL_WRONG_SAFETY_ROUNDS,
    difficultyBands: countBy(approvedBank, (row) => difficultyBandForScore(row.beeDifficultyScore)),
    focusCounts,
    familyCounts: countBy(approvedBank, (row) => wordFamilyForFocus(getFocus(row))),
    dominantFocus: dominantFocus[0] || "",
    dominantFocusRate: roundOne(Number(dominantFocus[1] || 0) / Math.max(1, approvedBank.length)),
    contextCoverage: summarizeContextCoverage(approvedBank),
    highTierContextCoverage: highTierContext,
    averageLetterCount: roundOne(average(structures.map((item) => item.letterCount))),
    averageGraphemeCount: roundOne(average(structures.map((item) => item.graphemeCount))),
    averageStructureScore: roundOne(average(structures.map((item) => item.structureScore))),
    approvedSourceOnly: approvedBank.every((row) => String(getChoice(row).source || "").trim().toLowerCase() === "teacher"),
  };
}

function summarizeLadderWords(words = []) {
  return words.map((row) => {
    const focus = getFocus(row);
    const structure = analyseStructure(row);
    const contextualDifficulty = buildContextualDifficultyAudit(row);
    const qualityFlags = [];
    if (!contextualDifficulty.context.hasSentence) qualityFlags.push("missing_sentence");
    if (!contextualDifficulty.context.hasMeaning) qualityFlags.push("missing_meaning");
    if (contextualDifficulty.flags.includes("long_rare_without_structure")) qualityFlags.push("length_driven_challenge");
    if (structure.multiLetterGraphemeCount >= 2 || structure.longGraphemeCount >= 1) qualityFlags.push("structure_rich_challenge");

    return {
      round: Number(row.beeRound || 0),
      word: normalizeWord(row.word || ""),
      focus,
      focusFamily: wordFamilyForFocus(focus),
      score: Number(row.beeDifficultyScore || 0),
      targetScore: Number(row.beeTargetDifficulty || 0),
      targetDelta: Number(row.beeDifficultyScore || 0) - Number(row.beeTargetDifficulty || 0),
      graphemeCount: Number(row.beeGraphemeCount || structure.graphemeCount),
      timeLimitMs: calculateSpellingBeeTimeLimitMs(row),
      structure,
      context: contextualDifficulty.context,
      contextualDifficulty,
      qualityFlags,
    };
  });
}

function summarizeContextualDifficulty(words = []) {
  const contextualRows = words.map((word) => word.contextualDifficulty || {});
  return {
    modelVersion: SPELLING_BEE_PRO_CONTEXTUAL_AUDIT_VERSION,
    averageStaticScore: roundOne(average(contextualRows.map((row) => row.staticScore))),
    averageEffectiveScore: roundOne(average(contextualRows.map((row) => row.effectiveScore))),
    averageDelta: roundOne(average(contextualRows.map((row) => row.scoreDelta))),
    placementPressure: countByWithKeys(contextualRows, CONTEXTUAL_PLACEMENT_FITS, (row) => row.placementFit || "comfortable"),
    riskFlags: countByWithKeys(
      contextualRows.flatMap((row) => row.flags || []),
      CONTEXTUAL_RISK_FLAGS,
      (flag) => flag,
    ),
    hiddenSpikeCount: contextualRows.filter((row) =>
      Number(row.scoreDelta || 0) >= 10
      || ["high_for_round", "above_hard_cap"].includes(row.placementFit || "")
    ).length,
  };
}

function summarizeProQuality(words = []) {
  const upperRoundStart = Math.max(1, Math.floor(words.length * 0.7));
  const upperWords = words.filter((word) => word.round >= upperRoundStart || word.score >= 60);
  const structureRichCount = upperWords.filter((word) => word.qualityFlags.includes("structure_rich_challenge")).length;
  const lengthDrivenCount = upperWords.filter((word) => word.qualityFlags.includes("length_driven_challenge")).length;
  const contextCoverage = summarizeContextCoverage(upperWords.map((word) => ({
    sentence: word.context.hasSentence ? "available" : "",
    meaning: word.context.hasMeaning ? "available" : "",
    choice: {},
  })));

  return {
    upperTierWordCount: upperWords.length,
    averageUpperScore: roundOne(average(upperWords.map((word) => word.score))),
    averageUpperLetterCount: roundOne(average(upperWords.map((word) => word.structure.letterCount))),
    averageUpperGraphemeCount: roundOne(average(upperWords.map((word) => word.structure.graphemeCount))),
    averageUpperStructureScore: roundOne(average(upperWords.map((word) => word.structure.structureScore))),
    structureRichChallengeCount: structureRichCount,
    structureRichChallengeRate: roundOne(structureRichCount / Math.max(1, upperWords.length)),
    lengthDrivenChallengeCount: lengthDrivenCount,
    lengthDrivenChallengeRate: roundOne(lengthDrivenCount / Math.max(1, upperWords.length)),
    contextCoverage,
    teacherCredibilityFlagCounts: countBy(
      upperWords.flatMap((word) => word.qualityFlags),
      (flag) => flag,
    ),
    sampleWords: upperWords.slice(0, 8).map((word) => ({
      round: word.round,
      word: word.word,
      focus: word.focus,
      score: word.score,
      effectiveScore: word.contextualDifficulty.effectiveScore,
      flags: word.qualityFlags,
    })),
  };
}

function summarizeLadderMetrics(words = []) {
  const scores = words.map((word) => Number(word.score || 0));
  const jumps = scores.slice(1).map((score, index) => score - scores[index]);
  const focusCounts = countBy(words, (word) => word.focus || "unknown");
  const familyCounts = countBy(words, (word) => word.focusFamily || "unknown");
  const dominantFocus = Object.entries(focusCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || ["", 0];
  const seenWords = new Set();
  const repeatedWords = [];
  for (const word of words) {
    if (seenWords.has(word.word)) repeatedWords.push(word.word);
    seenWords.add(word.word);
  }
  let adjacentFocusRepeatCount = 0;
  let adjacentFamilyRepeatCount = 0;
  let maxAdjacentFocusRun = 0;
  let currentRun = 0;
  let previousFocus = "";
  for (const word of words) {
    if (word.focus === previousFocus) {
      adjacentFocusRepeatCount += 1;
      currentRun += 1;
    } else {
      currentRun = 1;
    }
    maxAdjacentFocusRun = Math.max(maxAdjacentFocusRun, currentRun);
    previousFocus = word.focus;
  }
  for (let index = 1; index < words.length; index += 1) {
    if (words[index].focusFamily === words[index - 1].focusFamily) adjacentFamilyRepeatCount += 1;
  }

  return {
    roundCount: words.length,
    minScore: scores.length ? Math.min(...scores) : null,
    maxScore: scores.length ? Math.max(...scores) : null,
    averageScore: roundOne(average(scores)),
    averageTargetDelta: roundOne(average(words.map((word) => Math.abs(word.targetDelta)))),
    maxTargetDelta: words.length ? Math.max(...words.map((word) => Math.abs(word.targetDelta))) : null,
    maxPositiveJump: jumps.length ? Math.max(...jumps) : 0,
    maxDrop: jumps.length ? Math.min(...jumps) : 0,
    averageAbsJump: roundOne(average(jumps.map((jump) => Math.abs(jump)))),
    largeJumpCount: jumps.filter((jump) => jump > 16).length,
    monotonicityBreakCount: jumps.filter((jump) => jump < 0).length,
    easyAfterHardReversalCount: jumps.filter((jump, index) => scores[index] >= 60 && jump <= -12).length,
    highTierCount: words.filter((word) => word.score >= 60).length,
    highTierRate: roundOne(words.filter((word) => word.score >= 60).length / Math.max(1, words.length)),
    duplicateWordCount: repeatedWords.length,
    repeatedWords,
    focusCounts,
    familyCounts,
    dominantFocus: dominantFocus[0] || "",
    dominantFocusRate: roundOne(Number(dominantFocus[1] || 0) / Math.max(1, words.length)),
    adjacentFocusRepeatCount,
    adjacentFamilyRepeatCount,
    maxAdjacentFocusRun,
    contextCoverage: summarizeContextCoverage(words.map((word) => ({
      sentence: word.context.hasSentence ? "available" : "",
      meaning: word.context.hasMeaning ? "available" : "",
      choice: {},
    }))),
    contextualDifficulty: summarizeContextualDifficulty(words),
    proQuality: summarizeProQuality(words),
  };
}

function buildSimulation(profile, scenario, seed) {
  const ladder = buildSpellingBeeLadder({
    wordRows: profile.rows,
    maxRounds: scenario.maxRounds,
    lengthMode: scenario.lengthMode,
    seed,
  });
  const base = {
    id: `${profile.id}:${scenario.id}:${seed}`,
    profileId: profile.id,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    seed,
    status: ladder.status,
    required: ladder.required,
    available: ladder.available,
    lengthMode: ladder.lengthMode,
    error: ladder.error || "",
  };
  if (ladder.status !== "ready") {
    return {
      ...base,
      words: [],
      metrics: null,
      decisionFlags: ["targeted_bank_expansion"],
    };
  }
  const words = summarizeLadderWords(ladder.words);
  const metrics = summarizeLadderMetrics(words);
  const decisionFlags = [];
  if (metrics.largeJumpCount > 0 || metrics.easyAfterHardReversalCount > 0) decisionFlags.push("ladder_redesign");
  if (metrics.dominantFocusRate >= 0.5 || metrics.adjacentFocusRepeatCount >= 4) decisionFlags.push("ladder_redesign");
  if (metrics.contextualDifficulty.hiddenSpikeCount > 0
    || metrics.contextualDifficulty.riskFlags.missing_context_high_effective > 0) {
    decisionFlags.push("contextual_difficulty_rollout");
  }
  if (metrics.proQuality.lengthDrivenChallengeRate >= 0.4) decisionFlags.push("ladder_redesign");
  if (metrics.proQuality.contextCoverage.bothCoverageRate < 0.9) decisionFlags.push("targeted_bank_expansion");

  return {
    ...base,
    words,
    selectedWords: words.map((word) => word.word),
    selectedFocuses: words.map((word) => word.focus),
    metrics,
    decisionFlags: [...new Set(decisionFlags)],
  };
}

function pairwiseOverlapRate(a = [], b = []) {
  const bSet = new Set(b);
  const overlap = a.filter((item) => bSet.has(item)).length;
  return roundOne(overlap / Math.max(1, Math.min(a.length, b.length)));
}

function summarizeSeedSensitivity(simulations = []) {
  const groups = new Map();
  for (const simulation of simulations || []) {
    if (simulation.status !== "ready") continue;
    const key = `${simulation.profileId}:${simulation.scenarioId}`;
    groups.set(key, [...(groups.get(key) || []), simulation]);
  }

  return [...groups.entries()].map(([key, rows]) => {
    const overlaps = [];
    for (let index = 0; index < rows.length; index += 1) {
      for (let next = index + 1; next < rows.length; next += 1) {
        overlaps.push(pairwiseOverlapRate(rows[index].selectedWords, rows[next].selectedWords));
      }
    }
    const [profileId, scenarioId] = key.split(":");
    return {
      profileId,
      scenarioId,
      seedCount: rows.length,
      averageWordOverlapRate: roundOne(average(overlaps)),
      maxWordOverlapRate: overlaps.length ? Math.max(...overlaps) : null,
      minWordOverlapRate: overlaps.length ? Math.min(...overlaps) : null,
      poorSeedVariety: overlaps.some((rate) => Number(rate) >= 0.9),
    };
  });
}

function buildExposureAudits() {
  const singleForm = buildSpellingBeeExposurePlan({
    classIds: ["form-a"],
    pupilIdsByClassId: new Map([["form-a", ["pupil-1", "pupil-2"]]]),
  });
  const overlappingForms = buildSpellingBeeExposurePlan({
    classIds: ["form-a", "form-b", "form-c"],
    pupilIdsByClassId: new Map([
      ["form-a", ["pupil-1", "pupil-2"]],
      ["form-b", ["pupil-2", "pupil-3"]],
      ["form-c", ["pupil-3", "pupil-4"]],
    ]),
  });
  const noActivePupils = buildSpellingBeeExposurePlan({
    classIds: ["form-empty"],
    pupilIdsByClassId: new Map([["form-empty", []]]),
  });

  return [
    {
      id: "single_form",
      includedPupilCount: singleForm.includedPupilCount,
      skippedPupilCount: singleForm.skippedPupilCount,
      releaseClassIds: singleForm.releaseClassIds,
      skipReasons: {},
    },
    {
      id: "overlapping_forms",
      includedPupilCount: overlappingForms.includedPupilCount,
      skippedPupilCount: overlappingForms.skippedPupilCount,
      releaseClassIds: overlappingForms.releaseClassIds,
      duplicateSkipReason: SPELLING_BEE_DUPLICATE_PUPIL_SKIP_REASON,
      skipReasons: countBy(overlappingForms.skippedRows, (row) => row.skipReason),
    },
    {
      id: "no_active_pupils",
      includedPupilCount: noActivePupils.includedPupilCount,
      skippedPupilCount: noActivePupils.skippedPupilCount,
      releaseClassIds: noActivePupils.releaseClassIds,
      skipReasons: {},
    },
  ];
}

function buildTeacherCredibilitySamples(simulations = []) {
  const preferredProfiles = new Set([
    "balanced_teacher_bank",
    "long_word_heavy_bank",
    "missing_context_bank",
    "narrow_grapheme_bank",
  ]);
  return simulations
    .filter((simulation) => simulation.status === "ready" && simulation.scenarioId === "capped_20" && preferredProfiles.has(simulation.profileId))
    .flatMap((simulation) =>
      (simulation.words || [])
        .filter((word) => word.score >= 58 || word.round >= Math.floor((simulation.words || []).length * 0.7))
        .slice(0, 5)
        .map((word) => ({
          profileId: simulation.profileId,
          seed: simulation.seed,
          round: word.round,
          word: word.word,
          focus: word.focus,
          score: word.score,
          effectiveScore: word.contextualDifficulty.effectiveScore,
          sentenceAvailable: word.context.hasSentence,
          meaningAvailable: word.context.hasMeaning,
          structureScore: word.structure.structureScore,
          flags: [...new Set([...word.qualityFlags, ...word.contextualDifficulty.flags])],
        }))
    )
    .slice(0, 24);
}

function collectDecisionSignals({ bankProfiles, simulations }) {
  const targetedBankExpansion = [];
  const contextualDifficultyRollout = [];
  const ladderRedesign = [];

  for (const profile of bankProfiles) {
    if (profile.untilWrongChallengeShortfall > 0) {
      targetedBankExpansion.push({
        profileId: profile.id,
        reason: "until_wrong_challenge_shortfall",
        value: profile.untilWrongChallengeShortfall,
      });
    }
    if (profile.highTierContextCoverage.bothCoverageRate < 0.9) {
      targetedBankExpansion.push({
        profileId: profile.id,
        reason: "high_tier_context_gap",
        value: profile.highTierContextCoverage.bothCoverageRate,
      });
    }
    if (profile.dominantFocusRate >= 0.6) {
      ladderRedesign.push({
        profileId: profile.id,
        reason: "approved_bank_narrow_grapheme_pressure",
        value: profile.dominantFocusRate,
      });
    }
  }

  for (const simulation of simulations) {
    if (simulation.status !== "ready") {
      targetedBankExpansion.push({
        profileId: simulation.profileId,
        scenarioId: simulation.scenarioId,
        reason: "ladder_not_ready",
        value: simulation.error,
      });
      continue;
    }
    const metrics = simulation.metrics || {};
    if ((metrics.contextualDifficulty?.hiddenSpikeCount || 0) > 0) {
      contextualDifficultyRollout.push({
        profileId: simulation.profileId,
        scenarioId: simulation.scenarioId,
        seed: simulation.seed,
        reason: "hidden_contextual_spikes",
        value: metrics.contextualDifficulty.hiddenSpikeCount,
      });
    }
    if ((metrics.largeJumpCount || 0) > 0 || (metrics.easyAfterHardReversalCount || 0) > 0) {
      ladderRedesign.push({
        profileId: simulation.profileId,
        scenarioId: simulation.scenarioId,
        seed: simulation.seed,
        reason: "ramp_smoothness",
        value: {
          largeJumpCount: metrics.largeJumpCount,
          easyAfterHardReversalCount: metrics.easyAfterHardReversalCount,
        },
      });
    }
    if ((metrics.dominantFocusRate || 0) >= 0.5 || (metrics.adjacentFocusRepeatCount || 0) >= 4) {
      ladderRedesign.push({
        profileId: simulation.profileId,
        scenarioId: simulation.scenarioId,
        seed: simulation.seed,
        reason: "narrow_grapheme_or_adjacent_repeat_pressure",
        value: {
          dominantFocusRate: metrics.dominantFocusRate,
          adjacentFocusRepeatCount: metrics.adjacentFocusRepeatCount,
        },
      });
    }
    if ((metrics.proQuality?.lengthDrivenChallengeRate || 0) >= 0.4) {
      ladderRedesign.push({
        profileId: simulation.profileId,
        scenarioId: simulation.scenarioId,
        seed: simulation.seed,
        reason: "pro_words_mostly_length_driven",
        value: metrics.proQuality.lengthDrivenChallengeRate,
      });
    }
  }

  return {
    targetedBankExpansion,
    contextualDifficultyRollout,
    ladderRedesign,
  };
}

function buildArchitectureNotes() {
  return {
    summary: "Audit-only review of the current Spelling Bee/pro ladder selection system.",
    likelyFiles: [
      "js/spellingBeePolicy.js",
      "js/teacherView.js",
      "js/pupilView.js",
      "js/db.js",
      "supabase/migrations/20260417160000_spelling_bee_automation.sql",
      "supabase/migrations/20260419120000_spelling_bee_length_mode.sql",
      "supabase/migrations/20260505120000_spelling_bee_duplicate_exposure_guard.sql",
      "tests/spelling-bee-policy.test.mjs",
    ],
    currentUnderstanding: [
      "Bee builds one shared ladder per run from teacher-sourced approved rows.",
      "Bee/pro challenge is currently represented by upper Bee rounds and higher difficulty scores; no separate pro ladder implementation was found.",
      "Bee runtime stores spelling_bee_results and skips normal assignment attempt recording.",
      "Bee policies use the automation shell but release no-support competition assignments.",
    ],
    frozenBoundaries: [
      "No personalised selector v2 behaviour changes.",
      "No Spelling Bee runtime behaviour changes.",
      "No payload, UI, migration, support ladder, or bank expansion changes.",
      "No merge between Bee logic and personalised selector logic.",
    ],
  };
}

function buildAuditPhases() {
  return [
    "Static architecture audit",
    "Bank and ladder metrics prototype",
    "Simulation matrix across capped and until-wrong modes",
    "Teacher-credibility review pack for high-tier/pro words",
    "Decision report before any Bee behaviour change",
  ];
}

function buildSuccessCriteria() {
  return [
    "Audit output is reproducible and audit-only.",
    "Selector v2, Bee runtime, UI, payloads, migrations, support ladder logic, and bank content remain unchanged.",
    "Metrics distinguish bank coverage, contextual difficulty, and ladder algorithm risks.",
    "Teacher-facing samples show whether upper-tier words are credible, age-appropriate, and structurally challenging.",
    "Any future behaviour change is backed by a flagged audit scenario and an acceptance threshold.",
  ];
}

export function buildSpellingBeeProLadderAudit() {
  const rawProfiles = buildAuditBankProfiles();
  const bankProfiles = rawProfiles.map(summarizeBankProfile);
  const simulations = rawProfiles.flatMap((profile) =>
    AUDIT_SCENARIOS.flatMap((scenario) =>
      AUDIT_SEEDS.map((seed) => buildSimulation(profile, scenario, seed))
    )
  );
  const seedSensitivity = summarizeSeedSensitivity(simulations);
  const exposureAudits = buildExposureAudits();
  const teacherCredibilitySamples = buildTeacherCredibilitySamples(simulations);
  const decisionSignals = collectDecisionSignals({ bankProfiles, simulations });

  return {
    auditVersion: SPELLING_BEE_PRO_LADDER_AUDIT_VERSION,
    contextualDifficultyAuditVersion: SPELLING_BEE_PRO_CONTEXTUAL_AUDIT_VERSION,
    generatedAt: SPELLING_BEE_PRO_LADDER_AUDIT_NOW_ISO,
    auditOnly: true,
    runtimeMutation: false,
    architecture: buildArchitectureNotes(),
    bankProfiles,
    scenarios: AUDIT_SCENARIOS,
    seeds: AUDIT_SEEDS,
    simulations,
    seedSensitivity,
    exposureAudits,
    teacherCredibilitySamples,
    decisionSignals,
    auditPhases: buildAuditPhases(),
    successCriteria: buildSuccessCriteria(),
  };
}

function escapeCell(value = "") {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function renderBankProfiles(bankProfiles = []) {
  const lines = [
    "| profile | approved | challenge | pro | dominant focus | high-tier context | until-wrong buffer |",
    "|---|---:|---:|---:|---|---:|---:|",
  ];
  for (const profile of bankProfiles) {
    lines.push([
      escapeCell(profile.id),
      profile.approvedCount,
      profile.challengeWordCount,
      profile.proWordCount,
      `${escapeCell(profile.dominantFocus || "n/a")} (${profile.dominantFocusRate})`,
      profile.highTierContextCoverage.bothCoverageRate,
      profile.untilWrongBuffer,
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  return lines.join("\n");
}

function renderSimulationMatrix(simulations = []) {
  const lines = [
    "| profile | scenario | seed | status | rounds | max jump | dominant focus | hidden spikes | flags |",
    "|---|---|---|---|---:|---:|---|---:|---|",
  ];
  for (const simulation of simulations.filter((item) => item.seed === AUDIT_SEEDS[0])) {
    const metrics = simulation.metrics || {};
    lines.push([
      escapeCell(simulation.profileId),
      escapeCell(simulation.scenarioId),
      escapeCell(simulation.seed),
      escapeCell(simulation.status),
      metrics.roundCount ?? 0,
      metrics.maxPositiveJump ?? 0,
      metrics.dominantFocus ? `${metrics.dominantFocus} (${metrics.dominantFocusRate})` : "n/a",
      metrics.contextualDifficulty?.hiddenSpikeCount ?? 0,
      (simulation.decisionFlags || []).join(", ") || "none",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  return lines.join("\n");
}

function renderTeacherCredibilitySamples(samples = []) {
  const lines = [
    "| profile | round | word | focus | score | effective | context | flags |",
    "|---|---:|---|---|---:|---:|---|---|",
  ];
  for (const sample of samples) {
    lines.push([
      escapeCell(sample.profileId),
      sample.round,
      escapeCell(sample.word),
      escapeCell(sample.focus),
      sample.score,
      sample.effectiveScore,
      sample.sentenceAvailable && sample.meaningAvailable ? "sentence+meaning" : "gap",
      escapeCell((sample.flags || []).join(", ") || "none"),
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  return lines.join("\n");
}

function renderDecisionSignals(decisionSignals = {}) {
  return [
    `- Targeted bank expansion signals: ${(decisionSignals.targetedBankExpansion || []).length}`,
    `- Contextual difficulty rollout signals: ${(decisionSignals.contextualDifficultyRollout || []).length}`,
    `- Ladder redesign signals: ${(decisionSignals.ladderRedesign || []).length}`,
  ].join("\n");
}

function compactSimulationForJson(simulation = {}) {
  const metrics = simulation.metrics || null;
  return {
    id: simulation.id,
    profileId: simulation.profileId,
    scenarioId: simulation.scenarioId,
    seed: simulation.seed,
    status: simulation.status,
    required: simulation.required,
    available: simulation.available,
    lengthMode: simulation.lengthMode,
    error: simulation.error,
    selectedWords: simulation.selectedWords || [],
    selectedFocuses: simulation.selectedFocuses || [],
    decisionFlags: simulation.decisionFlags || [],
    metrics: metrics
      ? {
        roundCount: metrics.roundCount,
        maxPositiveJump: metrics.maxPositiveJump,
        maxDrop: metrics.maxDrop,
        averageAbsJump: metrics.averageAbsJump,
        largeJumpCount: metrics.largeJumpCount,
        monotonicityBreakCount: metrics.monotonicityBreakCount,
        easyAfterHardReversalCount: metrics.easyAfterHardReversalCount,
        dominantFocus: metrics.dominantFocus,
        dominantFocusRate: metrics.dominantFocusRate,
        adjacentFocusRepeatCount: metrics.adjacentFocusRepeatCount,
        duplicateWordCount: metrics.duplicateWordCount,
        contextCoverage: metrics.contextCoverage,
        contextualDifficulty: metrics.contextualDifficulty,
        proQuality: metrics.proQuality,
      }
      : null,
  };
}

function buildRenderJsonPayload(report = {}) {
  return {
    auditVersion: report.auditVersion,
    contextualDifficultyAuditVersion: report.contextualDifficultyAuditVersion,
    generatedAt: report.generatedAt,
    auditOnly: report.auditOnly,
    runtimeMutation: report.runtimeMutation,
    architecture: report.architecture,
    bankProfiles: report.bankProfiles,
    scenarios: report.scenarios,
    seeds: report.seeds,
    simulations: (report.simulations || []).map(compactSimulationForJson),
    seedSensitivity: report.seedSensitivity,
    exposureAudits: report.exposureAudits,
    teacherCredibilitySamples: report.teacherCredibilitySamples,
    decisionSignals: report.decisionSignals,
    auditPhases: report.auditPhases,
    successCriteria: report.successCriteria,
  };
}

export function renderSpellingBeeProLadderAudit(report = buildSpellingBeeProLadderAudit()) {
  return [
    "# Spelling Bee / Pro Ladder Audit",
    "",
    `Audit version: ${report.auditVersion}`,
    `Generated at: ${report.generatedAt}`,
    `Audit only: ${report.auditOnly ? "yes" : "no"}`,
    "",
    "## Architecture",
    report.architecture.currentUnderstanding.map((item) => `- ${item}`).join("\n"),
    "",
    "## Frozen Boundaries",
    report.architecture.frozenBoundaries.map((item) => `- ${item}`).join("\n"),
    "",
    "## Bank Profiles",
    renderBankProfiles(report.bankProfiles),
    "",
    "## Simulation Matrix",
    renderSimulationMatrix(report.simulations),
    "",
    "## Teacher Credibility Samples",
    renderTeacherCredibilitySamples(report.teacherCredibilitySamples),
    "",
    "## Teacher Review Prompts",
    TEACHER_REVIEW_PROMPTS.map((prompt) => `- ${prompt}`).join("\n"),
    "",
    "## Decision Signals",
    renderDecisionSignals(report.decisionSignals),
    "",
    "## Audit Phases",
    report.auditPhases.map((phase, index) => `${index + 1}. ${phase}`).join("\n"),
    "",
    "## Success Criteria",
    report.successCriteria.map((criterion) => `- ${criterion}`).join("\n"),
    "",
    `SPELLING_BEE_PRO_LADDER_AUDIT_JSON ${JSON.stringify(buildRenderJsonPayload(report))}`,
  ].join("\n");
}
