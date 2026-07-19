import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");

function readSource(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8").replace(/\r\n/g, "\n");
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
const bootSource = extractFunctionSource(builderSource, "boot");
const loadAllSource = extractFunctionSource(builderSource, "loadAll");
const paintSource = extractFunctionSource(builderSource, "paint");
const showBlockingSource = extractFunctionSource(builderSource, "showNoTestSelectedBlockingState");
const renderBlockingSource = extractFunctionSource(builderSource, "renderNoTestSelectedBlockingState");
const createBlockingErrorSource = extractFunctionSource(builderSource, "createNoTestSelectedError");
const blockingHelperSource = [
  showBlockingSource,
  renderBlockingSource,
  createBlockingErrorSource,
].join("\n");

assert.match(builderSource, /fatalState:null/, "builder state should include a fatal blocking state field");
assert.match(
  builderSource,
  /The Test Builder needs an existing test or draft link before it can load\./,
  "blocking copy should explain that an existing test or draft is required"
);

assert.match(
  bootSource,
  /state\.testId = String\(new URLSearchParams\(window\.location\.search\)\.get\("id"\) \|\| ""\)\.trim\(\);/,
  "boot should trim and normalize the query-string test id"
);
assert.match(
  bootSource,
  /if\(!state\.testId\)\{\s*showNoTestSelectedBlockingState\(\);\s*return;\s*\}/s,
  "missing test id should render the no-test blocking state"
);
assert.doesNotMatch(
  bootSource,
  /No test ID found/,
  "missing test id should not use the old generic notice path"
);

assert.match(
  loadAllSource,
  /if\(!testRes\.data && isUnavailableTestLookupError\(testRes\.error\)\)\{\s*throw createNoTestSelectedError\(\);\s*\}/s,
  "unavailable lookup failures should be routed to the no-test blocking error"
);
assert.match(
  builderSource,
  /function isUnavailableTestLookupError\(error\)[\s\S]*code === "22P02"[\s\S]*invalid input syntax for type uuid/,
  "malformed uuid lookup errors should be treated as unavailable builder ids"
);
assert.match(
  bootSource,
  /if\(isNoTestSelectedError\(error\)\)\{\s*showNoTestSelectedBlockingState\(\);\s*return;\s*\}/s,
  "unavailable lookup errors should render the same blocking state"
);

const fatalPaintIndex = paintSource.indexOf("state.fatalState");
const loadingPaintIndex = paintSource.indexOf("state.loading");
const layoutPaintIndex = paintSource.indexOf("renderLayout()");
assert.notEqual(fatalPaintIndex, -1, "paint should check fatal state");
assert.notEqual(loadingPaintIndex, -1, "paint should still check loading state");
assert.notEqual(layoutPaintIndex, -1, "paint should still render the normal layout");
assert.equal(
  fatalPaintIndex < loadingPaintIndex && fatalPaintIndex < layoutPaintIndex,
  true,
  "blocking state should render before loading or normal builder layout"
);

assert.match(renderBlockingSource, /No test selected/, "blocking markup should contain the required heading");
assert.match(
  renderBlockingSource,
  /data-action="back-dashboard"/,
  "blocking markup should use the existing back-dashboard action"
);
assert.match(
  showBlockingSource,
  /ensureEventsBound\(\);/,
  "blocking state should bind delegated actions so Back to dashboard works"
);

for (const forbidden of [
  /Generate words/,
  /Add word/,
  /Update list/,
  /Save draft/,
  /Assign/,
  /data-action="generate-words"/,
  /data-action="add-word"/,
  /data-action="update-word-list"/,
  /data-action="save-draft"/,
  /data-action="assign-test"/,
  /data-field="assign-class"/,
  /data-field="assignment-attempts"/,
  /data-field="assignment-deadline"/,
  /data-field="assignment-delivery-model"/,
  /data-field="test-question-type"/,
]) {
  assert.doesNotMatch(renderBlockingSource, forbidden, `blocking state should not render ${forbidden}`);
}

for (const forbiddenWrite of [
  /\.insert\(/,
  /\.upsert\(/,
  /insertSingleRowWithAnalyticsFallback/,
  /updateRowsWithAnalyticsFallback/,
  /upsertWordContextSupport/,
  /from\("tests"\)/,
  /from\("assignments_v2"\)/,
]) {
  assert.doesNotMatch(blockingHelperSource, forbiddenWrite, `blocking helpers should not write via ${forbiddenWrite}`);
}

const validPathStart = bootSource.indexOf("await loadAll();");
const validPathEnd = bootSource.indexOf("} catch", validPathStart);
assert.notEqual(validPathStart, -1, "boot should keep the existing loadAll path");
assert.notEqual(validPathEnd, -1, "boot try path should be discoverable");
const validBootPath = bootSource.slice(validPathStart, validPathEnd);
assert.match(
  validBootPath,
  /await loadAll\(\);[\s\S]*baselineHash = buildStateHash\(\);[\s\S]*state\.loading = false;[\s\S]*paint\(\);[\s\S]*ensureEventsBound\(\);[\s\S]*autosave = createAutosave/s,
  "valid builder links should continue through load, paint, event binding, and autosave startup"
);
assert.doesNotMatch(
  validBootPath,
  /showNoTestSelectedBlockingState/,
  "valid builder load path should not render the blocking state"
);

console.log("Passed Test Builder blocking-state checks.");
