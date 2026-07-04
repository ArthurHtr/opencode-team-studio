"use client";

import { Archive, Eye, History, Pencil, RefreshCw, Trash2, Undo2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import type { TeamListItem, TeamRevision, RevisionPreview } from "@/lib/types";

interface TeamVersion {
  id: string;
  teamId: string;
  teamName: string;
  revision: TeamRevision;
}

export function BackupsPage() {
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [versions, setVersions] = useState<TeamVersion[]>([]);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewRevision, setPreviewRevision] = useState<TeamRevision>();
  const [preview, setPreview] = useState<RevisionPreview | null>(null);
  const [renameRevisionId, setRenameRevisionId] = useState<string>();
  const [renameRevisionLabel, setRenameRevisionLabel] = useState("");

  useEffect(() => { void (async () => { await loadTeams(); })(); }, []);

  useEffect(() => {
    if (selectedTeamId) { void loadVersions(selectedTeamId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId]);

  async function loadTeams() {
    setError("");
    try {
      const response = await fetch("/api/teams", { cache: "no-store" });
      const result = await response.json() as TeamListItem[] & { error?: string };
      if (!response.ok) throw new Error(result.error || "Failed to reload teams");
      setTeams(result);
      if (!selectedTeamId && result.length > 0) {
        setSelectedTeamId(result[0].id);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
  }

  async function loadVersions(teamId: string) {
    setBusy("load"); setError("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/revisions`);
      const result = await response.json() as TeamRevision[] & { error?: string };
      if (!response.ok) throw new Error(result.error || "Failed to reload revisions");
      const teamName = teams.find((t) => t.id === teamId)?.name || teamId;
      setVersions(result.map((r) => ({ id: r.id, teamId, teamName, revision: r })));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handleRestoreVersion(teamId: string, revisionId: string) {
    if (!window.confirm("Restore this version? The current state will be saved automatically.")) return;
    setBusy("restore"); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/revisions/${encodeURIComponent(revisionId)}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Restore from Backups" }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Restore failed");
      await loadVersions(teamId);
      setMessage("Version restored.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handleDeleteVersion(teamId: string, revisionId: string) {
    if (!window.confirm("Permanently delete this version?")) return;
    setBusy("delrev"); setError("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/revisions/${encodeURIComponent(revisionId)}`, {
        method: "DELETE",
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Delete failed");
      setVersions((prev) => prev.filter((v) => v.revision.id !== revisionId));
      setMessage("Version deleted.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handlePreviewVersion(teamId: string, revisionId: string) {
    setBusy("preview"); setError("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/revisions/${encodeURIComponent(revisionId)}/preview`);
      const result = await response.json() as RevisionPreview & { error?: string };
      if (!response.ok) throw new Error(result.error || "Preview failed");
      setPreview(result);
      const revResponse = await fetch(`/api/teams/${encodeURIComponent(teamId)}/revisions/${encodeURIComponent(revisionId)}`);
      setPreviewRevision(await revResponse.json() as TeamRevision);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function handleRenameRevision(teamId: string, revisionId: string) {
    if (!renameRevisionLabel.trim()) return;
    setBusy("renameRev"); setError("");
    try {
      const response = await fetch(`/api/teams/${encodeURIComponent(teamId)}/revisions/${encodeURIComponent(revisionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: renameRevisionLabel.trim() }),
      });
      const result = await response.json() as TeamRevision & { error?: string };
      if (!response.ok) throw new Error(result.error || "Rename failed");
      setRenameRevisionId(undefined);
      await loadVersions(teamId);
      setMessage("Version renamed.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const autoCount = versions.filter((v) => v.revision.kind === "automatic").length;
  const manualCount = versions.filter((v) => v.revision.kind === "manual").length;

  return <div className="content-page">
    <PageHeader title="Backups" description="Manage saved versions for each team. Preview, restore, and automatic rotation." actions={<button className="button" onClick={() => { void loadTeams(); if (selectedTeamId) void loadVersions(selectedTeamId); }} disabled={Boolean(busy)}><RefreshCw size={15} />Refresh</button>} />
    {error ? <div className="inline-message error">{error}</div> : null}
    {message ? <div className="inline-message success">{message}</div> : null}

    <div className="backup-selector">
      <label>
        <span>Team</span>
        <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
          {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.active ? " (active)" : ""}</option>)}
        </select>
      </label>
    </div>

    {!selectedTeamId ? <div className="empty-state large"><Users size={32} /><h3>No teams</h3><p>Create a team in My Teams to get started.</p></div> : null}

    {selectedTeamId && versions.length === 0 ? <div className="empty-state"><Archive size={24} /><p>No saved versions for {selectedTeam?.name}.</p></div> : null}

    {versions.length > 0 ? <div className="backup-counts">
      <span>{autoCount} automatic{autoCount !== 1 ? "s" : ""}</span>
      <span>{manualCount} saved{manualCount !== 1 ? "s" : ""}</span>
      <span>Team: {selectedTeam?.name}</span>
    </div> : null}

    {versions.map((v) => <article key={v.id} className="backup-card">
      <div className="backup-icon"><History size={20} /></div>
      <div className="backup-copy">
        <div className="backup-header">
          <span>{formatDate(v.revision.createdAt)}</span>
          {v.revision.kind === "manual" ? <span className="revision-badge manual">Saved</span> : <span className="revision-badge automatic">{v.revision.reason}</span>}
        </div>
        {v.revision.label ? <strong>{v.revision.label}</strong> : null}
        {v.revision.description ? <small>{v.revision.description}</small> : null}
        {v.revision.agentCount !== undefined ? <small>· {v.revision.agentCount} agent{v.revision.agentCount !== 1 ? "s" : ""}</small> : null}
        <small>· {v.teamName}</small>
      </div>
      <div className="backup-actions">
        <button className="icon-button" title="Preview" onClick={() => void handlePreviewVersion(v.teamId, v.revision.id)} disabled={Boolean(busy)}><Eye size={14} /></button>
        <button className="icon-button" title="Restore" onClick={() => void handleRestoreVersion(v.teamId, v.revision.id)} disabled={Boolean(busy)}><Undo2 size={14} /></button>
        {v.revision.kind === "manual" && renameRevisionId === v.revision.id ? (
          <div className="rename-inline">
            <input className="rename-input" value={renameRevisionLabel} onChange={(e) => setRenameRevisionLabel(e.target.value)} onBlur={() => handleRenameRevision(v.teamId, v.revision.id)} onKeyDown={(e) => { if (e.key === "Enter") handleRenameRevision(v.teamId, v.revision.id); if (e.key === "Escape") setRenameRevisionId(undefined); }} autoFocus placeholder="New name" />
            <button className="icon-button small" title="Confirm" onClick={() => handleRenameRevision(v.teamId, v.revision.id)}><Pencil size={12} /></button>
          </div>
        ) : v.revision.kind === "manual" ? (
          <button className="icon-button" title="Rename" onClick={() => { setRenameRevisionId(v.revision.id); setRenameRevisionLabel(v.revision.label || ""); }}><Pencil size={14} /></button>
        ) : null}
        <button className="icon-button danger" title="Delete" onClick={() => void handleDeleteVersion(v.teamId, v.revision.id)} disabled={Boolean(busy)}><Trash2 size={14} /></button>
      </div>
    </article>)}

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
  </div>;
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
