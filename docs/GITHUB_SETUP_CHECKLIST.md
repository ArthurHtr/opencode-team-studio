# GitHub Setup Checklist

This checklist describes the manual actions to perform in GitHub after the first push.

## About

Set the repository metadata in **Settings → General → About**:

- **Description:** `A visual workspace for designing, configuring, and managing OpenCode agent teams.`
- **Website:** (optional, add when available)
- **Topics:**
  ```
  opencode
  ai-agents
  agent-orchestration
  multi-agent
  mcp
  react-flow
  nextjs
  docker
  developer-tools
  visual-editor
  ```
- **Social preview:** Upload a screenshot once available (see asset checklist below)

## Features

- [ ] **Issues** — Enabled (default)
- [ ] **Discussions** — Consider enabling for community questions
- [ ] **Wiki** — Disabled (at least initially)
- [ ] **Projects** — Enable when tracking features/bugs
- [ ] **Private vulnerability reporting** — Enabled (required for SECURITY.md)

## Branch Protection

For the `main` branch (**Settings → Branches → Add rule**):

- [ ] **Require a pull request before merging**
  - [ ] Require reviews (1 reviewer for non-maintainer PRs)
  - [ ] Dismiss stale pull request approvals when new commits are pushed
- [ ] **Require CI to pass**
  - CI workflow: `CI`
- [ ] **Require status checks to pass before merging**
  - `Validate (javascript-typescript)`
  - `Docker`
- [ ] **Block force pushes** — Enabled
- [ ] **Block deletions** — Enabled
- [ ] **Require conversation resolution before merging** — Enabled
- [ ] **Require signed commits** — Optional (recommended for maintainer)

**Note on the release model:** This project uses a "one commit per release" model from GitHub. The branch protection rule above allows direct pushes to `main` by the maintainer for release commits. Pull requests are required for community contributions.

## Security

- [ ] **Dependabot alerts** — Enabled (via `.github/dependabot.yml`)
- [ ] **Dependabot security updates** — Enabled
- [ ] **Secret scanning** — Enabled (GitHub default)
- [ ] **Push protection** — Enabled (GitHub default)
- [ ] **CodeQL** — Enabled (via `.github/workflows/codeql.yml`)
- [ ] **Private vulnerability reporting** — Enabled

## Packages

- [ ] **GHCR visibility** — Set to `public`
  - Go to **Packages → opencode-team-studio → Settings**
  - Set visibility to `Public`
- [ ] **Verify tags** — After first release, confirm:
  - `0.1.0-alpha.1` tag exists
  - `v0.1.0-alpha.1` tag exists
  - `latest` tag does NOT exist (prerelease)

## Releases

- [ ] **Verify prerelease handling** — After first release:
  - The `v0.1.0-alpha.1` release should be marked as `Prerelease`
  - It should NOT be set as `Latest` pre-release
  - Stable releases (e.g., `v1.0.0`) should be marked as `Latest`

## Authorship and Proof of Creation

- [ ] **NOTICE** — Verify file exists and contains correct attribution
- [ ] **AUTHORS.md** — Verify file exists and lists Arthur Hottier
- [ ] **CITATION.cff** — Verify file exists and is valid YAML
- [ ] **First release** — Create a dated GitHub Release for `v0.1.0-alpha.1`
- [ ] **Signed tags** — Keep all release tags signed (`git tag -s`)
- [ ] **GitLab evidence** — Preserve earlier GitLab commits as prior art
- [ ] **External proof** — Consider filing a deposit (e.g., e-Soleau) for formal prior art evidence

> **Note:** A GitHub repository does not protect an abstract idea or create a patent. It provides a timestamped record of the codebase state. For formal intellectual property protection, consult a legal professional.

## Asset Production Checklist

Before publishing the first release, produce these assets:

- [ ] Main screenshot of the team graph view
- [ ] Screenshot of the agent inspector
- [ ] Screenshot of the resources view
- [ ] Demo GIF (optional but recommended)
- [ ] Social preview image (1280x640 recommended)
- [ ] Place assets in `docs/assets/`
