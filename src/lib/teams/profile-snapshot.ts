import "server-only";

import { readdir } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

import { getConfigRoot } from "@/lib/env";
import { exists, readUtf8 } from "@/lib/filesystem";
import { parseJsoncObject } from "@/lib/config-store";

import type {
  AgentDefinition,
  McpDefinition,
  PermissionConfig,
  SkillDefinition,
  StudioLayout,
  StudioMetadata,
  TeamSnapshot,
} from "@/lib/types";



const BUILTINS: Record<string, Pick<AgentDefinition, "description" | "mode" | "hidden">> = {
  build: { description: "Main agent responsible for implementing, testing, and delivering changes.", mode: "primary", hidden: false },
  plan: { description: "Main agent responsible for exploring, analyzing, and planning without modifying code.", mode: "primary", hidden: false },
  general: { description: "General-purpose sub-agent for research and multi-step tasks.", mode: "subagent", hidden: false },
  explore: { description: "Rapid discovery and codebase search sub-agent.", mode: "subagent", hidden: false },
  scout: { description: "Lightweight scouting and targeted exploration sub-agent.", mode: "subagent", hidden: false },
  title: { description: "Internal agent used to generate session titles.", mode: "subagent", hidden: true },
  summary: { description: "Internal agent used to summarize a session.", mode: "subagent", hidden: true },
  compaction: { description: "Internal agent used during context compaction.", mode: "subagent", hidden: true },
};

const KNOWN_AGENT_KEYS = new Set([
  "description", "mode", "model", "variant", "temperature", "top_p", "prompt", "disable", "hidden",
  "options", "color", "steps", "maxSteps", "permission",
]);

/**
 * Reconstruct a TeamSnapshot from a stored team profile directory.
 * Does NOT modify activeTeamId or materialize to runtime.
 */
export async function loadTeamProfileSnapshot(teamId: string): Promise<TeamSnapshot> {
  const teamsBase = path.join(getConfigRoot(), "studio-data", "teams");
  const profilePath = resolveTeamPath(teamsBase, teamId);

  // Read config
  const configFilename = await detectConfigFilename(profilePath);
  const configContent = await readConfigFile(profilePath, configFilename);
  const config = parseJsoncObject(configContent);

  // Read agents
  const agents = await listAgentsFromProfile(profilePath);

  // Read skills
  const skills = await listSkillsFromProfile(profilePath);

  // Read MCPs
  const mcps = parseMcps(config.mcp);

  // Read providers
  const providers = parseProviders(config.provider);

  // Read layout and metadata
  const rawLayout = await getStudioLayoutFromProfile(profilePath);
  const rawMetadata = await getStudioMetadataFromProfile(profilePath);
  const layout: StudioLayout = { version: 2, views: rawLayout.views as Record<string, { positions: Record<string, { x: number; y: number }>; viewport?: { x: number; y: number; zoom: number }; pinnedNodeIds?: string[] }> };
  const metadata: StudioMetadata = { version: rawMetadata.version as 2 };

  return {
    agents,
    skills,
    mcps,
    providers,
    globalPermission: asPermission(config.permission),
    defaultAgent: typeof config.default_agent === "string" ? config.default_agent : "build",
    defaultModel: typeof config.model === "string" ? config.model : undefined,
    layout,
    metadata,
  };
}

async function detectConfigFilename(profilePath: string): Promise<string> {
  if (await exists(path.join(profilePath, "opencode.jsonc"))) return "opencode.jsonc";
  return "opencode.json";
}

async function readConfigFile(profilePath: string, filename: string): Promise<string> {
  const filePath = path.join(profilePath, filename);
  if (await exists(filePath)) return await readUtf8(filePath);
  return "{}";
}

async function listAgentsFromProfile(profilePath: string): Promise<AgentDefinition[]> {
  const map = new Map<string, AgentDefinition>();
  const configContent = await readConfigFile(profilePath, await detectConfigFilename(profilePath));
  const config = parseJsoncObject(configContent);
  const configured = isRecord(config.agent) ? config.agent : {};

  for (const [name, defaults] of Object.entries(BUILTINS)) {
    const override = isRecord(configured[name]) ? configured[name] : {};
    map.set(name, parseAgent(name, { ...defaults, ...override }, "builtin", true));
  }
  for (const [name, value] of Object.entries(configured)) {
    if (map.has(name) || !isRecord(value)) continue;
    map.set(name, parseAgent(name, value, "config", false));
  }

  const agentsDir = path.join(profilePath, "agents");
  if (await exists(agentsDir)) {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const name = entry.name.slice(0, -3);
      const filePath = path.join(agentsDir, entry.name);
      const parsed = parseFrontmatter(await readUtf8(filePath));
      map.set(name, parseAgent(name, { ...parsed.data, prompt: parsed.content.replace(/^\n/, "") }, "file", false));
    }
  }

  return [...map.values()].sort((a, b) => {
    const rank = (agent: AgentDefinition) => agent.mode === "primary" ? 0 : agent.mode === "all" ? 1 : 2;
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
}

async function listSkillsFromProfile(profilePath: string): Promise<SkillDefinition[]> {
  const skills: SkillDefinition[] = [];
  const skillsDir = path.join(profilePath, "skills");
  if (!await exists(skillsDir)) return skills;

  const entries = await readdir(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
      if (await exists(skillFile)) {
        const parsed = parseFrontmatter(await readUtf8(skillFile));
        skills.push({
          name: entry.name,
          description: stringValue(parsed.data.description) || entry.name,
          license: optionalString(parsed.data.license),
          compatibility: optionalString(parsed.data.compatibility),
          metadata: stringRecord(parsed.data.metadata),
          body: parsed.content.replace(/^\n/, ""),
        });
      }
    } catch { /* Invalid skills are silently skipped */ }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function getStudioLayoutFromProfile(profilePath: string): Promise<{ version: number; views: Record<string, unknown> }> {
  const layoutPath = path.join(profilePath, "layout.json");
  if (await exists(layoutPath)) {
    try {
      const raw = JSON.parse(await readUtf8(layoutPath)) as Record<string, unknown>;
      return { version: (raw.version as number) || 2, views: (isRecord(raw.views) ? raw.views : {}) as Record<string, unknown> };
    } catch { /* fall through */ }
  }
  return { version: 2, views: {} };
}

async function getStudioMetadataFromProfile(profilePath: string): Promise<{ version: number }> {
  const metadataPath = path.join(profilePath, "metadata.json");
  if (await exists(metadataPath)) {
    try {
      const raw = JSON.parse(await readUtf8(metadataPath)) as Record<string, unknown>;
      return { version: (raw.version as number) || 2 };
    } catch { /* fall through */ }
  }
  return { version: 2 };
}

function resolveTeamPath(base: string, teamId: string): string {
  const resolved = path.resolve(path.join(base, teamId));
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Escape from teams directory denied");
  }
  if (teamId.includes("\0")) throw new Error("Invalid team identifier");
  return resolved;
}

// ─── Helpers (duplicated from store.ts to keep this file self-contained) ───

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

function parseProviders(value: unknown): { id: string; name?: string; models: { id: string; name?: string; variants: string[] }[] }[] {
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

function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, content: normalized };
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) return { data: {}, content: normalized };
  const parsed = yamlParse(normalized.slice(4, end)) ?? {};
  if (!isRecord(parsed)) return { data: {}, content: normalized };
  return { data: parsed, content: normalized.slice(end + 5) };
}

function yamlParse(raw: string): unknown {
  try {
    return YAML.parse(raw) ?? {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function optionalString(value: unknown): string | undefined { return typeof value === "string" && value.length ? value : undefined; }
function optionalNumber(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
}
