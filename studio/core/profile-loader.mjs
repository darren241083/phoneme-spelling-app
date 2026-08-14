import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_STUDIO_SCHEMA_VERSION = 1;
const PROFILE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ROLE_ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const REFERENCE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;
const DEFAULT_STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export class StudioConfigurationError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = "StudioConfigurationError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new StudioConfigurationError(code, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
  return value;
}

function requireInteger(value, label, code) {
  if (!Number.isInteger(value) || value < 1) {
    fail(code, `${label} must be a positive integer.`);
  }
  return value;
}

function requireString(value, label, code) {
  if (typeof value !== "string" || !value.trim()) {
    fail(code, `${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireArray(value, label, code) {
  if (!Array.isArray(value)) fail(code, `${label} must be an array.`);
  return value;
}

function requireIdentifier(value, label, pattern, code) {
  const identifier = requireString(value, label, code);
  if (!pattern.test(identifier)) {
    fail(code, `${label} has an invalid identifier: ${identifier}.`);
  }
  return identifier;
}

function requireRelativeReference(value, label, code) {
  const referencePath = requireString(value, label, code).replaceAll("\\", "/");
  if (path.isAbsolute(referencePath) || referencePath.split("/").includes("..")) {
    fail(code, `${label} must be a relative contained path.`);
  }
  return referencePath;
}

function requireOnlyKeys(value, allowedKeys, label, code) {
  for (const key of Object.keys(value).sort()) {
    if (!allowedKeys.has(key)) fail(code, `${label} contains unsupported field: ${key}.`);
  }
}

function readJsonFile(filePath, label, code) {
  let source;
  try {
    source = readFileSync(filePath, "utf8");
  } catch (error) {
    fail(code, `Could not read ${label} at ${filePath}: ${error.code || error.message}.`);
  }

  try {
    return JSON.parse(source);
  } catch {
    fail(code, `${label} at ${filePath} is not valid JSON.`);
  }
}

function resolveContainedPath(rootDir, relativePath, label, code) {
  const value = requireString(relativePath, label, code);
  if (path.isAbsolute(value)) fail(code, `${label} must be relative to ${rootDir}.`);

  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(resolvedRoot, value);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(code, `${label} must stay inside ${resolvedRoot}.`);
  }

  let canonicalRoot;
  let canonicalPath;
  try {
    canonicalRoot = realpathSync(resolvedRoot);
    canonicalPath = realpathSync(resolvedPath);
  } catch (error) {
    if (error.code === "ENOENT") return resolvedPath;
    fail(code, `Could not resolve ${label}: ${error.code || error.message}.`);
  }
  const canonicalRelative = path.relative(canonicalRoot, canonicalPath);
  if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) {
    fail(code, `${label} must stay inside ${canonicalRoot}.`);
  }
  return resolvedPath;
}

function compareIdentifiers(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function parseMajorVersion(version, label, code) {
  const value = requireString(version, label, code);
  const match = value.match(/^(\d+)\.\d+\.\d+$/);
  if (!match) fail(code, `${label} must use major.minor.patch format.`);
  return Number(match[1]);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function validateStudioSelection(value) {
  const code = "STUDIO_CONFIG_INVALID";
  const config = requireObject(value, "Studio configuration", code);
  requireOnlyKeys(
    config,
    new Set(["schema_version", "core_manifest", "active_profile"]),
    "Studio configuration",
    code,
  );
  const schemaVersion = requireInteger(config.schema_version, "Studio schema_version", code);
  if (schemaVersion !== CURRENT_STUDIO_SCHEMA_VERSION) {
    fail(code, `Unsupported Studio schema_version: ${schemaVersion}.`);
  }
  return {
    schemaVersion,
    coreManifest: requireString(config.core_manifest, "Studio core_manifest", code),
    activeProfile: requireString(config.active_profile, "Studio active_profile", code),
  };
}

function validateCoreManifest(value) {
  const code = "CORE_MANIFEST_INVALID";
  const manifest = requireObject(value, "Core manifest", code);
  requireOnlyKeys(
    manifest,
    new Set([
      "schema_version",
      "core_id",
      "core_version",
      "profile_schema_version",
      "roles_path",
      "required_roles",
    ]),
    "Core manifest",
    code,
  );

  const schemaVersion = requireInteger(manifest.schema_version, "Core schema_version", code);
  if (schemaVersion !== CURRENT_STUDIO_SCHEMA_VERSION) {
    fail(code, `Unsupported Core schema_version: ${schemaVersion}.`);
  }
  if (!Array.isArray(manifest.required_roles) || manifest.required_roles.length === 0) {
    fail(code, "Core required_roles must be a non-empty array.");
  }

  const requiredRoles = manifest.required_roles.map((roleId, index) =>
    requireIdentifier(roleId, `Core required_roles[${index}]`, ROLE_ID_PATTERN, code)
  );
  if (new Set(requiredRoles).size !== requiredRoles.length) {
    fail(code, "Core required_roles must not contain duplicates.");
  }

  const coreVersion = requireString(manifest.core_version, "Core core_version", code);
  return {
    schemaVersion,
    coreId: requireIdentifier(manifest.core_id, "Core core_id", PROFILE_ID_PATTERN, code),
    coreVersion,
    coreMajor: parseMajorVersion(coreVersion, "Core core_version", code),
    profileSchemaVersion: requireInteger(
      manifest.profile_schema_version,
      "Core profile_schema_version",
      code,
    ),
    rolesPath: requireString(manifest.roles_path, "Core roles_path", code),
    requiredRoles: [...requiredRoles].sort(),
  };
}

function validateRoleVocabulary(value, manifest) {
  const code = "ROLE_VOCABULARY_INVALID";
  const vocabulary = requireObject(value, "Role vocabulary", code);
  requireOnlyKeys(vocabulary, new Set(["schema_version", "roles"]), "Role vocabulary", code);
  const schemaVersion = requireInteger(vocabulary.schema_version, "Role schema_version", code);
  if (schemaVersion !== manifest.schemaVersion) {
    fail(code, `Role schema_version ${schemaVersion} does not match Core schema_version ${manifest.schemaVersion}.`);
  }
  if (!Array.isArray(vocabulary.roles) || vocabulary.roles.length === 0) {
    fail(code, "Role vocabulary roles must be a non-empty array.");
  }

  const roles = vocabulary.roles.map((rawRole, index) => {
    const role = requireObject(rawRole, `Role vocabulary roles[${index}]`, code);
    requireOnlyKeys(role, new Set(["id", "description"]), `Role vocabulary roles[${index}]`, code);
    return {
      id: requireIdentifier(role.id, `Role vocabulary roles[${index}].id`, ROLE_ID_PATTERN, code),
      description: requireString(
        role.description,
        `Role vocabulary roles[${index}].description`,
        code,
      ),
    };
  });

  const roleIds = roles.map(({ id }) => id);
  if (new Set(roleIds).size !== roleIds.length) {
    fail(code, "Role vocabulary role ids must be unique.");
  }
  const missingRoles = manifest.requiredRoles.filter((roleId) => !roleIds.includes(roleId));
  if (missingRoles.length) {
    fail(code, `Role vocabulary is missing required roles: ${missingRoles.join(", ")}.`);
  }

  return {
    schemaVersion,
    roles: [...roles].sort((left, right) => compareIdentifiers(left.id, right.id)),
    roleIds: [...roleIds].sort(),
  };
}

function validateStudioReadyProfileContext(value) {
  const code = "PROFILE_INVALID";
  if (value === undefined) return undefined;

  const context = requireObject(value, "Profile studio_ready", code);
  requireOnlyKeys(
    context,
    new Set(["guidance_refs", "artifact_promotion_destinations", "evidence_sensitivity"]),
    "Profile studio_ready",
    code,
  );

  const guidanceRefs = requireArray(
    context.guidance_refs === undefined ? [] : context.guidance_refs,
    "Profile studio_ready.guidance_refs",
    code,
  ).map(
    (rawRef, index) => {
      const ref = requireObject(rawRef, `Profile studio_ready.guidance_refs[${index}]`, code);
      requireOnlyKeys(
        ref,
        new Set(["id", "path", "applies_to"]),
        `Profile studio_ready.guidance_refs[${index}]`,
        code,
      );
      return {
        id: requireIdentifier(
          ref.id,
          `Profile studio_ready.guidance_refs[${index}].id`,
          REFERENCE_ID_PATTERN,
          code,
        ),
        path: requireRelativeReference(
          ref.path,
          `Profile studio_ready.guidance_refs[${index}].path`,
          code,
        ),
        appliesTo: requireArray(
          ref.applies_to === undefined ? [] : ref.applies_to,
          `Profile studio_ready.guidance_refs[${index}].applies_to`,
          code,
        ).map((item, itemIndex) =>
          requireIdentifier(
            item,
            `Profile studio_ready.guidance_refs[${index}].applies_to[${itemIndex}]`,
            REFERENCE_ID_PATTERN,
            code,
          )
        ),
      };
    },
  );
  const guidanceRefIds = guidanceRefs.map(({ id }) => id);
  if (new Set(guidanceRefIds).size !== guidanceRefIds.length) {
    fail("PROFILE_INVALID", "Profile studio_ready.guidance_refs ids must be unique.");
  }

  const destinationRefs = requireArray(
    context.artifact_promotion_destinations === undefined
      ? []
      : context.artifact_promotion_destinations,
    "Profile studio_ready.artifact_promotion_destinations",
    code,
  ).map((rawDestination, index) => {
    const destination = requireObject(
      rawDestination,
      `Profile studio_ready.artifact_promotion_destinations[${index}]`,
      code,
    );
    requireOnlyKeys(
      destination,
      new Set(["id", "description", "path", "reference"]),
      `Profile studio_ready.artifact_promotion_destinations[${index}]`,
      code,
    );
    const normalized = {
      id: requireIdentifier(
        destination.id,
        `Profile studio_ready.artifact_promotion_destinations[${index}].id`,
        REFERENCE_ID_PATTERN,
        code,
      ),
      description: requireString(
        destination.description,
        `Profile studio_ready.artifact_promotion_destinations[${index}].description`,
        code,
      ),
    };
    if (destination.path !== undefined) {
      normalized.path = requireRelativeReference(
        destination.path,
        `Profile studio_ready.artifact_promotion_destinations[${index}].path`,
        code,
      );
    }
    if (destination.reference !== undefined) {
      normalized.reference = requireString(
        destination.reference,
        `Profile studio_ready.artifact_promotion_destinations[${index}].reference`,
        code,
      );
    }
    if (!normalized.path && !normalized.reference) {
      fail(
        code,
        `Profile studio_ready.artifact_promotion_destinations[${index}] must define path or reference.`,
      );
    }
    return normalized;
  });
  const destinationIds = destinationRefs.map(({ id }) => id);
  if (new Set(destinationIds).size !== destinationIds.length) {
    fail("PROFILE_INVALID", "Profile studio_ready.artifact_promotion_destinations ids must be unique.");
  }

  const sensitivity = context.evidence_sensitivity === undefined
    ? {}
    : requireObject(context.evidence_sensitivity, "Profile studio_ready.evidence_sensitivity", code);
  requireOnlyKeys(
    sensitivity,
    new Set(["prohibited_promotion"]),
    "Profile studio_ready.evidence_sensitivity",
    code,
  );
  const prohibitedPromotion = requireArray(
    sensitivity.prohibited_promotion === undefined ? [] : sensitivity.prohibited_promotion,
    "Profile studio_ready.evidence_sensitivity.prohibited_promotion",
    code,
  ).map((item, index) =>
    requireIdentifier(
      item,
      `Profile studio_ready.evidence_sensitivity.prohibited_promotion[${index}]`,
      REFERENCE_ID_PATTERN,
      code,
    )
  );

  return {
    guidanceRefs,
    artifactPromotionDestinations: destinationRefs,
    evidenceSensitivity: {
      prohibitedPromotion,
    },
  };
}

export function validateStudioProfile(value, { manifest, roleVocabulary } = {}) {
  const code = "PROFILE_INVALID";
  if (!manifest || !roleVocabulary) {
    fail(code, "Profile validation requires a validated Core manifest and role vocabulary.");
  }

  const profile = requireObject(value, "App profile", code);
  requireOnlyKeys(
    profile,
    new Set([
      "schema_version",
      "profile_id",
      "application",
      "core_compatibility",
      "role_metadata",
      "studio_ready",
    ]),
    "App profile",
    code,
  );
  const schemaVersion = requireInteger(profile.schema_version, "Profile schema_version", code);
  if (schemaVersion !== manifest.profileSchemaVersion) {
    fail(
      "PROFILE_INCOMPATIBLE",
      `Profile schema_version ${schemaVersion} does not match Core profile_schema_version ${manifest.profileSchemaVersion}.`,
    );
  }

  const application = requireObject(profile.application, "Profile application", code);
  requireOnlyKeys(application, new Set(["id", "display_name"]), "Profile application", code);
  const applicationId = requireIdentifier(application.id, "Profile application.id", PROFILE_ID_PATTERN, code);
  const applicationDisplayName = application.display_name === undefined
    ? undefined
    : requireString(application.display_name, "Profile application.display_name", code);

  const compatibility = requireObject(profile.core_compatibility, "Profile core_compatibility", code);
  requireOnlyKeys(
    compatibility,
    new Set(["core_id", "core_major", "profile_schema_version"]),
    "Profile core_compatibility",
    code,
  );
  const compatibleCoreId = requireIdentifier(
    compatibility.core_id,
    "Profile core_compatibility.core_id",
    PROFILE_ID_PATTERN,
    code,
  );
  const compatibleCoreMajor = requireInteger(
    compatibility.core_major,
    "Profile core_compatibility.core_major",
    code,
  );
  const compatibleProfileSchema = requireInteger(
    compatibility.profile_schema_version,
    "Profile core_compatibility.profile_schema_version",
    code,
  );
  const compatibilityFailures = [];
  if (compatibleCoreId !== manifest.coreId) compatibilityFailures.push("core_id");
  if (compatibleCoreMajor !== manifest.coreMajor) compatibilityFailures.push("core_major");
  if (compatibleProfileSchema !== manifest.profileSchemaVersion) {
    compatibilityFailures.push("profile_schema_version");
  }
  if (compatibilityFailures.length) {
    fail(
      "PROFILE_INCOMPATIBLE",
      `Profile core_compatibility does not match the loaded Core: ${compatibilityFailures.join(", ")}.`,
    );
  }

  const roleMetadata = profile.role_metadata === undefined
    ? {}
    : requireObject(profile.role_metadata, "Profile role_metadata", code);
  const knownRoleIds = new Set(roleVocabulary.roleIds);
  const roleDisplayNames = {};
  for (const roleId of Object.keys(roleMetadata).sort()) {
    if (!knownRoleIds.has(roleId)) {
      fail(code, `Profile role_metadata references unknown role: ${roleId}.`);
    }
    const metadata = requireObject(roleMetadata[roleId], `Profile role_metadata.${roleId}`, code);
    requireOnlyKeys(metadata, new Set(["display_name"]), `Profile role_metadata.${roleId}`, code);
    if (metadata.display_name !== undefined) {
      roleDisplayNames[roleId] = requireString(
        metadata.display_name,
        `Profile role_metadata.${roleId}.display_name`,
        code,
      );
    }
  }

  const operational = {
    schemaVersion,
    profileId: requireIdentifier(profile.profile_id, "Profile profile_id", PROFILE_ID_PATTERN, code),
    applicationId,
    coreCompatibility: {
      coreId: compatibleCoreId,
      coreMajor: compatibleCoreMajor,
      profileSchemaVersion: compatibleProfileSchema,
    },
    roleIds: [...roleVocabulary.roleIds],
    ...(profile.studio_ready === undefined
      ? {}
      : { studioReady: validateStudioReadyProfileContext(profile.studio_ready) }),
  };
  const presentation = {
    ...(applicationDisplayName === undefined ? {} : { applicationDisplayName }),
    roleDisplayNames,
  };

  return deepFreeze({ operational, presentation });
}

export function loadStudioConfiguration({
  studioRoot = DEFAULT_STUDIO_ROOT,
  studioConfigPath = path.join(studioRoot, "studio.json"),
  profilePath,
} = {}) {
  const resolvedStudioRoot = path.resolve(studioRoot);
  const selection = validateStudioSelection(
    readJsonFile(path.resolve(studioConfigPath), "Studio configuration", "STUDIO_CONFIG_READ_FAILED"),
  );
  const manifestPath = resolveContainedPath(
    resolvedStudioRoot,
    selection.coreManifest,
    "Studio core_manifest",
    "STUDIO_CONFIG_INVALID",
  );
  const manifest = validateCoreManifest(
    readJsonFile(manifestPath, "Core manifest", "CORE_MANIFEST_READ_FAILED"),
  );
  const rolesPath = resolveContainedPath(
    path.dirname(manifestPath),
    manifest.rolesPath,
    "Core roles_path",
    "CORE_MANIFEST_INVALID",
  );
  const roleVocabulary = validateRoleVocabulary(
    readJsonFile(rolesPath, "role vocabulary", "ROLE_VOCABULARY_READ_FAILED"),
    manifest,
  );
  const resolvedProfilePath = profilePath
    ? path.resolve(profilePath)
    : resolveContainedPath(
      resolvedStudioRoot,
      selection.activeProfile,
      "Studio active_profile",
      "STUDIO_CONFIG_INVALID",
    );
  const profile = validateStudioProfile(
    readJsonFile(resolvedProfilePath, "App profile", "PROFILE_READ_FAILED"),
    { manifest, roleVocabulary },
  );

  return deepFreeze({
    operational: {
      studioSchemaVersion: selection.schemaVersion,
      core: {
        id: manifest.coreId,
        version: manifest.coreVersion,
        profileSchemaVersion: manifest.profileSchemaVersion,
      },
      roles: roleVocabulary.roles,
      profile: profile.operational,
    },
    presentation: profile.presentation,
  });
}
