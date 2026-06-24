import "server-only";

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWrite, exists, readUtf8 } from "@/lib/filesystem";
import { getConfigRoot } from "@/lib/env";
import type { StudioLayout } from "@/lib/types";

const EMPTY_LAYOUT: StudioLayout = { version: 2, views: {} };

export function layoutPath(): string {
  return path.join(getConfigRoot(), "studio-data", "team-layout.json");
}

export async function getStudioLayout(): Promise<StudioLayout> {
  const target = layoutPath();
  if (!await exists(target)) return structuredClone(EMPTY_LAYOUT);
  try {
    const parsed = JSON.parse(await readUtf8(target)) as { version?: number; views?: StudioLayout["views"] };
    if (!parsed.views || typeof parsed.views !== "object") return structuredClone(EMPTY_LAYOUT);
    return { version: 2, views: parsed.views };
  } catch {
    return structuredClone(EMPTY_LAYOUT);
  }
}

export async function saveStudioLayout(layout: StudioLayout): Promise<void> {
  await mkdir(path.dirname(layoutPath()), { recursive: true });
  await atomicWrite(layoutPath(), `${JSON.stringify({ version: 2, views: layout.views ?? {} }, null, 2)}\n`);
}
