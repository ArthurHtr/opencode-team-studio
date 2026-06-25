# Release Process

This document describes the process for publishing a new release of OpenCode Team Studio.

## Development model

OpenCode Team Studio is primarily developed in a private GitLab repository.

This GitHub repository contains reviewed public release snapshots.

Issues, feature requests, and pull requests are welcome on GitHub. Accepted changes
may be integrated into the private development repository and included in
a subsequent public release.

## Variables

```bash
PRIVATE_REPO="/path/to/private-gitlab-repository"
PUBLIC_REPO="/path/to/public-github-repository"
VERSION="v0.1.0-alpha.1"
PACKAGE_VERSION="0.1.0-alpha.1"
```

## Part 1 — In the private GitLab repository

### 1. Stabilize

```bash
cd "$PRIVATE_REPO"
git checkout main
git pull origin main
```

Ensure the working tree is clean:

```bash
git status --porcelain
# Should produce no output
```

### 2. Update version and changelog

Edit `package.json`:

```json
{
  "version": "0.1.0-alpha.1"
}
```

Edit `CHANGELOG.md` — replace `[Unreleased]` with the version and date.

### 3. Run all validations

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

### 4. Create a signed tag

```bash
git add package.json CHANGELOG.md
git commit -m "Release $VERSION"
git tag -s "$VERSION" -m "Release $VERSION"
```

### 5. Export the release snapshot

```bash
git archive --format=tar.gz -o "/tmp/opencode-team-studio-${PACKAGE_VERSION}.tar.gz" "$VERSION"
```

## Part 2 — In the public GitHub repository clone

### 1. Synchronize the snapshot

```bash
cd "$PUBLIC_REPO"
git checkout main
git pull origin main

rsync -av --delete \
  --exclude='.git' \
  --exclude='.gitlab*' \
  --exclude='.private/' \
  "/tmp/release-content/" "./"
```

### 2. Verify no secrets

```bash
# Check for .env files
git ls-files | grep -E '\.env$|\.env\.' || echo "No .env files tracked"

# Check for absolute personal paths
grep -rn '/home/' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.md' . | grep -v node_modules || echo "No personal paths found"

# Check for secrets
grep -rn 'token.*=.*[a-zA-Z0-9]\{10,\}\|api[_-]?key.*=.*[a-zA-Z0-9]\{10,\}' --include='*.ts' --include='*.tsx' . || echo "No secrets found"
```

### 3. Run validations

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
docker build -t opencode-team-studio:"$PACKAGE_VERSION" .
docker compose config
```

### 4. Create a single release commit

```bash
git add -A
git commit -m "Release $VERSION"
```

### 5. Create the signed tag

```bash
git tag -s "$VERSION" -m "Release $VERSION"
```

### 6. Push

```bash
git push origin main
git push origin "$VERSION"
```

### 7. Let GitHub Actions build and publish

Pushing the tag triggers:
- `container.yml` — builds and publishes the Docker image to GHCR
- `release.yml` — creates a GitHub Release
- `ci.yml` — runs the full CI pipeline

## Version types

| Pattern | Prerelease? | `latest` tag? |
|---------|------------|---------------|
| `v0.1.0-alpha.1` | Yes | No |
| `v0.1.0-beta.1` | Yes | No |
| `v0.1.0-rc.1` | Yes | No |
| `v0.1.0` | No | Yes |
| `v1.0.0` | No | Yes |

## Key differences

| Concept | Description |
|---------|------------|
| **Git tag** | Lightweight or signed annotation in the Git repository (e.g. `v0.1.0-alpha.1`) |
| **GitHub Release** | GitHub UI entity with release notes, attached assets, and download links |
| **Docker image** | Container image published to GHCR, tagged with the version |
| **package.json version** | Semantic version string used by Node.js tooling (no `v` prefix) |

## Tag conventions

For version `0.1.0-alpha.1`:

| File / System | Value |
|---------------|-------|
| `package.json` version | `0.1.0-alpha.1` (no `v`) |
| `CITATION.cff` version | `0.1.0-alpha.1` (no `v`) |
| Git tag | `v0.1.0-alpha.1` (with `v`) |
| GHCR image tag | `v0.1.0-alpha.1` (with `v`) |
| GitHub Release tag | `v0.1.0-alpha.1` (with `v`) |

The `v` prefix is used for Git tags, Docker images, and GitHub Releases.
The `package.json` and `CITATION.cff` use the bare semantic version without `v`.

### Prerelease vs stable tags

The `container.yml` workflow applies different Docker tags based on the version type:

| Version type | Docker tags published |
|-------------|----------------------|
| `v0.1.0-alpha.1` | `v0.1.0-alpha.1`, `0.1.0-alpha.1` (no `latest`) |
| `v0.1.0-beta.1` | `v0.1.0-beta.1`, `0.1.0-beta.1` (no `latest`) |
| `v0.1.0-rc.1` | `v0.1.0-rc.1`, `0.1.0-rc.1` (no `latest`) |
| `v0.1.0` | `v0.1.0`, `0.1.0`, `0.1`, `0`, `latest` |
| `v1.2.3` | `v1.2.3`, `1.2.3`, `1.2`, `1`, `latest` |

**Never** publish `latest` for a prerelease. The workflow enforces this.

## Correct release order

For the next version:

1. Export the version from GitLab to the public GitHub repository
2. Push the release commit to `main`
3. Wait for CI to pass (all checks green)
4. Create and push the signed Git tag
5. Wait for GHCR image publication
6. Verify or create the GitHub Release
7. Test `docker pull` from GHCR

All four should match for a given release.

## Release checklist

- [ ] `main` branch is stable and all CI checks pass
- [ ] Working tree is clean
- [ ] `package.json` version is updated
- [ ] `CHANGELOG.md` is updated with version and date
- [ ] All validations pass (`pnpm run check`)
- [ ] Docker image builds successfully
- [ ] Docker Compose validates (`docker compose config`)
- [ ] No secrets or private data in the repository
- [ ] Signed tag created (`git tag -s`)
- [ ] Tag pushed to remote
- [ ] GitHub Actions completes (CI, container, release)
- [ ] GHCR image is published and accessible
- [ ] GitHub Release is created and not marked as prerelease for stable versions
- [ ] `latest` tag is only set for non-prerelease versions
