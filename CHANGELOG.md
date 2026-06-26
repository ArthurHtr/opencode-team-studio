# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0-alpha.1] - Unreleased

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
