"use client";

import { Link2, Trash2, X } from "lucide-react";
import { ActionSelect } from "@/components/forms/action-select";
import type { PermissionChoice, TeamRelation, TeamSnapshot } from "@/lib/types";

export function RelationInspector({ relation, snapshot, onClose, onChange, onDelete }: {
  relation: TeamRelation;
  snapshot: TeamSnapshot;
  onClose: () => void;
  onChange: (action: PermissionChoice) => void;
  onDelete: () => void;
}) {
  const source = snapshot.agents.find((agent) => agent.name === relation.source);
  const target = relation.kind === "task" ? snapshot.agents.find((agent) => agent.name === relation.target)?.name : relation.target;
  const inheritedModel = relation.kind === "model" && relation.inherited;
  return <aside className="inspector relation-inspector">
    <header className="inspector-header">
      <div className="inspector-avatar relation-avatar"><Link2 size={20} /></div>
      <div className="inspector-heading"><span>{relationTitle(relation.kind)}</span><h2>{source?.name} <b>→</b> {target}</h2></div>
      <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
    </header>
    <div className="inspector-body">
      <section className="inspector-section">
        <div className="section-intro"><h3>Connection role</h3><p>{relationDescription(relation.kind)}</p></div>
        <div className="relation-summary-card">
          <span>Origin</span>
          <strong>{relation.inherited ? "Inherited from global configuration" : "Defined on the source agent"}</strong>
          <small>{relation.explicit ? "Explicit rule" : "Computed effective rule"}</small>
        </div>
        {relation.kind !== "model" ? <label className="field"><span>Behavior</span><ActionSelect value={relation.inherited ? "inherit" : relation.action} onChange={onChange} /></label> : <div className="relation-summary-card"><span>Effective model</span><strong>{relation.target}</strong><small>{inheritedModel ? "Chosen in global configuration" : "Agent-specific override"}</small></div>}
        <div className="technical-note"><code>{technicalMapping(relation)}</code><span>Automatically generated OpenCode configuration</span></div>
      </section>
    </div>
    <footer className="inspector-footer">
      <div className="inspector-actions">
        <button className="button danger-outline" disabled={inheritedModel} onClick={onDelete}><Trash2 size={15} />{relation.inherited && relation.kind !== "model" ? "Block this connection" : "Delete connection"}</button>
        <button className="button" onClick={onClose}>Close</button>
      </div>
    </footer>
  </aside>;
}

function relationTitle(kind: TeamRelation["kind"]): string {
  return kind === "task" ? "Delegation" : kind === "skill" ? "Skill access" : kind === "mcp" ? "MCP access" : kind === "tool" ? "Tool permission" : "Model";
}
function relationDescription(kind: TeamRelation["kind"]): string {
  return kind === "task" ? "The source agent can invoke the target sub-agent with the task tool."
    : kind === "skill" ? "The skill becomes visible and loadable by this agent."
      : kind === "mcp" ? "The tools exposed by this MCP server become accessible to the agent."
        : kind === "tool" ? "This rule directly controls the use of the native tool."
          : "This connection represents the model effectively used by the agent.";
}
function technicalMapping(relation: TeamRelation): string {
  if (relation.kind === "model") return `agent.${relation.source}.model = ${relation.target}`;
  if (relation.kind === "mcp") return `permission["${relation.target}_*"]`;
  return `permission.${relation.kind}.${relation.target}`;
}
