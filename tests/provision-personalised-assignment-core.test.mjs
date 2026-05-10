import assert from "node:assert/strict";

import {
  buildAutoAssignedPoolEntries,
  buildAutoAssignedPoolIdMap,
  buildAutoAssignedTargetRows,
  buildPublicProvisioningResponse,
  mapWordloomCoreBankRowsToWordRows,
} from "../supabase/functions/provision-personalised-assignment/provisioningCore.mjs";

const response = buildPublicProvisioningResponse({
  status: "provisioned",
  assignmentId: "11111111-1111-4111-8111-111111111111",
  wordRows: [{ word: "hidden" }],
});

assert.deepEqual(Object.keys(response).sort(), ["assignmentId", "status"]);
assert.equal(response.status, "provisioned");
assert.equal(response.assignmentId, "11111111-1111-4111-8111-111111111111");
assert.deepEqual(buildPublicProvisioningResponse({ status: "not_ready" }), { status: "not_ready" });
assert.deepEqual(buildPublicProvisioningResponse({ status: "unexpected" }), { status: "generation_failed" });

const mappedCoreRows = mapWordloomCoreBankRowsToWordRows({
  wordRows: [
    {
      id: "core-farm",
      word: "farm",
      normalised_word: "farm",
      grapheme_segments: ["f", "ar", "m"],
      primary_focus_grapheme: "ar",
      difficulty_score: 34,
      difficulty_label: "Core",
      difficulty_reason: "Common ar word.",
      sentence: "The farm kept sheep.",
      meaning: "Land used for growing food.",
      suitability_status: "suitable",
      approval_status: "approved",
      source_version: "proof",
      is_active: true,
    },
    {
      id: "core-pending",
      word: "park",
      normalised_word: "park",
      grapheme_segments: ["p", "ar", "k"],
      primary_focus_grapheme: "ar",
      suitability_status: "suitable",
      approval_status: "pending",
      is_active: true,
    },
  ],
  wordTargetRows: [
    {
      id: "link-farm",
      word_id: "core-farm",
      focus_target_id: "target-ar",
      focus_grapheme: "ar",
      target_role: "primary",
    },
    {
      id: "link-pending",
      word_id: "core-pending",
      focus_target_id: "target-ar",
      focus_grapheme: "ar",
      target_role: "primary",
    },
  ],
  focusTargetRows: [
    { id: "target-ar", focus_grapheme: "ar", is_active: true },
  ],
});

assert.equal(mappedCoreRows.length, 1);
assert.equal(mappedCoreRows[0].word, "farm");
assert.deepEqual(mappedCoreRows[0].segments, ["f", "ar", "m"]);
assert.equal(mappedCoreRows[0].choice.source, "wordloom_core");
assert.equal(mappedCoreRows[0].choice.origin_bank_word_id, "core-farm");
assert.equal(mappedCoreRows[0].choice.context_support.meaning, "Land used for growing food.");

const pupilPlans = [
  {
    pupilId: "pupil-one",
    words: [
      {
        word: "farm",
        sentence: "The farm kept sheep.",
        segments: ["f", "ar", "m"],
        questionType: "segmented_spelling",
        assignmentRole: "target",
        assignmentSupport: "independent",
        focusGrapheme: "ar",
        targetReason: "target_independent",
      },
      {
        word: "farm",
        sentence: "The farm kept sheep.",
        segments: ["f", "ar", "m"],
        questionType: "segmented_spelling",
        assignmentRole: "target",
        assignmentSupport: "independent",
        focusGrapheme: "ar",
        targetReason: "target_independent",
      },
    ],
  },
];

const poolEntries = buildAutoAssignedPoolEntries(pupilPlans);
assert.equal(poolEntries.length, 1);
assert.equal(poolEntries[0].payload.word, "farm");
assert.equal(poolEntries[0].payload.choice.assignment_role, "target");
assert.equal(poolEntries[0].payload.choice.engine_focus_grapheme, "ar");

const poolIdBySignature = buildAutoAssignedPoolIdMap([
  {
    id: "test-word-one",
    word: "farm",
    sentence: "The farm kept sheep.",
    segments: ["f", "ar", "m"],
    choice: poolEntries[0].payload.choice,
  },
]);
const targetRows = buildAutoAssignedTargetRows({
  teacherId: "teacher-one",
  assignmentId: "assignment-one",
  assignmentCreatedAt: "2026-05-10T10:00:00.000Z",
  pupilPlans,
  poolIdBySignature,
  schoolId: "school-one",
});

assert.equal(targetRows.length, 2);
assert.equal(targetRows[0].teacher_id, "teacher-one");
assert.equal(targetRows[0].assignment_id, "assignment-one");
assert.equal(targetRows[0].test_word_id, "test-word-one");
assert.equal(targetRows[0].target_source, "assignment_engine_v1");
assert.equal(targetRows[0].school_id, "school-one");

console.log("Passed personalised provisioning helper checks.");
