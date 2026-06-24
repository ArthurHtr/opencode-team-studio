import type { ReactNode } from "react";

export function StatCard({ label, value, detail, icon }: { label: string; value: ReactNode; detail: string; icon: ReactNode }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}
