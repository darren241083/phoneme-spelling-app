const ROLE_STORAGE_KEY = "ps_role_v1";
const LEGACY_ROLE_STORAGE_KEY = "ps_role";

const viewRole = document.getElementById("viewRole");
const viewTeacherAuth = document.getElementById("viewTeacherAuth");
const viewTeacher = document.getElementById("viewTeacher");
const viewPupilAuth = document.getElementById("viewPupilAuth");
const viewPupil = document.getElementById("viewPupil");

const btnTeacher = document.getElementById("btnTeacher");
const btnPupil = document.getElementById("btnPupil");
const btnTryLesson = document.getElementById("btnTryLesson");
const btnGoogle = document.getElementById("btnGoogle");
const btnSignOut = document.getElementById("btnSignOut");
const btnBackFromPupil = document.getElementById("btnBackFromPupil");
const btnPupilLogin = document.getElementById("btnPupilLogin");
const pupilUsername = document.getElementById("pupilClassCode");
const pupilPin = document.getElementById("pupilCode");
const pupilAuthMsg = document.getElementById("pupilAuthMsg");
const teacherAuthMsg = document.getElementById("teacherAuthMsg");
const banner = document.getElementById("banner");

const oldRole = localStorage.getItem(LEGACY_ROLE_STORAGE_KEY);
if (oldRole && !localStorage.getItem(ROLE_STORAGE_KEY)) {
  localStorage.setItem(ROLE_STORAGE_KEY, oldRole);
  localStorage.removeItem(LEGACY_ROLE_STORAGE_KEY);
}

let supabasePromise = null;
let teacherDashboardPromise = null;
let pupilViewPromise = null;
let pupilAuthPromise = null;
let accessibilityPromise = null;
let gameRuntimePromise = null;
let authListenerBound = false;
let routing = false;

function getCachedImport(currentPromise, factory, reset) {
  if (!currentPromise) {
    currentPromise = factory().catch((error) => {
      reset();
      throw error;
    });
  }
  return currentPromise;
}

function loadSupabase() {
  supabasePromise = getCachedImport(
    supabasePromise,
    async () => {
      const module = await import("./supabaseClient.js");
      return module.supabase;
    },
    () => {
      supabasePromise = null;
    },
  );
  return supabasePromise;
}

function loadTeacherDashboard() {
  teacherDashboardPromise = getCachedImport(
    teacherDashboardPromise,
    async () => {
      const module = await import("./teacherView.js?v=6.73");
      return module.renderTeacherDashboard;
    },
    () => {
      teacherDashboardPromise = null;
    },
  );
  return teacherDashboardPromise;
}

function loadPupilView() {
  pupilViewPromise = getCachedImport(
    pupilViewPromise,
    async () => {
      const module = await import("./pupilView.js?v=3.40");
      return module.renderPupilView;
    },
    () => {
      pupilViewPromise = null;
    },
  );
  return pupilViewPromise;
}

function loadPupilAuth() {
  pupilAuthPromise = getCachedImport(
    pupilAuthPromise,
    () => import("./authPupil.js?v=1.1"),
    () => {
      pupilAuthPromise = null;
    },
  );
  return pupilAuthPromise;
}

function loadGameRuntime() {
  gameRuntimePromise = getCachedImport(
    gameRuntimePromise,
    () => import("./game.js?v=1.30"),
    () => {
      gameRuntimePromise = null;
    },
  );
  return gameRuntimePromise;
}

function loadAccessibility() {
  accessibilityPromise = getCachedImport(
    accessibilityPromise,
    () => import("./accessibility.js"),
    () => {
      accessibilityPromise = null;
    },
  );
  return accessibilityPromise;
}

async function applyAccessibilitySettingsSafely() {
  try {
    const { applyAccessibilitySettings } = await loadAccessibility();
    applyAccessibilitySettings();
  } catch (error) {
    console.warn("accessibility settings unavailable:", error);
  }
}

async function stopPupilGameplayAudio() {
  try {
    const { cleanupActiveGameplayAudio } = await loadGameRuntime();
    cleanupActiveGameplayAudio();
  } catch (error) {
    console.warn("gameplay audio cleanup unavailable:", error);
  }
}

async function bindAuthStateListener() {
  if (authListenerBound) return;
  try {
    const supabase = await loadSupabase();
    supabase.auth.onAuthStateChange(() => {
      void route();
    });
    authListenerBound = true;
  } catch (error) {
    console.warn("auth listener unavailable:", error);
  }
}

function setRole(role) {
  localStorage.setItem(ROLE_STORAGE_KEY, role);
}

function getRole() {
  return localStorage.getItem(ROLE_STORAGE_KEY) || "";
}

function clearRole() {
  localStorage.removeItem(ROLE_STORAGE_KEY);
}

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

function setNotice(el, msg = "") {
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.textContent = msg;
}

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

function showPupilDashboard() {
  hideAll();
  show(viewPupil);
  btnSignOut.style.display = "inline-block";
}

function withTimeout(promise, ms, label = "operation") {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildTeacherLoadError(error) {
  return `
    <h2>Teacher dashboard</h2>
    <p class="muted">Loaded your session, but the dashboard failed to render.</p>
    <pre style="white-space:pre-wrap;">${escapeHtml(error?.message || String(error))}</pre>
  `;
}

async function route() {
  if (routing) return;
  routing = true;

  try {
    const role = getRole();

    if (!role) {
      setBanner("");
      setNotice(pupilAuthMsg, "");
      setNotice(teacherAuthMsg, "");
      showRolePicker();
      return;
    }

    if (role === "pupil") {
      setBanner("");
      showPupilAuth();

      try {
        const { getPupilSession, validatePupilSession, pupilLogout } = await loadPupilAuth();
        const session = getPupilSession();
        if (!session) return;
        const validatedSession = await validatePupilSession(session);
        if (!validatedSession) {
          await stopPupilGameplayAudio();
          pupilLogout();
          showPupilAuth();
          setNotice(pupilAuthMsg, "This pupil login is no longer active. Please ask a teacher for help.");
          return;
        }

        await applyAccessibilitySettingsSafely();
        showPupilDashboard();
        const renderPupilView = await withTimeout(loadPupilView(), 4000, "load pupil view");
        await renderPupilView(viewPupil, validatedSession);
        setNotice(pupilAuthMsg, "");
      } catch (error) {
        showPupilAuth();
        setNotice(pupilAuthMsg, error?.message || "Could not open the pupil area.");
      }

      return;
    }

    setNotice(teacherAuthMsg, "");
    setBanner("Checking sign-in...", "info");
    showRolePicker();

    let supabase = null;
    try {
      supabase = await withTimeout(loadSupabase(), 4000, "load sign-in");
    } catch (error) {
      setBanner("Teacher sign-in is unavailable right now. Please refresh and try again.", "error");
      showTeacherAuth();
      setNotice(teacherAuthMsg, error?.message || "Could not load teacher sign-in.");
      return;
    }

    const sessionRes = await withTimeout(
      supabase.auth.getSession(),
      2500,
      "getSession",
    ).catch((error) => ({ data: { session: null }, error }));

    const session = sessionRes?.data?.session || null;
    if (!session?.user) {
      setBanner("");
      showTeacherAuth();
      return;
    }

    setBanner("");
    showTeacherView();

    try {
      const renderTeacherDashboard = await withTimeout(loadTeacherDashboard(), 5000, "load teacher dashboard");
      await withTimeout(renderTeacherDashboard(viewTeacher), 8000, "renderTeacherDashboard");
    } catch (error) {
      viewTeacher.innerHTML = buildTeacherLoadError(error);
    }
  } finally {
    routing = false;
  }
}

btnTeacher?.addEventListener("click", async () => {
  setRole("teacher");
  await route();
});

btnPupil?.addEventListener("click", async () => {
  setRole("pupil");
  await route();
});

btnTryLesson?.addEventListener("click", () => {
  const url = new URL("./present.html", window.location.href);
  url.searchParams.set("demo", "focus_sound");
  window.location.href = url.toString();
});

btnBackFromPupil?.addEventListener("click", async () => {
  await stopPupilGameplayAudio();
  try {
    const { pupilLogout } = await loadPupilAuth();
    pupilLogout();
  } catch (error) {
    console.warn("pupil logout unavailable:", error);
  }
  clearRole();
  setNotice(pupilAuthMsg, "");
  await route();
});

btnPupilLogin?.addEventListener("click", async () => {
  const username = String(pupilUsername?.value || "").trim();
  const pin = String(pupilPin?.value || "").trim();

  try {
    const { pupilLogin } = await loadPupilAuth();
    setNotice(pupilAuthMsg, "Signing in...");
    await pupilLogin(username, pin);
    setNotice(pupilAuthMsg, "");
    await route();
  } catch (error) {
    setNotice(pupilAuthMsg, error?.message || "Could not start pupil session.");
  }
});

pupilPin?.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  btnPupilLogin?.click();
});

btnGoogle?.addEventListener("click", async () => {
  try {
    const supabase = await loadSupabase();
    const origin = window.location.origin;
    let path = window.location.pathname;
    if (path.endsWith("/index.html")) path = path.replace("/index.html", "/");
    if (!path.endsWith("/")) path += "/";
    const redirectTo = origin + path;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  } catch (error) {
    setBanner("Google sign-in is unavailable right now. Please refresh and try again.", "error");
    setNotice(teacherAuthMsg, error?.message || "Could not start Google sign-in.");
    showTeacherAuth();
  }
});

btnSignOut?.addEventListener("click", async () => {
  await stopPupilGameplayAudio();
  try {
    const supabase = await loadSupabase();
    await supabase.auth.signOut();
  } catch (error) {
    console.warn("teacher sign-out unavailable:", error);
  }

  try {
    const { pupilLogout } = await loadPupilAuth();
    pupilLogout();
  } catch (error) {
    console.warn("pupil sign-out unavailable:", error);
  }

  clearRole();
  setBanner("");
  setNotice(pupilAuthMsg, "");
  setNotice(teacherAuthMsg, "");
  showRolePicker();
});

void applyAccessibilitySettingsSafely();
void bindAuthStateListener();
void route();
