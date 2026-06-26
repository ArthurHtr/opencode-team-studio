"use client";

import {
  Bot,
  Check,
  GripVertical,
  Network,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  PALETTE_DRAG_MIME,
  serializePaletteDragPayload,
  type PaletteDragPayload,
  type PaletteNodeKind,
} from "@/lib/team/drag-payload";
import { nodeId, type TeamView } from "@/lib/team/graph";
import type { TeamSnapshot } from "@/lib/types";

type PaletteItem = PaletteDragPayload & {
  label: string;
  description: string;
  disabled?: boolean;
};

export function ResourcePalette({
  snapshot,
  view,
  presentNodeIds,
  onAdd,
  onFocus,
  onClose,
}: {
  snapshot: TeamSnapshot;
  view: TeamView;
  presentNodeIds: ReadonlySet<string>;
  onAdd: (payload: PaletteDragPayload) => void;
  onFocus: (payload: PaletteDragPayload) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => buildSections(snapshot, view, query), [query, snapshot, view]);

  return (
    <aside className="resource-palette" aria-label="Resource palette">
      <header className="resource-palette-header">
        <div>
          <span>Visual editor</span>
          <h2>Resources</h2>
        </div>
        <button type="button" className="palette-close" onClick={onClose} aria-label="Close palette">
          <X size={16} />
        </button>
      </header>

      <p className="resource-palette-help">
        Drag a box onto the canvas, then connect it to the agent using the corresponding attachment point.
      </p>

      <label className="resource-palette-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for an agent, skill, or MCP…"
          aria-label="Search in palette"
        />
      </label>

      <div className="resource-palette-scroll">
        {sections.map((section) => (
          <PaletteSection
            key={section.kind}
            kind={section.kind}
            title={section.title}
            items={section.items}
            presentNodeIds={presentNodeIds}
            onAdd={onAdd}
            onFocus={onFocus}
          />
        ))}
        {!sections.some((section) => section.items.length) ? (
          <div className="resource-palette-empty">No resources match this search.</div>
        ) : null}
      </div>
    </aside>
  );
}

function PaletteSection({
  kind,
  title,
  items,
  presentNodeIds,
  onAdd,
  onFocus,
}: {
  kind: PaletteNodeKind;
  title: string;
  items: PaletteItem[];
  presentNodeIds: ReadonlySet<string>;
  onAdd: (payload: PaletteDragPayload) => void;
  onFocus: (payload: PaletteDragPayload) => void;
}) {
  if (!items.length) return null;
  return (
    <section className={`palette-section palette-${kind}`}>
      <header>
        <strong>{title}</strong>
        <span>{items.length}</span>
      </header>
      <div className="palette-list">
        {items.map((item) => {
          const payload: PaletteDragPayload = { kind: item.kind, id: item.id };
          const present = presentNodeIds.has(nodeId(item.kind, item.id));
          return (
            <article
              key={`${item.kind}:${item.id}`}
              className={`palette-card ${present ? "present" : ""} ${item.disabled ? "disabled" : ""}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(PALETTE_DRAG_MIME, serializePaletteDragPayload(payload));
                event.dataTransfer.setData("text/plain", serializePaletteDragPayload(payload));
              }}
            >
              <GripVertical className="palette-grip" size={15} aria-hidden />
              <PaletteIcon kind={kind} />
              <div className="palette-card-copy">
                <div>
                  <strong title={item.label}>{item.label}</strong>
                  {present ? <span><Check size={10} />Present</span> : null}
                </div>
                <p>{item.description || "No description"}</p>
              </div>
              <button
                type="button"
                className="palette-add"
                title={present ? "Center in graph" : "Add to canvas"}
                aria-label={present ? `Center ${item.label}` : `Add ${item.label} to canvas`}
                onClick={() => present ? onFocus(payload) : onAdd(payload)}
              >
                {present ? <Check size={14} /> : <Plus size={14} />}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PaletteIcon({ kind }: { kind: PaletteNodeKind }) {
  if (kind === "skill") return <Sparkles className="palette-kind-icon" size={17} />;
  if (kind === "mcp") return <Network className="palette-kind-icon" size={17} />;
  return <Bot className="palette-kind-icon" size={17} />;
}

function buildSections(snapshot: TeamSnapshot, view: TeamView, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  const accepts = (item: PaletteItem) => !normalized
    || item.label.toLocaleLowerCase().includes(normalized)
    || item.description.toLocaleLowerCase().includes(normalized);

  const agents: PaletteItem[] = snapshot.agents.map((agent) => ({
    kind: "agent" as const,
    id: agent.name,
    label: agent.name,
    description: agent.description || (agent.mode === "primary" ? "Primary agent" : "Sub-agent"),
    disabled: agent.disable,
  })).filter(accepts);

  const skills: PaletteItem[] = snapshot.skills.map((skill) => ({
    kind: "skill" as const,
    id: skill.name,
    label: skill.name,
    description: skill.description,
  })).filter(accepts);

  const mcps: PaletteItem[] = snapshot.mcps.map((mcp) => ({
    kind: "mcp" as const,
    id: mcp.name,
    label: mcp.name,
    description: mcp.type === "local"
      ? mcp.command.join(" ") || "Local MCP server"
      : mcp.url || "Remote MCP server",
    disabled: !mcp.enabled || mcp.type === "disabled",
  })).filter(accepts);

  if (view === "organization") {
    return [{ kind: "agent" as const, title: "Agents", items: agents }];
  }

  return [
    { kind: "agent" as const, title: "Agents", items: agents },
    { kind: "skill" as const, title: "Skills", items: skills },
    { kind: "mcp" as const, title: "MCP Servers", items: mcps },
  ];
}
