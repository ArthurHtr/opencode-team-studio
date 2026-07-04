import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TeamsRegistry } from "@/lib/types";
import { getTeamsRegistry, saveTeamsRegistry, getActiveTeam, getTeamById, listTeams, setActiveTeamId, addTeamToRegistry } from "@/lib/teams/registry";

let root = "";
const previousRoot = process.env.OPENCODE_CONFIG_DIR;

function makeRegistry(activeId: string, teams: { id: string; name: string; createdAt: string; updatedAt: string; configFilename: "opencode.json" | "opencode.jsonc" }[]): TeamsRegistry {
  return {
    version: 1,
    activeTeamId: activeId,
    teams: teams.map((t) => ({ ...t, description: undefined })),
  } as TeamsRegistry;
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "opencode-teams-test-"));
  process.env.OPENCODE_CONFIG_DIR = root;
  await mkdir(path.join(root, "studio-data"), { recursive: true });
});

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.OPENCODE_CONFIG_DIR;
  else process.env.OPENCODE_CONFIG_DIR = previousRoot;
  await rm(root, { recursive: true, force: true });
});

describe("registry CRUD", () => {
  it("returns empty registry when no file exists", async () => {
    const registry = await getTeamsRegistry();
    expect(registry.version).toBe(1);
    expect(registry.activeTeamId).toBe("");
    expect(registry.teams).toHaveLength(0);
  });

  it("saves and reads registry", async () => {
    const registry = makeRegistry("team-1", [{ id: "team-1", name: "Team 1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" }]);
    await saveTeamsRegistry(registry);
    const read = await getTeamsRegistry();
    expect(read.activeTeamId).toBe("team-1");
    expect(read.teams).toHaveLength(1);
  });

  it("getActiveTeam returns the active team", async () => {
    const registry = makeRegistry("team-1", [
      { id: "team-1", name: "Active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" },
      { id: "team-2", name: "Inactive", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" },
    ]);
    await saveTeamsRegistry(registry);
    const active = await getActiveTeam();
    expect(active?.name).toBe("Active");
  });

  it("getTeamById finds a team", async () => {
    const registry = makeRegistry("team-1", [{ id: "team-1", name: "Team 1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" }]);
    await saveTeamsRegistry(registry);
    const team = await getTeamById("team-1");
    expect(team?.name).toBe("Team 1");
  });

  it("getTeamById returns undefined for unknown id", async () => {
    await saveTeamsRegistry(makeRegistry("", []));
    expect(await getTeamById("unknown")).toBeUndefined();
  });

  it("listTeams returns all teams", async () => {
    const registry = makeRegistry("team-1", [
      { id: "team-1", name: "A", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" },
      { id: "team-2", name: "B", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" },
    ]);
    await saveTeamsRegistry(registry);
    expect((await listTeams()).length).toBe(2);
  });

  it("setActiveTeamId updates the active team", async () => {
    const registry = makeRegistry("team-1", [
      { id: "team-1", name: "A", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" },
      { id: "team-2", name: "B", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" },
    ]);
    await saveTeamsRegistry(registry);
    await setActiveTeamId("team-2");
    const read = await getTeamsRegistry();
    expect(read.activeTeamId).toBe("team-2");
  });

  it("addTeamToRegistry adds a team and sets it active if no active", async () => {
    await saveTeamsRegistry(makeRegistry("", []));
    await addTeamToRegistry({ id: "team-1", name: "New", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" });
    const read = await getTeamsRegistry();
    expect(read.teams).toHaveLength(1);
    expect(read.activeTeamId).toBe("team-1");
  });
});
