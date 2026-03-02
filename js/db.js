import { supabase } from "./supabaseClient.js";
import { randCode, randDigits } from "./ui.js";

/* ---------------- TEACHER ---------------- */

export async function upsertTeacherProfile(user){
  // teachers table uses auth.uid as id
  const display = user.user_metadata?.full_name || user.email || null;
  await supabase.from("teachers").upsert({ id: user.id, display_name: display });
}

export async function teacherListTests(){
  const { data, error } = await supabase
    .from("tests")
    .select("id,title,allowed_graphemes,created_at")
    .order("created_at", { ascending:false });
  if (error) throw error;
  return data || [];
}

export async function teacherCreateTest(title, allowedGraphemesArr){
  const { data, error } = await supabase
    .from("tests")
    .insert({
      title,
      allowed_graphemes: allowedGraphemesArr?.length ? allowedGraphemesArr : null
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function teacherAddWords(testId, words){
  // words: [{position, word, sentence, segments[]}]
  const payload = words.map(w => ({
    test_id: testId,
    position: w.position,
    word: w.word,
    sentence: w.sentence || null,
    segments: w.segments || []
  }));
  const { error } = await supabase.from("test_words").insert(payload);
  if (error) throw error;
}

export async function teacherGetTestWords(testId){
  const { data, error } = await supabase
    .from("test_words")
    .select("id,position,word,sentence,segments")
    .eq("test_id", testId)
    .order("position", { ascending:true });
  if (error) throw error;
  return data || [];
}

export async function teacherListClasses(){
  const { data, error } = await supabase
    .from("classes")
    .select("id,name,class_code,created_at")
    .order("created_at", { ascending:false });
  if (error) throw error;
  return data || [];
}

export async function teacherCreateClass(name){
  // Friendly class code like WGSF-7H2K
  const code = `WGSF-${randCode(4)}`;
  const { data, error } = await supabase
    .from("classes")
    .insert({ name, class_code: code })
    .select("id,class_code")
    .single();
  if (error) throw error;
  return data;
}

export async function teacherListPupils(classId){
  const { data, error } = await supabase
    .from("pupils")
    .select("id,name,pupil_code,created_at")
    .eq("class_id", classId)
    .order("created_at", { ascending:false });
  if (error) throw error;
  return data || [];
}

export async function teacherAddPupil(classId, name){
  const code = randDigits(4);
  const { data, error } = await supabase
    .from("pupils")
    .insert({ class_id: classId, name: name || null, pupil_code: code })
    .select("id,pupil_code")
    .single();
  if (error) throw error;
  return data;
}

export async function teacherAssignTestToClass(classId, testId){
  const { error } = await supabase
    .from("class_tests")
    .insert({ class_id: classId, test_id: testId });
  if (error) throw error;
}

export async function teacherListAssignments(classId){
  const { data, error } = await supabase
    .from("class_tests")
    .select("test_id, tests(title)")
    .eq("class_id", classId);
  if (error) throw error;
  return data || [];
}

/* ---------------- PUPIL ---------------- */

export async function pupilGetAssignedTests(){
  // RLS restricts to pupil’s class via pupil_accounts mapping
  const { data, error } = await supabase
    .from("assigned_tests_view")
    .select("test_id,title,allowed_graphemes,created_at")
    .order("created_at", { ascending:false });
  if (error) throw error;
  return data || [];
}

export async function pupilGetTestWords(testId){
  const { data, error } = await supabase
    .from("test_words")
    .select("id,position,word,sentence,segments")
    .eq("test_id", testId)
    .order("position", { ascending:true });
  if (error) throw error;
  return data || [];
}

export async function pupilRecordAttempt({ pupilId, testId, testWordId, mode, typed, correct }){
  const { error } = await supabase.from("attempts").insert({
    pupil_id: pupilId,
    test_id: testId,
    test_word_id: testWordId,
    mode,
    typed,
    correct
  });
  if (error) throw error;
}
