import { supabase } from "./supabaseClient.js";
import { renderTeacherDashboard } from "./teacherView.js";

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
   STORAGE (FIXED + CONSISTENT)
---------------------------- */

const ROLE_KEY = "ps_role";

function setRole(role) {
  localStorage.setItem(ROLE_KEY, role);
}

function getRole() {
  return localStorage.getItem(ROLE_KEY);
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

  if (!role) {
    show(viewRole);
    btnSignOut.style.display = "none";
    return;
  }

  if (role === "teacher") {
    if (!user) {
      show(viewTeacherAuth);
      btnSignOut.style.display = "none";
      return;
    }

    show(viewTeacher);
    btnSignOut.style.display = "inline-block";
    await renderTeacherDashboard(viewTeacher);
    return;
  }

  if (role === "pupil") {
    show(viewPupilAuth);
    btnSignOut.style.display = "none";
    return;
  }

  // fallback
  clearRole();
  show(viewRole);
}

/* ---------------------------
   EVENTS
---------------------------- */

btnTeacher.addEventListener("click", async () => {
  setRole("teacher");
  await route();
});

btnPupil.addEventListener("click", async () => {
  setRole("pupil");
  await route();
});

btnBackFromPupil?.addEventListener("click", async () => {
  clearRole();
  await route();
});

btnGoogle?.addEventListener("click", async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google"
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

supabase.auth.onAuthStateChange(async () => {
  await route();
});

/* ---------------------------
   INIT
---------------------------- */

console.log("app.js loaded");
route();
