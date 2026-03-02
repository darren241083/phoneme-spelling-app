console.log("app.js is running");

/* =========================
   STORAGE
========================= */

const ROLE_KEY = "role";

/* =========================
   HELPERS
========================= */

function setRole(role) {
  localStorage.setItem(ROLE_KEY, role);
}

function getRole() {
  return localStorage.getItem(ROLE_KEY) || "";
}

function clearRole() {
  localStorage.removeItem(ROLE_KEY);
}

/* =========================
   VIEW HELPERS
========================= */

function hideAllViews() {
  document.getElementById("viewRole").style.display = "none";
  document.getElementById("viewTeacherAuth").style.display = "none";
  document.getElementById("viewTeacher").style.display = "none";
  document.getElementById("viewPupilAuth").style.display = "none";
  document.getElementById("viewPupil").style.display = "none";
}

function route() {
  const role = getRole();

  hideAllViews();

  if (!role) {
    document.getElementById("viewRole").style.display = "block";
    return;
  }

  if (role === "teacher") {
    document.getElementById("viewTeacherAuth").style.display = "block";
    return;
  }

  if (role === "pupil") {
    document.getElementById("viewPupilAuth").style.display = "block";
    return;
  }

  // fallback safety
  clearRole();
  document.getElementById("viewRole").style.display = "block";
}

/* =========================
   BUTTON WIRING
========================= */

function wireButtons() {
  const btnTeacher = document.getElementById("btnTeacher");
  const btnPupil = document.getElementById("btnPupil");
  const btnBackFromPupil = document.getElementById("btnBackFromPupil");
  const btnSignOut = document.getElementById("btnSignOut");

  if (btnTeacher) {
    btnTeacher.addEventListener("click", () => {
      setRole("teacher");
      route();
    });
  }

  if (btnPupil) {
    btnPupil.addEventListener("click", () => {
      setRole("pupil");
      route();
    });
  }

  if (btnBackFromPupil) {
    btnBackFromPupil.addEventListener("click", () => {
      clearRole();
      route();
    });
  }

  if (btnSignOut) {
    btnSignOut.addEventListener("click", () => {
      clearRole();
      route();
    });
  }
}

/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", () => {
  wireButtons();
  route();
});
