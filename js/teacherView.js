import { supabase } from "./supabaseClient.js";

export async function renderTeacherDashboard(container) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    container.innerHTML = "<p>Not signed in.</p>";
    return;
  }

  container.innerHTML = `
    <h2>Teacher dashboard</h2>
    <p class="muted">Signed in as ${user.email}</p>

    <hr/>

    <h3>Create class</h3>
    <div class="row">
      <input id="newClassName" class="input" placeholder="Class name (e.g. 7A)" />
      <button id="btnCreateClass" class="btn">Create</button>
    </div>

    <div id="classList" class="mt"></div>

    <hr/>

    <h3>Create test</h3>
    <div class="row">
      <input id="newTestTitle" class="input" placeholder="Test title (e.g. Week 3 – ay/ai)" />
      <button id="btnCreateTest" class="btn">Create</button>
    </div>

    <div id="testList" class="mt"></div>
  `;

  await loadClasses(user.id);
  await loadTests(user.id);

  document.getElementById("btnCreateClass").onclick = () =>
    createClass(user.id);

  document.getElementById("btnCreateTest").onclick = () =>
    createTest(user.id);
}

async function loadClasses(teacherId) {
  const { data } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  const list = document.getElementById("classList");
  list.innerHTML = "<h4>Your classes</h4>";

  if (!data || data.length === 0) {
    list.innerHTML += "<p class='muted'>No classes yet.</p>";
    return;
  }

  data.forEach(c => {
    list.innerHTML += `
      <div class="listItem">
        <strong>${c.name}</strong>
        <div class="muted">Join code: ${c.join_code}</div>
      </div>
    `;
  });
}

async function loadTests(teacherId) {
  const { data } = await supabase
    .from("tests")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  const list = document.getElementById("testList");
  list.innerHTML = "<h4>Your tests</h4>";

  if (!data || data.length === 0) {
    list.innerHTML += "<p class='muted'>No tests yet.</p>";
    return;
  }

  data.forEach(t => {
    list.innerHTML += `
      <div class="listItem">
        <strong>${t.title}</strong>
      </div>
    `;
  });
}

async function createClass(teacherId) {
  const name = document.getElementById("newClassName").value.trim();
  if (!name) return;

  const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  await supabase.from("classes").insert({
    teacher_id: teacherId,
    name,
    join_code: joinCode
  });

  document.getElementById("newClassName").value = "";
  await loadClasses(teacherId);
}

async function createTest(teacherId) {
  const title = document.getElementById("newTestTitle").value.trim();
  if (!title) return;

  await supabase.from("tests").insert({
    teacher_id: teacherId,
    title
  });

  document.getElementById("newTestTitle").value = "";
  await loadTests(teacherId);
}
