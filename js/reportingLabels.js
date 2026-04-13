export const LEVEL_LADDER_KEYS = ["not_yet_banded", "easier", "core", "stretch", "challenge"];
export const PERFORMANCE_LADDER_KEYS = ["building_profile", "emerging", "developing", "secure", "strong"];
export const EVIDENCE_LADDER_KEYS = ["minimal", "limited", "secure", "strong"];

const LEVEL_DISPLAY_LABELS = {
  not_yet_banded: "Not yet banded",
  easier: "Foundations",
  core: "Core patterns",
  stretch: "Expanding patterns",
  challenge: "Advanced patterns",
};

const PERFORMANCE_DISPLAY_LABELS = {
  building_profile: "Building profile",
  emerging: "Emerging",
  developing: "Developing",
  secure: "Secure",
  strong: "Mastered",
};

const EVIDENCE_DISPLAY_LABELS = {
  minimal: "Building evidence",
  limited: "Building evidence",
  secure: "Secure evidence",
  strong: "Strong evidence",
};

const LEVEL_DEFINITIONS = {
  not_yet_banded: {
    pupil: "You do not have enough checked work yet for the app to estimate your spelling level.",
    teacher: "The pupil does not have enough checked work yet for the app to estimate a spelling level.",
    group: "Pupils in this group do not yet have enough checked work for the app to estimate a group spelling level.",
  },
  easier: {
    pupil: "You are working with simpler spelling patterns and more predictable words.",
    teacher: "The pupil is working with simpler spelling patterns and more predictable words.",
    group: "Pupils in this group are working with simpler spelling patterns and more predictable words.",
  },
  core: {
    pupil: "You are working with common spelling patterns used in everyday words.",
    teacher: "The pupil is working with common spelling patterns used in everyday words.",
    group: "Pupils in this group are working with common spelling patterns used in everyday words.",
  },
  stretch: {
    pupil: "You are working with more complex patterns, including longer words and less obvious spellings.",
    teacher: "The pupil is working with more complex patterns, including longer words and less obvious spellings.",
    group: "Pupils in this group are working with more complex patterns, including longer words and less obvious spellings.",
  },
  challenge: {
    pupil: "You are working with the most demanding spellings in this model.",
    teacher: "The pupil is working with the most demanding spellings in this model.",
    group: "Pupils in this group are working with the most demanding spellings in this model.",
  },
};

const PERFORMANCE_DEFINITIONS = {
  building_profile: {
    pupil: "The app is still building enough evidence to judge how consistently you are spelling at this level.",
    teacher: "The app is still building enough evidence to judge how consistently the pupil is spelling at this level.",
    group: "The app is still building enough evidence to judge how consistently pupils in this group are spelling at this level.",
  },
  emerging: {
    pupil: "You are often getting words wrong at this level.",
    teacher: "The pupil is often getting words wrong at this level.",
    group: "Pupils in this group are often getting words wrong at this level.",
  },
  developing: {
    pupil: "You are getting some words correct at this level, but not consistently yet.",
    teacher: "The pupil is getting some words correct at this level, but not consistently yet.",
    group: "Pupils in this group are getting some words correct at this level, but not consistently yet.",
  },
  secure: {
    pupil: "You are usually correct at this level.",
    teacher: "The pupil is usually correct at this level.",
    group: "Pupils in this group are usually correct at this level.",
  },
  strong: {
    pupil: "You are consistently accurate and reliable at this level.",
    teacher: "The pupil is consistently accurate and reliable at this level.",
    group: "Pupils in this group are consistently accurate and reliable at this level.",
  },
};

const SCORE_DEFINITIONS = {
  pupil: "The score used to calculate your spelling level.",
  teacher: "The score used to calculate the pupil’s spelling level.",
  group: "The score used to calculate the group’s typical spelling level.",
};

const NEXT_STEP_LABELS = {
  not_yet_banded: "Keep building evidence",
  easier: "Next step: Core patterns",
  core: "Next step: Expanding patterns",
  stretch: "Next step: Advanced patterns",
  challenge: "Top band reached",
};

function normalizeKey(key) {
  return String(key || "").trim().toLowerCase();
}

function normalizeContext(context) {
  const normalized = String(context || "").trim().toLowerCase();
  if (normalized === "pupil" || normalized === "teacher" || normalized === "group") {
    return normalized;
  }
  return "teacher";
}

export function getLevelDisplayLabel(key) {
  const normalized = normalizeKey(key);
  return LEVEL_DISPLAY_LABELS[normalized] || LEVEL_DISPLAY_LABELS.not_yet_banded;
}

export function getLevelDisplayLabelFromBand(key) {
  return getLevelDisplayLabel(key);
}

export function getPerformanceDisplayLabel(key) {
  const normalized = normalizeKey(key);
  return PERFORMANCE_DISPLAY_LABELS[normalized] || PERFORMANCE_DISPLAY_LABELS.building_profile;
}

export function getPerformanceDisplayLabelFromKey(key) {
  return getPerformanceDisplayLabel(key);
}

export function getSecurityDisplayLabel(key) {
  return getPerformanceDisplayLabel(key);
}

export function getEvidenceDisplayLabel(key) {
  const normalized = normalizeKey(key);
  return EVIDENCE_DISPLAY_LABELS[normalized] || EVIDENCE_DISPLAY_LABELS.minimal;
}

export function getLevelDefinition(key, context = "teacher") {
  const normalized = normalizeKey(key);
  const scope = normalizeContext(context);
  return LEVEL_DEFINITIONS[normalized]?.[scope] || LEVEL_DEFINITIONS.not_yet_banded[scope];
}

export function getLevelExplanation(key, context = "teacher") {
  return getLevelDefinition(key, context);
}

export function getPerformanceDefinition(key, context = "teacher") {
  const normalized = normalizeKey(key);
  const scope = normalizeContext(context);
  return PERFORMANCE_DEFINITIONS[normalized]?.[scope] || PERFORMANCE_DEFINITIONS.building_profile[scope];
}

export function getScoreDefinition(context = "teacher") {
  const scope = normalizeContext(context);
  return SCORE_DEFINITIONS[scope];
}

export function getNextStepLabel(key) {
  const normalized = normalizeKey(key);
  return NEXT_STEP_LABELS[normalized] || NEXT_STEP_LABELS.not_yet_banded;
}
