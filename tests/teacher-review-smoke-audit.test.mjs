import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_TEACHER_REVIEW_SCENARIOS,
  renderTeacherReviewSmokeAudit,
} from "./fixtures/audits/teacher-review-smoke-audit.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORD_TABLE_HEADER = "| # | word | role | focus | question/support | why selected | history flags |";
const TEACHER_PROMPTS = [
  "Would I have chosen these?",
  "Is repetition useful or annoying?",
  "Is review purposeful?",
  "Is stretch credible?",
  "Does the assignment feel human-selected?",
];

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getScenarioBlock(markdown, scenarioId) {
  const startMarker = `## Scenario: ${scenarioId}`;
  const start = markdown.indexOf(startMarker);
  assert.notEqual(start, -1, `Missing scenario ${scenarioId}`);
  const next = markdown.indexOf("\n## Scenario:", start + startMarker.length);
  return next === -1 ? markdown.slice(start) : markdown.slice(start, next);
}

test("teacher review smoke audit renders all required teacher-facing scenarios", () => {
  const markdown = renderTeacherReviewSmokeAudit();

  for (const scenarioId of REQUIRED_TEACHER_REVIEW_SCENARIOS) {
    assert.match(markdown, new RegExp(`## Scenario: ${escapeRegex(scenarioId)}`));
  }
});

test("each scenario includes profile, evidence, selected words, rationale, history flags, and prompts", () => {
  const markdown = renderTeacherReviewSmokeAudit();

  for (const scenarioId of REQUIRED_TEACHER_REVIEW_SCENARIOS) {
    const block = getScenarioBlock(markdown, scenarioId);
    assert.match(block, /Pupil profile:/);
    assert.match(block, /Placement band:/);
    assert.match(block, /Baseline\/evidence summary by grapheme:/);
    assert.match(block, /Selected words in order:/);
    assert.match(block, new RegExp(escapeRegex(WORD_TABLE_HEADER)));
    assert.match(block, /\| \d+ \| [a-z'-]+ \| (review|target|stretch) \| [a-z-]+ \| [a-z_]+\/[a-z]+ \| .+\(raw: .+\) \| (repeated|protected|recent|recently secure|new)/);
    assert.match(block, /history flags/);
    assert.match(block, /why selected/);
    for (const prompt of TEACHER_PROMPTS) {
      assert.match(block, new RegExp(escapeRegex(prompt)));
    }
  }
});

test("repeated assignment sample includes at least three generated cycles", () => {
  const markdown = renderTeacherReviewSmokeAudit();
  const block = getScenarioBlock(markdown, "repeated_assignment_cycles");
  const cycles = block.match(/^### Cycle \d+/gm) || [];
  assert.ok(cycles.length >= 3, `Expected at least 3 cycles, saw ${cycles.length}`);
  assert.match(block, /Cycle overlap with previous:/);
});

test("existing selector intelligence audit still passes", () => {
  const result = spawnSync(process.execPath, ["--test", "tests/selector-intelligence-audit.test.mjs"], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    timeout: 120000,
  });

  assert.equal(
    result.status,
    0,
    `selector-intelligence-audit failed\n${result.stderr}\n${String(result.stdout || "").slice(-4000)}`,
  );
});

test("audit work does not modify selector implementation files", () => {
  const result = spawnSync("git", [
    "diff",
    "--name-only",
    "--",
    "js/assignmentEngine.js",
    "supabase/functions/provision-personalised-assignment/provisioningCore.mjs",
    "supabase/functions/provision-personalised-assignment/pure/assignmentEngine.js",
  ], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "");
});
