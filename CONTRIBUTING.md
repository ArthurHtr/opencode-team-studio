# Contributing to OpenCode Team Studio

Thank you for your interest in contributing to OpenCode Team Studio!

## Development model

OpenCode Team Studio is primarily developed in a private GitLab repository.

This GitHub repository contains reviewed public release snapshots.

Issues, feature requests, and pull requests are welcome. Accepted changes
may be integrated into the private development repository and included in
a subsequent public release.

All contributions will be credited to you in the [AUTHORS.md](./AUTHORS.md) file.

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Commands](#development-commands)
- [TypeScript Conventions](#typescript-conventions)
- [Testing](#testing)
- [OpenCode File Behavior](#opencode-file-behavior)
- [JSONC Preservation](#jsonc-preservation)
- [Security](#security)
- [Pull Request Procedure](#pull-request-procedure)
- [Code of Conduct](#code-of-conduct)

## Getting Started

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm 10 (via corepack)
- Docker (for full validation)

### Local Installation

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Open `http://127.0.0.1:3000`.

Set your OpenCode config directory:

```bash
OPENCODE_CONFIG_DIR=~/.config/opencode pnpm run dev
```

## Project Structure

```
opencode-team-studio/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # REST API routes
│   │   │   ├── team/           # Team snapshot, agents, relations, apply
│   │   │   ├── resources/      # Skills, MCPs
│   │   │   └── configuration/  # Global config
│   │   ├── team/page.tsx       # Main graph view
│   │   ├── resources/page.tsx  # Resource management
│   │   ├── models/page.tsx     # Model/provider configuration
│   │   └── configuration/page.tsx
│   ├── components/
│   │   ├── team/               # Graph canvas, inspector, nodes
│   │   ├── forms/              # Form builders
│   │   └── ...                 # UI components
│   └── lib/
│       ├── team/               # Graph, layout, permissions, store
│       ├── backup.ts           # Transactional backups
│       ├── config-store.ts     # JSONC read/write
│       ├── filesystem.ts       # Safe file operations
│       └── resources.ts        # Resource CRUD
├── tests/                      # Test infrastructure
├── docs/                       # Documentation
├── examples/                   # Example configurations
└── scripts/                    # Utility scripts
```

## Development Commands

```bash
pnpm run dev          # Start development server
pnpm run build        # Production build
pnpm run start        # Start production server
pnpm run typecheck    # TypeScript type checking
pnpm run lint         # ESLint
pnpm run test         # Run tests
pnpm run check        # Full validation (typecheck + lint + test + build)
pnpm run format       # Format all files
pnpm run format:check # Check formatting
```

## TypeScript Conventions

- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- No `any` types — use `unknown` when necessary
- Explicit return types on public functions
- Use the existing type definitions in `src/lib/types.ts`
- Server-only code imports `"server-only"` at the top
- No `skipLibCheck` or `ignoreErrors` — fix the actual issue

## Testing

Tests are written with Vitest and located alongside the code they test (`*.test.ts`).

```bash
pnpm run test           # Run all tests
pnpm run test:watch     # Watch mode
```

### What to test

- Configuration parsing and serialization
- Atomic write behavior
- JSONC comment preservation
- Unknown field preservation
- Backup creation and restoration
- Path validation (traversal prevention)
- Symlink handling
- Relation creation and deletion
- Graph layout determinism
- Permission evaluation

### Test data

- Use only fictive data in fixtures
- Never include real agent names, prompts, or credentials
- Use `os.tmpdir()` for temporary test directories
- Clean up test data in `afterEach`

## OpenCode File Behavior

### How the Studio reads OpenCode

1. Reads `opencode.jsonc` (or `opencode.json`) using `jsonc-parser`
2. Reads agent definitions from `agents/*.md` (YAML frontmatter + markdown body)
3. Reads skills from `skills/<name>/SKILL.md`
4. Reads MCP, provider, and permission config from the main config file

### How the Studio writes OpenCode

1. Uses `jsonc-parser` `modify()` + `applyEdits()` for atomic field updates
2. Preserves comments, trailing commas, and field ordering
3. Unknown fields are never removed
4. New fields are appended; existing fields retain their position

### Agent sources

- `builtin` — Built-in agents (build, plan, etc.) defined in code
- `config` — Agents defined in `opencode.jsonc` under the `agents` key
- `file` — Agents defined in `agents/*.md` files

## JSONC Preservation

The Studio uses `jsonc-parser` for all writes to `opencode.jsonc`. This ensures:

- `//` and `/* */` comments are preserved
- Trailing commas are preserved
- Field ordering is preserved
- Unknown fields are untouched
- Whitespace around edited fields is preserved

When adding a new field that doesn't exist in the config, it is appended.
When modifying an existing field, only that field's value changes.

## Security

### Do

- Validate all user input before passing to file operations
- Use `safeConfigPath()` for all filesystem paths
- Write temp files with mode `0o600`
- Use atomic writes (temp file + rename)
- Run `pnpm run check` before submitting PRs

### Don't

- Execute shell commands based on user input
- Log secret values or full file paths
- Follow symlinks outside the config directory
- Use `eval()`, `exec()`, or `child_process`
- Store secrets in environment variables or browser storage

## Pull Request Procedure

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run `pnpm run check` to ensure all validations pass
5. Add or update tests as needed
6. Update documentation if behavior changes
7. Submit a pull request

### PR checklist

- [ ] Summary of changes
- [ ] Motivation for the change
- [ ] Type of change (feature, fix, refactor, docs, test)
- [ ] Tests executed and passing
- [ ] Impact on OpenCode configurations documented
- [ ] Impact on backups documented (if applicable)
- [ ] Security checklist reviewed
- [ ] Documentation updated
- [ ] Screenshots for visual changes

### Security checklist

- [ ] No secrets or credentials in the PR
- [ ] No personal data in fixtures or examples
- [ ] Path validation tested (if filesystem changes)
- [ ] No new external network calls
- [ ] No new environment variables that could contain secrets

## Continuous integration

Every push and pull request to `main` is validated automatically:

- Dependency installation from the lockfile (`pnpm install --frozen-lockfile`)
- TypeScript type checking (`pnpm run typecheck`)
- Linting (`pnpm run lint`)
- Automated tests (`pnpm run test`)
- Next.js production build (`pnpm run build`)
- Docker image build (`docker build`)
- Docker Compose validation (`docker compose config`)

All CI checks must pass before a pull request can be merged.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).
By participating, you agree to abide by its terms.
