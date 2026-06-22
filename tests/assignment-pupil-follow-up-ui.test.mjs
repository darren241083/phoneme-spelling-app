import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");
const teacherViewSource = readFileSync(path.join(rootDir, "js/teacherView.js"), "utf8");

function extractNamedFunction(source, functionName, context = {}) {
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
  return vm.runInNewContext(`(${source.slice(functionStart, functionEnd)})`, context);
}

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const escapeAttr = escapeHtml;
const formatDate = (value) => `date:${String(value || "")}`;

const buildAssignmentPupilFollowUpDisplayModel = extractNamedFunction(
  teacherViewSource,
  "buildAssignmentPupilFollowUpDisplayModel",
  { Array, Number, Object, String },
);
const getAssignmentPupilFollowUpIds = extractNamedFunction(
  teacherViewSource,
  "getAssignmentPupilFollowUpIds",
  { String },
);
const getAssignmentPupilFollowUpRowMeta = extractNamedFunction(
  teacherViewSource,
  "getAssignmentPupilFollowUpRowMeta",
  { formatDate },
);
const renderAssignmentPupilFollowUpPerson = extractNamedFunction(
  teacherViewSource,
  "renderAssignmentPupilFollowUpPerson",
  { String, escapeHtml, getAssignmentPupilFollowUpRowMeta },
);
const renderAssignmentPupilFollowUpSection = extractNamedFunction(
  teacherViewSource,
  "renderAssignmentPupilFollowUpSection",
  { String, escapeHtml, renderAssignmentPupilFollowUpPerson },
);
const renderAssignmentPupilFollowUpSummary = extractNamedFunction(
  teacherViewSource,
  "renderAssignmentPupilFollowUpSummary",
  {
    String,
    buildAssignmentPupilFollowUpDisplayModel,
    escapeAttr,
    escapeHtml,
    getAssignmentPupilFollowUpIds,
  },
);
const renderAssignmentPupilFollowUpPanel = extractNamedFunction(
  teacherViewSource,
  "renderAssignmentPupilFollowUpPanel",
  {
    String,
    buildAssignmentPupilFollowUpDisplayModel,
    escapeAttr,
    escapeHtml,
    getAssignmentPupilFollowUpIds,
    renderAssignmentPupilFollowUpSection,
  },
);

function pupil(id, displayName, overrides = {}) {
  return {
    pupilId: id,
    displayName,
    username: `${id}-user`,
    lastActivityAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

function lifecycleFixture(overrides = {}) {
  const groups = {
    completed: [pupil("p1", "Ada"), pupil("p2", "Ben")],
    in_progress: [pupil("p3", "Cara")],
    not_started: [pupil("p4", "Dev")],
    check_data: [pupil("p5", "Pupil record unavailable", { username: null })],
    ...(overrides.groups || {}),
  };
  const counts = Object.fromEntries(
    Object.entries(groups).map(([key, rows]) => [key, rows.length])
  );
  return {
    pupilFollowUp: {
      groups,
      counts: { ...counts, ...(overrides.counts || {}) },
      decisionHint: { text: overrides.hint || "Review the pupils who may need follow-up." },
    },
  };
}

test("summary and disclosure sections use the required ordering", () => {
  const model = buildAssignmentPupilFollowUpDisplayModel(lifecycleFixture());
  assert.deepEqual(
    JSON.parse(JSON.stringify(model.summaryItems.map((item) => item.key))),
    ["completed", "in_progress", "not_started", "check_data"],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(model.sections.map((section) => section.key))),
    ["in_progress", "not_started", "check_data", "completed"],
  );
  assert.equal(model.sections.at(-1).collapsed, true);
});

test("zero-count groups are omitted and to-check copy appears only when needed", () => {
  const withoutCheck = lifecycleFixture({
    groups: { check_data: [] },
    counts: { check_data: 0 },
  });
  const withoutCheckHtml = renderAssignmentPupilFollowUpSummary("assignment-1", withoutCheck, false);
  assert.doesNotMatch(withoutCheckHtml, /to check/);
  assert.match(withoutCheckHtml, /2<\/strong> completed/);

  const withCheckHtml = renderAssignmentPupilFollowUpSummary("assignment-1", lifecycleFixture(), false);
  assert.match(withCheckHtml, /1<\/strong> to check/);
});

test("disclosure is closed by default with stable accessible ids", () => {
  const ids = getAssignmentPupilFollowUpIds("assignment-1");
  const summary = renderAssignmentPupilFollowUpSummary("assignment-1", lifecycleFixture(), false);
  assert.match(summary, /View pupils/);
  assert.match(summary, /aria-expanded="false"/);
  assert.match(summary, new RegExp(`aria-controls="${ids.panelId}"`));
  assert.match(summary, new RegExp(`id="${ids.buttonId}"`));
  assert.equal(renderAssignmentPupilFollowUpPanel("assignment-1", lifecycleFixture(), false), "");
  assert.doesNotMatch(summary, /Ada|Cara|Dev/);

  const openSummary = renderAssignmentPupilFollowUpSummary("assignment-1", lifecycleFixture(), true);
  const openPanel = renderAssignmentPupilFollowUpPanel("assignment-1", lifecycleFixture(), true);
  assert.match(openSummary, /aria-expanded="true"/);
  assert.match(openPanel, new RegExp(`id="${ids.panelId}"`));
  assert.match(openPanel, new RegExp(`aria-labelledby="${ids.buttonId}"`));
  assert.match(openPanel, /role="region"/);
});

test("open disclosure renders guidance and incomplete pupils before completed pupils", () => {
  const panel = renderAssignmentPupilFollowUpPanel("assignment-1", lifecycleFixture(), true);
  const inProgressIndex = panel.indexOf(">In progress<");
  const notStartedIndex = panel.indexOf(">Not started<");
  const checkIndex = panel.indexOf(">Check data<");
  const completedIndex = panel.indexOf(">Completed<");

  assert.match(panel, /Review the pupils who may need follow-up/);
  assert.ok(inProgressIndex >= 0 && inProgressIndex < notStartedIndex);
  assert.ok(notStartedIndex < checkIndex);
  assert.ok(checkIndex < completedIndex);
  assert.match(panel, /<details class="td-assignment-follow-up-completed">/);
  assert.match(panel, /Cara/);
  assert.match(panel, /Username p3-user/);
});

test("fully completed assignments show completed pupils directly", () => {
  const complete = lifecycleFixture({
    groups: {
      in_progress: [],
      not_started: [],
      check_data: [],
    },
    counts: {
      in_progress: 0,
      not_started: 0,
      check_data: 0,
    },
    hint: "Everyone has completed this assignment. No follow-up is needed.",
  });
  const model = buildAssignmentPupilFollowUpDisplayModel(complete);
  const panel = renderAssignmentPupilFollowUpPanel("assignment-1", complete, true);

  assert.equal(model.hasIncomplete, false);
  assert.equal(model.sections[0].key, "completed");
  assert.equal(model.sections[0].collapsed, false);
  assert.doesNotMatch(panel, /<details/);
  assert.match(panel, /Everyone has completed/);
  assert.match(panel, /Ada/);
});

test("optional Extra Challenge panel shows no-follow-up guidance", () => {
  const optionalPractice = lifecycleFixture({
    hint: "This was an optional extra challenge. No follow-up is needed.",
  });
  const panel = renderAssignmentPupilFollowUpPanel("assignment-extra", optionalPractice, true);

  assert.match(panel, /This was an optional extra challenge\. No follow-up is needed\./);
  assert.doesNotMatch(panel, /\b(extend|chase|leave alone)\b/i);
  assert.doesNotMatch(panel, /before deciding whether to end/i);
});

test("missing follow-up data keeps the generic card fallback and omits disclosure", () => {
  const model = buildAssignmentPupilFollowUpDisplayModel({ completedCount: 1, totalPupilCount: 2 });
  assert.equal(model.available, false);
  assert.equal(renderAssignmentPupilFollowUpSummary("assignment-1", {}, false), "");

  const cardStart = teacherViewSource.indexOf("function renderAssignmentCardCompact(");
  const cardEnd = teacherViewSource.indexOf("function renderClassResultsRow(", cardStart);
  const cardSource = teacherViewSource.slice(cardStart, cardEnd);
  assert.match(cardSource, /pupilFollowUpModel\.available \? "" :/);
  assert.match(cardSource, /renderAssignmentPupilFollowUpSummary/);
});

test("same-card panel openings clear competing follow-up state", () => {
  const resultStart = teacherViewSource.indexOf('if (action === "open-results-assignment")');
  const toggleStart = teacherViewSource.indexOf('if (action === "toggle-assignment-pupil-follow-up")', resultStart);
  const dueHandlerStart = teacherViewSource.indexOf('if (action === "edit-assignment-due-date")', toggleStart);
  const resultHandler = teacherViewSource.slice(resultStart, toggleStart);
  const toggleHandler = teacherViewSource.slice(toggleStart, dueHandlerStart);

  assert.match(resultHandler, /clearAssignmentPupilFollowUpOpen\(assignmentId\)/);
  assert.match(resultHandler, /clearAssignmentDueDateEditState\(assignmentId\)/);
  assert.match(resultHandler, /clearAssignmentCloseConfirmState\(assignmentId\)/);
  assert.match(toggleHandler, /clearAssignmentDueDateEditState\(assignmentId\)/);
  assert.match(toggleHandler, /clearAssignmentCloseConfirmState\(assignmentId\)/);
  assert.match(toggleHandler, /state\.activePanel = null/);

  for (const functionName of ["openAssignmentDueDateEdit", "openAssignmentCloseConfirm"]) {
    const start = teacherViewSource.indexOf(`function ${functionName}(`);
    const nextFunction = teacherViewSource.indexOf("\nfunction ", start + 10);
    const source = teacherViewSource.slice(start, nextFunction);
    assert.match(source, /clearAssignmentPupilFollowUpOpen/);
    assert.match(source, /state\.activePanel = null/);
  }
});

test("open disclosure state is pruned against the reloaded assignment list", () => {
  const loadStart = teacherViewSource.indexOf("async function loadDashboardData(");
  const loadEnd = teacherViewSource.indexOf("async function ensureWordloomCoreBankMonitorLoaded", loadStart);
  const loadSource = teacherViewSource.slice(loadStart, loadEnd);
  assert.match(loadSource, /pupilFollowUpOpenByAssignmentId = Object\.fromEntries/);
  assert.match(loadSource, /state\.assignments\.some/);
});

test("pupil disclosure uses only the loaded model and targeted card rendering", () => {
  const toggleStart = teacherViewSource.indexOf('if (action === "toggle-assignment-pupil-follow-up")');
  const nextHandler = teacherViewSource.indexOf('if (action === "edit-assignment-due-date")', toggleStart);
  const toggleHandler = teacherViewSource.slice(toggleStart, nextHandler);
  for (const forbidden of [
    "paint();",
    "supabase",
    "refreshAssignmentLifecycleSummaries",
    "ensureAssignmentAnalytics",
    "teacherAnalyticsChat",
    ".rpc(",
  ]) {
    assert.equal(toggleHandler.includes(forbidden), false, `toggle should not include ${forbidden}`);
  }
  assert.match(toggleHandler, /refreshAssignmentLifecycleCard/);
  assert.match(toggleHandler, /setAssignmentPupilFollowUpOpen/);

  const refreshStart = teacherViewSource.indexOf("function refreshAssignmentLifecycleCard(");
  const refreshEnd = teacherViewSource.indexOf("\nfunction renderSectionUpcomingAssignments", refreshStart);
  const refreshSource = teacherViewSource.slice(refreshStart, refreshEnd);
  assert.match(refreshSource, /replaceWith/);
  assert.doesNotMatch(refreshSource, /paint\(\)|supabase|ensureAssignmentAnalytics/);
});
