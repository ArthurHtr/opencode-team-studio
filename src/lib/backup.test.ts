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
  it("copie toute la configuration sauf Studio, backups et données de layout", async () => {
    const backup = await createConfigBackup("test");
    expect(await readFile(path.join(root, backup.path, "opencode.jsonc"), "utf8")).toContain("local/qwen");
    expect(await readFile(path.join(root, backup.path, "secrets", "token"), "utf8")).toBe("secret");
    await expect(readFile(path.join(root, backup.path, "studio", "ignored.txt"), "utf8")).rejects.toThrow();
    expect(await readFile(path.join(root, backup.path, "studio-data", "ignored.txt"), "utf8")).toBe("layout");
  });

  it("restaure la configuration sans supprimer le Studio", async () => {
    const backup = await createConfigBackup("restore");
    await writeFile(path.join(root, "opencode.jsonc"), "{}\n");
    await restoreConfigBackup(backup.id);
    expect(await readFile(path.join(root, "opencode.jsonc"), "utf8")).toContain("local/qwen");
    expect(await readFile(path.join(root, "studio", "ignored.txt"), "utf8")).toBe("studio");
  });
});
