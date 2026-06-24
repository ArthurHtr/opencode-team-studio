#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# start.sh — Robust local Docker startup script
# ---------------------------------------------------------------------------
# Works with or without sudo.
# Never uses /root/.config/opencode when the real user is different.
# ---------------------------------------------------------------------------

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Determine the real user's UID/GID.
# When run via sudo, SUDO_UID/SUDO_GID are set by sudo.
# When run directly, use id -u / id -g.
LOCAL_UID_VALUE="${SUDO_UID:-$(id -u)}"
LOCAL_GID_VALUE="${SUDO_GID:-$(id -g)}"

# Detect or prompt for the OpenCode config directory.
# Default to $HOME/.config/opencode of the real user.
OPENCODE_HOST_CONFIG_DIR="${OPENCODE_HOST_CONFIG_DIR:-${HOME}/.config/opencode}"

# Create the directory if it does not exist.
if [ ! -d "$OPENCODE_HOST_CONFIG_DIR" ]; then
  printf 'Creating OpenCode config directory: %s\n' "$OPENCODE_HOST_CONFIG_DIR"
  mkdir -p "$OPENCODE_HOST_CONFIG_DIR"
fi

# Verify read/write permissions.
if [ ! -r "$OPENCODE_HOST_CONFIG_DIR" ] || [ ! -w "$OPENCODE_HOST_CONFIG_DIR" ]; then
  printf 'Error: Permission denied for %s\n' "$OPENCODE_HOST_CONFIG_DIR"
  printf 'Fix with: chown %s:%s %s\n' "$LOCAL_UID_VALUE" "$LOCAL_GID_VALUE" "$OPENCODE_HOST_CONFIG_DIR"
  exit 1
fi

# Write local .env for docker compose.
cat > .env <<ENV
OPENCODE_HOST_CONFIG_DIR=${OPENCODE_HOST_CONFIG_DIR}
LOCAL_UID=${LOCAL_UID_VALUE}
LOCAL_GID=${LOCAL_GID_VALUE}
STUDIO_PORT=${STUDIO_PORT:-3210}
ENV

docker compose --env-file .env up -d --build
printf '\nOpenCode Team Studio : http://127.0.0.1:%s\n' "${STUDIO_PORT:-3210}"
