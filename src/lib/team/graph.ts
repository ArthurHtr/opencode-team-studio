import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import { evaluatePermission, hasExplicitRule, NATIVE_TOOLS, removePermissionTarget, renamePermissionTarget, setPermissionTarget, setPermissionValue } from "@/lib/team/permissions";
import type {
  AgentDefinition,
  GraphLayout,
  McpDefinition,
  PermissionAction,
  PermissionChoice,
  RelationKind,
  SkillDefinition,
  TeamNodeData,
  TeamRelation,
  TeamSnapshot,
} from "@/lib/types";

export type TeamView = "organization" | "agent" | "resources" | "complete";
export type ResourceSelection = { kind: "skill" | "mcp" | "tool" | "model"; name: string } | undefined;
export type GraphFilters = {
  showDisabled: boolean;
  showDenied: boolean;
  showInherited: boolean;
  showSkills: boolean;
  showMcps: boolean;
  showTools: boolean;
  showModels: boolean;
};

export type TeamGraph = {
  nodes: Node<TeamNodeData>[];
  edges: Edge<TeamRelation>[];
};

export const DEFAULT_FILTERS: GraphFilters = {
  showDisabled: false,
  showDenied: false,
  showInherited: true,
  showSkills: true,
  showMcps: true,
  showTools: false,
  showModels: true,
};

export function createTeamGraph(
  snapshot: TeamSnapshot,
  view: TeamView,
  selectedAgent: string,
  selectedResource: ResourceSelection,
  filters: GraphFilters,
  saved?: GraphLayout,
): TeamGraph {
  if (view === "agent") return createAgentGraph(snapshot, selectedAgent, filters, saved);
  if (view === "resources") return createResourceGraph(snapshot, selectedResource, filters, saved);
  if (view === "complete") return createCompleteGraph(snapshot, filters, saved);
  return createOrganizationGraph(snapshot, filters, saved);
}

export function applyRelationChoice(snapshot: TeamSnapshot, relation: TeamRelation, action: PermissionChoice): TeamSnapshot {
  return {
    ...snapshot,
    agents: snapshot.agents.map((agent) => {
      if (agent.name !== relation.source) return agent;
      if (relation.kind === "model") return { ...agent, model: action === "inherit" ? undefined : relation.target };
      if (relation.kind === "task" || relation.kind === "skill") {
        return { ...agent, permission: setPermissionTarget(agent.permission, relation.kind, relation.target, action) };
      }
      if (relation.kind === "mcp") {
        return { ...agent, permission: setPermissionTarget(agent.permission, `${relation.target}_*`, "*", action) };
      }
      return { ...agent, permission: setPermissionValue(agent.permission, relation.target, action === "inherit" ? undefined : action) };
    }),
  };
}

export function removeRelation(snapshot: TeamSnapshot, relation: TeamRelation): TeamSnapshot {
  if (relation.kind === "model") {
    if (relation.inherited) return snapshot;
    return applyRelationChoice(snapshot, relation, "inherit");
  }
  // Removing an inherited edge needs a local deny; otherwise it immediately reappears.
  return applyRelationChoice(snapshot, relation, relation.inherited ? "deny" : "inherit");
}

export function addConnectionRelation(snapshot: TeamSnapshot, sourceId: string, targetId: string, action: PermissionAction = "allow"): { snapshot: TeamSnapshot; relation?: TeamRelation; error?: string } {
  const source = parseNodeId(sourceId);
  const target = parseNodeId(targetId);
  if (source.kind !== "agent") return { snapshot, error: "La source doit être un agent." };
  if (!target) return { snapshot, error: "Cette ressource ne peut pas être reliée." };
  if (target.kind === "agent") {
    const targetAgent = snapshot.agents.find((agent) => agent.name === target.name);
    if (!targetAgent || targetAgent.mode === "primary") return { snapshot, error: "Un agent principal ne peut pas être utilisé comme sous-agent." };
    if (source.name === target.name) return { snapshot, error: "Un agent ne peut pas se déléguer à lui-même." };
  }
  const kind = target.kind === "agent" ? "task" : target.kind;
  const relation: TeamRelation = { source: source.name, target: target.name, kind, action, explicit: true };
  return { snapshot: applyRelationChoice(snapshot, relation, action), relation };
}

export function reconnectRelation(snapshot: TeamSnapshot, previous: TeamRelation, sourceId: string, targetId: string): { snapshot: TeamSnapshot; relation?: TeamRelation; error?: string } {
  const withoutPrevious = removeRelation(snapshot, previous);
  return addConnectionRelation(withoutPrevious, sourceId, targetId, previous.action);
}

export function renameAgentInSnapshot(snapshot: TeamSnapshot, previous: string, nextAgent: AgentDefinition): TeamSnapshot {
  const renamed = previous !== nextAgent.name;
  return {
    ...snapshot,
    agents: snapshot.agents.map((agent) => {
      if (agent.name === previous) return nextAgent;
      if (!renamed) return agent;
      return { ...agent, permission: renamePermissionTarget(agent.permission, "task", previous, nextAgent.name) };
    }),
    defaultAgent: snapshot.defaultAgent === previous ? nextAgent.name : snapshot.defaultAgent,
  };
}

export function removeAgentFromSnapshot(snapshot: TeamSnapshot, name: string): TeamSnapshot {
  return {
    ...snapshot,
    agents: snapshot.agents
      .filter((agent) => agent.name !== name)
      .map((agent) => ({ ...agent, permission: removePermissionTarget(agent.permission, "task", name) })),
    defaultAgent: snapshot.defaultAgent === name ? "build" : snapshot.defaultAgent,
  };
}

export function resolveAgentPermission(snapshot: TeamSnapshot, agent: AgentDefinition, key: string, target = "*"): { action: PermissionAction; inherited: boolean; explicit: boolean } | undefined {
  const local = evaluatePermission(agent.permission[key], target);
  if (local) return { action: local, inherited: false, explicit: true };
  const global = evaluatePermission(snapshot.globalPermission[key], target) || evaluatePermission(snapshot.globalPermission["*"], key);
  return global ? { action: global, inherited: true, explicit: false } : undefined;
}

export function viewKey(view: TeamView, selectedAgent: string, selectedResource?: ResourceSelection): string {
  if (view === "agent") return `agent:${selectedAgent || "none"}`;
  if (view === "resources") return `resource:${selectedResource?.kind || "none"}:${selectedResource?.name || "none"}`;
  return view;
}

export function parseNodeId(id: string): { kind: TeamNodeData["kind"]; name: string } {
  const index = id.indexOf(":");
  if (index < 0) return { kind: "agent", name: id };
  return { kind: id.slice(0, index) as TeamNodeData["kind"], name: id.slice(index + 1) };
}

export function nodeId(kind: TeamNodeData["kind"], name: string): string {
  return `${kind}:${name}`;
}

function createOrganizationGraph(snapshot: TeamSnapshot, filters: GraphFilters, saved?: GraphLayout): TeamGraph {
  const agents = visibleAgents(snapshot, filters);
  const nodes = agents.map((agent) => agentNode(snapshot, agent, saved));
  const edges: Edge<TeamRelation>[] = [];
  for (const source of agents) {
    for (const target of agents) {
      if (source.name === target.name || target.mode === "primary") continue;
      addPermissionEdge(edges, snapshot, source, "task", target.name, filters);
    }
  }
  return { nodes, edges };
}

function createAgentGraph(snapshot: TeamSnapshot, selectedName: string, filters: GraphFilters, saved?: GraphLayout): TeamGraph {
  const selected = snapshot.agents.find((agent) => agent.name === selectedName) || snapshot.agents.find((agent) => !agent.disable) || snapshot.agents[0];
  if (!selected) return { nodes: [], edges: [] };
  const nodes: Node<TeamNodeData>[] = [agentNode(snapshot, selected, saved)];
  const edges: Edge<TeamRelation>[] = [];
  const addNode = (node: Node<TeamNodeData>) => { if (!nodes.some((item) => item.id === node.id)) nodes.push(node); };

  for (const agent of visibleAgents(snapshot, filters)) {
    if (agent.name === selected.name) continue;
    const inbound = resolveAgentPermission(snapshot, agent, "task", selected.name);
    if (shouldShow(inbound, hasExplicitRule(agent.permission.task, selected.name), filters)) {
      addNode(agentNode(snapshot, agent, saved));
      edges.push(makeEdge({ source: agent.name, target: selected.name, kind: "task", ...relationState(inbound, "deny") }));
    }
    if (agent.mode !== "primary") {
      const outbound = resolveAgentPermission(snapshot, selected, "task", agent.name);
      if (shouldShow(outbound, hasExplicitRule(selected.permission.task, agent.name), filters)) {
        addNode(agentNode(snapshot, agent, saved));
        edges.push(makeEdge({ source: selected.name, target: agent.name, kind: "task", ...relationState(outbound, "deny") }));
      }
    }
  }

  if (filters.showSkills) for (const skill of snapshot.skills) {
    const resolved = resolveAgentPermission(snapshot, selected, "skill", skill.name);
    if (!shouldShow(resolved, hasExplicitRule(selected.permission.skill, skill.name), filters)) continue;
    addNode(skillNode(skill, saved));
    edges.push(makeEdge({ source: selected.name, target: skill.name, kind: "skill", ...relationState(resolved, "deny") }));
  }
  if (filters.showMcps) for (const mcp of snapshot.mcps) {
    const resolved = resolveAgentPermission(snapshot, selected, `${mcp.name}_*`, "*");
    if (!shouldShow(resolved, hasExplicitRule(selected.permission[`${mcp.name}_*`], "*"), filters)) continue;
    addNode(mcpNode(mcp, saved));
    edges.push(makeEdge({ source: selected.name, target: mcp.name, kind: "mcp", ...relationState(resolved, "deny") }));
  }
  if (filters.showTools) for (const tool of NATIVE_TOOLS) {
    if (tool.id === "task" || tool.id === "skill") continue;
    const resolved = resolveAgentPermission(snapshot, selected, tool.id, "*");
    if (!shouldShow(resolved, selected.permission[tool.id] !== undefined, filters)) continue;
    addNode(toolNode(tool, saved));
    edges.push(makeEdge({ source: selected.name, target: tool.id, kind: "tool", ...relationState(resolved, "allow") }));
  }
  if (filters.showModels) {
    const model = selected.model || snapshot.defaultModel;
    if (model) {
      addNode(modelNode(model, selected.model ? "Modèle spécifique" : "Modèle global hérité", saved));
      edges.push(makeEdge({ source: selected.name, target: model, kind: "model", action: "allow", inherited: !selected.model, explicit: Boolean(selected.model) }));
    }
  }
  return { nodes, edges };
}

function createResourceGraph(snapshot: TeamSnapshot, selection: ResourceSelection, filters: GraphFilters, saved?: GraphLayout): TeamGraph {
  const resource = selection || defaultResource(snapshot, filters);
  if (!resource) return { nodes: [], edges: [] };
  const nodes: Node<TeamNodeData>[] = [];
  const edges: Edge<TeamRelation>[] = [];
  if (resource.kind === "skill") {
    const skill = snapshot.skills.find((item) => item.name === resource.name);
    if (!skill) return { nodes, edges };
    nodes.push(skillNode(skill, saved));
  } else if (resource.kind === "mcp") {
    const mcp = snapshot.mcps.find((item) => item.name === resource.name);
    if (!mcp) return { nodes, edges };
    nodes.push(mcpNode(mcp, saved));
  } else if (resource.kind === "tool") {
    const tool = NATIVE_TOOLS.find((item) => item.id === resource.name);
    if (!tool) return { nodes, edges };
    nodes.push(toolNode(tool, saved));
  } else {
    nodes.push(modelNode(resource.name, "Modèle de l’équipe", saved));
  }

  for (const agent of visibleAgents(snapshot, filters)) {
    let resolved: ReturnType<typeof resolveAgentPermission>;
    let explicit = false;
    if (resource.kind === "skill") {
      resolved = resolveAgentPermission(snapshot, agent, "skill", resource.name);
      explicit = hasExplicitRule(agent.permission.skill, resource.name);
    } else if (resource.kind === "mcp") {
      resolved = resolveAgentPermission(snapshot, agent, `${resource.name}_*`, "*");
      explicit = hasExplicitRule(agent.permission[`${resource.name}_*`], "*");
    } else if (resource.kind === "tool") {
      resolved = resolveAgentPermission(snapshot, agent, resource.name, "*");
      explicit = agent.permission[resource.name] !== undefined;
    } else {
      const effectiveModel = agent.model || snapshot.defaultModel;
      if (effectiveModel !== resource.name) continue;
      resolved = { action: "allow", inherited: !agent.model, explicit: Boolean(agent.model) };
    }
    if (!shouldShow(resolved, explicit, filters)) continue;
    nodes.push(agentNode(snapshot, agent, saved));
    edges.push(makeEdge({ source: agent.name, target: resource.name, kind: resource.kind, ...relationState(resolved, "deny") }));
  }
  return { nodes, edges };
}

function createCompleteGraph(snapshot: TeamSnapshot, filters: GraphFilters, saved?: GraphLayout): TeamGraph {
  const agents = visibleAgents(snapshot, filters);
  const nodes: Node<TeamNodeData>[] = agents.map((agent) => agentNode(snapshot, agent, saved));
  const edges: Edge<TeamRelation>[] = [];

  for (const source of agents) for (const target of agents) {
    if (source.name === target.name || target.mode === "primary") continue;
    addPermissionEdge(edges, snapshot, source, "task", target.name, filters);
  }
  if (filters.showSkills) snapshot.skills.forEach((skill) => nodes.push(skillNode(skill, saved)));
  if (filters.showMcps) snapshot.mcps.forEach((mcp) => nodes.push(mcpNode(mcp, saved)));
  if (filters.showTools) NATIVE_TOOLS.filter((tool) => tool.id !== "task" && tool.id !== "skill").forEach((tool) => nodes.push(toolNode(tool, saved)));

  const models = new Set<string>();
  if (filters.showModels) {
    for (const agent of agents) if (agent.model || snapshot.defaultModel) models.add(agent.model || snapshot.defaultModel || "");
    [...models].filter(Boolean).forEach((model) => nodes.push(modelNode(model, "Modèle utilisé par l’équipe", saved)));
  }

  for (const agent of agents) {
    if (filters.showSkills) for (const skill of snapshot.skills) addPermissionEdge(edges, snapshot, agent, "skill", skill.name, filters);
    if (filters.showMcps) for (const mcp of snapshot.mcps) addPermissionEdge(edges, snapshot, agent, "mcp", mcp.name, filters);
    if (filters.showTools) for (const tool of NATIVE_TOOLS.filter((item) => item.id !== "task" && item.id !== "skill")) addPermissionEdge(edges, snapshot, agent, "tool", tool.id, filters);
    if (filters.showModels) {
      const model = agent.model || snapshot.defaultModel;
      if (model) edges.push(makeEdge({ source: agent.name, target: model, kind: "model", action: "allow", inherited: !agent.model, explicit: Boolean(agent.model) }));
    }
  }
  return { nodes, edges };
}

function addPermissionEdge(edges: Edge<TeamRelation>[], snapshot: TeamSnapshot, source: AgentDefinition, kind: Exclude<RelationKind, "model">, target: string, filters: GraphFilters): void {
  const key = kind === "mcp" ? `${target}_*` : kind === "tool" ? target : kind;
  const permissionTarget = kind === "mcp" || kind === "tool" ? "*" : target;
  const resolved = resolveAgentPermission(snapshot, source, key, permissionTarget);
  const explicit = kind === "tool" ? source.permission[key] !== undefined : hasExplicitRule(source.permission[key], permissionTarget);
  if (!shouldShow(resolved, explicit, filters)) return;
  edges.push(makeEdge({ source: source.name, target, kind, ...relationState(resolved, "deny") }));
}

function visibleAgents(snapshot: TeamSnapshot, filters: GraphFilters): AgentDefinition[] {
  return snapshot.agents.filter((agent) => filters.showDisabled || !agent.disable);
}

function agentNode(snapshot: TeamSnapshot, agent: AgentDefinition, saved?: GraphLayout): Node<TeamNodeData> {
  const id = nodeId("agent", agent.name);
  return {
    id,
    type: "agent",
    position: saved?.positions[id] || { x: 0, y: 0 },
    data: {
      kind: "agent",
      name: agent.name,
      label: agent.name,
      description: agent.description,
      mode: agent.mode,
      model: agent.model || snapshot.defaultModel,
      disabled: agent.disable,
      primary: agent.mode !== "subagent",
      count: relationCount(snapshot, agent),
      color: agent.color,
    },
  };
}

function skillNode(skill: SkillDefinition, saved?: GraphLayout): Node<TeamNodeData> {
  const id = nodeId("skill", skill.name);
  return { id, type: "skill", position: saved?.positions[id] || { x: 0, y: 0 }, data: { kind: "skill", name: skill.name, label: skill.name, description: skill.description } };
}
function mcpNode(mcp: McpDefinition, saved?: GraphLayout): Node<TeamNodeData> {
  const id = nodeId("mcp", mcp.name);
  return { id, type: "mcp", position: saved?.positions[id] || { x: 0, y: 0 }, data: { kind: "mcp", name: mcp.name, label: mcp.name, description: `${mcp.type} · ${mcp.enabled ? "activé" : "désactivé"}`, disabled: !mcp.enabled } };
}
function toolNode(tool: typeof NATIVE_TOOLS[number], saved?: GraphLayout): Node<TeamNodeData> {
  const id = nodeId("tool", tool.id);
  return { id, type: "tool", position: saved?.positions[id] || { x: 0, y: 0 }, data: { kind: "tool", name: tool.id, label: tool.shortLabel, description: tool.description } };
}
function modelNode(model: string, description: string, saved?: GraphLayout): Node<TeamNodeData> {
  const id = nodeId("model", model);
  return { id, type: "model", position: saved?.positions[id] || { x: 0, y: 0 }, data: { kind: "model", name: model, label: model, description } };
}

function makeEdge(relation: TeamRelation): Edge<TeamRelation> {
  const color = relationColor(relation.kind, relation.action, relation.inherited);
  return {
    id: `${relation.kind}:${relation.source}:${relation.target}`,
    source: nodeId("agent", relation.source),
    target: nodeId(relation.kind === "task" ? "agent" : relation.kind, relation.target),
    type: "bezier",
    reconnectable: relation.kind !== "model" || !relation.inherited,
    animated: relation.action === "ask",
    label: relationLabel(relation.kind),
    labelStyle: { fill: color, fontSize: 10, fontWeight: 700 },
    labelBgStyle: { fill: "#111722", fillOpacity: 0.94 },
    labelBgPadding: [7, 4],
    labelBgBorderRadius: 7,
    style: {
      stroke: color,
      strokeWidth: relation.kind === "task" ? 2.35 : 1.85,
      strokeDasharray: relation.inherited ? "3 7" : relation.action === "ask" ? "8 5" : relation.action === "deny" ? "3 6" : undefined,
      opacity: relation.action === "deny" ? 0.62 : relation.inherited ? 0.72 : 0.95,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
    data: relation,
  };
}

function relationCount(snapshot: TeamSnapshot, agent: AgentDefinition): number {
  let count = 0;
  for (const target of snapshot.agents) if (target.name !== agent.name && positive(resolveAgentPermission(snapshot, agent, "task", target.name)?.action)) count += 1;
  for (const skill of snapshot.skills) if (positive(resolveAgentPermission(snapshot, agent, "skill", skill.name)?.action)) count += 1;
  for (const mcp of snapshot.mcps) if (positive(resolveAgentPermission(snapshot, agent, `${mcp.name}_*`, "*")?.action)) count += 1;
  return count;
}

function relationState(resolved: ReturnType<typeof resolveAgentPermission>, fallback: PermissionAction): Pick<TeamRelation, "action" | "inherited" | "explicit"> {
  return { action: resolved?.action || fallback, inherited: resolved?.inherited, explicit: resolved?.explicit };
}
function shouldShow(resolved: ReturnType<typeof resolveAgentPermission>, explicit: boolean, filters: GraphFilters): boolean {
  if (!resolved) return false;
  if (resolved.inherited && !filters.showInherited) return false;
  if (resolved.action === "deny" && !filters.showDenied) return false;
  return positive(resolved.action) || explicit || filters.showDenied;
}
function positive(action?: PermissionAction): boolean { return action === "allow" || action === "ask"; }
function relationColor(kind: RelationKind, action: PermissionAction, inherited?: boolean): string {
  if (inherited) return "#778196";
  if (action === "deny") return "#ef6b73";
  if (action === "ask") return "#e2ad52";
  return kind === "task" ? "#9b86ff" : kind === "skill" ? "#4dd49a" : kind === "mcp" ? "#eea451" : kind === "model" ? "#dc7cdd" : "#70a8f5";
}
function relationLabel(kind: RelationKind): string { return kind === "task" ? "délègue" : kind === "skill" ? "skill" : kind === "mcp" ? "MCP" : kind === "model" ? "modèle" : "outil"; }
function defaultResource(snapshot: TeamSnapshot, filters: GraphFilters): ResourceSelection {
  if (filters.showSkills && snapshot.skills[0]) return { kind: "skill", name: snapshot.skills[0].name };
  if (filters.showMcps && snapshot.mcps[0]) return { kind: "mcp", name: snapshot.mcps[0].name };
  if (filters.showTools && NATIVE_TOOLS[0]) return { kind: "tool", name: NATIVE_TOOLS[0].id };
  if (filters.showModels && snapshot.defaultModel) return { kind: "model", name: snapshot.defaultModel };
  return undefined;
}
