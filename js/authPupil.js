import { supabase } from "./supabaseClient.js";

const KEY = "ps_pupil_session_v2";

export async function pupilLogin(username, pin) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(pin || "").trim();

  if (!u || !p) {
    throw new Error("Enter your username and PIN.");
  }

  const { data, error } = await supabase
    .from("pupils")
    .select("id, username, first_name, surname, must_reset_pin")
    .eq("username", u)
    .eq("pin", p)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Pupil login failed.");
  }

  if (!data) {
    throw new Error("Invalid username or PIN.");
  }

  localStorage.setItem(KEY, JSON.stringify({
    pupil_id: data.id,
    username: data.username,
    first_name: data.first_name || "",
    surname: data.surname || "",
    must_reset_pin: !!data.must_reset_pin
  }));

  return data;
}

export function getPupilSession() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function pupilLogout() {
  localStorage.removeItem(KEY);
}