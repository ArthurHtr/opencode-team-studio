export const PALETTE_DRAG_MIME = "application/x-opencode-team-palette";

export type PaletteNodeKind = "agent" | "skill" | "mcp";

export type PaletteDragPayload = {
  kind: PaletteNodeKind;
  id: string;
};

export function serializePaletteDragPayload(payload: PaletteDragPayload): string {
  return JSON.stringify(payload);
}

export function parsePaletteDragPayload(raw: string): PaletteDragPayload | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<PaletteDragPayload>;
    if (
      (parsed.kind === "agent" || parsed.kind === "skill" || parsed.kind === "mcp")
      && typeof parsed.id === "string"
      && parsed.id.trim().length > 0
    ) {
      return { kind: parsed.kind, id: parsed.id };
    }
  } catch {
    return undefined;
  }
  return undefined;
}
