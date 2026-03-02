export async function renderTeacherView(container, user) {
  container.innerHTML = `
    <h2>Teacher dashboard</h2>
    <p>Signed in as ${user.email}</p>
    <p>Create classes and tests here.</p>
  `;
}
