import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_SPELLING_BEE_PRO_BANK_PROFILES,
  SPELLING_BEE_PRO_CONTEXTUAL_AUDIT_VERSION,
  SPELLING_BEE_PRO_LADDER_AUDIT_VERSION,
  buildSpellingBeeProLadderAudit,
  renderSpellingBeeProLadderAudit,
} from "./fixtures/audits/spelling-bee-pro-ladder-audit.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT_REPORT = buildSpellingBeeProLadderAudit();

function getSimulation(profileId, scenarioId, seed = "bee-audit-alpha") {
  return AUDIT_REPORT.simulations.find((simulation) =>
    simulation.profileId === profileId
    && simulation.scenarioId === scenarioId
    && simulation.seed === seed
  );
}

test("spelling bee pro ladder audit reports required audit-only architecture", () => {
  assert.equal(AUDIT_REPORT.auditVersion, SPELLING_BEE_PRO_LADDER_AUDIT_VERSION);
  assert.equal(AUDIT_REPORT.contextualDifficultyAuditVersion, SPELLING_BEE_PRO_CONTEXTUAL_AUDIT_VERSION);
  assert.equal(AUDIT_REPORT.auditOnly, true);
  assert.equal(AUDIT_REPORT.runtimeMutation, false);
  assert.ok(AUDIT_REPORT.architecture.likelyFiles.includes("js/spellingBeePolicy.js"));
  assert.ok(AUDIT_REPORT.architecture.likelyFiles.includes("js/teacherView.js"));
  assert.ok(AUDIT_REPORT.architecture.frozenBoundaries.some((line) => line.includes("No personalised selector v2 behaviour changes")));
  assert.ok(AUDIT_REPORT.architecture.frozenBoundaries.some((line) => line.includes("No Spelling Bee runtime behaviour changes")));
});

test("audit includes every planned bank profile and scenario family", () => {
  assert.deepEqual(
    AUDIT_REPORT.bankProfiles.map((profile) => profile.id).sort(),
    [...REQUIRED_SPELLING_BEE_PRO_BANK_PROFILES].sort(),
  );
  assert.deepEqual(
    AUDIT_REPORT.scenarios.map((scenario) => scenario.id).sort(),
    ["capped_4", "capped_10", "capped_20", "until_wrong_50"].sort(),
  );
  assert.deepEqual(AUDIT_REPORT.seeds, ["bee-audit-alpha", "bee-audit-beta", "bee-audit-gamma"]);
});

test("balanced capped ladder exposes ramp, coverage, contextual, and pro quality metrics", () => {
  const simulation = getSimulation("balanced_teacher_bank", "capped_10");

  assert.equal(simulation.status, "ready");
  assert.equal(simulation.metrics.roundCount, 10);
  assert.equal(simulation.metrics.duplicateWordCount, 0);
  assert.equal(typeof simulation.metrics.maxPositiveJump, "number");
  assert.equal(typeof simulation.metrics.averageTargetDelta, "number");
  assert.ok(simulation.metrics.focusCounts);
  assert.ok(simulation.metrics.familyCounts);
  assert.equal(simulation.metrics.contextualDifficulty.modelVersion, SPELLING_BEE_PRO_CONTEXTUAL_AUDIT_VERSION);
  assert.equal(typeof simulation.metrics.contextualDifficulty.averageEffectiveScore, "number");
  assert.equal(typeof simulation.metrics.contextualDifficulty.hiddenSpikeCount, "number");
  assert.equal(typeof simulation.metrics.proQuality.upperTierWordCount, "number");
  assert.equal(typeof simulation.metrics.proQuality.lengthDrivenChallengeRate, "number");
  assert.ok(Array.isArray(simulation.words));
  assert.equal(simulation.words.every((word) => word.contextualDifficulty.modelVersion === SPELLING_BEE_PRO_CONTEXTUAL_AUDIT_VERSION), true);
});

test("thin high-tier profile produces bank-expansion signals instead of fallback selection", () => {
  const profile = AUDIT_REPORT.bankProfiles.find((item) => item.id === "thin_high_tier_bank");
  const simulation = getSimulation("thin_high_tier_bank", "capped_10");

  assert.ok(profile.untilWrongChallengeShortfall > 0);
  assert.equal(simulation.status, "not_enough_approved_words");
  assert.equal(simulation.words.length, 0);
  assert.ok(simulation.decisionFlags.includes("targeted_bank_expansion"));
  assert.ok(AUDIT_REPORT.decisionSignals.targetedBankExpansion.some((signal) =>
    signal.profileId === "thin_high_tier_bank"
  ));
});

test("narrow grapheme and long-word-heavy profiles flag ladder redesign risks", () => {
  const narrowProfile = AUDIT_REPORT.bankProfiles.find((item) => item.id === "narrow_grapheme_bank");
  const narrowSimulation = getSimulation("narrow_grapheme_bank", "capped_10");
  const longSimulation = getSimulation("long_word_heavy_bank", "capped_20");

  assert.ok(narrowProfile.dominantFocusRate >= 0.6);
  assert.equal(narrowSimulation.status, "ready");
  assert.ok(narrowSimulation.metrics.dominantFocusRate >= 0.5);
  assert.ok(narrowSimulation.decisionFlags.includes("ladder_redesign"));
  assert.equal(longSimulation.status, "ready");
  assert.ok(longSimulation.metrics.proQuality.lengthDrivenChallengeRate >= 0.25);
  assert.ok(longSimulation.decisionFlags.includes("ladder_redesign"));
});

test("missing upper-tier context produces contextual difficulty rollout and bank-expansion evidence", () => {
  const profile = AUDIT_REPORT.bankProfiles.find((item) => item.id === "missing_context_bank");
  const simulation = getSimulation("missing_context_bank", "capped_20");

  assert.ok(profile.highTierContextCoverage.bothCoverageRate < 0.9);
  assert.equal(simulation.status, "ready");
  assert.ok(simulation.metrics.contextualDifficulty.riskFlags.missing_context_high_effective > 0);
  assert.ok(simulation.decisionFlags.includes("contextual_difficulty_rollout"));
  assert.ok(simulation.decisionFlags.includes("targeted_bank_expansion"));
});

test("near-minimum until-wrong profile reaches the current safety cap but has no buffer", () => {
  const profile = AUDIT_REPORT.bankProfiles.find((item) => item.id === "near_minimum_until_wrong_bank");
  const simulation = getSimulation("near_minimum_until_wrong_bank", "until_wrong_50");

  assert.equal(profile.approvedCount, 50);
  assert.equal(profile.challengeWordCount, 48);
  assert.equal(profile.untilWrongBuffer, 0);
  assert.equal(simulation.status, "ready");
  assert.equal(simulation.required, 50);
  assert.equal(simulation.metrics.roundCount, 50);
});

test("exposure audit documents duplicate-pupil fairness without changing runtime", () => {
  const overlapping = AUDIT_REPORT.exposureAudits.find((item) => item.id === "overlapping_forms");
  const empty = AUDIT_REPORT.exposureAudits.find((item) => item.id === "no_active_pupils");

  assert.equal(overlapping.includedPupilCount, 4);
  assert.equal(overlapping.skippedPupilCount, 2);
  assert.equal(overlapping.skipReasons.duplicate_pupil_in_run, 2);
  assert.equal(empty.includedPupilCount, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(empty.releaseClassIds)), []);
});

test("markdown render includes teacher review pack, decision sections, and JSON payload", () => {
  const markdown = renderSpellingBeeProLadderAudit(AUDIT_REPORT);

  assert.match(markdown, /^# Spelling Bee \/ Pro Ladder Audit/m);
  assert.match(markdown, /## Teacher Credibility Samples/);
  assert.match(markdown, /Would this feel like a genuine spelling challenge\?/);
  assert.match(markdown, /Targeted bank expansion signals:/);
  assert.match(markdown, /SPELLING_BEE_PRO_LADDER_AUDIT_JSON /);
  assert.match(markdown, /No personalised selector v2 behaviour changes/);
});

test("audit tool renders successfully from the command line", () => {
  const result = spawnSync(process.execPath, ["tools/spelling-bee-pro-ladder-audit.mjs"], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    timeout: 120000,
  });

  assert.equal(
    result.status,
    0,
    `spelling bee pro ladder audit tool failed\n${result.stderr}\n${String(result.stdout || "").slice(-4000)}`,
  );
  assert.match(result.stdout, /SPELLING_BEE_PRO_LADDER_AUDIT_JSON /);
  assert.match(result.stdout, /spelling_bee_pro_ladder_audit_v1/);
});
