const authLink = document.querySelector("[data-homepage-auth-link]");

const LOGIN_HREF = "./login.html";
const LOGIN_TEXT = "Log in";
const OPEN_APP_TEXT = "Dashboard";
const OPEN_APP_LABEL = "Open Wordloom dashboard";
const STAFF_ROLE_HINT = "teacher";

let roleStorageKey = "";
let hasStaffSession = false;

function setLoggedOutState() {
  hasStaffSession = false;
  if (!authLink) return;
  authLink.textContent = LOGIN_TEXT;
  authLink.setAttribute("href", LOGIN_HREF);
  authLink.removeAttribute("aria-label");
}

function setLoggedInState() {
  hasStaffSession = true;
  if (!authLink) return;
  authLink.textContent = OPEN_APP_TEXT;
  authLink.setAttribute("href", LOGIN_HREF);
  authLink.setAttribute("aria-label", OPEN_APP_LABEL);
}

function updateHeaderForSession(session = null) {
  if (session?.user) {
    setLoggedInState();
    return;
  }

  setLoggedOutState();
}

function writeStaffRoleHint() {
  if (!hasStaffSession || !roleStorageKey) return;

  try {
    window.localStorage?.setItem(roleStorageKey, STAFF_ROLE_HINT);
  } catch (_error) {
    // The login page still handles routing if localStorage is unavailable.
  }
}

async function loadHomepageAuthDependencies() {
  const [{ supabase }, configModule] = await Promise.all([
    import("./supabaseClient.js"),
    import("./config.js"),
  ]);

  roleStorageKey = String(configModule?.STORAGE?.role || "").trim();
  return supabase;
}

function bindAuthStateListener(supabase) {
  try {
    supabase?.auth?.onAuthStateChange?.((_event, session) => {
      updateHeaderForSession(session);
    });
  } catch (_error) {
    // This enhancement should never block or noisily affect the public homepage.
  }
}

async function initHomepageAuth() {
  if (!authLink) return;

  setLoggedOutState();
  authLink.addEventListener("click", writeStaffRoleHint);

  try {
    const supabase = await loadHomepageAuthDependencies();
    bindAuthStateListener(supabase);

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setLoggedOutState();
      return;
    }

    updateHeaderForSession(data?.session || null);
  } catch (_error) {
    setLoggedOutState();
  }
}

void initHomepageAuth();
