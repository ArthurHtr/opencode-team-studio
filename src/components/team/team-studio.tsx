"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  Boxes,
  ChevronDown,
  Focus,
  LayoutDashboard,
  LoaderCircle,
  LocateFixed,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Workflow,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentInspector } from "@/components/team/agent-inspector";

import { NewAgentDialog } from "@/components/team/new-agent-dialog";
import {
  AgentNode,
  McpNode,
  ModelNode,
  SkillNode,
  ToolNode,
} from "@/components/team/nodes";
import { RelationInspector } from "@/components/team/relation-inspector";
import {
  DEFAULT_FILTERS,
  addConnectionRelation,
  applyRelationChoice,
  createTeamGraph,
  parseNodeId,
  reconnectRelation,
  removeAgentFromSnapshot,
  removeRelation,
  renameAgentInSnapshot,
  viewKey,
  type ResourceSelection,
  type TeamView,
} from "@/lib/team/graph";
import { autoLayoutTeamGraph, resolveDraggedCollision } from "@/lib/team/layout";
import type {
  AgentDefinition,
  PermissionChoice,
  StudioLayout,
  TeamNodeData,
  TeamRelation,
  TeamSnapshot,
} from "@/lib/types";

const nodeTypes = {
  agent: AgentNode,
  skill: SkillNode,
  mcp: McpNode,
  tool: ToolNode,
  model: ModelNode,
};

const EMPTY_LAYOUT: StudioLayout = { version: 2, views: {} };

export function TeamStudio({ initial }: { initial: TeamSnapshot }) {
  return (
    <ReactFlowProvider>
      <TeamStudioInner initial={initial} />
    </ReactFlowProvider>
  );
}

function TeamStudioInner({ initial }: { initial: TeamSnapshot }) {
  const [snapshot, setSnapshot] = useState<TeamSnapshot>(initial);
  const [layout, setLayout] = useState<StudioLayout>(initial.layout || EMPTY_LAYOUT);
  const [view, setView] = useState<TeamView>("organization");
  const [selectedAgent, setSelectedAgent] = useState(initial.defaultAgent || initial.agents[0]?.name || "build");
  const [inspectorAgent, setInspectorAgent] = useState<string>();
  const [selectedResource, setSelectedResource] = useState<ResourceSelection>(() => firstResource(initial));
  const [selectedRelation, setSelectedRelation] = useState<TeamRelation>();
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [layingOut, setLayingOut] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TeamNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<TeamRelation>>([]);
  const flow = useReactFlow<Node<TeamNodeData>, Edge<TeamRelation>>();

  const layoutRef = useRef(layout);
  const snapshotRef = useRef(snapshot);
  const nodesRef = useRef(nodes);
  const graphRequestRef = useRef(0);
  const dragStartRef = useRef<{ id: string; positions: Record<string, { x: number; y: number }> } | undefined>(undefined);

  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const selected = inspectorAgent ? snapshot.agents.find((agent) => agent.name === inspectorAgent) : undefined;
  const currentViewKey = viewKey(view, selectedAgent, selectedResource);
  const hasInspector = Boolean(selected || selectedRelation);
  const resourceOptions = useMemo(() => collectResourceOptions(snapshot), [snapshot]);

  const storeViewLayout = useCallback((
    nextNodes: Node<TeamNodeData>[],
    key = currentViewKey,
    viewport = flow.getViewport(),
    markDirty = true,
  ): StudioLayout => {
    const next: StudioLayout = {
      version: 2,
      views: {
        ...layoutRef.current.views,
        [key]: {
          positions: Object.fromEntries(nextNodes.map((node) => [node.id, node.position])),
          viewport,
        },
      },
    };
    layoutRef.current = next;
    setLayout(next);
    if (markDirty) setDirty(true);
    return next;
  }, [currentViewKey, flow]);

  const buildGraph = useCallback(async (options?: { forceLayout?: boolean; fit?: boolean; fitView?: boolean }) => {
    const request = ++graphRequestRef.current;
    setLayingOut(true);
    try {
      const key = viewKey(view, selectedAgent, selectedResource);
      const base = createTeamGraph(snapshotRef.current, view, selectedAgent, selectedResource, DEFAULT_FILTERS);
      const withLayout = await autoLayoutTeamGraph(base.nodes, base.edges, view);
      if (request !== graphRequestRef.current) return;

      const stored = options?.forceLayout ? undefined : layoutRef.current.views[key];
      const restored = stored
        ? withLayout.map((node) => ({
            ...node,
            position: stored.positions[node.id] || node.position,
            deletable: false,
          }))
        : withLayout.map((node) => ({ ...node, deletable: false }));

      setNodes(restored);
      setEdges(base.edges);
      if (!stored || options?.forceLayout) {
        storeViewLayout(restored, key, undefined, false);
      }

      requestAnimationFrame(() => {
        if (options?.fitView) {
          void flow.fitView({ padding: 0.16, duration: 420, maxZoom: 1.12 });
        } else if (stored?.viewport && !options?.forceLayout && !options?.fit) {
          void flow.setViewport(stored.viewport, { duration: 180 });
        } else {
          void flow.fitView({ padding: 0.16, duration: 420, maxZoom: 1.12 });
        }
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      if (request === graphRequestRef.current) setLayingOut(false);
    }
  }, [flow, selectedAgent, selectedResource, setEdges, setNodes, storeViewLayout, view]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void buildGraph({ fitView: true });
    });
    return () => { cancelled = true; };
  }, [buildGraph, snapshot]);

  useEffect(() => {
    if (!flow) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void buildGraph({ fitView: true });
    });
    return () => { cancelled = true; };
  }, [flow, buildGraph]);

  function captureCurrentView(markDirty = false): StudioLayout {
    return storeViewLayout(nodesRef.current, currentViewKey, flow.getViewport(), markDirty);
  }

  function changeView(next: TeamView) {
    captureCurrentView(false);
    setView(next);
    setSelectedRelation(undefined);
  }

  function updateAgent(nextAgent: AgentDefinition, previousName: string) {
    captureCurrentView(false);
    setSnapshot((current) => renameAgentInSnapshot(current, previousName, nextAgent));
    if (nextAgent.name !== previousName) {
      setSelectedAgent(nextAgent.name);
      setInspectorAgent(nextAgent.name);
    }
    markDraft();
  }

  function deleteAgent(name: string) {
    if (!window.confirm(`Supprimer l’agent « ${name} » et toutes les délégations qui le ciblent ?`)) return;
    captureCurrentView(false);
    setSnapshot((current) => removeAgentFromSnapshot(current, name));
    const fallback = snapshot.agents.find((agent) => agent.name !== name && !agent.disable)?.name || "build";
    setSelectedAgent(fallback);
    setInspectorAgent(undefined);
    markDraft();
  }

  function createAgent(agent: AgentDefinition) {
    captureCurrentView(false);
    setSnapshot((current) => ({ ...current, agents: [...current.agents, agent] }));
    setSelectedAgent(agent.name);
    setInspectorAgent(agent.name);
    setView("agent");
    markDraft();
  }

  function updateRelation(relation: TeamRelation, action: PermissionChoice) {
    captureCurrentView(false);
    setSnapshot((current) => applyRelationChoice(current, relation, action));
    setSelectedRelation(action === "inherit" && !relation.inherited ? undefined : { ...relation, action: action === "inherit" ? relation.action : action, inherited: action === "inherit" });
    markDraft();
  }

  function deleteRelation(relation: TeamRelation) {
    const verb = relation.inherited ? "bloquer" : "supprimer";
    if (!window.confirm(`Voulez-vous ${verb} cette connexion ?`)) return;
    captureCurrentView(false);
    setSnapshot((current) => removeRelation(current, relation));
    setSelectedRelation(undefined);
    markDraft();
  }

  function connect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    captureCurrentView(false);
    const result = addConnectionRelation(snapshotRef.current, connection.source, connection.target);
    if (result.error || !result.relation) {
      setError(result.error || "Connexion invalide");
      return;
    }
    setSnapshot(result.snapshot);
    setSelectedRelation(result.relation);
    markDraft();
  }

  function reconnect(oldEdge: Edge<TeamRelation>, connection: Connection) {
    if (!oldEdge.data || !connection.source || !connection.target) return;
    captureCurrentView(false);
    const result = reconnectRelation(snapshotRef.current, oldEdge.data, connection.source, connection.target);
    if (result.error || !result.relation) {
      setError(result.error || "Reconnexion invalide");
      return;
    }
    setSnapshot(result.snapshot);
    setSelectedRelation(result.relation);
    markDraft();
  }

  function deleteEdges(deleted: Edge<TeamRelation>[]) {
    if (!deleted.length) return;
    let next = snapshotRef.current;
    for (const edge of deleted) if (edge.data) next = removeRelation(next, edge.data);
    setSnapshot(next);
    setSelectedRelation(undefined);
    markDraft();
  }

  function nodeDragStart(_: MouseEvent | TouchEvent, node: Node<TeamNodeData>) {
    dragStartRef.current = {
      id: node.id,
      positions: Object.fromEntries(nodesRef.current.map((item) => [item.id, item.position])),
    };
  }

  function nodeDragStop(_: MouseEvent | TouchEvent, moved: Node<TeamNodeData>) {
    const nextNodes = resolveDraggedCollision(nodesRef.current, moved.id);
    dragStartRef.current = undefined;
    setNodes(nextNodes);
    storeViewLayout(nextNodes);
  }

  async function reorganize() {
    const key = currentViewKey;
    setLayingOut(true);
    const next: StudioLayout = { version: 2, views: { ...layoutRef.current.views } };
    delete next.views[key];
    layoutRef.current = next;
    setLayout(next);
    setDirty(true);
    await buildGraph({ forceLayout: true, fit: true });
  }

  function resetView() {
    if (!window.confirm("Réinitialiser uniquement la disposition de cette vue ?")) return;
    void reorganize();
  }

  async function saveTeam() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const nextLayout = captureCurrentView(false);
      const response = await fetch("/api/team/apply", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
          snapshot: { ...snapshotRef.current, layout: nextLayout },
          layout: nextLayout,
          reason: "Sauvegarde de l'équipe depuis OpenCode Team Studio",
        }),
      });
      const result = await response.json() as TeamSnapshot & { error?: string };
      if (!response.ok) throw new Error(result.error || "Sauvegarde impossible");
      snapshotRef.current = result;
      layoutRef.current = result.layout;
      setSnapshot(result);
      setLayout(result.layout);
      setDirty(false);
      setMessage(result.latestBackup
        ? `Configuration appliquée. Backup créé : ${result.latestBackup.path}`
        : "Configuration appliquée à OpenCode.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function reloadFromDisk() {
    if (dirty && !window.confirm("Abandonner les changements non sauvegardés et relire la configuration OpenCode ?")) return;
    setError("");
    try {
      const response = await fetch("/api/team", { cache: "no-store" });
      const result = await response.json() as TeamSnapshot & { error?: string };
      if (!response.ok) throw new Error(result.error || "Rechargement impossible");
      snapshotRef.current = result;
      layoutRef.current = result.layout;
      setSnapshot(result);
      setLayout(result.layout);
      setSelectedAgent(result.defaultAgent || result.agents[0]?.name || "build");
      setInspectorAgent(undefined);
      setSelectedRelation(undefined);
       setDirty(false);
      setMessage("Configuration relue depuis le disque.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function markDraft() {
    setDirty(true);
    setMessage("");
    setError("");
  }

  return (
    <div className={`team-workspace ${hasInspector ? "with-inspector" : ""}`}>
      <section className="canvas-shell">
        <header className="team-toolbar">
         <div className="team-title-block">
            <span className="eyebrow">Cockpit visuel OpenCode</span>
            <h1>Mon équipe d&apos;agents</h1>
            <p>Déplace les membres, relie leurs capacités et configure leur autonomie. Le Studio génère la configuration OpenCode au moment de la sauvegarde.</p>
            <small className="toolbar-credit">Développé par Arthur Hottier</small>
          </div>
          <div className="toolbar-actions">
            <button className="button" type="button" onClick={() => void reloadFromDisk()}><RefreshCw size={15} />Relire</button>
            <button className="button" type="button" onClick={() => void reorganize()} disabled={layingOut}><RotateCcw size={15} />Réinitialiser la disposition</button>
            <button className="button" type="button" onClick={() => setNewAgentOpen(true)}><Plus size={16} />Nouvel agent</button>
            <button className="button primary" type="button" disabled={saving || !dirty} onClick={() => void saveTeam()}>
              {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              {saving ? "Application…" : "Sauvegarder l’équipe"}
            </button>
          </div>
        </header>

        <div className="view-bar">
          <div className="segmented view-switcher" aria-label="Vue du graphe">
            <ViewButton active={view === "organization"} onClick={() => changeView("organization")} icon={<Workflow size={15} />} label="Organisation" />
            <ViewButton active={view === "agent"} onClick={() => changeView("agent")} icon={<Focus size={15} />} label="Agent sélectionné" />
            <ViewButton active={view === "resources"} onClick={() => changeView("resources")} icon={<Boxes size={15} />} label="Ressources" />
            <ViewButton active={view === "complete"} onClick={() => changeView("complete")} icon={<Network size={15} />} label="Vue complète" />
          </div>

          {view === "resources" ? (
            <label className="resource-picker">
              <span>Ressource</span>
              <select
                value={selectedResource ? `${selectedResource.kind}:${selectedResource.name}` : ""}
                onChange={(event) => setSelectedResource(parseResourceValue(event.target.value))}
              >
                {resourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
          ) : null}

 
          <span className={`draft-badge ${dirty ? "dirty" : ""}`}><span />{dirty ? "Modifications non appliquées" : "Synchronisé avec OpenCode"}</span>
        </div>

        {error ? <Banner tone="error" onClose={() => setError("")}>{error}</Banner> : null}
        {message ? <Banner tone="success" onClose={() => setMessage("")}>{message}</Banner> : null}

        <div className="flow-stage">
          <ReactFlow<Node<TeamNodeData>, Edge<TeamRelation>>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={connect}
            onReconnect={reconnect}
            onEdgesDelete={deleteEdges}
            onNodeDragStart={nodeDragStart}
            onNodeDragStop={nodeDragStop}
            onNodeClick={(_, node) => {
               const parsed = parseNodeId(node.id);
               setSelectedRelation(undefined);
               if (parsed.kind === "agent") {
                 setSelectedAgent(parsed.name);
                 setInspectorAgent(parsed.name);
               } else if (parsed.kind === "skill" || parsed.kind === "mcp" || parsed.kind === "tool" || parsed.kind === "model") {
                 setSelectedResource({ kind: parsed.kind, name: parsed.name });
                 setView("resources");
               }
             }}
            onEdgeClick={(_, edge) => {
               if (edge.data) {
                 setSelectedRelation(edge.data);
               }
             }}
             onPaneClick={() => {
               setSelectedRelation(undefined);
             }}
            nodesDraggable
            nodesConnectable
            edgesReconnectable
            elementsSelectable
            deleteKeyCode={["Backspace", "Delete"]}
            selectionKeyCode="Shift"
            multiSelectionKeyCode="Shift"
            minZoom={0.18}
            maxZoom={1.8}
            defaultEdgeOptions={{ type: "bezier" }}
            proOptions={{ hideAttribution: true }}
            fitView
          >
            <Background gap={28} size={1.2} color="#202736" />
            <Controls position="bottom-right" showInteractive={false} />
            <Panel position="top-left" className="canvas-hint">
              <LayoutDashboard size={14} />
              <span>{viewDescription(view)}</span>
            </Panel>
           <Panel position="top-right" className="canvas-actions">
              <button type="button" title="Adapter à l'écran" onClick={() => void flow.fitView({ padding: 0.16, duration: 350, maxZoom: 1.12 })}><LocateFixed size={16} /></button>
              <button type="button" title="Réinitialiser la disposition" onClick={() => void reorganize()}><RotateCcw size={16} /></button>
            </Panel>
 
          </ReactFlow>
          {layingOut ? <div className="canvas-loading"><LoaderCircle className="spin" size={22} /><span>Organisation du graphe…</span></div> : null}
          {!nodes.length && !layingOut ? <div className="canvas-empty"><Network size={34} /><h2>Aucun élément à afficher</h2><p>Crée un agent ou ajuste les filtres de cette vue.</p><button className="button primary" onClick={() => setNewAgentOpen(true)}><Plus size={16} />Créer un agent</button></div> : null}
          <div className="graph-legend" aria-label="Légende des connexions">
            <Legend color="#9b86ff" label="Délégation" />
            <Legend color="#4dd49a" label="Skill" />
            <Legend color="#eea451" label="MCP" />
            <Legend color="#70a8f5" label="Outil" />
            <Legend color="#dc7cdd" label="Modèle" />
            <span className="legend-dashed">Hérité / demande</span>
          </div>

        </div>
      </section>

      {selectedRelation ? (
        <RelationInspector
          key={`${selectedRelation.kind}:${selectedRelation.source}:${selectedRelation.target}`}
          relation={selectedRelation}
          snapshot={snapshot}
          onClose={() => setSelectedRelation(undefined)}
          onChange={(action) => updateRelation(selectedRelation, action)}
          onDelete={() => deleteRelation(selectedRelation)}
        />
      ) : selected ? (
        <AgentInspector
          key={selected.name}
          agent={selected}
          snapshot={snapshot}
          onClose={() => setInspectorAgent(undefined)}
          onChange={updateAgent}
          onDelete={deleteAgent}
        />
      ) : null}

      <NewAgentDialog open={newAgentOpen} existingNames={snapshot.agents.map((agent) => agent.name)} onClose={() => setNewAgentOpen(false)} onCreated={createAgent} />
    </div>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{icon}{label}</button>;
}

function Banner({ tone, onClose, children }: { tone: "error" | "success"; onClose: () => void; children: React.ReactNode }) {
  return <div className={`team-banner ${tone}`}><span>{children}</span><button type="button" onClick={onClose}><X size={14} /></button></div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span><i style={{ background: color }} />{label}</span>;
}

function firstResource(snapshot: TeamSnapshot): ResourceSelection {
  if (snapshot.skills[0]) return { kind: "skill", name: snapshot.skills[0].name };
  if (snapshot.mcps[0]) return { kind: "mcp", name: snapshot.mcps[0].name };
  if (snapshot.defaultModel) return { kind: "model", name: snapshot.defaultModel };
  return { kind: "tool", name: "read" };
}

function collectResourceOptions(snapshot: TeamSnapshot): { value: string; label: string }[] {
  const models = new Set<string>();
  if (snapshot.defaultModel) models.add(snapshot.defaultModel);
  for (const agent of snapshot.agents) if (agent.model) models.add(agent.model);
  return [
    ...snapshot.skills.map((skill) => ({ value: `skill:${skill.name}`, label: `Skill · ${skill.name}` })),
    ...snapshot.mcps.map((mcp) => ({ value: `mcp:${mcp.name}`, label: `MCP · ${mcp.name}` })),
    ...["read", "edit", "bash", "task", "skill", "websearch", "webfetch"].map((tool) => ({ value: `tool:${tool}`, label: `Outil · ${tool}` })),
    ...[...models].map((model) => ({ value: `model:${model}`, label: `Modèle · ${model}` })),
  ];
}

function parseResourceValue(value: string): ResourceSelection {
  const index = value.indexOf(":");
  if (index < 0) return undefined;
  const kind = value.slice(0, index);
  if (kind !== "skill" && kind !== "mcp" && kind !== "tool" && kind !== "model") return undefined;
  return { kind, name: value.slice(index + 1) };
}

function viewDescription(view: TeamView): string {
  if (view === "organization") return "Délégations entre agents";
  if (view === "agent") return "Environnement complet de l’agent";
  if (view === "resources") return "Agents reliés à une ressource";
  return "Cartographie complète de l’équipe";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue";
}
