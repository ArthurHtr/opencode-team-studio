"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { AgentDefinition, AgentMode, PermissionConfig } from "@/lib/types";

export function NewAgentDialog({ open, existingNames, onClose, onCreated }: {
  open: boolean;
  existingNames: string[];
  onClose: () => void;
  onCreated: (agent: AgentDefinition) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<AgentMode>("subagent");
  const [preset, setPreset] = useState("readonly");
  const [error, setError] = useState("");
  if (!open) return null;

  function create() {
    const normalized = name.trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(normalized)) { setError("Nom invalide"); return; }
    if (existingNames.includes(normalized)) { setError("Un agent porte déjà ce nom"); return; }
    const agent: AgentDefinition = {
      name: normalized,
      source: "file",
      builtin: false,
      description: description.trim(),
      mode,
      prompt: defaultPrompt(normalized, description.trim(), preset),
      options: {},
      permission: presetPermission(preset),
      extra: {},
    };
    onCreated(agent);
    setName(""); setDescription(""); setMode("subagent"); setPreset("readonly"); setError(""); onClose();
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><div className="modal-card">
    <header><div><span>Nouvel équipier</span><h2>Créer un agent</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header>
    <div className="modal-body">
      <label className="field"><span>Nom technique<small>minuscules et tirets recommandés</small></span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="ui-reviewer" /></label>
      <label className="field"><span>Rôle humain</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Audite la cohérence visuelle et le design system…" /></label>
      <div className="two-fields"><label className="field"><span>Position</span><select value={mode} onChange={(event) => setMode(event.target.value as AgentMode)}><option value="subagent">Sous-agent spécialisé</option><option value="primary">Agent principal</option><option value="all">Les deux</option></select></label><label className="field"><span>Point de départ</span><select value={preset} onChange={(event) => setPreset(event.target.value)}><option value="readonly">Spécialiste lecture seule</option><option value="reviewer">Reviewer avec web</option><option value="implementer">Implémenteur contrôlé</option><option value="orchestrator">Orchestrateur</option></select></label></div>
      <div className="preset-help">L’agent est ajouté au brouillon et à l’organigramme. La configuration OpenCode n’est écrite qu’au clic sur « Sauvegarder l’équipe ».</div>
      {error ? <div className="inline-message error">{error}</div> : null}
    </div>
    <footer><button className="button" onClick={onClose}>Annuler</button><button className="button primary" disabled={!name.trim() || !description.trim()} onClick={create}><Plus size={16} />Créer l’agent</button></footer>
  </div></div>;
}

function presetPermission(preset: string): PermissionConfig {
  if (preset === "implementer") return { edit: "allow", bash: "ask", read: "allow", glob: "allow", grep: "allow", list: "allow", task: { "*": "deny" }, skill: "allow" };
  if (preset === "orchestrator") return { edit: "deny", bash: "ask", read: "allow", glob: "allow", grep: "allow", list: "allow", task: { "*": "deny" }, skill: "allow" };
  if (preset === "reviewer") return { edit: "deny", bash: "ask", read: "allow", glob: "allow", grep: "allow", list: "allow", task: "deny", skill: "allow", webfetch: "allow", websearch: "allow" };
  return { edit: "deny", bash: "ask", read: "allow", glob: "allow", grep: "allow", list: "allow", task: "deny", skill: "allow" };
}

function defaultPrompt(name: string, description: string, preset: string): string {
  const role = description || `Agent spécialisé ${name}`;
  return `Tu es ${role}.\n\n## Responsabilités\n\n- Travaille uniquement dans ton périmètre.\n- Appuie chaque constat sur des éléments vérifiables.\n- Signale clairement les incertitudes.\n\n## Mode de travail\n\n${preset === "orchestrator" ? "- Délègue les analyses spécialisées aux sous-agents autorisés.\n- Consolide leurs résultats sans dupliquer les constats." : "- Analyse la demande avant d’agir.\n- Produis un résultat directement exploitable par l’agent appelant."}\n`;
}
