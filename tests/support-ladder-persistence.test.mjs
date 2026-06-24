import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import * as evidenceHelpers from "../js/supportLadderEvidence.js";

const ATTEMPTS_TABLE = "attempts";
const STATUS_TABLE = "assignment_pupil_statuses";

const IDS = {
  teacher: "11111111-1111-4111-8111-111111111111",
  class: "22222222-2222-4222-8222-222222222222",
  pupil: "33333333-3333-4333-8333-333333333333",
  assignment: "44444444-4444-4444-8444-444444444444",
  test: "55555555-5555-4555-8555-555555555555",
  word: "66666666-6666-4666-8666-666666666666",
  target: "77777777-7777-4777-8777-777777777777",
};

function loadDbHelpers(options = {}) {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const sourcePath = path.resolve(testDir, "../js/db.js");
  let source = readFileSync(sourcePath, "utf8");

  source = source.replace(/import\s+[\s\S]*?\s+from\s+["'][^"']+["'];?\s*/g, "");

  const exportNames = [];
  source = source.replace(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    exportNames.push(name);
    return `async function ${name}`;
  });
  source = source.replace(/export function\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    exportNames.push(name);
    return `function ${name}`;
  });
  source = source.replace(/export const\s+([A-Za-z0-9_]+)/g, (_match, name) => {
    exportNames.push(name);
    return `const ${name}`;
  });
  source = source.replace(/export\s*\{([^}]+)\};?\s*/g, (_match, names) => {
    for (const item of String(names || "").split(",")) {
      const [localName] = item.split(/\s+as\s+/i).map((part) => String(part || "").trim());
      if (localName) exportNames.push(localName);
    }
    return "";
  });

  const transformedSource = `${source}
module.exports = {
  ${[...new Set(exportNames)].join(",\n  ")}
};`;

  const calls = [];
  const state = {
    attempts: options.existingAttempts ? [...options.existingAttempts] : [],
    statuses: options.existingStatuses ? [...options.existingStatuses] : [],
    insertResults: options.insertResults ? [...options.insertResults] : [],
  };
  const context = {
    ...evidenceHelpers,
    console: {
      ...console,
      log() {},
      warn() {},
    },
    module: { exports: {} },
    exports: {},
    globalThis: {},
    supabase: createMockSupabase({ calls, state }),
  };
  vm.runInNewContext(transformedSource, context, { filename: sourcePath });
  return { ...context.module.exports, calls, state };
}

function createMockSupabase({ calls, state }) {
  return {
    from(table) {
      return createQuery({ table, calls, state });
    },
  };
}

function createQuery({ table, calls, state }) {
  const call = {
    type: "query",
    table,
    operation: "select",
    payload: null,
    filters: [],
    orders: [],
    selectColumns: "",
    singleMode: "",
    upsertOptions: null,
  };
  calls.push(call);

  const query = {
    select(columns) {
      call.selectColumns = String(columns || "");
      return this;
    },
    insert(payload) {
      call.operation = "insert";
      call.payload = payload;
      return this;
    },
    upsert(payload, options) {
      call.operation = "upsert";
      call.payload = payload;
      call.upsertOptions = options;
      return this;
    },
    eq(column, value) {
      call.filters.push({ column, value });
      return this;
    },
    in(column, value) {
      call.filters.push({ op: "in", column, value });
      return this;
    },
    order(column, options) {
      call.orders.push({ column, options });
      return this;
    },
    single() {
      call.singleMode = "single";
      return Promise.resolve(resolveQueryCall(call, state));
    },
    then(resolve, reject) {
      return Promise.resolve(resolveQueryCall(call, state)).then(resolve, reject);
    },
  };

  return query;
}

function resolveQueryCall(call, state) {
  if (call.table === ATTEMPTS_TABLE) {
    if (call.operation === "insert") {
      const next = state.insertResults.length
        ? state.insertResults.shift()
        : { error: null };
      if (!next.error) {
        state.attempts.push(...plain(call.payload || []));
      }
      return { data: null, error: next.error || null };
    }
    return {
      data: state.attempts.filter((row) => {
        const assignmentFilter = call.filters.find((item) => item.column === "assignment_id");
        const pupilFilter = call.filters.find((item) => item.column === "pupil_id");
        return (!assignmentFilter || row.assignment_id === assignmentFilter.value)
          && (!pupilFilter || row.pupil_id === pupilFilter.value);
      }),
      error: null,
    };
  }

  if (call.table === STATUS_TABLE) {
    if (call.operation === "upsert") {
      const row = plain(call.payload?.[0] || {});
      const existingIndex = state.statuses.findIndex((item) =>
        item.assignment_id === row.assignment_id
        && item.pupil_id === row.pupil_id
      );
      if (existingIndex >= 0) state.statuses[existingIndex] = row;
      else state.statuses.push(row);
      return { data: row, error: null };
    }
    return {
      data: state.statuses.filter((row) => {
        const assignmentFilter = call.filters.find((item) => item.column === "assignment_id");
        const pupilFilter = call.filters.find((item) => item.column === "pupil_id");
        const assignmentMatches = !assignmentFilter
          || (assignmentFilter.op === "in"
            ? assignmentFilter.value.includes(row.assignment_id)
            : row.assignment_id === assignmentFilter.value);
        return assignmentMatches
          && (!pupilFilter || row.pupil_id === pupilFilter.value);
      }),
      error: null,
    };
  }

  return { data: [], error: null };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function ladderResult(overrides = {}) {
  return {
    wordId: IDS.word,
    baseTestWordId: IDS.word,
    word: "phase",
    correctSpelling: "phase",
    typed: "phase",
    correct: true,
    attemptsUsed: 1,
    attemptsAllowed: 3,
    completed: true,
    questionType: "full_recall",
    deliveryModel: "support_ladder",
    supportPreset: "balanced",
    supportState: "independent",
    evidenceCategory: "correct_first_time",
    supportActions: [],
    ...overrides,
  };
}

function legacyResult(overrides = {}) {
  return {
    wordId: IDS.word,
    baseTestWordId: IDS.word,
    word: "plain",
    correctSpelling: "plain",
    typed: "plain",
    correct: true,
    attemptsUsed: 1,
    attemptsAllowed: 2,
    completed: true,
    questionType: "full_recall",
    ...overrides,
  };
}

function completionArgs(result) {
  return {
    teacherId: IDS.teacher,
    assignmentId: IDS.assignment,
    classId: IDS.class,
    testId: IDS.test,
    pupilId: IDS.pupil,
    completedAt: "2026-06-24T10:00:00.000Z",
    result,
  };
}

function progressArgs(progress) {
  return {
    teacherId: IDS.teacher,
    assignmentId: IDS.assignment,
    classId: IDS.class,
    testId: IDS.test,
    pupilId: IDS.pupil,
    savedAt: "2026-06-24T10:00:00.000Z",
    progress,
  };
}

function attemptArgs(overrides = {}) {
  return {
    pupilId: IDS.pupil,
    assignmentId: IDS.assignment,
    testId: IDS.test,
    testWordId: IDS.word,
    assignmentTargetId: null,
    mode: "full_recall",
    typed: "phase",
    correct: true,
    attemptNumber: 1,
    attemptsAllowed: 3,
    wordText: "phase",
    wordSource: "base",
    attemptSource: "teacher_assigned",
    targetGraphemes: ["ph", "a", "se"],
    focusGrapheme: "ph",
    patternType: "digraph",
    ...overrides,
  };
}

function getStatusPayload(calls) {
  const upserts = calls.filter((call) => call.table === STATUS_TABLE && call.operation === "upsert");
  assert.equal(upserts.length, 1);
  return upserts[0].payload[0];
}

function getAttemptPayloads(calls) {
  return calls
    .filter((call) => call.table === ATTEMPTS_TABLE && call.operation === "insert")
    .map((call) => call.payload[0]);
}

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

test("old legacy result JSON remains accepted unchanged", async () => {
  const { markAssignmentComplete, calls } = loadDbHelpers();
  const row = legacyResult();

  await markAssignmentComplete(completionArgs({
    totalWords: 1,
    totalCorrect: 1,
    averageAttempts: 1,
    results: [row],
  }));

  const payload = getStatusPayload(calls);
  assert.equal(payload.result_json[0].word, row.word);
  assert.equal(payload.result_json[0].correct, true);
  assert.equal(Object.hasOwn(payload.result_json[0], "deliveryModel"), false);
  assert.equal(Object.hasOwn(payload.result_json[0], "evidenceCategory"), false);
  assert.equal(payload.correct_words, 1);
  assert.equal(payload.score_rate, 1);
  assert.equal(payload.independent_first_correct_words, null);
  assert.equal(payload.headline_attempted_words, null);
});

test("snake_case and camelCase ladder fields normalize into camelCase result JSON", async () => {
  const { markAssignmentComplete, calls } = loadDbHelpers();

  await markAssignmentComplete(completionArgs({
    totalWords: 2,
    results: [
      ladderResult({
        delivery_model: "support_ladder",
        support_preset: "balanced",
        support_state: "retry",
        evidence_category: "correct_after_retry",
        support_actions: ["replay_word"],
        deliveryModel: undefined,
        supportPreset: undefined,
        supportState: undefined,
        evidenceCategory: undefined,
        supportActions: undefined,
        attemptsUsed: 2,
      }),
    ],
  }));

  const [row] = getStatusPayload(calls).result_json;
  assert.equal(row.deliveryModel, "support_ladder");
  assert.equal(row.supportPreset, "balanced");
  assert.equal(row.supportState, "retry");
  assert.equal(row.evidenceCategory, "correct_after_retry");
  assert.deepEqual(row.supportActions, ["replay_word"]);
  assert.equal(Object.hasOwn(row, "delivery_model"), false);
});

test("progress result sanitization preserves ladder evidence", async () => {
  const { saveAssignmentProgress, calls } = loadDbHelpers();

  await saveAssignmentProgress(progressArgs({
    totalWords: 1,
    itemStates: [ladderResult({
      completed: false,
      correct: false,
      attemptsUsed: 1,
      supportState: "retry",
      evidenceCategory: "correct_after_retry",
      supportActions: ["replay_word"],
    })],
  }));

  const [row] = getStatusPayload(calls).result_json;
  assert.equal(row.deliveryModel, "support_ladder");
  assert.equal(row.supportState, "retry");
  assert.equal(row.evidenceCategory, "correct_after_retry");
  assert.deepEqual(row.supportActions, ["replay_word"]);
});

test("final result sanitization preserves ladder evidence", async () => {
  const { markAssignmentComplete, calls } = loadDbHelpers();

  await markAssignmentComplete(completionArgs({
    totalWords: 1,
    results: [ladderResult({
      supportState: "supported",
      evidenceCategory: "correct_with_support",
      supportActions: ["segmented_input"],
    })],
  }));

  const [row] = getStatusPayload(calls).result_json;
  assert.equal(row.deliveryModel, "support_ladder");
  assert.equal(row.supportState, "supported");
  assert.equal(row.evidenceCategory, "correct_with_support");
  assert.deepEqual(row.supportActions, ["segmented_input"]);
});

test("access issue remains null-correct and may have an empty typed value", async () => {
  const { markAssignmentComplete, calls } = loadDbHelpers();

  await markAssignmentComplete(completionArgs({
    totalWords: 1,
    results: [ladderResult({
      typed: "",
      correct: null,
      supportState: "access_issue",
      evidenceCategory: "access_issue",
      supportActions: ["clarification_sentence"],
    })],
  }));

  const [row] = getStatusPayload(calls).result_json;
  assert.equal(row.correct, null);
  assert.equal(row.typed, "");
  assert.equal(row.evidenceCategory, "access_issue");
  assert.equal(getStatusPayload(calls).correct_words, 0);
  assert.equal(getStatusPayload(calls).headline_attempted_words, 0);
});

test("legacy insert fallback behaviour is unchanged", async () => {
  const { pupilRecordAttempt, calls } = loadDbHelpers({
    insertResults: [
      { error: { code: "42703", message: "unknown column" } },
      { error: null },
    ],
  });

  const inserted = await pupilRecordAttempt(attemptArgs());
  const payloads = getAttemptPayloads(calls);

  assert.equal(inserted.word_text, "phase");
  assert.equal(payloads.length, 2);
  assert.equal(Object.hasOwn(payloads[1], "attempts_allowed"), true);
  assert.equal(Object.hasOwn(payloads[1], "delivery_model"), false);
});

test("ladder insert variants retain evidence fields", async () => {
  const { pupilRecordAttempt, calls } = loadDbHelpers({
    insertResults: [
      { error: { code: "42703", message: "unknown column" } },
      { error: { code: "42703", message: "unknown column" } },
      { error: null },
    ],
  });

  const inserted = await pupilRecordAttempt(attemptArgs({
    deliveryModel: "support_ladder",
    supportState: "supported",
    evidenceCategory: "correct_with_support",
    supportActions: ["segmented_input"],
  }));

  assert.equal(inserted.delivery_model, "support_ladder");
  for (const payload of getAttemptPayloads(calls)) {
    assert.equal(payload.delivery_model, "support_ladder");
    assert.equal(payload.support_state, "supported");
    assert.equal(payload.evidence_category, "correct_with_support");
    assert.deepEqual(payload.support_actions, ["segmented_input"]);
  }
});

test("evidence-less fallback insert is not treated as success for ladder attempts", async () => {
  const { pupilRecordAttempt, state } = loadDbHelpers({
    insertResults: Array.from({ length: 7 }, () => ({
      error: { code: "42703", message: "unknown evidence column" },
    })),
  });

  const inserted = await pupilRecordAttempt(attemptArgs({
    deliveryModel: "support_ladder",
    supportState: "supported",
    evidenceCategory: "correct_with_support",
    supportActions: ["segmented_input"],
  }));

  assert.equal(inserted.persisted, false);
  assert.equal(inserted.delivery_model, "support_ladder");
  assert.equal(state.attempts.length, 0);
});

test("failed ladder attempt persistence keeps full evidence in final result JSON", async () => {
  const { pupilRecordAttempt, markAssignmentComplete, calls } = loadDbHelpers({
    insertResults: Array.from({ length: 7 }, () => ({
      error: { code: "42703", message: "unknown evidence column" },
    })),
  });

  await pupilRecordAttempt(attemptArgs({
    deliveryModel: "support_ladder",
    supportState: "supported",
    evidenceCategory: "correct_with_support",
    supportActions: ["segmented_input"],
  }));
  await markAssignmentComplete(completionArgs({
    totalWords: 1,
    results: [ladderResult({
      supportState: "supported",
      evidenceCategory: "correct_with_support",
      supportActions: ["segmented_input"],
    })],
  }));

  const [row] = getStatusPayload(calls).result_json;
  assert.equal(row.deliveryModel, "support_ladder");
  assert.equal(row.evidenceCategory, "correct_with_support");
  assert.deepEqual(row.supportActions, ["segmented_input"]);
});

test("reconciliation detects missing ladder evidence", async () => {
  const { reconcileAssignmentResultAttempts, calls } = loadDbHelpers({
    existingAttempts: [{
      assignment_id: IDS.assignment,
      pupil_id: IDS.pupil,
      test_id: IDS.test,
      test_word_id: IDS.word,
      typed: "phase",
      correct: true,
      attempt_number: 1,
      delivery_model: "support_ladder",
      support_state: null,
      evidence_category: null,
      support_actions: null,
      created_at: "2026-06-24T09:00:00.000Z",
    }],
  });

  const result = await reconcileAssignmentResultAttempts({
    pupilId: IDS.pupil,
    assignmentId: IDS.assignment,
    testId: IDS.test,
    results: [ladderResult()],
    attemptsAllowed: 3,
  });

  assert.equal(result.insertedCount, 1);
  assert.equal(getAttemptPayloads(calls).length, 1);
});

test("reconciliation detects conflicting ladder evidence", async () => {
  const { reconcileAssignmentResultAttempts, calls } = loadDbHelpers({
    existingAttempts: [{
      assignment_id: IDS.assignment,
      pupil_id: IDS.pupil,
      test_id: IDS.test,
      test_word_id: IDS.word,
      typed: "phase",
      correct: true,
      attempt_number: 1,
      delivery_model: "support_ladder",
      support_state: "supported",
      evidence_category: "correct_with_support",
      support_actions: ["segmented_input"],
      created_at: "2026-06-24T09:00:00.000Z",
    }],
  });

  const result = await reconcileAssignmentResultAttempts({
    pupilId: IDS.pupil,
    assignmentId: IDS.assignment,
    testId: IDS.test,
    results: [ladderResult({
      supportState: "retry",
      evidenceCategory: "correct_after_retry",
      supportActions: ["replay_word"],
    })],
    attemptsAllowed: 3,
  });

  assert.equal(result.insertedCount, 1);
  assert.equal(getAttemptPayloads(calls).length, 1);
});

test("completion summary stores raw compatibility metrics separately from headline fields", async () => {
  const { markAssignmentComplete, calls } = loadDbHelpers();

  await markAssignmentComplete(completionArgs({
    totalWords: 5,
    results: [
      ladderResult({ supportState: "independent", evidenceCategory: "correct_first_time", attemptsUsed: 1 }),
      ladderResult({ wordId: "word-2", baseTestWordId: "word-2", supportState: "retry", evidenceCategory: "correct_after_retry", attemptsUsed: 2 }),
      ladderResult({ wordId: "word-3", baseTestWordId: "word-3", supportState: "supported", evidenceCategory: "correct_with_support", supportActions: ["segmented_input"], attemptsUsed: 3 }),
      ladderResult({ wordId: "word-4", baseTestWordId: "word-4", typed: "faz", correct: false, supportState: "supported", evidenceCategory: "incorrect_with_support", supportActions: ["focus_sound"], attemptsUsed: 3 }),
      ladderResult({ wordId: "word-5", baseTestWordId: "word-5", typed: "", correct: null, supportState: "access_issue", evidenceCategory: "access_issue", supportActions: ["clarification_sentence"], attemptsUsed: 1 }),
    ],
  }));

  const payload = getStatusPayload(calls);
  assert.equal(payload.correct_words, 3);
  assert.equal(payload.score_rate, 0.75);
  assert.equal(payload.independent_first_correct_words, 1);
  assert.equal(payload.self_corrected_words, 1);
  assert.equal(payload.supported_correct_words, 1);
  assert.equal(payload.supported_incorrect_words, 1);
  assert.equal(payload.access_issue_words, 1);
  assert.equal(payload.headline_attempted_words, 4);
  assert.equal(payload.headline_correct_words, 1);
  assert.equal(payload.headline_score_rate, 0.25);
});

test("legacy summaries retain existing binary metrics", async () => {
  const { markAssignmentComplete, calls } = loadDbHelpers();

  await markAssignmentComplete(completionArgs({
    totalWords: 2,
    results: [
      legacyResult({ wordId: "word-a", baseTestWordId: "word-a", correct: true }),
      legacyResult({ wordId: "word-b", baseTestWordId: "word-b", typed: "plon", correct: false }),
    ],
  }));

  const payload = getStatusPayload(calls);
  assert.equal(payload.correct_words, 1);
  assert.equal(payload.score_rate, 0.5);
  assert.equal(payload.independent_first_correct_words, null);
  assert.equal(payload.headline_score_rate, null);
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
  console.log(`all ${TESTS.length} support ladder persistence checks passed`);
}
