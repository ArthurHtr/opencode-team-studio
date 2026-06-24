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
    if (!response.ok) setError(result.error || "Enregistrement impossible"); else setMessage("Configuration OpenCode régénérée.");
  }
  function patch(key: string, value: unknown) { const next = { ...config }; if (value === undefined || value === "") delete next[key]; else next[key] = value; setConfig(next); }

  return <div className="content-page"><header className="page-header"><div><span className="eyebrow">Paramètres communs</span><h1>Configuration</h1><p>Configure OpenCode avec des contrôles structurés. Les agents, MCP et modèles restent gérés dans leurs vues dédiées.</p></div><button className="button primary" onClick={save}><Save size={16} />Enregistrer</button></header>
    {error ? <div className="inline-message error">{error}</div> : null}{message ? <div className="inline-message success">{message}</div> : null}
    <div className="configuration-layout"><aside className="settings-nav">{(["general", "server", "runtime", "permissions", "advanced"] as Tab[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}><Settings2 size={16} />{label(item)}</button>)}</aside><main className="settings-content">
      {tab === "general" ? <General config={config} patch={patch} snapshot={snapshot} /> : null}
      {tab === "server" ? <ServerSettings value={record(config.server)} onChange={(value) => patch("server", value)} /> : null}
      {tab === "runtime" ? <RuntimeSettings config={config} patch={patch} /> : null}
      {tab === "permissions" ? <section className="panel"><div className="panel-title"><div><h2>Permissions globales</h2><span>Valeurs héritées par tous les agents</span></div></div><PermissionBuilder permission={record(config.permission) as PermissionConfig} onChange={(value) => patch("permission", value)} /></section> : null}
      {tab === "advanced" ? <Advanced config={config} onChange={setConfig} /> : null}
    </main></div>
  </div>;
}

function General({ config, patch, snapshot }: { config: Record<string, unknown>; patch: (key: string, value: unknown) => void; snapshot: TeamSnapshot }) {
  const modelIds = snapshot.providers.flatMap((provider) => provider.models.map((model) => `${provider.id}/${model.id}`));
  return <div className="stack-lg"><section className="panel"><div className="panel-title"><div><h2>Comportement général</h2><span>Valeurs par défaut du runtime</span></div></div><div className="form-grid two"><Field label="Modèle principal"><input list="config-models" value={string(config.model)} onChange={(event) => patch("model", event.target.value)} /><datalist id="config-models">{modelIds.map((model) => <option key={model} value={model} />)}</datalist></Field><Field label="Petit modèle"><input list="config-models" value={string(config.small_model)} onChange={(event) => patch("small_model", event.target.value)} /></Field><Field label="Agent par défaut"><select value={string(config.default_agent) || "build"} onChange={(event) => patch("default_agent", event.target.value)}>{snapshot.agents.filter((agent) => agent.mode !== "subagent").map((agent) => <option key={agent.name} value={agent.name}>{agent.name}</option>)}</select></Field><Field label="Nom affiché"><input value={string(config.username)} onChange={(event) => patch("username", event.target.value)} /></Field><Field label="Shell"><input value={string(config.shell)} onChange={(event) => patch("shell", event.target.value)} placeholder="/bin/bash" /></Field><Field label="Niveau de logs"><select value={string(config.logLevel) || "INFO"} onChange={(event) => patch("logLevel", event.target.value)}><option>DEBUG</option><option>INFO</option><option>WARN</option><option>ERROR</option></select></Field><Field label="Partage"><select value={string(config.share) || "manual"} onChange={(event) => patch("share", event.target.value)}><option value="manual">Manuel</option><option value="auto">Automatique</option><option value="disabled">Désactivé</option></select></Field><Field label="Mises à jour"><select value={String(config.autoupdate ?? "notify")} onChange={(event) => patch("autoupdate", event.target.value === "true" ? true : event.target.value === "false" ? false : "notify")}><option value="true">Automatiques</option><option value="notify">Notifier</option><option value="false">Désactivées</option></select></Field></div><label className="toggle-line"><input type="checkbox" checked={config.snapshot !== false} onChange={(event) => patch("snapshot", event.target.checked)} /><span><strong>Snapshots du système de fichiers</strong><small>Permet à OpenCode de restaurer les modifications d’une session.</small></span></label></section></div>;
}

function ServerSettings({ value, onChange }: { value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void }) {
  function patch(key: string, item: unknown) { const next = { ...value }; if (item === undefined || item === "") delete next[key]; else next[key] = item; onChange(next); }
  return <section className="panel"><div className="panel-title"><div><h2>Serveur OpenCode</h2><span>opencode serve et opencode web</span></div></div><div className="form-grid two"><Field label="Port"><input type="number" value={number(value.port)} onChange={(event) => patch("port", event.target.value ? Number(event.target.value) : undefined)} /></Field><Field label="Hostname"><input value={string(value.hostname)} onChange={(event) => patch("hostname", event.target.value)} placeholder="127.0.0.1" /></Field><Field label="Domaine mDNS"><input value={string(value.mdnsDomain)} onChange={(event) => patch("mdnsDomain", event.target.value)} /></Field><Field label="Origines CORS" hint="Une par ligne"><textarea rows={4} value={array(value.cors).join("\n")} onChange={(event) => patch("cors", event.target.value.split("\n").filter(Boolean))} /></Field></div><label className="toggle-line"><input type="checkbox" checked={value.mdns === true} onChange={(event) => patch("mdns", event.target.checked)} /><span><strong>Découverte mDNS</strong><small>Publie le serveur sur le réseau local.</small></span></label></section>;
}

function RuntimeSettings({ config, patch }: { config: Record<string, unknown>; patch: (key: string, value: unknown) => void }) {
  return <div className="stack-lg"><TypedObjectEditor title="Compaction du contexte" description="Auto, pruning, tours et réserve de tokens" value={record(config.compaction)} onChange={(value) => patch("compaction", value)} /><TypedObjectEditor title="Limites des sorties d’outils" value={record(config.tool_output)} onChange={(value) => patch("tool_output", value)} /><TypedObjectEditor title="Traitement des pièces jointes" value={record(config.attachment)} onChange={(value) => patch("attachment", value)} /><TypedObjectEditor title="Fonctions expérimentales" description="Ces options peuvent changer entre deux versions" value={record(config.experimental)} onChange={(value) => patch("experimental", value)} /></div>;
}

function Advanced({ config, onChange }: { config: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void }) {
  const other = Object.fromEntries(Object.entries(config).filter(([key]) => !MANAGED.has(key)));
  function apply(next: Record<string, unknown>) { onChange({ ...Object.fromEntries(Object.entries(config).filter(([key]) => MANAGED.has(key))), ...next }); }
  return <div className="stack-lg"><section className="panel"><div className="panel-title"><div><h2>Instructions et plugins</h2><span>Listes structurées</span></div></div><ListEditor title="Instructions additionnelles" value={array(config.instructions)} onChange={(value) => onChange({ ...config, instructions: value })} /><ListEditor title="Plugins npm" value={array(config.plugin).map(String)} onChange={(value) => onChange({ ...config, plugin: value })} /></section><TypedObjectEditor title="Autres paramètres OpenCode" description="Formatter, LSP, références, watcher, enterprise et futures options" value={other} onChange={apply} /></div>;
}

function ListEditor({ title, value, onChange }: { title: string; value: string[]; onChange: (value: string[]) => void }) { return <div className="list-editor"><strong>{title}</strong>{value.map((item, index) => <div key={`${item}-${index}`}><input value={item} onChange={(event) => onChange(value.map((entry, itemIndex) => itemIndex === index ? event.target.value : entry))} /><button className="icon-button danger" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button></div>)}<button className="button subtle" onClick={() => onChange([...value, ""])}><Plus size={14} />Ajouter</button></div>; }
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="field"><span>{label}{hint ? <small>{hint}</small> : null}</span>{children}</label>; }
function label(tab: Tab) { return ({ general: "Général", server: "Serveur", runtime: "Runtime", permissions: "Permissions globales", advanced: "Avancé" } as const)[tab]; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function string(value: unknown) { return value === undefined || value === null ? "" : String(value); }
function number(value: unknown) { return typeof value === "number" ? value : ""; }
function array(value: unknown): string[] { return Array.isArray(value) ? value.map(String) : []; }
