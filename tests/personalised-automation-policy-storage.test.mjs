import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadBrowserModule } from "./load-browser-module.mjs";

const autoAssignHelpers = await loadBrowserModule("../js/autoAssignPolicy.js", import.meta.url);

const POLICY_TABLE = "personalised_automation_policies";
const TARGET_TABLE = "personalised_automation_policy_targets";
const EVENT_TABLE = "personalised_automation_policy_events";
const TEACHER_ROLE_TABLE = "teacher_app_roles";
const TEACHER_ID = "11111111-1111-4111-8111-111111111111";
const SCHOOL_ID = "22222222-2222-4222-8222-222222222222";
const POLICY_ID = "33333333-3333-4333-8333-333333333333";
const CLASS_ID = "44444444-4444-4444-8444-444444444444";

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
  const context = {
    ...autoAssignHelpers,
    console: {
      ...console,
      warn() {},
    },
    module: { exports: {} },
    exports: {},
    globalThis: {},
    supabase: createMockSupabase({ calls, ...options }),
  };
  vm.runInNewContext(transformedSource, context, { filename: sourcePath });
  return { ...context.module.exports, calls };
}

function createMockSupabase({ calls, policyUpdateError = null } = {}) {
  return {
    auth: {
      async getUser() {
        calls.push({ type: "auth.getUser" });
        return {
          data: {
            user: {
              id: TEACHER_ID,
              email: "teacher@example.com",
              user_metadata: { full_name: "Teacher One" },
            },
          },
          error: null,
        };
      },
    },
    async rpc(name, args) {
      calls.push({ type: "rpc", name, args });
      if (name === "upsert_my_staff_profile") {
        return { data: {}, error: null };
      }
      if (name === "get_my_access_context") {
        return { data: accessContextPayload(), error: null };
      }
      return { data: null, error: null };
    },
    from(table) {
      return createQuery({ table, calls, policyUpdateError });
    },
  };
}

function createQuery({ table, calls, policyUpdateError }) {
  const call = {
    type: "query",
    table,
    operation: "select",
    payload: null,
    filters: [],
    inFilters: [],
    isFilters: [],
    orFilters: [],
    orders: [],
    selectColumns: "",
    singleMode: "",
  };
  calls.push(call);

  const query = {
    select(columns) {
      call.selectColumns = String(columns || "");
      return this;
    },
    update(payload) {
      call.operation = "update";
      call.payload = payload;
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
    delete() {
      call.operation = "delete";
      return this;
    },
    eq(column, value) {
      call.filters.push({ op: "eq", column, value });
      return this;
    },
    in(column, value) {
      call.inFilters.push({ column, value });
      return this;
    },
    is(column, value) {
      call.isFilters.push({ column, value });
      return this;
    },
    or(value) {
      call.orFilters.push(String(value || ""));
      return this;
    },
    order(column, options) {
      call.orders.push({ column, options });
      return this;
    },
    maybeSingle() {
      call.singleMode = "maybeSingle";
      return Promise.resolve(resolveQueryCall(call, { policyUpdateError }));
    },
    single() {
      call.singleMode = "single";
      return Promise.resolve(resolveQueryCall(call, { policyUpdateError }));
    },
    then(resolve, reject) {
      return Promise.resolve(resolveQueryCall(call, { policyUpdateError })).then(resolve, reject);
    },
  };
  return query;
}

function resolveQueryCall(call, { policyUpdateError }) {
  if (call.table === TEACHER_ROLE_TABLE) {
    return { data: { app_role: "central_owner" }, error: null };
  }

  if (call.table === "classes") {
    const ids = call.inFilters.find((item) => item.column === "id")?.value || [];
    return {
      data: ids.map((id) => ({ id, class_type: "form" })),
      error: null,
    };
  }

  if (call.table === POLICY_TABLE) {
    if (call.operation === "update") {
      if (policyUpdateError) return { data: null, error: policyUpdateError };
      return { data: policyRow(call.payload), error: null };
    }
    if (call.operation === "insert") {
      return { data: policyRow({ id: "new-policy-id", ...(call.payload?.[0] || {}) }), error: null };
    }
    if (call.operation === "delete") {
      return { data: null, error: null };
    }
    return { data: [policyRow()], error: null };
  }

  if (call.table === TARGET_TABLE) {
    if (call.operation === "select") {
      const policyId = call.filters.find((item) => item.column === "policy_id")?.value;
      return {
        data: policyId === "new-policy-id" ? [] : [{ policy_id: POLICY_ID, class_id: CLASS_ID }],
        error: null,
      };
    }
    return { data: null, error: null };
  }

  if (call.table === EVENT_TABLE) {
    return { data: null, error: null };
  }

  return { data: [], error: null };
}

function accessContextPayload() {
  return {
    version: 2,
    user_id: TEACHER_ID,
    legacy: {
      teacher_app_role: "central_owner",
      is_legacy_central_owner: true,
    },
    roles: {
      admin: true,
      teacher: true,
    },
    capabilities: {
      can_manage_automation: true,
    },
    scopes: {
      school: true,
      year_groups: [],
      departments: [],
      class_ids: [],
    },
    role_scopes: {},
    data_health: {
      unmapped_subject_class_count: 0,
    },
    active_school_id: SCHOOL_ID,
    default_school_id: SCHOOL_ID,
    schools: [{
      id: SCHOOL_ID,
      slug: "legacy-default",
      name: "Legacy School",
      is_legacy_default: true,
    }],
  };
}

function policyRow(overrides = {}) {
  return {
    id: POLICY_ID,
    teacher_id: TEACHER_ID,
    name: "Year 7 weekly",
    description: null,
    active: true,
    policy_type: "regular_personalised",
    assignment_length: 10,
    bee_length_mode: null,
    support_preset: "balanced",
    allow_starter_fallback: true,
    frequency: "weekly",
    selected_weekdays: ["monday"],
    selected_weekdays_week_1: ["monday"],
    selected_weekdays_week_2: [],
    start_date: "2024-01-01",
    end_date: null,
    archived_at: null,
    archived_by: null,
    created_by: TEACHER_ID,
    updated_by: TEACHER_ID,
    created_at: "2026-05-01T09:00:00.000Z",
    updated_at: "2026-05-01T09:00:00.000Z",
    ...overrides,
  };
}

function policyInput(overrides = {}) {
  return {
    id: "",
    name: "Year 7 weekly",
    description: "",
    active: true,
    policy_type: "regular_personalised",
    assignment_length: 10,
    support_preset: "balanced",
    allow_starter_fallback: true,
    frequency: "weekly",
    selected_weekdays: ["monday"],
    selected_weekdays_week_1: ["monday"],
    selected_weekdays_week_2: [],
    start_date: "2024-01-01",
    end_date: "",
    target_class_ids: [],
    ...overrides,
  };
}

function assertNoSchoolFilter(call) {
  assert.deepEqual(call.orFilters, []);
  assert.equal(call.filters.some((filter) => filter.column === "school_id"), false);
}

function assertHasOwnerFilters(call) {
  assert.equal(call.filters.some((filter) => filter.column === "id" && filter.value), true);
  assert.equal(call.filters.some((filter) => filter.column === "teacher_id" && filter.value === TEACHER_ID), true);
}

function getPolicyMutation(calls, operation) {
  const matches = calls.filter((call) => call.table === POLICY_TABLE && call.operation === operation);
  assert.equal(matches.length, 1);
  return matches[0];
}

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

test("existing policy save does not apply school_id filter to policy update", async () => {
  const { upsertPersonalisedAutomationPolicy, calls } = loadDbHelpers();

  await upsertPersonalisedAutomationPolicy(policyInput({
    id: POLICY_ID,
    target_class_ids: [CLASS_ID],
  }));

  const updateCall = getPolicyMutation(calls, "update");
  assertNoSchoolFilter(updateCall);
  assertHasOwnerFilters(updateCall);
  assert.equal(
    calls
      .filter((call) => call.table === POLICY_TABLE && call.operation === "select")
      .some((call) => call.orFilters.some((value) => value.includes("school_id.eq"))),
    true,
  );
});

test("new policy insert still writes active school id", async () => {
  const { upsertPersonalisedAutomationPolicy, calls } = loadDbHelpers();

  await upsertPersonalisedAutomationPolicy(policyInput());

  const insertCall = getPolicyMutation(calls, "insert");
  assert.equal(insertCall.payload?.[0]?.school_id, SCHOOL_ID);
});

test("archive and restore do not apply school_id filter to policy update", async () => {
  const { setPersonalisedAutomationPolicyArchived, calls } = loadDbHelpers();

  await setPersonalisedAutomationPolicyArchived({ policyId: POLICY_ID, archived: true });

  const updateCall = getPolicyMutation(calls, "update");
  assertNoSchoolFilter(updateCall);
  assertHasOwnerFilters(updateCall);
});

test("delete does not apply school_id filter to policy delete", async () => {
  const { deletePersonalisedAutomationPolicy, calls } = loadDbHelpers();

  await deletePersonalisedAutomationPolicy(POLICY_ID);

  const deleteCall = getPolicyMutation(calls, "delete");
  assertNoSchoolFilter(deleteCall);
  assertHasOwnerFilters(deleteCall);
});

test("school_id missing-column errors do not become migration warning", async () => {
  const { upsertPersonalisedAutomationPolicy } = loadDbHelpers({
    policyUpdateError: {
      code: "42703",
      message: "column personalised_automation_policies.school_id does not exist",
    },
  });

  await assert.rejects(
    () => upsertPersonalisedAutomationPolicy(policyInput({
      id: POLICY_ID,
      target_class_ids: [CLASS_ID],
    })),
    (error) => {
      assert.match(error.message, /school filter was rejected/);
      assert.equal(error.message.includes("Run the latest Supabase migration"), false);
      return true;
    },
  );
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}

console.log(`Passed ${TESTS.length} personalised automation policy storage tests.`);
