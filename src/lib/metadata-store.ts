import "server-only";

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWrite, exists, readUtf8 } from "@/lib/filesystem";
import { getConfigRoot } from "@/lib/env";
import type { StudioMetadata } from "@/lib/types";
import { getActiveTeam } from "@/lib/teams/registry";

const EMPTY_METADATA: StudioMetadata = { version: 2 };
const LEGACY_METADATA_PATH = () => path.join(getConfigRoot(), "studio-data", "team-metadata.json");

function teamMetadataPath(teamId: string): string {
  return path.join(getConfigRoot(), "studio-data", "teams", teamId, "metadata.json");
}

function legacyMetadataPath(): string {
  return LEGACY_METADATA_PATH();
}

export async function getStudioMetadata(): Promise<StudioMetadata> {
  const activeTeam = await getActiveTeam();
  if (activeTeam) {
    const target = teamMetadataPath(activeTeam.id);
    if (await exists(target)) {
      try {
        JSON.parse(await readUtf8(target));
        return structuredClone(EMPTY_METADATA);
      } catch {
        // Fall through to legacy
      }
    }
  }
  // Fallback to legacy path
  const target = legacyMetadataPath();
  if (await exists(target)) {
    try {
      JSON.parse(await readUtf8(target));
      return structuredClone(EMPTY_METADATA);
    } catch {
      // Fall through
    }
  }
  return structuredClone(EMPTY_METADATA);
}

export async function saveStudioMetadata(metadata: StudioMetadata): Promise<void> {
  void metadata;
  const activeTeam = await getActiveTeam();
  if (activeTeam) {
    const target = teamMetadataPath(activeTeam.id);
    await mkdir(path.dirname(target), { recursive: true });
    await atomicWrite(target, `${JSON.stringify(EMPTY_METADATA, null, 2)}\n`);
  } else {
    // Fallback to legacy path
    await mkdir(path.dirname(legacyMetadataPath()), { recursive: true });
    await atomicWrite(legacyMetadataPath(), `${JSON.stringify(EMPTY_METADATA, null, 2)}\n`);
  }
}
