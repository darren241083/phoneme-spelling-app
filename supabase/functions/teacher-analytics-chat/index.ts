import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ScopeType = "overview" | "assignment" | "class" | "year_group" | "pupil";
type ChatTurn = {
  role?: "user" | "assistant";
  text?: string;
};

type ChatRequest = {
  question?: string;
  scopeType?: ScopeType;
  scopeId?: string | null;
  scopeLabel?: string | null;
  history?: ChatTurn[];
  accessToken?: string | null;
};

type AttemptRow = {
  assignment_id: string | null;
  pupil_id: string | null;
  test_word_id: string | null;
  correct: boolean | null;
  attempt_number: number | null;
  created_at: string | null;
  focus_grapheme: string | null;
  pattern_type: string | null;
  word_text: string | null;
  target_graphemes: string[] | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function displayName(pupil: Record<string, unknown> | null | undefined) {
  const first = String(pupil?.first_name || "").trim();
  const surname = String(pupil?.surname || "").trim();
  const full = `${first} ${surname}`.trim();
  return full || String(pupil?.username || "Unknown pupil");
}

function analyticsTargetForAttempt(attempt: AttemptRow) {
  const focus = String(attempt?.focus_grapheme || "").trim().toLowerCase();
  if (focus) return focus;

  const targetGraphemes = Array.isArray(attempt?.target_graphemes)
    ? attempt.target_graphemes.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  if (targetGraphemes.length) {
    return targetGraphemes.sort((a, b) => b.length - a.length)[0];
  }

  return String(attempt?.pattern_type || "").trim().toLowerCase() || "general";
}

function round(value: number, digits = 3) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildAnalyticsContext({
  classes,
  assignments,
  memberships,
  pupils,
  attempts,
  scopeType,
  scopeId,
  scopeLabel,
}: {
  classes: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
  memberships: Array<Record<string, unknown>>;
  pupils: Array<Record<string, unknown>>;
  attempts: AttemptRow[];
  scopeType: ScopeType;
  scopeId: string | null;
  scopeLabel: string | null;
}) {
  const classById = new Map(classes.map((item) => [String(item.id), item]));
  const assignmentById = new Map(assignments.map((item) => [String(item.id), item]));
  const pupilById = new Map(pupils.map((item) => [String(item.id), item]));
  const membershipsByPupil = new Map<string, string[]>();

  for (const membership of memberships) {
    const pupilId = String(membership.pupil_id || "");
    const classId = String(membership.class_id || "");
    if (!pupilId || !classId) continue;
    const next = membershipsByPupil.get(pupilId) || [];
    next.push(classId);
    membershipsByPupil.set(pupilId, next);
  }

  const latestByPupilWord = new Map<string, AttemptRow>();
  for (const attempt of attempts) {
    const pupilId = String(attempt?.pupil_id || "");
    const wordId = String(attempt?.test_word_id || "");
    if (!pupilId || !wordId) continue;
    latestByPupilWord.set(`${pupilId}::${wordId}`, attempt);
  }

  const latestRows = Array.from(latestByPupilWord.values());
  const latestRowsByPupil = new Map<string, AttemptRow[]>();
  const latestRowsByClass = new Map<string, AttemptRow[]>();

  for (const attempt of latestRows) {
    const pupilId = String(attempt?.pupil_id || "");
    const assignmentId = String(attempt?.assignment_id || "");
    const classId = String(assignmentById.get(assignmentId)?.class_id || "");

    const pupilRows = latestRowsByPupil.get(pupilId) || [];
    pupilRows.push(attempt);
    latestRowsByPupil.set(pupilId, pupilRows);

    if (classId) {
      const classRows = latestRowsByClass.get(classId) || [];
      classRows.push(attempt);
      latestRowsByClass.set(classId, classRows);
    }
  }

  const pupilSummaries = Array.from(membershipsByPupil.keys()).map((pupilId) => {
    const latest = latestRowsByPupil.get(pupilId) || [];
    const total = latest.length;
    const correct = latest.filter((item) => item.correct).length;
    const accuracy = total ? correct / total : 0;
    const firstTrySuccess = total
      ? latest.filter((item) => item.correct && Math.max(1, Number(item.attempt_number || 1)) === 1).length / total
      : 0;
    const averageAttempts = total
      ? latest.reduce((sum, item) => sum + Math.max(1, Number(item.attempt_number || 1)), 0) / total
      : 0;

    const weakGraphemeCounts = new Map<string, number>();
    for (const item of latest) {
      if (item.correct) continue;
      const target = analyticsTargetForAttempt(item);
      weakGraphemeCounts.set(target, (weakGraphemeCounts.get(target) || 0) + 1);
    }
    const weakGraphemes = Array.from(weakGraphemeCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([target]) => target);

    const latestActivity = latest
      .map((item) => new Date(item.created_at || 0).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a)[0] || null;

    const needsIntervention = total >= 4 && (
      accuracy < 0.65 ||
      firstTrySuccess < 0.5 ||
      averageAttempts > 2.2
    );

    return {
      pupilId,
      name: displayName(pupilById.get(pupilId)),
      classIds: membershipsByPupil.get(pupilId) || [],
      wordsChecked: total,
      accuracy: round(accuracy),
      firstTrySuccessRate: round(firstTrySuccess),
      averageAttempts: round(averageAttempts),
      weakGraphemes,
      latestActivity,
      needsIntervention,
    };
  }).sort((a, b) => {
    if (Number(a.needsIntervention) !== Number(b.needsIntervention)) {
      return Number(b.needsIntervention) - Number(a.needsIntervention);
    }
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return a.name.localeCompare(b.name);
  });

  const classSummaries = classes.map((cls) => {
    const classId = String(cls.id || "");
    const rows = latestRowsByClass.get(classId) || [];
    const pupilIds = new Set(
      memberships
        .filter((item) => String(item.class_id || "") === classId)
        .map((item) => String(item.pupil_id || ""))
        .filter(Boolean)
    );
    const checked = rows.length;
    const correct = rows.filter((item) => item.correct).length;
    const accuracy = checked ? correct / checked : 0;
    const firstTrySuccess = checked
      ? rows.filter((item) => item.correct && Math.max(1, Number(item.attempt_number || 1)) === 1).length / checked
      : 0;
    const averageAttempts = checked
      ? rows.reduce((sum, item) => sum + Math.max(1, Number(item.attempt_number || 1)), 0) / checked
      : 0;

    const graphemeCounts = new Map<string, { total: number; incorrect: number }>();
    for (const row of rows) {
      const target = analyticsTargetForAttempt(row);
      const current = graphemeCounts.get(target) || { total: 0, incorrect: 0 };
      current.total += 1;
      if (!row.correct) current.incorrect += 1;
      graphemeCounts.set(target, current);
    }
    const weakGraphemes = Array.from(graphemeCounts.entries())
      .map(([target, item]) => ({
        target,
        errorRate: item.total ? item.incorrect / item.total : 0,
        total: item.total,
      }))
      .filter((item) => item.total >= 2 && item.target !== "general")
      .sort((a, b) => b.errorRate - a.errorRate || b.total - a.total || a.target.localeCompare(b.target))
      .slice(0, 5);

    const interventionPupils = pupilSummaries
      .filter((item) => item.classIds.includes(classId) && item.needsIntervention)
      .slice(0, 5)
      .map((item) => ({
        name: item.name,
        accuracy: item.accuracy,
        firstTrySuccessRate: item.firstTrySuccessRate,
        averageAttempts: item.averageAttempts,
        weakGraphemes: item.weakGraphemes,
      }));

    return {
      classId,
      className: String(cls.name || "Class"),
      yearGroup: String(cls.year_group || "").trim() || null,
      pupilCount: pupilIds.size,
      wordsChecked: checked,
      accuracy: round(accuracy),
      firstTrySuccessRate: round(firstTrySuccess),
      averageAttempts: round(averageAttempts),
      weakGraphemes,
      interventionPupils,
    };
  }).sort((a, b) => a.className.localeCompare(b.className));

  const yearGroupMap = new Map<string, typeof classSummaries>();
  for (const summary of classSummaries) {
    const key = String(summary.yearGroup || "Unassigned");
    const next = yearGroupMap.get(key) || [];
    next.push(summary);
    yearGroupMap.set(key, next);
  }

  const yearGroupSummaries = Array.from(yearGroupMap.entries()).map(([yearGroup, items]) => {
    const pupilCount = items.reduce((sum, item) => sum + item.pupilCount, 0);
    const wordsChecked = items.reduce((sum, item) => sum + item.wordsChecked, 0);
    const accuracy = items.length
      ? items.reduce((sum, item) => sum + item.accuracy, 0) / items.length
      : 0;
    const firstTrySuccessRate = items.length
      ? items.reduce((sum, item) => sum + item.firstTrySuccessRate, 0) / items.length
      : 0;
    const averageAttempts = items.length
      ? items.reduce((sum, item) => sum + item.averageAttempts, 0) / items.length
      : 0;

    return {
      yearGroup,
      classCount: items.length,
      pupilCount,
      wordsChecked,
      accuracy: round(accuracy),
      firstTrySuccessRate: round(firstTrySuccessRate),
      averageAttempts: round(averageAttempts),
      weakGraphemes: items.flatMap((item) => item.weakGraphemes).slice(0, 8),
    };
  }).sort((a, b) => a.yearGroup.localeCompare(b.yearGroup));

  const filteredPupilSummaries = scopeType === "pupil" && scopeId
    ? pupilSummaries.filter((item) => item.pupilId === scopeId)
    : pupilSummaries;

  return {
    generatedAt: new Date().toISOString(),
    dataWindowDays: 180,
    notes: [
      "This summary uses recent latest-attempt outcomes per pupil per word, not formal diagnoses.",
      "Use it to guide support, targeted teaching, and review conversations.",
    ],
    scope: {
      type: scopeType,
      id: scopeId,
      label: scopeLabel,
    },
    counts: {
      classes: classSummaries.length,
      pupils: filteredPupilSummaries.length,
      assignments: assignments.length,
      recentAttemptsSampled: attempts.length,
      latestWordOutcomes: latestRows.length,
    },
    classSummaries,
    yearGroupSummaries,
    pupilsNeedingIntervention: filteredPupilSummaries.filter((item) => item.needsIntervention).slice(0, 12),
    pupilSummaries: filteredPupilSummaries.slice(0, 60),
  };
}

const MOCK_CLASS_LIBRARY = [
  { name: "[Sample] Year 7 Maple", year_group: "Year 7" },
  { name: "[Sample] Year 7 Oak", year_group: "Year 7" },
  { name: "[Sample] Year 10 Willow", year_group: "Year 10" },
];

const MOCK_WORDS_BY_TARGET: Record<string, string[]> = {
  ai: ["rain", "train", "chain"],
  oa: ["boat", "coast", "float"],
  ee: ["green", "seed", "sleep"],
  ea: ["beach", "teacher", "stream"],
  igh: ["night", "light", "bright"],
  ow: ["slow", "growth", "snow"],
  ch: ["chip", "chair", "reach"],
  sh: ["shell", "shine", "brush"],
  th: ["thing", "thick", "path"],
  ph: ["phone", "graph", "dolphin"],
  dge: ["badge", "bridge", "hedge"],
};

function hashFraction(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function mockTargetsForClass(cls: Record<string, unknown>, classIndex: number) {
  const yearGroup = String(cls?.year_group || "").toLowerCase();
  if (yearGroup.includes("10")) return ["ai", "oa", "ea", "igh", "ow", "ee"];
  if (yearGroup.includes("8")) return ["ch", "sh", "th", "ph", "dge", "ai"];
  return classIndex % 2 === 0
    ? ["ai", "oa", "ee", "ea", "igh", "ow"]
    : ["ch", "sh", "th", "ai", "oa", "ee"];
}

function mockWordForTarget(target: string, wordIndex: number) {
  const words = MOCK_WORDS_BY_TARGET[target] || [target];
  return words[wordIndex % words.length] || `${target}-${wordIndex + 1}`;
}

function buildMockAnalyticsContext({
  classes,
  assignments,
  memberships,
  pupils,
  scopeType,
  scopeId,
  scopeLabel,
}: {
  classes: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
  memberships: Array<Record<string, unknown>>;
  pupils: Array<Record<string, unknown>>;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeLabel: string | null;
}) {
  const safeClasses = classes.length
    ? classes.map((item, index) => ({
      id: String(item.id || `mock-class-${index + 1}`),
      name: String(item.name || `Class ${index + 1}`),
      year_group: String(item.year_group || "").trim() || null,
    }))
    : MOCK_CLASS_LIBRARY.map((item, index) => ({
      id: `mock-class-${index + 1}`,
      name: item.name,
      year_group: item.year_group,
    }));

  let safePupils = pupils.map((item, index) => ({
    id: String(item.id || `mock-pupil-${index + 1}`),
    first_name: String(item.first_name || "").trim(),
    surname: String(item.surname || "").trim(),
    username: String(item.username || `pupil${index + 1}`),
  }));

  let safeMemberships = memberships
    .filter((item) => String(item.class_id || "").trim() && String(item.pupil_id || "").trim())
    .map((item) => ({
      class_id: String(item.class_id),
      pupil_id: String(item.pupil_id),
      active: true,
    }));

  if (!safePupils.length || !safeMemberships.length) {
    safePupils = [];
    safeMemberships = [];

    safeClasses.forEach((cls, classIndex) => {
      for (let pupilIndex = 0; pupilIndex < 5; pupilIndex += 1) {
        const pupilId = `mock-pupil-${classIndex + 1}-${pupilIndex + 1}`;
        safePupils.push({
          id: pupilId,
          first_name: `Pupil`,
          surname: `${classIndex + 1}${String.fromCharCode(65 + pupilIndex)}`,
          username: `mock_${classIndex + 1}_${pupilIndex + 1}`,
        });
        safeMemberships.push({
          class_id: cls.id,
          pupil_id: pupilId,
          active: true,
        });
      }
    });
  }

  const assignmentByClass = new Map<string, Record<string, unknown>>();
  for (const assignment of assignments) {
    const classId = String(assignment.class_id || "");
    if (!classId || assignmentByClass.has(classId)) continue;
    assignmentByClass.set(classId, {
      ...assignment,
      id: String(assignment.id || `mock-assignment-${classId}`),
      class_id: classId,
      test_id: String(assignment.test_id || `mock-test-${classId}`),
      created_at: String(assignment.created_at || new Date().toISOString()),
      end_at: assignment.end_at || null,
    });
  }

  for (const cls of safeClasses) {
    if (assignmentByClass.has(cls.id)) continue;
    assignmentByClass.set(cls.id, {
      id: `mock-assignment-${cls.id}`,
      class_id: cls.id,
      test_id: `mock-test-${cls.id}`,
      created_at: new Date().toISOString(),
      end_at: null,
      tests: {
        title: `${cls.name} spelling check`,
      },
    });
  }

  const safeAssignments = Array.from(assignmentByClass.values());
  const attempts: AttemptRow[] = [];

  safeClasses.forEach((cls, classIndex) => {
    const classId = String(cls.id || "");
    const assignmentId = String(assignmentByClass.get(classId)?.id || `mock-assignment-${classId}`);
    const roster = safeMemberships
      .filter((item) => String(item.class_id || "") === classId)
      .map((item) => String(item.pupil_id || ""))
      .filter(Boolean);
    const targets = mockTargetsForClass(cls, classIndex);
    const weakTargets = targets.slice(0, 2);
    const baseAccuracy = String(cls.year_group || "").includes("10")
      ? 0.64
      : String(cls.year_group || "").includes("8")
        ? 0.73
        : 0.81;

    roster.forEach((pupilId, pupilIndex) => {
      const supportPenalty = pupilIndex % 4 === 0 ? 0.2 : pupilIndex % 3 === 0 ? 0.1 : 0;
      const wordsChecked = 6 + (pupilIndex % 3);

      for (let wordIndex = 0; wordIndex < wordsChecked; wordIndex += 1) {
        const target = targets[wordIndex % targets.length];
        const wordText = mockWordForTarget(target, wordIndex);
        const targetPenalty = weakTargets.includes(target) ? 0.12 : 0;
        const successChance = Math.max(
          0.35,
          Math.min(0.94, baseAccuracy - supportPenalty - targetPenalty + (hashFraction(`${classId}:${pupilId}:${wordText}:success`) - 0.5) * 0.12),
        );
        const firstTryChance = Math.max(
          0.18,
          Math.min(0.86, successChance - 0.12 + (hashFraction(`${classId}:${pupilId}:${wordText}:first`) - 0.5) * 0.08),
        );
        const correct = hashFraction(`${classId}:${pupilId}:${wordText}:final`) < successChance;
        const firstTry = correct && hashFraction(`${classId}:${pupilId}:${wordText}:first-final`) < firstTryChance;
        const attemptNumber = firstTry ? 1 : (correct ? 2 : 3);
        const createdAt = new Date(
          Date.now() - (classIndex * 9 + pupilIndex * 2 + wordIndex) * 24 * 60 * 60 * 1000,
        ).toISOString();

        attempts.push({
          assignment_id: assignmentId,
          pupil_id: pupilId,
          test_word_id: `mock-word-${classId}-${wordIndex + 1}`,
          correct,
          attempt_number: attemptNumber,
          created_at: createdAt,
          focus_grapheme: target,
          pattern_type: target,
          word_text: wordText,
          target_graphemes: [target],
        });
      }
    });
  });

  const context = buildAnalyticsContext({
    classes: safeClasses,
    assignments: safeAssignments,
    memberships: safeMemberships,
    pupils: safePupils,
    attempts,
    scopeType,
    scopeId,
    scopeLabel,
  });

  return {
    ...context,
    mockMode: true,
    notes: [
      "Using sample analytics data because no real attempt data was available for this scope.",
      ...context.notes,
    ],
  };
}

function buildMessages(question: string, context: ReturnType<typeof buildAnalyticsContext>, history: ChatTurn[] = []) {
  const system = [
    "You are a careful school spelling analytics assistant.",
    "Answer only from the supplied analytics JSON.",
    "Be concise, evidence-based, and practical for teachers.",
    "When identifying pupils who need intervention, cite objective evidence like accuracy, first-try success, average attempts, weak graphemes, and sample size.",
    "Never diagnose dyslexia or any medical condition.",
    "If asked whether someone is at risk of dyslexia, explain that the data may justify review, screening, or SENCo discussion, but it is not a diagnosis.",
    "If the data is thin, say so clearly.",
    "Structure your answer as: direct answer, evidence, next step.",
  ].join(" ");

  const contextMessage = [
    `Current teacher question: ${question}`,
    "Analytics JSON:",
    JSON.stringify(context),
  ].join("\n\n");

  const turns = history
    .filter((item) => (item?.role === "user" || item?.role === "assistant") && String(item?.text || "").trim())
    .slice(-6)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: [{ type: "input_text", text: String(item.text || "") }],
    }));

  return {
    system,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: contextMessage }],
      },
      ...turns,
      {
        role: "user",
        content: [{ type: "input_text", text: question }],
      },
    ],
  };
}

function buildFallbackAnswer(question: string, context: ReturnType<typeof buildAnalyticsContext>) {
  const lowerQuestion = question.toLowerCase();
  if (lowerQuestion.includes("intervention")) {
    const pupils = context.pupilsNeedingIntervention.slice(0, 5);
    if (!pupils.length) {
      return "No pupils are clearly flagged for intervention from the current data. Evidence: there is no strong low-accuracy or high-attempt pattern in the sampled latest outcomes. Next step: keep monitoring first-try success and weak graphemes over the next few tests.";
    }
    const lines = pupils.map((item) =>
      `${item.name}: accuracy ${Math.round(item.accuracy * 100)}%, first-try success ${Math.round(item.firstTrySuccessRate * 100)}%, average tries ${item.averageAttempts.toFixed(1)}, weak graphemes ${item.weakGraphemes.join(", ") || "general"}.`
    );
    return `Pupils currently most likely to need intervention are ${pupils.map((item) => item.name).join(", ")}. Evidence: ${lines.join(" ")} Next step: assign a short targeted practice set focused on the listed weak graphemes and review again after the next assessment.`;
  }

  if (lowerQuestion.includes("dyslexia")) {
    return "The data can highlight pupils who may benefit from review or screening, but it cannot diagnose dyslexia. Evidence: look for persistently low accuracy, low first-try success, and high average tries across multiple tests and graphemes. Next step: discuss the flagged pupils with your SENCo and consider formal screening alongside classroom evidence.";
  }

  return "I can summarise the current spelling data, but the model response was unavailable just now. Evidence: the analytics context is attached in this response payload. Next step: try the question again, or ask for intervention priorities, weak graphemes, or class comparisons.";
}

function isUuid(value: string | null | undefined) {
  return UUID_PATTERN.test(String(value || "").trim());
}

async function resolveVisibleClassIds(
  serviceClient: ReturnType<typeof createClient>,
  teacherId: string,
  {
    classId = null,
    yearGroup = null,
    departmentKey = null,
  }: {
    classId?: string | null;
    yearGroup?: string | null;
    departmentKey?: string | null;
  },
) {
  const { data, error } = await serviceClient.rpc("list_viewable_class_ids", {
    requested_user_id: teacherId,
    requested_class_id: classId || null,
    requested_year_group: yearGroup || null,
    requested_department_key: departmentKey || null,
  });

  if (error) throw error;
  return Array.isArray(data)
    ? data.map((item) => String(item || "")).filter(Boolean)
    : [];
}

async function ensureScopeVisible(
  serviceClient: ReturnType<typeof createClient>,
  rpcName: "can_view_assignment" | "can_view_pupil",
  teacherId: string,
  targetId: string,
) {
  const args = rpcName === "can_view_assignment"
    ? { requested_assignment_id: targetId, requested_user_id: teacherId }
    : { requested_pupil_id: targetId, requested_user_id: teacherId };
  const { data, error } = await serviceClient.rpc(rpcName, args);
  if (error) throw error;
  return !!data;
}

function buildLegacyUserPrompt(question: string, context: ReturnType<typeof buildAnalyticsContext>, history: ChatTurn[] = []) {
  const transcript = history
    .filter((item) => (item?.role === "user" || item?.role === "assistant") && String(item?.text || "").trim())
    .slice(-6)
    .map((item) => `${item.role === "assistant" ? "Assistant" : "Teacher"}: ${String(item.text || "").trim()}`)
    .join("\n");

  return [
    `Teacher question: ${question}`,
    transcript ? `Recent conversation:\n${transcript}` : "",
    "Analytics JSON:",
    JSON.stringify(context),
  ].filter(Boolean).join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_ANALYTICS_MODEL") || "gpt-4.1-mini";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !openAiKey) {
      return json({ error: "Missing required server secrets." }, 500);
    }

    const body = await req.json() as ChatRequest;
    const question = String(body?.question || "").trim();
    const scopeType = (body?.scopeType || "overview") as ScopeType;
    const scopeId = body?.scopeId ? String(body.scopeId) : null;
    const scopeLabel = body?.scopeLabel ? String(body.scopeLabel) : null;
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!question) {
      return json({ error: "Question is required." }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? String(authHeader.slice(7) || "").trim()
      : "";
    const accessToken = String(body?.accessToken || "").trim();
    const jwt = bearerToken || accessToken;

    if (!jwt) {
      return json({ error: "Teacher authentication is required for analytics chat." }, 401);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
    const teacherId = String(authData?.user?.id || "");
    if (authError || !teacherId) {
      return json({ error: "Your teacher session could not be verified. Please sign in again." }, 401);
    }

    if (scopeType === "assignment" && scopeId && !isUuid(scopeId)) {
      return json({ error: "Assignment scope must use a valid assignment id." }, 400);
    }
    if (scopeType === "class" && scopeId && !isUuid(scopeId)) {
      return json({ error: "Class scope must use a valid class id." }, 400);
    }
    if (scopeType === "pupil" && scopeId && !isUuid(scopeId)) {
      return json({ error: "Pupil scope must use a valid pupil id." }, 400);
    }

    let classIds: string[] = [];
    let scopedAssignments: Array<Record<string, unknown>> = [];

    if (scopeType === "assignment" && scopeId) {
      const canViewAssignment = await ensureScopeVisible(serviceClient, "can_view_assignment", teacherId, scopeId);
      if (!canViewAssignment) {
        return json({ error: "You do not have access to that assignment." }, 403);
      }

      const { data: assignmentRows, error: scopedAssignmentError } = await serviceClient
        .from("assignments_v2")
        .select(`
          id,
          class_id,
          test_id,
          created_at,
          end_at,
          tests (
            title
          )
        `)
        .eq("id", scopeId)
        .limit(1);
      if (scopedAssignmentError) throw scopedAssignmentError;

      scopedAssignments = Array.isArray(assignmentRows) ? assignmentRows : [];
      classIds = Array.from(new Set(scopedAssignments.map((item) => String(item?.class_id || "")).filter(Boolean)));
      if (!classIds.length) {
        return json({ error: "You do not have access to that assignment." }, 403);
      }
    } else if (scopeType === "class" && scopeId) {
      classIds = await resolveVisibleClassIds(serviceClient, teacherId, { classId: scopeId });
      if (!classIds.length) {
        return json({ error: "You do not have access to that class." }, 403);
      }
    } else if (scopeType === "year_group" && scopeId) {
      classIds = await resolveVisibleClassIds(serviceClient, teacherId, { yearGroup: scopeId });
      if (!classIds.length) {
        return json({ error: "You do not have access to that year group." }, 403);
      }
    } else if (scopeType === "pupil" && scopeId) {
      const canViewPupil = await ensureScopeVisible(serviceClient, "can_view_pupil", teacherId, scopeId);
      if (!canViewPupil) {
        return json({ error: "You do not have access to that pupil." }, 403);
      }
      const accessibleClassIds = await resolveVisibleClassIds(serviceClient, teacherId, {});
      const { data: pupilMemberships, error: pupilMembershipError } = accessibleClassIds.length
        ? await serviceClient
          .from("pupil_classes")
          .select("class_id, pupil_id, active")
          .in("class_id", accessibleClassIds)
          .eq("pupil_id", scopeId)
          .eq("active", true)
        : { data: [], error: null };
      if (pupilMembershipError) throw pupilMembershipError;
      classIds = Array.from(new Set((pupilMemberships || []).map((item) => String(item?.class_id || "")).filter(Boolean)));
    } else {
      classIds = await resolveVisibleClassIds(serviceClient, teacherId, {});
    }

    const { data: classes, error: classError } = classIds.length
      ? await serviceClient
        .from("classes")
        .select("id, name, year_group")
        .in("id", classIds)
        .order("name", { ascending: true })
      : { data: [], error: null };
    if (classError) throw classError;

    const assignmentBaseQuery = serviceClient
      .from("assignments_v2")
      .select(`
        id,
        class_id,
        test_id,
        created_at,
        end_at,
        tests (
          title
        )
      `)
      .order("created_at", { ascending: false })
      .limit(300);

    const assignmentResult = scopeType === "assignment" && scopeId
      ? { data: scopedAssignments, error: null }
      : classIds.length
        ? await assignmentBaseQuery.in("class_id", classIds)
        : { data: [], error: null };

    const { data: assignments, error: assignmentError } = assignmentResult;
    if (assignmentError) throw assignmentError;

    const assignmentIds = (assignments || []).map((item) => String(item.id || "")).filter(Boolean);

    const membershipBaseQuery = classIds.length
      ? serviceClient
        .from("pupil_classes")
        .select("class_id, pupil_id, active")
        .in("class_id", classIds)
        .eq("active", true)
      : null;
    const membershipResult = membershipBaseQuery
      ? (scopeType === "pupil" && scopeId
        ? await membershipBaseQuery.eq("pupil_id", scopeId)
        : await membershipBaseQuery)
      : { data: [], error: null };
    const { data: memberships, error: membershipError } = membershipResult;
    if (membershipError) throw membershipError;

    const pupilIds = Array.from(new Set((memberships || []).map((item) => String(item.pupil_id || "")).filter(Boolean)));
    const pupilQuery = pupilIds.length
      ? serviceClient
        .from("pupils")
        .select("id, first_name, surname, username")
        .in("id", scopeType === "pupil" && scopeId ? [scopeId] : pupilIds)
      : null;
    const pupilResult = pupilQuery ? await pupilQuery : { data: [], error: null };
    if (pupilResult.error) throw pupilResult.error;

    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const attemptBaseQuery = serviceClient
      .from("attempts")
      .select("assignment_id, pupil_id, test_word_id, correct, attempt_number, created_at, focus_grapheme, pattern_type, word_text, target_graphemes")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .range(0, 999);

    const attemptResult = assignmentIds.length
      ? await (
        scopeType === "pupil" && scopeId
          ? attemptBaseQuery.in("assignment_id", assignmentIds).eq("pupil_id", scopeId)
          : attemptBaseQuery.in("assignment_id", assignmentIds)
      )
      : { data: [], error: null };

    const { data: attempts, error: attemptError } = attemptResult;
    if (attemptError) throw attemptError;

    const realContext = buildAnalyticsContext({
      classes: classes || [],
      assignments: assignments || [],
      memberships: memberships || [],
      pupils: pupilResult.data || [],
      attempts: (attempts || []) as AttemptRow[],
      scopeType,
      scopeId,
      scopeLabel,
    });

    const context = realContext.counts.latestWordOutcomes
      ? realContext
      : buildMockAnalyticsContext({
        classes: classes || [],
        assignments: assignments || [],
        memberships: memberships || [],
        pupils: pupilResult.data || [],
        scopeType,
        scopeId,
        scopeLabel,
      });

    const messages = buildMessages(question, context, history);
    let answer = "";

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: messages.system }],
          },
          ...messages.input,
        ],
      }),
    });

    const openAiData = await openAiResponse.json();
    if (openAiResponse.ok && openAiData?.output_text) {
      answer = openAiData.output_text;
    } else {
      const legacyResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: messages.system },
            { role: "user", content: buildLegacyUserPrompt(question, context, history) },
          ],
        }),
      });
      const legacyData = await legacyResponse.json();
      if (legacyResponse.ok) {
        answer = String(legacyData?.choices?.[0]?.message?.content || "").trim();
      }
      if (!answer) {
        answer = buildFallbackAnswer(question, context);
      }
    }

    return json({
      answer,
      context,
      model,
    });
  } catch (error) {
    console.error("teacher-analytics-chat error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
