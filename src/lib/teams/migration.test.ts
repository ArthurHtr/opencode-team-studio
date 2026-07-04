import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureTeamsInitialized } from "@/lib/teams/migration";

let root = "";
const previousRoot = process.env.OPENCODE_CONFIG_DIR;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "opencode-migration-test-"));
  process.env.OPENCODE_CONFIG_DIR = root;
  await mkdir(path.join(root, "studio-data"), { recursive: true });
  await mkdir(path.join(root, "agents"), { recursive: true });
});

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.OPENCODE_CONFIG_DIR;
  else process.env.OPENCODE_CONFIG_DIR = previousRoot;
  await rm(root, { recursive: true, force: true });
});

describe("migration", () => {
  it("creates registry from opencode.json", async () => {
    await writeFile(path.join(root, "opencode.json"), '{"$schema":"https://opencode.ai/config.json"}\n', "utf8");
    await ensureTeamsInitialized();

    const registryContent = await readFile(path.join(root, "studio-data", "teams.json"), "utf8");
    const registry = JSON.parse(registryContent);
    expect(registry.version).toBe(1);
    expect(registry.teams).toHaveLength(1);
    expect(registry.activeTeamId).toBeTruthy();
    expect(registry.teams[0].configFilename).toBe("opencode.json");

    // Check marker exists
    const marker = await readFile(path.join(root, "studio-data", ".team-migration-complete"), "utf8");
    expect(marker).toContain("migrated");
  });

  it("creates registry from opencode.jsonc", async () => {
    await writeFile(path.join(root, "opencode.jsonc"), '{\n  // comment\n  "$schema": "https://opencode.ai/config.json"\n}\n', "utf8");
    await ensureTeamsInitialized();

    const registryContent = await readFile(path.join(root, "studio-data", "teams.json"), "utf8");
    const registry = JSON.parse(registryContent);
    expect(registry.teams[0].configFilename).toBe("opencode.jsonc");

    // Check config was copied with comments preserved
    const teamConfig = await readFile(path.join(root, "studio-data", "teams", registry.activeTeamId, "opencode.jsonc"), "utf8");
    expect(teamConfig).toContain("// comment");
  });

  it("is idempotent", async () => {
    await writeFile(path.join(root, "opencode.json"), "{}\n", "utf8");
    await ensureTeamsInitialized();
    await ensureTeamsInitialized();

    const registryContent = await readFile(path.join(root, "studio-data", "teams.json"), "utf8");
    const registry = JSON.parse(registryContent);
    expect(registry.teams).toHaveLength(1);
  });

  it("copies agents to team profile", async () => {
    await writeFile(path.join(root, "opencode.json"), "{}\n", "utf8");
    await writeFile(path.join(root, "agents", "test.md"), "---\ndescription: test\n---\nprompt", "utf8");
    await ensureTeamsInitialized();

    const registryContent = await readFile(path.join(root, "studio-data", "teams.json"), "utf8");
    const registry = JSON.parse(registryContent);
    const agentsDir = path.join(root, "studio-data", "teams", registry.activeTeamId, "agents");
    const entries = await readdir(agentsDir);
    expect(entries).toContain("test.md");
  });

  it("handles empty config dir", async () => {
    await ensureTeamsInitialized();
    const registryContent = await readFile(path.join(root, "studio-data", "teams.json"), "utf8");
    const registry = JSON.parse(registryContent);
    expect(registry.teams).toHaveLength(1);
  });

  it("skips migration if registry exists with teams", async () => {
    await writeFile(path.join(root, "opencode.json"), '{"old": true}\n', "utf8");
    await writeFile(path.join(root, "studio-data", "teams.json"), JSON.stringify({
      version: 1,
      activeTeamId: "existing",
      teams: [{ id: "existing", name: "Existing", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" }],
    }), "utf8");

    await ensureTeamsInitialized();

    const registryContent = await readFile(path.join(root, "studio-data", "teams.json"), "utf8");
    const registry = JSON.parse(registryContent);
    expect(registry.teams).toHaveLength(1);
    expect(registry.teams[0].id).toBe("existing");
  });
});
