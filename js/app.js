// /js/app.js
import { supabase } from "./supabaseClient.js";
import { renderTeacherDashboard } from "./teacherView.js";

/* ---------------------------
   DOM
---------------------------- */
const viewRole = document.getElementById("viewRole");
const viewTeacherAuth = document.getElementById("viewTeacherAuth");
const viewTeacher = document.getElementById("viewTeacher");
const viewPupilAuth = document.getElementById("viewPupilAuth");
const viewPupil = document.getElementById("viewPupil");

const btnTeacher = document.getElementById("btnTeacher");
const btnPupil = document.getElementById("btnPupil");
const btnGoogle = document.getElementById("btnGoogle");
const btnSignOut = document.getElementById("btnSignOut");
const btnBackFromPupil = document.getElementById("btnBackFromPupil");

/* ---------------------------
   STORAGE
---------------------------- */
const ROLE_KEY = "ps_role";

function setRole(role) {
  localStorage.setItem(ROLE_KEY, role);
}
function getRole() {
  return localStorage.getItem(ROLE_KEY) || "";
}
function clearRole() {
  localStorage.removeItem(ROLE_KEY);
}

/* ---------------------------
   VIEW HELPERS
---------------------------- */
function hideAll() {
  viewRole.style.display = "none";
  viewTeacherAuth.style.display = "none";
  viewTeacher.style.display = "none";
  viewPupilAuth.style.display = "none";
  viewPupil.style.display = "none";
}
function show(el) {
  el.style.display = "block";
}

/* ---------------------------
   ROUTER
---------------------------- */
async function route() {
  hideAll();

  const role = getRole();
  const { data: { user } } = await supabase.auth.getUser();

  // No role chosen yet
  if (!role) {
    btnSignOut.style.display = "none";
    show(viewRole);
    return;
  }

  // Teacher flow
  if (role === "teacher") {
    if (!user) {
      btnSignOut.style.display = "none";
      show(viewTeacherAuth);
      return;
    }

    // IMPORTANT: show first, THEN render (so you never get "blank page")
    btnSignOut.style.display = "inline-block";
    show(viewTeacher);

    try {
      await renderTeacherDashboard(viewTeacher);
    } catch (e) {
      console.error("Teacher dashboard render failed:", e);
      viewTeacher.innerHTML = `
        <h2>Teacher dashboard</h2>
        <p class="muted">Dashboard failed to load.</p>
        <pre>${escapeHtml(e?.message || String(e))}</pre>
      `;
    }
    return;
  }

  // Pupil flow
  if (role === "pupil") {
    btnSignOut.style.display = "none";
    show(viewPupilAuth);
    return;
  }

  // Fallback
  clearRole();
  btnSignOut.style.display = "none";
  show(viewRole);
}

/* ---------------------------
   EVENTS
---------------------------- */
btnTeacher?.addEventListener("click", async () => {
  setRole("teacher");
  await route();
});

btnPupil?.addEventListener("click", async () => {
  setRole("pupil");
  await route();
});

btnBackFromPupil?.addEventListener("click", async () => {
  clearRole();
  await route();
});

btnGoogle?.addEventListener("click", async () => {
  const origin = window.location.origin;
  let path = window.location.pathname;
  if (path.endsWith("/index.html")) path = path.replace("/index.html", "/");
  if (!path.endsWith("/")) path += "/";

  const redirectTo = origin + path;

  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });
});

btnSignOut?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  clearRole();
  await route();
});

/* ---------------------------
   AUTH LISTENER + INIT
---------------------------- */
supabase.auth.onAuthStateChange(async () => {
  await route();
});

console.log("app.js loaded");
route();

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
