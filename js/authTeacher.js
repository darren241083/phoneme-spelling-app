import { supabase } from "./supabaseClient.js";

export async function getTeacherSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

export async function teacherSignInGoogle() {
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });
  if (error) throw error;
}

export async function teacherSignOut() {
  await supabase.auth.signOut();
}
