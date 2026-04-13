import { buildPreviewModel } from "../js/phonicsRenderer.js";
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
  const hasBridge = (preview?.marks || []).some((mark) => mark?.type === "split");
  const isSplit = segments.some((item) => String(item || "").includes("-e"));

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
      }, null, 2)}</pre>
    </article>
  `;
}

render();
