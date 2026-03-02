import { supabase } from "./supabaseClient.js";

export async function teacherSignInGoogle(){
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });
  if (error) throw error;
}

export async function signOut(){
  await supabase.auth.signOut();
}

export async function getSession(){
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
