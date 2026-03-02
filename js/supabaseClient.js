import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { showBanner } from "./ui.js";

// ESM bundle
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Optional: a tiny "ready" promise you can await in app.js if you want
export const supabaseReady = (async () => {
  try {
    await supabase.auth.getSession();
  } catch (e) {
    // Don't throw - just surface it for debugging
    showBanner(`Supabase init warning: ${e?.message || String(e)}`, "warn");
  }
})();

export function wireGlobalAuthErrorHandling() {
  window.addEventListener("unhandledrejection", (e) => {
    showBanner(
      `Unhandled promise rejection: ${e?.reason?.message || String(e?.reason)}`,
      "warn"
    );
  });

  window.addEventListener("error", (e) => {
    showBanner(`Runtime error: ${e?.message || "Unknown error"}`, "warn");
  });
}
