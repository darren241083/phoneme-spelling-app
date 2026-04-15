import { supabase } from "./supabaseClient.js";

const KEY = "ps_pupil_session_v2";

function normalizePupilSessionPayload(data) {
  const row = data && typeof data === "object" ? data : {};
  return {
    pupil_id: String(row?.pupil_id || row?.id || "").trim(),
    username: String(row?.username || "").trim().toLowerCase(),
    first_name: String(row?.first_name || "").trim(),
    surname: String(row?.surname || "").trim(),
    must_reset_pin: !!row?.must_reset_pin,
  };
}

function persistPupilSession(data) {
  const session = normalizePupilSessionPayload(data);
  if (!session.pupil_id || !session.username) {
    throw new Error("Pupil login failed.");
  }

  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

function isMissingPupilRpcError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "42883"
    || code === "PGRST202"
    || message.includes("authenticate_pupil")
    || message.includes("validate_pupil_runtime_session");
}

export async function pupilLogin(username, pin) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(pin || "").trim();

  if (!u || !p) {
    throw new Error("Enter your username and PIN.");
  }

  const { data, error } = await supabase.rpc("authenticate_pupil", {
    requested_username: u,
    requested_pin: p,
  });

  if (error) {
    if (isMissingPupilRpcError(error)) {
      throw new Error("Pupil sign-in is not available until the latest database migration is applied.");
    }
    throw new Error(error.message || "Pupil login failed.");
  }

  if (!data) {
    throw new Error("Invalid username or PIN.");
  }

  return persistPupilSession(data);
}

export function getPupilSession() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export async function validatePupilSession(session = getPupilSession()) {
  const safePupilId = String(session?.pupil_id || "").trim();
  if (!safePupilId) return null;

  const { data, error } = await supabase.rpc("validate_pupil_runtime_session", {
    requested_pupil_id: safePupilId,
  });

  if (error) {
    if (isMissingPupilRpcError(error)) {
      throw new Error("Pupil sign-in is not available until the latest database migration is applied.");
    }
    throw new Error(error.message || "Could not validate the pupil session.");
  }

  if (!data) {
    return null;
  }

  return persistPupilSession(data);
}

export function pupilLogout() {
  localStorage.removeItem(KEY);
}
