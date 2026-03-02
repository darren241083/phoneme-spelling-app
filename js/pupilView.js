export async function renderPupilView(container, pupil) {
  container.innerHTML = `
    <h2>Pupil session</h2>
    <p>Class: ${pupil.classCode}</p>
    <p>Pupil code: ${pupil.pupilCode}</p>
  `;
}
