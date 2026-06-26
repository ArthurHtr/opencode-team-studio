"use client";

import { Bot, ChevronRight, Cpu, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { TypedObjectEditor } from "@/components/forms/typed-object-editor";
import type { AgentDefinition } from "@/lib/types";

export function ModelsStudio({ initialConfig, agents }: { initialConfig: Record<string, unknown>; agents: AgentDefinition[] }) {
  const [config, setConfig] = useState(initialConfig);
  const providers = isRecord(config.provider) ? config.provider : {};
  const [selected, setSelected] = useState(Object.keys(providers)[0] || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedProvider = selected && isRecord(providers[selected]) ? providers[selected] as Record<string, unknown> : undefined;
  const modelUsage = useMemo(() => Object.fromEntries(agents.map((agent) => [agent.name, agent.model || config.model])), [agents, config.model]);

  async function save() {
    setError(""); setMessage("");
    const response = await fetch("/api/configuration", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Save failed"); else setMessage("Providers and models saved.");
  }
  function setProvider(id: string, value: Record<string, unknown>) { setConfig({ ...config, provider: { ...providers, [id]: value } }); }
  function addProvider() { const id = uniqueName("new-provider", Object.keys(providers)); setConfig({ ...config, provider: { ...providers, [id]: { name: "New provider", options: {}, models: {} } } }); setSelected(id); }
  function removeProvider(id: string) { const next = { ...providers }; delete next[id]; setConfig({ ...config, provider: next }); setSelected(Object.keys(next)[0] || ""); }

  return <div className="content-page"><header className="page-header"><div><span className="eyebrow">Team engines</span><h1>Models</h1><p>Configure providers, models, and variants, then assign them to agents from their panel.</p></div><div className="page-actions"><button className="button" onClick={addProvider}><Plus size={16} />Provider</button><button className="button primary" onClick={save}><Save size={16} />Save</button></div></header>
    {error ? <div className="inline-message error">{error}</div> : null}{message ? <div className="inline-message success">{message}</div> : null}
    <div className="models-layout"><aside className="provider-list"><div className="panel-title"><h2>Providers</h2><span>{Object.keys(providers).length}</span></div>{Object.entries(providers).map(([id, value]) => <button key={id} className={selected === id ? "active" : ""} onClick={() => setSelected(id)}><Cpu size={17} /><span><strong>{isRecord(value) && typeof value.name === "string" ? value.name : id}</strong><small>{id}</small></span><ChevronRight size={15} /></button>)}</aside>
      <main className="provider-editor">{selectedProvider ? <ProviderEditor id={selected} value={selectedProvider} onChange={(value) => setProvider(selected, value)} onDelete={() => removeProvider(selected)} /> : <div className="empty-state large"><Cpu size={28} /><h3>No provider configured</h3><p>Add your local endpoint or a remote provider.</p></div>}</main>
      <aside className="agent-model-usage"><div className="panel-title"><h2>Usage</h2><span>Agents</span></div>{Object.entries(modelUsage).map(([agent, model]) => <div key={agent}><Bot size={15} /><span><strong>{agent}</strong><small>{String(model || "inherited")}</small></span></div>)}</aside>
    </div>
  </div>;
}

function ProviderEditor({ id, value, onChange, onDelete }: { id: string; value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; onDelete: () => void }) {
  const options = isRecord(value.options) ? value.options : {};
  const models = isRecord(value.models) ? value.models : {};
  function patch(key: string, item: unknown) { const next = { ...value }; if (item === undefined || item === "") delete next[key]; else next[key] = item; onChange(next); }
  function setModels(next: Record<string, unknown>) { patch("models", next); }
  function addModel() { const modelId = uniqueName("new-model", Object.keys(models)); setModels({ ...models, [modelId]: { name: "New model", limit: { context: 128000, output: 16000 }, options: {}, variants: {} } }); }
  return <div className="stack-lg"><section className="panel"><div className="panel-title"><div><h2>{typeof value.name === "string" ? value.name : id}</h2><span>{id}</span></div><button className="button danger-outline" onClick={onDelete}><Trash2 size={15} />Delete</button></div><div className="form-grid two"><Field label="Display name"><input value={stringValue(value.name)} onChange={(event) => patch("name", event.target.value)} /></Field><Field label="npm package"><input value={stringValue(value.npm)} onChange={(event) => patch("npm", event.target.value)} placeholder="@ai-sdk/openai-compatible" /></Field><Field label="API"><input value={stringValue(value.api)} onChange={(event) => patch("api", event.target.value)} /></Field><Field label="Environment variables" hint="One per line"><textarea rows={3} value={stringArray(value.env).join("\n")} onChange={(event) => patch("env", event.target.value.split("\n").filter(Boolean))} /></Field></div><TypedObjectEditor title="Provider connection and options" value={options} onChange={(next) => patch("options", next)} /></section>
    <section className="panel"><div className="panel-title"><div><h2>Declared models</h2><span>{Object.keys(models).length} model(s)</span></div><button className="button" onClick={addModel}><Plus size={15} />Add</button></div><div className="model-list">{Object.entries(models).map(([modelId, model]) => <ModelEditor key={modelId} id={modelId} value={isRecord(model) ? model : {}} onRename={(nextId) => { const next = { ...models }; delete next[modelId]; next[nextId] = model; setModels(next); }} onChange={(nextModel) => setModels({ ...models, [modelId]: nextModel })} />)}</div></section>
  </div>;
}

function ModelEditor({ id, value, onRename, onChange }: { id: string; value: Record<string, unknown>; onRename: (id: string) => void; onChange: (value: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const options = isRecord(value.options) ? value.options : {};
  const variants = isRecord(value.variants) ? value.variants : {};
  const limit = isRecord(value.limit) ? value.limit : {};
  function patch(key: string, item: unknown) { const next = { ...value }; if (item === undefined || item === "") delete next[key]; else next[key] = item; onChange(next); }
  return <article className={`model-editor ${open ? "open" : ""}`}><button className="model-editor-head" onClick={() => setOpen(!open)}><Cpu size={17} /><span><strong>{stringValue(value.name) || id}</strong><small>{id} · {stringValue(limit.context) || "?"} context</small></span><ChevronRight size={16} /></button>{open ? <div className="model-editor-body"><div className="form-grid two"><Field label="Identifier"><input defaultValue={id} onBlur={(event) => event.target.value && event.target.value !== id && onRename(event.target.value)} /></Field><Field label="Name"><input value={stringValue(value.name)} onChange={(event) => patch("name", event.target.value)} /></Field><Field label="Family"><input value={stringValue(value.family)} onChange={(event) => patch("family", event.target.value)} /></Field><Field label="Release date"><input value={stringValue(value.release_date)} onChange={(event) => patch("release_date", event.target.value)} /></Field></div><div className="capability-toggles">{["attachment", "reasoning", "temperature", "tool_call", "experimental"].map((key) => <label key={key}><input type="checkbox" checked={value[key] === true} onChange={(event) => patch(key, event.target.checked)} /><span>{capabilityLabel(key)}</span></label>)}</div><div className="form-grid three"><Field label="Context"><input type="number" value={numberValue(limit.context)} onChange={(event) => patch("limit", { ...limit, context: Number(event.target.value) })} /></Field><Field label="Input"><input type="number" value={numberValue(limit.input)} onChange={(event) => patch("limit", { ...limit, input: Number(event.target.value) })} /></Field><Field label="Output"><input type="number" value={numberValue(limit.output)} onChange={(event) => patch("limit", { ...limit, output: Number(event.target.value) })} /></Field></div><TypedObjectEditor title="Model options" value={options} onChange={(next) => patch("options", next)} /><TypedObjectEditor title="Variants" description="Each key must be a unique identifier" value={variants} onChange={(next) => patch("variants", next)} /></div> : null}</article>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="field"><span>{label}{hint ? <small>{hint}</small> : null}</span>{children}</label>; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function stringValue(value: unknown) { return value === undefined || value === null ? "" : String(value); }
function numberValue(value: unknown) { return typeof value === "number" ? value : ""; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.map(String) : []; }
function capabilityLabel(key: string) { return ({ attachment: "Attachments", reasoning: "Reasoning", temperature: "Temperature", tool_call: "Tool calling", experimental: "Experimental" } as Record<string, string>)[key] || key; }
function uniqueName(base: string, used: string[]) { let name = base, index = 2; while (used.includes(name)) name = `${base}-${index++}`; return name; }

