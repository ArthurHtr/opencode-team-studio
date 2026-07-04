import "server-only";

import path from "node:path";

const TEAM_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEAM_NAME_MIN = 1;
const TEAM_NAME_MAX = 100;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function validateTeamId(id: unknown): string {
  if (typeof id !== "string") throw new Error("Team identifier must be a string");
  if (!TEAM_ID_REGEX.test(id)) throw new Error("Team identifier must be a valid UUID v4");
  return id;
}

export function validateTeamName(name: unknown): string {
  if (typeof name !== "string") throw new Error("Team name must be a string");
  const trimmed = name.trim();
  if (trimmed.length < TEAM_NAME_MIN || trimmed.length > TEAM_NAME_MAX) {
    throw new Error(`Team name must be between ${TEAM_NAME_MIN} and ${TEAM_NAME_MAX} characters`);
  }
  if (CONTROL_CHARS.test(trimmed)) {
    throw new Error("Team name must not contain control characters");
  }
  return trimmed;
}

export function validateConfigFormat(format: unknown): "opencode.json" | "opencode.jsonc" {
  if (format !== "opencode.json" && format !== "opencode.jsonc") {
    throw new Error("Config format must be 'opencode.json' or 'opencode.jsonc'");
  }
  return format;
}

export function sanitizePathSegment(segment: string): string {
  if (segment.includes("\0")) throw new Error("Path segment must not contain null bytes");
  if (segment.includes("..")) throw new Error("Path segment must not contain '..'");
  if (segment.includes("/") || segment.includes("\\")) throw new Error("Path segment must not contain path separators");
  if (segment !== segment.trim()) throw new Error("Path segment must not have leading or trailing whitespace");
  if (segment.length === 0) throw new Error("Path segment must not be empty");
  return segment;
}

export function resolveTeamPath(basePath: string, teamId: string): string {
  sanitizePathSegment(teamId);
  const resolved = path.resolve(basePath, teamId);
  const relative = path.relative(basePath, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Team path escapes the base directory");
  }
  return resolved;
}

export function validateRegistry(registry: unknown): import("@/lib/types").TeamsRegistry {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    throw new Error("Registry must be a JSON object");
  }
  const data = registry as Record<string, unknown>;
  if (data.version !== 1) throw new Error(`Registry version must be 1, got ${data.version}`);
  if (typeof data.activeTeamId !== "string") throw new Error("Registry must have an activeTeamId string");
  if (!Array.isArray(data.teams)) throw new Error("Registry must have a teams array");

  const ids = new Set<string>();
  for (const team of data.teams) {
    if (!team || typeof team !== "object") throw new Error("Each team must be an object");
    const t = team as Record<string, unknown>;
    if (typeof t.id !== "string") throw new Error("Team must have a string id");
    if (typeof t.name !== "string") throw new Error("Team must have a string name");
    if (typeof t.createdAt !== "string") throw new Error("Team must have a createdAt string");
    if (typeof t.updatedAt !== "string") throw new Error("Team must have an updatedAt string");
    if (t.configFilename !== "opencode.json" && t.configFilename !== "opencode.jsonc") {
      throw new Error("Team configFilename must be 'opencode.json' or 'opencode.jsonc'");
    }
    if (ids.has(t.id)) throw new Error(`Duplicate team id: ${t.id}`);
    ids.add(t.id);
    // Validate ISO date strings
    const created = new Date(t.createdAt);
    if (isNaN(created.getTime())) throw new Error(`Invalid createdAt date for team ${t.id}`);
    const updated = new Date(t.updatedAt);
    if (isNaN(updated.getTime())) throw new Error(`Invalid updatedAt date for team ${t.id}`);
  }

  if (!ids.has(data.activeTeamId)) {
    throw new Error(`activeTeamId '${data.activeTeamId}' not found in teams array`);
  }

  return data as unknown as import("@/lib/types").TeamsRegistry;
}

export function validateManifest(manifest: unknown): import("@/lib/types").TeamManifest {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Manifest must be a JSON object");
  }
  const data = manifest as Record<string, unknown>;
  if (data.version !== 1) throw new Error(`Manifest version must be 1, got ${data.version}`);
  if (typeof data.teamId !== "string") throw new Error("Manifest must have a teamId string");
  if (data.configFilename !== "opencode.json" && data.configFilename !== "opencode.jsonc") {
    throw new Error("Manifest configFilename must be 'opencode.json' or 'opencode.jsonc'");
  }
  if (typeof data.createdAt !== "string") throw new Error("Manifest must have a createdAt string");
  const created = new Date(data.createdAt);
  if (isNaN(created.getTime())) throw new Error("Invalid createdAt date in manifest");
  if (data.lastMaterializedAt !== undefined) {
    if (typeof data.lastMaterializedAt !== "string") throw new Error("lastMaterializedAt must be a string");
    const lm = new Date(data.lastMaterializedAt as string);
    if (isNaN(lm.getTime())) throw new Error("Invalid lastMaterializedAt date in manifest");
  }
  return data as unknown as import("@/lib/types").TeamManifest;
}

export function validateRevision(revision: unknown): import("@/lib/types").TeamRevision {
  if (!revision || typeof revision !== "object" || Array.isArray(revision)) {
    throw new Error("Revision must be a JSON object");
  }
  const data = revision as Record<string, unknown>;
  if (typeof data.id !== "string") throw new Error("Revision must have an id string");
  if (typeof data.teamId !== "string") throw new Error("Revision must have a teamId string");
  if (typeof data.createdAt !== "string") throw new Error("Revision must have a createdAt string");
  if (data.configFilename !== "opencode.json" && data.configFilename !== "opencode.jsonc") {
    throw new Error("Revision configFilename must be 'opencode.json' or 'opencode.jsonc'");
  }
  const created = new Date(data.createdAt);
  if (isNaN(created.getTime())) throw new Error("Invalid createdAt date in revision");
  if (data.kind !== undefined && data.kind !== "automatic" && data.kind !== "manual") {
    throw new Error("Revision kind must be 'automatic' or 'manual'");
  }
  if (data.reason !== undefined) {
    const validReasons = ["before-save", "before-switch", "before-restore", "before-destructive-operation", "manual"];
    if (!validReasons.includes(data.reason as string)) {
      throw new Error("Revision reason must be one of: before-save, before-switch, before-restore, before-destructive-operation, manual");
    }
  }
  if (data.label !== undefined && typeof data.label !== "string") {
    throw new Error("Revision label must be a string");
  }
  if (data.description !== undefined && typeof data.description !== "string") {
    throw new Error("Revision description must be a string");
  }
  return data as unknown as import("@/lib/types").TeamRevision;
}

export function validateRevisionKind(kind: unknown): "automatic" | "manual" {
  if (kind !== "automatic" && kind !== "manual") {
    throw new Error("Revision kind must be 'automatic' or 'manual'");
  }
  return kind;
}

export function validateRevisionReason(reason: unknown): import("@/lib/types").TeamRevisionReason {
  const validReasons = ["before-save", "before-switch", "before-restore", "before-destructive-operation", "manual"];
  if (!validReasons.includes(reason as string)) {
    throw new Error("Revision reason must be one of: before-save, before-switch, before-restore, before-destructive-operation, manual");
  }
  return reason as import("@/lib/types").TeamRevisionReason;
}

export function validateRevisionLabel(label: unknown): string {
  if (typeof label !== "string") throw new Error("Revision label must be a string");
  const trimmed = label.trim();
  if (trimmed.length === 0) throw new Error("Revision label must not be empty");
  if (trimmed.length > 200) throw new Error("Revision label must be at most 200 characters");
  if (trimmed.includes("\0")) throw new Error("Revision label must not contain null bytes");
  return trimmed;
}

export function validateTransactionId(id: unknown): string {
  if (typeof id !== "string") throw new Error("Transaction identifier must be a string");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Transaction identifier must be a valid UUID v4");
  }
  return id;
}
