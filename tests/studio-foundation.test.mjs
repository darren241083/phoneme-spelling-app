import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  StudioConfigurationError,
  loadStudioConfiguration,
  validateStudioProfile,
} from "../studio/core/profile-loader.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUDIO_ROOT = path.join(ROOT_DIR, "studio");
const FIXTURE_ROOT = path.join(ROOT_DIR, "tests", "fixtures", "studio");
const REQUIRED_ROLES = ["principal_builder", "product_owner", "reviewer", "verifier"];
const CORE_FORBIDDEN_TERMS = new Map([
  ["application name", /\bwordloom\b/i],
  ["person name", /\bdarren\b/i],
  ["learner-domain term", /\bpupil\b/i],
  ["organisation-domain term", /\bschool\b/i],
  ["app-user term", /\bteacher\b/i],
  ["subject-domain term", /\bspelling\b/i],
  ["product-domain term", /\bintervention\b/i],
  ["backend vendor", /\bsupabase\b/i],
  ["application configuration path", /js[\\/]config\.js/i],
  ["repository name", /phoneme-spelling-app/i],
]);

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT_DIR, relativePath), "utf8"));
}

function listFilesRecursively(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursively(fullPath) : [fullPath];
  });
}

function loadProfileFixture(name) {
  return loadStudioConfiguration({
    studioRoot: STUDIO_ROOT,
    profilePath: path.join(FIXTURE_ROOT, name),
  });
}

test("Wordloom profile loads through the portable Studio Core", () => {
  const studio = loadStudioConfiguration({ studioRoot: STUDIO_ROOT });

  assert.equal(studio.operational.core.id, "ai-product-studio-core");
  assert.equal(studio.operational.profile.applicationId, "wordloom");
  assert.deepEqual(studio.operational.profile.roleIds, REQUIRED_ROLES);
  assert.equal(studio.presentation.roleDisplayNames.product_owner, "Darren");
  assert.equal(Object.isFrozen(studio), true);
  assert.equal(Object.isFrozen(studio.operational.profile), true);
});

test("an unrelated application profile loads through the same Core mechanism", () => {
  const primaryStudio = loadStudioConfiguration({ studioRoot: STUDIO_ROOT });
  const studio = loadProfileFixture("alternate-app-profile.json");

  assert.deepEqual(studio.operational.core, primaryStudio.operational.core);
  assert.deepEqual(studio.operational.roles, primaryStudio.operational.roles);
  assert.equal(studio.operational.profile.profileId, "harbor-inventory");
  assert.equal(studio.operational.profile.applicationId, "harbor-inventory");
  assert.deepEqual(studio.operational.profile.roleIds, REQUIRED_ROLES);
  assert.equal(studio.presentation.applicationDisplayName, "Harbor Inventory");
  assert.equal(studio.presentation.roleDisplayNames.product_owner, "Morgan");
});

test("changing or removing human display metadata cannot change operational input", () => {
  const baseProfile = readJson("studio/profiles/wordloom/profile.json");
  const loaded = loadStudioConfiguration({ studioRoot: STUDIO_ROOT });
  const context = {
    manifest: {
      schemaVersion: loaded.operational.studioSchemaVersion,
      coreId: loaded.operational.core.id,
      coreMajor: Number(loaded.operational.core.version.split(".")[0]),
      profileSchemaVersion: loaded.operational.core.profileSchemaVersion,
    },
    roleVocabulary: {
      roleIds: loaded.operational.profile.roleIds,
    },
  };
  const changedName = structuredClone(baseProfile);
  changedName.role_metadata.product_owner.display_name = "Another Person";
  changedName.application.display_name = "Another Application Label";
  const removedName = structuredClone(baseProfile);
  delete removedName.role_metadata.product_owner.display_name;
  delete removedName.application.display_name;

  const baseline = validateStudioProfile(baseProfile, context);
  const changed = validateStudioProfile(changedName, context);
  const removed = validateStudioProfile(removedName, context);

  assert.deepEqual(changed.operational, baseline.operational);
  assert.deepEqual(removed.operational, baseline.operational);
  assert.notDeepEqual(changed.presentation, baseline.presentation);
  assert.notDeepEqual(removed.presentation, baseline.presentation);
  assert.equal(JSON.stringify(baseline.operational).includes("Darren"), false);
});

test("Core files contain no obvious application or person-specific assumptions", () => {
  const coreFiles = listFilesRecursively(path.join(STUDIO_ROOT, "core"));
  assert.ok(coreFiles.length >= 3);

  for (const filePath of coreFiles) {
    const source = readFileSync(filePath, "utf8");
    for (const [label, pattern] of CORE_FORBIDDEN_TERMS) {
      assert.doesNotMatch(source, pattern, `${path.relative(ROOT_DIR, filePath)} leaked ${label}`);
    }
  }
});

test("the Core boundary detector recognises representative leakage", () => {
  for (const [label, pattern] of CORE_FORBIDDEN_TERMS) {
    const sample = {
      "application name": "Wordloom",
      "person name": "Darren",
      "learner-domain term": "pupil",
      "organisation-domain term": "school",
      "app-user term": "teacher",
      "subject-domain term": "spelling",
      "product-domain term": "intervention",
      "backend vendor": "Supabase",
      "application configuration path": "js/config.js",
      "repository name": "phoneme-spelling-app",
    }[label];
    assert.match(sample, pattern, `Detector should recognise ${label}`);
  }
});

test("profile compatibility failures are deterministic and explicit", () => {
  assert.throws(
    () => loadProfileFixture("incompatible-profile.json"),
    (error) => {
      assert.ok(error instanceof StudioConfigurationError);
      assert.equal(error.code, "PROFILE_INCOMPATIBLE");
      assert.equal(
        error.message,
        "[PROFILE_INCOMPATIBLE] Profile core_compatibility does not match the loaded Core: core_major.",
      );
      return true;
    },
  );
});

test("unknown role metadata and malformed profiles fail clearly", () => {
  const loaded = loadStudioConfiguration({ studioRoot: STUDIO_ROOT });
  const context = {
    manifest: {
      schemaVersion: loaded.operational.studioSchemaVersion,
      coreId: loaded.operational.core.id,
      coreMajor: Number(loaded.operational.core.version.split(".")[0]),
      profileSchemaVersion: loaded.operational.core.profileSchemaVersion,
    },
    roleVocabulary: { roleIds: loaded.operational.profile.roleIds },
  };
  const unknownRoleProfile = readJson("tests/fixtures/studio/alternate-app-profile.json");
  unknownRoleProfile.role_metadata.release_captain = { display_name: "Taylor" };

  assert.throws(
    () => validateStudioProfile(unknownRoleProfile, context),
    (error) => {
      assert.equal(error.code, "PROFILE_INVALID");
      assert.equal(
        error.message,
        "[PROFILE_INVALID] Profile role_metadata references unknown role: release_captain.",
      );
      return true;
    },
  );
  assert.throws(
    () => validateStudioProfile(null, context),
    (error) => {
      assert.equal(error.code, "PROFILE_INVALID");
      assert.equal(error.message, "[PROFILE_INVALID] App profile must be an object.");
      return true;
    },
  );
});

test("Studio-relative paths cannot escape through a filesystem link", (t) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "studio-foundation-"));
  t.after(() => rmSync(temporaryRoot, { force: true, recursive: true }));
  symlinkSync(
    path.join(STUDIO_ROOT, "core"),
    path.join(temporaryRoot, "linked-core"),
    process.platform === "win32" ? "junction" : "dir",
  );
  writeFileSync(
    path.join(temporaryRoot, "studio.json"),
    JSON.stringify({
      schema_version: 1,
      core_manifest: "linked-core/manifest.json",
      active_profile: "profile.json",
    }),
    "utf8",
  );

  assert.throws(
    () => loadStudioConfiguration({ studioRoot: temporaryRoot }),
    (error) => {
      assert.equal(error.code, "STUDIO_CONFIG_INVALID");
      assert.match(error.message, /Studio core_manifest must stay inside/);
      return true;
    },
  );
});
