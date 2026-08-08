import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const expectedAgents = new Map([
  ["bug-investigator.toml", "bug-investigator"],
  ["builder.toml", "builder"],
  ["explorer-architect.toml", "explorer-architect"],
  ["product-guardrail.toml", "product-guardrail"],
  ["qa-smoke-tester.toml", "qa-smoke-tester"],
  ["reviewer.toml", "reviewer"],
  ["tester.toml", "tester"],
]);

const expectedSkills = new Map([
  ["wordloom-dev-cycle", "wordloom-dev-cycle"],
  ["wordloom-smoke-qa", "wordloom-smoke-qa"],
]);

function readRepoFile(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function parseSimpleToml(source) {
  const result = {};
  let current = result;
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const section = trimmed.match(/^\[([^\]]+)\]$/);
    if (section) {
      current = result[section[1]] = result[section[1]] || {};
      continue;
    }

    const assignment = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    assert.ok(assignment, `invalid TOML at line ${lineNumber}: ${trimmed}`);

    const [, key, rawValue] = assignment;
    if (rawValue === '"""') {
      const parts = [];
      let closed = false;
      index += 1;
      for (; index < lines.length; index += 1) {
        if (lines[index].trim() === '"""') {
          closed = true;
          break;
        }
        parts.push(lines[index]);
      }
      assert.ok(closed, `unclosed multiline TOML string for ${key}`);
      current[key] = parts.join("\n");
    } else if (/^".*"$/.test(rawValue)) {
      current[key] = rawValue.slice(1, -1);
    } else if (rawValue === "true" || rawValue === "false") {
      current[key] = rawValue === "true";
    } else if (/^\d+$/.test(rawValue)) {
      current[key] = Number(rawValue);
    } else {
      assert.fail(`unsupported TOML value for ${key}: ${rawValue}`);
    }
  }

  return result;
}

function assertAscii(relativePath) {
  const source = readRepoFile(relativePath);
  const nonAscii = [...source].find((character) => character.charCodeAt(0) > 127);
  assert.equal(nonAscii, undefined, `${relativePath} should stay ASCII`);
}

function parseSkillFrontmatter(relativePath) {
  const source = readRepoFile(relativePath);
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(match, `${relativePath} should have YAML frontmatter`);
  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const parts = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
        assert.ok(parts, `${relativePath} has invalid frontmatter line: ${line}`);
        return [parts[1], parts[2]];
      }),
  );
}

describe("Codex workflow configuration", () => {
  test("root guidance files are present and ASCII", () => {
    for (const relativePath of ["AGENTS.md", "DEV_WORKFLOW.md"]) {
      assertAscii(relativePath);
      assert.ok(readRepoFile(relativePath).trim().length > 0, `${relativePath} should not be empty`);
    }
  });

  test("project config enables bounded subagent use", () => {
    assertAscii(".codex/config.toml");
    const config = parseSimpleToml(readRepoFile(".codex/config.toml"));
    assert.equal(config.agents.enabled, true);
    assert.equal(config.agents.max_concurrent_threads_per_session, 6);
  });

  test("all project agents define required fields and safe boundaries", () => {
    const agentFiles = readdirSync(path.join(rootDir, ".codex", "agents")).sort();
    assert.deepEqual(agentFiles, [...expectedAgents.keys()].sort());

    for (const file of agentFiles) {
      const relativePath = path.join(".codex", "agents", file).replaceAll("\\", "/");
      assertAscii(relativePath);
      const agent = parseSimpleToml(readRepoFile(relativePath));
      assert.equal(agent.name, expectedAgents.get(file));
      assert.ok(agent.description, `${file} should describe when to use the agent`);
      assert.ok(agent.developer_instructions, `${file} should define developer_instructions`);
      assert.ok(["read-only", "workspace-write"].includes(agent.sandbox_mode), `${file} sandbox should be bounded`);
    }
  });

  test("write-capable scope is limited to Builder", () => {
    for (const [file, name] of expectedAgents) {
      const agent = parseSimpleToml(readRepoFile(path.join(".codex", "agents", file)));
      const expectedMode = name === "builder" ? "workspace-write" : "read-only";
      assert.equal(agent.sandbox_mode, expectedMode, `${name} should be ${expectedMode}`);
    }
  });

  test("repo skills have valid frontmatter and matching folder names", () => {
    const skillRoot = path.join(rootDir, ".agents", "skills");
    const skillDirs = readdirSync(skillRoot).sort();
    assert.deepEqual(skillDirs, [...expectedSkills.keys()].sort());

    for (const folder of skillDirs) {
      const relativePath = path.join(".agents", "skills", folder, "SKILL.md").replaceAll("\\", "/");
      assertAscii(relativePath);
      const frontmatter = parseSkillFrontmatter(relativePath);
      assert.equal(frontmatter.name, expectedSkills.get(folder));
      assert.ok(frontmatter.description, `${folder} should define a trigger description`);
    }
  });

  test("ship guidance keeps production deployment separately gated", () => {
    const guidance = readRepoFile("AGENTS.md");
    const skill = readRepoFile(".agents/skills/wordloom-dev-cycle/SKILL.md");
    assert.match(guidance, /push only if the branch\/remote is expected and the push does not itself deploy production/);
    assert.match(skill, /Stop before pushing if on an unexpected branch/);
    assert.match(guidance, /production deployment/);
  });
});
