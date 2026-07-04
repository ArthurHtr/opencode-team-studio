import "server-only";

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getConfigRoot } from "@/lib/env";
import { exists, readUtf8 } from "@/lib/filesystem";
import type { TeamId } from "@/lib/types";
import { getTeamById } from "@/lib/teams/registry";
import { validateTeamId } from "@/lib/teams/validation";

async function hashFile(filePath: string): Promise<string> {
  try {
    const content = await readUtf8(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch {
    return "";
  }
}

async function hashDirectorySorted(dirPath: string): Promise<string> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .sort((a, b) => a.name.localeCompare(b.name));

    const hasher = crypto.createHash("sha256");
    for (const entry of files) {
      const filePath = path.join(dirPath, entry.name);
      const content = await readUtf8(filePath);
      hasher.update(entry.name);
      hasher.update("\0");
      hasher.update(content);
    }
    return hasher.digest("hex");
  } catch {
    return "";
  }
}

async function hashFileOrEmpty(filePath: string): Promise<string> {
  if (await exists(filePath)) {
    return hashFile(filePath);
  }
  return crypto.createHash("sha256").update("").digest("hex");
}

export async function computeTeamContentHash(teamId: TeamId): Promise<string> {
  validateTeamId(teamId);
  const team = await getTeamById(teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const base = path.join(getConfigRoot(), "studio-data", "teams", teamId);

  const configHash = await hashFileOrEmpty(path.join(base, team.configFilename));
  const agentsHash = await hashDirectorySorted(path.join(base, "agents"));
  const layoutHash = await hashFileOrEmpty(path.join(base, "layout.json"));
  const metadataHash = await hashFileOrEmpty(path.join(base, "metadata.json"));

  const combined = crypto.createHash("sha256");
  combined.update(configHash);
  combined.update("\0");
  combined.update(agentsHash);
  combined.update("\0");
  combined.update(layoutHash);
  combined.update("\0");
  combined.update(metadataHash);

  return combined.digest("hex");
}

export async function countTeamAgents(teamId: TeamId): Promise<number> {
  validateTeamId(teamId);
  const agentsPath = path.join(getConfigRoot(), "studio-data", "teams", teamId, "agents");
  try {
    const entries = await readdir(agentsPath, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

export async function countRevisionAgents(revisionPath: string): Promise<number> {
  const agentsPath = path.join(revisionPath, "agents");
  try {
    const entries = await readdir(agentsPath, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

export async function computeConfigHash(filePath: string): Promise<string> {
  return hashFile(filePath);
}

export async function computeFileHash(filePath: string): Promise<string> {
  return hashFile(filePath);
}

export async function computeDirSize(dirPath: string): Promise<number> {
  let total = 0;
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await computeDirSize(full);
    } else {
      try { total += (await stat(full)).size; } catch { /* ignore unreadable */ }
    }
  }
  return total;
}
