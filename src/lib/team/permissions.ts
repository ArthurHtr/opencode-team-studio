import type { PermissionAction, PermissionChoice, PermissionConfig, PermissionValue } from "@/lib/types";

export const PERMISSION_ACTIONS: PermissionAction[] = ["allow", "ask", "deny"];

/**
 * Current OpenCode tools plus a few compatibility entries that are still found
 * in existing configurations. The UI keeps unknown permission keys untouched.
 */
export const NATIVE_TOOLS = [
  { id: "read", label: "Read files", shortLabel: "read", description: "Read the contents of authorized files.", category: "files" },
  { id: "edit", label: "Edit files", shortLabel: "edit", description: "Create and modify files. This permission also covers write and apply_patch.", category: "files" },
  { id: "glob", label: "Search files", shortLabel: "glob", description: "Locate files from patterns.", category: "search" },
  { id: "grep", label: "Search code", shortLabel: "grep", description: "Search for text or regular expressions.", category: "search" },
  { id: "list", label: "List directories", shortLabel: "list", description: "Compatibility with configurations that expose a listing tool.", category: "search" },
  { id: "lsp", label: "Language Server", shortLabel: "lsp", description: "Use LSP diagnostics, references, and symbols.", category: "search" },
  { id: "bash", label: "Terminal commands", shortLabel: "bash", description: "Execute commands and shell scripts.", category: "execution" },
  { id: "task", label: "Delegate to agent", shortLabel: "task", description: "Invoke authorized sub-agents.", category: "team" },
  { id: "skill", label: "Load skills", shortLabel: "skill", description: "Discover and load authorized specialized procedures.", category: "team" },
  { id: "todowrite", label: "Task list", shortLabel: "todo", description: "Create and update the internal task list.", category: "team" },
  { id: "question", label: "User questions", shortLabel: "question", description: "Ask the user for clarification.", category: "interaction" },
  { id: "webfetch", label: "Read web page", shortLabel: "webfetch", description: "Fetch the content of a URL.", category: "web" },
  { id: "websearch", label: "Web search", shortLabel: "websearch", description: "Perform a search on the Internet.", category: "web" },
  { id: "external_directory", label: "External directories", shortLabel: "external", description: "Access paths located outside the workspace.", category: "safety" },
  { id: "doom_loop", label: "Repetitive loops", shortLabel: "doom loop", description: "Control protection against repetitive tool loops.", category: "safety" },
] as const;

export function evaluatePermission(value: PermissionValue | undefined, target = "*"): PermissionAction | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  let result: PermissionAction | undefined;
  for (const [pattern, action] of Object.entries(value)) {
    if (globMatches(pattern, target)) result = action;
  }
  return result;
}

export function hasExplicitRule(value: PermissionValue | undefined, target: string): boolean {
  if (typeof value === "string") return true;
  if (!value) return false;
  return Object.prototype.hasOwnProperty.call(value, target);
}

export function setPermissionTarget(
  permission: PermissionConfig,
  key: string,
  target: string,
  action: PermissionChoice,
): PermissionConfig {
  const next = structuredClone(permission ?? {});
  const current = next[key];
  const rules: Record<string, PermissionAction> = typeof current === "object" && current ? { ...current } : {};
  if (typeof current === "string") rules["*"] = current;
  if (action === "inherit") delete rules[target];
  else rules[target] = action;
  if (Object.keys(rules).length === 0) delete next[key];
  else next[key] = rules;
  return next;
}

export function setPermissionValue(
  permission: PermissionConfig,
  key: string,
  value: PermissionValue | undefined,
): PermissionConfig {
  const next = structuredClone(permission ?? {});
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

export function renamePermissionTarget(
  permission: PermissionConfig,
  key: string,
  previous: string,
  nextName: string,
): PermissionConfig {
  const current = permission[key];
  if (!current || typeof current === "string" || !Object.prototype.hasOwnProperty.call(current, previous)) return permission;
  const rules = { ...current, [nextName]: current[previous] };
  delete rules[previous];
  return { ...permission, [key]: rules };
}

export function removePermissionTarget(permission: PermissionConfig, key: string, target: string): PermissionConfig {
  const current = permission[key];
  if (!current || typeof current === "string" || !Object.prototype.hasOwnProperty.call(current, target)) return permission;
  const rules = { ...current };
  delete rules[target];
  const next = { ...permission };
  if (Object.keys(rules).length) next[key] = rules;
  else delete next[key];
  return next;
}

export function permissionChoice(value: PermissionValue | undefined, target = "*"): PermissionChoice {
  return evaluatePermission(value, target) ?? "inherit";
}

function globMatches(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(value);
}
