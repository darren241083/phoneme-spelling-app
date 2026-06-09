import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

function loadDbHelpers() {
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

  const context = {
    console,
    module: { exports: {} },
    exports: {},
    globalThis: {},
  };
  vm.runInNewContext(transformedSource, context, { filename: sourcePath });
  return context.module.exports;
}

const {
  applyActiveSchoolFilter,
  getActiveSchoolIdFromAccessContext,
  normalizeAvailableSchools,
  normalizeSchoolSummary,
  normalizeStaffAccessContext,
  resolveActiveSchoolDetails,
  resolveStoredActiveSchoolSelection,
  withActiveSchoolId,
} = loadDbHelpers();

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function normalizeForComparison(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForComparison(item));
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = normalizeForComparison(value[key]);
        return result;
      }, {});
  }
  return value;
}

function assertJsonEqual(actual, expected) {
  assert.equal(
    JSON.stringify(normalizeForComparison(actual)),
    JSON.stringify(normalizeForComparison(expected))
  );
}

function createBasePayload() {
  return {
    version: 2,
    user_id: "user-1",
    legacy: {
      teacher_app_role: "teacher",
      is_legacy_central_owner: false,
    },
    roles: {
      admin: false,
      teacher: true,
    },
    capabilities: {
      can_create_classes: true,
      can_create_tests: true,
      can_assign_tests: true,
      can_manage_own_content: true,
    },
    scopes: {
      school: false,
      year_groups: [],
      departments: [],
      class_ids: [],
    },
    role_scopes: {},
    data_health: {
      unmapped_subject_class_count: 0,
    },
  };
}

test("old access-context payloads normalize without school fields", () => {
  const normalized = normalizeStaffAccessContext(createBasePayload(), {
    userId: "user-1",
    legacyRole: "teacher",
  });

  assert.equal(normalized.version, 2);
  assert.equal(normalized.active_school_id, null);
  assert.equal(normalized.default_school_id, null);
  assertJsonEqual(normalized.schools, []);
  assert.equal(normalized.capabilities.can_create_tests, true);
});

test("new school fields normalize into stable frontend shape", () => {
  const normalized = normalizeStaffAccessContext({
    ...createBasePayload(),
    active_school_id: "school-a",
    default_school_id: "school-legacy",
    schools: [
      { id: "school-a", slug: "school-a", name: "School A", is_legacy_default: false },
      { id: "school-a", slug: "duplicate", name: "Duplicate", is_legacy_default: false },
      { id: "school-legacy", slug: "legacy-default", name: "Legacy School", is_legacy_default: true },
      { id: "", slug: "bad", name: "Bad School" },
    ],
  }, { userId: "user-1" });

  assert.equal(normalized.active_school_id, "school-a");
  assert.equal(normalized.default_school_id, "school-legacy");
  assertJsonEqual(normalized.schools.map((school) => school.id), ["school-a", "school-legacy"]);
});

test("school summary normalization accepts flat school payloads", () => {
  assertJsonEqual(
    normalizeSchoolSummary({
      school_id: "school-a",
      school_name: "School A",
      school_slug: "school-a",
      school_is_legacy_default: true,
    }),
    {
      id: "school-a",
      name: "School A",
      slug: "school-a",
      is_legacy_default: true,
    }
  );
});

test("valid stored active school is accepted when available", () => {
  const context = normalizeStaffAccessContext({
    ...createBasePayload(),
    active_school_id: "school-a",
    default_school_id: "school-legacy",
    schools: [
      { id: "school-a", slug: "school-a", name: "School A" },
      { id: "school-b", slug: "school-b", name: "School B" },
    ],
  });

  const selection = resolveStoredActiveSchoolSelection(context, "school-b");

  assert.equal(selection.activeSchoolId, "school-b");
  assert.equal(selection.shouldClearStored, false);
});

test("invalid stored active school falls back and should be cleared", () => {
  const context = normalizeStaffAccessContext({
    ...createBasePayload(),
    active_school_id: "school-a",
    default_school_id: "school-a",
    schools: [
      { id: "school-a", slug: "school-a", name: "School A" },
    ],
  });

  const selection = resolveStoredActiveSchoolSelection(context, "school-b");

  assert.equal(selection.activeSchoolId, "school-a");
  assert.equal(selection.shouldClearStored, true);
});

test("active school details resolve the current school object and name", () => {
  const context = normalizeStaffAccessContext({
    ...createBasePayload(),
    active_school_id: "school-b",
    default_school_id: "school-a",
    schools: [
      { id: "school-a", slug: "school-a", name: "School A" },
      { id: "school-b", slug: "school-b", name: "School B" },
    ],
  });

  const details = resolveActiveSchoolDetails(context);

  assert.equal(details.activeSchoolId, "school-b");
  assertJsonEqual(details.activeSchool, {
    id: "school-b",
    slug: "school-b",
    name: "School B",
    is_legacy_default: false,
  });
  assert.equal(details.activeSchoolName, "School B");
});

test("active school payload and query helpers are no-ops without a school", () => {
  assertJsonEqual(withActiveSchoolId({ title: "Untitled" }, null), { title: "Untitled" });
  assert.equal(getActiveSchoolIdFromAccessContext({ schools: [] }), "");

  const calls = [];
  const query = {
    eq(column, value) {
      calls.push([column, value]);
      return this;
    },
  };
  assert.equal(applyActiveSchoolFilter(query, null), query);
  assertJsonEqual(calls, []);
});

test("active school payload and query helpers attach school_id", () => {
  const context = {
    active_school_id: "school-a",
    default_school_id: "school-a",
    schools: [{ id: "school-a", slug: "school-a", name: "School A" }],
  };
  const payload = withActiveSchoolId({ title: "Untitled" }, context);
  assertJsonEqual(payload, { title: "Untitled", school_id: "school-a" });

  const calls = [];
  const query = {
    eq(column, value) {
      calls.push([column, value]);
      return this;
    },
  };
  assert.equal(applyActiveSchoolFilter(query, context), query);
  assertJsonEqual(calls, [["school_id", "school-a"]]);
});

test("school option normalization removes invalid and duplicate rows", () => {
  assertJsonEqual(
    normalizeAvailableSchools([
      { id: "school-a", slug: "a", name: "School A" },
      { id: "school-a", slug: "duplicate", name: "Duplicate" },
      { id: "", slug: "empty", name: "Empty" },
      null,
    ]),
    [{ id: "school-a", slug: "a", name: "School A", is_legacy_default: false }]
  );
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}

console.log(`Passed ${TESTS.length} tenant active-school context tests.`);
