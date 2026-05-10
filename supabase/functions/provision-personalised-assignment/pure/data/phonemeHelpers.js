import { PHONEME_BANK } from "./phonemeBank.js";

const PHONEME_NEAR_MISS_BANK = {
  "/ai/": ["a"],
  "/ee/": ["e", "y"],
  "/igh/": ["i"],
  "/oa/": ["o"],
  "/oo/": ["u"],
  "/or/": ["o"],
  "/ow/": ["ou"],
};

export function getPhonemeOptions(phoneme, mode = "core") {
  const entry = PHONEME_BANK[phoneme];
  if (!entry) return [""];
  return entry[mode] || entry.core || [""];
}

export function inferPhonemeFromGrapheme(grapheme, mode = "all") {
  const g = String(grapheme || "").toLowerCase().trim();
  if (!g) return null;

  for (const [phoneme, entry] of Object.entries(PHONEME_BANK)) {
    const options = entry[mode] || entry.all || [];
    if (options.includes(g)) return phoneme;
  }

  return null;
}

export function getPhonemeAlternativeOptions(grapheme, phoneme = null, modes = "core") {
  const target = String(grapheme || "").trim().toLowerCase();
  const resolvedPhoneme = phoneme || inferPhonemeFromGrapheme(target, "all");
  if (!resolvedPhoneme) return [];

  const orderedModes = Array.isArray(modes) ? modes : [modes];
  const seen = new Set([target]);
  const alternatives = [];

  for (const mode of orderedModes) {
    for (const value of getPhonemeOptions(resolvedPhoneme, mode)) {
      const clean = String(value || "").trim().toLowerCase();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      alternatives.push(clean);
    }
  }

  return alternatives;
}

export function getPhonemeDecoyOptions(grapheme, phoneme = null, mode = "core") {
  const target = String(grapheme || "").trim().toLowerCase();
  const resolvedPhoneme = phoneme || inferPhonemeFromGrapheme(target, "all");
  if (!resolvedPhoneme) return [];

  const seen = new Set([target]);
  const ordered = [
    ...(PHONEME_NEAR_MISS_BANK[resolvedPhoneme] || []),
    ...getPhonemeOptions(resolvedPhoneme, mode),
  ];

  return ordered.reduce((options, value) => {
    const clean = String(value || "").trim().toLowerCase();
    if (!clean || seen.has(clean)) return options;
    seen.add(clean);
    options.push(clean);
    return options;
  }, []);
}

export function isSplitGrapheme(grapheme) {
  return String(grapheme || "").includes("-");
}

export function chooseBestFocusGrapheme(graphemes) {
  const candidates = (Array.isArray(graphemes) ? graphemes : [])
    .map((value) => {
      const grapheme = String(value || "").trim().toLowerCase();
      const phoneme = inferPhonemeFromGrapheme(grapheme, "all");
      const coreAlternatives = getPhonemeAlternativeOptions(grapheme, phoneme, "core");
      const fallbackAlternatives = coreAlternatives.length
        ? coreAlternatives
        : getPhonemeAlternativeOptions(grapheme, phoneme, ["core", "all"]);
      const letterCount = grapheme.replace(/-/g, "").length;
      return {
        grapheme,
        hasCoreAlternatives: coreAlternatives.length > 0,
        hasAlternatives: fallbackAlternatives.length > 0,
        isSplit: grapheme.includes("-"),
        isComplex: letterCount > 1,
      };
    })
    .filter((candidate) => candidate.grapheme);

  return candidates.find((candidate) => candidate.hasCoreAlternatives && candidate.isSplit)?.grapheme
    || candidates.find((candidate) => candidate.hasCoreAlternatives && candidate.isComplex)?.grapheme
    || candidates.find((candidate) => candidate.hasCoreAlternatives)?.grapheme
    || candidates.find((candidate) => candidate.hasAlternatives && candidate.isSplit)?.grapheme
    || candidates.find((candidate) => candidate.hasAlternatives && candidate.isComplex)?.grapheme
    || candidates.find((candidate) => candidate.hasAlternatives)?.grapheme
    || candidates.find((candidate) => candidate.isSplit)?.grapheme
    || candidates.find((candidate) => candidate.isComplex)?.grapheme
    || candidates[0]?.grapheme
    || "";
}
