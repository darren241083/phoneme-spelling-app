const KEY = "ps_pupil_session";

export async function pupilLogin(classCode, pupilCode) {
  // Minimal placeholder logic — replace with real DB check later
  if (classCode.length < 3 || pupilCode.length < 2) {
    throw new Error("Invalid class or pupil code.");
  }

  localStorage.setItem(KEY, JSON.stringify({ classCode, pupilCode }));
}

export async function getPupilSession() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function pupilLogout() {
  localStorage.removeItem(KEY);
}
