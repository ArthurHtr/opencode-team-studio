import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfigBackup, restoreConfigBackup } from "@/lib/backup";

let root = "";
const previousRoot = process.env.OPENCODE_CONFIG_DIR;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "opencode-studio-test-"));
  process.env.OPENCODE_CONFIG_DIR = root;
  await mkdir(path.join(root, "studio"), { recursive: true });
  await mkdir(path.join(root, "studio-data"), { recursive: true });
  await mkdir(path.join(root, "secrets"), { recursive: true });
  await writeFile(path.join(root, "opencode.jsonc"), "{\n  // keep\n  \"model\": \"local/qwen\"\n}\n");
  await writeFile(path.join(root, "studio", "ignored.txt"), "studio");
  await writeFile(path.join(root, "studio-data", "ignored.txt"), "layout");
  await writeFile(path.join(root, "secrets", "token"), "secret");
});

afterEach(async () => {
  if (previousRoot === undefined) delete process.env.OPENCODE_CONFIG_DIR;
  else process.env.OPENCODE_CONFIG_DIR = previousRoot;
  await rm(root, { recursive: true, force: true });
});

describe("backups transactionnels", () => {
  it("copie la configuration sans studio, studio-data, secrets ni node_modules", async () => {
    const backup = await createConfigBackup("test");
    expect(await readFile(path.join(root, backup.path, "opencode.jsonc"), "utf8")).toContain("local/qwen");
    await expect(readFile(path.join(root, backup.path, "secrets", "token"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(root, backup.path, "studio", "ignored.txt"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(root, backup.path, "studio-data", "ignored.txt"), "utf8")).rejects.toThrow();
  });

  it("restaure la configuration sans supprimer le Studio", async () => {
    const backup = await createConfigBackup("restore");
    await writeFile(path.join(root, "opencode.jsonc"), "{}\n");
    await restoreConfigBackup(backup.id);
    expect(await readFile(path.join(root, "opencode.jsonc"), "utf8")).toContain("local/qwen");
    expect(await readFile(path.join(root, "studio", "ignored.txt"), "utf8")).toBe("studio");
  });

  it("n'inclut pas node_modules dans le backup", async () => {
    await mkdir(path.join(root, "node_modules"), { recursive: true });
    await writeFile(path.join(root, "node_modules", "pkg.json"), "{}");
    const backup = await createConfigBackup("no-node-modules");
    await expect(readFile(path.join(root, backup.path, "node_modules", "pkg.json"), "utf8")).rejects.toThrow();
  });

  it("n'inclut pas les dossiers studio.backup-*", async () => {
    await mkdir(path.join(root, "studio.backup-20260625"), { recursive: true });
    await writeFile(path.join(root, "studio.backup-20260625", "old.txt"), "old");
    const backup = await createConfigBackup("no-stale-backups");
    await expect(readFile(path.join(root, backup.path, "studio.backup-20260625", "old.txt"), "utf8")).rejects.toThrow();
  });

  it("limite le nombre de backups à 5", async () => {
    const backups = [];
    for (let i = 0; i < 8; i++) {
      backups.push(await createConfigBackup(`backup-${i}`));
    }
    const allBackups = await import("@/lib/backup").then((m) => m.listConfigBackups());
    expect(allBackups).toHaveLength(5);
  });

  it("garde les 5 backups les plus récents", async () => {
    const backups = [];
    for (let i = 0; i < 8; i++) {
      backups.push(await createConfigBackup(`backup-${i}`));
    }
    const allBackups = await import("@/lib/backup").then((m) => m.listConfigBackups());
    // Backups are sorted reverse chronologically, so the first 5 are the newest
    // allBackups[0] = backups[7], allBackups[1] = backups[6], etc.
    for (let i = 0; i < 5; i++) {
      expect(allBackups[i].id).toBe(backups[backups.length - 1 - i].id);
    }
  });
});
