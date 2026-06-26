import "server-only";

import path from "node:path";

export function getConfigRoot(): string {
  return path.resolve(process.env.OPENCODE_CONFIG_DIR || path.join(process.cwd(), ".."));
}
