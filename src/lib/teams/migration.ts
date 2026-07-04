import "server-only";

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getConfigRoot } from "@/lib/env";
import { atomicWrite, exists, readUtf8, safeConfigPath } from "@/lib/filesystem";
import { getStudioLayout } from "@/lib/layout-store";
import { getStudioMetadata } from "@/lib/metadata-store";
import type { StoredTeam, TeamConfigFormat } from "@/lib/types";

const MIGRATION_MARKER = ".team-migration-complete";
const REGISTRY_FILENAME = "teams.json";

export async function ensureTeamsInitialized(): Promise<void> {
  const root = getConfigRoot();
  const registryPath = path.join(root, "studio-data", REGISTRY_FILENAME);
  const markerPath = path.join(root, "studio-data", MIGRATION_MARKER);

  // Check if migration already ran
  if (await exists(registryPath)) {
    try {
      const content = await readUtf8(registryPath);
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (parsed.version === 1 && Array.isArray(parsed.teams) && parsed.teams.length > 0) {
        // Registry exists and has teams — migration already done
        return;
      }
    } catch {
      // Malformed registry — treat as needing migration
    }
  }

  // Detect active config file
  let configFilename: TeamConfigFormat = "opencode.json";
  let configContent = "{}";
  if (await exists(safeConfigPath("opencode.jsonc"))) {
    configFilename = "opencode.jsonc";
    configContent = await readUtf8(safeConfigPath("opencode.jsonc"));
  } else if (await exists(safeConfigPath("opencode.json"))) {
    configFilename = "opencode.json";
    configContent = await readUtf8(safeConfigPath("opencode.json"));
  }

  // Read current layout
  let layoutContent = "";
  try {
    const layout = await getStudioLayout();
    layoutContent = `${JSON.stringify({ version: 2, views: layout.views ?? {} }, null, 2)}\n`;
  } catch {
    layoutContent = `${JSON.stringify({ version: 2, views: {} }, null, 2)}\n`;
  }

  // Read current metadata
  let metadataContent = "";
  try {
    const metadata = await getStudioMetadata();
    metadataContent = `${JSON.stringify(metadata, null, 2)}\n`;
  } catch {
    metadataContent = `${JSON.stringify({ version: 2 }, null, 2)}\n`;
  }

  // List current agents
  const agents: Map<string, string> = new Map();
  const agentsDir = safeConfigPath("agents");
  if (await exists(agentsDir)) {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const content = await readUtf8(path.join(agentsDir, entry.name));
      agents.set(entry.name, content);
    }
  }

  // Create team
  const teamId = crypto.randomUUID();
  const now = new Date().toISOString();
  const teamBasePath = path.join(root, "studio-data", "teams");
  const teamPath = path.join(teamBasePath, teamId);

  await mkdir(teamPath, { recursive: true });
  await mkdir(path.join(teamPath, "agents"), { recursive: true });

  // Write config
  await atomicWrite(path.join(teamPath, configFilename), configContent.endsWith("\n") ? configContent : `${configContent}\n`);

  // Write agents
  for (const [name, content] of agents) {
    await atomicWrite(path.join(teamPath, "agents", name), content.endsWith("\n") ? content : `${content}\n`);
  }

  // Write layout
  await atomicWrite(path.join(teamPath, "layout.json"), layoutContent);

  // Write metadata
  await atomicWrite(path.join(teamPath, "metadata.json"), metadataContent);

  // Write manifest
  const manifest = {
    version: 1,
    teamId,
    configFilename,
    createdAt: now,
  };
  await atomicWrite(path.join(teamPath, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  // Create registry
  const storedTeam: StoredTeam = {
    id: teamId,
    name: "Default team",
    createdAt: now,
    updatedAt: now,
    configFilename,
  };

  const registry = {
    version: 1,
    activeTeamId: teamId,
    teams: [storedTeam],
  };

  await mkdir(path.join(root, "studio-data"), { recursive: true });
  await atomicWrite(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

  // Create migration marker
  await writeFile(markerPath, "migrated\n", "utf8");
}
