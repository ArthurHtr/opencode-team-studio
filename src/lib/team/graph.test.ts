import { describe, expect, it } from "vitest";
import {
  HANDLE_IDS,
  addConnectionRelation,
  applyRelationChoice,
  createEdgeFromRelation,
  createTeamGraph,
  createPaletteCanvasNode,
  isSemanticConnection,
  mergePinnedCanvasNodes,
  reconnectRelation,
  removeRelation,
} from "@/lib/team/graph";
import type { AgentDefinition, TeamSnapshot } from "@/lib/types";

function agent(name: string, mode: AgentDefinition["mode"]): AgentDefinition {
  return {
    name,
    mode,
    source: name === "build" ? "builtin" : "file",
    builtin: name === "build",
    description: name,
    prompt: "",
    options: {},
    permission: {},
    extra: {},
  };
}

function fixture(): TeamSnapshot {
  return {
    agents: [agent("build", "primary"), agent("architect", "subagent")],
    skills: [{ name: "graphify", description: "Graphe", metadata: {}, body: "" }],
    mcps: [{ name: "chrome-devtools", type: "local", enabled: true, command: ["npx"], environment: {}, headers: {} }],
    providers: [],
    globalPermission: {},
    defaultAgent: "build",
    defaultModel: "local/qwen",
    layout: { version: 2, views: {} },
    metadata: { version: 2 },
  };
}

const filters = {
  showDisabled: false,
  showDenied: false,
  showInherited: true,
  showSkills: true,
  showMcps: true,
  showTools: false,
  showModels: true,
};

describe("graphe d'équipe", () => {
  it("transforme une liaison graphique en permission task", () => {
    const result = addConnectionRelation(fixture(), "agent:build", "agent:architect");
    expect(result.error).toBeUndefined();
    expect(result.snapshot.agents[0].permission.task).toEqual({ architect: "allow" });
    const graph = createTeamGraph(result.snapshot, "organization", "build", undefined, filters);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].data?.kind).toBe("task");
    expect(graph.edges[0].sourceHandle).toBe(HANDLE_IDS.taskOut);
    expect(graph.edges[0].targetHandle).toBe(HANDLE_IDS.taskIn);
  });

  it("impose les ports sémantiques selon le type de cible", () => {
    expect(isSemanticConnection("agent:build", "skill:graphify", HANDLE_IDS.skillOut, HANDLE_IDS.skillIn)).toBe(true);
    expect(isSemanticConnection("agent:build", "skill:graphify", HANDLE_IDS.taskOut, HANDLE_IDS.skillIn)).toBe(false);

    const invalid = addConnectionRelation(
      fixture(),
      "agent:build",
      "mcp:chrome-devtools",
      "allow",
      HANDLE_IDS.skillOut,
      HANDLE_IDS.mcpIn,
    );
    expect(invalid.error).toMatch(/point d’accroche/i);
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
    const inherited = {
      ...fixture(),
      agents: [...fixture().agents, agent("security-reviewer", "subagent")],
      globalPermission: { task: { architect: "allow" as const } },
    };
    const result = reconnectRelation(
      inherited,
      { source: "build", target: "architect", kind: "task", action: "allow", inherited: true },
      "agent:build",
      "agent:security-reviewer",
    );
    expect(result.snapshot.agents[0].permission.task).toEqual({ architect: "deny", "security-reviewer": "allow" });
  });

  it("génère les relations skill et MCP avec leurs ports dédiés", () => {
    let current = fixture();
    current = addConnectionRelation(current, "agent:build", "skill:graphify").snapshot;
    current = addConnectionRelation(current, "agent:build", "mcp:chrome-devtools").snapshot;
    expect(current.agents[0].permission.skill).toEqual({ graphify: "allow" });
    expect(current.agents[0].permission["chrome-devtools_*"]).toEqual({ "*": "allow" });

    const graph = createTeamGraph(current, "agent", "build", undefined, filters);
    const skillEdge = graph.edges.find((edge) => edge.data?.kind === "skill");
    const mcpEdge = graph.edges.find((edge) => edge.data?.kind === "mcp");
    expect(skillEdge?.sourceHandle).toBe(HANDLE_IDS.skillOut);
    expect(skillEdge?.targetHandle).toBe(HANDLE_IDS.skillIn);
    expect(mcpEdge?.sourceHandle).toBe(HANDLE_IDS.mcpOut);
    expect(mcpEdge?.targetHandle).toBe(HANDLE_IDS.mcpIn);
  });


  it("ajoute une ressource au canvas sans modifier la configuration", () => {
    const current = fixture();
    const node = createPaletteCanvasNode(current, "skill", "graphify", { x: 120, y: 80 });
    expect(node?.id).toBe("skill:graphify");
    expect(node?.data.unlinked).toBe(true);
    expect(current.agents[0].permission.skill).toBeUndefined();
  });

  it("restaure les boîtes épinglées sans créer de doublon", () => {
    const current = fixture();
    const graph = createTeamGraph(current, "agent", "build", undefined, filters);
    const merged = mergePinnedCanvasNodes(current, graph.nodes, ["skill:graphify", "mcp:chrome-devtools"]);
    expect(merged.filter((node) => node.id === "skill:graphify")).toHaveLength(1);
    expect(merged.find((node) => node.id === "skill:graphify")?.data.unlinked).toBe(true);
    expect(merged.find((node) => node.id === "mcp:chrome-devtools")?.data.unlinked).toBe(true);
  });

  it("ne génère aucun nœud artificiel de cluster", () => {
    const graph = createTeamGraph(fixture(), "complete", "build", undefined, filters);
    expect(graph.nodes.every((node) => node.data.kind !== ("cluster" as never))).toBe(true);
  });

  describe("connexions React Flow", () => {
    it("une connexion agent → skill ne supprime aucun nœud du graphe", () => {
      const current = fixture();
      const graph = createTeamGraph(current, "agent", "build", undefined, filters);
      const beforeNodes = new Set(graph.nodes.map((n) => n.id));
      const withRelation = addConnectionRelation(current, "agent:build", "skill:graphify");
      expect(withRelation.error).toBeUndefined();
      const afterGraph = createTeamGraph(withRelation.snapshot, "agent", "build", undefined, filters);
      const afterNodes = new Set(afterGraph.nodes.map((n) => n.id));
      for (const id of beforeNodes) expect(afterNodes.has(id)).toBe(true);
    });

    it("une connexion agent → MCP ne supprime aucun nœud du graphe", () => {
      const current = fixture();
      const graph = createTeamGraph(current, "agent", "build", undefined, filters);
      const beforeNodes = new Set(graph.nodes.map((n) => n.id));
      const withRelation = addConnectionRelation(current, "agent:build", "mcp:chrome-devtools");
      expect(withRelation.error).toBeUndefined();
      const afterGraph = createTeamGraph(withRelation.snapshot, "agent", "build", undefined, filters);
      const afterNodes = new Set(afterGraph.nodes.map((n) => n.id));
      for (const id of beforeNodes) expect(afterNodes.has(id)).toBe(true);
    });

    it("une délégation agent → agent ne supprime aucun nœud du graphe", () => {
      const current = fixture();
      const graph = createTeamGraph(current, "organization", "build", undefined, filters);
      const beforeNodes = new Set(graph.nodes.map((n) => n.id));
      const withRelation = addConnectionRelation(current, "agent:build", "agent:architect");
      expect(withRelation.error).toBeUndefined();
      const afterGraph = createTeamGraph(withRelation.snapshot, "organization", "build", undefined, filters);
      const afterNodes = new Set(afterGraph.nodes.map((n) => n.id));
      for (const id of beforeNodes) expect(afterNodes.has(id)).toBe(true);
    });

    it("la création d'une connexion ajoute une arête avec le bon id et les bons handles", () => {
      const current = fixture();
      const withRelation = addConnectionRelation(
        current,
        "agent:build",
        "skill:graphify",
        "allow",
        HANDLE_IDS.skillOut,
        HANDLE_IDS.skillIn,
      );
      expect(withRelation.error).toBeUndefined();
      expect(withRelation.relation).toBeDefined();
      const edgeId = `skill:${withRelation.relation!.source}:${withRelation.relation!.target}`;
      expect(edgeId).toBe("skill:build:graphify");
    });

    it("une reconnexion agent → agent met à jour l'arête sans perdre les nœuds", () => {
      const current = fixture();
      const withRelation = addConnectionRelation(current, "agent:build", "agent:architect");
      expect(withRelation.error).toBeUndefined();
      const graph = createTeamGraph(withRelation.snapshot, "organization", "build", undefined, filters);
      const beforeNodes = new Set(graph.nodes.map((n) => n.id));
      const reconnected = reconnectRelation(
        withRelation.snapshot,
        withRelation.relation!,
        "agent:build",
        "agent:architect",
        HANDLE_IDS.taskOut,
        HANDLE_IDS.taskIn,
      );
      expect(reconnected.error).toBeUndefined();
      const afterGraph = createTeamGraph(reconnected.snapshot, "organization", "build", undefined, filters);
      const afterNodes = new Set(afterGraph.nodes.map((n) => n.id));
      for (const id of beforeNodes) expect(afterNodes.has(id)).toBe(true);
    });

    it("mergePinnedCanvasNodes conserve les nœuds déposés manuellement après reconstruction", () => {
      const current = fixture();
      const manualNode = createPaletteCanvasNode(current, "mcp", "chrome-devtools", { x: 500, y: 300 });
      expect(manualNode).toBeDefined();
      const graph = createTeamGraph(current, "agent", "build", undefined, filters);
      const withPinned = mergePinnedCanvasNodes(current, graph.nodes, ["mcp:chrome-devtools"]);
      const pinned = withPinned.find((n) => n.id === "mcp:chrome-devtools");
      expect(pinned).toBeDefined();
      expect(pinned?.data.unlinked).toBe(true);
    });

    it("mergePinnedCanvasNodes préserve la position d'un nœud déjà dans le graphe", () => {
      const current = fixture();
      const graph = createTeamGraph(current, "agent", "build", undefined, filters);
      const mcpNode = graph.nodes.find((n) => n.id === "mcp:chrome-devtools");
      if (mcpNode) {
        const withPinned = mergePinnedCanvasNodes(current, graph.nodes, ["mcp:chrome-devtools"]);
        const pinned = withPinned.find((n) => n.id === "mcp:chrome-devtools");
        expect(pinned?.position).toEqual(mcpNode.position);
      }
    });

    it("addConnectionRelation ne modifie pas les nœuds existants du snapshot", () => {
      const current = fixture();
      const agentBefore = current.agents.map((a) => ({ name: a.name, mode: a.mode }));
      const withRelation = addConnectionRelation(current, "agent:build", "skill:graphify");
      expect(withRelation.error).toBeUndefined();
      const agentAfter = withRelation.snapshot.agents.map((a) => ({ name: a.name, mode: a.mode }));
      expect(agentAfter).toEqual(agentBefore);
    });

    it("le draft est marqué après une connexion", () => {
      const current = fixture();
      const withRelation = addConnectionRelation(current, "agent:build", "skill:graphify");
      expect(withRelation.error).toBeUndefined();
      expect(withRelation.snapshot.agents[0].permission.skill).toEqual({ graphify: "allow" });
    });
  });

  describe("création d'arêtes avec makeEdge", () => {
    it("makeEdge génère une arête skill avec les bonnes propriétés", () => {
      const current = fixture();
      const withRelation = addConnectionRelation(current, "agent:build", "skill:graphify");
      expect(withRelation.error).toBeUndefined();
      const edge = createEdgeFromRelation(withRelation.relation!);
      expect(edge.id).toBe("skill:build:graphify");
      expect(edge.source).toBe("agent:build");
      expect(edge.target).toBe("skill:graphify");
      expect(edge.sourceHandle).toBe(HANDLE_IDS.skillOut);
      expect(edge.targetHandle).toBe(HANDLE_IDS.skillIn);
      expect(edge.type).toBe("default");
      expect(edge.data).toEqual(withRelation.relation);
    });

    it("makeEdge génère une arête task avec les bons handles", () => {
      const current = fixture();
      const withRelation = addConnectionRelation(current, "agent:build", "agent:architect");
      expect(withRelation.error).toBeUndefined();
      const edge = createEdgeFromRelation(withRelation.relation!);
      expect(edge.id).toBe("task:build:architect");
      expect(edge.source).toBe("agent:build");
      expect(edge.target).toBe("agent:architect");
      expect(edge.sourceHandle).toBe(HANDLE_IDS.taskOut);
      expect(edge.targetHandle).toBe(HANDLE_IDS.taskIn);
    });

    it("makeEdge génère une arête mcp avec les bons handles", () => {
      const current = fixture();
      const withRelation = addConnectionRelation(current, "agent:build", "mcp:chrome-devtools");
      expect(withRelation.error).toBeUndefined();
      const edge = createEdgeFromRelation(withRelation.relation!);
      expect(edge.id).toBe("mcp:build:chrome-devtools");
      expect(edge.sourceHandle).toBe(HANDLE_IDS.mcpOut);
      expect(edge.targetHandle).toBe(HANDLE_IDS.mcpIn);
    });

    it("makeEdge pour action ask active l'animation", () => {
      const relation = { source: "build", target: "architect", kind: "task" as const, action: "ask" as const, explicit: true };
      const edge = createEdgeFromRelation(relation);
      expect(edge.animated).toBe(true);
      expect(edge.style?.strokeDasharray).toBe("8 5");
    });

    it("makeEdge pour action deny applique le style deny", () => {
      const relation = { source: "build", target: "architect", kind: "task" as const, action: "deny" as const, explicit: true };
      const edge = createEdgeFromRelation(relation);
      expect(edge.style?.opacity).toBe(0.62);
      expect(edge.style?.strokeDasharray).toBe("3 6");
    });

    it("makeEdge pour relation héritée task reste reconnectable, modèle hérité non", () => {
      const taskRelation = { source: "build", target: "architect", kind: "task" as const, action: "allow" as const, inherited: true };
      const taskEdge = createEdgeFromRelation(taskRelation);
      expect(taskEdge.style?.opacity).toBe(0.72);
      expect(taskEdge.style?.strokeDasharray).toBe("3 7");
      expect(taskEdge.reconnectable).toBe(true);

      const modelRelation = { source: "build", target: "local/qwen", kind: "model" as const, action: "allow" as const, inherited: true };
      const modelEdge = createEdgeFromRelation(modelRelation);
      expect(modelEdge.reconnectable).toBe(false);
    });
  });
});
