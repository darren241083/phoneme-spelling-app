// /js/teacherView.js
import { supabase } from "./supabaseClient.js";
import { createClass, listClasses, createTest, listTests } from "./db.js";

export async function renderTeacherDashboard(containerEl) {
  if (!containerEl) return;

  // Render shell immediately (prevents “blank” feeling)
  containerEl.innerHTML = `
    <h2>Teacher dashboard</h2>
    <p class="muted" id="teacherEmail">Loading…</p>

    <div class="row" style="gap:12px; flex-wrap:wrap; margin:16px 0;">
      <div style="min-width:260px; flex:1;">
        <label style="display:block; font-weight:600; margin-bottom:6px;">New class name</label>
        <input id="newClassName" class="input" placeholder="e.g. 7H / 9D / Set 2" />
        <button id="btnCreateClass" class="btn" type="button" style="margin-top:10px;">Create class</button>
      </div>

      <div style="min-width:260px; flex:1;">
        <label style="display:block; font-weight:600; margin-bottom:6px;">New test title</label>
        <input id="newTestTitle" class="input" placeholder="e.g. ‘ai / ay’ phonemes" />
        <button id="btnCreateTest" class="btn secondary" type="button" style="margin-top:10px;">Create test</button>
      </div>
    </div>

    <div id="teacherMsg" class="notice" style="display:none; margin:10px 0;"></div>

    <div class="grid2" style="gap:16px;">
      <div class="card" style="padding:16px;">
        <h3 style="margin-top:0;">Classes</h3>
        <div id="classesList" class="muted">Loading classes…</div>
      </div>

      <div class="card" style="padding:16px;">
        <h3 style="margin-top:0;">Tests</h3>
        <div id="testsList" class="muted">Loading tests…</div>
      </div>
    </div>
  `;

  const elEmail = containerEl.querySelector("#teacherEmail");
  const msg = containerEl.querySelector("#teacherMsg");
  const inpClass = containerEl.querySelector("#newClassName");
  const inpTest = containerEl.querySelector("#newTestTitle");
  const btnClass = containerEl.querySelector("#btnCreateClass");
  const btnTest = containerEl.querySelector("#btnCreateTest");
  const classesListEl = containerEl.querySelector("#classesList");
  const testsListEl = containerEl.querySelector("#testsList");

  function showMsg(text, type = "info") {
    if (!msg) return;
    msg.style.display = "block";
    msg.textContent = text;

    // light styling without needing CSS changes
    msg.style.border = "1px solid #cfd7ff";
    msg.style.background = "#f3f5ff";
    msg.style.color = "#111";

    if (type === "error") {
      msg.style.border = "1px solid #ffb4b4";
      msg.style.background = "#fff3f3";
    }
    if (type === "success") {
      msg.style.border = "1px solid #b7e7c1";
      msg.style.background = "#f2fff5";
    }
  }

  function clearMsg() {
    if (!msg) return;
    msg.style.display = "none";
    msg.textContent = "";
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const email = data?.user?.email || "(unknown)";
    if (elEmail) elEmail.innerHTML = `Signed in as <strong>${escapeHtml(email)}</strong>`;
  }

  function renderClasses(items) {
    if (!classesListEl) return;
    if (!items?.length) {
      classesListEl.innerHTML = `<p class="muted">No classes yet. Create your first one.</p>`;
      return;
    }

    classesListEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${items
          .map(
            (c) => `
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; border:1px solid #eef1f7; border-radius:12px; padding:12px;">
            <div>
              <div style="font-weight:700;">${escapeHtml(c.name)}</div>
              <div class="muted" style="font-size:14px;">Join code: <strong>${escapeHtml(c.join_code)}</strong></div>
            </div>
            <div class="muted" style="font-size:12px; white-space:nowrap;">
              ${c.created_at ? new Date(c.created_at).toLocaleString() : ""}
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  function renderTests(items) {
    if (!testsListEl) return;
    if (!items?.length) {
      testsListEl.innerHTML = `<p class="muted">No tests yet. Create your first one.</p>`;
      return;
    }

    testsListEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${items
          .map(
            (t) => `
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; border:1px solid #eef1f7; border-radius:12px; padding:12px;">
            <div style="font-weight:700;">${escapeHtml(t.title)}</div>
            <div class="muted" style="font-size:12px; white-space:nowrap;">
              ${t.created_at ? new Date(t.created_at).toLocaleString() : ""}
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  async function refreshLists() {
    const [classes, tests] = await Promise.all([listClasses(), listTests()]);
    renderClasses(classes);
    renderTests(tests);
  }

  // Wire buttons
  btnClass?.addEventListener("click", async () => {
    clearMsg();
    btnClass.disabled = true;
    try {
      const created = await createClass({ name: inpClass?.value });
      showMsg(`Class created. Join code: ${created.join_code}`, "success");
      if (inpClass) inpClass.value = "";
      await refreshLists();
    } catch (e) {
      showMsg(e?.message || String(e), "error");
    } finally {
      btnClass.disabled = false;
    }
  });

  btnTest?.addEventListener("click", async () => {
    clearMsg();
    btnTest.disabled = true;
    try {
      await createTest({ title: inpTest?.value });
      showMsg(`Test created.`, "success");
      if (inpTest) inpTest.value = "";
      await refreshLists();
    } catch (e) {
      showMsg(e?.message || String(e), "error");
    } finally {
      btnTest.disabled = false;
    }
  });

  // Initial load
  try {
    await loadUser();
    await refreshLists();
  } catch (e) {
    showMsg(e?.message || String(e), "error");
    if (classesListEl) classesListEl.textContent = "Could not load classes.";
    if (testsListEl) testsListEl.textContent = "Could not load tests.";
  }
}

// Default export (optional convenience)
export default renderTeacherDashboard;
