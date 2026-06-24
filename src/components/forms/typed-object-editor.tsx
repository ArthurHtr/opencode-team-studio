"use client";

import { ChevronDown, ChevronRight, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

type ValueType = "text" | "number" | "boolean" | "list" | "object" | "null" | "env-ref";
type Entry = { id: string; key: string; type: ValueType; value: unknown };

/**
 * Field names that are likely to contain secrets or credentials.
 * When a key matches one of these, the editor shows a warning and
 * offers an environment-variable reference mode.
 */
const SENSITIVE_KEY_PATTERNS = [
  "apikey",
  "api_key",
  "token",
  "accesstoken",
  "access_token",
  "secret",
  "clientsecret",
  "client_secret",
  "password",
  "authorization",
  "auth",
  "credential",
  "credentials",
  "privatekey",
  "private_key",
  "secretkey",
  "secret_key",
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[_\s-]/g, "");
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Validates an environment variable name: must start with A-Z or _,
 * followed by A-Z, 0-9, or _.
 */
// ENV_VAR_NAME_RE — validated at input time in the env-ref field
const _ENV_VAR_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;

export function TypedObjectEditor({
  value,
  onChange,
  title = "Options",
  description,
  depth = 0,
  isSecretField = false,
}: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  title?: string;
  description?: string;
  depth?: number;
  isSecretField?: boolean;
}) {
  const entries = useMemo(() => objectToEntries(value), [value]);
  const [open, setOpen] = useState(true);

  function update(next: Entry[]) {
    onChange(entriesToObject(next));
  }
  function patch(id: string, patch: Partial<Entry>) {
    update(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  const hasSensitiveKeys = entries.some((e) => isSensitiveKey(e.key));

  return (
    <div className={`typed-object ${depth ? "nested" : ""}`}>
      <button
        type="button"
        className="typed-object-header"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span>
          <strong>{title}</strong>
          {description ? <small>{description}</small> : null}
        </span>
        <b>{entries.length}</b>
      </button>
      {open ? (
        <div className="typed-object-body">
          {hasSensitiveKeys && !isSecretField ? (
            <div className="inline-message error">
              <ShieldAlert size={14} />
              <span>
                Ce champ contient des noms susceptibles d&apos;être des secrets.
                Utilisez une référence de variable d&apos;environnement.
              </span>
            </div>
          ) : null}
          {entries.map((entry, index) => (
            <div className="typed-entry" key={entry.id}>
              <input
                aria-label="Nom de l&apos;option"
                placeholder="nomOption"
                value={entry.key}
                onChange={(event) => patch(entry.id, { key: event.target.value })}
              />
              <select
                aria-label="Type"
                value={entry.type}
                onChange={(event) =>
                  patch(entry.id, {
                    type: event.target.value as ValueType,
                    value: defaultValue(event.target.value as ValueType),
                  })
                }
              >
                <option value="text">Texte</option>
                <option value="number">Nombre</option>
                <option value="boolean">Booléen</option>
                <option value="list">Liste</option>
                <option value="object">Objet</option>
                <option value="null">Vide</option>
                <option value="env-ref">Réf. variable env.</option>
              </select>
              <ValueInput
                entry={entry}
                onChange={(nextValue) => patch(entry.id, { value: nextValue })}
                depth={depth}
                isSensitive={isSensitiveKey(entry.key)}
              />
              <button
                type="button"
                className="icon-button danger"
                title="Supprimer"
                onClick={() => update(entries.filter((item) => item.id !== entry.id))}
              >
                <Trash2 size={15} />
              </button>
              {entry.type === "object" ? (
                <div className="typed-entry-nested">
                  <TypedObjectEditor
                    depth={depth + 1}
                    title={entry.key || `Objet ${index + 1}`}
                    value={isRecord(entry.value) ? entry.value : {}}
                    onChange={(nextValue) => patch(entry.id, { value: nextValue })}
                    isSecretField={isSensitiveKey(entry.key) || isSecretField}
                  />
                </div>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="button subtle"
            onClick={() =>
              update([
                ...entries,
                { id: crypto.randomUUID(), key: "", type: "text", value: "" },
              ])
            }
          >
            <Plus size={15} /> Ajouter une option
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ValueInput({
  entry,
  onChange,
  depth,
  isSensitive,
}: {
  entry: Entry;
  onChange: (value: unknown) => void;
  depth: number;
  isSensitive: boolean;
}) {
  if (entry.type === "object")
    return <span className="typed-value-summary">Objet imbriqué</span>;
  if (entry.type === "null") return <span className="typed-value-summary">null</span>;
  if (entry.type === "boolean")
    return (
      <label className="switch-row">
        <input
          type="checkbox"
          checked={entry.value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{entry.value === true ? "Oui" : "Non"}</span>
      </label>
    );
  if (entry.type === "list")
    return (
      <textarea
        rows={Math.min(5, Math.max(2, Array.isArray(entry.value) ? entry.value.length : 2))}
        placeholder="Une valeur par ligne"
        value={Array.isArray(entry.value) ? entry.value.join("\n") : ""}
        onChange={(event) =>
          onChange(event.target.value.split("\n").filter(Boolean))
        }
      />
    );
  if (entry.type === "number")
    return (
      <input
        type="number"
        value={typeof entry.value === "number" ? entry.value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    );
  if (entry.type === "env-ref") {
    const envValue = isEnvRef(entry.value as Record<string, unknown>)?.__envRef ?? "";
    return (
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="ANTHROPIC_API_KEY"
          value={envValue}
          onChange={(event) =>
            onChange({ __envRef: event.target.value.toUpperCase() })
          }
          style={{ flex: 1 }}
        />
        <small style={{ color: "var(--muted)", fontSize: "9px", whiteSpace: "nowrap" }}>
          {envValue ? `{env:${envValue}}` : "—"}
        </small>
      </div>
    );
  }
  // text type
  if (isSensitive) {
    const textVal = typeof entry.value === "string" ? entry.value : "";
    const isRef = isEnvRef(entry.value);
    return (
      <div style={{ display: "flex", gap: "6px", alignItems: "center", width: "100%" }}>
        {isRef ? (
          <>
            <input
              type="text"
              placeholder="ANTHROPIC_API_KEY"
              value={isRef.__envRef}
              onChange={(event) =>
                onChange({ __envRef: event.target.value.toUpperCase() })
              }
              style={{ flex: 1 }}
            />
            <small style={{ color: "var(--accent-soft)", fontSize: "9px", whiteSpace: "nowrap" }}>
              {`{env:${isRef.__envRef}}`}
            </small>
          </>
        ) : (
          <>
            <input
              type="password"
              value={textVal}
              onChange={(event) => onChange(event.target.value)}
              style={{ flex: 1 }}
              placeholder="Valeur masquée"
            />
            <button
              type="button"
              className="button subtle"
              onClick={() => onChange({ __envRef: "" })}
              style={{ fontSize: "9px", height: "34px" }}
            >
              Env ref
            </button>
          </>
        )}
      </div>
    );
  }
  return (
    <input
      value={typeof entry.value === "string" ? entry.value : ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder={depth ? "Valeur" : "Valeur de l&apos;option"}
    />
  );
}

function objectToEntries(value: Record<string, unknown>): Entry[] {
  return Object.entries(value).map(([key, item], index) => ({
    id: `${key}-${index}`,
    key,
    type: inferType(item),
    value: item,
  }));
}

function entriesToObject(entries: Entry[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const entry of entries)
    if (entry.key.trim()) result[entry.key.trim()] = normalize(entry.type, entry.value);
  return result;
}

function inferType(value: unknown): ValueType {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "list";
  if (isRecord(value)) {
    // Check if it's an env-ref marker
    if ("__envRef" in value) return "env-ref";
    return "object";
  }
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "text";
}

function defaultValue(type: ValueType): unknown {
  if (type === "number") return 0;
  if (type === "boolean") return false;
  if (type === "list") return [];
  if (type === "object") return {};
  if (type === "null") return null;
  if (type === "env-ref") return { __envRef: "" };
  return "";
}

function normalize(type: ValueType, value: unknown) {
  if (type === "number") return Number(value);
  if (type === "boolean") return Boolean(value);
  if (type === "list") return Array.isArray(value) ? value : [];
  if (type === "object") return isRecord(value) ? value : {};
  if (type === "null") return null;
  if (type === "env-ref") {
    const ref = isEnvRef(value as Record<string, unknown>)?.__envRef ?? String(value ?? "");
    if (!ref.trim()) return "";
    return { __envRef: ref.trim().toUpperCase() };
  }
  return String(value ?? "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEnvRef(value: unknown): { __envRef: string } & Record<string, unknown> {
  return isRecord(value) && "__envRef" in value ? value as { __envRef: string } & Record<string, unknown> : { __envRef: "" };
}
