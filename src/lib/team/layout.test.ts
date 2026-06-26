import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { autoLayoutTeamGraph, resolveDraggedCollision } from "@/lib/team/layout";
import type { TeamNodeData, TeamRelation } from "@/lib/types";

function node(id: string, kind: TeamNodeData["kind"], label = id): Node<TeamNodeData> {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, name: label, label } };
}

function edge(source: string, target: string, kind: TeamRelation["kind"]): Edge<TeamRelation> {
  return {
    id: `${kind}:${source}:${target}`,
    source,
    target,
    data: { source: source.replace(/^agent:/, ""), target: target.replace(/^[^:]+:/, ""), kind, action: "allow" },
  };
}

describe("layout sémantique", () => {
  it("place les délégations de gauche à droite", async () => {
    const nodes = [node("agent:build", "agent", "build"), node("agent:reviewer", "agent", "reviewer")];
    nodes[0].data.primary = true;
    const result = await autoLayoutTeamGraph(nodes, [edge("agent:build", "agent:reviewer", "task")], { view: "organization" });
    const build = result.find((item) => item.id === "agent:build");
    const reviewer = result.find((item) => item.id === "agent:reviewer");
    expect((reviewer?.position.x || 0)).toBeGreaterThan(build?.position.x || 0);
  });

  it("place skills au-dessus et MCP sous l’agent sélectionné", async () => {
    const nodes = [
      node("agent:build", "agent", "build"),
      node("skill:docker", "skill", "docker"),
      node("mcp:browser", "mcp", "browser"),
      node("model:local/qwen", "model", "local/qwen"),
    ];
    const result = await autoLayoutTeamGraph(nodes, [], { view: "agent", selectedAgent: "build" });
    const agent = result.find((item) => item.id === "agent:build")!;
    expect(result.find((item) => item.id === "skill:docker")!.position.y).toBeLessThan(agent.position.y);
    expect(result.find((item) => item.id === "mcp:browser")!.position.y).toBeGreaterThan(agent.position.y);
    expect(result.find((item) => item.id === "model:local/qwen")!.position.x).toBeGreaterThan(agent.position.x);
  });

  it("fonctionne avec un graphe vide", async () => {
    await expect(autoLayoutTeamGraph([], [], { view: "complete" })).resolves.toEqual([]);
  });

  it("évite une collision directe après déplacement", () => {
    const first = node("agent:a", "agent", "a");
    const second = { ...node("agent:b", "agent", "b"), position: { x: 0, y: 0 } };
    const result = resolveDraggedCollision([first, second], second.id);
    expect(result.find((item) => item.id === second.id)?.position).not.toEqual({ x: 0, y: 0 });
  });
});
