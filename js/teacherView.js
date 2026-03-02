import { supabase } from "./supabaseClient.js";

export async function renderTeacherDashboard(containerEl) {
  if (!containerEl) return;

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    containerEl.innerHTML = `
      <h2>Teacher dashboard</h2>
      <p class="muted">Could not load user.</p>
      <pre style="white-space:pre-wrap;">${escapeHtml(error.message)}</pre>
    `;
    return;
  }

  containerEl.innerHTML = `
    <h2>Teacher dashboard</h2>
    <p>Signed in as <strong>${escapeHtml(user?.email || "(unknown)")}</strong></p>

    <div style="height:12px;"></div>

    <div class="row">
      <button id="btnCreateClass" class="btn" type="button">Create class</button>
      <button id="btnCreateTest" class="btn secondary" type="button">Create test</button>
    </div>

    <div style="height:12px;"></div>

    <div class="notice" id="teacherDashMsg" style="display:none;"></div>

    <p class="muted" style="margin-top:12px;">
      Next step: we’ll wire these buttons to create rows in <code>classes</code> and <code>tests</code>, then list them here.
    </p>
  `;

  const msg = containerEl.querySelector("#teacherDashMsg");
  const btnCreateClass = containerEl.querySelector("#btnCreateClass");
  const btnCreateTest = containerEl.querySelector("#btnCreateTest");

  const showMsg = (text) => {
    if (!msg) return;
    msg.style.display = "block";
    msg.textContent = text;
  };

  btnCreateClass?.addEventListener("click", () => {
    showMsg("Create class clicked (wiring next).");
  });

  btnCreateTest?.addEventListener("click", () => {
    showMsg("Create test clicked (wiring next).");
  });
}

// Default export (so either import style works)
export default renderTeacherDashboard;

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
