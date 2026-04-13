import { aiSuggest } from "../ai.js?v=2.8";
import { supabase } from "./supabaseClient.js";
import { syncAssignmentPupilTargetWords } from "./assignmentTargets.js?v=1.3";
import { createAutosave } from "./autosave.js";
import { parseWordList, splitWordToGraphemes, inferPattern, formatGraphemesForInput, parseGraphemeInput, detectMisspellingWarning } from "./wordParser.js?v=1.5";
import { buildWordFromGraphemes, renderPhonicsPreview } from "./phonicsRenderer.js";
import { getPhonemeAlternativeOptions } from "./data/phonemeHelpers.js";
import {
  buildCorrectionSignature,
  buildCorrectionType,
  buildPhonicsSnapshotKey,
  buildRuleEngineResolution,
  normalizeLookupWord,
  PHONICS_CLASSIFICATION_SOURCES,
  recordPhonicsCorrectionLogs,
  resolvePhonicsBatch,
  upsertApprovedPhonicsException,
} from "./phonicsResolution.js?v=1.0";
import {
  DEFAULT_QUESTION_TYPE,
  isIndependentQuestionType,
  normalizeStoredQuestionType,
} from "./questionTypes.js";
import {
  buildPersistedDifficultyPayload,
  buildTestDifficultySummary,
  buildWordDifficultyModel,
  describeTeacherDifficultyScore,
  describeTechnicalDifficultyScore,
  getDifficultyDisplayBand,
  getDifficultyTargetOption,
  DIFFICULTY_TARGET_OPTIONS,
  RESEARCH_DIFFICULTY_REFERENCES,
} from "./researchDifficulty.js?v=2.4";

const appEl = document.getElementById("app");
const ACCESSIBILITY_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "cream", label: "Cream" },
  { value: "blue", label: "Light blue" },
  { value: "green", label: "Light green" },
  { value: "yellow", label: "Soft yellow" },
];
const TEST_TYPE_OPTIONS = [
  { value: "focus_sound", label: "Focus sound" },
  { value: "spell_loom", label: "Spell Loom" },
  { value: "type_what_you_hear", label: "Arrange what you hear" },
  { value: "segmented_spelling", label: "Segmented spelling" },
  { value: "no_support_assessment", label: "No support (assessment mode)" },
];
const SEGMENTED_VISUAL_AID_OPTIONS = [
  { value: "none", label: "Off" },
  { value: "phonics", label: "Phonics aids" },
];
const LOOM_DECOY_LEVEL_OPTIONS = [
  { value: "none", label: "None" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
];
const ATTEMPT_OPTIONS = ["1", "2", "3", "5", "10", "unlimited"];
const DEFAULT_ASSIGN = { maxAttempts:"2", deadline:"", audioEnabled:true, hintsEnabled:true };
const MAX_TEST_WORDS = 20;

const state = {
  loading:true,
  saving:false,
  assigning:false,
  aiWorking:false,
  user:null,
  testId:null,
  test:null,
  rows:[],
  persistedWordIds:new Set(),
  classes:[],
  assignmentsByClass:{},
  assignmentBaselineByClass:{},
  selectedClassIds:new Set(),
  wordListText:"",
  notice:"",
  noticeType:"info",
  floating:"",
  isDirty:false,
  isLocked:false,
  loomDecoyLevel:"none",
  segmentedVisualAidsMode:"none",
  generator:{ target:"", topic:"", count:10, prompt:"", analyticsEnabled:false, analyticsCount:3, difficultyTarget:"any" },
  overlay:localStorage.getItem("ps_accessibility_overlay") || "default",
  justAssigned:false,
  rowResolutionRun:0,
};
let autosave = null;
let eventsBound = false;
let baselineHash = "";
let wordListTimer = null;

boot();

async function boot(){
  injectStyles();
  applyOverlay();
  state.testId = new URLSearchParams(window.location.search).get("id");
  if(!state.testId){ fail("No test ID found."); return; }

  const { data:auth } = await supabase.auth.getUser();
  state.user = auth?.user || null;
  if(!state.user){ fail("Please sign in first."); return; }

  try {
    await loadAll();
    state.loading = false;
    baselineHash = buildStateHash();
    paint();
    if(!eventsBound){ bindEvents(); eventsBound = true; }
    autosave = createAutosave({ intervalMs: 15000, onSave: async()=>{ if(state.isDirty && !state.isLocked && !state.saving && !state.assigning) await saveBuilder({ assign:false, silent:true }); }});
    autosave.start();
  } catch (error) {
    console.error(error);
    fail(error?.message || "Could not load test builder.");
  }
}

function fail(message){
  state.loading = false;
  state.notice = message;
  state.noticeType = "error";
  paint();
}

function normalizeLoomDecoyLevel(value){
  const clean = String(value || "").trim().toLowerCase();
  return ["light", "medium"].includes(clean) ? clean : "none";
}

function isMissingAnalyticsTargetColumnError(error){
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  const mentionsAnalyticsTargetColumn = message.includes("analytics_target_words_enabled")
    || message.includes("analytics_target_words_per_pupil");
  if(!mentionsAnalyticsTargetColumn) return false;
  return code === "PGRST204" || code === "42703" || message.includes("schema cache") || message.includes("column");
}

function stripAnalyticsTargetColumns(payload){
  const {
    analytics_target_words_enabled,
    analytics_target_words_per_pupil,
    ...rest
  } = payload || {};
  return rest;
}

async function insertSingleRowWithAnalyticsFallback(table, payload, selectColumns = "*"){
  let result = await supabase.from(table).insert(payload).select(selectColumns).single();
  if(result.error && isMissingAnalyticsTargetColumnError(result.error)){
    result = await supabase.from(table).insert(stripAnalyticsTargetColumns(payload)).select(selectColumns).single();
  }
  return result;
}

async function updateRowsWithAnalyticsFallback(table, payload, match = {}){
  const runUpdate = async(nextPayload) => {
    let query = supabase.from(table).update(nextPayload);
    for(const [key, value] of Object.entries(match || {})){
      query = query.eq(key, value);
    }
    return query;
  };

  let result = await runUpdate(payload);
  if(result.error && isMissingAnalyticsTargetColumnError(result.error)){
    result = await runUpdate(stripAnalyticsTargetColumns(payload));
  }
  return result;
}

function normalizeFocusValue(value){
  return String(value || "").trim().toLowerCase().replace(/[^a-z-]/g, "");
}

function isTeacherManualRow(row){
  return String(row?.source || "").trim().toLowerCase() === "teacher";
}

function buildResolutionSnapshot(resolution = {}, fallbackWord = ""){
  const segments = Array.isArray(resolution?.segments)
    ? resolution.segments.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const meta = inferPattern(segments);
  return {
    word: normalizeLookupWord(fallbackWord || resolution?.word || ""),
    segments,
    focusGrapheme: normalizeFocusValue(resolution?.focusGrapheme || meta.focusGrapheme || ""),
    patternType: String(resolution?.patternType || meta.patternType || "single").trim().toLowerCase() || "single",
    classificationSource: String(
      resolution?.classificationSource
      || resolution?.classification_source
      || PHONICS_CLASSIFICATION_SOURCES.ruleEngine
    ).trim().toLowerCase() || PHONICS_CLASSIFICATION_SOURCES.ruleEngine,
    approvedExceptionId: String(
      resolution?.approvedExceptionId
      || resolution?.approved_exception_id
      || ""
    ).trim(),
    matchedWordRowId: String(
      resolution?.matchedWordRowId
      || resolution?.matched_word_row_id
      || ""
    ).trim(),
  };
}

function buildRowCurrentSnapshot(row, savedQuestionType = null){
  const segments = getRowSegmentsForSave(row);
  const focusGrapheme = savedQuestionType
    ? getRowFocusPatternForSave(row, savedQuestionType, segments)
    : (normalizeFocusValue(row?.focusPattern) || normalizeFocusValue(inferPattern(segments).focusGrapheme));
  return buildResolutionSnapshot({
    word: row?.word || "",
    segments,
    focusGrapheme,
    patternType: inferPattern(segments).patternType,
    classificationSource: row?.approvedExceptionActive && row?.approvedExceptionId
      ? PHONICS_CLASSIFICATION_SOURCES.approvedException
      : isTeacherManualRow(row)
        ? PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride
        : (row?.classificationSource || PHONICS_CLASSIFICATION_SOURCES.ruleEngine),
    approvedExceptionId: row?.approvedExceptionId || "",
  }, row?.word || "");
}

function setRowResolvedBaseline(row, resolution){
  if(!row) return;
  row.resolvedBaseline = buildResolutionSnapshot(resolution, row.word || "");
}

function applyResolvedValueToRow(row, resolution, {
  replaceText = true,
  nextSource = null,
  updateBaseline = true,
} = {}){
  if(!row) return;
  const snapshot = buildResolutionSnapshot(resolution, row.word || "");
  row.classificationSource = snapshot.classificationSource;
  row.approvedExceptionId = snapshot.approvedExceptionId || "";
  row.approvedExceptionActive = !!row.approvedExceptionId || snapshot.classificationSource === PHONICS_CLASSIFICATION_SOURCES.approvedException;
  if(replaceText){
    row.graphemesText = formatGraphemesForInput(snapshot.segments);
    row.focusPattern = snapshot.focusGrapheme || "";
    if(nextSource) row.source = nextSource;
  }
  if(updateBaseline){
    setRowResolvedBaseline(row, snapshot);
  }
}

function getRowsForSave(){
  return limitWords(state.rows.filter((row) => row.word));
}

function shouldPreserveManualResolution(row, replaceText){
  return !!replaceText && isTeacherManualRow(row);
}

async function resolveRowsAgainstSources(rows, {
  replaceText = true,
  updateBaseline = true,
  preserveCurrentState = false,
} = {}){
  const safeRows = Array.isArray(rows) ? rows.filter((row) => row?.word) : [];
  if(!safeRows.length || !state.user?.id) return;

  const runId = ++state.rowResolutionRun;
  const results = await resolvePhonicsBatch({
    teacherId: state.user.id,
    items: safeRows.map((row) => ({
      word: row.word,
      excludeTestWordId: row.persisted ? row.id : "",
    })),
  }).catch((error) => {
    console.warn("resolve rows fallback:", error);
    return safeRows.map((row) => buildRuleEngineResolution(row.word));
  });

  if(runId !== state.rowResolutionRun) return;

  safeRows.forEach((row, index) => {
    const resolution = results[index] || buildRuleEngineResolution(row.word);
    if((preserveCurrentState && !replaceText) || shouldPreserveManualResolution(row, replaceText)){
      if(updateBaseline) setRowResolvedBaseline(row, resolution);
      return;
    }
    applyResolvedValueToRow(row, resolution, {
      replaceText,
      nextSource: replaceText ? (String(row.source || "").trim().toLowerCase() === "analytics_target" ? "analytics_target" : "rule_engine") : null,
      updateBaseline,
    });
  });
}

async function resolveSingleRowFromWord(row){
  if(!row?.word || !state.user?.id) return;
  const expectedWord = String(row.word || "");
  const expectedId = String(row.id || "");
  const results = await resolvePhonicsBatch({
    teacherId: state.user.id,
    items: [{
      word: row.word,
      excludeTestWordId: row.persisted ? row.id : "",
    }],
  }).catch((error) => {
    console.warn("resolve row fallback:", error);
    return [buildRuleEngineResolution(row.word)];
  });
  if(String(row.word || "") !== expectedWord || String(row.id || "") !== expectedId) return;
  applyResolvedValueToRow(row, results[0] || buildRuleEngineResolution(row.word), {
    replaceText: true,
    nextSource: String(row.source || "").trim().toLowerCase() === "analytics_target" ? "analytics_target" : "rule_engine",
    updateBaseline: true,
  });
}

async function loadAll(){
  const teacherId = state.user.id;
  const [testRes, wordsRes, classRes, assignmentRes] = await Promise.all([
    supabase.from("tests").select("*").eq("id", state.testId).eq("teacher_id", teacherId).single(),
    supabase.from("test_words").select("*").eq("test_id", state.testId).order("position", { ascending:true }),
    supabase.from("classes").select("id,name").eq("teacher_id", teacherId).order("name", { ascending:true }),
    supabase.from("assignments_v2").select("*").eq("teacher_id", teacherId).eq("test_id", state.testId),
  ]);

  if(testRes.error || !testRes.data) throw new Error("Could not load this test.");
  state.test = {
    ...testRes.data,
    title:testRes.data.title || "Untitled test",
    status:testRes.data.status || "draft",
    question_type:normalizeStoredQuestionType(testRes.data.question_type, {
      title: testRes.data.title || "",
    }),
  };
  state.generator.analyticsEnabled = !!testRes.data.analytics_target_words_enabled;
  state.generator.analyticsCount = String(getStoredAnalyticsTargetWordCount(testRes.data.analytics_target_words_per_pupil));
  state.classes = classRes.data || [];

  const assignments = assignmentRes.data || [];
  state.isLocked = state.test.status === "published" || assignments.length > 0;

  state.rows = (wordsRes.data || []).map((row, index) => rowFromDb(row, index));
  await resolveRowsAgainstSources(state.rows, { replaceText:false, updateBaseline:true, preserveCurrentState:true });
  state.persistedWordIds = new Set(
    state.rows
      .map((row) => String(row?.id || "").trim())
      .filter(Boolean)
  );
  state.wordListText = state.rows.map(r => r.word).filter(Boolean).join("\n");
  state.loomDecoyLevel = normalizeLoomDecoyLevel(
    (wordsRes.data || []).find((row) => row?.choice?.loom_decoy_level)?.choice?.loom_decoy_level
  );
  state.segmentedVisualAidsMode = String(
    (wordsRes.data || []).find((row) => row?.choice?.visual_aids_mode)?.choice?.visual_aids_mode || "none"
  ).trim().toLowerCase() === "phonics"
    ? "phonics"
    : "none";

  for(const cls of state.classes){
    const existing = assignments.find(item => String(item.class_id) === String(cls.id));
    const assignmentState = {
      assignmentId: existing?.id || null,
      createdAt: existing?.created_at || null,
      maxAttempts: existing?.max_attempts == null ? DEFAULT_ASSIGN.maxAttempts : String(existing.max_attempts),
      deadline: existing?.end_at ? toLocalDateTimeInput(existing.end_at) : "",
      audioEnabled: existing?.audio_enabled ?? DEFAULT_ASSIGN.audioEnabled,
      hintsEnabled: existing?.hints_enabled ?? DEFAULT_ASSIGN.hintsEnabled,
    };
    state.assignmentsByClass[String(cls.id)] = assignmentState;
    state.assignmentBaselineByClass[String(cls.id)] = { ...assignmentState };
    if(existing) state.selectedClassIds.add(String(cls.id));
  }
}

function rowFromDb(row, index){
  const graphemes = Array.isArray(row.segments) ? row.segments : splitWordToGraphemes(row.word || "");
  const meta = inferPattern(graphemes);
  const isAnalyticsTarget = !!row?.choice?.targeted_support || String(row?.choice?.source || "").trim().toLowerCase() === "analytics_target";
  const classificationSource = String(row?.choice?.classification_source || "").trim().toLowerCase()
    || (String(row?.choice?.source || "").trim().toLowerCase() === "teacher"
      ? PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride
      : PHONICS_CLASSIFICATION_SOURCES.ruleEngine);
  const approvedExceptionId = String(row?.choice?.approved_exception_id || "").trim();
  return {
    id: row.id || `temp-${index}`,
    word: row.word || "",
    sentence: row.sentence || "",
    graphemesText: formatGraphemesForInput(graphemes),
    focusPattern: row.choice?.focus_graphemes?.[0] || meta.focusGrapheme || "",
    source: isAnalyticsTarget ? "analytics_target" : (row.choice?.source || "teacher"),
    classificationSource,
    approvedExceptionId,
    approvedExceptionActive: !!approvedExceptionId || classificationSource === PHONICS_CLASSIFICATION_SOURCES.approvedException,
    targetedFocuses: Array.isArray(row?.choice?.targeted_focuses)
      ? row.choice.targeted_focuses.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
      : [],
    trickyWord: !!row?.choice?.difficulty?.flags?.tricky_word,
    warning: detectMisspellingWarning(row.word || ""),
    autoFillFromWord: false,
    persisted: true,
    resolvedBaseline: buildResolutionSnapshot({
      word: row.word || "",
      segments: graphemes,
      focusGrapheme: row.choice?.focus_graphemes?.[0] || meta.focusGrapheme || "",
      patternType: meta.patternType,
      classificationSource,
      approvedExceptionId,
    }, row.word || ""),
    lastSavedCorrectionKey: "",
  };
}

function createLocalRowId(){
  return `local-${crypto.randomUUID()}`;
}

function bindEvents(){
  appEl.addEventListener("click", onClick);
  appEl.addEventListener("input", onInput);
  appEl.addEventListener("change", onChange);
  appEl.addEventListener("keydown", onKeyDown);
  appEl.addEventListener("focusout", onFocusOut);
  window.addEventListener("beforeunload", onBeforeUnload);
}

function onBeforeUnload(event){
  if(!state.isDirty || state.saving || state.assigning) return;
  event.preventDefault();
  event.returnValue = "";
}

function onFocusOut(event){
  const target = event.target;
  if(!(target instanceof HTMLElement)) return;

  if(target.matches('[data-field="title-heading"]')){
    const nextTitle = String(target.value || "").trim();
    state.test.title = nextTitle || "Untitled test";
    target.value = state.test.title;
    markDirty();
    return;
  }
}

async function onClick(event){
  const btn = event.target.closest("[data-action]");
  if(!btn) return;
  const action = btn.dataset.action;

  if(action === "dismiss-notice"){ state.notice = ""; paint(); return; }
  if(action === "dismiss-floating"){ state.floating = ""; paint(); return; }
  clearTimeout(state.floatingTimeout);
  state.floatingTimeout = setTimeout(() => {
    state.floating = "";
    paint();
  }, 4000);

  if(action === "back-dashboard"){
    if(state.isDirty && !state.isLocked){
      const ok = window.confirm("Leave without saving?");
      if(!ok) return;
    }
    window.location.href = "./";
    return;
  }
  if(action === "generate-words"){ await generateWords(); return; }
  if(action === "suggest-sentences"){ await suggestSentences(); return; }
  if(action === "suggest-splits"){ await suggestSplits(); return; }
  if(action === "add-word"){ addWord(); return; }
  if(action === "delete-word"){ deleteWord(Number(btn.dataset.index)); return; }
  if(action === "approve-exception"){ await approveRowException(Number(btn.dataset.index), btn); return; }
  if(action === "save-draft"){ await saveBuilder({ assign:false, silent:false }); return; }
  if(action === "assign-test"){
    const assignIssues = validateBuilderForAssign();
    if(assignIssues.length){
      state.notice = assignIssues.length === 1
        ? assignIssues[0]
        : `${assignIssues[0]} ${assignIssues.length - 1} more issue${assignIssues.length - 1 === 1 ? "" : "s"} found.`;
      state.noticeType = "error";
      paintNotice();
      appEl.querySelector("#editWordsSection")?.scrollIntoView({ block:"start", behavior:"smooth" });
      return;
    }
    const selectedCount = getSelectedAssignableClassIds().length;
    const updatedCount = getUpdatedAssignedClassIds().length;
    const removedCount = getDeselectedAssignedClassIds().length;
    const changedCount = selectedCount + updatedCount + removedCount;
    const wordCounts = getAssignmentDialogWordCounts();
    const promptTitle = state.isLocked
      ? (selectedCount && !updatedCount && !removedCount ? "Assign this test to another class?" : "Update assignments for this test?")
      : "Assign this test?";
    const ok = window.confirm(
      `${promptTitle}\n\n${state.test.title || "Untitled test"}\nTest words: ${wordCounts.testWords}\nTargeted words: ${wordCounts.targetedWords}\nTotal words: ${wordCounts.totalWords}\nClasses changed: ${changedCount}`
    );
    if(!ok) return;
    await saveBuilder({ assign:true, silent:false });
    return;
  }
  if(action === "assign-another-class"){
    state.justAssigned = false;
    paint();
    appEl.querySelector("#assignmentSection")?.scrollIntoView({ block:"start", behavior:"smooth" });
    return;
  }
  if(action === "duplicate-test"){ await duplicateLockedTest(); return; }
  if(action === "build-another-test"){ await buildAnotherTest(); return; }
}

async function onKeyDown(event){
  const target = event.target;
  if(!(target instanceof HTMLElement)) return;
  if(event.key !== "Enter") return;
  if(!target.matches('[data-field="generator-prompt"]')) return;
  if(state.isLocked || state.aiWorking) return;

  event.preventDefault();
  await generateWords();
}

function onInput(event){
  const target = event.target;
  if(!(target instanceof HTMLElement)) return;

  if(target.matches('[data-field="title-heading"]')){
    state.test.title = target.value || "";
    markDirty();
    return;
  }
  if(target.matches('[data-field="word-list"]')){
    state.wordListText = target.value || "";
    window.clearTimeout(wordListTimer);
    wordListTimer = window.setTimeout(rebuildRowsFromWordList, 250);
    markDirty();
    return;
  }
  if(target.matches('[data-field="row-word"]')){
    const i = Number(target.dataset.index);
    if(!state.rows[i]) return;
    state.rows[i].word = String(target.value || "").toLowerCase().trim();
    state.rows[i].warning = detectMisspellingWarning(state.rows[i].word);
    if(isTeacherManualRow(state.rows[i])){
      state.rows[i].classificationSource = PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride;
      state.rows[i].approvedExceptionId = "";
      state.rows[i].approvedExceptionActive = false;
    }
    applyAutoFillFromWord(i);
    syncWordListTextFromRows();
    updateRowDom(i, target);
    if(state.rows[i]?.word && isTeacherManualRow(state.rows[i])){
      void resolveRowsAgainstSources([state.rows[i]], {
        replaceText:false,
        updateBaseline:true,
        preserveCurrentState:true,
      });
    }
    if(state.rows[i]?.word && !isTeacherManualRow(state.rows[i])){
      void resolveSingleRowFromWord(state.rows[i]).then(() => {
        updateRowDom(i, target);
        markDirty();
      });
    }
    markDirty();
    return;
  }
  if(target.matches('[data-field="row-sentence"]')){
    const i = Number(target.dataset.index);
    if(!state.rows[i]) return;
    state.rows[i].sentence = target.value || "";
    markDirty();
    return;
  }
  if(target.matches('[data-field="row-graphemes"]')){
    const i = Number(target.dataset.index);
    if(!state.rows[i]) return;
    state.rows[i].graphemesText = target.value || "";
    state.rows[i].autoFillFromWord = false;
    state.rows[i].source = "teacher";
    state.rows[i].classificationSource = PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride;
    state.rows[i].approvedExceptionId = "";
    state.rows[i].approvedExceptionActive = false;
    const meta = inferPattern(parseGraphemeInput(state.rows[i].graphemesText));
    state.rows[i].focusPattern = meta.focusGrapheme || state.rows[i].focusPattern || "";
    updateRowDom(i, target);
    markDirty();
    return;
  }
  if(target.matches('[data-field="row-focus"]')){
    const i = Number(target.dataset.index);
    if(!state.rows[i]) return;
    state.rows[i].focusPattern = target.value || "";
    state.rows[i].source = "teacher";
    state.rows[i].classificationSource = PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride;
    state.rows[i].approvedExceptionId = "";
    state.rows[i].approvedExceptionActive = false;
    markDirty();
    return;
  }
  if(target.matches('[data-field="generator-analytics-count"]')){
    state.generator.analyticsCount = target.value || "3";
    markDirty();
    return;
  }
  if(target.matches('[data-field^="generator-"]')){
    const key = target.dataset.field.replace("generator-", "");
    state.generator[key] = target.value || "";
    return;
  }
}

function onChange(event){
  const target = event.target;
  if(!(target instanceof HTMLElement)) return;

  if(target.matches('[data-field="accessibility-overlay"]')){
    state.overlay = target.value || "default";
    localStorage.setItem("ps_accessibility_overlay", state.overlay);
    applyOverlay();
    return;
  }
  if(target.matches('[data-field="row-word"]')){
    const i = Number(target.dataset.index);
    if(!state.rows[i]) return;
    state.rows[i].word = String(target.value || "").toLowerCase().trim();
    state.rows[i].warning = detectMisspellingWarning(state.rows[i].word);
    if(isTeacherManualRow(state.rows[i])){
      state.rows[i].classificationSource = PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride;
      state.rows[i].approvedExceptionId = "";
      state.rows[i].approvedExceptionActive = false;
    }
    applyAutoFillFromWord(i);
    syncWordListTextFromRows();
    updateRowDom(i, target);
    if(state.rows[i]?.word && isTeacherManualRow(state.rows[i])){
      void resolveRowsAgainstSources([state.rows[i]], {
        replaceText:false,
        updateBaseline:true,
        preserveCurrentState:true,
      });
    }
    if(state.rows[i]?.word && !isTeacherManualRow(state.rows[i])){
      void resolveSingleRowFromWord(state.rows[i]).then(() => {
        updateRowDom(i, target);
        markDirty();
      });
    }
    markDirty();
    return;
  }
  if(target.matches('[data-field="row-graphemes"]')){
    const i = Number(target.dataset.index);
    if(!state.rows[i]) return;
    state.rows[i].graphemesText = target.value || "";
    state.rows[i].autoFillFromWord = false;
    state.rows[i].source = "teacher";
    state.rows[i].classificationSource = PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride;
    state.rows[i].approvedExceptionId = "";
    state.rows[i].approvedExceptionActive = false;
    const meta = inferPattern(parseGraphemeInput(state.rows[i].graphemesText));
    state.rows[i].focusPattern = meta.focusGrapheme || state.rows[i].focusPattern || "";
    updateRowDom(i, target);
    markDirty();
    return;
  }
  if(target.matches('[data-field="test-question-type"]')){
    state.test.question_type = target.value || DEFAULT_QUESTION_TYPE;
    markDirty();
    paint();
    return;
  }
  if(target.matches('[data-field="test-loom-decoy-level"]')){
    state.loomDecoyLevel = normalizeLoomDecoyLevel(target.value);
    markDirty();
    return;
  }
  if(target.matches('[data-field="test-segmented-visual-aids"]')){
    state.segmentedVisualAidsMode = String(target.value || "none").trim().toLowerCase() === "phonics"
      ? "phonics"
      : "none";
    markDirty();
    return;
  }
  if(target.matches('[data-field="generator-analytics-enabled"]')){
    state.generator.analyticsEnabled = !!target.checked;
    markDirty();
    paint();
    return;
  }
  if(target.matches('[data-field="generator-difficulty-target"]')){
    state.generator.difficultyTarget = target.value || "any";
    paint();
    return;
  }
  if(target.matches('[data-field="assign-class"]')){
    const id = String(target.dataset.classId || "");
    if(target.checked) state.selectedClassIds.add(id); else state.selectedClassIds.delete(id);
    markDirty();
    return;
  }
  if(target.matches('[data-field="assignment-attempts"]')){
    const id = String(target.dataset.classId || "");
    state.assignmentsByClass[id].maxAttempts = target.value || DEFAULT_ASSIGN.maxAttempts;
    markDirty();
    return;
  }
  if(target.matches('[data-field="assignment-deadline"]')){
    const id = String(target.dataset.classId || "");
    state.assignmentsByClass[id].deadline = target.value || "";
    markDirty();
    return;
  }
  if(target.matches('[data-field="assignment-audio"]')){
    const id = String(target.dataset.classId || "");
    state.assignmentsByClass[id].audioEnabled = !!target.checked;
    markDirty();
    return;
  }
  if(target.matches('[data-field="assignment-hints"]')){
    const id = String(target.dataset.classId || "");
    state.assignmentsByClass[id].hintsEnabled = !!target.checked;
    markDirty();
    return;
  }
  if(target.matches('[data-field="row-tricky"]')){
    const i = Number(target.dataset.index);
    if(!state.rows[i]) return;
    state.rows[i].trickyWord = !!target.checked;
    updateRowDom(i, target);
    markDirty();
    return;
  }
}

function atWordLimit(){
  return state.rows.filter(r => r.word).length >= MAX_TEST_WORDS;
}

function scrollBuilderToTop(){
  const wrap = appEl.querySelector(".tb-wrap");
  if(wrap){
    wrap.scrollIntoView({ block: "start", behavior: "smooth" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function showFloating(message){
  state.floating = message;
  clearTimeout(state.floatingTimeout);
  state.floatingTimeout = setTimeout(() => {
    state.floating = "";
    paint();
  }, 4000);
}

function setBusy(button, isBusy, busyText = "Saving..."){
  if(!(button instanceof HTMLButtonElement)) return;
  if(isBusy){
    button.dataset.originalText = button.textContent || "";
    button.textContent = busyText;
    button.disabled = true;
    return;
  }
  button.disabled = false;
  if(button.dataset.originalText){
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

function rebuildRowsFromWordList(options = {}){
  const targetWordSet = options?.targetWordSet instanceof Set ? options.targetWordSet : null;
  const targetedFocuses = Array.isArray(options?.targetedFocuses)
    ? options.targetedFocuses.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const parsedWords = parseWordList(state.wordListText);
  const words = limitWords(parsedWords);
  const next = [];
  for(const word of words){
    const existing = state.rows.find(r => r.word === word);
    if(existing){
      if(targetWordSet?.has(word)){
        existing.source = "analytics_target";
        existing.targetedFocuses = [...targetedFocuses];
      }
      next.push(existing);
      continue;
    }
    const gs = splitWordToGraphemes(word);
    const meta = inferPattern(gs);
    next.push({
      id: createLocalRowId(),
      word,
      sentence:"",
      graphemesText: formatGraphemesForInput(gs),
      focusPattern: meta.focusGrapheme || "",
      source: targetWordSet?.has(word) ? "analytics_target" : "rule_engine",
      classificationSource: PHONICS_CLASSIFICATION_SOURCES.ruleEngine,
      approvedExceptionId: "",
      approvedExceptionActive: false,
      targetedFocuses: targetWordSet?.has(word) ? [...targetedFocuses] : [],
      trickyWord: false,
      warning: detectMisspellingWarning(word),
      autoFillFromWord: false,
      persisted: false,
      resolvedBaseline: buildResolutionSnapshot({
        word,
        segments: gs,
        focusGrapheme: meta.focusGrapheme || "",
        patternType: meta.patternType,
        classificationSource: PHONICS_CLASSIFICATION_SOURCES.ruleEngine,
      }, word),
      lastSavedCorrectionKey: "",
    });
  }
  state.rows = next;
  state.wordListText = next.map(r => r.word).filter(Boolean).join("\n");
  if(parsedWords.length > MAX_TEST_WORDS){
    showFloating(`Word limit reached. Maximum ${MAX_TEST_WORDS} words allowed.`);
  }
  const textarea = appEl.querySelector('[data-field="word-list"]');
  if(textarea && document.activeElement != textarea && textarea.value != state.wordListText){
    textarea.value = state.wordListText;
  }
  replaceRowsDom();
  void resolveRowsAgainstSources(state.rows, { replaceText:true, updateBaseline:true }).then(() => {
    replaceRowsDom();
    markDirty();
  });
  markDirty();
}

function addWord(){
  if(state.rows.length >= MAX_TEST_WORDS){
    showFloating(`Word limit reached. Maximum ${MAX_TEST_WORDS} words allowed.`);
    return;
  }
  state.rows.push({
    id:createLocalRowId(),
    word:"",
    sentence:"",
    graphemesText:"",
    focusPattern:"",
    source:"teacher",
    classificationSource: PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride,
    approvedExceptionId:"",
    approvedExceptionActive:false,
    trickyWord:false,
    warning:"",
    autoFillFromWord:true,
    persisted:false,
    resolvedBaseline:null,
    lastSavedCorrectionKey:"",
  });
  syncWordListTextFromRows();
  replaceRowsDom();
  markDirty();
  requestAnimationFrame(() => {
    const inputs = appEl.querySelectorAll('[data-field="row-word"]');
    const last = inputs[inputs.length - 1];
    if(last instanceof HTMLInputElement){ last.focus(); last.scrollIntoView({ block:"nearest" }); }
  });
}

function deleteWord(index){
  if(index < 0 || index >= state.rows.length) return;
  state.rows.splice(index, 1);
  syncWordListTextFromRows();
  replaceRowsDom();
  markDirty();
}

function clampTargetedWordCount(value){
  const num = Number(value);
  if(!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(10, Math.round(num)));
}

function getStoredAnalyticsTargetWordCount(value){
  const count = clampTargetedWordCount(value);
  return count >= 1 ? count : 3;
}

function getAnalyticsTargetSettingsForSave(){
  const enabled = !!state.generator.analyticsEnabled;
  const count = getStoredAnalyticsTargetWordCount(state.generator.analyticsCount);
  return {
    enabled,
    count,
    limitPerPupil: enabled ? count : 0,
  };
}

function getAssignmentDialogWordCounts(){
  const testWords = getRowsForSave().length;
  const analyticsSettings = getAnalyticsTargetSettingsForSave();
  const targetedWords = Math.max(0, Number(analyticsSettings.limitPerPupil || 0));
  return {
    testWords,
    targetedWords,
    totalWords: testWords + targetedWords,
  };
}

async function generateWords(){
  state.aiWorking = true; updateActionButtons();
  try {
    const targetDifficulty = getDifficultyTargetOption(state.generator.difficultyTarget);
    const promptRequestedCount = detectPromptRequestedWordCount(state.generator.prompt);
    const wanted = clampWordCount(promptRequestedCount ?? state.generator.count ?? 10);
    const candidateCount = targetDifficulty.center == null ? wanted : clampWordCount(Math.min(MAX_TEST_WORDS, wanted * 2));
    const prompt = [
      `Return exactly ${candidateCount} spelling words.`,
      `Return one word per line only.`,
      `Do not return phrases.`,
      `Do not return sentences.`,
      `Do not number the list.`,
      `Do not add headings or explanations.`,
      state.generator.target ? `Focus grapheme: ${state.generator.target}.` : "",
      state.generator.topic ? `Theme / topic: ${state.generator.topic}. Keep the words genuinely related to this theme where possible.` : "",
      targetDifficulty.promptHint || "",
      state.generator.prompt ? `Extra instruction: ${state.generator.prompt}.` : "",
    ].filter(Boolean).join(" ");
    const result = await aiSuggest(prompt);
    const existingWords = parseWordList(state.wordListText);
    const candidateWords = mergeUniqueWords(
      String(result || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split(/\n+/)
        .map(line => String(line || "").trim().toLowerCase())
        .map(line => line.replace(/^[-*\d\.)\s]+/, ""))
        .filter(Boolean)
        .filter(line => !/\s/.test(line))
        .map(line => line.replace(/^[^a-z]+|[^a-z]+$/g, ""))
        .filter(Boolean)
    ).slice(0, candidateCount);

    const aiWords = targetDifficulty.center == null
      ? candidateWords.slice(0, wanted)
      : candidateWords
        .map((word) => {
          const score = buildWordDifficultyModel({ word }).score;
          return {
            word,
            score,
            distance: Math.abs(score - targetDifficulty.center),
          };
        })
        .sort((a, b) => a.distance - b.distance || a.score - b.score || a.word.localeCompare(b.word))
        .map((item) => item.word)
        .slice(0, wanted);

    const nextWords = promptRequestedCount != null
      ? aiWords.slice(0, wanted)
      : mergeUniqueWords([...existingWords, ...aiWords]).slice(0, MAX_TEST_WORDS);

    state.wordListText = nextWords.join("\n");
    const textarea = appEl.querySelector('[data-field="word-list"]');
    if(textarea) textarea.value = state.wordListText;
    rebuildRowsFromWordList();
    if(!aiWords.length){
      showFloating("No valid words returned.");
    } else if(promptRequestedCount != null && Number(promptRequestedCount) >= MAX_TEST_WORDS){
      showFloating(`Word limit reached. Maximum ${MAX_TEST_WORDS} words allowed.`);
    } else if(nextWords.length >= MAX_TEST_WORDS && (existingWords.length + aiWords.length) > MAX_TEST_WORDS){
      showFloating(`Word limit reached. Maximum ${MAX_TEST_WORDS} words allowed.`);
    } else if(targetDifficulty.center != null){
      showFloating(`Words generated near the ${targetDifficulty.label.toLowerCase()} difficulty range.`);
    } else if(state.generator.analyticsEnabled){
      showFloating("Words generated. Hidden analytics words will be added per pupil when assigned.");
    } else {
      showFloating("Words generated.");
    }
  } catch (error) {
    console.error(error);
    state.notice = "Could not generate words.";
    state.noticeType = "error";
  } finally {
    state.aiWorking = false; updateActionButtons(); paintFloating();
  }
}

async function suggestSentences(){
  if(!state.rows.length) return;
  state.aiWorking = true; updateActionButtons();
  try {
    for(const row of state.rows){
      if(!row.word || row.sentence) continue;
      const res = await aiSuggest(`Write one short child-friendly sentence using the word "${row.word}". Return only the sentence.`);
      row.sentence = String(res || "").trim();
    }
    replaceRowsDom();
    markDirty();
    state.floating = "Sentences added.";
    clearTimeout(state.floatingTimeout);
    state.floatingTimeout = setTimeout(() => {
      state.floating = "";
      paint();
    }, 4000);
  } catch (error) {
    console.error(error);
    state.notice = "Could not suggest sentences.";
    state.noticeType = "error";
    paintNotice();
  } finally {
    state.aiWorking = false; updateActionButtons(); paintFloating();
  }
}

async function suggestSplits(){
  await resolveRowsAgainstSources(state.rows, { replaceText:true, updateBaseline:true });
  replaceRowsDom();
  markDirty();
  state.floating = "Splits refreshed.";
  clearTimeout(state.floatingTimeout);
  state.floatingTimeout = setTimeout(() => {
    state.floating = "";
    paint();
  }, 4000);
  paintFloating();
}

function getAssignmentModeFromTestType(){
  const type = normalizeStoredQuestionType(state.test?.question_type, {
    title: state.test?.title || "",
  });
  return (type === "type_what_you_hear" || isIndependentQuestionType(type)) ? "test" : "practice";
}

function getRowSegmentsForSave(row){
  const parsed = parseGraphemeInput(row?.graphemesText);
  if(parsed.length) return parsed;
  return row?.word ? splitWordToGraphemes(row.word) : [];
}

function getRowFocusPatternForSave(row, savedQuestionType, segments){
  const requested = String(row?.focusPattern || "").trim().toLowerCase();
  const validRequested = requested && segments.includes(requested) ? requested : "";
  if(savedQuestionType === "focus_sound"){
    if(validRequested && getPhonemeAlternativeOptions(validRequested, null, ["core", "all"]).length){
      return validRequested;
    }
    return inferPattern(segments).focusGrapheme || validRequested || "";
  }
  return validRequested || inferPattern(segments).focusGrapheme || "";
}

function buildTestWordPayload(row, index, savedQuestionType){
  const segments = getRowSegmentsForSave(row);
  const focusPattern = getRowFocusPatternForSave(row, savedQuestionType, segments);
  const difficulty = buildPersistedDifficultyPayload({
    word: row.word,
    graphemes: segments,
    trickyWord: !!row.trickyWord,
  });
  return {
    position: index + 1,
    word: row.word,
    sentence: row.sentence || null,
    segments,
    choice: (() => {
      const choice = { focus_graphemes:[focusPattern], source: row.source || "teacher" };
      choice.difficulty = difficulty;
      choice.classification_source = row?.approvedExceptionActive && row?.approvedExceptionId
        ? PHONICS_CLASSIFICATION_SOURCES.approvedException
        : isTeacherManualRow(row)
          ? PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride
          : (String(row?.classificationSource || "").trim().toLowerCase() || PHONICS_CLASSIFICATION_SOURCES.ruleEngine);
      if(row?.approvedExceptionId){
        choice.approved_exception_id = row.approvedExceptionId;
      }
      if(String(row.source || "").trim().toLowerCase() === "analytics_target"){
        choice.targeted_support = true;
        choice.targeted_focuses = Array.isArray(row.targetedFocuses)
          ? row.targetedFocuses.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
          : [];
      }
      if(savedQuestionType === "spell_loom"){
        choice.loom_decoy_level = normalizeLoomDecoyLevel(state.loomDecoyLevel);
      }
      if(savedQuestionType === "segmented_spelling"){
        choice.visual_aids_mode = state.segmentedVisualAidsMode === "phonics" ? "phonics" : "none";
      }
      return choice;
    })(),
  };
}

async function persistTestWords(savedQuestionType){
  const rowsToSave = getRowsForSave();
  const knownPersistedIds = new Set(
    [...state.persistedWordIds]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  const keptIds = new Set();

  for(const [index, row] of rowsToSave.entries()){
    const payload = buildTestWordPayload(row, index, savedQuestionType);
    row.graphemesText = formatGraphemesForInput(payload.segments);
    row.focusPattern = payload.choice?.focus_graphemes?.[0] || "";
    row.classificationSource = String(payload.choice?.classification_source || row.classificationSource || PHONICS_CLASSIFICATION_SOURCES.ruleEngine).trim().toLowerCase();
    row.approvedExceptionId = String(payload.choice?.approved_exception_id || "").trim();
    row.approvedExceptionActive = !!row.approvedExceptionId || row.classificationSource === PHONICS_CLASSIFICATION_SOURCES.approvedException;

    const rowId = String(row.id || "").trim();
    if(row.persisted && knownPersistedIds.has(rowId)){
      const { data:updated, error } = await supabase
        .from("test_words")
        .update(payload)
        .eq("id", rowId)
        .eq("test_id", state.testId)
        .select("id")
        .single();
      if(error) throw error;
      row.id = updated?.id || rowId;
      row.persisted = true;
      row.lastSavedCorrectionKey = "";
      keptIds.add(String(row.id));
      continue;
    }

    const { data:inserted, error } = await supabase
      .from("test_words")
      .insert([{ test_id: state.testId, ...payload }])
      .select("id")
      .single();
    if(error) throw error;
    row.id = inserted?.id || row.id;
    row.persisted = true;
    row.lastSavedCorrectionKey = "";
    keptIds.add(String(row.id));
  }

  state.persistedWordIds = new Set([...knownPersistedIds, ...keptIds]);
  const deletedIds = [...knownPersistedIds].filter((id) => !keptIds.has(id));
  if(deletedIds.length){
    const { error } = await supabase
      .from("test_words")
      .delete()
      .in("id", deletedIds)
      .eq("test_id", state.testId);
    if(error) throw error;
  }

  state.persistedWordIds = keptIds;
}

function buildCorrectionCompareKey(snapshot = {}){
  return [
    (Array.isArray(snapshot?.segments) ? snapshot.segments : []).join("|"),
    normalizeFocusValue(snapshot?.focusGrapheme || ""),
    String(snapshot?.patternType || "").trim().toLowerCase() || "single",
  ].join("::");
}

function collectBuilderCorrectionLogs(rowsToSave, savedQuestionType){
  const logs = [];

  for(const row of rowsToSave){
    if(!row?.word || !isTeacherManualRow(row)) continue;

    const original = row?.resolvedBaseline
      ? buildResolutionSnapshot(row.resolvedBaseline, row.word || "")
      : buildRuleEngineResolution(row.word || "");
    const corrected = buildRowCurrentSnapshot(row, savedQuestionType);
    if(!original?.segments?.length || !corrected?.segments?.length) continue;
    if(buildCorrectionCompareKey(original) === buildCorrectionCompareKey(corrected)) continue;

    const correctionType = buildCorrectionType(original, corrected);
    const correctionSignature = buildCorrectionSignature(correctionType, original, corrected);
    const correctionKey = [
      normalizeLookupWord(row.word),
      correctionSignature,
      buildCorrectionCompareKey(corrected),
    ].join("::");

    if(row.lastSavedCorrectionKey === correctionKey) continue;

    logs.push({
      word: row.word,
      original,
      corrected: {
        ...corrected,
        classificationSource: PHONICS_CLASSIFICATION_SOURCES.teacherManualOverride,
      },
      correctionType,
      correctionSignature,
      source: original.classificationSource || PHONICS_CLASSIFICATION_SOURCES.ruleEngine,
      contextArea: "builder",
      row,
      correctionKey,
    });
  }

  return logs;
}

async function persistBuilderCorrectionLogs(rowsToSave, savedQuestionType){
  const logs = collectBuilderCorrectionLogs(rowsToSave, savedQuestionType);
  if(!logs.length) return;

  try {
    await recordPhonicsCorrectionLogs({
      teacherId: state.user.id,
      logs,
    });
    for(const entry of logs){
      entry.row.lastSavedCorrectionKey = entry.correctionKey;
    }
  } catch (error) {
    console.warn("Could not save phonics correction logs:", error);
  }
}

function syncRowSaveBaselines(rowsToSave, savedQuestionType){
  for(const row of rowsToSave){
    if(!row?.word) continue;
    const current = buildRowCurrentSnapshot(row, savedQuestionType);
    setRowResolvedBaseline(row, current);
  }
}

async function approveRowException(index, button){
  const row = state.rows[index];
  if(!row?.word){
    state.notice = "Add a word before approving an exception.";
    state.noticeType = "error";
    paintNotice();
    return;
  }
  if(!row.persisted || !row.id){
    state.notice = "Save this word first, then approve the exception.";
    state.noticeType = "error";
    paintNotice();
    return;
  }
  if(state.isDirty){
    state.notice = "Save the current builder changes first, then approve the exception.";
    state.noticeType = "error";
    paintNotice();
    return;
  }

  const savedQuestionType = normalizeStoredQuestionType(state.test?.question_type, {
    title: state.test?.title || "",
  });
  const resolution = buildRowCurrentSnapshot(row, savedQuestionType);
  setBusy(button, true, "Saving...");

  try {
    const approved = await upsertApprovedPhonicsException({
      teacherId: state.user.id,
      word: row.word,
      resolution,
      source: "builder_manual_approval",
    });
    row.approvedExceptionId = String(approved?.id || "").trim();
    row.approvedExceptionActive = !!row.approvedExceptionId;
    row.classificationSource = PHONICS_CLASSIFICATION_SOURCES.approvedException;

    const saveIndex = Math.max(0, getRowsForSave().findIndex((item) => String(item?.id || "") === String(row.id || "")));
    const payload = buildTestWordPayload(row, saveIndex, savedQuestionType);
    const { error } = await supabase
      .from("test_words")
      .update(payload)
      .eq("id", row.id)
      .eq("test_id", state.testId);
    if(error) throw error;

    setRowResolvedBaseline(row, {
      ...resolution,
      classificationSource: PHONICS_CLASSIFICATION_SOURCES.approvedException,
      approvedExceptionId: row.approvedExceptionId,
    });

    showFloating("Approved exception saved.");
    updateRowDom(index);
  } catch (error) {
    console.error(error);
    state.notice = error?.message || "Could not approve this exception.";
    state.noticeType = "error";
    paintNotice();
  } finally {
    setBusy(button, false);
  }
}

function validateBuilderForAssign(){
  const issues = [];
  const words = limitWords(state.rows.filter(r => r.word));
  const savedQuestionType = normalizeStoredQuestionType(state.test?.question_type, {
    title: state.test?.title || "",
  });

  if(!words.length){
    issues.push("Add at least one word before assigning this test.");
  }

  if(!getSelectedAssignableClassIds().length && !getDeselectedAssignedClassIds().length && !getUpdatedAssignedClassIds().length){
    issues.push("Choose at least one class change before assigning.");
  }

  for(const [index, row] of words.entries()){
    const segments = getRowSegmentsForSave(row);
    if(!segments.length){
      issues.push(`Word ${index + 1} "${row.word}" needs a grapheme structure.`);
      continue;
    }

    const rebuiltWord = buildWordFromGraphemes(segments);
    if(rebuiltWord && rebuiltWord !== row.word){
      issues.push(`Word ${index + 1} "${row.word}" does not match its grapheme structure.`);
    }

    if(savedQuestionType === "focus_sound"){
      const hasSupportedFocus = segments.some((segment) => getPhonemeAlternativeOptions(segment, null, ["core", "all"]).length > 0);
      if(!hasSupportedFocus){
        issues.push(`Word ${index + 1} "${row.word}" needs a focus sound with real alternative graphemes, or a different test type.`);
      }
    }
  }

  return issues;
}

async function saveBuilder({ assign=false, silent=false }){
  state.saving = !assign;
  state.assigning = assign;
  paintBottomBar();
  try {
    const title = String(state.test.title || "").trim() || "Untitled test";
    const analyticsSettings = getAnalyticsTargetSettingsForSave();
    state.test.title = title;
    state.test.analytics_target_words_enabled = analyticsSettings.enabled;
    state.test.analytics_target_words_per_pupil = analyticsSettings.count;
    if(!state.isLocked){
      const savedQuestionType = normalizeStoredQuestionType(state.test.question_type, { title });
      const { error:testError } = await updateRowsWithAnalyticsFallback("tests", {
        title,
        status: assign ? "published" : "draft",
        question_type: savedQuestionType,
        analytics_target_words_enabled: analyticsSettings.enabled,
        analytics_target_words_per_pupil: analyticsSettings.count,
      }, { id: state.testId, teacher_id: state.user.id });
      if(testError) throw testError;
      await persistTestWords(savedQuestionType);
      const rowsToSave = getRowsForSave();
      await persistBuilderCorrectionLogs(rowsToSave, savedQuestionType);
      syncRowSaveBaselines(rowsToSave, savedQuestionType);
    }

    if(assign){
      const selected = getSelectedAssignableClassIds();
      const updated = getUpdatedAssignedClassIds();
      const removed = getDeselectedAssignedClassIds();
      if(!selected.length && !updated.length && !removed.length) throw new Error("No assignment changes selected.");

      for(const classId of [...selected, ...updated]){
        const s = state.assignmentsByClass[classId] || DEFAULT_ASSIGN;
        const payload = {
          teacher_id: state.user.id,
          test_id: state.testId,
          class_id: classId,
          mode: getAssignmentModeFromTestType(),
          max_attempts: s.maxAttempts === "unlimited" ? null : Number(s.maxAttempts),
          audio_enabled: !!s.audioEnabled,
          hints_enabled: !!s.hintsEnabled,
          end_at: s.deadline ? new Date(s.deadline).toISOString() : null,
          analytics_target_words_enabled: analyticsSettings.enabled,
          analytics_target_words_per_pupil: analyticsSettings.count,
        };
        const existingAssignmentId = state.assignmentsByClass[classId]?.assignmentId;
        if(existingAssignmentId){
          const { error } = await updateRowsWithAnalyticsFallback("assignments_v2", payload, {
            id: existingAssignmentId,
            teacher_id: state.user.id,
            test_id: state.testId,
          });
          if(error) throw error;
          state.assignmentsByClass[classId] = {
            ...s,
            assignmentId: existingAssignmentId,
            createdAt: state.assignmentsByClass[classId]?.createdAt || state.assignmentBaselineByClass[classId]?.createdAt || null,
          };
          state.assignmentBaselineByClass[classId] = {
            ...state.assignmentsByClass[classId],
          };
          try {
            await syncAssignmentPupilTargetWords({
              teacherId: state.user.id,
              assignmentId: existingAssignmentId,
              classId,
              testId: state.testId,
              createdAt: state.assignmentsByClass[classId]?.createdAt || null,
              limitPerPupil: analyticsSettings.limitPerPupil,
              force: true,
            });
          } catch (targetError) {
            console.warn("sync assignment targets error:", targetError);
          }
          continue;
        }

        const { data:inserted, error } = await insertSingleRowWithAnalyticsFallback(
          "assignments_v2",
          payload,
          "id, created_at",
        );
        if(error && !String(error.message || "").toLowerCase().includes("duplicate")) throw error;
        if(inserted?.id){
          state.assignmentsByClass[classId] = {
            ...s,
            assignmentId: inserted.id,
            createdAt: inserted.created_at || null,
          };
          state.assignmentBaselineByClass[classId] = {
            ...state.assignmentsByClass[classId],
          };
          try {
            await syncAssignmentPupilTargetWords({
              teacherId: state.user.id,
              assignmentId: inserted.id,
              classId,
              testId: state.testId,
              createdAt: inserted.created_at || null,
              limitPerPupil: analyticsSettings.limitPerPupil,
              force: true,
            });
          } catch (targetError) {
            console.warn("sync assignment targets error:", targetError);
          }
        }
      }

      for(const classId of removed){
        const assignmentId = state.assignmentsByClass[classId]?.assignmentId;
        if(!assignmentId) continue;
        const { error } = await supabase
          .from("assignments_v2")
          .delete()
          .eq("id", assignmentId)
          .eq("teacher_id", state.user.id)
          .eq("test_id", state.testId);
        if(error) throw error;
        state.assignmentsByClass[classId] = {
          ...state.assignmentsByClass[classId],
          assignmentId: null,
          createdAt: null,
        };
        state.assignmentBaselineByClass[classId] = {
          ...state.assignmentsByClass[classId],
        };
      }
      state.isLocked = true;
      state.justAssigned = true;
      showFloating(
        removed.length && (selected.length || updated.length)
          ? "Assignments updated."
          : removed.length
            ? "Class unassigned."
            : selected.length
              ? "Assigned successfully."
              : "Assignment settings updated."
      );
      setTimeout(() => {
        scrollBuilderToTop();
      }, 120);
    } else if(!silent) {
      state.floating = "Saved.";
      clearTimeout(state.floatingTimeout);
      state.floatingTimeout = setTimeout(() => {
        state.floating = "";
        paint();
      }, 4000);
    }

    baselineHash = buildStateHash();
    state.isDirty = false;
    if(!silent) {
      paintFloating();
      paint();
      if(assign){
        requestAnimationFrame(() => {
          scrollBuilderToTop();
        });
      }
    } else {
      paintBottomBar();
    }
  } catch (error) {
    console.error(error);
    state.notice = assign ? "Could not assign test." : "Could not save draft.";
    state.noticeType = "error";
    paintNotice();
  } finally {
    state.saving = false;
    state.assigning = false;
    paintBottomBar();
  }
}

async function duplicateLockedTest(){
  const analyticsSettings = getAnalyticsTargetSettingsForSave();
  const { data:newTest, error } = await insertSingleRowWithAnalyticsFallback("tests", {
    teacher_id: state.user.id,
    title: `${state.test.title || "Untitled test"} (copy)`,
    status:"draft",
    question_type: normalizeStoredQuestionType(state.test.question_type, {
      title: state.test.title || "",
    }),
    analytics_target_words_enabled: analyticsSettings.enabled,
    analytics_target_words_per_pupil: analyticsSettings.count,
  });
  if(error || !newTest){
    state.notice = "Could not duplicate test.";
    state.noticeType = "error";
    paintNotice();
    return;
  }
  window.location.href = `./test-builder.html?id=${encodeURIComponent(newTest.id)}`;
}

async function buildAnotherTest(){
  const { data:newTest, error } = await insertSingleRowWithAnalyticsFallback("tests", {
    teacher_id: state.user.id,
    title:"Untitled test",
    status:"draft",
    question_type:DEFAULT_QUESTION_TYPE,
    analytics_target_words_enabled: false,
    analytics_target_words_per_pupil: 3,
  });
  if(error || !newTest){
    state.notice = "Could not create new test.";
    state.noticeType = "error";
    paintNotice();
    return;
  }
  window.location.href = `./test-builder.html?id=${encodeURIComponent(newTest.id)}`;
}

function markDirty(){
  state.isDirty = buildStateHash() !== baselineHash;
  paintBottomBar();
}

function syncWordListTextFromRows(){
  state.wordListText = state.rows.map(r => r.word).filter(Boolean).join("\n");
  const textarea = appEl.querySelector('[data-field="word-list"]');
  if(textarea && document.activeElement != textarea) textarea.value = state.wordListText;
}

function applyAutoFillFromWord(index){
  const row = state.rows[index];
  if(!row || !(row.autoFillFromWord || row.source === "rule_engine")) return;
  if(!row.word){
    row.graphemesText = "";
    row.focusPattern = "";
    row.classificationSource = PHONICS_CLASSIFICATION_SOURCES.ruleEngine;
    row.approvedExceptionId = "";
    row.approvedExceptionActive = false;
    return;
  }

  const resolution = buildRuleEngineResolution(row.word);
  row.graphemesText = formatGraphemesForInput(resolution.segments);
  row.focusPattern = resolution.focusGrapheme || "";
  row.source = "rule_engine";
  row.classificationSource = PHONICS_CLASSIFICATION_SOURCES.ruleEngine;
  row.approvedExceptionId = "";
  row.approvedExceptionActive = false;
}

function buildStateHash(){
  return JSON.stringify({
    title: state.test?.title || "",
    question_type: normalizeStoredQuestionType(state.test?.question_type, {
      title: state.test?.title || "",
    }),
    loom_decoy_level: normalizeLoomDecoyLevel(state.loomDecoyLevel),
    segmented_visual_aids_mode: state.segmentedVisualAidsMode === "phonics" ? "phonics" : "none",
    analytics_target_words_enabled: !!state.generator.analyticsEnabled,
    analytics_target_words_per_pupil: getStoredAnalyticsTargetWordCount(state.generator.analyticsCount),
    rows: state.rows.map(r => [r.word, r.sentence, r.graphemesText, r.focusPattern, r.source, !!r.trickyWord, (r.targetedFocuses || []).join(",")]),
    selected:[...state.selectedClassIds].sort(),
    assign: state.assignmentsByClass,
  });
}

function paint(){
  if(state.loading){
    appEl.innerHTML = `<div class="tb-wrap"><section class="tb-card">Loading...</section></div>`;
    return;
  }
  appEl.innerHTML = renderLayout();
}

function renderLayout(){
  const targetDifficulty = getDifficultyTargetOption(state.generator.difficultyTarget);
  const lockedBanner = state.isLocked ? `<div class="tb-lock-banner"><div><strong>${esc(state.justAssigned ? "Test assigned successfully." : "This test is locked.")}</strong><div class="tb-subtle">${esc(state.justAssigned ? "Choose what you want to do next." : "It has already been assigned.")}</div></div><div class="tb-lock-actions"><button type="button" class="tb-btn tb-btn-black" data-action="assign-another-class">Assign to another class</button><button type="button" class="tb-btn tb-btn-black" data-action="duplicate-test">Duplicate test</button><button type="button" class="tb-btn tb-btn-black" data-action="build-another-test">Build another test</button><button type="button" class="tb-btn tb-btn-black" data-action="back-dashboard">Back to dashboard</button></div></div>` : "";
  return `<div class="tb-wrap">
    ${state.floating ? `<div class="tb-floating"><span>${esc(state.floating)}</span><button type="button" data-action="dismiss-floating">×</button></div>` : ""}
    <div class="tb-topbar">
      <div>
        <div class="tb-kicker">Test builder</div>
        <input id="tbTitleHeading" class="tb-title-heading-input" data-field="title-heading" value="${esc(state.test?.title || "Untitled test")}" ${state.isLocked?"disabled":""} spellcheck="false" aria-label="Test title">
        <div class="tb-subtle">Status: ${esc(state.isLocked ? "assigned" : (state.test?.status || "draft"))}</div>
      </div>
      <div class="tb-top-actions">
        <label class="tb-overlay"><span>Overlay</span><select class="tb-input tb-small-select" data-field="accessibility-overlay">${ACCESSIBILITY_OPTIONS.map(o => `<option value="${esc(o.value)}" ${state.overlay===o.value?"selected":""}>${esc(o.label)}</option>`).join("")}</select></label>
        <button type="button" class="tb-btn tb-btn-black" data-action="back-dashboard">Back</button>
      </div>
    </div>

    ${state.notice ? `<div class="tb-notice tb-${esc(state.noticeType)}"><span>${esc(state.notice)}</span><button type="button" data-action="dismiss-notice">×</button></div>` : ""}
    ${lockedBanner}

    <section class="tb-card" id="wordListSection">
      <div class="tb-section-head tb-section-head-tight">
        <div><div class="tb-step">1</div><h2>Word List</h2><p>Add or paste words, then refine below.</p></div>
      </div>
      <div class="tb-helper"><div class="tb-helper-grid">
        <label><span>Target grapheme</span><input class="tb-input" data-field="generator-target" value="${esc(state.generator.target)}" ${state.isLocked?"disabled":""} placeholder="e.g. sh"></label>
        <label><span>Theme / topic</span><input class="tb-input" data-field="generator-topic" value="${esc(state.generator.topic)}" ${state.isLocked?"disabled":""} placeholder="e.g. DT materials"></label>
        <label><span>Number of words</span><input type="number" min="1" max="20" class="tb-input" data-field="generator-count" value="${esc(state.generator.count)}" ${state.isLocked?"disabled":""}></label>
        <label><span>Target difficulty</span><select class="tb-input" data-field="generator-difficulty-target" ${state.isLocked?"disabled":""}>${renderDifficultyTargetOptions()}</select></label>
        <label><span>Free prompt</span><input class="tb-input" data-field="generator-prompt" value="${esc(state.generator.prompt)}" ${state.isLocked?"disabled":""} placeholder='Give me 10 words focusing on "sh" related to DT.'></label>
      </div>
      <div class="tb-generator-analytics-row">
        <label class="tb-toggle-pill tb-toggle-pill--wide"><input type="checkbox" data-field="generator-analytics-enabled" ${state.generator.analyticsEnabled?"checked":""} ${state.isLocked?"disabled":""}> <span>Add individualised words from analytics</span></label>
        <label><span>Hidden words per pupil</span><input type="number" min="1" max="10" class="tb-input" data-field="generator-analytics-count" value="${esc(state.generator.analyticsCount)}" ${state.isLocked||!state.generator.analyticsEnabled?"disabled":""}></label>
      </div>
      <div class="tb-subtle">Target difficulty is applied after generation using the in-app research-based word scoring model. Current target: ${esc(targetDifficulty.label)}.</div>
      <div class="tb-subtle">When assigned, these are added automatically for each pupil using their analytics. They stay out of the edit list and only show up through pupil results.</div>
      <div class="tb-actions-row tb-actions-top"><button type="button" class="tb-btn tb-btn-black" data-action="generate-words" ${state.isLocked||state.aiWorking?"disabled":""}>${state.aiWorking?"Generating...":"Generate words"}</button></div></div>
      <label class="tb-field-wide"><span>Add or paste words</span><textarea class="tb-textarea" data-field="word-list" ${state.isLocked?"disabled":""}>${esc(state.wordListText)}</textarea><div class="tb-subtle">Maximum 20 words.</div></label>
    </section>

    <section class="tb-card" id="editWordsSection">
      <div class="tb-section-head">
        <div><div class="tb-step">2</div><h2>Edit words</h2><p>Review words, sentences, graphemes and preview.</p></div>
      </div>
      ${renderDifficultyOverview()}
      <div class="tb-table-tools">
        <div></div>
        <div class="tb-col-action"><button type="button" class="tb-btn tb-btn-black" data-action="suggest-sentences" ${state.isLocked||state.aiWorking?"disabled":""}>${state.aiWorking?"Generating...":"Suggest sentences"}</button></div>
        <div class="tb-col-action"><button type="button" class="tb-btn tb-btn-black" data-action="suggest-splits" ${state.isLocked||state.aiWorking?"disabled":""}>${state.aiWorking?"Generating...":"Suggest splits"}</button></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <div class="tb-table-head"><div>Word</div><div>Sentence</div><div>Grapheme structure</div><div>Focus pattern</div><div>Preview</div><div>Difficulty</div><div>Actions</div></div>
      <div id="tbRowsHost">${renderRows()}</div>
      <div class="tb-table-footer"><button type="button" class="tb-btn tb-btn-black" data-action="add-word" ${(state.isLocked || atWordLimit())?"disabled":""}>+ Add word</button></div>
    </section>

    <section class="tb-card" id="assignmentSection">
      <div class="tb-section-head"><div><div class="tb-step">3</div><h2>Assignment</h2><p>Choose classes and settings.</p></div></div>
      <div class="tb-assign-stack">${renderAssignments()}</div>
    </section>

    <div class="tb-bottom-bar"><div class="tb-saved">${state.saving?"Saving...":state.assigning?"Assigning...":state.isDirty?"Unsaved changes":"Saved ✓"}</div><div class="tb-bottom-actions">${renderBottomBarActions()}</div></div>
  </div>`;
}

function renderRows(){
  if(!state.rows.length) return `<div class="tb-empty">No words yet.</div>`;
  return state.rows.map((row, index) => renderRow(row, index)).join("");
}

function renderDifficultyTargetOptions(){
  return DIFFICULTY_TARGET_OPTIONS
    .map((option) => `<option value="${esc(option.value)}" ${state.generator.difficultyTarget === option.value ? "selected" : ""}>${esc(option.label)}</option>`)
    .join("");
}

function getBuilderDifficultyRows(){
  return limitWords(state.rows.filter(r => r.word)).map((row) => ({
    word: row.word,
    segments: getRowSegmentsForSave(row),
    choice: {
      difficulty: buildPersistedDifficultyPayload({
        word: row.word,
        graphemes: getRowSegmentsForSave(row),
        trickyWord: !!row.trickyWord,
      }),
    },
  }));
}

function renderDifficultyOverview(){
  const summary = buildTestDifficultySummary(getBuilderDifficultyRows());
  const teacherCopy = describeTeacherDifficultyScore();
  const technicalCopy = describeTechnicalDifficultyScore();
  const band = summary.band ? getDifficultyDisplayBand(summary.band) : { label: "Awaiting words", tone: "core" };

  return `
    <section class="tb-difficulty-panel">
      <div class="tb-difficulty-panel-head">
        <div>
          <div class="tb-kicker">Research-based difficulty</div>
          <h3>Test difficulty</h3>
        </div>
        <div class="tb-difficulty-pill tb-difficulty-pill--summary is-${esc(band.tone)}">
          <strong>${summary.score == null ? "--" : esc(String(summary.score))}</strong>
          <span>${esc(summary.score == null ? "Awaiting words" : band.label)}</span>
        </div>
      </div>
      <div class="tb-subtle">This shows the average planning difficulty of the words in this list.</div>
      <details class="tb-difficulty-details">
        <summary>How this score is built</summary>
        <p>${esc(teacherCopy)}</p>
        <p>${esc(technicalCopy)}</p>
        <div class="tb-difficulty-detail-grid">
          <div>
            <strong>Word score components</strong>
            <ul>
              <li>phonemic length</li>
              <li>letter-sound discrepancy</li>
              <li>grapheme-phoneme complexity</li>
              <li>blend load</li>
              <li>irregularity from structural spelling patterns such as silent letters and odd orthographic patterns</li>
              <li>conservative morphology from clear prefixes and suffixes</li>
              <li>teacher-marked tricky words as a separate planning modifier, not part of the core attainment score</li>
            </ul>
          </div>
          <div>
            <strong>Research references</strong>
            <ul>
              ${RESEARCH_DIFFICULTY_REFERENCES.map((item) => `<li><a href="${esc(item.link)}" target="_blank" rel="noreferrer">${esc(item.short)}</a></li>`).join("")}
            </ul>
          </div>
        </div>
      </details>
    </section>
  `;
}

function getWordDifficultyViewModel(row){
  return buildWordDifficultyModel({
    word: row.word,
    graphemes: getRowSegmentsForSave(row),
    trickyWord: !!row.trickyWord,
  });
}

function renderWordDifficultyCell(row, index){
  if(!row.word){
    return `
      <div class="tb-difficulty-cell">
        <div class="tb-difficulty-note">Add a word to calculate its difficulty score.</div>
        <label class="tb-mini-check">
          <input type="checkbox" data-field="row-tricky" data-index="${index}" ${row.trickyWord ? "checked" : ""} ${state.isLocked?"disabled":""}>
          <span>Mark as tricky word</span>
        </label>
      </div>
    `;
  }

  const difficulty = getWordDifficultyViewModel(row);
  const displayBand = getDifficultyDisplayBand(difficulty.band);
  const difficultyReasons = [...(difficulty.reasons || []), ...(difficulty.modifierReasons || [])];
  return `
    <div class="tb-difficulty-cell">
      <div class="tb-difficulty-pill is-${esc(difficulty.band.tone)}">
        <strong>${esc(String(difficulty.score))}</strong>
        <span>${esc(displayBand?.label || difficulty.band.label)}</span>
      </div>
      <div class="tb-difficulty-note">${esc(difficultyReasons.join(", ") || "Mostly familiar spelling structure")}</div>
      <label class="tb-mini-check">
        <input type="checkbox" data-field="row-tricky" data-index="${index}" ${row.trickyWord ? "checked" : ""} ${state.isLocked?"disabled":""}>
        <span>Mark as tricky word</span>
      </label>
    </div>
  `;
}

function renderRow(row, index){
  const graphemes = parseGraphemeInput(row.graphemesText);
  const exceptionNote = row.approvedExceptionActive
    ? `<div class="tb-subtle">Approved exception</div>`
    : "";
  return `<div class="tb-word-row" data-row-index="${index}">
    <div><input class="tb-input" data-field="row-word" data-index="${index}" value="${esc(row.word)}" ${state.isLocked?"disabled":""}>${row.warning?`<div class="tb-warning">${esc(row.warning)}</div>`:""}</div>
    <div><input class="tb-input" data-field="row-sentence" data-index="${index}" value="${esc(row.sentence)}" placeholder="Optional sentence" ${state.isLocked?"disabled":""}></div>
    <div><input class="tb-input" data-field="row-graphemes" data-index="${index}" value="${esc(row.graphemesText)}" ${state.isLocked?"disabled":""}></div>
    <div><input class="tb-input" data-field="row-focus" data-index="${index}" value="${esc(row.focusPattern)}" ${state.isLocked?"disabled":""}></div>
    <div class="tb-preview-cell">${renderPhonicsPreview(row.word, graphemes)}</div>
    ${renderWordDifficultyCell(row, index)}
    <div class="tb-actions-cell">
      <button type="button" class="tb-btn tb-btn-black tb-btn-small" data-action="delete-word" data-index="${index}" ${state.isLocked?"disabled":""}>Delete</button>
      <button type="button" class="tb-btn tb-btn-black tb-btn-small" data-action="approve-exception" data-index="${index}" ${state.isLocked || !row.word || !row.persisted ? "disabled" : ""}>${row.approvedExceptionActive ? "Approved" : "Approve exception"}</button>
      ${exceptionNote}
    </div>
  </div>`;
}

function renderAssignments(){
  const questionType = normalizeStoredQuestionType(state.test?.question_type, {
    title: state.test?.title || "",
  });
  const showLoomSettings = questionType === "spell_loom";
  const showSegmentedSettings = questionType === "segmented_spelling";
  const testTypeCard = `<div class="tb-assign-card">
      <div class="tb-test-settings-grid">
        <label><span>Test type</span><select class="tb-input" data-field="test-question-type" ${state.isLocked ? "disabled" : ""}>${TEST_TYPE_OPTIONS.map(o => `<option value="${esc(o.value)}" ${String(questionType)===o.value?"selected":""}>${esc(o.label)}</option>`).join("")}</select></label>
        ${showLoomSettings ? `<label><span>Decoy bands</span><select class="tb-input" data-field="test-loom-decoy-level" ${state.isLocked ? "disabled" : ""}>${LOOM_DECOY_LEVEL_OPTIONS.map(o => `<option value="${esc(o.value)}" ${normalizeLoomDecoyLevel(state.loomDecoyLevel)===o.value?"selected":""}>${esc(o.label)}</option>`).join("")}</select></label>` : ""}
        ${showSegmentedSettings ? `<label><span>Phonics aids</span><select class="tb-input" data-field="test-segmented-visual-aids" ${state.isLocked ? "disabled" : ""}>${SEGMENTED_VISUAL_AID_OPTIONS.map(o => `<option value="${esc(o.value)}" ${state.segmentedVisualAidsMode===o.value?"selected":""}>${esc(o.label)}</option>`).join("")}</select></label>` : ""}
      </div>
      ${showLoomSettings ? `<div class="tb-subtle">Adds extra grapheme bands to the tray without changing the correct word.</div>` : ""}
      ${showSegmentedSettings ? `<div class="tb-subtle">Keeps the input letter-based. Phonics aids add the existing dot, underline, and split-digraph bridge marks under the boxes.</div>` : ""}
    </div>`;
  if(!state.classes.length) return `${testTypeCard}<div class="tb-empty">No classes yet.</div>`;
  return testTypeCard + state.classes.map(cls => {
    const id = String(cls.id);
    const s = state.assignmentsByClass[id] || { ...DEFAULT_ASSIGN };
    const alreadyAssigned = !!s.assignmentId;
    const isSelected = state.selectedClassIds.has(id);
    const lockedSettings = state.isLocked && alreadyAssigned;
    return `<div class="tb-assign-card">
      <div class="tb-class-check"><label><input type="checkbox" data-field="assign-class" data-class-id="${esc(id)}" ${isSelected?"checked":""}> ${esc(cls.name || "Untitled class")}</label></div>
      <div class="tb-assign-grid">
        <label><span>Attempts per word</span><select class="tb-input" data-field="assignment-attempts" data-class-id="${esc(id)}" ${lockedSettings?"disabled":""}>${ATTEMPT_OPTIONS.map(v => `<option value="${esc(v)}" ${s.maxAttempts===v?"selected":""}>${esc(v)}</option>`).join("")}</select></label>
        <label><span>Deadline</span><input class="tb-input" type="datetime-local" data-field="assignment-deadline" data-class-id="${esc(id)}" value="${esc(s.deadline)}" ${lockedSettings?"disabled":""}></label>
        <label class="tb-toggle-pill"><input type="checkbox" data-field="assignment-audio" data-class-id="${esc(id)}" ${s.audioEnabled?"checked":""} ${lockedSettings?"disabled":""}> <span>Audio</span></label>
        <label class="tb-toggle-pill"><input type="checkbox" data-field="assignment-hints" data-class-id="${esc(id)}" ${s.hintsEnabled?"checked":""} ${lockedSettings?"disabled":""}> <span>Hints</span></label>
      </div>
    </div>`;
  }).join("");
}

function updateRowDom(index, sourceEl = null){
  const host = appEl.querySelector(`[data-row-index="${index}"]`);
  if(!host) return;

  const field = sourceEl?.dataset?.field || null;
  const selectionStart = typeof sourceEl?.selectionStart === "number" ? sourceEl.selectionStart : null;
  const selectionEnd = typeof sourceEl?.selectionEnd === "number" ? sourceEl.selectionEnd : null;

  host.outerHTML = renderRow(state.rows[index], index);
  paintDifficultyOverview();

  if(field){
    requestAnimationFrame(() => {
      const replacement = appEl.querySelector(`[data-row-index="${index}"] [data-field="${field}"]`);
      if(replacement instanceof HTMLInputElement){
        replacement.focus();
        if(selectionStart != null && selectionEnd != null){
          replacement.setSelectionRange(selectionStart, selectionEnd);
        }
      }
    });
  }
}

function replaceRowsDom(){
  const host = appEl.querySelector('#tbRowsHost');
  if(host) host.innerHTML = renderRows();
  syncWordListTextFromRows();
  paintDifficultyOverview();
  paintBottomBar();
}

function paintDifficultyOverview(){
  const panel = appEl.querySelector('.tb-difficulty-panel');
  if(panel) panel.outerHTML = renderDifficultyOverview();
}

function updateActionButtons(){
  for(const btn of appEl.querySelectorAll('[data-action="generate-words"],[data-action="suggest-sentences"],[data-action="suggest-splits"]')){
    btn.disabled = state.isLocked || state.aiWorking;
  }
}

function paintBottomBar(){
  const bar = appEl.querySelector('.tb-bottom-bar');
  if(bar){
    bar.outerHTML = `<div class="tb-bottom-bar"><div class="tb-saved">${state.saving?"Saving...":state.assigning?"Assigning...":state.isDirty?"Unsaved changes":"Saved ✓"}</div><div class="tb-bottom-actions">${renderBottomBarActions()}</div></div>`;
  }
}

function renderBottomBarActions(){
  if(state.isLocked){
    return (getSelectedAssignableClassIds().length || getDeselectedAssignedClassIds().length || getUpdatedAssignedClassIds().length) ? `<button type="button" class="tb-btn tb-btn-black" data-action="assign-test">Update assignments</button>` : "";
  }
  return `<button type="button" class="tb-btn tb-btn-black" data-action="save-draft">Save draft</button><button type="button" class="tb-btn tb-btn-black" data-action="assign-test">Assign to class</button>`;
}

function getSelectedAssignableClassIds(){
  return [...state.selectedClassIds].filter(classId => !state.assignmentsByClass[classId]?.assignmentId);
}

function getDeselectedAssignedClassIds(){
  return Object.entries(state.assignmentsByClass)
    .filter(([, value]) => !!value?.assignmentId)
    .map(([classId]) => classId)
    .filter(classId => !state.selectedClassIds.has(classId));
}

function getUpdatedAssignedClassIds(){
  return Object.entries(state.assignmentsByClass)
    .filter(([classId, value]) => {
      if(!value?.assignmentId) return false;
      if(!state.selectedClassIds.has(classId)) return false;
      const baseline = state.assignmentBaselineByClass[classId] || null;
      if(!baseline?.assignmentId) return false;
      return JSON.stringify({
        maxAttempts: String(value.maxAttempts ?? ""),
        deadline: String(value.deadline ?? ""),
        audioEnabled: !!value.audioEnabled,
        hintsEnabled: !!value.hintsEnabled,
      }) !== JSON.stringify({
        maxAttempts: String(baseline.maxAttempts ?? ""),
        deadline: String(baseline.deadline ?? ""),
        audioEnabled: !!baseline.audioEnabled,
        hintsEnabled: !!baseline.hintsEnabled,
      });
    })
    .map(([classId]) => classId);
}

function limitWords(words){
  return (Array.isArray(words) ? words : []).slice(0, MAX_TEST_WORDS);
}

function mergeUniqueWords(words){
  const merged = [];
  const seen = new Set();
  for (const word of Array.isArray(words) ? words : []) {
    const clean = String(word || "").trim().toLowerCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    merged.push(clean);
    if(merged.length >= MAX_TEST_WORDS) break;
  }
  return merged;
}

function clampWordCount(value){
  const num = Number(value);
  if(!Number.isFinite(num)) return 10;
  return Math.max(1, Math.min(MAX_TEST_WORDS, Math.round(num)));
}

function detectPromptRequestedWordCount(prompt){
  const text = String(prompt || "").trim().toLowerCase();
  if(!text) return null;
  const digitMatch = text.match(/\b(\d{1,2})\s+words?\b/);
  if(digitMatch) return clampWordCount(digitMatch[1]);
  const numberWords = {
    one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
    eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20
  };
  for (const [word, value] of Object.entries(numberWords)) {
    if(new RegExp(`\\b${word}\\s+words?\\b`).test(text)) return value;
  }
  return null;
}

function paintNotice(){ paint(); }
function paintFloating(){ paint(); }

function applyOverlay(){
  document.body.classList.remove('ov-cream','ov-blue','ov-green','ov-yellow');
  if(state.overlay !== 'default') document.body.classList.add(`ov-${state.overlay}`);
}

function toLocalDateTimeInput(value){
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function esc(str){
  return String(str ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function injectStyles(){
  if(document.getElementById('tb5-styles')) return;
  const style = document.createElement('style');
  style.id = 'tb5-styles';
  style.textContent = `
    :root{--tb-bg:#f4f7fb;--tb-card:#fff;--tb-line:#d9e2ec;--tb-text:#122033;--tb-muted:#64748b;--tb-black:#0f172a;--tb-grey:#94a3b8;--tb-orange:#f59e0b;--tb-shadow:0 12px 30px rgba(15,23,42,.07)}
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:var(--tb-bg);color:var(--tb-text)}
    body.ov-cream{background:#f8f2df} body.ov-blue{background:#eaf4ff} body.ov-green{background:#edf9ee} body.ov-yellow{background:#fff9d9}
    .tb-wrap{width:min(1460px,100%);margin:0 auto;padding:20px 20px 110px}
    .tb-topbar{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}
    .tb-topbar h1{margin:6px 0 0;font-size:34px;font-weight:800}
    .tb-kicker,.tb-step{display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b}
    .tb-step{width:30px;height:30px;border-radius:999px;background:#e6eef7;margin-bottom:10px}
    .tb-subtle{color:var(--tb-muted);margin-top:6px}
    .tb-top-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .tb-overlay{display:flex;gap:8px;align-items:center}
    .tb-small-select{min-width:140px}
    .tb-card{background:var(--tb-card);border:1px solid var(--tb-line);border-radius:24px;box-shadow:var(--tb-shadow);padding:20px;margin-bottom:16px}
    .tb-section-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}.tb-section-head-tight{align-items:center}
    .tb-section-head h2{margin:4px 0 4px;font-size:26px}.tb-section-head p{margin:0;color:var(--tb-muted)}
    .tb-title-heading-input{margin:6px 0 0;padding:0;border:none;background:transparent;color:var(--tb-text);font-size:34px;font-weight:800;line-height:1.3;outline:none;width:min(900px,100%)}
.tb-title-heading-input:focus{box-shadow:none;border:none}
    .tb-field-wide{display:block}.tb-field-wide span,label span{display:block;font-size:13px;color:var(--tb-muted);font-weight:700;margin:0 0 6px}
    .tb-input,.tb-textarea{width:100%;border:1px solid var(--tb-line);border-radius:16px;padding:12px 14px;font-size:15px;background:#fff;outline:none;box-sizing:border-box}
    select.tb-input{appearance:none;-webkit-appearance:none;min-height:48px;border-radius:999px;padding-right:44px;background-color:#f8fafc;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14' fill='none'%3E%3Cpath d='M3.25 5.5L7 9.25L10.75 5.5' stroke='%23475569' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 16px center;background-size:14px 14px;cursor:pointer}
    .tb-input:focus,.tb-textarea:focus{border-color:#93c5fd;box-shadow:0 0 0 4px rgba(59,130,246,.12)}
    .tb-textarea{min-height:140px;resize:vertical}
    .tb-btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 16px;border-radius:14px;border:none;font-weight:800;cursor:pointer}.tb-btn:disabled{opacity:.6;cursor:not-allowed}
    .tb-btn-black{background:var(--tb-black);color:#fff}.tb-btn-ghost{background:#fff;border:1px solid var(--tb-line);color:var(--tb-text)}.tb-btn-small{height:38px;padding:0 14px}
    .tb-actions-row{display:flex;gap:10px;flex-wrap:wrap}.tb-actions-top{margin-top:14px}
    .tb-helper{border:1px dashed var(--tb-line);border-radius:18px;padding:14px;background:#fbfdff;margin-bottom:14px}.tb-helper-grid,.tb-test-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tb-helper-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.tb-generator-analytics-row{display:grid;grid-template-columns:minmax(240px,1.4fr) minmax(180px,.8fr);gap:12px;align-items:end;margin-top:12px}
    .tb-table-tools,.tb-table-head,.tb-word-row{display:grid;grid-template-columns:180px minmax(220px,1.3fr) minmax(220px,1.05fr) 120px minmax(220px,.95fr) minmax(210px,.88fr) minmax(156px,.62fr);gap:12px;align-items:start}
    .tb-table-tools{margin-bottom:10px}.tb-col-action{display:flex;justify-content:flex-start}
    .tb-table-head{font-weight:800;color:#64748b;border-bottom:1px solid var(--tb-line);padding:0 4px 10px}.tb-word-row{padding:12px 4px;border-bottom:1px solid var(--tb-line)}
    .tb-preview-cell{min-height:74px;display:flex;align-items:center;overflow:hidden}.tb-actions-cell{display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch;gap:8px;min-height:44px;min-width:0;width:min(168px,100%);margin-left:auto}.tb-actions-cell .tb-btn{width:100%;max-width:100%;white-space:normal;text-align:center;justify-content:center;line-height:1.15;padding:10px 12px}
    .tb-difficulty-panel{border:1px solid var(--tb-line);border-radius:20px;padding:16px 18px;background:#f8fbff;margin-bottom:16px}
    .tb-difficulty-panel-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
    .tb-difficulty-panel h3{margin:4px 0 6px;font-size:24px}
    .tb-difficulty-panel p{margin:0;color:var(--tb-muted);line-height:1.55}
    .tb-difficulty-pill{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px 12px;border-radius:16px;border:1px solid #dbe3ee;background:#fff;max-width:min(190px,100%)}
    .tb-difficulty-pill strong{font-size:1.3rem;line-height:1;color:#0f172a}
    .tb-difficulty-pill span{font-size:.86rem;font-weight:800;color:#475569;letter-spacing:.02em;white-space:normal;word-break:normal;overflow-wrap:break-word;hyphens:none;text-wrap:balance;text-overflow:clip}
    .tb-difficulty-pill.is-easier{background:#ecfdf3;border-color:#bbf7d0}.tb-difficulty-pill.is-easier strong,.tb-difficulty-pill.is-easier span{color:#166534}
    .tb-difficulty-pill.is-core{background:#eff6ff;border-color:#bfdbfe}.tb-difficulty-pill.is-core strong,.tb-difficulty-pill.is-core span{color:#1d4ed8}
    .tb-difficulty-pill.is-stretch{background:#fff7ed;border-color:#fed7aa}.tb-difficulty-pill.is-stretch strong,.tb-difficulty-pill.is-stretch span{color:#b45309}
    .tb-difficulty-pill.is-challenge{background:#fff1f2;border-color:#fecdd3}.tb-difficulty-pill.is-challenge strong,.tb-difficulty-pill.is-challenge span{color:#be123c}
    .tb-difficulty-pill--summary{min-width:140px}
    .tb-difficulty-details{margin-top:14px;border-top:1px solid var(--tb-line);padding-top:14px}
    .tb-difficulty-details summary{cursor:pointer;font-weight:800;color:#0f172a}
    .tb-difficulty-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:12px}
    .tb-difficulty-detail-grid strong{display:block;margin-bottom:8px}
    .tb-difficulty-detail-grid ul{margin:0;padding-left:18px;color:#334155;line-height:1.6}
    .tb-difficulty-detail-grid a{color:#1d4ed8;text-decoration:none}
    .tb-difficulty-detail-grid a:hover,.tb-difficulty-detail-grid a:focus-visible{text-decoration:underline}
    .tb-difficulty-cell{display:flex;flex-direction:column;gap:8px;min-height:74px}
    .tb-difficulty-note{color:#64748b;font-size:.84rem;line-height:1.45}
    .tb-mini-check{display:inline-flex;gap:8px;align-items:flex-start;color:#334155;font-size:.85rem;font-weight:700}
    .tb-mini-check input{margin-top:2px}
    .tb-table-footer{padding-top:14px;display:flex;justify-content:flex-end}
    .tb-warning{margin-top:6px;font-size:12px;color:#b45309;background:#fff7ed;padding:6px 8px;border-radius:10px}.tb-empty{color:var(--tb-muted);padding:12px 0}
    .tb-assign-stack{display:flex;flex-direction:column;gap:12px}.tb-assign-card{border:1px solid var(--tb-line);border-radius:18px;padding:14px;background:#fbfdff}
    .tb-class-check{display:flex;gap:10px;align-items:center;font-weight:800;margin-bottom:10px}
    .tb-assign-grid{display:grid;grid-template-columns:minmax(160px,.8fr) minmax(220px,1fr) auto auto;gap:12px;align-items:end}
    .tb-toggle-pill{display:inline-flex;gap:8px;align-items:center;justify-content:center;height:46px;padding:0 16px;border:1px solid var(--tb-line);border-radius:16px;background:#fff;font-weight:700;white-space:nowrap}.tb-toggle-pill--wide{justify-content:flex-start}
    .tb-bottom-bar{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid var(--tb-line);display:flex;justify-content:space-between;gap:16px;align-items:center;padding:14px 18px;z-index:20}.tb-bottom-actions{display:flex;gap:10px}.tb-saved{font-weight:800;color:#334155}
    .tb-notice{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px 14px;border-radius:16px;border:1px solid var(--tb-line);margin-bottom:16px;background:#fff}.tb-success{background:#ecfdf5;border-color:#86efac}.tb-error{background:#fef2f2;border-color:#fecaca}
    .tb-lock-banner{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:14px 16px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;margin-bottom:16px}.tb-lock-actions{display:flex;gap:10px;flex-wrap:wrap}
    .tb-floating{position:sticky;top:16px;z-index:30;display:flex;justify-content:space-between;align-items:center;gap:12px;background:#0f766e;color:#fff;padding:12px 16px;border-radius:16px;margin-bottom:14px;box-shadow:var(--tb-shadow)}
    .tb-floating button,.tb-notice button{background:transparent;border:none;font-size:20px;cursor:pointer;color:inherit}
    .pr-scroll{overflow-x:auto;overflow-y:hidden;max-width:100%;padding-bottom:2px}.pr-wrap{display:inline-grid;grid-template-rows:auto auto;row-gap:6px;min-width:max-content}.pr-letters,.pr-marks{display:grid;grid-template-columns:repeat(var(--pr-cols),minmax(24px,24px));column-gap:8px;align-items:start}.pr-cell{text-align:center;font-weight:800;font-size:18px;min-width:24px}.pr-dot{width:10px;height:10px;border-radius:999px;background:var(--tb-grey);justify-self:center;align-self:start;margin-top:1px}.pr-dot-orange{background:var(--tb-orange);margin-top:1px}.pr-underline{height:4px;background:var(--tb-orange);border-radius:999px;align-self:start;margin-top:5px}.pr-bridge{height:16px;border-bottom:4px solid var(--tb-orange);border-left:4px solid var(--tb-orange);border-right:4px solid var(--tb-orange);border-bottom-left-radius:14px;border-bottom-right-radius:14px;align-self:start;margin-top:1px}
    @media (max-width:1280px){.tb-helper-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tb-generator-analytics-row,.tb-assign-grid,.tb-difficulty-detail-grid{grid-template-columns:1fr 1fr}.tb-table-tools,.tb-table-head,.tb-word-row{grid-template-columns:1fr}}
    @media (max-width:760px){.tb-wrap{padding:14px 14px 120px}.tb-topbar,.tb-section-head,.tb-lock-banner,.tb-difficulty-panel-head{flex-direction:column;align-items:stretch}.tb-bottom-bar{flex-direction:column;align-items:stretch}.tb-bottom-actions{width:100%}.tb-bottom-actions .tb-btn{flex:1}.tb-helper-grid,.tb-test-settings-grid,.tb-generator-analytics-row,.tb-assign-grid,.tb-difficulty-detail-grid{grid-template-columns:1fr}.tb-table-footer{justify-content:stretch}}
  `;
  document.head.appendChild(style);
}
