import { supabase } from "./supabaseClient.js";
import { renderTeacherDashboard } from "./teacherView.js";
import { STORAGE } from "./config.js";

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

const banner = document.getElementById("banner");

/* ---------------------------
   STORAGE
---------------------------- */
/* ---------------------------
   STORAGE
---------------------------- */

// One-time migration from old key to new key
const oldRole = localStorage.getItem("ps_role");
if (oldRole && !localStorage.getItem(STORAGE.role)) {
  localStorage.setItem(STORAGE.role, oldRole);
  localStorage.removeItem("ps_role");
}

function setRole(role) {
  localStorage.setItem(STORAGE.role, role);
}
function getRole() {
  return localStorage.getItem(STORAGE.role) || "";
}
function clearRole() {
  localStorage.removeItem(STORAGE.role);
}
/* ---------------------------
   UI HELPERS
---------------------------- */
function setBanner(msg = "", kind = "info") {
  if (!banner) return;
  if (!msg) {
    banner.style.display = "none";
    banner.textContent = "";
    banner.className = "banner";
    return;
  }
  banner.style.display = "block";
  banner.textContent = msg;
  banner.className = `banner ${kind}`;
}

function hideAll() {
  // We still hide views, but ONLY when we are ready to show the next one.
  viewRole.style.display = "none";
  viewTeacherAuth.style.display = "none";
  viewTeacher.style.display = "none";
  viewPupilAuth.style.display = "none";
  viewPupil.style.display = "none";
}

function show(el) {
  el.style.display = "block";
}

function showRolePicker() {
  hideAll();
  show(viewRole);
  btnSignOut.style.display = "none";
}

function showTeacherAuth() {
  hideAll();
  show(viewTeacherAuth);
  btnSignOut.style.display = "none";
}

function showTeacherView() {
  hideAll();
  show(viewTeacher);
  btnSignOut.style.display = "inline-block";
}

function showPupilAuth() {
  hideAll();
  show(viewPupilAuth);
  btnSignOut.style.display = "none";
}

/* ---------------------------
   TIMEOUT WRAPPER
---------------------------- */
function withTimeout(promise, ms, label = "operation") {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

/* ---------------------------
   ROUTER (never leave UI blank)
---------------------------- */
let routing = false;

async function route(reason = "route") {
  if (routing) return;
  routing = true;

  try {
    const role = getRole();

    // Always keep something visible while we check auth
    // If no role selected yet, just show role picker immediately.
    if (!role) {
      setBanner("");
      showRolePicker();
      return;
    }

    // If pupil, we don't need Supabase auth at all.
    if (role === "pupil") {
      setBanner("");
      showPupilAuth();
      return;
    }

    // Teacher path:
    // Show a loading state (NOT a blank page) while we ask Supabase.
    setBanner("Checking sign-in…", "info");

    // Keep the role picker visible as a safe fallback while loading
    // (prevents “flash then disappear” / blank screen).
    showRolePicker();

    const sessionRes = await withTimeout(
      supabase.auth.getSession(),
      2500,
      "getSession"
    ).catch((err) => ({ data: { session: null }, error: err }));

    const session = sessionRes?.data?.session || null;

    if (!session?.user) {
      setBanner("");
      showTeacherAuth();
      return;
    }

    // Signed in -> show teacher dashboard FIRST, then render it.
    setBanner("");
    showTeacherView();

    // Render dashboard content; if it fails, show the error inside the card.
    await withTimeout(
      renderTeacherDashboard(viewTeacher),
      4000,
      "renderTeacherDashboard"
    ).catch((err) => {
      viewTeacher.innerHTML = `
        <h2>Teacher dashboard</h2>
        <p class="muted">Loaded your session, but the dashboard failed to render.</p>
        <pre style="white-space:pre-wrap;">${escapeHtml(err.message || String(err))}</pre>
      `;
    });
  } finally {
    routing = false;
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------------------
   EVENTS
---------------------------- */
btnTeacher?.addEventListener("click", async () => {
  setRole("teacher");
  await route("click teacher");
});

btnPupil?.addEventListener("click", async () => {
  setRole("pupil");
  await route("click pupil");
});

btnBackFromPupil?.addEventListener("click", async () => {
  clearRole();
  await route("back from pupil");
});

btnGoogle?.addEventListener("click", async () => {
  // IMPORTANT: include redirectTo for GitHub Pages project sites
  const origin = window.location.origin; // https://darren241083.github.io
  let path = window.location.pathname;   // /phoneme-spelling-app/ or /phoneme-spelling-app/index.html
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
  setBanner("");
  showRolePicker();
});

/* ---------------------------
   AUTH + VISIBILITY LISTENERS
---------------------------- */
supabase.auth.onAuthStateChange((event) => {
  // Token refresh / resume events can happen when tab focus changes.
  // Route again, but safely.
  route(`auth:${event}`);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) route("visibilitychange");
});

window.addEventListener("focus", () => route("focus"));

/* ---------------------------
   INIT
---------------------------- */
console.log("app.js loaded");
route("init");
