import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

function loadDbHelpers({ invokeImpl }) {
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
  const context = {
    console,
    module: { exports: {} },
    exports: {},
    globalThis: {},
    supabase: {
      functions: {
        invoke: async (name, options) => {
          calls.push({ name, options });
          return invokeImpl(name, options);
        },
      },
    },
  };
  vm.runInNewContext(transformedSource, context, { filename: sourcePath });
  return { ...context.module.exports, calls };
}

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const PUPIL_ID = "11111111-1111-4111-8111-111111111111";

test("wrapper sends only pupil id to the personalised provisioning function", async () => {
  const {
    provisionWaitingPersonalisedAssignmentAfterBaseline,
    calls,
  } = loadDbHelpers({
    invokeImpl: async () => ({
      data: {
        status: "provisioned",
        assignmentId: "22222222-2222-4222-8222-222222222222",
      },
      error: null,
    }),
  });

  const result = await provisionWaitingPersonalisedAssignmentAfterBaseline({
    pupilId: ` ${PUPIL_ID} `,
  });

  assert.deepEqual(plain(calls), [{
    name: "provision-personalised-assignment",
    options: { body: { pupilId: PUPIL_ID } },
  }]);
  assert.deepEqual(plain(result), {
    ok: true,
    status: "provisioned",
    provisioned: true,
    assignmentId: "22222222-2222-4222-8222-222222222222",
    error: "",
  });
});

test("extra challenge wrapper sends explicit action and pupil id", async () => {
  const {
    provisionExtraChallengeAssignment,
    calls,
  } = loadDbHelpers({
    invokeImpl: async () => ({
      data: {
        status: "provisioned",
        assignmentId: "33333333-3333-4333-8333-333333333333",
      },
      error: null,
    }),
  });

  const result = await provisionExtraChallengeAssignment({
    pupilId: ` ${PUPIL_ID} `,
  });

  assert.deepEqual(plain(calls), [{
    name: "provision-personalised-assignment",
    options: {
      body: {
        action: "extra_challenge",
        pupilId: PUPIL_ID,
      },
    },
  }]);
  assert.deepEqual(plain(result), {
    ok: true,
    status: "provisioned",
    provisioned: true,
    alreadyActive: false,
    assignmentId: "33333333-3333-4333-8333-333333333333",
    error: "",
  });
});

test("wrapper treats no-op statuses as safe dashboard outcomes", async () => {
  const {
    provisionWaitingPersonalisedAssignmentAfterBaseline,
  } = loadDbHelpers({
    invokeImpl: async () => ({
      data: { status: "nothing_waiting" },
      error: null,
    }),
  });

  const result = await provisionWaitingPersonalisedAssignmentAfterBaseline({ pupilId: PUPIL_ID });

  assert.deepEqual(plain(result), {
    ok: true,
    status: "nothing_waiting",
    provisioned: false,
    assignmentId: "",
    error: "",
  });
});

test("wrapper validates missing pupil id without calling the Edge Function", async () => {
  const {
    provisionWaitingPersonalisedAssignmentAfterBaseline,
    calls,
  } = loadDbHelpers({
    invokeImpl: async () => {
      throw new Error("Should not be called");
    },
  });

  const result = await provisionWaitingPersonalisedAssignmentAfterBaseline({ pupilId: " " });

  assert.equal(calls.length, 0);
  assert.equal(result.ok, false);
  assert.equal(result.status, "invalid_pupil");
  assert.equal(result.provisioned, false);
  assert.equal(result.assignmentId, "");
});

test("wrapper normalizes invoke errors without throwing", async () => {
  const {
    provisionWaitingPersonalisedAssignmentAfterBaseline,
  } = loadDbHelpers({
    invokeImpl: async () => ({
      data: null,
      error: { message: "Edge function unavailable" },
    }),
  });

  const result = await provisionWaitingPersonalisedAssignmentAfterBaseline({ pupilId: PUPIL_ID });

  assert.equal(result.ok, false);
  assert.equal(result.status, "generation_failed");
  assert.equal(result.provisioned, false);
  assert.equal(result.assignmentId, "");
  assert.match(result.error, /Edge function unavailable/);
});

test("wrapper normalizes thrown errors without throwing", async () => {
  const {
    provisionWaitingPersonalisedAssignmentAfterBaseline,
  } = loadDbHelpers({
    invokeImpl: async () => {
      throw new Error("Network unavailable");
    },
  });

  const result = await provisionWaitingPersonalisedAssignmentAfterBaseline({ pupilId: PUPIL_ID });

  assert.equal(result.ok, false);
  assert.equal(result.status, "generation_failed");
  assert.equal(result.provisioned, false);
  assert.equal(result.assignmentId, "");
  assert.match(result.error, /Network unavailable/);
});

test("extra challenge wrapper normalizes already active with assignment id", async () => {
  const {
    provisionExtraChallengeAssignment,
  } = loadDbHelpers({
    invokeImpl: async () => ({
      data: {
        status: "already_active",
        assignmentId: "44444444-4444-4444-8444-444444444444",
      },
      error: null,
    }),
  });

  const result = await provisionExtraChallengeAssignment({ pupilId: PUPIL_ID });

  assert.equal(result.ok, true);
  assert.equal(result.status, "already_active");
  assert.equal(result.alreadyActive, true);
  assert.equal(result.assignmentId, "44444444-4444-4444-8444-444444444444");
});

test("extra challenge wrapper normalizes not eligible and not enough evidence", async () => {
  const first = loadDbHelpers({
    invokeImpl: async () => ({
      data: { status: "not_eligible" },
      error: null,
    }),
  });
  const notEligible = await first.provisionExtraChallengeAssignment({ pupilId: PUPIL_ID });

  const second = loadDbHelpers({
    invokeImpl: async () => ({
      data: { status: "not_enough_evidence" },
      error: null,
    }),
  });
  const notEnoughEvidence = await second.provisionExtraChallengeAssignment({ pupilId: PUPIL_ID });

  assert.equal(notEligible.ok, false);
  assert.equal(notEligible.status, "not_eligible");
  assert.equal(notEligible.assignmentId, "");
  assert.equal(notEnoughEvidence.ok, false);
  assert.equal(notEnoughEvidence.status, "not_enough_evidence");
  assert.equal(notEnoughEvidence.assignmentId, "");
});

test("extra challenge wrapper normalizes invoke failures to error", async () => {
  const {
    provisionExtraChallengeAssignment,
  } = loadDbHelpers({
    invokeImpl: async () => ({
      data: null,
      error: { message: "Edge function unavailable" },
    }),
  });

  const result = await provisionExtraChallengeAssignment({ pupilId: PUPIL_ID });

  assert.equal(result.ok, false);
  assert.equal(result.status, "error");
  assert.equal(result.provisioned, false);
  assert.equal(result.assignmentId, "");
  assert.match(result.error, /Edge function unavailable/);
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}
