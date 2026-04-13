import { supabase } from "./js/supabaseClient.js";

function extractFunctionErrorMessage(payload, fallbackStatusText = "") {
  if (!payload) return fallbackStatusText || "Request failed.";
  if (typeof payload === "string") {
    const text = payload || fallbackStatusText || "Request failed.";
    if (/invalid jwt/i.test(String(text))) {
      return "Your teacher session could not be verified. Please sign out and sign in again.";
    }
    return text;
  }

  const direct = [
    payload.error,
    payload.message,
    payload.msg,
    payload.error_description,
    payload.details,
  ].find((value) => typeof value === "string" && value.trim());
  if (direct) return direct.trim();

  if (typeof payload.error === "object" && payload.error) {
    const nested = extractFunctionErrorMessage(payload.error, fallbackStatusText);
    if (nested) return nested;
  }

  const fallback = String(fallbackStatusText || "Request failed.").trim() || "Request failed.";
  if (/invalid jwt/i.test(fallback)) {
    return "Your teacher session could not be verified. Please sign out and sign in again.";
  }

  return fallback;
}

async function callSupabaseFunction(name, body, accessToken = "") {
  const payload = body && typeof body === "object" ? { ...body } : {};
  const authToken = String(accessToken || "").trim();
  const { data, error } = await supabase.functions.invoke(name, {
    body: payload,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });

  if (error) {
    let errorPayload = null;
    if (error.context && typeof error.context.text === "function") {
      const rawText = await error.context.text().catch(() => "");
      if (rawText) {
        try {
          errorPayload = JSON.parse(rawText);
        } catch {
          errorPayload = rawText;
        }
      }
    }
    const message = extractFunctionErrorMessage(errorPayload, error.message || "AI request failed.");
    throw new Error(message || "AI request failed.");
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  return data;
}

export async function aiSuggest(prompt) {
  const data = await callSupabaseFunction("ai-suggest", { prompt });
  return data.result || "";
}

export async function teacherAnalyticsChat({ question, scopeType = "overview", scopeId = null, scopeLabel = "", history = [], accessToken = "" }) {
  return callSupabaseFunction("teacher-analytics-chat", {
    question,
    scopeType,
    scopeId,
    scopeLabel,
    history,
  }, accessToken);
}

export async function fetchTeacherGroupComparison({
  groupType = "pp",
  filters = {},
  accessToken = "",
}) {
  return callSupabaseFunction("group-comparison", {
    groupType,
    filters,
  }, accessToken);
}

export async function manageDemoSchoolData({ action = "seed", accessToken = "" }) {
  return callSupabaseFunction("demo-school-data", {
    action,
  }, accessToken);
}
