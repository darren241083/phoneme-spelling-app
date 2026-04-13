import { escapeHtml } from "./ui.js";
import { pupilRecordAttempt } from "./db.js?v=1.17";
import { createScrollMode } from "./modes_scroll.js";
import {
  createSegmentedSpellingModel,
  isSupportedSegmentedWord,
} from "./modes_segmented_spelling.js";
import { getPhonemeAlternativeOptions, getPhonemeDecoyOptions, getPhonemeOptions, inferPhonemeFromGrapheme } from "./data/phonemeHelpers.js";
import { PHONEME_BANK } from "./data/phonemeBank.js";
import {
  getQuestionTypeDisplayLabel,
  normalizeStoredQuestionType,
  resolveItemAttemptsAllowed,
} from "./questionTypes.js?v=1.1";
import {
  PHONICS_PREVIEW_CELL_W,
  PHONICS_PREVIEW_GAP,
  buildWordFromGraphemes,
  mapPreviewSegments,
  renderPhonicsPreviewModel,
} from "./phonicsRenderer.js";
import { splitWordToGraphemes } from "./wordParser.js?v=1.5";

const LOOM_DECOY_COUNTS = {
  none: 0,
  light: 1,
  medium: 2,
};

const KNOWN_LOOM_GRAPHEMES = [...new Set(
  Object.values(PHONEME_BANK)
    .flatMap((entry) => [...(entry?.all || []), ...(entry?.core || [])])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
)];

export function mountGame({
  host,
  words,
  testMeta,
  pupilId,
  assignmentId,
  onExit,
  onComplete,
  onProgress,
  resumeState = null,
  recordAttempts = true,
  presentationMode = false,
}) {
  const hasUnlimitedAttempts = false;
  let idx = 0;
  let totalCorrect = 0;
  let totalAttemptsUsed = 0;
  const results = [];
  const progressEntries = new Map();
  let currentAttempt = 0;
  let locked = false;
  let progressSyncTimer = 0;
  let progressSyncPromise = Promise.resolve();
  let progressClosed = false;
  let leaveConfirmOpen = false;
  let currentScroll = null;
  let currentArrange = null;
  let currentArrangeDrag = null;
  let currentArrangeDropZone = null;
  let currentLoom = null;
  let currentLoomDrag = null;
  let currentLoomDropTarget = null;
  let currentSegmented = null;
  let currentModeKind = "";
  let completionInFlight = false;
  let autoPlayTimer = 0;
  let segmentedRefocusTimer = 0;
  let audioPlaybackVersion = 0;

  host.innerHTML = `
    <style>
      .gameShell{
        width:100%;
      }
      .gameShell--modal-open{
        position:relative;
      }
      .gameShell--present{
        max-width:min(1320px, 100%);
        margin:0 auto;
        padding:6px 6px 20px;
      }
      .gameShell--present .gameTop{
        font-size:17px;
        gap:16px;
      }
      .gameShell--present .pill{
        padding:9px 14px;
        font-size:15px;
      }
      .gameShell--present .gameCloseBtn{
        width:52px;
        height:52px;
        font-size:34px;
      }
      .gameShell--present .center{
        gap:16px;
        padding:18px 0 10px;
      }
      .guidedPrompt{
        font-size:18px;
        font-weight:700;
        color:#0f172a;
        text-align:center;
      }
      .guidedSlots{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:10px;
        flex-wrap:wrap;
      }
      .guidedSlotWrap{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:8px;
      }
      .guidedArrow{
        border:none;
        background:transparent;
        color:#94a3b8;
        font-size:18px;
        line-height:1;
        cursor:pointer;
        padding:0;
      }
      .guidedSlot{
        min-width:84px;
        height:58px;
        padding:0 18px;
        border-radius:18px;
        border:1px solid #cbd5e1;
        background:#fff;
        color:#0f172a;
        font-size:24px;
        font-weight:800;
        box-shadow:0 10px 30px rgba(17,24,39,.06);
        cursor:pointer;
      }
      .guidedSep{
        font-size:24px;
        font-weight:800;
        color:#64748b;
      }
      .guidedArrow:focus-visible,
      .guidedSlot:focus-visible{
        outline:none;
        box-shadow:0 0 0 4px rgba(79,70,229,.12);
      }
      .gameShell--present .gamePromptLine{
        font-size:clamp(18px, 1.8vw, 26px);
        font-weight:700;
        line-height:1.2;
        max-width:32ch;
        color:#475569;
      }
      .gameShell--present .gameSentenceLine{
        font-size:clamp(18px, 1.7vw, 24px);
        max-width:40ch;
      }
      .gameShell--present .guidedPrompt{
        font-size:13px;
        font-weight:800;
        letter-spacing:.1em;
        text-transform:uppercase;
        color:#94a3b8;
      }
      .gameShell--present .guidedSlot{
        min-width:110px;
        height:74px;
        font-size:32px;
        border-radius:22px;
      }
      .gameShell--present .guidedArrow{
        font-size:24px;
      }
      .gameShell--present .guidedSep{
        font-size:30px;
      }
      .gameActivityTitle{
        margin-top:6px;
        font-size:18px;
        font-weight:800;
        color:#0f172a;
        line-height:1.2;
      }
      .gameShell--present .gameActivityTitle{
        font-size:clamp(20px, 2vw, 28px);
      }
      .gameShell--present .wordProgress{
        width:min(760px,100%);
      }
      .gameShell--present .wordProgressText{
        font-size:16px;
      }
      .gameShell--present .attemptDot{
        width:38px;
        height:38px;
        font-size:14px;
      }
      .gameShell--present .btn{
        font-size:18px;
        padding:15px 22px;
        border-radius:16px;
      }
      .gameShell--present .feedback{
        min-height:30px;
        font-size:18px;
      }
      .gameShell--present .bigLetter{
        font-size:clamp(84px, 10vw, 112px);
      }
      .gameShell--present .scrollSlot{
        width:180px;
        height:108px;
        border-radius:18px;
      }
      .gameShell--present .scrollVal{
        font-size:44px;
      }
      .gameShell--present .scrollArrow{
        font-size:24px;
      }
      .gameShell--present .pupilAnswerInput{
        width:min(700px,96%);
        font-size:30px;
        padding:18px 20px;
      }
      .gameShell--present .supportArrange{
        width:min(980px,100%);
        gap:16px;
      }
      .gameShell--present .supportArrangeHint,
      .gameShell--present .spellLoomHint{
        font-size:clamp(24px, 2.2vw, 32px);
      }
      .gameShell--present .supportArrangeMeta,
      .gameShell--present .spellLoomMeta{
        font-size:16px;
      }
      .gameShell--present .supportArrangeSectionLabel,
      .gameShell--present .spellLoomSectionLabel{
        width:min(920px,96%);
        font-size:13px;
      }
      .gameShell--present .supportArrangeAnswer,
      .gameShell--present .supportArrangeBank{
        width:min(920px,96%);
        min-height:96px;
        padding:18px;
      }
      .gameShell--present .supportArrangeTile,
      .gameShell--present .supportArrangePlaceholder{
        min-width:76px;
        height:58px;
      }
      .gameShell--present .supportArrangeTile{
        font-size:28px;
      }
      .gameShell--present .supportArrangeAnswer .supportArrangeTile{
        font-size:var(--arrange-font-size, 28px);
      }
      .gameShell--present .spellLoom{
        width:min(1040px,100%);
        gap:18px;
      }
      .gameShell--present .spellLoomRailShell,
      .gameShell--present .spellLoomTray{
        width:min(960px,96%);
      }
      .gameShell--present .spellLoomRailShell{
        padding:24px 22px 34px;
      }
      .gameShell--present .spellLoomRail{
        --loom-gap:14px;
        min-height:146px;
      }
      .gameShell--present .spellLoomBridgeLayer,
      .gameShell--present .spellLoomMarkLayer{
        top:72px;
      }
      .gameShell--present .spellLoomCell{
        min-height:70px;
        font-size:30px;
      }
      .gameShell--present .spellLoomToken{
        min-width:88px;
        height:64px;
        padding:0 22px;
        font-size:var(--loom-token-font, 28px);
      }
      .gameShell--present .spellLoomTray{
        min-height:104px;
        padding:20px;
      }
      .gameShell--present .focusPreviewSegment,
      .gameShell--present .fs-letter{
        font-size:26px;
      }
      .gameShell--present .focusWordMarks{
        min-height:52px;
      }
      .gameShell--present .focusPreview .pr-cell{
        font-size:26px;
      }
      .gameShell--present .focusPreviewFrame{
        transform:scale(1.75);
        transform-origin:center top;
        margin:34px 0 88px;
      }
      .gameShell--present .focusWordShell{
        transform:scale(1.65);
        transform-origin:center top;
        margin:30px 0 40px;
      }
      .gameShell--present .fs-token-label{
        font-size:16px;
      }
      .gameShell--present .fs-arrow{
        font-size:18px;
      }
      .gameShell--present .focusPreviewShell + .muted{
        font-size:20px;
        margin-top:18px !important;
      }
      @media (max-width: 900px){
        .gameShell--present{
          padding:0 0 16px;
        }
        .gameShell--present .gamePromptLine{
          font-size:clamp(16px, 4.5vw, 22px);
        }
        .gameShell--present .btn{
          font-size:16px;
          padding:13px 18px;
        }
        .gameShell--present .focusPreviewFrame{
          transform:scale(1.35);
          margin:16px 0 40px;
        }
        .gameShell--present .focusWordShell{
          transform:scale(1.25);
          margin:14px 0 20px;
        }
      }
      .focusWordShell{
        display:inline-flex;
        flex-direction:column;
        align-items:center;
        gap:6px;
        margin-top:8px;
      }
      .focusPreviewShell{
        display:flex;
        justify-content:center;
        width:100%;
      }
      .focusPreviewFrame{
        position:relative;
        width:var(--focus-preview-width);
        max-width:100%;
        padding:22px 0;
      }
      .focusPreview .pr-scroll{
        width:auto;
        overflow:visible;
        padding-bottom:0;
      }
      .focusPreview .pr-wrap{
        min-width:0;
      }
      .focusPreview .pr-cell{
        font-size:18px;
      }
      .focusPreviewGrid{
        display:grid;
        row-gap:8px;
        justify-content:center;
      }
      .focusPreviewArrowRow,
      .focusPreviewWordRow{
        display:grid;
        column-gap:0;
        justify-content:center;
        align-items:center;
      }
      .focusPreviewArrowRow{
        min-height:18px;
      }
      .focusPreviewWordRow{
        min-height:42px;
      }
      .focusPreviewSegment{
        display:flex;
        align-items:flex-end;
        justify-content:center;
        min-height:42px;
        font-weight:800;
        font-size:18px;
        line-height:1;
        color:#0f172a;
        white-space:nowrap;
        border-bottom:4px solid transparent;
      }
      .focusPreviewSegment--focus{
        border-bottom-color:#f59e0b;
      }
      .focusPreviewSegment--placeholder{
        color:#cbd5e1;
      }
      .focusControlGrid,
      .focusWordLetters,
      .focusWordMarks,
      .focusLabelGrid{
        display:grid;
        column-gap:8px;
        justify-content:center;
      }
      .focusWordLetters{
        align-items:end;
      }
      .focusWordMarks{
        align-items:start;
        min-height:42px;
      }
      .focusControlGrid,
      .focusLabelGrid{
        align-items:center;
        min-height:18px;
      }
      .fs-letter{
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:800;
        font-size:18px;
        line-height:1;
        color:#0f172a;
        min-width:28px;
      }
      .fs-arrow{
        border:none;
        background:transparent;
        color:#6b7280;
        font-size:14px;
        line-height:1;
        cursor:pointer;
        padding:0;
        justify-self:center;
      }
      .fs-arrow--overlay{
        position:absolute;
      }
      .fs-arrow--top{
        top:0;
      }
      .fs-arrow--bottom{
        bottom:0;
      }
      .fs-token-label{
        font-size:14px;
        line-height:1;
        color:#cbd5e1;
        font-weight:700;
        justify-self:center;
        white-space:nowrap;
      }
      .fs-token-label-current{
        color:#cbd5e1;
      }
      .fs-token-button{
        border:none;
        background:transparent;
        padding:0;
        cursor:pointer;
      }
      .fs-token-button-active{
        color:#0f172a;
      }
      .choiceOptionCluster{
        display:flex;
        flex-wrap:nowrap;
        justify-content:center;
        align-items:center;
        gap:12px;
        width:min(var(--choice-cluster-width, 420px), 100%);
        margin:16px auto 0;
        overflow-x:auto;
        overflow-y:hidden;
      }
      .diagnosticChoiceShell{
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        width:100%;
        text-align:center;
      }
      .focusSoundShell{
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        width:100%;
        gap:10px;
        text-align:center;
      }
      .focusSoundPrompt{
        font-size:13px;
        font-weight:700;
        letter-spacing:.04em;
        color:#64748b;
        max-width:24ch;
      }
      .focusSoundTask{
        display:flex;
        justify-content:center;
        width:100%;
      }
      .focusSoundShell .focusPreviewFrame{
        padding:30px 0 22px;
      }
      .focusSoundShell .focusPreview .pr-cell{
        font-size:24px;
      }
      .focusSoundShell .focusPreviewSegment{
        min-height:52px;
        font-size:24px;
      }
      .focusSoundShell .fs-arrow{
        font-size:17px;
      }
      .focusSoundMeta{
        margin-top:0;
        text-align:center;
      }
      .diagnosticChoiceShell .focusPreviewFrame{
        padding:28px 0 10px;
      }
      .diagnosticChoiceShell .focusPreview .pr-cell{
        font-size:24px;
      }
      .diagnosticChoiceShell .focusPreviewSegment{
        min-height:50px;
        font-size:24px;
      }
      .choiceOptionChip{
        min-width:96px;
        min-height:56px;
        padding:13px 20px;
        border-radius:16px;
        font-size:21px;
        font-weight:800;
        line-height:1;
      }
      .gameShell--present .choiceOptionChip{
        min-width:116px;
        min-height:66px;
        font-size:25px;
      }
      .gameShell--present .diagnosticChoiceShell .focusPreview .pr-cell,
      .gameShell--present .diagnosticChoiceShell .focusPreviewSegment{
        font-size:28px;
      }
      .gameShell--present .focusSoundPrompt{
        font-size:14px;
      }
      .gameShell--present .focusSoundShell .focusPreviewFrame{
        padding:34px 0 26px;
      }
      .gameShell--present .focusSoundShell .focusPreview .pr-cell,
      .gameShell--present .focusSoundShell .focusPreviewSegment{
        font-size:28px;
      }
      .gameShell--present .focusSoundShell .fs-arrow{
        font-size:21px;
      }
      @media (max-width: 640px){
        .choiceOptionCluster{
          flex-wrap:wrap;
          overflow-x:visible;
        }
      }
      .fs-dot{
        width:10px;
        height:10px;
        border-radius:999px;
        background:#94a3b8;
        justify-self:center;
        align-self:start;
        margin-top:1px;
      }
      .fs-underline{
        height:4px;
        background:#f59e0b;
        border-radius:999px;
        align-self:start;
        margin-top:5px;
      }
      .fs-split{
        position:relative;
        height:22px;
        align-self:start;
      }
      .fs-split-dot{
        position:absolute;
        top:0;
        width:10px;
        height:10px;
        border-radius:999px;
        background:#94a3b8;
      }
      .fs-split-dot-left{
        left:0;
      }
      .fs-split-dot-right{
        right:0;
      }
      .fs-split-bridge{
        position:absolute;
        left:5px;
        right:5px;
        top:4px;
        height:16px;
        border-left:4px solid #f59e0b;
        border-right:4px solid #f59e0b;
        border-bottom:4px solid #f59e0b;
        border-bottom-left-radius:14px;
        border-bottom-right-radius:14px;
      }
      .fs-markSvg{
        display:block;
        overflow:visible;
      }
      .gameModalBackdrop{
        position:fixed;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(15,23,42,.36);
        z-index:40;
      }
      .gameModalBackdrop[hidden]{
        display:none;
      }
      .gameModalCard{
        width:min(420px, 100%);
        background:#fff;
        border:1px solid #cbd5e1;
        border-radius:24px;
        box-shadow:0 22px 60px rgba(15,23,42,.18);
        padding:22px;
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      .gameModalTitle{
        margin:0;
        font-size:24px;
        font-weight:800;
        color:#0f172a;
      }
      .gameModalBody{
        margin:0;
        color:#475569;
        font-size:16px;
        line-height:1.5;
      }
      .gameModalActions{
        display:flex;
        gap:10px;
        justify-content:flex-end;
        flex-wrap:wrap;
        margin-top:6px;
      }
      .gameModalActions .btn{
        min-width:144px;
      }
      @media (max-width: 640px){
        .gameModalCard{
          padding:18px;
          border-radius:20px;
        }
        .gameModalTitle{
          font-size:22px;
        }
        .gameModalActions{
          flex-direction:column-reverse;
        }
        .gameModalActions .btn{
          width:100%;
        }
      }
    </style>
    <div id="gameShell" class="gameShell ${presentationMode ? "gameShell--present" : ""}">
    <div class="gameTop gameTop--enhanced">
      <div class="gameTopLeft">
        <div>Word <b id="wNum">1</b> of <b id="wTot">0</b></div>
        ${!presentationMode && String(testMeta?.title || "").trim() ? `<div id="gameActivityTitle" class="gameActivityTitle">${escapeHtml(String(testMeta.title || "").trim())}</div>` : ""}
      </div>
      <div class="gameTopRight">
        <div class="pills">
          <span class="pill">Question: <b id="modeText"></b></span>
          <span class="pill">Tries left: <b id="attemptsLeftTop">${hasUnlimitedAttempts ? "Unlimited" : "0"}</b></span>
          <span class="pill">Score: <b id="score">0</b></span>
        </div>
        <button id="btnExit" class="gameCloseBtn" type="button" aria-label="Exit activity" title="Exit activity">&times;</button>
      </div>
    </div>

    <div class="hr"></div>

    <div class="center">
      <div id="promptLine" class="muted gamePromptLine" style="text-align:center;"></div>
      <div id="sentenceLine" class="muted gameSentenceLine" style="text-align:center; display:none;"></div>

      <div class="wordProgress">
        <div class="wordProgressBar"><span id="wordProgressFill"></span></div>
        <div class="wordProgressText" id="wordProgressText"></div>
      </div>

      <div class="attemptDots" id="attemptDots"></div>

      <div id="main"></div>

      <div class="row gameActionRow">
        <button id="btnListen" class="btn secondary" type="button">🔊 Listen</button>
        <button id="btnCheck" class="btn" type="button">Check word</button>
        <button id="btnNext" class="btn secondary" type="button" style="display:none;">Next</button>
      </div>

      <div id="feedback" class="feedback"></div>
    </div>
    </div>
    <div id="leaveConfirm" class="gameModalBackdrop" hidden aria-hidden="true">
      <div class="gameModalCard" role="dialog" aria-modal="true" aria-labelledby="leaveConfirmTitle" aria-describedby="leaveConfirmBody">
        <h2 id="leaveConfirmTitle" class="gameModalTitle">Leave test?</h2>
        <p id="leaveConfirmBody" class="gameModalBody">Your progress will be saved and you can continue later.</p>
        <div class="gameModalActions">
          <button id="btnLeaveContinue" class="btn secondary" type="button">Continue test</button>
          <button id="btnLeaveSave" class="btn" type="button">Save and leave</button>
        </div>
      </div>
    </div>
  `;

  const $ = (id) => host.querySelector(`#${id}`);
  const wNum = $("wNum");
  const wTot = $("wTot");
  const scoreEl = $("score");
  const modeText = $("modeText");
  const promptLine = $("promptLine");
  const sentenceLine = $("sentenceLine");
  const wordProgressFill = $("wordProgressFill");
  const wordProgressText = $("wordProgressText");
  const attemptDots = $("attemptDots");
  const attemptsLeftTop = $("attemptsLeftTop");
  const main = $("main");
  const gameShell = $("gameShell");
  const feedback = $("feedback");
  const btnListen = $("btnListen");
  const btnCheck = $("btnCheck");
  const btnNext = $("btnNext");
  const btnExit = $("btnExit");
  const leaveConfirm = $("leaveConfirm");
  const btnLeaveContinue = $("btnLeaveContinue");
  const btnLeaveSave = $("btnLeaveSave");

  wTot.textContent = String(words.length);

  function currentItem() {
    return words[idx] || null;
  }

  function getItemStateKey(item) {
    const targetId = String(item?.assignment_target_id || item?.assignmentTargetId || "").trim();
    if (targetId) return `target:${targetId}`;
    const wordId = String(item?.base_test_word_id || item?.id || "").trim();
    return wordId ? `word:${wordId}` : "";
  }

  function getChoice(item) {
    return item?.choice && typeof item.choice === "object" ? item.choice : {};
  }

  function normalizeChoiceFlag(value) {
    if (typeof value === "boolean") return value;
    const clean = String(value || "").trim().toLowerCase();
    return clean === "true" || clean === "1" || clean === "yes";
  }

  function isBaselineDiagnosticItem(item) {
    const choice = getChoice(item);
    return normalizeChoiceFlag(choice?.baseline_v1)
      && String(choice?.baseline_signal || "").trim().toLowerCase() === "diagnostic";
  }

  function shouldUseFocusOnlyMultipleChoice(item) {
    const choice = getChoice(item);
    const diagnosticPickerMode = String(
      choice?.diagnostic_picker_mode
      || choice?.diagnosticPickerMode
      || choice?.picker_mode
      || choice?.pickerMode
      || ""
    ).trim().toLowerCase();
    if (["focus_only", "focus_diagnostic"].includes(diagnosticPickerMode)) return true;
    if (
      normalizeChoiceFlag(choice?.focus_only_picker)
      || normalizeChoiceFlag(choice?.focusOnlyPicker)
      || normalizeChoiceFlag(choice?.focus_diagnostic)
      || normalizeChoiceFlag(choice?.focusDiagnostic)
    ) {
      return true;
    }
    return isBaselineDiagnosticItem(item);
  }

  function getScrollStateKey(item, modeKind) {
    const segments = Array.isArray(item?.segments) ? item.segments.join("|") : "";
    return `${modeKind}::${item?.id || ""}::${item?.word || ""}::${segments}`;
  }

  function shouldReuseScroll(item, modeKind) {
    return !!currentScroll
      && currentScroll.modeKind === modeKind
      && currentScroll.stateKey === getScrollStateKey(item, modeKind);
  }

  function setScrollState(item, modeKind, scrollState) {
    scrollState.modeKind = modeKind;
    scrollState.stateKey = getScrollStateKey(item, modeKind);
    currentScroll = scrollState;
    return currentScroll;
  }

  function getArrangementStateKey(item) {
    const segments = Array.isArray(item?.segments) ? item.segments.join("|") : "";
    return `arrange::${item?.id || ""}::${item?.word || ""}::${segments}`;
  }

  function shouldReuseArrangement(item) {
    return !!currentArrange && currentArrange.stateKey === getArrangementStateKey(item);
  }

  function setArrangementState(item, arrangeState) {
    arrangeState.stateKey = getArrangementStateKey(item);
    currentArrange = arrangeState;
    return currentArrange;
  }

  function getLoomStateKey(item) {
    const segments = Array.isArray(item?.segments) ? item.segments.join("|") : "";
    return `loom::${item?.id || ""}::${item?.word || ""}::${segments}`;
  }

  function shouldReuseLoom(item) {
    return !!currentLoom && currentLoom.stateKey === getLoomStateKey(item);
  }

  function setLoomState(item, loomState) {
    loomState.stateKey = getLoomStateKey(item);
    currentLoom = loomState;
    return currentLoom;
  }

  function getSegmentedStateKey(item, safeWord = "") {
    const segments = Array.isArray(item?.segments) ? item.segments.join("|") : "";
    return `segmented::${item?.id || ""}::${safeWord}::${segments}`;
  }

  function shouldReuseSegmented(item, safeWord = "") {
    return !!currentSegmented
      && currentSegmented.stateKey === getSegmentedStateKey(item, safeWord);
  }

  function setSegmentedState(item, safeWord, segmentedState) {
    segmentedState.stateKey = getSegmentedStateKey(item, safeWord);
    currentSegmented = segmentedState;
    return currentSegmented;
  }

  function normalizeTestLevelQuestionType(value) {
    return normalizeStoredQuestionType(value, {
      title: testMeta?.title,
      mode: testMeta?.mode,
    });
  }

  function resolveQuestionType(item) {
    const choice = getChoice(item);
    const explicit =
      String(
        choice.question_type ||
        choice.questionType ||
        choice.mode ||
        ""
      ).trim().toLowerCase();

    if (explicit) {
      if (["segmented_spelling", "segmentedspelling", "segmented", "segmented_boxes", "segmented_independent"].includes(explicit)) return "full_recall";
      if (["focus_sound", "focussound"].includes(explicit)) return "guided_encoding";
      if (["spell_loom", "spellloom", "loom"].includes(explicit)) return "dictation_sentence";
      if (["type_what_you_hear", "typewhatyouhear", "supported_typing", "supported_type"].includes(explicit)) return "dictation_sentence";
      if (["no_support_assessment", "nosupportassessment", "independent", "independent_spelling"].includes(explicit)) return "full_recall";
      if ([
        "build_whole_word",
        "buildwholeword",
        "full_picker",
        "full_word_build",
      ].includes(explicit)) return "dictation_sentence";
      if ([
        "multiple_choice_grapheme_picker",
        "multiplechoicegraphemepicker",
        "grapheme_picker",
        "multiple_choice",
      ].includes(explicit)) return "multiple_choice_grapheme_picker";
      if (["guided_encoding", "guided", "scroll", "grapheme_choice", "scroll_picker"].includes(explicit)) return "guided_encoding";
      if (["full_recall", "full", "test"].includes(explicit)) return "full_recall";
      if (["dictation_sentence", "dictation", "sentence", "audio"].includes(explicit)) return "dictation_sentence";
    }

    const testLevelType = normalizeTestLevelQuestionType(testMeta?.question_type);
    if (testLevelType) {
      if (testLevelType === "focus_sound") return "guided_encoding";
      if (testLevelType === "spell_loom") return "dictation_sentence";
      if (testLevelType === "type_what_you_hear") return "dictation_sentence";
      if (testLevelType === "segmented_spelling") return "full_recall";
      if (testLevelType === "no_support_assessment") return "full_recall";
    }

    const assignmentMode = String(testMeta?.mode || "").trim().toLowerCase();
    if (assignmentMode === "practice" || assignmentMode === "learn") return "guided_encoding";
    return "full_recall";
  }

  function resolveModeKind(item) {
    const choice = getChoice(item);
    const explicit =
      String(
        choice.question_type ||
        choice.questionType ||
        choice.mode ||
        ""
      ).trim().toLowerCase();
    if ([
      "segmented_spelling",
      "segmentedspelling",
      "segmented",
      "segmented_boxes",
      "segmented_independent",
    ].includes(explicit)) return "segmented_spelling";
    if ([
      "multiple_choice_grapheme_picker",
      "multiplechoicegraphemepicker",
      "grapheme_picker",
      "multiple_choice",
    ].includes(explicit)) return "multiple_choice_grapheme_picker";
    if (["spell_loom", "spellloom", "loom"].includes(explicit)) return "spell_loom";
    if (["focus_sound", "focussound", "guided_encoding", "guided", "scroll", "grapheme_choice", "scroll_picker"].includes(explicit)) {
      return "focus_sound";
    }
    if (["type_what_you_hear", "typewhatyouhear", "supported_typing", "supported_type", "build_whole_word", "buildwholeword", "full_picker", "full_word_build"].includes(explicit)) {
      return "type_what_you_hear";
    }
    if (["no_support_assessment", "nosupportassessment", "independent", "independent_spelling", "full_recall", "full", "test"].includes(explicit)) {
      return "no_support_assessment";
    }

    const testLevelType = normalizeTestLevelQuestionType(testMeta?.question_type);
    if (testLevelType) return testLevelType;

    const questionType = resolveQuestionType(item);
    if (questionType === "guided_encoding") return "focus_sound";
    if (questionType === "multiple_choice_grapheme_picker") return "multiple_choice_grapheme_picker";
    if (questionType === "dictation_sentence") return "type_what_you_hear";
    return "no_support_assessment";
  }

  function getQuestionHeaderLabel(type) {
    if (type === "multiple_choice_grapheme_picker") return "Choose the grapheme";
    if (type === "focus_sound" || type === "guided_encoding") return "Focus sound";
    if (type === "spell_loom") return "Spell Loom";
    if (type === "type_what_you_hear" || type === "dictation_sentence") return "Arrange what you hear";
    if (type === "segmented_spelling") return "Segmented spelling";
    if (type === "no_support_assessment" || type === "full_recall") return "Independent spelling";
    return "";
  }

  function readableQuestionType(item, type = currentModeKind) {
    const choice = getChoice(item);
    const explicitType = normalizeStoredQuestionType(
      choice?.question_type
      ?? choice?.questionType
      ?? choice?.mode
      ?? "",
      {
        title: testMeta?.title,
        mode: testMeta?.mode,
      }
    );
    const explicitLabel = explicitType ? getQuestionHeaderLabel(explicitType) : "";
    if (explicitLabel) return explicitLabel;

    const modeLabel = getQuestionHeaderLabel(type);
    if (modeLabel) return modeLabel;

    const testLevelType = normalizeTestLevelQuestionType(testMeta?.question_type);
    if (testLevelType) {
      return getQuestionTypeDisplayLabel(testLevelType, {
        noSupportLabel: "Independent spelling",
        fallbackLabel: "Test",
      });
    }

    return "Test";
  }

  function getAttemptsAllowedForItem(item = currentItem()) {
    return resolveItemAttemptsAllowed(item, testMeta);
  }

  function cloneProgressInputState(inputState = null) {
    const source = inputState && typeof inputState === "object" ? inputState : null;
    const kind = String(source?.kind || "").trim().toLowerCase();
    if (!kind) return null;

    if (kind === "full_recall") {
      return {
        kind,
        value: String(source?.value ?? ""),
      };
    }

    if (kind === "scroll") {
      return {
        kind,
        values: Array.isArray(source?.values) ? source.values.map((value) => String(value ?? "")) : [],
        activeIndex: Math.max(0, Number(source?.activeIndex || 0)),
      };
    }

    if (kind === "arrange") {
      return {
        kind,
        slots: Array.isArray(source?.slots)
          ? source.slots.map((value) => {
            const tokenId = String(value || "").trim();
            return tokenId || null;
          })
          : [],
        activeSlotIndex: Math.max(0, Number(source?.activeSlotIndex || 0)),
      };
    }

    if (kind === "loom") {
      return {
        kind,
        placements: Array.isArray(source?.placements)
          ? source.placements
            .map((entry) => ({
              tokenId: String(entry?.tokenId || "").trim(),
              start: Math.max(0, Number(entry?.start || 0)),
            }))
            .filter((entry) => entry.tokenId)
          : [],
      };
    }

    if (kind === "segmented") {
      return {
        kind,
        letters: Array.isArray(source?.letters) ? source.letters.map((value) => String(value ?? "")) : [],
        activeIndex: Math.max(0, Number(source?.activeIndex || 0)),
      };
    }

    return null;
  }

  function cloneProgressFeedbackState(feedbackState = null) {
    const source = feedbackState && typeof feedbackState === "object" ? feedbackState : null;
    const kind = String(source?.kind || "").trim().toLowerCase();
    if (kind !== "final_wrong_reveal") return null;

    return {
      kind,
      pending: source?.pending !== false,
    };
  }

  function hasPendingFinalWrongReveal(entry = null) {
    return !!entry?.completed
      && !entry?.correct
      && entry?.feedbackState?.kind === "final_wrong_reveal"
      && entry.feedbackState.pending !== false;
  }

  function buildStoredProgressEntry(item, {
    completed = false,
    correct = false,
    typed = "",
    attemptsUsed = 0,
    attemptsAllowed = null,
    questionType = null,
    modeKind = null,
    inputState = null,
    feedbackState = null,
    index = null,
  } = {}) {
    if (!item) return null;
    const choice = getChoice(item);
    const itemKey = getItemStateKey(item);
    const resolvedWordText = String(item?.word || "").trim()
      || buildWordFromGraphemes(Array.isArray(item?.segments) ? item.segments : []);
    const resolvedAttemptsAllowed = Number.isFinite(Number(attemptsAllowed))
      ? Math.max(1, Number(attemptsAllowed))
      : getAttemptsAllowedForItem(item);
    const safeCompleted = completed === true;
    const safeAttemptsUsed = safeCompleted
      ? Math.max(1, Number(attemptsUsed || 1))
      : Math.max(0, Number(attemptsUsed || 0));

    return {
      itemKey,
      index: Number.isFinite(Number(index)) ? Number(index) : null,
      wordId: item?.id || null,
      word: resolvedWordText,
      typed: String(typed ?? "").trim(),
      correct: !!correct,
      completed: safeCompleted,
      attemptsUsed: safeAttemptsUsed,
      attemptsAllowed: resolvedAttemptsAllowed,
      correctSpelling: resolvedWordText,
      questionType: String(questionType || resolveQuestionType(item) || "").trim() || null,
      modeKind: String(modeKind || resolveModeKind(item) || "").trim() || null,
      wordSource: item?.is_target_word ? "targeted" : "base",
      baseTestWordId: item?.base_test_word_id || item?.id || null,
      assignmentTargetId: item?.assignment_target_id || item?.assignmentTargetId || null,
      focusGrapheme: getResolvedFocusGrapheme(item),
      patternType: choice?.pattern_type || null,
      targetGraphemes: Array.isArray(item?.segments) ? item.segments : [],
      inputState: cloneProgressInputState(inputState),
      feedbackState: cloneProgressFeedbackState(feedbackState),
    };
  }

  function shouldPersistProgressEntry(entry) {
    if (!entry?.itemKey) return false;
    if (entry.completed) return true;
    if (Math.max(0, Number(entry?.attemptsUsed || 0)) > 0) return true;
    if (String(entry?.typed ?? "").trim()) return true;
    const inputState = entry?.inputState && typeof entry.inputState === "object" ? entry.inputState : null;
    if (!inputState) return false;

    if (inputState.kind === "full_recall") return !!String(inputState.value || "").trim();
    if (inputState.kind === "scroll") {
      return Array.isArray(inputState.values) && inputState.values.some((value) => String(value || "").trim());
    }
    if (inputState.kind === "arrange") {
      return Array.isArray(inputState.slots) && inputState.slots.some((value) => !!String(value || "").trim());
    }
    if (inputState.kind === "loom") {
      return Array.isArray(inputState.placements) && inputState.placements.length > 0;
    }
    if (inputState.kind === "segmented") {
      return Array.isArray(inputState.letters) && inputState.letters.some((value) => String(value || "").trim());
    }
    return false;
  }

  function getProgressEntry(item = currentItem()) {
    const itemKey = getItemStateKey(item);
    return itemKey ? progressEntries.get(itemKey) || null : null;
  }

  function buildCompletedResultRow(item, entry) {
    return {
      wordId: entry?.wordId || item?.id || null,
      word: entry?.word || String(item?.word || "").trim(),
      typed: String(entry?.typed ?? "").trim(),
      correct: !!entry?.correct,
      attemptsUsed: Math.max(1, Number(entry?.attemptsUsed || 1)),
      attemptsAllowed: Number.isFinite(Number(entry?.attemptsAllowed))
        ? Math.max(1, Number(entry.attemptsAllowed))
        : getAttemptsAllowedForItem(item),
      correctSpelling: entry?.correctSpelling || String(item?.word || "").trim(),
      questionType: entry?.questionType || resolveQuestionType(item),
      wordSource: entry?.wordSource || (item?.is_target_word ? "targeted" : "base"),
      baseTestWordId: entry?.baseTestWordId || item?.base_test_word_id || item?.id || null,
      assignmentTargetId: entry?.assignmentTargetId || item?.assignment_target_id || item?.assignmentTargetId || null,
      focusGrapheme: entry?.focusGrapheme || getResolvedFocusGrapheme(item),
      patternType: entry?.patternType || getChoice(item)?.pattern_type || null,
      targetGraphemes: Array.isArray(entry?.targetGraphemes) ? entry.targetGraphemes : (Array.isArray(item?.segments) ? item.segments : []),
    };
  }

  function upsertCompletedResult(item, entry) {
    const completedRow = buildCompletedResultRow(item, entry);
    const itemKey = entry?.itemKey || getItemStateKey(item);
    const existingIndex = results.findIndex((row) => {
      const rowTargetId = String(row?.assignmentTargetId || "").trim();
      if (rowTargetId && itemKey === `target:${rowTargetId}`) return true;
      const rowWordId = String(row?.baseTestWordId || row?.wordId || "").trim();
      return rowWordId && itemKey === `word:${rowWordId}`;
    });
    if (existingIndex >= 0) {
      results[existingIndex] = completedRow;
      return;
    }
    results.push(completedRow);
  }

  function hasPendingFinalWrongRevealInSession() {
    return words.some((item) => hasPendingFinalWrongReveal(progressEntries.get(getItemStateKey(item))));
  }

  function rebuildSessionResultState() {
    results.length = 0;
    totalCorrect = 0;
    totalAttemptsUsed = 0;

    for (const item of words) {
      const entry = progressEntries.get(getItemStateKey(item));
      if (!entry?.completed) continue;
      totalCorrect += entry.correct ? 1 : 0;
      totalAttemptsUsed += Math.max(1, Number(entry.attemptsUsed || 1));
      results.push(buildCompletedResultRow(item, entry));
    }
  }

  function buildCompletionPayload() {
    if (!words.length) {
      return {
        totalWords: 0,
        totalCorrect: 0,
        averageAttempts: 0,
        results: [],
        attemptsAllowed: getAttemptsAllowedForItem(),
        testTitle: testMeta?.title || "Test",
      };
    }

    const completedRows = [];
    for (const item of words) {
      const entry = progressEntries.get(getItemStateKey(item));
      if (!entry?.completed) return null;
      completedRows.push(buildCompletedResultRow(item, entry));
    }

    const completedCorrect = completedRows.filter((row) => !!row?.correct).length;
    const completedAttempts = completedRows.reduce((sum, row) => (
      sum + Math.max(1, Number(row?.attemptsUsed || 1))
    ), 0);

    return {
      totalWords: words.length,
      totalCorrect: completedCorrect,
      averageAttempts: completedRows.length ? completedAttempts / completedRows.length : 0,
      results: completedRows,
      attemptsAllowed: getAttemptsAllowedForItem(),
      testTitle: testMeta?.title || "Test",
    };
  }

  function beginFinishingState() {
    completionInFlight = true;
    locked = true;
    stopAudioPlayback();
    btnExit.disabled = true;
    btnListen.disabled = true;
    btnCheck.disabled = true;
    btnNext.disabled = true;
    btnNext.textContent = "Finishing...";
    feedback.innerHTML = "";
  }

  function endFinishingState({ allowRetry = false } = {}) {
    completionInFlight = false;
    btnExit.disabled = false;
    btnListen.disabled = false;
    if (allowRetry) {
      btnNext.disabled = false;
      btnNext.textContent = idx >= words.length - 1 ? "Finish test" : "Next word";
    }
  }

  function captureCurrentInputState() {
    if (currentModeKind === "segmented_spelling" && currentSegmented) {
      return {
        kind: "segmented",
        letters: currentSegmented.letters.slice(),
        activeIndex: Number(currentSegmented.activeIndex || 0),
      };
    }

    if (currentModeKind === "type_what_you_hear" && currentArrange) {
      return {
        kind: "arrange",
        slots: currentArrange.slots.map((token) => token?.id || null),
        activeSlotIndex: Number(currentArrange.activeSlotIndex || 0),
      };
    }

    if (currentModeKind === "spell_loom" && currentLoom) {
      return {
        kind: "loom",
        placements: currentLoom.placements.map((entry) => ({
          tokenId: entry?.token?.id || "",
          start: Number(entry?.start || 0),
        })),
      };
    }

    if ((currentModeKind === "focus_sound" || currentModeKind === "multiple_choice_grapheme_picker") && currentScroll) {
      return {
        kind: "scroll",
        values: Array.isArray(currentScroll.values) ? currentScroll.values.slice() : [],
        activeIndex: Number(currentScroll.active ?? currentScroll.focusIndex ?? 0),
      };
    }

    const input = main.querySelector("#pupilAnswer");
    return {
      kind: "full_recall",
      value: String(input?.value || "").trim(),
    };
  }

  function buildCurrentDraftProgressEntry(item = currentItem()) {
    if (!item) return null;
    const existingEntry = getProgressEntry(item);
    const attemptsUsed = Math.max(
      Math.max(0, Number(existingEntry?.completed ? 0 : existingEntry?.attemptsUsed || 0)),
      Math.max(0, currentAttempt - 1)
    );
    const lastSubmittedTyped = attemptsUsed > 0
      ? String(existingEntry?.typed ?? "").trim()
      : getCurrentTypedValue();
    return buildStoredProgressEntry(item, {
      completed: false,
      correct: false,
      typed: lastSubmittedTyped,
      attemptsUsed,
      attemptsAllowed: getAttemptsAllowedForItem(item),
      questionType: resolveQuestionType(item),
      modeKind: currentModeKind || resolveModeKind(item),
      inputState: captureCurrentInputState(),
      feedbackState: null,
      index: idx + 1,
    });
  }

  function getProgressEntryForIndex(index) {
    const item = words[index] || null;
    if (!item) return null;
    const itemKey = getItemStateKey(item);
    if (index === idx && !locked) {
      const draftEntry = buildCurrentDraftProgressEntry(item);
      return shouldPersistProgressEntry(draftEntry) ? draftEntry : (itemKey ? progressEntries.get(itemKey) || null : null);
    }
    return itemKey ? progressEntries.get(itemKey) || null : null;
  }

  function findNextUnfinishedIndex(startIndex = 0) {
    const safeStartIndex = Math.max(0, Number(startIndex || 0));
    for (let i = safeStartIndex; i < words.length; i += 1) {
      if (!getProgressEntryForIndex(i)?.completed) return i;
    }
    return words.length;
  }

  function buildProgressSnapshot() {
    const itemStates = [];
    for (let index = 0; index < words.length; index += 1) {
      const entry = getProgressEntryForIndex(index);
      if (!shouldPersistProgressEntry(entry)) continue;
      itemStates.push({
        ...entry,
        index: index + 1,
      });
    }

    return {
      startedAt: resumeState?.startedAt || null,
      currentIndex: idx,
      nextIndex: findNextUnfinishedIndex(0),
      totalWords: words.length,
      totalCorrect,
      totalAttemptsUsed,
      itemStates,
    };
  }

  function pushProgressSnapshot() {
    if (progressClosed || !assignmentId || typeof onProgress !== "function") return Promise.resolve();
    const snapshot = buildProgressSnapshot();
    progressSyncPromise = progressSyncPromise
      .catch(() => undefined)
      .then(() => onProgress(snapshot));
    return progressSyncPromise;
  }

  function scheduleProgressSync({ immediate = false } = {}) {
    if (progressClosed || !assignmentId || typeof onProgress !== "function") return;
    if (progressSyncTimer) {
      window.clearTimeout(progressSyncTimer);
      progressSyncTimer = 0;
    }
    if (immediate) {
      void pushProgressSnapshot();
      return;
    }
    progressSyncTimer = window.setTimeout(() => {
      progressSyncTimer = 0;
      void pushProgressSnapshot();
    }, 120);
  }

  async function flushProgressSync() {
    if (progressClosed || !assignmentId || typeof onProgress !== "function") return;
    if (progressSyncTimer) {
      window.clearTimeout(progressSyncTimer);
      progressSyncTimer = 0;
      await pushProgressSnapshot();
      return;
    }
    await progressSyncPromise.catch(() => undefined);
  }

  function hasUnfinishedProgress() {
    return findNextUnfinishedIndex(0) < words.length || hasPendingFinalWrongRevealInSession();
  }

  function clearAutoPlayTimer() {
    if (autoPlayTimer) {
      window.clearTimeout(autoPlayTimer);
      autoPlayTimer = 0;
    }
  }

  function clearSegmentedRefocusTimer() {
    if (segmentedRefocusTimer) {
      window.clearTimeout(segmentedRefocusTimer);
      segmentedRefocusTimer = 0;
    }
  }

  function stopAudioPlayback() {
    audioPlaybackVersion += 1;
    clearAutoPlayTimer();
    clearSegmentedRefocusTimer();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function scheduleAutoPlay(item = currentItem()) {
    if (!item || !shouldAutoPlay(item)) return;
    stopAudioPlayback();
    const scheduledVersion = audioPlaybackVersion;
    const scheduledItemKey = getItemStateKey(item);
    autoPlayTimer = window.setTimeout(() => {
      autoPlayTimer = 0;
      playCurrentAudio({ scheduledVersion, scheduledItemKey });
    }, 120);
  }

  function focusCurrentControl() {
    if (currentModeKind === "segmented_spelling") {
      focusSegmentedController();
      return;
    }
    const input = main.querySelector("#pupilAnswer");
    if (input instanceof HTMLInputElement) {
      input.focus();
      return;
    }
    if (typeof btnCheck?.focus === "function") btnCheck.focus();
  }

  function showLeaveConfirm() {
    if (!leaveConfirm || leaveConfirmOpen) return;
    leaveConfirmOpen = true;
    gameShell?.classList.add("gameShell--modal-open");
    leaveConfirm.hidden = false;
    leaveConfirm.setAttribute("aria-hidden", "false");
    btnLeaveContinue?.focus();
  }

  function hideLeaveConfirm({ restoreFocus = true } = {}) {
    if (!leaveConfirm || !leaveConfirmOpen) return;
    leaveConfirmOpen = false;
    leaveConfirm.hidden = true;
    leaveConfirm.setAttribute("aria-hidden", "true");
    gameShell?.classList.remove("gameShell--modal-open");
    if (restoreFocus) focusCurrentControl();
  }

  async function exitWithSave() {
    stopAudioPlayback();
    hideLeaveConfirm({ restoreFocus: false });
    await flushProgressSync();
    progressClosed = true;
    onExit?.();
  }

  function requestLeave() {
    if (completionInFlight) return;
    stopAudioPlayback();
    if (progressClosed || !hasUnfinishedProgress()) {
      void exitWithSave();
      return;
    }
    showLeaveConfirm();
  }

  function isFixedChoiceModeWithDuplicateGuard() {
    return currentModeKind === "focus_sound" || currentModeKind === "multiple_choice_grapheme_picker";
  }

  function shouldBlockRepeatedWrongChoice(item, typed) {
    if (!isFixedChoiceModeWithDuplicateGuard()) return false;
    const previousEntry = getProgressEntry(item);
    if (!previousEntry || previousEntry.completed || previousEntry.correct) return false;
    if (Math.max(0, Number(previousEntry.attemptsUsed || 0)) < 1) return false;

    const normalizedTyped = String(typed || "").trim().toLowerCase();
    const normalizedPrevious = String(previousEntry.typed || "").trim().toLowerCase();
    if (!normalizedTyped || !normalizedPrevious || normalizedTyped !== normalizedPrevious) return false;
    return !isCurrentCorrect(typed);
  }

  function seedProgressFromResumeState() {
    const resumeRows = Array.isArray(resumeState?.itemStates) ? resumeState.itemStates : [];
    let resumeRevealIndex = -1;
    for (const [index, item] of words.entries()) {
      const itemKey = getItemStateKey(item);
      if (!itemKey) continue;
      const resumeEntry = resumeRows.find((entry) => String(entry?.itemKey || "").trim() === itemKey);
      if (!resumeEntry) continue;
      const storedEntry = buildStoredProgressEntry(item, {
        completed: resumeEntry?.completed === true,
        correct: !!resumeEntry?.correct,
        typed: String(resumeEntry?.typed ?? "").trim(),
        attemptsUsed: resumeEntry?.attemptsUsed,
        attemptsAllowed: resumeEntry?.attemptsAllowed,
        questionType: resumeEntry?.questionType,
        modeKind: resumeEntry?.modeKind,
        inputState: resumeEntry?.inputState,
        feedbackState: resumeEntry?.feedbackState,
        index: Number(resumeEntry?.index || index + 1),
      });
      if (!storedEntry) continue;
      progressEntries.set(itemKey, storedEntry);
      if (resumeRevealIndex < 0 && hasPendingFinalWrongReveal(storedEntry)) {
        resumeRevealIndex = index;
      }
    }
    rebuildSessionResultState();

    if (resumeRevealIndex >= 0) {
      idx = resumeRevealIndex;
      return;
    }

    const initialIndex = findNextUnfinishedIndex(0);
    if (initialIndex < words.length) {
      idx = initialIndex;
      return;
    }
    idx = Math.max(0, words.length - 1);
  }

  function isAudioEnabled() {
    return testMeta?.audio_enabled !== false && testMeta?.audioEnabled !== false;
  }

  function isHintsEnabled() {
    return testMeta?.hints_enabled !== false && testMeta?.hintsEnabled !== false;
  }

  function shouldRevealOnFinalWrong(item) {
    if (!presentationMode) return true;
    const choice = getChoice(item);
    if (typeof choice.reveal_on_final_wrong === "boolean") return choice.reveal_on_final_wrong;
    if (typeof choice.revealOnFinalWrong === "boolean") return choice.revealOnFinalWrong;
    return isHintsEnabled();
  }

  function shouldAutoPlay(item) {
    const choice = getChoice(item);
    if (!isAudioEnabled()) return false;
    if (typeof choice.auto_play === "boolean") return choice.auto_play;
    if (typeof choice.autoPlay === "boolean") return choice.autoPlay;
    return true;
  }

  function getResolvedFocusGrapheme(item) {
    const targetParts = getTargetParts(item);
    if (!targetParts.length) return null;

    if (resolveModeKind(item) === "focus_sound") {
      const focusIndex = typeof currentScroll?.focusIndex === "number"
        ? currentScroll.focusIndex
        : getFocusIndex(item, targetParts);
      return targetParts[focusIndex] || null;
    }

    const choice = getChoice(item);
    return choice?.focus_grapheme || (Array.isArray(choice?.focus_graphemes) ? choice.focus_graphemes[0] : null) || null;
  }

  function speak(text) {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const preferred =
      voices.find((v) => /en-GB/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
  }

  function playCurrentAudio({ scheduledVersion = audioPlaybackVersion, scheduledItemKey = getItemStateKey(currentItem()) } = {}) {
    if (progressClosed || completionInFlight) return;
    if (scheduledVersion !== audioPlaybackVersion) return;
    const item = currentItem();
    if (!item) return;
    if (scheduledItemKey && scheduledItemKey !== getItemStateKey(item)) return;
    const spoken = item?.word || item?.sentence || "";
    speak(spoken);
    if (currentModeKind === "segmented_spelling") {
      focusSegmentedController();
      const refocusVersion = scheduledVersion;
      segmentedRefocusTimer = window.setTimeout(() => {
        segmentedRefocusTimer = 0;
        if (progressClosed || completionInFlight) return;
        if (refocusVersion !== audioPlaybackVersion) return;
        if (scheduledItemKey && scheduledItemKey !== getItemStateKey(currentItem())) return;
        if (currentModeKind === "segmented_spelling") focusSegmentedController();
      }, 120);
    }
  }

  function updateHeader() {
    const attemptsAllowed = getAttemptsAllowedForItem();
    wNum.textContent = String(idx + 1);
    scoreEl.textContent = String(totalCorrect);
    attemptsLeftTop.textContent = hasUnlimitedAttempts
      ? "Unlimited"
      : String(Math.max(0, attemptsAllowed - currentAttempt + 1));
    const pct = words.length ? ((idx) / words.length) * 100 : 0;
    wordProgressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    wordProgressText.textContent = `Word ${idx + 1} of ${words.length}`;
  }

  function renderAttemptDots() {
    const attemptsAllowed = getAttemptsAllowedForItem();
    if (hasUnlimitedAttempts) {
      attemptDots.innerHTML = `<span class="muted">Unlimited attempts for this word.</span>`;
      return;
    }
    const dots = [];
    for (let i = 1; i <= attemptsAllowed; i += 1) {
      const cls = i < currentAttempt ? "used" : i === currentAttempt ? "active" : "";
      dots.push(`<span class="attemptDot ${cls}">${i}</span>`);
    }
    attemptDots.innerHTML = dots.join("");
  }

  function getTargetParts(item) {
    const parts = Array.isArray(item?.segments)
      ? item.segments.map((s) => String(s || "").trim()).filter(Boolean)
      : [];
    if (parts.length) return parts;
    const word = String(item?.word || "").trim();
    return word ? [word] : [];
  }

  function shuffleTokens(tokens) {
    const original = Array.isArray(tokens) ? tokens.slice() : [];
    if (original.length < 2) return original;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const shuffled = original.slice();
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      if (shuffled.some((token, index) => token.id !== original[index].id)) return shuffled;
    }

    return original.slice().reverse();
  }

  function getFocusIndex(item, targetParts) {
    const choice = getChoice(item);
    const requested = String(
      choice?.focus_grapheme ||
      (Array.isArray(choice?.focus_graphemes) ? choice.focus_graphemes[0] : "") ||
      ""
    ).trim().toLowerCase();
    const candidates = targetParts.map((part, index) => {
      const clean = String(part || "").trim().toLowerCase();
      const phoneme = getSegmentPhoneme(choice, index, clean);
      const coreAlternatives = getPhonemeAlternativeOptions(clean, phoneme, "core");
      const fallbackAlternatives = coreAlternatives.length
        ? coreAlternatives
        : getPhonemeAlternativeOptions(clean, phoneme, ["core", "all"]);
      return {
        index,
        grapheme: clean,
        hasCoreAlternatives: coreAlternatives.length > 0,
        hasAlternatives: fallbackAlternatives.length > 0,
        isSplit: clean.includes("-"),
        isComplex: clean.replace(/-/g, "").length > 1,
      };
    });

    if (requested) {
      const requestedCandidate = candidates.find((candidate) => candidate.grapheme === requested);
      if (requestedCandidate && (requestedCandidate.hasAlternatives || !candidates.some((candidate) => candidate.hasAlternatives))) {
        return requestedCandidate.index;
      }
    }

    const bestCandidate = candidates.find((candidate) => candidate.hasCoreAlternatives && candidate.isSplit)
      || candidates.find((candidate) => candidate.hasCoreAlternatives && candidate.isComplex)
      || candidates.find((candidate) => candidate.hasCoreAlternatives)
      || candidates.find((candidate) => candidate.hasAlternatives && candidate.isSplit)
      || candidates.find((candidate) => candidate.hasAlternatives && candidate.isComplex)
      || candidates.find((candidate) => candidate.hasAlternatives)
      || candidates.find((candidate) => candidate.isSplit)
      || candidates.find((candidate) => candidate.isComplex)
      || candidates[0];
    if (bestCandidate) return bestCandidate.index;

    return Math.max(0, Math.floor(targetParts.length / 2));
  }

  function getPreviewWidth(letterCount) {
    return letterCount * PHONICS_PREVIEW_CELL_W + Math.max(0, letterCount - 1) * PHONICS_PREVIEW_GAP;
  }

  function measurePreviewSegment(segment) {
    if (!segment) return { left: 0, width: PHONICS_PREVIEW_CELL_W };
    const span = Math.max(1, segment.end - segment.start + 1);
    return {
      left: segment.start * (PHONICS_PREVIEW_CELL_W + PHONICS_PREVIEW_GAP),
      width: span * PHONICS_PREVIEW_CELL_W + Math.max(0, span - 1) * PHONICS_PREVIEW_GAP,
    };
  }

  function getSegmentLetterIndices(segment) {
    if (!segment) return [];
    if (segment.markType === "split") return [segment.start, segment.end];
    return Array.from({ length: Math.max(1, segment.end - segment.start + 1) }, (_, index) => segment.start + index);
  }

  function mapTargetSegmentsToLetters(item) {
    const targetParts = getTargetParts(item);
    const displayWord = buildWordFromGraphemes(targetParts);
    const { letters, segments } = mapPreviewSegments(displayWord, targetParts);
    return { letters, mapped: segments, targetParts };
  }

  function getSegmentedLetterParts(item, safeWord) {
    const explicitSegments = Array.isArray(item?.segments)
      ? item.segments.map((segment) => String(segment || "").trim().toLowerCase()).filter(Boolean)
      : [];
    return explicitSegments.length ? explicitSegments : splitWordToGraphemes(safeWord);
  }

  function getSegmentedVisualAidsMode(item) {
    const choice = getChoice(item);
    return String(choice?.visual_aids_mode || choice?.visualAidsMode || "none").trim().toLowerCase() === "phonics"
      ? "phonics"
      : "none";
  }

  function getRenderableSegmentedWord(item) {
    const explicitWord = String(item?.word || "").trim().toLowerCase();
    if (isSupportedSegmentedWord(explicitWord)) return explicitWord;
    const rebuiltWord = buildWordFromGraphemes(getTargetParts(item));
    if (isSupportedSegmentedWord(rebuiltWord)) return rebuiltWord;
    return "";
  }

  function getSegmentedAvailableWidth() {
    const viewportWidth = Math.max(280, Number(window.innerWidth || 0) || 360);
    if (presentationMode) {
      return Math.max(420, Math.min(920, viewportWidth - 120));
    }
    return Math.max(240, Math.min(420, viewportWidth - 48));
  }

  function getSegmentedGapSize(cellSize) {
    if (cellSize >= 56) return 12;
    if (cellSize >= 48) return 10;
    if (cellSize >= 40) return 8;
    if (cellSize >= 36) return 6;
    return 4;
  }

  function getSegmentedRowWidth(count, cellSize, gapSize) {
    return count * cellSize + Math.max(0, count - 1) * gapSize;
  }

  function getSegmentedBreakIndex(mappedSegments, wordLength, maxPerRow) {
    const minFirstRow = Math.max(1, wordLength - maxPerRow);
    const maxFirstRow = Math.min(maxPerRow, wordLength - 1);
    let bestBreak = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let breakIndex = minFirstRow; breakIndex <= maxFirstRow; breakIndex += 1) {
      const crossesBreak = mappedSegments.some((segment) => segment.start < breakIndex && segment.end >= breakIndex);
      if (crossesBreak) continue;

      const balanceScore = Math.abs((wordLength / 2) - breakIndex);
      if (balanceScore < bestScore) {
        bestScore = balanceScore;
        bestBreak = breakIndex;
      }
    }

    return bestBreak;
  }

  function buildSegmentedLayout(previewModel) {
    const letterCount = Array.isArray(previewModel?.letters) ? previewModel.letters.length : 0;
    if (!letterCount) return null;

    const availableWidth = getSegmentedAvailableWidth();
    const sizeCandidates = presentationMode
      ? [72, 64, 56, 48, 44]
      : [56, 52, 48, 44, 40, 36, 32];

    for (const cellSize of sizeCandidates) {
      const gapSize = getSegmentedGapSize(cellSize);
      if (getSegmentedRowWidth(letterCount, cellSize, gapSize) <= availableWidth) {
        return {
          cellSize,
          gapSize,
          rows: [{ start: 0, end: letterCount - 1 }],
        };
      }
    }

    const cellSize = sizeCandidates[sizeCandidates.length - 1];
    const gapSize = getSegmentedGapSize(cellSize);
    const maxPerRow = Math.floor((availableWidth + gapSize) / (cellSize + gapSize));
    if (maxPerRow < 2 || letterCount > maxPerRow * 2) return null;

    const breakIndex = getSegmentedBreakIndex(
      Array.isArray(previewModel?.segments) ? previewModel.segments : [],
      letterCount,
      maxPerRow,
    );
    if (!breakIndex) return null;

    return {
      cellSize,
      gapSize,
      rows: [
        { start: 0, end: breakIndex - 1 },
        { start: breakIndex, end: letterCount - 1 },
      ],
    };
  }

  function renderSegmentedMarksRow(previewModel, rowStart, rowEnd) {
    const cols = rowEnd - rowStart + 1;
    const marks = (Array.isArray(previewModel?.marks) ? previewModel.marks : [])
      .filter((segment) => segment.start >= rowStart && segment.end <= rowEnd);

    const markHtml = marks.map((segment) => {
      const localStart = segment.start - rowStart;
      const localEnd = segment.end - rowStart;
      if (segment.type === "dot" || segment.markType === "dot") {
        return `<span class="segmentedMark segmentedMark--dot" style="grid-column:${localStart + 1};"></span>`;
      }
      if (segment.type === "silent_dot" || segment.markType === "silent_dot") {
        return `<span class="segmentedMark segmentedMark--silent" style="grid-column:${localStart + 1};"></span>`;
      }
      if (segment.type === "underline" || segment.markType === "underline") {
        return `<span class="segmentedMark segmentedMark--underline" style="grid-column:${localStart + 1} / ${localEnd + 2};"></span>`;
      }
      return `<span class="segmentedMark segmentedMark--bridge" style="grid-column:${localStart + 1} / ${localEnd + 2};"><span class="segmentedMarkBridgeInner"></span></span>`;
    }).join("");

    return `
      <div
        class="segmentedMarks"
        aria-hidden="true"
        style="grid-template-columns:repeat(${cols}, var(--segmented-cell-size)); column-gap:var(--segmented-gap);"
      >${markHtml}</div>
    `;
  }

  function renderSegmentedRevealMarkup(item, correctSpelling) {
    const safeWord = getRenderableSegmentedWord({
      ...item,
      word: correctSpelling,
    });
    if (!safeWord) return "";

    const visualParts = getSegmentedLetterParts(item, safeWord);
    const previewModel = mapPreviewSegments(safeWord, visualParts);
    const layout = buildSegmentedLayout(previewModel);
    const visualAidsMode = getSegmentedVisualAidsMode(item);

    if (!layout) {
      if (visualAidsMode === "phonics") {
        return `<div class="feedbackRevealPhonics">${renderPhonicsPreviewModel(previewModel)}</div>`;
      }
      return "";
    }

    const rowsHtml = layout.rows.map((row) => {
      const rowStart = row.start;
      const rowEnd = row.end;
      const cols = rowEnd - rowStart + 1;
      const rowBoxes = previewModel.letters
        .slice(rowStart, rowEnd + 1)
        .map((value) => `
          <span class="segmentedBox segmentedBox--filled segmentedBox--reveal" aria-hidden="true">
            <span>${escapeHtml(value || "")}</span>
          </span>
        `)
        .join("");

      return `
        <div class="segmentedRow" style="--segmented-cols:${cols}; --segmented-cell-size:${layout.cellSize}px; --segmented-gap:${layout.gapSize}px;">
          <div class="segmentedBoxes" style="grid-template-columns:repeat(${cols}, var(--segmented-cell-size)); column-gap:var(--segmented-gap);">${rowBoxes}</div>
          ${visualAidsMode === "phonics" ? renderSegmentedMarksRow(previewModel, rowStart, rowEnd) : ""}
        </div>
      `;
    }).join("");

    return `
      <div
        class="segmentedShell segmentedShell--reveal"
        role="img"
        aria-label="${escapeHtml(`Correct spelling: ${correctSpelling}`)}"
        style="--segmented-cell-size:${layout.cellSize}px; --segmented-gap:${layout.gapSize}px;"
      >
        <div class="segmentedRows">${rowsHtml}</div>
      </div>
    `;
  }

  function buildFinalWrongFeedbackMarkup(item, correctSpelling) {
    const safeSpelling = String(correctSpelling || "").trim();
    const revealLead = `<div class="feedbackRevealText">The correct spelling is <strong>${escapeHtml(safeSpelling)}</strong>.</div>`;
    const reminder = `<div class="feedbackRevealHint">Look carefully before moving on.</div>`;

    if ((currentModeKind || resolveModeKind(item)) === "segmented_spelling") {
      const segmentedMarkup = renderSegmentedRevealMarkup(item, safeSpelling);
      if (segmentedMarkup) {
        return `
          <span class="badgeBad">Not quite.</span>
          <div class="revealAnswer feedbackReveal feedbackReveal--segmented">
            ${revealLead}
            ${segmentedMarkup}
            ${reminder}
          </div>
        `;
      }
    }

    return `
      <span class="badgeBad">Not quite.</span>
      <div class="revealAnswer feedbackReveal">
        ${revealLead}
        ${reminder}
      </div>
    `;
  }

  function lockCurrentAnswerInput() {
    const answerInput = main.querySelector("#pupilAnswer");
    if (answerInput instanceof HTMLInputElement) {
      answerInput.readOnly = true;
      answerInput.setAttribute("aria-readonly", "true");
    }

    const segmentedController = main.querySelector("#segmentedController");
    if (segmentedController instanceof HTMLInputElement) {
      segmentedController.readOnly = true;
      segmentedController.setAttribute("aria-readonly", "true");
    }
  }

  function showFinalWrongRevealState(item, entry = getProgressEntry(item)) {
    locked = true;
    stopAudioPlayback();
    btnListen.disabled = true;
    btnCheck.disabled = true;
    btnCheck.style.display = "none";
    btnNext.textContent = idx >= words.length - 1 ? "Finish test" : "Next word";
    btnNext.style.display = "inline-block";
    lockCurrentAnswerInput();

    const correctSpelling = String(
      entry?.correctSpelling
      || item?.word
      || buildWordFromGraphemes(Array.isArray(item?.segments) ? item.segments : [])
      || ""
    ).trim();
    feedback.innerHTML = buildFinalWrongFeedbackMarkup(item, correctSpelling);
    window.requestAnimationFrame(() => {
      btnNext.focus({ preventScroll: true });
    });
  }

  function clearPendingFinalWrongReveal(item = currentItem()) {
    const itemKey = getItemStateKey(item);
    if (!itemKey) return false;

    const entry = progressEntries.get(itemKey);
    if (!hasPendingFinalWrongReveal(entry)) return false;

    progressEntries.set(itemKey, buildStoredProgressEntry(item, {
      completed: true,
      correct: false,
      typed: String(entry?.typed ?? "").trim(),
      attemptsUsed: entry?.attemptsUsed,
      attemptsAllowed: entry?.attemptsAllowed,
      questionType: entry?.questionType,
      modeKind: entry?.modeKind,
      inputState: null,
      feedbackState: null,
      index: entry?.index,
    }));
    rebuildSessionResultState();
    return true;
  }

  function buildFocusPreviewState(item, focusIndex) {
    const targetParts = getTargetParts(item);
    const selectedValue = String(currentScroll?.values?.[focusIndex] || "").trim();
    const previewParts = targetParts.slice();
    if (selectedValue) previewParts[focusIndex] = selectedValue;

    const displayWord = buildWordFromGraphemes(previewParts);
    const previewModel = mapPreviewSegments(displayWord, previewParts);
    const activeSegment = previewModel.segments.find((segment) => segment.partIndex === focusIndex) || null;

    if (activeSegment) {
      const visibleMarks = (Array.isArray(previewModel?.marks) ? previewModel.marks : [])
        .filter((segment) => segment.partIndex !== focusIndex)
        .map((segment) => ({ type: segment.type || segment.markType, start: segment.start, end: segment.end }));

      if (selectedValue) {
        return {
          activeSegment,
          previewHtml: renderPhonicsPreviewModel(previewModel),
          totalWidth: getPreviewWidth(previewModel.letters.length),
        };
      }

      const hiddenLetters = previewModel.letters.slice();
      getSegmentLetterIndices(activeSegment).forEach((index) => {
        hiddenLetters[index] = "";
      });
      return {
        activeSegment,
        previewHtml: renderPhonicsPreviewModel({ letters: hiddenLetters, marks: visibleMarks }),
        totalWidth: getPreviewWidth(hiddenLetters.length),
      };
    }

    return {
      activeSegment,
      previewHtml: renderPhonicsPreviewModel(previewModel),
      totalWidth: getPreviewWidth(previewModel.letters.length),
    };
  }

  function getInteractiveChoiceIndices() {
    const saved = Array.isArray(currentScroll?.interactiveIndices) ? currentScroll.interactiveIndices : [];
    if (saved.length) return saved;
    return Array.isArray(currentScroll?.values)
      ? currentScroll.values.map((_, index) => index)
      : [];
  }

  function hasMeaningfulCurrentAnswer(item = currentItem()) {
    if (!item) return false;

    if (currentModeKind === "spell_loom") return !!currentLoom?.isComplete;
    if (currentModeKind === "type_what_you_hear") return !!currentArrange?.isComplete;
    if (currentModeKind === "segmented_spelling") return !!currentSegmented?.isComplete;
    if ((currentModeKind === "focus_sound" || currentModeKind === "multiple_choice_grapheme_picker") && currentScroll) {
      const interactiveIndices = getInteractiveChoiceIndices();
      return interactiveIndices.length > 0
        && interactiveIndices.every((index) => !!String(currentScroll?.values?.[index] || "").trim());
    }

    return !!String(getCurrentTypedValue()).trim();
  }

  function refreshCheckAvailability(item = currentItem()) {
    if (!btnCheck || locked || btnCheck.style.display === "none") return;
    btnCheck.disabled = !hasMeaningfulCurrentAnswer(item);
  }

  function showAnswerRequiredFeedback(item = currentItem()) {
    if (currentModeKind === "spell_loom") {
      feedback.innerHTML = `<strong>Finish building the word on the rail first.</strong>`;
      return;
    }
    if (currentModeKind === "type_what_you_hear") {
      feedback.innerHTML = `<strong>Use all the graphemes to build the word first.</strong>`;
      return;
    }
    if (currentModeKind === "segmented_spelling") {
      feedback.innerHTML = `<strong>Fill every letter box first.</strong>`;
      focusSegmentedController();
      return;
    }
    if (currentModeKind === "multiple_choice_grapheme_picker" && shouldUseFocusOnlyMultipleChoice(item)) {
      feedback.innerHTML = `<strong>Choose a grapheme first.</strong>`;
      return;
    }
    if (currentModeKind === "multiple_choice_grapheme_picker") {
      feedback.innerHTML = `<strong>Choose a grapheme for each sound first.</strong>`;
      return;
    }
    if (currentModeKind === "focus_sound") {
      feedback.innerHTML = `<strong>Choose a grapheme first.</strong>`;
      return;
    }

    feedback.innerHTML = `<strong>Type an answer first.</strong>`;
    const input = main.querySelector("#pupilAnswer");
    input?.focus();
  }

  function createFocusSoundModel(item) {
    const targetParts = getTargetParts(item);
    const focusIndex = getFocusIndex(item, targetParts);
    const choice = getChoice(item);
    const correctPart = targetParts[focusIndex] || "";
    const phoneme = getSegmentPhoneme(choice, focusIndex, correctPart);
    const optionSet = getFocusSoundOptionSet(correctPart, phoneme);
    const values = targetParts.map((part, index) => index === focusIndex ? "" : part);

    return {
      values,
      targetSegments: targetParts,
      focusIndex,
      interactiveIndices: [focusIndex],
      active: focusIndex,
      optionSet,
      choose(option) {
        values[focusIndex] = String(option || "").trim();
      },
      bump(i, dir) {
        if (i !== focusIndex || !dir) return;
        const options = optionSet.length ? optionSet : [""];
        const current = String(values[focusIndex] || "").trim();
        const currentIndex = options.findIndex((item) => item.toLowerCase() === current.toLowerCase());
        const next = currentIndex === -1
          ? (dir > 0 ? 0 : options.length - 1)
          : (currentIndex + dir + options.length) % options.length;
        values[focusIndex] = options[next];
      },
      setActive(i) {
        if (typeof i === "number" && i === focusIndex) this.active = focusIndex;
      },
    };
  }

  function restoreScrollProgressState(item) {
    const progressEntry = getProgressEntry(item);
    const inputState = progressEntry?.inputState;
    if (!currentScroll || inputState?.kind !== "scroll") return;

    if (Array.isArray(inputState.values) && Array.isArray(currentScroll.values)) {
      for (let index = 0; index < currentScroll.values.length; index += 1) {
        currentScroll.values[index] = String(inputState.values[index] || "");
      }
    }
    if (typeof currentScroll.setActive === "function") {
      currentScroll.setActive(inputState.activeIndex);
    }
  }

  function restoreArrangementProgressState(item) {
    const progressEntry = getProgressEntry(item);
    const inputState = progressEntry?.inputState;
    if (!currentArrange || inputState?.kind !== "arrange") return;

    const slots = Array.isArray(inputState.slots) ? inputState.slots : [];
    slots.forEach((tokenId, slotIndex) => {
      if (!tokenId) return;
      currentArrange.placeAt(tokenId, slotIndex);
    });
    currentArrange.setActive(inputState.activeSlotIndex);
  }

  function restoreLoomProgressState(item) {
    const progressEntry = getProgressEntry(item);
    const inputState = progressEntry?.inputState;
    if (!currentLoom || inputState?.kind !== "loom") return;

    const placements = Array.isArray(inputState.placements) ? inputState.placements.slice() : [];
    placements
      .sort((a, b) => Number(a?.start || 0) - Number(b?.start || 0))
      .forEach((placement) => {
        const tokenId = String(placement?.tokenId || "").trim();
        if (!tokenId) return;
        currentLoom.setPlacement(tokenId, placement?.start || 0);
      });
  }

  function restoreFullRecallProgressState(item) {
    const input = main.querySelector("#pupilAnswer");
    if (!(input instanceof HTMLInputElement)) return;

    const progressEntry = getProgressEntry(item);
    const storedValue = progressEntry?.inputState?.kind === "full_recall"
      ? progressEntry.inputState.value
      : progressEntry?.completed === false
        ? progressEntry?.typed
        : "";
    if (storedValue) {
      input.value = String(storedValue);
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function restoreSegmentedProgressState(item) {
    const progressEntry = getProgressEntry(item);
    const inputState = progressEntry?.inputState;
    if (!currentSegmented || inputState?.kind !== "segmented") return;

    if (Array.isArray(inputState.letters)) {
      for (let index = 0; index < currentSegmented.letters.length; index += 1) {
        currentSegmented.letters[index] = String(inputState.letters[index] || "");
      }
    }
    currentSegmented.setActive(inputState.activeIndex);
  }

  function getFocusCurrentValue(item) {
    const targetParts = getTargetParts(item);
    const focusIndex = currentScroll?.focusIndex ?? getFocusIndex(item, targetParts);
    const raw = String(currentScroll?.values?.[focusIndex] || "").trim();
    return raw || "—";
  }

  function getScrollLabel(value) {
    const clean = String(value || "").trim();
    return clean || "—";
  }

  function renderMarks(letters, mapped) {
    const safeLetters = Array.isArray(letters) ? letters : [];
    if (!safeLetters.length) return "";

    const splitMarks = mapped.filter((segment) => segment.markType === "split");
    const underlineMarks = mapped.filter((segment) => segment.markType === "underline");

    const greyDots = new Set();
    const orangeDots = new Set();

    for (let i = 0; i < safeLetters.length; i += 1) greyDots.add(i);

    for (const mark of underlineMarks) {
      for (let i = mark.start; i <= mark.end; i += 1) {
        greyDots.delete(i);
      }
    }

    for (const mark of splitMarks) {
      orangeDots.add(mark.start);
      orangeDots.add(mark.end);
      greyDots.delete(mark.start);
      greyDots.delete(mark.end);
    }

    const CELL_W = 28;
    const GAP = 8;
    const DOT_R = 5;
    const DOT_Y = 12;
    const BRIDGE_DEPTH = 18;
    const PAD = 6;
    const STROKE = 4;
    const totalW = safeLetters.length * CELL_W + Math.max(0, safeLetters.length - 1) * GAP;
    const svgH = DOT_Y + BRIDGE_DEPTH + STROKE + 6;

    const centerX = (index) => index * (CELL_W + GAP) + CELL_W / 2;

    const greySvg = [...greyDots]
      .sort((a, b) => a - b)
      .map((i) => `<circle cx="${centerX(i)}" cy="${DOT_Y}" r="${DOT_R}" fill="#94a3b8" />`)
      .join("");

    const orangeSvg = [...orangeDots]
      .sort((a, b) => a - b)
      .map((i) => `<circle cx="${centerX(i)}" cy="${DOT_Y}" r="${DOT_R}" fill="#f59e0b" />`)
      .join("");

    const underlineSvg = underlineMarks
      .map((mark) => {
        const x1 = centerX(mark.start) - PAD;
        const x2 = centerX(mark.end) + PAD;
        return `<line x1="${x1}" y1="${DOT_Y}" x2="${x2}" y2="${DOT_Y}" stroke="#f59e0b" stroke-width="${STROKE}" stroke-linecap="round" />`;
      })
      .join("");

    const bridgeSvg = splitMarks
      .map((mark) => {
        const x1 = centerX(mark.start);
        const x2 = centerX(mark.end);
        const y = DOT_Y;
        const bottom = DOT_Y + BRIDGE_DEPTH;
        return `
          <path
            d="M ${x1} ${y} L ${x1} ${bottom} Q ${x1} ${bottom + 4} ${x1 + 8} ${bottom + 4} L ${x2 - 8} ${bottom + 4} Q ${x2} ${bottom + 4} ${x2} ${bottom} L ${x2} ${y}"
            stroke="#f59e0b"
            stroke-width="${STROKE}"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          />
        `;
      })
      .join("");

    return `
      <svg
        class="fs-markSvg"
        style="grid-column:1 / span ${safeLetters.length};"
        width="${totalW}"
        height="${svgH}"
        viewBox="0 0 ${totalW} ${svgH}"
        aria-hidden="true"
      >
        ${underlineSvg}
        ${bridgeSvg}
        ${greySvg}
        ${orangeSvg}
      </svg>
    `;
  }

  function renderFocusSound(item) {
    if (!shouldReuseScroll(item, "focus_sound")) {
      setScrollState(item, "focus_sound", createFocusSoundModel(item));
      restoreScrollProgressState(item);
    }

    const focusIndex = currentScroll.focusIndex;
    const focusValue = String(currentScroll?.values?.[focusIndex] || "").trim();
    const focusChoiceLabel = focusValue || "Choose one";
    const { activeSegment, previewHtml, totalWidth } = buildFocusPreviewState(item, focusIndex);
    const activeMetrics = measurePreviewSegment(activeSegment);
    const showFocusHelperText = !presentationMode;
    main.innerHTML = `
      <div class="focusSoundShell">
        ${showFocusHelperText ? `<div class="guidedPrompt focusSoundPrompt">Scroll the focus grapheme into the word.</div>` : ""}
        <div class="focusSoundTask">
          <div class="focusPreviewShell">
            <div class="focusPreviewFrame" style="--focus-preview-width:${totalWidth}px;">

              <button
                class="fs-arrow fs-arrow--overlay fs-arrow--top"
                type="button"
                data-action="scroll-bump"
                data-index="${focusIndex}"
                data-dir="-1"
                style="left:${activeMetrics.left}px; width:${activeMetrics.width}px;"
              >&#9650;</button>
              <div class="focusPreview">${previewHtml}</div>
              <button
                class="fs-arrow fs-arrow--overlay fs-arrow--bottom"
                type="button"
                data-action="scroll-bump"
                data-index="${focusIndex}"
                data-dir="1"
                style="left:${activeMetrics.left}px; width:${activeMetrics.width}px;"
              >&#9660;</button>
            </div>
          </div>
        </div>
        ${isHintsEnabled() && showFocusHelperText ? `<div class="muted focusSoundMeta">Selected grapheme: <strong>${escapeHtml(focusChoiceLabel)}</strong></div>` : ""}
      </div>
    `;
    refreshCheckAvailability(item);
  }

  function getSegmentPhoneme(choice, partIndex, correctPart) {
    if (Array.isArray(choice?.segment_phonemes) && choice.segment_phonemes[partIndex]) {
      return choice.segment_phonemes[partIndex];
    }
    if (choice?.segment_phonemes && typeof choice.segment_phonemes === "object") {
      if (choice.segment_phonemes[partIndex]) return choice.segment_phonemes[partIndex];
      if (choice.segment_phonemes[correctPart]) return choice.segment_phonemes[correctPart];
    }
    if (Array.isArray(choice?.focus_phonemes) && choice.focus_phonemes[partIndex]) {
      return choice.focus_phonemes[partIndex];
    }
    return inferPhonemeFromGrapheme(correctPart, "all");
  }

  function normaliseOptions(correctPart, options) {
    const safe = Array.isArray(options) ? options.filter((value) => value !== undefined && value !== null) : [];
    const deduped = [];
    const push = (value) => {
      const clean = String(value || "").trim();
      if (!deduped.some((item) => item.toLowerCase() === clean.toLowerCase())) deduped.push(clean);
    };

    push("");
    safe.forEach(push);
    if (correctPart && !deduped.some((item) => item.toLowerCase() === String(correctPart).toLowerCase())) {
      push(correctPart);
    }
    return deduped;
  }

  function normaliseVisibleChoiceOptions(correctPart, options) {
    const safe = Array.isArray(options) ? options.filter((value) => value !== undefined && value !== null) : [];
    const deduped = [];
    const push = (value) => {
      const clean = String(value || "").trim();
      if (!clean) return;
      if (!deduped.some((item) => item.toLowerCase() === clean.toLowerCase())) deduped.push(clean);
    };

    safe.forEach(push);
    if (correctPart && !deduped.some((item) => item.toLowerCase() === String(correctPart).trim().toLowerCase())) {
      push(correctPart);
    }
    return deduped;
  }

  function hasRealDistractorOptions(options, correctPart) {
    const target = String(correctPart || "").trim().toLowerCase();
    return (Array.isArray(options) ? options : []).some((option) => {
      const clean = String(option || "").trim().toLowerCase();
      return !!clean && clean !== target;
    });
  }

  function buildDiagnosticChoiceOptions(correctPart, phoneme) {
    return normaliseVisibleChoiceOptions(correctPart, [
      ...getPhonemeAlternativeOptions(correctPart, phoneme, "core"),
      ...getPhonemeAlternativeOptions(correctPart, phoneme, ["core", "all"]),
      ...getPhonemeDecoyOptions(correctPart, phoneme, "core"),
      ...getPhonemeDecoyOptions(correctPart, phoneme, "all"),
    ]);
  }

  function getFocusSoundOptionSet(correctPart, phoneme) {
    const diagnosticOptions = buildDiagnosticChoiceOptions(correctPart, phoneme);
    if (hasRealDistractorOptions(diagnosticOptions, correctPart)) {
      return normaliseOptions(correctPart, diagnosticOptions);
    }

    const coreAlternatives = getPhonemeAlternativeOptions(correctPart, phoneme, "core");
    if (coreAlternatives.length) return normaliseOptions(correctPart, coreAlternatives);
    const fallbackAlternatives = getPhonemeAlternativeOptions(correctPart, phoneme, ["core", "all"]);
    return normaliseOptions(correctPart, fallbackAlternatives);
  }

  function createMultipleChoiceModel(item) {
    const base = createScrollMode({ item, allowedGraphemes: testMeta?.allowedGraphemes });
    const choice = getChoice(item);
    const targetParts = getTargetParts(item);
    const { mapped } = mapTargetSegmentsToLetters(item);

    if (shouldUseFocusOnlyMultipleChoice(item)) {
      const focusIndex = getFocusIndex(item, targetParts);
      const correctPart = targetParts[focusIndex] || "";
      const phoneme = getSegmentPhoneme(choice, focusIndex, correctPart);
      const focusOptions = buildDiagnosticChoiceOptions(correctPart, phoneme);

      if (!hasRealDistractorOptions(focusOptions, correctPart)) {
        return {
          ...createFocusSoundModel(item),
          targetSegments: targetParts,
          mappedSegments: mapped,
          interactiveIndices: [focusIndex],
          active: focusIndex,
          focusOnlyDiagnostic: true,
          fallbackToFocusSound: true,
        };
      }

      const values = targetParts.map((part, partIndex) => (partIndex === focusIndex ? "" : part));
      const optionSets = targetParts.map((part, partIndex) => (
        partIndex === focusIndex ? focusOptions.slice() : [part]
      ));

      return {
        ...base,
        values,
        targetSegments: targetParts,
        mappedSegments: mapped,
        interactiveIndices: [focusIndex],
        active: focusIndex,
        focusIndex,
        optionSets,
        focusOnlyDiagnostic: true,
        fallbackToFocusSound: false,
        choose(option) {
          values[focusIndex] = option;
        },
        bump(i, dir) {
          if (i !== focusIndex || !dir) return;
          const options = optionSets[focusIndex] || [];
          const cur = String(values[focusIndex] || "").trim();
          const currentIndex = options.findIndex((item) => item.toLowerCase() === cur.toLowerCase());
          const next = currentIndex === -1
            ? (dir > 0 ? 0 : options.length - 1)
            : (currentIndex + dir + options.length) % options.length;
          values[focusIndex] = options[next] || "";
        },
        setActive(i) {
          if (typeof i === "number" && i === focusIndex) this.active = focusIndex;
        },
      };
    }

    const optionSets = targetParts.map((part, partIndex) => {
      const phoneme = getSegmentPhoneme(choice, partIndex, part);
      return normaliseOptions(part, getPhonemeOptions(phoneme, "core"));
    });

    const values = targetParts.map(() => "");

    return {
      ...base,
      values,
      targetSegments: targetParts,
      mappedSegments: mapped,
      interactiveIndices: targetParts.map((_, index) => index),
      active: 0,
      optionSets,
      choose(option) {
        const idx = this.active || 0;
        values[idx] = option;
      },
      bump(i, dir) {
        const options = optionSets[i] || [""];
        const cur = String(values[i] || "").trim();
        const currentIndex = options.findIndex((item) => item.toLowerCase() === cur.toLowerCase());
        const next = currentIndex === -1
          ? (dir > 0 ? 0 : options.length - 1)
          : (currentIndex + dir + options.length) % options.length;
        values[i] = options[next];
      },
      setActive(i) {
        if (typeof i === "number" && i >= 0 && i < targetParts.length) this.active = i;
      },
    };
  }

  function createArrangementModel(item) {
    const targetParts = getTargetParts(item);
    const tokens = targetParts.map((part, index) => ({
      id: `${index}:${part}`,
      value: part,
      display: part,
      isSplit: String(part || "").includes("-"),
    }));

    return {
      targetSegments: targetParts,
      available: shuffleTokens(tokens),
      slots: targetParts.map(() => null),
      activeSlotIndex: 0,
      get placed() {
        return this.slots.filter(Boolean);
      },
      get answer() {
        return buildWordFromGraphemes(this.slots.map((token) => token?.value || ""));
      },
      get isComplete() {
        return this.slots.every(Boolean);
      },
      setActive(index) {
        const boundedIndex = Math.max(0, Math.min(Number(index), this.slots.length - 1));
        if (Number.isNaN(boundedIndex)) return false;
        this.activeSlotIndex = boundedIndex;
        return true;
      },
      place(id) {
        const preferredIndex = typeof this.activeSlotIndex === "number"
          ? this.activeSlotIndex
          : this.slots.findIndex((token) => !token);
        if (preferredIndex === -1) return false;
        return this.placeAt(id, preferredIndex);
      },
      placeAt(id, targetIndex) {
        const index = this.available.findIndex((token) => token.id === id);
        if (index === -1) return false;
        const boundedIndex = Math.max(0, Math.min(Number(targetIndex), this.slots.length - 1));
        if (Number.isNaN(boundedIndex)) return false;
        const [token] = this.available.splice(index, 1);
        const displaced = this.slots[boundedIndex];
        if (displaced) this.available.push(displaced);
        this.slots[boundedIndex] = token;
        this.activeSlotIndex = this.slots.findIndex((slotToken) => !slotToken);
        if (this.activeSlotIndex === -1) this.activeSlotIndex = boundedIndex;
        return true;
      },
      movePlaced(id, targetIndex) {
        const fromIndex = this.slots.findIndex((token) => token?.id === id);
        const boundedIndex = Math.max(0, Math.min(Number(targetIndex), this.slots.length - 1));
        if (fromIndex === -1 || Number.isNaN(boundedIndex) || boundedIndex === fromIndex) return false;
        const moving = this.slots[fromIndex];
        const target = this.slots[boundedIndex];
        this.slots[boundedIndex] = moving;
        this.slots[fromIndex] = target || null;
        this.activeSlotIndex = boundedIndex;
        return true;
      },
      remove(id) {
        const index = this.slots.findIndex((token) => token?.id === id);
        return this.removeAt(index);
      },
      removeAt(index) {
        if (index === -1) return false;
        const token = this.slots[index];
        if (!token) {
          this.activeSlotIndex = index;
          return false;
        }
        this.slots[index] = null;
        this.available.push(token);
        this.activeSlotIndex = index;
        return true;
      },
      tapSlot(index) {
        const boundedIndex = Math.max(0, Math.min(Number(index), this.slots.length - 1));
        if (Number.isNaN(boundedIndex)) return false;

        if (this.activeSlotIndex === boundedIndex) {
          if (this.slots[boundedIndex]) {
            return this.removeAt(boundedIndex);
          }
          return false;
        }

        const activeIndex = typeof this.activeSlotIndex === "number" ? this.activeSlotIndex : -1;
        if (activeIndex >= 0 && activeIndex !== boundedIndex && this.slots[activeIndex]) {
          const moving = this.slots[activeIndex];
          const target = this.slots[boundedIndex];
          this.slots[boundedIndex] = moving;
          this.slots[activeIndex] = target || null;
        }

        this.activeSlotIndex = boundedIndex;
        return true;
      },
      clear() {
        this.available = shuffleTokens([...this.available, ...this.slots.filter(Boolean)]);
        this.slots = this.targetSegments.map(() => null);
        this.activeSlotIndex = 0;
        return true;
      },
    };
  }

  function clearArrangeDropZone() {
    if (!currentArrangeDropZone) return;
    currentArrangeDropZone.classList.remove("supportArrangeSlot--drop-target", "supportArrangeBank--drop-target");
    currentArrangeDropZone = null;
  }

  function setArrangeDropZone(zone) {
    if (currentArrangeDropZone === zone) return;
    clearArrangeDropZone();
    if (!zone) return;
    const dropType = String(zone.dataset.dropZone || "");
    zone.classList.add(dropType === "bank" ? "supportArrangeBank--drop-target" : "supportArrangeSlot--drop-target");
    currentArrangeDropZone = zone;
  }

  function clearArrangeDragState() {
    currentArrangeDrag = null;
    clearArrangeDropZone();
    main.querySelector(".supportArrangeTile--dragging")?.classList.remove("supportArrangeTile--dragging");
  }

  function resolveArrangeDropIndex(zone, clientX) {
    const baseIndex = Number(zone?.dataset?.dropIndex || 0);
    if (Number.isNaN(baseIndex)) return 0;
    return Math.max(0, Math.min(baseIndex, Math.max((currentArrange?.slots?.length || 1) - 1, 0)));
  }

  function applyArrangeDrop({ tokenId, source }, zone, clientX) {
    if (!currentArrange || !tokenId || !zone) return false;
    const dropZone = String(zone.dataset.dropZone || "");
    if (dropZone === "answer") {
      const dropIndex = resolveArrangeDropIndex(zone, clientX);
      if (source === "placed") {
        return currentArrange.movePlaced(tokenId, dropIndex);
      } else {
        return currentArrange.placeAt(tokenId, dropIndex);
      }
    }
    if (dropZone === "bank" && source === "placed") {
      return currentArrange.remove(tokenId);
    }
    return false;
  }

  function getArrangeDropZone(target) {
    return target?.closest?.("[data-drop-zone]") || null;
  }

  function getArrangeDragData(event) {
    if (currentArrangeDrag?.tokenId) return currentArrangeDrag;
    const raw = event.dataTransfer?.getData("application/x-phoneme-arrange") || "";
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.tokenId ? parsed : null;
    } catch {
      return null;
    }
  }

  function normalizeLoomDecoyLevel(value) {
    const clean = String(value || "").trim().toLowerCase();
    return ["light", "medium"].includes(clean) ? clean : "none";
  }

  function getLoomDecoyLevel(item) {
    const choice = getChoice(item);
    return normalizeLoomDecoyLevel(
      choice?.loom_decoy_level ||
      choice?.loomDecoyLevel ||
      testMeta?.loom_decoy_level ||
      testMeta?.loomDecoyLevel
    );
  }

  function getLoomSegmentPhoneme(item, partIndex, targetPart) {
    return getSegmentPhoneme(getChoice(item), partIndex, targetPart);
  }

  function getLoomFallbackCandidates(targetPart, targetSegments, used) {
    const cleanTarget = String(targetPart || "").trim().toLowerCase();
    if (!cleanTarget) return [];

    const targetIsSplit = cleanTarget.includes("-");
    const targetLength = cleanTarget.replace(/-/g, "").length;

    return KNOWN_LOOM_GRAPHEMES.filter((candidate) => {
      if (!candidate || used.has(candidate) || targetSegments.includes(candidate)) return false;

      const candidateIsSplit = candidate.includes("-");
      const candidateLength = candidate.replace(/-/g, "").length;

      if (candidateIsSplit !== targetIsSplit) return false;
      if (targetIsSplit) return candidateLength === targetLength;
      if (targetLength <= 1) return candidateLength === 1;
      return Math.abs(candidateLength - targetLength) <= 1;
    });
  }

  function collectSpellLoomDecoys(item, targetSegments) {
    const decoyLevel = getLoomDecoyLevel(item);
    const desiredCount = LOOM_DECOY_COUNTS[decoyLevel] || 0;
    if (!desiredCount) return [];

    const cleanTargets = targetSegments
      .map((segment) => String(segment || "").trim().toLowerCase())
      .filter(Boolean);
    const used = new Set(cleanTargets);
    const decoys = [];
    const bankMode = decoyLevel === "medium" ? "all" : "core";
    const segmentDetails = cleanTargets.map((targetPart, partIndex) => ({
      targetPart,
      phoneme: getLoomSegmentPhoneme(item, partIndex, targetPart),
    }));
    const phonemeAwareSegments = segmentDetails.filter(({ phoneme }) => !!phoneme);
    const fallbackOnlySegments = segmentDetails.filter(({ phoneme }) => !phoneme);

    for (let pass = 0; pass < 3 && decoys.length < desiredCount; pass += 1) {
      for (const { targetPart, phoneme } of phonemeAwareSegments) {
        if (decoys.length >= desiredCount) break;

        const primaryCandidates = getPhonemeDecoyOptions(targetPart, phoneme, bankMode);
        const candidates = [...primaryCandidates, ...getLoomFallbackCandidates(targetPart, cleanTargets, used)];
        const next = candidates.find((candidate) => !used.has(candidate) && candidate !== targetPart);

        if (!next) continue;
        used.add(next);
        decoys.push({
          ...createLoomToken(next, `decoy-${decoys.length}`),
          isDecoy: true,
        });
      }
    }

    for (let pass = 0; pass < 3 && decoys.length < desiredCount; pass += 1) {
      for (const { targetPart } of fallbackOnlySegments) {
        if (decoys.length >= desiredCount) break;

        const candidates = getLoomFallbackCandidates(targetPart, cleanTargets, used);
        const next = candidates.find((candidate) => !used.has(candidate) && candidate !== targetPart);

        if (!next) continue;
        used.add(next);
        decoys.push({
          ...createLoomToken(next, `decoy-${decoys.length}`),
          isDecoy: true,
        });
      }
    }

    return decoys;
  }

  function createLoomToken(part, index) {
    const value = String(part || "").trim().toLowerCase();
    if (value.includes("-")) {
      const [left = "", right = ""] = value.split("-");
      return {
        id: `${index}:${value}`,
        value,
        kind: "split",
        letters: [left, right || "e"],
        span: 3,
        isDecoy: false,
      };
    }

    return {
      id: `${index}:${value}`,
      value,
      kind: "contiguous",
      letters: value.split(""),
      span: value.length,
      isDecoy: false,
    };
  }

  function getLoomOccupiedCells(token, startIndex) {
    if (!token) return [];
    if (token.kind === "split") return [startIndex, startIndex + token.span - 1];
    return token.letters.map((_, offset) => startIndex + offset);
  }

  function loomEntriesOverlap(entry, token, startIndex) {
    const occupied = new Set(getLoomOccupiedCells(entry.token, entry.start));
    return getLoomOccupiedCells(token, startIndex).some((cell) => occupied.has(cell));
  }

  function buildLoomRail(model) {
    const cells = Array.from({ length: model.cellCount }, (_, index) => ({
      index,
      letter: "",
      tokenId: "",
      part: "empty",
      kind: "",
    }));
    const bridges = [];
    const underlines = [];
    const underlinedCells = new Set();
    const splitEndpoints = new Set();

    for (const entry of model.placements) {
      const { token, start } = entry;
      if (token.kind === "split") {
        const end = start + token.span - 1;
        cells[start] = {
          index: start,
          letter: token.letters[0],
          tokenId: token.id,
          part: "split-start",
          kind: "split",
        };
        cells[end] = {
          index: end,
          letter: token.letters[1],
          tokenId: token.id,
          part: "split-end",
          kind: "split",
        };
        bridges.push({ tokenId: token.id, start, span: token.span });
        splitEndpoints.add(start);
        splitEndpoints.add(end);
        continue;
      }

      for (let offset = 0; offset < token.letters.length; offset += 1) {
        const letterIndex = start + offset;
        const isFirst = offset === 0;
        const isLast = offset === token.letters.length - 1;
        cells[letterIndex] = {
          index: letterIndex,
          letter: token.letters[offset],
          tokenId: token.id,
          part: isFirst && isLast ? "single" : isFirst ? "start" : isLast ? "end" : "middle",
          kind: "contiguous",
        };
      }

      if (token.letters.length > 1) {
        underlines.push({ tokenId: token.id, start, span: token.letters.length });
        for (let offset = 0; offset < token.letters.length; offset += 1) {
          underlinedCells.add(start + offset);
        }
      }
    }

    const dots = cells
      .filter((cell) => cell.tokenId && !underlinedCells.has(cell.index) && !splitEndpoints.has(cell.index))
      .map((cell) => ({ index: cell.index, tone: "grey" }));

    return { cells, bridges, underlines, dots };
  }

  function createSpellLoomModel(item) {
    const word = String(item?.word || "").trim().toLowerCase();
    const targetParts = getTargetParts(item);
    const tokens = targetParts.map((part, index) => createLoomToken(part, index));
    const decoys = collectSpellLoomDecoys(item, targetParts);
    const trayTokens = [...tokens, ...decoys];

    return {
      word,
      targetSegments: targetParts,
      cellCount: word.length,
      available: shuffleTokens(trayTokens),
      placements: [],
      getTokenById(id) {
        return this.available.find((token) => token.id === id)
          || this.placements.find((entry) => entry.token.id === id)?.token
          || null;
      },
      getConflicts(token, startIndex, ignoreTokenId = "") {
        return this.placements.filter((entry) => entry.token.id !== ignoreTokenId && loomEntriesOverlap(entry, token, startIndex));
      },
      canFitWithoutDisplacing(tokenId, startIndex) {
        const token = this.getTokenById(tokenId);
        if (!token) return false;
        if (startIndex < 0 || startIndex + token.span > this.cellCount) return false;
        return this.getConflicts(token, startIndex, token.id).length === 0;
      },
      setPlacement(tokenId, startIndex) {
        const token = this.getTokenById(tokenId);
        if (!token) return false;
        const boundedStart = Math.max(0, Math.min(Number(startIndex), this.cellCount - token.span));
        if (Number.isNaN(boundedStart) || boundedStart < 0 || boundedStart + token.span > this.cellCount) return false;

        const availableIndex = this.available.findIndex((itemToken) => itemToken.id === tokenId);
        if (availableIndex >= 0) {
          this.available.splice(availableIndex, 1);
        } else {
          const placementIndex = this.placements.findIndex((entry) => entry.token.id === tokenId);
          if (placementIndex >= 0) this.placements.splice(placementIndex, 1);
        }

        const conflicts = this.getConflicts(token, boundedStart, token.id);
        for (const conflict of conflicts) {
          const placementIndex = this.placements.findIndex((entry) => entry.token.id === conflict.token.id);
          if (placementIndex >= 0) this.placements.splice(placementIndex, 1);
          this.available.push(conflict.token);
        }

        this.placements.push({ token, start: boundedStart });
        return true;
      },
      remove(tokenId) {
        const placementIndex = this.placements.findIndex((entry) => entry.token.id === tokenId);
        if (placementIndex === -1) return false;
        const [placement] = this.placements.splice(placementIndex, 1);
        this.available.push(placement.token);
        return true;
      },
      clear() {
        this.available = shuffleTokens([...this.available, ...this.placements.map((entry) => entry.token)]);
        this.placements = [];
        return true;
      },
      buildLetters() {
        const built = Array.from({ length: this.cellCount }, () => "");
        for (const entry of this.placements) {
          if (entry.token.kind === "split") {
            built[entry.start] = entry.token.letters[0];
            built[entry.start + entry.token.span - 1] = entry.token.letters[1];
            continue;
          }
          entry.token.letters.forEach((letter, offset) => {
            built[entry.start + offset] = letter;
          });
        }
        return built;
      },
      get answer() {
        return this.buildLetters().join("");
      },
      get isComplete() {
        return this.buildLetters().every(Boolean);
      },
    };
  }

  function clearLoomDropTarget() {
    if (!currentLoomDropTarget) return;
    if (Array.isArray(currentLoomDropTarget.cells)) {
      currentLoomDropTarget.cells.forEach((cell) => {
        cell.classList.remove("spellLoomCell--drop-target", "spellLoomCell--drop-gap");
      });
    }
    if (currentLoomDropTarget.tray) {
      currentLoomDropTarget.tray.classList.remove("spellLoomTray--drop-target");
    }
    currentLoomDropTarget = null;
  }

  function setLoomDropTarget(target) {
    clearLoomDropTarget();
    if (!target) return;

    if (target.tray) {
      target.tray.classList.add("spellLoomTray--drop-target");
      currentLoomDropTarget = { tray: target.tray };
      return;
    }

    const cells = [];
    for (let index = target.start; index < target.start + target.span; index += 1) {
      const cell = main.querySelector(`.spellLoomCell[data-loom-cell-index="${index}"]`);
      if (!cell) continue;
      cell.classList.add("spellLoomCell--drop-target");
      if (target.kind === "split" && index === target.start + 1) {
        cell.classList.add("spellLoomCell--drop-gap");
      }
      cells.push(cell);
    }
    currentLoomDropTarget = { cells };
  }

  function clearLoomDragState() {
    currentLoomDrag = null;
    clearLoomDropTarget();
    main.querySelector(".spellLoomToken--dragging")?.classList.remove("spellLoomToken--dragging");
  }

  function getLoomDragData(event) {
    if (currentLoomDrag?.tokenId) return currentLoomDrag;
    const raw = event.dataTransfer?.getData("application/x-phoneme-loom") || "";
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.tokenId ? parsed : null;
    } catch {
      return null;
    }
  }

  function resolveLoomStartIndex(model, token, cellIndex) {
    const offset = Math.floor((Math.max(token?.span || 1, 1) - 1) / 2);
    const rawStart = Number(cellIndex) - offset;
    return Math.max(0, Math.min(rawStart, Math.max(model.cellCount - (token?.span || 1), 0)));
  }

  function findFirstOpenLoomStart(model, tokenId) {
    const token = model.getTokenById(tokenId);
    if (!token) return -1;
    const maxStart = Math.max(model.cellCount - token.span, 0);
    for (let start = 0; start <= maxStart; start += 1) {
      if (model.canFitWithoutDisplacing(tokenId, start)) return start;
    }
    return -1;
  }

  function renderSpellLoom(item) {
    clearArrangeDragState();
    clearLoomDragState();
    currentScroll = null;
    currentArrange = null;
    currentSegmented = null;

    if (!shouldReuseLoom(item)) {
      setLoomState(item, createSpellLoomModel(item));
      restoreLoomProgressState(item);
    }

    const rail = buildLoomRail(currentLoom);
    const trayFontSize = currentLoom.available.some((token) => String(token?.value || "").trim().length >= 4)
      || currentLoom.targetSegments.some((segment) => String(segment || "").trim().length >= 4)
      ? 18
      : 22;

    const bridgeHtml = rail.bridges.map((bridge) => `
      <div class="spellLoomBridge" style="grid-column:${bridge.start + 1} / span ${bridge.span}; --loom-span:${bridge.span};">
        <span class="spellLoomBridgeDot spellLoomBridgeDot--start"></span>
        <span class="spellLoomBridgeArc"></span>
        <span class="spellLoomBridgeDot spellLoomBridgeDot--end"></span>
      </div>
    `).join("");
    const markHtml = [
      ...rail.underlines.map((underline) => `
        <div class="spellLoomUnderline" style="grid-column:${underline.start + 1} / span ${underline.span};"></div>
      `),
      ...rail.dots.map((dot) => `
        <div class="spellLoomDot spellLoomDot--${dot.tone}" style="grid-column:${dot.index + 1};"></div>
      `),
    ].join("");

    const cellsHtml = rail.cells.map((cell) => {
      if (!cell.tokenId) {
        return `<div class="spellLoomCell" data-drop-zone="loom-cell" data-loom-cell-index="${cell.index}"></div>`;
      }

      const classes = [
        "spellLoomCell",
        "spellLoomCell--filled",
        cell.kind === "split" ? "spellLoomCell--split" : "spellLoomCell--band",
        cell.part === "single" ? "spellLoomCell--single" : "",
        cell.part === "start" ? "spellLoomCell--start" : "",
        cell.part === "middle" ? "spellLoomCell--middle" : "",
        cell.part === "end" ? "spellLoomCell--end" : "",
        cell.part === "split-start" ? "spellLoomCell--split-start" : "",
        cell.part === "split-end" ? "spellLoomCell--split-end" : "",
      ].filter(Boolean).join(" ");

      return `
        <button
          class="${classes}"
          type="button"
          draggable="true"
          data-action="loom-remove"
          data-loom-source="placed"
          data-token-id="${escapeHtml(cell.tokenId)}"
          data-drop-zone="loom-cell"
          data-loom-cell-index="${cell.index}"
        >${escapeHtml(cell.letter)}</button>
      `;
    }).join("");

    const trayHtml = currentLoom.available.map((token) => `
      <button
        class="spellLoomToken spellLoomToken--${token.kind}"
        type="button"
        draggable="true"
        data-action="loom-place"
        data-loom-source="available"
        data-token-id="${escapeHtml(token.id)}"
        style="--loom-token-font:${trayFontSize}px;"
      >${escapeHtml(token.value)}</button>
    `).join("");

    main.innerHTML = `
      <div class="spellLoom">
        <div class="spellLoomHint">Build the word on the loom rail.</div>
        <div class="spellLoomMeta">Drag bands onto the rail. Dropping onto a filled space will replace that band.</div>
        <div class="spellLoomSectionLabel">Word rail</div>
        <div class="spellLoomRailShell">
          <div class="spellLoomRail" style="--loom-cells:${Math.max(currentLoom.cellCount, 1)};">
            <div class="spellLoomBridgeLayer">${bridgeHtml}</div>
            <div class="spellLoomMarkLayer">${markHtml}</div>
            <div class="spellLoomCellLayer">${cellsHtml}</div>
          </div>
        </div>
        <div class="supportArrangeTools">
          <button class="btn secondary" type="button" data-action="loom-clear">Start again</button>
        </div>
        <div class="spellLoomSectionLabel">Grapheme bands</div>
        <div class="spellLoomTray">${trayHtml || `<div class="muted">All bands placed on the rail.</div>`}</div>
      </div>
    `;

    refreshCheckAvailability(item);
  }

  function renderGuidedEncoding(item) {
    if (!shouldReuseScroll(item, "build_whole_word")) {
      setScrollState(item, "build_whole_word", createScrollMode({ item, allowedGraphemes: testMeta?.allowedGraphemes }));
    }
    const slotHtml = currentScroll.values.map((val, i) => `
      <div class="guidedSlotWrap">
        <button class="guidedArrow" type="button" data-action="scroll-bump" data-index="${i}" data-dir="-1">▲</button>
        <button class="guidedSlot" type="button" data-action="scroll-focus" data-index="${i}">
          <span>${escapeHtml(val || "—")}</span>
        </button>
        <button class="guidedArrow" type="button" data-action="scroll-bump" data-index="${i}" data-dir="1">▼</button>
      </div>
      ${i < currentScroll.values.length - 1 ? `<div class="guidedSep">/</div>` : ""}
    `).join("");

    main.innerHTML = `
      <div class="guidedPrompt">Fill each sound slot.</div>
      <div class="guidedSlots">${slotHtml}</div>
    `;
  }

  function renderMultipleChoice(item) {
    if (!shouldReuseScroll(item, "multiple_choice_grapheme_picker")) {
      setScrollState(item, "multiple_choice_grapheme_picker", createMultipleChoiceModel(item));
      restoreScrollProgressState(item);
    }

    if (currentScroll?.fallbackToFocusSound) {
      renderFocusSound(item);
      return;
    }

    if (currentScroll?.focusOnlyDiagnostic) {
      const focusIndex = currentScroll.focusIndex;
      const focusValue = String(currentScroll?.values?.[focusIndex] || "").trim();
      const focusChoiceLabel = focusValue || "Choose one";
      const { previewHtml, totalWidth } = buildFocusPreviewState(item, focusIndex);
      const options = (currentScroll.optionSets?.[focusIndex] || [])
        .map((option) => String(option || "").trim())
        .filter(Boolean);
      const optionClusterWidth = Math.max(totalWidth, options.length * 120 + Math.max(0, options.length - 1) * 12);
      const optionsHtml = options.map((option) => {
        const selected = String(currentScroll.values?.[focusIndex] || "").trim().toLowerCase() === option.toLowerCase();
        return `
          <button
            class="btn secondary choiceOptionChip"
            type="button"
            data-action="choice-option"
            data-option="${escapeHtml(option)}"
            style="${selected ? "font-weight:800;" : ""}"
          >${escapeHtml(option)}</button>
        `;
      }).join("");

      main.innerHTML = `
        <div class="diagnosticChoiceShell">
          <div class="guidedPrompt">Choose the grapheme for the focus sound, then check the whole word.</div>
          <div class="focusPreviewShell">
            <div class="focusPreviewFrame" style="--focus-preview-width:${totalWidth}px;">
              <div class="focusPreview">${previewHtml}</div>
            </div>
          </div>
          <div class="muted" style="margin-top:10px;">Selected grapheme: <strong>${escapeHtml(focusChoiceLabel)}</strong></div>
          <div class="choiceOptionCluster" style="--choice-cluster-width:${optionClusterWidth}px;">${optionsHtml}</div>
        </div>
      `;

      refreshCheckAvailability(item);
      return;
    }

    const { letters, mapped, targetParts } = mapTargetSegmentsToLetters(item);
    const cols = Math.max(letters.length, 1);
    const activeIndex = typeof currentScroll.active === "number" ? currentScroll.active : 0;
    const activeSegment = mapped.find((segment) => segment.partIndex === activeIndex);

    if (!activeSegment) {
      renderGuidedEncoding(item);
      return;
    }

    const lettersHtml = letters.map((letter, index) => `
      <div class="fs-letter" style="grid-column:${index + 1};">${escapeHtml(letter)}</div>
    `).join("");

    const marksHtml = renderMarks(letters, mapped);

    const soundLabelsHtml = mapped.map((segment) => {
      const soundLabel = getSegmentPhoneme(
        getChoice(item),
        segment.partIndex,
        targetParts[segment.partIndex]
      ) || `sound ${segment.partIndex + 1}`;
      return `
        <div class="fs-token-label" style="grid-column:${segment.start + 1} / span ${segment.end - segment.start + 1};">${escapeHtml(soundLabel)}</div>
      `;
    }).join("");

    const currentLabelsHtml = mapped.map((segment) => {
      const currentValue = String(currentScroll.values[segment.partIndex] || "").trim() || "—";
      const isActive = segment.partIndex === activeIndex;
      return `
        <button
          class="fs-token-label fs-token-label-current fs-token-button ${isActive ? "fs-token-button-active" : ""}"
          type="button"
          data-action="scroll-focus"
          data-index="${segment.partIndex}"
          style="grid-column:${segment.start + 1} / span ${segment.end - segment.start + 1};"
        >${escapeHtml(currentValue)}</button>
      `;
    }).join("");

    const options = currentScroll.optionSets[activeIndex] || [""];
    const optionsHtml = options.map((option) => {
      const selected = String(currentScroll.values[activeIndex] || "").trim().toLowerCase() === String(option || "").trim().toLowerCase();
      const label = String(option || "").trim() || "blank";
      return `
        <button
          class="btn secondary choiceOptionChip"
          type="button"
          data-action="choice-option"
          data-option="${escapeHtml(option)}"
          style="${selected ? "font-weight:800;" : ""}"
        >${escapeHtml(label)}</button>
      `;
    }).join("");
    const scaffoldWidth = cols * 28;

    main.innerHTML = `
      <div class="guidedPrompt">Choose the grapheme for each sound, then check the whole word.</div>
      <div class="focusWordShell">
        <div class="focusControlGrid" style="grid-template-columns:repeat(${cols}, 28px);">
          <button class="fs-arrow" type="button" data-action="scroll-bump" data-index="${activeIndex}" data-dir="-1" style="grid-column:${activeSegment.start + 1} / span ${activeSegment.end - activeSegment.start + 1};">▲</button>
        </div>
        <div class="focusLabelGrid" style="grid-template-columns:repeat(${cols}, 28px);">${soundLabelsHtml}</div>
        <div class="focusWordLetters" style="grid-template-columns:repeat(${cols}, 28px);">${lettersHtml}</div>
        <div class="focusWordMarks" style="grid-template-columns:repeat(${cols}, 28px);">${marksHtml}</div>
        <div class="focusLabelGrid" style="grid-template-columns:repeat(${cols}, 28px);">${currentLabelsHtml}</div>
        <div class="focusControlGrid" style="grid-template-columns:repeat(${cols}, 28px);">
          <button class="fs-arrow" type="button" data-action="scroll-bump" data-index="${activeIndex}" data-dir="1" style="grid-column:${activeSegment.start + 1} / span ${activeSegment.end - activeSegment.start + 1};">▼</button>
        </div>
      </div>
      <div class="choiceOptionCluster" style="--choice-cluster-width:${scaffoldWidth}px;">${optionsHtml}</div>
    `;

    refreshCheckAvailability(item);
  }

  function renderSupportedArrangement(item) {
    clearArrangeDragState();
    clearLoomDragState();
    currentScroll = null;
    currentLoom = null;
    currentSegmented = null;
    const targetParts = getTargetParts(item);

    if (targetParts.length < 2) {
      currentArrange = null;
      renderFullRecall();
      return;
    }

    if (!shouldReuseArrangement(item)) {
      setArrangementState(item, createArrangementModel(item));
      restoreArrangementProgressState(item);
    }

    const slotCount = Math.max(currentArrange.targetSegments.length, 1);
    const longestSegment = currentArrange.targetSegments.reduce(
      (max, segment) => Math.max(max, String(segment || "").trim().length),
      1
    );
    const answerGap = slotCount >= 10 ? 6 : slotCount >= 8 ? 8 : 10;
    const answerFontSize = slotCount >= 11 || longestSegment >= 5
      ? 16
      : slotCount >= 9 || longestSegment >= 4
        ? 18
        : slotCount >= 7
          ? 20
          : 24;
    const answerPadding = slotCount >= 9 || longestSegment >= 4 ? 8 : 12;
    const activeSlotIndex = typeof currentArrange.activeSlotIndex === "number" ? currentArrange.activeSlotIndex : -1;

    const answerTiles = currentArrange.targetSegments.map((_, index) => {
      const token = currentArrange.slots[index];
      const isFilled = !!token;
      const isActive = index === activeSlotIndex;
      return `
        <div
          class="supportArrangeSlot ${isFilled ? "supportArrangeSlot--filled" : ""} ${isActive ? "supportArrangeSlot--active" : ""}"
          data-drop-zone="answer"
          data-drop-index="${index}"
          data-slot-filled="${isFilled ? "true" : "false"}"
        >
          ${isFilled
            ? `
              <button
                class="supportArrangeTile supportArrangeTile--placed ${token.isSplit ? "supportArrangeTile--split" : ""} ${isActive ? "supportArrangeTile--active" : ""}"
                type="button"
                draggable="true"
                data-arrange-source="placed"
                data-action="arrange-slot"
                data-slot-index="${index}"
                data-token-id="${escapeHtml(token.id)}"
              >${escapeHtml(token.display)}</button>
            `
            : `
              <button
                class="supportArrangePlaceholder supportArrangePlaceholder--button ${isActive ? "supportArrangePlaceholder--active" : ""}"
                type="button"
                data-action="arrange-slot"
                data-slot-index="${index}"
                aria-label="Choose slot ${index + 1}"
              ></button>
            `}
        </div>
      `;
    }).join("");

    const bankTilesHtml = currentArrange.available.map((token) => `
      <button
        class="supportArrangeTile ${token.isSplit ? "supportArrangeTile--split" : ""}"
        type="button"
        draggable="true"
        data-arrange-source="available"
        data-action="arrange-place"
        data-token-id="${escapeHtml(token.id)}"
      >${escapeHtml(token.display)}</button>
    `).join("");

    main.innerHTML = `
      <div class="supportArrange">
        <div class="supportArrangeHint">Drag the scrambled graphemes into the order you hear.</div>
        <div class="supportArrangeMeta">Drag to move, or tap a box then a grapheme.</div>
        <div class="supportArrangeSectionLabel">Your spelling</div>
        <div
          class="supportArrangeAnswer"
          aria-live="polite"
          style="--arrange-slots:${slotCount}; --arrange-gap:${answerGap}px; --arrange-font-size:${answerFontSize}px; --arrange-padding:${answerPadding}px;"
        >${answerTiles}</div>
        <div class="supportArrangeTools">
          <button class="btn secondary" type="button" data-action="arrange-clear">Start again</button>
        </div>
        <div class="supportArrangeSectionLabel">Available graphemes</div>
        <div class="supportArrangeBank" data-drop-zone="bank">${bankTilesHtml || `<div class="muted">All graphemes used.</div>`}</div>
      </div>
    `;

    refreshCheckAvailability(item);
  }

  function renderFullRecall({ disablePaste = currentModeKind === "no_support_assessment" } = {}) {
    clearArrangeDragState();
    clearLoomDragState();
    currentScroll = null;
    currentArrange = null;
    currentLoom = null;
    currentSegmented = null;
    main.innerHTML = `
      <div class="row" style="justify-content:center; width:100%; margin-top:0;">
        <input id="pupilAnswer" class="input pupilAnswerInput" autocomplete="off" autocapitalize="off" spellcheck="false" ${disablePaste ? 'data-no-paste="true"' : ""} />
      </div>
    `;
    restoreFullRecallProgressState(currentItem());
    refreshCheckAvailability(currentItem());
    main.querySelector("#pupilAnswer")?.focus();
  }

  function focusSegmentedController() {
    window.requestAnimationFrame(() => {
      const controller = main.querySelector("#segmentedController");
      if (controller instanceof HTMLInputElement) {
        controller.focus({ preventScroll: true });
        const caretIndex = Math.max(0, Math.min(
          Number(currentSegmented?.activeIndex || 0),
          String(controller.value || "").length,
        ));
        try {
          controller.setSelectionRange(caretIndex, caretIndex);
        } catch {}
      }
    });
  }

  function renderSegmentedSpelling(item) {
    clearArrangeDragState();
    clearLoomDragState();
    currentScroll = null;
    currentArrange = null;
    currentLoom = null;

    const safeWord = getRenderableSegmentedWord(item);
    if (!safeWord) {
      renderFullRecall({ disablePaste: true });
      return;
    }

    if (!shouldReuseSegmented(item, safeWord)) {
      setSegmentedState(item, safeWord, createSegmentedSpellingModel(safeWord));
      restoreSegmentedProgressState(item);
    }

    const visualParts = getSegmentedLetterParts(item, safeWord);
    const previewModel = mapPreviewSegments(safeWord, visualParts);
    const layout = buildSegmentedLayout(previewModel);
    if (!layout) {
      currentSegmented = null;
      renderFullRecall({ disablePaste: true });
      return;
    }

    const visualAidsMode = getSegmentedVisualAidsMode(item);
    const activeIndex = Number(currentSegmented?.activeIndex || 0);
    const helperText = presentationMode
      ? "Type the spelling one letter at a time."
      : "Type one letter in each box. Tap any box to change a letter.";
    const activeStatus = `Letter ${Math.min(activeIndex + 1, currentSegmented.wordLength)} of ${currentSegmented.wordLength} selected.`;

    const rowsHtml = layout.rows.map((row) => {
      const rowStart = row.start;
      const rowEnd = row.end;
      const cols = rowEnd - rowStart + 1;
      const rowBoxes = currentSegmented.letters
        .slice(rowStart, rowEnd + 1)
        .map((value, localIndex) => {
          const letterIndex = rowStart + localIndex;
          const isActive = letterIndex === activeIndex;
          const isFilled = !!String(value || "").trim();
          return `
            <button
              class="segmentedBox ${isActive ? "segmentedBox--active" : ""} ${isFilled ? "segmentedBox--filled" : ""}"
              type="button"
              data-action="segmented-focus"
              data-index="${letterIndex}"
              tabindex="-1"
              aria-hidden="true"
            ><span>${escapeHtml(value || "")}</span></button>
          `;
        }).join("");

      return `
        <div class="segmentedRow" style="--segmented-cols:${cols}; --segmented-cell-size:${layout.cellSize}px; --segmented-gap:${layout.gapSize}px;">
          <div class="segmentedBoxes" style="grid-template-columns:repeat(${cols}, var(--segmented-cell-size)); column-gap:var(--segmented-gap);">${rowBoxes}</div>
          ${visualAidsMode === "phonics" ? renderSegmentedMarksRow(previewModel, rowStart, rowEnd) : ""}
        </div>
      `;
    }).join("");

    main.innerHTML = `
      <div class="segmentedShell" style="--segmented-cell-size:${layout.cellSize}px; --segmented-gap:${layout.gapSize}px;">
        <div id="segmentedInstructions" class="segmentedMeta">${escapeHtml(helperText)}</div>
        <div class="segmentedStatus" id="segmentedStatus" aria-live="polite">${escapeHtml(activeStatus)}</div>
        <div class="segmentedRows" role="group" aria-label="Segmented spelling input" aria-describedby="segmentedInstructions segmentedStatus">
          ${rowsHtml}
        </div>
        <input
          id="segmentedController"
          class="segmentedController"
          type="text"
          inputmode="text"
          enterkeyhint="done"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Spell the word one letter at a time"
          aria-describedby="segmentedInstructions segmentedStatus"
          value="${escapeHtml(currentSegmented.answer)}"
        />
      </div>
    `;

    refreshCheckAvailability(item);
    focusSegmentedController();
  }

  function isPasteBlockedAnswerTarget(target) {
    return target instanceof HTMLInputElement
      && target.id === "pupilAnswer"
      && target.dataset.noPaste === "true";
  }

  function isSegmentedControllerTarget(target) {
    return target instanceof HTMLInputElement && target.id === "segmentedController";
  }

  function blockAnswerPaste(event) {
    if (!isPasteBlockedAnswerTarget(event.target)) return false;
    event.preventDefault();
    feedback.innerHTML = `<strong>Pasting is disabled for this test.</strong>`;
    event.target.focus();
    return true;
  }

  function applySegmentedTextInput(text) {
    const inserted = currentSegmented?.insertChar(text);
    if (!inserted) return false;
    renderSegmentedSpelling(currentItem());
    scheduleProgressSync();
    return true;
  }

  function applySegmentedPaste(text) {
    const pasted = currentSegmented?.pasteText(text);
    if (!pasted) return false;
    renderSegmentedSpelling(currentItem());
    scheduleProgressSync();
    return true;
  }

  function renderCurrentPickerMode(item) {
    clearArrangeDragState();
    clearLoomDragState();
    currentArrange = null;
    currentLoom = null;
    currentSegmented = null;
    if (currentModeKind === "multiple_choice_grapheme_picker") {
      renderMultipleChoice(item);
      return;
    }
    renderFocusSound(item);
  }

  function renderWord() {
    locked = false;
    completionInFlight = false;
    stopAudioPlayback();
    btnExit.disabled = false;
    feedback.innerHTML = "";
    btnNext.style.display = "none";
    btnNext.textContent = idx >= words.length - 1 ? "Finish test" : "Next word";
    btnCheck.style.display = "inline-block";
    btnCheck.disabled = false;
    btnListen.style.display = isAudioEnabled() ? "inline-block" : "none";
    btnListen.disabled = false;

    const item = currentItem();
    const savedAttemptsUsed = Math.max(0, Number(getProgressEntry(item)?.attemptsUsed || 0));
    currentAttempt = Math.max(1, Math.min(getAttemptsAllowedForItem(item), savedAttemptsUsed + 1));
    updateHeader();
    renderAttemptDots();
    const questionType = resolveQuestionType(item);
    currentModeKind = resolveModeKind(item);
    modeText.textContent = readableQuestionType(item, currentModeKind);

    promptLine.textContent = "";
    sentenceLine.style.display = "none";
    sentenceLine.textContent = "";

    if (currentModeKind === "focus_sound") {
      promptLine.textContent = presentationMode
        ? "Spell the word."
        : "Choose the correct grapheme for the focus sound.";
      renderCurrentPickerMode(item);
    } else if (currentModeKind === "multiple_choice_grapheme_picker") {
      promptLine.textContent = presentationMode
        ? "Spell the word."
        : shouldUseFocusOnlyMultipleChoice(item)
          ? "Choose the correct grapheme for the focus sound."
          : "Choose the graphemes to spell the word.";
      if (isHintsEnabled() && item?.sentence) {
        sentenceLine.style.display = "block";
        sentenceLine.textContent = item.sentence;
      }
      renderCurrentPickerMode(item);
    } else if (currentModeKind === "spell_loom") {
      promptLine.textContent = presentationMode
        ? "Build the word."
        : "Listen and build the word on the rail.";
      if (isHintsEnabled() && item?.sentence) {
        sentenceLine.style.display = "block";
        sentenceLine.textContent = item.sentence;
      }
      renderSpellLoom(item);
    } else if (currentModeKind === "type_what_you_hear") {
      promptLine.textContent = presentationMode
        ? "Spell the word you hear."
        : getTargetParts(item).length > 1
          ? "Listen and arrange the graphemes to spell the word."
          : "Listen and type the spelling.";
      if (isHintsEnabled() && item?.sentence) {
        sentenceLine.style.display = "block";
        sentenceLine.textContent = item.sentence;
      }
      renderSupportedArrangement(item);
    } else if (currentModeKind === "segmented_spelling") {
      promptLine.textContent = presentationMode
        ? "Spell the word you hear."
        : "Listen and spell the word one letter at a time.";
      renderSegmentedSpelling(item);
    } else {
      promptLine.textContent = presentationMode
        ? "Spell the word you hear."
        : "Listen and type the spelling.";
      if (isHintsEnabled() && !normalizeTestLevelQuestionType(testMeta?.question_type) && item?.sentence && questionType === "full_recall") {
        sentenceLine.style.display = "block";
        sentenceLine.textContent = item.sentence;
      }
      renderFullRecall();
    }

    if (hasPendingFinalWrongReveal(getProgressEntry(item))) {
      showFinalWrongRevealState(item);
      return;
    }

    scheduleAutoPlay(item);
  }

  function getCurrentTypedValue() {
    const item = currentItem();
    const questionType = resolveQuestionType(item);

    if (questionType === "guided_encoding") {
      return buildWordFromGraphemes(currentScroll?.values || []);
    }
    if (currentModeKind === "multiple_choice_grapheme_picker" && currentScroll) {
      return buildWordFromGraphemes(currentScroll.values || []);
    }
    if (currentModeKind === "spell_loom" && currentLoom) {
      return currentLoom.answer;
    }
    if (currentModeKind === "type_what_you_hear" && currentArrange) {
      return currentArrange.answer;
    }
    if (currentModeKind === "segmented_spelling" && currentSegmented) {
      return currentSegmented.answer;
    }

    const input = main.querySelector("#pupilAnswer");
    return String(input?.value || "").trim();
  }

  function isCurrentCorrect(typed) {
    const item = currentItem();
    const questionType = resolveQuestionType(item);

    if (questionType === "guided_encoding") {
      const targetParts = getTargetParts(item);
      const typedParts = currentScroll?.values || [];
      if (typedParts.length !== targetParts.length) return false;
      return typedParts.every((part, i) => String(part || "").trim().toLowerCase() === String(targetParts[i] || "").trim().toLowerCase());
    }
    if (currentModeKind === "multiple_choice_grapheme_picker" && currentScroll) {
      const targetParts = getTargetParts(item);
      const chosenParts = currentScroll.values || [];
      if (chosenParts.length !== targetParts.length) return false;
      return chosenParts.every((part, i) => String(part || "").trim().toLowerCase() === String(targetParts[i] || "").trim().toLowerCase());
    }

    const target = String(item?.word || "").trim().toLowerCase();
    return String(typed || "").trim().toLowerCase() === target;
  }

  async function logAttempt({ typed, correct }) {
    if (!recordAttempts) return;
    const item = currentItem();
    const choice = getChoice(item);
    const resolvedFocusGrapheme = getResolvedFocusGrapheme(item);
    const resolvedWordText = String(item?.word || "").trim()
      || buildWordFromGraphemes(Array.isArray(item?.segments) ? item.segments : []);
    const attemptsAllowed = getAttemptsAllowedForItem(item);
    await pupilRecordAttempt({
      pupilId,
      assignmentId,
      testId: testMeta?.id,
      testWordId: item?.base_test_word_id || item?.id || null,
      assignmentTargetId: item?.assignment_target_id || item?.assignmentTargetId || null,
      mode: resolveQuestionType(item),
      typed,
      correct,
      attemptNumber: currentAttempt,
      attemptsAllowed: Number.isFinite(attemptsAllowed) ? attemptsAllowed : null,
      wordText: resolvedWordText || null,
      wordSource: item?.is_target_word ? "targeted" : "base",
      attemptSource: testMeta?.attempt_source || "test",
      targetGraphemes: Array.isArray(item?.segments) ? item.segments : null,
      focusGrapheme: resolvedFocusGrapheme,
      patternType: choice?.pattern_type || null,
    });
  }

  function finishWord({ correct, typed }) {
    locked = true;
    stopAudioPlayback();
    btnListen.disabled = true;
    btnCheck.disabled = true;
    btnCheck.style.display = "none";
    btnNext.textContent = idx >= words.length - 1 ? "Finish test" : "Next word";
    btnNext.style.display = "inline-block";

    const item = currentItem();
    const choice = getChoice(item);
    const resolvedWordText = String(item?.word || "").trim()
      || buildWordFromGraphemes(Array.isArray(item?.segments) ? item.segments : []);
    const resolvedFocusGrapheme = getResolvedFocusGrapheme(item);
    const attemptsUsed = currentAttempt;
    const revealOnFinalWrong = !correct && shouldRevealOnFinalWrong(item);
    const completedEntry = buildStoredProgressEntry(item, {
      completed: true,
      correct,
      typed,
      attemptsUsed,
      attemptsAllowed: getAttemptsAllowedForItem(item),
      questionType: resolveQuestionType(item),
      modeKind: currentModeKind || resolveModeKind(item),
      inputState: revealOnFinalWrong ? captureCurrentInputState() : null,
      feedbackState: revealOnFinalWrong ? { kind: "final_wrong_reveal", pending: true } : null,
      index: idx + 1,
    });
    progressEntries.set(getItemStateKey(item), completedEntry);
    upsertCompletedResult(item, {
      ...completedEntry,
      word: resolvedWordText,
      focusGrapheme: resolvedFocusGrapheme,
      patternType: choice?.pattern_type || null,
    });
    rebuildSessionResultState();
    updateHeader();
    scheduleProgressSync({ immediate: true });

    if (correct) {
      feedback.innerHTML = `<span class="badgeOk">Correct.</span> <span class="muted">${attemptsUsed} ${attemptsUsed === 1 ? "attempt" : "attempts"}.</span>`;
      return;
    }

    if (revealOnFinalWrong) {
      showFinalWrongRevealState(item, completedEntry);
      return;
    }

    feedback.innerHTML = `<span class="badgeBad">Incorrect.</span>`;
  }

  async function check() {
    if (locked) return;
    const item = currentItem();
    if (!hasMeaningfulCurrentAnswer(item)) {
      showAnswerRequiredFeedback(item);
      return;
    }

    const attemptsAllowed = getAttemptsAllowedForItem(item);
    const typed = getCurrentTypedValue();
    const correct = isCurrentCorrect(typed);

    if (!correct && shouldBlockRepeatedWrongChoice(item, typed)) {
      feedback.innerHTML = `<strong>Try a different grapheme.</strong>`;
      return;
    }

    await logAttempt({ typed, correct });

    if (correct) {
      finishWord({ correct: true, typed });
      return;
    }

    if (currentAttempt >= attemptsAllowed) {
      finishWord({ correct: false, typed });
      return;
    }

    progressEntries.set(
      getItemStateKey(item),
      buildStoredProgressEntry(item, {
        completed: false,
        correct: false,
        typed,
        attemptsUsed: currentAttempt,
        attemptsAllowed,
        questionType: resolveQuestionType(item),
        modeKind: currentModeKind || resolveModeKind(item),
        inputState: captureCurrentInputState(),
        feedbackState: null,
        index: idx + 1,
      })
    );
    currentAttempt += 1;
    updateHeader();
    renderAttemptDots();
    feedback.innerHTML = `<span class="badgeBad">Not quite.</span> <strong>Try again.</strong>`;
    scheduleProgressSync({ immediate: true });

    if (currentModeKind === "spell_loom" && currentLoom) return;
    if (currentModeKind === "type_what_you_hear" && currentArrange) return;
    if (currentModeKind === "segmented_spelling" && currentSegmented) {
      focusSegmentedController();
      return;
    }

    const input = main.querySelector("#pupilAnswer");
    input?.focus();
    input?.select();
  }

  async function nextWord() {
    if (completionInFlight) return;
    const item = currentItem();
    const currentEntry = item ? getProgressEntry(item) : null;
    if (item && !currentEntry?.completed) {
      focusCurrentControl();
      return;
    }

    if (clearPendingFinalWrongReveal(currentItem())) {
      scheduleProgressSync({ immediate: true });
    }

    const nextIndex = findNextUnfinishedIndex(idx + 1);
    if (nextIndex >= words.length) {
      const completionPayload = !hasPendingFinalWrongRevealInSession()
        ? buildCompletionPayload()
        : null;
      if (!completionPayload) {
        const unfinishedIndex = findNextUnfinishedIndex(0);
        if (unfinishedIndex < words.length) idx = unfinishedIndex;
        renderWord();
        return;
      }

      beginFinishingState();
      try {
        await flushProgressSync();
        if (progressSyncTimer) {
          window.clearTimeout(progressSyncTimer);
          progressSyncTimer = 0;
        }
        progressClosed = true;
        await onComplete?.(completionPayload);
      } catch (error) {
        progressClosed = false;
        endFinishingState({ allowRetry: true });
        feedback.innerHTML = `<span class="badgeBad">Could not finish yet.</span> <span class="muted">Please try again.</span>`;
        console.warn("finish test error:", error);
      }
      return;
    }
    idx = nextIndex;
    renderWord();
  }

  main.addEventListener("dragstart", (event) => {
    if (locked || currentModeKind !== "spell_loom" || !currentLoom) return;
    const token = event.target.closest(".spellLoomToken, .spellLoomCell--filled");
    if (!token) return;

    const tokenId = String(token.dataset.tokenId || "");
    const source = String(token.dataset.loomSource || "");
    if (!tokenId || !source) return;

    currentLoomDrag = { tokenId, source };
    token.classList.add("spellLoomToken--dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-phoneme-loom", JSON.stringify(currentLoomDrag));
      event.dataTransfer.setData("text/plain", tokenId);
    }
  });

  main.addEventListener("dragover", (event) => {
    if (locked || currentModeKind !== "spell_loom" || !currentLoom) return;
    const dragData = getLoomDragData(event);
    if (!dragData) return;

    const tray = event.target.closest(".spellLoomTray");
    if (tray && dragData.source === "placed") {
      event.preventDefault();
      setLoomDropTarget({ tray });
      return;
    }

    const cell = event.target.closest("[data-drop-zone='loom-cell']");
    if (!cell) {
      clearLoomDropTarget();
      return;
    }

    const token = currentLoom.getTokenById(dragData.tokenId);
    if (!token) {
      clearLoomDropTarget();
      return;
    }

    const cellIndex = Number(cell.dataset.loomCellIndex || 0);
    const startIndex = resolveLoomStartIndex(currentLoom, token, cellIndex);
    event.preventDefault();
    setLoomDropTarget({ start: startIndex, span: token.span, kind: token.kind });
  });

  main.addEventListener("drop", (event) => {
    if (locked || currentModeKind !== "spell_loom" || !currentLoom) return;
    const dragData = getLoomDragData(event);
    if (!dragData) return;

    const tray = event.target.closest(".spellLoomTray");
    if (tray && dragData.source === "placed") {
      event.preventDefault();
      const didRemove = currentLoom.remove(dragData.tokenId);
      clearLoomDragState();
      if (didRemove) renderSpellLoom(currentItem());
      return;
    }

    const cell = event.target.closest("[data-drop-zone='loom-cell']");
    if (!cell) {
      clearLoomDragState();
      return;
    }

    const token = currentLoom.getTokenById(dragData.tokenId);
    if (!token) {
      clearLoomDragState();
      return;
    }

    const cellIndex = Number(cell.dataset.loomCellIndex || 0);
    const startIndex = resolveLoomStartIndex(currentLoom, token, cellIndex);
    event.preventDefault();
    const didPlace = currentLoom.setPlacement(dragData.tokenId, startIndex);
    clearLoomDragState();
    if (didPlace) {
      renderSpellLoom(currentItem());
      scheduleProgressSync();
    }
  });

  main.addEventListener("dragend", () => {
    if (currentModeKind === "spell_loom") clearLoomDragState();
  });

  main.addEventListener("dragstart", (event) => {
    if (locked || currentModeKind !== "type_what_you_hear" || !currentArrange) return;
    const tile = event.target.closest(".supportArrangeTile[draggable='true']");
    if (!tile) return;

    const tokenId = String(tile.dataset.tokenId || "");
    const source = String(tile.dataset.arrangeSource || "");
    if (!tokenId || !source) return;

    currentArrangeDrag = { tokenId, source };
    tile.classList.add("supportArrangeTile--dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = source === "placed" ? "move" : "copyMove";
      event.dataTransfer.setData("application/x-phoneme-arrange", JSON.stringify(currentArrangeDrag));
      event.dataTransfer.setData("text/plain", tokenId);
    }
  });

  main.addEventListener("dragover", (event) => {
    if (locked || currentModeKind !== "type_what_you_hear" || !currentArrange) return;
    const dragData = getArrangeDragData(event);
    if (!dragData) return;

    const zone = getArrangeDropZone(event.target);
    if (!zone) {
      clearArrangeDropZone();
      return;
    }

    const dropZone = String(zone.dataset.dropZone || "");
    if (dropZone === "answer" || (dropZone === "bank" && dragData.source === "placed")) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = dropZone === "bank" ? "move" : "move";
      }
      setArrangeDropZone(zone);
      return;
    }

    clearArrangeDropZone();
  });

  main.addEventListener("drop", (event) => {
    if (locked || currentModeKind !== "type_what_you_hear" || !currentArrange) return;
    const zone = getArrangeDropZone(event.target);
    const dragData = getArrangeDragData(event);
    clearArrangeDropZone();

    if (!zone || !dragData) {
      clearArrangeDragState();
      return;
    }

    event.preventDefault();
    const didDrop = applyArrangeDrop(dragData, zone, event.clientX);
    clearArrangeDragState();
    if (didDrop) {
      renderSupportedArrangement(currentItem());
      scheduleProgressSync();
    }
  });

  main.addEventListener("dragend", () => {
    clearArrangeDragState();
  });

  main.addEventListener("beforeinput", (event) => {
    if (locked) {
      event.preventDefault();
      return;
    }
    if (isSegmentedControllerTarget(event.target) && currentModeKind === "segmented_spelling" && currentSegmented) {
      const rawText = String(event.data || "");
      if (event.inputType === "insertText" || event.inputType === "insertCompositionText") {
        event.preventDefault();
        if (/^[a-z]$/i.test(rawText)) {
          applySegmentedTextInput(rawText);
        }
        return;
      }
      if (event.inputType === "deleteContentBackward") {
        event.preventDefault();
        if (currentSegmented.backspace()) {
          renderSegmentedSpelling(currentItem());
          scheduleProgressSync();
        }
        return;
      }
      if (event.inputType === "deleteContentForward") {
        event.preventDefault();
        if (currentSegmented.deleteCurrent()) {
          renderSegmentedSpelling(currentItem());
          scheduleProgressSync();
        }
        return;
      }
      if (event.inputType === "insertFromDrop") {
        event.preventDefault();
        return;
      }
    }
    if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
      blockAnswerPaste(event);
    }
  });

  main.addEventListener("paste", (event) => {
    if (locked) {
      event.preventDefault();
      return;
    }
    if (isSegmentedControllerTarget(event.target) && currentModeKind === "segmented_spelling" && currentSegmented) {
      event.preventDefault();
      applySegmentedPaste(event.clipboardData?.getData("text") || "");
      return;
    }
    blockAnswerPaste(event);
  });

  main.addEventListener("drop", (event) => {
    if (locked) {
      event.preventDefault();
      return;
    }
    if (isSegmentedControllerTarget(event.target) && currentModeKind === "segmented_spelling") {
      event.preventDefault();
      return;
    }
    if (event.target instanceof HTMLElement && event.target.closest("#pupilAnswer")) {
      blockAnswerPaste(event);
    }
  });

  main.addEventListener("input", (event) => {
    if (locked) return;
    if (event.target instanceof HTMLInputElement && event.target.id === "pupilAnswer") {
      refreshCheckAvailability(currentItem());
      scheduleProgressSync();
    }
  });

  main.addEventListener("click", (event) => {
    if (leaveConfirmOpen) return;
    const btn = event.target.closest("[data-action]");
    if (!btn || locked) return;

    const action = btn.dataset.action;
    if (action === "scroll-bump") {
      const index = Number(btn.dataset.index);
      const dir = Number(btn.dataset.dir || 0);
      if (!Number.isNaN(index) && dir) {
        currentScroll?.bump(index, dir);
        renderCurrentPickerMode(currentItem());
        scheduleProgressSync();
      }
      return;
    }

    if (action === "scroll-focus") {
      const index = Number(btn.dataset.index);
      if (!Number.isNaN(index)) currentScroll?.setActive(index);
      renderCurrentPickerMode(currentItem());
      scheduleProgressSync();
      return;
    }

    if (action === "choice-option") {
      const option = String(btn.dataset.option || "");
      currentScroll?.choose(option);
      const activeIndex = Number(currentScroll?.active || 0);
      const nextEmptyIndex = (currentScroll?.values || []).findIndex((value, index) => {
        return index > activeIndex && !String(value || "").trim();
      });
      if (nextEmptyIndex >= 0) currentScroll?.setActive(nextEmptyIndex);
      renderCurrentPickerMode(currentItem());
      scheduleProgressSync();
      return;
    }

    if (action === "arrange-place") {
      const tokenId = String(btn.dataset.tokenId || "");
      currentArrange?.place(tokenId);
      renderSupportedArrangement(currentItem());
      scheduleProgressSync();
      return;
    }

    if (action === "arrange-slot") {
      const slotIndex = Number(btn.dataset.slotIndex || "");
      if (!Number.isNaN(slotIndex)) currentArrange?.tapSlot(slotIndex);
      renderSupportedArrangement(currentItem());
      scheduleProgressSync();
      return;
    }

    if (action === "arrange-clear") {
      currentArrange?.clear();
      renderSupportedArrangement(currentItem());
      scheduleProgressSync();
      return;
    }

    if (action === "segmented-focus") {
      const index = Number(btn.dataset.index || "");
      if (!Number.isNaN(index)) currentSegmented?.setActive(index);
      renderSegmentedSpelling(currentItem());
      scheduleProgressSync();
      return;
    }

    if (action === "loom-place") {
      const tokenId = String(btn.dataset.tokenId || "");
      const startIndex = findFirstOpenLoomStart(currentLoom, tokenId);
      if (startIndex >= 0) currentLoom?.setPlacement(tokenId, startIndex);
      renderSpellLoom(currentItem());
      scheduleProgressSync();
      return;
    }

    if (action === "loom-remove") {
      const tokenId = String(btn.dataset.tokenId || "");
      currentLoom?.remove(tokenId);
      renderSpellLoom(currentItem());
      scheduleProgressSync();
      return;
    }

    if (action === "loom-clear") {
      currentLoom?.clear();
      renderSpellLoom(currentItem());
      scheduleProgressSync();
      return;
    }
  });

  btnListen.addEventListener("click", () => {
    stopAudioPlayback();
    playCurrentAudio();
  });
  btnCheck.addEventListener("click", check);
  btnNext.addEventListener("click", () => {
    void nextWord();
  });
  btnExit.addEventListener("click", () => {
    requestLeave();
  });
  btnLeaveContinue?.addEventListener("click", () => {
    hideLeaveConfirm();
  });
  btnLeaveSave?.addEventListener("click", () => {
    void exitWithSave();
  });

  host.addEventListener("keydown", (e) => {
    if (leaveConfirmOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        hideLeaveConfirm();
      }
      return;
    }
    const item = currentItem();
    const questionType = resolveQuestionType(item);

    if (e.key === "Escape") {
      e.preventDefault();
      requestLeave();
      return;
    }

    if (btnNext.style.display !== "none" && e.key === "Enter") {
      e.preventDefault();
      void nextWord();
      return;
    }

    if (locked) return;

    if (currentModeKind === "type_what_you_hear" && currentArrange && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      const lastPlaced = currentArrange.placed[currentArrange.placed.length - 1];
      if (lastPlaced) {
        currentArrange.remove(lastPlaced.id);
        renderSupportedArrangement(currentItem());
        scheduleProgressSync();
      }
      return;
    }

    if (currentModeKind === "spell_loom" && currentLoom && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      const lastPlacement = currentLoom.placements[currentLoom.placements.length - 1];
      if (lastPlacement) {
        currentLoom.remove(lastPlacement.token.id);
        renderSpellLoom(currentItem());
        scheduleProgressSync();
      }
      return;
    }

    if (currentModeKind === "segmented_spelling" && currentSegmented) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        currentSegmented.moveActive(-1);
        renderSegmentedSpelling(currentItem());
        scheduleProgressSync();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        currentSegmented.moveActive(1);
        renderSegmentedSpelling(currentItem());
        scheduleProgressSync();
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        currentSegmented.setActive(0);
        renderSegmentedSpelling(currentItem());
        scheduleProgressSync();
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        currentSegmented.setActive(currentSegmented.wordLength - 1);
        renderSegmentedSpelling(currentItem());
        scheduleProgressSync();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        if (currentSegmented.backspace()) {
          renderSegmentedSpelling(currentItem());
          scheduleProgressSync();
        }
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        if (currentSegmented.deleteCurrent()) {
          renderSegmentedSpelling(currentItem());
          scheduleProgressSync();
        }
        return;
      }
    }

    if (questionType === "guided_encoding" || currentModeKind === "multiple_choice_grapheme_picker") {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        if (currentScroll?.active == null) currentScroll?.setActive(0);
        currentScroll?.bump(currentScroll.active, e.key === "ArrowUp" ? -1 : 1);
        renderCurrentPickerMode(currentItem());
        scheduleProgressSync();
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const parts = currentScroll?.values?.length || 1;
        const current = currentScroll?.active || 0;
        const next = e.key === "ArrowLeft" ? Math.max(0, current - 1) : Math.min(parts - 1, current + 1);
        currentScroll?.setActive(next);
        renderCurrentPickerMode(currentItem());
        scheduleProgressSync();
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      check();
    }
  });

  seedProgressFromResumeState();

  if (!words.length) return;

  const initialCompletionPayload = !hasPendingFinalWrongRevealInSession()
    ? buildCompletionPayload()
    : null;
  if (initialCompletionPayload) {
    progressClosed = true;
    stopAudioPlayback();
    btnCheck.disabled = true;
    btnNext.disabled = true;
    void onComplete?.(initialCompletionPayload);
    return;
  }

  renderWord();
}
