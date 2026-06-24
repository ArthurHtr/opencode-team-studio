import "server-only";

import fs from "node:fs";
import path from "node:path";

/**
 * Returns the OpenCode configuration directory root.
 *
 * In production (Docker) OPENCODE_CONFIG_DIR must be set explicitly.
 * In local development a fallback to ~/.config/opencode is allowed.
 *
 * The function ensures the directory exists and is accessible before
 * returning its resolved path.
 */
export function getConfigRoot(): string {
  const envValue = process.env.OPENCODE_CONFIG_DIR;

  if (envValue) {
    const resolved = path.resolve(envValue);
    ensureConfigRoot(resolved);
    return resolved;
  }

  // Development fallback — never used in Docker images.
  const fallback = path.join(homedir(), ".config", "opencode");
  return fallback;
}

/**
 * Ensures the config root directory exists and is readable/writable.
 * Throws a descriptive error on permission failure.
 */
function ensureConfigRoot(dir: string): void {
  try {
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      throw new Error(
        `OPENCODE_CONFIG_DIR points to a file, not a directory: ${dir}`
      );
    }
    // Verify we can read and write
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        `OPENCODE_CONFIG_DIR does not exist: ${dir}\nCreate the directory and restart.`
      );
    }
    if (code === "EACCES" || code === "EPERM") {
      throw new Error(
        `Permission denied for OPENCODE_CONFIG_DIR: ${dir}\nCheck file ownership and permissions.`
      );
    }
    throw new Error(
      `Cannot access OPENCODE_CONFIG_DIR (${dir}): ${(err as Error).message}`
    );
  }
}

function homedir(): string {
  return process.env.HOME || process.env.USERPROFILE || "/tmp";
}
