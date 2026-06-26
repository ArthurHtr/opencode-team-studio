"use client";

import type { PermissionAction } from "@/lib/types";

export type PermissionChoice = PermissionAction | "inherit";

export function ActionSelect({ value, onChange, compact = false }: { value: PermissionChoice; onChange: (value: PermissionChoice) => void; compact?: boolean }) {
  return (
    <select className={compact ? "action-select compact" : "action-select"} value={value} onChange={(event) => onChange(event.target.value as PermissionChoice)}>
      <option value="inherit">Inherit</option>
      <option value="allow">Allow</option>
      <option value="ask">Ask</option>
      <option value="deny">Deny</option>
    </select>
  );
}

export function actionLabel(value: PermissionChoice) {
  return value === "allow" ? "Allowed" : value === "ask" ? "Ask" : value === "deny" ? "Denied" : "Inherited";
}
