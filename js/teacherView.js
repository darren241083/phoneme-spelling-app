// /js/teacherView.js

import { supabase } from "./supabaseClient.js";

export async function renderTeacherDashboard(containerEl) {
  if (!containerEl) return;

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    containerEl.innerHTML = `
      <h2>Teacher dashboard</h2>
      <p class="muted">Could not load user.</p>
      <pre>${escapeHtml(error.message)}</pre>
    `;
    return;
  }

  containerEl.innerHTML = `
    <h2>Teacher dashboard</h2>
    <p>Signed in as ${escapeHtml(user?.email || "(unknown)")}</p>
    <p class="muted">Create classes and tests here.</p>
  `;
}

// Default export too (so either import style works)
export default renderTeacherDashboard;

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
