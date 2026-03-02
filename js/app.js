// ./js/app.js
import { showBanner, hideBanner } from "./ui.js";
import { getTeacherSession, teacherSignInGoogle, teacherSignOut } from "./authTeacher.js";
import { pupilLogin, pupilLogout, getPupilSession } from "./authPupil.js";
import { renderTeacherView } from "./teacherView.js";
import { renderPupilView } from "./pupilView.js";

/**
 * IMPORTANT:
 * We store the role using ONE key only.
 * This fixes the "setRole works but getRole is null" bug.
 */
const ROLE_KEY = "ps_role"; // <- one source of truth

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);

// Views (match your index.html exactly)
const viewRole = $("viewRole");
const viewTeacherAuth = $("viewTeacherAuth");
const viewTeacher = $("viewTeacher");
const viewPupilAuth = $("viewPupilAuth");
const viewPupil = $("viewPupil");

// Buttons (match your index.html exactly)
const btnTeacher = $("btnTeacher");
const btnPupil = $("btnPupil");
const btnGoogle = $("btnGoogle");
const btnPupilLogin = $("btnPupilLogin");
const btnBackFromPupil = $("btnBackFromPupil");
const btnSignOut = $("btnSignOut");

// Pupil inputs
const pupilClassCode = $("pupilClassCode");
const pupilCode = $("pupilCode");

// Notices
const teacherAuthMsg = $("teacherAuthMsg");
const pupilAuthMsg = $("pupilAuthMsg");

// Banner (optional)
const banner = $("banner");

// ---------- Helpers ----------
function setRole(role) {
  localStorage.setItem(ROLE_KEY, role);
}

function getRole() {
  return localStorage.getItem(ROLE_KEY) || "";
}

function clearRole() {
  localStorage.removeItem(ROLE_KEY);
}

function showOnly(viewEl) {
  const all = [viewRole, viewTeacherAuth, viewTeacher, viewPupilAuth, viewPupil];
  all.forEach((v) => (v.style.display = "none"));
  viewEl.style.display = "block";
}

function setNotice(el, msg) {
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.textContent = msg;
}

function setSignOutVisible(isVisible) {
  btnSignOut.style.display = isVisible ? "inline-flex" : "none";
}

// ---------- Routing ----------
async function route() {
  // Always clear any inline notices on route
  setNotice(teacherAuthMsg, null);
  setNotice(pupilAuthMsg, null);
  hideBanner?.();

  const role = getRole();

  // If no role chosen yet -> show role picker
  if (!role) {
    setSignOutVisible(false);
    showOnly(viewRole);
    return;
  }

  // TEACHER FLOW
  if (role === "teacher") {
    const session = await getTeacherSession().catch(() => null);

    if (!session) {
      setSignOutVisible(false);
      showOnly(viewTeacherAuth);
      return;
    }

    // Signed in teacher -> dashboard
    setSignOutVisible(true);
    showOnly(viewTeacher);

    // Render teacher UI
    await renderTeacherView({
      mount: viewTeacher,
      session,
      onSignOut: async () => {
        await teacherSignOut();
        clearRole();
        await route();
      },
      onToast: (msg) => showBanner?.(msg),
    });

    return;
  }

  // PUPIL FLOW
  if (role === "pupil") {
    const pupilSession = await getPupilSession().catch(() => null);

    if (!pupilSession) {
      setSignOutVisible(false);
      showOnly(viewPupilAuth);
      return;
    }

    setSignOutVisible(true);
    showOnly(viewPupil);

    await renderPupilView({
      mount: viewPupil,
      pupil: pupilSession,
      onSignOut: async () => {
        await pupilLogout();
        clearRole();
        await route();
      },
      onToast: (msg) => showBanner?.(msg),
    });

    return;
  }

  // Unknown role -> reset
  clearRole();
  setSignOutVisible(false);
  showOnly(viewRole);
}

// ---------- Events ----------
btnTeacher?.addEventListener("click", async () => {
  setRole("teacher");
  await route();
});

btnPupil?.addEventListener("click", async () => {
  setRole("pupil");
  await route();
});

btnGoogle?.addEventListener("click", async () => {
  try {
    setNotice(teacherAuthMsg, null);
    await teacherSignInGoogle();
    // redirect happens; if not, route again
    await route();
  } catch (e) {
    setNotice(teacherAuthMsg, e?.message || "Google sign-in failed.");
  }
});

btnBackFromPupil?.addEventListener("click", async () => {
  clearRole();
  await route();
});

btnPupilLogin?.addEventListener("click", async () => {
  try {
    setNotice(pupilAuthMsg, null);

    const classCode = (pupilClassCode?.value || "").trim();
    const code = (pupilCode?.value || "").trim();

    if (!classCode || !code) {
      setNotice(pupilAuthMsg, "Please enter both class code and pupil code.");
      return;
    }

    await pupilLogin({ classCode, pupilCode: code });
    await route();
  } catch (e) {
    setNotice(pupilAuthMsg, e?.message || "Pupil login failed.");
  }
});

// One sign-out button for whichever role is active
btnSignOut?.addEventListener("click", async () => {
  const role = getRole();
  try {
    if (role === "teacher") await teacherSignOut();
    if (role === "pupil") await pupilLogout();
  } finally {
    clearRole();
    await route();
  }
});

// ---------- Init ----------
console.log("app.js is running");

window.addEventListener("load", () => {
  route();
});
