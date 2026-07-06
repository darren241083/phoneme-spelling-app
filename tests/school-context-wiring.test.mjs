import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");

function readSource(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8").replace(/\r\n/g, "\n");
}

const dbSource = readSource("js/db.js");
const testBuilderSource = readSource("js/testBuilder.js");
const teacherViewSource = readSource("js/teacherView.js");
const presenterSource = readSource("js/presenter.js");

assert.equal(
  testBuilderSource.includes("testQuery = applyActiveSchoolFilter(testQuery, state.accessContext);"),
  true,
  "test builder should scope saved tests to the active school"
);
assert.equal(
  testBuilderSource.includes("assignmentQuery = applyActiveSchoolFilter(assignmentQuery, state.accessContext);"),
  true,
  "test builder should scope assignments to the active school"
);
assert.equal(
  testBuilderSource.includes("window.location.reload();"),
  true,
  "developer school switching should hard-reload the builder"
);

assert.equal(
  presenterSource.includes("query = applyActiveSchoolFilter(query, accessContext);"),
  true,
  "presenter should scope saved tests to the active school"
);
assert.equal(
  presenterSource.includes('school_name: session.schoolName || session.school?.name || ""'),
  true,
  "presenter should pass the active school name into the game shell"
);

assert.equal(
  teacherViewSource.includes("insert(withActiveSchoolId(payload, state.accessContext))"),
  true,
  "teacher analytics assistant history should store the active school id"
);
assert.equal(
  teacherViewSource.includes("const schoolScopedPayload = withActiveSchoolId(payload, state.accessContext);"),
  true,
  "dashboard manual assignment should attach the active school id"
);
assert.equal(
  dbSource.includes("query = applyActiveSchoolFilter(query, context.accessContext);"),
  true,
  "shared db helpers should scope school-aware reads to the active school"
);
assert.equal(
  dbSource.includes("insert([withActiveSchoolId(payload, context.accessContext)])"),
  true,
  "shared db helpers should attach school_id on school-scoped writes"
);
assert.equal(
  dbSource.includes("requested_school_id: context.schoolId || null"),
  true,
  "staff and import RPC wrappers should pass the active school id into server-side scoped functions"
);
assert.equal(
  dbSource.includes("requested_school_id: context.schoolId || null,\n  });"),
  true,
  "db RPC callers should thread the resolved active school through the Supabase payload"
);

console.log("Passed school context wiring regression checks.");
