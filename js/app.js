import { supabase } from "./supabaseClient.js";
import { renderTeacherDashboard } from "./teacherView.js";

/* ---------------------------
   DEBUG (lets Console access supabase)
---------------------------- */
window.__supabase = supabase; // use __supabase in DevTools Console

/* ---------------------------
   DOM ELEMENTS
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
   STORAGE (CONSISTENT)
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
  // guard against nulls (prevents silent breakage)
  [viewRole, viewTeacherAuth, viewTeacher, viewPupilAuth, viewPupil].forEach((el) => {
    if (el) el.style.display = "none";
  });
}

function show(el) {
  if (el) el.style.display = "block";
}

/* ---------------------------
   AUTH HELPERS
---------------------------- */
async function safeGetUser() {
  try {
    const res = await supabase.auth.getUser();
    return res?.data?.user ?? null;
  } catch (e) {
    console.error("safeGetUser failed:", e);
    return null;
  }
}

function getRedirectTo() {
  // GitHub Pages project site safe redirect
  const origin = window.location.origin;     // https://darren241083.github.io
  let path = window.location.pathname;       // /phoneme-spelling-app/ or /phoneme-spelling-app/index.html

  if (path.endsWith("/index.html")) path = path.replace("/index.html", "/");
  if (!path.endsWith("/")) path += "/";

  return origin + path; // must match Supabase allowlist
}

/* ---------------------------
   ROUTER (MUST ALWAYS SHOW SOMETHING)
---------------------------- */
async function route() {
  try {
    hideAll();

    const role = getRole();
    const user = await safeGetUser();

    // If role is missing, always show role chooser
    if (!role) {
      btnSignOut && (btnSignOut.style.display = "none");
      show(viewRole);
      return;
    }

    // TEACHER
    if (role === "teacher") {
      // not signed in -> show teacher auth
      if (!user) {
        btnSignOut && (btnSignOut.style.display = "none");
        show(viewTeacherAuth);
        return;
      }

      // signed in -> show dashboard
      btnSignOut && (btnSignOut.style.display = "inline-block");
      show(viewTeacher);

      // render dashboard (guard so failure doesn't blank the UI)
      try {
        await renderTeacherDashboard(viewTeacher);
      } catch (e) {
        console.error("renderTeacherDashboard failed:", e);
        viewTeacher.innerHTML = `
          <h2>Teacher dashboard</h2>
          <p class="muted">Signed in, but dashboard failed to load.</p>
          <pre style="white-space:pre-wrap;opacity:.7">${String(e)}</pre>
        `;
      }
      return;
    }

    // PUPIL
    if (role === "pupil") {
      btnSignOut && (btnSignOut.style.display = "none");
      show(viewPupilAuth);
      return;
    }

    // unknown role -> reset
    clearRole();
    btnSignOut && (btnSignOut.style.display = "none");
    show(viewRole);
  } catch (e) {
    // absolute fallback: never leave blank screen
    console.error("route() crashed:", e);
    clearRole();
    hideAll();
    btnSignOut && (btnSignOut.style.display = "none");
    show(viewRole);
  }
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
  const redirectTo = getRedirectTo();
  console.log("OAuth redirectTo =", redirectTo);

  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
});

btnSignOut?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  clearRole();
  await route();
});

/* ---------------------------
   AUTH LISTENER
---------------------------- */
supabase.auth.onAuthStateChange(async (event) => {
  console.log("auth state:", event);
  await route();
});

/* ---------------------------
   INIT
---------------------------- */
console.log("app.js loaded");
route();
