#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
LOCAL_UID_VALUE="${SUDO_UID:-$(id -u)}"
LOCAL_GID_VALUE="${SUDO_GID:-$(id -g)}"
cat > .env <<ENV
LOCAL_UID=${LOCAL_UID_VALUE}
LOCAL_GID=${LOCAL_GID_VALUE}
STUDIO_PORT=${STUDIO_PORT:-3210}
ENV
docker compose up -d --build
printf '\nOpenCode Team Studio : http://127.0.0.1:%s\n' "${STUDIO_PORT:-3210}"
