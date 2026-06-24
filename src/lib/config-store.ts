import "server-only";

import { applyEdits, modify, parse, type ParseError, printParseErrorCode } from "jsonc-parser";
import { atomicWrite, exists, readUtf8, safeConfigPath } from "@/lib/filesystem";

const CANDIDATES = ["opencode.jsonc", "opencode.json"] as const;

type ConfigUpdate = { path: (string | number)[]; value: unknown };

export async function getConfigDocument(): Promise<{ filename: string; content: string; value: Record<string, unknown>; errors: string[] }> {
  const filename = await findConfigFilename();
  const filePath = safeConfigPath(filename);
  const content = (await exists(filePath)) ? await readUtf8(filePath) : defaultConfig();
  return { filename, content, value: parseJsoncObject(content), errors: validateJsonc(content) };
}

export async function updateConfigPath(path: (string | number)[], value: unknown): Promise<Record<string, unknown>> {
  return updateConfigPaths([{ path, value }]);
}

/** Applies several edits while preserving comments, ordering and unknown fields. */
export async function updateConfigPaths(updates: ConfigUpdate[]): Promise<Record<string, unknown>> {
  const document = await getConfigDocument();
  let next = document.content;
  for (const update of updates) {
    const edits = modify(next, update.path, update.value, {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" },
    });
    next = applyEdits(next, edits);
  }
  const errors = validateJsonc(next);
  if (errors.length) throw new Error(errors.join("\n"));
  await atomicWrite(safeConfigPath(document.filename), next.endsWith("\n") ? next : `${next}\n`);
  return parseJsoncObject(next);
}

export async function replaceConfigObjectPreservingFormatting(value: Record<string, unknown>): Promise<void> {
  const document = await getConfigDocument();
  const keys = new Set([...Object.keys(document.value), ...Object.keys(value)]);
  await updateConfigPaths([...keys].map((key) => ({ path: [key], value: value[key] })));
}

export async function saveConfigObject(value: Record<string, unknown>): Promise<void> {
  const document = await getConfigDocument();
  const next = `${JSON.stringify(value, null, 2)}\n`;
  await atomicWrite(safeConfigPath(document.filename), next);
}

async function findConfigFilename(): Promise<string> {
  for (const filename of CANDIDATES) {
    if (await exists(safeConfigPath(filename))) return filename;
  }
  return CANDIDATES[0];
}

function defaultConfig(): string {
  return `{\n  "$schema": "https://opencode.ai/config.json"\n}\n`;
}

export function validateJsonc(content: string): string[] {
  const errors: ParseError[] = [];
  parse(content, errors, { allowTrailingComma: true, disallowComments: false });
  return errors.map((error) => `${printParseErrorCode(error.error)} à l’offset ${error.offset}`);
}

export function parseJsoncObject(content: string): Record<string, unknown> {
  const errors: ParseError[] = [];
  const value = parse(content, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length || !value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
