"use client";

import type { PermissionAction } from "@/lib/types";

export type PermissionChoice = PermissionAction | "inherit";

export function ActionSelect({ value, onChange, compact = false }: { value: PermissionChoice; onChange: (value: PermissionChoice) => void; compact?: boolean }) {
  return (
    <select className={compact ? "action-select compact" : "action-select"} value={value} onChange={(event) => onChange(event.target.value as PermissionChoice)}>
      <option value="inherit">Hériter</option>
      <option value="allow">Autoriser</option>
      <option value="ask">Demander</option>
      <option value="deny">Refuser</option>
    </select>
  );
}

export function actionLabel(value: PermissionChoice) {
  return value === "allow" ? "Autorisé" : value === "ask" ? "Demander" : value === "deny" ? "Refusé" : "Hérité";
}
