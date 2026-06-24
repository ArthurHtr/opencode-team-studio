# Security Model

## Overview

OpenCode Team Studio operates as a local web application that reads and writes your OpenCode configuration files. This document describes the trust boundaries, sensitive assets, and security considerations.

## Sensitive Assets

| Asset | Location | Protection |
|-------|----------|------------|
| OpenCode configuration | Mounted volume (`OPENCODE_CONFIG_DIR`) | File permissions (0600 on temp files), path validation |
| Agent prompts | `agents/*.md` | Same as config |
| MCP credentials | `opencode.jsonc` → `mcp.*.environment` | Same as config |
| Provider API keys | `opencode.jsonc` → `provider.*` | Same as config |
| Backup data | `backups/` | Same as config |
| `auth.json` | Never accessed | Studio does not read or write OpenCode auth data |
| Layout data | `studio-data/` | Same as config |

## Trust Boundaries

### Trusted

- The container runtime (Docker)
- The host user running the container (UID/GID mapping)
- The OpenCode configuration directory (mounted volume)
- The application server (runs as non-root)

### Untrusted

- Network input (all API endpoints validate input)
- File content in the config directory (parsed safely, no execution)
- User input in forms (validated against schemas)

## Filesystem Access

### Path validation

All file operations go through `safeConfigPath()` in `src/lib/filesystem.ts`:

1. Only allowed top-level directories are accessible: `agents`, `commands`, `skills`, `plugins`, config files
2. Null bytes in path segments are rejected
3. `..` path segments are rejected
4. `/../` patterns are rejected
5. The resolved path must remain within the config root

### Atomic writes

All file writes use a temporary file + `rename()` pattern:

1. Content is written to `<path>.studio-<pid>-<timestamp>.tmp`
2. On success, the temp file is atomically renamed to the target path
3. This prevents partial file corruption

### File permissions

Temporary files are created with mode `0o600` (owner read/write only).

## Configuration Directory Mounting

The Studio only accesses files within the directory specified by `OPENCODE_CONFIG_DIR`. It cannot:

- Access files outside this directory
- Modify files not in the allowed top-level set
- Follow symlinks outside the config directory (path validation prevents this)

## Secret Management

### Credential policy

The Studio is not a credential manager. It respects this separation:

```
Studio
→ writes provider and model configuration
→ writes model identifiers and non-sensitive options
→ supports environment variable references ({env:VAR_NAME})
→ does NOT read OpenCode credentials
→ does NOT verify credential status
→ does NOT call models directly

OpenCode
→ executes /connect
→ stores credentials
→ calls providers
```

The Studio never mounts, reads, or writes:

```
~/.local/share/opencode/auth.json
```

### Sensitive field detection

When a configuration field name matches common secret patterns (`apiKey`, `api_key`, `token`, `accessToken`, `secret`, `clientSecret`, `password`, `authorization`), the editor:

- Shows a visible warning
- Masks the value (password input)
- Offers an environment variable reference mode
- Writes `{env:VAR_NAME}` instead of the raw value

### Existing secrets preservation

If an existing configuration contains raw secret values that the Studio does not manage:

- The values are preserved if the section is not modified
- They are not displayed in plain text in the UI
- They can be replaced with environment variable references
- They are never silently replaced with `"********"` in the file

The Studio does not log sensitive values in errors or console output.

The Studio does not:

- Store secrets in environment variables
- Log secret values
- Send secrets to external services
- Cache secrets in browser storage

Secrets in your OpenCode configuration (API keys, tokens, MCP credentials) are:

- Read from and written to `opencode.jsonc` as-is
- Never displayed in the UI (MCP environment variables are masked)
- Subject to the same backup/restore protection as other config

## No Telemetry

The Studio does not collect or transmit any telemetry data:

- `NEXT_TELEMETRY_DISABLED=1` is set in the Docker image
- No analytics scripts are included
- No external API calls are made by the server

## Local Network Exposure

By default:

- The Next.js server listens on `0.0.0.0:3000` inside the container
- The Docker port mapping binds to `127.0.0.1:3210` on the host
- The application is not accessible from external networks

To expose externally (not recommended for production):

```bash
-p 3210:3000   # Binds to all interfaces (less secure)
```

Use `127.0.0.1:3210:3000` to restrict to localhost.

## Backup Safety

- Backups are created before every apply operation
- Backup contents exclude Studio-internal directories (`studio/`, `backups/`, `studio-data/`)
- Restore is automatic on apply failure
- Backups can be manually reviewed and restored from the UI

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Path traversal | Low | High | `safeConfigPath()` validation |
| Write outside config dir | Low | High | Path resolution + relative check |
| Secret exposure in logs | Low | High | No secret values logged |
| Incomplete backup | Low | Medium | Transactional backup before every write |
| Destructive restore | Low | High | User-initiated only; automatic only on apply failure |
| Command injection | Low | High | No shell execution; all input validated |
| Network exposure | Medium | Medium | Default binding to localhost |
| Malformed JSONC | Medium | Low | `jsonc-parser` handles gracefully; errors rejected |
| Incorrect permissions | Low | Medium | Non-root container; 0600 temp files |
| Symlink attacks | Low | High | Path validation rejects `..` segments |
| Race conditions | Low | Medium | Sequential queue for backup/apply operations |
| Log leakage | Low | High | Error messages do not include file paths or config values |

## GitHub Private Vulnerability Reporting

If you discover a security vulnerability, please use [GitHub Private Vulnerability Reporting](https://github.com/ArthurHtr/opencode-team-studio/security/advisories/new).

Do not disclose the vulnerability in a public issue.
