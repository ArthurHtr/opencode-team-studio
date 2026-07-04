import "server-only";

import path from "node:path";
import { atomicWrite, exists, readUtf8 } from "@/lib/filesystem";
import { getConfigRoot } from "@/lib/env";
import type { StoredTeam, TeamId, TeamsRegistry } from "@/lib/types";
import { validateRegistry } from "@/lib/teams/validation";

const REGISTRY_FILENAME = "teams.json";
const REGISTRY_PATH = () => path.join(getConfigRoot(), "studio-data", REGISTRY_FILENAME);

const DEFAULT_REGISTRY: TeamsRegistry = {
  version: 1,
  activeTeamId: "",
  teams: [],
};

export async function getTeamsRegistry(): Promise<TeamsRegistry> {
  const filePath = REGISTRY_PATH();
  if (!await exists(filePath)) return DEFAULT_REGISTRY;
  try {
    const content = await readUtf8(filePath);
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return validateRegistry(parsed);
  } catch {
    return DEFAULT_REGISTRY;
  }
}

export async function saveTeamsRegistry(registry: TeamsRegistry): Promise<void> {
  const filePath = REGISTRY_PATH();
  const content = `${JSON.stringify(registry, null, 2)}\n`;
  await atomicWrite(filePath, content);
}

export async function getActiveTeam(): Promise<StoredTeam | undefined> {
  const registry = await getTeamsRegistry();
  return registry.teams.find((t) => t.id === registry.activeTeamId);
}

export async function getTeamById(id: TeamId): Promise<StoredTeam | undefined> {
  const registry = await getTeamsRegistry();
  return registry.teams.find((t) => t.id === id);
}

export async function listTeams(): Promise<StoredTeam[]> {
  const registry = await getTeamsRegistry();
  return registry.teams;
}

export async function setActiveTeamId(id: TeamId): Promise<void> {
  const registry = await getTeamsRegistry();
  registry.activeTeamId = id;
  await saveTeamsRegistry(registry);
}

export async function updateTeamInRegistry(id: TeamId, updates: Partial<Pick<StoredTeam, "name" | "description" | "updatedAt">>): Promise<void> {
  const registry = await getTeamsRegistry();
  const team = registry.teams.find((t) => t.id === id);
  if (!team) throw new Error(`Team not found: ${id}`);
  if (updates.name !== undefined) team.name = updates.name;
  if (updates.description !== undefined) team.description = updates.description;
  if (updates.updatedAt !== undefined) team.updatedAt = updates.updatedAt;
  else team.updatedAt = new Date().toISOString();
  await saveTeamsRegistry(registry);
}

export async function removeTeamFromRegistry(id: TeamId): Promise<void> {
  const registry = await getTeamsRegistry();
  const index = registry.teams.findIndex((t) => t.id === id);
  if (index === -1) throw new Error(`Team not found: ${id}`);
  registry.teams.splice(index, 1);
  if (registry.activeTeamId === id) {
    registry.activeTeamId = registry.teams[0]?.id ?? "";
  }
  await saveTeamsRegistry(registry);
}

export async function addTeamToRegistry(team: StoredTeam): Promise<void> {
  const registry = await getTeamsRegistry();
  registry.teams.push(team);
  if (!registry.activeTeamId) {
    registry.activeTeamId = team.id;
  }
  await saveTeamsRegistry(registry);
}
