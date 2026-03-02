import { escapeHtml } from "./ui.js";
import { createScrollMode } from "./modes_scroll.js";
import { pupilRecordAttempt } from "./db.js";

export function mountGame({
  host,
  words,
  testMeta,
  pupilId,   // null for teacher preview
  onExit
}){
  let mode = "guided"; // guided | scroll | recall | dictation
  let idx = 0;
  let score = 0;
  let attempts = 0;

  let scrollState = null;

  host.innerHTML = `
    <div class="gameTop">
      <div>Word <b id="wNum">1</b> of <b id="wTot">0</b></div>
      <div class="pills">
        <span class="pill">Mode
          <select id="modeSel" class="select" style="width:auto; display:inline-block; margin-left:8px;">
            <option value="guided">Guided encoding</option>
            <option value="scroll">Grapheme scroll</option>
            <option value="recall">Full recall</option>
            <option value="dictation">Dictation sentence</option>
          </select>
        </span>
        <span class="pill">Score: <b id="score">0</b></span>
      </div>
    </div>

    <div class="hr"></div>

    <div class="center">
      <div id="sentence" class="muted" style="display:none; text-align:center;"></div>
      <div id="main"></div>

      <div class="row">
        <button id="btnListen" class="btn secondary" type="button">🔊 Listen</button>
        <button id="btnCheck" class="btn" type="button">Check word</button>
        <button id="btnNext" class="btn secondary" type="button" style="display:none;">Next</button>
        <button id="btnExit" class="btn secondary" type="button">Exit</button>
      </div>

      <div id="feedback" class="feedback"></div>
    </div>
  `;

  const $ = (id)=>host.querySelector(`#${id}`);
  const wNum = $("wNum");
  const wTot = $("wTot");
  const scoreEl = $("score");
  const modeSel = $("modeSel");
  const sentence = $("sentence");
  const main = $("main");
  const feedback = $("feedback");
  const btnListen = $("btnListen");
  const btnCheck = $("btnCheck");
  const btnNext = $("btnNext");
  const btnExit = $("btnExit");

  wTot.textContent = String(words.length);

  function setTop(){
    wNum.textContent = String(idx+1);
    scoreEl.textContent = String(score);
  }

  function speak(text){
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const preferred = voices.find(v => /en-GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
  }

  function currentItem(){ return words[idx]; }

  function render(){
    attempts = 0;
    btnNext.style.display = "none";
    feedback.textContent = "";
    setTop();

    const item = currentItem();
    sentence.style.display = (mode === "dictation") ? "block" : "none";
    sentence.innerHTML = (mode === "dictation")
      ? `Dictation sentence:<br><b>${escapeHtml(item.sentence || "")}</b>`
      : "";

    if (mode === "guided") renderGuided(item);
    else if (mode === "scroll") renderScroll(item);
    else renderRecall(item);
  }

  function renderGuided(item){
    const segs = Array.isArray(item.segments) ? item.segments : [];
    if (!segs.length){ renderRecall(item); return; }

    main.innerHTML = `
      <div class="muted" style="text-align:center;">Fill each sound slot.</div>
      <div class="row" style="justify-content:center; margin-top:10px;">
        ${segs.map((_,i)=>`<input class="input" data-i="${i}" style="width:110px; font-family:var(--mono); text-align:center; font-weight:800;" placeholder="___">`).join('<span class="muted">/</span>')}
      </div>
    `;
    const inputs = [...main.querySelectorAll("input[data-i]")];
    inputs[0]?.focus();
  }

  function renderScroll(item){
    const segs = Array.isArray(item.segments) ? item.segments : [];
    if (!segs.length){ renderRecall(item); return; }

    scrollState = createScrollMode({
      item,
      allowedGraphemes: testMeta?.allowed_graphemes || null
    });

    main.innerHTML = `<div class="bigLetters" id="big"></div>`;
    const big = main.querySelector("#big");

    function setActive(i){
      scrollState.setActive(i);
      [...big.querySelectorAll(".scrollSlot")].forEach(x=>x.classList.remove("active"));
      const node = big.querySelector(`[data-i="${i}"]`);
      if (node) node.classList.add("active");
    }

    function bump(i, dir){
      scrollState.bump(i, dir);
      const node = big.querySelector(`[data-i="${i}"]`);
      const val = node?.querySelector(".scrollVal");
      if (val) val.textContent = scrollState.values[i] || "—";
    }

    big.innerHTML = segs.map((_,i)=>{
      if (i === scrollState.active){
        return `
          <div class="scrollSlot active" data-i="${i}">
            <div class="scrollArrow up">⌃</div>
            <div class="scrollVal">${escapeHtml(scrollState.values[i] || "—")}</div>
            <div class="scrollArrow down">⌄</div>
          </div>
        `;
      }
      return `<div class="bigLetter" data-i="${i}">${escapeHtml(scrollState.values[i] || "—")}</div>`;
    }).join("");

    // click to activate + wheel to scroll
    [...big.children].forEach((el)=>{
      const i = Number(el.getAttribute("data-i"));
      el.addEventListener("click", ()=> setActive(i));
      el.addEventListener("wheel", (e)=>{
        e.preventDefault();
        bump(i, Math.sign(e.deltaY));
      }, { passive:false });

      const up = el.querySelector?.(".scrollArrow.up");
      const down = el.querySelector?.(".scrollArrow.down");
      if (up) up.addEventListener("click",(e)=>{ e.stopPropagation(); bump(i,-1); });
      if (down) down.addEventListener("click",(e)=>{ e.stopPropagation(); bump(i,+1); });
    });

    // keyboard
    window.onkeydown = (e)=>{
      if (modeSel.value !== "scroll") return;
      const a = scrollState.active;
      if (e.key === "ArrowLeft"){ e.preventDefault(); setActive(Math.max(0,a-1)); }
      if (e.key === "ArrowRight"){ e.preventDefault(); setActive(Math.min(segs.length-1,a+1)); }
      if (e.key === "ArrowUp"){ e.preventDefault(); bump(a,-1); }
      if (e.key === "ArrowDown"){ e.preventDefault(); bump(a,+1); }
      if (e.key === "Enter"){ e.preventDefault(); check(); }
    };
  }

  function renderRecall(item){
    main.innerHTML = `
      <div class="muted" style="text-align:center;">Type the whole word.</div>
      <div class="row" style="justify-content:center; margin-top:10px;">
        <input id="recall" class="input" style="width:min(520px, 92%); font-family:var(--mono); text-align:center; font-weight:900; letter-spacing:.08em; font-size:18px;">
      </div>
    `;
    main.querySelector("#recall")?.focus();
  }

  async function recordAttempt(correct, typed){
    if (!pupilId) return; // teacher preview doesn't record
    const item = currentItem();
    await pupilRecordAttempt({
      pupilId,
      testId: testMeta.id,
      testWordId: item.id,
      mode,
      typed,
      correct
    });
  }

  async function check(){
    const item = currentItem();
    const correctWord = String(item.word || "").trim().toLowerCase();

    let typed = "";
    if (mode === "guided"){
      const inputs = [...main.querySelectorAll("input[data-i]")];
      typed = inputs.map(i => (i.value||"").trim()).join("");
    } else if (mode === "scroll"){
      typed = (scrollState?.values || []).join("");
    } else {
      typed = (main.querySelector("#recall")?.value || "").trim();
    }

    const ok = typed.trim().toLowerCase() === correctWord;

    if (ok){
      feedback.innerHTML = `<span class="badgeOk">Correct.</span>`;
      if (attempts === 0) score += 1;
      btnNext.style.display = "inline-block";
      await recordAttempt(true, typed);
      return;
    }

    attempts += 1;
    feedback.innerHTML = `Not quite. <strong>Try again.</strong>`;
    await recordAttempt(false, typed);
  }

  function next(){
    idx = (idx + 1) % words.length;
    render();
  }

  modeSel.addEventListener("change", ()=>{
    mode = modeSel.value;
    render();
  });

  btnListen.addEventListener("click", ()=>{
    const item = currentItem();
    if (mode === "dictation") speak(item.sentence || item.word);
    else speak(item.word);
  });

  btnCheck.addEventListener("click", check);
  btnNext.addEventListener("click", next);
  btnExit.addEventListener("click", ()=> onExit?.());

  render();
}
