"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { NATIVE_TOOLS } from "@/lib/team/permissions";
import type { PermissionAction, PermissionConfig, PermissionValue } from "@/lib/types";
import { ActionSelect, type PermissionChoice } from "@/components/forms/action-select";

export function PermissionBuilder({ permission, onChange }: { permission: PermissionConfig; onChange: (value: PermissionConfig) => void }) {
  return <div className="permission-grid">{NATIVE_TOOLS.map((tool) => <PermissionCard key={tool.id} tool={tool} value={permission[tool.id]} onChange={(value) => setKey(tool.id, value)} />)}</div>;
  function setKey(key: string, value: PermissionValue | undefined) {
    const next = { ...permission };
    if (value === undefined) delete next[key]; else next[key] = value;
    onChange(next);
  }
}

function PermissionCard({ tool, value, onChange }: { tool: typeof NATIVE_TOOLS[number]; value?: PermissionValue; onChange: (value?: PermissionValue) => void }) {
  const mode: PermissionChoice | "rules" = value === undefined ? "inherit" : typeof value === "string" ? value : "rules";
  const rules = typeof value === "object" ? Object.entries(value) : [];
  return <article className="permission-card">
    <div className="permission-card-head"><div><strong>{tool.label}</strong><p>{tool.description}</p></div><select value={mode} onChange={(event) => {
      const next = event.target.value as PermissionChoice | "rules";
      if (next === "inherit") onChange(undefined); else if (next === "rules") onChange({ "*": "ask" }); else onChange(next);
    }}><option value="inherit">Hériter</option><option value="allow">Autoriser</option><option value="ask">Demander</option><option value="deny">Refuser</option><option value="rules">Règles détaillées</option></select></div>
    {mode === "rules" ? <div className="rule-list">
      {rules.map(([pattern, action], index) => <div className="rule-row" key={`${pattern}-${index}`}>
        <input value={pattern} placeholder="Motif, ex. git status*" onChange={(event) => updateRule(index, event.target.value, action)} />
        <ActionSelect compact value={action} onChange={(next) => next !== "inherit" && updateRule(index, pattern, next)} />
        <button type="button" className="icon-button" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button>
        <button type="button" className="icon-button" disabled={index === rules.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button>
        <button type="button" className="icon-button danger" onClick={() => replace(rules.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button>
      </div>)}
      <button type="button" className="button subtle" onClick={() => replace([...rules, ["", "ask"]])}><Plus size={14} /> Ajouter une règle</button>
      <small>Les règles sont évaluées de haut en bas ; la dernière règle correspondante gagne.</small>
    </div> : null}
  </article>;

  function replace(next: [string, PermissionAction][]) { onChange(Object.fromEntries(next)); }
  function updateRule(index: number, pattern: string, action: PermissionAction) { replace(rules.map((rule, itemIndex) => itemIndex === index ? [pattern, action] : rule)); }
  function move(index: number, direction: -1 | 1) { const next = [...rules] as [string, PermissionAction][]; const target = index + direction; [next[index], next[target]] = [next[target], next[index]]; replace(next); }
}
