import "server-only";

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getConfigRoot } from "@/lib/env";
import { atomicWrite, exists, readUtf8, safeConfigPath } from "@/lib/filesystem";
import { parseJsoncObject } from "@/lib/config-store";
import type { TeamId } from "@/lib/types";
import { getActiveTeam, getTeamById, setActiveTeamId, updateTeamInRegistry } from "@/lib/teams/registry";
import { validateTeamId } from "@/lib/teams/validation";
import { materializeTeam, synchronizeActiveRuntimeToProfile } from "@/lib/teams/storage";

async function verifyRuntimeSnapshot(): Promise<{ agents: number; configExists: boolean } | null> {
  try {
    const configExists = await exists(safeConfigPath("opencode.json")) || await exists(safeConfigPath("opencode.jsonc"));
    const agentsDir = safeConfigPath("agents");
    let agentCount = 0;
    if (await exists(agentsDir)) {
      const entries = await readdir(agentsDir, { withFileTypes: true });
      agentCount = entries.filter((e) => e.isFile() && e.name.endsWith(".md")).length;
    }
    return { agents: agentCount, configExists };
  } catch {
    return null;
  }
}

export async function activateTeam(teamId: TeamId): Promise<{ success: true; teamId: string }> {
  validateTeamId(teamId);

  const targetTeam = await getTeamById(teamId);
  if (!targetTeam) throw new Error(`Team not found: ${teamId}`);

  const activeTeam = await getActiveTeam();
  if (activeTeam?.id === teamId) {
    return { success: true, teamId };
  }

  if (activeTeam) {
    try {
      await synchronizeActiveRuntimeToProfile();
    } catch (error) {
      console.error(`Failed to sync outgoing team ${activeTeam.id}:`, error);
    }
  }

  const teamBasePath = path.join(getConfigRoot(), "studio-data", "teams");
  const targetPath = path.join(teamBasePath, teamId);
  await stat(targetPath);

  const configPath = path.join(targetPath, targetTeam.configFilename);
  if (!await exists(configPath)) throw new Error(`Team config not found: ${targetTeam.configFilename}`);

  const configContent = await readUtf8(configPath);
  const parsed = parseJsoncObject(configContent);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid team config");

  const agentsPath = path.join(targetPath, "agents");
  if (!await exists(agentsPath)) throw new Error("Team agents directory not found");

  await materializeTeam(teamId);

  const verification = await verifyRuntimeSnapshot();
  if (!verification || !verification.configExists) throw new Error("Runtime verification failed after activation");

  await setActiveTeamId(teamId);
  await updateTeamInRegistry(teamId, { updatedAt: new Date().toISOString() });

  const manifestPath = path.join(targetPath, "manifest.json");
  if (await exists(manifestPath)) {
    const raw = await readUtf8(manifestPath);
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    manifest.lastMaterializedAt = new Date().toISOString();
    await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return { success: true, teamId };
}
