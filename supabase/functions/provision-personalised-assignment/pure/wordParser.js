import { chooseBestFocusGrapheme } from "./data/phonemeHelpers.js";

const SPLIT_PATTERNS = [
  "air","ear","ure","igh","tch","dge","tion","sion",
  "sh","ch","th","ng","ph","wh","ck","qu","wr","kn","gn",
  "ai","ay","ee","ea","oa","ow","oo","ou","oi","oy","ue","ew","ie","er","ir","ur","or","ar"
];

export function normaliseWord(word){
  return String(word || "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "")
    .replace(/[^a-z'-]/g, "");
}

export function parseWordList(raw){
  const compact = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[;,]+/g, "\n");

  const rough = compact
    .split(/\n+/)
    .flatMap(line => line.split(/\s+/))
    .map(normaliseWord)
    .filter(Boolean)
    .filter(word => word.length <= 24);

  const seen = new Set();
  const words = [];
  for (const word of rough){
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words;
}

export function detectMisspellingWarning(word){
  const raw = String(word || "").trim().toLowerCase();
  const clean = normaliseWord(raw);
  if (!raw) return "";
  if (raw !== clean) return "Unusual characters found.";
  if (!/^[a-z'-]+$/.test(clean)) return "Contains unusual characters.";
  if (/(.)\1\1/.test(clean)) return "Repeated letters look unusual.";
  if (clean.length > 18) return "This word looks unusually long.";
  return "";
}

export function getSuggestedWord(word){
  return normaliseWord(word);
}

export function splitWordToGraphemes(word){
  const w = normaliseWord(word);
  if (!w) return [];

  const grouped = splitSimpleDetailed(w);
  const splitDigraph = detectSplitDigraph(w, grouped);
  if (splitDigraph){
    const { start, end, token } = splitDigraph;
    return [
      ...splitSimple(w.slice(0, start)),
      token,
      ...splitSimple(w.slice(start + 1, end)),
      ...splitSimple(w.slice(end + 1))
    ].filter(Boolean);
  }

  return grouped.map((item) => item.token);
}

function detectSplitDigraph(word, grouped = []){
  if (word.length < 3) return null;

  const start = word.length - 3;
  const vowel = word[start];
  const middle = word[start + 1];
  const end = word.length - 1;

  if (!["a", "i", "o", "u", "e"].includes(vowel)) return null;
  if (word[end] !== "e") return null;
  if (!/[bcdfghjklmnpqrstvwxyz]/.test(middle)) return null;

  const containingGroup = (Array.isArray(grouped) ? grouped : []).find((item) => start >= item.start && start <= item.end);
  if (containingGroup && containingGroup.token.length > 1) {
    return null;
  }

  return { start, end, token: `${vowel}-e` };
}

function splitSimple(word){
  return splitSimpleDetailed(word).map((item) => item.token);
}

function splitSimpleDetailed(word){
  const out = [];
  let i = 0;
  while (i < word.length){
    let matched = "";
    for (const pattern of SPLIT_PATTERNS){
      if (word.slice(i, i + pattern.length) === pattern && pattern.length > matched.length) {
        matched = pattern;
      }
    }
    if (matched){
      out.push({
        token: matched,
        start: i,
        end: i + matched.length - 1,
      });
      i += matched.length;
      continue;
    }
    out.push({
      token: word[i],
      start: i,
      end: i,
    });
    i += 1;
  }
  return out;
}

export function inferPattern(graphemes){
  const gs = Array.isArray(graphemes) ? graphemes : [];
  const focus = chooseBestFocusGrapheme(gs);
  const patternType = focus.includes("-e") ? "split_digraph" : focus.length > 1 ? "multi_letter_grapheme" : "single";
  return { focusGrapheme: focus, patternType };
}

export function formatGraphemesForInput(graphemes){
  return (graphemes || []).join(" / ");
}

export function parseGraphemeInput(value){
  return String(value || "")
    .split(/[\/|,]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}
