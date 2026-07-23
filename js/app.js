const ROLE_STORAGE_KEY = "ps_role_v1";
const LEGACY_ROLE_STORAGE_KEY = "ps_role";
const PUPIL_SESSION_STORAGE_KEY = "ps_pupil_session_v2";

const viewLogin = document.getElementById("viewLogin");
const viewTeacher = document.getElementById("viewTeacher");
const viewPupil = document.getElementById("viewPupil");

const btnGoogle = document.getElementById("btnGoogle");
const credentialLoginForm = document.getElementById("credentialLoginForm");
const btnCredentialLogin = document.getElementById("btnCredentialLogin");
const btnSignOut = document.getElementById("btnSignOut");
const loginIdentifier = document.getElementById("pupilClassCode");
const loginPassword = document.getElementById("pupilCode");
const loginAuthMsg = document.getElementById("loginAuthMsg");
const pupilAuthMsg = loginAuthMsg;
const teacherAuthMsg = loginAuthMsg;
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
let displayedTeacherUserId = "";

function buildLoginRedirectTo() {
  const origin = window.location.origin;
  let path = window.location.pathname || "/";

  if (path.endsWith("/index.html")) {
    path = path.replace(/index\.html$/, "login.html");
  } else if (!path.endsWith("/login.html")) {
    path = path.endsWith("/") ? `${path}login.html` : `${path}/login.html`;
  }

  return origin + path;
}
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
      const module = await import("./teacherView.js?v=7.12");
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
      const module = await import("./pupilView.js?v=3.76");
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
    () => import("./authPupil.js?v=1.2"),
    () => {
      pupilAuthPromise = null;
    },
  );
  return pupilAuthPromise;
}

function loadGameRuntime() {
  gameRuntimePromise = getCachedImport(
    gameRuntimePromise,
    () => import("./game.js?v=1.47"),
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

function shouldSkipAuthRouteForEvent({
  authEvent = "",
  sessionUserId = "",
  role = "",
  currentTeacherUserId = "",
  teacherDashboardVisible = false,
} = {}) {
  const event = String(authEvent || "").trim().toUpperCase();
  const completedTeacherDashboardMatchesSession = String(role || "") === "teacher"
    && teacherDashboardVisible === true
    && !!String(currentTeacherUserId || "").trim()
    && String(sessionUserId || "").trim() === String(currentTeacherUserId || "").trim();
  return (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")
    && completedTeacherDashboardMatchesSession;
}

async function bindAuthStateListener() {
  if (authListenerBound) return;
  try {
    const supabase = await loadSupabase();
    supabase.auth.onAuthStateChange((event, session) => {
      if (shouldSkipAuthRouteForEvent({
        authEvent: event,
        sessionUserId: session?.user?.id,
        role: getRole(),
        currentTeacherUserId: displayedTeacherUserId,
        teacherDashboardVisible: !!viewTeacher && viewTeacher.style.display !== "none",
      })) {
        return;
      }
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

function hasStoredPupilSessionHint() {
  try {
    return !!localStorage.getItem(PUPIL_SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not read pupil session hint:", error);
    return false;
  }
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
  viewLogin.style.display = "none";
  viewTeacher.style.display = "none";
  viewPupil.style.display = "none";
}

function show(el) {
  el.style.display = "block";
}

function showLoginScreen() {
  hideAll();
  show(viewLogin);
  btnSignOut.style.display = "none";
}

function showTeacherView() {
  hideAll();
  show(viewTeacher);
  btnSignOut.style.display = "inline-block";
}

function showPupilDashboard() {
  hideAll();
  show(viewPupil);
  btnSignOut.style.display = "inline-block";
}

function withTimeout(promise, ms, label = "operation", {
  getLastStage = null,
  logLateOutcome = false,
} = {}) {
  let timeoutId = null;
  let timedOut = false;
  const observedPromise = Promise.resolve(promise);

  if (logLateOutcome) {
    observedPromise.then(
      () => {
        if (!timedOut) return;
        console.warn(`${label} resolved after timeout`, {
          lastStage: typeof getLastStage === "function" ? getLastStage() : "",
        });
      },
      (error) => {
        if (!timedOut) return;
        console.error(`${label} rejected after timeout`, {
          lastStage: typeof getLastStage === "function" ? getLastStage() : "",
          error,
        });
      },
    );
  }

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      const lastStage = typeof getLastStage === "function"
        ? String(getLastStage() || "").trim()
        : "";
      console.error(`${label} timed out`, {
        timeoutMs: ms,
        lastStage,
      });
      reject(new Error(
        `${label} timed out after ${ms}ms${lastStage ? ` (last stage: ${lastStage})` : ""}`
      ));
    }, ms);
  });
  return Promise.race([observedPromise, timeout]).finally(() => clearTimeout(timeoutId));
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

async function readCurrentStaffSession({ reportErrors = true } = {}) {
  let supabase = null;
  try {
    supabase = await withTimeout(loadSupabase(), 4000, "load sign-in");
  } catch (error) {
    if (reportErrors) {
      setBanner("Teacher sign-in is unavailable right now. Please refresh and try again.", "error");
      showLoginScreen();
      setNotice(teacherAuthMsg, error?.message || "Could not load teacher sign-in.");
    }
    return null;
  }

  const sessionRes = await withTimeout(
    supabase.auth.getSession(),
    2500,
    "getSession",
  ).catch((error) => ({ data: { session: null }, error }));

  if (sessionRes?.error && reportErrors) {
    setNotice(teacherAuthMsg, sessionRes.error?.message || "Could not check teacher sign-in.");
  }

  return sessionRes?.data?.session || null;
}

async function renderTeacherDashboardForSession(session) {
  setBanner("");
  showTeacherView();

  try {
    const renderTeacherDashboard = await withTimeout(loadTeacherDashboard(), 5000, "load teacher dashboard");
    let lastRenderStage = "starting";
    const renderPromise = renderTeacherDashboard(viewTeacher, {
      onStage(stage) {
        lastRenderStage = String(stage || lastRenderStage);
      },
    });
    await withTimeout(renderPromise, 8000, "renderTeacherDashboard", {
      getLastStage: () => lastRenderStage,
      logLateOutcome: true,
    });
    displayedTeacherUserId = String(session?.user?.id || "").trim();
  } catch (error) {
    displayedTeacherUserId = "";
    viewTeacher.innerHTML = buildTeacherLoadError(error);
  }
}

async function tryRenderStoredPupilSession({ rememberRole = false } = {}) {
  displayedTeacherUserId = "";
  setBanner("");

  try {
    const { getPupilSession, validatePupilSession, pupilLogout } = await loadPupilAuth();
    const session = getPupilSession();
    if (!session) return false;

    const validatedSession = await validatePupilSession(session);
    if (!validatedSession) {
      await stopPupilGameplayAudio();
      pupilLogout();
      showLoginScreen();
      setNotice(pupilAuthMsg, "This pupil login is no longer active. Please ask a teacher for help.");
      return true;
    }

    if (rememberRole) setRole("pupil");
    await applyAccessibilitySettingsSafely();
    showPupilDashboard();
    const renderPupilView = await withTimeout(loadPupilView(), 4000, "load pupil view");
    await renderPupilView(viewPupil, validatedSession);
    setNotice(pupilAuthMsg, "");
    return true;
  } catch (error) {
    showLoginScreen();
    setNotice(pupilAuthMsg, error?.message || "Could not open the pupil area.");
    return true;
  }
}

async function route() {
  if (routing) return;
  routing = true;

  try {
    const role = getRole();

    if (role === "pupil") {
      const displayedPupilSession = await tryRenderStoredPupilSession();
      if (displayedPupilSession) return;

      const storedStaffSession = await readCurrentStaffSession({ reportErrors: false });
      if (storedStaffSession?.user) {
        setRole("teacher");
        await renderTeacherDashboardForSession(storedStaffSession);
        return;
      }

      showLoginScreen();
      return;
    }

    if (role) {
      setNotice(teacherAuthMsg, "");
      displayedTeacherUserId = "";
      setBanner("Checking sign-in...", "info");
      showLoginScreen();
      const session = await readCurrentStaffSession({ reportErrors: true });
      if (!session?.user) {
        displayedTeacherUserId = "";
        setBanner("");
        showLoginScreen();
        return;
      }
      await renderTeacherDashboardForSession(session);
      return;
    }

    displayedTeacherUserId = "";
    setBanner("");
    setNotice(pupilAuthMsg, "");
    setNotice(teacherAuthMsg, "");
    showLoginScreen();

    const automaticStaffSession = await readCurrentStaffSession({ reportErrors: false });
    if (automaticStaffSession?.user) {
      setRole("teacher");
      await renderTeacherDashboardForSession(automaticStaffSession);
      return;
    }

    if (hasStoredPupilSessionHint()) {
      const displayedPupilSession = await tryRenderStoredPupilSession({ rememberRole: true });
      if (displayedPupilSession) return;
    }

    showLoginScreen();
  } finally {
    routing = false;
  }
}

credentialLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const identifier = String(loginIdentifier?.value || "").trim();
  const password = String(loginPassword?.value || "");
  if (!identifier || !password.trim()) {
    setNotice(loginAuthMsg, "Enter your login details.");
    return;
  }

  const previousText = btnCredentialLogin?.textContent || "";
  const isStaffLogin = identifier.includes("@");
  try {
    if (btnCredentialLogin) {
      btnCredentialLogin.disabled = true;
      btnCredentialLogin.textContent = "Signing in...";
    }
    setNotice(loginAuthMsg, "Signing in...");

    if (isStaffLogin) {
      const email = identifier.toLowerCase();
      const supabase = await loadSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setRole("teacher");
    } else {
      const username = identifier;
      const pin = password.trim();
      const { pupilLogin } = await loadPupilAuth();
      await pupilLogin(username, pin);
      setRole("pupil");
    }

    if (loginPassword) loginPassword.value = "";
    setNotice(loginAuthMsg, "");
    await route();
  } catch (error) {
    setNotice(loginAuthMsg, error?.message || "Could not sign in with those details.");
  } finally {
    if (btnCredentialLogin) {
      btnCredentialLogin.disabled = false;
      btnCredentialLogin.textContent = previousText || "Sign in";
    }
  }
});

btnGoogle?.addEventListener("click", async () => {
  try {
    const supabase = await loadSupabase();
    const redirectTo = buildLoginRedirectTo();

    setRole("teacher");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
  } catch (error) {
    setBanner("Google sign-in is unavailable right now. Please refresh and try again.", "error");
    setNotice(teacherAuthMsg, error?.message || "Could not start Google sign-in.");
    showLoginScreen();
  }
});

btnSignOut?.addEventListener("click", async () => {
  const role = getRole();
  await stopPupilGameplayAudio();

  if (role === "pupil") {
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
    showLoginScreen();

    try {
      const supabase = await loadSupabase();
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("pupil Supabase sign-out unavailable:", error);
    }
    return;
  }

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
  showLoginScreen();
});

void applyAccessibilitySettingsSafely();
void bindAuthStateListener();
void route();
