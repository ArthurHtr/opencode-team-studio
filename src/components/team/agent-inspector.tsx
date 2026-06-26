"use client";

import { Bot, CheckCircle2, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PermissionBuilder } from "@/components/forms/permission-builder";
import { TypedObjectEditor } from "@/components/forms/typed-object-editor";
import { evaluatePermission, NATIVE_TOOLS } from "@/lib/team/permissions";
import type {
  AgentDefinition,
  PermissionAction,
  TeamSnapshot,
} from "@/lib/types";

type Tab = "overview" | "identity" | "prompt" | "relations" | "resources" | "permissions" | "model" | "advanced";

export function AgentInspector({ agent, snapshot, onClose, onChange, onDelete }: {
  agent: AgentDefinition;
  snapshot: TeamSnapshot;
  onClose: () => void;
  onChange: (agent: AgentDefinition, previousName: string) => void;
  onDelete: (name: string) => void;
}) {
  const [draft, setDraft] = useState(agent);
  const [tab, setTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");

  const modelIds = useMemo(
    () => snapshot.providers.flatMap((provider) => provider.models.map((model) => `${provider.id}/${model.id}`)),
    [snapshot.providers],
  );

  function commit() {
    onChange(draft, agent.name);
    setMessage("Changes added to the team draft.");
  }

  function remove() {
    if (draft.builtin) return;
    if (!window.confirm(`Remove ${draft.name} from the team? Deletion will be applied on global save.`)) return;
    onDelete(agent.name);
  }

  return (
    <aside className="inspector">
      <header className="inspector-header">
        <div className="inspector-avatar"><Bot size={20} /></div>
        <div className="inspector-heading">
          <span>{draft.mode === "primary" ? "Primary agent" : draft.mode === "all" ? "All-round agent" : "Sub-agent"}</span>
          <h2 title={draft.name}>{draft.name}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </header>
      <nav className="inspector-tabs">
        {(["overview", "identity", "prompt", "relations", "resources", "permissions", "model", "advanced"] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{tabLabel(item)}</button>
        ))}
      </nav>
      <div className="inspector-body">
        {tab === "overview" ? <OverviewTab draft={draft} snapshot={snapshot} /> : null}
        {tab === "identity" ? <IdentityTab draft={draft} setDraft={setDraft} /> : null}
        {tab === "prompt" ? <PromptTab draft={draft} setDraft={setDraft} /> : null}
        {tab === "relations" ? <DelegationTab draft={draft} snapshot={snapshot} /> : null}
        {tab === "resources" ? <ResourcesTab draft={draft} snapshot={snapshot} /> : null}
        {tab === "permissions" ? <PermissionBuilder permission={draft.permission} onChange={(permission) => setDraft({ ...draft, permission })} /> : null}
        {tab === "model" ? <ModelTab draft={draft} setDraft={setDraft} modelIds={modelIds} defaultModel={snapshot.defaultModel} /> : null}
        {tab === "advanced" ? <AdvancedTab draft={draft} setDraft={setDraft} /> : null}
      </div>
      <footer className="inspector-footer">
        {message ? <div className="inline-message success"><CheckCircle2 size={15} />{message}</div> : null}
        <div className="inspector-actions">
          {!draft.builtin ? <button className="button danger-outline" onClick={remove}><Trash2 size={15} />Remove</button> : <span />}
          <button className="button primary" disabled={!draft.name.trim() || !draft.description.trim()} onClick={commit}><Save size={16} />Update</button>
        </div>
      </footer>
    </aside>
  );
}

function OverviewTab({ draft, snapshot }: { draft: AgentDefinition; snapshot: TeamSnapshot }) {
  const callers = snapshot.agents.filter((agent) => agent.name !== draft.name && positive(effective(snapshot, agent, "task", draft.name)));
  const delegates = snapshot.agents.filter((agent) => agent.name !== draft.name && agent.mode !== "primary" && positive(effective(snapshot, draft, "task", agent.name)));
  const skills = snapshot.skills.filter((skill) => positive(effective(snapshot, draft, "skill", skill.name)));
  const mcps = snapshot.mcps.filter((mcp) => positive(effective(snapshot, draft, `${mcp.name}_*`, "*")));
  const tools = NATIVE_TOOLS.filter((tool) => positive(effective(snapshot, draft, tool.id, "*")));
  return (
    <div className="inspector-section">
      <SectionIntro title="Place in the team" text="A human-readable view of its role, delegations, and effective capabilities." />
      <SummaryCard title="Role"><p>{draft.description}</p></SummaryCard>
      <SummaryCard title="Called by"><ChipList empty="No agent can explicitly call it" values={callers.map((item) => item.name)} /></SummaryCard>
      <SummaryCard title="Can delegate to"><ChipList empty="No sub-agents allowed" values={delegates.map((item) => item.name)} /></SummaryCard>
      <SummaryCard title="Knowledge"><ChipList empty="No skills accessible" values={skills.map((item) => item.name)} /></SummaryCard>
      <SummaryCard title="External tools"><ChipList empty="No MCPs accessible" values={mcps.map((item) => item.name)} /></SummaryCard>
      <SummaryCard title="Native capabilities"><ChipList empty="No capabilities calculated" values={tools.map((item) => item.shortLabel)} /></SummaryCard>
    </div>
  );
}

function IdentityTab({ draft, setDraft }: EditorProps) {
  return (
    <div className="inspector-section">
      <SectionIntro title="Identity and role" text="The description helps OpenCode and other agents understand when to delegate to this team member." />
      <Field label="Technical name" hint={draft.builtin ? "Built-in agent" : "File name"}>
        <input disabled={draft.builtin || draft.source === "config"} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </Field>
      <Field label="Description">
        <textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </Field>
      <Field label="Team position">
        <select value={draft.mode} onChange={(event) => setDraft({ ...draft, mode: event.target.value as AgentDefinition["mode"] })}>
          <option value="primary">Primary agent</option>
          <option value="subagent">Specialized sub-agent</option>
          <option value="all">Primary and sub-agent</option>
        </select>
      </Field>
      <div className="two-fields">
        <Field label="Color"><input value={draft.color || ""} placeholder="accent or #8b5cf6" onChange={(event) => setDraft({ ...draft, color: event.target.value || undefined })} /></Field>
        <Field label="Max steps"><input type="number" min={1} value={draft.steps ?? ""} onChange={(event) => setDraft({ ...draft, steps: event.target.value ? Number(event.target.value) : undefined })} /></Field>
      </div>
      <label className="toggle-line"><input type="checkbox" checked={Boolean(draft.hidden)} onChange={(event) => setDraft({ ...draft, hidden: event.target.checked })} /><span><strong>Hide in @</strong><small>Remains callable by other authorized agents.</small></span></label>
      <label className="toggle-line"><input type="checkbox" checked={Boolean(draft.disable)} onChange={(event) => setDraft({ ...draft, disable: event.target.checked })} /><span><strong>Disable this agent</strong><small>Preserves its configuration without making it available.</small></span></label>
    </div>
  );
}

function PromptTab({ draft, setDraft }: EditorProps) {
  const tokens = Math.ceil(draft.prompt.length / 4);
  return (
    <div className="inspector-section">
      <SectionIntro title="Agent instructions" text="The prompt is free-form; all technical parameters are managed elsewhere in the interface." />
      <div className="prompt-stats"><span>{draft.prompt.length} characters</span><span>≈ {tokens} tokens</span></div>
      <textarea className="prompt-editor" value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} spellCheck={false} />
    </div>
  );
}

function ModelTab({ draft, setDraft, modelIds, defaultModel }: EditorProps & { modelIds: string[]; defaultModel?: string }) {
  const inherited = !draft.model;
  return (
    <div className="inspector-section">
      <SectionIntro title="Model and generation" text="Each setting can inherit from global configuration or be overridden for this agent." />
      <label className="inherit-card"><input type="radio" checked={inherited} onChange={() => setDraft({ ...draft, model: undefined, variant: undefined })} /><span><strong>Inherit global model</strong><small className="break-anywhere">{defaultModel || "No global model declared"}</small></span></label>
      <label className="inherit-card"><input type="radio" checked={!inherited} onChange={() => setDraft({ ...draft, model: modelIds[0] || "" })} /><span><strong>Use a specific model</strong><small>The choice is saved on this agent.</small></span></label>
      {!inherited ? <>
        <Field label="Model"><input list="available-models" value={draft.model || ""} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /><datalist id="available-models">{modelIds.map((model) => <option key={model} value={model} />)}</datalist></Field>
        <Field label="Variant"><input value={draft.variant || ""} placeholder="thinking, fast, high…" onChange={(event) => setDraft({ ...draft, variant: event.target.value || undefined })} /></Field>
      </> : null}
      <div className="two-fields">
        <Field label="Temperature" hint="Empty = inherited"><input type="number" step="0.05" min="0" max="2" value={draft.temperature ?? ""} onChange={(event) => setDraft({ ...draft, temperature: event.target.value ? Number(event.target.value) : undefined })} /></Field>
        <Field label="Top P" hint="Empty = inherited"><input type="number" step="0.05" min="0" max="1" value={draft.top_p ?? ""} onChange={(event) => setDraft({ ...draft, top_p: event.target.value ? Number(event.target.value) : undefined })} /></Field>
      </div>
      <TypedObjectEditor title="Model-specific options" description="Typed provider settings, without writing JSON" value={draft.options} onChange={(options) => setDraft({ ...draft, options })} />
    </div>
  );
}

function DelegationTab({ draft, snapshot }: { draft: AgentDefinition; snapshot: TeamSnapshot }) {
  const callers = snapshot.agents
    .filter((agent) => agent.name !== draft.name && positive(effective(snapshot, agent, "task", draft.name)));
  const delegates = snapshot.agents
    .filter((agent) => agent.name !== draft.name && positive(effective(snapshot, draft, "task", agent.name)));

  return (
    <div className="inspector-section">
      <VisualEditingNotice
        title="Delegations in the graph"
        text="Drag an agent from the palette onto the canvas. Then connect the parent agent's « Delegate » port to the sub-agent's « Parent » port."
      />
      <RelationSummary
        title="Can delegate to"
        empty="No active delegations"
        values={delegates.map((agent) => ({ name: agent.name, action: effective(snapshot, draft, "task", agent.name) }))}
      />
      <RelationSummary
        title="Can be called by"
        empty="No active parent agents"
        values={callers.map((agent) => ({ name: agent.name, action: effective(snapshot, agent, "task", draft.name) }))}
      />
      <p className="visual-editing-footnote">Select an edge in the graph to modify or delete its permission.</p>
    </div>
  );
}

function ResourcesTab({ draft, snapshot }: { draft: AgentDefinition; snapshot: TeamSnapshot }) {
  const skills = snapshot.skills
    .map((skill) => ({ name: skill.name, action: effective(snapshot, draft, "skill", skill.name) }))
    .filter((item) => positive(item.action));
  const mcps = snapshot.mcps
    .map((mcp) => ({ name: mcp.name, action: effective(snapshot, draft, `${mcp.name}_*`, "*") }))
    .filter((item) => positive(item.action));

  return (
    <div className="inspector-section">
      <VisualEditingNotice
        title="Skills and MCP in the graph"
        text="Drag boxes from the palette. Connect the agent's top port to a skill and its bottom MCP port to an MCP server. A skill never connects directly to an MCP."
      />
      <RelationSummary title="Accessible skills" empty="No associated skills" values={skills} />
      <RelationSummary title="Accessible MCP servers" empty="No associated MCPs" values={mcps} />
      <p className="visual-editing-footnote">Dropping a box does not modify OpenCode. The relationship is only created when you draw a valid edge.</p>
    </div>
  );
}

function VisualEditingNotice({ title, text }: { title: string; text: string }) {
  return <section className="visual-editing-notice"><strong>{title}</strong><p>{text}</p></section>;
}

function RelationSummary({
  title,
  empty,
  values,
}: {
  title: string;
  empty: string;
  values: { name: string; action?: PermissionAction }[];
}) {
  return (
    <section className="relation-summary-list">
      <header><strong>{title}</strong><span>{values.length}</span></header>
      {values.length ? values.map((value) => (
        <div key={value.name} className={`relation-summary-row action-${value.action || "inherit"}`}>
          <span>{value.name}</span>
          <small>{actionLabel(value.action)}</small>
        </div>
      )) : <p>{empty}</p>}
    </section>
  );
}

function actionLabel(action?: PermissionAction): string {
  if (action === "allow") return "Allowed";
  if (action === "ask") return "Ask";
  if (action === "deny") return "Denied";
  return "Inherited";
}

function AdvancedTab({ draft, setDraft }: EditorProps) {
  return (
    <div className="inspector-section">
      <SectionIntro title="Advanced properties" text="New or specific OpenCode properties are preserved as typed fields." />
      <TypedObjectEditor title="Additional agent settings" value={draft.extra} onChange={(extra) => setDraft({ ...draft, extra })} />
    </div>
  );
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="summary-card"><strong>{title}</strong>{children}</section>;
}
function ChipList({ values, empty }: { values: string[]; empty: string }) {
  return values.length
    ? <div className="chip-list">{values.map((value) => <span key={value}>{value}</span>)}</div>
    : <small className="summary-empty">{empty}</small>;
}
function effective(snapshot: TeamSnapshot, agent: AgentDefinition, key: string, target = "*") {
  return evaluatePermission(agent.permission[key], target)
    || evaluatePermission(snapshot.globalPermission[key], target)
    || evaluatePermission(snapshot.globalPermission["*"], key);
}
function positive(value?: PermissionAction) {
  return value === "allow" || value === "ask";
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}{hint ? <small>{hint}</small> : null}</span>{children}</label>;
}
function SectionIntro({ title, text }: { title: string; text: string }) {
  return <div className="section-intro"><h3>{title}</h3><p>{text}</p></div>;
}
function tabLabel(tab: Tab) {
  return ({
    overview: "Team",
    identity: "Identity",
    prompt: "Prompt",
    relations: "Delegations",
    resources: "Skills & MCP",
    permissions: "Permissions",
    model: "Model",
    advanced: "Advanced",
  } as const)[tab];
}
type EditorProps = { draft: AgentDefinition; setDraft: (agent: AgentDefinition) => void };
