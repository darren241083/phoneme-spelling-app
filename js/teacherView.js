// /js/teacherView.js
import { supabase } from "./supabaseClient.js";

export async function renderTeacherDashboard(containerEl) {
  if (!containerEl) return;

  // Basic skeleton (so the page never "goes blank" during async)
  containerEl.innerHTML = `
    <h2>Teacher dashboard</h2>
    <p class="muted" id="teacherEmailLine">Loading user…</p>

    <div class="row" style="gap:12px; flex-wrap:wrap; margin:14px 0;">
      <div style="min-width:260px; flex:1;">
        <label style="display:block; margin:0 0 6px;">Class name</label>
        <input id="className" class="input" placeholder="e.g. 7H English" />
      </div>
      <div style="align-self:end;">
        <button id="btnCreateClass" class="btn" type="button">Create class</button>
      </div>

      <div style="min-width:260px; flex:1;">
        <label style="display:block; margin:0 0 6px;">Test title</label>
        <input id="testTitle" class="input" placeholder="e.g. Phase 3 – Week 1" />
      </div>
      <div style="align-self:end;">
        <button id="btnCreateTest" class="btn secondary" type="button">Create test</button>
      </div>
    </div>

    <div id="teacherNotice" class="notice" style="display:none;"></div>

    <h3 style="margin-top:18px;">Your classes</h3>
    <div id="classesWrap" class="muted">Loading classes…</div>

    <h3 style="margin-top:18px;">Your tests</h3>
    <div id="testsWrap" class="muted">Loading tests…</div>
  `;

  const emailLine = containerEl.querySelector("#teacherEmailLine");
  const noticeEl = containerEl.querySelector("#teacherNotice");

  const classNameEl = containerEl.querySelector("#className");
  const btnCreateClass = containerEl.querySelector("#btnCreateClass");

  const testTitleEl = containerEl.querySelector("#testTitle");
  const btnCreateTest = containerEl.querySelector("#btnCreateTest");

  const classesWrap = containerEl.querySelector("#classesWrap");
  const testsWrap = containerEl.querySelector("#testsWrap");

  // Get signed-in user
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    showNotice(noticeEl, `Could not load signed-in user. ${userErr?.message || ""}`, true);
    emailLine.textContent = "Not signed in.";
    classesWrap.textContent = "";
    testsWrap.textContent = "";
    return;
  }

  const user = userRes.user;
  emailLine.innerHTML = `Signed in as <strong>${escapeHtml(user.email || "(unknown)")}</strong>`;

  // -------------------------
  // Actions
  // -------------------------

  // Create class
  btnCreateClass.addEventListener("click", async () => {
    const name = (classNameEl.value || "").trim();
    if (!name) {
      showNotice(noticeEl, "Please enter a class name.", true);
      classNameEl.focus();
      return;
    }

    btnCreateClass.disabled = true;
    showNotice(noticeEl, "Creating class…");

    try {
      const created = await createClassRow({
        teacherId: user.id,
        name,
      });

      showNotice(
        noticeEl,
        `Class created: ${escapeHtml(created.name)} (Join code: ${escapeHtml(created.join_code)})`
      );
      classNameEl.value = "";
      await refreshClasses();
    } catch (e) {
      showNotice(noticeEl, e?.message || String(e), true);
    } finally {
      btnCreateClass.disabled = false;
    }
  });

  // Create test
  btnCreateTest.addEventListener("click", async () => {
    const title = (testTitleEl.value || "").trim();
    if (!title) {
      showNotice(noticeEl, "Please enter a test title.", true);
      testTitleEl.focus();
      return;
    }

    btnCreateTest.disabled = true;
    showNotice(noticeEl, "Creating test…");

    try {
      const { error } = await supabase
        .from("tests")
        .insert([{ teacher_id: user.id, title }]);

      if (error) throw error;

      showNotice(noticeEl, `Test created: ${escapeHtml(title)}`);
      testTitleEl.value = "";
      await refreshTests();
    } catch (e) {
      showNotice(noticeEl, e?.message || String(e), true);
    } finally {
      btnCreateTest.disabled = false;
    }
  });

  // -------------------------
  // Load data immediately
  // -------------------------
  await refreshClasses();
  await refreshTests();

  // -------------------------
  // Helpers (must be inside so they can see user/classesWrap/testsWrap)
  // -------------------------

  async function refreshClasses() {
    classesWrap.textContent = "Loading classes…";

    const { data, error } = await supabase
      .from("classes")
      .select("id, teacher_id, name, join_code, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      classesWrap.innerHTML = `
        <div class="notice">
          Could not load classes.<br/>
          <pre style="white-space:pre-wrap; margin:10px 0 0;">${escapeHtml(error.message)}</pre>
        </div>
      `;
      return;
    }

    if (!data || data.length === 0) {
      classesWrap.innerHTML = `<div class="muted">No classes yet. Create one above.</div>`;
      return;
    }

    classesWrap.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${data
          .map(
            (c) => `
          <div class="card" style="padding:14px; border-radius:14px;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
              <div>
                <div style="font-weight:700; font-size:16px;">${escapeHtml(c.name)}</div>
                <div class="muted" style="margin-top:4px;">
                  Join code: <strong>${escapeHtml(c.join_code || "")}</strong>
                </div>
              </div>

              <div style="display:flex; gap:10px; align-items:center;">
                <button class="btn secondary" type="button" data-copy="${escapeHtml(
                  c.join_code || ""
                )}">Copy code</button>
                <button class="btn secondary" type="button" data-del="${escapeHtml(c.id)}">Delete</button>
              </div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;

    // Wire buttons inside the list
    classesWrap.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = btn.getAttribute("data-copy") || "";
        try {
          await navigator.clipboard.writeText(code);
          showNotice(noticeEl, `Copied join code: ${escapeHtml(code)}`);
        } catch {
          showNotice(noticeEl, `Could not copy automatically. Code: ${escapeHtml(code)}`, true);
        }
      });
    });

    classesWrap.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!id) return;

        const ok = confirm("Delete this class? This cannot be undone.");
        if (!ok) return;

        showNotice(noticeEl, "Deleting…");
        const { error } = await supabase
          .from("classes")
          .delete()
          .eq("id", id)
          .eq("teacher_id", user.id);

        if (error) {
          showNotice(noticeEl, `Delete failed: ${error.message}`, true);
          return;
        }

        showNotice(noticeEl, "Class deleted.");
        await refreshClasses();
      });
    });
  }

  async function refreshTests() {
    testsWrap.textContent = "Loading tests…";

    const { data, error } = await supabase
      .from("tests")
      .select("id, title, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      testsWrap.innerHTML = `
        <div class="notice">
          Could not load tests.<br/>
          <pre style="white-space:pre-wrap; margin:10px 0 0;">${escapeHtml(error.message)}</pre>
        </div>
      `;
      return;
    }

    if (!data || data.length === 0) {
      testsWrap.innerHTML = `<p class="muted">No tests yet.</p>`;
      return;
    }

    testsWrap.innerHTML = `
      <div class="card" style="padding:12px;">
        ${data
          .map(
            (t) => `
              <div class="row" style="justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                <div>
                  <div style="font-weight:600;">${escapeHtml(t.title)}</div>
                  <div class="muted" style="font-size:12px;">${escapeHtml(
                    new Date(t.created_at).toLocaleString()
                  )}</div>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }
}

export default renderTeacherDashboard;

// --------------------------------------------------
// DB insert with join_code generation + retry on conflict
// --------------------------------------------------
async function createClassRow({ teacherId, name }) {
  // join_code is UNIQUE, so retry if we collide
  const maxAttempts = 6;

  for (let i = 0; i < maxAttempts; i++) {
    const join_code = generateJoinCode(); // e.g. WGSF-7H2K (or similar)
    const { data, error } = await supabase
      .from("classes")
      .insert([{ teacher_id: teacherId, name, join_code }])
      .select("id, teacher_id, name, join_code, created_at")
      .single();

    if (!error) return data;

    // 23505 = unique_violation (likely join_code collision)
    if (String(error.code) === "23505" && i < maxAttempts - 1) continue;

    throw error;
  }

  throw new Error("Could not create class (too many join code collisions). Try again.");
}

function generateJoinCode() {
  // Simple readable format: ABCD-1234 style, but letters+numbers mixed
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ"; // omit confusing I/L/O
  const alnum = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  const part1 = Array.from({ length: 4 }, () => letters[rand(letters.length)]).join("");
  const part2 = Array.from({ length: 4 }, () => alnum[rand(alnum.length)]).join("");
  return `${part1}-${part2}`;
}

function rand(n) {
  return Math.floor(Math.random() * n);
}

function showNotice(el, msg, isError = false) {
  if (!el) return;
  el.style.display = "block";
  el.style.marginTop = "10px";
  el.innerHTML = msg;

  el.style.border = "1px solid";
  el.style.borderColor = isError ? "rgba(200,0,0,0.25)" : "rgba(0,0,0,0.08)";
  el.style.background = isError ? "rgba(200,0,0,0.06)" : "rgba(0,0,0,0.03)";
  el.style.padding = "12px";
  el.style.borderRadius = "12px";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
