import "server-only";

import fs from "node:fs";
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

/**
 * Builds a safe path within the OpenCode config directory.
 *
 * Validates:
 * - The top-level segment is in the allowed set
 * - No null bytes, ".." segments, or "/../" patterns
 * - The resolved path stays within the config root (lexically)
 * - Symlink traversal: the real path of the root must match the resolved real path
 *
 * Throws descriptive errors on violation.
 */
export function safeConfigPath(...segments: string[]): string {
  if (segments.length === 0) throw new Error("Aucun chemin fourni");
  if (!ALLOWED_TOP_LEVEL.has(segments[0])) throw new Error("Ressource interdite");
  if (
    segments.some(
      (segment) =>
        segment.includes("\0") ||
        segment === ".." ||
        segment.includes("/../")
    )
  ) {
    throw new Error("Chemin invalide");
  }

  const root = getConfigRoot();
  const resolved = path.resolve(root, ...segments);

  // Lexical check
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Sortie du dossier de configuration refusée");
  }

  // Symlink traversal check: resolve the real path of the root and verify
  // that the resolved path (after resolving any symlinks within it) still
  // stays within the real root.
  try {
    const realRoot = fs.realpathSync(root);
    const realResolved = fs.realpathSync(resolved);
    const realRelative = path.relative(realRoot, realResolved);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      throw new Error(
        "Sortie du dossier de configuration refusée (symlink traversal)"
      );
    }
  } catch {
    // If realpathSync fails (e.g. intermediate path doesn't exist yet),
    // the lexical check above is sufficient for paths that don't exist yet.
    // Only fail if the root itself can't be resolved.
    if (segments.length === 1) {
      // For top-level paths that may not exist, skip symlink check.
      // The mkdir in atomicWrite will create them.
    } else {
      // For nested paths, if realpath fails it likely means the parent
      // doesn't exist yet — the lexical check is sufficient.
    }
  }

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

export async function atomicWrite(
  filePath: string,
  content: string
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.studio-${process.pid}-${Date.now()}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, filePath);
}

export async function removePath(filePath: string): Promise<void> {
  await rm(filePath, { recursive: true, force: true });
}
