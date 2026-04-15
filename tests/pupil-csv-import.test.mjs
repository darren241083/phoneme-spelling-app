import assert from "node:assert/strict";
import { loadBrowserModule } from "./load-browser-module.mjs";

const {
  buildPupilImportCommitPayload,
  buildPupilImportPreview,
  parsePupilImportCsv,
} = await loadBrowserModule("../js/pupilCsvImport.js", import.meta.url);

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

const CLASS_RECORDS = [
  { id: "form-7a", name: "7A Tutor", year_group: "Year 7", class_type: "form" },
  { id: "form-7b", name: "7B Tutor", year_group: "Year 7", class_type: "form" },
  { id: "form-8a", name: "Year 8", year_group: "Year 8", class_type: "form" },
  { id: "form-8b", name: "Year 8", year_group: "Year 8", class_type: "form" },
  { id: "subject-8-science", name: "8 Science", year_group: "Year 8", class_type: "subject" },
];

function buildPreview(csvText, {
  existingPupils = [],
  formMemberships = [],
  classRecords = CLASS_RECORDS,
} = {}) {
  return buildPupilImportPreview({
    parsedCsv: parsePupilImportCsv(csvText),
    existingPupils,
    formMemberships,
    classRecords,
  });
}

function normalizeForAssert(value) {
  return JSON.parse(JSON.stringify(value));
}

test("new pupil rows are classified as create and included in the commit payload", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class,year_group
MIS-100,Ava,Khan,7A Tutor,Year 7`);

  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0].action, "create");
  assert.equal(preview.canCommit, true);
  assert.deepEqual(normalizeForAssert(buildPupilImportCommitPayload(preview)), [
    {
      row_number: 2,
      mis_id: "MIS-100",
      first_name: "Ava",
      surname: "Khan",
      form_class: "7A Tutor",
      year_group: "Year 7",
      pp: null,
      sen: null,
      gender: null,
      final_action: "create",
    },
  ]);
});

test("missing form groups are previewed as safe creates when year_group is provided", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class,year_group
MIS-101,Ava,Khan,9C Tutor,Year 9`);

  assert.equal(preview.rows[0].action, "create");
  assert.equal(preview.rows[0].will_create_form_class, true);
  assert.equal(preview.summary.form_class_create_count, 1);
  assert.equal(preview.rows[0].errors.length, 0);
  assert.match(preview.rows[0].safe_updates.join(" | "), /create form class 9C Tutor \(Year 9\)/i);
});

test("the same new form group is only planned once across multiple safe rows", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class,year_group
MIS-102,Ava,Khan,9D Tutor,Year 9
MIS-103,Leo,Brown,9D Tutor,Year 9`);

  assert.equal(preview.summary.form_class_create_count, 1);
  assert.equal(preview.form_classes_to_create.length, 1);
  assert.equal(preview.rows.every((row) => row.action === "create"), true);
});

test("duplicate MIS IDs in the CSV block both rows", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class
MIS-200,Ava,Khan,7A Tutor
MIS-200,Leo,Brown,7B Tutor`);

  assert.equal(preview.canCommit, false);
  assert.equal(preview.rows[0].action, "error");
  assert.equal(preview.rows[1].action, "error");
  assert.match(preview.rows[0].errors[0], /appears more than once in this CSV/i);
  assert.deepEqual(normalizeForAssert(buildPupilImportCommitPayload(preview)), []);
});

test("duplicate normalized rows in the CSV are blocked", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class,year_group
MIS-205,Ava,Khan,7A Tutor,Year 7
MIS-205 , Ava , Khan , 7A Tutor , Year 7`);

  assert.equal(preview.rows[0].action, "error");
  assert.match(preview.rows[0].errors.join(" | "), /duplicated in the CSV/i);
});

test("matched pupils with changed names become update rows with warnings", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class
MIS-300,Amelia,Khan,7A Tutor`, {
    existingPupils: [
      { id: "pupil-1", mis_id: "MIS-300", first_name: "Amy", surname: "Khan", username: "akhan300", is_active: true },
    ],
    formMemberships: [
      { id: "pc-1", pupil_id: "pupil-1", class_id: "form-7a", active: true },
    ],
  });

  assert.equal(preview.rows[0].action, "update");
  assert.equal(preview.rows[0].warnings.length, 1);
  assert.match(preview.rows[0].warnings[0], /stored pupil name is/i);
});

test("non-form class matches produce a plain class-type error", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class
MIS-400,Mia,Patel,8 Science`);

  assert.equal(preview.rows[0].action, "error");
  assert.match(preview.rows[0].errors[0], /is not a form class/i);
});

test("year mismatches produce a plain year-group error", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class,year_group
MIS-500,Leo,Brown,7A Tutor,Year 8`);

  assert.equal(preview.rows[0].action, "error");
  assert.match(preview.rows[0].errors[0], /exists in Year 7, not Year 8/i);
});

test("missing year group blocks brand-new form classes", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class
MIS-510,Isla,James,10A Tutor`);

  assert.equal(preview.rows[0].action, "error");
  assert.match(preview.rows[0].errors[0], /add year_group so this new form group can be created/i);
});

test("existing pupils in a different active form are classified as replace_form", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class,year_group
MIS-600,Noah,Hall,7A Tutor,Year 7`, {
    existingPupils: [
      { id: "pupil-2", mis_id: "MIS-600", first_name: "Noah", surname: "Hall", username: "nhall600", is_active: true },
    ],
    formMemberships: [
      { id: "pc-2", pupil_id: "pupil-2", class_id: "form-7b", active: true },
    ],
  });

  assert.equal(preview.rows[0].action, "replace_form");
  assert.match(preview.rows[0].safe_updates[0], /replace active form membership/i);
});

test("subgroup values make unchanged rows commit as updates", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class,year_group,pp,sen,gender
MIS-610,Noah,Hall,7A Tutor,Year 7,Yes,SEN support,Boy`, {
    existingPupils: [
      { id: "pupil-3", mis_id: "MIS-610", first_name: "Noah", surname: "Hall", username: "nhall610", is_active: true },
    ],
    formMemberships: [
      { id: "pc-3", pupil_id: "pupil-3", class_id: "form-7a", active: true },
    ],
  });

  assert.equal(preview.rows[0].action, "update");
  assert.match(preview.rows[0].safe_updates.join(" | "), /set PP subgroup to PP/i);
  assert.match(preview.rows[0].safe_updates.join(" | "), /set SEN subgroup to SEN support/i);
  assert.match(preview.rows[0].safe_updates.join(" | "), /set gender subgroup to Male/i);
  assert.deepEqual(normalizeForAssert(buildPupilImportCommitPayload(preview)), [
    {
      row_number: 2,
      mis_id: "MIS-610",
      first_name: "Noah",
      surname: "Hall",
      form_class: "7A Tutor",
      year_group: "Year 7",
      pp: "pp",
      sen: "sen_support",
      gender: "male",
      final_action: "update",
    },
  ]);
});

test("smart dashes in subgroup values are accepted from spreadsheet exports", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class,year_group,pp,gender
MIS-612,Noah,Hall,7A Tutor,Year 7,Non‑PP,Non‑binary`);

  assert.equal(preview.rows[0].action, "create");
  assert.equal(preview.rows[0].normalized_pp, "non_pp");
  assert.equal(preview.rows[0].normalized_gender, "non_binary");
});

test("invalid subgroup values block the row", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class,year_group,pp
MIS-611,Noah,Hall,7A Tutor,Year 7,Maybe`);

  assert.equal(preview.rows[0].action, "error");
  assert.match(preview.rows[0].errors[0], /PP value "Maybe" is not recognised/i);
});

test("ambiguous form names stay out of the commit payload", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class
MIS-700,Ben,Hall,Year 8`);

  assert.equal(preview.rows[0].action, "error");
  assert.match(preview.rows[0].errors[0], /more than one form class matches/i);
  assert.deepEqual(normalizeForAssert(buildPupilImportCommitPayload(preview)), []);
});

test("numeric-only MIS IDs are warned but still import", () => {
  const preview = buildPreview(`mis_id,first_name,surname,form_class,year_group
001234,Ava,Khan,7A Tutor,Year 7`);

  assert.equal(preview.rows[0].action, "create");
  assert.match(preview.rows[0].warnings.join(" | "), /MIS ID is numeric-only/i);
});

test("duplicate headers are surfaced as file errors", () => {
  const parsed = parsePupilImportCsv(`mis_id,mis id,first_name,surname,form_class
MIS-800,MIS-800,Ava,Khan,7A Tutor`);

  assert.match(parsed.errors.join(" | "), /duplicate column header/i);
});

let failureCount = 0;

for (const entry of TESTS) {
  try {
    await entry.fn();
    console.log(`ok - ${entry.name}`);
  } catch (error) {
    failureCount += 1;
    console.error(`not ok - ${entry.name}`);
    console.error(error);
  }
}

if (failureCount > 0) {
  process.exitCode = 1;
} else {
  console.log(`all ${TESTS.length} pupil CSV checks passed`);
}
