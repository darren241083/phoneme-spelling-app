import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { showBanner } from "./ui.js";

// ESM bundle
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export function wireGlobalAuthErrorHandling(){
  window.addEventListener("unhandledrejection", (e)=>{
    showBanner(`Unhandled promise rejection: ${e?.reason?.message || String(e?.reason)}`);
  });
  window.addEventListener("error", (e)=>{
    showBanner(`Runtime error: ${e?.message || "Unknown error"}`);
  });
}
