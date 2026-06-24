import "server-only";

import { mkdir, readdir } from "node:fs/promises";
import YAML from "yaml";
import { getConfigDocument, updateConfigPath, updateConfigPaths } from "@/lib/config-store";
import { atomicWrite, exists, readUtf8, removePath, safeConfigPath } from "@/lib/filesystem";
import { getLatestBackup, withConfigTransaction } from "@/lib/backup";
import { getStudioLayout, saveStudioLayout } from "@/lib/layout-store";
import type {
  AgentDefinition,
  McpDefinition,
  PermissionConfig,
  ProviderSummary,
  SkillDefinition,
  StudioLayout,
  TeamApplyInput,
  TeamSnapshot,
} from "@/lib/types";

const AGENT_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const BUILTINS: Record<string, Pick<AgentDefinition, "description" | "mode" | "hidden">> = {
  build: { description: "Agent principal chargé d’implémenter, tester et livrer les changements.", mode: "primary", hidden: false },
  plan: { description: "Agent principal chargé d’explorer, analyser et planifier sans modifier le code.", mode: "primary", hidden: false },
  general: { description: "Sous-agent généraliste pour les recherches et tâches multi-étapes.", mode: "subagent", hidden: false },
  explore: { description: "Sous-agent rapide de découverte et de recherche dans le codebase.", mode: "subagent", hidden: false },
  scout: { description: "Sous-agent léger de repérage et d’exploration ciblée.", mode: "subagent", hidden: false },
  title: { description: "Agent interne utilisé pour générer les titres de session.", mode: "subagent", hidden: true },
  summary: { description: "Agent interne utilisé pour résumer une session.", mode: "subagent", hidden: true },
  compaction: { description: "Agent interne utilisé pendant la compaction du contexte.", mode: "subagent", hidden: true },
};

const KNOWN_AGENT_KEYS = new Set([
  "description", "mode", "model", "variant", "temperature", "top_p", "prompt", "disable", "hidden",
  "options", "color", "steps", "maxSteps", "permission",
]);

export async function getTeamSnapshot(): Promise<TeamSnapshot> {
  const [configDocument, layout, latestBackup] = await Promise.all([
    getConfigDocument(),
    getStudioLayout(),
    getLatestBackup(),
  ]);
  const config = configDocument.value;
  return {
    agents: await listAgents(config),
    skills: await listSkills(),
    mcps: parseMcps(config.mcp),
    providers: parseProviders(config.provider),
    globalPermission: asPermission(config.permission),
    defaultAgent: typeof config.default_agent === "string" ? config.default_agent : "build",
    defaultModel: typeof config.model === "string" ? config.model : undefined,
    layout,
    latestBackup,
  };
}

export async function getAgent(name: string): Promise<AgentDefinition> {
  const snapshot = await getTeamSnapshot();
  const agent = snapshot.agents.find((item) => item.name === name);
  if (!agent) throw new Error("Agent introuvable");
  return agent;
}

export async function applyTeamDraft(input: TeamApplyInput): Promise<TeamSnapshot> {
  validateTeamDraft(input.snapshot);
  return withConfigTransaction(input.reason || "Sauvegarde de l’équipe", async () => {
    const current = await getTeamSnapshot();
    const configuredAgents: Record<string, unknown> = {};
    const desiredFileAgents = new Map<string, AgentDefinition>();

    for (const agent of input.snapshot.agents) {
      validateAgentName(agent.name);
      if (agent.source === "file" && !agent.builtin) desiredFileAgents.set(agent.name, agent);
      else configuredAgents[agent.name] = serializeAgentConfig(agent, true);
    }

    await updateConfigPaths([
      { path: ["$schema"], value: "https://opencode.ai/config.json" },
      { path: ["agent"], value: configuredAgents },
      { path: ["mcp"], value: Object.fromEntries(input.snapshot.mcps.map((mcp) => [mcp.name, serializeMcp(mcp)])) },
      { path: ["permission"], value: input.snapshot.globalPermission },
      { path: ["default_agent"], value: input.snapshot.defaultAgent },
      { path: ["model"], value: input.snapshot.defaultModel },
    ]);

    const agentsDirectory = safeConfigPath("agents");
    await mkdir(agentsDirectory, { recursive: true });
    for (const agent of desiredFileAgents.values()) {
      await atomicWrite(agentFile(agent.name), serializeAgentMarkdown(agent));
    }

    for (const previous of current.agents) {
      if (previous.source !== "file" || previous.builtin) continue;
      if (!desiredFileAgents.has(previous.name)) await removePath(agentFile(previous.name));
    }

    const normalizedLayout = normalizeLayout(input.layout);
    await saveStudioLayout(normalizedLayout);

    const verified = await getTeamSnapshot();
    verifyAppliedSnapshot(input.snapshot, verified);
    return verified;
  });
}

export async function saveAgent(agent: AgentDefinition, originalName?: string): Promise<AgentDefinition> {
  return withConfigTransaction(`Modification de l’agent ${originalName || agent.name}`, () => saveAgentRaw(agent, originalName));
}

export async function createAgent(input: Pick<AgentDefinition, "name" | "description" | "mode"> & { preset?: string }): Promise<AgentDefinition> {
  return withConfigTransaction(`Création de l’agent ${input.name}`, async () => {
    validateAgentName(input.name);
    const target = agentFile(input.name);
    if (await exists(target)) throw new Error("Un agent porte déjà ce nom");
    const preset = input.preset || "readonly";
    const agent: AgentDefinition = {
      name: input.name,
      source: "file",
      builtin: false,
      description: input.description,
      mode: input.mode,
      prompt: defaultPrompt(input.name, input.description, preset),
      options: {},
      permission: presetPermission(preset),
      extra: {},
    };
    await atomicWrite(target, serializeAgentMarkdown(agent));
    return getAgent(input.name);
  });
}

export async function deleteAgent(name: string): Promise<void> {
  await withConfigTransaction(`Suppression de l’agent ${name}`, async () => {
    const agent = await getAgent(name);
    if (agent.builtin || agent.source === "config") await updateConfigPath(["agent", name], undefined);
    else await removePath(agentFile(name));
  });
}

export async function saveAgentPermission(name: string, permission: PermissionConfig): Promise<AgentDefinition> {
  return withConfigTransaction(`Modification des permissions de ${name}`, async () => {
    const agent = await getAgent(name);
    return saveAgentRaw({ ...agent, permission }, name);
  });
}

export async function saveSkill(skill: SkillDefinition, originalName?: string): Promise<SkillDefinition> {
  return withConfigTransaction(`Modification du skill ${originalName || skill.name}`, async () => {
    validateSkillName(skill.name);
    if (!skill.description.trim()) throw new Error("La description du skill est obligatoire");
    const target = skillFile(skill.name);
    if (originalName && originalName !== skill.name && await exists(target)) throw new Error("Un skill porte déjà ce nom");
    const frontmatter: Record<string, unknown> = { name: skill.name, description: skill.description };
    if (skill.license) frontmatter.license = skill.license;
    if (skill.compatibility) frontmatter.compatibility = skill.compatibility;
    if (Object.keys(skill.metadata).length) frontmatter.metadata = skill.metadata;
    await atomicWrite(target, stringifyFrontmatter(frontmatter, skill.body));
    if (originalName && originalName !== skill.name) await removePath(skillDirectory(originalName));
    return readSkill(skill.name);
  });
}

export async function deleteSkill(name: string): Promise<void> {
  await withConfigTransaction(`Suppression du skill ${name}`, async () => {
    validateSkillName(name);
    await removePath(skillDirectory(name));
  });
}

export async function saveMcp(mcp: McpDefinition, originalName?: string): Promise<McpDefinition> {
  return withConfigTransaction(`Modification du MCP ${originalName || mcp.name}`, async () => {
    validateAgentName(mcp.name);
    if (originalName && originalName !== mcp.name) await updateConfigPath(["mcp", originalName], undefined);
    await updateConfigPath(["mcp", mcp.name], serializeMcp(mcp));
    const saved = (await getTeamSnapshot()).mcps.find((item) => item.name === mcp.name);
    if (!saved) throw new Error("MCP non enregistré");
    return saved;
  });
}

export async function deleteMcp(name: string): Promise<void> {
  await withConfigTransaction(`Suppression du MCP ${name}`, async () => {
    await updateConfigPath(["mcp", name], undefined);
  });
}

async function saveAgentRaw(agent: AgentDefinition, originalName?: string): Promise<AgentDefinition> {
  validateAgentName(agent.name);
  const previousName = originalName || agent.name;
  const existing = await getAgent(previousName).catch(() => undefined);
  const source = existing?.source ?? agent.source ?? "file";

  if (source === "builtin" || source === "config") {
    if (previousName !== agent.name) throw new Error("Un agent intégré ou déclaré dans opencode.json ne peut pas être renommé depuis cette vue");
    await updateConfigPath(["agent", agent.name], serializeAgentConfig(agent, true));
  } else {
    const target = agentFile(agent.name);
    if (previousName !== agent.name && await exists(target)) throw new Error("Un agent porte déjà ce nom");
    await atomicWrite(target, serializeAgentMarkdown(agent));
    if (previousName !== agent.name) await removePath(agentFile(previousName));
  }
  return getAgent(agent.name);
}

async function listAgents(config: Record<string, unknown>): Promise<AgentDefinition[]> {
  const map = new Map<string, AgentDefinition>();
  const configured = isRecord(config.agent) ? config.agent : {};

  for (const [name, defaults] of Object.entries(BUILTINS)) {
    const override = isRecord(configured[name]) ? configured[name] : {};
    map.set(name, parseAgent(name, { ...defaults, ...override }, "builtin", true));
  }
  for (const [name, value] of Object.entries(configured)) {
    if (map.has(name) || !isRecord(value)) continue;
    map.set(name, parseAgent(name, value, "config", false));
  }

  const directory = safeConfigPath("agents");
  let entries: { name: string; isFile: () => boolean }[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    // Directory does not exist — no file-based agents.
    entries = [];
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const name = entry.name.slice(0, -3);
    const parsed = parseFrontmatter(await readUtf8(agentFile(name)));
    map.set(name, parseAgent(name, { ...parsed.data, prompt: parsed.content.replace(/^\n/, "") }, "file", false));
  }

  return [...map.values()].sort((a, b) => {
    const rank = (agent: AgentDefinition) => agent.mode === "primary" ? 0 : agent.mode === "all" ? 1 : 2;
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
}

async function listSkills(): Promise<SkillDefinition[]> {
  const directory = safeConfigPath("skills");
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    // Directory does not exist — no skills.
    entries = [];
  }
  const skills: SkillDefinition[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try { skills.push(await readSkill(entry.name)); } catch { /* Invalid skills remain untouched on disk. */ }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function readSkill(name: string): Promise<SkillDefinition> {
  validateSkillName(name);
  const parsed = parseFrontmatter(await readUtf8(skillFile(name)));
  return {
    name,
    description: stringValue(parsed.data.description),
    license: optionalString(parsed.data.license),
    compatibility: optionalString(parsed.data.compatibility),
    metadata: stringRecord(parsed.data.metadata),
    body: parsed.content.replace(/^\n/, ""),
  };
}

function parseAgent(name: string, raw: Record<string, unknown>, source: AgentDefinition["source"], builtin: boolean): AgentDefinition {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) if (!KNOWN_AGENT_KEYS.has(key)) extra[key] = value;
  const mode = raw.mode === "primary" || raw.mode === "all" || raw.mode === "subagent"
    ? raw.mode
    : (BUILTINS[name]?.mode ?? "subagent");
  return {
    name,
    source,
    builtin,
    description: stringValue(raw.description) || BUILTINS[name]?.description || "",
    mode,
    prompt: stringValue(raw.prompt),
    model: optionalString(raw.model),
    variant: optionalString(raw.variant),
    temperature: optionalNumber(raw.temperature),
    top_p: optionalNumber(raw.top_p),
    steps: optionalNumber(raw.steps ?? raw.maxSteps),
    hidden: raw.hidden === true || (raw.hidden === undefined && BUILTINS[name]?.hidden === true),
    disable: raw.disable === true,
    color: optionalString(raw.color),
    options: isRecord(raw.options) ? raw.options : {},
    permission: asPermission(raw.permission),
    extra,
  };
}

export function serializeAgentMarkdown(agent: AgentDefinition): string {
  const config = serializeAgentConfig(agent, false);
  delete config.prompt;
  return stringifyFrontmatter(config, agent.prompt);
}

export function serializeAgentConfig(agent: AgentDefinition, includePrompt: boolean): Record<string, unknown> {
  const result: Record<string, unknown> = { ...agent.extra };
  result.description = agent.description;
  result.mode = agent.mode;
  if (agent.model) result.model = agent.model;
  if (agent.variant) result.variant = agent.variant;
  if (agent.temperature !== undefined) result.temperature = agent.temperature;
  if (agent.top_p !== undefined) result.top_p = agent.top_p;
  if (agent.steps !== undefined) result.steps = agent.steps;
  if (agent.hidden) result.hidden = true;
  if (agent.disable) result.disable = true;
  if (agent.color) result.color = agent.color;
  if (Object.keys(agent.options).length) result.options = agent.options;
  if (Object.keys(agent.permission).length) result.permission = agent.permission;
  if (includePrompt && agent.prompt) result.prompt = agent.prompt;
  return result;
}

function parseMcps(value: unknown): McpDefinition[] {
  if (!isRecord(value)) return [];
  const mcps: McpDefinition[] = [];
  for (const [name, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    if (raw.type === "local") {
      mcps.push({
        name,
        type: "local",
        enabled: raw.enabled !== false,
        command: Array.isArray(raw.command) ? raw.command.map(String) : [],
        cwd: optionalString(raw.cwd),
        environment: stringRecord(raw.environment),
        headers: {},
        timeout: optionalNumber(raw.timeout),
      });
      continue;
    }
    if (raw.type === "remote") {
      mcps.push({
        name,
        type: "remote",
        enabled: raw.enabled !== false,
        command: [],
        environment: {},
        url: stringValue(raw.url),
        headers: stringRecord(raw.headers),
        oauth: raw.oauth === false ? false : isRecord(raw.oauth) ? raw.oauth as McpDefinition["oauth"] : undefined,
        timeout: optionalNumber(raw.timeout),
      });
      continue;
    }
    if (typeof raw.enabled === "boolean") {
      mcps.push({ name, type: "disabled", enabled: raw.enabled, command: [], environment: {}, headers: {} });
    }
  }
  return mcps.sort((a, b) => a.name.localeCompare(b.name));
}

export function serializeMcp(mcp: McpDefinition): Record<string, unknown> {
  if (mcp.type === "disabled") return { enabled: mcp.enabled };
  if (mcp.type === "local") {
    const result: Record<string, unknown> = { type: "local", command: mcp.command, enabled: mcp.enabled };
    if (mcp.cwd) result.cwd = mcp.cwd;
    if (Object.keys(mcp.environment).length) result.environment = mcp.environment;
    if (mcp.timeout !== undefined) result.timeout = mcp.timeout;
    return result;
  }
  const result: Record<string, unknown> = { type: "remote", url: mcp.url || "", enabled: mcp.enabled };
  if (Object.keys(mcp.headers).length) result.headers = mcp.headers;
  if (mcp.oauth !== undefined) result.oauth = mcp.oauth;
  if (mcp.timeout !== undefined) result.timeout = mcp.timeout;
  return result;
}

function parseProviders(value: unknown): ProviderSummary[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([id, raw]) => {
    const provider = isRecord(raw) ? raw : {};
    const modelsRaw = isRecord(provider.models) ? provider.models : {};
    return {
      id,
      name: optionalString(provider.name),
      models: Object.entries(modelsRaw).map(([modelId, modelRaw]) => {
        const model = isRecord(modelRaw) ? modelRaw : {};
        return { id: modelId, name: optionalString(model.name), variants: isRecord(model.variants) ? Object.keys(model.variants) : [] };
      }),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function validateTeamDraft(snapshot: TeamSnapshot): void {
  const names = new Set<string>();
  for (const agent of snapshot.agents) {
    validateAgentName(agent.name);
    if (names.has(agent.name)) throw new Error(`Agent dupliqué : ${agent.name}`);
    names.add(agent.name);
    if (!agent.description.trim()) throw new Error(`La description de ${agent.name} est obligatoire`);
    validatePermission(agent.permission, `agent ${agent.name}`);
  }
  if (!names.has("build") || !names.has("plan")) throw new Error("Les agents intégrés build et plan doivent rester présents");
  const defaultAgent = snapshot.agents.find((agent) => agent.name === snapshot.defaultAgent);
  if (!defaultAgent || defaultAgent.mode === "subagent") throw new Error("L’agent par défaut doit être un agent principal");
  validatePermission(snapshot.globalPermission, "configuration globale");

  const mcpNames = new Set<string>();
  for (const mcp of snapshot.mcps) {
    validateAgentName(mcp.name);
    if (mcpNames.has(mcp.name)) throw new Error(`MCP dupliqué : ${mcp.name}`);
    mcpNames.add(mcp.name);
    if (mcp.type === "local" && mcp.command.length === 0) throw new Error(`Le MCP local ${mcp.name} doit avoir une commande`);
    if (mcp.type === "remote" && !mcp.url) throw new Error(`Le MCP distant ${mcp.name} doit avoir une URL`);
  }
}

function validatePermission(permission: PermissionConfig, label: string): void {
  for (const [tool, value] of Object.entries(permission)) {
    if (typeof value === "string") continue;
    for (const [pattern, action] of Object.entries(value)) {
      if (!pattern.trim()) throw new Error(`Motif vide dans les permissions de ${label} (${tool})`);
      if (!(["allow", "ask", "deny"] as string[]).includes(action)) throw new Error(`Décision invalide pour ${tool} dans ${label}`);
    }
  }
}

function normalizeLayout(layout: StudioLayout): StudioLayout {
  const views: StudioLayout["views"] = {};
  for (const [key, value] of Object.entries(layout.views || {})) {
    const positions = Object.fromEntries(Object.entries(value.positions || {}).filter(([, position]) => Number.isFinite(position.x) && Number.isFinite(position.y)));
    const viewport = value.viewport && Number.isFinite(value.viewport.x) && Number.isFinite(value.viewport.y) && Number.isFinite(value.viewport.zoom) ? value.viewport : undefined;
    views[key] = { positions, ...(viewport ? { viewport } : {}) };
  }
  return { version: 2, views };
}

function verifyAppliedSnapshot(expected: TeamSnapshot, actual: TeamSnapshot): void {
  const expectedAgents = expected.agents.map((agent) => agent.name).sort();
  const actualAgents = actual.agents.map((agent) => agent.name).sort();
  if (JSON.stringify(expectedAgents) !== JSON.stringify(actualAgents)) throw new Error("La vérification après écriture a détecté une liste d’agents différente");
  if (expected.defaultAgent !== actual.defaultAgent) throw new Error("L’agent par défaut n’a pas été appliqué correctement");
  if ((expected.defaultModel || "") !== (actual.defaultModel || "")) throw new Error("Le modèle global n’a pas été appliqué correctement");
}

function presetPermission(preset: string): PermissionConfig {
  if (preset === "implementer") return { edit: "allow", bash: "ask", read: "allow", glob: "allow", grep: "allow", task: { "*": "deny" }, skill: "allow" };
  if (preset === "orchestrator") return { edit: "deny", bash: "ask", read: "allow", glob: "allow", grep: "allow", task: { "*": "deny" }, skill: "allow" };
  if (preset === "reviewer") return { edit: "deny", bash: "ask", read: "allow", glob: "allow", grep: "allow", task: "deny", skill: "allow", webfetch: "allow", websearch: "allow" };
  return { edit: "deny", bash: "ask", read: "allow", glob: "allow", grep: "allow", task: "deny", skill: "allow" };
}

function defaultPrompt(name: string, description: string, preset: string): string {
  const role = description || `Agent spécialisé ${name}`;
  return `Tu es ${role}.\n\n## Responsabilités\n\n- Travaille uniquement dans ton périmètre.\n- Appuie chaque constat sur des éléments vérifiables.\n- Signale clairement les incertitudes.\n\n## Mode de travail\n\n${preset === "orchestrator" ? "- Délègue les analyses spécialisées aux sous-agents autorisés.\n- Consolide leurs résultats sans dupliquer les constats." : "- Analyse la demande avant d’agir.\n- Produis un résultat directement exploitable par l’agent appelant."}\n`;
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, content: normalized };
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("Frontmatter YAML non fermé");
  const parsed = YAML.parse(normalized.slice(4, end)) ?? {};
  if (!isRecord(parsed)) throw new Error("Frontmatter YAML invalide");
  return { data: parsed, content: normalized.slice(end + 5) };
}

function stringifyFrontmatter(data: Record<string, unknown>, body: string): string {
  const yaml = YAML.stringify(data, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${body.trimEnd()}\n`;
}

function agentFile(name: string): string { validateAgentName(name); return safeConfigPath("agents", `${name}.md`); }
function skillDirectory(name: string): string { validateSkillName(name); return safeConfigPath("skills", name); }
function skillFile(name: string): string { return safeConfigPath("skills", name, "SKILL.md"); }
function validateAgentName(name: string) { if (!AGENT_NAME.test(name)) throw new Error("Nom d’agent invalide"); }
function validateSkillName(name: string) { if (!SKILL_NAME.test(name)) throw new Error("Le nom du skill doit être en minuscules avec des tirets"); }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function optionalString(value: unknown): string | undefined { return typeof value === "string" && value.length ? value : undefined; }
function optionalNumber(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
}
function asPermission(value: unknown): PermissionConfig {
  if (value === "allow" || value === "ask" || value === "deny") return { "*": value };
  if (!isRecord(value)) return {};
  const result: PermissionConfig = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === "allow" || item === "ask" || item === "deny") result[key] = item;
    else if (isRecord(item)) {
      const rules: Record<string, "allow" | "ask" | "deny"> = {};
      for (const [pattern, action] of Object.entries(item)) if (action === "allow" || action === "ask" || action === "deny") rules[pattern] = action;
      result[key] = rules;
    }
  }
  return result;
}
