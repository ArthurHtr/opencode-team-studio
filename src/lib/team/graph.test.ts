import { describe, expect, it } from "vitest";
import { addConnectionRelation, applyRelationChoice, createTeamGraph, reconnectRelation, removeRelation } from "@/lib/team/graph";
import type { AgentDefinition, TeamSnapshot } from "@/lib/types";

function agent(name: string, mode: AgentDefinition["mode"]): AgentDefinition {
  return { name, mode, source: name === "build" ? "builtin" : "file", builtin: name === "build", description: name, prompt: "", options: {}, permission: {}, extra: {} };
}
function fixture(): TeamSnapshot {
  return {
    agents: [agent("build", "primary"), agent("architect", "subagent")],
    skills: [{ name: "graphify", description: "Graphe", metadata: {}, body: "" }],
    mcps: [{ name: "chrome-devtools", type: "local", enabled: true, command: ["npx"], environment: {}, headers: {} }],
    providers: [], globalPermission: {}, defaultAgent: "build", defaultModel: "local/qwen",
    layout: { version: 2, views: {} },
  };
}

describe("graphe d'équipe", () => {
  it("transforme une liaison graphique en permission task", () => {
    const result = addConnectionRelation(fixture(), "agent:build", "agent:architect");
    expect(result.error).toBeUndefined();
    expect(result.snapshot.agents[0].permission.task).toEqual({ architect: "allow" });
    const graph = createTeamGraph(result.snapshot, "organization", "build", undefined, {
      showDisabled: false, showDenied: false, showInherited: true, showSkills: true, showMcps: true, showTools: false, showModels: true,
    });
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].data?.kind).toBe("task");
  });

  it("supprime une liaison explicite et bloque une liaison héritée", () => {
    const relation = { source: "build", target: "architect", kind: "task" as const, action: "allow" as const, explicit: true };
    const withRelation = applyRelationChoice(fixture(), relation, "allow");
    expect(removeRelation(withRelation, relation).agents[0].permission.task).toBeUndefined();

    const inherited = { ...fixture(), globalPermission: { task: { architect: "allow" as const } } };
    const blocked = removeRelation(inherited, { ...relation, inherited: true, explicit: false });
    expect(blocked.agents[0].permission.task).toEqual({ architect: "deny" });
  });

  it("bloque l’ancienne cible lors de la reconnexion d’une relation héritée", () => {
    const inherited = { ...fixture(), agents: [...fixture().agents, agent("security-reviewer", "subagent")], globalPermission: { task: { architect: "allow" as const } } };
    const result = reconnectRelation(inherited, { source: "build", target: "architect", kind: "task", action: "allow", inherited: true }, "agent:build", "agent:security-reviewer");
    expect(result.snapshot.agents[0].permission.task).toEqual({ architect: "deny", "security-reviewer": "allow" });
  });

  it("génère les relations skill et MCP", () => {
    let current = fixture();
    current = addConnectionRelation(current, "agent:build", "skill:graphify").snapshot;
    current = addConnectionRelation(current, "agent:build", "mcp:chrome-devtools").snapshot;
    expect(current.agents[0].permission.skill).toEqual({ graphify: "allow" });
    expect(current.agents[0].permission["chrome-devtools_*"]).toEqual({ "*": "allow" });
  });
});
