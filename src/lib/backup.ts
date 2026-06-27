import "server-only";

import { appendFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfigRoot } from "@/lib/env";
import type { BackupSummary } from "@/lib/types";

const BACKUP_DIRNAME = "backups-config";

/** Items excluded from backups. Kept small and explicit. */
const EXCLUDED = new Set([
  "studio",
  "studio-data",
  BACKUP_DIRNAME,
  "node_modules",
  ".git",
  "secrets",
]);

/** Maximum number of backups to keep. Older ones are pruned automatically. */
const MAX_BACKUPS = 5;

let queue: Promise<unknown> = Promise.resolve();

export function withConfigTransaction<T>(reason: string, operation: (backup: BackupSummary) => Promise<T>): Promise<T> {
  const run = async () => {
    const backup = await createConfigBackup(reason);
    try {
      return await operation(backup);
    } catch (error) {
      await restoreConfigBackup(backup.id);
      throw error;
    }
  };
  const scheduled = queue.then(run, run);
  queue = scheduled.then(() => undefined, () => undefined);
  return scheduled;
}

export async function createConfigBackup(reason: string): Promise<BackupSummary> {
  const root = getConfigRoot();
  const createdAt = new Date();
  const id = timestampId(createdAt);
  const target = path.join(root, BACKUP_DIRNAME, id);
  await mkdir(target, { recursive: true });

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED.has(entry.name)) continue;
    if (/^studio\.backup-/.test(entry.name)) continue;
    await cp(path.join(root, entry.name), path.join(target, entry.name), {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
  }

  const summary: BackupSummary = {
    id,
    path: path.relative(root, target),
    createdAt: createdAt.toISOString(),
    reason,
  };
  await writeFile(path.join(target, "BACKUP_INFO.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await ensureLocalDataIgnored(root);
  await pruneOldBackups(root);
  return summary;
}

export async function listConfigBackups(): Promise<BackupSummary[]> {
  const root = getConfigRoot();
  const backupRoot = path.join(root, BACKUP_DIRNAME);
  let entries: string[];
  try {
    entries = (await readdir(backupRoot)).sort().reverse();
  } catch {
    return [];
  }
  const result: BackupSummary[] = [];
  for (const id of entries) {
    try {
      const content = await readFile(path.join(backupRoot, id, "BACKUP_INFO.json"), "utf8");
      const parsed = JSON.parse(content) as BackupSummary;
      if (parsed.id && parsed.createdAt) result.push(parsed);
    } catch {
      // Ignore incomplete backup directories.
    }
  }
  return result;
}

export async function restoreConfigBackup(id: string): Promise<void> {
  validateBackupId(id);
  const root = getConfigRoot();
  const source = path.join(root, BACKUP_DIRNAME, id);
  await stat(source);

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED.has(entry.name)) continue;
    await rm(path.join(root, entry.name), { recursive: true, force: true });
  }

  const backupEntries = await readdir(source, { withFileTypes: true });
  for (const entry of backupEntries) {
    if (entry.name === "BACKUP_INFO.json") continue;
    await cp(path.join(source, entry.name), path.join(root, entry.name), {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
  }
}

export async function deleteConfigBackup(id: string): Promise<void> {
  validateBackupId(id);
  await rm(path.join(getConfigRoot(), BACKUP_DIRNAME, id), { recursive: true, force: true });
}

export async function getLatestBackup(): Promise<BackupSummary | undefined> {
  return (await listConfigBackups())[0];
}

/** Removes backups beyond the maximum, keeping only the most recent ones. */
async function pruneOldBackups(root: string): Promise<void> {
  const backupRoot = path.join(root, BACKUP_DIRNAME);
  let entries: string[];
  try {
    entries = (await readdir(backupRoot)).sort().reverse();
  } catch {
    return;
  }
  const toDelete = entries.slice(MAX_BACKUPS);
  for (const id of toDelete) {
    try {
      await rm(path.join(backupRoot, id), { recursive: true, force: true });
    } catch {
      // Ignore errors during pruning (e.g., backup still being written).
    }
  }
}

async function ensureLocalDataIgnored(root: string): Promise<void> {
  const gitignore = path.join(root, ".gitignore");
  let content = "";
  try { content = await readFile(gitignore, "utf8"); } catch { /* created below */ }
  const missing = ["backups/", "studio-data/"].filter((rule) => !content.split(/\r?\n/).includes(rule));
  if (!missing.length) return;
  const prefix = content && !content.endsWith("\n") ? "\n" : "";
  await appendFile(gitignore, `${prefix}\n# OpenCode Team Studio local data\n${missing.join("\n")}\n`, "utf8");
}

function validateBackupId(id: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T[\d-]+Z$/.test(id)) throw new Error("Invalid backup identifier");
}

function timestampId(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}
