import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { atomicWrite, exists, readUtf8, removePath, safeConfigPath } from "@/lib/filesystem";
import type { ResourceDocument, ResourceKind, ResourceSummary } from "@/lib/types";

const RESOURCE_DIR: Record<ResourceKind, string> = {
  agents: "agents",
  commands: "commands",
  skills: "skills",
};

const STANDARD_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateResourceName(kind: ResourceKind, name: string): string {
  const trimmed = name.trim();
  const valid = kind === "skills" ? SKILL_NAME.test(trimmed) : STANDARD_NAME.test(trimmed);
  if (!valid) {
    throw new Error(kind === "skills"
      ? "The skill name must be lowercase with single hyphens."
      : "The name contains invalid characters.");
  }
  return trimmed;
}

function resourcePath(kind: ResourceKind, name: string): string {
  const validName = validateResourceName(kind, name);
  if (kind === "skills") return safeConfigPath("skills", validName, "SKILL.md");
  return safeConfigPath(RESOURCE_DIR[kind], `${validName}.md`);
}

function resourceContainerPath(kind: ResourceKind, name: string): string {
  return kind === "skills"
    ? safeConfigPath("skills", validateResourceName(kind, name))
    : resourcePath(kind, name);
}

export async function listResources(kind: ResourceKind): Promise<ResourceSummary[]> {
  const directory = safeConfigPath(RESOURCE_DIR[kind]);
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory, { withFileTypes: true });
  const names = kind === "skills"
    ? entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    : entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map((entry) => entry.name.slice(0, -3));

  const resources = await Promise.all(names.sort().map(async (name) => {
    try {
      const document = await readResource(kind, name);
      return {
        name: document.name,
        description: document.description,
        path: document.path,
        mode: document.mode,
        model: document.model,
        disabled: document.disabled,
        metadata: document.metadata,
      } satisfies ResourceSummary;
    } catch {
      return {
        name,
        description: "Unreadable file or invalid frontmatter",
        path: path.relative(safeConfigPath(RESOURCE_DIR[kind]), resourcePath(kind, name)),
        metadata: {},
      } satisfies ResourceSummary;
    }
  }));
  return resources;
}

export async function readResource(kind: ResourceKind, name: string): Promise<ResourceDocument> {
  const filePath = resourcePath(kind, name);
  if (!(await exists(filePath))) throw new Error("Resource not found");
  const raw = await readUtf8(filePath);
  const parsed = parseFrontmatter(raw);
  const metadata = parsed.data;
  return {
    name,
    description: String(metadata.description || ""),
    path: path.relative(safeConfigPath(RESOURCE_DIR[kind]), filePath),
    mode: typeof metadata.mode === "string" ? metadata.mode : undefined,
    model: typeof metadata.model === "string" ? metadata.model : undefined,
    disabled: typeof metadata.disable === "boolean" ? metadata.disable : undefined,
    metadata,
    body: parsed.content.replace(/^\n/, ""),
  };
}

export async function saveResource(
  kind: ResourceKind,
  originalName: string | null,
  input: { name: string; metadata: Record<string, unknown>; body: string },
): Promise<ResourceDocument> {
  const name = validateResourceName(kind, input.name);
  const target = resourcePath(kind, name);
  if ((!originalName || originalName !== name) && (await exists(target))) throw new Error("A resource already has this name");

  if (kind === "skills") {
    input.metadata.name = name;
    if (!String(input.metadata.description || "").trim()) throw new Error("The skill description is required");
  }
  if (kind === "agents" && !String(input.metadata.description || "").trim()) {
    throw new Error("La description de l’agent est obligatoire");
  }

  const serialized = stringifyFrontmatter(input.metadata, input.body);
  await atomicWrite(target, serialized);

  if (originalName && originalName !== name) {
    const previous = resourceContainerPath(kind, originalName);
    if (kind === "skills") {
      const targetDirectory = resourceContainerPath(kind, name);
      const oldSkillFile = resourcePath(kind, originalName);
      if (await exists(oldSkillFile)) {
        await removePath(previous);
      }
      await mkdir(targetDirectory, { recursive: true });
    } else if (await exists(previous)) {
      await removePath(previous);
    }
  }

  return readResource(kind, name);
}

export async function deleteResource(kind: ResourceKind, name: string): Promise<void> {
  await removePath(resourceContainerPath(kind, name));
}


function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, content: normalized };
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("YAML frontmatter not closed");
  const yamlText = normalized.slice(4, end);
  const parsed = YAML.parse(yamlText) ?? {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The frontmatter must be a YAML object");
  return { data: parsed as Record<string, unknown>, content: normalized.slice(end + 5) };
}

function stringifyFrontmatter(data: Record<string, unknown>, body: string): string {
  const yamlText = YAML.stringify(data, { lineWidth: 0 }).trimEnd();
  return `---\n${yamlText}\n---\n\n${body.trimEnd()}\n`;
}
