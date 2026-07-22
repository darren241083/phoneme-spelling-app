import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");
const pupilViewSource = readFileSync(path.join(rootDir, "js/pupilView.js"), "utf8");
const pupilExtraChallengeSource = readFileSync(path.join(rootDir, "js/pupilExtraChallenge.js"), "utf8");

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

const completionMessageSource = extractFunctionSource(pupilViewSource, "getCompletionSummaryMessage");
assert.match(completionMessageSource, /isBaselineCompletionItem\(item\)/);
assert.match(completionMessageSource, /Your baseline is complete/);
assert.match(completionMessageSource, /prepare your next challenge/);
assert.match(completionMessageSource, /Return to your dashboard/);
assert.match(completionMessageSource, /the next activity will appear when it is ready/);
assert.match(completionMessageSource, /You finished \$\{completionLabel\}\./);

const completionSource = extractFunctionSource(pupilViewSource, "renderCompletionSummary");
assert.match(completionSource, /getCompletionSummaryMessage\(item, completionLabel\)/);

const waitingModelSource = extractFunctionSource(pupilViewSource, "buildBaselineCompleteWaitingMainActionModel");
assert.match(waitingModelSource, /baseline_waiting/);
assert.match(waitingModelSource, /Your next challenge is being prepared/);
assert.match(waitingModelSource, /Your baseline is complete\. Your next Wordloom challenge will appear here when it is ready\./);
assert.doesNotMatch(waitingModelSource, /provision/i);

const waitingGateSource = extractFunctionSource(pupilViewSource, "shouldShowBaselineCompleteWaitingMainAction");
assert.match(waitingGateSource, /gateState\?\.status/);
assert.match(waitingGateSource, /mainActionModel\?\.kind/);
assert.match(waitingGateSource, /getRequiredCoreAssignments\(assignments\)\.length/);
assert.match(waitingGateSource, /findActiveExtraChallengeAssignment\(assignments\)/);

const renderHomeStart = pupilViewSource.indexOf("async function renderPupilHome");
const openSessionStart = pupilViewSource.indexOf("\nasync function openSession", renderHomeStart);
assert.notEqual(renderHomeStart, -1, "renderPupilHome should exist");
assert.notEqual(openSessionStart, -1, "renderPupilHome slice should be bounded");
const renderHomeSource = pupilViewSource.slice(renderHomeStart, openSessionStart);
assert.match(renderHomeSource, /await maybeProvisionPersonalisedAfterReadyBaseline/);
assert.match(renderHomeSource, /shouldShowBaselineCompleteWaitingMainAction/);
assert.match(renderHomeSource, /buildBaselineCompleteWaitingMainActionModel/);

assert.equal(pupilViewSource.includes("A teacher needs to place you in your current form before your baseline test can begin."), true);
assert.equal(pupilViewSource.includes("This pupil login is no longer active"), true);
assert.equal(pupilViewSource.includes("Your baseline test is not ready yet. Please ask your teacher."), true);
assert.equal(pupilExtraChallengeSource.includes('title: "All done for now"'), true);
assert.equal(pupilExtraChallengeSource.includes("New challenges will show here when they are ready."), true);

console.log("Passed pupil first-use copy checks.");
