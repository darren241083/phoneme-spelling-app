import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  getAutomationPolicyOverlapMatches,
  isAutomationPolicyOverlapCandidate,
} = await loadBrowserModule("../js/automationPolicyValidation.js", import.meta.url);

const TESTS = [];
const TODAY = new Date("2026-05-07T12:00:00Z");

function test(name, fn) {
  TESTS.push({ name, fn });
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function policy(overrides = {}) {
  return {
    id: "policy-1",
    name: "Policy",
    active: true,
    start_date: "2026-05-01",
    end_date: "2026-06-30",
    target_class_ids: ["form-a"],
    ...overrides,
  };
}

test("archived deleted expired and inactive policies are excluded from overlap matches", () => {
  const matches = getAutomationPolicyOverlapMatches({
    policy: policy({ id: "current", target_class_ids: ["form-a"] }),
    selectedClassIds: ["form-a"],
    today: TODAY,
    policies: [
      policy({ id: "archived", archived_at: "2026-05-01T10:00:00Z" }),
      policy({ id: "deleted", deleted_at: "2026-05-01T10:00:00Z" }),
      policy({ id: "expired", active: false, start_date: "2026-03-01", end_date: "2026-04-01" }),
      policy({ id: "inactive-live", active: false }),
    ],
  });

  assert.equal(matches.length, 0);
});

test("scheduled non-archived policy still blocks overlapping future dates", () => {
  const matches = getAutomationPolicyOverlapMatches({
    policy: policy({
      id: "current",
      active: false,
      start_date: "2026-06-01",
      end_date: "2026-07-01",
      target_class_ids: ["form-a"],
    }),
    selectedClassIds: ["form-a"],
    today: TODAY,
    policies: [
      policy({
        id: "scheduled",
        name: "Future policy",
        active: false,
        start_date: "2026-06-15",
        end_date: "2026-07-15",
        target_class_ids: ["form-a"],
      }),
    ],
  });

  assert.equal(matches.length, 1);
  assert.equal(matches[0].policy.id, "scheduled");
  assert.deepEqual(plain(matches[0].overlappingClassIds), ["form-a"]);
});

test("current policy id and non-overlapping targets are ignored", () => {
  const matches = getAutomationPolicyOverlapMatches({
    policy: policy({ id: "current", target_class_ids: ["form-a"] }),
    selectedClassIds: ["form-a"],
    today: TODAY,
    policies: [
      policy({ id: "current", target_class_ids: ["form-a"] }),
      policy({ id: "other-target", target_class_ids: ["form-b"] }),
    ],
  });

  assert.equal(matches.length, 0);
});

test("refreshed state without deleted stale policy removes stale overlap", () => {
  const current = policy({ id: "current", target_class_ids: ["form-a"] });
  const staleMatches = getAutomationPolicyOverlapMatches({
    policy: current,
    selectedClassIds: ["form-a"],
    today: TODAY,
    policies: [policy({ id: "stale-deleted", name: "Test 2" })],
  });
  const refreshedMatches = getAutomationPolicyOverlapMatches({
    policy: current,
    selectedClassIds: ["form-a"],
    today: TODAY,
    policies: [],
  });

  assert.equal(staleMatches.length, 1);
  assert.equal(refreshedMatches.length, 0);
});

test("candidate helper allows scheduled active-false policies but excludes inactive live policies", () => {
  assert.equal(isAutomationPolicyOverlapCandidate(policy({
    id: "scheduled",
    active: false,
    start_date: "2026-06-01",
    end_date: "2026-07-01",
  }), { today: TODAY }), true);
  assert.equal(isAutomationPolicyOverlapCandidate(policy({
    id: "inactive-live",
    active: false,
    start_date: "2026-05-01",
    end_date: "2026-07-01",
  }), { today: TODAY }), false);
});

for (const { name, fn } of TESTS) {
  await fn();
  console.log(`ok - ${name}`);
}
