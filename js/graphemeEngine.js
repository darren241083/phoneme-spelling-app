const SINGLE_VOWELS = new Set(["a","e","i","o","u","y"]);

export const GRAPHEME_BANK = {
  quadgraphs: ["eigh"],
  trigraphs: ["igh", "air", "ear", "ure", "tch", "dge"],
  digraphs: ["sh", "ch", "th", "ng", "ph", "wh", "ck", "qu", "ee", "ea", "ai", "ay", "oa", "ow", "oo", "ou", "oi", "oy", "ue", "ew", "ie", "er", "ar", "or", "ur"],
  splitDigraphs: ["a-e", "i-e", "o-e", "u-e", "e-e"],
};

const LONGEST_PATTERNS = [
  ...GRAPHEME_BANK.quadgraphs,
  ...GRAPHEME_BANK.trigraphs,
  ...GRAPHEME_BANK.digraphs,
].sort((a, b) => b.length - a.length);

export function normalizeWord(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z'-]/g, "");
}

export function splitWordIntoGraphemes(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return [];

  const graphemes = [];
  const finalSplit = detectFinalSplitDigraph(word);
  let i = 0;
  while (i < word.length) {
    if (finalSplit && i === finalSplit.start) {
      graphemes.push(finalSplit.token);
      i += 1;
      continue;
    }
    if (finalSplit && i === finalSplit.silentEIndex) {
      i += 1;
      continue;
    }

    let matched = "";
    for (const pattern of LONGEST_PATTERNS) {
      if (word.startsWith(pattern, i)) {
        matched = pattern;
        break;
      }
    }

    if (matched) {
      graphemes.push(matched);
      i += matched.length;
      continue;
    }

    graphemes.push(word[i]);
    i += 1;
  }

  return graphemes;
}

function detectFinalSplitDigraph(word) {
  if (word.length < 3) return null;
  const start = word.length - 3;
  const first = word[start];
  const middle = word[start + 1];
  const last = word[start + 2];
  if (!SINGLE_VOWELS.has(first) || first === "e") return null;
  if (last !== "e") return null;
  if (SINGLE_VOWELS.has(middle)) return null;
  return {
    token: `${first}-e`,
    start,
    silentEIndex: start + 2,
  };
}

export function classifyPattern(graphemes) {
  const units = Array.isArray(graphemes) ? graphemes : splitWordIntoGraphemes(graphemes);
  const focus = detectFocusGrapheme(units);
  if (!focus) return { patternType: "single", focusGrapheme: "" };
  if (focus.includes("-e")) return { patternType: "split_digraph", focusGrapheme: focus };
  if (focus.length >= 3) return { patternType: "trigraph", focusGrapheme: focus };
  if (focus.length === 2) {
    if (/[aeiouy]{2}/.test(focus)) return { patternType: "vowel_team", focusGrapheme: focus };
    return { patternType: "digraph", focusGrapheme: focus };
  }
  return { patternType: "single", focusGrapheme: focus };
}

export function detectFocusGrapheme(graphemes) {
  const units = Array.isArray(graphemes) ? graphemes : splitWordIntoGraphemes(graphemes);
  const multi = units.find((item) => item.includes("-e"))
    || units.find((item) => item.length >= 3)
    || units.find((item) => item.length === 2);
  return multi || units[0] || "";
}

export function buildWordMeta(rawWord, existingGraphemes = null) {
  const word = normalizeWord(rawWord);
  const graphemes = existingGraphemes?.length ? existingGraphemes : splitWordIntoGraphemes(word);
  const { patternType, focusGrapheme } = classifyPattern(graphemes);
  return {
    word,
    graphemes,
    patternType,
    focusGrapheme,
  };
}

export function getVisualSpec(word, graphemes) {
  const cleanWord = normalizeWord(word);
  const letters = cleanWord.split("");
  const marks = [];
  let cursor = 0;

  for (const grapheme of graphemes) {
    if (!grapheme) continue;
    if (grapheme.includes("-e")) {
      const first = grapheme[0];
      const start = cleanWord.indexOf(first, cursor);
      let end = cleanWord.lastIndexOf("e");
      if (start === -1 || end === -1 || end <= start) continue;
      marks.push({ type: "bridge", start, end, label: grapheme });
      cursor = start + 1;
      continue;
    }

    const start = cleanWord.indexOf(grapheme, cursor);
    if (start === -1) continue;
    const end = start + grapheme.length - 1;
    marks.push({
      type: grapheme.length === 1 ? "dot" : "underline",
      start,
      end,
      label: grapheme,
    });
    cursor = end + 1;
  }

  return { letters, marks };
}

export function renderVisualPreviewHtml(word, graphemes) {
  const { letters, marks } = getVisualSpec(word, graphemes);
  if (!letters.length) return "";

  const markHtml = marks.map((mark) => {
    if (mark.type === "dot") {
      return `<span class="gp-mark gp-mark--dot" style="grid-column:${mark.start + 1};"></span>`;
    }
    if (mark.type === "underline") {
      return `<span class="gp-mark gp-mark--underline" style="grid-column:${mark.start + 1} / ${mark.end + 2};"></span>`;
    }
    return `<span class="gp-mark gp-mark--bridge" style="grid-column:${mark.start + 1} / ${mark.end + 2};"><span></span></span>`;
  }).join("");

  return `
    <div class="gp-preview" style="--gp-cols:${letters.length};">
      <div class="gp-letters" style="grid-template-columns:repeat(${letters.length}, minmax(18px, 1fr));">
        ${letters.map((letter) => `<span class="gp-letter">${escapeHtml(letter)}</span>`).join("")}
      </div>
      <div class="gp-marks" style="grid-template-columns:repeat(${letters.length}, minmax(18px, 1fr));">
        ${markHtml}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
