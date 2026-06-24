"use client";

import { Bot, CheckCircle2, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionSelect } from "@/components/forms/action-select";
import { PermissionBuilder } from "@/components/forms/permission-builder";
import { TypedObjectEditor } from "@/components/forms/typed-object-editor";
import { evaluatePermission, NATIVE_TOOLS, setPermissionTarget } from "@/lib/team/permissions";
import type { AgentDefinition, McpDefinition, PermissionAction, PermissionChoice, SkillDefinition, TeamSnapshot } from "@/lib/types";

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

  const modelIds = useMemo(() => snapshot.providers.flatMap((provider) => provider.models.map((model) => `${provider.id}/${model.id}`)), [snapshot.providers]);
  const subagents = snapshot.agents.filter((item) => item.name !== draft.name && item.mode !== "primary");

  function commit() {
    onChange(draft, agent.name);
    setMessage("Modifications ajoutées au brouillon de l'équipe.");
  }

  function remove() {
    if (draft.builtin) return;
    if (!window.confirm(`Retirer ${draft.name} de l'équipe ? La suppression sera appliquée lors de la sauvegarde globale.`)) return;
    onDelete(agent.name);
  }

  return <aside className="inspector">
    <header className="inspector-header"><div className="inspector-avatar"><Bot size={20} /></div><div className="inspector-heading"><span>{draft.mode === "primary" ? "Agent principal" : draft.mode === "all" ? "Agent polyvalent" : "Sous-agent"}</span><h2 title={draft.name}>{draft.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={18} /></button></header>
    <nav className="inspector-tabs">{(["overview", "identity", "prompt", "relations", "resources", "permissions", "model", "advanced"] as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{tabLabel(item)}</button>)}</nav>
    <div className="inspector-body">
      {tab === "overview" ? <OverviewTab draft={draft} snapshot={snapshot} /> : null}
      {tab === "identity" ? <IdentityTab draft={draft} setDraft={setDraft} /> : null}
      {tab === "prompt" ? <PromptTab draft={draft} setDraft={setDraft} /> : null}
      {tab === "relations" ? <DelegationTab draft={draft} setDraft={setDraft} agents={subagents} /> : null}
      {tab === "resources" ? <ResourcesTab draft={draft} setDraft={setDraft} skills={snapshot.skills} mcps={snapshot.mcps} /> : null}
      {tab === "permissions" ? <PermissionBuilder permission={draft.permission} onChange={(permission) => setDraft({ ...draft, permission })} /> : null}
      {tab === "model" ? <ModelTab draft={draft} setDraft={setDraft} modelIds={modelIds} defaultModel={snapshot.defaultModel} /> : null}
      {tab === "advanced" ? <AdvancedTab draft={draft} setDraft={setDraft} /> : null}
    </div>
    <footer className="inspector-footer">
      {message ? <div className="inline-message success"><CheckCircle2 size={15} />{message}</div> : null}
      <div className="inspector-actions">{!draft.builtin ? <button className="button danger-outline" onClick={remove}><Trash2 size={15} />Retirer</button> : <span />}<button className="button primary" disabled={!draft.name.trim() || !draft.description.trim()} onClick={commit}><Save size={16} />Mettre à jour</button></div>
    </footer>
  </aside>;
}

function OverviewTab({ draft, snapshot }: { draft: AgentDefinition; snapshot: TeamSnapshot }) {
  const callers = snapshot.agents.filter((agent) => agent.name !== draft.name && positive(effective(snapshot, agent, "task", draft.name)));
  const delegates = snapshot.agents.filter((agent) => agent.name !== draft.name && agent.mode !== "primary" && positive(effective(snapshot, draft, "task", agent.name)));
  const skills = snapshot.skills.filter((skill) => positive(effective(snapshot, draft, "skill", skill.name)));
  const mcps = snapshot.mcps.filter((mcp) => positive(effective(snapshot, draft, `${mcp.name}_*`, "*")));
  const tools = NATIVE_TOOLS.filter((tool) => positive(effective(snapshot, draft, tool.id, "*")));
  return <div className="inspector-section"><SectionIntro title="Place dans l'équipe" text="Une lecture humaine de son rôle, de ses délégations et de ses capacités effectives." />
    <SummaryCard title="Rôle"><p>{draft.description}</p></SummaryCard>
    <SummaryCard title="Appelé par"><ChipList empty="Aucun agent ne peut explicitement l'appeler" values={callers.map((item) => item.name)} /></SummaryCard>
    <SummaryCard title="Peut déléguer à"><ChipList empty="Aucun sous-agent autorisé" values={delegates.map((item) => item.name)} /></SummaryCard>
    <SummaryCard title="Connaissances"><ChipList empty="Aucun skill accessible" values={skills.map((item) => item.name)} /></SummaryCard>
    <SummaryCard title="Outils externes"><ChipList empty="Aucun MCP accessible" values={mcps.map((item) => item.name)} /></SummaryCard>
    <SummaryCard title="Capacités natives"><ChipList empty="Aucune capacité calculée" values={tools.map((item) => item.shortLabel)} /></SummaryCard>
  </div>;
}

function IdentityTab({ draft, setDraft }: EditorProps) {
  return <div className="inspector-section"><SectionIntro title="Identité et rôle" text="La description aide OpenCode et les autres agents à comprendre quand déléguer à cet équipier." />
    <Field label="Nom technique" hint={draft.builtin ? "Agent intégré" : "Nom du fichier"}><input disabled={draft.builtin || draft.source === "config"} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
    <Field label="Description"><textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
    <Field label="Position dans l'équipe"><select value={draft.mode} onChange={(event) => setDraft({ ...draft, mode: event.target.value as AgentDefinition["mode"] })}><option value="primary">Agent principal</option><option value="subagent">Sous-agent spécialisé</option><option value="all">Principal et sous-agent</option></select></Field>
    <div className="two-fields"><Field label="Couleur"><input value={draft.color || ""} placeholder="accent ou #8b5cf6" onChange={(event) => setDraft({ ...draft, color: event.target.value || undefined })} /></Field><Field label="Étapes maximales"><input type="number" min={1} value={draft.steps ?? ""} onChange={(event) => setDraft({ ...draft, steps: event.target.value ? Number(event.target.value) : undefined })} /></Field></div>
    <label className="toggle-line"><input type="checkbox" checked={Boolean(draft.hidden)} onChange={(event) => setDraft({ ...draft, hidden: event.target.checked })} /><span><strong>Masquer dans @</strong><small>Reste invocable par les autres agents autorisés.</small></span></label>
    <label className="toggle-line"><input type="checkbox" checked={Boolean(draft.disable)} onChange={(event) => setDraft({ ...draft, disable: event.target.checked })} /><span><strong>Désactiver cet agent</strong><small>Conserve sa configuration sans le rendre disponible.</small></span></label>
  </div>;
}

function PromptTab({ draft, setDraft }: EditorProps) {
  const tokens = Math.ceil(draft.prompt.length / 4);
  return <div className="inspector-section"><SectionIntro title="Instructions de l'agent" text="Le prompt reste libre ; tous les paramètres techniques sont gérés ailleurs dans l'interface." />
    <div className="prompt-stats"><span>{draft.prompt.length} caractères</span><span>≈ {tokens} tokens</span></div>
    <textarea className="prompt-editor" value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} spellCheck={false} />
  </div>;
}

function ModelTab({ draft, setDraft, modelIds, defaultModel }: EditorProps & { modelIds: string[]; defaultModel?: string }) {
  const inherited = !draft.model;
  return <div className="inspector-section"><SectionIntro title="Modèle et génération" text="Chaque réglage peut hériter de la configuration globale ou être surchargé pour cet agent." />
    <label className="inherit-card"><input type="radio" checked={inherited} onChange={() => setDraft({ ...draft, model: undefined, variant: undefined })} /><span><strong>Hériter du modèle global</strong><small className="break-anywhere">{defaultModel || "Aucun modèle global déclaré"}</small></span></label>
    <label className="inherit-card"><input type="radio" checked={!inherited} onChange={() => setDraft({ ...draft, model: modelIds[0] || "" })} /><span><strong>Utiliser un modèle spécifique</strong><small>Le choix est enregistré sur cet agent.</small></span></label>
    {draft.model ? <label className="field"><span>Modèle</span><select value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value, variant: undefined })}>{modelIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label> : null}
    {draft.model ? <label className="field"><span>Variante</span><input value={draft.variant || ""} placeholder="Optionnel" onChange={(event) => setDraft({ ...draft, variant: event.target.value || undefined })} /></label> : null}
    <div className="two-fields"><Field label="Température"><input type="number" min={0} max={2} step={0.1} value={draft.temperature ?? ""} onChange={(event) => setDraft({ ...draft, temperature: event.target.value ? Number(event.target.value) : undefined })} /></Field><Field label="Top-p"><input type="number" min={0} max={1} step={0.01} value={draft.top_p ?? ""} onChange={(event) => setDraft({ ...draft, top_p: event.target.value ? Number(event.target.value) : undefined })} /></Field></div>
  </div>;
}

function DelegationTab({ draft, setDraft, agents }: EditorProps & { agents: AgentDefinition[] }) {
  return <div className="inspector-section">
    <h4 className="subsection-title">Sous-agents</h4>
    <div className="relation-list">{agents.map((agent) => <RelationRow key={agent.name} name={agent.name} description={agent.description} value={evaluatePermission(draft.permission.task, agent.name)} onChange={(action) => setDraft({ ...draft, permission: setPermissionTarget(draft.permission, "task", agent.name, action) })} />)}</div>
    <h4 className="subsection-title">Skills</h4><div className="relation-list">{draft.permission.skill && typeof draft.permission.skill === "object" ? Object.keys(draft.permission.skill as Record<string, PermissionAction>).map((skillName) => <RelationRow key={skillName} name={skillName} description="" value={(draft.permission.skill as Record<string, PermissionAction>)[skillName]} onChange={(action) => setDraft({ ...draft, permission: setPermissionTarget(draft.permission, "skill", skillName, action) })} />) : <small className="summary-empty">Aucun skill configuré</small>}</div>
    <h4 className="subsection-title">Serveurs MCP</h4><div className="relation-list">{Object.keys(draft.permission).filter((k) => k.endsWith("_*")).map((mcpKey) => <RelationRow key={mcpKey} name={mcpKey.replace("_*", "")} description="" value={draft.permission[mcpKey as keyof typeof draft.permission] as PermissionAction} onChange={(action) => setDraft({ ...draft, permission: setPermissionTarget(draft.permission, mcpKey, "*", action) })} />)}</div>
  </div>;
}

function ResourcesTab({ draft, setDraft, skills, mcps }: EditorProps & { skills: SkillDefinition[]; mcps: McpDefinition[] }) {
  return <div className="inspector-section">
    <h4 className="subsection-title">Skills disponibles</h4>
    <div className="relation-list">{skills.map((skill) => <RelationRow key={skill.name} name={skill.name} description={skill.description} value={evaluatePermission(draft.permission.skill, skill.name)} onChange={(action) => setDraft({ ...draft, permission: setPermissionTarget(draft.permission, "skill", skill.name, action) })} />)}</div>
    <h4 className="subsection-title">Serveurs MCP</h4><div className="relation-list">{mcps.map((mcp) => <RelationRow key={mcp.name} name={mcp.name} description={mcp.type === "local" ? mcp.command.join(" ") : mcp.url || "Serveur désactivé"} value={evaluatePermission(draft.permission[`${mcp.name}_*`], "*")} onChange={(action) => setDraft({ ...draft, permission: setPermissionTarget(draft.permission, `${mcp.name}_*`, "*", action) })} />)}</div>
  </div>;
}

function AdvancedTab({ draft, setDraft }: EditorProps) {
  return <div className="inspector-section"><SectionIntro title="Propriétés avancées" text="Les propriétés OpenCode nouvelles ou spécifiques sont conservées sous forme de champs typés." /><TypedObjectEditor title="Paramètres additionnels de l'agent" value={draft.extra} onChange={(extra) => setDraft({ ...draft, extra })} /></div>;
}

function RelationRow({ name, description, value, onChange }: { name: string; description: string; value?: PermissionAction; onChange: (action: PermissionChoice) => void }) {
  return <div className="relation-row"><div><strong>{name}</strong> <small>{description}</small></div><ActionSelect compact value={value || "inherit"} onChange={onChange} /></div>;
}



function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className="summary-card"><strong>{title}</strong>{children}</section>; }
function ChipList({ values, empty }: { values: string[]; empty: string }) { return values.length ? <div className="chip-list">{values.map((value) => <span key={value}>{value}</span>)}</div> : <small className="summary-empty">{empty}</small>; }
function effective(snapshot: TeamSnapshot, agent: AgentDefinition, key: string, target = "*") { return evaluatePermission(agent.permission[key], target) || evaluatePermission(snapshot.globalPermission[key], target) || evaluatePermission(snapshot.globalPermission["*"], key); }
function positive(value?: PermissionAction) { return value === "allow" || value === "ask"; }
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="field"><span>{label}{hint ? <small>{hint}</small> : null}</span>{children}</label>; }
function SectionIntro({ title, text }: { title: string; text: string }) { return <div className="section-intro"><h3>{title}</h3><p>{text}</p></div>; }

type EditorProps = { draft: AgentDefinition; setDraft: React.Dispatch<React.SetStateAction<AgentDefinition>> };

function tabLabel(tab: Tab) { return ({ overview: "Équipe", identity: "Identité", prompt: "Prompt", relations: "Délégations", resources: "Skills & MCP", permissions: "Permissions", model: "Modèle", advanced: "Avancé" } as const)[tab]; }
