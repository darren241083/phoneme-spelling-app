import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ArtifactLifecycleError,
  createArtifactLifecycleRecord,
  createTier3AuditRecord,
  disposeArtifactLifecycle,
  getTaskArtifactWorkspace,
  gitignoreCoversTaskWorkspace,
  isTaskWorkspacePath,
  promoteArtifactLifecycle,
  retainArtifactReference,
  taskWorkspaceIgnoreRule,
  validateArtifactLifecycleRecord,
  validateTier3AuditRecord,
} from "../studio/core/artifact-lifecycle.mjs";
import { createStudioReadyContract } from "../studio/core/contracts.mjs";
import { loadStudioConfiguration } from "../studio/core/profile-loader.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUDIO_ROOT = path.join(ROOT_DIR, "studio");
const FIXTURE_ROOT = path.join(ROOT_DIR, "tests", "fixtures", "studio");

function readRepoText(relativePath) {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function contract(overrides = {}) {
  return createStudioReadyContract({
    request: "The results panel needs a clearer next action.",
    appProfile: {
      profile_id: "example-app",
      application_id: "example-app",
    },
    acceptanceCriteria: ["The results panel presents one clear next action."],
    declaredRisk: { tier: "tier_1", basis: ["small product surface change"] },
    ...overrides,
  });
}

function lifecycleRecord(overrides = {}) {
  return createArtifactLifecycleRecord({
    taskId: "stage4-contracts",
    contractId: "studio-ready-stage4",
    artifacts: [
      {
        id: "review-note",
        kind: "review_evidence",
        path: ".studio/tasks/stage4-contracts/review-note.json",
        sensitivity: "internal",
      },
    ],
    ...overrides,
  });
}

function promotionPolicy(...destinations) {
  return {
    artifactPromotionDestinations: destinations,
    evidenceSensitivity: { prohibitedPromotion: [] },
  };
}

const PROFILE_SAFEGUARD_DESTINATION = {
  id: "profile-safeguard",
  description: "Durable profile guidance or focused regression test.",
  reference: "profile guidance or focused regression test",
};

const RELEASE_EVIDENCE_DESTINATION = {
  id: "release-evidence",
  description: "Current release checkpoint.",
  reference: "current checkpoint",
};

test("runtime task artifact workspaces default to ephemeral ignored locations", () => {
  const workspace = getTaskArtifactWorkspace({
    repositoryRoot: ROOT_DIR,
    taskId: "stage4-contracts",
  });
  const record = lifecycleRecord();

  assert.equal(workspace.relative_path, ".studio/tasks/stage4-contracts/");
  assert.equal(workspace.absolute_path, path.join(ROOT_DIR, ".studio", "tasks", "stage4-contracts"));
  assert.equal(workspace.ignored_by_default, true);
  assert.equal(record.state, "ephemeral");
  assert.equal(record.workspace.relative_path, ".studio/tasks/stage4-contracts/");
  assert.equal(record.workspace.ignored_by_default, true);
  assert.equal(record.metadata.lifecycle_version, "artifact-lifecycle/1");
});

test("the root ignore rule covers only the task workspace", () => {
  const source = readRepoText(".gitignore");
  const activeRules = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  assert.deepEqual(activeRules, [".studio/tasks/"]);
  assert.equal(taskWorkspaceIgnoreRule(), ".studio/tasks/");
  assert.equal(gitignoreCoversTaskWorkspace(source), true);
  assert.equal(gitignoreCoversTaskWorkspace(".studio/other/"), false);
});

test("task workspace detection normalizes repository path variants without treating opaque references as paths", () => {
  for (const reference of [
    ".studio/tasks/task-1/evidence.json",
    "./.studio/tasks/task-1/evidence.json",
    "././.studio/tasks/task-1/evidence.json",
    ".studio/./tasks/task-1/evidence.json",
    ".studio\\tasks\\task-1\\evidence.json",
    "docs/../.studio/tasks/task-1/evidence.json",
    "docs/sub/../../.studio/tasks/task-1/evidence.json",
    "docs\\..\\.studio\\tasks\\task-1\\evidence.json",
  ]) {
    assert.equal(isTaskWorkspacePath(reference), true, reference);
  }
  for (const reference of [
    "https://example.invalid/.studio/tasks/task-1/evidence.json",
    "https://example.invalid/../../.studio/tasks/task-1/evidence.json",
    "release:.studio/tasks/task-1/evidence.json",
    "release:/../.studio/tasks/task-1/evidence.json",
    ".studio/task-list/evidence.json",
  ]) {
    assert.equal(isTaskWorkspacePath(reference), false, reference);
  }
});

test("promotion is deliberate and names a natural destination", () => {
  const record = lifecycleRecord();
  const promoted = promoteArtifactLifecycle(record, {
    reason: "Reusable decision summary belongs in durable guidance.",
    destination: PROFILE_SAFEGUARD_DESTINATION,
  }, { policy: promotionPolicy(PROFILE_SAFEGUARD_DESTINATION) });

  assert.equal(promoted.state, "promote");
  assert.equal(promoted.promotion.destination.id, "profile-safeguard");
  assert.deepEqual(promoted.artifacts.map(({ id }) => id), ["review-note"]);
});

test("promotion fails closed when destination policy is omitted or empty", () => {
  const promotion = {
    reason: "Attempted unscoped promotion.",
    destination: PROFILE_SAFEGUARD_DESTINATION,
  };

  for (const options of [undefined, { policy: promotionPolicy() }]) {
    assert.throws(
      () => promoteArtifactLifecycle(lifecycleRecord(), promotion, options),
      (error) => {
        assert.equal(
          error.code,
          options === undefined
            ? "ARTIFACT_PROMOTION_POLICY_REQUIRED"
            : "ARTIFACT_PROMOTION_DESTINATION_INVALID",
        );
        return true;
      },
    );
  }

  const forged = {
    ...structuredClone(lifecycleRecord()),
    state: "promote",
    promotion,
  };
  assert.throws(
    () => validateArtifactLifecycleRecord(forged),
    (error) => {
      assert.equal(error.code, "ARTIFACT_PROMOTION_POLICY_REQUIRED");
      return true;
    },
  );
});

test("retained references keep a concise pointer instead of routine task files", () => {
  const promoted = promoteArtifactLifecycle(lifecycleRecord(), {
    reason: "Keep only the useful durable pointer.",
    destination: RELEASE_EVIDENCE_DESTINATION,
  }, { policy: promotionPolicy(RELEASE_EVIDENCE_DESTINATION) });
  const retained = retainArtifactReference(promoted, {
    id: "checkpoint-note",
    description: "Summary of evidence outcomes retained in the current checkpoint.",
    reference: "current checkpoint",
  }, { policy: promotionPolicy(RELEASE_EVIDENCE_DESTINATION) });

  assert.equal(retained.state, "retained-reference");
  assert.deepEqual(retained.artifacts, []);
  assert.equal("promotion" in retained, false);
  assert.equal("disposal" in retained, false);
  assert.deepEqual(retained.retained_references, [
    {
      id: "checkpoint-note",
      description: "Summary of evidence outcomes retained in the current checkpoint.",
      reference: "current checkpoint",
    },
  ]);
});

test("disposal clears routine artifacts while keeping the lifecycle reason", () => {
  const disposed = disposeArtifactLifecycle(lifecycleRecord(), {
    reason: "Routine execution evidence was not promoted.",
  });

  assert.equal(disposed.state, "dispose");
  assert.deepEqual(disposed.artifacts, []);
  assert.equal("promotion" in disposed, false);
  assert.deepEqual(disposed.retained_references, []);
  assert.equal(disposed.disposal.reason, "Routine execution evidence was not promoted.");
});

test("sensitive or prohibited material cannot be promoted", () => {
  const record = lifecycleRecord({
    artifacts: [
      {
        id: "sensitive-note",
        kind: "evidence",
        path: ".studio/tasks/stage4-contracts/sensitive-note.json",
        sensitivity: "secret",
      },
    ],
  });

  assert.throws(
    () => promoteArtifactLifecycle(record, {
      reason: "Attempted durable retention.",
      destination: {
        id: "reference",
        description: "Durable reference.",
        reference: "external secure location",
      },
    }, { policy: promotionPolicy({
      id: "reference",
      description: "Durable reference.",
      reference: "external secure location",
    }) }),
    (error) => {
      assert.ok(error instanceof ArtifactLifecycleError);
      assert.equal(error.code, "ARTIFACT_PROMOTION_BLOCKED");
      assert.equal(error.message, "[ARTIFACT_PROMOTION_BLOCKED] Artifact sensitivity cannot be promoted: secret.");
      return true;
    },
  );
});

test("direct lifecycle validation rejects forged promoted sensitive artifacts", () => {
  const forged = {
    ...structuredClone(lifecycleRecord({
      artifacts: [
        {
          id: "sensitive-note",
          kind: "evidence",
          path: ".studio/tasks/stage4-contracts/sensitive-note.json",
          sensitivity: "secret",
        },
      ],
    })),
    state: "promote",
    promotion: {
      reason: "Attempted durable retention.",
      destination: {
        id: "reference",
        description: "Durable reference.",
        reference: "external secure location",
      },
    },
  };

  assert.throws(
    () => validateArtifactLifecycleRecord(forged, { policy: promotionPolicy({
      id: "reference",
      description: "Durable reference.",
      reference: "external secure location",
    }) }),
    (error) => {
      assert.equal(error.code, "ARTIFACT_PROMOTION_BLOCKED");
      assert.equal(error.message, "[ARTIFACT_PROMOTION_BLOCKED] Artifact sensitivity cannot be promoted: secret.");
      return true;
    },
  );
});

test("promotion also respects per-artifact promotion_allowed flags", () => {
  const record = lifecycleRecord({
    artifacts: [
      {
        id: "temporary-log",
        kind: "runtime_log",
        path: ".studio/tasks/stage4-contracts/log.json",
        sensitivity: "internal",
        promotion_allowed: false,
      },
    ],
  });

  assert.throws(
    () => promoteArtifactLifecycle(record, {
      reason: "Attempted durable retention.",
      destination: {
        id: "reference",
        description: "Durable reference.",
        reference: "approved destination",
      },
    }, { policy: promotionPolicy({
      id: "reference",
      description: "Durable reference.",
      reference: "approved destination",
    }) }),
    (error) => {
      assert.equal(error.code, "ARTIFACT_PROMOTION_BLOCKED");
      assert.equal(error.message, "[ARTIFACT_PROMOTION_BLOCKED] Artifact cannot be promoted: temporary-log.");
      return true;
    },
  );
});

test("artifact paths must stay under the declared task workspace", () => {
  assert.throws(
    () => lifecycleRecord({
      artifacts: [
        {
          id: "outside-note",
          kind: "review_evidence",
          path: "docs/outside-note.json",
          sensitivity: "internal",
        },
      ],
    }),
    (error) => {
      assert.equal(error.code, "ARTIFACT_WORKSPACE_INVALID");
      assert.equal(
        error.message,
        "[ARTIFACT_WORKSPACE_INVALID] Artifact artifacts path must stay under .studio/tasks/stage4-contracts/: outside-note.",
      );
      return true;
    },
  );
});

test("workspace path must match the lifecycle task id", () => {
  const forged = structuredClone(lifecycleRecord());
  forged.workspace.relative_path = ".studio/tasks/other-task/";

  assert.throws(
    () => validateArtifactLifecycleRecord(forged),
    (error) => {
      assert.equal(error.code, "ARTIFACT_WORKSPACE_INVALID");
      assert.equal(error.message, "[ARTIFACT_WORKSPACE_INVALID] Artifact workspace.relative_path must be .studio/tasks/stage4-contracts/.");
      return true;
    },
  );
});

test("lifecycle artifact and retained-reference IDs must be unique", () => {
  assert.throws(
    () => lifecycleRecord({
      artifacts: [
        {
          id: "duplicate-note",
          kind: "evidence",
          path: ".studio/tasks/stage4-contracts/first.json",
          sensitivity: "internal",
        },
        {
          id: "duplicate-note",
          kind: "evidence",
          path: ".studio/tasks/stage4-contracts/second.json",
          sensitivity: "internal",
        },
      ],
    }),
    (error) => {
      assert.equal(error.code, "ARTIFACT_LIFECYCLE_INVALID");
      assert.equal(error.message, "[ARTIFACT_LIFECYCLE_INVALID] Artifact artifacts ids must be unique.");
      return true;
    },
  );

  const retained = {
    ...structuredClone(lifecycleRecord()),
    state: "retained-reference",
    artifacts: [],
    retained_references: [
      { id: "same-reference", description: "First.", reference: "first checkpoint" },
      { id: "same-reference", description: "Second.", reference: "second checkpoint" },
    ],
  };
  assert.throws(
    () => validateArtifactLifecycleRecord(retained),
    (error) => {
      assert.equal(error.code, "ARTIFACT_LIFECYCLE_INVALID");
      assert.equal(
        error.message,
        "[ARTIFACT_LIFECYCLE_INVALID] Artifact retained_references ids must be unique.",
      );
      return true;
    },
  );
});

test("retained lifecycle references must be bounded and durable", () => {
  for (const reference of [
    "./.studio/tasks/stage4-contracts/evidence.json",
    "docs/../.studio/tasks/stage4-contracts/evidence.json",
  ]) {
    assert.throws(
      () => retainArtifactReference(lifecycleRecord(), {
        id: "temporary-reference",
        description: "Temporary task evidence.",
        reference,
      }),
      (error) => {
        assert.equal(error.code, "ARTIFACT_RETENTION_INVALID");
        assert.match(error.message, /must not point to an ephemeral task workspace/);
        return true;
      },
      reference,
    );
  }

  const retained = {
    ...structuredClone(lifecycleRecord()),
    state: "retained-reference",
    artifacts: [],
    retained_references: [
      { id: "long-reference", description: "Durable pointer.", reference: "x".repeat(301) },
    ],
  };
  assert.throws(
    () => validateArtifactLifecycleRecord(retained),
    (error) => {
      assert.equal(error.code, "ARTIFACT_RETENTION_INVALID");
      assert.equal(
        error.message,
        "[ARTIFACT_RETENTION_INVALID] Artifact retained_references[0].reference must not exceed 300 characters.",
      );
      return true;
    },
  );
});

test("disposed and retained-reference records cannot keep artifact paths", () => {
  const disposed = {
    ...structuredClone(lifecycleRecord()),
    state: "dispose",
    disposal: { reason: "Routine evidence was not promoted." },
  };
  const retained = {
    ...structuredClone(lifecycleRecord()),
    state: "retained-reference",
    retained_references: [
      {
        id: "checkpoint-note",
        description: "Summary retained elsewhere.",
        reference: "current checkpoint",
      },
    ],
  };

  assert.throws(
    () => validateArtifactLifecycleRecord(disposed),
    (error) => {
      assert.equal(error.code, "ARTIFACT_DISPOSAL_INVALID");
      assert.equal(error.message, "[ARTIFACT_DISPOSAL_INVALID] Disposed artifact records must not keep artifact paths.");
      return true;
    },
  );
  assert.throws(
    () => validateArtifactLifecycleRecord(retained),
    (error) => {
      assert.equal(error.code, "ARTIFACT_RETENTION_INVALID");
      assert.equal(error.message, "[ARTIFACT_RETENTION_INVALID] Retained-reference records must not keep artifact paths.");
      return true;
    },
  );
});

test("profile-backed lifecycle policy rejects unknown destinations and prohibited sensitivities", () => {
  const policy = loadStudioConfiguration({ studioRoot: STUDIO_ROOT }).operational.profile.studioReady;

  assert.throws(
    () => promoteArtifactLifecycle(
      lifecycleRecord(),
      {
        reason: "Unknown destination.",
        destination: {
          id: "unknown-destination",
          description: "Not declared in the active profile.",
          reference: "unknown",
        },
      },
      { policy },
    ),
    (error) => {
      assert.equal(error.code, "ARTIFACT_PROMOTION_DESTINATION_INVALID");
      assert.equal(
        error.message,
        "[ARTIFACT_PROMOTION_DESTINATION_INVALID] Artifact promotion destination is not allowed: unknown-destination.",
      );
      return true;
    },
  );

  assert.throws(
    () => promoteArtifactLifecycle(
      lifecycleRecord({
        artifacts: [
          {
            id: "credential-note",
            kind: "evidence",
            path: ".studio/tasks/stage4-contracts/credential-note.json",
            sensitivity: "credential",
          },
        ],
      }),
      {
        reason: "Known destination but prohibited sensitivity.",
        destination: {
          id: "release-evidence",
          description: "Release evidence moves to the current checkpoint when relevant.",
          reference: "current checkpoint",
        },
      },
      { policy },
    ),
    (error) => {
      assert.equal(error.code, "ARTIFACT_PROMOTION_BLOCKED");
      assert.equal(error.message, "[ARTIFACT_PROMOTION_BLOCKED] Artifact sensitivity cannot be promoted: credential.");
      return true;
    },
  );
});

test("alternate app lifecycle policy governs promotion destinations and sensitivity", () => {
  const policy = loadStudioConfiguration({
    studioRoot: STUDIO_ROOT,
    profilePath: path.join(FIXTURE_ROOT, "alternate-app-profile.json"),
  }).operational.profile.studioReady;
  const destination = policy.artifactPromotionDestinations[0];
  const promoted = promoteArtifactLifecycle(
    lifecycleRecord(),
    {
      reason: "Record approved lifecycle evidence.",
      destination,
    },
    { policy },
  );

  assert.equal(promoted.state, "promote");
  assert.deepEqual(promoted.promotion.destination, destination);
  assert.throws(
    () => promoteArtifactLifecycle(
      lifecycleRecord({
        artifacts: [
          {
            id: "supplier-note",
            kind: "evidence",
            path: ".studio/tasks/stage4-contracts/supplier-note.json",
            sensitivity: "supplier_confidential",
          },
        ],
      }),
      {
        reason: "Attempt to record prohibited supplier evidence.",
        destination,
      },
      { policy },
    ),
    (error) => {
      assert.equal(error.code, "ARTIFACT_PROMOTION_BLOCKED");
      assert.equal(
        error.message,
        "[ARTIFACT_PROMOTION_BLOCKED] Artifact sensitivity cannot be promoted: supplier_confidential.",
      );
      return true;
    },
  );
});

test("profile-backed lifecycle policy requires exact destination details", () => {
  const policy = loadStudioConfiguration({ studioRoot: STUDIO_ROOT }).operational.profile.studioReady;

  assert.throws(
    () => promoteArtifactLifecycle(
      lifecycleRecord(),
      {
        reason: "Known id with a mismatched destination.",
        destination: {
          id: "release-evidence",
          description: "Release evidence moves to the current checkpoint when relevant.",
          path: "docs/",
        },
      },
      { policy },
    ),
    (error) => {
      assert.equal(error.code, "ARTIFACT_PROMOTION_DESTINATION_INVALID");
      assert.equal(error.message, "[ARTIFACT_PROMOTION_DESTINATION_INVALID] Artifact promotion destination path is not allowed for: release-evidence.");
      return true;
    },
  );

  assert.throws(
    () => promoteArtifactLifecycle(
      lifecycleRecord(),
      {
        reason: "Known id with a mismatched reference.",
        destination: {
          id: "release-evidence",
          description: "Release evidence moves to the current checkpoint when relevant.",
          reference: "different checkpoint",
        },
      },
      { policy },
    ),
    (error) => {
      assert.equal(error.code, "ARTIFACT_PROMOTION_DESTINATION_INVALID");
      assert.equal(error.message, "[ARTIFACT_PROMOTION_DESTINATION_INVALID] Artifact promotion destination reference must match policy for: release-evidence.");
      return true;
    },
  );
});

test("profile sensitivity policy is additive and cannot weaken Core defaults", () => {
  const policy = {
    artifactPromotionDestinations: [
      {
        id: "release-evidence",
        reference: "current checkpoint",
      },
    ],
    evidenceSensitivity: {
      prohibitedPromotion: [],
    },
  };

  assert.throws(
    () => promoteArtifactLifecycle(
      lifecycleRecord({
        artifacts: [
          {
            id: "secret-note",
            kind: "evidence",
            path: ".studio/tasks/stage4-contracts/secret-note.json",
            sensitivity: "secret",
          },
        ],
      }),
      {
        reason: "Known destination but Core-prohibited sensitivity.",
        destination: {
          id: "release-evidence",
          description: "Release evidence.",
          reference: "current checkpoint",
        },
      },
      { policy },
    ),
    (error) => {
      assert.equal(error.code, "ARTIFACT_PROMOTION_BLOCKED");
      assert.equal(error.message, "[ARTIFACT_PROMOTION_BLOCKED] Artifact sensitivity cannot be promoted: secret.");
      return true;
    },
  );

  assert.throws(
    () => promoteArtifactLifecycle(
      lifecycleRecord({
        artifacts: [
          {
            id: "confidential-note",
            kind: "evidence",
            path: ".studio/tasks/stage4-contracts/confidential-note.json",
            sensitivity: "confidential",
          },
        ],
      }),
      {
        reason: "Known destination but profile-prohibited sensitivity.",
        destination: {
          id: "release-evidence",
          description: "Release evidence.",
          reference: "current checkpoint",
        },
      },
      {
        policy: {
          artifactPromotionDestinations: policy.artifactPromotionDestinations,
          evidenceSensitivity: {
            prohibitedPromotion: ["confidential"],
          },
        },
      },
    ),
    (error) => {
      assert.equal(error.code, "ARTIFACT_PROMOTION_BLOCKED");
      assert.equal(error.message, "[ARTIFACT_PROMOTION_BLOCKED] Artifact sensitivity cannot be promoted: confidential.");
      return true;
    },
  );
});

test("lifecycle records reject irrelevant stale state fields", () => {
  const ephemeral = {
    ...structuredClone(lifecycleRecord()),
    promotion: {
      reason: "Stale promotion.",
      destination: {
        id: "reference",
        description: "Stale destination.",
        reference: "stale",
      },
    },
    disposal: {
      reason: "Stale disposal.",
    },
  };
  const promoted = {
    ...structuredClone(lifecycleRecord()),
    state: "promote",
    promotion: {
      reason: "Promotion.",
      destination: {
        id: "reference",
        description: "Durable reference.",
        reference: "current checkpoint",
      },
    },
    disposal: {
      reason: "Stale disposal.",
    },
  };
  const retained = {
    ...structuredClone(disposeArtifactLifecycle(lifecycleRecord(), {
      reason: "Routine evidence was not promoted.",
    })),
    state: "retained-reference",
    retained_references: [
      {
        id: "checkpoint-note",
        description: "Summary retained elsewhere.",
        reference: "current checkpoint",
      },
    ],
    promotion: {
      reason: "Stale promotion.",
      destination: {
        id: "reference",
        description: "Stale destination.",
        reference: "stale",
      },
    },
  };
  const disposed = {
    ...structuredClone(disposeArtifactLifecycle(lifecycleRecord(), {
      reason: "Routine evidence was not promoted.",
    })),
    retained_references: [
      {
        id: "checkpoint-note",
        description: "Stale retained reference.",
        reference: "current checkpoint",
      },
    ],
  };

  assert.throws(
    () => validateArtifactLifecycleRecord(ephemeral),
    (error) => {
      assert.equal(error.code, "ARTIFACT_STATE_INVALID");
      assert.equal(error.message, "[ARTIFACT_STATE_INVALID] Ephemeral records must not carry promotion, disposal, or retained references.");
      return true;
    },
  );
  assert.throws(
    () => validateArtifactLifecycleRecord(promoted),
    (error) => {
      assert.equal(error.code, "ARTIFACT_STATE_INVALID");
      assert.equal(error.message, "[ARTIFACT_STATE_INVALID] Promoted records must not carry disposal or retained references.");
      return true;
    },
  );
  assert.throws(
    () => validateArtifactLifecycleRecord(retained),
    (error) => {
      assert.equal(error.code, "ARTIFACT_STATE_INVALID");
      assert.equal(error.message, "[ARTIFACT_STATE_INVALID] Retained-reference records must not carry promotion or disposal details.");
      return true;
    },
  );
  assert.throws(
    () => validateArtifactLifecycleRecord(disposed),
    (error) => {
      assert.equal(error.code, "ARTIFACT_STATE_INVALID");
      assert.equal(error.message, "[ARTIFACT_STATE_INVALID] Disposed records must not carry promotion or retained references.");
      return true;
    },
  );
});

test("Tier 3 audit records retain concise consequential evidence only", () => {
  const tier3Contract = contract({
    request: "Should individual account data be visible in the export?",
    desiredOutcome: "A consequential visibility choice is approved before implementation.",
    declaredRisk: { tier: "tier_3", basis: ["privacy-sensitive visibility decision"] },
    acceptanceCriteria: [
      "The selected visibility outcome is recorded before implementation starts.",
    ],
  });
  const audit = createTier3AuditRecord({
    contract: tier3Contract,
    riskBasis: ["privacy-sensitive visibility decision"],
    commitRef: "abc1234",
    evidenceOutcomes: [
      {
        id: "evidence-summary",
        outcome: "Contract reviewed and accepted for planned implementation.",
        reference: "current checkpoint",
      },
    ],
    materialDeviations: ["None."],
    approvals: [
      {
        id: "product-approval",
        role: "product_owner",
        summary: "Approved the visibility basis.",
        reference: "approval note",
      },
    ],
  });

  assert.equal(audit.audit_type, "tier_3_concise_audit");
  assert.equal(audit.contract_id, tier3Contract.contract_id);
  assert.match(audit.contract_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(audit).sort(), [
    "approvals",
    "audit_type",
    "commit_ref",
    "contract_hash",
    "contract_id",
    "evidence_outcomes",
    "material_deviations",
    "metadata",
    "risk_basis",
    "schema_version",
  ]);
  assert.equal(JSON.stringify(audit).includes(".studio/tasks/"), false);
  assert.equal(JSON.stringify(audit).includes("raw_conversation"), false);
});

test("Tier 3 audit records reject non-Tier 3 contracts and malformed retention bloat", () => {
  assert.throws(
    () => createTier3AuditRecord({
      contract: contract(),
      riskBasis: ["ordinary low-risk change"],
    }),
    (error) => {
      assert.equal(error.code, "TIER_3_AUDIT_INVALID");
      assert.equal(error.message, "[TIER_3_AUDIT_INVALID] Tier 3 audit requires a tier_3 contract.");
      return true;
    },
  );

  const tier3Contract = contract({
    declaredRisk: { tier: "tier_3", basis: ["consequential decision"] },
  });
  assert.throws(
    () => createTier3AuditRecord({
      contract: tier3Contract,
      riskBasis: ["consequential decision"],
      evidenceOutcomes: [
        {
          id: "raw-note",
          outcome: "Captured.",
          raw_conversation: "Do not retain this.",
        },
      ],
    }),
    (error) => {
      assert.equal(error.code, "TIER_3_AUDIT_INVALID");
      assert.equal(
        error.message,
        "[TIER_3_AUDIT_INVALID] Tier 3 audit evidence_outcomes[0] contains unsupported field: raw_conversation.",
      );
      return true;
    },
  );
});

test("lifecycle validation failures are stable and useful", () => {
  const malformed = structuredClone(lifecycleRecord());
  malformed.state = "archive";

  assert.throws(
    () => validateArtifactLifecycleRecord(malformed),
    (error) => {
      assert.equal(error.code, "ARTIFACT_LIFECYCLE_INVALID");
      assert.match(error.message, /Artifact state must be one of/);
      return true;
    },
  );

  const unsupported = structuredClone(lifecycleRecord());
  unsupported.metadata.lifecycle_version = "artifact-lifecycle/99";
  assert.throws(
    () => validateArtifactLifecycleRecord(unsupported),
    (error) => {
      assert.equal(error.code, "ARTIFACT_LIFECYCLE_VERSION_UNSUPPORTED");
      assert.equal(
        error.message,
        "[ARTIFACT_LIFECYCLE_VERSION_UNSUPPORTED] Unsupported lifecycle_version: artifact-lifecycle/99.",
      );
      return true;
    },
  );
});

test("Tier 3 audit validation is deterministic", () => {
  const tier3Contract = contract({
    declaredRisk: { tier: "tier_3", basis: ["consequential decision"] },
  });
  const audit = createTier3AuditRecord({
    contract: tier3Contract,
    riskBasis: ["consequential decision"],
  });
  const malformedHash = structuredClone(audit);
  malformedHash.contract_hash = "A".repeat(64);
  const unsupported = structuredClone(audit);
  unsupported.metadata.audit_version = "tier-3-audit/99";

  assert.equal(validateTier3AuditRecord(audit).metadata.audit_version, "tier-3-audit/1");
  assert.throws(
    () => validateTier3AuditRecord(malformedHash),
    (error) => {
      assert.equal(error.code, "TIER_3_AUDIT_INVALID");
      assert.equal(
        error.message,
        "[TIER_3_AUDIT_INVALID] Tier 3 audit contract_hash must be exactly 64 lowercase SHA-256 hexadecimal characters.",
      );
      return true;
    },
  );
  assert.throws(
    () => validateTier3AuditRecord(unsupported),
    (error) => {
      assert.equal(error.code, "TIER_3_AUDIT_VERSION_UNSUPPORTED");
      assert.equal(error.message, "[TIER_3_AUDIT_VERSION_UNSUPPORTED] Unsupported audit_version: tier-3-audit/99.");
      return true;
    },
  );
});

test("Tier 3 concise audit validation rejects unknown roles, duplicate IDs, bloat, and ephemeral references", () => {
  const tier3Contract = contract({
    declaredRisk: { tier: "tier_3", basis: ["consequential decision"] },
  });
  const audit = createTier3AuditRecord({
    contract: tier3Contract,
    riskBasis: ["consequential decision"],
  });
  const unknownRole = structuredClone(audit);
  unknownRole.approvals = [
    { id: "approval", role: "release_manager", summary: "Approved." },
  ];
  const duplicateOutcomes = structuredClone(audit);
  duplicateOutcomes.evidence_outcomes = [
    { id: "result", outcome: "First result." },
    { id: "result", outcome: "Second result." },
  ];
  const oversizedOutcome = structuredClone(audit);
  oversizedOutcome.evidence_outcomes = [
    { id: "result", outcome: "x".repeat(501) },
  ];
  const ephemeralReference = structuredClone(audit);
  ephemeralReference.evidence_outcomes = [
    {
      id: "result",
      outcome: "Checked.",
      reference: ".studio/tasks/stage4-contracts/result.json",
    },
  ];

  assert.throws(
    () => validateTier3AuditRecord(unknownRole),
    (error) => {
      assert.equal(error.code, "TIER_3_AUDIT_INVALID");
      assert.match(error.message, /role is unknown: release_manager/);
      return true;
    },
  );
  assert.throws(
    () => validateTier3AuditRecord(duplicateOutcomes),
    (error) => {
      assert.equal(error.code, "TIER_3_AUDIT_INVALID");
      assert.equal(
        error.message,
        "[TIER_3_AUDIT_INVALID] Tier 3 audit evidence_outcomes ids must be unique.",
      );
      return true;
    },
  );
  assert.throws(
    () => validateTier3AuditRecord(oversizedOutcome),
    (error) => {
      assert.equal(error.code, "TIER_3_AUDIT_INVALID");
      assert.match(error.message, /must not exceed 500 characters/);
      return true;
    },
  );
  assert.throws(
    () => validateTier3AuditRecord(ephemeralReference),
    (error) => {
      assert.equal(error.code, "TIER_3_AUDIT_INVALID");
      assert.match(error.message, /must not point to an ephemeral task workspace/);
      return true;
    },
  );
});

test("Tier 3 commit and release references must be bounded and durable", () => {
  const tier3Contract = contract({
    declaredRisk: { tier: "tier_3", basis: ["consequential decision"] },
  });

  assert.throws(
    () => createTier3AuditRecord({
      contract: tier3Contract,
      riskBasis: ["consequential decision"],
      commitRef: ".studio/tasks/stage4-contracts/commit.txt",
    }),
    (error) => {
      assert.equal(error.code, "TIER_3_AUDIT_INVALID");
      assert.match(error.message, /commit_ref must not point to an ephemeral task workspace/);
      return true;
    },
  );
  assert.throws(
    () => createTier3AuditRecord({
      contract: tier3Contract,
      riskBasis: ["consequential decision"],
      releaseRef: "x".repeat(301),
    }),
    (error) => {
      assert.equal(error.code, "TIER_3_AUDIT_INVALID");
      assert.match(error.message, /release_ref must not exceed 300 characters/);
      return true;
    },
  );

  const audit = createTier3AuditRecord({
    contract: tier3Contract,
    riskBasis: ["consequential decision"],
  });
  const longCommit = { ...structuredClone(audit), commit_ref: "x".repeat(301) };
  const temporaryRelease = {
    ...structuredClone(audit),
    release_ref: ".studio/./tasks/stage4-contracts/release.txt",
  };

  assert.throws(() => validateTier3AuditRecord(longCommit), /commit_ref must not exceed 300 characters/);
  assert.throws(
    () => validateTier3AuditRecord(temporaryRelease),
    /release_ref must not point to an ephemeral task workspace/,
  );
});
