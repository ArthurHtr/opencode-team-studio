import "server-only";

import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getConfigRoot } from "@/lib/env";
import { atomicWrite, exists, readUtf8, removePath, safeConfigPath } from "@/lib/filesystem";
import { getStudioLayout } from "@/lib/layout-store";
import { getStudioMetadata } from "@/lib/metadata-store";
import type { StoredTeam, TeamConfigFormat, TeamId } from "@/lib/types";
import { addTeamToRegistry, getActiveTeam, getTeamById, removeTeamFromRegistry, updateTeamInRegistry } from "@/lib/teams/registry";
import { resolveTeamPath, validateTeamId, validateTeamName } from "@/lib/teams/validation";
import { createAutomaticRevision, rotateAutomaticRevisions } from "@/lib/teams/revisions";
import { computeTeamContentHash } from "@/lib/teams/revision-hash";

const TEAMS_BASE = () => path.join(getConfigRoot(), "studio-data", "teams");

function teamProfilePath(teamId: string): string {
  return resolveTeamPath(TEAMS_BASE(), teamId);
}

function teamConfigPath(teamId: string, configFilename: string): string {
  return path.join(teamProfilePath(teamId), configFilename);
}

function teamAgentsPath(teamId: string): string {
  return path.join(teamProfilePath(teamId), "agents");
}

function teamLayoutPath(teamId: string): string {
  return path.join(teamProfilePath(teamId), "layout.json");
}

function teamMetadataPath(teamId: string): string {
  return path.join(teamProfilePath(teamId), "metadata.json");
}

function teamManifestPath(teamId: string): string {
  return path.join(teamProfilePath(teamId), "manifest.json");
}

async function computeFileHash(filePath: string): Promise<string> {
  try {
    const content = await readUtf8(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return "";
  }
}

async function detectConfigFormat(): Promise<TeamConfigFormat> {
  if (await exists(safeConfigPath("opencode.jsonc"))) return "opencode.jsonc";
  return "opencode.json";
}

async function copyConfigToProfile(teamId: string, configFilename: string): Promise<void> {
  const sourcePath = safeConfigPath(configFilename);
  const destPath = teamConfigPath(teamId, configFilename);
  if (await exists(sourcePath)) {
    const content = await readUtf8(sourcePath);
    await atomicWrite(destPath, content.endsWith("\n") ? content : `${content}\n`);
  }
}

async function copyAgentsToProfile(teamId: string): Promise<void> {
  const sourceAgents = safeConfigPath("agents");
  const destAgents = teamAgentsPath(teamId);
  if (await exists(sourceAgents)) {
    await mkdir(destAgents, { recursive: true });
    const entries = await readdir(sourceAgents, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const src = path.join(sourceAgents, entry.name);
      const dst = path.join(destAgents, entry.name);
      await cp(src, dst, { recursive: true, force: true });
    }
  }
}

async function copyLayoutToProfile(teamId: string): Promise<void> {
  const layout = await getStudioLayout();
  const content = `${JSON.stringify({ version: 2, views: layout.views ?? {} }, null, 2)}\n`;
  await atomicWrite(teamLayoutPath(teamId), content);
}

async function copyMetadataToProfile(teamId: string): Promise<void> {
  const metadata = await getStudioMetadata();
  const content = `${JSON.stringify(metadata, null, 2)}\n`;
  await atomicWrite(teamMetadataPath(teamId), content);
}

async function createManifest(teamId: string, configFilename: TeamConfigFormat): Promise<void> {
  const manifest = {
    version: 1,
    teamId,
    configFilename,
    createdAt: new Date().toISOString(),
  };
  await atomicWrite(teamManifestPath(teamId), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function createTeam(name: string, description?: string, mode: "empty" | "duplicate-active" | "duplicate-team" = "empty", sourceTeamId?: TeamId): Promise<StoredTeam> {
  const sanitizedName = validateTeamName(name);
  const teamId = crypto.randomUUID();
  const now = new Date().toISOString();
  const configFilename = await detectConfigFormat();

  await mkdir(teamProfilePath(teamId), { recursive: true });
  await mkdir(teamAgentsPath(teamId), { recursive: true });

  if (mode === "duplicate-active" || mode === "duplicate-team") {
    const sourceId = mode === "duplicate-active"
      ? (await getActiveTeam())?.id
      : sourceTeamId;
    if (!sourceId) throw new Error("No source team available for duplication");
    validateTeamId(sourceId);
    const sourcePath = teamProfilePath(sourceId);
    const sourceConfig = await getTeamById(sourceId);
    if (!sourceConfig) throw new Error(`Source team not found: ${sourceId}`);

    // Copy config
    const sourceConfigPath = path.join(sourcePath, sourceConfig.configFilename);
    if (await exists(sourceConfigPath)) {
      const content = await readUtf8(sourceConfigPath);
      await atomicWrite(teamConfigPath(teamId, configFilename), content.endsWith("\n") ? content : `${content}\n`);
    }

    // Copy agents
    const sourceAgents = path.join(sourcePath, "agents");
    if (await exists(sourceAgents)) {
      await mkdir(teamAgentsPath(teamId), { recursive: true });
      const entries = await readdir(sourceAgents, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        const src = path.join(sourceAgents, entry.name);
        const dst = path.join(teamAgentsPath(teamId), entry.name);
        await cp(src, dst, { recursive: true, force: true });
      }
    }

    // Copy layout
    const sourceLayout = path.join(sourcePath, "layout.json");
    if (await exists(sourceLayout)) {
      const content = await readUtf8(sourceLayout);
      await atomicWrite(teamLayoutPath(teamId), content.endsWith("\n") ? content : `${content}\n`);
    }

    // Copy metadata
    const sourceMetadata = path.join(sourcePath, "metadata.json");
    if (await exists(sourceMetadata)) {
      const content = await readUtf8(sourceMetadata);
      await atomicWrite(teamMetadataPath(teamId), content.endsWith("\n") ? content : `${content}\n`);
    }
  } else {
    // Empty team: copy current runtime
    await copyConfigToProfile(teamId, configFilename);
    await copyAgentsToProfile(teamId);
    await copyLayoutToProfile(teamId);
    await copyMetadataToProfile(teamId);
  }

  await createManifest(teamId, configFilename);

  const storedTeam: StoredTeam = {
    id: teamId,
    name: sanitizedName,
    description,
    createdAt: now,
    updatedAt: now,
    configFilename,
  };

  await addTeamToRegistry(storedTeam);
  return storedTeam;
}

export async function duplicateTeam(sourceTeamId: TeamId, name: string): Promise<StoredTeam> {
  const resolvedId = sourceTeamId === "active"
    ? (await getActiveTeam())?.id
    : sourceTeamId;
  if (!resolvedId) throw new Error("No active team available for duplication");
  validateTeamId(resolvedId);
  const sanitizedName = validateTeamName(name);
  const source = await getTeamById(resolvedId);
  if (!source) throw new Error(`Source team not found: ${resolvedId}`);

  const teamId = crypto.randomUUID();
  const now = new Date().toISOString();
  const configFilename = source.configFilename;

  await mkdir(teamProfilePath(teamId), { recursive: true });
  await mkdir(teamAgentsPath(teamId), { recursive: true });

  // Copy config
  const sourceConfigPath = path.join(teamProfilePath(resolvedId), configFilename);
  if (await exists(sourceConfigPath)) {
    const content = await readUtf8(sourceConfigPath);
    await atomicWrite(teamConfigPath(teamId, configFilename), content.endsWith("\n") ? content : `${content}\n`);
  }

  // Copy agents
  const sourceAgents = path.join(teamProfilePath(resolvedId), "agents");
  if (await exists(sourceAgents)) {
    const entries = await readdir(sourceAgents, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const src = path.join(sourceAgents, entry.name);
      const dst = path.join(teamAgentsPath(teamId), entry.name);
      await cp(src, dst, { recursive: true, force: true });
    }
  }

  // Copy layout
  const sourceLayout = path.join(teamProfilePath(resolvedId), "layout.json");
  if (await exists(sourceLayout)) {
    const content = await readUtf8(sourceLayout);
    await atomicWrite(teamLayoutPath(teamId), content.endsWith("\n") ? content : `${content}\n`);
  }

  // Copy metadata
  const sourceMetadata = path.join(teamProfilePath(resolvedId), "metadata.json");
  if (await exists(sourceMetadata)) {
    const content = await readUtf8(sourceMetadata);
    await atomicWrite(teamMetadataPath(teamId), content.endsWith("\n") ? content : `${content}\n`);
  }

  await createManifest(teamId, configFilename);

  const storedTeam: StoredTeam = {
    id: teamId,
    name: sanitizedName,
    description: source.description,
    createdAt: now,
    updatedAt: now,
    configFilename,
  };

  await addTeamToRegistry(storedTeam);
  return storedTeam;
}

export async function renameTeam(teamId: TeamId, newName: string): Promise<StoredTeam> {
  validateTeamId(teamId);
  const sanitizedName = validateTeamName(newName);
  const team = await getTeamById(teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  await updateTeamInRegistry(teamId, { name: sanitizedName });
  return { ...team, name: sanitizedName, updatedAt: new Date().toISOString() };
}

export async function deleteTeam(teamId: TeamId): Promise<void> {
  validateTeamId(teamId);
  const active = await getActiveTeam();
  if (active?.id === teamId) throw new Error("Cannot delete the active team");

  const team = await getTeamById(teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const teamPath = teamProfilePath(teamId);
  await rm(teamPath, { recursive: true, force: true });
  await removeTeamFromRegistry(teamId);
}

export async function captureActiveRuntimeToProfile(teamId: TeamId): Promise<void> {
  validateTeamId(teamId);
  const team = await getTeamById(teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const profilePath = teamProfilePath(teamId);

  // Sync config
  const configFilename = team.configFilename;
  const sourcePath = safeConfigPath(configFilename);
  if (await exists(sourcePath)) {
    const content = await readUtf8(sourcePath);
    await atomicWrite(path.join(profilePath, configFilename), content.endsWith("\n") ? content : `${content}\n`);
  }

  // Sync agents
  const sourceAgents = safeConfigPath("agents");
  const destAgents = path.join(profilePath, "agents");
  await mkdir(destAgents, { recursive: true });
  if (await exists(sourceAgents)) {
    const entries = await readdir(sourceAgents, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const src = path.join(sourceAgents, entry.name);
      const dst = path.join(destAgents, entry.name);
      await cp(src, dst, { recursive: true, force: true });
    }
  }

  // Sync layout
  const layout = await getStudioLayout();
  await atomicWrite(path.join(profilePath, "layout.json"), `${JSON.stringify({ version: 2, views: layout.views ?? {} }, null, 2)}\n`);

  // Sync metadata
  const metadata = await getStudioMetadata();
  await atomicWrite(path.join(profilePath, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);

  // Update manifest
  const manifestPath = path.join(profilePath, "manifest.json");
  if (await exists(manifestPath)) {
    const raw = await readUtf8(manifestPath);
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    manifest.lastMaterializedAt = new Date().toISOString();
    manifest.lastMaterializedHash = await computeFileHash(sourcePath);
    await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

export async function materializeTeam(teamId: TeamId): Promise<void> {
  validateTeamId(teamId);
  const team = await getTeamById(teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const profilePath = teamProfilePath(teamId);
  const configFilename = team.configFilename;

  // Read team config
  const teamConfigPath = path.join(profilePath, configFilename);
  if (!await exists(teamConfigPath)) throw new Error(`Team config not found: ${configFilename}`);
  const configContent = await readUtf8(teamConfigPath);

  // Read team agents
  const teamAgentsPath = path.join(profilePath, "agents");
  if (!await exists(teamAgentsPath)) throw new Error("Team agents directory not found");

  // Remove stale alternate config file
  const alternate = configFilename === "opencode.json" ? "opencode.jsonc" : "opencode.json";
  const alternatePath = safeConfigPath(alternate);
  if (await exists(alternatePath)) {
    await removePath(alternatePath);
  }

  // Write config atomically
  await atomicWrite(safeConfigPath(configFilename), configContent.endsWith("\n") ? configContent : `${configContent}\n`);

  // Replace agents directory completely — remove and recreate
  const runtimeAgents = safeConfigPath("agents");
  await removePath(runtimeAgents);
  await mkdir(runtimeAgents, { recursive: true });

  const entries = await readdir(teamAgentsPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const src = path.join(teamAgentsPath, entry.name);
    const dst = path.join(runtimeAgents, entry.name);
    await cp(src, dst, { recursive: true, force: true });
  }

  // Update manifest
  const manifestPath = path.join(profilePath, "manifest.json");
  if (await exists(manifestPath)) {
    const raw = await readUtf8(manifestPath);
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    manifest.lastMaterializedAt = new Date().toISOString();
    manifest.lastMaterializedHash = await computeFileHash(safeConfigPath(configFilename));
    await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

export async function synchronizeActiveRuntimeToProfile(): Promise<void> {
  const active = await getActiveTeam();
  if (!active) return;
  await captureActiveRuntimeToProfile(active.id);
}

export async function createRevisionIfNeeded(teamId: TeamId, reason?: string): Promise<void> {
  validateTeamId(teamId);
  const team = await getTeamById(teamId);
  if (!team) return;

  const currentHash = await computeTeamContentHash(teamId);

  // Check if latest automatic revision has same hash
  const { listTeamRevisions } = await import("@/lib/teams/revisions");
  const revisions = await listTeamRevisions(teamId);
  const automaticRevisions = revisions.filter((r) => r.kind === "automatic");
  if (automaticRevisions.length > 0 && automaticRevisions[0].contentHash === currentHash && currentHash) {
    return; // Skip duplicate
  }

  await createAutomaticRevision(teamId, (reason as "before-save" | "before-switch" | "before-restore" | "before-destructive-operation" | "manual") || "before-save");
  await rotateAutomaticRevisions(teamId);
}
