# Architecture

## Overview

OpenCode Team Studio is a Next.js 14+ application using the App Router. It provides a visual interface for designing and managing OpenCode agent team configurations.

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Team     │  │ Resources│  │ Models / Config│ │
│  │ Canvas   │  │ Editor   │  │ Editor        │  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │               │            │
│  ┌────┴──────────────┴───────────────┴────────┐  │
│  │           Client State (React)             │  │
│  └────────────────────┬───────────────────────┘  │
└───────────────────────┼──────────────────────────┘
                        │ REST API (Server Actions)
┌───────────────────────┼──────────────────────────┐
│            Next.js Server Routes                  │
│  ┌────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Team   │  │ Resources│  │ Configuration    │  │
│  │ Store  │  │ Store    │  │ Store            │  │
│  └───┬────┘  └────┬─────┘  └────────┬─────────┘  │
│      │             │                 │             │
│  ┌───┴─────────────┴─────────────────┴─────────┐  │
│  │         Core Libraries                       │  │
│  │  backup.ts  config-store.ts  filesystem.ts   │  │
│  │  graph.ts  layout.ts  permissions.ts         │  │
│  └──────────────────────┬───────────────────────┘  │
└─────────────────────────┼──────────────────────────┘
                          │ Filesystem
                  ┌───────┴────────┐
                  │  OpenCode      │
                  │  Config Dir    │
                  │  (host volume) │
                  └────────────────┘
```

## Client / Server Separation

### Client components (`"use client"`)

- `src/components/sidebar.tsx` — Navigation sidebar
- `src/components/team/team-studio.tsx` — Main graph canvas and state management
- `src/components/team/agent-inspector.tsx` — Agent detail panel
- `src/components/team/relation-inspector.tsx` — Edge detail panel
- `src/components/team/new-agent-dialog.tsx` — Agent creation modal
- `src/components/team/nodes.tsx` — React Flow custom node components
- `src/components/forms/*` — Form components (permission builder, typed object editor, action select)
- `src/components/configuration/configuration-studio.tsx` — Configuration editor
- `src/components/models/models-studio.tsx` — Model/provider editor
- `src/components/resources/resources-studio.tsx` — Resource management

### Server components and routes

- `src/app/api/*` — REST API endpoints (see Routes below)
- `src/lib/*` — Server-only libraries (guarded by `import "server-only"`)

## Configuration Reading and Writing

### Reading

- `src/lib/config-store.ts` — Reads `opencode.jsonc` or `opencode.json` using `jsonc-parser`
- `src/lib/team/store.ts` — Assembles a `TeamSnapshot` from config, skills, MCPs, providers, and layout
- `src/lib/resources.ts` — Reads agent/skill/command files with YAML frontmatter parsing
- `src/lib/layout-store.ts` — Reads visual layout from `studio-data/team-layout.json`

### Writing

- `src/lib/config-store.ts` — Uses `jsonc-parser` `modify()` + `applyEdits()` to preserve comments, ordering, and unknown fields
- `src/lib/filesystem.ts` — Atomic writes via temporary file + `rename()`
- `src/lib/team/store.ts` — `applyTeamDraft()` orchestrates the full write pipeline

## Graph System

### Data model

- `TeamSnapshot` — Complete state: agents, skills, MCPs, providers, permissions, layout
- `TeamRelation` — Directed edge: source, target, kind (task/skill/mcp/tool/model), action
- `TeamNodeData` — Node metadata: kind, name, label, description, mode, color, status

### Graph generation

- `src/lib/team/graph.ts` — `createTeamGraph()` transforms a `TeamSnapshot` into React Flow nodes and edges
- Views: `organization`, `agent`, `resources`, `complete`
- Filters: disabled agents, denied permissions, inherited rules, resource types

### Layout

- `src/lib/team/layout.ts` — `autoLayoutTeamGraph()` provides a deterministic initial layout
  - Grid-based by node kind for organization/complete views
  - Radial layout for resource view
  - Centered agent layout for agent view
- Positions are saved per-view in `studio-data/team-layout.json`
- Manual drag-and-drop overrides auto-layout; saved positions are preserved
- No cluster/ELK layout — nodes are grouped visually by kind only

## Layout Storage

Layouts are stored in `<config-dir>/studio-data/team-layout.json`:

```json
{
  "version": 2,
  "views": {
    "organization": { "positions": {...}, "viewport": {...} },
    "complete": { "positions": {...} }
  }
}
```

This is separate from the OpenCode configuration files.

## Transactional Backups

- `src/lib/backup.ts` — `withConfigTransaction()` wraps any operation in a backup/restore cycle
- Before applying changes:
  1. Full directory copy (excluding `studio/`, `backups/`, `studio-data/`)
  2. Operation execution
  3. Automatic restore from backup on failure
- Backups stored in `<config-dir>/backups/<ISO-timestamp>/`
- `BACKUP_INFO.json` metadata in each backup directory
- `.gitignore` entries for `backups/` and `studio-data/` are auto-managed

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/team` | Full team snapshot |
| PUT | `/api/team/apply` | Apply team draft with transactional backup |
| GET | `/api/team/agents` | List agents |
| GET | `/api/team/agents/[name]` | Get specific agent |
| PUT | `/api/team/agents/[name]` | Update agent |
| DELETE | `/api/team/agents/[name]` | Delete agent |
| GET | `/api/team/relations` | List all relations |
| PUT | `/api/team/relations` | Update relations |
| GET | `/api/resources/agents` | List agent resources |
| PUT | `/api/resources/agents` | Save/delete agent resource |
| GET | `/api/resources/skills` | List skills |
| PUT | `/api/resources/skills` | Save/delete skill |
| GET | `/api/resources/skills/[name]` | Get specific skill |
| GET | `/api/resources/mcp` | List MCPs |
| PUT | `/api/resources/mcp` | Save/delete MCP |
| GET | `/api/resources/mcp/[name]` | Get specific MCP |
| GET | `/api/configuration` | Read global config |
| PUT | `/api/configuration` | Update global config |
| GET | `/api/health` | Health check endpoint |

## Trust Boundaries

- The server runs with access to the OpenCode config directory
- File paths are validated via `safeConfigPath()` to prevent directory traversal
- Only allowed top-level directories are accessible: `agents`, `commands`, `skills`, `plugins`, config files
- Null bytes and `..` path segments are rejected
- Atomic writes prevent partial file corruption
- No user input is executed as shell commands
- No external network calls are made by the server

## Unknown Field Preservation

The `AgentDefinition` type includes an `extra: Record<string, unknown>` field. When serializing agents back to `opencode.jsonc`:

1. Known fields are written explicitly
2. Unknown fields from the original config are preserved in the `extra` record
3. `jsonc-parser` `modify()` preserves comments and field ordering for existing keys
4. New keys are appended; existing keys retain their position

This ensures round-trip fidelity: changes made in the Studio do not erase custom or future OpenCode properties.
