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
      <button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
    </header>
    <div className="inspector-body">
      <section className="inspector-section">
        <div className="section-intro"><h3>Rôle de la connexion</h3><p>{relationDescription(relation.kind)}</p></div>
        <div className="relation-summary-card">
          <span>Origine</span>
          <strong>{relation.inherited ? "Héritée de la configuration globale" : "Définie sur l’agent source"}</strong>
          <small>{relation.explicit ? "Règle explicite" : "Règle effective calculée"}</small>
        </div>
        {relation.kind !== "model" ? <label className="field"><span>Comportement</span><ActionSelect value={relation.inherited ? "inherit" : relation.action} onChange={onChange} /></label> : <div className="relation-summary-card"><span>Modèle effectif</span><strong>{relation.target}</strong><small>{inheritedModel ? "Choisi dans la configuration globale" : "Surcharge propre à l’agent"}</small></div>}
        <div className="technical-note"><code>{technicalMapping(relation)}</code><span>Configuration OpenCode générée automatiquement</span></div>
      </section>
    </div>
    <footer className="inspector-footer">
      <div className="inspector-actions">
        <button className="button danger-outline" disabled={inheritedModel} onClick={onDelete}><Trash2 size={15} />{relation.inherited && relation.kind !== "model" ? "Bloquer cette connexion" : "Supprimer la connexion"}</button>
        <button className="button" onClick={onClose}>Fermer</button>
      </div>
    </footer>
  </aside>;
}

function relationTitle(kind: TeamRelation["kind"]): string {
  return kind === "task" ? "Délégation" : kind === "skill" ? "Accès à un skill" : kind === "mcp" ? "Accès à un MCP" : kind === "tool" ? "Permission d’outil" : "Modèle";
}
function relationDescription(kind: TeamRelation["kind"]): string {
  return kind === "task" ? "L’agent source peut invoquer le sous-agent cible avec l’outil task."
    : kind === "skill" ? "Le skill devient visible et chargeable par cet agent."
      : kind === "mcp" ? "Les outils exposés par ce serveur MCP deviennent accessibles à l’agent."
        : kind === "tool" ? "Cette règle contrôle directement l’utilisation de l’outil natif."
          : "Cette connexion représente le modèle effectivement utilisé par l’agent.";
}
function technicalMapping(relation: TeamRelation): string {
  if (relation.kind === "model") return `agent.${relation.source}.model = ${relation.target}`;
  if (relation.kind === "mcp") return `permission[\"${relation.target}_*\"]`;
  return `permission.${relation.kind}.${relation.target}`;
}
