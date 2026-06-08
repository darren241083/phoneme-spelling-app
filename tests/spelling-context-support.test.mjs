import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildTestWordContextSnapshot,
  getSpellingContextSupport,
  getVisiblePupilMeaningSupport,
  getVisiblePupilSentenceSupport,
  hasMeaningSupport,
  hasSentenceSupport,
  isForcedSentenceWord,
  normalizeContextWord,
  supportTextLeaksTargetWord,
  validateMeaningSupportText,
} = await loadBrowserModule("../js/spellingContextSupport.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

test("normalises context words for lookup", () => {
  assert.equal(normalizeContextWord("  They’re! "), "they're");
  assert.equal(normalizeContextWord("Flower."), "flower");
});

test("detects forced sentence words including curly apostrophes", () => {
  assert.equal(isForcedSentenceWord("there"), true);
  assert.equal(isForcedSentenceWord("their"), true);
  assert.equal(isForcedSentenceWord("they’re"), true);
  assert.equal(isForcedSentenceWord("two"), true);
  assert.equal(isForcedSentenceWord("flour"), true);
  assert.equal(isForcedSentenceWord("train"), false);
});

test("accepts simple pupil-friendly meanings", () => {
  const result = validateMeaningSupportText(
    "A vehicle that travels on tracks and carries people or goods.",
    "train",
  );
  assert.equal(result.valid, true);
  assert.equal(result.reasons.length, 0);
});

test("rejects spelling-pattern meaning explanations", () => {
  assert.equal(validateMeaningSupportText("Train has the ai sound in the middle.", "train").valid, false);
  assert.equal(validateMeaningSupportText("Train uses a vowel digraph.", "train").valid, false);
  assert.equal(validateMeaningSupportText("Train is spelled t-r-a-i-n.", "train").valid, false);
  assert.equal(validateMeaningSupportText("Train is spelled t r a i n.", "train").valid, false);
});

test("rejects empty, long, markup, url and list-like meanings", () => {
  assert.equal(validateMeaningSupportText("", "train").valid, false);
  assert.equal(validateMeaningSupportText("A vehicle " + "a ".repeat(40), "train").valid, false);
  assert.equal(validateMeaningSupportText("<b>A vehicle</b> that travels on tracks.", "train").valid, false);
  assert.equal(validateMeaningSupportText("See https://example.com for meaning.", "train").valid, false);
  assert.equal(validateMeaningSupportText("- A vehicle that travels on tracks.", "train").valid, false);
});

test("rejects target word and stem leaks in meanings", () => {
  const exact = validateMeaningSupportText("A fatherly person is kind and caring.", "fatherly");
  const root = validateMeaningSupportText("Kind and caring like a father.", "fatherly");
  const edStem = validateMeaningSupportText("To paint something with colour.", "painted");
  const erStem = validateMeaningSupportText("Someone who likes to teach others.", "teacher");

  assert.equal(exact.valid, false);
  assert.equal(exact.reasons.includes("target_leak"), true);
  assert.equal(root.valid, false);
  assert.equal(root.reasons.includes("target_leak"), true);
  assert.equal(edStem.valid, false);
  assert.equal(erStem.valid, false);
  assert.equal(supportTextLeaksTargetWord("Kind and caring like a father.", "fatherly"), true);
});

test("keeps unrelated safe meanings available", () => {
  assert.equal(validateMeaningSupportText("A vehicle that travels on tracks.", "train").valid, true);
  assert.equal(validateMeaningSupportText("Kind and caring toward other people.", "fatherly").valid, true);
  assert.equal(getVisiblePupilMeaningSupport("Kind and caring toward other people.", "fatherly"), "Kind and caring toward other people.");
});

test("reads missing and empty context as safe defaults", () => {
  const context = getSpellingContextSupport(null);
  assert.equal(context.sentence, "");
  assert.equal(context.meaning, "");
  assert.equal(context.sentenceStatus, "");
  assert.equal(context.meaningStatus, "");
  assert.equal(context.explicitSentenceRequired, false);
  assert.equal(context.sentenceRequired, false);
  assert.equal(context.forcedSentence, false);
  assert.equal(context.meaningEnabled, false);
  assert.equal(hasSentenceSupport(null), false);
  assert.equal(hasMeaningSupport(null), false);
});

test("reads context from supported item shapes", () => {
  const item = {
    word: "train",
    sentence: "The train arrived at the station.",
    choice: {
      context_support: {
        meaning: "A vehicle that travels on tracks.",
        meaning_status: "teacher_edited",
      },
    },
  };
  const context = getSpellingContextSupport(item);
  assert.equal(context.sentence, "The train arrived at the station.");
  assert.equal(context.meaning, "A vehicle that travels on tracks.");
  assert.equal(context.meaningStatus, "teacher_edited");
  assert.equal(context.meaningEnabled, true);
  assert.equal(hasSentenceSupport(item), true);
  assert.equal(hasMeaningSupport(item), true);
});

test("reads sentences from runtime item wrappers", () => {
  assert.equal(getSpellingContextSupport({
    word: "train",
    choice: {
      sentence: "The train arrived at the station.",
    },
  }).sentence, "The train arrived at the station.");

  assert.equal(getSpellingContextSupport({
    word: "snail",
    test_word: {
      sentence: "The snail moved slowly across the path.",
    },
  }).sentence, "The snail moved slowly across the path.");

  assert.equal(getSpellingContextSupport({
    word: {
      word: "paint",
      sentence: "She used paint for the sky.",
    },
  }).sentence, "She used paint for the sky.");

  assert.equal(getSpellingContextSupport({
    word: "chain",
    test_word: {
      context_support: {
        sentence: "The chain rattled in the box.",
        sentence_status: "teacher_edited",
      },
    },
  }).sentence, "The chain rattled in the box.");
});

test("distinguishes explicit and forced sentence requirements", () => {
  const forcedOnly = getSpellingContextSupport({
    word: "plain",
    choice: {
      context_support: {
        sentence: "The plain shirt had no pattern.",
        sentence_status: "teacher_edited",
      },
    },
  });
  assert.equal(forcedOnly.forcedSentence, true);
  assert.equal(forcedOnly.sentenceRequired, true);
  assert.equal(forcedOnly.explicitSentenceRequired, false);

  const explicitRequired = getSpellingContextSupport({
    word: "train",
    choice: {
      context_support: {
        sentence: "The train arrived at the station.",
        sentence_required: true,
      },
    },
  });
  assert.equal(explicitRequired.forcedSentence, false);
  assert.equal(explicitRequired.sentenceRequired, true);
  assert.equal(explicitRequired.explicitSentenceRequired, true);
});

test("blocks unavailable meaning statuses", () => {
  for (const status of ["hidden", "needs_review", "ai_generated"]) {
    assert.equal(hasMeaningSupport({
      word: "train",
      choice: {
        contextSupport: {
          meaning: "Train means a vehicle that travels on tracks.",
          meaningStatus: status,
          meaningEnabled: true,
        },
      },
    }), false);
  }
});

test("baseline-like items disable meaning support", () => {
  const item = {
    word: "train",
    sentence: "The train arrived at the station.",
    choice: {
      source: "teacher",
      baseline_v1: false,
      baseline_v2: true,
      context_support: {
        meaning: "A vehicle that travels on tracks.",
        meaning_status: "teacher_edited",
        meaning_enabled: true,
      },
    },
  };
  const context = getSpellingContextSupport(item);
  assert.equal(context.baselineLike, true);
  assert.equal(context.meaningEnabled, false);
  assert.equal(context.meaning, "");
  assert.equal(hasMeaningSupport(item), false);
  assert.equal(hasSentenceSupport(item), true);
});

test("builds pupil snapshot for auto-approved context cache rows", () => {
  const snapshot = buildTestWordContextSnapshot("train", {
    id: "context-1",
    normalized_word: "train",
    display_word: "Train",
    context_key: "default",
    sentence: "The train stopped at the station.",
    meaning: "A vehicle that travels on tracks.",
    sentence_required: true,
    meaning_enabled_by_default: true,
    sentence_status: "auto_approved",
    meaning_status: "auto_approved",
    quality_flags: {
      ambiguity_kind: "homophone",
      homophone_set: ["train", "trane"],
    },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), {
    sentence: "The train stopped at the station.",
    meaning: "A vehicle that travels on tracks.",
    sentence_required: true,
    meaning_enabled: true,
    sentence_status: "auto_approved",
    meaning_status: "auto_approved",
    source_context_id: "context-1",
    context_key: "default",
    ambiguity_kind: "homophone",
    homophone_set: ["train", "trane"],
  });
});

test("treats teacher-entered cache rows as pupil-usable", () => {
  const snapshot = buildTestWordContextSnapshot("plain", {
    id: "context-teacher",
    context_key: "default",
    sentence: "The plain shirt had no pattern.",
    meaning: "Simple or not decorated.",
    meaning_enabled_by_default: true,
    sentence_status: "teacher_entered",
    meaning_status: "teacher_entered",
  });

  assert.equal(snapshot.sentence, "The plain shirt had no pattern.");
  assert.equal(snapshot.meaning, "Simple or not decorated.");
});

test("keeps ai-generated cache rows out of pupil snapshots until promoted", () => {
  assert.equal(buildTestWordContextSnapshot("train", {
    sentence: "The train stopped at the station.",
    meaning: "A vehicle that travels on tracks.",
    meaning_enabled_by_default: true,
    sentence_status: "ai_generated",
    meaning_status: "ai_generated",
  }), null);
});

test("keeps hidden and review cache rows out of pupil snapshots", () => {
  assert.equal(buildTestWordContextSnapshot("train", {
    sentence: "The train stopped at the station.",
    meaning: "A vehicle that travels on tracks.",
    meaning_enabled_by_default: true,
    sentence_status: "hidden",
    meaning_status: "needs_review",
  }), null);
});

test("excludes unsafe meanings from cache snapshots", () => {
  const snapshot = buildTestWordContextSnapshot("train", {
    sentence: "The train stopped at the station.",
    meaning: "Train has the ai sound in the middle.",
    meaning_enabled_by_default: true,
    sentence_status: "teacher_edited",
    meaning_status: "teacher_edited",
  });

  assert.equal(snapshot.sentence, "The train stopped at the station.");
  assert.equal(snapshot.meaning, "");
});

test("hides target-leaking meanings from runtime support", () => {
  const item = {
    word: "fatherly",
    choice: {
      context_support: {
        meaning: "Kind and caring like a father.",
        meaning_status: "teacher_edited",
        meaning_enabled: true,
      },
    },
  };
  const context = getSpellingContextSupport(item);
  assert.equal(context.meaning, "");
  assert.equal(context.hasMeaning, false);
  assert.equal(hasMeaningSupport(item), false);
  assert.equal(getVisiblePupilMeaningSupport("Kind and caring like a father.", "fatherly"), "");
});

test("context snapshots drop unsafe meanings but keep safe support", () => {
  const snapshot = buildTestWordContextSnapshot("fatherly", {
    sentence: "He gave kind advice before the trip.",
    meaning: "Kind and caring like a father.",
    meaning_enabled_by_default: true,
    sentence_status: "teacher_edited",
    meaning_status: "teacher_edited",
  });

  assert.equal(snapshot.sentence, "He gave kind advice before the trip.");
  assert.equal(snapshot.meaning, "");
});

test("masks exact sentence targets and hides stem-leaking sentences", () => {
  assert.equal(
    getVisiblePupilSentenceSupport("He gave fatherly advice before the trip.", "fatherly"),
    "He gave ____ advice before the trip.",
  );
  assert.equal(
    getVisiblePupilSentenceSupport("He gave father advice before the trip.", "fatherly"),
    "",
  );
});

test("returns null when no cache support is pupil-usable", () => {
  assert.equal(buildTestWordContextSnapshot("train", {
    sentence: "",
    meaning: "",
    meaning_enabled_by_default: false,
    sentence_status: "teacher_edited",
    meaning_status: "teacher_edited",
  }), null);
});

test("allows meaning snapshot when an override explicitly enables it", () => {
  const snapshot = buildTestWordContextSnapshot("train", {
    meaning: "A vehicle that travels on tracks.",
    meaning_enabled_by_default: false,
    meaning_status: "teacher_edited",
  }, {
    meaning_enabled: true,
  });

  assert.equal(snapshot.meaning, "A vehicle that travels on tracks.");
  assert.equal(snapshot.meaning_enabled, true);
});

let failures = 0;
for (const { name, fn } of TESTS) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures) {
  process.exitCode = 1;
} else {
  console.log(`all ${TESTS.length} spelling context support checks passed`);
}
