"use client";

import { Archive, Check, Clipboard, Copy, Download, History, Pencil, RefreshCw, Trash2, Undo2, Users, Eye, FileText, Eye as EyeIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import type { TeamListItem, StoredTeam, TeamRevision, RevisionPreview } from "@/lib/types";

export function TeamsPage() {
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTeamId, setRenameTeamId] = useState<string>();
  const [renameValue, setRenameValue] = useState("");
  const [revisionsTeamId, setRevisionsTeamId] = useState<string>();
  const [revisions, setRevisions] = useState<TeamRevision[]>([]);
  const [previewRevision, setPreviewRevision] = useState<TeamRevision>();
  const [preview, setPreview] = useState<RevisionPreview | null>(null);
  const [renameRevisionId, setRenameRevisionId] = useState<string>();
  const [renameRevisionLabel, setRenameRevisionLabel] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamMode, setNewTeamMode] = useState<"empty" | "duplicate-active" | "duplicate-team">("empty");
  const [summaryTeamId, setSummaryTeamId] = useState<string>();
  const [summaryMarkdown, setSummaryMarkdown] = useState("");
  const [summaryFilename, setSummaryFilename] = useState("");
  const [summaryBusy, setSummaryBusy] = useState<string>();
  const [summaryTab, setSummaryTab] = useState<"preview" | "raw">("preview");

  async function reload() {
    setBusy("reload"); setError(""); setMessage("");
    try {
      const response = await fetch("/api/teams", { cache: "no-store" });
      const result = await response.json() as TeamListItem[] & { error?: string };
      if (!response.ok) throw new Error(result.error || "Failed to reload teams");
      setTeams(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  useEffect(() => { void (async () => { await reload(); })(); }, []);

  async function handleCreate() {
    if (!newTeamName.trim()) return;
    setBusy("create"); setError(""); setMessage("");
    try {
      const body: { name: string; mode: string; description?: string; sourceTeamId?: string } = {
        name: newTeamName.trim(),
        mode: newTeamMode,
      };
      if (newTeamMode === "duplicate-team") {
        body.sourceTeamId = "active";
      }
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as StoredTeam & { error?: string };
      if (!response.ok) throw new Error(result.error || "Creation failed");
      setNewTeamName("");
      setCreateOpen(false);
      await reload();
      setMessage("Team created.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handleActivate(teamId: string) {
    setBusy(teamId); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/activate`, { method: "POST" });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Activation failed");
      await reload();
      setMessage("Team activated.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handleRename(teamId: string) {
    if (!renameValue.trim()) return;
    setBusy(teamId); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Rename failed");
      setRenameTeamId(undefined);
      await reload();
      setMessage("Team renamed.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handleDelete(teamId: string) {
    if (!window.confirm("Permanently delete this team?")) return;
    setBusy(teamId); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}`, { method: "DELETE" });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Delete failed");
      await reload();
      setMessage("Team deleted.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handleDuplicate(teamId: string) {
    const name = prompt("Name of the duplicated team:");
    if (!name?.trim()) return;
    setBusy(teamId); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const result = await response.json() as StoredTeam & { error?: string };
      if (!response.ok) throw new Error(result.error || "Duplication failed");
      await reload();
      setMessage("Team duplicated.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function openRevisions(teamId: string) {
    setRevisionsTeamId(teamId);
    setBusy("revs"); setError("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/revisions`);
      const result = await response.json() as TeamRevision[] & { error?: string };
      if (!response.ok) throw new Error(result.error || "Failed to reload revisions");
      setRevisions(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handleRestoreRevision(revisionId: string) {
    if (!revisionsTeamId) return;
    if (!window.confirm("Restore this version? The current state will be saved automatically.")) return;
    setBusy("restore"); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(revisionsTeamId)}/revisions/${encodeURIComponent(revisionId)}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Restore from My Teams" }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Restore failed");
      setRevisionsTeamId(undefined);
      setRevisions([]);
      await reload();
      setMessage("Version restored.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handleDeleteRevision(revisionId: string) {
    if (!revisionsTeamId) return;
    if (!window.confirm("Permanently delete this version?")) return;
    setBusy("delrev"); setError("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(revisionsTeamId)}/revisions/${encodeURIComponent(revisionId)}`, {
        method: "DELETE",
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Delete failed");
      setRevisions((prev) => prev.filter((r) => r.id !== revisionId));
      setMessage("Version deleted.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handlePreviewRevision(revisionId: string) {
    setBusy("preview"); setError("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(revisionsTeamId!)}/revisions/${encodeURIComponent(revisionId)}/preview`);
      const result = await response.json() as RevisionPreview & { error?: string };
      if (!response.ok) throw new Error(result.error || "Preview failed");
      setPreview(result);
      setPreviewRevision(await getRevisionDetail(revisionId));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function getRevisionDetail(revisionId: string): Promise<TeamRevision> {
    const response = await fetch(`/api/teams/${encodeURIComponent(revisionsTeamId!)}/revisions/${encodeURIComponent(revisionId)}`);
    return response.json() as Promise<TeamRevision>;
  }

  async function handleRenameRevision(revisionId: string) {
    if (!renameRevisionLabel.trim()) return;
    setBusy("renameRev"); setError("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(revisionsTeamId!)}/revisions/${encodeURIComponent(revisionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: renameRevisionLabel.trim() }),
      });
      const result = await response.json() as TeamRevision & { error?: string };
      if (!response.ok) throw new Error(result.error || "Rename failed");
      setRenameRevisionId(undefined);
      const revResponse = await fetch(`/api/teams/${encodeURIComponent(revisionsTeamId!)}/revisions`);
      setRevisions(await revResponse.json() as TeamRevision[]);
      setMessage("Version renamed.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function fetchSummary(teamId: string) {
    setSummaryBusy(teamId); setError(""); setMessage(""); setSummaryTab("preview");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/summary`);
      const result = await response.json() as { teamId: string; teamName: string; markdown: string; filename: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Summary generation failed");
      setSummaryTeamId(teamId);
      setSummaryMarkdown(result.markdown);
      setSummaryFilename(result.filename);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setSummaryBusy(undefined); }
  }

  async function handleCopySummary() {
    try {
      await navigator.clipboard.writeText(summaryMarkdown);
      setMessage("Team summary copied to clipboard.");
      setSummaryTeamId(undefined);
      setSummaryMarkdown("");
      setSummaryFilename("");
      setSummaryTab("preview");
    } catch {
      setError("Unable to copy the team summary.");
    }
  }

  function handleDownloadSummary() {
    const blob = new Blob([summaryMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = summaryFilename || "team-summary.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage("Team summary downloaded.");
    setSummaryTeamId(undefined);
    setSummaryMarkdown("");
    setSummaryFilename("");
    setSummaryTab("preview");
  }

  const autoCount = revisions.filter((r) => r.kind === "automatic").length;
  const manualCount = revisions.filter((r) => r.kind === "manual").length;

  return <div className="content-page">
    <PageHeader title="My Teams" description="Manage your agent teams. Each team has its own configuration, agents, and graph." actions={
      <><button className="button" onClick={() => void reload()} disabled={Boolean(busy)}><RefreshCw size={15} />Refresh</button>
      <button className="button primary" onClick={() => setCreateOpen(true)} disabled={Boolean(busy)}><Users size={15} />Create a team</button></>
    } />
    {error ? <div className="inline-message error">{error}</div> : null}
    {message ? <div className="inline-message success">{message}</div> : null}

    {createOpen ?    <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create a new team</h3>
        <label>
          <span>Name</span>
          <input type="text" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team name" />
        </label>
        <label>
          <span>Mode</span>
          <select value={newTeamMode} onChange={(e) => setNewTeamMode(e.target.value as "empty" | "duplicate-active" | "duplicate-team")}>
            <option value="empty">Empty (copy of current runtime)</option>
            <option value="duplicate-active">Duplicate active team</option>
          </select>
        </label>
        <div className="modal-actions">
          <button className="button" onClick={() => setCreateOpen(false)}>Cancel</button>
          <button className="button primary" onClick={() => void handleCreate()} disabled={Boolean(busy) || !newTeamName.trim()}>Create</button>
        </div>
      </div>
    </div> : null}

    {revisionsTeamId ? <div className="modal-overlay" onClick={() => { setRevisionsTeamId(undefined); setRevisions([]); setPreview(null); setPreviewRevision(undefined); }}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h3>Versions</h3>
        <div className="revision-counts">
          <span>{autoCount} automatic{autoCount !== 1 ? "s" : ""}</span>
          <span>{manualCount} saved{manualCount !== 1 ? "s" : ""}</span>
        </div>
        {revisions.length === 0 ? <p>No saved versions.</p> : null}
        {revisions.map((rev) => <div key={rev.id} className="revision-item">
          <div className="revision-info">
            <span>{formatDate(rev.createdAt)}</span>
            {rev.kind === "manual" ? <span className="revision-badge manual">Saved</span> : <span className="revision-badge automatic">{rev.reason}</span>}
            {rev.label ? <strong>{rev.label}</strong> : null}
            {rev.description ? <small>{rev.description}</small> : null}
            {rev.agentCount !== undefined ? <small>· {rev.agentCount} agent{rev.agentCount !== 1 ? "s" : ""}</small> : null}
          </div>
          <div className="revision-actions">
            <button className="icon-button" title="Preview" onClick={() => void handlePreviewRevision(rev.id)} disabled={Boolean(busy)}><Eye size={14} /></button>
            <button className="icon-button" title="Restore" onClick={() => void handleRestoreRevision(rev.id)} disabled={Boolean(busy)}><Undo2 size={14} /></button>
            {rev.kind === "manual" && renameRevisionId === rev.id ? (
              <div className="rename-inline">
                <input className="rename-input" value={renameRevisionLabel} onChange={(e) => setRenameRevisionLabel(e.target.value)} onBlur={() => handleRenameRevision(rev.id)} onKeyDown={(e) => { if (e.key === "Enter") handleRenameRevision(rev.id); if (e.key === "Escape") setRenameRevisionId(undefined); }} autoFocus placeholder="New name" />
                <button className="icon-button small" title="Confirm" onClick={() => handleRenameRevision(rev.id)}><Pencil size={12} /></button>
              </div>
            ) : rev.kind === "manual" ? (
              <button className="icon-button" title="Rename" onClick={() => { setRenameRevisionId(rev.id); setRenameRevisionLabel(rev.label || ""); }}><Pencil size={14} /></button>
            ) : null}
            <button className="icon-button danger" title="Delete" onClick={() => void handleDeleteRevision(rev.id)} disabled={Boolean(busy)}><Trash2 size={14} /></button>
          </div>
        </div>)}
        <div className="modal-actions">
          <button className="button" onClick={() => { setRevisionsTeamId(undefined); setRevisions([]); setPreview(null); setPreviewRevision(undefined); }}>Close</button>
        </div>
      </div>
    </div> : null}

    {preview && previewRevision ? <div className="modal-overlay" onClick={() => { setPreview(null); setPreviewRevision(undefined); }}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h3>Version Preview</h3>
        <div className="preview-table">
          <div className="preview-row"><span className="preview-label">Agents</span><span>{preview.currentAgentCount}</span><span>→</span><span>{preview.selectedAgentCount}</span></div>
          <div className="preview-row"><span className="preview-label">Format</span><span>{preview.currentFormat}</span><span>→</span><span>{preview.selectedFormat}</span></div>
          <div className="preview-row"><span className="preview-label">Default Agent</span><span>{preview.currentDefaultAgent}</span><span>→</span><span>{preview.selectedDefaultAgent}</span></div>
          <div className="preview-row"><span className="preview-label">MCP</span><span>{preview.currentMcpCount}</span><span>→</span><span>{preview.selectedMcpCount}</span></div>
        </div>
        {preview.addedAgents.length > 0 ? <div className="preview-section"><strong>Added</strong>{preview.addedAgents.map((a) => <div key={a} className="preview-added">+ {a}</div>)}</div> : null}
        {preview.removedAgents.length > 0 ? <div className="preview-section"><strong>Removed</strong>{preview.removedAgents.map((a) => <div key={a} className="preview-removed">- {a}</div>)}</div> : null}
        {preview.modifiedAgents.length > 0 ? <div className="preview-section"><strong>Modified</strong>{preview.modifiedAgents.map((a) => <div key={a} className="preview-modified">~ {a}</div>)}</div> : null}
        <div className="modal-actions">
          <button className="button" onClick={() => { setPreview(null); setPreviewRevision(undefined); }}>Close</button>
        </div>
      </div>
    </div> : null}

    {summaryTeamId ? <div className="summary-drawer-backdrop" onClick={() => { setSummaryTeamId(undefined); setSummaryMarkdown(""); setSummaryFilename(""); setSummaryTab("preview"); }}>
      <div className="summary-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="summary-drawer-header">
          <div>
            <h3>Team Summary</h3>
            <span className="summary-drawer-subtitle">Markdown summary of this team configuration</span>
          </div>
          <button className="summary-drawer-close" onClick={() => { setSummaryTeamId(undefined); setSummaryMarkdown(""); setSummaryFilename(""); setSummaryTab("preview"); }} type="button" aria-label="Close summary"><span aria-hidden="true">×</span></button>
        </div>
        {summaryBusy === summaryTeamId ? (
          <div className="summary-drawer-body summary-drawer-loading"><div className="spinner" /><span>Loading summary...</span></div>
        ) : (
          <>
            <div className="summary-drawer-tabs">
              <button className={`tab-btn ${summaryTab === "preview" ? "active" : ""}`} onClick={() => setSummaryTab("preview")} type="button"><EyeIcon size={13} /> Preview</button>
              <button className={`tab-btn ${summaryTab === "raw" ? "active" : ""}`} onClick={() => setSummaryTab("raw")} type="button"><FileText size={13} /> Raw Markdown</button>
            </div>
            <div className="summary-drawer-body">
              {summaryTab === "preview" ? (
                <div className="summary-drawer-preview" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(summaryMarkdown) }} />
              ) : (
                <pre className="summary-drawer-raw">{summaryMarkdown}</pre>
              )}
            </div>
            <div className="summary-drawer-footer">
              <button className="button" onClick={handleCopySummary} disabled={!summaryMarkdown || summaryBusy === summaryTeamId}><Clipboard size={14} />Copy Markdown</button>
              <button className="button primary" onClick={handleDownloadSummary} disabled={!summaryMarkdown || summaryBusy === summaryTeamId}><Download size={14} />Download .md</button>
            </div>
          </>
        )}
      </div>
    </div> : null}

    {!teams.length ? <div className="empty-state large"><Users size={32} /><h3>No teams</h3><p>Create your first team to get started.</p></div> : <div className="team-list">{teams.map((team) => <article key={team.id} className={`team-card ${team.active ? "active" : ""}`}>
      <div className="team-info">
        <div className="team-name-row">
          {renameTeamId === team.id ? (
            <input className="team-name-input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={() => handleRename(team.id)} onKeyDown={(e) => { if (e.key === "Enter") handleRename(team.id); if (e.key === "Escape") setRenameTeamId(undefined); }} autoFocus />
          ) : (
            <strong onClick={() => { setRenameTeamId(team.id); setRenameValue(team.name); }}>{team.name}</strong>
          )}
          {team.active ? <span className="active-badge">Active</span> : null}
        </div>
        <small>{formatDate(team.updatedAt)} · {team.revisionCount} version{team.revisionCount !== 1 ? "s" : ""}</small>
      </div>
      <div className="team-actions">
        <button className="icon-button" title="Summary" onClick={() => void fetchSummary(team.id)} disabled={Boolean(summaryBusy)}><Clipboard size={14} /></button>
        {team.active ? (
          <button className="button" onClick={() => { window.location.href = "/team"; }}><Archive size={14} />Edit</button>
        ) : (
          <><button className="button" onClick={() => void handleActivate(team.id)} disabled={Boolean(busy)}><Check size={14} />Activate</button>
          <button className="icon-button" title="Duplicate" onClick={() => void handleDuplicate(team.id)}><Copy size={14} /></button>
          <button className="icon-button" title="Rename" onClick={() => { setRenameTeamId(team.id); setRenameValue(team.name); }}><Pencil size={14} /></button>
          <button className="icon-button" title="Versions" onClick={() => void openRevisions(team.id)}><History size={14} /></button>
          <button className="icon-button danger" title="Delete" onClick={() => void handleDelete(team.id)} disabled={Boolean(busy)}><Trash2 size={14} /></button></>
        )}
      </div>
    </article>)}</div>}
  </div>;
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

function renderMarkdownToHtml(markdown: string): string {
  if (!markdown) return "";
  let html = markdown
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*?<\/li>\n?)+)/g, "<ul>$1</ul>");
  // Wrap consecutive <blockquote>
  html = html.replace(/((?:<blockquote>.*?<\/blockquote>\n?)+)/g, "$1");
  // Wrap consecutive headings
  html = html.replace(/((?:<(?:h[123])>.*?<\/(?:h[123])>\n?)+)/g, "$1");

  // Paragraphs: wrap remaining text lines
  html = html.split("\n\n").map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (/^<(?:ul|blockquote|h[123]|li)/.test(trimmed)) return trimmed;
    return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");

  return html;
}
