import { buildPreviewModel } from "../js/phonicsRenderer.js?v=1.6";
import { inferPattern, splitWordToGraphemes } from "../js/wordParser.js?v=1.5";

const CASES = [
  { word: "make", expectedSegments: ["m", "a-e", "k"], split: true, focus: "a-e" },
  { word: "theme", expectedSegments: ["th", "e-e", "m"], split: true, focus: "e-e" },
  { word: "time", expectedSegments: ["t", "i-e", "m"], split: true, focus: "i-e" },
  { word: "home", expectedSegments: ["h", "o-e", "m"], split: true, focus: "o-e" },
  { word: "cube", expectedSegments: ["c", "u-e", "b"], split: true, focus: "u-e" },
  { word: "fleece", expectedSegments: ["f", "l", "ee", "c", "e"], split: false, focus: "ee" },
  { word: "cheese", expectedSegments: ["ch", "ee", "s", "e"], split: false, focus: ["ch", "ee"] },
  { word: "breeze", expectedSegments: ["b", "r", "ee", "z", "e"], split: false, focus: "ee" },
  { word: "boated", expectedSegments: ["b", "oa", "t", "e", "d"], split: false, focus: "oa" },
  { word: "nailed", expectedSegments: ["n", "ai", "l", "e", "d"], split: false, focus: "ai" },
  { word: "knife", expectedSegments: ["kn", "i-e", "f"], split: true, focus: "i-e", silentPositions: [0], underlineRanges: [], offsetUnderlineRanges: [] },
  { word: "knight", expectedSegments: ["kn", "igh", "t"], split: false, focus: "igh", silentPositions: [0], underlineRanges: [[2, 4]], offsetUnderlineRanges: [] },
  { word: "climb", expectedSegments: ["c", "l", "i", "m", "b"], split: false, focus: "c", silentPositions: [4] },
];

const appEl = document.getElementById("app");

function render() {
  const results = CASES.map(runCase);
  const failed = results.filter((item) => !item.pass);
  const summaryClass = failed.length ? "fail" : "pass";

  appEl.innerHTML = `
    <section class="summary ${summaryClass}">
      <h1>Phonics Regression Checks</h1>
      <p>${failed.length ? `${failed.length} case${failed.length === 1 ? "" : "s"} failed.` : "All required cases passed."}</p>
      <p>These checks use the live parser and preview model from the app.</p>
    </section>
    ${results.map(renderCase).join("")}
  `;
}

function focusMatches(actualFocus, expectedFocus) {
  if (Array.isArray(expectedFocus)) {
    return expectedFocus.map((item) => String(item || "")).includes(String(actualFocus || ""));
  }
  return String(actualFocus || "") === String(expectedFocus || "");
}

function runCase(testCase) {
  const segments = splitWordToGraphemes(testCase.word);
  const pattern = inferPattern(segments);
  const preview = buildPreviewModel(testCase.word, segments);
  const previewMarks = preview?.marks || [];
  const splitMark = previewMarks.find((mark) => mark?.type === "split") || null;
  const hasBridge = !!splitMark;
  const isSplit = segments.some((item) => String(item || "").includes("-e"));
  const splitEndpointDots = splitMark
    ? previewMarks.filter((mark) => (
      mark?.type === "dot"
      && (Number(mark.start) === Number(splitMark.start) || Number(mark.start) === Number(splitMark.end))
    )).length
    : 0;
  const hasSplitSilentDot = splitMark
    ? previewMarks.some((mark) => mark?.type === "silent_dot" && Number(mark.start) === Number(splitMark.end))
    : false;
  const silentPositions = previewMarks
    .filter((mark) => mark?.type === "silent_dot")
    .map((mark) => Number(mark.start))
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
  const expectedSilentPositions = Array.isArray(testCase.silentPositions)
    ? testCase.silentPositions.slice().sort((a, b) => a - b)
    : [];
  const underlineRanges = previewMarks
    .filter((mark) => mark?.type === "underline")
    .map((mark) => [Number(mark.start), Number(mark.end)])
    .filter(([start, end]) => Number.isInteger(start) && Number.isInteger(end))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const expectedUnderlineRanges = Array.isArray(testCase.underlineRanges)
    ? testCase.underlineRanges.map(([start, end]) => [Number(start), Number(end)]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
    : [];
  const offsetUnderlineRanges = previewMarks
    .filter((mark) => mark?.type === "underline" && mark?.offset === "below_dots")
    .map((mark) => [Number(mark.start), Number(mark.end)])
    .filter(([start, end]) => Number.isInteger(start) && Number.isInteger(end))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const expectedOffsetUnderlineRanges = Array.isArray(testCase.offsetUnderlineRanges)
    ? testCase.offsetUnderlineRanges.map(([start, end]) => [Number(start), Number(end)]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
    : [];

  const checks = [
    {
      label: "grapheme grouping",
      pass: JSON.stringify(segments) === JSON.stringify(testCase.expectedSegments),
      detail: `${JSON.stringify(segments)} expected ${JSON.stringify(testCase.expectedSegments)}`,
    },
    {
      label: "split-digraph classification",
      pass: isSplit === testCase.split && (testCase.split ? pattern.patternType === "split_digraph" : pattern.patternType !== "split_digraph"),
      detail: `${String(isSplit)} / ${pattern.patternType}`,
    },
    {
      label: "bridge eligibility",
      pass: hasBridge === testCase.split,
      detail: `${String(hasBridge)} expected ${String(testCase.split)}`,
    },
    {
      label: "split endpoint markers",
      pass: !testCase.split || (splitEndpointDots === 2 && !hasSplitSilentDot),
      detail: `${splitEndpointDots} solid endpoint dots; silent endpoint ${String(hasSplitSilentDot)}`,
    },
    {
      label: "silent letter markers",
      pass: JSON.stringify(silentPositions) === JSON.stringify(expectedSilentPositions),
      detail: `${JSON.stringify(silentPositions)} expected ${JSON.stringify(expectedSilentPositions)}`,
    },
    {
      label: "multiletter underline markers",
      pass: JSON.stringify(underlineRanges) === JSON.stringify(expectedUnderlineRanges),
      detail: `${JSON.stringify(underlineRanges)} expected ${JSON.stringify(expectedUnderlineRanges)}`,
    },
    {
      label: "underlines with dot clearance",
      pass: JSON.stringify(offsetUnderlineRanges) === JSON.stringify(expectedOffsetUnderlineRanges),
      detail: `${JSON.stringify(offsetUnderlineRanges)} expected ${JSON.stringify(expectedOffsetUnderlineRanges)}`,
    },
    {
      label: "focus grapheme alignment",
      pass: focusMatches(pattern.focusGrapheme || "", testCase.focus || ""),
      detail: `${String(pattern.focusGrapheme || "")} expected ${Array.isArray(testCase.focus) ? testCase.focus.join(" or ") : String(testCase.focus || "")}`,
    },
  ];

  return {
    ...testCase,
    segments,
    pattern,
    hasBridge,
    checks,
    pass: checks.every((item) => item.pass),
  };
}

function renderCase(result) {
  return `
    <article class="case ${result.pass ? "pass" : "fail"}">
      <div class="meta">
        <span class="pill">${result.word}</span>
        <span class="pill">${result.pass ? "Pass" : "Fail"}</span>
      </div>
      <ul>
        ${result.checks.map((check) => `
          <li class="${check.pass ? "good" : "bad"}">
            <strong>${check.label}:</strong> ${check.pass ? "ok" : check.detail}
          </li>
        `).join("")}
      </ul>
      <pre>${JSON.stringify({
        segments: result.segments,
        patternType: result.pattern.patternType,
        focusGrapheme: result.pattern.focusGrapheme,
        hasBridge: result.hasBridge,
        marks: buildPreviewModel(result.word, result.segments)?.marks || [],
      }, null, 2)}</pre>
    </article>
  `;
}

render();
