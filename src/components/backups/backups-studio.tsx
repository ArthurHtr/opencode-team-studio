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
      if (!response.ok) throw new Error(result.error || "Impossible de relire les sauvegardes");
      setBackups(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Erreur inconnue"); }
    finally { setBusy(undefined); }
  }

  async function restore(backup: BackupSummary) {
    if (!window.confirm(`Restaurer la configuration du ${formatDate(backup.createdAt)} ? La configuration actuelle sera remplacée.`)) return;
    setBusy(backup.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/backups/${encodeURIComponent(backup.id)}/restore`, { method: "POST" });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Restauration impossible");
      setMessage("Backup restauré. Recharge l’onglet Équipe pour relire la configuration.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Erreur inconnue"); }
    finally { setBusy(undefined); }
  }

  async function remove(backup: BackupSummary) {
    if (!window.confirm(`Supprimer définitivement le backup du ${formatDate(backup.createdAt)} ?`)) return;
    setBusy(backup.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/backups/${encodeURIComponent(backup.id)}`, { method: "DELETE" });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Suppression impossible");
      setBackups((current) => current.filter((item) => item.id !== backup.id));
      setMessage("Backup supprimé.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Erreur inconnue"); }
    finally { setBusy(undefined); }
  }

  return <div className="content-page">
    <PageHeader title="Sauvegardes" description="Chaque application de l’équipe crée automatiquement un snapshot complet de la configuration OpenCode, hors Studio et données locales." actions={<button className="button" onClick={() => void reload()} disabled={Boolean(busy)}><RefreshCw size={15} />Actualiser</button>} />
    {error ? <div className="inline-message error">{error}</div> : null}
    {message ? <div className="inline-message success">{message}</div> : null}
    {!backups.length ? <div className="empty-state large"><DatabaseBackup size={32} /><h3>Aucun backup</h3><p>Le premier sera créé avant la prochaine sauvegarde de l’équipe.</p></div> : <div className="backup-list">{backups.map((backup) => <article key={backup.id} className="backup-card">
      <div className="backup-icon"><DatabaseBackup size={20} /></div>
      <div className="backup-copy"><span>{formatDate(backup.createdAt)}</span><strong>{backup.reason}</strong><small>{backup.path} · {formatBytes(backup.sizeBytes || 0)}</small></div>
      <div className="backup-actions"><button className="button" disabled={Boolean(busy)} onClick={() => void restore(backup)}><ArchiveRestore size={15} />Restaurer</button><button className="icon-button danger" disabled={Boolean(busy)} title="Supprimer" onClick={() => void remove(backup)}><Trash2 size={15} /></button></div>
    </article>)}</div>}
  </div>;
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatBytes(value: number): string { if (value < 1024) return `${value} o`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} Ko`; return `${(value / 1024 ** 2).toFixed(1)} Mo`; }
