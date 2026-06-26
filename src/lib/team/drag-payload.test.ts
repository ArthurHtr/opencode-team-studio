import { describe, expect, it } from "vitest";
import {
  parsePaletteDragPayload,
  serializePaletteDragPayload,
} from "@/lib/team/drag-payload";

describe("palette drag payload", () => {
  it("sérialise et relit un skill", () => {
    const raw = serializePaletteDragPayload({ kind: "skill", id: "docker" });
    expect(parsePaletteDragPayload(raw)).toEqual({ kind: "skill", id: "docker" });
  });

  it("refuse les types inconnus et les identifiants vides", () => {
    expect(parsePaletteDragPayload('{"kind":"tool","id":"bash"}')).toBeUndefined();
    expect(parsePaletteDragPayload('{"kind":"mcp","id":""}')).toBeUndefined();
    expect(parsePaletteDragPayload("not-json")).toBeUndefined();
  });
});
