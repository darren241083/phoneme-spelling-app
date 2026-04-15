import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  isBaselineAssignmentWordRows,
  resolveBaselineStandardKeyFromWordRows,
} = await loadBrowserModule("../js/baselinePlacement.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

test("baseline rows are recognised when choice payloads are objects", () => {
  const rows = [
    {
      id: "row-1",
      word: "train",
      choice: {
        source: "baseline_v1",
        baseline_v1: true,
        baseline_standard_key: "core_v1",
      },
    },
  ];

  assert.equal(isBaselineAssignmentWordRows(rows), true);
  assert.equal(resolveBaselineStandardKeyFromWordRows(rows), "core_v1");
});

test("baseline rows are recognised when choice payloads arrive as stringified JSON", () => {
  const rows = [
    {
      id: "row-1",
      word: "train",
      choice: JSON.stringify({
        source: "baseline_v1",
        baseline_v1: true,
        baseline_standard_key: "core_v1",
      }),
    },
    {
      id: "row-2",
      word: "seed",
      choice: JSON.stringify({
        source: "baseline_v1",
        baseline_v1: true,
        baseline_standard_key: "core_v1",
      }),
    },
  ];

  assert.equal(isBaselineAssignmentWordRows(rows), true);
  assert.equal(resolveBaselineStandardKeyFromWordRows(rows), "core_v1");
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
  console.log(`all ${TESTS.length} baseline placement checks passed`);
}
