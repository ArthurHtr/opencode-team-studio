import "server-only";

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWrite, exists, readUtf8 } from "@/lib/filesystem";
import { getConfigRoot } from "@/lib/env";
import type { StudioMetadata } from "@/lib/types";

const EMPTY_METADATA: StudioMetadata = { version: 2 };

export function metadataPath(): string {
  return path.join(getConfigRoot(), "studio-data", "team-metadata.json");
}

export async function getStudioMetadata(): Promise<StudioMetadata> {
  const target = metadataPath();
  if (!await exists(target)) return structuredClone(EMPTY_METADATA);
  try {
    // Parse the file so malformed JSON is handled, but intentionally ignore
    // legacy cluster fields from metadata version 1.
    JSON.parse(await readUtf8(target));
    return structuredClone(EMPTY_METADATA);
  } catch {
    return structuredClone(EMPTY_METADATA);
  }
}

export async function saveStudioMetadata(metadata: StudioMetadata): Promise<void> {
  void metadata;
  await mkdir(path.dirname(metadataPath()), { recursive: true });
  await atomicWrite(metadataPath(), `${JSON.stringify(EMPTY_METADATA, null, 2)}\n`);
}
