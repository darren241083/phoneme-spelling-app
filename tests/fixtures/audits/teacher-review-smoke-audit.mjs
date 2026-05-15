import { loadBrowserModule } from "../../load-browser-module.mjs";

const {
  buildAutoAssignmentComposition,
  buildGeneratedAssignmentPlan,
} = await loadBrowserModule("../../../js/assignmentEngine.js", import.meta.url);

export const TEACHER_REVIEW_SMOKE_AUDIT_VERSION = "teacher_review_smoke_audit_v1";
export const TEACHER_REVIEW_AUDIT_NOW_ISO = "2026-05-14T12:00:00.000Z";
export const TEACHER_REVIEW_ASSIGNMENT_LENGTH = 10;
export const REQUIRED_TEACHER_REVIEW_SCENARIOS = [
  "needs_support_thin_target_coverage",
  "needs_support_stronger_target_coverage",
  "core_developing",
  "secure_expected",
  "early_stretch",
  "repeated_assignment_cycles",
];

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const WORD_TABLE_HEADER = "| # | word | role | focus | question/support | why selected | history flags |";
const WORD_TABLE_DIVIDER = "|---:|---|---|---|---|---|---|";
const TEACHER_REVIEW_PROMPTS = [
  "Would I have chosen these?",
  "Is repetition useful or annoying?",
  "Is review purposeful?",
  "Is stretch credible?",
  "Does the assignment feel human-selected?",
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

function roundPercent(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : "n/a";
}

function bandForScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "unknown";
  if (value <= 35) return "easier";
  if (value <= 55) return "core";
  if (value <= 70) return "stretch";
  return "challenge";
}

function auditWordRow({
  id,
  word,
  focus,
  segments,
  score,
  source = "wordloom_core",
  sentence = null,
  meaning = null,
} = {}) {
  const cleanWord = normalizeWord(word);
  const cleanFocus = normalizeToken(focus);
  const difficultyBand = bandForScore(score);
  const choice = {
    source,
    focus_graphemes: [cleanFocus],
    selection_suitability: "standard",
    suitability_status: "suitable",
    approval_status: "approved",
    is_active: true,
    difficulty: {
      coreScore: score,
      score,
      band: difficultyBand,
      coreBand: difficultyBand,
    },
  };

  if (source === "wordloom_core") {
    choice.origin_word_source = "wordloom_core";
    choice.origin_bank_word_id = `teacher-review-core-${id}`;
    choice.primary_focus_grapheme = cleanFocus;
    choice.focus_target_links = [{ focus_grapheme: cleanFocus, target_role: "primary" }];
    choice.context_support = {
      sentence: sentence || `${cleanWord} appears in a sentence.`,
      sentence_status: "approved",
      meaning: meaning || `${cleanWord} meaning.`,
      meaning_status: "approved",
      meaning_enabled: true,
    };
  }

  return {
    id,
    word: cleanWord,
    sentence: sentence || `${cleanWord} appears in a sentence.`,
    segments,
    choice,
  };
}

function buildRowsForFocus(focus, entries, defaults = {}) {
  return entries.map(([word, score, segments, extra = {}], index) =>
    auditWordRow({
      id: `${focus}-${index + 1}`,
      word,
      focus,
      score,
      segments,
      ...defaults,
      ...extra,
    })
  );
}

function buildTeacherAuditBankRows() {
  return [
    ...buildRowsForFocus("ai", [
      ["rain", 24, ["r", "ai", "n"]],
      ["train", 26, ["t", "r", "ai", "n"]],
      ["paint", 28, ["p", "ai", "n", "t"]],
      ["snail", 30, ["s", "n", "ai", "l"]],
      ["brain", 32, ["b", "r", "ai", "n"]],
      ["chain", 34, ["ch", "ai", "n"]],
      ["plain", 36, ["p", "l", "ai", "n"]],
      ["sail", 38, ["s", "ai", "l"]],
    ]),
    ...buildRowsForFocus("ee", [
      ["seed", 24, ["s", "ee", "d"]],
      ["green", 26, ["g", "r", "ee", "n"]],
      ["sleep", 28, ["s", "l", "ee", "p"]],
      ["queen", 30, ["qu", "ee", "n"]],
      ["tree", 32, ["t", "r", "ee"]],
      ["sheep", 34, ["sh", "ee", "p"]],
    ]),
    ...buildRowsForFocus("ow", [
      ["snow", 28, ["s", "n", "ow"]],
      ["crow", 30, ["c", "r", "ow"]],
      ["grow", 32, ["g", "r", "ow"]],
      ["yellow", 34, ["y", "e", "ll", "ow"]],
    ], { source: "teacher" }),
    ...buildRowsForFocus("oa", [
      ["boat", 26, ["b", "oa", "t"]],
      ["coat", 28, ["c", "oa", "t"]],
      ["road", 30, ["r", "oa", "d"]],
      ["float", 32, ["f", "l", "oa", "t"]],
      ["soap", 34, ["s", "oa", "p"]],
    ]),
    ...buildRowsForFocus("igh", [
      ["light", 32, ["l", "igh", "t"]],
      ["night", 34, ["n", "igh", "t"]],
      ["bright", 36, ["b", "r", "igh", "t"]],
      ["flight", 38, ["f", "l", "igh", "t"]],
    ]),
    ...buildRowsForFocus("ph", [
      ["phone", 30, ["ph", "o", "n", "e"]],
      ["photo", 32, ["ph", "o", "t", "o"]],
    ]),
    ...buildRowsForFocus("sh", [
      ["shell", 34, ["sh", "e", "ll"]],
      ["shop", 36, ["sh", "o", "p"]],
      ["shape", 40, ["sh", "a", "p", "e"]],
      ["wish", 44, ["w", "i", "sh"]],
      ["shadow", 48, ["sh", "a", "d", "ow"]],
      ["shower", 52, ["sh", "ow", "er"]],
    ]),
    ...buildRowsForFocus("th", [
      ["three", 44, ["th", "r", "ee"]],
      ["thin", 46, ["th", "i", "n"]],
      ["path", 48, ["p", "a", "th"]],
      ["think", 50, ["th", "i", "n", "k"]],
    ]),
    ...buildRowsForFocus("or", [
      ["storm", 58, ["s", "t", "or", "m"]],
      ["short", 60, ["sh", "or", "t"]],
      ["north", 62, ["n", "or", "th"]],
      ["thorn", 64, ["th", "or", "n"]],
    ]),
    ...buildRowsForFocus("tion", [
      ["action", 44, ["a", "c", "tion"]],
      ["motion", 46, ["m", "o", "tion"]],
      ["station", 48, ["s", "t", "a", "tion"]],
      ["fiction", 50, ["f", "i", "c", "tion"]],
      ["mention", 54, ["m", "e", "n", "tion"]],
      ["question", 58, ["qu", "e", "s", "tion"]],
    ]),
    ...buildRowsForFocus("dge", [
      ["bridge", 56, ["b", "r", "i", "dge"]],
      ["badge", 58, ["b", "a", "dge"]],
      ["edge", 60, ["e", "dge"]],
      ["dodge", 62, ["d", "o", "dge"]],
    ]),
    ...buildRowsForFocus("ie", [
      ["field", 56, ["f", "ie", "l", "d"]],
      ["brief", 60, ["b", "r", "ie", "f"]],
      ["shield", 62, ["sh", "ie", "l", "d"]],
      ["chief", 64, ["ch", "ie", "f"]],
      ["belief", 66, ["b", "e", "l", "ie", "f"]],
      ["achieve", 72, ["a", "ch", "ie", "v", "e"]],
    ]),
    ...buildRowsForFocus("ci", [
      ["citrus", 62, ["ci", "t", "r", "u", "s"]],
      ["special", 66, ["s", "pe", "ci", "al"]],
      ["circle", 70, ["ci", "r", "c", "le"]],
      ["cinema", 74, ["ci", "n", "e", "m", "a"]],
    ]),
    ...buildRowsForFocus("ure", [
      ["pure", 64, ["p", "ure"]],
      ["cure", 66, ["c", "ure"]],
      ["future", 70, ["f", "u", "t", "ure"]],
      ["picture", 72, ["p", "i", "c", "t", "ure"]],
    ]),
  ];
}

const AUDIT_BANK_ROWS = buildTeacherAuditBankRows();
const WORD_META_BY_WORD = new Map(
  AUDIT_BANK_ROWS.map((row) => [normalizeWord(row.word), {
    segments: row.segments,
    focus: row.choice?.focus_graphemes?.[0] || "",
  }])
);

function makeEvidenceRow({
  target,
  total,
  correct,
  accuracy,
  firstTrySuccessRate,
  securityBand,
  recentIncorrectCount = 0,
  repeatedFailure = false,
  teacherRead = "",
} = {}) {
  const numericTotal = Number(total || 0);
  const numericAccuracy = Number(accuracy);
  const derivedCorrect = Number.isFinite(Number(correct))
    ? Number(correct)
    : Math.round(numericTotal * (Number.isFinite(numericAccuracy) ? numericAccuracy : 0));

  return {
    target,
    total: numericTotal,
    correct: derivedCorrect,
    incorrect: Math.max(0, numericTotal - derivedCorrect),
    accuracy: Number.isFinite(numericAccuracy) ? numericAccuracy : (numericTotal ? derivedCorrect / numericTotal : 0),
    firstTrySuccessRate: Number(firstTrySuccessRate ?? accuracy ?? 0),
    securityBand,
    recentIncorrectCount,
    repeatedFailure,
    teacherRead,
  };
}

function makeProfile({
  band,
  concernRows = [],
  secureRows = [],
  developingRows = [],
  confusionByTarget = new Map(),
} = {}) {
  return {
    totalEvidence: concernRows.length + secureRows.length + developingRows.length,
    graphemeRows: [...concernRows, ...secureRows, ...developingRows],
    concernRows,
    secureRows,
    developingRows,
    confusionByTarget,
    placementMeta: {
      targetChallengeLevel: band,
      baselinePlacement: band,
      headlinePlacement: band,
      confidence: "teacher_review_fixture",
    },
  };
}

function makeAttempt({
  pupilId,
  word,
  correct = true,
  attemptNumber = 1,
  createdAt,
  typed = "",
} = {}) {
  const cleanWord = normalizeWord(word);
  const meta = WORD_META_BY_WORD.get(cleanWord) || {};
  return {
    pupil_id: pupilId,
    assignment_id: `teacher-review-history-${pupilId}`,
    test_word_id: `history-${cleanWord}`,
    assignment_target_id: null,
    mode: "no_support_assessment",
    attempt_source: "auto_assigned",
    correct,
    attempt_number: attemptNumber,
    created_at: createdAt || TEACHER_REVIEW_AUDIT_NOW_ISO,
    focus_grapheme: meta.focus || "",
    pattern_type: null,
    word_text: cleanWord,
    typed: typed || (correct ? cleanWord : "miss"),
    target_graphemes: meta.segments || [],
  };
}

function makeScenarioDefinitions() {
  const thinSupportProfile = makeProfile({
    band: "needs_support",
    concernRows: [
      makeEvidenceRow({
        target: "ph",
        total: 4,
        correct: 1,
        accuracy: 0.25,
        firstTrySuccessRate: 0.25,
        securityBand: "insecure",
        recentIncorrectCount: 2,
        repeatedFailure: true,
        teacherRead: "Clear ph weakness, with f/ph confusion and very little secure target evidence.",
      }),
    ],
    secureRows: [
      makeEvidenceRow({ target: "ai", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Reliable safe review family." }),
      makeEvidenceRow({ target: "ee", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Reliable safe review family." }),
      makeEvidenceRow({ target: "ow", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Teacher-bank review words available." }),
    ],
    developingRows: [
      makeEvidenceRow({ target: "or", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Possible consolidation once ph pressure is controlled." }),
    ],
    confusionByTarget: new Map([[
      "ph",
      { expected: "ph", actual: "f", attemptCount: 2, substitutionCount: 2 },
    ]]),
  });

  return [
    {
      id: "needs_support_thin_target_coverage",
      label: "Needs support with thin target coverage",
      pupilName: "Mina",
      pupilId: "audit-teacher-needs-support-thin",
      primaryFocus: "ph",
      supportPreset: "balanced",
      profile: thinSupportProfile,
      profileSummary: "Needs substantial support. The target is clear, but the approved bank only has two ph words, so the assignment must lean on safe review.",
      initialAttempts: [
        makeAttempt({ pupilId: "audit-teacher-needs-support-thin", word: "phone", correct: false, attemptNumber: 2, createdAt: "2026-05-10T09:00:00.000Z", typed: "fone" }),
      ],
    },
    {
      id: "needs_support_stronger_target_coverage",
      label: "Needs support with stronger target coverage",
      pupilName: "Arun",
      pupilId: "audit-teacher-needs-support-strong",
      primaryFocus: "ai",
      supportPreset: "balanced",
      profileSummary: "Needs support, but there is enough ai coverage to see whether the selector keeps the assignment coherent around the target.",
      profile: makeProfile({
        band: "needs_support",
        concernRows: [
          makeEvidenceRow({
            target: "ai",
            total: 5,
            correct: 2,
            accuracy: 0.4,
            firstTrySuccessRate: 0.4,
            securityBand: "insecure",
            recentIncorrectCount: 2,
            repeatedFailure: true,
            teacherRead: "Current target is weak but has enough usable words for a real target run.",
          }),
        ],
        secureRows: [
          makeEvidenceRow({ target: "ee", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Good independent review base." }),
          makeEvidenceRow({ target: "oa", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Good independent review base." }),
        ],
        developingRows: [
          makeEvidenceRow({ target: "sh", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Potential soft stretch or consolidation." }),
        ],
      }),
      initialAttempts: [
        makeAttempt({ pupilId: "audit-teacher-needs-support-strong", word: "train", correct: false, attemptNumber: 2, createdAt: "2026-05-11T09:00:00.000Z", typed: "trane" }),
        makeAttempt({ pupilId: "audit-teacher-needs-support-strong", word: "seed", correct: true, attemptNumber: 1, createdAt: "2026-05-12T09:00:00.000Z" }),
      ],
    },
    {
      id: "core_developing",
      label: "Core developing",
      pupilName: "Jo",
      pupilId: "audit-teacher-core-developing",
      primaryFocus: "sh",
      supportPreset: "balanced",
      profileSummary: "A core learner with a live sh target and related nearly-secure evidence that should make review and stretch feel purposeful.",
      profile: makeProfile({
        band: "core_developing",
        concernRows: [
          makeEvidenceRow({ target: "sh", total: 4, correct: 2, accuracy: 0.5, firstTrySuccessRate: 0.5, securityBand: "nearly_secure", teacherRead: "Target is emerging but still benefits from structure." }),
        ],
        secureRows: [
          makeEvidenceRow({ target: "ai", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Stable review material." }),
          makeEvidenceRow({ target: "ow", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Stable review material." }),
        ],
        developingRows: [
          makeEvidenceRow({ target: "th", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Credible nearby stretch." }),
          makeEvidenceRow({ target: "or", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Additional consolidation evidence." }),
        ],
      }),
      initialAttempts: [
        makeAttempt({ pupilId: "audit-teacher-core-developing", word: "shell", correct: true, attemptNumber: 1, createdAt: "2026-05-13T09:00:00.000Z" }),
      ],
    },
    {
      id: "secure_expected",
      label: "Secure expected",
      pupilName: "Leah",
      pupilId: "audit-teacher-secure-expected",
      primaryFocus: "tion",
      supportPreset: "balanced",
      profileSummary: "A generally secure pupil whose assignment should avoid feeling remedial while still consolidating live evidence.",
      profile: makeProfile({
        band: "secure_expected",
        concernRows: [
          makeEvidenceRow({ target: "tion", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Good target for controlled challenge." }),
        ],
        secureRows: [
          makeEvidenceRow({ target: "ai", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Secure review evidence." }),
          makeEvidenceRow({ target: "ee", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Secure review evidence." }),
          makeEvidenceRow({ target: "oa", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Secure review evidence." }),
        ],
        developingRows: [
          makeEvidenceRow({ target: "dge", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Useful consolidation challenge." }),
          makeEvidenceRow({ target: "or", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Useful consolidation challenge." }),
        ],
      }),
      initialAttempts: [
        makeAttempt({ pupilId: "audit-teacher-secure-expected", word: "motion", correct: false, attemptNumber: 2, createdAt: "2026-04-20T09:00:00.000Z", typed: "moshun" }),
      ],
    },
    {
      id: "early_stretch",
      label: "Early stretch",
      pupilName: "Theo",
      pupilId: "audit-teacher-early-stretch",
      primaryFocus: "ie",
      supportPreset: "balanced",
      profileSummary: "A high-attaining pupil where stretch should be credible and still tied to evidence, not just hard for its own sake.",
      profile: makeProfile({
        band: "early_stretch",
        concernRows: [
          makeEvidenceRow({ target: "ie", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Ready for harder ie words but not fully automatic." }),
        ],
        secureRows: [
          makeEvidenceRow({ target: "ai", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Secure review reserve." }),
          makeEvidenceRow({ target: "ee", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Secure review reserve." }),
          makeEvidenceRow({ target: "oa", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Secure review reserve." }),
          makeEvidenceRow({ target: "igh", total: 4, correct: 4, accuracy: 1, firstTrySuccessRate: 1, securityBand: "secure", teacherRead: "Secure review reserve." }),
        ],
        developingRows: [
          makeEvidenceRow({ target: "ci", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Credible stretch family." }),
          makeEvidenceRow({ target: "ure", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Credible stretch family." }),
          makeEvidenceRow({ target: "dge", total: 3, correct: 2, accuracy: 0.67, firstTrySuccessRate: 0.67, securityBand: "nearly_secure", teacherRead: "Credible stretch family." }),
        ],
      }),
      initialAttempts: [
        makeAttempt({ pupilId: "audit-teacher-early-stretch", word: "chief", correct: true, attemptNumber: 1, createdAt: "2026-05-13T09:00:00.000Z" }),
      ],
    },
    {
      id: "repeated_assignment_cycles",
      label: "Repeated assignment cycles",
      pupilName: "Mina",
      pupilId: "audit-teacher-repeat-cycles",
      primaryFocus: "ph",
      supportPreset: "balanced",
      profile: thinSupportProfile,
      profileSummary: "The same needs-support pupil is generated three times so a teacher can judge whether repeated words feel useful or annoying.",
      initialAttempts: [
        makeAttempt({ pupilId: "audit-teacher-repeat-cycles", word: "phone", correct: false, attemptNumber: 2, createdAt: "2026-05-10T09:00:00.000Z", typed: "fone" }),
      ],
      cycleCount: 3,
    },
  ];
}

function buildPlanForScenario(scenario, attempts = []) {
  return buildGeneratedAssignmentPlan({
    pupilIds: [scenario.pupilId],
    teacherTests: [{
      id: "teacher-review-smoke-audit-bank",
      title: "Teacher Review Smoke Audit Bank",
      test_words: AUDIT_BANK_ROWS,
    }],
    attempts,
    totalWords: TEACHER_REVIEW_ASSIGNMENT_LENGTH,
    currentProfiles: {
      [scenario.pupilId]: scenario.profile,
    },
    policy: {
      assignment_length: TEACHER_REVIEW_ASSIGNMENT_LENGTH,
      support_preset: scenario.supportPreset || "balanced",
      allow_starter_fallback: false,
    },
  });
}

function buildUsageStats(attempts = []) {
  const usage = new Map();
  const events = [];

  for (const attempt of attempts) {
    const word = normalizeWord(attempt?.word_text || attempt?.word || "");
    if (!word) continue;
    const seenAt = new Date(attempt?.created_at || 0).getTime();
    const current = usage.get(word) || {
      word,
      count: 0,
      correctCount: 0,
      incorrectCount: 0,
      lastSeenAt: 0,
      lastCorrectAt: 0,
      lastIncorrectAt: 0,
      latestCorrect: null,
      latestAttemptNumber: 0,
      recentlySeen: false,
      recentlySecure: false,
      reviewDue: false,
    };
    const correct = attempt?.correct === true;
    const attemptNumber = Math.max(1, Number(attempt?.attempt_number || 1));
    current.count += 1;
    if (correct) {
      current.correctCount += 1;
      current.lastCorrectAt = Math.max(current.lastCorrectAt, seenAt);
    } else {
      current.incorrectCount += 1;
      current.lastIncorrectAt = Math.max(current.lastIncorrectAt, seenAt);
    }
    if (seenAt >= current.lastSeenAt) {
      current.lastSeenAt = seenAt;
      current.latestCorrect = correct;
      current.latestAttemptNumber = attemptNumber;
    }
    usage.set(word, current);
    events.push({ word, seenAt });
  }

  const latestEvidenceAt = events.reduce((latest, event) => Math.max(latest, event.seenAt), 0);
  const recentCutoff = latestEvidenceAt > 0 ? latestEvidenceAt - RECENT_WINDOW_MS : 0;

  for (const current of usage.values()) {
    current.recentlySeen = current.lastSeenAt > 0 && current.lastSeenAt >= recentCutoff;
    current.recentlySecure = current.recentlySeen
      && current.latestCorrect === true
      && current.latestAttemptNumber <= 1
      && current.incorrectCount === 0;
    current.reviewDue = current.count > 0 && current.lastSeenAt > 0 && !current.recentlySeen;
  }

  return usage;
}

function getDifficultyScore(wordSpec = {}) {
  return Number(
    wordSpec?.difficulty?.coreScore
    ?? wordSpec?.difficulty?.score
    ?? wordSpec?.difficulty?.adjustedScore
    ?? 0
  );
}

function getProfileRowsByTarget(scenario, key) {
  return new Map((scenario.profile?.[key] || []).map((row) => [normalizeToken(row?.target), row]));
}

function classifyReason(wordSpec, scenario, usage = null) {
  const role = normalizeToken(wordSpec.assignmentRole || "");
  const focus = normalizeToken(wordSpec.focusGrapheme || "");
  const primary = normalizeToken(scenario.primaryFocus || "");
  const secureRows = getProfileRowsByTarget(scenario, "secureRows");
  const developingRows = getProfileRowsByTarget(scenario, "developingRows");
  const concernRows = getProfileRowsByTarget(scenario, "concernRows");
  const rawParts = [
    wordSpec.targetReason ? `target=${wordSpec.targetReason}` : "",
    wordSpec.supportLadderReason ? `support=${wordSpec.supportLadderReason}` : "",
  ].filter(Boolean);
  const rawSuffix = rawParts.length ? ` (raw: ${rawParts.join("; ")})` : "";

  if (role === "review") {
    if (usage?.incorrectCount > 0 || usage?.reviewDue) {
      return `Protected review of a previously missed or due word${rawSuffix}`;
    }
    if (developingRows.has(focus) || concernRows.has(focus)) {
      return `Purposeful review for a developing grapheme from the evidence${rawSuffix}`;
    }
    if (secureRows.has(focus)) {
      return `Safe review from a secure grapheme so fluency is maintained${rawSuffix}`;
    }
    return `Safe review/fallback because target coverage is limited${rawSuffix}`;
  }

  if (role === "target") {
    if (focus === primary) {
      return `Current target from baseline evidence${rawSuffix}`;
    }
    if (developingRows.has(focus) || concernRows.has(focus)) {
      return `Secondary weak target used to keep the assignment coherent${rawSuffix}`;
    }
    return `Consolidation target used after primary coverage was exhausted${rawSuffix}`;
  }

  if (role === "stretch") {
    if (focus === primary) {
      return `Harder word on the current target, used as a stretch probe${rawSuffix}`;
    }
    if (developingRows.has(focus) || concernRows.has(focus)) {
      return `Stretch probe from a developing grapheme already in evidence${rawSuffix}`;
    }
    if (secureRows.has(focus)) {
      return `Soft consolidation stretch from a secure grapheme${rawSuffix}`;
    }
    return `Availability-driven stretch probe; teacher should review fit carefully${rawSuffix}`;
  }

  return `Selector chose this item from available evidence${rawSuffix}`;
}

function historyFlagsForWord(wordSpec, usage = null) {
  const flags = [];
  if (usage?.count > 0) flags.push("repeated");
  if (usage?.incorrectCount > 0 || usage?.reviewDue) flags.push("protected");
  if (usage?.recentlySeen) flags.push("recent");
  if (usage?.recentlySecure) flags.push("recently secure");
  return flags.length ? flags.join(", ") : "new";
}

function summarizeWord(wordSpec, scenario, usageByWord, position) {
  const word = normalizeWord(wordSpec.word || "");
  const usage = usageByWord.get(word) || null;
  return {
    position,
    word,
    role: normalizeToken(wordSpec.assignmentRole || "unknown"),
    focus: normalizeToken(wordSpec.focusGrapheme || ""),
    questionSupport: `${wordSpec.questionType || "unknown"}/${wordSpec.assignmentSupport || "unknown"}`,
    reason: classifyReason(wordSpec, scenario, usage),
    historyFlags: historyFlagsForWord(wordSpec, usage),
    difficultyScore: getDifficultyScore(wordSpec),
  };
}

function buildSingleScenarioReport(scenario) {
  const attempts = [...(scenario.initialAttempts || [])];
  const plan = buildPlanForScenario(scenario, attempts);
  const usageByWord = buildUsageStats(attempts);
  const pupilPlan = plan.pupilPlans?.[0] || {};
  const words = (pupilPlan.words || []).map((wordSpec, index) =>
    summarizeWord(wordSpec, scenario, usageByWord, index + 1)
  );

  return {
    id: scenario.id,
    label: scenario.label,
    pupilName: scenario.pupilName,
    pupilId: scenario.pupilId,
    primaryFocus: scenario.primaryFocus,
    placementBand: scenario.profile?.placementMeta?.targetChallengeLevel || "unknown",
    profileSummary: scenario.profileSummary,
    evidenceRows: scenario.profile?.graphemeRows || [],
    expectedComposition: buildAutoAssignmentComposition(TEACHER_REVIEW_ASSIGNMENT_LENGTH),
    clearFocusGrapheme: plan.clearFocusGrapheme || "",
    coverageWarnings: plan.coverageWarnings || pupilPlan.coverageWarnings || [],
    planError: plan.error || "",
    words,
  };
}

function makeCycleAttempt({ scenario, wordSpec, cycle, index }) {
  return makeAttempt({
    pupilId: scenario.pupilId,
    word: wordSpec.word,
    correct: true,
    attemptNumber: 1,
    createdAt: new Date(Date.UTC(2026, 4, 14 + cycle, 9, 0, index)).toISOString(),
  });
}

function buildRepeatedScenarioReport(scenario) {
  const attempts = [...(scenario.initialAttempts || [])];
  const cycles = [];
  let previousWords = new Set();

  for (let cycle = 1; cycle <= Math.max(1, Number(scenario.cycleCount || 3)); cycle += 1) {
    const plan = buildPlanForScenario(scenario, attempts);
    const usageByWord = buildUsageStats(attempts);
    const pupilPlan = plan.pupilPlans?.[0] || {};
    const words = (pupilPlan.words || []).map((wordSpec, index) =>
      summarizeWord(wordSpec, scenario, usageByWord, index + 1)
    );
    const selectedWords = new Set(words.map((item) => item.word));
    const overlapWords = [...selectedWords].filter((word) => previousWords.has(word)).sort();

    cycles.push({
      cycle,
      planError: plan.error || "",
      words,
      overlapWords,
      overlapCount: overlapWords.length,
    });

    for (const [index, wordSpec] of (pupilPlan.words || []).entries()) {
      attempts.push(makeCycleAttempt({ scenario, wordSpec, cycle, index }));
    }
    previousWords = selectedWords;
  }

  return {
    id: scenario.id,
    label: scenario.label,
    pupilName: scenario.pupilName,
    pupilId: scenario.pupilId,
    primaryFocus: scenario.primaryFocus,
    placementBand: scenario.profile?.placementMeta?.targetChallengeLevel || "unknown",
    profileSummary: scenario.profileSummary,
    evidenceRows: scenario.profile?.graphemeRows || [],
    expectedComposition: buildAutoAssignmentComposition(TEACHER_REVIEW_ASSIGNMENT_LENGTH),
    cycles,
  };
}

export function buildTeacherReviewSmokeAudit() {
  const scenarios = makeScenarioDefinitions();
  const repeatedScenario = scenarios.find((scenario) => scenario.id === "repeated_assignment_cycles");
  return {
    auditVersion: TEACHER_REVIEW_SMOKE_AUDIT_VERSION,
    generatedAt: TEACHER_REVIEW_AUDIT_NOW_ISO,
    assignmentLength: TEACHER_REVIEW_ASSIGNMENT_LENGTH,
    expectedComposition: buildAutoAssignmentComposition(TEACHER_REVIEW_ASSIGNMENT_LENGTH),
    scenarios: scenarios
      .filter((scenario) => scenario.id !== "repeated_assignment_cycles")
      .map((scenario) => buildSingleScenarioReport(scenario)),
    repeatedScenario: buildRepeatedScenarioReport(repeatedScenario),
  };
}

function escapeCell(value = "") {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function renderEvidenceRows(rows = []) {
  const lines = [
    "| grapheme | evidence | band | teacher read |",
    "|---|---|---|---|",
  ];
  for (const row of rows) {
    const evidence = `${row.correct}/${row.total} correct, ${roundPercent(row.accuracy)} accuracy, ${row.recentIncorrectCount || 0} recent incorrect`;
    lines.push(`| ${escapeCell(row.target)} | ${escapeCell(evidence)} | ${escapeCell(row.securityBand || "unknown")} | ${escapeCell(row.teacherRead || "Review evidence")} |`);
  }
  return lines.join("\n");
}

function renderWordTable(words = []) {
  const lines = [WORD_TABLE_HEADER, WORD_TABLE_DIVIDER];
  for (const word of words) {
    lines.push([
      `| ${word.position}`,
      escapeCell(word.word),
      escapeCell(word.role),
      escapeCell(word.focus),
      escapeCell(word.questionSupport),
      escapeCell(word.reason),
      `${escapeCell(word.historyFlags)} |`,
    ].join(" | "));
  }
  return lines.join("\n");
}

function renderTeacherPrompts() {
  return [
    "Teacher review prompts:",
    ...TEACHER_REVIEW_PROMPTS.map((prompt) => `- ${prompt}`),
  ].join("\n");
}

function renderCoverageWarnings(warnings = []) {
  if (!warnings.length) return "Coverage notes: none.";
  return [
    "Coverage notes:",
    ...warnings.map((warning) => {
      if (warning?.type === "target_coverage_low") {
        return `- ${warning.selectedTargetCount}/${warning.requestedTargetCount} requested ${warning.focusGrapheme} target slots were filled; ${warning.fallbackCount} slots used safe fallback/review/consolidation.`;
      }
      return `- ${warning?.message || warning?.type || "Coverage warning"}`;
    }),
  ].join("\n");
}

function renderScenario(report) {
  return [
    `## Scenario: ${report.id}`,
    "",
    `Pupil profile: ${report.pupilName} (${report.pupilId})`,
    `Placement band: ${report.placementBand}`,
    `Primary focus: ${report.primaryFocus}`,
    `Profile note: ${report.profileSummary}`,
    `Expected mix: ${report.expectedComposition.review} review / ${report.expectedComposition.target} target / ${report.expectedComposition.stretch} stretch`,
    report.planError ? `Plan error: ${report.planError}` : "Plan error: none.",
    renderCoverageWarnings(report.coverageWarnings),
    "",
    "Baseline/evidence summary by grapheme:",
    renderEvidenceRows(report.evidenceRows),
    "",
    "Selected words in order:",
    renderWordTable(report.words),
    "",
    renderTeacherPrompts(),
  ].join("\n");
}

function renderRepeatedScenario(report) {
  const lines = [
    `## Scenario: ${report.id}`,
    "",
    `Pupil profile: ${report.pupilName} (${report.pupilId})`,
    `Placement band: ${report.placementBand}`,
    `Primary focus: ${report.primaryFocus}`,
    `Profile note: ${report.profileSummary}`,
    `Expected mix: ${report.expectedComposition.review} review / ${report.expectedComposition.target} target / ${report.expectedComposition.stretch} stretch`,
    "",
    "Baseline/evidence summary by grapheme:",
    renderEvidenceRows(report.evidenceRows),
    "",
    "Selected words in order:",
  ];

  for (const cycle of report.cycles) {
    lines.push("");
    lines.push(`### Cycle ${cycle.cycle}`);
    lines.push(cycle.planError ? `Plan error: ${cycle.planError}` : "Plan error: none.");
    lines.push(cycle.cycle === 1
      ? "Cycle overlap with previous: first cycle."
      : `Cycle overlap with previous: ${cycle.overlapCount} words (${cycle.overlapWords.join(", ") || "none"}).`);
    lines.push(renderWordTable(cycle.words));
  }

  lines.push("");
  lines.push(renderTeacherPrompts());
  return lines.join("\n");
}

export function renderTeacherReviewSmokeAudit(report = buildTeacherReviewSmokeAudit()) {
  return [
    "# Teacher Review Smoke Audit: Personalised Selector",
    "",
    `Audit version: ${report.auditVersion}`,
    `Generated at: ${report.generatedAt}`,
    `Assignment length: ${report.assignmentLength}`,
    `Selector behaviour: existing selector only; no Selector V2 changes.`,
    `Expected composition: ${report.expectedComposition.review} review / ${report.expectedComposition.target} target / ${report.expectedComposition.stretch} stretch`,
    "",
    ...report.scenarios.map((scenario) => renderScenario(scenario)),
    renderRepeatedScenario(report.repeatedScenario),
    "",
  ].join("\n");
}
