// /js/teacherView.js
import { supabase } from "./supabaseClient.js";

export async function renderTeacherDashboard(containerEl) {
  if (!containerEl) return;

  containerEl.innerHTML = teacherDashboardHTML();

  // -----------------------------
  // DOM
  // -----------------------------
  const emailLine = containerEl.querySelector("#teacherEmailLine");
  const noticeEl = containerEl.querySelector("#teacherNotice");

  const classNameEl = containerEl.querySelector("#className");
  const btnCreateClass = containerEl.querySelector("#btnCreateClass");

  const testTitleEl = containerEl.querySelector("#testTitle");
  const btnCreateTest = containerEl.querySelector("#btnCreateTest");

  const assignClassEl = containerEl.querySelector("#assignClass");
  const assignTestEl = containerEl.querySelector("#assignTest");
  const assignModeEl = containerEl.querySelector("#assignMode");
  const assignMaxAttemptsEl = containerEl.querySelector("#assignMaxAttempts");
  const assignEndAtEl = containerEl.querySelector("#assignEndAt");
  const btnAssign = containerEl.querySelector("#btnAssign");

  const classesWrap = containerEl.querySelector("#classesWrap");
  const testsWrap = containerEl.querySelector("#testsWrap");
  const assignmentsWrap = containerEl.querySelector("#assignmentsWrap");

  const editTestPicker = containerEl.querySelector("#editTestPicker");
  const wordsPasteEl = containerEl.querySelector("#wordsPaste");
  const btnAddWords = containerEl.querySelector("#btnAddWords");
  const questionsWrap = containerEl.querySelector("#questionsWrap");

  // -----------------------------
  // Auth
  // -----------------------------
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    emailLine.textContent = "Not signed in.";
    showNotice(noticeEl, "Not signed in (could not load user).", true);
    return;
  }
  const user = userRes.user;
  emailLine.innerHTML = `Signed in as <strong>${escapeHtml(user.email || "(unknown)")}</strong>`;

  // -----------------------------
  // State maps
  // -----------------------------
  let classMap = {};
  let testMap = {};
  let selectedEditTestId = "";

  // -----------------------------
  // Handlers: Create class
  // -----------------------------
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

  // -----------------------------
  // Handlers: Create test
  // -----------------------------
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

  // -----------------------------
  // Handlers: Assign
  // -----------------------------
  btnAssign.addEventListener("click", async () => {
    const classId = assignClassEl.value;
    const testId = assignTestEl.value;

    if (!classId) return showNotice(noticeEl, "Choose a class.", true);
    if (!testId) return showNotice(noticeEl, "Choose a test.", true);

    const mode = assignModeEl.value;

    const maxAttemptsRaw = (assignMaxAttemptsEl.value || "").trim();
    const max_attempts = maxAttemptsRaw === "" ? null : Number(maxAttemptsRaw);
    if (max_attempts !== null && (!Number.isInteger(max_attempts) || max_attempts < 1)) {
      return showNotice(noticeEl, "Max attempts must be blank or a whole number (1+).", true);
    }

    const endAtRaw = (assignEndAtEl.value || "").trim();
    const end_at = endAtRaw ? new Date(endAtRaw).toISOString() : null;

    btnAssign.disabled = true;
    showNotice(noticeEl, "Assigning…");

    try {
      const { error } = await supabase.from("assignments_v2").insert([
        { teacher_id: user.id, class_id: classId, test_id: testId, mode, max_attempts, end_at },
      ]);
      if (error) throw error;

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

  // -----------------------------
  // Handlers: Test builder picker
  // -----------------------------
  editTestPicker.addEventListener("change", async () => {
    selectedEditTestId = editTestPicker.value || "";
    await refreshQuestions();
  });

  // -----------------------------
  // Handlers: Add words (bulk)
  // -----------------------------
  btnAddWords.addEventListener("click", async () => {
    const testId = selectedEditTestId || editTestPicker.value || "";
    if (!testId) {
      showNotice(noticeEl, "Choose a test to edit first.", true);
      return;
    }

    const raw = (wordsPasteEl.value || "").trim();
    if (!raw) {
      showNotice(noticeEl, "Paste words (one per line) first.", true);
      wordsPasteEl.focus();
      return;
    }

    // Normalize lines -> words
    const words = raw
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .filter(Boolean);

    if (words.length === 0) {
      showNotice(noticeEl, "No valid words found.", true);
      return;
    }

    btnAddWords.disabled = true;
    showNotice(noticeEl, `Adding ${words.length} question(s)…`);

    try {
      // Get current max position
      const { data: maxPosData, error: maxErr } = await supabase
        .from("test_questions")
        .select("position")
        .eq("test_id", testId)
        .order("position", { ascending: false })
        .limit(1);

      if (maxErr) throw maxErr;
      const startPos = (maxPosData?.[0]?.position ?? 0) + 1;

      // Build inserts
      const rows = words.map((w, idx) => {
        const word = w;
        return {
          test_id: testId,
          position: startPos + idx,
          type: "spell_from_audio",
          prompt_text: word,
          answer_text: word,
          meta_json: {
            // Future: store AI suggestions here
            graphemes: [], // Option B: array of graphemes
            tricky: "",
            notes: "",
          },
        };
      });

      const { error } = await supabase.from("test_questions").insert(rows);
      if (error) throw error;

      wordsPasteEl.value = "";
      showNotice(noticeEl, "Questions added.");
      await refreshQuestions();
    } catch (e) {
      showNotice(noticeEl, e?.message || String(e), true);
    } finally {
      btnAddWords.disabled = false;
    }
  });

  // -----------------------------
  // Initial load
  // -----------------------------
  await refreshAll();

  async function refreshAll() {
    await refreshClasses();
    await refreshTests();
    await refreshPickers();
    await refreshAssignments();

    // Keep edit picker in sync
    if (!selectedEditTestId) selectedEditTestId = editTestPicker.value || "";
    await refreshQuestions();
  }

  // -----------------------------
  // Refresh: Classes
  // -----------------------------
  async function refreshClasses() {
    classesWrap.textContent = "Loading classes…";

    const { data, error } = await supabase
      .from("classes")
      .select("id, name, join_code, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      classesWrap.innerHTML = renderError("Could not load classes.", error.message);
      return;
    }

    const items = data || [];
    classMap = items.reduce((acc, c) => {
      acc[c.id] = c.name;
      return acc;
    }, {});

    if (items.length === 0) {
      classesWrap.innerHTML = `<div class="muted">No classes yet. Create one above.</div>`;
      return;
    }

    classesWrap.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${items
          .map(
            (c) => `
              <div class="card" style="padding:14px; border-radius:14px;">
                <div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
                  <div>
                    <div style="font-weight:800; font-size:16px;">${escapeHtml(c.name)}</div>
                    <div class="muted" style="margin-top:4px;">
                      Join code: <strong>${escapeHtml(c.join_code || "")}</strong>
                    </div>
                  </div>

                  <div style="display:flex; gap:10px; align-items:center;">
                    <button class="btn secondary" type="button" data-copy="${escapeHtml(
                      c.join_code || ""
                    )}">Copy</button>
                    <button class="btn secondary" type="button" data-rename-class="${escapeHtml(
                      c.id
                    )}">Rename</button>
                    <button class="btn secondary" type="button" data-del-class="${escapeHtml(
                      c.id
                    )}">Delete</button>
                  </div>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    `;

    // Copy join code
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

    // Rename class
    classesWrap.querySelectorAll("[data-rename-class]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const classId = btn.getAttribute("data-rename-class");
        if (!classId) return;

        const current = classMap[classId] || "";
        const next = prompt("New class name:", current);
        if (next == null) return; // cancelled

        const name = String(next).trim();
        if (!name) return alert("Class name cannot be blank.");

        showNotice(noticeEl, "Renaming class…");
        const { error } = await supabase
          .from("classes")
          .update({ name })
          .eq("teacher_id", user.id)
          .eq("id", classId);

        if (error) {
          showNotice(noticeEl, `Rename failed: ${error.message}`, true);
          return;
        }

        showNotice(noticeEl, "Class renamed.");
        await refreshAll();
      });
    });

    // Delete class (delete assignments first)
    classesWrap.querySelectorAll("[data-del-class]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const classId = btn.getAttribute("data-del-class");
        if (!classId) return;

        const className = classMap[classId] || "this class";
        const ok = confirm(`Delete "${className}"?\n\nThis will also delete its assignments.`);
        if (!ok) return;

        showNotice(noticeEl, "Deleting class…");

        const delA = await supabase
          .from("assignments_v2")
          .delete()
          .eq("teacher_id", user.id)
          .eq("class_id", classId);

        if (delA.error) {
          showNotice(noticeEl, `Could not delete assignments: ${delA.error.message}`, true);
          return;
        }

        const delC = await supabase
          .from("classes")
          .delete()
          .eq("teacher_id", user.id)
          .eq("id", classId);

        if (delC.error) {
          showNotice(noticeEl, `Could not delete class: ${delC.error.message}`, true);
          return;
        }

        showNotice(noticeEl, "Class deleted.");
        await refreshAll();
      });
    });
  }

  // -----------------------------
  // Refresh: Tests
  // -----------------------------
  async function refreshTests() {
    testsWrap.textContent = "Loading tests…";

    const { data, error } = await supabase
      .from("tests")
      .select("id, title, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      testsWrap.innerHTML = renderError("Could not load tests.", error.message);
      return;
    }

    const items = data || [];
    testMap = items.reduce((acc, t) => {
      acc[t.id] = t.title;
      return acc;
    }, {});

    if (items.length === 0) {
      testsWrap.innerHTML = `<div class="muted">No tests yet. Create one above.</div>`;
      return;
    }

    testsWrap.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${items
          .map((t) => {
            const when = t.created_at ? new Date(t.created_at).toLocaleString() : "";
            return `
              <div class="card" style="padding:14px; border-radius:14px;">
                <div style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
                  <div>
                    <div style="font-weight:900;">${escapeHtml(t.title)}</div>
                    <div class="muted" style="font-size:12px; margin-top:4px;">${escapeHtml(when)}</div>
                  </div>

                  <div style="display:flex; gap:10px; align-items:center;">
                    <button class="btn secondary" type="button" data-rename-test="${escapeHtml(
                      t.id
                    )}">Rename</button>
                    <button class="btn secondary" type="button" data-del-test="${escapeHtml(
                      t.id
                    )}">Delete</button>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    // Rename test
    testsWrap.querySelectorAll("[data-rename-test]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const testId = btn.getAttribute("data-rename-test");
        if (!testId) return;

        const current = testMap[testId] || "";
        const next = prompt("New test title:", current);
        if (next == null) return;

        const title = String(next).trim();
        if (!title) return alert("Test title cannot be blank.");

        showNotice(noticeEl, "Renaming test…");
        const { error } = await supabase
          .from("tests")
          .update({ title })
          .eq("teacher_id", user.id)
          .eq("id", testId);

        if (error) {
          showNotice(noticeEl, `Rename failed: ${error.message}`, true);
          return;
        }

        showNotice(noticeEl, "Test renamed.");
        await refreshAll();
      });
    });

    // Delete test (delete assignments first; questions cascade from tests -> test_questions)
    testsWrap.querySelectorAll("[data-del-test]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const testId = btn.getAttribute("data-del-test");
        if (!testId) return;

        const testTitle = testMap[testId] || "this test";
        const ok = confirm(`Delete "${testTitle}"?\n\nThis will also delete its assignments and questions.`);
        if (!ok) return;

        showNotice(noticeEl, "Deleting test…");

        const delA = await supabase
          .from("assignments_v2")
          .delete()
          .eq("teacher_id", user.id)
          .eq("test_id", testId);

        if (delA.error) {
          showNotice(noticeEl, `Could not delete assignments: ${delA.error.message}`, true);
          return;
        }

        const delT = await supabase
          .from("tests")
          .delete()
          .eq("teacher_id", user.id)
          .eq("id", testId);

        if (delT.error) {
          showNotice(noticeEl, `Could not delete test: ${delT.error.message}`, true);
          return;
        }

        // If we just deleted the selected edit test, clear selection
        if (selectedEditTestId === testId) selectedEditTestId = "";

        showNotice(noticeEl, "Test deleted.");
        await refreshAll();
      });
    });
  }

  // -----------------------------
  // Refresh: Pickers
  // -----------------------------
  async function refreshPickers() {
    // Assign pickers
    const classIds = Object.keys(classMap);
    const testIds = Object.keys(testMap);

    assignClassEl.innerHTML =
      `<option value="">Select class…</option>` +
      classIds
        .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(classMap[id])}</option>`)
        .join("");

    assignTestEl.innerHTML =
      `<option value="">Select test…</option>` +
      testIds
        .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(testMap[id])}</option>`)
        .join("");

    // Test builder picker
    const previous = selectedEditTestId || editTestPicker.value || "";
    editTestPicker.innerHTML =
      `<option value="">Select test…</option>` +
      testIds
        .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(testMap[id])}</option>`)
        .join("");

    // Restore selection if still exists
    if (previous && testMap[previous]) {
      editTestPicker.value = previous;
      selectedEditTestId = previous;
    } else {
      editTestPicker.value = "";
      selectedEditTestId = "";
    }
  }

  // -----------------------------
  // Refresh: Assignments
  // -----------------------------
  async function refreshAssignments() {
    assignmentsWrap.textContent = "Loading assignments…";

    const { data, error } = await supabase
      .from("assignments_v2")
      .select("id, class_id, test_id, mode, max_attempts, end_at, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      assignmentsWrap.innerHTML = renderError("Could not load assignments.", error.message);
      return;
    }

    const items = data || [];
    if (items.length === 0) {
      assignmentsWrap.innerHTML = `<div class="muted">No assignments yet.</div>`;
      return;
    }

    assignmentsWrap.innerHTML = `
      <div class="card" style="padding:12px;">
        ${items
          .map((a) => {
            const className = classMap[a.class_id] || a.class_id;
            const testTitle = testMap[a.test_id] || a.test_id;

            const when = a.created_at ? new Date(a.created_at).toLocaleString() : "";
            const deadline = a.end_at ? new Date(a.end_at).toLocaleString() : "—";
            const attempts = a.max_attempts == null ? "∞" : String(a.max_attempts);
            const mode = a.mode || "practice";

            return `
              <div style="padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.06); display:flex; gap:12px; justify-content:space-between; align-items:flex-start;">
                <div>
                  <div style="font-weight:900;">${escapeHtml(className)} → ${escapeHtml(testTitle)}</div>
                  <div class="muted" style="margin-top:4px; font-size:12px;">
                    Mode: ${escapeHtml(mode)} · Attempts: ${escapeHtml(attempts)} · Deadline: ${escapeHtml(deadline)}
                  </div>
                  <div class="muted" style="font-size:11px;">Assigned: ${escapeHtml(when)}</div>
                </div>
                <div>
                  <button class="btn secondary" type="button" data-del-assign="${escapeHtml(a.id)}">Delete</button>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    assignmentsWrap.querySelectorAll("[data-del-assign]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del-assign");
        if (!id) return;

        const ok = confirm("Delete this assignment?");
        if (!ok) return;

        showNotice(noticeEl, "Deleting assignment…");
        const { error } = await supabase
          .from("assignments_v2")
          .delete()
          .eq("teacher_id", user.id)
          .eq("id", id);

        if (error) {
          showNotice(noticeEl, `Delete failed: ${error.message}`, true);
          return;
        }

        showNotice(noticeEl, "Assignment deleted.");
        await refreshAssignments();
      });
    });
  }

  // -----------------------------
  // Refresh: Questions (Test Builder)
  // -----------------------------
  async function refreshQuestions() {
    const testId = selectedEditTestId || editTestPicker.value || "";
    if (!testId) {
      questionsWrap.innerHTML = `<div class="muted">Select a test to view/edit its questions.</div>`;
      return;
    }

    questionsWrap.textContent = "Loading questions…";

    const { data, error } = await supabase
      .from("test_questions")
      .select("id, position, type, prompt_text, answer_text, meta_json, created_at")
      .eq("test_id", testId)
      .order("position", { ascending: true });

    if (error) {
      questionsWrap.innerHTML = renderError("Could not load questions.", error.message);
      return;
    }

    const items = data || [];
    if (items.length === 0) {
      questionsWrap.innerHTML = `<div class="muted">No questions yet. Paste words above and click “Add”.</div>`;
      return;
    }

    questionsWrap.innerHTML = `
      <div class="card" style="padding:12px;">
        ${items
          .map((q) => {
            const meta = q.meta_json || {};
            const graphemesArr = Array.isArray(meta.graphemes) ? meta.graphemes : [];
            const graphemesText = graphemesArr.length ? graphemesArr.join(" / ") : "—";

            return `
              <div style="padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.06); display:flex; gap:12px; justify-content:space-between; align-items:flex-start;">
                <div style="min-width:0;">
                  <div style="font-weight:900;">
                    ${escapeHtml(String(q.position))}. ${escapeHtml(q.prompt_text)}
                  </div>
                  <div class="muted" style="margin-top:4px; font-size:12px;">
                    Answer: <strong>${escapeHtml(q.answer_text)}</strong>
                  </div>
                  <div class="muted" style="margin-top:4px; font-size:12px;">
                    Graphemes: ${escapeHtml(graphemesText)}
                  </div>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                  <button class="btn secondary" type="button" data-edit-q="${escapeHtml(q.id)}">Edit</button>
                  <button class="btn secondary" type="button" data-del-q="${escapeHtml(q.id)}">Delete</button>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    // Delete question
    questionsWrap.querySelectorAll("[data-del-q]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const qid = btn.getAttribute("data-del-q");
        if (!qid) return;

        const ok = confirm("Delete this question?");
        if (!ok) return;

        showNotice(noticeEl, "Deleting question…");
        const { error } = await supabase.from("test_questions").delete().eq("id", qid);

        if (error) {
          showNotice(noticeEl, `Delete failed: ${error.message}`, true);
          return;
        }

        showNotice(noticeEl, "Question deleted.");
        await refreshQuestions();
      });
    });

    // Edit question (simple prompts to keep UI light)
    questionsWrap.querySelectorAll("[data-edit-q]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const qid = btn.getAttribute("data-edit-q");
        if (!qid) return;

        // Load the one row (small + safe)
        const { data: row, error } = await supabase
          .from("test_questions")
          .select("id, prompt_text, answer_text, meta_json")
          .eq("id", qid)
          .single();

        if (error) {
          showNotice(noticeEl, `Could not load question: ${error.message}`, true);
          return;
        }

        const currentPrompt = row.prompt_text || "";
        const currentAnswer = row.answer_text || "";
        const meta = row.meta_json || {};
        const currentG = Array.isArray(meta.graphemes) ? meta.graphemes.join("/") : "";

        const nextPrompt = prompt("Prompt (usually the word):", currentPrompt);
        if (nextPrompt == null) return;

        const nextAnswer = prompt("Answer:", currentAnswer);
        if (nextAnswer == null) return;

        const nextGraphemes = prompt(
          "Graphemes (optional). Use slashes like: st/a/tion",
          currentG
        );
        if (nextGraphemes == null) return;

        const prompt_text = String(nextPrompt).trim();
        const answer_text = String(nextAnswer).trim();

        if (!prompt_text || !answer_text) {
          alert("Prompt and Answer cannot be blank.");
          return;
        }

        const gArr = String(nextGraphemes)
          .trim()
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean);

        const nextMeta = {
          ...(meta || {}),
          graphemes: gArr,
        };

        showNotice(noticeEl, "Saving question…");
        const { error: upErr } = await supabase
          .from("test_questions")
          .update({ prompt_text, answer_text, meta_json: nextMeta })
          .eq("id", qid);

        if (upErr) {
          showNotice(noticeEl, `Save failed: ${upErr.message}`, true);
          return;
        }

        showNotice(noticeEl, "Question updated.");
        await refreshQuestions();
      });
    });
  }
}

export default renderTeacherDashboard;

// --------------------------------------------------
// HTML
// --------------------------------------------------
function teacherDashboardHTML() {
  return `
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
    </div>

    <div style="min-width:160px;">
      <label style="display:block; margin:0 0 6px;">Max attempts</label>
      <input id="assignMaxAttempts" class="input" inputmode="numeric" placeholder="(blank = unlimited)" />
    </div>

    <div style="min-width:220px;">
      <label style="display:block; margin:0 0 6px;">Deadline</label>
      <input id="assignEndAt" class="input" type="datetime-local" />
    </div>

    <div style="align-self:end;">
      <button id="btnAssign" class="btn" type="button">Assign</button>
    </div>
  </div>
</div>

<h3 style="margin-top:18px;">Test builder</h3>
<div class="card" style="padding:14px; border-radius:14px;">
  <div class="row" style="gap:12px; flex-wrap:wrap; align-items:end;">
    <div style="min-width:240px; flex:1;">
      <label style="display:block; margin:0 0 6px;">Choose test</label>
      <select id="editTestPicker" class="input"></select>
    </div>
  </div>

  <div style="margin-top:12px;">
    <label style="display:block; margin:0 0 6px;">Paste words (one per line)</label>
    <textarea id="wordsPaste" class="input" rows="5" placeholder="knife&#10;station&#10;bridge"></textarea>
    <div style="margin-top:10px;">
      <button id="btnAddWords" class="btn" type="button">Add to test</button>
    </div>
  </div>

  <div style="margin-top:14px;">
    <div style="font-weight:800; margin-bottom:8px;">Questions</div>
    <div id="questionsWrap" class="muted">Select a test to view questions…</div>
  </div>
</div>

<h3 style="margin-top:18px;">Your classes</h3>
<div id="classesWrap" class="muted">Loading classes…</div>

<h3 style="margin-top:18px;">Your tests</h3>
<div id="testsWrap" class="muted">Loading tests…</div>

<h3 style="margin-top:18px;">Recent assignments</h3>
<div id="assignmentsWrap" class="muted">Loading assignments…</div>
`;
}

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

    // Postgres unique violation (likely join_code collision)
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

function renderError(title, msg) {
  return `
    <div class="notice">
      ${escapeHtml(title)}<br/>
      <pre style="white-space:pre-wrap; margin:10px 0 0;">${escapeHtml(msg)}</pre>
    </div>
  `;
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