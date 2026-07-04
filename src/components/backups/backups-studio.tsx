"use client";

import { ArchiveRestore, DatabaseBackup, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import type { BackupSummary } from "@/lib/types";

export function BackupsStudio({ initial }: { initial: BackupSummary[] }) {
  const [backups, setBackups] = useState(initial);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    setBusy("reload"); setError("");
    try {
      const response = await fetch("/api/backups", { cache: "no-store" });
      const result = await response.json() as BackupSummary[] & { error?: string };
      if (!response.ok) throw new Error(result.error || "Failed to reload backups");
      setBackups(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function restore(backup: BackupSummary) {
    if (!window.confirm(`Restore the configuration from ${formatDate(backup.createdAt)}? The current configuration will be replaced.`)) return;
    setBusy(backup.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/backups/${encodeURIComponent(backup.id)}/restore`, { method: "POST" });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Restore failed");
      setMessage("Backup restored. Reload the Team tab to read the configuration.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  async function remove(backup: BackupSummary) {
    if (!window.confirm(`Permanently delete the backup from ${formatDate(backup.createdAt)}?`)) return;
    setBusy(backup.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/backups/${encodeURIComponent(backup.id)}`, { method: "DELETE" });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Delete failed");
      setBackups((current) => current.filter((item) => item.id !== backup.id));
      setMessage("Backup deleted.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unknown error"); }
    finally { setBusy(undefined); }
  }

  return <div className="content-page">
    <PageHeader title="Backups" description="Each team save automatically creates a full snapshot of the OpenCode configuration, excluding Studio and local data." actions={<button className="button" onClick={() => void reload()} disabled={Boolean(busy)}><RefreshCw size={15} />Refresh</button>} />
    {error ? <div className="inline-message error">{error}</div> : null}
    {message ? <div className="inline-message success">{message}</div> : null}
    {!backups.length ? <div className="empty-state large"><DatabaseBackup size={32} /><h3>No backups</h3><p>The first one will be created before the next team save.</p></div> : <div className="backup-list">{backups.map((backup) => <article key={backup.id} className="backup-card">
      <div className="backup-icon"><DatabaseBackup size={20} /></div>
      <div className="backup-copy"><span>{formatDate(backup.createdAt)}</span><strong>{backup.reason}</strong><small>{backup.path} · {formatBytes(backup.sizeBytes || 0)}</small></div>
      <div className="backup-actions"><button className="button" disabled={Boolean(busy)} onClick={() => void restore(backup)}><ArchiveRestore size={15} />Restore</button><button className="icon-button danger" disabled={Boolean(busy)} title="Delete" onClick={() => void remove(backup)}><Trash2 size={15} /></button></div>
    </article>)}</div>}
  </div>;
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatBytes(value: number): string { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 ** 2).toFixed(1)} MB`; }
