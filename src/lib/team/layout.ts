import type { Edge, Node } from "@xyflow/react";
import type { ResourceSelection, TeamView } from "@/lib/team/graph";
import type { TeamNodeData, TeamRelation } from "@/lib/types";

const NODE_SIZE: Record<TeamNodeData["kind"], { width: number; height: number }> = {
  agent: { width: 320, height: 172 },
  skill: { width: 246, height: 108 },
  mcp: { width: 246, height: 108 },
  tool: { width: 246, height: 108 },
  model: { width: 264, height: 108 },
};

export type LayoutOptions = {
  view: TeamView;
  selectedAgent?: string;
  selectedResource?: ResourceSelection;
};

/**
 * Deterministic semantic layout. It deliberately avoids visual clusters:
 * agents form the team spine, skills live above, MCP/tools below and models to
 * the right. The resulting geometry matches the semantic handles on nodes.
 */
export async function autoLayoutTeamGraph(
  nodes: Node<TeamNodeData>[],
  edges: Edge<TeamRelation>[],
  options: LayoutOptions,
): Promise<Node<TeamNodeData>[]> {
  if (!nodes.length) return nodes;
  if (options.view === "agent") return layoutAgentView(nodes, edges, options.selectedAgent);
  if (options.view === "resources") return layoutResourceView(nodes, options.selectedResource);
  if (options.view === "complete") return layoutCompleteView(nodes, edges);
  return layoutOrganization(nodes, edges);
}

export function mergeStoredPositions(
  nodes: Node<TeamNodeData>[],
  stored: Record<string, { x: number; y: number }>,
): { nodes: Node<TeamNodeData>[]; complete: boolean } {
  let complete = nodes.length > 0;
  const occupied: Node<TeamNodeData>[] = [];
  const merged = nodes.map((node, index) => {
    const saved = stored[node.id];
    if (saved) {
      const next = { ...node, position: saved };
      occupied.push(next);
      return next;
    }
    complete = false;
    const next = {
      ...node,
      position: findFreePosition(
        { x: 80 + (index % 4) * 360, y: 100 + Math.floor(index / 4) * 230 },
        node,
        occupied,
      ),
    };
    occupied.push(next);
    return next;
  });
  return { nodes: merged, complete };
}

export function resolveDraggedCollision(nodes: Node<TeamNodeData>[], movedId: string): Node<TeamNodeData>[] {
  const moved = nodes.find((node) => node.id === movedId);
  if (!moved) return nodes;
  const others = nodes.filter((node) => node.id !== movedId);
  const nextPosition = findFreePosition(moved.position, moved, others);
  if (nextPosition.x === moved.position.x && nextPosition.y === moved.position.y) return nodes;
  return nodes.map((node) => node.id === movedId ? { ...node, position: nextPosition } : node);
}

export function nodeDimensions(node: Node<TeamNodeData>): { width: number; height: number } {
  const fallback = NODE_SIZE[node.data.kind];
  return {
    width: node.measured?.width || node.width || numberStyle(node.style?.width) || fallback.width,
    height: node.measured?.height || node.height || numberStyle(node.style?.height) || fallback.height,
  };
}

function layoutOrganization(
  nodes: Node<TeamNodeData>[],
  edges: Edge<TeamRelation>[],
): Node<TeamNodeData>[] {
  const agents = nodes.filter((node) => node.data.kind === "agent");
  const taskEdges = edges.filter((edge) => edge.data?.kind === "task");
  if (!agents.length) return layoutGrid(nodes);

  const ids = new Set(agents.map((node) => node.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of agents) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
  }
  for (const edge of taskEdges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target]);
  }

  const roots = agents
    .filter((node) => (incoming.get(node.id) || 0) === 0 || node.data.primary)
    .sort(compareNodes);
  const queue = roots.map((node) => ({ id: node.id, depth: 0 }));
  const depthById = new Map<string, number>();
  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    const previous = depthById.get(current.id);
    if (previous !== undefined && previous >= current.depth) continue;
    depthById.set(current.id, current.depth);
    for (const target of outgoing.get(current.id) || []) queue.push({ id: target, depth: current.depth + 1 });
  }

  // Cycles and detached nodes receive deterministic fallback layers.
  for (const node of agents.sort(compareNodes)) {
    if (!depthById.has(node.id)) depthById.set(node.id, node.data.primary ? 0 : 1);
  }

  const layers = new Map<number, Node<TeamNodeData>[]>();
  for (const node of agents) {
    const depth = depthById.get(node.id) || 0;
    layers.set(depth, [...(layers.get(depth) || []), node]);
  }

  const positioned = new Map<string, Node<TeamNodeData>>();
  const layerEntries = [...layers.entries()].sort(([a], [b]) => a - b);
  for (const [depth, layerNodes] of layerEntries) {
    const sorted = [...layerNodes].sort(compareNodes);
    const totalHeight = sorted.reduce((sum, node) => sum + nodeDimensions(node).height, 0)
      + Math.max(0, sorted.length - 1) * 86;
    let y = -totalHeight / 2;
    for (const node of sorted) {
      positioned.set(node.id, { ...node, position: { x: depth * 460, y } });
      y += nodeDimensions(node).height + 86;
    }
  }
  return nodes.map((node) => positioned.get(node.id) || node);
}

function layoutAgentView(
  nodes: Node<TeamNodeData>[],
  edges: Edge<TeamRelation>[],
  selectedAgent?: string,
): Node<TeamNodeData>[] {
  const selectedId = selectedAgent ? `agent:${selectedAgent}` : nodes.find((node) => node.data.kind === "agent")?.id;
  if (!selectedId) return layoutGrid(nodes);

  const selected = nodes.find((node) => node.id === selectedId);
  if (!selected) return layoutGrid(nodes);

  const inboundIds = new Set(
    edges.filter((edge) => edge.data?.kind === "task" && edge.target === selectedId).map((edge) => edge.source),
  );
  const outboundIds = new Set(
    edges.filter((edge) => edge.data?.kind === "task" && edge.source === selectedId).map((edge) => edge.target),
  );

  const inbound = nodes.filter((node) => inboundIds.has(node.id)).sort(compareNodes);
  const outbound = nodes.filter((node) => outboundIds.has(node.id)).sort(compareNodes);
  const skills = nodes.filter((node) => node.data.kind === "skill").sort(compareNodes);
  const capabilities = nodes.filter((node) => node.data.kind === "mcp" || node.data.kind === "tool").sort(compareNodes);
  const models = nodes.filter((node) => node.data.kind === "model").sort(compareNodes);
  const positioned = new Map<string, Node<TeamNodeData>>();

  positioned.set(selected.id, { ...selected, position: { x: 0, y: 0 } });
  placeVertical(positioned, inbound, -520, -((inbound.length - 1) * 220) / 2);
  placeVertical(positioned, outbound, 520, -((outbound.length - 1) * 220) / 2);
  placeHorizontal(positioned, skills, -((skills.length - 1) * 300) / 2, -330);
  placeHorizontal(positioned, capabilities, -((capabilities.length - 1) * 300) / 2, 360);
  placeVertical(positioned, models, 560, -340);

  const remaining = nodes.filter((node) => !positioned.has(node.id)).sort(compareNodes);
  placeHorizontal(positioned, remaining, -((remaining.length - 1) * 300) / 2, 620);
  return nodes.map((node) => positioned.get(node.id) || node);
}

function layoutResourceView(
  nodes: Node<TeamNodeData>[],
  selectedResource?: ResourceSelection,
): Node<TeamNodeData>[] {
  const resourceId = selectedResource
    ? `${selectedResource.kind}:${selectedResource.name}`
    : nodes.find((node) => node.data.kind !== "agent")?.id;
  const resource = nodes.find((node) => node.id === resourceId)
    || nodes.find((node) => node.data.kind !== "agent");
  if (!resource) return layoutGrid(nodes);

  const agents = nodes.filter((node) => node.data.kind === "agent").sort(compareNodes);
  const positioned = new Map<string, Node<TeamNodeData>>();
  if (resource.data.kind === "skill") {
    positioned.set(resource.id, { ...resource, position: { x: 0, y: -280 } });
    placeHorizontal(positioned, agents, -((agents.length - 1) * 370) / 2, 120);
  } else if (resource.data.kind === "mcp" || resource.data.kind === "tool") {
    positioned.set(resource.id, { ...resource, position: { x: 0, y: 300 } });
    placeHorizontal(positioned, agents, -((agents.length - 1) * 370) / 2, -100);
  } else {
    positioned.set(resource.id, { ...resource, position: { x: 520, y: 0 } });
    placeVertical(positioned, agents, 0, -((agents.length - 1) * 220) / 2);
  }
  return nodes.map((node) => positioned.get(node.id) || node);
}

function layoutCompleteView(
  nodes: Node<TeamNodeData>[],
  edges: Edge<TeamRelation>[],
): Node<TeamNodeData>[] {
  const agents = layoutOrganization(nodes.filter((node) => node.data.kind === "agent"), edges);
  const skills = nodes.filter((node) => node.data.kind === "skill").sort(compareNodes);
  const capabilities = nodes.filter((node) => node.data.kind === "mcp" || node.data.kind === "tool").sort(compareNodes);
  const models = nodes.filter((node) => node.data.kind === "model").sort(compareNodes);

  const agentBounds = graphBounds(agents);
  const positioned = new Map(agents.map((node) => [node.id, node]));
  placeHorizontal(positioned, skills, agentBounds.x, agentBounds.y - 300, 300);
  placeHorizontal(positioned, capabilities, agentBounds.x, agentBounds.y + agentBounds.height + 280, 300);
  placeVertical(positioned, models, agentBounds.x + agentBounds.width + 440, agentBounds.y, 160);
  return nodes.map((node) => positioned.get(node.id) || node);
}

function layoutGrid(nodes: Node<TeamNodeData>[]): Node<TeamNodeData>[] {
  const sorted = [...nodes].sort(compareNodes);
  const positioned = new Map<string, Node<TeamNodeData>>();
  sorted.forEach((node, index) => {
    positioned.set(node.id, {
      ...node,
      position: { x: (index % 4) * 360, y: Math.floor(index / 4) * 230 },
    });
  });
  return nodes.map((node) => positioned.get(node.id) || node);
}

function placeHorizontal(
  positioned: Map<string, Node<TeamNodeData>>,
  nodes: Node<TeamNodeData>[],
  startX: number,
  y: number,
  gap = 300,
): void {
  nodes.forEach((node, index) => positioned.set(node.id, { ...node, position: { x: startX + index * gap, y } }));
}

function placeVertical(
  positioned: Map<string, Node<TeamNodeData>>,
  nodes: Node<TeamNodeData>[],
  x: number,
  startY: number,
  gap = 220,
): void {
  nodes.forEach((node, index) => positioned.set(node.id, { ...node, position: { x, y: startY + index * gap } }));
}

function graphBounds(nodes: Node<TeamNodeData>[]): { x: number; y: number; width: number; height: number } {
  if (!nodes.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const rights = nodes.map((node) => node.position.x + nodeDimensions(node).width);
  const bottoms = nodes.map((node) => node.position.y + nodeDimensions(node).height);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...rights) - x, height: Math.max(...bottoms) - y };
}

function compareNodes(a: Node<TeamNodeData>, b: Node<TeamNodeData>): number {
  if (a.data.primary !== b.data.primary) return a.data.primary ? -1 : 1;
  return a.data.label.localeCompare(b.data.label);
}

function findFreePosition(
  position: { x: number; y: number },
  node: Node<TeamNodeData>,
  others: Node<TeamNodeData>[],
): { x: number; y: number } {
  let candidate = { ...position };
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const collides = others.some((other) => rectanglesOverlap({ ...node, position: candidate }, other, 22));
    if (!collides) return candidate;
    const ring = Math.floor(attempt / 8) + 1;
    const angle = (attempt % 8) * (Math.PI / 4);
    candidate = {
      x: position.x + Math.cos(angle) * ring * 48,
      y: position.y + Math.sin(angle) * ring * 48,
    };
  }
  return position;
}

function rectanglesOverlap(a: Node<TeamNodeData>, b: Node<TeamNodeData>, gap: number): boolean {
  const ad = nodeDimensions(a);
  const bd = nodeDimensions(b);
  return !(
    a.position.x + ad.width + gap < b.position.x
    || a.position.x > b.position.x + bd.width + gap
    || a.position.y + ad.height + gap < b.position.y
    || a.position.y > b.position.y + bd.height + gap
  );
}

function numberStyle(value: string | number | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
