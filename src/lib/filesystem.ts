import "server-only";

import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfigRoot } from "@/lib/env";

const ALLOWED_TOP_LEVEL = new Set([
  "agents",
  "commands",
  "skills",
  "plugins",
  "opencode.json",
  "opencode.jsonc",
  "tui.json",
  "tui.jsonc",
  "AGENTS.md",
  ".git",
  ".gitignore",
]);

export function safeConfigPath(...segments: string[]): string {
  if (segments.length === 0) throw new Error("No path provided");
  if (!ALLOWED_TOP_LEVEL.has(segments[0])) throw new Error("Forbidden resource");
  if (segments.some((segment) => segment.includes("\0") || segment === ".." || segment.includes("/../"))) {
    throw new Error("Invalid path");
  }

  const root = getConfigRoot();
  const resolved = path.resolve(root, ...segments);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Escape from configuration directory denied");
  return resolved;
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readUtf8(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.studio-${process.pid}-${Date.now()}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, filePath);
}

export async function removePath(filePath: string): Promise<void> {
  await rm(filePath, { recursive: true, force: true });
}
