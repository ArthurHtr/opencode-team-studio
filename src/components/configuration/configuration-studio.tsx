"use client";

import { Plus, Save, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { PermissionBuilder } from "@/components/forms/permission-builder";
import { TypedObjectEditor } from "@/components/forms/typed-object-editor";
import type { PermissionConfig, TeamSnapshot } from "@/lib/types";

type Tab = "general" | "server" | "runtime" | "permissions" | "advanced";
const MANAGED = new Set(["$schema", "model", "small_model", "default_agent", "username", "shell", "logLevel", "share", "autoupdate", "snapshot", "server", "permission", "attachment", "tool_output", "compaction", "experimental", "agent", "provider", "mcp"]);

export function ConfigurationStudio({ initialConfig, snapshot }: { initialConfig: Record<string, unknown>; snapshot: TeamSnapshot }) {
  const [config, setConfig] = useState(initialConfig);
  const [tab, setTab] = useState<Tab>("general");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setMessage(""); setError("");
    const response = await fetch("/api/configuration", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Save failed"); else setMessage("OpenCode configuration regenerated.");
  }
  function patch(key: string, value: unknown) { const next = { ...config }; if (value === undefined || value === "") delete next[key]; else next[key] = value; setConfig(next); }

  return <div className="content-page"><header className="page-header"><div><span className="eyebrow">Common settings</span><h1>Configuration</h1><p>Configure OpenCode with structured controls. Agents, MCPs, and models are managed in their dedicated views.</p></div><button className="button primary" onClick={save}><Save size={16} />Save</button></header>
    {error ? <div className="inline-message error">{error}</div> : null}{message ? <div className="inline-message success">{message}</div> : null}
    <div className="configuration-layout"><aside className="settings-nav">{(["general", "server", "runtime", "permissions", "advanced"] as Tab[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}><Settings2 size={16} />{label(item)}</button>)}</aside><main className="settings-content">
      {tab === "general" ? <General config={config} patch={patch} snapshot={snapshot} /> : null}
      {tab === "server" ? <ServerSettings value={record(config.server)} onChange={(value) => patch("server", value)} /> : null}
      {tab === "runtime" ? <RuntimeSettings config={config} patch={patch} /> : null}
      {tab === "permissions" ? <section className="panel"><div className="panel-title"><div><h2>Global permissions</h2><span>Values inherited by all agents</span></div></div><PermissionBuilder permission={record(config.permission) as PermissionConfig} onChange={(value) => patch("permission", value)} /></section> : null}
      {tab === "advanced" ? <Advanced config={config} onChange={setConfig} /> : null}
    </main></div>
  </div>;
}

function General({ config, patch, snapshot }: { config: Record<string, unknown>; patch: (key: string, value: unknown) => void; snapshot: TeamSnapshot }) {
  const modelIds = snapshot.providers.flatMap((provider) => provider.models.map((model) => `${provider.id}/${model.id}`));
  return <div className="stack-lg"><section className="panel"><div className="panel-title"><div><h2>General behavior</h2><span>Runtime default values</span></div></div><div className="form-grid two"><Field label="Main model"><input list="config-models" value={string(config.model)} onChange={(event) => patch("model", event.target.value)} /><datalist id="config-models">{modelIds.map((model) => <option key={model} value={model} />)}</datalist></Field><Field label="Small model"><input list="config-models" value={string(config.small_model)} onChange={(event) => patch("small_model", event.target.value)} /></Field><Field label="Default agent"><select value={string(config.default_agent) || "build"} onChange={(event) => patch("default_agent", event.target.value)}>{snapshot.agents.filter((agent) => agent.mode !== "subagent").map((agent) => <option key={agent.name} value={agent.name}>{agent.name}</option>)}</select></Field><Field label="Display name"><input value={string(config.username)} onChange={(event) => patch("username", event.target.value)} /></Field><Field label="Shell"><input value={string(config.shell)} onChange={(event) => patch("shell", event.target.value)} placeholder="/bin/bash" /></Field><Field label="Log level"><select value={string(config.logLevel) || "INFO"} onChange={(event) => patch("logLevel", event.target.value)}><option>DEBUG</option><option>INFO</option><option>WARN</option><option>ERROR</option></select></Field><Field label="Sharing"><select value={string(config.share) || "manual"} onChange={(event) => patch("share", event.target.value)}><option value="manual">Manual</option><option value="auto">Automatic</option><option value="disabled">Disabled</option></select></Field><Field label="Updates"><select value={String(config.autoupdate ?? "notify")} onChange={(event) => patch("autoupdate", event.target.value === "true" ? true : event.target.value === "false" ? false : "notify")}><option value="true">Automatic</option><option value="false">Disabled</option></select></Field></div></section><section className="panel"><div className="panel-title"><div><h2>Snapshots</h2><span>Session recording</span></div></div><div className="form-grid two"><Field label="Snapshot"><select value={String(config.snapshot ?? "disabled")} onChange={(event) => patch("snapshot", event.target.value === "true" ? true : event.target.value === "false" ? false : "disabled")}><option value="true">Enabled</option><option value="false">Disabled</option></select></Field></div></section></div>;
}

function ServerSettings({ value, onChange }: { value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void }) {
  function patch(key: string, item: unknown) { const next = { ...value }; if (item === undefined || item === "") delete next[key]; else next[key] = item; onChange(next); }
  return <section className="panel"><div className="panel-title"><div><h2>OpenCode server</h2><span>opencode serve and opencode web</span></div></div><div className="form-grid two"><Field label="Port"><input type="number" value={number(value.port)} onChange={(event) => patch("port", event.target.value ? Number(event.target.value) : undefined)} /></Field><Field label="Hostname"><input value={string(value.hostname)} onChange={(event) => patch("hostname", event.target.value)} placeholder="127.0.0.1" /></Field><Field label="mDNS domain"><input value={string(value.mdnsDomain)} onChange={(event) => patch("mdnsDomain", event.target.value)} /></Field><Field label="CORS origins" hint="One per line"><textarea rows={4} value={array(value.cors).join("\n")} onChange={(event) => patch("cors", event.target.value.split("\n").filter(Boolean))} /></Field></div><label className="toggle-line"><input type="checkbox" checked={value.mdns === true} onChange={(event) => patch("mdns", event.target.checked)} /><span><strong>mDNS discovery</strong><small>Publishes the server on the local network.</small></span></label></section>;
}

function RuntimeSettings({ config, patch }: { config: Record<string, unknown>; patch: (key: string, value: unknown) => void }) {
  return <div className="stack-lg"><TypedObjectEditor title="Context compaction" description="Auto, pruning, rounds, and token reserve" value={record(config.compaction)} onChange={(value) => patch("compaction", value)} /><TypedObjectEditor title="Tool output limits" value={record(config.tool_output)} onChange={(value) => patch("tool_output", value)} /><TypedObjectEditor title="Attachment handling" value={record(config.attachment)} onChange={(value) => patch("attachment", value)} /><TypedObjectEditor title="Experimental features" description="These options may change between versions" value={record(config.experimental)} onChange={(value) => patch("experimental", value)} /></div>;
}

function Advanced({ config, onChange }: { config: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void }) {
  const other = Object.fromEntries(Object.entries(config).filter(([key]) => !MANAGED.has(key)));
  function apply(next: Record<string, unknown>) { onChange({ ...Object.fromEntries(Object.entries(config).filter(([key]) => MANAGED.has(key))), ...next }); }
  return <div className="stack-lg"><section className="panel"><div className="panel-title"><div><h2>Instructions and plugins</h2><span>Structured lists</span></div></div><ListEditor title="Additional instructions" value={array(config.instructions)} onChange={(value) => onChange({ ...config, instructions: value })} /><ListEditor title="npm plugins" value={array(config.plugin).map(String)} onChange={(value) => onChange({ ...config, plugin: value })} /></section><TypedObjectEditor title="Other OpenCode settings" description="Formatting, LSP, references, watcher, enterprise, and future options" value={other} onChange={apply} /></div>;
}

function ListEditor({ title, value, onChange }: { title: string; value: string[]; onChange: (value: string[]) => void }) { return <div className="list-editor"><strong>{title}</strong>{value.map((item, index) => <div key={`${item}-${index}`}><input value={item} onChange={(event) => onChange(value.map((entry, itemIndex) => itemIndex === index ? event.target.value : entry))} /><button className="icon-button danger" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button></div>)}<button className="button subtle" onClick={() => onChange([...value, ""])}><Plus size={14} />Add</button></div>; }
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="field"><span>{label}{hint ? <small>{hint}</small> : null}</span>{children}</label>; }
function label(tab: Tab) { return ({ general: "General", server: "Server", runtime: "Runtime", permissions: "Global permissions", advanced: "Advanced" } as const)[tab]; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function string(value: unknown) { return value === undefined || value === null ? "" : String(value); }
function number(value: unknown) { return typeof value === "number" ? value : ""; }
function array(value: unknown): string[] { return Array.isArray(value) ? value.map(String) : []; }
