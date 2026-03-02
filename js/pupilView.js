import { escapeHtml, setNotice } from "./ui.js";
import { pupilGetAssignedTests, pupilGetTestWords } from "./db.js";
import { mountGame } from "./game.js";

export async function mountPupilApp(host, pupilState){
  host.innerHTML = `
    <h2>Pupil practice</h2>
    <p class="muted">Choose a test and start.</p>

    <label>Assigned tests</label>
    <select id="selAssigned" class="select"></select>

    <div class="row">
      <button id="btnStart" class="btn" type="button">Start test</button>
      <button id="btnLogout" class="btn secondary" type="button">Log out</button>
    </div>

    <div id="msg" class="notice" style="display:none;"></div>

    <div class="hr"></div>
    <div id="gameHost"></div>
  `;

  const $ = (id)=>host.querySelector(`#${id}`);
  const selAssigned = $("selAssigned");
  const btnStart = $("btnStart");
  const btnLogout = $("btnLogout");
  const msg = $("msg");
  const gameHost = $("gameHost");

  async function loadAssigned(){
    const tests = await pupilGetAssignedTests();
    selAssigned.innerHTML = tests.map(t=>`
      <option value="${t.test_id}" data-gr="${escapeHtml(JSON.stringify(t.allowed_graphemes || null))}">
        ${escapeHtml(t.title)}
      </option>
    `).join("");

    if (!tests.length){
      setNotice(msg, "No tests assigned to your class yet. Ask your teacher.");
    } else {
      setNotice(msg, null);
    }
    return tests;
  }

  btnStart.addEventListener("click", async ()=>{
    try{
      const testId = selAssigned.value;
      if (!testId) return setNotice(msg, "No assigned tests yet.");
      const tests = await pupilGetAssignedTests();
      const meta = tests.find(t=>t.test_id === testId);
      const words = await pupilGetTestWords(testId);
      if (!words.length) return setNotice(msg, "This test has no words yet.");

      gameHost.innerHTML = "";
      mountGame({
        host: gameHost,
        words,
        testMeta: { id: testId, allowed_graphemes: meta?.allowed_graphemes || null },
        pupilId: pupilState.pupil_id,
        onExit: ()=>{ gameHost.innerHTML = ""; }
      });
    }catch(e){
      setNotice(msg, e.message);
    }
  });

  btnLogout.addEventListener("click", ()=>{
    localStorage.removeItem("ps_pupil_v1");
    window.location.reload();
  });

  await loadAssigned();
}
