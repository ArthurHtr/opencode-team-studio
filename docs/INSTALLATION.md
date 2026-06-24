# Installation

## Docker Run

```bash
docker run -d \
  --name opencode-team-studio \
  --restart unless-stopped \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e OPENCODE_CONFIG_DIR=/config \
  -p 127.0.0.1:3210:3000 \
  -v "$HOME/.config/opencode:/config" \
  ghcr.io/arthurhtr/opencode-team-studio:0.1.0-alpha.1
```

Open `http://127.0.0.1:3210`.

## Docker Compose

Create a `.env` file:

```env
OPENCODE_HOST_CONFIG_DIR=/home/your-user/.config/opencode
LOCAL_UID=1000
LOCAL_GID=1000
STUDIO_PORT=3210
STUDIO_VERSION=0.1.0-alpha.1
```

Then:

```bash
docker compose --env-file .env up -d
```

Or use the included `compose.yaml` with the GHCR image:

```bash
docker compose up -d
```

## Local Development

Prerequisites:

- Node.js 22 (or use `.nvmrc` with nvm)
- pnpm 10 (enabled via corepack)

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Open `http://127.0.0.1:3000`.

Set `OPENCODE_CONFIG_DIR` to point to your OpenCode configuration:

```bash
OPENCODE_CONFIG_DIR=~/.config/opencode pnpm run dev
```

## Linux

Tested on Debian/Ubuntu-based systems. The Docker image uses `node:22-bookworm-slim` (Debian Bookworm).

## macOS

The Docker deployment works on macOS via Docker Desktop. Ensure Docker Desktop is running and the OpenCode config directory is accessible.

```bash
docker run -d \
  --name opencode-team-studio \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e OPENCODE_CONFIG_DIR=/config \
  -p 127.0.0.1:3210:3000 \
  -v "$HOME/.config/opencode:/config" \
  ghcr.io/arthurhtr/opencode-team-studio:0.1.0-alpha.1
```

## Windows (WSL2)

Use WSL2 with Docker Desktop:

```powershell
docker run -d ^
  --name opencode-team-studio ^
  --user "$(id -u):$(id -g)" ^
  -e HOME=/tmp ^
  -e OPENCODE_CONFIG_DIR=/config ^
  -p 127.0.0.1:3210:3000 ^
  -v "$HOME/.config/opencode:/config" ^
  ghcr.io/arthurhtr/opencode-team-studio:0.1.0-alpha.1
```

Or from WSL2 bash:

```bash
docker run -d \
  --name opencode-team-studio \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e OPENCODE_CONFIG_DIR=/config \
  -p 127.0.0.1:3210:3000 \
  -v "$HOME/.config/opencode:/config" \
  ghcr.io/arthurhtr/opencode-team-studio:0.1.0-alpha.1
```

## Changing the port

Override the port mapping in Docker:

```bash
docker run -d \
  --name opencode-team-studio \
  -p 127.0.0.1:8080:3000 \
  -e HOME=/tmp \
  -e OPENCODE_CONFIG_DIR=/config \
  -v "$HOME/.config/opencode:/config" \
  ghcr.io/arthurhtr/opencode-team-studio:0.1.0-alpha.1
```

Or set `STUDIO_PORT` in your `.env` file when using Docker Compose.

## Custom configuration location

Override `OPENCODE_CONFIG_DIR`:

```bash
docker run -d \
  --name opencode-team-studio \
  -e HOME=/tmp \
  -e OPENCODE_CONFIG_DIR=/custom/path \
  -p 127.0.0.1:3210:3000 \
  -v /custom/path:/config \
  ghcr.io/arthurhtr/opencode-team-studio:0.1.0-alpha.1
```

## Updating the version

```bash
docker stop opencode-team-studio
docker rm opencode-team-studio

docker run -d \
  --name opencode-team-studio \
  --restart unless-stopped \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e OPENCODE_CONFIG_DIR=/config \
  -p 127.0.0.1:3210:3000 \
  -v "$HOME/.config/opencode:/config" \
  ghcr.io/arthurhtr/opencode-team-studio:0.2.0
```

Your configuration is preserved in the mounted volume.

## Uninstalling

```bash
docker stop opencode-team-studio
docker rm opencode-team-studio
docker rmi ghcr.io/arthurhtr/opencode-team-studio:0.1.0-alpha.1
```

Your configuration files remain in the mounted volume and are not affected by container removal.
