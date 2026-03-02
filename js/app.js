import { getTeacherSession, teacherSignInGoogle, teacherSignOut } from "./authTeacher.js";
import { pupilLogin, pupilLogout, getPupilSession } from "./authPupil.js";
import { renderTeacherView } from "./teacherView.js";
import { renderPupilView } from "./pupilView.js";

const ROLE_KEY = "ps_role";

const $ = (id) => document.getElementById(id);

// Views (must match index.html exactly)
const viewRole = $("viewRole");
const viewTeacherAuth = $("viewTeacherAuth");
const viewTeacher = $("viewTeacher");
const viewPupilAuth = $("viewPupilAuth");
const viewPupil = $("viewPupil");

// Buttons
const btnTeacher = $("btnTeacher");
const btnPupil = $("btnPupil");
const btnGoogle = $("btnGoogle");
const btnPupilLogin = $("btnPupilLogin");
const btnBackFromPupil = $("btnBackFromPupil");
const btnSignOut = $("btnSignOut");

// Inputs
const pupilClassCode = $("pupilClassCode");
const pupilCode = $("pupilCode");

// Notices
const teacherAuthMsg = $("teacherAuthMsg");
const pupilAuthMsg = $("pupilAuthMsg");

function setRole(role) {
  localStorage.setItem(ROLE_KEY, role);
}

function getRole() {
  return localStorage.getItem(ROLE_KEY);
}

function clearRole() {
  localStorage.removeItem(ROLE_KEY);
}

function hideAll() {
  [viewRole, viewTeacherAuth, viewTeacher, viewPupilAuth, viewPupil]
    .forEach(v => v.style.display = "none");
}

function show(view) {
  hideAll();
  view.style.display = "block";
}

function setNotice(el, msg) {
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.textContent = msg;
}

function setSignOutVisible(v) {
  btnSignOut.style.display = v ? "inline-flex" : "none";
}

async function route() {
  const role = getRole();

  if (!role) {
    setSignOutVisible(false);
    show(viewRole);
    return;
  }

  if (role === "teacher") {
    const session = await getTeacherSession();

    if (!session) {
      setSignOutVisible(false);
      show(viewTeacherAuth);
      return;
    }

    setSignOutVisible(true);
    show(viewTeacher);
    await renderTeacherView(viewTeacher, session);
    return;
  }

  if (role === "pupil") {
    const pupil = await getPupilSession();

    if (!pupil) {
      setSignOutVisible(false);
      show(viewPupilAuth);
      return;
    }

    setSignOutVisible(true);
    show(viewPupil);
    await renderPupilView(viewPupil, pupil);
    return;
  }

  clearRole();
  show(viewRole);
}

// Events
btnTeacher.addEventListener("click", async () => {
  setRole("teacher");
  await route();
});

btnPupil.addEventListener("click", async () => {
  setRole("pupil");
  await route();
});

btnGoogle.addEventListener("click", async () => {
  setNotice(teacherAuthMsg, null);
  try {
    await teacherSignInGoogle();
  } catch (e) {
    setNotice(teacherAuthMsg, e.message);
  }
});

btnBackFromPupil.addEventListener("click", async () => {
  clearRole();
  await route();
});

btnPupilLogin.addEventListener("click", async () => {
  setNotice(pupilAuthMsg, null);

  const classCode = pupilClassCode.value.trim();
  const code = pupilCode.value.trim();

  if (!classCode || !code) {
    setNotice(pupilAuthMsg, "Enter class code and pupil code.");
    return;
  }

  try {
    await pupilLogin(classCode, code);
    await route();
  } catch (e) {
    setNotice(pupilAuthMsg, e.message);
  }
});

btnSignOut.addEventListener("click", async () => {
  const role = getRole();
  if (role === "teacher") await teacherSignOut();
  if (role === "pupil") await pupilLogout();
  clearRole();
  await route();
});

window.addEventListener("load", route);
