// /js/teacherView.js
import { supabase } from "./supabaseClient.js";

export async function renderTeacherDashboard(containerEl) {
  if (!containerEl) return;

  containerEl.innerHTML = `
    <h2>Teacher dashboard</h2>
    <p class="muted" id="teacherEmailLine">Loading user…</p>

    <div class="row" style="gap:12px; flex-wrap:wrap; margin:14px 0;">
      <div style="min-width:240px; flex:1;">
        <label style="display:block; margin:0 0 6px;">Class name</label>
        <input id="className" class="input" placeholder="e.g. 7H English" />
      </div>
      <div style="align-self:end;">
        <button id="btnCreateClass" class="btn" type="button">Create class</button>
      </div>

      <div style="min-width:240px; flex:1;">
        <label style="display:block; margin:0 0 6px;">Test title</label>
        <input id="testTitle" class="input" placeholder="e.g. Phase 3 – Week 1" />
      </div>
      <div style="align-self:end;">
        <button id="btnCreateTest" class="btn secondary" type="button">Create test</button>
      </div>
    </div>

    <div id="teacherNotice" class="notice" style="display:none;"></div>

    <h3 style="margin-top:18px;">Assign a test</h3>
    <div class="card" style="padding:14px; border-radius:14px;">
      <div class="row" style="gap:12px; flex-wrap:wrap;">
        <div style="min-width:220px; flex:1;">
          <label style="display:block; margin:0 0 6px;">Class</label>
          <select id="assignClass" class="input"></select>
        </div>

        <div style="min-width:220px; flex:1;">
          <label style="display:block; margin:0 0 6px;">Test</label>
          <select id="assignTest" class="input"></select>
        </div>

        <div style="min-width:170px;">
          <label style="display:block; margin:0 0 6px;">Mode</label>
          <select id="assignMode" class="input">
            <option value="practice">practice</option>
            <option value="test">test</option>
            <option value="strict">strict</option>
          </select>
          <div class="muted" style="font-size:12px; margin-top:6px;">
            (Mode not saved yet — schema cache issue)
          </div>
        </div>

        <div style="min-width:160px;">
          <label style="display:block; margin:0 0 6px;">Max attempts</label>
          <input id="assignMaxAttempts" class="input" inputmode="numeric" placeholder="(blank = unlimited)" />
          <div class="muted" style="font-size:12px; margin-top:6px;">
            (Not saved yet — schema cache issue)
          </div>
        </div>

        <div style="min-width:220px;">
          <label style="display:block; margin:0 0 6px;">Deadline</label>
          <input id="assignEndAt" class="input" type="datetime-local" />
          <div class="muted" style="font-size:12px; margin-top:6px;">
            (Not saved yet — schema cache issue)
          </div>
        </div>

        <div style="align-self:end;">
          <button id="btnAssign" class="btn" type="button">Assign</button>
        </div>
      </div>
    </div>

    <h3 style="margin-top:18px;">Your classes</h3>
    <div id="classesWrap" class="muted">Loading classes…</div>

    <h3 style="margin-top:18px;">Your tests</h3>
    <div id="testsWrap" class="muted">Loading tests…</div>

    <h3 style="margin-top:18px;">Recent assignments</h3>
    <div id="assignmentsWrap" class="muted">Loading assignments…</div>
  `;

  const emailLine = containerEl.querySelector("#teacherEmailLine");
  const noticeEl = containerEl.querySelector("#teacherNotice");

  const classNameEl = containerEl.querySelector("#className");
  const btnCreateClass = containerEl.querySelector("#btnCreateClass");

  const testTitleEl = containerEl.querySelector("#testTitle");
  const btnCreateTest = containerEl.querySelector("#btnCreateTest");

  const classesWrap = containerEl.querySelector("#classesWrap");
  const testsWrap = containerEl.querySelector("#testsWrap");
  const assignmentsWrap = containerEl.querySelector("#assignmentsWrap");

  const assignClassEl = containerEl.querySelector("#assignClass");
  const assignTestEl = containerEl.querySelector("#assignTest");
  const assignModeEl = containerEl.querySelector("#assignMode");
  const assignMaxAttemptsEl = containerEl.querySelector("#assignMaxAttempts");
  const assignEndAtEl = containerEl.querySelector("#assignEndAt");
  const btnAssign = containerEl.querySelector("#btnAssign");

  // Get signed-in user
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    showNotice(noticeEl, `Could not load signed-in user. ${userErr?.message || ""}`, true);
    emailLine.textContent = "Not signed in.";
    classesWrap.textContent = "";
    testsWrap.textContent = "";
    assignmentsWrap.textContent = "";
    return;
  }

  const user = userRes.user;
  emailLine.innerHTML = `Signed in as <strong>${escapeHtml(user.email || "(unknown)")}</strong>`;

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
      const created = await createClassRow({ teacherId: user.id, name });
      showNotice(
        noticeEl,
        `Class created: ${escapeHtml(created.name)} (Join code: ${escapeHtml(created.join_code)})`
      );
      classNameEl.value = "";
      await refreshAll();
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
      const { error } = await supabase.from("tests").insert([{ teacher_id: user.id, title }]);
      if (error) throw error;

      showNotice(noticeEl, `Test created: ${escapeHtml(title)}`);
      testTitleEl.value = "";
      await refreshAll();
    } catch (e) {
      showNotice(noticeEl, e?.message || String(e), true);
    } finally {
      btnCreateTest.disabled = false;
    }
  });

  // Assign (SAFE columns only)
  btnAssign.addEventListener("click", async () => {
    const classId = assignClassEl.value;
    const testId = assignTestEl.value;

    if (!classId) {
      showNotice(noticeEl, "Choose a class to assign to.", true);
      return;
    }
    if (!testId) {
      showNotice(noticeEl, "Choose a test to assign.", true);
      return;
    }

    btnAssign.disabled = true;
    showNotice(noticeEl, "Assigning…");

    try {
      // IMPORTANT: only insert columns that PostgREST currently recognises
      const { error } = await supabase.from("assignments_v2").insert([
        {
          teacher_id: user.id,
          class_id: classId,
          test_id: testId,
        },
      ]);

      if (error) throw error;

      // Clear only optional inputs (we keep dropdown selection)
      assignModeEl.value = "practice";
      assignMaxAttemptsEl.value = "";
      assignEndAtEl.value = "";

      showNotice(noticeEl, "Assigned.");
      await refreshAssignments();
    } catch (e) {
      showNotice(noticeEl, e?.message || String(e), true);
    } finally {
      btnAssign.disabled = false;
    }
  });

  // Load everything
  await refreshAll();

  async function refreshAll() {
    await refreshClasses();
    await refreshTests();
    await refreshPickers();
    await refreshAssignments();
  }

  async function refreshClasses() {
    classesWrap.textContent = "Loading classes…";

    const { data, error } = await supabase
      .from("classes")
      .select("id, name, join_code, created_at")
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
        await refreshAll();
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

  async function refreshPickers() {
    const [classesRes, testsRes] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("tests")
        .select("id, title")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (classesRes.error) {
      assignClassEl.innerHTML = `<option value="">(Could not load classes)</option>`;
    } else {
      const items = classesRes.data || [];
      assignClassEl.innerHTML =
        `<option value="">Select class…</option>` +
        items.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    }

    if (testsRes.error) {
      assignTestEl.innerHTML = `<option value="">(Could not load tests)</option>`;
    } else {
      const items = testsRes.data || [];
      assignTestEl.innerHTML =
        `<option value="">Select test…</option>` +
        items.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.title)}</option>`).join("");
    }
  }

  async function refreshAssignments() {
    assignmentsWrap.textContent = "Loading assignments…";

    // SAFE select only
    const { data, error } = await supabase
      .from("assignments_v2")
      .select("id, class_id, test_id, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      assignmentsWrap.innerHTML = `
        <div class="notice">
          Could not load assignments.<br/>
          <pre style="white-space:pre-wrap; margin:10px 0 0;">${escapeHtml(error.message)}</pre>
        </div>
      `;
      return;
    }

    if (!data || data.length === 0) {
      assignmentsWrap.innerHTML = `<p class="muted">No assignments yet.</p>`;
      return;
    }

    const classOptions = Array.from(assignClassEl.querySelectorAll("option")).reduce((acc, o) => {
      if (o.value) acc[o.value] = o.textContent || o.value;
      return acc;
    }, {});

    const testOptions = Array.from(assignTestEl.querySelectorAll("option")).reduce((acc, o) => {
      if (o.value) acc[o.value] = o.textContent || o.value;
      return acc;
    }, {});

    assignmentsWrap.innerHTML = `
      <div class="card" style="padding:12px;">
        ${data
          .map((a) => {
            const className = classOptions[a.class_id] || a.class_id;
            const testTitle = testOptions[a.test_id] || a.test_id;
            const when = a.created_at ? new Date(a.created_at).toLocaleString() : "";

            return `
              <div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="font-weight:700;">${escapeHtml(className)} → ${escapeHtml(testTitle)}</div>
                <div class="muted" style="margin-top:4px; font-size:12px;">Assigned: ${escapeHtml(when)}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }
}

export default renderTeacherDashboard;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

async function createClassRow({ teacherId, name }) {
  const maxAttempts = 6;

  for (let i = 0; i < maxAttempts; i++) {
    const join_code = generateJoinCode();
    const { data, error } = await supabase
      .from("classes")
      .insert([{ teacher_id: teacherId, name, join_code }])
      .select("id, teacher_id, name, join_code, created_at")
      .single();

    if (!error) return data;

    if (String(error.code) === "23505" && i < maxAttempts - 1) continue;
    throw error;
  }

  throw new Error("Could not create class (too many join code collisions). Try again.");
}

function generateJoinCode() {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
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
