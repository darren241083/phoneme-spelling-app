import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  DELIVERY_MODEL_LEGACY_FIXED,
  DELIVERY_MODEL_SUPPORT_LADDER,
  MANUAL_ASSIGNMENT_DELIVERY_COPY,
  MANUAL_ASSIGNMENT_DELIVERY_DEFAULT,
  MANUAL_ASSIGNMENT_DELIVERY_OPTIONS,
  MANUAL_ASSIGNMENT_SUPPORT_PRESET_BALANCED,
  buildManualAssignmentDeliveryFields,
  normalizeManualAssignmentDeliveryModel,
} = await loadBrowserModule("../js/manualAssignmentDelivery.js", import.meta.url);

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");

function readSource(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function sourceSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} should exist after ${startMarker}`);
  return source.slice(start, end);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

test("missing and invalid delivery values default to legacy fixed", () => {
  for (const value of [undefined, null, "", "fixed", "SUPPORT", "legacy", "unknown_model"]) {
    assert.equal(normalizeManualAssignmentDeliveryModel(value), DELIVERY_MODEL_LEGACY_FIXED);
    assert.deepEqual(plain(buildManualAssignmentDeliveryFields(value)), {
      delivery_model: DELIVERY_MODEL_LEGACY_FIXED,
      support_preset: null,
    });
  }
});

test("fixed delivery persists legacy model with no support preset", () => {
  assert.equal(MANUAL_ASSIGNMENT_DELIVERY_DEFAULT, DELIVERY_MODEL_LEGACY_FIXED);
  assert.deepEqual(plain(buildManualAssignmentDeliveryFields(DELIVERY_MODEL_LEGACY_FIXED)), {
    delivery_model: DELIVERY_MODEL_LEGACY_FIXED,
    support_preset: null,
  });
});

test("support ladder delivery persists balanced manual support preset", () => {
  assert.deepEqual(plain(buildManualAssignmentDeliveryFields(DELIVERY_MODEL_SUPPORT_LADDER)), {
    delivery_model: DELIVERY_MODEL_SUPPORT_LADDER,
    support_preset: MANUAL_ASSIGNMENT_SUPPORT_PRESET_BALANCED,
  });
});

test("manual delivery labels and descriptions match teacher copy", () => {
  assert.equal(MANUAL_ASSIGNMENT_DELIVERY_COPY.label, "Delivery style");
  assert.equal(MANUAL_ASSIGNMENT_DELIVERY_COPY.fixedLabel, "Fixed question types");
  assert.equal(MANUAL_ASSIGNMENT_DELIVERY_COPY.fixedDescription, "Use the question types saved in the test.");
  assert.equal(MANUAL_ASSIGNMENT_DELIVERY_COPY.supportLadderLabel, "Support Ladder");
  assert.equal(
    MANUAL_ASSIGNMENT_DELIVERY_COPY.supportLadderDescription,
    "Pupils try independently, try once more, then use segmented spelling support before the answer is shown.",
  );
  assert.deepEqual(plain(MANUAL_ASSIGNMENT_DELIVERY_OPTIONS.map((option) => option.value)), [
    DELIVERY_MODEL_LEGACY_FIXED,
    DELIVERY_MODEL_SUPPORT_LADDER,
  ]);
});

test("dashboard manual assignment insert uses assignment delivery helper only", () => {
  const source = readSource("js/teacherView.js");
  const assignSource = sourceSlice(source, "async function handleAssignTest(form)", "async function handleAssignmentDueDateForm");

  assert.match(source, /manualAssignmentDelivery\.js\?v=1\.0/);
  assert.match(assignSource, /const deliveryFields = buildManualAssignmentDeliveryFields\(fd\.get\("delivery_model"\)\);/);
  assert.match(assignSource, /\.\.\.deliveryFields,\s*analytics_target_words_enabled:/);
  assert.match(assignSource, /const schoolScopedPayload = withActiveSchoolId\(payload, state\.accessContext\);/);
  assert.match(assignSource, /"assignments_v2",\s*schoolScopedPayload,/s);
  assert.doesNotMatch(assignSource, /\.from\("tests"\)|updateRowsWithAnalyticsFallback\("tests"|\.from\("tests"\)\s*\.update/);
});

test("test builder new assignment insert uses helper while existing update excludes delivery fields", () => {
  const source = readSource("js/testBuilder.js");
  const existingUpdateSource = sourceSlice(source, "if(existingAssignmentId){", "continue;");

  assert.match(source, /manualAssignmentDelivery\.js\?v=1\.0/);
  assert.match(source, /buildManualAssignmentDeliveryFields\(s\.deliveryModel\)/);
  assert.match(source, /data-field="assignment-delivery-model"/);
  assert.doesNotMatch(existingUpdateSource, /\bdelivery_model\b|\bsupport_preset\b|buildManualAssignmentDeliveryFields/);
});

test("assignment edit and close paths do not write delivery metadata", () => {
  const source = readSource("js/teacherView.js");
  const dueDateAndCloseSource = sourceSlice(source, "async function handleAssignmentDueDateForm(form)", "async function handleEditClass(form)");

  assert.match(dueDateAndCloseSource, /\.update\(\{ end_at:/);
  assert.doesNotMatch(dueDateAndCloseSource, /\bdelivery_model\b|\bsupport_preset\b|buildManualAssignmentDeliveryFields/);
});

test("manual delivery control is present on both dashboard and test builder surfaces", () => {
  const teacherSource = readSource("js/teacherView.js");
  const builderSource = readSource("js/testBuilder.js");

  assert.match(teacherSource, /function renderManualAssignmentDeliveryControl/);
  assert.match(teacherSource, /name="delivery_model"/);
  assert.match(teacherSource, /data-field="manual-assignment-delivery"/);
  assert.match(builderSource, /MANUAL_ASSIGNMENT_DELIVERY_COPY\.label/);
  assert.match(builderSource, /alreadyAssigned \? ""/);
});

let failureCount = 0;

for (const entry of TESTS) {
  try {
    await entry.fn();
    console.log(`ok - ${entry.name}`);
  } catch (error) {
    failureCount += 1;
    console.error(`not ok - ${entry.name}`);
    console.error(error);
  }
}

if (failureCount > 0) {
  process.exitCode = 1;
} else {
  console.log(`all ${TESTS.length} manual assignment delivery checks passed`);
}
