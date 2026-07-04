# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-04

### Added

- **Multi-team profiles** — Manage multiple team configurations with activation, duplication, and revision history.
- `src/lib/teams/` — Complete multi-team management system (13 files).
- `src/lib/teams/activation.ts` — Transactional team activation with backup and restore.
- `src/lib/teams/storage.ts` — Team profile storage with manifest and metadata management.
- `src/lib/teams/revisions.ts` — Automatic and manual revisions with content hashing (SHA-256).
- `src/lib/teams/profile-snapshot.ts` — Team profile snapshot creation and restoration.
- `src/lib/teams/registry.ts` — Teams registry with active team tracking.
- `src/lib/teams/revision-hash.ts` — Content hashing for team configuration, agents, layout, and metadata.
- `src/lib/teams/migration.ts` — Automatic migration from v0.2 single-team to "Default team" profile.
- `src/lib/teams/validation.ts` — Validation for team IDs, names, configurations, and revisions.
- `src/lib/teams/summary-filename.ts` — Safe filename generation from team names.
- `src/app/api/teams/` — Team management API routes (list, create, activate, duplicate, revisions).
- `src/app/api/teams/[teamId]/revisions/` — Revision management API routes.
- `src/components/teams/teams-page.tsx` — Multi-team management UI.
- `src/app/my-teams/page.tsx` — My Teams page.
- Team summary per team (`/api/teams/[teamId]/summary`).
- 4 new test files: `storage.test.ts`, `validation.test.ts`, `migration.test.ts`, `registry.test.ts`.

### Changed

- `src/lib/team/store.ts` — Refactored to use multi-team activation instead of direct config writes.
- `src/lib/backup.ts` — Renamed backup directory from `backups/` to `backups-config/`; added `calcDirSize()` and `sizeBytes` to backup metadata.
- `src/lib/types.ts` — Extended with multi-team types (`TeamId`, `StoredTeam`, `TeamsRegistry`, `TeamManifest`, `TeamRevision`, `RevisionPreview`, `TransactionSnapshot`).
- `src/lib/layout-store.ts` — Updated for multi-team layout storage.
- `src/lib/metadata-store.ts` — Updated for multi-team metadata storage.
- `src/lib/filesystem.ts` — Enhanced path validation for multi-team storage.
- `src/components/sidebar.tsx` — Added "My Teams" navigation link; updated backup icon.
- `src/app/globals.css` — Added styles for My Teams page and team cards.
- `src/app/team-summary/page.tsx` — Updated for multi-team context.

### Removed

- Direct single-team config writes replaced by team activation workflow.
- `src/app/team/page.tsx` — Replaced by `/my-teams` page.

### Migration

- Automatic migration from v0.2 single-team configuration to a "Default team" profile on first launch.
- Migration is idempotent — does not recreate if registry already exists.

## [0.2.0-alpha.2] - 2026-06-27

### Changed

- Renamed the configuration backup directory from `backups/` to `backups-config/`.

## [0.2.0-alpha.1] - 2026-06-25

### Added

- Visual resource palette with search and drag-and-drop for agents, skills, and MCP servers.
- Semantic connection ports on graph nodes (delegation, skills, MCP, tools, models).
- Drag-and-drop resource placement directly onto the React Flow canvas.
- Four graph views: organization, selected agent, resource-centric, and complete team.
- Deterministic semantic auto-layout per view, matching the semantic port geometry.
- Pinned canvas nodes from the palette with unlinked visual indicator.
- Team summary page with rendered Markdown preview and raw Markdown view.
- Markdown copy-to-clipboard on the team summary page.
- Backups page with restore and delete actions.
- Backup API routes (`/api/backups`, `/api/backups/[id]`, `/api/backups/[id]/restore`).
- `StudioMetadata` type (version 2) for Studio-only metadata, intentionally free of visual clusters.
- Metadata persistence via `studio-data/team-metadata.json`.
- `src/lib/team/drag-payload.ts` — serialization and validation for palette drag payloads.
- `src/lib/team/summary.ts` — pure, deterministic team summary generation.
- Extended backup exclusions: `secrets`, `node_modules`, `.git`.
- Automatic backup pruning (maximum 5 backups kept).
- Health check endpoint at `/api/health` for Docker HEALTHCHECK.
- Non-root container user (`appuser`) in the Docker image.
- Docker HEALTHCHECK instruction in the Dockerfile.

### Changed

- Reworked the graph editing workflow: palette-driven node placement replaces inline dialogs.
- Replaced the single graph view with four context-aware views.
- Removed visual clusters from the metadata model.
- Improved agent configuration and delegation editing with semantic ports.
- Updated all UI labels to English for international accessibility.
- Switched from pnpm to npm as the package manager.
- Updated Dockerfile to use npm and include a non-root user with healthcheck.
- Updated `compose.yaml` to reference the new image tag `v0.2.0-alpha.1`.
- Improved initial graph loading with stored position merging and collision resolution.
- Enhanced permission labels and relation inspector text in English.

### Fixed

- Graph preservation while editing relationships — positions and pinned nodes survive saves.
- Semantic port validation prevents invalid connections with explicit error messages.
- Layout collision resolution for dragged nodes.
- Backup transaction now includes `studio-data` positions and metadata.

### Removed

- Previous cluster-based graph organization from the metadata model.
- pnpm dependency and `pnpm-lock.yaml`.
- `packageManager: "pnpm@10.12.1"` from `package.json`.

### Security

- Docker image now runs as non-root user `appuser`.
- Extended backup exclusions prevent sensitive directories from being backed up.

## [0.1.0-alpha.1] - 2026-06-25

### Added

- Initial public alpha release.
- Visual management of OpenCode agents and relationships.
- Skills, MCP, model, and permission configuration.
- Transactional configuration backups and restoration.
- Docker-based local deployment.
