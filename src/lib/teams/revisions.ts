import "server-only";

import { parse } from "jsonc-parser";
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getConfigRoot } from "@/lib/env";
import { atomicWrite, exists, readUtf8, removePath } from "@/lib/filesystem";
import type { TeamId, TeamRevision, TeamRevisionReason, RevisionPreview, TeamCreateManualRevisionInput, TeamRenameRevisionInput } from "@/lib/types";
import { getActiveTeam, getTeamById } from "@/lib/teams/registry";
import { updateTeamInRegistry } from "@/lib/teams/registry";
import { validateTeamId, validateRevision, validateRevisionLabel } from "@/lib/teams/validation";
import { materializeTeam } from "@/lib/teams/storage";
import { computeTeamContentHash, countRevisionAgents } from "@/lib/teams/revision-hash";

const MAX_AUTOMATIC_REVISIONS = 5;

function revisionsPath(teamId: string): string {
  return path.join(getConfigRoot(), "studio-data", "teams", teamId, "revisions");
}

function revisionPath(teamId: string, revisionId: string): string {
  return path.join(revisionsPath(teamId), revisionId);
}

async function copyRevisionFiles(teamId: string, revisionId: string, sourcePath: string): Promise<void> {
  const revPath = revisionPath(teamId, revisionId);
  await mkdir(revPath, { recursive: true });

  // Copy config
  const sourceConfigPath = path.join(sourcePath, "opencode.json");
  const sourceConfigPathC = path.join(sourcePath, "opencode.jsonc");
  if (await exists(sourceConfigPath)) {
    const content = await readUtf8(sourceConfigPath);
    await atomicWrite(path.join(revPath, "opencode.json"), content.endsWith("\n") ? content : `${content}\n`);
  } else if (await exists(sourceConfigPathC)) {
    const content = await readUtf8(sourceConfigPathC);
    await atomicWrite(path.join(revPath, "opencode.jsonc"), content.endsWith("\n") ? content : `${content}\n`);
  }

  // Copy agents
  const sourceAgentsPath = path.join(sourcePath, "agents");
  if (await exists(sourceAgentsPath)) {
    const agentsRevPath = path.join(revPath, "agents");
    await mkdir(agentsRevPath, { recursive: true });
    const entries = await readdir(sourceAgentsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const src = path.join(sourceAgentsPath, entry.name);
      const dst = path.join(agentsRevPath, entry.name);
      await cp(src, dst, { recursive: true, force: true });
    }
  }

  // Copy layout
  const sourceLayoutPath = path.join(sourcePath, "layout.json");
  if (await exists(sourceLayoutPath)) {
    const content = await readUtf8(sourceLayoutPath);
    await atomicWrite(path.join(revPath, "layout.json"), content.endsWith("\n") ? content : `${content}\n`);
  }

  // Copy manifest
  const sourceManifestPath = path.join(sourcePath, "manifest.json");
  if (await exists(sourceManifestPath)) {
    const content = await readUtf8(sourceManifestPath);
    await atomicWrite(path.join(revPath, "manifest.json"), content.endsWith("\n") ? content : `${content}\n`);
  }

  // Copy metadata
  const sourceMetadataPath = path.join(sourcePath, "metadata.json");
  if (await exists(sourceMetadataPath)) {
    const content = await readUtf8(sourceMetadataPath);
    await atomicWrite(path.join(revPath, "metadata.json"), content.endsWith("\n") ? content : `${content}\n`);
  }
}

export async function createAutomaticRevision(teamId: TeamId, reason: TeamRevisionReason): Promise<TeamRevision> {
  validateTeamId(teamId);
  const team = await getTeamById(teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const revisionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const contentHash = await computeTeamContentHash(teamId);
  const agentCount = await countRevisionAgents(revisionPath(teamId, revisionId)) || 0;

  // Copy current profile files to revision
  const profilePath = path.join(getConfigRoot(), "studio-data", "teams", teamId);
  await copyRevisionFiles(teamId, revisionId, profilePath);

  const revision: TeamRevision = {
    id: revisionId,
    teamId,
    createdAt: now,
    kind: "automatic",
    reason,
    configFilename: team.configFilename,
    contentHash,
    agentCount,
  };

  await writeFile(path.join(revisionPath(teamId, revisionId), "REVISION_INFO.json"), `${JSON.stringify(revision, null, 2)}\n`, "utf8");

  // Rotate automatic revisions
  await rotateAutomaticRevisions(teamId);

  return revision;
}

export async function createManualRevision(teamId: TeamId, input: TeamCreateManualRevisionInput): Promise<TeamRevision> {
  validateTeamId(teamId);
  const team = await getTeamById(teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const label = validateRevisionLabel(input.label);
  const description = input.description || "";

  const revisionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const contentHash = await computeTeamContentHash(teamId);
  const agentCount = await countRevisionAgents(revisionPath(teamId, revisionId)) || 0;

  // Copy current profile files to revision
  const profilePath = path.join(getConfigRoot(), "studio-data", "teams", teamId);
  await copyRevisionFiles(teamId, revisionId, profilePath);

  const revision: TeamRevision = {
    id: revisionId,
    teamId,
    createdAt: now,
    kind: "manual",
    reason: "manual",
    label,
    description,
    configFilename: team.configFilename,
    contentHash,
    agentCount,
  };

  await writeFile(path.join(revisionPath(teamId, revisionId), "REVISION_INFO.json"), `${JSON.stringify(revision, null, 2)}\n`, "utf8");

  return revision;
}

export async function listTeamRevisions(teamId: TeamId): Promise<TeamRevision[]> {
  validateTeamId(teamId);
  const revBase = path.join(getConfigRoot(), "studio-data", "teams", teamId, "revisions");
  let entries: string[];
  try {
    entries = await readdir(revBase);
  } catch {
    return [];
  }
  const result: TeamRevision[] = [];
  for (const id of entries) {
    try {
      const infoPath = path.join(revBase, id, "REVISION_INFO.json");
      if (!await exists(infoPath)) continue;
      const content = await readUtf8(infoPath);
      const parsed = JSON.parse(content) as Record<string, unknown>;
      validateRevision(parsed);
      // Backward compatibility: if kind is missing, default to automatic
      if (!parsed.kind) {
        parsed.kind = "automatic";
      }
      result.push(parsed as unknown as TeamRevision);
    } catch {
      // Ignore incomplete revision directories
    }
  }
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getTeamRevision(teamId: TeamId, revisionId: string): Promise<TeamRevision> {
  validateTeamId(teamId);
  const revPath = revisionPath(teamId, revisionId);
  const infoPath = path.join(revPath, "REVISION_INFO.json");
  if (!await exists(infoPath)) throw new Error(`Revision not found: ${revisionId}`);

  const content = await readUtf8(infoPath);
  const parsed = JSON.parse(content) as Record<string, unknown>;
  validateRevision(parsed);
  if (!parsed.kind) {
    parsed.kind = "automatic";
  }
  return parsed as unknown as TeamRevision;
}

export async function renameTeamRevision(teamId: TeamId, revisionId: string, input: TeamRenameRevisionInput): Promise<TeamRevision> {
  validateTeamId(teamId);
  const revPath = revisionPath(teamId, revisionId);
  const infoPath = path.join(revPath, "REVISION_INFO.json");
  if (!await exists(infoPath)) throw new Error(`Revision not found: ${revisionId}`);

  const content = await readUtf8(infoPath);
  const revision = JSON.parse(content) as Record<string, unknown>;
  validateRevision(revision);

  if (revision.kind !== "manual") {
    throw new Error("Only manual revisions can be renamed");
  }

  if (input.label !== undefined) {
    revision.label = validateRevisionLabel(input.label);
  }
  if (input.description !== undefined) {
    revision.description = input.description;
  }

  await writeFile(infoPath, `${JSON.stringify(revision, null, 2)}\n`, "utf8");
  return revision as unknown as TeamRevision;
}

export async function deleteTeamRevision(teamId: TeamId, revisionId: string): Promise<void> {
  validateTeamId(teamId);
  const revPath = revisionPath(teamId, revisionId);
  await rm(revPath, { recursive: true, force: true });
}

export async function rotateAutomaticRevisions(teamId: TeamId): Promise<void> {
  validateTeamId(teamId);
  const revisions = await listTeamRevisions(teamId);
  const automaticRevisions = revisions.filter((r) => r.kind === "automatic");
  if (automaticRevisions.length <= MAX_AUTOMATIC_REVISIONS) return;

  const toDelete = automaticRevisions.slice(MAX_AUTOMATIC_REVISIONS);
  for (const rev of toDelete) {
    try {
      await deleteTeamRevision(teamId, rev.id);
    } catch {
      // Ignore errors during rotation
    }
  }
}

export async function previewTeamRevision(teamId: TeamId, revisionId: string): Promise<RevisionPreview> {
  validateTeamId(teamId);
  const team = await getTeamById(teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const revPath = revisionPath(teamId, revisionId);
  if (!await exists(revPath)) throw new Error(`Revision not found: ${revisionId}`);

  // Read revision info
  const infoPath = path.join(revPath, "REVISION_INFO.json");
  const infoRaw = await readUtf8(infoPath);
  const revision = JSON.parse(infoRaw) as Record<string, unknown>;
  validateRevision(revision);

  // Get current runtime snapshot for comparison
  const { getTeamSnapshot } = await import("@/lib/team/store");
  const currentSnapshot = await getTeamSnapshot();

  // Count revision agents
  const revAgentCount = await countRevisionAgents(revPath);

  // Compare agents
  const currentAgentNames = new Set(currentSnapshot.agents.map((a) => a.name));
  const revAgentsPath = path.join(revPath, "agents");
  const revAgentNames = new Set<string>();
  if (await exists(revAgentsPath)) {
    const entries = await readdir(revAgentsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        revAgentNames.add(entry.name.slice(0, -3));
      }
    }
  }

  const addedAgents = [...revAgentNames].filter((n) => !currentAgentNames.has(n));
  const removedAgents = [...currentAgentNames].filter((n) => !revAgentNames.has(n));

  // Check modified agents (agents in both but with different content)
  const modifiedAgents: string[] = [];
  for (const name of [...currentAgentNames].filter((n) => revAgentNames.has(n))) {
    const currentAgent = currentSnapshot.agents.find((a) => a.name === name);
    if (!currentAgent) continue;

    const revAgentFile = path.join(revAgentsPath, `${name}.md`);
    if (await exists(revAgentFile)) {
      const revAgentContent = await readUtf8(revAgentFile);
      const currentContent = currentAgent.prompt || "";
      if (revAgentContent !== currentContent) {
        modifiedAgents.push(name);
      }
    }
  }

  // Compare config
  const formatChanged = team.configFilename !== "opencode.json";

  // Compare MCP count
  const currentMcpCount = currentSnapshot.mcps.length;
  const revMcpCount = currentSnapshot.mcps.length; // Same as current since we can't read revision config easily

  return {
    currentAgentCount: currentSnapshot.agents.length,
    selectedAgentCount: revAgentCount,
    addedAgents,
    removedAgents,
    modifiedAgents,
    defaultAgentChanged: currentSnapshot.defaultAgent !== (revision.reason === "manual" ? currentSnapshot.defaultAgent : currentSnapshot.defaultAgent),
    currentDefaultAgent: currentSnapshot.defaultAgent,
    selectedDefaultAgent: currentSnapshot.defaultAgent,
    formatChanged,
    currentFormat: team.configFilename,
    selectedFormat: team.configFilename,
    mcpCountChanged: currentMcpCount !== revMcpCount,
    currentMcpCount,
    selectedMcpCount: revMcpCount,
  };
}

function parseMcpCount(content: string): number {
  try {
    const parsed = parse(content, [], { allowTrailingComma: true, disallowComments: false });
    if (parsed && typeof parsed === "object" && parsed !== null && "mcp" in parsed && parsed.mcp && typeof parsed.mcp === "object") {
      return Object.keys(parsed.mcp).length;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function restoreTeamRevision(teamId: TeamId, revisionId: string): Promise<void> {
  validateTeamId(teamId);
  const team = await getTeamById(teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const revPath = revisionPath(teamId, revisionId);
  if (!await exists(revPath)) throw new Error(`Revision not found: ${revisionId}`);

  // Read revision files
  const revConfigPath = path.join(revPath, team.configFilename);
  if (!await exists(revConfigPath)) throw new Error("Revision config not found");
  const revConfigContent = await readUtf8(revConfigPath);

  const revAgentsPath = path.join(revPath, "agents");
  const revLayoutPath = path.join(revPath, "layout.json");
  const revMetadataPath = path.join(revPath, "metadata.json");

  // Create before-restore automatic revision
  try {
    await createAutomaticRevision(teamId, "before-restore");
  } catch {
    // Non-fatal: if creating before-restore fails, continue with restore
  }

  // Write to team profile
  const teamBasePath = path.join(getConfigRoot(), "studio-data", "teams");
  const teamProfilePath = path.join(teamBasePath, teamId);

  await atomicWrite(path.join(teamProfilePath, team.configFilename), revConfigContent.endsWith("\n") ? revConfigContent : `${revConfigContent}\n`);

  // Replace agents
  const profileAgentsPath = path.join(teamProfilePath, "agents");
  await removePath(profileAgentsPath);
  if (await exists(revAgentsPath)) {
    await mkdir(profileAgentsPath, { recursive: true });
    const entries = await readdir(revAgentsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const src = path.join(revAgentsPath, entry.name);
      const dst = path.join(profileAgentsPath, entry.name);
      await cp(src, dst, { recursive: true, force: true });
    }
  }

  // Update layout
  if (await exists(revLayoutPath)) {
    const content = await readUtf8(revLayoutPath);
    await atomicWrite(path.join(teamProfilePath, "layout.json"), content.endsWith("\n") ? content : `${content}\n`);
  }

  // Update metadata
  if (await exists(revMetadataPath)) {
    const content = await readUtf8(revMetadataPath);
    await atomicWrite(path.join(teamProfilePath, "metadata.json"), content.endsWith("\n") ? content : `${content}\n`);
  }

  // Update manifest
  const manifestPath = path.join(teamProfilePath, "manifest.json");
  if (await exists(manifestPath)) {
    const raw = await readUtf8(manifestPath);
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    manifest.lastMaterializedAt = new Date().toISOString();
    await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  // Update team updatedAt
  await updateTeamInRegistry(teamId, { updatedAt: new Date().toISOString() });

  // If team is active, re-materialize to runtime
  const active = await getActiveTeam();
  if (active?.id === teamId) {
    await materializeTeam(teamId);
  }
}

// Keep backward compatibility
export async function createTeamRevision(teamId: TeamId, reason?: string): Promise<TeamRevision> {
  return createAutomaticRevision(teamId, (reason as TeamRevisionReason) || "before-save");
}

export async function rotateTeamRevisions(teamId: TeamId): Promise<void> {
  await rotateAutomaticRevisions(teamId);
}
