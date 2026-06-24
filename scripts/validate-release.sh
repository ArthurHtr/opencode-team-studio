#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# validate-release.sh — Pre-release validation script
# ---------------------------------------------------------------------------
# Usage: ./scripts/validate-release.sh <version>
# Example: ./scripts/validate-release.sh 0.1.0-alpha.1
# ---------------------------------------------------------------------------

EXPECTED_VERSION="${1:-}"

if [ -z "$EXPECTED_VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.1.0-alpha.1"
  exit 1
fi

ERRORS=0
WARNINGS=0

echo "============================================"
echo "  OpenCode Team Studio — Release Validation"
echo "  Target version: $EXPECTED_VERSION"
echo "============================================"
echo ""

# 1. Git root check
echo "[1/10] Checking Git repository..."
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "  FAIL: Not inside a Git repository"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: Git repository found"
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "  WARN: Uncommitted changes detected"
  WARNINGS=$((WARNINGS + 1))
  git status --porcelain
else
  echo "  OK: Working tree is clean"
fi

# 2. No sensitive files tracked
echo ""
echo "[2/10] Checking for sensitive files..."
SENSITIVE_FILES=$(git ls-files | grep -E '\.env$|\.env\.\w+$|\.env\.\w+\.\w+$|backups/|studio-data/' | grep -v '\.env\.example' || true)
if [ -n "$SENSITIVE_FILES" ]; then
  echo "  FAIL: Sensitive files are tracked:"
  echo "$SENSITIVE_FILES"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: No sensitive files tracked"
fi

# 3. No absolute personal paths
echo ""
echo "[3/10] Checking for absolute personal paths..."
PERSONAL_PATHS=$(grep -rn '/home/arthur' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.md' --include='*.yml' --include='*.yaml' --exclude-dir='.git' --exclude-dir='node_modules' --exclude-dir='.next' . 2>/dev/null || true)
if [ -n "$PERSONAL_PATHS" ]; then
  echo "  FAIL: Personal paths found:"
  echo "$PERSONAL_PATHS"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: No personal paths found"
fi

# 4. package.json version
echo ""
echo "[4/10] Checking package.json version..."
PKG_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "NOT_FOUND")
if [ "$PKG_VERSION" = "NOT_FOUND" ]; then
  echo "  FAIL: Cannot read package.json version"
  ERRORS=$((ERRORS + 1))
elif [ "$PKG_VERSION" != "$EXPECTED_VERSION" ]; then
  echo "  FAIL: package.json version is '$PKG_VERSION', expected '$EXPECTED_VERSION'"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: package.json version matches ($PKG_VERSION)"
fi

# 5. CITATION.cff version
echo ""
echo "[5/10] Checking CITATION.cff..."
if [ ! -f "CITATION.cff" ]; then
  echo "  FAIL: CITATION.cff not found"
  ERRORS=$((ERRORS + 1))
else
  CFF_VERSION=$(grep '^version:' CITATION.cff | head -1 | sed 's/version: *//' | tr -d '"' | tr -d "'")
  if [ "$CFF_VERSION" != "$EXPECTED_VERSION" ]; then
    echo "  WARN: CITATION.cff version is '$CFF_VERSION', expected '$EXPECTED_VERSION'"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  OK: CITATION.cff version matches ($CFF_VERSION)"
  fi
fi

# 6. CHANGELOG.md
echo ""
echo "[6/10] Checking CHANGELOG.md..."
if [ ! -f "CHANGELOG.md" ]; then
  echo "  FAIL: CHANGELOG.md not found"
  ERRORS=$((ERRORS + 1))
elif ! grep -q "\[$EXPECTED_VERSION\]" CHANGELOG.md; then
  echo "  FAIL: CHANGELOG.md does not contain version $EXPECTED_VERSION"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: CHANGELOG.md contains version $EXPECTED_VERSION"
fi

# 7. Required files
echo ""
echo "[7/10] Checking required files..."
REQUIRED_FILES="LICENSE NOTICE AUTHORS.md CITATION.cff CHANGELOG.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md ROADMAP.md README.md Dockerfile compose.yaml .gitignore .dockerignore .nvmrc"
MISSING_FILES=""
for f in $REQUIRED_FILES; do
  if [ ! -f "$f" ]; then
    MISSING_FILES="$MISSING_FILES $f"
  fi
done
if [ -n "$MISSING_FILES" ]; then
  echo "  FAIL: Missing required files:$MISSING_FILES"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: All required files present"
fi

# 8. Install and typecheck
echo ""
echo "[8/10] Installing dependencies and type checking..."
if ! corepack enable 2>/dev/null; then
  echo "  WARN: corepack not available, skipping pnpm install"
else
  if ! pnpm install --frozen-lockfile 2>&1; then
    echo "  FAIL: pnpm install failed"
    ERRORS=$((ERRORS + 1))
  else
    echo "  OK: Dependencies installed"
  fi

  if ! pnpm run typecheck 2>&1; then
    echo "  FAIL: TypeScript typecheck failed"
    ERRORS=$((ERRORS + 1))
  else
    echo "  OK: TypeScript typecheck passed"
  fi
fi

# 9. Lint and test
echo ""
echo "[9/10] Linting and testing..."
if ! pnpm run lint 2>&1; then
  echo "  FAIL: ESLint failed"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: ESLint passed"
fi

if ! pnpm run test 2>&1; then
  echo "  FAIL: Tests failed"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: Tests passed"
fi

# 10. Build
echo ""
echo "[10/10] Building..."
if ! pnpm run build 2>&1; then
  echo "  FAIL: Build failed"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: Build passed"
fi

# Docker checks (optional, require Docker)
echo ""
echo "[Extra] Docker checks (if Docker is available)..."
if command -v docker >/dev/null 2>&1; then
  if ! docker build -t opencode-team-studio:validate-release-test . >/dev/null 2>&1; then
    DOCKER_BUILD_RESULT=$(docker build -t opencode-team-studio:validate-release-test . 2>&1 || true)
    if echo "$DOCKER_BUILD_RESULT" | grep -qi 'permission denied\|socket'; then
      echo "  SKIP: Docker build inaccessible (API/permission issue)"
    else
      echo "  FAIL: Docker build failed"
      echo "$DOCKER_BUILD_RESULT"
      ERRORS=$((ERRORS + 1))
    fi
  else
    echo "  OK: Docker build passed"
  fi

  if ! docker compose config >/dev/null 2>&1; then
    echo "  WARN: Docker Compose config validation failed"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  OK: Docker Compose config valid"
  fi
else
  echo "  SKIP: Docker not available"
fi

# Summary
echo ""
echo "============================================"
echo "  Summary"
echo "============================================"
echo "  Errors:   $ERRORS"
echo "  Warnings: $WARNINGS"
echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo "  RESULT: FAIL — $ERRORS error(s) found"
  echo "  Fix the errors before publishing."
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo "  RESULT: WARN — $WARNINGS warning(s) found"
  echo "  Review warnings before publishing."
  exit 0
else
  echo "  RESULT: PASS — All checks passed"
  exit 0
fi
