"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  Boxes,
  Check,
  ChevronDown,
  Filter,
  Focus,
  LoaderCircle,
  LocateFixed,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
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
import { ResourcePalette } from "@/components/team/resource-palette";
import {
  DEFAULT_FILTERS,
  addConnectionRelation,
  applyRelationChoice,
  createEdgeFromRelation,
  createPaletteCanvasNode,
  createTeamGraph,
  isSemanticConnection,
  mergePinnedCanvasNodes,
  nodeId,
  parseNodeId,
  reconnectRelation,
  removeAgentFromSnapshot,
  removeRelation,
  renameAgentInSnapshot,
  viewKey,
  type GraphFilters,
  type ResourceSelection,
  type TeamView,
} from "@/lib/team/graph";
import {
  PALETTE_DRAG_MIME,
  parsePaletteDragPayload,
  type PaletteDragPayload,
} from "@/lib/team/drag-payload";
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

type EditorStatus = "loading" | "ready" | "saving" | "error";

export function TeamStudio({ initial }: { initial: TeamSnapshot }) {
  return (
    <ReactFlowProvider>
      <TeamStudioInner initial={initial} />
    </ReactFlowProvider>
  );
}

function TeamStudioInner({ initial }: { initial: TeamSnapshot }) {
  const [draftSnapshot, setDraftSnapshot] = useState<TeamSnapshot | null>(null);
  const [layout, setLayout] = useState<StudioLayout>(initial.layout || EMPTY_LAYOUT);
  const [view, setView] = useState<TeamView>("organization");
  const [selectedAgent, setSelectedAgent] = useState(initial.defaultAgent || initial.agents[0]?.name || "build");
  const [inspectorAgent, setInspectorAgent] = useState<string>();
  const [selectedResource, setSelectedResource] = useState<ResourceSelection>(() => firstResource(initial));
  const [selectedRelation, setSelectedRelation] = useState<TeamRelation>();
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [status, setStatus] = useState<EditorStatus>("loading");
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
   useEffect(() => { setMounted(true); }, []);
  const [layingOut, setLayingOut] = useState(false);
  const [flowReady, setFlowReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [graphRevision, setGraphRevision] = useState(0);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TeamNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<TeamRelation>>([]);
  const flow = useReactFlow<Node<TeamNodeData>, Edge<TeamRelation>>();

  const nodesInitialized = useNodesInitialized();
  const layoutRef = useRef(layout);
  const draftRef = useRef<TeamSnapshot>(initial);
  const nodesRef = useRef(nodes);
  const graphRequestRef = useRef(0);
  const flowStageRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ id: string; positions: Record<string, { x: number; y: number }> } | undefined>(undefined);
  const initialViewportAppliedRef = useRef(false);

  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { if (draftSnapshot) draftRef.current = draftSnapshot; }, [draftSnapshot]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // beforeunload protection when dirty
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const selected = inspectorAgent ? draftSnapshot?.agents.find((agent) => agent.name === inspectorAgent) : undefined;
  const currentViewKey = viewKey(view, selectedAgent, selectedResource);
  const hasInspector = Boolean(selected || selectedRelation);
  const resourceOptions = useMemo(() => draftSnapshot ? collectResourceOptions(draftSnapshot) : [], [draftSnapshot]);
  const presentNodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);

  const storeViewLayout = useCallback((
    nextNodes: Node<TeamNodeData>[],
    key = currentViewKey,
    viewport = flow.getViewport(),
    markDirty = true,
    pinnedNodeIds?: string[],
  ): StudioLayout => {
    const previous = layoutRef.current.views[key];
    const next: StudioLayout = {
      version: 2,
      views: {
        ...layoutRef.current.views,
        [key]: {
          positions: Object.fromEntries(nextNodes.map((node) => [node.id, node.position])),
          viewport,
          pinnedNodeIds: pinnedNodeIds ?? previous?.pinnedNodeIds ?? [],
        },
      },
    };
    layoutRef.current = next;
    setLayout(next);
    if (markDirty) setDirty(true);
    return next;
  }, [currentViewKey, flow]);

  const buildGraph = useCallback(async (options?: { forceLayout?: boolean; fit?: boolean }) => {
    const request = ++graphRequestRef.current;
    setLayingOut(true);
    try {
      const key = viewKey(view, selectedAgent, selectedResource);
      const viewState = layoutRef.current.views[key];
      const snapshot = draftRef.current;
      if (!snapshot) return;
      const base = createTeamGraph(snapshot, view, selectedAgent, selectedResource, filters);
      const canvasNodes = mergePinnedCanvasNodes(
        snapshot,
        base.nodes,
        viewState?.pinnedNodeIds,
      );
      const withLayout = await autoLayoutTeamGraph(canvasNodes, base.edges, {
        view,
        selectedAgent,
        selectedResource,
      });
      if (request !== graphRequestRef.current) return;

      const stored = options?.forceLayout ? undefined : viewState;
      const restored = withLayout.map((node) => ({
        ...node,
        position: stored?.positions[node.id] || node.position,
        deletable: Boolean(node.data.unlinked),
      }));

      setNodes(restored);
      setEdges(base.edges);
      if (!stored || options?.forceLayout) {
        storeViewLayout(restored, key, undefined, false);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      if (request === graphRequestRef.current) setLayingOut(false);
    }
  }, [filters, selectedAgent, selectedResource, setEdges, setNodes, storeViewLayout, view]);

  // Unified reload function — used for initial load and "Relire" button
  async function reloadFromDisk(options: { silent: boolean; confirmDiscard: boolean }) {
    if (options.confirmDiscard && dirty && !window.confirm("Discard unsaved changes and reload OpenCode configuration?")) return;

    setStatus("loading");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/team", { cache: "no-store" });
      const result = await response.json() as TeamSnapshot & { error?: string };
      if (!response.ok) throw new Error(result.error || "Reload failed");

      setDraftSnapshot(JSON.parse(JSON.stringify(result)));
      draftRef.current = result;
      layoutRef.current = result.layout;
      setLayout(result.layout);
      setSelectedAgent(result.defaultAgent || result.agents[0]?.name || "build");
      setInspectorAgent(undefined);
      setSelectedRelation(undefined);
      setDirty(false);
      initialViewportAppliedRef.current = false;
      setGraphRevision((r) => r + 1);

      setStatus("ready");
      if (!options.silent) {
        setMessage("Configuration reloaded from disk.");
      }
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus("error");
    }
  }

  // Initial load — call reloadFromDisk once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadFromDisk({ silent: true, confirmDiscard: false });
  }, []);

  // Reconstruction effect — depends on graphRevision, NOT on draftSnapshot
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!flowReady || !draftSnapshot) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void buildGraph();
  }, [buildGraph, flowReady, graphRevision, view, selectedAgent, selectedResource, filters]);

  // Viewport effect — waits for nodes to be measured by React Flow
  useEffect(() => {
    if (!flowReady || !nodesInitialized || nodes.length === 0) return;
    if (initialViewportAppliedRef.current) return;

    initialViewportAppliedRef.current = true;

    const stored = layoutRef.current.views[currentViewKey];

    if (stored?.viewport) {
      void flow.setViewport(stored.viewport, { duration: 0 });
    } else {
      void flow.fitView({ padding: 0.16, duration: 0, maxZoom: 1.12 });
    }
  }, [flowReady, nodesInitialized, nodes.length, currentViewKey, flow]);


  function captureCurrentView(markDirty = false): StudioLayout {
    return storeViewLayout(nodesRef.current, currentViewKey, flow.getViewport(), markDirty);
  }

  function changeView(next: TeamView) {
    captureCurrentView(false);
    initialViewportAppliedRef.current = false;
    setView(next);
    setSelectedRelation(undefined);
  }

  function updateAgent(nextAgent: AgentDefinition, previousName: string) {
    if (!draftSnapshot) return;
    captureCurrentView(false);
    setDraftSnapshot(renameAgentInSnapshot(draftSnapshot, previousName, nextAgent));
    if (nextAgent.name !== previousName) {
      setSelectedAgent(nextAgent.name);
      setInspectorAgent(nextAgent.name);
    }
    markDraft();
  }

  function deleteAgent(name: string) {
    if (!window.confirm(`Delete agent « ${name} » and all delegations targeting it?`)) return;
    if (!draftSnapshot) return;
    captureCurrentView(false);
    setDraftSnapshot(removeAgentFromSnapshot(draftSnapshot, name));
    const fallback = draftSnapshot.agents.find((agent) => agent.name !== name && !agent.disable)?.name || "build";
    setSelectedAgent(fallback);
    setInspectorAgent(undefined);
    initialViewportAppliedRef.current = false;
    setGraphRevision((r) => r + 1);
    markDraft();
  }

  function createAgent(agent: AgentDefinition) {
    if (!draftSnapshot) return;
    captureCurrentView(false);
    setDraftSnapshot({ ...draftSnapshot, agents: [...draftSnapshot.agents, agent] });
    setSelectedAgent(agent.name);
    setInspectorAgent(agent.name);
    setView("agent");
    initialViewportAppliedRef.current = false;
    setGraphRevision((r) => r + 1);
    markDraft();
  }


  function updateRelation(relation: TeamRelation, action: PermissionChoice) {
    if (!draftSnapshot) return;
    captureCurrentView(false);
    setDraftSnapshot(applyRelationChoice(draftSnapshot, relation, action));
    setSelectedRelation(action === "inherit" && !relation.inherited ? undefined : { ...relation, action: action === "inherit" ? relation.action : action, inherited: action === "inherit" });
    markDraft();
  }

  function deleteRelation(relation: TeamRelation) {
  const verb = relation.inherited ? "block" : "delete";
   if (!window.confirm(`Do you want to ${verb} this connection?`)) return;
    if (!draftSnapshot) return;
    captureCurrentView(false);
    setDraftSnapshot(removeRelation(draftSnapshot, relation));
    setSelectedRelation(undefined);
    markDraft();
  }

  function connect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    if (!draftSnapshot) return;
    const result = addConnectionRelation(
      draftRef.current,
      connection.source,
      connection.target,
      "allow",
      connection.sourceHandle,
      connection.targetHandle,
    );
    if (result.error || !result.relation) {
       setError(result.error || "Invalid connection");
      return;
    }

    setDraftSnapshot(result.snapshot);
    draftRef.current = result.snapshot;

    const edge = createEdgeFromRelation(result.relation);

    setEdges((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== edge.id);
      return [...withoutDuplicate, edge];
    });

    setNodes((current) =>
      current.map((node) =>
        node.id === connection.target
          ? {
              ...node,
              deletable: false,
              data: { ...node.data, unlinked: false },
            }
          : node,
      ),
    );

    setSelectedRelation(result.relation);
    setDirty(true);
    setMessage("");
    setError("");
  }

  function reconnect(oldEdge: Edge<TeamRelation>, connection: Connection) {
    if (!oldEdge.data || !connection.source || !connection.target) return;
    if (!draftSnapshot) return;
    const result = reconnectRelation(
      draftRef.current,
      oldEdge.data,
      connection.source,
      connection.target,
      connection.sourceHandle,
      connection.targetHandle,
    );
   if (result.error || !result.relation) {
       setError(result.error || "Invalid reconnection");
      return;
    }

    setDraftSnapshot(result.snapshot);
    draftRef.current = result.snapshot;

    const edge = createEdgeFromRelation(result.relation);

    setEdges((current) => {
      const withoutOld = current.filter((item) => item.id !== oldEdge.id);
      const withoutDuplicate = withoutOld.filter((item) => item.id !== edge.id);
      return [...withoutDuplicate, edge];
    });

    setSelectedRelation(result.relation);
    setDirty(true);
    setMessage("");
    setError("");
  }

  function deleteEdges(deleted: Edge<TeamRelation>[]) {
    if (!deleted.length) return;
    if (!draftSnapshot) return;
    let next = draftRef.current;
    for (const edge of deleted) if (edge.data) next = removeRelation(next, edge.data);

    setDraftSnapshot(next);
    draftRef.current = next;
    setSelectedRelation(undefined);

    const deletedIds = new Set(deleted.map((e) => e.id));
    setEdges((current) => current.filter((e) => !deletedIds.has(e.id)));

    setDirty(true);
    setMessage("");
    setError("");
  }

  function addPaletteNode(payload: PaletteDragPayload, position?: { x: number; y: number }) {
    if (!draftSnapshot) return;
    const id = nodeId(payload.kind, payload.id);
    const existing = nodesRef.current.find((node) => node.id === id);
    if (existing) {
      focusPaletteNode(payload);
      setMessage(`« ${payload.id} » is already present in this view.`);
      return;
    }

    const basePosition = position || canvasCenterPosition();
    const offset = nodeOffset(payload.kind);
    const node = createPaletteCanvasNode(draftSnapshot, payload.kind, payload.id, {
      x: basePosition.x - offset.x,
      y: basePosition.y - offset.y,
    });
    if (!node) {
      setError(`Unable to find resource « ${payload.id} ». `);
      return;
    }

    const nextNodes = resolveDraggedCollision([...nodesRef.current, node], node.id);
    const currentPinned = layoutRef.current.views[currentViewKey]?.pinnedNodeIds || [];
    const nextPinned = [...new Set([...currentPinned, node.id])];
    setNodes(nextNodes);
    storeViewLayout(nextNodes, currentViewKey, flow.getViewport(), true, nextPinned);
    setSelectedRelation(undefined);
    setMessage(`« ${payload.id} » has been added to the canvas. Now connect its attachment points.`);
    setError("");
  }

  function dropPaletteNode(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    const raw = event.dataTransfer.getData(PALETTE_DRAG_MIME)
      || event.dataTransfer.getData("text/plain");
    const payload = parsePaletteDragPayload(raw);
    if (!payload) {
      setError("This resource cannot be dropped on the graph.");
      return;
    }
    addPaletteNode(payload, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }

  function focusPaletteNode(payload: PaletteDragPayload) {
    const existing = nodesRef.current.find((node) => node.id === nodeId(payload.kind, payload.id));
    if (!existing) {
      addPaletteNode(payload);
      return;
    }
    const offset = nodeOffset(payload.kind);
    void flow.setCenter(
      existing.position.x + offset.x,
      existing.position.y + offset.y,
      { zoom: Math.max(flow.getZoom(), 0.8), duration: 320 },
    );
  }

  function deleteCanvasNodes(deleted: Node<TeamNodeData>[]) {
    const removableIds = new Set(deleted.filter((node) => node.data.unlinked).map((node) => node.id));
    if (!removableIds.size) return;
    const nextNodes = nodesRef.current.filter((node) => !removableIds.has(node.id));
    const currentPinned = layoutRef.current.views[currentViewKey]?.pinnedNodeIds || [];
    const nextPinned = currentPinned.filter((id) => !removableIds.has(id));
    setNodes(nextNodes);
    storeViewLayout(nextNodes, currentViewKey, flow.getViewport(), true, nextPinned);
    setMessage("The box has been removed from the canvas. The source resource was not deleted.");
  }

  function canvasCenterPosition() {
    const bounds = flowStageRef.current?.getBoundingClientRect();
    if (!bounds) return flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    return flow.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
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
    if (!draftSnapshot) return;
    const key = currentViewKey;
    setLayingOut(true);
    const previous = layoutRef.current.views[key];
    const next: StudioLayout = {
      version: 2,
      views: {
        ...layoutRef.current.views,
        [key]: { positions: {}, pinnedNodeIds: previous?.pinnedNodeIds || [] },
      },
    };
    layoutRef.current = next;
    setLayout(next);
    setDirty(true);
    await buildGraph({ forceLayout: true, fit: true });
  }

  function resetView() {
    if (!window.confirm("Reset only the layout of this view?")) return;
    void reorganize();
  }

  async function saveTeam() {
    if (!draftSnapshot) return;
    setStatus("saving");
    setError("");
    setMessage("");
    try {
      const nextLayout = captureCurrentView(false);
      const response = await fetch("/api/team/apply", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot: { ...draftSnapshot, layout: nextLayout },
          layout: nextLayout,
          metadata: draftSnapshot.metadata,
          reason: "Team save from OpenCode Team Studio",
        }),
      });
      const result = await response.json() as TeamSnapshot & { error?: string };
      if (!response.ok) throw new Error(result.error || "Save failed");

      setDraftSnapshot(JSON.parse(JSON.stringify(result)));
      draftRef.current = result;
      layoutRef.current = result.layout;
      setLayout(result.layout);
      setDirty(false);
      setStatus("ready");
      setMessage(result.latestBackup
        ? `Configuration applied. Backup created: ${result.latestBackup.path}`
        : "Configuration applied to OpenCode.");
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus("error");
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
        <div className="canvas-top">
          <header className="team-toolbar">
            <div className="team-title-block">
            <span className="eyebrow">OpenCode Visual Cockpit</span>
             <h1>My agent team</h1>
             <p>Move members, connect their capabilities, and configure their autonomy. The Studio generates OpenCode configuration when you save.</p>
            </div>
           <div className="toolbar-actions">
          <button className="button" type="button" onClick={() => void reloadFromDisk({ silent: false, confirmDiscard: true })} disabled={mounted && !!(status === "loading" || status === "saving")}><RefreshCw size={15} />Reload</button>
             <button className="button" type="button" onClick={() => void reorganize()} disabled={mounted && !!(layingOut || status === "loading" || status === "saving")}><Sparkles size={15} />Reorganize</button>
             <button className="button" type="button" onClick={() => setNewAgentOpen(true)} disabled={mounted && !!(status === "loading" || status === "saving")}><Plus size={16} />New agent</button>
             <button className="button primary" type="button" disabled={mounted && !!(status === "loading" || status === "saving" || !dirty)} onClick={() => void saveTeam()}>
                 {status === "saving" ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
                 {status === "saving" ? "Applying…" : "Save team"}
              </button>
            </div>
          </header>

          <div className="view-bar">
            <div className="segmented view-switcher" aria-label="Vue du graphe">
            <ViewButton active={view === "organization"} onClick={() => changeView("organization")} icon={<Workflow size={15} />} label="Organization" />
             <ViewButton active={view === "agent"} onClick={() => changeView("agent")} icon={<Focus size={15} />} label="Selected agent" />
             <ViewButton active={view === "resources"} onClick={() => changeView("resources")} icon={<Boxes size={15} />} label="Resources" />
             <ViewButton active={view === "complete"} onClick={() => changeView("complete")} icon={<Network size={15} />} label="Full view" />
            </div>

            {view === "resources" ? (
               <label className="resource-picker">
                 <span>Resource</span>
                <select
                  value={selectedResource ? `${selectedResource.kind}:${selectedResource.name}` : ""}
                  onChange={(event) => setSelectedResource(parseResourceValue(event.target.value))}
                  disabled={status !== "ready"}
                >
                  {resourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <ChevronDown size={14} />
              </label>
            ) : null}

          <button className={`button subtle filter-trigger ${paletteOpen ? "active" : ""}`} type="button" onClick={() => setPaletteOpen((current) => !current)} disabled={mounted && !!(status !== "ready")}>
               <Boxes size={15} />Palette
             </button>
             <button className={`button subtle filter-trigger ${filterOpen ? "active" : ""}`} type="button" onClick={() => setFilterOpen((current) => !current)} disabled={mounted && !!(status !== "ready")}>
               <SlidersHorizontal size={15} />Filters
             </button>
             <span className={`draft-badge ${dirty ? "dirty" : ""}`}><span />{dirty ? "Unapplied changes" : "Synced with OpenCode"}</span>
          </div>

          {error ? <Banner tone="error" onClose={() => setError("")}>{error}<button className="button" style={{ marginLeft: 8 }} onClick={() => void reloadFromDisk({ silent: false, confirmDiscard: false })}>Retry</button></Banner> : null}
          {message ? <Banner tone="success" onClose={() => setMessage("")}>{message}</Banner> : null}
        </div>

        <div ref={flowStageRef} className={`flow-stage ${paletteOpen ? "palette-open" : ""}`}>
          {status === "loading" ? (
            <div className="canvas-loading"><LoaderCircle className="spin" size={22} /><span>Loading configuration…</span></div>
          ) : null}
          {status === "error" ? (
            <div className="canvas-empty"><Network size={34} /><h2>Loading error</h2><p>Unable to read OpenCode configuration.</p><button className="button primary" onClick={() => void reloadFromDisk({ silent: false, confirmDiscard: false })}><RefreshCw size={16} />Retry</button></div>
          ) : null}
          {status === "ready" && paletteOpen ? (
            <ResourcePalette
              snapshot={draftSnapshot!}
              view={view}
              presentNodeIds={presentNodeIds}
              onAdd={addPaletteNode}
              onFocus={focusPaletteNode}
              onClose={() => setPaletteOpen(false)}
            />
          ) : null}
          <ReactFlow<Node<TeamNodeData>, Edge<TeamRelation>>
            nodes={nodes}
            onInit={() => setFlowReady(true)}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={connect}
            isValidConnection={(connection) => isSemanticConnection(
              connection.source,
              connection.target,
              connection.sourceHandle,
              connection.targetHandle,
            )}
            onReconnect={reconnect}
            onEdgesDelete={deleteEdges}
            onNodesDelete={deleteCanvasNodes}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={dropPaletteNode}
            onNodeDragStart={nodeDragStart}
            onNodeDragStop={nodeDragStop}
            onNodeClick={(_, node) => {
              const parsed = parseNodeId(node.id);
              setSelectedRelation(undefined);
              if (parsed.kind === "agent") {
                setSelectedAgent(parsed.name);
                setInspectorAgent(parsed.name);
              } else {
                setInspectorAgent(undefined);
                setSelectedResource({ kind: parsed.kind, name: parsed.name });
                setView("resources");
              }
            }}
            onEdgeClick={(_, edge) => {
              if (edge.data) setSelectedRelation(edge.data);
            }}
            onPaneClick={() => {
              setSelectedRelation(undefined);
            }}
            nodesDraggable={status === "ready"}
            nodesConnectable={status === "ready"}
            edgesReconnectable={status === "ready"}
            elementsSelectable={status === "ready"}
            deleteKeyCode={["Backspace", "Delete"]}
            selectionKeyCode="Shift"
            multiSelectionKeyCode="Shift"
            minZoom={0.18}
            maxZoom={1.8}
            defaultEdgeOptions={{ type: "default" }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={28} size={1.2} color="#202736" />
            <Controls position="bottom-right" showInteractive={false} />
 
            <Panel position="top-right" className="canvas-actions">
               <button type="button" title="Fit to screen" onClick={() => void flow.fitView({ padding: 0.16, duration: 350, maxZoom: 1.12 })} disabled={mounted && !!(status !== "ready")}><LocateFixed size={16} /></button>
               <button type="button" title="Reorganize" onClick={() => void reorganize()} disabled={mounted && !!(status !== "ready")}><Sparkles size={16} /></button>
               <button type="button" title="Reset layout" onClick={resetView} disabled={mounted && !!(status !== "ready")}><RotateCcw size={16} /></button>
             </Panel>
            {filterOpen ? (
              <Panel position="top-right" className="filter-panel">
          <div className="filter-panel-header"><div><Filter size={15} /><strong>Display</strong></div><button type="button" onClick={() => setFilterOpen(false)}><X size={15} /></button></div>
                 <FilterToggle label="Disabled agents" checked={filters.showDisabled} onChange={(value) => setFilters({ ...filters, showDisabled: value })} />
                 <FilterToggle label="Denied connections" checked={filters.showDenied} onChange={(value) => setFilters({ ...filters, showDenied: value })} />
                 <FilterToggle label="Inherited permissions" checked={filters.showInherited} onChange={(value) => setFilters({ ...filters, showInherited: value })} />
                <div className="filter-divider" />
         <FilterToggle label="Skills" checked={filters.showSkills} onChange={(value) => setFilters({ ...filters, showSkills: value })} />
                 <FilterToggle label="MCP" checked={filters.showMcps} onChange={(value) => setFilters({ ...filters, showMcps: value })} />
                 <FilterToggle label="Native tools" checked={filters.showTools} onChange={(value) => setFilters({ ...filters, showTools: value })} />
                 <FilterToggle label="Models" checked={filters.showModels} onChange={(value) => setFilters({ ...filters, showModels: value })} />
              </Panel>
            ) : null}
          </ReactFlow>
 {status === "ready" && layingOut ? <div className="canvas-loading"><LoaderCircle className="spin" size={22} /><span>Organizing graph…</span></div> : null}
  {status === "ready" && !nodes.length && !layingOut ? <div className="canvas-empty"><Network size={34} /><h2>No items to display</h2><p>Create an agent or adjust the filters for this view.</p><button className="button primary" onClick={() => setNewAgentOpen(true)}><Plus size={16} />Create agent</button></div> : null}
          <div className="graph-legend" aria-label="Légende des connexions">
        <Legend color="#9b86ff" label="Delegation" />
             <Legend color="#4dd49a" label="Skill" />
             <Legend color="#eea451" label="MCP" />
             <Legend color="#70a8f5" label="Tool" />
             <Legend color="#dc7cdd" label="Model" />
             <span className="legend-dashed">Inherited / requested</span>
          </div>
        </div>
      </section>

      {selectedRelation ? (
        <RelationInspector
          key={`${selectedRelation.kind}:${selectedRelation.source}:${selectedRelation.target}`}
          relation={selectedRelation}
          snapshot={draftSnapshot!}
          onClose={() => setSelectedRelation(undefined)}
          onChange={(action) => updateRelation(selectedRelation, action)}
          onDelete={() => deleteRelation(selectedRelation)}
        />
      ) : selected ? (
        <AgentInspector
          key={selected.name}
          agent={selected}
          snapshot={draftSnapshot!}
          onClose={() => setInspectorAgent(undefined)}
          onChange={updateAgent}
          onDelete={deleteAgent}
        />
      ) : null}

      <NewAgentDialog open={newAgentOpen} existingNames={draftSnapshot?.agents.map((agent) => agent.name) || []} onClose={() => setNewAgentOpen(false)} onCreated={createAgent} />
    </div>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" className={active ? "active" : ""} onClick={onClick}>{icon}{label}</button>;
}

function FilterToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="filter-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i>{checked ? <Check size={11} /> : null}</i></label>;
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
     ...["read", "edit", "bash", "task", "skill", "websearch", "webfetch"].map((tool) => ({ value: `tool:${tool}`, label: `Tool · ${tool}` })),
     ...[...models].map((model) => ({ value: `model:${model}`, label: `Model · ${model}` })),
  ];
}

function parseResourceValue(value: string): ResourceSelection {
  const index = value.indexOf(":");
  if (index < 0) return undefined;
  const kind = value.slice(0, index);
  if (kind !== "skill" && kind !== "mcp" && kind !== "tool" && kind !== "model") return undefined;
  return { kind, name: value.slice(index + 1) };
}

function nodeOffset(kind: PaletteDragPayload["kind"]): { x: number; y: number } {
  return kind === "agent" ? { x: 160, y: 86 } : { x: 123, y: 54 };
}

function errorMessage(error: unknown): string {
   return error instanceof Error ? error.message : "An unexpected error occurred";
 }
