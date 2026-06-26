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
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(normalized)) { setError("Invalid name"); return; }
    if (existingNames.includes(normalized)) { setError("An agent already has this name"); return; }
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
    <header><div><span>New team member</span><h2>Create an agent</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header>
    <div className="modal-body">
      <label className="field"><span>Technical name<small>lowercase and hyphens recommended</small></span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="ui-reviewer" /></label>
      <label className="field"><span>Human role</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Audits visual consistency and design system…" /></label>
      <div className="two-fields"><label className="field"><span>Position</span><select value={mode} onChange={(event) => setMode(event.target.value as AgentMode)}><option value="subagent">Specialized sub-agent</option><option value="primary">Primary agent</option><option value="all">Both</option></select></label><label className="field"><span>Starting point</span><select value={preset} onChange={(event) => setPreset(event.target.value)}><option value="readonly">Read-only specialist</option><option value="reviewer">Reviewer with web</option><option value="implementer">Controlled implementer</option><option value="orchestrator">Orchestrator</option></select></label></div>
      <div className="preset-help">The agent is added to the draft and the org chart. OpenCode configuration is only written when you click « Save team ».</div>
      {error ? <div className="inline-message error">{error}</div> : null}
    </div>
    <footer><button className="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={!name.trim() || !description.trim()} onClick={create}><Plus size={16} />Create agent</button></footer>
  </div></div>;
}

function presetPermission(preset: string): PermissionConfig {
  if (preset === "implementer") return { edit: "allow", bash: "ask", read: "allow", glob: "allow", grep: "allow", list: "allow", task: { "*": "deny" }, skill: "allow" };
  if (preset === "orchestrator") return { edit: "deny", bash: "ask", read: "allow", glob: "allow", grep: "allow", list: "allow", task: { "*": "deny" }, skill: "allow" };
  if (preset === "reviewer") return { edit: "deny", bash: "ask", read: "allow", glob: "allow", grep: "allow", list: "allow", task: "deny", skill: "allow", webfetch: "allow", websearch: "allow" };
  return { edit: "deny", bash: "ask", read: "allow", glob: "allow", grep: "allow", list: "allow", task: "deny", skill: "allow" };
}

function defaultPrompt(name: string, description: string, preset: string): string {
  const role = description || `Specialized agent ${name}`;
  return `You are ${role}.\n\n## Responsibilities\n\n- Work only within your scope.\n- Support each finding with verifiable elements.\n- Clearly signal uncertainties.\n\n## Working mode\n\n${preset === "orchestrator" ? "- Delegate specialized analyses to authorized sub-agents.\n- Consolidate their results without duplicating findings." : "- Analyze the request before acting.\n- Produce a result directly usable by the calling agent."}\n`;
}
