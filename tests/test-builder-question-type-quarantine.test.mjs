import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");

function readSource(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function extractFunctionSource(source, functionName) {
  const functionStart = source.indexOf(`function ${functionName}(`);
  assert.notEqual(functionStart, -1, `${functionName} should exist`);

  const signatureStart = source.indexOf("(", functionStart);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    if (source[index] === ")") parenDepth -= 1;
    if (parenDepth === 0 && source[index] === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `${functionName} body should be discoverable`);

  let braceDepth = 0;
  let functionEnd = -1;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") braceDepth += 1;
    if (source[index] === "}") {
      braceDepth -= 1;
      if (braceDepth === 0) {
        functionEnd = index + 1;
        break;
      }
    }
  }
  assert.notEqual(functionEnd, -1, `${functionName} should have a complete body`);
  return source.slice(functionStart, functionEnd);
}

const builderSource = readSource("js/testBuilder.js");
const teacherSource = readSource("js/teacherView.js");
const builderHtml = readSource("test-builder.html");

const renderAssignmentsSource = extractFunctionSource(builderSource, "renderAssignments");
assert.doesNotMatch(
  renderAssignmentsSource,
  /data-field="test-question-type"/,
  "ordinary Test Builder assignment UI should not render the question-type picker"
);
assert.doesNotMatch(
  renderAssignmentsSource,
  /<span>Test type<\/span>/,
  "ordinary Test Builder assignment UI should not label a visible Test type field"
);
for (const label of [
  "Focus sound",
  "Segmented spelling",
  "No support",
  "Spell Loom",
  "Arrange what you hear",
]) {
  assert.doesNotMatch(
    renderAssignmentsSource,
    new RegExp(label),
    `${label} should not be exposed as an ordinary builder type option`
  );
}

assert.doesNotMatch(builderSource, /getTestTypeOptionsForRender/);
assert.doesNotMatch(builderSource, /TEST_TYPE_OPTIONS/);
assert.doesNotMatch(builderSource, /getLaunchQuestionTypeOptions/);
assert.doesNotMatch(builderSource, /different test type/);

const saveBuilderSource = extractFunctionSource(builderSource, "saveBuilder");
assert.match(
  saveBuilderSource,
  /const savedQuestionType = normalizeStoredQuestionType\(state\.test\.question_type, \{ title \}\);/,
  "saving should preserve and normalize the current stored test question type"
);
assert.match(
  saveBuilderSource,
  /question_type: savedQuestionType/,
  "saving should still write the normalized test question type"
);
assert.match(
  saveBuilderSource,
  /persistTestWords\(savedQuestionType/,
  "word payloads should still receive the stored question type for compatibility"
);

const duplicateLockedSource = extractFunctionSource(builderSource, "duplicateLockedTest");
assert.match(
  duplicateLockedSource,
  /question_type: normalizeStoredQuestionType\(state\.test\.question_type,/,
  "Test Builder duplicate should keep the original stored question type"
);

const buildAnotherSource = extractFunctionSource(builderSource, "buildAnotherTest");
assert.match(
  buildAnotherSource,
  /question_type:\s*DEFAULT_QUESTION_TYPE/,
  "new manual drafts should continue to use the current default question type"
);

const dashboardDuplicateSource = extractFunctionSource(teacherSource, "handleDuplicateTest");
assert.match(
  dashboardDuplicateSource,
  /question_type: normalizeStoredQuestionType\(original\.question_type, \{ title: original\.title \}\)/,
  "dashboard duplicate should keep the original stored question type"
);

assert.match(
  builderHtml,
  /js\/testBuilder\.js\?v=5\.46/,
  "test-builder.html should cache-bust the updated Test Builder module"
);

console.log("Passed Test Builder question-type quarantine checks.");
