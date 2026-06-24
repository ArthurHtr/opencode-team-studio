# Configuration

## OpenCode Configuration Directory

The Studio reads and writes your OpenCode configuration from a single directory. This directory is mounted into the container as a volume.

The repository can be cloned anywhere — the Studio does not depend on a specific installation path.

### Environment variable

```
OPENCODE_CONFIG_DIR=/path/to/opencode/config
```

Inside the Docker container, this defaults to `/config`. On the host, it typically points to `~/.config/opencode`.

### Files read and modified

The Studio operates on the following files within the config directory:

| File | Purpose |
|------|---------|
| `opencode.jsonc` or `opencode.json` | Main OpenCode configuration |
| `agents/<name>.md` | Agent definitions with YAML frontmatter |
| `skills/<name>/SKILL.md` | Skill definitions |
| `commands/<name>.md` | Command definitions |
| `studio-data/team-layout.json` | Visual layout positions (not part of OpenCode) |
| `backups/<timestamp>/` | Transactional backups (not part of OpenCode) |

### Inherited fields

The Studio preserves all fields in `opencode.jsonc` that it does not explicitly manage. When you modify an agent through the Studio:

1. Known fields (`description`, `mode`, `model`, `variant`, `temperature`, `top_p`, `prompt`, `permission`, `options`, `color`, `disable`, `hidden`, `steps`) are updated
2. Unknown fields present in the original file are preserved
3. New unknown fields added via the Studio's "extra properties" editor are written to the file

### Custom values

The configuration editor (`/configuration` route) allows editing arbitrary top-level keys in `opencode.jsonc`. This includes:

- `provider` — AI provider configurations
- `mcp` — MCP server definitions
- `permission` — Global permission rules
- `default_agent` — Default agent name
- `model` — Default model
- `compaction` — Context compaction settings
- `tool_output` — Tool output limits
- `attachment` — Attachment handling
- `experimental` — Experimental features

### Provider-specific options

Provider configurations (e.g., `provider.openai`, `provider.anthropic`) are stored as-is in `opencode.jsonc`. The Studio's model editor provides a typed interface for:

- Provider selection
- Model ID and display name
- Available variants
- Capability toggles (vision, tools, etc.)

Provider-specific fields not managed by the Studio are preserved.

### Unknown property preservation

The Studio uses `jsonc-parser` for all writes to `opencode.jsonc`. This library:

- Preserves JSON comments (single-line `//` and block `/* */`)
- Preserves trailing commas
- Preserves field ordering
- Preserves unknown fields not explicitly modified

When a field is not touched by the Studio, it remains byte-identical in the output file.

### Permissions

Permissions are stored in two places:

1. **Global** — `opencode.jsonc` → `permission` key
2. **Per-agent** — `agent.permission` object

The Studio maps graph relations to permission rules:

| Relation kind | Permission key | Target |
|---------------|---------------|--------|
| `task` | `permission.task` | Agent name |
| `skill` | `permission.skill` | Skill name |
| `mcp` | `<mcp-name>_*` | Wildcard tool access |
| `tool` | `<tool-name>` | Specific tool |
| `model` | (display only) | — |

Permission values: `allow`, `ask`, `deny`, or `inherit` (resolved from global or parent).

### Empty configuration

When the configuration directory is empty (no `opencode.jsonc`, no `agents/`, no `skills/`), the Studio:

- Returns builtin agents (build, plan, etc.)
- Shows zero custom agents, skills, MCPs, and providers
- Does not create any files on read
- Displays a welcome screen with options to create the first agent or configure a model

Files are created lazily on first write:

- `opencode.jsonc` is created on the first configuration modification
- `agents/` is created on the first agent save
- `skills/<name>/` is created on the first skill save

### Credential policy

OpenCode Team Studio does not manage API keys or credentials:

- Provider authentication is handled by OpenCode via `/connect`
- The Studio does not read, verify, or store credentials
- Sensitive fields in configuration editors support environment variable references (`{env:ANTHROPIC_API_KEY}`)
- When a field name matches common secret patterns (apiKey, token, secret, password, etc.), the editor shows a warning and offers env-var reference mode
- No credentials are logged or sent to external services

### Backups

Backups are created automatically before each team apply operation:

- Location: `<OPENCODE_CONFIG_DIR>/backups/<ISO-timestamp>/`
- Contents: Full directory copy excluding `studio/`, `backups/`, `studio-data/`
- Metadata: `BACKUP_INFO.json` with timestamp, reason, and size
- Restore: Available from the `/backups` route or automatically on apply failure
