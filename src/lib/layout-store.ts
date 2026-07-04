import "server-only";

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWrite, exists, readUtf8 } from "@/lib/filesystem";
import { getConfigRoot } from "@/lib/env";
import type { StudioLayout } from "@/lib/types";
import { getActiveTeam } from "@/lib/teams/registry";

const EMPTY_LAYOUT: StudioLayout = { version: 2, views: {} };
const LEGACY_LAYOUT_PATH = () => path.join(getConfigRoot(), "studio-data", "team-layout.json");

function teamLayoutPath(teamId: string): string {
  return path.join(getConfigRoot(), "studio-data", "teams", teamId, "layout.json");
}

function legacyLayoutPath(): string {
  return LEGACY_LAYOUT_PATH();
}

export async function getStudioLayout(): Promise<StudioLayout> {
  const activeTeam = await getActiveTeam();
  if (activeTeam) {
    const target = teamLayoutPath(activeTeam.id);
    if (await exists(target)) {
      try {
        const parsed = JSON.parse(await readUtf8(target)) as { version?: number; views?: StudioLayout["views"] };
        if (parsed.views && typeof parsed.views === "object") {
          return { version: 2, views: parsed.views };
        }
      } catch {
        // Fall through to legacy
      }
    }
  }
  // Fallback to legacy path
  const target = legacyLayoutPath();
  if (await exists(target)) {
    try {
      const parsed = JSON.parse(await readUtf8(target)) as { version?: number; views?: StudioLayout["views"] };
      if (parsed.views && typeof parsed.views === "object") {
        return { version: 2, views: parsed.views };
      }
    } catch {
      // Fall through
    }
  }
  return structuredClone(EMPTY_LAYOUT);
}

export async function saveStudioLayout(layout: StudioLayout): Promise<void> {
  const activeTeam = await getActiveTeam();
  if (activeTeam) {
    const target = teamLayoutPath(activeTeam.id);
    await mkdir(path.dirname(target), { recursive: true });
    await atomicWrite(target, `${JSON.stringify({ version: 2, views: layout.views ?? {} }, null, 2)}\n`);
  } else {
    // Fallback to legacy path
    await mkdir(path.dirname(legacyLayoutPath()), { recursive: true });
    await atomicWrite(legacyLayoutPath(), `${JSON.stringify({ version: 2, views: layout.views ?? {} }, null, 2)}\n`);
  }
}
