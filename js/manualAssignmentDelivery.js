export const DELIVERY_MODEL_LEGACY_FIXED = "legacy_fixed";
export const DELIVERY_MODEL_SUPPORT_LADDER = "support_ladder";

export const MANUAL_ASSIGNMENT_DELIVERY_DEFAULT = DELIVERY_MODEL_LEGACY_FIXED;
export const MANUAL_ASSIGNMENT_SUPPORT_PRESET_BALANCED = "balanced";

export const MANUAL_ASSIGNMENT_DELIVERY_COPY = Object.freeze({
  label: "Delivery style",
  fixedLabel: "Fixed question types",
  fixedDescription: "Use the question types saved in the test.",
  supportLadderLabel: "Support Ladder",
  supportLadderDescription: "Pupils try independently, try once more, then use segmented spelling support before the answer is shown.",
});

export const MANUAL_ASSIGNMENT_DELIVERY_OPTIONS = Object.freeze([
  Object.freeze({
    value: DELIVERY_MODEL_LEGACY_FIXED,
    label: MANUAL_ASSIGNMENT_DELIVERY_COPY.fixedLabel,
    description: MANUAL_ASSIGNMENT_DELIVERY_COPY.fixedDescription,
  }),
  Object.freeze({
    value: DELIVERY_MODEL_SUPPORT_LADDER,
    label: MANUAL_ASSIGNMENT_DELIVERY_COPY.supportLadderLabel,
    description: MANUAL_ASSIGNMENT_DELIVERY_COPY.supportLadderDescription,
  }),
]);

export function normalizeManualAssignmentDeliveryModel(value = "") {
  const key = String(value || "").trim().toLowerCase();
  return key === DELIVERY_MODEL_SUPPORT_LADDER
    ? DELIVERY_MODEL_SUPPORT_LADDER
    : DELIVERY_MODEL_LEGACY_FIXED;
}

export function buildManualAssignmentDeliveryFields(value = "") {
  const deliveryModel = normalizeManualAssignmentDeliveryModel(value);
  if (deliveryModel === DELIVERY_MODEL_SUPPORT_LADDER) {
    return {
      delivery_model: DELIVERY_MODEL_SUPPORT_LADDER,
      support_preset: MANUAL_ASSIGNMENT_SUPPORT_PRESET_BALANCED,
    };
  }

  return {
    delivery_model: DELIVERY_MODEL_LEGACY_FIXED,
    support_preset: null,
  };
}
