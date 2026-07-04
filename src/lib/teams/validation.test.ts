import { describe, expect, it } from "vitest";
import { validateTeamId, validateTeamName, validateConfigFormat, sanitizePathSegment, validateRegistry, validateManifest, validateRevision } from "@/lib/teams/validation";

describe("validateTeamId", () => {
  it("accepts valid UUID v4", () => {
    expect(validateTeamId("550e8400-e29b-41d4-a716-446655440000")).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid UUID", () => {
    expect(() => validateTeamId("not-a-uuid")).toThrow("UUID v4");
  });

  it("rejects non-string", () => {
    expect(() => validateTeamId(123 as unknown as string)).toThrow("must be a string");
  });

  it("rejects null", () => {
    expect(() => validateTeamId(null as unknown as string)).toThrow("must be a string");
  });
});

describe("validateTeamName", () => {
  it("accepts valid name", () => {
    expect(validateTeamName("My Team")).toBe("My Team");
  });

  it("trims whitespace", () => {
    expect(validateTeamName("  Team  ")).toBe("Team");
  });

  it("rejects empty string", () => {
    expect(() => validateTeamName("")).toThrow("between 1 and 100");
  });

  it("rejects too long name", () => {
    expect(() => validateTeamName("a".repeat(101))).toThrow("between 1 and 100");
  });

  it("rejects control characters", () => {
    expect(() => validateTeamName("Team\u0000")).toThrow("control characters");
  });

  it("rejects non-string", () => {
    expect(() => validateTeamName(123 as unknown as string)).toThrow("must be a string");
  });
});

describe("validateConfigFormat", () => {
  it("accepts opencode.json", () => {
    expect(validateConfigFormat("opencode.json")).toBe("opencode.json");
  });

  it("accepts opencode.jsonc", () => {
    expect(validateConfigFormat("opencode.jsonc")).toBe("opencode.jsonc");
  });

  it("rejects invalid format", () => {
    expect(() => validateConfigFormat("invalid")).toThrow("must be");
  });
});

describe("sanitizePathSegment", () => {
  it("accepts valid segment", () => {
    expect(sanitizePathSegment("team-a")).toBe("team-a");
  });

  it("rejects null bytes", () => {
    expect(() => sanitizePathSegment("team\0")).toThrow("null bytes");
  });

  it("rejects ..", () => {
    expect(() => sanitizePathSegment("..")).toThrow("must not contain");
  });

  it("rejects path separators", () => {
    expect(() => sanitizePathSegment("team/a")).toThrow("must not contain path separators");
  });

  it("rejects empty segment", () => {
    expect(() => sanitizePathSegment("")).toThrow("must not be empty");
  });
});

describe("validateRegistry", () => {
  it("accepts valid registry", () => {
    const registry = {
      version: 1,
      activeTeamId: "550e8400-e29b-41d4-a716-446655440000",
      teams: [{
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        configFilename: "opencode.json",
      }],
    };
    expect(validateRegistry(registry)).toEqual(registry);
  });

  it("rejects wrong version", () => {
    expect(() => validateRegistry({ version: 2, activeTeamId: "", teams: [] })).toThrow("version must be 1");
  });

  it("rejects missing activeTeamId", () => {
    expect(() => validateRegistry({ version: 1, teams: [] } as unknown as Record<string, unknown>)).toThrow("activeTeamId");
  });

  it("rejects activeTeamId not in teams", () => {
    expect(() => validateRegistry({
      version: 1,
      activeTeamId: "nonexistent",
      teams: [{ id: "550e8400-e29b-41d4-a716-446655440000", name: "Test", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" }],
    })).toThrow("not found");
  });

  it("rejects duplicate team ids", () => {
    expect(() => validateRegistry({
      version: 1,
      activeTeamId: "550e8400-e29b-41d4-a716-446655440000",
      teams: [
        { id: "550e8400-e29b-41d4-a716-446655440000", name: "A", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" },
        { id: "550e8400-e29b-41d4-a716-446655440000", name: "B", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" },
      ],
    })).toThrow("Duplicate");
  });

  it("rejects invalid date", () => {
    expect(() => validateRegistry({
      version: 1,
      activeTeamId: "550e8400-e29b-41d4-a716-446655440000",
      teams: [{ id: "550e8400-e29b-41d4-a716-446655440000", name: "Test", createdAt: "not-a-date", updatedAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" }],
    })).toThrow("Invalid createdAt");
  });
});

describe("validateManifest", () => {
  it("accepts valid manifest", () => {
    const manifest = { version: 1, teamId: "550e8400-e29b-41d4-a716-446655440000", configFilename: "opencode.json", createdAt: "2026-01-01T00:00:00.000Z" };
    expect(validateManifest(manifest)).toEqual(manifest);
  });

  it("rejects wrong version", () => {
    expect(() => validateManifest({ version: 2, teamId: "", configFilename: "opencode.json", createdAt: "2026-01-01T00:00:00.000Z" })).toThrow("version must be 1");
  });
});

describe("validateRevision", () => {
  it("accepts valid revision", () => {
    const revision = { id: "rev-1", teamId: "550e8400-e29b-41d4-a716-446655440000", createdAt: "2026-01-01T00:00:00.000Z", configFilename: "opencode.json" };
    expect(validateRevision(revision)).toEqual(revision);
  });

  it("rejects invalid date", () => {
    expect(() => validateRevision({ id: "rev-1", teamId: "550e8400-e29b-41d4-a716-446655440000", createdAt: "bad", configFilename: "opencode.json" })).toThrow("Invalid createdAt");
  });
});
