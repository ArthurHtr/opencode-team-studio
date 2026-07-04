import { mkdtemp, mkdir, writeFile, rm, readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTeam, renameTeam, deleteTeam, duplicateTeam, captureActiveRuntimeToProfile, materializeTeam } from "@/lib/teams/storage";
import { getTeamsRegistry, addTeamToRegistry } from "@/lib/teams/registry";

let root = "";
const previousRoot = process.env.OPENCODE_CONFIG_DIR;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "opencode-storage-test-"));
  process.env.OPENCODE_CONFIG_DIR = root;
  await mkdir(path.join(root, "studio-data"), { recursive: true });
  await mkdir(path.join(root, "agents"), { recursive: true });
  await writeFile(path.join(root, "opencode.json"), '{"$schema":"https://opencode.ai/config.json"}\n', "utf8");
  await writeFile(path.join(root, "studio-data", "team-layout.json"), '{"version":2,"views":{}}\n', "utf8");
  await writeFile(path.join(root, "studio-data", "team-metadata.json"), '{"version":2}\n', "utf8");
  await writeFile(path.join(root, "agents", "build.md"), "---\ndescription: build\n---\nprompt", "utf8");
});

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.OPENCODE_CONFIG_DIR;
  else process.env.OPENCODE_CONFIG_DIR = previousRoot;
  await rm(root, { recursive: true, force: true });
});

describe("createTeam", () => {
  it("creates an empty team with all files", async () => {
    const team = await createTeam("Test Team", "A test team");
    expect(team.name).toBe("Test Team");
    expect(team.description).toBe("A test team");
    expect(team.configFilename).toBe("opencode.json");

    const teamPath = path.join(root, "studio-data", "teams", team.id);
    const { stat } = await import("node:fs/promises");
    expect(await stat(path.join(teamPath, "opencode.json"))).toBeTruthy();
    expect(await stat(path.join(teamPath, "agents", "build.md"))).toBeTruthy();
    expect(await stat(path.join(teamPath, "layout.json"))).toBeTruthy();
    expect(await stat(path.join(teamPath, "metadata.json"))).toBeTruthy();
    expect(await stat(path.join(teamPath, "manifest.json"))).toBeTruthy();
  });

  it("adds team to registry", async () => {
    const team = await createTeam("Registry Team");
    const registry = await getTeamsRegistry();
    expect(registry.teams.some((t) => t.id === team.id)).toBe(true);
  });

  it("rejects empty name", async () => {
    await expect(createTeam("")).rejects.toThrow();
  });
});

describe("renameTeam", () => {
  it("renames a team without moving directory", async () => {
    const team = await createTeam("Rename Test");
    const teamId = team.id;
    const oldPath = path.join(root, "studio-data", "teams", teamId);
    const { stat } = await import("node:fs/promises");

    const renamed = await renameTeam(teamId, "Renamed Team");
    expect(renamed.name).toBe("Renamed Team");

    // Directory should still be at same path
    expect(await stat(oldPath)).toBeTruthy();

    // Registry should be updated for this team
    const registry = await getTeamsRegistry();
    const found = registry.teams.find((t) => t.id === teamId);
    expect(found?.name).toBe("Renamed Team");
  });
});

describe("deleteTeam", () => {
  it("deletes an inactive team", async () => {
    const team = await createTeam("To Delete");
    const teamId = team.id;
    const { stat } = await import("node:fs/promises");

    // Create another team to be active
    await createTeam("Keep");

    await deleteTeam(teamId);

    // Directory should be gone
    await expect(stat(path.join(root, "studio-data", "teams", teamId))).rejects.toThrow();

    // Should not be in registry
    const registry = await getTeamsRegistry();
    expect(registry.teams.find((t) => t.id === teamId)).toBeUndefined();
  });

  it("rejects deleting active team", async () => {
    const activeId = "c3d4e5f6-a7b8-4cde-9fab-345678901cde";
    const { saveTeamsRegistry } = await import("@/lib/teams/registry");
    await saveTeamsRegistry({
      version: 1,
      activeTeamId: activeId,
      teams: [{ id: activeId, name: "Active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" }],
    });
    let caught = false;
    try {
      await deleteTeam(activeId);
    } catch (error) {
      caught = true;
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).toContain("Cannot delete the active team");
    }
    expect(caught).toBe(true);
  });
});

describe("duplicateTeam", () => {
  it("duplicates a team", async () => {
    const original = await createTeam("Original");
    await writeFile(path.join(root, "studio-data", "teams", original.id, "agents", "custom.md"), "---\ndescription: custom\n---\nprompt", "utf8");

    const duplicated = await duplicateTeam(original.id, "Copy of Original");
    expect(duplicated.name).toBe("Copy of Original");
    expect(duplicated.id).not.toBe(original.id);

    // Should have same config
    const origConfig = await readFile(path.join(root, "studio-data", "teams", original.id, "opencode.json"), "utf8");
    const dupConfig = await readFile(path.join(root, "studio-data", "teams", duplicated.id, "opencode.json"), "utf8");
    expect(origConfig).toBe(dupConfig);

    // Should have the custom agent
    const dupAgents = await readdir(path.join(root, "studio-data", "teams", duplicated.id, "agents"));
    expect(dupAgents).toContain("custom.md");
  });

  it("rejects duplicating non-existent team", async () => {
    await expect(duplicateTeam("non-existent", "Copy")).rejects.toThrow();
  });
});

describe("captureActiveRuntimeToProfile", () => {
  it("syncs runtime to team profile", async () => {
    const team = await createTeam("Sync Team");
    await writeFile(path.join(root, "opencode.json"), '{"updated": true}\n', "utf8");

    await captureActiveRuntimeToProfile(team.id);

    const syncedConfig = await readFile(path.join(root, "studio-data", "teams", team.id, "opencode.json"), "utf8");
    expect(syncedConfig).toContain('"updated": true');
  });
});

describe("materializeTeam", () => {
  it("materializes team config to runtime", async () => {
    const team = await createTeam("Materialize Team");
    const teamPath = path.join(root, "studio-data", "teams", team.id);

    // Modify team config
    await writeFile(path.join(teamPath, "opencode.json"), '{"team-specific": true}\n', "utf8");

    await materializeTeam(team.id);

    // Runtime should have team-specific config
    const runtimeConfig = await readFile(path.join(root, "opencode.json"), "utf8");
    expect(runtimeConfig).toContain('"team-specific": true');
  });

  it("replaces agents directory completely", async () => {
    const teamId = "a1b2c3d4-e5f6-4abc-8def-123456789abc";
    // Create team profile manually to avoid createTeam adding build.md
    const teamPath = path.join(root, "studio-data", "teams", teamId);
    await mkdir(teamPath, { recursive: true });
    await mkdir(path.join(teamPath, "agents"), { recursive: true });
    await writeFile(path.join(teamPath, "opencode.json"), '{"$schema":"https://opencode.ai/config.json"}\n', "utf8");
    await writeFile(path.join(teamPath, "agents", "team-agent.md"), "---\ndescription: team agent\n---\nprompt", "utf8");
    await writeFile(path.join(teamPath, "layout.json"), '{"version":2,"views":{}}\n', "utf8");
    await writeFile(path.join(teamPath, "metadata.json"), '{"version":2}\n', "utf8");
    await writeFile(path.join(teamPath, "manifest.json"), JSON.stringify({ version: 1, teamId, configFilename: "opencode.json", createdAt: "2026-01-01T00:00:00.000Z" }, null, 2) + "\n", "utf8");

    // Add team to registry
    await addTeamToRegistry({ id: teamId, name: "Materialize Team", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" });

    // Add runtime agent that should be removed
    await writeFile(path.join(root, "agents", "old-agent.md"), "---\ndescription: old\n---\nprompt", "utf8");

    await materializeTeam(teamId);

    const runtimeAgents = await readdir(path.join(root, "agents"));
    expect(runtimeAgents).toContain("team-agent.md");
    expect(runtimeAgents).not.toContain("old-agent.md");
  });
});
