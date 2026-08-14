import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  STUDIO_POLICY_PRECEDENCE,
  StudioContractError,
  createStudioReadyContract,
  fingerprintStudioReadySource,
  hashStudioReadyContract,
  intakeNaturalIntent,
  intakeStructuredBrief,
  intakeStudioReadyBrief,
  translateStudioReadyRequest,
  validateStudioReadyContract,
} from "../studio/core/contracts.mjs";
import { loadStudioConfiguration } from "../studio/core/profile-loader.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUDIO_ROOT = path.join(ROOT_DIR, "studio");
const FIXTURE_ROOT = path.join(ROOT_DIR, "tests", "fixtures", "studio");
const CORE_FORBIDDEN_TERMS = new Map([
  ["application name", /\bwordloom\b/i],
  ["person name", /\bdarren\b/i],
  ["learner-domain term", /\bpupil\b/i],
  ["organisation-domain term", /\bschool\b/i],
  ["app-user term", /\bteacher\b/i],
  ["subject-domain term", /\bspelling\b/i],
  ["product-domain term", /\bintervention\b/i],
  ["backend vendor", /\bsupabase\b/i],
  ["application configuration path", /js[\\/]config\.js/i],
  ["repository name", /phoneme-spelling-app/i],
]);
const FUTURE_STAGE_TERMS = [
  /\brisk[-_ ]router\b/i,
  /\bdeterministic risk routing\b/i,
  /\bdiscovery\/delivery enforcement\b/i,
  /\bbuilder completion contract\b/i,
  /\bverification artifact\b/i,
  /\bstop-loss\b/i,
  /\btest integrity guard\b/i,
  /\bincident routing\b/i,
];

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT_DIR, relativePath), "utf8"));
}

function listFilesRecursively(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursively(fullPath) : [fullPath];
  });
}

function baseAppProfile() {
  return {
    profile_id: "example-app",
    application_id: "example-app",
  };
}

function minimalContract(overrides = {}) {
  return createStudioReadyContract({
    request: "The account summary is too dense. Make the primary next action clearer.",
    appProfile: baseAppProfile(),
    declaredRisk: { tier: "tier_1", basis: ["small visible product change"] },
    acceptanceCriteria: [
      "The primary next action is visibly clearer without adding extra routine steps.",
    ],
    ...overrides,
  });
}

test("valid minimal Tier 1-style requests become small Studio Ready contracts", () => {
  const contract = minimalContract();

  assert.equal(contract.schema_version, 1);
  assert.equal(contract.contract_type, "studio_ready");
  assert.match(contract.contract_id, /^studio-ready-[a-f0-9]{12}$/);
  assert.equal(contract.app_profile.profile_id, "example-app");
  assert.equal(contract.mode, "build");
  assert.equal(contract.declared_risk.tier, "tier_1");
  assert.deepEqual(contract.acceptance_criteria, [
    {
      id: "AC-001",
      text: "The primary next action is visibly clearer without adding extra routine steps.",
    },
  ]);
  assert.deepEqual(contract.product_questions, []);
  assert.equal(contract.metadata.contract_version, "studio-ready/1");
  assert.equal(Object.isFrozen(contract.acceptance_criteria[0]), true);
});

test("creation rejects omitted acceptance criteria instead of inventing acceptance coverage", () => {
  assert.throws(
    () => translateStudioReadyRequest({
      request: "The account summary is too dense. Make the primary next action clearer.",
      appProfile: baseAppProfile(),
    }),
    (error) => {
      assert.equal(error.code, "CONTRACT_INVALID");
      assert.equal(error.message, "[CONTRACT_INVALID] Contract acceptance_criteria must be an array.");
      return true;
    },
  );
});

test("build mode remains available when acceptance criteria are explicit and no product question is open", () => {
  const contract = minimalContract();

  assert.equal(contract.mode, "build");
  assert.equal(contract.metadata.status, "ready");
});

test("draft planning mode is used when explicit acceptance criteria still need a product answer", () => {
  const contract = translateStudioReadyRequest({
    request: "Should the account summary show the action or the warning first?",
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The chosen account summary priority is recorded before implementation."],
  });

  assert.equal(contract.mode, "plan");
  assert.equal(contract.metadata.status, "draft");
  assert.equal(contract.product_questions.length, 1);
});

test("normal Tier 2 Wordloom request references profile guidance without copying it", () => {
  const studio = loadStudioConfiguration({ studioRoot: STUDIO_ROOT });
  const contract = translateStudioReadyRequest({
    request: "The completion screen is too wordy. Make the correct spelling much more obvious.",
    studio,
    desiredOutcome: "The completion screen makes the correct spelling the main visual focus with less surrounding copy.",
    scope: ["completion screen"],
    nonGoals: ["Do not change scoring, assignment, or data behaviour."],
    acceptanceCriteria: [
      "The completion screen shows the correct spelling more prominently than supporting copy.",
      "The completion screen uses less surrounding wording while preserving the learner outcome.",
    ],
    guardrails: ["Use the active profile guidance reference before changing product copy."],
    declaredRisk: { tier: "tier_2", basis: ["learner-facing wording and feedback"] },
    evidenceRequired: ["Before and after screen evidence for the completion state."],
    testsRequired: ["Focused UI or text assertion for the completion state."],
  });

  assert.equal(contract.app_profile.profile_id, "wordloom");
  assert.deepEqual(contract.app_profile.guidance_refs, [
    {
      id: "product-constitution",
      path: "product-constitution.md",
      applies_to: ["guardrails", "product_questions"],
    },
  ]);
  assert.deepEqual(contract.acceptance_criteria.map(({ id }) => id), ["AC-001", "AC-002"]);
  assert.deepEqual(contract.product_questions, []);
  assert.doesNotMatch(JSON.stringify(contract), /Automation before unnecessary/);
});

test("richer Tier 3-style contracts keep consequential questions explicit", () => {
  const contract = createStudioReadyContract({
    request: "Should account admins see individual export details or only aggregated totals?",
    appProfile: {
      profile_id: "harbor-inventory",
      application_id: "harbor-inventory",
    },
    desiredOutcome: "The export visibility model is clear before implementation starts.",
    mode: "plan",
    scope: ["admin export"],
    nonGoals: ["Do not implement storage or access-control changes yet."],
    acceptanceCriteria: [
      { id: "AC-001", text: "The chosen export visibility outcome is stated in product terms." },
      { id: "AC-002", text: "Consequential privacy choices are resolved before build work starts." },
    ],
    declaredRisk: { tier: "tier_3", basis: ["privacy-sensitive visibility decision"] },
    evidenceRequired: ["Approval reference for the selected visibility model."],
    testsRequired: ["No implementation tests until the product choice is resolved."],
    stopConditions: ["Stop before implementation if the visibility choice is unresolved."],
  });

  assert.equal(contract.app_profile.profile_id, "harbor-inventory");
  assert.equal(contract.mode, "plan");
  assert.equal(contract.metadata.status, "draft");
  assert.equal(contract.product_questions.length, 1);
  assert.deepEqual(contract.product_questions[0], {
    id: "PQ-001",
    question: "Should account admins see individual export details or only aggregated totals?",
    reason: "product_ambiguity",
    owner_role: "product_owner",
  });
});

test("contracts with unresolved product questions cannot be build-ready", () => {
  const generated = createStudioReadyContract({
    request: "Should account admins see individual export details or only aggregated totals?",
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The product visibility choice is resolved before implementation."],
  });
  const forcedReady = structuredClone(generated);
  forcedReady.mode = "build";
  forcedReady.metadata.status = "ready";

  assert.equal(generated.mode, "plan");
  assert.equal(generated.metadata.status, "draft");
  assert.throws(
    () => validateStudioReadyContract(forcedReady),
    (error) => {
      assert.equal(error.code, "CONTRACT_PRODUCT_QUESTIONS_UNRESOLVED");
      assert.equal(error.message, "[CONTRACT_PRODUCT_QUESTIONS_UNRESOLVED] Contracts with product_questions cannot use build mode.");
      return true;
    },
  );

  forcedReady.mode = "plan";
  assert.throws(
    () => validateStudioReadyContract(forcedReady),
    (error) => {
      assert.equal(error.code, "CONTRACT_PRODUCT_QUESTIONS_UNRESOLVED");
      assert.equal(error.message, "[CONTRACT_PRODUCT_QUESTIONS_UNRESOLVED] Contracts with product_questions cannot be ready.");
      return true;
    },
  );
});

test("alternate app guidance survives profile loading and Studio Ready Intake", () => {
  const studio = loadStudioConfiguration({
    studioRoot: STUDIO_ROOT,
    profilePath: path.join(FIXTURE_ROOT, "alternate-app-profile.json"),
  });
  const contract = intakeNaturalIntent({
    request: "The receiving summary is hard to scan. Make overdue stock lines stand out.",
    studio,
    acceptanceCriteria: [
      "Overdue stock lines stand out from regular receiving rows in the summary.",
    ],
  });

  assert.equal(contract.app_profile.profile_id, "harbor-inventory");
  assert.equal(contract.app_profile.application_id, "harbor-inventory");
  assert.equal(contract.source_provenance.input_kind, "natural_intent");
  assert.deepEqual(contract.app_profile.guidance_refs, [
    {
      id: "inventory_operations",
      path: "alternate-app-guidance.md",
      applies_to: ["guardrails", "product_questions"],
    },
  ]);
  assert.equal(contract.acceptance_criteria[0].id, "AC-001");
});

test("acceptance criterion IDs are stable across creation and validation", () => {
  const first = minimalContract();
  const second = minimalContract();
  const revalidated = validateStudioReadyContract(structuredClone(first));

  assert.deepEqual(first.acceptance_criteria.map(({ id }) => id), ["AC-001"]);
  assert.deepEqual(second.acceptance_criteria.map(({ id }) => id), ["AC-001"]);
  assert.deepEqual(revalidated.acceptance_criteria, first.acceptance_criteria);
  assert.equal(hashStudioReadyContract(first), hashStudioReadyContract(revalidated));
});

test("contract template is valid and programmatically consumable", () => {
  const template = validateStudioReadyContract(readJson("studio/core/templates/studio-ready.json"));

  assert.equal(template.contract_id, "studio-ready-template");
  assert.equal(template.metadata.status, "draft");
  assert.equal(template.source_provenance.input_kind, "structured_brief");
  assert.equal(template.policy.precedence, STUDIO_POLICY_PRECEDENCE);
  assert.deepEqual(template.acceptance_criteria.map(({ id }) => id), ["AC-001"]);
});

test("Studio Ready Intake preserves a realistic detailed brief without semantic weakening", () => {
  const brief = readJson("tests/fixtures/studio/detailed-studio-ready-brief.json");
  const contract = intakeStudioReadyBrief({
    brief,
    appProfile: baseAppProfile(),
    sourceReference: "manual-intake/receiving-exception-stage-4",
  });

  assert.equal(contract.source_provenance.input_kind, "studio_ready_brief");
  assert.equal(contract.source_provenance.fingerprint, fingerprintStudioReadySource(brief));
  assert.equal(contract.source_provenance.source_reference, "manual-intake/receiving-exception-stage-4");
  assert.equal(contract.intent, brief.intent);
  assert.equal(contract.desired_outcome, brief.desired_outcome);
  assert.deepEqual(contract.scope, brief.scope);
  assert.deepEqual(contract.non_goals, brief.non_goals);
  assert.deepEqual(contract.acceptance_criteria, brief.acceptance_criteria);
  assert.deepEqual(contract.guardrails, brief.guardrails);
  assert.deepEqual(contract.declared_risk, brief.declared_risk);
  assert.deepEqual(contract.evidence_required, brief.evidence_required);
  assert.deepEqual(contract.tests_required, brief.tests_required);
  assert.deepEqual(contract.stop_conditions, brief.stop_conditions);
  assert.deepEqual(contract.execution_constraints, {
    protected_paths: brief.protected_paths,
    required_operations: brief.required_operations,
    forbidden_operations: brief.forbidden_operations,
    writer_restrictions: brief.writer_restrictions,
    risk_requirements: brief.risk_requirements,
  });
  assert.ok(contract.execution_constraints.forbidden_operations.includes("Do not push."));
  assert.equal("source_brief" in contract.source_provenance, false);
});

test("detailed Intake rejects missing structure instead of converting unknown requirements to empty arrays", () => {
  const brief = readJson("tests/fixtures/studio/detailed-studio-ready-brief.json");
  delete brief.non_goals;

  assert.throws(
    () => intakeStudioReadyBrief({ brief, appProfile: baseAppProfile() }),
    (error) => {
      assert.equal(error.code, "STUDIO_READY_BRIEF_INCOMPLETE");
      assert.equal(
        error.message,
        "[STUDIO_READY_BRIEF_INCOMPLETE] Detailed Studio Ready brief is missing explicit field: non_goals.",
      );
      return true;
    },
  );
});

test("objective technical context enriches Intake without changing product intent", () => {
  const brief = readJson("tests/fixtures/studio/detailed-studio-ready-brief.json");
  const technicalLookup = "Repository evidence: tests/receiving-exception-detail.test.mjs covers the detail route.";
  const contract = intakeStudioReadyBrief({
    brief,
    appProfile: baseAppProfile(),
    objectiveTechnicalContext: [technicalLookup],
  });

  assert.equal(contract.intent, brief.intent);
  assert.equal(contract.desired_outcome, brief.desired_outcome);
  assert.deepEqual(contract.acceptance_criteria, brief.acceptance_criteria);
  assert.deepEqual(contract.non_goals, brief.non_goals);
  assert.deepEqual(contract.context_requirements, [...brief.context_requirements, technicalLookup]);
});

test("source fingerprints are deterministic across object key order and preserve semantic text", () => {
  const brief = readJson("tests/fixtures/studio/detailed-studio-ready-brief.json");
  const reordered = Object.fromEntries(Object.entries(brief).reverse());
  const withDeliberateWhitespace = {
    ...brief,
    desired_outcome: "Line one remains exact.\n\nLine two remains exact.",
  };
  const contract = intakeStudioReadyBrief({
    brief: withDeliberateWhitespace,
    appProfile: baseAppProfile(),
  });

  assert.equal(fingerprintStudioReadySource(brief), fingerprintStudioReadySource(reordered));
  assert.notEqual(fingerprintStudioReadySource(brief), fingerprintStudioReadySource(withDeliberateWhitespace));
  assert.equal(contract.desired_outcome, withDeliberateWhitespace.desired_outcome);
  assert.match(contract.source_provenance.fingerprint, /^sha256:[a-f0-9]{64}$/);
});

test("deterministic Studio policy precedence and stricter deviations remain explicit", () => {
  const brief = readJson("tests/fixtures/studio/detailed-studio-ready-brief.json");
  const contract = intakeStudioReadyBrief({
    brief,
    appProfile: baseAppProfile(),
    policyConstraints: ["Protected-path changes require Tier 3 controls."],
    policyDeviations: [
      {
        id: "PD-001",
        source_requirement: "Declared risk: tier_2.",
        studio_requirement: "Protected-path changes require Tier 3 controls.",
        reason: "Deterministic Studio safety is stricter than the supplied risk opinion.",
      },
    ],
  });

  assert.equal(contract.policy.precedence, STUDIO_POLICY_PRECEDENCE);
  assert.deepEqual(contract.policy.constraints, ["Protected-path changes require Tier 3 controls."]);
  assert.equal(contract.policy.deviations[0].source_requirement, "Declared risk: tier_2.");
  assert.equal(contract.policy.deviations[0].studio_requirement, "Protected-path changes require Tier 3 controls.");
  assert.deepEqual(contract.execution_constraints.risk_requirements, brief.risk_requirements);
});

test("consequential product judgement blocks execution even when the question mentions technical policy", () => {
  const contract = intakeStructuredBrief({
    brief: {
      intent: "Which database policy should determine whether account admins can see individual records?",
      desired_outcome: "The record visibility decision is resolved before implementation.",
      acceptance_criteria: [
        "The approved visibility outcome is recorded before implementation starts.",
      ],
    },
    appProfile: baseAppProfile(),
  });

  assert.equal(contract.mode, "plan");
  assert.equal(contract.metadata.status, "draft");
  assert.equal(contract.product_questions.length, 1);
  assert.equal(
    contract.product_questions[0].question,
    "Which database policy should determine whether account admins can see individual records?",
  );
  assert.deepEqual(contract.policy.deviations, [
    {
      id: "PD-001",
      source_requirement: "Execution mode: build.",
      studio_requirement: "Execution mode: plan until unresolved product judgement is resolved.",
      reason: "Contracts with product_questions cannot execute as build-ready.",
    },
  ]);
});

test("clear repository lookup questions stay technical and do not escalate to the Product Owner", () => {
  const contract = intakeStructuredBrief({
    brief: {
      intent: "Which existing test file covers this behaviour? Update the receiving summary after locating it.",
      desired_outcome: "The receiving summary is updated with focused regression coverage.",
      acceptance_criteria: ["The existing focused test covers the updated receiving summary."],
    },
    appProfile: baseAppProfile(),
  });

  assert.deepEqual(contract.product_questions, []);
  assert.deepEqual(contract.context_requirements, [
    "Resolve through implementation evidence: Which existing test file covers this behaviour?",
  ]);
  assert.equal(contract.mode, "build");
});

test("consequential polite requests cannot bypass product-question blocking", () => {
  const contract = intakeStructuredBrief({
    brief: {
      intent: "Could you change who can approve exports?",
      desired_outcome: "The export approval model is resolved before implementation.",
      acceptance_criteria: ["The approved export permission outcome is recorded."],
    },
    appProfile: baseAppProfile(),
  });

  assert.equal(contract.mode, "plan");
  assert.equal(contract.metadata.status, "draft");
  assert.equal(contract.product_questions.length, 1);
});

test("strong product imperatives are inferred for fallback inputs even when questions are explicitly empty", () => {
  const request = "Change who can approve exports";
  const natural = intakeNaturalIntent({
    request,
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The approved export permission model is recorded."],
    productQuestions: [],
  });
  const structured = intakeStructuredBrief({
    brief: {
      intent: request,
      desired_outcome: "The export permission model is resolved before implementation.",
      acceptance_criteria: ["The approved export permission model is recorded."],
      product_questions: [],
    },
    appProfile: baseAppProfile(),
  });

  for (const contract of [natural, structured]) {
    assert.equal(contract.mode, "plan");
    assert.equal(contract.metadata.status, "draft");
    assert.equal(contract.product_questions.length, 1);
    assert.equal(contract.product_questions[0].question, request);
  }

  const technical = intakeNaturalIntent({
    request: "Update the export component implementation",
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The export component uses the established implementation."],
    productQuestions: [],
  });
  assert.equal(technical.mode, "build");
  assert.deepEqual(technical.product_questions, []);
});

test("explicit access-control imperatives block fallback execution without catching component behavior", () => {
  const request = "Allow managers to export customer records";
  const natural = intakeNaturalIntent({
    request,
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The approved export access model is recorded."],
  });
  const structured = intakeStructuredBrief({
    brief: {
      intent: request,
      desired_outcome: "The export access model is resolved before implementation.",
      acceptance_criteria: ["The approved export access model is recorded."],
      product_questions: [],
    },
    appProfile: baseAppProfile(),
  });

  for (const contract of [natural, structured]) {
    assert.equal(contract.mode, "plan");
    assert.equal(contract.metadata.status, "draft");
    assert.equal(contract.product_questions[0].question, request);
  }

  const componentBehavior = intakeNaturalIntent({
    request: "Allow the export component to retry failed jobs",
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The export component retries failed jobs through the established path."],
  });
  assert.equal(componentBehavior.mode, "build");
  assert.deepEqual(componentBehavior.product_questions, []);
});

test("fallback inference preserves supplied questions, avoids duplicates, and leaves trusted detailed briefs authoritative", () => {
  const structured = intakeStructuredBrief({
    brief: {
      intent: "Who may view exports? Change who can approve exports.",
      desired_outcome: "The export visibility and approval model is resolved.",
      acceptance_criteria: ["The approved export model is recorded."],
      product_questions: [
        {
          id: "PQ-001",
          question: "Who may view exports?",
          reason: "product_ambiguity",
          owner_role: "product_owner",
        },
      ],
    },
    appProfile: baseAppProfile(),
  });
  const trustedBrief = readJson("tests/fixtures/studio/detailed-studio-ready-brief.json");
  trustedBrief.intent = "Change who can approve exports";
  trustedBrief.product_questions = [];
  const trusted = intakeStudioReadyBrief({ brief: trustedBrief, appProfile: baseAppProfile() });

  assert.deepEqual(structured.product_questions.map(({ question }) => question), [
    "Who may view exports?",
    "Change who can approve exports.",
  ]);
  assert.deepEqual(trusted.product_questions, []);
  assert.equal(trusted.mode, "build");
  assert.equal(trusted.metadata.status, "ready");
});

test("technical should questions remain engineering lookups", () => {
  const contract = intakeStructuredBrief({
    brief: {
      intent: "Where should the existing test live? Update it after locating the established test boundary.",
      desired_outcome: "The established focused test covers the amended behaviour.",
      acceptance_criteria: ["The existing focused test covers the amended behaviour."],
    },
    appProfile: baseAppProfile(),
  });

  assert.deepEqual(contract.product_questions, []);
  assert.deepEqual(contract.context_requirements, [
    "Resolve through implementation evidence: Where should the existing test live?",
  ]);
  assert.equal(contract.mode, "build");
});

test("duplicate product-question IDs fail deterministically", () => {
  assert.throws(
    () => createStudioReadyContract({
      request: "Which visibility model should the report use?",
      appProfile: baseAppProfile(),
      acceptanceCriteria: ["The selected visibility model is recorded."],
      productQuestions: [
        { id: "PQ-001", question: "Who may view the report?", reason: "product_ambiguity" },
        { id: "PQ-001", question: "Who may export the report?", reason: "product_ambiguity" },
      ],
    }),
    (error) => {
      assert.equal(error.code, "CONTRACT_PRODUCT_QUESTIONS_DUPLICATE");
      assert.equal(error.message, "[CONTRACT_PRODUCT_QUESTIONS_DUPLICATE] Contract product_questions ids must be unique.");
      return true;
    },
  );
});

test("duplicate guidance-reference IDs fail deterministically at the contract boundary", () => {
  assert.throws(
    () => createStudioReadyContract({
      request: "Update the summary.",
      appProfile: {
        ...baseAppProfile(),
        guidance_refs: [
          { id: "shared_guidance", path: "first.md" },
          { id: "shared_guidance", path: "second.md" },
        ],
      },
      acceptanceCriteria: ["The summary is updated."],
    }),
    (error) => {
      assert.equal(error.code, "CONTRACT_PROFILE_INVALID");
      assert.equal(
        error.message,
        "[CONTRACT_PROFILE_INVALID] Contract app_profile.guidance_refs ids must be unique.",
      );
      return true;
    },
  );
});

test("natural-intent Intake remains an optional functional fallback", () => {
  const contract = intakeNaturalIntent({
    request: "The receiving summary is hard to scan. Make the next action clearer.",
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The receiving summary presents one clear next action."],
  });
  const legacyAlias = translateStudioReadyRequest({
    request: "The receiving summary is hard to scan. Make the next action clearer.",
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The receiving summary presents one clear next action."],
  });

  assert.equal(contract.source_provenance.input_kind, "natural_intent");
  assert.deepEqual(legacyAlias, contract);
});

test("the canonical Studio roadmap records native-first stages without implementing later-stage machinery", () => {
  const roadmap = readFileSync(path.join(STUDIO_ROOT, "ROADMAP.md"), "utf8");

  for (let stage = 5; stage <= 13; stage += 1) {
    assert.match(roadmap, new RegExp(`Stage ${stage}\\b`));
  }
  assert.match(roadmap, /native-substitution audit/i);
  assert.match(roadmap, /Stage 5\+ remains documentation-only/i);
  assert.match(roadmap, /manual copy\/paste/i);
  assert.match(roadmap, /Do not build a custom worktree or environment manager/i);
  assert.match(roadmap, /Do not build a custom agent scheduler/i);
});

test("missing required fields fail deterministically", () => {
  const contract = structuredClone(minimalContract());
  delete contract.desired_outcome;

  assert.throws(
    () => validateStudioReadyContract(contract),
    (error) => {
      assert.ok(error instanceof StudioContractError);
      assert.equal(error.code, "CONTRACT_INVALID");
      assert.equal(error.message, "[CONTRACT_INVALID] Contract desired_outcome must be a non-empty string.");
      return true;
    },
  );
});

test("validation rejects missing or empty acceptance criteria instead of inventing them", () => {
  const missing = structuredClone(minimalContract());
  delete missing.acceptance_criteria;
  const empty = structuredClone(minimalContract());
  empty.acceptance_criteria = [];

  assert.throws(
    () => validateStudioReadyContract(missing),
    (error) => {
      assert.equal(error.code, "CONTRACT_INVALID");
      assert.equal(error.message, "[CONTRACT_INVALID] Contract acceptance_criteria must be an array.");
      return true;
    },
  );
  assert.throws(
    () => validateStudioReadyContract(empty),
    (error) => {
      assert.equal(error.code, "CONTRACT_ACCEPTANCE_CRITERIA_INVALID");
      assert.equal(error.message, "[CONTRACT_ACCEPTANCE_CRITERIA_INVALID] Contract acceptance_criteria must not be empty.");
      return true;
    },
  );
});

test("duplicate acceptance criterion IDs fail deterministically", () => {
  const contract = structuredClone(minimalContract());
  contract.acceptance_criteria = [
    { id: "AC-001", text: "The first observable outcome is satisfied." },
    { id: "AC-001", text: "The second observable outcome is satisfied." },
  ];

  assert.throws(
    () => validateStudioReadyContract(contract),
    (error) => {
      assert.equal(error.code, "CONTRACT_ACCEPTANCE_CRITERIA_DUPLICATE");
      assert.equal(error.message, "[CONTRACT_ACCEPTANCE_CRITERIA_DUPLICATE] Contract acceptance_criteria ids must be unique.");
      return true;
    },
  );
});

test("invalid profile and role references fail deterministically", () => {
  assert.throws(
    () => minimalContract({ appProfile: { profile_id: "Bad Profile", application_id: "example-app" } }),
    (error) => {
      assert.equal(error.code, "CONTRACT_PROFILE_INVALID");
      assert.equal(
        error.message,
        "[CONTRACT_PROFILE_INVALID] Contract app_profile.profile_id has an invalid identifier: Bad Profile.",
      );
      return true;
    },
  );

  assert.throws(
    () => minimalContract({
      productQuestions: [
        {
          question: "Which product outcome should be prioritised?",
          reason: "product_ambiguity",
          owner_role: "named_person",
        },
      ],
    }),
    (error) => {
      assert.equal(error.code, "CONTRACT_ROLE_INVALID");
      assert.equal(
        error.message,
        "[CONTRACT_ROLE_INVALID] Contract product_questions[0].owner_role is unknown: named_person.",
      );
      return true;
    },
  );
});

test("invalid mode, malformed structure, and unsupported versions fail clearly", () => {
  assert.throws(
    () => minimalContract({ mode: "route-risk" }),
    (error) => {
      assert.equal(error.code, "CONTRACT_MODE_INVALID");
      assert.match(error.message, /Contract mode must be one of/);
      return true;
    },
  );

  const malformed = structuredClone(minimalContract());
  malformed.acceptance_criteria = { id: "AC-001", text: "Not an array." };
  assert.throws(
    () => validateStudioReadyContract(malformed),
    (error) => {
      assert.equal(error.code, "CONTRACT_INVALID");
      assert.equal(error.message, "[CONTRACT_INVALID] Contract acceptance_criteria must be an array.");
      return true;
    },
  );

  const unsupported = structuredClone(minimalContract());
  unsupported.metadata.contract_version = "studio-ready/99";
  assert.throws(
    () => validateStudioReadyContract(unsupported),
    (error) => {
      assert.equal(error.code, "CONTRACT_VERSION_UNSUPPORTED");
      assert.equal(error.message, "[CONTRACT_VERSION_UNSUPPORTED] Unsupported contract_version: studio-ready/99.");
      return true;
    },
  );
});

test("product questions are surfaced only for product judgement, not technical lookup", () => {
  const productAmbiguity = translateStudioReadyRequest({
    request: "Should the report show exact values or rounded trend bands?",
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The chosen report precision is recorded before implementation."],
  });
  const politeRequest = translateStudioReadyRequest({
    request: "Can you make the completion copy clearer?",
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The completion copy is clearer without adding extra steps."],
  });
  const technicalUnknown = translateStudioReadyRequest({
    request: "Which component owns the report header? Make the label easier to understand.",
    appProfile: baseAppProfile(),
    acceptanceCriteria: ["The report header label is easier to understand."],
  });

  assert.deepEqual(productAmbiguity.product_questions, [
    {
      id: "PQ-001",
      question: "Should the report show exact values or rounded trend bands?",
      reason: "product_ambiguity",
      owner_role: "product_owner",
    },
  ]);
  assert.deepEqual(politeRequest.product_questions, []);
  assert.deepEqual(politeRequest.context_requirements, []);
  assert.deepEqual(technicalUnknown.product_questions, []);
  assert.deepEqual(technicalUnknown.context_requirements, [
    "Resolve through implementation evidence: Which component owns the report header?",
  ]);
});

test("Core Stage 4 files stay app/person independent and avoid later-stage mechanisms", () => {
  const coreFiles = listFilesRecursively(path.join(STUDIO_ROOT, "core"));

  for (const filePath of coreFiles) {
    const source = readFileSync(filePath, "utf8");
    for (const [label, pattern] of CORE_FORBIDDEN_TERMS) {
      assert.doesNotMatch(source, pattern, `${path.relative(ROOT_DIR, filePath)} leaked ${label}`);
    }
    for (const pattern of FUTURE_STAGE_TERMS) {
      assert.doesNotMatch(source, pattern, `${path.relative(ROOT_DIR, filePath)} leaked later-stage scope`);
    }
  }
});
