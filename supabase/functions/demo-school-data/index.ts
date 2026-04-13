import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_CLASS_PREFIX = "[Demo]";
const DEMO_TEST_PREFIX = "[Demo]";
const DEMO_PUPILS_PER_CLASS = 14;
const FEMALE_FIRST_NAMES = [
  "Amelia",
  "Mia",
  "Ivy",
  "Ava",
  "Ella",
  "Ruby",
  "Lily",
  "Grace",
  "Sofia",
  "Evie",
  "Rosie",
  "Nora",
  "Isla",
  "Chloe",
  "Poppy",
  "Layla",
  "Maya",
  "Elsie",
  "Zara",
  "Hannah",
];
const MALE_FIRST_NAMES = [
  "Noah",
  "Leo",
  "Ethan",
  "Lucas",
  "Arlo",
  "Jack",
  "Oscar",
  "Henry",
  "Freddie",
  "Theo",
  "Mason",
  "Arthur",
  "Harry",
  "Max",
  "Finn",
  "Logan",
  "Isaac",
  "Jacob",
  "Adam",
  "Daniel",
];
const DEMO_SURNAMES = [
  "Hall",
  "Price",
  "Turner",
  "Carter",
  "Wright",
  "Bennett",
  "Murphy",
  "Foster",
  "Cook",
  "Rogers",
  "Parker",
  "Bailey",
  "Reed",
  "Ward",
  "Hughes",
  "Powell",
  "Brooks",
  "Wood",
  "Kelly",
  "Long",
  "Bell",
  "Morgan",
  "Cooper",
  "Gray",
  "James",
  "Cox",
  "Russell",
  "Jenkins",
  "Butler",
  "Howard",
  "Mills",
  "Ellis",
  "Shaw",
  "Watson",
  "Patel",
];

type Action = "seed" | "clear";
type DemoSchoolRequest = {
  action?: Action | string;
  accessToken?: string | null;
};

type DemoWord = {
  word: string;
  sentence: string;
  segments: string[];
  focus: string;
  wrong: string;
};

type DemoTest = {
  key: string;
  title: string;
  questionType: string;
  words: DemoWord[];
};

type DemoClassSpec = {
  key: string;
  name: string;
  yearGroup: string;
  testKey: string;
  accuracy: number;
  firstTry: number;
  weakTargets: string[];
  interventionPupilIndexes?: number[];
  partialPupilIndex?: number | null;
  notStartedPupilIndex?: number | null;
};

const TESTS: DemoTest[] = [
  {
    key: "vowels_review",
    title: `${DEMO_TEST_PREFIX} Vowel alternatives review`,
    questionType: "focus_sound",
    words: [
      { word: "rain", sentence: "The rain tapped on the window.", segments: ["r", "ai", "n"], focus: "ai", wrong: "rayn" },
      { word: "day", sentence: "It was a bright day outside.", segments: ["d", "ay"], focus: "ay", wrong: "dai" },
      { word: "boat", sentence: "The boat drifted by the shore.", segments: ["b", "oa", "t"], focus: "oa", wrong: "bowt" },
      { word: "slow", sentence: "The slow train pulled away.", segments: ["s", "l", "ow"], focus: "ow", wrong: "sloa" },
      { word: "seed", sentence: "She planted a seed in the pot.", segments: ["s", "ee", "d"], focus: "ee", wrong: "sead" },
      { word: "beach", sentence: "We walked along the beach.", segments: ["b", "ea", "ch"], focus: "ea", wrong: "beech" },
      { word: "night", sentence: "The stars shone at night.", segments: ["n", "igh", "t"], focus: "igh", wrong: "nite" },
      { word: "light", sentence: "The light flickered softly.", segments: ["l", "igh", "t"], focus: "igh", wrong: "lite" },
    ],
  },
  {
    key: "digraph_review",
    title: `${DEMO_TEST_PREFIX} Digraph and pattern review`,
    questionType: "focus_sound",
    words: [
      { word: "chip", sentence: "He dropped the chip on the floor.", segments: ["ch", "i", "p"], focus: "ch", wrong: "ship" },
      { word: "shell", sentence: "The shell was shiny and smooth.", segments: ["sh", "e", "ll"], focus: "sh", wrong: "chell" },
      { word: "thing", sentence: "That thing belongs on the shelf.", segments: ["th", "i", "ng"], focus: "th", wrong: "ting" },
      { word: "ring", sentence: "Her ring sparkled in the sun.", segments: ["r", "i", "ng"], focus: "ng", wrong: "rink" },
      { word: "phone", sentence: "The phone buzzed on the desk.", segments: ["ph", "o", "n", "e"], focus: "ph", wrong: "fone" },
      { word: "whale", sentence: "The whale splashed in the sea.", segments: ["wh", "a-e", "l"], focus: "wh", wrong: "wale" },
      { word: "badge", sentence: "He pinned the badge to his coat.", segments: ["b", "a", "dge"], focus: "dge", wrong: "badj" },
      { word: "bridge", sentence: "They crossed the bridge together.", segments: ["b", "r", "i", "dge"], focus: "dge", wrong: "bridj" },
    ],
  },
  {
    key: "intervention_checkpoint",
    title: `${DEMO_TEST_PREFIX} Intervention checkpoint`,
    questionType: "focus_sound",
    words: [
      { word: "chain", sentence: "The chain rattled in the box.", segments: ["ch", "ai", "n"], focus: "ai", wrong: "chayn" },
      { word: "train", sentence: "The train pulled into the station.", segments: ["t", "r", "ai", "n"], focus: "ai", wrong: "trayn" },
      { word: "display", sentence: "The display was neat and bright.", segments: ["d", "i", "s", "p", "l", "ay"], focus: "ay", wrong: "displai" },
      { word: "coast", sentence: "They drove along the coast road.", segments: ["c", "oa", "s", "t"], focus: "oa", wrong: "cowst" },
      { word: "growth", sentence: "The plant showed healthy growth.", segments: ["g", "r", "ow", "th"], focus: "ow", wrong: "groath" },
      { word: "green", sentence: "The green jumper was warm.", segments: ["g", "r", "ee", "n"], focus: "ee", wrong: "grean" },
      { word: "teacher", sentence: "The teacher smiled at the class.", segments: ["t", "ea", "ch", "er"], focus: "ea", wrong: "teecher" },
      { word: "night", sentence: "They revised late into the night.", segments: ["n", "igh", "t"], focus: "igh", wrong: "nite" },
    ],
  },
];

const CLASS_SPECS: DemoClassSpec[] = [
  {
    key: "y7_maple",
    name: `${DEMO_CLASS_PREFIX} Year 7 Maple`,
    yearGroup: "Year 7",
    testKey: "vowels_review",
    accuracy: 0.72,
    firstTry: 0.46,
    weakTargets: ["ai", "oa", "ea"],
    interventionPupilIndexes: [1, 7],
    partialPupilIndex: 12,
    notStartedPupilIndex: 13,
  },
  {
    key: "y7_oak",
    name: `${DEMO_CLASS_PREFIX} Year 7 Oak`,
    yearGroup: "Year 7",
    testKey: "vowels_review",
    accuracy: 0.86,
    firstTry: 0.67,
    weakTargets: ["ow"],
    interventionPupilIndexes: [6],
    partialPupilIndex: 12,
    notStartedPupilIndex: 13,
  },
  {
    key: "y8_cedar",
    name: `${DEMO_CLASS_PREFIX} Year 8 Cedar`,
    yearGroup: "Year 8",
    testKey: "digraph_review",
    accuracy: 0.78,
    firstTry: 0.58,
    weakTargets: ["th", "ph", "dge"],
    interventionPupilIndexes: [2, 9],
    partialPupilIndex: 11,
    notStartedPupilIndex: 13,
  },
  {
    key: "y10_willow",
    name: `${DEMO_CLASS_PREFIX} Year 10 Willow`,
    yearGroup: "Year 10",
    testKey: "intervention_checkpoint",
    accuracy: 0.61,
    firstTry: 0.35,
    weakTargets: ["ai", "oa", "ea", "igh"],
    interventionPupilIndexes: [0, 2, 8],
    partialPupilIndex: 11,
    notStartedPupilIndex: 13,
  },
  {
    key: "y10_birch",
    name: `${DEMO_CLASS_PREFIX} Year 10 Birch`,
    yearGroup: "Year 10",
    testKey: "intervention_checkpoint",
    accuracy: 0.73,
    firstTry: 0.49,
    weakTargets: ["oa", "ow", "ee"],
    interventionPupilIndexes: [3, 10],
    partialPupilIndex: 12,
    notStartedPupilIndex: 13,
  },
];

const DEMO_PP_INDEXES = [
  [0, 3, 5, 8, 11],
  [1, 4, 6, 9, 12],
  [0, 2, 7, 10, 13],
  [1, 3, 6, 8, 11],
  [2, 5, 7, 9, 12],
];

const DEMO_SEN_SUPPORT_INDEXES = [
  [1, 6, 9, 12],
  [0, 4, 8, 11],
  [2, 5, 9, 12],
  [1, 4, 7, 10],
  [0, 3, 8, 13],
];
const DEMO_EHCP_INDEXES = [
  [3, 7, 10],
  [2, 6, 13],
  [1, 8, 11],
  [0, 5, 12],
  [4, 6, 10],
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function describeError(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error && error.message) return `${fallback} ${error.message}`.trim();
  if (typeof error === "string" && error.trim()) return `${fallback} ${error.trim()}`.trim();
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = [
      record.message,
      record.details,
      record.hint,
      record.code ? `(${record.code})` : "",
    ]
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => String(value).trim())
      .join(" ");
    if (message) return `${fallback} ${message}`.trim();
  }
  return fallback;
}

function randomJoinCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function getDemoGenderValue(classIndex: number, pupilIndex: number) {
  return (classIndex + pupilIndex) % 2 === 0 ? "female" : "male";
}

function buildDemoPupilIdentity(classIndex: number, pupilIndex: number) {
  const globalIndex = classIndex * DEMO_PUPILS_PER_CLASS + pupilIndex;
  const genderValue = getDemoGenderValue(classIndex, pupilIndex);
  const firstNamePool = genderValue === "female" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  const firstName = firstNamePool[globalIndex % firstNamePool.length];
  const surname = DEMO_SURNAMES[(globalIndex * 3 + classIndex) % DEMO_SURNAMES.length];

  return {
    firstName,
    surname,
    genderValue,
  };
}

function buildDemoGroupValueRows({
  teacherId,
  pupilsWithClass,
}: {
  teacherId: string;
  pupilsWithClass: Array<{ id: string; classKey: string }>;
}) {
  const classIndexByKey = new Map(CLASS_SPECS.map((item, index) => [item.key, index]));
  const pupilsByClass = new Map<string, Array<{ id: string; classKey: string }>>();

  for (const pupil of pupilsWithClass) {
    const next = pupilsByClass.get(pupil.classKey) || [];
    next.push(pupil);
    pupilsByClass.set(pupil.classKey, next);
  }

  const updatedAt = new Date().toISOString();

  return pupilsWithClass.flatMap((pupil) => {
    const classIndex = Number(classIndexByKey.get(pupil.classKey) || 0);
    const pupilIndex = (pupilsByClass.get(pupil.classKey) || [])
      .findIndex((item) => item.id === pupil.id);

    if (!pupil.id || pupilIndex < 0) return [];

    const ppValue = (DEMO_PP_INDEXES[classIndex] || []).includes(pupilIndex) ? "pp" : "non_pp";
    const senValue = (DEMO_EHCP_INDEXES[classIndex] || []).includes(pupilIndex)
      ? "ehcp"
      : (DEMO_SEN_SUPPORT_INDEXES[classIndex] || []).includes(pupilIndex)
        ? "sen_support"
        : "none";
    const genderValue = getDemoGenderValue(classIndex, pupilIndex);

    return [
      {
        teacher_id: teacherId,
        pupil_id: pupil.id,
        group_type: "pp",
        group_value: ppValue,
        source: "demo_seed",
        updated_at: updatedAt,
      },
      {
        teacher_id: teacherId,
        pupil_id: pupil.id,
        group_type: "sen",
        group_value: senValue,
        source: "demo_seed",
        updated_at: updatedAt,
      },
      {
        teacher_id: teacherId,
        pupil_id: pupil.id,
        group_type: "gender",
        group_value: genderValue,
        source: "demo_seed",
        updated_at: updatedAt,
      },
    ];
  });
}

function hashFraction(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function focusFromChoice(value: unknown) {
  const choice = value && typeof value === "object" ? value as Record<string, unknown> : null;
  const graphemes = Array.isArray(choice?.focus_graphemes) ? choice.focus_graphemes : [];
  return String(graphemes[0] || "");
}

function segmentsFromRow(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "")) : [];
}

function legacyAttemptWord(payload: Record<string, unknown>) {
  const direct = String(payload.word || "").trim();
  if (direct) return direct;
  return String(payload.word_text || "").trim() || null;
}

async function insertAttemptsWithCompatibility(
  serviceClient: ReturnType<typeof createClient>,
  attemptsPayload: Array<Record<string, unknown>>,
) {
  const withoutAssignmentId = attemptsPayload.map(({ assignment_id, ...item }) => item);
  const variants = [
    attemptsPayload,
    attemptsPayload.map(({ word, is_correct, attempt_no, ...item }) => item),
    withoutAssignmentId,
    withoutAssignmentId.map(({ word, is_correct, attempt_no, ...item }) => item),
  ];

  let lastError: unknown = null;
  for (const variant of variants) {
    const { error } = await serviceClient.from("attempts").insert(variant);
    if (!error) return;
    lastError = error;
  }

  throw lastError || new Error("Could not create demo attempt history.");
}

function buildLegacyAssignmentVariantRows(
  assignments: Array<Record<string, unknown>>,
  variant: "full" | "deadline" | "basic" | "minimal" | "id_only",
) {
  return assignments.map((assignment) => {
    const base = {
      id: assignment.id,
      teacher_id: assignment.teacher_id,
      class_id: assignment.class_id,
      test_id: assignment.test_id,
      created_at: assignment.created_at,
    };

    if (variant === "full") {
      return {
        ...base,
        mode: assignment.mode,
        max_attempts: assignment.max_attempts,
        audio_enabled: assignment.audio_enabled,
        hints_enabled: assignment.hints_enabled,
        end_at: assignment.end_at,
      };
    }

    if (variant === "deadline") {
      return {
        ...base,
        mode: assignment.mode,
        max_attempts: assignment.max_attempts,
        audio_enabled: assignment.audio_enabled,
        hints_enabled: assignment.hints_enabled,
        deadline: assignment.end_at,
      };
    }

    if (variant === "basic") {
      return {
        ...base,
        mode: assignment.mode,
        max_attempts: assignment.max_attempts,
      };
    }

    if (variant === "minimal") {
      return base;
    }

    return { id: assignment.id };
  });
}

async function ensureLegacyAssignmentsCompatibility(
  serviceClient: ReturnType<typeof createClient>,
  assignments: Array<Record<string, unknown>>,
) {
  if (!assignments.length) return false;

  const variants: Array<"full" | "deadline" | "basic" | "minimal" | "id_only"> = [
    "full",
    "deadline",
    "basic",
    "minimal",
    "id_only",
  ];

  let lastError: unknown = null;
  for (const variant of variants) {
    const rows = buildLegacyAssignmentVariantRows(assignments, variant);
    const { error } = await serviceClient.from("assignments").insert(rows);
    if (!error) return true;
    lastError = error;
  }

  console.warn("legacy assignments compatibility insert failed", lastError);
  return false;
}

async function cleanupDemoData(serviceClient: ReturnType<typeof createClient>, teacherId: string, demoMisPrefix: string) {
  const { data: demoClasses, error: demoClassesError } = await serviceClient
    .from("classes")
    .select("id")
    .eq("teacher_id", teacherId)
    .ilike("name", `${DEMO_CLASS_PREFIX}%`);
  if (demoClassesError) throw new Error(describeError(demoClassesError, "Could not find existing demo classes."));

  const { data: demoTests, error: demoTestsError } = await serviceClient
    .from("tests")
    .select("id")
    .eq("teacher_id", teacherId)
    .ilike("title", `${DEMO_TEST_PREFIX}%`);
  if (demoTestsError) throw new Error(describeError(demoTestsError, "Could not find existing demo tests."));

  const { data: demoPupils, error: demoPupilsError } = await serviceClient
    .from("pupils")
    .select("id")
    .ilike("mis_id", `${demoMisPrefix}%`);
  if (demoPupilsError) throw new Error(describeError(demoPupilsError, "Could not find existing demo pupils."));

  const classIds = (demoClasses || []).map((item) => String(item.id || "")).filter(Boolean);
  const testIds = (demoTests || []).map((item) => String(item.id || "")).filter(Boolean);
  const pupilIds = (demoPupils || []).map((item) => String(item.id || "")).filter(Boolean);

  const { data: demoAssignments, error: demoAssignmentsError } = classIds.length || testIds.length
    ? await serviceClient
      .from("assignments_v2")
      .select("id")
      .eq("teacher_id", teacherId)
      .or([
        classIds.length ? `class_id.in.(${classIds.join(",")})` : null,
        testIds.length ? `test_id.in.(${testIds.join(",")})` : null,
        ].filter(Boolean).join(","))
    : { data: [], error: null };
  if (demoAssignmentsError) throw new Error(describeError(demoAssignmentsError, "Could not find existing demo assignments."));

  const assignmentIds = (demoAssignments || []).map((item) => String(item.id || "")).filter(Boolean);

  if (assignmentIds.length) {
    const { error } = await serviceClient.from("attempts").delete().in("assignment_id", assignmentIds);
    if (error && pupilIds.length) {
      const { error: pupilDeleteError } = await serviceClient.from("attempts").delete().in("pupil_id", pupilIds);
      if (pupilDeleteError) throw new Error(describeError(pupilDeleteError, "Could not remove existing demo attempts."));
    } else if (error) {
      throw new Error(describeError(error, "Could not remove existing demo attempts."));
    }
  } else if (pupilIds.length) {
    const { error } = await serviceClient.from("attempts").delete().in("pupil_id", pupilIds);
    if (error) throw new Error(describeError(error, "Could not remove existing demo attempts."));
  }

  if (assignmentIds.length) {
    const { error } = await serviceClient.from("assignments").delete().in("id", assignmentIds);
    if (error) {
      console.warn("Could not remove legacy demo assignments.", error);
    }
  }

  if (assignmentIds.length) {
    const { error } = await serviceClient.from("assignments_v2").delete().in("id", assignmentIds);
    if (error) throw new Error(describeError(error, "Could not remove existing demo assignments."));
  }
  if (testIds.length) {
    const { error: testWordsDeleteError } = await serviceClient.from("test_words").delete().in("test_id", testIds);
    if (testWordsDeleteError) throw new Error(describeError(testWordsDeleteError, "Could not remove existing demo test words."));
    const { error: testsDeleteError } = await serviceClient.from("tests").delete().in("id", testIds);
    if (testsDeleteError) throw new Error(describeError(testsDeleteError, "Could not remove existing demo tests."));
  }
  if (classIds.length) {
    const { error: membershipsDeleteError } = await serviceClient.from("pupil_classes").delete().in("class_id", classIds);
    if (membershipsDeleteError) throw new Error(describeError(membershipsDeleteError, "Could not remove existing demo class memberships."));
    const { error: classesDeleteError } = await serviceClient.from("classes").delete().in("id", classIds);
    if (classesDeleteError) throw new Error(describeError(classesDeleteError, "Could not remove existing demo classes."));
  }
  if (pupilIds.length) {
    const { error: groupValuesDeleteError } = await serviceClient
      .from("teacher_pupil_group_values")
      .delete()
      .eq("teacher_id", teacherId)
      .in("pupil_id", pupilIds);
    if (groupValuesDeleteError) throw new Error(describeError(groupValuesDeleteError, "Could not remove existing demo group comparison values."));
    const { error: membershipsDeleteError } = await serviceClient.from("pupil_classes").delete().in("pupil_id", pupilIds);
    if (membershipsDeleteError) throw new Error(describeError(membershipsDeleteError, "Could not remove existing demo pupil memberships."));
    const { error: pupilsDeleteError } = await serviceClient.from("pupils").delete().in("id", pupilIds);
    if (pupilsDeleteError) throw new Error(describeError(pupilsDeleteError, "Could not remove existing demo pupils."));
  }

  return {
    classesCleared: classIds.length,
    testsCleared: testIds.length,
    pupilsCleared: pupilIds.length,
    assignmentsCleared: assignmentIds.length,
  };
}

async function seedDemoData(serviceClient: ReturnType<typeof createClient>, teacherId: string, demoMisPrefix: string) {
  const now = new Date();

  const insertedClasses = [];
  for (const classSpec of CLASS_SPECS) {
    const { data, error } = await serviceClient
      .from("classes")
      .insert({
        teacher_id: teacherId,
        name: classSpec.name,
        year_group: classSpec.yearGroup,
        join_code: randomJoinCode(),
      })
      .select("id, name, year_group")
      .single();
    if (error) throw new Error(describeError(error, `Could not create demo class "${classSpec.name}".`));
    insertedClasses.push({ ...classSpec, id: data.id });
  }

  const insertedTests = [];
  for (const test of TESTS) {
    const createdAt = new Date(now.getTime() - (45 - insertedTests.length * 7) * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await serviceClient
      .from("tests")
      .insert({
        teacher_id: teacherId,
        title: test.title,
        question_type: test.questionType,
        created_at: createdAt,
      })
      .select("id, title")
      .single();
    if (error) throw new Error(describeError(error, `Could not create demo test "${test.title}".`));
    insertedTests.push({ ...test, id: data.id });
  }

  const wordRows = insertedTests.flatMap((test) =>
    test.words.map((word, index) => ({
      test_id: test.id,
      position: index + 1,
      word: word.word,
      sentence: word.sentence,
      segments: word.segments,
      choice: {
        focus_graphemes: [word.focus],
        question_type: "focus_sound",
      },
    }))
  );
  const { data: insertedWordRows, error: wordError } = await serviceClient
    .from("test_words")
    .insert(wordRows)
    .select("id, test_id, word, segments, choice, position");
  if (wordError) throw new Error(describeError(wordError, "Could not create demo test words."));

  const wordsByTest = new Map<string, Array<Record<string, unknown>>>();
  for (const row of insertedWordRows || []) {
    const key = String(row.test_id || "");
    const next = wordsByTest.get(key) || [];
    next.push(row);
    wordsByTest.set(key, next);
  }
  for (const [key, rows] of wordsByTest.entries()) {
    wordsByTest.set(key, [...rows].sort((a, b) => Number(a.position || 0) - Number(b.position || 0)));
  }

  const pupilsToInsert = insertedClasses.flatMap((classSpec, classIndex) => {
    return Array.from({ length: DEMO_PUPILS_PER_CLASS }).map((_, pupilIndex) => {
      const { firstName, surname } = buildDemoPupilIdentity(classIndex, pupilIndex);
      const suffix = `${classSpec.key.toUpperCase()}-${pupilIndex + 1}`;
      return {
        classKey: classSpec.key,
        first_name: firstName,
        surname,
        username: `demo_${classSpec.key}_${pupilIndex + 1}`.toLowerCase(),
        mis_id: `${demoMisPrefix}-${suffix}`,
        pin: "1234",
        must_reset_pin: false,
        is_active: true,
      };
    });
  });

  const { data: insertedPupils, error: pupilError } = await serviceClient
    .from("pupils")
    .insert(pupilsToInsert.map(({ classKey, ...pupil }) => pupil))
    .select("id, mis_id, username");
  if (pupilError) throw new Error(describeError(pupilError, "Could not create demo pupils."));

  const pupilIdByMisId = new Map((insertedPupils || []).map((row) => [String(row.mis_id || ""), String(row.id || "")]));
  const pupilsWithClass = pupilsToInsert.map((pupil) => ({
    ...pupil,
    id: pupilIdByMisId.get(pupil.mis_id) || "",
  }));
  if (pupilsWithClass.some((pupil) => !pupil.id)) {
    throw new Error("Could not match inserted demo pupils back to their records.");
  }

  const demoGroupValues = buildDemoGroupValueRows({
    teacherId,
    pupilsWithClass,
  });
  if (demoGroupValues.length) {
    const { error: groupValueError } = await serviceClient
      .from("teacher_pupil_group_values")
      .upsert(demoGroupValues, { onConflict: "teacher_id,pupil_id,group_type" });
    if (groupValueError) throw new Error(describeError(groupValueError, "Could not create demo group comparison values."));
  }

  const classIdByKey = new Map(insertedClasses.map((item) => [item.key, item.id]));
  const memberships = pupilsWithClass.map((pupil) => ({
    class_id: classIdByKey.get(pupil.classKey),
    pupil_id: pupil.id,
    active: true,
  }));
  const { error: membershipError } = await serviceClient.from("pupil_classes").insert(memberships);
  if (membershipError) throw new Error(describeError(membershipError, "Could not assign demo pupils to classes."));

  const insertedAssignments = [];
  for (let index = 0; index < insertedClasses.length; index += 1) {
    const classSpec = insertedClasses[index];
    const test = insertedTests.find((item) => item.key === classSpec.testKey);
    if (!test) continue;
    const createdAt = new Date(now.getTime() - (28 - index * 4) * 24 * 60 * 60 * 1000);
    const endAt = new Date(createdAt.getTime() + 10 * 24 * 60 * 60 * 1000);
    const { data, error } = await serviceClient
      .from("assignments_v2")
      .insert({
        teacher_id: teacherId,
        test_id: test.id,
        class_id: classSpec.id,
        mode: "test",
        max_attempts: 2,
        audio_enabled: true,
        hints_enabled: true,
        created_at: createdAt.toISOString(),
        end_at: endAt.toISOString(),
      })
      .select("id, class_id, test_id, created_at")
      .single();
    if (error) throw new Error(describeError(error, `Could not create demo assignment for "${classSpec.name}".`));
    insertedAssignments.push({
      ...classSpec,
      classId: classSpec.id,
      assignmentId: data.id,
      testId: test.id,
      createdAt,
      endAt,
    });
  }

  await ensureLegacyAssignmentsCompatibility(
    serviceClient,
    insertedAssignments.map((assignment) => ({
      id: assignment.assignmentId,
      teacher_id: teacherId,
      class_id: assignment.classId,
      test_id: assignment.testId,
      mode: "test",
      max_attempts: 2,
      audio_enabled: true,
      hints_enabled: true,
      created_at: assignment.createdAt.toISOString(),
      end_at: assignment.endAt.toISOString(),
    })),
  );

  const attemptsPayload = [];
  const targetWordsPayload = [];
  for (const assignment of insertedAssignments) {
    const classPupils = pupilsWithClass.filter((item) => item.classKey === assignment.key);
    const words = wordsByTest.get(String(assignment.testId)) || [];
    const focusWordRows = words
      .map((wordRow) => ({
        row: wordRow as Record<string, unknown>,
        focus: focusFromChoice((wordRow as Record<string, unknown>).choice),
      }))
      .filter((item) => assignment.weakTargets.includes(item.focus));
    const suggestedTargetRows = (focusWordRows.length ? focusWordRows : words.map((wordRow) => ({
      row: wordRow as Record<string, unknown>,
      focus: focusFromChoice((wordRow as Record<string, unknown>).choice),
    }))).slice(0, 3);
    for (let pupilIndex = 0; pupilIndex < classPupils.length; pupilIndex += 1) {
      const pupil = classPupils[pupilIndex];
      const needsTargets =
        assignment.interventionPupilIndexes?.includes(pupilIndex) ||
        assignment.partialPupilIndex === pupilIndex;
      if (needsTargets) {
        const targetLimit = assignment.interventionPupilIndexes?.includes(pupilIndex) ? 3 : 2;
        for (const target of suggestedTargetRows.slice(0, targetLimit)) {
          targetWordsPayload.push({
            teacher_id: teacherId,
            assignment_id: assignment.assignmentId,
            pupil_id: pupil.id,
            test_word_id: target.row.id,
            focus_grapheme: target.focus || null,
            target_source: "demo",
            target_reason: "focus_grapheme",
            created_at: assignment.createdAt.toISOString(),
          });
        }
      }
      if (assignment.notStartedPupilIndex === pupilIndex) continue;

      const maxWords = assignment.partialPupilIndex === pupilIndex ? Math.max(4, words.length - 2) : words.length;
      for (let wordIndex = 0; wordIndex < maxWords; wordIndex += 1) {
        const wordRow = words[wordIndex] as Record<string, unknown>;
        const focus = focusFromChoice(wordRow.choice);
        const classPenalty = assignment.weakTargets.includes(focus) ? 0.18 : 0;
        const interventionPenalty = assignment.interventionPupilIndexes?.includes(pupilIndex) ? 0.22 : 0;
        const baseKey = `${teacherId}:${assignment.key}:${pupil.mis_id}:${wordRow.word}`;
        const successChance = Math.max(0.2, Math.min(0.95, assignment.accuracy - classPenalty - interventionPenalty + (hashFraction(`${baseKey}:success`) - 0.5) * 0.16));
        const firstTryChance = Math.max(0.12, Math.min(0.9, assignment.firstTry - classPenalty - interventionPenalty + (hashFraction(`${baseKey}:first`) - 0.5) * 0.12));
        const finalCorrect = hashFraction(`${baseKey}:final`) < successChance;
        const firstTry = finalCorrect && hashFraction(`${baseKey}:first-final`) < firstTryChance;
        const attemptsUsed = firstTry ? 1 : (finalCorrect ? (hashFraction(`${baseKey}:tries`) < 0.55 ? 2 : 3) : (hashFraction(`${baseKey}:tries`) < 0.45 ? 2 : 3));

        for (let attemptIndex = 1; attemptIndex <= attemptsUsed; attemptIndex += 1) {
          const isFinal = attemptIndex === attemptsUsed;
          const isCorrect = isFinal ? finalCorrect : false;
          const minuteOffset = wordIndex * 8 + pupilIndex * 3 + attemptIndex;
          const createdAt = new Date(assignment.createdAt.getTime() + (wordIndex % 5) * 24 * 60 * 60 * 1000 + minuteOffset * 60 * 1000);
          attemptsPayload.push({
            pupil_id: pupil.id,
            assignment_id: assignment.assignmentId,
            test_id: assignment.testId,
            test_word_id: wordRow.id,
            word: wordRow.word,
            mode: "test",
            typed: isCorrect ? wordRow.word : TESTS.find((item) => item.key === assignment.testKey)?.words[wordIndex]?.wrong || `${wordRow.word}-x`,
            is_correct: isCorrect,
            correct: isCorrect,
            attempt_no: attemptIndex,
            attempt_number: attemptIndex,
            attempts_allowed: 3,
            word_text: wordRow.word,
            attempt_source: "test",
            target_graphemes: segmentsFromRow(wordRow.segments),
            focus_grapheme: focus,
            pattern_type: focus,
            created_at: createdAt.toISOString(),
          });
        }
      }
    }
  }

  try {
    await insertAttemptsWithCompatibility(serviceClient, attemptsPayload);
  } catch (attemptError) {
    throw new Error(describeError(attemptError, "Could not create demo attempt history."));
  }

  if (targetWordsPayload.length) {
    const { error: targetError } = await serviceClient
      .from("assignment_pupil_target_words")
      .upsert(targetWordsPayload, { onConflict: "assignment_id,pupil_id,test_word_id" });
    if (targetError) {
      throw new Error(describeError(targetError, "Could not create demo pupil target words."));
    }
  }

  return {
    classesCreated: insertedClasses.length,
    pupilsCreated: pupilsWithClass.length,
    testsCreated: insertedTests.length,
    assignmentsCreated: insertedAssignments.length,
    attemptsCreated: attemptsPayload.length,
    targetsCreated: targetWordsPayload.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return json({ error: "Missing Supabase secrets." }, 500);
    }

    const body = await req.json().catch(() => ({})) as DemoSchoolRequest;
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? String(authHeader.slice(7) || "").trim()
      : "";
    const accessToken = String(body?.accessToken || "").trim();
    const jwt = bearerToken || accessToken;
    if (!jwt) {
      return json({ error: "Teacher session token not provided." }, 401);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !authData?.user?.id) {
      return json({ error: "Teacher session could not be verified. Please sign out and sign in again." }, 401);
    }

    const action = String(body?.action || "seed") as Action;
    const teacherId = authData.user.id;
    const { data: canManageDemoData, error: capabilityError } = await serviceClient.rpc("can_manage_roles", {
      requested_user_id: teacherId,
    });
    if (capabilityError) {
      throw capabilityError;
    }
    if (!canManageDemoData) {
      return json({ error: "Admin access is required to manage demo data." }, 403);
    }

    const demoMisPrefix = `DEMO-${teacherId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;

    const cleared = await cleanupDemoData(serviceClient, teacherId, demoMisPrefix);
    if (action === "clear") {
      return json({
        ok: true,
        action,
        ...cleared,
      });
    }

    const seeded = await seedDemoData(serviceClient, teacherId, demoMisPrefix);
    return json({
      ok: true,
      action,
      ...cleared,
      ...seeded,
      classLabels: CLASS_SPECS.map((item) => item.name),
      yearGroups: Array.from(new Set(CLASS_SPECS.map((item) => item.yearGroup))),
    });
  } catch (error) {
    console.error("demo-school-data error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
