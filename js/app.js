console.log("✅ app.js is running");
import { STORAGE } from "./config.js";
import { clearBanner, setNotice, showBanner } from "./ui.js";
import { supabase, wireGlobalAuthErrorHandling } from "./supabaseClient.js";
import { teacherSignInGoogle, signOut, getSession } from "./authTeacher.js";
import { pupilClaim } from "./authPupil.js";
import { upsertTeacherProfile } from "./db.js";
import { mountTeacherDashboard } from "./teacherView.js";
import { mountPupilApp } from "./pupilView.js";

wireGlobalAuthErrorHandling();

const viewRole = document.getElementById("viewRole");
const viewTeacherAuth = document.getElementById("viewTeacherAuth");
const viewTeacher = document.getElementById("viewTeacher");
const viewPupilAuth = document.getElementById("viewPupilAuth");
const viewPupil = document.getElementById("viewPupil");

const btnTeacher = document.getElementById("btnTeacher");
const btnPupil = document.getElementById("btnPupil");
const btnGoogle = document.getElementById("btnGoogle");
const btnSignOut = document.getElementById("btnSignOut");

const teacherAuthMsg = document.getElementById("teacherAuthMsg");

const pupilClassCode = document.getElementById("pupilClassCode");
const pupilCode = document.getElementById("pupilCode");
const btnPupilLogin = document.getElementById("btnPupilLogin");
const btnBackFromPupil = document.getElementById("btnBackFromPupil");
const pupilAuthMsg = document.getElementById("pupilAuthMsg");

function hideAll(){
  viewRole.style.display = "none";
  viewTeacherAuth.style.display = "none";
  viewTeacher.style.display = "none";
  viewPupilAuth.style.display = "none";
  viewPupil.style.display = "none";
}

function setRole(role){
  localStorage.setItem(STORAGE.role, role);
}

function getRole(){
  return localStorage.getItem(STORAGE.role) || "";
}

async function showRolePicker(){
  clearBanner();
  hideAll();
  btnSignOut.style.display = "none";
  viewRole.style.display = "block";
}

async function showTeacherAuth(){
  clearBanner();
  hideAll();
  btnSignOut.style.display = "none";
  viewTeacherAuth.style.display = "block";
}

async function showTeacherApp(session){
  clearBanner();
  hideAll();
  btnSignOut.style.display = "inline-block";
  viewTeacher.style.display = "block";

  await upsertTeacherProfile(session.user);
  await mountTeacherDashboard(viewTeacher);
}

async function showPupilAuth(){
  clearBanner();
  hideAll();
  btnSignOut.style.display = "none";
  viewPupilAuth.style.display = "block";
}

async function showPupilApp(pupilState){
  clearBanner();
  hideAll();
  btnSignOut.style.display = "inline-block"; // signs out anon too (fine)
  viewPupil.style.display = "block";
  await mountPupilApp(viewPupil, pupilState);
}

async function route(){
  clearBanner();

  const role = getRole();
  const savedPupil = JSON.parse(localStorage.getItem(STORAGE.pupil) || "null");
  const session = await getSession().catch(()=>null);

  if (!role){
    return showRolePicker();
  }

  if (role === "teacher"){
    if (!session?.user) return showTeacherAuth();
    return showTeacherApp(session);
  }

  if (role === "pupil"){
    if (!savedPupil?.pupil_id) return showPupilAuth();
    return showPupilApp(savedPupil);
  }

  return showRolePicker();
}

/* -------- events -------- */

btnTeacher.addEventListener("click", async ()=>{
  setRole("teacher");
  await route();
});

btnPupil.addEventListener("click", async ()=>{
  setRole("pupil");
  await route();
});

btnGoogle.addEventListener("click", async ()=>{
  try{
    setNotice(teacherAuthMsg, null);
    await teacherSignInGoogle();
  }catch(e){
    setNotice(teacherAuthMsg, e.message);
  }
});

btnPupilLogin.addEventListener("click", async ()=>{
  try{
    setNotice(pupilAuthMsg, null);
    const classCode = (pupilClassCode.value || "").trim();
    const code = (pupilCode.value || "").trim();
    if (!classCode || !code) return setNotice(pupilAuthMsg, "Enter both codes.");

    const res = await pupilClaim(classCode, code);
    localStorage.setItem(STORAGE.pupil, JSON.stringify(res));
    await route();
  }catch(e){
    setNotice(pupilAuthMsg, e.message);
  }
});

btnBackFromPupil.addEventListener("click", async ()=>{
  localStorage.removeItem(STORAGE.role);
  await route();
});

btnSignOut.addEventListener("click", async ()=>{
  await signOut();
  localStorage.removeItem(STORAGE.pupil);
  await route();
});

/* -------- init -------- */
supabase.auth.onAuthStateChange(()=> route());
route().catch(e => showBanner(e.message));
