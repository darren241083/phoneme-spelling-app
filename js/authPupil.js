import { supabase } from "./supabaseClient.js";

/**
 * Pupils sign in anonymously, then "claim" their pupil record
 * using class_code + pupil_code via RPC (security definer).
 */
export async function pupilEnsureAnonymous(){
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) return data.session.user;
  const { data: sign, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return sign.user;
}

export async function pupilClaim(classCode, pupilCode){
  await pupilEnsureAnonymous();
  const { data, error } = await supabase.rpc("claim_pupil", {
    p_class_code: classCode.trim().toUpperCase(),
    p_pupil_code: pupilCode.trim()
  });
  if (error) throw error;
  return data; // { pupil_id, class_id }
}
