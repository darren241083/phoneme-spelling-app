// /js/db.js
import { supabase } from "./supabaseClient.js";

/* ---------------------------
   Helpers
---------------------------- */

function requireUserId(user) {
  const id = user?.id;
  if (!id) throw new Error("Not signed in.");
  return id;
}

function randomJoinCode(len = 6) {
  // Friendly uppercase codes (no O/0, I/1 confusion)
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/* ---------------------------
   Classes
---------------------------- */

export async function createClass({ name }) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const teacherId = requireUserId(userRes?.user);

  const className = (name || "").trim() || "New class";

  // Try a few times in case join_code clashes with UNIQUE constraint
  let lastErr = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const join_code = randomJoinCode(6);

    const { data, error } = await supabase
      .from("classes")
      .insert([{ teacher_id: teacherId, name: className, join_code }])
      .select("*")
      .single();

    if (!error) return data;

    lastErr = error;

    // If it's a unique violation on join_code, retry
    // (Postgres unique violation is 23505)
    if (error.code === "23505") continue;

    throw error;
  }

  throw lastErr || new Error("Failed to create class (unknown error).");
}

export async function listClasses() {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const teacherId = requireUserId(userRes?.user);

  const { data, error } = await supabase
    .from("classes")
    .select("id, name, join_code, created_at")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/* ---------------------------
   Tests
---------------------------- */

export async function createTest({ title }) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const teacherId = requireUserId(userRes?.user);

  const testTitle = (title || "").trim() || "New test";

  const { data, error } = await supabase
    .from("tests")
    .insert([{ teacher_id: teacherId, title: testTitle }])
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function listTests() {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const teacherId = requireUserId(userRes?.user);

  const { data, error } = await supabase
    .from("tests")
    .select("id, title, created_at")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}
