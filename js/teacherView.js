import { escapeHtml, setNotice } from "./ui.js";
import {
  teacherListTests, teacherCreateTest, teacherAddWords, teacherGetTestWords,
  teacherListClasses, teacherCreateClass, teacherListPupils, teacherAddPupil,
  teacherAssignTestToClass, teacherListAssignments
} from "./db.js";
import { mountGame } from "./game.js";

export async function mountTeacherDashboard(host){
  host.innerHTML = `
    <h2>Teacher dashboard</h2>
    <p class="muted">Create tests, add words, restrict graphemes, then assign to classes.</p>

    <div class="hr"></div>

    <div class="grid2">
      <div>
        <h2>Create test</h2>
        <label>Test title</label>
        <input id="tTitle" class="input" placeholder="e.g. Week 3 – ay/ai" />

        <label>Allowed graphemes (optional)</label>
        <textarea id="tGraphemes" class="textarea" placeholder="Comma-separated, e.g. ai, ay, a-e"></textarea>

        <div class="row">
          <button id="btnCreateTest" class="btn" type="button">Create test</button>
        </div>

        <div id="msgCreate" class="notice" style="display:none;"></div>
      </div>

      <div>
        <h2>Load existing</h2>
        <label>Select test</label>
        <select id="selTest" class="select"></select>

        <div class="row">
          <button id="btnLoadTest" class="btn secondary" type="button">Load</button>
          <button id="btnPreview" class="btn secondary" type="button">Preview</button>
        </div>

        <div id="msgLoad" class="notice" style="display:none;"></div>
      </div>
    </div>

    <div class="hr"></div>

    <h2>Add words</h2>
    <div class="grid2">
      <div>
        <label>Word</label>
        <input id="wWord" class="input" placeholder="e.g. bright" />
      </div>
      <div>
        <label>Sentence (optional)</label>
        <input id="wSentence" class="input" placeholder="e.g. The light is bright." />
      </div>
    </div>

    <label>Segments (slash separated)</label>
    <input id="wSegments" class="input" placeholder="e.g. b/r/igh/t" />

    <div class="row">
      <button id="btnAddWord" class="btn secondary" type="button">Add word to draft</button>
      <button id="btnSaveWords" class="btn" type="button">Save draft to Supabase</button>
    </div>

    <div id="msgWords" class="notice" style="display:none;"></div>

    <div class="hr"></div>

    <h2>Draft words</h2>
    <table class="table" id="draftTable">
      <thead><tr><th>#</th><th>Word</th><th>Segments</th><th>Sentence</th></tr></thead>
      <tbody id="draftBody"></tbody>
    </table>

    <div class="hr"></div>

    <div class="grid2">
      <div>
        <h2>Classes</h2>
        <label>New class name</label>
        <input id="cName" class="input" placeholder="e.g. 7A" />
        <div class="row">
          <button id="btnCreateClass" class="btn" type="button">Create class</button>
        </div>

        <label>Load class</label>
        <select id="selClass" class="select"></select>

        <div id="msgClass" class="notice" style="display:none;"></div>
      </div>

      <div>
        <h2>Assign test</h2>
        <p class="muted">Assign the selected test to the selected class.</p>
        <div class="row">
          <button id="btnAssign" class="btn" type="button">Assign</button>
        </div>
        <div id="msgAssign" class="notice" style="display:none;"></div>

        <div class="hr"></div>

        <h2>Pupils</h2>
        <label>Pupil name (optional)</label>
        <input id="pName" class="input" placeholder="e.g. Harrison" />
        <div class="row">
          <button id="btnAddPupil" class="btn secondary" type="button">Add pupil</button>
        </div>
        <div id="msgPupil" class="notice" style="display:none;"></div>
      </div>
    </div>

    <div class="hr"></div>

    <div class="grid2">
      <div>
        <h2>Class pupils</h2>
        <table class="table">
          <thead><tr><th>Name</th><th>Pupil code</th></tr></thead>
          <tbody id="pupilList"></tbody>
        </table>
      </div>
      <div>
        <h2>Assigned tests</h2>
        <table class="table">
          <thead><tr><th>Test</th></tr></thead>
          <tbody id="assignList"></tbody>
        </table>
      </div>
    </div>

    <div class="hr"></div>

    <div id="previewHost"></div>
  `;

  const $ = (id)=>host.querySelector(`#${id}`);

  const tTitle = $("tTitle");
  const tGraphemes = $("tGraphemes");
  const btnCreateTest = $("btnCreateTest");
  const msgCreate = $("msgCreate");

  const selTest = $("selTest");
  const btnLoadTest = $("btnLoadTest");
  const btnPreview = $("btnPreview");
  const msgLoad = $("msgLoad");

  const wWord = $("wWord");
  const wSentence = $("wSentence");
  const wSegments = $("wSegments");
  const btnAddWord = $("btnAddWord");
  const btnSaveWords = $("btnSaveWords");
  const msgWords = $("msgWords");
  const draftBody = $("draftBody");

  const cName = $("cName");
  const btnCreateClass = $("btnCreateClass");
  const selClass = $("selClass");
  const msgClass = $("msgClass");

  const btnAssign = $("btnAssign");
  const msgAssign = $("msgAssign");

  const pName = $("pName");
  const btnAddPupil = $("btnAddPupil");
  const msgPupil = $("msgPupil");

  const pupilList = $("pupilList");
  const assignList = $("assignList");

  const previewHost = $("previewHost");

  let currentTestId = null;
  let currentTestMeta = null;
  let draft = [];

  async function refreshTests(){
    const tests = await teacherListTests();
    selTest.innerHTML = tests.map(t=>`<option value="${t.id}">${escapeHtml(t.title)}</option>`).join("");
    if (tests.length){
      currentTestId = selTest.value;
    }
  }

  async function refreshClasses(){
    const classes = await teacherListClasses();
    selClass.innerHTML = classes.map(c=>`<option value="${c.id}" data-code="${c.class_code}">${escapeHtml(c.name)} (${c.class_code})</option>`).join("");
  }

  function renderDraft(){
    draftBody.innerHTML = draft.map((d,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${escapeHtml(d.word)}</td>
        <td><code>${escapeHtml(d.segments.join("/"))}</code></td>
        <td>${escapeHtml(d.sentence || "")}</td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="muted">No draft words yet.</td></tr>`;
  }

  async function loadSelectedTest(){
    currentTestId = selTest.value;
    const tests = await teacherListTests();
    currentTestMeta = tests.find(t=>t.id === currentTestId) || null;
    setNotice(msgLoad, currentTestMeta ? `Loaded: ${currentTestMeta.title}` : "Could not load test.");
  }

  btnCreateTest.addEventListener("click", async ()=>{
    try{
      const title = (tTitle.value || "").trim();
      if (!title) return setNotice(msgCreate, "Add a title first.");
      const allowed = (tGraphemes.value || "")
        .split(",")
        .map(s=>s.trim())
        .filter(Boolean);
      const id = await teacherCreateTest(title, allowed);
      setNotice(msgCreate, "Test created.");
      await refreshTests();
      selTest.value = id;
      await loadSelectedTest();
    }catch(e){
      setNotice(msgCreate, e.message);
    }
  });

  btnLoadTest.addEventListener("click", async ()=>{
    try{
      await loadSelectedTest();
    }catch(e){
      setNotice(msgLoad, e.message);
    }
  });

  btnAddWord.addEventListener("click", ()=>{
    const word = (wWord.value||"").trim();
    if (!word) return setNotice(msgWords, "Add a word first.");
    const segments = (wSegments.value||"")
      .split("/")
      .map(s=>s.trim())
      .filter(Boolean);
    if (!segments.length) return setNotice(msgWords, "Add segments like b/r/igh/t");
    draft.push({
      position: draft.length + 1,
      word,
      sentence: (wSentence.value||"").trim(),
      segments
    });
    wWord.value = "";
    wSentence.value = "";
    wSegments.value = "";
    setNotice(msgWords, null);
    renderDraft();
  });

  btnSaveWords.addEventListener("click", async ()=>{
    try{
      if (!currentTestId) return setNotice(msgWords, "Load or create a test first.");
      if (!draft.length) return setNotice(msgWords, "No draft words yet.");
      await teacherAddWords(currentTestId, draft);
      draft = [];
      renderDraft();
      setNotice(msgWords, "Saved to Supabase.");
    }catch(e){
      setNotice(msgWords, e.message);
    }
  });

  btnCreateClass.addEventListener("click", async ()=>{
    try{
      const name = (cName.value||"").trim();
      if (!name) return setNotice(msgClass, "Enter a class name first.");
      const res = await teacherCreateClass(name);
      setNotice(msgClass, `Class created. Code: ${res.class_code}`);
      cName.value = "";
      await refreshClasses();
      selClass.value = res.id;
      await refreshClassPanels();
    }catch(e){
      setNotice(msgClass, e.message);
    }
  });

  async function refreshClassPanels(){
    const classId = selClass.value;
    if (!classId) return;

    const pupils = await teacherListPupils(classId);
    pupilList.innerHTML = pupils.map(p=>`
      <tr><td>${escapeHtml(p.name || "")}</td><td><b>${escapeHtml(p.pupil_code)}</b></td></tr>
    `).join("") || `<tr><td colspan="2" class="muted">No pupils yet.</td></tr>`;

    const assigns = await teacherListAssignments(classId);
    assignList.innerHTML = assigns.map(a=>`
      <tr><td>${escapeHtml(a.tests?.title || a.test_id)}</td></tr>
    `).join("") || `<tr><td class="muted">No tests assigned yet.</td></tr>`;
  }

  selClass.addEventListener("change", refreshClassPanels);

  btnAddPupil.addEventListener("click", async ()=>{
    try{
      const classId = selClass.value;
      if (!classId) return setNotice(msgPupil, "Select a class first.");
      const res = await teacherAddPupil(classId, (pName.value||"").trim());
      setNotice(msgPupil, `Pupil added. Code: ${res.pupil_code}`);
      pName.value = "";
      await refreshClassPanels();
    }catch(e){
      setNotice(msgPupil, e.message);
    }
  });

  btnAssign.addEventListener("click", async ()=>{
    try{
      const classId = selClass.value;
      const testId = selTest.value;
      if (!classId) return setNotice(msgAssign, "Select a class first.");
      if (!testId) return setNotice(msgAssign, "Select a test first.");
      await teacherAssignTestToClass(classId, testId);
      setNotice(msgAssign, "Assigned.");
      await refreshClassPanels();
    }catch(e){
      setNotice(msgAssign, e.message);
    }
  });

  btnPreview.addEventListener("click", async ()=>{
    try{
      await loadSelectedTest();
      if (!currentTestId) return;
      const words = await teacherGetTestWords(currentTestId);
      if (!words.length) return setNotice(msgLoad, "This test has no words yet.");
      previewHost.innerHTML = `<div class="hr"></div><h2>Preview</h2><div id="previewGame"></div>`;
      const previewGame = previewHost.querySelector("#previewGame");
      mountGame({
        host: previewGame,
        words,
        testMeta: { id: currentTestId, allowed_graphemes: currentTestMeta?.allowed_graphemes || null },
        pupilId: null,
        onExit: ()=>{ previewHost.innerHTML = ""; }
      });
    }catch(e){
      setNotice(msgLoad, e.message);
    }
  });

  // init
  await refreshTests();
  await refreshClasses();
  await loadSelectedTest();
  renderDraft();
  await refreshClassPanels();
}
