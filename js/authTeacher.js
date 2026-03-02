// js/authTeacher.js
import { supabase } from "./supabaseClient.js";

/**
 * GitHub Pages project sites need redirectTo to include the repo path,
 * e.g. https://darren241083.github.io/phoneme-spelling-app/
 */
export function getRedirectTo() {
  const origin = window.location.origin;          // https://darren241083.github.io
  let path = window.location.pathname;            // /phoneme-spelling-app/  (or /phoneme-spelling-app/index.html)

  // If you're on /phoneme-spelling-app/index.html, trim to folder
  if (path.endsWith("/index.html")) path = path.replace("/index.html", "/");

  // Ensure trailing slash so it matches allowed redirect URL
  if (!path.endsWith("/")) path += "/";

  return origin + path;
}

export async function teacherSignInGoogle() {
  const redirectTo = getRedirectTo();
  // Helpful for debugging in console:
  console.log("OAuth redirectTo =", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });

  if (error) throw error;
  return data;
}

export async function teacherSignOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
