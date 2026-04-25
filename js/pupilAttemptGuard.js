export function normalizeSubmittedAnswer(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function shouldBlockDuplicateIncorrectSubmission({
  previousResultWasIncorrect = false,
  lastSubmittedIncorrectAnswer = "",
  currentSubmittedAnswer = "",
} = {}) {
  if (previousResultWasIncorrect !== true) return false;

  const previous = normalizeSubmittedAnswer(lastSubmittedIncorrectAnswer);
  const current = normalizeSubmittedAnswer(currentSubmittedAnswer);
  if (!previous || !current) return false;

  return previous === current;
}
