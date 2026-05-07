import {
  doPersonalisedAutomationPolicyWindowsOverlap,
  getPersonalisedAutomationPolicyLifecycle,
  normalizePersonalisedAutomationPolicy,
} from "./autoAssignPolicy.js?v=1.9";

function normalizeIdList(items = []) {
  return [...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )];
}

function hasOwn(source, key) {
  return !!source && Object.prototype.hasOwnProperty.call(source, key);
}

export function isAutomationPolicyDeleted(rawPolicy = null) {
  if (!rawPolicy || typeof rawPolicy !== "object") return false;
  if (rawPolicy.deleted === true || rawPolicy.is_deleted === true) return true;
  return [
    rawPolicy.deleted_at,
    rawPolicy.deletedAt,
    rawPolicy.removed_at,
    rawPolicy.removedAt,
  ].some((value) => !!String(value || "").trim());
}

export function isAutomationPolicyOverlapCandidate(
  rawPolicy = null,
  {
    currentPolicyId = "",
    today = new Date(),
  } = {},
) {
  if (!rawPolicy || typeof rawPolicy !== "object") return false;
  if (isAutomationPolicyDeleted(rawPolicy)) return false;
  if (rawPolicy.archived === true || rawPolicy.is_archived === true) return false;

  const policy = normalizePersonalisedAutomationPolicy(rawPolicy, { today });
  const policyId = String(policy?.id || "").trim();
  if (!policyId || policyId === String(currentPolicyId || "").trim()) return false;

  const lifecycle = getPersonalisedAutomationPolicyLifecycle(policy, { today });
  if (lifecycle.archived || lifecycle.expired) return false;

  const hasExplicitActiveFlag = hasOwn(rawPolicy, "active");
  if (hasExplicitActiveFlag && policy.active === false && !lifecycle.scheduled) {
    return false;
  }

  return true;
}

export function getAutomationPolicyOverlapMatches({
  policy = null,
  policies = [],
  selectedClassIds = [],
  today = new Date(),
} = {}) {
  const currentPolicy = normalizePersonalisedAutomationPolicy(policy, { today });
  if (isAutomationPolicyDeleted(policy)) return [];
  const explicitSelectedClassIds = Array.isArray(selectedClassIds) ? selectedClassIds : [];
  const selectedIds = normalizeIdList(
    explicitSelectedClassIds.length ? explicitSelectedClassIds : currentPolicy.target_class_ids
  );
  if (!selectedIds.length) return [];
  const selectedIdSet = new Set(selectedIds);
  const currentPolicyId = String(currentPolicy?.id || "").trim();

  return (Array.isArray(policies) ? policies : [])
    .filter((item) => isAutomationPolicyOverlapCandidate(item, { currentPolicyId, today }))
    .filter((item) => doPersonalisedAutomationPolicyWindowsOverlap(currentPolicy, item))
    .map((item) => {
      const classIds = normalizeIdList(item?.target_class_ids || []);
      const overlappingClassIds = classIds.filter((classId) => selectedIdSet.has(classId));
      return {
        policy: normalizePersonalisedAutomationPolicy(item, { today }),
        classIds,
        overlappingClassIds,
      };
    })
    .filter((item) => item.overlappingClassIds.length > 0);
}
