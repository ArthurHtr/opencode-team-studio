import type { PermissionAction, PermissionChoice, PermissionConfig, PermissionValue } from "@/lib/types";

export const PERMISSION_ACTIONS: PermissionAction[] = ["allow", "ask", "deny"];

/**
 * Current OpenCode tools plus a few compatibility entries that are still found
 * in existing configurations. The UI keeps unknown permission keys untouched.
 */
export const NATIVE_TOOLS = [
  { id: "read", label: "Lire les fichiers", shortLabel: "read", description: "Lire le contenu des fichiers autorisés.", category: "files" },
  { id: "edit", label: "Modifier les fichiers", shortLabel: "edit", description: "Créer et modifier des fichiers. Cette permission couvre aussi write et apply_patch.", category: "files" },
  { id: "glob", label: "Rechercher des fichiers", shortLabel: "glob", description: "Localiser des fichiers à partir de motifs.", category: "search" },
  { id: "grep", label: "Rechercher dans le code", shortLabel: "grep", description: "Chercher du texte ou des expressions régulières.", category: "search" },
  { id: "list", label: "Lister les dossiers", shortLabel: "list", description: "Compatibilité avec les configurations qui exposent un outil de listage.", category: "search" },
  { id: "lsp", label: "Language Server", shortLabel: "lsp", description: "Utiliser les diagnostics, références et symboles du LSP.", category: "search" },
  { id: "bash", label: "Commandes terminal", shortLabel: "bash", description: "Exécuter des commandes et scripts shell.", category: "execution" },
  { id: "task", label: "Déléguer à un agent", shortLabel: "task", description: "Invoquer les sous-agents autorisés.", category: "team" },
  { id: "skill", label: "Charger des skills", shortLabel: "skill", description: "Découvrir et charger les procédures spécialisées autorisées.", category: "team" },
  { id: "todowrite", label: "Liste de tâches", shortLabel: "todo", description: "Créer et mettre à jour la liste de tâches interne.", category: "team" },
  { id: "question", label: "Questions utilisateur", shortLabel: "question", description: "Demander une précision à l’utilisateur.", category: "interaction" },
  { id: "webfetch", label: "Lire une page web", shortLabel: "webfetch", description: "Récupérer le contenu d’une URL.", category: "web" },
  { id: "websearch", label: "Recherche web", shortLabel: "websearch", description: "Effectuer une recherche sur Internet.", category: "web" },
  { id: "external_directory", label: "Dossiers externes", shortLabel: "external", description: "Accéder à des chemins situés hors de l’espace de travail.", category: "safety" },
  { id: "doom_loop", label: "Boucles répétitives", shortLabel: "doom loop", description: "Contrôler la protection contre les boucles d’outils répétitives.", category: "safety" },
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
