import { getDifficultyBand, getDifficultyDisplayLabel, getStoredDifficultyModelForWord } from "./researchDifficulty.js?v=2.4";
import {
  getEvidenceDisplayLabel,
  getLevelDisplayLabel,
  getLevelDefinition,
  getNextStepLabel,
  getPerformanceDefinition,
  getPerformanceDisplayLabel,
  getScoreDefinition,
} from "./reportingLabels.js?v=1.1";

const PRIOR_MEAN = 0;
const PRIOR_VARIANCE = 1.25;
const THETA_MIN = -4;
const THETA_MAX = 4;
const REPORTING_SCALE_DIVISOR = 1.15;
const SECURE_THRESHOLD_LOGIT = 1.0986122886681098;
const DIFFICULTY_BAND_ORDER = ["easier", "core", "stretch", "challenge"];
const DIFFICULTY_BAND_METADATA = {
  easier: { key: "easier", label: "Easier", tone: "easier" },
  core: { key: "core", label: "Core", tone: "core" },
  stretch: { key: "stretch", label: "Stretch", tone: "stretch" },
  challenge: { key: "challenge", label: "Challenge", tone: "challenge" },
  not_yet_banded: { key: "not_yet_banded", label: "Not yet banded", tone: "neutral" },
};
const SECURITY_KEY_ORDER = ["building_profile", "emerging", "developing", "secure", "strong"];
const SPELLING_INDICATOR_EVIDENCE_BANDS = [
  {
    key: "strong",
    label: getEvidenceDisplayLabel("strong"),
    minResponses: 18,
    maxStandardError: 0.52,
    description: "18+ checked responses with low model uncertainty.",
  },
  {
    key: "secure",
    label: getEvidenceDisplayLabel("secure"),
    minResponses: 10,
    maxStandardError: 0.72,
    description: "10+ checked responses with controlled model uncertainty.",
  },
  {
    key: "limited",
    label: getEvidenceDisplayLabel("limited"),
    minResponses: 4,
    maxStandardError: null,
    description: "At least 4 checked responses, but the estimate is still provisional.",
  },
  {
    key: "minimal",
    label: getEvidenceDisplayLabel("minimal"),
    minResponses: 0,
    maxStandardError: null,
    description: "Fewer than 4 checked responses, so the estimate can move quickly.",
  },
];
const SPELLING_INDICATOR_RESEARCH_REFERENCES = [
  {
    key: "rasch",
    citation: "Rasch (1960)",
    summary: "Established the one-parameter logistic measurement model for attainment tests.",
    href: "https://openlibrary.org/books/OL5863068M/Probabilistic_models_for_some_intelligence_and_attainment_tests",
  },
  {
    key: "spencer_2007",
    citation: "Spencer (2007)",
    summary: "Showed spelling difficulty can be predicted from orthographic transparency, phonemic and graphemic length, and word frequency.",
    href: "https://pubmed.ncbi.nlm.nih.gov/17456275/",
  },
  {
    key: "saha_2021",
    citation: "Saha et al. (2021)",
    summary: "Validated letter-sound discrepancy, grapheme-phoneme complexity, and blend count as meaningful difficulty components.",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8011635/",
  },
  {
    key: "godin_2021",
    citation: "Godin et al. (2021)",
    summary: "Found silent-letter production is a major source of spelling difficulty.",
    href: "https://pubmed.ncbi.nlm.nih.gov/34185580/",
  },
  {
    key: "schmalz_2026",
    citation: "Schmalz et al. (2026)",
    summary: "Argued orthographic depth is best understood through complexity and unpredictability, including multiletter and context-sensitive mappings.",
    href: "https://link.springer.com/10.3758/s13423-025-02831-1",
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function logistic(value) {
  if (value >= 0) {
    const exp = Math.exp(-value);
    return 1 / (1 + exp);
  }
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function logit(probability) {
  const p = clamp(Number(probability || 0), 0.0001, 0.9999);
  return Math.log(p / (1 - p));
}

function thetaToScale(theta) {
  return Math.round(logistic(Number(theta || 0) / REPORTING_SCALE_DIVISOR) * 100);
}

function getDifficultyBandByKey(key) {
  const normalized = String(key || "").trim().toLowerCase();
  const band = DIFFICULTY_BAND_METADATA[normalized];
  return band ? { ...band } : null;
}

function getEvidenceLevel(responseCount, standardError) {
  const count = Math.max(0, Number(responseCount || 0));
  const se = Number.isFinite(Number(standardError)) ? Number(standardError) : Number.POSITIVE_INFINITY;

  if (count >= 18 && se <= 0.52) return { key: "strong", label: getEvidenceDisplayLabel("strong") };
  if (count >= 10 && se <= 0.72) return { key: "secure", label: getEvidenceDisplayLabel("secure") };
  if (count >= 4) return { key: "limited", label: getEvidenceDisplayLabel("limited") };
  return { key: "minimal", label: getEvidenceDisplayLabel("minimal") };
}

function buildCompanionIndicators({
  checkedAccuracy = null,
  firstTimeCorrectRate = null,
  completionRate = null,
  averageAttempts = null,
}) {
  return {
    checkedAccuracy: Number.isFinite(Number(checkedAccuracy)) ? Number(checkedAccuracy) : null,
    firstTimeCorrectRate: Number.isFinite(Number(firstTimeCorrectRate)) ? Number(firstTimeCorrectRate) : null,
    completionRate: Number.isFinite(Number(completionRate)) ? Number(completionRate) : null,
    averageAttempts: Number.isFinite(Number(averageAttempts)) ? Number(averageAttempts) : null,
  };
}

function buildSecurityReport(normalizedResponses, secureDifficultyScore, responseCount) {
  const checkedResponses = Array.isArray(normalizedResponses) ? normalizedResponses : [];
  const totalResponseCount = Math.max(0, Number(responseCount || checkedResponses.length || 0));
  const score = Number(secureDifficultyScore);
  const bands = [12, 18];
  let subset = [];

  if (Number.isFinite(score)) {
    for (const bandWidth of bands) {
      subset = checkedResponses.filter((item) => Math.abs(Number(item?.difficultyScore || 0) - score) <= bandWidth);
      if (subset.length >= 4) break;
    }
  }

  if (subset.length < 4) {
    subset = [...checkedResponses];
  }

  const securityResponseCount = subset.length;
  const securityAccuracy = securityResponseCount
    ? subset.filter((item) => !!item?.correct).length / securityResponseCount
    : null;

  if (totalResponseCount < 4) {
    return {
      key: "building_profile",
      label: getPerformanceDisplayLabel("building_profile"),
      accuracy: securityAccuracy == null ? null : round(securityAccuracy, 3),
      responseCount: securityResponseCount,
    };
  }

  if (securityAccuracy == null || securityAccuracy < 0.5) {
    return {
      key: "emerging",
      label: getPerformanceDisplayLabel("emerging"),
      accuracy: securityAccuracy == null ? null : round(securityAccuracy, 3),
      responseCount: securityResponseCount,
    };
  }

  if (securityAccuracy < 0.7) {
    return {
      key: "developing",
      label: getPerformanceDisplayLabel("developing"),
      accuracy: round(securityAccuracy, 3),
      responseCount: securityResponseCount,
    };
  }

  if (securityAccuracy < 0.85) {
    return {
      key: "secure",
      label: getPerformanceDisplayLabel("secure"),
      accuracy: round(securityAccuracy, 3),
      responseCount: securityResponseCount,
    };
  }

  return {
    key: "strong",
    label: getPerformanceDisplayLabel("strong"),
    accuracy: round(securityAccuracy, 3),
    responseCount: securityResponseCount,
  };
}

function buildIndicatorReportingFields({
  responseCount,
  normalizedResponses,
  secureDifficultyScore,
  secureDifficultyBand,
  evidence,
}) {
  const hasBand = Number(responseCount || 0) >= 4 && !!secureDifficultyBand;
  const attainmentBand = hasBand ? secureDifficultyBand : null;
  const reportedBandKey = attainmentBand?.key || "not_yet_banded";
  const nextDifficultyBand = attainmentBand ? getNextDifficultyBand(attainmentBand.key) : null;
  const performance = buildSecurityReport(normalizedResponses, secureDifficultyScore, responseCount);
  const attainmentDisplayLabel = getAttainmentDisplayLabel(reportedBandKey);
  const nextAttainmentDisplayLabel = nextDifficultyBand ? getAttainmentDisplayLabel(nextDifficultyBand.key) : null;
  const evidenceDisplayLabel = getPupilFacingEvidenceLabel(evidence?.key);
  const nextStepLabel = getNextStepLabel(reportedBandKey);
  const performanceDisplayLabel = getPerformanceDisplayLabel(performance.key);
  const levelDefinitionPupil = getLevelDefinition(reportedBandKey, "pupil");
  const levelDefinitionTeacher = getLevelDefinition(reportedBandKey, "teacher");
  const levelDefinitionGroup = getLevelDefinition(reportedBandKey, "group");
  const performanceDefinitionPupil = getPerformanceDefinition(performance.key, "pupil");
  const performanceDefinitionTeacher = getPerformanceDefinition(performance.key, "teacher");
  const performanceDefinitionGroup = getPerformanceDefinition(performance.key, "group");
  const scoreDefinitionPupil = getScoreDefinition("pupil");
  const scoreDefinitionTeacher = getScoreDefinition("teacher");
  const scoreDefinitionGroup = getScoreDefinition("group");

  return {
    secureDifficultyScore: Number.isFinite(Number(secureDifficultyScore)) ? round(secureDifficultyScore, 1) : null,
    secureDifficultyBand: secureDifficultyBand
      ? { ...secureDifficultyBand, displayLabel: getDifficultyDisplayLabel(secureDifficultyBand.key) }
      : null,
    attainmentBand,
    nextDifficultyBand: nextDifficultyBand
      ? {
        ...nextDifficultyBand,
        displayLabel: getDifficultyDisplayLabel(nextDifficultyBand.key),
        attainmentDisplayLabel: getAttainmentDisplayLabel(nextDifficultyBand.key),
      }
      : null,
    attainmentDisplayLabel,
    difficultyDisplayLabel: secureDifficultyBand ? getDifficultyDisplayLabel(secureDifficultyBand.key) : null,
    nextAttainmentDisplayLabel,
    attainmentExplanation: levelDefinitionPupil,
    levelDefinitionPupil,
    levelDefinitionTeacher,
    levelDefinitionGroup,
    nextStepLabel,
    performanceKey: performance.key,
    performanceDisplayLabel,
    performanceDefinitionPupil,
    performanceDefinitionTeacher,
    performanceDefinitionGroup,
    performanceAccuracy: performance.accuracy,
    performanceResponseCount: performance.responseCount,
    scoreDefinitionPupil,
    scoreDefinitionTeacher,
    scoreDefinitionGroup,
    securityKey: performance.key,
    securityLabel: performanceDisplayLabel,
    securityAccuracy: performance.accuracy,
    securityResponseCount: performance.responseCount,
    headlineAttainmentLabel: hasBand
      ? `${attainmentDisplayLabel} - ${performanceDisplayLabel}`
      : getLevelDisplayLabel("not_yet_banded"),
    pupilFacingBandLabel: getPupilFacingBandLabel(reportedBandKey),
    teacherFacingBandLabel: getTeacherFacingBandLabel(reportedBandKey),
    pupilFacingBandDescription: getPupilFacingBandDescription(reportedBandKey),
    pupilFacingEvidenceLabel: evidenceDisplayLabel,
    evidenceDisplayLabel,
  };
}

export function difficultyScoreToLogit(score) {
  const safe = clamp(Number(score || 50), 0, 100);
  return (safe - 50) / 18;
}

export function difficultyLogitToScore(logitValue) {
  return 50 + (18 * Number(logitValue || 0));
}

export function getNextDifficultyBand(key) {
  const normalized = String(key || "").trim().toLowerCase();
  const index = DIFFICULTY_BAND_ORDER.indexOf(normalized);
  if (index < 0 || index >= DIFFICULTY_BAND_ORDER.length - 1) return null;
  return getDifficultyBandByKey(DIFFICULTY_BAND_ORDER[index + 1]);
}

export function getAttainmentDisplayLabel(key) {
  return getLevelDisplayLabel(key);
}

export function getPupilFacingBandLabel(key) {
  return getAttainmentDisplayLabel(key);
}

export function getTeacherFacingBandLabel(key) {
  return getAttainmentDisplayLabel(key);
}

export function getAttainmentExplanation(key) {
  return getLevelDefinition(key, "teacher");
}

export function getPupilFacingBandDescription(key) {
  return getLevelDefinition(key, "pupil");
}

export function getPupilFacingEvidenceLabel(key) {
  return getEvidenceDisplayLabel(key);
}

export function getSpellingIndicatorTeacherDescription() {
  return "The Spelling Attainment Indicator estimates current spelling performance on the app's difficulty scale. It uses pupil responses against core structural word difficulty, then reports a spelling level, a performance descriptor, and the supporting SAI. Contextual difficulty modifiers do not change this attainment estimate.";
}

export function getSpellingIndicatorTechnicalDescription() {
  return "The indicator uses a Rasch-style one-parameter logistic estimate. It is based on correct or incorrect responses to words with core structural difficulty values only, while contextual modifiers stay outside the attainment model. The pupil estimate is translated into a likely secure difficulty level, a descriptor-led attainment label, and a performance descriptor for reporting. Accuracy, first try, completion, and average tries remain companion measures and are not blended into the core attainment estimate.";
}

export function getSpellingIndicatorEvidenceBands() {
  return SPELLING_INDICATOR_EVIDENCE_BANDS.map((item) => ({ ...item }));
}

export function getSpellingIndicatorResearchReferences() {
  return SPELLING_INDICATOR_RESEARCH_REFERENCES.map((item) => ({ ...item }));
}

export function buildDifficultyMapFromWordRows(wordRows) {
  const map = new Map();
  for (const row of Array.isArray(wordRows) ? wordRows : []) {
    const wordId = String(row?.id || "");
    if (!wordId) continue;
    const difficulty = getStoredDifficultyModelForWord(row);
    map.set(wordId, difficulty);
  }
  return map;
}

export function estimateSpellingAttainmentIndicator({
  responses = [],
  checkedAccuracy = null,
  firstTimeCorrectRate = null,
  completionRate = null,
  averageAttempts = null,
} = {}) {
  const normalized = (Array.isArray(responses) ? responses : [])
    .map((item) => ({
      correct: !!item?.correct,
      difficultyScore: clamp(Number(item?.difficultyScore || 50), 0, 100),
      difficultyLogit: difficultyScoreToLogit(item?.difficultyScore || 50),
    }))
    .filter((item) => Number.isFinite(item.difficultyLogit));

  if (!normalized.length) {
    const evidence = getEvidenceLevel(0, null);
    return {
      score: null,
      scoreRange: null,
      theta: null,
      standardError: null,
      evidence,
      responseCount: 0,
      meanDifficultyScore: null,
      meanDifficultyBand: null,
      ...buildIndicatorReportingFields({
        responseCount: 0,
        normalizedResponses: [],
        secureDifficultyScore: null,
        secureDifficultyBand: null,
        evidence,
      }),
      companion: buildCompanionIndicators({
        checkedAccuracy,
        firstTimeCorrectRate,
        completionRate,
        averageAttempts,
      }),
    };
  }

  const correctCount = normalized.filter((item) => item.correct).length;
  const proportionCorrect = (correctCount + 0.5) / (normalized.length + 1);
  const meanDifficultyLogit = normalized.reduce((sum, item) => sum + item.difficultyLogit, 0) / normalized.length;
  let theta = clamp(logit(proportionCorrect) + meanDifficultyLogit, THETA_MIN, THETA_MAX);

  for (let iteration = 0; iteration < 12; iteration += 1) {
    let firstDerivative = 0;
    let secondDerivative = 0;

    for (const item of normalized) {
      const probability = logistic(theta - item.difficultyLogit);
      firstDerivative += Number(item.correct) - probability;
      secondDerivative -= probability * (1 - probability);
    }

    firstDerivative -= (theta - PRIOR_MEAN) / PRIOR_VARIANCE;
    secondDerivative -= 1 / PRIOR_VARIANCE;

    if (!Number.isFinite(firstDerivative) || !Number.isFinite(secondDerivative) || Math.abs(secondDerivative) < 0.000001) {
      break;
    }

    const nextTheta = clamp(theta - (firstDerivative / secondDerivative), THETA_MIN, THETA_MAX);
    if (Math.abs(nextTheta - theta) < 0.0001) {
      theta = nextTheta;
      break;
    }
    theta = nextTheta;
  }

  let information = 1 / PRIOR_VARIANCE;
  for (const item of normalized) {
    const probability = logistic(theta - item.difficultyLogit);
    information += probability * (1 - probability);
  }

  const standardError = information > 0 ? Math.sqrt(1 / information) : null;
  const z = 1.96;
  const lowerTheta = standardError == null ? theta : clamp(theta - z * standardError, THETA_MIN, THETA_MAX);
  const upperTheta = standardError == null ? theta : clamp(theta + z * standardError, THETA_MIN, THETA_MAX);
  const meanDifficultyScore = normalized.reduce((sum, item) => sum + item.difficultyScore, 0) / normalized.length;
  const evidence = getEvidenceLevel(normalized.length, standardError);
  const secureDifficultyLogit = theta - SECURE_THRESHOLD_LOGIT;
  const secureDifficultyScore = clamp(difficultyLogitToScore(secureDifficultyLogit), 0, 100);
  const secureDifficultyBand = getDifficultyBand(secureDifficultyScore);

  return {
    score: thetaToScale(theta),
    scoreRange: standardError == null
      ? null
      : {
        lower: thetaToScale(lowerTheta),
        upper: thetaToScale(upperTheta),
      },
    theta: round(theta, 4),
    standardError: standardError == null ? null : round(standardError, 4),
    evidence,
    responseCount: normalized.length,
    meanDifficultyScore: round(meanDifficultyScore, 1),
    meanDifficultyBand: getDifficultyBand(meanDifficultyScore),
    ...buildIndicatorReportingFields({
      responseCount: normalized.length,
      normalizedResponses: normalized,
      secureDifficultyScore,
      secureDifficultyBand,
      evidence,
    }),
    companion: buildCompanionIndicators({
      checkedAccuracy,
      firstTimeCorrectRate,
      completionRate,
      averageAttempts,
    }),
  };
}

export function averageSpellingIndicator(models) {
  const valid = (Array.isArray(models) ? models : [])
    .map((item) => item?.score)
    .filter((value) => Number.isFinite(Number(value)));

  if (!valid.length) return null;
  return round(valid.reduce((sum, value) => sum + Number(value || 0), 0) / valid.length, 1);
}
