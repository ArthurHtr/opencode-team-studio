import type { Edge, Node } from "@xyflow/react";
import type { TeamNodeData, TeamRelation } from "@/lib/types";

export const NODE_SIZE: Record<TeamNodeData["kind"], { width: number; height: number }> = {
  agent: { width: 300, height: 162 },
  skill: { width: 246, height: 108 },
  mcp: { width: 246, height: 108 },
  tool: { width: 208, height: 82 },
  model: { width: 264, height: 104 },
};

const H_GAP = 40;
const V_GAP = 30;
const START_X = 60;
const START_Y = 60;

export async function autoLayoutTeamGraph(
  nodes: Node<TeamNodeData>[],
  edges: Edge<TeamRelation>[],
  view: string,
): Promise<Node<TeamNodeData>[]> {
  if (!nodes.length) return nodes;
  return simpleLayout(nodes, edges, view);
}

function simpleLayout(nodes: Node<TeamNodeData>[], _edges: Edge<TeamRelation>[], view: string): Node<TeamNodeData>[] {
  const byKind = new Map<string, Node<TeamNodeData>[]>();
  for (const node of nodes) {
    const kind = node.data.kind;
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind)!.push(node);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const x = START_X;
  let y = START_Y;
  const maxRowHeight = 200;

  if (view === "agent") {
    return layoutAgentView(nodes, positions);
  }

  if (view === "resources") {
    return layoutResourcesView(nodes, positions);
  }

  // Organization / complete: grid by kind
  const kindOrder: TeamNodeData["kind"][] = ["agent", "skill", "mcp", "tool", "model"];
  for (const kind of kindOrder) {
    const kindNodes = byKind.get(kind);
    if (!kindNodes?.length) continue;

    // Sort by name for determinism
    kindNodes.sort((a, b) => a.data.name.localeCompare(b.data.name));

    const cols = Math.ceil(Math.sqrt(kindNodes.length));
    const rows = Math.ceil(kindNodes.length / cols);

    for (let i = 0; i < kindNodes.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const size = NODE_SIZE[kind];
      positions[kindNodes[i].id] = {
        x: x + col * (size.width + H_GAP),
        y: y + row * (size.height + V_GAP),
      };
    }

    y += rows * (maxRowHeight + V_GAP);
  }

  return nodes.map((node) => ({
    ...node,
    position: positions[node.id] || { x: 0, y: 0 },
    deletable: false,
  }));
}

function layoutAgentView(nodes: Node<TeamNodeData>[], positions: Record<string, { x: number; y: number }>): Node<TeamNodeData>[] {
  const agents = nodes.filter((n) => n.data.kind === "agent");
  const skills = nodes.filter((n) => n.data.kind === "skill");
  const mcps = nodes.filter((n) => n.data.kind === "mcp");
  const tools = nodes.filter((n) => n.data.kind === "tool");
  const models = nodes.filter((n) => n.data.kind === "model");

  // Selected agent in center
  const centerX = 400;
  const centerY = 300;

  // Find selected agent (first primary, or first agent)
  const selected = agents.find((a) => a.data.primary) || agents[0];
  if (selected) {
    positions[selected.id] = { x: centerX - NODE_SIZE.agent.width / 2, y: centerY - NODE_SIZE.agent.height / 2 };
  }

  // Left: callers (agents that can call selected)
  let leftX = centerX - NODE_SIZE.agent.width - H_GAP - 200;
  for (const agent of agents) {
    if (agent.id === selected?.id) continue;
    positions[agent.id] = { x: leftX, y: centerY - NODE_SIZE.agent.height / 2 };
    leftX -= NODE_SIZE.agent.width + H_GAP;
  }

  // Right: skills
  let rightX = centerX + NODE_SIZE.agent.width + H_GAP + 200;
  for (const skill of skills) {
    positions[skill.id] = { x: rightX, y: centerY - NODE_SIZE.skill.height / 2 };
    rightX += NODE_SIZE.skill.width + H_GAP;
  }

  // Bottom: MCPs and tools
  const bottomY = centerY + NODE_SIZE.agent.height + V_GAP + 100;
  let bottomX = centerX - 200;
  for (const mcp of mcps) {
    positions[mcp.id] = { x: bottomX, y: bottomY };
    bottomX += NODE_SIZE.mcp.width + H_GAP;
  }
  for (const tool of tools) {
    positions[tool.id] = { x: bottomX, y: bottomY };
    bottomX += NODE_SIZE.tool.width + H_GAP;
  }

  // Models
  for (const model of models) {
    positions[model.id] = { x: centerX - NODE_SIZE.model.width / 2, y: bottomY + 120 };
  }

  return nodes.map((node) => ({
    ...node,
    position: positions[node.id] || { x: 0, y: 0 },
    deletable: false,
  }));
}

function layoutResourcesView(nodes: Node<TeamNodeData>[], positions: Record<string, { x: number; y: number }>): Node<TeamNodeData>[] {
  const resource = nodes[0];
  if (!resource) return nodes.map((n) => ({ ...n, deletable: false }));

  positions[resource.id] = { x: 400, y: 250 };

  // Agents around the resource
  const agents = nodes.filter((n) => n.data.kind === "agent");
  const angleStep = (2 * Math.PI) / Math.max(agents.length, 1);
  const radius = 280;

  for (let i = 0; i < agents.length; i++) {
    const angle = angleStep * i - Math.PI / 2;
    positions[agents[i].id] = {
      x: 400 + Math.cos(angle) * radius - NODE_SIZE.agent.width / 2,
      y: 250 + Math.sin(angle) * radius - NODE_SIZE.agent.height / 2,
    };
  }

  return nodes.map((node) => ({
    ...node,
    position: positions[node.id] || { x: 0, y: 0 },
    deletable: false,
  }));
}

export function resolveDraggedCollision(nodes: Node<TeamNodeData>[], movedId: string): Node<TeamNodeData>[] {
  const moved = nodes.find((node) => node.id === movedId);
  if (!moved) return nodes;
  const others = nodes.filter((node) => node.id !== movedId);
  const nextPosition = findFreePosition(moved.position, moved, others);
  if (nextPosition.x === moved.position.x && nextPosition.y === moved.position.y) return nodes;
  return nodes.map((node) => node.id === movedId ? { ...node, position: nextPosition } : node);
}

function findFreePosition(position: { x: number; y: number }, node: Node<TeamNodeData>, others: Node<TeamNodeData>[]): { x: number; y: number } {
  let candidate = { ...position };
  const ad = NODE_SIZE[node.data.kind];
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const collides = others.some((other) => {
      const od = NODE_SIZE[other.data.kind];
      return !(
        candidate.x + ad.width + 22 < other.position.x ||
        candidate.x > other.position.x + od.width + 22 ||
        candidate.y + ad.height + 22 < other.position.y ||
        candidate.y > other.position.y + od.height + 22
      );
    });
    if (!collides) return candidate;
    const ring = Math.floor(attempt / 8) + 1;
    const angle = (attempt % 8) * (Math.PI / 4);
    candidate = { x: position.x + Math.cos(angle) * ring * 48, y: position.y + Math.sin(angle) * ring * 48 };
  }
  return position;
}
