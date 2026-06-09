function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanToken(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z-]/g, "");
}

function getRawTokenEntry(raw) {
  if (raw && typeof raw === "object") {
    return raw.token
      ?? raw.grapheme
      ?? raw.value
      ?? raw.segment
      ?? raw.label
      ?? raw.text
      ?? "";
  }
  return raw;
}

function getLocalTokenLetters(token) {
  return String(token || "")
    .replace(/-/g, "")
    .split("")
    .filter(Boolean);
}

function resolveSilentLocalIndices(raw, token) {
  const localLetters = getLocalTokenLetters(token);
  const letterCount = localLetters.length;
  const indices = new Set();

  if (!letterCount) return [];

  const source = raw && typeof raw === "object" ? raw : null;
  const silentValues = source?.silent_letters
    ?? source?.silentLetters
    ?? source?.silent_indices
    ?? source?.silentIndices
    ?? [];

  if (source?.silent === true && letterCount === 1) indices.add(0);

  const items = Array.isArray(silentValues) ? silentValues : [silentValues];
  for (const item of items) {
    if (item == null || item === "") continue;
    const numeric = Number(item);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric < letterCount) {
      indices.add(numeric);
      continue;
    }

    const letter = String(item || "").trim().toLowerCase();
    if (!letter) continue;
    const foundIndex = localLetters.findIndex((value, index) => value === letter && !indices.has(index));
    if (foundIndex >= 0) indices.add(foundIndex);
  }

  return [...indices].sort((a, b) => a - b);
}

function normaliseGraphemes(graphemes) {
  return (graphemes || [])
    .map((raw) => {
      const token = cleanToken(getRawTokenEntry(raw));
      if (!token) return null;
      return {
        token,
        silentLocalIndices: resolveSilentLocalIndices(raw, token),
      };
    })
    .filter(Boolean);
}

export const PHONICS_PREVIEW_CELL_W = 28;
export const PHONICS_PREVIEW_GAP = 8;

const PHONICS_PREVIEW_DOT_R = 6;
const PHONICS_PREVIEW_STROKE = 4;
const PHONICS_PREVIEW_DOT_Y = 14;
const PHONICS_PREVIEW_UNDERLINE_DOT_OFFSET_Y = PHONICS_PREVIEW_DOT_Y + PHONICS_PREVIEW_DOT_R + 7;
const PHONICS_PREVIEW_BRIDGE_DEPTH = 18;
const PHONICS_PREVIEW_PAD = 6;

function findTokenRange(letters, token, fromIndex) {
  const joined = letters.join("").toLowerCase();
  const rel = joined.slice(fromIndex).indexOf(token);
  if (rel === -1) return null;

  const start = fromIndex + rel;
  const end = start + token.length - 1;
  return { start, end };
}

function getImplicitSilentLetterIndices(letters) {
  const safeLetters = Array.isArray(letters) ? letters : [];
  const word = safeLetters.join("").toLowerCase();
  const indices = new Set();

  if (/^(kn|wr|gn|ps)/.test(word)) {
    indices.add(0);
  }

  if (/mb$/.test(word)) {
    indices.add(word.length - 1);
  }

  return indices;
}

function getTokenSilentLocalIndices(entry, range, implicitSilentIndices) {
  const indices = new Set(
    Array.isArray(entry?.silentLocalIndices)
      ? entry.silentLocalIndices.map((value) => Number(value)).filter(Number.isInteger)
      : []
  );
  const safeRange = range || {};
  const start = Number(safeRange.start);
  const end = Number(safeRange.end);

  if (Number.isInteger(start) && Number.isInteger(end) && implicitSilentIndices instanceof Set) {
    for (let index = start; index <= end; index += 1) {
      if (implicitSilentIndices.has(index)) {
        indices.add(index - start);
      }
    }
  }

  return [...indices]
    .filter((value) => value >= 0 && Number.isInteger(value))
    .sort((a, b) => a - b);
}

function pushPerLetterMarks(marks, range, silentLocalIndices, partIndex) {
  const silentSet = new Set(Array.isArray(silentLocalIndices) ? silentLocalIndices : []);
  for (let index = range.start; index <= range.end; index += 1) {
    const localIndex = index - range.start;
    marks.push({
      type: silentSet.has(localIndex) ? "silent_dot" : "dot",
      start: index,
      end: index,
      partIndex,
    });
  }
}

function shouldUnderlineSilentToken(token, silentLocalIndices) {
  const clean = cleanToken(token);
  const silentSet = new Set(Array.isArray(silentLocalIndices) ? silentLocalIndices : []);
  const letterCount = getLocalTokenLetters(clean).length;

  if (!letterCount || silentSet.size >= letterCount) return false;
  if (["kn", "wr", "gn", "ps"].includes(clean) && silentSet.has(0)) return false;
  if (clean === "mb" && silentSet.has(1)) return false;
  if (clean === "gh" && silentSet.has(0) && silentSet.has(1)) return false;
  return true;
}

export function buildWordFromGraphemes(graphemes) {
  const tokens = normaliseGraphemes(graphemes);
  let built = "";
  let pendingSuffix = "";

  for (const entry of tokens) {
    const token = entry?.token || "";
    if (!token) continue;

    if (token.includes("-")) {
      const [left = "", right = "e"] = token.split("-");
      built += left;
      pendingSuffix = right || "e";
      continue;
    }

    built += token;
    if (pendingSuffix) {
      built += pendingSuffix;
      pendingSuffix = "";
    }
  }

  if (pendingSuffix) built += pendingSuffix;
  return built;
}

export function mapPreviewSegments(word, graphemes) {
  const letters = String(word || "").split("");
  const marks = [];
  const segments = [];

  if (!letters.length) return { letters, marks, segments };

  const tokens = normaliseGraphemes(graphemes);
  const implicitSilentIndices = getImplicitSilentLetterIndices(letters);
  let cursor = 0;

  for (let partIndex = 0; partIndex < tokens.length; partIndex += 1) {
    const entry = tokens[partIndex];
    const token = cleanToken(entry?.token || "");
    if (!token) continue;

    if (token.includes("-e")) {
      const base = token.split("-")[0];
      const baseRange = findTokenRange(letters, base, cursor);

      if (baseRange) {
        const end = letters.findIndex(
          (ch, idx) => idx > baseRange.end && ch.toLowerCase() === "e"
        );

        if (end !== -1) {
          const mark = {
            type: "split",
            start: baseRange.start,
            end,
            partIndex,
          };
          marks.push(mark);
          marks.push({
            type: "dot",
            start: baseRange.start,
            end: baseRange.start,
            partIndex,
          });
          marks.push({
            type: "dot",
            start: end,
            end,
            partIndex,
          });
          segments.push({
            token,
            partIndex,
            start: mark.start,
            end: mark.end,
            markType: mark.type,
          });
          cursor = baseRange.end + 1;
          continue;
        }
      }
    }

    const range = findTokenRange(letters, token, cursor);
    if (!range) continue;

    const silentLocalIndices = getTokenSilentLocalIndices(entry, range, implicitSilentIndices);
    const hasSilentLetters = silentLocalIndices.length > 0;
    if (hasSilentLetters && token.length > 1) {
      const shouldUnderline = shouldUnderlineSilentToken(token, silentLocalIndices);
      if (shouldUnderline) {
        marks.push({
          type: "underline",
          start: range.start,
          end: range.end,
          offset: "below_dots",
          partIndex,
        });
      }
      pushPerLetterMarks(marks, range, silentLocalIndices, partIndex);
      segments.push({
        token,
        partIndex,
        start: range.start,
        end: range.end,
        markType: shouldUnderline ? "underline" : "silent_group",
        silentLocalIndices,
      });
      cursor = range.end + 1;
      continue;
    }

    const singleLetterSilent = token.length === 1 && silentLocalIndices.includes(0);
    const mark = {
      type: token.length > 1 ? "underline" : (singleLetterSilent ? "silent_dot" : "dot"),
      start: range.start,
      end: range.end,
      partIndex,
    };
    marks.push(mark);
    segments.push({
      token,
      partIndex,
      start: mark.start,
      end: mark.end,
      markType: mark.type,
      silentLocalIndices,
    });

    cursor = range.end + 1;
  }

  return { letters, marks, segments };
}

export function buildPreviewModel(word, graphemes) {
  const { letters, marks } = mapPreviewSegments(word, graphemes);
  return { letters, marks };
}

function getPreviewWidth(letterCount) {
  return letterCount * PHONICS_PREVIEW_CELL_W + Math.max(0, letterCount - 1) * PHONICS_PREVIEW_GAP;
}

function renderPreviewMarkup(letters, marks) {
  injectStyles();

  const safeLetters = Array.isArray(letters) ? letters : [];
  const safeMarks = Array.isArray(marks) ? marks : [];
  if (!safeLetters.length) return "";

  const dotMarks = safeMarks.filter((m) => m.type === "dot");
  const silentDotMarks = safeMarks.filter((m) => m.type === "silent_dot");
  const splitMarks = safeMarks.filter((m) => m.type === "split");
  const underlineMarks = safeMarks.filter((m) => m.type === "underline");

  const totalW = getPreviewWidth(safeLetters.length);
  const svgH = PHONICS_PREVIEW_DOT_Y + PHONICS_PREVIEW_BRIDGE_DEPTH + PHONICS_PREVIEW_STROKE + 6;

  const centerX = (index) => index * (PHONICS_PREVIEW_CELL_W + PHONICS_PREVIEW_GAP) + PHONICS_PREVIEW_CELL_W / 2;

  const letterHtml = safeLetters
    .map(
      (letter) =>
        `<span class="pr-cell" style="width:${PHONICS_PREVIEW_CELL_W}px;">${esc(letter)}</span>`
    )
    .join("");

  const greySvg = dotMarks
    .slice()
    .sort((a, b) => a.start - b.start)
    .map(
      (mark) =>
        `<circle cx="${centerX(mark.start)}" cy="${PHONICS_PREVIEW_DOT_Y}" r="${PHONICS_PREVIEW_DOT_R}" class="pr-grey-fill" />`
    )
    .join("");

  const silentSvg = silentDotMarks
    .slice()
    .sort((a, b) => a.start - b.start)
    .map(
      (mark) =>
        `<circle cx="${centerX(mark.start)}" cy="${PHONICS_PREVIEW_DOT_Y}" r="${PHONICS_PREVIEW_DOT_R}" class="pr-silent-dot" />`
    )
    .join("");

  const underlineSvg = underlineMarks
    .map((m) => {
      const x1 = centerX(m.start) - PHONICS_PREVIEW_PAD;
      const x2 = centerX(m.end) + PHONICS_PREVIEW_PAD;
      const y = m?.offset === "below_dots" ? PHONICS_PREVIEW_UNDERLINE_DOT_OFFSET_Y : PHONICS_PREVIEW_DOT_Y;
      return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="pr-stroke" />`;
    })
    .join("");

  const bridgeSvg = splitMarks
    .map((m) => {
      const x1 = centerX(m.start);
      const x2 = centerX(m.end);
      const y = PHONICS_PREVIEW_DOT_Y;
      const bottom = PHONICS_PREVIEW_DOT_Y + PHONICS_PREVIEW_BRIDGE_DEPTH;
      return `
        <path
          d="M ${x1} ${y} L ${x1} ${bottom} Q ${x1} ${bottom + 4} ${x1 + 8} ${bottom + 4} L ${x2 - 8} ${bottom + 4} Q ${x2} ${bottom + 4} ${x2} ${bottom} L ${x2} ${y}"
          class="pr-stroke"
          fill="none"
        />
      `;
    })
    .join("");

  return `
    <div class="pr-scroll">
      <div class="pr-wrap" style="width:${totalW}px;">
        <div class="pr-letters" style="gap:${PHONICS_PREVIEW_GAP}px;">${letterHtml}</div>
        <svg class="pr-svg" width="${totalW}" height="${svgH}" viewBox="0 0 ${totalW} ${svgH}" aria-hidden="true">
          ${underlineSvg}
          ${bridgeSvg}
          ${greySvg}
          ${silentSvg}
        </svg>
      </div>
    </div>
  `;
}

export function renderPhonicsPreviewModel(model) {
  return renderPreviewMarkup(model?.letters, model?.marks);
}

export function renderPhonicsPreview(word, graphemes) {
  return renderPhonicsPreviewModel(buildPreviewModel(word, graphemes));
}

function injectStyles() {
  if (document.getElementById("phonics-preview-styles")) return;

  const style = document.createElement("style");
  style.id = "phonics-preview-styles";
  style.textContent = `
    .pr-scroll{
      overflow-x:auto;
      overflow-y:hidden;
      width:100%;
      max-width:100%;
      padding-bottom:6px;
      box-sizing:border-box;
    }

    .pr-wrap{
      display:inline-block;
      min-width:max-content;
      box-sizing:border-box;
    }

    .pr-letters{
      display:flex;
      align-items:flex-end;
      white-space:nowrap;
      margin-bottom:4px;
    }

    .pr-cell{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      font-weight:800;
      font-size:16px;
      line-height:1;
      color:var(--wl-text, #1C1C1C);
      flex:0 0 auto;
    }

    .pr-svg{
      display:block;
      overflow:visible;
    }

    .pr-grey-fill{
      fill:#94a3b8;
    }

    .pr-orange-fill{
      fill:var(--wl-warning, #C28A3D);
    }

    .pr-silent-dot{
      fill:#fff;
      stroke:#94a3b8;
      stroke-width:3;
    }

    .pr-stroke{
      stroke:var(--wl-warning, #C28A3D);
      stroke-width:4;
      stroke-linecap:round;
      stroke-linejoin:round;
    }
  `;

  document.head.appendChild(style);
}
