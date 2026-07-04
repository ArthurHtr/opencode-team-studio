"use client";

import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

type ValueType = "text" | "number" | "boolean" | "list" | "object" | "null";
type Entry = { id: string; key: string; type: ValueType; value: unknown };

export function TypedObjectEditor({ value, onChange, title = "Options", description, depth = 0 }: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  title?: string;
  description?: string;
  depth?: number;
}) {
  const entries = useMemo(() => objectToEntries(value), [value]);
  const [open, setOpen] = useState(true);

  function update(next: Entry[]) { onChange(entriesToObject(next)); }
  function patch(id: string, patch: Partial<Entry>) { update(entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry)); }

  return (
    <div className={`typed-object ${depth ? "nested" : ""}`}>
      <button type="button" className="typed-object-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span><strong>{title}</strong>{description ? <small>{description}</small> : null}</span>
        <b>{entries.length}</b>
      </button>
      {open ? <div className="typed-object-body">
        {entries.map((entry, index) => (
          <div className="typed-entry" key={entry.id}>
            <input aria-label="Option name" placeholder="optionName" value={entry.key} onChange={(event) => patch(entry.id, { key: event.target.value })} />
            <select aria-label="Type" value={entry.type} onChange={(event) => patch(entry.id, { type: event.target.value as ValueType, value: defaultValue(event.target.value as ValueType) })}>
              <option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="list">List</option><option value="object">Object</option><option value="null">Null</option>
            </select>
            <ValueInput entry={entry} onChange={(nextValue) => patch(entry.id, { value: nextValue })} depth={depth} />
            <button type="button" className="icon-button danger" title="Delete" onClick={() => update(entries.filter((item) => item.id !== entry.id))}><Trash2 size={15} /></button>
            {entry.type === "object" ? <div className="typed-entry-nested"><TypedObjectEditor depth={depth + 1} title={entry.key || `Object ${index + 1}`} value={isRecord(entry.value) ? entry.value : {}} onChange={(nextValue) => patch(entry.id, { value: nextValue })} /></div> : null}
          </div>
        ))}
        <button type="button" className="button subtle" onClick={() => update([...entries, { id: crypto.randomUUID(), key: "", type: "text", value: "" }])}><Plus size={15} /> Add option</button>
      </div> : null}
    </div>
  );
}

function ValueInput({ entry, onChange, depth }: { entry: Entry; onChange: (value: unknown) => void; depth: number }) {
  if (entry.type === "object") return <span className="typed-value-summary">Nested object</span>;
  if (entry.type === "null") return <span className="typed-value-summary">null</span>;
  if (entry.type === "boolean") return <label className="switch-row"><input type="checkbox" checked={entry.value === true} onChange={(event) => onChange(event.target.checked)} /><span>{entry.value === true ? "Yes" : "No"}</span></label>;
  if (entry.type === "list") return <textarea rows={Math.min(5, Math.max(2, Array.isArray(entry.value) ? entry.value.length : 2))} placeholder="One value per line" value={Array.isArray(entry.value) ? entry.value.join("\n") : ""} onChange={(event) => onChange(event.target.value.split("\n").filter(Boolean))} />;
  if (entry.type === "number") return <input type="number" value={typeof entry.value === "number" ? entry.value : 0} onChange={(event) => onChange(Number(event.target.value))} />;
  return <input value={typeof entry.value === "string" ? entry.value : ""} onChange={(event) => onChange(event.target.value)} placeholder={depth ? "Value" : "Option value"} />;
}

function objectToEntries(value: Record<string, unknown>): Entry[] {
  return Object.entries(value).map(([key, item], index) => ({ id: `${key}-${index}`, key, type: inferType(item), value: item }));
}
function entriesToObject(entries: Entry[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const entry of entries) if (entry.key.trim()) result[entry.key.trim()] = normalize(entry.type, entry.value);
  return result;
}
function inferType(value: unknown): ValueType {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "list";
  if (isRecord(value)) return "object";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "text";
}
function defaultValue(type: ValueType): unknown { return type === "number" ? 0 : type === "boolean" ? false : type === "list" ? [] : type === "object" ? {} : type === "null" ? null : ""; }
function normalize(type: ValueType, value: unknown) { if (type === "number") return Number(value); if (type === "boolean") return Boolean(value); if (type === "list") return Array.isArray(value) ? value : []; if (type === "object") return isRecord(value) ? value : {}; if (type === "null") return null; return String(value ?? ""); }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
